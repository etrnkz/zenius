# Deploying Zenius to Vercel (Free)

## Option 1: Deploy via GitHub (Recommended)

### Step 1: Prepare your code
Your app is ready. Create a GitHub repo:
```bash
cd /home/sud/Desktop/study-helper-ai-main
git init
git add .
git commit -m "Zenius app"
```

### Step 2: Push to GitHub
- Go to https://github.com/new
- Create a new repo named "zenius"
- Push your code:
```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/zenius.git
git push -u origin main
```

### Step 3: Deploy on Vercel
1. Go to https://vercel.com
2. Click "Add New" → "Project"
3. Import your "zenius" repo
4. In Environment Variables, add these from your `.env`:
   - `XAI_API_KEY` = your key
   - `GEMINI_API_KEY` = your key
   - `CEREBRAS_API_KEY` = your key
   - `MISTRAL_API_KEY` = your key
   - `OPENROUTER_API_KEY` = your key
   - `FIREWORKS_API_KEY` = your key
   - `TOGETHER_API_KEY` = your key
   - `HF_API_KEY` = your key
   - `DEEPSEEK_API_KEY` = your key
   - `SERPER_API_KEY` = your key
   - `TTSAI_API_KEY` = your key
   - `STTAI_API_KEY` = your key
5. Click "Deploy"

### Step 4: Get your URL
After deploy, you'll get a URL like: `https://zenius-xxx.vercel.app`

**Paste your Vercel URL here and I'll rebuild the APK to connect to it!**

---

## Option 2: Deploy locally with Vercel CLI

```bash
npm i -g vercel
vercel login
vercel --prod
```

Then provide your deployed URL.