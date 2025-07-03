// server.ts
import express from "express";
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
      return response.data[0]; // Latest deployment
    } catch (error: any) {
      throw new Error(`Failed to get Render deployment status: ${error.message}`);
    }
  }
}

// 🛠️ Tool: Deploy to Vercel
server.tool(
  "deploy-vercel",
  { 
    projectName: z.string().describe("Vercel project name"),
    gitRepo: z.string().optional().describe("GitHub repository (owner/repo)"),
    branch: z.string().default("main").describe("Git branch to deploy")
  },
  async ({ projectName, gitRepo, branch }) => {
    console.log(`🚀 Deploying ${projectName} to Vercel from ${branch} branch`);
    
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
      result += `⏱️ Check status with: /deployment-orchestrator:check-deployment-status platform="vercel" id="${deployment.id}"`;

      return {
        content: [{ type: "text", text: result }]
      };
      
    } catch (error: any) {
      console.error("Vercel deployment error:", error.message);
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
    console.log(`🚀 Deploying to Render service: ${serviceId || serviceName}`);
    
    try {
      const renderToken = process.env.RENDER_TOKEN;
      if (!renderToken) {
        throw new Error("RENDER_TOKEN environment variable is required");
      }

      const render = new RenderAPI(renderToken);
      
      let actualServiceId = serviceId;
      
      // If serviceName provided but no serviceId, find the service
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
      result += `🕐 Created: ${new Date(deployment.createdAt).toLocaleString()}\n\n`;
      result += `⏱️ Check status with: /deployment-orchestrator:check-deployment-status platform="render" id="${actualServiceId}"`;

      return {
        content: [{ type: "text", text: result }]
      };
      
    } catch (error: any) {
      console.error("Render deployment error:", error.message);
      return {
        content: [{ type: "text", text: `❌ Render deployment failed: ${error.message}` }]
      };
    }
  }
);

// 🛠️ Tool: Check Deployment Status
server.tool(
  "check-deployment-status",
  { 
    platform: z.enum(["vercel", "render"]).describe("Deployment platform"),
    id: z.string().describe("Deployment ID or Service ID")
  },
  async ({ platform, id }) => {
    console.log(`📊 Checking ${platform} deployment status for: ${id}`);
    
    try {
      let result = `📊 Deployment Status - ${platform.toUpperCase()}\n\n`;
      
      if (platform === "vercel") {
        const vercelToken = process.env.VERCEL_TOKEN;
        if (!vercelToken) {
          throw new Error("VERCEL_TOKEN environment variable is required");
        }

        const vercel = new VercelAPI(vercelToken);
        const deployment = await vercel.getDeploymentStatus(id);
        
        result += `🆔 Deployment ID: ${deployment.id}\n`;
        result += `🔗 URL: https://${deployment.url}\n`;
        result += `📊 Status: ${deployment.readyState}\n`;
        result += `🌟 Target: ${deployment.target}\n`;
        result += `🕐 Created: ${new Date(deployment.createdAt).toLocaleString()}\n`;
        
        if (deployment.readyState === 'READY') {
          result += `\n✅ Deployment is LIVE and ready!`;
        } else if (deployment.readyState === 'ERROR') {
          result += `\n❌ Deployment failed`;
        } else {
          result += `\n⏳ Deployment is still in progress...`;
        }
        
      } else if (platform === "render") {
        const renderToken = process.env.RENDER_TOKEN;
        if (!renderToken) {
          throw new Error("RENDER_TOKEN environment variable is required");
        }

        const render = new RenderAPI(renderToken);
        const deployment = await render.getDeploymentStatus(id);
        
        result += `🆔 Deployment ID: ${deployment.id}\n`;
        result += `🔗 Service ID: ${id}\n`;
        result += `📊 Status: ${deployment.status}\n`;
        result += `🌍 Type: ${deployment.type}\n`;
        result += `🕐 Created: ${new Date(deployment.createdAt).toLocaleString()}\n`;
        
        if (deployment.finishedAt) {
          result += `🏁 Finished: ${new Date(deployment.finishedAt).toLocaleString()}\n`;
        }
        
        if (deployment.status === 'live') {
          result += `\n✅ Deployment is LIVE and ready!`;
        } else if (deployment.status === 'build_failed' || deployment.status === 'update_failed') {
          result += `\n❌ Deployment failed`;
        } else {
          result += `\n⏳ Deployment is still in progress...`;
        }
      }

      return {
        content: [{ type: "text", text: result }]
      };
      
    } catch (error: any) {
      console.error("Status check error:", error.message);
      return {
        content: [{ type: "text", text: `❌ Failed to check deployment status: ${error.message}` }]
      };
    }
  }
);

// 🛠️ Tool: List Services/Projects
server.tool(
  "list-services",
  { 
    platform: z.enum(["vercel", "render"]).describe("Platform to list services from")
  },
  async ({ platform }) => {
    console.log(`📋 Listing services from ${platform}`);
    
    try {
      let result = `📋 Available Services - ${platform.toUpperCase()}\n\n`;
      
      if (platform === "render") {
        const renderToken = process.env.RENDER_TOKEN;
        if (!renderToken) {
          throw new Error("RENDER_TOKEN environment variable is required");
        }

        const render = new RenderAPI(renderToken);
        const services = await render.getServices();
        
        services.forEach((service: any, index: number) => {
          result += `${index + 1}. 📦 ${service.name}\n`;
          result += `   🆔 ID: ${service.id}\n`;
          result += `   🔗 Type: ${service.type}\n`;
          result += `   📊 Status: ${service.serviceDetails?.buildCommand ? 'Has build' : 'Static'}\n\n`;
        });
        
      } else {
        result += `⚠️ Vercel project listing requires additional setup.\n`;
        result += `Use project name directly with deploy-vercel tool.`;
      }

      return {
        content: [{ type: "text", text: result }]
      };
      
    } catch (error: any) {
      console.error("List services error:", error.message);
      return {
        content: [{ type: "text", text: `❌ Failed to list services: ${error.message}` }]
      };
    }
  }
);

// 📝 Prompt: Deploy Application
server.registerPrompt(
  "deploy-application",
  {
    title: "Deploy Application",
    description: "Deploy application to specified platform with intelligent routing",
    argsSchema: { 
      request: z.string().describe("Deployment request (e.g., 'deploy my-app to vercel', 'deploy to render service my-api')")
    }
  },
  ({ request }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Process this deployment request: "${request}". 

Analyze the request and use the appropriate deployment tools:
- For Vercel: Use deploy-vercel tool with project name
- For Render: Use deploy-render tool with service ID or name
- After deployment, automatically check status
- Provide the deployment URL and status

Available tools:
- deploy-vercel (projectName, gitRepo?, branch?)
- deploy-render (serviceId, serviceName?)
- check-deployment-status (platform, id)
- list-services (platform)

Be smart about parsing the request and extracting the right parameters.`
      }
    }]
  })
);

// 📝 Prompt: Deployment Status Dashboard
server.registerPrompt(
  "deployment-dashboard",
  {
    title: "Deployment Status Dashboard",
    description: "Get comprehensive deployment status across platforms",
    argsSchema: {}
  },
  () => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Create a deployment status dashboard. List all available services from both Vercel and Render platforms, show their current status, and provide quick deployment options.

Use these tools:
- list-services for both "vercel" and "render"
- Organize the information in a clear, readable format
- Provide quick deployment commands for each service`
      }
    }]
  })
);

// Express + SSE setup for Streamable HTTP
const app = express();
app.use(express.json());

const transports: { [sessionId: string]: SSEServerTransport } = {};

// Create custom transport class with logging
class LoggingSSEServerTransport extends SSEServerTransport {
  async handlePostMessage(req: any, res: any) {
    const bodyData: any[] = [];
    
    req.on('data', (chunk: any) => {
      bodyData.push(chunk);
    });
    
    req.on('end', () => {
      try {
        const bodyBuffer = Buffer.concat(bodyData);
        const bodyStr = bodyBuffer.toString('utf8');
        const message = JSON.parse(bodyStr);
        
        if (message.method === "tools/call" && message.params && message.params.name) {
          console.log("🔧 Tool call detected:", message.params.name);
        }
        
        if (message.method === "prompts/get" && message.params && message.params.name) {
          console.log("📝 Prompt call detected:", message.params.name);
        }
      } catch (e) {
        // Ignore parsing errors
      }
    });
    
    return super.handlePostMessage(req, res);
  }
}

// Streamable HTTP endpoint
app.post("/mcp", async (req, res) => {
  console.log("📡 Streamable HTTP request received");
  
  try {
    // Handle as single HTTP request for Streamable HTTP transport
    const transport = new LoggingSSEServerTransport("/mcp", res);
    await server.connect(transport);
    await transport.handlePostMessage(req, res);
  } catch (error) {
    console.error("❌ Error handling Streamable HTTP request:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Legacy SSE support for backward compatibility
app.get("/sse", async (req, res) => {
  const transport = new LoggingSSEServerTransport("/messages", res);
  transports[transport.sessionId] = transport;
  console.log("🔗 SSE session started:", transport.sessionId);
  
  res.on("close", () => {
    console.log("SSE session closed:", transport.sessionId);
    delete transports[transport.sessionId];
  });
  
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports[sessionId];
  
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send("No transport found for sessionId");
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    service: "deployment-orchestrator",
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Deployment Orchestrator MCP Server running on port ${PORT}`);
  console.log(`📊 Streamable HTTP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`📡 Legacy SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
  console.log(`\n🔧 Environment setup required:`);
  console.log(`   export VERCEL_TOKEN=your_vercel_token`);
  console.log(`   export RENDER_TOKEN=your_render_token`);
});
