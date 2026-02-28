module.exports = {
  apps: [{
    name: 'adiction-boutique',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/ADICTIONBOUTIQUE',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 4000
    },
    error_file: '/var/log/pm2/adiction-error.log',
    out_file: '/var/log/pm2/adiction-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
}
