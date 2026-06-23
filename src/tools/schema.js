import { Type } from '@google/genai';
import { writeFile, readFile, deleteFile, listFiles } from './fileTools.js';
import { executePython } from './execTool.js';

export const functionDeclarations = [
  {
    name: 'write_file',
    description:
      'Create or overwrite a file inside the working folder. Creates parent directories as needed. Use this to write Manim scene scripts (.py files).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: {
          type: Type.STRING,
          description: 'Path relative to the working folder, e.g. "scene.py".',
        },
        content: {
          type: Type.STRING,
          description: 'Full text content to write to the file.',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'read_file',
    description: 'Read the full text content of a file inside the working folder.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: {
          type: Type.STRING,
          description: 'Path relative to the working folder, e.g. "scene.py".',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'delete_file',
    description: 'Delete a file or directory inside the working folder.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: {
          type: Type.STRING,
          description: 'Path relative to the working folder to delete.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'list_files',
    description: 'List files and directories at a path inside the working folder (defaults to the root).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: {
          type: Type.STRING,
          description: 'Path relative to the working folder to list. Defaults to "." (the root).',
        },
      },
    },
  },
  {
    name: 'execute_python',
    description:
      'Run a Python file inside the working folder with python3 and return stdout, stderr, and the exit code. ' +
      'To render a Manim scene, write a script that ends with `if __name__ == "__main__": MySceneName().render()` ' +
      'and then execute that file. Rendered output is written under media/ inside the working folder.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: {
          type: Type.STRING,
          description: 'Path to the Python file to run, relative to the working folder.',
        },
        args: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Optional command-line arguments to pass to the script.',
        },
      },
      required: ['path'],
    },
  },
];

// Same five tools as functionDeclarations above, expressed in the plain JSON \
// Schema dialect ollama-js expects (lowercase 'object'/'string'/'array' type \
// strings) instead of Gemini's Type enum.
export const ollamaTools = [
  {
    type: 'function',
    function: {
      name: 'write_file',
      description:
        'Create or overwrite a file inside the working folder. Creates parent directories as needed. Use this to write Manim scene scripts (.py files).',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path relative to the working folder, e.g. "scene.py".' },
          content: { type: 'string', description: 'Full text content to write to the file.' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the full text content of a file inside the working folder.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path relative to the working folder, e.g. "scene.py".' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_file',
      description: 'Delete a file or directory inside the working folder.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path relative to the working folder to delete.' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List files and directories at a path inside the working folder (defaults to the root).',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path relative to the working folder to list. Defaults to "." (the root).' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'execute_python',
      description:
        'Run a Python file inside the working folder with python3 and return stdout, stderr, and the exit code. ' +
        'To render a Manim scene, write a script that ends with `if __name__ == "__main__": MySceneName().render()` ' +
        'and then execute that file. Rendered output is written under media/ inside the working folder.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the Python file to run, relative to the working folder.' },
          args: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional command-line arguments to pass to the script.',
          },
        },
        required: ['path'],
      },
    },
  },
];

const handlers = {
  write_file: writeFile,
  read_file: readFile,
  delete_file: deleteFile,
  list_files: listFiles,
  execute_python: executePython,
};

/**
 * Executes a model FunctionCall against the sandboxed handlers above.
 * Never throws for expected/tool-level failures — those come back as
 * { ok: false, error } so the model can read and react to them. Unexpected
 * exceptions are also caught and turned into the same shape.
 */
export async function callTool(workspaceDir, functionCall) {
  const { name, args = {} } = functionCall;
  const handler = handlers[name];
  if (!handler) {
    return { ok: false, error: `unknown tool: ${name}` };
  }
  try {
    return await handler(workspaceDir, args);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
