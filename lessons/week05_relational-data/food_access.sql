-- Food access in California counties
--
-- Work in pairs on one laptop. One person types. The other says what each
-- result should look like before you run it. Swap after part 2.
--
-- Work in a copy of this file called food_access_mine.sql, in this folder.
-- In the VS Code terminal, go to this folder, start DuckDB and load your copy:
--
--     cd lessons/week05_relational-data
--     duckdb
--     .read food_access_mine.sql
--
-- Loading prints nothing, because the setup only creates the tables.
-- Write each query in your copy, under its question. Then copy that one query,
-- up to and including its semicolon, paste it at the DuckDB prompt and press
-- Enter. Paste one query at a time. If a query has an error, DuckDB shows
-- where the problem is: fix it in your copy and paste it again.
-- Lines that start with -- are comments. DuckDB skips them.
--
-- When you finish, type .quit, then check that the whole file runs on its own:
--
--     duckdb -f food_access_mine.sql
--
-- The question: a food-access nonprofit wants to know which three California
-- counties to look at first.
--
-- tracts has one row per census tract, a small area with a few thousand
-- residents. low_income_low_access is 1 when USDA flags the tract as
-- low-income and far from a store that accepts SNAP benefits, and 0 if not.
-- counties has one row per county, with its code (county_fips) and its name.
--
-- Because the flag is 1 or 0, its sum is the number of flagged tracts and its
-- average is the share of tracts that are flagged. For four tracts flagged
-- 1, 0, 1, 0: SUM gives 2 and AVG gives 0.5.


-- SETUP: load the two CSV files from the course data folder.
-- The first line tells DuckDB where that folder is, from this folder or from
-- the top of the course folder.
-- The codes are read as text, so a code such as 06001 keeps its leading zero.

SET file_search_path = '../../data,data';

CREATE OR REPLACE TABLE tracts AS
SELECT * FROM read_csv('week05_food_access_tracts.csv',
                       types = {'tract_id': 'VARCHAR', 'county_fips': 'VARCHAR'});

CREATE OR REPLACE TABLE counties AS
SELECT * FROM read_csv('week05_ca_counties.csv',
                       types = {'county_fips': 'VARCHAR'});


-- 1. LOOK AT THE DATA

-- Show the first five rows of each table.


-- Count all tracts, and count the flagged tracts, in one query.
-- You should get 9109 and 426.



-- 2. BUILD A COUNTY SUMMARY

-- This view adds the county name to each tract. Leave it as it is.
-- A view is a saved query that you can use like a table.

CREATE OR REPLACE VIEW tracts_named AS
SELECT t.*, c.county_name
FROM tracts AS t
LEFT JOIN counties AS c
    ON t.county_fips = c.county_fips;

-- Make a view called county_summary with one row per county and four columns:
--   county_name
--   tracts      the number of tracts
--   flagged     the number of flagged tracts
--   share       the share of tracts that are flagged
-- Start with: CREATE OR REPLACE VIEW county_summary AS


-- Check the view before you use it. It should have 58 rows,
-- tracts should add up to 9109, and flagged should add up to 426.


-- Swap roles.


-- 3. CHOOSE THREE COUNTIES

-- Show the three counties with the most flagged tracts.
-- Then show the three counties with the largest share of flagged tracts.
-- Show county_name, tracts, flagged and share both times.


-- Which three would you send to the nonprofit, and why? Be ready to say.


-- 4. SAVE THE SUMMARY AS A CSV FILE

-- Remove the -- at the start of the next two lines, then paste them at the
-- prompt. They write county_summary.csv to this folder.

-- COPY (SELECT * FROM county_summary ORDER BY county_name)
-- TO 'county_summary.csv' (HEADER);


-- IF YOU FINISH EARLY

-- a. Add two columns to county_summary:
--      people          SUM(population_2020)
--      people_flagged  SUM(population_2020 * low_income_low_access)
--    Which three counties have the most people living in flagged tracts?
--
-- b. Are rural tracts flagged more often than urban ones?
--    area_type is Rural or Urban.


-- MORE PRACTICE WITH THE 311 DATA
-- These are the requests and districts tables from the SQL workspace.

CREATE OR REPLACE TABLE requests AS
SELECT * FROM read_csv('sf311_requests.csv', types = {'request_id': 'VARCHAR'})
WHERE channel IS DISTINCT FROM 'Test';

CREATE OR REPLACE TABLE districts AS
SELECT sup_dist AS district, sup_dist_name AS district_name
FROM read_csv('sf_supervisor_districts.csv');

-- c. Show the five categories with the most Open requests, with their counts.
--    Largest first. The first should be Graffiti Public, with 233.
--
-- d. Count the Phone requests for each district name. Keep the requests with
--    no matching district. Largest first. The counts should add up to 3032.
