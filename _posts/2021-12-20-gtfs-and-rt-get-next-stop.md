---
published: true
title: Upcoming transit stop arrivals data parsing
layout: post
summary: Merging static and real time GTFS data for upcoming stop arrivals insights
comments: true
---

# Introduction

Recently, someone was [asking online](https://twitter.com/slucy/status/1471160361986535426) for some assistance getting up to date arrival information for a particular stop by combining both GTFS and GTFS-RT data. This is a fairly straightforward task thanks to a couple handy GTFS libraries in Python and I wanted to document how this would be performed. First, I will analyze static transit schedule data (GTFS). Next, I will analyze real-time transit data updates (via GTFS-RT). I will return the results of both formats' analyses and use that to highlight how one could conflate the two to show up to date arrivals information for a given stop.

We will be using Calgary's transit data for this analysis for no reason in particular. Any transit operator publishing their schedule data in GTFS and their real-time updates via GTFS-RT could be used instead, if desired. A gist of the below methodology is also available for reference [here](https://gist.github.com/kuanb/72854da1881877286e0309eb63d5e626).


## Set up

Make sure that you have 2 key libraries: `gtfs-realtime-bindings` and `partridge`. We will be working in a Py3 notebook with these two libraries available.

Next, download the latest GTFS zip file for the system:

{% highlight python %}
import requests

url = "https://data.calgary.ca/download/npk7-z3bj/application%2Fx-zip-compressed"
r = requests.get(url)
inpath = "example_nb_latest_gtfs.zip"
with open(inpath, 'wb') as f:
    f.write(r.content)
del r
{% endhighlight %}

Then, load in the GTFS as a partridge GTFS object:

{% highlight python %}
import datetime
import partridge as ptg

# read in the gtfs feed as a partridge object
service_ids_by_date = ptg.read_service_ids_by_date(inpath)
sids = [service_ids for date, service_ids in service_ids_by_date.items() if date == datetime.date(2021, 12, 20)]
gtfs = ptg.load_feed(inpath, {"trips.txt": {"service_id": sids}})
{% endhighlight %}

Note that we are targeting a specific service date (today), but could specify any day as desired. The only thing to be careful us is to just limit to a specific date in this case.

### Sanity check the loaded data

We can now review the data and select a target stop to analyze.

{% highlight python %}
from typing import Union
import numpy as np
import sys
import pyproj
import warnings
import pandas as pd
from pyproj import CRS
import math
import geopandas as gpd
from shapely.geometry import LineString, Point

def extract_the_line(sub: pd.DataFrame) -> LineString:
    sub = sub.sort_values(by="shape_pt_sequence", ascending=True)
    return LineString(zip(sub.shape_pt_lon, sub.shape_pt_lat))


def wgs_to_utm(gdf: Union[gpd.GeoSeries, gpd.GeoDataFrame]) -> Union[gpd.GeoSeries, gpd.GeoDataFrame]:
    """Take a 4236-proj geoseries and return cast to local meter-based."""
    gdf.crs = CRS.from_epsg(4326)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        xs = gdf.centroid.x
    utm_zone = int(math.floor((np.mean(xs) + 180) / 6) + 1)
    utm_crs = "+proj=utm +zone={} +ellps=WGS84 +datum=WGS84 +units=m +no_defs".format(utm_zone)
    return gdf.to_crs(crs=utm_crs)


# quickly check that it looks like we have a whole bus system here
s = gtfs.shapes.copy()
gds = gpd.GeoSeries(s.groupby("shape_id").apply(extract_the_line))
gds = wgs_to_utm(gds)
del s

ax = gds.plot(figsize=(18,18), lw=1.5, ec="blue", alpha=0.3)
ax.set_axis_off()
ax.set_title("Calgary GTFS system represented via shapes file")


# next, we want to get a popular stop and mark that on the map, too
s = gtfs.stops.copy()
popular_stop = "3392"
p = Point(s.loc[s.stop_id == popular_stop, ["stop_lon", "stop_lat"]].squeeze().tolist())
del s

# mark on the map w/ a 1000 meter-diameter dot
wgs_to_utm(gpd.GeoSeries([p])).buffer(500).plot(ax=ax, color="red")
{% endhighlight %}

We can visualize this as shown in the above just as a visual refernce to see both our stop and the system as a whole to make sure we have loaded in the network we have in fact intended to.

![system_map](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/calgary_rt_gtfs/system_map.png)

Above: Image of the system map with the target stop highlighted in red.

# ETL on GTFS schedule data

We can now extract just upcoming arrivals data for the one stop we want to review. We can create a window of time that we want to look in the future for - this window will limit how many upcoming arrivals we show. In this case, let's just look forward 20 minutes.

Note that we just selected a `popular_stop` value arbitrarily based on what appeared to be a stop with a high number of arrivals in the downtown area of Calgary. A stop value could be provided by a client when requesting arrivals data instead and used in lieu of the one provided, of course.

{% highlight python %}
import time
import pytz

def _as_secs(at: str) -> int:
    """Given a time string (ex: 06:16:00) convert to int of seconds."""
    bkts = list(map(int, at.split(":")))
    h = bkts[0]
    m = bkts[1]
    s = bkts[2]
    return (h * 60 * 60) + (m * 60) + s

curr_time_from_secs = int(time.time())
curr_time_raw = pytz.utc.localize(datetime.datetime.now(), is_dst=None).astimezone(pytz.timezone("America/Denver")).strftime("%H:%M:%S")
print(f"Evaluating at this time: {curr_time_raw}")

current_time = _as_secs(curr_time_raw)  # time in calgary
look_fwd_n_min = 20  # how many minutes ahead you want to include in the query

st = gtfs.stop_times.copy()
st = st.loc[st.stop_id == popular_stop]
st = st.sort_values(by="arrival_time", ascending=True)

# get the next N trips coming to this stop within the next 20 min
n_min_from_current = current_time + (look_fwd_n_min * 60)
st = st[(st.arrival_time > current_time) & (st.arrival_time < n_min_from_current)].reset_index(drop=True)

# get the related trip ids
tids = st.trip_id.unique()
ts = gtfs.trips.copy()
ts = ts.loc[ts.trip_id.isin(tids)]

# get the related route attributes
rs = gtfs.routes.copy()
rs = rs.loc[rs.route_id.isin(ts.route_id.unique())]

# ...and merge those onto the trip deets
ts = pd.merge(ts, rs, on="route_id", how="left").set_index("trip_id")
del rs
{% endhighlight %}

We now have just 3 arrivals we can see on the schedule. These are the only trips with arrivals scheduled for that target stop in the window of time we have specified.

## Reporting scheduled information

With this resulting table that has route and trip data merged, we can now via all relevant arrival information.

```
|   trip_id | route_id   | service_id                | trip_headsign          |   direction_id |   block_id |   shape_id |   route_short_name | route_long_name                   |   route_desc |   route_type |   route_url |   route_color |   route_text_color |
|----------:|:-----------|:--------------------------|:-----------------------|---------------:|-----------:|-----------:|-------------------:|:----------------------------------|-------------:|-------------:|------------:|--------------:|-------------------:|
|  58056923 | 1-20656    | 2021DE-1BUSCUT-Weekday-02 | FOREST LAWN            |              0 |    6073510 |      10141 |                  1 | Bowness/Forest Lawn               |          nan |            3 |         nan |           nan |                nan |
|  58063105 | 307-20656  | 2021DE-1BUSCUT-Weekday-02 | MAX PURPLE CITY CENTRE |              1 |    6073794 |    3070045 |                307 | MAX Purple City Centre/East Hills |          nan |            3 |         nan |           nan |                nan |
|  58063164 | 307-20656  | 2021DE-1BUSCUT-Weekday-02 | MAX PURPLE EAST HILLS  |              0 |    6073797 |    3070044 |                307 | MAX Purple City Centre/East Hills |          nan |            3 |         nan |           nan |                nan |
```

Above: Table of arrival information that is the result of the trip and route table merge on the subset of qualifying arriving trips to the target stop.

We can now also log the resulting stops as information from the GTFS dataaset for scheduled arrivals to this stop:

{% highlight python %}
print(f"{len(st)} Upcoming scheduled arrivals in the next {look_fwd_n_min} minutes:")
for i, row in st.iterrows():
    # you could imagine returning this object instead to a client that would show user this information
    coming_in = (row.arrival_time - current_time) / 60
    t = ts.loc[row.trip_id]
    print(f"\t{str(i+1).zfill(2)}: {t.route_long_name} arriving in {math.ceil(coming_in)} minutes")
{% endhighlight %}

When I ran this at the time logged below, I got the following arrivals:

```
Evaluating at this time: 12:45:59
3 Upcoming scheduled arrivals in the next 20 minutes:
    01: MAX Purple City Centre/East Hills arriving in 5 minutes
    02: Bowness/Forest Lawn arriving in 6 minutes
    03: MAX Purple City Centre/East Hills arriving in 18 minutes
```

# Get GTFS-RT information

Just like we handled the scheduled arrival information, we can check what the real-time feed has to say, as well, and compare the two to see if there are updates on any of the scheduled trips.

The following script takes into account all the trip updates from a single query to the real-time GTFS-RT feed and filters down to just the trips that are related to the stop that was being evaluated in the prior analysis of the static GTFS feed. Also, we limit to just trips running that have not yet passed the target stop (so, their stop sequence is equal to or less than the stop we are evaluating's stop sequence).

{% highlight python %}
import json
import time
from google.transit import gtfs_realtime_pb2
from google.protobuf.json_format import MessageToJson
import pytz
import requests

def get_ref_stop_sequence(tid: str, stop_id: str) -> int:
    """Get the stop sequence for the popular stop as a reference."""
    st = gtfs.stop_times.copy()
    # note this is an incredibly slow way to do this, just providing quick example
    st = st[st.trip_id == tid]
    if stop_id in st.stop_id.tolist():
        ref_stop_seq = st[st.stop_id == stop_id].squeeze().stop_sequence
        return ref_stop_seq
    return None


# get the latest trip updates from real-time
resp = requests.get("https://data.calgary.ca/download/gs4m-mdc2/application%2Foctet-stream")
feed = gtfs_realtime_pb2.FeedMessage()
feed.ParseFromString(resp.content)

# filter to just the trips we want to review
want_trip_ids = ts.index.tolist()

# we will parse the latest live traffic updates data
loaded = [json.loads(MessageToJson(entity)) for entity in feed.entity]

# first let's toss anything that is not in this trip
loaded = [l for l in loaded if l["tripUpdate"]["trip"]["tripId"] in want_trip_ids]

# extract list of reference stop sequences
ref_stop_seqs = {
    tid: get_ref_stop_sequence(tid, popular_stop)
    for tid in set([l["tripUpdate"]["trip"]["tripId"] for l in loaded])}
    
# further prune to only non-None tids
loaded = [l for l in loaded if ref_stop_seqs[l["tripUpdate"]["trip"]["tripId"]]]
  
parsed_list = []
for as_json in loaded:
    curr_tid = as_json["tripUpdate"]["trip"]["tripId"]
    suds = as_json["tripUpdate"]["stopTimeUpdate"]
    for s in suds:
        s["trip_id"] = curr_tid
    parsed_list.extend(suds)
    
# filter to just those that are at stops before ar at the target stop
parsed_list = [p for p in parsed_list if p["stopSequence"] <= ref_stop_seqs[curr_tid]]
{% endhighlight %}

### Reporting live schedule udpates from GTFS-RT

Just like we did with the static data, we can report out our new list of trip updates that are filtered to just the stop we are interested in.

The following script will allow us to just log all qualifying trips from the live feed.

{% highlight python %}
print("Upcoming arrivals from live GTFS-RT feed")
for p in parsed_list:
    # you could imagine merging this with the scheduled times report
    try:
        coming_in = (int(p["departure"]["time"]) - curr_time_from_secs)/60
    except KeyError as e:
        coming_in = 999
    if look_fwd_n_min > coming_in and coming_in > 0:
        t = ts.loc[row.trip_id]
        print(f"\t{str(i+1).zfill(2)}: {t.route_long_name} arriving in {math.ceil(coming_in)} minutes")
{% endhighlight %}

This will log the following text:

```
Upcoming arrivals from live GTFS-RT feed
    03: MAX Purple City Centre/East Hills arriving in 5 minutes
```

What I saw from the above was the first/next arrival from the scheduled transit zip file was shown as being on time for arrival.

We could continue to poll the live feed every 30 seconds to learn about upcoming arrivals as well as any updates should the next arriving trip become delayed.

# Conclusion

Based on the above example, it should be apparent how to then pair the scheduled subset of upcoming trips with the similarly filtered live updates to get the latest information on all scheduled trips that are next-arriving at a specified stop in a transit network.