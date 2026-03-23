#!/bin/sh
# Generate a runtime config file that the app loads before the JS bundle.
# This allows a single published image to work at any server address.
cat > /usr/share/nginx/html/config.js << EOF
window.__ENV__ = {
  VITE_API_BASE_URL: "${VITE_API_BASE_URL:-http://localhost:3001}",
  VITE_VAPID_PUBLIC_KEY: "${VITE_VAPID_PUBLIC_KEY:-}"
};
EOF
exec nginx -g "daemon off;"
