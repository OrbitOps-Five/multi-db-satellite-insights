FROM node:18-alpine

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

COPY . .

RUN cd client && npm ci && npm run build

EXPOSE 3000

CMD ["node", "server.js"]