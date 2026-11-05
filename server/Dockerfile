FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY *.mjs ./
RUN mkdir -p /data/chat-files && chown -R node:node /data/chat-files
USER node
EXPOSE 7040
CMD ["node", "index.mjs"]
