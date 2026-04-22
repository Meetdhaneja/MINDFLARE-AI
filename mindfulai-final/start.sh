#!/bin/bash
set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BLUE}  MindfulAI - Starting up${NC}"
echo ""

if ! command -v docker &> /dev/null; then
    echo -e "${RED}  Docker not found. Install Docker first.${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null 2>&1; then
    echo -e "${RED}  Docker Compose not found${NC}"
    exit 1
fi

echo -e "${GREEN}  Docker found${NC}"

if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}  backend/.env not found - copy your API keys there.${NC}"
fi

if docker compose version &> /dev/null 2>&1; then
    COMPOSE="docker compose"
else
    COMPOSE="docker-compose"
fi

$COMPOSE up --build -d

echo ""
echo -e "${GREEN}  MindfulAI is running!${NC}"
echo -e "  Frontend: http://localhost:3000"
echo -e "  API: http://localhost:8000"
echo -e "  Docs: http://localhost:8000/docs"
echo ""
