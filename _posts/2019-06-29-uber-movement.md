---
published: true
title: Extracting Uber Movement Data
layout: post
summary: Navigating extraction issues with CLI tool
comments: true
---

## Introduction

Uber has recently begun updating some of its cities that it has available on its Movement platform with speed data. There are a few US cities that have speed data available. At the time of this writing, there were 2 I noted - Cincinnati and New York City. Since NYC is tired and Cinci is a cool place that often gets overlooked, I wanted to extract data from there.

## Download options

The website offers a way to download CSVs with Movement ID pairs and a separate look up that pairs those Movement pairs to OSM id pairs. [Here](https://movement.uber.com/cities/new_york/downloads/speeds?lang=en-US&tp[y]=2018&tp[q]=4) is an example of the download options for a city. I think that SharedStreets is involved somewhere in that process - so, perhaps Movement ID pairs are related in some way to SharedStreets linearly referenced segment IDs and then those are then used to point to the OSM IDs. This seems plausible, but I have not spent enough time digging into the underlying logic to fully understand.

There is a technical blog post [here](https://www.sharedstreets.io/interoperable-speed-data-using-sharedstreets/) that I have been meaning to read by the SharedStreets folks on linking the Uber movement data outputs to SharedStreets to then pair with crash data. In that post it points to this [Node package](https://www.npmjs.com/package/sharedstreets-speeds?activeTab=dependencies) which I thought might be on Github, [and it is](https://github.com/sharedstreets/sharedstreets-speeds), but it doesn't have nay actually code in it. So, I assume that this post is not suggesting that the shapes from Uber are just being matched to the reference SS shapes, but I think I would need to spend more time reading and researching to better understand.

All of this is to say, the download options can be confusing.

## Command line toolkit

Fortunately, there is a toolkit called `mdt` that is also offered, via `npm`, for [download](https://www.npmjs.com/package/movement-data-toolkit). The `README` offers sufficient details to allow me to understand what I need to do to pull down a project, even providing an example script to run in the command line that is exactly what I want:

{% highlight bash %}
mdt speeds-to-geojson cincinnati 2018-01-01 2018-01-31 > my-output-file.geojson
{% endhighlight %}


The only thing I wanted to do was look at a more typical month, so I picked September instead and set the time frame as: `2018-09-01 2018-09-29`.

I now had the following one line operation:

{% highlight bash %}
mdt speeds-to-geojson cincinnati 2018-09-01 2018-09-29 > processed_cinci.geojson
{% endhighlight %}

## Errors during execution

Running this unfortunately resulted in an error.

First, the OSM ID mappings (so I think this was downloading pairings from the Movement IDs to OSM ID pairs) worked fine:

{% highlight bash %}
🔍 Movement to OSM ID mappings
    Downloading movement-segments-to-osm-ways-cincinnati-2018.csv... done (already cached)
    Downloading movement-junctions-to-osm-nodes-cincinnati-2018.csv... done (already cached)
{% endhighlight %}

Next, a JSON of the whole Cinci road network downloaded successfully:

{% highlight bash %}
🗺  Road Geometries
    Downloading movement-osm-geometries-cincinnati-2018.json... done (already cached)
{% endhighlight %}

All related speed data also came through (this I imagine would be small, just sets or float values with id pairings):

{% highlight bash %}
🚗 Hourly Speeds Data
    Downloading movement-speeds-hourly-cincinnati-2018-9.csv... done (already cached)
    Aggregating movement-speeds-hourly-cincinnati-2018-9.csv... done
🏎  Freeflow Speeds Data
    Downloading movement-speeds-quarterly-by-hod-cincinnati-2018-Q3.csv... done (already cached)
    Aggregating movement-speeds-quarterly-by-hod-cincinnati-2018-Q3.csv... done
{% endhighlight %}

What I believe remains to be executed is the mapping of this street speed data to the appropriate GeoJSON line string geometry based on the Movement ID to OSM ID pairings:

{% highlight bash %}
🏗  Building output geojson... done
{% endhighlight %}

Unfortunately, the following error was thrown after the previous line was emitted:

{% highlight bash %}
FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory
 1: 0x100063a65 node::Abort() [/Users/kuan/.nvm/versions/node/v11.6.0/bin/node]
 2: 0x100064104 node::errors::TryCatchScope::~TryCatchScope() [/Users/kuan/.nvm/versions/node/v11.6.0/bin/node]
 3: 0x10019d9a7 v8::Utils::ReportOOMFailure(v8::internal::Isolate*, char const*, bool) [/Users/kuan/.nvm/versions/node/v11.6.0/bin/node]
 4: 0x10019d944 v8::internal::V8::FatalProcessOutOfMemory(v8::internal::Isolate*, char const*, bool) [/Users/kuan/.nvm/versions/node/v11.6.0/bin/node]
 5: 0x1005a2122 v8::internal::Heap::FatalProcessOutOfMemory(char const*) [/Users/kuan/.nvm/versions/node/v11.6.0/bin/node]
 6: 0x1005ab704 v8::internal::Heap::AllocateRawWithRetryOrFail(int, v8::internal::AllocationSpace, v8::internal::AllocationAlignment) [/Users/kuan/.nvm/versions/node/v11.6.0/bin/node]
 7: 0x10057d4f4 v8::internal::Factory::NewRawTwoByteString(int, v8::internal::PretenureFlag) [/Users/kuan/.nvm/versions/node/v11.6.0/bin/node]
 8: 0x1006c44fa v8::internal::String::SlowFlatten(v8::internal::Isolate*, v8::internal::Handle<v8::internal::ConsString>, v8::internal::PretenureFlag) [/Users/kuan/.nvm/versions/node/v11.6.0/bin/node]
 9: 0x1001ba689 v8::String::Utf8Length(v8::Isolate*) const [/Users/kuan/.nvm/versions/node/v11.6.0/bin/node]
10: 0x10004e110 node::Buffer::(anonymous namespace)::ByteLengthUtf8(v8::FunctionCallbackInfo<v8::Value> const&) [/Users/kuan/.nvm/versions/node/v11.6.0/bin/node]
11: 0x100224b27 v8::internal::FunctionCallbackArguments::Call(v8::internal::CallHandlerInfo*) [/Users/kuan/.nvm/versions/node/v11.6.0/bin/node]
12: 0x1002240f6 v8::internal::MaybeHandle<v8::internal::Object> v8::internal::(anonymous namespace)::HandleApiCallHelper<false>(v8::internal::Isolate*, v8::internal::Handle<v8::internal::HeapObject>, v8::internal::Handle<v8::internal::HeapObject>, v8::internal::Handle<v8::internal::FunctionTemplateInfo>, v8::internal::Handle<v8::internal::Object>, v8::internal::BuiltinArguments) [/Users/kuan/.nvm/versions/node/v11.6.0/bin/node]
13: 0x1002237f0 v8::internal::Builtin_Impl_HandleApiCall(v8::internal::BuiltinArguments, v8::internal::Isolate*) [/Users/kuan/.nvm/versions/node/v11.6.0/bin/node]
14: 0x2ec970f4fb7d
15: 0x2ec970f0e458
[1]    73318 abort      mdt speeds-to-geojson cincinnati 2018-09-01 2018-09-29 >
{% endhighlight %}

I have 32 GB of memory available on my local machine, with a little more than half allocated to Docker. I noticed that my memory pressure in my Activity Monitor never really moved above 25% or so. On the off chance Docker was consuming too many resources, I turned it off and reran the operation. Again, it failed.

Again, without digging into the library being used here I was not able to figure out where the memory issue was. I suspect there may be an issue with the library itself...

At any rate: I was surprised that this was happening - I assume if it was able to download any of those files that preceded the reconciliation operation (moving Movement data into the GeoJSON), it should be able to do the last part fine.

I acknowledge that compiling the whole of the Cinci area as a GeoJSON is not the most appropriate format for this use case, but it should work (albeit be a really large output).

After running into this for awhile, I decided to see if I could download a small portion of the total site. Klokan Tech has a handy bounding box tool [here](https://boundingbox.klokantech.com/). I used it to start with just a small bounding box around downtown.

The command looked like:

{% highlight bash %}
mdt speeds-to-geojson cincinnati 2018-09-01 2018-09-29 > processed_cinci.geojson --bbox="-84.5152863688,39.1003650831,-84.5076341185,39.1059432862"
{% endhighlight %}

The file size was only `118K`. This was just a few blocks in the downtown area.

I then increased the bounding box to include the downtown up to the Clifton neighborhood north of uptown. This time, the resulting GeoJSON is `4.4M`.

I then went and upped the ante by trying everything within the I-275 beltway (which is most of urbanized Cinci). The resulting file size was `59M`. This was a pretty big GeoJSON, but still not an unreasonably large file size.

I then wen and increased the size far beyond the beltway and out to Monroe and Lebanon to the north (almost halfway to Dayton, OH) and south to Alexandria. At this point we are encompassing the whole Cinci metro area. This was `117M`. Again, I don't see this being enough to cause node to crash the way it did.

Finally, I made a massive bounding box that covers all of Lexington, KY and north straight past Dayton, OH. At this point, the error occurred again:

{% highlight bash %}
FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory
{% endhighlight %}

So, it does appear to be a consequence of the area being considered. That said, it also does seem to be the case that the helper utility might be erring in some way that could be preventable, given the limited memory pressure being observed while the operation is running.