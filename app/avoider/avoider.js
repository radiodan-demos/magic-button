var EventEmitter  = require("events").EventEmitter,
    logger        = require("radiodan-client").utils.logger(__filename),
    musicServices = ["radio1","1xtra","radio2","radio3","6music"];

module.exports = function(eventBus, states, bbcServices) {
  return { create: create };

  function create(to, avoidTopic, myLogger) {
    var instance = new EventEmitter;

    logger = myLogger || logger;

    instance.avoid = avoid;
    // instance.cancel = cancel;

    return instance;

    function avoid() {
      states.register('avoid', {
        enter: function (players, services) {
          var currentId = services.current();
          var avoidingEvent = currentId + "." + (avoidTopic || topicFromService(currentId));

          logger.debug('avoidingEvent', avoidingEvent);

          bbcServices.once(avoidingEvent, function () {
            logger.info('avoiding finish');
            states.exit('avoid');
          });

          players.main.stop();
          players.avoider
                 .add({ clear: true, playlist: services.get(to) })
                 .then(players.avoider.play);
        },
        exit: function (players) {
          logger.info('exit state');
          players.main.play();
          players.avoider.stop();
        }
      });

      states.enter('avoid');
      logger.info('avoiding enter');
    }

  }
};

function topicFromService(service) {
  if(musicServices.indexOf(service) > -1) {
    return "nowPlaying";
  } else {
    return "nowAndNext";
  }
}
