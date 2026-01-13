# Stage 1: Build Frontend
FROM node:20-alpine as frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Python Backend
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies if needed (e.g. for audio)
RUN apt-get update && apt-get install -y \
    build-essential \
    portaudio19-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Copy built frontend from Stage 1
# We copy to /app/build, so app.py finds it at /app/build or ./build
COPY --from=frontend-build /app/build /app/build

# Environment Variables
ENV PYTHONUNBUFFERED=1
ENV PORT=3000

# Expose Port
EXPOSE 3000

# Run Command (Uses PORT env var)
CMD ["python", "main.py"]
