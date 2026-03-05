# Build stage
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Allow overriding the public base path at build time (defaults to /pwa-whiteboard/)
ARG VITE_PUBLIC_BASE=/pwa-whiteboard/
ENV VITE_PUBLIC_BASE=$VITE_PUBLIC_BASE

RUN npm run build

# Runtime stage
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Serve under /pwa-whiteboard/ by default
RUN mkdir -p /usr/share/nginx/html/pwa-whiteboard
COPY --from=build /app/dist/ /usr/share/nginx/html/pwa-whiteboard/

EXPOSE 80
