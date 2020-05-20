describe("ACEDirect-Kurento before on call", function() {
  var acekurento;
  var failed;
  // mock credentials
  var address = 'wss://localhost:8443/signaling';
  var username = 'username';
  var password = 'af8KSZQREMwov';
  var registerErrorResponse = {
    "data": {
      "id": "registerResponse",
      "error": "Unauthorized"
    }
  };
  var registerSuccessResponse = {
    "data": {
      "id": "registerResponse",
    }
  };

  beforeEach(function(done) {
    spyOn(console, 'log');
    setTimeout(function() {
      console.info('rendering time...');
      done()
    }, 2500);
  });

  it("should call WebSocket constructor and connect to address", function (done) {
    var realWS = WebSocket;
    var WSSpy = spyOn(window, "WebSocket").and.callFake(function(url,protocols){
      return new realWS(url,protocols);
    });
    acekurento = new ACEKurento({acekurentoSignalingUrl: address});
    expect(WSSpy).toHaveBeenCalledWith(address);
    done();
  });

  it("should be able to send/receive WebSocket messages", function (done) {
    var onmessageCallbackSpy = jasmine.createSpy('onmessageCallback');
    spyOn(WebSocket.prototype, "send").and.callFake(function(outMsg){
      if(outMsg == "outgoing message"){
        this.onmessage("incoming message");
      }
    });
    acekurento = new ACEKurento({acekurentoSignalingUrl: address});
    acekurento.ua.onmessage = onmessageCallbackSpy;
    acekurento.ua.send("outgoing message");

    expect(onmessageCallbackSpy).toHaveBeenCalledWith("incoming message");
    done();
  });

  it("should be able to start registration sending register message", function (done) {
    spyOn(WebSocket.prototype, "send").and.callFake(function(outMsg){
      var msg = JSON.parse(outMsg);
      if(msg.id === 'register' && msg.ext === username && msg.password === password) {
        done();
      }
    });
    acekurento = new ACEKurento({acekurentoSignalingUrl: address});
    acekurento.register(username, password, false);
  });

  describe("when registering", function() {

    it("should be able to process successful registration response", function (done) {
      var onmessageCallbackSpy = jasmine.createSpy('onmessageCallback');
      spyOn(WebSocket.prototype, "send").and.callFake(function(outMsg){
        console.info('message: ' + outMsg);
        var msg = JSON.parse(outMsg);
        if(msg.id === 'register') {
          console.info('Simulating server register response: ' + JSON.stringify(registerSuccessResponse));
          this.onmessage(registerSuccessResponse);
        }
      });
      acekurento = new ACEKurento({acekurentoSignalingUrl: address});

      var eventHandlers = {
        'registerResponse': function (e) {
          console.info('--- Register response:', e || 'Success ---');
          onmessageCallbackSpy(e || 'Success');
        }
      }

      acekurento.eventHandlers.registerResponse = onmessageCallbackSpy;
      acekurento.eventHandlers = Object.assign(acekurento.eventHandlers, eventHandlers);
      acekurento.register(username, password, false);

      expect(onmessageCallbackSpy).toHaveBeenCalled();
      expect(onmessageCallbackSpy.calls.count()).toEqual(1);
      expect(onmessageCallbackSpy).toHaveBeenCalledWith("Success");
      done();
    });

    describe("when failing authenticating", function() {

      it("should send a failed event with error", function (done) {

        spyOn(WebSocket.prototype, "send").and.callFake(function(outMsg){
          var msg = JSON.parse(outMsg);
          if(msg.id === 'register') {
            // console.info(registerErrorResponse)
            this.onmessage(registerErrorResponse);
          }
        });
        acekurento = new ACEKurento({acekurentoSignalingUrl: address});

        acekurento.eventHandlers.registerResponse = function (e) {
          console.info('--- Register response:', e || 'Success ---');
          // console.info('---> ' + JSON.stringify(registerErrorResponse.data.error))
          if (e === registerErrorResponse.data.error) {
            done()
          }
        };

        acekurento.register(username, password, false);
      });
    });
  });

  describe("when inbound call", function() {

    beforeEach(function (done) {
      acekurento = new ACEKurento({acekurentoSignalingUrl: address});
      acekurento.register(username, password, false);
      setTimeout(function() {
        console.info('Simulate incoming call');
        //TODO
        done();
      }, 3000);
    });

    // afterEach(function (done) {
    //   console.info('cleanup');
    //   setTimeout(function() {
    //     acekurento.stop();
    //     done();
    //   }, 1000);
    // });

    xit("should be able to receive a incoming call event", function (done) {
    //  TODO
    //   done();
    });

    describe("when receiving an incoming call", function() {

      xit("should be able to accept", function (done) {
        //TODO
      });
    });
  });
});