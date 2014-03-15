var utils  = require("radiodan-client").utils,
    logger = utils.logger(__filename),
    http   = require("http");

module.exports = { get: get };

function get(uri) {
  var requested = utils.promise.defer(),
      dataFound = utils.promise.defer();

  http.get(uri, requested.resolve);

  requested.promise.then(function(res) {
    var body = "";

    res.setEncoding("utf8");

    res.on("data", function(chunk) {
      body += chunk;
    });

    res.on("end", function() {
      dataFound.resolve(body);
    });

    req.on("error", function(error) {
      logger.warn(error);
      dataFound.reject(error);
    });
  });

  return dataFound.promise;
}
