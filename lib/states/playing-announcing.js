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
    'startAvoiding': function(settings) {
      logger.info('startAvoiding');
      this.transition('avoidingAnnouncing');
      this.handle('startAvoiding', settings);
    },
    'startAnnouncing': function(settings){
      logger.info('startAnnouncing');
      handlers.announcing.start(settings);
    },
    'stopAnnouncing': function(){
      handlers.announcing.stop();
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
