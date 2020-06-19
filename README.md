# ACEDirect-Kurento
A Web and signaling server application that uses Kurento Media Server to make/receive one to one calls to/from Asterisk

## Integration of Kurento with Asterisk

### Pre-Requisites

* [NodeJS](https://nodejs.org) [preferred node 8 version]
* [MySQL](https://www.mysql.com/) 

### Configuration 

* Main configuration variables `src/config/development.json`
* MySQL database parameters `src/config/db.json`

### To Run locally:

#### NPM Build/Run

1. `npm run build` , but if npm hangs, try the yarn build instead `npm run build2`
1. Configure these files: `confs/kurento/WebRtcEndpoint.conf.ini`, `src/config/db.js`, `src/config/development.json`
1. npm run sequelize db:migrate
1. `npm run dev  # run it!`
1. open this url in a WebRTC compatible browser: `https://localhost:8443/`

#### Manual Build/Run Steps

1. npm install
1. Copy the files in confs/jssip-modifications, RTCSession.js and UA.js, to replace node_modules/jssip/lib-es5/RTCSession.js and node_modules/jssip/lib-es5/UA.js
1. npm run bower  
1. Configure these files: `confs/kurento/WebRtcEndpoint.conf.ini`, `src/config/db.js`, `src/config/development.json`
1. npm run sequelize db:migrate
1. `cd vendor/kurento-client-js ; npm install`
1. `cd vendor/kurento-jsonrpc ; npm install`
1. `cd vendor/reconnect-ws; npm install`
1. `npm run dev  # run it!`
1. open this url in a WebRTC compatible browser: `https://localhost:8443/`

### With Docker:

1) docker build -t {$YOUR_USERNAME}/acedirect-kurento .
2) docker run -p 8443:8443 -d {$YOUR_USERNAME}/acedirect-kurento
3) docker exec -it {$CONTAINER_ID} npm run sequelize db:migrate
4) (Optional. If you want to see the app logs) docker logs --follow {$CONTAINER_ID} 

If you want to go ahead and build several services in the same machine and you want to quickly have things running for development, you can directly use `docker-compose up` instead.

