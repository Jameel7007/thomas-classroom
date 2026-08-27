import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hasMp3Signature } from "./audio-generation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireFiles = process.argv.includes("--require-files");
const clips = JSON.parse(readFileSync(path.join(root, "private/voice-scripts.json"), "utf8"));
const settings = JSON.parse(readFileSync(path.join(root, "private/audio-settings.json"), "utf8"));
const errors = [];
const warnings = [];
const paths = new Map();
const audioControlSource = readFileSync(path.join(root, "src/components/assessment/AudioControl.astro"), "utf8");
if (!/<audio\b[\s\S]*?\bsrc=\{src\}/.test(audioControlSource)) {
  errors.push("src/components/assessment/AudioControl.astro: native audio controls must render the static src without waiting for JavaScript");
}

for (const [clipId, clip] of Object.entries(clips)) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clipId)) errors.push(`${clipId}: clip ID is not stable kebab-case`);
  if (typeof clip.text !== "string" || !clip.text.trim()) errors.push(`${clipId}: text is missing`);
  if (!/^audio\/(?:lessons|assessments)\/[a-z0-9][a-z0-9/-]*\.mp3$/.test(clip.path || "")) {
    errors.push(`${clipId}: path must be below audio/lessons or audio/assessments and end in .mp3`);
    continue;
  }
  if (paths.has(clip.path)) errors.push(`${clipId}: output path duplicates ${paths.get(clip.path)}`);
  paths.set(clip.path, clipId);
  if (!settings.voices?.[clip.voice || settings.defaultVoice]) errors.push(`${clipId}: configured voice is unknown`);

  const output = path.join(root, "public", clip.path);
  if (!existsSync(output)) {
    const message = `${clipId}: static MP3 is pending at public/${clip.path}`;
    if (requireFiles) errors.push(message);
    else warnings.push(message);
  } else if (statSync(output).size < 1000) {
    errors.push(`${clipId}: generated MP3 is unexpectedly small`);
  } else if (!hasMp3Signature(readFileSync(output))) {
    errors.push(`${clipId}: generated file does not contain an MP3 signature`);
  }
}

for (const file of walk(path.join(root, "src/content/assessments")).filter((entry) => entry.endsWith(".astro"))) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/<AudioControl\b([^>]*)\/>/g)) {
    const attributes = Object.fromEntries([...match[1].matchAll(/\b(clip|src|text)="([^"]*)"/g)].map((item) => [item[1], item[2]]));
    const clip = clips[attributes.clip];
    const relative = path.relative(root, file);
    if (!clip) {
      errors.push(`${relative}: unknown AudioControl clip ${attributes.clip || "(missing)"}`);
      continue;
    }
    if (attributes.src !== `/${clip.path}`) errors.push(`${relative}: ${attributes.clip} source does not match private/voice-scripts.json`);
    if (attributes.text !== clip.text) errors.push(`${relative}: ${attributes.clip} fallback text does not match the approved script`);
  }
}

for (const target of [path.join(root, "src"), path.join(root, "public"), path.join(root, "astro.config.mjs")]) {
  const files = statSync(target).isDirectory() ? walk(target) : [target];
  for (const file of files.filter((entry) => /\.(?:astro|css|html|js|mjs|json|ts)$/.test(entry))) {
    const source = readFileSync(file, "utf8");
    if (/\/api\/voice|xi-api-key|ELEVENLABS_API_KEY/.test(source)) {
      errors.push(`${path.relative(root, file)}: runtime voice API or secret-key reference remains in public website code`);
    }
  }
}

if (errors.length) {
  console.error(`Static audio validation failed:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

if (warnings.length) {
  console.warn(`Static audio is configured; ${warnings.length} MP3 file(s) are still pending generation.`);
  warnings.forEach((warning) => console.warn(`- ${warning}`));
}
console.log(`Static audio verified: ${Object.keys(clips).length} stable clips, authoring-only generation, no browser voice API, and speech fallback text for every clip.`);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : target;
  });
}
