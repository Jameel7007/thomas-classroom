# ElevenLabs Voice Setup

The assessment audio uses ElevenLabs through the local lesson server. The API
key is never placed in the HTML or sent to the student's browser.

## Setup

1. Copy `.env.example` to `.env`.
2. Add an ElevenLabs API key with Text to Speech access.
3. Add the voice ID you want to use.
4. Start the site with:

   ```bash
   node server.mjs
   ```

5. Open:

   `http://localhost:8090/assessments/a0-exit.html?v=elevenlabs-1`

The first play generates an MP3 and uses ElevenLabs credits. Later plays use
the private `.audio-cache` copy and do not regenerate the same clip.

For conversations, add named voices such as `ELEVENLABS_VOICE_TEACHER` and
`ELEVENLABS_VOICE_STUDENT`. A script can select either voice with its `voice`
field. `ELEVENLABS_VOICE_ID` remains the default.

## Adding Lesson Audio

Add a named entry to `outputs/audio/voice-scripts.json`:

```json
{
  "lesson-clip-name": {
    "text": "The exact words the student should hear.",
    "language": "en",
    "speed": 0.9,
    "voice": "teacher"
  }
}
```

Then add the clip ID and a readable fallback text to the lesson button:

```html
<button
  class="listen-btn"
  type="button"
  data-voice-clip="lesson-clip-name"
  data-speak="The exact words the student should hear.">
  <span aria-hidden="true">▶</span> Play audio
</button>
```

Only scripts registered in `voice-scripts.json` can use the voice endpoint.
This prevents a public student page from generating arbitrary paid audio.
