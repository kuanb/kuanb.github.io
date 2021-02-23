---
published: true
title: Modeling a 40% budget increase w/ GTFS
layout: post
summary: Allocating new service based on routes by headway and trip runtime
comments: true
---

# Introduction

The [East Bay Transit Riders Union](https://ebtru.org/) recently sent out a letter indicated that they wanted to create a visualization like the one shared below. The visualization appears to show existing transit service and then what it would look like if there was a 40% budget increase. They appear to want to do it for AC Transit instead of the example locations that TransitCenter did it for.

<blockquote class="twitter-tweet"><p lang="en" dir="ltr">Here&#39;s what that could look like in Atlanta. Today many routes run sporadically and don&#39;t provide good mobility (they don&#39;t show up in the &quot;before&quot; map).<br><br>Increasing service 40% enables many of those routes to run much more frequently, expanding where people can reach on transit. <a href="https://t.co/5WubdsEfPP">pic.twitter.com/5WubdsEfPP</a></p>&mdash; TransitCenter (@TransitCenter) <a href="https://twitter.com/TransitCenter/status/1354469367191400452?ref_src=twsrc%5Etfw">January 27, 2021</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

The methodology for the above was shared [here](https://transitcenter.org/wp-content/uploads/2021/01/Transit_Center_Methodology-.pdf). I have also copy and pasted it below:

{% highlight python %}
1) Imported the existing system as of December 2020
2) Calculated 40% of the estimated budget
3) Filtered to only the lines that run at a 15-minute headway at 12pm on a weekday
4) Downloaded lines as “Before”
5) Highlighted lines that as of December 2020 operate at 30-45 minute headways
6) Increased weekday headways to 15 minutes on lines in Step 5 until hitting the budget calculated in Step 2
7) Downloaded lines as “After”
{% endhighlight %}

We can model this same sort of methdology with just the raw GTFS and (I think) generate a comparable result. I've posted the visual results of this effort on Twitter in response as well (shown below). The remainder of this post outlines my version of the stated approach to estimate what the new 15-minute headway map would for a given service provider (in this case, AC Transit) if they were to increase their budget by 40%.

<blockquote class="twitter-tweet"><p lang="en" dir="ltr">Saw in <a href="https://twitter.com/TransitRidersEB?ref_src=twsrc%5Etfw">@TransitRidersEB</a> meeting recap email they wanted to see what weekday <a href="https://twitter.com/rideact?ref_src=twsrc%5Etfw">@rideact</a> 15-min headway service would look like w/ a 40% budget increase.<br><br>I took a stab at estimating this myself. Resulting current and projected images below.<br><br>Methodology: <a href="https://t.co/mEUlVVl8ku">https://t.co/mEUlVVl8ku</a> <a href="https://t.co/ciL3vvK2tn">pic.twitter.com/ciL3vvK2tn</a></p>&mdash; Kuan Butts (@buttsmeister) <a href="https://twitter.com/buttsmeister/status/1364109705610629120?ref_src=twsrc%5Etfw">February 23, 2021</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

# My version of the workflow

Generating the existing system is pretty straightforward manipulation of the GTFS. I pulled AC Transit's latest GTFS and got a representative "busiest day" service schedule from the feed (which was Jan 19, 2021, a Tuesday).

To better calculate headways, I expanded the window of time evaluation from 12 noon exactly to the 2 hour window around it (11 AM to 1 PM). I was then able to calculate headways for all routes in the system that were running on the schedule for that representative day. This satisfies all steps up through and including #4 in the above steps.

I was able to accomplish line 5-7 by modeling the "budget" by costing each route. For each route I would look at the associated trips and get the average cost in terms of minutes to run a bus along that route. I could use this to estimate how many minutes it would cost to add a new line on that route.

I could then estimate what a 40% increase in the budget would look like by doing the following steps:
- Calculate all trips running in time window
- Get routes associated with each trip
- Estimate the average total cost to run a trip per route on average
- Sum that average cost for each route times the number of trips running in the window
- Divide the window by hours to get the average time in minutes being expended during this window
- Increase that amount by 40 percent, this is the new allotted time
- Go through remaining routes not hitting the 40 and add 2 new trips per route until each does (2 because need to be round trip)

# Walkthrough of code

Full code and example outputs are hosted on [this gist](https://gist.github.com/kuanb/9a15956e1316431ee4d247e373022e67) for future reference.

## Load in the data

Use partridge to read in the data and get representative date and schedule:

{% highlight python %}
import partridge as ptg

inpath = "act_gtfs.zip"
_date, service_ids = ptg.read_busiest_date(inpath)
view = {
    'trips.txt': {'service_id': service_ids},
}

feed = ptg.load_feed(inpath, view)
{% endhighlight %}

## Estimate a headway per route

Iterate through each route in the timeframe and get all trips associated with route. Get headways between trips for each stop and use those figures to estimate an average headway. Added a limit of 15.5 minutes to give estimates some wiggle room.

{% highlight python %}
HEADWAY_LIMIT = 15.5  # minutes
TIME_WINDOW = [11, 12]
TOSS_OUT_DEFAULT = 9999  # throw away value for non-qualifying segments

def calc_headways(sub):
    sub = sub.sort_values(by="arrival_time")
    ats = sub["arrival_time"].tolist()
    hwys = [(b - a) for a, b in zip(ats[:-1], ats[1:])]
    
    # bail early if not enough headways
    if len(hwys) < 2:
        return TOSS_OUT_DEFAULT
    
    avg_hwy = sum(hwys)/len(hwys)
    
    # convert from seconds to minutes
    return avg_hwy/60

st_df = feed.stop_times
hrs = (st_df.arrival_time / (60**2)).round(0).astype(int)
st_df = st_df.loc[hrs.isin(TIME_WINDOW)]

# filter to just trips in time window being evaluated
mask_a = feed.trips.trip_id.isin(st_df.trip_id.unique())
tr_df = feed.trips.loc[mask_a]

# get just the routes associated with trips in this timeframe
routes_in_timeframe = tr_df.route_id.unique()

route_headways = {}
for route_id in routes_in_timeframe:
    # look for route trips and determine if headways qualify
    mask_b = tr_df.route_id == route_id
    trips_from_route = tr_df.loc[mask_b, "trip_id"].unique()

    stops_by_trips = st_df.loc[st_df.trip_id.isin(trips_from_route)]
    hwys_by_stop = stops_by_trips.groupby("stop_id").apply(calc_headways)
    median_hwy = hwys_by_stop.quantile(0.5)
    route_headways[route_id] = median_hwy
{% endhighlight %}

## Determine qualifying routes

At this point we can create a lookup from results of what qualifies as a 15 minute headway route already and thus routes we do not need to expend new budget on in terms of adding new service.

{% highlight python %}
qualifying_routes = []
for route_id in route_headways:
    median_hwy = route_headways[route_id]
    if median_hwy <= HEADWAY_LIMIT:
        qualifying_routes.append(route_id)

print(f"Current qualifying routes: {qualifying_routes}")
# Current qualifying routes: ['6', '51A', '1T', '54', '51B', '40', '73', '72R']
{% endhighlight %}

## Determine existing budget and new budget in minutes

In order to calculate budget let's first look at existing service in terms of trips and average cost in time per trip and route.

{% highlight python %}
import numpy as np

# how many routes are running during this time window?
routes_running_per_hour = len(tr_df.trip_id.unique())/len(TIME_WINDOW)
print(f"Routes running per hour in window: {int(routes_running_per_hour)}")

trip_runtimes = {}
for trip_id in st_df.trip_id.unique():
    trip_times = feed.stop_times[feed.stop_times.trip_id == trip_id].sort_values(by="stop_sequence")

    # calculate trip runtime in minutes
    trip_runtime = ((trip_times.arrival_time.max() - trip_times.arrival_time.min()) / 60)
    trip_runtimes[trip_id] = trip_runtime

route_costs_lookup = {}
route_trace_pairings = tr_df.groupby("route_id").apply(lambda sub: sub["trip_id"].unique())
for route_id, rtp in route_trace_pairings.iteritems():
    avg_route_time = np.mean([trip_runtimes[t] for t in rtp])
    route_costs_lookup[route_id] = avg_route_time
{% endhighlight %}

We can now produce stats about how many more minutes or hours we have to work with, with new budget:

{% highlight python %}
from functools import reduce

# now we want to organize current route to identify those that are close to 15 minute threshold and sort by the "next closest"
routes_by_priority = sorted(route_headways.items(), key=lambda x: x[1])

current_costs = {}
for rte_id, hdwy in routes_by_priority:
    # skip the non-qualifying routes
    if hdwy == TOSS_OUT_DEFAULT:
        continue

    # calculate cost in terms of vehicles/driver hours
    est_runs_per_hr = 60/hdwy
    time_cost_per_trip = route_costs_lookup[rte_id]
    total_current_cost = time_cost_per_trip * est_runs_per_hr
    current_costs[rte_id] = total_current_cost
    
total_minutes_per_hour = sum(current_costs.values())
total_minutes_per_hour = round(total_minutes_per_hour)
print(f"Total number of minutes per hour in window: {total_minutes_per_hour}")

# a 40% increase would mean how many more minutes?
minutes_to_spend = (total_minutes_per_hour * 1.4) - total_minutes_per_hour
print(f"Total hours to add bus trips with: {round(minutes_to_spend/60, 1)}")

# Total number of minutes per hour in window: 5457
# Total hours to add bus trips with: 36.4
{% endhighlight %}

## Costing remaining routes for 15-minute headways

For all remaining routes we can come up with what it would cost in terms of minutes to get them to have a 15 minute headway.

{% highlight python %}
from copy import copy

costs_to_hit_headway = []
for rte_id, hdwy in routes_by_priority:
    # skip routes that are already 15 minutes
    if rte_id in qualifying_routes:
        continue
        
    # see how many trips need to be added to get to 15 minute threshold
    curr_est_runs_per_hr = 60/hdwy
    new_runs_per_hr = copy(curr_est_runs_per_hr)
    new_hdwy = copy(hdwy)

    while new_hdwy > HEADWAY_LIMIT:
        new_runs_per_hr += 2  # has to be 2 because round trip
        new_hdwy = 60/new_runs_per_hr
    
    new_runs = round(new_runs_per_hr - curr_est_runs_per_hr)
    time_cost_per_trip = route_costs_lookup[rte_id]
    cost_to_hit_headway = time_cost_per_trip * new_runs
    costs_to_hit_headway.append((rte_id, new_runs, cost_to_hit_headway))
{% endhighlight %}

From such results we can now select the "new routes" that would get upgraded with the budget increase.

{% highlight python %}
minutes_remaining = copy(minutes_to_spend)
routes_to_add = []
for rte_id, new_runs, cost_to_hit_headway in costs_to_hit_headway:
    minutes_remaining -= cost_to_hit_headway
    if minutes_remaining > 0:
        routes_to_add.append(rte_id)
        
print(f"New routes that can be added w/ budget increase: {routes_to_add}")

# New routes that can be added w/ budget increase: ['14', '10', '57', '62', '99', 'NL', '98', '90', '88', '52', '18', '97', '33', '20', '21', '36', '217', '210', '7', '12', '96', '200', '29', 'O']
{% endhighlight %}

## Outputting as shapes

Final step is just to export these as GeoJSONs to share graphically.

{% highlight python %}
# now we need to get the related shape for each route (might be one for each direction for example)
rte_shape_lookup = {}
trip_shape_lookup = tr_df.set_index("trip_id")["shape_id"].to_dict()
for i, row in tr_df.iterrows():
    rte_id = row["route_id"]
    shape = trip_shape_lookup[row["trip_id"]]
    
    if rte_id not in rte_shape_lookup:
        rte_shape_lookup[rte_id] = []
    
    if shape not in rte_shape_lookup[rte_id]:
        rte_shape_lookup[rte_id].append(shape)


# create a geojson of routes for "after"
output_geojson_after = {
  "type": "FeatureCollection",
  "features": []
}

for rte_id in qualifying_routes + routes_to_add:
    for shape_id in rte_shape_lookup[rte_id]:
        shape_sub = feed.shapes.loc[feed.shapes["shape_id"] == shape_id].sort_values("shape_pt_sequence")
        coords = [[row["shape_pt_lon"], row["shape_pt_lat"]] for i, row in shape_sub.iterrows()]
        feature =     {
          "type": "Feature",
          "properties": {},
          "geometry": {
            "type": "LineString",
            "coordinates": coords
          }
        }
        output_geojson_after["features"].append(feature)
{% endhighlight %}
