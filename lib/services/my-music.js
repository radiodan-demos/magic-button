var logger = require('radiodan-client').utils.logger(__filename);

module.exports.create = function(eventBus) {
  var playlist,
      currentTrackId = 0,
      nextTrackId = 1,
      instance = {};

  eventBus.on('playlist', function(msg){
    playlist = msg.playlist;
  });

  eventBus.on('currentSong', function(msg){
    currentTrackId = parseInt(msg.player.song)     - 1;
    nextTrackId    = parseInt(msg.player.nextsong) - 1;
  });

  instance.playlist = function() {
    return ['/'];
  };

  instance.station = function() {
    return {
      id:    'my-music',
      title: 'My Music',
      logos: {
        active:   '/assets/img/my-music-active.svg',
        inactive: '/assets/img/my-music-inactive.svg'
      }
    };
  };

  instance.metadata = function() {
    var nowAndNext = [];

    nowAndNext[0] = programise(playlist[currentTrackId]);
    nowAndNext[1] = programise(playlist[nextTrackId]);

    return { id: 'my-music', title: 'My Music', nowAndNext: nowAndNext };
  }

  return instance;
}

function programise(prog) {
  return {
    brand:   prog.Artist + ' - ' + prog.Title,
    episode: prog.Album
  };
}
