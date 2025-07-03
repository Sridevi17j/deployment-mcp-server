# Deployment Orchestrator MCP Server

A Model Context Protocol server for multi-platform deployment orchestration. Deploy to Vercel and Render with simple prompts!

## Features

### Tools
- `deploy-vercel` - Deploy projects to Vercel
- `deploy-render` - Deploy services to Render  
- `check-deployment-status` - Check deployment status on any platform
- `list-services` - List available services/projects

### Prompts  
- `deploy-application` - Smart deployment with natural language
- `deployment-dashboard` - Overview of all services

## Quick Setup

1. **Install dependencies:**
```bash
cd C:\Users\sride\Desktop\deployment-mcp-server
npm install
```

2. **Get API tokens:**

**Vercel Token:**
- Go to Vercel Dashboard → Settings → Tokens
- Create new token
- Copy the token

**Render Token:**
- Go to Render Dashboard → Account Settings → API Keys
- Create new key
- Copy the token

3. **Set environment variables:**
```bash
# Copy the example
copy .env.example .env

# Edit .env with your tokens
VERCEL_TOKEN=your_actual_vercel_token
RENDER_TOKEN=your_actual_render_token
PORT=3000
```

4. **Build and run:**
```bash
npm run build
npm start

# Or for development
npm run dev
```

## Usage with Claude Code

### Add MCP Server
```bash
claude mcp add deployment-orchestrator http://localhost:3000/mcp
```

### Use Tools Directly
```bash
# Deploy to Vercel
/deployment-orchestrator:deploy-vercel projectName="my-app"

# Deploy to Render
/deployment-orchestrator:deploy-render serviceName="my-api"

# Check status
/deployment-orchestrator:check-deployment-status platform="vercel" id="deployment-id"
```

### Use Smart Prompts
```bash
# Natural language deployment
@deployment-orchestrator:deploy-application request="deploy my-frontend to vercel"

# Get dashboard
@deployment-orchestrator:deployment-dashboard
```

## Example Usage

**Deploy with prompt:**
```
User: "Deploy my React app to Vercel"
Claude: *Uses deploy-vercel tool automatically*
Response: ✅ Deployment started! URL: https://my-app-xyz.vercel.app
```

**Check status:**
```
User: "Check my deployment status"  
Claude: *Uses check-deployment-status tool*
Response: 📊 Status: READY ✅ Deployment is LIVE!
```

## API Endpoints

- **Streamable HTTP:** `http://localhost:3000/mcp`
- **Legacy SSE:** `http://localhost:3000/sse`  
- **Health Check:** `http://localhost:3000/health`

## What This Solves

✅ **One interface for multiple platforms** (Vercel + Render)
✅ **Natural language deployment** ("deploy to vercel")  
✅ **Real-time status checking** with URLs
✅ **Cross-platform service management**
✅ **Streamable HTTP support** for modern MCP clients

No more switching between dashboards - deploy everything from Claude Code!
