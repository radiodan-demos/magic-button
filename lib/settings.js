var Datastore = require("nedb"),
    utils     = require("radiodan-client").utils,
    logger    = utils.logger(__filename);

module.exports = { create: create };

function create(options, myLogger) {
  var db = prepareDatastore(options);

  logger = myLogger || logger;

  return { build: build };

  function build(namespace, emptySet) {
    var query;

    if(typeof namespace !== "string") {
      throw new Error("Namespace must be a string");
    }

    query = { type: namespace };
    emptySet = emptySet || {};

    return { get: get, set: set };

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
          var settings = data || emptySet;

          delete settings["type"];
          delete settings["_id"];

          return utils.promise.resolve(settings);
        })
        .then(null, utils.failedPromiseHandler(logger));
    }

    function set(data) {
      var setPromise = utils.promise.defer(),
          options    = { upsert: true },
          settings;

      settings = utils.mergeObjects(query, data);

      db.update(query, settings, options, function(err, numReplaced) {
        if(err) {
          setPromise.reject(err);
        } else {
          setPromise.resolve(numReplaced);
        }
      });

      return setPromise.promise
        .then(null, utils.failedPromiseHandler(logger));
    }
  }

  function prepareDatastore(options) {
    var defaultOptions = {
          filename: __dirname+"/../../db/magic-button.db",
          autoload: true
        };

    options = options || {};
    options = utils.mergeObjects(options, defaultOptions);

    return new Datastore(options);
  }
}
