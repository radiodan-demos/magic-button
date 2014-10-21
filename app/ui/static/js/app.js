var api = require('./utils/api');

var PowerStore = require('./stores/power'),
    AudioStore = require('./stores/audio'),
    ServicesStore = require('./stores/services');

var AppView = require('./view');

AppView.init()
       .then(initState);

function initState() {
  console.log('init');

  PowerStore.addChangeListener(function () {
    AppView.set('power', PowerStore.getState());
  });

  AudioStore.addChangeListener(function () {
    AppView.set('audio', AudioStore.getState());
  });

  ServicesStore.addChangeListener(function () {
    AppView.set('services', ServicesStore.getAllServices());
  });

  api.connectEventStream();
  api.getInitialState();
}