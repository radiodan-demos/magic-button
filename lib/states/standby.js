var utils   = require('radiodan-client').utils,
    logger  = utils.logger(__filename);

module.exports = function() {
  return {
    'startPlaying': function(service) {
      logger.info('startPlaying');
      this.transition('playing');
      this.handle('startPlaying', service);
      this.emit('msg', 'power', { isOn: true });
    },
    'standby': function(){
      logger.info('standby');
      this.handlers.standby();
      this.emit('msg', 'power', { isOn: false });
    },
    'hello': function(){
      logger.info('hello');
      this.handlers.announcing.announce('hello');
    },
    '*': function(payload) {
      logger.warn('unknown', payload);
      this.emit('error', new Error('Unhandled', payload));
    }
  };
}
