FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY server.mjs ./
COPY public ./public
RUN mkdir /data && chown node:node /data
USER node
ENV NODE_ENV=production PORT=3000 DB_PATH=/data/office.sqlite
EXPOSE 3000
CMD ["node", "server.mjs"]
