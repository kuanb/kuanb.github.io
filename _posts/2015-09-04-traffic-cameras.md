---
published: true
title: Extracting data from traffic cameras
layout: post
summary: Notes on early process of obtaining and processing NYC DOT traffic camera image streams
---

Recently, I’ve been looking into what I’ll call “non-explicit” data resources. By that, I mean that there is a lot of data out there that is not cleaned and prepared for a specific purpose, although it might be tangentially relevant. Thus, some labor must be invested to access the relevant aspect of this data. An example of this are traffic cameras. As I was floating around NYC’s data offerings, I came across the NYCDOT traffic camera page. Through this page, one can easily acquire a list of url endpoints for each camera feed and limited metadata, including latitude, longitude, and a name indicating the approximate location or intersection at which the camera has been placed. Here’s an example of a JSON representing the data for a single camera (a list of all of them is on this [GH Gist](https://gist.github.com/kuanb/dbe19ce4e8ef317ee3fc)):

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

![evening_reg](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/traffic-cameras/evening_reg.png)

Above we see the evening view of the vehicles travelling along an underpass. This is a good example of the complexities that will arise and need to be dealt with. In this image, the vehicle lights are on and their reflections are present on the asphalt. While shadows present themselves as a potential issue in identifying vehicles during the day, the “streaks” that are left by the vehicle lights could be of greater concern for evening imagery.

![evening_merged](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/traffic-cameras/evening_merged.png)

Combining these images produces the above effect. Clearly, this might become an issue when trying to determine the difference between the base image of no vehicles on the road and a vehicle. Fortunately, creating this base image allows for the potential to employ a tool in OpenCV called `absDiff`. `absDiff` calculates the per-element absolute difference between two arrays or between an array and a scalar.

![evening_diff](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/traffic-cameras/evening_diff.png)

Implementation of `absDiff` with the base image being the cleaned “no cars” image and the second image being the latest capture of the road (in this case, with a number of cars) produces an exaggerated (or, perhaps, “heightened”) highlight of the elements of the image that are different from the base image. 

![evening_bin](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/traffic-cameras/evening_bin.png)

This method proved substantially more effective than attempting to calculate the difference between the base image and the current image with what I initially assumed would be a logical method. This was to create binary (black and white) interpretations of each image and effectively create a difference of the pixels from one to another. Unfortunately, this method created a great deal of noise and proved to be a sort of dead end.

So, returning back to the more successful `absDiff` image, we can see that the edges of the image have been highlighted in a fairly explicit manner. From here, I was able to easily run a [Harris Corner Detector in OpenCV](http://opencv-python-tutroals.readthedocs.org/en/latest/py_tutorials/py_feature2d/py_features_harris/py_features_harris.html), which provided me with a series of potential edge points. Taking each of these edge values, I then proceeded to simply plot each on top of the original `absDiff` image, which results in the below image.

![evening_pts](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/traffic-cameras/evening_pts.png)

From here, I’d like to see if I can get some very base level vehicle detection implemented this weekend. (We’ll see how successful I am.) Nonetheless, I think from this vantage point, there are clear opportunities to implement some machine learning techniques to improve vehicle detection and tracking, which could lead to improved and automated traffic flow monitoring. Such devices could serve to enhance other forms of traffic data, as well as perhaps lend a hand in monitoring for accidents or other traffic issues at critical route junctures.





