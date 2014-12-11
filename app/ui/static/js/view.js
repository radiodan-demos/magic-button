var Logger = require('js-logger'),
    Ractive = require('ractive'),
    Promise = require('es6-promise').Promise,
    throttle = require('./utils').throttle,
    jQuery  = require('jquery');

/*
  Ractive plugins
*/
require('ractive-touch');
require('./view/helpers');

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
        modifyArrays: false,
        data      : {
          mainView: 'controls'
        },
        oncomplete  : function () {
          this.on({
            'Masthead.power': function (evt) {
              evt.original.preventDefault();
              StateActionCreators.togglePower();
            },
            'Masthead.shutdown': function (evt) {
              alert('Shutdown');
            },
            'Controls.volume-slider-changed': throttle(function (evt) {
              var value = evt.node.value;
              StateActionCreators.changeVolume(value);
            }, 1000),
            'Controls.tune-service': function (serviceId) {
              StateActionCreators.changeService(serviceId);
            },
            'Controls.avoid': function () {
              StateActionCreators.toggleAvoider();
            },
            'Controls.avoider-settings-requested': function () {
              StateActionCreators.requestAvoiderSettings();
            },
            'Controls.avoider-settings-changed': function (newValue) {
              StateActionCreators.avoiderSettings(newValue);
            },
            'Controls.announce': function () {
              StateActionCreators.toggleAnnouncer();
            },
            'Masthead.settings-panel-requested': function () {
              Logger.debug('settings-panel-requested');
              StateActionCreators.requestRadioSettings();
              this.set('mainView', (this.get('mainView') === 'settings') ? 'controls' : 'settings');
            },
            'RadioSettings.preferred-service-changed': function (serviceId) {
              Logger.debug('preferred-service-changed', serviceId);
              StateActionCreators.toggleRadioSettingPreferredServer(serviceId);
            },
            'error-actioned': function () {
              Logger.debug('error-actioned');
              StateActionCreators.clearError();
            }
          });

          Logger.debug('splashStartTime - now = %oms', (Date.now() - splashStartTime));
          resolve();
        },
        components: {
          // Main Views
          Standby : require('./components/simple')('#standbyTmpl'),
          Controls: require('./components/controls'),
          RadioSettings: require('./components/simple')('#radioSettingsTmpl'),
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