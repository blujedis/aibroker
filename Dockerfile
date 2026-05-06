# Use official Node.js image
FROM node:24-alpine AS builder

WORKDIR /app
COPY package*.json ./

# Run a clean install
RUN npm ci --only=production

# Copy all files.
COPY . .

# Build your app if needed (e.g. Next.js, Vite, etc.)
RUN npm run build

# Production stage
FROM node:24-alpine

WORKDIR /app

# Vite bundles production output to "build" folder.
# This ensures that npm start points to the correct path.
COPY --from=builder /app/build ./build
COPY --from=builder /app/package*.json ./

# Port the project is accessible on
EXPOSE 4000

# Use a non-root user for security
USER node

CMD ["npm", "start"]