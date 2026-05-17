# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Declare build-time env vars so Railway injects REACT_APP_* into the CRA bundle
ARG REACT_APP_SUPABASE_URL
ARG REACT_APP_SUPABASE_ANON_KEY
ARG REACT_APP_RAILWAY_API_URL
ENV REACT_APP_SUPABASE_URL=$REACT_APP_SUPABASE_URL
ENV REACT_APP_SUPABASE_ANON_KEY=$REACT_APP_SUPABASE_ANON_KEY
ENV REACT_APP_RAILWAY_API_URL=$REACT_APP_RAILWAY_API_URL

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

# Build the React app (REACT_APP_* are now baked into the bundle)
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

# Serve the app: -s = SPA fallback; serve.json in build/ is auto-detected (serve 14+)
CMD sh -c "serve -s build -l ${PORT:-3000}"
