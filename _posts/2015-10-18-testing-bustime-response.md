---
published: true
title: Bustime API latency and cached returns
layout: post
summary: Analyzing rate limitations on Bustime API
---


I wanted to see what the difference was in the way the Bustime API returns data requests when asking for the position of all in field vehicles via the `'http://api.prod.obanyc.com/api/siri/vehicle-monitoring.json?key=` endpoint. I had a standard set up with a simple Node app making the same call every thirty seconds and storing the results as CSVs. The method for performing this is as shown below. I wanted to see if starting that 30 second countdown to the subsequent call after I had received the response would change the number of redundant points. I wanted to run both for the same amount of time, 10 minutes, and see which method returned more unique rows.

{% highlight javascript %}
// run this every 30 seconds
function run (alt) {
	requestWithEncoding(url, function(err, data) {
		// if alt method start timer for next call now
		if (alt == true && intervalGlobal == true) {
			setTimeout(function () { run(true); }, 30000);
		}

		if (err) {
			var t = new Date(Date.now()).toISOString().split('T');
			console.log('Error on request at day ' + t[0] + ' at time ' + t[1] + '. Error: ', err);
		} else {
			var vehicles = processVehs(data);

			// convert each obj in array to a list/array
			vehicles = vehicles.map(function (veh) {
				var keys = Object.keys(veh);
				var res = []
				keys.forEach(function (key) {
					res.push(veh[key]);
				});
				return res;
			}); 
			
			csvBundler(vehicles);
		}
	})
}
{% endhighlight %}

In order to improve the accuracy of the test, I had Nathan run the operations on his computer as well. In order to compare our two computers adn to compare the two strategies we created two methods. The first method (shown below), was run such that `run()` was called every 30 seconds, regardless of returned results from Bustime. 

{% highlight javascript %}
console.log('Starting operation.')
intervalGlobal = setInterval(function () { run(false); }, 30000);
setTimeout(function () {
	clearInterval(intervalGlobal);
	console.log('Finished operation.');
}, 600000);
{% endhighlight %}

The second, shown below this paragraph, was called 30 seconds AFTER the last call was returned. The manner in which this method was structured is as shown below. In both the prior method and this one, we set our measure time to 10 minutes, which should generate roughly 20 files/calls to MTA's Bustime application. The plan for the tests was to have one person run one method while the other the second and then, on the second run, two each switch which test each person was running and compare results at the conclusion of the operation.

{% highlight javascript %}
console.log('Starting operation.');
run(true);
intervalGlobal = true;
setTimeout(function () {
	intervalGlobal = false;
	console.log('Finished operation.');
}, 600000);
{% endhighlight %}

In order to compare our two computers and our connections, Nathan and I both ran the first method together. The results were intended to determine if there was any significant difference between the number of unique responses I retrieved and the number of unique responses Nathan retrieved upon running the tool for ten minutes. On running this method 1, both, for the same 10 minutes period of time, a difference was indeed observed. I (Kuan) received 18,977 unique row values and Nathan received 19,351 unique row values. This was a sub-2% variability in response data. Since method one mandates a call on every 30 second period, both of us received 19 responses (and thus 19 csv's were downloaded). We expect that method two will result in less csv's (though, perhaps, more unqiue results because of the potential for cached or same results to be returned when hitting up the API every 30 seconds).

We should note that we performed this test between 12:30 PM and 2:00 PM on Sunday, October 18, 2015. There is a likely possibility that variation between method one and method 2 might be minimized due to both the reduced number of buses running nad due to the possibility of less of a load on the Bustime API in terms of requests being submitted. That said, the results are as follows for the 2 tests: The first run involved Nathan running method one while I (Kuan) ran method 2. Nathan received 20,641 unique rows while I (Kuan) recieved 21,740 unique rows. This time, the difference between the two results was greater than 5%, and in method 2's favor. Furthermore, results were against me in the method one compare test, suggesting that the improvements on method two over method one were greater than just five percent. In order to explore further, Nathan was to run method two on the next test and I method one. We expected results to exhibit even a greater difference than in the second test, to the favor of method two.

In the third test, results were suprising. Nathan got 21,349 and I (Kuan) got 21,271. The difference was a third of one percent or, essentially, null. Nathan was running method two and I was running method one. It was expected that Nathan's results would involve significantly more unique entries than my method. Results for all three tests are shown below. Code used to run the tests is held at [this repository on Github](https://github.com/Bus-Data-NYC/mta-bus-monitor-node). Operations were run via `app.js` and calculation on results were performed using the `calcUniques.js` tool, which returned a number representing the number of unique rows resulting from a test run.

Test 1:
Kuan B <Method 1>: 19 files, 18,977 unique entries
Nathan <Method 1>: 19 files, 19,351 unqiue entries

Test 2:
Kuan B <Method 2>: 19 files, 21,740 unique entries
Nathan <Method 1>: 19 files, 20,641 unqiue entries

Test 3:
Kuan B <Method 1>: 19 files, 21,271 unique entries
Nathan <Method 2>: 19 files, 21,349 unqiue entries

Results raised some questions. Why had the first test returned on ~19 thousand entries and the second and third ~21 thousand entries? Furthermore, what had happened that caused Nathan to net only marginally more responses than I when he ran method two and I method one? Finally, was there a better way to make the second call in method one?

Nathan posited that, perhaps, we could try and make the call at the first element that was returned from the Bustime API rather than at the callback point provided by the `request` library's function in Node. The below method demonstrates how I broke down the `request` into a stream that would allow for the callback to be run at the very moment a first response was sent rather than at the conclusion of the entire streaming process of information returned by the Bustime API. I moved the `run()` function into the first portion of the `response` handler in request.

{% highlight javascript %}
var req = request.get(options);
req.on('response', function(res) {
	// if alt method start timer for next call now
	if (intervalGlobal == true) {
		setTimeout(function () { run(true); }, 30000);
	}

	var chunks = [];
	res.on('data', function(chunk) {
		chunks.push(chunk);
	});

	res.on('end', function() {
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
req.on('error', function(err) {
	callback(err);
});
{% endhighlight %}

I then ran the tool again, for another 10 minutes, to observe if there was any significant difference. The thought was that this might marginally beat out prior results, though I think the nuance at this level might be hard to observe, particularly at ten minute intervals. Nonetheless, it was worth a try just to learn more about the mechanics of the Bustime API. The results of this test were as follows:

Test 4:
Kuan B <Method 3>: 20 files, 19,282 unique entries

It appears results were back to the ~19 thousand entry range. Comparisons to the prior results are difficulat at this point. It's hard to say anything more at this point, I think the best move will be to rerun these tests later, preferably during a peak period on a weekday, when variation is likely to be more clear and hypothesis can be better tested.





