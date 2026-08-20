#!/bin/sh
set -e

# Ensure a default if not provided
: ${VITE_BACKEND_HOST:=http://backend:3000}
export VITE_BACKEND_HOST

if [ -f /etc/nginx/conf.d/default.conf.template ]; then
  envsubst '${VITE_BACKEND_HOST}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
fi

exec nginx -g 'daemon off;'
