var logger = require('radiodan-client').utils.logger(__filename);

module.exports.create = function(eventBus) {
  var playlist,
      id = 'my-music',
      active = false,
      currentTrackId = 0,
      nextTrackId = 1,
      instance = {};

  eventBus.on('service.id', function(serviceId) {
    active = (serviceId === id);
  });

  instance.playlist = function() {
    return ['/'];
  };

  instance.station = function() {
    return {
      id:    id,
      title: 'My Music',
      logos: {
        active:   '/assets/img/' + id + '-active.svg',
        inactive: '/assets/img/' + id + '-inactive.svg'
      }
    };
  };

  instance.metadata = function() {
    var msg;

    msg = {
      id: id,
      service: id,
      title: 'My Music',
      nowAndNext: nowAndNext(),
      nowPlaying: {}
    };

    return msg;
  }

  eventBus.on('playlist', function(msg){
    playlist = msg.playlist;
    logger.info('playlist changed');
    emitNowNext();
  });

  eventBus.on('player', function(msg){
    var song     = parseInt(msg.player.song),
        nextSong = parseInt(msg.player.nextsong);

    currentTrackId = isNaN(song) ? 0 : song;
    nextTrackId    = isNaN(nextSong) ? 1 : nextSong;

    logger.info('player changed');
    emitNowNext();
  });

  function emitNowNext(){
    if(active) {
      var msg = {
        service: id,
        data: nowAndNext()
      };
      logger.info(msg);
      eventBus.emit('nowAndNext', msg);
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
  var brand   = '',
      episode = '';

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
