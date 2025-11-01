# Docker Setup CLI Feature

## Overview

The ytBOT CLI now includes a `--docker` flag that automatically sets up Docker configuration files for easy containerized deployment.

## How It Works

When you run `npx ytbot --docker`, the CLI will:

1. **Copy Dockerfile** from the npm package to your current directory
2. **Copy docker-compose.yml** from the npm package to your current directory
3. **Create .env template** in your current directory with all necessary environment variables

## File Sources

- **Dockerfile**: Copied from the package's root `Dockerfile`
- **docker-compose.yml**: Copied from the package's root `docker-compose.yml`
- **.env**: Generated from template with required environment variables

These files are included in the npm package via the `files` array in `package.json`:

```json
"files": [
  "dist/**/*",
  "dot-env.template",
  "Dockerfile",
  "docker-compose.yml",
  "README.md",
  "LICENSE"
]
```

## Usage

```bash
# Run the docker setup
npx ytbot --docker

# Follow the prompts if files already exist
# The CLI will ask before overwriting:
#   - Dockerfile
#   - docker-compose.yml
#   - .env

# After setup, edit .env and run:
docker-compose up -d
```

## File Overwrite Protection

The CLI includes safety features to protect your configuration:

### .env File (Never Overwritten)
- If `.env` already exists, it is **never overwritten**
- The CLI will display: `ℹ️ .env file already exists. Keeping existing configuration.`
- This protects your sensitive credentials and custom configuration

### Dockerfile and docker-compose.yml (Prompt Before Overwrite)
- If a file already exists, you'll be asked: `⚠️ [filename] already exists. Overwrite? (y/N):`
- Answer `y` or `yes` to overwrite
- Answer `n` or anything else to skip that file

## Implementation Details

### CLI Changes (`src/cli.ts`)

The `handleDockerSetup()` function now:
- Locates the package directory using `__dirname`
- Copies files from package using `fs.copyFileSync()`
- Handles missing source files gracefully with error messages

### Copy Functions

Two new helper functions were added:

- `copyDockerfile(sourcePath, destinationPath)`: Copies the Dockerfile from package
- `copyDockerCompose(sourcePath, destinationPath)`: Copies docker-compose.yml from package

Both functions include error handling and user feedback.

## Benefits

1. **Always Up-to-Date**: Docker configuration is maintained in one place (the package)
2. **Consistent Setup**: All users get the same Docker configuration
3. **Easy Updates**: When the package updates, users get new Docker configs
4. **No Hardcoded Content**: Eliminates large inline strings in the CLI code

## Error Handling

If source files are not found in the package (e.g., in a development environment), the CLI will:
- Display an error message
- Suggest the issue might be a development environment
- Continue without crashing

## Next Steps After Setup

After running `npx ytbot --docker`, users should:

1. Edit `.env` file with their Telegram bot token and allowed user IDs
2. Run `docker-compose up -d` to start the container
3. View logs with `docker-compose logs -f`

## Related Documentation

- [Docker Flag Implementation](./docker-flag-implementation.md)
- [Docker Flag Feature](./docker-flag-feature.md)
