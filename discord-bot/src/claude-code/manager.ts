import {
  Client,
  Message,
  TextChannel,
  ThreadChannel,
  EmbedBuilder,
  ChannelType,
} from 'discord.js';
import { spawn, ChildProcess, execSync } from 'child_process';
import { config } from '../config';
import { logger } from '../utils/logger';
import { format } from 'date-fns';

interface ClaudeSession {
  thread: ThreadChannel;
  process: ChildProcess | null;
  isRunning: boolean;
  startedAt: Date | null;
  lastActivity: Date;
  outputBuffer: string;
  currentMessageId: string | null;
}

export class ClaudeCodeManager {
  private client: Client;
  private sessions: Map<string, ClaudeSession> = new Map();
  private archiveTimer: NodeJS.Timeout | null = null;

  constructor(client: Client) {
    this.client = client;
    // Auto-archive check every 30 minutes
    this.archiveTimer = setInterval(() => this.checkAutoArchive(), 30 * 60 * 1000);
  }

  async createSession(channel: TextChannel): Promise<ThreadChannel | null> {
    // Check limit
    const activeSessions = Array.from(this.sessions.values()).filter(
      (s) => !s.thread.archived
    );
    if (activeSessions.length >= config.maxClaudeCodeSessions) {
      return null;
    }

    const now = format(new Date(), 'dd/MM/yyyy HH:mm');
    const sessionNum = this.sessions.size + 1;
    const threadName = `Claude Code ${sessionNum} — ${now}`;

    const thread = await channel.threads.create({
      name: threadName,
      type: ChannelType.PrivateThread,
      reason: 'Claude Code session',
    });

    // Get git context
    let branch = 'unknown';
    let lastCommit = 'unknown';
    let commitAge = 'unknown';
    try {
      branch = execSync('git branch --show-current', { cwd: config.projectPath }).toString().trim();
      lastCommit = execSync('git log -1 --pretty=format:"%s"', { cwd: config.projectPath }).toString().trim();
      const commitTime = execSync('git log -1 --pretty=format:"%cr"', { cwd: config.projectPath }).toString().trim();
      commitAge = commitTime;
    } catch (e) {
      // ignore
    }

    const embed = new EmbedBuilder()
      .setTitle('🤖 Claude Code Ready')
      .setColor(0x5865f2)
      .setDescription(
        `**Project:** Qwillio on \`${branch}\`\n` +
        `**Last commit:** ${lastCommit} (${commitAge})\n\n` +
        `What do you want to build?`
      )
      .setFooter({ text: 'Type your request or use /commands' });

    await thread.send({ embeds: [embed] });

    this.sessions.set(thread.id, {
      thread,
      process: null,
      isRunning: false,
      startedAt: null,
      lastActivity: new Date(),
      outputBuffer: '',
      currentMessageId: null,
    });

    return thread;
  }

  async handleMessage(message: Message): Promise<void> {
    const session = this.sessions.get(message.channel.id);
    if (!session) return;

    session.lastActivity = new Date();

    // Handle slash-like commands in thread
    const content = message.content.trim();
    if (content.startsWith('/')) {
      await this.handleThreadCommand(session, message);
      return;
    }

    // If already running, queue or notify
    if (session.isRunning) {
      await message.reply('⏳ Claude Code is currently processing. Wait for it to finish or use `/stop` to cancel.');
      return;
    }

    // Execute Claude Code
    await this.executeClaudeCode(session, content, message);
  }

  private async handleThreadCommand(session: ClaudeSession, message: Message): Promise<void> {
    const [cmd, ...args] = message.content.trim().split(' ');

    switch (cmd.toLowerCase()) {
      case '/status': {
        const status = session.isRunning ? '🟢 Running' : '⚪ Idle';
        const duration = session.startedAt
          ? `${Math.floor((Date.now() - session.startedAt.getTime()) / 1000)}s`
          : 'N/A';
        await message.reply(`**Status:** ${status}\n**Duration:** ${duration}`);
        break;
      }

      case '/stop': {
        if (session.process) {
          session.process.kill('SIGTERM');
          session.isRunning = false;
          session.process = null;
          await message.reply('⏹ Claude Code process stopped.');
        } else {
          await message.reply('No active process to stop.');
        }
        break;
      }

      case '/files': {
        try {
          const files = execSync(
            'git diff --name-only HEAD~5 HEAD 2>/dev/null || git diff --name-only',
            { cwd: config.projectPath }
          ).toString().trim();
          await message.reply(`**Recently modified files:**\n\`\`\`\n${files || 'No changes'}\n\`\`\``);
        } catch {
          await message.reply('Could not get file list.');
        }
        break;
      }

      case '/diff': {
        try {
          const diff = execSync('git diff --stat', { cwd: config.projectPath }).toString().trim();
          const output = diff || 'No uncommitted changes';
          if (output.length > 1900) {
            await message.reply(`**Git diff:**\n\`\`\`\n${output.substring(0, 1900)}...\n\`\`\``);
          } else {
            await message.reply(`**Git diff:**\n\`\`\`\n${output}\n\`\`\``);
          }
        } catch {
          await message.reply('Could not get diff.');
        }
        break;
      }

      case '/commit': {
        const commitMsg = args.join(' ') || 'Update from Claude Code';
        try {
          execSync('git add -A', { cwd: config.projectPath });
          const result = execSync(`git commit -m "${commitMsg}"`, { cwd: config.projectPath }).toString();
          await message.reply(`✅ Committed:\n\`\`\`\n${result}\n\`\`\``);
        } catch (e: any) {
          await message.reply(`❌ Commit failed:\n\`\`\`\n${e.message}\n\`\`\``);
        }
        break;
      }

      case '/push': {
        try {
          const result = execSync('git push origin HEAD', { cwd: config.projectPath }).toString();
          await message.reply(`✅ Pushed:\n\`\`\`\n${result || 'Success'}\n\`\`\``);
        } catch (e: any) {
          await message.reply(`❌ Push failed:\n\`\`\`\n${e.stderr?.toString() || e.message}\n\`\`\``);
        }
        break;
      }

      case '/deploy': {
        await this.executeDeploy(session, message);
        break;
      }

      case '/logs': {
        try {
          const logs = execSync('npx vercel logs --limit 50 2>/dev/null || echo "No logs available"', {
            cwd: config.projectPath,
          }).toString().trim();
          const output = logs.substring(0, 1900);
          await message.reply(`**Recent logs:**\n\`\`\`\n${output}\n\`\`\``);
        } catch {
          await message.reply('Could not fetch logs.');
        }
        break;
      }

      case '/rollback': {
        try {
          const result = execSync('npx vercel rollback --yes 2>&1', { cwd: config.projectPath }).toString();
          await message.reply(`🔄 Rollback:\n\`\`\`\n${result}\n\`\`\``);
        } catch (e: any) {
          await message.reply(`❌ Rollback failed:\n\`\`\`\n${e.message}\n\`\`\``);
        }
        break;
      }

      case '/clear': {
        session.outputBuffer = '';
        await message.reply('🧹 Context cleared.');
        break;
      }

      case '/close': {
        await message.reply('👋 Archiving thread...');
        await session.thread.setArchived(true);
        this.sessions.delete(session.thread.id);
        break;
      }

      default:
        await message.reply(`Unknown command: ${cmd}. Available: /status, /stop, /files, /diff, /commit, /push, /deploy, /logs, /rollback, /clear, /close`);
    }
  }

  private async executeClaudeCode(session: ClaudeSession, prompt: string, message: Message): Promise<void> {
    session.isRunning = true;
    session.startedAt = new Date();

    // Send initial "processing" message
    const responseMsg = await message.reply('⏳ Processing...');
    session.currentMessageId = responseMsg.id;

    let output = '';
    let lastUpdate = Date.now();

    try {
      // Spawn claude CLI — ensure npm global bin is in PATH
      const npmGlobalBin = process.platform === 'win32'
        ? `${process.env.APPDATA || ''}\\npm`
        : '/usr/local/bin';
      const nodePath = process.platform === 'win32'
        ? 'C:\\Program Files\\nodejs'
        : '/usr/local/bin';
      const extendedPath = `${npmGlobalBin};${nodePath};${process.env.PATH || ''}`;

      logger.info(`Claude Code: spawning claude --print for prompt: "${prompt.substring(0, 50)}..."`);

      const proc = spawn('claude', ['--print', prompt], {
        cwd: config.projectPath,
        shell: true,
        env: { ...process.env, PATH: extendedPath },
        timeout: 120000, // 2 min timeout
      });

      session.process = proc;

      const updateMessage = async () => {
        if (output.length === 0) return;
        const now = Date.now();
        if (now - lastUpdate < 1000) return; // Rate limit to 1s
        lastUpdate = now;

        const displayOutput = output.length > 1900
          ? '...' + output.substring(output.length - 1900)
          : output;

        try {
          await responseMsg.edit(`\`\`\`\n${displayOutput}\n\`\`\``);
        } catch {
          // Message may have been deleted
        }
      };

      proc.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
        updateMessage();
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        logger.debug(`Claude stderr: ${text.substring(0, 200)}`);
        output += text;
        updateMessage();
      });

      proc.on('error', (err) => {
        logger.error(`Claude Code spawn error: ${err.message}`);
        session.isRunning = false;
        session.process = null;
        responseMsg.edit(`❌ Error: ${err.message}`).catch(() => {});
      });

      await new Promise<void>((resolve) => {
        proc.on('close', (code) => {
          logger.info(`Claude Code process exited with code ${code}, output length: ${output.length}`);
          session.isRunning = false;
          session.process = null;

          // Post final output
          const chunks = this.splitOutput(output);
          const editFirst = async () => {
            if (chunks.length === 0) {
              await responseMsg.edit('✅ Done (no output)').catch(() => {});
              return;
            }

            await responseMsg.edit(`\`\`\`\n${chunks[0]}\n\`\`\``).catch(() => {});
            for (let i = 1; i < chunks.length; i++) {
              await session.thread.send(`\`\`\`\n${chunks[i]}\n\`\`\``).catch(() => {});
            }
          };

          editFirst().then(() => {
            // Post completion summary
            const duration = session.startedAt
              ? Math.floor((Date.now() - session.startedAt.getTime()) / 1000)
              : 0;

            let gitStatus = '';
            try {
              gitStatus = execSync('git status --short', { cwd: config.projectPath }).toString().trim();
            } catch {
              // ignore
            }

            const summary = new EmbedBuilder()
              .setTitle(code === 0 ? '✅ Task Complete' : '❌ Task Failed')
              .setColor(code === 0 ? 0x00ff00 : 0xff0000)
              .addFields(
                { name: 'Duration', value: `${duration}s`, inline: true },
                { name: 'Exit Code', value: `${code}`, inline: true },
              );

            if (gitStatus) {
              summary.addFields({
                name: 'Uncommitted Changes',
                value: `\`\`\`\n${gitStatus.substring(0, 900)}\n\`\`\``,
              });
            }

            session.thread.send({ embeds: [summary] }).catch(() => {});
            resolve();
          });
        });
      });
    } catch (error: any) {
      session.isRunning = false;
      session.process = null;

      const errEmbed = new EmbedBuilder()
        .setTitle('❌ Error')
        .setColor(0xff0000)
        .setDescription(`\`\`\`\n${error.message}\n\`\`\``);

      await session.thread.send({ embeds: [errEmbed] }).catch(() => {});
    }
  }

  private async executeDeploy(session: ClaudeSession, message: Message): Promise<void> {
    const statusMsg = await message.reply('🚀 Deploying to Vercel...');

    try {
      const result = execSync('npx vercel --prod --yes 2>&1', {
        cwd: config.projectPath,
        timeout: 300000,
      }).toString();

      await statusMsg.edit(`✅ Deploy complete:\n\`\`\`\n${result.substring(0, 1900)}\n\`\`\``);
    } catch (e: any) {
      await statusMsg.edit(`❌ Deploy failed:\n\`\`\`\n${(e.stderr?.toString() || e.message).substring(0, 1900)}\n\`\`\``);
    }
  }

  private splitOutput(output: string): string[] {
    const maxLen = 1900;
    if (output.length <= maxLen) return [output];

    const chunks: string[] = [];
    for (let i = 0; i < output.length; i += maxLen) {
      chunks.push(output.substring(i, i + maxLen));
    }
    return chunks;
  }

  private async checkAutoArchive(): Promise<void> {
    const now = Date.now();
    const archiveMs = config.claudeCodeAutoArchiveHours * 60 * 60 * 1000;

    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity.getTime() > archiveMs && !session.isRunning) {
        try {
          await session.thread.send('💤 Auto-archiving after 4 hours of inactivity.');
          await session.thread.setArchived(true);
          this.sessions.delete(id);
          logger.info(`Auto-archived Claude Code thread: ${id}`);
        } catch (error) {
          logger.warn('Failed to auto-archive thread:', error);
        }
      }
    }
  }

  getSessionCount(): number {
    return Array.from(this.sessions.values()).filter((s) => !s.thread.archived).length;
  }

  getActiveProcess(): ClaudeSession | undefined {
    return Array.from(this.sessions.values()).find((s) => s.isRunning);
  }
}
