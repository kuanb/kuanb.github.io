---
published: true
title: Synthesizing Multiple Route Trace Point Clouds
layout: post
summary: Merging multiple trip traces to impute a single route spline
comments: true
---

In the following post I describe a quick and dirty method for taking the traces from multiple trips and imputing a likely spline from the point cloud. The advantage of this method is that no order is needed for the original trace points. This means that we can combine multiple trips together that ran along the same route, as well as include trips that did not run the entire segment of the other trips.

## Example use case

What would be a use case for this? Say you are mapping transit routes and you have volunteers performing the tracing using cell phones. They may not all ride the trip at the same time, nor may they all ride the same trip from start to finish. Furthermore, some may ride it one way and some another. Typically, it would be difficult to combine these trips and try to impute a single route from them.

With the method I outline, one can combine all available traces related to a given route and then merge the point clouds together. From the combined point cloud a single LineString object is returned. With this object, we can then easily convert the shape to GeoJSON and either submit it as-is or run it through a map matching service like Mapzen’s [Flex API](https://mapzen.com/products/map-matching/). This will snap the route to existing OpenStreetMap (OSM) paths. Also, we can take the resulting LineString information and pin nodes to it to generate standardized GTFS data. This is important for creating stating schedule feeds as a core requirement of GTFS is a reference route path.

## Running through the process

![trace_example](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/triangulate-spine/trace_example.png)

Let's start with an example spread of data. In this example, notice that there is a clear path for the data but there is scattershot accuracy. The above image features a zoomed-in segment of one leg of the total combined traces. A clear direction and trajectory is visible from the unsorted point cloud of data, by looking at it visually. A bounds has been drawn around the data and we can see that, although it is a multipolygon, it roughly follows the path of an (as of yet not determined) spine.

First, merge all points from all traces into a single array composed of Shapely Points objects. Buffer these according to the resolution of the GPS signal as observed (e.g. 50 meter accuracy so buffer all points by 50 meters).

![blob](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/triangulate-spine/blob.png)

Once buffered, we should be able to unary union the result to a single blog like shape, as in the above example image.

![simple_triangulate](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/triangulate-spine/simple_triangulate.png)

We can use Shapely’s built in triangulate method to create triangle planes between all existing vertices from the polygon’s coordinates. If you want to more about triangulation, check out my [previous post](http://kuanbutts.com/2017/08/17/delaunay-triangulation/) on constrained vertices and Delaunay triangulation methods. The script would be as follows:

{% highlight python %}
from shapely.geometry import MultiPolygon
from shapely.ops import triangulate

triangles = MultiPolygon(triangulate(shape, tolerance=0.0))
{% endhighlight %}

Now let’s drop all triangles that fall outside of the bounds of the original, parent shape.

![constrained_triangulate](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/triangulate-spine/constrained_triangulate.png)

The result, as seen above, is fairly straightforward and is created via the following:

{% highlight python %}
tri_cleaned = []

# only preserve the triangles that are within the bounds
# of the parent shape
for poly in triangles:
    if poly.centroid.intersects(shape):
        tri_cleaned.append(poly)
{% endhighlight %}

![vertices_w_points](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/triangulate-spine/vertices_w_points.png)

Now comes the fun part. We need to break this shape down into its component vertices and extract the midpoints of only those that are not along the edges/exterior of the shape. The result, plotted, should look like the above. Below, a script hashes out a quick way to accomplish this:

{% highlight python %}
from shapely.geometry import Point, LineString

lines_and_points = []
just_points = []

# used as reference
shape_buff = shape.exterior.buffer(.1)

# extract the midpoints of all triangles in the triangulated point
# cloud shape that do not reside on the geometry exterior
for tri in tri_cleaned:
    ext = tri.exterior.coords
    for start, fini in zip(ext[:-1], ext[1:]):
        lines_and_points.append(LineString([start, fini]))

    for start, fini in zip(ext[:-1], ext[1:]):
        pt_0 = start[0] + ((fini[0] - start[0])/2)
        pt_1 = start[1] + ((fini[1] - start[1])/2)

        new_pt = Point([pt_0, pt_1])
        new_pt_buff = new_pt.buffer(.05)

        
        if not new_pt.intersects(shape_buff):
            lines_and_points.append(new_pt_buff)
            just_points.append(new_pt)
{% endhighlight %}

![just_points](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/triangulate-spine/just_points.png)

Great, now we have all the points that we need to work with. As you can see in the above image, these points roughly make the “spine” of the geometry. They are in no particular order, though.

![out_of_order](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/triangulate-spine/out_of_order.png)

We can see how out of order they are by plotting them as a LineString, as in the above. Naturally, the triangulation method creates no “start to finish” order, so we must infer one. Because we have a structured point cloud now, though, where each point roughly correlates with one point along the spine of the geometry, we only need two pieces of information to be able to infer the order of the line.

First, we need the start point and then we need the end point. We can get these from any trip that has both of them. In our case, so long as one rider has done the whole trip we can do this by pulling that rider’s first and last points. We can select the longest route of all “complete” rides in order to access these reference start and end points.

Once we have them, getting the start and end points is merely a matter of getting the nearest point in the midpoint vertices point cloud to each of them.

![sorted](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/triangulate-spine/sorted.png)

Once we have them, we can iterate through the remaining midpoint points, finding each subsequent closest point from the start point, until we reach the end point. Doing so will create a sorted line for us, as we can see in the above image.

We can see the process for achieving that in the below script:

{% highlight python %}
remaining = copy.copy(just_points)
sorted_pts = [start_pt]

reached_end_pt = False

while not reached_end_pt:
    current = sorted_pts[-1]
    nearest = None
    dist = 10000
    for pr in remaining:
        d = pr.distance(current)
        if d < dist:
            nearest = pr
            dist = d
    
    sorted_pts.append(nearest)
    remaining.remove(nearest)
    
    # check if this is the same as the end pt
    if list(nearest.coords) == list(end_pt.coords):
        reached_end_pt = True
{% endhighlight %}

## Closing discussion

This is by no means the most refined method of inferring a point cloud spline but it’s fast and dirty. With additional tools like Mapzen’s map matching tools, this method will get you “close enough” so that the final refinement against OSM path network data is possible. It will also leverage the advantages that multiple crowd-sourced pass throughs of a given route affords. That is, we can normalize against noise and discrepancies on multiple rides. Ends of rides may still be a little awkward so some further refinement may be necessary to handle the “hooks” that can occur (as seen in the above example). That said, map-matching typically handles such issues sufficiently to produce useful final shapefiles, which can be used as reference route shapes for any downstream analysis or scheduling, such as in creating a GTFS schedule.

{% highlight python %}
from geojson import LineString as gj_LineString
gj_LineString(list(LineString(sorted_pts).coords))

# returns
# {"coordinates": [[-1.021728515625, -54.92412823402425],
# [-1.021728515625,
# …
# -47.9291803556701],
# [12.06298828125, -47.96627422845168]], 
# "type": "LineString"}
{% endhighlight %}

For reference, here's a notebook of the steps taken in the above blog post: [Gist](https://gist.github.com/kuanb/e98e03f1aa8e0c2730051557ab1f0d12).
