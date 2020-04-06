---
published: true
title: Localized GeoDataFrame UTM reprojection
layout: post
summary: Programmatically identify UTM zones during meter-projection conversion
comments: true
---


## Introduction

It is common to deal with data coming in a format where `x` values are represented by longitudinal coordinates and `y` values are represented by latitudinal coordinates. This format, known as WGS 84 or EPSG 4326, is outlined in greater detail [here](https://en.wikipedia.org/wiki/World_Geodetic_System).

Often, in a Python workroom, this data will be read into a GeoDataFrame where the geometric shapes are paired with other metadata (in other columns). Subsequent manipulations may require distance calculations.

Because a system might be used to process data from one part of the world and then, later, from another; it helps to calculate the projection on the fly. This blog post documents how to do this quickly.

Note: This method is actually a 1:1 map of the steps also encoded in OSMnx, a tool for working with OSM network data in Python with NetworkX. You can see the code this post is based on [here](https://github.com/gboeing/osmnx/blob/998a764141d89b1adcd5456cc04a31c99a3a705b/osmnx/projection.py#L128-L138).

## Steps

First let's create an example dataset from some data with line string segments.

In the below snippet, we take some array of coordinate arrays that represent line string geometries. Because the data is in a format where `x` values are represented by longitudinal coordinates and `y` values are represented by latitudinal coordinates, we register the input coordinate reference system (CRS) as EPSG 4326.

{% highlight python %}
import geopandas as gpd
from pyproj import CRS
from shapely.geometry import LineString

gs = gpd.GeoSeries(map(LineString, path_data_array))
gs.crs = CRS.from_epsg(4326)
{% endhighlight %}

Printing the head of the data will look like the following:

{% highlight python %}
0    LINESTRING (-2.24328 53.53565, -2.24318 53.535...
1    LINESTRING (-2.24408 53.52857, -2.24410 53.528...
2    LINESTRING (-2.24238 53.51906, -2.24238 53.519...
3    LINESTRING (-2.17929 53.50222, -2.17960 53.502...
4    LINESTRING (-2.17004 53.50742, -2.17008 53.507...
dtype: geometry
{% endhighlight %}

Note that we could be using a whole data frame but, for the purposes of this example, it is sufficient to just focus on the geometries column as this is the one that holds and is affected by the CRS (and it subsequently being changed).

We assume that the data being worked with is tied within roughly a single area or region such that extracting all the longitudes will result in a clustering that is relatively geographically isolated.

{% highlight python %}
# longitude is the "x" axis
all_longitudes = gs.centroid.x
all_longitudes.head()
{% endhighlight %}

Thus, all longitudes fall roughly in the same area:

{% highlight python %}
0   -2.261608
1   -2.245830
2   -2.248871
3   -2.165401
4   -2.156182
dtype: float64
{% endhighlight %}

As a result, we can find the average and use this as a reference value:

{% highlight python %}
import numpy as np

# create a representative longitudinal value
representative_longitude = round(np.mean(all_longitudes), 10)
representative_longitude
# -2.2027224042
{% endhighlight %}

With that average value calculated, we can insert the value into the following equation. This produces an integer value that renders the zone id related to the UTM this data is clustered in. You can learn more about UTM zones [here](https://gisgeography.com/utm-universal-transverse-mercator-projection/).

{% highlight python %}
import math

# determine the UTM zone
utm_zone = int(math.floor((representative_longitude + 180) / 6) + 1)
utm_zone
# 30
{% endhighlight %}

Now, it is simply a matter of formatting the new zone id into a string that will indicate to PyProj (via GeoPandas) to re-project from EPSG 4326 to the appropriate meter-based UTM zone id.

{% highlight python %}
# add this new zone value to the following string format
utm_crs = '+proj=utm +zone={} +ellps=WGS84 +datum=WGS84 +units=m +no_defs'.format(utm_zone)

# use geopandas to trigger a reprojection of the geodataframe
reproj_gs = gs.to_crs(utm_crs)
{% endhighlight %}

## Conclusion

To conclude, we can now examine the reprojected GeoSeries and see that `x` and `y` values are now in meter-values.

{% highlight python %}
0    LINESTRING (550152.593 5932126.227, 550159.079...
1    LINESTRING (550107.930 5931338.022, 550106.605...
2    LINESTRING (550231.867 5930281.243, 550231.867...
3    LINESTRING (554436.368 5928454.154, 554415.499...
4    LINESTRING (555043.156 5929039.748, 555040.684...
dtype: geometry
{% endhighlight %}

