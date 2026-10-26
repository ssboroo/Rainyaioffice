FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY scripts ./scripts
COPY public ./public
COPY server.mjs ./
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
COPY --from=build /app/dist/package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=build /app/dist/server.mjs ./
COPY --from=build /app/dist/public ./public
COPY --from=build /app/dist/build-manifest.json ./
RUN mkdir /data && chown node:node /data
USER node
ENV NODE_ENV=production PORT=3000 DB_PATH=/data/office.sqlite
EXPOSE 3000
CMD ["node", "server.mjs"]
