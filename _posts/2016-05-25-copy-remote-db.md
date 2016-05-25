---
published: true
title: Copying a Remote Database
layout: post
summary: Pulling down a remote database and loading it locally
---

I have a production database full of valuable information. I have copies of the database that are older that I "play with" in order to design and test new features for the tool I am building. Often time, I want to pull down more recent information. As a result, I want to get the latest dump of the data from the production server. Because I do this infrequently, I always forget the exact series of steps. Stack Overflow is perfectly helpful and it's always a matter of me finding the same "right" post and following that rough strategy. That said, it would be nice if I had written down, for myself, the steps I need to take for a future date when I will (inevitably) perform the same blog searches all over again. So, that's what this post is about - me writing down the tasks necessary to pull down a PostgreSQL database and load it to a local database on my machine.

First, AWS already runs regular DB instance backups. You can view these occurences under Events in your RDS Dashboard. You can also view backups for a specific instance on the main "Instances" part of the RDS Dashboard. They are listed in a table called "Alarms and Recent Events." Check it out. With any of these previous snapshots, you can create a copy of it. In order to do this I go to "Snapshots" under the dashboard and choose the latest of the database I want. Then I choose to create a copy of it by hitting the "Copy Snapshot" button. This creates a new DB instance. 

Once the new DB instance is done being created, I can get the endpoint of that new instance in the main "Instances" part of the dashboard. I can cut that URL into my clipboard. Next I head over to my terminal and navigate to the directory where I want my DB copy to end up. I run the following command:

{% highlight sql %}

	pg_dump -h dbname.caeqx93pqge8.us-west-1.rds.amazonaws.com -U joschmoe  -d dbnamefoo > bar.sql

{% endhighlight %}

In the above snippet, you can see a rough example of what it should look like. There the phrase `pg_dump`, followed by `-h` for host. Next is that URL endpoint, pasted in. Afterwards is `-U` for user followed by the user name for the PostgreSQL instance running on that RDS instance. Next is `-d` for the database name. Above I have given an arbitrary name. This is then all followed by a `>` directing that database to be dumped to the following directory endpoint. In my case I have placed it directly in the directory to which I have presently navigated, under the name `bar.sql`.

Once that is done I drop into `psql` in the command line and `\l` to check if the database I want already exists. It does, so I drop that older version (that is getting replaced) with my new `bar.sql` to move in as the replacement test database. After the drop and create database operations are run, I can leave `psql` and return out of that command line repl.

{% highlight sql %}

	psql createddbname < bar.sql

{% endhighlight %}

The final step is to load the replacement db into the now empty database. Once that operation is complete you should be good to go.

