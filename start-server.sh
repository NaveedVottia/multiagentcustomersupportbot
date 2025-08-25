#!/bin/bash
set -a
source .env
set +a
export NODE_OPTIONS="--max-old-space-size=2048"
npm run dev
