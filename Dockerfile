# Use official Node.js image
FROM node:24-alpine AS builder

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate

WORKDIR /app

# Copy lockfile and manifest first for layer caching
COPY package.json pnpm-lock.yaml ./

# Copy drizzle migrations.
COPY drizzle ./drizzle

# Install all dependencies (including devDependencies needed for the build)
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Copy all files.
COPY . .

# Build your app
RUN pnpm build

# Production stage
FROM node:24-alpine

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate

WORKDIR /app

# Copy lockfile and manifest for production install
COPY package.json pnpm-lock.yaml ./

# Copy drizzle migrations.
# COPY drizzle ./drizzle

# Install only production dependencies
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

# Vite bundles production output to "build" folder.
COPY --from=builder /app/.drizzle ./.drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Port the project is accessible on
EXPOSE 4000

# Use a non-root user for security
USER node

# Port must be set or it will default to 3000
CMD ["node", "build"]