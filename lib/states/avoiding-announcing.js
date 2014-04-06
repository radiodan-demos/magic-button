var utils   = require('radiodan-client').utils,
    logger  = utils.logger(__filename);

module.exports = function(handlers) {
  return {
    'startAnnouncing': function(settings) {
      logger.info('startAnnouncing');
      handlers.announcing.start(settings, true);
    },
    'stopAnnouncing': function(){
      handlers.announcing.stop();
      this.transition('avoiding');
    },
    'startAvoiding': function(settings){
      var self = this;
      logger.info('startAvoiding');
      handlers.avoiding.start(settings, function() {
        self.handle('stopAvoiding');
      });
     self.handle('startAnnouncing');
    },
    'stopAvoiding': function(){
      service = handlers.avoiding.stop();
      this.handle('startPlaying', service);
    },
    'startPlaying': function(service){
      logger.info('startPlaying', service);
      handlers.avoiding.stop();
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
