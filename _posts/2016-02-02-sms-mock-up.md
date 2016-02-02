---
published: true
title: Simple SMS Mock Up Tool
layout: post
summary: A simple device for making mock-ups of SMS interfaces that conveys non-smartphone use
---

I was recenttly in a situation where I needed to create a simple interface that would allow people to "experience" the workflow of a simple SMS tool that was being proposed. Without building a complete backend and hooking it up to Twilio, I thought it would be nice to create a simple interface that did everything on the client side and allowed for new workflows or logic trees to be implemented in a "plug and play" method.

![text-service-mockup](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/sms-mock-up/text-service-mockup.png)

Unfortunately, when I surveyed the landscape of free tools, I found that interfaces seemed to focus on representing iPhone or other smartphone-like screens and interfaces. This is fine and is totally effective, but [I wanted to have an "old candybar" phone](http://kuanbutts.com/sms_mock/) to convey the effectiveness and simplicity of the SMS tool. I wanted an interface that would help emphasize to the non-technical individuals involved that this was a tool designed specifically for folks that did not have all the bells and whistles that come with owning a smartphone. Rather, I wanted to emphasize the "stripped down" nature of the service.

![main](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/sms-mock-up/main.png)

[My solution](http://kuanbutts.com/sms_mock/) is still a work in progress, but I think it achieves a fun, playful approach to this method and also sets the base for future expansion. First, the code seriously needs to be cleaned up but, second, the JSON that is pulled into the page is a simple structure, intended to make it easy to come back and modify the questions and branching structure quickly and easily at a later date. 

![diagram](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/sms-mock-up/diagram.png)

The diagram above shows an early flow diagram of a simple early sketch of how [this SMS tool](http://kuanbutts.com/sms_mock/) would work. A far more robust version is to be built at a later date. All we wanted to do was demonstrate to key stakeholders the experience of interacting with the endpoint that were shown in the flow diagram in a more engaing manner. The piece of information that allows the SMS mock up page to emulate that flow chart is the `structure.json` file that accompanies the page. A direct link to the `structure.json` file is [located here](https://github.com/kuanb/sms_mock/blob/master/structure.json).

{% highlight javascript %}
{
	"0": {
		"text": "You enrolled in CourtSMS. To opt out text OPTOUT. To change your reminders frequency text CHANGE. Other questions? Text HELP",
		"options": {
			"CHANGE": "1",
			"OPTOUT": "2",
			"HELP":   "3"
		}
	},
	...
}
{% endhighlight %}

An example of the `structure.json` code is shown above. The structure only has a few requirements. First, a `"0"` index is needed. The `text` attribute of this index is loaded automatically when the page loads. This is the "first text" that the fake phone on the screen received. The other necessary index is "`*`". This, like the `"0"` index is needed, as a hard-coded endpoint. If a user responds with an answer that does not fit any of the options provided, a catch-all response is used which allows the user to navigate back to the main menu. In a future iteration, I would also allow users to go "back" so that they would not have to navigate back to their previous solution should they accidentally enter text incorrectly and thus be forced to renavigate to their previous location.

![entry](https://raw.githubusercontent.com/kuanb/kuanb.github.io/master/images/_posts/sms-mock-up/entry.png)

Above is an image of the fake SMS phone having text entered through the input box in the right portion of the screen. For more on the work, please visit the [project's repository on Github](https://github.com/kuanb/sms_mock). You can visit the main page of the SMS mock up [here](http://kuanbutts.com/sms_mock/).