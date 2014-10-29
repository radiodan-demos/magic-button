var play = require(libDir + '/actions/play');

describe('Play Action', function(){
  beforeEach(function() {
    var player, ui;

    this.playMock = {
      add: sinon.stub().returns(utils.promise.resolve()),
      play: sinon.spy()
    };

    this.ledMock  = { emit: sinon.spy() };
    this.services = {};

    player = { main: this.playMock },
    ui     = {
      colours: {green: 'green'},
      RGBLEDs: {power: this.ledMock }
    };

    this.subject = play.create(player, ui, this.services, null);
  });

  describe('determining the station to play', function(){
    it('uses the given stationId', function() {
      var stationId = sinon.stub(),
          determined = this.subject.determineStation(stationId);

      assert.equal(determined, stationId);
    });

    it('uses service#current', function() {
      var stationId = sinon.stub(),
          determined;

      this.services.current = function(){return stationId};

      determined = this.subject.determineStation();

      assert.equal(determined, stationId);
    });

    it('uses the services#default if current returns null', function(){
      var stationId = sinon.stub(),
          determined;

      this.services.current = function() {};
      this.services.default = stationId;

      determined = this.subject.determineStation();

      assert.equal(determined, stationId);
    });
  });

  describe('playing a station', function() {
    beforeEach(function(){
      this.services.playlist = sinon.stub();
      this.services.change = sinon.stub();
    });

    it('turns the powerLED to green', function(done){
      var that = this,
          stationId = sinon.stub();

      return this.subject.action(stationId)
        .then(function() {
          var emit = that.ledMock.emit,
              expected = { emit: true, colour: 'green' };

          assert.equal(emit.callCount, 1);
          assert.deepEqual(emit.getCall(0).args[0], expected);
        })
        .then(done,done);
    });

    // TODO: on hold until devices/physical-ui and devices/players
    // have been implemented & stubable for use here
    xit('sets a new playlist');
    xit('starts the player');
    xit('alerts the services object to the new stationId');
  });
});
