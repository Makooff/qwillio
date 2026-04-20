import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { logger } from '../utils/logger';
import { FixEdit, FileContext } from './claude';

export interface ApplyResult {
  success: boolean;
  buildPassed: boolean;
  committed: boolean;
  pushed: boolean;
  buildOutput: string;
  commitSha?: string;
  failureReason?: string;
}

const WORKSPACES = ['backend', 'frontend', 'discord-bot'] as const;

export class FixApplier {
  constructor(
    private projectPath: string,
    private options: { autoCommit: boolean; autoPush: boolean; branch: string }
  ) {}

  readFileContext(relativePath: string, maxBytes = 60_000): FileContext | null {
    const full = this.resolve(relativePath);
    if (!full || !fs.existsSync(full)) return null;
    const stat = fs.statSync(full);
    if (!stat.isFile()) return null;
    let content = fs.readFileSync(full, 'utf8');
    if (content.length > maxBytes) {
      content = content.slice(0, maxBytes) + '\n/* …truncated… */';
    }
    return { path: this.toRelative(full), content };
  }

  gatherContext(primaryFile: string | null, extraPaths: string[] = []): FileContext[] {
    const seen = new Set<string>();
    const out: FileContext[] = [];
    const candidates = [primaryFile, ...extraPaths].filter(Boolean) as string[];
    for (const p of candidates) {
      if (seen.has(p)) continue;
      seen.add(p);
      const ctx = this.readFileContext(p);
      if (ctx) out.push(ctx);
    }
    return out;
  }

  async applyAndFinalize(edits: FixEdit[], commitMessage: string): Promise<ApplyResult> {
    const backups = new Map<string, string>();
    const touchedWorkspaces = new Set<string>();
    const touchedFiles: string[] = [];

    try {
      for (const edit of edits) {
        const full = this.resolve(edit.file);
        if (!full) return this.fail(backups, `File path resolves outside project: ${edit.file}`);
        if (!fs.existsSync(full)) return this.fail(backups, `File not found: ${edit.file}`);

        const original = fs.readFileSync(full, 'utf8');
        if (!backups.has(full)) backups.set(full, original);

        const occurrences = countOccurrences(original, edit.oldString);
        if (occurrences === 0) return this.fail(backups, `oldString not found in ${edit.file}`);
        if (occurrences > 1) {
          return this.fail(backups, `oldString not unique in ${edit.file} (${occurrences} matches)`);
        }

        const updated = original.replace(edit.oldString, edit.newString);
        fs.writeFileSync(full, updated, 'utf8');

        const rel = this.toRelative(full);
        touchedFiles.push(rel);
        const ws = detectWorkspace(rel);
        if (ws) touchedWorkspaces.add(ws);
      }

      const build = this.runBuilds([...touchedWorkspaces]);
      if (!build.passed) {
        this.restore(backups);
        return {
          success: false,
          buildPassed: false,
          committed: false,
          pushed: false,
          buildOutput: build.output,
          failureReason: 'build_failed',
        };
      }

      if (!this.options.autoCommit) {
        return { success: true, buildPassed: true, committed: false, pushed: false, buildOutput: build.output };
      }

      const sha = this.commit(touchedFiles, commitMessage);
      if (!sha) {
        return { success: true, buildPassed: true, committed: false, pushed: false, buildOutput: build.output };
      }

      let pushed = false;
      if (this.options.autoPush) pushed = await this.push();

      return {
        success: true,
        buildPassed: true,
        committed: true,
        pushed,
        buildOutput: build.output,
        commitSha: sha,
      };
    } catch (err) {
      this.restore(backups);
      return {
        success: false,
        buildPassed: false,
        committed: false,
        pushed: false,
        buildOutput: '',
        failureReason: `exception: ${(err as Error).message}`,
      };
    }
  }

  private runBuilds(workspaces: string[]): { passed: boolean; output: string } {
    const targets = workspaces.length > 0 ? workspaces : ['backend'];
    const outputs: string[] = [];
    for (const ws of targets) {
      const wsPath = path.join(this.projectPath, ws);
      if (!fs.existsSync(path.join(wsPath, 'package.json'))) continue;
      try {
        logger.info(`[error-fix-agent] Running build in ${ws}`);
        const out = execSync('npm run build', {
          cwd: wsPath,
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 300_000,
        }).toString();
        outputs.push(`## ${ws}\n${out}`);
      } catch (e) {
        const err = e as { stdout?: Buffer; stderr?: Buffer; message?: string };
        const msg = (err.stdout?.toString() ?? '') + (err.stderr?.toString() ?? '') + (err.message ?? '');
        outputs.push(`## ${ws} (FAILED)\n${msg}`);
        return { passed: false, output: outputs.join('\n\n') };
      }
    }
    return { passed: true, output: outputs.join('\n\n') || '(no build targets)' };
  }

  private commit(files: string[], message: string): string | null {
    try {
      for (const f of files) {
        execSync(`git add -- "${f}"`, { cwd: this.projectPath });
      }
      const staged = execSync('git diff --cached --name-only', { cwd: this.projectPath }).toString().trim();
      if (!staged) return null;
      execSync(`git commit -m ${JSON.stringify(message)}`, { cwd: this.projectPath });
      return execSync('git rev-parse HEAD', { cwd: this.projectPath }).toString().trim();
    } catch (e) {
      logger.error(`[error-fix-agent] commit failed: ${(e as Error).message}`);
      return null;
    }
  }

  private async push(): Promise<boolean> {
    const branch = this.options.branch;
    const backoffs = [0, 2000, 4000, 8000, 16000];
    for (let i = 0; i < backoffs.length; i++) {
      if (backoffs[i] > 0) await sleep(backoffs[i]);
      try {
        execSync(`git push -u origin ${branch}`, { cwd: this.projectPath, stdio: 'pipe' });
        return true;
      } catch (e) {
        logger.warn(`[error-fix-agent] push attempt ${i + 1} failed: ${(e as Error).message}`);
      }
    }
    return false;
  }

  private restore(backups: Map<string, string>): void {
    for (const [full, content] of backups) {
      try {
        fs.writeFileSync(full, content, 'utf8');
      } catch (e) {
        logger.error(`[error-fix-agent] failed to restore ${full}: ${(e as Error).message}`);
      }
    }
  }

  private fail(backups: Map<string, string>, reason: string): ApplyResult {
    this.restore(backups);
    return {
      success: false,
      buildPassed: false,
      committed: false,
      pushed: false,
      buildOutput: '',
      failureReason: reason,
    };
  }

  private resolve(relativePath: string): string | null {
    const normalized = relativePath.replace(/^\/+/, '');
    const full = path.resolve(this.projectPath, normalized);
    const rel = path.relative(this.projectPath, full);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
    return full;
  }

  private toRelative(full: string): string {
    return path.relative(this.projectPath, full).replace(/\\/g, '/');
  }
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    count++;
    idx += needle.length;
  }
  return count;
}

function detectWorkspace(relativePath: string): string | null {
  for (const ws of WORKSPACES) {
    if (relativePath === ws || relativePath.startsWith(`${ws}/`)) return ws;
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
