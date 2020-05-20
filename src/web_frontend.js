const express   = require('express');
const https     = require('https');
const ws        = require('ws');
const debug     = require('debug')('ace:web');
const param     = require('param');
const path      = require('path');
const fs        = require('fs');
const util      = require('util');
const Events    = require('events');
const session   = require('./session_handler');
const recording = require('./recording_handler');
const videomail = require('./videomail_handler');

const readFile = util.promisify(fs.readFile);

class WebServer extends Events {

  async start() {
    debug('Starting webserver ...');
    const app = express();
    app.use(
      express.static(path.join(process.cwd(), param('webserver.static')))
    );

    app.use(this.cors);
    app.use(this.authentication);

    app.get('/test', async (req,res) => {
      res.status(200).send('Server is up!');
    });

    app.use('/session', session);

    app.use('/recording', recording);

    app.use('/videomail', videomail);

    const server = https.createServer({
      key: await readFile(param('webserver.key')),
      cert: await readFile(param('webserver.cert')),
      ca: await readFile(param('webserver.csr'))
    }, app);

    const wss = new ws.Server({
      server,
      path: '/signaling'
    });

    wss.on('connection', (socket, request) => {
      this.emit('connection', {
        socket, 
        request
      });
    });

    server.listen(param('webserver.port'), () => {
      debug('Listening on port %s', param('webserver.port'));
    })
  }

  cors(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  }

  authentication(req, res, next) {
    const token = req.get('X-Auth-Token');
    if(token && token === param('webserver.token')) {
      next();
    } else {
      res.status(401).end('Unauthorized');
    }
  }
}


module.exports = WebServer;