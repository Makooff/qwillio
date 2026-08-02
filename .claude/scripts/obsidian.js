#!/usr/bin/env node
/**
 * Obsidian Local REST API helper for Claude Code hooks.
 * Commands: read, write, append, list, session-log, inject-context
 *
 * Env vars:
 *   OBSIDIAN_API_KEY   — bearer token from Local REST API plugin
 *   OBSIDIAN_API_HOST  — default 127.0.0.1
 *   OBSIDIAN_API_PORT  — default 27124
 *   OBSIDIAN_VAULT     — vault subfolder prefix (e.g. "Qwillio" or "MyProject")
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const https = require('https');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.OBSIDIAN_API_KEY;
const HOST = process.env.OBSIDIAN_API_HOST || '127.0.0.1';
const PORT = parseInt(process.env.OBSIDIAN_API_PORT || '27124', 10);

if (!TOKEN) {
  process.stderr.write('OBSIDIAN_API_KEY not set\n');
  process.exit(0); // exit 0 so hook doesn't block Claude
}

function apiRequest(method, notePath, body, contentType) {
  return new Promise((resolve, reject) => {
    const encoded = notePath.split('/').map(p => encodeURIComponent(p)).join('/');
    const headers = {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': contentType || 'text/markdown',
    };
    if (body) headers['Content-Length'] = Buffer.byteLength(body, 'utf8');

    const req = https.request(
      { hostname: HOST, port: PORT, path: `/vault/${encoded}`, method, headers, rejectUnauthorized: false },
      res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('error', err => resolve({ status: 0, body: err.message }));
    if (body) req.write(body, 'utf8');
    req.end();
  });
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function now() {
  const d = new Date();
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function detectProject() {
  // 1. Explicit env var (set in .env.local or settings.json env)
  if (process.env.OBSIDIAN_VAULT) return process.env.OBSIDIAN_VAULT;

  // 2. Detect from CLAUDE.md project name
  const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const claudeMd = path.join(cwd, 'CLAUDE.md');
  if (fs.existsSync(claudeMd)) {
    const content = fs.readFileSync(claudeMd, 'utf8');
    const match = content.match(/^#\s+(.+)/m);
    if (match) return match[1].trim().split(' ')[0];
  }

  return null;
}

async function main() {
  const [,, cmd, ...args] = process.argv;

  if (cmd === 'read') {
    const notePath = args[0];
    const r = await apiRequest('GET', notePath);
    if (r.status === 200) process.stdout.write(r.body);

  } else if (cmd === 'write') {
    const [notePath, ...rest] = args;
    const content = rest.join(' ');
    const r = await apiRequest('PUT', notePath, content);
    process.stdout.write(r.status < 300 ? 'OK\n' : `Error ${r.status}\n`);

  } else if (cmd === 'append') {
    const [notePath, ...rest] = args;
    const content = rest.join(' ');
    const r = await apiRequest('POST', notePath, '\n' + content);
    process.stdout.write(r.status < 300 ? 'OK\n' : `Error ${r.status}: ${r.body}\n`);

  } else if (cmd === 'list') {
    const notePath = args[0] || '';
    const r = await apiRequest('GET', notePath);
    process.stdout.write(r.body + '\n');

  } else if (cmd === 'session-log') {
    const project = args[0] || detectProject() || 'Unknown';
    const sessionPath = `${project}/Sessions/${today()}.md`;
    const header = `# Session ${today()}\n\n`;
    const entry = `\n---\n_Session terminee a ${now()} — ${new Date().toLocaleDateString('fr-FR')}_\n`;

    const existing = await apiRequest('GET', sessionPath);
    if (existing.status === 404) {
      await apiRequest('PUT', sessionPath, header + entry);
    } else {
      await apiRequest('POST', sessionPath, entry);
    }
    process.stdout.write(`Session log updated: ${sessionPath}\n`);

  } else if (cmd === 'inject-context') {
    const project = args[0] || detectProject();
    if (!project) { process.exit(0); }

    const output = [];

    // 1. Open tasks
    const tasks = await apiRequest('GET', `${project}/Taches.md`);
    if (tasks.status === 200) {
      const openTasks = tasks.body
        .split('\n')
        .filter(l => l.includes('- [ ]'))
        .slice(0, 5)
        .join('\n');
      if (openTasks) {
        output.push(`[MEM:tasks]\n${openTasks}`);
      }
    }

    // 2. Today's session log
    const sessionPath = `${project}/Sessions/${today()}.md`;
    const session = await apiRequest('GET', sessionPath);
    if (session.status === 200 && session.body.length > 80) {
      const preview = session.body.split('\n').slice(0, 10).join('\n');
      output.push(`[MEM:session-${today()}]\n${preview}`);
    }

    // 3. Recent decisions
    const decisions = await apiRequest('GET', `${project}/04 - Decisions.md`);
    if (decisions.status === 200) {
      const preview = decisions.body.split('\n').slice(0, 8).join('\n');
      output.push(`[MEM:decisions]\n${preview}`);
    }

    // 4. Product context
    const product = await apiRequest('GET', `${project}/PRODUCT.md`);
    if (product.status === 200) {
      const preview = product.body.split('\n').slice(0, 12).join('\n');
      output.push(`[MEM:product]\n${preview}`);
    }

    if (output.length) {
      process.stdout.write('\n' + output.join('\n\n') + '\n');
    }

  } else {
    process.stderr.write(`Commands: read, write, append, list, session-log, inject-context\n`);
    process.exit(1);
  }
}

main().catch(e => {
  process.stderr.write(e.message + '\n');
  process.exit(0);
});
