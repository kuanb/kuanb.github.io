---
published: true
title: Initial foray into CitySDK
layout: post
summary: Creating simple client side interface that interacts with JSON API of PIF tool CitySDK
---


I wanted to explore the [CitySDK](http://uscensusbureau.github.io/citysdk/guides/censusModule/queryBuilder.html) Census Module Query interface. When this first came out roughly a year ago I thought it had potential but had not yet been built out. Since then, it appears some solid strides have been made. The post powerful aspect, conceptually, of this tool is that a single API interface and structure can become interoperable between any comparable urban/civic structure in the country. For example, the same tool built for Las Vegas might work "instanataneously" for Detroit. 

![screencap](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/city-sdk-foray/tool-screen.png)

To explore [this tool](http://kuanbutts.com/slc_stats/) and allow non-technical users to explore the potential of the tool as well, I decided to throw together [a simple GH-Page](http://kuanbutts.com/slc_stats/) site that allows users to explore the roughly 123 variables that are provided through the tool. Also, one common process that folks perform in GIS, for example, is to observe the relationship between 2 variables. I wrote a simple function that allows users to explore the relationship between any 2 variables by either multiplying, adding, dividing (most common, probably, for ratios), or take something to the `n`th variable of another. Again, this is just a preliminary tooling around with the API.

![screencap-nyc](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/city-sdk-foray/nyc.png)

Since the API allows this [tool](http://kuanbutts.com/slc_stats/) to become "automatically" interoperable in any city in the country, you can quickly readjust to where the tool queries for by simply submitting a different latitude/longitude in the URL. For example, in the above image, if you look at the URL, I have just included the lat/lng pairing for New York City. If you are having trouble figuring out what your city lat/lng is, just type in the name of the city into Google and add the phrase "lat lng" to the end of the search query. See the screen captured example below.

![googlesearch](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/city-sdk-foray/googlesearch.png)

In the above example, the URL parameters is created by entering `/lat=12.34,-23.45`. I don't know why I chose `lat` as the parameter name. Using `loc`, for example makes more sense. For continuity's sake, I am going to support. So, to reiterate, indicating the parameters by either `/lat=12.34,-23.45`, for example, or `/loc=12.34,-23.45`, for example, is totally fine.

Also make sure that your longitudinal value is negative when you enter it into the URL. Since longitude is stated as "W" for "West", it is "negative" of the Prime Meridian. I should note that I absolutely do not guarantee this will work completely for other cities, but it does appear to from the litle I have explored. Because Salt Lack County is a, well, county, there is a possibility that the queries I have built may not be compeltely transferable. That said, I have made an effort to make it "ubiquitous." If there are observed break points, please list them in the [project issues page on the tool's repository](https://github.com/kuanb/slc_stats/issues).



