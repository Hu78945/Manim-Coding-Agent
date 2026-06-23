import { Ollama } from 'ollama';
import { ollamaTools, callTool } from '../tools/schema.js';
import { buildSystemPrompt } from '../systemPrompt.js';

const MAX_TURNS = 25; // safety cap on tool-call round trips

function createClient() {
  const config = { host: process.env.OLLAMA_HOST || undefined };
  if (process.env.OLLAMA_API_KEY) {
    config.headers = { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` };
  }
  return new Ollama(config);
}

/**
 * Runs the agent loop for one topic against a local (or cloud) Ollama model:
 * sends the topic with the Manim system prompt and tool declarations,
 * executes any tool calls the model makes against the sandboxed workspace,
 * feeds the results back, and repeats until the model stops calling tools
 * (or MAX_TURNS is hit).
 *
 * Unlike Gemini's FunctionCall, ollama-js's ToolCall has no id — tool results
 * are matched back to the model purely by order/name, via a `role: 'tool'`
 * message carrying `tool_name`.
 *
 * @param {string} model - Ollama model name, e.g. "llama3.1" or "qwen2.5-coder".
 * @param {string} topic - the user's requested technical topic.
 * @param {string} workspaceDir - absolute path to the sandboxed working folder.
 * @param {(event: {type: string, [key: string]: any}) => void} onEvent - callback for progress events.
 * @returns {Promise<string>} the model's final text response.
 */
export async function runAgent(model, topic, workspaceDir, onEvent = () => {}) {
  const ollama = createClient();

  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: `Create a Manim animation that explains: ${topic}` },
  ];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await ollama.chat({
      model,
      messages,
      tools: ollamaTools,
    });

    messages.push(response.message);

    const calls = response.message.tool_calls;
    if (!calls || calls.length === 0) {
      return response.message.content ?? '';
    }

    for (const call of calls) {
      const { name, arguments: args } = call.function;
      onEvent({ type: 'tool_call', name, args });
      const result = await callTool(workspaceDir, { name, args });
      onEvent({ type: 'tool_result', name, result });
      messages.push({
        role: 'tool',
        tool_name: name,
        content: JSON.stringify(result),
      });
    }
  }

  throw new Error(`Agent did not finish within ${MAX_TURNS} tool-call turns.`);
}

/** Lists locally available Ollama models, for an interactive picker. */
export async function listModels() {
  const ollama = createClient();
  const { models } = await ollama.list();
  return models.map((m) => m.name);
}
