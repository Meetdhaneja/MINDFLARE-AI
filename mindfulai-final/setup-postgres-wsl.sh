#!/bin/bash
# PostgreSQL Setup Script for WSL Ubuntu
# Run this script inside WSL Ubuntu to set up PostgreSQL

set -e

echo "================================"
echo "PostgreSQL Setup for MindfulAI"
echo "================================"

echo "Updating package manager..."
sudo apt-get update -y > /dev/null 2>&1

echo "Installing PostgreSQL..."
sudo apt-get install -y postgresql postgresql-contrib > /dev/null 2>&1

echo "Starting PostgreSQL service..."
sudo service postgresql start

sleep 3

echo "Creating MindfulAI database and user..."
sudo -u postgres psql -c "CREATE USER mindful WITH ENCRYPTED PASSWORD 'mindful123';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE mindfulai OWNER mindful;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE mindfulai TO mindful;" 2>/dev/null || true
sudo -u postgres psql -c "ALTER SYSTEM SET listen_addresses = '*';" 2>/dev/null || true

echo "host    mindfulai    mindful    127.0.0.1/32    md5" | sudo tee -a /etc/postgresql/*/main/pg_hba.conf > /dev/null 2>&1 || true

echo "Restarting PostgreSQL..."
sudo service postgresql restart

echo "Verifying PostgreSQL connection..."
psql -h localhost -U mindful -d mindfulai -c "SELECT 1;" 2>/dev/null && echo "PostgreSQL is ready!" || echo "Connection check may need postgres on PATH"

echo ""
echo "Setup Complete!"
echo "PostgreSQL is running on localhost:5432"
echo "Database: mindfulai"
echo "User: mindful"
echo "Password: mindful123"
echo ""
echo "To keep PostgreSQL running, execute:"
echo "  wsl sudo service postgresql start"
