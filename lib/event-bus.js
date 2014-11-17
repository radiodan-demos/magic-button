var EventEmitter = require('eventemitter2').EventEmitter2,
    logger       = require('radiodan-client').utils.logger(__filename);

module.exports.create = create;

function create() {
  var instance = new EventEmitter({ wildcard: true });
  return instance;
}
