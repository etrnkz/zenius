# Deployment Guide for Zenius Landing Page

This guide covers deploying the landing page separately from your main server application.

## Prerequisites

- Node.js 18+ installed
- Git repository
- Deployment platform account (Vercel, Netlify, etc.)

## Quick Deploy Options

### Option 1: Vercel (Easiest)

1. **Push to GitHub**
   ```bash
   cd landing-page
   git init
   git add .
   git commit -m "Initial landing page"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Deploy on Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your repository
   - Vercel will auto-detect Next.js
   - Click "Deploy"

3. **Custom Domain (Optional)**
   - Go to Project Settings → Domains
   - Add your custom domain
   - Update DNS records as instructed

### Option 2: Netlify

1. **Build the project**
   ```bash
   npm install
   npm run build
   ```

2. **Deploy**
   - Go to [netlify.com](https://netlify.com)
   - Drag and drop the `.next` folder
   - Or connect your Git repository

3. **Configure Build Settings**
   - Build command: `npm run build`
   - Publish directory: `.next`

### Option 3: Traditional VPS (DigitalOcean, AWS, etc.)

1. **Setup Server**
   ```bash
   # SSH into your server
   ssh user@your-server-ip
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install PM2 for process management
   sudo npm install -g pm2
   ```

2. **Deploy Application**
   ```bash
   # Clone your repository
   git clone <your-repo-url>
   cd landing-page
   
   # Install dependencies
   npm install
   
   # Build
   npm run build
   
   # Start with PM2
   pm2 start npm --name "zenius-landing" -- start
   pm2 save
   pm2 startup
   ```

3. **Setup Nginx Reverse Proxy**
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

4. **Setup SSL with Let's Encrypt**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```

### Option 4: Docker

1. **Create Dockerfile**
   ```dockerfile
   FROM node:18-alpine AS base
   
   FROM base AS deps
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci
   
   FROM base AS builder
   WORKDIR /app
   COPY --from=deps /app/node_modules ./node_modules
   COPY . .
   RUN npm run build
   
   FROM base AS runner
   WORKDIR /app
   ENV NODE_ENV production
   RUN addgroup --system --gid 1001 nodejs
   RUN adduser --system --uid 1001 nextjs
   
   COPY --from=builder /app/public ./public
   COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
   COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
   
   USER nextjs
   EXPOSE 3001
   ENV PORT 3001
   
   CMD ["node", "server.js"]
   ```

2. **Build and Run**
   ```bash
   docker build -t zenius-landing .
   docker run -d -p 3001:3001 --name zenius-landing zenius-landing
   ```

3. **Docker Compose (Optional)**
   ```yaml
   version: '3.8'
   services:
     landing:
       build: .
       ports:
         - "3001:3001"
       restart: unless-stopped
       environment:
         - NODE_ENV=production
   ```

## Environment Configuration

### Update App URL

Before deploying, update the app URL in `src/app/page.tsx`:

```typescript
// Replace this:
<a href="https://your-app-url.com">

// With your actual app URL:
<a href="https://app.zenius.com">
```

### Assets Checklist

Ensure these files are in the `public` folder:
- ✅ `logo.svg`
- ✅ `zenius.apk`

## Post-Deployment

### 1. Test the Deployment

- Visit your landing page URL
- Test all navigation links
- Try downloading the APK
- Check "Open App" button links to correct URL
- Test on mobile devices

### 2. Setup Analytics (Optional)

Add Google Analytics or similar:

```typescript
// In src/app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
        <script dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'GA_MEASUREMENT_ID');
          `
        }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

### 3. Setup CDN (Optional)

For better performance, use a CDN:
- Cloudflare (Free)
- AWS CloudFront
- Vercel Edge Network (automatic)

## Monitoring

### PM2 Monitoring (VPS)

```bash
# View logs
pm2 logs zenius-landing

# Monitor resources
pm2 monit

# Restart
pm2 restart zenius-landing
```

### Health Check Endpoint

Add a health check in `src/app/api/health/route.ts`:

```typescript
export async function GET() {
  return Response.json({ status: 'ok' });
}
```

## Troubleshooting

### Build Fails

```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

### Port Already in Use

```bash
# Change port in package.json
"start": "next start -p 3002"
```

### Images Not Loading

- Check `public` folder has all assets
- Verify `next.config.js` has `images.unoptimized: true`

## Updating the Landing Page

```bash
# Pull latest changes
git pull origin main

# Rebuild
npm install
npm run build

# Restart (PM2)
pm2 restart zenius-landing

# Or restart (Docker)
docker-compose down
docker-compose up -d --build
```

## Cost Estimates

- **Vercel**: Free for hobby projects
- **Netlify**: Free for personal projects
- **DigitalOcean Droplet**: $5-10/month
- **AWS Lightsail**: $3.50-5/month
- **Cloudflare Pages**: Free

## Support

For issues, check:
- Next.js documentation: https://nextjs.org/docs
- Deployment platform docs
- Main project repository
