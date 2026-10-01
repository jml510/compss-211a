# Week 5 food-access data

The independent SQL exercise uses real published records for California. The assignment places students in the role of an analyst preparing a preliminary county briefing for a statewide food-access nonprofit. The client scenario is hypothetical; the observations are not fabricated.

## Sources and scope

- **USDA Economic Research Service, 2025 SNAP-authorized Retailer Access Map (SRAM)**, released July 2026: [download page](https://www.ers.usda.gov/data-products/food-access-research-atlas/download-the-data), [reference guide](https://www.ers.usda.gov/data-products/food-access-research-atlas/documentation/snap-authorized-retailer-access-map-reference-guide), [technical methods](https://www.ers.usda.gov/data-products/food-access-research-atlas/documentation/snap-authorized-retailer-access-map-data-sources-and-technical-methods). The extract contains all **9,109 California rows published in the source**, not a random sample. It combines the general tract characteristics and driving-distance tables by their 2020 census tract identifier.
- **U.S. Census Bureau, 2020 county gazetteer**: [source page](https://www.census.gov/geographies/reference-files/2020/geo/gazetter-file.html). The lookup contains all **58 California counties**, with their published codes and names. The geography vintage matches the tract identifiers.

Both archives were retrieved September 30, 2026. Source URLs, archive hashes, output hashes, and column mappings are recorded in `../../data/week05_food_access_provenance.json`. The dated source archives are kept outside version control; students need only the two checked-in CSVs, with no download or account required.

## Classroom tables

| Table / column | Meaning and source |
| --- | --- |
| `tracts.tract_id` | One row per published census tract; `CensusTract20`, preserved as 11-character text. |
| `tracts.county_fips` | First five characters of the tract identifier; a county code, not a quantity. |
| `tracts.area_type` | USDA `Urban`: 1 is labelled `Urban`, 0 is labelled `Rural`. |
| `tracts.population_2020` | `POP2020`, total tract population from Census 2020. |
| `tracts.low_access` | `DD_SRAM_LA1and10`, USDA's driving-distance low-access flag, without an income condition. |
| `tracts.low_income_low_access` | `DD_SRAM_LILATracts_1And10`, USDA's combined low-income/low-access flag. |
| `counties.county_fips` | Census `GEOID`, unique five-character county identifier. |
| `counties.county_name` | Census `NAME`. |

For the two flags, **1 means flagged, 0 means not flagged, and a blank means unavailable/not applicable in the source**. The low-access measure uses distance to the nearest retailer authorized to accept SNAP benefits: more than 1 mile in urban tracts or 10 miles in rural tracts, with at least 500 residents or 33% of the tract population beyond the threshold. The combined indicator also applies USDA's tract-level income criteria. These are tract classifications, not individual eligibility assessments. See the USDA reference guide for full definitions.

The source brings together June 2025 retailer listings, 2020 population information, and 2020–24 ACS income estimates. The “2025” dataset is therefore not a survey of all conditions measured on one date. Distances are along roads, not straight lines; SNAP-authorized retailers are not limited to supermarkets.

## Preparation and integrity

The preparation script filters to California, normalizes the general table's tract identifiers with leading zeros, verifies a one-to-one source join, selects columns, renames them, and labels the urban/rural flag. County codes are derived from tract codes and checked against the Census lookup and USDA's original county names. Source county-name columns are omitted from the student tract table so students can practise attaching labels through a standard code lookup.

No observations or missing values were invented, removed within the California subset, or imputed. The **12 missing `low_access` values remain missing**. The combined flag is retained exactly as published, including on these rows; it is not recomputed. All county keys match, so a correct left join has zero unmatched records. This is a real result, not an error to manufacture for an exercise.

The exercise reports counts of **tracts**. These do not directly measure food insecurity, people needing assistance, or the share of a county affected. Counties contain different numbers of tracts. `population_2020` is everyone in a tract, not the population beyond the distance threshold. A preliminary briefing can identify patterns for follow-up; it cannot establish service priorities from these counts alone.

## Rebuilding the extracts

Download the two ZIP archives linked in the provenance file, then run from the course root:

```sh
python lessons/week05_relational-data/prepare_food_access_data.py \
  --usda-zip /path/to/usda-sram-2025.zip \
  --census-zip /path/to/census-counties-2020.zip
```

The script uses the Python standard library and writes both CSVs and provenance. Its checks target this saved release; a later USDA revision may require reviewing those checks and regenerating the teaching answers. If downloading another snapshot, update the recorded retrieval date as well. Instructor-only model answers and interpretation are in the teaching notebook, not in this student-accessible source note.
