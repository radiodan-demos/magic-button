var EventSource    = require("eventsource"),
    EventEmitter   = require("events").EventEmitter,
    utils          = require("radiodan-client").utils,
    http           = require("./http-promise"),
    bbcServicesURL = process.env.BBC_SERVICES_URL;

module.exports = { create: create };

function create() {
  var instance = new EventEmitter,
      logger   = utils.logger(__filename);

  instance.store = {};

  listenForEvents();

  return instance;

  function listenForEvents() {
    var url = bbcServicesURL+"/stream",
        es  = new EventSource(url);

    logger.debug("Connecting to", url);

    es.onmessage = handleMessage;

    es.onerror = function() {
      logger.warn("EventSource error");
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
