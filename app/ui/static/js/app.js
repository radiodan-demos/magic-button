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

var container = document.querySelector('[data-ui-container]'),
    template  = document.querySelector('[data-ui-template]#mainTmpl').innerText,
    state = {},
    defaults,
    ui,
    activeArc,
    inactiveArc;

activeArc = d3.svg.arc()
              .innerRadius(44.4827586)
              .outerRadius(50)
              .startAngle(0);

inactiveArc = d3.svg.arc()
                .innerRadius(49.5)
                .outerRadius(50)
                .startAngle(0);

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
  .then(null, failure('state'));

function initWithData(states) {
  console.log('initWithData', states);
  var radio    = JSON.parse(states[0]),
      avoider  = JSON.parse(states[1]),
      avoiderSettings = JSON.parse(states[2]),
      announcer = JSON.parse(states[3]),
      announcerSettings = JSON.parse(states[4]),
      radioSettings = JSON.parse(states[5]);

  // Services available
  state.services = radio.services || defaults.services;
  state.action = 'service';
  state.isActive = function (id) {
    var current = this.get('radio.current.id');
    return current === id;
  };

  // State of the radio
  state.radio = {
    power: radio.power || defaults.radio.power,
    audio: radio.audio || defaults.radio.audio,
    magic: defaults.radio.magic
  };

  // Radio settings
  state.radio.settings = {
    action  : 'radioNextSettingService',
    services: transformServices(radioSettings.preferredServices, state.services) || defaults.radio.services
  };

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

  /*
    Merge current data with corresponding service
  */
  augmentServiceWithCurrent(radio.current || defaults.radio.current, state.services);

  // Magic features
  state.radio.magic.avoider = {
    state   : avoider, // current state of the feature
    settings: avoiderSettings, // settings for the feature
    action  : 'avoidSettingService',
    isActive: function (id) {
      return this.get('radio.magic.avoider.settings.serviceId') === id;
    }
  };

  state.radio.magic.announcer = {
    state   : announcer,
    settings: announcerSettings
  };

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

  window.ui = ui = new Ractive({
    el        : container,
    template  : template,
    data      : state,
    complete  : function () {
      console.log('splashStartTime - now = %oms', (Date.now() - splashStartTime));
    }
  });

  // Set the current service
  if (radio.current) {
    setCurrentServiceById( radio.current.id );
  }

  /*
    Logging
  */
  ui.on('change', function (changes) {
    Object.keys(changes).forEach(function (keypath) {
      console.log('changed: ', keypath, changes[keypath]);
    });
  });

  /*
    UI -> Radio State
  */
  ui.on('volume', utils.debounce(uiVolumeChange, 250));
  ui.on('services-partial', function (event, action) {
    event.original.preventDefault();
    console.log('firing', action, event);
    ui.fire(action, event);
  });
  ui.on('service', uiServiceChange);
  ui.on('power', uiPower);
  ui.on('avoid', uiAvoid);
  ui.on('announce', uiAnnounce);
  ui.on('avoidSettingService', function (event) {
    ui.set('radio.magic.avoider.settings.serviceId', event.context.id);
  });
  ui.on('radioNextSettingService', function (event) {
    ui.set(event.keypath + '._isActive', !event.context._isActive);
  });
  ui.observe('radio.settings', uiRadioSettings, { init: false });
  ui.observe('radio.magic.avoider.settings', uiAvoidSettings, { init: false });
  ui.observe('radio.magic.avoider.state', uiAvoidState, { debug: true });
  ui.observe('radio.magic.announcer.state', uiAnnounceState, { debug: true });

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
  ui.set('ui.magic.avoider', {
    outerArcPath: inactiveArc({ endAngle: Math.PI * 2 }),
    progressArcPath: activeArc({ endAngle: 0 })
  });

  ui.set('ui.magic.announcer', {
    outerArcPath: inactiveArc({ endAngle: Math.PI * 2 }),
    progressArcPath: activeArc({ endAngle: 0 })
  });

  var magicButtonCarousel = jQuery('#magic ul').owlCarousel();

  console.log('initialised with data', state);
}

function uiVolumeChange(evt) {
  console.log('vol', evt.context);
  var value = evt.context.volume;
  console.log('ui: volume changed', value);
  xhr.post('/radio/volume/value/' + value ).then(success('volume'), failure('volume'));
}

function uiServiceChange(evt) {
  evt.original.preventDefault();

  var id = evt.context.id;

  console.log('ui: service selected', id);
  xhr.post('/radio/service/' + id ).then(success('service'), failure('service'));
}

function uiPower(evt) {
  evt.original.preventDefault();
  var isOn = evt.context.isOn,
      method = isOn ? 'DELETE' : 'PUT';

  xhr(method, '/radio/power');
}

function uiAvoid(evt) {
  evt.original.preventDefault();
  var method = evt.context.isAvoiding ? 'DELETE' : 'POST';
  xhr(method, '/avoider');
}

function uiAvoidSettings(data) {
  console.log('uiAvoidSettings');
  var payload = JSON.stringify(data),
      opts = {
        headers: { 'Content-type': 'application/json' },
        data: payload
      };
  console.log('Avoid settings changed', opts);
  xhr.post('/avoider/settings.json', opts);
}

function uiRadioSettings(data) {
  console.log('uiRadioSettings', data);
  var settings = {
        preferredServices: extractActiveServices(data.services)
      },
      payload = JSON.stringify(settings),
      opts = {
        headers: { 'Content-type': 'application/json' },
        data: payload
      };
  console.log('Radio settings changed', opts);
  xhr.post('/radio/settings.json', opts);
}

function extractActiveServices(services) {
  return services.map(function (service) { 
    return service._isActive ? service.id : undefined;
  }).filter(function(item){return item}); ;
}

function uiAvoidState(state) {
  updateAvoidState();
}

function updateAvoidState() {
  var state = ui.get('radio.magic.avoider.state');

  if (state.isAvoiding) {
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
      outerArcPath: activeArc({ endAngle: Math.PI * 2 }),
      progressArcPath: activeArc({ endAngle: angle })
    });

    window.setTimeout(updateAvoidState, 1000);
  } else {
    ui.set('ui.magic.avoider', {
      outerArcPath: inactiveArc({ endAngle: Math.PI * 2 }),
      progressArcPath: activeArc({ endAngle: 0 })
    });
  }
}

function uiAnnounce(evt) {
  evt.original.preventDefault();
  var method = evt.context.isAnnouncing ? 'DELETE' : 'POST';
  xhr(method, '/announcer');
}

function uiAnnounceState(state) {
  var path = activeArc({ endAngle: Math.PI * 2 });
  ui.set('ui.magic.announcer', {
        outerArcPath: path,
        progressArcPath: path
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

var currentServiceObserver = null;

/*
  Sets a new current service in the app
  This ensures that any data updates for the service
  is synced with `radio.current`
*/
function setCurrentServiceById(id) {
  if (currentServiceObserver) {
    console.log('Cancelling old currentServiceObserver');
    currentServiceObserver.cancel();
  }

  // Set-up an observer for keeping `radio.current` in sync
  var keypath = keypathForServiceId(id, state.services);
  currentServiceObserver = ui.observe(keypath, function () {
    ui.set('radio.current', ui.get(keypath));
  });
}

function processServiceChange(content) {
  var keypath;

  if (content.data) {

    // Change the service, setting up new sync observers
    setCurrentServiceById(content.data.id);

    keypath = keypathForServiceId(content.data.id, state.services);

    // Setting data on the new service will now update
    // `radio.current` as will nowPlaying and nowAndNext
    // updates for this service
    ui.set(keypath, content.data);
  } else {
    ui.set('radio.current', null);
  }
}

/*
  State -> UI
*/
var eventSource = new EventSource('/events');

eventSource.addEventListener('message', function (evt) {
  var content = JSON.parse(evt.data);

  console.group('New message:', content.topic, content);

  switch(content.topic) {
    case 'audio.volume':
      ui.set('radio.audio', content.data);
      break;
    case 'service.changed':
      processServiceChange(content);
      break;
    case 'power':
      ui.set('radio.power', content.data);
      break;
    case 'avoider':
      ui.set('radio.magic.avoider.state', content.data);
      break;
    case 'settings.avoider':
      ractiveSetIfObjectPropertiesChanged(ui, 'radio.magic.avoider.settings', content.data);
      break;
    case 'nowPlaying':
      ui.set(keypathForServiceId(content.service, ui.get('services')) + '.nowPlaying', content.data);
      break;
    case 'nowAndNext':
      ui.set(keypathForServiceId(content.service, ui.get('services')) + '.nowAndNext', content.data);
      break;
    default:
      // console.log('Unhandled topic', content.topic, content);
  }

  console.groupEnd();
});

eventSource.addEventListener('error', function (evt) {
  console.warn(evt);
});

/*
  Generic promise success or failure options
*/
function success(msg) {
  return function (content) {
    console.log(msg, 'success', content);
  };
}

function failure(msg) {
  return function (err) {
    console.warn(msg, 'failure', err.stack);
  };
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

/*
  Object comparison helpers
*/
function hasDifferentProperties(first, second) {
  return Object.keys(first).some(
    function (key) {
      var firstProp  = first[key],
          secondProp = second[key];
      return firstProp !== secondProp;
    }
  );
}

/*
  Ractive-specific helpers
*/
function ractiveSetIfObjectPropertiesChanged(ractive, keypath, obj) {
  var current = ractive.get(keypath);

  if ( hasDifferentProperties(obj, current) ) {
    ractive.set(keypath, obj);
  }
}
