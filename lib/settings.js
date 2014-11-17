var Datastore        = require('nedb'),
    deepEqual        = require('deepequal'),
    EventEmitter = require('eventemitter2').EventEmitter2,
    utils            = require('radiodan-client').utils,
    logger           = utils.logger(__filename),
    settingsDefaults = require('../config/settings-defaults.json'),
    defaultDBPath    = (process.env.SETTINGS_PATH || __dirname+'/../db') + '/magic-button.db';

module.exports = { create: create };

function create(eventBus, options, myLogger) {
  var cache = {},
      db;

  options = options || {};
  logger  = myLogger || logger;
  db      = prepareDatastore(options);

  return { get: get };

  function get(namespace, defaults) {
    if(defaults || !cache[namespace]) {
      cache[namespace] = build(namespace, defaults);
    }

    return cache[namespace];
  }

  function build(namespace, defaults) {
    var instance = new EventEmitter({ wildcard: true }),
        query;

    if(typeof namespace !== 'string') {
      throw new Error('Namespace must be a string');
    }

    query = { type: namespace };
    defaults = defaults || settingsDefaults[namespace] || {};

    instance.type = namespace;
    instance.get = get;
    instance.set = set;
    instance.update = update;

    return instance;

    function get() {
      var getPromise = utils.promise.defer();

      db.findOne(query, function(err, settings) {
        if(err) {
          getPromise.reject(err);
        } else {
          getPromise.resolve(settings);
        }
      });

      return getPromise.promise
        .then(function(data) {
          var settings = data || defaults;

          delete settings['type'];
          delete settings['_id'];

          return utils.promise.resolve(settings);
        })
        .then(null, utils.failedPromiseHandler(logger));
    }

    function update(partial) {
      var self = this;
      return self.get().then(function(current) {
        var data = utils.mergeObjects(current, partial);
        return self.set(data);
      });
    }

    function set(data) {
      var setPromise = utils.promise.defer(),
          options    = { upsert: true },
          validData,
          dataToStore;

      return validate(data).then(function(validated) {
        validData = validated;
        dataToStore = utils.mergeObjects(query, validData);

        db.update(query, dataToStore, options, function(err, numReplaced) {
          if(err) {
            setPromise.reject(err);
          } else {
            setPromise.resolve(numReplaced);
          }
        })

        emitUpdate(validData);

        return setPromise.promise;
      });
    }

    function emitUpdate(data) {
      instance.emit('update', data);

      if(eventBus) {
        var message = 'settings.' + namespace;
        eventBus.emit(message, data);
      } else {
        logger.debug('No eventbus, cannot emit');
      }
    }

    function validate(input) {
      var validated = utils.promise.defer(),
          inputKeys, defaultKeys;

      input       = input || {};
      inputKeys   = Object.keys(input).sort();
      defaultKeys = Object.keys(defaults).sort();

      if(deepEqual(inputKeys, defaultKeys)) {
        validated.resolve(input);
      } else {
        var err = new Error('Required settings keys not found: '+defaultKeys);
        validated.reject(err);
      }

      return validated.promise;
    }
  }

  function prepareDatastore(options) {
    var defaultOptions = {
          filename: defaultDBPath,
          autoload: true
        };

    options = utils.mergeObjects(options, defaultOptions);

    return new Datastore(options);
  }
}
