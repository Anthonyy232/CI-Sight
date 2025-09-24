FROM node:18-alpine AS base
WORKDIR /app

# Install Python and pip
RUN apk add --no-cache python3 py3-pip

# Copy package files
COPY package.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY ml/requirements.txt ./ml/

# Install root dependencies
RUN npm install

# Install client dependencies and build
WORKDIR /app/client
RUN npm install
COPY client/ ./
RUN npm run build

# Install server dependencies
WORKDIR /app/server
RUN npm install
COPY server/ ./
RUN npm run build

# Install ML dependencies
WORKDIR /app/ml
RUN pip install -r requirements.txt
COPY ml/ ./

# Final stage
FROM node:18-alpine AS runtime
WORKDIR /app

# Install Python
RUN apk add --no-cache python3 py3-pip

# Copy built client
COPY --from=base /app/client/dist ./client/dist

# Copy built server
COPY --from=base /app/server/dist ./server/dist
COPY --from=base /app/server/node_modules ./server/node_modules
COPY --from=base /app/server/prisma ./server/prisma

# Copy ML
COPY --from=base /app/ml ./ml

# Copy root node_modules if needed
COPY --from=base /app/node_modules ./node_modules

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "server/dist/index.js"]