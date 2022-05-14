FROM node:13.7.0

WORKDIR /usr/src/app

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV

COPY package.json /usr/src/app/
RUN yarn install

COPY . /usr/src/app

ENV PORT 3000
EXPOSE $PORT
CMD [ "node", "server.js" ]
