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
require('./lib/ractive-events-tap');

/*
  Ractive-Backbone adaptor
*/
require('ractive-backbone/Ractive-Backbone');

var container = document.querySelector('[data-ui-container]'),
    template  = document.querySelector('[data-ui-template]#mainTmpl').innerText,
    states = {},   
    radioModel,
    avoider,
    announcer,
    ui;

// Initialise application
init();

function init() {
  var events = new EventSource('/events');

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
  
  window.ui = ui = new Ractive({
    el        : container,
    template  : template,
    adapt     : [ 'Backbone' ],
    debug     : true,
    data      : {
      radio: radioModel,
      services: radioModel.get('services'),
      mainView: 'controls'
    },
    complete  : function () {
      console.log('splashStartTime - now = %oms', (Date.now() - splashStartTime));
    },
    components: {
      // Main Views
      Standby : require('./components/simple')('#standbyTmpl'),
      Controls: require('./components/controls'),
      RadioSettings: require('./components/simple')('#settingsTmpl'),
      // Components
      Masthead: require('./components/simple')('#mastheadTmpl')
    }
  });

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
  // Seems to work without forced updates
  // radioModel.on('change:services', function () {
  //   ui.update();
  //   console.log('Force UI update (change:services)');
  // });
  // And also when the radio settings change
  radioModel.on('change:settings', function () {
    ui.update();
    console.log('Force UI update (change:settings)');
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

  ui.on('settings', function (evt) {
    evt.original.preventDefault();
    var view = this.get('mainView'),
        newView = view === 'controls' ? 'settings' : 'controls';

    this.set('mainView', newView);
  });

  ui.on('preferred-service', function (serviceId) {
    radioModel.togglePreferredServiceById(serviceId);
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

  var magicButtonCarousel = jQuery('#magic ul').owlCarousel();

  console.log('initialised');
}
