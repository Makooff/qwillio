import { Client, TextChannel, Message } from 'discord.js';
import { spawn, ChildProcess, execSync } from 'child_process';
import { config } from '../config';
import { logger } from '../utils/logger';

interface BridgeState {
  isRunning: boolean;
  currentTask: string;
  startedAt: Date | null;
  process: ChildProcess | null;
}

const RATE_LIMIT_MS = 2000; // 1 message per 2 seconds
const CHUNK_MAX = 1900;

export class ClaudeChannelBridge {
  private client: Client;
  private channel: TextChannel | null = null;
  private state: BridgeState = {
    isRunning: false,
    currentTask: '',
    startedAt: null,
    process: null,
  };

  constructor(client: Client) {
    this.client = client;
  }

  async initialize(): Promise<void> {
    const channelId = config.claudeCodeChannelId;
    if (!channelId) {
      logger.info('DISCORD_CLAUDE_CODE_CHANNEL_ID not set — channel bridge disabled');
      return;
    }

    try {
      const ch = await this.client.channels.fetch(channelId);
      if (ch && ch.isTextBased() && !ch.isThread() && ch.isSendable()) {
        this.channel = ch as TextChannel;
        logger.info(`Claude Code channel bridge connected: #${this.channel.name}`);
        await this.channel.send('🤖 **Claude Code** channel bridge online. Send any message or use `/ask [prompt]`.');
      } else {
        logger.warn(`Channel ${channelId} is not a sendable text channel`);
      }
    } catch (error) {
      logger.warn('Could not connect to Claude Code channel:', error);
    }
  }

  isChannelMessage(message: Message): boolean {
    return message.channel.id === config.claudeCodeChannelId;
  }

  async handleMessage(message: Message): Promise<void> {
    const content = message.content.trim();
    if (!content) return;

    if (this.state.isRunning) {
      await message.reply('⏳ Already processing. Use `/stop` to cancel the current task.');
      return;
    }

    await this.execute(content, message);
  }

  async execute(prompt: string, replyTo?: Message): Promise<void> {
    if (this.state.isRunning || !this.channel) return;

    this.state.isRunning = true;
    this.state.startedAt = new Date();
    this.state.currentTask = prompt.length > 120 ? prompt.slice(0, 120) + '...' : prompt;

    const statusMsg = replyTo
      ? await replyTo.reply('⏳ Processing...')
      : await this.channel.send('⏳ Processing...');

    let output = '';
    let lastUpdateAt = 0;

    const flushUpdate = async (force = false) => {
      const now = Date.now();
      if (!force && now - lastUpdateAt < RATE_LIMIT_MS) return;
      if (output.length === 0) return;
      lastUpdateAt = now;

      const display = output.length > CHUNK_MAX
        ? '...' + output.slice(-(CHUNK_MAX))
        : output;

      try {
        await statusMsg.edit(`\`\`\`\n${display}\n\`\`\``);
      } catch {
        // message may have been deleted
      }
    };

    try {
      const extPath = `/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`;

      logger.info(`Channel bridge: spawning claude for "${prompt.slice(0, 60)}..."`);

      const proc = spawn('claude', ['--print', prompt], {
        cwd: config.projectPath,
        shell: true,
        env: { ...process.env, PATH: extPath },
        timeout: 180_000,
      });

      this.state.process = proc;

      proc.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
        flushUpdate();
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        logger.debug(`Claude channel stderr: ${text.slice(0, 200)}`);
        output += text;
        flushUpdate();
      });

      proc.on('error', (err) => {
        logger.error(`Channel bridge spawn error: ${err.message}`);
        this.state.isRunning = false;
        this.state.process = null;
        statusMsg.edit(`❌ Spawn error: ${err.message}`).catch(() => {});
      });

      await new Promise<void>((resolve) => {
        proc.on('close', async (code) => {
          this.state.isRunning = false;
          this.state.process = null;

          const chunks = this.splitOutput(output);

          if (chunks.length === 0) {
            await statusMsg.edit('✅ Done (no output).').catch(() => {});
          } else {
            await statusMsg.edit(`\`\`\`\n${chunks[0]}\n\`\`\``).catch(() => {});
            for (let i = 1; i < chunks.length; i++) {
              await this.sleep(RATE_LIMIT_MS);
              await this.channel!.send(`\`\`\`\n${chunks[i]}\n\`\`\``).catch(() => {});
            }
          }

          const duration = this.state.startedAt
            ? Math.floor((Date.now() - this.state.startedAt.getTime()) / 1000)
            : 0;

          let gitStatus = '';
          try {
            gitStatus = execSync('git status --short', { cwd: config.projectPath }).toString().trim();
          } catch {
            // ignore
          }

          const summary = [
            `${code === 0 ? '✅ Done' : '❌ Failed'} — ${duration}s | exit ${code}`,
            gitStatus ? `\`\`\`\n${gitStatus.slice(0, 500)}\n\`\`\`` : '',
          ].filter(Boolean).join('\n');

          await this.channel!.send(summary).catch(() => {});
          resolve();
        });
      });
    } catch (error: any) {
      this.state.isRunning = false;
      this.state.process = null;
      await this.channel.send(`❌ \`\`\`\n${error.message}\n\`\`\``).catch(() => {});
    }
  }

  stop(): boolean {
    if (this.state.process) {
      this.state.process.kill('SIGTERM');
      this.state.isRunning = false;
      this.state.process = null;
      return true;
    }
    return false;
  }

  getStatus() {
    const { isRunning, currentTask, startedAt } = this.state;
    const durationSeconds = isRunning && startedAt
      ? Math.floor((Date.now() - startedAt.getTime()) / 1000)
      : null;
    return { isRunning, currentTask, durationSeconds };
  }

  private splitOutput(output: string): string[] {
    if (output.length <= CHUNK_MAX) return [output];
    const chunks: string[] = [];
    for (let i = 0; i < output.length; i += CHUNK_MAX) {
      chunks.push(output.slice(i, i + CHUNK_MAX));
    }
    return chunks;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
