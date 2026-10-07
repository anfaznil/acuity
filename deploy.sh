#!/bin/bash
# One-command deploy of Acuity to Vercel.
# Usage: open Terminal, then:  cd ~/Documents/acuity && ./deploy.sh
set -e
cd "$(dirname "$0")"

if [ ! -f .env.local ]; then
  read -r -s -p "Paste your Anthropic API key: " KEY; echo
  echo "ANTHROPIC_API_KEY=$KEY" > .env.local
fi
# `vercel env pull` writes values in quotes; strip them so the key itself is sent.
KEY=$(grep '^ANTHROPIC_API_KEY=' .env.local | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/')

echo "→ Logging in to Vercel (a browser window may open)…"
npx --yes vercel@latest whoami >/dev/null 2>&1 || npx --yes vercel@latest login

echo "→ Linking project…"
npx --yes vercel@latest link --yes --project acuity-study

echo "→ Setting ANTHROPIC_API_KEY on Vercel…"
npx --yes vercel@latest env rm ANTHROPIC_API_KEY production --yes >/dev/null 2>&1 || true
npx --yes vercel@latest env add ANTHROPIC_API_KEY production --value "$KEY" --sensitive --yes </dev/null

if ! npx --yes vercel@latest env ls 2>/dev/null | grep -q BLOB_READ_WRITE_TOKEN; then
  echo "→ Creating private Blob store for account sync…"
  npx --yes vercel@latest blob create-store acuity-sync --access private --yes
fi

if ! npx --yes vercel@latest env ls 2>/dev/null | grep -q AUTH_SECRET; then
  echo "→ Generating AUTH_SECRET for sign-in sessions…"
  npx --yes vercel@latest env add AUTH_SECRET production --value "$(openssl rand -base64 48 | tr -d '\n')" --sensitive --yes </dev/null
fi

echo "→ Deploying to production…"
npx --yes vercel@latest deploy --prod --yes
echo "✅ Done! Your live URL is shown above."
