# Diary Stream App

This app is a welcome page and diary-style community feed for A Walk to Squiddle aBit with The Dead.

## What it does

- Only the diary owner can publish new entries.
- Anyone can view the diary stream.
- Visitors can leave comments on each entry.
- Diary entries, comments, visitor posts, participants, live location, and login sessions are stored in MongoDB.
- Visitors can publish public community posts, and the owner can remove posts, publish curated updates, or pause AI auto-posting.
- Optional AI-generated research highlights link to recent PubMed records about spirituality, mediumship, death, and near-death experiences.
- The welcome page links to the diary stream and the GoFundMe fundraiser.

## Deploy to Vercel with MongoDB Atlas

The Vercel project should use `01-github-latest-features/diary-stream-app` as its **Root Directory**. Vercel detects the Express app in `server.js`; static files are served from `public/`. Use Node.js 18 or newer. No build command is required.

1. In Vercel, import the Git repository and set the Root Directory to `01-github-latest-features/diary-stream-app`.
2. In MongoDB Atlas, create a dedicated database user with a strong unique password and only the permissions this app needs (read/write to its database). Configure Atlas network access for Vercel. Vercel outbound IPs may not be fixed on your plan; use static egress or private networking if available. If you choose `0.0.0.0/0` to allow Vercel to connect, understand that it permits connection attempts from any IP, so use a restricted database user and never rely on the allowlist as your only protection. Use the Atlas-generated connection string; URL-encode special characters in the database password if necessary.
3. Add these values in Vercel **Project Settings → Environment Variables**. Use private values only in that dashboard:
   - `NODE_ENV` = `production`
   - `OWNER_USERNAME` = `kristilea`
   - `OWNER_PASSWORD` = a new, unique password
   - `DAD_USERNAME` = `myDaddy`
   - `DAD_PASSWORD` = a different, new, unique password
   - `SESSION_SECRET` = a random value of at least 32 characters
   - `MONGODB_URI` = your Atlas connection string
   - `MONGODB_DB_NAME` = `diary_stream` (optional; this is the default)
   - `CRON_SECRET` = a separate random value to protect the scheduled research endpoint
   - `OPENAI_API_KEY` = optional; only if you want AI-generated posts
   - `OPENAI_MODEL` = optional; defaults to `gpt-4o-mini`
4. Deploy the project. Test the Vercel deployment URL and confirm login, a visitor post, and the community feed before connecting your domain.
5. In Vercel **Settings → Domains**, add `crystalcalamagalistic.com` and follow the DNS records Vercel provides. In Cloudflare, add those exact records; do not guess the target or change nameservers. Wait for Vercel to confirm the domain and HTTPS certificate.

You can generate random secrets locally with `openssl rand -hex 32`; use separate values for `SESSION_SECRET` and `CRON_SECRET`. Never put credentials or connection strings in source control or chat. Rotate any passwords previously pasted into chat before deployment.

Vercel runs the scheduled research job once daily at 09:00 UTC; one run can publish up to three relevant AI posts. The daily cadence works with Vercel Hobby scheduling limits. The job requires `CRON_SECRET`.

## Run locally

Use Node.js 18 or newer. Configure the same required account and Atlas variables in your shell, then start the app:

```bash
cd diary-stream-app
npm install
export OWNER_USERNAME=kristilea DAD_USERNAME=myDaddy
read -rsp "Owner password: " OWNER_PASSWORD; echo; export OWNER_PASSWORD
read -rsp "Dad password: " DAD_PASSWORD; echo; export DAD_PASSWORD
read -rsp "MongoDB Atlas connection string: " MONGODB_URI; echo; export MONGODB_URI
export SESSION_SECRET="$(openssl rand -hex 32)"
npm run dev
```

Open http://localhost:3000 for the welcome page or http://localhost:3000/stream for the diary.

## Notes

- The owner can publish diary entries, manage community posts, pause AI auto-posting, and choose whether to share a live location. The separate `myDaddy` account can only view the latest shared location.
- Community posts are public immediately. Visitors can submit up to five posts per IP per UTC hour; only a keyed hash is retained temporarily for rate limiting, not the raw address. The owner can remove posts from the feed.
- AI research highlights require `OPENAI_API_KEY`. They use only PubMed citation metadata (title, journal, and publication date) and send that metadata to OpenAI; abstracts, diary entries, visitor posts, passwords, and location data are not sent. AI posts are labeled, link to their PubMed records, and are not summaries of article findings. No filler is published when no suitable records are found. OpenAI usage may incur charges.
- General-news sources are not enabled because their reuse terms could not be verified. `OPENAI_MODEL` can override the default `gpt-4o-mini`.
- The location feature requires a secure context (HTTPS, except `localhost`), browser permission, and the owner explicitly pressing **Start sharing**. It updates only while the page is open; the latest location expires after two minutes. It is not background tracking.
- SQLite data from earlier local versions is not automatically copied to Atlas. The app creates its MongoDB collections and indexes when it connects.
