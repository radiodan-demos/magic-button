var EventSource    = require('eventsource'),
    EventEmitter   = require('eventemitter2').EventEmitter2,
    utils          = require('radiodan-client').utils,
    http           = require('../http-promise'),
    logger         = utils.logger(__filename),
    bbcServicesURL = process.env.BBC_SERVICES_URL;

module.exports = { create: create };

function create(myLogger) {
  var instance   = new EventEmitter({wildcard: true}),
      serviceIds = [],
      ready      = utils.promise.defer(),
      stationsPromise;

  logger = myLogger || logger;

  instance.id              = 'bbc-services';
  instance.ready           = ready.promise;
  instance.cache           = {};
  instance.metadata        = metadata;
  instance.fetchServices   = fetchServices;
  instance.stations        = stations;
  instance.playlist        = playlist;
  instance.connect         = connect;
  instance.listenForEvents = listenForEvents;
  instance.cacheStore      = cacheStore;

  return instance;

  function playlist(serviceId) {
    var service = cacheFor(serviceId),
        playlist;

    if (service && service.playlist) {
      return {
        type: 'playlist',
        value: service.playlist
      };
    }
  }

  function fetchServices() {
    instance.connect();

    return instance.ready.then(function() {
      return serviceIds;
    });
  }

  function metadata(serviceId) {
    if(typeof serviceId === 'undefined') {
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

  function stations() {
    var url = bbcServicesURL+'/stations.json';

    if (!stationsPromise) {
      stationsPromise = http.get(url)
                            .then(function (data) {
                              var list = [],
                                  json = JSON.parse(data);
                              if (json.stations) {
                                list = json.stations;
                              }
                              return list;
                            })
                            .then(null, function(err) {
                              logger.warn(err);
                              return [];
                            });
    }

    return stationsPromise;
  }

  function connect() {
    if(typeof bbcServicesURL === 'undefined') {
      logger.error('BBC_SERVICES_URL not found in ENV');
    }

    seedCache().then(connectToEventSource);

    return instance;
  }

  function seedCache() {
    var url = bbcServicesURL+'/services.json';

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

      return ready.resolve();
    })
    .then(null, function(err) {
      logger.warn(err);

      // resolving ready promise so we can work with offline services
      ready.resolve();
      return utils.promise.reject(new Error('BBC Services offline?'));
    });
  }

  function connectToEventSource() {
    var url = bbcServicesURL+'/stream',
        es;

    es = new EventSource(url);

    logger.debug('Connecting to', url);

    listenForEvents(es);
  }

  function listenForEvents(es) {
    var firstError = true;

    es.addEventListener('message', function(data) {
      handleMessage(data);
    });

    es.addEventListener('error', function(error) {
      // always fails on startup
      if(firstError) {
        firstError = false;
      } else {
        logger.warn('EventSource error', error.stack);
      }
    });
  }

  function handleMessage(msg) {
    var data = parseMessage(msg.data),
        isNewData;

    if(!data) {
      logger.warn('Invalid JSON recieved', msg);
      return false;
    }

    isNewData = cacheStore(data.service, data.topic, data.data);

    if(isNewData) {
      // this is for the avoider
      instance.emit(data.service + '.' + data.topic, data.data);
      logger.debug('new data', data.service, data.topic, data.data);
    } else {
      logger.debug('data is the same', data.service, data.topic);
    }
  }

  function cacheStore(serviceId, topic, data) {
    var cache = cacheFor(serviceId);

    data = data || {};
    // delete timestamp to check for data difference
    delete data.received;

    if(JSON.stringify(data) === JSON.stringify(cache[topic])) {
      return false;
    } else {
      cache[topic] = data;
      return true;
    }
  }

  function cacheFor(serviceId) {
    if(typeof instance.cache[serviceId] == 'undefined') {
      serviceIds.push(serviceId);
      instance.cache[serviceId] = {};
    }

    return instance.cache[serviceId];
  }

  function parseMessage(data) {
    try {
      return JSON.parse(data);
    } catch(err) {
      logger.warn('Cannot parse', err);
      return false;
    }
  }
}
