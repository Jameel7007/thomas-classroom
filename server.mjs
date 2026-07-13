import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile, mkdir, stat, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const legacyOutputRoot = resolve(projectRoot, "outputs");
const astroOutputRoot = resolve(projectRoot, "astro-pilot", "dist");
const publicRoot = process.env.STATIC_ROOT
  ? resolve(projectRoot, process.env.STATIC_ROOT)
  : await directoryExists(astroOutputRoot) ? astroOutputRoot : legacyOutputRoot;
const cacheRoot = resolve(projectRoot, ".audio-cache");
const clipsPath = resolve(legacyOutputRoot, "audio", "voice-scripts.json");

await loadLocalEnv(resolve(projectRoot, ".env"));

const port = Number(process.env.PORT || 8090);
const host = process.env.HOST || "127.0.0.1";

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const recentRequests = new Map();

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

    if (url.pathname.startsWith("/api/voice/")) {
      if (request.method !== "GET") return sendJson(response, 405, { error: "Method not allowed." });
      return serveVoiceClip(request, response, decodeURIComponent(url.pathname.slice("/api/voice/".length)));
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return sendJson(response, 405, { error: "Method not allowed." });
    }

    return serveStatic(response, url.pathname, request.method === "HEAD");
  } catch (error) {
    console.error(error);
    return sendJson(response, 500, { error: "The local lesson server could not complete this request." });
  }
}).listen(port, host, () => {
  console.log(`Thomas's Classroom: http://localhost:${port}/`);
  console.log(`Curriculum map:     http://localhost:${port}/curriculum/`);
  console.log(`Static build:       ${publicRoot}`);
  const hasVoice = Object.keys(process.env).some((name) => name.startsWith("ELEVENLABS_VOICE_"));
  if (!process.env.ELEVENLABS_API_KEY || (!process.env.ELEVENLABS_VOICE_ID && !hasVoice)) {
    console.log("ElevenLabs is not configured yet. Add the API key and voice ID to .env.");
  }
});

async function serveVoiceClip(request, response, clipId) {
  if (!/^[a-z0-9-]{3,80}$/i.test(clipId)) {
    return sendJson(response, 400, { error: "Invalid voice clip." });
  }

  if (!allowRequest(request.socket.remoteAddress || "local")) {
    response.setHeader("Retry-After", "60");
    return sendJson(response, 429, { error: "Please wait before playing more audio." });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return sendJson(response, 503, {
      error: "ElevenLabs is not configured.",
      setup: "Add ELEVENLABS_API_KEY and at least one voice ID to .env.",
    });
  }

  const clips = JSON.parse(await readFile(clipsPath, "utf8"));
  const clip = clips[clipId];
  if (!clip || typeof clip.text !== "string") {
    return sendJson(response, 404, { error: "Unknown voice clip." });
  }

  const voiceName = String(clip.voice || "teacher").replace(/[^a-z0-9]+/gi, "_").toUpperCase();
  const voiceId = process.env[`ELEVENLABS_VOICE_${voiceName}`] || process.env.ELEVENLABS_VOICE_ID;
  if (!voiceId) {
    return sendJson(response, 503, {
      error: `The ElevenLabs voice "${clip.voice || "teacher"}" is not configured.`,
    });
  }

  const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
  const voiceSettings = {
    stability: Number(process.env.ELEVENLABS_STABILITY || 0.58),
    similarity_boost: Number(process.env.ELEVENLABS_SIMILARITY || 0.78),
    style: Number(process.env.ELEVENLABS_STYLE || 0.12),
    use_speaker_boost: true,
    speed: Number(clip.speed || process.env.ELEVENLABS_SPEED || 0.9),
  };
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ clipId, text: clip.text, voiceId, modelId, voiceSettings }))
    .digest("hex")
    .slice(0, 24);
  const cachePath = resolve(cacheRoot, `${clipId}-${fingerprint}.mp3`);

  try {
    const cachedAudio = await readFile(cachePath);
    return sendAudio(response, cachedAudio, "HIT");
  } catch {
    // Generate the clip once, then keep the MP3 for future students.
  }

  const elevenResponse = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: clip.text,
        model_id: modelId,
        language_code: clip.language || "en",
        voice_settings: voiceSettings,
      }),
    },
  );

  if (!elevenResponse.ok) {
    const detail = (await elevenResponse.text()).slice(0, 500);
    console.error(`ElevenLabs ${elevenResponse.status}: ${detail}`);
    return sendJson(response, 502, { error: "ElevenLabs could not generate this clip." });
  }

  const audio = Buffer.from(await elevenResponse.arrayBuffer());
  await mkdir(cacheRoot, { recursive: true });
  await writeFile(cachePath, audio);
  return sendAudio(response, audio, "MISS");
}

async function serveStatic(response, pathname, headOnly) {
  let relativePath = decodeURIComponent(pathname).replace(/^\/+/, "");
  if (!relativePath) relativePath = "index.html";

  let filePath = resolve(publicRoot, relativePath);
  if (filePath !== publicRoot && !filePath.startsWith(publicRoot + sep)) {
    return sendJson(response, 403, { error: "Forbidden." });
  }

  try {
    const fileInfo = await stat(filePath);
    if (fileInfo.isDirectory()) filePath = resolve(filePath, "index.html");
    const content = await readFile(filePath);
    const immutable = pathname.startsWith("/_astro/") || pathname.startsWith("/legacy-assets/");
    response.writeHead(200, {
      "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
      "Content-Type": mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
    });
    return response.end(headOnly ? undefined : content);
  } catch {
    return sendJson(response, 404, { error: "File not found." });
  }
}

async function directoryExists(directory) {
  try {
    return (await stat(directory)).isDirectory();
  } catch {
    return false;
  }
}

function sendAudio(response, audio, cacheStatus) {
  response.writeHead(200, {
    "Cache-Control": "private, max-age=3600",
    "Content-Length": audio.length,
    "Content-Type": "audio/mpeg",
    "X-Audio-Cache": cacheStatus,
  });
  response.end(audio);
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

function allowRequest(address) {
  const now = Date.now();
  const active = (recentRequests.get(address) || []).filter((time) => now - time < 60_000);
  if (active.length >= 30) return false;
  active.push(now);
  recentRequests.set(address, active);
  return true;
}

async function loadLocalEnv(path) {
  try {
    const contents = await readFile(path, "utf8");
    contents.split(/\r?\n/).forEach((line) => {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match || match[2] === "") return;
      const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
      if (!process.env[match[1]]) process.env[match[1]] = value;
    });
  } catch {
    // .env is optional until ElevenLabs is configured.
  }
}
