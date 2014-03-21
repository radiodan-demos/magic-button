var EventSource    = require("eventsource"),
    EventEmitter   = require("events").EventEmitter,
    utils          = require("radiodan-client").utils,
    http           = require("./http-promise"),
    logger         = utils.logger(__filename),
    bbcServicesURL = process.env.BBC_SERVICES_URL;

if(typeof bbcServicesURL === "undefined") {
  logger.error("BBC_SERVICES_API not found in ENV");
  process.exit();
}

module.exports = { create: create };

function create() {
  var instance = new EventEmitter,
      ready    = utils.promise.defer();

  instance.ready = ready.promise;
  instance.cache = {};
  instance.connect = connect;
  instance.listenForEvents = listenForEvents;

  return instance;

  function connect() {
    var url = bbcServicesURL+"/stream",
        es  = new EventSource(url);

    logger.debug("Connecting to", url);

    listenForEvents(es);
    return instance;
  }

  function listenForEvents(es) {
    var firstError = true;

    es.onmessage = function(data) {
      ready.resolve();
      handleMessage(data);
    }

    es.onerror = function() {
      // always fails on startup
      if(firstError) {
        firstError = false;
      } else {
        logger.warn("EventSource error");
      }
    };
  }

  function handleMessage(msg) {
    var data = parseMessage(msg.data),
        cache;

    if (data) {
      cache = cacheFor(data.service);

      cache[data.topic] = data.data;

      instance.emit(data.service, data.topic, data.data);
      instance.emit(data.service+"/"+data.topic, data.data);
    }
  }

  function cacheFor(serviceId) {
    instance.cache[serviceId] = instance.cache[serviceId] || {};
    return instance.cache[serviceId];
  }

  function parseMessage(data) {
    try {
      return JSON.parse(data);
    } catch(err) {
      logger.warn("Cannot parse", err);
      return false;
    }
  }
}
