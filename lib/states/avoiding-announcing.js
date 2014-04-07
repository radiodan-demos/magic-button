var utils   = require('radiodan-client').utils,
    logger  = utils.logger(__filename);

module.exports = function(handlers) {
  return {
    'startAnnouncing': function(settings) {
      logger.info('startAnnouncing');
      var self = this;

      handlers.announcing.start(settings, true, self);
    },
    'stopAnnouncing': function(){
      logger.info('stopAnnouncing');
      var self = this;

      handlers.announcing.stop().then(function(msg) {
        self.transition('avoiding');
      });
    },
    'startAvoiding': function(settings){
      logger.info('startAvoiding');
      var self = this;
      handlers.avoiding.start(settings, function() {
        self.handle('stopAvoiding');
      });
     self.handle('startAnnouncing');
    },
    'stopAvoiding': function(){
      logger.info('stopAvoiding');
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
