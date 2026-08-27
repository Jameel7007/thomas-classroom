# Thomas’s Classroom deployment runbook

This runbook publishes the existing static Astro site to Cloudflare Pages and
then verifies the behavior of the real host. It does not add a server runtime,
database, analytics, or learner-time third-party requests.

## GitHub Pages preview deployment

Every push to `main` also builds a public project preview at
`https://jameel7007.github.io/thomas-classroom/` through
`.github/workflows/deploy-pages.yml`. The workflow runs the complete production
build, then `npm run pages:prepare` prefixes root-relative links and canonical
metadata for the `/thomas-classroom` project path before uploading `dist/`.
Local development and a future custom-domain deployment continue to use the
normal root-based routes.

The GitHub repository must have **Settings → Pages → Source** set to **GitHub
Actions**. GitHub Pages is a useful public preview, but it ignores Cloudflare's
`_headers` and `_redirects` files. The generated static redirect pages still
work, while host-level security headers and true HTTP redirect status codes are
verified only on the intended Cloudflare production deployment.

## 1. Complete the two owner inputs

1. Choose the final public HTTPS origin, for example `https://example.com`.
   Use the origin only: no path, query, or fragment.
2. Generate the ten approved assessment MP3 files locally with the private
   ElevenLabs authoring credential:

   ```bash
   npm run audio:status
   npm run audio:generate
   ```

Commit the generated files under `public/audio/`. Never add the API key to the
repository or to Cloudflare. The deployed site needs no ElevenLabs credential.

## 2. Verify the production artifact locally

From `astro-pilot/`, run:

```bash
SITE_URL=https://your-domain.example npm run release:status
SITE_URL=https://your-domain.example npm run build:production
```

The release-status preflight validates the final non-placeholder HTTPS origin,
the source-controlled approved booking URL and public proof points, and all ten
static MP3 signatures before starting a full build. It reports every missing
owner input together. The production build must then finish successfully before
deployment; it validates all routes, links, assets, interaction contracts,
sitemap and robots output, security policy, generated hosting redirects, and
production-origin metadata.
Replace the `.example` value before running either command; it is intentionally
rejected by the preflight.

The build creates `dist/_redirects` from the canonical lesson and assessment
inventories. Cloudflare Pages uses those 102 rules as permanent HTTP redirects;
the rules are not maintained by hand.

Before opening a local socket, verify the repository preview contract:

```bash
npm run preview:validate
```

This exercises the production artifact in memory: clean routes, historical
redirects, content types, cache tiers, HEAD responses, the branded 404, method
handling, and the absence of an ElevenLabs proxy. `npm run serve` is a local
static preview only; Cloudflare Pages remains the production host.

## 3. Configure Cloudflare Pages

Use a Git-connected **Cloudflare Pages** project with these settings:

| Setting | Value |
| --- | --- |
| Root directory | `astro-pilot` |
| Build command | `npm run build:production` |
| Build output directory | `dist` |
| Build system | Version 3 |
| Production environment variable | `SITE_URL=https://your-real-domain.example` |

Node is pinned by `.node-version` to `24.16.0`. Do not set
`ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, or any named voice in the hosting
environment. `BOOKING_URL` may be omitted because the approved Preply URL is the
source-controlled destination and cannot be overridden by deployment
configuration.

The output is entirely static. Do not add a Pages Function or Worker unless a
future feature genuinely requires server behavior; doing so changes how
`_headers` and `_redirects` apply.

## 4. Attach the domain and verify HTTPS

Add the custom domain in Cloudflare Pages, wait for its certificate to become
active, and make the chosen canonical hostname the value of `SITE_URL`. If both
`www` and apex hostnames exist, choose one canonical origin and redirect the
other at the domain level.

## 5. Run the live-host release gate

After the production deployment is visible, run:

```bash
npm run live:validate -- https://your-real-domain.example
```

The live gate requests every canonical public page—including all 92 tutor
plans—and all historical routes.
It verifies:

- successful direct refreshes and matching canonical URLs;
- the custom 404 response;
- the approved booking link, **1000+ lessons taught**, rating, and review count;
- robots and sitemap discovery with no localhost origin;
- all 102 historical routes as real HTTP `301` responses;
- all ten assessment MP3s as static `audio/mpeg` responses;
- production security headers and asset cache policies;
- absence of browser-facing ElevenLabs endpoints or secret-like references.

Do not announce or submit the site to search engines until this command passes.

## 6. Launch and rollback

Before announcement, manually check the homepage and booking action at 320px
and desktop width, complete one lesson interaction, and play one assessment
clip. If a serious regression appears, use Cloudflare Pages’ deployment history
to roll back to the last validated artifact, fix the source, and repeat the
production and live gates.

For the first two weeks, review Cloudflare analytics for 404s and response
errors, listen for learner/tutor friction, and record broken audio or route
reports. Do not enable visitor analytics, forms, or tracking without first
adding an accurate privacy page and documenting the data flow.
