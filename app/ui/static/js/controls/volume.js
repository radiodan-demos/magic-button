/* globals radiodan */
'use strict';

var EventEmitter = require('events').EventEmitter;

module.exports = function (deviceName) {
  var audio    = radiodan.audio.create(deviceName),
      instance = new EventEmitter();

  function init() {
    audio.status().then(updateVolume);
    audio.on('volume', function(data) {
      instance.emit('volume', data.value);
    });
  }

  function updateVolume(status) {
    if (status.volume) {
      instance.emit('volume', status.volume);
    }
  }

  instance.set = function (params) {
    audio.volume(params);
  };

  init();

  return instance;
};
