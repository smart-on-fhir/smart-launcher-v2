# Stage 1: Build the application
FROM node:23 AS build

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Create the runtime environment
FROM node:18-alpine AS runtime

# Set the working directory
WORKDIR /app

# Copy only the necessary files from the build stage
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend ./backend
COPY --from=build /app/public ./public
COPY --from=build /app/private-key.pem ./private-key.pem
COPY --from=build /app/public-key.pem ./public-key.pem
COPY --from=build /app/src/isomorphic ./src/isomorphic
COPY --from=build /app/build ./build

# Set environment variables
ENV NODE_ENV="production"
ENV PORT="80"

# Expose the port
EXPOSE 80

# Command to run the application
CMD ["/app/node_modules/.bin/ts-node", "--skipProject", "--transpile-only", "./backend/index.ts"]
