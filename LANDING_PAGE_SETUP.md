# Landing Page Setup Summary

I've created a separate, standalone landing page in the `landing-page/` folder that can be deployed independently from your main server application.

## What Was Created

```
landing-page/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main landing page (copied from app/page.tsx)
│   │   ├── layout.tsx            # Root layout
│   │   └── globals.css           # Global styles
│   └── components/
│       └── ui/
│           └── glsl-hills.tsx    # Animated background component
├── public/
│   ├── logo.svg                  # Logo (copied from main project)
│   └── zenius.apk                # APK file (copied from main project)
├── package.json                  # Minimal dependencies
├── next.config.js                # Next.js configuration
├── tsconfig.json                 # TypeScript configuration
├── tailwind.config.ts            # Tailwind CSS configuration
├── postcss.config.mjs            # PostCSS configuration
├── .gitignore                    # Git ignore rules
├── .env.example                  # Environment variables template
├── README.md                     # Documentation
└── DEPLOYMENT.md                 # Detailed deployment guide

```

## Key Features

✅ **Standalone Application**: Complete Next.js app with minimal dependencies
✅ **Same Design**: Identical to your current landing page
✅ **Animated Background**: GLSL hills animation included
✅ **Responsive**: Works on all devices
✅ **Production Ready**: Optimized for deployment
✅ **Easy to Deploy**: Works with Vercel, Netlify, Docker, VPS

## Quick Start

### 1. Install Dependencies

```bash
cd landing-page
npm install
```

### 2. Update Configuration

Before deploying, update the app URL in `src/app/page.tsx`:

Find and replace all instances of:
```typescript
href="https://your-app-url.com"
```

With your actual app URL:
```typescript
href="https://your-actual-app-url.com"
```

### 3. Test Locally

```bash
npm run dev
```

Visit http://localhost:3001

### 4. Build for Production

```bash
npm run build
npm start
```

## Deployment Options

### Option 1: Vercel (Recommended - Easiest)

1. Push the `landing-page` folder to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Deploy (automatic detection)

**Pros**: Free, automatic SSL, CDN, zero config
**Cons**: None for this use case

### Option 2: Netlify

1. Build: `npm run build`
2. Deploy the `.next` folder to Netlify

**Pros**: Free, easy to use
**Cons**: Slightly more manual than Vercel

### Option 3: VPS (DigitalOcean, AWS, etc.)

See `DEPLOYMENT.md` for detailed instructions.

**Pros**: Full control, can run alongside other services
**Cons**: Requires server management

### Option 4: Docker

See `DEPLOYMENT.md` for Dockerfile and instructions.

**Pros**: Portable, consistent environments
**Cons**: Requires Docker knowledge

## Why Separate Landing Page?

1. **Independent Scaling**: Landing page can scale separately from your server
2. **Better Performance**: Can be deployed on edge network (Vercel/Netlify)
3. **Easier Updates**: Update landing page without touching server
4. **Cost Effective**: Landing page can be hosted for free
5. **Reliability**: If server goes down, landing page stays up

## Architecture

```
┌─────────────────────────────────────────┐
│                                         │
│  Landing Page (landing-page/)           │
│  - Static Next.js site                  │
│  - Deployed on Vercel/Netlify          │
│  - URL: www.zenius.com                  │
│                                         │
└────────────┬────────────────────────────┘
             │
             │ Links to
             │
             ▼
┌─────────────────────────────────────────┐
│                                         │
│  Main Application (current project)     │
│  - Full Next.js app with API routes    │
│  - Deployed on VPS/Cloud                │
│  - URL: app.zenius.com                  │
│                                         │
└─────────────────────────────────────────┘
```

## Next Steps

1. **Test the landing page locally**
   ```bash
   cd landing-page
   npm install
   npm run dev
   ```

2. **Update the app URL** in `src/app/page.tsx`

3. **Verify assets** are in `public/` folder:
   - `logo.svg` ✅ (already copied)
   - `zenius.apk` ✅ (already copied)

4. **Choose deployment platform** (Vercel recommended)

5. **Deploy** following the guide in `DEPLOYMENT.md`

6. **Test production deployment**:
   - All links work
   - APK downloads correctly
   - "Open App" button goes to correct URL
   - Mobile responsive
   - Animations work

## Maintenance

### Updating Content

Edit `landing-page/src/app/page.tsx` and redeploy.

### Updating APK

Replace `landing-page/public/zenius.apk` and redeploy.

### Updating Logo

Replace `landing-page/public/logo.svg` and redeploy.

## Differences from Main Project

The landing page has:
- ✅ Minimal dependencies (only what's needed for landing page)
- ✅ No API routes (static site)
- ✅ No database connections
- ✅ No authentication
- ✅ Faster build times
- ✅ Lower hosting costs

## Support

- See `landing-page/README.md` for basic info
- See `landing-page/DEPLOYMENT.md` for detailed deployment guide
- Check Next.js docs: https://nextjs.org/docs

## Estimated Costs

- **Vercel/Netlify**: FREE (for hobby/personal projects)
- **VPS**: $5-10/month
- **Domain**: $10-15/year

Total: **$0-10/month** (can be completely free with Vercel + existing domain)
