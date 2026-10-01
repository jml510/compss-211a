"""Rebuild the Week 5 classroom extracts from the two official source ZIPs.

Run with --usda-zip PATH --census-zip PATH. Source URLs and definitions are in
food_access_sources.md. No sampling, fabricated records, or imputation.
"""

import argparse
import csv
import hashlib
import io
import json
from pathlib import Path
import zipfile


def rows(archive, member, encoding="utf-8-sig", delimiter=","):
    return list(csv.DictReader(io.StringIO(archive.read(member).decode(encoding)), delimiter=delimiter))


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--usda-zip", type=Path, required=True)
    parser.add_argument("--census-zip", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).resolve().parents[2] / "data")
    args = parser.parse_args()
    with zipfile.ZipFile(args.usda_zip) as archive:
        general = [r for r in rows(archive, "SRAM General Tract Characteristics Data.csv", "cp1252") if r["State"] == "California"]
        driving = [r for r in rows(archive, "SRAM Driving Distance Data.csv", "cp1252") if r["State"] == "California"]
    with zipfile.ZipFile(args.census_zip) as archive:
        counties = [{"county_fips": r["GEOID"], "county_name": r["NAME"]}
                    for r in rows(archive, "2020_Gaz_counties_national.txt", delimiter="\t") if r["USPS"] == "CA"]
    general_by_id = {r["CensusTract20"].zfill(11): r for r in general}
    driving_by_id = {r["CensusTract20"].zfill(11): r for r in driving}
    assert len(general_by_id) == len(general) == len(driving_by_id) == len(driving) == 9109
    assert general_by_id.keys() == driving_by_id.keys()
    county_names = {r["county_fips"]: r["county_name"] for r in counties}
    assert len(county_names) == len(counties) == 58
    tracts = []
    for tract_id, d in sorted(driving_by_id.items()):
        g = general_by_id[tract_id]
        assert len(tract_id) == 11 and tract_id.isdigit() and tract_id.startswith("06")
        assert county_names[tract_id[:5]] == d["County20"] == g["County20"]
        tracts.append({
            "tract_id": tract_id,
            "county_fips": tract_id[:5],
            "area_type": {"1": "Urban", "0": "Rural"}[g["Urban"]],
            "population_2020": g["POP2020"],
            "low_access": d["DD_SRAM_LA1and10"],
            "low_income_low_access": d["DD_SRAM_LILATracts_1And10"],
        })
    assert sum(r["low_access"] == "" for r in tracts) == 12
    assert sum(float(r["low_income_low_access"]) == 1 for r in tracts) == 426
    args.output_dir.mkdir(parents=True, exist_ok=True)
    outputs = {}
    for name, records in [("week05_food_access_tracts.csv", tracts), ("week05_ca_counties.csv", sorted(counties, key=lambda r: r["county_fips"]))]:
        path = args.output_dir / name
        with path.open("w", newline="", encoding="utf-8") as stream:
            writer = csv.DictWriter(stream, fieldnames=list(records[0]), lineterminator="\n")
            writer.writeheader()
            writer.writerows(records)
        outputs[name] = {"rows": len(records), "sha256": sha256(path)}
    provenance = {
        "retrieved_on": "2026-09-30",
        "sources": [
            {"name": "USDA ERS 2025 SNAP-authorized Retailer Access Map; released July 2026",
             "url": "https://www.ers.usda.gov/media/29395/2025-snap-authorized-retailer-access-map-sram-data.zip?v=73485",
             "sha256": sha256(args.usda_zip)},
            {"name": "Census Bureau 2020 national county gazetteer",
             "url": "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_Gaz_counties_national.zip",
             "sha256": sha256(args.census_zip)},
        ],
        "scope": "Every California row published in these USDA tables, and every California county in the Census lookup. No sampling or imputation.",
        "transformations": [
            "Filter USDA State=California and Census USPS=CA.",
            "Pad USDA general-characteristics tract IDs to 11 characters; verify a one-to-one join to the driving-distance table.",
            "Derive county_fips from the first five tract ID characters; validate against Census county codes and source county names.",
            "Select and rename columns; Urban 1/0 becomes Urban/Rural. Keep source values and blanks otherwise unchanged; sort by identifier.",
        ],
        "field_mapping": {
            "tract_id": "CensusTract20, normalized to 11-character text",
            "county_fips": "first five characters of CensusTract20; Census GEOID in lookup",
            "area_type": "Urban: 1=Urban, 0=Rural",
            "population_2020": "POP2020",
            "low_access": "DD_SRAM_LA1and10",
            "low_income_low_access": "DD_SRAM_LILATracts_1And10",
            "county_name": "Census NAME",
        },
        "missingness": "12 source low_access blanks retained; no missing county matches. Published combined flag preserved independently, not recomputed from low_access.",
        "outputs": outputs,
    }
    (args.output_dir / "week05_food_access_provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")
    print(json.dumps(outputs, indent=2))


if __name__ == "__main__":
    main()
