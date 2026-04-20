import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';
import { ParsedError } from './parser';

export interface FixEdit {
  file: string;
  oldString: string;
  newString: string;
}

export interface FixProposal {
  canFix: boolean;
  confidence: 'high' | 'medium' | 'low';
  analysis: string;
  edits: FixEdit[];
  commitMessage: string;
}

export interface FileContext {
  path: string;
  content: string;
}

const SYSTEM_PROMPT = `You are an autonomous error-fix agent for the Qwillio codebase (a TypeScript monorepo with backend/, frontend/, discord-bot/).

You receive a runtime error and the contents of the file(s) most likely responsible. Produce a minimal, safe fix.

Rules:
- Only fix simple, high-confidence problems: undefined/null access, missing env var reads, wrong route paths, typos in identifiers, missing imports, off-by-one array access, missing await.
- If the root cause is ambiguous, refactor would be large, or you need information you don't have, set canFix=false and explain.
- Never invent APIs, packages, or file paths. Only reference files provided in context.
- Edits use exact string replacement. oldString MUST appear verbatim in the file and be unique. Keep oldString small but include enough surrounding context to be unambiguous.
- Prefer defensive guards (optional chaining, nullish coalescing, early returns) over large rewrites.
- Write a conventional commit message: "fix(<scope>): <short summary>".

Respond with ONLY a JSON object matching this TypeScript type:
{
  "canFix": boolean,
  "confidence": "high" | "medium" | "low",
  "analysis": string,
  "edits": Array<{ "file": string, "oldString": string, "newString": string }>,
  "commitMessage": string
}

No prose, no markdown, no code fences. Just the JSON.`;

export class ClaudeFixClient {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = 'claude-sonnet-4-5') {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async proposeFix(error: ParsedError, files: FileContext[]): Promise<FixProposal> {
    const fileBlocks = files
      .map((f) => `=== FILE: ${f.path} ===\n${f.content}`)
      .join('\n\n');

    const userMessage = [
      `## Error`,
      '```',
      error.raw,
      '```',
      '',
      `## Parsed`,
      `- Type: ${error.type ?? 'unknown'}`,
      `- File: ${error.file ?? 'unknown'}`,
      `- Line: ${error.line ?? 'unknown'}`,
      `- Message: ${error.message}`,
      '',
      `## Source files`,
      fileBlocks || '(no file context available)',
    ].join('\n');

    logger.info(`[error-fix-agent] Asking Claude to fix: ${error.message.slice(0, 120)}`);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    return parseProposal(text);
  }
}

function parseProposal(text: string): FixProposal {
  const jsonText = extractJson(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`Claude returned invalid JSON: ${(e as Error).message}\n---\n${text.slice(0, 500)}`);
  }

  const obj = parsed as Partial<FixProposal>;
  if (typeof obj.canFix !== 'boolean') throw new Error('Missing canFix');
  const confidence = (obj.confidence ?? 'low') as FixProposal['confidence'];
  const edits = Array.isArray(obj.edits) ? obj.edits : [];

  for (const edit of edits) {
    if (!edit.file || typeof edit.oldString !== 'string' || typeof edit.newString !== 'string') {
      throw new Error('Invalid edit shape');
    }
  }

  return {
    canFix: obj.canFix,
    confidence,
    analysis: obj.analysis ?? '',
    edits,
    commitMessage: obj.commitMessage ?? 'fix: autonomous error-fix agent',
  };
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return text;
}
