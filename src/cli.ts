/**
 * CLI entry point for ytBOT
 * Allows running via npx: npx ytbot
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as fs from 'fs';
import * as readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Prompts user for yes/no confirmation
 */
function promptUser(question: string): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.toLowerCase().trim() === 'y' || answer.toLowerCase().trim() === 'yes');
        });
    });
}

/**
 * Handles Docker setup - writes Dockerfile, docker-compose.yml, and .env to current directory
 */
async function handleDockerSetup(): Promise<void> {
    console.log('🐳 Docker Setup Mode\n');

    const currentDir = process.cwd();
    const dockerfilePath = join(currentDir, 'Dockerfile');
    const dockerComposePath = join(currentDir, 'docker-compose.yml');
    const envPath = join(currentDir, '.env');

    // Check if files exist
    const dockerfileExists = fs.existsSync(dockerfilePath);
    const dockerComposeExists = fs.existsSync(dockerComposePath);
    const envExists = fs.existsSync(envPath);

    // Prompt if Dockerfile exists
    if (dockerfileExists) {
        const overwrite = await promptUser('⚠️  Dockerfile already exists. Overwrite? (y/N): ');
        if (!overwrite) {
            console.log('❌ Skipping Dockerfile creation.');
        } else {
            writeDockerfile(dockerfilePath);
        }
    } else {
        writeDockerfile(dockerfilePath);
    }

    // Prompt if docker-compose.yml exists
    if (dockerComposeExists) {
        const overwrite = await promptUser('⚠️  docker-compose.yml already exists. Overwrite? (y/N): ');
        if (!overwrite) {
            console.log('❌ Skipping docker-compose.yml creation.');
        } else {
            writeDockerCompose(dockerComposePath);
        }
    } else {
        writeDockerCompose(dockerComposePath);
    }

    // Prompt if .env exists
    if (envExists) {
        const overwrite = await promptUser('⚠️  .env file already exists. Overwrite? (y/N): ');
        if (!overwrite) {
            console.log('❌ Skipping .env file creation.');
        } else {
            writeEnvFile(envPath);
        }
    } else {
        writeEnvFile(envPath);
    }

    console.log('\n✅ Docker setup complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Edit the .env file with your Telegram bot token and user IDs');
    console.log('   2. Run: docker-compose up -d');
    console.log('   3. View logs: docker-compose logs -f\n');
}

/**
 * Writes Dockerfile to the specified path
 */
function writeDockerfile(path: string): void {
    const dockerfileContent = `# Minimal Linux setup with Node.js, GitHub CLI, and GitHub Copilot CLI
FROM node:22-slim

# Install essential packages including build tools for node-pty
RUN apt-get update && apt-get install -y \\
    bash \\
    curl \\
    wget \\
    git \\
    gpg \\
    software-properties-common \\
    ca-certificates \\
    make \\
    python3 \\
    build-essential \\
    fonts-liberation \\
    libasound2 \\
    libatk-bridge2.0-0 \\
    libatk1.0-0 \\
    libc6 \\
    libcairo2 \\
    libcups2 \\
    libdbus-1-3 \\
    libexpat1 \\
    libfontconfig1 \\
    libgbm1 \\
    libgcc1 \\
    libglib2.0-0 \\
    libgtk-3-0 \\
    libnspr4 \\
    libnss3 \\
    libpango-1.0-0 \\
    libpangocairo-1.0-0 \\
    libstdc++6 \\
    libx11-6 \\
    libx11-xcb1 \\
    libxcb1 \\
    libxcomposite1 \\
    libxcursor1 \\
    libxdamage1 \\
    libxext6 \\
    libxfixes3 \\
    libxi6 \\
    libxrandr2 \\
    libxrender1 \\
    libxss1 \\
    libxtst6 \\
    lsb-release \\
    xdg-utils \\
    && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN (type -p wget >/dev/null || (apt update && apt install wget -y)) \\
    && mkdir -p -m 755 /etc/apt/keyrings \\
    && out=$(mktemp) && wget -nv -O$out https://cli.github.com/packages/githubcli-archive-keyring.gpg \\
    && cat $out | tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \\
    && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \\
    && mkdir -p -m 755 /etc/apt/sources.list.d \\
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \\
    && apt update \\
    && apt install gh -y \\
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g @github/copilot@latest
RUN npm install -g npm@latest

# Create working directory
WORKDIR /app

# Copy .env file (if building with local context)
# COPY .env /app/.env

# Create startup script
RUN echo '#!/bin/bash\\n\\
set -e\\n\\
\\n\\
# Update Copilot CLI\\n\\
npm install -g @github/copilot@latest\\n\\
\\n\\
# Run coderBOT using npx -y latest\\n\\
echo "Starting coderBOT..."\\n\\
npx -y @tommertom/coderbot@latest\\n\\
' > /app/start.sh && chmod +x /app/start.sh

# Run the startup script
CMD ["/app/start.sh"]

# Create info script for CLI tools
RUN echo '#!/bin/bash\\n\\
echo "=== Available AI CLI Tools ==="\\n\\
echo ""\\n\\
echo "GitHub Copilot CLI:"\\n\\
echo "  Status: Installed (requires authentication)"\\n\\
echo "  Setup: Run '\\''setup-copilot'\\'' for instructions"\\n\\
echo "  Usage: gh copilot suggest \\"your question\\""\\n\\
echo "         gh copilot explain \\"your code\\""\\n\\
echo ""\\n\\
echo "Claude CLI:"\\n\\
echo "  Status: No official CLI available"\\n\\
echo "  Alternative: Use curl with Anthropic API"\\n\\
echo "  Example: curl https://api.anthropic.com/v1/messages ..."\\n\\
echo ""\\n\\
echo "Cursor CLI:"\\n\\
echo "  Status: Not available (requires Cursor editor)"\\n\\
echo "  Alternative: Use GitHub Copilot CLI or other AI tools"\\n\\
echo ""\\n\\
echo "GitHub CLI: $(gh --version | head -1)"\\n\\
echo "Node.js: $(node --version)"\\n\\
echo "npm: $(npm --version)"\\n\\
' > /usr/local/bin/ai-tools-info && \\
    chmod +x /usr/local/bin/ai-tools-info

# Create a non-root user for running terminal sessions
RUN useradd -m -s /bin/bash botuser && \\
    echo "botuser ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/botuser

# Set working directory
WORKDIR /app

# Create necessary directories
RUN mkdir -p /app/logs /app/.env-default && \\
    chown -R node:node /app

# Switch to node user for running the bot
USER node

# Set environment variables
ENV NODE_ENV=production
ENV XTERM_SHELL_PATH=/bin/bash
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Install coderbot globally via npm
# This way we always get the latest published version
RUN npm install -g @tommertom/coderbot

# The .env file should be mounted via volume or passed as environment variables
# Create a startup script that handles .env creation if needed
RUN echo '#!/bin/bash\\n\\
# Check if .env exists in mounted volume or current directory\\n\\
if [ ! -f /app/.env ]; then\\n\\
    echo "⚠️  No .env file found at /app/.env"\\n\\
    echo "Please mount your .env file as a volume:"\\n\\
    echo "  docker run -v $(pwd)/.env:/app/.env ..."\\n\\
    echo ""\\n\\
    echo "Or set environment variables directly:"\\n\\
    echo "  -e TELEGRAM_BOT_TOKENS=your_token"\\n\\
    echo "  -e ALLOWED_USER_IDS=your_user_id"\\n\\
    exit 1\\n\\
fi\\n\\
\\n\\
# Run coderbot from the app directory where .env is mounted\\n\\
cd /app\\n\\
exec coderbot\\n\\
' > /home/node/start-coderbot.sh && chmod +x /home/node/start-coderbot.sh

# Start the bot using the startup script
CMD ["/home/node/start-coderbot.sh"]
`;

    fs.writeFileSync(path, dockerfileContent);
    console.log(`✅ Created Dockerfile at ${path}`);
}

/**
 * Writes docker-compose.yml to the specified path
 */
function writeDockerCompose(path: string): void {
    const dockerComposeContent = `version: "3.8"

services:
  coderbot:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: coderbot-instance
    volumes:
      - ./logs:/app/logs
      - coderbot-media:/tmp/coderBOT_media
      - ./.env:/app/.env:ro
    restart: unless-stopped
    tty: true
    stdin_open: true

volumes:
  coderbot-media:

      # Media folders for each bot worker
      - ./media:/tmp/coderBOT_media

      # Optional: Persist terminal history
      - terminal_history:/home/node

      # Optional: Mount a working directory for file operations
      - bot_workspace:/workspace

      # Optional: Persist GitHub CLI authentication (for Copilot CLI)
      - gh_config:/home/node/.config/gh

    # Resource limits (adjust based on your needs)
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 2G
        reservations:
          cpus: "0.5"
          memory: 512M

    # Security options
    security_opt:
      - no-new-privileges:true

    # Network configuration
    network_mode: "bridge"

    # Health check (optional)
    healthcheck:
      test: ["CMD", "node", "-e", "process.exit(0)"]
      interval: 60s
      timeout: 10s
      retries: 3
      start_period: 60s

volumes:
  terminal_history:
    driver: local
  bot_workspace:
    driver: local
  gh_config:
    driver: local
`;

    fs.writeFileSync(path, dockerComposeContent);
    console.log(`✅ Created docker-compose.yml at ${path}`);
}

/**
 * Writes .env file to the specified path
 */
function writeEnvFile(path: string): void {
    const envContent = `# Environment Variables

# Your Telegram bot tokens from @BotFather, separated by commas
# You can specify one or more tokens to run multiple bot instances
# Example: TELEGRAM_BOT_TOKENS=1234567890:AABBCCDDEEFFGGHHIIJJKKLLMMNNOOPPQQrrss,9876543210:ZZYYXXWWVVUUTTSSRRQQPPOONNMMllkkjjii
TELEGRAM_BOT_TOKENS=

# Comma-separated list of Telegram user IDs allowed to use the bot
# Example: ALLOWED_USER_IDS=123456789,987654321
ALLOWED_USER_IDS=

# Admin user ID who receives notifications about unauthorized access attempts
# This user will be notified when someone not in ALLOWED_USER_IDS tries to use the bot
# Example: ADMIN_USER_ID=123456789
ADMIN_USER_ID=

# Message Configuration
# Message auto-delete timeout in milliseconds (default: 10000 = 10 seconds)
# Time to wait before automatically deleting confirmation messages
# Set to 0 to disable auto-deletion of messages
MESSAGE_DELETE_TIMEOUT=10000
`;

    fs.writeFileSync(path, envContent);
    console.log(`✅ Created .env file at ${path}`);
}

// Parse command-line arguments
const args = process.argv.slice(2);
const dockerFlag = args.includes('--docker');

console.log('🤖 ytBOT - AI-Powered Telegram Terminal Bot');
console.log('================================================\n');

// Handle --docker flag
if (dockerFlag) {
    (async () => {
        await handleDockerSetup();
        process.exit(0);
    })();
} else {
    // Continue with normal startup
    startBot();
}

function startBot() {
    // Windows compatibility warning
    if (process.platform === 'win32') {
        console.log('⚠️  Windows is not supported for direct installation.');
        console.log('   ytBOT uses node-pty which requires native compilation.');
        console.log('\n   📦 Please use Docker instead:');
        console.log('   See https://github.com/Tommertom/ytBOT/blob/main/DOCKER_GUIDE.md\n');
    }

    // Check if .env file exists in current directory
    const envPath = join(process.cwd(), '.env');
    const templatePath = join(__dirname, '..', 'dot-env.template');

    if (!fs.existsSync(envPath)) {
        console.log('⚠️  No .env file found in current directory!');
        console.log('\n📝 Creating .env template...\n');

        if (fs.existsSync(templatePath)) {
            fs.copyFileSync(templatePath, envPath);
            console.log('✅ Created .env file from template');
            console.log('\n🔧 Please edit .env and configure:');
            console.log('   - TELEGRAM_BOT_TOKENS (required)');
            console.log('   - ALLOWED_USER_IDS (required)');
            console.log('\nThen run the command again.\n');
            process.exit(0);
        } else {
            console.log('❌ Template file not found. Please create .env manually.');
            console.log('\nRequired variables:');
            console.log('   TELEGRAM_BOT_TOKENS=your_bot_token_here');
            console.log('   ALLOWED_USER_IDS=your_user_id_here\n');
            process.exit(1);
        }
    }

    // Check if .env has the required variables
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const hasToken = /TELEGRAM_BOT_TOKENS\s*=\s*.+/.test(envContent);
    const hasUsers = /ALLOWED_USER_IDS\s*=\s*.+/.test(envContent);

    if (!hasToken || !hasUsers) {
        console.log('⚠️  .env file is incomplete!\n');
        if (!hasToken) console.log('   ❌ Missing TELEGRAM_BOT_TOKENS');
        if (!hasUsers) console.log('   ❌ Missing ALLOWED_USER_IDS');
        console.log('\n🔧 Please edit .env and configure the required variables.\n');
        process.exit(1);
    }

    console.log('🚀 Starting ytBOT...\n');

    // Start the main application
    const appPath = join(__dirname, 'app.js');

    // Windows-compatible process spawning
    const isWindows = process.platform === 'win32';
    const child = spawn('node', [appPath], {
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'production' },
        // On Windows, we need shell: false for proper signal handling
        shell: false,
        windowsHide: true
    });

    child.on('exit', (code) => {
        if (code !== 0) {
            console.error(`\n❌ ytBOT exited with code ${code}`);
            process.exit(code || 1);
        }
    });

    child.on('error', (err) => {
        console.error(`\n❌ Failed to start ytBOT: ${err.message}`);
        process.exit(1);
    });

    // Cross-platform signal handling
    if (isWindows) {
        // On Windows, use readline to handle Ctrl+C
        if (process.stdin.isTTY) {
            const readline = require('readline');
            readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
        }

        // Windows doesn't support POSIX signals properly, just kill the child
        process.on('SIGINT', () => {
            child.kill();
            process.exit(0);
        });
        process.on('SIGTERM', () => {
            child.kill();
            process.exit(0);
        });
        process.on('SIGBREAK', () => {
            child.kill();
            process.exit(0);
        });
    } else {
        // Unix-like systems support proper signal forwarding
        process.on('SIGINT', () => child.kill('SIGINT'));
        process.on('SIGTERM', () => child.kill('SIGTERM'));
    }
}
