import { GoogleGenAI, createPartFromFunctionResponse } from '@google/genai';
import { functionDeclarations, callTool } from '../tools/schema.js';
import { buildSystemPrompt } from '../systemPrompt.js';

const MAX_TURNS = 25; // safety cap on tool-call round trips

/**
 * Runs the agent loop for one topic against Gemini: sends the topic with the
 * Manim system prompt and tool declarations, executes any tool calls the
 * model makes against the sandboxed workspace, feeds the results back, and
 * repeats until the model stops calling tools (or MAX_TURNS is hit).
 *
 * @param {string} model - Gemini model id, e.g. "gemini-3-pro-preview".
 * @param {string} topic - the user's requested technical topic.
 * @param {string} workspaceDir - absolute path to the sandboxed working folder.
 * @param {(event: {type: string, [key: string]: any}) => void} onEvent - callback for progress events.
 * @returns {Promise<string>} the model's final text response.
 */
export async function runAgent(model, topic, workspaceDir, onEvent = () => {}) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set.');
  }

  const ai = new GoogleGenAI({});
  const chat = ai.chats.create({
    model,
    config: {
      systemInstruction: buildSystemPrompt(),
      tools: [{ functionDeclarations }],
    },
  });

  let response = await chat.sendMessage({
    message: `Create a Manim animation that explains: ${topic}`,
  });

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const calls = response.functionCalls;
    if (!calls || calls.length === 0) {
      return response.text ?? '';
    }

    const responseParts = [];
    for (const call of calls) {
      onEvent({ type: 'tool_call', name: call.name, args: call.args });
      const result = await callTool(workspaceDir, call);
      onEvent({ type: 'tool_result', name: call.name, result });
      responseParts.push(
        createPartFromFunctionResponse(call.id, call.name, { output: result }),
      );
    }

    response = await chat.sendMessage({ message: responseParts });
  }

  throw new Error(`Agent did not finish within ${MAX_TURNS} tool-call turns.`);
}
