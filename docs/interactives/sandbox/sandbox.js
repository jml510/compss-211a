/* COMPSS 211A sandbox: real Python (Pyodide) and a small terminal that share an in-memory file system.
 *
 *   Sandbox.python(element, {files, code, packages, root, setup})   (setup: hidden Python run once before the student's code)
 *   Sandbox.terminal(element, {files, packages, root, user, host})
 *
 * `files` maps relative paths to text ("outputs/" with a trailing slash makes an empty folder).
 * Python loads from jsDelivr on first use; nothing typed is saved or sent anywhere.
 */
(function () {
  "use strict";

  const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/";
  let pyodidePromise = null;
  const loadedPackages = new Set();
  let sink = null; // where Python's stdout/stderr currently go

  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (window.loadPyodide) return resolve();
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Python could not load. This part of the page needs an internet connection."));
      document.head.appendChild(s);
    });
  }

  const HELPERS = `
import ast, os, runpy, sys, traceback

def _sandbox_report(root, cell_name):
    et, ev, tb = sys.exc_info()
    frames = [f for f in traceback.extract_tb(tb) if f.filename.startswith(root) or f.filename == cell_name]
    if frames:
        print("Traceback (most recent call last):", file=sys.stderr)
        print("".join(traceback.format_list(frames)), end="", file=sys.stderr)
    # Report errno values the way macOS and Linux do (the browser runtime numbers some differently).
    message = "".join(traceback.format_exception_only(et, ev)).replace("[Errno 44]", "[Errno 2]")
    print(message, end="", file=sys.stderr)

def _sandbox_forget_local_modules(root):
    for name, module in list(sys.modules.items()):
        if (getattr(module, "__file__", None) or "").startswith(root):
            del sys.modules[name]

def _sandbox_run_file(path, args, root):
    _sandbox_forget_local_modules(root)
    script = os.path.abspath(path)
    old_argv, old_path = sys.argv, list(sys.path)
    sys.argv = [path] + list(args)
    sys.path.insert(0, os.path.dirname(script))
    try:
        runpy.run_path(script, run_name="__main__")
    except SystemExit as exit_:
        if exit_.code not in (None, 0):
            print(exit_.code, file=sys.stderr)
    except BaseException:
        _sandbox_report(root, "<cell>")
    finally:
        sys.argv, sys.path[:] = old_argv, old_path

def _sandbox_run_cell(code, namespace, root):
    _sandbox_forget_local_modules(root)
    here = os.getcwd()
    sys.path.insert(0, here)
    try:
        tree = ast.parse(code, "<cell>")
        last = None
        if tree.body and isinstance(tree.body[-1], ast.Expr):
            last = ast.Expression(tree.body.pop().value)
        exec(compile(tree, "<cell>", "exec"), namespace)
        if last is not None:
            value = eval(compile(last, "<cell>", "eval"), namespace)
            if value is not None:
                print(repr(value))
    except BaseException:
        _sandbox_report(root, "<cell>")
    finally:
        if here in sys.path:
            sys.path.remove(here)
`;

  async function getPython(packages, onStatus) {
    if (!pyodidePromise) {
      pyodidePromise = (async () => {
        onStatus("Starting Python in your browser (about 10 MB, only the first time)…");
        await loadScript(PYODIDE_URL + "pyodide.js");
        const py = await window.loadPyodide({indexURL: PYODIDE_URL});
        py.setStdout({batched: s => sink && sink(s + "\n", "out")});
        py.setStderr({batched: s => sink && sink(s + "\n", "err")});
        py.runPython(HELPERS);
        return py;
      })();
      pyodidePromise.catch(() => { pyodidePromise = null; });
    }
    const py = await pyodidePromise;
    const needed = (packages || []).filter(p => !loadedPackages.has(p));
    if (needed.length) {
      onStatus(`Loading ${needed.join(", ")} (only the first time)…`);
      await py.loadPackage(needed, {messageCallback: () => {}});
      needed.forEach(p => loadedPackages.add(p));
    }
    return py;
  }

  function isDir(FS, path) {
    try { return FS.isDir(FS.stat(path).mode); } catch (e) { return false; }
  }
  function exists(FS, path) {
    try { FS.stat(path); return true; } catch (e) { return false; }
  }
  function removeTree(FS, path) {
    if (!exists(FS, path)) return;
    if (FS.cwd() === path || FS.cwd().startsWith(path + "/")) FS.chdir("/"); // can't remove the working directory
    if (isDir(FS, path)) {
      for (const name of FS.readdir(path)) if (name !== "." && name !== "..") removeTree(FS, path + "/" + name);
      FS.rmdir(path);
    } else FS.unlink(path);
  }
  function writeFiles(FS, root, files) {
    FS.chdir("/"); // a folder can't be removed while it is the working directory
    removeTree(FS, root);
    FS.mkdirTree(root);
    for (const [rel, content] of Object.entries(files)) {
      const full = root + "/" + rel.replace(/\/$/, "");
      if (rel.endsWith("/")) { FS.mkdirTree(full); continue; }
      FS.mkdirTree(full.slice(0, full.lastIndexOf("/")));
      FS.writeFile(full, content);
    }
  }

  function normalize(path) {
    const parts = [];
    for (const part of path.split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") parts.pop(); else parts.push(part);
    }
    return "/" + parts.join("/");
  }

  /* ---------------- Python cell ---------------- */
  function python(el, opts) {
    const root = opts.root || "/home/you/notebook";
    const packages = opts.packages || [];
    const files = opts.files || {};
    let namespace = null;
    el.classList.add("sbx");
    el.innerHTML = `
      <div class="sbx-bar"><span class="sbx-label">Python · runs in your browser</span>
        <span class="sbx-actions"><button type="button" class="sbx-run">Run ▶</button><button type="button" class="sbx-reset">Reset</button></span></div>
      <textarea class="sbx-code" spellcheck="false" aria-label="Python code"></textarea>
      <div class="sbx-status" aria-live="polite"></div>
      <pre class="sbx-out" aria-live="polite" tabindex="0"></pre>`;
    const code = el.querySelector(".sbx-code"), out = el.querySelector(".sbx-out"), status = el.querySelector(".sbx-status");
    const runBtn = el.querySelector(".sbx-run");
    code.value = opts.code || "";
    const setStatus = t => { status.textContent = t; };

    async function run() {
      runBtn.disabled = true;
      out.innerHTML = "";
      try {
        const py = await getPython(packages, setStatus);
        if (!namespace) {
          writeFiles(py.FS, root, files);
          namespace = py.toPy({"__name__": "__main__"});
          if (opts.setup) { py.FS.chdir(root); await py.globals.get("_sandbox_run_cell")(opts.setup, namespace, root); }
        }
        py.FS.chdir(root);
        setStatus("Running…");
        sink = (text, kind) => { out.insertAdjacentHTML("beforeend", kind === "err" ? `<span class="sbx-err">${esc(text)}</span>` : esc(text)); };
        await py.globals.get("_sandbox_run_cell")(code.value, namespace, root);
        if (!out.textContent) out.innerHTML = '<span class="sbx-dim">(no output)</span>';
        setStatus("");
      } catch (err) {
        setStatus(err.message || String(err));
      } finally {
        sink = null;
        runBtn.disabled = false;
      }
    }
    runBtn.addEventListener("click", run);
    code.addEventListener("keydown", e => {
      if ((e.metaKey || e.ctrlKey || e.shiftKey) && e.key === "Enter") { e.preventDefault(); run(); }
      if (e.key === "Tab") { e.preventDefault(); const s = code.selectionStart; code.setRangeText("    ", s, code.selectionEnd, "end"); }
    });
    el.querySelector(".sbx-reset").addEventListener("click", async () => {
      code.value = opts.code || "";
      out.innerHTML = "";
      if (namespace) {
        const py = await getPython(packages, setStatus);
        writeFiles(py.FS, root, files);
        namespace = py.toPy({"__name__": "__main__"});
        if (opts.setup) { py.FS.chdir(root); await py.globals.get("_sandbox_run_cell")(opts.setup, namespace, root); }
      }
      setStatus("Reset: the code, the files, and Python's variables are back to the start.");
    });
  }

  /* ---------------- Terminal ---------------- */
  function terminal(el, opts) {
    const root = opts.root || "/Users/you/project";
    const home = root.slice(0, root.lastIndexOf("/")) || "/";
    const packages = opts.packages || [];
    const files = opts.files || {};
    const user = opts.user || "you", host = opts.host || "laptop";
    let cwd = root, prevCwd = null, FS = null, ready = null;
    const history = []; let histPos = 0;

    el.classList.add("sbx", "sbx-term");
    el.innerHTML = `
      <div class="sbx-bar"><span class="sbx-label">Terminal · real files, real Python, all in your browser</span>
        <span class="sbx-actions"><button type="button" class="sbx-reset">Reset</button></span></div>
      <div class="sbx-screen" tabindex="-1">
        <pre class="sbx-log" aria-live="polite"></pre>
        <div class="sbx-line"><span class="sbx-prompt"></span><input class="sbx-input" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Terminal command"></div>
      </div>
      <div class="sbx-editor" hidden>
        <div class="sbx-bar"><span class="sbx-label sbx-editing"></span>
          <span class="sbx-actions"><button type="button" class="sbx-run sbx-save">Save</button><button type="button" class="sbx-close">Close</button></span></div>
        <textarea class="sbx-code sbx-edit-area" spellcheck="false" aria-label="File editor"></textarea>
      </div>
      <div class="sbx-status" aria-live="polite"></div>`;
    const log = el.querySelector(".sbx-log"), input = el.querySelector(".sbx-input"), promptEl = el.querySelector(".sbx-prompt");
    const screen = el.querySelector(".sbx-screen"), status = el.querySelector(".sbx-status");
    const setStatus = t => { status.textContent = t; };
    const editor = el.querySelector(".sbx-editor"), editArea = el.querySelector(".sbx-edit-area"), editLabel = el.querySelector(".sbx-editing");
    let editing = null;
    const closeEditor = () => { editor.hidden = true; editing = null; input.focus(); };
    const shortDir = () => cwd === home ? "~" : cwd.slice(cwd.lastIndexOf("/") + 1) || "/";
    const promptText = () => `${user}@${host} ${shortDir()} % `;
    const print = (text, cls) => { log.insertAdjacentHTML("beforeend", cls ? `<span class="${cls}">${esc(text)}</span>` : esc(text)); screen.scrollTop = screen.scrollHeight; };
    const println = (text, cls) => print(text + "\n", cls);
    const updatePrompt = () => { promptEl.textContent = promptText(); };
    // Only the student's home folder is writable, so nobody can delete the files Python itself needs.
    const canWrite = p => p === home || p.startsWith(home + "/");
    const denied = (cmd, name) => println(`${cmd}: ${name}: Permission denied`, "sbx-err");
    const resolve = p => normalize(p.startsWith("/") ? p : p === "~" || p.startsWith("~/") ? home + p.slice(1) : cwd + "/" + p);
    updatePrompt();
    println(opts.welcome || "Type help to see the commands. Try: pwd, ls, cd, cat, head, python.", "sbx-dim");

    // Wipe the whole home folder (not just the project) and write the starting files again.
    function restore() { FS.chdir("/"); removeTree(FS, home); writeFiles(FS, root, files); }

    function start() {
      if (!ready) {
        ready = getPython([], setStatus).then(py => { FS = py.FS; restore(); setStatus(""); return py; });
        ready.catch(err => { setStatus(err.message); ready = null; });
      }
      return ready;
    }

    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    function longLine(path, name, human) {
      const st = FS.stat(path), dir = FS.isDir(st.mode), d = new Date(st.mtime);
      let size = String(dir ? 64 : st.size);
      if (human && !dir) size = st.size < 1024 ? `${st.size}B` : st.size < 1048576 ? `${(st.size / 1024).toFixed(st.size < 10240 ? 1 : 0)}K` : `${(st.size / 1048576).toFixed(1)}M`;
      const when = `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      const shown = dir ? `<span class="sbx-dir">${esc(name)}</span>` : esc(name);
      return esc(`${dir ? "drwxr-xr-x" : "-rw-r--r--"}  1 ${user}  staff  ${size.padStart(6)} ${when} `) + shown;
    }

    // Line-by-line comparison in the same format as the diff command on a Mac.
    function diffLines(a, b) {
      const A = a.replace(/\n$/, "").split("\n"), B = b.replace(/\n$/, "").split("\n");
      if (A.length * B.length > 4000000) return null;
      const n = A.length, m = B.length;
      const L = Array.from({length: n + 1}, () => new Int32Array(m + 1));
      for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
        L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
      const out = [], range = (s, e) => s === e ? `${s}` : `${s},${e}`;
      let i = 0, j = 0;
      while (i < n || j < m) {
        if (i < n && j < m && A[i] === B[j]) { i++; j++; continue; }
        const i0 = i, j0 = j;
        while ((i < n || j < m) && !(i < n && j < m && A[i] === B[j])) {
          if (j >= m || (i < n && L[i + 1][j] >= L[i][j + 1])) i++; else j++;
        }
        const dels = A.slice(i0, i), adds = B.slice(j0, j);
        if (dels.length && adds.length) out.push(`${range(i0 + 1, i)}c${range(j0 + 1, j)}`);
        else if (dels.length) out.push(`${range(i0 + 1, i)}d${j0}`);
        else out.push(`${i0}a${range(j0 + 1, j)}`);
        dels.forEach(l => out.push("< " + l));
        if (dels.length && adds.length) out.push("---");
        adds.forEach(l => out.push("> " + l));
      }
      return out;
    }

    const commands = {
      help() {
        println([
          "pwd                 show the folder you are in",
          "whoami              show your username",
          "ls [-alh] [folder]  list what is in a folder (-a hidden files, -l details, -h readable sizes)",
          "cd [folder]         move to another folder (cd .. goes up one, cd - goes back)",
          "cat FILE            print a whole file",
          "head [-n N] FILE    print the first lines of a file (10 unless you give -n)",
          "tail [-n N] FILE    print the last lines of a file",
          "wc -l FILE          count the lines in a file",
          "grep TEXT FILE      show lines containing TEXT (-i ignore case, -c count, -n line numbers)",
          "diff FILE1 FILE2    show the lines that differ between two files",
          "mkdir [-p] FOLDER   make a folder",
          "touch FILE          make an empty file",
          "cp FROM TO          copy a file",
          "mv FROM TO          move or rename a file or folder",
          "rm [-r] PATH        delete a file (-r for a folder)",
          "echo TEXT           print text",
          "edit FILE           open a file in the editor below (nano and code work too)",
          "python FILE.py      run a Python script (python3 and uv run python work too)",
          "history             list the commands you have typed",
          "clear               clear the screen",
          "reset               put every file back the way it started"].join("\n"));
      },
      pwd() { println(cwd); },
      whoami() { println(user); },
      ls(args) {
        const flags = new Set(args.filter(a => a.startsWith("-")).join("").replace(/-/g, ""));
        const showAll = flags.has("a"), long = flags.has("l"), human = flags.has("h");
        const targets = args.filter(a => !a.startsWith("-"));
        const list = targets.length ? targets : ["."];
        list.forEach((t, i) => {
          const p = resolve(t);
          if (!exists(FS, p)) return println(`ls: ${t}: No such file or directory`, "sbx-err");
          if (!isDir(FS, p)) return long ? log.insertAdjacentHTML("beforeend", longLine(p, t, human) + "\n") : println(t);
          if (list.length > 1) println((i ? "\n" : "") + t + ":");
          const names = FS.readdir(p).filter(n => n !== "." && n !== ".." && (showAll || !n.startsWith("."))).sort();
          if (showAll) names.unshift(".", "..");
          if (long) {
            println(`total ${names.length}`);
            log.insertAdjacentHTML("beforeend", names.map(n => longLine(p + "/" + n, n, human)).join("\n") + (names.length ? "\n" : ""));
            return;
          }
          log.insertAdjacentHTML("beforeend", names.map(n => isDir(FS, p + "/" + n) ? `<span class="sbx-dir">${esc(n)}</span>` : esc(n)).join("  ") + (names.length ? "\n" : ""));
        });
      },
      cd(args) {
        if (args[0] === "-") {
          if (!prevCwd || !exists(FS, prevCwd)) return println("cd: no previous directory", "sbx-err");
          [cwd, prevCwd] = [prevCwd, cwd];
          return println(cwd === home || cwd.startsWith(home + "/") ? "~" + cwd.slice(home.length) : cwd);
        }
        const target = args[0] ? resolve(args[0]) : home;
        if (!exists(FS, target)) return println(`cd: no such file or directory: ${args[0]}`, "sbx-err");
        if (!isDir(FS, target)) return println(`cd: not a directory: ${args[0]}`, "sbx-err");
        if (target !== cwd) prevCwd = cwd;
        cwd = target;
      },
      grep(args) {
        const flags = new Set(args.filter(a => /^-[a-zA-Z]+$/.test(a)).join("").replace(/-/g, ""));
        const rest = args.filter(a => !/^-[a-zA-Z]+$/.test(a));
        if (rest.length < 2) return println("usage: grep [-i] [-c] [-n] TEXT FILE ...", "sbx-err");
        const [pattern, ...fileArgs] = rest;
        const needle = flags.has("i") ? pattern.toLowerCase() : pattern;
        for (const f of fileArgs) {
          const p = resolve(f);
          if (!exists(FS, p)) { println(`grep: ${f}: No such file or directory`, "sbx-err"); continue; }
          if (isDir(FS, p)) { println(`grep: ${f}: Is a directory`, "sbx-err"); continue; }
          const lines = FS.readFile(p, {encoding: "utf8"}).replace(/\n$/, "").split("\n");
          const prefix = fileArgs.length > 1 ? f + ":" : "";
          let hits = 0;
          lines.forEach((line, i) => {
            if ((flags.has("i") ? line.toLowerCase() : line).includes(needle)) {
              hits++;
              if (!flags.has("c")) println(prefix + (flags.has("n") ? `${i + 1}:` : "") + line);
            }
          });
          if (flags.has("c")) println(prefix + hits);
        }
      },
      diff(args) {
        const files = args.filter(a => !a.startsWith("-"));
        if (files.length !== 2) return println("usage: diff FILE1 FILE2", "sbx-err");
        const texts = [];
        for (const f of files) {
          const p = resolve(f);
          if (!exists(FS, p)) return println(`diff: ${f}: No such file or directory`, "sbx-err");
          if (isDir(FS, p)) return println(`diff: ${f}: Is a directory`, "sbx-err");
          texts.push(FS.readFile(p, {encoding: "utf8"}));
        }
        const out = diffLines(texts[0], texts[1]);
        if (out === null) return println("diff: these files are too long to compare in this sandbox", "sbx-err");
        out.forEach(line => println(line, line.startsWith("<") ? "sbx-err" : line.startsWith(">") ? "sbx-new" : ""));
      },
      history() {
        history.forEach((h, i) => println(`${String(i + 1).padStart(5)}  ${h}`));
      },
      cat(args) {
        for (const a of args) {
          const p = resolve(a);
          if (!exists(FS, p)) { println(`cat: ${a}: No such file or directory`, "sbx-err"); continue; }
          if (isDir(FS, p)) { println(`cat: ${a}: Is a directory`, "sbx-err"); continue; }
          const text = FS.readFile(p, {encoding: "utf8"});
          print(text.endsWith("\n") || !text ? text : text + "\n");
        }
      },
      head(args, tail) {
        let n = 10;
        const i = args.indexOf("-n");
        if (i >= 0) { n = parseInt(args[i + 1], 10); args.splice(i, 2); }
        const flag = args.find(a => /^-\d+$/.test(a));
        if (flag) { n = parseInt(flag.slice(1), 10); args.splice(args.indexOf(flag), 1); }
        if (!args.length) return println(`${tail ? "tail" : "head"}: give a file name, e.g. ${tail ? "tail" : "head"} data/sample.csv`, "sbx-err");
        const p = resolve(args[0]);
        if (!exists(FS, p)) return println(`${tail ? "tail" : "head"}: ${args[0]}: No such file or directory`, "sbx-err");
        if (isDir(FS, p)) return println(`${tail ? "tail" : "head"}: ${args[0]}: Is a directory`, "sbx-err");
        const lines = FS.readFile(p, {encoding: "utf8"}).replace(/\n$/, "").split("\n");
        println((tail ? lines.slice(-n) : lines.slice(0, n)).join("\n"));
      },
      tail(args) { commands.head(args, true); },
      wc(args) {
        const file = args.find(a => !a.startsWith("-"));
        if (!file) return println("wc: give a file name, e.g. wc -l data/sample.csv", "sbx-err");
        const p = resolve(file);
        if (!exists(FS, p) || isDir(FS, p)) return println(`wc: ${file}: No such file`, "sbx-err");
        const text = FS.readFile(p, {encoding: "utf8"});
        println(`${String((text.match(/\n/g) || []).length).padStart(8)} ${file}`);
      },
      mkdir(args) {
        const parents = args.includes("-p");
        for (const a of args.filter(x => x !== "-p")) {
          const p = resolve(a);
          if (!canWrite(p)) { denied("mkdir", a); continue; }
          if (exists(FS, p)) { if (!parents) println(`mkdir: ${a}: File exists`, "sbx-err"); continue; }
          if (!parents && !exists(FS, p.slice(0, p.lastIndexOf("/")) || "/")) { println(`mkdir: ${a}: No such file or directory`, "sbx-err"); continue; }
          FS.mkdirTree(p);
        }
      },
      touch(args) {
        for (const a of args) {
          const p = resolve(a);
          if (!canWrite(p)) { denied("touch", a); continue; }
          if (!exists(FS, p.slice(0, p.lastIndexOf("/")) || "/")) { println(`touch: ${a}: No such file or directory`, "sbx-err"); continue; }
          if (!exists(FS, p)) FS.writeFile(p, "");
        }
      },
      cp(args) {
        if (args.length !== 2) return println("cp: use cp FROM TO", "sbx-err");
        const [from, to] = args.map(resolve);
        if (!exists(FS, from)) return println(`cp: ${args[0]}: No such file or directory`, "sbx-err");
        if (isDir(FS, from)) return println(`cp: ${args[0]} is a directory (not copied)`, "sbx-err");
        const dest = isDir(FS, to) ? to + from.slice(from.lastIndexOf("/")) : to;
        if (!canWrite(dest)) return denied("cp", args[1]);
        FS.writeFile(dest, FS.readFile(from));
      },
      mv(args) {
        if (args.length !== 2) return println("mv: use mv FROM TO", "sbx-err");
        const [from, to] = args.map(resolve);
        if (!exists(FS, from)) return println(`mv: ${args[0]}: No such file or directory`, "sbx-err");
        if (!canWrite(from) || from === home) return denied("mv", args[0]);
        if (!canWrite(to)) return denied("mv", args[1]);
        if (FS.cwd() === from || FS.cwd().startsWith(from + "/")) FS.chdir("/");
        FS.rename(from, isDir(FS, to) ? to + from.slice(from.lastIndexOf("/")) : to);
        if (!exists(FS, cwd)) cwd = home;
      },
      rm(args) {
        const recursive = args.some(a => /^-[a-z]*r/.test(a));
        for (const a of args.filter(x => !x.startsWith("-"))) {
          const p = resolve(a);
          if (!exists(FS, p)) { println(`rm: ${a}: No such file or directory`, "sbx-err"); continue; }
          if (!canWrite(p) || p === home) { denied("rm", a); continue; }
          if (isDir(FS, p) && !recursive) { println(`rm: ${a}: is a directory`, "sbx-err"); continue; }
          removeTree(FS, p);
        }
        if (!exists(FS, cwd)) cwd = home;
      },
      echo(args) { println(args.join(" ")); },
      clear() { log.innerHTML = ""; },
      reset() { restore(); cwd = root; log.innerHTML = ""; editor.hidden = true; editing = null; println("Every file is back the way it started.", "sbx-dim"); },
      async python(args) {
        if (!args.length) return println("Interactive Python isn't available here. Run a file instead, e.g. python run_report.py", "sbx-dim");
        if (args[0] === "-c" || args[0] === "-m") return println(`python ${args[0]} isn't available here. Run a .py file instead.`, "sbx-dim");
        const script = resolve(args[0]);
        if (!exists(FS, script) || isDir(FS, script))
          return println(`python: can't open file '${script}': [Errno 2] No such file or directory`, "sbx-err");
        const py = await getPython(packages, setStatus);
        setStatus("Running…");
        py.FS.chdir(cwd);
        sink = (text, kind) => print(text, kind === "err" ? "sbx-err" : "");
        try { await py.globals.get("_sandbox_run_file")(args[0], args.slice(1), root); }
        finally { sink = null; setStatus(""); }
      },
    };
    commands.edit = args => {
      if (!args.length) return println("edit: give a file name, e.g. edit run_report.py", "sbx-err");
      const p = resolve(args[0]);
      if (isDir(FS, p)) return println(`edit: ${args[0]}: Is a directory`, "sbx-err");
      if (!canWrite(p)) return denied("edit", args[0]);
      if (!exists(FS, p.slice(0, p.lastIndexOf("/")) || "/")) return println(`edit: ${args[0]}: No such folder`, "sbx-err");
      editing = p;
      editArea.value = exists(FS, p) ? FS.readFile(p, {encoding: "utf8"}) : "";
      editLabel.textContent = `Editing ${p.startsWith(root) ? p.slice(root.length + 1) || p : p}. Save writes the file; the terminal won't see changes until you save.`;
      editor.hidden = false;
      println(`Opened ${args[0]} in the editor below.`, "sbx-dim");
      setTimeout(() => editArea.focus(), 0);
    };
    commands.python3 = commands.python;
    ["nano", "code", "vim", "vi", "open"].forEach(c => { commands[c] = commands.edit; });

    function split(line) {
      const out = []; let cur = "", quote = null;
      for (const ch of line) {
        if (quote) { if (ch === quote) quote = null; else cur += ch; }
        else if (ch === '"' || ch === "'") quote = ch;
        else if (/\s/.test(ch)) { if (cur) { out.push(cur); cur = ""; } }
        else cur += ch;
      }
      if (cur) out.push(cur);
      return out;
    }

    async function execute(line) {
      println(promptText() + line, "sbx-echo");
      const [cmd, ...args] = split(line);
      if (!cmd) return;
      input.disabled = true;
      try {
        await start();
        if (!FS) return;
        if (cmd === "uv") {
          if (args[0] === "run" && (args[1] === "python" || args[1] === "python3")) await commands.python(args.slice(2));
          else if (args[0] === "sync") println("Nothing to install here: Python and pandas are already set up. On your own computer, uv sync installs the course's packages.", "sbx-dim");
          else println("In this sandbox, uv only supports: uv run python FILE.py", "sbx-dim");
          return;
        }
        const fn = commands[cmd];
        if (!fn) println(`zsh: command not found: ${cmd}`, "sbx-err");
        else await fn(args);
      } catch (err) {
        println(err.message || (err.errno !== undefined ? `Error: file system error ${err.errno}` : String(err)), "sbx-err");
      } finally {
        input.disabled = false;
        updatePrompt();
        input.focus();
        screen.scrollTop = screen.scrollHeight;
        if (opts.onCommand) opts.onCommand({line, cwd});
      }
    }

    input.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        const line = input.value; input.value = "";
        if (line.trim()) { history.push(line); histPos = history.length; }
        execute(line.trim());
      } else if (e.key === "ArrowUp") {
        if (histPos > 0) { histPos--; input.value = history[histPos]; e.preventDefault(); }
      } else if (e.key === "ArrowDown") {
        if (histPos < history.length) { histPos++; input.value = history[histPos] || ""; e.preventDefault(); }
      } else if (e.key === "Tab") {
        e.preventDefault();
        if (!FS) return;
        const parts = input.value.split(" "); const last = parts.pop();
        const dirPart = last.includes("/") ? last.slice(0, last.lastIndexOf("/") + 1) : "";
        const dir = resolve(dirPart || ".");
        if (!isDir(FS, dir)) return;
        const matches = FS.readdir(dir).filter(n => n !== "." && n !== ".." && n.startsWith(last.slice(dirPart.length)));
        if (matches.length === 1) {
          const full = dirPart + matches[0] + (isDir(FS, dir + "/" + matches[0]) ? "/" : "");
          input.value = [...parts, full].join(" ");
        } else if (matches.length > 1) println(matches.join("  "), "sbx-dim");
      }
    });
    screen.addEventListener("click", () => input.focus());
    el.querySelector(".sbx-save").addEventListener("click", () => {
      if (!editing) return;
      FS.writeFile(editing, editArea.value);
      println(`Saved ${editing.startsWith(root) ? editing.slice(root.length + 1) : editing}.`, "sbx-dim");
      closeEditor();
    });
    el.querySelector(".sbx-close").addEventListener("click", () => { println("Closed the editor without saving.", "sbx-dim"); closeEditor(); });
    editArea.addEventListener("keydown", e => {
      if (e.key === "Tab") { e.preventDefault(); editArea.setRangeText("    ", editArea.selectionStart, editArea.selectionEnd, "end"); }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); el.querySelector(".sbx-save").click(); }
    });
    el.querySelector(".sbx-reset").addEventListener("click", async () => {
      await start(); if (!FS) return;
      commands.reset(); updatePrompt(); input.focus();
    });
  }

  window.Sandbox = {python, terminal};
})();
