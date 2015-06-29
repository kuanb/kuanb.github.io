---
layout:     post
title:      Ray tracing
date:       2014-11-25 12:31:19
summary:    Spinning planets and simulating points in space
categories: 
---

_Warning: This is a really old blog post. I am including it just for posterity, and in the interest of just keeping all my old writing from my "earlier" days._

Today I wanted to move from two dimensions to three. I had done an asteroids game recently and wanted to see if I could devise a small project to take myself into the third dimension. The result was my working through a really fantastic tutorial by [Tom MacWright](https://github.com/tmcw/literate-raytracer), a crazy accomplished programmer at MapBox (an equally crazily-accomplished company). If your browser is acting up when the planets are spinning or you're on an ancient computer that can't handle all the junk I dump on this blog, you can [open it in its own window and play it there](http://kuanbutts.com/blog/embed/space/index.html).

<embed src="http://kuanbutts.com/blog/embed/space/index.html" style="width:100%;height:350px"></embed>

This project helped me become far more familiar with the concepts of ray tracing. Essentially, you are reverse projecting vectors from a single point (the camera) and observing instances at which the vector ray intersects an object in space (or light element). If it does, it can also recurse into itself (theoretically, infinitely), to observe elements that are in the path of the resultant reflected vector. By doing so for each projection in the screen plane (a plane sitting in front of the camera at a distance that allows for a single point to equal one pixel, which is then multiplied in size to handle screen sizes of greater resolution). More on how this works is outlined, in fantastic detail, on MacWright's blog.