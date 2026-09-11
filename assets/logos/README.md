# Org marks

Drop a logo here and name it from the matching role in `data/work.json`:

```json
{ "id": "spira", "org": "Spira Inc.", "logo": "assets/logos/spira.svg" }
```

**SVG is strongly preferred.** The file is painted through a CSS mask
(`assets/css/main.css` → `.mark--img`), so only its alpha channel matters —
whatever colour the source artwork is, it renders as a flat single-colour shape
that follows the site's accent and switches with moon mode automatically. A
transparent PNG works too, but will not scale as cleanly.

A role with no `logo` field falls back to a monogram drawn from its name. That
is a deliberate placeholder, not an attempt at the real mark.

One thing worth keeping in mind: these are other companies' trademarks. Showing
the logo of somewhere you actually worked, on your own CV, is ordinary and
accepted — but use the real artwork rather than a redrawn approximation, and
drop any mark whose owner asks you to.
