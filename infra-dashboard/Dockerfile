FROM node:20-alpine

RUN apk add --no-cache wget

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./
COPY public/ ./public/

EXPOSE 4000

CMD ["node", "server.js"]
