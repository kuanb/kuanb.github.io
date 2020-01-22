---
published: true
title: Dynamic bytestring-encoded arrays
layout: post
summary: Using construct-based declarative structure with variable-lengthed arrays
comments: true
---


## OpenLR and intermediate LRPs

I'm currently working with encoding and decoding data in OpenLR and other related formats. This post documents a challenge I encountered while doing so and potential patterns for how to work around it.

OpenLR is a linear referencing format managed by [this organization](https://www.openlr-association.com/), and is largely helmed by TomTom. The latest documentation outlining the spec is [here](https://www.openlr-association.com/fileadmin/user_upload/openlr-whitepaper_v1.5.pdf).

Chapter D outlines the physical, binary format that the data is served in. In section 8.1 line location OpenLR architecture is presented for data with just two LRPs (location reference points) and those with more than 2 (more than the first and last). These that are in the later group have LRPs that are known as intermediate reference points. Often, a binary payload structure will include a "count" attribute that indicates the number of of (in this case) intermediate values so that an array of appropriate length can be assembled to consume that portion of the payload.

But, in the case of the OpenLR structure (again, see the following section: `8.1.2. Line location with n location reference points (n > 2)`), it appears that this is not clearly defined. As a result, an alternative method needs to be used to determine the length of the overall binary payload and, from that, to be able to calculate the number of LRPs.

## Declarative parsing/building

Currently, I am using [a Python library](https://construct.readthedocs.io/en/latest/), called `construct`, that bills itself as "a powerful declarative and symmetrical parser and builder for binary data." This library allows one to describe the architecture of the binary payload as a `Struct` object and, from that, parse to - or build from - nested objects in Python.

## The challenge

`construct` has a variety of elements, under the broad type of "repeaters", that support handling arrays of data that are held in binary format. You can see more about them [here](https://construct.readthedocs.io/en/latest/basics.html#repeaters). The challenge is that I have a situation where there are a variable number of elements held in the array element and know way to know the amount without being aware of the whole length of the binary array.

As a result; I would need to be able to "sniff ahead" through the entire binary to calculate the total length to get the value for the array length `n` that I would need.

To abstract this from the problem statement and represent this generically I can present the following:

{% highlight python %}
import random
from construct import *

def make_st(n):
    """Assemble an array of byte-long structures"""
    return Array(
        n,
        Struct(
            "foo" / Nibble,
            "bar" / Nibble,
        )
    )

def ran():
    """Generates a random value that fits in a Nibble"""
    return random.choice(range(16))


n = 5  # parameterizable
st = make_st(n)

# use struct to build and parse decoded bytestring
data = [{"foo": ran(), "bar": ran()} for i in range(n)]
b = st.build(data)
print(f"\nbuilt bytestring:\n {b}")

p = st.parse(b)
print(f"\nlist container:\n {p}")
{% endhighlight %}


The above executed will produce the following log output:

{% highlight bash %}
built bytestring:
 b'\x00\x00\x00\x00\x01\x01\x00\x00\x00\x01\x00\x01\x01\x00\x00\x00\x01\x00\x00\x01\x00\x01\x00\x00\x01\x01\x00\x01\x00\x00\x00\x01\x01\x01\x00\x00\x00\x00\x01\x00'

list container:
 ListContainer: 
    Container: 
        foo = 0
        bar = 12
    Container: 
        foo = 5
        bar = 8
    Container: 
        foo = 9
        bar = 4
    Container: 
        foo = 13
        bar = 1
    Container: 
        foo = 12
        bar = 2
{% endhighlight %}

What we have a method where we can create a byte string of `f(n)` length where length is a function of the number of containers held in the main array. The number of containers is, in this case, determined up front and thus known. Because it is known, it can be passed to the `Struct` as a parameter, allowing `construct` to allocate the appropriate length for byte string consumption directed towards the array components.

Now what happens if n value is not known and byte value is received? Is there a way of dynamically calculating the n value or describing it within the `Struct`?


Let's say that we just begin with the following:

{% highlight python %}
bs = b"\x00\x00\x00\x00\x01\x01\x00\x00\x00\x01\x00\x01\x01\x00\x00\x00\x01\x00\x00\x01\x00\x01\x00\x00\x01\x01\x00\x01\x00\x00\x00\x01\x01\x01\x00\x00\x00\x00\x01\x00"
{% endhighlight %}

All we know is that this structure contains some amount of arrays with a known structure. How can we know how many to pass through the array structure?

## One solution

The solution I came up with requires doing two things:

- creating a separate `construct` structure to handle assessing the total length of the bytes
- creating a new structure that leverages the `this` method from `construct`

To tackle the first item, with the variable `bs` that we created earlier, we can use the `GreedyRange` repeater (docs [here](https://construct.readthedocs.io/en/latest/api/repeaters.html#construct.GreedyRange)) to iterate through the byte array until it runs of our bytes to process. A structure is defined using the `Padding(1)` pattern that allows us to just move through the number of bits without worrying about actually parsing them to get a count instead for the total number that are present:

{% highlight python %}
st = GreedyRange(Padding(8))
p = st.parse(bs)

print(len(p))
# 5
{% endhighlight %}


Once computed, we can return that length value and pass that in as a keyword argument to a new structure that, instead of having a hardcoded array length or an array length that refers to some other element in the structure, instead refers to the keyword argument it is passed. This is accomplished through `construct`'s `this` operator:

{% highlight python %}
st2 = Array(
    this.n,
    Struct(
        "foo" / Nibble,
        "bar" / Nibble,
    )
)

n = len(p)
st2.parse(bs, n=n)
{% endhighlight %}


Now it is possible to dynamically parse the decoded byte string without knowing the array length `n` prior to parsing.


{% highlight bash %}
ListContainer([Container(foo=0, bar=12), Container(foo=5, bar=8), Container(foo=9, bar=4), Container(foo=13, bar=1), Container(foo=12, bar=2)])
{% endhighlight %}

# Next steps

It would still be nice if there were a way to do this by "sniffing" ahead and describing a get of the padded length such that the throwaway struct and related step would not have to be performed. I suspect this is possible, and that I have just not yet figured this out.

There is the notion of defining container values that are derivative of the other attributes held in the structure. This is covered in part in the `len_` expression documentation, [here](https://construct.readthedocs.io/en/latest/meta.html#using-len-expression). In this example, `Rebuild` is used to demonstrate how an attribute can point to the output (in this case the count) of some other attribute and be calculated dynamically as needed.

While valuable; what I need is something that does this and then "rewinds" back so that the elements can be re-parsed differently. I've [asked for help on Github on the repo](https://github.com/construct/construct/issues/829). If it turns out there is a more declarative way of doing this, I will publish an update accordingly.