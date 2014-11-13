var api = require('./utils/api');

var PowerStore = require('./stores/power'),
    AudioStore = require('./stores/audio'),
    ServicesStore = require('./stores/services'),
    NowAndNextStore = require('./stores/now-and-next'),
    NowPlayingStore = require('./stores/now-playing'),
    CurrentServiceStore = require('./stores/current-service'),
    AvoiderStore = require('./stores/avoider'),
    AnnouncerStore = require('./stores/announcer'),
    RadioSettingsStore = require('./stores/radio-settings'),
    ErrorStore = require('./stores/error'),
    Logger = require('js-logger');

var AppView = require('./view');

AppView.init()
       .then(initState);

function initState() {
  Logger.info('init');

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
    var currentId = CurrentServiceStore.getCurrentId();
    AppView.set('current', CurrentServiceStore.getCurrent());
    AppView.set('nowPlaying', NowPlayingStore.get(currentId));
    AppView.set('nowAndNext', NowAndNextStore.get(currentId));
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

  ErrorStore.addChangeListener(function () {
    AppView.set('error', ErrorStore.currentError());
  });

  api.connectEventStream();
  api.getInitialState()
     .then(function (state) {
        if (state.debug && state.debug.logLevel) {
          var level = state.debug.logLevel.toUpperCase();
          console.log('Log level %o requested', level);
          Logger.useDefaults();
          if (Logger[level]) {
            Logger.setLevel(Logger[level]);
            console.log('Log level %o set', level);
          } else {
            console.warn('%o not available', level);
          }
        }
     });

  // Read announcer current state
  require('./api/announce')();
}