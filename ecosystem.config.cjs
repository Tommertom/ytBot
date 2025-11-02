const dotenv = require('dotenv');
const path = require('path');

// Load .env file from ytBOT directory
const envConfig = dotenv.config({ path: path.join(__dirname, '.env') });

if (envConfig.error) {
  console.error('Error loading .env file:', envConfig.error);
}

module.exports = {
  apps: [
    {
      name: "ytBOT",
      script: "./dist/app.js",
      cwd: "/home/tom/ytBOT",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        ...envConfig.parsed,
      },
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_file: "./logs/combined.log",
      time: true,
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
