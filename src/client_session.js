const debug  = require('debug')('ace:client-session');
const Events = require('events');
const param = require('param');
const ws     = require('ws');

const CL_STATUS_UNDEFINED  = 'UNDEF';
const CL_STATUS_REGISTERED = 'REGISTERED';
const CL_STATUS_BUSY       = 'BUSY';

class ClientSession extends Events {

  constructor(id, socket, confm, ami) {
    super();
    this._id      = id;
    this._socket  = socket;
    this._confm   = confm;
    this._status  = CL_STATUS_UNDEFINED;
    this._ext     = null;
    this._session = null;
    this._queue   = [];
    this._ami     = ami;
    this._asteriskQueueNames = param('asterisk.ami.queue_names');
    this._isMemberQueue = false;
    this._isAgent = null;
    this._sipIntervalTimeout = null;
    this.init();
  }

  get id() {
    return this._id;
  }

  get busy() {
    return this._status === CL_STATUS_BUSY;
  }

  get ext() {
    return this._ext;
  }

  get ua() {
    return this._ua;
  }

  init() {
    this._socket.on('message', payload => {
      const message = JSON.parse(payload);
      debug('[%s] Got payload', this._id, message.id);
      switch (message.id) {
        case 'loopback':
          this.loopback(message.ext, message.sdp);
          break;
        case 'register':
          this.register(message.ext, message.password, message.isAgent);
          break;
        case 'call':
          this.call(message.uri, message.sdp, message.skipQueue);
          break;
        case 'stop':
          this.handleHangup(message.removeFromQueue);
          break;
        case 'pauseQueue':
          this.pauseQueue();
          break;
        case 'unpauseQueue':
          this.unpauseQueue();
          break;
        case 'ice':
          this.handleIce(message.candidate);
          break;
        case 'hold':
          this.handleHold(true);
          break;
        case 'unhold':
          this.handleHold(false);
          break;
        case 'startRecording':
          this.handleRecording(true);
          break;
        case 'stopRecording':
          this.handleRecording(false);
          break;
        case 'privacy':
          this.handlePrivateMode(message.enabled, message.url);
          break;
        case 'invitePeer':
          this.invitePeer(message.ext);
          break;
        case 'callTransfer':
          this.callTransfer(message.ext, message.isBlind);
          break;
        case 'sipReinvite':
          this.sipReinvite(message.ext, message.sdp);
          break;
        case 'sipUpdate':
          this.sipUpdate(message.ext, message.sdp);
          break;
        case 'restartCall':
          this.restartCall(message.sdp);
          break;
        case 'accept':
        case 'decline':
          break;
        default:
          debug('[%s] message not recognized', message.id);
      }
    });
  }

  async sipReinvite(ext, customSdp) {
    let success = false;
    let isUpdate = false;
    if (this._session) {
      success = await this._confm.handleRenegotiate(this, customSdp, isUpdate);
    }
    this._send({
      id: 'sipReinviteResponse',
      success,
      ext
    });
  }

  async sipUpdate(ext, customSdp) {
    let success = false;
    let isUpdate = true;
    if (this._session) {
      success = await this._confm.handleRenegotiate(this, customSdp, isUpdate);
    }
    this._send({
      id: 'sipUpdateResponse',
      success,
      ext
    });
  }

  async restartCall(sdp) {
    let success = false;
    if (this._session) {
      success = await this._confm.handleRegenerateEndpoints(this, sdp);
    }
    this._send({
      id: 'restartCallResponse',
      success
    });
  }
  
  async invitePeer(ext) {
    let success = false;
    if (this._session) {
      success = await this._confm.invitePeer(this, this._session, ext);
    }
    this._send({
      id: 'inviteResponse',
      success,
      ext
    });
  }

  async callTransfer(ext, isBlind) {
    let success = false;
    if (this._session) {
      success = await this._confm.callTransfer(this, this._session, ext, isBlind);
    }
    this._send({
      id: 'callTransferResponse',
      success,
      ext
    });
  }

  updateParticipants(participants) {
    this._send({
      id: 'participantList',
      participants
    });
  }

  sendNewSipMessage(msg) {
    this._send({
      id: 'newMessage',
      msg
    });
  }

  sendSipConfirmedMessage(msg) {
    this._send({
      id: 'sipConfirmed',
      msg: msg || 'OK'
    });
  }

  async loopback(ext, offer) {
    let calleeExt = ext + 1;
    debug('[%s] Initiated call from [%s] to [%s]', this._id, calleeExt);
    try {
      this._status = CL_STATUS_REGISTERED;
      this._ext = ext;
      this._session = await this._confm.loopbackCall(this, offer, calleeExt);
      const candidates = this._queue.splice(0);
      candidates.forEach(c => {
        this._session.handleIce(this._ext, c);
      });
    } catch(error) {
      debug('[%s] Couldn\'t connect call', error);
      console.error(error);
    }
  }

  async register(ext, pass, isAgent) {
    debug('[%s] Register request', this._id);
    try {
      const ua = await this._confm.register(ext, pass);
      this._status = CL_STATUS_REGISTERED;
      this._ua = ua;
      this._ext = ext;
      this._isAgent = isAgent;
      this.emit('registered', ext);
      this._send({ id: 'registerResponse' });
      debug('[%s] Registered as %s', this._id, ext);

      if(!this._isMemberQueue && isAgent && this._ami
          && this._asteriskQueueNames && this._asteriskQueueNames.length) {
        // add user to asterisk queue
        let res = null;
        this._asteriskQueueNames.forEach(async queueName => {
          res = await this._ami.queueAdd(ext, queueName);
          if(res)
            this._isMemberQueue = true;
        });
      }
    } catch(error) {
      const message = error.message || 
        (error.response && error.response.reason_phrase) || 
        'Unknown error';
      this._send({ id: 'registerResponse', error: message });
      debug('[%s] Error while registering:', this._id, message);
    }
  }
  
  async call(target, offer, skipQueue) {
    if (this._status !== CL_STATUS_REGISTERED) {
      debug('[%s] Can\'t start call while status is %s', this._id, this._status);
      return;
    }
    debug('[%s] Initiated call to %s', this._id, target);
    try {
      this._session = await this._confm.call(this, offer, target, skipQueue);
      const candidates = this._queue.splice(0);
      candidates.forEach(c => {
        this._session.handleIce(this._ext, c);
      })
    } catch(error) {
      debug('[%s] Couldn\'t connect call to %s', this._id, error);
      console.error(error);
    }
  }
  
  handleHangup(removeFromQueue) {
    debug('[%s] Hangup/Stop request', this._id);
    if (this._session) {
      if (removeFromQueue && this._isMemberQueue && this._isAgent && this._ami
          && this._asteriskQueueNames && this._asteriskQueueNames.length) {
        let amires = null;
        this._asteriskQueueNames.forEach(async queueName => {
          amires = await this._ami.queueRemove(this._ext, queueName);
          if (amires)
            this._isMemberQueue = false
        });
      }
      this._status = CL_STATUS_REGISTERED;
      let sid = this._session.id;
      let ext = this._ext;
      if(this._ua) {
        this._ua.terminateSessions();
      }
      clearInterval(this._sipIntervalTimeout);
      this._session.leave(this._ext);
      this._session = null;
      this._send({ id: 'sessionStopped', sid, ext });
    }
  }

  close() {
    this.emit('close');
    if (this._isMemberQueue && this._isAgent && this._ami
        && this._asteriskQueueNames && this._asteriskQueueNames.length) {
      let amires = null;
      this._asteriskQueueNames.forEach(async queueName => {
        amires = await this._ami.queueRemove(this._ext, queueName);
        if(amires)
          this._isMemberQueue = false;
      });
    }
    if(this._ua) {
      this._ua.stop();
    }
    if(this._session) {
      const session = this._session;
      this._session = null;
      session.leave(this._ext);
    }
  }

  handleIce(candidate) {
    if (this._session) {
      this._session.handleIce(this._ext, candidate);
    } else {
      this._queue.push(candidate);
    }
  }

  sendIce(candidate) {
    this._send({ id: 'ice', candidate });
  }
  
  sendSdp(sdp) {
    this._send({ id: 'sdp', sdp });
  }

  _send(message) {
    if (this._socket.readyState === ws.OPEN) {
      const payload = JSON.stringify(message);
      this._socket.send(payload);
    }
  }

  askJoinSession(caller, session) {
    return this.accept(caller, session);
  }

  accept(caller, session) {
    this._send({
      id: 'incomingCall',
      caller,
      isWarmTransfer: this._warmTransfer
    });
    return new Promise( success => {
      const handler = async (payload) => {
        const msg = JSON.parse(payload);
        if (msg.id === 'accept' && msg.caller === caller) {
          this._socket.removeEventListener('message', handler);
          this._status = CL_STATUS_BUSY;
          this._session = session;
          success(msg.sdp);
        }
        if (msg.id === 'decline' && msg.caller === caller) {
          this._socket.removeEventListener('message', handler);
          const session = this._session;
          this._session = null;
          session && session.finish();
          success(null);
        }
      };
      this._socket.on('message', handler);

      this._confm.on('incomingCallReady', async (session) => {
        this._session = session;
        // debug(this._session);
        const candidates = this._queue.splice(0);
        candidates.forEach(c => {
          this._session.handleIce(this._ext, c);
        })
      });

      setTimeout(() => {
        // success(null);
        this._socket.removeEventListener('message', handler);
      }, 10000);

    });
  }

  sessionStopped(session, reason = 'normal') {
    this._send({ id: 'sessionStopped', session, reason });
    if (this._session && this._session.id === session) {
      this._status = CL_STATUS_REGISTERED;
      this._session = null;
    }
  }

  async pauseQueue() {
    if (!this._ami || this._asteriskQueueNames.length === 0) {
      return this._send('Asterisk AMI disabled');
    }
    if (this._isMemberQueue && this._isAgent) {
      this._asteriskQueueNames.forEach(queueName => {
        try {
          let that = this;
          this._ami.pauseQueue(this._ext, queueName, function (r) {
            that._send({ id: 'pausedQueue' });
          });
        } catch (e) {
          debug(e);
        }
      });
    }
  }

  async unpauseQueue() {
    if (!this._ami || this._asteriskQueueNames.length === 0) {
      return this._send('Asterisk AMI disabled');
    }
    if (this._isMemberQueue && this._isAgent) {
      this._asteriskQueueNames.forEach(queueName => {
        try {
          let that = this;
          this._ami.unpauseQueue(this._ext, queueName, function (r) {
            that._send({id: 'unpausedQueue'});
          });
        } catch (e) {
          debug(e);
        }
      });
    }
  }

  async handleHold(onHold) {
    let success = false;
    if(this._session) {
      await this._confm.hold(this._ext, onHold);
      success = await this._session.hold(this._ext, onHold);
    }
    this._send({
      id: onHold ? 'holdResult' : 'unholdResult',
      success
    });
  }

  async handleRecording(record) {
    debug('handle recording', record);
    let success = false;
    if (this._session) {
      success = await this._session.toggleRecording(this._ext, record);
    }
    this._send({
      id: record ? 'startedRecording' : 'stoppedRecording',
      success
    });
  }

  async handlePrivateMode(enabled, url) {
    if(!this._session) return;
    if(enabled) {
      this._session.enablePrivateMode(this._ext, url);
    } else {
      this._session.disablePrivateMode(this._ext);
    }
  }

  async handleSipInfo(){
    const jssip_session = this._confm._jssipRTCSessions.get(this._ext);
    let body = `<?xml version="1.0" encoding="utf-8" ?>
  <media_control>
    <vc_primitive>
      <to_encoder>
        <picture_fast_update/>
      </to_encoder>
    </vc_primitive>
  </media_control>`;

    return jssip_session.sendInfo('application/media_control+xml', body)
  }

  async requestKeyframeAndSleep() {
    let ms = param('asterisk.sip_media_request_interval');
    if (ms) {
      await this.handleSipInfo();
      return new Promise(resolve => {
        this._sipIntervalTimeout = setInterval(async () => {
          debug(`Request Key frame and sleep: ${ms} ms`);
          // try {
          await this.handleSipInfo().catch(e => {
            debug(`${e}\nClearing picture_fast_update SIP INFO interval`);
            clearInterval(this._sipIntervalTimeout);
          });
          resolve
        }, ms);
      });
    }
  }
}

module.exports = ClientSession;