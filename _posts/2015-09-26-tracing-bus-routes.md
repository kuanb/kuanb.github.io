---
published: true
title: Crawling MTA bus traces
layout: post
summary: Creating a method for inferring bus routes from unsorted geospatial data
---

I've been trying to create a tool that can receive an unsorted blob or "cloud" of latitude/longitude data and infer a route from it. The use case from which the development of this tool was inspired is the processing of an array of GPS coordinates from a vehicle retracing a route multiple times. Essentially, I want to be able to merge a number of trips together, handling the fact that some trips may not be the complete route while others are. In addition, although I have been working with MTA data in NYC, I want to require as little data as possible to make the tool adnostic in terms of who is providing the data. By relying solely on the latitudinal and longitudinal values, I hope to create a tool that can be easily incorporated into other toolkits and prcesses related to a variety of data sources, rather than tying to a specific provider's associated metadata that is published with their geospatial breadcrumbs.

With this array of points, I want to prune duplicate or too-near points (points within 5 meters of another point, I've arbitrarily chosen for the purposes of this exercise, though this is customizable naturally) and resort the following points to create a path. I want that path to be the "most-likely" correct path. That is, I want the points to form a path that is not erratic, and handles "turns" (rounding corners), without getting confused (and thus confoudning what would be a correct or reasonable order of points). Thus, there needs to be the logic in place to handle such twists and turns to follow a path that leads up to and around one correctly. Because there is no structure to the array as it is initially presented the list of spatial points can be arranged in any order. The tool should be able to reorganize the routes successfully and consistently. 

![busvizexample](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/unsorted-bus-route/busvizexample.png)

What is the purpose of creating this tool? The MTA, in New York City, publishes bus data in GTFS format (like many, many other municipal transit institions around the world). In the `shapes.txt` file that comes in a standard GTFS format, there is supposed to be just one shape file associated with a given route. In the case of the MTA's published data, there are multiple shapes associated with a single bus line. From what I can tell, each shape appears to be related to one route the bus has taken. On a great site that is an NYU CUSP project, [BusVis](http://busvis.org/) (shown in the above screen capture), if you look on the right hand side there is, highlighted in orange, a button named BX190093 that is selected. Next to it is a label indicating the value "93%." This project, which was performed by students and a professor at CUSP has precalculated the frequency by which each shapefile (each button) is referenced in the live GTFS data feed. In this example, BX190093 corresponds with a majority of all the trips. Along other routes, though, distributions have been far more dispersed. If you examine each of these shapes, they are often either nearly identical or represent fractions of the total route. As a result, it becomes overly complicated to simply get a de facto route line for any given bus route since there is no single route to reference.

At this point, I could have simply parsed through a either pulled out the most frequently used bus route shape from each route or I could have custom selected a shapefile to define each route myself. But, instead, I thought this was an opportunity to create a simple tool that could combine all the given routes and extract a one "final" route that is a combination of all the variations that are included. Because of the way that trips are published from other sources, both in public transit and otherwise, such a tool might prove useful in other cases, as well (or so I hope). In the following example, I will take a sample of 10,000 GPS trace points from preserved MTA GTFS live feed data for the M101 line in Manhattan and try to infer the bus route without using any information from the specific points other than the latitude and the longitude. 

![unsortedInit](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/unsorted-bus-route/unsortedInit.png)

In the above image, you can see what the base unsorted data looks like if plotted as a GeoJSON `lineString` in Leaflet. As you can see, two things are happening here. First, the northbound and southbound trips are being confused into a single line (there are roughly two parallel routes that can be inferred from that image). Secondly, there are multiple paths being overlayed on top of one another and thus the combined array that is the result of these multiple breadcrumbed trips is, in effect, disordered. Thus two things need to happen immediately. First, I created an object `sfToolkit` that includes class `shapefiler` and a series of utilities functions. The first utilities function I created was `splitDirections` which takes in the `raw_data` and looks for the given object key `direction_id` that corresponds with inbound and outbound trips. It returns two arrays, a `0` and a `1`, for whether the trip is inbound or outbound. This has been built as a utility as it is outside of the bounds of the basic latitude/longitude-only approach I have taken for the rest of my content. Upon receiving this cleaned/sorted directional data, all the end user ought to need to do is create a `new sfToolkit.shapefiler` instance and ask for the cleaned data (given specific option parameters), as in the following code example.

{% highlight javascript %}
var parts = sfToolkit.splitDirections(path, 'direction_id'),
    options = {
      shuffle: true,
    };

var sf = new sfToolkit.shapefiler(parts[0], options);
return sf.getCleaned();
{% endhighlight %}

If you're uninterested in the mechanics of how we arrive at the cleaned array, this is a great place to stop. If you are curious as to how I arrived at the mechanics present in the tool, then please read ahead! Also, please note that this is definitely a work in progress and I will be actively updating this project in the days and weeks ahead. I also am well aware that I may have failed to account for certain route conditions and there are cases where this current tool might fail to produce useful results. If you have any thoughts on how to improve the tool, please do not hesitate to either contact me (in the section of my site that has the contact submission tool) or participate with me on the project on [Github](https://github.com/Bus-Data-NYC/path-creator).

![zigShort](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/unsorted-bus-route/zigShort.png)

Why not just iterate through this list and find the point closest to the prior closest point? Doing so, without any sort of control, will result in sort of "crazy" results. In the above pictured example, the algorthm happened to grab a point in the middle of the route and "grew" the path from there. As you can see, a sort of bizarre zig sag resulted, as the algorthm sought a following closest shape. My first thought to resolve this was to simply find the farthest point and then, from there, simply run a nested `for` loop through the remaining array values and keep appending the point that ends up being closest to the prior point. Not only is this method slow, it is unintelligent. I've preserved it in the class for those interested in comparing the results of that method versus the employed one. 

![gifFail](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/unsorted-bus-route/gifFail.gif)

Not only is the method slow because it loops doubly on itself, it also fails to account for order (whether the closest point to the point being evaluated comes before or after the point being evaluated). Failing to account for order was particularly noticeable when handling corners. In the above `.gif`, lines are drawn following each points addition, drawn from the point prior. As you can see, corners failed to sort correctly. The result of such disrder would be the appearance of "zig zags" on the corners, where points would be in disarray. In order to handle the issue of failing to account for the order where the closest point might lie, a simple checker was introduced. I include it below to provide contrast for the increased complexity of such a measure in the later iteration of this sorting mechanism.

{% highlight javascript %}
var prior = order[order.length - 2];
if (prior !== undefined) {

  // B = before, E = each, L = last
  var distBE = calcDist(each.lat, each.lng, prior.lat, prior.lng),
      distEL = calcDist(each.lat, each.lng, last.lat, last.lng),
      distBL = calcDist(prior.lat, prior.lng, last.lat, last.lng),

      dist_bef = distBE + distEL,
      dist_aft = distBL + distEL;
  if (dist_bef < dist_aft) {
    placeAfter.before = true;
  } else {
    placeAfter.before = false;
  }
} else {
  placeAfter.before = false;
}
{% endhighlight %}

As should hopefully be explicit, this simply creates a checker to when a new closest point is found and determines if there is the possibility that the point is better suited to be before the last most point currently in the ordered list. It does this by summing the distances between the second to last and last point, as well as the point currently being evaluated when in both order sets. It then uses the variant with the shorter overall distance to dictate whether the resulting/final placement should be before or after the last most point in the current ordered list.

What was most concerning, ultimately, with this `dumbReorder` method is the speed with which this method completed the task. Parsing roughly half of the ~5,000 data points (half of the 10,000 MTA data points and thus account for one single direction on the route) at a sensitivity of 5 meters (dropping all points that lay within 5 meters of a prior point) takes 26,892 milliseconds, or roughly 27 seconds. This is unacceptably long. The following method attempts to both improve upon the `dumbReorder` method's weakness for handling edge cases particularly around corners while speeding up the process of generating a result. As of publication, the following method has managed to achieve substantial reductions in both speed (time it takes to calculate the results), and accuracy. Currently, the turnaround is pegged at 4,411 milliseconds, or roughly 83.5% reduction in performance time.

![unsortedInit](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/unsorted-bus-route/unsortedInit.png)








