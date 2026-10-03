# Week 5: Relational data and SQL

On Monday:

1. The [Week 5 SQL workspace](https://macss-berkeley.github.io/compss-211a/interactives/week05-sql-workspace.html), in your browser.
2. At the end of class, in pairs: [food_access.sql](food_access.sql), with DuckDB on your laptop.

On Friday: [Lab 5: SQL from Python](../../lab/lab05_sql_from_python.ipynb) runs the same SQL from Python, next to pandas. HW3 uses the same setup.

## Before class: install DuckDB

DuckDB is a free SQL database that runs on your laptop. Install the command-line version.

On macOS, run this in the terminal (or `brew install duckdb` if you use Homebrew):

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

## In class

1. In GitHub Desktop, pull the latest course files.
2. In VS Code, open `food_access.sql` in this folder. Save a copy as `food_access_mine.sql` in the same folder (File > Save As). Work in your copy.
3. Open the VS Code terminal, go to this folder, start DuckDB and load your copy:

   ```bash
   cd lessons/week05_relational-data
   duckdb
   ```

   ```sql
   .read food_access_mine.sql
   ```

4. Write each query in your copy. Then copy that one query, up to and including its semicolon, paste it at the DuckDB prompt and press Enter. Paste one query at a time: if you paste several at once, DuckDB can lose part of the second.
5. When you finish, type `.quit`, then check that the whole file runs on its own:

   ```bash
   duckdb -f food_access_mine.sql
   ```

If DuckDB says `cannot open "food_access_mine.sql"` or `No files found`, you started it in a different folder: type `.quit`, run the `cd` command above, and start again.

Git ignores `food_access_mine.sql` and the `county_summary.csv` file it makes, so pulling course updates does not change them.

## If DuckDB does not run on your laptop

Use your partner's laptop. If DuckDB runs on neither, open [DuckDB in your browser with the tables loaded](https://shell.duckdb.org/#queries=v0,CREATE-OR-REPLACE-TABLE-tracts-AS-SELECT-*-FROM-read_csv%28'https%3A%2F%2Fraw.githubusercontent.com%2Fmacss%20berkeley%2Fcompss%20211a%2Fmain%2Fdata%2Fweek05_food_access_tracts.csv'%2C-types-%3D-%7B'tract_id'%3A-'VARCHAR'%2C-'county_fips'%3A-'VARCHAR'%7D%29~,CREATE-OR-REPLACE-TABLE-counties-AS-SELECT-*-FROM-read_csv%28'https%3A%2F%2Fraw.githubusercontent.com%2Fmacss%20berkeley%2Fcompss%20211a%2Fmain%2Fdata%2Fweek05_ca_counties.csv'%2C-types-%3D-%7B'county_fips'%3A-'VARCHAR'%7D%29~,CREATE-OR-REPLACE-TABLE-requests-AS-SELECT-*-FROM-read_csv%28'https%3A%2F%2Fraw.githubusercontent.com%2Fmacss%20berkeley%2Fcompss%20211a%2Fmain%2Fdata%2Fsf311_requests.csv'%2C-types-%3D-%7B'request_id'%3A-'VARCHAR'%7D%29-WHERE-channel-IS-DISTINCT-FROM-'Test'~,CREATE-OR-REPLACE-TABLE-districts-AS-SELECT-sup_dist-AS-district%2C-sup_dist_name-AS-district_name-FROM-read_csv%28'https%3A%2F%2Fraw.githubusercontent.com%2Fmacss%20berkeley%2Fcompss%20211a%2Fmain%2Fdata%2Fsf_supervisor_districts.csv'%29~,SHOW-TABLES~). The tables are already loaded there, so leave out the lines that load the CSV files (`SET` and `CREATE OR REPLACE TABLE`). Paste one query at a time, up to and including its semicolon, and press Enter if it does not run. If you paste several queries at once, only the first runs. Part 4 cannot save a file to your laptop from there.

## Hints

<details><summary>Part 1</summary>

`COUNT(*)` counts rows. `SUM(low_income_low_access)` adds up the 1s, so it counts the flagged tracts.

</details>

<details><summary>Part 2</summary>

Use `COUNT(*)`, `SUM` and `AVG` on `low_income_low_access`, from `tracts_named`, with `GROUP BY county_name`. The average of a column of 1s and 0s is the share of 1s. To check the view, select `COUNT(*)`, `SUM(tracts)` and `SUM(flagged)` from `county_summary`.

</details>

<details><summary>Part 3</summary>

Select from `county_summary`, sort with `ORDER BY flagged DESC` or `ORDER BY share DESC`, and keep three rows with `LIMIT 3`. Add `county_name` to the `ORDER BY` to break ties.

</details>

<details><summary>If you finish early</summary>

Multiplying the population by the flag keeps the population of a flagged tract and gives 0 for the others. For rural and urban tracts, group `tracts` by `area_type` and take the average of the flag.

</details>

<details><summary>More practice with the 311 data</summary>

These are steps 5 and 8 of the SQL workspace again. For c, filter with `WHERE status = 'Open'`, group by `category`, sort by the count and keep five rows. For d, join `districts` to `requests` on `district` with a `LEFT JOIN`, keep the Phone requests, and group by `district_name`.

</details>
