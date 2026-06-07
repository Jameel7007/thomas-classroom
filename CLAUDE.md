# CLAUDE.md

@AGENTS.md

**Read [AGENTS.md](AGENTS.md) before making any changes.** It is the authoritative
working spec for this project — design direction, lesson method, drill rules,
assessment and placement rules, content standards, and the non-negotiables.
Follow it. If anything here and AGENTS.md ever conflict, AGENTS.md wins.

## Quick orientation

- **What this is:** a premium static web curriculum (CEFR A0 -> B2) for one-on-one
  English tutoring, shown live over screen share. The shipped site lives in
  [outputs/](outputs/); [work/](work/) holds the original design handoff bundle.
- **Run it:** `node server.mjs`, then open
  `http://localhost:8090/English%20Curriculum%20Map.html`. There is no build step
  and no `package.json` -- the map uses React + Babel from a CDN, transpiled in the
  browser. Don't open the HTML files directly; use the server.
- **Audio (optional):** copy `.env.example` to `.env` and add ElevenLabs keys. See
  [ELEVENLABS.md](ELEVENLABS.md). Never put an API key in HTML or browser JS.

## Before you start

- Keep user-facing deliverables in [outputs/](outputs/).
- Reuse shared lesson styles/scripts ([outputs/lessons/lesson.css](outputs/lessons/lesson.css),
  [outputs/lessons/lesson.js](outputs/lessons/lesson.js)) and the assessment engine
  ([outputs/assessments/assessment.js](outputs/assessments/assessment.js)); don't hardcode one-off drills.
- Match new lesson filenames to the slug helper in
  [outputs/components.jsx](outputs/components.jsx) so map links resolve.
- Preserve the current static implementation; don't migrate to Astro/MDX unless asked.

## After frontend changes

- Verify the page loads and check the browser console for errors.
- Test any changed interactions and confirm new lesson links resolve from the map.
- Keep the design calm and readable at screen-share distance.
