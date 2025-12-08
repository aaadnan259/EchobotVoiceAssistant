# Stage 1: Build Frontend
FROM node:20-alpine as frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Node.js Backend
FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
# Install production dependencies only
RUN npm ci --omit=dev

# Copy backend source
COPY server.js .
COPY services ./services
COPY routes ./routes

# Copy built frontend from Stage 1
COPY --from=frontend-build /app/build ./build

# Environment Variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose Port
EXPOSE 3000

# Run Command
CMD ["npm", "start"]
