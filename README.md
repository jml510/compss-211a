# COMPSS 211A

[![Datahub](https://img.shields.io/badge/launch-datahub-blue)](https://datahub.berkeley.edu/hub/user-redirect/git-pull?repo=https%3A%2F%2Fgithub.com%2Fmacss-berkeley%2Fcompss-211a&branch=main&urlpath=vscode%2F%3Ffolder%3D%2Fhome%2Fjovyan%2Fcompss-211a)
[![License: CC BY 4.0](https://img.shields.io/badge/License-CC_BY_4.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/)

This repository contains the materials for COMPSS 211A: Computing I. The course is for master's students in computational social science, and it is built around the work you will actually need to do: manage files, write and debug Python, collect data, analyze text, collaborate through Git, and explain what your results do and do not show.

During the semester, you will:

- use Python and Pandas to work with tabular data;
- use Git, GitHub, and the command line to keep projects organized and reviewable;
- compare CSV, JSON, and XML data, then collect records through web APIs;
- clean and represent text with counts, TF-IDF, and lightweight document embeddings;
- test AI-generated code and evaluate LLM output against simpler methods;
- move selected workflows between local VS Code, Google Colab, and cloud APIs.

The course ends with a team project based on a text dataset. Your team will pose a social-science question, build a reproducible analysis, inspect errors and limitations, and present the result through a reproducible repository, a public-facing website, and a short website walkthrough.

## Local setup

**First time?** Complete [SETUP.md](SETUP.md). It is the authoritative guide for
installing `uv`, Visual Studio Code, and the required extensions; cloning the
repository; creating the course environment; and selecting the notebook kernel.

After completing that setup, open a terminal in your cloned repository and use
this returning-user workflow:

```bash
git pull
uv sync --frozen
code .
```

This updates the course files, refreshes the locked `.venv` environment, and
opens the complete repository in VS Code.

Work in your own copies of course notebooks, not the originals: duplicate a
notebook in the same folder and add `_mine` to the end of its name (for example
`week05_live_workspace_mine.ipynb`). Git ignores these copies, so pulling never
causes a conflict. See [Working on your own copies](SETUP.md#working-on-your-own-copies).

For [Week 4: Building Reproducible Analyses](lessons/week04_reproducible-analyses/README.md),
copy the entire practice folder as described on the lesson page: you will edit a
Python script as well as the notebook.

For [Week 5: Relational Data in Python](lessons/week05_relational-data/week05_live_workspace.ipynb),
use the live workspace for the 120-minute lesson and linked slides.

## Course data

The local fixtures required by homework and lab notebooks are committed under
[`data/`](data/). Several of the real datasets have a `*_provenance.json` file
beside them that records the source, the request, and the retrieval date. The
notebook that uses a file explains what it can and cannot show.

## Google Colab

Colab runs notebooks in a browser. Homework and lab notebooks that use tracked
fixtures must be run with the complete course repository or student package,
not as a standalone notebook: upload and extract the package under `/content`,
open the notebook from that copy, and then run its setup cell. The setup cell
locates the repository-level `data/` directory automatically.

Use Colab's default **latest runtime**. If a notebook needs a package that Colab does not supply, its instructions will provide the install command.

Lesson notebooks with an explicit raw-GitHub data fallback can instead be
opened directly from GitHub:

1. Go to [Google Colab](https://colab.research.google.com/).
2. Select **File -> Open notebook**, then choose the **GitHub** tab.
3. Enter this repository's URL and select the notebook.
4. Select **File -> Save a copy in Drive** before making changes. The repository copy is read-only, and the Colab runtime is temporary.

Most required notebooks use packages already present in Colab. If a notebook uses web-text or PDF extraction, install the small Colab supplement in its first cell:

```python
%pip install -q -r https://raw.githubusercontent.com/macss-berkeley/compss-211a/main/requirements-colab.txt
```

Before submitting an assignment, restart the runtime, run every cell from top to bottom, save the notebook, and download the finished `.ipynb` file for bCourses.

Weeks on Git, the command line, or local package management still require the local setup above. The assignment or lesson will say when local work is required. See [SETUP.md](SETUP.md) for the full local and Colab instructions.

## Contributors

- [Tom van Nuenen](https://github.com/tomvannuenen)
- [Arul Murugan Renganathan](mailto:arul@berkeley.edu)
- [Pratik Sachdeva](https://github.com/pssachdeva)
