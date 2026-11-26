FROM node:20-alpine

# Set build dependencies if needed, then keep minimal surface
WORKDIR /app

# Copy configuration and manifests
COPY package*.json tsconfig.json ./
RUN npm install

# Copy codebase
COPY src/ ./src

# Compile codebase to dist distribution layout
RUN npm run build

# Expose port for the local Web Analytics Dashboard
EXPOSE 3333

# Create workspace mount point
WORKDIR /workspace

# Run Shanaxon server by default
CMD ["node", "/app/dist/index.js"]
