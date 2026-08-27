# Static ElevenLabs audio authoring

ElevenLabs is an authoring tool for Thomas’s Classroom, not a production
dependency. Students play ordinary static MP3 files from `astro-pilot/public/audio/`.
No lesson page, browser script, production server, or public environment variable
calls ElevenLabs.

Each generated page places the static path directly on a native `<audio src>`
control, so recorded playback does not depend on JavaScript. JavaScript only
coordinates active playback and reveals the optional browser-voice fallback
when the MP3 is missing.

If a configured MP3 is missing, the shared assessment control reveals browser
speech synthesis as an optional fallback. This keeps a local draft teachable,
but every production build requires all configured MP3 files to exist.

## One-time local setup

1. Copy `.env.example` to `.env` at the repository root.
2. Add `ELEVENLABS_API_KEY` and either `ELEVENLABS_VOICE_ID` or the named
   `ELEVENLABS_VOICE_TEACHER` value.
3. Keep `.env` private. It is ignored by Git and is never needed by the
   production website.

Text, language, speed, voice alias, and stable output paths live in
`astro-pilot/private/voice-scripts.json`. Shared model, output-format, and voice
settings live in `astro-pilot/private/audio-settings.json`. Neither file contains
an API key.

## Generate audio

From `astro-pilot/`:

```bash
npm run audio:status
npm run audio:generate
```

`audio:status` shows missing or existing files without calling ElevenLabs.
`audio:generate` creates missing MP3s and skips every existing file.
The build also runs an offline authoring-workflow test with a simulated provider
response. It verifies dry runs, skips, request settings, safe targeted
regeneration, MP3 signatures, error reporting, stable paths, and preservation
of an existing recording when regeneration fails.

To deliberately replace one recording:

```bash
npm run audio:generate -- --clip a1-routine-message --regenerate
```

Regeneration must name at least one clip. Each run reports generated, skipped,
planned, and failed clips. A failed run exits unsuccessfully without printing the
API key.

## Add audio to a lesson

1. Choose a stable kebab-case clip ID.
2. Add one record to `private/voice-scripts.json`:

   ```json
   {
     "b1-meeting-opening": {
       "text": "Thanks for joining. Let’s begin with the project update.",
       "path": "audio/lessons/b1/meetings/meeting-opening.mp3",
       "language": "en",
       "speed": 0.94,
       "voice": "teacher"
     }
   }
   ```

3. Import and render the shared control in the lesson or assessment:

   ```astro
   ---
   import AudioControl from "../../../components/assessment/AudioControl.astro";
   ---
   <AudioControl
     clip="b1-meeting-opening"
     src="/audio/lessons/b1/meetings/meeting-opening.mp3"
     text="Thanks for joining. Let’s begin with the project update."
     label="Play the meeting opening"
   />
   ```

4. Generate the new clip:

   ```bash
   npm run audio:generate -- --clip b1-meeting-opening
   ```

5. Run `npm run build`, listen to the complete clip, and commit the MP3 with the
   source change.

The source path and fallback text must match the approved record exactly; build
validation rejects mismatches, duplicate paths, runtime API calls, and secret-key
references in public website code. It also rejects generated audio controls that
omit the native static `src` and would therefore depend on JavaScript for normal
playback, plus files that are large enough to exist but do not contain an MP3
signature.
