# NutriPath MVP

NutriPath is an action-first decision-support web app that helps families:
- detect nutrition risk quickly
- decide what to do today
- build practical meals from available food
- find nearby support options

## Run locally

From this folder:

```bash
python3 -m http.server 8080
```

Then open:

`http://localhost:8080`

## Deploy (Vercel static)

1. Import this `nutripath` folder as a project in Vercel.
2. Framework preset: `Other`.
3. Build command: leave empty.
4. Output directory: leave empty (root static files).

## Demo flow (2 minutes)

1. Open homepage and click `Start 30-sec assessment`.
2. Fill 5 answers and click `Check my risk`.
3. Show the risk badge, watch-list, and `Start with this` actions.
4. Click `Build meal now`, enter foods, and generate meal plan.
5. Click `Find nearby support`, enter a city, and show results/fallback.
