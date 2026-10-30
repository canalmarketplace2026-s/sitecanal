module.exports = {
  apps: [
    { name: 'site', cwd: '/home/dev/app', script: 'node_modules/next/dist/bin/next', args: 'start -p 3000', instances: 1, max_memory_restart: '1200M', env: { NODE_ENV: 'production' } },
    { name: 'tiny-sync', cwd: '/home/dev/app', script: 'scripts/cron-worker.js', instances: 1, max_memory_restart: '350M', env: { NODE_ENV: 'production' } },
  ],
};
