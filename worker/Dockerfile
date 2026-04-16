FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy worker source
COPY . .

# Create logs and workspace directories
RUN mkdir -p logs /workspace

# Run in loop mode
CMD ["node", "index.js", "--loop"]
