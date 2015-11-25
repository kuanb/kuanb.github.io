---
published: true
title: Calculating distance along route
layout: post
summary: Acquiring bus stop distance from route start by leveraging route shapefiles
---


I recently have been trying to calculate the distance along the route that each stop along a bus route is at in New York. Simple enough, I had assumed. First, one would query for the stop, then acquire the corresponding shape (via shape_id) and run the haversine formula a couple times and voila, it would be complete. Unfortunately, that's not what happened. Before I continue, I will explain how my code originally worked.

<iframe src="http://bus-data-nyc.github.io/shape-with-stops/testing/" frameborder="0" width="100%" height="625" allowfullscreen="true" mozallowfullscreen="true" webkitallowfullscreen="true"></iframe>

Shown in the above animation (click the run button to run it), is a visualization showing the strategy I employ in identifying the distance for a given stop. In the full implementation, I loop through an entire array of stops that are paired with a given shape but, in this situation, I focus on just two markers, which are the stops, and a small segment of the larger route. The purpose for this, of course, is just demonstration so, if you look at the code for the animated components in the `iframe`, you'll see a lot of potential for edge cases that are not controlled against. Thus, please ignore the code used in the iframe as its intent was purely as demonstration and to get an animation up and running quickly. The pull code for the actual tool is held in [this Github repository](https://github.com/Bus-Data-NYC/shape-with-stops/). 

If you hit the "(re)RUN OPS" button in the iframe, you will see that it targets first one stop (blue marker), then the next. Clicking on a marker will bring up a pop up with some key metadata that is included with each stop object, in addition to its geospatial location. These are its sequence (integer) and its distance along the route as calculated in using the tool I was building. As you can see stop #10 is set at 1,930 meters while stop #11 is set at 1836 meters. This is incorrect. Since stop #11 comes after stop #10, it should be greater than stop #10. Furthermore, if you click on a red circle (which represents point locations included in the shapefile), a pop up will tell you the index of that point within the shapefile as well as the cumulative distance of the shapefile from the start up to that point. The way this is calculated is using the haversine formula on each segment, summing each segment up so that a point represents the distance from itself to the prior point in the shapefile, plus that prior points distance to the point that preceeds it, and so on. Again, if you look at the stops near and just before where stop #11 is, you will see the cumulative distance at that point is 2,085 meters. Yet, if you click on stop #11, you will see that, again, the distance to that stop is 1,836 meters. Clearly, something is broken.

{% highlight javascript %}
function hvrsn (ll1, ll2) {
  var dlat = ll2[0] - ll1[0],
    dlon = ll2[1] - ll1[1],
    erad = 6369087,
    alpha = dlat/2,
    beta = dlon/2,

    a = Math.sin(deg2rad(alpha)) * 
        Math.sin(deg2rad(alpha)) + 
        Math.cos(deg2rad(ll1[0])) * 
        Math.cos(deg2rad(ll2[0])) * 
        Math.sin(deg2rad(beta)) * 
        Math.sin(deg2rad(beta)),
    c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)),
    dist =  erad * c;
  return Number(dist.toFixed(6));
};

function deg2rad (d) {
  return (d * (Math.PI/180));
};
{% endhighlight %}
Shown above is my implementation of the haversine formula in JS for the embedded iframe. Note: The radius of the Earth at 40.7 degrees latitude is 6369087 meters. Depending on the form you're using, you might instead need the length of one degree of latitude at 40.7 degrees, which is 111048 meters.

{% highlight python %}
def haversine(pt1, pt2):
  # unpack latitude/longitude
  lat1, lng1 = pt1
  lat2, lng2 = pt2

  if lat1 == lat2 and lng1 == lng2:
    return float(0)
  else:
    # convert all latitudes/longitudes from decimal degrees to radians
    lat1, lng1, lat2, lng2 = map(radians, (lat1, lng1, lat2, lng2))
    lat = float(lat2) - float(lat1)
    lng = float(lng2) - float(lng1)
    d = sin(lat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(lng / 2) ** 2
    h = 2 * 6369087 * asin(sqrt(d))
    return round(h, 2)
{% endhighlight %}
Again, the haversine formula, this time from my implementation in Python.

In the iframe example visualization, the animation should loop through the segment of the route we are lookint at and, for every point, draw a "triangle" from that first shapefile point to the stop to the next shapefile point. Thus two lines will be drawn. If the sum of those 2 lines is the current shortest distance for the route, it is green, if it is not, it is red. If a shorter 2 line combination is found, that one becomes highlighted in green and the prior shortest is removed.

When the segment is completed, the shortest distance is then evaluated to find the distance from the first point (the point prior to the stop) to the stop itself. This is then added togetehr with that shapefile points cumulative distance value. The result is the "dumb distance measure" that is shown in the upper right modal. This process is repeated for both stop markers, #10 and #11. The "smart distance measure" is calculated with a second method. Instead of finding the distance from the stop to the last point, we try to instead find the point along the shapefile that is perpendicular to the location of the stop. Then, from this new point, we use the haversine formula to determine the distance from that point to the last shapefile point. This new distance is then added to the cumulative distance at that last shapefile point. That new distance is the more accurate distance along the route. I call this new distance calculated `bestDistance_smart` in the embedded iframe's code. The function that calculates it is called like so: `hvrsn(getAllignedStop(ptB, st, ptA), st) + Number(chosen[mrkr].pt.from.properties.d)`. 

`getAllignedStop()` returns a `[latitude, longitude]` list that can then be submitted to the haversine formula as the new point to calculate distance to the last identified shapefile point. The corresponding code is included, below. The function essentially uses the SSS formula to calculate the internal angles of the triangle created between the points of the stop and the two shapefile points. It then creates a right triangle based off of those points, allowing for a line to be drawn from the stop perpendicular to the line connecting the first and second shapefile points. From this, a ratio can be acquired from the length from that intersection point and the first shapefile point compared against the total distance between the two shapefile points. This ratio can then be used on the latitude and longitude to determine the point that is proportionally between those two latitude and longitude points from the shapefile. This ignores the curve of the earth for the difference between the two points, which I have deemed acceptable given the distance between the two shapefile points is at most every a few dozen meters and usually far less.

{% highlight javascript %}
function getAllignedStop (ptB, st, ptA) {
  var sb = hvrsn(st, ptB),
      ba = hvrsn(ptB, ptA),
      as = hvrsn(ptA, st);

  if (ba == 0) {
    return ptA;
  } else {
    var angle = {
          a: Math.acos(((as * as) + (ba * ba) - (sb * sb)) / (2 * ba * as)),
          s: Math.acos(((as * as) + (sb * sb) - (ba * ba)) / (2 * sb * as)),
          b: Math.acos(((sb * sb) + (ba * ba) - (as * as)) / (2 * ba * sb))
        };

    if (angle.a >= 90 || angle.b >= 90)
      return null;

    angle['s1'] = 90 - angle.b;
    angle['s2'] = 90 - angle.a;

    var v = Math.cos(angle.s2) * as,

        p1 = Math.tan(angle.s1) * v,
        p2 = Math.tan(angle.s2) * v,

        crnr = [ptA[0], ptB[1]],
        genh = hvrsn(ptB, crnr),
        genw = hvrsn(crnr, ptA);

    var vecAng, latrat, lonrat;
    if (genh == 0 && genw !== 0)
      vecAng = Math.asin(genw/ba);
    else if (genh !== 0 && genw == 0)
      vecAng = Math.asin(genh/ba);
    else
      return ptA;

    var delh = Math.sin(vecAng) * p2,
        delw = Math.cos(vecAng) * p2;

    var latrat, lonrat;
    if (genh == 0 && genw !== 0) {
      latrat = 0;
      lonrat = 1;
    }
    else if (genh !== 0 && genw == 0) {
      latrat = 1;
      lonrat = 0;
    }
    else {
      latrat = delh / genh;
      lonrat = delw / genw;
    }

    var lat = ptA[0] - ((ptA[0] - ptB[0]) * latrat),
        lon = ptA[1] - ((ptA[1] - ptB[1]) * lonrat);

    if (isNaN(lat) || isNaN(lon)) {
      console.log('NaN Err: ', vecAng);
      console.log(delh, delw);
      console.log(lat, lon);
      console.log('');
    } else {
      return [lat, lon];
    }
  }
};
{% endhighlight %}
