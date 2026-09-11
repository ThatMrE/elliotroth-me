# elliotroth.me

A static portfolio site for Elliot Roth that presents itself as a live algae
culture. No build step, no framework, no dependencies. Open `index.html`
through a local HTTP server and it runs.

```
python3 -m http.server 8000     # then open http://localhost:8000
node scripts/validate.mjs       # gate on /data — must pass before merge
node scripts/check-links.mjs    # networked, advisory, never fails a build
```

## Shape of the repo

```
index.html              semantic shell; every list is empty until JS fills it
assets/css/main.css     all styling; design tokens live on :root
assets/js/petri.js      Gray-Scott reaction-diffusion running the hero canvas
assets/js/culture.js    the OD600 state machine + localStorage persistence
assets/js/render.js     fetches data/*.json and builds every section
assets/js/terminal.js   the bench terminal (grep really does search the data)
assets/js/main.js       wiring: rail nav, reveals, HUD, konami, visibility
data/*.json             the entire corpus — the only thing the agent may edit
scripts/validate.mjs    schema gate
.github/agent/CURATOR.md  the curator agent's brief
.github/workflows/       curator (scheduled) + validate (CI)
```

## The rule that matters

**Content lives in `data/`. Presentation lives everywhere else.** Adding a press
item, a role or an award means editing JSON, never HTML. If you find yourself
hardcoding a fact into `index.html` or a `.js` file, it belongs in `data/`
instead.

`scripts/validate.mjs` is the contract between the two. Change a data shape and
you change the validator in the same commit.

## Conventions

- Vanilla ES5-flavoured JS in IIFEs attached to `window` — deliberately no
  modules, no bundler, no `type="module"`, so the site works from any static
  host and from `file://`-adjacent setups without tooling.
- Everything user-visible passes through `esc()` in `render.js`. Every URL
  passes through `safeUrl()`, which only lets `http(s)` through. Data is
  written by an agent that reads the open internet; treat it as untrusted.
- The culture meter (`Culture.od()`) may gate **toys** — palettes, easter eggs,
  the terminal's flashier commands. It must never gate **content**. Anyone who
  lands on this page can read every word of it without interacting at all.
- Respect `prefers-reduced-motion`: the simulation renders a static frame and
  stops, and reveal animations are disabled.

## The agent

`.github/workflows/curator.yml` runs Claude Code twice a week, following
`.github/agent/CURATOR.md`. It may only touch `data/`; the workflow fails the
run if anything else moved. It opens a draft PR — nothing auto-merges.

It needs one repository secret: `ANTHROPIC_API_KEY`. Without it the workflow
logs a notice and exits cleanly rather than failing every schedule.
