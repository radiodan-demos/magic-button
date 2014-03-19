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
  var instance = new EventEmitter;

  instance.store = {};

  listenForEvents();

  return instance;

  function listenForEvents() {
    var url = bbcServicesURL+"/stream",
        es  = new EventSource(url),
        firstError = true;

    logger.debug("Connecting to", url);

    es.onmessage = handleMessage;

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
        store;

    if (data) {
      store = instance.store[data.service] = instance.store[data.service] || {};

      store[data.topic] = data.data;

      instance.emit(data.service, data.topic, data.data);
      instance.emit(data.service+"/"+data.topic, data.data);
    }
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
