var EventEmitter = require('events').EventEmitter;

module.exports = function (selector) {
  var el = document.querySelector(selector),
      instance = new EventEmitter();

  el.addEventListener('click', function (evt) {
    instance.emit('volume', el.value);
  });

  instance.set = function (data) {
    el.value = data.volume || 0;
  };

  return instance;
};
