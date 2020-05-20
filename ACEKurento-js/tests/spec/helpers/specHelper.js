beforeEach(function () {
  jasmine.addMatchers({
    //FIXME TO use in onCall Spec
    toBeCalling: function () {
      setTimeout(function() {
        var callstarted = false;
        var eventHandlers = {
          'accepted': function(e) {
            console.log('Call started');
            callstarted = true;
          }
        };
        acekurento.customEventHandler = Object.assign(acekurento.customEventHandler, eventHandlers);
        return {
          pass: callstarted
        }
      }, 4000);
    },
    toBeSendingLocalAudio: function () {
      return {
        compare: function(voxbone) {
          var streams = acekurento.selfStream;
          var sending = false;
          for (var i = 0; i < streams.length; i++) {
            for (var j = 0; j < streams[i].getAudioTracks().length; j++) {
              console.info('sending:'+sending);
              sending = sending ? sending : streams[i].getAudioTracks()[j].enabled;
            }
          }
          var result = { pass: sending !== false };

          if(result.pass) {
            result.message =  "Audio being sent.";
          } else {
            result.message =  "Audio deactivated.";
          }
          return result;
        }
      }

    }
  });
});