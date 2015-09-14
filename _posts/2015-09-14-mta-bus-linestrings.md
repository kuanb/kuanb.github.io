---
published: true
title: Obtaining and drawing clean MTA bus lines
layout: post
summary: Brief comments on inconsistencies in the MTA's GPS output for buses
---

Recently, I’ve been looking into what I’ll call “non-explicit” data resources. By that, I mean that there is a lot of data out there that is not cleaned and prepared for a specific purpose, although it might be tangentially relevant. Thus, some labor must be invested to access the relevant aspect of this data. An example of this are traffic cameras. As I was floating around NYC’s data offerings, I came across the NYCDOT traffic camera page. Through this page, one can easily acquire a list of url endpoints for each camera feed and limited metadata, including latitude, longitude, and a name indicating the approximate location or intersection at which the camera has been placed. Here’s an example of a JSON representing the data for a single camera (a list of all of them is on this [GH Gist](https://gist.github.com/kuanb/dbe19ce4e8ef317ee3fc)):



This is intended to just be a brief post regarding the quality of the data being produced from the MTA’s live feed of bus locations. While working with the data, I have encountered some issues with regards to the consistency of the bread crumbs (the last uploaded location of the vehicle).

Specifically, it seems that, occasionally, there are “dead” periods during which no data is uploaded to the vehicle. Furthermore, assembling a complete trip does not seem to be an easy task. Currently, I am running SQL queries against Nathan9’s (see his Github here) closed database where he has been accumulating MTA’s live data feed for some time. With this data set, I had hoped to easily produce shapes of each bus line.

Before we continue, some brief background, though. In 2010, I believe it was, the MTA released some GIS data regarding their system. This included a shapefile of all known bus locations. While useful (along with having been updated at least once in the intervening years), it has never been paired with a shapefile of the bus routes themselves. (If I am somehow wrong about this, please contact me immediately as I would love to know where that resource is - as of yet, it appears to not exist). As a result of this limitation, I set about creating the shapes myself.

My goal in doing so is for a tool I will hopefully write a blog post about later. In general, though, the desire is to include a GeoJSON of a detailed path of both directions of any selected bus route. Here’s a quick screen grab of the current interface to get an idea of what is going on:

![goal](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/mta-bus-linestrings/goal.png)

In red is shown the resulting GeoJSON of the M60 route from LaGuardia to Harlem and Columbia University. In the below image, I have an enhanced screen capture of a segment of the route. In this enhanced segment you can see where a fracture has occurred. Throughout the route, it appears that similar situations occur. These breaks appear to correlate with a column value from the MTA called `shape_pt_sequence`. This shape point ID appears to be incremental and indicates subsequent breadcrumbs.

![break](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/mta-bus-linestrings/break.png)

The problem is, often, these are only a dozen or so “breadcrumbs” long. In the example of the M60+ route, the lowest valued integer for this column is 10001, with subsequent rows incrementing to a mere 10014 before “leaping” to 20000. There is a second column that I thought would also be of assistance (titled `trip_index`). Attempting to utilize this column was equally as futile as results from plotting just a single `trip_index` resulted in only sections of the route being drawn. That is, `trip_index` apparently could not be relied on to produce a single complete trip in either direction. Unfortunately, I have not been able to find documentation on the relationship between these two column values either, though I am in the process of reaching out to other individuals who have had some experience working with these values as well.

As a result, I’ve found it necessary to ignore both of these columns and set about attempting to concat all the resulting values locational values through some quick, on-the-fly logic. The general thought was that the `shape_pt_sequence` values were just enough to determine order and, once those were ordered, so long as the following `shape_pt_sequence` spatial point was not greater than an arbitrary distance (I am currently employing 500 meters via a quick and dirty distance algorithm [adapted from this blog post](http://www.movable-type.co.uk/scripts/latlong.html#equirectangular)), then it was added to the “current” line to be drawn.

This avoided the problem that occurred when simply trying to line up all the subsequent `shape_pt_sequence` points in a row (or array). Specifically, the subsequent uploads are not organized along the route of the route. The difficulty that results here is that each segment can’t be automatically connected to the following. Doing so results in a zig zag of random connecting vectors, worsening the legibility of the output (see the below image for an example).

![zig](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/mta-bus-linestrings/zig.png)

As a result, I’ve created a temporary solution that involves basically clumps what seem like a logical set of points that are each near the prior into single GeoJSON LineString features and am able to plot the results with a desired, legible effect. An example output is shown below. Also, the code can be viewed under this [GH repo](https://github.com/kuanb/nyc-bus/blob/master/app.js) at the `app.post` for the `'/sql/route'` endpoint.

![clean](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/mta-bus-linestrings/clean.png)
