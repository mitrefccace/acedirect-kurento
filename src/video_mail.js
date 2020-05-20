const debug     = require('debug')('ace:video-mail');
const Events    = require('events');
const param     = require('param');
const uuid      = require('uuid');
const models    = require('./dal/models');
const Kurento   = require('kurento-client');
const SDES      = Kurento.getComplexType('SDES');
const crypto    = require('crypto');
const util      = require('util');

class VideoMail extends Events {

  constructor() {
    super();
    this._id = uuid.v4();
    this._rtp = null;
    this._peer = null;
    this._player = null;
    this._recorder = null;
    this._pipeline = null;
    this._instructions = false;
    this._finished = false;
  }

  get id() {
    return this._id;
  }

  async init() {
    debug('Initializing video mail');
    try {
      const kurento = await Kurento.getSingleton(param('kurento.url'));
      this._pipeline = await kurento.create('MediaPipeline');
      await this._pipeline.setLatencyStats(true);
    } catch (error) {
      debug('Error creating WebRTC session:', error);
    }
  }

  async setPeer(peer, offer) {
    this._peer = peer;
    await this.init();
    const rtp = await this._pipeline.create('RtpEndpoint', {
      // crypto: new SDES({
      //   crypto: param('kurento.sdes_crypto'),
      //   key: this.generateKey()
      // })
    });
    const answer = await rtp.processOffer(offer);
    this._rtp = rtp;
    return answer;
  }

  async start() {
    this._instructions = true;
    const files = param('videomail.instructions_media');
    for (const file of files) {
      const times = file.endsWith('png') || file.endsWith('jpg') ? 5 : 1;
      try { 
        await this._playFile(file, times);
        if(!this._instructions) return;
      } catch(err) {
        debug(`Can't play ${file}: ${err.message}`);
      }
    }
  }

  async _playFile(file, times = 1) {
    const uri = file.startsWith('http') ? file : `file://${file}`;
    this._player = await this._pipeline.create('PlayerEndpoint', {
      uri
    });
    this._player.connect(this._rtp);
    while(times > 0) {
      debug('Playing %s for %s', file, this._peer.ext);
      await this._playFilePromise(this._player);
      if (!this._instructions) break;
      times--;
    }
    this._player.disconnect(this._rtp);
  }
  
  _playFilePromise(player) {
    return new Promise((success, failure) => {
      player.play();
      player.on('Error', failure);
      player.on('EndOfStream', success);
    });
  }

  async handleDTMF(dtmf) {
    if(dtmf.tone === '1') {
      this._player && this._player.stop();
      this._instructions = false;
      const files = param('videomail.instructions_media');
      await this._playFile(files[files.length - 1]);
      await this._startRecording();
    } else if (dtmf.tone === '*') {
      this.finish();
    }
  }

  async _startRecording() {
    const dir = param('videomail.directory');
    const profile = param('videomail.media_profile');
    const ext = profile.toLowerCase();
    const filename = `${this._id}.${ext}`;
    
    this._recorder = new this._pipeline.create('RecorderEndpoint', {
      uri: `file://${dir}/${filename}`,
      mediaProfile: profile.toUpperCase()
    });
    this._recorder.on('Error', evt => {
      debug('Recording error:', evt);
    });
    await this._rtp.connect(this._recorder);
    await this._recorder.record();
    await models.VideoMail.create({
      peer: this._peer.ext,
      filename
    });
  }

  finish() {
    if (this._finished) return;
    this._finished = true;
    if(this._recorder) {
      this._recorder.stopAndWait(() => {
        this._pipeline.release();
        this.emit('finished');
      });
      return;
    }
    if (this._pipeline) {
      this._pipeline.release();
    }
    this.emit('finished');
  }

  generateKey(size = 30) {
    const key = [];
    const buffer = crypto.randomBytes(size);
    buffer.forEach(b => {
      key.push(String.fromCharCode(b % 96 + 32));
    });
    return key.join('');
  }
}

module.exports = VideoMail;