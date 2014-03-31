console.log('Core app started');

var Ractive = require('ractive'),
    xhr     = require('./xhr'),
    utils   = require('./utils');

/*
  Ractive plugins
*/
require('ractive-events-tap');

var container = document.querySelector('[data-ui-container]'),
    template  = document.querySelector('[data-ui-template]').innerText,
    defaults  = {
      radio: {
        power : { isOn: false },
        audio : { volume: 0   }
      },
      ui: { panels: {} },
      services: []
    },
    state = {},
    ui;

xhr.get('/radio/state.json')
   .then(initWithData)
   .then(null, failure);

function initWithData(data) {
  console.log('initWithData');
  var data = JSON.parse(data);

  // Services available
  state.services = data.services || defaults.services;

  // State of the radio
  state.radio = {
    power: data.power || defaults.radio.power,
    audio: data.audio || defaults.radio.audio
  };

  // State of this UI
  state.ui = defaults.ui;

  // Helper functions for templates
  state.first = function (array) {
    console.log('first');
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

  /*
    UI -> UI
  */
  ui.on('stations-button', createPanelToggleHandler('services'));
  ui.on('volume-button', createPanelToggleHandler('volume'));

  console.log('initialised with data', state);
}

function createPanelToggleHandler(panelId) {
  var keypath = 'ui.panels.' + panelId + '.isOpen';
  return function (evt) {
    var isOpen = this.get(keypath);
        this.set(keypath, !isOpen);
  }
}

function uiVolumeChange(evt) {
  console.log('vol', evt.context);
  var value = evt.context.volume;
  console.log('ui: volume changed', value);
  xhr.post('/radio/volume/value/' + value ).then(success, failure);
}

function uiServiceChange(evt) {
  evt.original.preventDefault();

  var id = evt.context.id

  console.log('ui: service selected', id);
  xhr.post('/radio/service/' + id ).then(success, failure);
}

function uiPower(evt) {
  evt.original.preventDefault();
  var isOn = evt.context.isOn,
      method = isOn ? 'DELETE' : 'PUT';

  xhr(method, '/radio/power');
}

function uiAvoid(evt) {
  evt.original.preventDefault();
  var method = evt.context.isAvoiding
                ? 'DELETE'
                : 'POST';
  xhr(method, '/avoider');
}

/*
  State -> UI
*/
var eventSource = new EventSource('/events');

eventSource.addEventListener('message', function (evt) {
  var content = JSON.parse(evt.data);

  switch(content.topic) {
    case 'audio.volume':
      ui.set('radio.audio', content.data);
      break;
    case 'service.changed':
      ui.set(keypathForServiceId(content.id, state.services), content.data);
      ui.set('radio.current', content.data);
      break;
    case 'power':
      ui.set('radio.power', content.data);
      break;
    case 'avoider':
      ui.set('avoider', content.data);
      break;
    case 'nowPlaying':
      ui.set(keypathForServiceId(content.service, state.services) + '.nowPlaying', content.data);
    case 'nowAndNext':
      ui.set(keypathForServiceId(content.service, state.services) + '.nowAndNext', content.data);
    default:
      // console.log('Unhandled topic', content.topic, content);
  }
});

eventSource.addEventListener('error', function (evt) {
  console.warn(evt);
});

/*
  Generic promise success or failure options
*/
function success(content) {
  console.log('success', content);
}

function failure(err) {
  console.warn('failure', err);
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
