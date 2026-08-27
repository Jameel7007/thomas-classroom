import { existsSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export function parseAudioArguments(args) {
  const parsed = { clips: [], regenerate: false, dryRun: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--regenerate") parsed.regenerate = true;
    else if (argument === "--dry-run") parsed.dryRun = true;
    else if (argument === "--clip") {
      const clipId = args[index + 1];
      if (!clipId || clipId.startsWith("--")) throw new Error("--clip requires a clip ID");
      parsed.clips.push(clipId);
      index += 1;
    } else if (argument.startsWith("--clip=")) {
      const clipId = argument.slice("--clip=".length);
      if (!clipId) throw new Error("--clip requires a clip ID");
      parsed.clips.push(clipId);
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }
  if (new Set(parsed.clips).size !== parsed.clips.length) {
    throw new Error("Each --clip value may be supplied only once");
  }
  return parsed;
}

export async function runAudioGeneration({
  clips,
  settings,
  options,
  publicRoot,
  environment = process.env,
  fetchImpl = globalThis.fetch,
}) {
  if (options.regenerate && options.clips.length === 0) {
    throw new Error("Use --regenerate together with --clip <clip-id> so regeneration is always explicit and targeted.");
  }

  const selectedIds = options.clips.length ? options.clips : Object.keys(clips);
  const report = { generated: [], skipped: [], failed: [], planned: [] };

  for (const clipId of selectedIds) {
    const clip = clips[clipId];
    if (!clip) {
      report.failed.push({ clipId, reason: "unknown clip ID" });
      continue;
    }

    let outputPath;
    try {
      outputPath = resolveAudioOutputPath(publicRoot, clip.path);
    } catch (error) {
      report.failed.push({ clipId, reason: error.message });
      continue;
    }

    const outputExists = existsSync(outputPath);
    if (outputExists && !options.regenerate) {
      report.skipped.push({ clipId, path: clip.path });
      continue;
    }

    if (options.dryRun) {
      report.planned.push({ clipId, path: clip.path, action: outputExists ? "regenerate" : "generate" });
      continue;
    }

    let temporaryPath;
    try {
      const audio = await requestAudio({ clipId, clip, settings, environment, fetchImpl });
      await mkdir(path.dirname(outputPath), { recursive: true });
      temporaryPath = `${outputPath}.tmp-${process.pid}-${Date.now()}`;
      await writeFile(temporaryPath, audio);
      await rename(temporaryPath, outputPath);
      report.generated.push({ clipId, path: clip.path });
    } catch (error) {
      if (temporaryPath) await rm(temporaryPath, { force: true }).catch(() => {});
      report.failed.push({ clipId, reason: error.message });
    }
  }

  return report;
}

export function resolveAudioOutputPath(publicRoot, relativePath) {
  if (typeof relativePath !== "string" || !/^audio\/(?:lessons|assessments)\/[a-z0-9][a-z0-9/-]*\.mp3$/.test(relativePath)) {
    throw new Error("path must be a stable MP3 location below audio/lessons or audio/assessments");
  }
  const root = path.resolve(publicRoot);
  const outputPath = path.resolve(root, relativePath);
  if (!outputPath.startsWith(`${root}${path.sep}`)) throw new Error("audio path escapes the public directory");
  return outputPath;
}

export function formatAudioReport(report, dryRun) {
  const output = [];
  const errors = [];
  for (const item of report.generated) output.push(`GENERATED ${item.clipId} -> public/${item.path}`);
  for (const item of report.skipped) output.push(`SKIPPED   ${item.clipId} -> public/${item.path}`);
  for (const item of report.planned) output.push(`${item.action.toUpperCase().padEnd(9)} ${item.clipId} -> public/${item.path}`);
  for (const item of report.failed) errors.push(`FAILED    ${item.clipId}: ${item.reason}`);
  output.push(`Audio ${dryRun ? "dry-run" : "generation"} summary: ${report.generated.length} generated, ${report.skipped.length} skipped, ${report.planned.length} planned, ${report.failed.length} failed.`);
  return { output, errors };
}

export function hasMp3Signature(value) {
  const bytes = Buffer.from(value);
  return bytes.subarray(0, 3).toString("ascii") === "ID3"
    || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
}

async function requestAudio({ clipId, clip, settings, environment, fetchImpl }) {
  const apiKey = environment.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set in the local authoring environment");
  if (typeof fetchImpl !== "function") throw new Error("No fetch implementation is available for authoring");

  const voiceName = clip.voice || settings.defaultVoice;
  const voiceConfig = settings.voices?.[voiceName];
  if (!voiceConfig) throw new Error(`voice "${voiceName}" is not configured in private/audio-settings.json`);
  const voiceId = environment[voiceConfig.environmentVariable]
    || environment[voiceConfig.fallbackEnvironmentVariable];
  if (!voiceId) {
    throw new Error(`${voiceConfig.environmentVariable} or ${voiceConfig.fallbackEnvironmentVariable} is not set locally`);
  }

  const voiceSettings = {
    ...settings.voiceSettings,
    ...(clip.speed ? { speed: Number(clip.speed) } : {}),
  };
  const endpoint = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`);
  endpoint.searchParams.set("output_format", settings.outputFormat);
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text: clip.text,
      model_id: settings.modelId,
      language_code: clip.language || "en",
      voice_settings: voiceSettings,
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).replace(/\s+/g, " ").slice(0, 240);
    throw new Error(`ElevenLabs returned ${response.status}${detail ? `: ${detail}` : ""}`);
  }

  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.length < 1000) throw new Error(`ElevenLabs returned an unexpectedly small file for ${clipId}`);
  if (!hasMp3Signature(audio)) throw new Error(`ElevenLabs returned data without an MP3 signature for ${clipId}`);
  return audio;
}
