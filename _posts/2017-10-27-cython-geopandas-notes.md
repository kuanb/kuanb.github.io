---
published: true
title: Notes on Geopandas Cythonization Effort
layout: post
summary: Exploratory results from variable buffer operations on a Cythonized GeoDataFrame
comments: true
---

# Introduction

There’s been a great deal of work lately on GeoPandas, specifically with the intent of getting significant performance increases out of it by “vectorizing” the geometry column such that spatial operations were performed at in C and not on an object-by-object bases through Shapely’s API.

This work has primarily been helmed by two individuals, Matthew Rocklin and Joris Van den Bossche. They have each written about the work in blog posts, you can read Matthew’s [here](http://matthewrocklin.com/blog/work/2017/09/21/accelerating-geopandas-1) and Joris’s [here](https://jorisvandenbossche.github.io/blog/2017/09/19/geopandas-cython/). In either post, you can see how the current structure of GeoPandas limits performance when performing geometric operations on a large set of geometries.

Truly, a huge thank you to these two individuals for the crazy amount of work they have put into making these Geopandas improvement a reality - they will no doubt be appreciated by all who use the tool in the future.

### Purpose

The purpose of this post is to not introduce the improvements to the Geopandas library in any depth. For that, you should check out the aforementioned posts. Instead, this post is simply meant to hold notes on how the new library provides performance increases over Geopandas main/master branch.

# Use Case
 I will be focusing on a single use case that I found to be a pain point in Geopandas. That is performing “variable buffer aggregations” on a given geo-dataset. What needs to happen is this:

For each geometry in the dataset, determine a buffer distance that varies
Identify all other geometries in the dataset that are within that distance
For all those geometries, return the result of some operation on that subset’s attributes

### An Example

It may be easier to see this as an example. Let’s say we create the below heuristic to determine the amount a given area should be buffered. We need two attribute values, employment and household count. From those two, a series of operations are performed that returns a meter distance that we should use as our “variable distance.”

{% highlight python %}
def _generate_range(emp_count, hh_count):
    # Default ratio
    ratio = 0.1  # miles
    if hh_count > 0:
        ratio = emp_count/hh_count
    calc_range = max([2, (ratio * 20)])

    # Add a top level threshold
    max_range = 75.0  # miles
    adj_range = min([max_range, calc_range])
    
    # Convert miles to meters
    return 1609 * adj_range
{% endhighlight %}

For each row in the data frame, we will use the above function to determine a meter distance and then use that as a mask threshold to subset the whole data frame.

{% highlight python %}
distances = gdf.distance(row.geometry)
mask = (distances <= adj_range)
all_gdf[mask].employees.sum()
{% endhighlight %}

The `sum` result for each will be the output that we are looking for as a result of this variable buffer operation. Hopefully this should help illustrative roughly the kind of process that I often need to perform.

For the purposes of the below work, I'll be using a dataset of census blocks from St. Louis, Missouri. I've made a subset example dataset of this available as a Gist, [online here](https://gist.github.com/kuanb/e0efc261b45fe9b1dca6c3e340acf1e1). It's got the first thousand rows and will be sufficient for repeating the work below.

### Example Dataset

I’ll use an example dataset composed of census blocks from St. Louis, Missouri. Another aide: Check out this sweet plot of all the Census blocks in St. Louis, Missouri, below. I plotted it to just sanity check my import of Census data.  Attached to each block are two values: employee count and household count. The only other information I have is the shapes of each block as a WKT. Each of these are converted to Shapely geometries during the import process.

<blockquote class="twitter-tweet" data-lang="en"><p lang="en" dir="ltr">Pointless+pretty Friday plot: All census blocks in <a href="https://twitter.com/hashtag/StLouis?src=hash&amp;ref_src=twsrc%5Etfw">#StLouis</a> converted to bounding boxes. <a href="https://t.co/e9sCo4vCZ0">pic.twitter.com/e9sCo4vCZ0</a></p>&mdash; Kuan Butts (@buttsmeister) <a href="https://twitter.com/buttsmeister/status/924009849876127744?ref_src=twsrc%5Etfw">October 27, 2017</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

# Current performance

The current Geopandas main branch uses Shapely’s API to calculate the distance on a per geometry case. As a result, the operation is not “vectorized.” That is, Geopandas does not itself utilize pointers to allow the geometry operations to be performed all within C. Instead, each distance calculation is performed on a Shapely object. This means there are `n` round trips to and from C for a GeoDataFrame of length `n`. 

This method is slow. To help visualize it, you can imagine the distance calculations being performed one by one:

{% highlight python %}
# Get all distances via euclidean distance measure
distances = []
# This roughly mimics why the old GeoPandas way was slow
for g in all_gdf.geometry.values:
    # Pull out and calculate the distance from each Shapely
    # geometry one by one...
    d = g.distance(row.geometry)
    distances.append(d)
{% endhighlight %}

# Workaround

Frequently, when dealing with these types of problems, the geometries in question are small enough (or the scale of the analysis is such that) converting all geometries in the data frame to their composite centroid values (the `x` and `y` values of the centroid coordinates) is acceptable. With these values held as Numpy float values, we can completely vectorize the operation such that the calculations (using Euclidean distance), can be performed without any geometric operations involved. The below method should help illustrate what I mean:

{% highlight python %}
x1 = row.geometry.centroid.x
y1 = row.geometry.centroid.y

# Get all distances via euclidean distance measure
distances = np.sqrt((x1 - all_gdf.x) ** 2 + (y1 - all_gdf.y) ** 2)
{% endhighlight %}

As you can see form the above snippet, this operation could run without Geopandas or its underlying Shapely objects. That is, this operation could be performed just within Pandas. All "spatial" operations would just be numerical operations that could be performed on Numpy vectorized columns within the Pandas DataFrame.

Here, we can create the whole operation to be performed with each geometry like so:

{% highlight python %}
def variable_buffer_summary(row, all_gdf):
    emp_count = float(row['employees'])
    hh_count = float(row['households'])
    adj_range = _generate_range(emp_count, hh_count)
    
    # Note that iterrows returns just Series
    # so we need to directly access the geometry
    x1 = row.geometry.centroid.x
    y1 = row.geometry.centroid.y

    # Get all distances via euclidean distance measure
    distances = np.sqrt((x1 - all_gdf.x) ** 2 + (y1 - all_gdf.y) ** 2)
    
    # Now we want a subset of those in the dynamically calcualted distance
    mask = (distances <= adj_range)
    
    # Now we want cumulative stats for this area
    # and return this as the result
    return all_gdf[mask].employees.sum()
{% endhighlight %}

To prepare for that operation, we would need to prepare the dataset by extracting the `x` and `y` values:

{% highlight python %}
all_xs = [c.x for c in stl_reproj.centroid]
all_ys = [c.y for c in stl_reproj.centroid]

# Go ahead and add these values to the dataframe
stl_reproj['x'] = all_xs
stl_reproj['y'] = all_ys
{% endhighlight %}

Once the dataset has been prepared, we can iterate through the dataset and apply the operation:

{% highlight python %}
start_time = time.time()

cumulative_res_1 = []
for i, row in stl_reproj.iterrows():
    r = variable_buffer_summary(row, stl_reproj)
    cumulative_res_1.append(r)
    
end_time = time.time()

time_diff = round(end_time - start_time, 2)
print(f'Run time: {time_diff} sec’)
# Run time: 23.36 sec
{% endhighlight %}

As you can see from the above output, this operation takes about 24 seconds. I’ll peg this as the target performance I’d like (hope/wish?) the Cythonized version of Geopandas will be able to approach.

When run with a GeoDataFrame of only 1000 geometries (the original dataset used in these examples has  9,749 geometries), instead, the operation runs in 2.3 seconds. I mention this because it will be relevant in the next section.  As an aside, you’ll note that this for loop is easily parallelized. One [can do so easily](http://kuanbutts.com/2017/06/18/dask-geoprocessing/) in Python with tools such as Dask and Dask Distributed.

# Cythonized Performance

We modify the same operation from before but instead use the Geopandas API. Since the version of Geopandas I am using right now is Cythonized, I will use the API and rely on the library to vectorize the operation.

We can modify the earlier function like so:

{% highlight python %}
def variable_buffer_summary_with_shapes(row, all_gdf):
    emp_count = float(row['employees'])
    hh_count = float(row['households'])
    adj_range = _generate_range(emp_count, hh_count)

    # Get all distances via euclidean distance measure
    distances = all_gdf.distance(row.geometry)
    
    # Now we want a subset of those in the dynamically calcualted distance
    mask = (distances <= adj_range)
    
    # Now we want cumulative stats for this area
    # and return this as the result
    return all_gdf[mask].employees.sum()
{% endhighlight %}

So how does this new method perform? Unfortunately it was running quite slowly. I did not want to wait for it to run all the way through the 9,749 geometries because the performance was taking quite a while so I went ahead and chose to subset the GeoDataFrame to 1000 geometries.

For reference, I reran the centroid-only variation and determine an average run time of 2.3 seconds (see comment from last section about this).

Once we reduce the GeoDataFrame to only 1000 rows instead of its previous nearly 10,000 rows, it completes much more quickly.

{% highlight python %}
start_time = time.time()

cumulative_res_2 = []
for i, row in stl_reproj.iterrows():
    r = variable_buffer_summary_with_shapes(row, stl_reproj)
    cumulative_res_2.append(r)
    
end_time = time.time()

time_diff = round(end_time - start_time, 2)
print(f'Run time: {time_diff} sec’)
# Run time: 45.56 sec
{% endhighlight %}

As you can see, the run time tends to take about 45 seconds. This is about 20 times the length of the centroid-based, non-spatial vectorized method.

As an aside

{% highlight python %}
diff = np.array(cumulative_res_1) - np.array(cumulative_res_2)

print(np.array(cumulative_res_1).mean()) # 6201.707
print(np.median(cumulative_res_1))       # 1651.0

print(diff.mean())     # -328.222
print(np.median(diff)) # -120.5
{% endhighlight %}

The results indicate help to illustrate the coarseness of the centroid method in this example case. Depending on the work you are doing, you may be able to easily imagine situations where centroid to centroid distances would not be enough and the error margin would be sufficient to measurably reduce model reliability.

# Shapely-based Method

Let’s swing back over to the Shapely-based “one by one” method that the main Geopandas branch employs.

We can model that performance right now by forcing that loop of comparing geometries one by one to occur, even though I happen to be checked out to the Cythonized branch right now:

{% highlight python %}
def variable_buffer_summary_with_shapes_slow(row, all_gdf):
    emp_count = float(row['employees'])
    hh_count = float(row['households'])
    adj_range = _generate_range(emp_count, hh_count)

    # Get all distances via euclidean distance measure
    distances = []
    # This roughly mimics why the old GeoPandas way was slow
    for g in all_gdf.geometry.values:
        # Pull out and calculate the distance from each Shapely
        # geometry one by one...
        d = g.distance(row.geometry)
        distances.append(d)
    
    # Now we want a subset of those in the dynamically calcualted distance
    mask = (np.array(distances) <= adj_range)
    
    # Now we want cumulative stats for this area
    # and return this as the result
    return all_gdf[mask].employees.sum()
{% endhighlight %}

Just like before, we can run this method on the 1000 row subset of the GeoDataFrame, like so:

{% highlight python %}
start_time = time.time()

cumulative_res_3 = []
for i, row in stl_reproj.iterrows():
    r = variable_buffer_summary_with_shapes_slow(row, stl_reproj)
    cumulative_res_3.append(r)
    
end_time = time.time()

time_diff = round(end_time - start_time, 2)
print(f'Run time: {time_diff} sec’)
# Run time: 104.89 sec
{% endhighlight %}

The results of this method suggest a roughly 4.5x increase in time cost over the Cythonized variation and a 45.6x increase in cost over the centroid-only method.

# Thoughts on Performance

Unfortunately, the costly loop operation over each geometry and the comparison of it to the entire GeoDataFrame is not abstracted. Perhaps there is a way to push this loop down to C as well. If so, I would be interested to hear propositions as to how this might occur.

In the end, the Cythonization method does make significant improvements to the performance of the distance operation but, in the end, effective parallelization techniques will be most critical to getting faster performance times when running this calculation.

That said, I really don’t want this to come across at all as me be down on the efforts on the project. It has, hands down, been amazing and I do not intend for my comments to be construed in a negative way. I've enjoyed following along - it's been my first significant exposure to Cython and I've found that a valuable opportunity - even though I have just been a fly on the wall during all of this (I wish I had more time - in general!).

The issue I am dealing with has to do particularly with the operation I am performing, which is effectively the calculation of a distance matrix wherein values are tossed on a row-by-row bases and the distances are used in a one-off summary operation. This calculation has a cost that grows exponentially as the number of rows `n` rises (Big O: O(N2)).

# Revisiting the Distance Matrix

One way to get the for loop out of Python is to create the entire distance matrix within the the Pandas data frame such that each geometry becomes paired with all other geometries. We can do this by creating a single new “join column” that has some single value (say, “1”) that it joins to itself on. This will create a table that is `n` by `n` tall.

{% highlight python %}
stl_reproj2 = stl_reproj.copy()

sr3 = pd.merge(stl_reproj2, 
               stl_reproj2,
               how='inner',
               on='join_col',
               left_index=False,
               right_index=False,
               suffixes=('_l', '_r'),
               copy=True)

print(len(stl_reproj2)), print(len(sr3))
# 1000
# 1000000
{% endhighlight %}

The above code snippet highlights how this can be done.. We can now see that we have two geometry columns, a `_l` and a `_r` one, like so:

{% highlight python %}
sr3.columns
Index(['employees_l', 'households_l', 'geometry_l', 'x_l', 'y_l', 'join_col',
       'employees_r', 'households_r', 'geometry_r', 'x_r', 'y_r'],
      dtype=‘object')
{% endhighlight %}

You also can check the `dtype` of the geometry column. For example, `sr3.households_l.dtype` would work on a non-geometry column or any Pandas data frame just fine. For geometry, we get `dtype(‘O’)`.

I wanted to see if we could still use these geometry columns even after the inner join operation. Instead of using the whole table, I wanted to just use a few (`head(5)`) to see what the results were. Again, once we selected out the geometries.

My first thought was to just point to the column that held each geometry and expect that to work:

{% highlight python %}
sr3.geometry_l.head(5).distance(sr3.geometry_r.head(5))
----------------------------------------------------------------------
AttributeError                       Traceback (most recent call last)
<ipython-input-211-d6b35ab3ac82> in <module>()
----> 1 sr3.geometry_l.head(5).distance(sr3.geometry_r.head(5))

/usr/local/lib/python3.6/site-packages/pandas/core/generic.py in __getattr__(self, name)
   3079             if name in self._info_axis:
   3080                 return self[name]
-> 3081             return object.__getattribute__(self, name)
   3082 
   3083     def __setattr__(self, name, value):

AttributeError: 'Series' object has no attribute 'distance'
{% endhighlight %}

Unfortunately, as you can see by the traceback, the result failed as the library thought that each column was a standard series, and not a series with hookups to performing geometric operations.

Recasting each as GeoSeries was sufficient to get the operation rolling again:

{% highlight python %}
a = gpd.GeoSeries(sr3.geometry_l.head(5))
b = gpd.GeoSeries(sr3.geometry_r.head(5))
a.distance(b)
{% endhighlight %}

Now that I had it working, I wanted to see what the performance was like if I did it on the whole set of geometries. To do this, I performed the same steps as above but, instead of generating a new GeoSeries just for the head of each, I did it for the entire column for each.

The resulting script, with some timing logs, looks like this:

{% highlight python %}
start_time = time.time()

a = gpd.GeoSeries(sr3.geometry_l)
b = gpd.GeoSeries(sr3.geometry_r)

all_ds = a.distance(b)
print(len(all_ds))  # make sure output is n x n tall
    
end_time = time.time()

time_diff = round(end_time - start_time, 2)
print(f'Run time: {time_diff} sec’)
{% endhighlight %}

Run times were, on average, 48.6 seconds. Run times were comparable with the performance seen in the for loop method that was used earlier - there appeared to be no significant gain over the looped variation. An advantage of the looped variation is that an `n x n` sized table can become quite large very quickly. Run times were observed to fluctuate a bit more in this method than in the for loop method. I recorded highs of as much as 112 seconds (and frequently saw 95 seconds) to perform this distance calculation. I was unable to isolate what caused the slower performance times during this effort.

I wanted to see if this method was even feasible given the fact that a joined table that is so long can easily be a no go just because of its size in memory. The thought was that, because the geometry column is now just pointers, I could allow for `n x n` tall tables because they would not be as expensive, especially if I just trimmed down their column to only the join column and the geometry column: `stl_reproj2[['geometry', ‘join_col']]`.

{% highlight python %}
sys.getsizeof(stl_reproj2)
# 0.06 MB

sys.getsizeof(sr3)
# 128.00 MB

sys.getsizeof(a)
# 48.000024 MB
{% endhighlight %}

Unfortunately, the large size of the inner joined matrix suggests to me that this remains a costly method. That, combined with the inconsistent performance, suggests that this remains a risky strategy for performing distance calculations from all points to all other points.

# Hiccups

This Cythonized branch of Geopandas is still quite new. As a result, not everything is ready for primetime. Thus, working with the library on this branch can be a bit tricky. I just wanted to post some of the hiccups I encountered, here, for reference should they be of interest to others working through the new branch:

### Geometry Column TypeError

If you try to create a GeoDataFrame with a column named geometry, you can run into trouble. I made an [issue](https://github.com/geopandas/geopandas/issues/602) on Github about this. 

{% highlight python %}
stl_gdf = gpd.GeoDataFrame(stl_df, geometry=stl_gs)
{% endhighlight %}

I convert the geometry column to Shapely objects like so:

{% highlight python %}
stl_geoms = [loads(s) for s in stl_df.geometry.values]
stl_gp_geoms = gpd.GeoSeries(stl_geoms)
{% endhighlight %}

I then attempt to create a GeoDataFrame in the cython branch of GeoPandas like so:

{% highlight python %}
stl_gdf = gpd.GeoDataFrame(stl_df, geometry=stl_gs)
{% endhighlight %}

In the main branch of GeoPandas, this would work. The geometry series provide via the kwarg would override the one existing in the stl_df (type string).

### Some Common Pandas Methods Do Not Work

Asking for the `.head()` of the GeoDataFrame results in a `TypeError` which likely is the result of a Pandas trying to interpret the geometry column. Either way, you’ll need to make sure to sub select out the geometry column if you want to use head.

Similar methods for printing information run into TypeErrors for the same reason as well. For the time being, it’s hard to visualize the geometry column data alongside the other non-geometry data as one is working (a common workflow pattern when, say, working in Notebooks). This is something actively being resolved and may not be an issue by the time you read this.


# Naive Comparison: Julia

I was curious how the Cythonized performance would stack up against a language with more rigoroud typing. For no reason other than curiosity in the Julia language, I thought it might be interesting to compare to it. Thanks to the LibGEOS library in Julia, GEOS bindings are possible through the language, similar to how Shapely works.

Reading in the table allowed me to extract all the WKT strings and create an array of geometries.

{% highlight julia %}
stl = readtable("stl.csv")

geometries = []

# Read table column w/ Geoms in and convert each WKT string
# to a geometry (using a 1000 long example dataset)
for (index, value) in enumerate(Array(stl[:geometry]))
    # Add it to the list of geometry objects
    push!(geometries,parseWKT(value))
end
{% endhighlight %}

With the resulting list, I created a simple nested for loop to mimic the operations necessary to calculate all distances from all geometries to all others in the array. The loop is shown, below:

{% highlight julia %}
# Have a nested for loop that pairs each geometry with
# all others in the list
for (index, g1) in enumerate(geometries)
    for (index, g2) in enumerate(geometries)
        # Calculate the distance then do something
        distance(g1,g2)
    end
end
{% endhighlight %}

With the results, I was able to observe an average performance time of 50-55 seconds. This appears to be slightly slower than the Cythonized Geopandas. I concede that, due to my limited familiarity with Julia, it is quite likely that I incorrectly designed the operation and I could have done more to specify the type of the geometry array so as to enable the compiler to vectorize that operation correctly (assuming it was not). If anyone reading this has familiarity with Julia, I would be curious to hear their input.

# Final Thoughts

This is just my first evening really diving into the latest with Cythonized Geopandas, so hope these notes were of interest. They may not be relevant in a few weeks, so there’s that as well. The commit I was working off of was `ff3677c`. Thanks again to [Matt Rocklin](https://twitter.com/mrocklin/status/883068637313212416) and [Joris](https://twitter.com/jorisvdbossche) for all their work this year on Geopandas.
