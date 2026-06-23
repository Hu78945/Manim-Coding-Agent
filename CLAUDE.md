# Manim Agent

CLI agent that turns a technical-topic prompt into a rendered Manim animation.

## Flow

1. User runs the CLI and types a topic/concept they want explained visually
   (e.g. "explain eigenvectors", "show how a binary search tree rebalances").
2. That input is dropped into a system prompt that casts the model as an
   expert Manim developer (Python, `manim` library) and sent to whichever
   model provider the user picked — Gemini (`@google/genai`) or a local/cloud
   Ollama model (`ollama` npm package), for using open-source models too.
3. The model runs in an **agent loop**: it can call tools to write/read/edit
   files and execute Python, all scoped to a single working folder created
   for the run. It iterates — write scene code, run it, read the error, fix
   it, re-run — until the render succeeds or it gives up.
4. Output is a rendered video (and the `.py` source) sitting in that folder.

## Stack

- Node.js, ESM (`"type": "module"` in [package.json](package.json)).
- Gemini API via `@google/genai` — **always follow
  [codegen_instructions.md](codegen_instructions.md)** for correct SDK usage
  (model names, `ai.models.generateContent`, tool-calling shape, etc.). That
  file is the source of truth for anything Gemini-API-related; don't rely on
  training-data knowledge of the old `@google/generative-ai` SDK.
- Ollama via the official `ollama` npm package
  ([ollama-js](https://github.com/ollama/ollama-js)) — for running open-source
  models locally (or Ollama's cloud API). Its tool-calling shape is different
  from Gemini's: tools use plain JSON Schema (`type: 'object'`/`'string'`,
  not Gemini's `Type` enum), and `ToolCall` has no `id` — tool results go
  back as a `{ role: 'tool', tool_name, content }` message, not matched by id.
- Manim docs (for system prompt content / answering Manim questions):
  https://docs.manim.community/en/stable/
- Manim itself is a Python CLI (`manim`) invoked as a subprocess by the
  execute-code tool — this repo does not reimplement Manim, it shells out to
  it.

## Layout

- `index.js` — CLI entry point: loads `.env`, prompts for provider (gemini/
  ollama) + model + topic, creates a workspace folder, runs the agent loop,
  prints progress + final summary. For Ollama it calls `listModels()` first
  to show installed models as a numbered picker (falls back to manual entry
  if the Ollama server isn't reachable).
- `src/agent.js` — thin dispatcher: `runAgent(provider, model, topic,
  workspaceDir, onEvent)` picks `src/providers/geminiAgent.js` or
  `src/providers/ollamaAgent.js` and forwards to it. Both provider modules
  expose the identical signature `runAgent(model, topic, workspaceDir,
  onEvent)` so the dispatcher (and index.js) don't need to know the
  difference.
- `src/providers/geminiAgent.js` — Gemini agent loop: uses `ai.chats.create`
  with the system prompt + `functionDeclarations`, dispatches
  `response.functionCalls` via `callTool`, feeds results back with
  `createPartFromFunctionResponse`, repeats until the model stops calling
  tools or `MAX_TURNS` (25) is hit.
- `src/providers/ollamaAgent.js` — Ollama agent loop: manually manages the
  `messages` array (system/user/assistant/tool roles) across `ollama.chat()`
  calls with `tools: ollamaTools`, since ollama-js has no `Chat`-with-history
  helper like Gemini's. Also exports `listModels()` (wraps `ollama.list()`)
  for the CLI's model picker. Reads `OLLAMA_HOST` / `OLLAMA_API_KEY` env vars.
- `src/systemPrompt.js` — builds the "expert Manim developer" system prompt
  (workflow instructions, Manim docs link, tool usage conventions). Shared
  verbatim by both providers.
- `src/workspace.js` — `createWorkspace(topic)` makes a timestamped+slugged
  folder under `workspace/`.
- `src/tools/sandbox.js` — `resolveSafePath` enforces every tool path stays
  inside the workspace folder (no absolute paths, no `..` escapes).
- `src/tools/fileTools.js` — `writeFile` / `readFile` / `deleteFile` /
  `listFiles`, all routed through `resolveSafePath`.
- `src/tools/execTool.js` — `executePython`: spawns `python3 <path> [args]`
  with `cwd` pinned to the workspace, 3-minute timeout, captures
  stdout/stderr/exitCode (truncated to 20k chars each).
- `src/tools/schema.js` — tool declarations in both dialects the two
  providers need (`functionDeclarations` for Gemini's `Type` enum,
  `ollamaTools` for plain JSON Schema) for the same five tools (`write_file`,
  `read_file`, `delete_file`, `list_files`, `execute_python`), plus the
  provider-agnostic `callTool` dispatch table both agent loops call into.
- `workspace/` (gitignored) — per-run folders; this is the only place tools
  can touch.

## Manim convention used here

There's no `manim` CLI invocation — scenes self-render. Every generated
script must end with:

```python
if __name__ == "__main__":
    MySceneName().render()
```

and gets run via `execute_python` (`python3 scene.py`), not `manim render
...`. This is enforced via the system prompt, not the tool layer.

## Local setup

- Copy `.env.example` to `.env`. Loaded via `dotenv`.
- For Gemini: set `GEMINI_API_KEY` (required) and optionally `GEMINI_MODEL`
  (defaults to `gemini-3-pro-preview`).
- For Ollama: requires `ollama serve` running and at least one model pulled
  (e.g. `ollama pull llama3.1`) on whichever machine runs the CLI — no API
  key needed for local use. Optional env vars: `OLLAMA_HOST` (if not on the
  default `http://127.0.0.1:11434`), `OLLAMA_MODEL` (default suggested in the
  CLI's model picker), `OLLAMA_API_KEY` (only for Ollama's cloud API).
- `AGENT_PROVIDER` env var (`gemini` or `ollama`) sets the CLI's default
  suggestion at the provider prompt; you can still type the other one.
- Manim lives in a project-local venv at `.venv/` (ffmpeg is a system
  package). `src/tools/execTool.js` auto-detects `.venv/bin/python3` and
  uses it for every `execute_python` call — no need to `source
  .venv/bin/activate` before running `node index.js`. Override with the
  `PYTHON_BIN` env var if you need a different interpreter. MathTex needs a
  LaTeX distribution (texlive), which isn't installed; the system prompt
  nudges the model toward plain `Text` when unsure.

## Conventions

- API key comes from the `GEMINI_API_KEY` environment variable (picked up
  automatically by `new GoogleGenAI({})`) — never hardcode it in source.
- Keep tool schemas minimal: only the parameters the model actually needs.
- Every tool call result returned to the model should be plain text/JSON
  (stdout, stderr, file contents, success/failure) so the model can reason
  about what to do next.
