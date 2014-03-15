var EventEmitter = require("events").EventEmitter,
    logger       = require("radiodan-client").utils.logger(__filename),
    musicStations = ["radio1","1xtra","radio2","radio3","6music"],
    radiodan, bbcServices;

module.exports = function(myRadiodan, myBBCServices) {
  radiodan    = myRadiodan;
  bbcServices = myBBCServices;

  return { create: create };
}

function create(service, avoidWith, myLogger) {
  var instance = new EventEmitter;

  logger = myLogger || logger;

  instance.avoid = avoid;

  if(musicStations.indexOf(service) === -1) {
    instance.avoidTopic = "nowAndNext";
  } else {
    instance.avoidTopic = "nowPlaying";
  }

  return instance;

  function avoid() {
    var avoidingEvent = service+"/"+instance.avoidTopic;

    logger.debug(
      "Begin avoiding", service, "with", avoidWith,
      "duration", instance.avoidTopic,
      "event", avoidingEvent
    );

    //start avoiding
    instance.emit("begin", service);

    bbcServices.once(avoidingEvent, function() {
      //stop avoiding
      logger.debug("end avoiding");
      instance.emit("end", service);
    });
  }
}
