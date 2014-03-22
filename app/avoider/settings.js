var Datastore = require("nedb"),
    utils     = require("radiodan-client").utils,
    logger    = utils.logger(__filename);

module.exports = { create: create };

function create(options, myLogger) {
  var instance = { get: get, set: set },
      query    = { type: "avoid" },
      db       = prepareDatastore(options);

  logger = myLogger || logger;

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
      .then(function(settings) {
        settings = settings || db.emptySet;
        return settings;
      })
      .then(null, utils.failedPromiseHandler(logger));
  }

  function set(settings) {
    var setPromise = utils.promise.defer();

    db.update(query, settings, function(err) {
      if(err) {
        setPromise.reject(err);
      } else {
        setPromise.resolve();
      }
    });

    return setPromise.promise
      .then(null, utils.failedPromiseHandler(logger));
  }

  function prepareDatastore(options) {
    var defaultOptions = {
          filename: "../../db/avoider.db",
          autoload: true
        },
        emptySet = {
          station: false,
          avoidType: "programme"
        },
        query = { type: "avoid" },
        db, fetch, store;

    options = options || {};
    options = utils.mergeObjects(options, defaultOptions);

    db = new Datastore(options);
    db.emptySet = emptySet;

   return db;
  }
}
