---
published: true
title: Map vs FlatMap
layout: post
summary: Simple introduction to functional patterns with Map and FlatMap
comments: true
---


## Introduction

Note: This is not a great explanation in hindsight and mostly preserved so I can return to it for reference as notes on exploring and understanding Map vs. FlatMap FP patterns.

I recently encountered a "lightweight" implementation of Monads and Options implemented in Python. The point of this post is not to deep dive into those two, but rather to "zoom out" and try to explain (to myself, as well) the difference between two types of functional programming methods frequently associated with them: Map and FlatMap. These patterns are tied with the use of Options (which I will briefly introduce). I found [this](https://www.baeldung.com/java-difference-map-and-flatmap) site helpful but wanted to write an even higher level version that is not tied to existing APIs in languages with stronger support for function programming patterns. So, in this post, I will draw attempt to illustrate the difference in the pattern between Map and FlatMap (and why you would use one versus the other) without diving into the details of specific APIs in such languages.


### Map explanation

First, let's consider an array of integers.

{% highlight python %}
# A list where each val is an int in array
list_1 = [1, 2, 3]
{% endhighlight %}

Let's consider each item in the list. Each item can be an "Option." A key aspect of the option that is leveraged by these mapping operations is the fact that an option has a state. That is, it can either be something or nothing (2 states). If it is something, it has a value. If it is not something (`nil`), then it's value is `None`, effectively. We can represent an Option in this example post as an array of length 0 or 1. If the array has a value in it, it is "something." Otherwise, it is an empty array and has nothing, no value in it (a `None`).

{% highlight python %}
# Make each item in the list an Option
# that is, it either exists or does not.
# Let's represent this as an array with
# content or no content.
[[x] for x in list_1]
# [[1], [2], [3]]
{% endhighlight %}

In the above example, all values were cast as a list. Now let's handle when there are `None` values present:

{% highlight python %}
# Now part of the capability of an
# option is that it can also represent
# nothing (the absence of a value)
list_2 = [1, 2, None, 4]
[[x] if x else [] for x in list_2]
# [[1], [2], [], [4]]
{% endhighlight %}

We can now define a map operation as one that applies a function on a given option and returns another option in response. That is, even if the option is an empty array (is nothing) it will return an option in response that is also nothing (an empty array).

Here's what a simple map method could be represented as:

{% highlight python %}
# In a standard Map operation a function
# is performed on a value if it exists
# and an option is returned representing
# the output (or absence thereof)
def map_ex(o, f):
    # truthy if list has length
    return [f(x) for x in o] if o else []
{% endhighlight %}

We can see the behavior described above when we apply the new method for mapping to some example options:

{% highlight python %}
# Now on option can be passed in
# and a method passed onto it
map_ex([3], lambda x: x**2)
# [9]

# and an empty option is passed over
map_ex([], lambda x: x**2)
# []
{% endhighlight %}

Now, going back to the original list of options from earlier, we can reconsider that list itself as an option. In doing so, we can apply a method designed to handle this new option that has a value which is a list of options in a manner akin to the following (which, as an example, adds 100 to all values that are something):

{% highlight python %}
# we can think of the whole list as
# an option as well
list_3 = [[1], [2], [], [4]]
list_opt = [list_3]

# we can now apply a map operation on the option that contains
# a list of options within it (in this case add 100 to each value)
list_4 = map_ex(list_opt, lambda x: [map_ex(y, lambda z: z + 100) for y in x])
# [[[101], [102], [], [104]]]
{% endhighlight %}


### FlatMap explanation

FlatMap differs from Map in a key way. Instead of the Map operation returning an Option automatically, it instead requires that the function passed to it return an Option type result itself. That is, while Map returns an Option, FlatMap returns a value (or `None` value) for each option, regardless of whether it is a "something" or a "nothing" and requires that the input method applied return an Option type response. We can now write a FlatMap example operation that demonstrates how this method differs from Map.

{% highlight python %}
from functools import reduce

def get_val(o):
    return reduce(lambda x: x, o) if o else None

# Now what if we want to take a list of
# options and instead return list of simple
# values instead? FlatMap can help here
def flatmap_ex(o, f):
    v = get_val(o)
    return [None] if v is None else f(v)
{% endhighlight %}

Just as before, we can watch this play out with single examples of options that have a value (are something) and do not (are nothing).

{% highlight python %}
# this method will return the single
# value instead an option representing
# whether or not the value exists (using
# a None to represent values that are not
# something)
flatmap_ex([6], lambda x: [x**2])
# [36]

flatmap_ex([], lambda x: [x**2])
# []
{% endhighlight %}

Now, the power of a FlatMap becomes more apparent when more types of Options are introduced. Right now, the pattern will look similar to a Map operation as the requirement to cast as an Option type has now just moved into the parameterized lambda.

{% highlight python %}
# And, again, we can consider the parent array of options
# as an option iteself and run flatmap an operation
# on that as we did with map before
list_opt = [list_3]

list_5 = flatmap_ex(list_opt, lambda x: [flatmap_ex(y, lambda z: [z + 100]) for y in x])
# [[101], [102], [None], [104]]
{% endhighlight %}

In a more functional pattern, the Option itself would have various subclasses and you would want to potentially recast the option type. In this example, we just have one Option type represented by the bracketed integer value, but in a more complete implementation, this FlatMap would allow you to control what type of Option is returned such that Option type A would not just return another Option type A but could be converted in a FlatMap operation to return an alternative Option, say Option type B.


### Conclusion

I hope this simple example helps explain the difference between Map and FlatMap. In some instances, controlling Option type on outputs can be desired whereas, in other instances, it might be more useful to rely on the mapped output's preceding, default Option type.
