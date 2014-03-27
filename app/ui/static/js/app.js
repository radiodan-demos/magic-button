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
      services: [],
      audio   : {}
    },
    ui;

window.ui = ui = new Ractive({
  el        : container,
  template  : template,
  data      : data || defaults
});

/*
  Logging
*/
ui.on('set', function (keypath, value) {
  console.log('set', keypath, value);
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
  UI -> State
*/
ui.on('volume', utils.debounce(uiVolumeChange, 250));
ui.on('service', uiServiceChange);
ui.on('power', uiPower);

function uiVolumeChange(evt) {
  var value = evt.context.volume;
  console.log('ui: volume changed', value);
  xhr.post('/radio/volume/value/' + value ).then(success, failure);
}

function uiServiceChange(evt) {
  var id = evt.context.id;
  evt.original.preventDefault();
  console.log('ui: service selected', evt.context);
  this.set('current', id);
  xhr.post('/radio/service/' + id ).then(success, failure);
}

function uiPower(evt) {
  evt.original.preventDefault();
  var isOn = evt.context.isOn,
      method = isOn ? 'DELETE' : 'PUT';

  xhr(method, '/radio/power');
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
      ui.set('current', content.data.id);
      break;
    case 'power':
      ui.set('power', content.data);
      break;
    default:
      console.log('Unhandled topic', content.topic, content);
  }
});
