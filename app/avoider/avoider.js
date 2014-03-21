var EventEmitter  = require("events").EventEmitter,
    logger        = require("radiodan-client").utils.logger(__filename),
    musicStations = ["radio1","1xtra","radio2","radio3","6music"];

module.exports = function(bbcServices, mainPlayer, avoidPlayer) {
  return { create: create };

  function create(service, myLogger) {
    var instance = new EventEmitter,
        avoidTopic;

    logger = myLogger || logger;

    instance.avoid = avoid;

    if(musicStations.indexOf(service) > -1) {
      instance.avoidTopic = "nowPlaying";
    } else {
      instance.avoidTopic = "nowAndNext";
    }

    avoidTopic = instance.avoidTopic;

    return instance;

    function avoid() {
      var avoidingEvent = service+"/"+avoidTopic;

      logger.debug(
        "Begin avoiding", service,
        "duration", avoidTopic,
        "event", avoidingEvent
      );

      //start avoiding
      mainPlayer.stop(); // pause if it's not radio
      avoidPlayer.play();
      instance.emit("begin", service);

      bbcServices.once(avoidingEvent, function() {
        //stop avoiding
        avoidPlayer.stop(); // pause if it's not radio
        mainPlayer.play();

        logger.debug("end avoiding");
        instance.emit("end", service);
      });
    }
  }
};
