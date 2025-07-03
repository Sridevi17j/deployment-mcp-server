# Deploy MCP Server to Vercel

## Step-by-Step Deployment

### 1. Create GitHub Repository
```bash
cd C:\Users\sride\Desktop\deployment-mcp-server

# Initialize git (if not done)
git init

# Add all files
git add .
git commit -m "Initial commit - MCP Deployment Server"

# Create GitHub repo and push
# Go to GitHub.com → Create new repository → "deployment-mcp-server"
git remote add origin https://github.com/YOUR_USERNAME/deployment-mcp-server.git
git branch -M main
git push -u origin main
```

### 2. Deploy to Vercel

**Option A: Vercel Dashboard (Recommended)**
1. Go to https://vercel.com/dashboard
2. Click "New Project"
3. Import from GitHub → Select "deployment-mcp-server"
4. Configure:
   - **Framework Preset:** Other
   - **Root Directory:** `./`
   - **Build Command:** Leave empty
   - **Output Directory:** Leave empty
   - **Install Command:** `npm install`

**Option B: Vercel CLI**
```bash
npm install -g vercel
vercel login
vercel --prod
```

### 3. Set Environment Variables in Vercel
After deployment, go to Vercel Dashboard:
1. Select your project
2. Go to Settings → Environment Variables
3. Add:
   - `VERCEL_TOKEN` = your_vercel_token
   - `RENDER_TOKEN` = your_render_token

### 4. Get Your MCP Server URL
After deployment, you'll get a URL like:
`https://deployment-mcp-server.vercel.app`

### 5. Add to Claude Code
```bash
claude mcp add deployment-orchestrator https://deployment-mcp-server.vercel.app/mcp
```

### 6. Test the Deployment
```bash
# Test health endpoint
curl https://deployment-mcp-server.vercel.app/health

# Use with Claude Code
@deployment-orchestrator:deployment-dashboard
```

## Important Notes

✅ **Vercel automatically handles:**
- HTTPS certificates
- Global CDN
- Automatic scaling
- Serverless functions

✅ **Your MCP server endpoints:**
- Streamable HTTP: `https://your-app.vercel.app/mcp`
- Health check: `https://your-app.vercel.app/health`

⚠️ **Remember:**
- Set environment variables in Vercel dashboard
- Your API tokens (VERCEL_TOKEN, RENDER_TOKEN) are needed for the server to work
- Test locally first if you want: `npm run dev`

## Troubleshooting

**If deployment fails:**
1. Check build logs in Vercel dashboard
2. Ensure all dependencies are in package.json
3. Verify vercel.json configuration
4. Check environment variables are set

**If MCP connection fails:**
1. Test health endpoint: `curl https://your-app.vercel.app/health`
2. Check environment variables are set
3. Verify API tokens are valid
