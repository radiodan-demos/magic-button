/* jshint white: false, latedef: nofunc, browser: true, devel: true */
/* global EventSource */
'use strict';

console.log('Core app started');

var Ractive = require('ractive'),
    xhr     = require('./xhr'),
    utils   = require('./utils'),
    Promise = require('es6-promise').Promise;

/*
  Ractive plugins
*/
require('ractive-events-tap');

var container = document.querySelector('[data-ui-container]'),
    template  = document.querySelector('[data-ui-template]#mainTmpl').innerText,
    state = {},
    defaults,
    ui;

window.state = state;

defaults = {
  radio: {
    power : { isOn: false },
    audio : { volume: 0   },
    magic : {
      avoider: { state: null, settings: null }
    },
    settings: {},
    current: null
  },
  ui: { panels: {} },
  services: []
};

var initialStateData = Promise.all([
  xhr.get('/radio/state.json'),
  xhr.get('/avoider/state.json'),
  xhr.get('/avoider/settings.json')
]);

initialStateData
  .then(initWithData)
  .then(null, failure('state'));

function initWithData(states) {
  console.log('initWithData', states);
  var radio    = JSON.parse(states[0]),
      avoider  = JSON.parse(states[1]),
      avoiderSettings = JSON.parse(states[2]);

  // Services available
  state.services = radio.services || defaults.services;

  // State of the radio
  state.radio = {
    power: radio.power || defaults.radio.power,
    audio: radio.audio || defaults.radio.audio,
    magic: defaults.radio.magic,
    current: radio.current || defaults.radio.current
  };

  // Magic features
  state.radio.magic.avoider = {
    state   : avoider, // current state of the feature
    settings: avoiderSettings // settings for the feature
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
    data      : state
  });

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
  ui.on('service', uiServiceChange);
  ui.on('power', uiPower);
  ui.on('avoid', uiAvoid);
  ui.observe('radio.magic.avoider.settings', uiAvoidSettings, { init: false });
  ui.observe('radio.magic.avoider.state', uiAvoidState, { init: false });

  /*
    UI -> UI
  */
  ui.on('stations-button', createPanelToggleHandler('services'));
  ui.on('volume-button', createPanelToggleHandler('volume'));
  ui.on('settings-button', createPanelToggleHandler('settings'));

  console.log('initialised with data', state);
}

function createPanelToggleHandler(panelId) {
  var keypath = 'ui.panels.' + panelId + '.isOpen';
  return function (/* evt */) {
    var isOpen = this.get(keypath);
    this.set(keypath, !isOpen);
  };
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

function uiAvoidState(state) {
  if (state.isAvoiding) {
    console.log('is avoiding');
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
      ui.set(keypathForServiceId(content.data.id, state.services), content.data);
      ui.set('radio.current', content.data);
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
