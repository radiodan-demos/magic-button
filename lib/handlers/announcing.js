var utils = require('radiodan-client').utils,
    logger = utils.logger(__filename);

module.exports = function(players, ui, services, state, settings) {
  var announcing = false,
      volumeDiff = 50,
      playState,
      activePlayer;

  return {
    start: startAnnouncing,
    stop:  stopAnnouncing,
    announce: announce
  };

  function announce(eventName) {
    return fetchAnnounceTrack(eventName).then(function(announceTrack) {
      return players.announcer.add({
        clear: true, playlist: [announceTrack]
      })
    })
    .then(function(){
      return players.announcer.play();
    })
  }

  function startAnnouncing(activePlayerId) {
    var volPromise;

    logger.info('startAnnouncing');

    activePlayer = activePlayerId;

    if(activePlayer === 'avoider') {
      playState = 'avoiding';
    } else {
      playState = 'playing';
    }

    if(announcing) {
      // no need to lower volume again
      volPromise = utils.promise.resolve();
    } else {
      volPromise = players[activePlayer].volume({diff: -volumeDiff});
    }

    announcing = true;
    state.emit('msg', 'announcer', announcingMessage());

    ui.RGBLEDs.magic.emit({
      emit: true, colour: ui.colours.yellow
    });

    return volPromise
      .then(fetchAnnounceTrack)
      .then(function(announceTrack){
        return players.announcer.add({
          clear: true, playlist: [announceTrack]
        }).delay(1000)
      .then(function(){
        return players.announcer.play();
      })
      .then(function(){
        players.announcer.once('player.state', function() {
          logger.info('Announcer spoken', activePlayer);
          stopAnnouncing();
        });
      });
    });
  }

  function stopAnnouncing() {
    logger.info('stopAnnouncing', activePlayer);

    if(!announcing) {
      logger.debug('Asked to stop announcing, but not currently doing so');
      return;
    }

    // ui.RGBLEDs.magic.emit({
    //   emit: true, colour: ui.colours.white
    // });

    return players[activePlayer].volume({diff: volumeDiff})
      .then(function(){
          announcing = false;
          emitter.emit('msg', 'announcer', announcingMessage());
        });
  }

  function fetchAnnounceTrack(eventName) {
    return settings.get().then(function(announceSettings) {
      var announceName = announceSettings.announcer.toLowerCase(),
          mp3;

      try {
        if(eventName) {
          mp3 = announceName + '/status/' +
                eventName + '.mp3';
        } else {
          mp3 = announceName + '/' +
                playState + '/' + services.current() + '.mp3';
          }
      } catch(err) {
        logger.warn(err);
        mp3 = null;
      }

      logger.info('track', mp3);
      return mp3;
    });
  }

  function announcingMessage() {
    return {
      isAnnouncing: announcing
    };
  }
}
