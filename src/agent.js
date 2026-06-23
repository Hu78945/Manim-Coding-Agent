import { runAgent as runGeminiAgent } from './providers/geminiAgent.js';
import { runAgent as runOllamaAgent } from './providers/ollamaAgent.js';

const PROVIDERS = {
  gemini: runGeminiAgent,
  ollama: runOllamaAgent,
};

/**
 * Dispatches to the requested provider's agent loop. Every provider module
 * exposes the same shape: runAgent(model, topic, workspaceDir, onEvent).
 *
 * @param {string} provider - "gemini" or "ollama".
 * @param {string} model - model id/name for that provider.
 * @param {string} topic - the user's requested technical topic.
 * @param {string} workspaceDir - absolute path to the sandboxed working folder.
 * @param {(event: {type: string, [key: string]: any}) => void} onEvent - callback for progress events.
 * @returns {Promise<string>} the model's final text response.
 */
export async function runAgent(provider, model, topic, workspaceDir, onEvent = () => {}) {
  const run = PROVIDERS[provider];
  if (!run) {
    throw new Error(`unknown provider: ${provider} (expected one of: ${Object.keys(PROVIDERS).join(', ')})`);
  }
  return run(model, topic, workspaceDir, onEvent);
}
