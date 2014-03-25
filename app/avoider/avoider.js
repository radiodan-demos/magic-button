var EventEmitter  = require("events").EventEmitter,
    logger        = require("radiodan-client").utils.logger(__filename),
    musicServices = ["radio1","1xtra","radio2","radio3","6music"];

module.exports = function(eventBus, states, bbcServices) {
  return { create: create };

  function create(from, to, avoidTopic, myLogger) {
    var instance = new EventEmitter;

    avoidTopic = avoidTopic || topicFromService(from);

    logger = myLogger || logger;

    instance.avoid = avoid;
    instance.cancel = cancel;

    states.register('avoid', {
      enter: function (players, services) {
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

    return instance;

    function avoid() {
      var avoidingEvent = from + "." + avoidTopic;

      logger.debug(
        "Begin avoiding", from,
        "avoidTopic", avoidTopic,
        "event", avoidingEvent
      );

      states.enter('avoid');
      logger.info('avoiding enter');

      bbcServices.once(avoidingEvent, function () {
        logger.info('avoiding finish');
        states.exit('avoid');
      });
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
