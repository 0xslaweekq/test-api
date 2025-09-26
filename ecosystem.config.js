module.exports = {
  apps: [
    {
      name: 'test-api-server',
      script: './server/dist/server.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5173,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 5173,
      },
      error_file: './logs/server-err.log',
      out_file: './logs/server-out.log',
      log_file: './logs/server-combined.log',
      time: true,
      merge_logs: true,
      node_args: ['--max_old_space_size=1024'],
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      port: 5173,
    },
    // {
    //   name: 'test-api-client',
    //   script: './client/dist/main.js',
    //   cwd: __dirname,
    //   instances: 1,
    //   autorestart: true,
    //   watch: false,
    //   max_memory_restart: '1G',
    //   env: {
    //     NODE_ENV: 'production',
    //     PORT: 5173,
    //   },
    //   env_development: {
    //     NODE_ENV: 'development',
    //     PORT: 5173,
    //   },
    //   error_file: './logs/client-err.log',
    //   out_file: './logs/client-out.log',
    //   log_file: './logs/client-combined.log',
    //   time: true,
    //   merge_logs: true,
    //   node_args: ['--max_old_space_size=1024'],
    //   log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    //   port: 5173,
    // }
  ],
};
