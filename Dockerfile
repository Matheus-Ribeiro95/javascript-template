FROM node:lts-alpine

WORKDIR /usr/src/app

COPY package.json package-lock.json main.ts tsconfig.json ./
COPY static ./static
RUN npm ci
RUN npx tsc --build

CMD ["node","./dist/main.js"]