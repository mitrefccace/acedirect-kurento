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

  s = await execCommand('npm install >/dev/null  # main install','.');

  s = await execCommand('cp confs/jssip-modifications/RTCSession.js node_modules/jssip/lib-es5/.', '.');
  s = await execCommand('cp confs/jssip-modifications/UA.js node_modules/jssip/lib-es5/.', '.');

  s = await execCommand('npm run bower >/dev/null ','.');

  s = await execCommand('npm install  ','./vendor/kurento-client-js');
  s = await execCommand('npm install  ','./vendor/kurento-jsonrpc');
  s = await execCommand('npm install  ','./vendor/reconnect-ws');

  console.log('TODO: configure these files: confs/kurento/WebRtcEndpoint.conf.ini, src/config/db.js, src/config/development.json');
  console.log('TODO: npm run sequelize db:migrate');

  console.log('RUNNING: npm run dev  OR  pm2 start process.json\n');
}

go(); //MAIN
