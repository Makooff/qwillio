module.exports = {
  apps: [
    {
      name: 'qwillio-discord-bot',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      watch: false,
      env: {
        NODE_ENV: 'production'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      merge_logs: true,
      max_restarts: 10,
      restart_delay: 5000
    },
    {
      // Persistent Claude Code channel bridge — mirrors the main bot but
      // can be started independently as: pm2 start ecosystem.config.js --only claude-code-channel
      // Requires: DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, DISCORD_OWNER_USER_ID,
      //           DISCORD_CLAUDE_CODE_CHANNEL_ID set in environment.
      name: 'claude-code-channel',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      watch: false,
      env: {
        NODE_ENV: 'production',
        CLAUDE_CHANNEL_MODE: 'true'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/channel-error.log',
      out_file: 'logs/channel-out.log',
      merge_logs: true,
      max_restarts: 10,
      restart_delay: 5000
    }
  ]
};
