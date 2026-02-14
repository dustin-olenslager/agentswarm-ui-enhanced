import fs from "node:fs/promises";
import path from "node:path";
import { execSync, execFileSync } from "node:child_process";
import { createLogger } from "@agentswarm/core";

const logger = createLogger("tools", "worker");

// OpenAI function calling format for tool definitions
export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required: string[];
    };
  };
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of a file from the filesystem",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Absolute or relative file path to read",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write content to a file, creating parent directories if needed",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Absolute or relative file path to write",
          },
          content: {
            type: "string",
            description: "Content to write to the file",
          },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_file",
      description: "Edit an existing file by replacing specific text",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Absolute or relative file path to edit",
          },
          oldText: {
            type: "string",
            description: "Exact text to find and replace",
          },
          newText: {
            type: "string",
            description: "Text to replace the old text with",
          },
        },
        required: ["path", "oldText", "newText"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bash_exec",
      description: "Execute a shell command and return its output",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "Shell command to execute",
          },
          timeoutMs: {
            type: "number",
            description: "Timeout in milliseconds (default: 60000)",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "grep_search",
      description: "Search for patterns in files using grep",
      parameters: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "Regex pattern to search for",
          },
          searchPath: {
            type: "string",
            description: "Directory or file path to search in (default: current directory)",
          },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List files in a directory tree (max 2 levels deep)",
      parameters: {
        type: "object",
        properties: {
          dirPath: {
            type: "string",
            description: "Directory path to list (default: current directory)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_diff",
      description: "Get the git diff of all changes",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_commit",
      description: "Stage all changes and create a git commit",
      parameters: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "Commit message",
          },
        },
        required: ["message"],
      },
    },
  },
];

// Helper to truncate output
function truncateOutput(output: string, maxLength: number = 10000): string {
  if (output.length <= maxLength) {
    return output;
  }
  return output.slice(0, maxLength) + `\n... [truncated ${output.length - maxLength} characters]`;
}

// Tool implementations

export async function readFile(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    logger.debug(`read_file: ${filePath}`, { success: true });
    return content;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.debug(`read_file: ${filePath}`, { success: false, error: message });
    return `Error reading file: ${message}`;
  }
}

export async function writeFile(filePath: string, content: string): Promise<string> {
  try {
    // Create parent directories if they don't exist
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content, "utf-8");
    logger.debug(`write_file: ${filePath}`, { success: true, size: content.length });
    return `Successfully wrote ${content.length} characters to ${filePath}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.debug(`write_file: ${filePath}`, { success: false, error: message });
    return `Error writing file: ${message}`;
  }
}

export async function editFile(filePath: string, oldText: string, newText: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    
    if (!content.includes(oldText)) {
      return `Error: oldText not found in file. Make sure the text matches exactly including whitespace.`;
    }
    
    const newContent = content.replace(oldText, newText);
    await fs.writeFile(filePath, newContent, "utf-8");
    logger.debug(`edit_file: ${filePath}`, { success: true });
    return `Successfully edited ${filePath}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.debug(`edit_file: ${filePath}`, { success: false, error: message });
    return `Error editing file: ${message}`;
  }
}

export async function bashExec(command: string, timeoutMs: number = 60000): Promise<string> {
  try {
    logger.debug(`bash_exec: ${command}`, { timeout: timeoutMs });
    
    const output = execSync(command, {
      encoding: "utf-8",
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      cwd: process.cwd(),
    });
    
    return truncateOutput(output);
  } catch (error) {
    if (error instanceof Error && "stdout" in error && typeof error.stdout === "string") {
      return truncateOutput(error.stdout) + `\nError: ${error.message}`;
    }
    const message = error instanceof Error ? error.message : String(error);
    return `Command execution failed: ${message}`;
  }
}

export async function grepSearch(pattern: string, searchPath?: string): Promise<string> {
  try {
    // Try ripgrep first (rg), then fall back to grep
    const searchDir = searchPath || ".";
    let output: string;
    
    try {
      output = execFileSync("rg", ["-n", pattern, searchDir, "--color=never"], {
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch {
      // Fall back to grep if rg not available
      output = execFileSync("grep", ["-rn", pattern, searchDir], {
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });
    }
    
    return truncateOutput(output);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Grep failed: ${message}`;
  }
}

export async function listFiles(dirPath?: string): Promise<string> {
  try {
    const targetDir = dirPath || ".";
    const maxDepth = 2;
    
    async function walkDir(dir: string, depth: number): Promise<string[]> {
      if (depth > maxDepth) {
        return [];
      }
      
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const results: string[] = [];
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.name.startsWith(".") || entry.name === "node_modules") {
          continue;
        }
        
        if (entry.isDirectory()) {
          results.push(`${fullPath}/`);
          const subResults = await walkDir(fullPath, depth + 1);
          results.push(...subResults);
        } else {
          results.push(fullPath);
        }
      }
      
      return results;
    }
    
    const files = await walkDir(targetDir, 0);
    return files.join("\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error listing files: ${message}`;
  }
}

export async function gitDiff(): Promise<string> {
  try {
    const output = execSync("git diff --no-color", {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return output || "No changes detected";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Git diff failed: ${message}`;
  }
}

export async function getChangedFiles(): Promise<string[]> {
  try {
    const output = execSync("git diff --name-only", { encoding: "utf-8" }).trim();
    return output ? output.split("\n") : [];
  } catch {
    return [];
  }
}

export async function getDiffNumstat(): Promise<{ added: number; removed: number }> {
  try {
    const output = execSync("git diff --numstat", { encoding: "utf-8" }).trim();
    if (!output) return { added: 0, removed: 0 };
    let added = 0;
    let removed = 0;
    for (const line of output.split("\n")) {
      const parts = line.split("\t");
      if (parts[0] !== "-") added += parseInt(parts[0], 10);
      if (parts[1] !== "-") removed += parseInt(parts[1], 10);
    }
    return { added, removed };
  } catch {
    return { added: 0, removed: 0 };
  }
}

export async function gitCommit(message: string): Promise<string> {
  try {
    execFileSync("git", ["add", "-A"], { encoding: "utf-8" });
    const output = execFileSync("git", ["commit", "-m", message], { encoding: "utf-8" });
    return `Successfully committed: ${message}\n${output}`;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `Git commit failed: ${errorMessage}`;
  }
}

// Tool dispatcher

export async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  logger.debug(`executeTool: ${name}`, { args });
  
  switch (name) {
    case "read_file": {
      const filePath = args.path as string;
      return readFile(filePath);
    }
    case "write_file": {
      const filePath = args.path as string;
      const content = args.content as string;
      return writeFile(filePath, content);
    }
    case "edit_file": {
      const filePath = args.path as string;
      const oldText = args.oldText as string;
      const newText = args.newText as string;
      return editFile(filePath, oldText, newText);
    }
    case "bash_exec": {
      const command = args.command as string;
      const timeoutMs = args.timeoutMs as number | undefined;
      return bashExec(command, timeoutMs);
    }
    case "grep_search": {
      const pattern = args.pattern as string;
      const searchPath = args.searchPath as string | undefined;
      return grepSearch(pattern, searchPath);
    }
    case "list_files": {
      const dirPath = args.dirPath as string | undefined;
      return listFiles(dirPath);
    }
    case "git_diff": {
      return gitDiff();
    }
    case "git_commit": {
      const message = args.message as string;
      return gitCommit(message);
    }
    default:
      return `Unknown tool: ${name}`;
  }
}
