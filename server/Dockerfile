FROM node:17-alpine3.14

RUN apt-get install passwd -y
RUN useradd -ms /bin/bash appuser

RUN mkdir -p /home/app

COPY app /home/app

WORKDIR /home/app

RUN npm install
RUN npm run build-css-minified
RUN npm run build-molstar-bundle

RUN chown -R appuser:appuser /home/appuser
RUN usermod -u 0 appuser
USER appuser

CMD ["node", "/home/app/src/app.js"]
