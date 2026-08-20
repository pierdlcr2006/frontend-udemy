#!/bin/sh
set -e

# Default backend host if not provided
: ${VITE_BACKEND_HOST:=http://backend:3000}
export VITE_BACKEND_HOST

# Write runtime config for the SPA
cat > /app/dist/config.json <<EOF
{ "backend": "${VITE_BACKEND_HOST}" }
EOF

# Start a simple static server
exec serve -s /app/dist -l 80
