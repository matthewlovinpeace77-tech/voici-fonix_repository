# NoteWise — Interactive AI Music Tutor

Gemini tutor, optional Supabase lesson library, interactive quiz, and browser-local pitch checker.

## Deploy on Render

1. Push to GitHub and create a Render Blueprint from this repository (`render.yaml`), or create a Docker Web Service.
2. Set `GEMINI_API_KEY` in Render's environment settings for AI answers. The app binds to Render's `PORT` and has a `/health` check.
3. Deploy. Supabase is optional; without it, bundled lessons are used. Microphone access requires HTTPS.

## Supabase (optional lessons)

Run `supabase/schema.sql` in your Supabase SQL editor. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in Render. The database policy is read-only for public lesson content; never use a Supabase service-role/secret key in this app.

## Cloudflare (optional security layer)

Keep Render as the origin and use Cloudflare in front of a custom domain. Follow current Render custom-domain and Cloudflare DNS setup instructions. In Cloudflare, enable the available managed WAF rules and bot protections, and add a rate-limiting rule for `/api/chat` to control abuse and unexpected Gemini costs. Test rules before enforcing them; allow `/health` as needed. Cloudflare is not required for deployment, and its Tunnel is not needed for Render.

The app also returns baseline security headers. These are defense-in-depth, not a replacement for Cloudflare WAF/rate limits or keeping Gemini credentials secret.

## Local / Docker

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
# or
docker build -t notewise . && docker run --rm -p 8000:8000 -e GEMINI_API_KEY="your-key" notewise
```

Without `GEMINI_API_KEY`, demo tutor responses are available. Keep secrets in Render's environment settings, not in Git. Gemini usage may incur charges.
