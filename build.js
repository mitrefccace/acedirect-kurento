const path = require('path');
const now = new Date()  
const secondsSinceEpoch = Math.round(now.getTime() / 1000)  

var fs = require('fs');

//function to execute shell command as a promise
//cmd is the shell command
//wdir is the working dir
//return a Promise
function execCommand(cmd,wdir) {
  console.log('executing  ' + cmd + ' ...');
  const exec = require('child_process').exec;
  return new Promise((resolve, reject) => {
    exec(cmd, {cwd: wdir}, (error, stdout, stderr) => {
      if (error) {
        console.warn(error);
        process.exit(99); 
      }
      resolve(stdout? stdout : stderr);
    });
  });
}

async function go() {

  s = await execCommand('rm -rf node_modules >/dev/null  # removing node_modules','.');
  s = await execCommand('rm -rf vendor/kurento-client-js/node_modules >/dev/null  # removing node_modules','.');
  s = await execCommand('rm -rf vendor/kurento-jsonrpc/node_modules >/dev/null  # removing node_modules','.');
  s = await execCommand('rm -rf vendor/reconnect-ws/node_modules >/dev/null  # removing node_modules','.');
  s = await execCommand('sleep 5  # pause before npm install... ','.');

  s = await execCommand('npm install   # main install','.');

  s = await execCommand('cp confs/jssip-modifications/RTCSession.js node_modules/jssip/lib-es5/.', '.');
  s = await execCommand('cp confs/jssip-modifications/UA.js node_modules/jssip/lib-es5/.', '.');

  s = await execCommand('npm run bower  ','.');

  s = await execCommand('npm install  ','./vendor/kurento-client-js');
  s = await execCommand('npm install  ','./vendor/kurento-jsonrpc');
  s = await execCommand('npm install  ','./vendor/reconnect-ws');

  //copy config files if they don't exist
  s = await execCommand('cp -n WebRtcEndpoint.conf.ini_TEMPLATE WebRtcEndpoint.conf.ini','./confs/kurento');
  s = await execCommand('cp -n development.json_TEMPLATE development.json','./src/config');
  s = await execCommand('cp -n db.js_TEMPLATE db.js','./src/config');

  console.log('');
  console.log('TODO:');
  console.log('Edit/configure confs/kurento/WebRtcEndpoint.conf.ini ');
  console.log('Edit/configure src/config/db.js ');
  console.log('Edit/configure src/config/development.json ');
  console.log('npm run sequelize db:migrate  ');
  console.log('npm run dev   # to start, or run with PM2: pm2 start process.json  ');
  console.log('');
}

go(); //MAIN
