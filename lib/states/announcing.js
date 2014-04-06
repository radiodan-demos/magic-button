var utils   = require('radiodan-client').utils,
    logger  = utils.logger(__filename);

module.exports = function(players, services) {
  var settings = {},
      announcing = false,
      volumeDiff = 10;

  return {
    'startAnnouncing': function(announceSettings) {
      var self = this;

      logger.info('startAnnouncing');

      if(announceSettings) {
        settings = avoidSettings;
      }

      var currentService = service.current(),
          announceTrack = './' + settings.name + currentService + '.mp3';

      utils.promise.all([
        players.main.volume({diff: -volumeDiff}),
        players.avoider.volumeDiff({diff: -volumeDiff})
      ]).then(function(){
        return players.announcer.add({
          clear: true, playlist: [announceTrack]
        })
        .then(players.announcer.play)
        .then(function(){
          announcing = true;
          self.emit('msg', 'announcer', announcingMessage(true));

          players.announcer.once('player.state', function() {
            self.handle('stopAnnouncing');
          });
        });
      });
    },
    'stopAnnouncing': function(restart) {
      var self = this;

      logger.info('stopAnnouncing');

      if(!announcing) {
        logger.debug('Asked to stop announcing, but not currently doing soo');
        return;
      }

      utils.promise.all([
        players.main.volume({diff: volumeDiff}),
        players.avoider.volumeDiff({diff: volumeDiff})
      ]).then(function(){
        announcing = false;
        self.emit('msg', 'announcer', announcingMessage());
      });
    },
    '*': function(payload) {
      logger.warn('unknown', payload);
      this.emit('error', new Error('Unhandled', payload));
    }
  };

  function announcingMessage() {
    return {
      isAnnouncing: announcing
    };
  }
}
