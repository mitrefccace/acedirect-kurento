describe("ACEKurento", function() {
  var acekurento;

  beforeEach(function() {
    acekurento = new ACEKurento();
    spyOn(console, 'log');
  });

  it("should be defined", function() {
    expect(acekurento).toBeDefined();
  });

  it("should be able to instantiate a second object different than the previous one", function() {
    var acekurento2 = new ACEKurento();
    expect(acekurento).not.toEqual(acekurento2);
  });

});