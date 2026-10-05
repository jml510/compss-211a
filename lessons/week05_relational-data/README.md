# Week 5: Relational data and SQL

## Before class: install DuckDB

DuckDB is a free SQL database that runs on your laptop. Install the command-line version.

On macOS, run this in the terminal:

```bash
curl https://install.duckdb.org | bash
```

On Windows, run this in PowerShell:

```powershell
winget install DuckDB.cli
```

Then close the terminal, open a new one, and check that DuckDB runs:

```bash
duckdb -version
```

It should print a version number. If a Mac says `command not found`, run the line below, then open a new terminal and try again:

```bash
echo 'export PATH="$HOME/.duckdb/cli/latest:$PATH"' >> ~/.zshrc
```

Other ways to install are on the [DuckDB install page](https://duckdb.org/install/?environment=cli).

## Food access in pairs

A food-access nonprofit wants to know which California counties to look at first. Two CSV files in the course `data` folder can help:

- `week05_food_access_tracts.csv` has one row per census tract. A tract is a small area the Census Bureau uses for statistics, usually with 1,200 to 8,000 residents.
- `week05_ca_counties.csv` has one row per county, with its code (`county_fips`) and its name. Each tract has its county's code too.

The tract column to use is `low_income_low_access`. USDA sets it to 1, a flagged tract, when both of these are true:

- The tract is low-income: at least 20% of its residents live in poverty, or its median family income is at most 80% of the median for the state or metro area.
- Many residents live far from a store that accepts SNAP benefits (government help for buying food): at least 500 people, or a third of the tract, live more than 1 mile away in a city or more than 10 miles away in a rural area.

Otherwise it is 0. The full definitions are in [USDA's reference guide](https://www.ers.usda.gov/data-products/food-access-research-atlas/documentation/snap-authorized-retailer-access-map-reference-guide).

The flag works like `is_open` in the “Count, add up and average” step of the SQL workspace: its sum is the number of flagged tracts, and its average is the share of tracts that are flagged.

### 1. Start DuckDB and load the data

In GitHub Desktop, pull the latest course files. In VS Code, open `food_access.sql` in this folder and save a copy as `food_access_mine.sql` in the same folder. You will write your queries in this copy. Git ignores it, so pulling course updates does not change it.

Then open the VS Code terminal, go to this folder and start DuckDB:

```bash
cd lessons/week05_relational-data
duckdb
```

The first two lines of your file load each CSV file as a table. DuckDB reads a CSV file when you put its path in quotes after `FROM`, and `CREATE TABLE ... AS` saves the result under a name:

```sql
CREATE TABLE tracts AS SELECT * FROM '../../data/week05_food_access_tracts.csv';
CREATE TABLE counties AS SELECT * FROM '../../data/week05_ca_counties.csv';
```

Copy them from your file and paste them at the DuckDB prompt one at a time, pressing Enter after each.

Before writing your answers, inspect the data. Run these commands one at a time at the DuckDB prompt:

```sql
SHOW TABLES;
DESCRIBE counties;
DESCRIBE tracts;
SELECT * FROM counties LIMIT 5;
SELECT * FROM tracts LIMIT 5;
```

`SHOW TABLES` lists the tables. `DESCRIBE` shows a table's column names and data types. These inspection commands work in DuckDB; SQLite uses different commands. `SELECT * ... LIMIT 5` previews up to five records and works in both systems. 

End each query with a semicolon. `.quit` closes DuckDB. If DuckDB says `No files found`, you started it in another folder: type `.quit`, run the `cd` command above, and start again.

### 2. Answer three questions

Write each query in `food_access_mine.sql`, under the appropriate question. To run it, copy it from the file, paste it at the DuckDB prompt and press Enter. If it gives an error or an unexpected result, fix it in the file and paste it again.

1. How many tracts are there, and how many of them are flagged? You should get 9,109 and 426.
2. Which five counties have the most flagged tracts? The county names are in `counties`, so you need both tables. The first is Riverside County, with 67.
3. Which five counties have the largest share of their tracts flagged? Show how many tracts each one has. Which of the two lists would you give the nonprofit, and why? Be ready to say.

### 3. Run your file as a script

Save the file. In the terminal, type `.quit`, then run:

```bash
duckdb -f food_access_mine.sql
```

DuckDB loads the data and runs your queries from the start, as `run_report.py` did last week. Anyone with the course files can run it and get the same results. If DuckDB stops at an error, fix that query in the file and run the command again.

### If you finish early

- Count the people who live in flagged tracts in each county, with `SUM(population_2020 * low_income_low_access)`. Which five counties have the most?
- Are rural tracts flagged more often than urban ones? `area_type` is Rural or Urban.

## If DuckDB does not run on your laptop

Use your partner's laptop. If DuckDB runs on neither, open [DuckDB in your browser with the two tables loaded](https://shell.duckdb.org/#queries=v0,CREATE-TABLE-tracts-AS-SELECT-*-FROM-'https%3A%2F%2Fraw.githubusercontent.com%2Fmacss%20berkeley%2Fcompss%20211a%2Fmain%2Fdata%2Fweek05_food_access_tracts.csv'~,CREATE-TABLE-counties-AS-SELECT-*-FROM-'https%3A%2F%2Fraw.githubusercontent.com%2Fmacss%20berkeley%2Fcompss%20211a%2Fmain%2Fdata%2Fweek05_ca_counties.csv'~,SHOW-TABLES~). Skip the two `CREATE TABLE` lines, because the tables are already there. Write your queries in your file as above and paste them there one at a time; press Enter if a query does not run. If you paste several queries at once, only the first runs. Step 3 needs DuckDB on a laptop.

## Hints

<details><summary>Question 1</summary>

`COUNT(*)` counts rows. `SUM(low_income_low_access)` adds up the 1s, so it counts the flagged tracts.

</details>

<details><summary>Question 2</summary>

The “Join, then group” step of the SQL workspace has the same shape: a join, then `GROUP BY`. Join `counties` to `tracts` on `county_fips`, group by `county_name`, add up the flag with `SUM`, sort with `ORDER BY ... DESC`, and keep five rows with `LIMIT 5`.

</details>

<details><summary>Question 3</summary>

Start from your query for question 2. Add `COUNT(*)` for the number of tracts and `AVG(low_income_low_access)` for the share, and sort by the share.

</details>
