# Installation & First‑Run Guide

**English** · [繁體中文](INSTALL.zh-TW.md)

This guide takes you from a fresh machine to a working NoteSentry. It applies to the
prebuilt installers on the [Releases page](https://github.com/swiftruru/notesentry-mcp/releases).

> **Why there are prerequisites.** NoteSentry runs everything on your machine and never
> uploads data. The app bundles its MCP server scripts, but the LLM runtime (Ollama), the
> Python runtime, and the MIMIC‑III database are **not** bundled — Ollama and Python are
> large platform‑specific runtimes, and MIMIC‑III data is governed by the PhysioNet
> Credentialed DUA and may not be redistributed. You provide those three locally.

---

## What you need

1. **[Ollama](https://ollama.com)** — the local LLM runtime.
2. **Python 3** with the MCP package (`pip install "mcp[cli]"`).
3. **A `mimic_notes.db`** you build from your own credentialed MIMIC‑III `NOTEEVENTS.csv`.
4. The **NoteSentry app** for your platform.

Allow ~10–20 GB free disk (model + database) and ideally ≥16 GB RAM for `gpt-oss:20b`.

---

## Step 1 — Install Ollama and pull a model

1. Install Ollama from <https://ollama.com> and make sure it is running (`ollama serve`,
   or just launch the Ollama app).
2. Pull a model that supports **tool calling**:

   ```bash
   ollama pull gpt-oss:20b      # recommended — most reliable tool calls
   # or, for a lighter machine:
   ollama pull qwen2.5
   ```

NoteSentry talks only to `http://localhost:11434`; non‑local URLs are blocked by design.

## Step 2 — Install Python + the MCP package

```bash
python3 --version              # 3.10+ recommended
pip install "mcp[cli]"
```

Note the path to your Python. On most systems `python3` works; on Windows it may be
`python` or a full path like `C:\Users\you\AppData\Local\Programs\Python\Python312\python.exe`.

## Step 3 — Build the database

You need your own credentialed MIMIC‑III `NOTEEVENTS.csv`. Download
[`build_db.py`](https://github.com/swiftruru/notesentry-mcp/blob/main/build_db.py) from the
repo (it is also bundled inside the app under `resources/`), then:

```bash
# Full import (~2M rows) + full‑text search index used by search_notes
python3 build_db.py --csv /path/to/NOTEEVENTS.csv --db mimic_notes.db --with-fts
```

Remember the **absolute path** to the resulting `mimic_notes.db` — you'll point the app at it
in Step 5. Keep this file local; it must never be committed or uploaded.

## Step 4 — Install the app

### macOS

1. Download `NoteSentry-mac-arm64.dmg` (Apple Silicon) or `NoteSentry-mac-x64.dmg` (Intel).
2. Open the `.dmg` and drag **NoteSentry** to Applications.
3. The build is **ad‑hoc signed** (no paid Apple certificate), so the first launch is blocked
   by Gatekeeper. **Right‑click the app → Open → Open** (only needed once). If still blocked:
   System Settings → Privacy & Security → "Open Anyway".

### Windows

1. Download `NoteSentry-win-setup-x64.exe` (installer) or `NoteSentry-win-portable-x64.exe` (portable).
2. The app is unsigned, so SmartScreen may warn: click **More info → Run anyway**.
3. The installer lets you choose the install folder; the portable `.exe` runs without installing.

### Linux

- **AppImage**: `chmod +x NoteSentry-linux-x64.AppImage` then run it.
  (If it complains about FUSE, install `libfuse2`, or run with `--appimage-extract-and-run`.)
- **Debian/Ubuntu**: `sudo apt install ./NoteSentry-linux-x64.deb`

## Step 5 — First launch & configuration

Open NoteSentry, go to **Settings** (left rail), and set:

| Field | What to enter |
| --- | --- |
| **Ollama URL** | `http://localhost:11434` (default) |
| **Model** | Pick from the auto‑detected dropdown — e.g. `gpt-oss:20b`. Use **Test connection** to confirm Ollama is reachable. |
| **Python path** | `python3` (or your full Python path from Step 2) |
| **Database path** | The **absolute path** to the `mimic_notes.db` you built in Step 3 |

Then click **Reconnect MCP**. The **Tools** tab should show both servers connected
(MIMIC note query + Clinical support), with their tools listed.

## Step 6 — Verify

In **Chat**, ask something like *"How many note categories are there?"* The model should
issue a tool call, and an **approval dialog** pops up — this is the human‑in‑the‑loop gate.
Approve it, and the answer comes back grounded in your database. Every tool call (and any
rejection) is written to the **Audit** tab.

---

## Where your data lives

When installed, the app stores its data under your OS user‑data folder (local, never uploaded):

| OS | Folder |
| --- | --- |
| macOS | `~/Library/Application Support/NoteSentry/` |
| Windows | `%APPDATA%\NoteSentry\` (e.g. `C:\Users\you\AppData\Roaming\NoteSentry\`) |
| Linux | `~/.config/NoteSentry/` |

That folder holds `config.json`, `logs/` (audit JSONL), and `conversations/` (which contain
clinical text). The default database path resolves inside that folder too, so either place your
`mimic_notes.db` there or set an absolute path in Settings (recommended).

> **DUA reminder.** Conversations and the database contain clinical text. They stay on your
> machine — do not copy them to shared drives, cloud sync folders, or version control.

---

## Troubleshooting

- **"Model not found" / no answer** — pull the model (`ollama pull gpt-oss:20b`) and make sure
  Ollama is running; re‑pick it in Settings.
- **Tools tab empty / MCP won't connect** — check the **Python path** is correct and that
  `pip install "mcp[cli]"` ran for *that* Python; then click **Reconnect MCP**.
- **`search_notes` returns nothing** — you built the DB without the FTS index; rebuild with
  `--with-fts`, or add it to an existing DB with `python3 build_db.py --db mimic_notes.db --fts-only`.
- **Wrong/empty results** — the **Database path** in Settings doesn't point to your real
  `mimic_notes.db`; set the absolute path and Reconnect MCP.
- **macOS "app is damaged / can't be opened"** — Gatekeeper on an ad‑hoc build; use
  right‑click → Open, or `xattr -dr com.apple.quarantine /Applications/NoteSentry.app`.
- **The model writes a tool call as plain text (no approval dialog)** — switch to
  `gpt-oss:20b`, which reliably emits structured tool calls.
