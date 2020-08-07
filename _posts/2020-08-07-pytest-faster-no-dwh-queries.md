---
published: true
title: Faster tests with PySpark
layout: post
summary: Unit testing and data warehouse queries
comments: true
---


# Introduction

I recently have been working on a pyspark codebase that has been bogged down by long-running tests. One pattern I noticed in the code that I’ve not observed contributes greatly to test runtime is data warehouse queries. These reads and writes from the data warehouse are slow and, when multiplied by the hundreds of tests in a codebase, can begin to impact developer velocity negatively.

This post will demonstrate a typical example function that I’ve been dealing with and how to restructure it to leverage Python’s `unittest.mock` library to isolate and `patch` data warehouse interactions. It will then show how that speeds up test performance.

# Example function

Below is an example function that I see often in pyspark code (see below). This function in fact does 3 things: First, it performs a query and extracts some data, then it performs a set of transformations on that data, and then finally it writes the results. This is a traditional ETL process, of course.

{% highlight python %}
def method_orig(spark):
    """Simple example script that runs an ETL“””
    sql_str = "SELECT foo, bar FROM tmp.table_get"
    df = spark.sql(sql_str)

    # the "main point" of the method function
    res_df = df.filter(F.col("foo") <= F.lit(10))

    # save to table
    table_operations = tableoperations.TableOperations(spark)
    table_operations.addTable(
        res_df,
        "tmp",
        "table_put",
        [],
        storage_location="/tmp/test/",
    )
{% endhighlight %}

These types of functions are often the “parent” or `main()` operations that, when triggered, perform some regular scheduled analysis. In “real life” the data warehouse reads, transformations, and writes are all far more complex, but at the end of the day follow this approximate pattern.

# Testing example function

We can write a test for the above function, but it will require a great deal of “set up” and “tear down.” Below is an example of what a test might look like for the example function, based on what I’ve encountered with these pyspark codebases:

{% highlight python %}
def test_method_orig():
    # first set up the table that needs to be read from and populate it
    spark.sql("CREATE DATABASE IF NOT EXISTS tmp")
    spark.sql("DROP TABLE IF EXISTS tmp.table_get")

    rows = [
        Row(foo=1, bar=2),
        Row(foo=11, bar=22),
    ]
    df = spark.createDataFrame(rows)
    df.write.saveAsTable("tmp.table_get")

    # now we can test the method
    method_orig(spark)

    # once tests are done, we can complete the 
    spark.sql("DROP TABLE IF EXISTS tmp.table_get")
    spark.sql("DROP TABLE IF EXISTS tmp.table_put")
    spark.sql("CREATE DATABASE IF NOT EXISTS tmp")
{% endhighlight %}

In this example, a database and related tables must be established first so that the function being tested can query said tables while being run.

Once the method has been run (and associated tests applied), the database and the related tables need to be taken down.

There are a number of risks with this pattern - namely that tables and databases can fail to be torn down (developer forgets to add this logic). This means that one test can begin to inadvertently impact other tests and, in a worst case scenario, another unrelated test might end up relying on some side effect produced from a previous test (unintentionally, of course).

Beyond code clarity issues, verbose tests, and potential to create messy test environments - there’s a performance impact of this pattern. Round-trips to and from a “data warehouse” with pyspark is slow. Add enough of these tests and your tests will quickly balloon in runtime.

# A better pattern

First we need to ask ourselves what we are really trying to test. With pyspark code, it will be inevitable that there will be a large parent function that ties together a read/transform/write string of steps. But we need to compartmentalize each of these actions with more discrete unit tests and only tie together all the related steps in a very controlled manner with as limited tests as possible. Doing so will drastically improve the tests’ run time.

First, we should break apart the main method into its composite parts as we identified them earlier. An example is shown below:

{% highlight python %}
def get_df(spark, sql_str):
    return spark.sql(sql_str)


def save_to_table(res_df):
    table_operations = tableoperations.TableOperations(spark)
    table_operations.addTable(
        res_df,
        "tmp",
        "table_put",
        [],
        storage_location="/tmp/test/",
    )


def run_filter(df):
    return df.filter(F.col("foo") <= F.lit(10))


def method_improved(spark):
    sql_str = "SELECT foo, bar FROM tmp.table_get"
    df = get_df(spark, sql_str)
    res_df = run_filter(df)
    save_to_table(res_df)
{% endhighlight %}

Here, we have the database query extracted such that it can be patched, we have the transformation broken apart as an independent function that can be tested in an isolated manner, and we have our write also abstracted.

The main method function now reads as a play script for what steps need to be orchestrated to complete the whole ETL process.

We can now test the key functions that are code we are developing specifically - especially those in the transformation step(s).

# Testing the new pattern

In our tests, we can now explicitly test the transformation functions we desire, isolated from the database read/writes.

{% highlight python %}
def test_filtering(raw_df):
    c = run_filter(raw_df).count()
    assert int(c) == 1
{% endhighlight %}

We still may want to test the main method to make sure that all components integrate as expected. This time, we can do that by making sure that our transformation functions integrate with what we expect to be returned from the database without needing to actually make that round trip. We can do this by patching the abstracted functions:

{% highlight python %}
@patch("script.save_to_table")
@patch("script.get_df")
def test_method_improved(get_df, save_to_table, raw_df):
    get_df.return_value = raw_df

    # we're not testing the save logic so skip it
    save_to_table.return_value = None

    # now we can test the method (add tests as desired)
    method_improved(spark)

    toc = time.perf_counter()
{% endhighlight %}

Note that in both of the above functions I have also recycled created of the data frame through a fixture:

{% highlight python %}
@pytest.fixture
def raw_df():
    rows = [
        Row(foo=1, bar=2),
        Row(foo=11, bar=22),
    ]
    return spark.createDataFrame(rows)
{% endhighlight %}

# Results

Not only is the refactored code cleaner and more readable, but the tests also run significantly faster.

Average elapsed times by test pattern:
- Original (including database create/deletes): ~9.8 seconds
- Refactored (patched responses, no DWH queries): ~2.8 seconds

That’s a roughly 71.5% speed up in test run time. For a simple example like this, it’s a matter of seconds, but in a complex code base this can quickly add up to dozens of minutes.
