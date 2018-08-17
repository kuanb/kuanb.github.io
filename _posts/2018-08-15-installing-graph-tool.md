---
published: true
title: Installation notes for graph-tool
layout: post
summary: Notes from setting up graph-tool in peartree's development environment
comments: true
---

## Introduction

Intent of this post is to document early efforts to get [peartree](https://github.com/kuanb/peartree/), my library for generated directed network graphs based on public transit schedule data into [graph-tool](https://graph-tool.skewed.de/). What is graph-tool? It's a high-performance C++ library in which core graph algorithms are implemented with an eye towards speed. As a result, computation-intensive network graph calculations can be executed quickly. The library also features Python bindings, enabling a more convenient interface between the existing peartree graph network product and graph-tool's C++-based model.

This post is intended to be a precursor to a post I am writing on how to convert a NetworkX graph into a graph-tool graph.

## Why a blog post?

Setting up graph-tool can be difficult! While the author provides [Docker images](https://git.skewed.de/count0/graph-tool/wikis/Installation-instructions#installing-using-docker) that enable a user to get up and running with, say, a notebook fairly quickly I wanted to document how I got the tool set up within the development environment I use for peartree.

## Installing graph-tool

At the time of this post's writing, the current Dockerfile configuration for the peartree development environment looks like [this](https://github.com/kuanb/peartree/blob/9c8bcfb58bdff9847e32e2d1405c0fa346295f57/docker/Dockerfile). The latest image is available  on Docker Hub, [here](https://hub.docker.com/r/kuanb/peartree/).

The TL;DR is that I'm running Python 3.6 on Debian. I believe the image the author publishes is on Alpine. Regardless, I did not find I could easily/satisfactorily port the peartree development environment. As a result, I wanted to get my development environment as close as I could to conforming with a distribution of the graph-tool C library as possible.

To do so, I made sure I was using Debian Stretch. This allowed me to use the Stretch distribution of the library that the author publishes.

With that, I was able to update my `sources.list` file with that distribution's address:

{% highlight bash %}
echo "deb http://downloads.skewed.de/apt/stretch stretch main" | tee -a /etc/apt/sources.list && \
echo "deb-src http://downloads.skewed.de/apt/stretch stretch main" | tee -a /etc/apt/sources.list
{% endhighlight %}

At this point, the author, in the installation instructions, informs the user to verify the packages with the following public key:

{% highlight bash %}
apt-key adv --keyserver pgp.skewed.de --recv-key 612DEFB798507F25
{% endhighlight %}

During the installation process, I was prompted with a different public key, this one associated with an Ubuntu keyserver (shown below).

{% highlight bash %}
apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 7A80C8ED4FCCBE09
{% endhighlight %}

I suspect both keys are valid, but in either case navigating this step was fairly straightforward and the prompts made executing the command a matter of cutting and pasting.

Having verified the source, I was able to then update `apt-get` and install graph-tool for Python 3:

{% highlight bash %}
apt-get update && \
apt-get install python3-graph-tool
{% endhighlight %}

Once install, I was able to confirm that the files were present, under `/usr/lib/python3/dist-packages/`. Because the rest of the Python 3 files were located under `/usr/local/lib/python3.6/site-packages` (see below for what current paths were), I need to add to the available system paths the new path (under `/python3/`).

{% highlight bash %}
$ python -m site
sys.path = [
    '/code',
    '/usr/local/lib/python36.zip',
    '/usr/local/lib/python3.6',
    '/usr/local/lib/python3.6/lib-dynload',
    '/usr/local/lib/python3.6/site-packages',
]
{% endhighlight %}

At this point, I could drop into a Python 3 REPL and import most components of graph-tool. But, in order to render graphs, I needed a few more libraries, specifically:

- [PyCairo](https://pycairo.readthedocs.io/en/latest/), a Python-bindings library for the Cairo graphics tool (so also Cairo)
- [PyGraphviz](https://pygraphviz.github.io/) a Python-bindings library for the Graphviz network dot graph rendering tool (so also Graphviz)


I believe Cairo was already installed but, regardless, it's fairly straightforward to install:

{% highlight bash %}
apt-get install libcairo2-dev
{% endhighlight %}

And the Python bindings were installed easily with `pip`:

{% highlight bash %}
pip install pycairo
{% endhighlight %}

The peartree Makefile already contains a script for installing Graphviz and its Python bindings. Its installation is also straightforward:

{% highlight bash %}
install-graph-viz:
    apt-get update && \
    apt-get install xdg-utils && \
    apt-get install graphviz && \
    pip install pygraphviz
{% endhighlight %}

## Conclusion

At this point, the peartree development environment has been "upgraded" sufficiently to support operation of graph-tool (and rendering of graph components). Hopefully this documentation is not just helpful in documenting my efforts with regards to peartree, but also others attempting to install graph-tool on their own in the future.