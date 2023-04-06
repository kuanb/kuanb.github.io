---
published: true
title: Fast de/serialization with numerical arrays
layout: post
summary: Efficiently pass through lists of floats between languages via Redis
comments: true
---

# Introduction

This post demonstrates two tasks. First, it shows how slow string parsing is with Python and why more efficient serialization patterns are necessary for packing and unpacking an array of numerical values. Secondly, it demonstrates two methods - one that works within a "contained" Python-specific ecosystem and one that is more flexible and language and package agnostic.

The impetus for this evaluation was the need to serialize an array of numerical values to be passed through a Redis cache and read by a subsequent Python microservice.

## Python array serialization and unpacking

Imagine a condition where you need to pass through an array of values from one service to another. For example, you need to `xadd` some value `scores` to a Redis cache which is represented as an array of values: `[1.1, 2.4, 12.2 ... 2.3]`. Attempting to write a list to a Redis cache will fail: `redis.exceptions.DataError: Invalid input of type: 'list'. Convert to a bytes, string, int or float first.`. Instead, it will be necessary to serialize and deserialize it on the comsuming service's end.

We can first assume some array `a` defined as:
```python
a = [round(random.random() * 100, 2) for _ in range(10)]
```

A naive serialization can be to just convert this list to a string. For example: `",".join(map(str, a))`.

However, Python is quite slow at parsing strings and converting them back to numerical types. We can write a little test of this to explore the time cost of this conversion:

```python
import random

data = [[round(random.random() * 100, 2) for _ in range(100)] for _ in range(10_000)]
data_serialized = [",".join(map(str, a)) for a in data]

times = []
for i in range(100):
    start = time.time()
    res = [list(map(float, n.split(","))) for n in data_serialized]
    stop = time.time()
    times.append(round(stop-start, 3))
    
np.mean(times).round(3), np.percentile(times, 0.5).round(3), np.percentile(times, 0.9).round(3)
# (0.333, 0.302, 0.303)
```

This will demonstrate that it takes about 0.3 seconds to parse a typical set of arrays that we've generated. However, when dealing with 100s of thousands of these array, this performance becomes problematic within a larger pipeline that is expecting all these values to be ingested "quickly" (e.g. the entire half million arrays processed within a second or two).

## Python array serialization optimization with numpy

`numpy` allows for an out-of-the box optimization to address this by allowing arrays of numbers to be serialized with an easy to/from pattern. A given array can be serialized with the `tobytes()` method: `np.array([1.1,2.2,3.3]).tobytes()`. It can then be read back with `frombuffer` such that:

```python
raw = [1.1,2.2,3.3]
a = np.array(raw).tobytes()
parsed = np.frombuffer(a)
assert parsed.tolist() == raw  # true
```

We can then redesign our test from earlier but replace the serialization and deserialiation pattern with the `numpy` library's utility:

```python
import random

data = [[round(random.random() * 100, 2) for _ in range(100)] for _ in range(10_000)]
data_serialized = [np.array(a).tobytes() for a in data]

times = []
for i in range(100):
    start = time.time()
    res = [np.frombuffer(a) for a in data_serialized]
    stop = time.time()
    times.append(round(stop-start, 3))
    
np.mean(times).round(3), np.percentile(times, 0.5).round(3), np.percentile(times, 0.9).round(3)
# (0.009, 0.008, 0.008)
```

We can of course see major improvements. We have gone from 0.3 seconds per 10k to 0.008 seconds or 8 ms. This acheives about a 35x speed up.

However, with this method there is a downside in that both the service producing the binary and the service consuming the binary need to have Python and `numpy` available. What is the producing service is instead a NodeJS service for example?

## Base64 encoded binaries

Imagine a condition where the service writing new entries to is a NodeJS service. A Python service then reads from the Redis cache. In order to address the deserialization performance issues while also avoiding reliance on convenience utilities like `tobytes` in `numpy` that tie us to that ecosystem, we can create the binaries ourself and write the encoded binaries to Redis instead.

We can utilize built-in libraries in NodeJS (`Buffer`) to create a binary representation of the list, and then convert it to a string using base64 encoding. Redis can store the resulting string as a value associated with a key, which can then be retrieved in Python and deserialized back into a list of floats using the `base64` and `struct` modules.

```JavaScript
function listAsBinary(arrNums, size) {
    // generate binary
    const b = Buffer.alloc(arrNums.length * size);

    for (let i = 0; i < arrNums.length; i++) {
        // write number to each paired slot
        b.writeFloatLE(arrNums[i], i * size);
    }

    // encode
    return b.toString('base64');
}
```

Once written to Redis, the Python step can, instead from using `numpy.frombuffer`, deserialize the list using Python's `struct` library:

```python
def _deserialize_arr(str_arr: str, size: int) -> Tuple[float]:
    decoded = base64.b64decode(str_arr)
    l = len(decoded) // size
    return struct.unpack(f"<{l}f", decoded)
```

First, the base64-encoded string is decoded. Next, the entries for each slot are accessed via the `unpack` method in `struct` to generate an array of numerical values assocaited with each entry.

Performance results should be broadly in line with `numpy` (with `numpy` often performing slightly better due to various optimizations). However, the order of magnitude of completion time is in line with `numpy` and addresses the severe performance costs of string conversion.