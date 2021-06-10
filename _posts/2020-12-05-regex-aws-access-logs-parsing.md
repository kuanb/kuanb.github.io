---
published: true
title: Notes from challenges during parsing of AWS access logs
layout: post
summary: Regex conditionals and non-capturing groups
comments: true
---

# Introduction

This post documents notes on parsing access logs for S3 buckets. Specifically, I review how to conditionally evaluate for values that may or may not exist in a string w/ regex.

Why post about this? I was following the description of how to parse access logs from an S3 bucket with Athena based on the guide AWS published [here](https://aws.amazon.com/premiumsupport/knowledge-center/analyze-logs-athena/). Specifically, I am reviewing the version that states it was last updated on this date: `Last updated: 2020-10-07`.

The guide indicates that the user should parse the access logs with a pattern that is premised on 3 elements being present and wrapped in quotes:
```
RequestURI_operation STRING,
RequestURI_key STRING,
RequestURI_httpProtoversion STRING,
```

These values are not always present, though. They are not provided for the following operations, for example:
```
REST.COPY.OBJECT_GET
REST.COPY.PART_GET
```

Instead, in these cases, a dash is provided instead. Because of this, the regex parse pattern that is provided in the guide will fail and those rows will render as empty rows in Athena. As a result, if you wanted stats about `GET` requests, for example, you would receive an incomplete picture of your S3 bucket access activity because you'd be missing certain REST queries that failed to parse correctly.

For posterity, the pattern that AWS shared in the above-linked docs is the following:
```
([^ ]*) ([^ ]*) \\[(.*?)\\] ([^ ]*) ([^ ]*) ([^ ]*) ([^ ]*) ([^ ]*) \\\"([^ ]*) ([^ ]*) (- |[^ ]*)\\\" (-|[0-9]*) ([^ ]*) ([^ ]*) ([^ ]*) ([^ ]*) ([^ ]*) ([^ ]*) (\"[^\"]*\") ([^ ]*)(?: ([^ ]*) ([^ ]*) ([^ ]*) ([^ ]*) ([^ ]*) ([^ ]*))?.*$
```

## Background

Recently I've been trying to create a parser for AWS S3 access logs to review bucket utilization across a number of shared S3 buckets. The access logs are saved as text files and contain logs of access actions to an S3 bucket on each line of each text file. Each access log is a string that contains a subsection that looks like the following:

```
... {requestid} {operation} {key} {request_uri} {httpstatus} ...
```

For most operations there's no `key` value and the `request_uri` is a set of space-separated strings wrapped in double-quotation marks. Here's an example of one:
```
"GET /?encryption HTTP/1.1"
```

I want to break this string apart into 3 elements: `operation`, `key`, and `http_protoversion`. Unfortunately, since this does not exist on every single access log, it needs to be conditionally evaluated if present. Here is an example of a full subsegment of an access log that contains the `request_uri` element:

```
KD2EHDH4D3QW87EE REST.GET.ENCRYPTION - "GET /?encryption HTTP/1.1" 403
```

And here is a version that does not have that element, but does have a full key string (instead of a dash):

```
KD2EHDH4D3QW87EE REST.COPY.OBJECT_GET some/path/to/file.csv - 200
```

The first example above should evaluate with the following groups extracted:
```
- requestid: "KD2EHDH4D3QW87EE"
- operation: "REST.GET.ENCRYPTION"
- key: null
- request_uri_operation: "GET"
- request_uri_key: "/?encryption"
- request_uri_http_protoversion: "HTTP/1.1"
- httpstatus: "403"
```

The second example from above should evaluate to:
```
- requestid: "KD2EHDH4D3QW87EE"
- operation: "REST.COPY.OBJECT_GET"
- key: "some/path/to/file.csv"
- request_uri_operation: null
- request_uri_key: null
- request_uri_http_protoversion: null
- httpstatus: "200"
```

# Parsing the string

The first three elements from the example sub-segments are straightforward eneough. In these, we simply look for all characters until the next space character. Each of these can be a capture group parsed via `([^ ]*)`. With this pattern, we match 0 or more of this negated set: `[^ ]`. This negated set tells us to match anything that is not a space character. We match as many of these as we can until we hit a space character.

We have three of this capture group in a row:
```
([^ ]*) ([^ ]*) ([^ ]*)
```

This allows us to consistently capture the `requestid`, `operation`, and `key`. If the `key` is a dash, we capture that in lieu of the full S3 key. This fine - all three elements are treated as strings after being parsed from the original access log line.

## Parsing the conditional sub-string elements

Next is the challenging part - how do we extract the three `request_uri` parameters when they are only available in certain cases?

The solution is to nest non-capturing groups wrapping an alternation. What does this look like? Here's an example:
```
(?:PATTERN_A|PATTERN_B)
```

The above example shows 2 things. First, a non-capturing group is created through the `(?: ... )` pattern. This allows us to group multiple potential tokens together without creating a specific output group itself. Next, there are 2 patterns that are presented, shown about with placeholders: `PATTERN_A` and `PATTERN_B`.

The pipe `|` acts is an "alternation" and acts as an "or" operator. It first tries and matches the pattern before the pipe and, failing that, tries the one after the pipe.

Let's fill in the above non-capturing group with the two patterns that we want to use:
```
(?:(?:\"([^ ]*) ([^ ]*) (- |[^ ]*)\")|-)
```

We can see `PATTERN_A` has become: `(?:\"([^ ]*) ([^ ]*) (- |[^ ]*)\")` and `PATTERN_B` has become `-`.

Let's discuss `PATTERN_B` first. It's straightforward. If the first pattern fails, then look for a `-` dash. This is what we see in the `REST.COPY.OBJECT_GET` shown earlier. It does not contain `request_uri` details and, instead, just has a dash. The first pattern `PATTERN_A` would fail to parse, and it would fall back to the second pattern provided with the alternation "or" operator and instead look for the dash and use that instead.

Now, let's look at `PATTERN_A`: `(?:\"([^ ]*) ([^ ]*) (- |[^ ]*)\")`.

We again wrap this set of three potential elements in a non-capturing group: `(?: ...)`. Now, within this, the parsing is straightforward. We can look for 3 space-separated elements, book-ended by double-quotes:
```
\"([^ ]*) ([^ ]*) (- |[^ ]*)\"
```

The third element uses an alternation as well, this time to handle if there is a dash `-` instead of a string present. It checks for the dash first and, absent that, it looks for an evaluates characters until it encounters a space.

# Conclusion

Now that the parent non-capture group conditions (and the alternation) have been satisfied, it exits the group and proceeds onward. We are able to continue evaluating for whatever following patterns we are looking for. In this case, for example, the next element is either a dash or a numerical value (representing the HTTP status response).
