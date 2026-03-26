FROM node:22-slim

# Install system dependencies
RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*

# Install pnpm globally
RUN npm install -g pnpm@10

# Copy layrr CLI
COPY packages/cli/dist /opt/layrr/dist
COPY packages/cli/package.json /opt/layrr/package.json

# Install layrr CLI dependencies
WORKDIR /opt/layrr
RUN npm install --omit=dev

# Copy entry script
COPY packages/container/entry.sh /opt/layrr/entry.sh
RUN chmod +x /opt/layrr/entry.sh

# Create workspace volume mount point
RUN mkdir -p /workspace

WORKDIR /workspace
EXPOSE 4567

ENTRYPOINT ["/opt/layrr/entry.sh"]
