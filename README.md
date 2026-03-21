# NutriPath (Static Multipage MVP)

NutriPath is an action-first nutrition decision-support platform for U.S. households.

Core positioning:

> NutriPath helps families and caregivers spot nutrition risk early, build better meals from what they already have, and find nearby support when access is limited.

## Pages

- `index.html` - Home
- `assessment.html` - Assessment + inline results
- `map.html` - Resource Map
- `meal-builder.html` - Smart Meal Builder + Recipe tools
- `learn.html` - Nutrition Action Hub
- `auth.html` - Log in / Sign up + saved history view
- `results.html` - Optional standalone results view

## Run locally

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Runtime API config (no hardcoded keys)

NutriPath reads keys from `window.NUTRIPATH_KEYS` in `runtime-config.js`.

1. Copy `runtime-config.example.js` -> `runtime-config.js`.
2. Add keys locally:
   - `voiceApiKey` for `https://dev.voice.ai/api/v1`
   - `recipeApiKey` for `https://api.spoonacular.com`

If keys are missing, the app falls back gracefully:
- Voice: browser speech synthesis
- Recipe API: user-facing setup warning

## Deploy to Vercel

- Framework preset: `Other`
- Build command: leave empty
- Output directory: leave empty (root)

## Service worker

- Versioned cache in `sw.js`
- Network-first strategy for HTML/CSS/JS to reduce stale deploy issues
- App shell caching for baseline offline behavior
