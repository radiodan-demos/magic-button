/* jshint white: false, latedef: nofunc, browser: true, devel: true */
/* global EventSource */
'use strict';

console.log('Core app started');

/* Measuring rendering time */
window.loadStartTime = Date.now();

var Ractive = require('ractive'),
    xhr     = require('./xhr'),
    utils   = require('./utils'),
    Promise = require('es6-promise').Promise,
    d3      = require('./lib/d3'),
    jQuery  = require('jquery');

window.jQuery = jQuery;
// owl.carousel requires global jQuery - boo!
require('../lib/owl-carousel/owl.carousel');

window.d3 = d3;

/*
  Ractive plugins
*/
require('ractive-events-tap');

/*
  Ractive-Backbone adaptor
*/
require('ractive-backbone/Ractive-Backbone');

var container = document.querySelector('[data-ui-container]'),
    template  = document.querySelector('[data-ui-template]#mainTmpl').innerText,
    state = {},
    radioModel,
    defaults,
    ui;

window.state = state;

defaults = {
  radio: {
    power : { isOn: false },
    audio : { volume: 0   },
    magic : {
      avoider  : { state: null, settings: null },
      announcer: { state: null, settings: null }
    },
    settings: { services: [] },
    current: null
  },
  ui: { panels: {} },
  services: []
};

var initialStateData = Promise.all([
  xhr.get('/radio/state.json'),
  xhr.get('/avoider/state.json'),
  xhr.get('/avoider/settings.json'),
  xhr.get('/announcer/state.json'),
  xhr.get('/announcer/settings.json'),
  xhr.get('/radio/settings.json')
]);

initialStateData
  .then(initWithData)
  .then(null, utils.failure('state'));

function initWithData(states) {
  console.log('initWithData', states);
  var radio    = JSON.parse(states[0]),
      avoider  = JSON.parse(states[1]),
      avoiderSettings = JSON.parse(states[2]),
      announcer = JSON.parse(states[3]),
      announcerSettings = JSON.parse(states[4]),
      radioSettings = JSON.parse(states[5]);

  var events = getEventStream();

  var Avoider = require('./models/avoider');
  avoider = new Avoider({
    eventSource: events
  });

  avoider.on('change', function () {
    console.log('avoider#change', arguments);
  });

  var Announcer = require('./models/announcer');

  var Radio = require('./models/radio');
  radioModel = new Radio({
    eventSource: events,
    magic: {
      avoider: avoider,
      announcer: new Announcer({ eventSource: events })
    }
  });
  
  radioModel.on('change:isLoaded', initUi);

  state.radio = radioModel;
  state.services = radioModel.get('services');

  // Magic features
  // state.radio.magic.avoider = {
  //   state   : avoider, // current state of the feature
  //   settings: avoiderSettings, // settings for the feature
  //   action  : 'avoidSettingService',
  //   isActive: function (id) {
  //     return this.get('radio.magic.avoider.settings.serviceId') === id;
  //   }
  // };

  // state.radio.magic.announcer = {
  //   state   : announcer,
  //   settings: announcerSettings
  // };
}

function initUi() {
  console.log('initUi');
  
  window.ui = ui = new Ractive({
    el        : container,
    template  : template,
    adapt     : [ 'Backbone' ],
    debug     : true,
    data      : state,
    complete  : function () {
      console.log('splashStartTime - now = %oms', (Date.now() - splashStartTime));
    },
    components: {
      // Main Views
      Standby : require('./components/simple')('#standbyTmpl'),
      Controls: require('./components/controls'),
      // Components
      Masthead: require('./components/simple')('#mastheadTmpl')
    }
  });

  console.log('ui', ui);

  /*
    Logging
  */
  ui.on('change', function (changes) {
    Object.keys(changes).forEach(function (keypath) {
      console.log('ui changed: ', keypath, changes[keypath]);
    });
  });

  // WORKAROUND:
  // Force ractive to re-scan the model
  // when the current service changes
  // 
  radioModel.on('change:current', function () {
    ui.update();
    console.log('Force UI update (change:current)');
  });
  // And also when the services collection changes
  radioModel.on('change:services', function () {
    ui.update();
    console.log('Force UI update (change:services)');
  });


  /*
    UI actions -> Radio State
  */
  ui.on('tune-service', function (serviceId) {
    radioModel.setCurrentServiceById(serviceId);
  });
  ui.on('power', function (evt) {
    evt.original.preventDefault();
    radioModel.togglePower();
  });

  ui.on('avoid', function (evt) {
    evt.original.preventDefault();
    if (radioModel.get('magic').avoider.isStarted()) {
      radioModel.get('magic').avoider.end();
    } else {
      radioModel.get('magic').avoider.start();
    }
  });

  ui.on('announce', function (evt) {
    evt.original.preventDefault();
    if (radioModel.get('magic').announcer.isStarted()) {
      radioModel.get('magic').announcer.end();
    } else {
      radioModel.get('magic').announcer.start();
    }
  });


  // To be removed
  var uiToAction = utils.uiToAction;

  // ui.on('service',  uiToAction('id', require('./actions/service')));
  // ui.on('power',    uiToAction('isOn', require('./actions/power')));
  //ui.on('avoid',    uiToAction('isAvoiding', require('./actions/avoid').set));
  //ui.on('announce', uiToAction('isAnnouncing', require('./actions/announce').set));
  //ui.observe('radio.settings', require('./actions/radio-settings'), { init: false, debug: true });
  //ui.observe('radio.magic.avoider.settings', require('./actions/avoid').settings, { init: false });

  //ui.observe('radio.magic.avoider.state', uiAvoidState, { debug: true });
  //ui.observe('radio.magic.announcer.state', uiAnnounceState, { debug: true });

  /*
  ui.on('avoidSettingService', function (event) {
    ui.set('radio.magic.avoider.settings.serviceId', event.context.id);
  });
  ui.on('radioNextSettingService', function (event) {
    ui.set(event.keypath + '._isActive', !event.context._isActive);
  });
  */

  /*
    UI -> UI
  */
  //ui.on('settings-button', utils.createPanelToggleHandler('settings'));
  //ui.on('avoid-settings', utils.createPanelToggleHandler('avoiderSettings'));

  /*
    Create magic buttons
  */
  //ui.set('ui.magic.avoider', {});
  //ui.set('ui.magic.announcer', {});

  var magicButtonCarousel = jQuery('#magic ul').owlCarousel();

  console.log('initialised with data', state);
}

function uiAvoidState(state) {
  updateAvoidState();
}

function updateAvoidState() {
  var state = ui.get('radio.magic.avoider.state');

  if (state && state.isAvoiding) {
    var now = Date.now();
    var start = Date.parse(state.start);
    var end = Date.parse(state.end);

    if (isNaN(end.valueOf())) {
      console.warn('No avoid end time');
      return;
    }

    var diff = end - now;
    var angle = Math.PI * 2;

    // Handle negative time
    if (diff >= 0) {
      var formattedDiff = formatTimeDiff(diff);
      ui.set('radio.magic.avoider.state.timeLeft', formattedDiff);
      angle = angleForTimePeriod(start, end, now);
    }

    ui.set('ui.magic.avoider', {
      angle: angle
    });

    window.setTimeout(updateAvoidState, 1000);
  } else {
    ui.set('ui.magic.avoider', {
      angle: 0
    });
  }
}

function uiAnnounceState(state) {
  ui.set('ui.magic.announcer', {
    angle: 0
  });
}

function angleForTimePeriod(start, end, now) {
  var startTime = start.valueOf(),
      endTime   = end.valueOf(),
      nowTime   = now.valueOf();

  var scale = d3.scale.linear()
          .domain([startTime, endTime])
          .range([0, Math.PI * 2]);

  return scale(nowTime);
}

function formatTimeDiff(diffInMs) {
  var diffSecs = diffInMs / 1000;
  var mins = diffSecs / 60;
  var secsLeft = Math.abs(Math.floor(mins) - mins);
  secsLeft = Math.floor(secsLeft * 60);
  if (secsLeft < 10) {
    secsLeft = '0' + secsLeft;
  }
  return Math.floor(mins) + 'm ' + secsLeft;
}

/*
  State -> UI
*/
var eventSource = new EventSource('/events');

eventSource.addEventListener('message', function (evt) {
  var content = JSON.parse(evt.data);

  // console.group('New message:', content.topic, content);
  console.log('New message:', content.topic, content);

  switch(content.topic) {
    case 'avoider':
      ui.set('radio.magic.avoider.state', content.data);
      break;
    case 'settings.avoider':
      utils.ractiveSetIfObjectPropertiesChanged(ui, 'radio.magic.avoider.settings', content.data);
      break;
    default:
      // console.log('Unhandled topic', content.topic, content);
  }

  // console.groupEnd();
});

eventSource.addEventListener('error', function (evt) {
  console.warn(evt);
});

function getEventStream() {
  return new EventSource('/events');
}
