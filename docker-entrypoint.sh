#!/bin/sh
set -e

# Replace the nginx config from template using envsubst-like substitution for VITE_BACKEND_HOST
if [ -f /etc/nginx/conf.d/default.conf ]; then
  rm -f /etc/nginx/conf.d/default.conf
fi

if [ -f /etc/nginx/conf.d/default.conf.template ]; then
  # Use shell parameter expansion to replace placeholder
  awk '{gsub(/\$\{VITE_BACKEND_HOST:-http:\/\/backend:3000\}/, ENVIRON["VITE_BACKEND_HOST"]?ENVIRON["VITE_BACKEND_HOST"]:"http://backend:3000"); print}' /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
else
  cp /etc/nginx/conf.d/default.conf.template /etc/nginx/conf.d/default.conf
fi

exec nginx -g 'daemon off;'
