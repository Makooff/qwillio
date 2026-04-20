import { Client, Message, EmbedBuilder, TextChannel } from 'discord.js';
import { config } from '../config';
import { logger } from '../utils/logger';
import { parseErrorFromMessage, ParsedError } from './parser';
import { ClaudeFixClient, FixProposal } from './claude';
import { FixApplier, ApplyResult } from './applier';

export interface ErrorFixAgentOptions {
  enabled: boolean;
  anthropicApiKey: string;
  model: string;
  alertsChannelId: string;
  systemChannelId: string;
  projectPath: string;
  autoCommit: boolean;
  autoPush: boolean;
  branch: string;
  minConfidence: 'high' | 'medium' | 'low';
}

export class ErrorFixAgent {
  private client: Client;
  private opts: ErrorFixAgentOptions;
  private claude: ClaudeFixClient;
  private applier: FixApplier;
  private processing = false;

  constructor(client: Client, opts: ErrorFixAgentOptions) {
    this.client = client;
    this.opts = opts;
    this.claude = new ClaudeFixClient(opts.anthropicApiKey, opts.model);
    this.applier = new FixApplier(opts.projectPath, {
      autoCommit: opts.autoCommit,
      autoPush: opts.autoPush,
      branch: opts.branch,
    });
  }

  isAlertMessage(message: Message): boolean {
    return message.channel.id === this.opts.alertsChannelId;
  }

  async handleAlert(message: Message): Promise<void> {
    if (!this.opts.enabled) return;
    if (message.channel.id !== this.opts.alertsChannelId) return;

    const parsed = parseErrorFromMessage(message);
    if (!parsed) {
      logger.debug('[error-fix-agent] Message in #qwillio-alerts did not look like an error');
      return;
    }

    if (this.processing) {
      logger.info('[error-fix-agent] Busy — deferring new alert');
      await this.postSystem({
        status: 'skipped',
        title: 'Alert received while busy',
        analysis: `Another fix is in progress. Error: ${parsed.message.slice(0, 200)}`,
      });
      return;
    }

    this.processing = true;
    try {
      await this.process(parsed);
    } catch (err) {
      logger.error(`[error-fix-agent] pipeline crashed: ${(err as Error).stack ?? (err as Error).message}`);
      await this.postSystem({
        status: 'needs-human',
        title: 'Agent crashed',
        analysis: `Unhandled error: ${(err as Error).message}`,
        error: parsed,
      });
    } finally {
      this.processing = false;
    }
  }

  private async process(parsed: ParsedError): Promise<void> {
    logger.info(`[error-fix-agent] Processing: ${parsed.message.slice(0, 160)}`);

    const fileContexts = this.applier.gatherContext(parsed.file);
    if (fileContexts.length === 0 && parsed.file) {
      logger.warn(`[error-fix-agent] Could not read file context for ${parsed.file}`);
    }

    let proposal: FixProposal;
    try {
      proposal = await this.claude.proposeFix(parsed, fileContexts);
    } catch (e) {
      await this.postSystem({
        status: 'needs-human',
        title: 'Claude API failure',
        analysis: (e as Error).message,
        error: parsed,
      });
      return;
    }

    if (!proposal.canFix || proposal.edits.length === 0) {
      await this.postSystem({
        status: 'needs-human',
        title: '⚠️ Needs human review',
        analysis: proposal.analysis || 'Claude declined to propose a fix.',
        error: parsed,
      });
      return;
    }

    if (!confidenceMeets(proposal.confidence, this.opts.minConfidence)) {
      await this.postSystem({
        status: 'needs-human',
        title: '⚠️ Needs human review (low confidence)',
        analysis: `Confidence: ${proposal.confidence}\n\n${proposal.analysis}`,
        error: parsed,
        proposal,
      });
      return;
    }

    const result = await this.applier.applyAndFinalize(proposal.edits, proposal.commitMessage);

    if (!result.success) {
      await this.postSystem({
        status: 'needs-human',
        title: '⚠️ Needs human review (apply failed)',
        analysis: `${proposal.analysis}\n\nApply failure: ${result.failureReason}`,
        error: parsed,
        proposal,
        applyResult: result,
      });
      return;
    }

    await this.postSystem({
      status: 'fixed',
      title: '✅ FIXED',
      analysis: proposal.analysis,
      error: parsed,
      proposal,
      applyResult: result,
    });
  }

  private async postSystem(payload: {
    status: 'fixed' | 'needs-human' | 'skipped';
    title: string;
    analysis: string;
    error?: ParsedError;
    proposal?: FixProposal;
    applyResult?: ApplyResult;
  }): Promise<void> {
    const ch = await this.resolveSystemChannel();
    if (!ch) {
      logger.warn('[error-fix-agent] System channel unavailable — logging only');
      logger.info(`[error-fix-agent][${payload.status}] ${payload.title}: ${payload.analysis}`);
      return;
    }

    const colors = { fixed: 0x00ff00, 'needs-human': 0xffaa00, skipped: 0x808080 };
    const embed = new EmbedBuilder()
      .setTitle(payload.title)
      .setColor(colors[payload.status])
      .setDescription(truncate(payload.analysis, 1800))
      .setTimestamp();

    if (payload.error) {
      embed.addFields({
        name: 'Error',
        value: truncate('```\n' + payload.error.message + '\n```', 1000),
      });
      if (payload.error.file) {
        embed.addFields({
          name: 'Location',
          value: `${payload.error.file}${payload.error.line ? `:${payload.error.line}` : ''}`,
          inline: true,
        });
      }
    }

    if (payload.proposal) {
      embed.addFields({ name: 'Confidence', value: payload.proposal.confidence, inline: true });
      embed.addFields({
        name: 'Edits',
        value: payload.proposal.edits.map((e) => `• ${e.file}`).join('\n').slice(0, 1000) || '(none)',
      });
    }

    if (payload.applyResult) {
      const { buildPassed, committed, pushed, commitSha } = payload.applyResult;
      embed.addFields({
        name: 'Pipeline',
        value: [
          `Build: ${buildPassed ? '✅' : '❌'}`,
          `Commit: ${committed ? '✅' : '❌'}${commitSha ? ` (${commitSha.slice(0, 7)})` : ''}`,
          `Push: ${pushed ? '✅' : '❌'}`,
        ].join('\n'),
        inline: false,
      });
    }

    try {
      await ch.send({ embeds: [embed] });
    } catch (e) {
      logger.error(`[error-fix-agent] failed to post to #qwillio-system: ${(e as Error).message}`);
    }
  }

  private async resolveSystemChannel(): Promise<TextChannel | null> {
    if (!this.opts.systemChannelId) return null;
    try {
      const ch = await this.client.channels.fetch(this.opts.systemChannelId);
      if (ch && ch.isTextBased()) return ch as TextChannel;
    } catch (e) {
      logger.warn(`[error-fix-agent] could not fetch system channel: ${(e as Error).message}`);
    }
    return null;
  }
}

function confidenceMeets(actual: 'high' | 'medium' | 'low', min: 'high' | 'medium' | 'low'): boolean {
  const rank = { low: 0, medium: 1, high: 2 };
  return rank[actual] >= rank[min];
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 3) + '...';
}

export function loadErrorFixAgentOptions(): ErrorFixAgentOptions {
  return {
    enabled: (process.env.ERROR_FIX_AGENT_ENABLED ?? 'true').toLowerCase() !== 'false',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
    model: process.env.ERROR_FIX_AGENT_MODEL ?? 'claude-sonnet-4-5',
    alertsChannelId: config.channels.alerts,
    systemChannelId: config.channels.system,
    projectPath: config.projectPath,
    autoCommit: (process.env.ERROR_FIX_AGENT_AUTO_COMMIT ?? 'true').toLowerCase() !== 'false',
    autoPush: (process.env.ERROR_FIX_AGENT_AUTO_PUSH ?? 'true').toLowerCase() !== 'false',
    branch: process.env.ERROR_FIX_AGENT_BRANCH ?? 'main',
    minConfidence: (process.env.ERROR_FIX_AGENT_MIN_CONFIDENCE as 'high' | 'medium' | 'low') ?? 'medium',
  };
}
