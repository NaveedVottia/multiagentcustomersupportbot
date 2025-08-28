#!/bin/bash

# 🚀 Deploy Updated Code to Remote Server
# This script helps deploy your local changes to the remote server

echo "🚀 Starting deployment to remote server..."

# Configuration
REMOTE_HOST="54.150.79.178"
REMOTE_USER="ec2-user"
REMOTE_DIR="/home/ec2-user/sanden-repair-system"
LOCAL_DIR="."

echo "📋 Deployment Plan:"
echo "  Remote Host: $REMOTE_HOST"
echo "  Remote User: $REMOTE_USER"
echo "  Remote Dir:  $REMOTE_DIR"
echo "  Local Dir:   $LOCAL_DIR"
echo ""

# Check if we can connect
echo "🔍 Testing SSH connection..."
if ssh -o ConnectTimeout=10 -o BatchMode=yes $REMOTE_USER@$REMOTE_HOST "echo 'SSH connection successful'" 2>/dev/null; then
    echo "✅ SSH connection successful"
else
    echo "❌ SSH connection failed. Please ensure:"
    echo "  1. SSH key is properly configured"
    echo "  2. Remote server is accessible"
    echo "  3. User has proper permissions"
    echo ""
    echo "💡 To set up SSH access:"
    echo "  ssh-keygen -t rsa -b 4096 -C 'your-email@example.com'"
    echo "  ssh-copy-id $REMOTE_USER@$REMOTE_HOST"
    echo ""
    exit 1
fi

# Create backup of remote code
echo "💾 Creating backup of remote code..."
ssh $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_DIR && tar -czf backup-$(date +%Y%m%d-%H%M%S).tar.gz . --exclude=node_modules --exclude=.git --exclude=backup-*.tar.gz"

# Stop the remote server
echo "⏹️  Stopping remote server..."
ssh $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_DIR && sudo pkill -f 'npm run dev' || true"

# Sync code (excluding node_modules and .git)
echo "📤 Syncing code to remote server..."
rsync -avz --delete \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=backup-*.tar.gz \
    --exclude=.env.local \
    --exclude=dist \
    $LOCAL_DIR/ $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/

# Install dependencies on remote
echo "📦 Installing dependencies on remote server..."
ssh $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_DIR && npm install"

# Build the project on remote
echo "🔨 Building project on remote server..."
ssh $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_DIR && npm run build"

# Start the remote server
echo "🚀 Starting remote server..."
ssh $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_DIR && ./start-server.sh"

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 15

# Test the deployment
echo "🧪 Testing deployment..."
if ssh $REMOTE_USER@$REMOTE_HOST "curl -s http://localhost:80/health" | grep -q "ok"; then
    echo "✅ Deployment successful!"
    echo "🌐 Server is running at: http://$REMOTE_HOST:80"
    echo "🔍 Health check: http://$REMOTE_HOST:80/health"
    echo "📝 View logs: ssh $REMOTE_USER@$REMOTE_HOST 'tail -f /tmp/mastra-server.log'"
else
    echo "❌ Deployment failed. Server health check failed."
    echo "📝 Check logs: ssh $REMOTE_USER@$REMOTE_HOST 'tail -20 /tmp/mastra-server.log'"
    exit 1
fi

echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📋 Next Steps:"
echo "  1. Upload your new prompts to Langfuse"
echo "  2. Test the complete workflow"
echo "  3. Verify Zapier MCP integration"
echo ""
echo "🔗 Useful Commands:"
echo "  Test health:     curl http://$REMOTE_HOST:80/health"
echo "  View logs:       ssh $REMOTE_USER@$REMOTE_HOST 'tail -f /tmp/mastra-server.log'"
echo "  Test workflow:   curl -X POST http://$REMOTE_HOST:80/api/agents/repair-workflow-orchestrator/stream -H 'Content-Type: application/json' -d '{\"messages\":[{\"role\":\"user\",\"content\":\"Hello, I need help with a coffee machine repair\"}]}'"
