# Build System Documentation

## Overview

ytBOT uses **esbuild** for fast, efficient bundling and minification of TypeScript code. This replaces the previous TypeScript-only compilation approach.

## Build Scripts

### Production Build (Minified)
```bash
npm run build:prod
```
- **Minifies** code for reduced file size
- **Bundles** all dependencies
- **Disables** source maps
- **Output:** Production-ready `dist/` folder

### Development Build (Unminified)
```bash
npm run build
```
- **No minification** for easier debugging
- **Bundles** all dependencies
- **Includes** source maps
- **Output:** Development `dist/` folder

### Legacy TypeScript Build
```bash
npm run build:tsc
```
- Uses TypeScript compiler directly (no bundling)
- Kept for compatibility/debugging purposes

## Configuration

Build configuration is located in `esbuild.config.js`:

```javascript
const isProd = process.env.NODE_ENV === 'production';

const commonOptions = {
    bundle: true,           // Bundle dependencies
    platform: 'node',       // Target Node.js
    target: 'node18',       // ES2020+ features
    format: 'esm',          // ES modules
    sourcemap: !isProd,     // Source maps in dev only
    minify: isProd,         // Minify in production
    treeShaking: true,      // Remove dead code
    external: [             // Don't bundle these
        'node-pty',
        'puppeteer',
        '@google/genai',
        // ... other native modules
    ]
};
```

## External Dependencies

The following packages are **NOT bundled** because they:
- Contain native binary modules (e.g., `node-pty`, `puppeteer`)
- Have runtime dependencies
- Work better when installed separately

These will still be installed via `npm install` from `package.json`.

## Build Outputs

### Entry Points
1. **`src/cli.ts`** → **`dist/cli.js`**
   - CLI entry point (has shebang `#!/usr/bin/env node`)
   - Used when running `npx ytbot`

2. **`src/app.ts`** → **`dist/app.js`**
   - Main application
   - Spawned by CLI

### File Sizes (Production)
- `cli.js`: ~10KB (minified)
- `app.js`: ~436KB (bundled with dependencies)

## Benefits of esbuild

### Speed
- ⚡ **100x faster** than TypeScript compiler
- Typical build time: < 1 second

### Size Reduction
- 📦 **Minified code** reduces file size by ~40-60%
- **Tree-shaking** removes unused code
- **Dead code elimination** during bundling

### Developer Experience
- 🔍 Source maps in development mode
- 🚀 Fast iteration cycles
- 💪 TypeScript support built-in

## Publishing Workflow

When you run `npm run doPublish`:
1. Builds with **production settings** (minified)
2. Increments version in `package.json`
3. Publishes to npm registry

Users who install via `npm install @tommertom/ytbot` get:
- Minified, optimized code
- Smaller download size
- Faster startup time

## Troubleshooting

### "Module not found" errors
If you see module errors after building, check that the module is:
1. Listed in `package.json` dependencies
2. Added to the `external` array in `esbuild.config.js` if it's a native module

### Source maps not working
Ensure you're running the **development build**:
```bash
npm run build
```

### Build fails
1. Check TypeScript errors first: `npx tsc --noEmit`
2. Check the esbuild configuration in `esbuild.config.js`
3. Ensure all dependencies are installed: `npm install`

## Comparison: Before vs After

### Before (TypeScript only)
```bash
npm run build     # tsc --outDir dist
```
- ❌ No minification
- ❌ No bundling
- ❌ Slower builds
- ✅ Simple setup

### After (esbuild)
```bash
npm run build:prod    # NODE_ENV=production node esbuild.config.js
```
- ✅ Minified code
- ✅ Bundled dependencies
- ✅ Fast builds (~1s)
- ✅ Optimized output
- ✅ Production-ready

## Future Improvements

Potential enhancements:
- Code splitting for faster cold starts
- Differential bundling (CommonJS + ESM)
- Watch mode for auto-rebuild during development
- Bundle analysis tools
