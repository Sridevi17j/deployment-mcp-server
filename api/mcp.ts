// api/mcp.ts - Proper Streamable HTTP MCP Server
import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from "axios";
import { v4 as uuidv4 } from 'uuid';

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
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Session-Id');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({
      message: "🚀 MCP Deployment Server (Streamable HTTP)",
      transport: "Streamable HTTP",
      specification: "2024-11-05",
      tools: ["deploy-vercel", "deploy-render"],
      usage: "Add to Claude Code: claude mcp add deployment-orchestrator https://your-app.vercel.app/api/mcp"
    });
    return;
  }

  if (req.method === 'DELETE') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    try {
      // Get or create session ID
      let sessionId = req.headers['mcp-session-id'] as string;
      if (!sessionId) {
        sessionId = uuidv4();
        res.setHeader('Mcp-Session-Id', sessionId);
      }

      const { method, params, id } = req.body;
      
      if (method === 'initialize') {
        res.status(200).json({
          jsonrpc: "2.0",
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: { listChanged: true }
            },
            serverInfo: {
              name: "deployment-orchestrator",
              version: "1.0.0"
            }
          },
          id
        });
        return;
      }
      
      if (method === 'tools/list') {
        res.status(200).json({
          jsonrpc: "2.0",
          result: {
            tools: [
              {
                name: "deploy-vercel",
                description: "Deploy projects to Vercel",
                inputSchema: {
                  type: "object",
                  properties: {
                    projectName: { type: "string", description: "Vercel project name" },
                    gitRepo: { type: "string", description: "GitHub repository (owner/repo)" },
                    branch: { type: "string", description: "Git branch to deploy", default: "main" }
                  },
                  required: ["projectName"]
                }
              },
              {
                name: "deploy-render",
                description: "Deploy services to Render",
                inputSchema: {
                  type: "object",
                  properties: {
                    serviceId: { type: "string", description: "Render service ID" },
                    serviceName: { type: "string", description: "Service name (if you don't know the ID)" }
                  },
                  required: ["serviceId"]
                }
              }
            ]
          },
          id
        });
        return;
      }
      
      if (method === 'tools/call') {
        const { name, arguments: args } = params;
        
        if (name === 'deploy-vercel') {
          const { projectName, gitRepo, branch = 'main' } = args;
          
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

          res.status(200).json({
            jsonrpc: "2.0",
            result: {
              content: [{ type: "text", text: result }]
            },
            id
          });
          return;
        }
        
        if (name === 'deploy-render') {
          const { serviceId, serviceName } = args;
          
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

          res.status(200).json({
            jsonrpc: "2.0",
            result: {
              content: [{ type: "text", text: result }]
            },
            id
          });
          return;
        }
        
        throw new Error(`Unknown tool: ${name}`);
      }
      
      throw new Error(`Unknown method: ${method}`);
      
    } catch (error: any) {
      console.error("MCP request error:", error);
      res.status(200).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: error.message
        },
        id: req.body?.id || null
      });
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
