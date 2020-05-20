var acekurento;
window.onload = function() {
  console = new Console();
  // setRegisterState(NOT_REGISTERED);
  acekurento = new ACEKurento({acekurentoSignalingUrl: 'wss://' + window.location.host + '/signaling'});
  var drag = new Draggabilly(document.getElementById('videoSmall'));
  var incomingCall = null;
  var peerOnHold = false;
  var recording = false;
  var privateMode = false;
  var privateIndex = 0;
  var privateMedia = [
    'https://' + window.location.host + '/img/private.mp4' // URL relative to Kurento on Docker
  ];

  acekurento.remoteStream = document.getElementById('videoOutput');
  acekurento.selfStream = document.getElementById('videoInput');

  document.getElementById('ext').focus();

  document.getElementById('register').addEventListener('click', function() {
    acekurento.register(document.getElementById('ext').value, document.getElementById('password').value, document.getElementById('isAgent').checked);
  });
  document.getElementById('loopback').addEventListener('click', function() {
    // generate a loopback call with random extension
    acekurento.loopback(Math.floor(Math.random() * Math.floor(1000)));
  });
  document.getElementById('call').addEventListener('click', function() {
    acekurento.call(
      document.getElementById('peer').value,
      document.getElementById('skipQueue').checked
    );
  });
  document.getElementById('terminate').addEventListener('click', function() {
    acekurento.stop(false);
  });
  document.getElementById('hold').addEventListener('click', function() {
    this.setAttribute('disabled', '');
    if(peerOnHold) {
      acekurento.unhold((success) => {
        peerOnHold = false;
        this.removeAttribute('disabled');
        if(success) {
          document.getElementById('hold-lbl').innerHTML = 'Hold';
        }
      });
    } else {
      acekurento.hold((success) => {
        peerOnHold = true;
        this.removeAttribute('disabled');
        if(success) {
          document.getElementById('hold-lbl').innerHTML = 'Unhold';
        }
      });
    }
  });
  document.getElementById('accept').addEventListener('click', function() {
    incomingCall && incomingCall.accept();
    document.getElementById('prompt').style.visibility = 'hidden';
  });
  document.getElementById('reject').addEventListener('click', function() {
    incomingCall && incomingCall.reject();
    document.getElementById('prompt').style.visibility = 'hidden';
  });
  document.getElementById('agentAway').addEventListener('click', function() {
    let away = document.getElementById('agentAway').checked;
    console.log('AWAY:', away);
    // activate/deactivate active member from queue
    if (away) {
      acekurento.pauseQueue();
    } else {
      acekurento.unpauseQueue();
    }
  });

  document.getElementById('record').addEventListener('click', function() {
    if (recording) {
      acekurento.stopRecording();
    } else {
      acekurento.startRecording();
    }
  });

  document.getElementById('private').addEventListener('click', function() {
    if (privateMode) {
      acekurento.privateMode(false);
    } else {
      if(privateIndex >= privateMedia.length) privateIndex = 0;
      acekurento.privateMode(true, privateMedia[privateIndex++]);
    }
    privateMode = !privateMode;
  });

  document.getElementById('invite').addEventListener('click', function(evt) {
    evt.preventDefault();
    acekurento.invitePeer(document.getElementById('peer').value);
  });

  document.getElementById('sipReinvite').addEventListener('click', function() {
    acekurento.sipReinvite();
  });

  document.getElementById('screenShare').addEventListener('click', function() {
    if (acekurento.isScreensharing) {
      acekurento.screenshare(false);
    } else {
      acekurento.screenshare(true);
    }
  });

  document.getElementById('transfer').addEventListener('click', function(evt) {
    // evt.preventDefault();
    acekurento.callTransfer(document.getElementById('peer').value, false);
  });

  // Events
  var eventHandlers = {
    'connected': function (e) {
      console.log('--- Connected ---\n');
    },

    'registerResponse': function (error) {
      console.log('--- Register response:', error || 'Success ---');
      if(!error) {
        document.getElementById('agentAwayConf').classList.remove("invisible");
      }
    },

    'pausedQueue': function (e) {
      console.log('--- Paused Agent Member in Queue ---\n');
    },

    'unpausedQueue': function (e) {
      console.log('--- Unpaused Agent Member in Queue ---\n');
    },

    'callResponse': function (e) {
      console.log('--- Call response ---\n', e);
    },

    'incomingCall': function (call) {
      console.log('--- Incoming call ---\n');
      document.getElementById('prompt').style.visibility = 'visible';
      document.getElementById('from').innerHTML = call.from;
      incomingCall = call;
    },

    'progress': function(e) {
      console.log('--- Calling... ---\n');
    },

    'sipConfirmed': function (e) {
      console.log('--- SIP ACK ---');
      // acekurento.sipReinvite();
    },

    'startedRecording': function (e) {
      console.log('--- Started Recording:', (e.success) ? 'Success ---' : 'Error ---');
      if (e.success) {
        recording = true;
        document.getElementById('record-lbl').innerHTML = 'Stop Recording';
      }
    },

    'stoppedRecording': function (e) {
      console.log('--- Stopped Recording:', (e.success) ? 'Success ---' : 'Error ---');
      if (e.success) {
        recording = false;
        document.getElementById('record-lbl').innerHTML = 'Record';
      }
    },

    'failed': function(e) {
      console.log('--- Failed ---\n' + e);
    },

    'ended': function(e) {
      var pNode = document.getElementById('participants');
      while (pNode.firstChild) {
        pNode.removeChild(pNode.firstChild);
      }
      console.log('--- Call ended ['+ e.reason +'] ---\n');
    },

    'inviteResponse': function (e) {
      console.log('--- Invite response (multiparty) ---\n', e);
    },

    'callTransferResponse': function (e) {
      console.log('--- Call transfer response ---\n', e);
    },

    'sipReinviteResponse': function (e) {
      console.log('--- Re-Invite response:', (e.success) ? 'Success ---' : 'Error ---');
    },

    'sipUpdateResponse': function (e) {
      console.log('--- Update response:', (e.success) ? 'Success ---' : 'Error ---');
    },

    'newMessage': function (e) {
      console.log('--- New Message ---\n' + JSON.stringify(e.msg));
    },

    'participantsUpdate': function (e) {
      var pNode = document.getElementById('participants');
      while (pNode.firstChild) {
        pNode.removeChild(pNode.firstChild);
      }

      for(var i = 0; i < e.participants.length; i++) {
        var p = e.participants[i];
        var li = document.createElement('li');
        var type = p.type.split(':');
        var hold = p.onHold ? 'Yes' : 'No';
        var txt = document.createTextNode(p.ext + ': ' + type[1].toUpperCase() + ', on hold: ' + hold);
        li.appendChild(txt);
        pNode.appendChild(li);
      }
    },
  };

  acekurento.eventHandlers = Object.assign(acekurento.eventHandlers, eventHandlers);

  // MUTE/UNMUTE AUDIO/VIDEO
  var audioChk = document.getElementById('audioChk');
  var videoChk = document.getElementById('videoChk');

  audioChk.onclick = function () {
    acekurento.enableDisableTrack(audioChk.checked, true);
  }
  videoChk.onclick = function () {
    acekurento.enableDisableTrack(videoChk.checked, false);
  }

  if(window.URLSearchParams) {
    var q = new URLSearchParams(window.location.search);
    var ext = q.get('ext');
    if(ext) {
      document.getElementById('ext').value = ext;
      document.getElementById('password').value = ext.length === 4 ? ext : '1qaz1qaz';
    }
    var peer = q.get('peer');
    if (peer) {
      document.getElementById('peer').value = peer;
    }
  }
}
