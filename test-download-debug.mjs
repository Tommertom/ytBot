/**
 * Debug script to test YouTube download directly
 * Tests the specific URL that's failing: https://www.youtube.com/watch?v=6ornm2zEcXA
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEST_URL = "https://www.youtube.com/watch?v=6ornm2zEcXA";
const OUTPUT_DIR = "/tmp/ytBOT_media";
const MAX_FILE_SIZE_MB = 50;

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`Created output directory: ${OUTPUT_DIR}`);
}

/**
 * Execute yt-dlp command and return output
 */
function executeYtDlp(args) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    console.log(`\n[DEBUG] Executing: yt-dlp ${args.join(" ")}\n`);

    const process = spawn("yt-dlp", args);

    process.stdout.on("data", (data) => {
      const output = data.toString();
      stdout += output;
      console.log("[STDOUT]", output);
    });

    process.stderr.on("data", (data) => {
      const output = data.toString();
      stderr += output;
      console.error("[STDERR]", output);
    });

    process.on("close", (code) => {
      resolve({ stdout, stderr, code: code || 0 });
    });

    process.on("error", (error) => {
      reject(error);
    });
  });
}

/**
 * Test 1: Check yt-dlp version
 */
async function testYtDlpVersion() {
  console.log("\n=== TEST 1: Check yt-dlp version ===");
  try {
    const result = await executeYtDlp(["--version"]);
    console.log(`✓ yt-dlp version: ${result.stdout.trim()}`);
    return true;
  } catch (error) {
    console.error("✗ yt-dlp not found or error:", error);
    return false;
  }
}

/**
 * Test 2: Get video info
 */
async function testGetVideoInfo() {
  console.log("\n=== TEST 2: Get video information ===");
  try {
    const args = ["--dump-json", "--no-playlist", TEST_URL];

    const result = await executeYtDlp(args);

    if (result.code === 0) {
      const info = JSON.parse(result.stdout);
      console.log("✓ Video info retrieved:");
      console.log(`  Title: ${info.title}`);
      console.log(
        `  Duration: ${info.duration} seconds (${(info.duration / 60).toFixed(
          2
        )} minutes)`
      );
      console.log(`  Uploader: ${info.uploader}`);
      console.log(`  View count: ${info.view_count}`);

      if (info.filesize) {
        console.log(
          `  File size: ${(info.filesize / 1024 / 1024).toFixed(2)} MB`
        );
      } else if (info.filesize_approx) {
        console.log(
          `  Approx file size: ${(info.filesize_approx / 1024 / 1024).toFixed(
            2
          )} MB`
        );
      }

      return true;
    } else {
      console.error("✗ Failed to get video info");
      return false;
    }
  } catch (error) {
    console.error("✗ Error getting video info:", error);
    return false;
  }
}

/**
 * Test 3: Download with verbose output
 */
async function testDownloadVerbose() {
  console.log("\n=== TEST 3: Download with verbose output ===");
  const outputTemplate = path.join(
    OUTPUT_DIR,
    "test-verbose-%(title)s.%(ext)s"
  );

  const args = [
    "-x", // Extract audio
    "--audio-format",
    "mp3",
    "--audio-quality",
    "0", // Best quality
    "--no-playlist",
    "--output",
    outputTemplate,
    "--max-filesize",
    `${MAX_FILE_SIZE_MB}M`,
    "--print",
    "after_move:filepath",
    "--verbose",
    TEST_URL,
  ];

  try {
    const startTime = Date.now();
    const result = await executeYtDlp(args);
    const duration = Date.now() - startTime;

    console.log(`\n[DEBUG] Download completed in ${duration}ms`);
    console.log(`[DEBUG] Exit code: ${result.code}`);
    console.log(`[DEBUG] Full stdout:\n${result.stdout}`);

    if (result.code === 0) {
      console.log("✓ Download command completed successfully");

      // Parse output for file path
      const lines = result.stdout.trim().split("\n");
      let foundFile = null;

      for (const line of lines) {
        const trimmedLine = line.trim();
        console.log(`[DEBUG] Checking line: ${trimmedLine}`);

        if (
          trimmedLine &&
          fs.existsSync(trimmedLine) &&
          trimmedLine.endsWith(".mp3")
        ) {
          foundFile = trimmedLine;
          console.log(`✓ Found file from output: ${foundFile}`);
          break;
        }
      }

      if (foundFile) {
        const stats = fs.statSync(foundFile);
        console.log(`✓ File exists: ${foundFile}`);
        console.log(`✓ File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        return true;
      } else {
        console.log("✗ Could not find file path in output");
        return false;
      }
    } else {
      console.error("✗ Download failed with exit code:", result.code);
      return false;
    }
  } catch (error) {
    console.error("✗ Download error:", error);
    return false;
  }
}

/**
 * Test 4: List files in output directory
 */
async function listOutputDirectory() {
  console.log("\n=== TEST 4: List output directory ===");
  try {
    const files = fs.readdirSync(OUTPUT_DIR);
    console.log(`Files in ${OUTPUT_DIR}:`);

    if (files.length === 0) {
      console.log("  (empty)");
    } else {
      files.forEach((file) => {
        const filePath = path.join(OUTPUT_DIR, file);
        const stats = fs.statSync(filePath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        const age = Date.now() - stats.mtimeMs;
        const ageSeconds = (age / 1000).toFixed(1);

        console.log(`  - ${file}`);
        console.log(`    Size: ${sizeMB} MB`);
        console.log(`    Age: ${ageSeconds}s`);
        console.log(`    Modified: ${stats.mtime.toISOString()}`);
      });
    }

    return true;
  } catch (error) {
    console.error("✗ Error listing directory:", error);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log("=".repeat(60));
  console.log("YouTube Download Debug Script");
  console.log("=".repeat(60));
  console.log(`Test URL: ${TEST_URL}`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log(`Max file size: ${MAX_FILE_SIZE_MB} MB`);
  console.log("=".repeat(60));

  const results = {
    version: await testYtDlpVersion(),
    info: await testGetVideoInfo(),
    listDir1: await listOutputDirectory(),
    download: await testDownloadVerbose(),
    listDir2: await listOutputDirectory(),
  };

  console.log("\n=== TEST SUMMARY ===");
  console.log(`yt-dlp version check: ${results.version ? "✓" : "✗"}`);
  console.log(`Video info retrieval: ${results.info ? "✓" : "✗"}`);
  console.log(`Download with size limit: ${results.download ? "✓" : "✗"}`);

  const allPassed = Object.values(results).every((r) => r === true);

  if (allPassed) {
    console.log("\n✓ All tests passed!");
    process.exit(0);
  } else {
    console.log("\n✗ Some tests failed. Check output above for details.");
    process.exit(1);
  }
}

// Run the tests
runTests().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
