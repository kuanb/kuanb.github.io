---
published: true
title: Mean vs. Median Headway Divergence
layout: post
summary: Assessing Differences by Hour in Mean and Median Route-Stop Headways
comments: true
---

When performing transit accessibility analyses, it’s important to understand the implications of how you summarize schedule information. In particular, getting headways right is critical to ensuring that your accessibility model does not over or undersell the coverage of transit. Understanding the give-and-takes of varying methods of headways summary - even when performing less intensive sketch analyses - is important. 

## Calculating travel costs

Let’s talk about buses transit systems for now. One quick way to determine the cost in time for commuting from your home to work via bus is to calculate the following:

1. The cost in time to walk from your house to the nearest bus stop.
2. The cost in time to wait for the bus.
3. The cost in time to ride the bus to the nearest stop to your work.
4. The cost in time to walk from that stop to your work.

For this blog post, let’s look at item number 2. How should we calculate the cost in time for waiting for a bus. There are a number of ways to do this, and they all center around headway, or the time between the last departure of a bus on a given bus route at a given stop and the arrival of the next. There’s a nice post [here](http://www.nearimprov.com/what-is-a-headway/) about the nuances of headway and I will aim to dive into just one aspect of it in the below.

## Types of headway analysis

Analysis of headways goes from very rough to very robust. On the less accurate end of the spectrum, one would typically just get the average headway over a period of time (say, a morning rush hour from 6:30 AM to 9:00 AM). On the most computationally intensive end of the spectrum, departure times might be assessed at every minute of every hour from a given origin to a given destination, so as to capture accessibility increases that account for timed transfers between routes, as well as periods of high service given certain timing.

While those analyses are impressive, they are much harder for someone just playing around with some schedule data to perform quickly. So, let’s go back to the other end of the spectrum. The intent of this post is to understand the costs of using mean vs. median methods to summarize headways when sketching transit accessibility.

## Issues with Median vs Mean

If you went and took a look at the [blog post](http://www.nearimprov.com/what-is-a-headway/) I linked to earlier, you’ll notice that there is discussion about the intractability of properly calculating headways - with mean or with median. For example: a bus arrives 4 times in 4 minutes per hour. In this situation, the headways might look like this: 1, 1, 1, and 56 minutes. The mean would be 12 minutes and the median would be 1 minute. Neither would accurately model what the headway was at that location.

While these are particularly difficult cases, an accessibility model for a given area is usually seeking more broad assessments. That is, smaller irregularities may become obscured by overall trends in an area. Thus, the traditional method of taking the average may be acceptable. That said, the median is often pointed to as being more appropriate, in particular, at dealing with some of the inaccuracies of taking the average of headways.

That may be true, but how? Across a given transit network, what do the differences between mean and median look like, in aggregate, when segmenting by route, direction, and trip? Would the differences normalize? Would a dominant pattern emerge?

## Measuring Mean vs Median Divergence

![bucketed](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/mean-median-headways/bucketed.png)

In order to calculate summary statistics (as shown above) for mean and median headways, compiled by each route in a network (in this example, using MTA’s Brooklyn feed), I need to do the following:

1. Convert arrival and departure times into seconds from midnight
2. Loop through each route and sub-loop through the following, in order nested:
    - Route direction
    - Route service id
    - Route stop id
3. At the stop id level, get the time, in seconds, between each arrival time and the previous departure time
4. Results are sorted into buckets by hour

The results from this process (see above image) demonstrate what one might expect. Late evening and early morning results for mean and median differ more significantly than daytime headways. These are also, naturally, times of day where frequencies are far lower and situations where limited bus service exists is more able to exacerbate discrepancies between the two methods.

During the daytime, there is a consistent gap wherein mean values for headways are consistently calculated as 50-75 seconds greater than median values. This is a not insignificant difference. When performing accessibility analysis, if one were to halve these results and call that impedance for utilizing a transit route, then a 40 second greater cost for accessing a given route would have an outsized impact on generating isochrones at, for example, the 15 minute and 30 minute access sheds, where it represents a 4.4% and 2.2% of the total time in consideration, respectively.

Thus, it is important to both be aware of these assumptions as well as to understand their impact as this decision represents significant impact on resulting accessibility metrics produced.

The method described above is available as a notebook, [here](https://gist.github.com/kuanb/0b688113ce660913da3c8a370e7faaad).
