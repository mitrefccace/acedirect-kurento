const debug = require('debug')('ace:webrtc-session');
const Events = require('events');
const param = require('param');
const uuid = require('uuid');
const Kurento = require('kurento-client');
const transform = require('sdp-transform');
const models = require('./dal/models');
const SDES = Kurento.getComplexType('SDES');
const IceCandidate = Kurento.getComplexType('IceCandidate');
const crypto = require('crypto');
const util = require('./util');
const RecMan = require('./rec_manager');

const PARTICIPANT_TYPE_WEBRTC = 'participant:webrtc';
const PARTICIPANT_TYPE_RTP = 'participant:rtp';

const replaceMediaEl = async (el, oldEl, newEl) => {
  await el.disconnect(oldEl);
  await oldEl.disconnect(el);

  await el.connect(newEl);
  await newEl.connect(el);
};

var kurento = null;

const ASTERISK_QUEUE_EXT = param('asterisk.ami.queue_extensions');


class WebRTCMediaSession extends Events {

  constructor(videoCodec = 'H264') {
    super();
    this._id = uuid.v4();
    this._pipeline = null;
    this._composite = null;
    this._videoCodec = videoCodec.toUpperCase();
    this._participants = new Map();
    this._statIntervals = [];
    this._iceCandidates = new Map();
    this._rtp_max_bitrate = param('kurento.video_rtp_max_bitrate') || 100;
    this._h264Config = param('kurento.h264_config');
    this._virtualPeers = new Map();
    this._lastWebrtcFmtp = null;
    debug(`Starting %s video call (%s)`, this.id, this._videoCodec);
  }

  get id() {
    return this._id;
  }

  get sid() {
    return this._id.substring(0, this._id.indexOf('-'));
  }

  get isMultiparty() {
    return this._participants.size > 2;
  }

  get atMaxCapacity() {
    return this._participants.size === param('conference_max_participants');
  }

  async init() {
    debug('Initializing WebRTC session');
    try {

      if (kurento == null) {
        debug('CREATING KURENTO');
        kurento = await util.getKurentoClient(param('kurento.url'), 5000);
      }

      if (!kurento) throw new Error(`Can't create kurento client`);
      this._pipeline = await kurento.create('MediaPipeline');
      await this._pipeline.setLatencyStats(true);
    } catch (error) {
      debug('Error creating WebRTC session:', error);
    }
  }

  _addParticipant(type, ext, endpoint, session = null) {
    debug(`_addParticipant ${ext}`);
    const p = {
      ext,
      type,
      endpoint,
      session,
      recorder: null,
      player: null,
      onHold: false,
      port: null,
      extra: null
    };
    if (ASTERISK_QUEUE_EXT && ASTERISK_QUEUE_EXT.indexOf(ext) >= 0) {
      this._virtualPeers.set(ext, p);
      return;
    }
    this._participants.set(ext, p);
    endpoint.on('MediaStateChanged', async evt => {
      debug(`${type}[${ext}] ${evt.oldState} -> ${evt.newState}`);
      const p = this._participants.get(ext);
      if (evt.newState === 'CONNECTED' && !p.recorder && param('kurento.recording_all_enabled')) {
        this.toggleRecording(ext, true);
      }
    });
    debug(`${ext}/${type} joined the session ${this.sid}`);
    this.debugParticipants();
    return p;
  }

  debugParticipants() {
    debug(`Session ${this.sid}`);
    for (const p of this._participants.values()) {
      debug(`  > ${p.ext}: ${p.type} / src = ${p.player ? 'player' : 'endpoint'} / rec =  ${p.recorder ? 'yes' : 'no'}`);
      debug(`    port = ${p.port ? 'yes' : 'no'} / hold = ${p.onHold ? 'yes' : 'no'}`);
    }
  }

  async _reconfigureVideo() {
    if (this._participants.size === 1) {
      debug(`Only one participant. Not connecting yet...`);
      return;
    } else if (this.isMultiparty) {
      debug(`Configuring video as multiparty`);
      this.debugParticipants();
      if (!this._composite) {
        this._composite = await this._pipeline.create('Composite');
      }
      for (const p of this._participants.values()) {
        if (!p.port) {
          const port = await this._composite.createHubPort();
          p.port = port;
          const source = p.player || p.endpoint;
          await source.connect(port);
          await port.connect(p.endpoint);
        }
      }
    } else {
      debug(`Configuring video as one to one`);
      this.debugParticipants();
      const [pA, pB] = Array.from(this._participants.values());
      const pAsource = pA.player || pA.endpoint;
      const pBsource = pB.player || pB.endpoint;
      if (pA.port) {
        await pA.port.disconnect(pA.endpoint);
        await pAsource.disconnect(pA.port);
        await pA.port.release();
        pA.port = null;
      }
      if (pB.port) {
        await pB.port.disconnect(pB.endpoint);
        await pBsource.disconnect(pB.port);
        await pB.port.release();
        pB.port = null;
      }
      if (this._composite) {
        await this._composite.release();
        this._composite = null;
      }
      await pAsource.connect(pB.endpoint);
      await pBsource.connect(pA.endpoint);
    }

    debug(`/reconfigureVideo`);
    this.debugParticipants();
  }

  _broadcastParticipants() {
    const simplePartList = [];
    this._participants.forEach(p => {
      const { ext, type, onHold } = p;
      simplePartList.push({ ext, type, onHold });
    });
    this._participants.forEach(p => {
      if (p.type === PARTICIPANT_TYPE_WEBRTC && p.session
        && typeof p.session.updateParticipants === 'function') {
        p.session.updateParticipants(simplePartList);
      }
    });
  }

  async _addWebrtcPeer(peer, offer, bitrates) {
    const webrtc = await this._pipeline.create('WebRtcEndpoint');
    const customWebrtcCodec = param('kurento.video_webrtc_codec') || this._videoCodec;
    webrtc.on('OnIceCandidate', (evt) => {
      const candidate = Kurento.getComplexType('IceCandidate')(evt.candidate);
      peer.sendIce(candidate);
    });
    const candidates = this._iceCandidates.get(peer.ext);
    if (candidates) {
      debug(`Adding ${candidates.length} early candidates`);
      for (const candidate of candidates) {
        await webrtc.addIceCandidate(new IceCandidate(candidate));
      }
    }
    this._lastWebrtcFmtp = 'webrtc';
    // Here we pass an optional custom codec to force a specific codec in the WebRTC leg different than the RTP leg
    offer = this.filterCodecs(offer, customWebrtcCodec);
    if (bitrates && bitrates.video) {
      if (bitrates.video.max) await webrtc.setMaxVideoSendBandwidth(bitrates.video.max);
      if (bitrates.video.min) await webrtc.setMinVideoSendBandwidth(bitrates.video.min);
    }
    debug('WEBRTC FILTERED OFFER, with specified preferred video codec: ' + this._videoCodec);
    debug(offer);
    const answer = await webrtc.processOffer(offer);
    webrtc.gatherCandidates();
    debug('WEBRTC ANSWER');
    debug(answer);
    peer.sendSdp(answer);
    const oldPartic = this._participants.get(peer.ext);
    const p = this._addParticipant(PARTICIPANT_TYPE_WEBRTC, peer.ext, webrtc, peer);

    if (oldPartic && oldPartic.type === PARTICIPANT_TYPE_RTP) {
      // Peer already existed but was RTP
      p.extra = oldPartic.endpoint;
      await p.endpoint.connect(p.extra, 'AUDIO');
      debug('Peer (%s) already existed as (%s). Connecting audio', peer.ext, oldPartic.type)
    }
    return webrtc;
  }

  async _createRtpEndpoint() {
    debug('Create RTP Endpoint');
    debug(this._pipeline);
    const rtp = await this._pipeline.create('RtpEndpoint', param('kurento.sdes_crypto') ? {
      crypto: new SDES({
        crypto: param('kurento.sdes_crypto'),
        key: this.generateKey()
      })
    } : undefined);
    await rtp.addTag('PARTICIPANT_TYPE', PARTICIPANT_TYPE_RTP);
    rtp.on('MediaFlowInStateChange', evt => {
      debug('\nRTP MediaFlowInStateChange (%s)\n', evt.state)
    });
    rtp.on('MediaFlowOutStateChange', evt => {
      debug('\nRTP MediaFlowOutStateChange (%s)\n', evt.state)
    });
    return rtp;
  }

  async addWebrtcPeer(peer, offer, bitrates) {
    const webrtc = await this._addWebrtcPeer(peer, offer, bitrates);
    this.collectStats(peer.ext, webrtc, 'AUDIO');
    this.collectStats(peer.ext, webrtc, 'VIDEO');

    this._reconfigureVideo();
    this._broadcastParticipants();
  }

  async leave(ext, virtual = false, disableFinishCall = false) {
    debug('LEAVE!!!', virtual, disableFinishCall);
    const peers = virtual ? this._virtualPeers : this._participants;
    debug(JSON.stringify(ext));
    // debug(peers);
    const p = peers.get(ext);
    // debug(p);
    if (p) {
      peers.delete(ext);
      if (p.extra) {
        await p.endpoint.disconnect(p.extra, 'AUDIO');
        await p.extra.release();
      }
      if (p.recorder) {
        const recorder = p.recorder;
        p.recorder = null;
        await recorder.stopAndWait();
        await recorder.release();
      }
      if (p.player) {
        const player = p.player;
        p.player = null;
        await player.stop();
        await player.release();
      }
      if (p.port) {
        p.port.release();
      }
      if (p.endpoint) {
        p.endpoint.release();
      }
      debug(`${ext} left the session ${this.sid}`);
      debug(`${this._participants.size} participants in session`);
      debug(this._participants)
    }
    if (virtual || disableFinishCall) return;

    if (this._participants.size <= 1) {
      this.finish();
    } else {
      this._reconfigureVideo();
      this._broadcastParticipants();
    }
  }

  async restartWebrtcPeer(peer, offer) {
    debug('Restart WebRTC Endpoint');

    await this.leave(peer.ext, false, true);
    const webrtc = await this._addWebrtcPeer(peer, offer);

    this.collectStats(peer.ext, webrtc, 'AUDIO');
    this.collectStats(peer.ext, webrtc, 'VIDEO');

    // try uncomment this later
    await this._reconfigureVideo();
    await this._broadcastParticipants();
  }

  async restartRtpPeer(part, offer, session) {
    let answer;
    debug(this._participants);
    for (let participant of this._participants) {
      debug('PARTICIPANT');
      debug(participant[1]);
      if (participant[1].type === PARTICIPANT_TYPE_RTP) {
        debug('Restart RTP Endpoint', participant[1].ext);
        // debug(await this._pipeline.getChilds());
        await this.leave(participant[1].ext, false, true);

        answer = await this.addRtpPeer(participant[1].ext, offer, session, true);
        await this._reconfigureVideo();
        await this._broadcastParticipants();
        return answer;
      }
    }
  }

  collectStats(peer, webrtc, media) {
    const interval = param('kurento.stats_interval');
    const monitoring_enabled = param('kurento.monitoring_enabled');
    if (monitoring_enabled && interval) {
      const id = setInterval(() => {
        webrtc.getStats(media, async (error, stats) => {
          if (error) {
            debug('Error fetching stats', error.message);
          } else {
            models.WebrtcStat.persistStats(this.id, media.toLowerCase(), peer, stats)
          }
        });
      }, interval);
      this._statIntervals.push(id);
    }
  }

  async addRtpPeer(ext, offer, sipSession, filterCodecs) {
    const rtp = await this._createRtpEndpoint();
    // const customWebrtcCodec = param('kurento.video_webrtc_codec') || this._videoCodec;
    rtp.on('Error', (error) => {
      debug(`RTPEndpoint ${ext} error: ${error}`);
    });
    await rtp.setOutputBitrate(this._rtp_max_bitrate * 1000);
    const p = this._participants.get(ext);
    if (p) {
      debug('EXTRA, connect audio only');
      p.extra = rtp;
      await p.endpoint.connect(rtp, 'AUDIO');
    } else {
      this._addParticipant(PARTICIPANT_TYPE_RTP, ext, rtp, sipSession);
    }
    this._reconfigureVideo();
    this._broadcastParticipants();
    if (offer) {
      offer = this.patchOffer(offer);
      // Force codec for the rtp too
      if (filterCodecs) {
        offer = this.filterCodecs(offer);
      }
      // Processes SDP offer of the remote peer, and generates an SDP answer based on the endpoint's capabilities.
      const rtpAnswer = await rtp.processOffer(offer);
      debug('RTP ANSWER');
      debug(rtpAnswer);
      return rtpAnswer;
    } else {
      const offer = await rtp.generateOffer();
      const patchedOffer = this.patchOffer(offer);
      if (filterCodecs) {
        return this.filterCodecs(patchedOffer);
      } else {
        return patchedOffer;
      }
    }
  }

  handleRtpAnswer(ext, answer) {
    const p = this._participants.get(ext) || this._virtualPeers.get(ext);
    if (!p) {
      throw new Error(`No participant registered for ${ext}`);
    }
    if (p.type !== PARTICIPANT_TYPE_RTP) {
      throw new Error(`Participant ${ext} is not RTP`);
    }
    return p.endpoint.processAnswer(answer);
  }

  handleIce(ext, candidate) {
    const p = this._participants.get(ext);
    if (!p || p.type !== PARTICIPANT_TYPE_WEBRTC) {
      const list = this._iceCandidates.get(ext) || [];
      list.push(candidate);
      this._iceCandidates.set(ext, list);
      return;
    }
    p.endpoint.addIceCandidate(new IceCandidate(candidate));
  }

  finish() {
    this.emit('finished');
    this._statIntervals.forEach(clearInterval);
    if (this._pipeline) {
      this._pipeline.release();
    }
    this._participants.forEach(p => {
      if (p.session) {
        if (p.type === PARTICIPANT_TYPE_WEBRTC) {
          p.session.sessionStopped(this.id);
        }
      }
    });
    debug(`Session ${this.sid} finished`);
  }

  patchOffer(offer) {
    const sdpObj = transform.parse(offer);
    sdpObj.origin.address = param('asterisk.ip');
    sdpObj.connection.ip = param('asterisk.ip');

    sdpObj.media.forEach(media => {
      const validPayloads = new Set(
        media.rtp.filter(x => {
          if (x.codec.toUpperCase() === this._videoCodec || this.isDefaultValidCodec(x.codec.toUpperCase())) return true;
          debug(`Session [%s] Ignoring codec: %s`, this.id, x.codec);
          return false;
        }).map(x =>
          x.payload
        ));
      if (this._videoCodec === 'H264' && media.fmtp.length == 0 && this._h264Config) {
        for (var it = validPayloads.values(), val = null; val = it.next().value;) {
          if (this._lastWebrtcFmtp && this._lastWebrtcFmtp != 'webrtc') {
            media.fmtp.push({ payload: val, config: this._lastWebrtcFmtp })
            this._lastWebrtcFmtp = null;
          } else {
            media.fmtp.push({ payload: val, config: this._h264Config }) //use config value for 
          }
        }
      }
    });


    return transform.write(sdpObj);
  }

  async hold(ext, hold) {
    const p = this._participants.get(ext);
    if (!p) {
      throw new Error(`No participant registered for ${ext}`);
    }
    let method;
    if (hold) {
      if (p.onHold) return false; // Already on hold
      method = 'disconnect';
    } else {
      if (!p.onHold) return false; // Not hold
      method = 'connect';
    }
    if (this.isMultiparty) {
      await (p.player || p.endpoint)[method](p.port);
      await p.port[method](p.endpoint);
    } else {
      const other = this.oneToOnePeer(ext);
      if (other) {
        await (other.player || other.endpoint)[method](p.endpoint);
        await (p.player || p.endpoint)[method](other.endpoint);
      }
    }
    p.onHold = hold;
    return true;
  }

  async toggleRecording(ext, record) {
    const participant = this._participants.get(ext);
    if (record && participant.recorder) return true; // Already recording
    if (!record && !participant.recorder) return true; // Already not recording
    try {
      if (record) {
        debug(`${ext} Start recording`);
        const date = this.getTimestampString();
        const profile = param('kurento.recording_media_profile');
        const fileName = `rec_${ext}_${date}.${profile.toLowerCase()}`;
        const filePath = `file:///tmp/${fileName}`;
        debug(`${ext} recording to  ${filePath}`);

        const recorder = await this._pipeline.create('RecorderEndpoint', {
          uri: filePath,
          mediaProfile: profile
        });
        await participant.endpoint.connect(recorder);

        let timeoutRecording;
        recorder.on('UriEndpointStateChanged', evt => {
          debug(`${ext}: Recorder state is now ${evt.state}`);
          if (evt.state === 'START') {
            timeoutRecording = setTimeout(() => {
              const p = this._participants.get(ext);
              if (!p || !p.recorder) return;
              debug(`${ext}: Stopping recording / timeout.`);
              const rec = p.recorder;
              p.recorder = null;
              rec.stopAndWait();
            }, param('kurento.recording_limit_length_in_sec') * 1000);
          } else if (evt.state === 'STOP') {
            if (timeoutRecording) clearTimeout(timeoutRecording);
          }
        });
        await recorder.record();
        participant.recorder = recorder;
        await RecMan.createRecording(fileName, ext, this._id);
      } else {
        await participant.recorder.stopAndWait();
        await participant.recorder.release();
        participant.recorder = null;
        debug(`${ext} Stopped recording`);
      }
      return true;
    } catch (ex) {
      debug(`${ext} Recording error: ${ex.message}`);
    }
  }

  generateKey(size = 30) {
    const key = [];
    const buffer = crypto.randomBytes(size);
    buffer.forEach(b => {
      key.push(String.fromCharCode(b % 96 + 32));
    });
    return key.join('');
  }

  async handleReinvite(ext, offer) {
    debug(`${ext} Reinvite received`);
    const p = this._participants.get(ext) || this._virtualPeers.get(ext);
    if (!p) {
      throw new Error(`No participant registered for ${ext}`);
    }

    // disconnect asterisk queue finding extension
    // and return to use webrtc directly
    // REMOVED: return to fix ace quill audio issues
    if (ASTERISK_QUEUE_EXT && ASTERISK_QUEUE_EXT.indexOf(ext) >= 0) {
      debug(`${ext} Re-invite`, offer);
      await this.leave(ext, true);
    }

    const rtp = await this._createRtpEndpoint();
    if (this.isMultiparty) {
      await replaceMediaEl(p.port, p.endpoint, rtp);
    } else {
      const other = this.oneToOnePeer(ext);
      await replaceMediaEl(other.endpoint, p.endpoint, rtp)
    }
    const answer = await rtp.processOffer(offer);
    await p.endpoint.release();
    p.endpoint = rtp;
    return answer;
  }

  // This should only happen when there's only one peer 
  // and the callee can't be reached
  async onFailed(ext, reason) {
    this._participants.forEach(p => {
      if (p.session && p.type === PARTICIPANT_TYPE_WEBRTC) {
        p.session.sessionStopped(this.id, `Call to ${ext} failed: ${reason}`);
      }
    });
  }

  async enablePrivateMode(ext, file) {
    const p = this._participants.get(ext);
    if (!p) {
      throw new Error(`No participant registered for ${ext}`);
    }
    if (p.player) {
      debug(`${ext} Private mode already enabled`);
      return;
    }
    const player = this._pipeline.create('PlayerEndpoint', {
      uri: file
    });
    p.player = player;
    player.on('Error', err => {
      debug('Player error: %s', err.message || JSON.stringify(err));
    });
    player.on('EndOfStream', () => {
      p.player && p.player.play();
    });

    player.play();

    if (this.isMultiparty) {
      await p.endpoint.disconnect(p.port);
      await player.connect(p.port);
    } else {
      const other = this.oneToOnePeer(ext);
      if (other) {
        await p.endpoint.disconnect(other.endpoint);
        await player.connect(other.endpoint);
      }
    }
  }

  async disablePrivateMode(ext) {
    const p = this._participants.get(ext);
    if (!p) {
      throw new Error(`No participant registered for ${ext}`);
    }
    if (!p.player) return; // Not in private mode
    const player = p.player;
    p.player = null;

    if (this.isMultiparty) {
      await player.disconnect(p.port);
      await p.endpoint.connect(p.port);
    } else {
      const other = this.oneToOnePeer(ext);
      if (other) {
        await player.disconnect(other.endpoint);
        await p.endpoint.connect(other.endpoint);
      }
    }
    await player.stop();
    await player.release();
  }

  oneToOnePeer(myExt) {
    for (const p of this._participants.values()) {
      if (p.ext !== myExt) return p;
    }
    return null;
  }

  // UTILS
  /**
   * Get timestamp string format "YYYYMMDD_HHMMSS"
   *
   * @return {String}
   */
  getTimestampString() {
    var time = new Date();
    var year = time.getFullYear();
    var month = time.getMonth() + 1; //Incremented because of indexing at 0
    var day = time.getDate();
    var hours = time.getHours() + 1; //Incremented because of indexing at 0
    var minutes = time.getMinutes();
    var seconds = time.getSeconds();
    return `${year}${month < 10 ? '0' : ''}${month}${day < 10 ? '0' : ''}${day}_${hours < 10 ? '0' : ''}${hours}${minutes < 10 ? '0' : ''}${minutes}${seconds < 10 ? '0' : ''}${seconds}`;
  }

  /**
   * Validates alternative non-video codecs that are accepted: retransmission (RTX), redundant coding (RED), and forward error correction (FEC)
   *
   * @return {boolean}
   */
  isDefaultValidCodec(codec) {
    if (codec === 'RTX' || codec === 'RED' || codec === 'FEC' || codec === 'ULPFEC') {
      return true;
    }
    return false
  }

  /**
   * Modify SDP to force using the conference's codecs
   *
   * @return {String}
   */
  filterCodecs(sdp, customCodec) {
    let sdpObj = transform.parse(sdp);
    let auxCodec;
    if (customCodec) {
      auxCodec = this._videoCodec;
      this._videoCodec = customCodec;
    }
    debug('H264 Configuration: %s', this._h264Config);
    sdpObj.media.forEach(media => {
      if (media.type === 'video') {
        const validPayloads = new Set(
          media.rtp.filter(x => {
            if (x.codec.toUpperCase() === this._videoCodec || this.isDefaultValidCodec(x.codec.toUpperCase())) return true;
            debug(`Session [%s] Ignoring codec: %s`, this.id, x.codec);
            return false;
          }).map(x =>
            x.payload
          ));
        const specifiedCodecPayloads = new Set(
          media.rtp.filter(x => {
            if (x.codec.toUpperCase() === this._videoCodec) return true;
            return false;
          }).map(x =>
            x.payload
          ));
        debug(`Session [%s] Valid payloads after filter: %s`, this.id, validPayloads.size);
        media.rtp = media.rtp.filter(x => validPayloads.has(x.payload));
        media.fmtp = media.fmtp.filter(x => validPayloads.has(x.payload));
        media.rtcpFb = media.rtcpFb ? media.rtcpFb.filter(x => validPayloads.has(x.payload)) : media.rtcpFb;
        media.payloads = Array.from(validPayloads).join(' ');
        if (this._videoCodec === 'H264' && this._lastWebrtcFmtp == 'webrtc') { //Try to get the agent fmtp line from webrtc add peer
          if (media.fmtp.length > 0) {
            for (let i = 0; i < media.rtp.length; i++) {
              if (media.rtp[i].codec === 'H264') {
                this._lastWebrtcFmtp = media.fmtp[i].config
                break;
              }
            }
            if (this._lastWebrtcFmtp == 'webrtc') // no h264 fmtp found. set flag to null
              this._lastWebrtcFmtp = null;
          } else {
            this._lastWebrtcFmtp = null;
          }
        } else if (this._videoCodec === 'H264' && media.fmtp.length > 0 && this._h264Config) { //  Configure H264 codec to force profile-level-id and packetization mode
          let fmtpVideoCodec = media.fmtp.filter(x => specifiedCodecPayloads.has(x.payload));
          fmtpVideoCodec.forEach(fmtp => {
            fmtp.config = this._h264Config;
          });
        }
      }
    });
    if (customCodec)
      this._videoCodec = auxCodec;

    return transform.write(sdpObj);
  }
}

module.exports = WebRTCMediaSession;
