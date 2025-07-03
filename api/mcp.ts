// api/mcp.ts - Vercel Serverless Function
import { VercelRequest, VercelResponse } from '@vercel/node';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import axios from "axios";

// Create an MCP server
const server = new McpServer({
  name: "deployment-orchestrator",
  version: "1.0.0"
});

// Vercel API client
class VercelAPI {
  private token: string;
  private baseURL = 'https://api.vercel.com';

  constructor(token: string) {
    this.token = token;
  }

  async createDeployment(projectName: string, gitSource?: any) {
    try {
      const response = await axios.post(
        `${this.baseURL}/v13/deployments`,
        {
          name: projectName,
          target: 'production',
          gitSource: gitSource || {
            type: 'github',
            ref: 'main'
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(`Vercel deployment failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async getDeploymentStatus(deploymentId: string) {
    try {
      const response = await axios.get(
        `${this.baseURL}/v6/deployments/${deploymentId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get Vercel deployment status: ${error.message}`);
    }
  }
}

// Render API client
class RenderAPI {
  private token: string;
  private baseURL = 'https://api.render.com/v1';

  constructor(token: string) {
    this.token = token;
  }

  async triggerDeployment(serviceId: string) {
    try {
      const response = await axios.post(
        `${this.baseURL}/services/${serviceId}/deploys`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(`Render deployment failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async getServices() {
    try {
      const response = await axios.get(
        `${this.baseURL}/services`,
        {
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get Render services: ${error.message}`);
    }
  }

  async getDeploymentStatus(serviceId: string) {
    try {
      const response = await axios.get(
        `${this.baseURL}/services/${serviceId}/deploys`,
        {
          headers: {
            'Authorization': `Bearer ${this.token}`
          },
          params: {
            limit: 1
          }
        }
      );
      return response.data[0];
    } catch (error: any) {
      throw new Error(`Failed to get Render deployment status: ${error.message}`);
    }
  }
}

// Initialize MCP Tools
const initializeMCPServer = () => {
  // 🛠️ Tool: Deploy to Vercel
  server.tool(
    "deploy-vercel",
    { 
      projectName: z.string().describe("Vercel project name"),
      gitRepo: z.string().optional().describe("GitHub repository (owner/repo)"),
      branch: z.string().default("main").describe("Git branch to deploy")
    },
    async ({ projectName, gitRepo, branch }) => {
      try {
        const vercelToken = process.env.VERCEL_TOKEN;
        if (!vercelToken) {
          throw new Error("VERCEL_TOKEN environment variable is required");
        }

        const vercel = new VercelAPI(vercelToken);
        
        const gitSource = gitRepo ? {
          type: 'github',
          repo: gitRepo,
          ref: branch
        } : undefined;

        const deployment = await vercel.createDeployment(projectName, gitSource);
        
        let result = `✅ Vercel deployment started!\n\n`;
        result += `🆔 Deployment ID: ${deployment.id}\n`;
        result += `🔗 URL: https://${deployment.url}\n`;
        result += `📊 Status: ${deployment.readyState || 'BUILDING'}\n`;
        result += `🌟 Target: ${deployment.target}\n\n`;
        result += `⏱️ Check status with deployment ID: ${deployment.id}`;

        return {
          content: [{ type: "text", text: result }]
        };
        
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `❌ Vercel deployment failed: ${error.message}` }]
        };
      }
    }
  );

  // 🛠️ Tool: Deploy to Render
  server.tool(
    "deploy-render",
    { 
      serviceId: z.string().describe("Render service ID"),
      serviceName: z.string().optional().describe("Service name (if you don't know the ID)")
    },
    async ({ serviceId, serviceName }) => {
      try {
        const renderToken = process.env.RENDER_TOKEN;
        if (!renderToken) {
          throw new Error("RENDER_TOKEN environment variable is required");
        }

        const render = new RenderAPI(renderToken);
        
        let actualServiceId = serviceId;
        
        if (!serviceId && serviceName) {
          const services = await render.getServices();
          const service = services.find((s: any) => s.name === serviceName);
          if (!service) {
            throw new Error(`Service "${serviceName}" not found`);
          }
          actualServiceId = service.id;
        }

        const deployment = await render.triggerDeployment(actualServiceId);
        
        let result = `✅ Render deployment started!\n\n`;
        result += `🆔 Deployment ID: ${deployment.id}\n`;
        result += `🔗 Service ID: ${actualServiceId}\n`;
        result += `📊 Status: ${deployment.status}\n`;
        result += `🕐 Created: ${new Date(deployment.createdAt).toLocaleString()}\n`;

        return {
          content: [{ type: "text", text: result }]
        };
        
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `❌ Render deployment failed: ${error.message}` }]
        };
      }
    }
  );

  // 📝 Prompt: Deploy Application
  server.registerPrompt(
    "deploy-application",
    {
      title: "Deploy Application",
      description: "Deploy application to specified platform",
      argsSchema: { 
        request: z.string().describe("Deployment request")
      }
    },
    ({ request }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Process this deployment request: "${request}". Use the appropriate deployment tools based on the platform mentioned.`
        }
      }]
    })
  );
};

// Initialize the server
initializeMCPServer();

// Custom transport for serverless
class ServerlessSSETransport extends SSEServerTransport {
  private response: VercelResponse;
  
  constructor(response: VercelResponse) {
    super("/mcp", response);
    this.response = response;
  }

  async handlePostMessage(req: VercelRequest, res: VercelResponse) {
    try {
      // Handle MCP request
      return await super.handlePostMessage(req as any, res as any);
    } catch (error) {
      console.error("MCP request error:", error);
      res.status(500).json({ error: "MCP request failed" });
    }
  }
}

// Vercel serverless function handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    // Browser-friendly response
    res.status(200).json({
      message: "🚀 MCP Deployment Server is running!",
      transport: "Streamable HTTP",
      endpoints: {
        "Streamable HTTP": "POST /api/mcp",
        "Health Check": "GET /api/health"
      },
      tools: [
        "deploy-vercel",
        "deploy-render"
      ],
      prompts: [
        "deploy-application"
      ],
      usage: "Add to Claude Code: claude mcp add deployment-orchestrator https://your-app.vercel.app/api/mcp"
    });
    return;
  }

  if (req.method === 'POST') {
    try {
      // Handle MCP Streamable HTTP request
      const transport = new ServerlessSSETransport(res);
      await server.connect(transport);
      await transport.handlePostMessage(req, res);
    } catch (error) {
      console.error("Serverless MCP error:", error);
      res.status(500).json({ 
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
