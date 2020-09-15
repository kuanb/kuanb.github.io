---
published: true
title: RAPTOR algorithm with caching
layout: post
summary: Notes on suggested optimizations
comments: true
---


## Introduction

This post is a brief follow up to the [original RAPTOR transit routing blog post](http://kuanbutts.com/2020/09/12/raptor-simple-example/) I wrote a few days ago. Again, the post and this one are based on [this paper](https://www.microsoft.com/en-us/research/wp-content/uploads/2012/01/raptor_alenex.pdf), by MSR. This post is in response to the various optimizations that were listed in the paper under section "3.1 Improvements."

This post covers the optimizations as they are implemented in my code. It then remarks on the results, which I found to be disappointing. Basically, because each iteration causes a great deal of fan out, caching does not really help. Early iterations do not have a large number of qualifying stops but later iterations due, so cached stops only represent a small fraction of an every-growing number of qualifying stops to evaluate.

I hope my documenting this will help expose my methods in such a way that someone might see if there's something else I am missing from the paper that might be used to increase the performance of this method. I do note that each iteration could easily be parallelized and that this would speed up each iterations runtime linearly. I can explore that, perhaps, in a later post.

## Suggested optimizations summary

The improvements mentioned were the following:

- skip trips/routes that can't be reached from a given stop on a `k`th round (a round being a transfer count step)
- keep track of what stops have recently been updated (in the last `k`th round) and only check those for new trips
- do not look at all stops in a trip; just look at the one with the earliest arrival
- prune stops for just the earliest arrival

## Updates to code

I updated the original notebook with [this version, hosted as a Gist](https://gist.github.com/kuanb/a45b65c3135dce717497643e7f35f0ab). This version introduces those key optimizations by introducing an object that does a more complete job of managing the state of each stop, instead of just the earliest arrival time to each.

The code, shown below, allows for some simple put/get actions, as well as checks for when to overwrite a stop. The stop preceding trips are also tracked, so you can see what path it took to get to the destination node.

{% highlight python %}
class StopAccessState:
    def __init__(self, origin_stop_id: str):
        """State tracker for stop ids."""
        self._stops = {}

        # initialize the origin node with no prior trip history
        self._origin = origin_stop_id
        self.try_add_update(self._origin, 0)
    
    def all_stops(self):
        return list(self._stops.keys())
        
    def has_stop(self, stop_id: str):
        return stop_id in self._stops.keys()
    
    def get_stop(self, stop_id: str):
        return self._stops[stop_id]
    
    def try_add_update(
        self,
        stop_id: str,
        time_to_reach: Union[int, float],
        trip_id: Optional[str]=None,
        preceding_path: Optional[List[str]]=None,
    ) -> bool:
        # initialize return object
        did_update = False

        if stop_id in self._stops.keys():
            if self._stops[stop_id]["time_to_reach"] > time_to_reach:
                # update the stop access attributes
                self._stops[stop_id]["time_to_reach"] = time_to_reach
                did_update = True

        else:
            self._stops[stop_id] = {
                "time_to_reach": time_to_reach,
                "preceding": [],  # initialize with no past paths
            }
            did_update = True

        if did_update:
            # override if a preceding path is provided
            if preceding_path:
                self._stops[stop_id]["preceding"] = preceding_path

            # add current trip id to the path of trips taken, avoiding dupes
            if trip_id is not None and (
                len(self._stops[stop_id]["preceding"]) == 0 or
                trip_id != self._stops[stop_id]["preceding"][-1]):
                self._stops[stop_id]["preceding"].append(trip_id)
            
        return did_update
{% endhighlight %}

Each iteration of the transfer count step now looks only for the stops that have been recently updated (so the stops that were newly accessible as a result of the full traversal of a paired stop's trips).

{% highlight python %}
def stop_times_for_kth_trip(
    stops_state: StopAccessState,
    last_updated_stops: List[str],
) -> None:
    # sort stops into their associated groups
    trip_stop_pairings = {}
    for ref_stop_id in last_updated_stops:
        # find all trips already related to this stop
        associated_trips = stop_state.get_stop(ref_stop_id)["preceding"]

        # find all qualifying trips assocaited with this stop
        potential_trips = get_trip_ids_for_stop(feed, ref_stop_id, departure_secs)
        for potential_trip in potential_trips:
            # pass on trips that are already addressed
            if potential_trip in associated_trips:
                continue
                
            if potential_trip in trip_stop_pairings.keys():
                trip_stop_pairings[potential_trip].append(ref_stop_id)
            else:
                trip_stop_pairings[potential_trip] = [ref_stop_id]

    # iterate through trips with grouped stops in them
    for trip_id in trip_stop_pairings:
        stop_ids = trip_stop_pairings[trip_id]

        # get all the stop time arrivals for that trip
        stop_times_sub = feed.stop_times[feed.stop_times.trip_id == trip_id]
        stop_times_sub = stop_times_sub.sort_values(by="stop_sequence", ascending=True)
        
        # find all stop ids that are in this stop ordering and pick last on route path
        stop_times_mask = stop_times_sub.stop_id.isin(stop_ids)
        target_stops = stop_times_sub[stop_times_mask].sort_values(by="stop_sequence", ascending=True)
        
        # get the "hop on" point
        from_here = target_stops.tail(1).squeeze()        
        ref_stop_id = from_here.stop_id
        
        # are we continuing from some previous path of trips?
        ref_stop_state = stops_state.get_stop(ref_stop_id)
        preceding_path = ref_stop_state["preceding"]

        # how long it took to get to the stop so far (0 for start node)
        baseline_cost = ref_stop_state["time_to_reach"]

        # get all following stops
        stop_times_after_mask = stop_times_sub.stop_sequence >= from_here.stop_sequence
        stop_times_after = stop_times_sub[stop_times_after_mask]

        # for all following stops, calculate time to reach
        arrivals_zip = zip(stop_times_after.arrival_time, stop_times_after.stop_id)
        for arrive_time, arrive_stop_id in arrivals_zip:
            # time to reach is diff from start time to arrival (plus any baseline cost)
            arrive_time_adjusted = arrive_time - departure_secs + baseline_cost
            stops_state.try_add_update(
                arrive_stop_id,
                arrive_time_adjusted,
                trip_id,
                preceding_path)
{% endhighlight %}

Similarly, the footpath connection logic now needs to track the new stops that are identified:

{% highlight python %}
def add_footpath_transfers(
    stops_state: StopAccessState,
    stops_gdf: gpd.GeoDataFrame,
    already_processed_stops: List[str],
    transfer_cost=TRANSFER_COST,
) -> List[str]:
    # initialize a return object
    updated_stop_ids = []

    # add in transfers to nearby stops
    stop_ids = stop_state.all_stops()
    for stop_id in stop_ids:
        # no need to re-intersect already done stops
        if stop_id in already_processed_stops:
            continue

        stop_pt = stops_gdf.loc[stop_id].geometry

        # TODO: parameterize? transfer within .2 miles
        meters_in_miles = 1610
        qual_area = stop_pt.buffer(meters_in_miles/5)
        
        # get all stops within a short walk of target stop
        mask = stops_gdf.intersects(qual_area)

        # time to reach new nearby stops is the transfer cost plus arrival at last stop
        ref_stop_state = stops_state.get_stop(stop_id)
        arrive_time_adjusted = ref_stop_state["time_to_reach"] + TRANSFER_COST

        last_trip_id = None
        if len(ref_stop_state["preceding"]):
            last_trip_id = ref_stop_state["preceding"][-1]

        # only update if currently inaccessible or faster than currrent option
        for arrive_stop_id, row in stops_gdf[mask].iterrows():
            did_update = stops_state.try_add_update(
                arrive_stop_id,
                arrive_time_adjusted,
                last_trip_id)

            if did_update:
                updated_stop_ids.append(arrive_stop_id)
    
    return updated_stop_ids
{% endhighlight %}

Another optimization is introduced, that you might notice, is that stops that have already been geo-processed with near pairs found are also tracked. This helps save some time performing intersections. Using a spatial r-tree index would help speed this up further. Again, the point still stands that the number of new qualifying stops in later rounds are so great as to far exceed those in earlier transfer counts. The result of this is that the caching/skipping does not produce significant performance speedups.


## Discussion of results

As mentioned above, the performance speed up is rather marginal because of the high level of fan-out that occurs on later iterations of transfers. A summary is presented below:

Original runtime increased with each iteration. This was due to repetitive identification and processing of stop and trips that were already handled, as well as expensive geo-operations on stops done repeatedly. By leveraging some simple caching patterns, we can avoid those and shift the cost of increased transfers to become have a more linear cost increase. That is, each subsequence transfer/iteration would only be calculating the new stops identified, not all of the prior ones, plus the new ones, cumulatively.

```
Analyzing possibilities with 0 transfers
    initial qualifying stop ids count: 1
    stop times calculated in 0.9308 seconds
        28 stop ids added
    footpath transfers calculated in 0.6707 seconds
        103 stop ids added

Analyzing possibilities with 1 transfers
    initial qualifying stop ids count: 132
    stop times calculated in 24.1655 seconds
        782 stop ids added
    footpath transfers calculated in 20.1302 seconds
        1077 stop ids added

Analyzing possibilities with 2 transfers
    initial qualifying stop ids count: 1991
    stop times calculated in 60.4546 seconds
        406 stop ids added
    footpath transfers calculated in 52.8831 seconds
        517 stop ids added
Time to destination: 35.5 minutes
```

Unfortunately, the impact of caching is fairly limited because there is a great deal of "fan-out." That is, with each iteration (each additional set of transfers allowed), the number of possible stops to consider increases significantly, producing ever greater numbers of possible routes and trips to consider, that were inaccessible in the prior step (or transfer-iteration). Below is an example demonstrating how the caching effort produces marginal improvements in runtime of the algorithm.

```

Analyzing possibilities with 0 transfers
    initial qualifying stop ids count: 1
    stop times calculated in 0.9049 seconds
        28 stop ids added
    footpath transfers calculated in 0.7186 seconds
        103 stop ids added
    already processed count increased from 0 to 1
    new stops to process: 103

Analyzing possibilities with 1 transfers
    initial qualifying stop ids count: 132
    stop times calculated in 22.9711 seconds
        782 stop ids added
    footpath transfers calculated in 20.6031 seconds
        1077 stop ids added
    already processed count increased from 1 to 104
    new stops to process: 1547

Analyzing possibilities with 2 transfers
    initial qualifying stop ids count: 1991
    stop times calculated in 52.9557 seconds
        407 stop ids added
    footpath transfers calculated in 50.7413 seconds
        517 stop ids added
    already processed count increased from 104 to 1651
    new stops to process: 940
Time to destination: 35.5 minutes
```

As you can see from these logs, the introduction of the caching logic produced negligible runtime speedups. I am hoping I am missing some greater performance speedups but I think I might not. It is likely that this algorithm really leans on parallelization for achieving performance gains.