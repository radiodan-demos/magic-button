var EventEmitter = require('events').EventEmitter;
    utils  = require('radiodan-client').utils,
    logger = utils.logger(__filename);

module.exports.create = function(eventBus) {
  var playlist,
      title = 'My Music',
      id = 'my-music',
      active = false,
      currentTrackId = 0,
      nextTrackId = 1,
      instance = new EventEmitter();

  instance.playlist = function() {
    return ['/'];
  };

  instance.station = function() {
    return {
      id: id,
      service: id,
      title: title,
      logos: {
        active:   '/assets/img/' + id + '-active.svg',
        inactive: '/assets/img/' + id + '-inactive.svg'
      }
    };
  };

  instance.metadata = function() {
    var msg = instance.station();
    msg.nowAndNext = nowAndNext();

    return msg;
  }

  eventBus.on('service.id', function(serviceId) {
    active = (serviceId === id);
  });

  eventBus.on('playlist', function(msg){
    if(msg.id !== 'announcer') {
      playlist = msg.playlist;

      emitNowNext();
    }
  });

  eventBus.on('player', function(msg){
    if(msg.id !== 'announcer') {
      var song     = parseInt(msg.player.song),
          nextSong = parseInt(msg.player.nextsong);

      currentTrackId = isNaN(song) ? 0 : song;
      nextTrackId    = isNaN(nextSong) ? 1 : nextSong;

      emitNowNext();
    }
  });

  function emitNowNext(){
    if(active) {
      var msg = instance.station();
      msg.topic = 'nowAndNext';
      msg.data  = nowAndNext();

      instance.emit('*', msg);
    }
  }

  function nowAndNext() {
    return [
      programise(playlist[currentTrackId]),
      programise(playlist[nextTrackId])
    ];
  }

  return instance;
}

function programise(prog) {
  var brand   = 'Unknown Title',
      episode = 'Unknown Artist';

  try {
    brand   = prog.Title;
    episode = prog.Artist + ' - ' + prog.Album;

    if(prog.Date) {
      episode += ' (' + prog.Date + ')';
    }
  } catch(err) {
    logger.warn(err);
  }

  return {
    brand:   brand,
    episode: episode
  };
}
