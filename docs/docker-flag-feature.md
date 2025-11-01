# Docker Flag Feature

## Overview

The `--docker` flag is a CLI feature that allows users to quickly generate Docker configuration files (Dockerfile and docker-compose.yml) in their current directory when running ytBot via npx.

## Usage

```bash
npx @tommertom/ytbot@latest --docker
```

## Behavior

When the `--docker` flag is provided:

1. **File Generation**: The CLI generates two files in the current working directory:
   - `Dockerfile` - Production-ready Docker image configuration
   - `docker-compose.yml` - Docker Compose orchestration file

2. **Overwrite Protection**: If either file already exists, the user is prompted:
   ```
   ⚠️  Dockerfile already exists. Overwrite? (y/N):
   ```
   - User can respond with `y`, `yes`, `n`, or `no` (case-insensitive)
   - If user declines, that file is skipped
   - Both files are checked independently

3. **Completion**: After file generation, the CLI provides next steps:
   ```
   ✅ Docker setup complete!

   📝 Next steps:
      1. Create a .env file with your configuration
      2. Run: docker-compose up -d
      3. View logs: docker-compose logs -f
   ```

4. **Exit**: The CLI exits immediately after Docker setup (it does not start the bot)

## Implementation Details

### File Location

Files are written to:
- `process.cwd()` - The current working directory where the command was executed

### File Contents

The generated files contain:

**Dockerfile**:
- Node.js 22-slim base image
- All required dependencies for ytBot
- GitHub CLI and Copilot installation
- Puppeteer dependencies
- Non-root user configuration
- Production environment setup

**docker-compose.yml**:
- Service definition for ytBot
- Volume mounts for logs, media, and .env file
- Resource limits (2GB memory, 2 CPU cores)
- Health checks
- Security options
- Persistent volumes for terminal history, workspace, and GitHub CLI config

### Code Structure

The implementation is in `src/cli.ts`:

1. **Argument Parsing**: Checks for `--docker` in `process.argv`
2. **Main Handler**: `handleDockerSetup()` - async function managing the workflow
3. **User Prompts**: `promptUser()` - readline-based confirmation
4. **File Writers**: 
   - `writeDockerfile()` - generates Dockerfile
   - `writeDockerCompose()` - generates docker-compose.yml

### Flow Control

```
User runs: npx @tommertom/ytbot --docker
         ↓
CLI detects --docker flag
         ↓
Execute handleDockerSetup() in IIFE
         ↓
Check if Dockerfile exists → Prompt if yes
         ↓
Write Dockerfile (if approved/new)
         ↓
Check if docker-compose.yml exists → Prompt if yes
         ↓
Write docker-compose.yml (if approved/new)
         ↓
Display completion message
         ↓
Exit with code 0
```

## Examples

### First Time Setup (Clean Directory)

```bash
$ npx @tommertom/ytbot@latest --docker
🤖 ytBOT - AI-Powered Telegram Terminal Bot
================================================

🐳 Docker Setup Mode

✅ Created Dockerfile at /home/user/myproject/Dockerfile
✅ Created docker-compose.yml at /home/user/myproject/docker-compose.yml

✅ Docker setup complete!

📝 Next steps:
   1. Create a .env file with your configuration
   2. Run: docker-compose up -d
   3. View logs: docker-compose logs -f
```

### Files Already Exist (Decline Overwrite)

```bash
$ npx @tommertom/ytbot@latest --docker
🤖 ytBOT - AI-Powered Telegram Terminal Bot
================================================

🐳 Docker Setup Mode

⚠️  Dockerfile already exists. Overwrite? (y/N): n
❌ Skipping Dockerfile creation.
⚠️  docker-compose.yml already exists. Overwrite? (y/N): no
❌ Skipping docker-compose.yml creation.

✅ Docker setup complete!

📝 Next steps:
   1. Create a .env file with your configuration
   2. Run: docker-compose up -d
   3. View logs: docker-compose logs -f
```

### Files Already Exist (Accept Overwrite)

```bash
$ npx @tommertom/ytbot@latest --docker
🤖 ytBOT - AI-Powered Telegram Terminal Bot
================================================

🐳 Docker Setup Mode

⚠️  Dockerfile already exists. Overwrite? (y/N): yes
✅ Created Dockerfile at /home/user/myproject/Dockerfile
⚠️  docker-compose.yml already exists. Overwrite? (y/N): y
✅ Created docker-compose.yml at /home/user/myproject/docker-compose.yml

✅ Docker setup complete!

📝 Next steps:
   1. Create a .env file with your configuration
   2. Run: docker-compose up -d
   3. View logs: docker-compose logs -f
```

## Testing

Manual testing was performed to verify:
- ✅ Files are created in clean directory
- ✅ Prompts appear when files exist
- ✅ "no" response skips file creation
- ✅ "yes" response overwrites files
- ✅ Case-insensitive input handling (y/Y/yes/Yes/YES, n/N/no/No/NO)
- ✅ Normal bot startup (without --docker flag) remains unaffected
- ✅ Generated files have correct content matching repo versions

## Future Enhancements

Potential improvements:
- Add `--docker-only-compose` flag to generate only docker-compose.yml
- Add `--docker-only-file` flag to generate only Dockerfile
- Support custom output directory via `--docker-dir=/path/to/dir`
- Add `--docker-template=<name>` for different Docker configurations
