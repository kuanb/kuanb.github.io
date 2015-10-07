---
published: true
title: Improving path-creator tool
layout: post
summary: Sometimes simpler and slower is better
---

I've been trying to create a tool that can receive an unsorted blob or "cloud" of latitude/longitude data and infer a route from it. You can read more about the premis in the post prior to this one. Throughout the prior post, I dismissed a dumb solution I had initially created, instead attempting to create a more optimized method that would perform faster. The problem with this method is that it had to individually account for every weird twist and turn situation that might occur along a route, and custom handle each variant. The dumb solution, on the other hand, continually looped through the cloud of lat/lngs and selected the next closest point to the one that was currently last in the resorted array. It was an inefficient method, but I've finally decided that what was more important was that it was working. This other method has consumed a great deal of my time and, the reality is, optimizing this function is a pointless endeavor given the use case - which is effectively an infrequent implementation of this tool to retrieve a shapefile. Ultimately, the shapefile itself is what is of use and optimizations is analayzing against the shapefile will prove useful in the future. 

On the other hand, optimizations in extracting the shapefile are, ultimately, frivolous. As a result, I have updated the tool so that the `dumbReorder` (now called `basicReorder`) is the default and the original "optimized" reorder method (hard to call it that since it wasn't working and was taking an inordinate amount of time which, in itself, is not optimal) has been sidelined as an experimental tool that, for the time being, will cease being improved.

![error1](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/path-creator-2/error1.png)

What I did do was use some of the detection methods that were implemented in the original "optimized" method to detect potential errors in the basic shapefile builder. I think for the purposes of the analysis I plan on doing with the shapefiles, the errors seems to be minor enough so as to be likely irrelevant. As we can see in the above image, I built out a function that checks for such errors (a "jag detector," if you will). In this variant, I highlighted all the issue points on the map. I think a tool like this can at least quickly make a user aware of the points where the tool might likely have failer her or him and can help make the tool more transparent (or at least its limitations).

![error2](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/path-creator-2/error2.png)

Seen above: Another jag. In the above route being shown (the M60-SBS line from Harlem to LaGuardia in Queens, New York), two errors are returned. These errors are, for the purposes of a geospatial analysis of crash incidents, for example, small enough for me to be satisfied to move on to the next step in my work.

![overallResort](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/path-creator-2/overallResort.png)

That said, I do not plan to give up on my efforts to create a tool that can handle such errors itself, without requiring human intervention. Ideally, no errors should result and the "jag detection" that is currently implemented ought to be the first step in the direction of creating a tool that can automatically resolve these errors. My thoughts on how to proceed originall involved taking those angle points and seeing if they fit in a better stop. In the above image, you can see algorithm comparing existing points along the route that have wider angles (thus less likely to be a "jag") and working its way down the length of the route to ones that are both close distance-wise and have improved angles. Shown are the points for both the first and second issue points (areas where the angle falls below a given threshold - set at 50 degrees). The two points are highlighted as green dots. The points that are evaluated as potential points before which the issue point might be placed are highlighted in red.

![resortCloseUp2](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/path-creator-2/resortCloseUp2.png)

Above is the issue point for the first detection example from prior. In this case, you can see that the issue is that the first two points of the path have been placed before the southernmost point in the image when, in fact, they should have existed after it. In this case, we need the error detector to know that the issue is not the angle itself but that the points prior represent a segment that needs to be moved to a different point along the route.

![resortCloseUp](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/path-creator-2/resortCloseUp.png)

Above is the second issue point. Given the pretty severe angle of the jag (almost 0 degrees), pretty much every point along the route appears to be an improvement over the prior point. What in fact needs to happen, as should be apparent, is that the point needs to be swapped with the point prior to it so that an "L" shape can appear as would be the left turn that the bus makes at that intersection. This problem seems to be easier to solve, as it can be achieved by seeking the next closest distance that the green issue point could be placed within the route and leaving it there, instead.

Ultimately, a strategy needs to be created that handles both of those situations, and any others. In a way, the complexities of the "efficient" method from before have just been kicked down the road a bit farther and if I want to be able to handle these points, I am going to have to likely begin accounting for every likely situation given a "jag" and handling the point acccordingly. I'd welcome any advice, if you've got some!

