# Pre-Deployment Checklist

Use this checklist before deploying your landing page to production.

## 📋 Configuration

- [ ] Updated app URL in `src/app/page.tsx` (3 places)
  - [ ] Line ~118: Desktop "Open App" link
  - [ ] Line ~157: Mobile "Open App" link  
  - [ ] Line ~458: Footer "Open App" link

- [ ] Verified assets in `public/` folder
  - [ ] `logo.svg` exists and displays correctly
  - [ ] `zenius.apk` exists and is the latest version

- [ ] Updated metadata in `src/app/layout.tsx`
  - [ ] Title is correct
  - [ ] Description is accurate
  - [ ] Added favicon (optional)

## 🧪 Local Testing

- [ ] Installed dependencies (`npm install`)
- [ ] Development server runs (`npm run dev`)
- [ ] Production build works (`npm run build`)
- [ ] Production server runs (`npm start`)

### Visual Testing
- [ ] Hero section displays correctly
- [ ] GLSL hills animation works
- [ ] Navigation menu works (desktop)
- [ ] Mobile menu works
- [ ] All sections scroll smoothly
- [ ] Features section animates on scroll
- [ ] "How it works" section displays
- [ ] Download CTA section displays
- [ ] Footer displays correctly

### Functional Testing
- [ ] "Download APK" button downloads file
- [ ] "Open App" links go to correct URL
- [ ] All navigation links work
- [ ] Mobile responsive (test on phone)
- [ ] Tablet responsive
- [ ] Desktop responsive (1920px+)

### Browser Testing
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

## 🚀 Deployment

### Pre-Deploy
- [ ] Committed all changes to Git
- [ ] Pushed to remote repository
- [ ] Created production branch (optional)
- [ ] Backed up current version

### Deploy
- [ ] Chose deployment platform
  - [ ] Vercel (recommended)
  - [ ] Netlify
  - [ ] VPS
  - [ ] Docker
  - [ ] Other: ___________

- [ ] Deployed successfully
- [ ] Deployment URL works
- [ ] No build errors
- [ ] No runtime errors

### Post-Deploy
- [ ] Tested deployment URL
- [ ] All assets load correctly
- [ ] APK downloads work
- [ ] Links work correctly
- [ ] Mobile version works
- [ ] HTTPS enabled
- [ ] Custom domain configured (if applicable)

## 🔒 Security

- [ ] No API keys in code
- [ ] No sensitive data exposed
- [ ] HTTPS enabled
- [ ] Security headers configured (automatic on Vercel)
- [ ] No console errors in production

## 📊 Analytics (Optional)

- [ ] Google Analytics installed
- [ ] Tracking code tested
- [ ] Events configured
  - [ ] Download button clicks
  - [ ] "Open App" clicks
  - [ ] Navigation clicks

## 🎯 SEO (Optional)

- [ ] Meta description added
- [ ] Open Graph tags added
- [ ] Twitter Card tags added
- [ ] Sitemap generated
- [ ] robots.txt configured
- [ ] Favicon added

### Example SEO Tags
```typescript
// Add to src/app/layout.tsx
export const metadata = {
  title: "Zenius - Study Smarter, Not Harder",
  description: "AI-powered learning platform. Turn any material into notes, flashcards, quizzes, and podcasts instantly.",
  openGraph: {
    title: "Zenius - Study Smarter, Not Harder",
    description: "AI-powered learning platform",
    url: "https://www.zenius.com",
    siteName: "Zenius",
    images: [
      {
        url: "https://www.zenius.com/og-image.jpg",
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zenius - Study Smarter, Not Harder",
    description: "AI-powered learning platform",
    images: ["https://www.zenius.com/og-image.jpg"],
  },
};
```

## 🔄 Monitoring

- [ ] Set up uptime monitoring
  - [ ] UptimeRobot (free)
  - [ ] Pingdom
  - [ ] Vercel Analytics (automatic)

- [ ] Error tracking configured
  - [ ] Sentry (optional)
  - [ ] LogRocket (optional)

- [ ] Performance monitoring
  - [ ] Lighthouse score checked
  - [ ] Core Web Vitals passing

## 📱 Mobile App Integration

- [ ] APK file is latest version
- [ ] APK file size is reasonable (<50MB)
- [ ] Download link tested on Android device
- [ ] Installation instructions clear (if needed)

## 🌐 Domain & DNS

- [ ] Domain purchased
- [ ] DNS records configured
  - [ ] A record or CNAME for www
  - [ ] SSL certificate issued
  - [ ] DNS propagation complete (24-48 hours)

- [ ] Redirects configured
  - [ ] Non-www to www (or vice versa)
  - [ ] HTTP to HTTPS

## 📝 Documentation

- [ ] README.md updated
- [ ] Deployment guide reviewed
- [ ] Team members informed
- [ ] Access credentials shared (if needed)

## 🎉 Launch

- [ ] Soft launch (test with small audience)
- [ ] Monitor for issues
- [ ] Fix any bugs
- [ ] Full launch
- [ ] Announce on social media
- [ ] Update main app to link to new landing page

## 📈 Post-Launch

### Week 1
- [ ] Monitor analytics daily
- [ ] Check error logs
- [ ] Gather user feedback
- [ ] Fix critical issues

### Month 1
- [ ] Review performance metrics
- [ ] Optimize based on data
- [ ] A/B test improvements
- [ ] Update content if needed

### Ongoing
- [ ] Monthly performance review
- [ ] Update APK when new version released
- [ ] Keep dependencies updated
- [ ] Monitor uptime and speed

## 🆘 Emergency Contacts

- Deployment Platform Support: ___________
- Domain Registrar Support: ___________
- Team Lead: ___________
- Developer: ___________

## 📞 Rollback Plan

If something goes wrong:

1. **Vercel/Netlify**: 
   - Go to Deployments
   - Click on previous working deployment
   - Click "Promote to Production"

2. **VPS**:
   ```bash
   pm2 stop zenius-landing
   git checkout <previous-commit>
   npm install
   npm run build
   pm2 restart zenius-landing
   ```

3. **Docker**:
   ```bash
   docker-compose down
   git checkout <previous-commit>
   docker-compose up -d --build
   ```

## ✅ Final Check

Before going live, answer these:

- [ ] Does the landing page load in under 3 seconds?
- [ ] Does it work on mobile?
- [ ] Can users download the APK?
- [ ] Does "Open App" go to the right place?
- [ ] Are there any console errors?
- [ ] Is HTTPS working?
- [ ] Have you tested on a real device?

If all answers are YES, you're ready to launch! 🚀

---

**Date Completed**: ___________
**Deployed By**: ___________
**Deployment URL**: ___________
**Notes**: ___________
