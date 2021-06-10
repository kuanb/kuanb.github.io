---
published: true
title: More efficient spatial intersection in Spark
layout: post
summary: A poor man's R-tree spatial index solution
comments: true
---

# Introduction

The purpose of this post is to document a pattern for improving the speed of performing spatial intersections in Spark. For these examples, I will use PySpark. When working in GeoPandas, generating an R-tree spatial index and using that to improve intersection speed is a pattern well documented by posts such as [this one](https://geoffboeing.com/2016/10/r-tree-spatial-index-python/).

In this pattern, a spatial index is generated from a point array and that is intersected with the filter polygon. The subset from that then has a "full" intersection performed against it. This reduces the number of point-to-polygon full intersections that needs to be performed.

{% highlight python %}
spatial_index = gdf.sindex
possible_matches_index = list(spatial_index.intersection(polygon.bounds))
possible_matches = gdf.iloc[possible_matches_index]
precise_matches = possible_matches[possible_matches.intersects(polygon)]
{% endhighlight %}
Above: This is the pattern suggested for generating an R-tree spatial index to improve intersection performance.


# Working in Spark

If we were to approach the same problem with a big dataset of points in PySpark we would likely create a UDF that would be applied row-wise. Each row would have an intersection performed between the point and the polygon.

{% highlight python %}
def perform_intersection(x, y):
    return Point(x, y).intersects(make_poly())
{% endhighlight %}
Above: An example of what a Py function that could be used as a UDF might look like that would be applied row-wise.


## Setting up a PySpark test

For the purpose of this post, let's use the following imports:


{% highlight python %}
import geopandas as gpd
import mercantile
import random
import time
from shapely.geometry import Point, Polygon

from pyspark.sql import Row
import pyspark.sql.functions as F
import pyspark.sql.types as T
{% endhighlight %}

We will also create a reference function that helps us generate an example filtering polygon. This happens to be one around downtown Denver. We will want to filter to just points in this area.

{% highlight python %}
def make_poly():
    return Polygon([
        [-104.99951362609, 39.75735212859],
        [-105.00586509704, 39.75200728359],
        [-105.00045776367, 39.74686000382],
        [-104.99934196472, 39.74138234788],
        [-104.99779701232, 39.74012836540],
        [-104.98715400695, 39.74006236568],
        [-104.98741149902, 39.75451479338],
        [-104.99367713928, 39.75919963287],
        [-104.99702453613, 39.75629638961],
        [-104.99951362609, 39.75735212859]])
{% endhighlight %}

Finally, we will have a helper method that creates a series of N (1 million) random points. We will use a smaller number just for the sake of demonstration here.

{% highlight python %}
bounds = [-109.05, 37.0, -102.04, 40.98]

rows = []
for i in range(1_000_000):
    x = bounds[0] + ((bounds[2] - bounds[0]) * random.random())
    y = bounds[1] + ((bounds[3] - bounds[1]) * random.random())
    rows.append(Row(id=i, x=x, y=y))

df = spark.createDataFrame(rows)
{% endhighlight %}


## Simple version of intersection

The simple version of the intersection performed on a PySpark data frame could be performed like so:

{% highlight python %}
intx_udf = F.udf(perform_intersection, T.BooleanType())

# basic, brute force run
start_time = time.clock()
brute_force_res = df.where(intx_udf(F.col("x"), F.col("y"))).count()
run_time = round(time.clock() - start_time, 3)
print("- - -")
print(f"brute force result: {brute_force_res}")
print(f"brute force run time: {run_time} seconds")
{% endhighlight %}

The results from this run on my local machine were as follows:

{% highlight python %}
# brute force result: 8
# brute force run time: 0.016 seconds
{% endhighlight %}

There are 2 inefficiencies here:
1. Each row has to have a Python instance spun up that creates 2 Shapely objects that are then intersected and the result returned.
2. All rows are processed, none are skipped.

# Quadkey as a poor-man's spatial index

One quick way to reduce the number of intersections is to find ways to partition your data. Imagine if all these points were all the points in the US, or all the points in Colorado. In either case, we want to filter down to a more fine grained area.

## Preparing the data frame with quadkey indexing

One way to do this is to find the quadkey/s that contain the polygon filter. In this case, the z12 (zoom 12 quadkey) for this filter polygon is `023101030121`. We can now pre-process our points data frame to have a column that states the quadkey that is associated with each point.

{% highlight python %}
def generate_quadkey(x, y):
    return mercantile.quadkey(mercantile.tile(x, y, 18))

qk_udf = F.udf(generate_quadkey, T.StringType())

# prep for poor man's r-tree
start_time = time.clock()
df2 = (
    df
    .withColumn("qk", qk_udf(F.col("x"), F.col("y")))
    .withColumn("qk2", F.col("qk").substr(1, 12))
)
df2.persist()
run_time = round(time.clock() - start_time, 3)
print("- - -")
print(f"quadkey method 1-time prep step run time: {run_time} seconds")

# results:
# quadkey method 1-time prep step run time: 0.006 seconds
{% endhighlight %}
Above: Here's how we can prep the data frame to have an index column that has the quadkeys associated with each point.

## Using the quadkey column with intersections

We can now use the quadkey to filter down the number of points that need to be checked in detail (with a "full" intersection). These sorts of string checks are way cheaper than the UDF with the full intersection. We can vastly improve the runtime for larger datasets with this intervention.

{% highlight python %}
start_time = time.clock()
qk_res = (
    df2
    .where(F.col("qk").substr(1, 12) == "023101030121")
    .where(intx_udf(F.col("x"), F.col("y")))
).count()
run_time = round(time.clock() - start_time, 3)
print("- - -")
print(f"quadkey method result: {qk_res}")
print(f"quadkey method run time: {run_time} seconds")

# results:
# quadkey method result: 8
# quadkey method run time: 0.007 seconds
{% endhighlight %}

# Is there more we can do?

We can keep taking this further if we want. We can come up with a new UDF that handles a group of x/y coordinates after a filter is produced. The advantage here is to reduce the number of rows that a UDF needs to be applied on. Such a solution requires that the filtering polygon and the segmentation of points is small enough or controlled enough to produce rows have a group of point coordinates that is small enough to be held in memory by one of the workers doing this processing.

{% highlight python %}
def perform_intersection_group(ids, xs, ys):
    geoms = [Point(x, y) for x, y in zip(xs, ys)]
    gdf = gpd.GeoDataFrame({"id": ids}, geometry=geoms)
    polygon = make_poly()
    sub = gdf[gdf.intersects(polygon)]
    return list(sub["id"].astype(int))

intx_hybrid_udf = F.udf(perform_intersection_group, T.ArrayType(T.IntegerType()))
{% endhighlight %}

Now, we can update our logic to first filter down to the quadkey of interest, and then to further subdivide within that quadkey and break the sublist into groups. These groups can then be fed to workers and each can have a list of points intersected with a polygon. In fact, it may be possible to even bring back the original example of a spatial intersection being created and leveraged when performing intersections between a polygon and a cluster of points at this point.

{% highlight python %}
# prep for poor man + regular r-tree combined
start_time = time.clock()
qk_res = (
    df2
    .where(F.col("qk").substr(1, 12) == "023101030121")
    .withColumn("qk_group", F.col("qk").substr(1, 14))
    .groupBy("qk_group")
    .agg(
        F.collect_list("id").alias("ids"),
        F.collect_list("x").alias("xs"),
        F.collect_list("y").alias("ys")
    )
    .withColumn("keep_ids", intx_hybrid_udf(F.col("ids"), F.col("xs"), F.col("ys")))
    .withColumn("keep_ids", F.explode(F.col("keep_ids")))
).count()
run_time = round(time.clock() - start_time, 3)
print("- - -")
print(f"quadkey hybrid w/ r-tree method result: {qk_res}")
print(f"quadkey hybrid w/ r-tree method run time: {run_time} seconds")
{% endhighlight %}

# Conclusion

When working with large/big datasets, find ways to filter data down to a more reasonable size as soon as possible. With spatial intersections, marking the quadkey of each point might help with a spatial intersection by allowing you to quickly remove immediate outlier points without having to construct a spatial index or otherwise track and index all the points that lie outside the target quadkey/s that encapsulates the polygon being used to filter the points.
