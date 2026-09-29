"""Check every code drill in real Python: the model answer passes, the starter code does not,
and the second run (changed values or a sample of the table) changes the answer,
or the check calls a function on several inputs, so typing
in the result can't pass. Run from the repository:  uv run python docs/practice/scripts/check_drills.py
"""
import contextlib
import io
import json
import os
import subprocess
import sys
import tempfile

DUMP = ("import('./drills.mjs').then(async m => { const d = await import('./drill-data.mjs');"
        " console.log(JSON.stringify({drills: m.drills, setup: m.drillSetup, variant: m.drillSetupVariant,"
        " checker: m.drillChecker, files: d.drillFiles})); })")
spec = json.loads(subprocess.run(["node", "-e", DUMP], cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))), capture_output=True, text=True, check=True).stdout)
os.chdir(tempfile.mkdtemp())
for name, text in spec["files"].items():
    with open(name, "w") as f:
        f.write(text)
checker = {}
exec(spec["checker"], checker)


def run(setup, code):
    ns = {"__name__": "__main__"}
    with contextlib.redirect_stdout(io.StringIO()):
        exec(setup, ns)
        try:
            exec(code, ns)
            return ns, True
        except Exception:
            return ns, False


def swap(drill, code):
    for old, new in drill["check"].get("variants", []):
        code = code.replace(old, new)
    return code


problems = []
for d in spec["drills"]:
    check = json.dumps(d["check"])
    answer, _ = run(spec["setup"][d["data"]], d["solution"])
    same, ok = run(spec["setup"][d["data"]], d["solution"])
    if not ok or checker["_drill_check"](same, answer, check):
        problems.append(f"{d['id']}: the model answer does not pass its own check")
    starter, ok = run(spec["setup"][d["data"]], d["starter"])
    if ok and not checker["_drill_check"](starter, answer, check):
        problems.append(f"{d['id']}: the starter code already passes")
    if d["check"].get("variants") or spec["variant"][d["data"]]:
        # The original answer, checked against the second run, must fail: otherwise a typed-in result passes.
        answer2, _ = run(spec["variant"][d["data"]], swap(d, d["solution"]))
        if not checker["_drill_check"](answer, answer2, check):
            problems.append(f"{d['id']}: the second run gives the same answer, so a typed-in result would pass")
    elif not all("(" in expr for expr in d["check"]["exprs"]):
        # Drills that call a function on several inputs don't need a second run.
        problems.append(f"{d['id']}: no second run, and the check doesn't call a function")

print(f"Checked {len(spec['drills'])} drills.")
print("\n".join(problems) or "All model answers pass, starters fail, and typed-in results can't pass.")
sys.exit(1 if problems else 0)
