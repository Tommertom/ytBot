import { spawn } from "child_process";
import fs from "fs";
import path from "path";

/**
 * Test the quality fallback chain with the problematic 95-minute concert video
 */

const TEST_URL = "https://www.youtube.com/watch?v=6ornm2zEcXA";
const OUTPUT_DIR = "/tmp/ytBOT_media";
const MAX_FILESIZE = 50; // MB

// Quality fallback chain
const QUALITY_CHAIN = ["0", "192K", "128K", "96K", "64K"];

async function executeYtDlp(args) {
  return new Promise((resolve, reject) => {
    console.log(`\n🔧 Running: yt-dlp ${args.join(" ")}`);

    const ytDlp = spawn("yt-dlp", args);
    let stdout = "";
    let stderr = "";

    ytDlp.stdout.on("data", (data) => {
      const output = data.toString();
      stdout += output;
      process.stdout.write(output);
    });

    ytDlp.stderr.on("data", (data) => {
      const output = data.toString();
      stderr += output;
      process.stderr.write(output);
    });

    ytDlp.on("close", (code) => {
      console.log(`\nyt-dlp exited with code: ${code}`);
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject(new Error(`yt-dlp failed with code ${code}`));
      }
    });
  });
}

async function attemptDownload(audioBitrate) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🎵 ATTEMPTING DOWNLOAD WITH BITRATE: ${audioBitrate}`);
  console.log("=".repeat(80));

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const outputTemplate = path.join(OUTPUT_DIR, "%(title)s.%(ext)s");
  const beforeFiles = fs.readdirSync(OUTPUT_DIR);

  const args = [
    "-x",
    "--audio-format",
    "mp3",
    "--audio-quality",
    audioBitrate,
    "--no-playlist",
    "--output",
    outputTemplate,
    "--max-filesize",
    `${MAX_FILESIZE}M`,
    "--print",
    "after_move:filepath",
    "--no-warnings",
    TEST_URL,
  ];

  try {
    const startTime = Date.now();
    const result = await executeYtDlp(args);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n⏱️  Download Duration: ${duration}s`);

    // Check for output file
    const afterFiles = fs.readdirSync(OUTPUT_DIR);
    const newFiles = afterFiles.filter(
      (f) => !beforeFiles.includes(f) && f.endsWith(".mp3")
    );

    if (newFiles.length > 0) {
      const filePath = path.join(OUTPUT_DIR, newFiles[0]);
      const stats = fs.statSync(filePath);
      const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);

      console.log(`\n✅ SUCCESS!`);
      console.log(`📁 File: ${newFiles[0]}`);
      console.log(`📊 Size: ${fileSizeMB} MB`);
      console.log(`🎚️  Quality: ${audioBitrate}`);

      // Clean up
      fs.unlinkSync(filePath);
      console.log(`🗑️  Cleaned up test file`);

      return {
        success: true,
        fileName: newFiles[0],
        fileSize: stats.size,
        fileSizeMB: parseFloat(fileSizeMB),
        quality: audioBitrate,
        duration,
      };
    } else {
      console.log(`\n❌ FAILED: No MP3 file found`);

      // Check for partial files
      const partFiles = afterFiles.filter((f) => f.includes(".part"));
      if (partFiles.length > 0) {
        console.log(`\n⚠️  Found partial files (download aborted):`);
        partFiles.forEach((f) => {
          const partPath = path.join(OUTPUT_DIR, f);
          const stats = fs.statSync(partPath);
          const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
          console.log(`   - ${f} (${sizeMB} MB)`);
          // Clean up partial files
          fs.unlinkSync(partPath);
        });
      }

      return {
        success: false,
        quality: audioBitrate,
        error: "File too large",
        duration,
      };
    }
  } catch (error) {
    console.log(`\n❌ ERROR: ${error.message}`);

    // Clean up any partial files
    const afterFiles = fs.readdirSync(OUTPUT_DIR);
    const partFiles = afterFiles.filter((f) => f.includes(".part"));
    if (partFiles.length > 0) {
      console.log(`\n🗑️  Cleaning up partial files...`);
      partFiles.forEach((f) => {
        const partPath = path.join(OUTPUT_DIR, f);
        fs.unlinkSync(partPath);
        console.log(`   - Deleted ${f}`);
      });
    }

    return {
      success: false,
      quality: audioBitrate,
      error: error.message,
      duration: 0,
    };
  }
}

async function testQualityFallbackChain() {
  console.log("\n" + "=".repeat(80));
  console.log("🧪 TESTING QUALITY FALLBACK CHAIN");
  console.log("=".repeat(80));
  console.log(`📹 Video URL: ${TEST_URL}`);
  console.log(`📏 Max File Size: ${MAX_FILESIZE} MB`);
  console.log(`🎚️  Quality Chain: ${QUALITY_CHAIN.join(" → ")}`);
  console.log("=".repeat(80));

  const results = [];

  for (const quality of QUALITY_CHAIN) {
    console.log(`\n⏩ Simulating callback: "⚠️ Trying quality ${quality}..."`);
    const result = await attemptDownload(quality);
    results.push(result);

    if (result.success) {
      console.log(
        `\n✅ SUCCESS at quality ${quality}! Stopping fallback chain.`
      );
      break;
    } else {
      console.log(`\n⚠️ Failed at quality ${quality}. Trying next quality...`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("📊 SUMMARY");
  console.log("=".repeat(80));

  results.forEach((r, idx) => {
    console.log(`\n${idx + 1}. Quality: ${r.quality}`);
    console.log(`   Status: ${r.success ? "✅ SUCCESS" : "❌ FAILED"}`);
    if (r.success) {
      console.log(`   File: ${r.fileName}`);
      console.log(`   Size: ${r.fileSizeMB} MB`);
      console.log(`   Duration: ${r.duration}s`);
    } else {
      console.log(`   Error: ${r.error}`);
    }
  });

  const successResult = results.find((r) => r.success);
  if (successResult) {
    console.log(
      `\n🎉 Final Result: SUCCESS at ${successResult.quality} quality (${successResult.fileSizeMB} MB)`
    );
  } else {
    console.log(`\n❌ Final Result: ALL qualities failed`);
  }

  console.log("\n" + "=".repeat(80));
}

// Run the test
console.log("Starting quality fallback chain test...\n");
testQualityFallbackChain()
  .then(() => {
    console.log("\n✅ Test completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  });
