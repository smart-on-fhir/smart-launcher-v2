FROM node:18-alpine

WORKDIR /app

ENV NODE_ENV "production"
ENV PORT "80"

# Install and cache
COPY package.json /tmp/package.json
COPY package-lock.json /tmp/package-lock.json
RUN cd /tmp && npm install --production
RUN mv /tmp/node_modules /app/node_modules

COPY . .

RUN npm run build

EXPOSE 80

CMD ["/app/node_modules/.bin/ts-node", "--skipProject", "--transpile-only", "./backend/index.ts"]
