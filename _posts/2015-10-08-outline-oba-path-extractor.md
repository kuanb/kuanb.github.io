---
published: true
title: MTA bus line route shapefiles
layout: post
summary: Update on oba-path-extractor completion
---


In yesterday's post, I wrote about using the One Bus Away (OBA) utility toolkit - specifically the `decodePolyline` function to handle translation of MTA's Bustime `api/search/` tool outputs from encoded strings to lat/lng arrays. I've since then completed the tool and the result is hosted on Github [here](https://github.com/Bus-Data-NYC/oba-path-extractor) under the [Bus Data Working Group](https://github.com/Bus-Data-NYC). This is part of work I have been doing with Nathan and Zak at [BetaNYC](http://betanyc.us/) on Wednesday nights at [Civic Hall](http://civichall.org/) in Midtown.

Feel free to jump to yesterday's post to learn more about the MTA API feed via `search`. All I want to accomplish with this blog post is to point to the completed tool which is hosted at the aforementioned [repo](https://github.com/Bus-Data-NYC/oba-path-extractor). The `README.md` should be pretty self-explanatory but, just in case, here's an outline of what's there:

If you don't care about actually generating the shapefiles yourself, I went ahead and uploaded them to the repo, as well. Go straight ahead to the geojsons/ folder. Inside, each bus route is a folder, within which the inbound and outbound directions are placed as featureCollection geojsons. Github has a nice feature that allows you to visually preview each shapefile so you can check them out by clicking within each folder and just watching it load the shape and plop it on the map.

If you want to "DIY" and have an interest in doing more with the content that is returned, then go ahead and clone the repo and run it locally. Use `node server.js` and wait until you are alerted that the app is up and running. Open a browser and use the following endpoints to run specific queries:

- If you just want one bus route: http://localhost:8080/route/*** where *** is the route id.
- If you want all the bus routes: http://localhost:8080/route will return the complete results.

The shapefiles will automatically be saved to the folder structure on the latter method. The browser will receive a data blob that includes those shapefiles, as well as a bunch of other meta data that might be useful. Feel free to update the tool as you see fit - it's intended to be super rudimentary.
