var EventEmitter  = require("events").EventEmitter,
    logger        = require("radiodan-client").utils.logger(__filename),
    musicServices = ["radio1","1xtra","radio2","radio3","6music"];

module.exports = function(states, bbcServices) {
  return { create: create };

  function create(to, avoidTopic, myLogger) {
    var instance = new EventEmitter,
        currentId,
        state;

    logger = myLogger || logger;

    instance.startAvoiding = startAvoiding;
    instance.stopAvoiding = stopAvoiding;
    instance.avoid = avoid;
    instance.cancel = cancel;
    instance.avoidTopic = avoidTopic;

    return instance;

    function startAvoiding (state, players, services, emit) {
      currentId = services.current();

      if (!currentId) {
        logger.warn('No current service -- will not avoid');
        state.exit();
        return;
      }

      instance.avoidTopic = (instance.avoidTopic || topicFromService(currentId));
      var avoidingEvent = currentId + "." + instance.avoidTopic;

      bbcServices.once(avoidingEvent, function () {
        state.exit();
      });

      emit('avoider', { isAvoiding: true, from: currentId, to: to });

      players.main.stop();
      players.avoider
             .add({ clear: true, playlist: services.get(to) })
             .then(players.avoider.play);

      services.change(to);
    }

    function stopAvoiding (state, players, services, emit) {
      logger.info('exit state');
      players.main.play();
      players.avoider.stop();
      emit('avoider', { isAvoiding: false, from: to, to: currentId });
      instance.avoidTopic = null;
      services.change(currentId);
    }

    function avoid() {
      state = states.create({
        name: 'avoider',
        enter: startAvoiding,
        exit: stopAvoiding
      });

      state.enter();
      logger.info('avoiding enter');
    }

    function cancel() {
      if (state) {
        state.exit();
        state = null;
      }
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
