---
layout:     post
title:      Gulp and Mocha
date:       2014-12-02 12:31:19
summary:    Trying to understand the workflow through self-explanation
categories: 
---

The purpose of this is to document the main point from some code review I received today. I am building a backend MongoDB database (as prior mentioned) for Flocktracker. One key comment made was that iteration efficiency would be drammatically increased if I were to employ Gulp + Mocha. I knew vaguely what Gulp was and nothing as to Mocha. I was able to learn about both via this [excellent blog](http://ellengummesson.com/blog/2014/01/06/getting-started-with-gulp/). I found this of merit as their is very little documentation on the use of these two libraries in conjunction. The primary component I found very confusing was how to get Mocha to run. But first I should explain further what Gulp and Mocha are.

Gulp, as I understand it, is a build system that essentially automates redundant tasks. What is a build system? Good question; I barely understand. So beyond automating tasks that are repetitive, another way of thinking about it is through an example. On the Canvas project I worked on last week, it was useful in my pairing partner's project because he was using Node libraries and needed to compile them to a web-ready format in order to test it in his browser. As a result, instead of having to run that everytime he wanted to check out his latest build, he automated the task via Gulp. For me, as I am building out this web application, I need to constantly reload the server and then click through to the area I am fixing or otherwise tweaking. While this is good for UI-related tweaks, it is really slow and inefficient for building the backend logic. This is where Mocha comes in handy. With Gulp, I can create a piping method (a stream of commands, one after another) that prepare the appropriate files, and then I can run Mocha on them. Mocha then runs through the various Express 4.0 `app.get` and `app.put` commands I have (along with other logic I am feeding it, and makes sure that they work. If they do, it print a green check in the terminal and if they do not, it can then highlight those problem functions. This lets me find and highlight issue points much more quickly than through manual iteration - what I had been doing prior. Hopefully, this will dramatically improve my workflow and help me stay focused during the development process.


![mocha_output](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/mocha_output.png)

Above is a screen capture of the output generated from running a Gulp file that pipes a `src` folder's contents to Mocha to be evaluated. Included is a simple function `add` that simple adds to variables. Clearly, more elaborate tests can be devised to test logic of processes in the backend.