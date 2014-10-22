var api = require('./utils/api');

var PowerStore = require('./stores/power'),
    AudioStore = require('./stores/audio'),
    ServicesStore = require('./stores/services'),
    NowAndNextStore = require('./stores/now-and-next'),
    NowPlayingStore = require('./stores/now-playing'),
    CurrentServiceStore = require('./stores/current-service'),
    AvoiderStore = require('./stores/avoider'),
    AnnouncerStore = require('./stores/announcer'),
    RadioSettingsStore = require('./stores/radio-settings');

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

  NowAndNextStore.addChangeListener(function (id) {
    var currentId = CurrentServiceStore.getCurrentId();
    if (currentId === id) {
      AppView.set('nowAndNext', NowAndNextStore.get(currentId));
    }
  });

  NowPlayingStore.addChangeListener(function (id) {
    var currentId = CurrentServiceStore.getCurrentId();
    if (currentId === id) {
      AppView.set('nowPlaying', NowPlayingStore.get(currentId));
    }
  });

  CurrentServiceStore.addChangeListener(function () {
    AppView.set('current', CurrentServiceStore.getCurrent());
  });

  AvoiderStore.addChangeListener(function () {
    AppView.set('avoider', AvoiderStore.getState());
  });

  AnnouncerStore.addChangeListener(function () {
    AppView.set('announcer', AnnouncerStore.getState());
  });

  RadioSettingsStore.addChangeListener(function () {
    AppView.set('settings', RadioSettingsStore.getState());
  });


  api.connectEventStream();
  api.getInitialState();

  // Read announcer current state
  require('./api/announce')();
}