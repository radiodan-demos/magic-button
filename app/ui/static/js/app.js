console.log('Core app started');

var Ractive = require('ractive'),
    xhr     = require('./xhr'),
    Services= require('./services'),
    utils   = require('./utils');

/*
  Ractive plugins
*/
require('ractive-events-tap');

var container = document.querySelector('[data-ui-container]'),
    template  = document.querySelector('[data-ui-template]').innerText,
    defaults  = {
      power   : { isOn: false },
      services: [],
      audio   : {}
    },
    // Reference to services to be
    // kept up to date with new data
    services,
    state = defaults,
    ui;

xhr.get('/radio/state.json')
   .then(initWithData, failure);

function initWithData(data) {
  console.log('initWithData');

  state = JSON.parse(data);
  services = Services.create(state.services)
  state.services = services.list();

  console.log('state', state);
  console.log('services', services.list());

  // Helper functions for templates
  state.first = function (array) {
    console.log('first');
    return array[0];
  };

  window.ui = ui = new Ractive({
    el        : container,
    template  : template,
    data      : state
  });

  /*
    Logging
  */
  ui.on('change', function (keypath, value) {
    console.log('set', keypath, value);
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
}

function createPanelToggleHandler(panelId) {
  var keypath = 'panels.' + panelId + '.isOpen';
  return function (evt) {
    var isOpen = this.get(keypath);
        this.set(keypath, !isOpen);
  }
}

function uiVolumeChange(evt) {
  var value = evt.context.volume;
  console.log('ui: volume changed', value);
  xhr.post('/radio/volume/value/' + value ).then(success, failure);
}

function uiServiceChange(evt) {
  evt.original.preventDefault();

  var id = evt.context.id,
      newService = services.findById(id);

  console.log('ui: service selected', id, newService);
  this.set('current', newService);
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
      ui.set(content.topic, content.data.volume);
      break;
    case 'service.changed':
      services.update(content.data);
      ui.set('current', content.data);
      break;
    case 'power':
      ui.set('power', content.data);
      break;
    case 'avoider':
      ui.set('avoider', content.data);
      break;
    default:
      // console.log('Unhandled topic', content.topic, content);
  }
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
