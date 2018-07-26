---
published: true
title: Utilizing custom eventData objects in MapboxGL
layout: post
summary: Passing flags through MapboxGL event to chain conditionals
comments: true
---

# Introduction

Perhaps others were already well aware of this functionality - but I wasn't, so I wanted to document here in case it helps other folks. In this post I will briefly demonstrate a handy pattern for passing flags through custom `eventData` objects passed in map actions' arguments.

# What is the use case?

Here's a use case I had: Broadly, a user selects an option/presses a button/triggers an action that causes the map viewport to pan to a new location and fit to some bounds determined for that site. (Example: User queries some city and the map forward geolocates that location and pans the map there.)

Now, when the map is done moving, I want to trigger a new action which updates how certain markers are clustered, given the shown bounds. I want this action to only occur after the map view has stopped animating.

# What not to do

An awkward and not-good pattern one might think of is to introduce some sort of timeout that would trigger the re-clustering roughly once the map finished moving its viewport and came to "rest." This is a bad pattern as it results in "untethered" tasks running concurrent to the current tasks and can lead to unintended consequences (the event is triggered a number of times and the user proceeds to fire something else, but the timeout is still running and triggers the re-clustering even though it is no longer desired).

It also does not follow a one-directional, clearly mappable workflow if one is developing in, say, React.

# What I initially looked for

This led me to see if I could create a conditional. That is, I wanted to set a Mapbox event listener on `moveend`, but only when `fitBounds` was called. This was also sub-optimal. First, I do not think that Mapbox supports this sort of conditional event-listening (I think it would be ridiculous/not reasonable to implement, but I could be wrong). Second, what if I wanted to use `fitBounds` again? Now, with this event listener, all other `fitBounds` calls would trigger the same action, desired or not.

# Using flags in the custom event object

The pattern that ended up working for me was to pass a custom event object as a  `fitBounds` argument. Each map action allows for a final parameter to be passed that, in [the documentation](https://www.mapbox.com/mapbox-gl-js/api/#map#fitbounds), is described as `eventData`.

We can include various key-values in this object, like so:

{% highlight javascript %}
map.fitBounds(mbLngLatBoundsObject, {}, { isSpecialEvent: true });
{% endhighlight %}

Now, we can establish our Mapbox event listener to keep an eye out for this flag:

{% highlight javascript %}
map.on('moveend', (e) => {
  if (e.isSpecialEvent) {
    // Do something different than normal
  }
});
{% endhighlight %}

Once the event completes, it will trigger the subsequent event listener action (in this case, the `moveend` event), and pass along the custom event object values along with the standard event object.

Hope this helps someone else dealing with a similar situation!