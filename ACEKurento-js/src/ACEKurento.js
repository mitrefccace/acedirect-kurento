/**
 * ACEKurento object.
 * @constructor
 * @param {Object} config - Configuration parameters.
 * @param {String} configuration.connectionId
 * @param {String} configuration.acekurentoSignalingUrl
 * @param {String} configuration.displayName
 * @param {String} configuration.sipUsername
 * @param {String} configuration.sipPassword
 * @param {Boolean} configuration.guestUser
 * @param {String} configuration.sipUri
 * @example
 * // creates a ACEKurento instance that connects to wss://localhost:8443/signaling
 * // websocket server and uses "test" as display name when SIP calling
 *
 * var acekurento = new ACEKurento({
 *   acekurentoSignalingUrl: 'wss://localhost:8443/signaling',
 *   displayName: 'test'
 * });
 * @returns {Object} acekurento
 */
function ACEKurento(config) {
  var ws;
  if (config && config.hasOwnProperty('acekurentoSignalingUrl')) {
    ws = new WebSocket(config.acekurentoSignalingUrl);
  } else {
    ws = new WebSocket('wss://' + window.location.host + '/signaling');
  }
  var selfStream;
  var remoteStream;
  var webRtcPeer;

  const NOT_REGISTERED = 0;
  const REGISTERING = 1;
  const REGISTERED = 2;
  var registerState = NOT_REGISTERED;

  const NO_CALL = 0;
  const PROCESSING_CALL = 1;
  const IN_CALL = 2;
  // var callState = null;
  var holdCb = null;
  var peerOnHold = false;

  /** @member {Object} */
  var acekurento = acekurento || {};
  
  // extend.js
  // Written by Andrew Dupont, optimized by Addy Osmani
  function extend(destination, source) {

    var toString = Object.prototype.toString,
    objTest = toString.call({});

    for (var property in source) {
      if (source[property] && objTest === toString.call(source[property])) {
        destination[property] = destination[property] || {};
        extend(destination[property], source[property]);
      } else {
        destination[property] = source[property];
      }
    }
    return destination;

  }

  /**
   * We extend ACEKurento to be a global var to execute ACEKurento functions
   */
  extend(acekurento, {
    /**
     * WebSocket object
     */
    ua: ws,
    /**
     * Indicate if video should be used or not.
     */
    enableVideo: true,
    /**
     * Indicate if audio should be used or not.
     */
    enableAudio: true,
    /**
     * The actual WebRTC session
     */
    rtcSession: {},
    /**
     * The WebRTC local stream
     */
    selfStream: this.selfStream || null,
    /**
     * The WebRTC remote stream
     */
    remoteStream: this.remoteStream || null,
    /**
     * PeerConnection function, returns pc
     */
    pc: function () {
      return webRtcPeer.peerConnection
    },
    /**
     * Media Stream function, a interface represents a stream of local media content
     */
    mediaStream: function () {
      return webRtcPeer.localVideo.srcObject
    },
    /**
     * Call id for current session
     */
    callid: "",
    /**
     * Call id of previous session
     */
    previous_callid: "",
    /**
     * Call state string
     */
    callState: this.callState || null,
    /**
     * Call isLoopback boolean
     */
    isLoopback: this.isLoopback || false,
    /**
     * Call IsScreensharing boolean
     */
    isScreensharing: this.isScreensharing || false,
    /**
     * Configuration object use to hold authentication data as well as other config call parameters.
     * You can find the available config options in {@link ACEKurento}
     */
    configuration: {
      'connectionId': undefined,
      'acekurentoSignalingUrl': this.acekurentoSignalingUrl,
      'displayName': this.displayName,
      'sipUsername': this.sipUsername,
      'sipPassword': this.sipPassword,
      'guestUser': false,
      'sipUri': this.sipUri
    },
    /**
     * Event handlers. {@link #Events}
     */
    eventHandlers: {
      /**
       * Connected Event
       * @event {Function} connected
       * @example
       * // displays "'--- Connected ---" in console log when connected to asterisk
       * var eventHandlers = {
       *   'connected': function (e) {
       *     console.log('--- Connected ---\n');
       *   }
       * }
       * acekurento.eventHandlers = Object.assign(acekurento.eventHandlers, eventHandlers);
       */
      'connected': function (e) {},
      /**
       * Register Response Event
       * @event {Function} registerResponse
       */
      'registerResponse': function (e) {},
      /**
       * Call Response Event
       * @event {Function} callResponse
       */
      'callResponse': function (e) {},
      /**
       * Call incoming Event
       * @event {Function} incomingCall
       */
      'incomingCall': function (e) {},
      /**
       * Call in progress Event
       * @event {Function} progress
       */
      'progress': function (e) {},
      /**
       * Call Accepted Event
       * @event {Function} accepted (20X sent/received)
       */
      'accepted': function (e) {},
      /**
       * Call sipConfirmed Event (ACK sent/received)
       * @event {Function} sipConfirmed
       */
      'sipConfirmed': function (e) {},
      /**
       * Call error Event
       * @event {Function} callError
       */
      'callError': function (e) {},
      /**
       * Call ended Event
       * @event {Function} ended
       */
      'ended': function (e) {},
      /**
       * Call queue paused Event
       * @event {Function} pausedQueue
       */
      'pausedQueue': function (e) {},
      /**
       * Call queue unpaused Event
       * @event {Function} unpausedQueue
       */
      'unpausedQueue': function (e) {},
      /**
       * Call recording started Event
       * @event {Function} callRecording
       */
      'startedRecording': function (e) {},
      /**
       * Call recording stopped Event
       * @event {Function} stoppedRecording
       */
      'stoppedRecording': function (e) {},
      /**
       * Call invite to another peer response
       * @event {Function} inviteResponse
       */
      'inviteResponse': function (e) {},
      /**
       * Call transfer SIP request to peer response
       * @event {Function} callTransferResponse
       */
      'callTransferResponse': function (e) {},
      /**
       * Call reinvite to another peer response
       * @event {Function} reinviteResponse
       */
      'reinviteResponse': function (e) {},
      /**
       * Call SIP update to another peer response
       * @event {Function} updateResponse
       */
      'updateResponse': function (e) {},
      /**
       * Call webrtc peer restart response
       * @event {Function} restartCallResponse
       */
      'restartCallResponse': function (e) {},
      /**
       * Invoked when the number of participants on a call changes
       * @event {Function} participantsUpdate
       */
      'participantsUpdate': function (e) {},
      /**
       * newMessage Event
       * @event {Function} newMessage
       */
      'newMessage': function (e) {},
    },
    /**
     * Connect and call, loopback stream to Kurento
     * @param {Number} ext - It is the extension used for the loopback call
     */
    loopback: function (ext) {
      setCallState(PROCESSING_CALL);
      this.isLoopback = true;
      var options = {
        localVideo: this.selfStream,
        remoteVideo: this.remoteStream,
        onicecandidate: onIceCandidate,
        mediaConstraints: {
          audio: this.enableVideo,
          video: this.enableAudio
        }
      }
      console.log('create webRtcPeer ...');
      webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv(options, function (error) {
        if (error) {
          console.error(error);
          setCallState(NO_CALL);
        }
        console.log('created webRtcPeer');

        this.generateOffer(function (error, offerSdp) {
          if (error) {
            console.error(error);
            setCallState(NO_CALL);
          }
          console.log('Generate offer');

          var message = {
            id: 'loopback',
            ext: ext,
            sdp: offerSdp
          };
          sendMessage(message);
        });
      });
    },
    /**
     * Connect, register to node backend and Asterisk using JSSIP
     * @param {String} sipUsername - It is your sip uri, the uri of the caller/callee to register
     * @param {String} sipPassword - It is your sip password, the password of the caller/callee to register
     * @param {Boolean} isAgent - Boolean to let backend know if you are an agent
     */
    register: function (sipUsername, sipPassword, isAgent) {
      var ext = sipUsername || this.sipUsername;
      var password = sipPassword || this.sipPassword;

      if (!ext) {
        throw new Error("You must insert your user uri extension");
      }

      setRegisterState(REGISTERING);

      var message = {
        id: 'register',
        ext: ext,
        password: password,
        isAgent: isAgent
      };
      sendMessage(message);
    },
    /**
     * Makes a call
     * @param {String} uri - uri is the callee, the sip uri of the person to call
     * @param {Boolean} skipQueue - Skip queue, if "true" call sending media directly through Kurento (no Asterisk)
     */
    call: function (uri, skipQueue) {
      if (!uri) {
        console.log("You must specify the peer ext");
        return;
      } else if (acekurento.callState === PROCESSING_CALL || acekurento.callState === IN_CALL) {
        console.log("You are already on a call");
        return;
      }
      setCallState(PROCESSING_CALL);

      var options = {
        localVideo: this.selfStream,
        remoteVideo: this.remoteStream,
        onicecandidate: onIceCandidate,
        mediaConstraints: {
          audio: this.enableVideo,
          video: this.enableAudio
        }
      };
      console.log('create webRtcPeer ...');

      webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv(options, function (error) {
        if (error) {
          console.error(error);
          setCallState(NO_CALL);
        }
        console.log('created webRtcPeer');

        this.generateOffer(function (error, offerSdp) {
          if (error) {
            console.error(error);
            setCallState(NO_CALL);
          }
          console.log('Generate offer');

          var message = {
            id: 'call',
            uri: uri,
            sdp: offerSdp,
            skipQueue: skipQueue
          };
          sendMessage(message);
        });
      });
    },
    /**
     * Accepts an incoming call
     */
    acceptCall: function (message) {
      
      setCallState(PROCESSING_CALL);

      var options = {
        localVideo: this.selfStream,
        remoteVideo: this.remoteStream,
        onicecandidate: onIceCandidate,
        mediaConstraints: {
          audio: this.enableAudio,
          video: this.enableVideo
        }
      }

      webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv(options, function (error) {
        if (error) {
          console.error(error);
          setCallState(NO_CALL);
        }

        this.generateOffer(function (error, offerSdp) {
          if (error) {
            console.error(error);
            setCallState(NO_CALL);
          }
          var response = {
            id: 'accept',
            caller: message.caller,
            sdp: offerSdp
          };
          sendMessage(response);
        });
      });
    },
    /**
     * Decline incoming call
     */
    declineCall: function (message) {
      console.log('Incoming call! Call state: ' + this.callState);
      setCallState(PROCESSING_CALL);

      var response = {
        id: 'decline',
        caller: message.caller
      };
      sendMessage(response);
      acekurento.stop();
    },
    /**
     * Stops a call
     * @param {Boolean} removeFromQueue - removeFromQueue boolean "true" to send hangup message and leave member queue.
     * Else just hangup
     */
    stop: function (removeFromQueue) {
      (removeFromQueue) ? console.info('stop initiated! (And remove from queue)') : console.log('stop!');
      setCallState(NO_CALL);
      if (webRtcPeer) {
        webRtcPeer.dispose();
        webRtcPeer = null;
        // TODO totally stop media, camera led off
        // acekurento.mediaStream().getTracks().forEach(track => track.stop());
        var message = {
          id: 'stop',
          removeFromQueue: removeFromQueue
        }
        sendMessage(message);
      }
    },
    /**
     * Puts the other peer on hold, if possible
     * @param {acekurento~holdCallback} cb - The callback that handles the hold response.
     */
    hold: function (cb) {
      if (peerOnHold) {
        cb(true);
      } else {
        sendMessage({ id: 'hold' });
        holdCb = cb;
      }
    },
    /**
     * Unholds the peer, if possible
     * @param {acekurento~unholdCallback} cb - The callback that handles the unhold response.
     */
    unhold: function (cb) {
      if (!peerOnHold) {
        cb(true);
      } else {
        sendMessage({ id: 'unhold' });
        holdCb = cb;
      }
    },
    /**
     * Sends private video image to peer instead of local video stream
     * @param {Boolean} enabled - If "true" enables video private mode
     * @param {String} url - The video private mode url
     */
    privateMode: function (enabled, url) {
      sendMessage({ id: 'privacy', enabled: enabled, url: enabled ? url : undefined });
    },
    /**
     * ICE Restart
     */
    iceRestart: function () {
      console.info('pc createOffer restart');
      var pc = this.pc();
      pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        iceRestart: true
      }).then(function (offer) {
        console.info('Created SDP offer');
        // offer = mangleSdpToAddSimulcast(offer);
        return pc.setLocalDescription(offer);
      }).catch( function (e) {
        console.error(e);
      });
    },
    /**
     * Sends SIP Re-Invite
     * @param {String} customSdp - (optional) custom SDP to send for the reinvite
     */
    sipReinvite: function (customSdp) {
      var options = {
        localVideo: this.selfStream,
        remoteVideo: this.remoteStream,
        onicecandidate: onIceCandidate,
        mediaConstraints: {
          audio: this.enableVideo,
          video: this.enableAudio
        }
      }
      console.log('create webRtcPeer ...');
      webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv(options, function (error) {
        if (error) {
          console.error(error);
          setCallState(NO_CALL);
        }
        console.log('created webRtcPeer');
        this.generateOffer(function (error, offerSdp) {
          if (error) {
            console.error(error);
            setCallState(NO_CALL);
          }
          console.log('Generate offer');

          var message = {
            id: 'sipReinvite',
            sdp: (customSdp) ? customSdp : offerSdp
          };
          sendMessage(message);
        });
      });
    },
    /**
     * Sends SIP UPDATE
     * @param {String} customSdp - (optional) custom SDP to send for the SIP update
     */
    sipUpdate: function (customSdp) {
      var options = {
        localVideo: this.selfStream,
        remoteVideo: this.remoteStream,
        onicecandidate: onIceCandidate,
        mediaConstraints: {
          audio: this.enableVideo,
          video: this.enableAudio
        }
      }
      console.log('create webRtcPeer ...');
      webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv(options, function (error) {
        if (error) {
          console.error(error);
          setCallState(NO_CALL);
        }
        console.log('created webRtcPeer');
        this.generateOffer(function (error, offerSdp) {
          if (error) {
            console.error(error);
            setCallState(NO_CALL);
          }
          console.log('Generate offer');

          var message = {
            id: 'sipUpdate',
            sdp: (customSdp) ? customSdp : offerSdp
          };
          sendMessage(message);
        });
      });
    },
    /**
     * Pause Queue
     */
    pauseQueue: function () {
      var message = {
        id: 'pauseQueue'
      };
      sendMessage(message);
    },
    /**
     * Unpause Queue
     */
    unpauseQueue: function () {
      var message = {
        id: 'unpauseQueue'
      };
      sendMessage(message);
    },
    /**
     * Start Recording
     */
    startRecording: function () {
      var message = {
        id: 'startRecording'
      };
      sendMessage(message);
    },
    /**
     * Stop Recording
     */
    stopRecording: function () {
      var message = {
        id: 'stopRecording'
      };
      sendMessage(message);
    },
    /**
     * Start Playing Recording
     */
    startPlayingRecording: function () {
      var message = {
        id: 'startPlayingRecording'
      };
      sendMessage(message);
    },
    /**
     * Stop Playing Recording
     */
    stopPlayingRecording: function () {
      var message = {
        id: 'stopPlayingRecording'
      };
      sendMessage(message);
    },
    /**
     * Invite peer
     * @param {String} ext - ext is the callee extension, the person to call
     */
    invitePeer: function (ext) {
      var message = {
        id: 'invitePeer',
        ext: ext
      };
      sendMessage(message);
    },
    /**
     * Call transfer that allows hot/blind or warm transfer to peer

     * @param {String} ext - ext is the callee extension, the person to call
     * @param {Boolean} isBlind - used to do blind/hot transfer or warm transfer (started after invitePeer())
     */
    callTransfer: function (ext, isBlind) {
      var message = {
        id: 'callTransfer',

        ext: ext,
        isBlind: isBlind
      };
      sendMessage(message);
    },
    /**
     * Enable/Disable video or audio tracks
     * @param {Boolean} isActive - If "true" will disable/pause media type. Otherwise will resume a specified media type.
     * @param {Boolean} isAudio - If "true" will act on the audio media stream type. Otherwise it will act on the video type.
     */
    enableDisableTrack: function (isActive, isAudio) {
      var mediaStream = this.mediaStream();
      console.log("Set " + (isAudio ? "AUDIO" : "VIDEO") + " " + (isActive ? "ON" : "OFF"));

      if(isAudio) {
        mediaStream.getAudioTracks()[0].enabled = !(mediaStream.getAudioTracks()[0].enabled);
      } else {
        mediaStream.getVideoTracks()[0].enabled = !(mediaStream.getVideoTracks()[0].enabled);
      }

      console.log((isAudio ? "AUDIO" : "VIDEO") + " is " + (isActive ? "ON" : "OFF"));
    },
    /**
     * Screenshare to Kurento
     * @param {Boolean} enable - If "true" will enable screenshare. Otherwise will stop and use camera.
     */
    screenshare: function (enable) {
      var options = {
        localVideo: this.selfStream,
        remoteVideo: this.remoteStream,
        sendSource: enable ? 'screen' : 'webcam',
        onicecandidate: onIceCandidate,
        mediaConstraints: {
          audio: this.enableVideo,
          video: this.enableAudio
        }
      }
      console.log('create webRtcPeer ...');
      webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv(options, function (error) {
        if (error) {
          console.error(error);
          setCallState(NO_CALL);
        }
        console.log('created webRtcPeer');
        acekurento.isScreensharing = enable;
        this.generateOffer(function (error, offerSdp) {
          if (error) {
            console.error(error);
            setCallState(NO_CALL);
          }
          console.log('Generate offer');

          var message = {
            id: 'restartCall',
            sdp: offerSdp
          };
          sendMessage(message);
        });
      });
    }
  });

  function setRegisterState(nextState) {
    switch (nextState) {
      case NOT_REGISTERED:
        break;

      case REGISTERING:
        break;

      case REGISTERED:
        setCallState(NO_CALL);
        break;

      default:
        return;
    }
    registerState = nextState;
  }

  function setCallState(nextState) {
    switch (nextState) {
      case NO_CALL:
        break;

      case PROCESSING_CALL:
        break;
      case IN_CALL:
        break;
      default:
        return;
    }
    acekurento.callState = nextState;
  }

  window.onbeforeunload = function () {
    ws.close();
  }

  ws.onmessage = function (message) {
    try {
      message = JSON.parse(message.data);
    } catch (e) {
      message = message.data;
    }
    console.info('Received message data: ' + JSON.stringify(message));

    switch (message.id) {
      case 'registerResponse':
        registerResponse(message);
        acekurento.eventHandlers.registerResponse(message.error);
        // acekurento.event.trigger("registerResponse", message);
        break;
      case 'callResponse':
        callResponse(message);
        acekurento.eventHandlers.callResponse(message);
        // acekurento.event.trigger("callResponse", message);
        break;
      case 'incomingCall':
        handleIncomingCall(message)
        // acekurento.event.trigger("incomingCall", message);
        break;
      case 'sdp':
        startCommunication(message);
        acekurento.eventHandlers.progress(message);
        // acekurento.event.trigger("startCommunication", message);
        break;
      case 'sipConfirmed':
        acekurento.eventHandlers.sipConfirmed(message);
        break;
      case 'sessionStopped':
        acekurento.stop();
        acekurento.eventHandlers.ended(message);
        // acekurento.event.trigger("stopCommunication", message);
        break;
      case 'pausedQueue':
        acekurento.eventHandlers.pausedQueue(message);
        break;
      case 'unpausedQueue':
        acekurento.eventHandlers.unpausedQueue(message);
        break;
      case 'startedRecording':
        acekurento.eventHandlers.startedRecording(message);
        break;
      case 'stoppedRecording':
        acekurento.eventHandlers.stoppedRecording(message);
        break;
      case 'ice':
        webRtcPeer.addIceCandidate(message.candidate);
        break;
      case 'holdResult':
        peerOnHold = true;
        holdCb && holdCb(message.success);
        break;
      case 'unholdResult':
        peerOnHold = false;
        holdCb && holdCb(message.success);
        break;
      case 'inviteResponse':
        acekurento.eventHandlers.inviteResponse(message);
        break;
      case 'callTransferResponse':
        acekurento.eventHandlers.callTransferResponse(message);
        break;
      case 'sipReinviteResponse':
        acekurento.eventHandlers.reinviteResponse(message);
        break;
      case 'sipUpdateResponse':
        acekurento.eventHandlers.updateResponse(message);
        break;
      case 'restartCallResponse':
        acekurento.eventHandlers.restartCallResponse(message);
        break;
      case 'participantList':
        acekurento.eventHandlers.participantsUpdate(message);
        break;
      case 'newMessage':
        acekurento.eventHandlers.newMessage(message);
        break;
      default:
        console.error('Unrecognized message', message);
    }
  }

  function registerResponse(message) {
    if (!message.error) {
      setRegisterState(REGISTERED);
    } else {
      setRegisterState(NOT_REGISTERED);
      var errorMessage = message.error || 'Unknown reason for register rejection.';
      console.log(errorMessage);
    }
  }

  function callResponse(message) {
    if (message.response != 'accepted') {
      console.info('Call not accepted by peer. Closing call');
      var errorMessage = message.message ? message.message
      : 'Unknown reason for call rejection.';
      console.log(errorMessage);
      stop();
    } else {
      setCallState(IN_CALL);
      acekurento.eventHandlers.accepted();
      webRtcPeer.processAnswer(message.sdpAnswer);
    }
  }

  function startCommunication(message) {
    setCallState(IN_CALL);
    webRtcPeer.processAnswer(message.sdp);
  }

  function handleIncomingCall(message) {
    // If busy just reject without disturbing user
    if (acekurento.callState !== NO_CALL && !acekurento.isLoopback && !message.isWarmTransfer) {
      return acekurento.declineCall(message);
    }

    acekurento.eventHandlers.incomingCall({
      from: message.caller,
      accept: function() {
        acekurento.acceptCall(message)
      },
      reject: function() {
        acekurento.declineCall(message);
      }
    });
  }

  function sendMessage(message) {
    var jsonMessage = JSON.stringify(message);
    console.log('Sending message: ' + jsonMessage);
    ws.send(jsonMessage);
  }

  function onIceCandidate(candidate) {
    console.log('Local candidate' + JSON.stringify(candidate));

    var message = {
      id: 'ice',
      candidate: candidate
    }
    sendMessage(message);
  }

  if (config) {
    if (config.displayName) acekurento.configuration.displayName = config.displayName;
    if (config.sipUsername) acekurento.configuration.sipUsername = config.sipUsername;
    if (config.sipPassword) acekurento.configuration.sipPassword = config.sipPassword;
    if (config.sipUri) acekurento.configuration.sipUri = config.sipUri;
  }

  ws.onopen = function (e) {
    acekurento.eventHandlers.connected(e);
  };

  return acekurento;
}