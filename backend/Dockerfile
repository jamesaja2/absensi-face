FROM node:20-bookworm-slim

WORKDIR /app

# Install native compilation tools and utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY models/ ./models/
COPY src/ ./src/

# Create data and uploads directories
RUN mkdir -p /data /app/uploads

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1

CMD ["node", "src/index.js"]
