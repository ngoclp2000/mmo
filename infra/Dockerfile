FROM node:24-alpine
WORKDIR /app
COPY . .
RUN npm ci && npx tsc -p tsconfig.build.json && npm prune --omit=dev && rm -rf apps/web tests
ENV NODE_ENV=development
USER node
CMD ["node","dist/apps/api/src/server.js"]
