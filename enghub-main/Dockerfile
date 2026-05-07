# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build the React app
RUN npm run build

# Production stage - serve with Node
FROM node:20-alpine

WORKDIR /app

# Install serve to serve the static build
RUN npm install -g serve

# Copy built app from builder
COPY --from=builder /app/build ./build

# Expose port
EXPOSE 3000

# Serve the app on PORT env var (Railway sets PORT; default 3000 for local dev)
CMD sh -c "serve -s build -l ${PORT:-3000}"
