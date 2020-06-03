---
published: true
title: External DAG triggers in Airflow
layout: post
summary: Executing DAGs from within other DAGs and managing shared context
comments: true
---


## Introduction

The intent of this post is to demonstrate how to accomplish two tasks. First, I document how to trigger a DAG from within another Airflow DAG, without the trigger being attached to either DAG. Second, I demonstrate how to pass through the context from the first DAG to the second.

Why would you want to pass the context from the first DAG to the second? For example, let's say you want to trigger a backfill or rerun a DAG for a prior date. In this example, you might have one DAG and a second, let's call them `dag_a` and `dag_b`. Let's say the current date is `06-01-2020`. The backfill date is going to be for `04-13-2020`. When the backfill DAG job is triggered in Airflow, `dag_a` receives a context which includes the date for the backfill job (in this case, the `04-13` date). But, when the first DAG triggers the second DAG, `dag_b`, `dag_b` does not receive the same context. Instead, a new context is generated for `dag_b`, and, as a result, `dag_b` has a context which has the current date, `06-01`. This is undesirable - as we would want the backfill date string being provided to `dag_a` to also be propagated through to the second DAG, `dag_b`.

## The TriggerDagRunOperator class

Triggering a DAG can be accomplished from any other DAG so long as you have the other DAG that you want to trigger's task ID. This can be achieved through the DAG run operator `TriggerDagRunOperator`. [Airflow documentation](https://airflow.apache.org/docs/stable/_api/airflow/operators/dagrun_operator/index.html#airflow.operators.dagrun_operator.TriggerDagRunOperator.template_fields) as of 1.10.10 states that this `TriggerDagRunOperator` requires the following parameters:

- `trigger_dag_id`: the dag_id to trigger
- `python_callable`: an optional python method that receives the current `context` object and is also passed the `dag_run` object
- `execution_date`: this is an optional date time object

A gotcha is that, in addition to those three parameters, it also requires a unique `task_id` as well. If you review the [source code](https://airflow.apache.org/docs/stable/_modules/airflow/operators/dagrun_operator.html#TriggerDagRunOperator), it won't be immediately obvious that this parameter is required.

But, if you review the [source code](https://airflow.apache.org/docs/stable/_modules/airflow/models/baseoperator.html#BaseOperator) for `BaseOperator` the abstract base class for `TriggerDagRunOperator`, you will see that a `task_id` is required for initialization. This will be triggered in `TriggerDagRunOperator` during its initialization step in the following line: `super(TriggerDagRunOperator, self).__init__(*args, **kwargs)`.

At a bare minimum, we might represent a trigger of `dag_b` as the following. This can then be used from within `dag_a` to call for a run of `dag_b`.

{% highlight python %}
TriggerDagRunOperator(
    task_id='unique_dag_run_operator_id',
    trigger_dag_id='dag_b_id'
).execute(context)
{% endhighlight %}


## Triggering a DAG run from another

Now, the question is where to fire the trigger for `dag_b`. One pattern is to use the `on_success_callback` key on the `default_args` that get passed into the `DAG` class that initializes `dag_a`. With this set, one can initialize the DAG as shown below.

{% highlight python %}
from airflow import DAG

dag_a = DAG(
    'dag_a_id',
    default_args={
    	'on_success_callback': trigger_dag_b,
    },
    schedule_interval="{{ some pattern }}",
    catchup=True,
)
{% endhighlight %}

Now the method `task_success_trigger` needs to be defined. At a minimum, it can just call the next DAG to run like so. This will trigger the next DAG to run, completely independent of the current context that `dag_a` is running with.

{% highlight python %}
def trigger_dag_b(context):
	TriggerDagRunOperator(
	    task_id='unique_dag_run_operator_id',
	    trigger_dag_id='dag_b_id'
	).execute(context)
{% endhighlight %}

## Sharing context between DAGs

In order to transfer context variables (such as, for example, the date of the triggered original DAG on a backfill date), `TriggerDagRunOperator` itself has a `python_callable` that can be leveraged to update the context being passed from `dag_a` to `dag_b`. In the callable method, the DAG run object is updated to receive any elements desired to be added to its payload's key-value store. In this case, below, we've added the date string from the original/first DAG run. Now, with the date string shifted to the DAG run payload, it can be accessed via the templating feature of the `params` attribute inherited from `BaseOperator`. This will cause the value to be provided as park of the dag run configuration in the context that is passed on to the triggered DAG, `dag_b`.

{% highlight python %}
def update_payload(context, dag_run_obj):
	# copy over aspect of the context/whatever that is desired to be preserved
    dag_run_obj.payload = { 'ds': context['ds'] }
    return dag_run_obj


def trigger_dag_b(context):
    TriggerDagRunOperator(
        task_id='unique_dag_run_operator_id',
        trigger_dag_id='dag_b_id',
        python_callable=update_payload,
        params={ 'ds': "{{ dag_run.conf['ds'] }}" },
    ).execute(context)
{% endhighlight %}

Now, `dag_b` needs to be able to access this variable not from the typical context key-value location for the `ds` string, but instead from the DAG run configuration. So, originally, `dag_b` might have accessed the dete string in a Python callable via `context["ds"]` - but now it would need to access it through the DAG run configuration: `context["dag_run"].conf["ds"]`.

{% highlight python %}
dag_b = DAG(
    'dag_b_id',
    default_args={ ... },
    schedule_interval=None,
    catchup=False,
)

def call_with_desired_context(**context):
	ds = context["dag_run"].conf["ds"]
	# trigger lambda, do whatever you want with this ds
	# which will now be the same as the one from dag_a

PythonOperator(
    dag=dag_b,
    task_id='some_task_id',
    python_callable=call_with_desired_context,
    provide_context=True,
)
{% endhighlight %}
