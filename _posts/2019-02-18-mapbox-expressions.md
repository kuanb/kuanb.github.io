---
published: true
title: Migrating to new Mapbox expressions
layout: post
summary: Documentation on new expression pattern conversion for Mapbox GL
comments: true
---

## Introduction

Mapbox GL features an expression system by which a list of strings indicating various methods can be passed to the library to indicate how input data should be converted and rendered. The style spec is available [here](https://docs.mapbox.com/mapbox-gl-js/style-spec/). This blog post is intended for individuals who are currently using the old expressions spec and want to convert over to the new expressions spec but have encountered difficulty successfully doing so.

Note that I am using Mapbox GL `v0.51.0` and `v0.52.0` (and tested later sections with `v0.53.0` and confirmed the following issues were present for those portions as well). I noticed in v0.53.0 behavior was different. It looks like the expressions behavior is very much in flux. I am writing this in the hopes of helping individuals who run into some of the errors Mapbox throws related to expressions on the right course.

## Background on GL JS

The current spec [documentation on their](https://docs.mapbox.com/mapbox-gl-js/style-spec/) site actually covers two versions of the expressions spec. This statement is accurate at the time of the publication of this blog post (mid-February). It does not differentiate between the two versions. If you attempt to mix the two versions (something you could inadvertently do if just following the online documentation), Mapbox GL will crash.

Here's an example. Let's say I have 2 squares that are saved as a GeoJSON. This GeoJSON looks like this (it is just 2 squares):

![geojsonio](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/gl_js_expressions/geojsonio.png)

Note that the same expression pattern is applicable to a vector tile source, which is also where expressions to handle a stream of data that we can't observe in its entirety at a single point are most useful.

I want to apply an extrusion, as well as color them, based on some attributes they hold in their feature properties. Here's the attributes made available:

{% highlight javascript %}
  "properties": {
  "foo": 10,
  "bar": 100,
  "color": "#add8e6"
}
{% endhighlight %}

In this example, I want to filter and extrude based on a combination of the attributes `foo` and `bar`.

How might I currently do this? Here is the layer paint and filter properties I might currently be using:

{% highlight javascript %}
map.addLayer({
  'id': 'room-extrusion',
  'type': 'fill-extrusion',
  'source': {
    'type': 'geojson',
    'data': './data.json'
  },
  'filter': ['in', 'foo', 10, 50],
  'paint': {
    'fill-extrusion-height': ['get', 'bar'],
    'fill-extrusion-color': ['get', 'color']
  }
});
{% endhighlight %}

In the above layer style, I do the following:

- Apply a filter to limit only the items being rendered to those where the `foo` attribute is a number in the set of valid values (which is 10, 50)
- Extruding based on the numeric value in the `bar` attribute
- Applying a color based on the color string value that is in the `color` attribute

This method works with the old expression patter. If you apply it to the GeoJSON I am using as an example, the result will look like this:

![originalexpression](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/gl_js_expressions/originalexpression.png)

## New Match expression pattern

Upgrading the above filter is pretty straightforward with the new expression patter. Instead of `['in', 'foo', 10, 50]`, you need to insted use the `match` operator, like so:

{% highlight javascript %}
['match', ['get', 'foo'], [10, 50], true, false]
{% endhighlight %}

But what about migrating older, more complex filters will be trickier to migrate. Let's say you have a complex filter logic that is generated through a series of helper functions, etc. All these need to be upgraded in tandem. Mapbox cannot handled "mixed" expressions. Here is an example.

Let's say that we have times where the `foo` attribute is `null` and we do not want to produce extrusions or render those geometries.

This would prove challenging with the old expressions patterns for a number of reasons. First, we can achieve that goal by using the "typeof" operator to make sure that the attribute type is indeed a number (as we are expecting it to be as the extrusion will use it).

With one of the attributes in the reference dataset updated to be value null, we will end up only rendering one geometry.

So, here is the updated value for the features of one geometry:

{% highlight javascript %}
"properties": {
  "foo": null,
  "bar": 50,
  "color": "#ffa500"
},
{% endhighlight %}

We can then update the filter, like so:

{% highlight javascript %}
'filter': ['==', ['typeof', ['get', 'foo']], 'number'],
{% endhighlight %}

The result looked like this, by adding the pruning step:

![pruned_first](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/gl_js_expressions/pruned_first.png)

Updating the filter to account for multiple parameters should be simple but nesting the original `==` operation inside of an `all` statement will throw an error. So this:

{% highlight javascript %}
'filter': [
  'all',
  ['!in', 'foo', 25, 50],
  ['has', 'foo'],
  ['==', ['typeof', ['get', 'foo']], 'number'],
],
{% endhighlight %}

Causes this error:

{% highlight javascript %}
Error: layers.room-extrusion.filter[3][1]: string expected, array found
{% endhighlight %}

The first two parameters will work fine, but nested arrays throws errors as this logic was somehow not threaded through the library.

At this point, the conclusion might be to try out the new expression pattern in the hope that this will work. We can construct that on its own, in isolation. The filter with `typeof` will now look like this:

{% highlight javascript %}
'filter': ['match', ['typeof', ['get', 'foo']], 'number', true, false],
{% endhighlight %}

Now, if we want to bring in the other original filters that were supposed to be within the `all` check, we get the following structure for the filter:

{% highlight javascript %}
'filter': [
  'all',
  ['!in', 'foo', 25, 50],
  ['has', 'foo'],
  ['match', ['typeof', ['get', 'foo']], 'number', true, false],
],
{% endhighlight %}

It will emit the following error:

{% highlight javascript %}
Error: layers.room-extrusion.filter[3][0]: expected one of [==, !=, >, >=, <, <=, in, !in, all, any, none, has, !has], "match" found
{% endhighlight %}

I found this error especially confusing. What is happening here is that Mapbox infers from the first arguments that the filter pattern is using an older expression pattern. As a result, it does not recognize `match`. So, you cannot just upgrade a single expression pattern; you must upgrade all of them at once.

We can achieve this by updating the filter's first parameters within the `all` to also use the new `match` pattern:

{% highlight javascript %}
'filter': [
  'all',
  ['match', ['get', 'foo'], [25, 50], false, true],
  ['has', 'foo'],
  ['match', ['typeof', ['get', 'foo']], 'number', true, false],
],
{% endhighlight %}

Note that the above error has also been confirmed as occuring in `v0.53.0` of Mapbox GL JS as well.

## Conclusion

The limited documentation and sort of "false advertising" around the new and old expression patterns being on the same spec page on the Mapbox site is extremely confusing. I'm hoping if you found this page it is because you were also searching for some of these obtuse errors that Mapbox emits without catching and explaining why and that this blog post can shed some light on what exactly is going on there.

Ultimately, a few extra sentences in the Mapbox style documentation would go a long way towards helping guide developers navigating the expressions pattern for the library.
