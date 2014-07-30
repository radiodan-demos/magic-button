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

  var Radio = require('./models/radio');
  radioModel = new Radio({
    eventSource: events
  });
  
  radioModel.on('change:isLoaded', initUi);

  state.radio = radioModel;
  state.services = radioModel.get('services');

  // TOOD: Replace with models above
  // state.services = radio.services || defaults.services;
  state.action = 'service';
  // state.isActive = function (id) {
  //   var current = this.get('radio.current.id');
  //   return current === id;
  // };

  // State of the radio
  // state.radio = {
  //   power: radio.power || defaults.radio.power,
  //   audio: radio.audio || defaults.radio.audio,
  //   magic: defaults.radio.magic
  // };

  // Radio settings
  // state.radio.settings = {
  //   action  : 'radioNextSettingService',
  //   services: transformServices(radioSettings.preferredServices, state.services) || defaults.radio.services
  // };

  /*
    Return a copy of the services list with 
    active services marked
  */
  function transformServices(preferred, all) {
    return all.map(function (service) {
      var copy = clone(service);
      copy._isActive = preferred.indexOf(copy.id) > -1;
      copy.isActive = function () { return copy._isActive; };
      return copy;
    });
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

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

  // State of this UI
  state.ui = defaults.ui;

  // Helper functions for templates
  state.first = function (array) {
    return array[0];
  };

  // Parse an image URL template to a specific
  // size
  state.imageUrl = function (template, size) {
    return template.replace('$recipe', size);
  };
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
  });

  /*
    UI actions -> Radio State
  */
  var uiToAction = utils.uiToAction;

  // ui.on('service',  uiToAction('id', require('./actions/service')));
  // ui.on('power',    uiToAction('isOn', require('./actions/power')));
  ui.on('service-selected', function (serviceId) {
    radioModel.setCurrentServiceById(serviceId);
  });
  ui.on('power', function (evt) {
    evt.original.preventDefault();
    radioModel.togglePower();
  });
  ui.on('avoid',    uiToAction('isAvoiding', require('./actions/avoid').set));
  ui.on('announce', uiToAction('isAnnouncing', require('./actions/announce').set));
  ui.observe('radio.settings', require('./actions/radio-settings'), { init: false, debug: true });
  ui.observe('radio.magic.avoider.settings', require('./actions/avoid').settings, { init: false });

  ui.observe('radio.magic.avoider.state', uiAvoidState, { debug: true });
  ui.observe('radio.magic.announcer.state', uiAnnounceState, { debug: true });

  ui.on('services-partial', function (event, action) {
    event.original.preventDefault();
    console.log('firing', action, event);
    ui.fire(action, event);
  });  
  ui.on('avoidSettingService', function (event) {
    ui.set('radio.magic.avoider.settings.serviceId', event.context.id);
  });
  ui.on('radioNextSettingService', function (event) {
    ui.set(event.keypath + '._isActive', !event.context._isActive);
  });

  /*
    UI -> UI
  */
  ui.on('stations-button', utils.createPanelToggleHandler('services'));
  ui.on('volume-button', utils.createPanelToggleHandler('volume'));
  ui.on('settings-button', utils.createPanelToggleHandler('settings'));
  ui.on('avoid-settings', utils.createPanelToggleHandler('avoiderSettings'));
  ui.on('track-display', function () {
    var current = ui.get('ui.panels.metadata.view');
    ui.set('ui.panels.metadata.view', current === 'track' ? 'prog' : 'track');
  });
  ui.set('ui.panels.metadata.view', 'prog');

  /*
    Create magic buttons
  */
  ui.set('ui.magic.avoider', {});
  ui.set('ui.magic.announcer', {});

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


/*
  Helpers
*/
function findServiceById(id, services) {
  var index = findIndexById(id, services);
  return services[index];
}

function findIndexById(id, services) {
  var index = null;
  services.forEach(function (item, idx) {
    if (item.id === id) { index = idx; }
  });
  return index;
}

function keypathForServiceId(id, services) {
  return 'services.' + findIndexById(id, services);
}

function augmentServiceWithCurrent(source, services) {

  if (!source) { return; }

  var id = source.id,
      service = services[findIndexById(id, services)];

  Object.keys(source)
        .forEach(function (key) {
          console.log(key, service[key], source[key]);
          service[key] = source[key];
        });
}