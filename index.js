import 'dotenv/config';
import readline from 'node:readline/promises';
import path from 'node:path';
import { createWorkspace } from './src/workspace.js';
import { runAgent } from './src/agent.js';
import { listModels as listOllamaModels } from './src/providers/ollamaAgent.js';

function logEvent(event) {
  if (event.type === 'tool_call') {
    const args = JSON.stringify(event.args ?? {});
    console.log(`\n[tool call] ${event.name}(${args})`);
  } else if (event.type === 'tool_result') {
    const preview = JSON.stringify(event.result);
    console.log(`[tool result] ${preview.slice(0, 500)}${preview.length > 500 ? '...' : ''}`);
  }
}

async function chooseProvider(rl) {
  const defaultProvider = process.env.AGENT_PROVIDER === 'ollama' ? 'ollama' : 'gemini';
  const answer = (await rl.question(
    `Which model provider — gemini or ollama? [${defaultProvider}]\n> `,
  )).trim().toLowerCase();

  const provider = answer || defaultProvider;
  if (provider !== 'gemini' && provider !== 'ollama') {
    throw new Error(`Unknown provider "${provider}" — expected "gemini" or "ollama".`);
  }
  return provider;
}

async function chooseGeminiModel(rl) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Set the GEMINI_API_KEY environment variable before using the gemini provider.');
  }
  const defaultModel = process.env.GEMINI_MODEL || 'gemini-3-pro-preview';
  const answer = (await rl.question(`Which Gemini model? [${defaultModel}]\n> `)).trim();
  return answer || defaultModel;
}

async function chooseOllamaModel(rl) {
  let installed = [];
  try {
    installed = await listOllamaModels();
  } catch (err) {
    console.log(
      `Couldn't reach Ollama (${err.message}). Make sure \`ollama serve\` is running ` +
        `(or set OLLAMA_HOST if it's not on the default address).`,
    );
  }

  if (installed.length > 0) {
    console.log('Installed Ollama models:');
    installed.forEach((name, i) => console.log(`  ${i + 1}. ${name}`));
  }

  const defaultModel = process.env.OLLAMA_MODEL || installed[0] || '';
  const prompt = defaultModel
    ? `Pick a number, or type a model name. [${defaultModel}]\n> `
    : 'Type the Ollama model name to use (e.g. llama3.1):\n> ';
  const answer = (await rl.question(prompt)).trim();

  if (!answer) {
    if (!defaultModel) throw new Error('No Ollama model selected.');
    return defaultModel;
  }
  const asIndex = Number(answer);
  if (Number.isInteger(asIndex) && asIndex >= 1 && asIndex <= installed.length) {
    return installed[asIndex - 1];
  }
  return answer;
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const provider = await chooseProvider(rl);
  const model = provider === 'gemini' ? await chooseGeminiModel(rl) : await chooseOllamaModel(rl);

  const topic = await rl.question('What technical topic should the animation explain?\n> ');
  rl.close();

  if (!topic.trim()) {
    console.error('No topic provided, exiting.');
    process.exit(1);
  }

  const workspaceDir = await createWorkspace(topic);
  console.log(`\nWorking folder: ${path.relative(process.cwd(), workspaceDir)}`);
  console.log(`Starting agent (${provider}: ${model})...\n`);

  const finalText = await runAgent(provider, model, topic, workspaceDir, logEvent);

  console.log('\n--- Agent finished ---');
  console.log(finalText);
}

main().catch((err) => {
  console.error('\nAgent failed:', err.message);
  process.exit(1);
});
