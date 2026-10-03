# Course setup

You may complete most course notebooks either locally or in Google Colab. The local route is required for work involving the command line, Git, or project environments.

## Local setup

The course uses `uv` to install the right Python version and the packages recorded in `uv.lock`. You do not need to install Python, Conda, or a separate Jupyter kernel first.

### 1. Install uv

On macOS or Linux, open a terminal and run the installer from the [official uv documentation](https://docs.astral.sh/uv/getting-started/installation/):

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

On Windows, open PowerShell and run:

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Close and reopen the terminal, then check the installation:

```bash
uv --version
```

### 2. Download the course repository

```bash
git clone https://github.com/macss-berkeley/compss-211a.git
cd compss-211a
```

If you already cloned the repository, open a terminal in that folder and run `git pull` instead.

### 3. Create the course environment

```bash
uv sync --frozen
```

This creates a private `.venv` folder inside the repository. It also installs Python 3.13 if your computer does not already have a compatible version. The command uses `uv.lock`, so everyone receives the same tested package versions.

### 4. Install VS Code and its Python tools

Install [Visual Studio Code](https://code.visualstudio.com/) and these two
Microsoft extensions from the Extensions view:

- [Python](https://marketplace.visualstudio.com/items?itemName=ms-python.python)
- [Jupyter](https://marketplace.visualstudio.com/items?itemName=ms-toolsai.jupyter)

You need both extensions to edit Python comfortably and run `.ipynb` notebook
cells inside VS Code.

### 5. Open the repository in VS Code

From the repository folder, run:

```bash
code .
```

If the `code` command is unavailable, open VS Code, choose **File -> Open
Folder**, and select the complete `compss-211a` repository. Do not open only an
individual notebook file; opening the repository lets VS Code discover the
course environment and data files.

### 6. Select the course environment

1. Open the VS Code Command Palette with <kbd>Command</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>
   on macOS or <kbd>Control</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> on Windows/Linux.
2. Run **Python: Select Interpreter**.
3. Choose the interpreter inside this repository's `.venv` folder. Its path
   ends in `.venv/bin/python` on macOS/Linux or `.venv\Scripts\python.exe` on
   Windows.
4. Open an `.ipynb` file, click **Select Kernel** in the upper-right corner,
   choose **Python Environments**, and select the same `.venv` environment
   running Python 3.13.

VS Code now starts the notebook backend when you run a cell. You do not need to
run `uv run jupyter lab` or create a separately registered kernel named
`compss211`.

### Optional: use JupyterLab in a browser

VS Code is the default local workflow. If you prefer the browser interface for
a particular session, you can still run:

```bash
uv run jupyter lab
```

To stop JupyterLab, return to the terminal and press <kbd>Control</kbd>+<kbd>C</kbd>.

## Google Colab

Colab is a supported alternative for most notebooks:

1. Open [Google Colab](https://colab.research.google.com/).
2. Choose **File -> Open notebook -> GitHub**.
3. Enter `https://github.com/macss-berkeley/compss-211a` and choose a notebook.
4. Choose **File -> Save a copy in Drive** before editing.

The command-line, Git, and local-environment exercises still require the local setup. Individual notebooks will say when that is the case.

## Working on your own copies

Don't edit the course notebooks directly. Before you start working in one,
duplicate it and add `_mine` to the end of the name, before `.ipynb`:
`week04_reproducible_analysis.ipynb` becomes `week04_reproducible_analysis_mine.ipynb`. Keep
the copy in the same folder so its data paths keep working.

Git ignores `_mine` copies, so they never appear in GitHub Desktop's
**Changes** tab and never conflict with course updates. The original files stay
untouched, so pulling always works, even when materials change mid-semester.

If you already edited an original notebook:

1. Rename it so it ends in `_mine.ipynb`. Do this first.
2. In GitHub Desktop, right-click in the list of changed files and choose
   **Discard All Changes** to restore the original course files. Discarded
   changes go to your Trash/Recycle Bin.
3. Click **Fetch origin**, then **Pull origin**.

## API keys

Some weeks call an online service that needs an API key (a password for
programs). Gemini, used from Week 10 and in HW5, is one of them. Keep keys in a
file named `.env` in the top folder of the repository. Git ignores this file,
so your keys never end up on GitHub.

1. In VS Code's file list, find `.env.example` in the top folder. Right-click it,
   choose **Copy**, then right-click the top folder and choose **Paste**.
2. Rename the copy to exactly `.env`: no `.txt` at the end and nothing before the dot.
3. Open `.env` and replace `paste-your-gemini-key-here` with your key. No quotes,
   no spaces around the `=`:

   ```text
   GEMINI_API_KEY=AIzaSy...your-key...
   ```

4. Save the file. Then run `git status`: `.env` must **not** appear in the list.
   If it does, stop and ask the instructional team before committing anything.

The course notebooks read `.env` for you and only ever print whether a key was
found, never the key itself. Don't paste a key into a notebook cell, and don't
share your `.env` file.

On macOS, Finder hides files whose names start with a dot. VS Code shows them,
so create and edit `.env` there.

**In Colab**, there is no `.env` file. Instead, click the key icon
(**Secrets**) in the left sidebar, add a secret with the same name, for example
`GEMINI_API_KEY`, and turn on **Notebook access**. The notebooks check there
automatically.

If a key ever ends up in a commit, a screenshot, or a message, delete it in
[Google AI Studio](https://aistudio.google.com/apikey) and make a new one.

## Updating later

Pull new course materials with **Fetch origin** and then **Pull origin** in
GitHub Desktop, or `git pull` in a terminal. Then refresh your environment with:

```bash
uv sync --frozen
```

Then reopen the repository in VS Code. If it was already open, verify that the
notebook kernel still points to the repository's `.venv` environment.

## What the setup files do

- `pyproject.toml` is the readable list of packages and the supported Python version.
- `uv.lock` is the exact, computer-generated record that makes installs reproducible.
- `.python-version` tells uv which Python version to use for this project.
- `.venv/` is the local environment uv creates on your computer. Git ignores it.
- `requirements-colab.txt` contains only the occasional additions needed in Colab.
- `.env.example` is a template for your API keys. Your own copy, `.env`, holds the real keys and is ignored by Git.

Students should not edit these files or run `uv add` for ordinary course work. If an assignment appears to need another package, ask the instructional team first.

## If something goes wrong

First make sure the terminal is in the course repository. The command `pwd` on macOS/Linux or `Get-Location` in PowerShell should end in `compss-211a`.

Then run these checks:

```bash
git status
uv --version
uv run python --version
uv run python -c "import pandas; print(pandas.__version__)"
```

In VS Code, also confirm that the Microsoft Python and Jupyter extensions are
enabled and that both the selected interpreter and notebook kernel point to
`.venv`. If `.venv` is not listed, run **Python: Select Interpreter -> Enter
interpreter path** and select it directly.

Copy the complete output when asking for help. Do not delete `.venv/` or reinstall several Python distributions unless the instructional team asks you to; the error message usually points to a smaller fix.
