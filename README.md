# Travel Recommendation System (MVP)

An AI-powered Next.js app that turns natural-language preferences into travel recommendations.

## Quickstart
```bash
pnpm i # or npm i / yarn
cp .env.local.example .env.local
# add OPENAI_API_KEY
pnpm dev
# open http://localhost:3000
```

## Notes
- Supports both **App Router** (`app/`) and a compatibility **Pages Router** entry (`pages/index.tsx`).
- If you previously saw `SyntaxError: /index.tsx: Unexpected token (1:0)`, ensure you run this project as provided and that files keep their `.tsx` extensions. This repo includes a `pages/index.tsx` shim to satisfy environments that expect a pages entrypoint.