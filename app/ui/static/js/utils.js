/* jshint white: false, latedef: nofunc, browser: true, devel: true */
'use strict';

module.exports = {
  extractActiveServices: function extractActiveServices(services) {
    return services.map(function (service) { 
      return service._isActive ? service.id : undefined;
    }).filter(function(item){return item}); ;
  },
  /*
    Object comparison helpers
  */
  hasDifferentProperties: function hasDifferentProperties(first, second) {
    return Object.keys(first).some(
      function (key) {
        var firstProp  = first[key],
            secondProp = second[key];
        return firstProp !== secondProp;
      }
    );
  },
  /*
    Ractive-specific helpers
  */
  ractiveSetIfObjectPropertiesChanged: function ractiveSetIfObjectPropertiesChanged(ractive, keypath, obj) {
    var current = ractive.get(keypath);

    if ( this.hasDifferentProperties(obj, current) ) {
      ractive.set(keypath, obj);
    }
  },
  /*
    Creates a handler to bind a context[key] changes
    to an action function.
    Prevents default on the original event.
  */
  uiToAction: function uiToAction(key, action) {
    return function (evt) {
      evt.original.preventDefault();
      var value = evt.context[key];
      action(value);
    };
  },
  /*
    Generic promise success or failure options
  */
  success: function success(msg) {
    return function (content) {
      console.log(msg, 'success', content);
    };
  },
  failure: function failure(msg) {
    return function (err) {
      console.warn(msg, 'failure', err.stack);
    };
  },
  /*
    Returns a function that will toggle the state of 
    `ui.panels.<panelId>.isOpen` each time it's executed
  */
  createPanelToggleHandler: function createPanelToggleHandler(panelId) {
    var keypath = 'ui.panels.' + panelId + '.isOpen';
    return function (/* evt */) {
      var isOpen = this.get(keypath);
      this.set(keypath, !isOpen);
    };
  },
  debounce: function debounce(fn, delay) {
    var timer = null;
    return function () {
      var context = this, args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(context, args);
      }, delay);
    };
  },
  throttle: function throttle(fn, threshhold, scope) {
    threshhold = threshhold || (threshhold = 250);
    var last,
        deferTimer;
    return function () {
      var context = scope || this;

      var now = +new Date(),
          args = arguments;
      if (last && now < last + threshhold) {
        // hold on to it
        clearTimeout(deferTimer);
        deferTimer = setTimeout(function () {
          last = now;
          fn.apply(context, args);
        }, threshhold);
      } else {
        last = now;
        fn.apply(context, args);
      }
    };
  }
};
