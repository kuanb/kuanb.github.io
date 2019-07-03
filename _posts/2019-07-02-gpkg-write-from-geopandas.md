---
published: true
title: Debugging GeoPandas GeoPackage read/write
layout: post
summary: Steps in evaluating fid drop pattern during GeoPackage IO
comments: true
---

TL;DR There's a bug with GeoPandas that results in GeoPackage files losing their FID, as captured in [this issue](https://github.com/geopandas/geopandas/issues/1035). The issue lies in the read step, which fails to capture that the `fid` value has been shifted from a property in the `index` value held by the `id` key.

## Introduction

GeoPackage write operations in GeoPandas do not produce expected behavior. When you write to a `GPKG` file and then re-read the output file back in as a GeoDataFrame, a column named `fid` will disappear.

We can re-create this with a simple example. First we create a GeoDataFrame:

{% highlight python %}
import geopandas as gpd
import pandas as pd
from shapely.geometry import Point

columns = ['fid', 'gid', 'id']
data = [(12, 1.0, '1')]

df = pd.DataFrame(data, columns=columns)

p = Point(1,2)
gdf = gpd.GeoDataFrame(df, geometry=[p])

# The GDF looks like this
#    fid  gid id     geometry
# 0   12  1.0  1  POINT (1 2) 
{% endhighlight %}

Then we can write the file and re-read it in as a 2nd GeoDataFrame:

{% highlight python %}
gdf.to_file('test', driver='GPKG')
gdf2 = gpd.read_file('test')

# The resulting GDf looks like this
#    gid id     geometry
# 0  1.0  1  POINT (1 2)
{% endhighlight %}

## Underlying fiona operations for write

To read and write these GeoDataFrames, GeoPandas is merely wrapping Fiona and leveraging that tools ability to interface with GDAL and perform the actual write operations. The key operator for all this is `fiona.open` which requires a set of keyword arguments to execute a write operation.

First, it needs a schema object, which GeoPandas has a small utility that is used to generate this in the required format.

{% highlight python %}
gpd.io.file.infer_schema(gdf)

# Returns the following structure for our example GDF
# {'geometry': 'Point',
#  'properties': OrderedDict([('fid', 'int'), ('gid', 'float'), ('id', 'str')])}
{% endhighlight %}


Additional keywords can be provided, but at the very minimum, this is the information needed, plus a "record" that represents each row in the GeoDataFrame. The records can be created using a GeoDataFrame's `iterfeatures()` generator. Converted to a list and examining the first entry we can see the following:

{% highlight python %}
[x for x in gdf.iterfeatures()]

# Where the structure of each entry or each row looks like the following record:
# {'id': '0',
#  'type': 'Feature',
#  'properties': {'fid': 12, 'gid': 1.0, 'id': '1'},
#  'geometry': {'type': 'Point', 'coordinates': (1.0, 2.0)}}
{% endhighlight %}

As we can see in the above example, each column's value for that row is held in the properties component of that feature (which follows the GeoJSON pattern in terms of object formatting).

## Reading operation with Fiona

If we just write one record as we showed in the above example, we can read that back as a single GeoDataFrame. That GeoDataFrame will have the following content:

{% highlight python %}
print(gpd.read_file('test'))

#    gid id     geometry
# 0  1.0  1  POINT (1 2)
{% endhighlight %}

Now, if we look at the underlying operation in which the `Fiona.open` method is being used to read instead of write, we can see what happened to the `fid` column.

{% highlight python %}
with fiona.open('ohm/test') as f:
    feats = list(f)
    print(feats)

# There is just one row which logs the following:
# [
#     {'type': 'Feature',
#      'id': '12',
#      'properties': OrderedDict(
#          [
#              ('gid', 1.0),
#              ('id', '1')
#          ]),
#     'geometry': {
#         'type': 'Point',
#         'coordinates': (1.0, 2.0)}
#     }
# ]
{% endhighlight %}

In this operation we can see that the "12" value for the `fid` is indeed present but has been moved to the id column. All other values still remain the properties column. What is happening is that, during the write process the `fid` is being assigned to the index.

## Quick fix

Without modifying the GeoPandas codebase, one can quickly extract the missing `fid` column by extraction this from each feature `id` with the `fiona.open` file reader:

{% highlight python %}
with fiona.open('test') as f:
    feats = list(f)
    fids = [f['id'] for f in feats]
{% endhighlight %}

Once that is one, you have an array that has all the values for the `fid` column that was previously exempt and can simply assign that to the existing GeoDataFrame that has already been read in but is missing that column. Here's an example of how that might happen:

{% highlight python %}
gdf_alt = gpd.read_file('test')
assert 'fid' not in gdf_alt.columns
gdf_alt['fid'] = fids
assert 'fid' in gdf_alt.columns

# The resulting GDF looks the same as what the original looked like
# aside from the fact that the columns are not in the same order since
# the fid column was added last

#    gid id     geometry fid
# 0  1.0  1  POINT (1 2)  12
{% endhighlight %}

## What is happening to fid on write

When GeoPandas writes to a file, it's pretty straightforward in terms of how it just wraps fiona operations:

{% highlight python %}
if schema is None:
    schema = infer_schema(df)
filename = os.path.abspath(os.path.expanduser(filename))
with fiona_env():
    with fiona.open(filename, 'w', driver=driver, crs=df.crs,
                    schema=schema, **kwargs) as colxn:
        colxn.writerecords(df.iterfeatures())
{% endhighlight %}

It's iterating through each record and writing the record generated for that row via the driver specified. Per the GDAL GeoPackage documentation (see it [here](https://gdal.org/drivers/vector/gpkg.html)), the FID layer includes an FID designation for layer creation described as follows: "Column name to use for the OGR FID (primary key in the SQLite database). Default to 'fid.'"

It appears that the write operation intentionally - that is by design - takes an "fid" attribute if available and uses it as the column. What this means is that it expects that this be an integer value column.

Let's say we instead made the column a float value instead:

{% highlight python %}
columns = ['fid', 'gid', 'id']
data = [(12.2, 1.0, '1')]

df = pd.DataFrame(data, columns=columns)

p = Point(1,2)
gdf = gpd.GeoDataFrame(df, geometry=[p])

gdf.to_file('test', driver='GPKG')
gdf2 = gpd.read_file('test')
{% endhighlight %}

The resulting operation would error like so:

{% highlight bash %}
CPLE_AppDefinedError  Traceback (most recent call last)
fiona/ogrext.pyx in fiona.ogrext.WritingSession.start()

fiona/_err.pyx in fiona._err.exc_wrap_int()

CPLE_AppDefinedError: Wrong field type for fid
{% endhighlight %}

The GeoPackage driver was expecting that the `fid` column be an integer column. The same would happen if that column was a string, too (or anything else other than an integer).

In order to accommodate for this in GeoPandas a number of decisions would need to be made. For example, if a user were to export an `fid` column and want it preserved - the column would have to be renamed so as to not error by the driver on write. On read, the driver would need to look for the `id` for each feature and add it to the properties dictionary representing all rows in the to-be-created GeoDataFrame. It would need to name that new column `fid` and set each value read in (that was originally a string) as an integer.

## Conclusions

`fid` management is something that should be carefully considered and managed before submitting a GeoDataFrame to an export operation. Similarly, preservation of `fid` on GeoPackage read-in should be explicitly called out so as to avoid reading in ids that are not integer-based as `fid` (and thereby cause a downstream error should an export be tried then).

