require('dotenv').config();
const WebServer    = require('./web_frontend');
const SessionIndex = require('./session_index');
const ConfManager  = require('./conf_manager');
const AmiManager   = require('./ami_manager');
const param        = require('param');
const debug        = require('debug')('ace:main');

async function main() {
  try {
    debug('Starting ACE app...');
    const ix = new SessionIndex();
    const conf = new ConfManager(ix);
    const server = new WebServer();
    const amiEnabled = param('asterisk.ami.enabled');
    const ami = (amiEnabled) ? new AmiManager() : null;
    server.on('connection', session => {
      ix.register(session, conf, ami);
    });
    await server.start();
    if (ami) await ami.init_ami();
  } catch (error) {
    debug('Fatal error', error);
  }
}

main(process.argv.splice(2))