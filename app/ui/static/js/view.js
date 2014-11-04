var Logger = require('js-logger'),
    Ractive = require('ractive'),
    Promise = require('es6-promise').Promise,
    throttle = require('./utils').throttle,
    jQuery  = require('jquery');;

/*
  Ractive plugins
*/
require('./lib/ractive-events-tap');

window.jQuery = jQuery;

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
        debug     : true,
        twoway    : false,
        data      : {
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
            'avoid': function () {
              StateActionCreators.toggleAvoider();
            },
            'avoider-settings-requested': function () {
              StateActionCreators.requestAvoiderSettings();
            },
            'avoider-settings-changed': function (newValue) {
              StateActionCreators.avoiderSettings(newValue);
            },
            'announce': function () {
              StateActionCreators.toggleAnnouncer();
            },
            'settings-panel-requested': function () {
              Logger.debug('settings-panel-requested');
              StateActionCreators.requestRadioSettings();
              this.set('mainView', (this.get('mainView') === 'settings') ? 'controls' : 'settings');
            },
            'preferred-service-changed': function (serviceId) {
              Logger.debug('preferred-service-changed', serviceId);
              StateActionCreators.toggleRadioSettingPreferredServer(serviceId);
            }
          });

          Logger.debug('splashStartTime - now = %oms', (Date.now() - splashStartTime));
          resolve();
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
    });
  },
  set: function (keypath, payload) {
    Logger.debug('VIEW ', keypath, payload);
    ractive.set(keypath, payload);
  }
}