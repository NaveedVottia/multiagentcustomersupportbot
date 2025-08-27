# 🏠 Local Development Setup Guide

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/vottia-jp/maestra-demo.git
cd maestra-demo
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
Copy the environment file:
```bash
cp server.env .env.local
```

**Required Environment Variables:**
```bash
# Langfuse (for prompts and tracing)
LANGFUSE_HOST=https://langfuse.demo.dev-maestra.vottia.me
LANGFUSE_PUBLIC_KEY=your_public_key
LANGFUSE_SECRET_KEY=your_secret_key

# Zapier MCP (for external tools)
ZAPIER_MCP_URL=your_zapier_mcp_url
ZAPIER_MCP=your_zapier_mcp_token
```

### 4. Build the Project
```bash
npm run build
```

### 5. Start Local Development Server
```bash
npm run dev
```

**Local Server will run on:** `http://localhost:3000`

## 🔧 Available Scripts

- `npm run dev` - Start development server (port 3000)
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run test` - Run tests

## 🌐 Local Endpoints

- **Health Check:** `GET http://localhost:3000/health`
- **Main Orchestrator:** `POST http://localhost:3000/api/agents/repair-workflow-orchestrator/stream`
- **Individual Agents:**
  - `POST http://localhost:3000/api/agents/customerIdentification/stream`
  - `POST http://localhost:3000/api/agents/productSelection/stream`
  - `POST http://localhost:3000/api/agents/issueAnalysis/stream`
  - `POST http://localhost:3000/api/agents/visitConfirmation/stream`

## 🧪 Testing Locally

### Test Health Endpoint
```bash
curl http://localhost:3000/health
```

### Test Main Orchestrator
```bash
curl -X POST http://localhost:3000/api/agents/repair-workflow-orchestrator/stream \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello, I need help with a coffee machine repair"}]}'
```

## 📁 Project Structure

```
src/
├── mastra/
│   ├── agents/sanden/          # AI agents
│   ├── tools/sanden/           # Tool definitions
│   ├── workflows/sanden/       # Workflow definitions
│   └── prompts/langfuse.ts     # Prompt loading
├── integrations/
│   ├── langfuse.ts             # Langfuse client
│   └── zapier-mcp.ts           # Zapier MCP client
├── types/
│   └── mastra.d.ts             # Type declarations
└── mastra-server.ts            # Express server
```

## 🔑 Key Features

- **Mastra Framework:** AI agent orchestration
- **Langfuse Integration:** Prompt management and tracing
- **Zapier MCP:** External tool integration
- **Google Sheets:** Database backend
- **Streaming Responses:** Real-time AI responses
- **TypeScript:** Full type safety

## 🚨 Troubleshooting

### Port Already in Use
```bash
# Kill processes on port 3000
sudo lsof -ti:3000 | xargs kill -9
```

### Environment Variables Not Loading
```bash
# Check if .env.local exists
ls -la .env.local

# Verify environment variables
node -e "console.log(process.env.LANGFUSE_HOST)"
```

### Build Errors
```bash
# Clean and rebuild
rm -rf dist/ node_modules/
npm install
npm run build
```

## 🔄 Development Workflow

1. **Make Changes** in `src/` directory
2. **Auto-rebuild** happens with `tsx watch`
3. **Test endpoints** with curl or Postman
4. **Check logs** in terminal output
5. **Commit changes** when ready

## 📡 Remote vs Local

- **Remote (Lightsail):** Port 80, production demo - **ALWAYS RUNNING**
- **Local:** Port 3000, development
- **Environment:** Use `.env.local` for local secrets
- **Database:** Same Google Sheets (via Zapier MCP)

## 🚀 Remote Server Management

The server on Lightsail is configured to run consistently in the background:

**Server Status:** Always running on port 80
**Health Check:** `http://54.150.79.178:80/health`
**Demo UI:** `https://mastra.demo.dev-maestra.vottia.me`

**Remote Management Commands:**
```bash
# Check server status
./start-server.sh

# View server logs
tail -f /tmp/mastra-server.log

# Restart server if needed
sudo pkill -f "npm run dev" && ./start-server.sh
```

**Why Keep Remote Running?**
- Demo UI stays accessible during development
- No interruption to external users
- Easy testing of production-like environment
- Consistent database connections

---

**Happy Coding! 🎉**
