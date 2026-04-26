FROM node:20-slim

WORKDIR /app

COPY server-node/package*.json ./
RUN npm ci --omit=dev

COPY server-node/src ./src

RUN mkdir -p /app/data/uploads /app/data/outputs

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV HOST=0.0.0.0
ENV PORT=8001

EXPOSE 8001

CMD ["node", "src/index.js"]
