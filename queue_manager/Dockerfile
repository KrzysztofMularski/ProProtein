FROM node:17-alpine3.14

RUN mkdir -p /home/app

COPY app /home/app

WORKDIR /home/app

RUN npm install

CMD ["node", "/home/app/src/app.js"]
