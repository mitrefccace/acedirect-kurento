FROM node:carbon

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Copy vendor dir
COPY ./vendor ./vendor

RUN ["npm","--prefix","./vendor/kurento-client-js","install","./vendor/kurento-client-js"]

RUN ["npm","--prefix","./vendor/kurento-jsonrpc","install","./vendor/kurento-jsonrpc"]

RUN ["npm","--prefix","./vendor/reconnect-ws","install","./vendor/reconnect-ws"]

RUN npm install

# Bundle app source
COPY . .

# Install frontend dependencies
RUN ["npm","run","bower"]

# Update modified jssip library
RUN ["cp","confs/jssip-modifications/RTCSession.js","node_modules/jssip/lib-es5/RTCSession.js"]
RUN ["cp","confs/jssip-modifications/UA.js","node_modules/jssip/lib-es5/UA.js"]

EXPOSE 8443
CMD ["npm","run","dev"]