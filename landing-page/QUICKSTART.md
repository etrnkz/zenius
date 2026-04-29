# Quick Start Guide - 5 Minutes to Deploy

## Step 1: Install (1 minute)

```bash
cd landing-page
npm install
```

## Step 2: Update App URL (1 minute)

Open `src/app/page.tsx` and find these lines (there are 3 places):

```typescript
// Line ~118, ~157, ~458
href="https://your-app-url.com"
```

Replace with your actual app URL:

```typescript
href="https://app.yourdomain.com"
// or
href="https://yourdomain.com/app"
```

## Step 3: Test Locally (1 minute)

```bash
npm run dev
```

Open http://localhost:3001 and verify:
- ✅ Page loads with animation
- ✅ All sections visible
- ✅ Download button works
- ✅ "Open App" links to correct URL

## Step 4: Deploy to Vercel (2 minutes)

### Option A: Using Vercel CLI (Fastest)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Follow the prompts, done! 🎉

### Option B: Using Vercel Dashboard

1. Go to https://vercel.com
2. Click "New Project"
3. Import your Git repository
4. Set root directory to `landing-page`
5. Click "Deploy"

Done! 🎉

## That's It!

Your landing page is now live at: `https://your-project.vercel.app`

### Optional: Add Custom Domain

In Vercel dashboard:
1. Go to Project Settings → Domains
2. Add your domain (e.g., `www.zenius.com`)
3. Update DNS records as shown
4. Wait 5-10 minutes for DNS propagation

## Troubleshooting

### Build fails?
```bash
rm -rf .next node_modules
npm install
npm run build
```

### Images not showing?
Check that `public/logo.svg` and `public/zenius.apk` exist.

### Wrong app URL?
Update all 3 instances in `src/app/page.tsx` (search for "your-app-url.com")

## Need Help?

- Check `README.md` for more details
- Check `DEPLOYMENT.md` for other deployment options
- Check Next.js docs: https://nextjs.org/docs
