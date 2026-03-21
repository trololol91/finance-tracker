FROM mcr.microsoft.com/playwright:v1.58.2-noble

# Install Xvfb so headed browsers (headless: false) can run without a real display.
RUN apt-get update && apt-get install -y --no-install-recommends xvfb \
    && rm -rf /var/lib/apt/lists/*

# Start a virtual display then hand off to CMD.
WORKDIR /server
RUN npm init -y && npm install playwright@1.58.2
COPY server.mjs /server/server.mjs

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "/server/server.mjs"]
