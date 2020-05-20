const Kurento = require('kurento-client');
const debug   = require('debug')('ace:utils');

function getKurentoClient(uri, timeout) {
  return new Promise(accept => {
    let id = setTimeout(() => {
      debug(`Kurento client timed out after ${timeout} ms`);
      accept(null);
    }, timeout);
    Kurento(uri, {}, (err, client) => {
      clearTimeout(id);
      if (err) {
        debug(`Error creating kurento client: ${err.message || JSON.stringify(err)}`);
        return accept(null);
      }
      debug(`Kurento client created`);
      accept(client);
    })
  });
}


module.exports = {
  getKurentoClient
};