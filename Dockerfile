# Stage 1: Build Frontend
FROM node:18-alpine as frontend-build
WORKDIR /app/web
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Python Backend
FROM python:3.10-slim
WORKDIR /app

# Install system dependencies (if any needed for audio/etc, though we are web-only now)
# RUN apt-get update && apt-get install -y ...

# Copy Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Backend Code
COPY . .

# Copy Built Frontend from Stage 1
# Vite builds to /app/web/build (based on vite.config.ts output dir)
# We need to make sure main.py/app.py serves from the right place.
# Based on previous checks, vite.config.ts outputDir is 'build' in root?
# Let's check vite.config.ts first to be sure, but assuming standard setup:
COPY --from=frontend-build /app/web/build /app/build

# Environment Variables
ENV PORT=8000
ENV HOST=0.0.0.0

# Expose Port
EXPOSE 8000

# Run Command
CMD ["python", "main.py"]
