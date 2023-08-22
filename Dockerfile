# Build Image
FROM node:18 AS build
USER node
WORKDIR /home/node
COPY package*.json ./
COPY --chown=node . .
RUN npm ci
RUN npm run build
RUN npm ci --omit=dev

# Final Image
FROM node:18 AS final
USER node
WORKDIR /app
ENV NODE_ENV "production"
ENV PORT "80"
COPY package*.json ./
COPY backend ./backend
COPY src/isomorphic ./src/isomorphic
COPY *.pem ./
COPY --from=build /home/node/build ./build
COPY --from=build /home/node/node_modules ./node_modules
EXPOSE 80
CMD ["/app/node_modules/.bin/ts-node", "--skipProject", "--transpile-only", "./backend/index.ts"]
