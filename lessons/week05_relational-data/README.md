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

- `week05_food_access_tracts.csv` has one row per census tract, a small area with a few thousand residents. `low_income_low_access` is 1 when USDA flags the tract as low-income and far from a store that accepts SNAP benefits, and 0 if not.
- `week05_ca_counties.csv` has one row per county, with its code (`county_fips`) and its name.

Because the flag is 1 or 0, its sum is the number of flagged tracts and its average is the share of tracts that are flagged. For four tracts flagged 1, 0, 1, 0, `SUM` gives 2 and `AVG` gives 0.5.

Work in pairs on one laptop. One person types. The other says what the result should be before it runs. Swap after question 2.

### 1. Start DuckDB and load the data

In GitHub Desktop, pull the latest course files. Then open the VS Code terminal, go to this folder and start DuckDB:

```bash
cd lessons/week05_relational-data
duckdb
```

At the DuckDB prompt, load each CSV file as a table. DuckDB reads a CSV file when you put its path in quotes after `FROM`, and `CREATE TABLE ... AS` saves the result under a name. Paste one line at a time and press Enter:

```sql
CREATE TABLE tracts AS SELECT * FROM '../../data/week05_food_access_tracts.csv';
CREATE TABLE counties AS SELECT * FROM '../../data/week05_ca_counties.csv';
```

Then look at a few rows of each table, for example `SELECT * FROM tracts LIMIT 5;`.

At the prompt, end each query with a semicolon and press Enter. The up arrow brings back your last query so you can fix it. `.quit` closes DuckDB. If DuckDB says `No files found`, you started it in another folder: type `.quit`, run the `cd` command above, and start again.

### 2. Answer three questions

1. How many tracts are there, and how many of them are flagged? You should get 9,109 and 426.
2. Which five counties have the most flagged tracts? The county names are in `counties`, so you need both tables. The first is Riverside County, with 67.
3. Which five counties have the largest share of their tracts flagged? Show how many tracts each one has. Which of the two lists would you give the nonprofit, and why? Be ready to say.

### 3. Save your answer as a script

Open `food_access.sql` in VS Code and save a copy as `food_access_mine.sql` in this folder. Paste your query from question 2 or 3 at the end of your copy and save it. In the terminal, type `.quit`, then run:

```bash
duckdb -f food_access_mine.sql
```

The script loads the data and runs your query from the start, as `run_report.py` did last week. Anyone with the course files can run it and get the same result. Git ignores `food_access_mine.sql`, so pulling course updates does not change it.

### If you finish early

- Count the people who live in flagged tracts in each county, with `SUM(population_2020 * low_income_low_access)`. Which five counties have the most?
- Are rural tracts flagged more often than urban ones? `area_type` is Rural or Urban.

## If DuckDB does not run on your laptop

Use your partner's laptop. If DuckDB runs on neither, open [DuckDB in your browser with the two tables loaded](https://shell.duckdb.org/#queries=v0,CREATE-TABLE-tracts-AS-SELECT-*-FROM-'https%3A%2F%2Fraw.githubusercontent.com%2Fmacss%20berkeley%2Fcompss%20211a%2Fmain%2Fdata%2Fweek05_food_access_tracts.csv'~,CREATE-TABLE-counties-AS-SELECT-*-FROM-'https%3A%2F%2Fraw.githubusercontent.com%2Fmacss%20berkeley%2Fcompss%20211a%2Fmain%2Fdata%2Fweek05_ca_counties.csv'~,SHOW-TABLES~). Skip the two `CREATE TABLE` lines, because the tables are already there. Paste one query at a time and press Enter if it does not run; if you paste several queries at once, only the first runs. Part 3 needs DuckDB on a laptop.

## Hints

<details><summary>Question 1</summary>

`COUNT(*)` counts rows. `SUM(low_income_low_access)` adds up the 1s, so it counts the flagged tracts.

</details>

<details><summary>Question 2</summary>

Join `counties` to `tracts` on `county_fips`, as in step 8 of the SQL workspace. Then group by `county_name`, add up the flag with `SUM`, sort with `ORDER BY ... DESC`, and keep five rows with `LIMIT 5`.

</details>

<details><summary>Question 3</summary>

Start from your query for question 2. Add `COUNT(*)` for the number of tracts and `AVG(low_income_low_access)` for the share, and sort by the share.

</details>
