# Zenius Landing Page

This is a standalone landing page for Zenius that can be deployed separately from the main application server.

## Features

- ✨ Beautiful animated GLSL hills background
- 📱 Fully responsive design
- 🎨 Modern dark theme with smooth animations
- 🚀 Optimized for production deployment
- 📦 Standalone Next.js application

## Getting Started

### Installation

```bash
cd landing-page
npm install
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

### Production Build

Build for production:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

## Deployment

### Vercel (Recommended)

1. Push this folder to a Git repository
2. Import the project in Vercel
3. Set the root directory to `landing-page`
4. Deploy

### Netlify

1. Build the project: `npm run build`
2. Deploy the `.next` folder

### Docker

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3001
ENV PORT 3001
CMD ["node", "server.js"]
```

Build and run:

```bash
docker build -t zenius-landing .
docker run -p 3001:3001 zenius-landing
```

## Configuration

### Update App URL

Replace `https://your-app-url.com` in `src/app/page.tsx` with your actual app URL.

### Assets

Make sure to copy these files to the `public` folder:
- `logo.svg` - Your logo file
- `zenius.apk` - Your Android APK file

## Structure

```
landing-page/
├── src/
│   ├── app/
│   │   ├── page.tsx          # Main landing page
│   │   ├── layout.tsx        # Root layout
│   │   └── globals.css       # Global styles
│   └── components/
│       └── ui/
│           └── glsl-hills.tsx # Animated background
├── public/
│   ├── logo.svg              # Logo
│   └── zenius.apk            # APK file
├── package.json
├── next.config.js
├── tsconfig.json
└── tailwind.config.ts
```

## License

Same as the main Zenius project.
