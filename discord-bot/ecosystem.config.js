module.exports = {
  apps: [{
    name: 'qwillio-discord-bot',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '512M',
    watch: false,
    env: {
      NODE_ENV: 'production',
      ERROR_FIX_AGENT_ENABLED: 'true',
      ERROR_FIX_AGENT_MODEL: 'claude-sonnet-4-5',
      ERROR_FIX_AGENT_AUTO_COMMIT: 'true',
      ERROR_FIX_AGENT_AUTO_PUSH: 'true',
      ERROR_FIX_AGENT_MIN_CONFIDENCE: 'medium'
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: 'logs/error.log',
    out_file: 'logs/out.log',
    merge_logs: true,
    max_restarts: 10,
    restart_delay: 5000
  }]
};
