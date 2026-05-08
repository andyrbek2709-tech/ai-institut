#!/bin/bash

set -e

echo "Starting Development Environment..."
echo "===================================="

# Check if .env files exist
if [ ! -f "services/calculation-engine/.env" ]; then
    echo "Creating backend .env from example..."
    cp services/calculation-engine/.env.example services/calculation-engine/.env
fi

if [ ! -f "apps/calculations-platform/.env" ]; then
    echo "Creating frontend .env from example..."
    cp apps/calculations-platform/.env.example apps/calculations-platform/.env
fi

# Install backend dependencies
echo "Installing backend dependencies..."
cd services/calculation-engine
pip install -e ".[dev]"
cd ../..

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd apps/calculations-platform
npm install
cd ../..

echo ""
echo "Development environment ready!"
echo ""
echo "To start the backend:"
echo "  cd services/calculation-engine && python app/main.py"
echo ""
echo "To start the frontend:"
echo "  cd apps/calculations-platform && npm run dev"
echo ""
echo "Or use docker-compose:"
echo "  docker-compose up"
