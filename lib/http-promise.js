var utils  = require("radiodan-client").utils,
    logger = utils.logger(__filename),
    request = require("request");

module.exports = { get: get };

function get(uri) {
  var dfd  = utils.promise.defer(),
      opts = { encoding: "utf8", uri: uri };

  request(opts, function (error, response, body) {
    if (error) {
      logger.warn(error);
      dfd.reject(error);
    } else {
      dfd.resolve(body);
    }
  });

  return dfd.promise;
}
