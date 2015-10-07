---
published: true
title: MTA bus route shapefiles via Bustime site
layout: post
summary: Utilizing the One Bus Away toolkit to decode polyline strings from MTA web data
---

I've recently been trying to create a tool that determines the most likely route of a vehicle from an unsorted cloud of latitude/longitude pairs. The purpose was to mash together existing shapefiles associated with each route that the MTA has to form the complete route. You can read more about this in my preceding blog posts. What this post is about is how to use the MTA itself to pull a shapefile for a given bus route. This post is also intended to be a resource for those seeking to pull bus shapefiles for any route from the MTA. 

The reason for pulling from the MTA online rather than using those associated with the shapefiles is written about in detail in prior posts. The general issue is that the shapes provided with the GTFS data are fragmented and, if one just wants a sort of "de facto" route for a given bus line, it is definitely easier to just default to the one that is provided from the MTA when you visit a given route.

The MTA actually has some handy API functionality (though I have yet to find some decent documentation for it). The URL `http://bustime.mta.info/api/search?q=*****` allows you to enter in a given bus route (marked in the example by `****`) and receive a JSON such as in the below.

{% highlight javascript %}
{"searchResults":{"empty":false,"matches":[{"color":"EE352E","description":"via 125th St \/ Astoria Blvd","directions":[{"destination":"LA GUARDIA AIRPORT","directionId":"0","hasUpcomingScheduledService":true,"polylines":["kb`xFjymbMm@CUCeAMkA[KCqBsAwBwAcC_B}ByA}B{A{B{A}B{AoBoAUQgG}D{B{AuBuAfFePy@i@kAw@{ByA_C}AmGcEc@YsBuAhI}GfAeDvB{Gd@yAnAaEfBsF`CsHL_@zA{E\\mAHO\\gAHO\\kAX}@HYb@uAdF_PfCcI^kAzAwE?AVu@?AzBgH^iAfBuFjD{KNc@FOxA_AvByGn@qBX{@^oAJcAJmB~@yCL_@lA{DJ[rBqGv@oB`AyB^qAf@yAz@gBJWN]pAkCDWT}@t@q@|@m@f@Ov@Ez@N~BrAfNtIbAd@f@\\xHpGh@b@nYhVh@\\zAn@fAVpANdB?zAOv@Qn@Yf@UlCeB|p@ce@fA{@v@w@rAaBp@}@hG{JxBaD|@q@ZOxBeDRYP]PYFM\\_ARu@XH^aE`@aEZeE^aE^cE^iEB[X_D\\cEX{CDe@BQXkDXeDF[NaALsAr@eCPgAJgA@c@A_EBaAL_Bf@mG|Cq\\n@uGV_Cn@gDTeD@aAH_BF{@^yDc@u@Q_@Wa@a@s@Qq@a@eDCY@iAMi@?e@Im@]oCkAkJa@wD]wDMiAQkBa@{DSyDSuDSyDQyDUaESBy@HsANa@AuB{@[IkBBCUS@oBEe@@iDl@q@HOB]@YIs@{@Yk@IYUc@AC[w@McAFa@NYt@c@`@Yf@e@`@o@Na@N_ALm@Ju@LgDFoAB}B@O?C?A@QDq@^uA?GhDeIdAuBHQHON[LYXk@fA}Bz@wATm@Tc@\\o@NUd@c@lAu@vAoAp@w@vAwANQLQRc@Ji@a@kGO_@e@o@USQEM@WLQTAHa@n@"],"stops":null},{"destination":"WEST SIDE BWAY - 106 ST","directionId":"1","hasUpcomingScheduledService":true,"polylines":["erywFtdyaMmAlBIT?n@EV}@zAa@z@]L]FEDE@ONuBhDwC`FCDs@hAsA|BOZcB|CGJk@jAuA`DGR?p@BVFv@Cp@?DO^SXADUZKJWJMVKNUZIXGLMj@QlAANAbA@ZB^@PJ`ADTXrAFLPNB@@H@LFf@@f@On@^VVXJTTVZv@Vf@HXXj@r@z@XH\\ANCp@IBXN`AJt@XhAx@jBRj@`CdF^ZbIjQv@pBdBjFx@pCl@bCBdBFjA^rCb@pCH\\XfBd@tD^tDJtABVBjA@f@QvCIlAATG`A?Z@zDA|DGzAOdB]bEY`EY`Es@fIa@|Ec@|Ec@tEAD?BQt@cAfBOvAAL?b@It@g@bGc@xEOvAGr@KpAUdCMzAc@dFGx@QtC_@fE_@`Ek@|GGn@WvAEp@ELe@x@QZOX_@j@CBa@j@u@lA[fAQf@ETiB~CcF`IgBjCeAjAq@n@wBdBaHxEwWzQwQdMiAf@_AV{@LgADyAEiAQkA_@}Ay@i[{WiAaAgEkDiD_D??a@w@iEkFwIeKi@o@a@WMG]Iq@Be@L_@XOTCDMb@I^StDQlAGz@cCjHIP?@ABUl@cA`Ca@nAeBbHoBhGKXmA|DM\\_AtCqA|A]n@aBjFsBlG?j@BfBGNg@|AsC`JgC~H_@jA{AzE?@Wt@?@{BbHa@pAeBpFiGtRIXY|@IXSp@IN]fAIN]lA{AzEM^aCrHgBrFe@zAoA~DwBzGgAdDiI|GlBpAh@\\lGbE~B|AzBxAdBjA^TgFdPOd@x@h@z@j@|BzAbG|D\\TfBjA~BzAzBzA|BzA|BzA`C|AxBvApBrAJDLDpBpAFBpBnAPF\\mA","iszwFbs{aMCd@BVD^r@lB|@fBPPb@^Br@FZbBpB`A|@p@l@n@v@v@dCz@zBHVVj@~AtCHR~BhDh@bAXj@`A~Bn@bB`ClHDT@d@Ih@aAhCW`@UROLWT{@x@QJa@L_Ff@_A\\yExA[FG?cBDkBTe@CSIa@YM[Co@VCQmD|AQ^i@LLJBX?ZEn@GtBSNGPOh@{@REzBUx@K`BOPFbE`DTVDLJZf@tIBDTVpE}@TE","}v`xF|fhbM[`A_B`F"],"stops":null}],"id":"MTA NYCT_M60+","longName":"LaGuardia Airport - West Side","shortName":"M60-SBS"}],"queryLat":null,"queryLon":null,"resultType":"RouteResult","routeFilter":[],"suggestions":[]}}
{% endhighlight %}

The part that matters from that example is the key `polylines`. This key's value is an encoded string that, when run through One Bus Away's OBA decode utility, produces a latitude/longitude array that can be used as a lineString GeoJSON. The portion of the OBA utility that performs this action is called `decodePolyline`. I went ahead and extracted and cleaned it up - it's included in the below code snippet.

{% highlight javascript %}
var decodePolyline = function(encoded) {
  var len = encoded.length,
  		index = 0,
  		array = [],
  		lat = 0,
  		lng = 0;

  while (index < len) {
    var b,
    		shift = 0,
    		result = 0;
    
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    var dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    var dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    array.push([lat * 1e-5, lng * 1e-5]);
  }

  return array;
}
{% endhighlight %}

This tool is pretty useful. I wrote a simple Node app that takes the name of the bus route. You don't even need the exact name - MTA guesses which it is and gives you suggestions. It's decent; if you put in any variation of, say "M60" (such as "m60" or "M60-sbs") and it will return the M60 bus line information. In the below `server.js` code I just made a simple Node app that takes the bus route name that you want and it reconfigures the JSON supplied by MTA with the actual latitude/longitudes instead of the polyline encoded string value. The code for this tool is included in the below snippet. Just make sure to include the defintion for the `decodePolyline` function, as well, and it should be good to go.

{% highlight javascript %}
var express = require('express');
var app = express();

var fs = require('fs');
var request = require('request');

app.get('/route/:route', function(req, res){
  var busRoute = req.params.route;

  if (busRoute == undefined)
    res.status(400).send(Error('No bus route included.'));

  var url = 'http://bustime.mta.info/api/search?q=' + busRoute;

  request(url, function(error, response, data){
    if(error){
      res.status(500).send(response);
    } else {
      var data = JSON.parse(data).searchResults;

      if (data.empty) {
        res.status(500).send({error: error, response: response});
      } else {
        var route = data.matches[0];

        route.directions[0].shape = [];
        route.directions[1].shape = [];

        route.directions[0].polylines.forEach(function (pl, i) {
          route.directions[0].shape.push(decodePolyline(pl));
        });

        route.directions[1].polylines.forEach(function (pl, i) {
          route.directions[1].shape.push(decodePolyline(pl));
        });

        res.status(200).send(data);
      }
    }
  });
})

app.listen('8080')
console.log('Up and running on port 8080...');

exports = module.exports = app;
{% endhighlight %}
