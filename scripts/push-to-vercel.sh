#!/usr/bin/env bash
set -euo pipefail

# One-command deploy flow:
# 1) commit local changes
# 2) push to GitHub
# 3) Vercel auto-deploys from Git integration
#
# Usage:
#   ./scripts/push-to-vercel.sh "your commit message"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not inside a git repository."
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "Missing git remote 'origin'. Add it first."
  exit 1
fi

COMMIT_MSG="${1:-deploy: update NutriPath}"
BRANCH="$(git branch --show-current)"

if [ -z "${BRANCH}" ]; then
  echo "Could not detect current branch."
  exit 1
fi

git add -A

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "${COMMIT_MSG}"
fi

git push origin "${BRANCH}"

echo ""
echo "Pushed to origin/${BRANCH}."
echo "Vercel will now build and deploy automatically from this push."
