#!/bin/bash
# One-command deploy of Acuity to Vercel.
# Usage: open Terminal, then:  cd ~/Documents/acuity && ./deploy.sh
set -e
cd "$(dirname "$0")"

if [ ! -f .env.local ]; then
  read -r -s -p "Paste your Anthropic API key: " KEY; echo
  echo "ANTHROPIC_API_KEY=$KEY" > .env.local
fi
KEY=$(grep ANTHROPIC_API_KEY .env.local | cut -d= -f2-)

echo "→ Logging in to Vercel (a browser window may open)…"
npx --yes vercel@latest whoami >/dev/null 2>&1 || npx --yes vercel@latest login

echo "→ Linking project…"
npx --yes vercel@latest link --yes --project acuity-study

echo "→ Setting ANTHROPIC_API_KEY on Vercel…"
npx --yes vercel@latest env rm ANTHROPIC_API_KEY production --yes >/dev/null 2>&1 || true
printf "%s" "$KEY" | npx --yes vercel@latest env add ANTHROPIC_API_KEY production

echo "→ Deploying to production…"
npx --yes vercel@latest deploy --prod --yes
echo "✅ Done! Your live URL is shown above."
