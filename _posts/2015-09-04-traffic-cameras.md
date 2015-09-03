---
published: true
title: Extracting data from traffic cameras (Part 1)
layout: post
summary: Notes on early process of obtaining and processing NYC DOT traffic camera image streams
---

This is part 1 of a 2 (maybe more?) series of posts on my exploration of traffic camera data from NYC DOT.

Recently, I’ve been looking into what I’ll call “non-explicit” data resources. By that, I mean that there is a lot of data out there that is not cleaned and prepared for a specific purpose, although it might be tangentially relevant. Thus, some labor must be invested to access the relevant aspect of this data. An example of this are traffic cameras. As I was floating around NYC’s data offerings, I came across the NYCDOT traffic camera page. Through this page, one can easily acquire a list of url endpoints for each camera feed and limited metadata, including latitude, longitude, and a name indicating the approximate location or intersection at which the camera has been placed. Here’s an example of a JSON representing the data for a single camera:

{% highlight javascript %}
{
  "lat": "40.75492947089871",
  "lng": "-74.00180339813232",
  "name": "11 Ave @ 34 ST",
  "camera": "http://207.251.86.238/cctv200.jpg"
}
{% endhighlight %}

Hitting up that endpoint returns a .jpg with the the latest image taken from that camera. It appears that the cameras provide updates at a pretty decent clip; cameras that I have played with appear to be updating every three seconds or so. Below is an example of the output from the camera used in the above JSON, facing north of 11th Avenue, with the Javits Center on the left side of the image and the Hudson Yards construction on the right.

![cctv200](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/traffic-cameras/cctv200.png)

Upon exploring this data, I became curious to see if I could extract some vehicle data from this resource. In order to this, my thought it is, I first need to determine a sort of base case. My first thought was to find and submit a clear or empty road and to use that as a difference by which to compare any given image. The problem with that approach is that changes like lighting and weather throughout the day made calculating differences prohibitively difficult. For example, an empty road on a sunny day and one in the evening would be effectively too different to perform any sort of useful evaluation.

As a result, I decided I needed to perform a sort of “on the fly” calculation, creating a current base case. A current base case would need to be an empty road at that given time of day, replete with its current lighting and weather conditions. The result meant that I needed to somehow use the most recent images to calculate a base scenario image. In order to achieve this, I built a median value calculator that iterates through the most recent n images and calculates the median pixel RGB value for each pixel given an array of images of equal pixel width and height.

I used OpenCV, a computer vision library, to handle each image as an object, which allowed me to iterate and calculate a median value for each pixel in each image. The core mechanic for this method was really quite simple and is shown below.

{% highlight python %}
for c in col:
  for r in row:
    eachImageVals = {"r": [], "b": [], "g":[]}
    for img in allPhotos:
      vals = img[c,r]
      eachImageVals["r"].append(vals[0])
      eachImageVals["b"].append(vals[1])
      eachImageVals["g"].append(vals[2])
    for v in eachImageVals:
      eachImageVals[v] = np.median(np.array(eachImageVals[v]))
      eachImageVals[v] = math.trunc(eachImageVals[v])
    allPhotos[0][c,r] = [eachImageVals["r"],eachImageVals["g"],eachImageVals["b"]]
{% endhighlight %}

![6shots](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/traffic-cameras/6shots.png)

Above is shown an example of a series of images taken on a Wednesday afternoon in Midtown Manhattan. Running the median calculation on each point renders a decently clean image, shown below. 

![merged](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/traffic-cameras/merged.png)

Now, there are plenty of limitations with this strategy. For one, there could be issues if the road is intensely congested, resulting in a road that is severely obfuscated. Similarly, there could be issues with camera movement - so far this does not seem to be an issue but on windy days, for example, it could be. Ultimately, this is intended to be purely an exploratory exercise to see if these resources (traffic cameras) could indeed be tapped and, if so, what potential they might hold. In my following post I will document my attempts to identify traffic and, if possible, individual vehicles.