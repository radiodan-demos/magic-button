var utils   = require('radiodan-client').utils,
    logger  = utils.logger(__filename);

module.exports = function(players, playlists) {
  return {
    'startAnnouncing': function(settings) {
      this.transition('announcing');
      this.handle('startAnnouncing', settings);
      this.transition('avoidingAnnouncing');
    },
    'stopAnnouncing': function(){
      logger.info('stopAnnouncing');
      this.transition('announcing');
      this.handle('stopAnnouncing');
      this.transition('avoiding');
    },
    'startAvoiding': function(settings){
      logger.info('startAvoiding');
      this.transition('avoiding');
      this.handle('startAvoiding', settings);
      this.transition('avoidingAnnouncing');
      this.handle('startAnnouncing');
    },
    'stopAvoiding': function(){
      this.transition('avoiding');
      this.handle('stopAvoiding');
    },
    'startPlaying': function(service){
      this.transition('playingAnnouncing');
      this.handle('startPlaying', service);
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
