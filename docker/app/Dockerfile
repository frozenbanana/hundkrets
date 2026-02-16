# Dog Watch Match - SolidJS app
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY app/package*.json ./
RUN npm ci

# Build (VITE_POCKETBASE_URL is the URL the browser uses to reach PocketBase)
ARG VITE_POCKETBASE_URL=http://localhost:8090
ENV VITE_POCKETBASE_URL=$VITE_POCKETBASE_URL

COPY app/ ./
RUN npm run build

# Production
FROM node:20-alpine AS runner

WORKDIR /app

# Copy built output
COPY --from=builder /app/.output ./.output

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
