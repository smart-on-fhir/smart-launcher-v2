# Build Image
FROM node:18 AS build
USER node
WORKDIR /home/node
COPY package*.json ./
COPY --chown=node . .
RUN npm ci --production=false
RUN npm run build

# Final Image
FROM node:18 AS final
USER node
WORKDIR /app
ENV NODE_ENV "production"
ENV PORT "80"
COPY package*.json ./
RUN npm ci --production=true
COPY backend ./backend
COPY src/isomorphic ./src/isomorphic
COPY *.pem ./
COPY --from=build /home/node/build ./build
EXPOSE 80
CMD ["/app/node_modules/.bin/ts-node", "--skipProject", "--transpile-only", "./backend/index.ts"]
