var utils   = require('radiodan-client').utils,
    logger  = utils.logger(__filename);

module.exports = function(handlers) {
  return {
    'startPlaying': function(service) {
      var self = this;
      logger.info('startPlaying');

      handlers.playing.start(service).then(function(){
        self.handle('startAnnouncing');
      });
    },
    'startAnnouncing': function(settings) {
      logger.info('startAnnouncing');
      handlers.announcing.start(settings);
    },
    'stopAnnouncing': function() {
      logger.info('stopAnnouncing');
      handlers.announcing.stop();
      this.transition('playing');
    },
    'startAvoiding': function(settings) {
      logger.info('startAvoiding');
      this.transition('avoidingAnnouncing');
      this.handle('startAvoiding', settings);
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
