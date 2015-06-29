---
layout:     post
title:      Super Simple Asteroids Game
date:       2014-11-25 12:31:19
summary:    450 lines of code to shoot rocks
categories: 
---

_Warning: This is a really old blog post. I am including it just for posterity, and in the interest of just keeping all my old writing from my "earlier" days._

I wrote a super simple Asteroids game, under 450 lines of code yesterday. The purpose was just to play around with Canvas and do something that was more visual. After a week of MongoDB, one can yearn for the tactile nature of the web browser and the comfort of knowing you can see something to reward you for your efforts. The game is embedded below and ready to play, though I know the space bar in Chrome causes all sorts of problems. Ultimately, if your browser is acting up when the game is playing, you can [open it in its own window and play it there](http://kuanbutts.com/blog/embed/asteroids/index.html).

<embed src="http://kuanbutts.com/blog/embed/asteroids/index.html" style="width:100%;height:350px"></embed>

I wouldn't say its tremendously 'playable.' The game is effectively one function and, upon clicking to play, simply begins running. One interesting method I employed was not tying the performance of the ships speed to the browser. Instead, I make each space item, be it the ship, a laser, or an asteroid; and call them space objects. Each object keeps track of the time between when it is at the moment and when it was last called. When it is its turn to be updated, it calculates that delta of time and multiples that by its given speed attribute to determine distance changed for the redraw. I based this method of a helpful tutorial from this blog. The code for my Asteroids game [lies in this repo](https://github.com/kuanb/asteroids).