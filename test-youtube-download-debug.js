"use strict";
/**
 * Debug script to test YouTube download directly
 * Tests the specific URL that's failing: https://www.youtube.com/watch?v=6ornm2zEcXA
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var child_process_1 = require("child_process");
var fs = require("fs");
var path = require("path");
var TEST_URL = 'https://www.youtube.com/watch?v=6ornm2zEcXA';
var OUTPUT_DIR = '/tmp/ytBOT_media';
var MAX_FILE_SIZE_MB = 50;
// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log("Created output directory: ".concat(OUTPUT_DIR));
}
/**
 * Execute yt-dlp command and return output
 */
function executeYtDlp(args) {
    return new Promise(function (resolve, reject) {
        var stdout = '';
        var stderr = '';
        console.log("\n[DEBUG] Executing: yt-dlp ".concat(args.join(' '), "\n"));
        var process = (0, child_process_1.spawn)('yt-dlp', args);
        process.stdout.on('data', function (data) {
            var output = data.toString();
            stdout += output;
            console.log('[STDOUT]', output);
        });
        process.stderr.on('data', function (data) {
            var output = data.toString();
            stderr += output;
            console.error('[STDERR]', output);
        });
        process.on('close', function (code) {
            resolve({ stdout: stdout, stderr: stderr, code: code || 0 });
        });
        process.on('error', function (error) {
            reject(error);
        });
    });
}
/**
 * Test 1: Check yt-dlp version
 */
function testYtDlpVersion() {
    return __awaiter(this, void 0, void 0, function () {
        var result, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('\n=== TEST 1: Check yt-dlp version ===');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, executeYtDlp(['--version'])];
                case 2:
                    result = _a.sent();
                    console.log("\u2713 yt-dlp version: ".concat(result.stdout.trim()));
                    return [2 /*return*/, true];
                case 3:
                    error_1 = _a.sent();
                    console.error('✗ yt-dlp not found or error:', error_1);
                    return [2 /*return*/, false];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Test 2: Get video info
 */
function testGetVideoInfo() {
    return __awaiter(this, void 0, void 0, function () {
        var args, result, info, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('\n=== TEST 2: Get video information ===');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    args = [
                        '--dump-json',
                        '--no-playlist',
                        TEST_URL
                    ];
                    return [4 /*yield*/, executeYtDlp(args)];
                case 2:
                    result = _a.sent();
                    if (result.code === 0) {
                        info = JSON.parse(result.stdout);
                        console.log('✓ Video info retrieved:');
                        console.log("  Title: ".concat(info.title));
                        console.log("  Duration: ".concat(info.duration, " seconds (").concat((info.duration / 60).toFixed(2), " minutes)"));
                        console.log("  Uploader: ".concat(info.uploader));
                        console.log("  View count: ".concat(info.view_count));
                        if (info.filesize) {
                            console.log("  File size: ".concat((info.filesize / 1024 / 1024).toFixed(2), " MB"));
                        }
                        else if (info.filesize_approx) {
                            console.log("  Approx file size: ".concat((info.filesize_approx / 1024 / 1024).toFixed(2), " MB"));
                        }
                        return [2 /*return*/, true];
                    }
                    else {
                        console.error('✗ Failed to get video info');
                        return [2 /*return*/, false];
                    }
                    return [3 /*break*/, 4];
                case 3:
                    error_2 = _a.sent();
                    console.error('✗ Error getting video info:', error_2);
                    return [2 /*return*/, false];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Test 3: Download with verbose output
 */
function testDownloadVerbose() {
    return __awaiter(this, void 0, void 0, function () {
        var outputTemplate, args, startTime, result, duration, lines, foundFile, _i, lines_1, line, trimmedLine, stats, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('\n=== TEST 3: Download with verbose output ===');
                    outputTemplate = path.join(OUTPUT_DIR, 'test-verbose-%(title)s.%(ext)s');
                    args = [
                        '-x', // Extract audio
                        '--audio-format', 'mp3',
                        '--audio-quality', '0', // Best quality
                        '--no-playlist',
                        '--output', outputTemplate,
                        '--max-filesize',
                        "".concat(MAX_FILE_SIZE_MB, "M"),
                        '--print', 'after_move:filepath',
                        '--verbose',
                        TEST_URL
                    ];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    startTime = Date.now();
                    return [4 /*yield*/, executeYtDlp(args)];
                case 2:
                    result = _a.sent();
                    duration = Date.now() - startTime;
                    console.log("\n[DEBUG] Download completed in ".concat(duration, "ms"));
                    console.log("[DEBUG] Exit code: ".concat(result.code));
                    console.log("[DEBUG] Full stdout:\n".concat(result.stdout));
                    if (result.code === 0) {
                        console.log('✓ Download command completed successfully');
                        lines = result.stdout.trim().split('\n');
                        foundFile = null;
                        for (_i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
                            line = lines_1[_i];
                            trimmedLine = line.trim();
                            console.log("[DEBUG] Checking line: ".concat(trimmedLine));
                            if (trimmedLine && fs.existsSync(trimmedLine) && trimmedLine.endsWith('.mp3')) {
                                foundFile = trimmedLine;
                                console.log("\u2713 Found file from output: ".concat(foundFile));
                                break;
                            }
                        }
                        if (foundFile) {
                            stats = fs.statSync(foundFile);
                            console.log("\u2713 File exists: ".concat(foundFile));
                            console.log("\u2713 File size: ".concat((stats.size / 1024 / 1024).toFixed(2), " MB"));
                            return [2 /*return*/, true];
                        }
                        else {
                            console.log('✗ Could not find file path in output');
                            return [2 /*return*/, false];
                        }
                    }
                    else {
                        console.error('✗ Download failed with exit code:', result.code);
                        return [2 /*return*/, false];
                    }
                    return [3 /*break*/, 4];
                case 3:
                    error_3 = _a.sent();
                    console.error('✗ Download error:', error_3);
                    return [2 /*return*/, false];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Test 4: List files in output directory
 */
function listOutputDirectory() {
    return __awaiter(this, void 0, void 0, function () {
        var files;
        return __generator(this, function (_a) {
            console.log('\n=== TEST 4: List output directory ===');
            try {
                files = fs.readdirSync(OUTPUT_DIR);
                console.log("Files in ".concat(OUTPUT_DIR, ":"));
                if (files.length === 0) {
                    console.log('  (empty)');
                }
                else {
                    files.forEach(function (file) {
                        var filePath = path.join(OUTPUT_DIR, file);
                        var stats = fs.statSync(filePath);
                        var sizeMB = (stats.size / 1024 / 1024).toFixed(2);
                        var age = Date.now() - stats.mtimeMs;
                        var ageSeconds = (age / 1000).toFixed(1);
                        console.log("  - ".concat(file));
                        console.log("    Size: ".concat(sizeMB, " MB"));
                        console.log("    Age: ".concat(ageSeconds, "s"));
                        console.log("    Modified: ".concat(stats.mtime.toISOString()));
                    });
                }
                return [2 /*return*/, true];
            }
            catch (error) {
                console.error('✗ Error listing directory:', error);
                return [2 /*return*/, false];
            }
            return [2 /*return*/];
        });
    });
}
/**
 * Test 5: Try download without max-filesize constraint
 */
function testDownloadNoSizeLimit() {
    return __awaiter(this, void 0, void 0, function () {
        var outputTemplate, args, startTime, result, duration, lines, _i, lines_2, line, trimmedLine, stats, sizeMB, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('\n=== TEST 5: Download without size limit (to see actual behavior) ===');
                    outputTemplate = path.join(OUTPUT_DIR, 'test-nosize-%(title)s.%(ext)s');
                    args = [
                        '-x',
                        '--audio-format', 'mp3',
                        '--audio-quality', '0',
                        '--no-playlist',
                        '--output', outputTemplate,
                        '--print', 'after_move:filepath',
                        TEST_URL
                    ];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    startTime = Date.now();
                    return [4 /*yield*/, executeYtDlp(args)];
                case 2:
                    result = _a.sent();
                    duration = Date.now() - startTime;
                    console.log("\n[DEBUG] Download completed in ".concat(duration, "ms"));
                    if (result.code === 0) {
                        console.log('✓ Download successful');
                        lines = result.stdout.trim().split('\n');
                        for (_i = 0, lines_2 = lines; _i < lines_2.length; _i++) {
                            line = lines_2[_i];
                            trimmedLine = line.trim();
                            if (trimmedLine && fs.existsSync(trimmedLine) && trimmedLine.endsWith('.mp3')) {
                                stats = fs.statSync(trimmedLine);
                                sizeMB = (stats.size / 1024 / 1024).toFixed(2);
                                console.log("\u2713 Downloaded file: ".concat(trimmedLine));
                                console.log("\u2713 Actual file size: ".concat(sizeMB, " MB"));
                                if (stats.size / 1024 / 1024 > MAX_FILE_SIZE_MB) {
                                    console.log("\u26A0\uFE0F  File exceeds ".concat(MAX_FILE_SIZE_MB, " MB limit"));
                                }
                                return [2 /*return*/, true];
                            }
                        }
                        console.log('✗ File not found in output');
                        return [2 /*return*/, false];
                    }
                    else {
                        console.error('✗ Download failed');
                        return [2 /*return*/, false];
                    }
                    return [3 /*break*/, 4];
                case 3:
                    error_4 = _a.sent();
                    console.error('✗ Download error:', error_4);
                    return [2 /*return*/, false];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Main test runner
 */
function runTests() {
    return __awaiter(this, void 0, void 0, function () {
        var results, allPassed;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('='.repeat(60));
                    console.log('YouTube Download Debug Script');
                    console.log('='.repeat(60));
                    console.log("Test URL: ".concat(TEST_URL));
                    console.log("Output directory: ".concat(OUTPUT_DIR));
                    console.log("Max file size: ".concat(MAX_FILE_SIZE_MB, " MB"));
                    console.log('='.repeat(60));
                    _a = {};
                    return [4 /*yield*/, testYtDlpVersion()];
                case 1:
                    _a.version = _b.sent();
                    return [4 /*yield*/, testGetVideoInfo()];
                case 2:
                    _a.info = _b.sent();
                    return [4 /*yield*/, testDownloadVerbose()];
                case 3:
                    _a.download = _b.sent();
                    return [4 /*yield*/, listOutputDirectory()];
                case 4:
                    _a.listDir = _b.sent();
                    return [4 /*yield*/, testDownloadNoSizeLimit()];
                case 5:
                    _a.noSizeLimit = _b.sent();
                    return [4 /*yield*/, listOutputDirectory()];
                case 6:
                    results = (_a.finalList = _b.sent(),
                        _a);
                    console.log('\n=== TEST SUMMARY ===');
                    console.log("yt-dlp version check: ".concat(results.version ? '✓' : '✗'));
                    console.log("Video info retrieval: ".concat(results.info ? '✓' : '✗'));
                    console.log("Download with size limit: ".concat(results.download ? '✓' : '✗'));
                    console.log("Download without size limit: ".concat(results.noSizeLimit ? '✓' : '✗'));
                    allPassed = Object.values(results).every(function (r) { return r === true; });
                    if (allPassed) {
                        console.log('\n✓ All tests passed!');
                        process.exit(0);
                    }
                    else {
                        console.log('\n✗ Some tests failed. Check output above for details.');
                        process.exit(1);
                    }
                    return [2 /*return*/];
            }
        });
    });
}
// Run the tests
runTests().catch(function (error) {
    console.error('Fatal error:', error);
    process.exit(1);
});
