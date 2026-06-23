# Manim Agent

CLI agent that turns a technical-topic prompt into a rendered Manim animation.
You describe a topic ("explain eigenvectors", "show how a binary search tree
rebalances"), and an LLM — Gemini or a local/open-source model via Ollama —
writes and iterates on Manim (Python) scene code in a sandboxed working
folder until it renders a video.

See [CLAUDE.md](CLAUDE.md) for the architecture/internals. This file is just
setup.

## 1. Node.js setup

Requires Node 18+.

```bash
npm install
cp .env.example .env
```

Edit `.env` and fill in whichever provider you plan to use (see below). At
minimum, set `GEMINI_API_KEY` if you want to use Gemini at all — it's the
default provider the CLI suggests.

Run the CLI:

```bash
node index.js
```

It will ask which provider to use, which model, and then the topic you want
animated. Output (the `.py` source and rendered `.mp4`) lands in a new
timestamped folder under `workspace/`.

## 2. Manim environment setup

The agent generates Manim scripts and runs them with `python3 scene.py`, so
Manim (and its native dependencies) need to be installed wherever you run the
agent — this is not bundled with the Node project.

### 2a. System packages

```bash
sudo apt-get update
sudo apt-get install -y python3-pip python3-venv ffmpeg \
  libcairo2-dev libpango1.0-dev pkg-config python3-dev
```

- `ffmpeg` — Manim shells out to it to encode the final video.
- `libcairo2-dev` / `libpango1.0-dev` / `pkg-config` / `python3-dev` — native
  build dependencies for `pycairo`/`pangocairo`, which Manim's `Text`
  rendering depends on.

### 2b. Python virtual environment

A project-local venv keeps Manim's dependencies isolated from system Python.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install manim
```

The agent's `execute_python` tool ([src/tools/execTool.js](src/tools/execTool.js))
auto-detects `.venv/bin/python3` and uses it for every run — you do **not**
need to keep the venv activated when running `node index.js`. Set the
`PYTHON_BIN` env var if you want to point it at a different interpreter
instead (e.g. a venv in a different location).

Verify the install:

```bash
.venv/bin/python3 -c "import manim; print(manim.__version__)"
ffmpeg -version
```

### 2c. LaTeX (optional, for math notation)

Manim's `MathTex`/`Tex` need a LaTeX distribution. Skip this if you're fine
with the agent sticking to plain `Text` (which the system prompt nudges it
toward when unsure) — but real math notation will fail without it.

```bash
sudo apt-get install -y texlive-latex-base texlive-fonts-recommended \
  texlive-latex-extra texlive-science dvisvgm
```

## 3. Provider setup

### Gemini

Set in `.env`:

```
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3-pro-preview   # optional, this is the default
```

### Ollama (open-source / local models)

Install and run [Ollama](https://ollama.com) on the machine that will run the
agent, then pull at least one model:

```bash
ollama serve            # if not already running as a service
ollama pull llama3.1    # or any other model you want to use
```

No API key is needed for local use. The CLI will list your installed models
and let you pick one. Optional `.env` vars:

```
AGENT_PROVIDER=ollama       # makes ollama the CLI's default suggestion
OLLAMA_HOST=                # only needed if not on http://127.0.0.1:11434
OLLAMA_MODEL=                # default model suggestion in the CLI picker
OLLAMA_API_KEY=              # only needed for Ollama's cloud API (ollama.com)
```

## Troubleshooting

- **`apt-get` aborts partway through with a dpkg error on an unrelated
  package** (e.g. a corrupted download of some other dependency): clear that
  package's cached `.deb` from `/var/cache/apt/archives/`, re-run
  `apt-get install -y --fix-broken`, then `sudo dpkg --configure -a`.
- **`pip install` fails with "externally-managed-environment"**: that's
  Ubuntu 24.04's PEP 668 guard on the system Python — use the venv approach
  above (2b), which avoids it entirely.
- **`ffmpeg`/Manim render errors mentioning `latex` or `dvisvgm` not
  found**: install the LaTeX packages in 2c.
