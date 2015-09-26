---
published: true
title: Crawling MTA bus traces
layout: post
summary: Creating a method for inferring bus routes from unsorted geospatial data
---

Note: This article in progress... Part 1 has been uploaded below.

I've been trying to create a tool that can receive an unsorted mess of data and infer a route from it. The use case is when receiving an array of GPS coordinates from a vehicle retracing a route multiple times. I want to be able to essentially merge a number of trip together. I want to also be able to handle the fact that some trip may not be the complete route while other are. In such an instance, I want to require as little data as possible. As a result, I want to ignore all parameters other than latitude and longitude.

With this array of points, I want to prune duplicate or too-near points (points within 5 meters of another point, I've arbitrarily chosen) and resort the following points to create a path. I want that path to be the "most-likely" correct path. That is, I want the points to form a path that is not erratic, and handles "turns" (rounding corners, that is), without getting confused. Thus, there needs to be the logic to handle such turns and to follow a path that leads up to and around a turn correctly. Because there is no structure to the array as it is initially presented the list of spatial points can be arranged in any order. The tool should be able to reorganize the routes successfully and consistently. 

![busvizexample](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/unsorted-bus-route/busvizexample.png)

What is the purpose of creating this tool? The MTA, in New York City, publishes bus data in GTFS format. In the "Shapes" file that comes in a standard GTFS format, there are multiple shapes associated with a single bus line. From what I can tell, each shape appears to be related to one route the bus has taken. On a great site that is a NYU CUSP project, [BusVis](http://busvis.org/) (shown in the above screen capture), if you look on the right hand side there is, highlighted in orange, a button named BX190093 that is selected. Next to it is a label indicating the value "93%." This project, which was performed by students and a professor at CUSP has precalculated the frequency by which each shapefile (each button) is referenced in the live GTFS data feed. In this example, BX190093 corresponds with a majority of all the trips. Along other routes, though, distributions have been far more dispersed.

![unsortedInit](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/unsorted-bus-route/unsortedInit.png)

As a result, it is desirable to combine all these and create one "final" route that is a combination of all the variations that are included. Because of the way that trips are published from other sources, both in public transit and otherwise, such a tool might prove useful in other cases, as well. In the following example, I will take a sample of 10,000 GPS trace points from preserver MTA GTFS live feed data for the M101 line in Manhattan and try to infer the bus route without using any information from the specific points other than the latitude and the longitude. In the above image, you can see what the unsorted data looks like if plotted as a GeoJSON `lineString` in Leaflet.





