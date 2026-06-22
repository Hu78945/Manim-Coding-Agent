import 'dotenv/config';
import readline from 'node:readline/promises';
import path from 'node:path';
import { createWorkspace } from './src/workspace.js';
import { runAgent } from './src/agent.js';

function logEvent(event) {
  if (event.type === 'tool_call') {
    const args = JSON.stringify(event.args ?? {});
    console.log(`\n[tool call] ${event.name}(${args})`);
  } else if (event.type === 'tool_result') {
    const preview = JSON.stringify(event.result);
    console.log(`[tool result] ${preview.slice(0, 500)}${preview.length > 500 ? '...' : ''}`);
  }
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('Set the GEMINI_API_KEY environment variable before running this CLI.');
    process.exit(1);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const topic = await rl.question('What technical topic should the animation explain?\n> ');
  rl.close();

  if (!topic.trim()) {
    console.error('No topic provided, exiting.');
    process.exit(1);
  }

  const workspaceDir = await createWorkspace(topic);
  console.log(`\nWorking folder: ${path.relative(process.cwd(), workspaceDir)}`);
  console.log('Starting agent...\n');

  const finalText = await runAgent(topic, workspaceDir, logEvent);

  console.log('\n--- Agent finished ---');
  console.log(finalText);
}

main().catch((err) => {
  console.error('\nAgent failed:', err.message);
  process.exit(1);
});
