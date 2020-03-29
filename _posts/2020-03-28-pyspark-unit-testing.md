---
published: true
title: Testing patterns with PySpark
layout: post
summary: Unit testing multistep transformation pipelines
comments: true
---


## Introduction

I recently had to set up a PySpark pipeline that performed a number of data transformations (dimensionally reducing the data to focus on rollups of factors we wanted to target and streamline for downstream querying and analysis). Writing tests for this was not immediately intuitive. In the end, the pattern follows that of most `pytest` tests that you would see in a standard Python library, though. This post documents a simplified, generic example of a pipeline job and how to break apart step transformations and test them independent of the parent operation’s complete step flow. 

### Main function overview

The generic method will have a few key steps. First it will format a query, then it will submit the query (with `spark.sql`) and return a Spark DataFrame with the result. At that point, it will run a series transformations on the DataFrame and, finally, it will write the results to some parameterized destination (which in production might be an S3 bucket, for example).

We can describe the steps involved with the following pseudocode:

{% highlight python %}
def main(params):
    format_query
    run_query
    transform_step_1
    transform_step_2
    write_result
{% endhighlight %}

### Main function steps details

Fleshing this out, we can describe the `format_query` step with the following method:

{% highlight python %}
def _create_query_str(query_param: str):
    """Format and return sql string template with filtering parameter values."""
    return """
        SELECT foo, bar, partition
        FROM example.table
        WHERE bazz >= '{}'
    """.format(query_param)
{% endhighlight %}

Here, we have a SQL query that can be formatted with parameters supplied to the `main()` method.

Next we have to make the query by submitting it with `spark`:

{% highlight python %}
def _run_query(fomatted_sql_query: str):
    """Run sql query and return spark dataframe."""
    return pyspark.sql(fomatted_sql_query)
{% endhighlight %}

This step will be patched in unit tests to avoid actually querying the database. In its place, a fixture representing a subset of data that matches the database schema will be supplied instead.

Now we will provide two example transformation on the DataFrame. What these do is not super important - these steps are purely for demonstration.

{% highlight python %}
# first example transformation step
def _transformation_example_one(df):
    return df.withColumn(
        "joined",
        sf.concat(
            sf.col("foo"),
            sf.lit("_"),
            sf.col("bar")))


# second example transformation step
def _transformation_example_two(df):
    return df.withColumn(
        "factored",
        sf.col("foo") * sf.col("bar")
    )
{% endhighlight %}


### Fleshing out the main method

We can now revisit the `main()` method and show how all the example steps can be rolled together in a `main()` method workflow:

{% highlight python %}
def main(query_param: str, save_location: str):
    # format and run query
    sql_query = _create_query_str(query_param)
    spark_df = _run_query(sql_query)

    # apply a series of operations
    spark_df = _transformation_example_one(spark_df)
    spark_df = _transformation_example_two(spark_df)

    # save/write operation
    (
        spark_df
        .repartition("partition")
        .write
            .partitionBy("partition")
            .mode("overwrite")
            .format("json")
            .option("compression", "gzip")
        .save(save_location)
    )
{% endhighlight %}

The `save/write operation` could probably also be broken out into a different step, too. But, I’ll leave at this for the sake of the example.

### Testing overview

I will do two main tests. First, I will have tests that check the individual steps and make sure they behave as expected. Then I will have tests that check that each step integrates with its subsequent steps by running the whole main method and checking its results.

### Testing steps

First, to check each step we can start by creating `pytest` fixtures that mock inputs and outputs from each step of our multi-step `main` method.

In this case, I create the following two:

{% highlight python %}
from unittest.mock import patch


@pytest.fixture
def query_results_fixture_df():
    return spark.read.json("test/fixtures/query_results_sample.json")


@pytest.fixture
def query_results_fixture_stage_two_df():
    return spark.read.json("test/fixtures/query_results_sample_stage_two.json")
{% endhighlight %}

We can see how these are used by examining all the tests for the steps:

{% highlight python %}
class TestUnitMethods:
    def test_create_query_str(self):
        assert "WHERE bazz >= 'abc'\n" in _create_query_str('abc')

    def test_transformation_example_one(self, query_results_fixture_df):
        res_df = _transformation_example_one(query_results_fixture_df)

        # run tests specific to the output state at this stage
        got_cols = set(res_df.columns)
        assert got_cols == set(["foo", "bar", "partition", "joined"])

        rpdf = res_df.toPandas()
        assert set(rpdf["joined"]) == set(["100_1","130_2","302_3","293_4","173_5","462_6"])

    def test_transformation_example_two(self, query_results_fixture_stage_two_df):
        res_df = _transformation_example_two(query_results_fixture_stage_two_df)

        # run tests specific to the output state at this stage
        got_cols = set(res_df.columns)
        assert got_cols == set(["foo", "bar", "partition", "joined", "factored"])

        rpdf = res_df.toPandas()
        assert set(rpdf["factored"]) == set([100,260,906,1172,865,2772])
{% endhighlight %}

What has been done is that, each step has been isolated with a mock for the input and a mock for the output having been shimmed. Then, we can compare the result produced with the result we expected by comparing the output fixture against the one generated.

In the case of the multiple steps, the output of one step can also be recycled to be the reference DataFrame for the subsequent step.

### Testing the main method

Now we can move on to test the whole process combined in the main function. In this case, we can also test the write step since it’s an “output” of the `main` method, essentially.

{% highlight python %}
class TestMainMethod:
    @patch("path.to.the._run_query")
    def test_integration(self, _run_query, query_results_fixture_df):
        # patch call to pyspark.sql to avoid actually submitting sql query
        _run_query.return_value = query_results_fixture_df

        # execute the whole main function and thus run all steps together
        temp_save_loc = "temp_test_spark_write_output_dir"
        query_param = "fizzbuzz"
        main(query_param, temp_save_loc)

        # TODO: load in output file from temp_save_loc and compare to expected

        # cleanup results
        shutil.rmtree(temp_save_loc)
{% endhighlight %}

Now, by parameterizing the write location, we can avoid writing to an external service like S3 and instead write to a temporary directory locally. See the “TODO” section for where that file could then be read in and compared to an example dataset to ensure that the output data produced from the `main()` method matched with what is expected.

## Conclusion

I’ve noticed that unit testing may not be as “popular” with Spark applications because the set up is onerous but, with some careful method structuring, unit tests can be developed to ensure that transformation steps behave as expected. In addition, such steps help enforce that each method can safely expect certain columns and data presence and make future modifications to data transformations performed more safely.