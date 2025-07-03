// api/health.ts - Health check endpoint
import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    status: "healthy",
    service: "deployment-orchestrator",
    timestamp: new Date().toISOString(),
    environment: {
      vercel_token: process.env.VERCEL_TOKEN ? "✅ Set" : "❌ Missing",
      render_token: process.env.RENDER_TOKEN ? "✅ Set" : "❌ Missing"
    }
  });
}
