import { spawn } from "child_process";
import fs from "fs";
import path from "path";

/**
 * Test actual final MP3 file sizes by allowing full download
 */

const TEST_URL = "https://www.youtube.com/watch?v=6ornm2zEcXA";
const OUTPUT_DIR = "/tmp/ytBOT_media";

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

async function testActualMp3Size(audioBitrate) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🎵 TESTING ACTUAL MP3 SIZE AT ${audioBitrate}`);
  console.log("=".repeat(80));

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const outputTemplate = path.join(
    OUTPUT_DIR,
    `test-${audioBitrate}-%(title)s.%(ext)s`
  );
  const beforeFiles = fs.readdirSync(OUTPUT_DIR);

  // Download WITHOUT max-filesize limit to see actual final MP3 size
  const args = [
    "-x",
    "--audio-format",
    "mp3",
    "--audio-quality",
    audioBitrate,
    "--no-playlist",
    "--output",
    outputTemplate,
    "--print",
    "after_move:filepath",
    "--no-warnings",
    TEST_URL,
  ];

  try {
    const startTime = Date.now();
    const result = await executeYtDlp(args);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

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
      console.log(`📊 Final MP3 Size: ${fileSizeMB} MB`);
      console.log(`🎚️  Quality: ${audioBitrate}`);
      console.log(`⏱️  Duration: ${duration}s`);

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
    }
  } catch (error) {
    console.log(`\n❌ ERROR: ${error.message}`);
  }
}

async function runTests() {
  console.log("\n" + "=".repeat(80));
  console.log("🧪 TESTING ACTUAL MP3 FILE SIZES (NO LIMITS)");
  console.log("=".repeat(80));
  console.log(`📹 Video URL: ${TEST_URL}`);
  console.log("=".repeat(80));

  const results = [];

  // Test 64K and 48K to find the sweet spot
  for (const quality of ["64K", "48K"]) {
    const result = await testActualMp3Size(quality);
    if (result) {
      results.push(result);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("📊 FINAL MP3 SIZE COMPARISON");
  console.log("=".repeat(80));

  results.forEach((r) => {
    const underLimit = r.fileSizeMB < 50 ? "✅" : "❌";
    console.log(
      `${underLimit} ${r.quality}: ${r.fileSizeMB} MB (${r.duration}s download)`
    );
  });

  console.log("\n" + "=".repeat(80));
}

runTests()
  .then(() => {
    console.log("\n✅ Test completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  });
