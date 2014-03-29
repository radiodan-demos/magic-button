(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

function ractiveRendered() {
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

},{"./services":2,"./utils":3,"./xhr":4,"ractive":18,"ractive-events-tap":17}],2:[function(require,module,exports){
module.exports = { create: create };


function create(array) {
  var instance = {},
      services = array;

  // Find a single service by ID
  instance.findById = findService;

  // Return all services
  instance.list = function () { return services };

  // Update data about a service
  instance.update = updateService;

  function updateService(data) {
    var index = findServiceIndexById(data.id);
    services.splice(index, 1, data);
  }

  function findServiceIndexById(id) {
    var index = null;
    services.forEach(function (item, idx) {
      if (item.id === id) {
        index = idx;
      }
    });
    return index;
  }

  function findService(id) {
    return findFirst(services, 'id', id);
  }

  function findFirst(array, element, value) {
    var results = array.filter(function (item) {
      return item[element] === value;
    });
    if (results) {
      return results[0];
    }
  }

  return instance;
}

},{}],3:[function(require,module,exports){
module.exports = {
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
    threshhold || (threshhold = 250);
    var last,
        deferTimer;
    return function () {
      var context = scope || this;

      var now = +new Date,
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

},{}],4:[function(require,module,exports){
var Promise = Promise || require('es6-promise').Promise;

module.exports = xhr;

['get', 'delete', 'post', 'put'].forEach(function (method) {
  module.exports[method] = function() {
    var args = Array.prototype.slice.call(arguments),
        newArgs = [method].concat(args);

    return xhr.apply(null, newArgs);
  }
})

function xhr(method, url) {
  method = method ? method.toUpperCase() : 'GET';
  // Return a new promise.
  return new Promise(function(resolve, reject) {
    // Do the usual XHR stuff
    var req = new XMLHttpRequest();
    req.open(method, url);

    req.onload = function() {
      // This is called even on 404 etc
      // so check the status
      if (req.status == 200) {
        // Resolve the promise with the response text
        resolve(req.response);
      }
      else {
        // Otherwise reject with the status text
        // which will hopefully be a meaningful error
        reject(Error(req.statusText));
      }
    };

    // Handle network errors
    req.onerror = function() {
      reject(Error("Network Error"));
    };

    // Make the request
    req.send();
  });
}

},{"es6-promise":6}],5:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],6:[function(require,module,exports){
"use strict";
var Promise = require("./promise/promise").Promise;
var polyfill = require("./promise/polyfill").polyfill;
exports.Promise = Promise;
exports.polyfill = polyfill;
},{"./promise/polyfill":11,"./promise/promise":12}],7:[function(require,module,exports){
"use strict";
/* global toString */

var isArray = require("./utils").isArray;
var isFunction = require("./utils").isFunction;

/**
  Returns a promise that is fulfilled when all the given promises have been
  fulfilled, or rejected if any of them become rejected. The return promise
  is fulfilled with an array that gives all the values in the order they were
  passed in the `promises` array argument.

  Example:

  ```javascript
  var promise1 = RSVP.resolve(1);
  var promise2 = RSVP.resolve(2);
  var promise3 = RSVP.resolve(3);
  var promises = [ promise1, promise2, promise3 ];

  RSVP.all(promises).then(function(array){
    // The array here would be [ 1, 2, 3 ];
  });
  ```

  If any of the `promises` given to `RSVP.all` are rejected, the first promise
  that is rejected will be given as an argument to the returned promises's
  rejection handler. For example:

  Example:

  ```javascript
  var promise1 = RSVP.resolve(1);
  var promise2 = RSVP.reject(new Error("2"));
  var promise3 = RSVP.reject(new Error("3"));
  var promises = [ promise1, promise2, promise3 ];

  RSVP.all(promises).then(function(array){
    // Code here never runs because there are rejected promises!
  }, function(error) {
    // error.message === "2"
  });
  ```

  @method all
  @for RSVP
  @param {Array} promises
  @param {String} label
  @return {Promise} promise that is fulfilled when all `promises` have been
  fulfilled, or rejected if any of them become rejected.
*/
function all(promises) {
  /*jshint validthis:true */
  var Promise = this;

  if (!isArray(promises)) {
    throw new TypeError('You must pass an array to all.');
  }

  return new Promise(function(resolve, reject) {
    var results = [], remaining = promises.length,
    promise;

    if (remaining === 0) {
      resolve([]);
    }

    function resolver(index) {
      return function(value) {
        resolveAll(index, value);
      };
    }

    function resolveAll(index, value) {
      results[index] = value;
      if (--remaining === 0) {
        resolve(results);
      }
    }

    for (var i = 0; i < promises.length; i++) {
      promise = promises[i];

      if (promise && isFunction(promise.then)) {
        promise.then(resolver(i), reject);
      } else {
        resolveAll(i, promise);
      }
    }
  });
}

exports.all = all;
},{"./utils":16}],8:[function(require,module,exports){
(function (process,global){
"use strict";
var browserGlobal = (typeof window !== 'undefined') ? window : {};
var BrowserMutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver;
var local = (typeof global !== 'undefined') ? global : this;

// node
function useNextTick() {
  return function() {
    process.nextTick(flush);
  };
}

function useMutationObserver() {
  var iterations = 0;
  var observer = new BrowserMutationObserver(flush);
  var node = document.createTextNode('');
  observer.observe(node, { characterData: true });

  return function() {
    node.data = (iterations = ++iterations % 2);
  };
}

function useSetTimeout() {
  return function() {
    local.setTimeout(flush, 1);
  };
}

var queue = [];
function flush() {
  for (var i = 0; i < queue.length; i++) {
    var tuple = queue[i];
    var callback = tuple[0], arg = tuple[1];
    callback(arg);
  }
  queue = [];
}

var scheduleFlush;

// Decide what async method to use to triggering processing of queued callbacks:
if (typeof process !== 'undefined' && {}.toString.call(process) === '[object process]') {
  scheduleFlush = useNextTick();
} else if (BrowserMutationObserver) {
  scheduleFlush = useMutationObserver();
} else {
  scheduleFlush = useSetTimeout();
}

function asap(callback, arg) {
  var length = queue.push([callback, arg]);
  if (length === 1) {
    // If length is 1, that means that we need to schedule an async flush.
    // If additional callbacks are queued before the queue is flushed, they
    // will be processed by this flush that we are scheduling.
    scheduleFlush();
  }
}

exports.asap = asap;
}).call(this,require("/Users/andrew/Projects/oss/radiodan/magic-button/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"/Users/andrew/Projects/oss/radiodan/magic-button/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":5}],9:[function(require,module,exports){
"use strict";
/**
  `RSVP.Promise.cast` returns the same promise if that promise shares a constructor
  with the promise being casted.

  Example:

  ```javascript
  var promise = RSVP.resolve(1);
  var casted = RSVP.Promise.cast(promise);

  console.log(promise === casted); // true
  ```

  In the case of a promise whose constructor does not match, it is assimilated.
  The resulting promise will fulfill or reject based on the outcome of the
  promise being casted.

  In the case of a non-promise, a promise which will fulfill with that value is
  returned.

  Example:

  ```javascript
  var value = 1; // could be a number, boolean, string, undefined...
  var casted = RSVP.Promise.cast(value);

  console.log(value === casted); // false
  console.log(casted instanceof RSVP.Promise) // true

  casted.then(function(val) {
    val === value // => true
  });
  ```

  `RSVP.Promise.cast` is similar to `RSVP.resolve`, but `RSVP.Promise.cast` differs in the
  following ways:
  * `RSVP.Promise.cast` serves as a memory-efficient way of getting a promise, when you
  have something that could either be a promise or a value. RSVP.resolve
  will have the same effect but will create a new promise wrapper if the
  argument is a promise.
  * `RSVP.Promise.cast` is a way of casting incoming thenables or promise subclasses to
  promises of the exact class specified, so that the resulting object's `then` is
  ensured to have the behavior of the constructor you are calling cast on (i.e., RSVP.Promise).

  @method cast
  @for RSVP
  @param {Object} object to be casted
  @return {Promise} promise that is fulfilled when all properties of `promises`
  have been fulfilled, or rejected if any of them become rejected.
*/


function cast(object) {
  /*jshint validthis:true */
  if (object && typeof object === 'object' && object.constructor === this) {
    return object;
  }

  var Promise = this;

  return new Promise(function(resolve) {
    resolve(object);
  });
}

exports.cast = cast;
},{}],10:[function(require,module,exports){
"use strict";
var config = {
  instrument: false
};

function configure(name, value) {
  if (arguments.length === 2) {
    config[name] = value;
  } else {
    return config[name];
  }
}

exports.config = config;
exports.configure = configure;
},{}],11:[function(require,module,exports){
"use strict";
var RSVPPromise = require("./promise").Promise;
var isFunction = require("./utils").isFunction;

function polyfill() {
  var es6PromiseSupport = 
    "Promise" in window &&
    // Some of these methods are missing from
    // Firefox/Chrome experimental implementations
    "cast" in window.Promise &&
    "resolve" in window.Promise &&
    "reject" in window.Promise &&
    "all" in window.Promise &&
    "race" in window.Promise &&
    // Older version of the spec had a resolver object
    // as the arg rather than a function
    (function() {
      var resolve;
      new window.Promise(function(r) { resolve = r; });
      return isFunction(resolve);
    }());

  if (!es6PromiseSupport) {
    window.Promise = RSVPPromise;
  }
}

exports.polyfill = polyfill;
},{"./promise":12,"./utils":16}],12:[function(require,module,exports){
"use strict";
var config = require("./config").config;
var configure = require("./config").configure;
var objectOrFunction = require("./utils").objectOrFunction;
var isFunction = require("./utils").isFunction;
var now = require("./utils").now;
var cast = require("./cast").cast;
var all = require("./all").all;
var race = require("./race").race;
var staticResolve = require("./resolve").resolve;
var staticReject = require("./reject").reject;
var asap = require("./asap").asap;

var counter = 0;

config.async = asap; // default async is asap;

function Promise(resolver) {
  if (!isFunction(resolver)) {
    throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
  }

  if (!(this instanceof Promise)) {
    throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
  }

  this._subscribers = [];

  invokeResolver(resolver, this);
}

function invokeResolver(resolver, promise) {
  function resolvePromise(value) {
    resolve(promise, value);
  }

  function rejectPromise(reason) {
    reject(promise, reason);
  }

  try {
    resolver(resolvePromise, rejectPromise);
  } catch(e) {
    rejectPromise(e);
  }
}

function invokeCallback(settled, promise, callback, detail) {
  var hasCallback = isFunction(callback),
      value, error, succeeded, failed;

  if (hasCallback) {
    try {
      value = callback(detail);
      succeeded = true;
    } catch(e) {
      failed = true;
      error = e;
    }
  } else {
    value = detail;
    succeeded = true;
  }

  if (handleThenable(promise, value)) {
    return;
  } else if (hasCallback && succeeded) {
    resolve(promise, value);
  } else if (failed) {
    reject(promise, error);
  } else if (settled === FULFILLED) {
    resolve(promise, value);
  } else if (settled === REJECTED) {
    reject(promise, value);
  }
}

var PENDING   = void 0;
var SEALED    = 0;
var FULFILLED = 1;
var REJECTED  = 2;

function subscribe(parent, child, onFulfillment, onRejection) {
  var subscribers = parent._subscribers;
  var length = subscribers.length;

  subscribers[length] = child;
  subscribers[length + FULFILLED] = onFulfillment;
  subscribers[length + REJECTED]  = onRejection;
}

function publish(promise, settled) {
  var child, callback, subscribers = promise._subscribers, detail = promise._detail;

  for (var i = 0; i < subscribers.length; i += 3) {
    child = subscribers[i];
    callback = subscribers[i + settled];

    invokeCallback(settled, child, callback, detail);
  }

  promise._subscribers = null;
}

Promise.prototype = {
  constructor: Promise,

  _state: undefined,
  _detail: undefined,
  _subscribers: undefined,

  then: function(onFulfillment, onRejection) {
    var promise = this;

    var thenPromise = new this.constructor(function() {});

    if (this._state) {
      var callbacks = arguments;
      config.async(function invokePromiseCallback() {
        invokeCallback(promise._state, thenPromise, callbacks[promise._state - 1], promise._detail);
      });
    } else {
      subscribe(this, thenPromise, onFulfillment, onRejection);
    }

    return thenPromise;
  },

  'catch': function(onRejection) {
    return this.then(null, onRejection);
  }
};

Promise.all = all;
Promise.cast = cast;
Promise.race = race;
Promise.resolve = staticResolve;
Promise.reject = staticReject;

function handleThenable(promise, value) {
  var then = null,
  resolved;

  try {
    if (promise === value) {
      throw new TypeError("A promises callback cannot return that same promise.");
    }

    if (objectOrFunction(value)) {
      then = value.then;

      if (isFunction(then)) {
        then.call(value, function(val) {
          if (resolved) { return true; }
          resolved = true;

          if (value !== val) {
            resolve(promise, val);
          } else {
            fulfill(promise, val);
          }
        }, function(val) {
          if (resolved) { return true; }
          resolved = true;

          reject(promise, val);
        });

        return true;
      }
    }
  } catch (error) {
    if (resolved) { return true; }
    reject(promise, error);
    return true;
  }

  return false;
}

function resolve(promise, value) {
  if (promise === value) {
    fulfill(promise, value);
  } else if (!handleThenable(promise, value)) {
    fulfill(promise, value);
  }
}

function fulfill(promise, value) {
  if (promise._state !== PENDING) { return; }
  promise._state = SEALED;
  promise._detail = value;

  config.async(publishFulfillment, promise);
}

function reject(promise, reason) {
  if (promise._state !== PENDING) { return; }
  promise._state = SEALED;
  promise._detail = reason;

  config.async(publishRejection, promise);
}

function publishFulfillment(promise) {
  publish(promise, promise._state = FULFILLED);
}

function publishRejection(promise) {
  publish(promise, promise._state = REJECTED);
}

exports.Promise = Promise;
},{"./all":7,"./asap":8,"./cast":9,"./config":10,"./race":13,"./reject":14,"./resolve":15,"./utils":16}],13:[function(require,module,exports){
"use strict";
/* global toString */
var isArray = require("./utils").isArray;

/**
  `RSVP.race` allows you to watch a series of promises and act as soon as the
  first promise given to the `promises` argument fulfills or rejects.

  Example:

  ```javascript
  var promise1 = new RSVP.Promise(function(resolve, reject){
    setTimeout(function(){
      resolve("promise 1");
    }, 200);
  });

  var promise2 = new RSVP.Promise(function(resolve, reject){
    setTimeout(function(){
      resolve("promise 2");
    }, 100);
  });

  RSVP.race([promise1, promise2]).then(function(result){
    // result === "promise 2" because it was resolved before promise1
    // was resolved.
  });
  ```

  `RSVP.race` is deterministic in that only the state of the first completed
  promise matters. For example, even if other promises given to the `promises`
  array argument are resolved, but the first completed promise has become
  rejected before the other promises became fulfilled, the returned promise
  will become rejected:

  ```javascript
  var promise1 = new RSVP.Promise(function(resolve, reject){
    setTimeout(function(){
      resolve("promise 1");
    }, 200);
  });

  var promise2 = new RSVP.Promise(function(resolve, reject){
    setTimeout(function(){
      reject(new Error("promise 2"));
    }, 100);
  });

  RSVP.race([promise1, promise2]).then(function(result){
    // Code here never runs because there are rejected promises!
  }, function(reason){
    // reason.message === "promise2" because promise 2 became rejected before
    // promise 1 became fulfilled
  });
  ```

  @method race
  @for RSVP
  @param {Array} promises array of promises to observe
  @param {String} label optional string for describing the promise returned.
  Useful for tooling.
  @return {Promise} a promise that becomes fulfilled with the value the first
  completed promises is resolved with if the first completed promise was
  fulfilled, or rejected with the reason that the first completed promise
  was rejected with.
*/
function race(promises) {
  /*jshint validthis:true */
  var Promise = this;

  if (!isArray(promises)) {
    throw new TypeError('You must pass an array to race.');
  }
  return new Promise(function(resolve, reject) {
    var results = [], promise;

    for (var i = 0; i < promises.length; i++) {
      promise = promises[i];

      if (promise && typeof promise.then === 'function') {
        promise.then(resolve, reject);
      } else {
        resolve(promise);
      }
    }
  });
}

exports.race = race;
},{"./utils":16}],14:[function(require,module,exports){
"use strict";
/**
  `RSVP.reject` returns a promise that will become rejected with the passed
  `reason`. `RSVP.reject` is essentially shorthand for the following:

  ```javascript
  var promise = new RSVP.Promise(function(resolve, reject){
    reject(new Error('WHOOPS'));
  });

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  var promise = RSVP.reject(new Error('WHOOPS'));

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  @method reject
  @for RSVP
  @param {Any} reason value that the returned promise will be rejected with.
  @param {String} label optional string for identifying the returned promise.
  Useful for tooling.
  @return {Promise} a promise that will become rejected with the given
  `reason`.
*/
function reject(reason) {
  /*jshint validthis:true */
  var Promise = this;

  return new Promise(function (resolve, reject) {
    reject(reason);
  });
}

exports.reject = reject;
},{}],15:[function(require,module,exports){
"use strict";
/**
  `RSVP.resolve` returns a promise that will become fulfilled with the passed
  `value`. `RSVP.resolve` is essentially shorthand for the following:

  ```javascript
  var promise = new RSVP.Promise(function(resolve, reject){
    resolve(1);
  });

  promise.then(function(value){
    // value === 1
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  var promise = RSVP.resolve(1);

  promise.then(function(value){
    // value === 1
  });
  ```

  @method resolve
  @for RSVP
  @param {Any} value value that the returned promise will be resolved with
  @param {String} label optional string for identifying the returned promise.
  Useful for tooling.
  @return {Promise} a promise that will become fulfilled with the given
  `value`
*/
function resolve(value) {
  /*jshint validthis:true */
  var Promise = this;
  return new Promise(function(resolve, reject) {
    resolve(value);
  });
}

exports.resolve = resolve;
},{}],16:[function(require,module,exports){
"use strict";
function objectOrFunction(x) {
  return isFunction(x) || (typeof x === "object" && x !== null);
}

function isFunction(x) {
  return typeof x === "function";
}

function isArray(x) {
  return Object.prototype.toString.call(x) === "[object Array]";
}

// Date.now is not available in browsers < IE9
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/now#Compatibility
var now = Date.now || function() { return new Date().getTime(); };


exports.objectOrFunction = objectOrFunction;
exports.isFunction = isFunction;
exports.isArray = isArray;
exports.now = now;
},{}],17:[function(require,module,exports){
/*

	ractive-events-tap
	==================

	Version .

	On mobile devices, using `on-click` isn't good enough. Tapping the
	touchscreen will fire a simulated click event, but only after a 300
	millisecond delay, which makes your app feel sluggish. It also
	causes the tapped area to highlight, which in most cases looks a
	bit messy.

	Instead, use `on-tap`. When you tap an area, the simulated click
	event will be prevented, and the user's action is responded to
	instantly. The `on-tap` event also differs from `on-click` in that
	the click event will (frankly rather bizarrely) fire even if you
	hold the mouse down over a single element for several seconds and
	waggle it about.

	Pointer events are also supported, as is pressing the spacebar when
	the relevant element is focused (which triggers a click event, and
	is good for accessibility).

	==========================

	Troubleshooting: If you're using a module system in your app (AMD or
	something more nodey) then you may need to change the paths below,
	where it says `require( 'ractive' )` or `define([ 'ractive' ]...)`.

	==========================

	Usage: Include this file on your page below Ractive, e.g:

	    <script src='lib/ractive.js'></script>
	    <script src='lib/ractive-events-tap.js'></script>

	Or, if you're using a module loader, require this module:

	    // requiring the plugin will 'activate' it - no need to use
	    // the return value
	    require( 'ractive-events-tap' );

	Add a tap event in the normal fashion:

	    <div on-tap='foo'>tap me!</div>

	Then add a handler:

	    ractive.on( 'foo', function ( event ) {
	      alert( 'tapped' );
	    });

*/

(function ( global, factory ) {

	'use strict';

	// Common JS (i.e. browserify) environment
	if ( typeof module !== 'undefined' && module.exports && typeof require === 'function' ) {
		factory( require( 'ractive' ) );
	}

	// AMD?
	else if ( typeof define === 'function' && define.amd ) {
		define([ 'ractive' ], factory );
	}

	// browser global
	else if ( global.Ractive ) {
		factory( global.Ractive );
	}

	else {
		throw new Error( 'Could not find Ractive! It must be loaded before the ractive-events-tap plugin' );
	}

}( typeof window !== 'undefined' ? window : this, function ( Ractive ) {

	'use strict';

	var tap = function ( node, fire ) {
		var mousedown, touchstart, focusHandler, distanceThreshold, timeThreshold;

		distanceThreshold = 5; // maximum pixels pointer can move before cancel
		timeThreshold = 400;   // maximum milliseconds between down and up before cancel

		mousedown = function ( event ) {
			var currentTarget, x, y, pointerId, up, move, cancel;

			if ( event.which !== undefined && event.which !== 1 ) {
				return;
			}

			x = event.clientX;
			y = event.clientY;
			currentTarget = this;
			// This will be null for mouse events.
			pointerId = event.pointerId;

			up = function ( event ) {
				if ( event.pointerId != pointerId ) {
					return;
				}

				fire({
					node: currentTarget,
					original: event
				});

				cancel();
			};

			move = function ( event ) {
				if ( event.pointerId != pointerId ) {
					return;
				}

				if ( ( Math.abs( event.clientX - x ) >= distanceThreshold ) || ( Math.abs( event.clientY - y ) >= distanceThreshold ) ) {
					cancel();
				}
			};

			cancel = function () {
				node.removeEventListener( 'MSPointerUp', up, false );
				document.removeEventListener( 'MSPointerMove', move, false );
				document.removeEventListener( 'MSPointerCancel', cancel, false );
				node.removeEventListener( 'pointerup', up, false );
				document.removeEventListener( 'pointermove', move, false );
				document.removeEventListener( 'pointercancel', cancel, false );
				node.removeEventListener( 'click', up, false );
				document.removeEventListener( 'mousemove', move, false );
			};

			if ( window.navigator.pointerEnabled ) {
				node.addEventListener( 'pointerup', up, false );
				document.addEventListener( 'pointermove', move, false );
				document.addEventListener( 'pointercancel', cancel, false );
			} else if ( window.navigator.msPointerEnabled ) {
				node.addEventListener( 'MSPointerUp', up, false );
				document.addEventListener( 'MSPointerMove', move, false );
				document.addEventListener( 'MSPointerCancel', cancel, false );
			} else {
				node.addEventListener( 'click', up, false );
				document.addEventListener( 'mousemove', move, false );
			}

			setTimeout( cancel, timeThreshold );
		};

		if ( window.navigator.pointerEnabled ) {
			node.addEventListener( 'pointerdown', mousedown, false );
		} else if ( window.navigator.msPointerEnabled ) {
			node.addEventListener( 'MSPointerDown', mousedown, false );
		} else {
			node.addEventListener( 'mousedown', mousedown, false );
		}


		touchstart = function ( event ) {
			var currentTarget, x, y, touch, finger, move, up, cancel;

			if ( event.touches.length !== 1 ) {
				return;
			}

			touch = event.touches[0];

			x = touch.clientX;
			y = touch.clientY;
			currentTarget = this;

			finger = touch.identifier;

			up = function ( event ) {
				var touch;

				touch = event.changedTouches[0];
				if ( touch.identifier !== finger ) {
					cancel();
				}

				event.preventDefault();  // prevent compatibility mouse event
				fire({
					node: currentTarget,
					original: event
				});

				cancel();
			};

			move = function ( event ) {
				var touch;

				if ( event.touches.length !== 1 || event.touches[0].identifier !== finger ) {
					cancel();
				}

				touch = event.touches[0];
				if ( ( Math.abs( touch.clientX - x ) >= distanceThreshold ) || ( Math.abs( touch.clientY - y ) >= distanceThreshold ) ) {
					cancel();
				}
			};

			cancel = function () {
				node.removeEventListener( 'touchend', up, false );
				window.removeEventListener( 'touchmove', move, false );
				window.removeEventListener( 'touchcancel', cancel, false );
			};

			node.addEventListener( 'touchend', up, false );
			window.addEventListener( 'touchmove', move, false );
			window.addEventListener( 'touchcancel', cancel, false );

			setTimeout( cancel, timeThreshold );
		};

		node.addEventListener( 'touchstart', touchstart, false );


		// native buttons, and <input type='button'> elements, should fire a tap event
		// when the space key is pressed
		if ( node.tagName === 'BUTTON' || node.type === 'button' ) {
			focusHandler = function () {
				var blurHandler, keydownHandler;

				keydownHandler = function ( event ) {
					if ( event.which === 32 ) { // space key
						fire({
							node: node,
							original: event
						});
					}
				};

				blurHandler = function () {
					node.removeEventListener( 'keydown', keydownHandler, false );
					node.removeEventListener( 'blur', blurHandler, false );
				};

				node.addEventListener( 'keydown', keydownHandler, false );
				node.addEventListener( 'blur', blurHandler, false );
			};

			node.addEventListener( 'focus', focusHandler, false );
		}


		return {
			teardown: function () {
				node.removeEventListener( 'pointerdown', mousedown, false );
				node.removeEventListener( 'MSPointerDown', mousedown, false );
				node.removeEventListener( 'mousedown', mousedown, false );
				node.removeEventListener( 'touchstart', touchstart, false );
				node.removeEventListener( 'focus', focusHandler, false );
			}
		};
	};

	Ractive.events.tap = tap;

}));

},{"ractive":18}],18:[function(require,module,exports){
/*

	Ractive - v0.3.9-317-d23e408 - 2014-03-21
	==============================================================

	Next-generation DOM manipulation - http://ractivejs.org
	Follow @RactiveJS for updates

	--------------------------------------------------------------

	Copyright 2014 Rich Harris and contributors

	Permission is hereby granted, free of charge, to any person
	obtaining a copy of this software and associated documentation
	files (the "Software"), to deal in the Software without
	restriction, including without limitation the rights to use,
	copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the
	Software is furnished to do so, subject to the following
	conditions:

	The above copyright notice and this permission notice shall be
	included in all copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
	EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
	OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
	NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
	HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
	WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
	FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
	OTHER DEALINGS IN THE SOFTWARE.

*/

( function( global ) {



	var noConflict = global.Ractive;

	var legacy = undefined;

	var config_initOptions = function( legacy ) {

		var defaults, initOptions;
		defaults = {
			el: null,
			template: '',
			complete: null,
			preserveWhitespace: false,
			append: false,
			twoway: true,
			modifyArrays: true,
			lazy: false,
			debug: false,
			noIntro: false,
			transitionsEnabled: true,
			magic: false,
			noCssTransform: false,
			adapt: [],
			sanitize: false,
			stripComments: true,
			isolated: false,
			delimiters: [
				'{{',
				'}}'
			],
			tripleDelimiters: [
				'{{{',
				'}}}'
			]
		};
		initOptions = {
			keys: Object.keys( defaults ),
			defaults: defaults
		};
		return initOptions;
	}( legacy );

	var config_svg = function() {

		if ( typeof document === 'undefined' ) {
			return;
		}
		return document && document.implementation.hasFeature( 'http://www.w3.org/TR/SVG11/feature#BasicStructure', '1.1' );
	}();

	var config_namespaces = {
		html: 'http://www.w3.org/1999/xhtml',
		mathml: 'http://www.w3.org/1998/Math/MathML',
		svg: 'http://www.w3.org/2000/svg',
		xlink: 'http://www.w3.org/1999/xlink',
		xml: 'http://www.w3.org/XML/1998/namespace',
		xmlns: 'http://www.w3.org/2000/xmlns/'
	};

	var utils_createElement = function( svg, namespaces ) {

		if ( !svg ) {
			return function( type, ns ) {
				if ( ns && ns !== namespaces.html ) {
					throw 'This browser does not support namespaces other than http://www.w3.org/1999/xhtml. The most likely cause of this error is that you\'re trying to render SVG in an older browser. See http://docs.ractivejs.org/latest/svg-and-older-browsers for more information';
				}
				return document.createElement( type );
			};
		} else {
			return function( type, ns ) {
				if ( !ns ) {
					return document.createElement( type );
				}
				return document.createElementNS( ns, type );
			};
		}
	}( config_svg, config_namespaces );

	var config_isClient = typeof document === 'object';

	var utils_defineProperty = function( isClient ) {

		try {
			Object.defineProperty( {}, 'test', {
				value: 0
			} );
			if ( isClient ) {
				Object.defineProperty( document.createElement( 'div' ), 'test', {
					value: 0
				} );
			}
			return Object.defineProperty;
		} catch ( err ) {
			return function( obj, prop, desc ) {
				obj[ prop ] = desc.value;
			};
		}
	}( config_isClient );

	var utils_defineProperties = function( createElement, defineProperty, isClient ) {

		try {
			try {
				Object.defineProperties( {}, {
					test: {
						value: 0
					}
				} );
			} catch ( err ) {
				throw err;
			}
			if ( isClient ) {
				Object.defineProperties( createElement( 'div' ), {
					test: {
						value: 0
					}
				} );
			}
			return Object.defineProperties;
		} catch ( err ) {
			return function( obj, props ) {
				var prop;
				for ( prop in props ) {
					if ( props.hasOwnProperty( prop ) ) {
						defineProperty( obj, prop, props[ prop ] );
					}
				}
			};
		}
	}( utils_createElement, utils_defineProperty, config_isClient );

	var utils_isNumeric = function( thing ) {
		return !isNaN( parseFloat( thing ) ) && isFinite( thing );
	};

	var Ractive_prototype_shared_add = function( isNumeric ) {

		return function( root, keypath, d ) {
			var value;
			if ( typeof keypath !== 'string' || !isNumeric( d ) ) {
				throw new Error( 'Bad arguments' );
			}
			value = +root.get( keypath ) || 0;
			if ( !isNumeric( value ) ) {
				throw new Error( 'Cannot add to a non-numeric value' );
			}
			return root.set( keypath, value + d );
		};
	}( utils_isNumeric );

	var Ractive_prototype_add = function( add ) {

		return function( keypath, d ) {
			return add( this, keypath, d === undefined ? 1 : +d );
		};
	}( Ractive_prototype_shared_add );

	var utils_isEqual = function( a, b ) {
		if ( a === null && b === null ) {
			return true;
		}
		if ( typeof a === 'object' || typeof b === 'object' ) {
			return false;
		}
		return a === b;
	};

	var utils_Promise = function() {

		var Promise, PENDING = {}, FULFILLED = {}, REJECTED = {};
		Promise = function( callback ) {
			var fulfilledHandlers = [],
				rejectedHandlers = [],
				state = PENDING,
				result, dispatchHandlers, makeResolver, fulfil, reject, promise;
			makeResolver = function( newState ) {
				return function( value ) {
					if ( state !== PENDING ) {
						return;
					}
					result = value;
					state = newState;
					dispatchHandlers = makeDispatcher( state === FULFILLED ? fulfilledHandlers : rejectedHandlers, result );
					wait( dispatchHandlers );
				};
			};
			fulfil = makeResolver( FULFILLED );
			reject = makeResolver( REJECTED );
			callback( fulfil, reject );
			promise = {
				then: function( onFulfilled, onRejected ) {
					var promise2 = new Promise( function( fulfil, reject ) {
						var processResolutionHandler = function( handler, handlers, forward ) {
							if ( typeof handler === 'function' ) {
								handlers.push( function( p1result ) {
									var x;
									try {
										x = handler( p1result );
										resolve( promise2, x, fulfil, reject );
									} catch ( err ) {
										reject( err );
									}
								} );
							} else {
								handlers.push( forward );
							}
						};
						processResolutionHandler( onFulfilled, fulfilledHandlers, fulfil );
						processResolutionHandler( onRejected, rejectedHandlers, reject );
						if ( state !== PENDING ) {
							wait( dispatchHandlers );
						}
					} );
					return promise2;
				}
			};
			promise[ 'catch' ] = function( onRejected ) {
				return this.then( null, onRejected );
			};
			return promise;
		};
		Promise.all = function( promises ) {
			return new Promise( function( fulfil, reject ) {
				var result = [],
					pending, i, processPromise;
				if ( !promises.length ) {
					fulfil( result );
					return;
				}
				processPromise = function( i ) {
					promises[ i ].then( function( value ) {
						result[ i ] = value;
						if ( !--pending ) {
							fulfil( result );
						}
					}, reject );
				};
				pending = i = promises.length;
				while ( i-- ) {
					processPromise( i );
				}
			} );
		};
		Promise.resolve = function( value ) {
			return new Promise( function( fulfil ) {
				fulfil( value );
			} );
		};
		Promise.reject = function( reason ) {
			return new Promise( function( fulfil, reject ) {
				reject( reason );
			} );
		};
		return Promise;

		function wait( callback ) {
			setTimeout( callback, 0 );
		}

		function makeDispatcher( handlers, result ) {
			return function() {
				var handler;
				while ( handler = handlers.shift() ) {
					handler( result );
				}
			};
		}

		function resolve( promise, x, fulfil, reject ) {
			var then;
			if ( x === promise ) {
				throw new TypeError( 'A promise\'s fulfillment handler cannot return the same promise' );
			}
			if ( x instanceof Promise ) {
				x.then( fulfil, reject );
			} else if ( x && ( typeof x === 'object' || typeof x === 'function' ) ) {
				try {
					then = x.then;
				} catch ( e ) {
					reject( e );
					return;
				}
				if ( typeof then === 'function' ) {
					var called, resolvePromise, rejectPromise;
					resolvePromise = function( y ) {
						if ( called ) {
							return;
						}
						called = true;
						resolve( promise, y, fulfil, reject );
					};
					rejectPromise = function( r ) {
						if ( called ) {
							return;
						}
						called = true;
						reject( r );
					};
					try {
						then.call( x, resolvePromise, rejectPromise );
					} catch ( e ) {
						if ( !called ) {
							reject( e );
							called = true;
							return;
						}
					}
				} else {
					fulfil( x );
				}
			} else {
				fulfil( x );
			}
		}
	}();

	var utils_normaliseKeypath = function() {

		var regex = /\[\s*(\*|[0-9]|[1-9][0-9]+)\s*\]/g;
		return function normaliseKeypath( keypath ) {
			return ( keypath || '' ).replace( regex, '.$1' );
		};
	}();

	var config_vendors = [
		'o',
		'ms',
		'moz',
		'webkit'
	];

	var utils_requestAnimationFrame = function( vendors ) {

		if ( typeof window === 'undefined' ) {
			return;
		}
		( function( vendors, lastTime, window ) {
			var x, setTimeout;
			if ( window.requestAnimationFrame ) {
				return;
			}
			for ( x = 0; x < vendors.length && !window.requestAnimationFrame; ++x ) {
				window.requestAnimationFrame = window[ vendors[ x ] + 'RequestAnimationFrame' ];
			}
			if ( !window.requestAnimationFrame ) {
				setTimeout = window.setTimeout;
				window.requestAnimationFrame = function( callback ) {
					var currTime, timeToCall, id;
					currTime = Date.now();
					timeToCall = Math.max( 0, 16 - ( currTime - lastTime ) );
					id = setTimeout( function() {
						callback( currTime + timeToCall );
					}, timeToCall );
					lastTime = currTime + timeToCall;
					return id;
				};
			}
		}( vendors, 0, window ) );
		return window.requestAnimationFrame;
	}( config_vendors );

	var utils_getTime = function() {

		if ( typeof window !== 'undefined' && window.performance && typeof window.performance.now === 'function' ) {
			return function() {
				return window.performance.now();
			};
		} else {
			return function() {
				return Date.now();
			};
		}
	}();

	// This module provides a place to store a) circular dependencies and
	// b) the callback functions that require those circular dependencies
	var circular = [];

	var utils_removeFromArray = function( array, member ) {
		var index = array.indexOf( member );
		if ( index !== -1 ) {
			array.splice( index, 1 );
		}
	};

	var global_css = function( circular, isClient, removeFromArray ) {

		var runloop, styleElement, head, styleSheet, inDom, prefix = '/* Ractive.js component styles */\n',
			componentsInPage = {}, styles = [];
		if ( !isClient ) {
			return;
		}
		circular.push( function() {
			runloop = circular.runloop;
		} );
		styleElement = document.createElement( 'style' );
		styleElement.type = 'text/css';
		head = document.getElementsByTagName( 'head' )[ 0 ];
		inDom = false;
		styleSheet = styleElement.styleSheet;
		return {
			add: function( Component ) {
				if ( !Component.css ) {
					return;
				}
				if ( !componentsInPage[ Component._guid ] ) {
					componentsInPage[ Component._guid ] = 0;
					styles.push( Component.css );
					runloop.scheduleCssUpdate();
				}
				componentsInPage[ Component._guid ] += 1;
			},
			remove: function( Component ) {
				if ( !Component.css ) {
					return;
				}
				componentsInPage[ Component._guid ] -= 1;
				if ( !componentsInPage[ Component._guid ] ) {
					removeFromArray( styles, Component.css );
					runloop.scheduleCssUpdate();
				}
			},
			update: function() {
				var css;
				if ( styles.length ) {
					css = prefix + styles.join( ' ' );
					if ( styleSheet ) {
						styleSheet.cssText = css;
					} else {
						styleElement.innerHTML = css;
					}
					if ( !inDom ) {
						head.appendChild( styleElement );
					}
				} else if ( inDom ) {
					head.removeChild( styleElement );
				}
			}
		};
	}( circular, config_isClient, utils_removeFromArray );

	var shared_getValueFromCheckboxes = function( ractive, keypath ) {
		var value, checkboxes, checkbox, len, i, rootEl;
		value = [];
		rootEl = ractive._rendering ? ractive.fragment.docFrag : ractive.el;
		checkboxes = rootEl.querySelectorAll( 'input[type="checkbox"][name="{{' + keypath + '}}"]' );
		len = checkboxes.length;
		for ( i = 0; i < len; i += 1 ) {
			checkbox = checkboxes[ i ];
			if ( checkbox.hasAttribute( 'checked' ) || checkbox.checked ) {
				value.push( checkbox._ractive.value );
			}
		}
		return value;
	};

	var utils_hasOwnProperty = Object.prototype.hasOwnProperty;

	var shared_getInnerContext = function( fragment ) {
		do {
			if ( fragment.context ) {
				return fragment.context;
			}
		} while ( fragment = fragment.parent );
		return '';
	};

	var shared_resolveRef = function( circular, normaliseKeypath, hasOwnProperty, getInnerContext ) {

		var get, ancestorErrorMessage = 'Could not resolve reference - too many "../" prefixes';
		circular.push( function() {
			get = circular.get;
		} );
		return function resolveRef( ractive, ref, fragment ) {
			var context, contextKeys, keys, lastKey, postfix, parentKeypath, parentValue, wrapped;
			ref = normaliseKeypath( ref );
			if ( ref === '.' ) {
				return getInnerContext( fragment );
			}
			if ( ref.charAt( 0 ) === '.' ) {
				context = getInnerContext( fragment );
				contextKeys = context ? context.split( '.' ) : [];
				if ( ref.substr( 0, 3 ) === '../' ) {
					while ( ref.substr( 0, 3 ) === '../' ) {
						if ( !contextKeys.length ) {
							throw new Error( ancestorErrorMessage );
						}
						contextKeys.pop();
						ref = ref.substring( 3 );
					}
					contextKeys.push( ref );
					return contextKeys.join( '.' );
				}
				if ( !context ) {
					return ref.substring( 1 );
				}
				return context + ref;
			}
			keys = ref.split( '.' );
			lastKey = keys.pop();
			postfix = keys.length ? '.' + keys.join( '.' ) : '';
			do {
				context = fragment.context;
				if ( !context ) {
					continue;
				}
				parentKeypath = context + postfix;
				parentValue = get( ractive, parentKeypath );
				if ( wrapped = ractive._wrapped[ parentKeypath ] ) {
					parentValue = wrapped.get();
				}
				if ( parentValue && ( typeof parentValue === 'object' || typeof parentValue === 'function' ) && lastKey in parentValue ) {
					return context + '.' + ref;
				}
			} while ( fragment = fragment.parent );
			if ( hasOwnProperty.call( ractive.data, ref ) ) {
				return ref;
			} else if ( get( ractive, ref ) !== undefined ) {
				return ref;
			}
		};
	}( circular, utils_normaliseKeypath, utils_hasOwnProperty, shared_getInnerContext );

	var shared_getUpstreamChanges = function getUpstreamChanges( changes ) {
		var upstreamChanges = [ '' ],
			i, keypath, keys, upstreamKeypath;
		i = changes.length;
		while ( i-- ) {
			keypath = changes[ i ];
			keys = keypath.split( '.' );
			while ( keys.length > 1 ) {
				keys.pop();
				upstreamKeypath = keys.join( '.' );
				if ( upstreamChanges[ upstreamKeypath ] !== true ) {
					upstreamChanges.push( upstreamKeypath );
					upstreamChanges[ upstreamKeypath ] = true;
				}
			}
		}
		return upstreamChanges;
	};

	var shared_notifyDependants = function() {

		var lastKey, starMaps = {};
		lastKey = /[^\.]+$/;

		function notifyDependants( ractive, keypath, onlyDirect ) {
			var i;
			if ( ractive._patternObservers.length ) {
				notifyPatternObservers( ractive, keypath, keypath, onlyDirect, true );
			}
			for ( i = 0; i < ractive._deps.length; i += 1 ) {
				notifyDependantsAtPriority( ractive, keypath, i, onlyDirect );
			}
		}
		notifyDependants.multiple = function notifyMultipleDependants( ractive, keypaths, onlyDirect ) {
			var i, j, len;
			len = keypaths.length;
			if ( ractive._patternObservers.length ) {
				i = len;
				while ( i-- ) {
					notifyPatternObservers( ractive, keypaths[ i ], keypaths[ i ], onlyDirect, true );
				}
			}
			for ( i = 0; i < ractive._deps.length; i += 1 ) {
				if ( ractive._deps[ i ] ) {
					j = len;
					while ( j-- ) {
						notifyDependantsAtPriority( ractive, keypaths[ j ], i, onlyDirect );
					}
				}
			}
		};
		return notifyDependants;

		function notifyDependantsAtPriority( ractive, keypath, priority, onlyDirect ) {
			var depsByKeypath = ractive._deps[ priority ];
			if ( !depsByKeypath ) {
				return;
			}
			updateAll( depsByKeypath[ keypath ] );
			if ( onlyDirect ) {
				return;
			}
			cascade( ractive._depsMap[ keypath ], ractive, priority );
		}

		function updateAll( deps ) {
			var i, len;
			if ( deps ) {
				len = deps.length;
				for ( i = 0; i < len; i += 1 ) {
					deps[ i ].update();
				}
			}
		}

		function cascade( childDeps, ractive, priority, onlyDirect ) {
			var i;
			if ( childDeps ) {
				i = childDeps.length;
				while ( i-- ) {
					notifyDependantsAtPriority( ractive, childDeps[ i ], priority, onlyDirect );
				}
			}
		}

		function notifyPatternObservers( ractive, registeredKeypath, actualKeypath, isParentOfChangedKeypath, isTopLevelCall ) {
			var i, patternObserver, children, child, key, childActualKeypath, potentialWildcardMatches, cascade;
			i = ractive._patternObservers.length;
			while ( i-- ) {
				patternObserver = ractive._patternObservers[ i ];
				if ( patternObserver.regex.test( actualKeypath ) ) {
					patternObserver.update( actualKeypath );
				}
			}
			if ( isParentOfChangedKeypath ) {
				return;
			}
			cascade = function( keypath ) {
				if ( children = ractive._depsMap[ keypath ] ) {
					i = children.length;
					while ( i-- ) {
						child = children[ i ];
						key = lastKey.exec( child )[ 0 ];
						childActualKeypath = actualKeypath + '.' + key;
						notifyPatternObservers( ractive, child, childActualKeypath );
					}
				}
			};
			if ( isTopLevelCall ) {
				potentialWildcardMatches = getPotentialWildcardMatches( actualKeypath );
				potentialWildcardMatches.forEach( cascade );
			} else {
				cascade( registeredKeypath );
			}
		}

		function getPotentialWildcardMatches( keypath ) {
			var keys, starMap, mapper, i, result, wildcardKeypath;
			keys = keypath.split( '.' );
			starMap = getStarMap( keys.length );
			result = [];
			mapper = function( star, i ) {
				return star ? '*' : keys[ i ];
			};
			i = starMap.length;
			while ( i-- ) {
				wildcardKeypath = starMap[ i ].map( mapper ).join( '.' );
				if ( !result[ wildcardKeypath ] ) {
					result.push( wildcardKeypath );
					result[ wildcardKeypath ] = true;
				}
			}
			return result;
		}

		function getStarMap( num ) {
			var ones = '',
				max, binary, starMap, mapper, i;
			if ( !starMaps[ num ] ) {
				starMap = [];
				while ( ones.length < num ) {
					ones += 1;
				}
				max = parseInt( ones, 2 );
				mapper = function( digit ) {
					return digit === '1';
				};
				for ( i = 0; i <= max; i += 1 ) {
					binary = i.toString( 2 );
					while ( binary.length < num ) {
						binary = '0' + binary;
					}
					starMap[ i ] = Array.prototype.map.call( binary, mapper );
				}
				starMaps[ num ] = starMap;
			}
			return starMaps[ num ];
		}
	}();

	var shared_makeTransitionManager = function( removeFromArray ) {

		var makeTransitionManager, checkComplete, remove, init;
		makeTransitionManager = function( callback, previous ) {
			var transitionManager = [];
			transitionManager.detachQueue = [];
			transitionManager.remove = remove;
			transitionManager.init = init;
			transitionManager._check = checkComplete;
			transitionManager._callback = callback;
			transitionManager._previous = previous;
			if ( previous ) {
				previous.push( transitionManager );
			}
			return transitionManager;
		};
		checkComplete = function() {
			var element;
			if ( this._ready && !this.length ) {
				while ( element = this.detachQueue.pop() ) {
					element.detach();
				}
				if ( typeof this._callback === 'function' ) {
					this._callback();
				}
				if ( this._previous ) {
					this._previous.remove( this );
				}
			}
		};
		remove = function( transition ) {
			removeFromArray( this, transition );
			this._check();
		};
		init = function() {
			this._ready = true;
			this._check();
		};
		return makeTransitionManager;
	}( utils_removeFromArray );

	var global_runloop = function( circular, css, removeFromArray, getValueFromCheckboxes, resolveRef, getUpstreamChanges, notifyDependants, makeTransitionManager ) {

		circular.push( function() {
			get = circular.get;
			set = circular.set;
		} );
		var runloop, get, set, dirty = false,
			flushing = false,
			pendingCssChanges, inFlight = 0,
			toFocus = null,
			liveQueries = [],
			decorators = [],
			transitions = [],
			observers = [],
			attributes = [],
			evaluators = [],
			selectValues = [],
			checkboxKeypaths = {}, checkboxes = [],
			radios = [],
			unresolved = [],
			instances = [],
			transitionManager;
		runloop = {
			start: function( instance, callback ) {
				if ( instance && !instances[ instance._guid ] ) {
					instances.push( instance );
					instances[ instances._guid ] = true;
				}
				if ( !flushing ) {
					inFlight += 1;
					transitionManager = makeTransitionManager( callback, transitionManager );
				}
			},
			end: function() {
				if ( flushing ) {
					attemptKeypathResolution();
					return;
				}
				if ( !--inFlight ) {
					flushing = true;
					flushChanges();
					flushing = false;
					land();
				}
				transitionManager.init();
				transitionManager = transitionManager._previous;
			},
			trigger: function() {
				if ( inFlight || flushing ) {
					attemptKeypathResolution();
					return;
				}
				flushing = true;
				flushChanges();
				flushing = false;
				land();
			},
			focus: function( node ) {
				toFocus = node;
			},
			addLiveQuery: function( query ) {
				liveQueries.push( query );
			},
			addDecorator: function( decorator ) {
				decorators.push( decorator );
			},
			addTransition: function( transition ) {
				transition._manager = transitionManager;
				transitionManager.push( transition );
				transitions.push( transition );
			},
			addObserver: function( observer ) {
				observers.push( observer );
			},
			addAttribute: function( attribute ) {
				attributes.push( attribute );
			},
			scheduleCssUpdate: function() {
				if ( !inFlight && !flushing ) {
					css.update();
				} else {
					pendingCssChanges = true;
				}
			},
			addEvaluator: function( evaluator ) {
				dirty = true;
				evaluators.push( evaluator );
			},
			addSelectValue: function( selectValue ) {
				dirty = true;
				selectValues.push( selectValue );
			},
			addCheckbox: function( checkbox ) {
				if ( !checkboxKeypaths[ checkbox.keypath ] ) {
					dirty = true;
					checkboxes.push( checkbox );
				}
			},
			addRadio: function( radio ) {
				dirty = true;
				radios.push( radio );
			},
			addUnresolved: function( thing ) {
				dirty = true;
				unresolved.push( thing );
			},
			removeUnresolved: function( thing ) {
				removeFromArray( unresolved, thing );
			},
			detachWhenReady: function( thing ) {
				transitionManager.detachQueue.push( thing );
			}
		};
		circular.runloop = runloop;
		return runloop;

		function land() {
			var thing, changedKeypath, changeHash;
			if ( toFocus ) {
				toFocus.focus();
				toFocus = null;
			}
			while ( thing = attributes.pop() ) {
				thing.update().deferred = false;
			}
			while ( thing = liveQueries.pop() ) {
				thing._sort();
			}
			while ( thing = decorators.pop() ) {
				thing.init();
			}
			while ( thing = transitions.pop() ) {
				thing.init();
			}
			while ( thing = observers.pop() ) {
				thing.update();
			}
			while ( thing = instances.pop() ) {
				instances[ thing._guid ] = false;
				if ( thing._changes.length ) {
					changeHash = {};
					while ( changedKeypath = thing._changes.pop() ) {
						changeHash[ changedKeypath ] = get( thing, changedKeypath );
					}
					thing.fire( 'change', changeHash );
				}
			}
			if ( pendingCssChanges ) {
				css.update();
				pendingCssChanges = false;
			}
		}

		function flushChanges() {
			var thing, upstreamChanges, i;
			i = instances.length;
			while ( i-- ) {
				thing = instances[ i ];
				if ( thing._changes.length ) {
					upstreamChanges = getUpstreamChanges( thing._changes );
					notifyDependants.multiple( thing, upstreamChanges, true );
				}
			}
			attemptKeypathResolution();
			while ( dirty ) {
				dirty = false;
				while ( thing = evaluators.pop() ) {
					thing.update().deferred = false;
				}
				while ( thing = selectValues.pop() ) {
					thing.deferredUpdate();
				}
				while ( thing = checkboxes.pop() ) {
					set( thing.root, thing.keypath, getValueFromCheckboxes( thing.root, thing.keypath ) );
				}
				while ( thing = radios.pop() ) {
					thing.update();
				}
			}
		}

		function attemptKeypathResolution() {
			var array, thing, keypath;
			if ( !unresolved.length ) {
				return;
			}
			array = unresolved.splice( 0, unresolved.length );
			while ( thing = array.pop() ) {
				if ( thing.keypath ) {
					continue;
				}
				keypath = resolveRef( thing.root, thing.ref, thing.parentFragment );
				if ( keypath !== undefined ) {
					thing.resolve( keypath );
				} else {
					unresolved.push( thing );
				}
			}
		}
	}( circular, global_css, utils_removeFromArray, shared_getValueFromCheckboxes, shared_resolveRef, shared_getUpstreamChanges, shared_notifyDependants, shared_makeTransitionManager );

	var shared_animations = function( rAF, getTime, runloop ) {

		var queue = [];
		var animations = {
			tick: function() {
				var i, animation, now;
				now = getTime();
				runloop.start();
				for ( i = 0; i < queue.length; i += 1 ) {
					animation = queue[ i ];
					if ( !animation.tick( now ) ) {
						queue.splice( i--, 1 );
					}
				}
				runloop.end();
				if ( queue.length ) {
					rAF( animations.tick );
				} else {
					animations.running = false;
				}
			},
			add: function( animation ) {
				queue.push( animation );
				if ( !animations.running ) {
					animations.running = true;
					rAF( animations.tick );
				}
			},
			abort: function( keypath, root ) {
				var i = queue.length,
					animation;
				while ( i-- ) {
					animation = queue[ i ];
					if ( animation.root === root && animation.keypath === keypath ) {
						animation.stop();
					}
				}
			}
		};
		return animations;
	}( utils_requestAnimationFrame, utils_getTime, global_runloop );

	var utils_isArray = function() {

		var toString = Object.prototype.toString;
		return function( thing ) {
			return toString.call( thing ) === '[object Array]';
		};
	}();

	var utils_clone = function( isArray ) {

		return function( source ) {
			var target, key;
			if ( !source || typeof source !== 'object' ) {
				return source;
			}
			if ( isArray( source ) ) {
				return source.slice();
			}
			target = {};
			for ( key in source ) {
				if ( source.hasOwnProperty( key ) ) {
					target[ key ] = source[ key ];
				}
			}
			return target;
		};
	}( utils_isArray );

	var registries_adaptors = {};

	var shared_get_arrayAdaptor_getSpliceEquivalent = function( array, methodName, args ) {
		switch ( methodName ) {
			case 'splice':
				return args;
			case 'sort':
			case 'reverse':
				return null;
			case 'pop':
				if ( array.length ) {
					return [ -1 ];
				}
				return null;
			case 'push':
				return [
					array.length,
					0
				].concat( args );
			case 'shift':
				return [
					0,
					1
				];
			case 'unshift':
				return [
					0,
					0
				].concat( args );
		}
	};

	var shared_get_arrayAdaptor_summariseSpliceOperation = function( array, args ) {
		var start, addedItems, removedItems, balance;
		if ( !args ) {
			return null;
		}
		start = +( args[ 0 ] < 0 ? array.length + args[ 0 ] : args[ 0 ] );
		addedItems = Math.max( 0, args.length - 2 );
		removedItems = args[ 1 ] !== undefined ? args[ 1 ] : array.length - start;
		removedItems = Math.min( removedItems, array.length - start );
		balance = addedItems - removedItems;
		return {
			start: start,
			balance: balance,
			added: addedItems,
			removed: removedItems
		};
	};

	var config_types = {
		TEXT: 1,
		INTERPOLATOR: 2,
		TRIPLE: 3,
		SECTION: 4,
		INVERTED: 5,
		CLOSING: 6,
		ELEMENT: 7,
		PARTIAL: 8,
		COMMENT: 9,
		DELIMCHANGE: 10,
		MUSTACHE: 11,
		TAG: 12,
		ATTRIBUTE: 13,
		COMPONENT: 15,
		NUMBER_LITERAL: 20,
		STRING_LITERAL: 21,
		ARRAY_LITERAL: 22,
		OBJECT_LITERAL: 23,
		BOOLEAN_LITERAL: 24,
		GLOBAL: 26,
		KEY_VALUE_PAIR: 27,
		REFERENCE: 30,
		REFINEMENT: 31,
		MEMBER: 32,
		PREFIX_OPERATOR: 33,
		BRACKETED: 34,
		CONDITIONAL: 35,
		INFIX_OPERATOR: 36,
		INVOCATION: 40
	};

	var shared_clearCache = function clearCache( ractive, keypath, dontTeardownWrapper ) {
		var cacheMap, wrappedProperty;
		if ( !dontTeardownWrapper ) {
			if ( wrappedProperty = ractive._wrapped[ keypath ] ) {
				if ( wrappedProperty.teardown() !== false ) {
					ractive._wrapped[ keypath ] = null;
				}
			}
		}
		ractive._cache[ keypath ] = undefined;
		if ( cacheMap = ractive._cacheMap[ keypath ] ) {
			while ( cacheMap.length ) {
				clearCache( ractive, cacheMap.pop() );
			}
		}
	};

	var utils_createBranch = function() {

		var numeric = /^\s*[0-9]+\s*$/;
		return function( key ) {
			return numeric.test( key ) ? [] : {};
		};
	}();

	var shared_set = function( circular, isEqual, createBranch, clearCache, notifyDependants ) {

		var get;
		circular.push( function() {
			get = circular.get;
		} );

		function set( ractive, keypath, value, silent ) {
			var keys, lastKey, parentKeypath, parentValue, wrapper, evaluator, dontTeardownWrapper;
			if ( isEqual( ractive._cache[ keypath ], value ) ) {
				return;
			}
			wrapper = ractive._wrapped[ keypath ];
			evaluator = ractive._evaluators[ keypath ];
			if ( wrapper && wrapper.reset ) {
				wrapper.reset( value );
				value = wrapper.get();
				dontTeardownWrapper = true;
			}
			if ( evaluator ) {
				evaluator.value = value;
			}
			if ( !evaluator && ( !wrapper || !wrapper.reset ) ) {
				keys = keypath.split( '.' );
				lastKey = keys.pop();
				parentKeypath = keys.join( '.' );
				wrapper = ractive._wrapped[ parentKeypath ];
				if ( wrapper && wrapper.set ) {
					wrapper.set( lastKey, value );
				} else {
					parentValue = wrapper ? wrapper.get() : get( ractive, parentKeypath );
					if ( !parentValue ) {
						parentValue = createBranch( lastKey );
						set( ractive, parentKeypath, parentValue );
					}
					parentValue[ lastKey ] = value;
				}
			}
			clearCache( ractive, keypath, dontTeardownWrapper );
			if ( !silent ) {
				ractive._changes.push( keypath );
				notifyDependants( ractive, keypath );
			}
		}
		circular.set = set;
		return set;
	}( circular, utils_isEqual, utils_createBranch, shared_clearCache, shared_notifyDependants );

	var shared_get_arrayAdaptor_processWrapper = function( types, clearCache, notifyDependants, set ) {

		return function( wrapper, array, methodName, spliceSummary ) {
			var root, keypath, clearEnd, updateDependant, i, changed, start, end, childKeypath, lengthUnchanged;
			root = wrapper.root;
			keypath = wrapper.keypath;
			root._changes.push( keypath );
			if ( methodName === 'sort' || methodName === 'reverse' ) {
				set( root, keypath, array );
				return;
			}
			if ( !spliceSummary ) {
				return;
			}
			clearEnd = !spliceSummary.balance ? spliceSummary.added : array.length - Math.min( spliceSummary.balance, 0 );
			for ( i = spliceSummary.start; i < clearEnd; i += 1 ) {
				clearCache( root, keypath + '.' + i );
			}
			updateDependant = function( dependant ) {
				if ( dependant.keypath === keypath && dependant.type === types.SECTION && !dependant.inverted && dependant.docFrag ) {
					dependant.splice( spliceSummary );
				} else {
					dependant.update();
				}
			};
			root._deps.forEach( function( depsByKeypath ) {
				var dependants = depsByKeypath[ keypath ];
				if ( dependants ) {
					dependants.forEach( updateDependant );
				}
			} );
			if ( spliceSummary.added && spliceSummary.removed ) {
				changed = Math.max( spliceSummary.added, spliceSummary.removed );
				start = spliceSummary.start;
				end = start + changed;
				lengthUnchanged = spliceSummary.added === spliceSummary.removed;
				for ( i = start; i < end; i += 1 ) {
					childKeypath = keypath + '.' + i;
					notifyDependants( root, childKeypath );
				}
			}
			if ( !lengthUnchanged ) {
				clearCache( root, keypath + '.length' );
				notifyDependants( root, keypath + '.length', true );
			}
		};
	}( config_types, shared_clearCache, shared_notifyDependants, shared_set );

	var shared_get_arrayAdaptor_patch = function( runloop, defineProperty, getSpliceEquivalent, summariseSpliceOperation, processWrapper ) {

		var patchedArrayProto = [],
			mutatorMethods = [
				'pop',
				'push',
				'reverse',
				'shift',
				'sort',
				'splice',
				'unshift'
			],
			testObj, patchArrayMethods, unpatchArrayMethods;
		mutatorMethods.forEach( function( methodName ) {
			var method = function() {
				var spliceEquivalent, spliceSummary, result, wrapper, i;
				spliceEquivalent = getSpliceEquivalent( this, methodName, Array.prototype.slice.call( arguments ) );
				spliceSummary = summariseSpliceOperation( this, spliceEquivalent );
				result = Array.prototype[ methodName ].apply( this, arguments );
				this._ractive.setting = true;
				i = this._ractive.wrappers.length;
				while ( i-- ) {
					wrapper = this._ractive.wrappers[ i ];
					runloop.start( wrapper.root );
					processWrapper( wrapper, this, methodName, spliceSummary );
					runloop.end();
				}
				this._ractive.setting = false;
				return result;
			};
			defineProperty( patchedArrayProto, methodName, {
				value: method
			} );
		} );
		testObj = {};
		if ( testObj.__proto__ ) {
			patchArrayMethods = function( array ) {
				array.__proto__ = patchedArrayProto;
			};
			unpatchArrayMethods = function( array ) {
				array.__proto__ = Array.prototype;
			};
		} else {
			patchArrayMethods = function( array ) {
				var i, methodName;
				i = mutatorMethods.length;
				while ( i-- ) {
					methodName = mutatorMethods[ i ];
					defineProperty( array, methodName, {
						value: patchedArrayProto[ methodName ],
						configurable: true
					} );
				}
			};
			unpatchArrayMethods = function( array ) {
				var i;
				i = mutatorMethods.length;
				while ( i-- ) {
					delete array[ mutatorMethods[ i ] ];
				}
			};
		}
		patchArrayMethods.unpatch = unpatchArrayMethods;
		return patchArrayMethods;
	}( global_runloop, utils_defineProperty, shared_get_arrayAdaptor_getSpliceEquivalent, shared_get_arrayAdaptor_summariseSpliceOperation, shared_get_arrayAdaptor_processWrapper );

	var shared_get_arrayAdaptor__arrayAdaptor = function( defineProperty, isArray, patch ) {

		var arrayAdaptor, ArrayWrapper, errorMessage;
		arrayAdaptor = {
			filter: function( object ) {
				return isArray( object ) && ( !object._ractive || !object._ractive.setting );
			},
			wrap: function( ractive, array, keypath ) {
				return new ArrayWrapper( ractive, array, keypath );
			}
		};
		ArrayWrapper = function( ractive, array, keypath ) {
			this.root = ractive;
			this.value = array;
			this.keypath = keypath;
			if ( !array._ractive ) {
				defineProperty( array, '_ractive', {
					value: {
						wrappers: [],
						instances: [],
						setting: false
					},
					configurable: true
				} );
				patch( array );
			}
			if ( !array._ractive.instances[ ractive._guid ] ) {
				array._ractive.instances[ ractive._guid ] = 0;
				array._ractive.instances.push( ractive );
			}
			array._ractive.instances[ ractive._guid ] += 1;
			array._ractive.wrappers.push( this );
		};
		ArrayWrapper.prototype = {
			get: function() {
				return this.value;
			},
			teardown: function() {
				var array, storage, wrappers, instances, index;
				array = this.value;
				storage = array._ractive;
				wrappers = storage.wrappers;
				instances = storage.instances;
				if ( storage.setting ) {
					return false;
				}
				index = wrappers.indexOf( this );
				if ( index === -1 ) {
					throw new Error( errorMessage );
				}
				wrappers.splice( index, 1 );
				if ( !wrappers.length ) {
					delete array._ractive;
					patch.unpatch( this.value );
				} else {
					instances[ this.root._guid ] -= 1;
					if ( !instances[ this.root._guid ] ) {
						index = instances.indexOf( this.root );
						if ( index === -1 ) {
							throw new Error( errorMessage );
						}
						instances.splice( index, 1 );
					}
				}
			}
		};
		errorMessage = 'Something went wrong in a rather interesting way';
		return arrayAdaptor;
	}( utils_defineProperty, utils_isArray, shared_get_arrayAdaptor_patch );

	var shared_get_magicAdaptor = function( runloop, createBranch, isArray, clearCache, notifyDependants ) {

		var magicAdaptor, MagicWrapper;
		try {
			Object.defineProperty( {}, 'test', {
				value: 0
			} );
		} catch ( err ) {
			return false;
		}
		magicAdaptor = {
			filter: function( object, keypath, ractive ) {
				var keys, key, parentKeypath, parentWrapper, parentValue;
				if ( !keypath ) {
					return false;
				}
				keys = keypath.split( '.' );
				key = keys.pop();
				parentKeypath = keys.join( '.' );
				if ( ( parentWrapper = ractive._wrapped[ parentKeypath ] ) && !parentWrapper.magic ) {
					return false;
				}
				parentValue = ractive.get( parentKeypath );
				if ( isArray( parentValue ) && /^[0-9]+$/.test( key ) ) {
					return false;
				}
				return parentValue && ( typeof parentValue === 'object' || typeof parentValue === 'function' );
			},
			wrap: function( ractive, property, keypath ) {
				return new MagicWrapper( ractive, property, keypath );
			}
		};
		MagicWrapper = function( ractive, value, keypath ) {
			var keys, objKeypath, descriptor, siblings;
			this.magic = true;
			this.ractive = ractive;
			this.keypath = keypath;
			this.value = value;
			keys = keypath.split( '.' );
			this.prop = keys.pop();
			objKeypath = keys.join( '.' );
			this.obj = objKeypath ? ractive.get( objKeypath ) : ractive.data;
			descriptor = this.originalDescriptor = Object.getOwnPropertyDescriptor( this.obj, this.prop );
			if ( descriptor && descriptor.set && ( siblings = descriptor.set._ractiveWrappers ) ) {
				if ( siblings.indexOf( this ) === -1 ) {
					siblings.push( this );
				}
				return;
			}
			createAccessors( this, value, descriptor );
		};
		MagicWrapper.prototype = {
			get: function() {
				return this.value;
			},
			reset: function( value ) {
				if ( this.updating ) {
					return;
				}
				this.updating = true;
				this.obj[ this.prop ] = value;
				clearCache( this.ractive, this.keypath );
				this.updating = false;
			},
			set: function( key, value ) {
				if ( this.updating ) {
					return;
				}
				if ( !this.obj[ this.prop ] ) {
					this.updating = true;
					this.obj[ this.prop ] = createBranch( key );
					this.updating = false;
				}
				this.obj[ this.prop ][ key ] = value;
			},
			teardown: function() {
				var descriptor, set, value, wrappers, index;
				if ( this.updating ) {
					return false;
				}
				descriptor = Object.getOwnPropertyDescriptor( this.obj, this.prop );
				set = descriptor && descriptor.set;
				if ( !set ) {
					return;
				}
				wrappers = set._ractiveWrappers;
				index = wrappers.indexOf( this );
				if ( index !== -1 ) {
					wrappers.splice( index, 1 );
				}
				if ( !wrappers.length ) {
					value = this.obj[ this.prop ];
					Object.defineProperty( this.obj, this.prop, this.originalDescriptor || {
						writable: true,
						enumerable: true,
						configurable: true
					} );
					this.obj[ this.prop ] = value;
				}
			}
		};

		function createAccessors( originalWrapper, value, descriptor ) {
			var object, property, oldGet, oldSet, get, set;
			object = originalWrapper.obj;
			property = originalWrapper.prop;
			if ( descriptor && !descriptor.configurable ) {
				if ( property === 'length' ) {
					return;
				}
				throw new Error( 'Cannot use magic mode with property "' + property + '" - object is not configurable' );
			}
			if ( descriptor ) {
				oldGet = descriptor.get;
				oldSet = descriptor.set;
			}
			get = oldGet || function() {
				return value;
			};
			set = function( v ) {
				if ( oldSet ) {
					oldSet( v );
				}
				value = oldGet ? oldGet() : v;
				set._ractiveWrappers.forEach( updateWrapper );
			};

			function updateWrapper( wrapper ) {
				var keypath, ractive;
				wrapper.value = value;
				if ( wrapper.updating ) {
					return;
				}
				ractive = wrapper.ractive;
				keypath = wrapper.keypath;
				wrapper.updating = true;
				runloop.start( ractive );
				ractive._changes.push( keypath );
				clearCache( ractive, keypath );
				notifyDependants( ractive, keypath );
				runloop.end();
				wrapper.updating = false;
			}
			set._ractiveWrappers = [ originalWrapper ];
			Object.defineProperty( object, property, {
				get: get,
				set: set,
				enumerable: true,
				configurable: true
			} );
		}
		return magicAdaptor;
	}( global_runloop, utils_createBranch, utils_isArray, shared_clearCache, shared_notifyDependants );

	var shared_get_magicArrayAdaptor = function( magicAdaptor, arrayAdaptor ) {

		if ( !magicAdaptor ) {
			return false;
		}
		var magicArrayAdaptor, MagicArrayWrapper;
		magicArrayAdaptor = {
			filter: function( object, keypath, ractive ) {
				return magicAdaptor.filter( object, keypath, ractive ) && arrayAdaptor.filter( object );
			},
			wrap: function( ractive, array, keypath ) {
				return new MagicArrayWrapper( ractive, array, keypath );
			}
		};
		MagicArrayWrapper = function( ractive, array, keypath ) {
			this.value = array;
			this.magic = true;
			this.magicWrapper = magicAdaptor.wrap( ractive, array, keypath );
			this.arrayWrapper = arrayAdaptor.wrap( ractive, array, keypath );
		};
		MagicArrayWrapper.prototype = {
			get: function() {
				return this.value;
			},
			teardown: function() {
				this.arrayWrapper.teardown();
				this.magicWrapper.teardown();
			},
			reset: function( value ) {
				return this.magicWrapper.reset( value );
			}
		};
		return magicArrayAdaptor;
	}( shared_get_magicAdaptor, shared_get_arrayAdaptor__arrayAdaptor );

	var shared_adaptIfNecessary = function( adaptorRegistry, arrayAdaptor, magicAdaptor, magicArrayAdaptor ) {

		var prefixers = {};
		return function adaptIfNecessary( ractive, keypath, value, isExpressionResult ) {
			var len, i, adaptor, wrapped;
			len = ractive.adapt.length;
			for ( i = 0; i < len; i += 1 ) {
				adaptor = ractive.adapt[ i ];
				if ( typeof adaptor === 'string' ) {
					if ( !adaptorRegistry[ adaptor ] ) {
						throw new Error( 'Missing adaptor "' + adaptor + '"' );
					}
					adaptor = ractive.adapt[ i ] = adaptorRegistry[ adaptor ];
				}
				if ( adaptor.filter( value, keypath, ractive ) ) {
					wrapped = ractive._wrapped[ keypath ] = adaptor.wrap( ractive, value, keypath, getPrefixer( keypath ) );
					wrapped.value = value;
					return value;
				}
			}
			if ( !isExpressionResult ) {
				if ( ractive.magic ) {
					if ( magicArrayAdaptor.filter( value, keypath, ractive ) ) {
						ractive._wrapped[ keypath ] = magicArrayAdaptor.wrap( ractive, value, keypath );
					} else if ( magicAdaptor.filter( value, keypath, ractive ) ) {
						ractive._wrapped[ keypath ] = magicAdaptor.wrap( ractive, value, keypath );
					}
				} else if ( ractive.modifyArrays && arrayAdaptor.filter( value, keypath, ractive ) ) {
					ractive._wrapped[ keypath ] = arrayAdaptor.wrap( ractive, value, keypath );
				}
			}
			return value;
		};

		function prefixKeypath( obj, prefix ) {
			var prefixed = {}, key;
			if ( !prefix ) {
				return obj;
			}
			prefix += '.';
			for ( key in obj ) {
				if ( obj.hasOwnProperty( key ) ) {
					prefixed[ prefix + key ] = obj[ key ];
				}
			}
			return prefixed;
		}

		function getPrefixer( rootKeypath ) {
			var rootDot;
			if ( !prefixers[ rootKeypath ] ) {
				rootDot = rootKeypath ? rootKeypath + '.' : '';
				prefixers[ rootKeypath ] = function( relativeKeypath, value ) {
					var obj;
					if ( typeof relativeKeypath === 'string' ) {
						obj = {};
						obj[ rootDot + relativeKeypath ] = value;
						return obj;
					}
					if ( typeof relativeKeypath === 'object' ) {
						return rootDot ? prefixKeypath( relativeKeypath, rootKeypath ) : relativeKeypath;
					}
				};
			}
			return prefixers[ rootKeypath ];
		}
	}( registries_adaptors, shared_get_arrayAdaptor__arrayAdaptor, shared_get_magicAdaptor, shared_get_magicArrayAdaptor );

	var shared_registerDependant = function() {

		return function registerDependant( dependant ) {
			var depsByKeypath, deps, ractive, keypath, priority;
			ractive = dependant.root;
			keypath = dependant.keypath;
			priority = dependant.priority;
			depsByKeypath = ractive._deps[ priority ] || ( ractive._deps[ priority ] = {} );
			deps = depsByKeypath[ keypath ] || ( depsByKeypath[ keypath ] = [] );
			deps.push( dependant );
			dependant.registered = true;
			if ( !keypath ) {
				return;
			}
			updateDependantsMap( ractive, keypath );
		};

		function updateDependantsMap( ractive, keypath ) {
			var keys, parentKeypath, map;
			keys = keypath.split( '.' );
			while ( keys.length ) {
				keys.pop();
				parentKeypath = keys.join( '.' );
				map = ractive._depsMap[ parentKeypath ] || ( ractive._depsMap[ parentKeypath ] = [] );
				if ( map[ keypath ] === undefined ) {
					map[ keypath ] = 0;
					map[ map.length ] = keypath;
				}
				map[ keypath ] += 1;
				keypath = parentKeypath;
			}
		}
	}();

	var shared_unregisterDependant = function() {

		return function unregisterDependant( dependant ) {
			var deps, index, ractive, keypath, priority;
			ractive = dependant.root;
			keypath = dependant.keypath;
			priority = dependant.priority;
			deps = ractive._deps[ priority ][ keypath ];
			index = deps.indexOf( dependant );
			if ( index === -1 || !dependant.registered ) {
				throw new Error( 'Attempted to remove a dependant that was no longer registered! This should not happen. If you are seeing this bug in development please raise an issue at https://github.com/RactiveJS/Ractive/issues - thanks' );
			}
			deps.splice( index, 1 );
			dependant.registered = false;
			if ( !keypath ) {
				return;
			}
			updateDependantsMap( ractive, keypath );
		};

		function updateDependantsMap( ractive, keypath ) {
			var keys, parentKeypath, map;
			keys = keypath.split( '.' );
			while ( keys.length ) {
				keys.pop();
				parentKeypath = keys.join( '.' );
				map = ractive._depsMap[ parentKeypath ];
				map[ keypath ] -= 1;
				if ( !map[ keypath ] ) {
					map.splice( map.indexOf( keypath ), 1 );
					map[ keypath ] = undefined;
				}
				keypath = parentKeypath;
			}
		}
	}();

	var shared_createComponentBinding = function( circular, isArray, isEqual, registerDependant, unregisterDependant ) {

		var get, set;
		circular.push( function() {
			get = circular.get;
			set = circular.set;
		} );
		var Binding = function( ractive, keypath, otherInstance, otherKeypath, priority ) {
			this.root = ractive;
			this.keypath = keypath;
			this.priority = priority;
			this.otherInstance = otherInstance;
			this.otherKeypath = otherKeypath;
			registerDependant( this );
			this.value = get( this.root, this.keypath );
		};
		Binding.prototype = {
			update: function() {
				var value;
				if ( this.updating || this.counterpart && this.counterpart.updating ) {
					return;
				}
				value = get( this.root, this.keypath );
				if ( isArray( value ) && value._ractive && value._ractive.setting ) {
					return;
				}
				if ( !isEqual( value, this.value ) ) {
					this.updating = true;
					set( this.otherInstance, this.otherKeypath, value );
					this.value = value;
					this.updating = false;
				}
			},
			teardown: function() {
				unregisterDependant( this );
			}
		};
		return function createComponentBinding( component, parentInstance, parentKeypath, childKeypath ) {
			var hash, childInstance, bindings, priority, parentToChildBinding, childToParentBinding;
			hash = parentKeypath + '=' + childKeypath;
			bindings = component.bindings;
			if ( bindings[ hash ] ) {
				return;
			}
			bindings[ hash ] = true;
			childInstance = component.instance;
			priority = component.parentFragment.priority;
			parentToChildBinding = new Binding( parentInstance, parentKeypath, childInstance, childKeypath, priority );
			bindings.push( parentToChildBinding );
			if ( childInstance.twoway ) {
				childToParentBinding = new Binding( childInstance, childKeypath, parentInstance, parentKeypath, 1 );
				bindings.push( childToParentBinding );
				parentToChildBinding.counterpart = childToParentBinding;
				childToParentBinding.counterpart = parentToChildBinding;
			}
		};
	}( circular, utils_isArray, utils_isEqual, shared_registerDependant, shared_unregisterDependant );

	var shared_get_getFromParent = function( circular, createComponentBinding, set ) {

		var get;
		circular.push( function() {
			get = circular.get;
		} );
		return function getFromParent( child, keypath ) {
			var parent, fragment, keypathToTest, value;
			parent = child._parent;
			fragment = child.component.parentFragment;
			do {
				if ( !fragment.context ) {
					continue;
				}
				keypathToTest = fragment.context + '.' + keypath;
				value = get( parent, keypathToTest );
				if ( value !== undefined ) {
					createLateComponentBinding( parent, child, keypathToTest, keypath, value );
					return value;
				}
			} while ( fragment = fragment.parent );
			value = get( parent, keypath );
			if ( value !== undefined ) {
				createLateComponentBinding( parent, child, keypath, keypath, value );
				return value;
			}
		};

		function createLateComponentBinding( parent, child, parentKeypath, childKeypath, value ) {
			set( child, childKeypath, value, true );
			createComponentBinding( child.component, parent, parentKeypath, childKeypath );
		}
	}( circular, shared_createComponentBinding, shared_set );

	var shared_get_FAILED_LOOKUP = {
		FAILED_LOOKUP: true
	};

	var shared_get__get = function( circular, hasOwnProperty, clone, adaptIfNecessary, getFromParent, FAILED_LOOKUP ) {

		function get( ractive, keypath, options ) {
			var cache = ractive._cache,
				value, wrapped, evaluator;
			if ( cache[ keypath ] === undefined ) {
				if ( wrapped = ractive._wrapped[ keypath ] ) {
					value = wrapped.value;
				} else if ( !keypath ) {
					adaptIfNecessary( ractive, '', ractive.data );
					value = ractive.data;
				} else if ( evaluator = ractive._evaluators[ keypath ] ) {
					value = evaluator.value;
				} else {
					value = retrieve( ractive, keypath );
				}
				cache[ keypath ] = value;
			} else {
				value = cache[ keypath ];
			}
			if ( value === FAILED_LOOKUP ) {
				if ( ractive._parent && !ractive.isolated ) {
					value = getFromParent( ractive, keypath, options );
				} else {
					value = undefined;
				}
			}
			if ( options && options.evaluateWrapped && ( wrapped = ractive._wrapped[ keypath ] ) ) {
				value = wrapped.get();
			}
			return value;
		}
		circular.get = get;
		return get;

		function retrieve( ractive, keypath ) {
			var keys, key, parentKeypath, parentValue, cacheMap, value, wrapped, shouldClone;
			keys = keypath.split( '.' );
			key = keys.pop();
			parentKeypath = keys.join( '.' );
			parentValue = get( ractive, parentKeypath );
			if ( wrapped = ractive._wrapped[ parentKeypath ] ) {
				parentValue = wrapped.get();
			}
			if ( parentValue === null || parentValue === undefined ) {
				return;
			}
			if ( !( cacheMap = ractive._cacheMap[ parentKeypath ] ) ) {
				ractive._cacheMap[ parentKeypath ] = [ keypath ];
			} else {
				if ( cacheMap.indexOf( keypath ) === -1 ) {
					cacheMap.push( keypath );
				}
			}
			if ( typeof parentValue === 'object' && !( key in parentValue ) ) {
				return ractive._cache[ keypath ] = FAILED_LOOKUP;
			}
			shouldClone = !hasOwnProperty.call( parentValue, key );
			value = shouldClone ? clone( parentValue[ key ] ) : parentValue[ key ];
			value = adaptIfNecessary( ractive, keypath, value, false );
			ractive._cache[ keypath ] = value;
			return value;
		}
	}( circular, utils_hasOwnProperty, utils_clone, shared_adaptIfNecessary, shared_get_getFromParent, shared_get_FAILED_LOOKUP );

	/* global console */
	var utils_warn = function() {

		if ( typeof console !== 'undefined' && typeof console.warn === 'function' && typeof console.warn.apply === 'function' ) {
			return function() {
				console.warn.apply( console, arguments );
			};
		}
		return function() {};
	}();

	var utils_isObject = function() {

		var toString = Object.prototype.toString;
		return function( thing ) {
			return typeof thing === 'object' && toString.call( thing ) === '[object Object]';
		};
	}();

	var registries_interpolators = function( circular, hasOwnProperty, isArray, isObject, isNumeric ) {

		var interpolators, interpolate, cssLengthPattern;
		circular.push( function() {
			interpolate = circular.interpolate;
		} );
		cssLengthPattern = /^([+-]?[0-9]+\.?(?:[0-9]+)?)(px|em|ex|%|in|cm|mm|pt|pc)$/;
		interpolators = {
			number: function( from, to ) {
				var delta;
				if ( !isNumeric( from ) || !isNumeric( to ) ) {
					return null;
				}
				from = +from;
				to = +to;
				delta = to - from;
				if ( !delta ) {
					return function() {
						return from;
					};
				}
				return function( t ) {
					return from + t * delta;
				};
			},
			array: function( from, to ) {
				var intermediate, interpolators, len, i;
				if ( !isArray( from ) || !isArray( to ) ) {
					return null;
				}
				intermediate = [];
				interpolators = [];
				i = len = Math.min( from.length, to.length );
				while ( i-- ) {
					interpolators[ i ] = interpolate( from[ i ], to[ i ] );
				}
				for ( i = len; i < from.length; i += 1 ) {
					intermediate[ i ] = from[ i ];
				}
				for ( i = len; i < to.length; i += 1 ) {
					intermediate[ i ] = to[ i ];
				}
				return function( t ) {
					var i = len;
					while ( i-- ) {
						intermediate[ i ] = interpolators[ i ]( t );
					}
					return intermediate;
				};
			},
			object: function( from, to ) {
				var properties, len, interpolators, intermediate, prop;
				if ( !isObject( from ) || !isObject( to ) ) {
					return null;
				}
				properties = [];
				intermediate = {};
				interpolators = {};
				for ( prop in from ) {
					if ( hasOwnProperty.call( from, prop ) ) {
						if ( hasOwnProperty.call( to, prop ) ) {
							properties.push( prop );
							interpolators[ prop ] = interpolate( from[ prop ], to[ prop ] );
						} else {
							intermediate[ prop ] = from[ prop ];
						}
					}
				}
				for ( prop in to ) {
					if ( hasOwnProperty.call( to, prop ) && !hasOwnProperty.call( from, prop ) ) {
						intermediate[ prop ] = to[ prop ];
					}
				}
				len = properties.length;
				return function( t ) {
					var i = len,
						prop;
					while ( i-- ) {
						prop = properties[ i ];
						intermediate[ prop ] = interpolators[ prop ]( t );
					}
					return intermediate;
				};
			},
			cssLength: function( from, to ) {
				var fromMatch, toMatch, fromUnit, toUnit, fromValue, toValue, unit, delta;
				if ( from !== 0 && typeof from !== 'string' || to !== 0 && typeof to !== 'string' ) {
					return null;
				}
				fromMatch = cssLengthPattern.exec( from );
				toMatch = cssLengthPattern.exec( to );
				fromUnit = fromMatch ? fromMatch[ 2 ] : '';
				toUnit = toMatch ? toMatch[ 2 ] : '';
				if ( fromUnit && toUnit && fromUnit !== toUnit ) {
					return null;
				}
				unit = fromUnit || toUnit;
				fromValue = fromMatch ? +fromMatch[ 1 ] : 0;
				toValue = toMatch ? +toMatch[ 1 ] : 0;
				delta = toValue - fromValue;
				if ( !delta ) {
					return function() {
						return fromValue + unit;
					};
				}
				return function( t ) {
					return fromValue + t * delta + unit;
				};
			}
		};
		return interpolators;
	}( circular, utils_hasOwnProperty, utils_isArray, utils_isObject, utils_isNumeric );

	var shared_interpolate = function( circular, warn, interpolators ) {

		var interpolate = function( from, to, ractive, type ) {
			if ( from === to ) {
				return snap( to );
			}
			if ( type ) {
				if ( ractive.interpolators[ type ] ) {
					return ractive.interpolators[ type ]( from, to ) || snap( to );
				}
				warn( 'Missing "' + type + '" interpolator. You may need to download a plugin from [TODO]' );
			}
			return interpolators.number( from, to ) || interpolators.array( from, to ) || interpolators.object( from, to ) || interpolators.cssLength( from, to ) || snap( to );
		};
		circular.interpolate = interpolate;
		return interpolate;

		function snap( to ) {
			return function() {
				return to;
			};
		}
	}( circular, utils_warn, registries_interpolators );

	var Ractive_prototype_animate_Animation = function( warn, runloop, interpolate, set ) {

		var Animation = function( options ) {
			var key;
			this.startTime = Date.now();
			for ( key in options ) {
				if ( options.hasOwnProperty( key ) ) {
					this[ key ] = options[ key ];
				}
			}
			this.interpolator = interpolate( this.from, this.to, this.root, this.interpolator );
			this.running = true;
		};
		Animation.prototype = {
			tick: function() {
				var elapsed, t, value, timeNow, index, keypath;
				keypath = this.keypath;
				if ( this.running ) {
					timeNow = Date.now();
					elapsed = timeNow - this.startTime;
					if ( elapsed >= this.duration ) {
						if ( keypath !== null ) {
							runloop.start( this.root );
							set( this.root, keypath, this.to );
							runloop.end();
						}
						if ( this.step ) {
							this.step( 1, this.to );
						}
						this.complete( this.to );
						index = this.root._animations.indexOf( this );
						if ( index === -1 ) {
							warn( 'Animation was not found' );
						}
						this.root._animations.splice( index, 1 );
						this.running = false;
						return false;
					}
					t = this.easing ? this.easing( elapsed / this.duration ) : elapsed / this.duration;
					if ( keypath !== null ) {
						value = this.interpolator( t );
						runloop.start( this.root );
						set( this.root, keypath, value );
						runloop.end();
					}
					if ( this.step ) {
						this.step( t, value );
					}
					return true;
				}
				return false;
			},
			stop: function() {
				var index;
				this.running = false;
				index = this.root._animations.indexOf( this );
				if ( index === -1 ) {
					warn( 'Animation was not found' );
				}
				this.root._animations.splice( index, 1 );
			}
		};
		return Animation;
	}( utils_warn, global_runloop, shared_interpolate, shared_set );

	var Ractive_prototype_animate__animate = function( isEqual, Promise, normaliseKeypath, animations, get, Animation ) {

		var noop = function() {}, noAnimation = {
				stop: noop
			};
		return function( keypath, to, options ) {
			var promise, fulfilPromise, k, animation, animations, easing, duration, step, complete, makeValueCollector, currentValues, collectValue, dummy, dummyOptions;
			promise = new Promise( function( fulfil ) {
				fulfilPromise = fulfil;
			} );
			if ( typeof keypath === 'object' ) {
				options = to || {};
				easing = options.easing;
				duration = options.duration;
				animations = [];
				step = options.step;
				complete = options.complete;
				if ( step || complete ) {
					currentValues = {};
					options.step = null;
					options.complete = null;
					makeValueCollector = function( keypath ) {
						return function( t, value ) {
							currentValues[ keypath ] = value;
						};
					};
				}
				for ( k in keypath ) {
					if ( keypath.hasOwnProperty( k ) ) {
						if ( step || complete ) {
							collectValue = makeValueCollector( k );
							options = {
								easing: easing,
								duration: duration
							};
							if ( step ) {
								options.step = collectValue;
							}
						}
						options.complete = complete ? collectValue : noop;
						animations.push( animate( this, k, keypath[ k ], options ) );
					}
				}
				if ( step || complete ) {
					dummyOptions = {
						easing: easing,
						duration: duration
					};
					if ( step ) {
						dummyOptions.step = function( t ) {
							step( t, currentValues );
						};
					}
					if ( complete ) {
						promise.then( function( t ) {
							complete( t, currentValues );
						} );
					}
					dummyOptions.complete = fulfilPromise;
					dummy = animate( this, null, null, dummyOptions );
					animations.push( dummy );
				}
				return {
					stop: function() {
						var animation;
						while ( animation = animations.pop() ) {
							animation.stop();
						}
						if ( dummy ) {
							dummy.stop();
						}
					}
				};
			}
			options = options || {};
			if ( options.complete ) {
				promise.then( options.complete );
			}
			options.complete = fulfilPromise;
			animation = animate( this, keypath, to, options );
			promise.stop = function() {
				animation.stop();
			};
			return promise;
		};

		function animate( root, keypath, to, options ) {
			var easing, duration, animation, from;
			if ( keypath ) {
				keypath = normaliseKeypath( keypath );
			}
			if ( keypath !== null ) {
				from = get( root, keypath );
			}
			animations.abort( keypath, root );
			if ( isEqual( from, to ) ) {
				if ( options.complete ) {
					options.complete( options.to );
				}
				return noAnimation;
			}
			if ( options.easing ) {
				if ( typeof options.easing === 'function' ) {
					easing = options.easing;
				} else {
					easing = root.easing[ options.easing ];
				}
				if ( typeof easing !== 'function' ) {
					easing = null;
				}
			}
			duration = options.duration === undefined ? 400 : options.duration;
			animation = new Animation( {
				keypath: keypath,
				from: from,
				to: to,
				root: root,
				duration: duration,
				easing: easing,
				interpolator: options.interpolator,
				step: options.step,
				complete: options.complete
			} );
			animations.add( animation );
			root._animations.push( animation );
			return animation;
		}
	}( utils_isEqual, utils_Promise, utils_normaliseKeypath, shared_animations, shared_get__get, Ractive_prototype_animate_Animation );

	var Ractive_prototype_detach = function() {
		return this.fragment.detach();
	};

	var Ractive_prototype_find = function( selector ) {
		if ( !this.el ) {
			return null;
		}
		return this.fragment.find( selector );
	};

	var utils_matches = function( isClient, vendors, createElement ) {

		var div, methodNames, unprefixed, prefixed, i, j, makeFunction;
		if ( !isClient ) {
			return;
		}
		div = createElement( 'div' );
		methodNames = [
			'matches',
			'matchesSelector'
		];
		makeFunction = function( methodName ) {
			return function( node, selector ) {
				return node[ methodName ]( selector );
			};
		};
		i = methodNames.length;
		while ( i-- ) {
			unprefixed = methodNames[ i ];
			if ( div[ unprefixed ] ) {
				return makeFunction( unprefixed );
			}
			j = vendors.length;
			while ( j-- ) {
				prefixed = vendors[ i ] + unprefixed.substr( 0, 1 ).toUpperCase() + unprefixed.substring( 1 );
				if ( div[ prefixed ] ) {
					return makeFunction( prefixed );
				}
			}
		}
		return function( node, selector ) {
			var nodes, i;
			nodes = ( node.parentNode || node.document ).querySelectorAll( selector );
			i = nodes.length;
			while ( i-- ) {
				if ( nodes[ i ] === node ) {
					return true;
				}
			}
			return false;
		};
	}( config_isClient, config_vendors, utils_createElement );

	var Ractive_prototype_shared_makeQuery_test = function( matches ) {

		return function( item, noDirty ) {
			var itemMatches = this._isComponentQuery ? !this.selector || item.name === this.selector : matches( item.node, this.selector );
			if ( itemMatches ) {
				this.push( item.node || item.instance );
				if ( !noDirty ) {
					this._makeDirty();
				}
				return true;
			}
		};
	}( utils_matches );

	var Ractive_prototype_shared_makeQuery_cancel = function() {
		var liveQueries, selector, index;
		liveQueries = this._root[ this._isComponentQuery ? 'liveComponentQueries' : 'liveQueries' ];
		selector = this.selector;
		index = liveQueries.indexOf( selector );
		if ( index !== -1 ) {
			liveQueries.splice( index, 1 );
			liveQueries[ selector ] = null;
		}
	};

	var Ractive_prototype_shared_makeQuery_sortByItemPosition = function() {

		return function( a, b ) {
			var ancestryA, ancestryB, oldestA, oldestB, mutualAncestor, indexA, indexB, fragments, fragmentA, fragmentB;
			ancestryA = getAncestry( a.component || a._ractive.proxy );
			ancestryB = getAncestry( b.component || b._ractive.proxy );
			oldestA = ancestryA[ ancestryA.length - 1 ];
			oldestB = ancestryB[ ancestryB.length - 1 ];
			while ( oldestA && oldestA === oldestB ) {
				ancestryA.pop();
				ancestryB.pop();
				mutualAncestor = oldestA;
				oldestA = ancestryA[ ancestryA.length - 1 ];
				oldestB = ancestryB[ ancestryB.length - 1 ];
			}
			oldestA = oldestA.component || oldestA;
			oldestB = oldestB.component || oldestB;
			fragmentA = oldestA.parentFragment;
			fragmentB = oldestB.parentFragment;
			if ( fragmentA === fragmentB ) {
				indexA = fragmentA.items.indexOf( oldestA );
				indexB = fragmentB.items.indexOf( oldestB );
				return indexA - indexB || ancestryA.length - ancestryB.length;
			}
			if ( fragments = mutualAncestor.fragments ) {
				indexA = fragments.indexOf( fragmentA );
				indexB = fragments.indexOf( fragmentB );
				return indexA - indexB || ancestryA.length - ancestryB.length;
			}
			throw new Error( 'An unexpected condition was met while comparing the position of two components. Please file an issue at https://github.com/RactiveJS/Ractive/issues - thanks!' );
		};

		function getParent( item ) {
			var parentFragment;
			if ( parentFragment = item.parentFragment ) {
				return parentFragment.owner;
			}
			if ( item.component && ( parentFragment = item.component.parentFragment ) ) {
				return parentFragment.owner;
			}
		}

		function getAncestry( item ) {
			var ancestry, ancestor;
			ancestry = [ item ];
			ancestor = getParent( item );
			while ( ancestor ) {
				ancestry.push( ancestor );
				ancestor = getParent( ancestor );
			}
			return ancestry;
		}
	}();

	var Ractive_prototype_shared_makeQuery_sortByDocumentPosition = function( sortByItemPosition ) {

		return function( node, otherNode ) {
			var bitmask;
			if ( node.compareDocumentPosition ) {
				bitmask = node.compareDocumentPosition( otherNode );
				return bitmask & 2 ? 1 : -1;
			}
			return sortByItemPosition( node, otherNode );
		};
	}( Ractive_prototype_shared_makeQuery_sortByItemPosition );

	var Ractive_prototype_shared_makeQuery_sort = function( sortByDocumentPosition, sortByItemPosition ) {

		return function() {
			this.sort( this._isComponentQuery ? sortByItemPosition : sortByDocumentPosition );
			this._dirty = false;
		};
	}( Ractive_prototype_shared_makeQuery_sortByDocumentPosition, Ractive_prototype_shared_makeQuery_sortByItemPosition );

	var Ractive_prototype_shared_makeQuery_dirty = function( runloop ) {

		return function() {
			if ( !this._dirty ) {
				runloop.addLiveQuery( this );
				this._dirty = true;
			}
		};
	}( global_runloop );

	var Ractive_prototype_shared_makeQuery_remove = function( nodeOrComponent ) {
		var index = this.indexOf( this._isComponentQuery ? nodeOrComponent.instance : nodeOrComponent );
		if ( index !== -1 ) {
			this.splice( index, 1 );
		}
	};

	var Ractive_prototype_shared_makeQuery__makeQuery = function( defineProperties, test, cancel, sort, dirty, remove ) {

		return function( ractive, selector, live, isComponentQuery ) {
			var query = [];
			defineProperties( query, {
				selector: {
					value: selector
				},
				live: {
					value: live
				},
				_isComponentQuery: {
					value: isComponentQuery
				},
				_test: {
					value: test
				}
			} );
			if ( !live ) {
				return query;
			}
			defineProperties( query, {
				cancel: {
					value: cancel
				},
				_root: {
					value: ractive
				},
				_sort: {
					value: sort
				},
				_makeDirty: {
					value: dirty
				},
				_remove: {
					value: remove
				},
				_dirty: {
					value: false,
					writable: true
				}
			} );
			return query;
		};
	}( utils_defineProperties, Ractive_prototype_shared_makeQuery_test, Ractive_prototype_shared_makeQuery_cancel, Ractive_prototype_shared_makeQuery_sort, Ractive_prototype_shared_makeQuery_dirty, Ractive_prototype_shared_makeQuery_remove );

	var Ractive_prototype_findAll = function( makeQuery ) {

		return function( selector, options ) {
			var liveQueries, query;
			if ( !this.el ) {
				return [];
			}
			options = options || {};
			liveQueries = this._liveQueries;
			if ( query = liveQueries[ selector ] ) {
				return options && options.live ? query : query.slice();
			}
			query = makeQuery( this, selector, !! options.live, false );
			if ( query.live ) {
				liveQueries.push( selector );
				liveQueries[ selector ] = query;
			}
			this.fragment.findAll( selector, query );
			return query;
		};
	}( Ractive_prototype_shared_makeQuery__makeQuery );

	var Ractive_prototype_findAllComponents = function( makeQuery ) {

		return function( selector, options ) {
			var liveQueries, query;
			options = options || {};
			liveQueries = this._liveComponentQueries;
			if ( query = liveQueries[ selector ] ) {
				return options && options.live ? query : query.slice();
			}
			query = makeQuery( this, selector, !! options.live, true );
			if ( query.live ) {
				liveQueries.push( selector );
				liveQueries[ selector ] = query;
			}
			this.fragment.findAllComponents( selector, query );
			return query;
		};
	}( Ractive_prototype_shared_makeQuery__makeQuery );

	var Ractive_prototype_findComponent = function( selector ) {
		return this.fragment.findComponent( selector );
	};

	var Ractive_prototype_fire = function( eventName ) {
		var args, i, len, subscribers = this._subs[ eventName ];
		if ( !subscribers ) {
			return;
		}
		args = Array.prototype.slice.call( arguments, 1 );
		for ( i = 0, len = subscribers.length; i < len; i += 1 ) {
			subscribers[ i ].apply( this, args );
		}
	};

	var shared_get_UnresolvedImplicitDependency = function( circular, removeFromArray, runloop, notifyDependants ) {

		var get, empty = {};
		circular.push( function() {
			get = circular.get;
		} );
		var UnresolvedImplicitDependency = function( ractive, keypath ) {
			this.root = ractive;
			this.ref = keypath;
			this.parentFragment = empty;
			ractive._unresolvedImplicitDependencies[ keypath ] = true;
			ractive._unresolvedImplicitDependencies.push( this );
			runloop.addUnresolved( this );
		};
		UnresolvedImplicitDependency.prototype = {
			resolve: function() {
				var ractive = this.root;
				notifyDependants( ractive, this.ref );
				ractive._unresolvedImplicitDependencies[ this.ref ] = false;
				removeFromArray( ractive._unresolvedImplicitDependencies, this );
			},
			teardown: function() {
				runloop.removeUnresolved( this );
			}
		};
		return UnresolvedImplicitDependency;
	}( circular, utils_removeFromArray, global_runloop, shared_notifyDependants );

	var Ractive_prototype_get = function( normaliseKeypath, get, UnresolvedImplicitDependency ) {

		var options = {
			isTopLevel: true
		};
		return function Ractive_prototype_get( keypath ) {
			var value;
			keypath = normaliseKeypath( keypath );
			value = get( this, keypath, options );
			if ( this._captured && this._captured[ keypath ] !== true ) {
				this._captured.push( keypath );
				this._captured[ keypath ] = true;
				if ( value === undefined && this._unresolvedImplicitDependencies[ keypath ] !== true ) {
					new UnresolvedImplicitDependency( this, keypath );
				}
			}
			return value;
		};
	}( utils_normaliseKeypath, shared_get__get, shared_get_UnresolvedImplicitDependency );

	var utils_getElement = function( input ) {
		var output;
		if ( typeof window === 'undefined' || !document || !input ) {
			return null;
		}
		if ( input.nodeType ) {
			return input;
		}
		if ( typeof input === 'string' ) {
			output = document.getElementById( input );
			if ( !output && document.querySelector ) {
				output = document.querySelector( input );
			}
			if ( output && output.nodeType ) {
				return output;
			}
		}
		if ( input[ 0 ] && input[ 0 ].nodeType ) {
			return input[ 0 ];
		}
		return null;
	};

	var Ractive_prototype_insert = function( getElement ) {

		return function( target, anchor ) {
			target = getElement( target );
			anchor = getElement( anchor ) || null;
			if ( !target ) {
				throw new Error( 'You must specify a valid target to insert into' );
			}
			target.insertBefore( this.detach(), anchor );
			this.fragment.pNode = this.el = target;
		};
	}( utils_getElement );

	var Ractive_prototype_merge_mapOldToNewIndex = function( oldArray, newArray ) {
		var usedIndices, firstUnusedIndex, newIndices, changed;
		usedIndices = {};
		firstUnusedIndex = 0;
		newIndices = oldArray.map( function( item, i ) {
			var index, start, len;
			start = firstUnusedIndex;
			len = newArray.length;
			do {
				index = newArray.indexOf( item, start );
				if ( index === -1 ) {
					changed = true;
					return -1;
				}
				start = index + 1;
			} while ( usedIndices[ index ] && start < len );
			if ( index === firstUnusedIndex ) {
				firstUnusedIndex += 1;
			}
			if ( index !== i ) {
				changed = true;
			}
			usedIndices[ index ] = true;
			return index;
		} );
		newIndices.unchanged = !changed;
		return newIndices;
	};

	var Ractive_prototype_merge_propagateChanges = function( types, notifyDependants ) {

		return function( ractive, keypath, newIndices, lengthUnchanged ) {
			var updateDependant;
			ractive._changes.push( keypath );
			updateDependant = function( dependant ) {
				if ( dependant.type === types.REFERENCE ) {
					dependant.update();
				} else if ( dependant.keypath === keypath && dependant.type === types.SECTION && !dependant.inverted && dependant.docFrag ) {
					dependant.merge( newIndices );
				} else {
					dependant.update();
				}
			};
			ractive._deps.forEach( function( depsByKeypath ) {
				var dependants = depsByKeypath[ keypath ];
				if ( dependants ) {
					dependants.forEach( updateDependant );
				}
			} );
			if ( !lengthUnchanged ) {
				notifyDependants( ractive, keypath + '.length', true );
			}
		};
	}( config_types, shared_notifyDependants );

	var Ractive_prototype_merge__merge = function( runloop, warn, isArray, Promise, set, mapOldToNewIndex, propagateChanges ) {

		var comparators = {};
		return function merge( keypath, array, options ) {
			var currentArray, oldArray, newArray, comparator, lengthUnchanged, newIndices, promise, fulfilPromise;
			currentArray = this.get( keypath );
			if ( !isArray( currentArray ) || !isArray( array ) ) {
				return this.set( keypath, array, options && options.complete );
			}
			lengthUnchanged = currentArray.length === array.length;
			if ( options && options.compare ) {
				comparator = getComparatorFunction( options.compare );
				try {
					oldArray = currentArray.map( comparator );
					newArray = array.map( comparator );
				} catch ( err ) {
					if ( this.debug ) {
						throw err;
					} else {
						warn( 'Merge operation: comparison failed. Falling back to identity checking' );
					}
					oldArray = currentArray;
					newArray = array;
				}
			} else {
				oldArray = currentArray;
				newArray = array;
			}
			newIndices = mapOldToNewIndex( oldArray, newArray );
			promise = new Promise( function( fulfil ) {
				fulfilPromise = fulfil;
			} );
			runloop.start( this, fulfilPromise );
			set( this, keypath, array, true );
			propagateChanges( this, keypath, newIndices, lengthUnchanged );
			runloop.end();
			if ( options && options.complete ) {
				promise.then( options.complete );
			}
			return promise;
		};

		function stringify( item ) {
			return JSON.stringify( item );
		}

		function getComparatorFunction( comparator ) {
			if ( comparator === true ) {
				return stringify;
			}
			if ( typeof comparator === 'string' ) {
				if ( !comparators[ comparator ] ) {
					comparators[ comparator ] = function( item ) {
						return item[ comparator ];
					};
				}
				return comparators[ comparator ];
			}
			if ( typeof comparator === 'function' ) {
				return comparator;
			}
			throw new Error( 'The `compare` option must be a function, or a string representing an identifying field (or `true` to use JSON.stringify)' );
		}
	}( global_runloop, utils_warn, utils_isArray, utils_Promise, shared_set, Ractive_prototype_merge_mapOldToNewIndex, Ractive_prototype_merge_propagateChanges );

	var Ractive_prototype_observe_Observer = function( runloop, isEqual, get ) {

		var Observer = function( ractive, keypath, callback, options ) {
			var self = this;
			this.root = ractive;
			this.keypath = keypath;
			this.callback = callback;
			this.defer = options.defer;
			this.debug = options.debug;
			this.proxy = {
				update: function() {
					self.reallyUpdate();
				}
			};
			this.priority = 0;
			this.context = options && options.context ? options.context : ractive;
		};
		Observer.prototype = {
			init: function( immediate ) {
				if ( immediate !== false ) {
					this.update();
				} else {
					this.value = get( this.root, this.keypath );
				}
			},
			update: function() {
				if ( this.defer && this.ready ) {
					runloop.addObserver( this.proxy );
					return;
				}
				this.reallyUpdate();
			},
			reallyUpdate: function() {
				var oldValue, newValue;
				oldValue = this.value;
				newValue = get( this.root, this.keypath );
				this.value = newValue;
				if ( this.updating ) {
					return;
				}
				this.updating = true;
				if ( !isEqual( newValue, oldValue ) || !this.ready ) {
					try {
						this.callback.call( this.context, newValue, oldValue, this.keypath );
					} catch ( err ) {
						if ( this.debug || this.root.debug ) {
							throw err;
						}
					}
				}
				this.updating = false;
			}
		};
		return Observer;
	}( global_runloop, utils_isEqual, shared_get__get );

	var Ractive_prototype_observe_getPattern = function( isArray ) {

		return function( ractive, pattern ) {
			var keys, key, values, toGet, newToGet, expand, concatenate;
			keys = pattern.split( '.' );
			toGet = [];
			expand = function( keypath ) {
				var value, key;
				value = ractive._wrapped[ keypath ] ? ractive._wrapped[ keypath ].get() : ractive.get( keypath );
				for ( key in value ) {
					if ( value.hasOwnProperty( key ) && ( key !== '_ractive' || !isArray( value ) ) ) {
						newToGet.push( keypath + '.' + key );
					}
				}
			};
			concatenate = function( keypath ) {
				return keypath + '.' + key;
			};
			while ( key = keys.shift() ) {
				if ( key === '*' ) {
					newToGet = [];
					toGet.forEach( expand );
					toGet = newToGet;
				} else {
					if ( !toGet[ 0 ] ) {
						toGet[ 0 ] = key;
					} else {
						toGet = toGet.map( concatenate );
					}
				}
			}
			values = {};
			toGet.forEach( function( keypath ) {
				values[ keypath ] = ractive.get( keypath );
			} );
			return values;
		};
	}( utils_isArray );

	var Ractive_prototype_observe_PatternObserver = function( runloop, isEqual, get, getPattern ) {

		var PatternObserver, wildcard = /\*/;
		PatternObserver = function( ractive, keypath, callback, options ) {
			this.root = ractive;
			this.callback = callback;
			this.defer = options.defer;
			this.debug = options.debug;
			this.keypath = keypath;
			this.regex = new RegExp( '^' + keypath.replace( /\./g, '\\.' ).replace( /\*/g, '[^\\.]+' ) + '$' );
			this.values = {};
			if ( this.defer ) {
				this.proxies = [];
			}
			this.priority = 'pattern';
			this.context = options && options.context ? options.context : ractive;
		};
		PatternObserver.prototype = {
			init: function( immediate ) {
				var values, keypath;
				values = getPattern( this.root, this.keypath );
				if ( immediate !== false ) {
					for ( keypath in values ) {
						if ( values.hasOwnProperty( keypath ) ) {
							this.update( keypath );
						}
					}
				} else {
					this.values = values;
				}
			},
			update: function( keypath ) {
				var values;
				if ( wildcard.test( keypath ) ) {
					values = getPattern( this.root, keypath );
					for ( keypath in values ) {
						if ( values.hasOwnProperty( keypath ) ) {
							this.update( keypath );
						}
					}
					return;
				}
				if ( this.defer && this.ready ) {
					runloop.addObserver( this.getProxy( keypath ) );
					return;
				}
				this.reallyUpdate( keypath );
			},
			reallyUpdate: function( keypath ) {
				var value = get( this.root, keypath );
				if ( this.updating ) {
					this.values[ keypath ] = value;
					return;
				}
				this.updating = true;
				if ( !isEqual( value, this.values[ keypath ] ) || !this.ready ) {
					try {
						this.callback.call( this.context, value, this.values[ keypath ], keypath );
					} catch ( err ) {
						if ( this.debug || this.root.debug ) {
							throw err;
						}
					}
					this.values[ keypath ] = value;
				}
				this.updating = false;
			},
			getProxy: function( keypath ) {
				var self = this;
				if ( !this.proxies[ keypath ] ) {
					this.proxies[ keypath ] = {
						update: function() {
							self.reallyUpdate( keypath );
						}
					};
				}
				return this.proxies[ keypath ];
			}
		};
		return PatternObserver;
	}( global_runloop, utils_isEqual, shared_get__get, Ractive_prototype_observe_getPattern );

	var Ractive_prototype_observe_getObserverFacade = function( normaliseKeypath, registerDependant, unregisterDependant, Observer, PatternObserver ) {

		var wildcard = /\*/,
			emptyObject = {};
		return function getObserverFacade( ractive, keypath, callback, options ) {
			var observer, isPatternObserver;
			keypath = normaliseKeypath( keypath );
			options = options || emptyObject;
			if ( wildcard.test( keypath ) ) {
				observer = new PatternObserver( ractive, keypath, callback, options );
				ractive._patternObservers.push( observer );
				isPatternObserver = true;
			} else {
				observer = new Observer( ractive, keypath, callback, options );
			}
			registerDependant( observer );
			observer.init( options.init );
			observer.ready = true;
			return {
				cancel: function() {
					var index;
					if ( isPatternObserver ) {
						index = ractive._patternObservers.indexOf( observer );
						if ( index !== -1 ) {
							ractive._patternObservers.splice( index, 1 );
						}
					}
					unregisterDependant( observer );
				}
			};
		};
	}( utils_normaliseKeypath, shared_registerDependant, shared_unregisterDependant, Ractive_prototype_observe_Observer, Ractive_prototype_observe_PatternObserver );

	var Ractive_prototype_observe__observe = function( isObject, getObserverFacade ) {

		return function observe( keypath, callback, options ) {
			var observers, map, keypaths, i;
			if ( isObject( keypath ) ) {
				options = callback;
				map = keypath;
				observers = [];
				for ( keypath in map ) {
					if ( map.hasOwnProperty( keypath ) ) {
						callback = map[ keypath ];
						observers.push( this.observe( keypath, callback, options ) );
					}
				}
				return {
					cancel: function() {
						while ( observers.length ) {
							observers.pop().cancel();
						}
					}
				};
			}
			if ( typeof keypath === 'function' ) {
				options = callback;
				callback = keypath;
				keypath = '';
				return getObserverFacade( this, keypath, callback, options );
			}
			keypaths = keypath.split( ' ' );
			if ( keypaths.length === 1 ) {
				return getObserverFacade( this, keypath, callback, options );
			}
			observers = [];
			i = keypaths.length;
			while ( i-- ) {
				keypath = keypaths[ i ];
				if ( keypath ) {
					observers.push( getObserverFacade( this, keypath, callback, options ) );
				}
			}
			return {
				cancel: function() {
					while ( observers.length ) {
						observers.pop().cancel();
					}
				}
			};
		};
	}( utils_isObject, Ractive_prototype_observe_getObserverFacade );

	var Ractive_prototype_off = function( eventName, callback ) {
		var subscribers, index;
		if ( !callback ) {
			if ( !eventName ) {
				for ( eventName in this._subs ) {
					delete this._subs[ eventName ];
				}
			} else {
				this._subs[ eventName ] = [];
			}
		}
		subscribers = this._subs[ eventName ];
		if ( subscribers ) {
			index = subscribers.indexOf( callback );
			if ( index !== -1 ) {
				subscribers.splice( index, 1 );
			}
		}
	};

	var Ractive_prototype_on = function( eventName, callback ) {
		var self = this,
			listeners, n;
		if ( typeof eventName === 'object' ) {
			listeners = [];
			for ( n in eventName ) {
				if ( eventName.hasOwnProperty( n ) ) {
					listeners.push( this.on( n, eventName[ n ] ) );
				}
			}
			return {
				cancel: function() {
					var listener;
					while ( listener = listeners.pop() ) {
						listener.cancel();
					}
				}
			};
		}
		if ( !this._subs[ eventName ] ) {
			this._subs[ eventName ] = [ callback ];
		} else {
			this._subs[ eventName ].push( callback );
		}
		return {
			cancel: function() {
				self.off( eventName, callback );
			}
		};
	};

	var utils_create = function() {

		var create;
		try {
			Object.create( null );
			create = Object.create;
		} catch ( err ) {
			create = function() {
				var F = function() {};
				return function( proto, props ) {
					var obj;
					if ( proto === null ) {
						return {};
					}
					F.prototype = proto;
					obj = new F();
					if ( props ) {
						Object.defineProperties( obj, props );
					}
					return obj;
				};
			}();
		}
		return create;
	}();

	var render_shared_initFragment = function( types, create ) {

		return function initFragment( fragment, options ) {
			var numItems, i, parentFragment, parentRefs, ref;
			fragment.owner = options.owner;
			parentFragment = fragment.parent = fragment.owner.parentFragment;
			fragment.root = options.root;
			fragment.pNode = options.pNode;
			fragment.pElement = options.pElement;
			fragment.context = options.context;
			if ( fragment.owner.type === types.SECTION ) {
				fragment.index = options.index;
			}
			if ( parentFragment ) {
				parentRefs = parentFragment.indexRefs;
				if ( parentRefs ) {
					fragment.indexRefs = create( null );
					for ( ref in parentRefs ) {
						fragment.indexRefs[ ref ] = parentRefs[ ref ];
					}
				}
			}
			fragment.priority = parentFragment ? parentFragment.priority + 1 : 1;
			if ( options.indexRef ) {
				if ( !fragment.indexRefs ) {
					fragment.indexRefs = {};
				}
				fragment.indexRefs[ options.indexRef ] = options.index;
			}
			fragment.items = [];
			numItems = options.descriptor ? options.descriptor.length : 0;
			for ( i = 0; i < numItems; i += 1 ) {
				fragment.items[ fragment.items.length ] = fragment.createItem( {
					parentFragment: fragment,
					pElement: options.pElement,
					descriptor: options.descriptor[ i ],
					index: i
				} );
			}
		};
	}( config_types, utils_create );

	var render_DomFragment_shared_insertHtml = function( createElement ) {

		var elementCache = {}, ieBug, ieBlacklist;
		try {
			createElement( 'table' ).innerHTML = 'foo';
		} catch ( err ) {
			ieBug = true;
			ieBlacklist = {
				TABLE: [
					'<table class="x">',
					'</table>'
				],
				THEAD: [
					'<table><thead class="x">',
					'</thead></table>'
				],
				TBODY: [
					'<table><tbody class="x">',
					'</tbody></table>'
				],
				TR: [
					'<table><tr class="x">',
					'</tr></table>'
				],
				SELECT: [
					'<select class="x">',
					'</select>'
				]
			};
		}
		return function( html, tagName, docFrag ) {
			var container, nodes = [],
				wrapper;
			if ( html ) {
				if ( ieBug && ( wrapper = ieBlacklist[ tagName ] ) ) {
					container = element( 'DIV' );
					container.innerHTML = wrapper[ 0 ] + html + wrapper[ 1 ];
					container = container.querySelector( '.x' );
				} else {
					container = element( tagName );
					container.innerHTML = html;
				}
				while ( container.firstChild ) {
					nodes.push( container.firstChild );
					docFrag.appendChild( container.firstChild );
				}
			}
			return nodes;
		};

		function element( tagName ) {
			return elementCache[ tagName ] || ( elementCache[ tagName ] = createElement( tagName ) );
		}
	}( utils_createElement );

	var render_DomFragment_shared_detach = function() {
		var node = this.node,
			parentNode;
		if ( node && ( parentNode = node.parentNode ) ) {
			parentNode.removeChild( node );
			return node;
		}
	};

	var render_DomFragment_Text = function( types, detach ) {

		var DomText, lessThan, greaterThan;
		lessThan = /</g;
		greaterThan = />/g;
		DomText = function( options, docFrag ) {
			this.type = types.TEXT;
			this.descriptor = options.descriptor;
			if ( docFrag ) {
				this.node = document.createTextNode( options.descriptor );
				docFrag.appendChild( this.node );
			}
		};
		DomText.prototype = {
			detach: detach,
			teardown: function( destroy ) {
				if ( destroy ) {
					this.detach();
				}
			},
			firstNode: function() {
				return this.node;
			},
			toString: function() {
				return ( '' + this.descriptor ).replace( lessThan, '&lt;' ).replace( greaterThan, '&gt;' );
			}
		};
		return DomText;
	}( config_types, render_DomFragment_shared_detach );

	var shared_teardown = function( runloop, unregisterDependant ) {

		return function( thing ) {
			if ( !thing.keypath ) {
				runloop.removeUnresolved( thing );
			} else {
				unregisterDependant( thing );
			}
		};
	}( global_runloop, shared_unregisterDependant );

	var render_shared_Evaluator_Reference = function( types, isEqual, defineProperty, registerDependant, unregisterDependant ) {

		var Reference, thisPattern;
		thisPattern = /this/;
		Reference = function( root, keypath, evaluator, argNum, priority ) {
			var value;
			this.evaluator = evaluator;
			this.keypath = keypath;
			this.root = root;
			this.argNum = argNum;
			this.type = types.REFERENCE;
			this.priority = priority;
			value = root.get( keypath );
			if ( typeof value === 'function' ) {
				value = wrapFunction( value, root, evaluator );
			}
			this.value = evaluator.values[ argNum ] = value;
			registerDependant( this );
		};
		Reference.prototype = {
			update: function() {
				var value = this.root.get( this.keypath );
				if ( typeof value === 'function' && !value._nowrap ) {
					value = wrapFunction( value, this.root, this.evaluator );
				}
				if ( !isEqual( value, this.value ) ) {
					this.evaluator.values[ this.argNum ] = value;
					this.evaluator.bubble();
					this.value = value;
				}
			},
			teardown: function() {
				unregisterDependant( this );
			}
		};
		return Reference;

		function wrapFunction( fn, ractive, evaluator ) {
			var prop, evaluators, index;
			if ( !thisPattern.test( fn.toString() ) ) {
				defineProperty( fn, '_nowrap', {
					value: true
				} );
				return fn;
			}
			if ( !fn[ '_' + ractive._guid ] ) {
				defineProperty( fn, '_' + ractive._guid, {
					value: function() {
						var originalCaptured, result, i, evaluator;
						originalCaptured = ractive._captured;
						if ( !originalCaptured ) {
							ractive._captured = [];
						}
						result = fn.apply( ractive, arguments );
						if ( ractive._captured.length ) {
							i = evaluators.length;
							while ( i-- ) {
								evaluator = evaluators[ i ];
								evaluator.updateSoftDependencies( ractive._captured );
							}
						}
						ractive._captured = originalCaptured;
						return result;
					},
					writable: true
				} );
				for ( prop in fn ) {
					if ( fn.hasOwnProperty( prop ) ) {
						fn[ '_' + ractive._guid ][ prop ] = fn[ prop ];
					}
				}
				fn[ '_' + ractive._guid + '_evaluators' ] = [];
			}
			evaluators = fn[ '_' + ractive._guid + '_evaluators' ];
			index = evaluators.indexOf( evaluator );
			if ( index === -1 ) {
				evaluators.push( evaluator );
			}
			return fn[ '_' + ractive._guid ];
		}
	}( config_types, utils_isEqual, utils_defineProperty, shared_registerDependant, shared_unregisterDependant );

	var render_shared_Evaluator_SoftReference = function( isEqual, registerDependant, unregisterDependant ) {

		var SoftReference = function( root, keypath, evaluator ) {
			this.root = root;
			this.keypath = keypath;
			this.priority = evaluator.priority;
			this.evaluator = evaluator;
			registerDependant( this );
		};
		SoftReference.prototype = {
			update: function() {
				var value = this.root.get( this.keypath );
				if ( !isEqual( value, this.value ) ) {
					this.evaluator.bubble();
					this.value = value;
				}
			},
			teardown: function() {
				unregisterDependant( this );
			}
		};
		return SoftReference;
	}( utils_isEqual, shared_registerDependant, shared_unregisterDependant );

	var render_shared_Evaluator__Evaluator = function( runloop, warn, isEqual, clearCache, notifyDependants, adaptIfNecessary, Reference, SoftReference ) {

		var Evaluator, cache = {};
		Evaluator = function( root, keypath, uniqueString, functionStr, args, priority ) {
			var i, arg;
			this.root = root;
			this.uniqueString = uniqueString;
			this.keypath = keypath;
			this.priority = priority;
			this.fn = getFunctionFromString( functionStr, args.length );
			this.values = [];
			this.refs = [];
			i = args.length;
			while ( i-- ) {
				if ( arg = args[ i ] ) {
					if ( arg[ 0 ] ) {
						this.values[ i ] = arg[ 1 ];
					} else {
						this.refs.push( new Reference( root, arg[ 1 ], this, i, priority ) );
					}
				} else {
					this.values[ i ] = undefined;
				}
			}
			this.selfUpdating = this.refs.length <= 1;
		};
		Evaluator.prototype = {
			bubble: function() {
				if ( this.selfUpdating ) {
					this.update();
				} else if ( !this.deferred ) {
					runloop.addEvaluator( this );
					this.deferred = true;
				}
			},
			update: function() {
				var value;
				if ( this.evaluating ) {
					return this;
				}
				this.evaluating = true;
				try {
					value = this.fn.apply( null, this.values );
				} catch ( err ) {
					if ( this.root.debug ) {
						warn( 'Error evaluating "' + this.uniqueString + '": ' + err.message || err );
					}
					value = undefined;
				}
				if ( !isEqual( value, this.value ) ) {
					this.value = value;
					clearCache( this.root, this.keypath );
					adaptIfNecessary( this.root, this.keypath, value, true );
					notifyDependants( this.root, this.keypath );
				}
				this.evaluating = false;
				return this;
			},
			teardown: function() {
				while ( this.refs.length ) {
					this.refs.pop().teardown();
				}
				clearCache( this.root, this.keypath );
				this.root._evaluators[ this.keypath ] = null;
			},
			refresh: function() {
				if ( !this.selfUpdating ) {
					this.deferred = true;
				}
				var i = this.refs.length;
				while ( i-- ) {
					this.refs[ i ].update();
				}
				if ( this.deferred ) {
					this.update();
					this.deferred = false;
				}
			},
			updateSoftDependencies: function( softDeps ) {
				var i, keypath, ref;
				if ( !this.softRefs ) {
					this.softRefs = [];
				}
				i = this.softRefs.length;
				while ( i-- ) {
					ref = this.softRefs[ i ];
					if ( !softDeps[ ref.keypath ] ) {
						this.softRefs.splice( i, 1 );
						this.softRefs[ ref.keypath ] = false;
						ref.teardown();
					}
				}
				i = softDeps.length;
				while ( i-- ) {
					keypath = softDeps[ i ];
					if ( !this.softRefs[ keypath ] ) {
						ref = new SoftReference( this.root, keypath, this );
						this.softRefs.push( ref );
						this.softRefs[ keypath ] = true;
					}
				}
				this.selfUpdating = this.refs.length + this.softRefs.length <= 1;
			}
		};
		return Evaluator;

		function getFunctionFromString( str, i ) {
			var fn, args;
			str = str.replace( /\$\{([0-9]+)\}/g, '_$1' );
			if ( cache[ str ] ) {
				return cache[ str ];
			}
			args = [];
			while ( i-- ) {
				args[ i ] = '_' + i;
			}
			fn = new Function( args.join( ',' ), 'return(' + str + ')' );
			cache[ str ] = fn;
			return fn;
		}
	}( global_runloop, utils_warn, utils_isEqual, shared_clearCache, shared_notifyDependants, shared_adaptIfNecessary, render_shared_Evaluator_Reference, render_shared_Evaluator_SoftReference );

	var render_shared_ExpressionResolver_ReferenceScout = function( runloop, resolveRef, teardown ) {

		var ReferenceScout = function( resolver, ref, parentFragment, argNum ) {
			var keypath, ractive;
			ractive = this.root = resolver.root;
			this.ref = ref;
			this.parentFragment = parentFragment;
			keypath = resolveRef( ractive, ref, parentFragment );
			if ( keypath !== undefined ) {
				resolver.resolve( argNum, false, keypath );
			} else {
				this.argNum = argNum;
				this.resolver = resolver;
				runloop.addUnresolved( this );
			}
		};
		ReferenceScout.prototype = {
			resolve: function( keypath ) {
				this.keypath = keypath;
				this.resolver.resolve( this.argNum, false, keypath );
			},
			teardown: function() {
				if ( !this.keypath ) {
					teardown( this );
				}
			}
		};
		return ReferenceScout;
	}( global_runloop, shared_resolveRef, shared_teardown );

	var render_shared_ExpressionResolver_getUniqueString = function( str, args ) {
		return str.replace( /\$\{([0-9]+)\}/g, function( match, $1 ) {
			return args[ $1 ] ? args[ $1 ][ 1 ] : 'undefined';
		} );
	};

	var render_shared_ExpressionResolver_isRegularKeypath = function() {

		var keyPattern = /^(?:(?:[a-zA-Z$_][a-zA-Z$_0-9]*)|(?:[0-9]|[1-9][0-9]+))$/;
		return function( keypath ) {
			var keys, key, i;
			keys = keypath.split( '.' );
			i = keys.length;
			while ( i-- ) {
				key = keys[ i ];
				if ( key === 'undefined' || !keyPattern.test( key ) ) {
					return false;
				}
			}
			return true;
		};
	}();

	var render_shared_ExpressionResolver_getKeypath = function( normaliseKeypath, isRegularKeypath ) {

		return function( uniqueString ) {
			var normalised;
			normalised = normaliseKeypath( uniqueString );
			if ( isRegularKeypath( normalised ) ) {
				return normalised;
			}
			return '${' + normalised.replace( /[\.\[\]]/g, '-' ) + '}';
		};
	}( utils_normaliseKeypath, render_shared_ExpressionResolver_isRegularKeypath );

	var render_shared_ExpressionResolver__ExpressionResolver = function( Evaluator, ReferenceScout, getUniqueString, getKeypath ) {

		var ExpressionResolver = function( mustache ) {
			var expression, i, len, ref, indexRefs;
			this.root = mustache.root;
			this.mustache = mustache;
			this.args = [];
			this.scouts = [];
			expression = mustache.descriptor.x;
			indexRefs = mustache.parentFragment.indexRefs;
			this.str = expression.s;
			len = this.unresolved = this.args.length = expression.r ? expression.r.length : 0;
			if ( !len ) {
				this.resolved = this.ready = true;
				this.bubble();
				return;
			}
			for ( i = 0; i < len; i += 1 ) {
				ref = expression.r[ i ];
				if ( indexRefs && indexRefs[ ref ] !== undefined ) {
					this.resolve( i, true, indexRefs[ ref ] );
				} else {
					this.scouts.push( new ReferenceScout( this, ref, mustache.parentFragment, i ) );
				}
			}
			this.ready = true;
			this.bubble();
		};
		ExpressionResolver.prototype = {
			bubble: function() {
				var oldKeypath;
				if ( !this.ready ) {
					return;
				}
				oldKeypath = this.keypath;
				this.uniqueString = getUniqueString( this.str, this.args );
				this.keypath = getKeypath( this.uniqueString );
				if ( this.keypath.substr( 0, 2 ) === '${' ) {
					this.createEvaluator();
				}
				this.mustache.resolve( this.keypath );
			},
			teardown: function() {
				while ( this.scouts.length ) {
					this.scouts.pop().teardown();
				}
			},
			resolve: function( argNum, isIndexRef, value ) {
				this.args[ argNum ] = [
					isIndexRef,
					value
				];
				this.bubble();
				this.resolved = !--this.unresolved;
			},
			createEvaluator: function() {
				var evaluator;
				if ( !this.root._evaluators[ this.keypath ] ) {
					evaluator = new Evaluator( this.root, this.keypath, this.uniqueString, this.str, this.args, this.mustache.priority );
					this.root._evaluators[ this.keypath ] = evaluator;
					evaluator.update();
				} else {
					this.root._evaluators[ this.keypath ].refresh();
				}
			}
		};
		return ExpressionResolver;
	}( render_shared_Evaluator__Evaluator, render_shared_ExpressionResolver_ReferenceScout, render_shared_ExpressionResolver_getUniqueString, render_shared_ExpressionResolver_getKeypath );

	var render_shared_initMustache = function( runloop, resolveRef, ExpressionResolver ) {

		return function initMustache( mustache, options ) {
			var keypath, indexRef, parentFragment;
			parentFragment = mustache.parentFragment = options.parentFragment;
			mustache.root = parentFragment.root;
			mustache.descriptor = options.descriptor;
			mustache.index = options.index || 0;
			mustache.priority = parentFragment.priority;
			mustache.type = options.descriptor.t;
			if ( options.descriptor.r ) {
				if ( parentFragment.indexRefs && parentFragment.indexRefs[ options.descriptor.r ] !== undefined ) {
					indexRef = parentFragment.indexRefs[ options.descriptor.r ];
					mustache.indexRef = options.descriptor.r;
					mustache.value = indexRef;
					mustache.render( mustache.value );
				} else {
					keypath = resolveRef( mustache.root, options.descriptor.r, mustache.parentFragment );
					if ( keypath !== undefined ) {
						mustache.resolve( keypath );
					} else {
						mustache.ref = options.descriptor.r;
						runloop.addUnresolved( mustache );
					}
				}
			}
			if ( options.descriptor.x ) {
				mustache.expressionResolver = new ExpressionResolver( mustache );
			}
			if ( mustache.descriptor.n && !mustache.hasOwnProperty( 'value' ) ) {
				mustache.render( undefined );
			}
		};
	}( global_runloop, shared_resolveRef, render_shared_ExpressionResolver__ExpressionResolver );

	var render_DomFragment_Section_reassignFragment = function( types, ExpressionResolver ) {

		return reassignFragment;

		function reassignFragment( fragment, indexRef, newIndex, oldKeypath, newKeypath ) {
			var i, item, query;
			if ( fragment.html !== undefined ) {
				return;
			}
			assignNewKeypath( fragment, 'context', oldKeypath, newKeypath );
			if ( fragment.indexRefs && fragment.indexRefs[ indexRef ] !== undefined && fragment.indexRefs[ indexRef ] !== newIndex ) {
				fragment.indexRefs[ indexRef ] = newIndex;
			}
			i = fragment.items.length;
			while ( i-- ) {
				item = fragment.items[ i ];
				switch ( item.type ) {
					case types.ELEMENT:
						reassignElement( item, indexRef, newIndex, oldKeypath, newKeypath );
						break;
					case types.PARTIAL:
						reassignFragment( item.fragment, indexRef, newIndex, oldKeypath, newKeypath );
						break;
					case types.COMPONENT:
						reassignFragment( item.instance.fragment, indexRef, newIndex, oldKeypath, newKeypath );
						if ( query = fragment.root._liveComponentQueries[ item.name ] ) {
							query._makeDirty();
						}
						break;
					case types.SECTION:
					case types.INTERPOLATOR:
					case types.TRIPLE:
						reassignMustache( item, indexRef, newIndex, oldKeypath, newKeypath );
						break;
				}
			}
		}

		function assignNewKeypath( target, property, oldKeypath, newKeypath ) {
			if ( !target[ property ] || startsWith( target[ property ], newKeypath ) ) {
				return;
			}
			target[ property ] = getNewKeypath( target[ property ], oldKeypath, newKeypath );
		}

		function startsWith( target, keypath ) {
			return target === keypath || startsWithKeypath( target, keypath );
		}

		function startsWithKeypath( target, keypath ) {
			return target.substr( 0, keypath.length + 1 ) === keypath + '.';
		}

		function getNewKeypath( targetKeypath, oldKeypath, newKeypath ) {
			if ( targetKeypath === oldKeypath ) {
				return newKeypath;
			}
			if ( startsWithKeypath( targetKeypath, oldKeypath ) ) {
				return targetKeypath.replace( oldKeypath + '.', newKeypath + '.' );
			}
		}

		function reassignElement( element, indexRef, newIndex, oldKeypath, newKeypath ) {
			var i, attribute, storage, masterEventName, proxies, proxy, binding, bindings, liveQueries, ractive;
			i = element.attributes.length;
			while ( i-- ) {
				attribute = element.attributes[ i ];
				if ( attribute.fragment ) {
					reassignFragment( attribute.fragment, indexRef, newIndex, oldKeypath, newKeypath );
					if ( attribute.twoway ) {
						attribute.updateBindings();
					}
				}
			}
			if ( storage = element.node._ractive ) {
				assignNewKeypath( storage, 'keypath', oldKeypath, newKeypath );
				if ( indexRef != undefined ) {
					storage.index[ indexRef ] = newIndex;
				}
				for ( masterEventName in storage.events ) {
					proxies = storage.events[ masterEventName ].proxies;
					i = proxies.length;
					while ( i-- ) {
						proxy = proxies[ i ];
						if ( typeof proxy.n === 'object' ) {
							reassignFragment( proxy.a, indexRef, newIndex, oldKeypath, newKeypath );
						}
						if ( proxy.d ) {
							reassignFragment( proxy.d, indexRef, newIndex, oldKeypath, newKeypath );
						}
					}
				}
				if ( binding = storage.binding ) {
					if ( binding.keypath.substr( 0, oldKeypath.length ) === oldKeypath ) {
						bindings = storage.root._twowayBindings[ binding.keypath ];
						bindings.splice( bindings.indexOf( binding ), 1 );
						binding.keypath = binding.keypath.replace( oldKeypath, newKeypath );
						bindings = storage.root._twowayBindings[ binding.keypath ] || ( storage.root._twowayBindings[ binding.keypath ] = [] );
						bindings.push( binding );
					}
				}
			}
			if ( element.fragment ) {
				reassignFragment( element.fragment, indexRef, newIndex, oldKeypath, newKeypath );
			}
			if ( liveQueries = element.liveQueries ) {
				ractive = element.root;
				i = liveQueries.length;
				while ( i-- ) {
					liveQueries[ i ]._makeDirty();
				}
			}
		}

		function reassignMustache( mustache, indexRef, newIndex, oldKeypath, newKeypath ) {
			var updated, i;
			if ( mustache.descriptor.x ) {
				if ( mustache.expressionResolver ) {
					mustache.expressionResolver.teardown();
				}
				mustache.expressionResolver = new ExpressionResolver( mustache );
			}
			if ( mustache.keypath ) {
				updated = getNewKeypath( mustache.keypath, oldKeypath, newKeypath );
				if ( updated ) {
					mustache.resolve( updated );
				}
			} else if ( indexRef !== undefined && mustache.indexRef === indexRef ) {
				mustache.value = newIndex;
				mustache.render( newIndex );
			}
			if ( mustache.fragments ) {
				i = mustache.fragments.length;
				while ( i-- ) {
					reassignFragment( mustache.fragments[ i ], indexRef, newIndex, oldKeypath, newKeypath );
				}
			}
		}
	}( config_types, render_shared_ExpressionResolver__ExpressionResolver );

	var render_shared_resolveMustache = function( types, registerDependant, unregisterDependant, reassignFragment ) {

		return function resolveMustache( keypath ) {
			var i;
			if ( keypath === this.keypath ) {
				return;
			}
			if ( this.registered ) {
				unregisterDependant( this );
				if ( this.type === types.SECTION ) {
					i = this.fragments.length;
					while ( i-- ) {
						reassignFragment( this.fragments[ i ], null, null, this.keypath, keypath );
					}
				}
			}
			this.keypath = keypath;
			registerDependant( this );
			this.update();
			if ( this.root.twoway && this.parentFragment.owner.type === types.ATTRIBUTE ) {
				this.parentFragment.owner.element.bind();
			}
			if ( this.expressionResolver && this.expressionResolver.resolved ) {
				this.expressionResolver = null;
			}
		};
	}( config_types, shared_registerDependant, shared_unregisterDependant, render_DomFragment_Section_reassignFragment );

	var render_shared_updateMustache = function( isEqual, get ) {

		var options = {
			evaluateWrapped: true
		};
		return function updateMustache() {
			var value = get( this.root, this.keypath, options );
			if ( !isEqual( value, this.value ) ) {
				this.render( value );
				this.value = value;
			}
		};
	}( utils_isEqual, shared_get__get );

	var render_DomFragment_Interpolator = function( types, teardown, initMustache, resolveMustache, updateMustache, detach ) {

		var DomInterpolator, lessThan, greaterThan;
		lessThan = /</g;
		greaterThan = />/g;
		DomInterpolator = function( options, docFrag ) {
			this.type = types.INTERPOLATOR;
			if ( docFrag ) {
				this.node = document.createTextNode( '' );
				docFrag.appendChild( this.node );
			}
			initMustache( this, options );
		};
		DomInterpolator.prototype = {
			update: updateMustache,
			resolve: resolveMustache,
			detach: detach,
			teardown: function( destroy ) {
				if ( destroy ) {
					this.detach();
				}
				teardown( this );
			},
			render: function( value ) {
				if ( this.node ) {
					this.node.data = value == undefined ? '' : value;
				}
			},
			firstNode: function() {
				return this.node;
			},
			toString: function() {
				var value = this.value != undefined ? '' + this.value : '';
				return value.replace( lessThan, '&lt;' ).replace( greaterThan, '&gt;' );
			}
		};
		return DomInterpolator;
	}( config_types, shared_teardown, render_shared_initMustache, render_shared_resolveMustache, render_shared_updateMustache, render_DomFragment_shared_detach );

	var render_DomFragment_Section_prototype_merge = function( reassignFragment ) {

		var toTeardown = [];
		return function sectionMerge( newIndices ) {
			var section = this,
				parentFragment, firstChange, i, newLength, reassignedFragments, fragmentOptions, fragment, nextNode;
			parentFragment = this.parentFragment;
			reassignedFragments = [];
			newIndices.forEach( function reassignIfNecessary( newIndex, oldIndex ) {
				var fragment, by, oldKeypath, newKeypath;
				if ( newIndex === oldIndex ) {
					reassignedFragments[ newIndex ] = section.fragments[ oldIndex ];
					return;
				}
				if ( firstChange === undefined ) {
					firstChange = oldIndex;
				}
				if ( newIndex === -1 ) {
					toTeardown.push( section.fragments[ oldIndex ] );
					return;
				}
				fragment = section.fragments[ oldIndex ];
				by = newIndex - oldIndex;
				oldKeypath = section.keypath + '.' + oldIndex;
				newKeypath = section.keypath + '.' + newIndex;
				reassignFragment( fragment, section.descriptor.i, oldIndex, newIndex, by, oldKeypath, newKeypath );
				reassignedFragments[ newIndex ] = fragment;
			} );
			while ( fragment = toTeardown.pop() ) {
				fragment.teardown( true );
			}
			if ( firstChange === undefined ) {
				firstChange = this.length;
			}
			this.length = newLength = this.root.get( this.keypath ).length;
			if ( newLength === firstChange ) {
				return;
			}
			fragmentOptions = {
				descriptor: this.descriptor.f,
				root: this.root,
				pNode: parentFragment.pNode,
				owner: this
			};
			if ( this.descriptor.i ) {
				fragmentOptions.indexRef = this.descriptor.i;
			}
			for ( i = firstChange; i < newLength; i += 1 ) {
				if ( fragment = reassignedFragments[ i ] ) {
					this.docFrag.appendChild( fragment.detach( false ) );
				} else {
					fragmentOptions.context = this.keypath + '.' + i;
					fragmentOptions.index = i;
					fragment = this.createFragment( fragmentOptions );
				}
				this.fragments[ i ] = fragment;
			}
			nextNode = parentFragment.findNextNode( this );
			parentFragment.pNode.insertBefore( this.docFrag, nextNode );
		};
	}( render_DomFragment_Section_reassignFragment );

	var render_shared_updateSection = function( isArray, isObject ) {

		return function updateSection( section, value ) {
			var fragmentOptions = {
				descriptor: section.descriptor.f,
				root: section.root,
				pNode: section.parentFragment.pNode,
				pElement: section.parentFragment.pElement,
				owner: section
			};
			if ( section.descriptor.n ) {
				updateConditionalSection( section, value, true, fragmentOptions );
				return;
			}
			if ( isArray( value ) ) {
				updateListSection( section, value, fragmentOptions );
			} else if ( isObject( value ) || typeof value === 'function' ) {
				if ( section.descriptor.i ) {
					updateListObjectSection( section, value, fragmentOptions );
				} else {
					updateContextSection( section, fragmentOptions );
				}
			} else {
				updateConditionalSection( section, value, false, fragmentOptions );
			}
		};

		function updateListSection( section, value, fragmentOptions ) {
			var i, length, fragmentsToRemove;
			length = value.length;
			if ( length < section.length ) {
				fragmentsToRemove = section.fragments.splice( length, section.length - length );
				while ( fragmentsToRemove.length ) {
					fragmentsToRemove.pop().teardown( true );
				}
			} else {
				if ( length > section.length ) {
					for ( i = section.length; i < length; i += 1 ) {
						fragmentOptions.context = section.keypath + '.' + i;
						fragmentOptions.index = i;
						if ( section.descriptor.i ) {
							fragmentOptions.indexRef = section.descriptor.i;
						}
						section.fragments[ i ] = section.createFragment( fragmentOptions );
					}
				}
			}
			section.length = length;
		}

		function updateListObjectSection( section, value, fragmentOptions ) {
			var id, i, hasKey, fragment;
			hasKey = section.hasKey || ( section.hasKey = {} );
			i = section.fragments.length;
			while ( i-- ) {
				fragment = section.fragments[ i ];
				if ( !( fragment.index in value ) ) {
					section.fragments[ i ].teardown( true );
					section.fragments.splice( i, 1 );
					hasKey[ fragment.index ] = false;
				}
			}
			for ( id in value ) {
				if ( !hasKey[ id ] ) {
					fragmentOptions.context = section.keypath + '.' + id;
					fragmentOptions.index = id;
					if ( section.descriptor.i ) {
						fragmentOptions.indexRef = section.descriptor.i;
					}
					section.fragments.push( section.createFragment( fragmentOptions ) );
					hasKey[ id ] = true;
				}
			}
			section.length = section.fragments.length;
		}

		function updateContextSection( section, fragmentOptions ) {
			if ( !section.length ) {
				fragmentOptions.context = section.keypath;
				fragmentOptions.index = 0;
				section.fragments[ 0 ] = section.createFragment( fragmentOptions );
				section.length = 1;
			}
		}

		function updateConditionalSection( section, value, inverted, fragmentOptions ) {
			var doRender, emptyArray, fragmentsToRemove, fragment;
			emptyArray = isArray( value ) && value.length === 0;
			if ( inverted ) {
				doRender = emptyArray || !value;
			} else {
				doRender = value && !emptyArray;
			}
			if ( doRender ) {
				if ( !section.length ) {
					fragmentOptions.index = 0;
					section.fragments[ 0 ] = section.createFragment( fragmentOptions );
					section.length = 1;
				}
				if ( section.length > 1 ) {
					fragmentsToRemove = section.fragments.splice( 1 );
					while ( fragment = fragmentsToRemove.pop() ) {
						fragment.teardown( true );
					}
				}
			} else if ( section.length ) {
				section.teardownFragments( true );
				section.length = 0;
			}
		}
	}( utils_isArray, utils_isObject );

	var render_DomFragment_Section_prototype_render = function( isClient, updateSection ) {

		return function DomSection_prototype_render( value ) {
			var nextNode, wrapped;
			if ( wrapped = this.root._wrapped[ this.keypath ] ) {
				value = wrapped.get();
			}
			if ( this.rendering ) {
				return;
			}
			this.rendering = true;
			updateSection( this, value );
			this.rendering = false;
			if ( this.docFrag && !this.docFrag.childNodes.length ) {
				return;
			}
			if ( !this.initialising && isClient ) {
				nextNode = this.parentFragment.findNextNode( this );
				if ( nextNode && nextNode.parentNode === this.parentFragment.pNode ) {
					this.parentFragment.pNode.insertBefore( this.docFrag, nextNode );
				} else {
					this.parentFragment.pNode.appendChild( this.docFrag );
				}
			}
		};
	}( config_isClient, render_shared_updateSection );

	var render_DomFragment_Section_reassignFragments = function( reassignFragment ) {

		return function( section, start, end, by ) {
			if ( start + by === end ) {
				return;
			}
			if ( start === end ) {
				return;
			}
			var i, fragment, indexRef, oldIndex, newIndex, oldKeypath, newKeypath;
			indexRef = section.descriptor.i;
			for ( i = start; i < end; i += 1 ) {
				fragment = section.fragments[ i ];
				oldIndex = i - by;
				newIndex = i;
				oldKeypath = section.keypath + '.' + ( i - by );
				newKeypath = section.keypath + '.' + i;
				fragment.index += by;
				reassignFragment( fragment, indexRef, newIndex, oldKeypath, newKeypath );
			}
		};
	}( render_DomFragment_Section_reassignFragment );

	var render_DomFragment_Section_prototype_splice = function( reassignFragments ) {

		return function( spliceSummary ) {
			var section = this,
				insertionPoint, balance, i, start, end, insertStart, insertEnd, spliceArgs, fragmentOptions;
			balance = spliceSummary.balance;
			if ( !balance ) {
				return;
			}
			section.rendering = true;
			start = spliceSummary.start;
			if ( balance < 0 ) {
				end = start - balance;
				for ( i = start; i < end; i += 1 ) {
					section.fragments[ i ].teardown( true );
				}
				section.fragments.splice( start, -balance );
			} else {
				fragmentOptions = {
					descriptor: section.descriptor.f,
					root: section.root,
					pNode: section.parentFragment.pNode,
					owner: section
				};
				if ( section.descriptor.i ) {
					fragmentOptions.indexRef = section.descriptor.i;
				}
				insertStart = start + spliceSummary.removed;
				insertEnd = start + spliceSummary.added;
				insertionPoint = section.fragments[ insertStart ] ? section.fragments[ insertStart ].firstNode() : section.parentFragment.findNextNode( section );
				spliceArgs = [
					insertStart,
					0
				].concat( new Array( balance ) );
				section.fragments.splice.apply( section.fragments, spliceArgs );
				for ( i = insertStart; i < insertEnd; i += 1 ) {
					fragmentOptions.context = section.keypath + '.' + i;
					fragmentOptions.index = i;
					section.fragments[ i ] = section.createFragment( fragmentOptions );
				}
				section.parentFragment.pNode.insertBefore( section.docFrag, insertionPoint );
			}
			section.length += balance;
			reassignFragments( section, start, section.length, balance );
			section.rendering = false;
		};
	}( render_DomFragment_Section_reassignFragments );

	var render_DomFragment_Section__Section = function( types, initMustache, updateMustache, resolveMustache, merge, render, splice, teardown, circular ) {

		var DomSection, DomFragment;
		circular.push( function() {
			DomFragment = circular.DomFragment;
		} );
		DomSection = function( options, docFrag ) {
			this.type = types.SECTION;
			this.inverted = !! options.descriptor.n;
			this.fragments = [];
			this.length = 0;
			if ( docFrag ) {
				this.docFrag = document.createDocumentFragment();
			}
			this.initialising = true;
			initMustache( this, options );
			if ( docFrag ) {
				docFrag.appendChild( this.docFrag );
			}
			this.initialising = false;
		};
		DomSection.prototype = {
			update: updateMustache,
			resolve: resolveMustache,
			splice: splice,
			merge: merge,
			detach: function() {
				var i, len;
				if ( this.docFrag ) {
					len = this.fragments.length;
					for ( i = 0; i < len; i += 1 ) {
						this.docFrag.appendChild( this.fragments[ i ].detach() );
					}
					return this.docFrag;
				}
			},
			teardown: function( destroy ) {
				this.teardownFragments( destroy );
				teardown( this );
			},
			firstNode: function() {
				if ( this.fragments[ 0 ] ) {
					return this.fragments[ 0 ].firstNode();
				}
				return this.parentFragment.findNextNode( this );
			},
			findNextNode: function( fragment ) {
				if ( this.fragments[ fragment.index + 1 ] ) {
					return this.fragments[ fragment.index + 1 ].firstNode();
				}
				return this.parentFragment.findNextNode( this );
			},
			teardownFragments: function( destroy ) {
				var fragment;
				while ( fragment = this.fragments.shift() ) {
					fragment.teardown( destroy );
				}
			},
			render: render,
			createFragment: function( options ) {
				var fragment = new DomFragment( options );
				if ( this.docFrag ) {
					this.docFrag.appendChild( fragment.docFrag );
				}
				return fragment;
			},
			toString: function() {
				var str, i, len;
				str = '';
				i = 0;
				len = this.length;
				for ( i = 0; i < len; i += 1 ) {
					str += this.fragments[ i ].toString();
				}
				return str;
			},
			find: function( selector ) {
				var i, len, queryResult;
				len = this.fragments.length;
				for ( i = 0; i < len; i += 1 ) {
					if ( queryResult = this.fragments[ i ].find( selector ) ) {
						return queryResult;
					}
				}
				return null;
			},
			findAll: function( selector, query ) {
				var i, len;
				len = this.fragments.length;
				for ( i = 0; i < len; i += 1 ) {
					this.fragments[ i ].findAll( selector, query );
				}
			},
			findComponent: function( selector ) {
				var i, len, queryResult;
				len = this.fragments.length;
				for ( i = 0; i < len; i += 1 ) {
					if ( queryResult = this.fragments[ i ].findComponent( selector ) ) {
						return queryResult;
					}
				}
				return null;
			},
			findAllComponents: function( selector, query ) {
				var i, len;
				len = this.fragments.length;
				for ( i = 0; i < len; i += 1 ) {
					this.fragments[ i ].findAllComponents( selector, query );
				}
			}
		};
		return DomSection;
	}( config_types, render_shared_initMustache, render_shared_updateMustache, render_shared_resolveMustache, render_DomFragment_Section_prototype_merge, render_DomFragment_Section_prototype_render, render_DomFragment_Section_prototype_splice, shared_teardown, circular );

	var render_DomFragment_Triple = function( types, matches, initMustache, updateMustache, resolveMustache, insertHtml, teardown ) {

		var DomTriple = function( options, docFrag ) {
			this.type = types.TRIPLE;
			if ( docFrag ) {
				this.nodes = [];
				this.docFrag = document.createDocumentFragment();
			}
			this.initialising = true;
			initMustache( this, options );
			if ( docFrag ) {
				docFrag.appendChild( this.docFrag );
			}
			this.initialising = false;
		};
		DomTriple.prototype = {
			update: updateMustache,
			resolve: resolveMustache,
			detach: function() {
				var len, i;
				if ( this.docFrag ) {
					len = this.nodes.length;
					for ( i = 0; i < len; i += 1 ) {
						this.docFrag.appendChild( this.nodes[ i ] );
					}
					return this.docFrag;
				}
			},
			teardown: function( destroy ) {
				if ( destroy ) {
					this.detach();
					this.docFrag = this.nodes = null;
				}
				teardown( this );
			},
			firstNode: function() {
				if ( this.nodes[ 0 ] ) {
					return this.nodes[ 0 ];
				}
				return this.parentFragment.findNextNode( this );
			},
			render: function( html ) {
				var node, pNode;
				if ( !this.nodes ) {
					return;
				}
				while ( this.nodes.length ) {
					node = this.nodes.pop();
					node.parentNode.removeChild( node );
				}
				if ( !html ) {
					this.nodes = [];
					return;
				}
				pNode = this.parentFragment.pNode;
				this.nodes = insertHtml( html, pNode.tagName, this.docFrag );
				if ( !this.initialising ) {
					pNode.insertBefore( this.docFrag, this.parentFragment.findNextNode( this ) );
				}
				if ( pNode.tagName === 'SELECT' && pNode._ractive && pNode._ractive.binding ) {
					pNode._ractive.binding.update();
				}
			},
			toString: function() {
				return this.value != undefined ? this.value : '';
			},
			find: function( selector ) {
				var i, len, node, queryResult;
				len = this.nodes.length;
				for ( i = 0; i < len; i += 1 ) {
					node = this.nodes[ i ];
					if ( node.nodeType !== 1 ) {
						continue;
					}
					if ( matches( node, selector ) ) {
						return node;
					}
					if ( queryResult = node.querySelector( selector ) ) {
						return queryResult;
					}
				}
				return null;
			},
			findAll: function( selector, queryResult ) {
				var i, len, node, queryAllResult, numNodes, j;
				len = this.nodes.length;
				for ( i = 0; i < len; i += 1 ) {
					node = this.nodes[ i ];
					if ( node.nodeType !== 1 ) {
						continue;
					}
					if ( matches( node, selector ) ) {
						queryResult.push( node );
					}
					if ( queryAllResult = node.querySelectorAll( selector ) ) {
						numNodes = queryAllResult.length;
						for ( j = 0; j < numNodes; j += 1 ) {
							queryResult.push( queryAllResult[ j ] );
						}
					}
				}
			}
		};
		return DomTriple;
	}( config_types, utils_matches, render_shared_initMustache, render_shared_updateMustache, render_shared_resolveMustache, render_DomFragment_shared_insertHtml, shared_teardown );

	var render_DomFragment_Element_initialise_getElementNamespace = function( namespaces ) {

		return function( descriptor, parentNode ) {
			if ( descriptor.a && descriptor.a.xmlns ) {
				return descriptor.a.xmlns;
			}
			return descriptor.e === 'svg' ? namespaces.svg : parentNode.namespaceURI || namespaces.html;
		};
	}( config_namespaces );

	var render_DomFragment_shared_enforceCase = function() {

		var svgCamelCaseElements, svgCamelCaseAttributes, createMap, map;
		svgCamelCaseElements = 'altGlyph altGlyphDef altGlyphItem animateColor animateMotion animateTransform clipPath feBlend feColorMatrix feComponentTransfer feComposite feConvolveMatrix feDiffuseLighting feDisplacementMap feDistantLight feFlood feFuncA feFuncB feFuncG feFuncR feGaussianBlur feImage feMerge feMergeNode feMorphology feOffset fePointLight feSpecularLighting feSpotLight feTile feTurbulence foreignObject glyphRef linearGradient radialGradient textPath vkern'.split( ' ' );
		svgCamelCaseAttributes = 'attributeName attributeType baseFrequency baseProfile calcMode clipPathUnits contentScriptType contentStyleType diffuseConstant edgeMode externalResourcesRequired filterRes filterUnits glyphRef gradientTransform gradientUnits kernelMatrix kernelUnitLength keyPoints keySplines keyTimes lengthAdjust limitingConeAngle markerHeight markerUnits markerWidth maskContentUnits maskUnits numOctaves pathLength patternContentUnits patternTransform patternUnits pointsAtX pointsAtY pointsAtZ preserveAlpha preserveAspectRatio primitiveUnits refX refY repeatCount repeatDur requiredExtensions requiredFeatures specularConstant specularExponent spreadMethod startOffset stdDeviation stitchTiles surfaceScale systemLanguage tableValues targetX targetY textLength viewBox viewTarget xChannelSelector yChannelSelector zoomAndPan'.split( ' ' );
		createMap = function( items ) {
			var map = {}, i = items.length;
			while ( i-- ) {
				map[ items[ i ].toLowerCase() ] = items[ i ];
			}
			return map;
		};
		map = createMap( svgCamelCaseElements.concat( svgCamelCaseAttributes ) );
		return function( elementName ) {
			var lowerCaseElementName = elementName.toLowerCase();
			return map[ lowerCaseElementName ] || lowerCaseElementName;
		};
	}();

	var render_DomFragment_Attribute_helpers_determineNameAndNamespace = function( namespaces, enforceCase ) {

		return function( attribute, name ) {
			var colonIndex, namespacePrefix;
			colonIndex = name.indexOf( ':' );
			if ( colonIndex !== -1 ) {
				namespacePrefix = name.substr( 0, colonIndex );
				if ( namespacePrefix !== 'xmlns' ) {
					name = name.substring( colonIndex + 1 );
					attribute.name = enforceCase( name );
					attribute.lcName = attribute.name.toLowerCase();
					attribute.namespace = namespaces[ namespacePrefix.toLowerCase() ];
					if ( !attribute.namespace ) {
						throw 'Unknown namespace ("' + namespacePrefix + '")';
					}
					return;
				}
			}
			attribute.name = attribute.element.namespace !== namespaces.html ? enforceCase( name ) : name;
			attribute.lcName = attribute.name.toLowerCase();
		};
	}( config_namespaces, render_DomFragment_shared_enforceCase );

	var render_DomFragment_Attribute_helpers_setStaticAttribute = function( namespaces ) {

		return function setStaticAttribute( attribute, options ) {
			var node, value = options.value === null ? '' : options.value;
			if ( node = options.pNode ) {
				if ( attribute.namespace ) {
					node.setAttributeNS( attribute.namespace, options.name, value );
				} else {
					if ( options.name === 'style' && node.style.setAttribute ) {
						node.style.setAttribute( 'cssText', value );
					} else if ( options.name === 'class' && ( !node.namespaceURI || node.namespaceURI === namespaces.html ) ) {
						node.className = value;
					} else {
						node.setAttribute( options.name, value );
					}
				}
				if ( attribute.name === 'id' ) {
					options.root.nodes[ options.value ] = node;
				}
				if ( attribute.name === 'value' ) {
					node._ractive.value = options.value;
				}
			}
			attribute.value = options.value;
		};
	}( config_namespaces );

	var render_DomFragment_Attribute_helpers_determinePropertyName = function( namespaces ) {

		var propertyNames = {
			'accept-charset': 'acceptCharset',
			accesskey: 'accessKey',
			bgcolor: 'bgColor',
			'class': 'className',
			codebase: 'codeBase',
			colspan: 'colSpan',
			contenteditable: 'contentEditable',
			datetime: 'dateTime',
			dirname: 'dirName',
			'for': 'htmlFor',
			'http-equiv': 'httpEquiv',
			ismap: 'isMap',
			maxlength: 'maxLength',
			novalidate: 'noValidate',
			pubdate: 'pubDate',
			readonly: 'readOnly',
			rowspan: 'rowSpan',
			tabindex: 'tabIndex',
			usemap: 'useMap'
		};
		return function( attribute, options ) {
			var propertyName;
			if ( attribute.pNode && !attribute.namespace && ( !options.pNode.namespaceURI || options.pNode.namespaceURI === namespaces.html ) ) {
				propertyName = propertyNames[ attribute.name ] || attribute.name;
				if ( options.pNode[ propertyName ] !== undefined ) {
					attribute.propertyName = propertyName;
				}
				if ( typeof options.pNode[ propertyName ] === 'boolean' || propertyName === 'value' ) {
					attribute.useProperty = true;
				}
			}
		};
	}( config_namespaces );

	var render_DomFragment_Attribute_helpers_getInterpolator = function( types ) {

		return function getInterpolator( attribute ) {
			var items, item;
			items = attribute.fragment.items;
			if ( items.length !== 1 ) {
				return;
			}
			item = items[ 0 ];
			if ( item.type !== types.INTERPOLATOR || !item.keypath && !item.ref ) {
				return;
			}
			return item;
		};
	}( config_types );

	var utils_arrayContentsMatch = function( isArray ) {

		return function( a, b ) {
			var i;
			if ( !isArray( a ) || !isArray( b ) ) {
				return false;
			}
			if ( a.length !== b.length ) {
				return false;
			}
			i = a.length;
			while ( i-- ) {
				if ( a[ i ] !== b[ i ] ) {
					return false;
				}
			}
			return true;
		};
	}( utils_isArray );

	var render_DomFragment_Attribute_prototype_bind = function( runloop, warn, arrayContentsMatch, getValueFromCheckboxes, get, set ) {

		var singleMustacheError = 'For two-way binding to work, attribute value must be a single interpolator (e.g. value="{{foo}}")',
			expressionError = 'You cannot set up two-way binding against an expression ',
			bindAttribute, updateModel, getOptions, update, getBinding, inheritProperties, MultipleSelectBinding, SelectBinding, RadioNameBinding, CheckboxNameBinding, CheckedBinding, FileListBinding, ContentEditableBinding, GenericBinding;
		bindAttribute = function() {
			var node = this.pNode,
				interpolator, binding, bindings;
			interpolator = this.interpolator;
			if ( !interpolator ) {
				warn( singleMustacheError );
				return false;
			}
			if ( interpolator.keypath && interpolator.keypath.substr === '${' ) {
				warn( expressionError + interpolator.keypath );
				return false;
			}
			if ( !interpolator.keypath ) {
				interpolator.resolve( interpolator.descriptor.r );
			}
			this.keypath = interpolator.keypath;
			binding = getBinding( this );
			if ( !binding ) {
				return false;
			}
			node._ractive.binding = this.element.binding = binding;
			this.twoway = true;
			bindings = this.root._twowayBindings[ this.keypath ] || ( this.root._twowayBindings[ this.keypath ] = [] );
			bindings.push( binding );
			return true;
		};
		updateModel = function() {
			runloop.start( this._ractive.root );
			this._ractive.binding.update();
			runloop.end();
		};
		getOptions = {
			evaluateWrapped: true
		};
		update = function() {
			var value = get( this._ractive.root, this._ractive.binding.keypath, getOptions );
			this.value = value == undefined ? '' : value;
		};
		getBinding = function( attribute ) {
			var node = attribute.pNode;
			if ( node.tagName === 'SELECT' ) {
				return node.multiple ? new MultipleSelectBinding( attribute, node ) : new SelectBinding( attribute, node );
			}
			if ( node.type === 'checkbox' || node.type === 'radio' ) {
				if ( attribute.propertyName === 'name' ) {
					if ( node.type === 'checkbox' ) {
						return new CheckboxNameBinding( attribute, node );
					}
					if ( node.type === 'radio' ) {
						return new RadioNameBinding( attribute, node );
					}
				}
				if ( attribute.propertyName === 'checked' ) {
					return new CheckedBinding( attribute, node );
				}
				return null;
			}
			if ( attribute.lcName !== 'value' ) {
				throw new Error( 'Attempted to set up an illegal two-way binding. This error is unexpected - if you can, please file an issue at https://github.com/RactiveJS/Ractive, or contact @RactiveJS on Twitter. Thanks!' );
			}
			if ( node.type === 'file' ) {
				return new FileListBinding( attribute, node );
			}
			if ( node.getAttribute( 'contenteditable' ) ) {
				return new ContentEditableBinding( attribute, node );
			}
			return new GenericBinding( attribute, node );
		};
		MultipleSelectBinding = function( attribute, node ) {
			var valueFromModel;
			inheritProperties( this, attribute, node );
			node.addEventListener( 'change', updateModel, false );
			valueFromModel = get( this.root, this.keypath );
			if ( valueFromModel === undefined ) {
				this.update();
			}
		};
		MultipleSelectBinding.prototype = {
			value: function() {
				var selectedValues, options, i, len, option, optionValue;
				selectedValues = [];
				options = this.node.options;
				len = options.length;
				for ( i = 0; i < len; i += 1 ) {
					option = options[ i ];
					if ( option.selected ) {
						optionValue = option._ractive ? option._ractive.value : option.value;
						selectedValues.push( optionValue );
					}
				}
				return selectedValues;
			},
			update: function() {
				var attribute, previousValue, value;
				attribute = this.attr;
				previousValue = attribute.value;
				value = this.value();
				if ( previousValue === undefined || !arrayContentsMatch( value, previousValue ) ) {
					attribute.receiving = true;
					attribute.value = value;
					set( this.root, this.keypath, value );
					runloop.trigger();
					attribute.receiving = false;
				}
				return this;
			},
			deferUpdate: function() {
				if ( this.deferred === true ) {
					return;
				}
				runloop.addAttribute( this );
				this.deferred = true;
			},
			teardown: function() {
				this.node.removeEventListener( 'change', updateModel, false );
			}
		};
		SelectBinding = function( attribute, node ) {
			var valueFromModel;
			inheritProperties( this, attribute, node );
			node.addEventListener( 'change', updateModel, false );
			valueFromModel = get( this.root, this.keypath );
			if ( valueFromModel === undefined ) {
				this.update();
			}
		};
		SelectBinding.prototype = {
			value: function() {
				var options, i, len, option, optionValue;
				options = this.node.options;
				len = options.length;
				for ( i = 0; i < len; i += 1 ) {
					option = options[ i ];
					if ( options[ i ].selected ) {
						optionValue = option._ractive ? option._ractive.value : option.value;
						return optionValue;
					}
				}
			},
			update: function() {
				var value = this.value();
				this.attr.receiving = true;
				this.attr.value = value;
				set( this.root, this.keypath, value );
				runloop.trigger();
				this.attr.receiving = false;
				return this;
			},
			deferUpdate: function() {
				if ( this.deferred === true ) {
					return;
				}
				runloop.addAttribute( this );
				this.deferred = true;
			},
			teardown: function() {
				this.node.removeEventListener( 'change', updateModel, false );
			}
		};
		RadioNameBinding = function( attribute, node ) {
			var valueFromModel;
			this.radioName = true;
			inheritProperties( this, attribute, node );
			node.name = '{{' + attribute.keypath + '}}';
			node.addEventListener( 'change', updateModel, false );
			if ( node.attachEvent ) {
				node.addEventListener( 'click', updateModel, false );
			}
			valueFromModel = get( this.root, this.keypath );
			if ( valueFromModel !== undefined ) {
				node.checked = valueFromModel == node._ractive.value;
			} else {
				runloop.addRadio( this );
			}
		};
		RadioNameBinding.prototype = {
			value: function() {
				return this.node._ractive ? this.node._ractive.value : this.node.value;
			},
			update: function() {
				var node = this.node;
				if ( node.checked ) {
					this.attr.receiving = true;
					set( this.root, this.keypath, this.value() );
					runloop.trigger();
					this.attr.receiving = false;
				}
			},
			teardown: function() {
				this.node.removeEventListener( 'change', updateModel, false );
				this.node.removeEventListener( 'click', updateModel, false );
			}
		};
		CheckboxNameBinding = function( attribute, node ) {
			var valueFromModel, checked;
			this.checkboxName = true;
			inheritProperties( this, attribute, node );
			node.name = '{{' + this.keypath + '}}';
			node.addEventListener( 'change', updateModel, false );
			if ( node.attachEvent ) {
				node.addEventListener( 'click', updateModel, false );
			}
			valueFromModel = get( this.root, this.keypath );
			if ( valueFromModel !== undefined ) {
				checked = valueFromModel.indexOf( node._ractive.value ) !== -1;
				node.checked = checked;
			} else {
				runloop.addCheckbox( this );
			}
		};
		CheckboxNameBinding.prototype = {
			changed: function() {
				return this.node.checked !== !! this.checked;
			},
			update: function() {
				this.checked = this.node.checked;
				this.attr.receiving = true;
				set( this.root, this.keypath, getValueFromCheckboxes( this.root, this.keypath ) );
				runloop.trigger();
				this.attr.receiving = false;
			},
			teardown: function() {
				this.node.removeEventListener( 'change', updateModel, false );
				this.node.removeEventListener( 'click', updateModel, false );
			}
		};
		CheckedBinding = function( attribute, node ) {
			inheritProperties( this, attribute, node );
			node.addEventListener( 'change', updateModel, false );
			if ( node.attachEvent ) {
				node.addEventListener( 'click', updateModel, false );
			}
		};
		CheckedBinding.prototype = {
			value: function() {
				return this.node.checked;
			},
			update: function() {
				this.attr.receiving = true;
				set( this.root, this.keypath, this.value() );
				runloop.trigger();
				this.attr.receiving = false;
			},
			teardown: function() {
				this.node.removeEventListener( 'change', updateModel, false );
				this.node.removeEventListener( 'click', updateModel, false );
			}
		};
		FileListBinding = function( attribute, node ) {
			inheritProperties( this, attribute, node );
			node.addEventListener( 'change', updateModel, false );
		};
		FileListBinding.prototype = {
			value: function() {
				return this.attr.pNode.files;
			},
			update: function() {
				set( this.attr.root, this.attr.keypath, this.value() );
				runloop.trigger();
			},
			teardown: function() {
				this.node.removeEventListener( 'change', updateModel, false );
			}
		};
		ContentEditableBinding = function( attribute, node ) {
			inheritProperties( this, attribute, node );
			node.addEventListener( 'change', updateModel, false );
			if ( !this.root.lazy ) {
				node.addEventListener( 'input', updateModel, false );
				if ( node.attachEvent ) {
					node.addEventListener( 'keyup', updateModel, false );
				}
			}
		};
		ContentEditableBinding.prototype = {
			update: function() {
				this.attr.receiving = true;
				set( this.root, this.keypath, this.node.innerHTML );
				runloop.trigger();
				this.attr.receiving = false;
			},
			teardown: function() {
				this.node.removeEventListener( 'change', updateModel, false );
				this.node.removeEventListener( 'input', updateModel, false );
				this.node.removeEventListener( 'keyup', updateModel, false );
			}
		};
		GenericBinding = function( attribute, node ) {
			inheritProperties( this, attribute, node );
			node.addEventListener( 'change', updateModel, false );
			if ( !this.root.lazy ) {
				node.addEventListener( 'input', updateModel, false );
				if ( node.attachEvent ) {
					node.addEventListener( 'keyup', updateModel, false );
				}
			}
			this.node.addEventListener( 'blur', update, false );
		};
		GenericBinding.prototype = {
			value: function() {
				var value = this.attr.pNode.value;
				if ( +value + '' === value && value.indexOf( 'e' ) === -1 ) {
					value = +value;
				}
				return value;
			},
			update: function() {
				var attribute = this.attr,
					value = this.value();
				attribute.receiving = true;
				set( attribute.root, attribute.keypath, value );
				runloop.trigger();
				attribute.receiving = false;
			},
			teardown: function() {
				this.node.removeEventListener( 'change', updateModel, false );
				this.node.removeEventListener( 'input', updateModel, false );
				this.node.removeEventListener( 'keyup', updateModel, false );
				this.node.removeEventListener( 'blur', update, false );
			}
		};
		inheritProperties = function( binding, attribute, node ) {
			binding.attr = attribute;
			binding.node = node;
			binding.root = attribute.root;
			binding.keypath = attribute.keypath;
		};
		return bindAttribute;
	}( global_runloop, utils_warn, utils_arrayContentsMatch, shared_getValueFromCheckboxes, shared_get__get, shared_set );

	var render_DomFragment_Attribute_prototype_update = function( runloop, namespaces, isArray ) {

		var updateAttribute, updateFileInputValue, deferSelect, initSelect, updateSelect, updateMultipleSelect, updateRadioName, updateCheckboxName, updateIEStyleAttribute, updateClassName, updateContentEditableValue, updateEverythingElse;
		updateAttribute = function() {
			var node;
			if ( !this.ready ) {
				return this;
			}
			node = this.pNode;
			if ( node.tagName === 'SELECT' && this.lcName === 'value' ) {
				this.update = deferSelect;
				this.deferredUpdate = initSelect;
				return this.update();
			}
			if ( this.isFileInputValue ) {
				this.update = updateFileInputValue;
				return this;
			}
			if ( this.twoway && this.lcName === 'name' ) {
				if ( node.type === 'radio' ) {
					this.update = updateRadioName;
					return this.update();
				}
				if ( node.type === 'checkbox' ) {
					this.update = updateCheckboxName;
					return this.update();
				}
			}
			if ( this.lcName === 'style' && node.style.setAttribute ) {
				this.update = updateIEStyleAttribute;
				return this.update();
			}
			if ( this.lcName === 'class' && ( !node.namespaceURI || node.namespaceURI === namespaces.html ) ) {
				this.update = updateClassName;
				return this.update();
			}
			if ( node.getAttribute( 'contenteditable' ) && this.lcName === 'value' ) {
				this.update = updateContentEditableValue;
				return this.update();
			}
			this.update = updateEverythingElse;
			return this.update();
		};
		updateFileInputValue = function() {
			return this;
		};
		initSelect = function() {
			this.deferredUpdate = this.pNode.multiple ? updateMultipleSelect : updateSelect;
			this.deferredUpdate();
		};
		deferSelect = function() {
			runloop.addSelectValue( this );
			return this;
		};
		updateSelect = function() {
			var value = this.fragment.getValue(),
				options, option, optionValue, i;
			this.value = this.pNode._ractive.value = value;
			options = this.pNode.options;
			i = options.length;
			while ( i-- ) {
				option = options[ i ];
				optionValue = option._ractive ? option._ractive.value : option.value;
				if ( optionValue == value ) {
					option.selected = true;
					return this;
				}
			}
			return this;
		};
		updateMultipleSelect = function() {
			var value = this.fragment.getValue(),
				options, i, option, optionValue;
			if ( !isArray( value ) ) {
				value = [ value ];
			}
			options = this.pNode.options;
			i = options.length;
			while ( i-- ) {
				option = options[ i ];
				optionValue = option._ractive ? option._ractive.value : option.value;
				option.selected = value.indexOf( optionValue ) !== -1;
			}
			this.value = value;
			return this;
		};
		updateRadioName = function() {
			var node, value;
			node = this.pNode;
			value = this.fragment.getValue();
			node.checked = value == node._ractive.value;
			return this;
		};
		updateCheckboxName = function() {
			var node, value;
			node = this.pNode;
			value = this.fragment.getValue();
			if ( !isArray( value ) ) {
				node.checked = value == node._ractive.value;
				return this;
			}
			node.checked = value.indexOf( node._ractive.value ) !== -1;
			return this;
		};
		updateIEStyleAttribute = function() {
			var node, value;
			node = this.pNode;
			value = this.fragment.getValue();
			if ( value === undefined ) {
				value = '';
			}
			if ( value !== this.value ) {
				node.style.setAttribute( 'cssText', value );
				this.value = value;
			}
			return this;
		};
		updateClassName = function() {
			var node, value;
			node = this.pNode;
			value = this.fragment.getValue();
			if ( value === undefined ) {
				value = '';
			}
			if ( value !== this.value ) {
				node.className = value;
				this.value = value;
			}
			return this;
		};
		updateContentEditableValue = function() {
			var node, value;
			node = this.pNode;
			value = this.fragment.getValue();
			if ( value === undefined ) {
				value = '';
			}
			if ( value !== this.value ) {
				if ( !this.receiving ) {
					node.innerHTML = value;
				}
				this.value = value;
			}
			return this;
		};
		updateEverythingElse = function() {
			var node, value;
			node = this.pNode;
			value = this.fragment.getValue();
			if ( this.isValueAttribute ) {
				node._ractive.value = value;
			}
			if ( value == undefined ) {
				value = '';
			}
			if ( value !== this.value ) {
				if ( this.useProperty ) {
					if ( !this.receiving ) {
						node[ this.propertyName ] = value;
					}
					this.value = value;
					return this;
				}
				if ( this.namespace ) {
					node.setAttributeNS( this.namespace, this.name, value );
					this.value = value;
					return this;
				}
				if ( this.lcName === 'id' ) {
					if ( this.value !== undefined ) {
						this.root.nodes[ this.value ] = undefined;
					}
					this.root.nodes[ value ] = node;
				}
				node.setAttribute( this.name, value );
				this.value = value;
			}
			return this;
		};
		return updateAttribute;
	}( global_runloop, config_namespaces, utils_isArray );

	var parse_Tokenizer_utils_getStringMatch = function( string ) {
		var substr;
		substr = this.str.substr( this.pos, string.length );
		if ( substr === string ) {
			this.pos += string.length;
			return string;
		}
		return null;
	};

	var parse_Tokenizer_utils_allowWhitespace = function() {

		var leadingWhitespace = /^\s+/;
		return function() {
			var match = leadingWhitespace.exec( this.remaining() );
			if ( !match ) {
				return null;
			}
			this.pos += match[ 0 ].length;
			return match[ 0 ];
		};
	}();

	var parse_Tokenizer_utils_makeRegexMatcher = function( regex ) {
		return function( tokenizer ) {
			var match = regex.exec( tokenizer.str.substring( tokenizer.pos ) );
			if ( !match ) {
				return null;
			}
			tokenizer.pos += match[ 0 ].length;
			return match[ 1 ] || match[ 0 ];
		};
	};

	var parse_Tokenizer_getExpression_getPrimary_getLiteral_getStringLiteral_makeQuotedStringMatcher = function( makeRegexMatcher ) {

		var getStringMiddle, getEscapeSequence, getLineContinuation;
		getStringMiddle = makeRegexMatcher( /^(?=.)[^"'\\]+?(?:(?!.)|(?=["'\\]))/ );
		getEscapeSequence = makeRegexMatcher( /^\\(?:['"\\bfnrt]|0(?![0-9])|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|(?=.)[^ux0-9])/ );
		getLineContinuation = makeRegexMatcher( /^\\(?:\r\n|[\u000A\u000D\u2028\u2029])/ );
		return function( quote, okQuote ) {
			return function( tokenizer ) {
				var start, literal, done, next;
				start = tokenizer.pos;
				literal = '"';
				done = false;
				while ( !done ) {
					next = getStringMiddle( tokenizer ) || getEscapeSequence( tokenizer ) || tokenizer.getStringMatch( okQuote );
					if ( next ) {
						if ( next === '"' ) {
							literal += '\\"';
						} else if ( next === '\\\'' ) {
							literal += '\'';
						} else {
							literal += next;
						}
					} else {
						next = getLineContinuation( tokenizer );
						if ( next ) {
							literal += '\\u' + ( '000' + next.charCodeAt( 1 ).toString( 16 ) ).slice( -4 );
						} else {
							done = true;
						}
					}
				}
				literal += '"';
				return JSON.parse( literal );
			};
		};
	}( parse_Tokenizer_utils_makeRegexMatcher );

	var parse_Tokenizer_getExpression_getPrimary_getLiteral_getStringLiteral_getSingleQuotedString = function( makeQuotedStringMatcher ) {

		return makeQuotedStringMatcher( '\'', '"' );
	}( parse_Tokenizer_getExpression_getPrimary_getLiteral_getStringLiteral_makeQuotedStringMatcher );

	var parse_Tokenizer_getExpression_getPrimary_getLiteral_getStringLiteral_getDoubleQuotedString = function( makeQuotedStringMatcher ) {

		return makeQuotedStringMatcher( '"', '\'' );
	}( parse_Tokenizer_getExpression_getPrimary_getLiteral_getStringLiteral_makeQuotedStringMatcher );

	var parse_Tokenizer_getExpression_getPrimary_getLiteral_getStringLiteral__getStringLiteral = function( types, getSingleQuotedString, getDoubleQuotedString ) {

		return function( tokenizer ) {
			var start, string;
			start = tokenizer.pos;
			if ( tokenizer.getStringMatch( '"' ) ) {
				string = getDoubleQuotedString( tokenizer );
				if ( !tokenizer.getStringMatch( '"' ) ) {
					tokenizer.pos = start;
					return null;
				}
				return {
					t: types.STRING_LITERAL,
					v: string
				};
			}
			if ( tokenizer.getStringMatch( '\'' ) ) {
				string = getSingleQuotedString( tokenizer );
				if ( !tokenizer.getStringMatch( '\'' ) ) {
					tokenizer.pos = start;
					return null;
				}
				return {
					t: types.STRING_LITERAL,
					v: string
				};
			}
			return null;
		};
	}( config_types, parse_Tokenizer_getExpression_getPrimary_getLiteral_getStringLiteral_getSingleQuotedString, parse_Tokenizer_getExpression_getPrimary_getLiteral_getStringLiteral_getDoubleQuotedString );

	var parse_Tokenizer_getExpression_getPrimary_getLiteral_getNumberLiteral = function( types, makeRegexMatcher ) {

		var getNumber = makeRegexMatcher( /^(?:[+-]?)(?:(?:(?:0|[1-9]\d*)?\.\d+)|(?:(?:0|[1-9]\d*)\.)|(?:0|[1-9]\d*))(?:[eE][+-]?\d+)?/ );
		return function( tokenizer ) {
			var result;
			if ( result = getNumber( tokenizer ) ) {
				return {
					t: types.NUMBER_LITERAL,
					v: result
				};
			}
			return null;
		};
	}( config_types, parse_Tokenizer_utils_makeRegexMatcher );

	var parse_Tokenizer_getExpression_shared_getName = function( makeRegexMatcher ) {

		return makeRegexMatcher( /^[a-zA-Z_$][a-zA-Z_$0-9]*/ );
	}( parse_Tokenizer_utils_makeRegexMatcher );

	var parse_Tokenizer_getExpression_shared_getKey = function( getStringLiteral, getNumberLiteral, getName ) {

		var identifier = /^[a-zA-Z_$][a-zA-Z_$0-9]*$/;
		return function( tokenizer ) {
			var token;
			if ( token = getStringLiteral( tokenizer ) ) {
				return identifier.test( token.v ) ? token.v : '"' + token.v.replace( /"/g, '\\"' ) + '"';
			}
			if ( token = getNumberLiteral( tokenizer ) ) {
				return token.v;
			}
			if ( token = getName( tokenizer ) ) {
				return token;
			}
		};
	}( parse_Tokenizer_getExpression_getPrimary_getLiteral_getStringLiteral__getStringLiteral, parse_Tokenizer_getExpression_getPrimary_getLiteral_getNumberLiteral, parse_Tokenizer_getExpression_shared_getName );

	var utils_parseJSON = function( getStringMatch, allowWhitespace, getStringLiteral, getKey ) {

		var Tokenizer, specials, specialsPattern, numberPattern, placeholderPattern, placeholderAtStartPattern;
		specials = {
			'true': true,
			'false': false,
			'undefined': undefined,
			'null': null
		};
		specialsPattern = new RegExp( '^(?:' + Object.keys( specials ).join( '|' ) + ')' );
		numberPattern = /^(?:[+-]?)(?:(?:(?:0|[1-9]\d*)?\.\d+)|(?:(?:0|[1-9]\d*)\.)|(?:0|[1-9]\d*))(?:[eE][+-]?\d+)?/;
		placeholderPattern = /\$\{([^\}]+)\}/g;
		placeholderAtStartPattern = /^\$\{([^\}]+)\}/;
		Tokenizer = function( str, values ) {
			this.str = str;
			this.values = values;
			this.pos = 0;
			this.result = this.getToken();
		};
		Tokenizer.prototype = {
			remaining: function() {
				return this.str.substring( this.pos );
			},
			getStringMatch: getStringMatch,
			getToken: function() {
				this.allowWhitespace();
				return this.getPlaceholder() || this.getSpecial() || this.getNumber() || this.getString() || this.getObject() || this.getArray();
			},
			getPlaceholder: function() {
				var match;
				if ( !this.values ) {
					return null;
				}
				if ( ( match = placeholderAtStartPattern.exec( this.remaining() ) ) && this.values.hasOwnProperty( match[ 1 ] ) ) {
					this.pos += match[ 0 ].length;
					return {
						v: this.values[ match[ 1 ] ]
					};
				}
			},
			getSpecial: function() {
				var match;
				if ( match = specialsPattern.exec( this.remaining() ) ) {
					this.pos += match[ 0 ].length;
					return {
						v: specials[ match[ 0 ] ]
					};
				}
			},
			getNumber: function() {
				var match;
				if ( match = numberPattern.exec( this.remaining() ) ) {
					this.pos += match[ 0 ].length;
					return {
						v: +match[ 0 ]
					};
				}
			},
			getString: function() {
				var stringLiteral = getStringLiteral( this ),
					values;
				if ( stringLiteral && ( values = this.values ) ) {
					return {
						v: stringLiteral.v.replace( placeholderPattern, function( match, $1 ) {
							return values[ $1 ] || $1;
						} )
					};
				}
				return stringLiteral;
			},
			getObject: function() {
				var result, pair;
				if ( !this.getStringMatch( '{' ) ) {
					return null;
				}
				result = {};
				while ( pair = getKeyValuePair( this ) ) {
					result[ pair.key ] = pair.value;
					this.allowWhitespace();
					if ( this.getStringMatch( '}' ) ) {
						return {
							v: result
						};
					}
					if ( !this.getStringMatch( ',' ) ) {
						return null;
					}
				}
				return null;
			},
			getArray: function() {
				var result, valueToken;
				if ( !this.getStringMatch( '[' ) ) {
					return null;
				}
				result = [];
				while ( valueToken = this.getToken() ) {
					result.push( valueToken.v );
					if ( this.getStringMatch( ']' ) ) {
						return {
							v: result
						};
					}
					if ( !this.getStringMatch( ',' ) ) {
						return null;
					}
				}
				return null;
			},
			allowWhitespace: allowWhitespace
		};

		function getKeyValuePair( tokenizer ) {
			var key, valueToken, pair;
			tokenizer.allowWhitespace();
			key = getKey( tokenizer );
			if ( !key ) {
				return null;
			}
			pair = {
				key: key
			};
			tokenizer.allowWhitespace();
			if ( !tokenizer.getStringMatch( ':' ) ) {
				return null;
			}
			tokenizer.allowWhitespace();
			valueToken = tokenizer.getToken();
			if ( !valueToken ) {
				return null;
			}
			pair.value = valueToken.v;
			return pair;
		}
		return function( str, values ) {
			var tokenizer = new Tokenizer( str, values );
			if ( tokenizer.result ) {
				return {
					value: tokenizer.result.v,
					remaining: tokenizer.remaining()
				};
			}
			return null;
		};
	}( parse_Tokenizer_utils_getStringMatch, parse_Tokenizer_utils_allowWhitespace, parse_Tokenizer_getExpression_getPrimary_getLiteral_getStringLiteral__getStringLiteral, parse_Tokenizer_getExpression_shared_getKey );

	var render_StringFragment_Interpolator = function( types, teardown, initMustache, updateMustache, resolveMustache ) {

		var StringInterpolator = function( options ) {
			this.type = types.INTERPOLATOR;
			initMustache( this, options );
		};
		StringInterpolator.prototype = {
			update: updateMustache,
			resolve: resolveMustache,
			render: function( value ) {
				this.value = value;
				this.parentFragment.bubble();
			},
			teardown: function() {
				teardown( this );
			},
			toString: function() {
				if ( this.value == undefined ) {
					return '';
				}
				return stringify( this.value );
			}
		};
		return StringInterpolator;

		function stringify( value ) {
			if ( typeof value === 'string' ) {
				return value;
			}
			return JSON.stringify( value );
		}
	}( config_types, shared_teardown, render_shared_initMustache, render_shared_updateMustache, render_shared_resolveMustache );

	var render_StringFragment_Section = function( types, initMustache, updateMustache, resolveMustache, updateSection, teardown, circular ) {

		var StringSection, StringFragment;
		circular.push( function() {
			StringFragment = circular.StringFragment;
		} );
		StringSection = function( options ) {
			this.type = types.SECTION;
			this.fragments = [];
			this.length = 0;
			initMustache( this, options );
		};
		StringSection.prototype = {
			update: updateMustache,
			resolve: resolveMustache,
			teardown: function() {
				this.teardownFragments();
				teardown( this );
			},
			teardownFragments: function() {
				while ( this.fragments.length ) {
					this.fragments.shift().teardown();
				}
				this.length = 0;
			},
			bubble: function() {
				this.value = this.fragments.join( '' );
				this.parentFragment.bubble();
			},
			render: function( value ) {
				var wrapped;
				if ( wrapped = this.root._wrapped[ this.keypath ] ) {
					value = wrapped.get();
				}
				updateSection( this, value );
				this.parentFragment.bubble();
			},
			createFragment: function( options ) {
				return new StringFragment( options );
			},
			toString: function() {
				return this.fragments.join( '' );
			}
		};
		return StringSection;
	}( config_types, render_shared_initMustache, render_shared_updateMustache, render_shared_resolveMustache, render_shared_updateSection, shared_teardown, circular );

	var render_StringFragment_Text = function( types ) {

		var StringText = function( text ) {
			this.type = types.TEXT;
			this.text = text;
		};
		StringText.prototype = {
			toString: function() {
				return this.text;
			},
			teardown: function() {}
		};
		return StringText;
	}( config_types );

	var render_StringFragment_prototype_toArgsList = function( warn, parseJSON ) {

		return function() {
			var values, counter, jsonesque, guid, errorMessage, parsed, processItems;
			if ( !this.argsList || this.dirty ) {
				values = {};
				counter = 0;
				guid = this.root._guid;
				processItems = function( items ) {
					return items.map( function( item ) {
						var placeholderId, wrapped, value;
						if ( item.text ) {
							return item.text;
						}
						if ( item.fragments ) {
							return item.fragments.map( function( fragment ) {
								return processItems( fragment.items );
							} ).join( '' );
						}
						placeholderId = guid + '-' + counter++;
						if ( wrapped = item.root._wrapped[ item.keypath ] ) {
							value = wrapped.value;
						} else {
							value = item.value;
						}
						values[ placeholderId ] = value;
						return '${' + placeholderId + '}';
					} ).join( '' );
				};
				jsonesque = processItems( this.items );
				parsed = parseJSON( '[' + jsonesque + ']', values );
				if ( !parsed ) {
					errorMessage = 'Could not parse directive arguments (' + this.toString() + '). If you think this is a bug, please file an issue at http://github.com/RactiveJS/Ractive/issues';
					if ( this.root.debug ) {
						throw new Error( errorMessage );
					} else {
						warn( errorMessage );
						this.argsList = [ jsonesque ];
					}
				} else {
					this.argsList = parsed.value;
				}
				this.dirty = false;
			}
			return this.argsList;
		};
	}( utils_warn, utils_parseJSON );

	var render_StringFragment__StringFragment = function( types, parseJSON, initFragment, Interpolator, Section, Text, toArgsList, circular ) {

		var StringFragment = function( options ) {
			initFragment( this, options );
		};
		StringFragment.prototype = {
			createItem: function( options ) {
				if ( typeof options.descriptor === 'string' ) {
					return new Text( options.descriptor );
				}
				switch ( options.descriptor.t ) {
					case types.INTERPOLATOR:
						return new Interpolator( options );
					case types.TRIPLE:
						return new Interpolator( options );
					case types.SECTION:
						return new Section( options );
					default:
						throw 'Something went wrong in a rather interesting way';
				}
			},
			bubble: function() {
				this.dirty = true;
				this.owner.bubble();
			},
			teardown: function() {
				var numItems, i;
				numItems = this.items.length;
				for ( i = 0; i < numItems; i += 1 ) {
					this.items[ i ].teardown();
				}
			},
			getValue: function() {
				var value;
				if ( this.items.length === 1 && this.items[ 0 ].type === types.INTERPOLATOR ) {
					value = this.items[ 0 ].value;
					if ( value !== undefined ) {
						return value;
					}
				}
				return this.toString();
			},
			isSimple: function() {
				var i, item, containsInterpolator;
				if ( this.simple !== undefined ) {
					return this.simple;
				}
				i = this.items.length;
				while ( i-- ) {
					item = this.items[ i ];
					if ( item.type === types.TEXT ) {
						continue;
					}
					if ( item.type === types.INTERPOLATOR ) {
						if ( containsInterpolator ) {
							return false;
						} else {
							containsInterpolator = true;
							continue;
						}
					}
					return this.simple = false;
				}
				return this.simple = true;
			},
			toString: function() {
				return this.items.join( '' );
			},
			toJSON: function() {
				var value = this.getValue(),
					parsed;
				if ( typeof value === 'string' ) {
					parsed = parseJSON( value );
					value = parsed ? parsed.value : value;
				}
				return value;
			},
			toArgsList: toArgsList
		};
		circular.StringFragment = StringFragment;
		return StringFragment;
	}( config_types, utils_parseJSON, render_shared_initFragment, render_StringFragment_Interpolator, render_StringFragment_Section, render_StringFragment_Text, render_StringFragment_prototype_toArgsList, circular );

	var render_DomFragment_Attribute__Attribute = function( runloop, types, determineNameAndNamespace, setStaticAttribute, determinePropertyName, getInterpolator, bind, update, StringFragment ) {

		var DomAttribute = function( options ) {
			this.type = types.ATTRIBUTE;
			this.element = options.element;
			determineNameAndNamespace( this, options.name );
			if ( options.value === null || typeof options.value === 'string' ) {
				setStaticAttribute( this, options );
				return;
			}
			this.root = options.root;
			this.pNode = options.pNode;
			this.parentFragment = this.element.parentFragment;
			this.fragment = new StringFragment( {
				descriptor: options.value,
				root: this.root,
				owner: this
			} );
			this.interpolator = getInterpolator( this );
			if ( !this.pNode ) {
				return;
			}
			if ( this.name === 'value' ) {
				this.isValueAttribute = true;
				if ( this.pNode.tagName === 'INPUT' && this.pNode.type === 'file' ) {
					this.isFileInputValue = true;
				}
			}
			determinePropertyName( this, options );
			this.selfUpdating = this.fragment.isSimple();
			this.ready = true;
		};
		DomAttribute.prototype = {
			bind: bind,
			update: update,
			updateBindings: function() {
				this.keypath = this.interpolator.keypath || this.interpolator.ref;
				if ( this.propertyName === 'name' ) {
					this.pNode.name = '{{' + this.keypath + '}}';
				}
			},
			teardown: function() {
				var i;
				if ( this.boundEvents ) {
					i = this.boundEvents.length;
					while ( i-- ) {
						this.pNode.removeEventListener( this.boundEvents[ i ], this.updateModel, false );
					}
				}
				if ( this.fragment ) {
					this.fragment.teardown();
				}
			},
			bubble: function() {
				if ( this.selfUpdating ) {
					this.update();
				} else if ( !this.deferred && this.ready ) {
					runloop.addAttribute( this );
					this.deferred = true;
				}
			},
			toString: function() {
				var str, interpolator;
				if ( this.value === null ) {
					return this.name;
				}
				if ( this.name === 'value' && this.element.lcName === 'select' ) {
					return;
				}
				if ( this.name === 'name' && this.element.lcName === 'input' && ( interpolator = this.interpolator ) ) {
					return 'name={{' + ( interpolator.keypath || interpolator.ref ) + '}}';
				}
				if ( !this.fragment ) {
					return this.name + '=' + JSON.stringify( this.value );
				}
				str = this.fragment.toString();
				return this.name + '=' + JSON.stringify( str );
			}
		};
		return DomAttribute;
	}( global_runloop, config_types, render_DomFragment_Attribute_helpers_determineNameAndNamespace, render_DomFragment_Attribute_helpers_setStaticAttribute, render_DomFragment_Attribute_helpers_determinePropertyName, render_DomFragment_Attribute_helpers_getInterpolator, render_DomFragment_Attribute_prototype_bind, render_DomFragment_Attribute_prototype_update, render_StringFragment__StringFragment );

	var render_DomFragment_Element_initialise_createElementAttributes = function( DomAttribute ) {

		return function( element, attributes ) {
			var attrName, attrValue, attr;
			element.attributes = [];
			for ( attrName in attributes ) {
				if ( attributes.hasOwnProperty( attrName ) ) {
					attrValue = attributes[ attrName ];
					attr = new DomAttribute( {
						element: element,
						name: attrName,
						value: attrValue,
						root: element.root,
						pNode: element.node
					} );
					element.attributes.push( element.attributes[ attrName ] = attr );
					if ( attrName !== 'name' ) {
						attr.update();
					}
				}
			}
			return element.attributes;
		};
	}( render_DomFragment_Attribute__Attribute );

	var utils_toArray = function toArray( arrayLike ) {
		var array = [],
			i = arrayLike.length;
		while ( i-- ) {
			array[ i ] = arrayLike[ i ];
		}
		return array;
	};

	var render_DomFragment_Element_shared_getMatchingStaticNodes = function( toArray ) {

		return function getMatchingStaticNodes( element, selector ) {
			if ( !element.matchingStaticNodes[ selector ] ) {
				element.matchingStaticNodes[ selector ] = toArray( element.node.querySelectorAll( selector ) );
			}
			return element.matchingStaticNodes[ selector ];
		};
	}( utils_toArray );

	var render_DomFragment_Element_initialise_appendElementChildren = function( warn, namespaces, StringFragment, getMatchingStaticNodes, circular ) {

		var DomFragment, updateCss, updateScript;
		circular.push( function() {
			DomFragment = circular.DomFragment;
		} );
		updateCss = function() {
			var node = this.node,
				content = this.fragment.toString();
			if ( node.styleSheet ) {
				node.styleSheet.cssText = content;
			} else {
				node.innerHTML = content;
			}
		};
		updateScript = function() {
			if ( !this.node.type || this.node.type === 'text/javascript' ) {
				warn( 'Script tag was updated. This does not cause the code to be re-evaluated!' );
			}
			this.node.text = this.fragment.toString();
		};
		return function appendElementChildren( element, node, descriptor, docFrag ) {
			if ( element.lcName === 'script' || element.lcName === 'style' ) {
				element.fragment = new StringFragment( {
					descriptor: descriptor.f,
					root: element.root,
					owner: element
				} );
				if ( docFrag ) {
					if ( element.lcName === 'script' ) {
						element.bubble = updateScript;
						element.node.text = element.fragment.toString();
					} else {
						element.bubble = updateCss;
						element.bubble();
					}
				}
				return;
			}
			if ( typeof descriptor.f === 'string' && ( !node || ( !node.namespaceURI || node.namespaceURI === namespaces.html ) ) ) {
				element.html = descriptor.f;
				if ( docFrag ) {
					node.innerHTML = element.html;
					element.matchingStaticNodes = {};
					updateLiveQueries( element );
				}
			} else {
				element.fragment = new DomFragment( {
					descriptor: descriptor.f,
					root: element.root,
					pNode: node,
					owner: element,
					pElement: element
				} );
				if ( docFrag ) {
					node.appendChild( element.fragment.docFrag );
				}
			}
		};

		function updateLiveQueries( element ) {
			var instance, liveQueries, node, selector, query, matchingStaticNodes, i;
			node = element.node;
			instance = element.root;
			do {
				liveQueries = instance._liveQueries;
				i = liveQueries.length;
				while ( i-- ) {
					selector = liveQueries[ i ];
					query = liveQueries[ selector ];
					matchingStaticNodes = getMatchingStaticNodes( element, selector );
					query.push.apply( query, matchingStaticNodes );
				}
			} while ( instance = instance._parent );
		}
	}( utils_warn, config_namespaces, render_StringFragment__StringFragment, render_DomFragment_Element_shared_getMatchingStaticNodes, circular );

	var render_DomFragment_Element_initialise_decorate_Decorator = function( warn, StringFragment ) {

		var Decorator = function( descriptor, ractive, owner ) {
			var decorator = this,
				name, fragment, errorMessage;
			decorator.root = ractive;
			decorator.node = owner.node;
			name = descriptor.n || descriptor;
			if ( typeof name !== 'string' ) {
				fragment = new StringFragment( {
					descriptor: name,
					root: ractive,
					owner: owner
				} );
				name = fragment.toString();
				fragment.teardown();
			}
			if ( descriptor.a ) {
				decorator.params = descriptor.a;
			} else if ( descriptor.d ) {
				decorator.fragment = new StringFragment( {
					descriptor: descriptor.d,
					root: ractive,
					owner: owner
				} );
				decorator.params = decorator.fragment.toArgsList();
				decorator.fragment.bubble = function() {
					this.dirty = true;
					decorator.params = this.toArgsList();
					if ( decorator.ready ) {
						decorator.update();
					}
				};
			}
			decorator.fn = ractive.decorators[ name ];
			if ( !decorator.fn ) {
				errorMessage = 'Missing "' + name + '" decorator. You may need to download a plugin via http://docs.ractivejs.org/latest/plugins#decorators';
				if ( ractive.debug ) {
					throw new Error( errorMessage );
				} else {
					warn( errorMessage );
				}
			}
		};
		Decorator.prototype = {
			init: function() {
				var result, args;
				if ( this.params ) {
					args = [ this.node ].concat( this.params );
					result = this.fn.apply( this.root, args );
				} else {
					result = this.fn.call( this.root, this.node );
				}
				if ( !result || !result.teardown ) {
					throw new Error( 'Decorator definition must return an object with a teardown method' );
				}
				this.actual = result;
				this.ready = true;
			},
			update: function() {
				if ( this.actual.update ) {
					this.actual.update.apply( this.root, this.params );
				} else {
					this.actual.teardown( true );
					this.init();
				}
			},
			teardown: function( updating ) {
				this.actual.teardown();
				if ( !updating ) {
					this.fragment.teardown();
				}
			}
		};
		return Decorator;
	}( utils_warn, render_StringFragment__StringFragment );

	var render_DomFragment_Element_initialise_decorate__decorate = function( runloop, Decorator ) {

		return function( descriptor, root, owner ) {
			var decorator = new Decorator( descriptor, root, owner );
			if ( decorator.fn ) {
				owner.decorator = decorator;
				runloop.addDecorator( owner.decorator );
			}
		};
	}( global_runloop, render_DomFragment_Element_initialise_decorate_Decorator );

	var render_DomFragment_Element_initialise_addEventProxies_addEventProxy = function( warn, StringFragment ) {

		var addEventProxy, MasterEventHandler, ProxyEvent, firePlainEvent, fireEventWithArgs, fireEventWithDynamicArgs, customHandlers, genericHandler, getCustomHandler;
		addEventProxy = function( element, triggerEventName, proxyDescriptor, indexRefs ) {
			var events, master;
			events = element.node._ractive.events;
			master = events[ triggerEventName ] || ( events[ triggerEventName ] = new MasterEventHandler( element, triggerEventName, indexRefs ) );
			master.add( proxyDescriptor );
		};
		MasterEventHandler = function( element, eventName ) {
			var definition;
			this.element = element;
			this.root = element.root;
			this.node = element.node;
			this.name = eventName;
			this.proxies = [];
			if ( definition = this.root.events[ eventName ] ) {
				this.custom = definition( this.node, getCustomHandler( eventName ) );
			} else {
				if ( !( 'on' + eventName in this.node ) ) {
					warn( 'Missing "' + this.name + '" event. You may need to download a plugin via http://docs.ractivejs.org/latest/plugins#events' );
				}
				this.node.addEventListener( eventName, genericHandler, false );
			}
		};
		MasterEventHandler.prototype = {
			add: function( proxy ) {
				this.proxies.push( new ProxyEvent( this.element, this.root, proxy ) );
			},
			teardown: function() {
				var i;
				if ( this.custom ) {
					this.custom.teardown();
				} else {
					this.node.removeEventListener( this.name, genericHandler, false );
				}
				i = this.proxies.length;
				while ( i-- ) {
					this.proxies[ i ].teardown();
				}
			},
			fire: function( event ) {
				var i = this.proxies.length;
				while ( i-- ) {
					this.proxies[ i ].fire( event );
				}
			}
		};
		ProxyEvent = function( element, ractive, descriptor ) {
			var name;
			this.root = ractive;
			name = descriptor.n || descriptor;
			if ( typeof name === 'string' ) {
				this.n = name;
			} else {
				this.n = new StringFragment( {
					descriptor: descriptor.n,
					root: this.root,
					owner: element
				} );
			}
			if ( descriptor.a ) {
				this.a = descriptor.a;
				this.fire = fireEventWithArgs;
				return;
			}
			if ( descriptor.d ) {
				this.d = new StringFragment( {
					descriptor: descriptor.d,
					root: this.root,
					owner: element
				} );
				this.fire = fireEventWithDynamicArgs;
				return;
			}
			this.fire = firePlainEvent;
		};
		ProxyEvent.prototype = {
			teardown: function() {
				if ( this.n.teardown ) {
					this.n.teardown();
				}
				if ( this.d ) {
					this.d.teardown();
				}
			},
			bubble: function() {}
		};
		firePlainEvent = function( event ) {
			this.root.fire( this.n.toString(), event );
		};
		fireEventWithArgs = function( event ) {
			this.root.fire.apply( this.root, [
				this.n.toString(),
				event
			].concat( this.a ) );
		};
		fireEventWithDynamicArgs = function( event ) {
			var args = this.d.toArgsList();
			if ( typeof args === 'string' ) {
				args = args.substr( 1, args.length - 2 );
			}
			this.root.fire.apply( this.root, [
				this.n.toString(),
				event
			].concat( args ) );
		};
		genericHandler = function( event ) {
			var storage = this._ractive;
			storage.events[ event.type ].fire( {
				node: this,
				original: event,
				index: storage.index,
				keypath: storage.keypath,
				context: storage.root.get( storage.keypath )
			} );
		};
		customHandlers = {};
		getCustomHandler = function( eventName ) {
			if ( customHandlers[ eventName ] ) {
				return customHandlers[ eventName ];
			}
			return customHandlers[ eventName ] = function( event ) {
				var storage = event.node._ractive;
				event.index = storage.index;
				event.keypath = storage.keypath;
				event.context = storage.root.get( storage.keypath );
				storage.events[ eventName ].fire( event );
			};
		};
		return addEventProxy;
	}( utils_warn, render_StringFragment__StringFragment );

	var render_DomFragment_Element_initialise_addEventProxies__addEventProxies = function( addEventProxy ) {

		return function( element, proxies ) {
			var i, eventName, eventNames;
			for ( eventName in proxies ) {
				if ( proxies.hasOwnProperty( eventName ) ) {
					eventNames = eventName.split( '-' );
					i = eventNames.length;
					while ( i-- ) {
						addEventProxy( element, eventNames[ i ], proxies[ eventName ] );
					}
				}
			}
		};
	}( render_DomFragment_Element_initialise_addEventProxies_addEventProxy );

	var render_DomFragment_Element_initialise_updateLiveQueries = function( element ) {
		var instance, liveQueries, i, selector, query;
		instance = element.root;
		do {
			liveQueries = instance._liveQueries;
			i = liveQueries.length;
			while ( i-- ) {
				selector = liveQueries[ i ];
				query = liveQueries[ selector ];
				if ( query._test( element ) ) {
					( element.liveQueries || ( element.liveQueries = [] ) ).push( query );
				}
			}
		} while ( instance = instance._parent );
	};

	var render_DomFragment_Element_shared_executeTransition_Transition_prototype_init = function() {
		if ( this._inited ) {
			throw new Error( 'Cannot initialize a transition more than once' );
		}
		this._inited = true;
		this._fn.apply( this.root, [ this ].concat( this.params ) );
	};

	var render_DomFragment_Element_shared_executeTransition_Transition_helpers_prefix = function( isClient, vendors, createElement ) {

		var prefixCache, testStyle;
		if ( !isClient ) {
			return;
		}
		prefixCache = {};
		testStyle = createElement( 'div' ).style;
		return function( prop ) {
			var i, vendor, capped;
			if ( !prefixCache[ prop ] ) {
				if ( testStyle[ prop ] !== undefined ) {
					prefixCache[ prop ] = prop;
				} else {
					capped = prop.charAt( 0 ).toUpperCase() + prop.substring( 1 );
					i = vendors.length;
					while ( i-- ) {
						vendor = vendors[ i ];
						if ( testStyle[ vendor + capped ] !== undefined ) {
							prefixCache[ prop ] = vendor + capped;
							break;
						}
					}
				}
			}
			return prefixCache[ prop ];
		};
	}( config_isClient, config_vendors, utils_createElement );

	var render_DomFragment_Element_shared_executeTransition_Transition_prototype_getStyle = function( legacy, isClient, isArray, prefix ) {

		var getComputedStyle;
		if ( !isClient ) {
			return;
		}
		getComputedStyle = window.getComputedStyle || legacy.getComputedStyle;
		return function( props ) {
			var computedStyle, styles, i, prop, value;
			computedStyle = window.getComputedStyle( this.node );
			if ( typeof props === 'string' ) {
				value = computedStyle[ prefix( props ) ];
				if ( value === '0px' ) {
					value = 0;
				}
				return value;
			}
			if ( !isArray( props ) ) {
				throw new Error( 'Transition#getStyle must be passed a string, or an array of strings representing CSS properties' );
			}
			styles = {};
			i = props.length;
			while ( i-- ) {
				prop = props[ i ];
				value = computedStyle[ prefix( prop ) ];
				if ( value === '0px' ) {
					value = 0;
				}
				styles[ prop ] = value;
			}
			return styles;
		};
	}( legacy, config_isClient, utils_isArray, render_DomFragment_Element_shared_executeTransition_Transition_helpers_prefix );

	var render_DomFragment_Element_shared_executeTransition_Transition_prototype_setStyle = function( prefix ) {

		return function( style, value ) {
			var prop;
			if ( typeof style === 'string' ) {
				this.node.style[ prefix( style ) ] = value;
			} else {
				for ( prop in style ) {
					if ( style.hasOwnProperty( prop ) ) {
						this.node.style[ prefix( prop ) ] = style[ prop ];
					}
				}
			}
			return this;
		};
	}( render_DomFragment_Element_shared_executeTransition_Transition_helpers_prefix );

	var utils_camelCase = function( hyphenatedStr ) {
		return hyphenatedStr.replace( /-([a-zA-Z])/g, function( match, $1 ) {
			return $1.toUpperCase();
		} );
	};

	var shared_Ticker = function( warn, getTime, animations ) {

		var Ticker = function( options ) {
			var easing;
			this.duration = options.duration;
			this.step = options.step;
			this.complete = options.complete;
			if ( typeof options.easing === 'string' ) {
				easing = options.root.easing[ options.easing ];
				if ( !easing ) {
					warn( 'Missing easing function ("' + options.easing + '"). You may need to download a plugin from [TODO]' );
					easing = linear;
				}
			} else if ( typeof options.easing === 'function' ) {
				easing = options.easing;
			} else {
				easing = linear;
			}
			this.easing = easing;
			this.start = getTime();
			this.end = this.start + this.duration;
			this.running = true;
			animations.add( this );
		};
		Ticker.prototype = {
			tick: function( now ) {
				var elapsed, eased;
				if ( !this.running ) {
					return false;
				}
				if ( now > this.end ) {
					if ( this.step ) {
						this.step( 1 );
					}
					if ( this.complete ) {
						this.complete( 1 );
					}
					return false;
				}
				elapsed = now - this.start;
				eased = this.easing( elapsed / this.duration );
				if ( this.step ) {
					this.step( eased );
				}
				return true;
			},
			stop: function() {
				if ( this.abort ) {
					this.abort();
				}
				this.running = false;
			}
		};
		return Ticker;

		function linear( t ) {
			return t;
		}
	}( utils_warn, utils_getTime, shared_animations );

	var render_DomFragment_Element_shared_executeTransition_Transition_helpers_unprefix = function( vendors ) {

		var unprefixPattern = new RegExp( '^-(?:' + vendors.join( '|' ) + ')-' );
		return function( prop ) {
			return prop.replace( unprefixPattern, '' );
		};
	}( config_vendors );

	var render_DomFragment_Element_shared_executeTransition_Transition_helpers_hyphenate = function( vendors ) {

		var vendorPattern = new RegExp( '^(?:' + vendors.join( '|' ) + ')([A-Z])' );
		return function( str ) {
			var hyphenated;
			if ( !str ) {
				return '';
			}
			if ( vendorPattern.test( str ) ) {
				str = '-' + str;
			}
			hyphenated = str.replace( /[A-Z]/g, function( match ) {
				return '-' + match.toLowerCase();
			} );
			return hyphenated;
		};
	}( config_vendors );

	var render_DomFragment_Element_shared_executeTransition_Transition_prototype_animateStyle_createTransitions = function( isClient, warn, createElement, camelCase, interpolate, Ticker, prefix, unprefix, hyphenate ) {

		var testStyle, TRANSITION, TRANSITIONEND, CSS_TRANSITIONS_ENABLED, TRANSITION_DURATION, TRANSITION_PROPERTY, TRANSITION_TIMING_FUNCTION, canUseCssTransitions = {}, cannotUseCssTransitions = {};
		if ( !isClient ) {
			return;
		}
		testStyle = createElement( 'div' ).style;
		( function() {
			if ( testStyle.transition !== undefined ) {
				TRANSITION = 'transition';
				TRANSITIONEND = 'transitionend';
				CSS_TRANSITIONS_ENABLED = true;
			} else if ( testStyle.webkitTransition !== undefined ) {
				TRANSITION = 'webkitTransition';
				TRANSITIONEND = 'webkitTransitionEnd';
				CSS_TRANSITIONS_ENABLED = true;
			} else {
				CSS_TRANSITIONS_ENABLED = false;
			}
		}() );
		if ( TRANSITION ) {
			TRANSITION_DURATION = TRANSITION + 'Duration';
			TRANSITION_PROPERTY = TRANSITION + 'Property';
			TRANSITION_TIMING_FUNCTION = TRANSITION + 'TimingFunction';
		}
		return function( t, to, options, changedProperties, transitionEndHandler, resolve ) {
			setTimeout( function() {
				var hashPrefix, jsTransitionsComplete, cssTransitionsComplete, checkComplete;
				checkComplete = function() {
					if ( jsTransitionsComplete && cssTransitionsComplete ) {
						resolve();
					}
				};
				hashPrefix = t.node.namespaceURI + t.node.tagName;
				t.node.style[ TRANSITION_PROPERTY ] = changedProperties.map( prefix ).map( hyphenate ).join( ',' );
				t.node.style[ TRANSITION_TIMING_FUNCTION ] = hyphenate( options.easing || 'linear' );
				t.node.style[ TRANSITION_DURATION ] = options.duration / 1000 + 's';
				transitionEndHandler = function( event ) {
					var index;
					index = changedProperties.indexOf( camelCase( unprefix( event.propertyName ) ) );
					if ( index !== -1 ) {
						changedProperties.splice( index, 1 );
					}
					if ( changedProperties.length ) {
						return;
					}
					t.root.fire( t.name + ':end' );
					t.node.removeEventListener( TRANSITIONEND, transitionEndHandler, false );
					cssTransitionsComplete = true;
					checkComplete();
				};
				t.node.addEventListener( TRANSITIONEND, transitionEndHandler, false );
				setTimeout( function() {
					var i = changedProperties.length,
						hash, originalValue, index, propertiesToTransitionInJs = [],
						prop;
					while ( i-- ) {
						prop = changedProperties[ i ];
						hash = hashPrefix + prop;
						if ( canUseCssTransitions[ hash ] ) {
							t.node.style[ prefix( prop ) ] = to[ prop ];
						} else {
							originalValue = t.getStyle( prop );
						}
						if ( canUseCssTransitions[ hash ] === undefined ) {
							t.node.style[ prefix( prop ) ] = to[ prop ];
							canUseCssTransitions[ hash ] = t.getStyle( prop ) != to[ prop ];
							cannotUseCssTransitions[ hash ] = !canUseCssTransitions[ hash ];
						}
						if ( cannotUseCssTransitions[ hash ] ) {
							index = changedProperties.indexOf( prop );
							if ( index === -1 ) {
								warn( 'Something very strange happened with transitions. If you see this message, please let @RactiveJS know. Thanks!' );
							} else {
								changedProperties.splice( index, 1 );
							}
							t.node.style[ prefix( prop ) ] = originalValue;
							propertiesToTransitionInJs.push( {
								name: prefix( prop ),
								interpolator: interpolate( originalValue, to[ prop ] )
							} );
						}
					}
					if ( propertiesToTransitionInJs.length ) {
						new Ticker( {
							root: t.root,
							duration: options.duration,
							easing: camelCase( options.easing ),
							step: function( pos ) {
								var prop, i;
								i = propertiesToTransitionInJs.length;
								while ( i-- ) {
									prop = propertiesToTransitionInJs[ i ];
									t.node.style[ prop.name ] = prop.interpolator( pos );
								}
							},
							complete: function() {
								jsTransitionsComplete = true;
								checkComplete();
							}
						} );
					} else {
						jsTransitionsComplete = true;
					}
					if ( !changedProperties.length ) {
						t.node.removeEventListener( TRANSITIONEND, transitionEndHandler, false );
						cssTransitionsComplete = true;
						checkComplete();
					}
				}, 0 );
			}, options.delay || 0 );
		};
	}( config_isClient, utils_warn, utils_createElement, utils_camelCase, shared_interpolate, shared_Ticker, render_DomFragment_Element_shared_executeTransition_Transition_helpers_prefix, render_DomFragment_Element_shared_executeTransition_Transition_helpers_unprefix, render_DomFragment_Element_shared_executeTransition_Transition_helpers_hyphenate );

	var render_DomFragment_Element_shared_executeTransition_Transition_prototype_animateStyle__animateStyle = function( legacy, isClient, warn, Promise, prefix, createTransitions ) {

		var getComputedStyle;
		if ( !isClient ) {
			return;
		}
		getComputedStyle = window.getComputedStyle || legacy.getComputedStyle;
		return function( style, value, options, complete ) {
			var t = this,
				to;
			if ( typeof style === 'string' ) {
				to = {};
				to[ style ] = value;
			} else {
				to = style;
				complete = options;
				options = value;
			}
			if ( !options ) {
				warn( 'The "' + t.name + '" transition does not supply an options object to `t.animateStyle()`. This will break in a future version of Ractive. For more info see https://github.com/RactiveJS/Ractive/issues/340' );
				options = t;
				complete = t.complete;
			}
			var promise = new Promise( function( resolve ) {
				var propertyNames, changedProperties, computedStyle, current, from, transitionEndHandler, i, prop;
				if ( !options.duration ) {
					t.setStyle( to );
					resolve();
					return;
				}
				propertyNames = Object.keys( to );
				changedProperties = [];
				computedStyle = window.getComputedStyle( t.node );
				from = {};
				i = propertyNames.length;
				while ( i-- ) {
					prop = propertyNames[ i ];
					current = computedStyle[ prefix( prop ) ];
					if ( current === '0px' ) {
						current = 0;
					}
					if ( current != to[ prop ] ) {
						changedProperties.push( prop );
						t.node.style[ prefix( prop ) ] = current;
					}
				}
				if ( !changedProperties.length ) {
					resolve();
					return;
				}
				createTransitions( t, to, options, changedProperties, transitionEndHandler, resolve );
			} );
			if ( complete ) {
				warn( 't.animateStyle returns a Promise as of 0.4.0. Transition authors should do t.animateStyle(...).then(callback)' );
				promise.then( complete );
			}
			return promise;
		};
	}( legacy, config_isClient, utils_warn, utils_Promise, render_DomFragment_Element_shared_executeTransition_Transition_helpers_prefix, render_DomFragment_Element_shared_executeTransition_Transition_prototype_animateStyle_createTransitions );

	var utils_fillGaps = function( target, source ) {
		var key;
		for ( key in source ) {
			if ( source.hasOwnProperty( key ) && !( key in target ) ) {
				target[ key ] = source[ key ];
			}
		}
		return target;
	};

	var render_DomFragment_Element_shared_executeTransition_Transition_prototype_processParams = function( fillGaps ) {

		return function( params, defaults ) {
			if ( typeof params === 'number' ) {
				params = {
					duration: params
				};
			} else if ( typeof params === 'string' ) {
				if ( params === 'slow' ) {
					params = {
						duration: 600
					};
				} else if ( params === 'fast' ) {
					params = {
						duration: 200
					};
				} else {
					params = {
						duration: 400
					};
				}
			} else if ( !params ) {
				params = {};
			}
			return fillGaps( params, defaults );
		};
	}( utils_fillGaps );

	var render_DomFragment_Element_shared_executeTransition_Transition_prototype_resetStyle = function() {
		if ( this.originalStyle ) {
			this.node.setAttribute( 'style', this.originalStyle );
		} else {
			this.node.getAttribute( 'style' );
			this.node.removeAttribute( 'style' );
		}
	};

	var render_DomFragment_Element_shared_executeTransition_Transition__Transition = function( warn, StringFragment, init, getStyle, setStyle, animateStyle, processParams, resetStyle ) {

		var Transition;
		Transition = function( descriptor, root, owner, isIntro ) {
			var t = this,
				name, fragment, errorMessage;
			this.root = root;
			this.node = owner.node;
			this.isIntro = isIntro;
			this.originalStyle = this.node.getAttribute( 'style' );
			t.complete = function( noReset ) {
				if ( !noReset && t.isIntro ) {
					t.resetStyle();
				}
				t.node._ractive.transition = null;
				t._manager.remove( t );
			};
			name = descriptor.n || descriptor;
			if ( typeof name !== 'string' ) {
				fragment = new StringFragment( {
					descriptor: name,
					root: this.root,
					owner: owner
				} );
				name = fragment.toString();
				fragment.teardown();
			}
			this.name = name;
			if ( descriptor.a ) {
				this.params = descriptor.a;
			} else if ( descriptor.d ) {
				fragment = new StringFragment( {
					descriptor: descriptor.d,
					root: this.root,
					owner: owner
				} );
				this.params = fragment.toArgsList();
				fragment.teardown();
			}
			this._fn = root.transitions[ name ];
			if ( !this._fn ) {
				errorMessage = 'Missing "' + name + '" transition. You may need to download a plugin via http://docs.ractivejs.org/latest/plugins#transitions';
				if ( root.debug ) {
					throw new Error( errorMessage );
				} else {
					warn( errorMessage );
				}
				return;
			}
		};
		Transition.prototype = {
			init: init,
			getStyle: getStyle,
			setStyle: setStyle,
			animateStyle: animateStyle,
			processParams: processParams,
			resetStyle: resetStyle
		};
		return Transition;
	}( utils_warn, render_StringFragment__StringFragment, render_DomFragment_Element_shared_executeTransition_Transition_prototype_init, render_DomFragment_Element_shared_executeTransition_Transition_prototype_getStyle, render_DomFragment_Element_shared_executeTransition_Transition_prototype_setStyle, render_DomFragment_Element_shared_executeTransition_Transition_prototype_animateStyle__animateStyle, render_DomFragment_Element_shared_executeTransition_Transition_prototype_processParams, render_DomFragment_Element_shared_executeTransition_Transition_prototype_resetStyle );

	var render_DomFragment_Element_shared_executeTransition__executeTransition = function( runloop, Transition ) {

		return function( descriptor, ractive, owner, isIntro ) {
			var transition, node, oldTransition;
			if ( !ractive.transitionsEnabled || ractive._parent && !ractive._parent.transitionsEnabled ) {
				return;
			}
			transition = new Transition( descriptor, ractive, owner, isIntro );
			if ( transition._fn ) {
				node = transition.node;
				if ( oldTransition = node._ractive.transition ) {
					oldTransition.complete();
				}
				node._ractive.transition = transition;
				runloop.addTransition( transition );
			}
		};
	}( global_runloop, render_DomFragment_Element_shared_executeTransition_Transition__Transition );

	var render_DomFragment_Element_initialise__initialise = function( runloop, types, namespaces, create, defineProperty, warn, createElement, getInnerContext, getElementNamespace, createElementAttributes, appendElementChildren, decorate, addEventProxies, updateLiveQueries, executeTransition, enforceCase ) {

		return function initialiseElement( element, options, docFrag ) {
			var parentFragment, pNode, descriptor, namespace, name, attributes, width, height, loadHandler, root, selectBinding, errorMessage;
			element.type = types.ELEMENT;
			parentFragment = element.parentFragment = options.parentFragment;
			pNode = parentFragment.pNode;
			descriptor = element.descriptor = options.descriptor;
			element.parent = options.pElement;
			element.root = root = parentFragment.root;
			element.index = options.index;
			element.lcName = descriptor.e.toLowerCase();
			element.eventListeners = [];
			element.customEventListeners = [];
			element.cssDetachQueue = [];
			if ( pNode ) {
				namespace = element.namespace = getElementNamespace( descriptor, pNode );
				name = namespace !== namespaces.html ? enforceCase( descriptor.e ) : descriptor.e;
				element.node = createElement( name, namespace );
				if ( root.css && pNode === root.el ) {
					element.node.setAttribute( 'data-rvcguid', root.constructor._guid || root._guid );
				}
				defineProperty( element.node, '_ractive', {
					value: {
						proxy: element,
						keypath: getInnerContext( parentFragment ),
						index: parentFragment.indexRefs,
						events: create( null ),
						root: root
					}
				} );
			}
			attributes = createElementAttributes( element, descriptor.a );
			if ( descriptor.f ) {
				if ( element.node && element.node.getAttribute( 'contenteditable' ) ) {
					if ( element.node.innerHTML ) {
						errorMessage = 'A pre-populated contenteditable element should not have children';
						if ( root.debug ) {
							throw new Error( errorMessage );
						} else {
							warn( errorMessage );
						}
					}
				}
				appendElementChildren( element, element.node, descriptor, docFrag );
			}
			if ( docFrag && descriptor.v ) {
				addEventProxies( element, descriptor.v );
			}
			if ( docFrag ) {
				if ( root.twoway ) {
					element.bind();
					if ( element.node.getAttribute( 'contenteditable' ) && element.node._ractive.binding ) {
						element.node._ractive.binding.update();
					}
				}
				if ( attributes.name && !attributes.name.twoway ) {
					attributes.name.update();
				}
				if ( element.node.tagName === 'IMG' && ( ( width = element.attributes.width ) || ( height = element.attributes.height ) ) ) {
					element.node.addEventListener( 'load', loadHandler = function() {
						if ( width ) {
							element.node.width = width.value;
						}
						if ( height ) {
							element.node.height = height.value;
						}
						element.node.removeEventListener( 'load', loadHandler, false );
					}, false );
				}
				docFrag.appendChild( element.node );
				if ( descriptor.o ) {
					decorate( descriptor.o, root, element );
				}
				if ( descriptor.t1 ) {
					executeTransition( descriptor.t1, root, element, true );
				}
				if ( element.node.tagName === 'OPTION' ) {
					if ( pNode.tagName === 'SELECT' && ( selectBinding = pNode._ractive.binding ) ) {
						selectBinding.deferUpdate();
					}
					if ( element.node._ractive.value == pNode._ractive.value ) {
						element.node.selected = true;
					}
				}
				if ( element.node.autofocus ) {
					runloop.focus( element.node );
				}
			}
			if ( element.lcName === 'option' ) {
				element.select = findParentSelect( element.parent );
			}
			updateLiveQueries( element );
		};

		function findParentSelect( element ) {
			do {
				if ( element.lcName === 'select' ) {
					return element;
				}
			} while ( element = element.parent );
		}
	}( global_runloop, config_types, config_namespaces, utils_create, utils_defineProperty, utils_warn, utils_createElement, shared_getInnerContext, render_DomFragment_Element_initialise_getElementNamespace, render_DomFragment_Element_initialise_createElementAttributes, render_DomFragment_Element_initialise_appendElementChildren, render_DomFragment_Element_initialise_decorate__decorate, render_DomFragment_Element_initialise_addEventProxies__addEventProxies, render_DomFragment_Element_initialise_updateLiveQueries, render_DomFragment_Element_shared_executeTransition__executeTransition, render_DomFragment_shared_enforceCase );

	var render_DomFragment_Element_prototype_teardown = function( runloop, executeTransition ) {

		return function Element_prototype_teardown( destroy ) {
			var eventName, binding, bindings;
			if ( destroy ) {
				this.willDetach = true;
				runloop.detachWhenReady( this );
			}
			if ( this.fragment ) {
				this.fragment.teardown( false );
			}
			while ( this.attributes.length ) {
				this.attributes.pop().teardown();
			}
			if ( this.node ) {
				for ( eventName in this.node._ractive.events ) {
					this.node._ractive.events[ eventName ].teardown();
				}
				if ( binding = this.node._ractive.binding ) {
					binding.teardown();
					bindings = this.root._twowayBindings[ binding.attr.keypath ];
					bindings.splice( bindings.indexOf( binding ), 1 );
				}
			}
			if ( this.decorator ) {
				this.decorator.teardown();
			}
			if ( this.descriptor.t2 ) {
				executeTransition( this.descriptor.t2, this.root, this, false );
			}
			if ( this.liveQueries ) {
				removeFromLiveQueries( this );
			}
		};

		function removeFromLiveQueries( element ) {
			var query, selector, matchingStaticNodes, i, j;
			i = element.liveQueries.length;
			while ( i-- ) {
				query = element.liveQueries[ i ];
				selector = query.selector;
				query._remove( element.node );
				if ( element.matchingStaticNodes && ( matchingStaticNodes = element.matchingStaticNodes[ selector ] ) ) {
					j = matchingStaticNodes.length;
					while ( j-- ) {
						query.remove( matchingStaticNodes[ j ] );
					}
				}
			}
		}
	}( global_runloop, render_DomFragment_Element_shared_executeTransition__executeTransition );

	var config_voidElementNames = 'area base br col command doctype embed hr img input keygen link meta param source track wbr'.split( ' ' );

	var render_DomFragment_Element_prototype_toString = function( voidElementNames, isArray ) {

		return function() {
			var str, i, len, attrStr;
			str = '<' + ( this.descriptor.y ? '!doctype' : this.descriptor.e );
			len = this.attributes.length;
			for ( i = 0; i < len; i += 1 ) {
				if ( attrStr = this.attributes[ i ].toString() ) {
					str += ' ' + attrStr;
				}
			}
			if ( this.lcName === 'option' && optionIsSelected( this ) ) {
				str += ' selected';
			}
			if ( this.lcName === 'input' && inputIsCheckedRadio( this ) ) {
				str += ' checked';
			}
			str += '>';
			if ( this.html ) {
				str += this.html;
			} else if ( this.fragment ) {
				str += this.fragment.toString();
			}
			if ( voidElementNames.indexOf( this.descriptor.e ) === -1 ) {
				str += '</' + this.descriptor.e + '>';
			}
			this.stringifying = false;
			return str;
		};

		function optionIsSelected( element ) {
			var optionValue, selectValueAttribute, selectValueInterpolator, selectValue, i;
			optionValue = element.attributes.value.value;
			selectValueAttribute = element.select.attributes.value;
			selectValueInterpolator = selectValueAttribute.interpolator;
			if ( !selectValueInterpolator ) {
				return;
			}
			selectValue = element.root.get( selectValueInterpolator.keypath || selectValueInterpolator.ref );
			if ( selectValue == optionValue ) {
				return true;
			}
			if ( element.select.attributes.multiple && isArray( selectValue ) ) {
				i = selectValue.length;
				while ( i-- ) {
					if ( selectValue[ i ] == optionValue ) {
						return true;
					}
				}
			}
		}

		function inputIsCheckedRadio( element ) {
			var attributes, typeAttribute, valueAttribute, nameAttribute;
			attributes = element.attributes;
			typeAttribute = attributes.type;
			valueAttribute = attributes.value;
			nameAttribute = attributes.name;
			if ( !typeAttribute || typeAttribute.value !== 'radio' || !valueAttribute || !nameAttribute.interpolator ) {
				return;
			}
			if ( valueAttribute.value === nameAttribute.interpolator.value ) {
				return true;
			}
		}
	}( config_voidElementNames, utils_isArray );

	var render_DomFragment_Element_prototype_find = function( matches ) {

		return function( selector ) {
			var queryResult;
			if ( matches( this.node, selector ) ) {
				return this.node;
			}
			if ( this.html && ( queryResult = this.node.querySelector( selector ) ) ) {
				return queryResult;
			}
			if ( this.fragment && this.fragment.find ) {
				return this.fragment.find( selector );
			}
		};
	}( utils_matches );

	var render_DomFragment_Element_prototype_findAll = function( getMatchingStaticNodes ) {

		return function( selector, query ) {
			var matchingStaticNodes, matchedSelf;
			if ( query._test( this, true ) && query.live ) {
				( this.liveQueries || ( this.liveQueries = [] ) ).push( query );
			}
			if ( this.html ) {
				matchingStaticNodes = getMatchingStaticNodes( this, selector );
				query.push.apply( query, matchingStaticNodes );
				if ( query.live && !matchedSelf ) {
					( this.liveQueries || ( this.liveQueries = [] ) ).push( query );
				}
			}
			if ( this.fragment ) {
				this.fragment.findAll( selector, query );
			}
		};
	}( render_DomFragment_Element_shared_getMatchingStaticNodes );

	var render_DomFragment_Element_prototype_findComponent = function( selector ) {
		if ( this.fragment ) {
			return this.fragment.findComponent( selector );
		}
	};

	var render_DomFragment_Element_prototype_findAllComponents = function( selector, query ) {
		if ( this.fragment ) {
			this.fragment.findAllComponents( selector, query );
		}
	};

	var render_DomFragment_Element_prototype_bind = function() {
		var attributes = this.attributes;
		if ( !this.node ) {
			return;
		}
		if ( this.binding ) {
			this.binding.teardown();
			this.binding = null;
		}
		if ( this.node.getAttribute( 'contenteditable' ) && attributes.value && attributes.value.bind() ) {
			return;
		}
		switch ( this.descriptor.e ) {
			case 'select':
			case 'textarea':
				if ( attributes.value ) {
					attributes.value.bind();
				}
				return;
			case 'input':
				if ( this.node.type === 'radio' || this.node.type === 'checkbox' ) {
					if ( attributes.name && attributes.name.bind() ) {
						return;
					}
					if ( attributes.checked && attributes.checked.bind() ) {
						return;
					}
				}
				if ( attributes.value && attributes.value.bind() ) {
					return;
				}
		}
	};

	var render_DomFragment_Element__Element = function( runloop, css, initialise, teardown, toString, find, findAll, findComponent, findAllComponents, bind ) {

		var DomElement = function( options, docFrag ) {
			initialise( this, options, docFrag );
		};
		DomElement.prototype = {
			detach: function() {
				var Component;
				if ( this.node ) {
					if ( this.node.parentNode ) {
						this.node.parentNode.removeChild( this.node );
					}
					return this.node;
				}
				if ( this.cssDetachQueue.length ) {
					runloop.start();
					while ( Component === this.cssDetachQueue.pop() ) {
						css.remove( Component );
					}
					runloop.end();
				}
			},
			teardown: teardown,
			firstNode: function() {
				return this.node;
			},
			findNextNode: function() {
				return null;
			},
			bubble: function() {},
			toString: toString,
			find: find,
			findAll: findAll,
			findComponent: findComponent,
			findAllComponents: findAllComponents,
			bind: bind
		};
		return DomElement;
	}( global_runloop, global_css, render_DomFragment_Element_initialise__initialise, render_DomFragment_Element_prototype_teardown, render_DomFragment_Element_prototype_toString, render_DomFragment_Element_prototype_find, render_DomFragment_Element_prototype_findAll, render_DomFragment_Element_prototype_findComponent, render_DomFragment_Element_prototype_findAllComponents, render_DomFragment_Element_prototype_bind );

	var config_errors = {
		missingParser: 'Missing Ractive.parse - cannot parse template. Either preparse or use the version that includes the parser'
	};

	var registries_partials = {};

	var parse_utils_stripHtmlComments = function( html ) {
		var commentStart, commentEnd, processed;
		processed = '';
		while ( html.length ) {
			commentStart = html.indexOf( '<!--' );
			commentEnd = html.indexOf( '-->' );
			if ( commentStart === -1 && commentEnd === -1 ) {
				processed += html;
				break;
			}
			if ( commentStart !== -1 && commentEnd === -1 ) {
				throw 'Illegal HTML - expected closing comment sequence (\'-->\')';
			}
			if ( commentEnd !== -1 && commentStart === -1 || commentEnd < commentStart ) {
				throw 'Illegal HTML - unexpected closing comment sequence (\'-->\')';
			}
			processed += html.substr( 0, commentStart );
			html = html.substring( commentEnd + 3 );
		}
		return processed;
	};

	var parse_utils_stripStandalones = function( types ) {

		return function( tokens ) {
			var i, current, backOne, backTwo, leadingLinebreak, trailingLinebreak;
			leadingLinebreak = /^\s*\r?\n/;
			trailingLinebreak = /\r?\n\s*$/;
			for ( i = 2; i < tokens.length; i += 1 ) {
				current = tokens[ i ];
				backOne = tokens[ i - 1 ];
				backTwo = tokens[ i - 2 ];
				if ( current.type === types.TEXT && ( backOne.type === types.MUSTACHE && backOne.mustacheType !== types.PARTIAL ) && backTwo.type === types.TEXT ) {
					if ( trailingLinebreak.test( backTwo.value ) && leadingLinebreak.test( current.value ) ) {
						if ( backOne.mustacheType !== types.INTERPOLATOR && backOne.mustacheType !== types.TRIPLE ) {
							backTwo.value = backTwo.value.replace( trailingLinebreak, '\n' );
						}
						current.value = current.value.replace( leadingLinebreak, '' );
						if ( current.value === '' ) {
							tokens.splice( i--, 1 );
						}
					}
				}
			}
			return tokens;
		};
	}( config_types );

	var parse_utils_stripCommentTokens = function( types ) {

		return function( tokens ) {
			var i, current, previous, next;
			for ( i = 0; i < tokens.length; i += 1 ) {
				current = tokens[ i ];
				previous = tokens[ i - 1 ];
				next = tokens[ i + 1 ];
				if ( current.mustacheType === types.COMMENT || current.mustacheType === types.DELIMCHANGE ) {
					tokens.splice( i, 1 );
					if ( previous && next ) {
						if ( previous.type === types.TEXT && next.type === types.TEXT ) {
							previous.value += next.value;
							tokens.splice( i, 1 );
						}
					}
					i -= 1;
				}
			}
			return tokens;
		};
	}( config_types );

	var parse_Tokenizer_getMustache_getDelimiterChange = function( makeRegexMatcher ) {

		var getDelimiter = makeRegexMatcher( /^[^\s=]+/ );
		return function( tokenizer ) {
			var start, opening, closing;
			if ( !tokenizer.getStringMatch( '=' ) ) {
				return null;
			}
			start = tokenizer.pos;
			tokenizer.allowWhitespace();
			opening = getDelimiter( tokenizer );
			if ( !opening ) {
				tokenizer.pos = start;
				return null;
			}
			tokenizer.allowWhitespace();
			closing = getDelimiter( tokenizer );
			if ( !closing ) {
				tokenizer.pos = start;
				return null;
			}
			tokenizer.allowWhitespace();
			if ( !tokenizer.getStringMatch( '=' ) ) {
				tokenizer.pos = start;
				return null;
			}
			return [
				opening,
				closing
			];
		};
	}( parse_Tokenizer_utils_makeRegexMatcher );

	var parse_Tokenizer_getMustache_getMustacheType = function( types ) {

		var mustacheTypes = {
			'#': types.SECTION,
			'^': types.INVERTED,
			'/': types.CLOSING,
			'>': types.PARTIAL,
			'!': types.COMMENT,
			'&': types.TRIPLE
		};
		return function( tokenizer ) {
			var type = mustacheTypes[ tokenizer.str.charAt( tokenizer.pos ) ];
			if ( !type ) {
				return null;
			}
			tokenizer.pos += 1;
			return type;
		};
	}( config_types );

	var parse_Tokenizer_getMustache_getMustacheContent = function( types, makeRegexMatcher, getMustacheType ) {

		var getIndexRef = makeRegexMatcher( /^\s*:\s*([a-zA-Z_$][a-zA-Z_$0-9]*)/ ),
			arrayMember = /^[0-9][1-9]*$/;
		return function( tokenizer, isTriple ) {
			var start, mustache, type, expr, i, remaining, index, delimiter;
			start = tokenizer.pos;
			mustache = {
				type: isTriple ? types.TRIPLE : types.MUSTACHE
			};
			if ( !isTriple ) {
				if ( expr = tokenizer.getExpression() ) {
					mustache.mustacheType = types.INTERPOLATOR;
					tokenizer.allowWhitespace();
					if ( tokenizer.getStringMatch( tokenizer.delimiters[ 1 ] ) ) {
						tokenizer.pos -= tokenizer.delimiters[ 1 ].length;
					} else {
						tokenizer.pos = start;
						expr = null;
					}
				}
				if ( !expr ) {
					type = getMustacheType( tokenizer );
					if ( type === types.TRIPLE ) {
						mustache = {
							type: types.TRIPLE
						};
					} else {
						mustache.mustacheType = type || types.INTERPOLATOR;
					}
					if ( type === types.COMMENT || type === types.CLOSING ) {
						remaining = tokenizer.remaining();
						index = remaining.indexOf( tokenizer.delimiters[ 1 ] );
						if ( index !== -1 ) {
							mustache.ref = remaining.substr( 0, index );
							tokenizer.pos += index;
							return mustache;
						}
					}
				}
			}
			if ( !expr ) {
				tokenizer.allowWhitespace();
				expr = tokenizer.getExpression();
				remaining = tokenizer.remaining();
				delimiter = isTriple ? tokenizer.tripleDelimiters[ 1 ] : tokenizer.delimiters[ 1 ];
				if ( remaining.substr( 0, delimiter.length ) !== delimiter && remaining.charAt( 0 ) !== ':' ) {
					tokenizer.pos = start;
					remaining = tokenizer.remaining();
					index = remaining.indexOf( tokenizer.delimiters[ 1 ] );
					if ( index !== -1 ) {
						mustache.ref = remaining.substr( 0, index ).trim();
						tokenizer.pos += index;
						return mustache;
					}
				}
			}
			while ( expr.t === types.BRACKETED && expr.x ) {
				expr = expr.x;
			}
			if ( expr.t === types.REFERENCE ) {
				mustache.ref = expr.n;
			} else if ( expr.t === types.NUMBER_LITERAL && arrayMember.test( expr.v ) ) {
				mustache.ref = expr.v;
			} else {
				mustache.expression = expr;
			}
			i = getIndexRef( tokenizer );
			if ( i !== null ) {
				mustache.indexRef = i;
			}
			return mustache;
		};
	}( config_types, parse_Tokenizer_utils_makeRegexMatcher, parse_Tokenizer_getMustache_getMustacheType );

	var parse_Tokenizer_getMustache__getMustache = function( types, getDelimiterChange, getMustacheContent ) {

		return function() {
			var seekTripleFirst = this.tripleDelimiters[ 0 ].length > this.delimiters[ 0 ].length;
			return getMustache( this, seekTripleFirst ) || getMustache( this, !seekTripleFirst );
		};

		function getMustache( tokenizer, seekTriple ) {
			var start = tokenizer.pos,
				content, delimiters;
			delimiters = seekTriple ? tokenizer.tripleDelimiters : tokenizer.delimiters;
			if ( !tokenizer.getStringMatch( delimiters[ 0 ] ) ) {
				return null;
			}
			content = getDelimiterChange( tokenizer );
			if ( content ) {
				if ( !tokenizer.getStringMatch( delimiters[ 1 ] ) ) {
					tokenizer.pos = start;
					return null;
				}
				tokenizer[ seekTriple ? 'tripleDelimiters' : 'delimiters' ] = content;
				return {
					type: types.MUSTACHE,
					mustacheType: types.DELIMCHANGE
				};
			}
			tokenizer.allowWhitespace();
			content = getMustacheContent( tokenizer, seekTriple );
			if ( content === null ) {
				tokenizer.pos = start;
				return null;
			}
			tokenizer.allowWhitespace();
			if ( !tokenizer.getStringMatch( delimiters[ 1 ] ) ) {
				tokenizer.pos = start;
				return null;
			}
			return content;
		}
	}( config_types, parse_Tokenizer_getMustache_getDelimiterChange, parse_Tokenizer_getMustache_getMustacheContent );

	var parse_Tokenizer_getComment_getComment = function( types ) {

		return function() {
			var content, remaining, endIndex;
			if ( !this.getStringMatch( '<!--' ) ) {
				return null;
			}
			remaining = this.remaining();
			endIndex = remaining.indexOf( '-->' );
			if ( endIndex === -1 ) {
				throw new Error( 'Unexpected end of input (expected "-->" to close comment)' );
			}
			content = remaining.substr( 0, endIndex );
			this.pos += endIndex + 3;
			return {
				type: types.COMMENT,
				content: content
			};
		};
	}( config_types );

	var parse_Tokenizer_utils_getLowestIndex = function( haystack, needles ) {
		var i, index, lowest;
		i = needles.length;
		while ( i-- ) {
			index = haystack.indexOf( needles[ i ] );
			if ( !index ) {
				return 0;
			}
			if ( index === -1 ) {
				continue;
			}
			if ( !lowest || index < lowest ) {
				lowest = index;
			}
		}
		return lowest || -1;
	};

	var parse_Tokenizer_getTag__getTag = function( types, makeRegexMatcher, getLowestIndex ) {

		var getTag, getOpeningTag, getClosingTag, getTagName, getAttributes, getAttribute, getAttributeName, getAttributeValue, getUnquotedAttributeValue, getUnquotedAttributeValueToken, getUnquotedAttributeValueText, getQuotedStringToken, getQuotedAttributeValue;
		getTag = function() {
			return getOpeningTag( this ) || getClosingTag( this );
		};
		getOpeningTag = function( tokenizer ) {
			var start, tag, attrs, lowerCaseName;
			start = tokenizer.pos;
			if ( tokenizer.inside ) {
				return null;
			}
			if ( !tokenizer.getStringMatch( '<' ) ) {
				return null;
			}
			tag = {
				type: types.TAG
			};
			if ( tokenizer.getStringMatch( '!' ) ) {
				tag.doctype = true;
			}
			tag.name = getTagName( tokenizer );
			if ( !tag.name ) {
				tokenizer.pos = start;
				return null;
			}
			attrs = getAttributes( tokenizer );
			if ( attrs ) {
				tag.attrs = attrs;
			}
			tokenizer.allowWhitespace();
			if ( tokenizer.getStringMatch( '/' ) ) {
				tag.selfClosing = true;
			}
			if ( !tokenizer.getStringMatch( '>' ) ) {
				tokenizer.pos = start;
				return null;
			}
			lowerCaseName = tag.name.toLowerCase();
			if ( lowerCaseName === 'script' || lowerCaseName === 'style' ) {
				tokenizer.inside = lowerCaseName;
			}
			return tag;
		};
		getClosingTag = function( tokenizer ) {
			var start, tag, expected;
			start = tokenizer.pos;
			expected = function( str ) {
				throw new Error( 'Unexpected character ' + tokenizer.remaining().charAt( 0 ) + ' (expected ' + str + ')' );
			};
			if ( !tokenizer.getStringMatch( '<' ) ) {
				return null;
			}
			tag = {
				type: types.TAG,
				closing: true
			};
			if ( !tokenizer.getStringMatch( '/' ) ) {
				expected( '"/"' );
			}
			tag.name = getTagName( tokenizer );
			if ( !tag.name ) {
				expected( 'tag name' );
			}
			if ( !tokenizer.getStringMatch( '>' ) ) {
				expected( '">"' );
			}
			if ( tokenizer.inside ) {
				if ( tag.name.toLowerCase() !== tokenizer.inside ) {
					tokenizer.pos = start;
					return null;
				}
				tokenizer.inside = null;
			}
			return tag;
		};
		getTagName = makeRegexMatcher( /^[a-zA-Z]{1,}:?[a-zA-Z0-9\-]*/ );
		getAttributes = function( tokenizer ) {
			var start, attrs, attr;
			start = tokenizer.pos;
			tokenizer.allowWhitespace();
			attr = getAttribute( tokenizer );
			if ( !attr ) {
				tokenizer.pos = start;
				return null;
			}
			attrs = [];
			while ( attr !== null ) {
				attrs.push( attr );
				tokenizer.allowWhitespace();
				attr = getAttribute( tokenizer );
			}
			return attrs;
		};
		getAttribute = function( tokenizer ) {
			var attr, name, value;
			name = getAttributeName( tokenizer );
			if ( !name ) {
				return null;
			}
			attr = {
				name: name
			};
			value = getAttributeValue( tokenizer );
			if ( value ) {
				attr.value = value;
			}
			return attr;
		};
		getAttributeName = makeRegexMatcher( /^[^\s"'>\/=]+/ );
		getAttributeValue = function( tokenizer ) {
			var start, value;
			start = tokenizer.pos;
			tokenizer.allowWhitespace();
			if ( !tokenizer.getStringMatch( '=' ) ) {
				tokenizer.pos = start;
				return null;
			}
			tokenizer.allowWhitespace();
			value = getQuotedAttributeValue( tokenizer, '\'' ) || getQuotedAttributeValue( tokenizer, '"' ) || getUnquotedAttributeValue( tokenizer );
			if ( value === null ) {
				tokenizer.pos = start;
				return null;
			}
			return value;
		};
		getUnquotedAttributeValueText = makeRegexMatcher( /^[^\s"'=<>`]+/ );
		getUnquotedAttributeValueToken = function( tokenizer ) {
			var start, text, index;
			start = tokenizer.pos;
			text = getUnquotedAttributeValueText( tokenizer );
			if ( !text ) {
				return null;
			}
			if ( ( index = text.indexOf( tokenizer.delimiters[ 0 ] ) ) !== -1 ) {
				text = text.substr( 0, index );
				tokenizer.pos = start + text.length;
			}
			return {
				type: types.TEXT,
				value: text
			};
		};
		getUnquotedAttributeValue = function( tokenizer ) {
			var tokens, token;
			tokens = [];
			token = tokenizer.getMustache() || getUnquotedAttributeValueToken( tokenizer );
			while ( token !== null ) {
				tokens.push( token );
				token = tokenizer.getMustache() || getUnquotedAttributeValueToken( tokenizer );
			}
			if ( !tokens.length ) {
				return null;
			}
			return tokens;
		};
		getQuotedAttributeValue = function( tokenizer, quoteMark ) {
			var start, tokens, token;
			start = tokenizer.pos;
			if ( !tokenizer.getStringMatch( quoteMark ) ) {
				return null;
			}
			tokens = [];
			token = tokenizer.getMustache() || getQuotedStringToken( tokenizer, quoteMark );
			while ( token !== null ) {
				tokens.push( token );
				token = tokenizer.getMustache() || getQuotedStringToken( tokenizer, quoteMark );
			}
			if ( !tokenizer.getStringMatch( quoteMark ) ) {
				tokenizer.pos = start;
				return null;
			}
			return tokens;
		};
		getQuotedStringToken = function( tokenizer, quoteMark ) {
			var start, index, remaining;
			start = tokenizer.pos;
			remaining = tokenizer.remaining();
			index = getLowestIndex( remaining, [
				quoteMark,
				tokenizer.delimiters[ 0 ],
				tokenizer.delimiters[ 1 ]
			] );
			if ( index === -1 ) {
				throw new Error( 'Quoted attribute value must have a closing quote' );
			}
			if ( !index ) {
				return null;
			}
			tokenizer.pos += index;
			return {
				type: types.TEXT,
				value: remaining.substr( 0, index )
			};
		};
		return getTag;
	}( config_types, parse_Tokenizer_utils_makeRegexMatcher, parse_Tokenizer_utils_getLowestIndex );

	var parse_Tokenizer_getText__getText = function( types, getLowestIndex ) {

		return function() {
			var index, remaining, barrier;
			remaining = this.remaining();
			barrier = this.inside ? '</' + this.inside : '<';
			if ( this.inside && !this.interpolate[ this.inside ] ) {
				index = remaining.indexOf( barrier );
			} else {
				index = getLowestIndex( remaining, [
					barrier,
					this.delimiters[ 0 ],
					this.tripleDelimiters[ 0 ]
				] );
			}
			if ( !index ) {
				return null;
			}
			if ( index === -1 ) {
				index = remaining.length;
			}
			this.pos += index;
			return {
				type: types.TEXT,
				value: remaining.substr( 0, index )
			};
		};
	}( config_types, parse_Tokenizer_utils_getLowestIndex );

	var parse_Tokenizer_getExpression_getPrimary_getLiteral_getBooleanLiteral = function( types ) {

		return function( tokenizer ) {
			var remaining = tokenizer.remaining();
			if ( remaining.substr( 0, 4 ) === 'true' ) {
				tokenizer.pos += 4;
				return {
					t: types.BOOLEAN_LITERAL,
					v: 'true'
				};
			}
			if ( remaining.substr( 0, 5 ) === 'false' ) {
				tokenizer.pos += 5;
				return {
					t: types.BOOLEAN_LITERAL,
					v: 'false'
				};
			}
			return null;
		};
	}( config_types );

	var parse_Tokenizer_getExpression_getPrimary_getLiteral_getObjectLiteral_getKeyValuePair = function( types, getKey ) {

		return function( tokenizer ) {
			var start, key, value;
			start = tokenizer.pos;
			tokenizer.allowWhitespace();
			key = getKey( tokenizer );
			if ( key === null ) {
				tokenizer.pos = start;
				return null;
			}
			tokenizer.allowWhitespace();
			if ( !tokenizer.getStringMatch( ':' ) ) {
				tokenizer.pos = start;
				return null;
			}
			tokenizer.allowWhitespace();
			value = tokenizer.getExpression();
			if ( value === null ) {
				tokenizer.pos = start;
				return null;
			}
			return {
				t: types.KEY_VALUE_PAIR,
				k: key,
				v: value
			};
		};
	}( config_types, parse_Tokenizer_getExpression_shared_getKey );

	var parse_Tokenizer_getExpression_getPrimary_getLiteral_getObjectLiteral_getKeyValuePairs = function( getKeyValuePair ) {

		return function getKeyValuePairs( tokenizer ) {
			var start, pairs, pair, keyValuePairs;
			start = tokenizer.pos;
			pair = getKeyValuePair( tokenizer );
			if ( pair === null ) {
				return null;
			}
			pairs = [ pair ];
			if ( tokenizer.getStringMatch( ',' ) ) {
				keyValuePairs = getKeyValuePairs( tokenizer );
				if ( !keyValuePairs ) {
					tokenizer.pos = start;
					return null;
				}
				return pairs.concat( keyValuePairs );
			}
			return pairs;
		};
	}( parse_Tokenizer_getExpression_getPrimary_getLiteral_getObjectLiteral_getKeyValuePair );

	var parse_Tokenizer_getExpression_getPrimary_getLiteral_getObjectLiteral__getObjectLiteral = function( types, getKeyValuePairs ) {

		return function( tokenizer ) {
			var start, keyValuePairs;
			start = tokenizer.pos;
			tokenizer.allowWhitespace();
			if ( !tokenizer.getStringMatch( '{' ) ) {
				tokenizer.pos = start;
				return null;
			}
			keyValuePairs = getKeyValuePairs( tokenizer );
			tokenizer.allowWhitespace();
			if ( !tokenizer.getStringMatch( '}' ) ) {
				tokenizer.pos = start;
				return null;
			}
			return {
				t: types.OBJECT_LITERAL,
				m: keyValuePairs
			};
		};
	}( config_types, parse_Tokenizer_getExpression_getPrimary_getLiteral_getObjectLiteral_getKeyValuePairs );

	var parse_Tokenizer_getExpression_shared_getExpressionList = function getExpressionList( tokenizer ) {
		var start, expressions, expr, next;
		start = tokenizer.pos;
		tokenizer.allowWhitespace();
		expr = tokenizer.getExpression();
		if ( expr === null ) {
			return null;
		}
		expressions = [ expr ];
		tokenizer.allowWhitespace();
		if ( tokenizer.getStringMatch( ',' ) ) {
			next = getExpressionList( tokenizer );
			if ( next === null ) {
				tokenizer.pos = start;
				return null;
			}
			expressions = expressions.concat( next );
		}
		return expressions;
	};

	var parse_Tokenizer_getExpression_getPrimary_getLiteral_getArrayLiteral = function( types, getExpressionList ) {

		return function( tokenizer ) {
			var start, expressionList;
			start = tokenizer.pos;
			tokenizer.allowWhitespace();
			if ( !tokenizer.getStringMatch( '[' ) ) {
				tokenizer.pos = start;
				return null;
			}
			expressionList = getExpressionList( tokenizer );
			if ( !tokenizer.getStringMatch( ']' ) ) {
				tokenizer.pos = start;
				return null;
			}
			return {
				t: types.ARRAY_LITERAL,
				m: expressionList
			};
		};
	}( config_types, parse_Tokenizer_getExpression_shared_getExpressionList );

	var parse_Tokenizer_getExpression_getPrimary_getLiteral__getLiteral = function( getNumberLiteral, getBooleanLiteral, getStringLiteral, getObjectLiteral, getArrayLiteral ) {

		return function( tokenizer ) {
			var literal = getNumberLiteral( tokenizer ) || getBooleanLiteral( tokenizer ) || getStringLiteral( tokenizer ) || getObjectLiteral( tokenizer ) || getArrayLiteral( tokenizer );
			return literal;
		};
	}( parse_Tokenizer_getExpression_getPrimary_getLiteral_getNumberLiteral, parse_Tokenizer_getExpression_getPrimary_getLiteral_getBooleanLiteral, parse_Tokenizer_getExpression_getPrimary_getLiteral_getStringLiteral__getStringLiteral, parse_Tokenizer_getExpression_getPrimary_getLiteral_getObjectLiteral__getObjectLiteral, parse_Tokenizer_getExpression_getPrimary_getLiteral_getArrayLiteral );

	var parse_Tokenizer_getExpression_getPrimary_getReference = function( types, makeRegexMatcher, getName ) {

		var getDotRefinement, getArrayRefinement, getArrayMember, globals;
		getDotRefinement = makeRegexMatcher( /^\.[a-zA-Z_$0-9]+/ );
		getArrayRefinement = function( tokenizer ) {
			var num = getArrayMember( tokenizer );
			if ( num ) {
				return '.' + num;
			}
			return null;
		};
		getArrayMember = makeRegexMatcher( /^\[(0|[1-9][0-9]*)\]/ );
		globals = /^(?:Array|Date|RegExp|decodeURIComponent|decodeURI|encodeURIComponent|encodeURI|isFinite|isNaN|parseFloat|parseInt|JSON|Math|NaN|undefined|null)$/;
		return function( tokenizer ) {
			var startPos, ancestor, name, dot, combo, refinement, lastDotIndex;
			startPos = tokenizer.pos;
			ancestor = '';
			while ( tokenizer.getStringMatch( '../' ) ) {
				ancestor += '../';
			}
			if ( !ancestor ) {
				dot = tokenizer.getStringMatch( '.' ) || '';
			}
			name = getName( tokenizer ) || '';
			if ( !ancestor && !dot && globals.test( name ) ) {
				return {
					t: types.GLOBAL,
					v: name
				};
			}
			if ( name === 'this' && !ancestor && !dot ) {
				name = '.';
				startPos += 3;
			}
			combo = ( ancestor || dot ) + name;
			if ( !combo ) {
				return null;
			}
			while ( refinement = getDotRefinement( tokenizer ) || getArrayRefinement( tokenizer ) ) {
				combo += refinement;
			}
			if ( tokenizer.getStringMatch( '(' ) ) {
				lastDotIndex = combo.lastIndexOf( '.' );
				if ( lastDotIndex !== -1 ) {
					combo = combo.substr( 0, lastDotIndex );
					tokenizer.pos = startPos + combo.length;
				} else {
					tokenizer.pos -= 1;
				}
			}
			return {
				t: types.REFERENCE,
				n: combo
			};
		};
	}( config_types, parse_Tokenizer_utils_makeRegexMatcher, parse_Tokenizer_getExpression_shared_getName );

	var parse_Tokenizer_getExpression_getPrimary_getBracketedExpression = function( types ) {

		return function( tokenizer ) {
			var start, expr;
			start = tokenizer.pos;
			if ( !tokenizer.getStringMatch( '(' ) ) {
				return null;
			}
			tokenizer.allowWhitespace();
			expr = tokenizer.getExpression();
			if ( !expr ) {
				tokenizer.pos = start;
				return null;
			}
			tokenizer.allowWhitespace();
			if ( !tokenizer.getStringMatch( ')' ) ) {
				tokenizer.pos = start;
				return null;
			}
			return {
				t: types.BRACKETED,
				x: expr
			};
		};
	}( config_types );

	var parse_Tokenizer_getExpression_getPrimary__getPrimary = function( getLiteral, getReference, getBracketedExpression ) {

		return function( tokenizer ) {
			return getLiteral( tokenizer ) || getReference( tokenizer ) || getBracketedExpression( tokenizer );
		};
	}( parse_Tokenizer_getExpression_getPrimary_getLiteral__getLiteral, parse_Tokenizer_getExpression_getPrimary_getReference, parse_Tokenizer_getExpression_getPrimary_getBracketedExpression );

	var parse_Tokenizer_getExpression_shared_getRefinement = function( types, getName ) {

		return function getRefinement( tokenizer ) {
			var start, name, expr;
			start = tokenizer.pos;
			tokenizer.allowWhitespace();
			if ( tokenizer.getStringMatch( '.' ) ) {
				tokenizer.allowWhitespace();
				if ( name = getName( tokenizer ) ) {
					return {
						t: types.REFINEMENT,
						n: name
					};
				}
				tokenizer.expected( 'a property name' );
			}
			if ( tokenizer.getStringMatch( '[' ) ) {
				tokenizer.allowWhitespace();
				expr = tokenizer.getExpression();
				if ( !expr ) {
					tokenizer.expected( 'an expression' );
				}
				tokenizer.allowWhitespace();
				if ( !tokenizer.getStringMatch( ']' ) ) {
					tokenizer.expected( '"]"' );
				}
				return {
					t: types.REFINEMENT,
					x: expr
				};
			}
			return null;
		};
	}( config_types, parse_Tokenizer_getExpression_shared_getName );

	var parse_Tokenizer_getExpression_getMemberOrInvocation = function( types, getPrimary, getExpressionList, getRefinement ) {

		return function( tokenizer ) {
			var current, expression, refinement, expressionList;
			expression = getPrimary( tokenizer );
			if ( !expression ) {
				return null;
			}
			while ( expression ) {
				current = tokenizer.pos;
				if ( refinement = getRefinement( tokenizer ) ) {
					expression = {
						t: types.MEMBER,
						x: expression,
						r: refinement
					};
				} else if ( tokenizer.getStringMatch( '(' ) ) {
					tokenizer.allowWhitespace();
					expressionList = getExpressionList( tokenizer );
					tokenizer.allowWhitespace();
					if ( !tokenizer.getStringMatch( ')' ) ) {
						tokenizer.pos = current;
						break;
					}
					expression = {
						t: types.INVOCATION,
						x: expression
					};
					if ( expressionList ) {
						expression.o = expressionList;
					}
				} else {
					break;
				}
			}
			return expression;
		};
	}( config_types, parse_Tokenizer_getExpression_getPrimary__getPrimary, parse_Tokenizer_getExpression_shared_getExpressionList, parse_Tokenizer_getExpression_shared_getRefinement );

	var parse_Tokenizer_getExpression_getTypeOf = function( types, getMemberOrInvocation ) {

		var getTypeOf, makePrefixSequenceMatcher;
		makePrefixSequenceMatcher = function( symbol, fallthrough ) {
			return function( tokenizer ) {
				var start, expression;
				if ( !tokenizer.getStringMatch( symbol ) ) {
					return fallthrough( tokenizer );
				}
				start = tokenizer.pos;
				tokenizer.allowWhitespace();
				expression = tokenizer.getExpression();
				if ( !expression ) {
					tokenizer.expected( 'an expression' );
				}
				return {
					s: symbol,
					o: expression,
					t: types.PREFIX_OPERATOR
				};
			};
		};
		( function() {
			var i, len, matcher, prefixOperators, fallthrough;
			prefixOperators = '! ~ + - typeof'.split( ' ' );
			fallthrough = getMemberOrInvocation;
			for ( i = 0, len = prefixOperators.length; i < len; i += 1 ) {
				matcher = makePrefixSequenceMatcher( prefixOperators[ i ], fallthrough );
				fallthrough = matcher;
			}
			getTypeOf = fallthrough;
		}() );
		return getTypeOf;
	}( config_types, parse_Tokenizer_getExpression_getMemberOrInvocation );

	var parse_Tokenizer_getExpression_getLogicalOr = function( types, getTypeOf ) {

		var getLogicalOr, makeInfixSequenceMatcher;
		makeInfixSequenceMatcher = function( symbol, fallthrough ) {
			return function( tokenizer ) {
				var start, left, right;
				left = fallthrough( tokenizer );
				if ( !left ) {
					return null;
				}
				while ( true ) {
					start = tokenizer.pos;
					tokenizer.allowWhitespace();
					if ( !tokenizer.getStringMatch( symbol ) ) {
						tokenizer.pos = start;
						return left;
					}
					if ( symbol === 'in' && /[a-zA-Z_$0-9]/.test( tokenizer.remaining().charAt( 0 ) ) ) {
						tokenizer.pos = start;
						return left;
					}
					tokenizer.allowWhitespace();
					right = fallthrough( tokenizer );
					if ( !right ) {
						tokenizer.pos = start;
						return left;
					}
					left = {
						t: types.INFIX_OPERATOR,
						s: symbol,
						o: [
							left,
							right
						]
					};
				}
			};
		};
		( function() {
			var i, len, matcher, infixOperators, fallthrough;
			infixOperators = '* / % + - << >> >>> < <= > >= in instanceof == != === !== & ^ | && ||'.split( ' ' );
			fallthrough = getTypeOf;
			for ( i = 0, len = infixOperators.length; i < len; i += 1 ) {
				matcher = makeInfixSequenceMatcher( infixOperators[ i ], fallthrough );
				fallthrough = matcher;
			}
			getLogicalOr = fallthrough;
		}() );
		return getLogicalOr;
	}( config_types, parse_Tokenizer_getExpression_getTypeOf );

	var parse_Tokenizer_getExpression_getConditional = function( types, getLogicalOr ) {

		return function( tokenizer ) {
			var start, expression, ifTrue, ifFalse;
			expression = getLogicalOr( tokenizer );
			if ( !expression ) {
				return null;
			}
			start = tokenizer.pos;
			tokenizer.allowWhitespace();
			if ( !tokenizer.getStringMatch( '?' ) ) {
				tokenizer.pos = start;
				return expression;
			}
			tokenizer.allowWhitespace();
			ifTrue = tokenizer.getExpression();
			if ( !ifTrue ) {
				tokenizer.pos = start;
				return expression;
			}
			tokenizer.allowWhitespace();
			if ( !tokenizer.getStringMatch( ':' ) ) {
				tokenizer.pos = start;
				return expression;
			}
			tokenizer.allowWhitespace();
			ifFalse = tokenizer.getExpression();
			if ( !ifFalse ) {
				tokenizer.pos = start;
				return expression;
			}
			return {
				t: types.CONDITIONAL,
				o: [
					expression,
					ifTrue,
					ifFalse
				]
			};
		};
	}( config_types, parse_Tokenizer_getExpression_getLogicalOr );

	var parse_Tokenizer_getExpression__getExpression = function( getConditional ) {

		return function() {
			return getConditional( this );
		};
	}( parse_Tokenizer_getExpression_getConditional );

	var parse_Tokenizer__Tokenizer = function( getMustache, getComment, getTag, getText, getExpression, allowWhitespace, getStringMatch ) {

		var Tokenizer;
		Tokenizer = function( str, options ) {
			var token;
			this.str = str;
			this.pos = 0;
			this.delimiters = options.delimiters;
			this.tripleDelimiters = options.tripleDelimiters;
			this.interpolate = options.interpolate;
			this.tokens = [];
			while ( this.pos < this.str.length ) {
				token = this.getToken();
				if ( token === null && this.remaining() ) {
					this.fail();
				}
				this.tokens.push( token );
			}
		};
		Tokenizer.prototype = {
			getToken: function() {
				var token = this.getMustache() || this.getComment() || this.getTag() || this.getText();
				return token;
			},
			getMustache: getMustache,
			getComment: getComment,
			getTag: getTag,
			getText: getText,
			getExpression: getExpression,
			allowWhitespace: allowWhitespace,
			getStringMatch: getStringMatch,
			remaining: function() {
				return this.str.substring( this.pos );
			},
			fail: function() {
				var last20, next20;
				last20 = this.str.substr( 0, this.pos ).substr( -20 );
				if ( last20.length === 20 ) {
					last20 = '...' + last20;
				}
				next20 = this.remaining().substr( 0, 20 );
				if ( next20.length === 20 ) {
					next20 = next20 + '...';
				}
				throw new Error( 'Could not parse template: ' + ( last20 ? last20 + '<- ' : '' ) + 'failed at character ' + this.pos + ' ->' + next20 );
			},
			expected: function( thing ) {
				var remaining = this.remaining().substr( 0, 40 );
				if ( remaining.length === 40 ) {
					remaining += '...';
				}
				throw new Error( 'Tokenizer failed: unexpected string "' + remaining + '" (expected ' + thing + ')' );
			}
		};
		return Tokenizer;
	}( parse_Tokenizer_getMustache__getMustache, parse_Tokenizer_getComment_getComment, parse_Tokenizer_getTag__getTag, parse_Tokenizer_getText__getText, parse_Tokenizer_getExpression__getExpression, parse_Tokenizer_utils_allowWhitespace, parse_Tokenizer_utils_getStringMatch );

	var parse_tokenize = function( initOptions, stripHtmlComments, stripStandalones, stripCommentTokens, Tokenizer ) {

		return function( template, options ) {
			var tokenizer, tokens;
			options = options || {};
			if ( options.stripComments !== false ) {
				template = stripHtmlComments( template );
			}
			tokenizer = new Tokenizer( template, {
				delimiters: options.delimiters || initOptions.defaults.delimiters,
				tripleDelimiters: options.tripleDelimiters || initOptions.defaults.tripleDelimiters,
				interpolate: {
					script: options.interpolateScripts !== false ? true : false,
					style: options.interpolateStyles !== false ? true : false
				}
			} );
			tokens = tokenizer.tokens;
			stripStandalones( tokens );
			stripCommentTokens( tokens );
			return tokens;
		};
	}( config_initOptions, parse_utils_stripHtmlComments, parse_utils_stripStandalones, parse_utils_stripCommentTokens, parse_Tokenizer__Tokenizer );

	var parse_Parser_getText_TextStub__TextStub = function( types ) {

		var TextStub, htmlEntities, controlCharacters, namedEntityPattern, hexEntityPattern, decimalEntityPattern, validateCode, decodeCharacterReferences, whitespace;
		TextStub = function( token, preserveWhitespace ) {
			this.text = preserveWhitespace ? token.value : token.value.replace( whitespace, ' ' );
		};
		TextStub.prototype = {
			type: types.TEXT,
			toJSON: function() {
				return this.decoded || ( this.decoded = decodeCharacterReferences( this.text ) );
			},
			toString: function() {
				return this.text;
			}
		};
		htmlEntities = {
			quot: 34,
			amp: 38,
			apos: 39,
			lt: 60,
			gt: 62,
			nbsp: 160,
			iexcl: 161,
			cent: 162,
			pound: 163,
			curren: 164,
			yen: 165,
			brvbar: 166,
			sect: 167,
			uml: 168,
			copy: 169,
			ordf: 170,
			laquo: 171,
			not: 172,
			shy: 173,
			reg: 174,
			macr: 175,
			deg: 176,
			plusmn: 177,
			sup2: 178,
			sup3: 179,
			acute: 180,
			micro: 181,
			para: 182,
			middot: 183,
			cedil: 184,
			sup1: 185,
			ordm: 186,
			raquo: 187,
			frac14: 188,
			frac12: 189,
			frac34: 190,
			iquest: 191,
			Agrave: 192,
			Aacute: 193,
			Acirc: 194,
			Atilde: 195,
			Auml: 196,
			Aring: 197,
			AElig: 198,
			Ccedil: 199,
			Egrave: 200,
			Eacute: 201,
			Ecirc: 202,
			Euml: 203,
			Igrave: 204,
			Iacute: 205,
			Icirc: 206,
			Iuml: 207,
			ETH: 208,
			Ntilde: 209,
			Ograve: 210,
			Oacute: 211,
			Ocirc: 212,
			Otilde: 213,
			Ouml: 214,
			times: 215,
			Oslash: 216,
			Ugrave: 217,
			Uacute: 218,
			Ucirc: 219,
			Uuml: 220,
			Yacute: 221,
			THORN: 222,
			szlig: 223,
			agrave: 224,
			aacute: 225,
			acirc: 226,
			atilde: 227,
			auml: 228,
			aring: 229,
			aelig: 230,
			ccedil: 231,
			egrave: 232,
			eacute: 233,
			ecirc: 234,
			euml: 235,
			igrave: 236,
			iacute: 237,
			icirc: 238,
			iuml: 239,
			eth: 240,
			ntilde: 241,
			ograve: 242,
			oacute: 243,
			ocirc: 244,
			otilde: 245,
			ouml: 246,
			divide: 247,
			oslash: 248,
			ugrave: 249,
			uacute: 250,
			ucirc: 251,
			uuml: 252,
			yacute: 253,
			thorn: 254,
			yuml: 255,
			OElig: 338,
			oelig: 339,
			Scaron: 352,
			scaron: 353,
			Yuml: 376,
			fnof: 402,
			circ: 710,
			tilde: 732,
			Alpha: 913,
			Beta: 914,
			Gamma: 915,
			Delta: 916,
			Epsilon: 917,
			Zeta: 918,
			Eta: 919,
			Theta: 920,
			Iota: 921,
			Kappa: 922,
			Lambda: 923,
			Mu: 924,
			Nu: 925,
			Xi: 926,
			Omicron: 927,
			Pi: 928,
			Rho: 929,
			Sigma: 931,
			Tau: 932,
			Upsilon: 933,
			Phi: 934,
			Chi: 935,
			Psi: 936,
			Omega: 937,
			alpha: 945,
			beta: 946,
			gamma: 947,
			delta: 948,
			epsilon: 949,
			zeta: 950,
			eta: 951,
			theta: 952,
			iota: 953,
			kappa: 954,
			lambda: 955,
			mu: 956,
			nu: 957,
			xi: 958,
			omicron: 959,
			pi: 960,
			rho: 961,
			sigmaf: 962,
			sigma: 963,
			tau: 964,
			upsilon: 965,
			phi: 966,
			chi: 967,
			psi: 968,
			omega: 969,
			thetasym: 977,
			upsih: 978,
			piv: 982,
			ensp: 8194,
			emsp: 8195,
			thinsp: 8201,
			zwnj: 8204,
			zwj: 8205,
			lrm: 8206,
			rlm: 8207,
			ndash: 8211,
			mdash: 8212,
			lsquo: 8216,
			rsquo: 8217,
			sbquo: 8218,
			ldquo: 8220,
			rdquo: 8221,
			bdquo: 8222,
			dagger: 8224,
			Dagger: 8225,
			bull: 8226,
			hellip: 8230,
			permil: 8240,
			prime: 8242,
			Prime: 8243,
			lsaquo: 8249,
			rsaquo: 8250,
			oline: 8254,
			frasl: 8260,
			euro: 8364,
			image: 8465,
			weierp: 8472,
			real: 8476,
			trade: 8482,
			alefsym: 8501,
			larr: 8592,
			uarr: 8593,
			rarr: 8594,
			darr: 8595,
			harr: 8596,
			crarr: 8629,
			lArr: 8656,
			uArr: 8657,
			rArr: 8658,
			dArr: 8659,
			hArr: 8660,
			forall: 8704,
			part: 8706,
			exist: 8707,
			empty: 8709,
			nabla: 8711,
			isin: 8712,
			notin: 8713,
			ni: 8715,
			prod: 8719,
			sum: 8721,
			minus: 8722,
			lowast: 8727,
			radic: 8730,
			prop: 8733,
			infin: 8734,
			ang: 8736,
			and: 8743,
			or: 8744,
			cap: 8745,
			cup: 8746,
			'int': 8747,
			there4: 8756,
			sim: 8764,
			cong: 8773,
			asymp: 8776,
			ne: 8800,
			equiv: 8801,
			le: 8804,
			ge: 8805,
			sub: 8834,
			sup: 8835,
			nsub: 8836,
			sube: 8838,
			supe: 8839,
			oplus: 8853,
			otimes: 8855,
			perp: 8869,
			sdot: 8901,
			lceil: 8968,
			rceil: 8969,
			lfloor: 8970,
			rfloor: 8971,
			lang: 9001,
			rang: 9002,
			loz: 9674,
			spades: 9824,
			clubs: 9827,
			hearts: 9829,
			diams: 9830
		};
		controlCharacters = [
			8364,
			129,
			8218,
			402,
			8222,
			8230,
			8224,
			8225,
			710,
			8240,
			352,
			8249,
			338,
			141,
			381,
			143,
			144,
			8216,
			8217,
			8220,
			8221,
			8226,
			8211,
			8212,
			732,
			8482,
			353,
			8250,
			339,
			157,
			382,
			376
		];
		namedEntityPattern = new RegExp( '&(' + Object.keys( htmlEntities ).join( '|' ) + ');?', 'g' );
		hexEntityPattern = /&#x([0-9]+);?/g;
		decimalEntityPattern = /&#([0-9]+);?/g;
		validateCode = function( code ) {
			if ( !code ) {
				return 65533;
			}
			if ( code === 10 ) {
				return 32;
			}
			if ( code < 128 ) {
				return code;
			}
			if ( code <= 159 ) {
				return controlCharacters[ code - 128 ];
			}
			if ( code < 55296 ) {
				return code;
			}
			if ( code <= 57343 ) {
				return 65533;
			}
			if ( code <= 65535 ) {
				return code;
			}
			return 65533;
		};
		decodeCharacterReferences = function( html ) {
			var result;
			result = html.replace( namedEntityPattern, function( match, name ) {
				if ( htmlEntities[ name ] ) {
					return String.fromCharCode( htmlEntities[ name ] );
				}
				return match;
			} );
			result = result.replace( hexEntityPattern, function( match, hex ) {
				return String.fromCharCode( validateCode( parseInt( hex, 16 ) ) );
			} );
			result = result.replace( decimalEntityPattern, function( match, charCode ) {
				return String.fromCharCode( validateCode( charCode ) );
			} );
			return result;
		};
		whitespace = /\s+/g;
		return TextStub;
	}( config_types );

	var parse_Parser_getText__getText = function( types, TextStub ) {

		return function( token, preserveWhitespace ) {
			if ( token.type === types.TEXT ) {
				this.pos += 1;
				return new TextStub( token, preserveWhitespace );
			}
			return null;
		};
	}( config_types, parse_Parser_getText_TextStub__TextStub );

	var parse_Parser_getComment_CommentStub__CommentStub = function( types ) {

		var CommentStub;
		CommentStub = function( token ) {
			this.content = token.content;
		};
		CommentStub.prototype = {
			toJSON: function() {
				return {
					t: types.COMMENT,
					f: this.content
				};
			},
			toString: function() {
				return '<!--' + this.content + '-->';
			}
		};
		return CommentStub;
	}( config_types );

	var parse_Parser_getComment__getComment = function( types, CommentStub ) {

		return function( token ) {
			if ( token.type === types.COMMENT ) {
				this.pos += 1;
				return new CommentStub( token, this.preserveWhitespace );
			}
			return null;
		};
	}( config_types, parse_Parser_getComment_CommentStub__CommentStub );

	var parse_Parser_getMustache_ExpressionStub__ExpressionStub = function( types, isObject ) {

		var ExpressionStub = function( token ) {
			this.refs = [];
			getRefs( token, this.refs );
			this.str = stringify( token, this.refs );
		};
		ExpressionStub.prototype = {
			toJSON: function() {
				if ( this.json ) {
					return this.json;
				}
				this.json = {
					r: this.refs,
					s: this.str
				};
				return this.json;
			}
		};
		return ExpressionStub;

		function quoteStringLiteral( str ) {
			return JSON.stringify( String( str ) );
		}

		function getRefs( token, refs ) {
			var i, list;
			if ( token.t === types.REFERENCE ) {
				if ( refs.indexOf( token.n ) === -1 ) {
					refs.unshift( token.n );
				}
			}
			list = token.o || token.m;
			if ( list ) {
				if ( isObject( list ) ) {
					getRefs( list, refs );
				} else {
					i = list.length;
					while ( i-- ) {
						getRefs( list[ i ], refs );
					}
				}
			}
			if ( token.x ) {
				getRefs( token.x, refs );
			}
			if ( token.r ) {
				getRefs( token.r, refs );
			}
			if ( token.v ) {
				getRefs( token.v, refs );
			}
		}

		function stringify( token, refs ) {
			var map = function( item ) {
				return stringify( item, refs );
			};
			switch ( token.t ) {
				case types.BOOLEAN_LITERAL:
				case types.GLOBAL:
				case types.NUMBER_LITERAL:
					return token.v;
				case types.STRING_LITERAL:
					return quoteStringLiteral( token.v );
				case types.ARRAY_LITERAL:
					return '[' + ( token.m ? token.m.map( map ).join( ',' ) : '' ) + ']';
				case types.OBJECT_LITERAL:
					return '{' + ( token.m ? token.m.map( map ).join( ',' ) : '' ) + '}';
				case types.KEY_VALUE_PAIR:
					return token.k + ':' + stringify( token.v, refs );
				case types.PREFIX_OPERATOR:
					return ( token.s === 'typeof' ? 'typeof ' : token.s ) + stringify( token.o, refs );
				case types.INFIX_OPERATOR:
					return stringify( token.o[ 0 ], refs ) + ( token.s.substr( 0, 2 ) === 'in' ? ' ' + token.s + ' ' : token.s ) + stringify( token.o[ 1 ], refs );
				case types.INVOCATION:
					return stringify( token.x, refs ) + '(' + ( token.o ? token.o.map( map ).join( ',' ) : '' ) + ')';
				case types.BRACKETED:
					return '(' + stringify( token.x, refs ) + ')';
				case types.MEMBER:
					return stringify( token.x, refs ) + stringify( token.r, refs );
				case types.REFINEMENT:
					return token.n ? '.' + token.n : '[' + stringify( token.x, refs ) + ']';
				case types.CONDITIONAL:
					return stringify( token.o[ 0 ], refs ) + '?' + stringify( token.o[ 1 ], refs ) + ':' + stringify( token.o[ 2 ], refs );
				case types.REFERENCE:
					return '${' + refs.indexOf( token.n ) + '}';
				default:
					throw new Error( 'Could not stringify expression token. This error is unexpected' );
			}
		}
	}( config_types, utils_isObject );

	var parse_Parser_getMustache_MustacheStub__MustacheStub = function( types, ExpressionStub ) {

		var MustacheStub = function( token, parser ) {
			this.type = token.type === types.TRIPLE ? types.TRIPLE : token.mustacheType;
			if ( token.ref ) {
				this.ref = token.ref;
			}
			if ( token.expression ) {
				this.expr = new ExpressionStub( token.expression );
			}
			parser.pos += 1;
		};
		MustacheStub.prototype = {
			toJSON: function() {
				var json;
				if ( this.json ) {
					return this.json;
				}
				json = {
					t: this.type
				};
				if ( this.ref ) {
					json.r = this.ref;
				}
				if ( this.expr ) {
					json.x = this.expr.toJSON();
				}
				this.json = json;
				return json;
			},
			toString: function() {
				return false;
			}
		};
		return MustacheStub;
	}( config_types, parse_Parser_getMustache_ExpressionStub__ExpressionStub );

	var parse_Parser_utils_stringifyStubs = function( items ) {
		var str = '',
			itemStr, i, len;
		if ( !items ) {
			return '';
		}
		for ( i = 0, len = items.length; i < len; i += 1 ) {
			itemStr = items[ i ].toString();
			if ( itemStr === false ) {
				return false;
			}
			str += itemStr;
		}
		return str;
	};

	var parse_Parser_utils_jsonifyStubs = function( stringifyStubs ) {

		return function( items, noStringify, topLevel ) {
			var str, json;
			if ( !topLevel && !noStringify ) {
				str = stringifyStubs( items );
				if ( str !== false ) {
					return str;
				}
			}
			json = items.map( function( item ) {
				return item.toJSON( noStringify );
			} );
			return json;
		};
	}( parse_Parser_utils_stringifyStubs );

	var parse_Parser_getMustache_SectionStub__SectionStub = function( types, normaliseKeypath, jsonifyStubs, ExpressionStub ) {

		var SectionStub = function( firstToken, parser ) {
			var next;
			this.ref = firstToken.ref;
			this.indexRef = firstToken.indexRef;
			this.inverted = firstToken.mustacheType === types.INVERTED;
			if ( firstToken.expression ) {
				this.expr = new ExpressionStub( firstToken.expression );
			}
			parser.pos += 1;
			this.items = [];
			next = parser.next();
			while ( next ) {
				if ( next.mustacheType === types.CLOSING ) {
					if ( normaliseKeypath( next.ref.trim() ) === this.ref || this.expr ) {
						parser.pos += 1;
						break;
					} else {
						throw new Error( 'Could not parse template: Illegal closing section' );
					}
				}
				this.items.push( parser.getStub() );
				next = parser.next();
			}
		};
		SectionStub.prototype = {
			toJSON: function( noStringify ) {
				var json;
				if ( this.json ) {
					return this.json;
				}
				json = {
					t: types.SECTION
				};
				if ( this.ref ) {
					json.r = this.ref;
				}
				if ( this.indexRef ) {
					json.i = this.indexRef;
				}
				if ( this.inverted ) {
					json.n = true;
				}
				if ( this.expr ) {
					json.x = this.expr.toJSON();
				}
				if ( this.items.length ) {
					json.f = jsonifyStubs( this.items, noStringify );
				}
				this.json = json;
				return json;
			},
			toString: function() {
				return false;
			}
		};
		return SectionStub;
	}( config_types, utils_normaliseKeypath, parse_Parser_utils_jsonifyStubs, parse_Parser_getMustache_ExpressionStub__ExpressionStub );

	var parse_Parser_getMustache__getMustache = function( types, MustacheStub, SectionStub ) {

		return function( token ) {
			if ( token.type === types.MUSTACHE || token.type === types.TRIPLE ) {
				if ( token.mustacheType === types.SECTION || token.mustacheType === types.INVERTED ) {
					return new SectionStub( token, this );
				}
				return new MustacheStub( token, this );
			}
		};
	}( config_types, parse_Parser_getMustache_MustacheStub__MustacheStub, parse_Parser_getMustache_SectionStub__SectionStub );

	var parse_Parser_getElement_ElementStub_utils_siblingsByTagName = {
		li: [ 'li' ],
		dt: [
			'dt',
			'dd'
		],
		dd: [
			'dt',
			'dd'
		],
		p: 'address article aside blockquote dir div dl fieldset footer form h1 h2 h3 h4 h5 h6 header hgroup hr menu nav ol p pre section table ul'.split( ' ' ),
		rt: [
			'rt',
			'rp'
		],
		rp: [
			'rp',
			'rt'
		],
		optgroup: [ 'optgroup' ],
		option: [
			'option',
			'optgroup'
		],
		thead: [
			'tbody',
			'tfoot'
		],
		tbody: [
			'tbody',
			'tfoot'
		],
		tr: [ 'tr' ],
		td: [
			'td',
			'th'
		],
		th: [
			'td',
			'th'
		]
	};

	var parse_Parser_getElement_ElementStub_utils_filterAttributes = function( isArray ) {

		return function( items ) {
			var attrs, proxies, filtered, i, len, item;
			filtered = {};
			attrs = [];
			proxies = [];
			len = items.length;
			for ( i = 0; i < len; i += 1 ) {
				item = items[ i ];
				if ( item.name === 'intro' ) {
					if ( filtered.intro ) {
						throw new Error( 'An element can only have one intro transition' );
					}
					filtered.intro = item;
				} else if ( item.name === 'outro' ) {
					if ( filtered.outro ) {
						throw new Error( 'An element can only have one outro transition' );
					}
					filtered.outro = item;
				} else if ( item.name === 'intro-outro' ) {
					if ( filtered.intro || filtered.outro ) {
						throw new Error( 'An element can only have one intro and one outro transition' );
					}
					filtered.intro = item;
					filtered.outro = deepClone( item );
				} else if ( item.name.substr( 0, 6 ) === 'proxy-' ) {
					item.name = item.name.substring( 6 );
					proxies.push( item );
				} else if ( item.name.substr( 0, 3 ) === 'on-' ) {
					item.name = item.name.substring( 3 );
					proxies.push( item );
				} else if ( item.name === 'decorator' ) {
					filtered.decorator = item;
				} else {
					attrs.push( item );
				}
			}
			filtered.attrs = attrs;
			filtered.proxies = proxies;
			return filtered;
		};

		function deepClone( obj ) {
			var result, key;
			if ( typeof obj !== 'object' ) {
				return obj;
			}
			if ( isArray( obj ) ) {
				return obj.map( deepClone );
			}
			result = {};
			for ( key in obj ) {
				if ( obj.hasOwnProperty( key ) ) {
					result[ key ] = deepClone( obj[ key ] );
				}
			}
			return result;
		}
	}( utils_isArray );

	var parse_Parser_getElement_ElementStub_utils_processDirective = function( types, parseJSON ) {

		return function( directive ) {
			var processed, tokens, token, colonIndex, throwError, directiveName, directiveArgs, parsed;
			throwError = function() {
				throw new Error( 'Illegal directive' );
			};
			if ( !directive.name || !directive.value ) {
				throwError();
			}
			processed = {
				directiveType: directive.name
			};
			tokens = directive.value;
			directiveName = [];
			directiveArgs = [];
			while ( tokens.length ) {
				token = tokens.shift();
				if ( token.type === types.TEXT ) {
					colonIndex = token.value.indexOf( ':' );
					if ( colonIndex === -1 ) {
						directiveName.push( token );
					} else {
						if ( colonIndex ) {
							directiveName.push( {
								type: types.TEXT,
								value: token.value.substr( 0, colonIndex )
							} );
						}
						if ( token.value.length > colonIndex + 1 ) {
							directiveArgs[ 0 ] = {
								type: types.TEXT,
								value: token.value.substring( colonIndex + 1 )
							};
						}
						break;
					}
				} else {
					directiveName.push( token );
				}
			}
			directiveArgs = directiveArgs.concat( tokens );
			if ( directiveName.length === 1 && directiveName[ 0 ].type === types.TEXT ) {
				processed.name = directiveName[ 0 ].value;
			} else {
				processed.name = directiveName;
			}
			if ( directiveArgs.length ) {
				if ( directiveArgs.length === 1 && directiveArgs[ 0 ].type === types.TEXT ) {
					parsed = parseJSON( '[' + directiveArgs[ 0 ].value + ']' );
					processed.args = parsed ? parsed.value : directiveArgs[ 0 ].value;
				} else {
					processed.dynamicArgs = directiveArgs;
				}
			}
			return processed;
		};
	}( config_types, utils_parseJSON );

	var parse_Parser_StringStub_StringParser = function( getText, getMustache ) {

		var StringParser;
		StringParser = function( tokens, options ) {
			var stub;
			this.tokens = tokens || [];
			this.pos = 0;
			this.options = options;
			this.result = [];
			while ( stub = this.getStub() ) {
				this.result.push( stub );
			}
		};
		StringParser.prototype = {
			getStub: function() {
				var token = this.next();
				if ( !token ) {
					return null;
				}
				return this.getText( token ) || this.getMustache( token );
			},
			getText: getText,
			getMustache: getMustache,
			next: function() {
				return this.tokens[ this.pos ];
			}
		};
		return StringParser;
	}( parse_Parser_getText__getText, parse_Parser_getMustache__getMustache );

	var parse_Parser_StringStub__StringStub = function( StringParser, stringifyStubs, jsonifyStubs ) {

		var StringStub;
		StringStub = function( tokens ) {
			var parser = new StringParser( tokens );
			this.stubs = parser.result;
		};
		StringStub.prototype = {
			toJSON: function( noStringify ) {
				var json;
				if ( this[ 'json_' + noStringify ] ) {
					return this[ 'json_' + noStringify ];
				}
				json = this[ 'json_' + noStringify ] = jsonifyStubs( this.stubs, noStringify );
				return json;
			},
			toString: function() {
				if ( this.str !== undefined ) {
					return this.str;
				}
				this.str = stringifyStubs( this.stubs );
				return this.str;
			}
		};
		return StringStub;
	}( parse_Parser_StringStub_StringParser, parse_Parser_utils_stringifyStubs, parse_Parser_utils_jsonifyStubs );

	var parse_Parser_getElement_ElementStub_utils_jsonifyDirective = function( StringStub ) {

		return function( directive ) {
			var result, name;
			if ( typeof directive.name === 'string' ) {
				if ( !directive.args && !directive.dynamicArgs ) {
					return directive.name;
				}
				name = directive.name;
			} else {
				name = new StringStub( directive.name ).toJSON();
			}
			result = {
				n: name
			};
			if ( directive.args ) {
				result.a = directive.args;
				return result;
			}
			if ( directive.dynamicArgs ) {
				result.d = new StringStub( directive.dynamicArgs ).toJSON();
			}
			return result;
		};
	}( parse_Parser_StringStub__StringStub );

	var parse_Parser_getElement_ElementStub_toJSON = function( types, jsonifyStubs, jsonifyDirective ) {

		return function( noStringify ) {
			var json, name, value, proxy, i, len, attribute;
			if ( this[ 'json_' + noStringify ] ) {
				return this[ 'json_' + noStringify ];
			}
			json = {
				t: types.ELEMENT,
				e: this.tag
			};
			if ( this.doctype ) {
				json.y = 1;
			}
			if ( this.attributes && this.attributes.length ) {
				json.a = {};
				len = this.attributes.length;
				for ( i = 0; i < len; i += 1 ) {
					attribute = this.attributes[ i ];
					name = attribute.name;
					if ( json.a[ name ] ) {
						throw new Error( 'You cannot have multiple attributes with the same name' );
					}
					if ( attribute.value === null ) {
						value = null;
					} else {
						value = attribute.value.toJSON( noStringify );
					}
					json.a[ name ] = value;
				}
			}
			if ( this.items && this.items.length ) {
				json.f = jsonifyStubs( this.items, noStringify );
			}
			if ( this.proxies && this.proxies.length ) {
				json.v = {};
				len = this.proxies.length;
				for ( i = 0; i < len; i += 1 ) {
					proxy = this.proxies[ i ];
					json.v[ proxy.directiveType ] = jsonifyDirective( proxy );
				}
			}
			if ( this.intro ) {
				json.t1 = jsonifyDirective( this.intro );
			}
			if ( this.outro ) {
				json.t2 = jsonifyDirective( this.outro );
			}
			if ( this.decorator ) {
				json.o = jsonifyDirective( this.decorator );
			}
			this[ 'json_' + noStringify ] = json;
			return json;
		};
	}( config_types, parse_Parser_utils_jsonifyStubs, parse_Parser_getElement_ElementStub_utils_jsonifyDirective );

	var parse_Parser_getElement_ElementStub_toString = function( stringifyStubs, voidElementNames ) {

		var htmlElements;
		htmlElements = 'a abbr acronym address applet area b base basefont bdo big blockquote body br button caption center cite code col colgroup dd del dfn dir div dl dt em fieldset font form frame frameset h1 h2 h3 h4 h5 h6 head hr html i iframe img input ins isindex kbd label legend li link map menu meta noframes noscript object ol p param pre q s samp script select small span strike strong style sub sup textarea title tt u ul var article aside audio bdi canvas command data datagrid datalist details embed eventsource figcaption figure footer header hgroup keygen mark meter nav output progress ruby rp rt section source summary time track video wbr'.split( ' ' );
		return function() {
			var str, i, len, attrStr, name, attrValueStr, fragStr, isVoid;
			if ( this.str !== undefined ) {
				return this.str;
			}
			if ( htmlElements.indexOf( this.tag.toLowerCase() ) === -1 ) {
				return this.str = false;
			}
			if ( this.proxies || this.intro || this.outro || this.decorator ) {
				return this.str = false;
			}
			fragStr = stringifyStubs( this.items );
			if ( fragStr === false ) {
				return this.str = false;
			}
			isVoid = voidElementNames.indexOf( this.tag.toLowerCase() ) !== -1;
			str = '<' + this.tag;
			if ( this.attributes ) {
				for ( i = 0, len = this.attributes.length; i < len; i += 1 ) {
					name = this.attributes[ i ].name;
					if ( name.indexOf( ':' ) !== -1 ) {
						return this.str = false;
					}
					if ( name === 'id' || name === 'intro' || name === 'outro' ) {
						return this.str = false;
					}
					attrStr = ' ' + name;
					if ( this.attributes[ i ].value !== null ) {
						attrValueStr = this.attributes[ i ].value.toString();
						if ( attrValueStr === false ) {
							return this.str = false;
						}
						if ( attrValueStr !== '' ) {
							attrStr += '=';
							if ( /[\s"'=<>`]/.test( attrValueStr ) ) {
								attrStr += '"' + attrValueStr.replace( /"/g, '&quot;' ) + '"';
							} else {
								attrStr += attrValueStr;
							}
						}
					}
					str += attrStr;
				}
			}
			if ( this.selfClosing && !isVoid ) {
				str += '/>';
				return this.str = str;
			}
			str += '>';
			if ( isVoid ) {
				return this.str = str;
			}
			str += fragStr;
			str += '</' + this.tag + '>';
			return this.str = str;
		};
	}( parse_Parser_utils_stringifyStubs, config_voidElementNames );

	var parse_Parser_getElement_ElementStub__ElementStub = function( types, voidElementNames, warn, siblingsByTagName, filterAttributes, processDirective, toJSON, toString, StringStub ) {

		var ElementStub, allElementNames, closedByParentClose, onPattern, sanitize, leadingWhitespace = /^\s+/,
			trailingWhitespace = /\s+$/;
		ElementStub = function( firstToken, parser, preserveWhitespace ) {
			var next, attrs, filtered, proxies, item, getFrag, lowerCaseTag;
			parser.pos += 1;
			getFrag = function( attr ) {
				return {
					name: attr.name,
					value: attr.value ? new StringStub( attr.value ) : null
				};
			};
			this.tag = firstToken.name;
			lowerCaseTag = firstToken.name.toLowerCase();
			if ( lowerCaseTag.substr( 0, 3 ) === 'rv-' ) {
				warn( 'The "rv-" prefix for components has been deprecated. Support will be removed in a future version' );
				this.tag = this.tag.substring( 3 );
			}
			preserveWhitespace = preserveWhitespace || lowerCaseTag === 'pre' || lowerCaseTag === 'style' || lowerCaseTag === 'script';
			if ( firstToken.attrs ) {
				filtered = filterAttributes( firstToken.attrs );
				attrs = filtered.attrs;
				proxies = filtered.proxies;
				if ( parser.options.sanitize && parser.options.sanitize.eventAttributes ) {
					attrs = attrs.filter( sanitize );
				}
				if ( attrs.length ) {
					this.attributes = attrs.map( getFrag );
				}
				if ( proxies.length ) {
					this.proxies = proxies.map( processDirective );
				}
				if ( filtered.intro ) {
					this.intro = processDirective( filtered.intro );
				}
				if ( filtered.outro ) {
					this.outro = processDirective( filtered.outro );
				}
				if ( filtered.decorator ) {
					this.decorator = processDirective( filtered.decorator );
				}
			}
			if ( firstToken.doctype ) {
				this.doctype = true;
			}
			if ( firstToken.selfClosing ) {
				this.selfClosing = true;
			}
			if ( voidElementNames.indexOf( lowerCaseTag ) !== -1 ) {
				this.isVoid = true;
			}
			if ( this.selfClosing || this.isVoid ) {
				return;
			}
			this.siblings = siblingsByTagName[ lowerCaseTag ];
			this.items = [];
			next = parser.next();
			while ( next ) {
				if ( next.mustacheType === types.CLOSING ) {
					break;
				}
				if ( next.type === types.TAG ) {
					if ( next.closing ) {
						if ( next.name.toLowerCase() === lowerCaseTag ) {
							parser.pos += 1;
						}
						break;
					} else if ( this.siblings && this.siblings.indexOf( next.name.toLowerCase() ) !== -1 ) {
						break;
					}
				}
				this.items.push( parser.getStub( preserveWhitespace ) );
				next = parser.next();
			}
			if ( !preserveWhitespace ) {
				item = this.items[ 0 ];
				if ( item && item.type === types.TEXT ) {
					item.text = item.text.replace( leadingWhitespace, '' );
					if ( !item.text ) {
						this.items.shift();
					}
				}
				item = this.items[ this.items.length - 1 ];
				if ( item && item.type === types.TEXT ) {
					item.text = item.text.replace( trailingWhitespace, '' );
					if ( !item.text ) {
						this.items.pop();
					}
				}
			}
		};
		ElementStub.prototype = {
			toJSON: toJSON,
			toString: toString
		};
		allElementNames = 'a abbr acronym address applet area b base basefont bdo big blockquote body br button caption center cite code col colgroup dd del dfn dir div dl dt em fieldset font form frame frameset h1 h2 h3 h4 h5 h6 head hr html i iframe img input ins isindex kbd label legend li link map menu meta noframes noscript object ol p param pre q s samp script select small span strike strong style sub sup textarea title tt u ul var article aside audio bdi canvas command data datagrid datalist details embed eventsource figcaption figure footer header hgroup keygen mark meter nav output progress ruby rp rt section source summary time track video wbr'.split( ' ' );
		closedByParentClose = 'li dd rt rp optgroup option tbody tfoot tr td th'.split( ' ' );
		onPattern = /^on[a-zA-Z]/;
		sanitize = function( attr ) {
			var valid = !onPattern.test( attr.name );
			return valid;
		};
		return ElementStub;
	}( config_types, config_voidElementNames, utils_warn, parse_Parser_getElement_ElementStub_utils_siblingsByTagName, parse_Parser_getElement_ElementStub_utils_filterAttributes, parse_Parser_getElement_ElementStub_utils_processDirective, parse_Parser_getElement_ElementStub_toJSON, parse_Parser_getElement_ElementStub_toString, parse_Parser_StringStub__StringStub );

	var parse_Parser_getElement__getElement = function( types, ElementStub ) {

		return function( token ) {
			if ( this.options.sanitize && this.options.sanitize.elements ) {
				if ( this.options.sanitize.elements.indexOf( token.name.toLowerCase() ) !== -1 ) {
					return null;
				}
			}
			return new ElementStub( token, this, this.preserveWhitespace );
		};
	}( config_types, parse_Parser_getElement_ElementStub__ElementStub );

	var parse_Parser__Parser = function( getText, getComment, getMustache, getElement, jsonifyStubs ) {

		var Parser;
		Parser = function( tokens, options ) {
			var stub, stubs;
			this.tokens = tokens || [];
			this.pos = 0;
			this.options = options;
			this.preserveWhitespace = options.preserveWhitespace;
			stubs = [];
			while ( stub = this.getStub() ) {
				stubs.push( stub );
			}
			this.result = jsonifyStubs( stubs, options.noStringify, true );
		};
		Parser.prototype = {
			getStub: function( preserveWhitespace ) {
				var token = this.next();
				if ( !token ) {
					return null;
				}
				return this.getText( token, this.preserveWhitespace || preserveWhitespace ) || this.getComment( token ) || this.getMustache( token ) || this.getElement( token );
			},
			getText: getText,
			getComment: getComment,
			getMustache: getMustache,
			getElement: getElement,
			next: function() {
				return this.tokens[ this.pos ];
			}
		};
		return Parser;
	}( parse_Parser_getText__getText, parse_Parser_getComment__getComment, parse_Parser_getMustache__getMustache, parse_Parser_getElement__getElement, parse_Parser_utils_jsonifyStubs );

	// Ractive.parse
	// ===============
	//
	// Takes in a string, and returns an object representing the parsed template.
	// A parsed template is an array of 1 or more 'descriptors', which in some
	// cases have children.
	//
	// The format is optimised for size, not readability, however for reference the
	// keys for each descriptor are as follows:
	//
	// * r - Reference, e.g. 'mustache' in {{mustache}}
	// * t - Type code (e.g. 1 is text, 2 is interpolator...)
	// * f - Fragment. Contains a descriptor's children
	// * e - Element name
	// * a - map of element Attributes, or proxy event/transition Arguments
	// * d - Dynamic proxy event/transition arguments
	// * n - indicates an iNverted section
	// * i - Index reference, e.g. 'num' in {{#section:num}}content{{/section}}
	// * v - eVent proxies (i.e. when user e.g. clicks on a node, fire proxy event)
	// * x - eXpressions
	// * s - String representation of an expression function
	// * t1 - intro Transition
	// * t2 - outro Transition
	// * o - decOrator
	// * y - is doctYpe
	var parse__parse = function( tokenize, types, Parser ) {

		var parse, onlyWhitespace, inlinePartialStart, inlinePartialEnd, parseCompoundTemplate;
		onlyWhitespace = /^\s*$/;
		inlinePartialStart = /<!--\s*\{\{\s*>\s*([a-zA-Z_$][a-zA-Z_$0-9]*)\s*}\}\s*-->/;
		inlinePartialEnd = /<!--\s*\{\{\s*\/\s*([a-zA-Z_$][a-zA-Z_$0-9]*)\s*}\}\s*-->/;
		parse = function( template, options ) {
			var tokens, json, token;
			options = options || {};
			if ( inlinePartialStart.test( template ) ) {
				return parseCompoundTemplate( template, options );
			}
			if ( options.sanitize === true ) {
				options.sanitize = {
					elements: 'applet base basefont body frame frameset head html isindex link meta noframes noscript object param script style title'.split( ' ' ),
					eventAttributes: true
				};
			}
			tokens = tokenize( template, options );
			if ( !options.preserveWhitespace ) {
				token = tokens[ 0 ];
				if ( token && token.type === types.TEXT && onlyWhitespace.test( token.value ) ) {
					tokens.shift();
				}
				token = tokens[ tokens.length - 1 ];
				if ( token && token.type === types.TEXT && onlyWhitespace.test( token.value ) ) {
					tokens.pop();
				}
			}
			json = new Parser( tokens, options ).result;
			if ( typeof json === 'string' ) {
				return [ json ];
			}
			return json;
		};
		parseCompoundTemplate = function( template, options ) {
			var mainTemplate, remaining, partials, name, startMatch, endMatch;
			partials = {};
			mainTemplate = '';
			remaining = template;
			while ( startMatch = inlinePartialStart.exec( remaining ) ) {
				name = startMatch[ 1 ];
				mainTemplate += remaining.substr( 0, startMatch.index );
				remaining = remaining.substring( startMatch.index + startMatch[ 0 ].length );
				endMatch = inlinePartialEnd.exec( remaining );
				if ( !endMatch || endMatch[ 1 ] !== name ) {
					throw new Error( 'Inline partials must have a closing delimiter, and cannot be nested' );
				}
				partials[ name ] = parse( remaining.substr( 0, endMatch.index ), options );
				remaining = remaining.substring( endMatch.index + endMatch[ 0 ].length );
			}
			return {
				main: parse( mainTemplate, options ),
				partials: partials
			};
		};
		return parse;
	}( parse_tokenize, config_types, parse_Parser__Parser );

	var render_DomFragment_Partial_deIndent = function() {

		var empty = /^\s*$/,
			leadingWhitespace = /^\s*/;
		return function( str ) {
			var lines, firstLine, lastLine, minIndent;
			lines = str.split( '\n' );
			firstLine = lines[ 0 ];
			if ( firstLine !== undefined && empty.test( firstLine ) ) {
				lines.shift();
			}
			lastLine = lines[ lines.length - 1 ];
			if ( lastLine !== undefined && empty.test( lastLine ) ) {
				lines.pop();
			}
			minIndent = lines.reduce( reducer, null );
			if ( minIndent ) {
				str = lines.map( function( line ) {
					return line.replace( minIndent, '' );
				} ).join( '\n' );
			}
			return str;
		};

		function reducer( previous, line ) {
			var lineIndent = leadingWhitespace.exec( line )[ 0 ];
			if ( previous === null || lineIndent.length < previous.length ) {
				return lineIndent;
			}
			return previous;
		}
	}();

	var render_DomFragment_Partial_getPartialDescriptor = function( errors, isClient, warn, isObject, partials, parse, deIndent ) {

		var getPartialDescriptor, registerPartial, getPartialFromRegistry, unpack;
		getPartialDescriptor = function( root, name ) {
			var el, partial, errorMessage;
			if ( partial = getPartialFromRegistry( root, name ) ) {
				return partial;
			}
			if ( isClient ) {
				el = document.getElementById( name );
				if ( el && el.tagName === 'SCRIPT' ) {
					if ( !parse ) {
						throw new Error( errors.missingParser );
					}
					registerPartial( parse( deIndent( el.text ), root.parseOptions ), name, partials );
				}
			}
			partial = partials[ name ];
			if ( !partial ) {
				errorMessage = 'Could not find descriptor for partial "' + name + '"';
				if ( root.debug ) {
					throw new Error( errorMessage );
				} else {
					warn( errorMessage );
				}
				return [];
			}
			return unpack( partial );
		};
		getPartialFromRegistry = function( ractive, name ) {
			var partial;
			if ( ractive.partials[ name ] ) {
				if ( typeof ractive.partials[ name ] === 'string' ) {
					if ( !parse ) {
						throw new Error( errors.missingParser );
					}
					partial = parse( ractive.partials[ name ], ractive.parseOptions );
					registerPartial( partial, name, ractive.partials );
				}
				return unpack( ractive.partials[ name ] );
			}
		};
		registerPartial = function( partial, name, registry ) {
			var key;
			if ( isObject( partial ) ) {
				registry[ name ] = partial.main;
				for ( key in partial.partials ) {
					if ( partial.partials.hasOwnProperty( key ) ) {
						registry[ key ] = partial.partials[ key ];
					}
				}
			} else {
				registry[ name ] = partial;
			}
		};
		unpack = function( partial ) {
			if ( partial.length === 1 && typeof partial[ 0 ] === 'string' ) {
				return partial[ 0 ];
			}
			return partial;
		};
		return getPartialDescriptor;
	}( config_errors, config_isClient, utils_warn, utils_isObject, registries_partials, parse__parse, render_DomFragment_Partial_deIndent );

	var render_DomFragment_Partial_applyIndent = function( string, indent ) {
		var indented;
		if ( !indent ) {
			return string;
		}
		indented = string.split( '\n' ).map( function( line, notFirstLine ) {
			return notFirstLine ? indent + line : line;
		} ).join( '\n' );
		return indented;
	};

	var render_DomFragment_Partial__Partial = function( types, getPartialDescriptor, applyIndent, circular ) {

		var DomPartial, DomFragment;
		circular.push( function() {
			DomFragment = circular.DomFragment;
		} );
		DomPartial = function( options, docFrag ) {
			var parentFragment = this.parentFragment = options.parentFragment,
				descriptor;
			this.type = types.PARTIAL;
			this.name = options.descriptor.r;
			this.index = options.index;
			if ( !options.descriptor.r ) {
				throw new Error( 'Partials must have a static reference (no expressions). This may change in a future version of Ractive.' );
			}
			descriptor = getPartialDescriptor( parentFragment.root, options.descriptor.r );
			this.fragment = new DomFragment( {
				descriptor: descriptor,
				root: parentFragment.root,
				pNode: parentFragment.pNode,
				owner: this
			} );
			if ( docFrag ) {
				docFrag.appendChild( this.fragment.docFrag );
			}
		};
		DomPartial.prototype = {
			firstNode: function() {
				return this.fragment.firstNode();
			},
			findNextNode: function() {
				return this.parentFragment.findNextNode( this );
			},
			detach: function() {
				return this.fragment.detach();
			},
			teardown: function( destroy ) {
				this.fragment.teardown( destroy );
			},
			toString: function() {
				var string, previousItem, lastLine, match;
				string = this.fragment.toString();
				previousItem = this.parentFragment.items[ this.index - 1 ];
				if ( !previousItem || previousItem.type !== types.TEXT ) {
					return string;
				}
				lastLine = previousItem.descriptor.split( '\n' ).pop();
				if ( match = /^\s+$/.exec( lastLine ) ) {
					return applyIndent( string, match[ 0 ] );
				}
				return string;
			},
			find: function( selector ) {
				return this.fragment.find( selector );
			},
			findAll: function( selector, query ) {
				return this.fragment.findAll( selector, query );
			},
			findComponent: function( selector ) {
				return this.fragment.findComponent( selector );
			},
			findAllComponents: function( selector, query ) {
				return this.fragment.findAllComponents( selector, query );
			}
		};
		return DomPartial;
	}( config_types, render_DomFragment_Partial_getPartialDescriptor, render_DomFragment_Partial_applyIndent, circular );

	var render_DomFragment_Component_initialise_createModel_ComponentParameter = function( runloop, StringFragment ) {

		var ComponentParameter = function( component, key, value ) {
			this.parentFragment = component.parentFragment;
			this.component = component;
			this.key = key;
			this.fragment = new StringFragment( {
				descriptor: value,
				root: component.root,
				owner: this
			} );
			this.selfUpdating = this.fragment.isSimple();
			this.value = this.fragment.getValue();
		};
		ComponentParameter.prototype = {
			bubble: function() {
				if ( this.selfUpdating ) {
					this.update();
				} else if ( !this.deferred && this.ready ) {
					runloop.addAttribute( this );
					this.deferred = true;
				}
			},
			update: function() {
				var value = this.fragment.getValue();
				this.component.instance.set( this.key, value );
				this.value = value;
			},
			teardown: function() {
				this.fragment.teardown();
			}
		};
		return ComponentParameter;
	}( global_runloop, render_StringFragment__StringFragment );

	var render_DomFragment_Component_initialise_createModel__createModel = function( types, parseJSON, resolveRef, get, ComponentParameter ) {

		return function( component, defaultData, attributes, toBind ) {
			var data, key, value;
			data = {};
			component.complexParameters = [];
			for ( key in attributes ) {
				if ( attributes.hasOwnProperty( key ) ) {
					value = getValue( component, key, attributes[ key ], toBind );
					if ( value !== undefined || defaultData[ key ] === undefined ) {
						data[ key ] = value;
					}
				}
			}
			return data;
		};

		function getValue( component, key, descriptor, toBind ) {
			var parameter, parsed, parentInstance, parentFragment, keypath;
			parentInstance = component.root;
			parentFragment = component.parentFragment;
			if ( typeof descriptor === 'string' ) {
				parsed = parseJSON( descriptor );
				return parsed ? parsed.value : descriptor;
			}
			if ( descriptor === null ) {
				return true;
			}
			if ( descriptor.length === 1 && descriptor[ 0 ].t === types.INTERPOLATOR && descriptor[ 0 ].r ) {
				if ( parentFragment.indexRefs && parentFragment.indexRefs[ descriptor[ 0 ].r ] !== undefined ) {
					return parentFragment.indexRefs[ descriptor[ 0 ].r ];
				}
				keypath = resolveRef( parentInstance, descriptor[ 0 ].r, parentFragment ) || descriptor[ 0 ].r;
				toBind.push( {
					childKeypath: key,
					parentKeypath: keypath
				} );
				return get( parentInstance, keypath );
			}
			parameter = new ComponentParameter( component, key, descriptor );
			component.complexParameters.push( parameter );
			return parameter.value;
		}
	}( config_types, utils_parseJSON, shared_resolveRef, shared_get__get, render_DomFragment_Component_initialise_createModel_ComponentParameter );

	var render_DomFragment_Component_initialise_createInstance = function() {

		return function( component, Component, data, docFrag, contentDescriptor ) {
			var instance, parentFragment, partials, root, adapt;
			parentFragment = component.parentFragment;
			root = component.root;
			partials = {
				content: contentDescriptor || []
			};
			adapt = combineAdaptors( root, Component.defaults.adapt, Component.adaptors );
			instance = new Component( {
				el: parentFragment.pNode,
				append: true,
				data: data,
				partials: partials,
				magic: root.magic || Component.defaults.magic,
				modifyArrays: root.modifyArrays,
				_parent: root,
				_component: component,
				adapt: adapt
			} );
			if ( docFrag ) {
				instance.insert( docFrag );
				instance.fragment.pNode = instance.el = parentFragment.pNode;
			}
			return instance;
		};

		function combineAdaptors( root, defaultAdapt ) {
			var adapt, len, i;
			if ( root.adapt.length ) {
				adapt = root.adapt.map( function( stringOrObject ) {
					if ( typeof stringOrObject === 'object' ) {
						return stringOrObject;
					}
					return root.adaptors[ stringOrObject ] || stringOrObject;
				} );
			} else {
				adapt = [];
			}
			if ( len = defaultAdapt.length ) {
				for ( i = 0; i < len; i += 1 ) {
					if ( adapt.indexOf( defaultAdapt[ i ] ) === -1 ) {
						adapt.push( defaultAdapt[ i ] );
					}
				}
			}
			return adapt;
		}
	}();

	var render_DomFragment_Component_initialise_createBindings = function( createComponentBinding, get, set ) {

		return function createInitialComponentBindings( component, toBind ) {
			toBind.forEach( function createInitialComponentBinding( pair ) {
				var childValue;
				createComponentBinding( component, component.root, pair.parentKeypath, pair.childKeypath );
				childValue = get( component.instance, pair.childKeypath );
				if ( childValue !== undefined ) {
					set( component.root, pair.parentKeypath, childValue );
				}
			} );
		};
	}( shared_createComponentBinding, shared_get__get, shared_set );

	var render_DomFragment_Component_initialise_propagateEvents = function( warn ) {

		var errorMessage = 'Components currently only support simple events - you cannot include arguments. Sorry!';
		return function( component, eventsDescriptor ) {
			var eventName;
			for ( eventName in eventsDescriptor ) {
				if ( eventsDescriptor.hasOwnProperty( eventName ) ) {
					propagateEvent( component.instance, component.root, eventName, eventsDescriptor[ eventName ] );
				}
			}
		};

		function propagateEvent( childInstance, parentInstance, eventName, proxyEventName ) {
			if ( typeof proxyEventName !== 'string' ) {
				if ( parentInstance.debug ) {
					throw new Error( errorMessage );
				} else {
					warn( errorMessage );
					return;
				}
			}
			childInstance.on( eventName, function() {
				var args = Array.prototype.slice.call( arguments );
				args.unshift( proxyEventName );
				parentInstance.fire.apply( parentInstance, args );
			} );
		}
	}( utils_warn );

	var render_DomFragment_Component_initialise_updateLiveQueries = function( component ) {
		var ancestor, query;
		ancestor = component.root;
		while ( ancestor ) {
			if ( query = ancestor._liveComponentQueries[ component.name ] ) {
				query.push( component.instance );
			}
			ancestor = ancestor._parent;
		}
	};

	var render_DomFragment_Component_initialise__initialise = function( types, warn, createModel, createInstance, createBindings, propagateEvents, updateLiveQueries ) {

		return function initialiseComponent( component, options, docFrag ) {
			var parentFragment, root, Component, data, toBind;
			parentFragment = component.parentFragment = options.parentFragment;
			root = parentFragment.root;
			component.root = root;
			component.type = types.COMPONENT;
			component.name = options.descriptor.e;
			component.index = options.index;
			component.bindings = [];
			Component = root.components[ options.descriptor.e ];
			if ( !Component ) {
				throw new Error( 'Component "' + options.descriptor.e + '" not found' );
			}
			toBind = [];
			data = createModel( component, Component.data || {}, options.descriptor.a, toBind );
			createInstance( component, Component, data, docFrag, options.descriptor.f );
			createBindings( component, toBind );
			propagateEvents( component, options.descriptor.v );
			if ( options.descriptor.t1 || options.descriptor.t2 || options.descriptor.o ) {
				warn( 'The "intro", "outro" and "decorator" directives have no effect on components' );
			}
			updateLiveQueries( component );
		};
	}( config_types, utils_warn, render_DomFragment_Component_initialise_createModel__createModel, render_DomFragment_Component_initialise_createInstance, render_DomFragment_Component_initialise_createBindings, render_DomFragment_Component_initialise_propagateEvents, render_DomFragment_Component_initialise_updateLiveQueries );

	var render_DomFragment_Component__Component = function( initialise ) {

		var DomComponent = function( options, docFrag ) {
			initialise( this, options, docFrag );
		};
		DomComponent.prototype = {
			firstNode: function() {
				return this.instance.fragment.firstNode();
			},
			findNextNode: function() {
				return this.parentFragment.findNextNode( this );
			},
			detach: function() {
				return this.instance.fragment.detach();
			},
			teardown: function( destroy ) {
				while ( this.complexParameters.length ) {
					this.complexParameters.pop().teardown();
				}
				while ( this.bindings.length ) {
					this.bindings.pop().teardown();
				}
				removeFromLiveComponentQueries( this );
				this.shouldDestroy = destroy;
				this.instance.teardown();
			},
			toString: function() {
				return this.instance.fragment.toString();
			},
			find: function( selector ) {
				return this.instance.fragment.find( selector );
			},
			findAll: function( selector, query ) {
				return this.instance.fragment.findAll( selector, query );
			},
			findComponent: function( selector ) {
				if ( !selector || selector === this.name ) {
					return this.instance;
				}
				if ( this.instance.fragment ) {
					return this.instance.fragment.findComponent( selector );
				}
				return null;
			},
			findAllComponents: function( selector, query ) {
				query._test( this, true );
				if ( this.instance.fragment ) {
					this.instance.fragment.findAllComponents( selector, query );
				}
			}
		};
		return DomComponent;

		function removeFromLiveComponentQueries( component ) {
			var instance, query;
			instance = component.root;
			do {
				if ( query = instance._liveComponentQueries[ component.name ] ) {
					query._remove( component );
				}
			} while ( instance = instance._parent );
		}
	}( render_DomFragment_Component_initialise__initialise );

	var render_DomFragment_Comment = function( types, detach ) {

		var DomComment = function( options, docFrag ) {
			this.type = types.COMMENT;
			this.descriptor = options.descriptor;
			if ( docFrag ) {
				this.node = document.createComment( options.descriptor.f );
				docFrag.appendChild( this.node );
			}
		};
		DomComment.prototype = {
			detach: detach,
			teardown: function( destroy ) {
				if ( destroy ) {
					this.detach();
				}
			},
			firstNode: function() {
				return this.node;
			},
			toString: function() {
				return '<!--' + this.descriptor.f + '-->';
			}
		};
		return DomComment;
	}( config_types, render_DomFragment_shared_detach );

	var render_DomFragment__DomFragment = function( types, matches, initFragment, insertHtml, Text, Interpolator, Section, Triple, Element, Partial, Component, Comment, circular ) {

		var DomFragment = function( options ) {
			if ( options.pNode ) {
				this.docFrag = document.createDocumentFragment();
			}
			if ( typeof options.descriptor === 'string' ) {
				this.html = options.descriptor;
				if ( this.docFrag ) {
					this.nodes = insertHtml( this.html, options.pNode.tagName, this.docFrag );
				}
			} else {
				initFragment( this, options );
			}
		};
		DomFragment.prototype = {
			detach: function() {
				var len, i;
				if ( this.docFrag ) {
					if ( this.nodes ) {
						len = this.nodes.length;
						for ( i = 0; i < len; i += 1 ) {
							this.docFrag.appendChild( this.nodes[ i ] );
						}
					} else if ( this.items ) {
						len = this.items.length;
						for ( i = 0; i < len; i += 1 ) {
							this.docFrag.appendChild( this.items[ i ].detach() );
						}
					}
					return this.docFrag;
				}
			},
			createItem: function( options ) {
				if ( typeof options.descriptor === 'string' ) {
					return new Text( options, this.docFrag );
				}
				switch ( options.descriptor.t ) {
					case types.INTERPOLATOR:
						return new Interpolator( options, this.docFrag );
					case types.SECTION:
						return new Section( options, this.docFrag );
					case types.TRIPLE:
						return new Triple( options, this.docFrag );
					case types.ELEMENT:
						if ( this.root.components[ options.descriptor.e ] ) {
							return new Component( options, this.docFrag );
						}
						return new Element( options, this.docFrag );
					case types.PARTIAL:
						return new Partial( options, this.docFrag );
					case types.COMMENT:
						return new Comment( options, this.docFrag );
					default:
						throw new Error( 'Something very strange happened. Please file an issue at https://github.com/RactiveJS/Ractive/issues. Thanks!' );
				}
			},
			teardown: function( destroy ) {
				var node;
				if ( this.nodes && destroy ) {
					while ( node = this.nodes.pop() ) {
						node.parentNode.removeChild( node );
					}
				} else if ( this.items ) {
					while ( this.items.length ) {
						this.items.pop().teardown( destroy );
					}
				}
				this.nodes = this.items = this.docFrag = null;
			},
			firstNode: function() {
				if ( this.items && this.items[ 0 ] ) {
					return this.items[ 0 ].firstNode();
				} else if ( this.nodes ) {
					return this.nodes[ 0 ] || null;
				}
				return null;
			},
			findNextNode: function( item ) {
				var index = item.index;
				if ( this.items[ index + 1 ] ) {
					return this.items[ index + 1 ].firstNode();
				}
				if ( this.owner === this.root ) {
					if ( !this.owner.component ) {
						return null;
					}
					return this.owner.component.findNextNode();
				}
				return this.owner.findNextNode( this );
			},
			toString: function() {
				var html, i, len, item;
				if ( this.html ) {
					return this.html;
				}
				html = '';
				if ( !this.items ) {
					return html;
				}
				len = this.items.length;
				for ( i = 0; i < len; i += 1 ) {
					item = this.items[ i ];
					html += item.toString();
				}
				return html;
			},
			find: function( selector ) {
				var i, len, item, node, queryResult;
				if ( this.nodes ) {
					len = this.nodes.length;
					for ( i = 0; i < len; i += 1 ) {
						node = this.nodes[ i ];
						if ( node.nodeType !== 1 ) {
							continue;
						}
						if ( matches( node, selector ) ) {
							return node;
						}
						if ( queryResult = node.querySelector( selector ) ) {
							return queryResult;
						}
					}
					return null;
				}
				if ( this.items ) {
					len = this.items.length;
					for ( i = 0; i < len; i += 1 ) {
						item = this.items[ i ];
						if ( item.find && ( queryResult = item.find( selector ) ) ) {
							return queryResult;
						}
					}
					return null;
				}
			},
			findAll: function( selector, query ) {
				var i, len, item, node, queryAllResult, numNodes, j;
				if ( this.nodes ) {
					len = this.nodes.length;
					for ( i = 0; i < len; i += 1 ) {
						node = this.nodes[ i ];
						if ( node.nodeType !== 1 ) {
							continue;
						}
						if ( matches( node, selector ) ) {
							query.push( node );
						}
						if ( queryAllResult = node.querySelectorAll( selector ) ) {
							numNodes = queryAllResult.length;
							for ( j = 0; j < numNodes; j += 1 ) {
								query.push( queryAllResult[ j ] );
							}
						}
					}
				} else if ( this.items ) {
					len = this.items.length;
					for ( i = 0; i < len; i += 1 ) {
						item = this.items[ i ];
						if ( item.findAll ) {
							item.findAll( selector, query );
						}
					}
				}
				return query;
			},
			findComponent: function( selector ) {
				var len, i, item, queryResult;
				if ( this.items ) {
					len = this.items.length;
					for ( i = 0; i < len; i += 1 ) {
						item = this.items[ i ];
						if ( item.findComponent && ( queryResult = item.findComponent( selector ) ) ) {
							return queryResult;
						}
					}
					return null;
				}
			},
			findAllComponents: function( selector, query ) {
				var i, len, item;
				if ( this.items ) {
					len = this.items.length;
					for ( i = 0; i < len; i += 1 ) {
						item = this.items[ i ];
						if ( item.findAllComponents ) {
							item.findAllComponents( selector, query );
						}
					}
				}
				return query;
			}
		};
		circular.DomFragment = DomFragment;
		return DomFragment;
	}( config_types, utils_matches, render_shared_initFragment, render_DomFragment_shared_insertHtml, render_DomFragment_Text, render_DomFragment_Interpolator, render_DomFragment_Section__Section, render_DomFragment_Triple, render_DomFragment_Element__Element, render_DomFragment_Partial__Partial, render_DomFragment_Component__Component, render_DomFragment_Comment, circular );

	var Ractive_prototype_render = function( runloop, css, DomFragment ) {

		return function Ractive_prototype_render( target, callback ) {
			this._rendering = true;
			runloop.start( this, callback );
			if ( !this._initing ) {
				throw new Error( 'You cannot call ractive.render() directly!' );
			}
			if ( this.constructor.css ) {
				css.add( this.constructor );
			}
			this.fragment = new DomFragment( {
				descriptor: this.template,
				root: this,
				owner: this,
				pNode: target
			} );
			if ( target ) {
				target.appendChild( this.fragment.docFrag );
			}
			if ( !this._parent || !this._parent._rendering ) {
				initChildren( this );
			}
			delete this._rendering;
			runloop.end();
		};

		function initChildren( instance ) {
			var child;
			while ( child = instance._childInitQueue.pop() ) {
				if ( child.instance.init ) {
					child.instance.init( child.options );
				}
				initChildren( child.instance );
			}
		}
	}( global_runloop, global_css, render_DomFragment__DomFragment );

	var Ractive_prototype_renderHTML = function( warn ) {

		return function() {
			warn( 'renderHTML() has been deprecated and will be removed in a future version. Please use toHTML() instead' );
			return this.toHTML();
		};
	}( utils_warn );

	var Ractive_prototype_reset = function( Promise, runloop, clearCache, notifyDependants ) {

		return function( data, callback ) {
			var promise, fulfilPromise, wrapper;
			if ( typeof data === 'function' ) {
				callback = data;
				data = {};
			} else {
				data = data || {};
			}
			if ( typeof data !== 'object' ) {
				throw new Error( 'The reset method takes either no arguments, or an object containing new data' );
			}
			promise = new Promise( function( fulfil ) {
				fulfilPromise = fulfil;
			} );
			if ( callback ) {
				promise.then( callback );
			}
			runloop.start( this, fulfilPromise );
			if ( ( wrapper = this._wrapped[ '' ] ) && wrapper.reset ) {
				if ( wrapper.reset( data ) === false ) {
					this.data = data;
				}
			} else {
				this.data = data;
			}
			clearCache( this, '' );
			notifyDependants( this, '' );
			runloop.end();
			this.fire( 'reset', data );
			return promise;
		};
	}( utils_Promise, global_runloop, shared_clearCache, shared_notifyDependants );

	var Ractive_prototype_set = function( runloop, isObject, normaliseKeypath, Promise, set ) {

		return function Ractive_prototype_set( keypath, value, callback ) {
			var map, promise, fulfilPromise;
			promise = new Promise( function( fulfil ) {
				fulfilPromise = fulfil;
			} );
			runloop.start( this, fulfilPromise );
			if ( isObject( keypath ) ) {
				map = keypath;
				callback = value;
				for ( keypath in map ) {
					if ( map.hasOwnProperty( keypath ) ) {
						value = map[ keypath ];
						keypath = normaliseKeypath( keypath );
						set( this, keypath, value );
					}
				}
			} else {
				keypath = normaliseKeypath( keypath );
				set( this, keypath, value );
			}
			runloop.end();
			if ( callback ) {
				promise.then( callback.bind( this ) );
			}
			return promise;
		};
	}( global_runloop, utils_isObject, utils_normaliseKeypath, utils_Promise, shared_set );

	var Ractive_prototype_subtract = function( add ) {

		return function( keypath, d ) {
			return add( this, keypath, d === undefined ? -1 : -d );
		};
	}( Ractive_prototype_shared_add );

	// Teardown. This goes through the root fragment and all its children, removing observers
	// and generally cleaning up after itself
	var Ractive_prototype_teardown = function( types, css, runloop, Promise, clearCache ) {

		return function( callback ) {
			var keypath, promise, fulfilPromise, shouldDestroy, originalCallback, fragment, nearestDetachingElement, unresolvedImplicitDependency;
			this.fire( 'teardown' );
			shouldDestroy = !this.component || this.component.shouldDestroy;
			if ( this.constructor.css ) {
				if ( shouldDestroy ) {
					originalCallback = callback;
					callback = function() {
						if ( originalCallback ) {
							originalCallback.call( this );
						}
						css.remove( this.constructor );
					};
				} else {
					fragment = this.component.parentFragment;
					do {
						if ( fragment.owner.type !== types.ELEMENT ) {
							continue;
						}
						if ( fragment.owner.willDetach ) {
							nearestDetachingElement = fragment.owner;
						}
					} while ( !nearestDetachingElement && ( fragment = fragment.parent ) );
					if ( !nearestDetachingElement ) {
						throw new Error( 'A component is being torn down but doesn\'t have a nearest detaching element... this shouldn\'t happen!' );
					}
					nearestDetachingElement.cssDetachQueue.push( this.constructor );
				}
			}
			promise = new Promise( function( fulfil ) {
				fulfilPromise = fulfil;
			} );
			runloop.start( this, fulfilPromise );
			this.fragment.teardown( shouldDestroy );
			while ( this._animations[ 0 ] ) {
				this._animations[ 0 ].stop();
			}
			for ( keypath in this._cache ) {
				clearCache( this, keypath );
			}
			while ( unresolvedImplicitDependency = this._unresolvedImplicitDependencies.pop() ) {
				unresolvedImplicitDependency.teardown();
			}
			runloop.end();
			if ( callback ) {
				promise.then( callback.bind( this ) );
			}
			return promise;
		};
	}( config_types, global_css, global_runloop, utils_Promise, shared_clearCache );

	var Ractive_prototype_toHTML = function() {
		return this.fragment.toString();
	};

	var Ractive_prototype_toggle = function( keypath, callback ) {
		var value;
		if ( typeof keypath !== 'string' ) {
			if ( this.debug ) {
				throw new Error( 'Bad arguments' );
			}
			return;
		}
		value = this.get( keypath );
		return this.set( keypath, !value, callback );
	};

	var Ractive_prototype_update = function( runloop, Promise, clearCache, notifyDependants ) {

		return function( keypath, callback ) {
			var promise, fulfilPromise;
			if ( typeof keypath === 'function' ) {
				callback = keypath;
				keypath = '';
			} else {
				keypath = keypath || '';
			}
			promise = new Promise( function( fulfil ) {
				fulfilPromise = fulfil;
			} );
			runloop.start( this, fulfilPromise );
			clearCache( this, keypath );
			notifyDependants( this, keypath );
			runloop.end();
			this.fire( 'update', keypath );
			if ( callback ) {
				promise.then( callback.bind( this ) );
			}
			return promise;
		};
	}( global_runloop, utils_Promise, shared_clearCache, shared_notifyDependants );

	var Ractive_prototype_updateModel = function( getValueFromCheckboxes, arrayContentsMatch, isEqual ) {

		return function Ractive_prototype_updateModel( keypath, cascade ) {
			var values, deferredCheckboxes, i;
			if ( typeof keypath !== 'string' ) {
				keypath = '';
				cascade = true;
			}
			consolidateChangedValues( this, keypath, values = {}, deferredCheckboxes = [], cascade );
			if ( i = deferredCheckboxes.length ) {
				while ( i-- ) {
					keypath = deferredCheckboxes[ i ];
					values[ keypath ] = getValueFromCheckboxes( this, keypath );
				}
			}
			this.set( values );
		};

		function consolidateChangedValues( ractive, keypath, values, deferredCheckboxes, cascade ) {
			var bindings, childDeps, i, binding, oldValue, newValue;
			bindings = ractive._twowayBindings[ keypath ];
			if ( bindings ) {
				i = bindings.length;
				while ( i-- ) {
					binding = bindings[ i ];
					if ( binding.radioName && !binding.node.checked ) {
						continue;
					}
					if ( binding.checkboxName ) {
						if ( binding.changed() && deferredCheckboxes[ keypath ] !== true ) {
							deferredCheckboxes[ keypath ] = true;
							deferredCheckboxes.push( keypath );
						}
						continue;
					}
					oldValue = binding.attr.value;
					newValue = binding.value();
					if ( arrayContentsMatch( oldValue, newValue ) ) {
						continue;
					}
					if ( !isEqual( oldValue, newValue ) ) {
						values[ keypath ] = newValue;
					}
				}
			}
			if ( !cascade ) {
				return;
			}
			childDeps = ractive._depsMap[ keypath ];
			if ( childDeps ) {
				i = childDeps.length;
				while ( i-- ) {
					consolidateChangedValues( ractive, childDeps[ i ], values, deferredCheckboxes, cascade );
				}
			}
		}
	}( shared_getValueFromCheckboxes, utils_arrayContentsMatch, utils_isEqual );

	var Ractive_prototype__prototype = function( add, animate, detach, find, findAll, findAllComponents, findComponent, fire, get, insert, merge, observe, off, on, render, renderHTML, reset, set, subtract, teardown, toHTML, toggle, update, updateModel ) {

		return {
			add: add,
			animate: animate,
			detach: detach,
			find: find,
			findAll: findAll,
			findAllComponents: findAllComponents,
			findComponent: findComponent,
			fire: fire,
			get: get,
			insert: insert,
			merge: merge,
			observe: observe,
			off: off,
			on: on,
			render: render,
			renderHTML: renderHTML,
			reset: reset,
			set: set,
			subtract: subtract,
			teardown: teardown,
			toHTML: toHTML,
			toggle: toggle,
			update: update,
			updateModel: updateModel
		};
	}( Ractive_prototype_add, Ractive_prototype_animate__animate, Ractive_prototype_detach, Ractive_prototype_find, Ractive_prototype_findAll, Ractive_prototype_findAllComponents, Ractive_prototype_findComponent, Ractive_prototype_fire, Ractive_prototype_get, Ractive_prototype_insert, Ractive_prototype_merge__merge, Ractive_prototype_observe__observe, Ractive_prototype_off, Ractive_prototype_on, Ractive_prototype_render, Ractive_prototype_renderHTML, Ractive_prototype_reset, Ractive_prototype_set, Ractive_prototype_subtract, Ractive_prototype_teardown, Ractive_prototype_toHTML, Ractive_prototype_toggle, Ractive_prototype_update, Ractive_prototype_updateModel );

	var registries_components = {};

	// These are a subset of the easing equations found at
	// https://raw.github.com/danro/easing-js - license info
	// follows:
	// --------------------------------------------------
	// easing.js v0.5.4
	// Generic set of easing functions with AMD support
	// https://github.com/danro/easing-js
	// This code may be freely distributed under the MIT license
	// http://danro.mit-license.org/
	// --------------------------------------------------
	// All functions adapted from Thomas Fuchs & Jeremy Kahn
	// Easing Equations (c) 2003 Robert Penner, BSD license
	// https://raw.github.com/danro/easing-js/master/LICENSE
	// --------------------------------------------------
	// In that library, the functions named easeIn, easeOut, and
	// easeInOut below are named easeInCubic, easeOutCubic, and
	// (you guessed it) easeInOutCubic.
	//
	// You can add additional easing functions to this list, and they
	// will be globally available.
	var registries_easing = {
		linear: function( pos ) {
			return pos;
		},
		easeIn: function( pos ) {
			return Math.pow( pos, 3 );
		},
		easeOut: function( pos ) {
			return Math.pow( pos - 1, 3 ) + 1;
		},
		easeInOut: function( pos ) {
			if ( ( pos /= 0.5 ) < 1 ) {
				return 0.5 * Math.pow( pos, 3 );
			}
			return 0.5 * ( Math.pow( pos - 2, 3 ) + 2 );
		}
	};

	var utils_getGuid = function() {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace( /[xy]/g, function( c ) {
			var r, v;
			r = Math.random() * 16 | 0;
			v = c == 'x' ? r : r & 3 | 8;
			return v.toString( 16 );
		} );
	};

	var utils_extend = function( target ) {
		var prop, source, sources = Array.prototype.slice.call( arguments, 1 );
		while ( source = sources.shift() ) {
			for ( prop in source ) {
				if ( source.hasOwnProperty( prop ) ) {
					target[ prop ] = source[ prop ];
				}
			}
		}
		return target;
	};

	var config_registries = [
		'adaptors',
		'components',
		'decorators',
		'easing',
		'events',
		'interpolators',
		'partials',
		'transitions',
		'data'
	];

	var extend_utils_transformCss = function() {

		var selectorsPattern = /(?:^|\})?\s*([^\{\}]+)\s*\{/g,
			commentsPattern = /\/\*.*?\*\//g,
			selectorUnitPattern = /((?:(?:\[[^\]+]\])|(?:[^\s\+\>\~:]))+)((?::[^\s\+\>\~]+)?\s*[\s\+\>\~]?)\s*/g;
		return function transformCss( css, guid ) {
			var transformed, addGuid;
			addGuid = function( selector ) {
				var selectorUnits, match, unit, dataAttr, base, prepended, appended, i, transformed = [];
				selectorUnits = [];
				while ( match = selectorUnitPattern.exec( selector ) ) {
					selectorUnits.push( {
						str: match[ 0 ],
						base: match[ 1 ],
						modifiers: match[ 2 ]
					} );
				}
				dataAttr = '[data-rvcguid="' + guid + '"]';
				base = selectorUnits.map( extractString );
				i = selectorUnits.length;
				while ( i-- ) {
					appended = base.slice();
					unit = selectorUnits[ i ];
					appended[ i ] = unit.base + dataAttr + unit.modifiers || '';
					prepended = base.slice();
					prepended[ i ] = dataAttr + ' ' + prepended[ i ];
					transformed.push( appended.join( ' ' ), prepended.join( ' ' ) );
				}
				return transformed.join( ', ' );
			};
			transformed = css.replace( commentsPattern, '' ).replace( selectorsPattern, function( match, $1 ) {
				var selectors, transformed;
				selectors = $1.split( ',' ).map( trim );
				transformed = selectors.map( addGuid ).join( ', ' ) + ' ';
				return match.replace( $1, transformed );
			} );
			return transformed;
		};

		function trim( str ) {
			if ( str.trim ) {
				return str.trim();
			}
			return str.replace( /^\s+/, '' ).replace( /\s+$/, '' );
		}

		function extractString( unit ) {
			return unit.str;
		}
	}();

	var extend_inheritFromParent = function( registries, create, defineProperty, transformCss ) {

		return function( Child, Parent ) {
			registries.forEach( function( property ) {
				if ( Parent[ property ] ) {
					Child[ property ] = create( Parent[ property ] );
				}
			} );
			defineProperty( Child, 'defaults', {
				value: create( Parent.defaults )
			} );
			if ( Parent.css ) {
				defineProperty( Child, 'css', {
					value: Parent.defaults.noCssTransform ? Parent.css : transformCss( Parent.css, Child._guid )
				} );
			}
		};
	}( config_registries, utils_create, utils_defineProperty, extend_utils_transformCss );

	var extend_wrapMethod = function( method, superMethod ) {
		if ( /_super/.test( method ) ) {
			return function() {
				var _super = this._super,
					result;
				this._super = superMethod;
				result = method.apply( this, arguments );
				this._super = _super;
				return result;
			};
		} else {
			return method;
		}
	};

	var extend_utils_augment = function( target, source ) {
		var key;
		for ( key in source ) {
			if ( source.hasOwnProperty( key ) ) {
				target[ key ] = source[ key ];
			}
		}
		return target;
	};

	var extend_inheritFromChildProps = function( initOptions, registries, defineProperty, wrapMethod, augment, transformCss ) {

		var blacklisted = {};
		registries.concat( initOptions.keys ).forEach( function( property ) {
			blacklisted[ property ] = true;
		} );
		return function( Child, childProps ) {
			var key, member;
			registries.forEach( function( property ) {
				var value = childProps[ property ];
				if ( value ) {
					if ( Child[ property ] ) {
						augment( Child[ property ], value );
					} else {
						Child[ property ] = value;
					}
				}
			} );
			initOptions.keys.forEach( function( key ) {
				var value = childProps[ key ];
				if ( value !== undefined ) {
					if ( typeof value === 'function' && typeof Child[ key ] === 'function' ) {
						Child.defaults[ key ] = wrapMethod( value, Child[ key ] );
					} else {
						Child.defaults[ key ] = childProps[ key ];
					}
				}
			} );
			for ( key in childProps ) {
				if ( !blacklisted[ key ] && childProps.hasOwnProperty( key ) ) {
					member = childProps[ key ];
					if ( typeof member === 'function' && typeof Child.prototype[ key ] === 'function' ) {
						Child.prototype[ key ] = wrapMethod( member, Child.prototype[ key ] );
					} else {
						Child.prototype[ key ] = member;
					}
				}
			}
			if ( childProps.css ) {
				defineProperty( Child, 'css', {
					value: Child.defaults.noCssTransform ? childProps.css : transformCss( childProps.css, Child._guid )
				} );
			}
		};
	}( config_initOptions, config_registries, utils_defineProperty, extend_wrapMethod, extend_utils_augment, extend_utils_transformCss );

	var extend_extractInlinePartials = function( isObject, augment ) {

		return function( Child, childProps ) {
			if ( isObject( Child.defaults.template ) ) {
				if ( !Child.partials ) {
					Child.partials = {};
				}
				augment( Child.partials, Child.defaults.template.partials );
				if ( childProps.partials ) {
					augment( Child.partials, childProps.partials );
				}
				Child.defaults.template = Child.defaults.template.main;
			}
		};
	}( utils_isObject, extend_utils_augment );

	var extend_conditionallyParseTemplate = function( errors, isClient, parse ) {

		return function( Child ) {
			var templateEl;
			if ( typeof Child.defaults.template === 'string' ) {
				if ( !parse ) {
					throw new Error( errors.missingParser );
				}
				if ( Child.defaults.template.charAt( 0 ) === '#' && isClient ) {
					templateEl = document.getElementById( Child.defaults.template.substring( 1 ) );
					if ( templateEl && templateEl.tagName === 'SCRIPT' ) {
						Child.defaults.template = parse( templateEl.innerHTML, Child );
					} else {
						throw new Error( 'Could not find template element (' + Child.defaults.template + ')' );
					}
				} else {
					Child.defaults.template = parse( Child.defaults.template, Child.defaults );
				}
			}
		};
	}( config_errors, config_isClient, parse__parse );

	var extend_conditionallyParsePartials = function( errors, parse ) {

		return function( Child ) {
			var key;
			if ( Child.partials ) {
				for ( key in Child.partials ) {
					if ( Child.partials.hasOwnProperty( key ) && typeof Child.partials[ key ] === 'string' ) {
						if ( !parse ) {
							throw new Error( errors.missingParser );
						}
						Child.partials[ key ] = parse( Child.partials[ key ], Child );
					}
				}
			}
		};
	}( config_errors, parse__parse );

	var Ractive_initialise = function( isClient, errors, initOptions, registries, warn, create, extend, fillGaps, defineProperties, getElement, isObject, isArray, getGuid, Promise, magicAdaptor, parse ) {

		var flags = [
			'adapt',
			'modifyArrays',
			'magic',
			'twoway',
			'lazy',
			'debug',
			'isolated'
		];
		return function initialiseRactiveInstance( ractive, options ) {
			var template, templateEl, parsedTemplate, promise, fulfilPromise;
			if ( isArray( options.adaptors ) ) {
				warn( 'The `adaptors` option, to indicate which adaptors should be used with a given Ractive instance, has been deprecated in favour of `adapt`. See [TODO] for more information' );
				options.adapt = options.adaptors;
				delete options.adaptors;
			}
			initOptions.keys.forEach( function( key ) {
				if ( options[ key ] === undefined ) {
					options[ key ] = ractive.constructor.defaults[ key ];
				}
			} );
			flags.forEach( function( flag ) {
				ractive[ flag ] = options[ flag ];
			} );
			if ( typeof ractive.adapt === 'string' ) {
				ractive.adapt = [ ractive.adapt ];
			}
			if ( ractive.magic && !magicAdaptor ) {
				throw new Error( 'Getters and setters (magic mode) are not supported in this browser' );
			}
			defineProperties( ractive, {
				_initing: {
					value: true,
					writable: true
				},
				_guid: {
					value: getGuid()
				},
				_subs: {
					value: create( null ),
					configurable: true
				},
				_cache: {
					value: {}
				},
				_cacheMap: {
					value: create( null )
				},
				_deps: {
					value: []
				},
				_depsMap: {
					value: create( null )
				},
				_patternObservers: {
					value: []
				},
				_evaluators: {
					value: create( null )
				},
				_twowayBindings: {
					value: {}
				},
				_animations: {
					value: []
				},
				nodes: {
					value: {}
				},
				_wrapped: {
					value: create( null )
				},
				_liveQueries: {
					value: []
				},
				_liveComponentQueries: {
					value: []
				},
				_childInitQueue: {
					value: []
				},
				_changes: {
					value: []
				},
				_unresolvedImplicitDependencies: {
					value: []
				}
			} );
			if ( options._parent && options._component ) {
				defineProperties( ractive, {
					_parent: {
						value: options._parent
					},
					component: {
						value: options._component
					}
				} );
				options._component.instance = ractive;
			}
			if ( options.el ) {
				ractive.el = getElement( options.el );
				if ( !ractive.el && ractive.debug ) {
					throw new Error( 'Could not find container element' );
				}
			}
			if ( options.eventDefinitions ) {
				warn( 'ractive.eventDefinitions has been deprecated in favour of ractive.events. Support will be removed in future versions' );
				options.events = options.eventDefinitions;
			}
			registries.forEach( function( registry ) {
				if ( ractive.constructor[ registry ] ) {
					ractive[ registry ] = extend( create( ractive.constructor[ registry ] ), options[ registry ] );
				} else if ( options[ registry ] ) {
					ractive[ registry ] = options[ registry ];
				}
			} );
			if ( !ractive.data ) {
				ractive.data = {};
			}
			template = options.template;
			if ( typeof template === 'string' ) {
				if ( !parse ) {
					throw new Error( errors.missingParser );
				}
				if ( template.charAt( 0 ) === '#' && isClient ) {
					templateEl = document.getElementById( template.substring( 1 ) );
					if ( templateEl ) {
						parsedTemplate = parse( templateEl.innerHTML, options );
					} else {
						throw new Error( 'Could not find template element (' + template + ')' );
					}
				} else {
					parsedTemplate = parse( template, options );
				}
			} else {
				parsedTemplate = template;
			}
			if ( isObject( parsedTemplate ) ) {
				fillGaps( ractive.partials, parsedTemplate.partials );
				parsedTemplate = parsedTemplate.main;
			}
			if ( parsedTemplate && parsedTemplate.length === 1 && typeof parsedTemplate[ 0 ] === 'string' ) {
				parsedTemplate = parsedTemplate[ 0 ];
			}
			ractive.template = parsedTemplate;
			extend( ractive.partials, options.partials );
			ractive.parseOptions = {
				preserveWhitespace: options.preserveWhitespace,
				sanitize: options.sanitize,
				stripComments: options.stripComments
			};
			ractive.transitionsEnabled = options.noIntro ? false : options.transitionsEnabled;
			if ( isClient && !ractive.el ) {
				ractive.el = document.createDocumentFragment();
			}
			if ( ractive.el && !options.append ) {
				ractive.el.innerHTML = '';
			}
			promise = new Promise( function( fulfil ) {
				fulfilPromise = fulfil;
			} );
			ractive.render( ractive.el, fulfilPromise );
			if ( options.complete ) {
				promise.then( options.complete.bind( ractive ) );
			}
			ractive.transitionsEnabled = options.transitionsEnabled;
			ractive._initing = false;
		};
	}( config_isClient, config_errors, config_initOptions, config_registries, utils_warn, utils_create, utils_extend, utils_fillGaps, utils_defineProperties, utils_getElement, utils_isObject, utils_isArray, utils_getGuid, utils_Promise, shared_get_magicAdaptor, parse__parse );

	var extend_initChildInstance = function( initOptions, wrapMethod, initialise ) {

		return function initChildInstance( child, Child, options ) {
			initOptions.keys.forEach( function( key ) {
				var value = options[ key ],
					defaultValue = Child.defaults[ key ];
				if ( typeof value === 'function' && typeof defaultValue === 'function' ) {
					options[ key ] = wrapMethod( value, defaultValue );
				}
			} );
			if ( child.beforeInit ) {
				child.beforeInit( options );
			}
			initialise( child, options );
			if ( options._parent && options._parent._rendering ) {
				options._parent._childInitQueue.push( {
					instance: child,
					options: options
				} );
			} else if ( child.init ) {
				child.init( options );
			}
		};
	}( config_initOptions, extend_wrapMethod, Ractive_initialise );

	var extend__extend = function( create, defineProperties, getGuid, extendObject, inheritFromParent, inheritFromChildProps, extractInlinePartials, conditionallyParseTemplate, conditionallyParsePartials, initChildInstance, circular ) {

		var Ractive;
		circular.push( function() {
			Ractive = circular.Ractive;
		} );
		return function extend( childProps ) {
			var Parent = this,
				Child, adaptor, i;
			if ( childProps.prototype instanceof Ractive ) {
				childProps = extendObject( {}, childProps, childProps.prototype, childProps.defaults );
			}
			Child = function( options ) {
				initChildInstance( this, Child, options || {} );
			};
			Child.prototype = create( Parent.prototype );
			Child.prototype.constructor = Child;
			defineProperties( Child, {
				extend: {
					value: Parent.extend
				},
				_guid: {
					value: getGuid()
				}
			} );
			inheritFromParent( Child, Parent );
			inheritFromChildProps( Child, childProps );
			if ( Child.adaptors && ( i = Child.defaults.adapt.length ) ) {
				while ( i-- ) {
					adaptor = Child.defaults.adapt[ i ];
					if ( typeof adaptor === 'string' ) {
						Child.defaults.adapt[ i ] = Child.adaptors[ adaptor ] || adaptor;
					}
				}
			}
			if ( childProps.template ) {
				conditionallyParseTemplate( Child );
				extractInlinePartials( Child, childProps );
				conditionallyParsePartials( Child );
			}
			return Child;
		};
	}( utils_create, utils_defineProperties, utils_getGuid, utils_extend, extend_inheritFromParent, extend_inheritFromChildProps, extend_extractInlinePartials, extend_conditionallyParseTemplate, extend_conditionallyParsePartials, extend_initChildInstance, circular );

	var Ractive__Ractive = function( initOptions, svg, defineProperties, prototype, partialRegistry, adaptorRegistry, componentsRegistry, easingRegistry, interpolatorsRegistry, Promise, extend, parse, initialise, circular ) {

		var Ractive = function( options ) {
			initialise( this, options );
		};
		defineProperties( Ractive, {
			prototype: {
				value: prototype
			},
			partials: {
				value: partialRegistry
			},
			adaptors: {
				value: adaptorRegistry
			},
			easing: {
				value: easingRegistry
			},
			transitions: {
				value: {}
			},
			events: {
				value: {}
			},
			components: {
				value: componentsRegistry
			},
			decorators: {
				value: {}
			},
			interpolators: {
				value: interpolatorsRegistry
			},
			defaults: {
				value: initOptions.defaults
			},
			svg: {
				value: svg
			},
			VERSION: {
				value: 'v0.3.9-317-d23e408'
			}
		} );
		Ractive.eventDefinitions = Ractive.events;
		Ractive.prototype.constructor = Ractive;
		Ractive.Promise = Promise;
		Ractive.extend = extend;
		Ractive.parse = parse;
		circular.Ractive = Ractive;
		return Ractive;
	}( config_initOptions, config_svg, utils_defineProperties, Ractive_prototype__prototype, registries_partials, registries_adaptors, registries_components, registries_easing, registries_interpolators, utils_Promise, extend__extend, parse__parse, Ractive_initialise, circular );

	var Ractive = function( Ractive, circular, legacy ) {

		var FUNCTION = 'function';
		while ( circular.length ) {
			circular.pop()();
		}
		if ( typeof Date.now !== FUNCTION || typeof String.prototype.trim !== FUNCTION || typeof Object.keys !== FUNCTION || typeof Array.prototype.indexOf !== FUNCTION || typeof Array.prototype.forEach !== FUNCTION || typeof Array.prototype.map !== FUNCTION || typeof Array.prototype.filter !== FUNCTION || typeof window !== 'undefined' && typeof window.addEventListener !== FUNCTION ) {
			throw new Error( 'It looks like you\'re attempting to use Ractive.js in an older browser. You\'ll need to use one of the \'legacy builds\' in order to continue - see http://docs.ractivejs.org/latest/legacy-builds for more information.' );
		}
		if ( typeof window !== 'undefined' && window.Node && !window.Node.prototype.contains && window.HTMLElement && window.HTMLElement.prototype.contains ) {
			window.Node.prototype.contains = window.HTMLElement.prototype.contains;
		}
		return Ractive;
	}( Ractive__Ractive, circular, legacy );


	// export as Common JS module...
	if ( typeof module !== "undefined" && module.exports ) {
		module.exports = Ractive;
	}

	// ... or as AMD module
	else if ( typeof define === "function" && define.amd ) {
		define( function() {
			return Ractive;
		} );
	}

	// ... or as browser global
	global.Ractive = Ractive;

	Ractive.noConflict = function() {
		global.Ractive = noConflict;
		return Ractive;
	};

}( typeof window !== 'undefined' ? window : this ) );

},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvYW5kcmV3L1Byb2plY3RzL29zcy9yYWRpb2Rhbi9tYWdpYy1idXR0b24vbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9hbmRyZXcvUHJvamVjdHMvb3NzL3JhZGlvZGFuL21hZ2ljLWJ1dHRvbi9hcHAvdWkvc3RhdGljL2pzL2FwcC5qcyIsIi9Vc2Vycy9hbmRyZXcvUHJvamVjdHMvb3NzL3JhZGlvZGFuL21hZ2ljLWJ1dHRvbi9hcHAvdWkvc3RhdGljL2pzL3NlcnZpY2VzLmpzIiwiL1VzZXJzL2FuZHJldy9Qcm9qZWN0cy9vc3MvcmFkaW9kYW4vbWFnaWMtYnV0dG9uL2FwcC91aS9zdGF0aWMvanMvdXRpbHMuanMiLCIvVXNlcnMvYW5kcmV3L1Byb2plY3RzL29zcy9yYWRpb2Rhbi9tYWdpYy1idXR0b24vYXBwL3VpL3N0YXRpYy9qcy94aHIuanMiLCIvVXNlcnMvYW5kcmV3L1Byb2plY3RzL29zcy9yYWRpb2Rhbi9tYWdpYy1idXR0b24vbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2luc2VydC1tb2R1bGUtZ2xvYmFscy9ub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwiL1VzZXJzL2FuZHJldy9Qcm9qZWN0cy9vc3MvcmFkaW9kYW4vbWFnaWMtYnV0dG9uL25vZGVfbW9kdWxlcy9lczYtcHJvbWlzZS9kaXN0L2NvbW1vbmpzL21haW4uanMiLCIvVXNlcnMvYW5kcmV3L1Byb2plY3RzL29zcy9yYWRpb2Rhbi9tYWdpYy1idXR0b24vbm9kZV9tb2R1bGVzL2VzNi1wcm9taXNlL2Rpc3QvY29tbW9uanMvcHJvbWlzZS9hbGwuanMiLCIvVXNlcnMvYW5kcmV3L1Byb2plY3RzL29zcy9yYWRpb2Rhbi9tYWdpYy1idXR0b24vbm9kZV9tb2R1bGVzL2VzNi1wcm9taXNlL2Rpc3QvY29tbW9uanMvcHJvbWlzZS9hc2FwLmpzIiwiL1VzZXJzL2FuZHJldy9Qcm9qZWN0cy9vc3MvcmFkaW9kYW4vbWFnaWMtYnV0dG9uL25vZGVfbW9kdWxlcy9lczYtcHJvbWlzZS9kaXN0L2NvbW1vbmpzL3Byb21pc2UvY2FzdC5qcyIsIi9Vc2Vycy9hbmRyZXcvUHJvamVjdHMvb3NzL3JhZGlvZGFuL21hZ2ljLWJ1dHRvbi9ub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9jb21tb25qcy9wcm9taXNlL2NvbmZpZy5qcyIsIi9Vc2Vycy9hbmRyZXcvUHJvamVjdHMvb3NzL3JhZGlvZGFuL21hZ2ljLWJ1dHRvbi9ub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9jb21tb25qcy9wcm9taXNlL3BvbHlmaWxsLmpzIiwiL1VzZXJzL2FuZHJldy9Qcm9qZWN0cy9vc3MvcmFkaW9kYW4vbWFnaWMtYnV0dG9uL25vZGVfbW9kdWxlcy9lczYtcHJvbWlzZS9kaXN0L2NvbW1vbmpzL3Byb21pc2UvcHJvbWlzZS5qcyIsIi9Vc2Vycy9hbmRyZXcvUHJvamVjdHMvb3NzL3JhZGlvZGFuL21hZ2ljLWJ1dHRvbi9ub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9jb21tb25qcy9wcm9taXNlL3JhY2UuanMiLCIvVXNlcnMvYW5kcmV3L1Byb2plY3RzL29zcy9yYWRpb2Rhbi9tYWdpYy1idXR0b24vbm9kZV9tb2R1bGVzL2VzNi1wcm9taXNlL2Rpc3QvY29tbW9uanMvcHJvbWlzZS9yZWplY3QuanMiLCIvVXNlcnMvYW5kcmV3L1Byb2plY3RzL29zcy9yYWRpb2Rhbi9tYWdpYy1idXR0b24vbm9kZV9tb2R1bGVzL2VzNi1wcm9taXNlL2Rpc3QvY29tbW9uanMvcHJvbWlzZS9yZXNvbHZlLmpzIiwiL1VzZXJzL2FuZHJldy9Qcm9qZWN0cy9vc3MvcmFkaW9kYW4vbWFnaWMtYnV0dG9uL25vZGVfbW9kdWxlcy9lczYtcHJvbWlzZS9kaXN0L2NvbW1vbmpzL3Byb21pc2UvdXRpbHMuanMiLCIvVXNlcnMvYW5kcmV3L1Byb2plY3RzL29zcy9yYWRpb2Rhbi9tYWdpYy1idXR0b24vbm9kZV9tb2R1bGVzL3JhY3RpdmUtZXZlbnRzLXRhcC9yYWN0aXZlLWV2ZW50cy10YXAuanMiLCIvVXNlcnMvYW5kcmV3L1Byb2plY3RzL29zcy9yYWRpb2Rhbi9tYWdpYy1idXR0b24vbm9kZV9tb2R1bGVzL3JhY3RpdmUvYnVpbGQvUmFjdGl2ZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdlFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJjb25zb2xlLmxvZygnQ29yZSBhcHAgc3RhcnRlZCcpO1xuXG52YXIgUmFjdGl2ZSA9IHJlcXVpcmUoJ3JhY3RpdmUnKSxcbiAgICB4aHIgICAgID0gcmVxdWlyZSgnLi94aHInKSxcbiAgICBTZXJ2aWNlcz0gcmVxdWlyZSgnLi9zZXJ2aWNlcycpLFxuICAgIHV0aWxzICAgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG5cbi8qXG4gIFJhY3RpdmUgcGx1Z2luc1xuKi9cbnJlcXVpcmUoJ3JhY3RpdmUtZXZlbnRzLXRhcCcpO1xuXG52YXIgY29udGFpbmVyID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignW2RhdGEtdWktY29udGFpbmVyXScpLFxuICAgIHRlbXBsYXRlICA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLXVpLXRlbXBsYXRlXScpLmlubmVyVGV4dCxcbiAgICBkZWZhdWx0cyAgPSB7XG4gICAgICBwb3dlciAgIDogeyBpc09uOiBmYWxzZSB9LFxuICAgICAgc2VydmljZXM6IFtdLFxuICAgICAgYXVkaW8gICA6IHt9XG4gICAgfSxcbiAgICAvLyBSZWZlcmVuY2UgdG8gc2VydmljZXMgdG8gYmVcbiAgICAvLyBrZXB0IHVwIHRvIGRhdGUgd2l0aCBuZXcgZGF0YVxuICAgIHNlcnZpY2VzLFxuICAgIHN0YXRlID0gZGVmYXVsdHMsXG4gICAgdWk7XG5cbnhoci5nZXQoJy9yYWRpby9zdGF0ZS5qc29uJylcbiAgIC50aGVuKGluaXRXaXRoRGF0YSwgZmFpbHVyZSk7XG5cbmZ1bmN0aW9uIGluaXRXaXRoRGF0YShkYXRhKSB7XG4gIGNvbnNvbGUubG9nKCdpbml0V2l0aERhdGEnKTtcblxuICBzdGF0ZSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gIHNlcnZpY2VzID0gU2VydmljZXMuY3JlYXRlKHN0YXRlLnNlcnZpY2VzKVxuICBzdGF0ZS5zZXJ2aWNlcyA9IHNlcnZpY2VzLmxpc3QoKTtcblxuICBjb25zb2xlLmxvZygnc3RhdGUnLCBzdGF0ZSk7XG4gIGNvbnNvbGUubG9nKCdzZXJ2aWNlcycsIHNlcnZpY2VzLmxpc3QoKSk7XG5cbiAgLy8gSGVscGVyIGZ1bmN0aW9ucyBmb3IgdGVtcGxhdGVzXG4gIHN0YXRlLmZpcnN0ID0gZnVuY3Rpb24gKGFycmF5KSB7XG4gICAgY29uc29sZS5sb2coJ2ZpcnN0Jyk7XG4gICAgcmV0dXJuIGFycmF5WzBdO1xuICB9O1xuXG4gIHdpbmRvdy51aSA9IHVpID0gbmV3IFJhY3RpdmUoe1xuICAgIGVsICAgICAgICA6IGNvbnRhaW5lcixcbiAgICB0ZW1wbGF0ZSAgOiB0ZW1wbGF0ZSxcbiAgICBkYXRhICAgICAgOiBzdGF0ZVxuICB9KTtcblxuICAvKlxuICAgIExvZ2dpbmdcbiAgKi9cbiAgdWkub24oJ2NoYW5nZScsIGZ1bmN0aW9uIChrZXlwYXRoLCB2YWx1ZSkge1xuICAgIGNvbnNvbGUubG9nKCdzZXQnLCBrZXlwYXRoLCB2YWx1ZSk7XG4gIH0pO1xuXG4gIC8qXG4gICAgVUkgLT4gUmFkaW8gU3RhdGVcbiAgKi9cbiAgdWkub24oJ3ZvbHVtZScsIHV0aWxzLmRlYm91bmNlKHVpVm9sdW1lQ2hhbmdlLCAyNTApKTtcbiAgdWkub24oJ3NlcnZpY2UnLCB1aVNlcnZpY2VDaGFuZ2UpO1xuICB1aS5vbigncG93ZXInLCB1aVBvd2VyKTtcbiAgdWkub24oJ2F2b2lkJywgdWlBdm9pZCk7XG5cbiAgLypcbiAgICBVSSAtPiBVSVxuICAqL1xuICB1aS5vbignc3RhdGlvbnMtYnV0dG9uJywgY3JlYXRlUGFuZWxUb2dnbGVIYW5kbGVyKCdzZXJ2aWNlcycpKTtcbiAgdWkub24oJ3ZvbHVtZS1idXR0b24nLCBjcmVhdGVQYW5lbFRvZ2dsZUhhbmRsZXIoJ3ZvbHVtZScpKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlUGFuZWxUb2dnbGVIYW5kbGVyKHBhbmVsSWQpIHtcbiAgdmFyIGtleXBhdGggPSAncGFuZWxzLicgKyBwYW5lbElkICsgJy5pc09wZW4nO1xuICByZXR1cm4gZnVuY3Rpb24gKGV2dCkge1xuICAgIHZhciBpc09wZW4gPSB0aGlzLmdldChrZXlwYXRoKTtcbiAgICAgICAgdGhpcy5zZXQoa2V5cGF0aCwgIWlzT3Blbik7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmFjdGl2ZVJlbmRlcmVkKCkge1xufVxuXG5mdW5jdGlvbiB1aVZvbHVtZUNoYW5nZShldnQpIHtcbiAgdmFyIHZhbHVlID0gZXZ0LmNvbnRleHQudm9sdW1lO1xuICBjb25zb2xlLmxvZygndWk6IHZvbHVtZSBjaGFuZ2VkJywgdmFsdWUpO1xuICB4aHIucG9zdCgnL3JhZGlvL3ZvbHVtZS92YWx1ZS8nICsgdmFsdWUgKS50aGVuKHN1Y2Nlc3MsIGZhaWx1cmUpO1xufVxuXG5mdW5jdGlvbiB1aVNlcnZpY2VDaGFuZ2UoZXZ0KSB7XG4gIGV2dC5vcmlnaW5hbC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gIHZhciBpZCA9IGV2dC5jb250ZXh0LmlkLFxuICAgICAgbmV3U2VydmljZSA9IHNlcnZpY2VzLmZpbmRCeUlkKGlkKTtcblxuICBjb25zb2xlLmxvZygndWk6IHNlcnZpY2Ugc2VsZWN0ZWQnLCBpZCwgbmV3U2VydmljZSk7XG4gIHRoaXMuc2V0KCdjdXJyZW50JywgbmV3U2VydmljZSk7XG4gIHhoci5wb3N0KCcvcmFkaW8vc2VydmljZS8nICsgaWQgKS50aGVuKHN1Y2Nlc3MsIGZhaWx1cmUpO1xufVxuXG5mdW5jdGlvbiB1aVBvd2VyKGV2dCkge1xuICBldnQub3JpZ2luYWwucHJldmVudERlZmF1bHQoKTtcbiAgdmFyIGlzT24gPSBldnQuY29udGV4dC5pc09uLFxuICAgICAgbWV0aG9kID0gaXNPbiA/ICdERUxFVEUnIDogJ1BVVCc7XG5cbiAgeGhyKG1ldGhvZCwgJy9yYWRpby9wb3dlcicpO1xufVxuXG5mdW5jdGlvbiB1aUF2b2lkKGV2dCkge1xuICBldnQub3JpZ2luYWwucHJldmVudERlZmF1bHQoKTtcbiAgdmFyIG1ldGhvZCA9IGV2dC5jb250ZXh0LmlzQXZvaWRpbmdcbiAgICAgICAgICAgICAgICA/ICdERUxFVEUnXG4gICAgICAgICAgICAgICAgOiAnUE9TVCc7XG4gIHhocihtZXRob2QsICcvYXZvaWRlcicpO1xufVxuXG4vKlxuICBTdGF0ZSAtPiBVSVxuKi9cbnZhciBldmVudFNvdXJjZSA9IG5ldyBFdmVudFNvdXJjZSgnL2V2ZW50cycpO1xuXG5ldmVudFNvdXJjZS5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24gKGV2dCkge1xuICB2YXIgY29udGVudCA9IEpTT04ucGFyc2UoZXZ0LmRhdGEpO1xuXG4gIHN3aXRjaChjb250ZW50LnRvcGljKSB7XG4gICAgY2FzZSAnYXVkaW8udm9sdW1lJzpcbiAgICAgIHVpLnNldChjb250ZW50LnRvcGljLCBjb250ZW50LmRhdGEudm9sdW1lKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ3NlcnZpY2UuY2hhbmdlZCc6XG4gICAgICBzZXJ2aWNlcy51cGRhdGUoY29udGVudC5kYXRhKTtcbiAgICAgIHVpLnNldCgnY3VycmVudCcsIGNvbnRlbnQuZGF0YSk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdwb3dlcic6XG4gICAgICB1aS5zZXQoJ3Bvd2VyJywgY29udGVudC5kYXRhKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2F2b2lkZXInOlxuICAgICAgdWkuc2V0KCdhdm9pZGVyJywgY29udGVudC5kYXRhKTtcbiAgICAgIGJyZWFrO1xuICAgIGRlZmF1bHQ6XG4gICAgICAvLyBjb25zb2xlLmxvZygnVW5oYW5kbGVkIHRvcGljJywgY29udGVudC50b3BpYywgY29udGVudCk7XG4gIH1cbn0pO1xuXG4vKlxuICBHZW5lcmljIHByb21pc2Ugc3VjY2VzcyBvciBmYWlsdXJlIG9wdGlvbnNcbiovXG5mdW5jdGlvbiBzdWNjZXNzKGNvbnRlbnQpIHtcbiAgY29uc29sZS5sb2coJ3N1Y2Nlc3MnLCBjb250ZW50KTtcbn1cblxuZnVuY3Rpb24gZmFpbHVyZShlcnIpIHtcbiAgY29uc29sZS53YXJuKCdmYWlsdXJlJywgZXJyKTtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0geyBjcmVhdGU6IGNyZWF0ZSB9O1xuXG5cbmZ1bmN0aW9uIGNyZWF0ZShhcnJheSkge1xuICB2YXIgaW5zdGFuY2UgPSB7fSxcbiAgICAgIHNlcnZpY2VzID0gYXJyYXk7XG5cbiAgLy8gRmluZCBhIHNpbmdsZSBzZXJ2aWNlIGJ5IElEXG4gIGluc3RhbmNlLmZpbmRCeUlkID0gZmluZFNlcnZpY2U7XG5cbiAgLy8gUmV0dXJuIGFsbCBzZXJ2aWNlc1xuICBpbnN0YW5jZS5saXN0ID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gc2VydmljZXMgfTtcblxuICAvLyBVcGRhdGUgZGF0YSBhYm91dCBhIHNlcnZpY2VcbiAgaW5zdGFuY2UudXBkYXRlID0gdXBkYXRlU2VydmljZTtcblxuICBmdW5jdGlvbiB1cGRhdGVTZXJ2aWNlKGRhdGEpIHtcbiAgICB2YXIgaW5kZXggPSBmaW5kU2VydmljZUluZGV4QnlJZChkYXRhLmlkKTtcbiAgICBzZXJ2aWNlcy5zcGxpY2UoaW5kZXgsIDEsIGRhdGEpO1xuICB9XG5cbiAgZnVuY3Rpb24gZmluZFNlcnZpY2VJbmRleEJ5SWQoaWQpIHtcbiAgICB2YXIgaW5kZXggPSBudWxsO1xuICAgIHNlcnZpY2VzLmZvckVhY2goZnVuY3Rpb24gKGl0ZW0sIGlkeCkge1xuICAgICAgaWYgKGl0ZW0uaWQgPT09IGlkKSB7XG4gICAgICAgIGluZGV4ID0gaWR4O1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBpbmRleDtcbiAgfVxuXG4gIGZ1bmN0aW9uIGZpbmRTZXJ2aWNlKGlkKSB7XG4gICAgcmV0dXJuIGZpbmRGaXJzdChzZXJ2aWNlcywgJ2lkJywgaWQpO1xuICB9XG5cbiAgZnVuY3Rpb24gZmluZEZpcnN0KGFycmF5LCBlbGVtZW50LCB2YWx1ZSkge1xuICAgIHZhciByZXN1bHRzID0gYXJyYXkuZmlsdGVyKGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICByZXR1cm4gaXRlbVtlbGVtZW50XSA9PT0gdmFsdWU7XG4gICAgfSk7XG4gICAgaWYgKHJlc3VsdHMpIHtcbiAgICAgIHJldHVybiByZXN1bHRzWzBdO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBpbnN0YW5jZTtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0ge1xuICBkZWJvdW5jZTogZnVuY3Rpb24gZGVib3VuY2UoZm4sIGRlbGF5KSB7XG4gICAgdmFyIHRpbWVyID0gbnVsbDtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGNvbnRleHQgPSB0aGlzLCBhcmdzID0gYXJndW1lbnRzO1xuICAgICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcbiAgICAgIHRpbWVyID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZuLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgfSwgZGVsYXkpO1xuICAgIH07XG4gIH0sXG4gIHRocm90dGxlOiBmdW5jdGlvbiB0aHJvdHRsZShmbiwgdGhyZXNoaG9sZCwgc2NvcGUpIHtcbiAgICB0aHJlc2hob2xkIHx8ICh0aHJlc2hob2xkID0gMjUwKTtcbiAgICB2YXIgbGFzdCxcbiAgICAgICAgZGVmZXJUaW1lcjtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGNvbnRleHQgPSBzY29wZSB8fCB0aGlzO1xuXG4gICAgICB2YXIgbm93ID0gK25ldyBEYXRlLFxuICAgICAgICAgIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICBpZiAobGFzdCAmJiBub3cgPCBsYXN0ICsgdGhyZXNoaG9sZCkge1xuICAgICAgICAvLyBob2xkIG9uIHRvIGl0XG4gICAgICAgIGNsZWFyVGltZW91dChkZWZlclRpbWVyKTtcbiAgICAgICAgZGVmZXJUaW1lciA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGxhc3QgPSBub3c7XG4gICAgICAgICAgZm4uYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICAgIH0sIHRocmVzaGhvbGQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGFzdCA9IG5vdztcbiAgICAgICAgZm4uYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICB9XG4gICAgfTtcbiAgfVxufTtcbiIsInZhciBQcm9taXNlID0gUHJvbWlzZSB8fCByZXF1aXJlKCdlczYtcHJvbWlzZScpLlByb21pc2U7XG5cbm1vZHVsZS5leHBvcnRzID0geGhyO1xuXG5bJ2dldCcsICdkZWxldGUnLCAncG9zdCcsICdwdXQnXS5mb3JFYWNoKGZ1bmN0aW9uIChtZXRob2QpIHtcbiAgbW9kdWxlLmV4cG9ydHNbbWV0aG9kXSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKSxcbiAgICAgICAgbmV3QXJncyA9IFttZXRob2RdLmNvbmNhdChhcmdzKTtcblxuICAgIHJldHVybiB4aHIuYXBwbHkobnVsbCwgbmV3QXJncyk7XG4gIH1cbn0pXG5cbmZ1bmN0aW9uIHhocihtZXRob2QsIHVybCkge1xuICBtZXRob2QgPSBtZXRob2QgPyBtZXRob2QudG9VcHBlckNhc2UoKSA6ICdHRVQnO1xuICAvLyBSZXR1cm4gYSBuZXcgcHJvbWlzZS5cbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgIC8vIERvIHRoZSB1c3VhbCBYSFIgc3R1ZmZcbiAgICB2YXIgcmVxID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgcmVxLm9wZW4obWV0aG9kLCB1cmwpO1xuXG4gICAgcmVxLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgLy8gVGhpcyBpcyBjYWxsZWQgZXZlbiBvbiA0MDQgZXRjXG4gICAgICAvLyBzbyBjaGVjayB0aGUgc3RhdHVzXG4gICAgICBpZiAocmVxLnN0YXR1cyA9PSAyMDApIHtcbiAgICAgICAgLy8gUmVzb2x2ZSB0aGUgcHJvbWlzZSB3aXRoIHRoZSByZXNwb25zZSB0ZXh0XG4gICAgICAgIHJlc29sdmUocmVxLnJlc3BvbnNlKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICAvLyBPdGhlcndpc2UgcmVqZWN0IHdpdGggdGhlIHN0YXR1cyB0ZXh0XG4gICAgICAgIC8vIHdoaWNoIHdpbGwgaG9wZWZ1bGx5IGJlIGEgbWVhbmluZ2Z1bCBlcnJvclxuICAgICAgICByZWplY3QoRXJyb3IocmVxLnN0YXR1c1RleHQpKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gSGFuZGxlIG5ldHdvcmsgZXJyb3JzXG4gICAgcmVxLm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJlamVjdChFcnJvcihcIk5ldHdvcmsgRXJyb3JcIikpO1xuICAgIH07XG5cbiAgICAvLyBNYWtlIHRoZSByZXF1ZXN0XG4gICAgcmVxLnNlbmQoKTtcbiAgfSk7XG59XG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG5wcm9jZXNzLm5leHRUaWNrID0gKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgY2FuU2V0SW1tZWRpYXRlID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCdcbiAgICAmJiB3aW5kb3cuc2V0SW1tZWRpYXRlO1xuICAgIHZhciBjYW5Qb3N0ID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCdcbiAgICAmJiB3aW5kb3cucG9zdE1lc3NhZ2UgJiYgd2luZG93LmFkZEV2ZW50TGlzdGVuZXJcbiAgICA7XG5cbiAgICBpZiAoY2FuU2V0SW1tZWRpYXRlKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoZikgeyByZXR1cm4gd2luZG93LnNldEltbWVkaWF0ZShmKSB9O1xuICAgIH1cblxuICAgIGlmIChjYW5Qb3N0KSB7XG4gICAgICAgIHZhciBxdWV1ZSA9IFtdO1xuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uIChldikge1xuICAgICAgICAgICAgdmFyIHNvdXJjZSA9IGV2LnNvdXJjZTtcbiAgICAgICAgICAgIGlmICgoc291cmNlID09PSB3aW5kb3cgfHwgc291cmNlID09PSBudWxsKSAmJiBldi5kYXRhID09PSAncHJvY2Vzcy10aWNrJykge1xuICAgICAgICAgICAgICAgIGV2LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgIGlmIChxdWV1ZS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBmbiA9IHF1ZXVlLnNoaWZ0KCk7XG4gICAgICAgICAgICAgICAgICAgIGZuKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LCB0cnVlKTtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gbmV4dFRpY2soZm4pIHtcbiAgICAgICAgICAgIHF1ZXVlLnB1c2goZm4pO1xuICAgICAgICAgICAgd2luZG93LnBvc3RNZXNzYWdlKCdwcm9jZXNzLXRpY2snLCAnKicpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBmdW5jdGlvbiBuZXh0VGljayhmbikge1xuICAgICAgICBzZXRUaW1lb3V0KGZuLCAwKTtcbiAgICB9O1xufSkoKTtcblxucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufVxuXG4vLyBUT0RPKHNodHlsbWFuKVxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG4iLCJcInVzZSBzdHJpY3RcIjtcbnZhciBQcm9taXNlID0gcmVxdWlyZShcIi4vcHJvbWlzZS9wcm9taXNlXCIpLlByb21pc2U7XG52YXIgcG9seWZpbGwgPSByZXF1aXJlKFwiLi9wcm9taXNlL3BvbHlmaWxsXCIpLnBvbHlmaWxsO1xuZXhwb3J0cy5Qcm9taXNlID0gUHJvbWlzZTtcbmV4cG9ydHMucG9seWZpbGwgPSBwb2x5ZmlsbDsiLCJcInVzZSBzdHJpY3RcIjtcbi8qIGdsb2JhbCB0b1N0cmluZyAqL1xuXG52YXIgaXNBcnJheSA9IHJlcXVpcmUoXCIuL3V0aWxzXCIpLmlzQXJyYXk7XG52YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoXCIuL3V0aWxzXCIpLmlzRnVuY3Rpb247XG5cbi8qKlxuICBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aGVuIGFsbCB0aGUgZ2l2ZW4gcHJvbWlzZXMgaGF2ZSBiZWVuXG4gIGZ1bGZpbGxlZCwgb3IgcmVqZWN0ZWQgaWYgYW55IG9mIHRoZW0gYmVjb21lIHJlamVjdGVkLiBUaGUgcmV0dXJuIHByb21pc2VcbiAgaXMgZnVsZmlsbGVkIHdpdGggYW4gYXJyYXkgdGhhdCBnaXZlcyBhbGwgdGhlIHZhbHVlcyBpbiB0aGUgb3JkZXIgdGhleSB3ZXJlXG4gIHBhc3NlZCBpbiB0aGUgYHByb21pc2VzYCBhcnJheSBhcmd1bWVudC5cblxuICBFeGFtcGxlOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgdmFyIHByb21pc2UxID0gUlNWUC5yZXNvbHZlKDEpO1xuICB2YXIgcHJvbWlzZTIgPSBSU1ZQLnJlc29sdmUoMik7XG4gIHZhciBwcm9taXNlMyA9IFJTVlAucmVzb2x2ZSgzKTtcbiAgdmFyIHByb21pc2VzID0gWyBwcm9taXNlMSwgcHJvbWlzZTIsIHByb21pc2UzIF07XG5cbiAgUlNWUC5hbGwocHJvbWlzZXMpLnRoZW4oZnVuY3Rpb24oYXJyYXkpe1xuICAgIC8vIFRoZSBhcnJheSBoZXJlIHdvdWxkIGJlIFsgMSwgMiwgMyBdO1xuICB9KTtcbiAgYGBgXG5cbiAgSWYgYW55IG9mIHRoZSBgcHJvbWlzZXNgIGdpdmVuIHRvIGBSU1ZQLmFsbGAgYXJlIHJlamVjdGVkLCB0aGUgZmlyc3QgcHJvbWlzZVxuICB0aGF0IGlzIHJlamVjdGVkIHdpbGwgYmUgZ2l2ZW4gYXMgYW4gYXJndW1lbnQgdG8gdGhlIHJldHVybmVkIHByb21pc2VzJ3NcbiAgcmVqZWN0aW9uIGhhbmRsZXIuIEZvciBleGFtcGxlOlxuXG4gIEV4YW1wbGU6XG5cbiAgYGBgamF2YXNjcmlwdFxuICB2YXIgcHJvbWlzZTEgPSBSU1ZQLnJlc29sdmUoMSk7XG4gIHZhciBwcm9taXNlMiA9IFJTVlAucmVqZWN0KG5ldyBFcnJvcihcIjJcIikpO1xuICB2YXIgcHJvbWlzZTMgPSBSU1ZQLnJlamVjdChuZXcgRXJyb3IoXCIzXCIpKTtcbiAgdmFyIHByb21pc2VzID0gWyBwcm9taXNlMSwgcHJvbWlzZTIsIHByb21pc2UzIF07XG5cbiAgUlNWUC5hbGwocHJvbWlzZXMpLnRoZW4oZnVuY3Rpb24oYXJyYXkpe1xuICAgIC8vIENvZGUgaGVyZSBuZXZlciBydW5zIGJlY2F1c2UgdGhlcmUgYXJlIHJlamVjdGVkIHByb21pc2VzIVxuICB9LCBmdW5jdGlvbihlcnJvcikge1xuICAgIC8vIGVycm9yLm1lc3NhZ2UgPT09IFwiMlwiXG4gIH0pO1xuICBgYGBcblxuICBAbWV0aG9kIGFsbFxuICBAZm9yIFJTVlBcbiAgQHBhcmFtIHtBcnJheX0gcHJvbWlzZXNcbiAgQHBhcmFtIHtTdHJpbmd9IGxhYmVsXG4gIEByZXR1cm4ge1Byb21pc2V9IHByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2hlbiBhbGwgYHByb21pc2VzYCBoYXZlIGJlZW5cbiAgZnVsZmlsbGVkLCBvciByZWplY3RlZCBpZiBhbnkgb2YgdGhlbSBiZWNvbWUgcmVqZWN0ZWQuXG4qL1xuZnVuY3Rpb24gYWxsKHByb21pc2VzKSB7XG4gIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gIHZhciBQcm9taXNlID0gdGhpcztcblxuICBpZiAoIWlzQXJyYXkocHJvbWlzZXMpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignWW91IG11c3QgcGFzcyBhbiBhcnJheSB0byBhbGwuJyk7XG4gIH1cblxuICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgdmFyIHJlc3VsdHMgPSBbXSwgcmVtYWluaW5nID0gcHJvbWlzZXMubGVuZ3RoLFxuICAgIHByb21pc2U7XG5cbiAgICBpZiAocmVtYWluaW5nID09PSAwKSB7XG4gICAgICByZXNvbHZlKFtdKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZXNvbHZlcihpbmRleCkge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHJlc29sdmVBbGwoaW5kZXgsIHZhbHVlKTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcmVzb2x2ZUFsbChpbmRleCwgdmFsdWUpIHtcbiAgICAgIHJlc3VsdHNbaW5kZXhdID0gdmFsdWU7XG4gICAgICBpZiAoLS1yZW1haW5pbmcgPT09IDApIHtcbiAgICAgICAgcmVzb2x2ZShyZXN1bHRzKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHByb21pc2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBwcm9taXNlID0gcHJvbWlzZXNbaV07XG5cbiAgICAgIGlmIChwcm9taXNlICYmIGlzRnVuY3Rpb24ocHJvbWlzZS50aGVuKSkge1xuICAgICAgICBwcm9taXNlLnRoZW4ocmVzb2x2ZXIoaSksIHJlamVjdCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXNvbHZlQWxsKGksIHByb21pc2UpO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG59XG5cbmV4cG9ydHMuYWxsID0gYWxsOyIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwpe1xuXCJ1c2Ugc3RyaWN0XCI7XG52YXIgYnJvd3Nlckdsb2JhbCA9ICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykgPyB3aW5kb3cgOiB7fTtcbnZhciBCcm93c2VyTXV0YXRpb25PYnNlcnZlciA9IGJyb3dzZXJHbG9iYWwuTXV0YXRpb25PYnNlcnZlciB8fCBicm93c2VyR2xvYmFsLldlYktpdE11dGF0aW9uT2JzZXJ2ZXI7XG52YXIgbG9jYWwgPSAodHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcpID8gZ2xvYmFsIDogdGhpcztcblxuLy8gbm9kZVxuZnVuY3Rpb24gdXNlTmV4dFRpY2soKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBwcm9jZXNzLm5leHRUaWNrKGZsdXNoKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gdXNlTXV0YXRpb25PYnNlcnZlcigpIHtcbiAgdmFyIGl0ZXJhdGlvbnMgPSAwO1xuICB2YXIgb2JzZXJ2ZXIgPSBuZXcgQnJvd3Nlck11dGF0aW9uT2JzZXJ2ZXIoZmx1c2gpO1xuICB2YXIgbm9kZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcnKTtcbiAgb2JzZXJ2ZXIub2JzZXJ2ZShub2RlLCB7IGNoYXJhY3RlckRhdGE6IHRydWUgfSk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIG5vZGUuZGF0YSA9IChpdGVyYXRpb25zID0gKytpdGVyYXRpb25zICUgMik7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHVzZVNldFRpbWVvdXQoKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBsb2NhbC5zZXRUaW1lb3V0KGZsdXNoLCAxKTtcbiAgfTtcbn1cblxudmFyIHF1ZXVlID0gW107XG5mdW5jdGlvbiBmbHVzaCgpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBxdWV1ZS5sZW5ndGg7IGkrKykge1xuICAgIHZhciB0dXBsZSA9IHF1ZXVlW2ldO1xuICAgIHZhciBjYWxsYmFjayA9IHR1cGxlWzBdLCBhcmcgPSB0dXBsZVsxXTtcbiAgICBjYWxsYmFjayhhcmcpO1xuICB9XG4gIHF1ZXVlID0gW107XG59XG5cbnZhciBzY2hlZHVsZUZsdXNoO1xuXG4vLyBEZWNpZGUgd2hhdCBhc3luYyBtZXRob2QgdG8gdXNlIHRvIHRyaWdnZXJpbmcgcHJvY2Vzc2luZyBvZiBxdWV1ZWQgY2FsbGJhY2tzOlxuaWYgKHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJyAmJiB7fS50b1N0cmluZy5jYWxsKHByb2Nlc3MpID09PSAnW29iamVjdCBwcm9jZXNzXScpIHtcbiAgc2NoZWR1bGVGbHVzaCA9IHVzZU5leHRUaWNrKCk7XG59IGVsc2UgaWYgKEJyb3dzZXJNdXRhdGlvbk9ic2VydmVyKSB7XG4gIHNjaGVkdWxlRmx1c2ggPSB1c2VNdXRhdGlvbk9ic2VydmVyKCk7XG59IGVsc2Uge1xuICBzY2hlZHVsZUZsdXNoID0gdXNlU2V0VGltZW91dCgpO1xufVxuXG5mdW5jdGlvbiBhc2FwKGNhbGxiYWNrLCBhcmcpIHtcbiAgdmFyIGxlbmd0aCA9IHF1ZXVlLnB1c2goW2NhbGxiYWNrLCBhcmddKTtcbiAgaWYgKGxlbmd0aCA9PT0gMSkge1xuICAgIC8vIElmIGxlbmd0aCBpcyAxLCB0aGF0IG1lYW5zIHRoYXQgd2UgbmVlZCB0byBzY2hlZHVsZSBhbiBhc3luYyBmbHVzaC5cbiAgICAvLyBJZiBhZGRpdGlvbmFsIGNhbGxiYWNrcyBhcmUgcXVldWVkIGJlZm9yZSB0aGUgcXVldWUgaXMgZmx1c2hlZCwgdGhleVxuICAgIC8vIHdpbGwgYmUgcHJvY2Vzc2VkIGJ5IHRoaXMgZmx1c2ggdGhhdCB3ZSBhcmUgc2NoZWR1bGluZy5cbiAgICBzY2hlZHVsZUZsdXNoKCk7XG4gIH1cbn1cblxuZXhwb3J0cy5hc2FwID0gYXNhcDtcbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwiL1VzZXJzL2FuZHJldy9Qcm9qZWN0cy9vc3MvcmFkaW9kYW4vbWFnaWMtYnV0dG9uL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9pbnNlcnQtbW9kdWxlLWdsb2JhbHMvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qc1wiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pIiwiXCJ1c2Ugc3RyaWN0XCI7XG4vKipcbiAgYFJTVlAuUHJvbWlzZS5jYXN0YCByZXR1cm5zIHRoZSBzYW1lIHByb21pc2UgaWYgdGhhdCBwcm9taXNlIHNoYXJlcyBhIGNvbnN0cnVjdG9yXG4gIHdpdGggdGhlIHByb21pc2UgYmVpbmcgY2FzdGVkLlxuXG4gIEV4YW1wbGU6XG5cbiAgYGBgamF2YXNjcmlwdFxuICB2YXIgcHJvbWlzZSA9IFJTVlAucmVzb2x2ZSgxKTtcbiAgdmFyIGNhc3RlZCA9IFJTVlAuUHJvbWlzZS5jYXN0KHByb21pc2UpO1xuXG4gIGNvbnNvbGUubG9nKHByb21pc2UgPT09IGNhc3RlZCk7IC8vIHRydWVcbiAgYGBgXG5cbiAgSW4gdGhlIGNhc2Ugb2YgYSBwcm9taXNlIHdob3NlIGNvbnN0cnVjdG9yIGRvZXMgbm90IG1hdGNoLCBpdCBpcyBhc3NpbWlsYXRlZC5cbiAgVGhlIHJlc3VsdGluZyBwcm9taXNlIHdpbGwgZnVsZmlsbCBvciByZWplY3QgYmFzZWQgb24gdGhlIG91dGNvbWUgb2YgdGhlXG4gIHByb21pc2UgYmVpbmcgY2FzdGVkLlxuXG4gIEluIHRoZSBjYXNlIG9mIGEgbm9uLXByb21pc2UsIGEgcHJvbWlzZSB3aGljaCB3aWxsIGZ1bGZpbGwgd2l0aCB0aGF0IHZhbHVlIGlzXG4gIHJldHVybmVkLlxuXG4gIEV4YW1wbGU6XG5cbiAgYGBgamF2YXNjcmlwdFxuICB2YXIgdmFsdWUgPSAxOyAvLyBjb3VsZCBiZSBhIG51bWJlciwgYm9vbGVhbiwgc3RyaW5nLCB1bmRlZmluZWQuLi5cbiAgdmFyIGNhc3RlZCA9IFJTVlAuUHJvbWlzZS5jYXN0KHZhbHVlKTtcblxuICBjb25zb2xlLmxvZyh2YWx1ZSA9PT0gY2FzdGVkKTsgLy8gZmFsc2VcbiAgY29uc29sZS5sb2coY2FzdGVkIGluc3RhbmNlb2YgUlNWUC5Qcm9taXNlKSAvLyB0cnVlXG5cbiAgY2FzdGVkLnRoZW4oZnVuY3Rpb24odmFsKSB7XG4gICAgdmFsID09PSB2YWx1ZSAvLyA9PiB0cnVlXG4gIH0pO1xuICBgYGBcblxuICBgUlNWUC5Qcm9taXNlLmNhc3RgIGlzIHNpbWlsYXIgdG8gYFJTVlAucmVzb2x2ZWAsIGJ1dCBgUlNWUC5Qcm9taXNlLmNhc3RgIGRpZmZlcnMgaW4gdGhlXG4gIGZvbGxvd2luZyB3YXlzOlxuICAqIGBSU1ZQLlByb21pc2UuY2FzdGAgc2VydmVzIGFzIGEgbWVtb3J5LWVmZmljaWVudCB3YXkgb2YgZ2V0dGluZyBhIHByb21pc2UsIHdoZW4geW91XG4gIGhhdmUgc29tZXRoaW5nIHRoYXQgY291bGQgZWl0aGVyIGJlIGEgcHJvbWlzZSBvciBhIHZhbHVlLiBSU1ZQLnJlc29sdmVcbiAgd2lsbCBoYXZlIHRoZSBzYW1lIGVmZmVjdCBidXQgd2lsbCBjcmVhdGUgYSBuZXcgcHJvbWlzZSB3cmFwcGVyIGlmIHRoZVxuICBhcmd1bWVudCBpcyBhIHByb21pc2UuXG4gICogYFJTVlAuUHJvbWlzZS5jYXN0YCBpcyBhIHdheSBvZiBjYXN0aW5nIGluY29taW5nIHRoZW5hYmxlcyBvciBwcm9taXNlIHN1YmNsYXNzZXMgdG9cbiAgcHJvbWlzZXMgb2YgdGhlIGV4YWN0IGNsYXNzIHNwZWNpZmllZCwgc28gdGhhdCB0aGUgcmVzdWx0aW5nIG9iamVjdCdzIGB0aGVuYCBpc1xuICBlbnN1cmVkIHRvIGhhdmUgdGhlIGJlaGF2aW9yIG9mIHRoZSBjb25zdHJ1Y3RvciB5b3UgYXJlIGNhbGxpbmcgY2FzdCBvbiAoaS5lLiwgUlNWUC5Qcm9taXNlKS5cblxuICBAbWV0aG9kIGNhc3RcbiAgQGZvciBSU1ZQXG4gIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgdG8gYmUgY2FzdGVkXG4gIEByZXR1cm4ge1Byb21pc2V9IHByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2hlbiBhbGwgcHJvcGVydGllcyBvZiBgcHJvbWlzZXNgXG4gIGhhdmUgYmVlbiBmdWxmaWxsZWQsIG9yIHJlamVjdGVkIGlmIGFueSBvZiB0aGVtIGJlY29tZSByZWplY3RlZC5cbiovXG5cblxuZnVuY3Rpb24gY2FzdChvYmplY3QpIHtcbiAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgaWYgKG9iamVjdCAmJiB0eXBlb2Ygb2JqZWN0ID09PSAnb2JqZWN0JyAmJiBvYmplY3QuY29uc3RydWN0b3IgPT09IHRoaXMpIHtcbiAgICByZXR1cm4gb2JqZWN0O1xuICB9XG5cbiAgdmFyIFByb21pc2UgPSB0aGlzO1xuXG4gIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlKSB7XG4gICAgcmVzb2x2ZShvYmplY3QpO1xuICB9KTtcbn1cblxuZXhwb3J0cy5jYXN0ID0gY2FzdDsiLCJcInVzZSBzdHJpY3RcIjtcbnZhciBjb25maWcgPSB7XG4gIGluc3RydW1lbnQ6IGZhbHNlXG59O1xuXG5mdW5jdGlvbiBjb25maWd1cmUobmFtZSwgdmFsdWUpIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHtcbiAgICBjb25maWdbbmFtZV0gPSB2YWx1ZTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gY29uZmlnW25hbWVdO1xuICB9XG59XG5cbmV4cG9ydHMuY29uZmlnID0gY29uZmlnO1xuZXhwb3J0cy5jb25maWd1cmUgPSBjb25maWd1cmU7IiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgUlNWUFByb21pc2UgPSByZXF1aXJlKFwiLi9wcm9taXNlXCIpLlByb21pc2U7XG52YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoXCIuL3V0aWxzXCIpLmlzRnVuY3Rpb247XG5cbmZ1bmN0aW9uIHBvbHlmaWxsKCkge1xuICB2YXIgZXM2UHJvbWlzZVN1cHBvcnQgPSBcbiAgICBcIlByb21pc2VcIiBpbiB3aW5kb3cgJiZcbiAgICAvLyBTb21lIG9mIHRoZXNlIG1ldGhvZHMgYXJlIG1pc3NpbmcgZnJvbVxuICAgIC8vIEZpcmVmb3gvQ2hyb21lIGV4cGVyaW1lbnRhbCBpbXBsZW1lbnRhdGlvbnNcbiAgICBcImNhc3RcIiBpbiB3aW5kb3cuUHJvbWlzZSAmJlxuICAgIFwicmVzb2x2ZVwiIGluIHdpbmRvdy5Qcm9taXNlICYmXG4gICAgXCJyZWplY3RcIiBpbiB3aW5kb3cuUHJvbWlzZSAmJlxuICAgIFwiYWxsXCIgaW4gd2luZG93LlByb21pc2UgJiZcbiAgICBcInJhY2VcIiBpbiB3aW5kb3cuUHJvbWlzZSAmJlxuICAgIC8vIE9sZGVyIHZlcnNpb24gb2YgdGhlIHNwZWMgaGFkIGEgcmVzb2x2ZXIgb2JqZWN0XG4gICAgLy8gYXMgdGhlIGFyZyByYXRoZXIgdGhhbiBhIGZ1bmN0aW9uXG4gICAgKGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHJlc29sdmU7XG4gICAgICBuZXcgd2luZG93LlByb21pc2UoZnVuY3Rpb24ocikgeyByZXNvbHZlID0gcjsgfSk7XG4gICAgICByZXR1cm4gaXNGdW5jdGlvbihyZXNvbHZlKTtcbiAgICB9KCkpO1xuXG4gIGlmICghZXM2UHJvbWlzZVN1cHBvcnQpIHtcbiAgICB3aW5kb3cuUHJvbWlzZSA9IFJTVlBQcm9taXNlO1xuICB9XG59XG5cbmV4cG9ydHMucG9seWZpbGwgPSBwb2x5ZmlsbDsiLCJcInVzZSBzdHJpY3RcIjtcbnZhciBjb25maWcgPSByZXF1aXJlKFwiLi9jb25maWdcIikuY29uZmlnO1xudmFyIGNvbmZpZ3VyZSA9IHJlcXVpcmUoXCIuL2NvbmZpZ1wiKS5jb25maWd1cmU7XG52YXIgb2JqZWN0T3JGdW5jdGlvbiA9IHJlcXVpcmUoXCIuL3V0aWxzXCIpLm9iamVjdE9yRnVuY3Rpb247XG52YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoXCIuL3V0aWxzXCIpLmlzRnVuY3Rpb247XG52YXIgbm93ID0gcmVxdWlyZShcIi4vdXRpbHNcIikubm93O1xudmFyIGNhc3QgPSByZXF1aXJlKFwiLi9jYXN0XCIpLmNhc3Q7XG52YXIgYWxsID0gcmVxdWlyZShcIi4vYWxsXCIpLmFsbDtcbnZhciByYWNlID0gcmVxdWlyZShcIi4vcmFjZVwiKS5yYWNlO1xudmFyIHN0YXRpY1Jlc29sdmUgPSByZXF1aXJlKFwiLi9yZXNvbHZlXCIpLnJlc29sdmU7XG52YXIgc3RhdGljUmVqZWN0ID0gcmVxdWlyZShcIi4vcmVqZWN0XCIpLnJlamVjdDtcbnZhciBhc2FwID0gcmVxdWlyZShcIi4vYXNhcFwiKS5hc2FwO1xuXG52YXIgY291bnRlciA9IDA7XG5cbmNvbmZpZy5hc3luYyA9IGFzYXA7IC8vIGRlZmF1bHQgYXN5bmMgaXMgYXNhcDtcblxuZnVuY3Rpb24gUHJvbWlzZShyZXNvbHZlcikge1xuICBpZiAoIWlzRnVuY3Rpb24ocmVzb2x2ZXIpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignWW91IG11c3QgcGFzcyBhIHJlc29sdmVyIGZ1bmN0aW9uIGFzIHRoZSBmaXJzdCBhcmd1bWVudCB0byB0aGUgcHJvbWlzZSBjb25zdHJ1Y3RvcicpO1xuICB9XG5cbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFByb21pc2UpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkZhaWxlZCB0byBjb25zdHJ1Y3QgJ1Byb21pc2UnOiBQbGVhc2UgdXNlIHRoZSAnbmV3JyBvcGVyYXRvciwgdGhpcyBvYmplY3QgY29uc3RydWN0b3IgY2Fubm90IGJlIGNhbGxlZCBhcyBhIGZ1bmN0aW9uLlwiKTtcbiAgfVxuXG4gIHRoaXMuX3N1YnNjcmliZXJzID0gW107XG5cbiAgaW52b2tlUmVzb2x2ZXIocmVzb2x2ZXIsIHRoaXMpO1xufVxuXG5mdW5jdGlvbiBpbnZva2VSZXNvbHZlcihyZXNvbHZlciwgcHJvbWlzZSkge1xuICBmdW5jdGlvbiByZXNvbHZlUHJvbWlzZSh2YWx1ZSkge1xuICAgIHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVqZWN0UHJvbWlzZShyZWFzb24pIHtcbiAgICByZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgcmVzb2x2ZXIocmVzb2x2ZVByb21pc2UsIHJlamVjdFByb21pc2UpO1xuICB9IGNhdGNoKGUpIHtcbiAgICByZWplY3RQcm9taXNlKGUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGludm9rZUNhbGxiYWNrKHNldHRsZWQsIHByb21pc2UsIGNhbGxiYWNrLCBkZXRhaWwpIHtcbiAgdmFyIGhhc0NhbGxiYWNrID0gaXNGdW5jdGlvbihjYWxsYmFjayksXG4gICAgICB2YWx1ZSwgZXJyb3IsIHN1Y2NlZWRlZCwgZmFpbGVkO1xuXG4gIGlmIChoYXNDYWxsYmFjaykge1xuICAgIHRyeSB7XG4gICAgICB2YWx1ZSA9IGNhbGxiYWNrKGRldGFpbCk7XG4gICAgICBzdWNjZWVkZWQgPSB0cnVlO1xuICAgIH0gY2F0Y2goZSkge1xuICAgICAgZmFpbGVkID0gdHJ1ZTtcbiAgICAgIGVycm9yID0gZTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdmFsdWUgPSBkZXRhaWw7XG4gICAgc3VjY2VlZGVkID0gdHJ1ZTtcbiAgfVxuXG4gIGlmIChoYW5kbGVUaGVuYWJsZShwcm9taXNlLCB2YWx1ZSkpIHtcbiAgICByZXR1cm47XG4gIH0gZWxzZSBpZiAoaGFzQ2FsbGJhY2sgJiYgc3VjY2VlZGVkKSB7XG4gICAgcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG4gIH0gZWxzZSBpZiAoZmFpbGVkKSB7XG4gICAgcmVqZWN0KHByb21pc2UsIGVycm9yKTtcbiAgfSBlbHNlIGlmIChzZXR0bGVkID09PSBGVUxGSUxMRUQpIHtcbiAgICByZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgfSBlbHNlIGlmIChzZXR0bGVkID09PSBSRUpFQ1RFRCkge1xuICAgIHJlamVjdChwcm9taXNlLCB2YWx1ZSk7XG4gIH1cbn1cblxudmFyIFBFTkRJTkcgICA9IHZvaWQgMDtcbnZhciBTRUFMRUQgICAgPSAwO1xudmFyIEZVTEZJTExFRCA9IDE7XG52YXIgUkVKRUNURUQgID0gMjtcblxuZnVuY3Rpb24gc3Vic2NyaWJlKHBhcmVudCwgY2hpbGQsIG9uRnVsZmlsbG1lbnQsIG9uUmVqZWN0aW9uKSB7XG4gIHZhciBzdWJzY3JpYmVycyA9IHBhcmVudC5fc3Vic2NyaWJlcnM7XG4gIHZhciBsZW5ndGggPSBzdWJzY3JpYmVycy5sZW5ndGg7XG5cbiAgc3Vic2NyaWJlcnNbbGVuZ3RoXSA9IGNoaWxkO1xuICBzdWJzY3JpYmVyc1tsZW5ndGggKyBGVUxGSUxMRURdID0gb25GdWxmaWxsbWVudDtcbiAgc3Vic2NyaWJlcnNbbGVuZ3RoICsgUkVKRUNURURdICA9IG9uUmVqZWN0aW9uO1xufVxuXG5mdW5jdGlvbiBwdWJsaXNoKHByb21pc2UsIHNldHRsZWQpIHtcbiAgdmFyIGNoaWxkLCBjYWxsYmFjaywgc3Vic2NyaWJlcnMgPSBwcm9taXNlLl9zdWJzY3JpYmVycywgZGV0YWlsID0gcHJvbWlzZS5fZGV0YWlsO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3Vic2NyaWJlcnMubGVuZ3RoOyBpICs9IDMpIHtcbiAgICBjaGlsZCA9IHN1YnNjcmliZXJzW2ldO1xuICAgIGNhbGxiYWNrID0gc3Vic2NyaWJlcnNbaSArIHNldHRsZWRdO1xuXG4gICAgaW52b2tlQ2FsbGJhY2soc2V0dGxlZCwgY2hpbGQsIGNhbGxiYWNrLCBkZXRhaWwpO1xuICB9XG5cbiAgcHJvbWlzZS5fc3Vic2NyaWJlcnMgPSBudWxsO1xufVxuXG5Qcm9taXNlLnByb3RvdHlwZSA9IHtcbiAgY29uc3RydWN0b3I6IFByb21pc2UsXG5cbiAgX3N0YXRlOiB1bmRlZmluZWQsXG4gIF9kZXRhaWw6IHVuZGVmaW5lZCxcbiAgX3N1YnNjcmliZXJzOiB1bmRlZmluZWQsXG5cbiAgdGhlbjogZnVuY3Rpb24ob25GdWxmaWxsbWVudCwgb25SZWplY3Rpb24pIHtcbiAgICB2YXIgcHJvbWlzZSA9IHRoaXM7XG5cbiAgICB2YXIgdGhlblByb21pc2UgPSBuZXcgdGhpcy5jb25zdHJ1Y3RvcihmdW5jdGlvbigpIHt9KTtcblxuICAgIGlmICh0aGlzLl9zdGF0ZSkge1xuICAgICAgdmFyIGNhbGxiYWNrcyA9IGFyZ3VtZW50cztcbiAgICAgIGNvbmZpZy5hc3luYyhmdW5jdGlvbiBpbnZva2VQcm9taXNlQ2FsbGJhY2soKSB7XG4gICAgICAgIGludm9rZUNhbGxiYWNrKHByb21pc2UuX3N0YXRlLCB0aGVuUHJvbWlzZSwgY2FsbGJhY2tzW3Byb21pc2UuX3N0YXRlIC0gMV0sIHByb21pc2UuX2RldGFpbCk7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3Vic2NyaWJlKHRoaXMsIHRoZW5Qcm9taXNlLCBvbkZ1bGZpbGxtZW50LCBvblJlamVjdGlvbik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoZW5Qcm9taXNlO1xuICB9LFxuXG4gICdjYXRjaCc6IGZ1bmN0aW9uKG9uUmVqZWN0aW9uKSB7XG4gICAgcmV0dXJuIHRoaXMudGhlbihudWxsLCBvblJlamVjdGlvbik7XG4gIH1cbn07XG5cblByb21pc2UuYWxsID0gYWxsO1xuUHJvbWlzZS5jYXN0ID0gY2FzdDtcblByb21pc2UucmFjZSA9IHJhY2U7XG5Qcm9taXNlLnJlc29sdmUgPSBzdGF0aWNSZXNvbHZlO1xuUHJvbWlzZS5yZWplY3QgPSBzdGF0aWNSZWplY3Q7XG5cbmZ1bmN0aW9uIGhhbmRsZVRoZW5hYmxlKHByb21pc2UsIHZhbHVlKSB7XG4gIHZhciB0aGVuID0gbnVsbCxcbiAgcmVzb2x2ZWQ7XG5cbiAgdHJ5IHtcbiAgICBpZiAocHJvbWlzZSA9PT0gdmFsdWUpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJBIHByb21pc2VzIGNhbGxiYWNrIGNhbm5vdCByZXR1cm4gdGhhdCBzYW1lIHByb21pc2UuXCIpO1xuICAgIH1cblxuICAgIGlmIChvYmplY3RPckZ1bmN0aW9uKHZhbHVlKSkge1xuICAgICAgdGhlbiA9IHZhbHVlLnRoZW47XG5cbiAgICAgIGlmIChpc0Z1bmN0aW9uKHRoZW4pKSB7XG4gICAgICAgIHRoZW4uY2FsbCh2YWx1ZSwgZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgaWYgKHJlc29sdmVkKSB7IHJldHVybiB0cnVlOyB9XG4gICAgICAgICAgcmVzb2x2ZWQgPSB0cnVlO1xuXG4gICAgICAgICAgaWYgKHZhbHVlICE9PSB2YWwpIHtcbiAgICAgICAgICAgIHJlc29sdmUocHJvbWlzZSwgdmFsKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZnVsZmlsbChwcm9taXNlLCB2YWwpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSwgZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgaWYgKHJlc29sdmVkKSB7IHJldHVybiB0cnVlOyB9XG4gICAgICAgICAgcmVzb2x2ZWQgPSB0cnVlO1xuXG4gICAgICAgICAgcmVqZWN0KHByb21pc2UsIHZhbCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAocmVzb2x2ZWQpIHsgcmV0dXJuIHRydWU7IH1cbiAgICByZWplY3QocHJvbWlzZSwgZXJyb3IpO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiByZXNvbHZlKHByb21pc2UsIHZhbHVlKSB7XG4gIGlmIChwcm9taXNlID09PSB2YWx1ZSkge1xuICAgIGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpO1xuICB9IGVsc2UgaWYgKCFoYW5kbGVUaGVuYWJsZShwcm9taXNlLCB2YWx1ZSkpIHtcbiAgICBmdWxmaWxsKHByb21pc2UsIHZhbHVlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBmdWxmaWxsKHByb21pc2UsIHZhbHVlKSB7XG4gIGlmIChwcm9taXNlLl9zdGF0ZSAhPT0gUEVORElORykgeyByZXR1cm47IH1cbiAgcHJvbWlzZS5fc3RhdGUgPSBTRUFMRUQ7XG4gIHByb21pc2UuX2RldGFpbCA9IHZhbHVlO1xuXG4gIGNvbmZpZy5hc3luYyhwdWJsaXNoRnVsZmlsbG1lbnQsIHByb21pc2UpO1xufVxuXG5mdW5jdGlvbiByZWplY3QocHJvbWlzZSwgcmVhc29uKSB7XG4gIGlmIChwcm9taXNlLl9zdGF0ZSAhPT0gUEVORElORykgeyByZXR1cm47IH1cbiAgcHJvbWlzZS5fc3RhdGUgPSBTRUFMRUQ7XG4gIHByb21pc2UuX2RldGFpbCA9IHJlYXNvbjtcblxuICBjb25maWcuYXN5bmMocHVibGlzaFJlamVjdGlvbiwgcHJvbWlzZSk7XG59XG5cbmZ1bmN0aW9uIHB1Ymxpc2hGdWxmaWxsbWVudChwcm9taXNlKSB7XG4gIHB1Ymxpc2gocHJvbWlzZSwgcHJvbWlzZS5fc3RhdGUgPSBGVUxGSUxMRUQpO1xufVxuXG5mdW5jdGlvbiBwdWJsaXNoUmVqZWN0aW9uKHByb21pc2UpIHtcbiAgcHVibGlzaChwcm9taXNlLCBwcm9taXNlLl9zdGF0ZSA9IFJFSkVDVEVEKTtcbn1cblxuZXhwb3J0cy5Qcm9taXNlID0gUHJvbWlzZTsiLCJcInVzZSBzdHJpY3RcIjtcbi8qIGdsb2JhbCB0b1N0cmluZyAqL1xudmFyIGlzQXJyYXkgPSByZXF1aXJlKFwiLi91dGlsc1wiKS5pc0FycmF5O1xuXG4vKipcbiAgYFJTVlAucmFjZWAgYWxsb3dzIHlvdSB0byB3YXRjaCBhIHNlcmllcyBvZiBwcm9taXNlcyBhbmQgYWN0IGFzIHNvb24gYXMgdGhlXG4gIGZpcnN0IHByb21pc2UgZ2l2ZW4gdG8gdGhlIGBwcm9taXNlc2AgYXJndW1lbnQgZnVsZmlsbHMgb3IgcmVqZWN0cy5cblxuICBFeGFtcGxlOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgdmFyIHByb21pc2UxID0gbmV3IFJTVlAuUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgIHJlc29sdmUoXCJwcm9taXNlIDFcIik7XG4gICAgfSwgMjAwKTtcbiAgfSk7XG5cbiAgdmFyIHByb21pc2UyID0gbmV3IFJTVlAuUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgIHJlc29sdmUoXCJwcm9taXNlIDJcIik7XG4gICAgfSwgMTAwKTtcbiAgfSk7XG5cbiAgUlNWUC5yYWNlKFtwcm9taXNlMSwgcHJvbWlzZTJdKS50aGVuKGZ1bmN0aW9uKHJlc3VsdCl7XG4gICAgLy8gcmVzdWx0ID09PSBcInByb21pc2UgMlwiIGJlY2F1c2UgaXQgd2FzIHJlc29sdmVkIGJlZm9yZSBwcm9taXNlMVxuICAgIC8vIHdhcyByZXNvbHZlZC5cbiAgfSk7XG4gIGBgYFxuXG4gIGBSU1ZQLnJhY2VgIGlzIGRldGVybWluaXN0aWMgaW4gdGhhdCBvbmx5IHRoZSBzdGF0ZSBvZiB0aGUgZmlyc3QgY29tcGxldGVkXG4gIHByb21pc2UgbWF0dGVycy4gRm9yIGV4YW1wbGUsIGV2ZW4gaWYgb3RoZXIgcHJvbWlzZXMgZ2l2ZW4gdG8gdGhlIGBwcm9taXNlc2BcbiAgYXJyYXkgYXJndW1lbnQgYXJlIHJlc29sdmVkLCBidXQgdGhlIGZpcnN0IGNvbXBsZXRlZCBwcm9taXNlIGhhcyBiZWNvbWVcbiAgcmVqZWN0ZWQgYmVmb3JlIHRoZSBvdGhlciBwcm9taXNlcyBiZWNhbWUgZnVsZmlsbGVkLCB0aGUgcmV0dXJuZWQgcHJvbWlzZVxuICB3aWxsIGJlY29tZSByZWplY3RlZDpcblxuICBgYGBqYXZhc2NyaXB0XG4gIHZhciBwcm9taXNlMSA9IG5ldyBSU1ZQLlByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICByZXNvbHZlKFwicHJvbWlzZSAxXCIpO1xuICAgIH0sIDIwMCk7XG4gIH0pO1xuXG4gIHZhciBwcm9taXNlMiA9IG5ldyBSU1ZQLlByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICByZWplY3QobmV3IEVycm9yKFwicHJvbWlzZSAyXCIpKTtcbiAgICB9LCAxMDApO1xuICB9KTtcblxuICBSU1ZQLnJhY2UoW3Byb21pc2UxLCBwcm9taXNlMl0pLnRoZW4oZnVuY3Rpb24ocmVzdWx0KXtcbiAgICAvLyBDb2RlIGhlcmUgbmV2ZXIgcnVucyBiZWNhdXNlIHRoZXJlIGFyZSByZWplY3RlZCBwcm9taXNlcyFcbiAgfSwgZnVuY3Rpb24ocmVhc29uKXtcbiAgICAvLyByZWFzb24ubWVzc2FnZSA9PT0gXCJwcm9taXNlMlwiIGJlY2F1c2UgcHJvbWlzZSAyIGJlY2FtZSByZWplY3RlZCBiZWZvcmVcbiAgICAvLyBwcm9taXNlIDEgYmVjYW1lIGZ1bGZpbGxlZFxuICB9KTtcbiAgYGBgXG5cbiAgQG1ldGhvZCByYWNlXG4gIEBmb3IgUlNWUFxuICBAcGFyYW0ge0FycmF5fSBwcm9taXNlcyBhcnJheSBvZiBwcm9taXNlcyB0byBvYnNlcnZlXG4gIEBwYXJhbSB7U3RyaW5nfSBsYWJlbCBvcHRpb25hbCBzdHJpbmcgZm9yIGRlc2NyaWJpbmcgdGhlIHByb21pc2UgcmV0dXJuZWQuXG4gIFVzZWZ1bCBmb3IgdG9vbGluZy5cbiAgQHJldHVybiB7UHJvbWlzZX0gYSBwcm9taXNlIHRoYXQgYmVjb21lcyBmdWxmaWxsZWQgd2l0aCB0aGUgdmFsdWUgdGhlIGZpcnN0XG4gIGNvbXBsZXRlZCBwcm9taXNlcyBpcyByZXNvbHZlZCB3aXRoIGlmIHRoZSBmaXJzdCBjb21wbGV0ZWQgcHJvbWlzZSB3YXNcbiAgZnVsZmlsbGVkLCBvciByZWplY3RlZCB3aXRoIHRoZSByZWFzb24gdGhhdCB0aGUgZmlyc3QgY29tcGxldGVkIHByb21pc2VcbiAgd2FzIHJlamVjdGVkIHdpdGguXG4qL1xuZnVuY3Rpb24gcmFjZShwcm9taXNlcykge1xuICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICB2YXIgUHJvbWlzZSA9IHRoaXM7XG5cbiAgaWYgKCFpc0FycmF5KHByb21pc2VzKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1lvdSBtdXN0IHBhc3MgYW4gYXJyYXkgdG8gcmFjZS4nKTtcbiAgfVxuICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgdmFyIHJlc3VsdHMgPSBbXSwgcHJvbWlzZTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcHJvbWlzZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHByb21pc2UgPSBwcm9taXNlc1tpXTtcblxuICAgICAgaWYgKHByb21pc2UgJiYgdHlwZW9mIHByb21pc2UudGhlbiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBwcm9taXNlLnRoZW4ocmVzb2x2ZSwgcmVqZWN0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc29sdmUocHJvbWlzZSk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcbn1cblxuZXhwb3J0cy5yYWNlID0gcmFjZTsiLCJcInVzZSBzdHJpY3RcIjtcbi8qKlxuICBgUlNWUC5yZWplY3RgIHJldHVybnMgYSBwcm9taXNlIHRoYXQgd2lsbCBiZWNvbWUgcmVqZWN0ZWQgd2l0aCB0aGUgcGFzc2VkXG4gIGByZWFzb25gLiBgUlNWUC5yZWplY3RgIGlzIGVzc2VudGlhbGx5IHNob3J0aGFuZCBmb3IgdGhlIGZvbGxvd2luZzpcblxuICBgYGBqYXZhc2NyaXB0XG4gIHZhciBwcm9taXNlID0gbmV3IFJTVlAuUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgIHJlamVjdChuZXcgRXJyb3IoJ1dIT09QUycpKTtcbiAgfSk7XG5cbiAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHZhbHVlKXtcbiAgICAvLyBDb2RlIGhlcmUgZG9lc24ndCBydW4gYmVjYXVzZSB0aGUgcHJvbWlzZSBpcyByZWplY3RlZCFcbiAgfSwgZnVuY3Rpb24ocmVhc29uKXtcbiAgICAvLyByZWFzb24ubWVzc2FnZSA9PT0gJ1dIT09QUydcbiAgfSk7XG4gIGBgYFxuXG4gIEluc3RlYWQgb2Ygd3JpdGluZyB0aGUgYWJvdmUsIHlvdXIgY29kZSBub3cgc2ltcGx5IGJlY29tZXMgdGhlIGZvbGxvd2luZzpcblxuICBgYGBqYXZhc2NyaXB0XG4gIHZhciBwcm9taXNlID0gUlNWUC5yZWplY3QobmV3IEVycm9yKCdXSE9PUFMnKSk7XG5cbiAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHZhbHVlKXtcbiAgICAvLyBDb2RlIGhlcmUgZG9lc24ndCBydW4gYmVjYXVzZSB0aGUgcHJvbWlzZSBpcyByZWplY3RlZCFcbiAgfSwgZnVuY3Rpb24ocmVhc29uKXtcbiAgICAvLyByZWFzb24ubWVzc2FnZSA9PT0gJ1dIT09QUydcbiAgfSk7XG4gIGBgYFxuXG4gIEBtZXRob2QgcmVqZWN0XG4gIEBmb3IgUlNWUFxuICBAcGFyYW0ge0FueX0gcmVhc29uIHZhbHVlIHRoYXQgdGhlIHJldHVybmVkIHByb21pc2Ugd2lsbCBiZSByZWplY3RlZCB3aXRoLlxuICBAcGFyYW0ge1N0cmluZ30gbGFiZWwgb3B0aW9uYWwgc3RyaW5nIGZvciBpZGVudGlmeWluZyB0aGUgcmV0dXJuZWQgcHJvbWlzZS5cbiAgVXNlZnVsIGZvciB0b29saW5nLlxuICBAcmV0dXJuIHtQcm9taXNlfSBhIHByb21pc2UgdGhhdCB3aWxsIGJlY29tZSByZWplY3RlZCB3aXRoIHRoZSBnaXZlblxuICBgcmVhc29uYC5cbiovXG5mdW5jdGlvbiByZWplY3QocmVhc29uKSB7XG4gIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gIHZhciBQcm9taXNlID0gdGhpcztcblxuICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgIHJlamVjdChyZWFzb24pO1xuICB9KTtcbn1cblxuZXhwb3J0cy5yZWplY3QgPSByZWplY3Q7IiwiXCJ1c2Ugc3RyaWN0XCI7XG4vKipcbiAgYFJTVlAucmVzb2x2ZWAgcmV0dXJucyBhIHByb21pc2UgdGhhdCB3aWxsIGJlY29tZSBmdWxmaWxsZWQgd2l0aCB0aGUgcGFzc2VkXG4gIGB2YWx1ZWAuIGBSU1ZQLnJlc29sdmVgIGlzIGVzc2VudGlhbGx5IHNob3J0aGFuZCBmb3IgdGhlIGZvbGxvd2luZzpcblxuICBgYGBqYXZhc2NyaXB0XG4gIHZhciBwcm9taXNlID0gbmV3IFJTVlAuUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgIHJlc29sdmUoMSk7XG4gIH0pO1xuXG4gIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSl7XG4gICAgLy8gdmFsdWUgPT09IDFcbiAgfSk7XG4gIGBgYFxuXG4gIEluc3RlYWQgb2Ygd3JpdGluZyB0aGUgYWJvdmUsIHlvdXIgY29kZSBub3cgc2ltcGx5IGJlY29tZXMgdGhlIGZvbGxvd2luZzpcblxuICBgYGBqYXZhc2NyaXB0XG4gIHZhciBwcm9taXNlID0gUlNWUC5yZXNvbHZlKDEpO1xuXG4gIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSl7XG4gICAgLy8gdmFsdWUgPT09IDFcbiAgfSk7XG4gIGBgYFxuXG4gIEBtZXRob2QgcmVzb2x2ZVxuICBAZm9yIFJTVlBcbiAgQHBhcmFtIHtBbnl9IHZhbHVlIHZhbHVlIHRoYXQgdGhlIHJldHVybmVkIHByb21pc2Ugd2lsbCBiZSByZXNvbHZlZCB3aXRoXG4gIEBwYXJhbSB7U3RyaW5nfSBsYWJlbCBvcHRpb25hbCBzdHJpbmcgZm9yIGlkZW50aWZ5aW5nIHRoZSByZXR1cm5lZCBwcm9taXNlLlxuICBVc2VmdWwgZm9yIHRvb2xpbmcuXG4gIEByZXR1cm4ge1Byb21pc2V9IGEgcHJvbWlzZSB0aGF0IHdpbGwgYmVjb21lIGZ1bGZpbGxlZCB3aXRoIHRoZSBnaXZlblxuICBgdmFsdWVgXG4qL1xuZnVuY3Rpb24gcmVzb2x2ZSh2YWx1ZSkge1xuICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICB2YXIgUHJvbWlzZSA9IHRoaXM7XG4gIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICByZXNvbHZlKHZhbHVlKTtcbiAgfSk7XG59XG5cbmV4cG9ydHMucmVzb2x2ZSA9IHJlc29sdmU7IiwiXCJ1c2Ugc3RyaWN0XCI7XG5mdW5jdGlvbiBvYmplY3RPckZ1bmN0aW9uKHgpIHtcbiAgcmV0dXJuIGlzRnVuY3Rpb24oeCkgfHwgKHR5cGVvZiB4ID09PSBcIm9iamVjdFwiICYmIHggIT09IG51bGwpO1xufVxuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKHgpIHtcbiAgcmV0dXJuIHR5cGVvZiB4ID09PSBcImZ1bmN0aW9uXCI7XG59XG5cbmZ1bmN0aW9uIGlzQXJyYXkoeCkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHgpID09PSBcIltvYmplY3QgQXJyYXldXCI7XG59XG5cbi8vIERhdGUubm93IGlzIG5vdCBhdmFpbGFibGUgaW4gYnJvd3NlcnMgPCBJRTlcbi8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL0RhdGUvbm93I0NvbXBhdGliaWxpdHlcbnZhciBub3cgPSBEYXRlLm5vdyB8fCBmdW5jdGlvbigpIHsgcmV0dXJuIG5ldyBEYXRlKCkuZ2V0VGltZSgpOyB9O1xuXG5cbmV4cG9ydHMub2JqZWN0T3JGdW5jdGlvbiA9IG9iamVjdE9yRnVuY3Rpb247XG5leHBvcnRzLmlzRnVuY3Rpb24gPSBpc0Z1bmN0aW9uO1xuZXhwb3J0cy5pc0FycmF5ID0gaXNBcnJheTtcbmV4cG9ydHMubm93ID0gbm93OyIsIi8qXG5cblx0cmFjdGl2ZS1ldmVudHMtdGFwXG5cdD09PT09PT09PT09PT09PT09PVxuXG5cdFZlcnNpb24gLlxuXG5cdE9uIG1vYmlsZSBkZXZpY2VzLCB1c2luZyBgb24tY2xpY2tgIGlzbid0IGdvb2QgZW5vdWdoLiBUYXBwaW5nIHRoZVxuXHR0b3VjaHNjcmVlbiB3aWxsIGZpcmUgYSBzaW11bGF0ZWQgY2xpY2sgZXZlbnQsIGJ1dCBvbmx5IGFmdGVyIGEgMzAwXG5cdG1pbGxpc2Vjb25kIGRlbGF5LCB3aGljaCBtYWtlcyB5b3VyIGFwcCBmZWVsIHNsdWdnaXNoLiBJdCBhbHNvXG5cdGNhdXNlcyB0aGUgdGFwcGVkIGFyZWEgdG8gaGlnaGxpZ2h0LCB3aGljaCBpbiBtb3N0IGNhc2VzIGxvb2tzIGFcblx0Yml0IG1lc3N5LlxuXG5cdEluc3RlYWQsIHVzZSBgb24tdGFwYC4gV2hlbiB5b3UgdGFwIGFuIGFyZWEsIHRoZSBzaW11bGF0ZWQgY2xpY2tcblx0ZXZlbnQgd2lsbCBiZSBwcmV2ZW50ZWQsIGFuZCB0aGUgdXNlcidzIGFjdGlvbiBpcyByZXNwb25kZWQgdG9cblx0aW5zdGFudGx5LiBUaGUgYG9uLXRhcGAgZXZlbnQgYWxzbyBkaWZmZXJzIGZyb20gYG9uLWNsaWNrYCBpbiB0aGF0XG5cdHRoZSBjbGljayBldmVudCB3aWxsIChmcmFua2x5IHJhdGhlciBiaXphcnJlbHkpIGZpcmUgZXZlbiBpZiB5b3Vcblx0aG9sZCB0aGUgbW91c2UgZG93biBvdmVyIGEgc2luZ2xlIGVsZW1lbnQgZm9yIHNldmVyYWwgc2Vjb25kcyBhbmRcblx0d2FnZ2xlIGl0IGFib3V0LlxuXG5cdFBvaW50ZXIgZXZlbnRzIGFyZSBhbHNvIHN1cHBvcnRlZCwgYXMgaXMgcHJlc3NpbmcgdGhlIHNwYWNlYmFyIHdoZW5cblx0dGhlIHJlbGV2YW50IGVsZW1lbnQgaXMgZm9jdXNlZCAod2hpY2ggdHJpZ2dlcnMgYSBjbGljayBldmVudCwgYW5kXG5cdGlzIGdvb2QgZm9yIGFjY2Vzc2liaWxpdHkpLlxuXG5cdD09PT09PT09PT09PT09PT09PT09PT09PT09XG5cblx0VHJvdWJsZXNob290aW5nOiBJZiB5b3UncmUgdXNpbmcgYSBtb2R1bGUgc3lzdGVtIGluIHlvdXIgYXBwIChBTUQgb3Jcblx0c29tZXRoaW5nIG1vcmUgbm9kZXkpIHRoZW4geW91IG1heSBuZWVkIHRvIGNoYW5nZSB0aGUgcGF0aHMgYmVsb3csXG5cdHdoZXJlIGl0IHNheXMgYHJlcXVpcmUoICdyYWN0aXZlJyApYCBvciBgZGVmaW5lKFsgJ3JhY3RpdmUnIF0uLi4pYC5cblxuXHQ9PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5cdFVzYWdlOiBJbmNsdWRlIHRoaXMgZmlsZSBvbiB5b3VyIHBhZ2UgYmVsb3cgUmFjdGl2ZSwgZS5nOlxuXG5cdCAgICA8c2NyaXB0IHNyYz0nbGliL3JhY3RpdmUuanMnPjwvc2NyaXB0PlxuXHQgICAgPHNjcmlwdCBzcmM9J2xpYi9yYWN0aXZlLWV2ZW50cy10YXAuanMnPjwvc2NyaXB0PlxuXG5cdE9yLCBpZiB5b3UncmUgdXNpbmcgYSBtb2R1bGUgbG9hZGVyLCByZXF1aXJlIHRoaXMgbW9kdWxlOlxuXG5cdCAgICAvLyByZXF1aXJpbmcgdGhlIHBsdWdpbiB3aWxsICdhY3RpdmF0ZScgaXQgLSBubyBuZWVkIHRvIHVzZVxuXHQgICAgLy8gdGhlIHJldHVybiB2YWx1ZVxuXHQgICAgcmVxdWlyZSggJ3JhY3RpdmUtZXZlbnRzLXRhcCcgKTtcblxuXHRBZGQgYSB0YXAgZXZlbnQgaW4gdGhlIG5vcm1hbCBmYXNoaW9uOlxuXG5cdCAgICA8ZGl2IG9uLXRhcD0nZm9vJz50YXAgbWUhPC9kaXY+XG5cblx0VGhlbiBhZGQgYSBoYW5kbGVyOlxuXG5cdCAgICByYWN0aXZlLm9uKCAnZm9vJywgZnVuY3Rpb24gKCBldmVudCApIHtcblx0ICAgICAgYWxlcnQoICd0YXBwZWQnICk7XG5cdCAgICB9KTtcblxuKi9cblxuKGZ1bmN0aW9uICggZ2xvYmFsLCBmYWN0b3J5ICkge1xuXG5cdCd1c2Ugc3RyaWN0JztcblxuXHQvLyBDb21tb24gSlMgKGkuZS4gYnJvd3NlcmlmeSkgZW52aXJvbm1lbnRcblx0aWYgKCB0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cyAmJiB0eXBlb2YgcmVxdWlyZSA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRmYWN0b3J5KCByZXF1aXJlKCAncmFjdGl2ZScgKSApO1xuXHR9XG5cblx0Ly8gQU1EP1xuXHRlbHNlIGlmICggdHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kICkge1xuXHRcdGRlZmluZShbICdyYWN0aXZlJyBdLCBmYWN0b3J5ICk7XG5cdH1cblxuXHQvLyBicm93c2VyIGdsb2JhbFxuXHRlbHNlIGlmICggZ2xvYmFsLlJhY3RpdmUgKSB7XG5cdFx0ZmFjdG9yeSggZ2xvYmFsLlJhY3RpdmUgKTtcblx0fVxuXG5cdGVsc2Uge1xuXHRcdHRocm93IG5ldyBFcnJvciggJ0NvdWxkIG5vdCBmaW5kIFJhY3RpdmUhIEl0IG11c3QgYmUgbG9hZGVkIGJlZm9yZSB0aGUgcmFjdGl2ZS1ldmVudHMtdGFwIHBsdWdpbicgKTtcblx0fVxuXG59KCB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyA/IHdpbmRvdyA6IHRoaXMsIGZ1bmN0aW9uICggUmFjdGl2ZSApIHtcblxuXHQndXNlIHN0cmljdCc7XG5cblx0dmFyIHRhcCA9IGZ1bmN0aW9uICggbm9kZSwgZmlyZSApIHtcblx0XHR2YXIgbW91c2Vkb3duLCB0b3VjaHN0YXJ0LCBmb2N1c0hhbmRsZXIsIGRpc3RhbmNlVGhyZXNob2xkLCB0aW1lVGhyZXNob2xkO1xuXG5cdFx0ZGlzdGFuY2VUaHJlc2hvbGQgPSA1OyAvLyBtYXhpbXVtIHBpeGVscyBwb2ludGVyIGNhbiBtb3ZlIGJlZm9yZSBjYW5jZWxcblx0XHR0aW1lVGhyZXNob2xkID0gNDAwOyAgIC8vIG1heGltdW0gbWlsbGlzZWNvbmRzIGJldHdlZW4gZG93biBhbmQgdXAgYmVmb3JlIGNhbmNlbFxuXG5cdFx0bW91c2Vkb3duID0gZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRcdHZhciBjdXJyZW50VGFyZ2V0LCB4LCB5LCBwb2ludGVySWQsIHVwLCBtb3ZlLCBjYW5jZWw7XG5cblx0XHRcdGlmICggZXZlbnQud2hpY2ggIT09IHVuZGVmaW5lZCAmJiBldmVudC53aGljaCAhPT0gMSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR4ID0gZXZlbnQuY2xpZW50WDtcblx0XHRcdHkgPSBldmVudC5jbGllbnRZO1xuXHRcdFx0Y3VycmVudFRhcmdldCA9IHRoaXM7XG5cdFx0XHQvLyBUaGlzIHdpbGwgYmUgbnVsbCBmb3IgbW91c2UgZXZlbnRzLlxuXHRcdFx0cG9pbnRlcklkID0gZXZlbnQucG9pbnRlcklkO1xuXG5cdFx0XHR1cCA9IGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHRcdGlmICggZXZlbnQucG9pbnRlcklkICE9IHBvaW50ZXJJZCApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRmaXJlKHtcblx0XHRcdFx0XHRub2RlOiBjdXJyZW50VGFyZ2V0LFxuXHRcdFx0XHRcdG9yaWdpbmFsOiBldmVudFxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRjYW5jZWwoKTtcblx0XHRcdH07XG5cblx0XHRcdG1vdmUgPSBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0XHRpZiAoIGV2ZW50LnBvaW50ZXJJZCAhPSBwb2ludGVySWQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKCAoIE1hdGguYWJzKCBldmVudC5jbGllbnRYIC0geCApID49IGRpc3RhbmNlVGhyZXNob2xkICkgfHwgKCBNYXRoLmFicyggZXZlbnQuY2xpZW50WSAtIHkgKSA+PSBkaXN0YW5jZVRocmVzaG9sZCApICkge1xuXHRcdFx0XHRcdGNhbmNlbCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXG5cdFx0XHRjYW5jZWwgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ01TUG9pbnRlclVwJywgdXAsIGZhbHNlICk7XG5cdFx0XHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdNU1BvaW50ZXJNb3ZlJywgbW92ZSwgZmFsc2UgKTtcblx0XHRcdFx0ZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ01TUG9pbnRlckNhbmNlbCcsIGNhbmNlbCwgZmFsc2UgKTtcblx0XHRcdFx0bm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKCAncG9pbnRlcnVwJywgdXAsIGZhbHNlICk7XG5cdFx0XHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdwb2ludGVybW92ZScsIG1vdmUsIGZhbHNlICk7XG5cdFx0XHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdwb2ludGVyY2FuY2VsJywgY2FuY2VsLCBmYWxzZSApO1xuXHRcdFx0XHRub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdjbGljaycsIHVwLCBmYWxzZSApO1xuXHRcdFx0XHRkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCAnbW91c2Vtb3ZlJywgbW92ZSwgZmFsc2UgKTtcblx0XHRcdH07XG5cblx0XHRcdGlmICggd2luZG93Lm5hdmlnYXRvci5wb2ludGVyRW5hYmxlZCApIHtcblx0XHRcdFx0bm9kZS5hZGRFdmVudExpc3RlbmVyKCAncG9pbnRlcnVwJywgdXAsIGZhbHNlICk7XG5cdFx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdwb2ludGVybW92ZScsIG1vdmUsIGZhbHNlICk7XG5cdFx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdwb2ludGVyY2FuY2VsJywgY2FuY2VsLCBmYWxzZSApO1xuXHRcdFx0fSBlbHNlIGlmICggd2luZG93Lm5hdmlnYXRvci5tc1BvaW50ZXJFbmFibGVkICkge1xuXHRcdFx0XHRub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdNU1BvaW50ZXJVcCcsIHVwLCBmYWxzZSApO1xuXHRcdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnTVNQb2ludGVyTW92ZScsIG1vdmUsIGZhbHNlICk7XG5cdFx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdNU1BvaW50ZXJDYW5jZWwnLCBjYW5jZWwsIGZhbHNlICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIHVwLCBmYWxzZSApO1xuXHRcdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnbW91c2Vtb3ZlJywgbW92ZSwgZmFsc2UgKTtcblx0XHRcdH1cblxuXHRcdFx0c2V0VGltZW91dCggY2FuY2VsLCB0aW1lVGhyZXNob2xkICk7XG5cdFx0fTtcblxuXHRcdGlmICggd2luZG93Lm5hdmlnYXRvci5wb2ludGVyRW5hYmxlZCApIHtcblx0XHRcdG5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ3BvaW50ZXJkb3duJywgbW91c2Vkb3duLCBmYWxzZSApO1xuXHRcdH0gZWxzZSBpZiAoIHdpbmRvdy5uYXZpZ2F0b3IubXNQb2ludGVyRW5hYmxlZCApIHtcblx0XHRcdG5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ01TUG9pbnRlckRvd24nLCBtb3VzZWRvd24sIGZhbHNlICk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ21vdXNlZG93bicsIG1vdXNlZG93biwgZmFsc2UgKTtcblx0XHR9XG5cblxuXHRcdHRvdWNoc3RhcnQgPSBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0dmFyIGN1cnJlbnRUYXJnZXQsIHgsIHksIHRvdWNoLCBmaW5nZXIsIG1vdmUsIHVwLCBjYW5jZWw7XG5cblx0XHRcdGlmICggZXZlbnQudG91Y2hlcy5sZW5ndGggIT09IDEgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dG91Y2ggPSBldmVudC50b3VjaGVzWzBdO1xuXG5cdFx0XHR4ID0gdG91Y2guY2xpZW50WDtcblx0XHRcdHkgPSB0b3VjaC5jbGllbnRZO1xuXHRcdFx0Y3VycmVudFRhcmdldCA9IHRoaXM7XG5cblx0XHRcdGZpbmdlciA9IHRvdWNoLmlkZW50aWZpZXI7XG5cblx0XHRcdHVwID0gZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRcdFx0dmFyIHRvdWNoO1xuXG5cdFx0XHRcdHRvdWNoID0gZXZlbnQuY2hhbmdlZFRvdWNoZXNbMF07XG5cdFx0XHRcdGlmICggdG91Y2guaWRlbnRpZmllciAhPT0gZmluZ2VyICkge1xuXHRcdFx0XHRcdGNhbmNlbCgpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTsgIC8vIHByZXZlbnQgY29tcGF0aWJpbGl0eSBtb3VzZSBldmVudFxuXHRcdFx0XHRmaXJlKHtcblx0XHRcdFx0XHRub2RlOiBjdXJyZW50VGFyZ2V0LFxuXHRcdFx0XHRcdG9yaWdpbmFsOiBldmVudFxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRjYW5jZWwoKTtcblx0XHRcdH07XG5cblx0XHRcdG1vdmUgPSBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0XHR2YXIgdG91Y2g7XG5cblx0XHRcdFx0aWYgKCBldmVudC50b3VjaGVzLmxlbmd0aCAhPT0gMSB8fCBldmVudC50b3VjaGVzWzBdLmlkZW50aWZpZXIgIT09IGZpbmdlciApIHtcblx0XHRcdFx0XHRjYW5jZWwoKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRvdWNoID0gZXZlbnQudG91Y2hlc1swXTtcblx0XHRcdFx0aWYgKCAoIE1hdGguYWJzKCB0b3VjaC5jbGllbnRYIC0geCApID49IGRpc3RhbmNlVGhyZXNob2xkICkgfHwgKCBNYXRoLmFicyggdG91Y2guY2xpZW50WSAtIHkgKSA+PSBkaXN0YW5jZVRocmVzaG9sZCApICkge1xuXHRcdFx0XHRcdGNhbmNlbCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXG5cdFx0XHRjYW5jZWwgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3RvdWNoZW5kJywgdXAsIGZhbHNlICk7XG5cdFx0XHRcdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCAndG91Y2htb3ZlJywgbW92ZSwgZmFsc2UgKTtcblx0XHRcdFx0d2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoICd0b3VjaGNhbmNlbCcsIGNhbmNlbCwgZmFsc2UgKTtcblx0XHRcdH07XG5cblx0XHRcdG5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ3RvdWNoZW5kJywgdXAsIGZhbHNlICk7XG5cdFx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ3RvdWNobW92ZScsIG1vdmUsIGZhbHNlICk7XG5cdFx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ3RvdWNoY2FuY2VsJywgY2FuY2VsLCBmYWxzZSApO1xuXG5cdFx0XHRzZXRUaW1lb3V0KCBjYW5jZWwsIHRpbWVUaHJlc2hvbGQgKTtcblx0XHR9O1xuXG5cdFx0bm9kZS5hZGRFdmVudExpc3RlbmVyKCAndG91Y2hzdGFydCcsIHRvdWNoc3RhcnQsIGZhbHNlICk7XG5cblxuXHRcdC8vIG5hdGl2ZSBidXR0b25zLCBhbmQgPGlucHV0IHR5cGU9J2J1dHRvbic+IGVsZW1lbnRzLCBzaG91bGQgZmlyZSBhIHRhcCBldmVudFxuXHRcdC8vIHdoZW4gdGhlIHNwYWNlIGtleSBpcyBwcmVzc2VkXG5cdFx0aWYgKCBub2RlLnRhZ05hbWUgPT09ICdCVVRUT04nIHx8IG5vZGUudHlwZSA9PT0gJ2J1dHRvbicgKSB7XG5cdFx0XHRmb2N1c0hhbmRsZXIgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHZhciBibHVySGFuZGxlciwga2V5ZG93bkhhbmRsZXI7XG5cblx0XHRcdFx0a2V5ZG93bkhhbmRsZXIgPSBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0XHRcdGlmICggZXZlbnQud2hpY2ggPT09IDMyICkgeyAvLyBzcGFjZSBrZXlcblx0XHRcdFx0XHRcdGZpcmUoe1xuXHRcdFx0XHRcdFx0XHRub2RlOiBub2RlLFxuXHRcdFx0XHRcdFx0XHRvcmlnaW5hbDogZXZlbnRcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fTtcblxuXHRcdFx0XHRibHVySGFuZGxlciA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdrZXlkb3duJywga2V5ZG93bkhhbmRsZXIsIGZhbHNlICk7XG5cdFx0XHRcdFx0bm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKCAnYmx1cicsIGJsdXJIYW5kbGVyLCBmYWxzZSApO1xuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdG5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ2tleWRvd24nLCBrZXlkb3duSGFuZGxlciwgZmFsc2UgKTtcblx0XHRcdFx0bm9kZS5hZGRFdmVudExpc3RlbmVyKCAnYmx1cicsIGJsdXJIYW5kbGVyLCBmYWxzZSApO1xuXHRcdFx0fTtcblxuXHRcdFx0bm9kZS5hZGRFdmVudExpc3RlbmVyKCAnZm9jdXMnLCBmb2N1c0hhbmRsZXIsIGZhbHNlICk7XG5cdFx0fVxuXG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0bm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKCAncG9pbnRlcmRvd24nLCBtb3VzZWRvd24sIGZhbHNlICk7XG5cdFx0XHRcdG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ01TUG9pbnRlckRvd24nLCBtb3VzZWRvd24sIGZhbHNlICk7XG5cdFx0XHRcdG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ21vdXNlZG93bicsIG1vdXNlZG93biwgZmFsc2UgKTtcblx0XHRcdFx0bm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKCAndG91Y2hzdGFydCcsIHRvdWNoc3RhcnQsIGZhbHNlICk7XG5cdFx0XHRcdG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2ZvY3VzJywgZm9jdXNIYW5kbGVyLCBmYWxzZSApO1xuXHRcdFx0fVxuXHRcdH07XG5cdH07XG5cblx0UmFjdGl2ZS5ldmVudHMudGFwID0gdGFwO1xuXG59KSk7XG4iLCIvKlxuXG5cdFJhY3RpdmUgLSB2MC4zLjktMzE3LWQyM2U0MDggLSAyMDE0LTAzLTIxXG5cdD09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cblx0TmV4dC1nZW5lcmF0aW9uIERPTSBtYW5pcHVsYXRpb24gLSBodHRwOi8vcmFjdGl2ZWpzLm9yZ1xuXHRGb2xsb3cgQFJhY3RpdmVKUyBmb3IgdXBkYXRlc1xuXG5cdC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cblx0Q29weXJpZ2h0IDIwMTQgUmljaCBIYXJyaXMgYW5kIGNvbnRyaWJ1dG9yc1xuXG5cdFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uXG5cdG9idGFpbmluZyBhIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uXG5cdGZpbGVzICh0aGUgXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dFxuXHRyZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSxcblx0Y29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCwgZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGxcblx0Y29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdCBwZXJzb25zIHRvIHdob20gdGhlXG5cdFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nXG5cdGNvbmRpdGlvbnM6XG5cblx0VGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmVcblx0aW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG5cblx0VEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCxcblx0RVhQUkVTUyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTXG5cdE9GIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EXG5cdE5PTklORlJJTkdFTUVOVC4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUXG5cdEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLFxuXHRXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkdcblx0RlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFVTRSBPUlxuXHRPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbiovXG5cbiggZnVuY3Rpb24oIGdsb2JhbCApIHtcblxuXG5cblx0dmFyIG5vQ29uZmxpY3QgPSBnbG9iYWwuUmFjdGl2ZTtcblxuXHR2YXIgbGVnYWN5ID0gdW5kZWZpbmVkO1xuXG5cdHZhciBjb25maWdfaW5pdE9wdGlvbnMgPSBmdW5jdGlvbiggbGVnYWN5ICkge1xuXG5cdFx0dmFyIGRlZmF1bHRzLCBpbml0T3B0aW9ucztcblx0XHRkZWZhdWx0cyA9IHtcblx0XHRcdGVsOiBudWxsLFxuXHRcdFx0dGVtcGxhdGU6ICcnLFxuXHRcdFx0Y29tcGxldGU6IG51bGwsXG5cdFx0XHRwcmVzZXJ2ZVdoaXRlc3BhY2U6IGZhbHNlLFxuXHRcdFx0YXBwZW5kOiBmYWxzZSxcblx0XHRcdHR3b3dheTogdHJ1ZSxcblx0XHRcdG1vZGlmeUFycmF5czogdHJ1ZSxcblx0XHRcdGxhenk6IGZhbHNlLFxuXHRcdFx0ZGVidWc6IGZhbHNlLFxuXHRcdFx0bm9JbnRybzogZmFsc2UsXG5cdFx0XHR0cmFuc2l0aW9uc0VuYWJsZWQ6IHRydWUsXG5cdFx0XHRtYWdpYzogZmFsc2UsXG5cdFx0XHRub0Nzc1RyYW5zZm9ybTogZmFsc2UsXG5cdFx0XHRhZGFwdDogW10sXG5cdFx0XHRzYW5pdGl6ZTogZmFsc2UsXG5cdFx0XHRzdHJpcENvbW1lbnRzOiB0cnVlLFxuXHRcdFx0aXNvbGF0ZWQ6IGZhbHNlLFxuXHRcdFx0ZGVsaW1pdGVyczogW1xuXHRcdFx0XHQne3snLFxuXHRcdFx0XHQnfX0nXG5cdFx0XHRdLFxuXHRcdFx0dHJpcGxlRGVsaW1pdGVyczogW1xuXHRcdFx0XHQne3t7Jyxcblx0XHRcdFx0J319fSdcblx0XHRcdF1cblx0XHR9O1xuXHRcdGluaXRPcHRpb25zID0ge1xuXHRcdFx0a2V5czogT2JqZWN0LmtleXMoIGRlZmF1bHRzICksXG5cdFx0XHRkZWZhdWx0czogZGVmYXVsdHNcblx0XHR9O1xuXHRcdHJldHVybiBpbml0T3B0aW9ucztcblx0fSggbGVnYWN5ICk7XG5cblx0dmFyIGNvbmZpZ19zdmcgPSBmdW5jdGlvbigpIHtcblxuXHRcdGlmICggdHlwZW9mIGRvY3VtZW50ID09PSAndW5kZWZpbmVkJyApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0cmV0dXJuIGRvY3VtZW50ICYmIGRvY3VtZW50LmltcGxlbWVudGF0aW9uLmhhc0ZlYXR1cmUoICdodHRwOi8vd3d3LnczLm9yZy9UUi9TVkcxMS9mZWF0dXJlI0Jhc2ljU3RydWN0dXJlJywgJzEuMScgKTtcblx0fSgpO1xuXG5cdHZhciBjb25maWdfbmFtZXNwYWNlcyA9IHtcblx0XHRodG1sOiAnaHR0cDovL3d3dy53My5vcmcvMTk5OS94aHRtbCcsXG5cdFx0bWF0aG1sOiAnaHR0cDovL3d3dy53My5vcmcvMTk5OC9NYXRoL01hdGhNTCcsXG5cdFx0c3ZnOiAnaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnLFxuXHRcdHhsaW5rOiAnaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluaycsXG5cdFx0eG1sOiAnaHR0cDovL3d3dy53My5vcmcvWE1MLzE5OTgvbmFtZXNwYWNlJyxcblx0XHR4bWxuczogJ2h0dHA6Ly93d3cudzMub3JnLzIwMDAveG1sbnMvJ1xuXHR9O1xuXG5cdHZhciB1dGlsc19jcmVhdGVFbGVtZW50ID0gZnVuY3Rpb24oIHN2ZywgbmFtZXNwYWNlcyApIHtcblxuXHRcdGlmICggIXN2ZyApIHtcblx0XHRcdHJldHVybiBmdW5jdGlvbiggdHlwZSwgbnMgKSB7XG5cdFx0XHRcdGlmICggbnMgJiYgbnMgIT09IG5hbWVzcGFjZXMuaHRtbCApIHtcblx0XHRcdFx0XHR0aHJvdyAnVGhpcyBicm93c2VyIGRvZXMgbm90IHN1cHBvcnQgbmFtZXNwYWNlcyBvdGhlciB0aGFuIGh0dHA6Ly93d3cudzMub3JnLzE5OTkveGh0bWwuIFRoZSBtb3N0IGxpa2VseSBjYXVzZSBvZiB0aGlzIGVycm9yIGlzIHRoYXQgeW91XFwncmUgdHJ5aW5nIHRvIHJlbmRlciBTVkcgaW4gYW4gb2xkZXIgYnJvd3Nlci4gU2VlIGh0dHA6Ly9kb2NzLnJhY3RpdmVqcy5vcmcvbGF0ZXN0L3N2Zy1hbmQtb2xkZXItYnJvd3NlcnMgZm9yIG1vcmUgaW5mb3JtYXRpb24nO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCB0eXBlICk7XG5cdFx0XHR9O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gZnVuY3Rpb24oIHR5cGUsIG5zICkge1xuXHRcdFx0XHRpZiAoICFucyApIHtcblx0XHRcdFx0XHRyZXR1cm4gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggdHlwZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoIG5zLCB0eXBlICk7XG5cdFx0XHR9O1xuXHRcdH1cblx0fSggY29uZmlnX3N2ZywgY29uZmlnX25hbWVzcGFjZXMgKTtcblxuXHR2YXIgY29uZmlnX2lzQ2xpZW50ID0gdHlwZW9mIGRvY3VtZW50ID09PSAnb2JqZWN0JztcblxuXHR2YXIgdXRpbHNfZGVmaW5lUHJvcGVydHkgPSBmdW5jdGlvbiggaXNDbGllbnQgKSB7XG5cblx0XHR0cnkge1xuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KCB7fSwgJ3Rlc3QnLCB7XG5cdFx0XHRcdHZhbHVlOiAwXG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoIGlzQ2xpZW50ICkge1xuXHRcdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICksICd0ZXN0Jywge1xuXHRcdFx0XHRcdHZhbHVlOiAwXG5cdFx0XHRcdH0gKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBPYmplY3QuZGVmaW5lUHJvcGVydHk7XG5cdFx0fSBjYXRjaCAoIGVyciApIHtcblx0XHRcdHJldHVybiBmdW5jdGlvbiggb2JqLCBwcm9wLCBkZXNjICkge1xuXHRcdFx0XHRvYmpbIHByb3AgXSA9IGRlc2MudmFsdWU7XG5cdFx0XHR9O1xuXHRcdH1cblx0fSggY29uZmlnX2lzQ2xpZW50ICk7XG5cblx0dmFyIHV0aWxzX2RlZmluZVByb3BlcnRpZXMgPSBmdW5jdGlvbiggY3JlYXRlRWxlbWVudCwgZGVmaW5lUHJvcGVydHksIGlzQ2xpZW50ICkge1xuXG5cdFx0dHJ5IHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKCB7fSwge1xuXHRcdFx0XHRcdHRlc3Q6IHtcblx0XHRcdFx0XHRcdHZhbHVlOiAwXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9IGNhdGNoICggZXJyICkge1xuXHRcdFx0XHR0aHJvdyBlcnI7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGlzQ2xpZW50ICkge1xuXHRcdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydGllcyggY3JlYXRlRWxlbWVudCggJ2RpdicgKSwge1xuXHRcdFx0XHRcdHRlc3Q6IHtcblx0XHRcdFx0XHRcdHZhbHVlOiAwXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gT2JqZWN0LmRlZmluZVByb3BlcnRpZXM7XG5cdFx0fSBjYXRjaCAoIGVyciApIHtcblx0XHRcdHJldHVybiBmdW5jdGlvbiggb2JqLCBwcm9wcyApIHtcblx0XHRcdFx0dmFyIHByb3A7XG5cdFx0XHRcdGZvciAoIHByb3AgaW4gcHJvcHMgKSB7XG5cdFx0XHRcdFx0aWYgKCBwcm9wcy5oYXNPd25Qcm9wZXJ0eSggcHJvcCApICkge1xuXHRcdFx0XHRcdFx0ZGVmaW5lUHJvcGVydHkoIG9iaiwgcHJvcCwgcHJvcHNbIHByb3AgXSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHR9XG5cdH0oIHV0aWxzX2NyZWF0ZUVsZW1lbnQsIHV0aWxzX2RlZmluZVByb3BlcnR5LCBjb25maWdfaXNDbGllbnQgKTtcblxuXHR2YXIgdXRpbHNfaXNOdW1lcmljID0gZnVuY3Rpb24oIHRoaW5nICkge1xuXHRcdHJldHVybiAhaXNOYU4oIHBhcnNlRmxvYXQoIHRoaW5nICkgKSAmJiBpc0Zpbml0ZSggdGhpbmcgKTtcblx0fTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfc2hhcmVkX2FkZCA9IGZ1bmN0aW9uKCBpc051bWVyaWMgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHJvb3QsIGtleXBhdGgsIGQgKSB7XG5cdFx0XHR2YXIgdmFsdWU7XG5cdFx0XHRpZiAoIHR5cGVvZiBrZXlwYXRoICE9PSAnc3RyaW5nJyB8fCAhaXNOdW1lcmljKCBkICkgKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ0JhZCBhcmd1bWVudHMnICk7XG5cdFx0XHR9XG5cdFx0XHR2YWx1ZSA9ICtyb290LmdldCgga2V5cGF0aCApIHx8IDA7XG5cdFx0XHRpZiAoICFpc051bWVyaWMoIHZhbHVlICkgKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ0Nhbm5vdCBhZGQgdG8gYSBub24tbnVtZXJpYyB2YWx1ZScgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiByb290LnNldCgga2V5cGF0aCwgdmFsdWUgKyBkICk7XG5cdFx0fTtcblx0fSggdXRpbHNfaXNOdW1lcmljICk7XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX2FkZCA9IGZ1bmN0aW9uKCBhZGQgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIGtleXBhdGgsIGQgKSB7XG5cdFx0XHRyZXR1cm4gYWRkKCB0aGlzLCBrZXlwYXRoLCBkID09PSB1bmRlZmluZWQgPyAxIDogK2QgKTtcblx0XHR9O1xuXHR9KCBSYWN0aXZlX3Byb3RvdHlwZV9zaGFyZWRfYWRkICk7XG5cblx0dmFyIHV0aWxzX2lzRXF1YWwgPSBmdW5jdGlvbiggYSwgYiApIHtcblx0XHRpZiAoIGEgPT09IG51bGwgJiYgYiA9PT0gbnVsbCApIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRpZiAoIHR5cGVvZiBhID09PSAnb2JqZWN0JyB8fCB0eXBlb2YgYiA9PT0gJ29iamVjdCcgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiBhID09PSBiO1xuXHR9O1xuXG5cdHZhciB1dGlsc19Qcm9taXNlID0gZnVuY3Rpb24oKSB7XG5cblx0XHR2YXIgUHJvbWlzZSwgUEVORElORyA9IHt9LCBGVUxGSUxMRUQgPSB7fSwgUkVKRUNURUQgPSB7fTtcblx0XHRQcm9taXNlID0gZnVuY3Rpb24oIGNhbGxiYWNrICkge1xuXHRcdFx0dmFyIGZ1bGZpbGxlZEhhbmRsZXJzID0gW10sXG5cdFx0XHRcdHJlamVjdGVkSGFuZGxlcnMgPSBbXSxcblx0XHRcdFx0c3RhdGUgPSBQRU5ESU5HLFxuXHRcdFx0XHRyZXN1bHQsIGRpc3BhdGNoSGFuZGxlcnMsIG1ha2VSZXNvbHZlciwgZnVsZmlsLCByZWplY3QsIHByb21pc2U7XG5cdFx0XHRtYWtlUmVzb2x2ZXIgPSBmdW5jdGlvbiggbmV3U3RhdGUgKSB7XG5cdFx0XHRcdHJldHVybiBmdW5jdGlvbiggdmFsdWUgKSB7XG5cdFx0XHRcdFx0aWYgKCBzdGF0ZSAhPT0gUEVORElORyApIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmVzdWx0ID0gdmFsdWU7XG5cdFx0XHRcdFx0c3RhdGUgPSBuZXdTdGF0ZTtcblx0XHRcdFx0XHRkaXNwYXRjaEhhbmRsZXJzID0gbWFrZURpc3BhdGNoZXIoIHN0YXRlID09PSBGVUxGSUxMRUQgPyBmdWxmaWxsZWRIYW5kbGVycyA6IHJlamVjdGVkSGFuZGxlcnMsIHJlc3VsdCApO1xuXHRcdFx0XHRcdHdhaXQoIGRpc3BhdGNoSGFuZGxlcnMgKTtcblx0XHRcdFx0fTtcblx0XHRcdH07XG5cdFx0XHRmdWxmaWwgPSBtYWtlUmVzb2x2ZXIoIEZVTEZJTExFRCApO1xuXHRcdFx0cmVqZWN0ID0gbWFrZVJlc29sdmVyKCBSRUpFQ1RFRCApO1xuXHRcdFx0Y2FsbGJhY2soIGZ1bGZpbCwgcmVqZWN0ICk7XG5cdFx0XHRwcm9taXNlID0ge1xuXHRcdFx0XHR0aGVuOiBmdW5jdGlvbiggb25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQgKSB7XG5cdFx0XHRcdFx0dmFyIHByb21pc2UyID0gbmV3IFByb21pc2UoIGZ1bmN0aW9uKCBmdWxmaWwsIHJlamVjdCApIHtcblx0XHRcdFx0XHRcdHZhciBwcm9jZXNzUmVzb2x1dGlvbkhhbmRsZXIgPSBmdW5jdGlvbiggaGFuZGxlciwgaGFuZGxlcnMsIGZvcndhcmQgKSB7XG5cdFx0XHRcdFx0XHRcdGlmICggdHlwZW9mIGhhbmRsZXIgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRcdFx0XHRcdFx0aGFuZGxlcnMucHVzaCggZnVuY3Rpb24oIHAxcmVzdWx0ICkge1xuXHRcdFx0XHRcdFx0XHRcdFx0dmFyIHg7XG5cdFx0XHRcdFx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR4ID0gaGFuZGxlciggcDFyZXN1bHQgKTtcblx0XHRcdFx0XHRcdFx0XHRcdFx0cmVzb2x2ZSggcHJvbWlzZTIsIHgsIGZ1bGZpbCwgcmVqZWN0ICk7XG5cdFx0XHRcdFx0XHRcdFx0XHR9IGNhdGNoICggZXJyICkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRyZWplY3QoIGVyciApO1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRoYW5kbGVycy5wdXNoKCBmb3J3YXJkICk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHRwcm9jZXNzUmVzb2x1dGlvbkhhbmRsZXIoIG9uRnVsZmlsbGVkLCBmdWxmaWxsZWRIYW5kbGVycywgZnVsZmlsICk7XG5cdFx0XHRcdFx0XHRwcm9jZXNzUmVzb2x1dGlvbkhhbmRsZXIoIG9uUmVqZWN0ZWQsIHJlamVjdGVkSGFuZGxlcnMsIHJlamVjdCApO1xuXHRcdFx0XHRcdFx0aWYgKCBzdGF0ZSAhPT0gUEVORElORyApIHtcblx0XHRcdFx0XHRcdFx0d2FpdCggZGlzcGF0Y2hIYW5kbGVycyApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHRyZXR1cm4gcHJvbWlzZTI7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHRwcm9taXNlWyAnY2F0Y2gnIF0gPSBmdW5jdGlvbiggb25SZWplY3RlZCApIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMudGhlbiggbnVsbCwgb25SZWplY3RlZCApO1xuXHRcdFx0fTtcblx0XHRcdHJldHVybiBwcm9taXNlO1xuXHRcdH07XG5cdFx0UHJvbWlzZS5hbGwgPSBmdW5jdGlvbiggcHJvbWlzZXMgKSB7XG5cdFx0XHRyZXR1cm4gbmV3IFByb21pc2UoIGZ1bmN0aW9uKCBmdWxmaWwsIHJlamVjdCApIHtcblx0XHRcdFx0dmFyIHJlc3VsdCA9IFtdLFxuXHRcdFx0XHRcdHBlbmRpbmcsIGksIHByb2Nlc3NQcm9taXNlO1xuXHRcdFx0XHRpZiAoICFwcm9taXNlcy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0ZnVsZmlsKCByZXN1bHQgKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0cHJvY2Vzc1Byb21pc2UgPSBmdW5jdGlvbiggaSApIHtcblx0XHRcdFx0XHRwcm9taXNlc1sgaSBdLnRoZW4oIGZ1bmN0aW9uKCB2YWx1ZSApIHtcblx0XHRcdFx0XHRcdHJlc3VsdFsgaSBdID0gdmFsdWU7XG5cdFx0XHRcdFx0XHRpZiAoICEtLXBlbmRpbmcgKSB7XG5cdFx0XHRcdFx0XHRcdGZ1bGZpbCggcmVzdWx0ICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSwgcmVqZWN0ICk7XG5cdFx0XHRcdH07XG5cdFx0XHRcdHBlbmRpbmcgPSBpID0gcHJvbWlzZXMubGVuZ3RoO1xuXHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRwcm9jZXNzUHJvbWlzZSggaSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0fTtcblx0XHRQcm9taXNlLnJlc29sdmUgPSBmdW5jdGlvbiggdmFsdWUgKSB7XG5cdFx0XHRyZXR1cm4gbmV3IFByb21pc2UoIGZ1bmN0aW9uKCBmdWxmaWwgKSB7XG5cdFx0XHRcdGZ1bGZpbCggdmFsdWUgKTtcblx0XHRcdH0gKTtcblx0XHR9O1xuXHRcdFByb21pc2UucmVqZWN0ID0gZnVuY3Rpb24oIHJlYXNvbiApIHtcblx0XHRcdHJldHVybiBuZXcgUHJvbWlzZSggZnVuY3Rpb24oIGZ1bGZpbCwgcmVqZWN0ICkge1xuXHRcdFx0XHRyZWplY3QoIHJlYXNvbiApO1xuXHRcdFx0fSApO1xuXHRcdH07XG5cdFx0cmV0dXJuIFByb21pc2U7XG5cblx0XHRmdW5jdGlvbiB3YWl0KCBjYWxsYmFjayApIHtcblx0XHRcdHNldFRpbWVvdXQoIGNhbGxiYWNrLCAwICk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gbWFrZURpc3BhdGNoZXIoIGhhbmRsZXJzLCByZXN1bHQgKSB7XG5cdFx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBoYW5kbGVyO1xuXHRcdFx0XHR3aGlsZSAoIGhhbmRsZXIgPSBoYW5kbGVycy5zaGlmdCgpICkge1xuXHRcdFx0XHRcdGhhbmRsZXIoIHJlc3VsdCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHJlc29sdmUoIHByb21pc2UsIHgsIGZ1bGZpbCwgcmVqZWN0ICkge1xuXHRcdFx0dmFyIHRoZW47XG5cdFx0XHRpZiAoIHggPT09IHByb21pc2UgKSB7XG5cdFx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IoICdBIHByb21pc2VcXCdzIGZ1bGZpbGxtZW50IGhhbmRsZXIgY2Fubm90IHJldHVybiB0aGUgc2FtZSBwcm9taXNlJyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB4IGluc3RhbmNlb2YgUHJvbWlzZSApIHtcblx0XHRcdFx0eC50aGVuKCBmdWxmaWwsIHJlamVjdCApO1xuXHRcdFx0fSBlbHNlIGlmICggeCAmJiAoIHR5cGVvZiB4ID09PSAnb2JqZWN0JyB8fCB0eXBlb2YgeCA9PT0gJ2Z1bmN0aW9uJyApICkge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdHRoZW4gPSB4LnRoZW47XG5cdFx0XHRcdH0gY2F0Y2ggKCBlICkge1xuXHRcdFx0XHRcdHJlamVjdCggZSApO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHR5cGVvZiB0aGVuID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0XHRcdHZhciBjYWxsZWQsIHJlc29sdmVQcm9taXNlLCByZWplY3RQcm9taXNlO1xuXHRcdFx0XHRcdHJlc29sdmVQcm9taXNlID0gZnVuY3Rpb24oIHkgKSB7XG5cdFx0XHRcdFx0XHRpZiAoIGNhbGxlZCApIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y2FsbGVkID0gdHJ1ZTtcblx0XHRcdFx0XHRcdHJlc29sdmUoIHByb21pc2UsIHksIGZ1bGZpbCwgcmVqZWN0ICk7XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRyZWplY3RQcm9taXNlID0gZnVuY3Rpb24oIHIgKSB7XG5cdFx0XHRcdFx0XHRpZiAoIGNhbGxlZCApIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y2FsbGVkID0gdHJ1ZTtcblx0XHRcdFx0XHRcdHJlamVjdCggciApO1xuXHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdHRoZW4uY2FsbCggeCwgcmVzb2x2ZVByb21pc2UsIHJlamVjdFByb21pc2UgKTtcblx0XHRcdFx0XHR9IGNhdGNoICggZSApIHtcblx0XHRcdFx0XHRcdGlmICggIWNhbGxlZCApIHtcblx0XHRcdFx0XHRcdFx0cmVqZWN0KCBlICk7XG5cdFx0XHRcdFx0XHRcdGNhbGxlZCA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZnVsZmlsKCB4ICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGZ1bGZpbCggeCApO1xuXHRcdFx0fVxuXHRcdH1cblx0fSgpO1xuXG5cdHZhciB1dGlsc19ub3JtYWxpc2VLZXlwYXRoID0gZnVuY3Rpb24oKSB7XG5cblx0XHR2YXIgcmVnZXggPSAvXFxbXFxzKihcXCp8WzAtOV18WzEtOV1bMC05XSspXFxzKlxcXS9nO1xuXHRcdHJldHVybiBmdW5jdGlvbiBub3JtYWxpc2VLZXlwYXRoKCBrZXlwYXRoICkge1xuXHRcdFx0cmV0dXJuICgga2V5cGF0aCB8fCAnJyApLnJlcGxhY2UoIHJlZ2V4LCAnLiQxJyApO1xuXHRcdH07XG5cdH0oKTtcblxuXHR2YXIgY29uZmlnX3ZlbmRvcnMgPSBbXG5cdFx0J28nLFxuXHRcdCdtcycsXG5cdFx0J21veicsXG5cdFx0J3dlYmtpdCdcblx0XTtcblxuXHR2YXIgdXRpbHNfcmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gZnVuY3Rpb24oIHZlbmRvcnMgKSB7XG5cblx0XHRpZiAoIHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHQoIGZ1bmN0aW9uKCB2ZW5kb3JzLCBsYXN0VGltZSwgd2luZG93ICkge1xuXHRcdFx0dmFyIHgsIHNldFRpbWVvdXQ7XG5cdFx0XHRpZiAoIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGZvciAoIHggPSAwOyB4IDwgdmVuZG9ycy5sZW5ndGggJiYgIXdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWU7ICsreCApIHtcblx0XHRcdFx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSA9IHdpbmRvd1sgdmVuZG9yc1sgeCBdICsgJ1JlcXVlc3RBbmltYXRpb25GcmFtZScgXTtcblx0XHRcdH1cblx0XHRcdGlmICggIXdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgKSB7XG5cdFx0XHRcdHNldFRpbWVvdXQgPSB3aW5kb3cuc2V0VGltZW91dDtcblx0XHRcdFx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSA9IGZ1bmN0aW9uKCBjYWxsYmFjayApIHtcblx0XHRcdFx0XHR2YXIgY3VyclRpbWUsIHRpbWVUb0NhbGwsIGlkO1xuXHRcdFx0XHRcdGN1cnJUaW1lID0gRGF0ZS5ub3coKTtcblx0XHRcdFx0XHR0aW1lVG9DYWxsID0gTWF0aC5tYXgoIDAsIDE2IC0gKCBjdXJyVGltZSAtIGxhc3RUaW1lICkgKTtcblx0XHRcdFx0XHRpZCA9IHNldFRpbWVvdXQoIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0Y2FsbGJhY2soIGN1cnJUaW1lICsgdGltZVRvQ2FsbCApO1xuXHRcdFx0XHRcdH0sIHRpbWVUb0NhbGwgKTtcblx0XHRcdFx0XHRsYXN0VGltZSA9IGN1cnJUaW1lICsgdGltZVRvQ2FsbDtcblx0XHRcdFx0XHRyZXR1cm4gaWQ7XG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fSggdmVuZG9ycywgMCwgd2luZG93ICkgKTtcblx0XHRyZXR1cm4gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZTtcblx0fSggY29uZmlnX3ZlbmRvcnMgKTtcblxuXHR2YXIgdXRpbHNfZ2V0VGltZSA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0aWYgKCB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cucGVyZm9ybWFuY2UgJiYgdHlwZW9mIHdpbmRvdy5wZXJmb3JtYW5jZS5ub3cgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB3aW5kb3cucGVyZm9ybWFuY2Uubm93KCk7XG5cdFx0XHR9O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiBEYXRlLm5vdygpO1xuXHRcdFx0fTtcblx0XHR9XG5cdH0oKTtcblxuXHQvLyBUaGlzIG1vZHVsZSBwcm92aWRlcyBhIHBsYWNlIHRvIHN0b3JlIGEpIGNpcmN1bGFyIGRlcGVuZGVuY2llcyBhbmRcblx0Ly8gYikgdGhlIGNhbGxiYWNrIGZ1bmN0aW9ucyB0aGF0IHJlcXVpcmUgdGhvc2UgY2lyY3VsYXIgZGVwZW5kZW5jaWVzXG5cdHZhciBjaXJjdWxhciA9IFtdO1xuXG5cdHZhciB1dGlsc19yZW1vdmVGcm9tQXJyYXkgPSBmdW5jdGlvbiggYXJyYXksIG1lbWJlciApIHtcblx0XHR2YXIgaW5kZXggPSBhcnJheS5pbmRleE9mKCBtZW1iZXIgKTtcblx0XHRpZiAoIGluZGV4ICE9PSAtMSApIHtcblx0XHRcdGFycmF5LnNwbGljZSggaW5kZXgsIDEgKTtcblx0XHR9XG5cdH07XG5cblx0dmFyIGdsb2JhbF9jc3MgPSBmdW5jdGlvbiggY2lyY3VsYXIsIGlzQ2xpZW50LCByZW1vdmVGcm9tQXJyYXkgKSB7XG5cblx0XHR2YXIgcnVubG9vcCwgc3R5bGVFbGVtZW50LCBoZWFkLCBzdHlsZVNoZWV0LCBpbkRvbSwgcHJlZml4ID0gJy8qIFJhY3RpdmUuanMgY29tcG9uZW50IHN0eWxlcyAqL1xcbicsXG5cdFx0XHRjb21wb25lbnRzSW5QYWdlID0ge30sIHN0eWxlcyA9IFtdO1xuXHRcdGlmICggIWlzQ2xpZW50ICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjaXJjdWxhci5wdXNoKCBmdW5jdGlvbigpIHtcblx0XHRcdHJ1bmxvb3AgPSBjaXJjdWxhci5ydW5sb29wO1xuXHRcdH0gKTtcblx0XHRzdHlsZUVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnc3R5bGUnICk7XG5cdFx0c3R5bGVFbGVtZW50LnR5cGUgPSAndGV4dC9jc3MnO1xuXHRcdGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSggJ2hlYWQnIClbIDAgXTtcblx0XHRpbkRvbSA9IGZhbHNlO1xuXHRcdHN0eWxlU2hlZXQgPSBzdHlsZUVsZW1lbnQuc3R5bGVTaGVldDtcblx0XHRyZXR1cm4ge1xuXHRcdFx0YWRkOiBmdW5jdGlvbiggQ29tcG9uZW50ICkge1xuXHRcdFx0XHRpZiAoICFDb21wb25lbnQuY3NzICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoICFjb21wb25lbnRzSW5QYWdlWyBDb21wb25lbnQuX2d1aWQgXSApIHtcblx0XHRcdFx0XHRjb21wb25lbnRzSW5QYWdlWyBDb21wb25lbnQuX2d1aWQgXSA9IDA7XG5cdFx0XHRcdFx0c3R5bGVzLnB1c2goIENvbXBvbmVudC5jc3MgKTtcblx0XHRcdFx0XHRydW5sb29wLnNjaGVkdWxlQ3NzVXBkYXRlKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29tcG9uZW50c0luUGFnZVsgQ29tcG9uZW50Ll9ndWlkIF0gKz0gMTtcblx0XHRcdH0sXG5cdFx0XHRyZW1vdmU6IGZ1bmN0aW9uKCBDb21wb25lbnQgKSB7XG5cdFx0XHRcdGlmICggIUNvbXBvbmVudC5jc3MgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbXBvbmVudHNJblBhZ2VbIENvbXBvbmVudC5fZ3VpZCBdIC09IDE7XG5cdFx0XHRcdGlmICggIWNvbXBvbmVudHNJblBhZ2VbIENvbXBvbmVudC5fZ3VpZCBdICkge1xuXHRcdFx0XHRcdHJlbW92ZUZyb21BcnJheSggc3R5bGVzLCBDb21wb25lbnQuY3NzICk7XG5cdFx0XHRcdFx0cnVubG9vcC5zY2hlZHVsZUNzc1VwZGF0ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0dXBkYXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIGNzcztcblx0XHRcdFx0aWYgKCBzdHlsZXMubGVuZ3RoICkge1xuXHRcdFx0XHRcdGNzcyA9IHByZWZpeCArIHN0eWxlcy5qb2luKCAnICcgKTtcblx0XHRcdFx0XHRpZiAoIHN0eWxlU2hlZXQgKSB7XG5cdFx0XHRcdFx0XHRzdHlsZVNoZWV0LmNzc1RleHQgPSBjc3M7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHN0eWxlRWxlbWVudC5pbm5lckhUTUwgPSBjc3M7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICggIWluRG9tICkge1xuXHRcdFx0XHRcdFx0aGVhZC5hcHBlbmRDaGlsZCggc3R5bGVFbGVtZW50ICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2UgaWYgKCBpbkRvbSApIHtcblx0XHRcdFx0XHRoZWFkLnJlbW92ZUNoaWxkKCBzdHlsZUVsZW1lbnQgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdH0oIGNpcmN1bGFyLCBjb25maWdfaXNDbGllbnQsIHV0aWxzX3JlbW92ZUZyb21BcnJheSApO1xuXG5cdHZhciBzaGFyZWRfZ2V0VmFsdWVGcm9tQ2hlY2tib3hlcyA9IGZ1bmN0aW9uKCByYWN0aXZlLCBrZXlwYXRoICkge1xuXHRcdHZhciB2YWx1ZSwgY2hlY2tib3hlcywgY2hlY2tib3gsIGxlbiwgaSwgcm9vdEVsO1xuXHRcdHZhbHVlID0gW107XG5cdFx0cm9vdEVsID0gcmFjdGl2ZS5fcmVuZGVyaW5nID8gcmFjdGl2ZS5mcmFnbWVudC5kb2NGcmFnIDogcmFjdGl2ZS5lbDtcblx0XHRjaGVja2JveGVzID0gcm9vdEVsLnF1ZXJ5U2VsZWN0b3JBbGwoICdpbnB1dFt0eXBlPVwiY2hlY2tib3hcIl1bbmFtZT1cInt7JyArIGtleXBhdGggKyAnfX1cIl0nICk7XG5cdFx0bGVuID0gY2hlY2tib3hlcy5sZW5ndGg7XG5cdFx0Zm9yICggaSA9IDA7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdGNoZWNrYm94ID0gY2hlY2tib3hlc1sgaSBdO1xuXHRcdFx0aWYgKCBjaGVja2JveC5oYXNBdHRyaWJ1dGUoICdjaGVja2VkJyApIHx8IGNoZWNrYm94LmNoZWNrZWQgKSB7XG5cdFx0XHRcdHZhbHVlLnB1c2goIGNoZWNrYm94Ll9yYWN0aXZlLnZhbHVlICk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB2YWx1ZTtcblx0fTtcblxuXHR2YXIgdXRpbHNfaGFzT3duUHJvcGVydHkgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG5cdHZhciBzaGFyZWRfZ2V0SW5uZXJDb250ZXh0ID0gZnVuY3Rpb24oIGZyYWdtZW50ICkge1xuXHRcdGRvIHtcblx0XHRcdGlmICggZnJhZ21lbnQuY29udGV4dCApIHtcblx0XHRcdFx0cmV0dXJuIGZyYWdtZW50LmNvbnRleHQ7XG5cdFx0XHR9XG5cdFx0fSB3aGlsZSAoIGZyYWdtZW50ID0gZnJhZ21lbnQucGFyZW50ICk7XG5cdFx0cmV0dXJuICcnO1xuXHR9O1xuXG5cdHZhciBzaGFyZWRfcmVzb2x2ZVJlZiA9IGZ1bmN0aW9uKCBjaXJjdWxhciwgbm9ybWFsaXNlS2V5cGF0aCwgaGFzT3duUHJvcGVydHksIGdldElubmVyQ29udGV4dCApIHtcblxuXHRcdHZhciBnZXQsIGFuY2VzdG9yRXJyb3JNZXNzYWdlID0gJ0NvdWxkIG5vdCByZXNvbHZlIHJlZmVyZW5jZSAtIHRvbyBtYW55IFwiLi4vXCIgcHJlZml4ZXMnO1xuXHRcdGNpcmN1bGFyLnB1c2goIGZ1bmN0aW9uKCkge1xuXHRcdFx0Z2V0ID0gY2lyY3VsYXIuZ2V0O1xuXHRcdH0gKTtcblx0XHRyZXR1cm4gZnVuY3Rpb24gcmVzb2x2ZVJlZiggcmFjdGl2ZSwgcmVmLCBmcmFnbWVudCApIHtcblx0XHRcdHZhciBjb250ZXh0LCBjb250ZXh0S2V5cywga2V5cywgbGFzdEtleSwgcG9zdGZpeCwgcGFyZW50S2V5cGF0aCwgcGFyZW50VmFsdWUsIHdyYXBwZWQ7XG5cdFx0XHRyZWYgPSBub3JtYWxpc2VLZXlwYXRoKCByZWYgKTtcblx0XHRcdGlmICggcmVmID09PSAnLicgKSB7XG5cdFx0XHRcdHJldHVybiBnZXRJbm5lckNvbnRleHQoIGZyYWdtZW50ICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHJlZi5jaGFyQXQoIDAgKSA9PT0gJy4nICkge1xuXHRcdFx0XHRjb250ZXh0ID0gZ2V0SW5uZXJDb250ZXh0KCBmcmFnbWVudCApO1xuXHRcdFx0XHRjb250ZXh0S2V5cyA9IGNvbnRleHQgPyBjb250ZXh0LnNwbGl0KCAnLicgKSA6IFtdO1xuXHRcdFx0XHRpZiAoIHJlZi5zdWJzdHIoIDAsIDMgKSA9PT0gJy4uLycgKSB7XG5cdFx0XHRcdFx0d2hpbGUgKCByZWYuc3Vic3RyKCAwLCAzICkgPT09ICcuLi8nICkge1xuXHRcdFx0XHRcdFx0aWYgKCAhY29udGV4dEtleXMubGVuZ3RoICkge1xuXHRcdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoIGFuY2VzdG9yRXJyb3JNZXNzYWdlICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjb250ZXh0S2V5cy5wb3AoKTtcblx0XHRcdFx0XHRcdHJlZiA9IHJlZi5zdWJzdHJpbmcoIDMgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29udGV4dEtleXMucHVzaCggcmVmICk7XG5cdFx0XHRcdFx0cmV0dXJuIGNvbnRleHRLZXlzLmpvaW4oICcuJyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggIWNvbnRleHQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHJlZi5zdWJzdHJpbmcoIDEgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gY29udGV4dCArIHJlZjtcblx0XHRcdH1cblx0XHRcdGtleXMgPSByZWYuc3BsaXQoICcuJyApO1xuXHRcdFx0bGFzdEtleSA9IGtleXMucG9wKCk7XG5cdFx0XHRwb3N0Zml4ID0ga2V5cy5sZW5ndGggPyAnLicgKyBrZXlzLmpvaW4oICcuJyApIDogJyc7XG5cdFx0XHRkbyB7XG5cdFx0XHRcdGNvbnRleHQgPSBmcmFnbWVudC5jb250ZXh0O1xuXHRcdFx0XHRpZiAoICFjb250ZXh0ICkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHBhcmVudEtleXBhdGggPSBjb250ZXh0ICsgcG9zdGZpeDtcblx0XHRcdFx0cGFyZW50VmFsdWUgPSBnZXQoIHJhY3RpdmUsIHBhcmVudEtleXBhdGggKTtcblx0XHRcdFx0aWYgKCB3cmFwcGVkID0gcmFjdGl2ZS5fd3JhcHBlZFsgcGFyZW50S2V5cGF0aCBdICkge1xuXHRcdFx0XHRcdHBhcmVudFZhbHVlID0gd3JhcHBlZC5nZXQoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHBhcmVudFZhbHVlICYmICggdHlwZW9mIHBhcmVudFZhbHVlID09PSAnb2JqZWN0JyB8fCB0eXBlb2YgcGFyZW50VmFsdWUgPT09ICdmdW5jdGlvbicgKSAmJiBsYXN0S2V5IGluIHBhcmVudFZhbHVlICkge1xuXHRcdFx0XHRcdHJldHVybiBjb250ZXh0ICsgJy4nICsgcmVmO1xuXHRcdFx0XHR9XG5cdFx0XHR9IHdoaWxlICggZnJhZ21lbnQgPSBmcmFnbWVudC5wYXJlbnQgKTtcblx0XHRcdGlmICggaGFzT3duUHJvcGVydHkuY2FsbCggcmFjdGl2ZS5kYXRhLCByZWYgKSApIHtcblx0XHRcdFx0cmV0dXJuIHJlZjtcblx0XHRcdH0gZWxzZSBpZiAoIGdldCggcmFjdGl2ZSwgcmVmICkgIT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0cmV0dXJuIHJlZjtcblx0XHRcdH1cblx0XHR9O1xuXHR9KCBjaXJjdWxhciwgdXRpbHNfbm9ybWFsaXNlS2V5cGF0aCwgdXRpbHNfaGFzT3duUHJvcGVydHksIHNoYXJlZF9nZXRJbm5lckNvbnRleHQgKTtcblxuXHR2YXIgc2hhcmVkX2dldFVwc3RyZWFtQ2hhbmdlcyA9IGZ1bmN0aW9uIGdldFVwc3RyZWFtQ2hhbmdlcyggY2hhbmdlcyApIHtcblx0XHR2YXIgdXBzdHJlYW1DaGFuZ2VzID0gWyAnJyBdLFxuXHRcdFx0aSwga2V5cGF0aCwga2V5cywgdXBzdHJlYW1LZXlwYXRoO1xuXHRcdGkgPSBjaGFuZ2VzLmxlbmd0aDtcblx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdGtleXBhdGggPSBjaGFuZ2VzWyBpIF07XG5cdFx0XHRrZXlzID0ga2V5cGF0aC5zcGxpdCggJy4nICk7XG5cdFx0XHR3aGlsZSAoIGtleXMubGVuZ3RoID4gMSApIHtcblx0XHRcdFx0a2V5cy5wb3AoKTtcblx0XHRcdFx0dXBzdHJlYW1LZXlwYXRoID0ga2V5cy5qb2luKCAnLicgKTtcblx0XHRcdFx0aWYgKCB1cHN0cmVhbUNoYW5nZXNbIHVwc3RyZWFtS2V5cGF0aCBdICE9PSB0cnVlICkge1xuXHRcdFx0XHRcdHVwc3RyZWFtQ2hhbmdlcy5wdXNoKCB1cHN0cmVhbUtleXBhdGggKTtcblx0XHRcdFx0XHR1cHN0cmVhbUNoYW5nZXNbIHVwc3RyZWFtS2V5cGF0aCBdID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdXBzdHJlYW1DaGFuZ2VzO1xuXHR9O1xuXG5cdHZhciBzaGFyZWRfbm90aWZ5RGVwZW5kYW50cyA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0dmFyIGxhc3RLZXksIHN0YXJNYXBzID0ge307XG5cdFx0bGFzdEtleSA9IC9bXlxcLl0rJC87XG5cblx0XHRmdW5jdGlvbiBub3RpZnlEZXBlbmRhbnRzKCByYWN0aXZlLCBrZXlwYXRoLCBvbmx5RGlyZWN0ICkge1xuXHRcdFx0dmFyIGk7XG5cdFx0XHRpZiAoIHJhY3RpdmUuX3BhdHRlcm5PYnNlcnZlcnMubGVuZ3RoICkge1xuXHRcdFx0XHRub3RpZnlQYXR0ZXJuT2JzZXJ2ZXJzKCByYWN0aXZlLCBrZXlwYXRoLCBrZXlwYXRoLCBvbmx5RGlyZWN0LCB0cnVlICk7XG5cdFx0XHR9XG5cdFx0XHRmb3IgKCBpID0gMDsgaSA8IHJhY3RpdmUuX2RlcHMubGVuZ3RoOyBpICs9IDEgKSB7XG5cdFx0XHRcdG5vdGlmeURlcGVuZGFudHNBdFByaW9yaXR5KCByYWN0aXZlLCBrZXlwYXRoLCBpLCBvbmx5RGlyZWN0ICk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdG5vdGlmeURlcGVuZGFudHMubXVsdGlwbGUgPSBmdW5jdGlvbiBub3RpZnlNdWx0aXBsZURlcGVuZGFudHMoIHJhY3RpdmUsIGtleXBhdGhzLCBvbmx5RGlyZWN0ICkge1xuXHRcdFx0dmFyIGksIGosIGxlbjtcblx0XHRcdGxlbiA9IGtleXBhdGhzLmxlbmd0aDtcblx0XHRcdGlmICggcmFjdGl2ZS5fcGF0dGVybk9ic2VydmVycy5sZW5ndGggKSB7XG5cdFx0XHRcdGkgPSBsZW47XG5cdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdG5vdGlmeVBhdHRlcm5PYnNlcnZlcnMoIHJhY3RpdmUsIGtleXBhdGhzWyBpIF0sIGtleXBhdGhzWyBpIF0sIG9ubHlEaXJlY3QsIHRydWUgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Zm9yICggaSA9IDA7IGkgPCByYWN0aXZlLl9kZXBzLmxlbmd0aDsgaSArPSAxICkge1xuXHRcdFx0XHRpZiAoIHJhY3RpdmUuX2RlcHNbIGkgXSApIHtcblx0XHRcdFx0XHRqID0gbGVuO1xuXHRcdFx0XHRcdHdoaWxlICggai0tICkge1xuXHRcdFx0XHRcdFx0bm90aWZ5RGVwZW5kYW50c0F0UHJpb3JpdHkoIHJhY3RpdmUsIGtleXBhdGhzWyBqIF0sIGksIG9ubHlEaXJlY3QgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBub3RpZnlEZXBlbmRhbnRzO1xuXG5cdFx0ZnVuY3Rpb24gbm90aWZ5RGVwZW5kYW50c0F0UHJpb3JpdHkoIHJhY3RpdmUsIGtleXBhdGgsIHByaW9yaXR5LCBvbmx5RGlyZWN0ICkge1xuXHRcdFx0dmFyIGRlcHNCeUtleXBhdGggPSByYWN0aXZlLl9kZXBzWyBwcmlvcml0eSBdO1xuXHRcdFx0aWYgKCAhZGVwc0J5S2V5cGF0aCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dXBkYXRlQWxsKCBkZXBzQnlLZXlwYXRoWyBrZXlwYXRoIF0gKTtcblx0XHRcdGlmICggb25seURpcmVjdCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y2FzY2FkZSggcmFjdGl2ZS5fZGVwc01hcFsga2V5cGF0aCBdLCByYWN0aXZlLCBwcmlvcml0eSApO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHVwZGF0ZUFsbCggZGVwcyApIHtcblx0XHRcdHZhciBpLCBsZW47XG5cdFx0XHRpZiAoIGRlcHMgKSB7XG5cdFx0XHRcdGxlbiA9IGRlcHMubGVuZ3RoO1xuXHRcdFx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRcdGRlcHNbIGkgXS51cGRhdGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGNhc2NhZGUoIGNoaWxkRGVwcywgcmFjdGl2ZSwgcHJpb3JpdHksIG9ubHlEaXJlY3QgKSB7XG5cdFx0XHR2YXIgaTtcblx0XHRcdGlmICggY2hpbGREZXBzICkge1xuXHRcdFx0XHRpID0gY2hpbGREZXBzLmxlbmd0aDtcblx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0bm90aWZ5RGVwZW5kYW50c0F0UHJpb3JpdHkoIHJhY3RpdmUsIGNoaWxkRGVwc1sgaSBdLCBwcmlvcml0eSwgb25seURpcmVjdCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gbm90aWZ5UGF0dGVybk9ic2VydmVycyggcmFjdGl2ZSwgcmVnaXN0ZXJlZEtleXBhdGgsIGFjdHVhbEtleXBhdGgsIGlzUGFyZW50T2ZDaGFuZ2VkS2V5cGF0aCwgaXNUb3BMZXZlbENhbGwgKSB7XG5cdFx0XHR2YXIgaSwgcGF0dGVybk9ic2VydmVyLCBjaGlsZHJlbiwgY2hpbGQsIGtleSwgY2hpbGRBY3R1YWxLZXlwYXRoLCBwb3RlbnRpYWxXaWxkY2FyZE1hdGNoZXMsIGNhc2NhZGU7XG5cdFx0XHRpID0gcmFjdGl2ZS5fcGF0dGVybk9ic2VydmVycy5sZW5ndGg7XG5cdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0cGF0dGVybk9ic2VydmVyID0gcmFjdGl2ZS5fcGF0dGVybk9ic2VydmVyc1sgaSBdO1xuXHRcdFx0XHRpZiAoIHBhdHRlcm5PYnNlcnZlci5yZWdleC50ZXN0KCBhY3R1YWxLZXlwYXRoICkgKSB7XG5cdFx0XHRcdFx0cGF0dGVybk9ic2VydmVyLnVwZGF0ZSggYWN0dWFsS2V5cGF0aCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGlzUGFyZW50T2ZDaGFuZ2VkS2V5cGF0aCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y2FzY2FkZSA9IGZ1bmN0aW9uKCBrZXlwYXRoICkge1xuXHRcdFx0XHRpZiAoIGNoaWxkcmVuID0gcmFjdGl2ZS5fZGVwc01hcFsga2V5cGF0aCBdICkge1xuXHRcdFx0XHRcdGkgPSBjaGlsZHJlbi5sZW5ndGg7XG5cdFx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0XHRjaGlsZCA9IGNoaWxkcmVuWyBpIF07XG5cdFx0XHRcdFx0XHRrZXkgPSBsYXN0S2V5LmV4ZWMoIGNoaWxkIClbIDAgXTtcblx0XHRcdFx0XHRcdGNoaWxkQWN0dWFsS2V5cGF0aCA9IGFjdHVhbEtleXBhdGggKyAnLicgKyBrZXk7XG5cdFx0XHRcdFx0XHRub3RpZnlQYXR0ZXJuT2JzZXJ2ZXJzKCByYWN0aXZlLCBjaGlsZCwgY2hpbGRBY3R1YWxLZXlwYXRoICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdFx0aWYgKCBpc1RvcExldmVsQ2FsbCApIHtcblx0XHRcdFx0cG90ZW50aWFsV2lsZGNhcmRNYXRjaGVzID0gZ2V0UG90ZW50aWFsV2lsZGNhcmRNYXRjaGVzKCBhY3R1YWxLZXlwYXRoICk7XG5cdFx0XHRcdHBvdGVudGlhbFdpbGRjYXJkTWF0Y2hlcy5mb3JFYWNoKCBjYXNjYWRlICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjYXNjYWRlKCByZWdpc3RlcmVkS2V5cGF0aCApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldFBvdGVudGlhbFdpbGRjYXJkTWF0Y2hlcygga2V5cGF0aCApIHtcblx0XHRcdHZhciBrZXlzLCBzdGFyTWFwLCBtYXBwZXIsIGksIHJlc3VsdCwgd2lsZGNhcmRLZXlwYXRoO1xuXHRcdFx0a2V5cyA9IGtleXBhdGguc3BsaXQoICcuJyApO1xuXHRcdFx0c3Rhck1hcCA9IGdldFN0YXJNYXAoIGtleXMubGVuZ3RoICk7XG5cdFx0XHRyZXN1bHQgPSBbXTtcblx0XHRcdG1hcHBlciA9IGZ1bmN0aW9uKCBzdGFyLCBpICkge1xuXHRcdFx0XHRyZXR1cm4gc3RhciA/ICcqJyA6IGtleXNbIGkgXTtcblx0XHRcdH07XG5cdFx0XHRpID0gc3Rhck1hcC5sZW5ndGg7XG5cdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0d2lsZGNhcmRLZXlwYXRoID0gc3Rhck1hcFsgaSBdLm1hcCggbWFwcGVyICkuam9pbiggJy4nICk7XG5cdFx0XHRcdGlmICggIXJlc3VsdFsgd2lsZGNhcmRLZXlwYXRoIF0gKSB7XG5cdFx0XHRcdFx0cmVzdWx0LnB1c2goIHdpbGRjYXJkS2V5cGF0aCApO1xuXHRcdFx0XHRcdHJlc3VsdFsgd2lsZGNhcmRLZXlwYXRoIF0gPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldFN0YXJNYXAoIG51bSApIHtcblx0XHRcdHZhciBvbmVzID0gJycsXG5cdFx0XHRcdG1heCwgYmluYXJ5LCBzdGFyTWFwLCBtYXBwZXIsIGk7XG5cdFx0XHRpZiAoICFzdGFyTWFwc1sgbnVtIF0gKSB7XG5cdFx0XHRcdHN0YXJNYXAgPSBbXTtcblx0XHRcdFx0d2hpbGUgKCBvbmVzLmxlbmd0aCA8IG51bSApIHtcblx0XHRcdFx0XHRvbmVzICs9IDE7XG5cdFx0XHRcdH1cblx0XHRcdFx0bWF4ID0gcGFyc2VJbnQoIG9uZXMsIDIgKTtcblx0XHRcdFx0bWFwcGVyID0gZnVuY3Rpb24oIGRpZ2l0ICkge1xuXHRcdFx0XHRcdHJldHVybiBkaWdpdCA9PT0gJzEnO1xuXHRcdFx0XHR9O1xuXHRcdFx0XHRmb3IgKCBpID0gMDsgaSA8PSBtYXg7IGkgKz0gMSApIHtcblx0XHRcdFx0XHRiaW5hcnkgPSBpLnRvU3RyaW5nKCAyICk7XG5cdFx0XHRcdFx0d2hpbGUgKCBiaW5hcnkubGVuZ3RoIDwgbnVtICkge1xuXHRcdFx0XHRcdFx0YmluYXJ5ID0gJzAnICsgYmluYXJ5O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRzdGFyTWFwWyBpIF0gPSBBcnJheS5wcm90b3R5cGUubWFwLmNhbGwoIGJpbmFyeSwgbWFwcGVyICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0c3Rhck1hcHNbIG51bSBdID0gc3Rhck1hcDtcblx0XHRcdH1cblx0XHRcdHJldHVybiBzdGFyTWFwc1sgbnVtIF07XG5cdFx0fVxuXHR9KCk7XG5cblx0dmFyIHNoYXJlZF9tYWtlVHJhbnNpdGlvbk1hbmFnZXIgPSBmdW5jdGlvbiggcmVtb3ZlRnJvbUFycmF5ICkge1xuXG5cdFx0dmFyIG1ha2VUcmFuc2l0aW9uTWFuYWdlciwgY2hlY2tDb21wbGV0ZSwgcmVtb3ZlLCBpbml0O1xuXHRcdG1ha2VUcmFuc2l0aW9uTWFuYWdlciA9IGZ1bmN0aW9uKCBjYWxsYmFjaywgcHJldmlvdXMgKSB7XG5cdFx0XHR2YXIgdHJhbnNpdGlvbk1hbmFnZXIgPSBbXTtcblx0XHRcdHRyYW5zaXRpb25NYW5hZ2VyLmRldGFjaFF1ZXVlID0gW107XG5cdFx0XHR0cmFuc2l0aW9uTWFuYWdlci5yZW1vdmUgPSByZW1vdmU7XG5cdFx0XHR0cmFuc2l0aW9uTWFuYWdlci5pbml0ID0gaW5pdDtcblx0XHRcdHRyYW5zaXRpb25NYW5hZ2VyLl9jaGVjayA9IGNoZWNrQ29tcGxldGU7XG5cdFx0XHR0cmFuc2l0aW9uTWFuYWdlci5fY2FsbGJhY2sgPSBjYWxsYmFjaztcblx0XHRcdHRyYW5zaXRpb25NYW5hZ2VyLl9wcmV2aW91cyA9IHByZXZpb3VzO1xuXHRcdFx0aWYgKCBwcmV2aW91cyApIHtcblx0XHRcdFx0cHJldmlvdXMucHVzaCggdHJhbnNpdGlvbk1hbmFnZXIgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0cmFuc2l0aW9uTWFuYWdlcjtcblx0XHR9O1xuXHRcdGNoZWNrQ29tcGxldGUgPSBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBlbGVtZW50O1xuXHRcdFx0aWYgKCB0aGlzLl9yZWFkeSAmJiAhdGhpcy5sZW5ndGggKSB7XG5cdFx0XHRcdHdoaWxlICggZWxlbWVudCA9IHRoaXMuZGV0YWNoUXVldWUucG9wKCkgKSB7XG5cdFx0XHRcdFx0ZWxlbWVudC5kZXRhY2goKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHR5cGVvZiB0aGlzLl9jYWxsYmFjayA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdFx0XHR0aGlzLl9jYWxsYmFjaygpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggdGhpcy5fcHJldmlvdXMgKSB7XG5cdFx0XHRcdFx0dGhpcy5fcHJldmlvdXMucmVtb3ZlKCB0aGlzICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHRcdHJlbW92ZSA9IGZ1bmN0aW9uKCB0cmFuc2l0aW9uICkge1xuXHRcdFx0cmVtb3ZlRnJvbUFycmF5KCB0aGlzLCB0cmFuc2l0aW9uICk7XG5cdFx0XHR0aGlzLl9jaGVjaygpO1xuXHRcdH07XG5cdFx0aW5pdCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5fcmVhZHkgPSB0cnVlO1xuXHRcdFx0dGhpcy5fY2hlY2soKTtcblx0XHR9O1xuXHRcdHJldHVybiBtYWtlVHJhbnNpdGlvbk1hbmFnZXI7XG5cdH0oIHV0aWxzX3JlbW92ZUZyb21BcnJheSApO1xuXG5cdHZhciBnbG9iYWxfcnVubG9vcCA9IGZ1bmN0aW9uKCBjaXJjdWxhciwgY3NzLCByZW1vdmVGcm9tQXJyYXksIGdldFZhbHVlRnJvbUNoZWNrYm94ZXMsIHJlc29sdmVSZWYsIGdldFVwc3RyZWFtQ2hhbmdlcywgbm90aWZ5RGVwZW5kYW50cywgbWFrZVRyYW5zaXRpb25NYW5hZ2VyICkge1xuXG5cdFx0Y2lyY3VsYXIucHVzaCggZnVuY3Rpb24oKSB7XG5cdFx0XHRnZXQgPSBjaXJjdWxhci5nZXQ7XG5cdFx0XHRzZXQgPSBjaXJjdWxhci5zZXQ7XG5cdFx0fSApO1xuXHRcdHZhciBydW5sb29wLCBnZXQsIHNldCwgZGlydHkgPSBmYWxzZSxcblx0XHRcdGZsdXNoaW5nID0gZmFsc2UsXG5cdFx0XHRwZW5kaW5nQ3NzQ2hhbmdlcywgaW5GbGlnaHQgPSAwLFxuXHRcdFx0dG9Gb2N1cyA9IG51bGwsXG5cdFx0XHRsaXZlUXVlcmllcyA9IFtdLFxuXHRcdFx0ZGVjb3JhdG9ycyA9IFtdLFxuXHRcdFx0dHJhbnNpdGlvbnMgPSBbXSxcblx0XHRcdG9ic2VydmVycyA9IFtdLFxuXHRcdFx0YXR0cmlidXRlcyA9IFtdLFxuXHRcdFx0ZXZhbHVhdG9ycyA9IFtdLFxuXHRcdFx0c2VsZWN0VmFsdWVzID0gW10sXG5cdFx0XHRjaGVja2JveEtleXBhdGhzID0ge30sIGNoZWNrYm94ZXMgPSBbXSxcblx0XHRcdHJhZGlvcyA9IFtdLFxuXHRcdFx0dW5yZXNvbHZlZCA9IFtdLFxuXHRcdFx0aW5zdGFuY2VzID0gW10sXG5cdFx0XHR0cmFuc2l0aW9uTWFuYWdlcjtcblx0XHRydW5sb29wID0ge1xuXHRcdFx0c3RhcnQ6IGZ1bmN0aW9uKCBpbnN0YW5jZSwgY2FsbGJhY2sgKSB7XG5cdFx0XHRcdGlmICggaW5zdGFuY2UgJiYgIWluc3RhbmNlc1sgaW5zdGFuY2UuX2d1aWQgXSApIHtcblx0XHRcdFx0XHRpbnN0YW5jZXMucHVzaCggaW5zdGFuY2UgKTtcblx0XHRcdFx0XHRpbnN0YW5jZXNbIGluc3RhbmNlcy5fZ3VpZCBdID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoICFmbHVzaGluZyApIHtcblx0XHRcdFx0XHRpbkZsaWdodCArPSAxO1xuXHRcdFx0XHRcdHRyYW5zaXRpb25NYW5hZ2VyID0gbWFrZVRyYW5zaXRpb25NYW5hZ2VyKCBjYWxsYmFjaywgdHJhbnNpdGlvbk1hbmFnZXIgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGVuZDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmICggZmx1c2hpbmcgKSB7XG5cdFx0XHRcdFx0YXR0ZW1wdEtleXBhdGhSZXNvbHV0aW9uKCk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggIS0taW5GbGlnaHQgKSB7XG5cdFx0XHRcdFx0Zmx1c2hpbmcgPSB0cnVlO1xuXHRcdFx0XHRcdGZsdXNoQ2hhbmdlcygpO1xuXHRcdFx0XHRcdGZsdXNoaW5nID0gZmFsc2U7XG5cdFx0XHRcdFx0bGFuZCgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRyYW5zaXRpb25NYW5hZ2VyLmluaXQoKTtcblx0XHRcdFx0dHJhbnNpdGlvbk1hbmFnZXIgPSB0cmFuc2l0aW9uTWFuYWdlci5fcHJldmlvdXM7XG5cdFx0XHR9LFxuXHRcdFx0dHJpZ2dlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmICggaW5GbGlnaHQgfHwgZmx1c2hpbmcgKSB7XG5cdFx0XHRcdFx0YXR0ZW1wdEtleXBhdGhSZXNvbHV0aW9uKCk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGZsdXNoaW5nID0gdHJ1ZTtcblx0XHRcdFx0Zmx1c2hDaGFuZ2VzKCk7XG5cdFx0XHRcdGZsdXNoaW5nID0gZmFsc2U7XG5cdFx0XHRcdGxhbmQoKTtcblx0XHRcdH0sXG5cdFx0XHRmb2N1czogZnVuY3Rpb24oIG5vZGUgKSB7XG5cdFx0XHRcdHRvRm9jdXMgPSBub2RlO1xuXHRcdFx0fSxcblx0XHRcdGFkZExpdmVRdWVyeTogZnVuY3Rpb24oIHF1ZXJ5ICkge1xuXHRcdFx0XHRsaXZlUXVlcmllcy5wdXNoKCBxdWVyeSApO1xuXHRcdFx0fSxcblx0XHRcdGFkZERlY29yYXRvcjogZnVuY3Rpb24oIGRlY29yYXRvciApIHtcblx0XHRcdFx0ZGVjb3JhdG9ycy5wdXNoKCBkZWNvcmF0b3IgKTtcblx0XHRcdH0sXG5cdFx0XHRhZGRUcmFuc2l0aW9uOiBmdW5jdGlvbiggdHJhbnNpdGlvbiApIHtcblx0XHRcdFx0dHJhbnNpdGlvbi5fbWFuYWdlciA9IHRyYW5zaXRpb25NYW5hZ2VyO1xuXHRcdFx0XHR0cmFuc2l0aW9uTWFuYWdlci5wdXNoKCB0cmFuc2l0aW9uICk7XG5cdFx0XHRcdHRyYW5zaXRpb25zLnB1c2goIHRyYW5zaXRpb24gKTtcblx0XHRcdH0sXG5cdFx0XHRhZGRPYnNlcnZlcjogZnVuY3Rpb24oIG9ic2VydmVyICkge1xuXHRcdFx0XHRvYnNlcnZlcnMucHVzaCggb2JzZXJ2ZXIgKTtcblx0XHRcdH0sXG5cdFx0XHRhZGRBdHRyaWJ1dGU6IGZ1bmN0aW9uKCBhdHRyaWJ1dGUgKSB7XG5cdFx0XHRcdGF0dHJpYnV0ZXMucHVzaCggYXR0cmlidXRlICk7XG5cdFx0XHR9LFxuXHRcdFx0c2NoZWR1bGVDc3NVcGRhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZiAoICFpbkZsaWdodCAmJiAhZmx1c2hpbmcgKSB7XG5cdFx0XHRcdFx0Y3NzLnVwZGF0ZSgpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHBlbmRpbmdDc3NDaGFuZ2VzID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGFkZEV2YWx1YXRvcjogZnVuY3Rpb24oIGV2YWx1YXRvciApIHtcblx0XHRcdFx0ZGlydHkgPSB0cnVlO1xuXHRcdFx0XHRldmFsdWF0b3JzLnB1c2goIGV2YWx1YXRvciApO1xuXHRcdFx0fSxcblx0XHRcdGFkZFNlbGVjdFZhbHVlOiBmdW5jdGlvbiggc2VsZWN0VmFsdWUgKSB7XG5cdFx0XHRcdGRpcnR5ID0gdHJ1ZTtcblx0XHRcdFx0c2VsZWN0VmFsdWVzLnB1c2goIHNlbGVjdFZhbHVlICk7XG5cdFx0XHR9LFxuXHRcdFx0YWRkQ2hlY2tib3g6IGZ1bmN0aW9uKCBjaGVja2JveCApIHtcblx0XHRcdFx0aWYgKCAhY2hlY2tib3hLZXlwYXRoc1sgY2hlY2tib3gua2V5cGF0aCBdICkge1xuXHRcdFx0XHRcdGRpcnR5ID0gdHJ1ZTtcblx0XHRcdFx0XHRjaGVja2JveGVzLnB1c2goIGNoZWNrYm94ICk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRhZGRSYWRpbzogZnVuY3Rpb24oIHJhZGlvICkge1xuXHRcdFx0XHRkaXJ0eSA9IHRydWU7XG5cdFx0XHRcdHJhZGlvcy5wdXNoKCByYWRpbyApO1xuXHRcdFx0fSxcblx0XHRcdGFkZFVucmVzb2x2ZWQ6IGZ1bmN0aW9uKCB0aGluZyApIHtcblx0XHRcdFx0ZGlydHkgPSB0cnVlO1xuXHRcdFx0XHR1bnJlc29sdmVkLnB1c2goIHRoaW5nICk7XG5cdFx0XHR9LFxuXHRcdFx0cmVtb3ZlVW5yZXNvbHZlZDogZnVuY3Rpb24oIHRoaW5nICkge1xuXHRcdFx0XHRyZW1vdmVGcm9tQXJyYXkoIHVucmVzb2x2ZWQsIHRoaW5nICk7XG5cdFx0XHR9LFxuXHRcdFx0ZGV0YWNoV2hlblJlYWR5OiBmdW5jdGlvbiggdGhpbmcgKSB7XG5cdFx0XHRcdHRyYW5zaXRpb25NYW5hZ2VyLmRldGFjaFF1ZXVlLnB1c2goIHRoaW5nICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRjaXJjdWxhci5ydW5sb29wID0gcnVubG9vcDtcblx0XHRyZXR1cm4gcnVubG9vcDtcblxuXHRcdGZ1bmN0aW9uIGxhbmQoKSB7XG5cdFx0XHR2YXIgdGhpbmcsIGNoYW5nZWRLZXlwYXRoLCBjaGFuZ2VIYXNoO1xuXHRcdFx0aWYgKCB0b0ZvY3VzICkge1xuXHRcdFx0XHR0b0ZvY3VzLmZvY3VzKCk7XG5cdFx0XHRcdHRvRm9jdXMgPSBudWxsO1xuXHRcdFx0fVxuXHRcdFx0d2hpbGUgKCB0aGluZyA9IGF0dHJpYnV0ZXMucG9wKCkgKSB7XG5cdFx0XHRcdHRoaW5nLnVwZGF0ZSgpLmRlZmVycmVkID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHR3aGlsZSAoIHRoaW5nID0gbGl2ZVF1ZXJpZXMucG9wKCkgKSB7XG5cdFx0XHRcdHRoaW5nLl9zb3J0KCk7XG5cdFx0XHR9XG5cdFx0XHR3aGlsZSAoIHRoaW5nID0gZGVjb3JhdG9ycy5wb3AoKSApIHtcblx0XHRcdFx0dGhpbmcuaW5pdCgpO1xuXHRcdFx0fVxuXHRcdFx0d2hpbGUgKCB0aGluZyA9IHRyYW5zaXRpb25zLnBvcCgpICkge1xuXHRcdFx0XHR0aGluZy5pbml0KCk7XG5cdFx0XHR9XG5cdFx0XHR3aGlsZSAoIHRoaW5nID0gb2JzZXJ2ZXJzLnBvcCgpICkge1xuXHRcdFx0XHR0aGluZy51cGRhdGUoKTtcblx0XHRcdH1cblx0XHRcdHdoaWxlICggdGhpbmcgPSBpbnN0YW5jZXMucG9wKCkgKSB7XG5cdFx0XHRcdGluc3RhbmNlc1sgdGhpbmcuX2d1aWQgXSA9IGZhbHNlO1xuXHRcdFx0XHRpZiAoIHRoaW5nLl9jaGFuZ2VzLmxlbmd0aCApIHtcblx0XHRcdFx0XHRjaGFuZ2VIYXNoID0ge307XG5cdFx0XHRcdFx0d2hpbGUgKCBjaGFuZ2VkS2V5cGF0aCA9IHRoaW5nLl9jaGFuZ2VzLnBvcCgpICkge1xuXHRcdFx0XHRcdFx0Y2hhbmdlSGFzaFsgY2hhbmdlZEtleXBhdGggXSA9IGdldCggdGhpbmcsIGNoYW5nZWRLZXlwYXRoICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoaW5nLmZpcmUoICdjaGFuZ2UnLCBjaGFuZ2VIYXNoICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICggcGVuZGluZ0Nzc0NoYW5nZXMgKSB7XG5cdFx0XHRcdGNzcy51cGRhdGUoKTtcblx0XHRcdFx0cGVuZGluZ0Nzc0NoYW5nZXMgPSBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRmdW5jdGlvbiBmbHVzaENoYW5nZXMoKSB7XG5cdFx0XHR2YXIgdGhpbmcsIHVwc3RyZWFtQ2hhbmdlcywgaTtcblx0XHRcdGkgPSBpbnN0YW5jZXMubGVuZ3RoO1xuXHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdHRoaW5nID0gaW5zdGFuY2VzWyBpIF07XG5cdFx0XHRcdGlmICggdGhpbmcuX2NoYW5nZXMubGVuZ3RoICkge1xuXHRcdFx0XHRcdHVwc3RyZWFtQ2hhbmdlcyA9IGdldFVwc3RyZWFtQ2hhbmdlcyggdGhpbmcuX2NoYW5nZXMgKTtcblx0XHRcdFx0XHRub3RpZnlEZXBlbmRhbnRzLm11bHRpcGxlKCB0aGluZywgdXBzdHJlYW1DaGFuZ2VzLCB0cnVlICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGF0dGVtcHRLZXlwYXRoUmVzb2x1dGlvbigpO1xuXHRcdFx0d2hpbGUgKCBkaXJ0eSApIHtcblx0XHRcdFx0ZGlydHkgPSBmYWxzZTtcblx0XHRcdFx0d2hpbGUgKCB0aGluZyA9IGV2YWx1YXRvcnMucG9wKCkgKSB7XG5cdFx0XHRcdFx0dGhpbmcudXBkYXRlKCkuZGVmZXJyZWQgPSBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHR3aGlsZSAoIHRoaW5nID0gc2VsZWN0VmFsdWVzLnBvcCgpICkge1xuXHRcdFx0XHRcdHRoaW5nLmRlZmVycmVkVXBkYXRlKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0d2hpbGUgKCB0aGluZyA9IGNoZWNrYm94ZXMucG9wKCkgKSB7XG5cdFx0XHRcdFx0c2V0KCB0aGluZy5yb290LCB0aGluZy5rZXlwYXRoLCBnZXRWYWx1ZUZyb21DaGVja2JveGVzKCB0aGluZy5yb290LCB0aGluZy5rZXlwYXRoICkgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR3aGlsZSAoIHRoaW5nID0gcmFkaW9zLnBvcCgpICkge1xuXHRcdFx0XHRcdHRoaW5nLnVwZGF0ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gYXR0ZW1wdEtleXBhdGhSZXNvbHV0aW9uKCkge1xuXHRcdFx0dmFyIGFycmF5LCB0aGluZywga2V5cGF0aDtcblx0XHRcdGlmICggIXVucmVzb2x2ZWQubGVuZ3RoICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRhcnJheSA9IHVucmVzb2x2ZWQuc3BsaWNlKCAwLCB1bnJlc29sdmVkLmxlbmd0aCApO1xuXHRcdFx0d2hpbGUgKCB0aGluZyA9IGFycmF5LnBvcCgpICkge1xuXHRcdFx0XHRpZiAoIHRoaW5nLmtleXBhdGggKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0a2V5cGF0aCA9IHJlc29sdmVSZWYoIHRoaW5nLnJvb3QsIHRoaW5nLnJlZiwgdGhpbmcucGFyZW50RnJhZ21lbnQgKTtcblx0XHRcdFx0aWYgKCBrZXlwYXRoICE9PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdFx0dGhpbmcucmVzb2x2ZSgga2V5cGF0aCApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHVucmVzb2x2ZWQucHVzaCggdGhpbmcgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fSggY2lyY3VsYXIsIGdsb2JhbF9jc3MsIHV0aWxzX3JlbW92ZUZyb21BcnJheSwgc2hhcmVkX2dldFZhbHVlRnJvbUNoZWNrYm94ZXMsIHNoYXJlZF9yZXNvbHZlUmVmLCBzaGFyZWRfZ2V0VXBzdHJlYW1DaGFuZ2VzLCBzaGFyZWRfbm90aWZ5RGVwZW5kYW50cywgc2hhcmVkX21ha2VUcmFuc2l0aW9uTWFuYWdlciApO1xuXG5cdHZhciBzaGFyZWRfYW5pbWF0aW9ucyA9IGZ1bmN0aW9uKCByQUYsIGdldFRpbWUsIHJ1bmxvb3AgKSB7XG5cblx0XHR2YXIgcXVldWUgPSBbXTtcblx0XHR2YXIgYW5pbWF0aW9ucyA9IHtcblx0XHRcdHRpY2s6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgaSwgYW5pbWF0aW9uLCBub3c7XG5cdFx0XHRcdG5vdyA9IGdldFRpbWUoKTtcblx0XHRcdFx0cnVubG9vcC5zdGFydCgpO1xuXHRcdFx0XHRmb3IgKCBpID0gMDsgaSA8IHF1ZXVlLmxlbmd0aDsgaSArPSAxICkge1xuXHRcdFx0XHRcdGFuaW1hdGlvbiA9IHF1ZXVlWyBpIF07XG5cdFx0XHRcdFx0aWYgKCAhYW5pbWF0aW9uLnRpY2soIG5vdyApICkge1xuXHRcdFx0XHRcdFx0cXVldWUuc3BsaWNlKCBpLS0sIDEgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cnVubG9vcC5lbmQoKTtcblx0XHRcdFx0aWYgKCBxdWV1ZS5sZW5ndGggKSB7XG5cdFx0XHRcdFx0ckFGKCBhbmltYXRpb25zLnRpY2sgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRhbmltYXRpb25zLnJ1bm5pbmcgPSBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGFkZDogZnVuY3Rpb24oIGFuaW1hdGlvbiApIHtcblx0XHRcdFx0cXVldWUucHVzaCggYW5pbWF0aW9uICk7XG5cdFx0XHRcdGlmICggIWFuaW1hdGlvbnMucnVubmluZyApIHtcblx0XHRcdFx0XHRhbmltYXRpb25zLnJ1bm5pbmcgPSB0cnVlO1xuXHRcdFx0XHRcdHJBRiggYW5pbWF0aW9ucy50aWNrICk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRhYm9ydDogZnVuY3Rpb24oIGtleXBhdGgsIHJvb3QgKSB7XG5cdFx0XHRcdHZhciBpID0gcXVldWUubGVuZ3RoLFxuXHRcdFx0XHRcdGFuaW1hdGlvbjtcblx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0YW5pbWF0aW9uID0gcXVldWVbIGkgXTtcblx0XHRcdFx0XHRpZiAoIGFuaW1hdGlvbi5yb290ID09PSByb290ICYmIGFuaW1hdGlvbi5rZXlwYXRoID09PSBrZXlwYXRoICkge1xuXHRcdFx0XHRcdFx0YW5pbWF0aW9uLnN0b3AoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBhbmltYXRpb25zO1xuXHR9KCB1dGlsc19yZXF1ZXN0QW5pbWF0aW9uRnJhbWUsIHV0aWxzX2dldFRpbWUsIGdsb2JhbF9ydW5sb29wICk7XG5cblx0dmFyIHV0aWxzX2lzQXJyYXkgPSBmdW5jdGlvbigpIHtcblxuXHRcdHZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB0aGluZyApIHtcblx0XHRcdHJldHVybiB0b1N0cmluZy5jYWxsKCB0aGluZyApID09PSAnW29iamVjdCBBcnJheV0nO1xuXHRcdH07XG5cdH0oKTtcblxuXHR2YXIgdXRpbHNfY2xvbmUgPSBmdW5jdGlvbiggaXNBcnJheSApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggc291cmNlICkge1xuXHRcdFx0dmFyIHRhcmdldCwga2V5O1xuXHRcdFx0aWYgKCAhc291cmNlIHx8IHR5cGVvZiBzb3VyY2UgIT09ICdvYmplY3QnICkge1xuXHRcdFx0XHRyZXR1cm4gc291cmNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBpc0FycmF5KCBzb3VyY2UgKSApIHtcblx0XHRcdFx0cmV0dXJuIHNvdXJjZS5zbGljZSgpO1xuXHRcdFx0fVxuXHRcdFx0dGFyZ2V0ID0ge307XG5cdFx0XHRmb3IgKCBrZXkgaW4gc291cmNlICkge1xuXHRcdFx0XHRpZiAoIHNvdXJjZS5oYXNPd25Qcm9wZXJ0eSgga2V5ICkgKSB7XG5cdFx0XHRcdFx0dGFyZ2V0WyBrZXkgXSA9IHNvdXJjZVsga2V5IF07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiB0YXJnZXQ7XG5cdFx0fTtcblx0fSggdXRpbHNfaXNBcnJheSApO1xuXG5cdHZhciByZWdpc3RyaWVzX2FkYXB0b3JzID0ge307XG5cblx0dmFyIHNoYXJlZF9nZXRfYXJyYXlBZGFwdG9yX2dldFNwbGljZUVxdWl2YWxlbnQgPSBmdW5jdGlvbiggYXJyYXksIG1ldGhvZE5hbWUsIGFyZ3MgKSB7XG5cdFx0c3dpdGNoICggbWV0aG9kTmFtZSApIHtcblx0XHRcdGNhc2UgJ3NwbGljZSc6XG5cdFx0XHRcdHJldHVybiBhcmdzO1xuXHRcdFx0Y2FzZSAnc29ydCc6XG5cdFx0XHRjYXNlICdyZXZlcnNlJzpcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRjYXNlICdwb3AnOlxuXHRcdFx0XHRpZiAoIGFycmF5Lmxlbmd0aCApIHtcblx0XHRcdFx0XHRyZXR1cm4gWyAtMSBdO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0Y2FzZSAncHVzaCc6XG5cdFx0XHRcdHJldHVybiBbXG5cdFx0XHRcdFx0YXJyYXkubGVuZ3RoLFxuXHRcdFx0XHRcdDBcblx0XHRcdFx0XS5jb25jYXQoIGFyZ3MgKTtcblx0XHRcdGNhc2UgJ3NoaWZ0Jzpcblx0XHRcdFx0cmV0dXJuIFtcblx0XHRcdFx0XHQwLFxuXHRcdFx0XHRcdDFcblx0XHRcdFx0XTtcblx0XHRcdGNhc2UgJ3Vuc2hpZnQnOlxuXHRcdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRcdDAsXG5cdFx0XHRcdFx0MFxuXHRcdFx0XHRdLmNvbmNhdCggYXJncyApO1xuXHRcdH1cblx0fTtcblxuXHR2YXIgc2hhcmVkX2dldF9hcnJheUFkYXB0b3Jfc3VtbWFyaXNlU3BsaWNlT3BlcmF0aW9uID0gZnVuY3Rpb24oIGFycmF5LCBhcmdzICkge1xuXHRcdHZhciBzdGFydCwgYWRkZWRJdGVtcywgcmVtb3ZlZEl0ZW1zLCBiYWxhbmNlO1xuXHRcdGlmICggIWFyZ3MgKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0c3RhcnQgPSArKCBhcmdzWyAwIF0gPCAwID8gYXJyYXkubGVuZ3RoICsgYXJnc1sgMCBdIDogYXJnc1sgMCBdICk7XG5cdFx0YWRkZWRJdGVtcyA9IE1hdGgubWF4KCAwLCBhcmdzLmxlbmd0aCAtIDIgKTtcblx0XHRyZW1vdmVkSXRlbXMgPSBhcmdzWyAxIF0gIT09IHVuZGVmaW5lZCA/IGFyZ3NbIDEgXSA6IGFycmF5Lmxlbmd0aCAtIHN0YXJ0O1xuXHRcdHJlbW92ZWRJdGVtcyA9IE1hdGgubWluKCByZW1vdmVkSXRlbXMsIGFycmF5Lmxlbmd0aCAtIHN0YXJ0ICk7XG5cdFx0YmFsYW5jZSA9IGFkZGVkSXRlbXMgLSByZW1vdmVkSXRlbXM7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHN0YXJ0OiBzdGFydCxcblx0XHRcdGJhbGFuY2U6IGJhbGFuY2UsXG5cdFx0XHRhZGRlZDogYWRkZWRJdGVtcyxcblx0XHRcdHJlbW92ZWQ6IHJlbW92ZWRJdGVtc1xuXHRcdH07XG5cdH07XG5cblx0dmFyIGNvbmZpZ190eXBlcyA9IHtcblx0XHRURVhUOiAxLFxuXHRcdElOVEVSUE9MQVRPUjogMixcblx0XHRUUklQTEU6IDMsXG5cdFx0U0VDVElPTjogNCxcblx0XHRJTlZFUlRFRDogNSxcblx0XHRDTE9TSU5HOiA2LFxuXHRcdEVMRU1FTlQ6IDcsXG5cdFx0UEFSVElBTDogOCxcblx0XHRDT01NRU5UOiA5LFxuXHRcdERFTElNQ0hBTkdFOiAxMCxcblx0XHRNVVNUQUNIRTogMTEsXG5cdFx0VEFHOiAxMixcblx0XHRBVFRSSUJVVEU6IDEzLFxuXHRcdENPTVBPTkVOVDogMTUsXG5cdFx0TlVNQkVSX0xJVEVSQUw6IDIwLFxuXHRcdFNUUklOR19MSVRFUkFMOiAyMSxcblx0XHRBUlJBWV9MSVRFUkFMOiAyMixcblx0XHRPQkpFQ1RfTElURVJBTDogMjMsXG5cdFx0Qk9PTEVBTl9MSVRFUkFMOiAyNCxcblx0XHRHTE9CQUw6IDI2LFxuXHRcdEtFWV9WQUxVRV9QQUlSOiAyNyxcblx0XHRSRUZFUkVOQ0U6IDMwLFxuXHRcdFJFRklORU1FTlQ6IDMxLFxuXHRcdE1FTUJFUjogMzIsXG5cdFx0UFJFRklYX09QRVJBVE9SOiAzMyxcblx0XHRCUkFDS0VURUQ6IDM0LFxuXHRcdENPTkRJVElPTkFMOiAzNSxcblx0XHRJTkZJWF9PUEVSQVRPUjogMzYsXG5cdFx0SU5WT0NBVElPTjogNDBcblx0fTtcblxuXHR2YXIgc2hhcmVkX2NsZWFyQ2FjaGUgPSBmdW5jdGlvbiBjbGVhckNhY2hlKCByYWN0aXZlLCBrZXlwYXRoLCBkb250VGVhcmRvd25XcmFwcGVyICkge1xuXHRcdHZhciBjYWNoZU1hcCwgd3JhcHBlZFByb3BlcnR5O1xuXHRcdGlmICggIWRvbnRUZWFyZG93bldyYXBwZXIgKSB7XG5cdFx0XHRpZiAoIHdyYXBwZWRQcm9wZXJ0eSA9IHJhY3RpdmUuX3dyYXBwZWRbIGtleXBhdGggXSApIHtcblx0XHRcdFx0aWYgKCB3cmFwcGVkUHJvcGVydHkudGVhcmRvd24oKSAhPT0gZmFsc2UgKSB7XG5cdFx0XHRcdFx0cmFjdGl2ZS5fd3JhcHBlZFsga2V5cGF0aCBdID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyYWN0aXZlLl9jYWNoZVsga2V5cGF0aCBdID0gdW5kZWZpbmVkO1xuXHRcdGlmICggY2FjaGVNYXAgPSByYWN0aXZlLl9jYWNoZU1hcFsga2V5cGF0aCBdICkge1xuXHRcdFx0d2hpbGUgKCBjYWNoZU1hcC5sZW5ndGggKSB7XG5cdFx0XHRcdGNsZWFyQ2FjaGUoIHJhY3RpdmUsIGNhY2hlTWFwLnBvcCgpICk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9O1xuXG5cdHZhciB1dGlsc19jcmVhdGVCcmFuY2ggPSBmdW5jdGlvbigpIHtcblxuXHRcdHZhciBudW1lcmljID0gL15cXHMqWzAtOV0rXFxzKiQvO1xuXHRcdHJldHVybiBmdW5jdGlvbigga2V5ICkge1xuXHRcdFx0cmV0dXJuIG51bWVyaWMudGVzdCgga2V5ICkgPyBbXSA6IHt9O1xuXHRcdH07XG5cdH0oKTtcblxuXHR2YXIgc2hhcmVkX3NldCA9IGZ1bmN0aW9uKCBjaXJjdWxhciwgaXNFcXVhbCwgY3JlYXRlQnJhbmNoLCBjbGVhckNhY2hlLCBub3RpZnlEZXBlbmRhbnRzICkge1xuXG5cdFx0dmFyIGdldDtcblx0XHRjaXJjdWxhci5wdXNoKCBmdW5jdGlvbigpIHtcblx0XHRcdGdldCA9IGNpcmN1bGFyLmdldDtcblx0XHR9ICk7XG5cblx0XHRmdW5jdGlvbiBzZXQoIHJhY3RpdmUsIGtleXBhdGgsIHZhbHVlLCBzaWxlbnQgKSB7XG5cdFx0XHR2YXIga2V5cywgbGFzdEtleSwgcGFyZW50S2V5cGF0aCwgcGFyZW50VmFsdWUsIHdyYXBwZXIsIGV2YWx1YXRvciwgZG9udFRlYXJkb3duV3JhcHBlcjtcblx0XHRcdGlmICggaXNFcXVhbCggcmFjdGl2ZS5fY2FjaGVbIGtleXBhdGggXSwgdmFsdWUgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0d3JhcHBlciA9IHJhY3RpdmUuX3dyYXBwZWRbIGtleXBhdGggXTtcblx0XHRcdGV2YWx1YXRvciA9IHJhY3RpdmUuX2V2YWx1YXRvcnNbIGtleXBhdGggXTtcblx0XHRcdGlmICggd3JhcHBlciAmJiB3cmFwcGVyLnJlc2V0ICkge1xuXHRcdFx0XHR3cmFwcGVyLnJlc2V0KCB2YWx1ZSApO1xuXHRcdFx0XHR2YWx1ZSA9IHdyYXBwZXIuZ2V0KCk7XG5cdFx0XHRcdGRvbnRUZWFyZG93bldyYXBwZXIgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBldmFsdWF0b3IgKSB7XG5cdFx0XHRcdGV2YWx1YXRvci52YWx1ZSA9IHZhbHVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhZXZhbHVhdG9yICYmICggIXdyYXBwZXIgfHwgIXdyYXBwZXIucmVzZXQgKSApIHtcblx0XHRcdFx0a2V5cyA9IGtleXBhdGguc3BsaXQoICcuJyApO1xuXHRcdFx0XHRsYXN0S2V5ID0ga2V5cy5wb3AoKTtcblx0XHRcdFx0cGFyZW50S2V5cGF0aCA9IGtleXMuam9pbiggJy4nICk7XG5cdFx0XHRcdHdyYXBwZXIgPSByYWN0aXZlLl93cmFwcGVkWyBwYXJlbnRLZXlwYXRoIF07XG5cdFx0XHRcdGlmICggd3JhcHBlciAmJiB3cmFwcGVyLnNldCApIHtcblx0XHRcdFx0XHR3cmFwcGVyLnNldCggbGFzdEtleSwgdmFsdWUgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRwYXJlbnRWYWx1ZSA9IHdyYXBwZXIgPyB3cmFwcGVyLmdldCgpIDogZ2V0KCByYWN0aXZlLCBwYXJlbnRLZXlwYXRoICk7XG5cdFx0XHRcdFx0aWYgKCAhcGFyZW50VmFsdWUgKSB7XG5cdFx0XHRcdFx0XHRwYXJlbnRWYWx1ZSA9IGNyZWF0ZUJyYW5jaCggbGFzdEtleSApO1xuXHRcdFx0XHRcdFx0c2V0KCByYWN0aXZlLCBwYXJlbnRLZXlwYXRoLCBwYXJlbnRWYWx1ZSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRwYXJlbnRWYWx1ZVsgbGFzdEtleSBdID0gdmFsdWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGNsZWFyQ2FjaGUoIHJhY3RpdmUsIGtleXBhdGgsIGRvbnRUZWFyZG93bldyYXBwZXIgKTtcblx0XHRcdGlmICggIXNpbGVudCApIHtcblx0XHRcdFx0cmFjdGl2ZS5fY2hhbmdlcy5wdXNoKCBrZXlwYXRoICk7XG5cdFx0XHRcdG5vdGlmeURlcGVuZGFudHMoIHJhY3RpdmUsIGtleXBhdGggKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0Y2lyY3VsYXIuc2V0ID0gc2V0O1xuXHRcdHJldHVybiBzZXQ7XG5cdH0oIGNpcmN1bGFyLCB1dGlsc19pc0VxdWFsLCB1dGlsc19jcmVhdGVCcmFuY2gsIHNoYXJlZF9jbGVhckNhY2hlLCBzaGFyZWRfbm90aWZ5RGVwZW5kYW50cyApO1xuXG5cdHZhciBzaGFyZWRfZ2V0X2FycmF5QWRhcHRvcl9wcm9jZXNzV3JhcHBlciA9IGZ1bmN0aW9uKCB0eXBlcywgY2xlYXJDYWNoZSwgbm90aWZ5RGVwZW5kYW50cywgc2V0ICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB3cmFwcGVyLCBhcnJheSwgbWV0aG9kTmFtZSwgc3BsaWNlU3VtbWFyeSApIHtcblx0XHRcdHZhciByb290LCBrZXlwYXRoLCBjbGVhckVuZCwgdXBkYXRlRGVwZW5kYW50LCBpLCBjaGFuZ2VkLCBzdGFydCwgZW5kLCBjaGlsZEtleXBhdGgsIGxlbmd0aFVuY2hhbmdlZDtcblx0XHRcdHJvb3QgPSB3cmFwcGVyLnJvb3Q7XG5cdFx0XHRrZXlwYXRoID0gd3JhcHBlci5rZXlwYXRoO1xuXHRcdFx0cm9vdC5fY2hhbmdlcy5wdXNoKCBrZXlwYXRoICk7XG5cdFx0XHRpZiAoIG1ldGhvZE5hbWUgPT09ICdzb3J0JyB8fCBtZXRob2ROYW1lID09PSAncmV2ZXJzZScgKSB7XG5cdFx0XHRcdHNldCggcm9vdCwga2V5cGF0aCwgYXJyYXkgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhc3BsaWNlU3VtbWFyeSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y2xlYXJFbmQgPSAhc3BsaWNlU3VtbWFyeS5iYWxhbmNlID8gc3BsaWNlU3VtbWFyeS5hZGRlZCA6IGFycmF5Lmxlbmd0aCAtIE1hdGgubWluKCBzcGxpY2VTdW1tYXJ5LmJhbGFuY2UsIDAgKTtcblx0XHRcdGZvciAoIGkgPSBzcGxpY2VTdW1tYXJ5LnN0YXJ0OyBpIDwgY2xlYXJFbmQ7IGkgKz0gMSApIHtcblx0XHRcdFx0Y2xlYXJDYWNoZSggcm9vdCwga2V5cGF0aCArICcuJyArIGkgKTtcblx0XHRcdH1cblx0XHRcdHVwZGF0ZURlcGVuZGFudCA9IGZ1bmN0aW9uKCBkZXBlbmRhbnQgKSB7XG5cdFx0XHRcdGlmICggZGVwZW5kYW50LmtleXBhdGggPT09IGtleXBhdGggJiYgZGVwZW5kYW50LnR5cGUgPT09IHR5cGVzLlNFQ1RJT04gJiYgIWRlcGVuZGFudC5pbnZlcnRlZCAmJiBkZXBlbmRhbnQuZG9jRnJhZyApIHtcblx0XHRcdFx0XHRkZXBlbmRhbnQuc3BsaWNlKCBzcGxpY2VTdW1tYXJ5ICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZGVwZW5kYW50LnVwZGF0ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdFx0cm9vdC5fZGVwcy5mb3JFYWNoKCBmdW5jdGlvbiggZGVwc0J5S2V5cGF0aCApIHtcblx0XHRcdFx0dmFyIGRlcGVuZGFudHMgPSBkZXBzQnlLZXlwYXRoWyBrZXlwYXRoIF07XG5cdFx0XHRcdGlmICggZGVwZW5kYW50cyApIHtcblx0XHRcdFx0XHRkZXBlbmRhbnRzLmZvckVhY2goIHVwZGF0ZURlcGVuZGFudCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoIHNwbGljZVN1bW1hcnkuYWRkZWQgJiYgc3BsaWNlU3VtbWFyeS5yZW1vdmVkICkge1xuXHRcdFx0XHRjaGFuZ2VkID0gTWF0aC5tYXgoIHNwbGljZVN1bW1hcnkuYWRkZWQsIHNwbGljZVN1bW1hcnkucmVtb3ZlZCApO1xuXHRcdFx0XHRzdGFydCA9IHNwbGljZVN1bW1hcnkuc3RhcnQ7XG5cdFx0XHRcdGVuZCA9IHN0YXJ0ICsgY2hhbmdlZDtcblx0XHRcdFx0bGVuZ3RoVW5jaGFuZ2VkID0gc3BsaWNlU3VtbWFyeS5hZGRlZCA9PT0gc3BsaWNlU3VtbWFyeS5yZW1vdmVkO1xuXHRcdFx0XHRmb3IgKCBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkgKz0gMSApIHtcblx0XHRcdFx0XHRjaGlsZEtleXBhdGggPSBrZXlwYXRoICsgJy4nICsgaTtcblx0XHRcdFx0XHRub3RpZnlEZXBlbmRhbnRzKCByb290LCBjaGlsZEtleXBhdGggKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCAhbGVuZ3RoVW5jaGFuZ2VkICkge1xuXHRcdFx0XHRjbGVhckNhY2hlKCByb290LCBrZXlwYXRoICsgJy5sZW5ndGgnICk7XG5cdFx0XHRcdG5vdGlmeURlcGVuZGFudHMoIHJvb3QsIGtleXBhdGggKyAnLmxlbmd0aCcsIHRydWUgKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9KCBjb25maWdfdHlwZXMsIHNoYXJlZF9jbGVhckNhY2hlLCBzaGFyZWRfbm90aWZ5RGVwZW5kYW50cywgc2hhcmVkX3NldCApO1xuXG5cdHZhciBzaGFyZWRfZ2V0X2FycmF5QWRhcHRvcl9wYXRjaCA9IGZ1bmN0aW9uKCBydW5sb29wLCBkZWZpbmVQcm9wZXJ0eSwgZ2V0U3BsaWNlRXF1aXZhbGVudCwgc3VtbWFyaXNlU3BsaWNlT3BlcmF0aW9uLCBwcm9jZXNzV3JhcHBlciApIHtcblxuXHRcdHZhciBwYXRjaGVkQXJyYXlQcm90byA9IFtdLFxuXHRcdFx0bXV0YXRvck1ldGhvZHMgPSBbXG5cdFx0XHRcdCdwb3AnLFxuXHRcdFx0XHQncHVzaCcsXG5cdFx0XHRcdCdyZXZlcnNlJyxcblx0XHRcdFx0J3NoaWZ0Jyxcblx0XHRcdFx0J3NvcnQnLFxuXHRcdFx0XHQnc3BsaWNlJyxcblx0XHRcdFx0J3Vuc2hpZnQnXG5cdFx0XHRdLFxuXHRcdFx0dGVzdE9iaiwgcGF0Y2hBcnJheU1ldGhvZHMsIHVucGF0Y2hBcnJheU1ldGhvZHM7XG5cdFx0bXV0YXRvck1ldGhvZHMuZm9yRWFjaCggZnVuY3Rpb24oIG1ldGhvZE5hbWUgKSB7XG5cdFx0XHR2YXIgbWV0aG9kID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBzcGxpY2VFcXVpdmFsZW50LCBzcGxpY2VTdW1tYXJ5LCByZXN1bHQsIHdyYXBwZXIsIGk7XG5cdFx0XHRcdHNwbGljZUVxdWl2YWxlbnQgPSBnZXRTcGxpY2VFcXVpdmFsZW50KCB0aGlzLCBtZXRob2ROYW1lLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCggYXJndW1lbnRzICkgKTtcblx0XHRcdFx0c3BsaWNlU3VtbWFyeSA9IHN1bW1hcmlzZVNwbGljZU9wZXJhdGlvbiggdGhpcywgc3BsaWNlRXF1aXZhbGVudCApO1xuXHRcdFx0XHRyZXN1bHQgPSBBcnJheS5wcm90b3R5cGVbIG1ldGhvZE5hbWUgXS5hcHBseSggdGhpcywgYXJndW1lbnRzICk7XG5cdFx0XHRcdHRoaXMuX3JhY3RpdmUuc2V0dGluZyA9IHRydWU7XG5cdFx0XHRcdGkgPSB0aGlzLl9yYWN0aXZlLndyYXBwZXJzLmxlbmd0aDtcblx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0d3JhcHBlciA9IHRoaXMuX3JhY3RpdmUud3JhcHBlcnNbIGkgXTtcblx0XHRcdFx0XHRydW5sb29wLnN0YXJ0KCB3cmFwcGVyLnJvb3QgKTtcblx0XHRcdFx0XHRwcm9jZXNzV3JhcHBlciggd3JhcHBlciwgdGhpcywgbWV0aG9kTmFtZSwgc3BsaWNlU3VtbWFyeSApO1xuXHRcdFx0XHRcdHJ1bmxvb3AuZW5kKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5fcmFjdGl2ZS5zZXR0aW5nID0gZmFsc2U7XG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHR9O1xuXHRcdFx0ZGVmaW5lUHJvcGVydHkoIHBhdGNoZWRBcnJheVByb3RvLCBtZXRob2ROYW1lLCB7XG5cdFx0XHRcdHZhbHVlOiBtZXRob2Rcblx0XHRcdH0gKTtcblx0XHR9ICk7XG5cdFx0dGVzdE9iaiA9IHt9O1xuXHRcdGlmICggdGVzdE9iai5fX3Byb3RvX18gKSB7XG5cdFx0XHRwYXRjaEFycmF5TWV0aG9kcyA9IGZ1bmN0aW9uKCBhcnJheSApIHtcblx0XHRcdFx0YXJyYXkuX19wcm90b19fID0gcGF0Y2hlZEFycmF5UHJvdG87XG5cdFx0XHR9O1xuXHRcdFx0dW5wYXRjaEFycmF5TWV0aG9kcyA9IGZ1bmN0aW9uKCBhcnJheSApIHtcblx0XHRcdFx0YXJyYXkuX19wcm90b19fID0gQXJyYXkucHJvdG90eXBlO1xuXHRcdFx0fTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cGF0Y2hBcnJheU1ldGhvZHMgPSBmdW5jdGlvbiggYXJyYXkgKSB7XG5cdFx0XHRcdHZhciBpLCBtZXRob2ROYW1lO1xuXHRcdFx0XHRpID0gbXV0YXRvck1ldGhvZHMubGVuZ3RoO1xuXHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRtZXRob2ROYW1lID0gbXV0YXRvck1ldGhvZHNbIGkgXTtcblx0XHRcdFx0XHRkZWZpbmVQcm9wZXJ0eSggYXJyYXksIG1ldGhvZE5hbWUsIHtcblx0XHRcdFx0XHRcdHZhbHVlOiBwYXRjaGVkQXJyYXlQcm90b1sgbWV0aG9kTmFtZSBdLFxuXHRcdFx0XHRcdFx0Y29uZmlndXJhYmxlOiB0cnVlXG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdFx0dW5wYXRjaEFycmF5TWV0aG9kcyA9IGZ1bmN0aW9uKCBhcnJheSApIHtcblx0XHRcdFx0dmFyIGk7XG5cdFx0XHRcdGkgPSBtdXRhdG9yTWV0aG9kcy5sZW5ndGg7XG5cdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdGRlbGV0ZSBhcnJheVsgbXV0YXRvck1ldGhvZHNbIGkgXSBdO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdH1cblx0XHRwYXRjaEFycmF5TWV0aG9kcy51bnBhdGNoID0gdW5wYXRjaEFycmF5TWV0aG9kcztcblx0XHRyZXR1cm4gcGF0Y2hBcnJheU1ldGhvZHM7XG5cdH0oIGdsb2JhbF9ydW5sb29wLCB1dGlsc19kZWZpbmVQcm9wZXJ0eSwgc2hhcmVkX2dldF9hcnJheUFkYXB0b3JfZ2V0U3BsaWNlRXF1aXZhbGVudCwgc2hhcmVkX2dldF9hcnJheUFkYXB0b3Jfc3VtbWFyaXNlU3BsaWNlT3BlcmF0aW9uLCBzaGFyZWRfZ2V0X2FycmF5QWRhcHRvcl9wcm9jZXNzV3JhcHBlciApO1xuXG5cdHZhciBzaGFyZWRfZ2V0X2FycmF5QWRhcHRvcl9fYXJyYXlBZGFwdG9yID0gZnVuY3Rpb24oIGRlZmluZVByb3BlcnR5LCBpc0FycmF5LCBwYXRjaCApIHtcblxuXHRcdHZhciBhcnJheUFkYXB0b3IsIEFycmF5V3JhcHBlciwgZXJyb3JNZXNzYWdlO1xuXHRcdGFycmF5QWRhcHRvciA9IHtcblx0XHRcdGZpbHRlcjogZnVuY3Rpb24oIG9iamVjdCApIHtcblx0XHRcdFx0cmV0dXJuIGlzQXJyYXkoIG9iamVjdCApICYmICggIW9iamVjdC5fcmFjdGl2ZSB8fCAhb2JqZWN0Ll9yYWN0aXZlLnNldHRpbmcgKTtcblx0XHRcdH0sXG5cdFx0XHR3cmFwOiBmdW5jdGlvbiggcmFjdGl2ZSwgYXJyYXksIGtleXBhdGggKSB7XG5cdFx0XHRcdHJldHVybiBuZXcgQXJyYXlXcmFwcGVyKCByYWN0aXZlLCBhcnJheSwga2V5cGF0aCApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0QXJyYXlXcmFwcGVyID0gZnVuY3Rpb24oIHJhY3RpdmUsIGFycmF5LCBrZXlwYXRoICkge1xuXHRcdFx0dGhpcy5yb290ID0gcmFjdGl2ZTtcblx0XHRcdHRoaXMudmFsdWUgPSBhcnJheTtcblx0XHRcdHRoaXMua2V5cGF0aCA9IGtleXBhdGg7XG5cdFx0XHRpZiAoICFhcnJheS5fcmFjdGl2ZSApIHtcblx0XHRcdFx0ZGVmaW5lUHJvcGVydHkoIGFycmF5LCAnX3JhY3RpdmUnLCB7XG5cdFx0XHRcdFx0dmFsdWU6IHtcblx0XHRcdFx0XHRcdHdyYXBwZXJzOiBbXSxcblx0XHRcdFx0XHRcdGluc3RhbmNlczogW10sXG5cdFx0XHRcdFx0XHRzZXR0aW5nOiBmYWxzZVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0Y29uZmlndXJhYmxlOiB0cnVlXG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0cGF0Y2goIGFycmF5ICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICFhcnJheS5fcmFjdGl2ZS5pbnN0YW5jZXNbIHJhY3RpdmUuX2d1aWQgXSApIHtcblx0XHRcdFx0YXJyYXkuX3JhY3RpdmUuaW5zdGFuY2VzWyByYWN0aXZlLl9ndWlkIF0gPSAwO1xuXHRcdFx0XHRhcnJheS5fcmFjdGl2ZS5pbnN0YW5jZXMucHVzaCggcmFjdGl2ZSApO1xuXHRcdFx0fVxuXHRcdFx0YXJyYXkuX3JhY3RpdmUuaW5zdGFuY2VzWyByYWN0aXZlLl9ndWlkIF0gKz0gMTtcblx0XHRcdGFycmF5Ll9yYWN0aXZlLndyYXBwZXJzLnB1c2goIHRoaXMgKTtcblx0XHR9O1xuXHRcdEFycmF5V3JhcHBlci5wcm90b3R5cGUgPSB7XG5cdFx0XHRnZXQ6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy52YWx1ZTtcblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBhcnJheSwgc3RvcmFnZSwgd3JhcHBlcnMsIGluc3RhbmNlcywgaW5kZXg7XG5cdFx0XHRcdGFycmF5ID0gdGhpcy52YWx1ZTtcblx0XHRcdFx0c3RvcmFnZSA9IGFycmF5Ll9yYWN0aXZlO1xuXHRcdFx0XHR3cmFwcGVycyA9IHN0b3JhZ2Uud3JhcHBlcnM7XG5cdFx0XHRcdGluc3RhbmNlcyA9IHN0b3JhZ2UuaW5zdGFuY2VzO1xuXHRcdFx0XHRpZiAoIHN0b3JhZ2Uuc2V0dGluZyApIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0aW5kZXggPSB3cmFwcGVycy5pbmRleE9mKCB0aGlzICk7XG5cdFx0XHRcdGlmICggaW5kZXggPT09IC0xICkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggZXJyb3JNZXNzYWdlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0d3JhcHBlcnMuc3BsaWNlKCBpbmRleCwgMSApO1xuXHRcdFx0XHRpZiAoICF3cmFwcGVycy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0ZGVsZXRlIGFycmF5Ll9yYWN0aXZlO1xuXHRcdFx0XHRcdHBhdGNoLnVucGF0Y2goIHRoaXMudmFsdWUgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRpbnN0YW5jZXNbIHRoaXMucm9vdC5fZ3VpZCBdIC09IDE7XG5cdFx0XHRcdFx0aWYgKCAhaW5zdGFuY2VzWyB0aGlzLnJvb3QuX2d1aWQgXSApIHtcblx0XHRcdFx0XHRcdGluZGV4ID0gaW5zdGFuY2VzLmluZGV4T2YoIHRoaXMucm9vdCApO1xuXHRcdFx0XHRcdFx0aWYgKCBpbmRleCA9PT0gLTEgKSB7XG5cdFx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggZXJyb3JNZXNzYWdlICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpbnN0YW5jZXMuc3BsaWNlKCBpbmRleCwgMSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdFx0ZXJyb3JNZXNzYWdlID0gJ1NvbWV0aGluZyB3ZW50IHdyb25nIGluIGEgcmF0aGVyIGludGVyZXN0aW5nIHdheSc7XG5cdFx0cmV0dXJuIGFycmF5QWRhcHRvcjtcblx0fSggdXRpbHNfZGVmaW5lUHJvcGVydHksIHV0aWxzX2lzQXJyYXksIHNoYXJlZF9nZXRfYXJyYXlBZGFwdG9yX3BhdGNoICk7XG5cblx0dmFyIHNoYXJlZF9nZXRfbWFnaWNBZGFwdG9yID0gZnVuY3Rpb24oIHJ1bmxvb3AsIGNyZWF0ZUJyYW5jaCwgaXNBcnJheSwgY2xlYXJDYWNoZSwgbm90aWZ5RGVwZW5kYW50cyApIHtcblxuXHRcdHZhciBtYWdpY0FkYXB0b3IsIE1hZ2ljV3JhcHBlcjtcblx0XHR0cnkge1xuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KCB7fSwgJ3Rlc3QnLCB7XG5cdFx0XHRcdHZhbHVlOiAwXG5cdFx0XHR9ICk7XG5cdFx0fSBjYXRjaCAoIGVyciApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0bWFnaWNBZGFwdG9yID0ge1xuXHRcdFx0ZmlsdGVyOiBmdW5jdGlvbiggb2JqZWN0LCBrZXlwYXRoLCByYWN0aXZlICkge1xuXHRcdFx0XHR2YXIga2V5cywga2V5LCBwYXJlbnRLZXlwYXRoLCBwYXJlbnRXcmFwcGVyLCBwYXJlbnRWYWx1ZTtcblx0XHRcdFx0aWYgKCAha2V5cGF0aCApIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0a2V5cyA9IGtleXBhdGguc3BsaXQoICcuJyApO1xuXHRcdFx0XHRrZXkgPSBrZXlzLnBvcCgpO1xuXHRcdFx0XHRwYXJlbnRLZXlwYXRoID0ga2V5cy5qb2luKCAnLicgKTtcblx0XHRcdFx0aWYgKCAoIHBhcmVudFdyYXBwZXIgPSByYWN0aXZlLl93cmFwcGVkWyBwYXJlbnRLZXlwYXRoIF0gKSAmJiAhcGFyZW50V3JhcHBlci5tYWdpYyApIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0cGFyZW50VmFsdWUgPSByYWN0aXZlLmdldCggcGFyZW50S2V5cGF0aCApO1xuXHRcdFx0XHRpZiAoIGlzQXJyYXkoIHBhcmVudFZhbHVlICkgJiYgL15bMC05XSskLy50ZXN0KCBrZXkgKSApIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHBhcmVudFZhbHVlICYmICggdHlwZW9mIHBhcmVudFZhbHVlID09PSAnb2JqZWN0JyB8fCB0eXBlb2YgcGFyZW50VmFsdWUgPT09ICdmdW5jdGlvbicgKTtcblx0XHRcdH0sXG5cdFx0XHR3cmFwOiBmdW5jdGlvbiggcmFjdGl2ZSwgcHJvcGVydHksIGtleXBhdGggKSB7XG5cdFx0XHRcdHJldHVybiBuZXcgTWFnaWNXcmFwcGVyKCByYWN0aXZlLCBwcm9wZXJ0eSwga2V5cGF0aCApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0TWFnaWNXcmFwcGVyID0gZnVuY3Rpb24oIHJhY3RpdmUsIHZhbHVlLCBrZXlwYXRoICkge1xuXHRcdFx0dmFyIGtleXMsIG9iaktleXBhdGgsIGRlc2NyaXB0b3IsIHNpYmxpbmdzO1xuXHRcdFx0dGhpcy5tYWdpYyA9IHRydWU7XG5cdFx0XHR0aGlzLnJhY3RpdmUgPSByYWN0aXZlO1xuXHRcdFx0dGhpcy5rZXlwYXRoID0ga2V5cGF0aDtcblx0XHRcdHRoaXMudmFsdWUgPSB2YWx1ZTtcblx0XHRcdGtleXMgPSBrZXlwYXRoLnNwbGl0KCAnLicgKTtcblx0XHRcdHRoaXMucHJvcCA9IGtleXMucG9wKCk7XG5cdFx0XHRvYmpLZXlwYXRoID0ga2V5cy5qb2luKCAnLicgKTtcblx0XHRcdHRoaXMub2JqID0gb2JqS2V5cGF0aCA/IHJhY3RpdmUuZ2V0KCBvYmpLZXlwYXRoICkgOiByYWN0aXZlLmRhdGE7XG5cdFx0XHRkZXNjcmlwdG9yID0gdGhpcy5vcmlnaW5hbERlc2NyaXB0b3IgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKCB0aGlzLm9iaiwgdGhpcy5wcm9wICk7XG5cdFx0XHRpZiAoIGRlc2NyaXB0b3IgJiYgZGVzY3JpcHRvci5zZXQgJiYgKCBzaWJsaW5ncyA9IGRlc2NyaXB0b3Iuc2V0Ll9yYWN0aXZlV3JhcHBlcnMgKSApIHtcblx0XHRcdFx0aWYgKCBzaWJsaW5ncy5pbmRleE9mKCB0aGlzICkgPT09IC0xICkge1xuXHRcdFx0XHRcdHNpYmxpbmdzLnB1c2goIHRoaXMgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjcmVhdGVBY2Nlc3NvcnMoIHRoaXMsIHZhbHVlLCBkZXNjcmlwdG9yICk7XG5cdFx0fTtcblx0XHRNYWdpY1dyYXBwZXIucHJvdG90eXBlID0ge1xuXHRcdFx0Z2V0OiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMudmFsdWU7XG5cdFx0XHR9LFxuXHRcdFx0cmVzZXQ6IGZ1bmN0aW9uKCB2YWx1ZSApIHtcblx0XHRcdFx0aWYgKCB0aGlzLnVwZGF0aW5nICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLnVwZGF0aW5nID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy5vYmpbIHRoaXMucHJvcCBdID0gdmFsdWU7XG5cdFx0XHRcdGNsZWFyQ2FjaGUoIHRoaXMucmFjdGl2ZSwgdGhpcy5rZXlwYXRoICk7XG5cdFx0XHRcdHRoaXMudXBkYXRpbmcgPSBmYWxzZTtcblx0XHRcdH0sXG5cdFx0XHRzZXQ6IGZ1bmN0aW9uKCBrZXksIHZhbHVlICkge1xuXHRcdFx0XHRpZiAoIHRoaXMudXBkYXRpbmcgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggIXRoaXMub2JqWyB0aGlzLnByb3AgXSApIHtcblx0XHRcdFx0XHR0aGlzLnVwZGF0aW5nID0gdHJ1ZTtcblx0XHRcdFx0XHR0aGlzLm9ialsgdGhpcy5wcm9wIF0gPSBjcmVhdGVCcmFuY2goIGtleSApO1xuXHRcdFx0XHRcdHRoaXMudXBkYXRpbmcgPSBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLm9ialsgdGhpcy5wcm9wIF1bIGtleSBdID0gdmFsdWU7XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgZGVzY3JpcHRvciwgc2V0LCB2YWx1ZSwgd3JhcHBlcnMsIGluZGV4O1xuXHRcdFx0XHRpZiAoIHRoaXMudXBkYXRpbmcgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGRlc2NyaXB0b3IgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKCB0aGlzLm9iaiwgdGhpcy5wcm9wICk7XG5cdFx0XHRcdHNldCA9IGRlc2NyaXB0b3IgJiYgZGVzY3JpcHRvci5zZXQ7XG5cdFx0XHRcdGlmICggIXNldCApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0d3JhcHBlcnMgPSBzZXQuX3JhY3RpdmVXcmFwcGVycztcblx0XHRcdFx0aW5kZXggPSB3cmFwcGVycy5pbmRleE9mKCB0aGlzICk7XG5cdFx0XHRcdGlmICggaW5kZXggIT09IC0xICkge1xuXHRcdFx0XHRcdHdyYXBwZXJzLnNwbGljZSggaW5kZXgsIDEgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoICF3cmFwcGVycy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0dmFsdWUgPSB0aGlzLm9ialsgdGhpcy5wcm9wIF07XG5cdFx0XHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KCB0aGlzLm9iaiwgdGhpcy5wcm9wLCB0aGlzLm9yaWdpbmFsRGVzY3JpcHRvciB8fCB7XG5cdFx0XHRcdFx0XHR3cml0YWJsZTogdHJ1ZSxcblx0XHRcdFx0XHRcdGVudW1lcmFibGU6IHRydWUsXG5cdFx0XHRcdFx0XHRjb25maWd1cmFibGU6IHRydWVcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0dGhpcy5vYmpbIHRoaXMucHJvcCBdID0gdmFsdWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0ZnVuY3Rpb24gY3JlYXRlQWNjZXNzb3JzKCBvcmlnaW5hbFdyYXBwZXIsIHZhbHVlLCBkZXNjcmlwdG9yICkge1xuXHRcdFx0dmFyIG9iamVjdCwgcHJvcGVydHksIG9sZEdldCwgb2xkU2V0LCBnZXQsIHNldDtcblx0XHRcdG9iamVjdCA9IG9yaWdpbmFsV3JhcHBlci5vYmo7XG5cdFx0XHRwcm9wZXJ0eSA9IG9yaWdpbmFsV3JhcHBlci5wcm9wO1xuXHRcdFx0aWYgKCBkZXNjcmlwdG9yICYmICFkZXNjcmlwdG9yLmNvbmZpZ3VyYWJsZSApIHtcblx0XHRcdFx0aWYgKCBwcm9wZXJ0eSA9PT0gJ2xlbmd0aCcgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ0Nhbm5vdCB1c2UgbWFnaWMgbW9kZSB3aXRoIHByb3BlcnR5IFwiJyArIHByb3BlcnR5ICsgJ1wiIC0gb2JqZWN0IGlzIG5vdCBjb25maWd1cmFibGUnICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGRlc2NyaXB0b3IgKSB7XG5cdFx0XHRcdG9sZEdldCA9IGRlc2NyaXB0b3IuZ2V0O1xuXHRcdFx0XHRvbGRTZXQgPSBkZXNjcmlwdG9yLnNldDtcblx0XHRcdH1cblx0XHRcdGdldCA9IG9sZEdldCB8fCBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdFx0fTtcblx0XHRcdHNldCA9IGZ1bmN0aW9uKCB2ICkge1xuXHRcdFx0XHRpZiAoIG9sZFNldCApIHtcblx0XHRcdFx0XHRvbGRTZXQoIHYgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR2YWx1ZSA9IG9sZEdldCA/IG9sZEdldCgpIDogdjtcblx0XHRcdFx0c2V0Ll9yYWN0aXZlV3JhcHBlcnMuZm9yRWFjaCggdXBkYXRlV3JhcHBlciApO1xuXHRcdFx0fTtcblxuXHRcdFx0ZnVuY3Rpb24gdXBkYXRlV3JhcHBlciggd3JhcHBlciApIHtcblx0XHRcdFx0dmFyIGtleXBhdGgsIHJhY3RpdmU7XG5cdFx0XHRcdHdyYXBwZXIudmFsdWUgPSB2YWx1ZTtcblx0XHRcdFx0aWYgKCB3cmFwcGVyLnVwZGF0aW5nICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRyYWN0aXZlID0gd3JhcHBlci5yYWN0aXZlO1xuXHRcdFx0XHRrZXlwYXRoID0gd3JhcHBlci5rZXlwYXRoO1xuXHRcdFx0XHR3cmFwcGVyLnVwZGF0aW5nID0gdHJ1ZTtcblx0XHRcdFx0cnVubG9vcC5zdGFydCggcmFjdGl2ZSApO1xuXHRcdFx0XHRyYWN0aXZlLl9jaGFuZ2VzLnB1c2goIGtleXBhdGggKTtcblx0XHRcdFx0Y2xlYXJDYWNoZSggcmFjdGl2ZSwga2V5cGF0aCApO1xuXHRcdFx0XHRub3RpZnlEZXBlbmRhbnRzKCByYWN0aXZlLCBrZXlwYXRoICk7XG5cdFx0XHRcdHJ1bmxvb3AuZW5kKCk7XG5cdFx0XHRcdHdyYXBwZXIudXBkYXRpbmcgPSBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHNldC5fcmFjdGl2ZVdyYXBwZXJzID0gWyBvcmlnaW5hbFdyYXBwZXIgXTtcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eSggb2JqZWN0LCBwcm9wZXJ0eSwge1xuXHRcdFx0XHRnZXQ6IGdldCxcblx0XHRcdFx0c2V0OiBzZXQsXG5cdFx0XHRcdGVudW1lcmFibGU6IHRydWUsXG5cdFx0XHRcdGNvbmZpZ3VyYWJsZTogdHJ1ZVxuXHRcdFx0fSApO1xuXHRcdH1cblx0XHRyZXR1cm4gbWFnaWNBZGFwdG9yO1xuXHR9KCBnbG9iYWxfcnVubG9vcCwgdXRpbHNfY3JlYXRlQnJhbmNoLCB1dGlsc19pc0FycmF5LCBzaGFyZWRfY2xlYXJDYWNoZSwgc2hhcmVkX25vdGlmeURlcGVuZGFudHMgKTtcblxuXHR2YXIgc2hhcmVkX2dldF9tYWdpY0FycmF5QWRhcHRvciA9IGZ1bmN0aW9uKCBtYWdpY0FkYXB0b3IsIGFycmF5QWRhcHRvciApIHtcblxuXHRcdGlmICggIW1hZ2ljQWRhcHRvciApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0dmFyIG1hZ2ljQXJyYXlBZGFwdG9yLCBNYWdpY0FycmF5V3JhcHBlcjtcblx0XHRtYWdpY0FycmF5QWRhcHRvciA9IHtcblx0XHRcdGZpbHRlcjogZnVuY3Rpb24oIG9iamVjdCwga2V5cGF0aCwgcmFjdGl2ZSApIHtcblx0XHRcdFx0cmV0dXJuIG1hZ2ljQWRhcHRvci5maWx0ZXIoIG9iamVjdCwga2V5cGF0aCwgcmFjdGl2ZSApICYmIGFycmF5QWRhcHRvci5maWx0ZXIoIG9iamVjdCApO1xuXHRcdFx0fSxcblx0XHRcdHdyYXA6IGZ1bmN0aW9uKCByYWN0aXZlLCBhcnJheSwga2V5cGF0aCApIHtcblx0XHRcdFx0cmV0dXJuIG5ldyBNYWdpY0FycmF5V3JhcHBlciggcmFjdGl2ZSwgYXJyYXksIGtleXBhdGggKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdE1hZ2ljQXJyYXlXcmFwcGVyID0gZnVuY3Rpb24oIHJhY3RpdmUsIGFycmF5LCBrZXlwYXRoICkge1xuXHRcdFx0dGhpcy52YWx1ZSA9IGFycmF5O1xuXHRcdFx0dGhpcy5tYWdpYyA9IHRydWU7XG5cdFx0XHR0aGlzLm1hZ2ljV3JhcHBlciA9IG1hZ2ljQWRhcHRvci53cmFwKCByYWN0aXZlLCBhcnJheSwga2V5cGF0aCApO1xuXHRcdFx0dGhpcy5hcnJheVdyYXBwZXIgPSBhcnJheUFkYXB0b3Iud3JhcCggcmFjdGl2ZSwgYXJyYXksIGtleXBhdGggKTtcblx0XHR9O1xuXHRcdE1hZ2ljQXJyYXlXcmFwcGVyLnByb3RvdHlwZSA9IHtcblx0XHRcdGdldDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnZhbHVlO1xuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dGhpcy5hcnJheVdyYXBwZXIudGVhcmRvd24oKTtcblx0XHRcdFx0dGhpcy5tYWdpY1dyYXBwZXIudGVhcmRvd24oKTtcblx0XHRcdH0sXG5cdFx0XHRyZXNldDogZnVuY3Rpb24oIHZhbHVlICkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5tYWdpY1dyYXBwZXIucmVzZXQoIHZhbHVlICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gbWFnaWNBcnJheUFkYXB0b3I7XG5cdH0oIHNoYXJlZF9nZXRfbWFnaWNBZGFwdG9yLCBzaGFyZWRfZ2V0X2FycmF5QWRhcHRvcl9fYXJyYXlBZGFwdG9yICk7XG5cblx0dmFyIHNoYXJlZF9hZGFwdElmTmVjZXNzYXJ5ID0gZnVuY3Rpb24oIGFkYXB0b3JSZWdpc3RyeSwgYXJyYXlBZGFwdG9yLCBtYWdpY0FkYXB0b3IsIG1hZ2ljQXJyYXlBZGFwdG9yICkge1xuXG5cdFx0dmFyIHByZWZpeGVycyA9IHt9O1xuXHRcdHJldHVybiBmdW5jdGlvbiBhZGFwdElmTmVjZXNzYXJ5KCByYWN0aXZlLCBrZXlwYXRoLCB2YWx1ZSwgaXNFeHByZXNzaW9uUmVzdWx0ICkge1xuXHRcdFx0dmFyIGxlbiwgaSwgYWRhcHRvciwgd3JhcHBlZDtcblx0XHRcdGxlbiA9IHJhY3RpdmUuYWRhcHQubGVuZ3RoO1xuXHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0YWRhcHRvciA9IHJhY3RpdmUuYWRhcHRbIGkgXTtcblx0XHRcdFx0aWYgKCB0eXBlb2YgYWRhcHRvciA9PT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdFx0aWYgKCAhYWRhcHRvclJlZ2lzdHJ5WyBhZGFwdG9yIF0gKSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdNaXNzaW5nIGFkYXB0b3IgXCInICsgYWRhcHRvciArICdcIicgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YWRhcHRvciA9IHJhY3RpdmUuYWRhcHRbIGkgXSA9IGFkYXB0b3JSZWdpc3RyeVsgYWRhcHRvciBdO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggYWRhcHRvci5maWx0ZXIoIHZhbHVlLCBrZXlwYXRoLCByYWN0aXZlICkgKSB7XG5cdFx0XHRcdFx0d3JhcHBlZCA9IHJhY3RpdmUuX3dyYXBwZWRbIGtleXBhdGggXSA9IGFkYXB0b3Iud3JhcCggcmFjdGl2ZSwgdmFsdWUsIGtleXBhdGgsIGdldFByZWZpeGVyKCBrZXlwYXRoICkgKTtcblx0XHRcdFx0XHR3cmFwcGVkLnZhbHVlID0gdmFsdWU7XG5cdFx0XHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoICFpc0V4cHJlc3Npb25SZXN1bHQgKSB7XG5cdFx0XHRcdGlmICggcmFjdGl2ZS5tYWdpYyApIHtcblx0XHRcdFx0XHRpZiAoIG1hZ2ljQXJyYXlBZGFwdG9yLmZpbHRlciggdmFsdWUsIGtleXBhdGgsIHJhY3RpdmUgKSApIHtcblx0XHRcdFx0XHRcdHJhY3RpdmUuX3dyYXBwZWRbIGtleXBhdGggXSA9IG1hZ2ljQXJyYXlBZGFwdG9yLndyYXAoIHJhY3RpdmUsIHZhbHVlLCBrZXlwYXRoICk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmICggbWFnaWNBZGFwdG9yLmZpbHRlciggdmFsdWUsIGtleXBhdGgsIHJhY3RpdmUgKSApIHtcblx0XHRcdFx0XHRcdHJhY3RpdmUuX3dyYXBwZWRbIGtleXBhdGggXSA9IG1hZ2ljQWRhcHRvci53cmFwKCByYWN0aXZlLCB2YWx1ZSwga2V5cGF0aCApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIGlmICggcmFjdGl2ZS5tb2RpZnlBcnJheXMgJiYgYXJyYXlBZGFwdG9yLmZpbHRlciggdmFsdWUsIGtleXBhdGgsIHJhY3RpdmUgKSApIHtcblx0XHRcdFx0XHRyYWN0aXZlLl93cmFwcGVkWyBrZXlwYXRoIF0gPSBhcnJheUFkYXB0b3Iud3JhcCggcmFjdGl2ZSwgdmFsdWUsIGtleXBhdGggKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdH07XG5cblx0XHRmdW5jdGlvbiBwcmVmaXhLZXlwYXRoKCBvYmosIHByZWZpeCApIHtcblx0XHRcdHZhciBwcmVmaXhlZCA9IHt9LCBrZXk7XG5cdFx0XHRpZiAoICFwcmVmaXggKSB7XG5cdFx0XHRcdHJldHVybiBvYmo7XG5cdFx0XHR9XG5cdFx0XHRwcmVmaXggKz0gJy4nO1xuXHRcdFx0Zm9yICgga2V5IGluIG9iaiApIHtcblx0XHRcdFx0aWYgKCBvYmouaGFzT3duUHJvcGVydHkoIGtleSApICkge1xuXHRcdFx0XHRcdHByZWZpeGVkWyBwcmVmaXggKyBrZXkgXSA9IG9ialsga2V5IF07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBwcmVmaXhlZDtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXRQcmVmaXhlciggcm9vdEtleXBhdGggKSB7XG5cdFx0XHR2YXIgcm9vdERvdDtcblx0XHRcdGlmICggIXByZWZpeGVyc1sgcm9vdEtleXBhdGggXSApIHtcblx0XHRcdFx0cm9vdERvdCA9IHJvb3RLZXlwYXRoID8gcm9vdEtleXBhdGggKyAnLicgOiAnJztcblx0XHRcdFx0cHJlZml4ZXJzWyByb290S2V5cGF0aCBdID0gZnVuY3Rpb24oIHJlbGF0aXZlS2V5cGF0aCwgdmFsdWUgKSB7XG5cdFx0XHRcdFx0dmFyIG9iajtcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiByZWxhdGl2ZUtleXBhdGggPT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHRcdFx0b2JqID0ge307XG5cdFx0XHRcdFx0XHRvYmpbIHJvb3REb3QgKyByZWxhdGl2ZUtleXBhdGggXSA9IHZhbHVlO1xuXHRcdFx0XHRcdFx0cmV0dXJuIG9iajtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCB0eXBlb2YgcmVsYXRpdmVLZXlwYXRoID09PSAnb2JqZWN0JyApIHtcblx0XHRcdFx0XHRcdHJldHVybiByb290RG90ID8gcHJlZml4S2V5cGF0aCggcmVsYXRpdmVLZXlwYXRoLCByb290S2V5cGF0aCApIDogcmVsYXRpdmVLZXlwYXRoO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBwcmVmaXhlcnNbIHJvb3RLZXlwYXRoIF07XG5cdFx0fVxuXHR9KCByZWdpc3RyaWVzX2FkYXB0b3JzLCBzaGFyZWRfZ2V0X2FycmF5QWRhcHRvcl9fYXJyYXlBZGFwdG9yLCBzaGFyZWRfZ2V0X21hZ2ljQWRhcHRvciwgc2hhcmVkX2dldF9tYWdpY0FycmF5QWRhcHRvciApO1xuXG5cdHZhciBzaGFyZWRfcmVnaXN0ZXJEZXBlbmRhbnQgPSBmdW5jdGlvbigpIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiByZWdpc3RlckRlcGVuZGFudCggZGVwZW5kYW50ICkge1xuXHRcdFx0dmFyIGRlcHNCeUtleXBhdGgsIGRlcHMsIHJhY3RpdmUsIGtleXBhdGgsIHByaW9yaXR5O1xuXHRcdFx0cmFjdGl2ZSA9IGRlcGVuZGFudC5yb290O1xuXHRcdFx0a2V5cGF0aCA9IGRlcGVuZGFudC5rZXlwYXRoO1xuXHRcdFx0cHJpb3JpdHkgPSBkZXBlbmRhbnQucHJpb3JpdHk7XG5cdFx0XHRkZXBzQnlLZXlwYXRoID0gcmFjdGl2ZS5fZGVwc1sgcHJpb3JpdHkgXSB8fCAoIHJhY3RpdmUuX2RlcHNbIHByaW9yaXR5IF0gPSB7fSApO1xuXHRcdFx0ZGVwcyA9IGRlcHNCeUtleXBhdGhbIGtleXBhdGggXSB8fCAoIGRlcHNCeUtleXBhdGhbIGtleXBhdGggXSA9IFtdICk7XG5cdFx0XHRkZXBzLnB1c2goIGRlcGVuZGFudCApO1xuXHRcdFx0ZGVwZW5kYW50LnJlZ2lzdGVyZWQgPSB0cnVlO1xuXHRcdFx0aWYgKCAha2V5cGF0aCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dXBkYXRlRGVwZW5kYW50c01hcCggcmFjdGl2ZSwga2V5cGF0aCApO1xuXHRcdH07XG5cblx0XHRmdW5jdGlvbiB1cGRhdGVEZXBlbmRhbnRzTWFwKCByYWN0aXZlLCBrZXlwYXRoICkge1xuXHRcdFx0dmFyIGtleXMsIHBhcmVudEtleXBhdGgsIG1hcDtcblx0XHRcdGtleXMgPSBrZXlwYXRoLnNwbGl0KCAnLicgKTtcblx0XHRcdHdoaWxlICgga2V5cy5sZW5ndGggKSB7XG5cdFx0XHRcdGtleXMucG9wKCk7XG5cdFx0XHRcdHBhcmVudEtleXBhdGggPSBrZXlzLmpvaW4oICcuJyApO1xuXHRcdFx0XHRtYXAgPSByYWN0aXZlLl9kZXBzTWFwWyBwYXJlbnRLZXlwYXRoIF0gfHwgKCByYWN0aXZlLl9kZXBzTWFwWyBwYXJlbnRLZXlwYXRoIF0gPSBbXSApO1xuXHRcdFx0XHRpZiAoIG1hcFsga2V5cGF0aCBdID09PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdFx0bWFwWyBrZXlwYXRoIF0gPSAwO1xuXHRcdFx0XHRcdG1hcFsgbWFwLmxlbmd0aCBdID0ga2V5cGF0aDtcblx0XHRcdFx0fVxuXHRcdFx0XHRtYXBbIGtleXBhdGggXSArPSAxO1xuXHRcdFx0XHRrZXlwYXRoID0gcGFyZW50S2V5cGF0aDtcblx0XHRcdH1cblx0XHR9XG5cdH0oKTtcblxuXHR2YXIgc2hhcmVkX3VucmVnaXN0ZXJEZXBlbmRhbnQgPSBmdW5jdGlvbigpIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiB1bnJlZ2lzdGVyRGVwZW5kYW50KCBkZXBlbmRhbnQgKSB7XG5cdFx0XHR2YXIgZGVwcywgaW5kZXgsIHJhY3RpdmUsIGtleXBhdGgsIHByaW9yaXR5O1xuXHRcdFx0cmFjdGl2ZSA9IGRlcGVuZGFudC5yb290O1xuXHRcdFx0a2V5cGF0aCA9IGRlcGVuZGFudC5rZXlwYXRoO1xuXHRcdFx0cHJpb3JpdHkgPSBkZXBlbmRhbnQucHJpb3JpdHk7XG5cdFx0XHRkZXBzID0gcmFjdGl2ZS5fZGVwc1sgcHJpb3JpdHkgXVsga2V5cGF0aCBdO1xuXHRcdFx0aW5kZXggPSBkZXBzLmluZGV4T2YoIGRlcGVuZGFudCApO1xuXHRcdFx0aWYgKCBpbmRleCA9PT0gLTEgfHwgIWRlcGVuZGFudC5yZWdpc3RlcmVkICkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdBdHRlbXB0ZWQgdG8gcmVtb3ZlIGEgZGVwZW5kYW50IHRoYXQgd2FzIG5vIGxvbmdlciByZWdpc3RlcmVkISBUaGlzIHNob3VsZCBub3QgaGFwcGVuLiBJZiB5b3UgYXJlIHNlZWluZyB0aGlzIGJ1ZyBpbiBkZXZlbG9wbWVudCBwbGVhc2UgcmFpc2UgYW4gaXNzdWUgYXQgaHR0cHM6Ly9naXRodWIuY29tL1JhY3RpdmVKUy9SYWN0aXZlL2lzc3VlcyAtIHRoYW5rcycgKTtcblx0XHRcdH1cblx0XHRcdGRlcHMuc3BsaWNlKCBpbmRleCwgMSApO1xuXHRcdFx0ZGVwZW5kYW50LnJlZ2lzdGVyZWQgPSBmYWxzZTtcblx0XHRcdGlmICggIWtleXBhdGggKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHVwZGF0ZURlcGVuZGFudHNNYXAoIHJhY3RpdmUsIGtleXBhdGggKTtcblx0XHR9O1xuXG5cdFx0ZnVuY3Rpb24gdXBkYXRlRGVwZW5kYW50c01hcCggcmFjdGl2ZSwga2V5cGF0aCApIHtcblx0XHRcdHZhciBrZXlzLCBwYXJlbnRLZXlwYXRoLCBtYXA7XG5cdFx0XHRrZXlzID0ga2V5cGF0aC5zcGxpdCggJy4nICk7XG5cdFx0XHR3aGlsZSAoIGtleXMubGVuZ3RoICkge1xuXHRcdFx0XHRrZXlzLnBvcCgpO1xuXHRcdFx0XHRwYXJlbnRLZXlwYXRoID0ga2V5cy5qb2luKCAnLicgKTtcblx0XHRcdFx0bWFwID0gcmFjdGl2ZS5fZGVwc01hcFsgcGFyZW50S2V5cGF0aCBdO1xuXHRcdFx0XHRtYXBbIGtleXBhdGggXSAtPSAxO1xuXHRcdFx0XHRpZiAoICFtYXBbIGtleXBhdGggXSApIHtcblx0XHRcdFx0XHRtYXAuc3BsaWNlKCBtYXAuaW5kZXhPZigga2V5cGF0aCApLCAxICk7XG5cdFx0XHRcdFx0bWFwWyBrZXlwYXRoIF0gPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0a2V5cGF0aCA9IHBhcmVudEtleXBhdGg7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KCk7XG5cblx0dmFyIHNoYXJlZF9jcmVhdGVDb21wb25lbnRCaW5kaW5nID0gZnVuY3Rpb24oIGNpcmN1bGFyLCBpc0FycmF5LCBpc0VxdWFsLCByZWdpc3RlckRlcGVuZGFudCwgdW5yZWdpc3RlckRlcGVuZGFudCApIHtcblxuXHRcdHZhciBnZXQsIHNldDtcblx0XHRjaXJjdWxhci5wdXNoKCBmdW5jdGlvbigpIHtcblx0XHRcdGdldCA9IGNpcmN1bGFyLmdldDtcblx0XHRcdHNldCA9IGNpcmN1bGFyLnNldDtcblx0XHR9ICk7XG5cdFx0dmFyIEJpbmRpbmcgPSBmdW5jdGlvbiggcmFjdGl2ZSwga2V5cGF0aCwgb3RoZXJJbnN0YW5jZSwgb3RoZXJLZXlwYXRoLCBwcmlvcml0eSApIHtcblx0XHRcdHRoaXMucm9vdCA9IHJhY3RpdmU7XG5cdFx0XHR0aGlzLmtleXBhdGggPSBrZXlwYXRoO1xuXHRcdFx0dGhpcy5wcmlvcml0eSA9IHByaW9yaXR5O1xuXHRcdFx0dGhpcy5vdGhlckluc3RhbmNlID0gb3RoZXJJbnN0YW5jZTtcblx0XHRcdHRoaXMub3RoZXJLZXlwYXRoID0gb3RoZXJLZXlwYXRoO1xuXHRcdFx0cmVnaXN0ZXJEZXBlbmRhbnQoIHRoaXMgKTtcblx0XHRcdHRoaXMudmFsdWUgPSBnZXQoIHRoaXMucm9vdCwgdGhpcy5rZXlwYXRoICk7XG5cdFx0fTtcblx0XHRCaW5kaW5nLnByb3RvdHlwZSA9IHtcblx0XHRcdHVwZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciB2YWx1ZTtcblx0XHRcdFx0aWYgKCB0aGlzLnVwZGF0aW5nIHx8IHRoaXMuY291bnRlcnBhcnQgJiYgdGhpcy5jb3VudGVycGFydC51cGRhdGluZyApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0dmFsdWUgPSBnZXQoIHRoaXMucm9vdCwgdGhpcy5rZXlwYXRoICk7XG5cdFx0XHRcdGlmICggaXNBcnJheSggdmFsdWUgKSAmJiB2YWx1ZS5fcmFjdGl2ZSAmJiB2YWx1ZS5fcmFjdGl2ZS5zZXR0aW5nICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoICFpc0VxdWFsKCB2YWx1ZSwgdGhpcy52YWx1ZSApICkge1xuXHRcdFx0XHRcdHRoaXMudXBkYXRpbmcgPSB0cnVlO1xuXHRcdFx0XHRcdHNldCggdGhpcy5vdGhlckluc3RhbmNlLCB0aGlzLm90aGVyS2V5cGF0aCwgdmFsdWUgKTtcblx0XHRcdFx0XHR0aGlzLnZhbHVlID0gdmFsdWU7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGluZyA9IGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR1bnJlZ2lzdGVyRGVwZW5kYW50KCB0aGlzICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gZnVuY3Rpb24gY3JlYXRlQ29tcG9uZW50QmluZGluZyggY29tcG9uZW50LCBwYXJlbnRJbnN0YW5jZSwgcGFyZW50S2V5cGF0aCwgY2hpbGRLZXlwYXRoICkge1xuXHRcdFx0dmFyIGhhc2gsIGNoaWxkSW5zdGFuY2UsIGJpbmRpbmdzLCBwcmlvcml0eSwgcGFyZW50VG9DaGlsZEJpbmRpbmcsIGNoaWxkVG9QYXJlbnRCaW5kaW5nO1xuXHRcdFx0aGFzaCA9IHBhcmVudEtleXBhdGggKyAnPScgKyBjaGlsZEtleXBhdGg7XG5cdFx0XHRiaW5kaW5ncyA9IGNvbXBvbmVudC5iaW5kaW5ncztcblx0XHRcdGlmICggYmluZGluZ3NbIGhhc2ggXSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0YmluZGluZ3NbIGhhc2ggXSA9IHRydWU7XG5cdFx0XHRjaGlsZEluc3RhbmNlID0gY29tcG9uZW50Lmluc3RhbmNlO1xuXHRcdFx0cHJpb3JpdHkgPSBjb21wb25lbnQucGFyZW50RnJhZ21lbnQucHJpb3JpdHk7XG5cdFx0XHRwYXJlbnRUb0NoaWxkQmluZGluZyA9IG5ldyBCaW5kaW5nKCBwYXJlbnRJbnN0YW5jZSwgcGFyZW50S2V5cGF0aCwgY2hpbGRJbnN0YW5jZSwgY2hpbGRLZXlwYXRoLCBwcmlvcml0eSApO1xuXHRcdFx0YmluZGluZ3MucHVzaCggcGFyZW50VG9DaGlsZEJpbmRpbmcgKTtcblx0XHRcdGlmICggY2hpbGRJbnN0YW5jZS50d293YXkgKSB7XG5cdFx0XHRcdGNoaWxkVG9QYXJlbnRCaW5kaW5nID0gbmV3IEJpbmRpbmcoIGNoaWxkSW5zdGFuY2UsIGNoaWxkS2V5cGF0aCwgcGFyZW50SW5zdGFuY2UsIHBhcmVudEtleXBhdGgsIDEgKTtcblx0XHRcdFx0YmluZGluZ3MucHVzaCggY2hpbGRUb1BhcmVudEJpbmRpbmcgKTtcblx0XHRcdFx0cGFyZW50VG9DaGlsZEJpbmRpbmcuY291bnRlcnBhcnQgPSBjaGlsZFRvUGFyZW50QmluZGluZztcblx0XHRcdFx0Y2hpbGRUb1BhcmVudEJpbmRpbmcuY291bnRlcnBhcnQgPSBwYXJlbnRUb0NoaWxkQmluZGluZztcblx0XHRcdH1cblx0XHR9O1xuXHR9KCBjaXJjdWxhciwgdXRpbHNfaXNBcnJheSwgdXRpbHNfaXNFcXVhbCwgc2hhcmVkX3JlZ2lzdGVyRGVwZW5kYW50LCBzaGFyZWRfdW5yZWdpc3RlckRlcGVuZGFudCApO1xuXG5cdHZhciBzaGFyZWRfZ2V0X2dldEZyb21QYXJlbnQgPSBmdW5jdGlvbiggY2lyY3VsYXIsIGNyZWF0ZUNvbXBvbmVudEJpbmRpbmcsIHNldCApIHtcblxuXHRcdHZhciBnZXQ7XG5cdFx0Y2lyY3VsYXIucHVzaCggZnVuY3Rpb24oKSB7XG5cdFx0XHRnZXQgPSBjaXJjdWxhci5nZXQ7XG5cdFx0fSApO1xuXHRcdHJldHVybiBmdW5jdGlvbiBnZXRGcm9tUGFyZW50KCBjaGlsZCwga2V5cGF0aCApIHtcblx0XHRcdHZhciBwYXJlbnQsIGZyYWdtZW50LCBrZXlwYXRoVG9UZXN0LCB2YWx1ZTtcblx0XHRcdHBhcmVudCA9IGNoaWxkLl9wYXJlbnQ7XG5cdFx0XHRmcmFnbWVudCA9IGNoaWxkLmNvbXBvbmVudC5wYXJlbnRGcmFnbWVudDtcblx0XHRcdGRvIHtcblx0XHRcdFx0aWYgKCAhZnJhZ21lbnQuY29udGV4dCApIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRrZXlwYXRoVG9UZXN0ID0gZnJhZ21lbnQuY29udGV4dCArICcuJyArIGtleXBhdGg7XG5cdFx0XHRcdHZhbHVlID0gZ2V0KCBwYXJlbnQsIGtleXBhdGhUb1Rlc3QgKTtcblx0XHRcdFx0aWYgKCB2YWx1ZSAhPT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRcdGNyZWF0ZUxhdGVDb21wb25lbnRCaW5kaW5nKCBwYXJlbnQsIGNoaWxkLCBrZXlwYXRoVG9UZXN0LCBrZXlwYXRoLCB2YWx1ZSApO1xuXHRcdFx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSB3aGlsZSAoIGZyYWdtZW50ID0gZnJhZ21lbnQucGFyZW50ICk7XG5cdFx0XHR2YWx1ZSA9IGdldCggcGFyZW50LCBrZXlwYXRoICk7XG5cdFx0XHRpZiAoIHZhbHVlICE9PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdGNyZWF0ZUxhdGVDb21wb25lbnRCaW5kaW5nKCBwYXJlbnQsIGNoaWxkLCBrZXlwYXRoLCBrZXlwYXRoLCB2YWx1ZSApO1xuXHRcdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGZ1bmN0aW9uIGNyZWF0ZUxhdGVDb21wb25lbnRCaW5kaW5nKCBwYXJlbnQsIGNoaWxkLCBwYXJlbnRLZXlwYXRoLCBjaGlsZEtleXBhdGgsIHZhbHVlICkge1xuXHRcdFx0c2V0KCBjaGlsZCwgY2hpbGRLZXlwYXRoLCB2YWx1ZSwgdHJ1ZSApO1xuXHRcdFx0Y3JlYXRlQ29tcG9uZW50QmluZGluZyggY2hpbGQuY29tcG9uZW50LCBwYXJlbnQsIHBhcmVudEtleXBhdGgsIGNoaWxkS2V5cGF0aCApO1xuXHRcdH1cblx0fSggY2lyY3VsYXIsIHNoYXJlZF9jcmVhdGVDb21wb25lbnRCaW5kaW5nLCBzaGFyZWRfc2V0ICk7XG5cblx0dmFyIHNoYXJlZF9nZXRfRkFJTEVEX0xPT0tVUCA9IHtcblx0XHRGQUlMRURfTE9PS1VQOiB0cnVlXG5cdH07XG5cblx0dmFyIHNoYXJlZF9nZXRfX2dldCA9IGZ1bmN0aW9uKCBjaXJjdWxhciwgaGFzT3duUHJvcGVydHksIGNsb25lLCBhZGFwdElmTmVjZXNzYXJ5LCBnZXRGcm9tUGFyZW50LCBGQUlMRURfTE9PS1VQICkge1xuXG5cdFx0ZnVuY3Rpb24gZ2V0KCByYWN0aXZlLCBrZXlwYXRoLCBvcHRpb25zICkge1xuXHRcdFx0dmFyIGNhY2hlID0gcmFjdGl2ZS5fY2FjaGUsXG5cdFx0XHRcdHZhbHVlLCB3cmFwcGVkLCBldmFsdWF0b3I7XG5cdFx0XHRpZiAoIGNhY2hlWyBrZXlwYXRoIF0gPT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0aWYgKCB3cmFwcGVkID0gcmFjdGl2ZS5fd3JhcHBlZFsga2V5cGF0aCBdICkge1xuXHRcdFx0XHRcdHZhbHVlID0gd3JhcHBlZC52YWx1ZTtcblx0XHRcdFx0fSBlbHNlIGlmICggIWtleXBhdGggKSB7XG5cdFx0XHRcdFx0YWRhcHRJZk5lY2Vzc2FyeSggcmFjdGl2ZSwgJycsIHJhY3RpdmUuZGF0YSApO1xuXHRcdFx0XHRcdHZhbHVlID0gcmFjdGl2ZS5kYXRhO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCBldmFsdWF0b3IgPSByYWN0aXZlLl9ldmFsdWF0b3JzWyBrZXlwYXRoIF0gKSB7XG5cdFx0XHRcdFx0dmFsdWUgPSBldmFsdWF0b3IudmFsdWU7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dmFsdWUgPSByZXRyaWV2ZSggcmFjdGl2ZSwga2V5cGF0aCApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhY2hlWyBrZXlwYXRoIF0gPSB2YWx1ZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHZhbHVlID0gY2FjaGVbIGtleXBhdGggXTtcblx0XHRcdH1cblx0XHRcdGlmICggdmFsdWUgPT09IEZBSUxFRF9MT09LVVAgKSB7XG5cdFx0XHRcdGlmICggcmFjdGl2ZS5fcGFyZW50ICYmICFyYWN0aXZlLmlzb2xhdGVkICkge1xuXHRcdFx0XHRcdHZhbHVlID0gZ2V0RnJvbVBhcmVudCggcmFjdGl2ZSwga2V5cGF0aCwgb3B0aW9ucyApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHZhbHVlID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIG9wdGlvbnMgJiYgb3B0aW9ucy5ldmFsdWF0ZVdyYXBwZWQgJiYgKCB3cmFwcGVkID0gcmFjdGl2ZS5fd3JhcHBlZFsga2V5cGF0aCBdICkgKSB7XG5cdFx0XHRcdHZhbHVlID0gd3JhcHBlZC5nZXQoKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHR9XG5cdFx0Y2lyY3VsYXIuZ2V0ID0gZ2V0O1xuXHRcdHJldHVybiBnZXQ7XG5cblx0XHRmdW5jdGlvbiByZXRyaWV2ZSggcmFjdGl2ZSwga2V5cGF0aCApIHtcblx0XHRcdHZhciBrZXlzLCBrZXksIHBhcmVudEtleXBhdGgsIHBhcmVudFZhbHVlLCBjYWNoZU1hcCwgdmFsdWUsIHdyYXBwZWQsIHNob3VsZENsb25lO1xuXHRcdFx0a2V5cyA9IGtleXBhdGguc3BsaXQoICcuJyApO1xuXHRcdFx0a2V5ID0ga2V5cy5wb3AoKTtcblx0XHRcdHBhcmVudEtleXBhdGggPSBrZXlzLmpvaW4oICcuJyApO1xuXHRcdFx0cGFyZW50VmFsdWUgPSBnZXQoIHJhY3RpdmUsIHBhcmVudEtleXBhdGggKTtcblx0XHRcdGlmICggd3JhcHBlZCA9IHJhY3RpdmUuX3dyYXBwZWRbIHBhcmVudEtleXBhdGggXSApIHtcblx0XHRcdFx0cGFyZW50VmFsdWUgPSB3cmFwcGVkLmdldCgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBwYXJlbnRWYWx1ZSA9PT0gbnVsbCB8fCBwYXJlbnRWYWx1ZSA9PT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEoIGNhY2hlTWFwID0gcmFjdGl2ZS5fY2FjaGVNYXBbIHBhcmVudEtleXBhdGggXSApICkge1xuXHRcdFx0XHRyYWN0aXZlLl9jYWNoZU1hcFsgcGFyZW50S2V5cGF0aCBdID0gWyBrZXlwYXRoIF07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAoIGNhY2hlTWFwLmluZGV4T2YoIGtleXBhdGggKSA9PT0gLTEgKSB7XG5cdFx0XHRcdFx0Y2FjaGVNYXAucHVzaCgga2V5cGF0aCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHR5cGVvZiBwYXJlbnRWYWx1ZSA9PT0gJ29iamVjdCcgJiYgISgga2V5IGluIHBhcmVudFZhbHVlICkgKSB7XG5cdFx0XHRcdHJldHVybiByYWN0aXZlLl9jYWNoZVsga2V5cGF0aCBdID0gRkFJTEVEX0xPT0tVUDtcblx0XHRcdH1cblx0XHRcdHNob3VsZENsb25lID0gIWhhc093blByb3BlcnR5LmNhbGwoIHBhcmVudFZhbHVlLCBrZXkgKTtcblx0XHRcdHZhbHVlID0gc2hvdWxkQ2xvbmUgPyBjbG9uZSggcGFyZW50VmFsdWVbIGtleSBdICkgOiBwYXJlbnRWYWx1ZVsga2V5IF07XG5cdFx0XHR2YWx1ZSA9IGFkYXB0SWZOZWNlc3NhcnkoIHJhY3RpdmUsIGtleXBhdGgsIHZhbHVlLCBmYWxzZSApO1xuXHRcdFx0cmFjdGl2ZS5fY2FjaGVbIGtleXBhdGggXSA9IHZhbHVlO1xuXHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdH1cblx0fSggY2lyY3VsYXIsIHV0aWxzX2hhc093blByb3BlcnR5LCB1dGlsc19jbG9uZSwgc2hhcmVkX2FkYXB0SWZOZWNlc3NhcnksIHNoYXJlZF9nZXRfZ2V0RnJvbVBhcmVudCwgc2hhcmVkX2dldF9GQUlMRURfTE9PS1VQICk7XG5cblx0LyogZ2xvYmFsIGNvbnNvbGUgKi9cblx0dmFyIHV0aWxzX3dhcm4gPSBmdW5jdGlvbigpIHtcblxuXHRcdGlmICggdHlwZW9mIGNvbnNvbGUgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBjb25zb2xlLndhcm4gPT09ICdmdW5jdGlvbicgJiYgdHlwZW9mIGNvbnNvbGUud2Fybi5hcHBseSA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdHJldHVybiBmdW5jdGlvbigpIHtcblx0XHRcdFx0Y29uc29sZS53YXJuLmFwcGx5KCBjb25zb2xlLCBhcmd1bWVudHMgKTtcblx0XHRcdH07XG5cdFx0fVxuXHRcdHJldHVybiBmdW5jdGlvbigpIHt9O1xuXHR9KCk7XG5cblx0dmFyIHV0aWxzX2lzT2JqZWN0ID0gZnVuY3Rpb24oKSB7XG5cblx0XHR2YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXHRcdHJldHVybiBmdW5jdGlvbiggdGhpbmcgKSB7XG5cdFx0XHRyZXR1cm4gdHlwZW9mIHRoaW5nID09PSAnb2JqZWN0JyAmJiB0b1N0cmluZy5jYWxsKCB0aGluZyApID09PSAnW29iamVjdCBPYmplY3RdJztcblx0XHR9O1xuXHR9KCk7XG5cblx0dmFyIHJlZ2lzdHJpZXNfaW50ZXJwb2xhdG9ycyA9IGZ1bmN0aW9uKCBjaXJjdWxhciwgaGFzT3duUHJvcGVydHksIGlzQXJyYXksIGlzT2JqZWN0LCBpc051bWVyaWMgKSB7XG5cblx0XHR2YXIgaW50ZXJwb2xhdG9ycywgaW50ZXJwb2xhdGUsIGNzc0xlbmd0aFBhdHRlcm47XG5cdFx0Y2lyY3VsYXIucHVzaCggZnVuY3Rpb24oKSB7XG5cdFx0XHRpbnRlcnBvbGF0ZSA9IGNpcmN1bGFyLmludGVycG9sYXRlO1xuXHRcdH0gKTtcblx0XHRjc3NMZW5ndGhQYXR0ZXJuID0gL14oWystXT9bMC05XStcXC4/KD86WzAtOV0rKT8pKHB4fGVtfGV4fCV8aW58Y218bW18cHR8cGMpJC87XG5cdFx0aW50ZXJwb2xhdG9ycyA9IHtcblx0XHRcdG51bWJlcjogZnVuY3Rpb24oIGZyb20sIHRvICkge1xuXHRcdFx0XHR2YXIgZGVsdGE7XG5cdFx0XHRcdGlmICggIWlzTnVtZXJpYyggZnJvbSApIHx8ICFpc051bWVyaWMoIHRvICkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZnJvbSA9ICtmcm9tO1xuXHRcdFx0XHR0byA9ICt0bztcblx0XHRcdFx0ZGVsdGEgPSB0byAtIGZyb207XG5cdFx0XHRcdGlmICggIWRlbHRhICkge1xuXHRcdFx0XHRcdHJldHVybiBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdHJldHVybiBmcm9tO1xuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCB0ICkge1xuXHRcdFx0XHRcdHJldHVybiBmcm9tICsgdCAqIGRlbHRhO1xuXHRcdFx0XHR9O1xuXHRcdFx0fSxcblx0XHRcdGFycmF5OiBmdW5jdGlvbiggZnJvbSwgdG8gKSB7XG5cdFx0XHRcdHZhciBpbnRlcm1lZGlhdGUsIGludGVycG9sYXRvcnMsIGxlbiwgaTtcblx0XHRcdFx0aWYgKCAhaXNBcnJheSggZnJvbSApIHx8ICFpc0FycmF5KCB0byApICkge1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGludGVybWVkaWF0ZSA9IFtdO1xuXHRcdFx0XHRpbnRlcnBvbGF0b3JzID0gW107XG5cdFx0XHRcdGkgPSBsZW4gPSBNYXRoLm1pbiggZnJvbS5sZW5ndGgsIHRvLmxlbmd0aCApO1xuXHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRpbnRlcnBvbGF0b3JzWyBpIF0gPSBpbnRlcnBvbGF0ZSggZnJvbVsgaSBdLCB0b1sgaSBdICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Zm9yICggaSA9IGxlbjsgaSA8IGZyb20ubGVuZ3RoOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0aW50ZXJtZWRpYXRlWyBpIF0gPSBmcm9tWyBpIF07XG5cdFx0XHRcdH1cblx0XHRcdFx0Zm9yICggaSA9IGxlbjsgaSA8IHRvLmxlbmd0aDsgaSArPSAxICkge1xuXHRcdFx0XHRcdGludGVybWVkaWF0ZVsgaSBdID0gdG9bIGkgXTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZnVuY3Rpb24oIHQgKSB7XG5cdFx0XHRcdFx0dmFyIGkgPSBsZW47XG5cdFx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0XHRpbnRlcm1lZGlhdGVbIGkgXSA9IGludGVycG9sYXRvcnNbIGkgXSggdCApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gaW50ZXJtZWRpYXRlO1xuXHRcdFx0XHR9O1xuXHRcdFx0fSxcblx0XHRcdG9iamVjdDogZnVuY3Rpb24oIGZyb20sIHRvICkge1xuXHRcdFx0XHR2YXIgcHJvcGVydGllcywgbGVuLCBpbnRlcnBvbGF0b3JzLCBpbnRlcm1lZGlhdGUsIHByb3A7XG5cdFx0XHRcdGlmICggIWlzT2JqZWN0KCBmcm9tICkgfHwgIWlzT2JqZWN0KCB0byApICkge1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHByb3BlcnRpZXMgPSBbXTtcblx0XHRcdFx0aW50ZXJtZWRpYXRlID0ge307XG5cdFx0XHRcdGludGVycG9sYXRvcnMgPSB7fTtcblx0XHRcdFx0Zm9yICggcHJvcCBpbiBmcm9tICkge1xuXHRcdFx0XHRcdGlmICggaGFzT3duUHJvcGVydHkuY2FsbCggZnJvbSwgcHJvcCApICkge1xuXHRcdFx0XHRcdFx0aWYgKCBoYXNPd25Qcm9wZXJ0eS5jYWxsKCB0bywgcHJvcCApICkge1xuXHRcdFx0XHRcdFx0XHRwcm9wZXJ0aWVzLnB1c2goIHByb3AgKTtcblx0XHRcdFx0XHRcdFx0aW50ZXJwb2xhdG9yc1sgcHJvcCBdID0gaW50ZXJwb2xhdGUoIGZyb21bIHByb3AgXSwgdG9bIHByb3AgXSApO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0aW50ZXJtZWRpYXRlWyBwcm9wIF0gPSBmcm9tWyBwcm9wIF07XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGZvciAoIHByb3AgaW4gdG8gKSB7XG5cdFx0XHRcdFx0aWYgKCBoYXNPd25Qcm9wZXJ0eS5jYWxsKCB0bywgcHJvcCApICYmICFoYXNPd25Qcm9wZXJ0eS5jYWxsKCBmcm9tLCBwcm9wICkgKSB7XG5cdFx0XHRcdFx0XHRpbnRlcm1lZGlhdGVbIHByb3AgXSA9IHRvWyBwcm9wIF07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGxlbiA9IHByb3BlcnRpZXMubGVuZ3RoO1xuXHRcdFx0XHRyZXR1cm4gZnVuY3Rpb24oIHQgKSB7XG5cdFx0XHRcdFx0dmFyIGkgPSBsZW4sXG5cdFx0XHRcdFx0XHRwcm9wO1xuXHRcdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdFx0cHJvcCA9IHByb3BlcnRpZXNbIGkgXTtcblx0XHRcdFx0XHRcdGludGVybWVkaWF0ZVsgcHJvcCBdID0gaW50ZXJwb2xhdG9yc1sgcHJvcCBdKCB0ICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBpbnRlcm1lZGlhdGU7XG5cdFx0XHRcdH07XG5cdFx0XHR9LFxuXHRcdFx0Y3NzTGVuZ3RoOiBmdW5jdGlvbiggZnJvbSwgdG8gKSB7XG5cdFx0XHRcdHZhciBmcm9tTWF0Y2gsIHRvTWF0Y2gsIGZyb21Vbml0LCB0b1VuaXQsIGZyb21WYWx1ZSwgdG9WYWx1ZSwgdW5pdCwgZGVsdGE7XG5cdFx0XHRcdGlmICggZnJvbSAhPT0gMCAmJiB0eXBlb2YgZnJvbSAhPT0gJ3N0cmluZycgfHwgdG8gIT09IDAgJiYgdHlwZW9mIHRvICE9PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRmcm9tTWF0Y2ggPSBjc3NMZW5ndGhQYXR0ZXJuLmV4ZWMoIGZyb20gKTtcblx0XHRcdFx0dG9NYXRjaCA9IGNzc0xlbmd0aFBhdHRlcm4uZXhlYyggdG8gKTtcblx0XHRcdFx0ZnJvbVVuaXQgPSBmcm9tTWF0Y2ggPyBmcm9tTWF0Y2hbIDIgXSA6ICcnO1xuXHRcdFx0XHR0b1VuaXQgPSB0b01hdGNoID8gdG9NYXRjaFsgMiBdIDogJyc7XG5cdFx0XHRcdGlmICggZnJvbVVuaXQgJiYgdG9Vbml0ICYmIGZyb21Vbml0ICE9PSB0b1VuaXQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0dW5pdCA9IGZyb21Vbml0IHx8IHRvVW5pdDtcblx0XHRcdFx0ZnJvbVZhbHVlID0gZnJvbU1hdGNoID8gK2Zyb21NYXRjaFsgMSBdIDogMDtcblx0XHRcdFx0dG9WYWx1ZSA9IHRvTWF0Y2ggPyArdG9NYXRjaFsgMSBdIDogMDtcblx0XHRcdFx0ZGVsdGEgPSB0b1ZhbHVlIC0gZnJvbVZhbHVlO1xuXHRcdFx0XHRpZiAoICFkZWx0YSApIHtcblx0XHRcdFx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZnJvbVZhbHVlICsgdW5pdDtcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBmdW5jdGlvbiggdCApIHtcblx0XHRcdFx0XHRyZXR1cm4gZnJvbVZhbHVlICsgdCAqIGRlbHRhICsgdW5pdDtcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBpbnRlcnBvbGF0b3JzO1xuXHR9KCBjaXJjdWxhciwgdXRpbHNfaGFzT3duUHJvcGVydHksIHV0aWxzX2lzQXJyYXksIHV0aWxzX2lzT2JqZWN0LCB1dGlsc19pc051bWVyaWMgKTtcblxuXHR2YXIgc2hhcmVkX2ludGVycG9sYXRlID0gZnVuY3Rpb24oIGNpcmN1bGFyLCB3YXJuLCBpbnRlcnBvbGF0b3JzICkge1xuXG5cdFx0dmFyIGludGVycG9sYXRlID0gZnVuY3Rpb24oIGZyb20sIHRvLCByYWN0aXZlLCB0eXBlICkge1xuXHRcdFx0aWYgKCBmcm9tID09PSB0byApIHtcblx0XHRcdFx0cmV0dXJuIHNuYXAoIHRvICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHR5cGUgKSB7XG5cdFx0XHRcdGlmICggcmFjdGl2ZS5pbnRlcnBvbGF0b3JzWyB0eXBlIF0gKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHJhY3RpdmUuaW50ZXJwb2xhdG9yc1sgdHlwZSBdKCBmcm9tLCB0byApIHx8IHNuYXAoIHRvICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0d2FybiggJ01pc3NpbmcgXCInICsgdHlwZSArICdcIiBpbnRlcnBvbGF0b3IuIFlvdSBtYXkgbmVlZCB0byBkb3dubG9hZCBhIHBsdWdpbiBmcm9tIFtUT0RPXScgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBpbnRlcnBvbGF0b3JzLm51bWJlciggZnJvbSwgdG8gKSB8fCBpbnRlcnBvbGF0b3JzLmFycmF5KCBmcm9tLCB0byApIHx8IGludGVycG9sYXRvcnMub2JqZWN0KCBmcm9tLCB0byApIHx8IGludGVycG9sYXRvcnMuY3NzTGVuZ3RoKCBmcm9tLCB0byApIHx8IHNuYXAoIHRvICk7XG5cdFx0fTtcblx0XHRjaXJjdWxhci5pbnRlcnBvbGF0ZSA9IGludGVycG9sYXRlO1xuXHRcdHJldHVybiBpbnRlcnBvbGF0ZTtcblxuXHRcdGZ1bmN0aW9uIHNuYXAoIHRvICkge1xuXHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdG87XG5cdFx0XHR9O1xuXHRcdH1cblx0fSggY2lyY3VsYXIsIHV0aWxzX3dhcm4sIHJlZ2lzdHJpZXNfaW50ZXJwb2xhdG9ycyApO1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9hbmltYXRlX0FuaW1hdGlvbiA9IGZ1bmN0aW9uKCB3YXJuLCBydW5sb29wLCBpbnRlcnBvbGF0ZSwgc2V0ICkge1xuXG5cdFx0dmFyIEFuaW1hdGlvbiA9IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0dmFyIGtleTtcblx0XHRcdHRoaXMuc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcblx0XHRcdGZvciAoIGtleSBpbiBvcHRpb25zICkge1xuXHRcdFx0XHRpZiAoIG9wdGlvbnMuaGFzT3duUHJvcGVydHkoIGtleSApICkge1xuXHRcdFx0XHRcdHRoaXNbIGtleSBdID0gb3B0aW9uc1sga2V5IF07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHRoaXMuaW50ZXJwb2xhdG9yID0gaW50ZXJwb2xhdGUoIHRoaXMuZnJvbSwgdGhpcy50bywgdGhpcy5yb290LCB0aGlzLmludGVycG9sYXRvciApO1xuXHRcdFx0dGhpcy5ydW5uaW5nID0gdHJ1ZTtcblx0XHR9O1xuXHRcdEFuaW1hdGlvbi5wcm90b3R5cGUgPSB7XG5cdFx0XHR0aWNrOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIGVsYXBzZWQsIHQsIHZhbHVlLCB0aW1lTm93LCBpbmRleCwga2V5cGF0aDtcblx0XHRcdFx0a2V5cGF0aCA9IHRoaXMua2V5cGF0aDtcblx0XHRcdFx0aWYgKCB0aGlzLnJ1bm5pbmcgKSB7XG5cdFx0XHRcdFx0dGltZU5vdyA9IERhdGUubm93KCk7XG5cdFx0XHRcdFx0ZWxhcHNlZCA9IHRpbWVOb3cgLSB0aGlzLnN0YXJ0VGltZTtcblx0XHRcdFx0XHRpZiAoIGVsYXBzZWQgPj0gdGhpcy5kdXJhdGlvbiApIHtcblx0XHRcdFx0XHRcdGlmICgga2V5cGF0aCAhPT0gbnVsbCApIHtcblx0XHRcdFx0XHRcdFx0cnVubG9vcC5zdGFydCggdGhpcy5yb290ICk7XG5cdFx0XHRcdFx0XHRcdHNldCggdGhpcy5yb290LCBrZXlwYXRoLCB0aGlzLnRvICk7XG5cdFx0XHRcdFx0XHRcdHJ1bmxvb3AuZW5kKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoIHRoaXMuc3RlcCApIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5zdGVwKCAxLCB0aGlzLnRvICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR0aGlzLmNvbXBsZXRlKCB0aGlzLnRvICk7XG5cdFx0XHRcdFx0XHRpbmRleCA9IHRoaXMucm9vdC5fYW5pbWF0aW9ucy5pbmRleE9mKCB0aGlzICk7XG5cdFx0XHRcdFx0XHRpZiAoIGluZGV4ID09PSAtMSApIHtcblx0XHRcdFx0XHRcdFx0d2FybiggJ0FuaW1hdGlvbiB3YXMgbm90IGZvdW5kJyApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0dGhpcy5yb290Ll9hbmltYXRpb25zLnNwbGljZSggaW5kZXgsIDEgKTtcblx0XHRcdFx0XHRcdHRoaXMucnVubmluZyA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0ID0gdGhpcy5lYXNpbmcgPyB0aGlzLmVhc2luZyggZWxhcHNlZCAvIHRoaXMuZHVyYXRpb24gKSA6IGVsYXBzZWQgLyB0aGlzLmR1cmF0aW9uO1xuXHRcdFx0XHRcdGlmICgga2V5cGF0aCAhPT0gbnVsbCApIHtcblx0XHRcdFx0XHRcdHZhbHVlID0gdGhpcy5pbnRlcnBvbGF0b3IoIHQgKTtcblx0XHRcdFx0XHRcdHJ1bmxvb3Auc3RhcnQoIHRoaXMucm9vdCApO1xuXHRcdFx0XHRcdFx0c2V0KCB0aGlzLnJvb3QsIGtleXBhdGgsIHZhbHVlICk7XG5cdFx0XHRcdFx0XHRydW5sb29wLmVuZCgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIHRoaXMuc3RlcCApIHtcblx0XHRcdFx0XHRcdHRoaXMuc3RlcCggdCwgdmFsdWUgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fSxcblx0XHRcdHN0b3A6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgaW5kZXg7XG5cdFx0XHRcdHRoaXMucnVubmluZyA9IGZhbHNlO1xuXHRcdFx0XHRpbmRleCA9IHRoaXMucm9vdC5fYW5pbWF0aW9ucy5pbmRleE9mKCB0aGlzICk7XG5cdFx0XHRcdGlmICggaW5kZXggPT09IC0xICkge1xuXHRcdFx0XHRcdHdhcm4oICdBbmltYXRpb24gd2FzIG5vdCBmb3VuZCcgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLnJvb3QuX2FuaW1hdGlvbnMuc3BsaWNlKCBpbmRleCwgMSApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIEFuaW1hdGlvbjtcblx0fSggdXRpbHNfd2FybiwgZ2xvYmFsX3J1bmxvb3AsIHNoYXJlZF9pbnRlcnBvbGF0ZSwgc2hhcmVkX3NldCApO1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9hbmltYXRlX19hbmltYXRlID0gZnVuY3Rpb24oIGlzRXF1YWwsIFByb21pc2UsIG5vcm1hbGlzZUtleXBhdGgsIGFuaW1hdGlvbnMsIGdldCwgQW5pbWF0aW9uICkge1xuXG5cdFx0dmFyIG5vb3AgPSBmdW5jdGlvbigpIHt9LCBub0FuaW1hdGlvbiA9IHtcblx0XHRcdFx0c3RvcDogbm9vcFxuXHRcdFx0fTtcblx0XHRyZXR1cm4gZnVuY3Rpb24oIGtleXBhdGgsIHRvLCBvcHRpb25zICkge1xuXHRcdFx0dmFyIHByb21pc2UsIGZ1bGZpbFByb21pc2UsIGssIGFuaW1hdGlvbiwgYW5pbWF0aW9ucywgZWFzaW5nLCBkdXJhdGlvbiwgc3RlcCwgY29tcGxldGUsIG1ha2VWYWx1ZUNvbGxlY3RvciwgY3VycmVudFZhbHVlcywgY29sbGVjdFZhbHVlLCBkdW1teSwgZHVtbXlPcHRpb25zO1xuXHRcdFx0cHJvbWlzZSA9IG5ldyBQcm9taXNlKCBmdW5jdGlvbiggZnVsZmlsICkge1xuXHRcdFx0XHRmdWxmaWxQcm9taXNlID0gZnVsZmlsO1xuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCB0eXBlb2Yga2V5cGF0aCA9PT0gJ29iamVjdCcgKSB7XG5cdFx0XHRcdG9wdGlvbnMgPSB0byB8fCB7fTtcblx0XHRcdFx0ZWFzaW5nID0gb3B0aW9ucy5lYXNpbmc7XG5cdFx0XHRcdGR1cmF0aW9uID0gb3B0aW9ucy5kdXJhdGlvbjtcblx0XHRcdFx0YW5pbWF0aW9ucyA9IFtdO1xuXHRcdFx0XHRzdGVwID0gb3B0aW9ucy5zdGVwO1xuXHRcdFx0XHRjb21wbGV0ZSA9IG9wdGlvbnMuY29tcGxldGU7XG5cdFx0XHRcdGlmICggc3RlcCB8fCBjb21wbGV0ZSApIHtcblx0XHRcdFx0XHRjdXJyZW50VmFsdWVzID0ge307XG5cdFx0XHRcdFx0b3B0aW9ucy5zdGVwID0gbnVsbDtcblx0XHRcdFx0XHRvcHRpb25zLmNvbXBsZXRlID0gbnVsbDtcblx0XHRcdFx0XHRtYWtlVmFsdWVDb2xsZWN0b3IgPSBmdW5jdGlvbigga2V5cGF0aCApIHtcblx0XHRcdFx0XHRcdHJldHVybiBmdW5jdGlvbiggdCwgdmFsdWUgKSB7XG5cdFx0XHRcdFx0XHRcdGN1cnJlbnRWYWx1ZXNbIGtleXBhdGggXSA9IHZhbHVlO1xuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHRcdGZvciAoIGsgaW4ga2V5cGF0aCApIHtcblx0XHRcdFx0XHRpZiAoIGtleXBhdGguaGFzT3duUHJvcGVydHkoIGsgKSApIHtcblx0XHRcdFx0XHRcdGlmICggc3RlcCB8fCBjb21wbGV0ZSApIHtcblx0XHRcdFx0XHRcdFx0Y29sbGVjdFZhbHVlID0gbWFrZVZhbHVlQ29sbGVjdG9yKCBrICk7XG5cdFx0XHRcdFx0XHRcdG9wdGlvbnMgPSB7XG5cdFx0XHRcdFx0XHRcdFx0ZWFzaW5nOiBlYXNpbmcsXG5cdFx0XHRcdFx0XHRcdFx0ZHVyYXRpb246IGR1cmF0aW9uXG5cdFx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHRcdGlmICggc3RlcCApIHtcblx0XHRcdFx0XHRcdFx0XHRvcHRpb25zLnN0ZXAgPSBjb2xsZWN0VmFsdWU7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdG9wdGlvbnMuY29tcGxldGUgPSBjb21wbGV0ZSA/IGNvbGxlY3RWYWx1ZSA6IG5vb3A7XG5cdFx0XHRcdFx0XHRhbmltYXRpb25zLnB1c2goIGFuaW1hdGUoIHRoaXMsIGssIGtleXBhdGhbIGsgXSwgb3B0aW9ucyApICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggc3RlcCB8fCBjb21wbGV0ZSApIHtcblx0XHRcdFx0XHRkdW1teU9wdGlvbnMgPSB7XG5cdFx0XHRcdFx0XHRlYXNpbmc6IGVhc2luZyxcblx0XHRcdFx0XHRcdGR1cmF0aW9uOiBkdXJhdGlvblxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0aWYgKCBzdGVwICkge1xuXHRcdFx0XHRcdFx0ZHVtbXlPcHRpb25zLnN0ZXAgPSBmdW5jdGlvbiggdCApIHtcblx0XHRcdFx0XHRcdFx0c3RlcCggdCwgY3VycmVudFZhbHVlcyApO1xuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCBjb21wbGV0ZSApIHtcblx0XHRcdFx0XHRcdHByb21pc2UudGhlbiggZnVuY3Rpb24oIHQgKSB7XG5cdFx0XHRcdFx0XHRcdGNvbXBsZXRlKCB0LCBjdXJyZW50VmFsdWVzICk7XG5cdFx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGR1bW15T3B0aW9ucy5jb21wbGV0ZSA9IGZ1bGZpbFByb21pc2U7XG5cdFx0XHRcdFx0ZHVtbXkgPSBhbmltYXRlKCB0aGlzLCBudWxsLCBudWxsLCBkdW1teU9wdGlvbnMgKTtcblx0XHRcdFx0XHRhbmltYXRpb25zLnB1c2goIGR1bW15ICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRzdG9wOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdHZhciBhbmltYXRpb247XG5cdFx0XHRcdFx0XHR3aGlsZSAoIGFuaW1hdGlvbiA9IGFuaW1hdGlvbnMucG9wKCkgKSB7XG5cdFx0XHRcdFx0XHRcdGFuaW1hdGlvbi5zdG9wKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoIGR1bW15ICkge1xuXHRcdFx0XHRcdFx0XHRkdW1teS5zdG9wKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdFx0b3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cdFx0XHRpZiAoIG9wdGlvbnMuY29tcGxldGUgKSB7XG5cdFx0XHRcdHByb21pc2UudGhlbiggb3B0aW9ucy5jb21wbGV0ZSApO1xuXHRcdFx0fVxuXHRcdFx0b3B0aW9ucy5jb21wbGV0ZSA9IGZ1bGZpbFByb21pc2U7XG5cdFx0XHRhbmltYXRpb24gPSBhbmltYXRlKCB0aGlzLCBrZXlwYXRoLCB0bywgb3B0aW9ucyApO1xuXHRcdFx0cHJvbWlzZS5zdG9wID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGFuaW1hdGlvbi5zdG9wKCk7XG5cdFx0XHR9O1xuXHRcdFx0cmV0dXJuIHByb21pc2U7XG5cdFx0fTtcblxuXHRcdGZ1bmN0aW9uIGFuaW1hdGUoIHJvb3QsIGtleXBhdGgsIHRvLCBvcHRpb25zICkge1xuXHRcdFx0dmFyIGVhc2luZywgZHVyYXRpb24sIGFuaW1hdGlvbiwgZnJvbTtcblx0XHRcdGlmICgga2V5cGF0aCApIHtcblx0XHRcdFx0a2V5cGF0aCA9IG5vcm1hbGlzZUtleXBhdGgoIGtleXBhdGggKTtcblx0XHRcdH1cblx0XHRcdGlmICgga2V5cGF0aCAhPT0gbnVsbCApIHtcblx0XHRcdFx0ZnJvbSA9IGdldCggcm9vdCwga2V5cGF0aCApO1xuXHRcdFx0fVxuXHRcdFx0YW5pbWF0aW9ucy5hYm9ydCgga2V5cGF0aCwgcm9vdCApO1xuXHRcdFx0aWYgKCBpc0VxdWFsKCBmcm9tLCB0byApICkge1xuXHRcdFx0XHRpZiAoIG9wdGlvbnMuY29tcGxldGUgKSB7XG5cdFx0XHRcdFx0b3B0aW9ucy5jb21wbGV0ZSggb3B0aW9ucy50byApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBub0FuaW1hdGlvbjtcblx0XHRcdH1cblx0XHRcdGlmICggb3B0aW9ucy5lYXNpbmcgKSB7XG5cdFx0XHRcdGlmICggdHlwZW9mIG9wdGlvbnMuZWFzaW5nID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0XHRcdGVhc2luZyA9IG9wdGlvbnMuZWFzaW5nO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGVhc2luZyA9IHJvb3QuZWFzaW5nWyBvcHRpb25zLmVhc2luZyBdO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggdHlwZW9mIGVhc2luZyAhPT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdFx0XHRlYXNpbmcgPSBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRkdXJhdGlvbiA9IG9wdGlvbnMuZHVyYXRpb24gPT09IHVuZGVmaW5lZCA/IDQwMCA6IG9wdGlvbnMuZHVyYXRpb247XG5cdFx0XHRhbmltYXRpb24gPSBuZXcgQW5pbWF0aW9uKCB7XG5cdFx0XHRcdGtleXBhdGg6IGtleXBhdGgsXG5cdFx0XHRcdGZyb206IGZyb20sXG5cdFx0XHRcdHRvOiB0byxcblx0XHRcdFx0cm9vdDogcm9vdCxcblx0XHRcdFx0ZHVyYXRpb246IGR1cmF0aW9uLFxuXHRcdFx0XHRlYXNpbmc6IGVhc2luZyxcblx0XHRcdFx0aW50ZXJwb2xhdG9yOiBvcHRpb25zLmludGVycG9sYXRvcixcblx0XHRcdFx0c3RlcDogb3B0aW9ucy5zdGVwLFxuXHRcdFx0XHRjb21wbGV0ZTogb3B0aW9ucy5jb21wbGV0ZVxuXHRcdFx0fSApO1xuXHRcdFx0YW5pbWF0aW9ucy5hZGQoIGFuaW1hdGlvbiApO1xuXHRcdFx0cm9vdC5fYW5pbWF0aW9ucy5wdXNoKCBhbmltYXRpb24gKTtcblx0XHRcdHJldHVybiBhbmltYXRpb247XG5cdFx0fVxuXHR9KCB1dGlsc19pc0VxdWFsLCB1dGlsc19Qcm9taXNlLCB1dGlsc19ub3JtYWxpc2VLZXlwYXRoLCBzaGFyZWRfYW5pbWF0aW9ucywgc2hhcmVkX2dldF9fZ2V0LCBSYWN0aXZlX3Byb3RvdHlwZV9hbmltYXRlX0FuaW1hdGlvbiApO1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9kZXRhY2ggPSBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5mcmFnbWVudC5kZXRhY2goKTtcblx0fTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfZmluZCA9IGZ1bmN0aW9uKCBzZWxlY3RvciApIHtcblx0XHRpZiAoICF0aGlzLmVsICkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLmZyYWdtZW50LmZpbmQoIHNlbGVjdG9yICk7XG5cdH07XG5cblx0dmFyIHV0aWxzX21hdGNoZXMgPSBmdW5jdGlvbiggaXNDbGllbnQsIHZlbmRvcnMsIGNyZWF0ZUVsZW1lbnQgKSB7XG5cblx0XHR2YXIgZGl2LCBtZXRob2ROYW1lcywgdW5wcmVmaXhlZCwgcHJlZml4ZWQsIGksIGosIG1ha2VGdW5jdGlvbjtcblx0XHRpZiAoICFpc0NsaWVudCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0ZGl2ID0gY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcblx0XHRtZXRob2ROYW1lcyA9IFtcblx0XHRcdCdtYXRjaGVzJyxcblx0XHRcdCdtYXRjaGVzU2VsZWN0b3InXG5cdFx0XTtcblx0XHRtYWtlRnVuY3Rpb24gPSBmdW5jdGlvbiggbWV0aG9kTmFtZSApIHtcblx0XHRcdHJldHVybiBmdW5jdGlvbiggbm9kZSwgc2VsZWN0b3IgKSB7XG5cdFx0XHRcdHJldHVybiBub2RlWyBtZXRob2ROYW1lIF0oIHNlbGVjdG9yICk7XG5cdFx0XHR9O1xuXHRcdH07XG5cdFx0aSA9IG1ldGhvZE5hbWVzLmxlbmd0aDtcblx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdHVucHJlZml4ZWQgPSBtZXRob2ROYW1lc1sgaSBdO1xuXHRcdFx0aWYgKCBkaXZbIHVucHJlZml4ZWQgXSApIHtcblx0XHRcdFx0cmV0dXJuIG1ha2VGdW5jdGlvbiggdW5wcmVmaXhlZCApO1xuXHRcdFx0fVxuXHRcdFx0aiA9IHZlbmRvcnMubGVuZ3RoO1xuXHRcdFx0d2hpbGUgKCBqLS0gKSB7XG5cdFx0XHRcdHByZWZpeGVkID0gdmVuZG9yc1sgaSBdICsgdW5wcmVmaXhlZC5zdWJzdHIoIDAsIDEgKS50b1VwcGVyQ2FzZSgpICsgdW5wcmVmaXhlZC5zdWJzdHJpbmcoIDEgKTtcblx0XHRcdFx0aWYgKCBkaXZbIHByZWZpeGVkIF0gKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG1ha2VGdW5jdGlvbiggcHJlZml4ZWQgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gZnVuY3Rpb24oIG5vZGUsIHNlbGVjdG9yICkge1xuXHRcdFx0dmFyIG5vZGVzLCBpO1xuXHRcdFx0bm9kZXMgPSAoIG5vZGUucGFyZW50Tm9kZSB8fCBub2RlLmRvY3VtZW50ICkucXVlcnlTZWxlY3RvckFsbCggc2VsZWN0b3IgKTtcblx0XHRcdGkgPSBub2Rlcy5sZW5ndGg7XG5cdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0aWYgKCBub2Rlc1sgaSBdID09PSBub2RlICkge1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fTtcblx0fSggY29uZmlnX2lzQ2xpZW50LCBjb25maWdfdmVuZG9ycywgdXRpbHNfY3JlYXRlRWxlbWVudCApO1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9zaGFyZWRfbWFrZVF1ZXJ5X3Rlc3QgPSBmdW5jdGlvbiggbWF0Y2hlcyApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggaXRlbSwgbm9EaXJ0eSApIHtcblx0XHRcdHZhciBpdGVtTWF0Y2hlcyA9IHRoaXMuX2lzQ29tcG9uZW50UXVlcnkgPyAhdGhpcy5zZWxlY3RvciB8fCBpdGVtLm5hbWUgPT09IHRoaXMuc2VsZWN0b3IgOiBtYXRjaGVzKCBpdGVtLm5vZGUsIHRoaXMuc2VsZWN0b3IgKTtcblx0XHRcdGlmICggaXRlbU1hdGNoZXMgKSB7XG5cdFx0XHRcdHRoaXMucHVzaCggaXRlbS5ub2RlIHx8IGl0ZW0uaW5zdGFuY2UgKTtcblx0XHRcdFx0aWYgKCAhbm9EaXJ0eSApIHtcblx0XHRcdFx0XHR0aGlzLl9tYWtlRGlydHkoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9O1xuXHR9KCB1dGlsc19tYXRjaGVzICk7XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX3NoYXJlZF9tYWtlUXVlcnlfY2FuY2VsID0gZnVuY3Rpb24oKSB7XG5cdFx0dmFyIGxpdmVRdWVyaWVzLCBzZWxlY3RvciwgaW5kZXg7XG5cdFx0bGl2ZVF1ZXJpZXMgPSB0aGlzLl9yb290WyB0aGlzLl9pc0NvbXBvbmVudFF1ZXJ5ID8gJ2xpdmVDb21wb25lbnRRdWVyaWVzJyA6ICdsaXZlUXVlcmllcycgXTtcblx0XHRzZWxlY3RvciA9IHRoaXMuc2VsZWN0b3I7XG5cdFx0aW5kZXggPSBsaXZlUXVlcmllcy5pbmRleE9mKCBzZWxlY3RvciApO1xuXHRcdGlmICggaW5kZXggIT09IC0xICkge1xuXHRcdFx0bGl2ZVF1ZXJpZXMuc3BsaWNlKCBpbmRleCwgMSApO1xuXHRcdFx0bGl2ZVF1ZXJpZXNbIHNlbGVjdG9yIF0gPSBudWxsO1xuXHRcdH1cblx0fTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfc2hhcmVkX21ha2VRdWVyeV9zb3J0QnlJdGVtUG9zaXRpb24gPSBmdW5jdGlvbigpIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggYSwgYiApIHtcblx0XHRcdHZhciBhbmNlc3RyeUEsIGFuY2VzdHJ5Qiwgb2xkZXN0QSwgb2xkZXN0QiwgbXV0dWFsQW5jZXN0b3IsIGluZGV4QSwgaW5kZXhCLCBmcmFnbWVudHMsIGZyYWdtZW50QSwgZnJhZ21lbnRCO1xuXHRcdFx0YW5jZXN0cnlBID0gZ2V0QW5jZXN0cnkoIGEuY29tcG9uZW50IHx8IGEuX3JhY3RpdmUucHJveHkgKTtcblx0XHRcdGFuY2VzdHJ5QiA9IGdldEFuY2VzdHJ5KCBiLmNvbXBvbmVudCB8fCBiLl9yYWN0aXZlLnByb3h5ICk7XG5cdFx0XHRvbGRlc3RBID0gYW5jZXN0cnlBWyBhbmNlc3RyeUEubGVuZ3RoIC0gMSBdO1xuXHRcdFx0b2xkZXN0QiA9IGFuY2VzdHJ5QlsgYW5jZXN0cnlCLmxlbmd0aCAtIDEgXTtcblx0XHRcdHdoaWxlICggb2xkZXN0QSAmJiBvbGRlc3RBID09PSBvbGRlc3RCICkge1xuXHRcdFx0XHRhbmNlc3RyeUEucG9wKCk7XG5cdFx0XHRcdGFuY2VzdHJ5Qi5wb3AoKTtcblx0XHRcdFx0bXV0dWFsQW5jZXN0b3IgPSBvbGRlc3RBO1xuXHRcdFx0XHRvbGRlc3RBID0gYW5jZXN0cnlBWyBhbmNlc3RyeUEubGVuZ3RoIC0gMSBdO1xuXHRcdFx0XHRvbGRlc3RCID0gYW5jZXN0cnlCWyBhbmNlc3RyeUIubGVuZ3RoIC0gMSBdO1xuXHRcdFx0fVxuXHRcdFx0b2xkZXN0QSA9IG9sZGVzdEEuY29tcG9uZW50IHx8IG9sZGVzdEE7XG5cdFx0XHRvbGRlc3RCID0gb2xkZXN0Qi5jb21wb25lbnQgfHwgb2xkZXN0Qjtcblx0XHRcdGZyYWdtZW50QSA9IG9sZGVzdEEucGFyZW50RnJhZ21lbnQ7XG5cdFx0XHRmcmFnbWVudEIgPSBvbGRlc3RCLnBhcmVudEZyYWdtZW50O1xuXHRcdFx0aWYgKCBmcmFnbWVudEEgPT09IGZyYWdtZW50QiApIHtcblx0XHRcdFx0aW5kZXhBID0gZnJhZ21lbnRBLml0ZW1zLmluZGV4T2YoIG9sZGVzdEEgKTtcblx0XHRcdFx0aW5kZXhCID0gZnJhZ21lbnRCLml0ZW1zLmluZGV4T2YoIG9sZGVzdEIgKTtcblx0XHRcdFx0cmV0dXJuIGluZGV4QSAtIGluZGV4QiB8fCBhbmNlc3RyeUEubGVuZ3RoIC0gYW5jZXN0cnlCLmxlbmd0aDtcblx0XHRcdH1cblx0XHRcdGlmICggZnJhZ21lbnRzID0gbXV0dWFsQW5jZXN0b3IuZnJhZ21lbnRzICkge1xuXHRcdFx0XHRpbmRleEEgPSBmcmFnbWVudHMuaW5kZXhPZiggZnJhZ21lbnRBICk7XG5cdFx0XHRcdGluZGV4QiA9IGZyYWdtZW50cy5pbmRleE9mKCBmcmFnbWVudEIgKTtcblx0XHRcdFx0cmV0dXJuIGluZGV4QSAtIGluZGV4QiB8fCBhbmNlc3RyeUEubGVuZ3RoIC0gYW5jZXN0cnlCLmxlbmd0aDtcblx0XHRcdH1cblx0XHRcdHRocm93IG5ldyBFcnJvciggJ0FuIHVuZXhwZWN0ZWQgY29uZGl0aW9uIHdhcyBtZXQgd2hpbGUgY29tcGFyaW5nIHRoZSBwb3NpdGlvbiBvZiB0d28gY29tcG9uZW50cy4gUGxlYXNlIGZpbGUgYW4gaXNzdWUgYXQgaHR0cHM6Ly9naXRodWIuY29tL1JhY3RpdmVKUy9SYWN0aXZlL2lzc3VlcyAtIHRoYW5rcyEnICk7XG5cdFx0fTtcblxuXHRcdGZ1bmN0aW9uIGdldFBhcmVudCggaXRlbSApIHtcblx0XHRcdHZhciBwYXJlbnRGcmFnbWVudDtcblx0XHRcdGlmICggcGFyZW50RnJhZ21lbnQgPSBpdGVtLnBhcmVudEZyYWdtZW50ICkge1xuXHRcdFx0XHRyZXR1cm4gcGFyZW50RnJhZ21lbnQub3duZXI7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGl0ZW0uY29tcG9uZW50ICYmICggcGFyZW50RnJhZ21lbnQgPSBpdGVtLmNvbXBvbmVudC5wYXJlbnRGcmFnbWVudCApICkge1xuXHRcdFx0XHRyZXR1cm4gcGFyZW50RnJhZ21lbnQub3duZXI7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0QW5jZXN0cnkoIGl0ZW0gKSB7XG5cdFx0XHR2YXIgYW5jZXN0cnksIGFuY2VzdG9yO1xuXHRcdFx0YW5jZXN0cnkgPSBbIGl0ZW0gXTtcblx0XHRcdGFuY2VzdG9yID0gZ2V0UGFyZW50KCBpdGVtICk7XG5cdFx0XHR3aGlsZSAoIGFuY2VzdG9yICkge1xuXHRcdFx0XHRhbmNlc3RyeS5wdXNoKCBhbmNlc3RvciApO1xuXHRcdFx0XHRhbmNlc3RvciA9IGdldFBhcmVudCggYW5jZXN0b3IgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBhbmNlc3RyeTtcblx0XHR9XG5cdH0oKTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfc2hhcmVkX21ha2VRdWVyeV9zb3J0QnlEb2N1bWVudFBvc2l0aW9uID0gZnVuY3Rpb24oIHNvcnRCeUl0ZW1Qb3NpdGlvbiApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggbm9kZSwgb3RoZXJOb2RlICkge1xuXHRcdFx0dmFyIGJpdG1hc2s7XG5cdFx0XHRpZiAoIG5vZGUuY29tcGFyZURvY3VtZW50UG9zaXRpb24gKSB7XG5cdFx0XHRcdGJpdG1hc2sgPSBub2RlLmNvbXBhcmVEb2N1bWVudFBvc2l0aW9uKCBvdGhlck5vZGUgKTtcblx0XHRcdFx0cmV0dXJuIGJpdG1hc2sgJiAyID8gMSA6IC0xO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHNvcnRCeUl0ZW1Qb3NpdGlvbiggbm9kZSwgb3RoZXJOb2RlICk7XG5cdFx0fTtcblx0fSggUmFjdGl2ZV9wcm90b3R5cGVfc2hhcmVkX21ha2VRdWVyeV9zb3J0QnlJdGVtUG9zaXRpb24gKTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfc2hhcmVkX21ha2VRdWVyeV9zb3J0ID0gZnVuY3Rpb24oIHNvcnRCeURvY3VtZW50UG9zaXRpb24sIHNvcnRCeUl0ZW1Qb3NpdGlvbiApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuc29ydCggdGhpcy5faXNDb21wb25lbnRRdWVyeSA/IHNvcnRCeUl0ZW1Qb3NpdGlvbiA6IHNvcnRCeURvY3VtZW50UG9zaXRpb24gKTtcblx0XHRcdHRoaXMuX2RpcnR5ID0gZmFsc2U7XG5cdFx0fTtcblx0fSggUmFjdGl2ZV9wcm90b3R5cGVfc2hhcmVkX21ha2VRdWVyeV9zb3J0QnlEb2N1bWVudFBvc2l0aW9uLCBSYWN0aXZlX3Byb3RvdHlwZV9zaGFyZWRfbWFrZVF1ZXJ5X3NvcnRCeUl0ZW1Qb3NpdGlvbiApO1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9zaGFyZWRfbWFrZVF1ZXJ5X2RpcnR5ID0gZnVuY3Rpb24oIHJ1bmxvb3AgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFx0XHRpZiAoICF0aGlzLl9kaXJ0eSApIHtcblx0XHRcdFx0cnVubG9vcC5hZGRMaXZlUXVlcnkoIHRoaXMgKTtcblx0XHRcdFx0dGhpcy5fZGlydHkgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdH07XG5cdH0oIGdsb2JhbF9ydW5sb29wICk7XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX3NoYXJlZF9tYWtlUXVlcnlfcmVtb3ZlID0gZnVuY3Rpb24oIG5vZGVPckNvbXBvbmVudCApIHtcblx0XHR2YXIgaW5kZXggPSB0aGlzLmluZGV4T2YoIHRoaXMuX2lzQ29tcG9uZW50UXVlcnkgPyBub2RlT3JDb21wb25lbnQuaW5zdGFuY2UgOiBub2RlT3JDb21wb25lbnQgKTtcblx0XHRpZiAoIGluZGV4ICE9PSAtMSApIHtcblx0XHRcdHRoaXMuc3BsaWNlKCBpbmRleCwgMSApO1xuXHRcdH1cblx0fTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfc2hhcmVkX21ha2VRdWVyeV9fbWFrZVF1ZXJ5ID0gZnVuY3Rpb24oIGRlZmluZVByb3BlcnRpZXMsIHRlc3QsIGNhbmNlbCwgc29ydCwgZGlydHksIHJlbW92ZSApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggcmFjdGl2ZSwgc2VsZWN0b3IsIGxpdmUsIGlzQ29tcG9uZW50UXVlcnkgKSB7XG5cdFx0XHR2YXIgcXVlcnkgPSBbXTtcblx0XHRcdGRlZmluZVByb3BlcnRpZXMoIHF1ZXJ5LCB7XG5cdFx0XHRcdHNlbGVjdG9yOiB7XG5cdFx0XHRcdFx0dmFsdWU6IHNlbGVjdG9yXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGxpdmU6IHtcblx0XHRcdFx0XHR2YWx1ZTogbGl2ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRfaXNDb21wb25lbnRRdWVyeToge1xuXHRcdFx0XHRcdHZhbHVlOiBpc0NvbXBvbmVudFF1ZXJ5XG5cdFx0XHRcdH0sXG5cdFx0XHRcdF90ZXN0OiB7XG5cdFx0XHRcdFx0dmFsdWU6IHRlc3Rcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCAhbGl2ZSApIHtcblx0XHRcdFx0cmV0dXJuIHF1ZXJ5O1xuXHRcdFx0fVxuXHRcdFx0ZGVmaW5lUHJvcGVydGllcyggcXVlcnksIHtcblx0XHRcdFx0Y2FuY2VsOiB7XG5cdFx0XHRcdFx0dmFsdWU6IGNhbmNlbFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRfcm9vdDoge1xuXHRcdFx0XHRcdHZhbHVlOiByYWN0aXZlXG5cdFx0XHRcdH0sXG5cdFx0XHRcdF9zb3J0OiB7XG5cdFx0XHRcdFx0dmFsdWU6IHNvcnRcblx0XHRcdFx0fSxcblx0XHRcdFx0X21ha2VEaXJ0eToge1xuXHRcdFx0XHRcdHZhbHVlOiBkaXJ0eVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRfcmVtb3ZlOiB7XG5cdFx0XHRcdFx0dmFsdWU6IHJlbW92ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRfZGlydHk6IHtcblx0XHRcdFx0XHR2YWx1ZTogZmFsc2UsXG5cdFx0XHRcdFx0d3JpdGFibGU6IHRydWVcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0cmV0dXJuIHF1ZXJ5O1xuXHRcdH07XG5cdH0oIHV0aWxzX2RlZmluZVByb3BlcnRpZXMsIFJhY3RpdmVfcHJvdG90eXBlX3NoYXJlZF9tYWtlUXVlcnlfdGVzdCwgUmFjdGl2ZV9wcm90b3R5cGVfc2hhcmVkX21ha2VRdWVyeV9jYW5jZWwsIFJhY3RpdmVfcHJvdG90eXBlX3NoYXJlZF9tYWtlUXVlcnlfc29ydCwgUmFjdGl2ZV9wcm90b3R5cGVfc2hhcmVkX21ha2VRdWVyeV9kaXJ0eSwgUmFjdGl2ZV9wcm90b3R5cGVfc2hhcmVkX21ha2VRdWVyeV9yZW1vdmUgKTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfZmluZEFsbCA9IGZ1bmN0aW9uKCBtYWtlUXVlcnkgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHNlbGVjdG9yLCBvcHRpb25zICkge1xuXHRcdFx0dmFyIGxpdmVRdWVyaWVzLCBxdWVyeTtcblx0XHRcdGlmICggIXRoaXMuZWwgKSB7XG5cdFx0XHRcdHJldHVybiBbXTtcblx0XHRcdH1cblx0XHRcdG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXHRcdFx0bGl2ZVF1ZXJpZXMgPSB0aGlzLl9saXZlUXVlcmllcztcblx0XHRcdGlmICggcXVlcnkgPSBsaXZlUXVlcmllc1sgc2VsZWN0b3IgXSApIHtcblx0XHRcdFx0cmV0dXJuIG9wdGlvbnMgJiYgb3B0aW9ucy5saXZlID8gcXVlcnkgOiBxdWVyeS5zbGljZSgpO1xuXHRcdFx0fVxuXHRcdFx0cXVlcnkgPSBtYWtlUXVlcnkoIHRoaXMsIHNlbGVjdG9yLCAhISBvcHRpb25zLmxpdmUsIGZhbHNlICk7XG5cdFx0XHRpZiAoIHF1ZXJ5LmxpdmUgKSB7XG5cdFx0XHRcdGxpdmVRdWVyaWVzLnB1c2goIHNlbGVjdG9yICk7XG5cdFx0XHRcdGxpdmVRdWVyaWVzWyBzZWxlY3RvciBdID0gcXVlcnk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmZyYWdtZW50LmZpbmRBbGwoIHNlbGVjdG9yLCBxdWVyeSApO1xuXHRcdFx0cmV0dXJuIHF1ZXJ5O1xuXHRcdH07XG5cdH0oIFJhY3RpdmVfcHJvdG90eXBlX3NoYXJlZF9tYWtlUXVlcnlfX21ha2VRdWVyeSApO1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9maW5kQWxsQ29tcG9uZW50cyA9IGZ1bmN0aW9uKCBtYWtlUXVlcnkgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHNlbGVjdG9yLCBvcHRpb25zICkge1xuXHRcdFx0dmFyIGxpdmVRdWVyaWVzLCBxdWVyeTtcblx0XHRcdG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXHRcdFx0bGl2ZVF1ZXJpZXMgPSB0aGlzLl9saXZlQ29tcG9uZW50UXVlcmllcztcblx0XHRcdGlmICggcXVlcnkgPSBsaXZlUXVlcmllc1sgc2VsZWN0b3IgXSApIHtcblx0XHRcdFx0cmV0dXJuIG9wdGlvbnMgJiYgb3B0aW9ucy5saXZlID8gcXVlcnkgOiBxdWVyeS5zbGljZSgpO1xuXHRcdFx0fVxuXHRcdFx0cXVlcnkgPSBtYWtlUXVlcnkoIHRoaXMsIHNlbGVjdG9yLCAhISBvcHRpb25zLmxpdmUsIHRydWUgKTtcblx0XHRcdGlmICggcXVlcnkubGl2ZSApIHtcblx0XHRcdFx0bGl2ZVF1ZXJpZXMucHVzaCggc2VsZWN0b3IgKTtcblx0XHRcdFx0bGl2ZVF1ZXJpZXNbIHNlbGVjdG9yIF0gPSBxdWVyeTtcblx0XHRcdH1cblx0XHRcdHRoaXMuZnJhZ21lbnQuZmluZEFsbENvbXBvbmVudHMoIHNlbGVjdG9yLCBxdWVyeSApO1xuXHRcdFx0cmV0dXJuIHF1ZXJ5O1xuXHRcdH07XG5cdH0oIFJhY3RpdmVfcHJvdG90eXBlX3NoYXJlZF9tYWtlUXVlcnlfX21ha2VRdWVyeSApO1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9maW5kQ29tcG9uZW50ID0gZnVuY3Rpb24oIHNlbGVjdG9yICkge1xuXHRcdHJldHVybiB0aGlzLmZyYWdtZW50LmZpbmRDb21wb25lbnQoIHNlbGVjdG9yICk7XG5cdH07XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX2ZpcmUgPSBmdW5jdGlvbiggZXZlbnROYW1lICkge1xuXHRcdHZhciBhcmdzLCBpLCBsZW4sIHN1YnNjcmliZXJzID0gdGhpcy5fc3Vic1sgZXZlbnROYW1lIF07XG5cdFx0aWYgKCAhc3Vic2NyaWJlcnMgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCggYXJndW1lbnRzLCAxICk7XG5cdFx0Zm9yICggaSA9IDAsIGxlbiA9IHN1YnNjcmliZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0c3Vic2NyaWJlcnNbIGkgXS5hcHBseSggdGhpcywgYXJncyApO1xuXHRcdH1cblx0fTtcblxuXHR2YXIgc2hhcmVkX2dldF9VbnJlc29sdmVkSW1wbGljaXREZXBlbmRlbmN5ID0gZnVuY3Rpb24oIGNpcmN1bGFyLCByZW1vdmVGcm9tQXJyYXksIHJ1bmxvb3AsIG5vdGlmeURlcGVuZGFudHMgKSB7XG5cblx0XHR2YXIgZ2V0LCBlbXB0eSA9IHt9O1xuXHRcdGNpcmN1bGFyLnB1c2goIGZ1bmN0aW9uKCkge1xuXHRcdFx0Z2V0ID0gY2lyY3VsYXIuZ2V0O1xuXHRcdH0gKTtcblx0XHR2YXIgVW5yZXNvbHZlZEltcGxpY2l0RGVwZW5kZW5jeSA9IGZ1bmN0aW9uKCByYWN0aXZlLCBrZXlwYXRoICkge1xuXHRcdFx0dGhpcy5yb290ID0gcmFjdGl2ZTtcblx0XHRcdHRoaXMucmVmID0ga2V5cGF0aDtcblx0XHRcdHRoaXMucGFyZW50RnJhZ21lbnQgPSBlbXB0eTtcblx0XHRcdHJhY3RpdmUuX3VucmVzb2x2ZWRJbXBsaWNpdERlcGVuZGVuY2llc1sga2V5cGF0aCBdID0gdHJ1ZTtcblx0XHRcdHJhY3RpdmUuX3VucmVzb2x2ZWRJbXBsaWNpdERlcGVuZGVuY2llcy5wdXNoKCB0aGlzICk7XG5cdFx0XHRydW5sb29wLmFkZFVucmVzb2x2ZWQoIHRoaXMgKTtcblx0XHR9O1xuXHRcdFVucmVzb2x2ZWRJbXBsaWNpdERlcGVuZGVuY3kucHJvdG90eXBlID0ge1xuXHRcdFx0cmVzb2x2ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciByYWN0aXZlID0gdGhpcy5yb290O1xuXHRcdFx0XHRub3RpZnlEZXBlbmRhbnRzKCByYWN0aXZlLCB0aGlzLnJlZiApO1xuXHRcdFx0XHRyYWN0aXZlLl91bnJlc29sdmVkSW1wbGljaXREZXBlbmRlbmNpZXNbIHRoaXMucmVmIF0gPSBmYWxzZTtcblx0XHRcdFx0cmVtb3ZlRnJvbUFycmF5KCByYWN0aXZlLl91bnJlc29sdmVkSW1wbGljaXREZXBlbmRlbmNpZXMsIHRoaXMgKTtcblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJ1bmxvb3AucmVtb3ZlVW5yZXNvbHZlZCggdGhpcyApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIFVucmVzb2x2ZWRJbXBsaWNpdERlcGVuZGVuY3k7XG5cdH0oIGNpcmN1bGFyLCB1dGlsc19yZW1vdmVGcm9tQXJyYXksIGdsb2JhbF9ydW5sb29wLCBzaGFyZWRfbm90aWZ5RGVwZW5kYW50cyApO1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9nZXQgPSBmdW5jdGlvbiggbm9ybWFsaXNlS2V5cGF0aCwgZ2V0LCBVbnJlc29sdmVkSW1wbGljaXREZXBlbmRlbmN5ICkge1xuXG5cdFx0dmFyIG9wdGlvbnMgPSB7XG5cdFx0XHRpc1RvcExldmVsOiB0cnVlXG5cdFx0fTtcblx0XHRyZXR1cm4gZnVuY3Rpb24gUmFjdGl2ZV9wcm90b3R5cGVfZ2V0KCBrZXlwYXRoICkge1xuXHRcdFx0dmFyIHZhbHVlO1xuXHRcdFx0a2V5cGF0aCA9IG5vcm1hbGlzZUtleXBhdGgoIGtleXBhdGggKTtcblx0XHRcdHZhbHVlID0gZ2V0KCB0aGlzLCBrZXlwYXRoLCBvcHRpb25zICk7XG5cdFx0XHRpZiAoIHRoaXMuX2NhcHR1cmVkICYmIHRoaXMuX2NhcHR1cmVkWyBrZXlwYXRoIF0gIT09IHRydWUgKSB7XG5cdFx0XHRcdHRoaXMuX2NhcHR1cmVkLnB1c2goIGtleXBhdGggKTtcblx0XHRcdFx0dGhpcy5fY2FwdHVyZWRbIGtleXBhdGggXSA9IHRydWU7XG5cdFx0XHRcdGlmICggdmFsdWUgPT09IHVuZGVmaW5lZCAmJiB0aGlzLl91bnJlc29sdmVkSW1wbGljaXREZXBlbmRlbmNpZXNbIGtleXBhdGggXSAhPT0gdHJ1ZSApIHtcblx0XHRcdFx0XHRuZXcgVW5yZXNvbHZlZEltcGxpY2l0RGVwZW5kZW5jeSggdGhpcywga2V5cGF0aCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0fTtcblx0fSggdXRpbHNfbm9ybWFsaXNlS2V5cGF0aCwgc2hhcmVkX2dldF9fZ2V0LCBzaGFyZWRfZ2V0X1VucmVzb2x2ZWRJbXBsaWNpdERlcGVuZGVuY3kgKTtcblxuXHR2YXIgdXRpbHNfZ2V0RWxlbWVudCA9IGZ1bmN0aW9uKCBpbnB1dCApIHtcblx0XHR2YXIgb3V0cHV0O1xuXHRcdGlmICggdHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcgfHwgIWRvY3VtZW50IHx8ICFpbnB1dCApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRpZiAoIGlucHV0Lm5vZGVUeXBlICkge1xuXHRcdFx0cmV0dXJuIGlucHV0O1xuXHRcdH1cblx0XHRpZiAoIHR5cGVvZiBpbnB1dCA9PT0gJ3N0cmluZycgKSB7XG5cdFx0XHRvdXRwdXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggaW5wdXQgKTtcblx0XHRcdGlmICggIW91dHB1dCAmJiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yICkge1xuXHRcdFx0XHRvdXRwdXQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCBpbnB1dCApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBvdXRwdXQgJiYgb3V0cHV0Lm5vZGVUeXBlICkge1xuXHRcdFx0XHRyZXR1cm4gb3V0cHV0O1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoIGlucHV0WyAwIF0gJiYgaW5wdXRbIDAgXS5ub2RlVHlwZSApIHtcblx0XHRcdHJldHVybiBpbnB1dFsgMCBdO1xuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfaW5zZXJ0ID0gZnVuY3Rpb24oIGdldEVsZW1lbnQgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHRhcmdldCwgYW5jaG9yICkge1xuXHRcdFx0dGFyZ2V0ID0gZ2V0RWxlbWVudCggdGFyZ2V0ICk7XG5cdFx0XHRhbmNob3IgPSBnZXRFbGVtZW50KCBhbmNob3IgKSB8fCBudWxsO1xuXHRcdFx0aWYgKCAhdGFyZ2V0ICkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdZb3UgbXVzdCBzcGVjaWZ5IGEgdmFsaWQgdGFyZ2V0IHRvIGluc2VydCBpbnRvJyApO1xuXHRcdFx0fVxuXHRcdFx0dGFyZ2V0Lmluc2VydEJlZm9yZSggdGhpcy5kZXRhY2goKSwgYW5jaG9yICk7XG5cdFx0XHR0aGlzLmZyYWdtZW50LnBOb2RlID0gdGhpcy5lbCA9IHRhcmdldDtcblx0XHR9O1xuXHR9KCB1dGlsc19nZXRFbGVtZW50ICk7XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX21lcmdlX21hcE9sZFRvTmV3SW5kZXggPSBmdW5jdGlvbiggb2xkQXJyYXksIG5ld0FycmF5ICkge1xuXHRcdHZhciB1c2VkSW5kaWNlcywgZmlyc3RVbnVzZWRJbmRleCwgbmV3SW5kaWNlcywgY2hhbmdlZDtcblx0XHR1c2VkSW5kaWNlcyA9IHt9O1xuXHRcdGZpcnN0VW51c2VkSW5kZXggPSAwO1xuXHRcdG5ld0luZGljZXMgPSBvbGRBcnJheS5tYXAoIGZ1bmN0aW9uKCBpdGVtLCBpICkge1xuXHRcdFx0dmFyIGluZGV4LCBzdGFydCwgbGVuO1xuXHRcdFx0c3RhcnQgPSBmaXJzdFVudXNlZEluZGV4O1xuXHRcdFx0bGVuID0gbmV3QXJyYXkubGVuZ3RoO1xuXHRcdFx0ZG8ge1xuXHRcdFx0XHRpbmRleCA9IG5ld0FycmF5LmluZGV4T2YoIGl0ZW0sIHN0YXJ0ICk7XG5cdFx0XHRcdGlmICggaW5kZXggPT09IC0xICkge1xuXHRcdFx0XHRcdGNoYW5nZWQgPSB0cnVlO1xuXHRcdFx0XHRcdHJldHVybiAtMTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzdGFydCA9IGluZGV4ICsgMTtcblx0XHRcdH0gd2hpbGUgKCB1c2VkSW5kaWNlc1sgaW5kZXggXSAmJiBzdGFydCA8IGxlbiApO1xuXHRcdFx0aWYgKCBpbmRleCA9PT0gZmlyc3RVbnVzZWRJbmRleCApIHtcblx0XHRcdFx0Zmlyc3RVbnVzZWRJbmRleCArPSAxO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBpbmRleCAhPT0gaSApIHtcblx0XHRcdFx0Y2hhbmdlZCA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHR1c2VkSW5kaWNlc1sgaW5kZXggXSA9IHRydWU7XG5cdFx0XHRyZXR1cm4gaW5kZXg7XG5cdFx0fSApO1xuXHRcdG5ld0luZGljZXMudW5jaGFuZ2VkID0gIWNoYW5nZWQ7XG5cdFx0cmV0dXJuIG5ld0luZGljZXM7XG5cdH07XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX21lcmdlX3Byb3BhZ2F0ZUNoYW5nZXMgPSBmdW5jdGlvbiggdHlwZXMsIG5vdGlmeURlcGVuZGFudHMgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHJhY3RpdmUsIGtleXBhdGgsIG5ld0luZGljZXMsIGxlbmd0aFVuY2hhbmdlZCApIHtcblx0XHRcdHZhciB1cGRhdGVEZXBlbmRhbnQ7XG5cdFx0XHRyYWN0aXZlLl9jaGFuZ2VzLnB1c2goIGtleXBhdGggKTtcblx0XHRcdHVwZGF0ZURlcGVuZGFudCA9IGZ1bmN0aW9uKCBkZXBlbmRhbnQgKSB7XG5cdFx0XHRcdGlmICggZGVwZW5kYW50LnR5cGUgPT09IHR5cGVzLlJFRkVSRU5DRSApIHtcblx0XHRcdFx0XHRkZXBlbmRhbnQudXBkYXRlKCk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoIGRlcGVuZGFudC5rZXlwYXRoID09PSBrZXlwYXRoICYmIGRlcGVuZGFudC50eXBlID09PSB0eXBlcy5TRUNUSU9OICYmICFkZXBlbmRhbnQuaW52ZXJ0ZWQgJiYgZGVwZW5kYW50LmRvY0ZyYWcgKSB7XG5cdFx0XHRcdFx0ZGVwZW5kYW50Lm1lcmdlKCBuZXdJbmRpY2VzICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZGVwZW5kYW50LnVwZGF0ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdFx0cmFjdGl2ZS5fZGVwcy5mb3JFYWNoKCBmdW5jdGlvbiggZGVwc0J5S2V5cGF0aCApIHtcblx0XHRcdFx0dmFyIGRlcGVuZGFudHMgPSBkZXBzQnlLZXlwYXRoWyBrZXlwYXRoIF07XG5cdFx0XHRcdGlmICggZGVwZW5kYW50cyApIHtcblx0XHRcdFx0XHRkZXBlbmRhbnRzLmZvckVhY2goIHVwZGF0ZURlcGVuZGFudCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoICFsZW5ndGhVbmNoYW5nZWQgKSB7XG5cdFx0XHRcdG5vdGlmeURlcGVuZGFudHMoIHJhY3RpdmUsIGtleXBhdGggKyAnLmxlbmd0aCcsIHRydWUgKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9KCBjb25maWdfdHlwZXMsIHNoYXJlZF9ub3RpZnlEZXBlbmRhbnRzICk7XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX21lcmdlX19tZXJnZSA9IGZ1bmN0aW9uKCBydW5sb29wLCB3YXJuLCBpc0FycmF5LCBQcm9taXNlLCBzZXQsIG1hcE9sZFRvTmV3SW5kZXgsIHByb3BhZ2F0ZUNoYW5nZXMgKSB7XG5cblx0XHR2YXIgY29tcGFyYXRvcnMgPSB7fTtcblx0XHRyZXR1cm4gZnVuY3Rpb24gbWVyZ2UoIGtleXBhdGgsIGFycmF5LCBvcHRpb25zICkge1xuXHRcdFx0dmFyIGN1cnJlbnRBcnJheSwgb2xkQXJyYXksIG5ld0FycmF5LCBjb21wYXJhdG9yLCBsZW5ndGhVbmNoYW5nZWQsIG5ld0luZGljZXMsIHByb21pc2UsIGZ1bGZpbFByb21pc2U7XG5cdFx0XHRjdXJyZW50QXJyYXkgPSB0aGlzLmdldCgga2V5cGF0aCApO1xuXHRcdFx0aWYgKCAhaXNBcnJheSggY3VycmVudEFycmF5ICkgfHwgIWlzQXJyYXkoIGFycmF5ICkgKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnNldCgga2V5cGF0aCwgYXJyYXksIG9wdGlvbnMgJiYgb3B0aW9ucy5jb21wbGV0ZSApO1xuXHRcdFx0fVxuXHRcdFx0bGVuZ3RoVW5jaGFuZ2VkID0gY3VycmVudEFycmF5Lmxlbmd0aCA9PT0gYXJyYXkubGVuZ3RoO1xuXHRcdFx0aWYgKCBvcHRpb25zICYmIG9wdGlvbnMuY29tcGFyZSApIHtcblx0XHRcdFx0Y29tcGFyYXRvciA9IGdldENvbXBhcmF0b3JGdW5jdGlvbiggb3B0aW9ucy5jb21wYXJlICk7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0b2xkQXJyYXkgPSBjdXJyZW50QXJyYXkubWFwKCBjb21wYXJhdG9yICk7XG5cdFx0XHRcdFx0bmV3QXJyYXkgPSBhcnJheS5tYXAoIGNvbXBhcmF0b3IgKTtcblx0XHRcdFx0fSBjYXRjaCAoIGVyciApIHtcblx0XHRcdFx0XHRpZiAoIHRoaXMuZGVidWcgKSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBlcnI7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHdhcm4oICdNZXJnZSBvcGVyYXRpb246IGNvbXBhcmlzb24gZmFpbGVkLiBGYWxsaW5nIGJhY2sgdG8gaWRlbnRpdHkgY2hlY2tpbmcnICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdG9sZEFycmF5ID0gY3VycmVudEFycmF5O1xuXHRcdFx0XHRcdG5ld0FycmF5ID0gYXJyYXk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG9sZEFycmF5ID0gY3VycmVudEFycmF5O1xuXHRcdFx0XHRuZXdBcnJheSA9IGFycmF5O1xuXHRcdFx0fVxuXHRcdFx0bmV3SW5kaWNlcyA9IG1hcE9sZFRvTmV3SW5kZXgoIG9sZEFycmF5LCBuZXdBcnJheSApO1xuXHRcdFx0cHJvbWlzZSA9IG5ldyBQcm9taXNlKCBmdW5jdGlvbiggZnVsZmlsICkge1xuXHRcdFx0XHRmdWxmaWxQcm9taXNlID0gZnVsZmlsO1xuXHRcdFx0fSApO1xuXHRcdFx0cnVubG9vcC5zdGFydCggdGhpcywgZnVsZmlsUHJvbWlzZSApO1xuXHRcdFx0c2V0KCB0aGlzLCBrZXlwYXRoLCBhcnJheSwgdHJ1ZSApO1xuXHRcdFx0cHJvcGFnYXRlQ2hhbmdlcyggdGhpcywga2V5cGF0aCwgbmV3SW5kaWNlcywgbGVuZ3RoVW5jaGFuZ2VkICk7XG5cdFx0XHRydW5sb29wLmVuZCgpO1xuXHRcdFx0aWYgKCBvcHRpb25zICYmIG9wdGlvbnMuY29tcGxldGUgKSB7XG5cdFx0XHRcdHByb21pc2UudGhlbiggb3B0aW9ucy5jb21wbGV0ZSApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHByb21pc2U7XG5cdFx0fTtcblxuXHRcdGZ1bmN0aW9uIHN0cmluZ2lmeSggaXRlbSApIHtcblx0XHRcdHJldHVybiBKU09OLnN0cmluZ2lmeSggaXRlbSApO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldENvbXBhcmF0b3JGdW5jdGlvbiggY29tcGFyYXRvciApIHtcblx0XHRcdGlmICggY29tcGFyYXRvciA9PT0gdHJ1ZSApIHtcblx0XHRcdFx0cmV0dXJuIHN0cmluZ2lmeTtcblx0XHRcdH1cblx0XHRcdGlmICggdHlwZW9mIGNvbXBhcmF0b3IgPT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHRpZiAoICFjb21wYXJhdG9yc1sgY29tcGFyYXRvciBdICkge1xuXHRcdFx0XHRcdGNvbXBhcmF0b3JzWyBjb21wYXJhdG9yIF0gPSBmdW5jdGlvbiggaXRlbSApIHtcblx0XHRcdFx0XHRcdHJldHVybiBpdGVtWyBjb21wYXJhdG9yIF07XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gY29tcGFyYXRvcnNbIGNvbXBhcmF0b3IgXTtcblx0XHRcdH1cblx0XHRcdGlmICggdHlwZW9mIGNvbXBhcmF0b3IgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRcdHJldHVybiBjb21wYXJhdG9yO1xuXHRcdFx0fVxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnVGhlIGBjb21wYXJlYCBvcHRpb24gbXVzdCBiZSBhIGZ1bmN0aW9uLCBvciBhIHN0cmluZyByZXByZXNlbnRpbmcgYW4gaWRlbnRpZnlpbmcgZmllbGQgKG9yIGB0cnVlYCB0byB1c2UgSlNPTi5zdHJpbmdpZnkpJyApO1xuXHRcdH1cblx0fSggZ2xvYmFsX3J1bmxvb3AsIHV0aWxzX3dhcm4sIHV0aWxzX2lzQXJyYXksIHV0aWxzX1Byb21pc2UsIHNoYXJlZF9zZXQsIFJhY3RpdmVfcHJvdG90eXBlX21lcmdlX21hcE9sZFRvTmV3SW5kZXgsIFJhY3RpdmVfcHJvdG90eXBlX21lcmdlX3Byb3BhZ2F0ZUNoYW5nZXMgKTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfb2JzZXJ2ZV9PYnNlcnZlciA9IGZ1bmN0aW9uKCBydW5sb29wLCBpc0VxdWFsLCBnZXQgKSB7XG5cblx0XHR2YXIgT2JzZXJ2ZXIgPSBmdW5jdGlvbiggcmFjdGl2ZSwga2V5cGF0aCwgY2FsbGJhY2ssIG9wdGlvbnMgKSB7XG5cdFx0XHR2YXIgc2VsZiA9IHRoaXM7XG5cdFx0XHR0aGlzLnJvb3QgPSByYWN0aXZlO1xuXHRcdFx0dGhpcy5rZXlwYXRoID0ga2V5cGF0aDtcblx0XHRcdHRoaXMuY2FsbGJhY2sgPSBjYWxsYmFjaztcblx0XHRcdHRoaXMuZGVmZXIgPSBvcHRpb25zLmRlZmVyO1xuXHRcdFx0dGhpcy5kZWJ1ZyA9IG9wdGlvbnMuZGVidWc7XG5cdFx0XHR0aGlzLnByb3h5ID0ge1xuXHRcdFx0XHR1cGRhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdHNlbGYucmVhbGx5VXBkYXRlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHR0aGlzLnByaW9yaXR5ID0gMDtcblx0XHRcdHRoaXMuY29udGV4dCA9IG9wdGlvbnMgJiYgb3B0aW9ucy5jb250ZXh0ID8gb3B0aW9ucy5jb250ZXh0IDogcmFjdGl2ZTtcblx0XHR9O1xuXHRcdE9ic2VydmVyLnByb3RvdHlwZSA9IHtcblx0XHRcdGluaXQ6IGZ1bmN0aW9uKCBpbW1lZGlhdGUgKSB7XG5cdFx0XHRcdGlmICggaW1tZWRpYXRlICE9PSBmYWxzZSApIHtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZSgpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMudmFsdWUgPSBnZXQoIHRoaXMucm9vdCwgdGhpcy5rZXlwYXRoICk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHR1cGRhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZiAoIHRoaXMuZGVmZXIgJiYgdGhpcy5yZWFkeSApIHtcblx0XHRcdFx0XHRydW5sb29wLmFkZE9ic2VydmVyKCB0aGlzLnByb3h5ICk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMucmVhbGx5VXBkYXRlKCk7XG5cdFx0XHR9LFxuXHRcdFx0cmVhbGx5VXBkYXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIG9sZFZhbHVlLCBuZXdWYWx1ZTtcblx0XHRcdFx0b2xkVmFsdWUgPSB0aGlzLnZhbHVlO1xuXHRcdFx0XHRuZXdWYWx1ZSA9IGdldCggdGhpcy5yb290LCB0aGlzLmtleXBhdGggKTtcblx0XHRcdFx0dGhpcy52YWx1ZSA9IG5ld1ZhbHVlO1xuXHRcdFx0XHRpZiAoIHRoaXMudXBkYXRpbmcgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMudXBkYXRpbmcgPSB0cnVlO1xuXHRcdFx0XHRpZiAoICFpc0VxdWFsKCBuZXdWYWx1ZSwgb2xkVmFsdWUgKSB8fCAhdGhpcy5yZWFkeSApIHtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0dGhpcy5jYWxsYmFjay5jYWxsKCB0aGlzLmNvbnRleHQsIG5ld1ZhbHVlLCBvbGRWYWx1ZSwgdGhpcy5rZXlwYXRoICk7XG5cdFx0XHRcdFx0fSBjYXRjaCAoIGVyciApIHtcblx0XHRcdFx0XHRcdGlmICggdGhpcy5kZWJ1ZyB8fCB0aGlzLnJvb3QuZGVidWcgKSB7XG5cdFx0XHRcdFx0XHRcdHRocm93IGVycjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy51cGRhdGluZyA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIE9ic2VydmVyO1xuXHR9KCBnbG9iYWxfcnVubG9vcCwgdXRpbHNfaXNFcXVhbCwgc2hhcmVkX2dldF9fZ2V0ICk7XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX29ic2VydmVfZ2V0UGF0dGVybiA9IGZ1bmN0aW9uKCBpc0FycmF5ICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCByYWN0aXZlLCBwYXR0ZXJuICkge1xuXHRcdFx0dmFyIGtleXMsIGtleSwgdmFsdWVzLCB0b0dldCwgbmV3VG9HZXQsIGV4cGFuZCwgY29uY2F0ZW5hdGU7XG5cdFx0XHRrZXlzID0gcGF0dGVybi5zcGxpdCggJy4nICk7XG5cdFx0XHR0b0dldCA9IFtdO1xuXHRcdFx0ZXhwYW5kID0gZnVuY3Rpb24oIGtleXBhdGggKSB7XG5cdFx0XHRcdHZhciB2YWx1ZSwga2V5O1xuXHRcdFx0XHR2YWx1ZSA9IHJhY3RpdmUuX3dyYXBwZWRbIGtleXBhdGggXSA/IHJhY3RpdmUuX3dyYXBwZWRbIGtleXBhdGggXS5nZXQoKSA6IHJhY3RpdmUuZ2V0KCBrZXlwYXRoICk7XG5cdFx0XHRcdGZvciAoIGtleSBpbiB2YWx1ZSApIHtcblx0XHRcdFx0XHRpZiAoIHZhbHVlLmhhc093blByb3BlcnR5KCBrZXkgKSAmJiAoIGtleSAhPT0gJ19yYWN0aXZlJyB8fCAhaXNBcnJheSggdmFsdWUgKSApICkge1xuXHRcdFx0XHRcdFx0bmV3VG9HZXQucHVzaCgga2V5cGF0aCArICcuJyArIGtleSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHRcdGNvbmNhdGVuYXRlID0gZnVuY3Rpb24oIGtleXBhdGggKSB7XG5cdFx0XHRcdHJldHVybiBrZXlwYXRoICsgJy4nICsga2V5O1xuXHRcdFx0fTtcblx0XHRcdHdoaWxlICgga2V5ID0ga2V5cy5zaGlmdCgpICkge1xuXHRcdFx0XHRpZiAoIGtleSA9PT0gJyonICkge1xuXHRcdFx0XHRcdG5ld1RvR2V0ID0gW107XG5cdFx0XHRcdFx0dG9HZXQuZm9yRWFjaCggZXhwYW5kICk7XG5cdFx0XHRcdFx0dG9HZXQgPSBuZXdUb0dldDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRpZiAoICF0b0dldFsgMCBdICkge1xuXHRcdFx0XHRcdFx0dG9HZXRbIDAgXSA9IGtleTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dG9HZXQgPSB0b0dldC5tYXAoIGNvbmNhdGVuYXRlICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR2YWx1ZXMgPSB7fTtcblx0XHRcdHRvR2V0LmZvckVhY2goIGZ1bmN0aW9uKCBrZXlwYXRoICkge1xuXHRcdFx0XHR2YWx1ZXNbIGtleXBhdGggXSA9IHJhY3RpdmUuZ2V0KCBrZXlwYXRoICk7XG5cdFx0XHR9ICk7XG5cdFx0XHRyZXR1cm4gdmFsdWVzO1xuXHRcdH07XG5cdH0oIHV0aWxzX2lzQXJyYXkgKTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfb2JzZXJ2ZV9QYXR0ZXJuT2JzZXJ2ZXIgPSBmdW5jdGlvbiggcnVubG9vcCwgaXNFcXVhbCwgZ2V0LCBnZXRQYXR0ZXJuICkge1xuXG5cdFx0dmFyIFBhdHRlcm5PYnNlcnZlciwgd2lsZGNhcmQgPSAvXFwqLztcblx0XHRQYXR0ZXJuT2JzZXJ2ZXIgPSBmdW5jdGlvbiggcmFjdGl2ZSwga2V5cGF0aCwgY2FsbGJhY2ssIG9wdGlvbnMgKSB7XG5cdFx0XHR0aGlzLnJvb3QgPSByYWN0aXZlO1xuXHRcdFx0dGhpcy5jYWxsYmFjayA9IGNhbGxiYWNrO1xuXHRcdFx0dGhpcy5kZWZlciA9IG9wdGlvbnMuZGVmZXI7XG5cdFx0XHR0aGlzLmRlYnVnID0gb3B0aW9ucy5kZWJ1Zztcblx0XHRcdHRoaXMua2V5cGF0aCA9IGtleXBhdGg7XG5cdFx0XHR0aGlzLnJlZ2V4ID0gbmV3IFJlZ0V4cCggJ14nICsga2V5cGF0aC5yZXBsYWNlKCAvXFwuL2csICdcXFxcLicgKS5yZXBsYWNlKCAvXFwqL2csICdbXlxcXFwuXSsnICkgKyAnJCcgKTtcblx0XHRcdHRoaXMudmFsdWVzID0ge307XG5cdFx0XHRpZiAoIHRoaXMuZGVmZXIgKSB7XG5cdFx0XHRcdHRoaXMucHJveGllcyA9IFtdO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5wcmlvcml0eSA9ICdwYXR0ZXJuJztcblx0XHRcdHRoaXMuY29udGV4dCA9IG9wdGlvbnMgJiYgb3B0aW9ucy5jb250ZXh0ID8gb3B0aW9ucy5jb250ZXh0IDogcmFjdGl2ZTtcblx0XHR9O1xuXHRcdFBhdHRlcm5PYnNlcnZlci5wcm90b3R5cGUgPSB7XG5cdFx0XHRpbml0OiBmdW5jdGlvbiggaW1tZWRpYXRlICkge1xuXHRcdFx0XHR2YXIgdmFsdWVzLCBrZXlwYXRoO1xuXHRcdFx0XHR2YWx1ZXMgPSBnZXRQYXR0ZXJuKCB0aGlzLnJvb3QsIHRoaXMua2V5cGF0aCApO1xuXHRcdFx0XHRpZiAoIGltbWVkaWF0ZSAhPT0gZmFsc2UgKSB7XG5cdFx0XHRcdFx0Zm9yICgga2V5cGF0aCBpbiB2YWx1ZXMgKSB7XG5cdFx0XHRcdFx0XHRpZiAoIHZhbHVlcy5oYXNPd25Qcm9wZXJ0eSgga2V5cGF0aCApICkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLnVwZGF0ZSgga2V5cGF0aCApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLnZhbHVlcyA9IHZhbHVlcztcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHVwZGF0ZTogZnVuY3Rpb24oIGtleXBhdGggKSB7XG5cdFx0XHRcdHZhciB2YWx1ZXM7XG5cdFx0XHRcdGlmICggd2lsZGNhcmQudGVzdCgga2V5cGF0aCApICkge1xuXHRcdFx0XHRcdHZhbHVlcyA9IGdldFBhdHRlcm4oIHRoaXMucm9vdCwga2V5cGF0aCApO1xuXHRcdFx0XHRcdGZvciAoIGtleXBhdGggaW4gdmFsdWVzICkge1xuXHRcdFx0XHRcdFx0aWYgKCB2YWx1ZXMuaGFzT3duUHJvcGVydHkoIGtleXBhdGggKSApIHtcblx0XHRcdFx0XHRcdFx0dGhpcy51cGRhdGUoIGtleXBhdGggKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggdGhpcy5kZWZlciAmJiB0aGlzLnJlYWR5ICkge1xuXHRcdFx0XHRcdHJ1bmxvb3AuYWRkT2JzZXJ2ZXIoIHRoaXMuZ2V0UHJveHkoIGtleXBhdGggKSApO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLnJlYWxseVVwZGF0ZSgga2V5cGF0aCApO1xuXHRcdFx0fSxcblx0XHRcdHJlYWxseVVwZGF0ZTogZnVuY3Rpb24oIGtleXBhdGggKSB7XG5cdFx0XHRcdHZhciB2YWx1ZSA9IGdldCggdGhpcy5yb290LCBrZXlwYXRoICk7XG5cdFx0XHRcdGlmICggdGhpcy51cGRhdGluZyApIHtcblx0XHRcdFx0XHR0aGlzLnZhbHVlc1sga2V5cGF0aCBdID0gdmFsdWU7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMudXBkYXRpbmcgPSB0cnVlO1xuXHRcdFx0XHRpZiAoICFpc0VxdWFsKCB2YWx1ZSwgdGhpcy52YWx1ZXNbIGtleXBhdGggXSApIHx8ICF0aGlzLnJlYWR5ICkge1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHR0aGlzLmNhbGxiYWNrLmNhbGwoIHRoaXMuY29udGV4dCwgdmFsdWUsIHRoaXMudmFsdWVzWyBrZXlwYXRoIF0sIGtleXBhdGggKTtcblx0XHRcdFx0XHR9IGNhdGNoICggZXJyICkge1xuXHRcdFx0XHRcdFx0aWYgKCB0aGlzLmRlYnVnIHx8IHRoaXMucm9vdC5kZWJ1ZyApIHtcblx0XHRcdFx0XHRcdFx0dGhyb3cgZXJyO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGlzLnZhbHVlc1sga2V5cGF0aCBdID0gdmFsdWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy51cGRhdGluZyA9IGZhbHNlO1xuXHRcdFx0fSxcblx0XHRcdGdldFByb3h5OiBmdW5jdGlvbigga2V5cGF0aCApIHtcblx0XHRcdFx0dmFyIHNlbGYgPSB0aGlzO1xuXHRcdFx0XHRpZiAoICF0aGlzLnByb3hpZXNbIGtleXBhdGggXSApIHtcblx0XHRcdFx0XHR0aGlzLnByb3hpZXNbIGtleXBhdGggXSA9IHtcblx0XHRcdFx0XHRcdHVwZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRcdHNlbGYucmVhbGx5VXBkYXRlKCBrZXlwYXRoICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdGhpcy5wcm94aWVzWyBrZXlwYXRoIF07XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gUGF0dGVybk9ic2VydmVyO1xuXHR9KCBnbG9iYWxfcnVubG9vcCwgdXRpbHNfaXNFcXVhbCwgc2hhcmVkX2dldF9fZ2V0LCBSYWN0aXZlX3Byb3RvdHlwZV9vYnNlcnZlX2dldFBhdHRlcm4gKTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfb2JzZXJ2ZV9nZXRPYnNlcnZlckZhY2FkZSA9IGZ1bmN0aW9uKCBub3JtYWxpc2VLZXlwYXRoLCByZWdpc3RlckRlcGVuZGFudCwgdW5yZWdpc3RlckRlcGVuZGFudCwgT2JzZXJ2ZXIsIFBhdHRlcm5PYnNlcnZlciApIHtcblxuXHRcdHZhciB3aWxkY2FyZCA9IC9cXCovLFxuXHRcdFx0ZW1wdHlPYmplY3QgPSB7fTtcblx0XHRyZXR1cm4gZnVuY3Rpb24gZ2V0T2JzZXJ2ZXJGYWNhZGUoIHJhY3RpdmUsIGtleXBhdGgsIGNhbGxiYWNrLCBvcHRpb25zICkge1xuXHRcdFx0dmFyIG9ic2VydmVyLCBpc1BhdHRlcm5PYnNlcnZlcjtcblx0XHRcdGtleXBhdGggPSBub3JtYWxpc2VLZXlwYXRoKCBrZXlwYXRoICk7XG5cdFx0XHRvcHRpb25zID0gb3B0aW9ucyB8fCBlbXB0eU9iamVjdDtcblx0XHRcdGlmICggd2lsZGNhcmQudGVzdCgga2V5cGF0aCApICkge1xuXHRcdFx0XHRvYnNlcnZlciA9IG5ldyBQYXR0ZXJuT2JzZXJ2ZXIoIHJhY3RpdmUsIGtleXBhdGgsIGNhbGxiYWNrLCBvcHRpb25zICk7XG5cdFx0XHRcdHJhY3RpdmUuX3BhdHRlcm5PYnNlcnZlcnMucHVzaCggb2JzZXJ2ZXIgKTtcblx0XHRcdFx0aXNQYXR0ZXJuT2JzZXJ2ZXIgPSB0cnVlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0b2JzZXJ2ZXIgPSBuZXcgT2JzZXJ2ZXIoIHJhY3RpdmUsIGtleXBhdGgsIGNhbGxiYWNrLCBvcHRpb25zICk7XG5cdFx0XHR9XG5cdFx0XHRyZWdpc3RlckRlcGVuZGFudCggb2JzZXJ2ZXIgKTtcblx0XHRcdG9ic2VydmVyLmluaXQoIG9wdGlvbnMuaW5pdCApO1xuXHRcdFx0b2JzZXJ2ZXIucmVhZHkgPSB0cnVlO1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0Y2FuY2VsOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHR2YXIgaW5kZXg7XG5cdFx0XHRcdFx0aWYgKCBpc1BhdHRlcm5PYnNlcnZlciApIHtcblx0XHRcdFx0XHRcdGluZGV4ID0gcmFjdGl2ZS5fcGF0dGVybk9ic2VydmVycy5pbmRleE9mKCBvYnNlcnZlciApO1xuXHRcdFx0XHRcdFx0aWYgKCBpbmRleCAhPT0gLTEgKSB7XG5cdFx0XHRcdFx0XHRcdHJhY3RpdmUuX3BhdHRlcm5PYnNlcnZlcnMuc3BsaWNlKCBpbmRleCwgMSApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR1bnJlZ2lzdGVyRGVwZW5kYW50KCBvYnNlcnZlciApO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdH07XG5cdH0oIHV0aWxzX25vcm1hbGlzZUtleXBhdGgsIHNoYXJlZF9yZWdpc3RlckRlcGVuZGFudCwgc2hhcmVkX3VucmVnaXN0ZXJEZXBlbmRhbnQsIFJhY3RpdmVfcHJvdG90eXBlX29ic2VydmVfT2JzZXJ2ZXIsIFJhY3RpdmVfcHJvdG90eXBlX29ic2VydmVfUGF0dGVybk9ic2VydmVyICk7XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX29ic2VydmVfX29ic2VydmUgPSBmdW5jdGlvbiggaXNPYmplY3QsIGdldE9ic2VydmVyRmFjYWRlICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uIG9ic2VydmUoIGtleXBhdGgsIGNhbGxiYWNrLCBvcHRpb25zICkge1xuXHRcdFx0dmFyIG9ic2VydmVycywgbWFwLCBrZXlwYXRocywgaTtcblx0XHRcdGlmICggaXNPYmplY3QoIGtleXBhdGggKSApIHtcblx0XHRcdFx0b3B0aW9ucyA9IGNhbGxiYWNrO1xuXHRcdFx0XHRtYXAgPSBrZXlwYXRoO1xuXHRcdFx0XHRvYnNlcnZlcnMgPSBbXTtcblx0XHRcdFx0Zm9yICgga2V5cGF0aCBpbiBtYXAgKSB7XG5cdFx0XHRcdFx0aWYgKCBtYXAuaGFzT3duUHJvcGVydHkoIGtleXBhdGggKSApIHtcblx0XHRcdFx0XHRcdGNhbGxiYWNrID0gbWFwWyBrZXlwYXRoIF07XG5cdFx0XHRcdFx0XHRvYnNlcnZlcnMucHVzaCggdGhpcy5vYnNlcnZlKCBrZXlwYXRoLCBjYWxsYmFjaywgb3B0aW9ucyApICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0Y2FuY2VsOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdHdoaWxlICggb2JzZXJ2ZXJzLmxlbmd0aCApIHtcblx0XHRcdFx0XHRcdFx0b2JzZXJ2ZXJzLnBvcCgpLmNhbmNlbCgpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHRcdGlmICggdHlwZW9mIGtleXBhdGggPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRcdG9wdGlvbnMgPSBjYWxsYmFjaztcblx0XHRcdFx0Y2FsbGJhY2sgPSBrZXlwYXRoO1xuXHRcdFx0XHRrZXlwYXRoID0gJyc7XG5cdFx0XHRcdHJldHVybiBnZXRPYnNlcnZlckZhY2FkZSggdGhpcywga2V5cGF0aCwgY2FsbGJhY2ssIG9wdGlvbnMgKTtcblx0XHRcdH1cblx0XHRcdGtleXBhdGhzID0ga2V5cGF0aC5zcGxpdCggJyAnICk7XG5cdFx0XHRpZiAoIGtleXBhdGhzLmxlbmd0aCA9PT0gMSApIHtcblx0XHRcdFx0cmV0dXJuIGdldE9ic2VydmVyRmFjYWRlKCB0aGlzLCBrZXlwYXRoLCBjYWxsYmFjaywgb3B0aW9ucyApO1xuXHRcdFx0fVxuXHRcdFx0b2JzZXJ2ZXJzID0gW107XG5cdFx0XHRpID0ga2V5cGF0aHMubGVuZ3RoO1xuXHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdGtleXBhdGggPSBrZXlwYXRoc1sgaSBdO1xuXHRcdFx0XHRpZiAoIGtleXBhdGggKSB7XG5cdFx0XHRcdFx0b2JzZXJ2ZXJzLnB1c2goIGdldE9ic2VydmVyRmFjYWRlKCB0aGlzLCBrZXlwYXRoLCBjYWxsYmFjaywgb3B0aW9ucyApICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGNhbmNlbDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0d2hpbGUgKCBvYnNlcnZlcnMubGVuZ3RoICkge1xuXHRcdFx0XHRcdFx0b2JzZXJ2ZXJzLnBvcCgpLmNhbmNlbCgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHR9O1xuXHR9KCB1dGlsc19pc09iamVjdCwgUmFjdGl2ZV9wcm90b3R5cGVfb2JzZXJ2ZV9nZXRPYnNlcnZlckZhY2FkZSApO1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9vZmYgPSBmdW5jdGlvbiggZXZlbnROYW1lLCBjYWxsYmFjayApIHtcblx0XHR2YXIgc3Vic2NyaWJlcnMsIGluZGV4O1xuXHRcdGlmICggIWNhbGxiYWNrICkge1xuXHRcdFx0aWYgKCAhZXZlbnROYW1lICkge1xuXHRcdFx0XHRmb3IgKCBldmVudE5hbWUgaW4gdGhpcy5fc3VicyApIHtcblx0XHRcdFx0XHRkZWxldGUgdGhpcy5fc3Vic1sgZXZlbnROYW1lIF07XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX3N1YnNbIGV2ZW50TmFtZSBdID0gW107XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHN1YnNjcmliZXJzID0gdGhpcy5fc3Vic1sgZXZlbnROYW1lIF07XG5cdFx0aWYgKCBzdWJzY3JpYmVycyApIHtcblx0XHRcdGluZGV4ID0gc3Vic2NyaWJlcnMuaW5kZXhPZiggY2FsbGJhY2sgKTtcblx0XHRcdGlmICggaW5kZXggIT09IC0xICkge1xuXHRcdFx0XHRzdWJzY3JpYmVycy5zcGxpY2UoIGluZGV4LCAxICk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9O1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9vbiA9IGZ1bmN0aW9uKCBldmVudE5hbWUsIGNhbGxiYWNrICkge1xuXHRcdHZhciBzZWxmID0gdGhpcyxcblx0XHRcdGxpc3RlbmVycywgbjtcblx0XHRpZiAoIHR5cGVvZiBldmVudE5hbWUgPT09ICdvYmplY3QnICkge1xuXHRcdFx0bGlzdGVuZXJzID0gW107XG5cdFx0XHRmb3IgKCBuIGluIGV2ZW50TmFtZSApIHtcblx0XHRcdFx0aWYgKCBldmVudE5hbWUuaGFzT3duUHJvcGVydHkoIG4gKSApIHtcblx0XHRcdFx0XHRsaXN0ZW5lcnMucHVzaCggdGhpcy5vbiggbiwgZXZlbnROYW1lWyBuIF0gKSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRjYW5jZWw6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdHZhciBsaXN0ZW5lcjtcblx0XHRcdFx0XHR3aGlsZSAoIGxpc3RlbmVyID0gbGlzdGVuZXJzLnBvcCgpICkge1xuXHRcdFx0XHRcdFx0bGlzdGVuZXIuY2FuY2VsKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdH1cblx0XHRpZiAoICF0aGlzLl9zdWJzWyBldmVudE5hbWUgXSApIHtcblx0XHRcdHRoaXMuX3N1YnNbIGV2ZW50TmFtZSBdID0gWyBjYWxsYmFjayBdO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9zdWJzWyBldmVudE5hbWUgXS5wdXNoKCBjYWxsYmFjayApO1xuXHRcdH1cblx0XHRyZXR1cm4ge1xuXHRcdFx0Y2FuY2VsOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0c2VsZi5vZmYoIGV2ZW50TmFtZSwgY2FsbGJhY2sgKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9O1xuXG5cdHZhciB1dGlsc19jcmVhdGUgPSBmdW5jdGlvbigpIHtcblxuXHRcdHZhciBjcmVhdGU7XG5cdFx0dHJ5IHtcblx0XHRcdE9iamVjdC5jcmVhdGUoIG51bGwgKTtcblx0XHRcdGNyZWF0ZSA9IE9iamVjdC5jcmVhdGU7XG5cdFx0fSBjYXRjaCAoIGVyciApIHtcblx0XHRcdGNyZWF0ZSA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgRiA9IGZ1bmN0aW9uKCkge307XG5cdFx0XHRcdHJldHVybiBmdW5jdGlvbiggcHJvdG8sIHByb3BzICkge1xuXHRcdFx0XHRcdHZhciBvYmo7XG5cdFx0XHRcdFx0aWYgKCBwcm90byA9PT0gbnVsbCApIHtcblx0XHRcdFx0XHRcdHJldHVybiB7fTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Ri5wcm90b3R5cGUgPSBwcm90bztcblx0XHRcdFx0XHRvYmogPSBuZXcgRigpO1xuXHRcdFx0XHRcdGlmICggcHJvcHMgKSB7XG5cdFx0XHRcdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydGllcyggb2JqLCBwcm9wcyApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gb2JqO1xuXHRcdFx0XHR9O1xuXHRcdFx0fSgpO1xuXHRcdH1cblx0XHRyZXR1cm4gY3JlYXRlO1xuXHR9KCk7XG5cblx0dmFyIHJlbmRlcl9zaGFyZWRfaW5pdEZyYWdtZW50ID0gZnVuY3Rpb24oIHR5cGVzLCBjcmVhdGUgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24gaW5pdEZyYWdtZW50KCBmcmFnbWVudCwgb3B0aW9ucyApIHtcblx0XHRcdHZhciBudW1JdGVtcywgaSwgcGFyZW50RnJhZ21lbnQsIHBhcmVudFJlZnMsIHJlZjtcblx0XHRcdGZyYWdtZW50Lm93bmVyID0gb3B0aW9ucy5vd25lcjtcblx0XHRcdHBhcmVudEZyYWdtZW50ID0gZnJhZ21lbnQucGFyZW50ID0gZnJhZ21lbnQub3duZXIucGFyZW50RnJhZ21lbnQ7XG5cdFx0XHRmcmFnbWVudC5yb290ID0gb3B0aW9ucy5yb290O1xuXHRcdFx0ZnJhZ21lbnQucE5vZGUgPSBvcHRpb25zLnBOb2RlO1xuXHRcdFx0ZnJhZ21lbnQucEVsZW1lbnQgPSBvcHRpb25zLnBFbGVtZW50O1xuXHRcdFx0ZnJhZ21lbnQuY29udGV4dCA9IG9wdGlvbnMuY29udGV4dDtcblx0XHRcdGlmICggZnJhZ21lbnQub3duZXIudHlwZSA9PT0gdHlwZXMuU0VDVElPTiApIHtcblx0XHRcdFx0ZnJhZ21lbnQuaW5kZXggPSBvcHRpb25zLmluZGV4O1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBwYXJlbnRGcmFnbWVudCApIHtcblx0XHRcdFx0cGFyZW50UmVmcyA9IHBhcmVudEZyYWdtZW50LmluZGV4UmVmcztcblx0XHRcdFx0aWYgKCBwYXJlbnRSZWZzICkge1xuXHRcdFx0XHRcdGZyYWdtZW50LmluZGV4UmVmcyA9IGNyZWF0ZSggbnVsbCApO1xuXHRcdFx0XHRcdGZvciAoIHJlZiBpbiBwYXJlbnRSZWZzICkge1xuXHRcdFx0XHRcdFx0ZnJhZ21lbnQuaW5kZXhSZWZzWyByZWYgXSA9IHBhcmVudFJlZnNbIHJlZiBdO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0ZnJhZ21lbnQucHJpb3JpdHkgPSBwYXJlbnRGcmFnbWVudCA/IHBhcmVudEZyYWdtZW50LnByaW9yaXR5ICsgMSA6IDE7XG5cdFx0XHRpZiAoIG9wdGlvbnMuaW5kZXhSZWYgKSB7XG5cdFx0XHRcdGlmICggIWZyYWdtZW50LmluZGV4UmVmcyApIHtcblx0XHRcdFx0XHRmcmFnbWVudC5pbmRleFJlZnMgPSB7fTtcblx0XHRcdFx0fVxuXHRcdFx0XHRmcmFnbWVudC5pbmRleFJlZnNbIG9wdGlvbnMuaW5kZXhSZWYgXSA9IG9wdGlvbnMuaW5kZXg7XG5cdFx0XHR9XG5cdFx0XHRmcmFnbWVudC5pdGVtcyA9IFtdO1xuXHRcdFx0bnVtSXRlbXMgPSBvcHRpb25zLmRlc2NyaXB0b3IgPyBvcHRpb25zLmRlc2NyaXB0b3IubGVuZ3RoIDogMDtcblx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbnVtSXRlbXM7IGkgKz0gMSApIHtcblx0XHRcdFx0ZnJhZ21lbnQuaXRlbXNbIGZyYWdtZW50Lml0ZW1zLmxlbmd0aCBdID0gZnJhZ21lbnQuY3JlYXRlSXRlbSgge1xuXHRcdFx0XHRcdHBhcmVudEZyYWdtZW50OiBmcmFnbWVudCxcblx0XHRcdFx0XHRwRWxlbWVudDogb3B0aW9ucy5wRWxlbWVudCxcblx0XHRcdFx0XHRkZXNjcmlwdG9yOiBvcHRpb25zLmRlc2NyaXB0b3JbIGkgXSxcblx0XHRcdFx0XHRpbmRleDogaVxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fSggY29uZmlnX3R5cGVzLCB1dGlsc19jcmVhdGUgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X3NoYXJlZF9pbnNlcnRIdG1sID0gZnVuY3Rpb24oIGNyZWF0ZUVsZW1lbnQgKSB7XG5cblx0XHR2YXIgZWxlbWVudENhY2hlID0ge30sIGllQnVnLCBpZUJsYWNrbGlzdDtcblx0XHR0cnkge1xuXHRcdFx0Y3JlYXRlRWxlbWVudCggJ3RhYmxlJyApLmlubmVySFRNTCA9ICdmb28nO1xuXHRcdH0gY2F0Y2ggKCBlcnIgKSB7XG5cdFx0XHRpZUJ1ZyA9IHRydWU7XG5cdFx0XHRpZUJsYWNrbGlzdCA9IHtcblx0XHRcdFx0VEFCTEU6IFtcblx0XHRcdFx0XHQnPHRhYmxlIGNsYXNzPVwieFwiPicsXG5cdFx0XHRcdFx0JzwvdGFibGU+J1xuXHRcdFx0XHRdLFxuXHRcdFx0XHRUSEVBRDogW1xuXHRcdFx0XHRcdCc8dGFibGU+PHRoZWFkIGNsYXNzPVwieFwiPicsXG5cdFx0XHRcdFx0JzwvdGhlYWQ+PC90YWJsZT4nXG5cdFx0XHRcdF0sXG5cdFx0XHRcdFRCT0RZOiBbXG5cdFx0XHRcdFx0Jzx0YWJsZT48dGJvZHkgY2xhc3M9XCJ4XCI+Jyxcblx0XHRcdFx0XHQnPC90Ym9keT48L3RhYmxlPidcblx0XHRcdFx0XSxcblx0XHRcdFx0VFI6IFtcblx0XHRcdFx0XHQnPHRhYmxlPjx0ciBjbGFzcz1cInhcIj4nLFxuXHRcdFx0XHRcdCc8L3RyPjwvdGFibGU+J1xuXHRcdFx0XHRdLFxuXHRcdFx0XHRTRUxFQ1Q6IFtcblx0XHRcdFx0XHQnPHNlbGVjdCBjbGFzcz1cInhcIj4nLFxuXHRcdFx0XHRcdCc8L3NlbGVjdD4nXG5cdFx0XHRcdF1cblx0XHRcdH07XG5cdFx0fVxuXHRcdHJldHVybiBmdW5jdGlvbiggaHRtbCwgdGFnTmFtZSwgZG9jRnJhZyApIHtcblx0XHRcdHZhciBjb250YWluZXIsIG5vZGVzID0gW10sXG5cdFx0XHRcdHdyYXBwZXI7XG5cdFx0XHRpZiAoIGh0bWwgKSB7XG5cdFx0XHRcdGlmICggaWVCdWcgJiYgKCB3cmFwcGVyID0gaWVCbGFja2xpc3RbIHRhZ05hbWUgXSApICkge1xuXHRcdFx0XHRcdGNvbnRhaW5lciA9IGVsZW1lbnQoICdESVYnICk7XG5cdFx0XHRcdFx0Y29udGFpbmVyLmlubmVySFRNTCA9IHdyYXBwZXJbIDAgXSArIGh0bWwgKyB3cmFwcGVyWyAxIF07XG5cdFx0XHRcdFx0Y29udGFpbmVyID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoICcueCcgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb250YWluZXIgPSBlbGVtZW50KCB0YWdOYW1lICk7XG5cdFx0XHRcdFx0Y29udGFpbmVyLmlubmVySFRNTCA9IGh0bWw7XG5cdFx0XHRcdH1cblx0XHRcdFx0d2hpbGUgKCBjb250YWluZXIuZmlyc3RDaGlsZCApIHtcblx0XHRcdFx0XHRub2Rlcy5wdXNoKCBjb250YWluZXIuZmlyc3RDaGlsZCApO1xuXHRcdFx0XHRcdGRvY0ZyYWcuYXBwZW5kQ2hpbGQoIGNvbnRhaW5lci5maXJzdENoaWxkICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBub2Rlcztcblx0XHR9O1xuXG5cdFx0ZnVuY3Rpb24gZWxlbWVudCggdGFnTmFtZSApIHtcblx0XHRcdHJldHVybiBlbGVtZW50Q2FjaGVbIHRhZ05hbWUgXSB8fCAoIGVsZW1lbnRDYWNoZVsgdGFnTmFtZSBdID0gY3JlYXRlRWxlbWVudCggdGFnTmFtZSApICk7XG5cdFx0fVxuXHR9KCB1dGlsc19jcmVhdGVFbGVtZW50ICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9zaGFyZWRfZGV0YWNoID0gZnVuY3Rpb24oKSB7XG5cdFx0dmFyIG5vZGUgPSB0aGlzLm5vZGUsXG5cdFx0XHRwYXJlbnROb2RlO1xuXHRcdGlmICggbm9kZSAmJiAoIHBhcmVudE5vZGUgPSBub2RlLnBhcmVudE5vZGUgKSApIHtcblx0XHRcdHBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoIG5vZGUgKTtcblx0XHRcdHJldHVybiBub2RlO1xuXHRcdH1cblx0fTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X1RleHQgPSBmdW5jdGlvbiggdHlwZXMsIGRldGFjaCApIHtcblxuXHRcdHZhciBEb21UZXh0LCBsZXNzVGhhbiwgZ3JlYXRlclRoYW47XG5cdFx0bGVzc1RoYW4gPSAvPC9nO1xuXHRcdGdyZWF0ZXJUaGFuID0gLz4vZztcblx0XHREb21UZXh0ID0gZnVuY3Rpb24oIG9wdGlvbnMsIGRvY0ZyYWcgKSB7XG5cdFx0XHR0aGlzLnR5cGUgPSB0eXBlcy5URVhUO1xuXHRcdFx0dGhpcy5kZXNjcmlwdG9yID0gb3B0aW9ucy5kZXNjcmlwdG9yO1xuXHRcdFx0aWYgKCBkb2NGcmFnICkge1xuXHRcdFx0XHR0aGlzLm5vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSggb3B0aW9ucy5kZXNjcmlwdG9yICk7XG5cdFx0XHRcdGRvY0ZyYWcuYXBwZW5kQ2hpbGQoIHRoaXMubm9kZSApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0RG9tVGV4dC5wcm90b3R5cGUgPSB7XG5cdFx0XHRkZXRhY2g6IGRldGFjaCxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbiggZGVzdHJveSApIHtcblx0XHRcdFx0aWYgKCBkZXN0cm95ICkge1xuXHRcdFx0XHRcdHRoaXMuZGV0YWNoKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRmaXJzdE5vZGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5ub2RlO1xuXHRcdFx0fSxcblx0XHRcdHRvU3RyaW5nOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuICggJycgKyB0aGlzLmRlc2NyaXB0b3IgKS5yZXBsYWNlKCBsZXNzVGhhbiwgJyZsdDsnICkucmVwbGFjZSggZ3JlYXRlclRoYW4sICcmZ3Q7JyApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIERvbVRleHQ7XG5cdH0oIGNvbmZpZ190eXBlcywgcmVuZGVyX0RvbUZyYWdtZW50X3NoYXJlZF9kZXRhY2ggKTtcblxuXHR2YXIgc2hhcmVkX3RlYXJkb3duID0gZnVuY3Rpb24oIHJ1bmxvb3AsIHVucmVnaXN0ZXJEZXBlbmRhbnQgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHRoaW5nICkge1xuXHRcdFx0aWYgKCAhdGhpbmcua2V5cGF0aCApIHtcblx0XHRcdFx0cnVubG9vcC5yZW1vdmVVbnJlc29sdmVkKCB0aGluZyApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dW5yZWdpc3RlckRlcGVuZGFudCggdGhpbmcgKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9KCBnbG9iYWxfcnVubG9vcCwgc2hhcmVkX3VucmVnaXN0ZXJEZXBlbmRhbnQgKTtcblxuXHR2YXIgcmVuZGVyX3NoYXJlZF9FdmFsdWF0b3JfUmVmZXJlbmNlID0gZnVuY3Rpb24oIHR5cGVzLCBpc0VxdWFsLCBkZWZpbmVQcm9wZXJ0eSwgcmVnaXN0ZXJEZXBlbmRhbnQsIHVucmVnaXN0ZXJEZXBlbmRhbnQgKSB7XG5cblx0XHR2YXIgUmVmZXJlbmNlLCB0aGlzUGF0dGVybjtcblx0XHR0aGlzUGF0dGVybiA9IC90aGlzLztcblx0XHRSZWZlcmVuY2UgPSBmdW5jdGlvbiggcm9vdCwga2V5cGF0aCwgZXZhbHVhdG9yLCBhcmdOdW0sIHByaW9yaXR5ICkge1xuXHRcdFx0dmFyIHZhbHVlO1xuXHRcdFx0dGhpcy5ldmFsdWF0b3IgPSBldmFsdWF0b3I7XG5cdFx0XHR0aGlzLmtleXBhdGggPSBrZXlwYXRoO1xuXHRcdFx0dGhpcy5yb290ID0gcm9vdDtcblx0XHRcdHRoaXMuYXJnTnVtID0gYXJnTnVtO1xuXHRcdFx0dGhpcy50eXBlID0gdHlwZXMuUkVGRVJFTkNFO1xuXHRcdFx0dGhpcy5wcmlvcml0eSA9IHByaW9yaXR5O1xuXHRcdFx0dmFsdWUgPSByb290LmdldCgga2V5cGF0aCApO1xuXHRcdFx0aWYgKCB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRcdHZhbHVlID0gd3JhcEZ1bmN0aW9uKCB2YWx1ZSwgcm9vdCwgZXZhbHVhdG9yICk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnZhbHVlID0gZXZhbHVhdG9yLnZhbHVlc1sgYXJnTnVtIF0gPSB2YWx1ZTtcblx0XHRcdHJlZ2lzdGVyRGVwZW5kYW50KCB0aGlzICk7XG5cdFx0fTtcblx0XHRSZWZlcmVuY2UucHJvdG90eXBlID0ge1xuXHRcdFx0dXBkYXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHZhbHVlID0gdGhpcy5yb290LmdldCggdGhpcy5rZXlwYXRoICk7XG5cdFx0XHRcdGlmICggdHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nICYmICF2YWx1ZS5fbm93cmFwICkge1xuXHRcdFx0XHRcdHZhbHVlID0gd3JhcEZ1bmN0aW9uKCB2YWx1ZSwgdGhpcy5yb290LCB0aGlzLmV2YWx1YXRvciApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggIWlzRXF1YWwoIHZhbHVlLCB0aGlzLnZhbHVlICkgKSB7XG5cdFx0XHRcdFx0dGhpcy5ldmFsdWF0b3IudmFsdWVzWyB0aGlzLmFyZ051bSBdID0gdmFsdWU7XG5cdFx0XHRcdFx0dGhpcy5ldmFsdWF0b3IuYnViYmxlKCk7XG5cdFx0XHRcdFx0dGhpcy52YWx1ZSA9IHZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR1bnJlZ2lzdGVyRGVwZW5kYW50KCB0aGlzICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gUmVmZXJlbmNlO1xuXG5cdFx0ZnVuY3Rpb24gd3JhcEZ1bmN0aW9uKCBmbiwgcmFjdGl2ZSwgZXZhbHVhdG9yICkge1xuXHRcdFx0dmFyIHByb3AsIGV2YWx1YXRvcnMsIGluZGV4O1xuXHRcdFx0aWYgKCAhdGhpc1BhdHRlcm4udGVzdCggZm4udG9TdHJpbmcoKSApICkge1xuXHRcdFx0XHRkZWZpbmVQcm9wZXJ0eSggZm4sICdfbm93cmFwJywge1xuXHRcdFx0XHRcdHZhbHVlOiB0cnVlXG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0cmV0dXJuIGZuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhZm5bICdfJyArIHJhY3RpdmUuX2d1aWQgXSApIHtcblx0XHRcdFx0ZGVmaW5lUHJvcGVydHkoIGZuLCAnXycgKyByYWN0aXZlLl9ndWlkLCB7XG5cdFx0XHRcdFx0dmFsdWU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0dmFyIG9yaWdpbmFsQ2FwdHVyZWQsIHJlc3VsdCwgaSwgZXZhbHVhdG9yO1xuXHRcdFx0XHRcdFx0b3JpZ2luYWxDYXB0dXJlZCA9IHJhY3RpdmUuX2NhcHR1cmVkO1xuXHRcdFx0XHRcdFx0aWYgKCAhb3JpZ2luYWxDYXB0dXJlZCApIHtcblx0XHRcdFx0XHRcdFx0cmFjdGl2ZS5fY2FwdHVyZWQgPSBbXTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHJlc3VsdCA9IGZuLmFwcGx5KCByYWN0aXZlLCBhcmd1bWVudHMgKTtcblx0XHRcdFx0XHRcdGlmICggcmFjdGl2ZS5fY2FwdHVyZWQubGVuZ3RoICkge1xuXHRcdFx0XHRcdFx0XHRpID0gZXZhbHVhdG9ycy5sZW5ndGg7XG5cdFx0XHRcdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdFx0XHRcdGV2YWx1YXRvciA9IGV2YWx1YXRvcnNbIGkgXTtcblx0XHRcdFx0XHRcdFx0XHRldmFsdWF0b3IudXBkYXRlU29mdERlcGVuZGVuY2llcyggcmFjdGl2ZS5fY2FwdHVyZWQgKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmFjdGl2ZS5fY2FwdHVyZWQgPSBvcmlnaW5hbENhcHR1cmVkO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHdyaXRhYmxlOiB0cnVlXG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0Zm9yICggcHJvcCBpbiBmbiApIHtcblx0XHRcdFx0XHRpZiAoIGZuLmhhc093blByb3BlcnR5KCBwcm9wICkgKSB7XG5cdFx0XHRcdFx0XHRmblsgJ18nICsgcmFjdGl2ZS5fZ3VpZCBdWyBwcm9wIF0gPSBmblsgcHJvcCBdO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRmblsgJ18nICsgcmFjdGl2ZS5fZ3VpZCArICdfZXZhbHVhdG9ycycgXSA9IFtdO1xuXHRcdFx0fVxuXHRcdFx0ZXZhbHVhdG9ycyA9IGZuWyAnXycgKyByYWN0aXZlLl9ndWlkICsgJ19ldmFsdWF0b3JzJyBdO1xuXHRcdFx0aW5kZXggPSBldmFsdWF0b3JzLmluZGV4T2YoIGV2YWx1YXRvciApO1xuXHRcdFx0aWYgKCBpbmRleCA9PT0gLTEgKSB7XG5cdFx0XHRcdGV2YWx1YXRvcnMucHVzaCggZXZhbHVhdG9yICk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZm5bICdfJyArIHJhY3RpdmUuX2d1aWQgXTtcblx0XHR9XG5cdH0oIGNvbmZpZ190eXBlcywgdXRpbHNfaXNFcXVhbCwgdXRpbHNfZGVmaW5lUHJvcGVydHksIHNoYXJlZF9yZWdpc3RlckRlcGVuZGFudCwgc2hhcmVkX3VucmVnaXN0ZXJEZXBlbmRhbnQgKTtcblxuXHR2YXIgcmVuZGVyX3NoYXJlZF9FdmFsdWF0b3JfU29mdFJlZmVyZW5jZSA9IGZ1bmN0aW9uKCBpc0VxdWFsLCByZWdpc3RlckRlcGVuZGFudCwgdW5yZWdpc3RlckRlcGVuZGFudCApIHtcblxuXHRcdHZhciBTb2Z0UmVmZXJlbmNlID0gZnVuY3Rpb24oIHJvb3QsIGtleXBhdGgsIGV2YWx1YXRvciApIHtcblx0XHRcdHRoaXMucm9vdCA9IHJvb3Q7XG5cdFx0XHR0aGlzLmtleXBhdGggPSBrZXlwYXRoO1xuXHRcdFx0dGhpcy5wcmlvcml0eSA9IGV2YWx1YXRvci5wcmlvcml0eTtcblx0XHRcdHRoaXMuZXZhbHVhdG9yID0gZXZhbHVhdG9yO1xuXHRcdFx0cmVnaXN0ZXJEZXBlbmRhbnQoIHRoaXMgKTtcblx0XHR9O1xuXHRcdFNvZnRSZWZlcmVuY2UucHJvdG90eXBlID0ge1xuXHRcdFx0dXBkYXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHZhbHVlID0gdGhpcy5yb290LmdldCggdGhpcy5rZXlwYXRoICk7XG5cdFx0XHRcdGlmICggIWlzRXF1YWwoIHZhbHVlLCB0aGlzLnZhbHVlICkgKSB7XG5cdFx0XHRcdFx0dGhpcy5ldmFsdWF0b3IuYnViYmxlKCk7XG5cdFx0XHRcdFx0dGhpcy52YWx1ZSA9IHZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR1bnJlZ2lzdGVyRGVwZW5kYW50KCB0aGlzICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gU29mdFJlZmVyZW5jZTtcblx0fSggdXRpbHNfaXNFcXVhbCwgc2hhcmVkX3JlZ2lzdGVyRGVwZW5kYW50LCBzaGFyZWRfdW5yZWdpc3RlckRlcGVuZGFudCApO1xuXG5cdHZhciByZW5kZXJfc2hhcmVkX0V2YWx1YXRvcl9fRXZhbHVhdG9yID0gZnVuY3Rpb24oIHJ1bmxvb3AsIHdhcm4sIGlzRXF1YWwsIGNsZWFyQ2FjaGUsIG5vdGlmeURlcGVuZGFudHMsIGFkYXB0SWZOZWNlc3NhcnksIFJlZmVyZW5jZSwgU29mdFJlZmVyZW5jZSApIHtcblxuXHRcdHZhciBFdmFsdWF0b3IsIGNhY2hlID0ge307XG5cdFx0RXZhbHVhdG9yID0gZnVuY3Rpb24oIHJvb3QsIGtleXBhdGgsIHVuaXF1ZVN0cmluZywgZnVuY3Rpb25TdHIsIGFyZ3MsIHByaW9yaXR5ICkge1xuXHRcdFx0dmFyIGksIGFyZztcblx0XHRcdHRoaXMucm9vdCA9IHJvb3Q7XG5cdFx0XHR0aGlzLnVuaXF1ZVN0cmluZyA9IHVuaXF1ZVN0cmluZztcblx0XHRcdHRoaXMua2V5cGF0aCA9IGtleXBhdGg7XG5cdFx0XHR0aGlzLnByaW9yaXR5ID0gcHJpb3JpdHk7XG5cdFx0XHR0aGlzLmZuID0gZ2V0RnVuY3Rpb25Gcm9tU3RyaW5nKCBmdW5jdGlvblN0ciwgYXJncy5sZW5ndGggKTtcblx0XHRcdHRoaXMudmFsdWVzID0gW107XG5cdFx0XHR0aGlzLnJlZnMgPSBbXTtcblx0XHRcdGkgPSBhcmdzLmxlbmd0aDtcblx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRpZiAoIGFyZyA9IGFyZ3NbIGkgXSApIHtcblx0XHRcdFx0XHRpZiAoIGFyZ1sgMCBdICkge1xuXHRcdFx0XHRcdFx0dGhpcy52YWx1ZXNbIGkgXSA9IGFyZ1sgMSBdO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aGlzLnJlZnMucHVzaCggbmV3IFJlZmVyZW5jZSggcm9vdCwgYXJnWyAxIF0sIHRoaXMsIGksIHByaW9yaXR5ICkgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy52YWx1ZXNbIGkgXSA9IHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0dGhpcy5zZWxmVXBkYXRpbmcgPSB0aGlzLnJlZnMubGVuZ3RoIDw9IDE7XG5cdFx0fTtcblx0XHRFdmFsdWF0b3IucHJvdG90eXBlID0ge1xuXHRcdFx0YnViYmxlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0aWYgKCB0aGlzLnNlbGZVcGRhdGluZyApIHtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZSgpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCAhdGhpcy5kZWZlcnJlZCApIHtcblx0XHRcdFx0XHRydW5sb29wLmFkZEV2YWx1YXRvciggdGhpcyApO1xuXHRcdFx0XHRcdHRoaXMuZGVmZXJyZWQgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0dXBkYXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHZhbHVlO1xuXHRcdFx0XHRpZiAoIHRoaXMuZXZhbHVhdGluZyApIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcztcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLmV2YWx1YXRpbmcgPSB0cnVlO1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdHZhbHVlID0gdGhpcy5mbi5hcHBseSggbnVsbCwgdGhpcy52YWx1ZXMgKTtcblx0XHRcdFx0fSBjYXRjaCAoIGVyciApIHtcblx0XHRcdFx0XHRpZiAoIHRoaXMucm9vdC5kZWJ1ZyApIHtcblx0XHRcdFx0XHRcdHdhcm4oICdFcnJvciBldmFsdWF0aW5nIFwiJyArIHRoaXMudW5pcXVlU3RyaW5nICsgJ1wiOiAnICsgZXJyLm1lc3NhZ2UgfHwgZXJyICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHZhbHVlID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggIWlzRXF1YWwoIHZhbHVlLCB0aGlzLnZhbHVlICkgKSB7XG5cdFx0XHRcdFx0dGhpcy52YWx1ZSA9IHZhbHVlO1xuXHRcdFx0XHRcdGNsZWFyQ2FjaGUoIHRoaXMucm9vdCwgdGhpcy5rZXlwYXRoICk7XG5cdFx0XHRcdFx0YWRhcHRJZk5lY2Vzc2FyeSggdGhpcy5yb290LCB0aGlzLmtleXBhdGgsIHZhbHVlLCB0cnVlICk7XG5cdFx0XHRcdFx0bm90aWZ5RGVwZW5kYW50cyggdGhpcy5yb290LCB0aGlzLmtleXBhdGggKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLmV2YWx1YXRpbmcgPSBmYWxzZTtcblx0XHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR3aGlsZSAoIHRoaXMucmVmcy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0dGhpcy5yZWZzLnBvcCgpLnRlYXJkb3duKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y2xlYXJDYWNoZSggdGhpcy5yb290LCB0aGlzLmtleXBhdGggKTtcblx0XHRcdFx0dGhpcy5yb290Ll9ldmFsdWF0b3JzWyB0aGlzLmtleXBhdGggXSA9IG51bGw7XG5cdFx0XHR9LFxuXHRcdFx0cmVmcmVzaDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmICggIXRoaXMuc2VsZlVwZGF0aW5nICkge1xuXHRcdFx0XHRcdHRoaXMuZGVmZXJyZWQgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHZhciBpID0gdGhpcy5yZWZzLmxlbmd0aDtcblx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0dGhpcy5yZWZzWyBpIF0udXBkYXRlKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCB0aGlzLmRlZmVycmVkICkge1xuXHRcdFx0XHRcdHRoaXMudXBkYXRlKCk7XG5cdFx0XHRcdFx0dGhpcy5kZWZlcnJlZCA9IGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0dXBkYXRlU29mdERlcGVuZGVuY2llczogZnVuY3Rpb24oIHNvZnREZXBzICkge1xuXHRcdFx0XHR2YXIgaSwga2V5cGF0aCwgcmVmO1xuXHRcdFx0XHRpZiAoICF0aGlzLnNvZnRSZWZzICkge1xuXHRcdFx0XHRcdHRoaXMuc29mdFJlZnMgPSBbXTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpID0gdGhpcy5zb2Z0UmVmcy5sZW5ndGg7XG5cdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdHJlZiA9IHRoaXMuc29mdFJlZnNbIGkgXTtcblx0XHRcdFx0XHRpZiAoICFzb2Z0RGVwc1sgcmVmLmtleXBhdGggXSApIHtcblx0XHRcdFx0XHRcdHRoaXMuc29mdFJlZnMuc3BsaWNlKCBpLCAxICk7XG5cdFx0XHRcdFx0XHR0aGlzLnNvZnRSZWZzWyByZWYua2V5cGF0aCBdID0gZmFsc2U7XG5cdFx0XHRcdFx0XHRyZWYudGVhcmRvd24oKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0aSA9IHNvZnREZXBzLmxlbmd0aDtcblx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0a2V5cGF0aCA9IHNvZnREZXBzWyBpIF07XG5cdFx0XHRcdFx0aWYgKCAhdGhpcy5zb2Z0UmVmc1sga2V5cGF0aCBdICkge1xuXHRcdFx0XHRcdFx0cmVmID0gbmV3IFNvZnRSZWZlcmVuY2UoIHRoaXMucm9vdCwga2V5cGF0aCwgdGhpcyApO1xuXHRcdFx0XHRcdFx0dGhpcy5zb2Z0UmVmcy5wdXNoKCByZWYgKTtcblx0XHRcdFx0XHRcdHRoaXMuc29mdFJlZnNbIGtleXBhdGggXSA9IHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuc2VsZlVwZGF0aW5nID0gdGhpcy5yZWZzLmxlbmd0aCArIHRoaXMuc29mdFJlZnMubGVuZ3RoIDw9IDE7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gRXZhbHVhdG9yO1xuXG5cdFx0ZnVuY3Rpb24gZ2V0RnVuY3Rpb25Gcm9tU3RyaW5nKCBzdHIsIGkgKSB7XG5cdFx0XHR2YXIgZm4sIGFyZ3M7XG5cdFx0XHRzdHIgPSBzdHIucmVwbGFjZSggL1xcJFxceyhbMC05XSspXFx9L2csICdfJDEnICk7XG5cdFx0XHRpZiAoIGNhY2hlWyBzdHIgXSApIHtcblx0XHRcdFx0cmV0dXJuIGNhY2hlWyBzdHIgXTtcblx0XHRcdH1cblx0XHRcdGFyZ3MgPSBbXTtcblx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRhcmdzWyBpIF0gPSAnXycgKyBpO1xuXHRcdFx0fVxuXHRcdFx0Zm4gPSBuZXcgRnVuY3Rpb24oIGFyZ3Muam9pbiggJywnICksICdyZXR1cm4oJyArIHN0ciArICcpJyApO1xuXHRcdFx0Y2FjaGVbIHN0ciBdID0gZm47XG5cdFx0XHRyZXR1cm4gZm47XG5cdFx0fVxuXHR9KCBnbG9iYWxfcnVubG9vcCwgdXRpbHNfd2FybiwgdXRpbHNfaXNFcXVhbCwgc2hhcmVkX2NsZWFyQ2FjaGUsIHNoYXJlZF9ub3RpZnlEZXBlbmRhbnRzLCBzaGFyZWRfYWRhcHRJZk5lY2Vzc2FyeSwgcmVuZGVyX3NoYXJlZF9FdmFsdWF0b3JfUmVmZXJlbmNlLCByZW5kZXJfc2hhcmVkX0V2YWx1YXRvcl9Tb2Z0UmVmZXJlbmNlICk7XG5cblx0dmFyIHJlbmRlcl9zaGFyZWRfRXhwcmVzc2lvblJlc29sdmVyX1JlZmVyZW5jZVNjb3V0ID0gZnVuY3Rpb24oIHJ1bmxvb3AsIHJlc29sdmVSZWYsIHRlYXJkb3duICkge1xuXG5cdFx0dmFyIFJlZmVyZW5jZVNjb3V0ID0gZnVuY3Rpb24oIHJlc29sdmVyLCByZWYsIHBhcmVudEZyYWdtZW50LCBhcmdOdW0gKSB7XG5cdFx0XHR2YXIga2V5cGF0aCwgcmFjdGl2ZTtcblx0XHRcdHJhY3RpdmUgPSB0aGlzLnJvb3QgPSByZXNvbHZlci5yb290O1xuXHRcdFx0dGhpcy5yZWYgPSByZWY7XG5cdFx0XHR0aGlzLnBhcmVudEZyYWdtZW50ID0gcGFyZW50RnJhZ21lbnQ7XG5cdFx0XHRrZXlwYXRoID0gcmVzb2x2ZVJlZiggcmFjdGl2ZSwgcmVmLCBwYXJlbnRGcmFnbWVudCApO1xuXHRcdFx0aWYgKCBrZXlwYXRoICE9PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdHJlc29sdmVyLnJlc29sdmUoIGFyZ051bSwgZmFsc2UsIGtleXBhdGggKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuYXJnTnVtID0gYXJnTnVtO1xuXHRcdFx0XHR0aGlzLnJlc29sdmVyID0gcmVzb2x2ZXI7XG5cdFx0XHRcdHJ1bmxvb3AuYWRkVW5yZXNvbHZlZCggdGhpcyApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0UmVmZXJlbmNlU2NvdXQucHJvdG90eXBlID0ge1xuXHRcdFx0cmVzb2x2ZTogZnVuY3Rpb24oIGtleXBhdGggKSB7XG5cdFx0XHRcdHRoaXMua2V5cGF0aCA9IGtleXBhdGg7XG5cdFx0XHRcdHRoaXMucmVzb2x2ZXIucmVzb2x2ZSggdGhpcy5hcmdOdW0sIGZhbHNlLCBrZXlwYXRoICk7XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZiAoICF0aGlzLmtleXBhdGggKSB7XG5cdFx0XHRcdFx0dGVhcmRvd24oIHRoaXMgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIFJlZmVyZW5jZVNjb3V0O1xuXHR9KCBnbG9iYWxfcnVubG9vcCwgc2hhcmVkX3Jlc29sdmVSZWYsIHNoYXJlZF90ZWFyZG93biApO1xuXG5cdHZhciByZW5kZXJfc2hhcmVkX0V4cHJlc3Npb25SZXNvbHZlcl9nZXRVbmlxdWVTdHJpbmcgPSBmdW5jdGlvbiggc3RyLCBhcmdzICkge1xuXHRcdHJldHVybiBzdHIucmVwbGFjZSggL1xcJFxceyhbMC05XSspXFx9L2csIGZ1bmN0aW9uKCBtYXRjaCwgJDEgKSB7XG5cdFx0XHRyZXR1cm4gYXJnc1sgJDEgXSA/IGFyZ3NbICQxIF1bIDEgXSA6ICd1bmRlZmluZWQnO1xuXHRcdH0gKTtcblx0fTtcblxuXHR2YXIgcmVuZGVyX3NoYXJlZF9FeHByZXNzaW9uUmVzb2x2ZXJfaXNSZWd1bGFyS2V5cGF0aCA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0dmFyIGtleVBhdHRlcm4gPSAvXig/Oig/OlthLXpBLVokX11bYS16QS1aJF8wLTldKil8KD86WzAtOV18WzEtOV1bMC05XSspKSQvO1xuXHRcdHJldHVybiBmdW5jdGlvbigga2V5cGF0aCApIHtcblx0XHRcdHZhciBrZXlzLCBrZXksIGk7XG5cdFx0XHRrZXlzID0ga2V5cGF0aC5zcGxpdCggJy4nICk7XG5cdFx0XHRpID0ga2V5cy5sZW5ndGg7XG5cdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0a2V5ID0ga2V5c1sgaSBdO1xuXHRcdFx0XHRpZiAoIGtleSA9PT0gJ3VuZGVmaW5lZCcgfHwgIWtleVBhdHRlcm4udGVzdCgga2V5ICkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9O1xuXHR9KCk7XG5cblx0dmFyIHJlbmRlcl9zaGFyZWRfRXhwcmVzc2lvblJlc29sdmVyX2dldEtleXBhdGggPSBmdW5jdGlvbiggbm9ybWFsaXNlS2V5cGF0aCwgaXNSZWd1bGFyS2V5cGF0aCApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggdW5pcXVlU3RyaW5nICkge1xuXHRcdFx0dmFyIG5vcm1hbGlzZWQ7XG5cdFx0XHRub3JtYWxpc2VkID0gbm9ybWFsaXNlS2V5cGF0aCggdW5pcXVlU3RyaW5nICk7XG5cdFx0XHRpZiAoIGlzUmVndWxhcktleXBhdGgoIG5vcm1hbGlzZWQgKSApIHtcblx0XHRcdFx0cmV0dXJuIG5vcm1hbGlzZWQ7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gJyR7JyArIG5vcm1hbGlzZWQucmVwbGFjZSggL1tcXC5cXFtcXF1dL2csICctJyApICsgJ30nO1xuXHRcdH07XG5cdH0oIHV0aWxzX25vcm1hbGlzZUtleXBhdGgsIHJlbmRlcl9zaGFyZWRfRXhwcmVzc2lvblJlc29sdmVyX2lzUmVndWxhcktleXBhdGggKTtcblxuXHR2YXIgcmVuZGVyX3NoYXJlZF9FeHByZXNzaW9uUmVzb2x2ZXJfX0V4cHJlc3Npb25SZXNvbHZlciA9IGZ1bmN0aW9uKCBFdmFsdWF0b3IsIFJlZmVyZW5jZVNjb3V0LCBnZXRVbmlxdWVTdHJpbmcsIGdldEtleXBhdGggKSB7XG5cblx0XHR2YXIgRXhwcmVzc2lvblJlc29sdmVyID0gZnVuY3Rpb24oIG11c3RhY2hlICkge1xuXHRcdFx0dmFyIGV4cHJlc3Npb24sIGksIGxlbiwgcmVmLCBpbmRleFJlZnM7XG5cdFx0XHR0aGlzLnJvb3QgPSBtdXN0YWNoZS5yb290O1xuXHRcdFx0dGhpcy5tdXN0YWNoZSA9IG11c3RhY2hlO1xuXHRcdFx0dGhpcy5hcmdzID0gW107XG5cdFx0XHR0aGlzLnNjb3V0cyA9IFtdO1xuXHRcdFx0ZXhwcmVzc2lvbiA9IG11c3RhY2hlLmRlc2NyaXB0b3IueDtcblx0XHRcdGluZGV4UmVmcyA9IG11c3RhY2hlLnBhcmVudEZyYWdtZW50LmluZGV4UmVmcztcblx0XHRcdHRoaXMuc3RyID0gZXhwcmVzc2lvbi5zO1xuXHRcdFx0bGVuID0gdGhpcy51bnJlc29sdmVkID0gdGhpcy5hcmdzLmxlbmd0aCA9IGV4cHJlc3Npb24uciA/IGV4cHJlc3Npb24uci5sZW5ndGggOiAwO1xuXHRcdFx0aWYgKCAhbGVuICkge1xuXHRcdFx0XHR0aGlzLnJlc29sdmVkID0gdGhpcy5yZWFkeSA9IHRydWU7XG5cdFx0XHRcdHRoaXMuYnViYmxlKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdHJlZiA9IGV4cHJlc3Npb24uclsgaSBdO1xuXHRcdFx0XHRpZiAoIGluZGV4UmVmcyAmJiBpbmRleFJlZnNbIHJlZiBdICE9PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdFx0dGhpcy5yZXNvbHZlKCBpLCB0cnVlLCBpbmRleFJlZnNbIHJlZiBdICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5zY291dHMucHVzaCggbmV3IFJlZmVyZW5jZVNjb3V0KCB0aGlzLCByZWYsIG11c3RhY2hlLnBhcmVudEZyYWdtZW50LCBpICkgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0dGhpcy5yZWFkeSA9IHRydWU7XG5cdFx0XHR0aGlzLmJ1YmJsZSgpO1xuXHRcdH07XG5cdFx0RXhwcmVzc2lvblJlc29sdmVyLnByb3RvdHlwZSA9IHtcblx0XHRcdGJ1YmJsZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBvbGRLZXlwYXRoO1xuXHRcdFx0XHRpZiAoICF0aGlzLnJlYWR5ICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRvbGRLZXlwYXRoID0gdGhpcy5rZXlwYXRoO1xuXHRcdFx0XHR0aGlzLnVuaXF1ZVN0cmluZyA9IGdldFVuaXF1ZVN0cmluZyggdGhpcy5zdHIsIHRoaXMuYXJncyApO1xuXHRcdFx0XHR0aGlzLmtleXBhdGggPSBnZXRLZXlwYXRoKCB0aGlzLnVuaXF1ZVN0cmluZyApO1xuXHRcdFx0XHRpZiAoIHRoaXMua2V5cGF0aC5zdWJzdHIoIDAsIDIgKSA9PT0gJyR7JyApIHtcblx0XHRcdFx0XHR0aGlzLmNyZWF0ZUV2YWx1YXRvcigpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMubXVzdGFjaGUucmVzb2x2ZSggdGhpcy5rZXlwYXRoICk7XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR3aGlsZSAoIHRoaXMuc2NvdXRzLmxlbmd0aCApIHtcblx0XHRcdFx0XHR0aGlzLnNjb3V0cy5wb3AoKS50ZWFyZG93bigpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0cmVzb2x2ZTogZnVuY3Rpb24oIGFyZ051bSwgaXNJbmRleFJlZiwgdmFsdWUgKSB7XG5cdFx0XHRcdHRoaXMuYXJnc1sgYXJnTnVtIF0gPSBbXG5cdFx0XHRcdFx0aXNJbmRleFJlZixcblx0XHRcdFx0XHR2YWx1ZVxuXHRcdFx0XHRdO1xuXHRcdFx0XHR0aGlzLmJ1YmJsZSgpO1xuXHRcdFx0XHR0aGlzLnJlc29sdmVkID0gIS0tdGhpcy51bnJlc29sdmVkO1xuXHRcdFx0fSxcblx0XHRcdGNyZWF0ZUV2YWx1YXRvcjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBldmFsdWF0b3I7XG5cdFx0XHRcdGlmICggIXRoaXMucm9vdC5fZXZhbHVhdG9yc1sgdGhpcy5rZXlwYXRoIF0gKSB7XG5cdFx0XHRcdFx0ZXZhbHVhdG9yID0gbmV3IEV2YWx1YXRvciggdGhpcy5yb290LCB0aGlzLmtleXBhdGgsIHRoaXMudW5pcXVlU3RyaW5nLCB0aGlzLnN0ciwgdGhpcy5hcmdzLCB0aGlzLm11c3RhY2hlLnByaW9yaXR5ICk7XG5cdFx0XHRcdFx0dGhpcy5yb290Ll9ldmFsdWF0b3JzWyB0aGlzLmtleXBhdGggXSA9IGV2YWx1YXRvcjtcblx0XHRcdFx0XHRldmFsdWF0b3IudXBkYXRlKCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5yb290Ll9ldmFsdWF0b3JzWyB0aGlzLmtleXBhdGggXS5yZWZyZXNoKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBFeHByZXNzaW9uUmVzb2x2ZXI7XG5cdH0oIHJlbmRlcl9zaGFyZWRfRXZhbHVhdG9yX19FdmFsdWF0b3IsIHJlbmRlcl9zaGFyZWRfRXhwcmVzc2lvblJlc29sdmVyX1JlZmVyZW5jZVNjb3V0LCByZW5kZXJfc2hhcmVkX0V4cHJlc3Npb25SZXNvbHZlcl9nZXRVbmlxdWVTdHJpbmcsIHJlbmRlcl9zaGFyZWRfRXhwcmVzc2lvblJlc29sdmVyX2dldEtleXBhdGggKTtcblxuXHR2YXIgcmVuZGVyX3NoYXJlZF9pbml0TXVzdGFjaGUgPSBmdW5jdGlvbiggcnVubG9vcCwgcmVzb2x2ZVJlZiwgRXhwcmVzc2lvblJlc29sdmVyICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uIGluaXRNdXN0YWNoZSggbXVzdGFjaGUsIG9wdGlvbnMgKSB7XG5cdFx0XHR2YXIga2V5cGF0aCwgaW5kZXhSZWYsIHBhcmVudEZyYWdtZW50O1xuXHRcdFx0cGFyZW50RnJhZ21lbnQgPSBtdXN0YWNoZS5wYXJlbnRGcmFnbWVudCA9IG9wdGlvbnMucGFyZW50RnJhZ21lbnQ7XG5cdFx0XHRtdXN0YWNoZS5yb290ID0gcGFyZW50RnJhZ21lbnQucm9vdDtcblx0XHRcdG11c3RhY2hlLmRlc2NyaXB0b3IgPSBvcHRpb25zLmRlc2NyaXB0b3I7XG5cdFx0XHRtdXN0YWNoZS5pbmRleCA9IG9wdGlvbnMuaW5kZXggfHwgMDtcblx0XHRcdG11c3RhY2hlLnByaW9yaXR5ID0gcGFyZW50RnJhZ21lbnQucHJpb3JpdHk7XG5cdFx0XHRtdXN0YWNoZS50eXBlID0gb3B0aW9ucy5kZXNjcmlwdG9yLnQ7XG5cdFx0XHRpZiAoIG9wdGlvbnMuZGVzY3JpcHRvci5yICkge1xuXHRcdFx0XHRpZiAoIHBhcmVudEZyYWdtZW50LmluZGV4UmVmcyAmJiBwYXJlbnRGcmFnbWVudC5pbmRleFJlZnNbIG9wdGlvbnMuZGVzY3JpcHRvci5yIF0gIT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0XHRpbmRleFJlZiA9IHBhcmVudEZyYWdtZW50LmluZGV4UmVmc1sgb3B0aW9ucy5kZXNjcmlwdG9yLnIgXTtcblx0XHRcdFx0XHRtdXN0YWNoZS5pbmRleFJlZiA9IG9wdGlvbnMuZGVzY3JpcHRvci5yO1xuXHRcdFx0XHRcdG11c3RhY2hlLnZhbHVlID0gaW5kZXhSZWY7XG5cdFx0XHRcdFx0bXVzdGFjaGUucmVuZGVyKCBtdXN0YWNoZS52YWx1ZSApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGtleXBhdGggPSByZXNvbHZlUmVmKCBtdXN0YWNoZS5yb290LCBvcHRpb25zLmRlc2NyaXB0b3IuciwgbXVzdGFjaGUucGFyZW50RnJhZ21lbnQgKTtcblx0XHRcdFx0XHRpZiAoIGtleXBhdGggIT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0XHRcdG11c3RhY2hlLnJlc29sdmUoIGtleXBhdGggKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0bXVzdGFjaGUucmVmID0gb3B0aW9ucy5kZXNjcmlwdG9yLnI7XG5cdFx0XHRcdFx0XHRydW5sb29wLmFkZFVucmVzb2x2ZWQoIG11c3RhY2hlICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIG9wdGlvbnMuZGVzY3JpcHRvci54ICkge1xuXHRcdFx0XHRtdXN0YWNoZS5leHByZXNzaW9uUmVzb2x2ZXIgPSBuZXcgRXhwcmVzc2lvblJlc29sdmVyKCBtdXN0YWNoZSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBtdXN0YWNoZS5kZXNjcmlwdG9yLm4gJiYgIW11c3RhY2hlLmhhc093blByb3BlcnR5KCAndmFsdWUnICkgKSB7XG5cdFx0XHRcdG11c3RhY2hlLnJlbmRlciggdW5kZWZpbmVkICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fSggZ2xvYmFsX3J1bmxvb3AsIHNoYXJlZF9yZXNvbHZlUmVmLCByZW5kZXJfc2hhcmVkX0V4cHJlc3Npb25SZXNvbHZlcl9fRXhwcmVzc2lvblJlc29sdmVyICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9TZWN0aW9uX3JlYXNzaWduRnJhZ21lbnQgPSBmdW5jdGlvbiggdHlwZXMsIEV4cHJlc3Npb25SZXNvbHZlciApIHtcblxuXHRcdHJldHVybiByZWFzc2lnbkZyYWdtZW50O1xuXG5cdFx0ZnVuY3Rpb24gcmVhc3NpZ25GcmFnbWVudCggZnJhZ21lbnQsIGluZGV4UmVmLCBuZXdJbmRleCwgb2xkS2V5cGF0aCwgbmV3S2V5cGF0aCApIHtcblx0XHRcdHZhciBpLCBpdGVtLCBxdWVyeTtcblx0XHRcdGlmICggZnJhZ21lbnQuaHRtbCAhPT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRhc3NpZ25OZXdLZXlwYXRoKCBmcmFnbWVudCwgJ2NvbnRleHQnLCBvbGRLZXlwYXRoLCBuZXdLZXlwYXRoICk7XG5cdFx0XHRpZiAoIGZyYWdtZW50LmluZGV4UmVmcyAmJiBmcmFnbWVudC5pbmRleFJlZnNbIGluZGV4UmVmIF0gIT09IHVuZGVmaW5lZCAmJiBmcmFnbWVudC5pbmRleFJlZnNbIGluZGV4UmVmIF0gIT09IG5ld0luZGV4ICkge1xuXHRcdFx0XHRmcmFnbWVudC5pbmRleFJlZnNbIGluZGV4UmVmIF0gPSBuZXdJbmRleDtcblx0XHRcdH1cblx0XHRcdGkgPSBmcmFnbWVudC5pdGVtcy5sZW5ndGg7XG5cdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0aXRlbSA9IGZyYWdtZW50Lml0ZW1zWyBpIF07XG5cdFx0XHRcdHN3aXRjaCAoIGl0ZW0udHlwZSApIHtcblx0XHRcdFx0XHRjYXNlIHR5cGVzLkVMRU1FTlQ6XG5cdFx0XHRcdFx0XHRyZWFzc2lnbkVsZW1lbnQoIGl0ZW0sIGluZGV4UmVmLCBuZXdJbmRleCwgb2xkS2V5cGF0aCwgbmV3S2V5cGF0aCApO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSB0eXBlcy5QQVJUSUFMOlxuXHRcdFx0XHRcdFx0cmVhc3NpZ25GcmFnbWVudCggaXRlbS5mcmFnbWVudCwgaW5kZXhSZWYsIG5ld0luZGV4LCBvbGRLZXlwYXRoLCBuZXdLZXlwYXRoICk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlIHR5cGVzLkNPTVBPTkVOVDpcblx0XHRcdFx0XHRcdHJlYXNzaWduRnJhZ21lbnQoIGl0ZW0uaW5zdGFuY2UuZnJhZ21lbnQsIGluZGV4UmVmLCBuZXdJbmRleCwgb2xkS2V5cGF0aCwgbmV3S2V5cGF0aCApO1xuXHRcdFx0XHRcdFx0aWYgKCBxdWVyeSA9IGZyYWdtZW50LnJvb3QuX2xpdmVDb21wb25lbnRRdWVyaWVzWyBpdGVtLm5hbWUgXSApIHtcblx0XHRcdFx0XHRcdFx0cXVlcnkuX21ha2VEaXJ0eSgpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSB0eXBlcy5TRUNUSU9OOlxuXHRcdFx0XHRcdGNhc2UgdHlwZXMuSU5URVJQT0xBVE9SOlxuXHRcdFx0XHRcdGNhc2UgdHlwZXMuVFJJUExFOlxuXHRcdFx0XHRcdFx0cmVhc3NpZ25NdXN0YWNoZSggaXRlbSwgaW5kZXhSZWYsIG5ld0luZGV4LCBvbGRLZXlwYXRoLCBuZXdLZXlwYXRoICk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGFzc2lnbk5ld0tleXBhdGgoIHRhcmdldCwgcHJvcGVydHksIG9sZEtleXBhdGgsIG5ld0tleXBhdGggKSB7XG5cdFx0XHRpZiAoICF0YXJnZXRbIHByb3BlcnR5IF0gfHwgc3RhcnRzV2l0aCggdGFyZ2V0WyBwcm9wZXJ0eSBdLCBuZXdLZXlwYXRoICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRhcmdldFsgcHJvcGVydHkgXSA9IGdldE5ld0tleXBhdGgoIHRhcmdldFsgcHJvcGVydHkgXSwgb2xkS2V5cGF0aCwgbmV3S2V5cGF0aCApO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHN0YXJ0c1dpdGgoIHRhcmdldCwga2V5cGF0aCApIHtcblx0XHRcdHJldHVybiB0YXJnZXQgPT09IGtleXBhdGggfHwgc3RhcnRzV2l0aEtleXBhdGgoIHRhcmdldCwga2V5cGF0aCApO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHN0YXJ0c1dpdGhLZXlwYXRoKCB0YXJnZXQsIGtleXBhdGggKSB7XG5cdFx0XHRyZXR1cm4gdGFyZ2V0LnN1YnN0ciggMCwga2V5cGF0aC5sZW5ndGggKyAxICkgPT09IGtleXBhdGggKyAnLic7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0TmV3S2V5cGF0aCggdGFyZ2V0S2V5cGF0aCwgb2xkS2V5cGF0aCwgbmV3S2V5cGF0aCApIHtcblx0XHRcdGlmICggdGFyZ2V0S2V5cGF0aCA9PT0gb2xkS2V5cGF0aCApIHtcblx0XHRcdFx0cmV0dXJuIG5ld0tleXBhdGg7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHN0YXJ0c1dpdGhLZXlwYXRoKCB0YXJnZXRLZXlwYXRoLCBvbGRLZXlwYXRoICkgKSB7XG5cdFx0XHRcdHJldHVybiB0YXJnZXRLZXlwYXRoLnJlcGxhY2UoIG9sZEtleXBhdGggKyAnLicsIG5ld0tleXBhdGggKyAnLicgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRmdW5jdGlvbiByZWFzc2lnbkVsZW1lbnQoIGVsZW1lbnQsIGluZGV4UmVmLCBuZXdJbmRleCwgb2xkS2V5cGF0aCwgbmV3S2V5cGF0aCApIHtcblx0XHRcdHZhciBpLCBhdHRyaWJ1dGUsIHN0b3JhZ2UsIG1hc3RlckV2ZW50TmFtZSwgcHJveGllcywgcHJveHksIGJpbmRpbmcsIGJpbmRpbmdzLCBsaXZlUXVlcmllcywgcmFjdGl2ZTtcblx0XHRcdGkgPSBlbGVtZW50LmF0dHJpYnV0ZXMubGVuZ3RoO1xuXHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdGF0dHJpYnV0ZSA9IGVsZW1lbnQuYXR0cmlidXRlc1sgaSBdO1xuXHRcdFx0XHRpZiAoIGF0dHJpYnV0ZS5mcmFnbWVudCApIHtcblx0XHRcdFx0XHRyZWFzc2lnbkZyYWdtZW50KCBhdHRyaWJ1dGUuZnJhZ21lbnQsIGluZGV4UmVmLCBuZXdJbmRleCwgb2xkS2V5cGF0aCwgbmV3S2V5cGF0aCApO1xuXHRcdFx0XHRcdGlmICggYXR0cmlidXRlLnR3b3dheSApIHtcblx0XHRcdFx0XHRcdGF0dHJpYnV0ZS51cGRhdGVCaW5kaW5ncygpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCBzdG9yYWdlID0gZWxlbWVudC5ub2RlLl9yYWN0aXZlICkge1xuXHRcdFx0XHRhc3NpZ25OZXdLZXlwYXRoKCBzdG9yYWdlLCAna2V5cGF0aCcsIG9sZEtleXBhdGgsIG5ld0tleXBhdGggKTtcblx0XHRcdFx0aWYgKCBpbmRleFJlZiAhPSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdFx0c3RvcmFnZS5pbmRleFsgaW5kZXhSZWYgXSA9IG5ld0luZGV4O1xuXHRcdFx0XHR9XG5cdFx0XHRcdGZvciAoIG1hc3RlckV2ZW50TmFtZSBpbiBzdG9yYWdlLmV2ZW50cyApIHtcblx0XHRcdFx0XHRwcm94aWVzID0gc3RvcmFnZS5ldmVudHNbIG1hc3RlckV2ZW50TmFtZSBdLnByb3hpZXM7XG5cdFx0XHRcdFx0aSA9IHByb3hpZXMubGVuZ3RoO1xuXHRcdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdFx0cHJveHkgPSBwcm94aWVzWyBpIF07XG5cdFx0XHRcdFx0XHRpZiAoIHR5cGVvZiBwcm94eS5uID09PSAnb2JqZWN0JyApIHtcblx0XHRcdFx0XHRcdFx0cmVhc3NpZ25GcmFnbWVudCggcHJveHkuYSwgaW5kZXhSZWYsIG5ld0luZGV4LCBvbGRLZXlwYXRoLCBuZXdLZXlwYXRoICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoIHByb3h5LmQgKSB7XG5cdFx0XHRcdFx0XHRcdHJlYXNzaWduRnJhZ21lbnQoIHByb3h5LmQsIGluZGV4UmVmLCBuZXdJbmRleCwgb2xkS2V5cGF0aCwgbmV3S2V5cGF0aCApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIGJpbmRpbmcgPSBzdG9yYWdlLmJpbmRpbmcgKSB7XG5cdFx0XHRcdFx0aWYgKCBiaW5kaW5nLmtleXBhdGguc3Vic3RyKCAwLCBvbGRLZXlwYXRoLmxlbmd0aCApID09PSBvbGRLZXlwYXRoICkge1xuXHRcdFx0XHRcdFx0YmluZGluZ3MgPSBzdG9yYWdlLnJvb3QuX3R3b3dheUJpbmRpbmdzWyBiaW5kaW5nLmtleXBhdGggXTtcblx0XHRcdFx0XHRcdGJpbmRpbmdzLnNwbGljZSggYmluZGluZ3MuaW5kZXhPZiggYmluZGluZyApLCAxICk7XG5cdFx0XHRcdFx0XHRiaW5kaW5nLmtleXBhdGggPSBiaW5kaW5nLmtleXBhdGgucmVwbGFjZSggb2xkS2V5cGF0aCwgbmV3S2V5cGF0aCApO1xuXHRcdFx0XHRcdFx0YmluZGluZ3MgPSBzdG9yYWdlLnJvb3QuX3R3b3dheUJpbmRpbmdzWyBiaW5kaW5nLmtleXBhdGggXSB8fCAoIHN0b3JhZ2Uucm9vdC5fdHdvd2F5QmluZGluZ3NbIGJpbmRpbmcua2V5cGF0aCBdID0gW10gKTtcblx0XHRcdFx0XHRcdGJpbmRpbmdzLnB1c2goIGJpbmRpbmcgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICggZWxlbWVudC5mcmFnbWVudCApIHtcblx0XHRcdFx0cmVhc3NpZ25GcmFnbWVudCggZWxlbWVudC5mcmFnbWVudCwgaW5kZXhSZWYsIG5ld0luZGV4LCBvbGRLZXlwYXRoLCBuZXdLZXlwYXRoICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGxpdmVRdWVyaWVzID0gZWxlbWVudC5saXZlUXVlcmllcyApIHtcblx0XHRcdFx0cmFjdGl2ZSA9IGVsZW1lbnQucm9vdDtcblx0XHRcdFx0aSA9IGxpdmVRdWVyaWVzLmxlbmd0aDtcblx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0bGl2ZVF1ZXJpZXNbIGkgXS5fbWFrZURpcnR5KCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRmdW5jdGlvbiByZWFzc2lnbk11c3RhY2hlKCBtdXN0YWNoZSwgaW5kZXhSZWYsIG5ld0luZGV4LCBvbGRLZXlwYXRoLCBuZXdLZXlwYXRoICkge1xuXHRcdFx0dmFyIHVwZGF0ZWQsIGk7XG5cdFx0XHRpZiAoIG11c3RhY2hlLmRlc2NyaXB0b3IueCApIHtcblx0XHRcdFx0aWYgKCBtdXN0YWNoZS5leHByZXNzaW9uUmVzb2x2ZXIgKSB7XG5cdFx0XHRcdFx0bXVzdGFjaGUuZXhwcmVzc2lvblJlc29sdmVyLnRlYXJkb3duKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0bXVzdGFjaGUuZXhwcmVzc2lvblJlc29sdmVyID0gbmV3IEV4cHJlc3Npb25SZXNvbHZlciggbXVzdGFjaGUgKTtcblx0XHRcdH1cblx0XHRcdGlmICggbXVzdGFjaGUua2V5cGF0aCApIHtcblx0XHRcdFx0dXBkYXRlZCA9IGdldE5ld0tleXBhdGgoIG11c3RhY2hlLmtleXBhdGgsIG9sZEtleXBhdGgsIG5ld0tleXBhdGggKTtcblx0XHRcdFx0aWYgKCB1cGRhdGVkICkge1xuXHRcdFx0XHRcdG11c3RhY2hlLnJlc29sdmUoIHVwZGF0ZWQgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmICggaW5kZXhSZWYgIT09IHVuZGVmaW5lZCAmJiBtdXN0YWNoZS5pbmRleFJlZiA9PT0gaW5kZXhSZWYgKSB7XG5cdFx0XHRcdG11c3RhY2hlLnZhbHVlID0gbmV3SW5kZXg7XG5cdFx0XHRcdG11c3RhY2hlLnJlbmRlciggbmV3SW5kZXggKTtcblx0XHRcdH1cblx0XHRcdGlmICggbXVzdGFjaGUuZnJhZ21lbnRzICkge1xuXHRcdFx0XHRpID0gbXVzdGFjaGUuZnJhZ21lbnRzLmxlbmd0aDtcblx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0cmVhc3NpZ25GcmFnbWVudCggbXVzdGFjaGUuZnJhZ21lbnRzWyBpIF0sIGluZGV4UmVmLCBuZXdJbmRleCwgb2xkS2V5cGF0aCwgbmV3S2V5cGF0aCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9KCBjb25maWdfdHlwZXMsIHJlbmRlcl9zaGFyZWRfRXhwcmVzc2lvblJlc29sdmVyX19FeHByZXNzaW9uUmVzb2x2ZXIgKTtcblxuXHR2YXIgcmVuZGVyX3NoYXJlZF9yZXNvbHZlTXVzdGFjaGUgPSBmdW5jdGlvbiggdHlwZXMsIHJlZ2lzdGVyRGVwZW5kYW50LCB1bnJlZ2lzdGVyRGVwZW5kYW50LCByZWFzc2lnbkZyYWdtZW50ICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uIHJlc29sdmVNdXN0YWNoZSgga2V5cGF0aCApIHtcblx0XHRcdHZhciBpO1xuXHRcdFx0aWYgKCBrZXlwYXRoID09PSB0aGlzLmtleXBhdGggKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggdGhpcy5yZWdpc3RlcmVkICkge1xuXHRcdFx0XHR1bnJlZ2lzdGVyRGVwZW5kYW50KCB0aGlzICk7XG5cdFx0XHRcdGlmICggdGhpcy50eXBlID09PSB0eXBlcy5TRUNUSU9OICkge1xuXHRcdFx0XHRcdGkgPSB0aGlzLmZyYWdtZW50cy5sZW5ndGg7XG5cdFx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0XHRyZWFzc2lnbkZyYWdtZW50KCB0aGlzLmZyYWdtZW50c1sgaSBdLCBudWxsLCBudWxsLCB0aGlzLmtleXBhdGgsIGtleXBhdGggKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHRoaXMua2V5cGF0aCA9IGtleXBhdGg7XG5cdFx0XHRyZWdpc3RlckRlcGVuZGFudCggdGhpcyApO1xuXHRcdFx0dGhpcy51cGRhdGUoKTtcblx0XHRcdGlmICggdGhpcy5yb290LnR3b3dheSAmJiB0aGlzLnBhcmVudEZyYWdtZW50Lm93bmVyLnR5cGUgPT09IHR5cGVzLkFUVFJJQlVURSApIHtcblx0XHRcdFx0dGhpcy5wYXJlbnRGcmFnbWVudC5vd25lci5lbGVtZW50LmJpbmQoKTtcblx0XHRcdH1cblx0XHRcdGlmICggdGhpcy5leHByZXNzaW9uUmVzb2x2ZXIgJiYgdGhpcy5leHByZXNzaW9uUmVzb2x2ZXIucmVzb2x2ZWQgKSB7XG5cdFx0XHRcdHRoaXMuZXhwcmVzc2lvblJlc29sdmVyID0gbnVsbDtcblx0XHRcdH1cblx0XHR9O1xuXHR9KCBjb25maWdfdHlwZXMsIHNoYXJlZF9yZWdpc3RlckRlcGVuZGFudCwgc2hhcmVkX3VucmVnaXN0ZXJEZXBlbmRhbnQsIHJlbmRlcl9Eb21GcmFnbWVudF9TZWN0aW9uX3JlYXNzaWduRnJhZ21lbnQgKTtcblxuXHR2YXIgcmVuZGVyX3NoYXJlZF91cGRhdGVNdXN0YWNoZSA9IGZ1bmN0aW9uKCBpc0VxdWFsLCBnZXQgKSB7XG5cblx0XHR2YXIgb3B0aW9ucyA9IHtcblx0XHRcdGV2YWx1YXRlV3JhcHBlZDogdHJ1ZVxuXHRcdH07XG5cdFx0cmV0dXJuIGZ1bmN0aW9uIHVwZGF0ZU11c3RhY2hlKCkge1xuXHRcdFx0dmFyIHZhbHVlID0gZ2V0KCB0aGlzLnJvb3QsIHRoaXMua2V5cGF0aCwgb3B0aW9ucyApO1xuXHRcdFx0aWYgKCAhaXNFcXVhbCggdmFsdWUsIHRoaXMudmFsdWUgKSApIHtcblx0XHRcdFx0dGhpcy5yZW5kZXIoIHZhbHVlICk7XG5cdFx0XHRcdHRoaXMudmFsdWUgPSB2YWx1ZTtcblx0XHRcdH1cblx0XHR9O1xuXHR9KCB1dGlsc19pc0VxdWFsLCBzaGFyZWRfZ2V0X19nZXQgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0ludGVycG9sYXRvciA9IGZ1bmN0aW9uKCB0eXBlcywgdGVhcmRvd24sIGluaXRNdXN0YWNoZSwgcmVzb2x2ZU11c3RhY2hlLCB1cGRhdGVNdXN0YWNoZSwgZGV0YWNoICkge1xuXG5cdFx0dmFyIERvbUludGVycG9sYXRvciwgbGVzc1RoYW4sIGdyZWF0ZXJUaGFuO1xuXHRcdGxlc3NUaGFuID0gLzwvZztcblx0XHRncmVhdGVyVGhhbiA9IC8+L2c7XG5cdFx0RG9tSW50ZXJwb2xhdG9yID0gZnVuY3Rpb24oIG9wdGlvbnMsIGRvY0ZyYWcgKSB7XG5cdFx0XHR0aGlzLnR5cGUgPSB0eXBlcy5JTlRFUlBPTEFUT1I7XG5cdFx0XHRpZiAoIGRvY0ZyYWcgKSB7XG5cdFx0XHRcdHRoaXMubm9kZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCAnJyApO1xuXHRcdFx0XHRkb2NGcmFnLmFwcGVuZENoaWxkKCB0aGlzLm5vZGUgKTtcblx0XHRcdH1cblx0XHRcdGluaXRNdXN0YWNoZSggdGhpcywgb3B0aW9ucyApO1xuXHRcdH07XG5cdFx0RG9tSW50ZXJwb2xhdG9yLnByb3RvdHlwZSA9IHtcblx0XHRcdHVwZGF0ZTogdXBkYXRlTXVzdGFjaGUsXG5cdFx0XHRyZXNvbHZlOiByZXNvbHZlTXVzdGFjaGUsXG5cdFx0XHRkZXRhY2g6IGRldGFjaCxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbiggZGVzdHJveSApIHtcblx0XHRcdFx0aWYgKCBkZXN0cm95ICkge1xuXHRcdFx0XHRcdHRoaXMuZGV0YWNoKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGVhcmRvd24oIHRoaXMgKTtcblx0XHRcdH0sXG5cdFx0XHRyZW5kZXI6IGZ1bmN0aW9uKCB2YWx1ZSApIHtcblx0XHRcdFx0aWYgKCB0aGlzLm5vZGUgKSB7XG5cdFx0XHRcdFx0dGhpcy5ub2RlLmRhdGEgPSB2YWx1ZSA9PSB1bmRlZmluZWQgPyAnJyA6IHZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0Zmlyc3ROb2RlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMubm9kZTtcblx0XHRcdH0sXG5cdFx0XHR0b1N0cmluZzogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciB2YWx1ZSA9IHRoaXMudmFsdWUgIT0gdW5kZWZpbmVkID8gJycgKyB0aGlzLnZhbHVlIDogJyc7XG5cdFx0XHRcdHJldHVybiB2YWx1ZS5yZXBsYWNlKCBsZXNzVGhhbiwgJyZsdDsnICkucmVwbGFjZSggZ3JlYXRlclRoYW4sICcmZ3Q7JyApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIERvbUludGVycG9sYXRvcjtcblx0fSggY29uZmlnX3R5cGVzLCBzaGFyZWRfdGVhcmRvd24sIHJlbmRlcl9zaGFyZWRfaW5pdE11c3RhY2hlLCByZW5kZXJfc2hhcmVkX3Jlc29sdmVNdXN0YWNoZSwgcmVuZGVyX3NoYXJlZF91cGRhdGVNdXN0YWNoZSwgcmVuZGVyX0RvbUZyYWdtZW50X3NoYXJlZF9kZXRhY2ggKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X1NlY3Rpb25fcHJvdG90eXBlX21lcmdlID0gZnVuY3Rpb24oIHJlYXNzaWduRnJhZ21lbnQgKSB7XG5cblx0XHR2YXIgdG9UZWFyZG93biA9IFtdO1xuXHRcdHJldHVybiBmdW5jdGlvbiBzZWN0aW9uTWVyZ2UoIG5ld0luZGljZXMgKSB7XG5cdFx0XHR2YXIgc2VjdGlvbiA9IHRoaXMsXG5cdFx0XHRcdHBhcmVudEZyYWdtZW50LCBmaXJzdENoYW5nZSwgaSwgbmV3TGVuZ3RoLCByZWFzc2lnbmVkRnJhZ21lbnRzLCBmcmFnbWVudE9wdGlvbnMsIGZyYWdtZW50LCBuZXh0Tm9kZTtcblx0XHRcdHBhcmVudEZyYWdtZW50ID0gdGhpcy5wYXJlbnRGcmFnbWVudDtcblx0XHRcdHJlYXNzaWduZWRGcmFnbWVudHMgPSBbXTtcblx0XHRcdG5ld0luZGljZXMuZm9yRWFjaCggZnVuY3Rpb24gcmVhc3NpZ25JZk5lY2Vzc2FyeSggbmV3SW5kZXgsIG9sZEluZGV4ICkge1xuXHRcdFx0XHR2YXIgZnJhZ21lbnQsIGJ5LCBvbGRLZXlwYXRoLCBuZXdLZXlwYXRoO1xuXHRcdFx0XHRpZiAoIG5ld0luZGV4ID09PSBvbGRJbmRleCApIHtcblx0XHRcdFx0XHRyZWFzc2lnbmVkRnJhZ21lbnRzWyBuZXdJbmRleCBdID0gc2VjdGlvbi5mcmFnbWVudHNbIG9sZEluZGV4IF07XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggZmlyc3RDaGFuZ2UgPT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0XHRmaXJzdENoYW5nZSA9IG9sZEluZGV4O1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggbmV3SW5kZXggPT09IC0xICkge1xuXHRcdFx0XHRcdHRvVGVhcmRvd24ucHVzaCggc2VjdGlvbi5mcmFnbWVudHNbIG9sZEluZGV4IF0gKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0ZnJhZ21lbnQgPSBzZWN0aW9uLmZyYWdtZW50c1sgb2xkSW5kZXggXTtcblx0XHRcdFx0YnkgPSBuZXdJbmRleCAtIG9sZEluZGV4O1xuXHRcdFx0XHRvbGRLZXlwYXRoID0gc2VjdGlvbi5rZXlwYXRoICsgJy4nICsgb2xkSW5kZXg7XG5cdFx0XHRcdG5ld0tleXBhdGggPSBzZWN0aW9uLmtleXBhdGggKyAnLicgKyBuZXdJbmRleDtcblx0XHRcdFx0cmVhc3NpZ25GcmFnbWVudCggZnJhZ21lbnQsIHNlY3Rpb24uZGVzY3JpcHRvci5pLCBvbGRJbmRleCwgbmV3SW5kZXgsIGJ5LCBvbGRLZXlwYXRoLCBuZXdLZXlwYXRoICk7XG5cdFx0XHRcdHJlYXNzaWduZWRGcmFnbWVudHNbIG5ld0luZGV4IF0gPSBmcmFnbWVudDtcblx0XHRcdH0gKTtcblx0XHRcdHdoaWxlICggZnJhZ21lbnQgPSB0b1RlYXJkb3duLnBvcCgpICkge1xuXHRcdFx0XHRmcmFnbWVudC50ZWFyZG93biggdHJ1ZSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBmaXJzdENoYW5nZSA9PT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRmaXJzdENoYW5nZSA9IHRoaXMubGVuZ3RoO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5sZW5ndGggPSBuZXdMZW5ndGggPSB0aGlzLnJvb3QuZ2V0KCB0aGlzLmtleXBhdGggKS5sZW5ndGg7XG5cdFx0XHRpZiAoIG5ld0xlbmd0aCA9PT0gZmlyc3RDaGFuZ2UgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGZyYWdtZW50T3B0aW9ucyA9IHtcblx0XHRcdFx0ZGVzY3JpcHRvcjogdGhpcy5kZXNjcmlwdG9yLmYsXG5cdFx0XHRcdHJvb3Q6IHRoaXMucm9vdCxcblx0XHRcdFx0cE5vZGU6IHBhcmVudEZyYWdtZW50LnBOb2RlLFxuXHRcdFx0XHRvd25lcjogdGhpc1xuXHRcdFx0fTtcblx0XHRcdGlmICggdGhpcy5kZXNjcmlwdG9yLmkgKSB7XG5cdFx0XHRcdGZyYWdtZW50T3B0aW9ucy5pbmRleFJlZiA9IHRoaXMuZGVzY3JpcHRvci5pO1xuXHRcdFx0fVxuXHRcdFx0Zm9yICggaSA9IGZpcnN0Q2hhbmdlOyBpIDwgbmV3TGVuZ3RoOyBpICs9IDEgKSB7XG5cdFx0XHRcdGlmICggZnJhZ21lbnQgPSByZWFzc2lnbmVkRnJhZ21lbnRzWyBpIF0gKSB7XG5cdFx0XHRcdFx0dGhpcy5kb2NGcmFnLmFwcGVuZENoaWxkKCBmcmFnbWVudC5kZXRhY2goIGZhbHNlICkgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRmcmFnbWVudE9wdGlvbnMuY29udGV4dCA9IHRoaXMua2V5cGF0aCArICcuJyArIGk7XG5cdFx0XHRcdFx0ZnJhZ21lbnRPcHRpb25zLmluZGV4ID0gaTtcblx0XHRcdFx0XHRmcmFnbWVudCA9IHRoaXMuY3JlYXRlRnJhZ21lbnQoIGZyYWdtZW50T3B0aW9ucyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuZnJhZ21lbnRzWyBpIF0gPSBmcmFnbWVudDtcblx0XHRcdH1cblx0XHRcdG5leHROb2RlID0gcGFyZW50RnJhZ21lbnQuZmluZE5leHROb2RlKCB0aGlzICk7XG5cdFx0XHRwYXJlbnRGcmFnbWVudC5wTm9kZS5pbnNlcnRCZWZvcmUoIHRoaXMuZG9jRnJhZywgbmV4dE5vZGUgKTtcblx0XHR9O1xuXHR9KCByZW5kZXJfRG9tRnJhZ21lbnRfU2VjdGlvbl9yZWFzc2lnbkZyYWdtZW50ICk7XG5cblx0dmFyIHJlbmRlcl9zaGFyZWRfdXBkYXRlU2VjdGlvbiA9IGZ1bmN0aW9uKCBpc0FycmF5LCBpc09iamVjdCApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiB1cGRhdGVTZWN0aW9uKCBzZWN0aW9uLCB2YWx1ZSApIHtcblx0XHRcdHZhciBmcmFnbWVudE9wdGlvbnMgPSB7XG5cdFx0XHRcdGRlc2NyaXB0b3I6IHNlY3Rpb24uZGVzY3JpcHRvci5mLFxuXHRcdFx0XHRyb290OiBzZWN0aW9uLnJvb3QsXG5cdFx0XHRcdHBOb2RlOiBzZWN0aW9uLnBhcmVudEZyYWdtZW50LnBOb2RlLFxuXHRcdFx0XHRwRWxlbWVudDogc2VjdGlvbi5wYXJlbnRGcmFnbWVudC5wRWxlbWVudCxcblx0XHRcdFx0b3duZXI6IHNlY3Rpb25cblx0XHRcdH07XG5cdFx0XHRpZiAoIHNlY3Rpb24uZGVzY3JpcHRvci5uICkge1xuXHRcdFx0XHR1cGRhdGVDb25kaXRpb25hbFNlY3Rpb24oIHNlY3Rpb24sIHZhbHVlLCB0cnVlLCBmcmFnbWVudE9wdGlvbnMgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBpc0FycmF5KCB2YWx1ZSApICkge1xuXHRcdFx0XHR1cGRhdGVMaXN0U2VjdGlvbiggc2VjdGlvbiwgdmFsdWUsIGZyYWdtZW50T3B0aW9ucyApO1xuXHRcdFx0fSBlbHNlIGlmICggaXNPYmplY3QoIHZhbHVlICkgfHwgdHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0XHRpZiAoIHNlY3Rpb24uZGVzY3JpcHRvci5pICkge1xuXHRcdFx0XHRcdHVwZGF0ZUxpc3RPYmplY3RTZWN0aW9uKCBzZWN0aW9uLCB2YWx1ZSwgZnJhZ21lbnRPcHRpb25zICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dXBkYXRlQ29udGV4dFNlY3Rpb24oIHNlY3Rpb24sIGZyYWdtZW50T3B0aW9ucyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR1cGRhdGVDb25kaXRpb25hbFNlY3Rpb24oIHNlY3Rpb24sIHZhbHVlLCBmYWxzZSwgZnJhZ21lbnRPcHRpb25zICk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGZ1bmN0aW9uIHVwZGF0ZUxpc3RTZWN0aW9uKCBzZWN0aW9uLCB2YWx1ZSwgZnJhZ21lbnRPcHRpb25zICkge1xuXHRcdFx0dmFyIGksIGxlbmd0aCwgZnJhZ21lbnRzVG9SZW1vdmU7XG5cdFx0XHRsZW5ndGggPSB2YWx1ZS5sZW5ndGg7XG5cdFx0XHRpZiAoIGxlbmd0aCA8IHNlY3Rpb24ubGVuZ3RoICkge1xuXHRcdFx0XHRmcmFnbWVudHNUb1JlbW92ZSA9IHNlY3Rpb24uZnJhZ21lbnRzLnNwbGljZSggbGVuZ3RoLCBzZWN0aW9uLmxlbmd0aCAtIGxlbmd0aCApO1xuXHRcdFx0XHR3aGlsZSAoIGZyYWdtZW50c1RvUmVtb3ZlLmxlbmd0aCApIHtcblx0XHRcdFx0XHRmcmFnbWVudHNUb1JlbW92ZS5wb3AoKS50ZWFyZG93biggdHJ1ZSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAoIGxlbmd0aCA+IHNlY3Rpb24ubGVuZ3RoICkge1xuXHRcdFx0XHRcdGZvciAoIGkgPSBzZWN0aW9uLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSArPSAxICkge1xuXHRcdFx0XHRcdFx0ZnJhZ21lbnRPcHRpb25zLmNvbnRleHQgPSBzZWN0aW9uLmtleXBhdGggKyAnLicgKyBpO1xuXHRcdFx0XHRcdFx0ZnJhZ21lbnRPcHRpb25zLmluZGV4ID0gaTtcblx0XHRcdFx0XHRcdGlmICggc2VjdGlvbi5kZXNjcmlwdG9yLmkgKSB7XG5cdFx0XHRcdFx0XHRcdGZyYWdtZW50T3B0aW9ucy5pbmRleFJlZiA9IHNlY3Rpb24uZGVzY3JpcHRvci5pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0c2VjdGlvbi5mcmFnbWVudHNbIGkgXSA9IHNlY3Rpb24uY3JlYXRlRnJhZ21lbnQoIGZyYWdtZW50T3B0aW9ucyApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0c2VjdGlvbi5sZW5ndGggPSBsZW5ndGg7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gdXBkYXRlTGlzdE9iamVjdFNlY3Rpb24oIHNlY3Rpb24sIHZhbHVlLCBmcmFnbWVudE9wdGlvbnMgKSB7XG5cdFx0XHR2YXIgaWQsIGksIGhhc0tleSwgZnJhZ21lbnQ7XG5cdFx0XHRoYXNLZXkgPSBzZWN0aW9uLmhhc0tleSB8fCAoIHNlY3Rpb24uaGFzS2V5ID0ge30gKTtcblx0XHRcdGkgPSBzZWN0aW9uLmZyYWdtZW50cy5sZW5ndGg7XG5cdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0ZnJhZ21lbnQgPSBzZWN0aW9uLmZyYWdtZW50c1sgaSBdO1xuXHRcdFx0XHRpZiAoICEoIGZyYWdtZW50LmluZGV4IGluIHZhbHVlICkgKSB7XG5cdFx0XHRcdFx0c2VjdGlvbi5mcmFnbWVudHNbIGkgXS50ZWFyZG93biggdHJ1ZSApO1xuXHRcdFx0XHRcdHNlY3Rpb24uZnJhZ21lbnRzLnNwbGljZSggaSwgMSApO1xuXHRcdFx0XHRcdGhhc0tleVsgZnJhZ21lbnQuaW5kZXggXSA9IGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRmb3IgKCBpZCBpbiB2YWx1ZSApIHtcblx0XHRcdFx0aWYgKCAhaGFzS2V5WyBpZCBdICkge1xuXHRcdFx0XHRcdGZyYWdtZW50T3B0aW9ucy5jb250ZXh0ID0gc2VjdGlvbi5rZXlwYXRoICsgJy4nICsgaWQ7XG5cdFx0XHRcdFx0ZnJhZ21lbnRPcHRpb25zLmluZGV4ID0gaWQ7XG5cdFx0XHRcdFx0aWYgKCBzZWN0aW9uLmRlc2NyaXB0b3IuaSApIHtcblx0XHRcdFx0XHRcdGZyYWdtZW50T3B0aW9ucy5pbmRleFJlZiA9IHNlY3Rpb24uZGVzY3JpcHRvci5pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRzZWN0aW9uLmZyYWdtZW50cy5wdXNoKCBzZWN0aW9uLmNyZWF0ZUZyYWdtZW50KCBmcmFnbWVudE9wdGlvbnMgKSApO1xuXHRcdFx0XHRcdGhhc0tleVsgaWQgXSA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHNlY3Rpb24ubGVuZ3RoID0gc2VjdGlvbi5mcmFnbWVudHMubGVuZ3RoO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHVwZGF0ZUNvbnRleHRTZWN0aW9uKCBzZWN0aW9uLCBmcmFnbWVudE9wdGlvbnMgKSB7XG5cdFx0XHRpZiAoICFzZWN0aW9uLmxlbmd0aCApIHtcblx0XHRcdFx0ZnJhZ21lbnRPcHRpb25zLmNvbnRleHQgPSBzZWN0aW9uLmtleXBhdGg7XG5cdFx0XHRcdGZyYWdtZW50T3B0aW9ucy5pbmRleCA9IDA7XG5cdFx0XHRcdHNlY3Rpb24uZnJhZ21lbnRzWyAwIF0gPSBzZWN0aW9uLmNyZWF0ZUZyYWdtZW50KCBmcmFnbWVudE9wdGlvbnMgKTtcblx0XHRcdFx0c2VjdGlvbi5sZW5ndGggPSAxO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHVwZGF0ZUNvbmRpdGlvbmFsU2VjdGlvbiggc2VjdGlvbiwgdmFsdWUsIGludmVydGVkLCBmcmFnbWVudE9wdGlvbnMgKSB7XG5cdFx0XHR2YXIgZG9SZW5kZXIsIGVtcHR5QXJyYXksIGZyYWdtZW50c1RvUmVtb3ZlLCBmcmFnbWVudDtcblx0XHRcdGVtcHR5QXJyYXkgPSBpc0FycmF5KCB2YWx1ZSApICYmIHZhbHVlLmxlbmd0aCA9PT0gMDtcblx0XHRcdGlmICggaW52ZXJ0ZWQgKSB7XG5cdFx0XHRcdGRvUmVuZGVyID0gZW1wdHlBcnJheSB8fCAhdmFsdWU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRkb1JlbmRlciA9IHZhbHVlICYmICFlbXB0eUFycmF5O1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBkb1JlbmRlciApIHtcblx0XHRcdFx0aWYgKCAhc2VjdGlvbi5sZW5ndGggKSB7XG5cdFx0XHRcdFx0ZnJhZ21lbnRPcHRpb25zLmluZGV4ID0gMDtcblx0XHRcdFx0XHRzZWN0aW9uLmZyYWdtZW50c1sgMCBdID0gc2VjdGlvbi5jcmVhdGVGcmFnbWVudCggZnJhZ21lbnRPcHRpb25zICk7XG5cdFx0XHRcdFx0c2VjdGlvbi5sZW5ndGggPSAxO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggc2VjdGlvbi5sZW5ndGggPiAxICkge1xuXHRcdFx0XHRcdGZyYWdtZW50c1RvUmVtb3ZlID0gc2VjdGlvbi5mcmFnbWVudHMuc3BsaWNlKCAxICk7XG5cdFx0XHRcdFx0d2hpbGUgKCBmcmFnbWVudCA9IGZyYWdtZW50c1RvUmVtb3ZlLnBvcCgpICkge1xuXHRcdFx0XHRcdFx0ZnJhZ21lbnQudGVhcmRvd24oIHRydWUgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoIHNlY3Rpb24ubGVuZ3RoICkge1xuXHRcdFx0XHRzZWN0aW9uLnRlYXJkb3duRnJhZ21lbnRzKCB0cnVlICk7XG5cdFx0XHRcdHNlY3Rpb24ubGVuZ3RoID0gMDtcblx0XHRcdH1cblx0XHR9XG5cdH0oIHV0aWxzX2lzQXJyYXksIHV0aWxzX2lzT2JqZWN0ICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9TZWN0aW9uX3Byb3RvdHlwZV9yZW5kZXIgPSBmdW5jdGlvbiggaXNDbGllbnQsIHVwZGF0ZVNlY3Rpb24gKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24gRG9tU2VjdGlvbl9wcm90b3R5cGVfcmVuZGVyKCB2YWx1ZSApIHtcblx0XHRcdHZhciBuZXh0Tm9kZSwgd3JhcHBlZDtcblx0XHRcdGlmICggd3JhcHBlZCA9IHRoaXMucm9vdC5fd3JhcHBlZFsgdGhpcy5rZXlwYXRoIF0gKSB7XG5cdFx0XHRcdHZhbHVlID0gd3JhcHBlZC5nZXQoKTtcblx0XHRcdH1cblx0XHRcdGlmICggdGhpcy5yZW5kZXJpbmcgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMucmVuZGVyaW5nID0gdHJ1ZTtcblx0XHRcdHVwZGF0ZVNlY3Rpb24oIHRoaXMsIHZhbHVlICk7XG5cdFx0XHR0aGlzLnJlbmRlcmluZyA9IGZhbHNlO1xuXHRcdFx0aWYgKCB0aGlzLmRvY0ZyYWcgJiYgIXRoaXMuZG9jRnJhZy5jaGlsZE5vZGVzLmxlbmd0aCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhdGhpcy5pbml0aWFsaXNpbmcgJiYgaXNDbGllbnQgKSB7XG5cdFx0XHRcdG5leHROb2RlID0gdGhpcy5wYXJlbnRGcmFnbWVudC5maW5kTmV4dE5vZGUoIHRoaXMgKTtcblx0XHRcdFx0aWYgKCBuZXh0Tm9kZSAmJiBuZXh0Tm9kZS5wYXJlbnROb2RlID09PSB0aGlzLnBhcmVudEZyYWdtZW50LnBOb2RlICkge1xuXHRcdFx0XHRcdHRoaXMucGFyZW50RnJhZ21lbnQucE5vZGUuaW5zZXJ0QmVmb3JlKCB0aGlzLmRvY0ZyYWcsIG5leHROb2RlICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5wYXJlbnRGcmFnbWVudC5wTm9kZS5hcHBlbmRDaGlsZCggdGhpcy5kb2NGcmFnICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHR9KCBjb25maWdfaXNDbGllbnQsIHJlbmRlcl9zaGFyZWRfdXBkYXRlU2VjdGlvbiApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfU2VjdGlvbl9yZWFzc2lnbkZyYWdtZW50cyA9IGZ1bmN0aW9uKCByZWFzc2lnbkZyYWdtZW50ICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBzZWN0aW9uLCBzdGFydCwgZW5kLCBieSApIHtcblx0XHRcdGlmICggc3RhcnQgKyBieSA9PT0gZW5kICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHN0YXJ0ID09PSBlbmQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHZhciBpLCBmcmFnbWVudCwgaW5kZXhSZWYsIG9sZEluZGV4LCBuZXdJbmRleCwgb2xkS2V5cGF0aCwgbmV3S2V5cGF0aDtcblx0XHRcdGluZGV4UmVmID0gc2VjdGlvbi5kZXNjcmlwdG9yLmk7XG5cdFx0XHRmb3IgKCBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkgKz0gMSApIHtcblx0XHRcdFx0ZnJhZ21lbnQgPSBzZWN0aW9uLmZyYWdtZW50c1sgaSBdO1xuXHRcdFx0XHRvbGRJbmRleCA9IGkgLSBieTtcblx0XHRcdFx0bmV3SW5kZXggPSBpO1xuXHRcdFx0XHRvbGRLZXlwYXRoID0gc2VjdGlvbi5rZXlwYXRoICsgJy4nICsgKCBpIC0gYnkgKTtcblx0XHRcdFx0bmV3S2V5cGF0aCA9IHNlY3Rpb24ua2V5cGF0aCArICcuJyArIGk7XG5cdFx0XHRcdGZyYWdtZW50LmluZGV4ICs9IGJ5O1xuXHRcdFx0XHRyZWFzc2lnbkZyYWdtZW50KCBmcmFnbWVudCwgaW5kZXhSZWYsIG5ld0luZGV4LCBvbGRLZXlwYXRoLCBuZXdLZXlwYXRoICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fSggcmVuZGVyX0RvbUZyYWdtZW50X1NlY3Rpb25fcmVhc3NpZ25GcmFnbWVudCApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfU2VjdGlvbl9wcm90b3R5cGVfc3BsaWNlID0gZnVuY3Rpb24oIHJlYXNzaWduRnJhZ21lbnRzICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBzcGxpY2VTdW1tYXJ5ICkge1xuXHRcdFx0dmFyIHNlY3Rpb24gPSB0aGlzLFxuXHRcdFx0XHRpbnNlcnRpb25Qb2ludCwgYmFsYW5jZSwgaSwgc3RhcnQsIGVuZCwgaW5zZXJ0U3RhcnQsIGluc2VydEVuZCwgc3BsaWNlQXJncywgZnJhZ21lbnRPcHRpb25zO1xuXHRcdFx0YmFsYW5jZSA9IHNwbGljZVN1bW1hcnkuYmFsYW5jZTtcblx0XHRcdGlmICggIWJhbGFuY2UgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHNlY3Rpb24ucmVuZGVyaW5nID0gdHJ1ZTtcblx0XHRcdHN0YXJ0ID0gc3BsaWNlU3VtbWFyeS5zdGFydDtcblx0XHRcdGlmICggYmFsYW5jZSA8IDAgKSB7XG5cdFx0XHRcdGVuZCA9IHN0YXJ0IC0gYmFsYW5jZTtcblx0XHRcdFx0Zm9yICggaSA9IHN0YXJ0OyBpIDwgZW5kOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0c2VjdGlvbi5mcmFnbWVudHNbIGkgXS50ZWFyZG93biggdHJ1ZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNlY3Rpb24uZnJhZ21lbnRzLnNwbGljZSggc3RhcnQsIC1iYWxhbmNlICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRmcmFnbWVudE9wdGlvbnMgPSB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRvcjogc2VjdGlvbi5kZXNjcmlwdG9yLmYsXG5cdFx0XHRcdFx0cm9vdDogc2VjdGlvbi5yb290LFxuXHRcdFx0XHRcdHBOb2RlOiBzZWN0aW9uLnBhcmVudEZyYWdtZW50LnBOb2RlLFxuXHRcdFx0XHRcdG93bmVyOiBzZWN0aW9uXG5cdFx0XHRcdH07XG5cdFx0XHRcdGlmICggc2VjdGlvbi5kZXNjcmlwdG9yLmkgKSB7XG5cdFx0XHRcdFx0ZnJhZ21lbnRPcHRpb25zLmluZGV4UmVmID0gc2VjdGlvbi5kZXNjcmlwdG9yLmk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aW5zZXJ0U3RhcnQgPSBzdGFydCArIHNwbGljZVN1bW1hcnkucmVtb3ZlZDtcblx0XHRcdFx0aW5zZXJ0RW5kID0gc3RhcnQgKyBzcGxpY2VTdW1tYXJ5LmFkZGVkO1xuXHRcdFx0XHRpbnNlcnRpb25Qb2ludCA9IHNlY3Rpb24uZnJhZ21lbnRzWyBpbnNlcnRTdGFydCBdID8gc2VjdGlvbi5mcmFnbWVudHNbIGluc2VydFN0YXJ0IF0uZmlyc3ROb2RlKCkgOiBzZWN0aW9uLnBhcmVudEZyYWdtZW50LmZpbmROZXh0Tm9kZSggc2VjdGlvbiApO1xuXHRcdFx0XHRzcGxpY2VBcmdzID0gW1xuXHRcdFx0XHRcdGluc2VydFN0YXJ0LFxuXHRcdFx0XHRcdDBcblx0XHRcdFx0XS5jb25jYXQoIG5ldyBBcnJheSggYmFsYW5jZSApICk7XG5cdFx0XHRcdHNlY3Rpb24uZnJhZ21lbnRzLnNwbGljZS5hcHBseSggc2VjdGlvbi5mcmFnbWVudHMsIHNwbGljZUFyZ3MgKTtcblx0XHRcdFx0Zm9yICggaSA9IGluc2VydFN0YXJ0OyBpIDwgaW5zZXJ0RW5kOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0ZnJhZ21lbnRPcHRpb25zLmNvbnRleHQgPSBzZWN0aW9uLmtleXBhdGggKyAnLicgKyBpO1xuXHRcdFx0XHRcdGZyYWdtZW50T3B0aW9ucy5pbmRleCA9IGk7XG5cdFx0XHRcdFx0c2VjdGlvbi5mcmFnbWVudHNbIGkgXSA9IHNlY3Rpb24uY3JlYXRlRnJhZ21lbnQoIGZyYWdtZW50T3B0aW9ucyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNlY3Rpb24ucGFyZW50RnJhZ21lbnQucE5vZGUuaW5zZXJ0QmVmb3JlKCBzZWN0aW9uLmRvY0ZyYWcsIGluc2VydGlvblBvaW50ICk7XG5cdFx0XHR9XG5cdFx0XHRzZWN0aW9uLmxlbmd0aCArPSBiYWxhbmNlO1xuXHRcdFx0cmVhc3NpZ25GcmFnbWVudHMoIHNlY3Rpb24sIHN0YXJ0LCBzZWN0aW9uLmxlbmd0aCwgYmFsYW5jZSApO1xuXHRcdFx0c2VjdGlvbi5yZW5kZXJpbmcgPSBmYWxzZTtcblx0XHR9O1xuXHR9KCByZW5kZXJfRG9tRnJhZ21lbnRfU2VjdGlvbl9yZWFzc2lnbkZyYWdtZW50cyApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfU2VjdGlvbl9fU2VjdGlvbiA9IGZ1bmN0aW9uKCB0eXBlcywgaW5pdE11c3RhY2hlLCB1cGRhdGVNdXN0YWNoZSwgcmVzb2x2ZU11c3RhY2hlLCBtZXJnZSwgcmVuZGVyLCBzcGxpY2UsIHRlYXJkb3duLCBjaXJjdWxhciApIHtcblxuXHRcdHZhciBEb21TZWN0aW9uLCBEb21GcmFnbWVudDtcblx0XHRjaXJjdWxhci5wdXNoKCBmdW5jdGlvbigpIHtcblx0XHRcdERvbUZyYWdtZW50ID0gY2lyY3VsYXIuRG9tRnJhZ21lbnQ7XG5cdFx0fSApO1xuXHRcdERvbVNlY3Rpb24gPSBmdW5jdGlvbiggb3B0aW9ucywgZG9jRnJhZyApIHtcblx0XHRcdHRoaXMudHlwZSA9IHR5cGVzLlNFQ1RJT047XG5cdFx0XHR0aGlzLmludmVydGVkID0gISEgb3B0aW9ucy5kZXNjcmlwdG9yLm47XG5cdFx0XHR0aGlzLmZyYWdtZW50cyA9IFtdO1xuXHRcdFx0dGhpcy5sZW5ndGggPSAwO1xuXHRcdFx0aWYgKCBkb2NGcmFnICkge1xuXHRcdFx0XHR0aGlzLmRvY0ZyYWcgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmluaXRpYWxpc2luZyA9IHRydWU7XG5cdFx0XHRpbml0TXVzdGFjaGUoIHRoaXMsIG9wdGlvbnMgKTtcblx0XHRcdGlmICggZG9jRnJhZyApIHtcblx0XHRcdFx0ZG9jRnJhZy5hcHBlbmRDaGlsZCggdGhpcy5kb2NGcmFnICk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmluaXRpYWxpc2luZyA9IGZhbHNlO1xuXHRcdH07XG5cdFx0RG9tU2VjdGlvbi5wcm90b3R5cGUgPSB7XG5cdFx0XHR1cGRhdGU6IHVwZGF0ZU11c3RhY2hlLFxuXHRcdFx0cmVzb2x2ZTogcmVzb2x2ZU11c3RhY2hlLFxuXHRcdFx0c3BsaWNlOiBzcGxpY2UsXG5cdFx0XHRtZXJnZTogbWVyZ2UsXG5cdFx0XHRkZXRhY2g6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgaSwgbGVuO1xuXHRcdFx0XHRpZiAoIHRoaXMuZG9jRnJhZyApIHtcblx0XHRcdFx0XHRsZW4gPSB0aGlzLmZyYWdtZW50cy5sZW5ndGg7XG5cdFx0XHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0XHRcdHRoaXMuZG9jRnJhZy5hcHBlbmRDaGlsZCggdGhpcy5mcmFnbWVudHNbIGkgXS5kZXRhY2goKSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5kb2NGcmFnO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCBkZXN0cm95ICkge1xuXHRcdFx0XHR0aGlzLnRlYXJkb3duRnJhZ21lbnRzKCBkZXN0cm95ICk7XG5cdFx0XHRcdHRlYXJkb3duKCB0aGlzICk7XG5cdFx0XHR9LFxuXHRcdFx0Zmlyc3ROb2RlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0aWYgKCB0aGlzLmZyYWdtZW50c1sgMCBdICkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmZyYWdtZW50c1sgMCBdLmZpcnN0Tm9kZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0aGlzLnBhcmVudEZyYWdtZW50LmZpbmROZXh0Tm9kZSggdGhpcyApO1xuXHRcdFx0fSxcblx0XHRcdGZpbmROZXh0Tm9kZTogZnVuY3Rpb24oIGZyYWdtZW50ICkge1xuXHRcdFx0XHRpZiAoIHRoaXMuZnJhZ21lbnRzWyBmcmFnbWVudC5pbmRleCArIDEgXSApIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5mcmFnbWVudHNbIGZyYWdtZW50LmluZGV4ICsgMSBdLmZpcnN0Tm9kZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0aGlzLnBhcmVudEZyYWdtZW50LmZpbmROZXh0Tm9kZSggdGhpcyApO1xuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duRnJhZ21lbnRzOiBmdW5jdGlvbiggZGVzdHJveSApIHtcblx0XHRcdFx0dmFyIGZyYWdtZW50O1xuXHRcdFx0XHR3aGlsZSAoIGZyYWdtZW50ID0gdGhpcy5mcmFnbWVudHMuc2hpZnQoKSApIHtcblx0XHRcdFx0XHRmcmFnbWVudC50ZWFyZG93biggZGVzdHJveSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0cmVuZGVyOiByZW5kZXIsXG5cdFx0XHRjcmVhdGVGcmFnbWVudDogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRcdHZhciBmcmFnbWVudCA9IG5ldyBEb21GcmFnbWVudCggb3B0aW9ucyApO1xuXHRcdFx0XHRpZiAoIHRoaXMuZG9jRnJhZyApIHtcblx0XHRcdFx0XHR0aGlzLmRvY0ZyYWcuYXBwZW5kQ2hpbGQoIGZyYWdtZW50LmRvY0ZyYWcgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZnJhZ21lbnQ7XG5cdFx0XHR9LFxuXHRcdFx0dG9TdHJpbmc6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgc3RyLCBpLCBsZW47XG5cdFx0XHRcdHN0ciA9ICcnO1xuXHRcdFx0XHRpID0gMDtcblx0XHRcdFx0bGVuID0gdGhpcy5sZW5ndGg7XG5cdFx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0c3RyICs9IHRoaXMuZnJhZ21lbnRzWyBpIF0udG9TdHJpbmcoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gc3RyO1xuXHRcdFx0fSxcblx0XHRcdGZpbmQ6IGZ1bmN0aW9uKCBzZWxlY3RvciApIHtcblx0XHRcdFx0dmFyIGksIGxlbiwgcXVlcnlSZXN1bHQ7XG5cdFx0XHRcdGxlbiA9IHRoaXMuZnJhZ21lbnRzLmxlbmd0aDtcblx0XHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0XHRpZiAoIHF1ZXJ5UmVzdWx0ID0gdGhpcy5mcmFnbWVudHNbIGkgXS5maW5kKCBzZWxlY3RvciApICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHF1ZXJ5UmVzdWx0O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH0sXG5cdFx0XHRmaW5kQWxsOiBmdW5jdGlvbiggc2VsZWN0b3IsIHF1ZXJ5ICkge1xuXHRcdFx0XHR2YXIgaSwgbGVuO1xuXHRcdFx0XHRsZW4gPSB0aGlzLmZyYWdtZW50cy5sZW5ndGg7XG5cdFx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0dGhpcy5mcmFnbWVudHNbIGkgXS5maW5kQWxsKCBzZWxlY3RvciwgcXVlcnkgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGZpbmRDb21wb25lbnQ6IGZ1bmN0aW9uKCBzZWxlY3RvciApIHtcblx0XHRcdFx0dmFyIGksIGxlbiwgcXVlcnlSZXN1bHQ7XG5cdFx0XHRcdGxlbiA9IHRoaXMuZnJhZ21lbnRzLmxlbmd0aDtcblx0XHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0XHRpZiAoIHF1ZXJ5UmVzdWx0ID0gdGhpcy5mcmFnbWVudHNbIGkgXS5maW5kQ29tcG9uZW50KCBzZWxlY3RvciApICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHF1ZXJ5UmVzdWx0O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH0sXG5cdFx0XHRmaW5kQWxsQ29tcG9uZW50czogZnVuY3Rpb24oIHNlbGVjdG9yLCBxdWVyeSApIHtcblx0XHRcdFx0dmFyIGksIGxlbjtcblx0XHRcdFx0bGVuID0gdGhpcy5mcmFnbWVudHMubGVuZ3RoO1xuXHRcdFx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRcdHRoaXMuZnJhZ21lbnRzWyBpIF0uZmluZEFsbENvbXBvbmVudHMoIHNlbGVjdG9yLCBxdWVyeSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gRG9tU2VjdGlvbjtcblx0fSggY29uZmlnX3R5cGVzLCByZW5kZXJfc2hhcmVkX2luaXRNdXN0YWNoZSwgcmVuZGVyX3NoYXJlZF91cGRhdGVNdXN0YWNoZSwgcmVuZGVyX3NoYXJlZF9yZXNvbHZlTXVzdGFjaGUsIHJlbmRlcl9Eb21GcmFnbWVudF9TZWN0aW9uX3Byb3RvdHlwZV9tZXJnZSwgcmVuZGVyX0RvbUZyYWdtZW50X1NlY3Rpb25fcHJvdG90eXBlX3JlbmRlciwgcmVuZGVyX0RvbUZyYWdtZW50X1NlY3Rpb25fcHJvdG90eXBlX3NwbGljZSwgc2hhcmVkX3RlYXJkb3duLCBjaXJjdWxhciApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfVHJpcGxlID0gZnVuY3Rpb24oIHR5cGVzLCBtYXRjaGVzLCBpbml0TXVzdGFjaGUsIHVwZGF0ZU11c3RhY2hlLCByZXNvbHZlTXVzdGFjaGUsIGluc2VydEh0bWwsIHRlYXJkb3duICkge1xuXG5cdFx0dmFyIERvbVRyaXBsZSA9IGZ1bmN0aW9uKCBvcHRpb25zLCBkb2NGcmFnICkge1xuXHRcdFx0dGhpcy50eXBlID0gdHlwZXMuVFJJUExFO1xuXHRcdFx0aWYgKCBkb2NGcmFnICkge1xuXHRcdFx0XHR0aGlzLm5vZGVzID0gW107XG5cdFx0XHRcdHRoaXMuZG9jRnJhZyA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuaW5pdGlhbGlzaW5nID0gdHJ1ZTtcblx0XHRcdGluaXRNdXN0YWNoZSggdGhpcywgb3B0aW9ucyApO1xuXHRcdFx0aWYgKCBkb2NGcmFnICkge1xuXHRcdFx0XHRkb2NGcmFnLmFwcGVuZENoaWxkKCB0aGlzLmRvY0ZyYWcgKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuaW5pdGlhbGlzaW5nID0gZmFsc2U7XG5cdFx0fTtcblx0XHREb21UcmlwbGUucHJvdG90eXBlID0ge1xuXHRcdFx0dXBkYXRlOiB1cGRhdGVNdXN0YWNoZSxcblx0XHRcdHJlc29sdmU6IHJlc29sdmVNdXN0YWNoZSxcblx0XHRcdGRldGFjaDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBsZW4sIGk7XG5cdFx0XHRcdGlmICggdGhpcy5kb2NGcmFnICkge1xuXHRcdFx0XHRcdGxlbiA9IHRoaXMubm9kZXMubGVuZ3RoO1xuXHRcdFx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmRvY0ZyYWcuYXBwZW5kQ2hpbGQoIHRoaXMubm9kZXNbIGkgXSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5kb2NGcmFnO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCBkZXN0cm95ICkge1xuXHRcdFx0XHRpZiAoIGRlc3Ryb3kgKSB7XG5cdFx0XHRcdFx0dGhpcy5kZXRhY2goKTtcblx0XHRcdFx0XHR0aGlzLmRvY0ZyYWcgPSB0aGlzLm5vZGVzID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHR0ZWFyZG93biggdGhpcyApO1xuXHRcdFx0fSxcblx0XHRcdGZpcnN0Tm9kZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmICggdGhpcy5ub2Rlc1sgMCBdICkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLm5vZGVzWyAwIF07XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRoaXMucGFyZW50RnJhZ21lbnQuZmluZE5leHROb2RlKCB0aGlzICk7XG5cdFx0XHR9LFxuXHRcdFx0cmVuZGVyOiBmdW5jdGlvbiggaHRtbCApIHtcblx0XHRcdFx0dmFyIG5vZGUsIHBOb2RlO1xuXHRcdFx0XHRpZiAoICF0aGlzLm5vZGVzICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHR3aGlsZSAoIHRoaXMubm9kZXMubGVuZ3RoICkge1xuXHRcdFx0XHRcdG5vZGUgPSB0aGlzLm5vZGVzLnBvcCgpO1xuXHRcdFx0XHRcdG5vZGUucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCggbm9kZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggIWh0bWwgKSB7XG5cdFx0XHRcdFx0dGhpcy5ub2RlcyA9IFtdO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRwTm9kZSA9IHRoaXMucGFyZW50RnJhZ21lbnQucE5vZGU7XG5cdFx0XHRcdHRoaXMubm9kZXMgPSBpbnNlcnRIdG1sKCBodG1sLCBwTm9kZS50YWdOYW1lLCB0aGlzLmRvY0ZyYWcgKTtcblx0XHRcdFx0aWYgKCAhdGhpcy5pbml0aWFsaXNpbmcgKSB7XG5cdFx0XHRcdFx0cE5vZGUuaW5zZXJ0QmVmb3JlKCB0aGlzLmRvY0ZyYWcsIHRoaXMucGFyZW50RnJhZ21lbnQuZmluZE5leHROb2RlKCB0aGlzICkgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHBOb2RlLnRhZ05hbWUgPT09ICdTRUxFQ1QnICYmIHBOb2RlLl9yYWN0aXZlICYmIHBOb2RlLl9yYWN0aXZlLmJpbmRpbmcgKSB7XG5cdFx0XHRcdFx0cE5vZGUuX3JhY3RpdmUuYmluZGluZy51cGRhdGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHRvU3RyaW5nOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMudmFsdWUgIT0gdW5kZWZpbmVkID8gdGhpcy52YWx1ZSA6ICcnO1xuXHRcdFx0fSxcblx0XHRcdGZpbmQ6IGZ1bmN0aW9uKCBzZWxlY3RvciApIHtcblx0XHRcdFx0dmFyIGksIGxlbiwgbm9kZSwgcXVlcnlSZXN1bHQ7XG5cdFx0XHRcdGxlbiA9IHRoaXMubm9kZXMubGVuZ3RoO1xuXHRcdFx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRcdG5vZGUgPSB0aGlzLm5vZGVzWyBpIF07XG5cdFx0XHRcdFx0aWYgKCBub2RlLm5vZGVUeXBlICE9PSAxICkge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICggbWF0Y2hlcyggbm9kZSwgc2VsZWN0b3IgKSApIHtcblx0XHRcdFx0XHRcdHJldHVybiBub2RlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIHF1ZXJ5UmVzdWx0ID0gbm9kZS5xdWVyeVNlbGVjdG9yKCBzZWxlY3RvciApICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHF1ZXJ5UmVzdWx0O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH0sXG5cdFx0XHRmaW5kQWxsOiBmdW5jdGlvbiggc2VsZWN0b3IsIHF1ZXJ5UmVzdWx0ICkge1xuXHRcdFx0XHR2YXIgaSwgbGVuLCBub2RlLCBxdWVyeUFsbFJlc3VsdCwgbnVtTm9kZXMsIGo7XG5cdFx0XHRcdGxlbiA9IHRoaXMubm9kZXMubGVuZ3RoO1xuXHRcdFx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRcdG5vZGUgPSB0aGlzLm5vZGVzWyBpIF07XG5cdFx0XHRcdFx0aWYgKCBub2RlLm5vZGVUeXBlICE9PSAxICkge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICggbWF0Y2hlcyggbm9kZSwgc2VsZWN0b3IgKSApIHtcblx0XHRcdFx0XHRcdHF1ZXJ5UmVzdWx0LnB1c2goIG5vZGUgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCBxdWVyeUFsbFJlc3VsdCA9IG5vZGUucXVlcnlTZWxlY3RvckFsbCggc2VsZWN0b3IgKSApIHtcblx0XHRcdFx0XHRcdG51bU5vZGVzID0gcXVlcnlBbGxSZXN1bHQubGVuZ3RoO1xuXHRcdFx0XHRcdFx0Zm9yICggaiA9IDA7IGogPCBudW1Ob2RlczsgaiArPSAxICkge1xuXHRcdFx0XHRcdFx0XHRxdWVyeVJlc3VsdC5wdXNoKCBxdWVyeUFsbFJlc3VsdFsgaiBdICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gRG9tVHJpcGxlO1xuXHR9KCBjb25maWdfdHlwZXMsIHV0aWxzX21hdGNoZXMsIHJlbmRlcl9zaGFyZWRfaW5pdE11c3RhY2hlLCByZW5kZXJfc2hhcmVkX3VwZGF0ZU11c3RhY2hlLCByZW5kZXJfc2hhcmVkX3Jlc29sdmVNdXN0YWNoZSwgcmVuZGVyX0RvbUZyYWdtZW50X3NoYXJlZF9pbnNlcnRIdG1sLCBzaGFyZWRfdGVhcmRvd24gKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfaW5pdGlhbGlzZV9nZXRFbGVtZW50TmFtZXNwYWNlID0gZnVuY3Rpb24oIG5hbWVzcGFjZXMgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIGRlc2NyaXB0b3IsIHBhcmVudE5vZGUgKSB7XG5cdFx0XHRpZiAoIGRlc2NyaXB0b3IuYSAmJiBkZXNjcmlwdG9yLmEueG1sbnMgKSB7XG5cdFx0XHRcdHJldHVybiBkZXNjcmlwdG9yLmEueG1sbnM7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZGVzY3JpcHRvci5lID09PSAnc3ZnJyA/IG5hbWVzcGFjZXMuc3ZnIDogcGFyZW50Tm9kZS5uYW1lc3BhY2VVUkkgfHwgbmFtZXNwYWNlcy5odG1sO1xuXHRcdH07XG5cdH0oIGNvbmZpZ19uYW1lc3BhY2VzICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9zaGFyZWRfZW5mb3JjZUNhc2UgPSBmdW5jdGlvbigpIHtcblxuXHRcdHZhciBzdmdDYW1lbENhc2VFbGVtZW50cywgc3ZnQ2FtZWxDYXNlQXR0cmlidXRlcywgY3JlYXRlTWFwLCBtYXA7XG5cdFx0c3ZnQ2FtZWxDYXNlRWxlbWVudHMgPSAnYWx0R2x5cGggYWx0R2x5cGhEZWYgYWx0R2x5cGhJdGVtIGFuaW1hdGVDb2xvciBhbmltYXRlTW90aW9uIGFuaW1hdGVUcmFuc2Zvcm0gY2xpcFBhdGggZmVCbGVuZCBmZUNvbG9yTWF0cml4IGZlQ29tcG9uZW50VHJhbnNmZXIgZmVDb21wb3NpdGUgZmVDb252b2x2ZU1hdHJpeCBmZURpZmZ1c2VMaWdodGluZyBmZURpc3BsYWNlbWVudE1hcCBmZURpc3RhbnRMaWdodCBmZUZsb29kIGZlRnVuY0EgZmVGdW5jQiBmZUZ1bmNHIGZlRnVuY1IgZmVHYXVzc2lhbkJsdXIgZmVJbWFnZSBmZU1lcmdlIGZlTWVyZ2VOb2RlIGZlTW9ycGhvbG9neSBmZU9mZnNldCBmZVBvaW50TGlnaHQgZmVTcGVjdWxhckxpZ2h0aW5nIGZlU3BvdExpZ2h0IGZlVGlsZSBmZVR1cmJ1bGVuY2UgZm9yZWlnbk9iamVjdCBnbHlwaFJlZiBsaW5lYXJHcmFkaWVudCByYWRpYWxHcmFkaWVudCB0ZXh0UGF0aCB2a2Vybicuc3BsaXQoICcgJyApO1xuXHRcdHN2Z0NhbWVsQ2FzZUF0dHJpYnV0ZXMgPSAnYXR0cmlidXRlTmFtZSBhdHRyaWJ1dGVUeXBlIGJhc2VGcmVxdWVuY3kgYmFzZVByb2ZpbGUgY2FsY01vZGUgY2xpcFBhdGhVbml0cyBjb250ZW50U2NyaXB0VHlwZSBjb250ZW50U3R5bGVUeXBlIGRpZmZ1c2VDb25zdGFudCBlZGdlTW9kZSBleHRlcm5hbFJlc291cmNlc1JlcXVpcmVkIGZpbHRlclJlcyBmaWx0ZXJVbml0cyBnbHlwaFJlZiBncmFkaWVudFRyYW5zZm9ybSBncmFkaWVudFVuaXRzIGtlcm5lbE1hdHJpeCBrZXJuZWxVbml0TGVuZ3RoIGtleVBvaW50cyBrZXlTcGxpbmVzIGtleVRpbWVzIGxlbmd0aEFkanVzdCBsaW1pdGluZ0NvbmVBbmdsZSBtYXJrZXJIZWlnaHQgbWFya2VyVW5pdHMgbWFya2VyV2lkdGggbWFza0NvbnRlbnRVbml0cyBtYXNrVW5pdHMgbnVtT2N0YXZlcyBwYXRoTGVuZ3RoIHBhdHRlcm5Db250ZW50VW5pdHMgcGF0dGVyblRyYW5zZm9ybSBwYXR0ZXJuVW5pdHMgcG9pbnRzQXRYIHBvaW50c0F0WSBwb2ludHNBdFogcHJlc2VydmVBbHBoYSBwcmVzZXJ2ZUFzcGVjdFJhdGlvIHByaW1pdGl2ZVVuaXRzIHJlZlggcmVmWSByZXBlYXRDb3VudCByZXBlYXREdXIgcmVxdWlyZWRFeHRlbnNpb25zIHJlcXVpcmVkRmVhdHVyZXMgc3BlY3VsYXJDb25zdGFudCBzcGVjdWxhckV4cG9uZW50IHNwcmVhZE1ldGhvZCBzdGFydE9mZnNldCBzdGREZXZpYXRpb24gc3RpdGNoVGlsZXMgc3VyZmFjZVNjYWxlIHN5c3RlbUxhbmd1YWdlIHRhYmxlVmFsdWVzIHRhcmdldFggdGFyZ2V0WSB0ZXh0TGVuZ3RoIHZpZXdCb3ggdmlld1RhcmdldCB4Q2hhbm5lbFNlbGVjdG9yIHlDaGFubmVsU2VsZWN0b3Igem9vbUFuZFBhbicuc3BsaXQoICcgJyApO1xuXHRcdGNyZWF0ZU1hcCA9IGZ1bmN0aW9uKCBpdGVtcyApIHtcblx0XHRcdHZhciBtYXAgPSB7fSwgaSA9IGl0ZW1zLmxlbmd0aDtcblx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRtYXBbIGl0ZW1zWyBpIF0udG9Mb3dlckNhc2UoKSBdID0gaXRlbXNbIGkgXTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBtYXA7XG5cdFx0fTtcblx0XHRtYXAgPSBjcmVhdGVNYXAoIHN2Z0NhbWVsQ2FzZUVsZW1lbnRzLmNvbmNhdCggc3ZnQ2FtZWxDYXNlQXR0cmlidXRlcyApICk7XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBlbGVtZW50TmFtZSApIHtcblx0XHRcdHZhciBsb3dlckNhc2VFbGVtZW50TmFtZSA9IGVsZW1lbnROYW1lLnRvTG93ZXJDYXNlKCk7XG5cdFx0XHRyZXR1cm4gbWFwWyBsb3dlckNhc2VFbGVtZW50TmFtZSBdIHx8IGxvd2VyQ2FzZUVsZW1lbnROYW1lO1xuXHRcdH07XG5cdH0oKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0F0dHJpYnV0ZV9oZWxwZXJzX2RldGVybWluZU5hbWVBbmROYW1lc3BhY2UgPSBmdW5jdGlvbiggbmFtZXNwYWNlcywgZW5mb3JjZUNhc2UgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIGF0dHJpYnV0ZSwgbmFtZSApIHtcblx0XHRcdHZhciBjb2xvbkluZGV4LCBuYW1lc3BhY2VQcmVmaXg7XG5cdFx0XHRjb2xvbkluZGV4ID0gbmFtZS5pbmRleE9mKCAnOicgKTtcblx0XHRcdGlmICggY29sb25JbmRleCAhPT0gLTEgKSB7XG5cdFx0XHRcdG5hbWVzcGFjZVByZWZpeCA9IG5hbWUuc3Vic3RyKCAwLCBjb2xvbkluZGV4ICk7XG5cdFx0XHRcdGlmICggbmFtZXNwYWNlUHJlZml4ICE9PSAneG1sbnMnICkge1xuXHRcdFx0XHRcdG5hbWUgPSBuYW1lLnN1YnN0cmluZyggY29sb25JbmRleCArIDEgKTtcblx0XHRcdFx0XHRhdHRyaWJ1dGUubmFtZSA9IGVuZm9yY2VDYXNlKCBuYW1lICk7XG5cdFx0XHRcdFx0YXR0cmlidXRlLmxjTmFtZSA9IGF0dHJpYnV0ZS5uYW1lLnRvTG93ZXJDYXNlKCk7XG5cdFx0XHRcdFx0YXR0cmlidXRlLm5hbWVzcGFjZSA9IG5hbWVzcGFjZXNbIG5hbWVzcGFjZVByZWZpeC50b0xvd2VyQ2FzZSgpIF07XG5cdFx0XHRcdFx0aWYgKCAhYXR0cmlidXRlLm5hbWVzcGFjZSApIHtcblx0XHRcdFx0XHRcdHRocm93ICdVbmtub3duIG5hbWVzcGFjZSAoXCInICsgbmFtZXNwYWNlUHJlZml4ICsgJ1wiKSc7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0YXR0cmlidXRlLm5hbWUgPSBhdHRyaWJ1dGUuZWxlbWVudC5uYW1lc3BhY2UgIT09IG5hbWVzcGFjZXMuaHRtbCA/IGVuZm9yY2VDYXNlKCBuYW1lICkgOiBuYW1lO1xuXHRcdFx0YXR0cmlidXRlLmxjTmFtZSA9IGF0dHJpYnV0ZS5uYW1lLnRvTG93ZXJDYXNlKCk7XG5cdFx0fTtcblx0fSggY29uZmlnX25hbWVzcGFjZXMsIHJlbmRlcl9Eb21GcmFnbWVudF9zaGFyZWRfZW5mb3JjZUNhc2UgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0F0dHJpYnV0ZV9oZWxwZXJzX3NldFN0YXRpY0F0dHJpYnV0ZSA9IGZ1bmN0aW9uKCBuYW1lc3BhY2VzICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uIHNldFN0YXRpY0F0dHJpYnV0ZSggYXR0cmlidXRlLCBvcHRpb25zICkge1xuXHRcdFx0dmFyIG5vZGUsIHZhbHVlID0gb3B0aW9ucy52YWx1ZSA9PT0gbnVsbCA/ICcnIDogb3B0aW9ucy52YWx1ZTtcblx0XHRcdGlmICggbm9kZSA9IG9wdGlvbnMucE5vZGUgKSB7XG5cdFx0XHRcdGlmICggYXR0cmlidXRlLm5hbWVzcGFjZSApIHtcblx0XHRcdFx0XHRub2RlLnNldEF0dHJpYnV0ZU5TKCBhdHRyaWJ1dGUubmFtZXNwYWNlLCBvcHRpb25zLm5hbWUsIHZhbHVlICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aWYgKCBvcHRpb25zLm5hbWUgPT09ICdzdHlsZScgJiYgbm9kZS5zdHlsZS5zZXRBdHRyaWJ1dGUgKSB7XG5cdFx0XHRcdFx0XHRub2RlLnN0eWxlLnNldEF0dHJpYnV0ZSggJ2Nzc1RleHQnLCB2YWx1ZSApO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoIG9wdGlvbnMubmFtZSA9PT0gJ2NsYXNzJyAmJiAoICFub2RlLm5hbWVzcGFjZVVSSSB8fCBub2RlLm5hbWVzcGFjZVVSSSA9PT0gbmFtZXNwYWNlcy5odG1sICkgKSB7XG5cdFx0XHRcdFx0XHRub2RlLmNsYXNzTmFtZSA9IHZhbHVlO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRub2RlLnNldEF0dHJpYnV0ZSggb3B0aW9ucy5uYW1lLCB2YWx1ZSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIGF0dHJpYnV0ZS5uYW1lID09PSAnaWQnICkge1xuXHRcdFx0XHRcdG9wdGlvbnMucm9vdC5ub2Rlc1sgb3B0aW9ucy52YWx1ZSBdID0gbm9kZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIGF0dHJpYnV0ZS5uYW1lID09PSAndmFsdWUnICkge1xuXHRcdFx0XHRcdG5vZGUuX3JhY3RpdmUudmFsdWUgPSBvcHRpb25zLnZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRhdHRyaWJ1dGUudmFsdWUgPSBvcHRpb25zLnZhbHVlO1xuXHRcdH07XG5cdH0oIGNvbmZpZ19uYW1lc3BhY2VzICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9BdHRyaWJ1dGVfaGVscGVyc19kZXRlcm1pbmVQcm9wZXJ0eU5hbWUgPSBmdW5jdGlvbiggbmFtZXNwYWNlcyApIHtcblxuXHRcdHZhciBwcm9wZXJ0eU5hbWVzID0ge1xuXHRcdFx0J2FjY2VwdC1jaGFyc2V0JzogJ2FjY2VwdENoYXJzZXQnLFxuXHRcdFx0YWNjZXNza2V5OiAnYWNjZXNzS2V5Jyxcblx0XHRcdGJnY29sb3I6ICdiZ0NvbG9yJyxcblx0XHRcdCdjbGFzcyc6ICdjbGFzc05hbWUnLFxuXHRcdFx0Y29kZWJhc2U6ICdjb2RlQmFzZScsXG5cdFx0XHRjb2xzcGFuOiAnY29sU3BhbicsXG5cdFx0XHRjb250ZW50ZWRpdGFibGU6ICdjb250ZW50RWRpdGFibGUnLFxuXHRcdFx0ZGF0ZXRpbWU6ICdkYXRlVGltZScsXG5cdFx0XHRkaXJuYW1lOiAnZGlyTmFtZScsXG5cdFx0XHQnZm9yJzogJ2h0bWxGb3InLFxuXHRcdFx0J2h0dHAtZXF1aXYnOiAnaHR0cEVxdWl2Jyxcblx0XHRcdGlzbWFwOiAnaXNNYXAnLFxuXHRcdFx0bWF4bGVuZ3RoOiAnbWF4TGVuZ3RoJyxcblx0XHRcdG5vdmFsaWRhdGU6ICdub1ZhbGlkYXRlJyxcblx0XHRcdHB1YmRhdGU6ICdwdWJEYXRlJyxcblx0XHRcdHJlYWRvbmx5OiAncmVhZE9ubHknLFxuXHRcdFx0cm93c3BhbjogJ3Jvd1NwYW4nLFxuXHRcdFx0dGFiaW5kZXg6ICd0YWJJbmRleCcsXG5cdFx0XHR1c2VtYXA6ICd1c2VNYXAnXG5cdFx0fTtcblx0XHRyZXR1cm4gZnVuY3Rpb24oIGF0dHJpYnV0ZSwgb3B0aW9ucyApIHtcblx0XHRcdHZhciBwcm9wZXJ0eU5hbWU7XG5cdFx0XHRpZiAoIGF0dHJpYnV0ZS5wTm9kZSAmJiAhYXR0cmlidXRlLm5hbWVzcGFjZSAmJiAoICFvcHRpb25zLnBOb2RlLm5hbWVzcGFjZVVSSSB8fCBvcHRpb25zLnBOb2RlLm5hbWVzcGFjZVVSSSA9PT0gbmFtZXNwYWNlcy5odG1sICkgKSB7XG5cdFx0XHRcdHByb3BlcnR5TmFtZSA9IHByb3BlcnR5TmFtZXNbIGF0dHJpYnV0ZS5uYW1lIF0gfHwgYXR0cmlidXRlLm5hbWU7XG5cdFx0XHRcdGlmICggb3B0aW9ucy5wTm9kZVsgcHJvcGVydHlOYW1lIF0gIT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0XHRhdHRyaWJ1dGUucHJvcGVydHlOYW1lID0gcHJvcGVydHlOYW1lO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggdHlwZW9mIG9wdGlvbnMucE5vZGVbIHByb3BlcnR5TmFtZSBdID09PSAnYm9vbGVhbicgfHwgcHJvcGVydHlOYW1lID09PSAndmFsdWUnICkge1xuXHRcdFx0XHRcdGF0dHJpYnV0ZS51c2VQcm9wZXJ0eSA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHR9KCBjb25maWdfbmFtZXNwYWNlcyApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfQXR0cmlidXRlX2hlbHBlcnNfZ2V0SW50ZXJwb2xhdG9yID0gZnVuY3Rpb24oIHR5cGVzICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uIGdldEludGVycG9sYXRvciggYXR0cmlidXRlICkge1xuXHRcdFx0dmFyIGl0ZW1zLCBpdGVtO1xuXHRcdFx0aXRlbXMgPSBhdHRyaWJ1dGUuZnJhZ21lbnQuaXRlbXM7XG5cdFx0XHRpZiAoIGl0ZW1zLmxlbmd0aCAhPT0gMSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aXRlbSA9IGl0ZW1zWyAwIF07XG5cdFx0XHRpZiAoIGl0ZW0udHlwZSAhPT0gdHlwZXMuSU5URVJQT0xBVE9SIHx8ICFpdGVtLmtleXBhdGggJiYgIWl0ZW0ucmVmICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gaXRlbTtcblx0XHR9O1xuXHR9KCBjb25maWdfdHlwZXMgKTtcblxuXHR2YXIgdXRpbHNfYXJyYXlDb250ZW50c01hdGNoID0gZnVuY3Rpb24oIGlzQXJyYXkgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIGEsIGIgKSB7XG5cdFx0XHR2YXIgaTtcblx0XHRcdGlmICggIWlzQXJyYXkoIGEgKSB8fCAhaXNBcnJheSggYiApICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGEubGVuZ3RoICE9PSBiLmxlbmd0aCApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aSA9IGEubGVuZ3RoO1xuXHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdGlmICggYVsgaSBdICE9PSBiWyBpIF0gKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9O1xuXHR9KCB1dGlsc19pc0FycmF5ICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9BdHRyaWJ1dGVfcHJvdG90eXBlX2JpbmQgPSBmdW5jdGlvbiggcnVubG9vcCwgd2FybiwgYXJyYXlDb250ZW50c01hdGNoLCBnZXRWYWx1ZUZyb21DaGVja2JveGVzLCBnZXQsIHNldCApIHtcblxuXHRcdHZhciBzaW5nbGVNdXN0YWNoZUVycm9yID0gJ0ZvciB0d28td2F5IGJpbmRpbmcgdG8gd29yaywgYXR0cmlidXRlIHZhbHVlIG11c3QgYmUgYSBzaW5nbGUgaW50ZXJwb2xhdG9yIChlLmcuIHZhbHVlPVwie3tmb299fVwiKScsXG5cdFx0XHRleHByZXNzaW9uRXJyb3IgPSAnWW91IGNhbm5vdCBzZXQgdXAgdHdvLXdheSBiaW5kaW5nIGFnYWluc3QgYW4gZXhwcmVzc2lvbiAnLFxuXHRcdFx0YmluZEF0dHJpYnV0ZSwgdXBkYXRlTW9kZWwsIGdldE9wdGlvbnMsIHVwZGF0ZSwgZ2V0QmluZGluZywgaW5oZXJpdFByb3BlcnRpZXMsIE11bHRpcGxlU2VsZWN0QmluZGluZywgU2VsZWN0QmluZGluZywgUmFkaW9OYW1lQmluZGluZywgQ2hlY2tib3hOYW1lQmluZGluZywgQ2hlY2tlZEJpbmRpbmcsIEZpbGVMaXN0QmluZGluZywgQ29udGVudEVkaXRhYmxlQmluZGluZywgR2VuZXJpY0JpbmRpbmc7XG5cdFx0YmluZEF0dHJpYnV0ZSA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIG5vZGUgPSB0aGlzLnBOb2RlLFxuXHRcdFx0XHRpbnRlcnBvbGF0b3IsIGJpbmRpbmcsIGJpbmRpbmdzO1xuXHRcdFx0aW50ZXJwb2xhdG9yID0gdGhpcy5pbnRlcnBvbGF0b3I7XG5cdFx0XHRpZiAoICFpbnRlcnBvbGF0b3IgKSB7XG5cdFx0XHRcdHdhcm4oIHNpbmdsZU11c3RhY2hlRXJyb3IgKTtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBpbnRlcnBvbGF0b3Iua2V5cGF0aCAmJiBpbnRlcnBvbGF0b3Iua2V5cGF0aC5zdWJzdHIgPT09ICckeycgKSB7XG5cdFx0XHRcdHdhcm4oIGV4cHJlc3Npb25FcnJvciArIGludGVycG9sYXRvci5rZXlwYXRoICk7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmICggIWludGVycG9sYXRvci5rZXlwYXRoICkge1xuXHRcdFx0XHRpbnRlcnBvbGF0b3IucmVzb2x2ZSggaW50ZXJwb2xhdG9yLmRlc2NyaXB0b3IuciApO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5rZXlwYXRoID0gaW50ZXJwb2xhdG9yLmtleXBhdGg7XG5cdFx0XHRiaW5kaW5nID0gZ2V0QmluZGluZyggdGhpcyApO1xuXHRcdFx0aWYgKCAhYmluZGluZyApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0bm9kZS5fcmFjdGl2ZS5iaW5kaW5nID0gdGhpcy5lbGVtZW50LmJpbmRpbmcgPSBiaW5kaW5nO1xuXHRcdFx0dGhpcy50d293YXkgPSB0cnVlO1xuXHRcdFx0YmluZGluZ3MgPSB0aGlzLnJvb3QuX3R3b3dheUJpbmRpbmdzWyB0aGlzLmtleXBhdGggXSB8fCAoIHRoaXMucm9vdC5fdHdvd2F5QmluZGluZ3NbIHRoaXMua2V5cGF0aCBdID0gW10gKTtcblx0XHRcdGJpbmRpbmdzLnB1c2goIGJpbmRpbmcgKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH07XG5cdFx0dXBkYXRlTW9kZWwgPSBmdW5jdGlvbigpIHtcblx0XHRcdHJ1bmxvb3Auc3RhcnQoIHRoaXMuX3JhY3RpdmUucm9vdCApO1xuXHRcdFx0dGhpcy5fcmFjdGl2ZS5iaW5kaW5nLnVwZGF0ZSgpO1xuXHRcdFx0cnVubG9vcC5lbmQoKTtcblx0XHR9O1xuXHRcdGdldE9wdGlvbnMgPSB7XG5cdFx0XHRldmFsdWF0ZVdyYXBwZWQ6IHRydWVcblx0XHR9O1xuXHRcdHVwZGF0ZSA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIHZhbHVlID0gZ2V0KCB0aGlzLl9yYWN0aXZlLnJvb3QsIHRoaXMuX3JhY3RpdmUuYmluZGluZy5rZXlwYXRoLCBnZXRPcHRpb25zICk7XG5cdFx0XHR0aGlzLnZhbHVlID0gdmFsdWUgPT0gdW5kZWZpbmVkID8gJycgOiB2YWx1ZTtcblx0XHR9O1xuXHRcdGdldEJpbmRpbmcgPSBmdW5jdGlvbiggYXR0cmlidXRlICkge1xuXHRcdFx0dmFyIG5vZGUgPSBhdHRyaWJ1dGUucE5vZGU7XG5cdFx0XHRpZiAoIG5vZGUudGFnTmFtZSA9PT0gJ1NFTEVDVCcgKSB7XG5cdFx0XHRcdHJldHVybiBub2RlLm11bHRpcGxlID8gbmV3IE11bHRpcGxlU2VsZWN0QmluZGluZyggYXR0cmlidXRlLCBub2RlICkgOiBuZXcgU2VsZWN0QmluZGluZyggYXR0cmlidXRlLCBub2RlICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIG5vZGUudHlwZSA9PT0gJ2NoZWNrYm94JyB8fCBub2RlLnR5cGUgPT09ICdyYWRpbycgKSB7XG5cdFx0XHRcdGlmICggYXR0cmlidXRlLnByb3BlcnR5TmFtZSA9PT0gJ25hbWUnICkge1xuXHRcdFx0XHRcdGlmICggbm9kZS50eXBlID09PSAnY2hlY2tib3gnICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIG5ldyBDaGVja2JveE5hbWVCaW5kaW5nKCBhdHRyaWJ1dGUsIG5vZGUgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCBub2RlLnR5cGUgPT09ICdyYWRpbycgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbmV3IFJhZGlvTmFtZUJpbmRpbmcoIGF0dHJpYnV0ZSwgbm9kZSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIGF0dHJpYnV0ZS5wcm9wZXJ0eU5hbWUgPT09ICdjaGVja2VkJyApIHtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IENoZWNrZWRCaW5kaW5nKCBhdHRyaWJ1dGUsIG5vZGUgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGlmICggYXR0cmlidXRlLmxjTmFtZSAhPT0gJ3ZhbHVlJyApIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnQXR0ZW1wdGVkIHRvIHNldCB1cCBhbiBpbGxlZ2FsIHR3by13YXkgYmluZGluZy4gVGhpcyBlcnJvciBpcyB1bmV4cGVjdGVkIC0gaWYgeW91IGNhbiwgcGxlYXNlIGZpbGUgYW4gaXNzdWUgYXQgaHR0cHM6Ly9naXRodWIuY29tL1JhY3RpdmVKUy9SYWN0aXZlLCBvciBjb250YWN0IEBSYWN0aXZlSlMgb24gVHdpdHRlci4gVGhhbmtzIScgKTtcblx0XHRcdH1cblx0XHRcdGlmICggbm9kZS50eXBlID09PSAnZmlsZScgKSB7XG5cdFx0XHRcdHJldHVybiBuZXcgRmlsZUxpc3RCaW5kaW5nKCBhdHRyaWJ1dGUsIG5vZGUgKTtcblx0XHRcdH1cblx0XHRcdGlmICggbm9kZS5nZXRBdHRyaWJ1dGUoICdjb250ZW50ZWRpdGFibGUnICkgKSB7XG5cdFx0XHRcdHJldHVybiBuZXcgQ29udGVudEVkaXRhYmxlQmluZGluZyggYXR0cmlidXRlLCBub2RlICk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbmV3IEdlbmVyaWNCaW5kaW5nKCBhdHRyaWJ1dGUsIG5vZGUgKTtcblx0XHR9O1xuXHRcdE11bHRpcGxlU2VsZWN0QmluZGluZyA9IGZ1bmN0aW9uKCBhdHRyaWJ1dGUsIG5vZGUgKSB7XG5cdFx0XHR2YXIgdmFsdWVGcm9tTW9kZWw7XG5cdFx0XHRpbmhlcml0UHJvcGVydGllcyggdGhpcywgYXR0cmlidXRlLCBub2RlICk7XG5cdFx0XHRub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCB1cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHRcdHZhbHVlRnJvbU1vZGVsID0gZ2V0KCB0aGlzLnJvb3QsIHRoaXMua2V5cGF0aCApO1xuXHRcdFx0aWYgKCB2YWx1ZUZyb21Nb2RlbCA9PT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZSgpO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0TXVsdGlwbGVTZWxlY3RCaW5kaW5nLnByb3RvdHlwZSA9IHtcblx0XHRcdHZhbHVlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHNlbGVjdGVkVmFsdWVzLCBvcHRpb25zLCBpLCBsZW4sIG9wdGlvbiwgb3B0aW9uVmFsdWU7XG5cdFx0XHRcdHNlbGVjdGVkVmFsdWVzID0gW107XG5cdFx0XHRcdG9wdGlvbnMgPSB0aGlzLm5vZGUub3B0aW9ucztcblx0XHRcdFx0bGVuID0gb3B0aW9ucy5sZW5ndGg7XG5cdFx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0b3B0aW9uID0gb3B0aW9uc1sgaSBdO1xuXHRcdFx0XHRcdGlmICggb3B0aW9uLnNlbGVjdGVkICkge1xuXHRcdFx0XHRcdFx0b3B0aW9uVmFsdWUgPSBvcHRpb24uX3JhY3RpdmUgPyBvcHRpb24uX3JhY3RpdmUudmFsdWUgOiBvcHRpb24udmFsdWU7XG5cdFx0XHRcdFx0XHRzZWxlY3RlZFZhbHVlcy5wdXNoKCBvcHRpb25WYWx1ZSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gc2VsZWN0ZWRWYWx1ZXM7XG5cdFx0XHR9LFxuXHRcdFx0dXBkYXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIGF0dHJpYnV0ZSwgcHJldmlvdXNWYWx1ZSwgdmFsdWU7XG5cdFx0XHRcdGF0dHJpYnV0ZSA9IHRoaXMuYXR0cjtcblx0XHRcdFx0cHJldmlvdXNWYWx1ZSA9IGF0dHJpYnV0ZS52YWx1ZTtcblx0XHRcdFx0dmFsdWUgPSB0aGlzLnZhbHVlKCk7XG5cdFx0XHRcdGlmICggcHJldmlvdXNWYWx1ZSA9PT0gdW5kZWZpbmVkIHx8ICFhcnJheUNvbnRlbnRzTWF0Y2goIHZhbHVlLCBwcmV2aW91c1ZhbHVlICkgKSB7XG5cdFx0XHRcdFx0YXR0cmlidXRlLnJlY2VpdmluZyA9IHRydWU7XG5cdFx0XHRcdFx0YXR0cmlidXRlLnZhbHVlID0gdmFsdWU7XG5cdFx0XHRcdFx0c2V0KCB0aGlzLnJvb3QsIHRoaXMua2V5cGF0aCwgdmFsdWUgKTtcblx0XHRcdFx0XHRydW5sb29wLnRyaWdnZXIoKTtcblx0XHRcdFx0XHRhdHRyaWJ1dGUucmVjZWl2aW5nID0gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0XHR9LFxuXHRcdFx0ZGVmZXJVcGRhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZiAoIHRoaXMuZGVmZXJyZWQgPT09IHRydWUgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJ1bmxvb3AuYWRkQXR0cmlidXRlKCB0aGlzICk7XG5cdFx0XHRcdHRoaXMuZGVmZXJyZWQgPSB0cnVlO1xuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dGhpcy5ub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCB1cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdFNlbGVjdEJpbmRpbmcgPSBmdW5jdGlvbiggYXR0cmlidXRlLCBub2RlICkge1xuXHRcdFx0dmFyIHZhbHVlRnJvbU1vZGVsO1xuXHRcdFx0aW5oZXJpdFByb3BlcnRpZXMoIHRoaXMsIGF0dHJpYnV0ZSwgbm9kZSApO1xuXHRcdFx0bm9kZS5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgdXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0XHR2YWx1ZUZyb21Nb2RlbCA9IGdldCggdGhpcy5yb290LCB0aGlzLmtleXBhdGggKTtcblx0XHRcdGlmICggdmFsdWVGcm9tTW9kZWwgPT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0dGhpcy51cGRhdGUoKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdFNlbGVjdEJpbmRpbmcucHJvdG90eXBlID0ge1xuXHRcdFx0dmFsdWU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgb3B0aW9ucywgaSwgbGVuLCBvcHRpb24sIG9wdGlvblZhbHVlO1xuXHRcdFx0XHRvcHRpb25zID0gdGhpcy5ub2RlLm9wdGlvbnM7XG5cdFx0XHRcdGxlbiA9IG9wdGlvbnMubGVuZ3RoO1xuXHRcdFx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRcdG9wdGlvbiA9IG9wdGlvbnNbIGkgXTtcblx0XHRcdFx0XHRpZiAoIG9wdGlvbnNbIGkgXS5zZWxlY3RlZCApIHtcblx0XHRcdFx0XHRcdG9wdGlvblZhbHVlID0gb3B0aW9uLl9yYWN0aXZlID8gb3B0aW9uLl9yYWN0aXZlLnZhbHVlIDogb3B0aW9uLnZhbHVlO1xuXHRcdFx0XHRcdFx0cmV0dXJuIG9wdGlvblZhbHVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHVwZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciB2YWx1ZSA9IHRoaXMudmFsdWUoKTtcblx0XHRcdFx0dGhpcy5hdHRyLnJlY2VpdmluZyA9IHRydWU7XG5cdFx0XHRcdHRoaXMuYXR0ci52YWx1ZSA9IHZhbHVlO1xuXHRcdFx0XHRzZXQoIHRoaXMucm9vdCwgdGhpcy5rZXlwYXRoLCB2YWx1ZSApO1xuXHRcdFx0XHRydW5sb29wLnRyaWdnZXIoKTtcblx0XHRcdFx0dGhpcy5hdHRyLnJlY2VpdmluZyA9IGZhbHNlO1xuXHRcdFx0XHRyZXR1cm4gdGhpcztcblx0XHRcdH0sXG5cdFx0XHRkZWZlclVwZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmICggdGhpcy5kZWZlcnJlZCA9PT0gdHJ1ZSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0cnVubG9vcC5hZGRBdHRyaWJ1dGUoIHRoaXMgKTtcblx0XHRcdFx0dGhpcy5kZWZlcnJlZCA9IHRydWU7XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR0aGlzLm5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIHVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0UmFkaW9OYW1lQmluZGluZyA9IGZ1bmN0aW9uKCBhdHRyaWJ1dGUsIG5vZGUgKSB7XG5cdFx0XHR2YXIgdmFsdWVGcm9tTW9kZWw7XG5cdFx0XHR0aGlzLnJhZGlvTmFtZSA9IHRydWU7XG5cdFx0XHRpbmhlcml0UHJvcGVydGllcyggdGhpcywgYXR0cmlidXRlLCBub2RlICk7XG5cdFx0XHRub2RlLm5hbWUgPSAne3snICsgYXR0cmlidXRlLmtleXBhdGggKyAnfX0nO1xuXHRcdFx0bm9kZS5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgdXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0XHRpZiAoIG5vZGUuYXR0YWNoRXZlbnQgKSB7XG5cdFx0XHRcdG5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgdXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0XHR2YWx1ZUZyb21Nb2RlbCA9IGdldCggdGhpcy5yb290LCB0aGlzLmtleXBhdGggKTtcblx0XHRcdGlmICggdmFsdWVGcm9tTW9kZWwgIT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0bm9kZS5jaGVja2VkID0gdmFsdWVGcm9tTW9kZWwgPT0gbm9kZS5fcmFjdGl2ZS52YWx1ZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJ1bmxvb3AuYWRkUmFkaW8oIHRoaXMgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdFJhZGlvTmFtZUJpbmRpbmcucHJvdG90eXBlID0ge1xuXHRcdFx0dmFsdWU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5ub2RlLl9yYWN0aXZlID8gdGhpcy5ub2RlLl9yYWN0aXZlLnZhbHVlIDogdGhpcy5ub2RlLnZhbHVlO1xuXHRcdFx0fSxcblx0XHRcdHVwZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBub2RlID0gdGhpcy5ub2RlO1xuXHRcdFx0XHRpZiAoIG5vZGUuY2hlY2tlZCApIHtcblx0XHRcdFx0XHR0aGlzLmF0dHIucmVjZWl2aW5nID0gdHJ1ZTtcblx0XHRcdFx0XHRzZXQoIHRoaXMucm9vdCwgdGhpcy5rZXlwYXRoLCB0aGlzLnZhbHVlKCkgKTtcblx0XHRcdFx0XHRydW5sb29wLnRyaWdnZXIoKTtcblx0XHRcdFx0XHR0aGlzLmF0dHIucmVjZWl2aW5nID0gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHRoaXMubm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgdXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0XHRcdHRoaXMubm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2xpY2snLCB1cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdENoZWNrYm94TmFtZUJpbmRpbmcgPSBmdW5jdGlvbiggYXR0cmlidXRlLCBub2RlICkge1xuXHRcdFx0dmFyIHZhbHVlRnJvbU1vZGVsLCBjaGVja2VkO1xuXHRcdFx0dGhpcy5jaGVja2JveE5hbWUgPSB0cnVlO1xuXHRcdFx0aW5oZXJpdFByb3BlcnRpZXMoIHRoaXMsIGF0dHJpYnV0ZSwgbm9kZSApO1xuXHRcdFx0bm9kZS5uYW1lID0gJ3t7JyArIHRoaXMua2V5cGF0aCArICd9fSc7XG5cdFx0XHRub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCB1cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHRcdGlmICggbm9kZS5hdHRhY2hFdmVudCApIHtcblx0XHRcdFx0bm9kZS5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCB1cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHRcdH1cblx0XHRcdHZhbHVlRnJvbU1vZGVsID0gZ2V0KCB0aGlzLnJvb3QsIHRoaXMua2V5cGF0aCApO1xuXHRcdFx0aWYgKCB2YWx1ZUZyb21Nb2RlbCAhPT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRjaGVja2VkID0gdmFsdWVGcm9tTW9kZWwuaW5kZXhPZiggbm9kZS5fcmFjdGl2ZS52YWx1ZSApICE9PSAtMTtcblx0XHRcdFx0bm9kZS5jaGVja2VkID0gY2hlY2tlZDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJ1bmxvb3AuYWRkQ2hlY2tib3goIHRoaXMgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdENoZWNrYm94TmFtZUJpbmRpbmcucHJvdG90eXBlID0ge1xuXHRcdFx0Y2hhbmdlZDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLm5vZGUuY2hlY2tlZCAhPT0gISEgdGhpcy5jaGVja2VkO1xuXHRcdFx0fSxcblx0XHRcdHVwZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHRoaXMuY2hlY2tlZCA9IHRoaXMubm9kZS5jaGVja2VkO1xuXHRcdFx0XHR0aGlzLmF0dHIucmVjZWl2aW5nID0gdHJ1ZTtcblx0XHRcdFx0c2V0KCB0aGlzLnJvb3QsIHRoaXMua2V5cGF0aCwgZ2V0VmFsdWVGcm9tQ2hlY2tib3hlcyggdGhpcy5yb290LCB0aGlzLmtleXBhdGggKSApO1xuXHRcdFx0XHRydW5sb29wLnRyaWdnZXIoKTtcblx0XHRcdFx0dGhpcy5hdHRyLnJlY2VpdmluZyA9IGZhbHNlO1xuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dGhpcy5ub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCB1cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHRcdFx0dGhpcy5ub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdjbGljaycsIHVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0Q2hlY2tlZEJpbmRpbmcgPSBmdW5jdGlvbiggYXR0cmlidXRlLCBub2RlICkge1xuXHRcdFx0aW5oZXJpdFByb3BlcnRpZXMoIHRoaXMsIGF0dHJpYnV0ZSwgbm9kZSApO1xuXHRcdFx0bm9kZS5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgdXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0XHRpZiAoIG5vZGUuYXR0YWNoRXZlbnQgKSB7XG5cdFx0XHRcdG5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgdXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRDaGVja2VkQmluZGluZy5wcm90b3R5cGUgPSB7XG5cdFx0XHR2YWx1ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLm5vZGUuY2hlY2tlZDtcblx0XHRcdH0sXG5cdFx0XHR1cGRhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR0aGlzLmF0dHIucmVjZWl2aW5nID0gdHJ1ZTtcblx0XHRcdFx0c2V0KCB0aGlzLnJvb3QsIHRoaXMua2V5cGF0aCwgdGhpcy52YWx1ZSgpICk7XG5cdFx0XHRcdHJ1bmxvb3AudHJpZ2dlcigpO1xuXHRcdFx0XHR0aGlzLmF0dHIucmVjZWl2aW5nID0gZmFsc2U7XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR0aGlzLm5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIHVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdFx0XHR0aGlzLm5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgdXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRGaWxlTGlzdEJpbmRpbmcgPSBmdW5jdGlvbiggYXR0cmlidXRlLCBub2RlICkge1xuXHRcdFx0aW5oZXJpdFByb3BlcnRpZXMoIHRoaXMsIGF0dHJpYnV0ZSwgbm9kZSApO1xuXHRcdFx0bm9kZS5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgdXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0fTtcblx0XHRGaWxlTGlzdEJpbmRpbmcucHJvdG90eXBlID0ge1xuXHRcdFx0dmFsdWU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5hdHRyLnBOb2RlLmZpbGVzO1xuXHRcdFx0fSxcblx0XHRcdHVwZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHNldCggdGhpcy5hdHRyLnJvb3QsIHRoaXMuYXR0ci5rZXlwYXRoLCB0aGlzLnZhbHVlKCkgKTtcblx0XHRcdFx0cnVubG9vcC50cmlnZ2VyKCk7XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR0aGlzLm5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIHVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0Q29udGVudEVkaXRhYmxlQmluZGluZyA9IGZ1bmN0aW9uKCBhdHRyaWJ1dGUsIG5vZGUgKSB7XG5cdFx0XHRpbmhlcml0UHJvcGVydGllcyggdGhpcywgYXR0cmlidXRlLCBub2RlICk7XG5cdFx0XHRub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCB1cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHRcdGlmICggIXRoaXMucm9vdC5sYXp5ICkge1xuXHRcdFx0XHRub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdpbnB1dCcsIHVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdFx0XHRpZiAoIG5vZGUuYXR0YWNoRXZlbnQgKSB7XG5cdFx0XHRcdFx0bm9kZS5hZGRFdmVudExpc3RlbmVyKCAna2V5dXAnLCB1cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdFx0Q29udGVudEVkaXRhYmxlQmluZGluZy5wcm90b3R5cGUgPSB7XG5cdFx0XHR1cGRhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR0aGlzLmF0dHIucmVjZWl2aW5nID0gdHJ1ZTtcblx0XHRcdFx0c2V0KCB0aGlzLnJvb3QsIHRoaXMua2V5cGF0aCwgdGhpcy5ub2RlLmlubmVySFRNTCApO1xuXHRcdFx0XHRydW5sb29wLnRyaWdnZXIoKTtcblx0XHRcdFx0dGhpcy5hdHRyLnJlY2VpdmluZyA9IGZhbHNlO1xuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dGhpcy5ub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCB1cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHRcdFx0dGhpcy5ub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdpbnB1dCcsIHVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdFx0XHR0aGlzLm5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2tleXVwJywgdXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRHZW5lcmljQmluZGluZyA9IGZ1bmN0aW9uKCBhdHRyaWJ1dGUsIG5vZGUgKSB7XG5cdFx0XHRpbmhlcml0UHJvcGVydGllcyggdGhpcywgYXR0cmlidXRlLCBub2RlICk7XG5cdFx0XHRub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCB1cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHRcdGlmICggIXRoaXMucm9vdC5sYXp5ICkge1xuXHRcdFx0XHRub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdpbnB1dCcsIHVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdFx0XHRpZiAoIG5vZGUuYXR0YWNoRXZlbnQgKSB7XG5cdFx0XHRcdFx0bm9kZS5hZGRFdmVudExpc3RlbmVyKCAna2V5dXAnLCB1cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0dGhpcy5ub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdibHVyJywgdXBkYXRlLCBmYWxzZSApO1xuXHRcdH07XG5cdFx0R2VuZXJpY0JpbmRpbmcucHJvdG90eXBlID0ge1xuXHRcdFx0dmFsdWU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgdmFsdWUgPSB0aGlzLmF0dHIucE5vZGUudmFsdWU7XG5cdFx0XHRcdGlmICggK3ZhbHVlICsgJycgPT09IHZhbHVlICYmIHZhbHVlLmluZGV4T2YoICdlJyApID09PSAtMSApIHtcblx0XHRcdFx0XHR2YWx1ZSA9ICt2YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0XHR9LFxuXHRcdFx0dXBkYXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIGF0dHJpYnV0ZSA9IHRoaXMuYXR0cixcblx0XHRcdFx0XHR2YWx1ZSA9IHRoaXMudmFsdWUoKTtcblx0XHRcdFx0YXR0cmlidXRlLnJlY2VpdmluZyA9IHRydWU7XG5cdFx0XHRcdHNldCggYXR0cmlidXRlLnJvb3QsIGF0dHJpYnV0ZS5rZXlwYXRoLCB2YWx1ZSApO1xuXHRcdFx0XHRydW5sb29wLnRyaWdnZXIoKTtcblx0XHRcdFx0YXR0cmlidXRlLnJlY2VpdmluZyA9IGZhbHNlO1xuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dGhpcy5ub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCB1cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHRcdFx0dGhpcy5ub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdpbnB1dCcsIHVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdFx0XHR0aGlzLm5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2tleXVwJywgdXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0XHRcdHRoaXMubm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKCAnYmx1cicsIHVwZGF0ZSwgZmFsc2UgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdGluaGVyaXRQcm9wZXJ0aWVzID0gZnVuY3Rpb24oIGJpbmRpbmcsIGF0dHJpYnV0ZSwgbm9kZSApIHtcblx0XHRcdGJpbmRpbmcuYXR0ciA9IGF0dHJpYnV0ZTtcblx0XHRcdGJpbmRpbmcubm9kZSA9IG5vZGU7XG5cdFx0XHRiaW5kaW5nLnJvb3QgPSBhdHRyaWJ1dGUucm9vdDtcblx0XHRcdGJpbmRpbmcua2V5cGF0aCA9IGF0dHJpYnV0ZS5rZXlwYXRoO1xuXHRcdH07XG5cdFx0cmV0dXJuIGJpbmRBdHRyaWJ1dGU7XG5cdH0oIGdsb2JhbF9ydW5sb29wLCB1dGlsc193YXJuLCB1dGlsc19hcnJheUNvbnRlbnRzTWF0Y2gsIHNoYXJlZF9nZXRWYWx1ZUZyb21DaGVja2JveGVzLCBzaGFyZWRfZ2V0X19nZXQsIHNoYXJlZF9zZXQgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0F0dHJpYnV0ZV9wcm90b3R5cGVfdXBkYXRlID0gZnVuY3Rpb24oIHJ1bmxvb3AsIG5hbWVzcGFjZXMsIGlzQXJyYXkgKSB7XG5cblx0XHR2YXIgdXBkYXRlQXR0cmlidXRlLCB1cGRhdGVGaWxlSW5wdXRWYWx1ZSwgZGVmZXJTZWxlY3QsIGluaXRTZWxlY3QsIHVwZGF0ZVNlbGVjdCwgdXBkYXRlTXVsdGlwbGVTZWxlY3QsIHVwZGF0ZVJhZGlvTmFtZSwgdXBkYXRlQ2hlY2tib3hOYW1lLCB1cGRhdGVJRVN0eWxlQXR0cmlidXRlLCB1cGRhdGVDbGFzc05hbWUsIHVwZGF0ZUNvbnRlbnRFZGl0YWJsZVZhbHVlLCB1cGRhdGVFdmVyeXRoaW5nRWxzZTtcblx0XHR1cGRhdGVBdHRyaWJ1dGUgPSBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBub2RlO1xuXHRcdFx0aWYgKCAhdGhpcy5yZWFkeSApIHtcblx0XHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0XHR9XG5cdFx0XHRub2RlID0gdGhpcy5wTm9kZTtcblx0XHRcdGlmICggbm9kZS50YWdOYW1lID09PSAnU0VMRUNUJyAmJiB0aGlzLmxjTmFtZSA9PT0gJ3ZhbHVlJyApIHtcblx0XHRcdFx0dGhpcy51cGRhdGUgPSBkZWZlclNlbGVjdDtcblx0XHRcdFx0dGhpcy5kZWZlcnJlZFVwZGF0ZSA9IGluaXRTZWxlY3Q7XG5cdFx0XHRcdHJldHVybiB0aGlzLnVwZGF0ZSgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aGlzLmlzRmlsZUlucHV0VmFsdWUgKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlID0gdXBkYXRlRmlsZUlucHV0VmFsdWU7XG5cdFx0XHRcdHJldHVybiB0aGlzO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aGlzLnR3b3dheSAmJiB0aGlzLmxjTmFtZSA9PT0gJ25hbWUnICkge1xuXHRcdFx0XHRpZiAoIG5vZGUudHlwZSA9PT0gJ3JhZGlvJyApIHtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZSA9IHVwZGF0ZVJhZGlvTmFtZTtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy51cGRhdGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIG5vZGUudHlwZSA9PT0gJ2NoZWNrYm94JyApIHtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZSA9IHVwZGF0ZUNoZWNrYm94TmFtZTtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy51cGRhdGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aGlzLmxjTmFtZSA9PT0gJ3N0eWxlJyAmJiBub2RlLnN0eWxlLnNldEF0dHJpYnV0ZSApIHtcblx0XHRcdFx0dGhpcy51cGRhdGUgPSB1cGRhdGVJRVN0eWxlQXR0cmlidXRlO1xuXHRcdFx0XHRyZXR1cm4gdGhpcy51cGRhdGUoKTtcblx0XHRcdH1cblx0XHRcdGlmICggdGhpcy5sY05hbWUgPT09ICdjbGFzcycgJiYgKCAhbm9kZS5uYW1lc3BhY2VVUkkgfHwgbm9kZS5uYW1lc3BhY2VVUkkgPT09IG5hbWVzcGFjZXMuaHRtbCApICkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZSA9IHVwZGF0ZUNsYXNzTmFtZTtcblx0XHRcdFx0cmV0dXJuIHRoaXMudXBkYXRlKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIG5vZGUuZ2V0QXR0cmlidXRlKCAnY29udGVudGVkaXRhYmxlJyApICYmIHRoaXMubGNOYW1lID09PSAndmFsdWUnICkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZSA9IHVwZGF0ZUNvbnRlbnRFZGl0YWJsZVZhbHVlO1xuXHRcdFx0XHRyZXR1cm4gdGhpcy51cGRhdGUoKTtcblx0XHRcdH1cblx0XHRcdHRoaXMudXBkYXRlID0gdXBkYXRlRXZlcnl0aGluZ0Vsc2U7XG5cdFx0XHRyZXR1cm4gdGhpcy51cGRhdGUoKTtcblx0XHR9O1xuXHRcdHVwZGF0ZUZpbGVJbnB1dFZhbHVlID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9O1xuXHRcdGluaXRTZWxlY3QgPSBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuZGVmZXJyZWRVcGRhdGUgPSB0aGlzLnBOb2RlLm11bHRpcGxlID8gdXBkYXRlTXVsdGlwbGVTZWxlY3QgOiB1cGRhdGVTZWxlY3Q7XG5cdFx0XHR0aGlzLmRlZmVycmVkVXBkYXRlKCk7XG5cdFx0fTtcblx0XHRkZWZlclNlbGVjdCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0cnVubG9vcC5hZGRTZWxlY3RWYWx1ZSggdGhpcyApO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fTtcblx0XHR1cGRhdGVTZWxlY3QgPSBmdW5jdGlvbigpIHtcblx0XHRcdHZhciB2YWx1ZSA9IHRoaXMuZnJhZ21lbnQuZ2V0VmFsdWUoKSxcblx0XHRcdFx0b3B0aW9ucywgb3B0aW9uLCBvcHRpb25WYWx1ZSwgaTtcblx0XHRcdHRoaXMudmFsdWUgPSB0aGlzLnBOb2RlLl9yYWN0aXZlLnZhbHVlID0gdmFsdWU7XG5cdFx0XHRvcHRpb25zID0gdGhpcy5wTm9kZS5vcHRpb25zO1xuXHRcdFx0aSA9IG9wdGlvbnMubGVuZ3RoO1xuXHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdG9wdGlvbiA9IG9wdGlvbnNbIGkgXTtcblx0XHRcdFx0b3B0aW9uVmFsdWUgPSBvcHRpb24uX3JhY3RpdmUgPyBvcHRpb24uX3JhY3RpdmUudmFsdWUgOiBvcHRpb24udmFsdWU7XG5cdFx0XHRcdGlmICggb3B0aW9uVmFsdWUgPT0gdmFsdWUgKSB7XG5cdFx0XHRcdFx0b3B0aW9uLnNlbGVjdGVkID0gdHJ1ZTtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fTtcblx0XHR1cGRhdGVNdWx0aXBsZVNlbGVjdCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIHZhbHVlID0gdGhpcy5mcmFnbWVudC5nZXRWYWx1ZSgpLFxuXHRcdFx0XHRvcHRpb25zLCBpLCBvcHRpb24sIG9wdGlvblZhbHVlO1xuXHRcdFx0aWYgKCAhaXNBcnJheSggdmFsdWUgKSApIHtcblx0XHRcdFx0dmFsdWUgPSBbIHZhbHVlIF07XG5cdFx0XHR9XG5cdFx0XHRvcHRpb25zID0gdGhpcy5wTm9kZS5vcHRpb25zO1xuXHRcdFx0aSA9IG9wdGlvbnMubGVuZ3RoO1xuXHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdG9wdGlvbiA9IG9wdGlvbnNbIGkgXTtcblx0XHRcdFx0b3B0aW9uVmFsdWUgPSBvcHRpb24uX3JhY3RpdmUgPyBvcHRpb24uX3JhY3RpdmUudmFsdWUgOiBvcHRpb24udmFsdWU7XG5cdFx0XHRcdG9wdGlvbi5zZWxlY3RlZCA9IHZhbHVlLmluZGV4T2YoIG9wdGlvblZhbHVlICkgIT09IC0xO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy52YWx1ZSA9IHZhbHVlO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fTtcblx0XHR1cGRhdGVSYWRpb05hbWUgPSBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBub2RlLCB2YWx1ZTtcblx0XHRcdG5vZGUgPSB0aGlzLnBOb2RlO1xuXHRcdFx0dmFsdWUgPSB0aGlzLmZyYWdtZW50LmdldFZhbHVlKCk7XG5cdFx0XHRub2RlLmNoZWNrZWQgPSB2YWx1ZSA9PSBub2RlLl9yYWN0aXZlLnZhbHVlO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fTtcblx0XHR1cGRhdGVDaGVja2JveE5hbWUgPSBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBub2RlLCB2YWx1ZTtcblx0XHRcdG5vZGUgPSB0aGlzLnBOb2RlO1xuXHRcdFx0dmFsdWUgPSB0aGlzLmZyYWdtZW50LmdldFZhbHVlKCk7XG5cdFx0XHRpZiAoICFpc0FycmF5KCB2YWx1ZSApICkge1xuXHRcdFx0XHRub2RlLmNoZWNrZWQgPSB2YWx1ZSA9PSBub2RlLl9yYWN0aXZlLnZhbHVlO1xuXHRcdFx0XHRyZXR1cm4gdGhpcztcblx0XHRcdH1cblx0XHRcdG5vZGUuY2hlY2tlZCA9IHZhbHVlLmluZGV4T2YoIG5vZGUuX3JhY3RpdmUudmFsdWUgKSAhPT0gLTE7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9O1xuXHRcdHVwZGF0ZUlFU3R5bGVBdHRyaWJ1dGUgPSBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBub2RlLCB2YWx1ZTtcblx0XHRcdG5vZGUgPSB0aGlzLnBOb2RlO1xuXHRcdFx0dmFsdWUgPSB0aGlzLmZyYWdtZW50LmdldFZhbHVlKCk7XG5cdFx0XHRpZiAoIHZhbHVlID09PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdHZhbHVlID0gJyc7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHZhbHVlICE9PSB0aGlzLnZhbHVlICkge1xuXHRcdFx0XHRub2RlLnN0eWxlLnNldEF0dHJpYnV0ZSggJ2Nzc1RleHQnLCB2YWx1ZSApO1xuXHRcdFx0XHR0aGlzLnZhbHVlID0gdmFsdWU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9O1xuXHRcdHVwZGF0ZUNsYXNzTmFtZSA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIG5vZGUsIHZhbHVlO1xuXHRcdFx0bm9kZSA9IHRoaXMucE5vZGU7XG5cdFx0XHR2YWx1ZSA9IHRoaXMuZnJhZ21lbnQuZ2V0VmFsdWUoKTtcblx0XHRcdGlmICggdmFsdWUgPT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0dmFsdWUgPSAnJztcblx0XHRcdH1cblx0XHRcdGlmICggdmFsdWUgIT09IHRoaXMudmFsdWUgKSB7XG5cdFx0XHRcdG5vZGUuY2xhc3NOYW1lID0gdmFsdWU7XG5cdFx0XHRcdHRoaXMudmFsdWUgPSB2YWx1ZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH07XG5cdFx0dXBkYXRlQ29udGVudEVkaXRhYmxlVmFsdWUgPSBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBub2RlLCB2YWx1ZTtcblx0XHRcdG5vZGUgPSB0aGlzLnBOb2RlO1xuXHRcdFx0dmFsdWUgPSB0aGlzLmZyYWdtZW50LmdldFZhbHVlKCk7XG5cdFx0XHRpZiAoIHZhbHVlID09PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdHZhbHVlID0gJyc7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHZhbHVlICE9PSB0aGlzLnZhbHVlICkge1xuXHRcdFx0XHRpZiAoICF0aGlzLnJlY2VpdmluZyApIHtcblx0XHRcdFx0XHRub2RlLmlubmVySFRNTCA9IHZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMudmFsdWUgPSB2YWx1ZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH07XG5cdFx0dXBkYXRlRXZlcnl0aGluZ0Vsc2UgPSBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBub2RlLCB2YWx1ZTtcblx0XHRcdG5vZGUgPSB0aGlzLnBOb2RlO1xuXHRcdFx0dmFsdWUgPSB0aGlzLmZyYWdtZW50LmdldFZhbHVlKCk7XG5cdFx0XHRpZiAoIHRoaXMuaXNWYWx1ZUF0dHJpYnV0ZSApIHtcblx0XHRcdFx0bm9kZS5fcmFjdGl2ZS52YWx1ZSA9IHZhbHVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB2YWx1ZSA9PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdHZhbHVlID0gJyc7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHZhbHVlICE9PSB0aGlzLnZhbHVlICkge1xuXHRcdFx0XHRpZiAoIHRoaXMudXNlUHJvcGVydHkgKSB7XG5cdFx0XHRcdFx0aWYgKCAhdGhpcy5yZWNlaXZpbmcgKSB7XG5cdFx0XHRcdFx0XHRub2RlWyB0aGlzLnByb3BlcnR5TmFtZSBdID0gdmFsdWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoaXMudmFsdWUgPSB2YWx1ZTtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcztcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHRoaXMubmFtZXNwYWNlICkge1xuXHRcdFx0XHRcdG5vZGUuc2V0QXR0cmlidXRlTlMoIHRoaXMubmFtZXNwYWNlLCB0aGlzLm5hbWUsIHZhbHVlICk7XG5cdFx0XHRcdFx0dGhpcy52YWx1ZSA9IHZhbHVlO1xuXHRcdFx0XHRcdHJldHVybiB0aGlzO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggdGhpcy5sY05hbWUgPT09ICdpZCcgKSB7XG5cdFx0XHRcdFx0aWYgKCB0aGlzLnZhbHVlICE9PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdFx0XHR0aGlzLnJvb3Qubm9kZXNbIHRoaXMudmFsdWUgXSA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGhpcy5yb290Lm5vZGVzWyB2YWx1ZSBdID0gbm9kZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRub2RlLnNldEF0dHJpYnV0ZSggdGhpcy5uYW1lLCB2YWx1ZSApO1xuXHRcdFx0XHR0aGlzLnZhbHVlID0gdmFsdWU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9O1xuXHRcdHJldHVybiB1cGRhdGVBdHRyaWJ1dGU7XG5cdH0oIGdsb2JhbF9ydW5sb29wLCBjb25maWdfbmFtZXNwYWNlcywgdXRpbHNfaXNBcnJheSApO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfdXRpbHNfZ2V0U3RyaW5nTWF0Y2ggPSBmdW5jdGlvbiggc3RyaW5nICkge1xuXHRcdHZhciBzdWJzdHI7XG5cdFx0c3Vic3RyID0gdGhpcy5zdHIuc3Vic3RyKCB0aGlzLnBvcywgc3RyaW5nLmxlbmd0aCApO1xuXHRcdGlmICggc3Vic3RyID09PSBzdHJpbmcgKSB7XG5cdFx0XHR0aGlzLnBvcyArPSBzdHJpbmcubGVuZ3RoO1xuXHRcdFx0cmV0dXJuIHN0cmluZztcblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH07XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl91dGlsc19hbGxvd1doaXRlc3BhY2UgPSBmdW5jdGlvbigpIHtcblxuXHRcdHZhciBsZWFkaW5nV2hpdGVzcGFjZSA9IC9eXFxzKy87XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIG1hdGNoID0gbGVhZGluZ1doaXRlc3BhY2UuZXhlYyggdGhpcy5yZW1haW5pbmcoKSApO1xuXHRcdFx0aWYgKCAhbWF0Y2ggKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5wb3MgKz0gbWF0Y2hbIDAgXS5sZW5ndGg7XG5cdFx0XHRyZXR1cm4gbWF0Y2hbIDAgXTtcblx0XHR9O1xuXHR9KCk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl91dGlsc19tYWtlUmVnZXhNYXRjaGVyID0gZnVuY3Rpb24oIHJlZ2V4ICkge1xuXHRcdHJldHVybiBmdW5jdGlvbiggdG9rZW5pemVyICkge1xuXHRcdFx0dmFyIG1hdGNoID0gcmVnZXguZXhlYyggdG9rZW5pemVyLnN0ci5zdWJzdHJpbmcoIHRva2VuaXplci5wb3MgKSApO1xuXHRcdFx0aWYgKCAhbWF0Y2ggKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0dG9rZW5pemVyLnBvcyArPSBtYXRjaFsgMCBdLmxlbmd0aDtcblx0XHRcdHJldHVybiBtYXRjaFsgMSBdIHx8IG1hdGNoWyAwIF07XG5cdFx0fTtcblx0fTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9nZXRMaXRlcmFsX2dldFN0cmluZ0xpdGVyYWxfbWFrZVF1b3RlZFN0cmluZ01hdGNoZXIgPSBmdW5jdGlvbiggbWFrZVJlZ2V4TWF0Y2hlciApIHtcblxuXHRcdHZhciBnZXRTdHJpbmdNaWRkbGUsIGdldEVzY2FwZVNlcXVlbmNlLCBnZXRMaW5lQ29udGludWF0aW9uO1xuXHRcdGdldFN0cmluZ01pZGRsZSA9IG1ha2VSZWdleE1hdGNoZXIoIC9eKD89LilbXlwiJ1xcXFxdKz8oPzooPyEuKXwoPz1bXCInXFxcXF0pKS8gKTtcblx0XHRnZXRFc2NhcGVTZXF1ZW5jZSA9IG1ha2VSZWdleE1hdGNoZXIoIC9eXFxcXCg/OlsnXCJcXFxcYmZucnRdfDAoPyFbMC05XSl8eFswLTlhLWZBLUZdezJ9fHVbMC05YS1mQS1GXXs0fXwoPz0uKVtedXgwLTldKS8gKTtcblx0XHRnZXRMaW5lQ29udGludWF0aW9uID0gbWFrZVJlZ2V4TWF0Y2hlciggL15cXFxcKD86XFxyXFxufFtcXHUwMDBBXFx1MDAwRFxcdTIwMjhcXHUyMDI5XSkvICk7XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBxdW90ZSwgb2tRdW90ZSApIHtcblx0XHRcdHJldHVybiBmdW5jdGlvbiggdG9rZW5pemVyICkge1xuXHRcdFx0XHR2YXIgc3RhcnQsIGxpdGVyYWwsIGRvbmUsIG5leHQ7XG5cdFx0XHRcdHN0YXJ0ID0gdG9rZW5pemVyLnBvcztcblx0XHRcdFx0bGl0ZXJhbCA9ICdcIic7XG5cdFx0XHRcdGRvbmUgPSBmYWxzZTtcblx0XHRcdFx0d2hpbGUgKCAhZG9uZSApIHtcblx0XHRcdFx0XHRuZXh0ID0gZ2V0U3RyaW5nTWlkZGxlKCB0b2tlbml6ZXIgKSB8fCBnZXRFc2NhcGVTZXF1ZW5jZSggdG9rZW5pemVyICkgfHwgdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCBva1F1b3RlICk7XG5cdFx0XHRcdFx0aWYgKCBuZXh0ICkge1xuXHRcdFx0XHRcdFx0aWYgKCBuZXh0ID09PSAnXCInICkge1xuXHRcdFx0XHRcdFx0XHRsaXRlcmFsICs9ICdcXFxcXCInO1xuXHRcdFx0XHRcdFx0fSBlbHNlIGlmICggbmV4dCA9PT0gJ1xcXFxcXCcnICkge1xuXHRcdFx0XHRcdFx0XHRsaXRlcmFsICs9ICdcXCcnO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0bGl0ZXJhbCArPSBuZXh0O1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRuZXh0ID0gZ2V0TGluZUNvbnRpbnVhdGlvbiggdG9rZW5pemVyICk7XG5cdFx0XHRcdFx0XHRpZiAoIG5leHQgKSB7XG5cdFx0XHRcdFx0XHRcdGxpdGVyYWwgKz0gJ1xcXFx1JyArICggJzAwMCcgKyBuZXh0LmNoYXJDb2RlQXQoIDEgKS50b1N0cmluZyggMTYgKSApLnNsaWNlKCAtNCApO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0ZG9uZSA9IHRydWU7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGxpdGVyYWwgKz0gJ1wiJztcblx0XHRcdFx0cmV0dXJuIEpTT04ucGFyc2UoIGxpdGVyYWwgKTtcblx0XHRcdH07XG5cdFx0fTtcblx0fSggcGFyc2VfVG9rZW5pemVyX3V0aWxzX21ha2VSZWdleE1hdGNoZXIgKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9nZXRMaXRlcmFsX2dldFN0cmluZ0xpdGVyYWxfZ2V0U2luZ2xlUXVvdGVkU3RyaW5nID0gZnVuY3Rpb24oIG1ha2VRdW90ZWRTdHJpbmdNYXRjaGVyICkge1xuXG5cdFx0cmV0dXJuIG1ha2VRdW90ZWRTdHJpbmdNYXRjaGVyKCAnXFwnJywgJ1wiJyApO1xuXHR9KCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X2dldExpdGVyYWxfZ2V0U3RyaW5nTGl0ZXJhbF9tYWtlUXVvdGVkU3RyaW5nTWF0Y2hlciApO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X2dldExpdGVyYWxfZ2V0U3RyaW5nTGl0ZXJhbF9nZXREb3VibGVRdW90ZWRTdHJpbmcgPSBmdW5jdGlvbiggbWFrZVF1b3RlZFN0cmluZ01hdGNoZXIgKSB7XG5cblx0XHRyZXR1cm4gbWFrZVF1b3RlZFN0cmluZ01hdGNoZXIoICdcIicsICdcXCcnICk7XG5cdH0oIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfZ2V0TGl0ZXJhbF9nZXRTdHJpbmdMaXRlcmFsX21ha2VRdW90ZWRTdHJpbmdNYXRjaGVyICk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfZ2V0TGl0ZXJhbF9nZXRTdHJpbmdMaXRlcmFsX19nZXRTdHJpbmdMaXRlcmFsID0gZnVuY3Rpb24oIHR5cGVzLCBnZXRTaW5nbGVRdW90ZWRTdHJpbmcsIGdldERvdWJsZVF1b3RlZFN0cmluZyApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggdG9rZW5pemVyICkge1xuXHRcdFx0dmFyIHN0YXJ0LCBzdHJpbmc7XG5cdFx0XHRzdGFydCA9IHRva2VuaXplci5wb3M7XG5cdFx0XHRpZiAoIHRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJ1wiJyApICkge1xuXHRcdFx0XHRzdHJpbmcgPSBnZXREb3VibGVRdW90ZWRTdHJpbmcoIHRva2VuaXplciApO1xuXHRcdFx0XHRpZiAoICF0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICdcIicgKSApIHtcblx0XHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHR0OiB0eXBlcy5TVFJJTkdfTElURVJBTCxcblx0XHRcdFx0XHR2OiBzdHJpbmdcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHRcdGlmICggdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnXFwnJyApICkge1xuXHRcdFx0XHRzdHJpbmcgPSBnZXRTaW5nbGVRdW90ZWRTdHJpbmcoIHRva2VuaXplciApO1xuXHRcdFx0XHRpZiAoICF0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICdcXCcnICkgKSB7XG5cdFx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0dDogdHlwZXMuU1RSSU5HX0xJVEVSQUwsXG5cdFx0XHRcdFx0djogc3RyaW5nXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9O1xuXHR9KCBjb25maWdfdHlwZXMsIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfZ2V0TGl0ZXJhbF9nZXRTdHJpbmdMaXRlcmFsX2dldFNpbmdsZVF1b3RlZFN0cmluZywgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9nZXRMaXRlcmFsX2dldFN0cmluZ0xpdGVyYWxfZ2V0RG91YmxlUXVvdGVkU3RyaW5nICk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfZ2V0TGl0ZXJhbF9nZXROdW1iZXJMaXRlcmFsID0gZnVuY3Rpb24oIHR5cGVzLCBtYWtlUmVnZXhNYXRjaGVyICkge1xuXG5cdFx0dmFyIGdldE51bWJlciA9IG1ha2VSZWdleE1hdGNoZXIoIC9eKD86WystXT8pKD86KD86KD86MHxbMS05XVxcZCopP1xcLlxcZCspfCg/Oig/OjB8WzEtOV1cXGQqKVxcLil8KD86MHxbMS05XVxcZCopKSg/OltlRV1bKy1dP1xcZCspPy8gKTtcblx0XHRyZXR1cm4gZnVuY3Rpb24oIHRva2VuaXplciApIHtcblx0XHRcdHZhciByZXN1bHQ7XG5cdFx0XHRpZiAoIHJlc3VsdCA9IGdldE51bWJlciggdG9rZW5pemVyICkgKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0dDogdHlwZXMuTlVNQkVSX0xJVEVSQUwsXG5cdFx0XHRcdFx0djogcmVzdWx0XG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9O1xuXHR9KCBjb25maWdfdHlwZXMsIHBhcnNlX1Rva2VuaXplcl91dGlsc19tYWtlUmVnZXhNYXRjaGVyICk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX3NoYXJlZF9nZXROYW1lID0gZnVuY3Rpb24oIG1ha2VSZWdleE1hdGNoZXIgKSB7XG5cblx0XHRyZXR1cm4gbWFrZVJlZ2V4TWF0Y2hlciggL15bYS16QS1aXyRdW2EtekEtWl8kMC05XSovICk7XG5cdH0oIHBhcnNlX1Rva2VuaXplcl91dGlsc19tYWtlUmVnZXhNYXRjaGVyICk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX3NoYXJlZF9nZXRLZXkgPSBmdW5jdGlvbiggZ2V0U3RyaW5nTGl0ZXJhbCwgZ2V0TnVtYmVyTGl0ZXJhbCwgZ2V0TmFtZSApIHtcblxuXHRcdHZhciBpZGVudGlmaWVyID0gL15bYS16QS1aXyRdW2EtekEtWl8kMC05XSokLztcblx0XHRyZXR1cm4gZnVuY3Rpb24oIHRva2VuaXplciApIHtcblx0XHRcdHZhciB0b2tlbjtcblx0XHRcdGlmICggdG9rZW4gPSBnZXRTdHJpbmdMaXRlcmFsKCB0b2tlbml6ZXIgKSApIHtcblx0XHRcdFx0cmV0dXJuIGlkZW50aWZpZXIudGVzdCggdG9rZW4udiApID8gdG9rZW4udiA6ICdcIicgKyB0b2tlbi52LnJlcGxhY2UoIC9cIi9nLCAnXFxcXFwiJyApICsgJ1wiJztcblx0XHRcdH1cblx0XHRcdGlmICggdG9rZW4gPSBnZXROdW1iZXJMaXRlcmFsKCB0b2tlbml6ZXIgKSApIHtcblx0XHRcdFx0cmV0dXJuIHRva2VuLnY7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRva2VuID0gZ2V0TmFtZSggdG9rZW5pemVyICkgKSB7XG5cdFx0XHRcdHJldHVybiB0b2tlbjtcblx0XHRcdH1cblx0XHR9O1xuXHR9KCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X2dldExpdGVyYWxfZ2V0U3RyaW5nTGl0ZXJhbF9fZ2V0U3RyaW5nTGl0ZXJhbCwgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9nZXRMaXRlcmFsX2dldE51bWJlckxpdGVyYWwsIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX3NoYXJlZF9nZXROYW1lICk7XG5cblx0dmFyIHV0aWxzX3BhcnNlSlNPTiA9IGZ1bmN0aW9uKCBnZXRTdHJpbmdNYXRjaCwgYWxsb3dXaGl0ZXNwYWNlLCBnZXRTdHJpbmdMaXRlcmFsLCBnZXRLZXkgKSB7XG5cblx0XHR2YXIgVG9rZW5pemVyLCBzcGVjaWFscywgc3BlY2lhbHNQYXR0ZXJuLCBudW1iZXJQYXR0ZXJuLCBwbGFjZWhvbGRlclBhdHRlcm4sIHBsYWNlaG9sZGVyQXRTdGFydFBhdHRlcm47XG5cdFx0c3BlY2lhbHMgPSB7XG5cdFx0XHQndHJ1ZSc6IHRydWUsXG5cdFx0XHQnZmFsc2UnOiBmYWxzZSxcblx0XHRcdCd1bmRlZmluZWQnOiB1bmRlZmluZWQsXG5cdFx0XHQnbnVsbCc6IG51bGxcblx0XHR9O1xuXHRcdHNwZWNpYWxzUGF0dGVybiA9IG5ldyBSZWdFeHAoICdeKD86JyArIE9iamVjdC5rZXlzKCBzcGVjaWFscyApLmpvaW4oICd8JyApICsgJyknICk7XG5cdFx0bnVtYmVyUGF0dGVybiA9IC9eKD86WystXT8pKD86KD86KD86MHxbMS05XVxcZCopP1xcLlxcZCspfCg/Oig/OjB8WzEtOV1cXGQqKVxcLil8KD86MHxbMS05XVxcZCopKSg/OltlRV1bKy1dP1xcZCspPy87XG5cdFx0cGxhY2Vob2xkZXJQYXR0ZXJuID0gL1xcJFxceyhbXlxcfV0rKVxcfS9nO1xuXHRcdHBsYWNlaG9sZGVyQXRTdGFydFBhdHRlcm4gPSAvXlxcJFxceyhbXlxcfV0rKVxcfS87XG5cdFx0VG9rZW5pemVyID0gZnVuY3Rpb24oIHN0ciwgdmFsdWVzICkge1xuXHRcdFx0dGhpcy5zdHIgPSBzdHI7XG5cdFx0XHR0aGlzLnZhbHVlcyA9IHZhbHVlcztcblx0XHRcdHRoaXMucG9zID0gMDtcblx0XHRcdHRoaXMucmVzdWx0ID0gdGhpcy5nZXRUb2tlbigpO1xuXHRcdH07XG5cdFx0VG9rZW5pemVyLnByb3RvdHlwZSA9IHtcblx0XHRcdHJlbWFpbmluZzogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnN0ci5zdWJzdHJpbmcoIHRoaXMucG9zICk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0U3RyaW5nTWF0Y2g6IGdldFN0cmluZ01hdGNoLFxuXHRcdFx0Z2V0VG9rZW46IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR0aGlzLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5nZXRQbGFjZWhvbGRlcigpIHx8IHRoaXMuZ2V0U3BlY2lhbCgpIHx8IHRoaXMuZ2V0TnVtYmVyKCkgfHwgdGhpcy5nZXRTdHJpbmcoKSB8fCB0aGlzLmdldE9iamVjdCgpIHx8IHRoaXMuZ2V0QXJyYXkoKTtcblx0XHRcdH0sXG5cdFx0XHRnZXRQbGFjZWhvbGRlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBtYXRjaDtcblx0XHRcdFx0aWYgKCAhdGhpcy52YWx1ZXMgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCAoIG1hdGNoID0gcGxhY2Vob2xkZXJBdFN0YXJ0UGF0dGVybi5leGVjKCB0aGlzLnJlbWFpbmluZygpICkgKSAmJiB0aGlzLnZhbHVlcy5oYXNPd25Qcm9wZXJ0eSggbWF0Y2hbIDEgXSApICkge1xuXHRcdFx0XHRcdHRoaXMucG9zICs9IG1hdGNoWyAwIF0ubGVuZ3RoO1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHR2OiB0aGlzLnZhbHVlc1sgbWF0Y2hbIDEgXSBdXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGdldFNwZWNpYWw6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgbWF0Y2g7XG5cdFx0XHRcdGlmICggbWF0Y2ggPSBzcGVjaWFsc1BhdHRlcm4uZXhlYyggdGhpcy5yZW1haW5pbmcoKSApICkge1xuXHRcdFx0XHRcdHRoaXMucG9zICs9IG1hdGNoWyAwIF0ubGVuZ3RoO1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHR2OiBzcGVjaWFsc1sgbWF0Y2hbIDAgXSBdXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGdldE51bWJlcjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBtYXRjaDtcblx0XHRcdFx0aWYgKCBtYXRjaCA9IG51bWJlclBhdHRlcm4uZXhlYyggdGhpcy5yZW1haW5pbmcoKSApICkge1xuXHRcdFx0XHRcdHRoaXMucG9zICs9IG1hdGNoWyAwIF0ubGVuZ3RoO1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHR2OiArbWF0Y2hbIDAgXVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRnZXRTdHJpbmc6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgc3RyaW5nTGl0ZXJhbCA9IGdldFN0cmluZ0xpdGVyYWwoIHRoaXMgKSxcblx0XHRcdFx0XHR2YWx1ZXM7XG5cdFx0XHRcdGlmICggc3RyaW5nTGl0ZXJhbCAmJiAoIHZhbHVlcyA9IHRoaXMudmFsdWVzICkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdHY6IHN0cmluZ0xpdGVyYWwudi5yZXBsYWNlKCBwbGFjZWhvbGRlclBhdHRlcm4sIGZ1bmN0aW9uKCBtYXRjaCwgJDEgKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiB2YWx1ZXNbICQxIF0gfHwgJDE7XG5cdFx0XHRcdFx0XHR9IClcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBzdHJpbmdMaXRlcmFsO1xuXHRcdFx0fSxcblx0XHRcdGdldE9iamVjdDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciByZXN1bHQsIHBhaXI7XG5cdFx0XHRcdGlmICggIXRoaXMuZ2V0U3RyaW5nTWF0Y2goICd7JyApICkge1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlc3VsdCA9IHt9O1xuXHRcdFx0XHR3aGlsZSAoIHBhaXIgPSBnZXRLZXlWYWx1ZVBhaXIoIHRoaXMgKSApIHtcblx0XHRcdFx0XHRyZXN1bHRbIHBhaXIua2V5IF0gPSBwYWlyLnZhbHVlO1xuXHRcdFx0XHRcdHRoaXMuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRcdFx0aWYgKCB0aGlzLmdldFN0cmluZ01hdGNoKCAnfScgKSApIHtcblx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdHY6IHJlc3VsdFxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCAhdGhpcy5nZXRTdHJpbmdNYXRjaCggJywnICkgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0QXJyYXk6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgcmVzdWx0LCB2YWx1ZVRva2VuO1xuXHRcdFx0XHRpZiAoICF0aGlzLmdldFN0cmluZ01hdGNoKCAnWycgKSApIHtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXN1bHQgPSBbXTtcblx0XHRcdFx0d2hpbGUgKCB2YWx1ZVRva2VuID0gdGhpcy5nZXRUb2tlbigpICkge1xuXHRcdFx0XHRcdHJlc3VsdC5wdXNoKCB2YWx1ZVRva2VuLnYgKTtcblx0XHRcdFx0XHRpZiAoIHRoaXMuZ2V0U3RyaW5nTWF0Y2goICddJyApICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0djogcmVzdWx0XG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoICF0aGlzLmdldFN0cmluZ01hdGNoKCAnLCcgKSApIHtcblx0XHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH0sXG5cdFx0XHRhbGxvd1doaXRlc3BhY2U6IGFsbG93V2hpdGVzcGFjZVxuXHRcdH07XG5cblx0XHRmdW5jdGlvbiBnZXRLZXlWYWx1ZVBhaXIoIHRva2VuaXplciApIHtcblx0XHRcdHZhciBrZXksIHZhbHVlVG9rZW4sIHBhaXI7XG5cdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRrZXkgPSBnZXRLZXkoIHRva2VuaXplciApO1xuXHRcdFx0aWYgKCAha2V5ICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHBhaXIgPSB7XG5cdFx0XHRcdGtleToga2V5XG5cdFx0XHR9O1xuXHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0aWYgKCAhdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnOicgKSApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHR2YWx1ZVRva2VuID0gdG9rZW5pemVyLmdldFRva2VuKCk7XG5cdFx0XHRpZiAoICF2YWx1ZVRva2VuICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHBhaXIudmFsdWUgPSB2YWx1ZVRva2VuLnY7XG5cdFx0XHRyZXR1cm4gcGFpcjtcblx0XHR9XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBzdHIsIHZhbHVlcyApIHtcblx0XHRcdHZhciB0b2tlbml6ZXIgPSBuZXcgVG9rZW5pemVyKCBzdHIsIHZhbHVlcyApO1xuXHRcdFx0aWYgKCB0b2tlbml6ZXIucmVzdWx0ICkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHZhbHVlOiB0b2tlbml6ZXIucmVzdWx0LnYsXG5cdFx0XHRcdFx0cmVtYWluaW5nOiB0b2tlbml6ZXIucmVtYWluaW5nKClcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH07XG5cdH0oIHBhcnNlX1Rva2VuaXplcl91dGlsc19nZXRTdHJpbmdNYXRjaCwgcGFyc2VfVG9rZW5pemVyX3V0aWxzX2FsbG93V2hpdGVzcGFjZSwgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9nZXRMaXRlcmFsX2dldFN0cmluZ0xpdGVyYWxfX2dldFN0cmluZ0xpdGVyYWwsIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX3NoYXJlZF9nZXRLZXkgKTtcblxuXHR2YXIgcmVuZGVyX1N0cmluZ0ZyYWdtZW50X0ludGVycG9sYXRvciA9IGZ1bmN0aW9uKCB0eXBlcywgdGVhcmRvd24sIGluaXRNdXN0YWNoZSwgdXBkYXRlTXVzdGFjaGUsIHJlc29sdmVNdXN0YWNoZSApIHtcblxuXHRcdHZhciBTdHJpbmdJbnRlcnBvbGF0b3IgPSBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdHRoaXMudHlwZSA9IHR5cGVzLklOVEVSUE9MQVRPUjtcblx0XHRcdGluaXRNdXN0YWNoZSggdGhpcywgb3B0aW9ucyApO1xuXHRcdH07XG5cdFx0U3RyaW5nSW50ZXJwb2xhdG9yLnByb3RvdHlwZSA9IHtcblx0XHRcdHVwZGF0ZTogdXBkYXRlTXVzdGFjaGUsXG5cdFx0XHRyZXNvbHZlOiByZXNvbHZlTXVzdGFjaGUsXG5cdFx0XHRyZW5kZXI6IGZ1bmN0aW9uKCB2YWx1ZSApIHtcblx0XHRcdFx0dGhpcy52YWx1ZSA9IHZhbHVlO1xuXHRcdFx0XHR0aGlzLnBhcmVudEZyYWdtZW50LmJ1YmJsZSgpO1xuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dGVhcmRvd24oIHRoaXMgKTtcblx0XHRcdH0sXG5cdFx0XHR0b1N0cmluZzogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmICggdGhpcy52YWx1ZSA9PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuICcnO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBzdHJpbmdpZnkoIHRoaXMudmFsdWUgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBTdHJpbmdJbnRlcnBvbGF0b3I7XG5cblx0XHRmdW5jdGlvbiBzdHJpbmdpZnkoIHZhbHVlICkge1xuXHRcdFx0aWYgKCB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkoIHZhbHVlICk7XG5cdFx0fVxuXHR9KCBjb25maWdfdHlwZXMsIHNoYXJlZF90ZWFyZG93biwgcmVuZGVyX3NoYXJlZF9pbml0TXVzdGFjaGUsIHJlbmRlcl9zaGFyZWRfdXBkYXRlTXVzdGFjaGUsIHJlbmRlcl9zaGFyZWRfcmVzb2x2ZU11c3RhY2hlICk7XG5cblx0dmFyIHJlbmRlcl9TdHJpbmdGcmFnbWVudF9TZWN0aW9uID0gZnVuY3Rpb24oIHR5cGVzLCBpbml0TXVzdGFjaGUsIHVwZGF0ZU11c3RhY2hlLCByZXNvbHZlTXVzdGFjaGUsIHVwZGF0ZVNlY3Rpb24sIHRlYXJkb3duLCBjaXJjdWxhciApIHtcblxuXHRcdHZhciBTdHJpbmdTZWN0aW9uLCBTdHJpbmdGcmFnbWVudDtcblx0XHRjaXJjdWxhci5wdXNoKCBmdW5jdGlvbigpIHtcblx0XHRcdFN0cmluZ0ZyYWdtZW50ID0gY2lyY3VsYXIuU3RyaW5nRnJhZ21lbnQ7XG5cdFx0fSApO1xuXHRcdFN0cmluZ1NlY3Rpb24gPSBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdHRoaXMudHlwZSA9IHR5cGVzLlNFQ1RJT047XG5cdFx0XHR0aGlzLmZyYWdtZW50cyA9IFtdO1xuXHRcdFx0dGhpcy5sZW5ndGggPSAwO1xuXHRcdFx0aW5pdE11c3RhY2hlKCB0aGlzLCBvcHRpb25zICk7XG5cdFx0fTtcblx0XHRTdHJpbmdTZWN0aW9uLnByb3RvdHlwZSA9IHtcblx0XHRcdHVwZGF0ZTogdXBkYXRlTXVzdGFjaGUsXG5cdFx0XHRyZXNvbHZlOiByZXNvbHZlTXVzdGFjaGUsXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHRoaXMudGVhcmRvd25GcmFnbWVudHMoKTtcblx0XHRcdFx0dGVhcmRvd24oIHRoaXMgKTtcblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bkZyYWdtZW50czogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHdoaWxlICggdGhpcy5mcmFnbWVudHMubGVuZ3RoICkge1xuXHRcdFx0XHRcdHRoaXMuZnJhZ21lbnRzLnNoaWZ0KCkudGVhcmRvd24oKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLmxlbmd0aCA9IDA7XG5cdFx0XHR9LFxuXHRcdFx0YnViYmxlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dGhpcy52YWx1ZSA9IHRoaXMuZnJhZ21lbnRzLmpvaW4oICcnICk7XG5cdFx0XHRcdHRoaXMucGFyZW50RnJhZ21lbnQuYnViYmxlKCk7XG5cdFx0XHR9LFxuXHRcdFx0cmVuZGVyOiBmdW5jdGlvbiggdmFsdWUgKSB7XG5cdFx0XHRcdHZhciB3cmFwcGVkO1xuXHRcdFx0XHRpZiAoIHdyYXBwZWQgPSB0aGlzLnJvb3QuX3dyYXBwZWRbIHRoaXMua2V5cGF0aCBdICkge1xuXHRcdFx0XHRcdHZhbHVlID0gd3JhcHBlZC5nZXQoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR1cGRhdGVTZWN0aW9uKCB0aGlzLCB2YWx1ZSApO1xuXHRcdFx0XHR0aGlzLnBhcmVudEZyYWdtZW50LmJ1YmJsZSgpO1xuXHRcdFx0fSxcblx0XHRcdGNyZWF0ZUZyYWdtZW50OiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFx0cmV0dXJuIG5ldyBTdHJpbmdGcmFnbWVudCggb3B0aW9ucyApO1xuXHRcdFx0fSxcblx0XHRcdHRvU3RyaW5nOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuZnJhZ21lbnRzLmpvaW4oICcnICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gU3RyaW5nU2VjdGlvbjtcblx0fSggY29uZmlnX3R5cGVzLCByZW5kZXJfc2hhcmVkX2luaXRNdXN0YWNoZSwgcmVuZGVyX3NoYXJlZF91cGRhdGVNdXN0YWNoZSwgcmVuZGVyX3NoYXJlZF9yZXNvbHZlTXVzdGFjaGUsIHJlbmRlcl9zaGFyZWRfdXBkYXRlU2VjdGlvbiwgc2hhcmVkX3RlYXJkb3duLCBjaXJjdWxhciApO1xuXG5cdHZhciByZW5kZXJfU3RyaW5nRnJhZ21lbnRfVGV4dCA9IGZ1bmN0aW9uKCB0eXBlcyApIHtcblxuXHRcdHZhciBTdHJpbmdUZXh0ID0gZnVuY3Rpb24oIHRleHQgKSB7XG5cdFx0XHR0aGlzLnR5cGUgPSB0eXBlcy5URVhUO1xuXHRcdFx0dGhpcy50ZXh0ID0gdGV4dDtcblx0XHR9O1xuXHRcdFN0cmluZ1RleHQucHJvdG90eXBlID0ge1xuXHRcdFx0dG9TdHJpbmc6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy50ZXh0O1xuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbigpIHt9XG5cdFx0fTtcblx0XHRyZXR1cm4gU3RyaW5nVGV4dDtcblx0fSggY29uZmlnX3R5cGVzICk7XG5cblx0dmFyIHJlbmRlcl9TdHJpbmdGcmFnbWVudF9wcm90b3R5cGVfdG9BcmdzTGlzdCA9IGZ1bmN0aW9uKCB3YXJuLCBwYXJzZUpTT04gKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgdmFsdWVzLCBjb3VudGVyLCBqc29uZXNxdWUsIGd1aWQsIGVycm9yTWVzc2FnZSwgcGFyc2VkLCBwcm9jZXNzSXRlbXM7XG5cdFx0XHRpZiAoICF0aGlzLmFyZ3NMaXN0IHx8IHRoaXMuZGlydHkgKSB7XG5cdFx0XHRcdHZhbHVlcyA9IHt9O1xuXHRcdFx0XHRjb3VudGVyID0gMDtcblx0XHRcdFx0Z3VpZCA9IHRoaXMucm9vdC5fZ3VpZDtcblx0XHRcdFx0cHJvY2Vzc0l0ZW1zID0gZnVuY3Rpb24oIGl0ZW1zICkge1xuXHRcdFx0XHRcdHJldHVybiBpdGVtcy5tYXAoIGZ1bmN0aW9uKCBpdGVtICkge1xuXHRcdFx0XHRcdFx0dmFyIHBsYWNlaG9sZGVySWQsIHdyYXBwZWQsIHZhbHVlO1xuXHRcdFx0XHRcdFx0aWYgKCBpdGVtLnRleHQgKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBpdGVtLnRleHQ7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoIGl0ZW0uZnJhZ21lbnRzICkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gaXRlbS5mcmFnbWVudHMubWFwKCBmdW5jdGlvbiggZnJhZ21lbnQgKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHByb2Nlc3NJdGVtcyggZnJhZ21lbnQuaXRlbXMgKTtcblx0XHRcdFx0XHRcdFx0fSApLmpvaW4oICcnICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRwbGFjZWhvbGRlcklkID0gZ3VpZCArICctJyArIGNvdW50ZXIrKztcblx0XHRcdFx0XHRcdGlmICggd3JhcHBlZCA9IGl0ZW0ucm9vdC5fd3JhcHBlZFsgaXRlbS5rZXlwYXRoIF0gKSB7XG5cdFx0XHRcdFx0XHRcdHZhbHVlID0gd3JhcHBlZC52YWx1ZTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHZhbHVlID0gaXRlbS52YWx1ZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHZhbHVlc1sgcGxhY2Vob2xkZXJJZCBdID0gdmFsdWU7XG5cdFx0XHRcdFx0XHRyZXR1cm4gJyR7JyArIHBsYWNlaG9sZGVySWQgKyAnfSc7XG5cdFx0XHRcdFx0fSApLmpvaW4oICcnICk7XG5cdFx0XHRcdH07XG5cdFx0XHRcdGpzb25lc3F1ZSA9IHByb2Nlc3NJdGVtcyggdGhpcy5pdGVtcyApO1xuXHRcdFx0XHRwYXJzZWQgPSBwYXJzZUpTT04oICdbJyArIGpzb25lc3F1ZSArICddJywgdmFsdWVzICk7XG5cdFx0XHRcdGlmICggIXBhcnNlZCApIHtcblx0XHRcdFx0XHRlcnJvck1lc3NhZ2UgPSAnQ291bGQgbm90IHBhcnNlIGRpcmVjdGl2ZSBhcmd1bWVudHMgKCcgKyB0aGlzLnRvU3RyaW5nKCkgKyAnKS4gSWYgeW91IHRoaW5rIHRoaXMgaXMgYSBidWcsIHBsZWFzZSBmaWxlIGFuIGlzc3VlIGF0IGh0dHA6Ly9naXRodWIuY29tL1JhY3RpdmVKUy9SYWN0aXZlL2lzc3Vlcyc7XG5cdFx0XHRcdFx0aWYgKCB0aGlzLnJvb3QuZGVidWcgKSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoIGVycm9yTWVzc2FnZSApO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR3YXJuKCBlcnJvck1lc3NhZ2UgKTtcblx0XHRcdFx0XHRcdHRoaXMuYXJnc0xpc3QgPSBbIGpzb25lc3F1ZSBdO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLmFyZ3NMaXN0ID0gcGFyc2VkLnZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuZGlydHkgPSBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0aGlzLmFyZ3NMaXN0O1xuXHRcdH07XG5cdH0oIHV0aWxzX3dhcm4sIHV0aWxzX3BhcnNlSlNPTiApO1xuXG5cdHZhciByZW5kZXJfU3RyaW5nRnJhZ21lbnRfX1N0cmluZ0ZyYWdtZW50ID0gZnVuY3Rpb24oIHR5cGVzLCBwYXJzZUpTT04sIGluaXRGcmFnbWVudCwgSW50ZXJwb2xhdG9yLCBTZWN0aW9uLCBUZXh0LCB0b0FyZ3NMaXN0LCBjaXJjdWxhciApIHtcblxuXHRcdHZhciBTdHJpbmdGcmFnbWVudCA9IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0aW5pdEZyYWdtZW50KCB0aGlzLCBvcHRpb25zICk7XG5cdFx0fTtcblx0XHRTdHJpbmdGcmFnbWVudC5wcm90b3R5cGUgPSB7XG5cdFx0XHRjcmVhdGVJdGVtOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFx0aWYgKCB0eXBlb2Ygb3B0aW9ucy5kZXNjcmlwdG9yID09PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IFRleHQoIG9wdGlvbnMuZGVzY3JpcHRvciApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHN3aXRjaCAoIG9wdGlvbnMuZGVzY3JpcHRvci50ICkge1xuXHRcdFx0XHRcdGNhc2UgdHlwZXMuSU5URVJQT0xBVE9SOlxuXHRcdFx0XHRcdFx0cmV0dXJuIG5ldyBJbnRlcnBvbGF0b3IoIG9wdGlvbnMgKTtcblx0XHRcdFx0XHRjYXNlIHR5cGVzLlRSSVBMRTpcblx0XHRcdFx0XHRcdHJldHVybiBuZXcgSW50ZXJwb2xhdG9yKCBvcHRpb25zICk7XG5cdFx0XHRcdFx0Y2FzZSB0eXBlcy5TRUNUSU9OOlxuXHRcdFx0XHRcdFx0cmV0dXJuIG5ldyBTZWN0aW9uKCBvcHRpb25zICk7XG5cdFx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRcdHRocm93ICdTb21ldGhpbmcgd2VudCB3cm9uZyBpbiBhIHJhdGhlciBpbnRlcmVzdGluZyB3YXknO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0YnViYmxlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dGhpcy5kaXJ0eSA9IHRydWU7XG5cdFx0XHRcdHRoaXMub3duZXIuYnViYmxlKCk7XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgbnVtSXRlbXMsIGk7XG5cdFx0XHRcdG51bUl0ZW1zID0gdGhpcy5pdGVtcy5sZW5ndGg7XG5cdFx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbnVtSXRlbXM7IGkgKz0gMSApIHtcblx0XHRcdFx0XHR0aGlzLml0ZW1zWyBpIF0udGVhcmRvd24oKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGdldFZhbHVlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHZhbHVlO1xuXHRcdFx0XHRpZiAoIHRoaXMuaXRlbXMubGVuZ3RoID09PSAxICYmIHRoaXMuaXRlbXNbIDAgXS50eXBlID09PSB0eXBlcy5JTlRFUlBPTEFUT1IgKSB7XG5cdFx0XHRcdFx0dmFsdWUgPSB0aGlzLml0ZW1zWyAwIF0udmFsdWU7XG5cdFx0XHRcdFx0aWYgKCB2YWx1ZSAhPT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdGhpcy50b1N0cmluZygpO1xuXHRcdFx0fSxcblx0XHRcdGlzU2ltcGxlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIGksIGl0ZW0sIGNvbnRhaW5zSW50ZXJwb2xhdG9yO1xuXHRcdFx0XHRpZiAoIHRoaXMuc2ltcGxlICE9PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuc2ltcGxlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGkgPSB0aGlzLml0ZW1zLmxlbmd0aDtcblx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0aXRlbSA9IHRoaXMuaXRlbXNbIGkgXTtcblx0XHRcdFx0XHRpZiAoIGl0ZW0udHlwZSA9PT0gdHlwZXMuVEVYVCApIHtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIGl0ZW0udHlwZSA9PT0gdHlwZXMuSU5URVJQT0xBVE9SICkge1xuXHRcdFx0XHRcdFx0aWYgKCBjb250YWluc0ludGVycG9sYXRvciApIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0Y29udGFpbnNJbnRlcnBvbGF0b3IgPSB0cnVlO1xuXHRcdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuc2ltcGxlID0gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRoaXMuc2ltcGxlID0gdHJ1ZTtcblx0XHRcdH0sXG5cdFx0XHR0b1N0cmluZzogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLml0ZW1zLmpvaW4oICcnICk7XG5cdFx0XHR9LFxuXHRcdFx0dG9KU09OOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHZhbHVlID0gdGhpcy5nZXRWYWx1ZSgpLFxuXHRcdFx0XHRcdHBhcnNlZDtcblx0XHRcdFx0aWYgKCB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHRcdHBhcnNlZCA9IHBhcnNlSlNPTiggdmFsdWUgKTtcblx0XHRcdFx0XHR2YWx1ZSA9IHBhcnNlZCA/IHBhcnNlZC52YWx1ZSA6IHZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHRcdH0sXG5cdFx0XHR0b0FyZ3NMaXN0OiB0b0FyZ3NMaXN0XG5cdFx0fTtcblx0XHRjaXJjdWxhci5TdHJpbmdGcmFnbWVudCA9IFN0cmluZ0ZyYWdtZW50O1xuXHRcdHJldHVybiBTdHJpbmdGcmFnbWVudDtcblx0fSggY29uZmlnX3R5cGVzLCB1dGlsc19wYXJzZUpTT04sIHJlbmRlcl9zaGFyZWRfaW5pdEZyYWdtZW50LCByZW5kZXJfU3RyaW5nRnJhZ21lbnRfSW50ZXJwb2xhdG9yLCByZW5kZXJfU3RyaW5nRnJhZ21lbnRfU2VjdGlvbiwgcmVuZGVyX1N0cmluZ0ZyYWdtZW50X1RleHQsIHJlbmRlcl9TdHJpbmdGcmFnbWVudF9wcm90b3R5cGVfdG9BcmdzTGlzdCwgY2lyY3VsYXIgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0F0dHJpYnV0ZV9fQXR0cmlidXRlID0gZnVuY3Rpb24oIHJ1bmxvb3AsIHR5cGVzLCBkZXRlcm1pbmVOYW1lQW5kTmFtZXNwYWNlLCBzZXRTdGF0aWNBdHRyaWJ1dGUsIGRldGVybWluZVByb3BlcnR5TmFtZSwgZ2V0SW50ZXJwb2xhdG9yLCBiaW5kLCB1cGRhdGUsIFN0cmluZ0ZyYWdtZW50ICkge1xuXG5cdFx0dmFyIERvbUF0dHJpYnV0ZSA9IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0dGhpcy50eXBlID0gdHlwZXMuQVRUUklCVVRFO1xuXHRcdFx0dGhpcy5lbGVtZW50ID0gb3B0aW9ucy5lbGVtZW50O1xuXHRcdFx0ZGV0ZXJtaW5lTmFtZUFuZE5hbWVzcGFjZSggdGhpcywgb3B0aW9ucy5uYW1lICk7XG5cdFx0XHRpZiAoIG9wdGlvbnMudmFsdWUgPT09IG51bGwgfHwgdHlwZW9mIG9wdGlvbnMudmFsdWUgPT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHRzZXRTdGF0aWNBdHRyaWJ1dGUoIHRoaXMsIG9wdGlvbnMgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5yb290ID0gb3B0aW9ucy5yb290O1xuXHRcdFx0dGhpcy5wTm9kZSA9IG9wdGlvbnMucE5vZGU7XG5cdFx0XHR0aGlzLnBhcmVudEZyYWdtZW50ID0gdGhpcy5lbGVtZW50LnBhcmVudEZyYWdtZW50O1xuXHRcdFx0dGhpcy5mcmFnbWVudCA9IG5ldyBTdHJpbmdGcmFnbWVudCgge1xuXHRcdFx0XHRkZXNjcmlwdG9yOiBvcHRpb25zLnZhbHVlLFxuXHRcdFx0XHRyb290OiB0aGlzLnJvb3QsXG5cdFx0XHRcdG93bmVyOiB0aGlzXG5cdFx0XHR9ICk7XG5cdFx0XHR0aGlzLmludGVycG9sYXRvciA9IGdldEludGVycG9sYXRvciggdGhpcyApO1xuXHRcdFx0aWYgKCAhdGhpcy5wTm9kZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aGlzLm5hbWUgPT09ICd2YWx1ZScgKSB7XG5cdFx0XHRcdHRoaXMuaXNWYWx1ZUF0dHJpYnV0ZSA9IHRydWU7XG5cdFx0XHRcdGlmICggdGhpcy5wTm9kZS50YWdOYW1lID09PSAnSU5QVVQnICYmIHRoaXMucE5vZGUudHlwZSA9PT0gJ2ZpbGUnICkge1xuXHRcdFx0XHRcdHRoaXMuaXNGaWxlSW5wdXRWYWx1ZSA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGRldGVybWluZVByb3BlcnR5TmFtZSggdGhpcywgb3B0aW9ucyApO1xuXHRcdFx0dGhpcy5zZWxmVXBkYXRpbmcgPSB0aGlzLmZyYWdtZW50LmlzU2ltcGxlKCk7XG5cdFx0XHR0aGlzLnJlYWR5ID0gdHJ1ZTtcblx0XHR9O1xuXHRcdERvbUF0dHJpYnV0ZS5wcm90b3R5cGUgPSB7XG5cdFx0XHRiaW5kOiBiaW5kLFxuXHRcdFx0dXBkYXRlOiB1cGRhdGUsXG5cdFx0XHR1cGRhdGVCaW5kaW5nczogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHRoaXMua2V5cGF0aCA9IHRoaXMuaW50ZXJwb2xhdG9yLmtleXBhdGggfHwgdGhpcy5pbnRlcnBvbGF0b3IucmVmO1xuXHRcdFx0XHRpZiAoIHRoaXMucHJvcGVydHlOYW1lID09PSAnbmFtZScgKSB7XG5cdFx0XHRcdFx0dGhpcy5wTm9kZS5uYW1lID0gJ3t7JyArIHRoaXMua2V5cGF0aCArICd9fSc7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBpO1xuXHRcdFx0XHRpZiAoIHRoaXMuYm91bmRFdmVudHMgKSB7XG5cdFx0XHRcdFx0aSA9IHRoaXMuYm91bmRFdmVudHMubGVuZ3RoO1xuXHRcdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdFx0dGhpcy5wTm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKCB0aGlzLmJvdW5kRXZlbnRzWyBpIF0sIHRoaXMudXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggdGhpcy5mcmFnbWVudCApIHtcblx0XHRcdFx0XHR0aGlzLmZyYWdtZW50LnRlYXJkb3duKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRidWJibGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZiAoIHRoaXMuc2VsZlVwZGF0aW5nICkge1xuXHRcdFx0XHRcdHRoaXMudXBkYXRlKCk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoICF0aGlzLmRlZmVycmVkICYmIHRoaXMucmVhZHkgKSB7XG5cdFx0XHRcdFx0cnVubG9vcC5hZGRBdHRyaWJ1dGUoIHRoaXMgKTtcblx0XHRcdFx0XHR0aGlzLmRlZmVycmVkID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHRvU3RyaW5nOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHN0ciwgaW50ZXJwb2xhdG9yO1xuXHRcdFx0XHRpZiAoIHRoaXMudmFsdWUgPT09IG51bGwgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMubmFtZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHRoaXMubmFtZSA9PT0gJ3ZhbHVlJyAmJiB0aGlzLmVsZW1lbnQubGNOYW1lID09PSAnc2VsZWN0JyApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCB0aGlzLm5hbWUgPT09ICduYW1lJyAmJiB0aGlzLmVsZW1lbnQubGNOYW1lID09PSAnaW5wdXQnICYmICggaW50ZXJwb2xhdG9yID0gdGhpcy5pbnRlcnBvbGF0b3IgKSApIHtcblx0XHRcdFx0XHRyZXR1cm4gJ25hbWU9e3snICsgKCBpbnRlcnBvbGF0b3Iua2V5cGF0aCB8fCBpbnRlcnBvbGF0b3IucmVmICkgKyAnfX0nO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggIXRoaXMuZnJhZ21lbnQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMubmFtZSArICc9JyArIEpTT04uc3RyaW5naWZ5KCB0aGlzLnZhbHVlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0c3RyID0gdGhpcy5mcmFnbWVudC50b1N0cmluZygpO1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5uYW1lICsgJz0nICsgSlNPTi5zdHJpbmdpZnkoIHN0ciApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIERvbUF0dHJpYnV0ZTtcblx0fSggZ2xvYmFsX3J1bmxvb3AsIGNvbmZpZ190eXBlcywgcmVuZGVyX0RvbUZyYWdtZW50X0F0dHJpYnV0ZV9oZWxwZXJzX2RldGVybWluZU5hbWVBbmROYW1lc3BhY2UsIHJlbmRlcl9Eb21GcmFnbWVudF9BdHRyaWJ1dGVfaGVscGVyc19zZXRTdGF0aWNBdHRyaWJ1dGUsIHJlbmRlcl9Eb21GcmFnbWVudF9BdHRyaWJ1dGVfaGVscGVyc19kZXRlcm1pbmVQcm9wZXJ0eU5hbWUsIHJlbmRlcl9Eb21GcmFnbWVudF9BdHRyaWJ1dGVfaGVscGVyc19nZXRJbnRlcnBvbGF0b3IsIHJlbmRlcl9Eb21GcmFnbWVudF9BdHRyaWJ1dGVfcHJvdG90eXBlX2JpbmQsIHJlbmRlcl9Eb21GcmFnbWVudF9BdHRyaWJ1dGVfcHJvdG90eXBlX3VwZGF0ZSwgcmVuZGVyX1N0cmluZ0ZyYWdtZW50X19TdHJpbmdGcmFnbWVudCApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9pbml0aWFsaXNlX2NyZWF0ZUVsZW1lbnRBdHRyaWJ1dGVzID0gZnVuY3Rpb24oIERvbUF0dHJpYnV0ZSApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggZWxlbWVudCwgYXR0cmlidXRlcyApIHtcblx0XHRcdHZhciBhdHRyTmFtZSwgYXR0clZhbHVlLCBhdHRyO1xuXHRcdFx0ZWxlbWVudC5hdHRyaWJ1dGVzID0gW107XG5cdFx0XHRmb3IgKCBhdHRyTmFtZSBpbiBhdHRyaWJ1dGVzICkge1xuXHRcdFx0XHRpZiAoIGF0dHJpYnV0ZXMuaGFzT3duUHJvcGVydHkoIGF0dHJOYW1lICkgKSB7XG5cdFx0XHRcdFx0YXR0clZhbHVlID0gYXR0cmlidXRlc1sgYXR0ck5hbWUgXTtcblx0XHRcdFx0XHRhdHRyID0gbmV3IERvbUF0dHJpYnV0ZSgge1xuXHRcdFx0XHRcdFx0ZWxlbWVudDogZWxlbWVudCxcblx0XHRcdFx0XHRcdG5hbWU6IGF0dHJOYW1lLFxuXHRcdFx0XHRcdFx0dmFsdWU6IGF0dHJWYWx1ZSxcblx0XHRcdFx0XHRcdHJvb3Q6IGVsZW1lbnQucm9vdCxcblx0XHRcdFx0XHRcdHBOb2RlOiBlbGVtZW50Lm5vZGVcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0ZWxlbWVudC5hdHRyaWJ1dGVzLnB1c2goIGVsZW1lbnQuYXR0cmlidXRlc1sgYXR0ck5hbWUgXSA9IGF0dHIgKTtcblx0XHRcdFx0XHRpZiAoIGF0dHJOYW1lICE9PSAnbmFtZScgKSB7XG5cdFx0XHRcdFx0XHRhdHRyLnVwZGF0ZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGVsZW1lbnQuYXR0cmlidXRlcztcblx0XHR9O1xuXHR9KCByZW5kZXJfRG9tRnJhZ21lbnRfQXR0cmlidXRlX19BdHRyaWJ1dGUgKTtcblxuXHR2YXIgdXRpbHNfdG9BcnJheSA9IGZ1bmN0aW9uIHRvQXJyYXkoIGFycmF5TGlrZSApIHtcblx0XHR2YXIgYXJyYXkgPSBbXSxcblx0XHRcdGkgPSBhcnJheUxpa2UubGVuZ3RoO1xuXHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0YXJyYXlbIGkgXSA9IGFycmF5TGlrZVsgaSBdO1xuXHRcdH1cblx0XHRyZXR1cm4gYXJyYXk7XG5cdH07XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9nZXRNYXRjaGluZ1N0YXRpY05vZGVzID0gZnVuY3Rpb24oIHRvQXJyYXkgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24gZ2V0TWF0Y2hpbmdTdGF0aWNOb2RlcyggZWxlbWVudCwgc2VsZWN0b3IgKSB7XG5cdFx0XHRpZiAoICFlbGVtZW50Lm1hdGNoaW5nU3RhdGljTm9kZXNbIHNlbGVjdG9yIF0gKSB7XG5cdFx0XHRcdGVsZW1lbnQubWF0Y2hpbmdTdGF0aWNOb2Rlc1sgc2VsZWN0b3IgXSA9IHRvQXJyYXkoIGVsZW1lbnQubm9kZS5xdWVyeVNlbGVjdG9yQWxsKCBzZWxlY3RvciApICk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZWxlbWVudC5tYXRjaGluZ1N0YXRpY05vZGVzWyBzZWxlY3RvciBdO1xuXHRcdH07XG5cdH0oIHV0aWxzX3RvQXJyYXkgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfaW5pdGlhbGlzZV9hcHBlbmRFbGVtZW50Q2hpbGRyZW4gPSBmdW5jdGlvbiggd2FybiwgbmFtZXNwYWNlcywgU3RyaW5nRnJhZ21lbnQsIGdldE1hdGNoaW5nU3RhdGljTm9kZXMsIGNpcmN1bGFyICkge1xuXG5cdFx0dmFyIERvbUZyYWdtZW50LCB1cGRhdGVDc3MsIHVwZGF0ZVNjcmlwdDtcblx0XHRjaXJjdWxhci5wdXNoKCBmdW5jdGlvbigpIHtcblx0XHRcdERvbUZyYWdtZW50ID0gY2lyY3VsYXIuRG9tRnJhZ21lbnQ7XG5cdFx0fSApO1xuXHRcdHVwZGF0ZUNzcyA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIG5vZGUgPSB0aGlzLm5vZGUsXG5cdFx0XHRcdGNvbnRlbnQgPSB0aGlzLmZyYWdtZW50LnRvU3RyaW5nKCk7XG5cdFx0XHRpZiAoIG5vZGUuc3R5bGVTaGVldCApIHtcblx0XHRcdFx0bm9kZS5zdHlsZVNoZWV0LmNzc1RleHQgPSBjb250ZW50O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bm9kZS5pbm5lckhUTUwgPSBjb250ZW50O1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0dXBkYXRlU2NyaXB0ID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRpZiAoICF0aGlzLm5vZGUudHlwZSB8fCB0aGlzLm5vZGUudHlwZSA9PT0gJ3RleHQvamF2YXNjcmlwdCcgKSB7XG5cdFx0XHRcdHdhcm4oICdTY3JpcHQgdGFnIHdhcyB1cGRhdGVkLiBUaGlzIGRvZXMgbm90IGNhdXNlIHRoZSBjb2RlIHRvIGJlIHJlLWV2YWx1YXRlZCEnICk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLm5vZGUudGV4dCA9IHRoaXMuZnJhZ21lbnQudG9TdHJpbmcoKTtcblx0XHR9O1xuXHRcdHJldHVybiBmdW5jdGlvbiBhcHBlbmRFbGVtZW50Q2hpbGRyZW4oIGVsZW1lbnQsIG5vZGUsIGRlc2NyaXB0b3IsIGRvY0ZyYWcgKSB7XG5cdFx0XHRpZiAoIGVsZW1lbnQubGNOYW1lID09PSAnc2NyaXB0JyB8fCBlbGVtZW50LmxjTmFtZSA9PT0gJ3N0eWxlJyApIHtcblx0XHRcdFx0ZWxlbWVudC5mcmFnbWVudCA9IG5ldyBTdHJpbmdGcmFnbWVudCgge1xuXHRcdFx0XHRcdGRlc2NyaXB0b3I6IGRlc2NyaXB0b3IuZixcblx0XHRcdFx0XHRyb290OiBlbGVtZW50LnJvb3QsXG5cdFx0XHRcdFx0b3duZXI6IGVsZW1lbnRcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRpZiAoIGRvY0ZyYWcgKSB7XG5cdFx0XHRcdFx0aWYgKCBlbGVtZW50LmxjTmFtZSA9PT0gJ3NjcmlwdCcgKSB7XG5cdFx0XHRcdFx0XHRlbGVtZW50LmJ1YmJsZSA9IHVwZGF0ZVNjcmlwdDtcblx0XHRcdFx0XHRcdGVsZW1lbnQubm9kZS50ZXh0ID0gZWxlbWVudC5mcmFnbWVudC50b1N0cmluZygpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRlbGVtZW50LmJ1YmJsZSA9IHVwZGF0ZUNzcztcblx0XHRcdFx0XHRcdGVsZW1lbnQuYnViYmxlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggdHlwZW9mIGRlc2NyaXB0b3IuZiA9PT0gJ3N0cmluZycgJiYgKCAhbm9kZSB8fCAoICFub2RlLm5hbWVzcGFjZVVSSSB8fCBub2RlLm5hbWVzcGFjZVVSSSA9PT0gbmFtZXNwYWNlcy5odG1sICkgKSApIHtcblx0XHRcdFx0ZWxlbWVudC5odG1sID0gZGVzY3JpcHRvci5mO1xuXHRcdFx0XHRpZiAoIGRvY0ZyYWcgKSB7XG5cdFx0XHRcdFx0bm9kZS5pbm5lckhUTUwgPSBlbGVtZW50Lmh0bWw7XG5cdFx0XHRcdFx0ZWxlbWVudC5tYXRjaGluZ1N0YXRpY05vZGVzID0ge307XG5cdFx0XHRcdFx0dXBkYXRlTGl2ZVF1ZXJpZXMoIGVsZW1lbnQgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZWxlbWVudC5mcmFnbWVudCA9IG5ldyBEb21GcmFnbWVudCgge1xuXHRcdFx0XHRcdGRlc2NyaXB0b3I6IGRlc2NyaXB0b3IuZixcblx0XHRcdFx0XHRyb290OiBlbGVtZW50LnJvb3QsXG5cdFx0XHRcdFx0cE5vZGU6IG5vZGUsXG5cdFx0XHRcdFx0b3duZXI6IGVsZW1lbnQsXG5cdFx0XHRcdFx0cEVsZW1lbnQ6IGVsZW1lbnRcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRpZiAoIGRvY0ZyYWcgKSB7XG5cdFx0XHRcdFx0bm9kZS5hcHBlbmRDaGlsZCggZWxlbWVudC5mcmFnbWVudC5kb2NGcmFnICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0ZnVuY3Rpb24gdXBkYXRlTGl2ZVF1ZXJpZXMoIGVsZW1lbnQgKSB7XG5cdFx0XHR2YXIgaW5zdGFuY2UsIGxpdmVRdWVyaWVzLCBub2RlLCBzZWxlY3RvciwgcXVlcnksIG1hdGNoaW5nU3RhdGljTm9kZXMsIGk7XG5cdFx0XHRub2RlID0gZWxlbWVudC5ub2RlO1xuXHRcdFx0aW5zdGFuY2UgPSBlbGVtZW50LnJvb3Q7XG5cdFx0XHRkbyB7XG5cdFx0XHRcdGxpdmVRdWVyaWVzID0gaW5zdGFuY2UuX2xpdmVRdWVyaWVzO1xuXHRcdFx0XHRpID0gbGl2ZVF1ZXJpZXMubGVuZ3RoO1xuXHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRzZWxlY3RvciA9IGxpdmVRdWVyaWVzWyBpIF07XG5cdFx0XHRcdFx0cXVlcnkgPSBsaXZlUXVlcmllc1sgc2VsZWN0b3IgXTtcblx0XHRcdFx0XHRtYXRjaGluZ1N0YXRpY05vZGVzID0gZ2V0TWF0Y2hpbmdTdGF0aWNOb2RlcyggZWxlbWVudCwgc2VsZWN0b3IgKTtcblx0XHRcdFx0XHRxdWVyeS5wdXNoLmFwcGx5KCBxdWVyeSwgbWF0Y2hpbmdTdGF0aWNOb2RlcyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9IHdoaWxlICggaW5zdGFuY2UgPSBpbnN0YW5jZS5fcGFyZW50ICk7XG5cdFx0fVxuXHR9KCB1dGlsc193YXJuLCBjb25maWdfbmFtZXNwYWNlcywgcmVuZGVyX1N0cmluZ0ZyYWdtZW50X19TdHJpbmdGcmFnbWVudCwgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2dldE1hdGNoaW5nU3RhdGljTm9kZXMsIGNpcmN1bGFyICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X2luaXRpYWxpc2VfZGVjb3JhdGVfRGVjb3JhdG9yID0gZnVuY3Rpb24oIHdhcm4sIFN0cmluZ0ZyYWdtZW50ICkge1xuXG5cdFx0dmFyIERlY29yYXRvciA9IGZ1bmN0aW9uKCBkZXNjcmlwdG9yLCByYWN0aXZlLCBvd25lciApIHtcblx0XHRcdHZhciBkZWNvcmF0b3IgPSB0aGlzLFxuXHRcdFx0XHRuYW1lLCBmcmFnbWVudCwgZXJyb3JNZXNzYWdlO1xuXHRcdFx0ZGVjb3JhdG9yLnJvb3QgPSByYWN0aXZlO1xuXHRcdFx0ZGVjb3JhdG9yLm5vZGUgPSBvd25lci5ub2RlO1xuXHRcdFx0bmFtZSA9IGRlc2NyaXB0b3IubiB8fCBkZXNjcmlwdG9yO1xuXHRcdFx0aWYgKCB0eXBlb2YgbmFtZSAhPT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdGZyYWdtZW50ID0gbmV3IFN0cmluZ0ZyYWdtZW50KCB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRvcjogbmFtZSxcblx0XHRcdFx0XHRyb290OiByYWN0aXZlLFxuXHRcdFx0XHRcdG93bmVyOiBvd25lclxuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdG5hbWUgPSBmcmFnbWVudC50b1N0cmluZygpO1xuXHRcdFx0XHRmcmFnbWVudC50ZWFyZG93bigpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBkZXNjcmlwdG9yLmEgKSB7XG5cdFx0XHRcdGRlY29yYXRvci5wYXJhbXMgPSBkZXNjcmlwdG9yLmE7XG5cdFx0XHR9IGVsc2UgaWYgKCBkZXNjcmlwdG9yLmQgKSB7XG5cdFx0XHRcdGRlY29yYXRvci5mcmFnbWVudCA9IG5ldyBTdHJpbmdGcmFnbWVudCgge1xuXHRcdFx0XHRcdGRlc2NyaXB0b3I6IGRlc2NyaXB0b3IuZCxcblx0XHRcdFx0XHRyb290OiByYWN0aXZlLFxuXHRcdFx0XHRcdG93bmVyOiBvd25lclxuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdGRlY29yYXRvci5wYXJhbXMgPSBkZWNvcmF0b3IuZnJhZ21lbnQudG9BcmdzTGlzdCgpO1xuXHRcdFx0XHRkZWNvcmF0b3IuZnJhZ21lbnQuYnViYmxlID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0dGhpcy5kaXJ0eSA9IHRydWU7XG5cdFx0XHRcdFx0ZGVjb3JhdG9yLnBhcmFtcyA9IHRoaXMudG9BcmdzTGlzdCgpO1xuXHRcdFx0XHRcdGlmICggZGVjb3JhdG9yLnJlYWR5ICkge1xuXHRcdFx0XHRcdFx0ZGVjb3JhdG9yLnVwZGF0ZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHRcdGRlY29yYXRvci5mbiA9IHJhY3RpdmUuZGVjb3JhdG9yc1sgbmFtZSBdO1xuXHRcdFx0aWYgKCAhZGVjb3JhdG9yLmZuICkge1xuXHRcdFx0XHRlcnJvck1lc3NhZ2UgPSAnTWlzc2luZyBcIicgKyBuYW1lICsgJ1wiIGRlY29yYXRvci4gWW91IG1heSBuZWVkIHRvIGRvd25sb2FkIGEgcGx1Z2luIHZpYSBodHRwOi8vZG9jcy5yYWN0aXZlanMub3JnL2xhdGVzdC9wbHVnaW5zI2RlY29yYXRvcnMnO1xuXHRcdFx0XHRpZiAoIHJhY3RpdmUuZGVidWcgKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCBlcnJvck1lc3NhZ2UgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR3YXJuKCBlcnJvck1lc3NhZ2UgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdFx0RGVjb3JhdG9yLnByb3RvdHlwZSA9IHtcblx0XHRcdGluaXQ6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgcmVzdWx0LCBhcmdzO1xuXHRcdFx0XHRpZiAoIHRoaXMucGFyYW1zICkge1xuXHRcdFx0XHRcdGFyZ3MgPSBbIHRoaXMubm9kZSBdLmNvbmNhdCggdGhpcy5wYXJhbXMgKTtcblx0XHRcdFx0XHRyZXN1bHQgPSB0aGlzLmZuLmFwcGx5KCB0aGlzLnJvb3QsIGFyZ3MgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXN1bHQgPSB0aGlzLmZuLmNhbGwoIHRoaXMucm9vdCwgdGhpcy5ub2RlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCAhcmVzdWx0IHx8ICFyZXN1bHQudGVhcmRvd24gKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnRGVjb3JhdG9yIGRlZmluaXRpb24gbXVzdCByZXR1cm4gYW4gb2JqZWN0IHdpdGggYSB0ZWFyZG93biBtZXRob2QnICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5hY3R1YWwgPSByZXN1bHQ7XG5cdFx0XHRcdHRoaXMucmVhZHkgPSB0cnVlO1xuXHRcdFx0fSxcblx0XHRcdHVwZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmICggdGhpcy5hY3R1YWwudXBkYXRlICkge1xuXHRcdFx0XHRcdHRoaXMuYWN0dWFsLnVwZGF0ZS5hcHBseSggdGhpcy5yb290LCB0aGlzLnBhcmFtcyApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuYWN0dWFsLnRlYXJkb3duKCB0cnVlICk7XG5cdFx0XHRcdFx0dGhpcy5pbml0KCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oIHVwZGF0aW5nICkge1xuXHRcdFx0XHR0aGlzLmFjdHVhbC50ZWFyZG93bigpO1xuXHRcdFx0XHRpZiAoICF1cGRhdGluZyApIHtcblx0XHRcdFx0XHR0aGlzLmZyYWdtZW50LnRlYXJkb3duKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBEZWNvcmF0b3I7XG5cdH0oIHV0aWxzX3dhcm4sIHJlbmRlcl9TdHJpbmdGcmFnbWVudF9fU3RyaW5nRnJhZ21lbnQgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfaW5pdGlhbGlzZV9kZWNvcmF0ZV9fZGVjb3JhdGUgPSBmdW5jdGlvbiggcnVubG9vcCwgRGVjb3JhdG9yICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBkZXNjcmlwdG9yLCByb290LCBvd25lciApIHtcblx0XHRcdHZhciBkZWNvcmF0b3IgPSBuZXcgRGVjb3JhdG9yKCBkZXNjcmlwdG9yLCByb290LCBvd25lciApO1xuXHRcdFx0aWYgKCBkZWNvcmF0b3IuZm4gKSB7XG5cdFx0XHRcdG93bmVyLmRlY29yYXRvciA9IGRlY29yYXRvcjtcblx0XHRcdFx0cnVubG9vcC5hZGREZWNvcmF0b3IoIG93bmVyLmRlY29yYXRvciApO1xuXHRcdFx0fVxuXHRcdH07XG5cdH0oIGdsb2JhbF9ydW5sb29wLCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9pbml0aWFsaXNlX2RlY29yYXRlX0RlY29yYXRvciApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9pbml0aWFsaXNlX2FkZEV2ZW50UHJveGllc19hZGRFdmVudFByb3h5ID0gZnVuY3Rpb24oIHdhcm4sIFN0cmluZ0ZyYWdtZW50ICkge1xuXG5cdFx0dmFyIGFkZEV2ZW50UHJveHksIE1hc3RlckV2ZW50SGFuZGxlciwgUHJveHlFdmVudCwgZmlyZVBsYWluRXZlbnQsIGZpcmVFdmVudFdpdGhBcmdzLCBmaXJlRXZlbnRXaXRoRHluYW1pY0FyZ3MsIGN1c3RvbUhhbmRsZXJzLCBnZW5lcmljSGFuZGxlciwgZ2V0Q3VzdG9tSGFuZGxlcjtcblx0XHRhZGRFdmVudFByb3h5ID0gZnVuY3Rpb24oIGVsZW1lbnQsIHRyaWdnZXJFdmVudE5hbWUsIHByb3h5RGVzY3JpcHRvciwgaW5kZXhSZWZzICkge1xuXHRcdFx0dmFyIGV2ZW50cywgbWFzdGVyO1xuXHRcdFx0ZXZlbnRzID0gZWxlbWVudC5ub2RlLl9yYWN0aXZlLmV2ZW50cztcblx0XHRcdG1hc3RlciA9IGV2ZW50c1sgdHJpZ2dlckV2ZW50TmFtZSBdIHx8ICggZXZlbnRzWyB0cmlnZ2VyRXZlbnROYW1lIF0gPSBuZXcgTWFzdGVyRXZlbnRIYW5kbGVyKCBlbGVtZW50LCB0cmlnZ2VyRXZlbnROYW1lLCBpbmRleFJlZnMgKSApO1xuXHRcdFx0bWFzdGVyLmFkZCggcHJveHlEZXNjcmlwdG9yICk7XG5cdFx0fTtcblx0XHRNYXN0ZXJFdmVudEhhbmRsZXIgPSBmdW5jdGlvbiggZWxlbWVudCwgZXZlbnROYW1lICkge1xuXHRcdFx0dmFyIGRlZmluaXRpb247XG5cdFx0XHR0aGlzLmVsZW1lbnQgPSBlbGVtZW50O1xuXHRcdFx0dGhpcy5yb290ID0gZWxlbWVudC5yb290O1xuXHRcdFx0dGhpcy5ub2RlID0gZWxlbWVudC5ub2RlO1xuXHRcdFx0dGhpcy5uYW1lID0gZXZlbnROYW1lO1xuXHRcdFx0dGhpcy5wcm94aWVzID0gW107XG5cdFx0XHRpZiAoIGRlZmluaXRpb24gPSB0aGlzLnJvb3QuZXZlbnRzWyBldmVudE5hbWUgXSApIHtcblx0XHRcdFx0dGhpcy5jdXN0b20gPSBkZWZpbml0aW9uKCB0aGlzLm5vZGUsIGdldEN1c3RvbUhhbmRsZXIoIGV2ZW50TmFtZSApICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAoICEoICdvbicgKyBldmVudE5hbWUgaW4gdGhpcy5ub2RlICkgKSB7XG5cdFx0XHRcdFx0d2FybiggJ01pc3NpbmcgXCInICsgdGhpcy5uYW1lICsgJ1wiIGV2ZW50LiBZb3UgbWF5IG5lZWQgdG8gZG93bmxvYWQgYSBwbHVnaW4gdmlhIGh0dHA6Ly9kb2NzLnJhY3RpdmVqcy5vcmcvbGF0ZXN0L3BsdWdpbnMjZXZlbnRzJyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMubm9kZS5hZGRFdmVudExpc3RlbmVyKCBldmVudE5hbWUsIGdlbmVyaWNIYW5kbGVyLCBmYWxzZSApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0TWFzdGVyRXZlbnRIYW5kbGVyLnByb3RvdHlwZSA9IHtcblx0XHRcdGFkZDogZnVuY3Rpb24oIHByb3h5ICkge1xuXHRcdFx0XHR0aGlzLnByb3hpZXMucHVzaCggbmV3IFByb3h5RXZlbnQoIHRoaXMuZWxlbWVudCwgdGhpcy5yb290LCBwcm94eSApICk7XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgaTtcblx0XHRcdFx0aWYgKCB0aGlzLmN1c3RvbSApIHtcblx0XHRcdFx0XHR0aGlzLmN1c3RvbS50ZWFyZG93bigpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMubm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKCB0aGlzLm5hbWUsIGdlbmVyaWNIYW5kbGVyLCBmYWxzZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGkgPSB0aGlzLnByb3hpZXMubGVuZ3RoO1xuXHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHR0aGlzLnByb3hpZXNbIGkgXS50ZWFyZG93bigpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0ZmlyZTogZnVuY3Rpb24oIGV2ZW50ICkge1xuXHRcdFx0XHR2YXIgaSA9IHRoaXMucHJveGllcy5sZW5ndGg7XG5cdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdHRoaXMucHJveGllc1sgaSBdLmZpcmUoIGV2ZW50ICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHRcdFByb3h5RXZlbnQgPSBmdW5jdGlvbiggZWxlbWVudCwgcmFjdGl2ZSwgZGVzY3JpcHRvciApIHtcblx0XHRcdHZhciBuYW1lO1xuXHRcdFx0dGhpcy5yb290ID0gcmFjdGl2ZTtcblx0XHRcdG5hbWUgPSBkZXNjcmlwdG9yLm4gfHwgZGVzY3JpcHRvcjtcblx0XHRcdGlmICggdHlwZW9mIG5hbWUgPT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHR0aGlzLm4gPSBuYW1lO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5uID0gbmV3IFN0cmluZ0ZyYWdtZW50KCB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRvcjogZGVzY3JpcHRvci5uLFxuXHRcdFx0XHRcdHJvb3Q6IHRoaXMucm9vdCxcblx0XHRcdFx0XHRvd25lcjogZWxlbWVudFxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGRlc2NyaXB0b3IuYSApIHtcblx0XHRcdFx0dGhpcy5hID0gZGVzY3JpcHRvci5hO1xuXHRcdFx0XHR0aGlzLmZpcmUgPSBmaXJlRXZlbnRXaXRoQXJncztcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBkZXNjcmlwdG9yLmQgKSB7XG5cdFx0XHRcdHRoaXMuZCA9IG5ldyBTdHJpbmdGcmFnbWVudCgge1xuXHRcdFx0XHRcdGRlc2NyaXB0b3I6IGRlc2NyaXB0b3IuZCxcblx0XHRcdFx0XHRyb290OiB0aGlzLnJvb3QsXG5cdFx0XHRcdFx0b3duZXI6IGVsZW1lbnRcblx0XHRcdFx0fSApO1xuXHRcdFx0XHR0aGlzLmZpcmUgPSBmaXJlRXZlbnRXaXRoRHluYW1pY0FyZ3M7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMuZmlyZSA9IGZpcmVQbGFpbkV2ZW50O1xuXHRcdH07XG5cdFx0UHJveHlFdmVudC5wcm90b3R5cGUgPSB7XG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmICggdGhpcy5uLnRlYXJkb3duICkge1xuXHRcdFx0XHRcdHRoaXMubi50ZWFyZG93bigpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggdGhpcy5kICkge1xuXHRcdFx0XHRcdHRoaXMuZC50ZWFyZG93bigpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0YnViYmxlOiBmdW5jdGlvbigpIHt9XG5cdFx0fTtcblx0XHRmaXJlUGxhaW5FdmVudCA9IGZ1bmN0aW9uKCBldmVudCApIHtcblx0XHRcdHRoaXMucm9vdC5maXJlKCB0aGlzLm4udG9TdHJpbmcoKSwgZXZlbnQgKTtcblx0XHR9O1xuXHRcdGZpcmVFdmVudFdpdGhBcmdzID0gZnVuY3Rpb24oIGV2ZW50ICkge1xuXHRcdFx0dGhpcy5yb290LmZpcmUuYXBwbHkoIHRoaXMucm9vdCwgW1xuXHRcdFx0XHR0aGlzLm4udG9TdHJpbmcoKSxcblx0XHRcdFx0ZXZlbnRcblx0XHRcdF0uY29uY2F0KCB0aGlzLmEgKSApO1xuXHRcdH07XG5cdFx0ZmlyZUV2ZW50V2l0aER5bmFtaWNBcmdzID0gZnVuY3Rpb24oIGV2ZW50ICkge1xuXHRcdFx0dmFyIGFyZ3MgPSB0aGlzLmQudG9BcmdzTGlzdCgpO1xuXHRcdFx0aWYgKCB0eXBlb2YgYXJncyA9PT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdGFyZ3MgPSBhcmdzLnN1YnN0ciggMSwgYXJncy5sZW5ndGggLSAyICk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnJvb3QuZmlyZS5hcHBseSggdGhpcy5yb290LCBbXG5cdFx0XHRcdHRoaXMubi50b1N0cmluZygpLFxuXHRcdFx0XHRldmVudFxuXHRcdFx0XS5jb25jYXQoIGFyZ3MgKSApO1xuXHRcdH07XG5cdFx0Z2VuZXJpY0hhbmRsZXIgPSBmdW5jdGlvbiggZXZlbnQgKSB7XG5cdFx0XHR2YXIgc3RvcmFnZSA9IHRoaXMuX3JhY3RpdmU7XG5cdFx0XHRzdG9yYWdlLmV2ZW50c1sgZXZlbnQudHlwZSBdLmZpcmUoIHtcblx0XHRcdFx0bm9kZTogdGhpcyxcblx0XHRcdFx0b3JpZ2luYWw6IGV2ZW50LFxuXHRcdFx0XHRpbmRleDogc3RvcmFnZS5pbmRleCxcblx0XHRcdFx0a2V5cGF0aDogc3RvcmFnZS5rZXlwYXRoLFxuXHRcdFx0XHRjb250ZXh0OiBzdG9yYWdlLnJvb3QuZ2V0KCBzdG9yYWdlLmtleXBhdGggKVxuXHRcdFx0fSApO1xuXHRcdH07XG5cdFx0Y3VzdG9tSGFuZGxlcnMgPSB7fTtcblx0XHRnZXRDdXN0b21IYW5kbGVyID0gZnVuY3Rpb24oIGV2ZW50TmFtZSApIHtcblx0XHRcdGlmICggY3VzdG9tSGFuZGxlcnNbIGV2ZW50TmFtZSBdICkge1xuXHRcdFx0XHRyZXR1cm4gY3VzdG9tSGFuZGxlcnNbIGV2ZW50TmFtZSBdO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGN1c3RvbUhhbmRsZXJzWyBldmVudE5hbWUgXSA9IGZ1bmN0aW9uKCBldmVudCApIHtcblx0XHRcdFx0dmFyIHN0b3JhZ2UgPSBldmVudC5ub2RlLl9yYWN0aXZlO1xuXHRcdFx0XHRldmVudC5pbmRleCA9IHN0b3JhZ2UuaW5kZXg7XG5cdFx0XHRcdGV2ZW50LmtleXBhdGggPSBzdG9yYWdlLmtleXBhdGg7XG5cdFx0XHRcdGV2ZW50LmNvbnRleHQgPSBzdG9yYWdlLnJvb3QuZ2V0KCBzdG9yYWdlLmtleXBhdGggKTtcblx0XHRcdFx0c3RvcmFnZS5ldmVudHNbIGV2ZW50TmFtZSBdLmZpcmUoIGV2ZW50ICk7XG5cdFx0XHR9O1xuXHRcdH07XG5cdFx0cmV0dXJuIGFkZEV2ZW50UHJveHk7XG5cdH0oIHV0aWxzX3dhcm4sIHJlbmRlcl9TdHJpbmdGcmFnbWVudF9fU3RyaW5nRnJhZ21lbnQgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfaW5pdGlhbGlzZV9hZGRFdmVudFByb3hpZXNfX2FkZEV2ZW50UHJveGllcyA9IGZ1bmN0aW9uKCBhZGRFdmVudFByb3h5ICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBlbGVtZW50LCBwcm94aWVzICkge1xuXHRcdFx0dmFyIGksIGV2ZW50TmFtZSwgZXZlbnROYW1lcztcblx0XHRcdGZvciAoIGV2ZW50TmFtZSBpbiBwcm94aWVzICkge1xuXHRcdFx0XHRpZiAoIHByb3hpZXMuaGFzT3duUHJvcGVydHkoIGV2ZW50TmFtZSApICkge1xuXHRcdFx0XHRcdGV2ZW50TmFtZXMgPSBldmVudE5hbWUuc3BsaXQoICctJyApO1xuXHRcdFx0XHRcdGkgPSBldmVudE5hbWVzLmxlbmd0aDtcblx0XHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRcdGFkZEV2ZW50UHJveHkoIGVsZW1lbnQsIGV2ZW50TmFtZXNbIGkgXSwgcHJveGllc1sgZXZlbnROYW1lIF0gKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHR9KCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9pbml0aWFsaXNlX2FkZEV2ZW50UHJveGllc19hZGRFdmVudFByb3h5ICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X2luaXRpYWxpc2VfdXBkYXRlTGl2ZVF1ZXJpZXMgPSBmdW5jdGlvbiggZWxlbWVudCApIHtcblx0XHR2YXIgaW5zdGFuY2UsIGxpdmVRdWVyaWVzLCBpLCBzZWxlY3RvciwgcXVlcnk7XG5cdFx0aW5zdGFuY2UgPSBlbGVtZW50LnJvb3Q7XG5cdFx0ZG8ge1xuXHRcdFx0bGl2ZVF1ZXJpZXMgPSBpbnN0YW5jZS5fbGl2ZVF1ZXJpZXM7XG5cdFx0XHRpID0gbGl2ZVF1ZXJpZXMubGVuZ3RoO1xuXHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdHNlbGVjdG9yID0gbGl2ZVF1ZXJpZXNbIGkgXTtcblx0XHRcdFx0cXVlcnkgPSBsaXZlUXVlcmllc1sgc2VsZWN0b3IgXTtcblx0XHRcdFx0aWYgKCBxdWVyeS5fdGVzdCggZWxlbWVudCApICkge1xuXHRcdFx0XHRcdCggZWxlbWVudC5saXZlUXVlcmllcyB8fCAoIGVsZW1lbnQubGl2ZVF1ZXJpZXMgPSBbXSApICkucHVzaCggcXVlcnkgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gd2hpbGUgKCBpbnN0YW5jZSA9IGluc3RhbmNlLl9wYXJlbnQgKTtcblx0fTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2V4ZWN1dGVUcmFuc2l0aW9uX1RyYW5zaXRpb25fcHJvdG90eXBlX2luaXQgPSBmdW5jdGlvbigpIHtcblx0XHRpZiAoIHRoaXMuX2luaXRlZCApIHtcblx0XHRcdHRocm93IG5ldyBFcnJvciggJ0Nhbm5vdCBpbml0aWFsaXplIGEgdHJhbnNpdGlvbiBtb3JlIHRoYW4gb25jZScgKTtcblx0XHR9XG5cdFx0dGhpcy5faW5pdGVkID0gdHJ1ZTtcblx0XHR0aGlzLl9mbi5hcHBseSggdGhpcy5yb290LCBbIHRoaXMgXS5jb25jYXQoIHRoaXMucGFyYW1zICkgKTtcblx0fTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2V4ZWN1dGVUcmFuc2l0aW9uX1RyYW5zaXRpb25faGVscGVyc19wcmVmaXggPSBmdW5jdGlvbiggaXNDbGllbnQsIHZlbmRvcnMsIGNyZWF0ZUVsZW1lbnQgKSB7XG5cblx0XHR2YXIgcHJlZml4Q2FjaGUsIHRlc3RTdHlsZTtcblx0XHRpZiAoICFpc0NsaWVudCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0cHJlZml4Q2FjaGUgPSB7fTtcblx0XHR0ZXN0U3R5bGUgPSBjcmVhdGVFbGVtZW50KCAnZGl2JyApLnN0eWxlO1xuXHRcdHJldHVybiBmdW5jdGlvbiggcHJvcCApIHtcblx0XHRcdHZhciBpLCB2ZW5kb3IsIGNhcHBlZDtcblx0XHRcdGlmICggIXByZWZpeENhY2hlWyBwcm9wIF0gKSB7XG5cdFx0XHRcdGlmICggdGVzdFN0eWxlWyBwcm9wIF0gIT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0XHRwcmVmaXhDYWNoZVsgcHJvcCBdID0gcHJvcDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjYXBwZWQgPSBwcm9wLmNoYXJBdCggMCApLnRvVXBwZXJDYXNlKCkgKyBwcm9wLnN1YnN0cmluZyggMSApO1xuXHRcdFx0XHRcdGkgPSB2ZW5kb3JzLmxlbmd0aDtcblx0XHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRcdHZlbmRvciA9IHZlbmRvcnNbIGkgXTtcblx0XHRcdFx0XHRcdGlmICggdGVzdFN0eWxlWyB2ZW5kb3IgKyBjYXBwZWQgXSAhPT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRcdFx0XHRwcmVmaXhDYWNoZVsgcHJvcCBdID0gdmVuZG9yICsgY2FwcGVkO1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBwcmVmaXhDYWNoZVsgcHJvcCBdO1xuXHRcdH07XG5cdH0oIGNvbmZpZ19pc0NsaWVudCwgY29uZmlnX3ZlbmRvcnMsIHV0aWxzX2NyZWF0ZUVsZW1lbnQgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2V4ZWN1dGVUcmFuc2l0aW9uX1RyYW5zaXRpb25fcHJvdG90eXBlX2dldFN0eWxlID0gZnVuY3Rpb24oIGxlZ2FjeSwgaXNDbGllbnQsIGlzQXJyYXksIHByZWZpeCApIHtcblxuXHRcdHZhciBnZXRDb21wdXRlZFN0eWxlO1xuXHRcdGlmICggIWlzQ2xpZW50ICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRnZXRDb21wdXRlZFN0eWxlID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUgfHwgbGVnYWN5LmdldENvbXB1dGVkU3R5bGU7XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBwcm9wcyApIHtcblx0XHRcdHZhciBjb21wdXRlZFN0eWxlLCBzdHlsZXMsIGksIHByb3AsIHZhbHVlO1xuXHRcdFx0Y29tcHV0ZWRTdHlsZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKCB0aGlzLm5vZGUgKTtcblx0XHRcdGlmICggdHlwZW9mIHByb3BzID09PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0dmFsdWUgPSBjb21wdXRlZFN0eWxlWyBwcmVmaXgoIHByb3BzICkgXTtcblx0XHRcdFx0aWYgKCB2YWx1ZSA9PT0gJzBweCcgKSB7XG5cdFx0XHRcdFx0dmFsdWUgPSAwO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHRcdH1cblx0XHRcdGlmICggIWlzQXJyYXkoIHByb3BzICkgKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ1RyYW5zaXRpb24jZ2V0U3R5bGUgbXVzdCBiZSBwYXNzZWQgYSBzdHJpbmcsIG9yIGFuIGFycmF5IG9mIHN0cmluZ3MgcmVwcmVzZW50aW5nIENTUyBwcm9wZXJ0aWVzJyApO1xuXHRcdFx0fVxuXHRcdFx0c3R5bGVzID0ge307XG5cdFx0XHRpID0gcHJvcHMubGVuZ3RoO1xuXHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdHByb3AgPSBwcm9wc1sgaSBdO1xuXHRcdFx0XHR2YWx1ZSA9IGNvbXB1dGVkU3R5bGVbIHByZWZpeCggcHJvcCApIF07XG5cdFx0XHRcdGlmICggdmFsdWUgPT09ICcwcHgnICkge1xuXHRcdFx0XHRcdHZhbHVlID0gMDtcblx0XHRcdFx0fVxuXHRcdFx0XHRzdHlsZXNbIHByb3AgXSA9IHZhbHVlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHN0eWxlcztcblx0XHR9O1xuXHR9KCBsZWdhY3ksIGNvbmZpZ19pc0NsaWVudCwgdXRpbHNfaXNBcnJheSwgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2V4ZWN1dGVUcmFuc2l0aW9uX1RyYW5zaXRpb25faGVscGVyc19wcmVmaXggKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2V4ZWN1dGVUcmFuc2l0aW9uX1RyYW5zaXRpb25fcHJvdG90eXBlX3NldFN0eWxlID0gZnVuY3Rpb24oIHByZWZpeCApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggc3R5bGUsIHZhbHVlICkge1xuXHRcdFx0dmFyIHByb3A7XG5cdFx0XHRpZiAoIHR5cGVvZiBzdHlsZSA9PT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdHRoaXMubm9kZS5zdHlsZVsgcHJlZml4KCBzdHlsZSApIF0gPSB2YWx1ZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGZvciAoIHByb3AgaW4gc3R5bGUgKSB7XG5cdFx0XHRcdFx0aWYgKCBzdHlsZS5oYXNPd25Qcm9wZXJ0eSggcHJvcCApICkge1xuXHRcdFx0XHRcdFx0dGhpcy5ub2RlLnN0eWxlWyBwcmVmaXgoIHByb3AgKSBdID0gc3R5bGVbIHByb3AgXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH07XG5cdH0oIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9leGVjdXRlVHJhbnNpdGlvbl9UcmFuc2l0aW9uX2hlbHBlcnNfcHJlZml4ICk7XG5cblx0dmFyIHV0aWxzX2NhbWVsQ2FzZSA9IGZ1bmN0aW9uKCBoeXBoZW5hdGVkU3RyICkge1xuXHRcdHJldHVybiBoeXBoZW5hdGVkU3RyLnJlcGxhY2UoIC8tKFthLXpBLVpdKS9nLCBmdW5jdGlvbiggbWF0Y2gsICQxICkge1xuXHRcdFx0cmV0dXJuICQxLnRvVXBwZXJDYXNlKCk7XG5cdFx0fSApO1xuXHR9O1xuXG5cdHZhciBzaGFyZWRfVGlja2VyID0gZnVuY3Rpb24oIHdhcm4sIGdldFRpbWUsIGFuaW1hdGlvbnMgKSB7XG5cblx0XHR2YXIgVGlja2VyID0gZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHR2YXIgZWFzaW5nO1xuXHRcdFx0dGhpcy5kdXJhdGlvbiA9IG9wdGlvbnMuZHVyYXRpb247XG5cdFx0XHR0aGlzLnN0ZXAgPSBvcHRpb25zLnN0ZXA7XG5cdFx0XHR0aGlzLmNvbXBsZXRlID0gb3B0aW9ucy5jb21wbGV0ZTtcblx0XHRcdGlmICggdHlwZW9mIG9wdGlvbnMuZWFzaW5nID09PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0ZWFzaW5nID0gb3B0aW9ucy5yb290LmVhc2luZ1sgb3B0aW9ucy5lYXNpbmcgXTtcblx0XHRcdFx0aWYgKCAhZWFzaW5nICkge1xuXHRcdFx0XHRcdHdhcm4oICdNaXNzaW5nIGVhc2luZyBmdW5jdGlvbiAoXCInICsgb3B0aW9ucy5lYXNpbmcgKyAnXCIpLiBZb3UgbWF5IG5lZWQgdG8gZG93bmxvYWQgYSBwbHVnaW4gZnJvbSBbVE9ET10nICk7XG5cdFx0XHRcdFx0ZWFzaW5nID0gbGluZWFyO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKCB0eXBlb2Ygb3B0aW9ucy5lYXNpbmcgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRcdGVhc2luZyA9IG9wdGlvbnMuZWFzaW5nO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZWFzaW5nID0gbGluZWFyO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5lYXNpbmcgPSBlYXNpbmc7XG5cdFx0XHR0aGlzLnN0YXJ0ID0gZ2V0VGltZSgpO1xuXHRcdFx0dGhpcy5lbmQgPSB0aGlzLnN0YXJ0ICsgdGhpcy5kdXJhdGlvbjtcblx0XHRcdHRoaXMucnVubmluZyA9IHRydWU7XG5cdFx0XHRhbmltYXRpb25zLmFkZCggdGhpcyApO1xuXHRcdH07XG5cdFx0VGlja2VyLnByb3RvdHlwZSA9IHtcblx0XHRcdHRpY2s6IGZ1bmN0aW9uKCBub3cgKSB7XG5cdFx0XHRcdHZhciBlbGFwc2VkLCBlYXNlZDtcblx0XHRcdFx0aWYgKCAhdGhpcy5ydW5uaW5nICkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIG5vdyA+IHRoaXMuZW5kICkge1xuXHRcdFx0XHRcdGlmICggdGhpcy5zdGVwICkge1xuXHRcdFx0XHRcdFx0dGhpcy5zdGVwKCAxICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICggdGhpcy5jb21wbGV0ZSApIHtcblx0XHRcdFx0XHRcdHRoaXMuY29tcGxldGUoIDEgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVsYXBzZWQgPSBub3cgLSB0aGlzLnN0YXJ0O1xuXHRcdFx0XHRlYXNlZCA9IHRoaXMuZWFzaW5nKCBlbGFwc2VkIC8gdGhpcy5kdXJhdGlvbiApO1xuXHRcdFx0XHRpZiAoIHRoaXMuc3RlcCApIHtcblx0XHRcdFx0XHR0aGlzLnN0ZXAoIGVhc2VkICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9LFxuXHRcdFx0c3RvcDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmICggdGhpcy5hYm9ydCApIHtcblx0XHRcdFx0XHR0aGlzLmFib3J0KCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5ydW5uaW5nID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gVGlja2VyO1xuXG5cdFx0ZnVuY3Rpb24gbGluZWFyKCB0ICkge1xuXHRcdFx0cmV0dXJuIHQ7XG5cdFx0fVxuXHR9KCB1dGlsc193YXJuLCB1dGlsc19nZXRUaW1lLCBzaGFyZWRfYW5pbWF0aW9ucyApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZXhlY3V0ZVRyYW5zaXRpb25fVHJhbnNpdGlvbl9oZWxwZXJzX3VucHJlZml4ID0gZnVuY3Rpb24oIHZlbmRvcnMgKSB7XG5cblx0XHR2YXIgdW5wcmVmaXhQYXR0ZXJuID0gbmV3IFJlZ0V4cCggJ14tKD86JyArIHZlbmRvcnMuam9pbiggJ3wnICkgKyAnKS0nICk7XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBwcm9wICkge1xuXHRcdFx0cmV0dXJuIHByb3AucmVwbGFjZSggdW5wcmVmaXhQYXR0ZXJuLCAnJyApO1xuXHRcdH07XG5cdH0oIGNvbmZpZ192ZW5kb3JzICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9leGVjdXRlVHJhbnNpdGlvbl9UcmFuc2l0aW9uX2hlbHBlcnNfaHlwaGVuYXRlID0gZnVuY3Rpb24oIHZlbmRvcnMgKSB7XG5cblx0XHR2YXIgdmVuZG9yUGF0dGVybiA9IG5ldyBSZWdFeHAoICdeKD86JyArIHZlbmRvcnMuam9pbiggJ3wnICkgKyAnKShbQS1aXSknICk7XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBzdHIgKSB7XG5cdFx0XHR2YXIgaHlwaGVuYXRlZDtcblx0XHRcdGlmICggIXN0ciApIHtcblx0XHRcdFx0cmV0dXJuICcnO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB2ZW5kb3JQYXR0ZXJuLnRlc3QoIHN0ciApICkge1xuXHRcdFx0XHRzdHIgPSAnLScgKyBzdHI7XG5cdFx0XHR9XG5cdFx0XHRoeXBoZW5hdGVkID0gc3RyLnJlcGxhY2UoIC9bQS1aXS9nLCBmdW5jdGlvbiggbWF0Y2ggKSB7XG5cdFx0XHRcdHJldHVybiAnLScgKyBtYXRjaC50b0xvd2VyQ2FzZSgpO1xuXHRcdFx0fSApO1xuXHRcdFx0cmV0dXJuIGh5cGhlbmF0ZWQ7XG5cdFx0fTtcblx0fSggY29uZmlnX3ZlbmRvcnMgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2V4ZWN1dGVUcmFuc2l0aW9uX1RyYW5zaXRpb25fcHJvdG90eXBlX2FuaW1hdGVTdHlsZV9jcmVhdGVUcmFuc2l0aW9ucyA9IGZ1bmN0aW9uKCBpc0NsaWVudCwgd2FybiwgY3JlYXRlRWxlbWVudCwgY2FtZWxDYXNlLCBpbnRlcnBvbGF0ZSwgVGlja2VyLCBwcmVmaXgsIHVucHJlZml4LCBoeXBoZW5hdGUgKSB7XG5cblx0XHR2YXIgdGVzdFN0eWxlLCBUUkFOU0lUSU9OLCBUUkFOU0lUSU9ORU5ELCBDU1NfVFJBTlNJVElPTlNfRU5BQkxFRCwgVFJBTlNJVElPTl9EVVJBVElPTiwgVFJBTlNJVElPTl9QUk9QRVJUWSwgVFJBTlNJVElPTl9USU1JTkdfRlVOQ1RJT04sIGNhblVzZUNzc1RyYW5zaXRpb25zID0ge30sIGNhbm5vdFVzZUNzc1RyYW5zaXRpb25zID0ge307XG5cdFx0aWYgKCAhaXNDbGllbnQgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRlc3RTdHlsZSA9IGNyZWF0ZUVsZW1lbnQoICdkaXYnICkuc3R5bGU7XG5cdFx0KCBmdW5jdGlvbigpIHtcblx0XHRcdGlmICggdGVzdFN0eWxlLnRyYW5zaXRpb24gIT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0VFJBTlNJVElPTiA9ICd0cmFuc2l0aW9uJztcblx0XHRcdFx0VFJBTlNJVElPTkVORCA9ICd0cmFuc2l0aW9uZW5kJztcblx0XHRcdFx0Q1NTX1RSQU5TSVRJT05TX0VOQUJMRUQgPSB0cnVlO1xuXHRcdFx0fSBlbHNlIGlmICggdGVzdFN0eWxlLndlYmtpdFRyYW5zaXRpb24gIT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0VFJBTlNJVElPTiA9ICd3ZWJraXRUcmFuc2l0aW9uJztcblx0XHRcdFx0VFJBTlNJVElPTkVORCA9ICd3ZWJraXRUcmFuc2l0aW9uRW5kJztcblx0XHRcdFx0Q1NTX1RSQU5TSVRJT05TX0VOQUJMRUQgPSB0cnVlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Q1NTX1RSQU5TSVRJT05TX0VOQUJMRUQgPSBmYWxzZTtcblx0XHRcdH1cblx0XHR9KCkgKTtcblx0XHRpZiAoIFRSQU5TSVRJT04gKSB7XG5cdFx0XHRUUkFOU0lUSU9OX0RVUkFUSU9OID0gVFJBTlNJVElPTiArICdEdXJhdGlvbic7XG5cdFx0XHRUUkFOU0lUSU9OX1BST1BFUlRZID0gVFJBTlNJVElPTiArICdQcm9wZXJ0eSc7XG5cdFx0XHRUUkFOU0lUSU9OX1RJTUlOR19GVU5DVElPTiA9IFRSQU5TSVRJT04gKyAnVGltaW5nRnVuY3Rpb24nO1xuXHRcdH1cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHQsIHRvLCBvcHRpb25zLCBjaGFuZ2VkUHJvcGVydGllcywgdHJhbnNpdGlvbkVuZEhhbmRsZXIsIHJlc29sdmUgKSB7XG5cdFx0XHRzZXRUaW1lb3V0KCBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIGhhc2hQcmVmaXgsIGpzVHJhbnNpdGlvbnNDb21wbGV0ZSwgY3NzVHJhbnNpdGlvbnNDb21wbGV0ZSwgY2hlY2tDb21wbGV0ZTtcblx0XHRcdFx0Y2hlY2tDb21wbGV0ZSA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdGlmICgganNUcmFuc2l0aW9uc0NvbXBsZXRlICYmIGNzc1RyYW5zaXRpb25zQ29tcGxldGUgKSB7XG5cdFx0XHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9O1xuXHRcdFx0XHRoYXNoUHJlZml4ID0gdC5ub2RlLm5hbWVzcGFjZVVSSSArIHQubm9kZS50YWdOYW1lO1xuXHRcdFx0XHR0Lm5vZGUuc3R5bGVbIFRSQU5TSVRJT05fUFJPUEVSVFkgXSA9IGNoYW5nZWRQcm9wZXJ0aWVzLm1hcCggcHJlZml4ICkubWFwKCBoeXBoZW5hdGUgKS5qb2luKCAnLCcgKTtcblx0XHRcdFx0dC5ub2RlLnN0eWxlWyBUUkFOU0lUSU9OX1RJTUlOR19GVU5DVElPTiBdID0gaHlwaGVuYXRlKCBvcHRpb25zLmVhc2luZyB8fCAnbGluZWFyJyApO1xuXHRcdFx0XHR0Lm5vZGUuc3R5bGVbIFRSQU5TSVRJT05fRFVSQVRJT04gXSA9IG9wdGlvbnMuZHVyYXRpb24gLyAxMDAwICsgJ3MnO1xuXHRcdFx0XHR0cmFuc2l0aW9uRW5kSGFuZGxlciA9IGZ1bmN0aW9uKCBldmVudCApIHtcblx0XHRcdFx0XHR2YXIgaW5kZXg7XG5cdFx0XHRcdFx0aW5kZXggPSBjaGFuZ2VkUHJvcGVydGllcy5pbmRleE9mKCBjYW1lbENhc2UoIHVucHJlZml4KCBldmVudC5wcm9wZXJ0eU5hbWUgKSApICk7XG5cdFx0XHRcdFx0aWYgKCBpbmRleCAhPT0gLTEgKSB7XG5cdFx0XHRcdFx0XHRjaGFuZ2VkUHJvcGVydGllcy5zcGxpY2UoIGluZGV4LCAxICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICggY2hhbmdlZFByb3BlcnRpZXMubGVuZ3RoICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0LnJvb3QuZmlyZSggdC5uYW1lICsgJzplbmQnICk7XG5cdFx0XHRcdFx0dC5ub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoIFRSQU5TSVRJT05FTkQsIHRyYW5zaXRpb25FbmRIYW5kbGVyLCBmYWxzZSApO1xuXHRcdFx0XHRcdGNzc1RyYW5zaXRpb25zQ29tcGxldGUgPSB0cnVlO1xuXHRcdFx0XHRcdGNoZWNrQ29tcGxldGUoKTtcblx0XHRcdFx0fTtcblx0XHRcdFx0dC5ub2RlLmFkZEV2ZW50TGlzdGVuZXIoIFRSQU5TSVRJT05FTkQsIHRyYW5zaXRpb25FbmRIYW5kbGVyLCBmYWxzZSApO1xuXHRcdFx0XHRzZXRUaW1lb3V0KCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHR2YXIgaSA9IGNoYW5nZWRQcm9wZXJ0aWVzLmxlbmd0aCxcblx0XHRcdFx0XHRcdGhhc2gsIG9yaWdpbmFsVmFsdWUsIGluZGV4LCBwcm9wZXJ0aWVzVG9UcmFuc2l0aW9uSW5KcyA9IFtdLFxuXHRcdFx0XHRcdFx0cHJvcDtcblx0XHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRcdHByb3AgPSBjaGFuZ2VkUHJvcGVydGllc1sgaSBdO1xuXHRcdFx0XHRcdFx0aGFzaCA9IGhhc2hQcmVmaXggKyBwcm9wO1xuXHRcdFx0XHRcdFx0aWYgKCBjYW5Vc2VDc3NUcmFuc2l0aW9uc1sgaGFzaCBdICkge1xuXHRcdFx0XHRcdFx0XHR0Lm5vZGUuc3R5bGVbIHByZWZpeCggcHJvcCApIF0gPSB0b1sgcHJvcCBdO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0b3JpZ2luYWxWYWx1ZSA9IHQuZ2V0U3R5bGUoIHByb3AgKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmICggY2FuVXNlQ3NzVHJhbnNpdGlvbnNbIGhhc2ggXSA9PT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRcdFx0XHR0Lm5vZGUuc3R5bGVbIHByZWZpeCggcHJvcCApIF0gPSB0b1sgcHJvcCBdO1xuXHRcdFx0XHRcdFx0XHRjYW5Vc2VDc3NUcmFuc2l0aW9uc1sgaGFzaCBdID0gdC5nZXRTdHlsZSggcHJvcCApICE9IHRvWyBwcm9wIF07XG5cdFx0XHRcdFx0XHRcdGNhbm5vdFVzZUNzc1RyYW5zaXRpb25zWyBoYXNoIF0gPSAhY2FuVXNlQ3NzVHJhbnNpdGlvbnNbIGhhc2ggXTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmICggY2Fubm90VXNlQ3NzVHJhbnNpdGlvbnNbIGhhc2ggXSApIHtcblx0XHRcdFx0XHRcdFx0aW5kZXggPSBjaGFuZ2VkUHJvcGVydGllcy5pbmRleE9mKCBwcm9wICk7XG5cdFx0XHRcdFx0XHRcdGlmICggaW5kZXggPT09IC0xICkge1xuXHRcdFx0XHRcdFx0XHRcdHdhcm4oICdTb21ldGhpbmcgdmVyeSBzdHJhbmdlIGhhcHBlbmVkIHdpdGggdHJhbnNpdGlvbnMuIElmIHlvdSBzZWUgdGhpcyBtZXNzYWdlLCBwbGVhc2UgbGV0IEBSYWN0aXZlSlMga25vdy4gVGhhbmtzIScgKTtcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRjaGFuZ2VkUHJvcGVydGllcy5zcGxpY2UoIGluZGV4LCAxICk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0dC5ub2RlLnN0eWxlWyBwcmVmaXgoIHByb3AgKSBdID0gb3JpZ2luYWxWYWx1ZTtcblx0XHRcdFx0XHRcdFx0cHJvcGVydGllc1RvVHJhbnNpdGlvbkluSnMucHVzaCgge1xuXHRcdFx0XHRcdFx0XHRcdG5hbWU6IHByZWZpeCggcHJvcCApLFxuXHRcdFx0XHRcdFx0XHRcdGludGVycG9sYXRvcjogaW50ZXJwb2xhdGUoIG9yaWdpbmFsVmFsdWUsIHRvWyBwcm9wIF0gKVxuXHRcdFx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICggcHJvcGVydGllc1RvVHJhbnNpdGlvbkluSnMubGVuZ3RoICkge1xuXHRcdFx0XHRcdFx0bmV3IFRpY2tlcigge1xuXHRcdFx0XHRcdFx0XHRyb290OiB0LnJvb3QsXG5cdFx0XHRcdFx0XHRcdGR1cmF0aW9uOiBvcHRpb25zLmR1cmF0aW9uLFxuXHRcdFx0XHRcdFx0XHRlYXNpbmc6IGNhbWVsQ2FzZSggb3B0aW9ucy5lYXNpbmcgKSxcblx0XHRcdFx0XHRcdFx0c3RlcDogZnVuY3Rpb24oIHBvcyApIHtcblx0XHRcdFx0XHRcdFx0XHR2YXIgcHJvcCwgaTtcblx0XHRcdFx0XHRcdFx0XHRpID0gcHJvcGVydGllc1RvVHJhbnNpdGlvbkluSnMubGVuZ3RoO1xuXHRcdFx0XHRcdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdFx0XHRcdFx0cHJvcCA9IHByb3BlcnRpZXNUb1RyYW5zaXRpb25JbkpzWyBpIF07XG5cdFx0XHRcdFx0XHRcdFx0XHR0Lm5vZGUuc3R5bGVbIHByb3AubmFtZSBdID0gcHJvcC5pbnRlcnBvbGF0b3IoIHBvcyApO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0Y29tcGxldGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0XHRcdGpzVHJhbnNpdGlvbnNDb21wbGV0ZSA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdFx0Y2hlY2tDb21wbGV0ZSgpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGpzVHJhbnNpdGlvbnNDb21wbGV0ZSA9IHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICggIWNoYW5nZWRQcm9wZXJ0aWVzLmxlbmd0aCApIHtcblx0XHRcdFx0XHRcdHQubm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKCBUUkFOU0lUSU9ORU5ELCB0cmFuc2l0aW9uRW5kSGFuZGxlciwgZmFsc2UgKTtcblx0XHRcdFx0XHRcdGNzc1RyYW5zaXRpb25zQ29tcGxldGUgPSB0cnVlO1xuXHRcdFx0XHRcdFx0Y2hlY2tDb21wbGV0ZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSwgMCApO1xuXHRcdFx0fSwgb3B0aW9ucy5kZWxheSB8fCAwICk7XG5cdFx0fTtcblx0fSggY29uZmlnX2lzQ2xpZW50LCB1dGlsc193YXJuLCB1dGlsc19jcmVhdGVFbGVtZW50LCB1dGlsc19jYW1lbENhc2UsIHNoYXJlZF9pbnRlcnBvbGF0ZSwgc2hhcmVkX1RpY2tlciwgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2V4ZWN1dGVUcmFuc2l0aW9uX1RyYW5zaXRpb25faGVscGVyc19wcmVmaXgsIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9leGVjdXRlVHJhbnNpdGlvbl9UcmFuc2l0aW9uX2hlbHBlcnNfdW5wcmVmaXgsIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9leGVjdXRlVHJhbnNpdGlvbl9UcmFuc2l0aW9uX2hlbHBlcnNfaHlwaGVuYXRlICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9leGVjdXRlVHJhbnNpdGlvbl9UcmFuc2l0aW9uX3Byb3RvdHlwZV9hbmltYXRlU3R5bGVfX2FuaW1hdGVTdHlsZSA9IGZ1bmN0aW9uKCBsZWdhY3ksIGlzQ2xpZW50LCB3YXJuLCBQcm9taXNlLCBwcmVmaXgsIGNyZWF0ZVRyYW5zaXRpb25zICkge1xuXG5cdFx0dmFyIGdldENvbXB1dGVkU3R5bGU7XG5cdFx0aWYgKCAhaXNDbGllbnQgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGdldENvbXB1dGVkU3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSB8fCBsZWdhY3kuZ2V0Q29tcHV0ZWRTdHlsZTtcblx0XHRyZXR1cm4gZnVuY3Rpb24oIHN0eWxlLCB2YWx1ZSwgb3B0aW9ucywgY29tcGxldGUgKSB7XG5cdFx0XHR2YXIgdCA9IHRoaXMsXG5cdFx0XHRcdHRvO1xuXHRcdFx0aWYgKCB0eXBlb2Ygc3R5bGUgPT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHR0byA9IHt9O1xuXHRcdFx0XHR0b1sgc3R5bGUgXSA9IHZhbHVlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dG8gPSBzdHlsZTtcblx0XHRcdFx0Y29tcGxldGUgPSBvcHRpb25zO1xuXHRcdFx0XHRvcHRpb25zID0gdmFsdWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICFvcHRpb25zICkge1xuXHRcdFx0XHR3YXJuKCAnVGhlIFwiJyArIHQubmFtZSArICdcIiB0cmFuc2l0aW9uIGRvZXMgbm90IHN1cHBseSBhbiBvcHRpb25zIG9iamVjdCB0byBgdC5hbmltYXRlU3R5bGUoKWAuIFRoaXMgd2lsbCBicmVhayBpbiBhIGZ1dHVyZSB2ZXJzaW9uIG9mIFJhY3RpdmUuIEZvciBtb3JlIGluZm8gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9SYWN0aXZlSlMvUmFjdGl2ZS9pc3N1ZXMvMzQwJyApO1xuXHRcdFx0XHRvcHRpb25zID0gdDtcblx0XHRcdFx0Y29tcGxldGUgPSB0LmNvbXBsZXRlO1xuXHRcdFx0fVxuXHRcdFx0dmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZSggZnVuY3Rpb24oIHJlc29sdmUgKSB7XG5cdFx0XHRcdHZhciBwcm9wZXJ0eU5hbWVzLCBjaGFuZ2VkUHJvcGVydGllcywgY29tcHV0ZWRTdHlsZSwgY3VycmVudCwgZnJvbSwgdHJhbnNpdGlvbkVuZEhhbmRsZXIsIGksIHByb3A7XG5cdFx0XHRcdGlmICggIW9wdGlvbnMuZHVyYXRpb24gKSB7XG5cdFx0XHRcdFx0dC5zZXRTdHlsZSggdG8gKTtcblx0XHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHByb3BlcnR5TmFtZXMgPSBPYmplY3Qua2V5cyggdG8gKTtcblx0XHRcdFx0Y2hhbmdlZFByb3BlcnRpZXMgPSBbXTtcblx0XHRcdFx0Y29tcHV0ZWRTdHlsZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKCB0Lm5vZGUgKTtcblx0XHRcdFx0ZnJvbSA9IHt9O1xuXHRcdFx0XHRpID0gcHJvcGVydHlOYW1lcy5sZW5ndGg7XG5cdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdHByb3AgPSBwcm9wZXJ0eU5hbWVzWyBpIF07XG5cdFx0XHRcdFx0Y3VycmVudCA9IGNvbXB1dGVkU3R5bGVbIHByZWZpeCggcHJvcCApIF07XG5cdFx0XHRcdFx0aWYgKCBjdXJyZW50ID09PSAnMHB4JyApIHtcblx0XHRcdFx0XHRcdGN1cnJlbnQgPSAwO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIGN1cnJlbnQgIT0gdG9bIHByb3AgXSApIHtcblx0XHRcdFx0XHRcdGNoYW5nZWRQcm9wZXJ0aWVzLnB1c2goIHByb3AgKTtcblx0XHRcdFx0XHRcdHQubm9kZS5zdHlsZVsgcHJlZml4KCBwcm9wICkgXSA9IGN1cnJlbnQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggIWNoYW5nZWRQcm9wZXJ0aWVzLmxlbmd0aCApIHtcblx0XHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNyZWF0ZVRyYW5zaXRpb25zKCB0LCB0bywgb3B0aW9ucywgY2hhbmdlZFByb3BlcnRpZXMsIHRyYW5zaXRpb25FbmRIYW5kbGVyLCByZXNvbHZlICk7XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoIGNvbXBsZXRlICkge1xuXHRcdFx0XHR3YXJuKCAndC5hbmltYXRlU3R5bGUgcmV0dXJucyBhIFByb21pc2UgYXMgb2YgMC40LjAuIFRyYW5zaXRpb24gYXV0aG9ycyBzaG91bGQgZG8gdC5hbmltYXRlU3R5bGUoLi4uKS50aGVuKGNhbGxiYWNrKScgKTtcblx0XHRcdFx0cHJvbWlzZS50aGVuKCBjb21wbGV0ZSApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHByb21pc2U7XG5cdFx0fTtcblx0fSggbGVnYWN5LCBjb25maWdfaXNDbGllbnQsIHV0aWxzX3dhcm4sIHV0aWxzX1Byb21pc2UsIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9leGVjdXRlVHJhbnNpdGlvbl9UcmFuc2l0aW9uX2hlbHBlcnNfcHJlZml4LCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZXhlY3V0ZVRyYW5zaXRpb25fVHJhbnNpdGlvbl9wcm90b3R5cGVfYW5pbWF0ZVN0eWxlX2NyZWF0ZVRyYW5zaXRpb25zICk7XG5cblx0dmFyIHV0aWxzX2ZpbGxHYXBzID0gZnVuY3Rpb24oIHRhcmdldCwgc291cmNlICkge1xuXHRcdHZhciBrZXk7XG5cdFx0Zm9yICgga2V5IGluIHNvdXJjZSApIHtcblx0XHRcdGlmICggc291cmNlLmhhc093blByb3BlcnR5KCBrZXkgKSAmJiAhKCBrZXkgaW4gdGFyZ2V0ICkgKSB7XG5cdFx0XHRcdHRhcmdldFsga2V5IF0gPSBzb3VyY2VbIGtleSBdO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdGFyZ2V0O1xuXHR9O1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZXhlY3V0ZVRyYW5zaXRpb25fVHJhbnNpdGlvbl9wcm90b3R5cGVfcHJvY2Vzc1BhcmFtcyA9IGZ1bmN0aW9uKCBmaWxsR2FwcyApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggcGFyYW1zLCBkZWZhdWx0cyApIHtcblx0XHRcdGlmICggdHlwZW9mIHBhcmFtcyA9PT0gJ251bWJlcicgKSB7XG5cdFx0XHRcdHBhcmFtcyA9IHtcblx0XHRcdFx0XHRkdXJhdGlvbjogcGFyYW1zXG5cdFx0XHRcdH07XG5cdFx0XHR9IGVsc2UgaWYgKCB0eXBlb2YgcGFyYW1zID09PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0aWYgKCBwYXJhbXMgPT09ICdzbG93JyApIHtcblx0XHRcdFx0XHRwYXJhbXMgPSB7XG5cdFx0XHRcdFx0XHRkdXJhdGlvbjogNjAwXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fSBlbHNlIGlmICggcGFyYW1zID09PSAnZmFzdCcgKSB7XG5cdFx0XHRcdFx0cGFyYW1zID0ge1xuXHRcdFx0XHRcdFx0ZHVyYXRpb246IDIwMFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cGFyYW1zID0ge1xuXHRcdFx0XHRcdFx0ZHVyYXRpb246IDQwMFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoICFwYXJhbXMgKSB7XG5cdFx0XHRcdHBhcmFtcyA9IHt9O1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGZpbGxHYXBzKCBwYXJhbXMsIGRlZmF1bHRzICk7XG5cdFx0fTtcblx0fSggdXRpbHNfZmlsbEdhcHMgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2V4ZWN1dGVUcmFuc2l0aW9uX1RyYW5zaXRpb25fcHJvdG90eXBlX3Jlc2V0U3R5bGUgPSBmdW5jdGlvbigpIHtcblx0XHRpZiAoIHRoaXMub3JpZ2luYWxTdHlsZSApIHtcblx0XHRcdHRoaXMubm9kZS5zZXRBdHRyaWJ1dGUoICdzdHlsZScsIHRoaXMub3JpZ2luYWxTdHlsZSApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLm5vZGUuZ2V0QXR0cmlidXRlKCAnc3R5bGUnICk7XG5cdFx0XHR0aGlzLm5vZGUucmVtb3ZlQXR0cmlidXRlKCAnc3R5bGUnICk7XG5cdFx0fVxuXHR9O1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZXhlY3V0ZVRyYW5zaXRpb25fVHJhbnNpdGlvbl9fVHJhbnNpdGlvbiA9IGZ1bmN0aW9uKCB3YXJuLCBTdHJpbmdGcmFnbWVudCwgaW5pdCwgZ2V0U3R5bGUsIHNldFN0eWxlLCBhbmltYXRlU3R5bGUsIHByb2Nlc3NQYXJhbXMsIHJlc2V0U3R5bGUgKSB7XG5cblx0XHR2YXIgVHJhbnNpdGlvbjtcblx0XHRUcmFuc2l0aW9uID0gZnVuY3Rpb24oIGRlc2NyaXB0b3IsIHJvb3QsIG93bmVyLCBpc0ludHJvICkge1xuXHRcdFx0dmFyIHQgPSB0aGlzLFxuXHRcdFx0XHRuYW1lLCBmcmFnbWVudCwgZXJyb3JNZXNzYWdlO1xuXHRcdFx0dGhpcy5yb290ID0gcm9vdDtcblx0XHRcdHRoaXMubm9kZSA9IG93bmVyLm5vZGU7XG5cdFx0XHR0aGlzLmlzSW50cm8gPSBpc0ludHJvO1xuXHRcdFx0dGhpcy5vcmlnaW5hbFN0eWxlID0gdGhpcy5ub2RlLmdldEF0dHJpYnV0ZSggJ3N0eWxlJyApO1xuXHRcdFx0dC5jb21wbGV0ZSA9IGZ1bmN0aW9uKCBub1Jlc2V0ICkge1xuXHRcdFx0XHRpZiAoICFub1Jlc2V0ICYmIHQuaXNJbnRybyApIHtcblx0XHRcdFx0XHR0LnJlc2V0U3R5bGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0Lm5vZGUuX3JhY3RpdmUudHJhbnNpdGlvbiA9IG51bGw7XG5cdFx0XHRcdHQuX21hbmFnZXIucmVtb3ZlKCB0ICk7XG5cdFx0XHR9O1xuXHRcdFx0bmFtZSA9IGRlc2NyaXB0b3IubiB8fCBkZXNjcmlwdG9yO1xuXHRcdFx0aWYgKCB0eXBlb2YgbmFtZSAhPT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdGZyYWdtZW50ID0gbmV3IFN0cmluZ0ZyYWdtZW50KCB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRvcjogbmFtZSxcblx0XHRcdFx0XHRyb290OiB0aGlzLnJvb3QsXG5cdFx0XHRcdFx0b3duZXI6IG93bmVyXG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0bmFtZSA9IGZyYWdtZW50LnRvU3RyaW5nKCk7XG5cdFx0XHRcdGZyYWdtZW50LnRlYXJkb3duKCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLm5hbWUgPSBuYW1lO1xuXHRcdFx0aWYgKCBkZXNjcmlwdG9yLmEgKSB7XG5cdFx0XHRcdHRoaXMucGFyYW1zID0gZGVzY3JpcHRvci5hO1xuXHRcdFx0fSBlbHNlIGlmICggZGVzY3JpcHRvci5kICkge1xuXHRcdFx0XHRmcmFnbWVudCA9IG5ldyBTdHJpbmdGcmFnbWVudCgge1xuXHRcdFx0XHRcdGRlc2NyaXB0b3I6IGRlc2NyaXB0b3IuZCxcblx0XHRcdFx0XHRyb290OiB0aGlzLnJvb3QsXG5cdFx0XHRcdFx0b3duZXI6IG93bmVyXG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0dGhpcy5wYXJhbXMgPSBmcmFnbWVudC50b0FyZ3NMaXN0KCk7XG5cdFx0XHRcdGZyYWdtZW50LnRlYXJkb3duKCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9mbiA9IHJvb3QudHJhbnNpdGlvbnNbIG5hbWUgXTtcblx0XHRcdGlmICggIXRoaXMuX2ZuICkge1xuXHRcdFx0XHRlcnJvck1lc3NhZ2UgPSAnTWlzc2luZyBcIicgKyBuYW1lICsgJ1wiIHRyYW5zaXRpb24uIFlvdSBtYXkgbmVlZCB0byBkb3dubG9hZCBhIHBsdWdpbiB2aWEgaHR0cDovL2RvY3MucmFjdGl2ZWpzLm9yZy9sYXRlc3QvcGx1Z2lucyN0cmFuc2l0aW9ucyc7XG5cdFx0XHRcdGlmICggcm9vdC5kZWJ1ZyApIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoIGVycm9yTWVzc2FnZSApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHdhcm4oIGVycm9yTWVzc2FnZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9O1xuXHRcdFRyYW5zaXRpb24ucHJvdG90eXBlID0ge1xuXHRcdFx0aW5pdDogaW5pdCxcblx0XHRcdGdldFN0eWxlOiBnZXRTdHlsZSxcblx0XHRcdHNldFN0eWxlOiBzZXRTdHlsZSxcblx0XHRcdGFuaW1hdGVTdHlsZTogYW5pbWF0ZVN0eWxlLFxuXHRcdFx0cHJvY2Vzc1BhcmFtczogcHJvY2Vzc1BhcmFtcyxcblx0XHRcdHJlc2V0U3R5bGU6IHJlc2V0U3R5bGVcblx0XHR9O1xuXHRcdHJldHVybiBUcmFuc2l0aW9uO1xuXHR9KCB1dGlsc193YXJuLCByZW5kZXJfU3RyaW5nRnJhZ21lbnRfX1N0cmluZ0ZyYWdtZW50LCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZXhlY3V0ZVRyYW5zaXRpb25fVHJhbnNpdGlvbl9wcm90b3R5cGVfaW5pdCwgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2V4ZWN1dGVUcmFuc2l0aW9uX1RyYW5zaXRpb25fcHJvdG90eXBlX2dldFN0eWxlLCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZXhlY3V0ZVRyYW5zaXRpb25fVHJhbnNpdGlvbl9wcm90b3R5cGVfc2V0U3R5bGUsIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9leGVjdXRlVHJhbnNpdGlvbl9UcmFuc2l0aW9uX3Byb3RvdHlwZV9hbmltYXRlU3R5bGVfX2FuaW1hdGVTdHlsZSwgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2V4ZWN1dGVUcmFuc2l0aW9uX1RyYW5zaXRpb25fcHJvdG90eXBlX3Byb2Nlc3NQYXJhbXMsIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9leGVjdXRlVHJhbnNpdGlvbl9UcmFuc2l0aW9uX3Byb3RvdHlwZV9yZXNldFN0eWxlICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9leGVjdXRlVHJhbnNpdGlvbl9fZXhlY3V0ZVRyYW5zaXRpb24gPSBmdW5jdGlvbiggcnVubG9vcCwgVHJhbnNpdGlvbiApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggZGVzY3JpcHRvciwgcmFjdGl2ZSwgb3duZXIsIGlzSW50cm8gKSB7XG5cdFx0XHR2YXIgdHJhbnNpdGlvbiwgbm9kZSwgb2xkVHJhbnNpdGlvbjtcblx0XHRcdGlmICggIXJhY3RpdmUudHJhbnNpdGlvbnNFbmFibGVkIHx8IHJhY3RpdmUuX3BhcmVudCAmJiAhcmFjdGl2ZS5fcGFyZW50LnRyYW5zaXRpb25zRW5hYmxlZCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dHJhbnNpdGlvbiA9IG5ldyBUcmFuc2l0aW9uKCBkZXNjcmlwdG9yLCByYWN0aXZlLCBvd25lciwgaXNJbnRybyApO1xuXHRcdFx0aWYgKCB0cmFuc2l0aW9uLl9mbiApIHtcblx0XHRcdFx0bm9kZSA9IHRyYW5zaXRpb24ubm9kZTtcblx0XHRcdFx0aWYgKCBvbGRUcmFuc2l0aW9uID0gbm9kZS5fcmFjdGl2ZS50cmFuc2l0aW9uICkge1xuXHRcdFx0XHRcdG9sZFRyYW5zaXRpb24uY29tcGxldGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRub2RlLl9yYWN0aXZlLnRyYW5zaXRpb24gPSB0cmFuc2l0aW9uO1xuXHRcdFx0XHRydW5sb29wLmFkZFRyYW5zaXRpb24oIHRyYW5zaXRpb24gKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9KCBnbG9iYWxfcnVubG9vcCwgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2V4ZWN1dGVUcmFuc2l0aW9uX1RyYW5zaXRpb25fX1RyYW5zaXRpb24gKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfaW5pdGlhbGlzZV9faW5pdGlhbGlzZSA9IGZ1bmN0aW9uKCBydW5sb29wLCB0eXBlcywgbmFtZXNwYWNlcywgY3JlYXRlLCBkZWZpbmVQcm9wZXJ0eSwgd2FybiwgY3JlYXRlRWxlbWVudCwgZ2V0SW5uZXJDb250ZXh0LCBnZXRFbGVtZW50TmFtZXNwYWNlLCBjcmVhdGVFbGVtZW50QXR0cmlidXRlcywgYXBwZW5kRWxlbWVudENoaWxkcmVuLCBkZWNvcmF0ZSwgYWRkRXZlbnRQcm94aWVzLCB1cGRhdGVMaXZlUXVlcmllcywgZXhlY3V0ZVRyYW5zaXRpb24sIGVuZm9yY2VDYXNlICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uIGluaXRpYWxpc2VFbGVtZW50KCBlbGVtZW50LCBvcHRpb25zLCBkb2NGcmFnICkge1xuXHRcdFx0dmFyIHBhcmVudEZyYWdtZW50LCBwTm9kZSwgZGVzY3JpcHRvciwgbmFtZXNwYWNlLCBuYW1lLCBhdHRyaWJ1dGVzLCB3aWR0aCwgaGVpZ2h0LCBsb2FkSGFuZGxlciwgcm9vdCwgc2VsZWN0QmluZGluZywgZXJyb3JNZXNzYWdlO1xuXHRcdFx0ZWxlbWVudC50eXBlID0gdHlwZXMuRUxFTUVOVDtcblx0XHRcdHBhcmVudEZyYWdtZW50ID0gZWxlbWVudC5wYXJlbnRGcmFnbWVudCA9IG9wdGlvbnMucGFyZW50RnJhZ21lbnQ7XG5cdFx0XHRwTm9kZSA9IHBhcmVudEZyYWdtZW50LnBOb2RlO1xuXHRcdFx0ZGVzY3JpcHRvciA9IGVsZW1lbnQuZGVzY3JpcHRvciA9IG9wdGlvbnMuZGVzY3JpcHRvcjtcblx0XHRcdGVsZW1lbnQucGFyZW50ID0gb3B0aW9ucy5wRWxlbWVudDtcblx0XHRcdGVsZW1lbnQucm9vdCA9IHJvb3QgPSBwYXJlbnRGcmFnbWVudC5yb290O1xuXHRcdFx0ZWxlbWVudC5pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG5cdFx0XHRlbGVtZW50LmxjTmFtZSA9IGRlc2NyaXB0b3IuZS50b0xvd2VyQ2FzZSgpO1xuXHRcdFx0ZWxlbWVudC5ldmVudExpc3RlbmVycyA9IFtdO1xuXHRcdFx0ZWxlbWVudC5jdXN0b21FdmVudExpc3RlbmVycyA9IFtdO1xuXHRcdFx0ZWxlbWVudC5jc3NEZXRhY2hRdWV1ZSA9IFtdO1xuXHRcdFx0aWYgKCBwTm9kZSApIHtcblx0XHRcdFx0bmFtZXNwYWNlID0gZWxlbWVudC5uYW1lc3BhY2UgPSBnZXRFbGVtZW50TmFtZXNwYWNlKCBkZXNjcmlwdG9yLCBwTm9kZSApO1xuXHRcdFx0XHRuYW1lID0gbmFtZXNwYWNlICE9PSBuYW1lc3BhY2VzLmh0bWwgPyBlbmZvcmNlQ2FzZSggZGVzY3JpcHRvci5lICkgOiBkZXNjcmlwdG9yLmU7XG5cdFx0XHRcdGVsZW1lbnQubm9kZSA9IGNyZWF0ZUVsZW1lbnQoIG5hbWUsIG5hbWVzcGFjZSApO1xuXHRcdFx0XHRpZiAoIHJvb3QuY3NzICYmIHBOb2RlID09PSByb290LmVsICkge1xuXHRcdFx0XHRcdGVsZW1lbnQubm9kZS5zZXRBdHRyaWJ1dGUoICdkYXRhLXJ2Y2d1aWQnLCByb290LmNvbnN0cnVjdG9yLl9ndWlkIHx8IHJvb3QuX2d1aWQgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRkZWZpbmVQcm9wZXJ0eSggZWxlbWVudC5ub2RlLCAnX3JhY3RpdmUnLCB7XG5cdFx0XHRcdFx0dmFsdWU6IHtcblx0XHRcdFx0XHRcdHByb3h5OiBlbGVtZW50LFxuXHRcdFx0XHRcdFx0a2V5cGF0aDogZ2V0SW5uZXJDb250ZXh0KCBwYXJlbnRGcmFnbWVudCApLFxuXHRcdFx0XHRcdFx0aW5kZXg6IHBhcmVudEZyYWdtZW50LmluZGV4UmVmcyxcblx0XHRcdFx0XHRcdGV2ZW50czogY3JlYXRlKCBudWxsICksXG5cdFx0XHRcdFx0XHRyb290OiByb290XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cdFx0XHRhdHRyaWJ1dGVzID0gY3JlYXRlRWxlbWVudEF0dHJpYnV0ZXMoIGVsZW1lbnQsIGRlc2NyaXB0b3IuYSApO1xuXHRcdFx0aWYgKCBkZXNjcmlwdG9yLmYgKSB7XG5cdFx0XHRcdGlmICggZWxlbWVudC5ub2RlICYmIGVsZW1lbnQubm9kZS5nZXRBdHRyaWJ1dGUoICdjb250ZW50ZWRpdGFibGUnICkgKSB7XG5cdFx0XHRcdFx0aWYgKCBlbGVtZW50Lm5vZGUuaW5uZXJIVE1MICkge1xuXHRcdFx0XHRcdFx0ZXJyb3JNZXNzYWdlID0gJ0EgcHJlLXBvcHVsYXRlZCBjb250ZW50ZWRpdGFibGUgZWxlbWVudCBzaG91bGQgbm90IGhhdmUgY2hpbGRyZW4nO1xuXHRcdFx0XHRcdFx0aWYgKCByb290LmRlYnVnICkge1xuXHRcdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoIGVycm9yTWVzc2FnZSApO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0d2FybiggZXJyb3JNZXNzYWdlICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGFwcGVuZEVsZW1lbnRDaGlsZHJlbiggZWxlbWVudCwgZWxlbWVudC5ub2RlLCBkZXNjcmlwdG9yLCBkb2NGcmFnICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGRvY0ZyYWcgJiYgZGVzY3JpcHRvci52ICkge1xuXHRcdFx0XHRhZGRFdmVudFByb3hpZXMoIGVsZW1lbnQsIGRlc2NyaXB0b3IudiApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBkb2NGcmFnICkge1xuXHRcdFx0XHRpZiAoIHJvb3QudHdvd2F5ICkge1xuXHRcdFx0XHRcdGVsZW1lbnQuYmluZCgpO1xuXHRcdFx0XHRcdGlmICggZWxlbWVudC5ub2RlLmdldEF0dHJpYnV0ZSggJ2NvbnRlbnRlZGl0YWJsZScgKSAmJiBlbGVtZW50Lm5vZGUuX3JhY3RpdmUuYmluZGluZyApIHtcblx0XHRcdFx0XHRcdGVsZW1lbnQubm9kZS5fcmFjdGl2ZS5iaW5kaW5nLnVwZGF0ZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIGF0dHJpYnV0ZXMubmFtZSAmJiAhYXR0cmlidXRlcy5uYW1lLnR3b3dheSApIHtcblx0XHRcdFx0XHRhdHRyaWJ1dGVzLm5hbWUudXBkYXRlKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBlbGVtZW50Lm5vZGUudGFnTmFtZSA9PT0gJ0lNRycgJiYgKCAoIHdpZHRoID0gZWxlbWVudC5hdHRyaWJ1dGVzLndpZHRoICkgfHwgKCBoZWlnaHQgPSBlbGVtZW50LmF0dHJpYnV0ZXMuaGVpZ2h0ICkgKSApIHtcblx0XHRcdFx0XHRlbGVtZW50Lm5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ2xvYWQnLCBsb2FkSGFuZGxlciA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0aWYgKCB3aWR0aCApIHtcblx0XHRcdFx0XHRcdFx0ZWxlbWVudC5ub2RlLndpZHRoID0gd2lkdGgudmFsdWU7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoIGhlaWdodCApIHtcblx0XHRcdFx0XHRcdFx0ZWxlbWVudC5ub2RlLmhlaWdodCA9IGhlaWdodC52YWx1ZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGVsZW1lbnQubm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKCAnbG9hZCcsIGxvYWRIYW5kbGVyLCBmYWxzZSApO1xuXHRcdFx0XHRcdH0sIGZhbHNlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZG9jRnJhZy5hcHBlbmRDaGlsZCggZWxlbWVudC5ub2RlICk7XG5cdFx0XHRcdGlmICggZGVzY3JpcHRvci5vICkge1xuXHRcdFx0XHRcdGRlY29yYXRlKCBkZXNjcmlwdG9yLm8sIHJvb3QsIGVsZW1lbnQgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIGRlc2NyaXB0b3IudDEgKSB7XG5cdFx0XHRcdFx0ZXhlY3V0ZVRyYW5zaXRpb24oIGRlc2NyaXB0b3IudDEsIHJvb3QsIGVsZW1lbnQsIHRydWUgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIGVsZW1lbnQubm9kZS50YWdOYW1lID09PSAnT1BUSU9OJyApIHtcblx0XHRcdFx0XHRpZiAoIHBOb2RlLnRhZ05hbWUgPT09ICdTRUxFQ1QnICYmICggc2VsZWN0QmluZGluZyA9IHBOb2RlLl9yYWN0aXZlLmJpbmRpbmcgKSApIHtcblx0XHRcdFx0XHRcdHNlbGVjdEJpbmRpbmcuZGVmZXJVcGRhdGUoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCBlbGVtZW50Lm5vZGUuX3JhY3RpdmUudmFsdWUgPT0gcE5vZGUuX3JhY3RpdmUudmFsdWUgKSB7XG5cdFx0XHRcdFx0XHRlbGVtZW50Lm5vZGUuc2VsZWN0ZWQgPSB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIGVsZW1lbnQubm9kZS5hdXRvZm9jdXMgKSB7XG5cdFx0XHRcdFx0cnVubG9vcC5mb2N1cyggZWxlbWVudC5ub2RlICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICggZWxlbWVudC5sY05hbWUgPT09ICdvcHRpb24nICkge1xuXHRcdFx0XHRlbGVtZW50LnNlbGVjdCA9IGZpbmRQYXJlbnRTZWxlY3QoIGVsZW1lbnQucGFyZW50ICk7XG5cdFx0XHR9XG5cdFx0XHR1cGRhdGVMaXZlUXVlcmllcyggZWxlbWVudCApO1xuXHRcdH07XG5cblx0XHRmdW5jdGlvbiBmaW5kUGFyZW50U2VsZWN0KCBlbGVtZW50ICkge1xuXHRcdFx0ZG8ge1xuXHRcdFx0XHRpZiAoIGVsZW1lbnQubGNOYW1lID09PSAnc2VsZWN0JyApIHtcblx0XHRcdFx0XHRyZXR1cm4gZWxlbWVudDtcblx0XHRcdFx0fVxuXHRcdFx0fSB3aGlsZSAoIGVsZW1lbnQgPSBlbGVtZW50LnBhcmVudCApO1xuXHRcdH1cblx0fSggZ2xvYmFsX3J1bmxvb3AsIGNvbmZpZ190eXBlcywgY29uZmlnX25hbWVzcGFjZXMsIHV0aWxzX2NyZWF0ZSwgdXRpbHNfZGVmaW5lUHJvcGVydHksIHV0aWxzX3dhcm4sIHV0aWxzX2NyZWF0ZUVsZW1lbnQsIHNoYXJlZF9nZXRJbm5lckNvbnRleHQsIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X2luaXRpYWxpc2VfZ2V0RWxlbWVudE5hbWVzcGFjZSwgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfaW5pdGlhbGlzZV9jcmVhdGVFbGVtZW50QXR0cmlidXRlcywgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfaW5pdGlhbGlzZV9hcHBlbmRFbGVtZW50Q2hpbGRyZW4sIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X2luaXRpYWxpc2VfZGVjb3JhdGVfX2RlY29yYXRlLCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9pbml0aWFsaXNlX2FkZEV2ZW50UHJveGllc19fYWRkRXZlbnRQcm94aWVzLCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9pbml0aWFsaXNlX3VwZGF0ZUxpdmVRdWVyaWVzLCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZXhlY3V0ZVRyYW5zaXRpb25fX2V4ZWN1dGVUcmFuc2l0aW9uLCByZW5kZXJfRG9tRnJhZ21lbnRfc2hhcmVkX2VuZm9yY2VDYXNlICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3Byb3RvdHlwZV90ZWFyZG93biA9IGZ1bmN0aW9uKCBydW5sb29wLCBleGVjdXRlVHJhbnNpdGlvbiApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiBFbGVtZW50X3Byb3RvdHlwZV90ZWFyZG93biggZGVzdHJveSApIHtcblx0XHRcdHZhciBldmVudE5hbWUsIGJpbmRpbmcsIGJpbmRpbmdzO1xuXHRcdFx0aWYgKCBkZXN0cm95ICkge1xuXHRcdFx0XHR0aGlzLndpbGxEZXRhY2ggPSB0cnVlO1xuXHRcdFx0XHRydW5sb29wLmRldGFjaFdoZW5SZWFkeSggdGhpcyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aGlzLmZyYWdtZW50ICkge1xuXHRcdFx0XHR0aGlzLmZyYWdtZW50LnRlYXJkb3duKCBmYWxzZSApO1xuXHRcdFx0fVxuXHRcdFx0d2hpbGUgKCB0aGlzLmF0dHJpYnV0ZXMubGVuZ3RoICkge1xuXHRcdFx0XHR0aGlzLmF0dHJpYnV0ZXMucG9wKCkudGVhcmRvd24oKTtcblx0XHRcdH1cblx0XHRcdGlmICggdGhpcy5ub2RlICkge1xuXHRcdFx0XHRmb3IgKCBldmVudE5hbWUgaW4gdGhpcy5ub2RlLl9yYWN0aXZlLmV2ZW50cyApIHtcblx0XHRcdFx0XHR0aGlzLm5vZGUuX3JhY3RpdmUuZXZlbnRzWyBldmVudE5hbWUgXS50ZWFyZG93bigpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggYmluZGluZyA9IHRoaXMubm9kZS5fcmFjdGl2ZS5iaW5kaW5nICkge1xuXHRcdFx0XHRcdGJpbmRpbmcudGVhcmRvd24oKTtcblx0XHRcdFx0XHRiaW5kaW5ncyA9IHRoaXMucm9vdC5fdHdvd2F5QmluZGluZ3NbIGJpbmRpbmcuYXR0ci5rZXlwYXRoIF07XG5cdFx0XHRcdFx0YmluZGluZ3Muc3BsaWNlKCBiaW5kaW5ncy5pbmRleE9mKCBiaW5kaW5nICksIDEgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aGlzLmRlY29yYXRvciApIHtcblx0XHRcdFx0dGhpcy5kZWNvcmF0b3IudGVhcmRvd24oKTtcblx0XHRcdH1cblx0XHRcdGlmICggdGhpcy5kZXNjcmlwdG9yLnQyICkge1xuXHRcdFx0XHRleGVjdXRlVHJhbnNpdGlvbiggdGhpcy5kZXNjcmlwdG9yLnQyLCB0aGlzLnJvb3QsIHRoaXMsIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRoaXMubGl2ZVF1ZXJpZXMgKSB7XG5cdFx0XHRcdHJlbW92ZUZyb21MaXZlUXVlcmllcyggdGhpcyApO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRmdW5jdGlvbiByZW1vdmVGcm9tTGl2ZVF1ZXJpZXMoIGVsZW1lbnQgKSB7XG5cdFx0XHR2YXIgcXVlcnksIHNlbGVjdG9yLCBtYXRjaGluZ1N0YXRpY05vZGVzLCBpLCBqO1xuXHRcdFx0aSA9IGVsZW1lbnQubGl2ZVF1ZXJpZXMubGVuZ3RoO1xuXHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdHF1ZXJ5ID0gZWxlbWVudC5saXZlUXVlcmllc1sgaSBdO1xuXHRcdFx0XHRzZWxlY3RvciA9IHF1ZXJ5LnNlbGVjdG9yO1xuXHRcdFx0XHRxdWVyeS5fcmVtb3ZlKCBlbGVtZW50Lm5vZGUgKTtcblx0XHRcdFx0aWYgKCBlbGVtZW50Lm1hdGNoaW5nU3RhdGljTm9kZXMgJiYgKCBtYXRjaGluZ1N0YXRpY05vZGVzID0gZWxlbWVudC5tYXRjaGluZ1N0YXRpY05vZGVzWyBzZWxlY3RvciBdICkgKSB7XG5cdFx0XHRcdFx0aiA9IG1hdGNoaW5nU3RhdGljTm9kZXMubGVuZ3RoO1xuXHRcdFx0XHRcdHdoaWxlICggai0tICkge1xuXHRcdFx0XHRcdFx0cXVlcnkucmVtb3ZlKCBtYXRjaGluZ1N0YXRpY05vZGVzWyBqIF0gKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH0oIGdsb2JhbF9ydW5sb29wLCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZXhlY3V0ZVRyYW5zaXRpb25fX2V4ZWN1dGVUcmFuc2l0aW9uICk7XG5cblx0dmFyIGNvbmZpZ192b2lkRWxlbWVudE5hbWVzID0gJ2FyZWEgYmFzZSBiciBjb2wgY29tbWFuZCBkb2N0eXBlIGVtYmVkIGhyIGltZyBpbnB1dCBrZXlnZW4gbGluayBtZXRhIHBhcmFtIHNvdXJjZSB0cmFjayB3YnInLnNwbGl0KCAnICcgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfcHJvdG90eXBlX3RvU3RyaW5nID0gZnVuY3Rpb24oIHZvaWRFbGVtZW50TmFtZXMsIGlzQXJyYXkgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgc3RyLCBpLCBsZW4sIGF0dHJTdHI7XG5cdFx0XHRzdHIgPSAnPCcgKyAoIHRoaXMuZGVzY3JpcHRvci55ID8gJyFkb2N0eXBlJyA6IHRoaXMuZGVzY3JpcHRvci5lICk7XG5cdFx0XHRsZW4gPSB0aGlzLmF0dHJpYnV0ZXMubGVuZ3RoO1xuXHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0aWYgKCBhdHRyU3RyID0gdGhpcy5hdHRyaWJ1dGVzWyBpIF0udG9TdHJpbmcoKSApIHtcblx0XHRcdFx0XHRzdHIgKz0gJyAnICsgYXR0clN0cjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aGlzLmxjTmFtZSA9PT0gJ29wdGlvbicgJiYgb3B0aW9uSXNTZWxlY3RlZCggdGhpcyApICkge1xuXHRcdFx0XHRzdHIgKz0gJyBzZWxlY3RlZCc7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRoaXMubGNOYW1lID09PSAnaW5wdXQnICYmIGlucHV0SXNDaGVja2VkUmFkaW8oIHRoaXMgKSApIHtcblx0XHRcdFx0c3RyICs9ICcgY2hlY2tlZCc7XG5cdFx0XHR9XG5cdFx0XHRzdHIgKz0gJz4nO1xuXHRcdFx0aWYgKCB0aGlzLmh0bWwgKSB7XG5cdFx0XHRcdHN0ciArPSB0aGlzLmh0bWw7XG5cdFx0XHR9IGVsc2UgaWYgKCB0aGlzLmZyYWdtZW50ICkge1xuXHRcdFx0XHRzdHIgKz0gdGhpcy5mcmFnbWVudC50b1N0cmluZygpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB2b2lkRWxlbWVudE5hbWVzLmluZGV4T2YoIHRoaXMuZGVzY3JpcHRvci5lICkgPT09IC0xICkge1xuXHRcdFx0XHRzdHIgKz0gJzwvJyArIHRoaXMuZGVzY3JpcHRvci5lICsgJz4nO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5zdHJpbmdpZnlpbmcgPSBmYWxzZTtcblx0XHRcdHJldHVybiBzdHI7XG5cdFx0fTtcblxuXHRcdGZ1bmN0aW9uIG9wdGlvbklzU2VsZWN0ZWQoIGVsZW1lbnQgKSB7XG5cdFx0XHR2YXIgb3B0aW9uVmFsdWUsIHNlbGVjdFZhbHVlQXR0cmlidXRlLCBzZWxlY3RWYWx1ZUludGVycG9sYXRvciwgc2VsZWN0VmFsdWUsIGk7XG5cdFx0XHRvcHRpb25WYWx1ZSA9IGVsZW1lbnQuYXR0cmlidXRlcy52YWx1ZS52YWx1ZTtcblx0XHRcdHNlbGVjdFZhbHVlQXR0cmlidXRlID0gZWxlbWVudC5zZWxlY3QuYXR0cmlidXRlcy52YWx1ZTtcblx0XHRcdHNlbGVjdFZhbHVlSW50ZXJwb2xhdG9yID0gc2VsZWN0VmFsdWVBdHRyaWJ1dGUuaW50ZXJwb2xhdG9yO1xuXHRcdFx0aWYgKCAhc2VsZWN0VmFsdWVJbnRlcnBvbGF0b3IgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHNlbGVjdFZhbHVlID0gZWxlbWVudC5yb290LmdldCggc2VsZWN0VmFsdWVJbnRlcnBvbGF0b3Iua2V5cGF0aCB8fCBzZWxlY3RWYWx1ZUludGVycG9sYXRvci5yZWYgKTtcblx0XHRcdGlmICggc2VsZWN0VmFsdWUgPT0gb3B0aW9uVmFsdWUgKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBlbGVtZW50LnNlbGVjdC5hdHRyaWJ1dGVzLm11bHRpcGxlICYmIGlzQXJyYXkoIHNlbGVjdFZhbHVlICkgKSB7XG5cdFx0XHRcdGkgPSBzZWxlY3RWYWx1ZS5sZW5ndGg7XG5cdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdGlmICggc2VsZWN0VmFsdWVbIGkgXSA9PSBvcHRpb25WYWx1ZSApIHtcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGlucHV0SXNDaGVja2VkUmFkaW8oIGVsZW1lbnQgKSB7XG5cdFx0XHR2YXIgYXR0cmlidXRlcywgdHlwZUF0dHJpYnV0ZSwgdmFsdWVBdHRyaWJ1dGUsIG5hbWVBdHRyaWJ1dGU7XG5cdFx0XHRhdHRyaWJ1dGVzID0gZWxlbWVudC5hdHRyaWJ1dGVzO1xuXHRcdFx0dHlwZUF0dHJpYnV0ZSA9IGF0dHJpYnV0ZXMudHlwZTtcblx0XHRcdHZhbHVlQXR0cmlidXRlID0gYXR0cmlidXRlcy52YWx1ZTtcblx0XHRcdG5hbWVBdHRyaWJ1dGUgPSBhdHRyaWJ1dGVzLm5hbWU7XG5cdFx0XHRpZiAoICF0eXBlQXR0cmlidXRlIHx8IHR5cGVBdHRyaWJ1dGUudmFsdWUgIT09ICdyYWRpbycgfHwgIXZhbHVlQXR0cmlidXRlIHx8ICFuYW1lQXR0cmlidXRlLmludGVycG9sYXRvciApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB2YWx1ZUF0dHJpYnV0ZS52YWx1ZSA9PT0gbmFtZUF0dHJpYnV0ZS5pbnRlcnBvbGF0b3IudmFsdWUgKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblx0fSggY29uZmlnX3ZvaWRFbGVtZW50TmFtZXMsIHV0aWxzX2lzQXJyYXkgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfcHJvdG90eXBlX2ZpbmQgPSBmdW5jdGlvbiggbWF0Y2hlcyApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggc2VsZWN0b3IgKSB7XG5cdFx0XHR2YXIgcXVlcnlSZXN1bHQ7XG5cdFx0XHRpZiAoIG1hdGNoZXMoIHRoaXMubm9kZSwgc2VsZWN0b3IgKSApIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMubm9kZTtcblx0XHRcdH1cblx0XHRcdGlmICggdGhpcy5odG1sICYmICggcXVlcnlSZXN1bHQgPSB0aGlzLm5vZGUucXVlcnlTZWxlY3Rvciggc2VsZWN0b3IgKSApICkge1xuXHRcdFx0XHRyZXR1cm4gcXVlcnlSZXN1bHQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRoaXMuZnJhZ21lbnQgJiYgdGhpcy5mcmFnbWVudC5maW5kICkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5mcmFnbWVudC5maW5kKCBzZWxlY3RvciApO1xuXHRcdFx0fVxuXHRcdH07XG5cdH0oIHV0aWxzX21hdGNoZXMgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfcHJvdG90eXBlX2ZpbmRBbGwgPSBmdW5jdGlvbiggZ2V0TWF0Y2hpbmdTdGF0aWNOb2RlcyApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggc2VsZWN0b3IsIHF1ZXJ5ICkge1xuXHRcdFx0dmFyIG1hdGNoaW5nU3RhdGljTm9kZXMsIG1hdGNoZWRTZWxmO1xuXHRcdFx0aWYgKCBxdWVyeS5fdGVzdCggdGhpcywgdHJ1ZSApICYmIHF1ZXJ5LmxpdmUgKSB7XG5cdFx0XHRcdCggdGhpcy5saXZlUXVlcmllcyB8fCAoIHRoaXMubGl2ZVF1ZXJpZXMgPSBbXSApICkucHVzaCggcXVlcnkgKTtcblx0XHRcdH1cblx0XHRcdGlmICggdGhpcy5odG1sICkge1xuXHRcdFx0XHRtYXRjaGluZ1N0YXRpY05vZGVzID0gZ2V0TWF0Y2hpbmdTdGF0aWNOb2RlcyggdGhpcywgc2VsZWN0b3IgKTtcblx0XHRcdFx0cXVlcnkucHVzaC5hcHBseSggcXVlcnksIG1hdGNoaW5nU3RhdGljTm9kZXMgKTtcblx0XHRcdFx0aWYgKCBxdWVyeS5saXZlICYmICFtYXRjaGVkU2VsZiApIHtcblx0XHRcdFx0XHQoIHRoaXMubGl2ZVF1ZXJpZXMgfHwgKCB0aGlzLmxpdmVRdWVyaWVzID0gW10gKSApLnB1c2goIHF1ZXJ5ICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICggdGhpcy5mcmFnbWVudCApIHtcblx0XHRcdFx0dGhpcy5mcmFnbWVudC5maW5kQWxsKCBzZWxlY3RvciwgcXVlcnkgKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9KCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZ2V0TWF0Y2hpbmdTdGF0aWNOb2RlcyApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9wcm90b3R5cGVfZmluZENvbXBvbmVudCA9IGZ1bmN0aW9uKCBzZWxlY3RvciApIHtcblx0XHRpZiAoIHRoaXMuZnJhZ21lbnQgKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5mcmFnbWVudC5maW5kQ29tcG9uZW50KCBzZWxlY3RvciApO1xuXHRcdH1cblx0fTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfcHJvdG90eXBlX2ZpbmRBbGxDb21wb25lbnRzID0gZnVuY3Rpb24oIHNlbGVjdG9yLCBxdWVyeSApIHtcblx0XHRpZiAoIHRoaXMuZnJhZ21lbnQgKSB7XG5cdFx0XHR0aGlzLmZyYWdtZW50LmZpbmRBbGxDb21wb25lbnRzKCBzZWxlY3RvciwgcXVlcnkgKTtcblx0XHR9XG5cdH07XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3Byb3RvdHlwZV9iaW5kID0gZnVuY3Rpb24oKSB7XG5cdFx0dmFyIGF0dHJpYnV0ZXMgPSB0aGlzLmF0dHJpYnV0ZXM7XG5cdFx0aWYgKCAhdGhpcy5ub2RlICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoIHRoaXMuYmluZGluZyApIHtcblx0XHRcdHRoaXMuYmluZGluZy50ZWFyZG93bigpO1xuXHRcdFx0dGhpcy5iaW5kaW5nID0gbnVsbDtcblx0XHR9XG5cdFx0aWYgKCB0aGlzLm5vZGUuZ2V0QXR0cmlidXRlKCAnY29udGVudGVkaXRhYmxlJyApICYmIGF0dHJpYnV0ZXMudmFsdWUgJiYgYXR0cmlidXRlcy52YWx1ZS5iaW5kKCkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHN3aXRjaCAoIHRoaXMuZGVzY3JpcHRvci5lICkge1xuXHRcdFx0Y2FzZSAnc2VsZWN0Jzpcblx0XHRcdGNhc2UgJ3RleHRhcmVhJzpcblx0XHRcdFx0aWYgKCBhdHRyaWJ1dGVzLnZhbHVlICkge1xuXHRcdFx0XHRcdGF0dHJpYnV0ZXMudmFsdWUuYmluZCgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdGNhc2UgJ2lucHV0Jzpcblx0XHRcdFx0aWYgKCB0aGlzLm5vZGUudHlwZSA9PT0gJ3JhZGlvJyB8fCB0aGlzLm5vZGUudHlwZSA9PT0gJ2NoZWNrYm94JyApIHtcblx0XHRcdFx0XHRpZiAoIGF0dHJpYnV0ZXMubmFtZSAmJiBhdHRyaWJ1dGVzLm5hbWUuYmluZCgpICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIGF0dHJpYnV0ZXMuY2hlY2tlZCAmJiBhdHRyaWJ1dGVzLmNoZWNrZWQuYmluZCgpICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIGF0dHJpYnV0ZXMudmFsdWUgJiYgYXR0cmlidXRlcy52YWx1ZS5iaW5kKCkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0fVxuXHR9O1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9fRWxlbWVudCA9IGZ1bmN0aW9uKCBydW5sb29wLCBjc3MsIGluaXRpYWxpc2UsIHRlYXJkb3duLCB0b1N0cmluZywgZmluZCwgZmluZEFsbCwgZmluZENvbXBvbmVudCwgZmluZEFsbENvbXBvbmVudHMsIGJpbmQgKSB7XG5cblx0XHR2YXIgRG9tRWxlbWVudCA9IGZ1bmN0aW9uKCBvcHRpb25zLCBkb2NGcmFnICkge1xuXHRcdFx0aW5pdGlhbGlzZSggdGhpcywgb3B0aW9ucywgZG9jRnJhZyApO1xuXHRcdH07XG5cdFx0RG9tRWxlbWVudC5wcm90b3R5cGUgPSB7XG5cdFx0XHRkZXRhY2g6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgQ29tcG9uZW50O1xuXHRcdFx0XHRpZiAoIHRoaXMubm9kZSApIHtcblx0XHRcdFx0XHRpZiAoIHRoaXMubm9kZS5wYXJlbnROb2RlICkge1xuXHRcdFx0XHRcdFx0dGhpcy5ub2RlLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoIHRoaXMubm9kZSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5ub2RlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggdGhpcy5jc3NEZXRhY2hRdWV1ZS5sZW5ndGggKSB7XG5cdFx0XHRcdFx0cnVubG9vcC5zdGFydCgpO1xuXHRcdFx0XHRcdHdoaWxlICggQ29tcG9uZW50ID09PSB0aGlzLmNzc0RldGFjaFF1ZXVlLnBvcCgpICkge1xuXHRcdFx0XHRcdFx0Y3NzLnJlbW92ZSggQ29tcG9uZW50ICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJ1bmxvb3AuZW5kKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogdGVhcmRvd24sXG5cdFx0XHRmaXJzdE5vZGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5ub2RlO1xuXHRcdFx0fSxcblx0XHRcdGZpbmROZXh0Tm9kZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fSxcblx0XHRcdGJ1YmJsZTogZnVuY3Rpb24oKSB7fSxcblx0XHRcdHRvU3RyaW5nOiB0b1N0cmluZyxcblx0XHRcdGZpbmQ6IGZpbmQsXG5cdFx0XHRmaW5kQWxsOiBmaW5kQWxsLFxuXHRcdFx0ZmluZENvbXBvbmVudDogZmluZENvbXBvbmVudCxcblx0XHRcdGZpbmRBbGxDb21wb25lbnRzOiBmaW5kQWxsQ29tcG9uZW50cyxcblx0XHRcdGJpbmQ6IGJpbmRcblx0XHR9O1xuXHRcdHJldHVybiBEb21FbGVtZW50O1xuXHR9KCBnbG9iYWxfcnVubG9vcCwgZ2xvYmFsX2NzcywgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfaW5pdGlhbGlzZV9faW5pdGlhbGlzZSwgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfcHJvdG90eXBlX3RlYXJkb3duLCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9wcm90b3R5cGVfdG9TdHJpbmcsIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3Byb3RvdHlwZV9maW5kLCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9wcm90b3R5cGVfZmluZEFsbCwgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfcHJvdG90eXBlX2ZpbmRDb21wb25lbnQsIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3Byb3RvdHlwZV9maW5kQWxsQ29tcG9uZW50cywgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfcHJvdG90eXBlX2JpbmQgKTtcblxuXHR2YXIgY29uZmlnX2Vycm9ycyA9IHtcblx0XHRtaXNzaW5nUGFyc2VyOiAnTWlzc2luZyBSYWN0aXZlLnBhcnNlIC0gY2Fubm90IHBhcnNlIHRlbXBsYXRlLiBFaXRoZXIgcHJlcGFyc2Ugb3IgdXNlIHRoZSB2ZXJzaW9uIHRoYXQgaW5jbHVkZXMgdGhlIHBhcnNlcidcblx0fTtcblxuXHR2YXIgcmVnaXN0cmllc19wYXJ0aWFscyA9IHt9O1xuXG5cdHZhciBwYXJzZV91dGlsc19zdHJpcEh0bWxDb21tZW50cyA9IGZ1bmN0aW9uKCBodG1sICkge1xuXHRcdHZhciBjb21tZW50U3RhcnQsIGNvbW1lbnRFbmQsIHByb2Nlc3NlZDtcblx0XHRwcm9jZXNzZWQgPSAnJztcblx0XHR3aGlsZSAoIGh0bWwubGVuZ3RoICkge1xuXHRcdFx0Y29tbWVudFN0YXJ0ID0gaHRtbC5pbmRleE9mKCAnPCEtLScgKTtcblx0XHRcdGNvbW1lbnRFbmQgPSBodG1sLmluZGV4T2YoICctLT4nICk7XG5cdFx0XHRpZiAoIGNvbW1lbnRTdGFydCA9PT0gLTEgJiYgY29tbWVudEVuZCA9PT0gLTEgKSB7XG5cdFx0XHRcdHByb2Nlc3NlZCArPSBodG1sO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGlmICggY29tbWVudFN0YXJ0ICE9PSAtMSAmJiBjb21tZW50RW5kID09PSAtMSApIHtcblx0XHRcdFx0dGhyb3cgJ0lsbGVnYWwgSFRNTCAtIGV4cGVjdGVkIGNsb3NpbmcgY29tbWVudCBzZXF1ZW5jZSAoXFwnLS0+XFwnKSc7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGNvbW1lbnRFbmQgIT09IC0xICYmIGNvbW1lbnRTdGFydCA9PT0gLTEgfHwgY29tbWVudEVuZCA8IGNvbW1lbnRTdGFydCApIHtcblx0XHRcdFx0dGhyb3cgJ0lsbGVnYWwgSFRNTCAtIHVuZXhwZWN0ZWQgY2xvc2luZyBjb21tZW50IHNlcXVlbmNlIChcXCctLT5cXCcpJztcblx0XHRcdH1cblx0XHRcdHByb2Nlc3NlZCArPSBodG1sLnN1YnN0ciggMCwgY29tbWVudFN0YXJ0ICk7XG5cdFx0XHRodG1sID0gaHRtbC5zdWJzdHJpbmcoIGNvbW1lbnRFbmQgKyAzICk7XG5cdFx0fVxuXHRcdHJldHVybiBwcm9jZXNzZWQ7XG5cdH07XG5cblx0dmFyIHBhcnNlX3V0aWxzX3N0cmlwU3RhbmRhbG9uZXMgPSBmdW5jdGlvbiggdHlwZXMgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHRva2VucyApIHtcblx0XHRcdHZhciBpLCBjdXJyZW50LCBiYWNrT25lLCBiYWNrVHdvLCBsZWFkaW5nTGluZWJyZWFrLCB0cmFpbGluZ0xpbmVicmVhaztcblx0XHRcdGxlYWRpbmdMaW5lYnJlYWsgPSAvXlxccypcXHI/XFxuLztcblx0XHRcdHRyYWlsaW5nTGluZWJyZWFrID0gL1xccj9cXG5cXHMqJC87XG5cdFx0XHRmb3IgKCBpID0gMjsgaSA8IHRva2Vucy5sZW5ndGg7IGkgKz0gMSApIHtcblx0XHRcdFx0Y3VycmVudCA9IHRva2Vuc1sgaSBdO1xuXHRcdFx0XHRiYWNrT25lID0gdG9rZW5zWyBpIC0gMSBdO1xuXHRcdFx0XHRiYWNrVHdvID0gdG9rZW5zWyBpIC0gMiBdO1xuXHRcdFx0XHRpZiAoIGN1cnJlbnQudHlwZSA9PT0gdHlwZXMuVEVYVCAmJiAoIGJhY2tPbmUudHlwZSA9PT0gdHlwZXMuTVVTVEFDSEUgJiYgYmFja09uZS5tdXN0YWNoZVR5cGUgIT09IHR5cGVzLlBBUlRJQUwgKSAmJiBiYWNrVHdvLnR5cGUgPT09IHR5cGVzLlRFWFQgKSB7XG5cdFx0XHRcdFx0aWYgKCB0cmFpbGluZ0xpbmVicmVhay50ZXN0KCBiYWNrVHdvLnZhbHVlICkgJiYgbGVhZGluZ0xpbmVicmVhay50ZXN0KCBjdXJyZW50LnZhbHVlICkgKSB7XG5cdFx0XHRcdFx0XHRpZiAoIGJhY2tPbmUubXVzdGFjaGVUeXBlICE9PSB0eXBlcy5JTlRFUlBPTEFUT1IgJiYgYmFja09uZS5tdXN0YWNoZVR5cGUgIT09IHR5cGVzLlRSSVBMRSApIHtcblx0XHRcdFx0XHRcdFx0YmFja1R3by52YWx1ZSA9IGJhY2tUd28udmFsdWUucmVwbGFjZSggdHJhaWxpbmdMaW5lYnJlYWssICdcXG4nICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjdXJyZW50LnZhbHVlID0gY3VycmVudC52YWx1ZS5yZXBsYWNlKCBsZWFkaW5nTGluZWJyZWFrLCAnJyApO1xuXHRcdFx0XHRcdFx0aWYgKCBjdXJyZW50LnZhbHVlID09PSAnJyApIHtcblx0XHRcdFx0XHRcdFx0dG9rZW5zLnNwbGljZSggaS0tLCAxICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdG9rZW5zO1xuXHRcdH07XG5cdH0oIGNvbmZpZ190eXBlcyApO1xuXG5cdHZhciBwYXJzZV91dGlsc19zdHJpcENvbW1lbnRUb2tlbnMgPSBmdW5jdGlvbiggdHlwZXMgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHRva2VucyApIHtcblx0XHRcdHZhciBpLCBjdXJyZW50LCBwcmV2aW91cywgbmV4dDtcblx0XHRcdGZvciAoIGkgPSAwOyBpIDwgdG9rZW5zLmxlbmd0aDsgaSArPSAxICkge1xuXHRcdFx0XHRjdXJyZW50ID0gdG9rZW5zWyBpIF07XG5cdFx0XHRcdHByZXZpb3VzID0gdG9rZW5zWyBpIC0gMSBdO1xuXHRcdFx0XHRuZXh0ID0gdG9rZW5zWyBpICsgMSBdO1xuXHRcdFx0XHRpZiAoIGN1cnJlbnQubXVzdGFjaGVUeXBlID09PSB0eXBlcy5DT01NRU5UIHx8IGN1cnJlbnQubXVzdGFjaGVUeXBlID09PSB0eXBlcy5ERUxJTUNIQU5HRSApIHtcblx0XHRcdFx0XHR0b2tlbnMuc3BsaWNlKCBpLCAxICk7XG5cdFx0XHRcdFx0aWYgKCBwcmV2aW91cyAmJiBuZXh0ICkge1xuXHRcdFx0XHRcdFx0aWYgKCBwcmV2aW91cy50eXBlID09PSB0eXBlcy5URVhUICYmIG5leHQudHlwZSA9PT0gdHlwZXMuVEVYVCApIHtcblx0XHRcdFx0XHRcdFx0cHJldmlvdXMudmFsdWUgKz0gbmV4dC52YWx1ZTtcblx0XHRcdFx0XHRcdFx0dG9rZW5zLnNwbGljZSggaSwgMSApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpIC09IDE7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiB0b2tlbnM7XG5cdFx0fTtcblx0fSggY29uZmlnX3R5cGVzICk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9nZXRNdXN0YWNoZV9nZXREZWxpbWl0ZXJDaGFuZ2UgPSBmdW5jdGlvbiggbWFrZVJlZ2V4TWF0Y2hlciApIHtcblxuXHRcdHZhciBnZXREZWxpbWl0ZXIgPSBtYWtlUmVnZXhNYXRjaGVyKCAvXlteXFxzPV0rLyApO1xuXHRcdHJldHVybiBmdW5jdGlvbiggdG9rZW5pemVyICkge1xuXHRcdFx0dmFyIHN0YXJ0LCBvcGVuaW5nLCBjbG9zaW5nO1xuXHRcdFx0aWYgKCAhdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnPScgKSApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRzdGFydCA9IHRva2VuaXplci5wb3M7XG5cdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRvcGVuaW5nID0gZ2V0RGVsaW1pdGVyKCB0b2tlbml6ZXIgKTtcblx0XHRcdGlmICggIW9wZW5pbmcgKSB7XG5cdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRjbG9zaW5nID0gZ2V0RGVsaW1pdGVyKCB0b2tlbml6ZXIgKTtcblx0XHRcdGlmICggIWNsb3NpbmcgKSB7XG5cdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRpZiAoICF0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICc9JyApICkge1xuXHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIFtcblx0XHRcdFx0b3BlbmluZyxcblx0XHRcdFx0Y2xvc2luZ1xuXHRcdFx0XTtcblx0XHR9O1xuXHR9KCBwYXJzZV9Ub2tlbml6ZXJfdXRpbHNfbWFrZVJlZ2V4TWF0Y2hlciApO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfZ2V0TXVzdGFjaGVfZ2V0TXVzdGFjaGVUeXBlID0gZnVuY3Rpb24oIHR5cGVzICkge1xuXG5cdFx0dmFyIG11c3RhY2hlVHlwZXMgPSB7XG5cdFx0XHQnIyc6IHR5cGVzLlNFQ1RJT04sXG5cdFx0XHQnXic6IHR5cGVzLklOVkVSVEVELFxuXHRcdFx0Jy8nOiB0eXBlcy5DTE9TSU5HLFxuXHRcdFx0Jz4nOiB0eXBlcy5QQVJUSUFMLFxuXHRcdFx0JyEnOiB0eXBlcy5DT01NRU5ULFxuXHRcdFx0JyYnOiB0eXBlcy5UUklQTEVcblx0XHR9O1xuXHRcdHJldHVybiBmdW5jdGlvbiggdG9rZW5pemVyICkge1xuXHRcdFx0dmFyIHR5cGUgPSBtdXN0YWNoZVR5cGVzWyB0b2tlbml6ZXIuc3RyLmNoYXJBdCggdG9rZW5pemVyLnBvcyApIF07XG5cdFx0XHRpZiAoICF0eXBlICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHRva2VuaXplci5wb3MgKz0gMTtcblx0XHRcdHJldHVybiB0eXBlO1xuXHRcdH07XG5cdH0oIGNvbmZpZ190eXBlcyApO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfZ2V0TXVzdGFjaGVfZ2V0TXVzdGFjaGVDb250ZW50ID0gZnVuY3Rpb24oIHR5cGVzLCBtYWtlUmVnZXhNYXRjaGVyLCBnZXRNdXN0YWNoZVR5cGUgKSB7XG5cblx0XHR2YXIgZ2V0SW5kZXhSZWYgPSBtYWtlUmVnZXhNYXRjaGVyKCAvXlxccyo6XFxzKihbYS16QS1aXyRdW2EtekEtWl8kMC05XSopLyApLFxuXHRcdFx0YXJyYXlNZW1iZXIgPSAvXlswLTldWzEtOV0qJC87XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB0b2tlbml6ZXIsIGlzVHJpcGxlICkge1xuXHRcdFx0dmFyIHN0YXJ0LCBtdXN0YWNoZSwgdHlwZSwgZXhwciwgaSwgcmVtYWluaW5nLCBpbmRleCwgZGVsaW1pdGVyO1xuXHRcdFx0c3RhcnQgPSB0b2tlbml6ZXIucG9zO1xuXHRcdFx0bXVzdGFjaGUgPSB7XG5cdFx0XHRcdHR5cGU6IGlzVHJpcGxlID8gdHlwZXMuVFJJUExFIDogdHlwZXMuTVVTVEFDSEVcblx0XHRcdH07XG5cdFx0XHRpZiAoICFpc1RyaXBsZSApIHtcblx0XHRcdFx0aWYgKCBleHByID0gdG9rZW5pemVyLmdldEV4cHJlc3Npb24oKSApIHtcblx0XHRcdFx0XHRtdXN0YWNoZS5tdXN0YWNoZVR5cGUgPSB0eXBlcy5JTlRFUlBPTEFUT1I7XG5cdFx0XHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0XHRcdGlmICggdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCB0b2tlbml6ZXIuZGVsaW1pdGVyc1sgMSBdICkgKSB7XG5cdFx0XHRcdFx0XHR0b2tlbml6ZXIucG9zIC09IHRva2VuaXplci5kZWxpbWl0ZXJzWyAxIF0ubGVuZ3RoO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdFx0XHRleHByID0gbnVsbDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCAhZXhwciApIHtcblx0XHRcdFx0XHR0eXBlID0gZ2V0TXVzdGFjaGVUeXBlKCB0b2tlbml6ZXIgKTtcblx0XHRcdFx0XHRpZiAoIHR5cGUgPT09IHR5cGVzLlRSSVBMRSApIHtcblx0XHRcdFx0XHRcdG11c3RhY2hlID0ge1xuXHRcdFx0XHRcdFx0XHR0eXBlOiB0eXBlcy5UUklQTEVcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdG11c3RhY2hlLm11c3RhY2hlVHlwZSA9IHR5cGUgfHwgdHlwZXMuSU5URVJQT0xBVE9SO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIHR5cGUgPT09IHR5cGVzLkNPTU1FTlQgfHwgdHlwZSA9PT0gdHlwZXMuQ0xPU0lORyApIHtcblx0XHRcdFx0XHRcdHJlbWFpbmluZyA9IHRva2VuaXplci5yZW1haW5pbmcoKTtcblx0XHRcdFx0XHRcdGluZGV4ID0gcmVtYWluaW5nLmluZGV4T2YoIHRva2VuaXplci5kZWxpbWl0ZXJzWyAxIF0gKTtcblx0XHRcdFx0XHRcdGlmICggaW5kZXggIT09IC0xICkge1xuXHRcdFx0XHRcdFx0XHRtdXN0YWNoZS5yZWYgPSByZW1haW5pbmcuc3Vic3RyKCAwLCBpbmRleCApO1xuXHRcdFx0XHRcdFx0XHR0b2tlbml6ZXIucG9zICs9IGluZGV4O1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gbXVzdGFjaGU7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoICFleHByICkge1xuXHRcdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRcdGV4cHIgPSB0b2tlbml6ZXIuZ2V0RXhwcmVzc2lvbigpO1xuXHRcdFx0XHRyZW1haW5pbmcgPSB0b2tlbml6ZXIucmVtYWluaW5nKCk7XG5cdFx0XHRcdGRlbGltaXRlciA9IGlzVHJpcGxlID8gdG9rZW5pemVyLnRyaXBsZURlbGltaXRlcnNbIDEgXSA6IHRva2VuaXplci5kZWxpbWl0ZXJzWyAxIF07XG5cdFx0XHRcdGlmICggcmVtYWluaW5nLnN1YnN0ciggMCwgZGVsaW1pdGVyLmxlbmd0aCApICE9PSBkZWxpbWl0ZXIgJiYgcmVtYWluaW5nLmNoYXJBdCggMCApICE9PSAnOicgKSB7XG5cdFx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRcdHJlbWFpbmluZyA9IHRva2VuaXplci5yZW1haW5pbmcoKTtcblx0XHRcdFx0XHRpbmRleCA9IHJlbWFpbmluZy5pbmRleE9mKCB0b2tlbml6ZXIuZGVsaW1pdGVyc1sgMSBdICk7XG5cdFx0XHRcdFx0aWYgKCBpbmRleCAhPT0gLTEgKSB7XG5cdFx0XHRcdFx0XHRtdXN0YWNoZS5yZWYgPSByZW1haW5pbmcuc3Vic3RyKCAwLCBpbmRleCApLnRyaW0oKTtcblx0XHRcdFx0XHRcdHRva2VuaXplci5wb3MgKz0gaW5kZXg7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbXVzdGFjaGU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR3aGlsZSAoIGV4cHIudCA9PT0gdHlwZXMuQlJBQ0tFVEVEICYmIGV4cHIueCApIHtcblx0XHRcdFx0ZXhwciA9IGV4cHIueDtcblx0XHRcdH1cblx0XHRcdGlmICggZXhwci50ID09PSB0eXBlcy5SRUZFUkVOQ0UgKSB7XG5cdFx0XHRcdG11c3RhY2hlLnJlZiA9IGV4cHIubjtcblx0XHRcdH0gZWxzZSBpZiAoIGV4cHIudCA9PT0gdHlwZXMuTlVNQkVSX0xJVEVSQUwgJiYgYXJyYXlNZW1iZXIudGVzdCggZXhwci52ICkgKSB7XG5cdFx0XHRcdG11c3RhY2hlLnJlZiA9IGV4cHIudjtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG11c3RhY2hlLmV4cHJlc3Npb24gPSBleHByO1xuXHRcdFx0fVxuXHRcdFx0aSA9IGdldEluZGV4UmVmKCB0b2tlbml6ZXIgKTtcblx0XHRcdGlmICggaSAhPT0gbnVsbCApIHtcblx0XHRcdFx0bXVzdGFjaGUuaW5kZXhSZWYgPSBpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG11c3RhY2hlO1xuXHRcdH07XG5cdH0oIGNvbmZpZ190eXBlcywgcGFyc2VfVG9rZW5pemVyX3V0aWxzX21ha2VSZWdleE1hdGNoZXIsIHBhcnNlX1Rva2VuaXplcl9nZXRNdXN0YWNoZV9nZXRNdXN0YWNoZVR5cGUgKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX2dldE11c3RhY2hlX19nZXRNdXN0YWNoZSA9IGZ1bmN0aW9uKCB0eXBlcywgZ2V0RGVsaW1pdGVyQ2hhbmdlLCBnZXRNdXN0YWNoZUNvbnRlbnQgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgc2Vla1RyaXBsZUZpcnN0ID0gdGhpcy50cmlwbGVEZWxpbWl0ZXJzWyAwIF0ubGVuZ3RoID4gdGhpcy5kZWxpbWl0ZXJzWyAwIF0ubGVuZ3RoO1xuXHRcdFx0cmV0dXJuIGdldE11c3RhY2hlKCB0aGlzLCBzZWVrVHJpcGxlRmlyc3QgKSB8fCBnZXRNdXN0YWNoZSggdGhpcywgIXNlZWtUcmlwbGVGaXJzdCApO1xuXHRcdH07XG5cblx0XHRmdW5jdGlvbiBnZXRNdXN0YWNoZSggdG9rZW5pemVyLCBzZWVrVHJpcGxlICkge1xuXHRcdFx0dmFyIHN0YXJ0ID0gdG9rZW5pemVyLnBvcyxcblx0XHRcdFx0Y29udGVudCwgZGVsaW1pdGVycztcblx0XHRcdGRlbGltaXRlcnMgPSBzZWVrVHJpcGxlID8gdG9rZW5pemVyLnRyaXBsZURlbGltaXRlcnMgOiB0b2tlbml6ZXIuZGVsaW1pdGVycztcblx0XHRcdGlmICggIXRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggZGVsaW1pdGVyc1sgMCBdICkgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0Y29udGVudCA9IGdldERlbGltaXRlckNoYW5nZSggdG9rZW5pemVyICk7XG5cdFx0XHRpZiAoIGNvbnRlbnQgKSB7XG5cdFx0XHRcdGlmICggIXRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggZGVsaW1pdGVyc1sgMSBdICkgKSB7XG5cdFx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRva2VuaXplclsgc2Vla1RyaXBsZSA/ICd0cmlwbGVEZWxpbWl0ZXJzJyA6ICdkZWxpbWl0ZXJzJyBdID0gY29udGVudDtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHR0eXBlOiB0eXBlcy5NVVNUQUNIRSxcblx0XHRcdFx0XHRtdXN0YWNoZVR5cGU6IHR5cGVzLkRFTElNQ0hBTkdFXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRjb250ZW50ID0gZ2V0TXVzdGFjaGVDb250ZW50KCB0b2tlbml6ZXIsIHNlZWtUcmlwbGUgKTtcblx0XHRcdGlmICggY29udGVudCA9PT0gbnVsbCApIHtcblx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdGlmICggIXRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggZGVsaW1pdGVyc1sgMSBdICkgKSB7XG5cdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gY29udGVudDtcblx0XHR9XG5cdH0oIGNvbmZpZ190eXBlcywgcGFyc2VfVG9rZW5pemVyX2dldE11c3RhY2hlX2dldERlbGltaXRlckNoYW5nZSwgcGFyc2VfVG9rZW5pemVyX2dldE11c3RhY2hlX2dldE11c3RhY2hlQ29udGVudCApO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfZ2V0Q29tbWVudF9nZXRDb21tZW50ID0gZnVuY3Rpb24oIHR5cGVzICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIGNvbnRlbnQsIHJlbWFpbmluZywgZW5kSW5kZXg7XG5cdFx0XHRpZiAoICF0aGlzLmdldFN0cmluZ01hdGNoKCAnPCEtLScgKSApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRyZW1haW5pbmcgPSB0aGlzLnJlbWFpbmluZygpO1xuXHRcdFx0ZW5kSW5kZXggPSByZW1haW5pbmcuaW5kZXhPZiggJy0tPicgKTtcblx0XHRcdGlmICggZW5kSW5kZXggPT09IC0xICkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdVbmV4cGVjdGVkIGVuZCBvZiBpbnB1dCAoZXhwZWN0ZWQgXCItLT5cIiB0byBjbG9zZSBjb21tZW50KScgKTtcblx0XHRcdH1cblx0XHRcdGNvbnRlbnQgPSByZW1haW5pbmcuc3Vic3RyKCAwLCBlbmRJbmRleCApO1xuXHRcdFx0dGhpcy5wb3MgKz0gZW5kSW5kZXggKyAzO1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0dHlwZTogdHlwZXMuQ09NTUVOVCxcblx0XHRcdFx0Y29udGVudDogY29udGVudFxuXHRcdFx0fTtcblx0XHR9O1xuXHR9KCBjb25maWdfdHlwZXMgKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX3V0aWxzX2dldExvd2VzdEluZGV4ID0gZnVuY3Rpb24oIGhheXN0YWNrLCBuZWVkbGVzICkge1xuXHRcdHZhciBpLCBpbmRleCwgbG93ZXN0O1xuXHRcdGkgPSBuZWVkbGVzLmxlbmd0aDtcblx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdGluZGV4ID0gaGF5c3RhY2suaW5kZXhPZiggbmVlZGxlc1sgaSBdICk7XG5cdFx0XHRpZiAoICFpbmRleCApIHtcblx0XHRcdFx0cmV0dXJuIDA7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGluZGV4ID09PSAtMSApIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICFsb3dlc3QgfHwgaW5kZXggPCBsb3dlc3QgKSB7XG5cdFx0XHRcdGxvd2VzdCA9IGluZGV4O1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gbG93ZXN0IHx8IC0xO1xuXHR9O1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfZ2V0VGFnX19nZXRUYWcgPSBmdW5jdGlvbiggdHlwZXMsIG1ha2VSZWdleE1hdGNoZXIsIGdldExvd2VzdEluZGV4ICkge1xuXG5cdFx0dmFyIGdldFRhZywgZ2V0T3BlbmluZ1RhZywgZ2V0Q2xvc2luZ1RhZywgZ2V0VGFnTmFtZSwgZ2V0QXR0cmlidXRlcywgZ2V0QXR0cmlidXRlLCBnZXRBdHRyaWJ1dGVOYW1lLCBnZXRBdHRyaWJ1dGVWYWx1ZSwgZ2V0VW5xdW90ZWRBdHRyaWJ1dGVWYWx1ZSwgZ2V0VW5xdW90ZWRBdHRyaWJ1dGVWYWx1ZVRva2VuLCBnZXRVbnF1b3RlZEF0dHJpYnV0ZVZhbHVlVGV4dCwgZ2V0UXVvdGVkU3RyaW5nVG9rZW4sIGdldFF1b3RlZEF0dHJpYnV0ZVZhbHVlO1xuXHRcdGdldFRhZyA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIGdldE9wZW5pbmdUYWcoIHRoaXMgKSB8fCBnZXRDbG9zaW5nVGFnKCB0aGlzICk7XG5cdFx0fTtcblx0XHRnZXRPcGVuaW5nVGFnID0gZnVuY3Rpb24oIHRva2VuaXplciApIHtcblx0XHRcdHZhciBzdGFydCwgdGFnLCBhdHRycywgbG93ZXJDYXNlTmFtZTtcblx0XHRcdHN0YXJ0ID0gdG9rZW5pemVyLnBvcztcblx0XHRcdGlmICggdG9rZW5pemVyLmluc2lkZSApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICF0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICc8JyApICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHRhZyA9IHtcblx0XHRcdFx0dHlwZTogdHlwZXMuVEFHXG5cdFx0XHR9O1xuXHRcdFx0aWYgKCB0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICchJyApICkge1xuXHRcdFx0XHR0YWcuZG9jdHlwZSA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHR0YWcubmFtZSA9IGdldFRhZ05hbWUoIHRva2VuaXplciApO1xuXHRcdFx0aWYgKCAhdGFnLm5hbWUgKSB7XG5cdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRhdHRycyA9IGdldEF0dHJpYnV0ZXMoIHRva2VuaXplciApO1xuXHRcdFx0aWYgKCBhdHRycyApIHtcblx0XHRcdFx0dGFnLmF0dHJzID0gYXR0cnM7XG5cdFx0XHR9XG5cdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRpZiAoIHRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJy8nICkgKSB7XG5cdFx0XHRcdHRhZy5zZWxmQ2xvc2luZyA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICF0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICc+JyApICkge1xuXHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0bG93ZXJDYXNlTmFtZSA9IHRhZy5uYW1lLnRvTG93ZXJDYXNlKCk7XG5cdFx0XHRpZiAoIGxvd2VyQ2FzZU5hbWUgPT09ICdzY3JpcHQnIHx8IGxvd2VyQ2FzZU5hbWUgPT09ICdzdHlsZScgKSB7XG5cdFx0XHRcdHRva2VuaXplci5pbnNpZGUgPSBsb3dlckNhc2VOYW1lO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRhZztcblx0XHR9O1xuXHRcdGdldENsb3NpbmdUYWcgPSBmdW5jdGlvbiggdG9rZW5pemVyICkge1xuXHRcdFx0dmFyIHN0YXJ0LCB0YWcsIGV4cGVjdGVkO1xuXHRcdFx0c3RhcnQgPSB0b2tlbml6ZXIucG9zO1xuXHRcdFx0ZXhwZWN0ZWQgPSBmdW5jdGlvbiggc3RyICkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdVbmV4cGVjdGVkIGNoYXJhY3RlciAnICsgdG9rZW5pemVyLnJlbWFpbmluZygpLmNoYXJBdCggMCApICsgJyAoZXhwZWN0ZWQgJyArIHN0ciArICcpJyApO1xuXHRcdFx0fTtcblx0XHRcdGlmICggIXRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJzwnICkgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0dGFnID0ge1xuXHRcdFx0XHR0eXBlOiB0eXBlcy5UQUcsXG5cdFx0XHRcdGNsb3Npbmc6IHRydWVcblx0XHRcdH07XG5cdFx0XHRpZiAoICF0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICcvJyApICkge1xuXHRcdFx0XHRleHBlY3RlZCggJ1wiL1wiJyApO1xuXHRcdFx0fVxuXHRcdFx0dGFnLm5hbWUgPSBnZXRUYWdOYW1lKCB0b2tlbml6ZXIgKTtcblx0XHRcdGlmICggIXRhZy5uYW1lICkge1xuXHRcdFx0XHRleHBlY3RlZCggJ3RhZyBuYW1lJyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnPicgKSApIHtcblx0XHRcdFx0ZXhwZWN0ZWQoICdcIj5cIicgKTtcblx0XHRcdH1cblx0XHRcdGlmICggdG9rZW5pemVyLmluc2lkZSApIHtcblx0XHRcdFx0aWYgKCB0YWcubmFtZS50b0xvd2VyQ2FzZSgpICE9PSB0b2tlbml6ZXIuaW5zaWRlICkge1xuXHRcdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHR0b2tlbml6ZXIuaW5zaWRlID0gbnVsbDtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0YWc7XG5cdFx0fTtcblx0XHRnZXRUYWdOYW1lID0gbWFrZVJlZ2V4TWF0Y2hlciggL15bYS16QS1aXXsxLH06P1thLXpBLVowLTlcXC1dKi8gKTtcblx0XHRnZXRBdHRyaWJ1dGVzID0gZnVuY3Rpb24oIHRva2VuaXplciApIHtcblx0XHRcdHZhciBzdGFydCwgYXR0cnMsIGF0dHI7XG5cdFx0XHRzdGFydCA9IHRva2VuaXplci5wb3M7XG5cdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRhdHRyID0gZ2V0QXR0cmlidXRlKCB0b2tlbml6ZXIgKTtcblx0XHRcdGlmICggIWF0dHIgKSB7XG5cdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRhdHRycyA9IFtdO1xuXHRcdFx0d2hpbGUgKCBhdHRyICE9PSBudWxsICkge1xuXHRcdFx0XHRhdHRycy5wdXNoKCBhdHRyICk7XG5cdFx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdFx0YXR0ciA9IGdldEF0dHJpYnV0ZSggdG9rZW5pemVyICk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gYXR0cnM7XG5cdFx0fTtcblx0XHRnZXRBdHRyaWJ1dGUgPSBmdW5jdGlvbiggdG9rZW5pemVyICkge1xuXHRcdFx0dmFyIGF0dHIsIG5hbWUsIHZhbHVlO1xuXHRcdFx0bmFtZSA9IGdldEF0dHJpYnV0ZU5hbWUoIHRva2VuaXplciApO1xuXHRcdFx0aWYgKCAhbmFtZSApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRhdHRyID0ge1xuXHRcdFx0XHRuYW1lOiBuYW1lXG5cdFx0XHR9O1xuXHRcdFx0dmFsdWUgPSBnZXRBdHRyaWJ1dGVWYWx1ZSggdG9rZW5pemVyICk7XG5cdFx0XHRpZiAoIHZhbHVlICkge1xuXHRcdFx0XHRhdHRyLnZhbHVlID0gdmFsdWU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gYXR0cjtcblx0XHR9O1xuXHRcdGdldEF0dHJpYnV0ZU5hbWUgPSBtYWtlUmVnZXhNYXRjaGVyKCAvXlteXFxzXCInPlxcLz1dKy8gKTtcblx0XHRnZXRBdHRyaWJ1dGVWYWx1ZSA9IGZ1bmN0aW9uKCB0b2tlbml6ZXIgKSB7XG5cdFx0XHR2YXIgc3RhcnQsIHZhbHVlO1xuXHRcdFx0c3RhcnQgPSB0b2tlbml6ZXIucG9zO1xuXHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0aWYgKCAhdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnPScgKSApIHtcblx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdHZhbHVlID0gZ2V0UXVvdGVkQXR0cmlidXRlVmFsdWUoIHRva2VuaXplciwgJ1xcJycgKSB8fCBnZXRRdW90ZWRBdHRyaWJ1dGVWYWx1ZSggdG9rZW5pemVyLCAnXCInICkgfHwgZ2V0VW5xdW90ZWRBdHRyaWJ1dGVWYWx1ZSggdG9rZW5pemVyICk7XG5cdFx0XHRpZiAoIHZhbHVlID09PSBudWxsICkge1xuXHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdH07XG5cdFx0Z2V0VW5xdW90ZWRBdHRyaWJ1dGVWYWx1ZVRleHQgPSBtYWtlUmVnZXhNYXRjaGVyKCAvXlteXFxzXCInPTw+YF0rLyApO1xuXHRcdGdldFVucXVvdGVkQXR0cmlidXRlVmFsdWVUb2tlbiA9IGZ1bmN0aW9uKCB0b2tlbml6ZXIgKSB7XG5cdFx0XHR2YXIgc3RhcnQsIHRleHQsIGluZGV4O1xuXHRcdFx0c3RhcnQgPSB0b2tlbml6ZXIucG9zO1xuXHRcdFx0dGV4dCA9IGdldFVucXVvdGVkQXR0cmlidXRlVmFsdWVUZXh0KCB0b2tlbml6ZXIgKTtcblx0XHRcdGlmICggIXRleHQgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAoIGluZGV4ID0gdGV4dC5pbmRleE9mKCB0b2tlbml6ZXIuZGVsaW1pdGVyc1sgMCBdICkgKSAhPT0gLTEgKSB7XG5cdFx0XHRcdHRleHQgPSB0ZXh0LnN1YnN0ciggMCwgaW5kZXggKTtcblx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0ICsgdGV4dC5sZW5ndGg7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR0eXBlOiB0eXBlcy5URVhULFxuXHRcdFx0XHR2YWx1ZTogdGV4dFxuXHRcdFx0fTtcblx0XHR9O1xuXHRcdGdldFVucXVvdGVkQXR0cmlidXRlVmFsdWUgPSBmdW5jdGlvbiggdG9rZW5pemVyICkge1xuXHRcdFx0dmFyIHRva2VucywgdG9rZW47XG5cdFx0XHR0b2tlbnMgPSBbXTtcblx0XHRcdHRva2VuID0gdG9rZW5pemVyLmdldE11c3RhY2hlKCkgfHwgZ2V0VW5xdW90ZWRBdHRyaWJ1dGVWYWx1ZVRva2VuKCB0b2tlbml6ZXIgKTtcblx0XHRcdHdoaWxlICggdG9rZW4gIT09IG51bGwgKSB7XG5cdFx0XHRcdHRva2Vucy5wdXNoKCB0b2tlbiApO1xuXHRcdFx0XHR0b2tlbiA9IHRva2VuaXplci5nZXRNdXN0YWNoZSgpIHx8IGdldFVucXVvdGVkQXR0cmlidXRlVmFsdWVUb2tlbiggdG9rZW5pemVyICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICF0b2tlbnMubGVuZ3RoICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0b2tlbnM7XG5cdFx0fTtcblx0XHRnZXRRdW90ZWRBdHRyaWJ1dGVWYWx1ZSA9IGZ1bmN0aW9uKCB0b2tlbml6ZXIsIHF1b3RlTWFyayApIHtcblx0XHRcdHZhciBzdGFydCwgdG9rZW5zLCB0b2tlbjtcblx0XHRcdHN0YXJ0ID0gdG9rZW5pemVyLnBvcztcblx0XHRcdGlmICggIXRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggcXVvdGVNYXJrICkgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0dG9rZW5zID0gW107XG5cdFx0XHR0b2tlbiA9IHRva2VuaXplci5nZXRNdXN0YWNoZSgpIHx8IGdldFF1b3RlZFN0cmluZ1Rva2VuKCB0b2tlbml6ZXIsIHF1b3RlTWFyayApO1xuXHRcdFx0d2hpbGUgKCB0b2tlbiAhPT0gbnVsbCApIHtcblx0XHRcdFx0dG9rZW5zLnB1c2goIHRva2VuICk7XG5cdFx0XHRcdHRva2VuID0gdG9rZW5pemVyLmdldE11c3RhY2hlKCkgfHwgZ2V0UXVvdGVkU3RyaW5nVG9rZW4oIHRva2VuaXplciwgcXVvdGVNYXJrICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICF0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goIHF1b3RlTWFyayApICkge1xuXHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRva2Vucztcblx0XHR9O1xuXHRcdGdldFF1b3RlZFN0cmluZ1Rva2VuID0gZnVuY3Rpb24oIHRva2VuaXplciwgcXVvdGVNYXJrICkge1xuXHRcdFx0dmFyIHN0YXJ0LCBpbmRleCwgcmVtYWluaW5nO1xuXHRcdFx0c3RhcnQgPSB0b2tlbml6ZXIucG9zO1xuXHRcdFx0cmVtYWluaW5nID0gdG9rZW5pemVyLnJlbWFpbmluZygpO1xuXHRcdFx0aW5kZXggPSBnZXRMb3dlc3RJbmRleCggcmVtYWluaW5nLCBbXG5cdFx0XHRcdHF1b3RlTWFyayxcblx0XHRcdFx0dG9rZW5pemVyLmRlbGltaXRlcnNbIDAgXSxcblx0XHRcdFx0dG9rZW5pemVyLmRlbGltaXRlcnNbIDEgXVxuXHRcdFx0XSApO1xuXHRcdFx0aWYgKCBpbmRleCA9PT0gLTEgKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ1F1b3RlZCBhdHRyaWJ1dGUgdmFsdWUgbXVzdCBoYXZlIGEgY2xvc2luZyBxdW90ZScgKTtcblx0XHRcdH1cblx0XHRcdGlmICggIWluZGV4ICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHRva2VuaXplci5wb3MgKz0gaW5kZXg7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR0eXBlOiB0eXBlcy5URVhULFxuXHRcdFx0XHR2YWx1ZTogcmVtYWluaW5nLnN1YnN0ciggMCwgaW5kZXggKVxuXHRcdFx0fTtcblx0XHR9O1xuXHRcdHJldHVybiBnZXRUYWc7XG5cdH0oIGNvbmZpZ190eXBlcywgcGFyc2VfVG9rZW5pemVyX3V0aWxzX21ha2VSZWdleE1hdGNoZXIsIHBhcnNlX1Rva2VuaXplcl91dGlsc19nZXRMb3dlc3RJbmRleCApO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfZ2V0VGV4dF9fZ2V0VGV4dCA9IGZ1bmN0aW9uKCB0eXBlcywgZ2V0TG93ZXN0SW5kZXggKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgaW5kZXgsIHJlbWFpbmluZywgYmFycmllcjtcblx0XHRcdHJlbWFpbmluZyA9IHRoaXMucmVtYWluaW5nKCk7XG5cdFx0XHRiYXJyaWVyID0gdGhpcy5pbnNpZGUgPyAnPC8nICsgdGhpcy5pbnNpZGUgOiAnPCc7XG5cdFx0XHRpZiAoIHRoaXMuaW5zaWRlICYmICF0aGlzLmludGVycG9sYXRlWyB0aGlzLmluc2lkZSBdICkge1xuXHRcdFx0XHRpbmRleCA9IHJlbWFpbmluZy5pbmRleE9mKCBiYXJyaWVyICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpbmRleCA9IGdldExvd2VzdEluZGV4KCByZW1haW5pbmcsIFtcblx0XHRcdFx0XHRiYXJyaWVyLFxuXHRcdFx0XHRcdHRoaXMuZGVsaW1pdGVyc1sgMCBdLFxuXHRcdFx0XHRcdHRoaXMudHJpcGxlRGVsaW1pdGVyc1sgMCBdXG5cdFx0XHRcdF0gKTtcblx0XHRcdH1cblx0XHRcdGlmICggIWluZGV4ICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGlmICggaW5kZXggPT09IC0xICkge1xuXHRcdFx0XHRpbmRleCA9IHJlbWFpbmluZy5sZW5ndGg7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnBvcyArPSBpbmRleDtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHR5cGU6IHR5cGVzLlRFWFQsXG5cdFx0XHRcdHZhbHVlOiByZW1haW5pbmcuc3Vic3RyKCAwLCBpbmRleCApXG5cdFx0XHR9O1xuXHRcdH07XG5cdH0oIGNvbmZpZ190eXBlcywgcGFyc2VfVG9rZW5pemVyX3V0aWxzX2dldExvd2VzdEluZGV4ICk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfZ2V0TGl0ZXJhbF9nZXRCb29sZWFuTGl0ZXJhbCA9IGZ1bmN0aW9uKCB0eXBlcyApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggdG9rZW5pemVyICkge1xuXHRcdFx0dmFyIHJlbWFpbmluZyA9IHRva2VuaXplci5yZW1haW5pbmcoKTtcblx0XHRcdGlmICggcmVtYWluaW5nLnN1YnN0ciggMCwgNCApID09PSAndHJ1ZScgKSB7XG5cdFx0XHRcdHRva2VuaXplci5wb3MgKz0gNDtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHR0OiB0eXBlcy5CT09MRUFOX0xJVEVSQUwsXG5cdFx0XHRcdFx0djogJ3RydWUnXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHJlbWFpbmluZy5zdWJzdHIoIDAsIDUgKSA9PT0gJ2ZhbHNlJyApIHtcblx0XHRcdFx0dG9rZW5pemVyLnBvcyArPSA1O1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHQ6IHR5cGVzLkJPT0xFQU5fTElURVJBTCxcblx0XHRcdFx0XHR2OiAnZmFsc2UnXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9O1xuXHR9KCBjb25maWdfdHlwZXMgKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9nZXRMaXRlcmFsX2dldE9iamVjdExpdGVyYWxfZ2V0S2V5VmFsdWVQYWlyID0gZnVuY3Rpb24oIHR5cGVzLCBnZXRLZXkgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHRva2VuaXplciApIHtcblx0XHRcdHZhciBzdGFydCwga2V5LCB2YWx1ZTtcblx0XHRcdHN0YXJ0ID0gdG9rZW5pemVyLnBvcztcblx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdGtleSA9IGdldEtleSggdG9rZW5pemVyICk7XG5cdFx0XHRpZiAoIGtleSA9PT0gbnVsbCApIHtcblx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdGlmICggIXRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJzonICkgKSB7XG5cdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHR2YWx1ZSA9IHRva2VuaXplci5nZXRFeHByZXNzaW9uKCk7XG5cdFx0XHRpZiAoIHZhbHVlID09PSBudWxsICkge1xuXHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0dDogdHlwZXMuS0VZX1ZBTFVFX1BBSVIsXG5cdFx0XHRcdGs6IGtleSxcblx0XHRcdFx0djogdmFsdWVcblx0XHRcdH07XG5cdFx0fTtcblx0fSggY29uZmlnX3R5cGVzLCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9zaGFyZWRfZ2V0S2V5ICk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfZ2V0TGl0ZXJhbF9nZXRPYmplY3RMaXRlcmFsX2dldEtleVZhbHVlUGFpcnMgPSBmdW5jdGlvbiggZ2V0S2V5VmFsdWVQYWlyICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uIGdldEtleVZhbHVlUGFpcnMoIHRva2VuaXplciApIHtcblx0XHRcdHZhciBzdGFydCwgcGFpcnMsIHBhaXIsIGtleVZhbHVlUGFpcnM7XG5cdFx0XHRzdGFydCA9IHRva2VuaXplci5wb3M7XG5cdFx0XHRwYWlyID0gZ2V0S2V5VmFsdWVQYWlyKCB0b2tlbml6ZXIgKTtcblx0XHRcdGlmICggcGFpciA9PT0gbnVsbCApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRwYWlycyA9IFsgcGFpciBdO1xuXHRcdFx0aWYgKCB0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICcsJyApICkge1xuXHRcdFx0XHRrZXlWYWx1ZVBhaXJzID0gZ2V0S2V5VmFsdWVQYWlycyggdG9rZW5pemVyICk7XG5cdFx0XHRcdGlmICggIWtleVZhbHVlUGFpcnMgKSB7XG5cdFx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBwYWlycy5jb25jYXQoIGtleVZhbHVlUGFpcnMgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBwYWlycztcblx0XHR9O1xuXHR9KCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X2dldExpdGVyYWxfZ2V0T2JqZWN0TGl0ZXJhbF9nZXRLZXlWYWx1ZVBhaXIgKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9nZXRMaXRlcmFsX2dldE9iamVjdExpdGVyYWxfX2dldE9iamVjdExpdGVyYWwgPSBmdW5jdGlvbiggdHlwZXMsIGdldEtleVZhbHVlUGFpcnMgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHRva2VuaXplciApIHtcblx0XHRcdHZhciBzdGFydCwga2V5VmFsdWVQYWlycztcblx0XHRcdHN0YXJ0ID0gdG9rZW5pemVyLnBvcztcblx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdGlmICggIXRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJ3snICkgKSB7XG5cdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRrZXlWYWx1ZVBhaXJzID0gZ2V0S2V5VmFsdWVQYWlycyggdG9rZW5pemVyICk7XG5cdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRpZiAoICF0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICd9JyApICkge1xuXHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0dDogdHlwZXMuT0JKRUNUX0xJVEVSQUwsXG5cdFx0XHRcdG06IGtleVZhbHVlUGFpcnNcblx0XHRcdH07XG5cdFx0fTtcblx0fSggY29uZmlnX3R5cGVzLCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X2dldExpdGVyYWxfZ2V0T2JqZWN0TGl0ZXJhbF9nZXRLZXlWYWx1ZVBhaXJzICk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX3NoYXJlZF9nZXRFeHByZXNzaW9uTGlzdCA9IGZ1bmN0aW9uIGdldEV4cHJlc3Npb25MaXN0KCB0b2tlbml6ZXIgKSB7XG5cdFx0dmFyIHN0YXJ0LCBleHByZXNzaW9ucywgZXhwciwgbmV4dDtcblx0XHRzdGFydCA9IHRva2VuaXplci5wb3M7XG5cdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdGV4cHIgPSB0b2tlbml6ZXIuZ2V0RXhwcmVzc2lvbigpO1xuXHRcdGlmICggZXhwciA9PT0gbnVsbCApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRleHByZXNzaW9ucyA9IFsgZXhwciBdO1xuXHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRpZiAoIHRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJywnICkgKSB7XG5cdFx0XHRuZXh0ID0gZ2V0RXhwcmVzc2lvbkxpc3QoIHRva2VuaXplciApO1xuXHRcdFx0aWYgKCBuZXh0ID09PSBudWxsICkge1xuXHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0ZXhwcmVzc2lvbnMgPSBleHByZXNzaW9ucy5jb25jYXQoIG5leHQgKTtcblx0XHR9XG5cdFx0cmV0dXJuIGV4cHJlc3Npb25zO1xuXHR9O1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X2dldExpdGVyYWxfZ2V0QXJyYXlMaXRlcmFsID0gZnVuY3Rpb24oIHR5cGVzLCBnZXRFeHByZXNzaW9uTGlzdCApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggdG9rZW5pemVyICkge1xuXHRcdFx0dmFyIHN0YXJ0LCBleHByZXNzaW9uTGlzdDtcblx0XHRcdHN0YXJ0ID0gdG9rZW5pemVyLnBvcztcblx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdGlmICggIXRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJ1snICkgKSB7XG5cdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRleHByZXNzaW9uTGlzdCA9IGdldEV4cHJlc3Npb25MaXN0KCB0b2tlbml6ZXIgKTtcblx0XHRcdGlmICggIXRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJ10nICkgKSB7XG5cdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR0OiB0eXBlcy5BUlJBWV9MSVRFUkFMLFxuXHRcdFx0XHRtOiBleHByZXNzaW9uTGlzdFxuXHRcdFx0fTtcblx0XHR9O1xuXHR9KCBjb25maWdfdHlwZXMsIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX3NoYXJlZF9nZXRFeHByZXNzaW9uTGlzdCApO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X2dldExpdGVyYWxfX2dldExpdGVyYWwgPSBmdW5jdGlvbiggZ2V0TnVtYmVyTGl0ZXJhbCwgZ2V0Qm9vbGVhbkxpdGVyYWwsIGdldFN0cmluZ0xpdGVyYWwsIGdldE9iamVjdExpdGVyYWwsIGdldEFycmF5TGl0ZXJhbCApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggdG9rZW5pemVyICkge1xuXHRcdFx0dmFyIGxpdGVyYWwgPSBnZXROdW1iZXJMaXRlcmFsKCB0b2tlbml6ZXIgKSB8fCBnZXRCb29sZWFuTGl0ZXJhbCggdG9rZW5pemVyICkgfHwgZ2V0U3RyaW5nTGl0ZXJhbCggdG9rZW5pemVyICkgfHwgZ2V0T2JqZWN0TGl0ZXJhbCggdG9rZW5pemVyICkgfHwgZ2V0QXJyYXlMaXRlcmFsKCB0b2tlbml6ZXIgKTtcblx0XHRcdHJldHVybiBsaXRlcmFsO1xuXHRcdH07XG5cdH0oIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfZ2V0TGl0ZXJhbF9nZXROdW1iZXJMaXRlcmFsLCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X2dldExpdGVyYWxfZ2V0Qm9vbGVhbkxpdGVyYWwsIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfZ2V0TGl0ZXJhbF9nZXRTdHJpbmdMaXRlcmFsX19nZXRTdHJpbmdMaXRlcmFsLCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X2dldExpdGVyYWxfZ2V0T2JqZWN0TGl0ZXJhbF9fZ2V0T2JqZWN0TGl0ZXJhbCwgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9nZXRMaXRlcmFsX2dldEFycmF5TGl0ZXJhbCApO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X2dldFJlZmVyZW5jZSA9IGZ1bmN0aW9uKCB0eXBlcywgbWFrZVJlZ2V4TWF0Y2hlciwgZ2V0TmFtZSApIHtcblxuXHRcdHZhciBnZXREb3RSZWZpbmVtZW50LCBnZXRBcnJheVJlZmluZW1lbnQsIGdldEFycmF5TWVtYmVyLCBnbG9iYWxzO1xuXHRcdGdldERvdFJlZmluZW1lbnQgPSBtYWtlUmVnZXhNYXRjaGVyKCAvXlxcLlthLXpBLVpfJDAtOV0rLyApO1xuXHRcdGdldEFycmF5UmVmaW5lbWVudCA9IGZ1bmN0aW9uKCB0b2tlbml6ZXIgKSB7XG5cdFx0XHR2YXIgbnVtID0gZ2V0QXJyYXlNZW1iZXIoIHRva2VuaXplciApO1xuXHRcdFx0aWYgKCBudW0gKSB7XG5cdFx0XHRcdHJldHVybiAnLicgKyBudW07XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9O1xuXHRcdGdldEFycmF5TWVtYmVyID0gbWFrZVJlZ2V4TWF0Y2hlciggL15cXFsoMHxbMS05XVswLTldKilcXF0vICk7XG5cdFx0Z2xvYmFscyA9IC9eKD86QXJyYXl8RGF0ZXxSZWdFeHB8ZGVjb2RlVVJJQ29tcG9uZW50fGRlY29kZVVSSXxlbmNvZGVVUklDb21wb25lbnR8ZW5jb2RlVVJJfGlzRmluaXRlfGlzTmFOfHBhcnNlRmxvYXR8cGFyc2VJbnR8SlNPTnxNYXRofE5hTnx1bmRlZmluZWR8bnVsbCkkLztcblx0XHRyZXR1cm4gZnVuY3Rpb24oIHRva2VuaXplciApIHtcblx0XHRcdHZhciBzdGFydFBvcywgYW5jZXN0b3IsIG5hbWUsIGRvdCwgY29tYm8sIHJlZmluZW1lbnQsIGxhc3REb3RJbmRleDtcblx0XHRcdHN0YXJ0UG9zID0gdG9rZW5pemVyLnBvcztcblx0XHRcdGFuY2VzdG9yID0gJyc7XG5cdFx0XHR3aGlsZSAoIHRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJy4uLycgKSApIHtcblx0XHRcdFx0YW5jZXN0b3IgKz0gJy4uLyc7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICFhbmNlc3RvciApIHtcblx0XHRcdFx0ZG90ID0gdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnLicgKSB8fCAnJztcblx0XHRcdH1cblx0XHRcdG5hbWUgPSBnZXROYW1lKCB0b2tlbml6ZXIgKSB8fCAnJztcblx0XHRcdGlmICggIWFuY2VzdG9yICYmICFkb3QgJiYgZ2xvYmFscy50ZXN0KCBuYW1lICkgKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0dDogdHlwZXMuR0xPQkFMLFxuXHRcdFx0XHRcdHY6IG5hbWVcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHRcdGlmICggbmFtZSA9PT0gJ3RoaXMnICYmICFhbmNlc3RvciAmJiAhZG90ICkge1xuXHRcdFx0XHRuYW1lID0gJy4nO1xuXHRcdFx0XHRzdGFydFBvcyArPSAzO1xuXHRcdFx0fVxuXHRcdFx0Y29tYm8gPSAoIGFuY2VzdG9yIHx8IGRvdCApICsgbmFtZTtcblx0XHRcdGlmICggIWNvbWJvICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHdoaWxlICggcmVmaW5lbWVudCA9IGdldERvdFJlZmluZW1lbnQoIHRva2VuaXplciApIHx8IGdldEFycmF5UmVmaW5lbWVudCggdG9rZW5pemVyICkgKSB7XG5cdFx0XHRcdGNvbWJvICs9IHJlZmluZW1lbnQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJygnICkgKSB7XG5cdFx0XHRcdGxhc3REb3RJbmRleCA9IGNvbWJvLmxhc3RJbmRleE9mKCAnLicgKTtcblx0XHRcdFx0aWYgKCBsYXN0RG90SW5kZXggIT09IC0xICkge1xuXHRcdFx0XHRcdGNvbWJvID0gY29tYm8uc3Vic3RyKCAwLCBsYXN0RG90SW5kZXggKTtcblx0XHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnRQb3MgKyBjb21iby5sZW5ndGg7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dG9rZW5pemVyLnBvcyAtPSAxO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR0OiB0eXBlcy5SRUZFUkVOQ0UsXG5cdFx0XHRcdG46IGNvbWJvXG5cdFx0XHR9O1xuXHRcdH07XG5cdH0oIGNvbmZpZ190eXBlcywgcGFyc2VfVG9rZW5pemVyX3V0aWxzX21ha2VSZWdleE1hdGNoZXIsIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX3NoYXJlZF9nZXROYW1lICk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfZ2V0QnJhY2tldGVkRXhwcmVzc2lvbiA9IGZ1bmN0aW9uKCB0eXBlcyApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggdG9rZW5pemVyICkge1xuXHRcdFx0dmFyIHN0YXJ0LCBleHByO1xuXHRcdFx0c3RhcnQgPSB0b2tlbml6ZXIucG9zO1xuXHRcdFx0aWYgKCAhdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnKCcgKSApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRleHByID0gdG9rZW5pemVyLmdldEV4cHJlc3Npb24oKTtcblx0XHRcdGlmICggIWV4cHIgKSB7XG5cdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRpZiAoICF0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICcpJyApICkge1xuXHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0dDogdHlwZXMuQlJBQ0tFVEVELFxuXHRcdFx0XHR4OiBleHByXG5cdFx0XHR9O1xuXHRcdH07XG5cdH0oIGNvbmZpZ190eXBlcyApO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X19nZXRQcmltYXJ5ID0gZnVuY3Rpb24oIGdldExpdGVyYWwsIGdldFJlZmVyZW5jZSwgZ2V0QnJhY2tldGVkRXhwcmVzc2lvbiApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggdG9rZW5pemVyICkge1xuXHRcdFx0cmV0dXJuIGdldExpdGVyYWwoIHRva2VuaXplciApIHx8IGdldFJlZmVyZW5jZSggdG9rZW5pemVyICkgfHwgZ2V0QnJhY2tldGVkRXhwcmVzc2lvbiggdG9rZW5pemVyICk7XG5cdFx0fTtcblx0fSggcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9nZXRMaXRlcmFsX19nZXRMaXRlcmFsLCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X2dldFJlZmVyZW5jZSwgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9nZXRCcmFja2V0ZWRFeHByZXNzaW9uICk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX3NoYXJlZF9nZXRSZWZpbmVtZW50ID0gZnVuY3Rpb24oIHR5cGVzLCBnZXROYW1lICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uIGdldFJlZmluZW1lbnQoIHRva2VuaXplciApIHtcblx0XHRcdHZhciBzdGFydCwgbmFtZSwgZXhwcjtcblx0XHRcdHN0YXJ0ID0gdG9rZW5pemVyLnBvcztcblx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdGlmICggdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnLicgKSApIHtcblx0XHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0XHRpZiAoIG5hbWUgPSBnZXROYW1lKCB0b2tlbml6ZXIgKSApIHtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0dDogdHlwZXMuUkVGSU5FTUVOVCxcblx0XHRcdFx0XHRcdG46IG5hbWVcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRva2VuaXplci5leHBlY3RlZCggJ2EgcHJvcGVydHkgbmFtZScgKTtcblx0XHRcdH1cblx0XHRcdGlmICggdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnWycgKSApIHtcblx0XHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0XHRleHByID0gdG9rZW5pemVyLmdldEV4cHJlc3Npb24oKTtcblx0XHRcdFx0aWYgKCAhZXhwciApIHtcblx0XHRcdFx0XHR0b2tlbml6ZXIuZXhwZWN0ZWQoICdhbiBleHByZXNzaW9uJyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdFx0aWYgKCAhdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnXScgKSApIHtcblx0XHRcdFx0XHR0b2tlbml6ZXIuZXhwZWN0ZWQoICdcIl1cIicgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHQ6IHR5cGVzLlJFRklORU1FTlQsXG5cdFx0XHRcdFx0eDogZXhwclxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fTtcblx0fSggY29uZmlnX3R5cGVzLCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9zaGFyZWRfZ2V0TmFtZSApO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRNZW1iZXJPckludm9jYXRpb24gPSBmdW5jdGlvbiggdHlwZXMsIGdldFByaW1hcnksIGdldEV4cHJlc3Npb25MaXN0LCBnZXRSZWZpbmVtZW50ICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB0b2tlbml6ZXIgKSB7XG5cdFx0XHR2YXIgY3VycmVudCwgZXhwcmVzc2lvbiwgcmVmaW5lbWVudCwgZXhwcmVzc2lvbkxpc3Q7XG5cdFx0XHRleHByZXNzaW9uID0gZ2V0UHJpbWFyeSggdG9rZW5pemVyICk7XG5cdFx0XHRpZiAoICFleHByZXNzaW9uICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHdoaWxlICggZXhwcmVzc2lvbiApIHtcblx0XHRcdFx0Y3VycmVudCA9IHRva2VuaXplci5wb3M7XG5cdFx0XHRcdGlmICggcmVmaW5lbWVudCA9IGdldFJlZmluZW1lbnQoIHRva2VuaXplciApICkge1xuXHRcdFx0XHRcdGV4cHJlc3Npb24gPSB7XG5cdFx0XHRcdFx0XHR0OiB0eXBlcy5NRU1CRVIsXG5cdFx0XHRcdFx0XHR4OiBleHByZXNzaW9uLFxuXHRcdFx0XHRcdFx0cjogcmVmaW5lbWVudFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0gZWxzZSBpZiAoIHRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJygnICkgKSB7XG5cdFx0XHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0XHRcdGV4cHJlc3Npb25MaXN0ID0gZ2V0RXhwcmVzc2lvbkxpc3QoIHRva2VuaXplciApO1xuXHRcdFx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdFx0XHRpZiAoICF0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICcpJyApICkge1xuXHRcdFx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IGN1cnJlbnQ7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZXhwcmVzc2lvbiA9IHtcblx0XHRcdFx0XHRcdHQ6IHR5cGVzLklOVk9DQVRJT04sXG5cdFx0XHRcdFx0XHR4OiBleHByZXNzaW9uXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRpZiAoIGV4cHJlc3Npb25MaXN0ICkge1xuXHRcdFx0XHRcdFx0ZXhwcmVzc2lvbi5vID0gZXhwcmVzc2lvbkxpc3Q7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZXhwcmVzc2lvbjtcblx0XHR9O1xuXHR9KCBjb25maWdfdHlwZXMsIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfX2dldFByaW1hcnksIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX3NoYXJlZF9nZXRFeHByZXNzaW9uTGlzdCwgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fc2hhcmVkX2dldFJlZmluZW1lbnQgKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0VHlwZU9mID0gZnVuY3Rpb24oIHR5cGVzLCBnZXRNZW1iZXJPckludm9jYXRpb24gKSB7XG5cblx0XHR2YXIgZ2V0VHlwZU9mLCBtYWtlUHJlZml4U2VxdWVuY2VNYXRjaGVyO1xuXHRcdG1ha2VQcmVmaXhTZXF1ZW5jZU1hdGNoZXIgPSBmdW5jdGlvbiggc3ltYm9sLCBmYWxsdGhyb3VnaCApIHtcblx0XHRcdHJldHVybiBmdW5jdGlvbiggdG9rZW5pemVyICkge1xuXHRcdFx0XHR2YXIgc3RhcnQsIGV4cHJlc3Npb247XG5cdFx0XHRcdGlmICggIXRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggc3ltYm9sICkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbGx0aHJvdWdoKCB0b2tlbml6ZXIgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzdGFydCA9IHRva2VuaXplci5wb3M7XG5cdFx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdFx0ZXhwcmVzc2lvbiA9IHRva2VuaXplci5nZXRFeHByZXNzaW9uKCk7XG5cdFx0XHRcdGlmICggIWV4cHJlc3Npb24gKSB7XG5cdFx0XHRcdFx0dG9rZW5pemVyLmV4cGVjdGVkKCAnYW4gZXhwcmVzc2lvbicgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHM6IHN5bWJvbCxcblx0XHRcdFx0XHRvOiBleHByZXNzaW9uLFxuXHRcdFx0XHRcdHQ6IHR5cGVzLlBSRUZJWF9PUEVSQVRPUlxuXHRcdFx0XHR9O1xuXHRcdFx0fTtcblx0XHR9O1xuXHRcdCggZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgaSwgbGVuLCBtYXRjaGVyLCBwcmVmaXhPcGVyYXRvcnMsIGZhbGx0aHJvdWdoO1xuXHRcdFx0cHJlZml4T3BlcmF0b3JzID0gJyEgfiArIC0gdHlwZW9mJy5zcGxpdCggJyAnICk7XG5cdFx0XHRmYWxsdGhyb3VnaCA9IGdldE1lbWJlck9ySW52b2NhdGlvbjtcblx0XHRcdGZvciAoIGkgPSAwLCBsZW4gPSBwcmVmaXhPcGVyYXRvcnMubGVuZ3RoOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdG1hdGNoZXIgPSBtYWtlUHJlZml4U2VxdWVuY2VNYXRjaGVyKCBwcmVmaXhPcGVyYXRvcnNbIGkgXSwgZmFsbHRocm91Z2ggKTtcblx0XHRcdFx0ZmFsbHRocm91Z2ggPSBtYXRjaGVyO1xuXHRcdFx0fVxuXHRcdFx0Z2V0VHlwZU9mID0gZmFsbHRocm91Z2g7XG5cdFx0fSgpICk7XG5cdFx0cmV0dXJuIGdldFR5cGVPZjtcblx0fSggY29uZmlnX3R5cGVzLCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRNZW1iZXJPckludm9jYXRpb24gKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0TG9naWNhbE9yID0gZnVuY3Rpb24oIHR5cGVzLCBnZXRUeXBlT2YgKSB7XG5cblx0XHR2YXIgZ2V0TG9naWNhbE9yLCBtYWtlSW5maXhTZXF1ZW5jZU1hdGNoZXI7XG5cdFx0bWFrZUluZml4U2VxdWVuY2VNYXRjaGVyID0gZnVuY3Rpb24oIHN5bWJvbCwgZmFsbHRocm91Z2ggKSB7XG5cdFx0XHRyZXR1cm4gZnVuY3Rpb24oIHRva2VuaXplciApIHtcblx0XHRcdFx0dmFyIHN0YXJ0LCBsZWZ0LCByaWdodDtcblx0XHRcdFx0bGVmdCA9IGZhbGx0aHJvdWdoKCB0b2tlbml6ZXIgKTtcblx0XHRcdFx0aWYgKCAhbGVmdCApIHtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHR3aGlsZSAoIHRydWUgKSB7XG5cdFx0XHRcdFx0c3RhcnQgPSB0b2tlbml6ZXIucG9zO1xuXHRcdFx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdFx0XHRpZiAoICF0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goIHN5bWJvbCApICkge1xuXHRcdFx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRcdFx0cmV0dXJuIGxlZnQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICggc3ltYm9sID09PSAnaW4nICYmIC9bYS16QS1aXyQwLTldLy50ZXN0KCB0b2tlbml6ZXIucmVtYWluaW5nKCkuY2hhckF0KCAwICkgKSApIHtcblx0XHRcdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0XHRcdHJldHVybiBsZWZ0O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRcdFx0cmlnaHQgPSBmYWxsdGhyb3VnaCggdG9rZW5pemVyICk7XG5cdFx0XHRcdFx0aWYgKCAhcmlnaHQgKSB7XG5cdFx0XHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbGVmdDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bGVmdCA9IHtcblx0XHRcdFx0XHRcdHQ6IHR5cGVzLklORklYX09QRVJBVE9SLFxuXHRcdFx0XHRcdFx0czogc3ltYm9sLFxuXHRcdFx0XHRcdFx0bzogW1xuXHRcdFx0XHRcdFx0XHRsZWZ0LFxuXHRcdFx0XHRcdFx0XHRyaWdodFxuXHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0fTtcblx0XHQoIGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIGksIGxlbiwgbWF0Y2hlciwgaW5maXhPcGVyYXRvcnMsIGZhbGx0aHJvdWdoO1xuXHRcdFx0aW5maXhPcGVyYXRvcnMgPSAnKiAvICUgKyAtIDw8ID4+ID4+PiA8IDw9ID4gPj0gaW4gaW5zdGFuY2VvZiA9PSAhPSA9PT0gIT09ICYgXiB8ICYmIHx8Jy5zcGxpdCggJyAnICk7XG5cdFx0XHRmYWxsdGhyb3VnaCA9IGdldFR5cGVPZjtcblx0XHRcdGZvciAoIGkgPSAwLCBsZW4gPSBpbmZpeE9wZXJhdG9ycy5sZW5ndGg7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0bWF0Y2hlciA9IG1ha2VJbmZpeFNlcXVlbmNlTWF0Y2hlciggaW5maXhPcGVyYXRvcnNbIGkgXSwgZmFsbHRocm91Z2ggKTtcblx0XHRcdFx0ZmFsbHRocm91Z2ggPSBtYXRjaGVyO1xuXHRcdFx0fVxuXHRcdFx0Z2V0TG9naWNhbE9yID0gZmFsbHRocm91Z2g7XG5cdFx0fSgpICk7XG5cdFx0cmV0dXJuIGdldExvZ2ljYWxPcjtcblx0fSggY29uZmlnX3R5cGVzLCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRUeXBlT2YgKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0Q29uZGl0aW9uYWwgPSBmdW5jdGlvbiggdHlwZXMsIGdldExvZ2ljYWxPciApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggdG9rZW5pemVyICkge1xuXHRcdFx0dmFyIHN0YXJ0LCBleHByZXNzaW9uLCBpZlRydWUsIGlmRmFsc2U7XG5cdFx0XHRleHByZXNzaW9uID0gZ2V0TG9naWNhbE9yKCB0b2tlbml6ZXIgKTtcblx0XHRcdGlmICggIWV4cHJlc3Npb24gKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0c3RhcnQgPSB0b2tlbml6ZXIucG9zO1xuXHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0aWYgKCAhdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnPycgKSApIHtcblx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRyZXR1cm4gZXhwcmVzc2lvbjtcblx0XHRcdH1cblx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdGlmVHJ1ZSA9IHRva2VuaXplci5nZXRFeHByZXNzaW9uKCk7XG5cdFx0XHRpZiAoICFpZlRydWUgKSB7XG5cdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0cmV0dXJuIGV4cHJlc3Npb247XG5cdFx0XHR9XG5cdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRpZiAoICF0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICc6JyApICkge1xuXHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdHJldHVybiBleHByZXNzaW9uO1xuXHRcdFx0fVxuXHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0aWZGYWxzZSA9IHRva2VuaXplci5nZXRFeHByZXNzaW9uKCk7XG5cdFx0XHRpZiAoICFpZkZhbHNlICkge1xuXHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdHJldHVybiBleHByZXNzaW9uO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0dDogdHlwZXMuQ09ORElUSU9OQUwsXG5cdFx0XHRcdG86IFtcblx0XHRcdFx0XHRleHByZXNzaW9uLFxuXHRcdFx0XHRcdGlmVHJ1ZSxcblx0XHRcdFx0XHRpZkZhbHNlXG5cdFx0XHRcdF1cblx0XHRcdH07XG5cdFx0fTtcblx0fSggY29uZmlnX3R5cGVzLCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRMb2dpY2FsT3IgKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fX2dldEV4cHJlc3Npb24gPSBmdW5jdGlvbiggZ2V0Q29uZGl0aW9uYWwgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gZ2V0Q29uZGl0aW9uYWwoIHRoaXMgKTtcblx0XHR9O1xuXHR9KCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRDb25kaXRpb25hbCApO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfX1Rva2VuaXplciA9IGZ1bmN0aW9uKCBnZXRNdXN0YWNoZSwgZ2V0Q29tbWVudCwgZ2V0VGFnLCBnZXRUZXh0LCBnZXRFeHByZXNzaW9uLCBhbGxvd1doaXRlc3BhY2UsIGdldFN0cmluZ01hdGNoICkge1xuXG5cdFx0dmFyIFRva2VuaXplcjtcblx0XHRUb2tlbml6ZXIgPSBmdW5jdGlvbiggc3RyLCBvcHRpb25zICkge1xuXHRcdFx0dmFyIHRva2VuO1xuXHRcdFx0dGhpcy5zdHIgPSBzdHI7XG5cdFx0XHR0aGlzLnBvcyA9IDA7XG5cdFx0XHR0aGlzLmRlbGltaXRlcnMgPSBvcHRpb25zLmRlbGltaXRlcnM7XG5cdFx0XHR0aGlzLnRyaXBsZURlbGltaXRlcnMgPSBvcHRpb25zLnRyaXBsZURlbGltaXRlcnM7XG5cdFx0XHR0aGlzLmludGVycG9sYXRlID0gb3B0aW9ucy5pbnRlcnBvbGF0ZTtcblx0XHRcdHRoaXMudG9rZW5zID0gW107XG5cdFx0XHR3aGlsZSAoIHRoaXMucG9zIDwgdGhpcy5zdHIubGVuZ3RoICkge1xuXHRcdFx0XHR0b2tlbiA9IHRoaXMuZ2V0VG9rZW4oKTtcblx0XHRcdFx0aWYgKCB0b2tlbiA9PT0gbnVsbCAmJiB0aGlzLnJlbWFpbmluZygpICkge1xuXHRcdFx0XHRcdHRoaXMuZmFpbCgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMudG9rZW5zLnB1c2goIHRva2VuICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRUb2tlbml6ZXIucHJvdG90eXBlID0ge1xuXHRcdFx0Z2V0VG9rZW46IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgdG9rZW4gPSB0aGlzLmdldE11c3RhY2hlKCkgfHwgdGhpcy5nZXRDb21tZW50KCkgfHwgdGhpcy5nZXRUYWcoKSB8fCB0aGlzLmdldFRleHQoKTtcblx0XHRcdFx0cmV0dXJuIHRva2VuO1xuXHRcdFx0fSxcblx0XHRcdGdldE11c3RhY2hlOiBnZXRNdXN0YWNoZSxcblx0XHRcdGdldENvbW1lbnQ6IGdldENvbW1lbnQsXG5cdFx0XHRnZXRUYWc6IGdldFRhZyxcblx0XHRcdGdldFRleHQ6IGdldFRleHQsXG5cdFx0XHRnZXRFeHByZXNzaW9uOiBnZXRFeHByZXNzaW9uLFxuXHRcdFx0YWxsb3dXaGl0ZXNwYWNlOiBhbGxvd1doaXRlc3BhY2UsXG5cdFx0XHRnZXRTdHJpbmdNYXRjaDogZ2V0U3RyaW5nTWF0Y2gsXG5cdFx0XHRyZW1haW5pbmc6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5zdHIuc3Vic3RyaW5nKCB0aGlzLnBvcyApO1xuXHRcdFx0fSxcblx0XHRcdGZhaWw6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgbGFzdDIwLCBuZXh0MjA7XG5cdFx0XHRcdGxhc3QyMCA9IHRoaXMuc3RyLnN1YnN0ciggMCwgdGhpcy5wb3MgKS5zdWJzdHIoIC0yMCApO1xuXHRcdFx0XHRpZiAoIGxhc3QyMC5sZW5ndGggPT09IDIwICkge1xuXHRcdFx0XHRcdGxhc3QyMCA9ICcuLi4nICsgbGFzdDIwO1xuXHRcdFx0XHR9XG5cdFx0XHRcdG5leHQyMCA9IHRoaXMucmVtYWluaW5nKCkuc3Vic3RyKCAwLCAyMCApO1xuXHRcdFx0XHRpZiAoIG5leHQyMC5sZW5ndGggPT09IDIwICkge1xuXHRcdFx0XHRcdG5leHQyMCA9IG5leHQyMCArICcuLi4nO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ0NvdWxkIG5vdCBwYXJzZSB0ZW1wbGF0ZTogJyArICggbGFzdDIwID8gbGFzdDIwICsgJzwtICcgOiAnJyApICsgJ2ZhaWxlZCBhdCBjaGFyYWN0ZXIgJyArIHRoaXMucG9zICsgJyAtPicgKyBuZXh0MjAgKTtcblx0XHRcdH0sXG5cdFx0XHRleHBlY3RlZDogZnVuY3Rpb24oIHRoaW5nICkge1xuXHRcdFx0XHR2YXIgcmVtYWluaW5nID0gdGhpcy5yZW1haW5pbmcoKS5zdWJzdHIoIDAsIDQwICk7XG5cdFx0XHRcdGlmICggcmVtYWluaW5nLmxlbmd0aCA9PT0gNDAgKSB7XG5cdFx0XHRcdFx0cmVtYWluaW5nICs9ICcuLi4nO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ1Rva2VuaXplciBmYWlsZWQ6IHVuZXhwZWN0ZWQgc3RyaW5nIFwiJyArIHJlbWFpbmluZyArICdcIiAoZXhwZWN0ZWQgJyArIHRoaW5nICsgJyknICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gVG9rZW5pemVyO1xuXHR9KCBwYXJzZV9Ub2tlbml6ZXJfZ2V0TXVzdGFjaGVfX2dldE11c3RhY2hlLCBwYXJzZV9Ub2tlbml6ZXJfZ2V0Q29tbWVudF9nZXRDb21tZW50LCBwYXJzZV9Ub2tlbml6ZXJfZ2V0VGFnX19nZXRUYWcsIHBhcnNlX1Rva2VuaXplcl9nZXRUZXh0X19nZXRUZXh0LCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9fZ2V0RXhwcmVzc2lvbiwgcGFyc2VfVG9rZW5pemVyX3V0aWxzX2FsbG93V2hpdGVzcGFjZSwgcGFyc2VfVG9rZW5pemVyX3V0aWxzX2dldFN0cmluZ01hdGNoICk7XG5cblx0dmFyIHBhcnNlX3Rva2VuaXplID0gZnVuY3Rpb24oIGluaXRPcHRpb25zLCBzdHJpcEh0bWxDb21tZW50cywgc3RyaXBTdGFuZGFsb25lcywgc3RyaXBDb21tZW50VG9rZW5zLCBUb2tlbml6ZXIgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHRlbXBsYXRlLCBvcHRpb25zICkge1xuXHRcdFx0dmFyIHRva2VuaXplciwgdG9rZW5zO1xuXHRcdFx0b3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cdFx0XHRpZiAoIG9wdGlvbnMuc3RyaXBDb21tZW50cyAhPT0gZmFsc2UgKSB7XG5cdFx0XHRcdHRlbXBsYXRlID0gc3RyaXBIdG1sQ29tbWVudHMoIHRlbXBsYXRlICk7XG5cdFx0XHR9XG5cdFx0XHR0b2tlbml6ZXIgPSBuZXcgVG9rZW5pemVyKCB0ZW1wbGF0ZSwge1xuXHRcdFx0XHRkZWxpbWl0ZXJzOiBvcHRpb25zLmRlbGltaXRlcnMgfHwgaW5pdE9wdGlvbnMuZGVmYXVsdHMuZGVsaW1pdGVycyxcblx0XHRcdFx0dHJpcGxlRGVsaW1pdGVyczogb3B0aW9ucy50cmlwbGVEZWxpbWl0ZXJzIHx8IGluaXRPcHRpb25zLmRlZmF1bHRzLnRyaXBsZURlbGltaXRlcnMsXG5cdFx0XHRcdGludGVycG9sYXRlOiB7XG5cdFx0XHRcdFx0c2NyaXB0OiBvcHRpb25zLmludGVycG9sYXRlU2NyaXB0cyAhPT0gZmFsc2UgPyB0cnVlIDogZmFsc2UsXG5cdFx0XHRcdFx0c3R5bGU6IG9wdGlvbnMuaW50ZXJwb2xhdGVTdHlsZXMgIT09IGZhbHNlID8gdHJ1ZSA6IGZhbHNlXG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdHRva2VucyA9IHRva2VuaXplci50b2tlbnM7XG5cdFx0XHRzdHJpcFN0YW5kYWxvbmVzKCB0b2tlbnMgKTtcblx0XHRcdHN0cmlwQ29tbWVudFRva2VucyggdG9rZW5zICk7XG5cdFx0XHRyZXR1cm4gdG9rZW5zO1xuXHRcdH07XG5cdH0oIGNvbmZpZ19pbml0T3B0aW9ucywgcGFyc2VfdXRpbHNfc3RyaXBIdG1sQ29tbWVudHMsIHBhcnNlX3V0aWxzX3N0cmlwU3RhbmRhbG9uZXMsIHBhcnNlX3V0aWxzX3N0cmlwQ29tbWVudFRva2VucywgcGFyc2VfVG9rZW5pemVyX19Ub2tlbml6ZXIgKTtcblxuXHR2YXIgcGFyc2VfUGFyc2VyX2dldFRleHRfVGV4dFN0dWJfX1RleHRTdHViID0gZnVuY3Rpb24oIHR5cGVzICkge1xuXG5cdFx0dmFyIFRleHRTdHViLCBodG1sRW50aXRpZXMsIGNvbnRyb2xDaGFyYWN0ZXJzLCBuYW1lZEVudGl0eVBhdHRlcm4sIGhleEVudGl0eVBhdHRlcm4sIGRlY2ltYWxFbnRpdHlQYXR0ZXJuLCB2YWxpZGF0ZUNvZGUsIGRlY29kZUNoYXJhY3RlclJlZmVyZW5jZXMsIHdoaXRlc3BhY2U7XG5cdFx0VGV4dFN0dWIgPSBmdW5jdGlvbiggdG9rZW4sIHByZXNlcnZlV2hpdGVzcGFjZSApIHtcblx0XHRcdHRoaXMudGV4dCA9IHByZXNlcnZlV2hpdGVzcGFjZSA/IHRva2VuLnZhbHVlIDogdG9rZW4udmFsdWUucmVwbGFjZSggd2hpdGVzcGFjZSwgJyAnICk7XG5cdFx0fTtcblx0XHRUZXh0U3R1Yi5wcm90b3R5cGUgPSB7XG5cdFx0XHR0eXBlOiB0eXBlcy5URVhULFxuXHRcdFx0dG9KU09OOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuZGVjb2RlZCB8fCAoIHRoaXMuZGVjb2RlZCA9IGRlY29kZUNoYXJhY3RlclJlZmVyZW5jZXMoIHRoaXMudGV4dCApICk7XG5cdFx0XHR9LFxuXHRcdFx0dG9TdHJpbmc6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy50ZXh0O1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0aHRtbEVudGl0aWVzID0ge1xuXHRcdFx0cXVvdDogMzQsXG5cdFx0XHRhbXA6IDM4LFxuXHRcdFx0YXBvczogMzksXG5cdFx0XHRsdDogNjAsXG5cdFx0XHRndDogNjIsXG5cdFx0XHRuYnNwOiAxNjAsXG5cdFx0XHRpZXhjbDogMTYxLFxuXHRcdFx0Y2VudDogMTYyLFxuXHRcdFx0cG91bmQ6IDE2Myxcblx0XHRcdGN1cnJlbjogMTY0LFxuXHRcdFx0eWVuOiAxNjUsXG5cdFx0XHRicnZiYXI6IDE2Nixcblx0XHRcdHNlY3Q6IDE2Nyxcblx0XHRcdHVtbDogMTY4LFxuXHRcdFx0Y29weTogMTY5LFxuXHRcdFx0b3JkZjogMTcwLFxuXHRcdFx0bGFxdW86IDE3MSxcblx0XHRcdG5vdDogMTcyLFxuXHRcdFx0c2h5OiAxNzMsXG5cdFx0XHRyZWc6IDE3NCxcblx0XHRcdG1hY3I6IDE3NSxcblx0XHRcdGRlZzogMTc2LFxuXHRcdFx0cGx1c21uOiAxNzcsXG5cdFx0XHRzdXAyOiAxNzgsXG5cdFx0XHRzdXAzOiAxNzksXG5cdFx0XHRhY3V0ZTogMTgwLFxuXHRcdFx0bWljcm86IDE4MSxcblx0XHRcdHBhcmE6IDE4Mixcblx0XHRcdG1pZGRvdDogMTgzLFxuXHRcdFx0Y2VkaWw6IDE4NCxcblx0XHRcdHN1cDE6IDE4NSxcblx0XHRcdG9yZG06IDE4Nixcblx0XHRcdHJhcXVvOiAxODcsXG5cdFx0XHRmcmFjMTQ6IDE4OCxcblx0XHRcdGZyYWMxMjogMTg5LFxuXHRcdFx0ZnJhYzM0OiAxOTAsXG5cdFx0XHRpcXVlc3Q6IDE5MSxcblx0XHRcdEFncmF2ZTogMTkyLFxuXHRcdFx0QWFjdXRlOiAxOTMsXG5cdFx0XHRBY2lyYzogMTk0LFxuXHRcdFx0QXRpbGRlOiAxOTUsXG5cdFx0XHRBdW1sOiAxOTYsXG5cdFx0XHRBcmluZzogMTk3LFxuXHRcdFx0QUVsaWc6IDE5OCxcblx0XHRcdENjZWRpbDogMTk5LFxuXHRcdFx0RWdyYXZlOiAyMDAsXG5cdFx0XHRFYWN1dGU6IDIwMSxcblx0XHRcdEVjaXJjOiAyMDIsXG5cdFx0XHRFdW1sOiAyMDMsXG5cdFx0XHRJZ3JhdmU6IDIwNCxcblx0XHRcdElhY3V0ZTogMjA1LFxuXHRcdFx0SWNpcmM6IDIwNixcblx0XHRcdEl1bWw6IDIwNyxcblx0XHRcdEVUSDogMjA4LFxuXHRcdFx0TnRpbGRlOiAyMDksXG5cdFx0XHRPZ3JhdmU6IDIxMCxcblx0XHRcdE9hY3V0ZTogMjExLFxuXHRcdFx0T2NpcmM6IDIxMixcblx0XHRcdE90aWxkZTogMjEzLFxuXHRcdFx0T3VtbDogMjE0LFxuXHRcdFx0dGltZXM6IDIxNSxcblx0XHRcdE9zbGFzaDogMjE2LFxuXHRcdFx0VWdyYXZlOiAyMTcsXG5cdFx0XHRVYWN1dGU6IDIxOCxcblx0XHRcdFVjaXJjOiAyMTksXG5cdFx0XHRVdW1sOiAyMjAsXG5cdFx0XHRZYWN1dGU6IDIyMSxcblx0XHRcdFRIT1JOOiAyMjIsXG5cdFx0XHRzemxpZzogMjIzLFxuXHRcdFx0YWdyYXZlOiAyMjQsXG5cdFx0XHRhYWN1dGU6IDIyNSxcblx0XHRcdGFjaXJjOiAyMjYsXG5cdFx0XHRhdGlsZGU6IDIyNyxcblx0XHRcdGF1bWw6IDIyOCxcblx0XHRcdGFyaW5nOiAyMjksXG5cdFx0XHRhZWxpZzogMjMwLFxuXHRcdFx0Y2NlZGlsOiAyMzEsXG5cdFx0XHRlZ3JhdmU6IDIzMixcblx0XHRcdGVhY3V0ZTogMjMzLFxuXHRcdFx0ZWNpcmM6IDIzNCxcblx0XHRcdGV1bWw6IDIzNSxcblx0XHRcdGlncmF2ZTogMjM2LFxuXHRcdFx0aWFjdXRlOiAyMzcsXG5cdFx0XHRpY2lyYzogMjM4LFxuXHRcdFx0aXVtbDogMjM5LFxuXHRcdFx0ZXRoOiAyNDAsXG5cdFx0XHRudGlsZGU6IDI0MSxcblx0XHRcdG9ncmF2ZTogMjQyLFxuXHRcdFx0b2FjdXRlOiAyNDMsXG5cdFx0XHRvY2lyYzogMjQ0LFxuXHRcdFx0b3RpbGRlOiAyNDUsXG5cdFx0XHRvdW1sOiAyNDYsXG5cdFx0XHRkaXZpZGU6IDI0Nyxcblx0XHRcdG9zbGFzaDogMjQ4LFxuXHRcdFx0dWdyYXZlOiAyNDksXG5cdFx0XHR1YWN1dGU6IDI1MCxcblx0XHRcdHVjaXJjOiAyNTEsXG5cdFx0XHR1dW1sOiAyNTIsXG5cdFx0XHR5YWN1dGU6IDI1Myxcblx0XHRcdHRob3JuOiAyNTQsXG5cdFx0XHR5dW1sOiAyNTUsXG5cdFx0XHRPRWxpZzogMzM4LFxuXHRcdFx0b2VsaWc6IDMzOSxcblx0XHRcdFNjYXJvbjogMzUyLFxuXHRcdFx0c2Nhcm9uOiAzNTMsXG5cdFx0XHRZdW1sOiAzNzYsXG5cdFx0XHRmbm9mOiA0MDIsXG5cdFx0XHRjaXJjOiA3MTAsXG5cdFx0XHR0aWxkZTogNzMyLFxuXHRcdFx0QWxwaGE6IDkxMyxcblx0XHRcdEJldGE6IDkxNCxcblx0XHRcdEdhbW1hOiA5MTUsXG5cdFx0XHREZWx0YTogOTE2LFxuXHRcdFx0RXBzaWxvbjogOTE3LFxuXHRcdFx0WmV0YTogOTE4LFxuXHRcdFx0RXRhOiA5MTksXG5cdFx0XHRUaGV0YTogOTIwLFxuXHRcdFx0SW90YTogOTIxLFxuXHRcdFx0S2FwcGE6IDkyMixcblx0XHRcdExhbWJkYTogOTIzLFxuXHRcdFx0TXU6IDkyNCxcblx0XHRcdE51OiA5MjUsXG5cdFx0XHRYaTogOTI2LFxuXHRcdFx0T21pY3JvbjogOTI3LFxuXHRcdFx0UGk6IDkyOCxcblx0XHRcdFJobzogOTI5LFxuXHRcdFx0U2lnbWE6IDkzMSxcblx0XHRcdFRhdTogOTMyLFxuXHRcdFx0VXBzaWxvbjogOTMzLFxuXHRcdFx0UGhpOiA5MzQsXG5cdFx0XHRDaGk6IDkzNSxcblx0XHRcdFBzaTogOTM2LFxuXHRcdFx0T21lZ2E6IDkzNyxcblx0XHRcdGFscGhhOiA5NDUsXG5cdFx0XHRiZXRhOiA5NDYsXG5cdFx0XHRnYW1tYTogOTQ3LFxuXHRcdFx0ZGVsdGE6IDk0OCxcblx0XHRcdGVwc2lsb246IDk0OSxcblx0XHRcdHpldGE6IDk1MCxcblx0XHRcdGV0YTogOTUxLFxuXHRcdFx0dGhldGE6IDk1Mixcblx0XHRcdGlvdGE6IDk1Myxcblx0XHRcdGthcHBhOiA5NTQsXG5cdFx0XHRsYW1iZGE6IDk1NSxcblx0XHRcdG11OiA5NTYsXG5cdFx0XHRudTogOTU3LFxuXHRcdFx0eGk6IDk1OCxcblx0XHRcdG9taWNyb246IDk1OSxcblx0XHRcdHBpOiA5NjAsXG5cdFx0XHRyaG86IDk2MSxcblx0XHRcdHNpZ21hZjogOTYyLFxuXHRcdFx0c2lnbWE6IDk2Myxcblx0XHRcdHRhdTogOTY0LFxuXHRcdFx0dXBzaWxvbjogOTY1LFxuXHRcdFx0cGhpOiA5NjYsXG5cdFx0XHRjaGk6IDk2Nyxcblx0XHRcdHBzaTogOTY4LFxuXHRcdFx0b21lZ2E6IDk2OSxcblx0XHRcdHRoZXRhc3ltOiA5NzcsXG5cdFx0XHR1cHNpaDogOTc4LFxuXHRcdFx0cGl2OiA5ODIsXG5cdFx0XHRlbnNwOiA4MTk0LFxuXHRcdFx0ZW1zcDogODE5NSxcblx0XHRcdHRoaW5zcDogODIwMSxcblx0XHRcdHp3bmo6IDgyMDQsXG5cdFx0XHR6d2o6IDgyMDUsXG5cdFx0XHRscm06IDgyMDYsXG5cdFx0XHRybG06IDgyMDcsXG5cdFx0XHRuZGFzaDogODIxMSxcblx0XHRcdG1kYXNoOiA4MjEyLFxuXHRcdFx0bHNxdW86IDgyMTYsXG5cdFx0XHRyc3F1bzogODIxNyxcblx0XHRcdHNicXVvOiA4MjE4LFxuXHRcdFx0bGRxdW86IDgyMjAsXG5cdFx0XHRyZHF1bzogODIyMSxcblx0XHRcdGJkcXVvOiA4MjIyLFxuXHRcdFx0ZGFnZ2VyOiA4MjI0LFxuXHRcdFx0RGFnZ2VyOiA4MjI1LFxuXHRcdFx0YnVsbDogODIyNixcblx0XHRcdGhlbGxpcDogODIzMCxcblx0XHRcdHBlcm1pbDogODI0MCxcblx0XHRcdHByaW1lOiA4MjQyLFxuXHRcdFx0UHJpbWU6IDgyNDMsXG5cdFx0XHRsc2FxdW86IDgyNDksXG5cdFx0XHRyc2FxdW86IDgyNTAsXG5cdFx0XHRvbGluZTogODI1NCxcblx0XHRcdGZyYXNsOiA4MjYwLFxuXHRcdFx0ZXVybzogODM2NCxcblx0XHRcdGltYWdlOiA4NDY1LFxuXHRcdFx0d2VpZXJwOiA4NDcyLFxuXHRcdFx0cmVhbDogODQ3Nixcblx0XHRcdHRyYWRlOiA4NDgyLFxuXHRcdFx0YWxlZnN5bTogODUwMSxcblx0XHRcdGxhcnI6IDg1OTIsXG5cdFx0XHR1YXJyOiA4NTkzLFxuXHRcdFx0cmFycjogODU5NCxcblx0XHRcdGRhcnI6IDg1OTUsXG5cdFx0XHRoYXJyOiA4NTk2LFxuXHRcdFx0Y3JhcnI6IDg2MjksXG5cdFx0XHRsQXJyOiA4NjU2LFxuXHRcdFx0dUFycjogODY1Nyxcblx0XHRcdHJBcnI6IDg2NTgsXG5cdFx0XHRkQXJyOiA4NjU5LFxuXHRcdFx0aEFycjogODY2MCxcblx0XHRcdGZvcmFsbDogODcwNCxcblx0XHRcdHBhcnQ6IDg3MDYsXG5cdFx0XHRleGlzdDogODcwNyxcblx0XHRcdGVtcHR5OiA4NzA5LFxuXHRcdFx0bmFibGE6IDg3MTEsXG5cdFx0XHRpc2luOiA4NzEyLFxuXHRcdFx0bm90aW46IDg3MTMsXG5cdFx0XHRuaTogODcxNSxcblx0XHRcdHByb2Q6IDg3MTksXG5cdFx0XHRzdW06IDg3MjEsXG5cdFx0XHRtaW51czogODcyMixcblx0XHRcdGxvd2FzdDogODcyNyxcblx0XHRcdHJhZGljOiA4NzMwLFxuXHRcdFx0cHJvcDogODczMyxcblx0XHRcdGluZmluOiA4NzM0LFxuXHRcdFx0YW5nOiA4NzM2LFxuXHRcdFx0YW5kOiA4NzQzLFxuXHRcdFx0b3I6IDg3NDQsXG5cdFx0XHRjYXA6IDg3NDUsXG5cdFx0XHRjdXA6IDg3NDYsXG5cdFx0XHQnaW50JzogODc0Nyxcblx0XHRcdHRoZXJlNDogODc1Nixcblx0XHRcdHNpbTogODc2NCxcblx0XHRcdGNvbmc6IDg3NzMsXG5cdFx0XHRhc3ltcDogODc3Nixcblx0XHRcdG5lOiA4ODAwLFxuXHRcdFx0ZXF1aXY6IDg4MDEsXG5cdFx0XHRsZTogODgwNCxcblx0XHRcdGdlOiA4ODA1LFxuXHRcdFx0c3ViOiA4ODM0LFxuXHRcdFx0c3VwOiA4ODM1LFxuXHRcdFx0bnN1YjogODgzNixcblx0XHRcdHN1YmU6IDg4MzgsXG5cdFx0XHRzdXBlOiA4ODM5LFxuXHRcdFx0b3BsdXM6IDg4NTMsXG5cdFx0XHRvdGltZXM6IDg4NTUsXG5cdFx0XHRwZXJwOiA4ODY5LFxuXHRcdFx0c2RvdDogODkwMSxcblx0XHRcdGxjZWlsOiA4OTY4LFxuXHRcdFx0cmNlaWw6IDg5NjksXG5cdFx0XHRsZmxvb3I6IDg5NzAsXG5cdFx0XHRyZmxvb3I6IDg5NzEsXG5cdFx0XHRsYW5nOiA5MDAxLFxuXHRcdFx0cmFuZzogOTAwMixcblx0XHRcdGxvejogOTY3NCxcblx0XHRcdHNwYWRlczogOTgyNCxcblx0XHRcdGNsdWJzOiA5ODI3LFxuXHRcdFx0aGVhcnRzOiA5ODI5LFxuXHRcdFx0ZGlhbXM6IDk4MzBcblx0XHR9O1xuXHRcdGNvbnRyb2xDaGFyYWN0ZXJzID0gW1xuXHRcdFx0ODM2NCxcblx0XHRcdDEyOSxcblx0XHRcdDgyMTgsXG5cdFx0XHQ0MDIsXG5cdFx0XHQ4MjIyLFxuXHRcdFx0ODIzMCxcblx0XHRcdDgyMjQsXG5cdFx0XHQ4MjI1LFxuXHRcdFx0NzEwLFxuXHRcdFx0ODI0MCxcblx0XHRcdDM1Mixcblx0XHRcdDgyNDksXG5cdFx0XHQzMzgsXG5cdFx0XHQxNDEsXG5cdFx0XHQzODEsXG5cdFx0XHQxNDMsXG5cdFx0XHQxNDQsXG5cdFx0XHQ4MjE2LFxuXHRcdFx0ODIxNyxcblx0XHRcdDgyMjAsXG5cdFx0XHQ4MjIxLFxuXHRcdFx0ODIyNixcblx0XHRcdDgyMTEsXG5cdFx0XHQ4MjEyLFxuXHRcdFx0NzMyLFxuXHRcdFx0ODQ4Mixcblx0XHRcdDM1Myxcblx0XHRcdDgyNTAsXG5cdFx0XHQzMzksXG5cdFx0XHQxNTcsXG5cdFx0XHQzODIsXG5cdFx0XHQzNzZcblx0XHRdO1xuXHRcdG5hbWVkRW50aXR5UGF0dGVybiA9IG5ldyBSZWdFeHAoICcmKCcgKyBPYmplY3Qua2V5cyggaHRtbEVudGl0aWVzICkuam9pbiggJ3wnICkgKyAnKTs/JywgJ2cnICk7XG5cdFx0aGV4RW50aXR5UGF0dGVybiA9IC8mI3goWzAtOV0rKTs/L2c7XG5cdFx0ZGVjaW1hbEVudGl0eVBhdHRlcm4gPSAvJiMoWzAtOV0rKTs/L2c7XG5cdFx0dmFsaWRhdGVDb2RlID0gZnVuY3Rpb24oIGNvZGUgKSB7XG5cdFx0XHRpZiAoICFjb2RlICkge1xuXHRcdFx0XHRyZXR1cm4gNjU1MzM7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGNvZGUgPT09IDEwICkge1xuXHRcdFx0XHRyZXR1cm4gMzI7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGNvZGUgPCAxMjggKSB7XG5cdFx0XHRcdHJldHVybiBjb2RlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBjb2RlIDw9IDE1OSApIHtcblx0XHRcdFx0cmV0dXJuIGNvbnRyb2xDaGFyYWN0ZXJzWyBjb2RlIC0gMTI4IF07XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGNvZGUgPCA1NTI5NiApIHtcblx0XHRcdFx0cmV0dXJuIGNvZGU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGNvZGUgPD0gNTczNDMgKSB7XG5cdFx0XHRcdHJldHVybiA2NTUzMztcblx0XHRcdH1cblx0XHRcdGlmICggY29kZSA8PSA2NTUzNSApIHtcblx0XHRcdFx0cmV0dXJuIGNvZGU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gNjU1MzM7XG5cdFx0fTtcblx0XHRkZWNvZGVDaGFyYWN0ZXJSZWZlcmVuY2VzID0gZnVuY3Rpb24oIGh0bWwgKSB7XG5cdFx0XHR2YXIgcmVzdWx0O1xuXHRcdFx0cmVzdWx0ID0gaHRtbC5yZXBsYWNlKCBuYW1lZEVudGl0eVBhdHRlcm4sIGZ1bmN0aW9uKCBtYXRjaCwgbmFtZSApIHtcblx0XHRcdFx0aWYgKCBodG1sRW50aXRpZXNbIG5hbWUgXSApIHtcblx0XHRcdFx0XHRyZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZSggaHRtbEVudGl0aWVzWyBuYW1lIF0gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gbWF0Y2g7XG5cdFx0XHR9ICk7XG5cdFx0XHRyZXN1bHQgPSByZXN1bHQucmVwbGFjZSggaGV4RW50aXR5UGF0dGVybiwgZnVuY3Rpb24oIG1hdGNoLCBoZXggKSB7XG5cdFx0XHRcdHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKCB2YWxpZGF0ZUNvZGUoIHBhcnNlSW50KCBoZXgsIDE2ICkgKSApO1xuXHRcdFx0fSApO1xuXHRcdFx0cmVzdWx0ID0gcmVzdWx0LnJlcGxhY2UoIGRlY2ltYWxFbnRpdHlQYXR0ZXJuLCBmdW5jdGlvbiggbWF0Y2gsIGNoYXJDb2RlICkge1xuXHRcdFx0XHRyZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZSggdmFsaWRhdGVDb2RlKCBjaGFyQ29kZSApICk7XG5cdFx0XHR9ICk7XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH07XG5cdFx0d2hpdGVzcGFjZSA9IC9cXHMrL2c7XG5cdFx0cmV0dXJuIFRleHRTdHViO1xuXHR9KCBjb25maWdfdHlwZXMgKTtcblxuXHR2YXIgcGFyc2VfUGFyc2VyX2dldFRleHRfX2dldFRleHQgPSBmdW5jdGlvbiggdHlwZXMsIFRleHRTdHViICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB0b2tlbiwgcHJlc2VydmVXaGl0ZXNwYWNlICkge1xuXHRcdFx0aWYgKCB0b2tlbi50eXBlID09PSB0eXBlcy5URVhUICkge1xuXHRcdFx0XHR0aGlzLnBvcyArPSAxO1xuXHRcdFx0XHRyZXR1cm4gbmV3IFRleHRTdHViKCB0b2tlbiwgcHJlc2VydmVXaGl0ZXNwYWNlICk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9O1xuXHR9KCBjb25maWdfdHlwZXMsIHBhcnNlX1BhcnNlcl9nZXRUZXh0X1RleHRTdHViX19UZXh0U3R1YiApO1xuXG5cdHZhciBwYXJzZV9QYXJzZXJfZ2V0Q29tbWVudF9Db21tZW50U3R1Yl9fQ29tbWVudFN0dWIgPSBmdW5jdGlvbiggdHlwZXMgKSB7XG5cblx0XHR2YXIgQ29tbWVudFN0dWI7XG5cdFx0Q29tbWVudFN0dWIgPSBmdW5jdGlvbiggdG9rZW4gKSB7XG5cdFx0XHR0aGlzLmNvbnRlbnQgPSB0b2tlbi5jb250ZW50O1xuXHRcdH07XG5cdFx0Q29tbWVudFN0dWIucHJvdG90eXBlID0ge1xuXHRcdFx0dG9KU09OOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHR0OiB0eXBlcy5DT01NRU5ULFxuXHRcdFx0XHRcdGY6IHRoaXMuY29udGVudFxuXHRcdFx0XHR9O1xuXHRcdFx0fSxcblx0XHRcdHRvU3RyaW5nOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuICc8IS0tJyArIHRoaXMuY29udGVudCArICctLT4nO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIENvbW1lbnRTdHViO1xuXHR9KCBjb25maWdfdHlwZXMgKTtcblxuXHR2YXIgcGFyc2VfUGFyc2VyX2dldENvbW1lbnRfX2dldENvbW1lbnQgPSBmdW5jdGlvbiggdHlwZXMsIENvbW1lbnRTdHViICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB0b2tlbiApIHtcblx0XHRcdGlmICggdG9rZW4udHlwZSA9PT0gdHlwZXMuQ09NTUVOVCApIHtcblx0XHRcdFx0dGhpcy5wb3MgKz0gMTtcblx0XHRcdFx0cmV0dXJuIG5ldyBDb21tZW50U3R1YiggdG9rZW4sIHRoaXMucHJlc2VydmVXaGl0ZXNwYWNlICk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9O1xuXHR9KCBjb25maWdfdHlwZXMsIHBhcnNlX1BhcnNlcl9nZXRDb21tZW50X0NvbW1lbnRTdHViX19Db21tZW50U3R1YiApO1xuXG5cdHZhciBwYXJzZV9QYXJzZXJfZ2V0TXVzdGFjaGVfRXhwcmVzc2lvblN0dWJfX0V4cHJlc3Npb25TdHViID0gZnVuY3Rpb24oIHR5cGVzLCBpc09iamVjdCApIHtcblxuXHRcdHZhciBFeHByZXNzaW9uU3R1YiA9IGZ1bmN0aW9uKCB0b2tlbiApIHtcblx0XHRcdHRoaXMucmVmcyA9IFtdO1xuXHRcdFx0Z2V0UmVmcyggdG9rZW4sIHRoaXMucmVmcyApO1xuXHRcdFx0dGhpcy5zdHIgPSBzdHJpbmdpZnkoIHRva2VuLCB0aGlzLnJlZnMgKTtcblx0XHR9O1xuXHRcdEV4cHJlc3Npb25TdHViLnByb3RvdHlwZSA9IHtcblx0XHRcdHRvSlNPTjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmICggdGhpcy5qc29uICkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmpzb247XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5qc29uID0ge1xuXHRcdFx0XHRcdHI6IHRoaXMucmVmcyxcblx0XHRcdFx0XHRzOiB0aGlzLnN0clxuXHRcdFx0XHR9O1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5qc29uO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIEV4cHJlc3Npb25TdHViO1xuXG5cdFx0ZnVuY3Rpb24gcXVvdGVTdHJpbmdMaXRlcmFsKCBzdHIgKSB7XG5cdFx0XHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkoIFN0cmluZyggc3RyICkgKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXRSZWZzKCB0b2tlbiwgcmVmcyApIHtcblx0XHRcdHZhciBpLCBsaXN0O1xuXHRcdFx0aWYgKCB0b2tlbi50ID09PSB0eXBlcy5SRUZFUkVOQ0UgKSB7XG5cdFx0XHRcdGlmICggcmVmcy5pbmRleE9mKCB0b2tlbi5uICkgPT09IC0xICkge1xuXHRcdFx0XHRcdHJlZnMudW5zaGlmdCggdG9rZW4ubiApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRsaXN0ID0gdG9rZW4ubyB8fCB0b2tlbi5tO1xuXHRcdFx0aWYgKCBsaXN0ICkge1xuXHRcdFx0XHRpZiAoIGlzT2JqZWN0KCBsaXN0ICkgKSB7XG5cdFx0XHRcdFx0Z2V0UmVmcyggbGlzdCwgcmVmcyApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGkgPSBsaXN0Lmxlbmd0aDtcblx0XHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRcdGdldFJlZnMoIGxpc3RbIGkgXSwgcmVmcyApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCB0b2tlbi54ICkge1xuXHRcdFx0XHRnZXRSZWZzKCB0b2tlbi54LCByZWZzICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRva2VuLnIgKSB7XG5cdFx0XHRcdGdldFJlZnMoIHRva2VuLnIsIHJlZnMgKTtcblx0XHRcdH1cblx0XHRcdGlmICggdG9rZW4udiApIHtcblx0XHRcdFx0Z2V0UmVmcyggdG9rZW4udiwgcmVmcyApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHN0cmluZ2lmeSggdG9rZW4sIHJlZnMgKSB7XG5cdFx0XHR2YXIgbWFwID0gZnVuY3Rpb24oIGl0ZW0gKSB7XG5cdFx0XHRcdHJldHVybiBzdHJpbmdpZnkoIGl0ZW0sIHJlZnMgKTtcblx0XHRcdH07XG5cdFx0XHRzd2l0Y2ggKCB0b2tlbi50ICkge1xuXHRcdFx0XHRjYXNlIHR5cGVzLkJPT0xFQU5fTElURVJBTDpcblx0XHRcdFx0Y2FzZSB0eXBlcy5HTE9CQUw6XG5cdFx0XHRcdGNhc2UgdHlwZXMuTlVNQkVSX0xJVEVSQUw6XG5cdFx0XHRcdFx0cmV0dXJuIHRva2VuLnY7XG5cdFx0XHRcdGNhc2UgdHlwZXMuU1RSSU5HX0xJVEVSQUw6XG5cdFx0XHRcdFx0cmV0dXJuIHF1b3RlU3RyaW5nTGl0ZXJhbCggdG9rZW4udiApO1xuXHRcdFx0XHRjYXNlIHR5cGVzLkFSUkFZX0xJVEVSQUw6XG5cdFx0XHRcdFx0cmV0dXJuICdbJyArICggdG9rZW4ubSA/IHRva2VuLm0ubWFwKCBtYXAgKS5qb2luKCAnLCcgKSA6ICcnICkgKyAnXSc7XG5cdFx0XHRcdGNhc2UgdHlwZXMuT0JKRUNUX0xJVEVSQUw6XG5cdFx0XHRcdFx0cmV0dXJuICd7JyArICggdG9rZW4ubSA/IHRva2VuLm0ubWFwKCBtYXAgKS5qb2luKCAnLCcgKSA6ICcnICkgKyAnfSc7XG5cdFx0XHRcdGNhc2UgdHlwZXMuS0VZX1ZBTFVFX1BBSVI6XG5cdFx0XHRcdFx0cmV0dXJuIHRva2VuLmsgKyAnOicgKyBzdHJpbmdpZnkoIHRva2VuLnYsIHJlZnMgKTtcblx0XHRcdFx0Y2FzZSB0eXBlcy5QUkVGSVhfT1BFUkFUT1I6XG5cdFx0XHRcdFx0cmV0dXJuICggdG9rZW4ucyA9PT0gJ3R5cGVvZicgPyAndHlwZW9mICcgOiB0b2tlbi5zICkgKyBzdHJpbmdpZnkoIHRva2VuLm8sIHJlZnMgKTtcblx0XHRcdFx0Y2FzZSB0eXBlcy5JTkZJWF9PUEVSQVRPUjpcblx0XHRcdFx0XHRyZXR1cm4gc3RyaW5naWZ5KCB0b2tlbi5vWyAwIF0sIHJlZnMgKSArICggdG9rZW4ucy5zdWJzdHIoIDAsIDIgKSA9PT0gJ2luJyA/ICcgJyArIHRva2VuLnMgKyAnICcgOiB0b2tlbi5zICkgKyBzdHJpbmdpZnkoIHRva2VuLm9bIDEgXSwgcmVmcyApO1xuXHRcdFx0XHRjYXNlIHR5cGVzLklOVk9DQVRJT046XG5cdFx0XHRcdFx0cmV0dXJuIHN0cmluZ2lmeSggdG9rZW4ueCwgcmVmcyApICsgJygnICsgKCB0b2tlbi5vID8gdG9rZW4uby5tYXAoIG1hcCApLmpvaW4oICcsJyApIDogJycgKSArICcpJztcblx0XHRcdFx0Y2FzZSB0eXBlcy5CUkFDS0VURUQ6XG5cdFx0XHRcdFx0cmV0dXJuICcoJyArIHN0cmluZ2lmeSggdG9rZW4ueCwgcmVmcyApICsgJyknO1xuXHRcdFx0XHRjYXNlIHR5cGVzLk1FTUJFUjpcblx0XHRcdFx0XHRyZXR1cm4gc3RyaW5naWZ5KCB0b2tlbi54LCByZWZzICkgKyBzdHJpbmdpZnkoIHRva2VuLnIsIHJlZnMgKTtcblx0XHRcdFx0Y2FzZSB0eXBlcy5SRUZJTkVNRU5UOlxuXHRcdFx0XHRcdHJldHVybiB0b2tlbi5uID8gJy4nICsgdG9rZW4ubiA6ICdbJyArIHN0cmluZ2lmeSggdG9rZW4ueCwgcmVmcyApICsgJ10nO1xuXHRcdFx0XHRjYXNlIHR5cGVzLkNPTkRJVElPTkFMOlxuXHRcdFx0XHRcdHJldHVybiBzdHJpbmdpZnkoIHRva2VuLm9bIDAgXSwgcmVmcyApICsgJz8nICsgc3RyaW5naWZ5KCB0b2tlbi5vWyAxIF0sIHJlZnMgKSArICc6JyArIHN0cmluZ2lmeSggdG9rZW4ub1sgMiBdLCByZWZzICk7XG5cdFx0XHRcdGNhc2UgdHlwZXMuUkVGRVJFTkNFOlxuXHRcdFx0XHRcdHJldHVybiAnJHsnICsgcmVmcy5pbmRleE9mKCB0b2tlbi5uICkgKyAnfSc7XG5cdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnQ291bGQgbm90IHN0cmluZ2lmeSBleHByZXNzaW9uIHRva2VuLiBUaGlzIGVycm9yIGlzIHVuZXhwZWN0ZWQnICk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KCBjb25maWdfdHlwZXMsIHV0aWxzX2lzT2JqZWN0ICk7XG5cblx0dmFyIHBhcnNlX1BhcnNlcl9nZXRNdXN0YWNoZV9NdXN0YWNoZVN0dWJfX011c3RhY2hlU3R1YiA9IGZ1bmN0aW9uKCB0eXBlcywgRXhwcmVzc2lvblN0dWIgKSB7XG5cblx0XHR2YXIgTXVzdGFjaGVTdHViID0gZnVuY3Rpb24oIHRva2VuLCBwYXJzZXIgKSB7XG5cdFx0XHR0aGlzLnR5cGUgPSB0b2tlbi50eXBlID09PSB0eXBlcy5UUklQTEUgPyB0eXBlcy5UUklQTEUgOiB0b2tlbi5tdXN0YWNoZVR5cGU7XG5cdFx0XHRpZiAoIHRva2VuLnJlZiApIHtcblx0XHRcdFx0dGhpcy5yZWYgPSB0b2tlbi5yZWY7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRva2VuLmV4cHJlc3Npb24gKSB7XG5cdFx0XHRcdHRoaXMuZXhwciA9IG5ldyBFeHByZXNzaW9uU3R1YiggdG9rZW4uZXhwcmVzc2lvbiApO1xuXHRcdFx0fVxuXHRcdFx0cGFyc2VyLnBvcyArPSAxO1xuXHRcdH07XG5cdFx0TXVzdGFjaGVTdHViLnByb3RvdHlwZSA9IHtcblx0XHRcdHRvSlNPTjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBqc29uO1xuXHRcdFx0XHRpZiAoIHRoaXMuanNvbiApIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5qc29uO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGpzb24gPSB7XG5cdFx0XHRcdFx0dDogdGhpcy50eXBlXG5cdFx0XHRcdH07XG5cdFx0XHRcdGlmICggdGhpcy5yZWYgKSB7XG5cdFx0XHRcdFx0anNvbi5yID0gdGhpcy5yZWY7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCB0aGlzLmV4cHIgKSB7XG5cdFx0XHRcdFx0anNvbi54ID0gdGhpcy5leHByLnRvSlNPTigpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuanNvbiA9IGpzb247XG5cdFx0XHRcdHJldHVybiBqc29uO1xuXHRcdFx0fSxcblx0XHRcdHRvU3RyaW5nOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIE11c3RhY2hlU3R1Yjtcblx0fSggY29uZmlnX3R5cGVzLCBwYXJzZV9QYXJzZXJfZ2V0TXVzdGFjaGVfRXhwcmVzc2lvblN0dWJfX0V4cHJlc3Npb25TdHViICk7XG5cblx0dmFyIHBhcnNlX1BhcnNlcl91dGlsc19zdHJpbmdpZnlTdHVicyA9IGZ1bmN0aW9uKCBpdGVtcyApIHtcblx0XHR2YXIgc3RyID0gJycsXG5cdFx0XHRpdGVtU3RyLCBpLCBsZW47XG5cdFx0aWYgKCAhaXRlbXMgKSB7XG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0fVxuXHRcdGZvciAoIGkgPSAwLCBsZW4gPSBpdGVtcy5sZW5ndGg7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdGl0ZW1TdHIgPSBpdGVtc1sgaSBdLnRvU3RyaW5nKCk7XG5cdFx0XHRpZiAoIGl0ZW1TdHIgPT09IGZhbHNlICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRzdHIgKz0gaXRlbVN0cjtcblx0XHR9XG5cdFx0cmV0dXJuIHN0cjtcblx0fTtcblxuXHR2YXIgcGFyc2VfUGFyc2VyX3V0aWxzX2pzb25pZnlTdHVicyA9IGZ1bmN0aW9uKCBzdHJpbmdpZnlTdHVicyApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggaXRlbXMsIG5vU3RyaW5naWZ5LCB0b3BMZXZlbCApIHtcblx0XHRcdHZhciBzdHIsIGpzb247XG5cdFx0XHRpZiAoICF0b3BMZXZlbCAmJiAhbm9TdHJpbmdpZnkgKSB7XG5cdFx0XHRcdHN0ciA9IHN0cmluZ2lmeVN0dWJzKCBpdGVtcyApO1xuXHRcdFx0XHRpZiAoIHN0ciAhPT0gZmFsc2UgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHN0cjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0anNvbiA9IGl0ZW1zLm1hcCggZnVuY3Rpb24oIGl0ZW0gKSB7XG5cdFx0XHRcdHJldHVybiBpdGVtLnRvSlNPTiggbm9TdHJpbmdpZnkgKTtcblx0XHRcdH0gKTtcblx0XHRcdHJldHVybiBqc29uO1xuXHRcdH07XG5cdH0oIHBhcnNlX1BhcnNlcl91dGlsc19zdHJpbmdpZnlTdHVicyApO1xuXG5cdHZhciBwYXJzZV9QYXJzZXJfZ2V0TXVzdGFjaGVfU2VjdGlvblN0dWJfX1NlY3Rpb25TdHViID0gZnVuY3Rpb24oIHR5cGVzLCBub3JtYWxpc2VLZXlwYXRoLCBqc29uaWZ5U3R1YnMsIEV4cHJlc3Npb25TdHViICkge1xuXG5cdFx0dmFyIFNlY3Rpb25TdHViID0gZnVuY3Rpb24oIGZpcnN0VG9rZW4sIHBhcnNlciApIHtcblx0XHRcdHZhciBuZXh0O1xuXHRcdFx0dGhpcy5yZWYgPSBmaXJzdFRva2VuLnJlZjtcblx0XHRcdHRoaXMuaW5kZXhSZWYgPSBmaXJzdFRva2VuLmluZGV4UmVmO1xuXHRcdFx0dGhpcy5pbnZlcnRlZCA9IGZpcnN0VG9rZW4ubXVzdGFjaGVUeXBlID09PSB0eXBlcy5JTlZFUlRFRDtcblx0XHRcdGlmICggZmlyc3RUb2tlbi5leHByZXNzaW9uICkge1xuXHRcdFx0XHR0aGlzLmV4cHIgPSBuZXcgRXhwcmVzc2lvblN0dWIoIGZpcnN0VG9rZW4uZXhwcmVzc2lvbiApO1xuXHRcdFx0fVxuXHRcdFx0cGFyc2VyLnBvcyArPSAxO1xuXHRcdFx0dGhpcy5pdGVtcyA9IFtdO1xuXHRcdFx0bmV4dCA9IHBhcnNlci5uZXh0KCk7XG5cdFx0XHR3aGlsZSAoIG5leHQgKSB7XG5cdFx0XHRcdGlmICggbmV4dC5tdXN0YWNoZVR5cGUgPT09IHR5cGVzLkNMT1NJTkcgKSB7XG5cdFx0XHRcdFx0aWYgKCBub3JtYWxpc2VLZXlwYXRoKCBuZXh0LnJlZi50cmltKCkgKSA9PT0gdGhpcy5yZWYgfHwgdGhpcy5leHByICkge1xuXHRcdFx0XHRcdFx0cGFyc2VyLnBvcyArPSAxO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ0NvdWxkIG5vdCBwYXJzZSB0ZW1wbGF0ZTogSWxsZWdhbCBjbG9zaW5nIHNlY3Rpb24nICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuaXRlbXMucHVzaCggcGFyc2VyLmdldFN0dWIoKSApO1xuXHRcdFx0XHRuZXh0ID0gcGFyc2VyLm5leHQoKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdFNlY3Rpb25TdHViLnByb3RvdHlwZSA9IHtcblx0XHRcdHRvSlNPTjogZnVuY3Rpb24oIG5vU3RyaW5naWZ5ICkge1xuXHRcdFx0XHR2YXIganNvbjtcblx0XHRcdFx0aWYgKCB0aGlzLmpzb24gKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuanNvbjtcblx0XHRcdFx0fVxuXHRcdFx0XHRqc29uID0ge1xuXHRcdFx0XHRcdHQ6IHR5cGVzLlNFQ1RJT05cblx0XHRcdFx0fTtcblx0XHRcdFx0aWYgKCB0aGlzLnJlZiApIHtcblx0XHRcdFx0XHRqc29uLnIgPSB0aGlzLnJlZjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHRoaXMuaW5kZXhSZWYgKSB7XG5cdFx0XHRcdFx0anNvbi5pID0gdGhpcy5pbmRleFJlZjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHRoaXMuaW52ZXJ0ZWQgKSB7XG5cdFx0XHRcdFx0anNvbi5uID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHRoaXMuZXhwciApIHtcblx0XHRcdFx0XHRqc29uLnggPSB0aGlzLmV4cHIudG9KU09OKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCB0aGlzLml0ZW1zLmxlbmd0aCApIHtcblx0XHRcdFx0XHRqc29uLmYgPSBqc29uaWZ5U3R1YnMoIHRoaXMuaXRlbXMsIG5vU3RyaW5naWZ5ICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5qc29uID0ganNvbjtcblx0XHRcdFx0cmV0dXJuIGpzb247XG5cdFx0XHR9LFxuXHRcdFx0dG9TdHJpbmc6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gU2VjdGlvblN0dWI7XG5cdH0oIGNvbmZpZ190eXBlcywgdXRpbHNfbm9ybWFsaXNlS2V5cGF0aCwgcGFyc2VfUGFyc2VyX3V0aWxzX2pzb25pZnlTdHVicywgcGFyc2VfUGFyc2VyX2dldE11c3RhY2hlX0V4cHJlc3Npb25TdHViX19FeHByZXNzaW9uU3R1YiApO1xuXG5cdHZhciBwYXJzZV9QYXJzZXJfZ2V0TXVzdGFjaGVfX2dldE11c3RhY2hlID0gZnVuY3Rpb24oIHR5cGVzLCBNdXN0YWNoZVN0dWIsIFNlY3Rpb25TdHViICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB0b2tlbiApIHtcblx0XHRcdGlmICggdG9rZW4udHlwZSA9PT0gdHlwZXMuTVVTVEFDSEUgfHwgdG9rZW4udHlwZSA9PT0gdHlwZXMuVFJJUExFICkge1xuXHRcdFx0XHRpZiAoIHRva2VuLm11c3RhY2hlVHlwZSA9PT0gdHlwZXMuU0VDVElPTiB8fCB0b2tlbi5tdXN0YWNoZVR5cGUgPT09IHR5cGVzLklOVkVSVEVEICkge1xuXHRcdFx0XHRcdHJldHVybiBuZXcgU2VjdGlvblN0dWIoIHRva2VuLCB0aGlzICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIG5ldyBNdXN0YWNoZVN0dWIoIHRva2VuLCB0aGlzICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fSggY29uZmlnX3R5cGVzLCBwYXJzZV9QYXJzZXJfZ2V0TXVzdGFjaGVfTXVzdGFjaGVTdHViX19NdXN0YWNoZVN0dWIsIHBhcnNlX1BhcnNlcl9nZXRNdXN0YWNoZV9TZWN0aW9uU3R1Yl9fU2VjdGlvblN0dWIgKTtcblxuXHR2YXIgcGFyc2VfUGFyc2VyX2dldEVsZW1lbnRfRWxlbWVudFN0dWJfdXRpbHNfc2libGluZ3NCeVRhZ05hbWUgPSB7XG5cdFx0bGk6IFsgJ2xpJyBdLFxuXHRcdGR0OiBbXG5cdFx0XHQnZHQnLFxuXHRcdFx0J2RkJ1xuXHRcdF0sXG5cdFx0ZGQ6IFtcblx0XHRcdCdkdCcsXG5cdFx0XHQnZGQnXG5cdFx0XSxcblx0XHRwOiAnYWRkcmVzcyBhcnRpY2xlIGFzaWRlIGJsb2NrcXVvdGUgZGlyIGRpdiBkbCBmaWVsZHNldCBmb290ZXIgZm9ybSBoMSBoMiBoMyBoNCBoNSBoNiBoZWFkZXIgaGdyb3VwIGhyIG1lbnUgbmF2IG9sIHAgcHJlIHNlY3Rpb24gdGFibGUgdWwnLnNwbGl0KCAnICcgKSxcblx0XHRydDogW1xuXHRcdFx0J3J0Jyxcblx0XHRcdCdycCdcblx0XHRdLFxuXHRcdHJwOiBbXG5cdFx0XHQncnAnLFxuXHRcdFx0J3J0J1xuXHRcdF0sXG5cdFx0b3B0Z3JvdXA6IFsgJ29wdGdyb3VwJyBdLFxuXHRcdG9wdGlvbjogW1xuXHRcdFx0J29wdGlvbicsXG5cdFx0XHQnb3B0Z3JvdXAnXG5cdFx0XSxcblx0XHR0aGVhZDogW1xuXHRcdFx0J3Rib2R5Jyxcblx0XHRcdCd0Zm9vdCdcblx0XHRdLFxuXHRcdHRib2R5OiBbXG5cdFx0XHQndGJvZHknLFxuXHRcdFx0J3Rmb290J1xuXHRcdF0sXG5cdFx0dHI6IFsgJ3RyJyBdLFxuXHRcdHRkOiBbXG5cdFx0XHQndGQnLFxuXHRcdFx0J3RoJ1xuXHRcdF0sXG5cdFx0dGg6IFtcblx0XHRcdCd0ZCcsXG5cdFx0XHQndGgnXG5cdFx0XVxuXHR9O1xuXG5cdHZhciBwYXJzZV9QYXJzZXJfZ2V0RWxlbWVudF9FbGVtZW50U3R1Yl91dGlsc19maWx0ZXJBdHRyaWJ1dGVzID0gZnVuY3Rpb24oIGlzQXJyYXkgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIGl0ZW1zICkge1xuXHRcdFx0dmFyIGF0dHJzLCBwcm94aWVzLCBmaWx0ZXJlZCwgaSwgbGVuLCBpdGVtO1xuXHRcdFx0ZmlsdGVyZWQgPSB7fTtcblx0XHRcdGF0dHJzID0gW107XG5cdFx0XHRwcm94aWVzID0gW107XG5cdFx0XHRsZW4gPSBpdGVtcy5sZW5ndGg7XG5cdFx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRpdGVtID0gaXRlbXNbIGkgXTtcblx0XHRcdFx0aWYgKCBpdGVtLm5hbWUgPT09ICdpbnRybycgKSB7XG5cdFx0XHRcdFx0aWYgKCBmaWx0ZXJlZC5pbnRybyApIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ0FuIGVsZW1lbnQgY2FuIG9ubHkgaGF2ZSBvbmUgaW50cm8gdHJhbnNpdGlvbicgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZmlsdGVyZWQuaW50cm8gPSBpdGVtO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCBpdGVtLm5hbWUgPT09ICdvdXRybycgKSB7XG5cdFx0XHRcdFx0aWYgKCBmaWx0ZXJlZC5vdXRybyApIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ0FuIGVsZW1lbnQgY2FuIG9ubHkgaGF2ZSBvbmUgb3V0cm8gdHJhbnNpdGlvbicgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZmlsdGVyZWQub3V0cm8gPSBpdGVtO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCBpdGVtLm5hbWUgPT09ICdpbnRyby1vdXRybycgKSB7XG5cdFx0XHRcdFx0aWYgKCBmaWx0ZXJlZC5pbnRybyB8fCBmaWx0ZXJlZC5vdXRybyApIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ0FuIGVsZW1lbnQgY2FuIG9ubHkgaGF2ZSBvbmUgaW50cm8gYW5kIG9uZSBvdXRybyB0cmFuc2l0aW9uJyApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRmaWx0ZXJlZC5pbnRybyA9IGl0ZW07XG5cdFx0XHRcdFx0ZmlsdGVyZWQub3V0cm8gPSBkZWVwQ2xvbmUoIGl0ZW0gKTtcblx0XHRcdFx0fSBlbHNlIGlmICggaXRlbS5uYW1lLnN1YnN0ciggMCwgNiApID09PSAncHJveHktJyApIHtcblx0XHRcdFx0XHRpdGVtLm5hbWUgPSBpdGVtLm5hbWUuc3Vic3RyaW5nKCA2ICk7XG5cdFx0XHRcdFx0cHJveGllcy5wdXNoKCBpdGVtICk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoIGl0ZW0ubmFtZS5zdWJzdHIoIDAsIDMgKSA9PT0gJ29uLScgKSB7XG5cdFx0XHRcdFx0aXRlbS5uYW1lID0gaXRlbS5uYW1lLnN1YnN0cmluZyggMyApO1xuXHRcdFx0XHRcdHByb3hpZXMucHVzaCggaXRlbSApO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCBpdGVtLm5hbWUgPT09ICdkZWNvcmF0b3InICkge1xuXHRcdFx0XHRcdGZpbHRlcmVkLmRlY29yYXRvciA9IGl0ZW07XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YXR0cnMucHVzaCggaXRlbSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRmaWx0ZXJlZC5hdHRycyA9IGF0dHJzO1xuXHRcdFx0ZmlsdGVyZWQucHJveGllcyA9IHByb3hpZXM7XG5cdFx0XHRyZXR1cm4gZmlsdGVyZWQ7XG5cdFx0fTtcblxuXHRcdGZ1bmN0aW9uIGRlZXBDbG9uZSggb2JqICkge1xuXHRcdFx0dmFyIHJlc3VsdCwga2V5O1xuXHRcdFx0aWYgKCB0eXBlb2Ygb2JqICE9PSAnb2JqZWN0JyApIHtcblx0XHRcdFx0cmV0dXJuIG9iajtcblx0XHRcdH1cblx0XHRcdGlmICggaXNBcnJheSggb2JqICkgKSB7XG5cdFx0XHRcdHJldHVybiBvYmoubWFwKCBkZWVwQ2xvbmUgKTtcblx0XHRcdH1cblx0XHRcdHJlc3VsdCA9IHt9O1xuXHRcdFx0Zm9yICgga2V5IGluIG9iaiApIHtcblx0XHRcdFx0aWYgKCBvYmouaGFzT3duUHJvcGVydHkoIGtleSApICkge1xuXHRcdFx0XHRcdHJlc3VsdFsga2V5IF0gPSBkZWVwQ2xvbmUoIG9ialsga2V5IF0gKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cdH0oIHV0aWxzX2lzQXJyYXkgKTtcblxuXHR2YXIgcGFyc2VfUGFyc2VyX2dldEVsZW1lbnRfRWxlbWVudFN0dWJfdXRpbHNfcHJvY2Vzc0RpcmVjdGl2ZSA9IGZ1bmN0aW9uKCB0eXBlcywgcGFyc2VKU09OICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBkaXJlY3RpdmUgKSB7XG5cdFx0XHR2YXIgcHJvY2Vzc2VkLCB0b2tlbnMsIHRva2VuLCBjb2xvbkluZGV4LCB0aHJvd0Vycm9yLCBkaXJlY3RpdmVOYW1lLCBkaXJlY3RpdmVBcmdzLCBwYXJzZWQ7XG5cdFx0XHR0aHJvd0Vycm9yID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ0lsbGVnYWwgZGlyZWN0aXZlJyApO1xuXHRcdFx0fTtcblx0XHRcdGlmICggIWRpcmVjdGl2ZS5uYW1lIHx8ICFkaXJlY3RpdmUudmFsdWUgKSB7XG5cdFx0XHRcdHRocm93RXJyb3IoKTtcblx0XHRcdH1cblx0XHRcdHByb2Nlc3NlZCA9IHtcblx0XHRcdFx0ZGlyZWN0aXZlVHlwZTogZGlyZWN0aXZlLm5hbWVcblx0XHRcdH07XG5cdFx0XHR0b2tlbnMgPSBkaXJlY3RpdmUudmFsdWU7XG5cdFx0XHRkaXJlY3RpdmVOYW1lID0gW107XG5cdFx0XHRkaXJlY3RpdmVBcmdzID0gW107XG5cdFx0XHR3aGlsZSAoIHRva2Vucy5sZW5ndGggKSB7XG5cdFx0XHRcdHRva2VuID0gdG9rZW5zLnNoaWZ0KCk7XG5cdFx0XHRcdGlmICggdG9rZW4udHlwZSA9PT0gdHlwZXMuVEVYVCApIHtcblx0XHRcdFx0XHRjb2xvbkluZGV4ID0gdG9rZW4udmFsdWUuaW5kZXhPZiggJzonICk7XG5cdFx0XHRcdFx0aWYgKCBjb2xvbkluZGV4ID09PSAtMSApIHtcblx0XHRcdFx0XHRcdGRpcmVjdGl2ZU5hbWUucHVzaCggdG9rZW4gKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0aWYgKCBjb2xvbkluZGV4ICkge1xuXHRcdFx0XHRcdFx0XHRkaXJlY3RpdmVOYW1lLnB1c2goIHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiB0eXBlcy5URVhULFxuXHRcdFx0XHRcdFx0XHRcdHZhbHVlOiB0b2tlbi52YWx1ZS5zdWJzdHIoIDAsIGNvbG9uSW5kZXggKVxuXHRcdFx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoIHRva2VuLnZhbHVlLmxlbmd0aCA+IGNvbG9uSW5kZXggKyAxICkge1xuXHRcdFx0XHRcdFx0XHRkaXJlY3RpdmVBcmdzWyAwIF0gPSB7XG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogdHlwZXMuVEVYVCxcblx0XHRcdFx0XHRcdFx0XHR2YWx1ZTogdG9rZW4udmFsdWUuc3Vic3RyaW5nKCBjb2xvbkluZGV4ICsgMSApXG5cdFx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZGlyZWN0aXZlTmFtZS5wdXNoKCB0b2tlbiApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRkaXJlY3RpdmVBcmdzID0gZGlyZWN0aXZlQXJncy5jb25jYXQoIHRva2VucyApO1xuXHRcdFx0aWYgKCBkaXJlY3RpdmVOYW1lLmxlbmd0aCA9PT0gMSAmJiBkaXJlY3RpdmVOYW1lWyAwIF0udHlwZSA9PT0gdHlwZXMuVEVYVCApIHtcblx0XHRcdFx0cHJvY2Vzc2VkLm5hbWUgPSBkaXJlY3RpdmVOYW1lWyAwIF0udmFsdWU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRwcm9jZXNzZWQubmFtZSA9IGRpcmVjdGl2ZU5hbWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGRpcmVjdGl2ZUFyZ3MubGVuZ3RoICkge1xuXHRcdFx0XHRpZiAoIGRpcmVjdGl2ZUFyZ3MubGVuZ3RoID09PSAxICYmIGRpcmVjdGl2ZUFyZ3NbIDAgXS50eXBlID09PSB0eXBlcy5URVhUICkge1xuXHRcdFx0XHRcdHBhcnNlZCA9IHBhcnNlSlNPTiggJ1snICsgZGlyZWN0aXZlQXJnc1sgMCBdLnZhbHVlICsgJ10nICk7XG5cdFx0XHRcdFx0cHJvY2Vzc2VkLmFyZ3MgPSBwYXJzZWQgPyBwYXJzZWQudmFsdWUgOiBkaXJlY3RpdmVBcmdzWyAwIF0udmFsdWU7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cHJvY2Vzc2VkLmR5bmFtaWNBcmdzID0gZGlyZWN0aXZlQXJncztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHByb2Nlc3NlZDtcblx0XHR9O1xuXHR9KCBjb25maWdfdHlwZXMsIHV0aWxzX3BhcnNlSlNPTiApO1xuXG5cdHZhciBwYXJzZV9QYXJzZXJfU3RyaW5nU3R1Yl9TdHJpbmdQYXJzZXIgPSBmdW5jdGlvbiggZ2V0VGV4dCwgZ2V0TXVzdGFjaGUgKSB7XG5cblx0XHR2YXIgU3RyaW5nUGFyc2VyO1xuXHRcdFN0cmluZ1BhcnNlciA9IGZ1bmN0aW9uKCB0b2tlbnMsIG9wdGlvbnMgKSB7XG5cdFx0XHR2YXIgc3R1Yjtcblx0XHRcdHRoaXMudG9rZW5zID0gdG9rZW5zIHx8IFtdO1xuXHRcdFx0dGhpcy5wb3MgPSAwO1xuXHRcdFx0dGhpcy5vcHRpb25zID0gb3B0aW9ucztcblx0XHRcdHRoaXMucmVzdWx0ID0gW107XG5cdFx0XHR3aGlsZSAoIHN0dWIgPSB0aGlzLmdldFN0dWIoKSApIHtcblx0XHRcdFx0dGhpcy5yZXN1bHQucHVzaCggc3R1YiApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0U3RyaW5nUGFyc2VyLnByb3RvdHlwZSA9IHtcblx0XHRcdGdldFN0dWI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgdG9rZW4gPSB0aGlzLm5leHQoKTtcblx0XHRcdFx0aWYgKCAhdG9rZW4gKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRoaXMuZ2V0VGV4dCggdG9rZW4gKSB8fCB0aGlzLmdldE11c3RhY2hlKCB0b2tlbiApO1xuXHRcdFx0fSxcblx0XHRcdGdldFRleHQ6IGdldFRleHQsXG5cdFx0XHRnZXRNdXN0YWNoZTogZ2V0TXVzdGFjaGUsXG5cdFx0XHRuZXh0OiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMudG9rZW5zWyB0aGlzLnBvcyBdO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIFN0cmluZ1BhcnNlcjtcblx0fSggcGFyc2VfUGFyc2VyX2dldFRleHRfX2dldFRleHQsIHBhcnNlX1BhcnNlcl9nZXRNdXN0YWNoZV9fZ2V0TXVzdGFjaGUgKTtcblxuXHR2YXIgcGFyc2VfUGFyc2VyX1N0cmluZ1N0dWJfX1N0cmluZ1N0dWIgPSBmdW5jdGlvbiggU3RyaW5nUGFyc2VyLCBzdHJpbmdpZnlTdHVicywganNvbmlmeVN0dWJzICkge1xuXG5cdFx0dmFyIFN0cmluZ1N0dWI7XG5cdFx0U3RyaW5nU3R1YiA9IGZ1bmN0aW9uKCB0b2tlbnMgKSB7XG5cdFx0XHR2YXIgcGFyc2VyID0gbmV3IFN0cmluZ1BhcnNlciggdG9rZW5zICk7XG5cdFx0XHR0aGlzLnN0dWJzID0gcGFyc2VyLnJlc3VsdDtcblx0XHR9O1xuXHRcdFN0cmluZ1N0dWIucHJvdG90eXBlID0ge1xuXHRcdFx0dG9KU09OOiBmdW5jdGlvbiggbm9TdHJpbmdpZnkgKSB7XG5cdFx0XHRcdHZhciBqc29uO1xuXHRcdFx0XHRpZiAoIHRoaXNbICdqc29uXycgKyBub1N0cmluZ2lmeSBdICkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzWyAnanNvbl8nICsgbm9TdHJpbmdpZnkgXTtcblx0XHRcdFx0fVxuXHRcdFx0XHRqc29uID0gdGhpc1sgJ2pzb25fJyArIG5vU3RyaW5naWZ5IF0gPSBqc29uaWZ5U3R1YnMoIHRoaXMuc3R1YnMsIG5vU3RyaW5naWZ5ICk7XG5cdFx0XHRcdHJldHVybiBqc29uO1xuXHRcdFx0fSxcblx0XHRcdHRvU3RyaW5nOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0aWYgKCB0aGlzLnN0ciAhPT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLnN0cjtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLnN0ciA9IHN0cmluZ2lmeVN0dWJzKCB0aGlzLnN0dWJzICk7XG5cdFx0XHRcdHJldHVybiB0aGlzLnN0cjtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBTdHJpbmdTdHViO1xuXHR9KCBwYXJzZV9QYXJzZXJfU3RyaW5nU3R1Yl9TdHJpbmdQYXJzZXIsIHBhcnNlX1BhcnNlcl91dGlsc19zdHJpbmdpZnlTdHVicywgcGFyc2VfUGFyc2VyX3V0aWxzX2pzb25pZnlTdHVicyApO1xuXG5cdHZhciBwYXJzZV9QYXJzZXJfZ2V0RWxlbWVudF9FbGVtZW50U3R1Yl91dGlsc19qc29uaWZ5RGlyZWN0aXZlID0gZnVuY3Rpb24oIFN0cmluZ1N0dWIgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIGRpcmVjdGl2ZSApIHtcblx0XHRcdHZhciByZXN1bHQsIG5hbWU7XG5cdFx0XHRpZiAoIHR5cGVvZiBkaXJlY3RpdmUubmFtZSA9PT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdGlmICggIWRpcmVjdGl2ZS5hcmdzICYmICFkaXJlY3RpdmUuZHluYW1pY0FyZ3MgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGRpcmVjdGl2ZS5uYW1lO1xuXHRcdFx0XHR9XG5cdFx0XHRcdG5hbWUgPSBkaXJlY3RpdmUubmFtZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG5hbWUgPSBuZXcgU3RyaW5nU3R1YiggZGlyZWN0aXZlLm5hbWUgKS50b0pTT04oKTtcblx0XHRcdH1cblx0XHRcdHJlc3VsdCA9IHtcblx0XHRcdFx0bjogbmFtZVxuXHRcdFx0fTtcblx0XHRcdGlmICggZGlyZWN0aXZlLmFyZ3MgKSB7XG5cdFx0XHRcdHJlc3VsdC5hID0gZGlyZWN0aXZlLmFyZ3M7XG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGRpcmVjdGl2ZS5keW5hbWljQXJncyApIHtcblx0XHRcdFx0cmVzdWx0LmQgPSBuZXcgU3RyaW5nU3R1YiggZGlyZWN0aXZlLmR5bmFtaWNBcmdzICkudG9KU09OKCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH07XG5cdH0oIHBhcnNlX1BhcnNlcl9TdHJpbmdTdHViX19TdHJpbmdTdHViICk7XG5cblx0dmFyIHBhcnNlX1BhcnNlcl9nZXRFbGVtZW50X0VsZW1lbnRTdHViX3RvSlNPTiA9IGZ1bmN0aW9uKCB0eXBlcywganNvbmlmeVN0dWJzLCBqc29uaWZ5RGlyZWN0aXZlICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBub1N0cmluZ2lmeSApIHtcblx0XHRcdHZhciBqc29uLCBuYW1lLCB2YWx1ZSwgcHJveHksIGksIGxlbiwgYXR0cmlidXRlO1xuXHRcdFx0aWYgKCB0aGlzWyAnanNvbl8nICsgbm9TdHJpbmdpZnkgXSApIHtcblx0XHRcdFx0cmV0dXJuIHRoaXNbICdqc29uXycgKyBub1N0cmluZ2lmeSBdO1xuXHRcdFx0fVxuXHRcdFx0anNvbiA9IHtcblx0XHRcdFx0dDogdHlwZXMuRUxFTUVOVCxcblx0XHRcdFx0ZTogdGhpcy50YWdcblx0XHRcdH07XG5cdFx0XHRpZiAoIHRoaXMuZG9jdHlwZSApIHtcblx0XHRcdFx0anNvbi55ID0gMTtcblx0XHRcdH1cblx0XHRcdGlmICggdGhpcy5hdHRyaWJ1dGVzICYmIHRoaXMuYXR0cmlidXRlcy5sZW5ndGggKSB7XG5cdFx0XHRcdGpzb24uYSA9IHt9O1xuXHRcdFx0XHRsZW4gPSB0aGlzLmF0dHJpYnV0ZXMubGVuZ3RoO1xuXHRcdFx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRcdGF0dHJpYnV0ZSA9IHRoaXMuYXR0cmlidXRlc1sgaSBdO1xuXHRcdFx0XHRcdG5hbWUgPSBhdHRyaWJ1dGUubmFtZTtcblx0XHRcdFx0XHRpZiAoIGpzb24uYVsgbmFtZSBdICkge1xuXHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnWW91IGNhbm5vdCBoYXZlIG11bHRpcGxlIGF0dHJpYnV0ZXMgd2l0aCB0aGUgc2FtZSBuYW1lJyApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIGF0dHJpYnV0ZS52YWx1ZSA9PT0gbnVsbCApIHtcblx0XHRcdFx0XHRcdHZhbHVlID0gbnVsbDtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dmFsdWUgPSBhdHRyaWJ1dGUudmFsdWUudG9KU09OKCBub1N0cmluZ2lmeSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRqc29uLmFbIG5hbWUgXSA9IHZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRoaXMuaXRlbXMgJiYgdGhpcy5pdGVtcy5sZW5ndGggKSB7XG5cdFx0XHRcdGpzb24uZiA9IGpzb25pZnlTdHVicyggdGhpcy5pdGVtcywgbm9TdHJpbmdpZnkgKTtcblx0XHRcdH1cblx0XHRcdGlmICggdGhpcy5wcm94aWVzICYmIHRoaXMucHJveGllcy5sZW5ndGggKSB7XG5cdFx0XHRcdGpzb24udiA9IHt9O1xuXHRcdFx0XHRsZW4gPSB0aGlzLnByb3hpZXMubGVuZ3RoO1xuXHRcdFx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRcdHByb3h5ID0gdGhpcy5wcm94aWVzWyBpIF07XG5cdFx0XHRcdFx0anNvbi52WyBwcm94eS5kaXJlY3RpdmVUeXBlIF0gPSBqc29uaWZ5RGlyZWN0aXZlKCBwcm94eSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRoaXMuaW50cm8gKSB7XG5cdFx0XHRcdGpzb24udDEgPSBqc29uaWZ5RGlyZWN0aXZlKCB0aGlzLmludHJvICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRoaXMub3V0cm8gKSB7XG5cdFx0XHRcdGpzb24udDIgPSBqc29uaWZ5RGlyZWN0aXZlKCB0aGlzLm91dHJvICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRoaXMuZGVjb3JhdG9yICkge1xuXHRcdFx0XHRqc29uLm8gPSBqc29uaWZ5RGlyZWN0aXZlKCB0aGlzLmRlY29yYXRvciApO1xuXHRcdFx0fVxuXHRcdFx0dGhpc1sgJ2pzb25fJyArIG5vU3RyaW5naWZ5IF0gPSBqc29uO1xuXHRcdFx0cmV0dXJuIGpzb247XG5cdFx0fTtcblx0fSggY29uZmlnX3R5cGVzLCBwYXJzZV9QYXJzZXJfdXRpbHNfanNvbmlmeVN0dWJzLCBwYXJzZV9QYXJzZXJfZ2V0RWxlbWVudF9FbGVtZW50U3R1Yl91dGlsc19qc29uaWZ5RGlyZWN0aXZlICk7XG5cblx0dmFyIHBhcnNlX1BhcnNlcl9nZXRFbGVtZW50X0VsZW1lbnRTdHViX3RvU3RyaW5nID0gZnVuY3Rpb24oIHN0cmluZ2lmeVN0dWJzLCB2b2lkRWxlbWVudE5hbWVzICkge1xuXG5cdFx0dmFyIGh0bWxFbGVtZW50cztcblx0XHRodG1sRWxlbWVudHMgPSAnYSBhYmJyIGFjcm9ueW0gYWRkcmVzcyBhcHBsZXQgYXJlYSBiIGJhc2UgYmFzZWZvbnQgYmRvIGJpZyBibG9ja3F1b3RlIGJvZHkgYnIgYnV0dG9uIGNhcHRpb24gY2VudGVyIGNpdGUgY29kZSBjb2wgY29sZ3JvdXAgZGQgZGVsIGRmbiBkaXIgZGl2IGRsIGR0IGVtIGZpZWxkc2V0IGZvbnQgZm9ybSBmcmFtZSBmcmFtZXNldCBoMSBoMiBoMyBoNCBoNSBoNiBoZWFkIGhyIGh0bWwgaSBpZnJhbWUgaW1nIGlucHV0IGlucyBpc2luZGV4IGtiZCBsYWJlbCBsZWdlbmQgbGkgbGluayBtYXAgbWVudSBtZXRhIG5vZnJhbWVzIG5vc2NyaXB0IG9iamVjdCBvbCBwIHBhcmFtIHByZSBxIHMgc2FtcCBzY3JpcHQgc2VsZWN0IHNtYWxsIHNwYW4gc3RyaWtlIHN0cm9uZyBzdHlsZSBzdWIgc3VwIHRleHRhcmVhIHRpdGxlIHR0IHUgdWwgdmFyIGFydGljbGUgYXNpZGUgYXVkaW8gYmRpIGNhbnZhcyBjb21tYW5kIGRhdGEgZGF0YWdyaWQgZGF0YWxpc3QgZGV0YWlscyBlbWJlZCBldmVudHNvdXJjZSBmaWdjYXB0aW9uIGZpZ3VyZSBmb290ZXIgaGVhZGVyIGhncm91cCBrZXlnZW4gbWFyayBtZXRlciBuYXYgb3V0cHV0IHByb2dyZXNzIHJ1YnkgcnAgcnQgc2VjdGlvbiBzb3VyY2Ugc3VtbWFyeSB0aW1lIHRyYWNrIHZpZGVvIHdicicuc3BsaXQoICcgJyApO1xuXHRcdHJldHVybiBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBzdHIsIGksIGxlbiwgYXR0clN0ciwgbmFtZSwgYXR0clZhbHVlU3RyLCBmcmFnU3RyLCBpc1ZvaWQ7XG5cdFx0XHRpZiAoIHRoaXMuc3RyICE9PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnN0cjtcblx0XHRcdH1cblx0XHRcdGlmICggaHRtbEVsZW1lbnRzLmluZGV4T2YoIHRoaXMudGFnLnRvTG93ZXJDYXNlKCkgKSA9PT0gLTEgKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnN0ciA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aGlzLnByb3hpZXMgfHwgdGhpcy5pbnRybyB8fCB0aGlzLm91dHJvIHx8IHRoaXMuZGVjb3JhdG9yICkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5zdHIgPSBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGZyYWdTdHIgPSBzdHJpbmdpZnlTdHVicyggdGhpcy5pdGVtcyApO1xuXHRcdFx0aWYgKCBmcmFnU3RyID09PSBmYWxzZSApIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuc3RyID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpc1ZvaWQgPSB2b2lkRWxlbWVudE5hbWVzLmluZGV4T2YoIHRoaXMudGFnLnRvTG93ZXJDYXNlKCkgKSAhPT0gLTE7XG5cdFx0XHRzdHIgPSAnPCcgKyB0aGlzLnRhZztcblx0XHRcdGlmICggdGhpcy5hdHRyaWJ1dGVzICkge1xuXHRcdFx0XHRmb3IgKCBpID0gMCwgbGVuID0gdGhpcy5hdHRyaWJ1dGVzLmxlbmd0aDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRcdG5hbWUgPSB0aGlzLmF0dHJpYnV0ZXNbIGkgXS5uYW1lO1xuXHRcdFx0XHRcdGlmICggbmFtZS5pbmRleE9mKCAnOicgKSAhPT0gLTEgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdGhpcy5zdHIgPSBmYWxzZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCBuYW1lID09PSAnaWQnIHx8IG5hbWUgPT09ICdpbnRybycgfHwgbmFtZSA9PT0gJ291dHJvJyApIHtcblx0XHRcdFx0XHRcdHJldHVybiB0aGlzLnN0ciA9IGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRhdHRyU3RyID0gJyAnICsgbmFtZTtcblx0XHRcdFx0XHRpZiAoIHRoaXMuYXR0cmlidXRlc1sgaSBdLnZhbHVlICE9PSBudWxsICkge1xuXHRcdFx0XHRcdFx0YXR0clZhbHVlU3RyID0gdGhpcy5hdHRyaWJ1dGVzWyBpIF0udmFsdWUudG9TdHJpbmcoKTtcblx0XHRcdFx0XHRcdGlmICggYXR0clZhbHVlU3RyID09PSBmYWxzZSApIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuc3RyID0gZmFsc2U7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoIGF0dHJWYWx1ZVN0ciAhPT0gJycgKSB7XG5cdFx0XHRcdFx0XHRcdGF0dHJTdHIgKz0gJz0nO1xuXHRcdFx0XHRcdFx0XHRpZiAoIC9bXFxzXCInPTw+YF0vLnRlc3QoIGF0dHJWYWx1ZVN0ciApICkge1xuXHRcdFx0XHRcdFx0XHRcdGF0dHJTdHIgKz0gJ1wiJyArIGF0dHJWYWx1ZVN0ci5yZXBsYWNlKCAvXCIvZywgJyZxdW90OycgKSArICdcIic7XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0YXR0clN0ciArPSBhdHRyVmFsdWVTdHI7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0c3RyICs9IGF0dHJTdHI7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICggdGhpcy5zZWxmQ2xvc2luZyAmJiAhaXNWb2lkICkge1xuXHRcdFx0XHRzdHIgKz0gJy8+Jztcblx0XHRcdFx0cmV0dXJuIHRoaXMuc3RyID0gc3RyO1xuXHRcdFx0fVxuXHRcdFx0c3RyICs9ICc+Jztcblx0XHRcdGlmICggaXNWb2lkICkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5zdHIgPSBzdHI7XG5cdFx0XHR9XG5cdFx0XHRzdHIgKz0gZnJhZ1N0cjtcblx0XHRcdHN0ciArPSAnPC8nICsgdGhpcy50YWcgKyAnPic7XG5cdFx0XHRyZXR1cm4gdGhpcy5zdHIgPSBzdHI7XG5cdFx0fTtcblx0fSggcGFyc2VfUGFyc2VyX3V0aWxzX3N0cmluZ2lmeVN0dWJzLCBjb25maWdfdm9pZEVsZW1lbnROYW1lcyApO1xuXG5cdHZhciBwYXJzZV9QYXJzZXJfZ2V0RWxlbWVudF9FbGVtZW50U3R1Yl9fRWxlbWVudFN0dWIgPSBmdW5jdGlvbiggdHlwZXMsIHZvaWRFbGVtZW50TmFtZXMsIHdhcm4sIHNpYmxpbmdzQnlUYWdOYW1lLCBmaWx0ZXJBdHRyaWJ1dGVzLCBwcm9jZXNzRGlyZWN0aXZlLCB0b0pTT04sIHRvU3RyaW5nLCBTdHJpbmdTdHViICkge1xuXG5cdFx0dmFyIEVsZW1lbnRTdHViLCBhbGxFbGVtZW50TmFtZXMsIGNsb3NlZEJ5UGFyZW50Q2xvc2UsIG9uUGF0dGVybiwgc2FuaXRpemUsIGxlYWRpbmdXaGl0ZXNwYWNlID0gL15cXHMrLyxcblx0XHRcdHRyYWlsaW5nV2hpdGVzcGFjZSA9IC9cXHMrJC87XG5cdFx0RWxlbWVudFN0dWIgPSBmdW5jdGlvbiggZmlyc3RUb2tlbiwgcGFyc2VyLCBwcmVzZXJ2ZVdoaXRlc3BhY2UgKSB7XG5cdFx0XHR2YXIgbmV4dCwgYXR0cnMsIGZpbHRlcmVkLCBwcm94aWVzLCBpdGVtLCBnZXRGcmFnLCBsb3dlckNhc2VUYWc7XG5cdFx0XHRwYXJzZXIucG9zICs9IDE7XG5cdFx0XHRnZXRGcmFnID0gZnVuY3Rpb24oIGF0dHIgKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0bmFtZTogYXR0ci5uYW1lLFxuXHRcdFx0XHRcdHZhbHVlOiBhdHRyLnZhbHVlID8gbmV3IFN0cmluZ1N0dWIoIGF0dHIudmFsdWUgKSA6IG51bGxcblx0XHRcdFx0fTtcblx0XHRcdH07XG5cdFx0XHR0aGlzLnRhZyA9IGZpcnN0VG9rZW4ubmFtZTtcblx0XHRcdGxvd2VyQ2FzZVRhZyA9IGZpcnN0VG9rZW4ubmFtZS50b0xvd2VyQ2FzZSgpO1xuXHRcdFx0aWYgKCBsb3dlckNhc2VUYWcuc3Vic3RyKCAwLCAzICkgPT09ICdydi0nICkge1xuXHRcdFx0XHR3YXJuKCAnVGhlIFwicnYtXCIgcHJlZml4IGZvciBjb21wb25lbnRzIGhhcyBiZWVuIGRlcHJlY2F0ZWQuIFN1cHBvcnQgd2lsbCBiZSByZW1vdmVkIGluIGEgZnV0dXJlIHZlcnNpb24nICk7XG5cdFx0XHRcdHRoaXMudGFnID0gdGhpcy50YWcuc3Vic3RyaW5nKCAzICk7XG5cdFx0XHR9XG5cdFx0XHRwcmVzZXJ2ZVdoaXRlc3BhY2UgPSBwcmVzZXJ2ZVdoaXRlc3BhY2UgfHwgbG93ZXJDYXNlVGFnID09PSAncHJlJyB8fCBsb3dlckNhc2VUYWcgPT09ICdzdHlsZScgfHwgbG93ZXJDYXNlVGFnID09PSAnc2NyaXB0Jztcblx0XHRcdGlmICggZmlyc3RUb2tlbi5hdHRycyApIHtcblx0XHRcdFx0ZmlsdGVyZWQgPSBmaWx0ZXJBdHRyaWJ1dGVzKCBmaXJzdFRva2VuLmF0dHJzICk7XG5cdFx0XHRcdGF0dHJzID0gZmlsdGVyZWQuYXR0cnM7XG5cdFx0XHRcdHByb3hpZXMgPSBmaWx0ZXJlZC5wcm94aWVzO1xuXHRcdFx0XHRpZiAoIHBhcnNlci5vcHRpb25zLnNhbml0aXplICYmIHBhcnNlci5vcHRpb25zLnNhbml0aXplLmV2ZW50QXR0cmlidXRlcyApIHtcblx0XHRcdFx0XHRhdHRycyA9IGF0dHJzLmZpbHRlciggc2FuaXRpemUgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIGF0dHJzLmxlbmd0aCApIHtcblx0XHRcdFx0XHR0aGlzLmF0dHJpYnV0ZXMgPSBhdHRycy5tYXAoIGdldEZyYWcgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHByb3hpZXMubGVuZ3RoICkge1xuXHRcdFx0XHRcdHRoaXMucHJveGllcyA9IHByb3hpZXMubWFwKCBwcm9jZXNzRGlyZWN0aXZlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBmaWx0ZXJlZC5pbnRybyApIHtcblx0XHRcdFx0XHR0aGlzLmludHJvID0gcHJvY2Vzc0RpcmVjdGl2ZSggZmlsdGVyZWQuaW50cm8gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIGZpbHRlcmVkLm91dHJvICkge1xuXHRcdFx0XHRcdHRoaXMub3V0cm8gPSBwcm9jZXNzRGlyZWN0aXZlKCBmaWx0ZXJlZC5vdXRybyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggZmlsdGVyZWQuZGVjb3JhdG9yICkge1xuXHRcdFx0XHRcdHRoaXMuZGVjb3JhdG9yID0gcHJvY2Vzc0RpcmVjdGl2ZSggZmlsdGVyZWQuZGVjb3JhdG9yICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICggZmlyc3RUb2tlbi5kb2N0eXBlICkge1xuXHRcdFx0XHR0aGlzLmRvY3R5cGUgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBmaXJzdFRva2VuLnNlbGZDbG9zaW5nICkge1xuXHRcdFx0XHR0aGlzLnNlbGZDbG9zaW5nID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICggdm9pZEVsZW1lbnROYW1lcy5pbmRleE9mKCBsb3dlckNhc2VUYWcgKSAhPT0gLTEgKSB7XG5cdFx0XHRcdHRoaXMuaXNWb2lkID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICggdGhpcy5zZWxmQ2xvc2luZyB8fCB0aGlzLmlzVm9pZCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5zaWJsaW5ncyA9IHNpYmxpbmdzQnlUYWdOYW1lWyBsb3dlckNhc2VUYWcgXTtcblx0XHRcdHRoaXMuaXRlbXMgPSBbXTtcblx0XHRcdG5leHQgPSBwYXJzZXIubmV4dCgpO1xuXHRcdFx0d2hpbGUgKCBuZXh0ICkge1xuXHRcdFx0XHRpZiAoIG5leHQubXVzdGFjaGVUeXBlID09PSB0eXBlcy5DTE9TSU5HICkge1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggbmV4dC50eXBlID09PSB0eXBlcy5UQUcgKSB7XG5cdFx0XHRcdFx0aWYgKCBuZXh0LmNsb3NpbmcgKSB7XG5cdFx0XHRcdFx0XHRpZiAoIG5leHQubmFtZS50b0xvd2VyQ2FzZSgpID09PSBsb3dlckNhc2VUYWcgKSB7XG5cdFx0XHRcdFx0XHRcdHBhcnNlci5wb3MgKz0gMTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoIHRoaXMuc2libGluZ3MgJiYgdGhpcy5zaWJsaW5ncy5pbmRleE9mKCBuZXh0Lm5hbWUudG9Mb3dlckNhc2UoKSApICE9PSAtMSApIHtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLml0ZW1zLnB1c2goIHBhcnNlci5nZXRTdHViKCBwcmVzZXJ2ZVdoaXRlc3BhY2UgKSApO1xuXHRcdFx0XHRuZXh0ID0gcGFyc2VyLm5leHQoKTtcblx0XHRcdH1cblx0XHRcdGlmICggIXByZXNlcnZlV2hpdGVzcGFjZSApIHtcblx0XHRcdFx0aXRlbSA9IHRoaXMuaXRlbXNbIDAgXTtcblx0XHRcdFx0aWYgKCBpdGVtICYmIGl0ZW0udHlwZSA9PT0gdHlwZXMuVEVYVCApIHtcblx0XHRcdFx0XHRpdGVtLnRleHQgPSBpdGVtLnRleHQucmVwbGFjZSggbGVhZGluZ1doaXRlc3BhY2UsICcnICk7XG5cdFx0XHRcdFx0aWYgKCAhaXRlbS50ZXh0ICkge1xuXHRcdFx0XHRcdFx0dGhpcy5pdGVtcy5zaGlmdCgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpdGVtID0gdGhpcy5pdGVtc1sgdGhpcy5pdGVtcy5sZW5ndGggLSAxIF07XG5cdFx0XHRcdGlmICggaXRlbSAmJiBpdGVtLnR5cGUgPT09IHR5cGVzLlRFWFQgKSB7XG5cdFx0XHRcdFx0aXRlbS50ZXh0ID0gaXRlbS50ZXh0LnJlcGxhY2UoIHRyYWlsaW5nV2hpdGVzcGFjZSwgJycgKTtcblx0XHRcdFx0XHRpZiAoICFpdGVtLnRleHQgKSB7XG5cdFx0XHRcdFx0XHR0aGlzLml0ZW1zLnBvcCgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdFx0RWxlbWVudFN0dWIucHJvdG90eXBlID0ge1xuXHRcdFx0dG9KU09OOiB0b0pTT04sXG5cdFx0XHR0b1N0cmluZzogdG9TdHJpbmdcblx0XHR9O1xuXHRcdGFsbEVsZW1lbnROYW1lcyA9ICdhIGFiYnIgYWNyb255bSBhZGRyZXNzIGFwcGxldCBhcmVhIGIgYmFzZSBiYXNlZm9udCBiZG8gYmlnIGJsb2NrcXVvdGUgYm9keSBiciBidXR0b24gY2FwdGlvbiBjZW50ZXIgY2l0ZSBjb2RlIGNvbCBjb2xncm91cCBkZCBkZWwgZGZuIGRpciBkaXYgZGwgZHQgZW0gZmllbGRzZXQgZm9udCBmb3JtIGZyYW1lIGZyYW1lc2V0IGgxIGgyIGgzIGg0IGg1IGg2IGhlYWQgaHIgaHRtbCBpIGlmcmFtZSBpbWcgaW5wdXQgaW5zIGlzaW5kZXgga2JkIGxhYmVsIGxlZ2VuZCBsaSBsaW5rIG1hcCBtZW51IG1ldGEgbm9mcmFtZXMgbm9zY3JpcHQgb2JqZWN0IG9sIHAgcGFyYW0gcHJlIHEgcyBzYW1wIHNjcmlwdCBzZWxlY3Qgc21hbGwgc3BhbiBzdHJpa2Ugc3Ryb25nIHN0eWxlIHN1YiBzdXAgdGV4dGFyZWEgdGl0bGUgdHQgdSB1bCB2YXIgYXJ0aWNsZSBhc2lkZSBhdWRpbyBiZGkgY2FudmFzIGNvbW1hbmQgZGF0YSBkYXRhZ3JpZCBkYXRhbGlzdCBkZXRhaWxzIGVtYmVkIGV2ZW50c291cmNlIGZpZ2NhcHRpb24gZmlndXJlIGZvb3RlciBoZWFkZXIgaGdyb3VwIGtleWdlbiBtYXJrIG1ldGVyIG5hdiBvdXRwdXQgcHJvZ3Jlc3MgcnVieSBycCBydCBzZWN0aW9uIHNvdXJjZSBzdW1tYXJ5IHRpbWUgdHJhY2sgdmlkZW8gd2JyJy5zcGxpdCggJyAnICk7XG5cdFx0Y2xvc2VkQnlQYXJlbnRDbG9zZSA9ICdsaSBkZCBydCBycCBvcHRncm91cCBvcHRpb24gdGJvZHkgdGZvb3QgdHIgdGQgdGgnLnNwbGl0KCAnICcgKTtcblx0XHRvblBhdHRlcm4gPSAvXm9uW2EtekEtWl0vO1xuXHRcdHNhbml0aXplID0gZnVuY3Rpb24oIGF0dHIgKSB7XG5cdFx0XHR2YXIgdmFsaWQgPSAhb25QYXR0ZXJuLnRlc3QoIGF0dHIubmFtZSApO1xuXHRcdFx0cmV0dXJuIHZhbGlkO1xuXHRcdH07XG5cdFx0cmV0dXJuIEVsZW1lbnRTdHViO1xuXHR9KCBjb25maWdfdHlwZXMsIGNvbmZpZ192b2lkRWxlbWVudE5hbWVzLCB1dGlsc193YXJuLCBwYXJzZV9QYXJzZXJfZ2V0RWxlbWVudF9FbGVtZW50U3R1Yl91dGlsc19zaWJsaW5nc0J5VGFnTmFtZSwgcGFyc2VfUGFyc2VyX2dldEVsZW1lbnRfRWxlbWVudFN0dWJfdXRpbHNfZmlsdGVyQXR0cmlidXRlcywgcGFyc2VfUGFyc2VyX2dldEVsZW1lbnRfRWxlbWVudFN0dWJfdXRpbHNfcHJvY2Vzc0RpcmVjdGl2ZSwgcGFyc2VfUGFyc2VyX2dldEVsZW1lbnRfRWxlbWVudFN0dWJfdG9KU09OLCBwYXJzZV9QYXJzZXJfZ2V0RWxlbWVudF9FbGVtZW50U3R1Yl90b1N0cmluZywgcGFyc2VfUGFyc2VyX1N0cmluZ1N0dWJfX1N0cmluZ1N0dWIgKTtcblxuXHR2YXIgcGFyc2VfUGFyc2VyX2dldEVsZW1lbnRfX2dldEVsZW1lbnQgPSBmdW5jdGlvbiggdHlwZXMsIEVsZW1lbnRTdHViICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB0b2tlbiApIHtcblx0XHRcdGlmICggdGhpcy5vcHRpb25zLnNhbml0aXplICYmIHRoaXMub3B0aW9ucy5zYW5pdGl6ZS5lbGVtZW50cyApIHtcblx0XHRcdFx0aWYgKCB0aGlzLm9wdGlvbnMuc2FuaXRpemUuZWxlbWVudHMuaW5kZXhPZiggdG9rZW4ubmFtZS50b0xvd2VyQ2FzZSgpICkgIT09IC0xICkge1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbmV3IEVsZW1lbnRTdHViKCB0b2tlbiwgdGhpcywgdGhpcy5wcmVzZXJ2ZVdoaXRlc3BhY2UgKTtcblx0XHR9O1xuXHR9KCBjb25maWdfdHlwZXMsIHBhcnNlX1BhcnNlcl9nZXRFbGVtZW50X0VsZW1lbnRTdHViX19FbGVtZW50U3R1YiApO1xuXG5cdHZhciBwYXJzZV9QYXJzZXJfX1BhcnNlciA9IGZ1bmN0aW9uKCBnZXRUZXh0LCBnZXRDb21tZW50LCBnZXRNdXN0YWNoZSwgZ2V0RWxlbWVudCwganNvbmlmeVN0dWJzICkge1xuXG5cdFx0dmFyIFBhcnNlcjtcblx0XHRQYXJzZXIgPSBmdW5jdGlvbiggdG9rZW5zLCBvcHRpb25zICkge1xuXHRcdFx0dmFyIHN0dWIsIHN0dWJzO1xuXHRcdFx0dGhpcy50b2tlbnMgPSB0b2tlbnMgfHwgW107XG5cdFx0XHR0aGlzLnBvcyA9IDA7XG5cdFx0XHR0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuXHRcdFx0dGhpcy5wcmVzZXJ2ZVdoaXRlc3BhY2UgPSBvcHRpb25zLnByZXNlcnZlV2hpdGVzcGFjZTtcblx0XHRcdHN0dWJzID0gW107XG5cdFx0XHR3aGlsZSAoIHN0dWIgPSB0aGlzLmdldFN0dWIoKSApIHtcblx0XHRcdFx0c3R1YnMucHVzaCggc3R1YiApO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5yZXN1bHQgPSBqc29uaWZ5U3R1YnMoIHN0dWJzLCBvcHRpb25zLm5vU3RyaW5naWZ5LCB0cnVlICk7XG5cdFx0fTtcblx0XHRQYXJzZXIucHJvdG90eXBlID0ge1xuXHRcdFx0Z2V0U3R1YjogZnVuY3Rpb24oIHByZXNlcnZlV2hpdGVzcGFjZSApIHtcblx0XHRcdFx0dmFyIHRva2VuID0gdGhpcy5uZXh0KCk7XG5cdFx0XHRcdGlmICggIXRva2VuICkge1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0aGlzLmdldFRleHQoIHRva2VuLCB0aGlzLnByZXNlcnZlV2hpdGVzcGFjZSB8fCBwcmVzZXJ2ZVdoaXRlc3BhY2UgKSB8fCB0aGlzLmdldENvbW1lbnQoIHRva2VuICkgfHwgdGhpcy5nZXRNdXN0YWNoZSggdG9rZW4gKSB8fCB0aGlzLmdldEVsZW1lbnQoIHRva2VuICk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0VGV4dDogZ2V0VGV4dCxcblx0XHRcdGdldENvbW1lbnQ6IGdldENvbW1lbnQsXG5cdFx0XHRnZXRNdXN0YWNoZTogZ2V0TXVzdGFjaGUsXG5cdFx0XHRnZXRFbGVtZW50OiBnZXRFbGVtZW50LFxuXHRcdFx0bmV4dDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnRva2Vuc1sgdGhpcy5wb3MgXTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBQYXJzZXI7XG5cdH0oIHBhcnNlX1BhcnNlcl9nZXRUZXh0X19nZXRUZXh0LCBwYXJzZV9QYXJzZXJfZ2V0Q29tbWVudF9fZ2V0Q29tbWVudCwgcGFyc2VfUGFyc2VyX2dldE11c3RhY2hlX19nZXRNdXN0YWNoZSwgcGFyc2VfUGFyc2VyX2dldEVsZW1lbnRfX2dldEVsZW1lbnQsIHBhcnNlX1BhcnNlcl91dGlsc19qc29uaWZ5U3R1YnMgKTtcblxuXHQvLyBSYWN0aXZlLnBhcnNlXG5cdC8vID09PT09PT09PT09PT09PVxuXHQvL1xuXHQvLyBUYWtlcyBpbiBhIHN0cmluZywgYW5kIHJldHVybnMgYW4gb2JqZWN0IHJlcHJlc2VudGluZyB0aGUgcGFyc2VkIHRlbXBsYXRlLlxuXHQvLyBBIHBhcnNlZCB0ZW1wbGF0ZSBpcyBhbiBhcnJheSBvZiAxIG9yIG1vcmUgJ2Rlc2NyaXB0b3JzJywgd2hpY2ggaW4gc29tZVxuXHQvLyBjYXNlcyBoYXZlIGNoaWxkcmVuLlxuXHQvL1xuXHQvLyBUaGUgZm9ybWF0IGlzIG9wdGltaXNlZCBmb3Igc2l6ZSwgbm90IHJlYWRhYmlsaXR5LCBob3dldmVyIGZvciByZWZlcmVuY2UgdGhlXG5cdC8vIGtleXMgZm9yIGVhY2ggZGVzY3JpcHRvciBhcmUgYXMgZm9sbG93czpcblx0Ly9cblx0Ly8gKiByIC0gUmVmZXJlbmNlLCBlLmcuICdtdXN0YWNoZScgaW4ge3ttdXN0YWNoZX19XG5cdC8vICogdCAtIFR5cGUgY29kZSAoZS5nLiAxIGlzIHRleHQsIDIgaXMgaW50ZXJwb2xhdG9yLi4uKVxuXHQvLyAqIGYgLSBGcmFnbWVudC4gQ29udGFpbnMgYSBkZXNjcmlwdG9yJ3MgY2hpbGRyZW5cblx0Ly8gKiBlIC0gRWxlbWVudCBuYW1lXG5cdC8vICogYSAtIG1hcCBvZiBlbGVtZW50IEF0dHJpYnV0ZXMsIG9yIHByb3h5IGV2ZW50L3RyYW5zaXRpb24gQXJndW1lbnRzXG5cdC8vICogZCAtIER5bmFtaWMgcHJveHkgZXZlbnQvdHJhbnNpdGlvbiBhcmd1bWVudHNcblx0Ly8gKiBuIC0gaW5kaWNhdGVzIGFuIGlOdmVydGVkIHNlY3Rpb25cblx0Ly8gKiBpIC0gSW5kZXggcmVmZXJlbmNlLCBlLmcuICdudW0nIGluIHt7I3NlY3Rpb246bnVtfX1jb250ZW50e3svc2VjdGlvbn19XG5cdC8vICogdiAtIGVWZW50IHByb3hpZXMgKGkuZS4gd2hlbiB1c2VyIGUuZy4gY2xpY2tzIG9uIGEgbm9kZSwgZmlyZSBwcm94eSBldmVudClcblx0Ly8gKiB4IC0gZVhwcmVzc2lvbnNcblx0Ly8gKiBzIC0gU3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIGFuIGV4cHJlc3Npb24gZnVuY3Rpb25cblx0Ly8gKiB0MSAtIGludHJvIFRyYW5zaXRpb25cblx0Ly8gKiB0MiAtIG91dHJvIFRyYW5zaXRpb25cblx0Ly8gKiBvIC0gZGVjT3JhdG9yXG5cdC8vICogeSAtIGlzIGRvY3RZcGVcblx0dmFyIHBhcnNlX19wYXJzZSA9IGZ1bmN0aW9uKCB0b2tlbml6ZSwgdHlwZXMsIFBhcnNlciApIHtcblxuXHRcdHZhciBwYXJzZSwgb25seVdoaXRlc3BhY2UsIGlubGluZVBhcnRpYWxTdGFydCwgaW5saW5lUGFydGlhbEVuZCwgcGFyc2VDb21wb3VuZFRlbXBsYXRlO1xuXHRcdG9ubHlXaGl0ZXNwYWNlID0gL15cXHMqJC87XG5cdFx0aW5saW5lUGFydGlhbFN0YXJ0ID0gLzwhLS1cXHMqXFx7XFx7XFxzKj5cXHMqKFthLXpBLVpfJF1bYS16QS1aXyQwLTldKilcXHMqfVxcfVxccyotLT4vO1xuXHRcdGlubGluZVBhcnRpYWxFbmQgPSAvPCEtLVxccypcXHtcXHtcXHMqXFwvXFxzKihbYS16QS1aXyRdW2EtekEtWl8kMC05XSopXFxzKn1cXH1cXHMqLS0+Lztcblx0XHRwYXJzZSA9IGZ1bmN0aW9uKCB0ZW1wbGF0ZSwgb3B0aW9ucyApIHtcblx0XHRcdHZhciB0b2tlbnMsIGpzb24sIHRva2VuO1xuXHRcdFx0b3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cdFx0XHRpZiAoIGlubGluZVBhcnRpYWxTdGFydC50ZXN0KCB0ZW1wbGF0ZSApICkge1xuXHRcdFx0XHRyZXR1cm4gcGFyc2VDb21wb3VuZFRlbXBsYXRlKCB0ZW1wbGF0ZSwgb3B0aW9ucyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBvcHRpb25zLnNhbml0aXplID09PSB0cnVlICkge1xuXHRcdFx0XHRvcHRpb25zLnNhbml0aXplID0ge1xuXHRcdFx0XHRcdGVsZW1lbnRzOiAnYXBwbGV0IGJhc2UgYmFzZWZvbnQgYm9keSBmcmFtZSBmcmFtZXNldCBoZWFkIGh0bWwgaXNpbmRleCBsaW5rIG1ldGEgbm9mcmFtZXMgbm9zY3JpcHQgb2JqZWN0IHBhcmFtIHNjcmlwdCBzdHlsZSB0aXRsZScuc3BsaXQoICcgJyApLFxuXHRcdFx0XHRcdGV2ZW50QXR0cmlidXRlczogdHJ1ZVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdFx0dG9rZW5zID0gdG9rZW5pemUoIHRlbXBsYXRlLCBvcHRpb25zICk7XG5cdFx0XHRpZiAoICFvcHRpb25zLnByZXNlcnZlV2hpdGVzcGFjZSApIHtcblx0XHRcdFx0dG9rZW4gPSB0b2tlbnNbIDAgXTtcblx0XHRcdFx0aWYgKCB0b2tlbiAmJiB0b2tlbi50eXBlID09PSB0eXBlcy5URVhUICYmIG9ubHlXaGl0ZXNwYWNlLnRlc3QoIHRva2VuLnZhbHVlICkgKSB7XG5cdFx0XHRcdFx0dG9rZW5zLnNoaWZ0KCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dG9rZW4gPSB0b2tlbnNbIHRva2Vucy5sZW5ndGggLSAxIF07XG5cdFx0XHRcdGlmICggdG9rZW4gJiYgdG9rZW4udHlwZSA9PT0gdHlwZXMuVEVYVCAmJiBvbmx5V2hpdGVzcGFjZS50ZXN0KCB0b2tlbi52YWx1ZSApICkge1xuXHRcdFx0XHRcdHRva2Vucy5wb3AoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0anNvbiA9IG5ldyBQYXJzZXIoIHRva2Vucywgb3B0aW9ucyApLnJlc3VsdDtcblx0XHRcdGlmICggdHlwZW9mIGpzb24gPT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHRyZXR1cm4gWyBqc29uIF07XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4ganNvbjtcblx0XHR9O1xuXHRcdHBhcnNlQ29tcG91bmRUZW1wbGF0ZSA9IGZ1bmN0aW9uKCB0ZW1wbGF0ZSwgb3B0aW9ucyApIHtcblx0XHRcdHZhciBtYWluVGVtcGxhdGUsIHJlbWFpbmluZywgcGFydGlhbHMsIG5hbWUsIHN0YXJ0TWF0Y2gsIGVuZE1hdGNoO1xuXHRcdFx0cGFydGlhbHMgPSB7fTtcblx0XHRcdG1haW5UZW1wbGF0ZSA9ICcnO1xuXHRcdFx0cmVtYWluaW5nID0gdGVtcGxhdGU7XG5cdFx0XHR3aGlsZSAoIHN0YXJ0TWF0Y2ggPSBpbmxpbmVQYXJ0aWFsU3RhcnQuZXhlYyggcmVtYWluaW5nICkgKSB7XG5cdFx0XHRcdG5hbWUgPSBzdGFydE1hdGNoWyAxIF07XG5cdFx0XHRcdG1haW5UZW1wbGF0ZSArPSByZW1haW5pbmcuc3Vic3RyKCAwLCBzdGFydE1hdGNoLmluZGV4ICk7XG5cdFx0XHRcdHJlbWFpbmluZyA9IHJlbWFpbmluZy5zdWJzdHJpbmcoIHN0YXJ0TWF0Y2guaW5kZXggKyBzdGFydE1hdGNoWyAwIF0ubGVuZ3RoICk7XG5cdFx0XHRcdGVuZE1hdGNoID0gaW5saW5lUGFydGlhbEVuZC5leGVjKCByZW1haW5pbmcgKTtcblx0XHRcdFx0aWYgKCAhZW5kTWF0Y2ggfHwgZW5kTWF0Y2hbIDEgXSAhPT0gbmFtZSApIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdJbmxpbmUgcGFydGlhbHMgbXVzdCBoYXZlIGEgY2xvc2luZyBkZWxpbWl0ZXIsIGFuZCBjYW5ub3QgYmUgbmVzdGVkJyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHBhcnRpYWxzWyBuYW1lIF0gPSBwYXJzZSggcmVtYWluaW5nLnN1YnN0ciggMCwgZW5kTWF0Y2guaW5kZXggKSwgb3B0aW9ucyApO1xuXHRcdFx0XHRyZW1haW5pbmcgPSByZW1haW5pbmcuc3Vic3RyaW5nKCBlbmRNYXRjaC5pbmRleCArIGVuZE1hdGNoWyAwIF0ubGVuZ3RoICk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRtYWluOiBwYXJzZSggbWFpblRlbXBsYXRlLCBvcHRpb25zICksXG5cdFx0XHRcdHBhcnRpYWxzOiBwYXJ0aWFsc1xuXHRcdFx0fTtcblx0XHR9O1xuXHRcdHJldHVybiBwYXJzZTtcblx0fSggcGFyc2VfdG9rZW5pemUsIGNvbmZpZ190eXBlcywgcGFyc2VfUGFyc2VyX19QYXJzZXIgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X1BhcnRpYWxfZGVJbmRlbnQgPSBmdW5jdGlvbigpIHtcblxuXHRcdHZhciBlbXB0eSA9IC9eXFxzKiQvLFxuXHRcdFx0bGVhZGluZ1doaXRlc3BhY2UgPSAvXlxccyovO1xuXHRcdHJldHVybiBmdW5jdGlvbiggc3RyICkge1xuXHRcdFx0dmFyIGxpbmVzLCBmaXJzdExpbmUsIGxhc3RMaW5lLCBtaW5JbmRlbnQ7XG5cdFx0XHRsaW5lcyA9IHN0ci5zcGxpdCggJ1xcbicgKTtcblx0XHRcdGZpcnN0TGluZSA9IGxpbmVzWyAwIF07XG5cdFx0XHRpZiAoIGZpcnN0TGluZSAhPT0gdW5kZWZpbmVkICYmIGVtcHR5LnRlc3QoIGZpcnN0TGluZSApICkge1xuXHRcdFx0XHRsaW5lcy5zaGlmdCgpO1xuXHRcdFx0fVxuXHRcdFx0bGFzdExpbmUgPSBsaW5lc1sgbGluZXMubGVuZ3RoIC0gMSBdO1xuXHRcdFx0aWYgKCBsYXN0TGluZSAhPT0gdW5kZWZpbmVkICYmIGVtcHR5LnRlc3QoIGxhc3RMaW5lICkgKSB7XG5cdFx0XHRcdGxpbmVzLnBvcCgpO1xuXHRcdFx0fVxuXHRcdFx0bWluSW5kZW50ID0gbGluZXMucmVkdWNlKCByZWR1Y2VyLCBudWxsICk7XG5cdFx0XHRpZiAoIG1pbkluZGVudCApIHtcblx0XHRcdFx0c3RyID0gbGluZXMubWFwKCBmdW5jdGlvbiggbGluZSApIHtcblx0XHRcdFx0XHRyZXR1cm4gbGluZS5yZXBsYWNlKCBtaW5JbmRlbnQsICcnICk7XG5cdFx0XHRcdH0gKS5qb2luKCAnXFxuJyApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHN0cjtcblx0XHR9O1xuXG5cdFx0ZnVuY3Rpb24gcmVkdWNlciggcHJldmlvdXMsIGxpbmUgKSB7XG5cdFx0XHR2YXIgbGluZUluZGVudCA9IGxlYWRpbmdXaGl0ZXNwYWNlLmV4ZWMoIGxpbmUgKVsgMCBdO1xuXHRcdFx0aWYgKCBwcmV2aW91cyA9PT0gbnVsbCB8fCBsaW5lSW5kZW50Lmxlbmd0aCA8IHByZXZpb3VzLmxlbmd0aCApIHtcblx0XHRcdFx0cmV0dXJuIGxpbmVJbmRlbnQ7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcHJldmlvdXM7XG5cdFx0fVxuXHR9KCk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9QYXJ0aWFsX2dldFBhcnRpYWxEZXNjcmlwdG9yID0gZnVuY3Rpb24oIGVycm9ycywgaXNDbGllbnQsIHdhcm4sIGlzT2JqZWN0LCBwYXJ0aWFscywgcGFyc2UsIGRlSW5kZW50ICkge1xuXG5cdFx0dmFyIGdldFBhcnRpYWxEZXNjcmlwdG9yLCByZWdpc3RlclBhcnRpYWwsIGdldFBhcnRpYWxGcm9tUmVnaXN0cnksIHVucGFjaztcblx0XHRnZXRQYXJ0aWFsRGVzY3JpcHRvciA9IGZ1bmN0aW9uKCByb290LCBuYW1lICkge1xuXHRcdFx0dmFyIGVsLCBwYXJ0aWFsLCBlcnJvck1lc3NhZ2U7XG5cdFx0XHRpZiAoIHBhcnRpYWwgPSBnZXRQYXJ0aWFsRnJvbVJlZ2lzdHJ5KCByb290LCBuYW1lICkgKSB7XG5cdFx0XHRcdHJldHVybiBwYXJ0aWFsO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBpc0NsaWVudCApIHtcblx0XHRcdFx0ZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggbmFtZSApO1xuXHRcdFx0XHRpZiAoIGVsICYmIGVsLnRhZ05hbWUgPT09ICdTQ1JJUFQnICkge1xuXHRcdFx0XHRcdGlmICggIXBhcnNlICkge1xuXHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCBlcnJvcnMubWlzc2luZ1BhcnNlciApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZWdpc3RlclBhcnRpYWwoIHBhcnNlKCBkZUluZGVudCggZWwudGV4dCApLCByb290LnBhcnNlT3B0aW9ucyApLCBuYW1lLCBwYXJ0aWFscyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRwYXJ0aWFsID0gcGFydGlhbHNbIG5hbWUgXTtcblx0XHRcdGlmICggIXBhcnRpYWwgKSB7XG5cdFx0XHRcdGVycm9yTWVzc2FnZSA9ICdDb3VsZCBub3QgZmluZCBkZXNjcmlwdG9yIGZvciBwYXJ0aWFsIFwiJyArIG5hbWUgKyAnXCInO1xuXHRcdFx0XHRpZiAoIHJvb3QuZGVidWcgKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCBlcnJvck1lc3NhZ2UgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR3YXJuKCBlcnJvck1lc3NhZ2UgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gW107XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdW5wYWNrKCBwYXJ0aWFsICk7XG5cdFx0fTtcblx0XHRnZXRQYXJ0aWFsRnJvbVJlZ2lzdHJ5ID0gZnVuY3Rpb24oIHJhY3RpdmUsIG5hbWUgKSB7XG5cdFx0XHR2YXIgcGFydGlhbDtcblx0XHRcdGlmICggcmFjdGl2ZS5wYXJ0aWFsc1sgbmFtZSBdICkge1xuXHRcdFx0XHRpZiAoIHR5cGVvZiByYWN0aXZlLnBhcnRpYWxzWyBuYW1lIF0gPT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHRcdGlmICggIXBhcnNlICkge1xuXHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCBlcnJvcnMubWlzc2luZ1BhcnNlciApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRwYXJ0aWFsID0gcGFyc2UoIHJhY3RpdmUucGFydGlhbHNbIG5hbWUgXSwgcmFjdGl2ZS5wYXJzZU9wdGlvbnMgKTtcblx0XHRcdFx0XHRyZWdpc3RlclBhcnRpYWwoIHBhcnRpYWwsIG5hbWUsIHJhY3RpdmUucGFydGlhbHMgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdW5wYWNrKCByYWN0aXZlLnBhcnRpYWxzWyBuYW1lIF0gKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJlZ2lzdGVyUGFydGlhbCA9IGZ1bmN0aW9uKCBwYXJ0aWFsLCBuYW1lLCByZWdpc3RyeSApIHtcblx0XHRcdHZhciBrZXk7XG5cdFx0XHRpZiAoIGlzT2JqZWN0KCBwYXJ0aWFsICkgKSB7XG5cdFx0XHRcdHJlZ2lzdHJ5WyBuYW1lIF0gPSBwYXJ0aWFsLm1haW47XG5cdFx0XHRcdGZvciAoIGtleSBpbiBwYXJ0aWFsLnBhcnRpYWxzICkge1xuXHRcdFx0XHRcdGlmICggcGFydGlhbC5wYXJ0aWFscy5oYXNPd25Qcm9wZXJ0eSgga2V5ICkgKSB7XG5cdFx0XHRcdFx0XHRyZWdpc3RyeVsga2V5IF0gPSBwYXJ0aWFsLnBhcnRpYWxzWyBrZXkgXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlZ2lzdHJ5WyBuYW1lIF0gPSBwYXJ0aWFsO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0dW5wYWNrID0gZnVuY3Rpb24oIHBhcnRpYWwgKSB7XG5cdFx0XHRpZiAoIHBhcnRpYWwubGVuZ3RoID09PSAxICYmIHR5cGVvZiBwYXJ0aWFsWyAwIF0gPT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHRyZXR1cm4gcGFydGlhbFsgMCBdO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHBhcnRpYWw7XG5cdFx0fTtcblx0XHRyZXR1cm4gZ2V0UGFydGlhbERlc2NyaXB0b3I7XG5cdH0oIGNvbmZpZ19lcnJvcnMsIGNvbmZpZ19pc0NsaWVudCwgdXRpbHNfd2FybiwgdXRpbHNfaXNPYmplY3QsIHJlZ2lzdHJpZXNfcGFydGlhbHMsIHBhcnNlX19wYXJzZSwgcmVuZGVyX0RvbUZyYWdtZW50X1BhcnRpYWxfZGVJbmRlbnQgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X1BhcnRpYWxfYXBwbHlJbmRlbnQgPSBmdW5jdGlvbiggc3RyaW5nLCBpbmRlbnQgKSB7XG5cdFx0dmFyIGluZGVudGVkO1xuXHRcdGlmICggIWluZGVudCApIHtcblx0XHRcdHJldHVybiBzdHJpbmc7XG5cdFx0fVxuXHRcdGluZGVudGVkID0gc3RyaW5nLnNwbGl0KCAnXFxuJyApLm1hcCggZnVuY3Rpb24oIGxpbmUsIG5vdEZpcnN0TGluZSApIHtcblx0XHRcdHJldHVybiBub3RGaXJzdExpbmUgPyBpbmRlbnQgKyBsaW5lIDogbGluZTtcblx0XHR9ICkuam9pbiggJ1xcbicgKTtcblx0XHRyZXR1cm4gaW5kZW50ZWQ7XG5cdH07XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9QYXJ0aWFsX19QYXJ0aWFsID0gZnVuY3Rpb24oIHR5cGVzLCBnZXRQYXJ0aWFsRGVzY3JpcHRvciwgYXBwbHlJbmRlbnQsIGNpcmN1bGFyICkge1xuXG5cdFx0dmFyIERvbVBhcnRpYWwsIERvbUZyYWdtZW50O1xuXHRcdGNpcmN1bGFyLnB1c2goIGZ1bmN0aW9uKCkge1xuXHRcdFx0RG9tRnJhZ21lbnQgPSBjaXJjdWxhci5Eb21GcmFnbWVudDtcblx0XHR9ICk7XG5cdFx0RG9tUGFydGlhbCA9IGZ1bmN0aW9uKCBvcHRpb25zLCBkb2NGcmFnICkge1xuXHRcdFx0dmFyIHBhcmVudEZyYWdtZW50ID0gdGhpcy5wYXJlbnRGcmFnbWVudCA9IG9wdGlvbnMucGFyZW50RnJhZ21lbnQsXG5cdFx0XHRcdGRlc2NyaXB0b3I7XG5cdFx0XHR0aGlzLnR5cGUgPSB0eXBlcy5QQVJUSUFMO1xuXHRcdFx0dGhpcy5uYW1lID0gb3B0aW9ucy5kZXNjcmlwdG9yLnI7XG5cdFx0XHR0aGlzLmluZGV4ID0gb3B0aW9ucy5pbmRleDtcblx0XHRcdGlmICggIW9wdGlvbnMuZGVzY3JpcHRvci5yICkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdQYXJ0aWFscyBtdXN0IGhhdmUgYSBzdGF0aWMgcmVmZXJlbmNlIChubyBleHByZXNzaW9ucykuIFRoaXMgbWF5IGNoYW5nZSBpbiBhIGZ1dHVyZSB2ZXJzaW9uIG9mIFJhY3RpdmUuJyApO1xuXHRcdFx0fVxuXHRcdFx0ZGVzY3JpcHRvciA9IGdldFBhcnRpYWxEZXNjcmlwdG9yKCBwYXJlbnRGcmFnbWVudC5yb290LCBvcHRpb25zLmRlc2NyaXB0b3IuciApO1xuXHRcdFx0dGhpcy5mcmFnbWVudCA9IG5ldyBEb21GcmFnbWVudCgge1xuXHRcdFx0XHRkZXNjcmlwdG9yOiBkZXNjcmlwdG9yLFxuXHRcdFx0XHRyb290OiBwYXJlbnRGcmFnbWVudC5yb290LFxuXHRcdFx0XHRwTm9kZTogcGFyZW50RnJhZ21lbnQucE5vZGUsXG5cdFx0XHRcdG93bmVyOiB0aGlzXG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoIGRvY0ZyYWcgKSB7XG5cdFx0XHRcdGRvY0ZyYWcuYXBwZW5kQ2hpbGQoIHRoaXMuZnJhZ21lbnQuZG9jRnJhZyApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0RG9tUGFydGlhbC5wcm90b3R5cGUgPSB7XG5cdFx0XHRmaXJzdE5vZGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5mcmFnbWVudC5maXJzdE5vZGUoKTtcblx0XHRcdH0sXG5cdFx0XHRmaW5kTmV4dE5vZGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5wYXJlbnRGcmFnbWVudC5maW5kTmV4dE5vZGUoIHRoaXMgKTtcblx0XHRcdH0sXG5cdFx0XHRkZXRhY2g6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5mcmFnbWVudC5kZXRhY2goKTtcblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oIGRlc3Ryb3kgKSB7XG5cdFx0XHRcdHRoaXMuZnJhZ21lbnQudGVhcmRvd24oIGRlc3Ryb3kgKTtcblx0XHRcdH0sXG5cdFx0XHR0b1N0cmluZzogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBzdHJpbmcsIHByZXZpb3VzSXRlbSwgbGFzdExpbmUsIG1hdGNoO1xuXHRcdFx0XHRzdHJpbmcgPSB0aGlzLmZyYWdtZW50LnRvU3RyaW5nKCk7XG5cdFx0XHRcdHByZXZpb3VzSXRlbSA9IHRoaXMucGFyZW50RnJhZ21lbnQuaXRlbXNbIHRoaXMuaW5kZXggLSAxIF07XG5cdFx0XHRcdGlmICggIXByZXZpb3VzSXRlbSB8fCBwcmV2aW91c0l0ZW0udHlwZSAhPT0gdHlwZXMuVEVYVCApIHtcblx0XHRcdFx0XHRyZXR1cm4gc3RyaW5nO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGxhc3RMaW5lID0gcHJldmlvdXNJdGVtLmRlc2NyaXB0b3Iuc3BsaXQoICdcXG4nICkucG9wKCk7XG5cdFx0XHRcdGlmICggbWF0Y2ggPSAvXlxccyskLy5leGVjKCBsYXN0TGluZSApICkge1xuXHRcdFx0XHRcdHJldHVybiBhcHBseUluZGVudCggc3RyaW5nLCBtYXRjaFsgMCBdICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHN0cmluZztcblx0XHRcdH0sXG5cdFx0XHRmaW5kOiBmdW5jdGlvbiggc2VsZWN0b3IgKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmZyYWdtZW50LmZpbmQoIHNlbGVjdG9yICk7XG5cdFx0XHR9LFxuXHRcdFx0ZmluZEFsbDogZnVuY3Rpb24oIHNlbGVjdG9yLCBxdWVyeSApIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuZnJhZ21lbnQuZmluZEFsbCggc2VsZWN0b3IsIHF1ZXJ5ICk7XG5cdFx0XHR9LFxuXHRcdFx0ZmluZENvbXBvbmVudDogZnVuY3Rpb24oIHNlbGVjdG9yICkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5mcmFnbWVudC5maW5kQ29tcG9uZW50KCBzZWxlY3RvciApO1xuXHRcdFx0fSxcblx0XHRcdGZpbmRBbGxDb21wb25lbnRzOiBmdW5jdGlvbiggc2VsZWN0b3IsIHF1ZXJ5ICkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5mcmFnbWVudC5maW5kQWxsQ29tcG9uZW50cyggc2VsZWN0b3IsIHF1ZXJ5ICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gRG9tUGFydGlhbDtcblx0fSggY29uZmlnX3R5cGVzLCByZW5kZXJfRG9tRnJhZ21lbnRfUGFydGlhbF9nZXRQYXJ0aWFsRGVzY3JpcHRvciwgcmVuZGVyX0RvbUZyYWdtZW50X1BhcnRpYWxfYXBwbHlJbmRlbnQsIGNpcmN1bGFyICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9Db21wb25lbnRfaW5pdGlhbGlzZV9jcmVhdGVNb2RlbF9Db21wb25lbnRQYXJhbWV0ZXIgPSBmdW5jdGlvbiggcnVubG9vcCwgU3RyaW5nRnJhZ21lbnQgKSB7XG5cblx0XHR2YXIgQ29tcG9uZW50UGFyYW1ldGVyID0gZnVuY3Rpb24oIGNvbXBvbmVudCwga2V5LCB2YWx1ZSApIHtcblx0XHRcdHRoaXMucGFyZW50RnJhZ21lbnQgPSBjb21wb25lbnQucGFyZW50RnJhZ21lbnQ7XG5cdFx0XHR0aGlzLmNvbXBvbmVudCA9IGNvbXBvbmVudDtcblx0XHRcdHRoaXMua2V5ID0ga2V5O1xuXHRcdFx0dGhpcy5mcmFnbWVudCA9IG5ldyBTdHJpbmdGcmFnbWVudCgge1xuXHRcdFx0XHRkZXNjcmlwdG9yOiB2YWx1ZSxcblx0XHRcdFx0cm9vdDogY29tcG9uZW50LnJvb3QsXG5cdFx0XHRcdG93bmVyOiB0aGlzXG5cdFx0XHR9ICk7XG5cdFx0XHR0aGlzLnNlbGZVcGRhdGluZyA9IHRoaXMuZnJhZ21lbnQuaXNTaW1wbGUoKTtcblx0XHRcdHRoaXMudmFsdWUgPSB0aGlzLmZyYWdtZW50LmdldFZhbHVlKCk7XG5cdFx0fTtcblx0XHRDb21wb25lbnRQYXJhbWV0ZXIucHJvdG90eXBlID0ge1xuXHRcdFx0YnViYmxlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0aWYgKCB0aGlzLnNlbGZVcGRhdGluZyApIHtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZSgpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCAhdGhpcy5kZWZlcnJlZCAmJiB0aGlzLnJlYWR5ICkge1xuXHRcdFx0XHRcdHJ1bmxvb3AuYWRkQXR0cmlidXRlKCB0aGlzICk7XG5cdFx0XHRcdFx0dGhpcy5kZWZlcnJlZCA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHR1cGRhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgdmFsdWUgPSB0aGlzLmZyYWdtZW50LmdldFZhbHVlKCk7XG5cdFx0XHRcdHRoaXMuY29tcG9uZW50Lmluc3RhbmNlLnNldCggdGhpcy5rZXksIHZhbHVlICk7XG5cdFx0XHRcdHRoaXMudmFsdWUgPSB2YWx1ZTtcblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHRoaXMuZnJhZ21lbnQudGVhcmRvd24oKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBDb21wb25lbnRQYXJhbWV0ZXI7XG5cdH0oIGdsb2JhbF9ydW5sb29wLCByZW5kZXJfU3RyaW5nRnJhZ21lbnRfX1N0cmluZ0ZyYWdtZW50ICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9Db21wb25lbnRfaW5pdGlhbGlzZV9jcmVhdGVNb2RlbF9fY3JlYXRlTW9kZWwgPSBmdW5jdGlvbiggdHlwZXMsIHBhcnNlSlNPTiwgcmVzb2x2ZVJlZiwgZ2V0LCBDb21wb25lbnRQYXJhbWV0ZXIgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIGNvbXBvbmVudCwgZGVmYXVsdERhdGEsIGF0dHJpYnV0ZXMsIHRvQmluZCApIHtcblx0XHRcdHZhciBkYXRhLCBrZXksIHZhbHVlO1xuXHRcdFx0ZGF0YSA9IHt9O1xuXHRcdFx0Y29tcG9uZW50LmNvbXBsZXhQYXJhbWV0ZXJzID0gW107XG5cdFx0XHRmb3IgKCBrZXkgaW4gYXR0cmlidXRlcyApIHtcblx0XHRcdFx0aWYgKCBhdHRyaWJ1dGVzLmhhc093blByb3BlcnR5KCBrZXkgKSApIHtcblx0XHRcdFx0XHR2YWx1ZSA9IGdldFZhbHVlKCBjb21wb25lbnQsIGtleSwgYXR0cmlidXRlc1sga2V5IF0sIHRvQmluZCApO1xuXHRcdFx0XHRcdGlmICggdmFsdWUgIT09IHVuZGVmaW5lZCB8fCBkZWZhdWx0RGF0YVsga2V5IF0gPT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0XHRcdGRhdGFbIGtleSBdID0gdmFsdWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZGF0YTtcblx0XHR9O1xuXG5cdFx0ZnVuY3Rpb24gZ2V0VmFsdWUoIGNvbXBvbmVudCwga2V5LCBkZXNjcmlwdG9yLCB0b0JpbmQgKSB7XG5cdFx0XHR2YXIgcGFyYW1ldGVyLCBwYXJzZWQsIHBhcmVudEluc3RhbmNlLCBwYXJlbnRGcmFnbWVudCwga2V5cGF0aDtcblx0XHRcdHBhcmVudEluc3RhbmNlID0gY29tcG9uZW50LnJvb3Q7XG5cdFx0XHRwYXJlbnRGcmFnbWVudCA9IGNvbXBvbmVudC5wYXJlbnRGcmFnbWVudDtcblx0XHRcdGlmICggdHlwZW9mIGRlc2NyaXB0b3IgPT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHRwYXJzZWQgPSBwYXJzZUpTT04oIGRlc2NyaXB0b3IgKTtcblx0XHRcdFx0cmV0dXJuIHBhcnNlZCA/IHBhcnNlZC52YWx1ZSA6IGRlc2NyaXB0b3I7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGRlc2NyaXB0b3IgPT09IG51bGwgKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBkZXNjcmlwdG9yLmxlbmd0aCA9PT0gMSAmJiBkZXNjcmlwdG9yWyAwIF0udCA9PT0gdHlwZXMuSU5URVJQT0xBVE9SICYmIGRlc2NyaXB0b3JbIDAgXS5yICkge1xuXHRcdFx0XHRpZiAoIHBhcmVudEZyYWdtZW50LmluZGV4UmVmcyAmJiBwYXJlbnRGcmFnbWVudC5pbmRleFJlZnNbIGRlc2NyaXB0b3JbIDAgXS5yIF0gIT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0XHRyZXR1cm4gcGFyZW50RnJhZ21lbnQuaW5kZXhSZWZzWyBkZXNjcmlwdG9yWyAwIF0uciBdO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGtleXBhdGggPSByZXNvbHZlUmVmKCBwYXJlbnRJbnN0YW5jZSwgZGVzY3JpcHRvclsgMCBdLnIsIHBhcmVudEZyYWdtZW50ICkgfHwgZGVzY3JpcHRvclsgMCBdLnI7XG5cdFx0XHRcdHRvQmluZC5wdXNoKCB7XG5cdFx0XHRcdFx0Y2hpbGRLZXlwYXRoOiBrZXksXG5cdFx0XHRcdFx0cGFyZW50S2V5cGF0aDoga2V5cGF0aFxuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdHJldHVybiBnZXQoIHBhcmVudEluc3RhbmNlLCBrZXlwYXRoICk7XG5cdFx0XHR9XG5cdFx0XHRwYXJhbWV0ZXIgPSBuZXcgQ29tcG9uZW50UGFyYW1ldGVyKCBjb21wb25lbnQsIGtleSwgZGVzY3JpcHRvciApO1xuXHRcdFx0Y29tcG9uZW50LmNvbXBsZXhQYXJhbWV0ZXJzLnB1c2goIHBhcmFtZXRlciApO1xuXHRcdFx0cmV0dXJuIHBhcmFtZXRlci52YWx1ZTtcblx0XHR9XG5cdH0oIGNvbmZpZ190eXBlcywgdXRpbHNfcGFyc2VKU09OLCBzaGFyZWRfcmVzb2x2ZVJlZiwgc2hhcmVkX2dldF9fZ2V0LCByZW5kZXJfRG9tRnJhZ21lbnRfQ29tcG9uZW50X2luaXRpYWxpc2VfY3JlYXRlTW9kZWxfQ29tcG9uZW50UGFyYW1ldGVyICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9Db21wb25lbnRfaW5pdGlhbGlzZV9jcmVhdGVJbnN0YW5jZSA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBjb21wb25lbnQsIENvbXBvbmVudCwgZGF0YSwgZG9jRnJhZywgY29udGVudERlc2NyaXB0b3IgKSB7XG5cdFx0XHR2YXIgaW5zdGFuY2UsIHBhcmVudEZyYWdtZW50LCBwYXJ0aWFscywgcm9vdCwgYWRhcHQ7XG5cdFx0XHRwYXJlbnRGcmFnbWVudCA9IGNvbXBvbmVudC5wYXJlbnRGcmFnbWVudDtcblx0XHRcdHJvb3QgPSBjb21wb25lbnQucm9vdDtcblx0XHRcdHBhcnRpYWxzID0ge1xuXHRcdFx0XHRjb250ZW50OiBjb250ZW50RGVzY3JpcHRvciB8fCBbXVxuXHRcdFx0fTtcblx0XHRcdGFkYXB0ID0gY29tYmluZUFkYXB0b3JzKCByb290LCBDb21wb25lbnQuZGVmYXVsdHMuYWRhcHQsIENvbXBvbmVudC5hZGFwdG9ycyApO1xuXHRcdFx0aW5zdGFuY2UgPSBuZXcgQ29tcG9uZW50KCB7XG5cdFx0XHRcdGVsOiBwYXJlbnRGcmFnbWVudC5wTm9kZSxcblx0XHRcdFx0YXBwZW5kOiB0cnVlLFxuXHRcdFx0XHRkYXRhOiBkYXRhLFxuXHRcdFx0XHRwYXJ0aWFsczogcGFydGlhbHMsXG5cdFx0XHRcdG1hZ2ljOiByb290Lm1hZ2ljIHx8IENvbXBvbmVudC5kZWZhdWx0cy5tYWdpYyxcblx0XHRcdFx0bW9kaWZ5QXJyYXlzOiByb290Lm1vZGlmeUFycmF5cyxcblx0XHRcdFx0X3BhcmVudDogcm9vdCxcblx0XHRcdFx0X2NvbXBvbmVudDogY29tcG9uZW50LFxuXHRcdFx0XHRhZGFwdDogYWRhcHRcblx0XHRcdH0gKTtcblx0XHRcdGlmICggZG9jRnJhZyApIHtcblx0XHRcdFx0aW5zdGFuY2UuaW5zZXJ0KCBkb2NGcmFnICk7XG5cdFx0XHRcdGluc3RhbmNlLmZyYWdtZW50LnBOb2RlID0gaW5zdGFuY2UuZWwgPSBwYXJlbnRGcmFnbWVudC5wTm9kZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBpbnN0YW5jZTtcblx0XHR9O1xuXG5cdFx0ZnVuY3Rpb24gY29tYmluZUFkYXB0b3JzKCByb290LCBkZWZhdWx0QWRhcHQgKSB7XG5cdFx0XHR2YXIgYWRhcHQsIGxlbiwgaTtcblx0XHRcdGlmICggcm9vdC5hZGFwdC5sZW5ndGggKSB7XG5cdFx0XHRcdGFkYXB0ID0gcm9vdC5hZGFwdC5tYXAoIGZ1bmN0aW9uKCBzdHJpbmdPck9iamVjdCApIHtcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiBzdHJpbmdPck9iamVjdCA9PT0gJ29iamVjdCcgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gc3RyaW5nT3JPYmplY3Q7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiByb290LmFkYXB0b3JzWyBzdHJpbmdPck9iamVjdCBdIHx8IHN0cmluZ09yT2JqZWN0O1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRhZGFwdCA9IFtdO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBsZW4gPSBkZWZhdWx0QWRhcHQubGVuZ3RoICkge1xuXHRcdFx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRcdGlmICggYWRhcHQuaW5kZXhPZiggZGVmYXVsdEFkYXB0WyBpIF0gKSA9PT0gLTEgKSB7XG5cdFx0XHRcdFx0XHRhZGFwdC5wdXNoKCBkZWZhdWx0QWRhcHRbIGkgXSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGFkYXB0O1xuXHRcdH1cblx0fSgpO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfQ29tcG9uZW50X2luaXRpYWxpc2VfY3JlYXRlQmluZGluZ3MgPSBmdW5jdGlvbiggY3JlYXRlQ29tcG9uZW50QmluZGluZywgZ2V0LCBzZXQgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24gY3JlYXRlSW5pdGlhbENvbXBvbmVudEJpbmRpbmdzKCBjb21wb25lbnQsIHRvQmluZCApIHtcblx0XHRcdHRvQmluZC5mb3JFYWNoKCBmdW5jdGlvbiBjcmVhdGVJbml0aWFsQ29tcG9uZW50QmluZGluZyggcGFpciApIHtcblx0XHRcdFx0dmFyIGNoaWxkVmFsdWU7XG5cdFx0XHRcdGNyZWF0ZUNvbXBvbmVudEJpbmRpbmcoIGNvbXBvbmVudCwgY29tcG9uZW50LnJvb3QsIHBhaXIucGFyZW50S2V5cGF0aCwgcGFpci5jaGlsZEtleXBhdGggKTtcblx0XHRcdFx0Y2hpbGRWYWx1ZSA9IGdldCggY29tcG9uZW50Lmluc3RhbmNlLCBwYWlyLmNoaWxkS2V5cGF0aCApO1xuXHRcdFx0XHRpZiAoIGNoaWxkVmFsdWUgIT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0XHRzZXQoIGNvbXBvbmVudC5yb290LCBwYWlyLnBhcmVudEtleXBhdGgsIGNoaWxkVmFsdWUgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdH07XG5cdH0oIHNoYXJlZF9jcmVhdGVDb21wb25lbnRCaW5kaW5nLCBzaGFyZWRfZ2V0X19nZXQsIHNoYXJlZF9zZXQgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0NvbXBvbmVudF9pbml0aWFsaXNlX3Byb3BhZ2F0ZUV2ZW50cyA9IGZ1bmN0aW9uKCB3YXJuICkge1xuXG5cdFx0dmFyIGVycm9yTWVzc2FnZSA9ICdDb21wb25lbnRzIGN1cnJlbnRseSBvbmx5IHN1cHBvcnQgc2ltcGxlIGV2ZW50cyAtIHlvdSBjYW5ub3QgaW5jbHVkZSBhcmd1bWVudHMuIFNvcnJ5ISc7XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBjb21wb25lbnQsIGV2ZW50c0Rlc2NyaXB0b3IgKSB7XG5cdFx0XHR2YXIgZXZlbnROYW1lO1xuXHRcdFx0Zm9yICggZXZlbnROYW1lIGluIGV2ZW50c0Rlc2NyaXB0b3IgKSB7XG5cdFx0XHRcdGlmICggZXZlbnRzRGVzY3JpcHRvci5oYXNPd25Qcm9wZXJ0eSggZXZlbnROYW1lICkgKSB7XG5cdFx0XHRcdFx0cHJvcGFnYXRlRXZlbnQoIGNvbXBvbmVudC5pbnN0YW5jZSwgY29tcG9uZW50LnJvb3QsIGV2ZW50TmFtZSwgZXZlbnRzRGVzY3JpcHRvclsgZXZlbnROYW1lIF0gKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRmdW5jdGlvbiBwcm9wYWdhdGVFdmVudCggY2hpbGRJbnN0YW5jZSwgcGFyZW50SW5zdGFuY2UsIGV2ZW50TmFtZSwgcHJveHlFdmVudE5hbWUgKSB7XG5cdFx0XHRpZiAoIHR5cGVvZiBwcm94eUV2ZW50TmFtZSAhPT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdGlmICggcGFyZW50SW5zdGFuY2UuZGVidWcgKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCBlcnJvck1lc3NhZ2UgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR3YXJuKCBlcnJvck1lc3NhZ2UgKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGNoaWxkSW5zdGFuY2Uub24oIGV2ZW50TmFtZSwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoIGFyZ3VtZW50cyApO1xuXHRcdFx0XHRhcmdzLnVuc2hpZnQoIHByb3h5RXZlbnROYW1lICk7XG5cdFx0XHRcdHBhcmVudEluc3RhbmNlLmZpcmUuYXBwbHkoIHBhcmVudEluc3RhbmNlLCBhcmdzICk7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXHR9KCB1dGlsc193YXJuICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9Db21wb25lbnRfaW5pdGlhbGlzZV91cGRhdGVMaXZlUXVlcmllcyA9IGZ1bmN0aW9uKCBjb21wb25lbnQgKSB7XG5cdFx0dmFyIGFuY2VzdG9yLCBxdWVyeTtcblx0XHRhbmNlc3RvciA9IGNvbXBvbmVudC5yb290O1xuXHRcdHdoaWxlICggYW5jZXN0b3IgKSB7XG5cdFx0XHRpZiAoIHF1ZXJ5ID0gYW5jZXN0b3IuX2xpdmVDb21wb25lbnRRdWVyaWVzWyBjb21wb25lbnQubmFtZSBdICkge1xuXHRcdFx0XHRxdWVyeS5wdXNoKCBjb21wb25lbnQuaW5zdGFuY2UgKTtcblx0XHRcdH1cblx0XHRcdGFuY2VzdG9yID0gYW5jZXN0b3IuX3BhcmVudDtcblx0XHR9XG5cdH07XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9Db21wb25lbnRfaW5pdGlhbGlzZV9faW5pdGlhbGlzZSA9IGZ1bmN0aW9uKCB0eXBlcywgd2FybiwgY3JlYXRlTW9kZWwsIGNyZWF0ZUluc3RhbmNlLCBjcmVhdGVCaW5kaW5ncywgcHJvcGFnYXRlRXZlbnRzLCB1cGRhdGVMaXZlUXVlcmllcyApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiBpbml0aWFsaXNlQ29tcG9uZW50KCBjb21wb25lbnQsIG9wdGlvbnMsIGRvY0ZyYWcgKSB7XG5cdFx0XHR2YXIgcGFyZW50RnJhZ21lbnQsIHJvb3QsIENvbXBvbmVudCwgZGF0YSwgdG9CaW5kO1xuXHRcdFx0cGFyZW50RnJhZ21lbnQgPSBjb21wb25lbnQucGFyZW50RnJhZ21lbnQgPSBvcHRpb25zLnBhcmVudEZyYWdtZW50O1xuXHRcdFx0cm9vdCA9IHBhcmVudEZyYWdtZW50LnJvb3Q7XG5cdFx0XHRjb21wb25lbnQucm9vdCA9IHJvb3Q7XG5cdFx0XHRjb21wb25lbnQudHlwZSA9IHR5cGVzLkNPTVBPTkVOVDtcblx0XHRcdGNvbXBvbmVudC5uYW1lID0gb3B0aW9ucy5kZXNjcmlwdG9yLmU7XG5cdFx0XHRjb21wb25lbnQuaW5kZXggPSBvcHRpb25zLmluZGV4O1xuXHRcdFx0Y29tcG9uZW50LmJpbmRpbmdzID0gW107XG5cdFx0XHRDb21wb25lbnQgPSByb290LmNvbXBvbmVudHNbIG9wdGlvbnMuZGVzY3JpcHRvci5lIF07XG5cdFx0XHRpZiAoICFDb21wb25lbnQgKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ0NvbXBvbmVudCBcIicgKyBvcHRpb25zLmRlc2NyaXB0b3IuZSArICdcIiBub3QgZm91bmQnICk7XG5cdFx0XHR9XG5cdFx0XHR0b0JpbmQgPSBbXTtcblx0XHRcdGRhdGEgPSBjcmVhdGVNb2RlbCggY29tcG9uZW50LCBDb21wb25lbnQuZGF0YSB8fCB7fSwgb3B0aW9ucy5kZXNjcmlwdG9yLmEsIHRvQmluZCApO1xuXHRcdFx0Y3JlYXRlSW5zdGFuY2UoIGNvbXBvbmVudCwgQ29tcG9uZW50LCBkYXRhLCBkb2NGcmFnLCBvcHRpb25zLmRlc2NyaXB0b3IuZiApO1xuXHRcdFx0Y3JlYXRlQmluZGluZ3MoIGNvbXBvbmVudCwgdG9CaW5kICk7XG5cdFx0XHRwcm9wYWdhdGVFdmVudHMoIGNvbXBvbmVudCwgb3B0aW9ucy5kZXNjcmlwdG9yLnYgKTtcblx0XHRcdGlmICggb3B0aW9ucy5kZXNjcmlwdG9yLnQxIHx8IG9wdGlvbnMuZGVzY3JpcHRvci50MiB8fCBvcHRpb25zLmRlc2NyaXB0b3IubyApIHtcblx0XHRcdFx0d2FybiggJ1RoZSBcImludHJvXCIsIFwib3V0cm9cIiBhbmQgXCJkZWNvcmF0b3JcIiBkaXJlY3RpdmVzIGhhdmUgbm8gZWZmZWN0IG9uIGNvbXBvbmVudHMnICk7XG5cdFx0XHR9XG5cdFx0XHR1cGRhdGVMaXZlUXVlcmllcyggY29tcG9uZW50ICk7XG5cdFx0fTtcblx0fSggY29uZmlnX3R5cGVzLCB1dGlsc193YXJuLCByZW5kZXJfRG9tRnJhZ21lbnRfQ29tcG9uZW50X2luaXRpYWxpc2VfY3JlYXRlTW9kZWxfX2NyZWF0ZU1vZGVsLCByZW5kZXJfRG9tRnJhZ21lbnRfQ29tcG9uZW50X2luaXRpYWxpc2VfY3JlYXRlSW5zdGFuY2UsIHJlbmRlcl9Eb21GcmFnbWVudF9Db21wb25lbnRfaW5pdGlhbGlzZV9jcmVhdGVCaW5kaW5ncywgcmVuZGVyX0RvbUZyYWdtZW50X0NvbXBvbmVudF9pbml0aWFsaXNlX3Byb3BhZ2F0ZUV2ZW50cywgcmVuZGVyX0RvbUZyYWdtZW50X0NvbXBvbmVudF9pbml0aWFsaXNlX3VwZGF0ZUxpdmVRdWVyaWVzICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9Db21wb25lbnRfX0NvbXBvbmVudCA9IGZ1bmN0aW9uKCBpbml0aWFsaXNlICkge1xuXG5cdFx0dmFyIERvbUNvbXBvbmVudCA9IGZ1bmN0aW9uKCBvcHRpb25zLCBkb2NGcmFnICkge1xuXHRcdFx0aW5pdGlhbGlzZSggdGhpcywgb3B0aW9ucywgZG9jRnJhZyApO1xuXHRcdH07XG5cdFx0RG9tQ29tcG9uZW50LnByb3RvdHlwZSA9IHtcblx0XHRcdGZpcnN0Tm9kZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmluc3RhbmNlLmZyYWdtZW50LmZpcnN0Tm9kZSgpO1xuXHRcdFx0fSxcblx0XHRcdGZpbmROZXh0Tm9kZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnBhcmVudEZyYWdtZW50LmZpbmROZXh0Tm9kZSggdGhpcyApO1xuXHRcdFx0fSxcblx0XHRcdGRldGFjaDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmluc3RhbmNlLmZyYWdtZW50LmRldGFjaCgpO1xuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbiggZGVzdHJveSApIHtcblx0XHRcdFx0d2hpbGUgKCB0aGlzLmNvbXBsZXhQYXJhbWV0ZXJzLmxlbmd0aCApIHtcblx0XHRcdFx0XHR0aGlzLmNvbXBsZXhQYXJhbWV0ZXJzLnBvcCgpLnRlYXJkb3duKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0d2hpbGUgKCB0aGlzLmJpbmRpbmdzLmxlbmd0aCApIHtcblx0XHRcdFx0XHR0aGlzLmJpbmRpbmdzLnBvcCgpLnRlYXJkb3duKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVtb3ZlRnJvbUxpdmVDb21wb25lbnRRdWVyaWVzKCB0aGlzICk7XG5cdFx0XHRcdHRoaXMuc2hvdWxkRGVzdHJveSA9IGRlc3Ryb3k7XG5cdFx0XHRcdHRoaXMuaW5zdGFuY2UudGVhcmRvd24oKTtcblx0XHRcdH0sXG5cdFx0XHR0b1N0cmluZzogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmluc3RhbmNlLmZyYWdtZW50LnRvU3RyaW5nKCk7XG5cdFx0XHR9LFxuXHRcdFx0ZmluZDogZnVuY3Rpb24oIHNlbGVjdG9yICkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5pbnN0YW5jZS5mcmFnbWVudC5maW5kKCBzZWxlY3RvciApO1xuXHRcdFx0fSxcblx0XHRcdGZpbmRBbGw6IGZ1bmN0aW9uKCBzZWxlY3RvciwgcXVlcnkgKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmluc3RhbmNlLmZyYWdtZW50LmZpbmRBbGwoIHNlbGVjdG9yLCBxdWVyeSApO1xuXHRcdFx0fSxcblx0XHRcdGZpbmRDb21wb25lbnQ6IGZ1bmN0aW9uKCBzZWxlY3RvciApIHtcblx0XHRcdFx0aWYgKCAhc2VsZWN0b3IgfHwgc2VsZWN0b3IgPT09IHRoaXMubmFtZSApIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5pbnN0YW5jZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHRoaXMuaW5zdGFuY2UuZnJhZ21lbnQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuaW5zdGFuY2UuZnJhZ21lbnQuZmluZENvbXBvbmVudCggc2VsZWN0b3IgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH0sXG5cdFx0XHRmaW5kQWxsQ29tcG9uZW50czogZnVuY3Rpb24oIHNlbGVjdG9yLCBxdWVyeSApIHtcblx0XHRcdFx0cXVlcnkuX3Rlc3QoIHRoaXMsIHRydWUgKTtcblx0XHRcdFx0aWYgKCB0aGlzLmluc3RhbmNlLmZyYWdtZW50ICkge1xuXHRcdFx0XHRcdHRoaXMuaW5zdGFuY2UuZnJhZ21lbnQuZmluZEFsbENvbXBvbmVudHMoIHNlbGVjdG9yLCBxdWVyeSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gRG9tQ29tcG9uZW50O1xuXG5cdFx0ZnVuY3Rpb24gcmVtb3ZlRnJvbUxpdmVDb21wb25lbnRRdWVyaWVzKCBjb21wb25lbnQgKSB7XG5cdFx0XHR2YXIgaW5zdGFuY2UsIHF1ZXJ5O1xuXHRcdFx0aW5zdGFuY2UgPSBjb21wb25lbnQucm9vdDtcblx0XHRcdGRvIHtcblx0XHRcdFx0aWYgKCBxdWVyeSA9IGluc3RhbmNlLl9saXZlQ29tcG9uZW50UXVlcmllc1sgY29tcG9uZW50Lm5hbWUgXSApIHtcblx0XHRcdFx0XHRxdWVyeS5fcmVtb3ZlKCBjb21wb25lbnQgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSB3aGlsZSAoIGluc3RhbmNlID0gaW5zdGFuY2UuX3BhcmVudCApO1xuXHRcdH1cblx0fSggcmVuZGVyX0RvbUZyYWdtZW50X0NvbXBvbmVudF9pbml0aWFsaXNlX19pbml0aWFsaXNlICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9Db21tZW50ID0gZnVuY3Rpb24oIHR5cGVzLCBkZXRhY2ggKSB7XG5cblx0XHR2YXIgRG9tQ29tbWVudCA9IGZ1bmN0aW9uKCBvcHRpb25zLCBkb2NGcmFnICkge1xuXHRcdFx0dGhpcy50eXBlID0gdHlwZXMuQ09NTUVOVDtcblx0XHRcdHRoaXMuZGVzY3JpcHRvciA9IG9wdGlvbnMuZGVzY3JpcHRvcjtcblx0XHRcdGlmICggZG9jRnJhZyApIHtcblx0XHRcdFx0dGhpcy5ub2RlID0gZG9jdW1lbnQuY3JlYXRlQ29tbWVudCggb3B0aW9ucy5kZXNjcmlwdG9yLmYgKTtcblx0XHRcdFx0ZG9jRnJhZy5hcHBlbmRDaGlsZCggdGhpcy5ub2RlICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHREb21Db21tZW50LnByb3RvdHlwZSA9IHtcblx0XHRcdGRldGFjaDogZGV0YWNoLFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCBkZXN0cm95ICkge1xuXHRcdFx0XHRpZiAoIGRlc3Ryb3kgKSB7XG5cdFx0XHRcdFx0dGhpcy5kZXRhY2goKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGZpcnN0Tm9kZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLm5vZGU7XG5cdFx0XHR9LFxuXHRcdFx0dG9TdHJpbmc6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gJzwhLS0nICsgdGhpcy5kZXNjcmlwdG9yLmYgKyAnLS0+Jztcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBEb21Db21tZW50O1xuXHR9KCBjb25maWdfdHlwZXMsIHJlbmRlcl9Eb21GcmFnbWVudF9zaGFyZWRfZGV0YWNoICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9fRG9tRnJhZ21lbnQgPSBmdW5jdGlvbiggdHlwZXMsIG1hdGNoZXMsIGluaXRGcmFnbWVudCwgaW5zZXJ0SHRtbCwgVGV4dCwgSW50ZXJwb2xhdG9yLCBTZWN0aW9uLCBUcmlwbGUsIEVsZW1lbnQsIFBhcnRpYWwsIENvbXBvbmVudCwgQ29tbWVudCwgY2lyY3VsYXIgKSB7XG5cblx0XHR2YXIgRG9tRnJhZ21lbnQgPSBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdGlmICggb3B0aW9ucy5wTm9kZSApIHtcblx0XHRcdFx0dGhpcy5kb2NGcmFnID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0eXBlb2Ygb3B0aW9ucy5kZXNjcmlwdG9yID09PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0dGhpcy5odG1sID0gb3B0aW9ucy5kZXNjcmlwdG9yO1xuXHRcdFx0XHRpZiAoIHRoaXMuZG9jRnJhZyApIHtcblx0XHRcdFx0XHR0aGlzLm5vZGVzID0gaW5zZXJ0SHRtbCggdGhpcy5odG1sLCBvcHRpb25zLnBOb2RlLnRhZ05hbWUsIHRoaXMuZG9jRnJhZyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpbml0RnJhZ21lbnQoIHRoaXMsIG9wdGlvbnMgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdERvbUZyYWdtZW50LnByb3RvdHlwZSA9IHtcblx0XHRcdGRldGFjaDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBsZW4sIGk7XG5cdFx0XHRcdGlmICggdGhpcy5kb2NGcmFnICkge1xuXHRcdFx0XHRcdGlmICggdGhpcy5ub2RlcyApIHtcblx0XHRcdFx0XHRcdGxlbiA9IHRoaXMubm9kZXMubGVuZ3RoO1xuXHRcdFx0XHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5kb2NGcmFnLmFwcGVuZENoaWxkKCB0aGlzLm5vZGVzWyBpIF0gKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGVsc2UgaWYgKCB0aGlzLml0ZW1zICkge1xuXHRcdFx0XHRcdFx0bGVuID0gdGhpcy5pdGVtcy5sZW5ndGg7XG5cdFx0XHRcdFx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLmRvY0ZyYWcuYXBwZW5kQ2hpbGQoIHRoaXMuaXRlbXNbIGkgXS5kZXRhY2goKSApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5kb2NGcmFnO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0Y3JlYXRlSXRlbTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRcdGlmICggdHlwZW9mIG9wdGlvbnMuZGVzY3JpcHRvciA9PT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBUZXh0KCBvcHRpb25zLCB0aGlzLmRvY0ZyYWcgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzd2l0Y2ggKCBvcHRpb25zLmRlc2NyaXB0b3IudCApIHtcblx0XHRcdFx0XHRjYXNlIHR5cGVzLklOVEVSUE9MQVRPUjpcblx0XHRcdFx0XHRcdHJldHVybiBuZXcgSW50ZXJwb2xhdG9yKCBvcHRpb25zLCB0aGlzLmRvY0ZyYWcgKTtcblx0XHRcdFx0XHRjYXNlIHR5cGVzLlNFQ1RJT046XG5cdFx0XHRcdFx0XHRyZXR1cm4gbmV3IFNlY3Rpb24oIG9wdGlvbnMsIHRoaXMuZG9jRnJhZyApO1xuXHRcdFx0XHRcdGNhc2UgdHlwZXMuVFJJUExFOlxuXHRcdFx0XHRcdFx0cmV0dXJuIG5ldyBUcmlwbGUoIG9wdGlvbnMsIHRoaXMuZG9jRnJhZyApO1xuXHRcdFx0XHRcdGNhc2UgdHlwZXMuRUxFTUVOVDpcblx0XHRcdFx0XHRcdGlmICggdGhpcy5yb290LmNvbXBvbmVudHNbIG9wdGlvbnMuZGVzY3JpcHRvci5lIF0gKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBuZXcgQ29tcG9uZW50KCBvcHRpb25zLCB0aGlzLmRvY0ZyYWcgKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHJldHVybiBuZXcgRWxlbWVudCggb3B0aW9ucywgdGhpcy5kb2NGcmFnICk7XG5cdFx0XHRcdFx0Y2FzZSB0eXBlcy5QQVJUSUFMOlxuXHRcdFx0XHRcdFx0cmV0dXJuIG5ldyBQYXJ0aWFsKCBvcHRpb25zLCB0aGlzLmRvY0ZyYWcgKTtcblx0XHRcdFx0XHRjYXNlIHR5cGVzLkNPTU1FTlQ6XG5cdFx0XHRcdFx0XHRyZXR1cm4gbmV3IENvbW1lbnQoIG9wdGlvbnMsIHRoaXMuZG9jRnJhZyApO1xuXHRcdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdTb21ldGhpbmcgdmVyeSBzdHJhbmdlIGhhcHBlbmVkLiBQbGVhc2UgZmlsZSBhbiBpc3N1ZSBhdCBodHRwczovL2dpdGh1Yi5jb20vUmFjdGl2ZUpTL1JhY3RpdmUvaXNzdWVzLiBUaGFua3MhJyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCBkZXN0cm95ICkge1xuXHRcdFx0XHR2YXIgbm9kZTtcblx0XHRcdFx0aWYgKCB0aGlzLm5vZGVzICYmIGRlc3Ryb3kgKSB7XG5cdFx0XHRcdFx0d2hpbGUgKCBub2RlID0gdGhpcy5ub2Rlcy5wb3AoKSApIHtcblx0XHRcdFx0XHRcdG5vZGUucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCggbm9kZSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIGlmICggdGhpcy5pdGVtcyApIHtcblx0XHRcdFx0XHR3aGlsZSAoIHRoaXMuaXRlbXMubGVuZ3RoICkge1xuXHRcdFx0XHRcdFx0dGhpcy5pdGVtcy5wb3AoKS50ZWFyZG93biggZGVzdHJveSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLm5vZGVzID0gdGhpcy5pdGVtcyA9IHRoaXMuZG9jRnJhZyA9IG51bGw7XG5cdFx0XHR9LFxuXHRcdFx0Zmlyc3ROb2RlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0aWYgKCB0aGlzLml0ZW1zICYmIHRoaXMuaXRlbXNbIDAgXSApIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5pdGVtc1sgMCBdLmZpcnN0Tm9kZSgpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCB0aGlzLm5vZGVzICkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLm5vZGVzWyAwIF0gfHwgbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH0sXG5cdFx0XHRmaW5kTmV4dE5vZGU6IGZ1bmN0aW9uKCBpdGVtICkge1xuXHRcdFx0XHR2YXIgaW5kZXggPSBpdGVtLmluZGV4O1xuXHRcdFx0XHRpZiAoIHRoaXMuaXRlbXNbIGluZGV4ICsgMSBdICkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLml0ZW1zWyBpbmRleCArIDEgXS5maXJzdE5vZGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHRoaXMub3duZXIgPT09IHRoaXMucm9vdCApIHtcblx0XHRcdFx0XHRpZiAoICF0aGlzLm93bmVyLmNvbXBvbmVudCApIHtcblx0XHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5vd25lci5jb21wb25lbnQuZmluZE5leHROb2RlKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRoaXMub3duZXIuZmluZE5leHROb2RlKCB0aGlzICk7XG5cdFx0XHR9LFxuXHRcdFx0dG9TdHJpbmc6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgaHRtbCwgaSwgbGVuLCBpdGVtO1xuXHRcdFx0XHRpZiAoIHRoaXMuaHRtbCApIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5odG1sO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGh0bWwgPSAnJztcblx0XHRcdFx0aWYgKCAhdGhpcy5pdGVtcyApIHtcblx0XHRcdFx0XHRyZXR1cm4gaHRtbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRsZW4gPSB0aGlzLml0ZW1zLmxlbmd0aDtcblx0XHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0XHRpdGVtID0gdGhpcy5pdGVtc1sgaSBdO1xuXHRcdFx0XHRcdGh0bWwgKz0gaXRlbS50b1N0cmluZygpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBodG1sO1xuXHRcdFx0fSxcblx0XHRcdGZpbmQ6IGZ1bmN0aW9uKCBzZWxlY3RvciApIHtcblx0XHRcdFx0dmFyIGksIGxlbiwgaXRlbSwgbm9kZSwgcXVlcnlSZXN1bHQ7XG5cdFx0XHRcdGlmICggdGhpcy5ub2RlcyApIHtcblx0XHRcdFx0XHRsZW4gPSB0aGlzLm5vZGVzLmxlbmd0aDtcblx0XHRcdFx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRcdFx0bm9kZSA9IHRoaXMubm9kZXNbIGkgXTtcblx0XHRcdFx0XHRcdGlmICggbm9kZS5ub2RlVHlwZSAhPT0gMSApIHtcblx0XHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoIG1hdGNoZXMoIG5vZGUsIHNlbGVjdG9yICkgKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBub2RlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKCBxdWVyeVJlc3VsdCA9IG5vZGUucXVlcnlTZWxlY3Rvciggc2VsZWN0b3IgKSApIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHF1ZXJ5UmVzdWx0O1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHRoaXMuaXRlbXMgKSB7XG5cdFx0XHRcdFx0bGVuID0gdGhpcy5pdGVtcy5sZW5ndGg7XG5cdFx0XHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0XHRcdGl0ZW0gPSB0aGlzLml0ZW1zWyBpIF07XG5cdFx0XHRcdFx0XHRpZiAoIGl0ZW0uZmluZCAmJiAoIHF1ZXJ5UmVzdWx0ID0gaXRlbS5maW5kKCBzZWxlY3RvciApICkgKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBxdWVyeVJlc3VsdDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRmaW5kQWxsOiBmdW5jdGlvbiggc2VsZWN0b3IsIHF1ZXJ5ICkge1xuXHRcdFx0XHR2YXIgaSwgbGVuLCBpdGVtLCBub2RlLCBxdWVyeUFsbFJlc3VsdCwgbnVtTm9kZXMsIGo7XG5cdFx0XHRcdGlmICggdGhpcy5ub2RlcyApIHtcblx0XHRcdFx0XHRsZW4gPSB0aGlzLm5vZGVzLmxlbmd0aDtcblx0XHRcdFx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRcdFx0bm9kZSA9IHRoaXMubm9kZXNbIGkgXTtcblx0XHRcdFx0XHRcdGlmICggbm9kZS5ub2RlVHlwZSAhPT0gMSApIHtcblx0XHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoIG1hdGNoZXMoIG5vZGUsIHNlbGVjdG9yICkgKSB7XG5cdFx0XHRcdFx0XHRcdHF1ZXJ5LnB1c2goIG5vZGUgKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmICggcXVlcnlBbGxSZXN1bHQgPSBub2RlLnF1ZXJ5U2VsZWN0b3JBbGwoIHNlbGVjdG9yICkgKSB7XG5cdFx0XHRcdFx0XHRcdG51bU5vZGVzID0gcXVlcnlBbGxSZXN1bHQubGVuZ3RoO1xuXHRcdFx0XHRcdFx0XHRmb3IgKCBqID0gMDsgaiA8IG51bU5vZGVzOyBqICs9IDEgKSB7XG5cdFx0XHRcdFx0XHRcdFx0cXVlcnkucHVzaCggcXVlcnlBbGxSZXN1bHRbIGogXSApO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2UgaWYgKCB0aGlzLml0ZW1zICkge1xuXHRcdFx0XHRcdGxlbiA9IHRoaXMuaXRlbXMubGVuZ3RoO1xuXHRcdFx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0XHRpdGVtID0gdGhpcy5pdGVtc1sgaSBdO1xuXHRcdFx0XHRcdFx0aWYgKCBpdGVtLmZpbmRBbGwgKSB7XG5cdFx0XHRcdFx0XHRcdGl0ZW0uZmluZEFsbCggc2VsZWN0b3IsIHF1ZXJ5ICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBxdWVyeTtcblx0XHRcdH0sXG5cdFx0XHRmaW5kQ29tcG9uZW50OiBmdW5jdGlvbiggc2VsZWN0b3IgKSB7XG5cdFx0XHRcdHZhciBsZW4sIGksIGl0ZW0sIHF1ZXJ5UmVzdWx0O1xuXHRcdFx0XHRpZiAoIHRoaXMuaXRlbXMgKSB7XG5cdFx0XHRcdFx0bGVuID0gdGhpcy5pdGVtcy5sZW5ndGg7XG5cdFx0XHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0XHRcdGl0ZW0gPSB0aGlzLml0ZW1zWyBpIF07XG5cdFx0XHRcdFx0XHRpZiAoIGl0ZW0uZmluZENvbXBvbmVudCAmJiAoIHF1ZXJ5UmVzdWx0ID0gaXRlbS5maW5kQ29tcG9uZW50KCBzZWxlY3RvciApICkgKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBxdWVyeVJlc3VsdDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRmaW5kQWxsQ29tcG9uZW50czogZnVuY3Rpb24oIHNlbGVjdG9yLCBxdWVyeSApIHtcblx0XHRcdFx0dmFyIGksIGxlbiwgaXRlbTtcblx0XHRcdFx0aWYgKCB0aGlzLml0ZW1zICkge1xuXHRcdFx0XHRcdGxlbiA9IHRoaXMuaXRlbXMubGVuZ3RoO1xuXHRcdFx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0XHRpdGVtID0gdGhpcy5pdGVtc1sgaSBdO1xuXHRcdFx0XHRcdFx0aWYgKCBpdGVtLmZpbmRBbGxDb21wb25lbnRzICkge1xuXHRcdFx0XHRcdFx0XHRpdGVtLmZpbmRBbGxDb21wb25lbnRzKCBzZWxlY3RvciwgcXVlcnkgKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHF1ZXJ5O1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0Y2lyY3VsYXIuRG9tRnJhZ21lbnQgPSBEb21GcmFnbWVudDtcblx0XHRyZXR1cm4gRG9tRnJhZ21lbnQ7XG5cdH0oIGNvbmZpZ190eXBlcywgdXRpbHNfbWF0Y2hlcywgcmVuZGVyX3NoYXJlZF9pbml0RnJhZ21lbnQsIHJlbmRlcl9Eb21GcmFnbWVudF9zaGFyZWRfaW5zZXJ0SHRtbCwgcmVuZGVyX0RvbUZyYWdtZW50X1RleHQsIHJlbmRlcl9Eb21GcmFnbWVudF9JbnRlcnBvbGF0b3IsIHJlbmRlcl9Eb21GcmFnbWVudF9TZWN0aW9uX19TZWN0aW9uLCByZW5kZXJfRG9tRnJhZ21lbnRfVHJpcGxlLCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9fRWxlbWVudCwgcmVuZGVyX0RvbUZyYWdtZW50X1BhcnRpYWxfX1BhcnRpYWwsIHJlbmRlcl9Eb21GcmFnbWVudF9Db21wb25lbnRfX0NvbXBvbmVudCwgcmVuZGVyX0RvbUZyYWdtZW50X0NvbW1lbnQsIGNpcmN1bGFyICk7XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX3JlbmRlciA9IGZ1bmN0aW9uKCBydW5sb29wLCBjc3MsIERvbUZyYWdtZW50ICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uIFJhY3RpdmVfcHJvdG90eXBlX3JlbmRlciggdGFyZ2V0LCBjYWxsYmFjayApIHtcblx0XHRcdHRoaXMuX3JlbmRlcmluZyA9IHRydWU7XG5cdFx0XHRydW5sb29wLnN0YXJ0KCB0aGlzLCBjYWxsYmFjayApO1xuXHRcdFx0aWYgKCAhdGhpcy5faW5pdGluZyApIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnWW91IGNhbm5vdCBjYWxsIHJhY3RpdmUucmVuZGVyKCkgZGlyZWN0bHkhJyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aGlzLmNvbnN0cnVjdG9yLmNzcyApIHtcblx0XHRcdFx0Y3NzLmFkZCggdGhpcy5jb25zdHJ1Y3RvciApO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5mcmFnbWVudCA9IG5ldyBEb21GcmFnbWVudCgge1xuXHRcdFx0XHRkZXNjcmlwdG9yOiB0aGlzLnRlbXBsYXRlLFxuXHRcdFx0XHRyb290OiB0aGlzLFxuXHRcdFx0XHRvd25lcjogdGhpcyxcblx0XHRcdFx0cE5vZGU6IHRhcmdldFxuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCB0YXJnZXQgKSB7XG5cdFx0XHRcdHRhcmdldC5hcHBlbmRDaGlsZCggdGhpcy5mcmFnbWVudC5kb2NGcmFnICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICF0aGlzLl9wYXJlbnQgfHwgIXRoaXMuX3BhcmVudC5fcmVuZGVyaW5nICkge1xuXHRcdFx0XHRpbml0Q2hpbGRyZW4oIHRoaXMgKTtcblx0XHRcdH1cblx0XHRcdGRlbGV0ZSB0aGlzLl9yZW5kZXJpbmc7XG5cdFx0XHRydW5sb29wLmVuZCgpO1xuXHRcdH07XG5cblx0XHRmdW5jdGlvbiBpbml0Q2hpbGRyZW4oIGluc3RhbmNlICkge1xuXHRcdFx0dmFyIGNoaWxkO1xuXHRcdFx0d2hpbGUgKCBjaGlsZCA9IGluc3RhbmNlLl9jaGlsZEluaXRRdWV1ZS5wb3AoKSApIHtcblx0XHRcdFx0aWYgKCBjaGlsZC5pbnN0YW5jZS5pbml0ICkge1xuXHRcdFx0XHRcdGNoaWxkLmluc3RhbmNlLmluaXQoIGNoaWxkLm9wdGlvbnMgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpbml0Q2hpbGRyZW4oIGNoaWxkLmluc3RhbmNlICk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KCBnbG9iYWxfcnVubG9vcCwgZ2xvYmFsX2NzcywgcmVuZGVyX0RvbUZyYWdtZW50X19Eb21GcmFnbWVudCApO1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9yZW5kZXJIVE1MID0gZnVuY3Rpb24oIHdhcm4gKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFx0XHR3YXJuKCAncmVuZGVySFRNTCgpIGhhcyBiZWVuIGRlcHJlY2F0ZWQgYW5kIHdpbGwgYmUgcmVtb3ZlZCBpbiBhIGZ1dHVyZSB2ZXJzaW9uLiBQbGVhc2UgdXNlIHRvSFRNTCgpIGluc3RlYWQnICk7XG5cdFx0XHRyZXR1cm4gdGhpcy50b0hUTUwoKTtcblx0XHR9O1xuXHR9KCB1dGlsc193YXJuICk7XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX3Jlc2V0ID0gZnVuY3Rpb24oIFByb21pc2UsIHJ1bmxvb3AsIGNsZWFyQ2FjaGUsIG5vdGlmeURlcGVuZGFudHMgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIGRhdGEsIGNhbGxiYWNrICkge1xuXHRcdFx0dmFyIHByb21pc2UsIGZ1bGZpbFByb21pc2UsIHdyYXBwZXI7XG5cdFx0XHRpZiAoIHR5cGVvZiBkYXRhID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0XHRjYWxsYmFjayA9IGRhdGE7XG5cdFx0XHRcdGRhdGEgPSB7fTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGRhdGEgPSBkYXRhIHx8IHt9O1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0eXBlb2YgZGF0YSAhPT0gJ29iamVjdCcgKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ1RoZSByZXNldCBtZXRob2QgdGFrZXMgZWl0aGVyIG5vIGFyZ3VtZW50cywgb3IgYW4gb2JqZWN0IGNvbnRhaW5pbmcgbmV3IGRhdGEnICk7XG5cdFx0XHR9XG5cdFx0XHRwcm9taXNlID0gbmV3IFByb21pc2UoIGZ1bmN0aW9uKCBmdWxmaWwgKSB7XG5cdFx0XHRcdGZ1bGZpbFByb21pc2UgPSBmdWxmaWw7XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoIGNhbGxiYWNrICkge1xuXHRcdFx0XHRwcm9taXNlLnRoZW4oIGNhbGxiYWNrICk7XG5cdFx0XHR9XG5cdFx0XHRydW5sb29wLnN0YXJ0KCB0aGlzLCBmdWxmaWxQcm9taXNlICk7XG5cdFx0XHRpZiAoICggd3JhcHBlciA9IHRoaXMuX3dyYXBwZWRbICcnIF0gKSAmJiB3cmFwcGVyLnJlc2V0ICkge1xuXHRcdFx0XHRpZiAoIHdyYXBwZXIucmVzZXQoIGRhdGEgKSA9PT0gZmFsc2UgKSB7XG5cdFx0XHRcdFx0dGhpcy5kYXRhID0gZGF0YTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5kYXRhID0gZGF0YTtcblx0XHRcdH1cblx0XHRcdGNsZWFyQ2FjaGUoIHRoaXMsICcnICk7XG5cdFx0XHRub3RpZnlEZXBlbmRhbnRzKCB0aGlzLCAnJyApO1xuXHRcdFx0cnVubG9vcC5lbmQoKTtcblx0XHRcdHRoaXMuZmlyZSggJ3Jlc2V0JywgZGF0YSApO1xuXHRcdFx0cmV0dXJuIHByb21pc2U7XG5cdFx0fTtcblx0fSggdXRpbHNfUHJvbWlzZSwgZ2xvYmFsX3J1bmxvb3AsIHNoYXJlZF9jbGVhckNhY2hlLCBzaGFyZWRfbm90aWZ5RGVwZW5kYW50cyApO1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9zZXQgPSBmdW5jdGlvbiggcnVubG9vcCwgaXNPYmplY3QsIG5vcm1hbGlzZUtleXBhdGgsIFByb21pc2UsIHNldCApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiBSYWN0aXZlX3Byb3RvdHlwZV9zZXQoIGtleXBhdGgsIHZhbHVlLCBjYWxsYmFjayApIHtcblx0XHRcdHZhciBtYXAsIHByb21pc2UsIGZ1bGZpbFByb21pc2U7XG5cdFx0XHRwcm9taXNlID0gbmV3IFByb21pc2UoIGZ1bmN0aW9uKCBmdWxmaWwgKSB7XG5cdFx0XHRcdGZ1bGZpbFByb21pc2UgPSBmdWxmaWw7XG5cdFx0XHR9ICk7XG5cdFx0XHRydW5sb29wLnN0YXJ0KCB0aGlzLCBmdWxmaWxQcm9taXNlICk7XG5cdFx0XHRpZiAoIGlzT2JqZWN0KCBrZXlwYXRoICkgKSB7XG5cdFx0XHRcdG1hcCA9IGtleXBhdGg7XG5cdFx0XHRcdGNhbGxiYWNrID0gdmFsdWU7XG5cdFx0XHRcdGZvciAoIGtleXBhdGggaW4gbWFwICkge1xuXHRcdFx0XHRcdGlmICggbWFwLmhhc093blByb3BlcnR5KCBrZXlwYXRoICkgKSB7XG5cdFx0XHRcdFx0XHR2YWx1ZSA9IG1hcFsga2V5cGF0aCBdO1xuXHRcdFx0XHRcdFx0a2V5cGF0aCA9IG5vcm1hbGlzZUtleXBhdGgoIGtleXBhdGggKTtcblx0XHRcdFx0XHRcdHNldCggdGhpcywga2V5cGF0aCwgdmFsdWUgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGtleXBhdGggPSBub3JtYWxpc2VLZXlwYXRoKCBrZXlwYXRoICk7XG5cdFx0XHRcdHNldCggdGhpcywga2V5cGF0aCwgdmFsdWUgKTtcblx0XHRcdH1cblx0XHRcdHJ1bmxvb3AuZW5kKCk7XG5cdFx0XHRpZiAoIGNhbGxiYWNrICkge1xuXHRcdFx0XHRwcm9taXNlLnRoZW4oIGNhbGxiYWNrLmJpbmQoIHRoaXMgKSApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHByb21pc2U7XG5cdFx0fTtcblx0fSggZ2xvYmFsX3J1bmxvb3AsIHV0aWxzX2lzT2JqZWN0LCB1dGlsc19ub3JtYWxpc2VLZXlwYXRoLCB1dGlsc19Qcm9taXNlLCBzaGFyZWRfc2V0ICk7XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX3N1YnRyYWN0ID0gZnVuY3Rpb24oIGFkZCApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbigga2V5cGF0aCwgZCApIHtcblx0XHRcdHJldHVybiBhZGQoIHRoaXMsIGtleXBhdGgsIGQgPT09IHVuZGVmaW5lZCA/IC0xIDogLWQgKTtcblx0XHR9O1xuXHR9KCBSYWN0aXZlX3Byb3RvdHlwZV9zaGFyZWRfYWRkICk7XG5cblx0Ly8gVGVhcmRvd24uIFRoaXMgZ29lcyB0aHJvdWdoIHRoZSByb290IGZyYWdtZW50IGFuZCBhbGwgaXRzIGNoaWxkcmVuLCByZW1vdmluZyBvYnNlcnZlcnNcblx0Ly8gYW5kIGdlbmVyYWxseSBjbGVhbmluZyB1cCBhZnRlciBpdHNlbGZcblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX3RlYXJkb3duID0gZnVuY3Rpb24oIHR5cGVzLCBjc3MsIHJ1bmxvb3AsIFByb21pc2UsIGNsZWFyQ2FjaGUgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIGNhbGxiYWNrICkge1xuXHRcdFx0dmFyIGtleXBhdGgsIHByb21pc2UsIGZ1bGZpbFByb21pc2UsIHNob3VsZERlc3Ryb3ksIG9yaWdpbmFsQ2FsbGJhY2ssIGZyYWdtZW50LCBuZWFyZXN0RGV0YWNoaW5nRWxlbWVudCwgdW5yZXNvbHZlZEltcGxpY2l0RGVwZW5kZW5jeTtcblx0XHRcdHRoaXMuZmlyZSggJ3RlYXJkb3duJyApO1xuXHRcdFx0c2hvdWxkRGVzdHJveSA9ICF0aGlzLmNvbXBvbmVudCB8fCB0aGlzLmNvbXBvbmVudC5zaG91bGREZXN0cm95O1xuXHRcdFx0aWYgKCB0aGlzLmNvbnN0cnVjdG9yLmNzcyApIHtcblx0XHRcdFx0aWYgKCBzaG91bGREZXN0cm95ICkge1xuXHRcdFx0XHRcdG9yaWdpbmFsQ2FsbGJhY2sgPSBjYWxsYmFjaztcblx0XHRcdFx0XHRjYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0aWYgKCBvcmlnaW5hbENhbGxiYWNrICkge1xuXHRcdFx0XHRcdFx0XHRvcmlnaW5hbENhbGxiYWNrLmNhbGwoIHRoaXMgKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNzcy5yZW1vdmUoIHRoaXMuY29uc3RydWN0b3IgKTtcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGZyYWdtZW50ID0gdGhpcy5jb21wb25lbnQucGFyZW50RnJhZ21lbnQ7XG5cdFx0XHRcdFx0ZG8ge1xuXHRcdFx0XHRcdFx0aWYgKCBmcmFnbWVudC5vd25lci50eXBlICE9PSB0eXBlcy5FTEVNRU5UICkge1xuXHRcdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmICggZnJhZ21lbnQub3duZXIud2lsbERldGFjaCApIHtcblx0XHRcdFx0XHRcdFx0bmVhcmVzdERldGFjaGluZ0VsZW1lbnQgPSBmcmFnbWVudC5vd25lcjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IHdoaWxlICggIW5lYXJlc3REZXRhY2hpbmdFbGVtZW50ICYmICggZnJhZ21lbnQgPSBmcmFnbWVudC5wYXJlbnQgKSApO1xuXHRcdFx0XHRcdGlmICggIW5lYXJlc3REZXRhY2hpbmdFbGVtZW50ICkge1xuXHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnQSBjb21wb25lbnQgaXMgYmVpbmcgdG9ybiBkb3duIGJ1dCBkb2VzblxcJ3QgaGF2ZSBhIG5lYXJlc3QgZGV0YWNoaW5nIGVsZW1lbnQuLi4gdGhpcyBzaG91bGRuXFwndCBoYXBwZW4hJyApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRuZWFyZXN0RGV0YWNoaW5nRWxlbWVudC5jc3NEZXRhY2hRdWV1ZS5wdXNoKCB0aGlzLmNvbnN0cnVjdG9yICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHByb21pc2UgPSBuZXcgUHJvbWlzZSggZnVuY3Rpb24oIGZ1bGZpbCApIHtcblx0XHRcdFx0ZnVsZmlsUHJvbWlzZSA9IGZ1bGZpbDtcblx0XHRcdH0gKTtcblx0XHRcdHJ1bmxvb3Auc3RhcnQoIHRoaXMsIGZ1bGZpbFByb21pc2UgKTtcblx0XHRcdHRoaXMuZnJhZ21lbnQudGVhcmRvd24oIHNob3VsZERlc3Ryb3kgKTtcblx0XHRcdHdoaWxlICggdGhpcy5fYW5pbWF0aW9uc1sgMCBdICkge1xuXHRcdFx0XHR0aGlzLl9hbmltYXRpb25zWyAwIF0uc3RvcCgpO1xuXHRcdFx0fVxuXHRcdFx0Zm9yICgga2V5cGF0aCBpbiB0aGlzLl9jYWNoZSApIHtcblx0XHRcdFx0Y2xlYXJDYWNoZSggdGhpcywga2V5cGF0aCApO1xuXHRcdFx0fVxuXHRcdFx0d2hpbGUgKCB1bnJlc29sdmVkSW1wbGljaXREZXBlbmRlbmN5ID0gdGhpcy5fdW5yZXNvbHZlZEltcGxpY2l0RGVwZW5kZW5jaWVzLnBvcCgpICkge1xuXHRcdFx0XHR1bnJlc29sdmVkSW1wbGljaXREZXBlbmRlbmN5LnRlYXJkb3duKCk7XG5cdFx0XHR9XG5cdFx0XHRydW5sb29wLmVuZCgpO1xuXHRcdFx0aWYgKCBjYWxsYmFjayApIHtcblx0XHRcdFx0cHJvbWlzZS50aGVuKCBjYWxsYmFjay5iaW5kKCB0aGlzICkgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBwcm9taXNlO1xuXHRcdH07XG5cdH0oIGNvbmZpZ190eXBlcywgZ2xvYmFsX2NzcywgZ2xvYmFsX3J1bmxvb3AsIHV0aWxzX1Byb21pc2UsIHNoYXJlZF9jbGVhckNhY2hlICk7XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX3RvSFRNTCA9IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiB0aGlzLmZyYWdtZW50LnRvU3RyaW5nKCk7XG5cdH07XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX3RvZ2dsZSA9IGZ1bmN0aW9uKCBrZXlwYXRoLCBjYWxsYmFjayApIHtcblx0XHR2YXIgdmFsdWU7XG5cdFx0aWYgKCB0eXBlb2Yga2V5cGF0aCAhPT0gJ3N0cmluZycgKSB7XG5cdFx0XHRpZiAoIHRoaXMuZGVidWcgKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ0JhZCBhcmd1bWVudHMnICk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHZhbHVlID0gdGhpcy5nZXQoIGtleXBhdGggKTtcblx0XHRyZXR1cm4gdGhpcy5zZXQoIGtleXBhdGgsICF2YWx1ZSwgY2FsbGJhY2sgKTtcblx0fTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfdXBkYXRlID0gZnVuY3Rpb24oIHJ1bmxvb3AsIFByb21pc2UsIGNsZWFyQ2FjaGUsIG5vdGlmeURlcGVuZGFudHMgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIGtleXBhdGgsIGNhbGxiYWNrICkge1xuXHRcdFx0dmFyIHByb21pc2UsIGZ1bGZpbFByb21pc2U7XG5cdFx0XHRpZiAoIHR5cGVvZiBrZXlwYXRoID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0XHRjYWxsYmFjayA9IGtleXBhdGg7XG5cdFx0XHRcdGtleXBhdGggPSAnJztcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGtleXBhdGggPSBrZXlwYXRoIHx8ICcnO1xuXHRcdFx0fVxuXHRcdFx0cHJvbWlzZSA9IG5ldyBQcm9taXNlKCBmdW5jdGlvbiggZnVsZmlsICkge1xuXHRcdFx0XHRmdWxmaWxQcm9taXNlID0gZnVsZmlsO1xuXHRcdFx0fSApO1xuXHRcdFx0cnVubG9vcC5zdGFydCggdGhpcywgZnVsZmlsUHJvbWlzZSApO1xuXHRcdFx0Y2xlYXJDYWNoZSggdGhpcywga2V5cGF0aCApO1xuXHRcdFx0bm90aWZ5RGVwZW5kYW50cyggdGhpcywga2V5cGF0aCApO1xuXHRcdFx0cnVubG9vcC5lbmQoKTtcblx0XHRcdHRoaXMuZmlyZSggJ3VwZGF0ZScsIGtleXBhdGggKTtcblx0XHRcdGlmICggY2FsbGJhY2sgKSB7XG5cdFx0XHRcdHByb21pc2UudGhlbiggY2FsbGJhY2suYmluZCggdGhpcyApICk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcHJvbWlzZTtcblx0XHR9O1xuXHR9KCBnbG9iYWxfcnVubG9vcCwgdXRpbHNfUHJvbWlzZSwgc2hhcmVkX2NsZWFyQ2FjaGUsIHNoYXJlZF9ub3RpZnlEZXBlbmRhbnRzICk7XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX3VwZGF0ZU1vZGVsID0gZnVuY3Rpb24oIGdldFZhbHVlRnJvbUNoZWNrYm94ZXMsIGFycmF5Q29udGVudHNNYXRjaCwgaXNFcXVhbCApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiBSYWN0aXZlX3Byb3RvdHlwZV91cGRhdGVNb2RlbCgga2V5cGF0aCwgY2FzY2FkZSApIHtcblx0XHRcdHZhciB2YWx1ZXMsIGRlZmVycmVkQ2hlY2tib3hlcywgaTtcblx0XHRcdGlmICggdHlwZW9mIGtleXBhdGggIT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHRrZXlwYXRoID0gJyc7XG5cdFx0XHRcdGNhc2NhZGUgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0Y29uc29saWRhdGVDaGFuZ2VkVmFsdWVzKCB0aGlzLCBrZXlwYXRoLCB2YWx1ZXMgPSB7fSwgZGVmZXJyZWRDaGVja2JveGVzID0gW10sIGNhc2NhZGUgKTtcblx0XHRcdGlmICggaSA9IGRlZmVycmVkQ2hlY2tib3hlcy5sZW5ndGggKSB7XG5cdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdGtleXBhdGggPSBkZWZlcnJlZENoZWNrYm94ZXNbIGkgXTtcblx0XHRcdFx0XHR2YWx1ZXNbIGtleXBhdGggXSA9IGdldFZhbHVlRnJvbUNoZWNrYm94ZXMoIHRoaXMsIGtleXBhdGggKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0dGhpcy5zZXQoIHZhbHVlcyApO1xuXHRcdH07XG5cblx0XHRmdW5jdGlvbiBjb25zb2xpZGF0ZUNoYW5nZWRWYWx1ZXMoIHJhY3RpdmUsIGtleXBhdGgsIHZhbHVlcywgZGVmZXJyZWRDaGVja2JveGVzLCBjYXNjYWRlICkge1xuXHRcdFx0dmFyIGJpbmRpbmdzLCBjaGlsZERlcHMsIGksIGJpbmRpbmcsIG9sZFZhbHVlLCBuZXdWYWx1ZTtcblx0XHRcdGJpbmRpbmdzID0gcmFjdGl2ZS5fdHdvd2F5QmluZGluZ3NbIGtleXBhdGggXTtcblx0XHRcdGlmICggYmluZGluZ3MgKSB7XG5cdFx0XHRcdGkgPSBiaW5kaW5ncy5sZW5ndGg7XG5cdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdGJpbmRpbmcgPSBiaW5kaW5nc1sgaSBdO1xuXHRcdFx0XHRcdGlmICggYmluZGluZy5yYWRpb05hbWUgJiYgIWJpbmRpbmcubm9kZS5jaGVja2VkICkge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICggYmluZGluZy5jaGVja2JveE5hbWUgKSB7XG5cdFx0XHRcdFx0XHRpZiAoIGJpbmRpbmcuY2hhbmdlZCgpICYmIGRlZmVycmVkQ2hlY2tib3hlc1sga2V5cGF0aCBdICE9PSB0cnVlICkge1xuXHRcdFx0XHRcdFx0XHRkZWZlcnJlZENoZWNrYm94ZXNbIGtleXBhdGggXSA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdGRlZmVycmVkQ2hlY2tib3hlcy5wdXNoKCBrZXlwYXRoICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0b2xkVmFsdWUgPSBiaW5kaW5nLmF0dHIudmFsdWU7XG5cdFx0XHRcdFx0bmV3VmFsdWUgPSBiaW5kaW5nLnZhbHVlKCk7XG5cdFx0XHRcdFx0aWYgKCBhcnJheUNvbnRlbnRzTWF0Y2goIG9sZFZhbHVlLCBuZXdWYWx1ZSApICkge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICggIWlzRXF1YWwoIG9sZFZhbHVlLCBuZXdWYWx1ZSApICkge1xuXHRcdFx0XHRcdFx0dmFsdWVzWyBrZXlwYXRoIF0gPSBuZXdWYWx1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICggIWNhc2NhZGUgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNoaWxkRGVwcyA9IHJhY3RpdmUuX2RlcHNNYXBbIGtleXBhdGggXTtcblx0XHRcdGlmICggY2hpbGREZXBzICkge1xuXHRcdFx0XHRpID0gY2hpbGREZXBzLmxlbmd0aDtcblx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0Y29uc29saWRhdGVDaGFuZ2VkVmFsdWVzKCByYWN0aXZlLCBjaGlsZERlcHNbIGkgXSwgdmFsdWVzLCBkZWZlcnJlZENoZWNrYm94ZXMsIGNhc2NhZGUgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fSggc2hhcmVkX2dldFZhbHVlRnJvbUNoZWNrYm94ZXMsIHV0aWxzX2FycmF5Q29udGVudHNNYXRjaCwgdXRpbHNfaXNFcXVhbCApO1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9fcHJvdG90eXBlID0gZnVuY3Rpb24oIGFkZCwgYW5pbWF0ZSwgZGV0YWNoLCBmaW5kLCBmaW5kQWxsLCBmaW5kQWxsQ29tcG9uZW50cywgZmluZENvbXBvbmVudCwgZmlyZSwgZ2V0LCBpbnNlcnQsIG1lcmdlLCBvYnNlcnZlLCBvZmYsIG9uLCByZW5kZXIsIHJlbmRlckhUTUwsIHJlc2V0LCBzZXQsIHN1YnRyYWN0LCB0ZWFyZG93biwgdG9IVE1MLCB0b2dnbGUsIHVwZGF0ZSwgdXBkYXRlTW9kZWwgKSB7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0YWRkOiBhZGQsXG5cdFx0XHRhbmltYXRlOiBhbmltYXRlLFxuXHRcdFx0ZGV0YWNoOiBkZXRhY2gsXG5cdFx0XHRmaW5kOiBmaW5kLFxuXHRcdFx0ZmluZEFsbDogZmluZEFsbCxcblx0XHRcdGZpbmRBbGxDb21wb25lbnRzOiBmaW5kQWxsQ29tcG9uZW50cyxcblx0XHRcdGZpbmRDb21wb25lbnQ6IGZpbmRDb21wb25lbnQsXG5cdFx0XHRmaXJlOiBmaXJlLFxuXHRcdFx0Z2V0OiBnZXQsXG5cdFx0XHRpbnNlcnQ6IGluc2VydCxcblx0XHRcdG1lcmdlOiBtZXJnZSxcblx0XHRcdG9ic2VydmU6IG9ic2VydmUsXG5cdFx0XHRvZmY6IG9mZixcblx0XHRcdG9uOiBvbixcblx0XHRcdHJlbmRlcjogcmVuZGVyLFxuXHRcdFx0cmVuZGVySFRNTDogcmVuZGVySFRNTCxcblx0XHRcdHJlc2V0OiByZXNldCxcblx0XHRcdHNldDogc2V0LFxuXHRcdFx0c3VidHJhY3Q6IHN1YnRyYWN0LFxuXHRcdFx0dGVhcmRvd246IHRlYXJkb3duLFxuXHRcdFx0dG9IVE1MOiB0b0hUTUwsXG5cdFx0XHR0b2dnbGU6IHRvZ2dsZSxcblx0XHRcdHVwZGF0ZTogdXBkYXRlLFxuXHRcdFx0dXBkYXRlTW9kZWw6IHVwZGF0ZU1vZGVsXG5cdFx0fTtcblx0fSggUmFjdGl2ZV9wcm90b3R5cGVfYWRkLCBSYWN0aXZlX3Byb3RvdHlwZV9hbmltYXRlX19hbmltYXRlLCBSYWN0aXZlX3Byb3RvdHlwZV9kZXRhY2gsIFJhY3RpdmVfcHJvdG90eXBlX2ZpbmQsIFJhY3RpdmVfcHJvdG90eXBlX2ZpbmRBbGwsIFJhY3RpdmVfcHJvdG90eXBlX2ZpbmRBbGxDb21wb25lbnRzLCBSYWN0aXZlX3Byb3RvdHlwZV9maW5kQ29tcG9uZW50LCBSYWN0aXZlX3Byb3RvdHlwZV9maXJlLCBSYWN0aXZlX3Byb3RvdHlwZV9nZXQsIFJhY3RpdmVfcHJvdG90eXBlX2luc2VydCwgUmFjdGl2ZV9wcm90b3R5cGVfbWVyZ2VfX21lcmdlLCBSYWN0aXZlX3Byb3RvdHlwZV9vYnNlcnZlX19vYnNlcnZlLCBSYWN0aXZlX3Byb3RvdHlwZV9vZmYsIFJhY3RpdmVfcHJvdG90eXBlX29uLCBSYWN0aXZlX3Byb3RvdHlwZV9yZW5kZXIsIFJhY3RpdmVfcHJvdG90eXBlX3JlbmRlckhUTUwsIFJhY3RpdmVfcHJvdG90eXBlX3Jlc2V0LCBSYWN0aXZlX3Byb3RvdHlwZV9zZXQsIFJhY3RpdmVfcHJvdG90eXBlX3N1YnRyYWN0LCBSYWN0aXZlX3Byb3RvdHlwZV90ZWFyZG93biwgUmFjdGl2ZV9wcm90b3R5cGVfdG9IVE1MLCBSYWN0aXZlX3Byb3RvdHlwZV90b2dnbGUsIFJhY3RpdmVfcHJvdG90eXBlX3VwZGF0ZSwgUmFjdGl2ZV9wcm90b3R5cGVfdXBkYXRlTW9kZWwgKTtcblxuXHR2YXIgcmVnaXN0cmllc19jb21wb25lbnRzID0ge307XG5cblx0Ly8gVGhlc2UgYXJlIGEgc3Vic2V0IG9mIHRoZSBlYXNpbmcgZXF1YXRpb25zIGZvdW5kIGF0XG5cdC8vIGh0dHBzOi8vcmF3LmdpdGh1Yi5jb20vZGFucm8vZWFzaW5nLWpzIC0gbGljZW5zZSBpbmZvXG5cdC8vIGZvbGxvd3M6XG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cdC8vIGVhc2luZy5qcyB2MC41LjRcblx0Ly8gR2VuZXJpYyBzZXQgb2YgZWFzaW5nIGZ1bmN0aW9ucyB3aXRoIEFNRCBzdXBwb3J0XG5cdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9kYW5yby9lYXNpbmctanNcblx0Ly8gVGhpcyBjb2RlIG1heSBiZSBmcmVlbHkgZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlXG5cdC8vIGh0dHA6Ly9kYW5yby5taXQtbGljZW5zZS5vcmcvXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cdC8vIEFsbCBmdW5jdGlvbnMgYWRhcHRlZCBmcm9tIFRob21hcyBGdWNocyAmIEplcmVteSBLYWhuXG5cdC8vIEVhc2luZyBFcXVhdGlvbnMgKGMpIDIwMDMgUm9iZXJ0IFBlbm5lciwgQlNEIGxpY2Vuc2Vcblx0Ly8gaHR0cHM6Ly9yYXcuZ2l0aHViLmNvbS9kYW5yby9lYXNpbmctanMvbWFzdGVyL0xJQ0VOU0Vcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblx0Ly8gSW4gdGhhdCBsaWJyYXJ5LCB0aGUgZnVuY3Rpb25zIG5hbWVkIGVhc2VJbiwgZWFzZU91dCwgYW5kXG5cdC8vIGVhc2VJbk91dCBiZWxvdyBhcmUgbmFtZWQgZWFzZUluQ3ViaWMsIGVhc2VPdXRDdWJpYywgYW5kXG5cdC8vICh5b3UgZ3Vlc3NlZCBpdCkgZWFzZUluT3V0Q3ViaWMuXG5cdC8vXG5cdC8vIFlvdSBjYW4gYWRkIGFkZGl0aW9uYWwgZWFzaW5nIGZ1bmN0aW9ucyB0byB0aGlzIGxpc3QsIGFuZCB0aGV5XG5cdC8vIHdpbGwgYmUgZ2xvYmFsbHkgYXZhaWxhYmxlLlxuXHR2YXIgcmVnaXN0cmllc19lYXNpbmcgPSB7XG5cdFx0bGluZWFyOiBmdW5jdGlvbiggcG9zICkge1xuXHRcdFx0cmV0dXJuIHBvcztcblx0XHR9LFxuXHRcdGVhc2VJbjogZnVuY3Rpb24oIHBvcyApIHtcblx0XHRcdHJldHVybiBNYXRoLnBvdyggcG9zLCAzICk7XG5cdFx0fSxcblx0XHRlYXNlT3V0OiBmdW5jdGlvbiggcG9zICkge1xuXHRcdFx0cmV0dXJuIE1hdGgucG93KCBwb3MgLSAxLCAzICkgKyAxO1xuXHRcdH0sXG5cdFx0ZWFzZUluT3V0OiBmdW5jdGlvbiggcG9zICkge1xuXHRcdFx0aWYgKCAoIHBvcyAvPSAwLjUgKSA8IDEgKSB7XG5cdFx0XHRcdHJldHVybiAwLjUgKiBNYXRoLnBvdyggcG9zLCAzICk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gMC41ICogKCBNYXRoLnBvdyggcG9zIC0gMiwgMyApICsgMiApO1xuXHRcdH1cblx0fTtcblxuXHR2YXIgdXRpbHNfZ2V0R3VpZCA9IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiAneHh4eHh4eHgteHh4eC00eHh4LXl4eHgteHh4eHh4eHh4eHh4Jy5yZXBsYWNlKCAvW3h5XS9nLCBmdW5jdGlvbiggYyApIHtcblx0XHRcdHZhciByLCB2O1xuXHRcdFx0ciA9IE1hdGgucmFuZG9tKCkgKiAxNiB8IDA7XG5cdFx0XHR2ID0gYyA9PSAneCcgPyByIDogciAmIDMgfCA4O1xuXHRcdFx0cmV0dXJuIHYudG9TdHJpbmcoIDE2ICk7XG5cdFx0fSApO1xuXHR9O1xuXG5cdHZhciB1dGlsc19leHRlbmQgPSBmdW5jdGlvbiggdGFyZ2V0ICkge1xuXHRcdHZhciBwcm9wLCBzb3VyY2UsIHNvdXJjZXMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCggYXJndW1lbnRzLCAxICk7XG5cdFx0d2hpbGUgKCBzb3VyY2UgPSBzb3VyY2VzLnNoaWZ0KCkgKSB7XG5cdFx0XHRmb3IgKCBwcm9wIGluIHNvdXJjZSApIHtcblx0XHRcdFx0aWYgKCBzb3VyY2UuaGFzT3duUHJvcGVydHkoIHByb3AgKSApIHtcblx0XHRcdFx0XHR0YXJnZXRbIHByb3AgXSA9IHNvdXJjZVsgcHJvcCBdO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB0YXJnZXQ7XG5cdH07XG5cblx0dmFyIGNvbmZpZ19yZWdpc3RyaWVzID0gW1xuXHRcdCdhZGFwdG9ycycsXG5cdFx0J2NvbXBvbmVudHMnLFxuXHRcdCdkZWNvcmF0b3JzJyxcblx0XHQnZWFzaW5nJyxcblx0XHQnZXZlbnRzJyxcblx0XHQnaW50ZXJwb2xhdG9ycycsXG5cdFx0J3BhcnRpYWxzJyxcblx0XHQndHJhbnNpdGlvbnMnLFxuXHRcdCdkYXRhJ1xuXHRdO1xuXG5cdHZhciBleHRlbmRfdXRpbHNfdHJhbnNmb3JtQ3NzID0gZnVuY3Rpb24oKSB7XG5cblx0XHR2YXIgc2VsZWN0b3JzUGF0dGVybiA9IC8oPzpefFxcfSk/XFxzKihbXlxce1xcfV0rKVxccypcXHsvZyxcblx0XHRcdGNvbW1lbnRzUGF0dGVybiA9IC9cXC9cXCouKj9cXCpcXC8vZyxcblx0XHRcdHNlbGVjdG9yVW5pdFBhdHRlcm4gPSAvKCg/Oig/OlxcW1teXFxdK11cXF0pfCg/OlteXFxzXFwrXFw+XFx+Ol0pKSspKCg/OjpbXlxcc1xcK1xcPlxcfl0rKT9cXHMqW1xcc1xcK1xcPlxcfl0/KVxccyovZztcblx0XHRyZXR1cm4gZnVuY3Rpb24gdHJhbnNmb3JtQ3NzKCBjc3MsIGd1aWQgKSB7XG5cdFx0XHR2YXIgdHJhbnNmb3JtZWQsIGFkZEd1aWQ7XG5cdFx0XHRhZGRHdWlkID0gZnVuY3Rpb24oIHNlbGVjdG9yICkge1xuXHRcdFx0XHR2YXIgc2VsZWN0b3JVbml0cywgbWF0Y2gsIHVuaXQsIGRhdGFBdHRyLCBiYXNlLCBwcmVwZW5kZWQsIGFwcGVuZGVkLCBpLCB0cmFuc2Zvcm1lZCA9IFtdO1xuXHRcdFx0XHRzZWxlY3RvclVuaXRzID0gW107XG5cdFx0XHRcdHdoaWxlICggbWF0Y2ggPSBzZWxlY3RvclVuaXRQYXR0ZXJuLmV4ZWMoIHNlbGVjdG9yICkgKSB7XG5cdFx0XHRcdFx0c2VsZWN0b3JVbml0cy5wdXNoKCB7XG5cdFx0XHRcdFx0XHRzdHI6IG1hdGNoWyAwIF0sXG5cdFx0XHRcdFx0XHRiYXNlOiBtYXRjaFsgMSBdLFxuXHRcdFx0XHRcdFx0bW9kaWZpZXJzOiBtYXRjaFsgMiBdXG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGRhdGFBdHRyID0gJ1tkYXRhLXJ2Y2d1aWQ9XCInICsgZ3VpZCArICdcIl0nO1xuXHRcdFx0XHRiYXNlID0gc2VsZWN0b3JVbml0cy5tYXAoIGV4dHJhY3RTdHJpbmcgKTtcblx0XHRcdFx0aSA9IHNlbGVjdG9yVW5pdHMubGVuZ3RoO1xuXHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRhcHBlbmRlZCA9IGJhc2Uuc2xpY2UoKTtcblx0XHRcdFx0XHR1bml0ID0gc2VsZWN0b3JVbml0c1sgaSBdO1xuXHRcdFx0XHRcdGFwcGVuZGVkWyBpIF0gPSB1bml0LmJhc2UgKyBkYXRhQXR0ciArIHVuaXQubW9kaWZpZXJzIHx8ICcnO1xuXHRcdFx0XHRcdHByZXBlbmRlZCA9IGJhc2Uuc2xpY2UoKTtcblx0XHRcdFx0XHRwcmVwZW5kZWRbIGkgXSA9IGRhdGFBdHRyICsgJyAnICsgcHJlcGVuZGVkWyBpIF07XG5cdFx0XHRcdFx0dHJhbnNmb3JtZWQucHVzaCggYXBwZW5kZWQuam9pbiggJyAnICksIHByZXBlbmRlZC5qb2luKCAnICcgKSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0cmFuc2Zvcm1lZC5qb2luKCAnLCAnICk7XG5cdFx0XHR9O1xuXHRcdFx0dHJhbnNmb3JtZWQgPSBjc3MucmVwbGFjZSggY29tbWVudHNQYXR0ZXJuLCAnJyApLnJlcGxhY2UoIHNlbGVjdG9yc1BhdHRlcm4sIGZ1bmN0aW9uKCBtYXRjaCwgJDEgKSB7XG5cdFx0XHRcdHZhciBzZWxlY3RvcnMsIHRyYW5zZm9ybWVkO1xuXHRcdFx0XHRzZWxlY3RvcnMgPSAkMS5zcGxpdCggJywnICkubWFwKCB0cmltICk7XG5cdFx0XHRcdHRyYW5zZm9ybWVkID0gc2VsZWN0b3JzLm1hcCggYWRkR3VpZCApLmpvaW4oICcsICcgKSArICcgJztcblx0XHRcdFx0cmV0dXJuIG1hdGNoLnJlcGxhY2UoICQxLCB0cmFuc2Zvcm1lZCApO1xuXHRcdFx0fSApO1xuXHRcdFx0cmV0dXJuIHRyYW5zZm9ybWVkO1xuXHRcdH07XG5cblx0XHRmdW5jdGlvbiB0cmltKCBzdHIgKSB7XG5cdFx0XHRpZiAoIHN0ci50cmltICkge1xuXHRcdFx0XHRyZXR1cm4gc3RyLnRyaW0oKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBzdHIucmVwbGFjZSggL15cXHMrLywgJycgKS5yZXBsYWNlKCAvXFxzKyQvLCAnJyApO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGV4dHJhY3RTdHJpbmcoIHVuaXQgKSB7XG5cdFx0XHRyZXR1cm4gdW5pdC5zdHI7XG5cdFx0fVxuXHR9KCk7XG5cblx0dmFyIGV4dGVuZF9pbmhlcml0RnJvbVBhcmVudCA9IGZ1bmN0aW9uKCByZWdpc3RyaWVzLCBjcmVhdGUsIGRlZmluZVByb3BlcnR5LCB0cmFuc2Zvcm1Dc3MgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIENoaWxkLCBQYXJlbnQgKSB7XG5cdFx0XHRyZWdpc3RyaWVzLmZvckVhY2goIGZ1bmN0aW9uKCBwcm9wZXJ0eSApIHtcblx0XHRcdFx0aWYgKCBQYXJlbnRbIHByb3BlcnR5IF0gKSB7XG5cdFx0XHRcdFx0Q2hpbGRbIHByb3BlcnR5IF0gPSBjcmVhdGUoIFBhcmVudFsgcHJvcGVydHkgXSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRkZWZpbmVQcm9wZXJ0eSggQ2hpbGQsICdkZWZhdWx0cycsIHtcblx0XHRcdFx0dmFsdWU6IGNyZWF0ZSggUGFyZW50LmRlZmF1bHRzIClcblx0XHRcdH0gKTtcblx0XHRcdGlmICggUGFyZW50LmNzcyApIHtcblx0XHRcdFx0ZGVmaW5lUHJvcGVydHkoIENoaWxkLCAnY3NzJywge1xuXHRcdFx0XHRcdHZhbHVlOiBQYXJlbnQuZGVmYXVsdHMubm9Dc3NUcmFuc2Zvcm0gPyBQYXJlbnQuY3NzIDogdHJhbnNmb3JtQ3NzKCBQYXJlbnQuY3NzLCBDaGlsZC5fZ3VpZCApXG5cdFx0XHRcdH0gKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9KCBjb25maWdfcmVnaXN0cmllcywgdXRpbHNfY3JlYXRlLCB1dGlsc19kZWZpbmVQcm9wZXJ0eSwgZXh0ZW5kX3V0aWxzX3RyYW5zZm9ybUNzcyApO1xuXG5cdHZhciBleHRlbmRfd3JhcE1ldGhvZCA9IGZ1bmN0aW9uKCBtZXRob2QsIHN1cGVyTWV0aG9kICkge1xuXHRcdGlmICggL19zdXBlci8udGVzdCggbWV0aG9kICkgKSB7XG5cdFx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBfc3VwZXIgPSB0aGlzLl9zdXBlcixcblx0XHRcdFx0XHRyZXN1bHQ7XG5cdFx0XHRcdHRoaXMuX3N1cGVyID0gc3VwZXJNZXRob2Q7XG5cdFx0XHRcdHJlc3VsdCA9IG1ldGhvZC5hcHBseSggdGhpcywgYXJndW1lbnRzICk7XG5cdFx0XHRcdHRoaXMuX3N1cGVyID0gX3N1cGVyO1xuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0fTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIG1ldGhvZDtcblx0XHR9XG5cdH07XG5cblx0dmFyIGV4dGVuZF91dGlsc19hdWdtZW50ID0gZnVuY3Rpb24oIHRhcmdldCwgc291cmNlICkge1xuXHRcdHZhciBrZXk7XG5cdFx0Zm9yICgga2V5IGluIHNvdXJjZSApIHtcblx0XHRcdGlmICggc291cmNlLmhhc093blByb3BlcnR5KCBrZXkgKSApIHtcblx0XHRcdFx0dGFyZ2V0WyBrZXkgXSA9IHNvdXJjZVsga2V5IF07XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB0YXJnZXQ7XG5cdH07XG5cblx0dmFyIGV4dGVuZF9pbmhlcml0RnJvbUNoaWxkUHJvcHMgPSBmdW5jdGlvbiggaW5pdE9wdGlvbnMsIHJlZ2lzdHJpZXMsIGRlZmluZVByb3BlcnR5LCB3cmFwTWV0aG9kLCBhdWdtZW50LCB0cmFuc2Zvcm1Dc3MgKSB7XG5cblx0XHR2YXIgYmxhY2tsaXN0ZWQgPSB7fTtcblx0XHRyZWdpc3RyaWVzLmNvbmNhdCggaW5pdE9wdGlvbnMua2V5cyApLmZvckVhY2goIGZ1bmN0aW9uKCBwcm9wZXJ0eSApIHtcblx0XHRcdGJsYWNrbGlzdGVkWyBwcm9wZXJ0eSBdID0gdHJ1ZTtcblx0XHR9ICk7XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBDaGlsZCwgY2hpbGRQcm9wcyApIHtcblx0XHRcdHZhciBrZXksIG1lbWJlcjtcblx0XHRcdHJlZ2lzdHJpZXMuZm9yRWFjaCggZnVuY3Rpb24oIHByb3BlcnR5ICkge1xuXHRcdFx0XHR2YXIgdmFsdWUgPSBjaGlsZFByb3BzWyBwcm9wZXJ0eSBdO1xuXHRcdFx0XHRpZiAoIHZhbHVlICkge1xuXHRcdFx0XHRcdGlmICggQ2hpbGRbIHByb3BlcnR5IF0gKSB7XG5cdFx0XHRcdFx0XHRhdWdtZW50KCBDaGlsZFsgcHJvcGVydHkgXSwgdmFsdWUgKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Q2hpbGRbIHByb3BlcnR5IF0gPSB2YWx1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdGluaXRPcHRpb25zLmtleXMuZm9yRWFjaCggZnVuY3Rpb24oIGtleSApIHtcblx0XHRcdFx0dmFyIHZhbHVlID0gY2hpbGRQcm9wc1sga2V5IF07XG5cdFx0XHRcdGlmICggdmFsdWUgIT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgQ2hpbGRbIGtleSBdID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0XHRcdFx0Q2hpbGQuZGVmYXVsdHNbIGtleSBdID0gd3JhcE1ldGhvZCggdmFsdWUsIENoaWxkWyBrZXkgXSApO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRDaGlsZC5kZWZhdWx0c1sga2V5IF0gPSBjaGlsZFByb3BzWyBrZXkgXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdGZvciAoIGtleSBpbiBjaGlsZFByb3BzICkge1xuXHRcdFx0XHRpZiAoICFibGFja2xpc3RlZFsga2V5IF0gJiYgY2hpbGRQcm9wcy5oYXNPd25Qcm9wZXJ0eSgga2V5ICkgKSB7XG5cdFx0XHRcdFx0bWVtYmVyID0gY2hpbGRQcm9wc1sga2V5IF07XG5cdFx0XHRcdFx0aWYgKCB0eXBlb2YgbWVtYmVyID09PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBDaGlsZC5wcm90b3R5cGVbIGtleSBdID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0XHRcdFx0Q2hpbGQucHJvdG90eXBlWyBrZXkgXSA9IHdyYXBNZXRob2QoIG1lbWJlciwgQ2hpbGQucHJvdG90eXBlWyBrZXkgXSApO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRDaGlsZC5wcm90b3R5cGVbIGtleSBdID0gbWVtYmVyO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCBjaGlsZFByb3BzLmNzcyApIHtcblx0XHRcdFx0ZGVmaW5lUHJvcGVydHkoIENoaWxkLCAnY3NzJywge1xuXHRcdFx0XHRcdHZhbHVlOiBDaGlsZC5kZWZhdWx0cy5ub0Nzc1RyYW5zZm9ybSA/IGNoaWxkUHJvcHMuY3NzIDogdHJhbnNmb3JtQ3NzKCBjaGlsZFByb3BzLmNzcywgQ2hpbGQuX2d1aWQgKVxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fSggY29uZmlnX2luaXRPcHRpb25zLCBjb25maWdfcmVnaXN0cmllcywgdXRpbHNfZGVmaW5lUHJvcGVydHksIGV4dGVuZF93cmFwTWV0aG9kLCBleHRlbmRfdXRpbHNfYXVnbWVudCwgZXh0ZW5kX3V0aWxzX3RyYW5zZm9ybUNzcyApO1xuXG5cdHZhciBleHRlbmRfZXh0cmFjdElubGluZVBhcnRpYWxzID0gZnVuY3Rpb24oIGlzT2JqZWN0LCBhdWdtZW50ICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBDaGlsZCwgY2hpbGRQcm9wcyApIHtcblx0XHRcdGlmICggaXNPYmplY3QoIENoaWxkLmRlZmF1bHRzLnRlbXBsYXRlICkgKSB7XG5cdFx0XHRcdGlmICggIUNoaWxkLnBhcnRpYWxzICkge1xuXHRcdFx0XHRcdENoaWxkLnBhcnRpYWxzID0ge307XG5cdFx0XHRcdH1cblx0XHRcdFx0YXVnbWVudCggQ2hpbGQucGFydGlhbHMsIENoaWxkLmRlZmF1bHRzLnRlbXBsYXRlLnBhcnRpYWxzICk7XG5cdFx0XHRcdGlmICggY2hpbGRQcm9wcy5wYXJ0aWFscyApIHtcblx0XHRcdFx0XHRhdWdtZW50KCBDaGlsZC5wYXJ0aWFscywgY2hpbGRQcm9wcy5wYXJ0aWFscyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdENoaWxkLmRlZmF1bHRzLnRlbXBsYXRlID0gQ2hpbGQuZGVmYXVsdHMudGVtcGxhdGUubWFpbjtcblx0XHRcdH1cblx0XHR9O1xuXHR9KCB1dGlsc19pc09iamVjdCwgZXh0ZW5kX3V0aWxzX2F1Z21lbnQgKTtcblxuXHR2YXIgZXh0ZW5kX2NvbmRpdGlvbmFsbHlQYXJzZVRlbXBsYXRlID0gZnVuY3Rpb24oIGVycm9ycywgaXNDbGllbnQsIHBhcnNlICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBDaGlsZCApIHtcblx0XHRcdHZhciB0ZW1wbGF0ZUVsO1xuXHRcdFx0aWYgKCB0eXBlb2YgQ2hpbGQuZGVmYXVsdHMudGVtcGxhdGUgPT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHRpZiAoICFwYXJzZSApIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoIGVycm9ycy5taXNzaW5nUGFyc2VyICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBDaGlsZC5kZWZhdWx0cy50ZW1wbGF0ZS5jaGFyQXQoIDAgKSA9PT0gJyMnICYmIGlzQ2xpZW50ICkge1xuXHRcdFx0XHRcdHRlbXBsYXRlRWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggQ2hpbGQuZGVmYXVsdHMudGVtcGxhdGUuc3Vic3RyaW5nKCAxICkgKTtcblx0XHRcdFx0XHRpZiAoIHRlbXBsYXRlRWwgJiYgdGVtcGxhdGVFbC50YWdOYW1lID09PSAnU0NSSVBUJyApIHtcblx0XHRcdFx0XHRcdENoaWxkLmRlZmF1bHRzLnRlbXBsYXRlID0gcGFyc2UoIHRlbXBsYXRlRWwuaW5uZXJIVE1MLCBDaGlsZCApO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdDb3VsZCBub3QgZmluZCB0ZW1wbGF0ZSBlbGVtZW50ICgnICsgQ2hpbGQuZGVmYXVsdHMudGVtcGxhdGUgKyAnKScgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Q2hpbGQuZGVmYXVsdHMudGVtcGxhdGUgPSBwYXJzZSggQ2hpbGQuZGVmYXVsdHMudGVtcGxhdGUsIENoaWxkLmRlZmF1bHRzICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHR9KCBjb25maWdfZXJyb3JzLCBjb25maWdfaXNDbGllbnQsIHBhcnNlX19wYXJzZSApO1xuXG5cdHZhciBleHRlbmRfY29uZGl0aW9uYWxseVBhcnNlUGFydGlhbHMgPSBmdW5jdGlvbiggZXJyb3JzLCBwYXJzZSApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggQ2hpbGQgKSB7XG5cdFx0XHR2YXIga2V5O1xuXHRcdFx0aWYgKCBDaGlsZC5wYXJ0aWFscyApIHtcblx0XHRcdFx0Zm9yICgga2V5IGluIENoaWxkLnBhcnRpYWxzICkge1xuXHRcdFx0XHRcdGlmICggQ2hpbGQucGFydGlhbHMuaGFzT3duUHJvcGVydHkoIGtleSApICYmIHR5cGVvZiBDaGlsZC5wYXJ0aWFsc1sga2V5IF0gPT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHRcdFx0aWYgKCAhcGFyc2UgKSB7XG5cdFx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggZXJyb3JzLm1pc3NpbmdQYXJzZXIgKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdENoaWxkLnBhcnRpYWxzWyBrZXkgXSA9IHBhcnNlKCBDaGlsZC5wYXJ0aWFsc1sga2V5IF0sIENoaWxkICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0fSggY29uZmlnX2Vycm9ycywgcGFyc2VfX3BhcnNlICk7XG5cblx0dmFyIFJhY3RpdmVfaW5pdGlhbGlzZSA9IGZ1bmN0aW9uKCBpc0NsaWVudCwgZXJyb3JzLCBpbml0T3B0aW9ucywgcmVnaXN0cmllcywgd2FybiwgY3JlYXRlLCBleHRlbmQsIGZpbGxHYXBzLCBkZWZpbmVQcm9wZXJ0aWVzLCBnZXRFbGVtZW50LCBpc09iamVjdCwgaXNBcnJheSwgZ2V0R3VpZCwgUHJvbWlzZSwgbWFnaWNBZGFwdG9yLCBwYXJzZSApIHtcblxuXHRcdHZhciBmbGFncyA9IFtcblx0XHRcdCdhZGFwdCcsXG5cdFx0XHQnbW9kaWZ5QXJyYXlzJyxcblx0XHRcdCdtYWdpYycsXG5cdFx0XHQndHdvd2F5Jyxcblx0XHRcdCdsYXp5Jyxcblx0XHRcdCdkZWJ1ZycsXG5cdFx0XHQnaXNvbGF0ZWQnXG5cdFx0XTtcblx0XHRyZXR1cm4gZnVuY3Rpb24gaW5pdGlhbGlzZVJhY3RpdmVJbnN0YW5jZSggcmFjdGl2ZSwgb3B0aW9ucyApIHtcblx0XHRcdHZhciB0ZW1wbGF0ZSwgdGVtcGxhdGVFbCwgcGFyc2VkVGVtcGxhdGUsIHByb21pc2UsIGZ1bGZpbFByb21pc2U7XG5cdFx0XHRpZiAoIGlzQXJyYXkoIG9wdGlvbnMuYWRhcHRvcnMgKSApIHtcblx0XHRcdFx0d2FybiggJ1RoZSBgYWRhcHRvcnNgIG9wdGlvbiwgdG8gaW5kaWNhdGUgd2hpY2ggYWRhcHRvcnMgc2hvdWxkIGJlIHVzZWQgd2l0aCBhIGdpdmVuIFJhY3RpdmUgaW5zdGFuY2UsIGhhcyBiZWVuIGRlcHJlY2F0ZWQgaW4gZmF2b3VyIG9mIGBhZGFwdGAuIFNlZSBbVE9ET10gZm9yIG1vcmUgaW5mb3JtYXRpb24nICk7XG5cdFx0XHRcdG9wdGlvbnMuYWRhcHQgPSBvcHRpb25zLmFkYXB0b3JzO1xuXHRcdFx0XHRkZWxldGUgb3B0aW9ucy5hZGFwdG9ycztcblx0XHRcdH1cblx0XHRcdGluaXRPcHRpb25zLmtleXMuZm9yRWFjaCggZnVuY3Rpb24oIGtleSApIHtcblx0XHRcdFx0aWYgKCBvcHRpb25zWyBrZXkgXSA9PT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRcdG9wdGlvbnNbIGtleSBdID0gcmFjdGl2ZS5jb25zdHJ1Y3Rvci5kZWZhdWx0c1sga2V5IF07XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdGZsYWdzLmZvckVhY2goIGZ1bmN0aW9uKCBmbGFnICkge1xuXHRcdFx0XHRyYWN0aXZlWyBmbGFnIF0gPSBvcHRpb25zWyBmbGFnIF07XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoIHR5cGVvZiByYWN0aXZlLmFkYXB0ID09PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0cmFjdGl2ZS5hZGFwdCA9IFsgcmFjdGl2ZS5hZGFwdCBdO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCByYWN0aXZlLm1hZ2ljICYmICFtYWdpY0FkYXB0b3IgKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ0dldHRlcnMgYW5kIHNldHRlcnMgKG1hZ2ljIG1vZGUpIGFyZSBub3Qgc3VwcG9ydGVkIGluIHRoaXMgYnJvd3NlcicgKTtcblx0XHRcdH1cblx0XHRcdGRlZmluZVByb3BlcnRpZXMoIHJhY3RpdmUsIHtcblx0XHRcdFx0X2luaXRpbmc6IHtcblx0XHRcdFx0XHR2YWx1ZTogdHJ1ZSxcblx0XHRcdFx0XHR3cml0YWJsZTogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRfZ3VpZDoge1xuXHRcdFx0XHRcdHZhbHVlOiBnZXRHdWlkKClcblx0XHRcdFx0fSxcblx0XHRcdFx0X3N1YnM6IHtcblx0XHRcdFx0XHR2YWx1ZTogY3JlYXRlKCBudWxsICksXG5cdFx0XHRcdFx0Y29uZmlndXJhYmxlOiB0cnVlXG5cdFx0XHRcdH0sXG5cdFx0XHRcdF9jYWNoZToge1xuXHRcdFx0XHRcdHZhbHVlOiB7fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRfY2FjaGVNYXA6IHtcblx0XHRcdFx0XHR2YWx1ZTogY3JlYXRlKCBudWxsIClcblx0XHRcdFx0fSxcblx0XHRcdFx0X2RlcHM6IHtcblx0XHRcdFx0XHR2YWx1ZTogW11cblx0XHRcdFx0fSxcblx0XHRcdFx0X2RlcHNNYXA6IHtcblx0XHRcdFx0XHR2YWx1ZTogY3JlYXRlKCBudWxsIClcblx0XHRcdFx0fSxcblx0XHRcdFx0X3BhdHRlcm5PYnNlcnZlcnM6IHtcblx0XHRcdFx0XHR2YWx1ZTogW11cblx0XHRcdFx0fSxcblx0XHRcdFx0X2V2YWx1YXRvcnM6IHtcblx0XHRcdFx0XHR2YWx1ZTogY3JlYXRlKCBudWxsIClcblx0XHRcdFx0fSxcblx0XHRcdFx0X3R3b3dheUJpbmRpbmdzOiB7XG5cdFx0XHRcdFx0dmFsdWU6IHt9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdF9hbmltYXRpb25zOiB7XG5cdFx0XHRcdFx0dmFsdWU6IFtdXG5cdFx0XHRcdH0sXG5cdFx0XHRcdG5vZGVzOiB7XG5cdFx0XHRcdFx0dmFsdWU6IHt9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdF93cmFwcGVkOiB7XG5cdFx0XHRcdFx0dmFsdWU6IGNyZWF0ZSggbnVsbCApXG5cdFx0XHRcdH0sXG5cdFx0XHRcdF9saXZlUXVlcmllczoge1xuXHRcdFx0XHRcdHZhbHVlOiBbXVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRfbGl2ZUNvbXBvbmVudFF1ZXJpZXM6IHtcblx0XHRcdFx0XHR2YWx1ZTogW11cblx0XHRcdFx0fSxcblx0XHRcdFx0X2NoaWxkSW5pdFF1ZXVlOiB7XG5cdFx0XHRcdFx0dmFsdWU6IFtdXG5cdFx0XHRcdH0sXG5cdFx0XHRcdF9jaGFuZ2VzOiB7XG5cdFx0XHRcdFx0dmFsdWU6IFtdXG5cdFx0XHRcdH0sXG5cdFx0XHRcdF91bnJlc29sdmVkSW1wbGljaXREZXBlbmRlbmNpZXM6IHtcblx0XHRcdFx0XHR2YWx1ZTogW11cblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCBvcHRpb25zLl9wYXJlbnQgJiYgb3B0aW9ucy5fY29tcG9uZW50ICkge1xuXHRcdFx0XHRkZWZpbmVQcm9wZXJ0aWVzKCByYWN0aXZlLCB7XG5cdFx0XHRcdFx0X3BhcmVudDoge1xuXHRcdFx0XHRcdFx0dmFsdWU6IG9wdGlvbnMuX3BhcmVudFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0Y29tcG9uZW50OiB7XG5cdFx0XHRcdFx0XHR2YWx1ZTogb3B0aW9ucy5fY29tcG9uZW50XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdG9wdGlvbnMuX2NvbXBvbmVudC5pbnN0YW5jZSA9IHJhY3RpdmU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIG9wdGlvbnMuZWwgKSB7XG5cdFx0XHRcdHJhY3RpdmUuZWwgPSBnZXRFbGVtZW50KCBvcHRpb25zLmVsICk7XG5cdFx0XHRcdGlmICggIXJhY3RpdmUuZWwgJiYgcmFjdGl2ZS5kZWJ1ZyApIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdDb3VsZCBub3QgZmluZCBjb250YWluZXIgZWxlbWVudCcgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCBvcHRpb25zLmV2ZW50RGVmaW5pdGlvbnMgKSB7XG5cdFx0XHRcdHdhcm4oICdyYWN0aXZlLmV2ZW50RGVmaW5pdGlvbnMgaGFzIGJlZW4gZGVwcmVjYXRlZCBpbiBmYXZvdXIgb2YgcmFjdGl2ZS5ldmVudHMuIFN1cHBvcnQgd2lsbCBiZSByZW1vdmVkIGluIGZ1dHVyZSB2ZXJzaW9ucycgKTtcblx0XHRcdFx0b3B0aW9ucy5ldmVudHMgPSBvcHRpb25zLmV2ZW50RGVmaW5pdGlvbnM7XG5cdFx0XHR9XG5cdFx0XHRyZWdpc3RyaWVzLmZvckVhY2goIGZ1bmN0aW9uKCByZWdpc3RyeSApIHtcblx0XHRcdFx0aWYgKCByYWN0aXZlLmNvbnN0cnVjdG9yWyByZWdpc3RyeSBdICkge1xuXHRcdFx0XHRcdHJhY3RpdmVbIHJlZ2lzdHJ5IF0gPSBleHRlbmQoIGNyZWF0ZSggcmFjdGl2ZS5jb25zdHJ1Y3RvclsgcmVnaXN0cnkgXSApLCBvcHRpb25zWyByZWdpc3RyeSBdICk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoIG9wdGlvbnNbIHJlZ2lzdHJ5IF0gKSB7XG5cdFx0XHRcdFx0cmFjdGl2ZVsgcmVnaXN0cnkgXSA9IG9wdGlvbnNbIHJlZ2lzdHJ5IF07XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdGlmICggIXJhY3RpdmUuZGF0YSApIHtcblx0XHRcdFx0cmFjdGl2ZS5kYXRhID0ge307XG5cdFx0XHR9XG5cdFx0XHR0ZW1wbGF0ZSA9IG9wdGlvbnMudGVtcGxhdGU7XG5cdFx0XHRpZiAoIHR5cGVvZiB0ZW1wbGF0ZSA9PT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdGlmICggIXBhcnNlICkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggZXJyb3JzLm1pc3NpbmdQYXJzZXIgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHRlbXBsYXRlLmNoYXJBdCggMCApID09PSAnIycgJiYgaXNDbGllbnQgKSB7XG5cdFx0XHRcdFx0dGVtcGxhdGVFbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCB0ZW1wbGF0ZS5zdWJzdHJpbmcoIDEgKSApO1xuXHRcdFx0XHRcdGlmICggdGVtcGxhdGVFbCApIHtcblx0XHRcdFx0XHRcdHBhcnNlZFRlbXBsYXRlID0gcGFyc2UoIHRlbXBsYXRlRWwuaW5uZXJIVE1MLCBvcHRpb25zICk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ0NvdWxkIG5vdCBmaW5kIHRlbXBsYXRlIGVsZW1lbnQgKCcgKyB0ZW1wbGF0ZSArICcpJyApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRwYXJzZWRUZW1wbGF0ZSA9IHBhcnNlKCB0ZW1wbGF0ZSwgb3B0aW9ucyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRwYXJzZWRUZW1wbGF0ZSA9IHRlbXBsYXRlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBpc09iamVjdCggcGFyc2VkVGVtcGxhdGUgKSApIHtcblx0XHRcdFx0ZmlsbEdhcHMoIHJhY3RpdmUucGFydGlhbHMsIHBhcnNlZFRlbXBsYXRlLnBhcnRpYWxzICk7XG5cdFx0XHRcdHBhcnNlZFRlbXBsYXRlID0gcGFyc2VkVGVtcGxhdGUubWFpbjtcblx0XHRcdH1cblx0XHRcdGlmICggcGFyc2VkVGVtcGxhdGUgJiYgcGFyc2VkVGVtcGxhdGUubGVuZ3RoID09PSAxICYmIHR5cGVvZiBwYXJzZWRUZW1wbGF0ZVsgMCBdID09PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0cGFyc2VkVGVtcGxhdGUgPSBwYXJzZWRUZW1wbGF0ZVsgMCBdO1xuXHRcdFx0fVxuXHRcdFx0cmFjdGl2ZS50ZW1wbGF0ZSA9IHBhcnNlZFRlbXBsYXRlO1xuXHRcdFx0ZXh0ZW5kKCByYWN0aXZlLnBhcnRpYWxzLCBvcHRpb25zLnBhcnRpYWxzICk7XG5cdFx0XHRyYWN0aXZlLnBhcnNlT3B0aW9ucyA9IHtcblx0XHRcdFx0cHJlc2VydmVXaGl0ZXNwYWNlOiBvcHRpb25zLnByZXNlcnZlV2hpdGVzcGFjZSxcblx0XHRcdFx0c2FuaXRpemU6IG9wdGlvbnMuc2FuaXRpemUsXG5cdFx0XHRcdHN0cmlwQ29tbWVudHM6IG9wdGlvbnMuc3RyaXBDb21tZW50c1xuXHRcdFx0fTtcblx0XHRcdHJhY3RpdmUudHJhbnNpdGlvbnNFbmFibGVkID0gb3B0aW9ucy5ub0ludHJvID8gZmFsc2UgOiBvcHRpb25zLnRyYW5zaXRpb25zRW5hYmxlZDtcblx0XHRcdGlmICggaXNDbGllbnQgJiYgIXJhY3RpdmUuZWwgKSB7XG5cdFx0XHRcdHJhY3RpdmUuZWwgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHJhY3RpdmUuZWwgJiYgIW9wdGlvbnMuYXBwZW5kICkge1xuXHRcdFx0XHRyYWN0aXZlLmVsLmlubmVySFRNTCA9ICcnO1xuXHRcdFx0fVxuXHRcdFx0cHJvbWlzZSA9IG5ldyBQcm9taXNlKCBmdW5jdGlvbiggZnVsZmlsICkge1xuXHRcdFx0XHRmdWxmaWxQcm9taXNlID0gZnVsZmlsO1xuXHRcdFx0fSApO1xuXHRcdFx0cmFjdGl2ZS5yZW5kZXIoIHJhY3RpdmUuZWwsIGZ1bGZpbFByb21pc2UgKTtcblx0XHRcdGlmICggb3B0aW9ucy5jb21wbGV0ZSApIHtcblx0XHRcdFx0cHJvbWlzZS50aGVuKCBvcHRpb25zLmNvbXBsZXRlLmJpbmQoIHJhY3RpdmUgKSApO1xuXHRcdFx0fVxuXHRcdFx0cmFjdGl2ZS50cmFuc2l0aW9uc0VuYWJsZWQgPSBvcHRpb25zLnRyYW5zaXRpb25zRW5hYmxlZDtcblx0XHRcdHJhY3RpdmUuX2luaXRpbmcgPSBmYWxzZTtcblx0XHR9O1xuXHR9KCBjb25maWdfaXNDbGllbnQsIGNvbmZpZ19lcnJvcnMsIGNvbmZpZ19pbml0T3B0aW9ucywgY29uZmlnX3JlZ2lzdHJpZXMsIHV0aWxzX3dhcm4sIHV0aWxzX2NyZWF0ZSwgdXRpbHNfZXh0ZW5kLCB1dGlsc19maWxsR2FwcywgdXRpbHNfZGVmaW5lUHJvcGVydGllcywgdXRpbHNfZ2V0RWxlbWVudCwgdXRpbHNfaXNPYmplY3QsIHV0aWxzX2lzQXJyYXksIHV0aWxzX2dldEd1aWQsIHV0aWxzX1Byb21pc2UsIHNoYXJlZF9nZXRfbWFnaWNBZGFwdG9yLCBwYXJzZV9fcGFyc2UgKTtcblxuXHR2YXIgZXh0ZW5kX2luaXRDaGlsZEluc3RhbmNlID0gZnVuY3Rpb24oIGluaXRPcHRpb25zLCB3cmFwTWV0aG9kLCBpbml0aWFsaXNlICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uIGluaXRDaGlsZEluc3RhbmNlKCBjaGlsZCwgQ2hpbGQsIG9wdGlvbnMgKSB7XG5cdFx0XHRpbml0T3B0aW9ucy5rZXlzLmZvckVhY2goIGZ1bmN0aW9uKCBrZXkgKSB7XG5cdFx0XHRcdHZhciB2YWx1ZSA9IG9wdGlvbnNbIGtleSBdLFxuXHRcdFx0XHRcdGRlZmF1bHRWYWx1ZSA9IENoaWxkLmRlZmF1bHRzWyBrZXkgXTtcblx0XHRcdFx0aWYgKCB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicgJiYgdHlwZW9mIGRlZmF1bHRWYWx1ZSA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdFx0XHRvcHRpb25zWyBrZXkgXSA9IHdyYXBNZXRob2QoIHZhbHVlLCBkZWZhdWx0VmFsdWUgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCBjaGlsZC5iZWZvcmVJbml0ICkge1xuXHRcdFx0XHRjaGlsZC5iZWZvcmVJbml0KCBvcHRpb25zICk7XG5cdFx0XHR9XG5cdFx0XHRpbml0aWFsaXNlKCBjaGlsZCwgb3B0aW9ucyApO1xuXHRcdFx0aWYgKCBvcHRpb25zLl9wYXJlbnQgJiYgb3B0aW9ucy5fcGFyZW50Ll9yZW5kZXJpbmcgKSB7XG5cdFx0XHRcdG9wdGlvbnMuX3BhcmVudC5fY2hpbGRJbml0UXVldWUucHVzaCgge1xuXHRcdFx0XHRcdGluc3RhbmNlOiBjaGlsZCxcblx0XHRcdFx0XHRvcHRpb25zOiBvcHRpb25zXG5cdFx0XHRcdH0gKTtcblx0XHRcdH0gZWxzZSBpZiAoIGNoaWxkLmluaXQgKSB7XG5cdFx0XHRcdGNoaWxkLmluaXQoIG9wdGlvbnMgKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9KCBjb25maWdfaW5pdE9wdGlvbnMsIGV4dGVuZF93cmFwTWV0aG9kLCBSYWN0aXZlX2luaXRpYWxpc2UgKTtcblxuXHR2YXIgZXh0ZW5kX19leHRlbmQgPSBmdW5jdGlvbiggY3JlYXRlLCBkZWZpbmVQcm9wZXJ0aWVzLCBnZXRHdWlkLCBleHRlbmRPYmplY3QsIGluaGVyaXRGcm9tUGFyZW50LCBpbmhlcml0RnJvbUNoaWxkUHJvcHMsIGV4dHJhY3RJbmxpbmVQYXJ0aWFscywgY29uZGl0aW9uYWxseVBhcnNlVGVtcGxhdGUsIGNvbmRpdGlvbmFsbHlQYXJzZVBhcnRpYWxzLCBpbml0Q2hpbGRJbnN0YW5jZSwgY2lyY3VsYXIgKSB7XG5cblx0XHR2YXIgUmFjdGl2ZTtcblx0XHRjaXJjdWxhci5wdXNoKCBmdW5jdGlvbigpIHtcblx0XHRcdFJhY3RpdmUgPSBjaXJjdWxhci5SYWN0aXZlO1xuXHRcdH0gKTtcblx0XHRyZXR1cm4gZnVuY3Rpb24gZXh0ZW5kKCBjaGlsZFByb3BzICkge1xuXHRcdFx0dmFyIFBhcmVudCA9IHRoaXMsXG5cdFx0XHRcdENoaWxkLCBhZGFwdG9yLCBpO1xuXHRcdFx0aWYgKCBjaGlsZFByb3BzLnByb3RvdHlwZSBpbnN0YW5jZW9mIFJhY3RpdmUgKSB7XG5cdFx0XHRcdGNoaWxkUHJvcHMgPSBleHRlbmRPYmplY3QoIHt9LCBjaGlsZFByb3BzLCBjaGlsZFByb3BzLnByb3RvdHlwZSwgY2hpbGRQcm9wcy5kZWZhdWx0cyApO1xuXHRcdFx0fVxuXHRcdFx0Q2hpbGQgPSBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFx0aW5pdENoaWxkSW5zdGFuY2UoIHRoaXMsIENoaWxkLCBvcHRpb25zIHx8IHt9ICk7XG5cdFx0XHR9O1xuXHRcdFx0Q2hpbGQucHJvdG90eXBlID0gY3JlYXRlKCBQYXJlbnQucHJvdG90eXBlICk7XG5cdFx0XHRDaGlsZC5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBDaGlsZDtcblx0XHRcdGRlZmluZVByb3BlcnRpZXMoIENoaWxkLCB7XG5cdFx0XHRcdGV4dGVuZDoge1xuXHRcdFx0XHRcdHZhbHVlOiBQYXJlbnQuZXh0ZW5kXG5cdFx0XHRcdH0sXG5cdFx0XHRcdF9ndWlkOiB7XG5cdFx0XHRcdFx0dmFsdWU6IGdldEd1aWQoKVxuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRpbmhlcml0RnJvbVBhcmVudCggQ2hpbGQsIFBhcmVudCApO1xuXHRcdFx0aW5oZXJpdEZyb21DaGlsZFByb3BzKCBDaGlsZCwgY2hpbGRQcm9wcyApO1xuXHRcdFx0aWYgKCBDaGlsZC5hZGFwdG9ycyAmJiAoIGkgPSBDaGlsZC5kZWZhdWx0cy5hZGFwdC5sZW5ndGggKSApIHtcblx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0YWRhcHRvciA9IENoaWxkLmRlZmF1bHRzLmFkYXB0WyBpIF07XG5cdFx0XHRcdFx0aWYgKCB0eXBlb2YgYWRhcHRvciA9PT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdFx0XHRDaGlsZC5kZWZhdWx0cy5hZGFwdFsgaSBdID0gQ2hpbGQuYWRhcHRvcnNbIGFkYXB0b3IgXSB8fCBhZGFwdG9yO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCBjaGlsZFByb3BzLnRlbXBsYXRlICkge1xuXHRcdFx0XHRjb25kaXRpb25hbGx5UGFyc2VUZW1wbGF0ZSggQ2hpbGQgKTtcblx0XHRcdFx0ZXh0cmFjdElubGluZVBhcnRpYWxzKCBDaGlsZCwgY2hpbGRQcm9wcyApO1xuXHRcdFx0XHRjb25kaXRpb25hbGx5UGFyc2VQYXJ0aWFscyggQ2hpbGQgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBDaGlsZDtcblx0XHR9O1xuXHR9KCB1dGlsc19jcmVhdGUsIHV0aWxzX2RlZmluZVByb3BlcnRpZXMsIHV0aWxzX2dldEd1aWQsIHV0aWxzX2V4dGVuZCwgZXh0ZW5kX2luaGVyaXRGcm9tUGFyZW50LCBleHRlbmRfaW5oZXJpdEZyb21DaGlsZFByb3BzLCBleHRlbmRfZXh0cmFjdElubGluZVBhcnRpYWxzLCBleHRlbmRfY29uZGl0aW9uYWxseVBhcnNlVGVtcGxhdGUsIGV4dGVuZF9jb25kaXRpb25hbGx5UGFyc2VQYXJ0aWFscywgZXh0ZW5kX2luaXRDaGlsZEluc3RhbmNlLCBjaXJjdWxhciApO1xuXG5cdHZhciBSYWN0aXZlX19SYWN0aXZlID0gZnVuY3Rpb24oIGluaXRPcHRpb25zLCBzdmcsIGRlZmluZVByb3BlcnRpZXMsIHByb3RvdHlwZSwgcGFydGlhbFJlZ2lzdHJ5LCBhZGFwdG9yUmVnaXN0cnksIGNvbXBvbmVudHNSZWdpc3RyeSwgZWFzaW5nUmVnaXN0cnksIGludGVycG9sYXRvcnNSZWdpc3RyeSwgUHJvbWlzZSwgZXh0ZW5kLCBwYXJzZSwgaW5pdGlhbGlzZSwgY2lyY3VsYXIgKSB7XG5cblx0XHR2YXIgUmFjdGl2ZSA9IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0aW5pdGlhbGlzZSggdGhpcywgb3B0aW9ucyApO1xuXHRcdH07XG5cdFx0ZGVmaW5lUHJvcGVydGllcyggUmFjdGl2ZSwge1xuXHRcdFx0cHJvdG90eXBlOiB7XG5cdFx0XHRcdHZhbHVlOiBwcm90b3R5cGVcblx0XHRcdH0sXG5cdFx0XHRwYXJ0aWFsczoge1xuXHRcdFx0XHR2YWx1ZTogcGFydGlhbFJlZ2lzdHJ5XG5cdFx0XHR9LFxuXHRcdFx0YWRhcHRvcnM6IHtcblx0XHRcdFx0dmFsdWU6IGFkYXB0b3JSZWdpc3RyeVxuXHRcdFx0fSxcblx0XHRcdGVhc2luZzoge1xuXHRcdFx0XHR2YWx1ZTogZWFzaW5nUmVnaXN0cnlcblx0XHRcdH0sXG5cdFx0XHR0cmFuc2l0aW9uczoge1xuXHRcdFx0XHR2YWx1ZToge31cblx0XHRcdH0sXG5cdFx0XHRldmVudHM6IHtcblx0XHRcdFx0dmFsdWU6IHt9XG5cdFx0XHR9LFxuXHRcdFx0Y29tcG9uZW50czoge1xuXHRcdFx0XHR2YWx1ZTogY29tcG9uZW50c1JlZ2lzdHJ5XG5cdFx0XHR9LFxuXHRcdFx0ZGVjb3JhdG9yczoge1xuXHRcdFx0XHR2YWx1ZToge31cblx0XHRcdH0sXG5cdFx0XHRpbnRlcnBvbGF0b3JzOiB7XG5cdFx0XHRcdHZhbHVlOiBpbnRlcnBvbGF0b3JzUmVnaXN0cnlcblx0XHRcdH0sXG5cdFx0XHRkZWZhdWx0czoge1xuXHRcdFx0XHR2YWx1ZTogaW5pdE9wdGlvbnMuZGVmYXVsdHNcblx0XHRcdH0sXG5cdFx0XHRzdmc6IHtcblx0XHRcdFx0dmFsdWU6IHN2Z1xuXHRcdFx0fSxcblx0XHRcdFZFUlNJT046IHtcblx0XHRcdFx0dmFsdWU6ICd2MC4zLjktMzE3LWQyM2U0MDgnXG5cdFx0XHR9XG5cdFx0fSApO1xuXHRcdFJhY3RpdmUuZXZlbnREZWZpbml0aW9ucyA9IFJhY3RpdmUuZXZlbnRzO1xuXHRcdFJhY3RpdmUucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gUmFjdGl2ZTtcblx0XHRSYWN0aXZlLlByb21pc2UgPSBQcm9taXNlO1xuXHRcdFJhY3RpdmUuZXh0ZW5kID0gZXh0ZW5kO1xuXHRcdFJhY3RpdmUucGFyc2UgPSBwYXJzZTtcblx0XHRjaXJjdWxhci5SYWN0aXZlID0gUmFjdGl2ZTtcblx0XHRyZXR1cm4gUmFjdGl2ZTtcblx0fSggY29uZmlnX2luaXRPcHRpb25zLCBjb25maWdfc3ZnLCB1dGlsc19kZWZpbmVQcm9wZXJ0aWVzLCBSYWN0aXZlX3Byb3RvdHlwZV9fcHJvdG90eXBlLCByZWdpc3RyaWVzX3BhcnRpYWxzLCByZWdpc3RyaWVzX2FkYXB0b3JzLCByZWdpc3RyaWVzX2NvbXBvbmVudHMsIHJlZ2lzdHJpZXNfZWFzaW5nLCByZWdpc3RyaWVzX2ludGVycG9sYXRvcnMsIHV0aWxzX1Byb21pc2UsIGV4dGVuZF9fZXh0ZW5kLCBwYXJzZV9fcGFyc2UsIFJhY3RpdmVfaW5pdGlhbGlzZSwgY2lyY3VsYXIgKTtcblxuXHR2YXIgUmFjdGl2ZSA9IGZ1bmN0aW9uKCBSYWN0aXZlLCBjaXJjdWxhciwgbGVnYWN5ICkge1xuXG5cdFx0dmFyIEZVTkNUSU9OID0gJ2Z1bmN0aW9uJztcblx0XHR3aGlsZSAoIGNpcmN1bGFyLmxlbmd0aCApIHtcblx0XHRcdGNpcmN1bGFyLnBvcCgpKCk7XG5cdFx0fVxuXHRcdGlmICggdHlwZW9mIERhdGUubm93ICE9PSBGVU5DVElPTiB8fCB0eXBlb2YgU3RyaW5nLnByb3RvdHlwZS50cmltICE9PSBGVU5DVElPTiB8fCB0eXBlb2YgT2JqZWN0LmtleXMgIT09IEZVTkNUSU9OIHx8IHR5cGVvZiBBcnJheS5wcm90b3R5cGUuaW5kZXhPZiAhPT0gRlVOQ1RJT04gfHwgdHlwZW9mIEFycmF5LnByb3RvdHlwZS5mb3JFYWNoICE9PSBGVU5DVElPTiB8fCB0eXBlb2YgQXJyYXkucHJvdG90eXBlLm1hcCAhPT0gRlVOQ1RJT04gfHwgdHlwZW9mIEFycmF5LnByb3RvdHlwZS5maWx0ZXIgIT09IEZVTkNUSU9OIHx8IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciAhPT0gRlVOQ1RJT04gKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdJdCBsb29rcyBsaWtlIHlvdVxcJ3JlIGF0dGVtcHRpbmcgdG8gdXNlIFJhY3RpdmUuanMgaW4gYW4gb2xkZXIgYnJvd3Nlci4gWW91XFwnbGwgbmVlZCB0byB1c2Ugb25lIG9mIHRoZSBcXCdsZWdhY3kgYnVpbGRzXFwnIGluIG9yZGVyIHRvIGNvbnRpbnVlIC0gc2VlIGh0dHA6Ly9kb2NzLnJhY3RpdmVqcy5vcmcvbGF0ZXN0L2xlZ2FjeS1idWlsZHMgZm9yIG1vcmUgaW5mb3JtYXRpb24uJyApO1xuXHRcdH1cblx0XHRpZiAoIHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHdpbmRvdy5Ob2RlICYmICF3aW5kb3cuTm9kZS5wcm90b3R5cGUuY29udGFpbnMgJiYgd2luZG93LkhUTUxFbGVtZW50ICYmIHdpbmRvdy5IVE1MRWxlbWVudC5wcm90b3R5cGUuY29udGFpbnMgKSB7XG5cdFx0XHR3aW5kb3cuTm9kZS5wcm90b3R5cGUuY29udGFpbnMgPSB3aW5kb3cuSFRNTEVsZW1lbnQucHJvdG90eXBlLmNvbnRhaW5zO1xuXHRcdH1cblx0XHRyZXR1cm4gUmFjdGl2ZTtcblx0fSggUmFjdGl2ZV9fUmFjdGl2ZSwgY2lyY3VsYXIsIGxlZ2FjeSApO1xuXG5cblx0Ly8gZXhwb3J0IGFzIENvbW1vbiBKUyBtb2R1bGUuLi5cblx0aWYgKCB0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiICYmIG1vZHVsZS5leHBvcnRzICkge1xuXHRcdG1vZHVsZS5leHBvcnRzID0gUmFjdGl2ZTtcblx0fVxuXG5cdC8vIC4uLiBvciBhcyBBTUQgbW9kdWxlXG5cdGVsc2UgaWYgKCB0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgZGVmaW5lLmFtZCApIHtcblx0XHRkZWZpbmUoIGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIFJhY3RpdmU7XG5cdFx0fSApO1xuXHR9XG5cblx0Ly8gLi4uIG9yIGFzIGJyb3dzZXIgZ2xvYmFsXG5cdGdsb2JhbC5SYWN0aXZlID0gUmFjdGl2ZTtcblxuXHRSYWN0aXZlLm5vQ29uZmxpY3QgPSBmdW5jdGlvbigpIHtcblx0XHRnbG9iYWwuUmFjdGl2ZSA9IG5vQ29uZmxpY3Q7XG5cdFx0cmV0dXJuIFJhY3RpdmU7XG5cdH07XG5cbn0oIHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gd2luZG93IDogdGhpcyApICk7XG4iXX0=
;