#!/bin/bash

# Clean install script for TrafficSlight
echo "🧹 Cleaning previous installations..."

# Remove node_modules and lock files
rm -rf node_modules
rm -f package-lock.json
rm -f yarn.lock

# Clear npm cache
npm cache clean --force

echo "📦 Installing dependencies with retry logic..."

# Install with retry logic
max_attempts=3
attempt=1

while [ $attempt -le $max_attempts ]; do
    echo "Attempt $attempt of $max_attempts..."
    
    if npm install --no-audit --no-fund; then
        echo "✅ Dependencies installed successfully!"
        break
    else
        echo "❌ Installation failed on attempt $attempt"
        
        if [ $attempt -lt $max_attempts ]; then
            echo "⏳ Waiting 10 seconds before retry..."
            sleep 10
        else
            echo "💥 All installation attempts failed"
            exit 1
        fi
    fi
    
    attempt=$((attempt + 1))
done

echo "🎉 Clean install completed!"












