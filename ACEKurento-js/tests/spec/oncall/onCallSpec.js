describe("ACEKurento oncall outbound", function() {
  var acekurento;
  var ext = '1000';
  var WSSpy;
  const NO_CALL = 0;
  const PROCESSING_CALL = 1;
  const IN_CALL = 2;
  // mock credentials
  var address = 'wss://localhost:8443/signaling';
  var uri = 'sip:1000@acekurento-test.com:5060';
  var username = 'username';
  var password = 'af8KSZQREMwov';
  var sessionStoppedMessage = {
    "data": {
      "id": "sessionStopped",
      "session": "1234"
    }
  };

  beforeEach(function(done) {
    var realWS = WebSocket;
    WSSpy = spyOn(window, "WebSocket").and.callFake(function(url,protocols){
      return new realWS(url,protocols);
    });
    acekurento = new ACEKurento({acekurentoSignalingUrl: address});
    spyOn(console, 'log');
    setTimeout(function() {
      console.info('rendering time...');
      acekurento.call(uri, true);
      done()
    }, 1000);
  });

  it("should know when the call is in progress", function() {
    expect(acekurento.callState).toEqual(PROCESSING_CALL);
  });

  it("should not be possible to call while on call", function() {
    acekurento.call(uri, true);
    expect(console.log).toHaveBeenCalledWith("You are already on a call");
  });

  describe("stop", function () {
    it("should set call state to ended", function (done) {
      setTimeout(function() {
        acekurento.stop(true);
        console.log(acekurento.callState)
        expect(acekurento.callState).toEqual(NO_CALL);
        done();
      }, 500);
    });
  });
});