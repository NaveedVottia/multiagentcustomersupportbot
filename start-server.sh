#!/bin/bash

# 🚀 Mastra Server Management Script
# This script ensures the server runs consistently in the background

echo "🔍 Checking server status..."

# Check if server is already running
if pgrep -f "npm run dev" > /dev/null; then
    echo "✅ Server is already running"
    ps aux | grep "npm run dev" | grep -v grep
else
    echo "🚀 Starting server in background..."
    
    # Kill any existing processes
    sudo pkill -f "npm run dev" 2>/dev/null
    sudo pkill -f "tsx watch" 2>/dev/null
    
    # Start server in background with logging
    cd /home/ec2-user/sanden-repair-system
    sudo -E npm run dev > /tmp/mastra-server.log 2>&1 &
    
    # Wait for startup
    echo "⏳ Waiting for server to start..."
    sleep 10
    
    # Check status
    if curl -s http://localhost:80/health > /dev/null; then
        echo "✅ Server started successfully!"
        echo "🌐 Health endpoint: http://localhost:80/health"
        echo "📝 Logs: tail -f /tmp/mastra-server.log"
    else
        echo "❌ Server failed to start. Check logs:"
        tail -20 /tmp/mastra-server.log
    fi
fi

echo ""
echo "📋 Server Management Commands:"
echo "  Check status:  ./start-server.sh"
echo "  View logs:     tail -f /tmp/mastra-server.log"
echo "  Stop server:   sudo pkill -f 'npm run dev'"
echo "  Test health:   curl http://localhost:80/health"
