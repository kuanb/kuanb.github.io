---
published: true
title: Running Selenium on AWS Lambda
layout: post
summary: Lambda supports custom Docker images but container behavior is inconsistent on AWS infra
comments: true
---

# Introduction

About a year and a half ago or so, AWS [announced support](https://aws.amazon.com/blogs/aws/new-for-aws-lambda-container-image-support/) for custom Lambda images. This unlocks a number of new advantages - namely the ability to create images that have complex install requiremnents prior to runtime. A perfect example of this is running Selenium on a Lambda to screenshot a website in-browser. One can quickly imagine the use cases (and related conveniences) of a Lambda-based Selenium screenshotting tool. In my case, I sought to take multiple screenshots of a mapping tool at multiple geographic locales every N minutes in perpetuity for QA purposes.

## Challenges

While AWS suggests that defining a local image and running a container to test your logic locally is straightforward (as in [this blog post](https://docs.aws.amazon.com/lambda/latest/dg/images-create.html)), it's not in practice. In my case, I was able to build an image from a Dockerfile with Selenium and Chrome and, while it would run fine locally, it would fail to either initialize the `chromedriver` or would have the browser itself crash when running on AWS Lambda infrastructure.

## Lesons learned

Two key lessons I learned from this effort:

1. Chrome running headless simply does not appear to work at this time on Lambda - always use Chromium. Chrome attempts to initialize user accounts and profiles which cannot be created or written to as the AWS Lambda file system is read only. This creates a series of cascading issues (I suspect) that leads Chrome to close unexpectedly / in an unhandled manner. Thus, `chromedriver` is unable to initialize successfully and Selenium exits early without being able to actually `get` the target website.

2. Installing the Chrome or Chromium browser via `wget` or `curl` versus `apt-get` seems to cause issues with how the binary is stored and made available in `PATH`. Even when the location of the browser binary was specified, there remained issues with browser initialization or getting the `chromedriver` to play nice with the browser. Ultimately, installing via `apt-get` circumvented these issues and resulted in a clean install and, in conjunction with 1 above, allowed successful headless browser operation within the Lambda infrastructure.

## Selenium initialization

The settings I used for Lambda use of Selenium with Chromium via the `options` class are as shown:

```python
from selenium.webdriver.chrome.options import Options

options = Options()
options.add_argument("window-size=1400,1200")
options.add_argument("--headless")

# other parameters for running headless in Lambda I used
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--disable-extensions")
options.add_argument("--disable-gpu")
options.add_argument("--disable-dev-tools")
options.add_argument("--no-zygote")
options.add_argument("--single-process")
options.add_argument("--user-data-dir=/tmp/chrome-user-data")
options.add_argument("--remote-debugging-port=9222")

# INFO: update if binary location needs to be set
# options.binary_location = "/other/location"
```

Note the final line in the above code block. The binary location setting is what could be adjusted if one were to try and install the browser and driver manually as described above. However, I remained unsuccessful at this and ultimately went with `apt-get` to install the driver and browser.

## Dockerfile

Without further ado, here's the Dockerfile that I found successfully installed Selenium, Chromium, and the related Chromedriver:

```Dockerfile
FROM ubuntu:18.04

SHELL ["/bin/bash", "-c"]

RUN apt update && apt-get install -y software-properties-common
RUN apt update && add-apt-repository ppa:deadsnakes/ppa
RUN apt update && apt-get install -y \
    make \
    curl \
    python3.7 \
    python3.7-distutils \
    g++ \
    cmake \
    unzip \
    libcurl4-openssl-dev \
    git
RUN apt-get update && apt-get install -y \
    fonts-liberation libappindicator3-1 libasound2 libatk-bridge2.0-0 \
    libnspr4 libnss3 lsb-release xdg-utils libxss1 libdbus-glib-1-2 \
    autoconf cmake curl libtool unzip wget \
    xvfb


# install chromedriver and google-chrome

RUN apt update && apt-get install -y chromium-browser chromium-chromedriver


# install amazon RIE for lambda testing

RUN curl -L https://github.com/aws/aws-lambda-runtime-interface-emulator/releases/latest/download/aws-lambda-rie -o aws-lambda-rie-x86_64 && \
    mv aws-lambda-rie-x86_64 /usr/local/bin/aws-lambda-rie && \
    chmod +x /usr/local/bin/aws-lambda-rie


# install pip and set up virtualenv

RUN curl -o /tmp/get_pip.py https://bootstrap.pypa.io/get-pip.py && \
    python3.7 /tmp/get_pip.py && \
    python3.7 -m pip install virtualenv


# generate working directory locations

RUN mkdir -p /code
WORKDIR /code
ENV PATH="${PATH}:/code:/usr/lib"

COPY requirements.txt /code/requirements.txt
COPY entry_script.sh /code/entry_script.sh
COPY lib/ /code/lib/

RUN make install

ENTRYPOINT [ "sh", "/code/entry_script.sh" ]
```

The Makefile install method simply installs the available requirements and creates a virtual environment to operate within:

```bash
venv:
    virtualenv --python=python3.7 venv

install: venv
    source venv/bin/activate &&\
    pip install -r requirements.txt
```

The `entry_script.sh` similarly is adapted the suggested pattern from AWS Lambda's docs which allows for a conditional RIE entrance that runs in "local" mode if certain OS environment variables are not present, otherwise it executes with the expectation that it is in AWS Lambda infrastructure:

```
#!/bin/sh
if [ -z "${AWS_LAMBDA_RUNTIME_API}" ]; then
  exec /usr/local/bin/aws-lambda-rie /code/venv/bin/python -m awslambdaric lib.snapshot_lambdas.handler
else
  exec /code/venv/bin/python -m awslambdaric lib.snapshot_lambdas.handler
fi
```

At this point, you should be able to create a `.py` file (in the above case, `snapshot_lambdas`) that contains a handler for receiving Lambda invocations (or simulated ones in local run cases).

Good luck screen capturing on Lambda!