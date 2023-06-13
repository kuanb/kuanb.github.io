---
published: true
title: Full stack map control
layout: post
summary: Self-service tiling and webmap app from Github Pages
comments: true
---

# Introduction

I went to State of the Map US this past weekend in Richmond, VA and learned more about [Protomaps](https://protomaps.com/) which makes self-serving your own static map tiles dead simple. This is the area of the web mapping ecosystem I am furthest away from, so I often rely on 3rd party vendors (as do most), such as Mapbox or Maptiler. Protomaps makes it possible to control this component and generate tiles from a PBF I own/manipulated and serve it all from, for example, the same Github page that I might be hosting my simple site under.

The Protomaps website contains sufficient document, I will just make some notes about gotchas that I hit when working on this to get up and running under my personal website `kuanbutts.com`. The reference repository for this work is on Github [here](https://github.com/kuanb/pm-maps-oak).

<iframe src="https://kuanbutts.com/pm-maps-oak/" height="500px" width="100%" title="Example Protomaps on a Github Page"></iframe>

## Generate PMTiles

Protomaps uses a vector tile format called [PMTiles](https://protomaps.com/docs/pmtiles). It has nifty features that allows the API to use [HTTP range requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests) to query a single file containg the compressed basemap information.

Simple PMTiles for a custom area can be generated with [this offered PMTiles service](https://app.protomaps.com/downloads/small_map) from Protomaps. Working with a Shapefile or some other custom data source? PM allows for export from Tippecanoe to PMTiles.

For me, I downloaded a bounding box around Oakland from the simple PM service and the resulting file was about 15mb. PM will extend the map rendering functionality to support HTTP range requests thereby enabling a direct query from the map rendering engine to the single hosted PMTile.

![pmtileviewer](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/protomaps-gh-pages/pmtilesviewer.png)

Protomaps also provides a [tile inspector](https://protomaps.github.io/PMTiles/?url=https%3A%2F%2Fkuanbutts.com%2Fpm-maps-oak%2Foakland.pmtiles#map=11.48/37.798/-122.2457) that will load the exported PMTiles into a viewport that will help to expose the various layer and contents that have been packaged up. If further file size efficiency is desired; this is a great tool with which to additionally trim down the pacakged OSM data to just what is needed for a specific use case.

## Hosting locally for development

Once you have your PMTile file, you can start a simple SPA React app with the `create-react-app` command. I then chose to place the file within the `public/` directory so that published builds would roll up and deliver the file to Github published static sites. You can see the file there [here](https://github.com/kuanb/pm-maps-oak/blob/main/public). This also prevents gotchas where the file is requested from the `main/` branch but your personal site has a custom domain, which will cause a CORS cross-domain request headache.

Once held in a steady location, use your desired method to serve the file over local host (for ex: `python -m http.server` or with JS: `http-server . -p 8020 --cors`).

## Rendering the map

Once a simple app has been created, a `Map` component can be introduced to the main `App.js` [script](https://github.com/kuanb/pm-maps-oak/blob/main/src/App.js). The entirety of the map-from-local-Github-pages-files concept will be encapsulated in that new `Map` [component](https://github.com/kuanb/pm-maps-oak/blob/main/src/components/map.js).

First, a conditional for development vs. deploy needs to be set so that when published, we can read from appropriate endpoint:

```js
const basePmUrl = process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:8080/public' : 'https://kuanbutts.com/pm-maps-oak';
```

Next, we will create a new instance of a MapLibre map instance. However, before we do that, there is a configuration setting that needs to be set:

```js
import { Protocol } from 'pmtiles';
import layers from 'protomaps-themes-base';

let protocol = new Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);
```

This added protocol will allow Protomaps to query with the aforementioned range requests. Once set, all that is left to do is to create a new MapLibre map instance with the requisite style settings for Protomaps + MapLibre to use to query from the static file (instead of a traditional tiling service):

```js
new maplibregl.Map({
  container: mapContainer.current,
  style: {
    version: 8,
    glyphs:'https://cdn.protomaps.com/fonts/pbf/{fontstack}/{range}.pbf',
    sources: {
      protomaps: {
            type: 'vector',
            url: `pmtiles://${basePmUrl}/oakland.pmtiles`,
            attribution: '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>'
        }
    },
    layers: layers('protomaps', 'light')
  },
  center: [lng, lat],
  zoom: zoom,
  maxBounds: [[-122.36159, 37.71505], [-122.12976, 37.88092]]
});
```

## Conclusion

That's about it. The simple web site is up on Github [here](https://github.com/kuanb/pm-maps-oak/tree/main). The webapp queries the PMTiles raw file, which is exposed via the `public/` bucket in the final custom domain/path endpoint the same as the rest of the site JS, static files. With this pattern, I am able to publish a simple website without any external resource requirements outside what is delivered and available from the single site.
