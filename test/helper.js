'use strict';


//supress log messages
process.env.LOG_LEVEL = 'fatal';

//set test mode
process.env.NODE_ENV = 'test';

var chai = require('chai'),
    cap  = require('chai-as-promised');

global.sinon        = require('sinon');
global.fs           = require('fs');
global.utils        = require('radiodan-client').utils;
global.EventEmitter = require('events').EventEmitter;
global.assert       = chai.assert;
global.fakeRadiodan = fakeRadiodan;
global.libDir       = __dirname + '/../lib/';

chai.use(cap);

function fakeRadiodan(objType) {
  switch(objType) {
    case 'player':
      return fakeRadiodanPlayer();
    case 'ui':
      return fakeRadiodanUI();
    default:
      throw new Error('Unknown radiodan component ' + objType);
  }
}

function fakeRadiodanPlayer() {
  var actions = ['add', 'clear', 'next', 'pause', 'play', 'previous', 'random', 'remove', 'repeat', 'search', 'status', 'stop', 'updateDatabase', 'volume'],
      players = ['main', 'announcer', 'avoider'],
      output = {};

  players.forEach(function(p) {
    output[p] = stubbedPromisesForActions(actions);
  });

  return output;
}

function fakeRadiodanUI() {
  var actions = ['emit'],
      obj     = { 'RGBLEDs': ['power'] },
      colours = { 'green': 'green'},
      output  = { colours: colours };

  Object.keys(obj).forEach(function(k) {
    output[k] = {};

    obj[k].forEach(function(p) {
      output[k][p] = stubbedPromisesForActions(actions);
    });
  });

  return output;
}

function stubbedPromisesForActions(actions) {
  var instance = {};

  actions.forEach(function(a) {
    instance[a] = sinon.stub().returns(utils.promise.resolve());
  });

  return instance;
}
