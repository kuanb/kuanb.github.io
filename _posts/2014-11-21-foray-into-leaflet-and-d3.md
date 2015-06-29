---
layout:     post
title:      Initial foray into Leaflet with D3
date:       2014-11-21 12:31:19
summary:    Creating a Voronoi diagram with CitiBike station information
categories: 
---

_Warning: This is a really old blog post. I am including it just for posterity, and in the interest of just keeping all my old writing from my "earlier" days._

I'm trying to make a voronoi diagram. Just to get going, I used Citi Bike's station data (they have 332 stations and I just took the live JSON feed to get each of their locations, by parsing through the data with d3's `d3.json()` capability. Currently, I am failing and getting very far into this project. I've got it working in a static instance, but I can't get it to dynamically update. I want to figure that out by the end of the day, ideally. To keep the map from freaking out, I have disabled all panning and zoom functionality in the below example. (Update: I just replaced it with an image for now, since there is no point in using the map generation at the moment, given the panning doesn't work.)

![voronoi](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/images/_posts/citibike_station_voronoi.png)

At present, the map, as you can see, produces the diagram correctly in a static state. I've understood (learned) how SVG sort of injects itself inside of a layer that Leaflet creates that sits just above the maps layer. Now I need for it to dynamically grab the L.circle objects that are locating the Citi Bike stations and recalculate their new x and y coordinates each time the map is moved. There is this code, that was on a few other Leaflet projects `map.on('load moveend', revise())` that unforuntately keeps returning a type error to me. Clearly, this is no good and is next on my to-debug list. At the moment though, I am going to need to switch gears and revisit this later in the evening.