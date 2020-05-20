const uuid          = require('uuid');
const debug         = require('debug')('ace:session-ix');
const Events        = require('events');
const ClientSession = require('./client_session');

class SessionIndex extends Events {

  constructor() {
    super();
    this._index = new Map();
    this._extIndex = new Map();
  }

  register({ socket }, confm, ami) {
    const id = uuid.v4();
    debug('Add %s to index', id);
    const client = new ClientSession(id, socket, confm, ami);
    client.on('registered', ext => {
      this._extIndex.set(ext, id);
    });

    this._index.set(id, client);

    const shutdown = () => {
      client.close();
      this.unregister(id);
    };

    socket.on('close', shutdown);
    socket.on('error', shutdown);
  }

  unregister(id) {
    debug('Remove %s from index', id);
    const client = this._index.get(id);
    this._index.delete(id);
    if (client && client.ext) {
      this._extIndex.delete(client.ext);
    }
  }

  getByExt(ext) {
    const id = this._extIndex.get(ext);
    return (id) ? this._index.get(id) : null;
  }
}

module.exports = SessionIndex;