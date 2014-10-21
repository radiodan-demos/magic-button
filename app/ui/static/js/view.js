var Ractive = require('ractive'),
    Promise = require('es6-promise').Promise,
    throttle = require('./utils').throttle;

/*
  Ractive plugins
*/
require('./lib/ractive-events-tap');

var StateActionCreators = require('./actions/state-action-creators');

var ractive;

module.exports = {
  init: function () {
    var container = document.querySelector('[data-ui-container]'),
        template  = document.querySelector('[data-ui-template]#mainTmpl').innerText;

    return new Promise(function (resolve, reject) {
      ractive = new Ractive({
        el        : container,
        template  : template,
        // adapt     : [ 'Backbone' ],
        debug     : true,
        twoway    : false,
        data      : {
          // radio: radioModel,
          // services: radioModel.get('services'),
          mainView: 'controls'
        },
        complete  : function () {
          this.on({
            'power': function (evt) {
              evt.original.preventDefault();
              StateActionCreators.togglePower();
            },
            'volume-slider-changed': throttle(function (evt) {
              var value = evt.node.value;
              StateActionCreators.changeVolume(value);
            }, 1000),
            'tune-service': function (serviceId) {
              StateActionCreators.changeService(serviceId);
            },
          });

          console.log('splashStartTime - now = %oms', (Date.now() - splashStartTime));
          resolve();
        },
        components: {
          // Main Views
          Standby : require('./components/simple')('#standbyTmpl'),
          Controls: require('./components/controls'),
          // RadioSettings: require('./components/simple')('#settingsTmpl'),
          // Components
          Masthead: require('./components/simple')('#mastheadTmpl')
        }
      });
    });
  },
  set: function (keypath, payload) {
    console.log('VIEW ', keypath, payload);
    ractive.set(keypath, payload);
  }
}