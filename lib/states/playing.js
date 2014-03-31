var utils   = require('radiodan-client').utils,
    logger  = utils.logger(__filename);

module.exports = function(players, services) {
  return {
    'startPlaying': function(service) {
      logger.info('startPlaying');
      players.main.add({
        clear: true,
        playlist: [services.get(service)]
      }).then(function() {
        this.emit('playing', service);
      }, function(err) {
        this.emit('error', err);
      });
    },
    'stopPlaying': function() {
      logger.info('stopPlaying');
      players.main.clear().then(function(){
        this.emit('stopped');
        this.transition('standby');
      });
    },
    'startAvoiding': function(avoider) {
      logger.info('startAvoiding');
      this.transition('avoiding');
      this.handle('avoiding', avoider);
    },
    'startAnnouncing': function(announcer) {
      logger.info('startAnnouncing');
      this.transition('playingAnnouncing');
      this.handle('announcing', announcer);
    }
    '*': function(payload) {
      logger.warn('unknown', payload);
      this.emit('error', new Error('Unhandled in playing', payload);
    }
  };
}
