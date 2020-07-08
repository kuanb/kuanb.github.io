---
published: true
title: Slicing polygons with linestrings
layout: post
summary: Adapting split strategies from Shapely to TurfJS
comments: true
---

<source src="https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/divide_poly_by_line/site.mp4" type="video/mp4">

## Introduction

I recently wanted to explore if it was possible to divide a polygon into two parts by slicing it with a line. My initial exploration involved triangulating the polygon based on all intersecting points on the polygon exterior with the line string and then re-assembling from there.

<blockquote class="twitter-tweet"><p lang="en" dir="ltr">Wanted to split a polygon by a linestring and noticed that there&#39;s no &quot;out of the box&quot; method w/ shapely/turf/other popular libs. Ended up going down a rabbit hole but got it to work w/ triangulation of the polygon - surprisingly tricky! <a href="https://t.co/xGTVcSYWNu">pic.twitter.com/xGTVcSYWNu</a></p>&mdash; Kuan Butts (@buttsmeister) <a href="https://twitter.com/buttsmeister/status/1266663137102622721?ref_src=twsrc%5Etfw">May 30, 2020</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

Above: My tweet in which I first put out the concept.

In response to this proposal, a Twitter user pointed out that Shapely in fact already has a method called `split()` and that it supports splitting a polygon with a line string.

<blockquote class="twitter-tweet"><p lang="en" dir="ltr">Oh wow that&#39;s embarrassing! Thanks for pointing that out. For some reason, I&#39;d always been under the impression it did (multi)linestrings split by points, but not polygons. 😐 <a href="https://t.co/nUTIiCkNpi">pic.twitter.com/nUTIiCkNpi</a></p>&mdash; Kuan Butts (@buttsmeister) <a href="https://twitter.com/buttsmeister/status/1267127906330763266?ref_src=twsrc%5Etfw">May 31, 2020</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

Above: A Twitter user pointing out the `split()` functionality that is available in Shapely now.


## How Shapely cuts polygons

Shapely achieves the slicing by employing a method called polygonize. You can see the source code [here](https://github.com/Toblerity/Shapely/blob/97fc2c79ad57954035be1d89864efb6b9122fcf0/shapely/ops.py#L32-L55). This method takes a multiline string and creates polygons from each of the shapes. This is similar to my triangle method, but less prone to error since the triangles I was generating needed to be trimmed and fit back against the original polygon.

For shapely, the steps for split in this case were as follows:
- Take the polygon and get the exterior boundary of it as a line
- Take the slice line and the polygon exterior and union the two together (this will catch all those intersecting points)
- Use the polgyonize method to create polygons from the negative space in the union-ed lines
- Iterate through all the resulting polygons and keep only the ones that have a point inside the original polygon

We can see those steps employed in the `_split_polygon_with_line` method [here](https://github.com/Toblerity/Shapely/blob/97fc2c79ad57954035be1d89864efb6b9122fcf0/shapely/ops.py#L389-L405).

Or, we can re-write it ourselves using the underlying polygonize method like so:

{% highlight python %}
from shapely.geometry import LineString, MultiPolygon, Polygon, Point
from shapely.ops import polygonize

# make a complex geometry
input_p = Polygon([[8.80228042602539,60.34198591102353], ... [8.80228042602539,60.34198591102353]])

# and a complex intersecting line
input_l = LineString([[8.784770965576172,60.33535977571523], ...[8.82150650024414,60.3352748165263]])

# union the exterior lines of the polygon with the dividing linestring
unioned = input_p.boundary.union(input_l)

# use polygonize geos operator and filter out poygons ouside of origina input polygon
keep_polys = [poly for poly in polygonize(unioned) if poly.representative_point().within(input_p)]

# remaining polygons are the split polys of original shape
MultiPolygon(keep_polys)
{% endhighlight %}

Visualizing the result should look something like the following image:

![shapely_version](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/divide_poly_by_line/shapely_version.png)

## Bringing this functionality over to TurfJS

So I thought it would be great to have this in TurfJS especially because TurfJS can be used in conjunction with [MapboxGL Draw](https://github.com/mapbox/mapbox-gl-draw) to allow for interactive "slicing" of a polygon.

I created a very coarse example of how this would be accomplished and integrated with Draw into an interactive experience and posted it as a Gist [here](https://gist.github.com/kuanb/0cd97a02ea4aefff85f20fb0475d3ec4).

[Here] is a video of the simple example page being used, as I posted on Twitter:

<blockquote class="twitter-tweet"><p lang="en" dir="ltr">Looks like the union -&gt; polygonize pattern used in Shapely&#39;s split() operator can be re-assembled in <a href="https://twitter.com/turfjs?ref_src=twsrc%5Etfw">@turfjs</a> as well. Slapped this together as a PoC:<a href="https://t.co/PTMFx964y7">https://t.co/PTMFx964y7</a> <a href="https://t.co/JUPjgLlWao">pic.twitter.com/JUPjgLlWao</a></p>&mdash; Kuan Butts (@buttsmeister) <a href="https://twitter.com/buttsmeister/status/1280042922440712193?ref_src=twsrc%5Etfw">July 6, 2020</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

The logic followed parallels that used in Shapely. Although TurfJS does not have a `split()` method available in the same way that Shapely does, it does have the ability to execute each step:
- convert a polygon to a line with `turf.polygonToLine`
- union the dividing line and the polygon exterior with `union`
- run `polygonize` on the unioned lines (just like in Shapely, although the TurfJS docs do not make that immediately clear)
- filter polygons that do not have a point within the polygon with `turf.pointOnFeature` and `turf.booleanPointInPolygon`

We can see this logic [applied in the code](https://gist.github.com/kuanb/0cd97a02ea4aefff85f20fb0475d3ec4#file-index-html-L103-L116) as well as extracted and highlighted below:

{% highlight python %}
const polyAsLine = turf.polygonToLine(poly);
const unionedLines = turf.union(polyAsLine, line);
const polygonized = turf.polygonize(unionedLines);
const keepFromPolygonized = polygonized["features"].filter(ea => turf.booleanPointInPolygon(turf.pointOnFeature(ea), poly));
{% endhighlight %}

The result achieves the same ability to take a polygon and slice it with a line string provided. The upside is that now it can be done all on the client side, with TurfJS, and leverage the power of tools like MapboxGL Draw which allows the user to interactively "slice" a polygon.