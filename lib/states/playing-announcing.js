var utils   = require('radiodan-client').utils,
    logger  = utils.logger(__filename);

module.exports = function(players, playlists) {
  return {
    'startPlaying': function(service) {
      logger.info('startPlaying');
      this.transition('playing');
      this.handle('startPlaying', service);
      this.transition('announcing');
      this.handle('startAnnouncing');
      this.transition('playingAnnouncing');
    },
    'startAvoiding': function(settings) {
      logger.info('startAvoiding');
      this.transition('avoidingAnnouncing');
      this.handle('avoiding', settings);
    },
    'startAnnouncing': function(settings){
      logger.info('startAnnouncing');
      this.transition('announcing');
      this.handle('startAnnouncing', settings);
      this.transition('playingAnnouncing');
    },
    'stopAnnouncing': function(){
      logger.info('stopAnnouncing');
      this.transition('playing');
    },
    'standby': function() {
      logger.info('standby');
      this.transition('standbyAnnouncing');
      this.handle('standby');
    },
    '*': function(payload) {
      logger.warn('unknown', payload);
      this.emit('error', new Error('Unhandled', payload));
    }
  };
}
