var utils   = require('radiodan-client').utils,
    logger  = utils.logger(__filename);

module.exports = function(players, playlists) {
  return {
    'startPlayingAndAnnouncing': function(service) {
      logger.info('startPlayingAndAnnouncing');
      this.transition('playing');
      this.handle('startPlaying', service);
      this.transition('playingAnnouncing');
      this.handle('startAnnouncing');
    },
    'startAvoiding': function(avoider) {
      logger.info('startAvoiding');
      this.transition('avoidingAnnouncing');
      this.handle('avoiding', avoider);
    },
    'startAnnouncing': function(){},
    'stopAnnouncing': function(){},
    'stopPlaying': function(){},
    'stopPlayingAndAnnouncing': function(){},
    'standby': function() {
      logger.info('standby');
      this.transition('standbyAnnouncing');
      this.handle('standby', avoider);
    },
    '*': function(payload) {
      logger.warn('unknown', payload);
      this.emit('error', new Error('Unhandled', payload));
    }
  };
}
