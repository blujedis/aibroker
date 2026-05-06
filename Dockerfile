# Node version
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package files first to leverage Docker's cache
COPY package*.json ./

# Install dependencies (omit dev dependencies for production)
RUN npm install --omit=dev

# Copy the rest of your application code
COPY . .

# Expose the port your app runs on
EXPOSE 4000

# 7. Use a non-root user for security
USER node

# Start the application
CMD ["node", "build/index.js"]
