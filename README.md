# elliotroth.me

A portfolio site that behaves like a live algae culture.

The hero is a real Gray-Scott reaction–diffusion simulation, seeded like a
four-quadrant streak plate. Drag it and you inoculate it. Everything you do on
the page — opening a role, filtering the press list, running a command — feeds
the culture, and the OD<sub>600</sub> meter in the corner tracks the density.
Grow it far enough and the palette shifts to lunar regolith; push it too far and
something magenta gets loose in the dish.

Press <kbd>/</kbd> anywhere for the bench terminal. `grep algae` really does
search every record on the site.

None of that hides anything. Every article, role, award and talk is readable on
first paint, with no interaction at all.

## Running it

No build step, no dependencies.

```sh
python3 -m http.server 8000
# http://localhost:8000
```

Data is fetched at runtime, so it needs an HTTP server rather than opening the
file directly.

```sh
node scripts/validate.mjs      # schema gate on /data
node scripts/check-links.mjs   # walks every URL, advisory only
```

## The corpus

Everything on the page comes from `data/`:

| file | what's in it |
| --- | --- |
| `profile.json` | name, objective, bio, education, skills |
| `work.json` | roles and ventures, with dates and highlights |
| `artifacts.json` | specific things built and shipped |
| `press.json` | articles, podcasts, videos and profiles about the work |
| `awards.json` | accelerators, grants, prizes, cohorts |
| `talks.json` | conferences and stages |
| `teaching.json` | courses, workshops, mentorship |
| `writing.json` | pieces he wrote |
| `communities.json` | fellowships, co-ops, community labs |
| `changelog.json` | what the curator agent has done, and when |

Adding something means editing JSON. Nothing is hardcoded into the page.

## The link preview

Sharing the URL anywhere — LinkedIn, Slack, X, iMessage — renders a card built
from the site's own reaction-diffusion simulation, captured at 1200x630. It is a
real frame of the thing that runs on the page, not an illustration of it.

Regenerate after any palette or copy change:

```sh
python3 -m http.server 8777 &
node scripts/og/make-og.mjs          # needs Playwright
```

## The curator agent

`.github/workflows/curator.yml` wakes Claude Code twice a week. It reads
`.github/agent/CURATOR.md`, searches for new material about Elliot Roth,
**fetches each source page to verify it before adding anything**, de-duplicates
against the existing corpus, runs the schema validator, writes a changelog
entry, and opens a **draft** pull request.

Guardrails, because an agent with web access and commit rights needs them:

- It may write to `data/` and nowhere else. The workflow diffs everything
  outside `data/` and fails the run if anything moved.
- It cannot merge. Every passage lands as a draft PR for a human.
- It never deletes a record, and never rewrites one without citing the source
  that proves the correction.
- It must confirm a find is about *this* Elliot Roth — a link to algae, Spira,
  Biopunk, VCU or Richmond — before adding it. An empty run is a valid run.
- Fetched pages are treated as untrusted text. Instructions found inside them
  are ignored and reported.
- Eight new records per run, maximum.

### Switching it on

Add one repository secret under **Settings → Secrets and variables → Actions**:

```
ANTHROPIC_API_KEY
```

Without it the workflow logs a notice and exits cleanly instead of failing on
every schedule. Run it by hand any time from the **Actions** tab — the
`workflow_dispatch` trigger takes an optional steer, e.g.
*"look for podcast appearances since June"*.

## Deploying

This repository is wired to **Netlify** (project `elliotroth-me`), which serves
the repository root directly — there is no build command and nothing to
install, so a merge to `main` publishes as-is. Pull requests get a deploy
preview automatically.

`netlify.toml` pins that in the repo rather than leaving it to dashboard
settings. It sets `publish = "."` with an empty build command, and adds:

- **A content security policy.** The page has no inline `<script>` anywhere, so
  `script-src` is locked to `'self'`. `style-src` allows `'unsafe-inline'`
  because `render.js` writes style attributes, plus `fonts.googleapis.com` for
  the stylesheet and `fonts.gstatic.com` for the font files. `img-src` allows
  `data:` for the inline SVG favicon. Everything else is `'self'`, with
  `frame-ancestors 'none'`.
- **`data/*` served `must-revalidate`.** The curator rewrites the corpus; a
  passage should be visible on the next reload, not whenever a CDN expires.
- Ten-minute caching on `assets/*`, since those filenames are not
  content-hashed and cannot be cached immutably.

If you change what the page loads — a CDN script, an embedded iframe, an
analytics beacon — the CSP needs the matching directive or the browser will
silently refuse it.

Nothing about the site depends on that host. It is static files at the root, so
GitHub Pages (**Settings → Pages → Deploy from a branch → `main` / root**) or
any other static host works identically. `.nojekyll` is there so Pages serves
every file untouched if you ever switch.

One host-level caveat: `data/*.json` is fetched at runtime, so the site needs
to be served over HTTP. Opening `index.html` straight off disk will render the
page shell with empty sections.

## Credits

Built with [Claude Code](https://claude.com/claude-code). Content from Elliot
Roth's CV, with every link carried over from the source document.
