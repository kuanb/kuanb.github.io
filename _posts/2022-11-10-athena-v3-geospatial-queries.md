---
published: true
title: Trino/Presto spherical distance capabilities
layout: post
summary: AWS Engine V3 now supports full Trino geospatial functions from coordinate data
comments: true
---

# Introduction

AWS has been incrementally releasing some geospatial functionality on Athena over the past few years. Athena engine version 2 released a series of major quality of life improvements ([see blog post](https://docs.aws.amazon.com/athena/latest/ug/geospatial-functions-list-v2.html)) that allowed for the assembly of geospatial primitive spatial types.

With version 3, new operators allow for more advanced spatial operations to be performed and expressed just through Athena's SQL interface (rather than, say, needing to spin up a Spark stack and run user-defined functions over the coordinate data).

In this blog post, I will demonstrate a quick example of using these features to calculate attributes from more "complex" spatial types. The [Trino documentation](https://trino.io/docs/current/functions/geospatial.html#ST_GeometryFromText) already describes how to use a `to_spherical_geography` to calculate great circle distance between two points cast as `ST_Point()` objects:

```
ST_Distance(to_spherical_geography(ST_Point(-71.0882, 42.3607)), to_spherical_geography(ST_Point(-74.1197, 40.6976)))
```

## Example length calculation

Let's say your data is stored in the following format with a coordinate array representing the path of a line. If you want to calculate, say, the length of this linestring, you can do so by building up from the sum of the pairwise coordinates using the same pattern of `ST_Distance()` shown in the Trino documentation sampled above.

First, the start data:

```
select '[[130.266523,33.317762],[130.265568,33.317536],[130.263366,33.317021],[130.262584,33.316808],[130.261858,33.316611]]' as coords
```

This data can then be parsed as a JSON string:

```
select cast(json_parse(coords) as array(array(double))) as coords
```

From this point, we can use this (extremely handy) `to_spherical_geometry` method to recast each coordinate as a point on a globe, which will allow for spherical distance calculation (as opposed to Euclidean distance):

```
transform(coords, x -> to_spherical_geography(ST_Point(x[1], x[2]))) as points
```

Now that we have an array of points that are in spherical projection, we need to pair them with their predecessor to enable a distance calculation:

```
select
    array [element_at(points, 1)] || points as points_fr,
    points || array [element_at(points, -1)] as points_to
```

Distances can now be defined between each pairing, once zipped together. For each pair, a distance can be measured.

```
select
    reduce(
        zip_with(points_fr, points_to,
            (x, y) -> ST_Distance(x, y)
        ),
        0,
        (s, x) -> s + x,
        s -> s
    ) as dist_meters
from paired
```

The final step will output, for that single example input, a column `dist_meters` with a value of `452.05113745459886` meters.

## Conclusion

Thanks to the ability to project as a spherical geography, distance measures can now be expressed directly in Athena SQL queries. Wrapping together the above steps into a single defined query outputting the results described above can look like this:

```
with base as (
    select '[[130.266523,33.317762],[130.265568,33.317536],[130.263366,33.317021],[130.262584,33.316808],[130.261858,33.316611]]' as coords
),
parsed_base as (
    select cast(json_parse(coords) as array(array(double))) as coords
    from base
),
as_geoms as (
    select
        transform(coords, x -> to_spherical_geography(ST_Point(x[1], x[2]))) as points
    from parsed_base
),
paired as (
    select
        array [element_at(points, 1)] || points as points_fr,
        points || array [element_at(points, -1)] as points_to
    from as_geoms
),
distances as (
    select
        reduce(
            zip_with(points_fr, points_to,
                (x, y) -> ST_Distance(x, y)
            ),
            0,
            (s, x) -> s + x,
            s -> s
        ) as dist_meters
    from paired
)

select * from distances
```
