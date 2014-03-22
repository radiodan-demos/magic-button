var Datastore = require("nedb"),
    utils     = require("radiodan-client").utils,
    logger    = utils.logger(__filename);

module.exports = { create: create };

function create(options, myLogger) {
  var instance = {},
      db;

  logger = myLogger || logger;
  db     = prepareDatastore(options);
  instance = { get: get, set: set };

  return instance;

  function get() {
    var getPromise = utils.promise.defer();

    db.findOne({type: "avoid"}, function(err, settings) {
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
    return db.store(settings)
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
