# === Build Stage ===
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies using clean install
RUN npm ci

# Copy project files
COPY . .

# Build the application
RUN npm run build

# === Production Stage ===
FROM nginx:stable-alpine

# Copy build output to nginx (Vite outputs to 'build/' per vite.config.ts)
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx config with API reverse proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
