# Deployment Guide for Throtow

## Prerequisites

- GitHub account with repo pushed
- Vercel account (free tier works)
- Supabase project (free tier works)
- Environment variables ready

---

## Step 1: Get Supabase Credentials

1. Go to [supabase.com](https://supabase.com) → Login
2. Select your project → **Settings** → **API**
3. Copy:
   - **URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
4. Save these securely (you'll need them for Vercel)

---

## Step 2: Local Setup (Dev/Testing)

1. **Copy environment template:**
   ```bash
   cp app/.env.example app/.env.local
   ```

2. **Fill in your Supabase credentials:**
   ```bash
   # Edit app/.env.local
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=xxxx
   ```

3. **Test locally:**
   ```bash
   npm run dev
   # Opens http://localhost:5174
   ```

4. **Verify environment is loaded:**
   ```bash
   npm run check-env --prefix app
   ```

---

## Step 3: Push to GitHub

```bash
# Make sure .env.local is in .gitignore (it should be)
git add .
git commit -m "Deploy: setup environment and deployment scripts"
git push origin main
```

---

## Step 4: Deploy to Vercel

### Option A: Via Vercel Dashboard (Recommended)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import** → Select your GitHub repo
3. **Configure Project:**
   - **Framework Preset:** Vite
   - **Root Directory:** (leave as default)
   - **Build Command:** `npm run build`
   - **Output Directory:** `app/dist`
   - **Install Command:** `npm install`

4. **Add Environment Variables:**
   - Click **Environment Variables**
   - Add:
     - Key: `VITE_SUPABASE_URL` → Value: (your URL)
     - Key: `VITE_SUPABASE_ANON_KEY` → Value: (your key)
     - (Optional) `VITE_SUPABASE_FUNCTIONS_URL` if different from default
     - (Optional) `VITE_MAP_DEFAULT_LAT` and `VITE_MAP_DEFAULT_LNG`

5. Click **Deploy**
6. Wait 2-5 minutes for build to complete
7. Visit your deployed URL (e.g., `https://throtow.vercel.app`)

### Option B: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod

# During setup, select:
# - Framework: Vite
# - Build Command: npm run build
# - Output Directory: app/dist
# - Environment Variables: Add your Supabase credentials
```

---

## Step 5: Verify Deployment

After deployment completes:

1. **Check if app loads:** Visit your Vercel URL
2. **Check console for errors:** Open browser DevTools (F12)
3. **Check Vercel logs:**
   - Go to your Vercel project → **Deployments**
   - Click latest deployment → **Logs**
   - Look for errors or warnings

---

## Troubleshooting

### Build fails with "Missing environment variable"

**Solution:** Check Vercel dashboard:
- **Settings** → **Environment Variables**
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
- Redeploy after adding variables

### Build succeeds but app shows blank page

**Possible causes:**
1. Environment variables not passed to client build
2. Check browser console (F12 → Console tab)
3. Go back to Vercel and redeploy

### "Cannot find module" errors

1. Check `app/package.json` - all dependencies installed?
2. Run locally: `npm run dev` - does it work?
3. Check Vercel build logs for missing packages

### App loads but Supabase not connecting

**Solution:**
1. Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct
2. Check Supabase project is active
3. Check browser console for specific errors

---

## Continuous Deployment

Once deployed, every push to `main` automatically triggers:
1. **Install:** `npm install`
2. **Build:** `npm run build`
3. **Deploy:** Latest `app/dist` folder
4. **Monitor:** Check Vercel dashboard → Deployments

---

## Environment Variables Reference

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `VITE_SUPABASE_URL` | ✅ Yes | `https://abc123.supabase.co` | From Supabase Settings |
| `VITE_SUPABASE_ANON_KEY` | ✅ Yes | `eyJ0...` | From Supabase Settings → API |
| `VITE_SUPABASE_FUNCTIONS_URL` | ❌ No | `https://abc123.supabase.co/functions/v1` | Auto-generated if not set |
| `VITE_MAP_DEFAULT_LAT` | ❌ No | `-1.286389` | Defaults to Nairobi |
| `VITE_MAP_DEFAULT_LNG` | ❌ No | `36.817223` | Defaults to Nairobi |

---

## Quick Commands

```bash
# Local development
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Verify environment variables are correct
npm run check-env --prefix app

# Type checking (if eslint installed)
npm run type-check --prefix app
```

---

## Need Help?

- **Vercel Docs:** https://vercel.com/docs
- **Supabase Docs:** https://supabase.com/docs
- **Vite Docs:** https://vite.dev
