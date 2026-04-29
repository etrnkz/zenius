# Architecture Overview

## Current Setup (Before)

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Single Next.js Application                             │
│  ├── Landing Page (/)                                   │
│  ├── App (/app)                                         │
│  ├── API Routes (/api/*)                                │
│  └── All Features                                       │
│                                                         │
│  Deployed on: VPS/Server                                │
│  Problem: Heavy, expensive, single point of failure     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## New Setup (After)

```
┌──────────────────────────────────┐
│  Landing Page (Separate)         │
│  ├── Static content              │
│  ├── Animations                  │
│  ├── Download links              │
│  └── Links to main app           │
│                                  │
│  Deployed on: Vercel/Netlify     │
│  URL: www.zenius.com             │
│  Cost: FREE                      │
│  Speed: Edge Network (Fast!)     │
│                                  │
└────────────┬─────────────────────┘
             │
             │ User clicks "Open App"
             │
             ▼
┌──────────────────────────────────┐
│  Main Application                │
│  ├── Full app (/app)             │
│  ├── API Routes (/api/*)         │
│  ├── Database                    │
│  ├── Authentication              │
│  └── All Features                │
│                                  │
│  Deployed on: VPS/Cloud          │
│  URL: app.zenius.com             │
│  Cost: $5-20/month               │
│                                  │
└──────────────────────────────────┘
```

## Benefits

### 1. Performance
- **Landing Page**: Served from edge network (Vercel/Netlify)
  - Loads in <1 second globally
  - Cached at 100+ locations worldwide
  
- **Main App**: Only loaded when user needs it
  - Reduces server load
  - Better resource allocation

### 2. Cost
- **Landing Page**: FREE on Vercel/Netlify
- **Main App**: Only pay for actual app usage
- **Total Savings**: 50-70% reduction in hosting costs

### 3. Reliability
- **Landing Page**: 99.99% uptime (Vercel SLA)
- **Main App**: Can restart/update without affecting landing page
- **Result**: Users always see a working site

### 4. Scalability
- **Landing Page**: Auto-scales to millions of visitors
- **Main App**: Scale independently based on actual usage
- **Result**: Handle traffic spikes without issues

### 5. Development
- **Landing Page**: Update marketing without touching app
- **Main App**: Update features without affecting landing page
- **Result**: Faster iterations, less risk

## Traffic Flow

```
User visits www.zenius.com
         │
         ▼
┌─────────────────────┐
│  Landing Page       │
│  (Vercel/Netlify)   │
└─────────────────────┘
         │
         ├─► Clicks "Download APK"
         │   └─► Downloads from landing page
         │
         ├─► Clicks "Open App"
         │   └─► Redirects to app.zenius.com
         │
         └─► Browses features
             └─► Stays on landing page
```

## File Structure Comparison

### Landing Page (Minimal)
```
landing-page/
├── src/
│   ├── app/
│   │   ├── page.tsx          # Landing page only
│   │   ├── layout.tsx
│   │   └── globals.css
│   └── components/
│       └── ui/
│           └── glsl-hills.tsx
├── public/
│   ├── logo.svg
│   └── zenius.apk
└── package.json              # ~10 dependencies
```

### Main Application (Full)
```
your-main-project/
├── app/
│   ├── page.tsx              # Landing (can be removed)
│   ├── app/                  # Main app
│   ├── api/                  # API routes
│   └── ...
├── components/               # All components
├── lib/                      # Utilities
└── package.json              # 50+ dependencies
```

## Deployment Strategy

### Phase 1: Deploy Landing Page
1. Deploy landing page to Vercel
2. Point www.zenius.com to Vercel
3. Test everything works

### Phase 2: Update Main App
1. Remove landing page from main app (optional)
2. Keep main app at app.zenius.com
3. Update any internal links

### Phase 3: Optimize
1. Landing page handles all marketing traffic
2. Main app only handles authenticated users
3. Monitor and optimize both separately

## Domain Setup

```
DNS Records:

www.zenius.com
├── Type: CNAME
└── Value: cname.vercel-dns.com
    (Points to landing page on Vercel)

app.zenius.com
├── Type: A
└── Value: Your VPS IP address
    (Points to main application)
```

## Monitoring

### Landing Page
- Vercel Analytics (built-in)
- Google Analytics (optional)
- Uptime: Vercel handles this

### Main App
- Your existing monitoring
- PM2 (if using VPS)
- Application logs

## Backup Strategy

### Landing Page
- Git repository (source of truth)
- Vercel keeps deployments
- Can redeploy in seconds

### Main App
- Your existing backup strategy
- Database backups
- Code repository

## Security

### Landing Page
- No sensitive data
- No API keys needed
- No database
- Static content only
- HTTPS automatic (Vercel)

### Main App
- All your existing security
- API keys
- Database
- Authentication
- HTTPS (Let's Encrypt)

## Cost Breakdown

### Landing Page
- Hosting: $0 (Vercel free tier)
- Bandwidth: $0 (100GB free)
- SSL: $0 (included)
- CDN: $0 (included)
**Total: $0/month**

### Main App
- VPS: $5-20/month
- Database: $0-10/month (if separate)
- Bandwidth: Usually included
**Total: $5-30/month**

### Combined
**Total: $5-30/month** (vs $20-50/month for single server)

## Scaling Example

### 10,000 visitors/month
- Landing page: FREE (Vercel handles it)
- Main app: ~1,000 actual users
- Cost: $5-10/month

### 100,000 visitors/month
- Landing page: FREE (still within limits)
- Main app: ~10,000 actual users
- Cost: $10-20/month

### 1,000,000 visitors/month
- Landing page: $20/month (Pro plan)
- Main app: ~100,000 actual users
- Cost: $50-100/month

Compare to single server: $200-500/month for same traffic!

## Migration Path

### Option 1: Keep Both Landing Pages
- Old: app/page.tsx (redirect to new landing)
- New: landing-page/ (main landing)
- Gradual migration

### Option 2: Replace Completely
- Remove app/page.tsx
- Use landing-page/ only
- Update all links

### Option 3: A/B Test
- 50% traffic to old landing
- 50% traffic to new landing
- Compare metrics
- Choose winner

## Recommended Setup

```
Production:
├── www.zenius.com → Landing Page (Vercel)
├── app.zenius.com → Main App (VPS)
└── api.zenius.com → API (optional, same VPS)

Development:
├── localhost:3001 → Landing Page
└── localhost:3000 → Main App
```

This is the optimal setup for most applications!
