var utils = require('radiodan-client').utils,
    logger = utils.logger(__filename);

module.exports = function(players, services, state) {
  var settings = {},
      announcing = false,
      volumeDiff = 50;

  return {
    start: startAnnouncing,
    stop:  stopAnnouncing,
    announce: announce
  };

  function announce(event) {
    return players.announcer.add({
      clear: true, playlist: [announceTrack('standby')]
    })
    .then(function(){
      return players.announcer.play();
    })
  }

  function startAnnouncing(announceSettings, avoiding) {
    var volPromise;

    logger.info('startAnnouncing');

    if(announceSettings) {
      settings = announceSettings;
    }

    settings.avoiding = (avoiding === true);

    if(announcing) {
      volPromise = utils.promise.resolve();
    } else {
      volPromise = utils.promise.all([
        players.main.volume({diff: -volumeDiff}),
        players.avoider.volume({diff: -volumeDiff})
      ]);
    }

    return volPromise.then(function(){
      return players.announcer.add({
        clear: true, playlist: [announceTrack()]
      }).delay(1000)
      .then(function(){
        return players.announcer.play();
      })
      .then(function(){
        announcing = true;

        players.announcer.once('player.state', function() {
          logger.info('Announcer spoken');
          state.emit('msg', 'announcer', announcingMessage());
          stopAnnouncing();
        });
      });
    });
  }

  function stopAnnouncing() {
    var self = this;

    logger.info('stopAnnouncing');

    if(!announcing) {
      logger.debug('Asked to stop announcing, but not currently doing so');
      return;
    }

    return utils.promise.all([
        players.main.volume({diff: volumeDiff}),
        players.avoider.volume({diff: volumeDiff})
        ]).then(function(){
          announcing = false;
          emitter.emit('msg', 'announcer', announcingMessage());
        });
  }

  function announceTrack(eventName) {
    var mp3;

    try {
      if(eventName) {
        mp3 = settings.announcer.toLowerCase() + '/status/' +
              eventName + '.mp3';
      } else {
        var dir = settings.avoiding ? 'avoiding' : 'playing';

        mp3 = settings.announcer.toLowerCase() + '/' +
              dir + '/' + services.current() + '.mp3';
        }
    } catch(err) {
      logger.warn(err);
      mp3 = null;
    }

    logger.info('track', mp3);
    return mp3;
  }

  function announcingMessage() {
    return {
      isAnnouncing: announcing
    };
  }
}
