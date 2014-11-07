var play = require(libDir + '/actions/play');

describe('Play Action', function(){
  beforeEach(function() {
    var player, ui;

    this.services = {};

    this.player = fakeRadiodan('player');
    this.ui     = fakeRadiodan('ui');
    this.eventBus = { emit: sinon.spy() };
    this.subject = play.create(this.player, this.ui, this.services, this.eventBus);

    // lazy hack to expose underlying action function
    this.subject.action = this.subject.events[0].action;

    this.subject.transition = sinon.spy();
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

    it('transisions to online', function(done) {
      var that = this,
          stationId = sinon.stub();

      return this.subject.action(stationId)
        .then(function() {
          assert.equal(that.subject.transition.callCount, 1);
          assert.isTrue(that.subject.transition.calledWith('online'));
        })
        .then(done,done);
    });

    it('turns the powerLED to green', function(done){
      var that = this,
          stationId = sinon.stub();

      return this.subject.action(stationId)
        .then(function() {
          var emit = that.ui.RGBLEDs.power.emit,
              expected = { emit: true, colour: 'green' };

          assert.equal(emit.callCount, 1);
          assert.deepEqual(emit.getCall(0).args[0], expected);
        })
        .then(done,done);
    });

    it('sets a new playlist', function(done) {
      var that = this,
          stationId = sinon.stub(),
          playlist  = sinon.stub();

      this.services.playlist.returns(playlist);

      return this.subject.action(stationId)
        .then(function() {
          var add  = that.player.main.add,
              play = that.player.main.play,
              expected = { clear: true, playlist: [playlist]};

          // creates playlist
          assert.isTrue(that.services.playlist.calledWith(stationId));
          assert.deepEqual(add.getCall(0).args[0], expected);

          // plays playlist
          assert.equal(play.callCount, 1);

          // changes service
          assert.equal(that.services.change.callCount, 1);
          assert.isTrue(that.services.change.calledWith(stationId));
        })
        .then(done,done);
    });
  });
});
