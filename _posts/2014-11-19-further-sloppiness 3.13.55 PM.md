---
layout:     post
title:      Further sloppiness
date:       2014-11-19 12:31:19
summary:    A pre-Jekyll foray into creating an easy-to-add-to blog system via Github (part 2)
categories: 
---

_Warning: This is a really old blog post. I am including it just for posterity, and in the interest of just keeping all my old writing from my "earlier" days._

I ended up not going back to Node right away. I realized the code issue could be resolved really fast by just dumping Boostrap on this. Now that the CSS is over-encumbered, and the code goes in easily, I also looked to see what other horrors I might bring about. This lead (sp?) me to a modified method of adding blogs. I still run through the list the same way, trying to load blog posts that have yet to be created, but now I also remove the div after creating it if the file returns a 404 error. Glorious. So, now, not only do I try to load files that do not exist, but then, when they fail to load, I go back and delete the divs I created. So terrible, so glorious.
