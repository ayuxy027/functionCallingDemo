import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");

export interface ToolResult {
  toolName: string;
  status: "completed" | "failed";
  input: string;
  output: string;
  durationMs: number;
  source: string;
}

export interface Tool {
  name: string;
  description: string;
  execute: (query: string) => Promise<ToolResult>;
}

interface DataEntry {
  instruction: string;
  output: string;
}

function loadDataFile(filename: string): DataEntry[] {
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) return [];
  
  const content = fs.readFileSync(filepath, "utf-8");
  return content
    .trim()
    .split("\n")
    .filter(line => line.trim())
    .map(line => {
      try {
        return JSON.parse(line) as DataEntry;
      } catch {
        return null;
      }
    })
    .filter((e): e is DataEntry => e !== null);
}

export function searchTools(query: string): string[] {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".jsonl"));
  const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const relevant: string[] = [];

  for (const file of files) {
    const entries = loadDataFile(file);
    const content = entries.map(e => e.instruction + " " + e.output).join(" ").toLowerCase();
    for (const keyword of keywords) {
      if (content.includes(keyword)) {
        relevant.push(file.replace(".jsonl", ""));
        break;
      }
    }
  }
  return relevant;
}

export async function search(query: string): Promise<ToolResult> {
  const start = performance.now();
  const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const results: string[] = [];

  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".jsonl"));
  
  for (const file of files) {
    const entries = loadDataFile(file);
    for (const entry of entries) {
      const text = (entry.instruction + " " + entry.output).toLowerCase();
      const matches = keywords.filter(k => text.includes(k)).length;
      if (matches >= Math.min(2, keywords.length)) {
        results.push(
          `[${file}] Q: ${entry.instruction}\nA: ${entry.output.slice(0, 200)}...`
        );
      }
    }
  }

  return {
    toolName: "search",
    status: results.length > 0 ? "completed" : "failed",
    input: query,
    output: results.slice(0, 5).join("\n\n") || "No results found",
    durationMs: Math.round(performance.now() - start),
    source: "data/",
  };
}

export async function grep(query: string): Promise<ToolResult> {
  const start = performance.now();
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".jsonl"));
  const results: string[] = [];

  for (const file of files) {
    const entries = loadDataFile(file);
    for (const entry of entries) {
      const fullText = entry.instruction + " " + entry.output;
      const lowerQuery = query.toLowerCase();
      
      if (fullText.toLowerCase().includes(lowerQuery) ||
          lowerQuery.split(" ").every(w => fullText.toLowerCase().includes(w))) {
        results.push(
          `[${file}] ${entry.instruction}\n→ ${entry.output.slice(0, 300)}`
        );
      }
    }
  }

  return {
    toolName: "grep",
    status: results.length > 0 ? "completed" : "failed",
    input: query,
    output: results.slice(0, 3).join("\n\n") || "No matches found",
    durationMs: Math.round(performance.now() - start),
    source: "data/",
  };
}

export async function lookup(keyword: string): Promise<ToolResult> {
  const start = performance.now();
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".jsonl"));
  const results: string[] = [];
  
  const keywords = keyword.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  
  for (const file of files) {
    const entries = loadDataFile(file);
    for (const entry of entries) {
      const text = (entry.instruction + " " + entry.output).toLowerCase();
      const match = keywords.some(k => text.includes(k));
      if (match) {
        results.push(
          `[${file}]\nQ: ${entry.instruction}\nA: ${entry.output}`
        );
        break;
      }
    }
  }

  return {
    toolName: "lookup",
    status: results.length > 0 ? "completed" : "failed",
    input: keyword,
    output: results.join("\n\n") || `No matching rules found for "${keyword}"`,
    durationMs: Math.round(performance.now() - start),
    source: "data/",
  };
}

export async function executeTool(
  toolName: string,
  query: string
): Promise<ToolResult> {
  switch (toolName) {
    case "search":
      return search(query);
    case "grep":
      return grep(query);
    case "lookup":
      return lookup(query);
    default:
      return {
        toolName,
        status: "failed",
        input: query,
        output: `Unknown tool: ${toolName}`,
        durationMs: 0,
        source: "data/",
      };
  }
}

export async function executeAllTools(query: string): Promise<ToolResult[]> {
  const keywords = query.toLowerCase();
  const results: ToolResult[] = [];

  if (keywords.includes("cap") || keywords.includes("limit") || keywords.includes("percentage")) {
    results.push(await lookup("cap"));
  }
  if (keywords.includes("period") || keywords.includes("days") || keywords.includes("hour")) {
    results.push(await lookup("period"));
  }
  if (keywords.includes("consent") || keywords.includes("opt")) {
    results.push(await lookup("consent"));
  }
  if (keywords.includes("recovery") || keywords.includes("call") || keywords.includes("contact")) {
    results.push(await lookup("recovery"));
  }
  
  if (results.length === 0) {
    results.push(await search(query));
  }

  return results;
}