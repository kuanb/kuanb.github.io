---
published: true
title: Follow-up on Bustime API latency tests
layout: post
summary: Final results on testing for optimum 30 second setTimeout
---


I wanted to see what the difference was in the way the Bustime API returns data requests when asking for the position of all in field vehicles via the `'http://api.prod.obanyc.com/api/siri/vehicle-monitoring.json?key=` endpoint. In order to do this, I set up a series of test to explore the different points at which the callback could occur - an in-depth discussion of the test and early results is discussed in the blog post prior to this one. The purpose of this post is to simply report on what the best point is to kick in the 30 second timeout to make the subsequent MTA OBA API call. The purpose for this optimization is that calling too early will return a cached result from your prior call (thus reducing the amount of data you are gleaning my as much as half) and calling too late results in "giving up" a couple of calls an hour which, in time, can add up if you are trying to create a highly detailing repository of bus location data (as I am).

An overview of the modified `request` method is shown in the below code. The purpose of this is to test a series of methods (other than method 0, which, as discussed in the prior blog post, was a dumb call at 30 second intervals without regard to prior request responses).

{% highlight javascript %}
req.on('response', function(res) {
	// if method start timer for next call now
	if (method == 1 && intervalGlobal == true)
		setTimeout(function () { runCall(method); }, 30000);

	var chunks = [],
			firstChunk = true;
	res.on('data', function(chunk) {
		// if method start timer for next call now
		if (method == 2 && intervalGlobal == true && firstChunk == true) {
			firstChunk = false;
			setTimeout(function () { runCall(method); }, 30000);
		}

		chunks.push(chunk);
	});

	res.on('end', function() {
		if (method == 3 && intervalGlobal == true)
			setTimeout(function () { runCall(method); }, 30000);
		var buffer = Buffer.concat(chunks);
		var encoding = res.headers['content-encoding'];
		if (encoding == 'gzip') {
			zlib.gunzip(buffer, function(err, decoded) {
				callback(err, decoded && decoded.toString());
			});
		} else if (encoding == 'deflate') {
			zlib.inflate(buffer, function(err, decoded) {
				callback(err, decoded && decoded.toString());
			})
		} else {
			callback(null, buffer.toString());
		}
	});
});
{% endhighlight %}

From the above code snippet you should be able to see that there are 3 points where the call can occur within the request method:

1: run 30 seconds after first response from Bustime API

2: run 30 seconds after first portion of streamed data from Bustime API

3: run this 30 seconds in callback (totally complete response)


During peak hours (4:30 PM on a weekday through the evening), method 1 was pulling nearly 380,000 unique rows of results per hour while method 2 and 3 pulled ~3% less. As a result of these tests, mta-bus-monitor-node will employ method 1 in the operations strategy for scraping from the OBA web API to build out MTA bus location data set. It seems that the process of streaming occured relatively quickly and differences between method 2 and 3 were minor.




