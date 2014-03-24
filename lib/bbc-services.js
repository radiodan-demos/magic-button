var EventSource    = require("eventsource"),
    EventEmitter   = require("events").EventEmitter,
    utils          = require("radiodan-client").utils,
    http           = require("./http-promise"),
    logger         = utils.logger(__filename),
    bbcServicesURL = process.env.BBC_SERVICES_URL;

module.exports = { create: create };

function create(myLogger) {
  var instance   = new EventEmitter,
      serviceIds = [],
      ready      = utils.promise.defer();

  logger = myLogger || logger;

  instance.ready           = ready.promise;
  instance.cache           = {};
  instance.get             = get;
  instance.connect         = connect;
  instance.listenForEvents = listenForEvents;
  instance.cacheStore      = cacheStore;

  return instance;

  function get(serviceId) {
    if(typeof serviceId === "undefined") {
      return serviceIds.map(function(serviceId) {
        var data = cacheFor(serviceId);
        data.id = serviceId;

        return data;
      });
    } else if(serviceIds.indexOf(serviceId) > -1) {
      return cacheFor(serviceId);
    } else {
      return null;
    }
  }

  function connect() {
    if(typeof bbcServicesURL === "undefined") {
      logger.error("BBC_SERVICES_URL not found in ENV");
      process.exit();
    }

    seedCache().then(connectToEventSource);

    return instance;
  }

  function seedCache() {
    var url = bbcServicesURL+"/services.json";

    return http.get(url).then(function(data) {
      var services;

      try {
        services = JSON.parse(data).services;
      } catch(err) {
        logger.warn(err);
        services = [];
      }

      services.forEach(function(service) {
        var serviceId = service.id;
        Object.keys(service).forEach(function(key) {
          cacheStore(serviceId, key, service[key]);
        });
      });

      ready.resolve();
    }).then(null, utils.failedPromiseHandler(logger));
  }

  function connectToEventSource() {
    var url = bbcServicesURL+"/stream",
        es;

    es = new EventSource(url);

    logger.debug("Connecting to", url);

    listenForEvents(es);
  }

  function listenForEvents(es) {
    var firstError = true;

    es.onmessage = function(data) {
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

    if(data) {
      cacheStore(data.service, data.topic, data.data);
      instance.emit(data.topic, data.service, data.data);
      instance.emit(data.service, data.topic, data.data);
      instance.emit(data.service+"/"+data.topic, data.data);
    }
  }

  function cacheStore(serviceId, topic, data) {
    var cache = cacheFor(serviceId);

    return cache[topic] = data;
  }

  function cacheFor(serviceId) {
    if(typeof instance.cache[serviceId] == "undefined") {
      serviceIds.push(serviceId);
      instance.cache[serviceId] = {};
    }

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
