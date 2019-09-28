---
published: true
title: Geoprocessing of vector tile data
layout: post
summary: Centroid-based extrusion of a complex geometric reference layer
comments: true
---

<iframe style="width:100%; height:300px;" src="http://kuanbutts.com/vector_centroids_example/"></iframe>
Scroll around to explore extruded layers example.

## Introduction

Intent of this post is to demonstrate how to handle a vector tile data source and apply a centroid-based extrusion.

With MapBox GL JS, extrusion on a vector layer by a numeric value available by a consistent key in the properties object of the GeoJSON representation of a given feature geometry is possible. Under the `paint` options when adding a given layer source, one can specify extrusion based on a property key.

![full_prcl_extrude](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/mbgl_centroid_extrude/full_prcl_extrude.png)

The result will extrude as shown above. Each geometry is extruded based on the geometry the data is paired with. The layer `paint` parameters to achieve this are shown below.

{% highlight javascript %}
map.addLayer({
    'id': 'parcels',
    'type': 'fill-extrusion',
    'source': {
        type: 'vector',
        url: 'mapbox://some-id-here'
    },
    'source-layer': 'sample_parcels',
    'layout': {},
    'paint': {
        'fill-extrusion-color': [
            'interpolate',
            ['linear'],
            ['get', targetVariable],
            ...breaksRules,  // list of numeric breaks and the colors associated with each
        ],
        'fill-extrusion-height': ['get', targetVariable],
    }
});

{% endhighlight %}

## Issues with extruding whole geometries

While extruding on geometries may look fine, the irregularity in their size and shape (in the case of much geodata) can make visualizations confusing.

![extrude_awk_example](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/mbgl_centroid_extrude/extrude_awk_example.png)

Above is an example of parcel data, where some parcel shapes are much larger, physically, than others. As a result, extrusion can result in strange or disruptive visual patterns that make data communication sub-optimal.

So - the challenge is to perform extrusions based off a single representative point. From this point, a small circle can be extruded, thereby guaranteeing a clean and standard extrusion shape.

## Finding centroids

Geoprocessing in the frontend is made possible with [Turf](https://turfjs.org/), a JS library that works with geometries in the GeoJSON format to perform operation, included getting centroids and buffering shapes.

{% highlight javascript %}
turf.buffer(turf.centroid(targetGeometry), 50, {units: 'feet'})
{% endhighlight %}

Performing gathering a centroid and buffering a geometry is a straightforward operation. If the entire GeoJSON is loaded into memory, before adding a new layer to the Mapbox map, a step where each geometry is mapped over and the above operation is made, converting a single point to a representative circle around the centroid of the original point can be performed.

## Geoprocessing vector tile source data

While geoprocessing a full GeoJSON feature collection that is held in memory in the browser is straightforward. The question arises as to how to perform this, but on geodata sourced via a vector tile source.

{% highlight javascript %}
function getVisibleParcelData(map) {
    return map.queryRenderedFeatures(
        {layers: ['parcels'], validate: false});
}
{% endhighlight %}

To do this, Mapbox provides a convenience method: `map.queryRenderedFeatures`. A variety of params can be passed. Since a map will have multiple layers and, therefore, multiple geometries present and rendered at once, using the layers key and filtering to just the source layer id for the vector tile set desired can dramatically limit the features that are returned. Another optimization on larger datasets is to turn off validation (safest to avoid using only if you are consuming your own, cleaned and curated geodata).

The resulting list can be passed into a feature collection and then used to reset the source layer's data when, say, pan or pitch of the map is updated.

Here's a rough code snippet of how this might be done (note the application of a heuristic to limit redraws if they are not needed):

{% highlight javascript %}
// on a regular basis, when user moves, add more coordinates
// from the saved list and update the map
map.on('moveend', event => {
    // quick and dirty guesstimate that the visible set of geometries
    // hasn't changed (and if it hasn't no need to recompute centroids)
    const vpd = getVisibleParcelData(map);
    if (vpd.length === parcelCs['features'].length) {
    } else {
        parcelCs['features'] = updateCentroidsSet(map);
        map.getSource('centroids').setData(parcelCs);
    }
});
{% endhighlight %}

You can explore the full result of this example on [this gh-pages](http://kuanbutts.com/vector_centroids_example/).