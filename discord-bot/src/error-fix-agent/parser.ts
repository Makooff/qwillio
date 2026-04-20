import { Message } from 'discord.js';

export interface ParsedError {
  raw: string;
  message: string;
  type: string | null;
  file: string | null;
  line: number | null;
  column: number | null;
  stack: string[];
  source: 'message' | 'embed';
}

const FILE_LINE_RE = /([\w./-]+\.(?:ts|tsx|js|jsx|mjs|cjs))(?::(\d+))?(?::(\d+))?/;
const ERROR_TYPE_RE = /\b(TypeError|ReferenceError|SyntaxError|RangeError|Error|PrismaClientKnownRequestError|ValidationError|ZodError)\b/;
const STACK_LINE_RE = /^\s*at\s+.+/;

export function parseErrorFromMessage(message: Message): ParsedError | null {
  const pieces: string[] = [];
  if (message.content) pieces.push(message.content);

  for (const embed of message.embeds) {
    if (embed.title) pieces.push(embed.title);
    if (embed.description) pieces.push(embed.description);
    for (const field of embed.fields ?? []) {
      pieces.push(`${field.name}: ${field.value}`);
    }
  }

  const raw = pieces.join('\n').trim();
  if (!raw) return null;

  if (!looksLikeError(raw)) return null;

  return parseErrorText(raw, message.embeds.length > 0 ? 'embed' : 'message');
}

export function parseErrorText(raw: string, source: 'message' | 'embed' = 'message'): ParsedError {
  const cleaned = raw.replace(/```[\w]*\n?|```/g, '').trim();
  const lines = cleaned.split('\n').map((l) => l.trim()).filter(Boolean);

  const typeMatch = cleaned.match(ERROR_TYPE_RE);
  const type = typeMatch ? typeMatch[1] : null;

  let file: string | null = null;
  let line: number | null = null;
  let column: number | null = null;

  for (const l of lines) {
    const m = l.match(FILE_LINE_RE);
    if (m) {
      file = m[1];
      if (m[2]) line = parseInt(m[2], 10);
      if (m[3]) column = parseInt(m[3], 10);
      break;
    }
  }

  const stack = lines.filter((l) => STACK_LINE_RE.test(l));

  const messageLine =
    lines.find((l) => ERROR_TYPE_RE.test(l)) ||
    lines.find((l) => !STACK_LINE_RE.test(l)) ||
    cleaned.slice(0, 500);

  return {
    raw: cleaned,
    message: messageLine,
    type,
    file,
    line,
    column,
    stack,
    source,
  };
}

function looksLikeError(text: string): boolean {
  if (ERROR_TYPE_RE.test(text)) return true;
  if (/\b(undefined|null|not a function|cannot find module|ENOENT|ECONNREFUSED|missing env)\b/i.test(text)) return true;
  if (/\bstack trace\b/i.test(text)) return true;
  if (/^\s*at\s+/m.test(text)) return true;
  if (/error:/i.test(text)) return true;
  return false;
}
