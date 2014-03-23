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
      .then(function(data) {
        var settings = data || db.emptySet;

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

    settings = JSON.parse(JSON.stringify(data));
    settings.type = "avoid";

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

  function prepareDatastore(options) {
    var defaultOptions = {
          filename: __dirname+"/../../db/avoider.db",
          autoload: true
        },
        emptySet = {
          station: false,
          avoidType: "programme"
        },
        db, fetch, store;

    options = options || {};
    options = utils.mergeObjects(options, defaultOptions);

    db = new Datastore(options);
    db.emptySet = emptySet;

   return db;
  }
}
