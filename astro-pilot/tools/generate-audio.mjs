import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatAudioReport, parseAudioArguments, runAudioGeneration } from "./audio-generation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(root, "public");
const clips = JSON.parse(await readFile(path.join(root, "private/voice-scripts.json"), "utf8"));
const settings = JSON.parse(await readFile(path.join(root, "private/audio-settings.json"), "utf8"));
await loadLocalEnv(path.resolve(root, "..", ".env"));

try {
  const options = parseAudioArguments(process.argv.slice(2));
  const report = await runAudioGeneration({ clips, settings, options, publicRoot });
  const formatted = formatAudioReport(report, options.dryRun);
  formatted.output.forEach((line) => console.log(line));
  formatted.errors.forEach((line) => console.error(line));
  if (report.failed.length) process.exitCode = 1;
} catch (error) {
  console.error(`Audio generation failed: ${error.message}`);
  process.exitCode = 1;
}

async function loadLocalEnv(file) {
  try {
    const contents = await readFile(file, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!match || !match[2] || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  } catch {
    // A local .env is optional when only checking status or all files exist.
  }
}
