var EventEmitter = require('events').EventEmitter,
    MyMusic      = require(libDir + 'services/my-music');

describe('My Music service', function() {
  beforeEach(function() {
    this.eventBus = new EventEmitter();
  });

  it('Registers my-music service', function(done) {
    var myMusic = MyMusic.create(this.eventBus),
        promise = myMusic.fetchServices();

    assert.equal(myMusic.id, 'my-music');
    assert.becomes(promise, ['my-music']).notify(done);
  });

  it('Returns metadata for my-music service', function() {
    var myMusic = MyMusic.create(this.eventBus);

    assert.deepEqual(
      myMusic.metadata('my-music'),
      { id: 'my-music', service: 'my-music', title: 'My Music',
        logos: {
          active: '/assets/img/my-music-active.svg',
          inactive: '/assets/img/my-music-inactive.svg' },
        nowAndNext: [
          {"brand": "Unknown Title", "episode": "Unknown Artist"},
          {"brand": "Unknown Title", "episode": "Unknown Artist"}
        ]
      }
    );
  });

  it('Returns a promise that resolves to an array of station metadata', function(done) {
    var metadata = {
      id: 'my-music', service: 'my-music', title: 'My Music', logos: {
      active: '/assets/img/my-music-active.svg',
      inactive: '/assets/img/my-music-inactive.svg' }};

    var myMusic = MyMusic.create(this.eventBus);

    assert.eventually.deepEqual(myMusic.stations(), [metadata])
      .notify(done);
  });

  it('Returns a playlist of the root music directory', function() {
    var myMusic = MyMusic.create(this.eventBus);

    assert.deepEqual(myMusic.playlist(), '/');
  });

  // TODO: abstract this technique into own object
  // (will be needed for playlister service)
  // This should also be NowPlaying info
  // not programme information
  it('Updates metadata from updates over eventBus', function() {
    var myMusic = MyMusic.create(this.eventBus),
        msg = {
          id: 'main',
          playlist: [
            {Title: 'New Song', Album: 'Album', Artist: 'Artist', Date: 2006}]
        };

    this.eventBus.emit('playlist', msg);

    assert.deepEqual(
      myMusic.metadata('my-music').nowAndNext[0],
      { brand: "New Song", episode: "Artist - Album (2006)" }
    );
  });
});
