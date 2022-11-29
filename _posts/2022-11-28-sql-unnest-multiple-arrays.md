---
published: true
title: Exploding multiple arrays
layout: post
summary: Trino/Presto pattern for unnesting multiple grouped arrays
comments: true
---

# Introduction

The purpose of this post is to document the pattern for utilizing the `UNNEST` pattern for multiple arrays. `UNNEST` can be useful for "exploding" a row with an array to multiple rows (where the row count is equal to the number of values in each array), each paired with the other desired information from the original row adjacent to the array. However, it is not immediately clear that the same can be performed with multiple arrays.

In fact, documentation may lead one to think that the `zip` method would be the appropriate pattern here:
```
SELECT zip(ARRAY[1, 2], ARRAY['1b', null, '3b']); -- [ROW(1, '1b'), ROW(2, null), ROW(null, '3b')]
```

In fact, it is not. Instead, `UNNEST` can take multiple arrays and transform the results into multiple exploded columns.

## Example

Imagine the following case, where there are 3 rows of data desired to be "exploded" alongside the id column:

```
select
    1 as ref_id,
    array['a', 'b', 'c'] as a1,
    array['d', 'e', 'f'] as a2,
    array['g', 'h', 'i'] as a3
```

The dataframe for the above selection looks like:

```
#   ref_id  a1  a2  a3
1   1   [a, b, c]   [d, e, f]   [g, h, i]
```

The `UNNEST` functin can be applied here to explode all 3 columns in fact, at the same time:

```
with base as (
    select
        1 as ref_id,
        array['a', 'b', 'c'] as a1,
        array['d', 'e', 'f'] as a2,
        array['g', 'h', 'i'] as a3
)

cross join unnest(
    a1, a2, a3
) as t(c1, c2, c3)
```

The resulting dataframe looks like:

```
#   ref_id  c1  c2  c3
1   1   a   d   g
2   1   b   e   h
3   1   c   f   i
```

This pattern can be used to explode and pair any number of rolled-up array cells against their adjacent desired column values.
