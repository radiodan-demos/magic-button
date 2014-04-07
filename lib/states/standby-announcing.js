var utils   = require('radiodan-client').utils,
    logger  = utils.logger(__filename);

module.exports = function(handlers) {
  return {
    'standby': function() {
      //speak 'standby'
      handlers.standby();
      handlers.announcing.announce('standby');
    },
    'startPlaying': function(service) {
      logger.info('startPlaying');
      this.transition('playingAnnouncing');
      this.handle('startPlaying', service);
      this.emit('msg', 'power', { isOn: true });
    },
    '*': function(payload) {
      logger.warn('unknown', payload);
      this.emit('error', new Error('Unhandled', payload));
    }
  };
}
