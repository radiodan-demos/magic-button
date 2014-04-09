var EventEmitter = require('events').EventEmitter,
    logger       = require('radiodan-client').utils.logger(__filename);

module.exports.create = create;

function create() {
  var instance = new EventEmitter();

  var originalEmit = instance.emit;

  instance.emit = function (/* event, args */) {
    var args = Array.prototype.slice.apply(arguments),
        eventName = args.shift();

    originalEmit.call(instance, '*', eventName, args);

    return originalEmit.apply(instance, arguments);
  };

  return instance;
}
