module.exports = {
  apps: [
    {
      name: 'tri-tender-worker',
      script: './index.js',
      args: '--loop',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        WORKER_NAME: 'biddesk-engine-1',
        POLL_INTERVAL: '30',
      },
      // Restart policy
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
      // Logging
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Resource limits
      max_memory_restart: '512M',
    },
  ],
}
