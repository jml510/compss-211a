-- Your answer as a script that anyone can run again.
--
-- 1. Save a copy of this file as food_access_mine.sql in this folder.
-- 2. Paste your query at the end of your copy and save it.
-- 3. In the terminal, in this folder, run:  duckdb -f food_access_mine.sql

-- Load the two CSV files from the course data folder as tables.
CREATE TABLE tracts AS SELECT * FROM '../../data/week05_food_access_tracts.csv';
CREATE TABLE counties AS SELECT * FROM '../../data/week05_ca_counties.csv';

-- Your query:

