FROM node:20-alpine
WORKDIR /app
COPY api/package*.json ./
RUN npm install --omit=dev
COPY api/src ./src
COPY data ./data
EXPOSE 8080
CMD ["node", "src/server.js"]
