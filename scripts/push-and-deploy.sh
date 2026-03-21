#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/push-and-deploy.sh
#   ./scripts/push-and-deploy.sh "your commit message"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMMIT_MSG="${1:-chore: update NutriPath}"

echo "Checking for local changes..."
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Committing changes..."
  git add -A
  git commit -m "$COMMIT_MSG"
else
  echo "No local changes to commit."
fi

echo "Pushing to GitHub..."
git push origin main

echo "Deploying to Vercel production..."
npx --yes vercel --prod --yes

echo "Done."
