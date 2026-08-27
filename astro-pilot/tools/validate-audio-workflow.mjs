import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  formatAudioReport,
  hasMp3Signature,
  parseAudioArguments,
  resolveAudioOutputPath,
  runAudioGeneration,
} from "./audio-generation.mjs";

const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "thomas-audio-workflow-"));
const publicRoot = path.join(temporaryRoot, "public");
const settings = {
  modelId: "test-model",
  outputFormat: "mp3_44100_128",
  defaultVoice: "teacher",
  voices: {
    teacher: {
      environmentVariable: "ELEVENLABS_VOICE_TEACHER",
      fallbackEnvironmentVariable: "ELEVENLABS_VOICE_ID",
    },
  },
  voiceSettings: {
    stability: 0.58,
    similarity_boost: 0.78,
    style: 0.12,
    use_speaker_boost: true,
    speed: 0.9,
  },
};
const clips = {
  "missing-clip": {
    text: "This clip is missing.",
    path: "audio/lessons/a1/workflow/missing-clip.mp3",
    language: "en",
    speed: 0.84,
    voice: "teacher",
  },
  "existing-clip": {
    text: "This clip already exists.",
    path: "audio/assessments/a1-exit/existing-clip.mp3",
    language: "en",
    voice: "teacher",
  },
};
const environment = {
  ELEVENLABS_API_KEY: "private-test-key",
  ELEVENLABS_VOICE_TEACHER: "teacher-voice-id",
};
const mp3Buffer = (size, fill) => {
  const value = Buffer.alloc(size, fill);
  value.set(Buffer.from("ID3"), 0);
  return value;
};

try {
  assert.deepEqual(parseAudioArguments(["--dry-run", "--clip", "missing-clip"]), {
    clips: ["missing-clip"],
    regenerate: false,
    dryRun: true,
  });
  assert.throws(() => parseAudioArguments(["--clip", "missing-clip", "--clip=missing-clip"]), /only once/);
  assert.throws(() => parseAudioArguments(["--unknown"]), /Unknown option/);
  assert.throws(
    () => resolveAudioOutputPath(publicRoot, "../outside.mp3"),
    /stable MP3 location/,
  );

  const existingPath = resolveAudioOutputPath(publicRoot, clips["existing-clip"].path);
  await mkdir(path.dirname(existingPath), { recursive: true });
  const originalAudio = mp3Buffer(1200, 11);
  await writeFile(existingPath, originalAudio);

  let fetchCalls = 0;
  const dryRun = await runAudioGeneration({
    clips,
    settings,
    options: parseAudioArguments(["--dry-run"]),
    publicRoot,
    environment: {},
    fetchImpl: () => {
      fetchCalls += 1;
      throw new Error("dry-run must not request audio");
    },
  });
  assert.equal(fetchCalls, 0);
  assert.deepEqual(dryRun.skipped.map((item) => item.clipId), ["existing-clip"]);
  assert.deepEqual(dryRun.planned, [{
    clipId: "missing-clip",
    path: clips["missing-clip"].path,
    action: "generate",
  }]);

  let capturedRequest;
  const generatedAudio = mp3Buffer(1400, 23);
  const generated = await runAudioGeneration({
    clips,
    settings,
    options: parseAudioArguments(["--clip", "missing-clip"]),
    publicRoot,
    environment,
    fetchImpl: async (url, request) => {
      fetchCalls += 1;
      capturedRequest = { url: String(url), request };
      return new Response(generatedAudio, { status: 200, headers: { "Content-Type": "audio/mpeg" } });
    },
  });
  assert.deepEqual(generated.generated.map((item) => item.clipId), ["missing-clip"]);
  assert.deepEqual(await readFile(resolveAudioOutputPath(publicRoot, clips["missing-clip"].path)), generatedAudio);
  assert.match(capturedRequest.url, /text-to-speech\/teacher-voice-id\?output_format=mp3_44100_128$/);
  assert.equal(capturedRequest.request.method, "POST");
  assert.equal(capturedRequest.request.headers["xi-api-key"], environment.ELEVENLABS_API_KEY);
  const requestBody = JSON.parse(capturedRequest.request.body);
  assert.equal(requestBody.text, clips["missing-clip"].text);
  assert.equal(requestBody.model_id, settings.modelId);
  assert.equal(requestBody.voice_settings.speed, clips["missing-clip"].speed);

  fetchCalls = 0;
  const skipped = await runAudioGeneration({
    clips,
    settings,
    options: parseAudioArguments(["--clip", "missing-clip"]),
    publicRoot,
    environment: {},
    fetchImpl: () => {
      fetchCalls += 1;
      throw new Error("existing clips must be skipped before credential checks");
    },
  });
  assert.equal(fetchCalls, 0);
  assert.deepEqual(skipped.skipped.map((item) => item.clipId), ["missing-clip"]);

  const replacementAudio = mp3Buffer(1500, 31);
  const regenerated = await runAudioGeneration({
    clips,
    settings,
    options: parseAudioArguments(["--clip=existing-clip", "--regenerate"]),
    publicRoot,
    environment,
    fetchImpl: async () => new Response(replacementAudio, { status: 200 }),
  });
  assert.deepEqual(regenerated.generated.map((item) => item.clipId), ["existing-clip"]);
  assert.deepEqual(await readFile(existingPath), replacementAudio);

  const beforeFailedRegeneration = await readFile(existingPath);
  const failed = await runAudioGeneration({
    clips,
    settings,
    options: parseAudioArguments(["--clip", "existing-clip", "--regenerate"]),
    publicRoot,
    environment,
    fetchImpl: async () => new Response("quota exceeded", { status: 429 }),
  });
  assert.equal(failed.failed.length, 1);
  assert.match(failed.failed[0].reason, /ElevenLabs returned 429: quota exceeded/);
  assert.deepEqual(await readFile(existingPath), beforeFailedRegeneration);

  const invalidPayload = await runAudioGeneration({
    clips,
    settings,
    options: parseAudioArguments(["--clip", "existing-clip", "--regenerate"]),
    publicRoot,
    environment,
    fetchImpl: async () => new Response(Buffer.alloc(1500, 44), { status: 200 }),
  });
  assert.equal(invalidPayload.failed.length, 1);
  assert.match(invalidPayload.failed[0].reason, /without an MP3 signature/);
  assert.deepEqual(await readFile(existingPath), beforeFailedRegeneration);
  assert.equal(hasMp3Signature(Buffer.from("ID3valid")), true);
  assert.equal(hasMp3Signature(Buffer.from([0xff, 0xfb, 0x90, 0x64])), true);
  assert.equal(hasMp3Signature(Buffer.from("not audio")), false);

  const unknown = await runAudioGeneration({
    clips,
    settings,
    options: parseAudioArguments(["--clip", "unknown-clip"]),
    publicRoot,
    environment,
    fetchImpl: async () => new Response(generatedAudio, { status: 200 }),
  });
  assert.deepEqual(unknown.failed, [{ clipId: "unknown-clip", reason: "unknown clip ID" }]);

  await assert.rejects(
    runAudioGeneration({
      clips,
      settings,
      options: parseAudioArguments(["--regenerate"]),
      publicRoot,
      environment,
      fetchImpl: async () => new Response(generatedAudio, { status: 200 }),
    }),
    /regeneration is always explicit and targeted/,
  );

  const formatted = formatAudioReport({
    generated: generated.generated,
    skipped: skipped.skipped,
    planned: dryRun.planned,
    failed: failed.failed,
  }, false);
  assert.match(formatted.output.at(-1), /1 generated, 1 skipped, 1 planned, 1 failed/);
  assert.equal(formatted.errors.length, 1);
  assert.ok(!formatted.output.join("\n").includes(environment.ELEVENLABS_API_KEY));
  assert.ok(!formatted.errors.join("\n").includes(environment.ELEVENLABS_API_KEY));

  console.log("Static-audio authoring workflow verified offline: argument safety, dry-run planning, existing-file skips, request configuration, MP3 signature checks, missing-file generation, targeted regeneration, failure reporting, atomic preservation, stable paths, and secret-safe reports.");
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
