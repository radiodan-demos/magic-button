var api = require('./utils/api');

var PowerStore = require('./stores/power'),
    AudioStore = require('./stores/audio'),
    ServicesStore = require('./stores/services'),
    NowAndNextStore = require('./stores/now-and-next'),
    CurrentServiceStore = require('./stores/current-service');

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
    AppView.set('services', ServicesStore.getAllServicesAsArray());
  });

  NowAndNextStore.addChangeListener(function () {
    AppView.set('nowAndNext', NowAndNextStore.get(CurrentServiceStore.getCurrentId()));
  });

  CurrentServiceStore.addChangeListener(function () {
    AppView.set('current', CurrentServiceStore.getCurrent());
  });

  api.connectEventStream();
  api.getInitialState();
}