(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

/*
  State -> UI
*/
var eventSource = new EventSource('/events');

eventSource.addEventListener('message', function (evt) {
  var content = JSON.parse(evt.data);
  console.log('%o for %o', content.topic, content);
  switch(content.topic) {
    case 'audio.volume':
      ui.set(content.topic, content.data.volume);
      break;
  }
});

},{"./utils":2,"./xhr":3,"ractive":17,"ractive-events-tap":16}],2:[function(require,module,exports){
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

},{}],3:[function(require,module,exports){
var Promise = Promise || require('es6-promise').Promise;

module.exports = xhr;

['get', 'delete', 'post', 'put'].forEach(function (method) {
  console.log('binding ', method)
  module.exports[method] = function() {
    var args = Array.prototype.slice.call(arguments),
        newArgs = [method].concat(args);

    console.log('args %o - newArgs %o', args, newArgs);

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

},{"es6-promise":5}],4:[function(require,module,exports){
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

},{}],5:[function(require,module,exports){
"use strict";
var Promise = require("./promise/promise").Promise;
var polyfill = require("./promise/polyfill").polyfill;
exports.Promise = Promise;
exports.polyfill = polyfill;
},{"./promise/polyfill":10,"./promise/promise":11}],6:[function(require,module,exports){
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
},{"./utils":15}],7:[function(require,module,exports){
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
},{"/Users/andrew/Projects/oss/radiodan/magic-button/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":4}],8:[function(require,module,exports){
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
},{}],9:[function(require,module,exports){
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
},{}],10:[function(require,module,exports){
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
},{"./promise":11,"./utils":15}],11:[function(require,module,exports){
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
},{"./all":6,"./asap":7,"./cast":8,"./config":9,"./race":12,"./reject":13,"./resolve":14,"./utils":15}],12:[function(require,module,exports){
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
},{"./utils":15}],13:[function(require,module,exports){
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
},{}],14:[function(require,module,exports){
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
},{}],15:[function(require,module,exports){
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
},{}],16:[function(require,module,exports){
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

},{"ractive":17}],17:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvYW5kcmV3L1Byb2plY3RzL29zcy9yYWRpb2Rhbi9tYWdpYy1idXR0b24vbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9hbmRyZXcvUHJvamVjdHMvb3NzL3JhZGlvZGFuL21hZ2ljLWJ1dHRvbi9hcHAvdWkvc3RhdGljL2pzL2FwcC5qcyIsIi9Vc2Vycy9hbmRyZXcvUHJvamVjdHMvb3NzL3JhZGlvZGFuL21hZ2ljLWJ1dHRvbi9hcHAvdWkvc3RhdGljL2pzL3V0aWxzLmpzIiwiL1VzZXJzL2FuZHJldy9Qcm9qZWN0cy9vc3MvcmFkaW9kYW4vbWFnaWMtYnV0dG9uL2FwcC91aS9zdGF0aWMvanMveGhyLmpzIiwiL1VzZXJzL2FuZHJldy9Qcm9qZWN0cy9vc3MvcmFkaW9kYW4vbWFnaWMtYnV0dG9uL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9pbnNlcnQtbW9kdWxlLWdsb2JhbHMvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIi9Vc2Vycy9hbmRyZXcvUHJvamVjdHMvb3NzL3JhZGlvZGFuL21hZ2ljLWJ1dHRvbi9ub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9jb21tb25qcy9tYWluLmpzIiwiL1VzZXJzL2FuZHJldy9Qcm9qZWN0cy9vc3MvcmFkaW9kYW4vbWFnaWMtYnV0dG9uL25vZGVfbW9kdWxlcy9lczYtcHJvbWlzZS9kaXN0L2NvbW1vbmpzL3Byb21pc2UvYWxsLmpzIiwiL1VzZXJzL2FuZHJldy9Qcm9qZWN0cy9vc3MvcmFkaW9kYW4vbWFnaWMtYnV0dG9uL25vZGVfbW9kdWxlcy9lczYtcHJvbWlzZS9kaXN0L2NvbW1vbmpzL3Byb21pc2UvYXNhcC5qcyIsIi9Vc2Vycy9hbmRyZXcvUHJvamVjdHMvb3NzL3JhZGlvZGFuL21hZ2ljLWJ1dHRvbi9ub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9jb21tb25qcy9wcm9taXNlL2Nhc3QuanMiLCIvVXNlcnMvYW5kcmV3L1Byb2plY3RzL29zcy9yYWRpb2Rhbi9tYWdpYy1idXR0b24vbm9kZV9tb2R1bGVzL2VzNi1wcm9taXNlL2Rpc3QvY29tbW9uanMvcHJvbWlzZS9jb25maWcuanMiLCIvVXNlcnMvYW5kcmV3L1Byb2plY3RzL29zcy9yYWRpb2Rhbi9tYWdpYy1idXR0b24vbm9kZV9tb2R1bGVzL2VzNi1wcm9taXNlL2Rpc3QvY29tbW9uanMvcHJvbWlzZS9wb2x5ZmlsbC5qcyIsIi9Vc2Vycy9hbmRyZXcvUHJvamVjdHMvb3NzL3JhZGlvZGFuL21hZ2ljLWJ1dHRvbi9ub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9jb21tb25qcy9wcm9taXNlL3Byb21pc2UuanMiLCIvVXNlcnMvYW5kcmV3L1Byb2plY3RzL29zcy9yYWRpb2Rhbi9tYWdpYy1idXR0b24vbm9kZV9tb2R1bGVzL2VzNi1wcm9taXNlL2Rpc3QvY29tbW9uanMvcHJvbWlzZS9yYWNlLmpzIiwiL1VzZXJzL2FuZHJldy9Qcm9qZWN0cy9vc3MvcmFkaW9kYW4vbWFnaWMtYnV0dG9uL25vZGVfbW9kdWxlcy9lczYtcHJvbWlzZS9kaXN0L2NvbW1vbmpzL3Byb21pc2UvcmVqZWN0LmpzIiwiL1VzZXJzL2FuZHJldy9Qcm9qZWN0cy9vc3MvcmFkaW9kYW4vbWFnaWMtYnV0dG9uL25vZGVfbW9kdWxlcy9lczYtcHJvbWlzZS9kaXN0L2NvbW1vbmpzL3Byb21pc2UvcmVzb2x2ZS5qcyIsIi9Vc2Vycy9hbmRyZXcvUHJvamVjdHMvb3NzL3JhZGlvZGFuL21hZ2ljLWJ1dHRvbi9ub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9jb21tb25qcy9wcm9taXNlL3V0aWxzLmpzIiwiL1VzZXJzL2FuZHJldy9Qcm9qZWN0cy9vc3MvcmFkaW9kYW4vbWFnaWMtYnV0dG9uL25vZGVfbW9kdWxlcy9yYWN0aXZlLWV2ZW50cy10YXAvcmFjdGl2ZS1ldmVudHMtdGFwLmpzIiwiL1VzZXJzL2FuZHJldy9Qcm9qZWN0cy9vc3MvcmFkaW9kYW4vbWFnaWMtYnV0dG9uL25vZGVfbW9kdWxlcy9yYWN0aXZlL2J1aWxkL1JhY3RpdmUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcE5BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2UUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsImNvbnNvbGUubG9nKCdDb3JlIGFwcCBzdGFydGVkJyk7XG5cbnZhciBSYWN0aXZlID0gcmVxdWlyZSgncmFjdGl2ZScpLFxuICAgIHhociAgICAgPSByZXF1aXJlKCcuL3hocicpLFxuICAgIHV0aWxzICAgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG5cbi8qXG4gIFJhY3RpdmUgcGx1Z2luc1xuKi9cbnJlcXVpcmUoJ3JhY3RpdmUtZXZlbnRzLXRhcCcpO1xuXG52YXIgY29udGFpbmVyID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignW2RhdGEtdWktY29udGFpbmVyXScpLFxuICAgIHRlbXBsYXRlICA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLXVpLXRlbXBsYXRlXScpLmlubmVyVGV4dCxcbiAgICBkZWZhdWx0cyAgPSB7XG4gICAgICBzZXJ2aWNlczogW10sXG4gICAgICBhdWRpbyAgIDoge31cbiAgICB9LFxuICAgIHVpO1xuXG53aW5kb3cudWkgPSB1aSA9IG5ldyBSYWN0aXZlKHtcbiAgZWwgICAgICAgIDogY29udGFpbmVyLFxuICB0ZW1wbGF0ZSAgOiB0ZW1wbGF0ZSxcbiAgZGF0YSAgICAgIDogZGF0YSB8fCBkZWZhdWx0c1xufSk7XG5cbi8qXG4gIExvZ2dpbmdcbiovXG51aS5vbignc2V0JywgZnVuY3Rpb24gKGtleXBhdGgsIHZhbHVlKSB7XG4gIGNvbnNvbGUubG9nKCdzZXQnLCBrZXlwYXRoLCB2YWx1ZSk7XG59KTtcblxuLypcbiAgR2VuZXJpYyBwcm9taXNlIHN1Y2Nlc3Mgb3IgZmFpbHVyZSBvcHRpb25zXG4qL1xuZnVuY3Rpb24gc3VjY2Vzcyhjb250ZW50KSB7XG4gIGNvbnNvbGUubG9nKCdzdWNjZXNzJywgY29udGVudCk7XG59XG5cbmZ1bmN0aW9uIGZhaWx1cmUoZXJyKSB7XG4gIGNvbnNvbGUud2FybignZmFpbHVyZScsIGVycik7XG59XG5cbi8qXG4gIFVJIC0+IFN0YXRlXG4qL1xudWkub24oJ3ZvbHVtZScsIHV0aWxzLmRlYm91bmNlKHVpVm9sdW1lQ2hhbmdlLCAyNTApKTtcbnVpLm9uKCdzZXJ2aWNlJywgdWlTZXJ2aWNlQ2hhbmdlKTtcblxuZnVuY3Rpb24gdWlWb2x1bWVDaGFuZ2UoZXZ0KSB7XG4gIHZhciB2YWx1ZSA9IGV2dC5jb250ZXh0LnZvbHVtZTtcbiAgY29uc29sZS5sb2coJ3VpOiB2b2x1bWUgY2hhbmdlZCcsIHZhbHVlKTtcbiAgeGhyLnBvc3QoJy9yYWRpby92b2x1bWUvdmFsdWUvJyArIHZhbHVlICkudGhlbihzdWNjZXNzLCBmYWlsdXJlKTtcbn1cblxuZnVuY3Rpb24gdWlTZXJ2aWNlQ2hhbmdlKGV2dCkge1xuICB2YXIgaWQgPSBldnQuY29udGV4dC5pZDtcbiAgZXZ0Lm9yaWdpbmFsLnByZXZlbnREZWZhdWx0KCk7XG4gIGNvbnNvbGUubG9nKCd1aTogc2VydmljZSBzZWxlY3RlZCcsIGV2dC5jb250ZXh0KTtcbiAgdGhpcy5zZXQoJ2N1cnJlbnQnLCBpZCk7XG4gIHhoci5wb3N0KCcvcmFkaW8vc2VydmljZS8nICsgaWQgKS50aGVuKHN1Y2Nlc3MsIGZhaWx1cmUpO1xufVxuXG4vKlxuICBTdGF0ZSAtPiBVSVxuKi9cbnZhciBldmVudFNvdXJjZSA9IG5ldyBFdmVudFNvdXJjZSgnL2V2ZW50cycpO1xuXG5ldmVudFNvdXJjZS5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24gKGV2dCkge1xuICB2YXIgY29udGVudCA9IEpTT04ucGFyc2UoZXZ0LmRhdGEpO1xuICBjb25zb2xlLmxvZygnJW8gZm9yICVvJywgY29udGVudC50b3BpYywgY29udGVudCk7XG4gIHN3aXRjaChjb250ZW50LnRvcGljKSB7XG4gICAgY2FzZSAnYXVkaW8udm9sdW1lJzpcbiAgICAgIHVpLnNldChjb250ZW50LnRvcGljLCBjb250ZW50LmRhdGEudm9sdW1lKTtcbiAgICAgIGJyZWFrO1xuICB9XG59KTtcbiIsIm1vZHVsZS5leHBvcnRzID0ge1xuICBkZWJvdW5jZTogZnVuY3Rpb24gZGVib3VuY2UoZm4sIGRlbGF5KSB7XG4gICAgdmFyIHRpbWVyID0gbnVsbDtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGNvbnRleHQgPSB0aGlzLCBhcmdzID0gYXJndW1lbnRzO1xuICAgICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcbiAgICAgIHRpbWVyID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZuLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgfSwgZGVsYXkpO1xuICAgIH07XG4gIH0sXG4gIHRocm90dGxlOiBmdW5jdGlvbiB0aHJvdHRsZShmbiwgdGhyZXNoaG9sZCwgc2NvcGUpIHtcbiAgICB0aHJlc2hob2xkIHx8ICh0aHJlc2hob2xkID0gMjUwKTtcbiAgICB2YXIgbGFzdCxcbiAgICAgICAgZGVmZXJUaW1lcjtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGNvbnRleHQgPSBzY29wZSB8fCB0aGlzO1xuXG4gICAgICB2YXIgbm93ID0gK25ldyBEYXRlLFxuICAgICAgICAgIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICBpZiAobGFzdCAmJiBub3cgPCBsYXN0ICsgdGhyZXNoaG9sZCkge1xuICAgICAgICAvLyBob2xkIG9uIHRvIGl0XG4gICAgICAgIGNsZWFyVGltZW91dChkZWZlclRpbWVyKTtcbiAgICAgICAgZGVmZXJUaW1lciA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGxhc3QgPSBub3c7XG4gICAgICAgICAgZm4uYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICAgIH0sIHRocmVzaGhvbGQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGFzdCA9IG5vdztcbiAgICAgICAgZm4uYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICB9XG4gICAgfTtcbiAgfVxufTtcbiIsInZhciBQcm9taXNlID0gUHJvbWlzZSB8fCByZXF1aXJlKCdlczYtcHJvbWlzZScpLlByb21pc2U7XG5cbm1vZHVsZS5leHBvcnRzID0geGhyO1xuXG5bJ2dldCcsICdkZWxldGUnLCAncG9zdCcsICdwdXQnXS5mb3JFYWNoKGZ1bmN0aW9uIChtZXRob2QpIHtcbiAgY29uc29sZS5sb2coJ2JpbmRpbmcgJywgbWV0aG9kKVxuICBtb2R1bGUuZXhwb3J0c1ttZXRob2RdID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpLFxuICAgICAgICBuZXdBcmdzID0gW21ldGhvZF0uY29uY2F0KGFyZ3MpO1xuXG4gICAgY29uc29sZS5sb2coJ2FyZ3MgJW8gLSBuZXdBcmdzICVvJywgYXJncywgbmV3QXJncyk7XG5cbiAgICByZXR1cm4geGhyLmFwcGx5KG51bGwsIG5ld0FyZ3MpO1xuICB9XG59KVxuXG5mdW5jdGlvbiB4aHIobWV0aG9kLCB1cmwpIHtcbiAgbWV0aG9kID0gbWV0aG9kID8gbWV0aG9kLnRvVXBwZXJDYXNlKCkgOiAnR0VUJztcbiAgLy8gUmV0dXJuIGEgbmV3IHByb21pc2UuXG4gIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAvLyBEbyB0aGUgdXN1YWwgWEhSIHN0dWZmXG4gICAgdmFyIHJlcSA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIHJlcS5vcGVuKG1ldGhvZCwgdXJsKTtcblxuICAgIHJlcS5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgIC8vIFRoaXMgaXMgY2FsbGVkIGV2ZW4gb24gNDA0IGV0Y1xuICAgICAgLy8gc28gY2hlY2sgdGhlIHN0YXR1c1xuICAgICAgaWYgKHJlcS5zdGF0dXMgPT0gMjAwKSB7XG4gICAgICAgIC8vIFJlc29sdmUgdGhlIHByb21pc2Ugd2l0aCB0aGUgcmVzcG9uc2UgdGV4dFxuICAgICAgICByZXNvbHZlKHJlcS5yZXNwb25zZSk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgLy8gT3RoZXJ3aXNlIHJlamVjdCB3aXRoIHRoZSBzdGF0dXMgdGV4dFxuICAgICAgICAvLyB3aGljaCB3aWxsIGhvcGVmdWxseSBiZSBhIG1lYW5pbmdmdWwgZXJyb3JcbiAgICAgICAgcmVqZWN0KEVycm9yKHJlcS5zdGF0dXNUZXh0KSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8vIEhhbmRsZSBuZXR3b3JrIGVycm9yc1xuICAgIHJlcS5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgICByZWplY3QoRXJyb3IoXCJOZXR3b3JrIEVycm9yXCIpKTtcbiAgICB9O1xuXG4gICAgLy8gTWFrZSB0aGUgcmVxdWVzdFxuICAgIHJlcS5zZW5kKCk7XG4gIH0pO1xufVxuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG5cbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxucHJvY2Vzcy5uZXh0VGljayA9IChmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGNhblNldEltbWVkaWF0ZSA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnXG4gICAgJiYgd2luZG93LnNldEltbWVkaWF0ZTtcbiAgICB2YXIgY2FuUG9zdCA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnXG4gICAgJiYgd2luZG93LnBvc3RNZXNzYWdlICYmIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyXG4gICAgO1xuXG4gICAgaWYgKGNhblNldEltbWVkaWF0ZSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGYpIHsgcmV0dXJuIHdpbmRvdy5zZXRJbW1lZGlhdGUoZikgfTtcbiAgICB9XG5cbiAgICBpZiAoY2FuUG9zdCkge1xuICAgICAgICB2YXIgcXVldWUgPSBbXTtcbiAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBmdW5jdGlvbiAoZXYpIHtcbiAgICAgICAgICAgIHZhciBzb3VyY2UgPSBldi5zb3VyY2U7XG4gICAgICAgICAgICBpZiAoKHNvdXJjZSA9PT0gd2luZG93IHx8IHNvdXJjZSA9PT0gbnVsbCkgJiYgZXYuZGF0YSA9PT0gJ3Byb2Nlc3MtdGljaycpIHtcbiAgICAgICAgICAgICAgICBldi5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICBpZiAocXVldWUubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZm4gPSBxdWV1ZS5zaGlmdCgpO1xuICAgICAgICAgICAgICAgICAgICBmbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgdHJ1ZSk7XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIG5leHRUaWNrKGZuKSB7XG4gICAgICAgICAgICBxdWV1ZS5wdXNoKGZuKTtcbiAgICAgICAgICAgIHdpbmRvdy5wb3N0TWVzc2FnZSgncHJvY2Vzcy10aWNrJywgJyonKTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gZnVuY3Rpb24gbmV4dFRpY2soZm4pIHtcbiAgICAgICAgc2V0VGltZW91dChmbiwgMCk7XG4gICAgfTtcbn0pKCk7XG5cbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn1cblxuLy8gVE9ETyhzaHR5bG1hbilcbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgUHJvbWlzZSA9IHJlcXVpcmUoXCIuL3Byb21pc2UvcHJvbWlzZVwiKS5Qcm9taXNlO1xudmFyIHBvbHlmaWxsID0gcmVxdWlyZShcIi4vcHJvbWlzZS9wb2x5ZmlsbFwiKS5wb2x5ZmlsbDtcbmV4cG9ydHMuUHJvbWlzZSA9IFByb21pc2U7XG5leHBvcnRzLnBvbHlmaWxsID0gcG9seWZpbGw7IiwiXCJ1c2Ugc3RyaWN0XCI7XG4vKiBnbG9iYWwgdG9TdHJpbmcgKi9cblxudmFyIGlzQXJyYXkgPSByZXF1aXJlKFwiLi91dGlsc1wiKS5pc0FycmF5O1xudmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKFwiLi91dGlsc1wiKS5pc0Z1bmN0aW9uO1xuXG4vKipcbiAgUmV0dXJucyBhIHByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2hlbiBhbGwgdGhlIGdpdmVuIHByb21pc2VzIGhhdmUgYmVlblxuICBmdWxmaWxsZWQsIG9yIHJlamVjdGVkIGlmIGFueSBvZiB0aGVtIGJlY29tZSByZWplY3RlZC4gVGhlIHJldHVybiBwcm9taXNlXG4gIGlzIGZ1bGZpbGxlZCB3aXRoIGFuIGFycmF5IHRoYXQgZ2l2ZXMgYWxsIHRoZSB2YWx1ZXMgaW4gdGhlIG9yZGVyIHRoZXkgd2VyZVxuICBwYXNzZWQgaW4gdGhlIGBwcm9taXNlc2AgYXJyYXkgYXJndW1lbnQuXG5cbiAgRXhhbXBsZTpcblxuICBgYGBqYXZhc2NyaXB0XG4gIHZhciBwcm9taXNlMSA9IFJTVlAucmVzb2x2ZSgxKTtcbiAgdmFyIHByb21pc2UyID0gUlNWUC5yZXNvbHZlKDIpO1xuICB2YXIgcHJvbWlzZTMgPSBSU1ZQLnJlc29sdmUoMyk7XG4gIHZhciBwcm9taXNlcyA9IFsgcHJvbWlzZTEsIHByb21pc2UyLCBwcm9taXNlMyBdO1xuXG4gIFJTVlAuYWxsKHByb21pc2VzKS50aGVuKGZ1bmN0aW9uKGFycmF5KXtcbiAgICAvLyBUaGUgYXJyYXkgaGVyZSB3b3VsZCBiZSBbIDEsIDIsIDMgXTtcbiAgfSk7XG4gIGBgYFxuXG4gIElmIGFueSBvZiB0aGUgYHByb21pc2VzYCBnaXZlbiB0byBgUlNWUC5hbGxgIGFyZSByZWplY3RlZCwgdGhlIGZpcnN0IHByb21pc2VcbiAgdGhhdCBpcyByZWplY3RlZCB3aWxsIGJlIGdpdmVuIGFzIGFuIGFyZ3VtZW50IHRvIHRoZSByZXR1cm5lZCBwcm9taXNlcydzXG4gIHJlamVjdGlvbiBoYW5kbGVyLiBGb3IgZXhhbXBsZTpcblxuICBFeGFtcGxlOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgdmFyIHByb21pc2UxID0gUlNWUC5yZXNvbHZlKDEpO1xuICB2YXIgcHJvbWlzZTIgPSBSU1ZQLnJlamVjdChuZXcgRXJyb3IoXCIyXCIpKTtcbiAgdmFyIHByb21pc2UzID0gUlNWUC5yZWplY3QobmV3IEVycm9yKFwiM1wiKSk7XG4gIHZhciBwcm9taXNlcyA9IFsgcHJvbWlzZTEsIHByb21pc2UyLCBwcm9taXNlMyBdO1xuXG4gIFJTVlAuYWxsKHByb21pc2VzKS50aGVuKGZ1bmN0aW9uKGFycmF5KXtcbiAgICAvLyBDb2RlIGhlcmUgbmV2ZXIgcnVucyBiZWNhdXNlIHRoZXJlIGFyZSByZWplY3RlZCBwcm9taXNlcyFcbiAgfSwgZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAvLyBlcnJvci5tZXNzYWdlID09PSBcIjJcIlxuICB9KTtcbiAgYGBgXG5cbiAgQG1ldGhvZCBhbGxcbiAgQGZvciBSU1ZQXG4gIEBwYXJhbSB7QXJyYXl9IHByb21pc2VzXG4gIEBwYXJhbSB7U3RyaW5nfSBsYWJlbFxuICBAcmV0dXJuIHtQcm9taXNlfSBwcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdoZW4gYWxsIGBwcm9taXNlc2AgaGF2ZSBiZWVuXG4gIGZ1bGZpbGxlZCwgb3IgcmVqZWN0ZWQgaWYgYW55IG9mIHRoZW0gYmVjb21lIHJlamVjdGVkLlxuKi9cbmZ1bmN0aW9uIGFsbChwcm9taXNlcykge1xuICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICB2YXIgUHJvbWlzZSA9IHRoaXM7XG5cbiAgaWYgKCFpc0FycmF5KHByb21pc2VzKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1lvdSBtdXN0IHBhc3MgYW4gYXJyYXkgdG8gYWxsLicpO1xuICB9XG5cbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgIHZhciByZXN1bHRzID0gW10sIHJlbWFpbmluZyA9IHByb21pc2VzLmxlbmd0aCxcbiAgICBwcm9taXNlO1xuXG4gICAgaWYgKHJlbWFpbmluZyA9PT0gMCkge1xuICAgICAgcmVzb2x2ZShbXSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcmVzb2x2ZXIoaW5kZXgpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXNvbHZlQWxsKGluZGV4LCB2YWx1ZSk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJlc29sdmVBbGwoaW5kZXgsIHZhbHVlKSB7XG4gICAgICByZXN1bHRzW2luZGV4XSA9IHZhbHVlO1xuICAgICAgaWYgKC0tcmVtYWluaW5nID09PSAwKSB7XG4gICAgICAgIHJlc29sdmUocmVzdWx0cyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwcm9taXNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgcHJvbWlzZSA9IHByb21pc2VzW2ldO1xuXG4gICAgICBpZiAocHJvbWlzZSAmJiBpc0Z1bmN0aW9uKHByb21pc2UudGhlbikpIHtcbiAgICAgICAgcHJvbWlzZS50aGVuKHJlc29sdmVyKGkpLCByZWplY3QpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzb2x2ZUFsbChpLCBwcm9taXNlKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xufVxuXG5leHBvcnRzLmFsbCA9IGFsbDsiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsKXtcblwidXNlIHN0cmljdFwiO1xudmFyIGJyb3dzZXJHbG9iYWwgPSAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpID8gd2luZG93IDoge307XG52YXIgQnJvd3Nlck11dGF0aW9uT2JzZXJ2ZXIgPSBicm93c2VyR2xvYmFsLk11dGF0aW9uT2JzZXJ2ZXIgfHwgYnJvd3Nlckdsb2JhbC5XZWJLaXRNdXRhdGlvbk9ic2VydmVyO1xudmFyIGxvY2FsID0gKHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnKSA/IGdsb2JhbCA6IHRoaXM7XG5cbi8vIG5vZGVcbmZ1bmN0aW9uIHVzZU5leHRUaWNrKCkge1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgcHJvY2Vzcy5uZXh0VGljayhmbHVzaCk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHVzZU11dGF0aW9uT2JzZXJ2ZXIoKSB7XG4gIHZhciBpdGVyYXRpb25zID0gMDtcbiAgdmFyIG9ic2VydmVyID0gbmV3IEJyb3dzZXJNdXRhdGlvbk9ic2VydmVyKGZsdXNoKTtcbiAgdmFyIG5vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnJyk7XG4gIG9ic2VydmVyLm9ic2VydmUobm9kZSwgeyBjaGFyYWN0ZXJEYXRhOiB0cnVlIH0pO1xuXG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBub2RlLmRhdGEgPSAoaXRlcmF0aW9ucyA9ICsraXRlcmF0aW9ucyAlIDIpO1xuICB9O1xufVxuXG5mdW5jdGlvbiB1c2VTZXRUaW1lb3V0KCkge1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgbG9jYWwuc2V0VGltZW91dChmbHVzaCwgMSk7XG4gIH07XG59XG5cbnZhciBxdWV1ZSA9IFtdO1xuZnVuY3Rpb24gZmx1c2goKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgcXVldWUubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgdHVwbGUgPSBxdWV1ZVtpXTtcbiAgICB2YXIgY2FsbGJhY2sgPSB0dXBsZVswXSwgYXJnID0gdHVwbGVbMV07XG4gICAgY2FsbGJhY2soYXJnKTtcbiAgfVxuICBxdWV1ZSA9IFtdO1xufVxuXG52YXIgc2NoZWR1bGVGbHVzaDtcblxuLy8gRGVjaWRlIHdoYXQgYXN5bmMgbWV0aG9kIHRvIHVzZSB0byB0cmlnZ2VyaW5nIHByb2Nlc3Npbmcgb2YgcXVldWVkIGNhbGxiYWNrczpcbmlmICh0eXBlb2YgcHJvY2VzcyAhPT0gJ3VuZGVmaW5lZCcgJiYge30udG9TdHJpbmcuY2FsbChwcm9jZXNzKSA9PT0gJ1tvYmplY3QgcHJvY2Vzc10nKSB7XG4gIHNjaGVkdWxlRmx1c2ggPSB1c2VOZXh0VGljaygpO1xufSBlbHNlIGlmIChCcm93c2VyTXV0YXRpb25PYnNlcnZlcikge1xuICBzY2hlZHVsZUZsdXNoID0gdXNlTXV0YXRpb25PYnNlcnZlcigpO1xufSBlbHNlIHtcbiAgc2NoZWR1bGVGbHVzaCA9IHVzZVNldFRpbWVvdXQoKTtcbn1cblxuZnVuY3Rpb24gYXNhcChjYWxsYmFjaywgYXJnKSB7XG4gIHZhciBsZW5ndGggPSBxdWV1ZS5wdXNoKFtjYWxsYmFjaywgYXJnXSk7XG4gIGlmIChsZW5ndGggPT09IDEpIHtcbiAgICAvLyBJZiBsZW5ndGggaXMgMSwgdGhhdCBtZWFucyB0aGF0IHdlIG5lZWQgdG8gc2NoZWR1bGUgYW4gYXN5bmMgZmx1c2guXG4gICAgLy8gSWYgYWRkaXRpb25hbCBjYWxsYmFja3MgYXJlIHF1ZXVlZCBiZWZvcmUgdGhlIHF1ZXVlIGlzIGZsdXNoZWQsIHRoZXlcbiAgICAvLyB3aWxsIGJlIHByb2Nlc3NlZCBieSB0aGlzIGZsdXNoIHRoYXQgd2UgYXJlIHNjaGVkdWxpbmcuXG4gICAgc2NoZWR1bGVGbHVzaCgpO1xuICB9XG59XG5cbmV4cG9ydHMuYXNhcCA9IGFzYXA7XG59KS5jYWxsKHRoaXMscmVxdWlyZShcIi9Vc2Vycy9hbmRyZXcvUHJvamVjdHMvb3NzL3JhZGlvZGFuL21hZ2ljLWJ1dHRvbi9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvaW5zZXJ0LW1vZHVsZS1nbG9iYWxzL25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanNcIiksdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KSIsIlwidXNlIHN0cmljdFwiO1xuLyoqXG4gIGBSU1ZQLlByb21pc2UuY2FzdGAgcmV0dXJucyB0aGUgc2FtZSBwcm9taXNlIGlmIHRoYXQgcHJvbWlzZSBzaGFyZXMgYSBjb25zdHJ1Y3RvclxuICB3aXRoIHRoZSBwcm9taXNlIGJlaW5nIGNhc3RlZC5cblxuICBFeGFtcGxlOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgdmFyIHByb21pc2UgPSBSU1ZQLnJlc29sdmUoMSk7XG4gIHZhciBjYXN0ZWQgPSBSU1ZQLlByb21pc2UuY2FzdChwcm9taXNlKTtcblxuICBjb25zb2xlLmxvZyhwcm9taXNlID09PSBjYXN0ZWQpOyAvLyB0cnVlXG4gIGBgYFxuXG4gIEluIHRoZSBjYXNlIG9mIGEgcHJvbWlzZSB3aG9zZSBjb25zdHJ1Y3RvciBkb2VzIG5vdCBtYXRjaCwgaXQgaXMgYXNzaW1pbGF0ZWQuXG4gIFRoZSByZXN1bHRpbmcgcHJvbWlzZSB3aWxsIGZ1bGZpbGwgb3IgcmVqZWN0IGJhc2VkIG9uIHRoZSBvdXRjb21lIG9mIHRoZVxuICBwcm9taXNlIGJlaW5nIGNhc3RlZC5cblxuICBJbiB0aGUgY2FzZSBvZiBhIG5vbi1wcm9taXNlLCBhIHByb21pc2Ugd2hpY2ggd2lsbCBmdWxmaWxsIHdpdGggdGhhdCB2YWx1ZSBpc1xuICByZXR1cm5lZC5cblxuICBFeGFtcGxlOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgdmFyIHZhbHVlID0gMTsgLy8gY291bGQgYmUgYSBudW1iZXIsIGJvb2xlYW4sIHN0cmluZywgdW5kZWZpbmVkLi4uXG4gIHZhciBjYXN0ZWQgPSBSU1ZQLlByb21pc2UuY2FzdCh2YWx1ZSk7XG5cbiAgY29uc29sZS5sb2codmFsdWUgPT09IGNhc3RlZCk7IC8vIGZhbHNlXG4gIGNvbnNvbGUubG9nKGNhc3RlZCBpbnN0YW5jZW9mIFJTVlAuUHJvbWlzZSkgLy8gdHJ1ZVxuXG4gIGNhc3RlZC50aGVuKGZ1bmN0aW9uKHZhbCkge1xuICAgIHZhbCA9PT0gdmFsdWUgLy8gPT4gdHJ1ZVxuICB9KTtcbiAgYGBgXG5cbiAgYFJTVlAuUHJvbWlzZS5jYXN0YCBpcyBzaW1pbGFyIHRvIGBSU1ZQLnJlc29sdmVgLCBidXQgYFJTVlAuUHJvbWlzZS5jYXN0YCBkaWZmZXJzIGluIHRoZVxuICBmb2xsb3dpbmcgd2F5czpcbiAgKiBgUlNWUC5Qcm9taXNlLmNhc3RgIHNlcnZlcyBhcyBhIG1lbW9yeS1lZmZpY2llbnQgd2F5IG9mIGdldHRpbmcgYSBwcm9taXNlLCB3aGVuIHlvdVxuICBoYXZlIHNvbWV0aGluZyB0aGF0IGNvdWxkIGVpdGhlciBiZSBhIHByb21pc2Ugb3IgYSB2YWx1ZS4gUlNWUC5yZXNvbHZlXG4gIHdpbGwgaGF2ZSB0aGUgc2FtZSBlZmZlY3QgYnV0IHdpbGwgY3JlYXRlIGEgbmV3IHByb21pc2Ugd3JhcHBlciBpZiB0aGVcbiAgYXJndW1lbnQgaXMgYSBwcm9taXNlLlxuICAqIGBSU1ZQLlByb21pc2UuY2FzdGAgaXMgYSB3YXkgb2YgY2FzdGluZyBpbmNvbWluZyB0aGVuYWJsZXMgb3IgcHJvbWlzZSBzdWJjbGFzc2VzIHRvXG4gIHByb21pc2VzIG9mIHRoZSBleGFjdCBjbGFzcyBzcGVjaWZpZWQsIHNvIHRoYXQgdGhlIHJlc3VsdGluZyBvYmplY3QncyBgdGhlbmAgaXNcbiAgZW5zdXJlZCB0byBoYXZlIHRoZSBiZWhhdmlvciBvZiB0aGUgY29uc3RydWN0b3IgeW91IGFyZSBjYWxsaW5nIGNhc3Qgb24gKGkuZS4sIFJTVlAuUHJvbWlzZSkuXG5cbiAgQG1ldGhvZCBjYXN0XG4gIEBmb3IgUlNWUFxuICBAcGFyYW0ge09iamVjdH0gb2JqZWN0IHRvIGJlIGNhc3RlZFxuICBAcmV0dXJuIHtQcm9taXNlfSBwcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdoZW4gYWxsIHByb3BlcnRpZXMgb2YgYHByb21pc2VzYFxuICBoYXZlIGJlZW4gZnVsZmlsbGVkLCBvciByZWplY3RlZCBpZiBhbnkgb2YgdGhlbSBiZWNvbWUgcmVqZWN0ZWQuXG4qL1xuXG5cbmZ1bmN0aW9uIGNhc3Qob2JqZWN0KSB7XG4gIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gIGlmIChvYmplY3QgJiYgdHlwZW9mIG9iamVjdCA9PT0gJ29iamVjdCcgJiYgb2JqZWN0LmNvbnN0cnVjdG9yID09PSB0aGlzKSB7XG4gICAgcmV0dXJuIG9iamVjdDtcbiAgfVxuXG4gIHZhciBQcm9taXNlID0gdGhpcztcblxuICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSkge1xuICAgIHJlc29sdmUob2JqZWN0KTtcbiAgfSk7XG59XG5cbmV4cG9ydHMuY2FzdCA9IGNhc3Q7IiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgY29uZmlnID0ge1xuICBpbnN0cnVtZW50OiBmYWxzZVxufTtcblxuZnVuY3Rpb24gY29uZmlndXJlKG5hbWUsIHZhbHVlKSB7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAyKSB7XG4gICAgY29uZmlnW25hbWVdID0gdmFsdWU7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGNvbmZpZ1tuYW1lXTtcbiAgfVxufVxuXG5leHBvcnRzLmNvbmZpZyA9IGNvbmZpZztcbmV4cG9ydHMuY29uZmlndXJlID0gY29uZmlndXJlOyIsIlwidXNlIHN0cmljdFwiO1xudmFyIFJTVlBQcm9taXNlID0gcmVxdWlyZShcIi4vcHJvbWlzZVwiKS5Qcm9taXNlO1xudmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKFwiLi91dGlsc1wiKS5pc0Z1bmN0aW9uO1xuXG5mdW5jdGlvbiBwb2x5ZmlsbCgpIHtcbiAgdmFyIGVzNlByb21pc2VTdXBwb3J0ID0gXG4gICAgXCJQcm9taXNlXCIgaW4gd2luZG93ICYmXG4gICAgLy8gU29tZSBvZiB0aGVzZSBtZXRob2RzIGFyZSBtaXNzaW5nIGZyb21cbiAgICAvLyBGaXJlZm94L0Nocm9tZSBleHBlcmltZW50YWwgaW1wbGVtZW50YXRpb25zXG4gICAgXCJjYXN0XCIgaW4gd2luZG93LlByb21pc2UgJiZcbiAgICBcInJlc29sdmVcIiBpbiB3aW5kb3cuUHJvbWlzZSAmJlxuICAgIFwicmVqZWN0XCIgaW4gd2luZG93LlByb21pc2UgJiZcbiAgICBcImFsbFwiIGluIHdpbmRvdy5Qcm9taXNlICYmXG4gICAgXCJyYWNlXCIgaW4gd2luZG93LlByb21pc2UgJiZcbiAgICAvLyBPbGRlciB2ZXJzaW9uIG9mIHRoZSBzcGVjIGhhZCBhIHJlc29sdmVyIG9iamVjdFxuICAgIC8vIGFzIHRoZSBhcmcgcmF0aGVyIHRoYW4gYSBmdW5jdGlvblxuICAgIChmdW5jdGlvbigpIHtcbiAgICAgIHZhciByZXNvbHZlO1xuICAgICAgbmV3IHdpbmRvdy5Qcm9taXNlKGZ1bmN0aW9uKHIpIHsgcmVzb2x2ZSA9IHI7IH0pO1xuICAgICAgcmV0dXJuIGlzRnVuY3Rpb24ocmVzb2x2ZSk7XG4gICAgfSgpKTtcblxuICBpZiAoIWVzNlByb21pc2VTdXBwb3J0KSB7XG4gICAgd2luZG93LlByb21pc2UgPSBSU1ZQUHJvbWlzZTtcbiAgfVxufVxuXG5leHBvcnRzLnBvbHlmaWxsID0gcG9seWZpbGw7IiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgY29uZmlnID0gcmVxdWlyZShcIi4vY29uZmlnXCIpLmNvbmZpZztcbnZhciBjb25maWd1cmUgPSByZXF1aXJlKFwiLi9jb25maWdcIikuY29uZmlndXJlO1xudmFyIG9iamVjdE9yRnVuY3Rpb24gPSByZXF1aXJlKFwiLi91dGlsc1wiKS5vYmplY3RPckZ1bmN0aW9uO1xudmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKFwiLi91dGlsc1wiKS5pc0Z1bmN0aW9uO1xudmFyIG5vdyA9IHJlcXVpcmUoXCIuL3V0aWxzXCIpLm5vdztcbnZhciBjYXN0ID0gcmVxdWlyZShcIi4vY2FzdFwiKS5jYXN0O1xudmFyIGFsbCA9IHJlcXVpcmUoXCIuL2FsbFwiKS5hbGw7XG52YXIgcmFjZSA9IHJlcXVpcmUoXCIuL3JhY2VcIikucmFjZTtcbnZhciBzdGF0aWNSZXNvbHZlID0gcmVxdWlyZShcIi4vcmVzb2x2ZVwiKS5yZXNvbHZlO1xudmFyIHN0YXRpY1JlamVjdCA9IHJlcXVpcmUoXCIuL3JlamVjdFwiKS5yZWplY3Q7XG52YXIgYXNhcCA9IHJlcXVpcmUoXCIuL2FzYXBcIikuYXNhcDtcblxudmFyIGNvdW50ZXIgPSAwO1xuXG5jb25maWcuYXN5bmMgPSBhc2FwOyAvLyBkZWZhdWx0IGFzeW5jIGlzIGFzYXA7XG5cbmZ1bmN0aW9uIFByb21pc2UocmVzb2x2ZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKHJlc29sdmVyKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1lvdSBtdXN0IHBhc3MgYSByZXNvbHZlciBmdW5jdGlvbiBhcyB0aGUgZmlyc3QgYXJndW1lbnQgdG8gdGhlIHByb21pc2UgY29uc3RydWN0b3InKTtcbiAgfVxuXG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBQcm9taXNlKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJGYWlsZWQgdG8gY29uc3RydWN0ICdQcm9taXNlJzogUGxlYXNlIHVzZSB0aGUgJ25ldycgb3BlcmF0b3IsIHRoaXMgb2JqZWN0IGNvbnN0cnVjdG9yIGNhbm5vdCBiZSBjYWxsZWQgYXMgYSBmdW5jdGlvbi5cIik7XG4gIH1cblxuICB0aGlzLl9zdWJzY3JpYmVycyA9IFtdO1xuXG4gIGludm9rZVJlc29sdmVyKHJlc29sdmVyLCB0aGlzKTtcbn1cblxuZnVuY3Rpb24gaW52b2tlUmVzb2x2ZXIocmVzb2x2ZXIsIHByb21pc2UpIHtcbiAgZnVuY3Rpb24gcmVzb2x2ZVByb21pc2UodmFsdWUpIHtcbiAgICByZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlamVjdFByb21pc2UocmVhc29uKSB7XG4gICAgcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG4gIH1cblxuICB0cnkge1xuICAgIHJlc29sdmVyKHJlc29sdmVQcm9taXNlLCByZWplY3RQcm9taXNlKTtcbiAgfSBjYXRjaChlKSB7XG4gICAgcmVqZWN0UHJvbWlzZShlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpbnZva2VDYWxsYmFjayhzZXR0bGVkLCBwcm9taXNlLCBjYWxsYmFjaywgZGV0YWlsKSB7XG4gIHZhciBoYXNDYWxsYmFjayA9IGlzRnVuY3Rpb24oY2FsbGJhY2spLFxuICAgICAgdmFsdWUsIGVycm9yLCBzdWNjZWVkZWQsIGZhaWxlZDtcblxuICBpZiAoaGFzQ2FsbGJhY2spIHtcbiAgICB0cnkge1xuICAgICAgdmFsdWUgPSBjYWxsYmFjayhkZXRhaWwpO1xuICAgICAgc3VjY2VlZGVkID0gdHJ1ZTtcbiAgICB9IGNhdGNoKGUpIHtcbiAgICAgIGZhaWxlZCA9IHRydWU7XG4gICAgICBlcnJvciA9IGU7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHZhbHVlID0gZGV0YWlsO1xuICAgIHN1Y2NlZWRlZCA9IHRydWU7XG4gIH1cblxuICBpZiAoaGFuZGxlVGhlbmFibGUocHJvbWlzZSwgdmFsdWUpKSB7XG4gICAgcmV0dXJuO1xuICB9IGVsc2UgaWYgKGhhc0NhbGxiYWNrICYmIHN1Y2NlZWRlZCkge1xuICAgIHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuICB9IGVsc2UgaWYgKGZhaWxlZCkge1xuICAgIHJlamVjdChwcm9taXNlLCBlcnJvcik7XG4gIH0gZWxzZSBpZiAoc2V0dGxlZCA9PT0gRlVMRklMTEVEKSB7XG4gICAgcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG4gIH0gZWxzZSBpZiAoc2V0dGxlZCA9PT0gUkVKRUNURUQpIHtcbiAgICByZWplY3QocHJvbWlzZSwgdmFsdWUpO1xuICB9XG59XG5cbnZhciBQRU5ESU5HICAgPSB2b2lkIDA7XG52YXIgU0VBTEVEICAgID0gMDtcbnZhciBGVUxGSUxMRUQgPSAxO1xudmFyIFJFSkVDVEVEICA9IDI7XG5cbmZ1bmN0aW9uIHN1YnNjcmliZShwYXJlbnQsIGNoaWxkLCBvbkZ1bGZpbGxtZW50LCBvblJlamVjdGlvbikge1xuICB2YXIgc3Vic2NyaWJlcnMgPSBwYXJlbnQuX3N1YnNjcmliZXJzO1xuICB2YXIgbGVuZ3RoID0gc3Vic2NyaWJlcnMubGVuZ3RoO1xuXG4gIHN1YnNjcmliZXJzW2xlbmd0aF0gPSBjaGlsZDtcbiAgc3Vic2NyaWJlcnNbbGVuZ3RoICsgRlVMRklMTEVEXSA9IG9uRnVsZmlsbG1lbnQ7XG4gIHN1YnNjcmliZXJzW2xlbmd0aCArIFJFSkVDVEVEXSAgPSBvblJlamVjdGlvbjtcbn1cblxuZnVuY3Rpb24gcHVibGlzaChwcm9taXNlLCBzZXR0bGVkKSB7XG4gIHZhciBjaGlsZCwgY2FsbGJhY2ssIHN1YnNjcmliZXJzID0gcHJvbWlzZS5fc3Vic2NyaWJlcnMsIGRldGFpbCA9IHByb21pc2UuX2RldGFpbDtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN1YnNjcmliZXJzLmxlbmd0aDsgaSArPSAzKSB7XG4gICAgY2hpbGQgPSBzdWJzY3JpYmVyc1tpXTtcbiAgICBjYWxsYmFjayA9IHN1YnNjcmliZXJzW2kgKyBzZXR0bGVkXTtcblxuICAgIGludm9rZUNhbGxiYWNrKHNldHRsZWQsIGNoaWxkLCBjYWxsYmFjaywgZGV0YWlsKTtcbiAgfVxuXG4gIHByb21pc2UuX3N1YnNjcmliZXJzID0gbnVsbDtcbn1cblxuUHJvbWlzZS5wcm90b3R5cGUgPSB7XG4gIGNvbnN0cnVjdG9yOiBQcm9taXNlLFxuXG4gIF9zdGF0ZTogdW5kZWZpbmVkLFxuICBfZGV0YWlsOiB1bmRlZmluZWQsXG4gIF9zdWJzY3JpYmVyczogdW5kZWZpbmVkLFxuXG4gIHRoZW46IGZ1bmN0aW9uKG9uRnVsZmlsbG1lbnQsIG9uUmVqZWN0aW9uKSB7XG4gICAgdmFyIHByb21pc2UgPSB0aGlzO1xuXG4gICAgdmFyIHRoZW5Qcm9taXNlID0gbmV3IHRoaXMuY29uc3RydWN0b3IoZnVuY3Rpb24oKSB7fSk7XG5cbiAgICBpZiAodGhpcy5fc3RhdGUpIHtcbiAgICAgIHZhciBjYWxsYmFja3MgPSBhcmd1bWVudHM7XG4gICAgICBjb25maWcuYXN5bmMoZnVuY3Rpb24gaW52b2tlUHJvbWlzZUNhbGxiYWNrKCkge1xuICAgICAgICBpbnZva2VDYWxsYmFjayhwcm9taXNlLl9zdGF0ZSwgdGhlblByb21pc2UsIGNhbGxiYWNrc1twcm9taXNlLl9zdGF0ZSAtIDFdLCBwcm9taXNlLl9kZXRhaWwpO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN1YnNjcmliZSh0aGlzLCB0aGVuUHJvbWlzZSwgb25GdWxmaWxsbWVudCwgb25SZWplY3Rpb24pO1xuICAgIH1cblxuICAgIHJldHVybiB0aGVuUHJvbWlzZTtcbiAgfSxcblxuICAnY2F0Y2gnOiBmdW5jdGlvbihvblJlamVjdGlvbikge1xuICAgIHJldHVybiB0aGlzLnRoZW4obnVsbCwgb25SZWplY3Rpb24pO1xuICB9XG59O1xuXG5Qcm9taXNlLmFsbCA9IGFsbDtcblByb21pc2UuY2FzdCA9IGNhc3Q7XG5Qcm9taXNlLnJhY2UgPSByYWNlO1xuUHJvbWlzZS5yZXNvbHZlID0gc3RhdGljUmVzb2x2ZTtcblByb21pc2UucmVqZWN0ID0gc3RhdGljUmVqZWN0O1xuXG5mdW5jdGlvbiBoYW5kbGVUaGVuYWJsZShwcm9taXNlLCB2YWx1ZSkge1xuICB2YXIgdGhlbiA9IG51bGwsXG4gIHJlc29sdmVkO1xuXG4gIHRyeSB7XG4gICAgaWYgKHByb21pc2UgPT09IHZhbHVlKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQSBwcm9taXNlcyBjYWxsYmFjayBjYW5ub3QgcmV0dXJuIHRoYXQgc2FtZSBwcm9taXNlLlwiKTtcbiAgICB9XG5cbiAgICBpZiAob2JqZWN0T3JGdW5jdGlvbih2YWx1ZSkpIHtcbiAgICAgIHRoZW4gPSB2YWx1ZS50aGVuO1xuXG4gICAgICBpZiAoaXNGdW5jdGlvbih0aGVuKSkge1xuICAgICAgICB0aGVuLmNhbGwodmFsdWUsIGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgIGlmIChyZXNvbHZlZCkgeyByZXR1cm4gdHJ1ZTsgfVxuICAgICAgICAgIHJlc29sdmVkID0gdHJ1ZTtcblxuICAgICAgICAgIGlmICh2YWx1ZSAhPT0gdmFsKSB7XG4gICAgICAgICAgICByZXNvbHZlKHByb21pc2UsIHZhbCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZ1bGZpbGwocHJvbWlzZSwgdmFsKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgIGlmIChyZXNvbHZlZCkgeyByZXR1cm4gdHJ1ZTsgfVxuICAgICAgICAgIHJlc29sdmVkID0gdHJ1ZTtcblxuICAgICAgICAgIHJlamVjdChwcm9taXNlLCB2YWwpO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKHJlc29sdmVkKSB7IHJldHVybiB0cnVlOyB9XG4gICAgcmVqZWN0KHByb21pc2UsIGVycm9yKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSkge1xuICBpZiAocHJvbWlzZSA9PT0gdmFsdWUpIHtcbiAgICBmdWxmaWxsKHByb21pc2UsIHZhbHVlKTtcbiAgfSBlbHNlIGlmICghaGFuZGxlVGhlbmFibGUocHJvbWlzZSwgdmFsdWUpKSB7XG4gICAgZnVsZmlsbChwcm9taXNlLCB2YWx1ZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZnVsZmlsbChwcm9taXNlLCB2YWx1ZSkge1xuICBpZiAocHJvbWlzZS5fc3RhdGUgIT09IFBFTkRJTkcpIHsgcmV0dXJuOyB9XG4gIHByb21pc2UuX3N0YXRlID0gU0VBTEVEO1xuICBwcm9taXNlLl9kZXRhaWwgPSB2YWx1ZTtcblxuICBjb25maWcuYXN5bmMocHVibGlzaEZ1bGZpbGxtZW50LCBwcm9taXNlKTtcbn1cblxuZnVuY3Rpb24gcmVqZWN0KHByb21pc2UsIHJlYXNvbikge1xuICBpZiAocHJvbWlzZS5fc3RhdGUgIT09IFBFTkRJTkcpIHsgcmV0dXJuOyB9XG4gIHByb21pc2UuX3N0YXRlID0gU0VBTEVEO1xuICBwcm9taXNlLl9kZXRhaWwgPSByZWFzb247XG5cbiAgY29uZmlnLmFzeW5jKHB1Ymxpc2hSZWplY3Rpb24sIHByb21pc2UpO1xufVxuXG5mdW5jdGlvbiBwdWJsaXNoRnVsZmlsbG1lbnQocHJvbWlzZSkge1xuICBwdWJsaXNoKHByb21pc2UsIHByb21pc2UuX3N0YXRlID0gRlVMRklMTEVEKTtcbn1cblxuZnVuY3Rpb24gcHVibGlzaFJlamVjdGlvbihwcm9taXNlKSB7XG4gIHB1Ymxpc2gocHJvbWlzZSwgcHJvbWlzZS5fc3RhdGUgPSBSRUpFQ1RFRCk7XG59XG5cbmV4cG9ydHMuUHJvbWlzZSA9IFByb21pc2U7IiwiXCJ1c2Ugc3RyaWN0XCI7XG4vKiBnbG9iYWwgdG9TdHJpbmcgKi9cbnZhciBpc0FycmF5ID0gcmVxdWlyZShcIi4vdXRpbHNcIikuaXNBcnJheTtcblxuLyoqXG4gIGBSU1ZQLnJhY2VgIGFsbG93cyB5b3UgdG8gd2F0Y2ggYSBzZXJpZXMgb2YgcHJvbWlzZXMgYW5kIGFjdCBhcyBzb29uIGFzIHRoZVxuICBmaXJzdCBwcm9taXNlIGdpdmVuIHRvIHRoZSBgcHJvbWlzZXNgIGFyZ3VtZW50IGZ1bGZpbGxzIG9yIHJlamVjdHMuXG5cbiAgRXhhbXBsZTpcblxuICBgYGBqYXZhc2NyaXB0XG4gIHZhciBwcm9taXNlMSA9IG5ldyBSU1ZQLlByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICByZXNvbHZlKFwicHJvbWlzZSAxXCIpO1xuICAgIH0sIDIwMCk7XG4gIH0pO1xuXG4gIHZhciBwcm9taXNlMiA9IG5ldyBSU1ZQLlByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICByZXNvbHZlKFwicHJvbWlzZSAyXCIpO1xuICAgIH0sIDEwMCk7XG4gIH0pO1xuXG4gIFJTVlAucmFjZShbcHJvbWlzZTEsIHByb21pc2UyXSkudGhlbihmdW5jdGlvbihyZXN1bHQpe1xuICAgIC8vIHJlc3VsdCA9PT0gXCJwcm9taXNlIDJcIiBiZWNhdXNlIGl0IHdhcyByZXNvbHZlZCBiZWZvcmUgcHJvbWlzZTFcbiAgICAvLyB3YXMgcmVzb2x2ZWQuXG4gIH0pO1xuICBgYGBcblxuICBgUlNWUC5yYWNlYCBpcyBkZXRlcm1pbmlzdGljIGluIHRoYXQgb25seSB0aGUgc3RhdGUgb2YgdGhlIGZpcnN0IGNvbXBsZXRlZFxuICBwcm9taXNlIG1hdHRlcnMuIEZvciBleGFtcGxlLCBldmVuIGlmIG90aGVyIHByb21pc2VzIGdpdmVuIHRvIHRoZSBgcHJvbWlzZXNgXG4gIGFycmF5IGFyZ3VtZW50IGFyZSByZXNvbHZlZCwgYnV0IHRoZSBmaXJzdCBjb21wbGV0ZWQgcHJvbWlzZSBoYXMgYmVjb21lXG4gIHJlamVjdGVkIGJlZm9yZSB0aGUgb3RoZXIgcHJvbWlzZXMgYmVjYW1lIGZ1bGZpbGxlZCwgdGhlIHJldHVybmVkIHByb21pc2VcbiAgd2lsbCBiZWNvbWUgcmVqZWN0ZWQ6XG5cbiAgYGBgamF2YXNjcmlwdFxuICB2YXIgcHJvbWlzZTEgPSBuZXcgUlNWUC5Qcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgcmVzb2x2ZShcInByb21pc2UgMVwiKTtcbiAgICB9LCAyMDApO1xuICB9KTtcblxuICB2YXIgcHJvbWlzZTIgPSBuZXcgUlNWUC5Qcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgcmVqZWN0KG5ldyBFcnJvcihcInByb21pc2UgMlwiKSk7XG4gICAgfSwgMTAwKTtcbiAgfSk7XG5cbiAgUlNWUC5yYWNlKFtwcm9taXNlMSwgcHJvbWlzZTJdKS50aGVuKGZ1bmN0aW9uKHJlc3VsdCl7XG4gICAgLy8gQ29kZSBoZXJlIG5ldmVyIHJ1bnMgYmVjYXVzZSB0aGVyZSBhcmUgcmVqZWN0ZWQgcHJvbWlzZXMhXG4gIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgLy8gcmVhc29uLm1lc3NhZ2UgPT09IFwicHJvbWlzZTJcIiBiZWNhdXNlIHByb21pc2UgMiBiZWNhbWUgcmVqZWN0ZWQgYmVmb3JlXG4gICAgLy8gcHJvbWlzZSAxIGJlY2FtZSBmdWxmaWxsZWRcbiAgfSk7XG4gIGBgYFxuXG4gIEBtZXRob2QgcmFjZVxuICBAZm9yIFJTVlBcbiAgQHBhcmFtIHtBcnJheX0gcHJvbWlzZXMgYXJyYXkgb2YgcHJvbWlzZXMgdG8gb2JzZXJ2ZVxuICBAcGFyYW0ge1N0cmluZ30gbGFiZWwgb3B0aW9uYWwgc3RyaW5nIGZvciBkZXNjcmliaW5nIHRoZSBwcm9taXNlIHJldHVybmVkLlxuICBVc2VmdWwgZm9yIHRvb2xpbmcuXG4gIEByZXR1cm4ge1Byb21pc2V9IGEgcHJvbWlzZSB0aGF0IGJlY29tZXMgZnVsZmlsbGVkIHdpdGggdGhlIHZhbHVlIHRoZSBmaXJzdFxuICBjb21wbGV0ZWQgcHJvbWlzZXMgaXMgcmVzb2x2ZWQgd2l0aCBpZiB0aGUgZmlyc3QgY29tcGxldGVkIHByb21pc2Ugd2FzXG4gIGZ1bGZpbGxlZCwgb3IgcmVqZWN0ZWQgd2l0aCB0aGUgcmVhc29uIHRoYXQgdGhlIGZpcnN0IGNvbXBsZXRlZCBwcm9taXNlXG4gIHdhcyByZWplY3RlZCB3aXRoLlxuKi9cbmZ1bmN0aW9uIHJhY2UocHJvbWlzZXMpIHtcbiAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgdmFyIFByb21pc2UgPSB0aGlzO1xuXG4gIGlmICghaXNBcnJheShwcm9taXNlcykpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdZb3UgbXVzdCBwYXNzIGFuIGFycmF5IHRvIHJhY2UuJyk7XG4gIH1cbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgIHZhciByZXN1bHRzID0gW10sIHByb21pc2U7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHByb21pc2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBwcm9taXNlID0gcHJvbWlzZXNbaV07XG5cbiAgICAgIGlmIChwcm9taXNlICYmIHR5cGVvZiBwcm9taXNlLnRoZW4gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgcHJvbWlzZS50aGVuKHJlc29sdmUsIHJlamVjdCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXNvbHZlKHByb21pc2UpO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG59XG5cbmV4cG9ydHMucmFjZSA9IHJhY2U7IiwiXCJ1c2Ugc3RyaWN0XCI7XG4vKipcbiAgYFJTVlAucmVqZWN0YCByZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHdpbGwgYmVjb21lIHJlamVjdGVkIHdpdGggdGhlIHBhc3NlZFxuICBgcmVhc29uYC4gYFJTVlAucmVqZWN0YCBpcyBlc3NlbnRpYWxseSBzaG9ydGhhbmQgZm9yIHRoZSBmb2xsb3dpbmc6XG5cbiAgYGBgamF2YXNjcmlwdFxuICB2YXIgcHJvbWlzZSA9IG5ldyBSU1ZQLlByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICByZWplY3QobmV3IEVycm9yKCdXSE9PUFMnKSk7XG4gIH0pO1xuXG4gIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSl7XG4gICAgLy8gQ29kZSBoZXJlIGRvZXNuJ3QgcnVuIGJlY2F1c2UgdGhlIHByb21pc2UgaXMgcmVqZWN0ZWQhXG4gIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgLy8gcmVhc29uLm1lc3NhZ2UgPT09ICdXSE9PUFMnXG4gIH0pO1xuICBgYGBcblxuICBJbnN0ZWFkIG9mIHdyaXRpbmcgdGhlIGFib3ZlLCB5b3VyIGNvZGUgbm93IHNpbXBseSBiZWNvbWVzIHRoZSBmb2xsb3dpbmc6XG5cbiAgYGBgamF2YXNjcmlwdFxuICB2YXIgcHJvbWlzZSA9IFJTVlAucmVqZWN0KG5ldyBFcnJvcignV0hPT1BTJykpO1xuXG4gIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSl7XG4gICAgLy8gQ29kZSBoZXJlIGRvZXNuJ3QgcnVuIGJlY2F1c2UgdGhlIHByb21pc2UgaXMgcmVqZWN0ZWQhXG4gIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgLy8gcmVhc29uLm1lc3NhZ2UgPT09ICdXSE9PUFMnXG4gIH0pO1xuICBgYGBcblxuICBAbWV0aG9kIHJlamVjdFxuICBAZm9yIFJTVlBcbiAgQHBhcmFtIHtBbnl9IHJlYXNvbiB2YWx1ZSB0aGF0IHRoZSByZXR1cm5lZCBwcm9taXNlIHdpbGwgYmUgcmVqZWN0ZWQgd2l0aC5cbiAgQHBhcmFtIHtTdHJpbmd9IGxhYmVsIG9wdGlvbmFsIHN0cmluZyBmb3IgaWRlbnRpZnlpbmcgdGhlIHJldHVybmVkIHByb21pc2UuXG4gIFVzZWZ1bCBmb3IgdG9vbGluZy5cbiAgQHJldHVybiB7UHJvbWlzZX0gYSBwcm9taXNlIHRoYXQgd2lsbCBiZWNvbWUgcmVqZWN0ZWQgd2l0aCB0aGUgZ2l2ZW5cbiAgYHJlYXNvbmAuXG4qL1xuZnVuY3Rpb24gcmVqZWN0KHJlYXNvbikge1xuICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICB2YXIgUHJvbWlzZSA9IHRoaXM7XG5cbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICByZWplY3QocmVhc29uKTtcbiAgfSk7XG59XG5cbmV4cG9ydHMucmVqZWN0ID0gcmVqZWN0OyIsIlwidXNlIHN0cmljdFwiO1xuLyoqXG4gIGBSU1ZQLnJlc29sdmVgIHJldHVybnMgYSBwcm9taXNlIHRoYXQgd2lsbCBiZWNvbWUgZnVsZmlsbGVkIHdpdGggdGhlIHBhc3NlZFxuICBgdmFsdWVgLiBgUlNWUC5yZXNvbHZlYCBpcyBlc3NlbnRpYWxseSBzaG9ydGhhbmQgZm9yIHRoZSBmb2xsb3dpbmc6XG5cbiAgYGBgamF2YXNjcmlwdFxuICB2YXIgcHJvbWlzZSA9IG5ldyBSU1ZQLlByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICByZXNvbHZlKDEpO1xuICB9KTtcblxuICBwcm9taXNlLnRoZW4oZnVuY3Rpb24odmFsdWUpe1xuICAgIC8vIHZhbHVlID09PSAxXG4gIH0pO1xuICBgYGBcblxuICBJbnN0ZWFkIG9mIHdyaXRpbmcgdGhlIGFib3ZlLCB5b3VyIGNvZGUgbm93IHNpbXBseSBiZWNvbWVzIHRoZSBmb2xsb3dpbmc6XG5cbiAgYGBgamF2YXNjcmlwdFxuICB2YXIgcHJvbWlzZSA9IFJTVlAucmVzb2x2ZSgxKTtcblxuICBwcm9taXNlLnRoZW4oZnVuY3Rpb24odmFsdWUpe1xuICAgIC8vIHZhbHVlID09PSAxXG4gIH0pO1xuICBgYGBcblxuICBAbWV0aG9kIHJlc29sdmVcbiAgQGZvciBSU1ZQXG4gIEBwYXJhbSB7QW55fSB2YWx1ZSB2YWx1ZSB0aGF0IHRoZSByZXR1cm5lZCBwcm9taXNlIHdpbGwgYmUgcmVzb2x2ZWQgd2l0aFxuICBAcGFyYW0ge1N0cmluZ30gbGFiZWwgb3B0aW9uYWwgc3RyaW5nIGZvciBpZGVudGlmeWluZyB0aGUgcmV0dXJuZWQgcHJvbWlzZS5cbiAgVXNlZnVsIGZvciB0b29saW5nLlxuICBAcmV0dXJuIHtQcm9taXNlfSBhIHByb21pc2UgdGhhdCB3aWxsIGJlY29tZSBmdWxmaWxsZWQgd2l0aCB0aGUgZ2l2ZW5cbiAgYHZhbHVlYFxuKi9cbmZ1bmN0aW9uIHJlc29sdmUodmFsdWUpIHtcbiAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgdmFyIFByb21pc2UgPSB0aGlzO1xuICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgcmVzb2x2ZSh2YWx1ZSk7XG4gIH0pO1xufVxuXG5leHBvcnRzLnJlc29sdmUgPSByZXNvbHZlOyIsIlwidXNlIHN0cmljdFwiO1xuZnVuY3Rpb24gb2JqZWN0T3JGdW5jdGlvbih4KSB7XG4gIHJldHVybiBpc0Z1bmN0aW9uKHgpIHx8ICh0eXBlb2YgeCA9PT0gXCJvYmplY3RcIiAmJiB4ICE9PSBudWxsKTtcbn1cblxuZnVuY3Rpb24gaXNGdW5jdGlvbih4KSB7XG4gIHJldHVybiB0eXBlb2YgeCA9PT0gXCJmdW5jdGlvblwiO1xufVxuXG5mdW5jdGlvbiBpc0FycmF5KHgpIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh4KSA9PT0gXCJbb2JqZWN0IEFycmF5XVwiO1xufVxuXG4vLyBEYXRlLm5vdyBpcyBub3QgYXZhaWxhYmxlIGluIGJyb3dzZXJzIDwgSUU5XG4vLyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9EYXRlL25vdyNDb21wYXRpYmlsaXR5XG52YXIgbm93ID0gRGF0ZS5ub3cgfHwgZnVuY3Rpb24oKSB7IHJldHVybiBuZXcgRGF0ZSgpLmdldFRpbWUoKTsgfTtcblxuXG5leHBvcnRzLm9iamVjdE9yRnVuY3Rpb24gPSBvYmplY3RPckZ1bmN0aW9uO1xuZXhwb3J0cy5pc0Z1bmN0aW9uID0gaXNGdW5jdGlvbjtcbmV4cG9ydHMuaXNBcnJheSA9IGlzQXJyYXk7XG5leHBvcnRzLm5vdyA9IG5vdzsiLCIvKlxuXG5cdHJhY3RpdmUtZXZlbnRzLXRhcFxuXHQ9PT09PT09PT09PT09PT09PT1cblxuXHRWZXJzaW9uIC5cblxuXHRPbiBtb2JpbGUgZGV2aWNlcywgdXNpbmcgYG9uLWNsaWNrYCBpc24ndCBnb29kIGVub3VnaC4gVGFwcGluZyB0aGVcblx0dG91Y2hzY3JlZW4gd2lsbCBmaXJlIGEgc2ltdWxhdGVkIGNsaWNrIGV2ZW50LCBidXQgb25seSBhZnRlciBhIDMwMFxuXHRtaWxsaXNlY29uZCBkZWxheSwgd2hpY2ggbWFrZXMgeW91ciBhcHAgZmVlbCBzbHVnZ2lzaC4gSXQgYWxzb1xuXHRjYXVzZXMgdGhlIHRhcHBlZCBhcmVhIHRvIGhpZ2hsaWdodCwgd2hpY2ggaW4gbW9zdCBjYXNlcyBsb29rcyBhXG5cdGJpdCBtZXNzeS5cblxuXHRJbnN0ZWFkLCB1c2UgYG9uLXRhcGAuIFdoZW4geW91IHRhcCBhbiBhcmVhLCB0aGUgc2ltdWxhdGVkIGNsaWNrXG5cdGV2ZW50IHdpbGwgYmUgcHJldmVudGVkLCBhbmQgdGhlIHVzZXIncyBhY3Rpb24gaXMgcmVzcG9uZGVkIHRvXG5cdGluc3RhbnRseS4gVGhlIGBvbi10YXBgIGV2ZW50IGFsc28gZGlmZmVycyBmcm9tIGBvbi1jbGlja2AgaW4gdGhhdFxuXHR0aGUgY2xpY2sgZXZlbnQgd2lsbCAoZnJhbmtseSByYXRoZXIgYml6YXJyZWx5KSBmaXJlIGV2ZW4gaWYgeW91XG5cdGhvbGQgdGhlIG1vdXNlIGRvd24gb3ZlciBhIHNpbmdsZSBlbGVtZW50IGZvciBzZXZlcmFsIHNlY29uZHMgYW5kXG5cdHdhZ2dsZSBpdCBhYm91dC5cblxuXHRQb2ludGVyIGV2ZW50cyBhcmUgYWxzbyBzdXBwb3J0ZWQsIGFzIGlzIHByZXNzaW5nIHRoZSBzcGFjZWJhciB3aGVuXG5cdHRoZSByZWxldmFudCBlbGVtZW50IGlzIGZvY3VzZWQgKHdoaWNoIHRyaWdnZXJzIGEgY2xpY2sgZXZlbnQsIGFuZFxuXHRpcyBnb29kIGZvciBhY2Nlc3NpYmlsaXR5KS5cblxuXHQ9PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5cdFRyb3VibGVzaG9vdGluZzogSWYgeW91J3JlIHVzaW5nIGEgbW9kdWxlIHN5c3RlbSBpbiB5b3VyIGFwcCAoQU1EIG9yXG5cdHNvbWV0aGluZyBtb3JlIG5vZGV5KSB0aGVuIHlvdSBtYXkgbmVlZCB0byBjaGFuZ2UgdGhlIHBhdGhzIGJlbG93LFxuXHR3aGVyZSBpdCBzYXlzIGByZXF1aXJlKCAncmFjdGl2ZScgKWAgb3IgYGRlZmluZShbICdyYWN0aXZlJyBdLi4uKWAuXG5cblx0PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuXHRVc2FnZTogSW5jbHVkZSB0aGlzIGZpbGUgb24geW91ciBwYWdlIGJlbG93IFJhY3RpdmUsIGUuZzpcblxuXHQgICAgPHNjcmlwdCBzcmM9J2xpYi9yYWN0aXZlLmpzJz48L3NjcmlwdD5cblx0ICAgIDxzY3JpcHQgc3JjPSdsaWIvcmFjdGl2ZS1ldmVudHMtdGFwLmpzJz48L3NjcmlwdD5cblxuXHRPciwgaWYgeW91J3JlIHVzaW5nIGEgbW9kdWxlIGxvYWRlciwgcmVxdWlyZSB0aGlzIG1vZHVsZTpcblxuXHQgICAgLy8gcmVxdWlyaW5nIHRoZSBwbHVnaW4gd2lsbCAnYWN0aXZhdGUnIGl0IC0gbm8gbmVlZCB0byB1c2Vcblx0ICAgIC8vIHRoZSByZXR1cm4gdmFsdWVcblx0ICAgIHJlcXVpcmUoICdyYWN0aXZlLWV2ZW50cy10YXAnICk7XG5cblx0QWRkIGEgdGFwIGV2ZW50IGluIHRoZSBub3JtYWwgZmFzaGlvbjpcblxuXHQgICAgPGRpdiBvbi10YXA9J2Zvbyc+dGFwIG1lITwvZGl2PlxuXG5cdFRoZW4gYWRkIGEgaGFuZGxlcjpcblxuXHQgICAgcmFjdGl2ZS5vbiggJ2ZvbycsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdCAgICAgIGFsZXJ0KCAndGFwcGVkJyApO1xuXHQgICAgfSk7XG5cbiovXG5cbihmdW5jdGlvbiAoIGdsb2JhbCwgZmFjdG9yeSApIHtcblxuXHQndXNlIHN0cmljdCc7XG5cblx0Ly8gQ29tbW9uIEpTIChpLmUuIGJyb3dzZXJpZnkpIGVudmlyb25tZW50XG5cdGlmICggdHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMgJiYgdHlwZW9mIHJlcXVpcmUgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0ZmFjdG9yeSggcmVxdWlyZSggJ3JhY3RpdmUnICkgKTtcblx0fVxuXG5cdC8vIEFNRD9cblx0ZWxzZSBpZiAoIHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCApIHtcblx0XHRkZWZpbmUoWyAncmFjdGl2ZScgXSwgZmFjdG9yeSApO1xuXHR9XG5cblx0Ly8gYnJvd3NlciBnbG9iYWxcblx0ZWxzZSBpZiAoIGdsb2JhbC5SYWN0aXZlICkge1xuXHRcdGZhY3RvcnkoIGdsb2JhbC5SYWN0aXZlICk7XG5cdH1cblxuXHRlbHNlIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoICdDb3VsZCBub3QgZmluZCBSYWN0aXZlISBJdCBtdXN0IGJlIGxvYWRlZCBiZWZvcmUgdGhlIHJhY3RpdmUtZXZlbnRzLXRhcCBwbHVnaW4nICk7XG5cdH1cblxufSggdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cgOiB0aGlzLCBmdW5jdGlvbiAoIFJhY3RpdmUgKSB7XG5cblx0J3VzZSBzdHJpY3QnO1xuXG5cdHZhciB0YXAgPSBmdW5jdGlvbiAoIG5vZGUsIGZpcmUgKSB7XG5cdFx0dmFyIG1vdXNlZG93biwgdG91Y2hzdGFydCwgZm9jdXNIYW5kbGVyLCBkaXN0YW5jZVRocmVzaG9sZCwgdGltZVRocmVzaG9sZDtcblxuXHRcdGRpc3RhbmNlVGhyZXNob2xkID0gNTsgLy8gbWF4aW11bSBwaXhlbHMgcG9pbnRlciBjYW4gbW92ZSBiZWZvcmUgY2FuY2VsXG5cdFx0dGltZVRocmVzaG9sZCA9IDQwMDsgICAvLyBtYXhpbXVtIG1pbGxpc2Vjb25kcyBiZXR3ZWVuIGRvd24gYW5kIHVwIGJlZm9yZSBjYW5jZWxcblxuXHRcdG1vdXNlZG93biA9IGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHR2YXIgY3VycmVudFRhcmdldCwgeCwgeSwgcG9pbnRlcklkLCB1cCwgbW92ZSwgY2FuY2VsO1xuXG5cdFx0XHRpZiAoIGV2ZW50LndoaWNoICE9PSB1bmRlZmluZWQgJiYgZXZlbnQud2hpY2ggIT09IDEgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0eCA9IGV2ZW50LmNsaWVudFg7XG5cdFx0XHR5ID0gZXZlbnQuY2xpZW50WTtcblx0XHRcdGN1cnJlbnRUYXJnZXQgPSB0aGlzO1xuXHRcdFx0Ly8gVGhpcyB3aWxsIGJlIG51bGwgZm9yIG1vdXNlIGV2ZW50cy5cblx0XHRcdHBvaW50ZXJJZCA9IGV2ZW50LnBvaW50ZXJJZDtcblxuXHRcdFx0dXAgPSBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0XHRpZiAoIGV2ZW50LnBvaW50ZXJJZCAhPSBwb2ludGVySWQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0ZmlyZSh7XG5cdFx0XHRcdFx0bm9kZTogY3VycmVudFRhcmdldCxcblx0XHRcdFx0XHRvcmlnaW5hbDogZXZlbnRcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0Y2FuY2VsKCk7XG5cdFx0XHR9O1xuXG5cdFx0XHRtb3ZlID0gZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRcdFx0aWYgKCBldmVudC5wb2ludGVySWQgIT0gcG9pbnRlcklkICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICggKCBNYXRoLmFicyggZXZlbnQuY2xpZW50WCAtIHggKSA+PSBkaXN0YW5jZVRocmVzaG9sZCApIHx8ICggTWF0aC5hYnMoIGV2ZW50LmNsaWVudFkgLSB5ICkgPj0gZGlzdGFuY2VUaHJlc2hvbGQgKSApIHtcblx0XHRcdFx0XHRjYW5jZWwoKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblxuXHRcdFx0Y2FuY2VsID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdNU1BvaW50ZXJVcCcsIHVwLCBmYWxzZSApO1xuXHRcdFx0XHRkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCAnTVNQb2ludGVyTW92ZScsIG1vdmUsIGZhbHNlICk7XG5cdFx0XHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdNU1BvaW50ZXJDYW5jZWwnLCBjYW5jZWwsIGZhbHNlICk7XG5cdFx0XHRcdG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3BvaW50ZXJ1cCcsIHVwLCBmYWxzZSApO1xuXHRcdFx0XHRkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCAncG9pbnRlcm1vdmUnLCBtb3ZlLCBmYWxzZSApO1xuXHRcdFx0XHRkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCAncG9pbnRlcmNhbmNlbCcsIGNhbmNlbCwgZmFsc2UgKTtcblx0XHRcdFx0bm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2xpY2snLCB1cCwgZmFsc2UgKTtcblx0XHRcdFx0ZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ21vdXNlbW92ZScsIG1vdmUsIGZhbHNlICk7XG5cdFx0XHR9O1xuXG5cdFx0XHRpZiAoIHdpbmRvdy5uYXZpZ2F0b3IucG9pbnRlckVuYWJsZWQgKSB7XG5cdFx0XHRcdG5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ3BvaW50ZXJ1cCcsIHVwLCBmYWxzZSApO1xuXHRcdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAncG9pbnRlcm1vdmUnLCBtb3ZlLCBmYWxzZSApO1xuXHRcdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAncG9pbnRlcmNhbmNlbCcsIGNhbmNlbCwgZmFsc2UgKTtcblx0XHRcdH0gZWxzZSBpZiAoIHdpbmRvdy5uYXZpZ2F0b3IubXNQb2ludGVyRW5hYmxlZCApIHtcblx0XHRcdFx0bm9kZS5hZGRFdmVudExpc3RlbmVyKCAnTVNQb2ludGVyVXAnLCB1cCwgZmFsc2UgKTtcblx0XHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ01TUG9pbnRlck1vdmUnLCBtb3ZlLCBmYWxzZSApO1xuXHRcdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnTVNQb2ludGVyQ2FuY2VsJywgY2FuY2VsLCBmYWxzZSApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bm9kZS5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCB1cCwgZmFsc2UgKTtcblx0XHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ21vdXNlbW92ZScsIG1vdmUsIGZhbHNlICk7XG5cdFx0XHR9XG5cblx0XHRcdHNldFRpbWVvdXQoIGNhbmNlbCwgdGltZVRocmVzaG9sZCApO1xuXHRcdH07XG5cblx0XHRpZiAoIHdpbmRvdy5uYXZpZ2F0b3IucG9pbnRlckVuYWJsZWQgKSB7XG5cdFx0XHRub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdwb2ludGVyZG93bicsIG1vdXNlZG93biwgZmFsc2UgKTtcblx0XHR9IGVsc2UgaWYgKCB3aW5kb3cubmF2aWdhdG9yLm1zUG9pbnRlckVuYWJsZWQgKSB7XG5cdFx0XHRub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdNU1BvaW50ZXJEb3duJywgbW91c2Vkb3duLCBmYWxzZSApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdtb3VzZWRvd24nLCBtb3VzZWRvd24sIGZhbHNlICk7XG5cdFx0fVxuXG5cblx0XHR0b3VjaHN0YXJ0ID0gZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRcdHZhciBjdXJyZW50VGFyZ2V0LCB4LCB5LCB0b3VjaCwgZmluZ2VyLCBtb3ZlLCB1cCwgY2FuY2VsO1xuXG5cdFx0XHRpZiAoIGV2ZW50LnRvdWNoZXMubGVuZ3RoICE9PSAxICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRvdWNoID0gZXZlbnQudG91Y2hlc1swXTtcblxuXHRcdFx0eCA9IHRvdWNoLmNsaWVudFg7XG5cdFx0XHR5ID0gdG91Y2guY2xpZW50WTtcblx0XHRcdGN1cnJlbnRUYXJnZXQgPSB0aGlzO1xuXG5cdFx0XHRmaW5nZXIgPSB0b3VjaC5pZGVudGlmaWVyO1xuXG5cdFx0XHR1cCA9IGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHRcdHZhciB0b3VjaDtcblxuXHRcdFx0XHR0b3VjaCA9IGV2ZW50LmNoYW5nZWRUb3VjaGVzWzBdO1xuXHRcdFx0XHRpZiAoIHRvdWNoLmlkZW50aWZpZXIgIT09IGZpbmdlciApIHtcblx0XHRcdFx0XHRjYW5jZWwoKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7ICAvLyBwcmV2ZW50IGNvbXBhdGliaWxpdHkgbW91c2UgZXZlbnRcblx0XHRcdFx0ZmlyZSh7XG5cdFx0XHRcdFx0bm9kZTogY3VycmVudFRhcmdldCxcblx0XHRcdFx0XHRvcmlnaW5hbDogZXZlbnRcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0Y2FuY2VsKCk7XG5cdFx0XHR9O1xuXG5cdFx0XHRtb3ZlID0gZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRcdFx0dmFyIHRvdWNoO1xuXG5cdFx0XHRcdGlmICggZXZlbnQudG91Y2hlcy5sZW5ndGggIT09IDEgfHwgZXZlbnQudG91Y2hlc1swXS5pZGVudGlmaWVyICE9PSBmaW5nZXIgKSB7XG5cdFx0XHRcdFx0Y2FuY2VsKCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0b3VjaCA9IGV2ZW50LnRvdWNoZXNbMF07XG5cdFx0XHRcdGlmICggKCBNYXRoLmFicyggdG91Y2guY2xpZW50WCAtIHggKSA+PSBkaXN0YW5jZVRocmVzaG9sZCApIHx8ICggTWF0aC5hYnMoIHRvdWNoLmNsaWVudFkgLSB5ICkgPj0gZGlzdGFuY2VUaHJlc2hvbGQgKSApIHtcblx0XHRcdFx0XHRjYW5jZWwoKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblxuXHRcdFx0Y2FuY2VsID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICd0b3VjaGVuZCcsIHVwLCBmYWxzZSApO1xuXHRcdFx0XHR3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3RvdWNobW92ZScsIG1vdmUsIGZhbHNlICk7XG5cdFx0XHRcdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCAndG91Y2hjYW5jZWwnLCBjYW5jZWwsIGZhbHNlICk7XG5cdFx0XHR9O1xuXG5cdFx0XHRub2RlLmFkZEV2ZW50TGlzdGVuZXIoICd0b3VjaGVuZCcsIHVwLCBmYWxzZSApO1xuXHRcdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoICd0b3VjaG1vdmUnLCBtb3ZlLCBmYWxzZSApO1xuXHRcdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoICd0b3VjaGNhbmNlbCcsIGNhbmNlbCwgZmFsc2UgKTtcblxuXHRcdFx0c2V0VGltZW91dCggY2FuY2VsLCB0aW1lVGhyZXNob2xkICk7XG5cdFx0fTtcblxuXHRcdG5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ3RvdWNoc3RhcnQnLCB0b3VjaHN0YXJ0LCBmYWxzZSApO1xuXG5cblx0XHQvLyBuYXRpdmUgYnV0dG9ucywgYW5kIDxpbnB1dCB0eXBlPSdidXR0b24nPiBlbGVtZW50cywgc2hvdWxkIGZpcmUgYSB0YXAgZXZlbnRcblx0XHQvLyB3aGVuIHRoZSBzcGFjZSBrZXkgaXMgcHJlc3NlZFxuXHRcdGlmICggbm9kZS50YWdOYW1lID09PSAnQlVUVE9OJyB8fCBub2RlLnR5cGUgPT09ICdidXR0b24nICkge1xuXHRcdFx0Zm9jdXNIYW5kbGVyID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0XHR2YXIgYmx1ckhhbmRsZXIsIGtleWRvd25IYW5kbGVyO1xuXG5cdFx0XHRcdGtleWRvd25IYW5kbGVyID0gZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRcdFx0XHRpZiAoIGV2ZW50LndoaWNoID09PSAzMiApIHsgLy8gc3BhY2Uga2V5XG5cdFx0XHRcdFx0XHRmaXJlKHtcblx0XHRcdFx0XHRcdFx0bm9kZTogbm9kZSxcblx0XHRcdFx0XHRcdFx0b3JpZ2luYWw6IGV2ZW50XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cblx0XHRcdFx0Ymx1ckhhbmRsZXIgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0bm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKCAna2V5ZG93bicsIGtleWRvd25IYW5kbGVyLCBmYWxzZSApO1xuXHRcdFx0XHRcdG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2JsdXInLCBibHVySGFuZGxlciwgZmFsc2UgKTtcblx0XHRcdFx0fTtcblxuXHRcdFx0XHRub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdrZXlkb3duJywga2V5ZG93bkhhbmRsZXIsIGZhbHNlICk7XG5cdFx0XHRcdG5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ2JsdXInLCBibHVySGFuZGxlciwgZmFsc2UgKTtcblx0XHRcdH07XG5cblx0XHRcdG5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ2ZvY3VzJywgZm9jdXNIYW5kbGVyLCBmYWxzZSApO1xuXHRcdH1cblxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3BvaW50ZXJkb3duJywgbW91c2Vkb3duLCBmYWxzZSApO1xuXHRcdFx0XHRub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdNU1BvaW50ZXJEb3duJywgbW91c2Vkb3duLCBmYWxzZSApO1xuXHRcdFx0XHRub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdtb3VzZWRvd24nLCBtb3VzZWRvd24sIGZhbHNlICk7XG5cdFx0XHRcdG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3RvdWNoc3RhcnQnLCB0b3VjaHN0YXJ0LCBmYWxzZSApO1xuXHRcdFx0XHRub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdmb2N1cycsIGZvY3VzSGFuZGxlciwgZmFsc2UgKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9O1xuXG5cdFJhY3RpdmUuZXZlbnRzLnRhcCA9IHRhcDtcblxufSkpO1xuIiwiLypcblxuXHRSYWN0aXZlIC0gdjAuMy45LTMxNy1kMjNlNDA4IC0gMjAxNC0wMy0yMVxuXHQ9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5cdE5leHQtZ2VuZXJhdGlvbiBET00gbWFuaXB1bGF0aW9uIC0gaHR0cDovL3JhY3RpdmVqcy5vcmdcblx0Rm9sbG93IEBSYWN0aXZlSlMgZm9yIHVwZGF0ZXNcblxuXHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5cdENvcHlyaWdodCAyMDE0IFJpY2ggSGFycmlzIGFuZCBjb250cmlidXRvcnNcblxuXHRQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvblxuXHRvYnRhaW5pbmcgYSBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvblxuXHRmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXRcblx0cmVzdHJpY3Rpb24sIGluY2x1ZGluZyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsXG5cdGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXG5cdGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZVxuXHRTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZ1xuXHRjb25kaXRpb25zOlxuXG5cdFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlXG5cdGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuXG5cdFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsXG5cdEVYUFJFU1MgT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFU1xuXHRPRiBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORFxuXHROT05JTkZSSU5HRU1FTlQuIElOIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVFxuXHRIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSxcblx0V0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HXG5cdEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1Jcblx0T1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG4qL1xuXG4oIGZ1bmN0aW9uKCBnbG9iYWwgKSB7XG5cblxuXG5cdHZhciBub0NvbmZsaWN0ID0gZ2xvYmFsLlJhY3RpdmU7XG5cblx0dmFyIGxlZ2FjeSA9IHVuZGVmaW5lZDtcblxuXHR2YXIgY29uZmlnX2luaXRPcHRpb25zID0gZnVuY3Rpb24oIGxlZ2FjeSApIHtcblxuXHRcdHZhciBkZWZhdWx0cywgaW5pdE9wdGlvbnM7XG5cdFx0ZGVmYXVsdHMgPSB7XG5cdFx0XHRlbDogbnVsbCxcblx0XHRcdHRlbXBsYXRlOiAnJyxcblx0XHRcdGNvbXBsZXRlOiBudWxsLFxuXHRcdFx0cHJlc2VydmVXaGl0ZXNwYWNlOiBmYWxzZSxcblx0XHRcdGFwcGVuZDogZmFsc2UsXG5cdFx0XHR0d293YXk6IHRydWUsXG5cdFx0XHRtb2RpZnlBcnJheXM6IHRydWUsXG5cdFx0XHRsYXp5OiBmYWxzZSxcblx0XHRcdGRlYnVnOiBmYWxzZSxcblx0XHRcdG5vSW50cm86IGZhbHNlLFxuXHRcdFx0dHJhbnNpdGlvbnNFbmFibGVkOiB0cnVlLFxuXHRcdFx0bWFnaWM6IGZhbHNlLFxuXHRcdFx0bm9Dc3NUcmFuc2Zvcm06IGZhbHNlLFxuXHRcdFx0YWRhcHQ6IFtdLFxuXHRcdFx0c2FuaXRpemU6IGZhbHNlLFxuXHRcdFx0c3RyaXBDb21tZW50czogdHJ1ZSxcblx0XHRcdGlzb2xhdGVkOiBmYWxzZSxcblx0XHRcdGRlbGltaXRlcnM6IFtcblx0XHRcdFx0J3t7Jyxcblx0XHRcdFx0J319J1xuXHRcdFx0XSxcblx0XHRcdHRyaXBsZURlbGltaXRlcnM6IFtcblx0XHRcdFx0J3t7eycsXG5cdFx0XHRcdCd9fX0nXG5cdFx0XHRdXG5cdFx0fTtcblx0XHRpbml0T3B0aW9ucyA9IHtcblx0XHRcdGtleXM6IE9iamVjdC5rZXlzKCBkZWZhdWx0cyApLFxuXHRcdFx0ZGVmYXVsdHM6IGRlZmF1bHRzXG5cdFx0fTtcblx0XHRyZXR1cm4gaW5pdE9wdGlvbnM7XG5cdH0oIGxlZ2FjeSApO1xuXG5cdHZhciBjb25maWdfc3ZnID0gZnVuY3Rpb24oKSB7XG5cblx0XHRpZiAoIHR5cGVvZiBkb2N1bWVudCA9PT0gJ3VuZGVmaW5lZCcgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHJldHVybiBkb2N1bWVudCAmJiBkb2N1bWVudC5pbXBsZW1lbnRhdGlvbi5oYXNGZWF0dXJlKCAnaHR0cDovL3d3dy53My5vcmcvVFIvU1ZHMTEvZmVhdHVyZSNCYXNpY1N0cnVjdHVyZScsICcxLjEnICk7XG5cdH0oKTtcblxuXHR2YXIgY29uZmlnX25hbWVzcGFjZXMgPSB7XG5cdFx0aHRtbDogJ2h0dHA6Ly93d3cudzMub3JnLzE5OTkveGh0bWwnLFxuXHRcdG1hdGhtbDogJ2h0dHA6Ly93d3cudzMub3JnLzE5OTgvTWF0aC9NYXRoTUwnLFxuXHRcdHN2ZzogJ2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJyxcblx0XHR4bGluazogJ2h0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsnLFxuXHRcdHhtbDogJ2h0dHA6Ly93d3cudzMub3JnL1hNTC8xOTk4L25hbWVzcGFjZScsXG5cdFx0eG1sbnM6ICdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3htbG5zLydcblx0fTtcblxuXHR2YXIgdXRpbHNfY3JlYXRlRWxlbWVudCA9IGZ1bmN0aW9uKCBzdmcsIG5hbWVzcGFjZXMgKSB7XG5cblx0XHRpZiAoICFzdmcgKSB7XG5cdFx0XHRyZXR1cm4gZnVuY3Rpb24oIHR5cGUsIG5zICkge1xuXHRcdFx0XHRpZiAoIG5zICYmIG5zICE9PSBuYW1lc3BhY2VzLmh0bWwgKSB7XG5cdFx0XHRcdFx0dGhyb3cgJ1RoaXMgYnJvd3NlciBkb2VzIG5vdCBzdXBwb3J0IG5hbWVzcGFjZXMgb3RoZXIgdGhhbiBodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hodG1sLiBUaGUgbW9zdCBsaWtlbHkgY2F1c2Ugb2YgdGhpcyBlcnJvciBpcyB0aGF0IHlvdVxcJ3JlIHRyeWluZyB0byByZW5kZXIgU1ZHIGluIGFuIG9sZGVyIGJyb3dzZXIuIFNlZSBodHRwOi8vZG9jcy5yYWN0aXZlanMub3JnL2xhdGVzdC9zdmctYW5kLW9sZGVyLWJyb3dzZXJzIGZvciBtb3JlIGluZm9ybWF0aW9uJztcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggdHlwZSApO1xuXHRcdFx0fTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCB0eXBlLCBucyApIHtcblx0XHRcdFx0aWYgKCAhbnMgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoIHR5cGUgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKCBucywgdHlwZSApO1xuXHRcdFx0fTtcblx0XHR9XG5cdH0oIGNvbmZpZ19zdmcsIGNvbmZpZ19uYW1lc3BhY2VzICk7XG5cblx0dmFyIGNvbmZpZ19pc0NsaWVudCA9IHR5cGVvZiBkb2N1bWVudCA9PT0gJ29iamVjdCc7XG5cblx0dmFyIHV0aWxzX2RlZmluZVByb3BlcnR5ID0gZnVuY3Rpb24oIGlzQ2xpZW50ICkge1xuXG5cdFx0dHJ5IHtcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eSgge30sICd0ZXN0Jywge1xuXHRcdFx0XHR2YWx1ZTogMFxuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCBpc0NsaWVudCApIHtcblx0XHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KCBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApLCAndGVzdCcsIHtcblx0XHRcdFx0XHR2YWx1ZTogMFxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gT2JqZWN0LmRlZmluZVByb3BlcnR5O1xuXHRcdH0gY2F0Y2ggKCBlcnIgKSB7XG5cdFx0XHRyZXR1cm4gZnVuY3Rpb24oIG9iaiwgcHJvcCwgZGVzYyApIHtcblx0XHRcdFx0b2JqWyBwcm9wIF0gPSBkZXNjLnZhbHVlO1xuXHRcdFx0fTtcblx0XHR9XG5cdH0oIGNvbmZpZ19pc0NsaWVudCApO1xuXG5cdHZhciB1dGlsc19kZWZpbmVQcm9wZXJ0aWVzID0gZnVuY3Rpb24oIGNyZWF0ZUVsZW1lbnQsIGRlZmluZVByb3BlcnR5LCBpc0NsaWVudCApIHtcblxuXHRcdHRyeSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydGllcygge30sIHtcblx0XHRcdFx0XHR0ZXN0OiB7XG5cdFx0XHRcdFx0XHR2YWx1ZTogMFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSApO1xuXHRcdFx0fSBjYXRjaCAoIGVyciApIHtcblx0XHRcdFx0dGhyb3cgZXJyO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBpc0NsaWVudCApIHtcblx0XHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnRpZXMoIGNyZWF0ZUVsZW1lbnQoICdkaXYnICksIHtcblx0XHRcdFx0XHR0ZXN0OiB7XG5cdFx0XHRcdFx0XHR2YWx1ZTogMFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzO1xuXHRcdH0gY2F0Y2ggKCBlcnIgKSB7XG5cdFx0XHRyZXR1cm4gZnVuY3Rpb24oIG9iaiwgcHJvcHMgKSB7XG5cdFx0XHRcdHZhciBwcm9wO1xuXHRcdFx0XHRmb3IgKCBwcm9wIGluIHByb3BzICkge1xuXHRcdFx0XHRcdGlmICggcHJvcHMuaGFzT3duUHJvcGVydHkoIHByb3AgKSApIHtcblx0XHRcdFx0XHRcdGRlZmluZVByb3BlcnR5KCBvYmosIHByb3AsIHByb3BzWyBwcm9wIF0gKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0fVxuXHR9KCB1dGlsc19jcmVhdGVFbGVtZW50LCB1dGlsc19kZWZpbmVQcm9wZXJ0eSwgY29uZmlnX2lzQ2xpZW50ICk7XG5cblx0dmFyIHV0aWxzX2lzTnVtZXJpYyA9IGZ1bmN0aW9uKCB0aGluZyApIHtcblx0XHRyZXR1cm4gIWlzTmFOKCBwYXJzZUZsb2F0KCB0aGluZyApICkgJiYgaXNGaW5pdGUoIHRoaW5nICk7XG5cdH07XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX3NoYXJlZF9hZGQgPSBmdW5jdGlvbiggaXNOdW1lcmljICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCByb290LCBrZXlwYXRoLCBkICkge1xuXHRcdFx0dmFyIHZhbHVlO1xuXHRcdFx0aWYgKCB0eXBlb2Yga2V5cGF0aCAhPT0gJ3N0cmluZycgfHwgIWlzTnVtZXJpYyggZCApICkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdCYWQgYXJndW1lbnRzJyApO1xuXHRcdFx0fVxuXHRcdFx0dmFsdWUgPSArcm9vdC5nZXQoIGtleXBhdGggKSB8fCAwO1xuXHRcdFx0aWYgKCAhaXNOdW1lcmljKCB2YWx1ZSApICkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdDYW5ub3QgYWRkIHRvIGEgbm9uLW51bWVyaWMgdmFsdWUnICk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcm9vdC5zZXQoIGtleXBhdGgsIHZhbHVlICsgZCApO1xuXHRcdH07XG5cdH0oIHV0aWxzX2lzTnVtZXJpYyApO1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9hZGQgPSBmdW5jdGlvbiggYWRkICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBrZXlwYXRoLCBkICkge1xuXHRcdFx0cmV0dXJuIGFkZCggdGhpcywga2V5cGF0aCwgZCA9PT0gdW5kZWZpbmVkID8gMSA6ICtkICk7XG5cdFx0fTtcblx0fSggUmFjdGl2ZV9wcm90b3R5cGVfc2hhcmVkX2FkZCApO1xuXG5cdHZhciB1dGlsc19pc0VxdWFsID0gZnVuY3Rpb24oIGEsIGIgKSB7XG5cdFx0aWYgKCBhID09PSBudWxsICYmIGIgPT09IG51bGwgKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKCB0eXBlb2YgYSA9PT0gJ29iamVjdCcgfHwgdHlwZW9mIGIgPT09ICdvYmplY3QnICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gYSA9PT0gYjtcblx0fTtcblxuXHR2YXIgdXRpbHNfUHJvbWlzZSA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0dmFyIFByb21pc2UsIFBFTkRJTkcgPSB7fSwgRlVMRklMTEVEID0ge30sIFJFSkVDVEVEID0ge307XG5cdFx0UHJvbWlzZSA9IGZ1bmN0aW9uKCBjYWxsYmFjayApIHtcblx0XHRcdHZhciBmdWxmaWxsZWRIYW5kbGVycyA9IFtdLFxuXHRcdFx0XHRyZWplY3RlZEhhbmRsZXJzID0gW10sXG5cdFx0XHRcdHN0YXRlID0gUEVORElORyxcblx0XHRcdFx0cmVzdWx0LCBkaXNwYXRjaEhhbmRsZXJzLCBtYWtlUmVzb2x2ZXIsIGZ1bGZpbCwgcmVqZWN0LCBwcm9taXNlO1xuXHRcdFx0bWFrZVJlc29sdmVyID0gZnVuY3Rpb24oIG5ld1N0YXRlICkge1xuXHRcdFx0XHRyZXR1cm4gZnVuY3Rpb24oIHZhbHVlICkge1xuXHRcdFx0XHRcdGlmICggc3RhdGUgIT09IFBFTkRJTkcgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJlc3VsdCA9IHZhbHVlO1xuXHRcdFx0XHRcdHN0YXRlID0gbmV3U3RhdGU7XG5cdFx0XHRcdFx0ZGlzcGF0Y2hIYW5kbGVycyA9IG1ha2VEaXNwYXRjaGVyKCBzdGF0ZSA9PT0gRlVMRklMTEVEID8gZnVsZmlsbGVkSGFuZGxlcnMgOiByZWplY3RlZEhhbmRsZXJzLCByZXN1bHQgKTtcblx0XHRcdFx0XHR3YWl0KCBkaXNwYXRjaEhhbmRsZXJzICk7XG5cdFx0XHRcdH07XG5cdFx0XHR9O1xuXHRcdFx0ZnVsZmlsID0gbWFrZVJlc29sdmVyKCBGVUxGSUxMRUQgKTtcblx0XHRcdHJlamVjdCA9IG1ha2VSZXNvbHZlciggUkVKRUNURUQgKTtcblx0XHRcdGNhbGxiYWNrKCBmdWxmaWwsIHJlamVjdCApO1xuXHRcdFx0cHJvbWlzZSA9IHtcblx0XHRcdFx0dGhlbjogZnVuY3Rpb24oIG9uRnVsZmlsbGVkLCBvblJlamVjdGVkICkge1xuXHRcdFx0XHRcdHZhciBwcm9taXNlMiA9IG5ldyBQcm9taXNlKCBmdW5jdGlvbiggZnVsZmlsLCByZWplY3QgKSB7XG5cdFx0XHRcdFx0XHR2YXIgcHJvY2Vzc1Jlc29sdXRpb25IYW5kbGVyID0gZnVuY3Rpb24oIGhhbmRsZXIsIGhhbmRsZXJzLCBmb3J3YXJkICkge1xuXHRcdFx0XHRcdFx0XHRpZiAoIHR5cGVvZiBoYW5kbGVyID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0XHRcdFx0XHRcdGhhbmRsZXJzLnB1c2goIGZ1bmN0aW9uKCBwMXJlc3VsdCApIHtcblx0XHRcdFx0XHRcdFx0XHRcdHZhciB4O1xuXHRcdFx0XHRcdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0eCA9IGhhbmRsZXIoIHAxcmVzdWx0ICk7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHJlc29sdmUoIHByb21pc2UyLCB4LCBmdWxmaWwsIHJlamVjdCApO1xuXHRcdFx0XHRcdFx0XHRcdFx0fSBjYXRjaCAoIGVyciApIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0cmVqZWN0KCBlcnIgKTtcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0aGFuZGxlcnMucHVzaCggZm9yd2FyZCApO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0cHJvY2Vzc1Jlc29sdXRpb25IYW5kbGVyKCBvbkZ1bGZpbGxlZCwgZnVsZmlsbGVkSGFuZGxlcnMsIGZ1bGZpbCApO1xuXHRcdFx0XHRcdFx0cHJvY2Vzc1Jlc29sdXRpb25IYW5kbGVyKCBvblJlamVjdGVkLCByZWplY3RlZEhhbmRsZXJzLCByZWplY3QgKTtcblx0XHRcdFx0XHRcdGlmICggc3RhdGUgIT09IFBFTkRJTkcgKSB7XG5cdFx0XHRcdFx0XHRcdHdhaXQoIGRpc3BhdGNoSGFuZGxlcnMgKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0cmV0dXJuIHByb21pc2UyO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdFx0cHJvbWlzZVsgJ2NhdGNoJyBdID0gZnVuY3Rpb24oIG9uUmVqZWN0ZWQgKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnRoZW4oIG51bGwsIG9uUmVqZWN0ZWQgKTtcblx0XHRcdH07XG5cdFx0XHRyZXR1cm4gcHJvbWlzZTtcblx0XHR9O1xuXHRcdFByb21pc2UuYWxsID0gZnVuY3Rpb24oIHByb21pc2VzICkge1xuXHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlKCBmdW5jdGlvbiggZnVsZmlsLCByZWplY3QgKSB7XG5cdFx0XHRcdHZhciByZXN1bHQgPSBbXSxcblx0XHRcdFx0XHRwZW5kaW5nLCBpLCBwcm9jZXNzUHJvbWlzZTtcblx0XHRcdFx0aWYgKCAhcHJvbWlzZXMubGVuZ3RoICkge1xuXHRcdFx0XHRcdGZ1bGZpbCggcmVzdWx0ICk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHByb2Nlc3NQcm9taXNlID0gZnVuY3Rpb24oIGkgKSB7XG5cdFx0XHRcdFx0cHJvbWlzZXNbIGkgXS50aGVuKCBmdW5jdGlvbiggdmFsdWUgKSB7XG5cdFx0XHRcdFx0XHRyZXN1bHRbIGkgXSA9IHZhbHVlO1xuXHRcdFx0XHRcdFx0aWYgKCAhLS1wZW5kaW5nICkge1xuXHRcdFx0XHRcdFx0XHRmdWxmaWwoIHJlc3VsdCApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0sIHJlamVjdCApO1xuXHRcdFx0XHR9O1xuXHRcdFx0XHRwZW5kaW5nID0gaSA9IHByb21pc2VzLmxlbmd0aDtcblx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0cHJvY2Vzc1Byb21pc2UoIGkgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdH07XG5cdFx0UHJvbWlzZS5yZXNvbHZlID0gZnVuY3Rpb24oIHZhbHVlICkge1xuXHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlKCBmdW5jdGlvbiggZnVsZmlsICkge1xuXHRcdFx0XHRmdWxmaWwoIHZhbHVlICk7XG5cdFx0XHR9ICk7XG5cdFx0fTtcblx0XHRQcm9taXNlLnJlamVjdCA9IGZ1bmN0aW9uKCByZWFzb24gKSB7XG5cdFx0XHRyZXR1cm4gbmV3IFByb21pc2UoIGZ1bmN0aW9uKCBmdWxmaWwsIHJlamVjdCApIHtcblx0XHRcdFx0cmVqZWN0KCByZWFzb24gKTtcblx0XHRcdH0gKTtcblx0XHR9O1xuXHRcdHJldHVybiBQcm9taXNlO1xuXG5cdFx0ZnVuY3Rpb24gd2FpdCggY2FsbGJhY2sgKSB7XG5cdFx0XHRzZXRUaW1lb3V0KCBjYWxsYmFjaywgMCApO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIG1ha2VEaXNwYXRjaGVyKCBoYW5kbGVycywgcmVzdWx0ICkge1xuXHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgaGFuZGxlcjtcblx0XHRcdFx0d2hpbGUgKCBoYW5kbGVyID0gaGFuZGxlcnMuc2hpZnQoKSApIHtcblx0XHRcdFx0XHRoYW5kbGVyKCByZXN1bHQgKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiByZXNvbHZlKCBwcm9taXNlLCB4LCBmdWxmaWwsIHJlamVjdCApIHtcblx0XHRcdHZhciB0aGVuO1xuXHRcdFx0aWYgKCB4ID09PSBwcm9taXNlICkge1xuXHRcdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKCAnQSBwcm9taXNlXFwncyBmdWxmaWxsbWVudCBoYW5kbGVyIGNhbm5vdCByZXR1cm4gdGhlIHNhbWUgcHJvbWlzZScgKTtcblx0XHRcdH1cblx0XHRcdGlmICggeCBpbnN0YW5jZW9mIFByb21pc2UgKSB7XG5cdFx0XHRcdHgudGhlbiggZnVsZmlsLCByZWplY3QgKTtcblx0XHRcdH0gZWxzZSBpZiAoIHggJiYgKCB0eXBlb2YgeCA9PT0gJ29iamVjdCcgfHwgdHlwZW9mIHggPT09ICdmdW5jdGlvbicgKSApIHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHR0aGVuID0geC50aGVuO1xuXHRcdFx0XHR9IGNhdGNoICggZSApIHtcblx0XHRcdFx0XHRyZWplY3QoIGUgKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCB0eXBlb2YgdGhlbiA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdFx0XHR2YXIgY2FsbGVkLCByZXNvbHZlUHJvbWlzZSwgcmVqZWN0UHJvbWlzZTtcblx0XHRcdFx0XHRyZXNvbHZlUHJvbWlzZSA9IGZ1bmN0aW9uKCB5ICkge1xuXHRcdFx0XHRcdFx0aWYgKCBjYWxsZWQgKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNhbGxlZCA9IHRydWU7XG5cdFx0XHRcdFx0XHRyZXNvbHZlKCBwcm9taXNlLCB5LCBmdWxmaWwsIHJlamVjdCApO1xuXHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0cmVqZWN0UHJvbWlzZSA9IGZ1bmN0aW9uKCByICkge1xuXHRcdFx0XHRcdFx0aWYgKCBjYWxsZWQgKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNhbGxlZCA9IHRydWU7XG5cdFx0XHRcdFx0XHRyZWplY3QoIHIgKTtcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHR0aGVuLmNhbGwoIHgsIHJlc29sdmVQcm9taXNlLCByZWplY3RQcm9taXNlICk7XG5cdFx0XHRcdFx0fSBjYXRjaCAoIGUgKSB7XG5cdFx0XHRcdFx0XHRpZiAoICFjYWxsZWQgKSB7XG5cdFx0XHRcdFx0XHRcdHJlamVjdCggZSApO1xuXHRcdFx0XHRcdFx0XHRjYWxsZWQgPSB0cnVlO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGZ1bGZpbCggeCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRmdWxmaWwoIHggKTtcblx0XHRcdH1cblx0XHR9XG5cdH0oKTtcblxuXHR2YXIgdXRpbHNfbm9ybWFsaXNlS2V5cGF0aCA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0dmFyIHJlZ2V4ID0gL1xcW1xccyooXFwqfFswLTldfFsxLTldWzAtOV0rKVxccypcXF0vZztcblx0XHRyZXR1cm4gZnVuY3Rpb24gbm9ybWFsaXNlS2V5cGF0aCgga2V5cGF0aCApIHtcblx0XHRcdHJldHVybiAoIGtleXBhdGggfHwgJycgKS5yZXBsYWNlKCByZWdleCwgJy4kMScgKTtcblx0XHR9O1xuXHR9KCk7XG5cblx0dmFyIGNvbmZpZ192ZW5kb3JzID0gW1xuXHRcdCdvJyxcblx0XHQnbXMnLFxuXHRcdCdtb3onLFxuXHRcdCd3ZWJraXQnXG5cdF07XG5cblx0dmFyIHV0aWxzX3JlcXVlc3RBbmltYXRpb25GcmFtZSA9IGZ1bmN0aW9uKCB2ZW5kb3JzICkge1xuXG5cdFx0aWYgKCB0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJyApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0KCBmdW5jdGlvbiggdmVuZG9ycywgbGFzdFRpbWUsIHdpbmRvdyApIHtcblx0XHRcdHZhciB4LCBzZXRUaW1lb3V0O1xuXHRcdFx0aWYgKCB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRmb3IgKCB4ID0gMDsgeCA8IHZlbmRvcnMubGVuZ3RoICYmICF3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lOyArK3ggKSB7XG5cdFx0XHRcdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSB3aW5kb3dbIHZlbmRvcnNbIHggXSArICdSZXF1ZXN0QW5pbWF0aW9uRnJhbWUnIF07XG5cdFx0XHR9XG5cdFx0XHRpZiAoICF3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lICkge1xuXHRcdFx0XHRzZXRUaW1lb3V0ID0gd2luZG93LnNldFRpbWVvdXQ7XG5cdFx0XHRcdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XG5cdFx0XHRcdFx0dmFyIGN1cnJUaW1lLCB0aW1lVG9DYWxsLCBpZDtcblx0XHRcdFx0XHRjdXJyVGltZSA9IERhdGUubm93KCk7XG5cdFx0XHRcdFx0dGltZVRvQ2FsbCA9IE1hdGgubWF4KCAwLCAxNiAtICggY3VyclRpbWUgLSBsYXN0VGltZSApICk7XG5cdFx0XHRcdFx0aWQgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdGNhbGxiYWNrKCBjdXJyVGltZSArIHRpbWVUb0NhbGwgKTtcblx0XHRcdFx0XHR9LCB0aW1lVG9DYWxsICk7XG5cdFx0XHRcdFx0bGFzdFRpbWUgPSBjdXJyVGltZSArIHRpbWVUb0NhbGw7XG5cdFx0XHRcdFx0cmV0dXJuIGlkO1xuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH0oIHZlbmRvcnMsIDAsIHdpbmRvdyApICk7XG5cdFx0cmV0dXJuIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWU7XG5cdH0oIGNvbmZpZ192ZW5kb3JzICk7XG5cblx0dmFyIHV0aWxzX2dldFRpbWUgPSBmdW5jdGlvbigpIHtcblxuXHRcdGlmICggdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93LnBlcmZvcm1hbmNlICYmIHR5cGVvZiB3aW5kb3cucGVyZm9ybWFuY2Uubm93ID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gd2luZG93LnBlcmZvcm1hbmNlLm5vdygpO1xuXHRcdFx0fTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gRGF0ZS5ub3coKTtcblx0XHRcdH07XG5cdFx0fVxuXHR9KCk7XG5cblx0Ly8gVGhpcyBtb2R1bGUgcHJvdmlkZXMgYSBwbGFjZSB0byBzdG9yZSBhKSBjaXJjdWxhciBkZXBlbmRlbmNpZXMgYW5kXG5cdC8vIGIpIHRoZSBjYWxsYmFjayBmdW5jdGlvbnMgdGhhdCByZXF1aXJlIHRob3NlIGNpcmN1bGFyIGRlcGVuZGVuY2llc1xuXHR2YXIgY2lyY3VsYXIgPSBbXTtcblxuXHR2YXIgdXRpbHNfcmVtb3ZlRnJvbUFycmF5ID0gZnVuY3Rpb24oIGFycmF5LCBtZW1iZXIgKSB7XG5cdFx0dmFyIGluZGV4ID0gYXJyYXkuaW5kZXhPZiggbWVtYmVyICk7XG5cdFx0aWYgKCBpbmRleCAhPT0gLTEgKSB7XG5cdFx0XHRhcnJheS5zcGxpY2UoIGluZGV4LCAxICk7XG5cdFx0fVxuXHR9O1xuXG5cdHZhciBnbG9iYWxfY3NzID0gZnVuY3Rpb24oIGNpcmN1bGFyLCBpc0NsaWVudCwgcmVtb3ZlRnJvbUFycmF5ICkge1xuXG5cdFx0dmFyIHJ1bmxvb3AsIHN0eWxlRWxlbWVudCwgaGVhZCwgc3R5bGVTaGVldCwgaW5Eb20sIHByZWZpeCA9ICcvKiBSYWN0aXZlLmpzIGNvbXBvbmVudCBzdHlsZXMgKi9cXG4nLFxuXHRcdFx0Y29tcG9uZW50c0luUGFnZSA9IHt9LCBzdHlsZXMgPSBbXTtcblx0XHRpZiAoICFpc0NsaWVudCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y2lyY3VsYXIucHVzaCggZnVuY3Rpb24oKSB7XG5cdFx0XHRydW5sb29wID0gY2lyY3VsYXIucnVubG9vcDtcblx0XHR9ICk7XG5cdFx0c3R5bGVFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ3N0eWxlJyApO1xuXHRcdHN0eWxlRWxlbWVudC50eXBlID0gJ3RleHQvY3NzJztcblx0XHRoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoICdoZWFkJyApWyAwIF07XG5cdFx0aW5Eb20gPSBmYWxzZTtcblx0XHRzdHlsZVNoZWV0ID0gc3R5bGVFbGVtZW50LnN0eWxlU2hlZXQ7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGFkZDogZnVuY3Rpb24oIENvbXBvbmVudCApIHtcblx0XHRcdFx0aWYgKCAhQ29tcG9uZW50LmNzcyApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCAhY29tcG9uZW50c0luUGFnZVsgQ29tcG9uZW50Ll9ndWlkIF0gKSB7XG5cdFx0XHRcdFx0Y29tcG9uZW50c0luUGFnZVsgQ29tcG9uZW50Ll9ndWlkIF0gPSAwO1xuXHRcdFx0XHRcdHN0eWxlcy5wdXNoKCBDb21wb25lbnQuY3NzICk7XG5cdFx0XHRcdFx0cnVubG9vcC5zY2hlZHVsZUNzc1VwZGF0ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbXBvbmVudHNJblBhZ2VbIENvbXBvbmVudC5fZ3VpZCBdICs9IDE7XG5cdFx0XHR9LFxuXHRcdFx0cmVtb3ZlOiBmdW5jdGlvbiggQ29tcG9uZW50ICkge1xuXHRcdFx0XHRpZiAoICFDb21wb25lbnQuY3NzICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb21wb25lbnRzSW5QYWdlWyBDb21wb25lbnQuX2d1aWQgXSAtPSAxO1xuXHRcdFx0XHRpZiAoICFjb21wb25lbnRzSW5QYWdlWyBDb21wb25lbnQuX2d1aWQgXSApIHtcblx0XHRcdFx0XHRyZW1vdmVGcm9tQXJyYXkoIHN0eWxlcywgQ29tcG9uZW50LmNzcyApO1xuXHRcdFx0XHRcdHJ1bmxvb3Auc2NoZWR1bGVDc3NVcGRhdGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHVwZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBjc3M7XG5cdFx0XHRcdGlmICggc3R5bGVzLmxlbmd0aCApIHtcblx0XHRcdFx0XHRjc3MgPSBwcmVmaXggKyBzdHlsZXMuam9pbiggJyAnICk7XG5cdFx0XHRcdFx0aWYgKCBzdHlsZVNoZWV0ICkge1xuXHRcdFx0XHRcdFx0c3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRzdHlsZUVsZW1lbnQuaW5uZXJIVE1MID0gY3NzO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoICFpbkRvbSApIHtcblx0XHRcdFx0XHRcdGhlYWQuYXBwZW5kQ2hpbGQoIHN0eWxlRWxlbWVudCApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIGlmICggaW5Eb20gKSB7XG5cdFx0XHRcdFx0aGVhZC5yZW1vdmVDaGlsZCggc3R5bGVFbGVtZW50ICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHR9KCBjaXJjdWxhciwgY29uZmlnX2lzQ2xpZW50LCB1dGlsc19yZW1vdmVGcm9tQXJyYXkgKTtcblxuXHR2YXIgc2hhcmVkX2dldFZhbHVlRnJvbUNoZWNrYm94ZXMgPSBmdW5jdGlvbiggcmFjdGl2ZSwga2V5cGF0aCApIHtcblx0XHR2YXIgdmFsdWUsIGNoZWNrYm94ZXMsIGNoZWNrYm94LCBsZW4sIGksIHJvb3RFbDtcblx0XHR2YWx1ZSA9IFtdO1xuXHRcdHJvb3RFbCA9IHJhY3RpdmUuX3JlbmRlcmluZyA/IHJhY3RpdmUuZnJhZ21lbnQuZG9jRnJhZyA6IHJhY3RpdmUuZWw7XG5cdFx0Y2hlY2tib3hlcyA9IHJvb3RFbC5xdWVyeVNlbGVjdG9yQWxsKCAnaW5wdXRbdHlwZT1cImNoZWNrYm94XCJdW25hbWU9XCJ7eycgKyBrZXlwYXRoICsgJ319XCJdJyApO1xuXHRcdGxlbiA9IGNoZWNrYm94ZXMubGVuZ3RoO1xuXHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRjaGVja2JveCA9IGNoZWNrYm94ZXNbIGkgXTtcblx0XHRcdGlmICggY2hlY2tib3guaGFzQXR0cmlidXRlKCAnY2hlY2tlZCcgKSB8fCBjaGVja2JveC5jaGVja2VkICkge1xuXHRcdFx0XHR2YWx1ZS5wdXNoKCBjaGVja2JveC5fcmFjdGl2ZS52YWx1ZSApO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdmFsdWU7XG5cdH07XG5cblx0dmFyIHV0aWxzX2hhc093blByb3BlcnR5ID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcblxuXHR2YXIgc2hhcmVkX2dldElubmVyQ29udGV4dCA9IGZ1bmN0aW9uKCBmcmFnbWVudCApIHtcblx0XHRkbyB7XG5cdFx0XHRpZiAoIGZyYWdtZW50LmNvbnRleHQgKSB7XG5cdFx0XHRcdHJldHVybiBmcmFnbWVudC5jb250ZXh0O1xuXHRcdFx0fVxuXHRcdH0gd2hpbGUgKCBmcmFnbWVudCA9IGZyYWdtZW50LnBhcmVudCApO1xuXHRcdHJldHVybiAnJztcblx0fTtcblxuXHR2YXIgc2hhcmVkX3Jlc29sdmVSZWYgPSBmdW5jdGlvbiggY2lyY3VsYXIsIG5vcm1hbGlzZUtleXBhdGgsIGhhc093blByb3BlcnR5LCBnZXRJbm5lckNvbnRleHQgKSB7XG5cblx0XHR2YXIgZ2V0LCBhbmNlc3RvckVycm9yTWVzc2FnZSA9ICdDb3VsZCBub3QgcmVzb2x2ZSByZWZlcmVuY2UgLSB0b28gbWFueSBcIi4uL1wiIHByZWZpeGVzJztcblx0XHRjaXJjdWxhci5wdXNoKCBmdW5jdGlvbigpIHtcblx0XHRcdGdldCA9IGNpcmN1bGFyLmdldDtcblx0XHR9ICk7XG5cdFx0cmV0dXJuIGZ1bmN0aW9uIHJlc29sdmVSZWYoIHJhY3RpdmUsIHJlZiwgZnJhZ21lbnQgKSB7XG5cdFx0XHR2YXIgY29udGV4dCwgY29udGV4dEtleXMsIGtleXMsIGxhc3RLZXksIHBvc3RmaXgsIHBhcmVudEtleXBhdGgsIHBhcmVudFZhbHVlLCB3cmFwcGVkO1xuXHRcdFx0cmVmID0gbm9ybWFsaXNlS2V5cGF0aCggcmVmICk7XG5cdFx0XHRpZiAoIHJlZiA9PT0gJy4nICkge1xuXHRcdFx0XHRyZXR1cm4gZ2V0SW5uZXJDb250ZXh0KCBmcmFnbWVudCApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCByZWYuY2hhckF0KCAwICkgPT09ICcuJyApIHtcblx0XHRcdFx0Y29udGV4dCA9IGdldElubmVyQ29udGV4dCggZnJhZ21lbnQgKTtcblx0XHRcdFx0Y29udGV4dEtleXMgPSBjb250ZXh0ID8gY29udGV4dC5zcGxpdCggJy4nICkgOiBbXTtcblx0XHRcdFx0aWYgKCByZWYuc3Vic3RyKCAwLCAzICkgPT09ICcuLi8nICkge1xuXHRcdFx0XHRcdHdoaWxlICggcmVmLnN1YnN0ciggMCwgMyApID09PSAnLi4vJyApIHtcblx0XHRcdFx0XHRcdGlmICggIWNvbnRleHRLZXlzLmxlbmd0aCApIHtcblx0XHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCBhbmNlc3RvckVycm9yTWVzc2FnZSApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y29udGV4dEtleXMucG9wKCk7XG5cdFx0XHRcdFx0XHRyZWYgPSByZWYuc3Vic3RyaW5nKCAzICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnRleHRLZXlzLnB1c2goIHJlZiApO1xuXHRcdFx0XHRcdHJldHVybiBjb250ZXh0S2V5cy5qb2luKCAnLicgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoICFjb250ZXh0ICkge1xuXHRcdFx0XHRcdHJldHVybiByZWYuc3Vic3RyaW5nKCAxICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGNvbnRleHQgKyByZWY7XG5cdFx0XHR9XG5cdFx0XHRrZXlzID0gcmVmLnNwbGl0KCAnLicgKTtcblx0XHRcdGxhc3RLZXkgPSBrZXlzLnBvcCgpO1xuXHRcdFx0cG9zdGZpeCA9IGtleXMubGVuZ3RoID8gJy4nICsga2V5cy5qb2luKCAnLicgKSA6ICcnO1xuXHRcdFx0ZG8ge1xuXHRcdFx0XHRjb250ZXh0ID0gZnJhZ21lbnQuY29udGV4dDtcblx0XHRcdFx0aWYgKCAhY29udGV4dCApIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRwYXJlbnRLZXlwYXRoID0gY29udGV4dCArIHBvc3RmaXg7XG5cdFx0XHRcdHBhcmVudFZhbHVlID0gZ2V0KCByYWN0aXZlLCBwYXJlbnRLZXlwYXRoICk7XG5cdFx0XHRcdGlmICggd3JhcHBlZCA9IHJhY3RpdmUuX3dyYXBwZWRbIHBhcmVudEtleXBhdGggXSApIHtcblx0XHRcdFx0XHRwYXJlbnRWYWx1ZSA9IHdyYXBwZWQuZ2V0KCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBwYXJlbnRWYWx1ZSAmJiAoIHR5cGVvZiBwYXJlbnRWYWx1ZSA9PT0gJ29iamVjdCcgfHwgdHlwZW9mIHBhcmVudFZhbHVlID09PSAnZnVuY3Rpb24nICkgJiYgbGFzdEtleSBpbiBwYXJlbnRWYWx1ZSApIHtcblx0XHRcdFx0XHRyZXR1cm4gY29udGV4dCArICcuJyArIHJlZjtcblx0XHRcdFx0fVxuXHRcdFx0fSB3aGlsZSAoIGZyYWdtZW50ID0gZnJhZ21lbnQucGFyZW50ICk7XG5cdFx0XHRpZiAoIGhhc093blByb3BlcnR5LmNhbGwoIHJhY3RpdmUuZGF0YSwgcmVmICkgKSB7XG5cdFx0XHRcdHJldHVybiByZWY7XG5cdFx0XHR9IGVsc2UgaWYgKCBnZXQoIHJhY3RpdmUsIHJlZiApICE9PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdHJldHVybiByZWY7XG5cdFx0XHR9XG5cdFx0fTtcblx0fSggY2lyY3VsYXIsIHV0aWxzX25vcm1hbGlzZUtleXBhdGgsIHV0aWxzX2hhc093blByb3BlcnR5LCBzaGFyZWRfZ2V0SW5uZXJDb250ZXh0ICk7XG5cblx0dmFyIHNoYXJlZF9nZXRVcHN0cmVhbUNoYW5nZXMgPSBmdW5jdGlvbiBnZXRVcHN0cmVhbUNoYW5nZXMoIGNoYW5nZXMgKSB7XG5cdFx0dmFyIHVwc3RyZWFtQ2hhbmdlcyA9IFsgJycgXSxcblx0XHRcdGksIGtleXBhdGgsIGtleXMsIHVwc3RyZWFtS2V5cGF0aDtcblx0XHRpID0gY2hhbmdlcy5sZW5ndGg7XG5cdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRrZXlwYXRoID0gY2hhbmdlc1sgaSBdO1xuXHRcdFx0a2V5cyA9IGtleXBhdGguc3BsaXQoICcuJyApO1xuXHRcdFx0d2hpbGUgKCBrZXlzLmxlbmd0aCA+IDEgKSB7XG5cdFx0XHRcdGtleXMucG9wKCk7XG5cdFx0XHRcdHVwc3RyZWFtS2V5cGF0aCA9IGtleXMuam9pbiggJy4nICk7XG5cdFx0XHRcdGlmICggdXBzdHJlYW1DaGFuZ2VzWyB1cHN0cmVhbUtleXBhdGggXSAhPT0gdHJ1ZSApIHtcblx0XHRcdFx0XHR1cHN0cmVhbUNoYW5nZXMucHVzaCggdXBzdHJlYW1LZXlwYXRoICk7XG5cdFx0XHRcdFx0dXBzdHJlYW1DaGFuZ2VzWyB1cHN0cmVhbUtleXBhdGggXSA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHVwc3RyZWFtQ2hhbmdlcztcblx0fTtcblxuXHR2YXIgc2hhcmVkX25vdGlmeURlcGVuZGFudHMgPSBmdW5jdGlvbigpIHtcblxuXHRcdHZhciBsYXN0S2V5LCBzdGFyTWFwcyA9IHt9O1xuXHRcdGxhc3RLZXkgPSAvW15cXC5dKyQvO1xuXG5cdFx0ZnVuY3Rpb24gbm90aWZ5RGVwZW5kYW50cyggcmFjdGl2ZSwga2V5cGF0aCwgb25seURpcmVjdCApIHtcblx0XHRcdHZhciBpO1xuXHRcdFx0aWYgKCByYWN0aXZlLl9wYXR0ZXJuT2JzZXJ2ZXJzLmxlbmd0aCApIHtcblx0XHRcdFx0bm90aWZ5UGF0dGVybk9ic2VydmVycyggcmFjdGl2ZSwga2V5cGF0aCwga2V5cGF0aCwgb25seURpcmVjdCwgdHJ1ZSApO1xuXHRcdFx0fVxuXHRcdFx0Zm9yICggaSA9IDA7IGkgPCByYWN0aXZlLl9kZXBzLmxlbmd0aDsgaSArPSAxICkge1xuXHRcdFx0XHRub3RpZnlEZXBlbmRhbnRzQXRQcmlvcml0eSggcmFjdGl2ZSwga2V5cGF0aCwgaSwgb25seURpcmVjdCApO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRub3RpZnlEZXBlbmRhbnRzLm11bHRpcGxlID0gZnVuY3Rpb24gbm90aWZ5TXVsdGlwbGVEZXBlbmRhbnRzKCByYWN0aXZlLCBrZXlwYXRocywgb25seURpcmVjdCApIHtcblx0XHRcdHZhciBpLCBqLCBsZW47XG5cdFx0XHRsZW4gPSBrZXlwYXRocy5sZW5ndGg7XG5cdFx0XHRpZiAoIHJhY3RpdmUuX3BhdHRlcm5PYnNlcnZlcnMubGVuZ3RoICkge1xuXHRcdFx0XHRpID0gbGVuO1xuXHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRub3RpZnlQYXR0ZXJuT2JzZXJ2ZXJzKCByYWN0aXZlLCBrZXlwYXRoc1sgaSBdLCBrZXlwYXRoc1sgaSBdLCBvbmx5RGlyZWN0LCB0cnVlICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGZvciAoIGkgPSAwOyBpIDwgcmFjdGl2ZS5fZGVwcy5sZW5ndGg7IGkgKz0gMSApIHtcblx0XHRcdFx0aWYgKCByYWN0aXZlLl9kZXBzWyBpIF0gKSB7XG5cdFx0XHRcdFx0aiA9IGxlbjtcblx0XHRcdFx0XHR3aGlsZSAoIGotLSApIHtcblx0XHRcdFx0XHRcdG5vdGlmeURlcGVuZGFudHNBdFByaW9yaXR5KCByYWN0aXZlLCBrZXlwYXRoc1sgaiBdLCBpLCBvbmx5RGlyZWN0ICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gbm90aWZ5RGVwZW5kYW50cztcblxuXHRcdGZ1bmN0aW9uIG5vdGlmeURlcGVuZGFudHNBdFByaW9yaXR5KCByYWN0aXZlLCBrZXlwYXRoLCBwcmlvcml0eSwgb25seURpcmVjdCApIHtcblx0XHRcdHZhciBkZXBzQnlLZXlwYXRoID0gcmFjdGl2ZS5fZGVwc1sgcHJpb3JpdHkgXTtcblx0XHRcdGlmICggIWRlcHNCeUtleXBhdGggKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHVwZGF0ZUFsbCggZGVwc0J5S2V5cGF0aFsga2V5cGF0aCBdICk7XG5cdFx0XHRpZiAoIG9ubHlEaXJlY3QgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNhc2NhZGUoIHJhY3RpdmUuX2RlcHNNYXBbIGtleXBhdGggXSwgcmFjdGl2ZSwgcHJpb3JpdHkgKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiB1cGRhdGVBbGwoIGRlcHMgKSB7XG5cdFx0XHR2YXIgaSwgbGVuO1xuXHRcdFx0aWYgKCBkZXBzICkge1xuXHRcdFx0XHRsZW4gPSBkZXBzLmxlbmd0aDtcblx0XHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0XHRkZXBzWyBpIF0udXBkYXRlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRmdW5jdGlvbiBjYXNjYWRlKCBjaGlsZERlcHMsIHJhY3RpdmUsIHByaW9yaXR5LCBvbmx5RGlyZWN0ICkge1xuXHRcdFx0dmFyIGk7XG5cdFx0XHRpZiAoIGNoaWxkRGVwcyApIHtcblx0XHRcdFx0aSA9IGNoaWxkRGVwcy5sZW5ndGg7XG5cdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdG5vdGlmeURlcGVuZGFudHNBdFByaW9yaXR5KCByYWN0aXZlLCBjaGlsZERlcHNbIGkgXSwgcHJpb3JpdHksIG9ubHlEaXJlY3QgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIG5vdGlmeVBhdHRlcm5PYnNlcnZlcnMoIHJhY3RpdmUsIHJlZ2lzdGVyZWRLZXlwYXRoLCBhY3R1YWxLZXlwYXRoLCBpc1BhcmVudE9mQ2hhbmdlZEtleXBhdGgsIGlzVG9wTGV2ZWxDYWxsICkge1xuXHRcdFx0dmFyIGksIHBhdHRlcm5PYnNlcnZlciwgY2hpbGRyZW4sIGNoaWxkLCBrZXksIGNoaWxkQWN0dWFsS2V5cGF0aCwgcG90ZW50aWFsV2lsZGNhcmRNYXRjaGVzLCBjYXNjYWRlO1xuXHRcdFx0aSA9IHJhY3RpdmUuX3BhdHRlcm5PYnNlcnZlcnMubGVuZ3RoO1xuXHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdHBhdHRlcm5PYnNlcnZlciA9IHJhY3RpdmUuX3BhdHRlcm5PYnNlcnZlcnNbIGkgXTtcblx0XHRcdFx0aWYgKCBwYXR0ZXJuT2JzZXJ2ZXIucmVnZXgudGVzdCggYWN0dWFsS2V5cGF0aCApICkge1xuXHRcdFx0XHRcdHBhdHRlcm5PYnNlcnZlci51cGRhdGUoIGFjdHVhbEtleXBhdGggKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCBpc1BhcmVudE9mQ2hhbmdlZEtleXBhdGggKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNhc2NhZGUgPSBmdW5jdGlvbigga2V5cGF0aCApIHtcblx0XHRcdFx0aWYgKCBjaGlsZHJlbiA9IHJhY3RpdmUuX2RlcHNNYXBbIGtleXBhdGggXSApIHtcblx0XHRcdFx0XHRpID0gY2hpbGRyZW4ubGVuZ3RoO1xuXHRcdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdFx0Y2hpbGQgPSBjaGlsZHJlblsgaSBdO1xuXHRcdFx0XHRcdFx0a2V5ID0gbGFzdEtleS5leGVjKCBjaGlsZCApWyAwIF07XG5cdFx0XHRcdFx0XHRjaGlsZEFjdHVhbEtleXBhdGggPSBhY3R1YWxLZXlwYXRoICsgJy4nICsga2V5O1xuXHRcdFx0XHRcdFx0bm90aWZ5UGF0dGVybk9ic2VydmVycyggcmFjdGl2ZSwgY2hpbGQsIGNoaWxkQWN0dWFsS2V5cGF0aCApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHRcdGlmICggaXNUb3BMZXZlbENhbGwgKSB7XG5cdFx0XHRcdHBvdGVudGlhbFdpbGRjYXJkTWF0Y2hlcyA9IGdldFBvdGVudGlhbFdpbGRjYXJkTWF0Y2hlcyggYWN0dWFsS2V5cGF0aCApO1xuXHRcdFx0XHRwb3RlbnRpYWxXaWxkY2FyZE1hdGNoZXMuZm9yRWFjaCggY2FzY2FkZSApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y2FzY2FkZSggcmVnaXN0ZXJlZEtleXBhdGggKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXRQb3RlbnRpYWxXaWxkY2FyZE1hdGNoZXMoIGtleXBhdGggKSB7XG5cdFx0XHR2YXIga2V5cywgc3Rhck1hcCwgbWFwcGVyLCBpLCByZXN1bHQsIHdpbGRjYXJkS2V5cGF0aDtcblx0XHRcdGtleXMgPSBrZXlwYXRoLnNwbGl0KCAnLicgKTtcblx0XHRcdHN0YXJNYXAgPSBnZXRTdGFyTWFwKCBrZXlzLmxlbmd0aCApO1xuXHRcdFx0cmVzdWx0ID0gW107XG5cdFx0XHRtYXBwZXIgPSBmdW5jdGlvbiggc3RhciwgaSApIHtcblx0XHRcdFx0cmV0dXJuIHN0YXIgPyAnKicgOiBrZXlzWyBpIF07XG5cdFx0XHR9O1xuXHRcdFx0aSA9IHN0YXJNYXAubGVuZ3RoO1xuXHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdHdpbGRjYXJkS2V5cGF0aCA9IHN0YXJNYXBbIGkgXS5tYXAoIG1hcHBlciApLmpvaW4oICcuJyApO1xuXHRcdFx0XHRpZiAoICFyZXN1bHRbIHdpbGRjYXJkS2V5cGF0aCBdICkge1xuXHRcdFx0XHRcdHJlc3VsdC5wdXNoKCB3aWxkY2FyZEtleXBhdGggKTtcblx0XHRcdFx0XHRyZXN1bHRbIHdpbGRjYXJkS2V5cGF0aCBdID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXRTdGFyTWFwKCBudW0gKSB7XG5cdFx0XHR2YXIgb25lcyA9ICcnLFxuXHRcdFx0XHRtYXgsIGJpbmFyeSwgc3Rhck1hcCwgbWFwcGVyLCBpO1xuXHRcdFx0aWYgKCAhc3Rhck1hcHNbIG51bSBdICkge1xuXHRcdFx0XHRzdGFyTWFwID0gW107XG5cdFx0XHRcdHdoaWxlICggb25lcy5sZW5ndGggPCBudW0gKSB7XG5cdFx0XHRcdFx0b25lcyArPSAxO1xuXHRcdFx0XHR9XG5cdFx0XHRcdG1heCA9IHBhcnNlSW50KCBvbmVzLCAyICk7XG5cdFx0XHRcdG1hcHBlciA9IGZ1bmN0aW9uKCBkaWdpdCApIHtcblx0XHRcdFx0XHRyZXR1cm4gZGlnaXQgPT09ICcxJztcblx0XHRcdFx0fTtcblx0XHRcdFx0Zm9yICggaSA9IDA7IGkgPD0gbWF4OyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0YmluYXJ5ID0gaS50b1N0cmluZyggMiApO1xuXHRcdFx0XHRcdHdoaWxlICggYmluYXJ5Lmxlbmd0aCA8IG51bSApIHtcblx0XHRcdFx0XHRcdGJpbmFyeSA9ICcwJyArIGJpbmFyeTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0c3Rhck1hcFsgaSBdID0gQXJyYXkucHJvdG90eXBlLm1hcC5jYWxsKCBiaW5hcnksIG1hcHBlciApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHN0YXJNYXBzWyBudW0gXSA9IHN0YXJNYXA7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gc3Rhck1hcHNbIG51bSBdO1xuXHRcdH1cblx0fSgpO1xuXG5cdHZhciBzaGFyZWRfbWFrZVRyYW5zaXRpb25NYW5hZ2VyID0gZnVuY3Rpb24oIHJlbW92ZUZyb21BcnJheSApIHtcblxuXHRcdHZhciBtYWtlVHJhbnNpdGlvbk1hbmFnZXIsIGNoZWNrQ29tcGxldGUsIHJlbW92ZSwgaW5pdDtcblx0XHRtYWtlVHJhbnNpdGlvbk1hbmFnZXIgPSBmdW5jdGlvbiggY2FsbGJhY2ssIHByZXZpb3VzICkge1xuXHRcdFx0dmFyIHRyYW5zaXRpb25NYW5hZ2VyID0gW107XG5cdFx0XHR0cmFuc2l0aW9uTWFuYWdlci5kZXRhY2hRdWV1ZSA9IFtdO1xuXHRcdFx0dHJhbnNpdGlvbk1hbmFnZXIucmVtb3ZlID0gcmVtb3ZlO1xuXHRcdFx0dHJhbnNpdGlvbk1hbmFnZXIuaW5pdCA9IGluaXQ7XG5cdFx0XHR0cmFuc2l0aW9uTWFuYWdlci5fY2hlY2sgPSBjaGVja0NvbXBsZXRlO1xuXHRcdFx0dHJhbnNpdGlvbk1hbmFnZXIuX2NhbGxiYWNrID0gY2FsbGJhY2s7XG5cdFx0XHR0cmFuc2l0aW9uTWFuYWdlci5fcHJldmlvdXMgPSBwcmV2aW91cztcblx0XHRcdGlmICggcHJldmlvdXMgKSB7XG5cdFx0XHRcdHByZXZpb3VzLnB1c2goIHRyYW5zaXRpb25NYW5hZ2VyICk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdHJhbnNpdGlvbk1hbmFnZXI7XG5cdFx0fTtcblx0XHRjaGVja0NvbXBsZXRlID0gZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgZWxlbWVudDtcblx0XHRcdGlmICggdGhpcy5fcmVhZHkgJiYgIXRoaXMubGVuZ3RoICkge1xuXHRcdFx0XHR3aGlsZSAoIGVsZW1lbnQgPSB0aGlzLmRldGFjaFF1ZXVlLnBvcCgpICkge1xuXHRcdFx0XHRcdGVsZW1lbnQuZGV0YWNoKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCB0eXBlb2YgdGhpcy5fY2FsbGJhY2sgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRcdFx0dGhpcy5fY2FsbGJhY2soKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHRoaXMuX3ByZXZpb3VzICkge1xuXHRcdFx0XHRcdHRoaXMuX3ByZXZpb3VzLnJlbW92ZSggdGhpcyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZW1vdmUgPSBmdW5jdGlvbiggdHJhbnNpdGlvbiApIHtcblx0XHRcdHJlbW92ZUZyb21BcnJheSggdGhpcywgdHJhbnNpdGlvbiApO1xuXHRcdFx0dGhpcy5fY2hlY2soKTtcblx0XHR9O1xuXHRcdGluaXQgPSBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuX3JlYWR5ID0gdHJ1ZTtcblx0XHRcdHRoaXMuX2NoZWNrKCk7XG5cdFx0fTtcblx0XHRyZXR1cm4gbWFrZVRyYW5zaXRpb25NYW5hZ2VyO1xuXHR9KCB1dGlsc19yZW1vdmVGcm9tQXJyYXkgKTtcblxuXHR2YXIgZ2xvYmFsX3J1bmxvb3AgPSBmdW5jdGlvbiggY2lyY3VsYXIsIGNzcywgcmVtb3ZlRnJvbUFycmF5LCBnZXRWYWx1ZUZyb21DaGVja2JveGVzLCByZXNvbHZlUmVmLCBnZXRVcHN0cmVhbUNoYW5nZXMsIG5vdGlmeURlcGVuZGFudHMsIG1ha2VUcmFuc2l0aW9uTWFuYWdlciApIHtcblxuXHRcdGNpcmN1bGFyLnB1c2goIGZ1bmN0aW9uKCkge1xuXHRcdFx0Z2V0ID0gY2lyY3VsYXIuZ2V0O1xuXHRcdFx0c2V0ID0gY2lyY3VsYXIuc2V0O1xuXHRcdH0gKTtcblx0XHR2YXIgcnVubG9vcCwgZ2V0LCBzZXQsIGRpcnR5ID0gZmFsc2UsXG5cdFx0XHRmbHVzaGluZyA9IGZhbHNlLFxuXHRcdFx0cGVuZGluZ0Nzc0NoYW5nZXMsIGluRmxpZ2h0ID0gMCxcblx0XHRcdHRvRm9jdXMgPSBudWxsLFxuXHRcdFx0bGl2ZVF1ZXJpZXMgPSBbXSxcblx0XHRcdGRlY29yYXRvcnMgPSBbXSxcblx0XHRcdHRyYW5zaXRpb25zID0gW10sXG5cdFx0XHRvYnNlcnZlcnMgPSBbXSxcblx0XHRcdGF0dHJpYnV0ZXMgPSBbXSxcblx0XHRcdGV2YWx1YXRvcnMgPSBbXSxcblx0XHRcdHNlbGVjdFZhbHVlcyA9IFtdLFxuXHRcdFx0Y2hlY2tib3hLZXlwYXRocyA9IHt9LCBjaGVja2JveGVzID0gW10sXG5cdFx0XHRyYWRpb3MgPSBbXSxcblx0XHRcdHVucmVzb2x2ZWQgPSBbXSxcblx0XHRcdGluc3RhbmNlcyA9IFtdLFxuXHRcdFx0dHJhbnNpdGlvbk1hbmFnZXI7XG5cdFx0cnVubG9vcCA9IHtcblx0XHRcdHN0YXJ0OiBmdW5jdGlvbiggaW5zdGFuY2UsIGNhbGxiYWNrICkge1xuXHRcdFx0XHRpZiAoIGluc3RhbmNlICYmICFpbnN0YW5jZXNbIGluc3RhbmNlLl9ndWlkIF0gKSB7XG5cdFx0XHRcdFx0aW5zdGFuY2VzLnB1c2goIGluc3RhbmNlICk7XG5cdFx0XHRcdFx0aW5zdGFuY2VzWyBpbnN0YW5jZXMuX2d1aWQgXSA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCAhZmx1c2hpbmcgKSB7XG5cdFx0XHRcdFx0aW5GbGlnaHQgKz0gMTtcblx0XHRcdFx0XHR0cmFuc2l0aW9uTWFuYWdlciA9IG1ha2VUcmFuc2l0aW9uTWFuYWdlciggY2FsbGJhY2ssIHRyYW5zaXRpb25NYW5hZ2VyICk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRlbmQ6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZiAoIGZsdXNoaW5nICkge1xuXHRcdFx0XHRcdGF0dGVtcHRLZXlwYXRoUmVzb2x1dGlvbigpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoICEtLWluRmxpZ2h0ICkge1xuXHRcdFx0XHRcdGZsdXNoaW5nID0gdHJ1ZTtcblx0XHRcdFx0XHRmbHVzaENoYW5nZXMoKTtcblx0XHRcdFx0XHRmbHVzaGluZyA9IGZhbHNlO1xuXHRcdFx0XHRcdGxhbmQoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0cmFuc2l0aW9uTWFuYWdlci5pbml0KCk7XG5cdFx0XHRcdHRyYW5zaXRpb25NYW5hZ2VyID0gdHJhbnNpdGlvbk1hbmFnZXIuX3ByZXZpb3VzO1xuXHRcdFx0fSxcblx0XHRcdHRyaWdnZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZiAoIGluRmxpZ2h0IHx8IGZsdXNoaW5nICkge1xuXHRcdFx0XHRcdGF0dGVtcHRLZXlwYXRoUmVzb2x1dGlvbigpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRmbHVzaGluZyA9IHRydWU7XG5cdFx0XHRcdGZsdXNoQ2hhbmdlcygpO1xuXHRcdFx0XHRmbHVzaGluZyA9IGZhbHNlO1xuXHRcdFx0XHRsYW5kKCk7XG5cdFx0XHR9LFxuXHRcdFx0Zm9jdXM6IGZ1bmN0aW9uKCBub2RlICkge1xuXHRcdFx0XHR0b0ZvY3VzID0gbm9kZTtcblx0XHRcdH0sXG5cdFx0XHRhZGRMaXZlUXVlcnk6IGZ1bmN0aW9uKCBxdWVyeSApIHtcblx0XHRcdFx0bGl2ZVF1ZXJpZXMucHVzaCggcXVlcnkgKTtcblx0XHRcdH0sXG5cdFx0XHRhZGREZWNvcmF0b3I6IGZ1bmN0aW9uKCBkZWNvcmF0b3IgKSB7XG5cdFx0XHRcdGRlY29yYXRvcnMucHVzaCggZGVjb3JhdG9yICk7XG5cdFx0XHR9LFxuXHRcdFx0YWRkVHJhbnNpdGlvbjogZnVuY3Rpb24oIHRyYW5zaXRpb24gKSB7XG5cdFx0XHRcdHRyYW5zaXRpb24uX21hbmFnZXIgPSB0cmFuc2l0aW9uTWFuYWdlcjtcblx0XHRcdFx0dHJhbnNpdGlvbk1hbmFnZXIucHVzaCggdHJhbnNpdGlvbiApO1xuXHRcdFx0XHR0cmFuc2l0aW9ucy5wdXNoKCB0cmFuc2l0aW9uICk7XG5cdFx0XHR9LFxuXHRcdFx0YWRkT2JzZXJ2ZXI6IGZ1bmN0aW9uKCBvYnNlcnZlciApIHtcblx0XHRcdFx0b2JzZXJ2ZXJzLnB1c2goIG9ic2VydmVyICk7XG5cdFx0XHR9LFxuXHRcdFx0YWRkQXR0cmlidXRlOiBmdW5jdGlvbiggYXR0cmlidXRlICkge1xuXHRcdFx0XHRhdHRyaWJ1dGVzLnB1c2goIGF0dHJpYnV0ZSApO1xuXHRcdFx0fSxcblx0XHRcdHNjaGVkdWxlQ3NzVXBkYXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0aWYgKCAhaW5GbGlnaHQgJiYgIWZsdXNoaW5nICkge1xuXHRcdFx0XHRcdGNzcy51cGRhdGUoKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRwZW5kaW5nQ3NzQ2hhbmdlcyA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRhZGRFdmFsdWF0b3I6IGZ1bmN0aW9uKCBldmFsdWF0b3IgKSB7XG5cdFx0XHRcdGRpcnR5ID0gdHJ1ZTtcblx0XHRcdFx0ZXZhbHVhdG9ycy5wdXNoKCBldmFsdWF0b3IgKTtcblx0XHRcdH0sXG5cdFx0XHRhZGRTZWxlY3RWYWx1ZTogZnVuY3Rpb24oIHNlbGVjdFZhbHVlICkge1xuXHRcdFx0XHRkaXJ0eSA9IHRydWU7XG5cdFx0XHRcdHNlbGVjdFZhbHVlcy5wdXNoKCBzZWxlY3RWYWx1ZSApO1xuXHRcdFx0fSxcblx0XHRcdGFkZENoZWNrYm94OiBmdW5jdGlvbiggY2hlY2tib3ggKSB7XG5cdFx0XHRcdGlmICggIWNoZWNrYm94S2V5cGF0aHNbIGNoZWNrYm94LmtleXBhdGggXSApIHtcblx0XHRcdFx0XHRkaXJ0eSA9IHRydWU7XG5cdFx0XHRcdFx0Y2hlY2tib3hlcy5wdXNoKCBjaGVja2JveCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0YWRkUmFkaW86IGZ1bmN0aW9uKCByYWRpbyApIHtcblx0XHRcdFx0ZGlydHkgPSB0cnVlO1xuXHRcdFx0XHRyYWRpb3MucHVzaCggcmFkaW8gKTtcblx0XHRcdH0sXG5cdFx0XHRhZGRVbnJlc29sdmVkOiBmdW5jdGlvbiggdGhpbmcgKSB7XG5cdFx0XHRcdGRpcnR5ID0gdHJ1ZTtcblx0XHRcdFx0dW5yZXNvbHZlZC5wdXNoKCB0aGluZyApO1xuXHRcdFx0fSxcblx0XHRcdHJlbW92ZVVucmVzb2x2ZWQ6IGZ1bmN0aW9uKCB0aGluZyApIHtcblx0XHRcdFx0cmVtb3ZlRnJvbUFycmF5KCB1bnJlc29sdmVkLCB0aGluZyApO1xuXHRcdFx0fSxcblx0XHRcdGRldGFjaFdoZW5SZWFkeTogZnVuY3Rpb24oIHRoaW5nICkge1xuXHRcdFx0XHR0cmFuc2l0aW9uTWFuYWdlci5kZXRhY2hRdWV1ZS5wdXNoKCB0aGluZyApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0Y2lyY3VsYXIucnVubG9vcCA9IHJ1bmxvb3A7XG5cdFx0cmV0dXJuIHJ1bmxvb3A7XG5cblx0XHRmdW5jdGlvbiBsYW5kKCkge1xuXHRcdFx0dmFyIHRoaW5nLCBjaGFuZ2VkS2V5cGF0aCwgY2hhbmdlSGFzaDtcblx0XHRcdGlmICggdG9Gb2N1cyApIHtcblx0XHRcdFx0dG9Gb2N1cy5mb2N1cygpO1xuXHRcdFx0XHR0b0ZvY3VzID0gbnVsbDtcblx0XHRcdH1cblx0XHRcdHdoaWxlICggdGhpbmcgPSBhdHRyaWJ1dGVzLnBvcCgpICkge1xuXHRcdFx0XHR0aGluZy51cGRhdGUoKS5kZWZlcnJlZCA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0d2hpbGUgKCB0aGluZyA9IGxpdmVRdWVyaWVzLnBvcCgpICkge1xuXHRcdFx0XHR0aGluZy5fc29ydCgpO1xuXHRcdFx0fVxuXHRcdFx0d2hpbGUgKCB0aGluZyA9IGRlY29yYXRvcnMucG9wKCkgKSB7XG5cdFx0XHRcdHRoaW5nLmluaXQoKTtcblx0XHRcdH1cblx0XHRcdHdoaWxlICggdGhpbmcgPSB0cmFuc2l0aW9ucy5wb3AoKSApIHtcblx0XHRcdFx0dGhpbmcuaW5pdCgpO1xuXHRcdFx0fVxuXHRcdFx0d2hpbGUgKCB0aGluZyA9IG9ic2VydmVycy5wb3AoKSApIHtcblx0XHRcdFx0dGhpbmcudXBkYXRlKCk7XG5cdFx0XHR9XG5cdFx0XHR3aGlsZSAoIHRoaW5nID0gaW5zdGFuY2VzLnBvcCgpICkge1xuXHRcdFx0XHRpbnN0YW5jZXNbIHRoaW5nLl9ndWlkIF0gPSBmYWxzZTtcblx0XHRcdFx0aWYgKCB0aGluZy5fY2hhbmdlcy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0Y2hhbmdlSGFzaCA9IHt9O1xuXHRcdFx0XHRcdHdoaWxlICggY2hhbmdlZEtleXBhdGggPSB0aGluZy5fY2hhbmdlcy5wb3AoKSApIHtcblx0XHRcdFx0XHRcdGNoYW5nZUhhc2hbIGNoYW5nZWRLZXlwYXRoIF0gPSBnZXQoIHRoaW5nLCBjaGFuZ2VkS2V5cGF0aCApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGluZy5maXJlKCAnY2hhbmdlJywgY2hhbmdlSGFzaCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHBlbmRpbmdDc3NDaGFuZ2VzICkge1xuXHRcdFx0XHRjc3MudXBkYXRlKCk7XG5cdFx0XHRcdHBlbmRpbmdDc3NDaGFuZ2VzID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZmx1c2hDaGFuZ2VzKCkge1xuXHRcdFx0dmFyIHRoaW5nLCB1cHN0cmVhbUNoYW5nZXMsIGk7XG5cdFx0XHRpID0gaW5zdGFuY2VzLmxlbmd0aDtcblx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHR0aGluZyA9IGluc3RhbmNlc1sgaSBdO1xuXHRcdFx0XHRpZiAoIHRoaW5nLl9jaGFuZ2VzLmxlbmd0aCApIHtcblx0XHRcdFx0XHR1cHN0cmVhbUNoYW5nZXMgPSBnZXRVcHN0cmVhbUNoYW5nZXMoIHRoaW5nLl9jaGFuZ2VzICk7XG5cdFx0XHRcdFx0bm90aWZ5RGVwZW5kYW50cy5tdWx0aXBsZSggdGhpbmcsIHVwc3RyZWFtQ2hhbmdlcywgdHJ1ZSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRhdHRlbXB0S2V5cGF0aFJlc29sdXRpb24oKTtcblx0XHRcdHdoaWxlICggZGlydHkgKSB7XG5cdFx0XHRcdGRpcnR5ID0gZmFsc2U7XG5cdFx0XHRcdHdoaWxlICggdGhpbmcgPSBldmFsdWF0b3JzLnBvcCgpICkge1xuXHRcdFx0XHRcdHRoaW5nLnVwZGF0ZSgpLmRlZmVycmVkID0gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0d2hpbGUgKCB0aGluZyA9IHNlbGVjdFZhbHVlcy5wb3AoKSApIHtcblx0XHRcdFx0XHR0aGluZy5kZWZlcnJlZFVwZGF0ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHdoaWxlICggdGhpbmcgPSBjaGVja2JveGVzLnBvcCgpICkge1xuXHRcdFx0XHRcdHNldCggdGhpbmcucm9vdCwgdGhpbmcua2V5cGF0aCwgZ2V0VmFsdWVGcm9tQ2hlY2tib3hlcyggdGhpbmcucm9vdCwgdGhpbmcua2V5cGF0aCApICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0d2hpbGUgKCB0aGluZyA9IHJhZGlvcy5wb3AoKSApIHtcblx0XHRcdFx0XHR0aGluZy51cGRhdGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGF0dGVtcHRLZXlwYXRoUmVzb2x1dGlvbigpIHtcblx0XHRcdHZhciBhcnJheSwgdGhpbmcsIGtleXBhdGg7XG5cdFx0XHRpZiAoICF1bnJlc29sdmVkLmxlbmd0aCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0YXJyYXkgPSB1bnJlc29sdmVkLnNwbGljZSggMCwgdW5yZXNvbHZlZC5sZW5ndGggKTtcblx0XHRcdHdoaWxlICggdGhpbmcgPSBhcnJheS5wb3AoKSApIHtcblx0XHRcdFx0aWYgKCB0aGluZy5rZXlwYXRoICkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGtleXBhdGggPSByZXNvbHZlUmVmKCB0aGluZy5yb290LCB0aGluZy5yZWYsIHRoaW5nLnBhcmVudEZyYWdtZW50ICk7XG5cdFx0XHRcdGlmICgga2V5cGF0aCAhPT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRcdHRoaW5nLnJlc29sdmUoIGtleXBhdGggKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR1bnJlc29sdmVkLnB1c2goIHRoaW5nICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH0oIGNpcmN1bGFyLCBnbG9iYWxfY3NzLCB1dGlsc19yZW1vdmVGcm9tQXJyYXksIHNoYXJlZF9nZXRWYWx1ZUZyb21DaGVja2JveGVzLCBzaGFyZWRfcmVzb2x2ZVJlZiwgc2hhcmVkX2dldFVwc3RyZWFtQ2hhbmdlcywgc2hhcmVkX25vdGlmeURlcGVuZGFudHMsIHNoYXJlZF9tYWtlVHJhbnNpdGlvbk1hbmFnZXIgKTtcblxuXHR2YXIgc2hhcmVkX2FuaW1hdGlvbnMgPSBmdW5jdGlvbiggckFGLCBnZXRUaW1lLCBydW5sb29wICkge1xuXG5cdFx0dmFyIHF1ZXVlID0gW107XG5cdFx0dmFyIGFuaW1hdGlvbnMgPSB7XG5cdFx0XHR0aWNrOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIGksIGFuaW1hdGlvbiwgbm93O1xuXHRcdFx0XHRub3cgPSBnZXRUaW1lKCk7XG5cdFx0XHRcdHJ1bmxvb3Auc3RhcnQoKTtcblx0XHRcdFx0Zm9yICggaSA9IDA7IGkgPCBxdWV1ZS5sZW5ndGg7IGkgKz0gMSApIHtcblx0XHRcdFx0XHRhbmltYXRpb24gPSBxdWV1ZVsgaSBdO1xuXHRcdFx0XHRcdGlmICggIWFuaW1hdGlvbi50aWNrKCBub3cgKSApIHtcblx0XHRcdFx0XHRcdHF1ZXVlLnNwbGljZSggaS0tLCAxICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJ1bmxvb3AuZW5kKCk7XG5cdFx0XHRcdGlmICggcXVldWUubGVuZ3RoICkge1xuXHRcdFx0XHRcdHJBRiggYW5pbWF0aW9ucy50aWNrICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YW5pbWF0aW9ucy5ydW5uaW5nID0gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRhZGQ6IGZ1bmN0aW9uKCBhbmltYXRpb24gKSB7XG5cdFx0XHRcdHF1ZXVlLnB1c2goIGFuaW1hdGlvbiApO1xuXHRcdFx0XHRpZiAoICFhbmltYXRpb25zLnJ1bm5pbmcgKSB7XG5cdFx0XHRcdFx0YW5pbWF0aW9ucy5ydW5uaW5nID0gdHJ1ZTtcblx0XHRcdFx0XHRyQUYoIGFuaW1hdGlvbnMudGljayApO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0YWJvcnQ6IGZ1bmN0aW9uKCBrZXlwYXRoLCByb290ICkge1xuXHRcdFx0XHR2YXIgaSA9IHF1ZXVlLmxlbmd0aCxcblx0XHRcdFx0XHRhbmltYXRpb247XG5cdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdGFuaW1hdGlvbiA9IHF1ZXVlWyBpIF07XG5cdFx0XHRcdFx0aWYgKCBhbmltYXRpb24ucm9vdCA9PT0gcm9vdCAmJiBhbmltYXRpb24ua2V5cGF0aCA9PT0ga2V5cGF0aCApIHtcblx0XHRcdFx0XHRcdGFuaW1hdGlvbi5zdG9wKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gYW5pbWF0aW9ucztcblx0fSggdXRpbHNfcmVxdWVzdEFuaW1hdGlvbkZyYW1lLCB1dGlsc19nZXRUaW1lLCBnbG9iYWxfcnVubG9vcCApO1xuXG5cdHZhciB1dGlsc19pc0FycmF5ID0gZnVuY3Rpb24oKSB7XG5cblx0XHR2YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXHRcdHJldHVybiBmdW5jdGlvbiggdGhpbmcgKSB7XG5cdFx0XHRyZXR1cm4gdG9TdHJpbmcuY2FsbCggdGhpbmcgKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcblx0XHR9O1xuXHR9KCk7XG5cblx0dmFyIHV0aWxzX2Nsb25lID0gZnVuY3Rpb24oIGlzQXJyYXkgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHNvdXJjZSApIHtcblx0XHRcdHZhciB0YXJnZXQsIGtleTtcblx0XHRcdGlmICggIXNvdXJjZSB8fCB0eXBlb2Ygc291cmNlICE9PSAnb2JqZWN0JyApIHtcblx0XHRcdFx0cmV0dXJuIHNvdXJjZTtcblx0XHRcdH1cblx0XHRcdGlmICggaXNBcnJheSggc291cmNlICkgKSB7XG5cdFx0XHRcdHJldHVybiBzb3VyY2Uuc2xpY2UoKTtcblx0XHRcdH1cblx0XHRcdHRhcmdldCA9IHt9O1xuXHRcdFx0Zm9yICgga2V5IGluIHNvdXJjZSApIHtcblx0XHRcdFx0aWYgKCBzb3VyY2UuaGFzT3duUHJvcGVydHkoIGtleSApICkge1xuXHRcdFx0XHRcdHRhcmdldFsga2V5IF0gPSBzb3VyY2VbIGtleSBdO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGFyZ2V0O1xuXHRcdH07XG5cdH0oIHV0aWxzX2lzQXJyYXkgKTtcblxuXHR2YXIgcmVnaXN0cmllc19hZGFwdG9ycyA9IHt9O1xuXG5cdHZhciBzaGFyZWRfZ2V0X2FycmF5QWRhcHRvcl9nZXRTcGxpY2VFcXVpdmFsZW50ID0gZnVuY3Rpb24oIGFycmF5LCBtZXRob2ROYW1lLCBhcmdzICkge1xuXHRcdHN3aXRjaCAoIG1ldGhvZE5hbWUgKSB7XG5cdFx0XHRjYXNlICdzcGxpY2UnOlxuXHRcdFx0XHRyZXR1cm4gYXJncztcblx0XHRcdGNhc2UgJ3NvcnQnOlxuXHRcdFx0Y2FzZSAncmV2ZXJzZSc6XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0Y2FzZSAncG9wJzpcblx0XHRcdFx0aWYgKCBhcnJheS5sZW5ndGggKSB7XG5cdFx0XHRcdFx0cmV0dXJuIFsgLTEgXTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdGNhc2UgJ3B1c2gnOlxuXHRcdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRcdGFycmF5Lmxlbmd0aCxcblx0XHRcdFx0XHQwXG5cdFx0XHRcdF0uY29uY2F0KCBhcmdzICk7XG5cdFx0XHRjYXNlICdzaGlmdCc6XG5cdFx0XHRcdHJldHVybiBbXG5cdFx0XHRcdFx0MCxcblx0XHRcdFx0XHQxXG5cdFx0XHRcdF07XG5cdFx0XHRjYXNlICd1bnNoaWZ0Jzpcblx0XHRcdFx0cmV0dXJuIFtcblx0XHRcdFx0XHQwLFxuXHRcdFx0XHRcdDBcblx0XHRcdFx0XS5jb25jYXQoIGFyZ3MgKTtcblx0XHR9XG5cdH07XG5cblx0dmFyIHNoYXJlZF9nZXRfYXJyYXlBZGFwdG9yX3N1bW1hcmlzZVNwbGljZU9wZXJhdGlvbiA9IGZ1bmN0aW9uKCBhcnJheSwgYXJncyApIHtcblx0XHR2YXIgc3RhcnQsIGFkZGVkSXRlbXMsIHJlbW92ZWRJdGVtcywgYmFsYW5jZTtcblx0XHRpZiAoICFhcmdzICkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdHN0YXJ0ID0gKyggYXJnc1sgMCBdIDwgMCA/IGFycmF5Lmxlbmd0aCArIGFyZ3NbIDAgXSA6IGFyZ3NbIDAgXSApO1xuXHRcdGFkZGVkSXRlbXMgPSBNYXRoLm1heCggMCwgYXJncy5sZW5ndGggLSAyICk7XG5cdFx0cmVtb3ZlZEl0ZW1zID0gYXJnc1sgMSBdICE9PSB1bmRlZmluZWQgPyBhcmdzWyAxIF0gOiBhcnJheS5sZW5ndGggLSBzdGFydDtcblx0XHRyZW1vdmVkSXRlbXMgPSBNYXRoLm1pbiggcmVtb3ZlZEl0ZW1zLCBhcnJheS5sZW5ndGggLSBzdGFydCApO1xuXHRcdGJhbGFuY2UgPSBhZGRlZEl0ZW1zIC0gcmVtb3ZlZEl0ZW1zO1xuXHRcdHJldHVybiB7XG5cdFx0XHRzdGFydDogc3RhcnQsXG5cdFx0XHRiYWxhbmNlOiBiYWxhbmNlLFxuXHRcdFx0YWRkZWQ6IGFkZGVkSXRlbXMsXG5cdFx0XHRyZW1vdmVkOiByZW1vdmVkSXRlbXNcblx0XHR9O1xuXHR9O1xuXG5cdHZhciBjb25maWdfdHlwZXMgPSB7XG5cdFx0VEVYVDogMSxcblx0XHRJTlRFUlBPTEFUT1I6IDIsXG5cdFx0VFJJUExFOiAzLFxuXHRcdFNFQ1RJT046IDQsXG5cdFx0SU5WRVJURUQ6IDUsXG5cdFx0Q0xPU0lORzogNixcblx0XHRFTEVNRU5UOiA3LFxuXHRcdFBBUlRJQUw6IDgsXG5cdFx0Q09NTUVOVDogOSxcblx0XHRERUxJTUNIQU5HRTogMTAsXG5cdFx0TVVTVEFDSEU6IDExLFxuXHRcdFRBRzogMTIsXG5cdFx0QVRUUklCVVRFOiAxMyxcblx0XHRDT01QT05FTlQ6IDE1LFxuXHRcdE5VTUJFUl9MSVRFUkFMOiAyMCxcblx0XHRTVFJJTkdfTElURVJBTDogMjEsXG5cdFx0QVJSQVlfTElURVJBTDogMjIsXG5cdFx0T0JKRUNUX0xJVEVSQUw6IDIzLFxuXHRcdEJPT0xFQU5fTElURVJBTDogMjQsXG5cdFx0R0xPQkFMOiAyNixcblx0XHRLRVlfVkFMVUVfUEFJUjogMjcsXG5cdFx0UkVGRVJFTkNFOiAzMCxcblx0XHRSRUZJTkVNRU5UOiAzMSxcblx0XHRNRU1CRVI6IDMyLFxuXHRcdFBSRUZJWF9PUEVSQVRPUjogMzMsXG5cdFx0QlJBQ0tFVEVEOiAzNCxcblx0XHRDT05ESVRJT05BTDogMzUsXG5cdFx0SU5GSVhfT1BFUkFUT1I6IDM2LFxuXHRcdElOVk9DQVRJT046IDQwXG5cdH07XG5cblx0dmFyIHNoYXJlZF9jbGVhckNhY2hlID0gZnVuY3Rpb24gY2xlYXJDYWNoZSggcmFjdGl2ZSwga2V5cGF0aCwgZG9udFRlYXJkb3duV3JhcHBlciApIHtcblx0XHR2YXIgY2FjaGVNYXAsIHdyYXBwZWRQcm9wZXJ0eTtcblx0XHRpZiAoICFkb250VGVhcmRvd25XcmFwcGVyICkge1xuXHRcdFx0aWYgKCB3cmFwcGVkUHJvcGVydHkgPSByYWN0aXZlLl93cmFwcGVkWyBrZXlwYXRoIF0gKSB7XG5cdFx0XHRcdGlmICggd3JhcHBlZFByb3BlcnR5LnRlYXJkb3duKCkgIT09IGZhbHNlICkge1xuXHRcdFx0XHRcdHJhY3RpdmUuX3dyYXBwZWRbIGtleXBhdGggXSA9IG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmFjdGl2ZS5fY2FjaGVbIGtleXBhdGggXSA9IHVuZGVmaW5lZDtcblx0XHRpZiAoIGNhY2hlTWFwID0gcmFjdGl2ZS5fY2FjaGVNYXBbIGtleXBhdGggXSApIHtcblx0XHRcdHdoaWxlICggY2FjaGVNYXAubGVuZ3RoICkge1xuXHRcdFx0XHRjbGVhckNhY2hlKCByYWN0aXZlLCBjYWNoZU1hcC5wb3AoKSApO1xuXHRcdFx0fVxuXHRcdH1cblx0fTtcblxuXHR2YXIgdXRpbHNfY3JlYXRlQnJhbmNoID0gZnVuY3Rpb24oKSB7XG5cblx0XHR2YXIgbnVtZXJpYyA9IC9eXFxzKlswLTldK1xccyokLztcblx0XHRyZXR1cm4gZnVuY3Rpb24oIGtleSApIHtcblx0XHRcdHJldHVybiBudW1lcmljLnRlc3QoIGtleSApID8gW10gOiB7fTtcblx0XHR9O1xuXHR9KCk7XG5cblx0dmFyIHNoYXJlZF9zZXQgPSBmdW5jdGlvbiggY2lyY3VsYXIsIGlzRXF1YWwsIGNyZWF0ZUJyYW5jaCwgY2xlYXJDYWNoZSwgbm90aWZ5RGVwZW5kYW50cyApIHtcblxuXHRcdHZhciBnZXQ7XG5cdFx0Y2lyY3VsYXIucHVzaCggZnVuY3Rpb24oKSB7XG5cdFx0XHRnZXQgPSBjaXJjdWxhci5nZXQ7XG5cdFx0fSApO1xuXG5cdFx0ZnVuY3Rpb24gc2V0KCByYWN0aXZlLCBrZXlwYXRoLCB2YWx1ZSwgc2lsZW50ICkge1xuXHRcdFx0dmFyIGtleXMsIGxhc3RLZXksIHBhcmVudEtleXBhdGgsIHBhcmVudFZhbHVlLCB3cmFwcGVyLCBldmFsdWF0b3IsIGRvbnRUZWFyZG93bldyYXBwZXI7XG5cdFx0XHRpZiAoIGlzRXF1YWwoIHJhY3RpdmUuX2NhY2hlWyBrZXlwYXRoIF0sIHZhbHVlICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHdyYXBwZXIgPSByYWN0aXZlLl93cmFwcGVkWyBrZXlwYXRoIF07XG5cdFx0XHRldmFsdWF0b3IgPSByYWN0aXZlLl9ldmFsdWF0b3JzWyBrZXlwYXRoIF07XG5cdFx0XHRpZiAoIHdyYXBwZXIgJiYgd3JhcHBlci5yZXNldCApIHtcblx0XHRcdFx0d3JhcHBlci5yZXNldCggdmFsdWUgKTtcblx0XHRcdFx0dmFsdWUgPSB3cmFwcGVyLmdldCgpO1xuXHRcdFx0XHRkb250VGVhcmRvd25XcmFwcGVyID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICggZXZhbHVhdG9yICkge1xuXHRcdFx0XHRldmFsdWF0b3IudmFsdWUgPSB2YWx1ZTtcblx0XHRcdH1cblx0XHRcdGlmICggIWV2YWx1YXRvciAmJiAoICF3cmFwcGVyIHx8ICF3cmFwcGVyLnJlc2V0ICkgKSB7XG5cdFx0XHRcdGtleXMgPSBrZXlwYXRoLnNwbGl0KCAnLicgKTtcblx0XHRcdFx0bGFzdEtleSA9IGtleXMucG9wKCk7XG5cdFx0XHRcdHBhcmVudEtleXBhdGggPSBrZXlzLmpvaW4oICcuJyApO1xuXHRcdFx0XHR3cmFwcGVyID0gcmFjdGl2ZS5fd3JhcHBlZFsgcGFyZW50S2V5cGF0aCBdO1xuXHRcdFx0XHRpZiAoIHdyYXBwZXIgJiYgd3JhcHBlci5zZXQgKSB7XG5cdFx0XHRcdFx0d3JhcHBlci5zZXQoIGxhc3RLZXksIHZhbHVlICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cGFyZW50VmFsdWUgPSB3cmFwcGVyID8gd3JhcHBlci5nZXQoKSA6IGdldCggcmFjdGl2ZSwgcGFyZW50S2V5cGF0aCApO1xuXHRcdFx0XHRcdGlmICggIXBhcmVudFZhbHVlICkge1xuXHRcdFx0XHRcdFx0cGFyZW50VmFsdWUgPSBjcmVhdGVCcmFuY2goIGxhc3RLZXkgKTtcblx0XHRcdFx0XHRcdHNldCggcmFjdGl2ZSwgcGFyZW50S2V5cGF0aCwgcGFyZW50VmFsdWUgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cGFyZW50VmFsdWVbIGxhc3RLZXkgXSA9IHZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRjbGVhckNhY2hlKCByYWN0aXZlLCBrZXlwYXRoLCBkb250VGVhcmRvd25XcmFwcGVyICk7XG5cdFx0XHRpZiAoICFzaWxlbnQgKSB7XG5cdFx0XHRcdHJhY3RpdmUuX2NoYW5nZXMucHVzaCgga2V5cGF0aCApO1xuXHRcdFx0XHRub3RpZnlEZXBlbmRhbnRzKCByYWN0aXZlLCBrZXlwYXRoICk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNpcmN1bGFyLnNldCA9IHNldDtcblx0XHRyZXR1cm4gc2V0O1xuXHR9KCBjaXJjdWxhciwgdXRpbHNfaXNFcXVhbCwgdXRpbHNfY3JlYXRlQnJhbmNoLCBzaGFyZWRfY2xlYXJDYWNoZSwgc2hhcmVkX25vdGlmeURlcGVuZGFudHMgKTtcblxuXHR2YXIgc2hhcmVkX2dldF9hcnJheUFkYXB0b3JfcHJvY2Vzc1dyYXBwZXIgPSBmdW5jdGlvbiggdHlwZXMsIGNsZWFyQ2FjaGUsIG5vdGlmeURlcGVuZGFudHMsIHNldCApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggd3JhcHBlciwgYXJyYXksIG1ldGhvZE5hbWUsIHNwbGljZVN1bW1hcnkgKSB7XG5cdFx0XHR2YXIgcm9vdCwga2V5cGF0aCwgY2xlYXJFbmQsIHVwZGF0ZURlcGVuZGFudCwgaSwgY2hhbmdlZCwgc3RhcnQsIGVuZCwgY2hpbGRLZXlwYXRoLCBsZW5ndGhVbmNoYW5nZWQ7XG5cdFx0XHRyb290ID0gd3JhcHBlci5yb290O1xuXHRcdFx0a2V5cGF0aCA9IHdyYXBwZXIua2V5cGF0aDtcblx0XHRcdHJvb3QuX2NoYW5nZXMucHVzaCgga2V5cGF0aCApO1xuXHRcdFx0aWYgKCBtZXRob2ROYW1lID09PSAnc29ydCcgfHwgbWV0aG9kTmFtZSA9PT0gJ3JldmVyc2UnICkge1xuXHRcdFx0XHRzZXQoIHJvb3QsIGtleXBhdGgsIGFycmF5ICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggIXNwbGljZVN1bW1hcnkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNsZWFyRW5kID0gIXNwbGljZVN1bW1hcnkuYmFsYW5jZSA/IHNwbGljZVN1bW1hcnkuYWRkZWQgOiBhcnJheS5sZW5ndGggLSBNYXRoLm1pbiggc3BsaWNlU3VtbWFyeS5iYWxhbmNlLCAwICk7XG5cdFx0XHRmb3IgKCBpID0gc3BsaWNlU3VtbWFyeS5zdGFydDsgaSA8IGNsZWFyRW5kOyBpICs9IDEgKSB7XG5cdFx0XHRcdGNsZWFyQ2FjaGUoIHJvb3QsIGtleXBhdGggKyAnLicgKyBpICk7XG5cdFx0XHR9XG5cdFx0XHR1cGRhdGVEZXBlbmRhbnQgPSBmdW5jdGlvbiggZGVwZW5kYW50ICkge1xuXHRcdFx0XHRpZiAoIGRlcGVuZGFudC5rZXlwYXRoID09PSBrZXlwYXRoICYmIGRlcGVuZGFudC50eXBlID09PSB0eXBlcy5TRUNUSU9OICYmICFkZXBlbmRhbnQuaW52ZXJ0ZWQgJiYgZGVwZW5kYW50LmRvY0ZyYWcgKSB7XG5cdFx0XHRcdFx0ZGVwZW5kYW50LnNwbGljZSggc3BsaWNlU3VtbWFyeSApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGRlcGVuZGFudC51cGRhdGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHRcdHJvb3QuX2RlcHMuZm9yRWFjaCggZnVuY3Rpb24oIGRlcHNCeUtleXBhdGggKSB7XG5cdFx0XHRcdHZhciBkZXBlbmRhbnRzID0gZGVwc0J5S2V5cGF0aFsga2V5cGF0aCBdO1xuXHRcdFx0XHRpZiAoIGRlcGVuZGFudHMgKSB7XG5cdFx0XHRcdFx0ZGVwZW5kYW50cy5mb3JFYWNoKCB1cGRhdGVEZXBlbmRhbnQgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCBzcGxpY2VTdW1tYXJ5LmFkZGVkICYmIHNwbGljZVN1bW1hcnkucmVtb3ZlZCApIHtcblx0XHRcdFx0Y2hhbmdlZCA9IE1hdGgubWF4KCBzcGxpY2VTdW1tYXJ5LmFkZGVkLCBzcGxpY2VTdW1tYXJ5LnJlbW92ZWQgKTtcblx0XHRcdFx0c3RhcnQgPSBzcGxpY2VTdW1tYXJ5LnN0YXJ0O1xuXHRcdFx0XHRlbmQgPSBzdGFydCArIGNoYW5nZWQ7XG5cdFx0XHRcdGxlbmd0aFVuY2hhbmdlZCA9IHNwbGljZVN1bW1hcnkuYWRkZWQgPT09IHNwbGljZVN1bW1hcnkucmVtb3ZlZDtcblx0XHRcdFx0Zm9yICggaSA9IHN0YXJ0OyBpIDwgZW5kOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0Y2hpbGRLZXlwYXRoID0ga2V5cGF0aCArICcuJyArIGk7XG5cdFx0XHRcdFx0bm90aWZ5RGVwZW5kYW50cyggcm9vdCwgY2hpbGRLZXlwYXRoICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICggIWxlbmd0aFVuY2hhbmdlZCApIHtcblx0XHRcdFx0Y2xlYXJDYWNoZSggcm9vdCwga2V5cGF0aCArICcubGVuZ3RoJyApO1xuXHRcdFx0XHRub3RpZnlEZXBlbmRhbnRzKCByb290LCBrZXlwYXRoICsgJy5sZW5ndGgnLCB0cnVlICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fSggY29uZmlnX3R5cGVzLCBzaGFyZWRfY2xlYXJDYWNoZSwgc2hhcmVkX25vdGlmeURlcGVuZGFudHMsIHNoYXJlZF9zZXQgKTtcblxuXHR2YXIgc2hhcmVkX2dldF9hcnJheUFkYXB0b3JfcGF0Y2ggPSBmdW5jdGlvbiggcnVubG9vcCwgZGVmaW5lUHJvcGVydHksIGdldFNwbGljZUVxdWl2YWxlbnQsIHN1bW1hcmlzZVNwbGljZU9wZXJhdGlvbiwgcHJvY2Vzc1dyYXBwZXIgKSB7XG5cblx0XHR2YXIgcGF0Y2hlZEFycmF5UHJvdG8gPSBbXSxcblx0XHRcdG11dGF0b3JNZXRob2RzID0gW1xuXHRcdFx0XHQncG9wJyxcblx0XHRcdFx0J3B1c2gnLFxuXHRcdFx0XHQncmV2ZXJzZScsXG5cdFx0XHRcdCdzaGlmdCcsXG5cdFx0XHRcdCdzb3J0Jyxcblx0XHRcdFx0J3NwbGljZScsXG5cdFx0XHRcdCd1bnNoaWZ0J1xuXHRcdFx0XSxcblx0XHRcdHRlc3RPYmosIHBhdGNoQXJyYXlNZXRob2RzLCB1bnBhdGNoQXJyYXlNZXRob2RzO1xuXHRcdG11dGF0b3JNZXRob2RzLmZvckVhY2goIGZ1bmN0aW9uKCBtZXRob2ROYW1lICkge1xuXHRcdFx0dmFyIG1ldGhvZCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgc3BsaWNlRXF1aXZhbGVudCwgc3BsaWNlU3VtbWFyeSwgcmVzdWx0LCB3cmFwcGVyLCBpO1xuXHRcdFx0XHRzcGxpY2VFcXVpdmFsZW50ID0gZ2V0U3BsaWNlRXF1aXZhbGVudCggdGhpcywgbWV0aG9kTmFtZSwgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoIGFyZ3VtZW50cyApICk7XG5cdFx0XHRcdHNwbGljZVN1bW1hcnkgPSBzdW1tYXJpc2VTcGxpY2VPcGVyYXRpb24oIHRoaXMsIHNwbGljZUVxdWl2YWxlbnQgKTtcblx0XHRcdFx0cmVzdWx0ID0gQXJyYXkucHJvdG90eXBlWyBtZXRob2ROYW1lIF0uYXBwbHkoIHRoaXMsIGFyZ3VtZW50cyApO1xuXHRcdFx0XHR0aGlzLl9yYWN0aXZlLnNldHRpbmcgPSB0cnVlO1xuXHRcdFx0XHRpID0gdGhpcy5fcmFjdGl2ZS53cmFwcGVycy5sZW5ndGg7XG5cdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdHdyYXBwZXIgPSB0aGlzLl9yYWN0aXZlLndyYXBwZXJzWyBpIF07XG5cdFx0XHRcdFx0cnVubG9vcC5zdGFydCggd3JhcHBlci5yb290ICk7XG5cdFx0XHRcdFx0cHJvY2Vzc1dyYXBwZXIoIHdyYXBwZXIsIHRoaXMsIG1ldGhvZE5hbWUsIHNwbGljZVN1bW1hcnkgKTtcblx0XHRcdFx0XHRydW5sb29wLmVuZCgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX3JhY3RpdmUuc2V0dGluZyA9IGZhbHNlO1xuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0fTtcblx0XHRcdGRlZmluZVByb3BlcnR5KCBwYXRjaGVkQXJyYXlQcm90bywgbWV0aG9kTmFtZSwge1xuXHRcdFx0XHR2YWx1ZTogbWV0aG9kXG5cdFx0XHR9ICk7XG5cdFx0fSApO1xuXHRcdHRlc3RPYmogPSB7fTtcblx0XHRpZiAoIHRlc3RPYmouX19wcm90b19fICkge1xuXHRcdFx0cGF0Y2hBcnJheU1ldGhvZHMgPSBmdW5jdGlvbiggYXJyYXkgKSB7XG5cdFx0XHRcdGFycmF5Ll9fcHJvdG9fXyA9IHBhdGNoZWRBcnJheVByb3RvO1xuXHRcdFx0fTtcblx0XHRcdHVucGF0Y2hBcnJheU1ldGhvZHMgPSBmdW5jdGlvbiggYXJyYXkgKSB7XG5cdFx0XHRcdGFycmF5Ll9fcHJvdG9fXyA9IEFycmF5LnByb3RvdHlwZTtcblx0XHRcdH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdHBhdGNoQXJyYXlNZXRob2RzID0gZnVuY3Rpb24oIGFycmF5ICkge1xuXHRcdFx0XHR2YXIgaSwgbWV0aG9kTmFtZTtcblx0XHRcdFx0aSA9IG11dGF0b3JNZXRob2RzLmxlbmd0aDtcblx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0bWV0aG9kTmFtZSA9IG11dGF0b3JNZXRob2RzWyBpIF07XG5cdFx0XHRcdFx0ZGVmaW5lUHJvcGVydHkoIGFycmF5LCBtZXRob2ROYW1lLCB7XG5cdFx0XHRcdFx0XHR2YWx1ZTogcGF0Y2hlZEFycmF5UHJvdG9bIG1ldGhvZE5hbWUgXSxcblx0XHRcdFx0XHRcdGNvbmZpZ3VyYWJsZTogdHJ1ZVxuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHRcdHVucGF0Y2hBcnJheU1ldGhvZHMgPSBmdW5jdGlvbiggYXJyYXkgKSB7XG5cdFx0XHRcdHZhciBpO1xuXHRcdFx0XHRpID0gbXV0YXRvck1ldGhvZHMubGVuZ3RoO1xuXHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRkZWxldGUgYXJyYXlbIG11dGF0b3JNZXRob2RzWyBpIF0gXTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHR9XG5cdFx0cGF0Y2hBcnJheU1ldGhvZHMudW5wYXRjaCA9IHVucGF0Y2hBcnJheU1ldGhvZHM7XG5cdFx0cmV0dXJuIHBhdGNoQXJyYXlNZXRob2RzO1xuXHR9KCBnbG9iYWxfcnVubG9vcCwgdXRpbHNfZGVmaW5lUHJvcGVydHksIHNoYXJlZF9nZXRfYXJyYXlBZGFwdG9yX2dldFNwbGljZUVxdWl2YWxlbnQsIHNoYXJlZF9nZXRfYXJyYXlBZGFwdG9yX3N1bW1hcmlzZVNwbGljZU9wZXJhdGlvbiwgc2hhcmVkX2dldF9hcnJheUFkYXB0b3JfcHJvY2Vzc1dyYXBwZXIgKTtcblxuXHR2YXIgc2hhcmVkX2dldF9hcnJheUFkYXB0b3JfX2FycmF5QWRhcHRvciA9IGZ1bmN0aW9uKCBkZWZpbmVQcm9wZXJ0eSwgaXNBcnJheSwgcGF0Y2ggKSB7XG5cblx0XHR2YXIgYXJyYXlBZGFwdG9yLCBBcnJheVdyYXBwZXIsIGVycm9yTWVzc2FnZTtcblx0XHRhcnJheUFkYXB0b3IgPSB7XG5cdFx0XHRmaWx0ZXI6IGZ1bmN0aW9uKCBvYmplY3QgKSB7XG5cdFx0XHRcdHJldHVybiBpc0FycmF5KCBvYmplY3QgKSAmJiAoICFvYmplY3QuX3JhY3RpdmUgfHwgIW9iamVjdC5fcmFjdGl2ZS5zZXR0aW5nICk7XG5cdFx0XHR9LFxuXHRcdFx0d3JhcDogZnVuY3Rpb24oIHJhY3RpdmUsIGFycmF5LCBrZXlwYXRoICkge1xuXHRcdFx0XHRyZXR1cm4gbmV3IEFycmF5V3JhcHBlciggcmFjdGl2ZSwgYXJyYXksIGtleXBhdGggKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdEFycmF5V3JhcHBlciA9IGZ1bmN0aW9uKCByYWN0aXZlLCBhcnJheSwga2V5cGF0aCApIHtcblx0XHRcdHRoaXMucm9vdCA9IHJhY3RpdmU7XG5cdFx0XHR0aGlzLnZhbHVlID0gYXJyYXk7XG5cdFx0XHR0aGlzLmtleXBhdGggPSBrZXlwYXRoO1xuXHRcdFx0aWYgKCAhYXJyYXkuX3JhY3RpdmUgKSB7XG5cdFx0XHRcdGRlZmluZVByb3BlcnR5KCBhcnJheSwgJ19yYWN0aXZlJywge1xuXHRcdFx0XHRcdHZhbHVlOiB7XG5cdFx0XHRcdFx0XHR3cmFwcGVyczogW10sXG5cdFx0XHRcdFx0XHRpbnN0YW5jZXM6IFtdLFxuXHRcdFx0XHRcdFx0c2V0dGluZzogZmFsc2Vcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGNvbmZpZ3VyYWJsZTogdHJ1ZVxuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdHBhdGNoKCBhcnJheSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhYXJyYXkuX3JhY3RpdmUuaW5zdGFuY2VzWyByYWN0aXZlLl9ndWlkIF0gKSB7XG5cdFx0XHRcdGFycmF5Ll9yYWN0aXZlLmluc3RhbmNlc1sgcmFjdGl2ZS5fZ3VpZCBdID0gMDtcblx0XHRcdFx0YXJyYXkuX3JhY3RpdmUuaW5zdGFuY2VzLnB1c2goIHJhY3RpdmUgKTtcblx0XHRcdH1cblx0XHRcdGFycmF5Ll9yYWN0aXZlLmluc3RhbmNlc1sgcmFjdGl2ZS5fZ3VpZCBdICs9IDE7XG5cdFx0XHRhcnJheS5fcmFjdGl2ZS53cmFwcGVycy5wdXNoKCB0aGlzICk7XG5cdFx0fTtcblx0XHRBcnJheVdyYXBwZXIucHJvdG90eXBlID0ge1xuXHRcdFx0Z2V0OiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMudmFsdWU7XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgYXJyYXksIHN0b3JhZ2UsIHdyYXBwZXJzLCBpbnN0YW5jZXMsIGluZGV4O1xuXHRcdFx0XHRhcnJheSA9IHRoaXMudmFsdWU7XG5cdFx0XHRcdHN0b3JhZ2UgPSBhcnJheS5fcmFjdGl2ZTtcblx0XHRcdFx0d3JhcHBlcnMgPSBzdG9yYWdlLndyYXBwZXJzO1xuXHRcdFx0XHRpbnN0YW5jZXMgPSBzdG9yYWdlLmluc3RhbmNlcztcblx0XHRcdFx0aWYgKCBzdG9yYWdlLnNldHRpbmcgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGluZGV4ID0gd3JhcHBlcnMuaW5kZXhPZiggdGhpcyApO1xuXHRcdFx0XHRpZiAoIGluZGV4ID09PSAtMSApIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoIGVycm9yTWVzc2FnZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHdyYXBwZXJzLnNwbGljZSggaW5kZXgsIDEgKTtcblx0XHRcdFx0aWYgKCAhd3JhcHBlcnMubGVuZ3RoICkge1xuXHRcdFx0XHRcdGRlbGV0ZSBhcnJheS5fcmFjdGl2ZTtcblx0XHRcdFx0XHRwYXRjaC51bnBhdGNoKCB0aGlzLnZhbHVlICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aW5zdGFuY2VzWyB0aGlzLnJvb3QuX2d1aWQgXSAtPSAxO1xuXHRcdFx0XHRcdGlmICggIWluc3RhbmNlc1sgdGhpcy5yb290Ll9ndWlkIF0gKSB7XG5cdFx0XHRcdFx0XHRpbmRleCA9IGluc3RhbmNlcy5pbmRleE9mKCB0aGlzLnJvb3QgKTtcblx0XHRcdFx0XHRcdGlmICggaW5kZXggPT09IC0xICkge1xuXHRcdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoIGVycm9yTWVzc2FnZSApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aW5zdGFuY2VzLnNwbGljZSggaW5kZXgsIDEgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHRcdGVycm9yTWVzc2FnZSA9ICdTb21ldGhpbmcgd2VudCB3cm9uZyBpbiBhIHJhdGhlciBpbnRlcmVzdGluZyB3YXknO1xuXHRcdHJldHVybiBhcnJheUFkYXB0b3I7XG5cdH0oIHV0aWxzX2RlZmluZVByb3BlcnR5LCB1dGlsc19pc0FycmF5LCBzaGFyZWRfZ2V0X2FycmF5QWRhcHRvcl9wYXRjaCApO1xuXG5cdHZhciBzaGFyZWRfZ2V0X21hZ2ljQWRhcHRvciA9IGZ1bmN0aW9uKCBydW5sb29wLCBjcmVhdGVCcmFuY2gsIGlzQXJyYXksIGNsZWFyQ2FjaGUsIG5vdGlmeURlcGVuZGFudHMgKSB7XG5cblx0XHR2YXIgbWFnaWNBZGFwdG9yLCBNYWdpY1dyYXBwZXI7XG5cdFx0dHJ5IHtcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eSgge30sICd0ZXN0Jywge1xuXHRcdFx0XHR2YWx1ZTogMFxuXHRcdFx0fSApO1xuXHRcdH0gY2F0Y2ggKCBlcnIgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdG1hZ2ljQWRhcHRvciA9IHtcblx0XHRcdGZpbHRlcjogZnVuY3Rpb24oIG9iamVjdCwga2V5cGF0aCwgcmFjdGl2ZSApIHtcblx0XHRcdFx0dmFyIGtleXMsIGtleSwgcGFyZW50S2V5cGF0aCwgcGFyZW50V3JhcHBlciwgcGFyZW50VmFsdWU7XG5cdFx0XHRcdGlmICggIWtleXBhdGggKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGtleXMgPSBrZXlwYXRoLnNwbGl0KCAnLicgKTtcblx0XHRcdFx0a2V5ID0ga2V5cy5wb3AoKTtcblx0XHRcdFx0cGFyZW50S2V5cGF0aCA9IGtleXMuam9pbiggJy4nICk7XG5cdFx0XHRcdGlmICggKCBwYXJlbnRXcmFwcGVyID0gcmFjdGl2ZS5fd3JhcHBlZFsgcGFyZW50S2V5cGF0aCBdICkgJiYgIXBhcmVudFdyYXBwZXIubWFnaWMgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHBhcmVudFZhbHVlID0gcmFjdGl2ZS5nZXQoIHBhcmVudEtleXBhdGggKTtcblx0XHRcdFx0aWYgKCBpc0FycmF5KCBwYXJlbnRWYWx1ZSApICYmIC9eWzAtOV0rJC8udGVzdCgga2V5ICkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBwYXJlbnRWYWx1ZSAmJiAoIHR5cGVvZiBwYXJlbnRWYWx1ZSA9PT0gJ29iamVjdCcgfHwgdHlwZW9mIHBhcmVudFZhbHVlID09PSAnZnVuY3Rpb24nICk7XG5cdFx0XHR9LFxuXHRcdFx0d3JhcDogZnVuY3Rpb24oIHJhY3RpdmUsIHByb3BlcnR5LCBrZXlwYXRoICkge1xuXHRcdFx0XHRyZXR1cm4gbmV3IE1hZ2ljV3JhcHBlciggcmFjdGl2ZSwgcHJvcGVydHksIGtleXBhdGggKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdE1hZ2ljV3JhcHBlciA9IGZ1bmN0aW9uKCByYWN0aXZlLCB2YWx1ZSwga2V5cGF0aCApIHtcblx0XHRcdHZhciBrZXlzLCBvYmpLZXlwYXRoLCBkZXNjcmlwdG9yLCBzaWJsaW5ncztcblx0XHRcdHRoaXMubWFnaWMgPSB0cnVlO1xuXHRcdFx0dGhpcy5yYWN0aXZlID0gcmFjdGl2ZTtcblx0XHRcdHRoaXMua2V5cGF0aCA9IGtleXBhdGg7XG5cdFx0XHR0aGlzLnZhbHVlID0gdmFsdWU7XG5cdFx0XHRrZXlzID0ga2V5cGF0aC5zcGxpdCggJy4nICk7XG5cdFx0XHR0aGlzLnByb3AgPSBrZXlzLnBvcCgpO1xuXHRcdFx0b2JqS2V5cGF0aCA9IGtleXMuam9pbiggJy4nICk7XG5cdFx0XHR0aGlzLm9iaiA9IG9iaktleXBhdGggPyByYWN0aXZlLmdldCggb2JqS2V5cGF0aCApIDogcmFjdGl2ZS5kYXRhO1xuXHRcdFx0ZGVzY3JpcHRvciA9IHRoaXMub3JpZ2luYWxEZXNjcmlwdG9yID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvciggdGhpcy5vYmosIHRoaXMucHJvcCApO1xuXHRcdFx0aWYgKCBkZXNjcmlwdG9yICYmIGRlc2NyaXB0b3Iuc2V0ICYmICggc2libGluZ3MgPSBkZXNjcmlwdG9yLnNldC5fcmFjdGl2ZVdyYXBwZXJzICkgKSB7XG5cdFx0XHRcdGlmICggc2libGluZ3MuaW5kZXhPZiggdGhpcyApID09PSAtMSApIHtcblx0XHRcdFx0XHRzaWJsaW5ncy5wdXNoKCB0aGlzICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y3JlYXRlQWNjZXNzb3JzKCB0aGlzLCB2YWx1ZSwgZGVzY3JpcHRvciApO1xuXHRcdH07XG5cdFx0TWFnaWNXcmFwcGVyLnByb3RvdHlwZSA9IHtcblx0XHRcdGdldDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnZhbHVlO1xuXHRcdFx0fSxcblx0XHRcdHJlc2V0OiBmdW5jdGlvbiggdmFsdWUgKSB7XG5cdFx0XHRcdGlmICggdGhpcy51cGRhdGluZyApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy51cGRhdGluZyA9IHRydWU7XG5cdFx0XHRcdHRoaXMub2JqWyB0aGlzLnByb3AgXSA9IHZhbHVlO1xuXHRcdFx0XHRjbGVhckNhY2hlKCB0aGlzLnJhY3RpdmUsIHRoaXMua2V5cGF0aCApO1xuXHRcdFx0XHR0aGlzLnVwZGF0aW5nID0gZmFsc2U7XG5cdFx0XHR9LFxuXHRcdFx0c2V0OiBmdW5jdGlvbigga2V5LCB2YWx1ZSApIHtcblx0XHRcdFx0aWYgKCB0aGlzLnVwZGF0aW5nICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoICF0aGlzLm9ialsgdGhpcy5wcm9wIF0gKSB7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGluZyA9IHRydWU7XG5cdFx0XHRcdFx0dGhpcy5vYmpbIHRoaXMucHJvcCBdID0gY3JlYXRlQnJhbmNoKCBrZXkgKTtcblx0XHRcdFx0XHR0aGlzLnVwZGF0aW5nID0gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5vYmpbIHRoaXMucHJvcCBdWyBrZXkgXSA9IHZhbHVlO1xuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIGRlc2NyaXB0b3IsIHNldCwgdmFsdWUsIHdyYXBwZXJzLCBpbmRleDtcblx0XHRcdFx0aWYgKCB0aGlzLnVwZGF0aW5nICkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRkZXNjcmlwdG9yID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvciggdGhpcy5vYmosIHRoaXMucHJvcCApO1xuXHRcdFx0XHRzZXQgPSBkZXNjcmlwdG9yICYmIGRlc2NyaXB0b3Iuc2V0O1xuXHRcdFx0XHRpZiAoICFzZXQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHdyYXBwZXJzID0gc2V0Ll9yYWN0aXZlV3JhcHBlcnM7XG5cdFx0XHRcdGluZGV4ID0gd3JhcHBlcnMuaW5kZXhPZiggdGhpcyApO1xuXHRcdFx0XHRpZiAoIGluZGV4ICE9PSAtMSApIHtcblx0XHRcdFx0XHR3cmFwcGVycy5zcGxpY2UoIGluZGV4LCAxICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCAhd3JhcHBlcnMubGVuZ3RoICkge1xuXHRcdFx0XHRcdHZhbHVlID0gdGhpcy5vYmpbIHRoaXMucHJvcCBdO1xuXHRcdFx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eSggdGhpcy5vYmosIHRoaXMucHJvcCwgdGhpcy5vcmlnaW5hbERlc2NyaXB0b3IgfHwge1xuXHRcdFx0XHRcdFx0d3JpdGFibGU6IHRydWUsXG5cdFx0XHRcdFx0XHRlbnVtZXJhYmxlOiB0cnVlLFxuXHRcdFx0XHRcdFx0Y29uZmlndXJhYmxlOiB0cnVlXG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdHRoaXMub2JqWyB0aGlzLnByb3AgXSA9IHZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGZ1bmN0aW9uIGNyZWF0ZUFjY2Vzc29ycyggb3JpZ2luYWxXcmFwcGVyLCB2YWx1ZSwgZGVzY3JpcHRvciApIHtcblx0XHRcdHZhciBvYmplY3QsIHByb3BlcnR5LCBvbGRHZXQsIG9sZFNldCwgZ2V0LCBzZXQ7XG5cdFx0XHRvYmplY3QgPSBvcmlnaW5hbFdyYXBwZXIub2JqO1xuXHRcdFx0cHJvcGVydHkgPSBvcmlnaW5hbFdyYXBwZXIucHJvcDtcblx0XHRcdGlmICggZGVzY3JpcHRvciAmJiAhZGVzY3JpcHRvci5jb25maWd1cmFibGUgKSB7XG5cdFx0XHRcdGlmICggcHJvcGVydHkgPT09ICdsZW5ndGgnICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdDYW5ub3QgdXNlIG1hZ2ljIG1vZGUgd2l0aCBwcm9wZXJ0eSBcIicgKyBwcm9wZXJ0eSArICdcIiAtIG9iamVjdCBpcyBub3QgY29uZmlndXJhYmxlJyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBkZXNjcmlwdG9yICkge1xuXHRcdFx0XHRvbGRHZXQgPSBkZXNjcmlwdG9yLmdldDtcblx0XHRcdFx0b2xkU2V0ID0gZGVzY3JpcHRvci5zZXQ7XG5cdFx0XHR9XG5cdFx0XHRnZXQgPSBvbGRHZXQgfHwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHRcdH07XG5cdFx0XHRzZXQgPSBmdW5jdGlvbiggdiApIHtcblx0XHRcdFx0aWYgKCBvbGRTZXQgKSB7XG5cdFx0XHRcdFx0b2xkU2V0KCB2ICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dmFsdWUgPSBvbGRHZXQgPyBvbGRHZXQoKSA6IHY7XG5cdFx0XHRcdHNldC5fcmFjdGl2ZVdyYXBwZXJzLmZvckVhY2goIHVwZGF0ZVdyYXBwZXIgKTtcblx0XHRcdH07XG5cblx0XHRcdGZ1bmN0aW9uIHVwZGF0ZVdyYXBwZXIoIHdyYXBwZXIgKSB7XG5cdFx0XHRcdHZhciBrZXlwYXRoLCByYWN0aXZlO1xuXHRcdFx0XHR3cmFwcGVyLnZhbHVlID0gdmFsdWU7XG5cdFx0XHRcdGlmICggd3JhcHBlci51cGRhdGluZyApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0cmFjdGl2ZSA9IHdyYXBwZXIucmFjdGl2ZTtcblx0XHRcdFx0a2V5cGF0aCA9IHdyYXBwZXIua2V5cGF0aDtcblx0XHRcdFx0d3JhcHBlci51cGRhdGluZyA9IHRydWU7XG5cdFx0XHRcdHJ1bmxvb3Auc3RhcnQoIHJhY3RpdmUgKTtcblx0XHRcdFx0cmFjdGl2ZS5fY2hhbmdlcy5wdXNoKCBrZXlwYXRoICk7XG5cdFx0XHRcdGNsZWFyQ2FjaGUoIHJhY3RpdmUsIGtleXBhdGggKTtcblx0XHRcdFx0bm90aWZ5RGVwZW5kYW50cyggcmFjdGl2ZSwga2V5cGF0aCApO1xuXHRcdFx0XHRydW5sb29wLmVuZCgpO1xuXHRcdFx0XHR3cmFwcGVyLnVwZGF0aW5nID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRzZXQuX3JhY3RpdmVXcmFwcGVycyA9IFsgb3JpZ2luYWxXcmFwcGVyIF07XG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoIG9iamVjdCwgcHJvcGVydHksIHtcblx0XHRcdFx0Z2V0OiBnZXQsXG5cdFx0XHRcdHNldDogc2V0LFxuXHRcdFx0XHRlbnVtZXJhYmxlOiB0cnVlLFxuXHRcdFx0XHRjb25maWd1cmFibGU6IHRydWVcblx0XHRcdH0gKTtcblx0XHR9XG5cdFx0cmV0dXJuIG1hZ2ljQWRhcHRvcjtcblx0fSggZ2xvYmFsX3J1bmxvb3AsIHV0aWxzX2NyZWF0ZUJyYW5jaCwgdXRpbHNfaXNBcnJheSwgc2hhcmVkX2NsZWFyQ2FjaGUsIHNoYXJlZF9ub3RpZnlEZXBlbmRhbnRzICk7XG5cblx0dmFyIHNoYXJlZF9nZXRfbWFnaWNBcnJheUFkYXB0b3IgPSBmdW5jdGlvbiggbWFnaWNBZGFwdG9yLCBhcnJheUFkYXB0b3IgKSB7XG5cblx0XHRpZiAoICFtYWdpY0FkYXB0b3IgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHZhciBtYWdpY0FycmF5QWRhcHRvciwgTWFnaWNBcnJheVdyYXBwZXI7XG5cdFx0bWFnaWNBcnJheUFkYXB0b3IgPSB7XG5cdFx0XHRmaWx0ZXI6IGZ1bmN0aW9uKCBvYmplY3QsIGtleXBhdGgsIHJhY3RpdmUgKSB7XG5cdFx0XHRcdHJldHVybiBtYWdpY0FkYXB0b3IuZmlsdGVyKCBvYmplY3QsIGtleXBhdGgsIHJhY3RpdmUgKSAmJiBhcnJheUFkYXB0b3IuZmlsdGVyKCBvYmplY3QgKTtcblx0XHRcdH0sXG5cdFx0XHR3cmFwOiBmdW5jdGlvbiggcmFjdGl2ZSwgYXJyYXksIGtleXBhdGggKSB7XG5cdFx0XHRcdHJldHVybiBuZXcgTWFnaWNBcnJheVdyYXBwZXIoIHJhY3RpdmUsIGFycmF5LCBrZXlwYXRoICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRNYWdpY0FycmF5V3JhcHBlciA9IGZ1bmN0aW9uKCByYWN0aXZlLCBhcnJheSwga2V5cGF0aCApIHtcblx0XHRcdHRoaXMudmFsdWUgPSBhcnJheTtcblx0XHRcdHRoaXMubWFnaWMgPSB0cnVlO1xuXHRcdFx0dGhpcy5tYWdpY1dyYXBwZXIgPSBtYWdpY0FkYXB0b3Iud3JhcCggcmFjdGl2ZSwgYXJyYXksIGtleXBhdGggKTtcblx0XHRcdHRoaXMuYXJyYXlXcmFwcGVyID0gYXJyYXlBZGFwdG9yLndyYXAoIHJhY3RpdmUsIGFycmF5LCBrZXlwYXRoICk7XG5cdFx0fTtcblx0XHRNYWdpY0FycmF5V3JhcHBlci5wcm90b3R5cGUgPSB7XG5cdFx0XHRnZXQ6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy52YWx1ZTtcblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHRoaXMuYXJyYXlXcmFwcGVyLnRlYXJkb3duKCk7XG5cdFx0XHRcdHRoaXMubWFnaWNXcmFwcGVyLnRlYXJkb3duKCk7XG5cdFx0XHR9LFxuXHRcdFx0cmVzZXQ6IGZ1bmN0aW9uKCB2YWx1ZSApIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMubWFnaWNXcmFwcGVyLnJlc2V0KCB2YWx1ZSApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIG1hZ2ljQXJyYXlBZGFwdG9yO1xuXHR9KCBzaGFyZWRfZ2V0X21hZ2ljQWRhcHRvciwgc2hhcmVkX2dldF9hcnJheUFkYXB0b3JfX2FycmF5QWRhcHRvciApO1xuXG5cdHZhciBzaGFyZWRfYWRhcHRJZk5lY2Vzc2FyeSA9IGZ1bmN0aW9uKCBhZGFwdG9yUmVnaXN0cnksIGFycmF5QWRhcHRvciwgbWFnaWNBZGFwdG9yLCBtYWdpY0FycmF5QWRhcHRvciApIHtcblxuXHRcdHZhciBwcmVmaXhlcnMgPSB7fTtcblx0XHRyZXR1cm4gZnVuY3Rpb24gYWRhcHRJZk5lY2Vzc2FyeSggcmFjdGl2ZSwga2V5cGF0aCwgdmFsdWUsIGlzRXhwcmVzc2lvblJlc3VsdCApIHtcblx0XHRcdHZhciBsZW4sIGksIGFkYXB0b3IsIHdyYXBwZWQ7XG5cdFx0XHRsZW4gPSByYWN0aXZlLmFkYXB0Lmxlbmd0aDtcblx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdGFkYXB0b3IgPSByYWN0aXZlLmFkYXB0WyBpIF07XG5cdFx0XHRcdGlmICggdHlwZW9mIGFkYXB0b3IgPT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHRcdGlmICggIWFkYXB0b3JSZWdpc3RyeVsgYWRhcHRvciBdICkge1xuXHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnTWlzc2luZyBhZGFwdG9yIFwiJyArIGFkYXB0b3IgKyAnXCInICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGFkYXB0b3IgPSByYWN0aXZlLmFkYXB0WyBpIF0gPSBhZGFwdG9yUmVnaXN0cnlbIGFkYXB0b3IgXTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIGFkYXB0b3IuZmlsdGVyKCB2YWx1ZSwga2V5cGF0aCwgcmFjdGl2ZSApICkge1xuXHRcdFx0XHRcdHdyYXBwZWQgPSByYWN0aXZlLl93cmFwcGVkWyBrZXlwYXRoIF0gPSBhZGFwdG9yLndyYXAoIHJhY3RpdmUsIHZhbHVlLCBrZXlwYXRoLCBnZXRQcmVmaXhlcigga2V5cGF0aCApICk7XG5cdFx0XHRcdFx0d3JhcHBlZC52YWx1ZSA9IHZhbHVlO1xuXHRcdFx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCAhaXNFeHByZXNzaW9uUmVzdWx0ICkge1xuXHRcdFx0XHRpZiAoIHJhY3RpdmUubWFnaWMgKSB7XG5cdFx0XHRcdFx0aWYgKCBtYWdpY0FycmF5QWRhcHRvci5maWx0ZXIoIHZhbHVlLCBrZXlwYXRoLCByYWN0aXZlICkgKSB7XG5cdFx0XHRcdFx0XHRyYWN0aXZlLl93cmFwcGVkWyBrZXlwYXRoIF0gPSBtYWdpY0FycmF5QWRhcHRvci53cmFwKCByYWN0aXZlLCB2YWx1ZSwga2V5cGF0aCApO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoIG1hZ2ljQWRhcHRvci5maWx0ZXIoIHZhbHVlLCBrZXlwYXRoLCByYWN0aXZlICkgKSB7XG5cdFx0XHRcdFx0XHRyYWN0aXZlLl93cmFwcGVkWyBrZXlwYXRoIF0gPSBtYWdpY0FkYXB0b3Iud3JhcCggcmFjdGl2ZSwgdmFsdWUsIGtleXBhdGggKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSBpZiAoIHJhY3RpdmUubW9kaWZ5QXJyYXlzICYmIGFycmF5QWRhcHRvci5maWx0ZXIoIHZhbHVlLCBrZXlwYXRoLCByYWN0aXZlICkgKSB7XG5cdFx0XHRcdFx0cmFjdGl2ZS5fd3JhcHBlZFsga2V5cGF0aCBdID0gYXJyYXlBZGFwdG9yLndyYXAoIHJhY3RpdmUsIHZhbHVlLCBrZXlwYXRoICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHR9O1xuXG5cdFx0ZnVuY3Rpb24gcHJlZml4S2V5cGF0aCggb2JqLCBwcmVmaXggKSB7XG5cdFx0XHR2YXIgcHJlZml4ZWQgPSB7fSwga2V5O1xuXHRcdFx0aWYgKCAhcHJlZml4ICkge1xuXHRcdFx0XHRyZXR1cm4gb2JqO1xuXHRcdFx0fVxuXHRcdFx0cHJlZml4ICs9ICcuJztcblx0XHRcdGZvciAoIGtleSBpbiBvYmogKSB7XG5cdFx0XHRcdGlmICggb2JqLmhhc093blByb3BlcnR5KCBrZXkgKSApIHtcblx0XHRcdFx0XHRwcmVmaXhlZFsgcHJlZml4ICsga2V5IF0gPSBvYmpbIGtleSBdO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcHJlZml4ZWQ7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0UHJlZml4ZXIoIHJvb3RLZXlwYXRoICkge1xuXHRcdFx0dmFyIHJvb3REb3Q7XG5cdFx0XHRpZiAoICFwcmVmaXhlcnNbIHJvb3RLZXlwYXRoIF0gKSB7XG5cdFx0XHRcdHJvb3REb3QgPSByb290S2V5cGF0aCA/IHJvb3RLZXlwYXRoICsgJy4nIDogJyc7XG5cdFx0XHRcdHByZWZpeGVyc1sgcm9vdEtleXBhdGggXSA9IGZ1bmN0aW9uKCByZWxhdGl2ZUtleXBhdGgsIHZhbHVlICkge1xuXHRcdFx0XHRcdHZhciBvYmo7XG5cdFx0XHRcdFx0aWYgKCB0eXBlb2YgcmVsYXRpdmVLZXlwYXRoID09PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0XHRcdG9iaiA9IHt9O1xuXHRcdFx0XHRcdFx0b2JqWyByb290RG90ICsgcmVsYXRpdmVLZXlwYXRoIF0gPSB2YWx1ZTtcblx0XHRcdFx0XHRcdHJldHVybiBvYmo7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICggdHlwZW9mIHJlbGF0aXZlS2V5cGF0aCA9PT0gJ29iamVjdCcgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcm9vdERvdCA/IHByZWZpeEtleXBhdGgoIHJlbGF0aXZlS2V5cGF0aCwgcm9vdEtleXBhdGggKSA6IHJlbGF0aXZlS2V5cGF0aDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcHJlZml4ZXJzWyByb290S2V5cGF0aCBdO1xuXHRcdH1cblx0fSggcmVnaXN0cmllc19hZGFwdG9ycywgc2hhcmVkX2dldF9hcnJheUFkYXB0b3JfX2FycmF5QWRhcHRvciwgc2hhcmVkX2dldF9tYWdpY0FkYXB0b3IsIHNoYXJlZF9nZXRfbWFnaWNBcnJheUFkYXB0b3IgKTtcblxuXHR2YXIgc2hhcmVkX3JlZ2lzdGVyRGVwZW5kYW50ID0gZnVuY3Rpb24oKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24gcmVnaXN0ZXJEZXBlbmRhbnQoIGRlcGVuZGFudCApIHtcblx0XHRcdHZhciBkZXBzQnlLZXlwYXRoLCBkZXBzLCByYWN0aXZlLCBrZXlwYXRoLCBwcmlvcml0eTtcblx0XHRcdHJhY3RpdmUgPSBkZXBlbmRhbnQucm9vdDtcblx0XHRcdGtleXBhdGggPSBkZXBlbmRhbnQua2V5cGF0aDtcblx0XHRcdHByaW9yaXR5ID0gZGVwZW5kYW50LnByaW9yaXR5O1xuXHRcdFx0ZGVwc0J5S2V5cGF0aCA9IHJhY3RpdmUuX2RlcHNbIHByaW9yaXR5IF0gfHwgKCByYWN0aXZlLl9kZXBzWyBwcmlvcml0eSBdID0ge30gKTtcblx0XHRcdGRlcHMgPSBkZXBzQnlLZXlwYXRoWyBrZXlwYXRoIF0gfHwgKCBkZXBzQnlLZXlwYXRoWyBrZXlwYXRoIF0gPSBbXSApO1xuXHRcdFx0ZGVwcy5wdXNoKCBkZXBlbmRhbnQgKTtcblx0XHRcdGRlcGVuZGFudC5yZWdpc3RlcmVkID0gdHJ1ZTtcblx0XHRcdGlmICggIWtleXBhdGggKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHVwZGF0ZURlcGVuZGFudHNNYXAoIHJhY3RpdmUsIGtleXBhdGggKTtcblx0XHR9O1xuXG5cdFx0ZnVuY3Rpb24gdXBkYXRlRGVwZW5kYW50c01hcCggcmFjdGl2ZSwga2V5cGF0aCApIHtcblx0XHRcdHZhciBrZXlzLCBwYXJlbnRLZXlwYXRoLCBtYXA7XG5cdFx0XHRrZXlzID0ga2V5cGF0aC5zcGxpdCggJy4nICk7XG5cdFx0XHR3aGlsZSAoIGtleXMubGVuZ3RoICkge1xuXHRcdFx0XHRrZXlzLnBvcCgpO1xuXHRcdFx0XHRwYXJlbnRLZXlwYXRoID0ga2V5cy5qb2luKCAnLicgKTtcblx0XHRcdFx0bWFwID0gcmFjdGl2ZS5fZGVwc01hcFsgcGFyZW50S2V5cGF0aCBdIHx8ICggcmFjdGl2ZS5fZGVwc01hcFsgcGFyZW50S2V5cGF0aCBdID0gW10gKTtcblx0XHRcdFx0aWYgKCBtYXBbIGtleXBhdGggXSA9PT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRcdG1hcFsga2V5cGF0aCBdID0gMDtcblx0XHRcdFx0XHRtYXBbIG1hcC5sZW5ndGggXSA9IGtleXBhdGg7XG5cdFx0XHRcdH1cblx0XHRcdFx0bWFwWyBrZXlwYXRoIF0gKz0gMTtcblx0XHRcdFx0a2V5cGF0aCA9IHBhcmVudEtleXBhdGg7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KCk7XG5cblx0dmFyIHNoYXJlZF91bnJlZ2lzdGVyRGVwZW5kYW50ID0gZnVuY3Rpb24oKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24gdW5yZWdpc3RlckRlcGVuZGFudCggZGVwZW5kYW50ICkge1xuXHRcdFx0dmFyIGRlcHMsIGluZGV4LCByYWN0aXZlLCBrZXlwYXRoLCBwcmlvcml0eTtcblx0XHRcdHJhY3RpdmUgPSBkZXBlbmRhbnQucm9vdDtcblx0XHRcdGtleXBhdGggPSBkZXBlbmRhbnQua2V5cGF0aDtcblx0XHRcdHByaW9yaXR5ID0gZGVwZW5kYW50LnByaW9yaXR5O1xuXHRcdFx0ZGVwcyA9IHJhY3RpdmUuX2RlcHNbIHByaW9yaXR5IF1bIGtleXBhdGggXTtcblx0XHRcdGluZGV4ID0gZGVwcy5pbmRleE9mKCBkZXBlbmRhbnQgKTtcblx0XHRcdGlmICggaW5kZXggPT09IC0xIHx8ICFkZXBlbmRhbnQucmVnaXN0ZXJlZCApIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnQXR0ZW1wdGVkIHRvIHJlbW92ZSBhIGRlcGVuZGFudCB0aGF0IHdhcyBubyBsb25nZXIgcmVnaXN0ZXJlZCEgVGhpcyBzaG91bGQgbm90IGhhcHBlbi4gSWYgeW91IGFyZSBzZWVpbmcgdGhpcyBidWcgaW4gZGV2ZWxvcG1lbnQgcGxlYXNlIHJhaXNlIGFuIGlzc3VlIGF0IGh0dHBzOi8vZ2l0aHViLmNvbS9SYWN0aXZlSlMvUmFjdGl2ZS9pc3N1ZXMgLSB0aGFua3MnICk7XG5cdFx0XHR9XG5cdFx0XHRkZXBzLnNwbGljZSggaW5kZXgsIDEgKTtcblx0XHRcdGRlcGVuZGFudC5yZWdpc3RlcmVkID0gZmFsc2U7XG5cdFx0XHRpZiAoICFrZXlwYXRoICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR1cGRhdGVEZXBlbmRhbnRzTWFwKCByYWN0aXZlLCBrZXlwYXRoICk7XG5cdFx0fTtcblxuXHRcdGZ1bmN0aW9uIHVwZGF0ZURlcGVuZGFudHNNYXAoIHJhY3RpdmUsIGtleXBhdGggKSB7XG5cdFx0XHR2YXIga2V5cywgcGFyZW50S2V5cGF0aCwgbWFwO1xuXHRcdFx0a2V5cyA9IGtleXBhdGguc3BsaXQoICcuJyApO1xuXHRcdFx0d2hpbGUgKCBrZXlzLmxlbmd0aCApIHtcblx0XHRcdFx0a2V5cy5wb3AoKTtcblx0XHRcdFx0cGFyZW50S2V5cGF0aCA9IGtleXMuam9pbiggJy4nICk7XG5cdFx0XHRcdG1hcCA9IHJhY3RpdmUuX2RlcHNNYXBbIHBhcmVudEtleXBhdGggXTtcblx0XHRcdFx0bWFwWyBrZXlwYXRoIF0gLT0gMTtcblx0XHRcdFx0aWYgKCAhbWFwWyBrZXlwYXRoIF0gKSB7XG5cdFx0XHRcdFx0bWFwLnNwbGljZSggbWFwLmluZGV4T2YoIGtleXBhdGggKSwgMSApO1xuXHRcdFx0XHRcdG1hcFsga2V5cGF0aCBdID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGtleXBhdGggPSBwYXJlbnRLZXlwYXRoO1xuXHRcdFx0fVxuXHRcdH1cblx0fSgpO1xuXG5cdHZhciBzaGFyZWRfY3JlYXRlQ29tcG9uZW50QmluZGluZyA9IGZ1bmN0aW9uKCBjaXJjdWxhciwgaXNBcnJheSwgaXNFcXVhbCwgcmVnaXN0ZXJEZXBlbmRhbnQsIHVucmVnaXN0ZXJEZXBlbmRhbnQgKSB7XG5cblx0XHR2YXIgZ2V0LCBzZXQ7XG5cdFx0Y2lyY3VsYXIucHVzaCggZnVuY3Rpb24oKSB7XG5cdFx0XHRnZXQgPSBjaXJjdWxhci5nZXQ7XG5cdFx0XHRzZXQgPSBjaXJjdWxhci5zZXQ7XG5cdFx0fSApO1xuXHRcdHZhciBCaW5kaW5nID0gZnVuY3Rpb24oIHJhY3RpdmUsIGtleXBhdGgsIG90aGVySW5zdGFuY2UsIG90aGVyS2V5cGF0aCwgcHJpb3JpdHkgKSB7XG5cdFx0XHR0aGlzLnJvb3QgPSByYWN0aXZlO1xuXHRcdFx0dGhpcy5rZXlwYXRoID0ga2V5cGF0aDtcblx0XHRcdHRoaXMucHJpb3JpdHkgPSBwcmlvcml0eTtcblx0XHRcdHRoaXMub3RoZXJJbnN0YW5jZSA9IG90aGVySW5zdGFuY2U7XG5cdFx0XHR0aGlzLm90aGVyS2V5cGF0aCA9IG90aGVyS2V5cGF0aDtcblx0XHRcdHJlZ2lzdGVyRGVwZW5kYW50KCB0aGlzICk7XG5cdFx0XHR0aGlzLnZhbHVlID0gZ2V0KCB0aGlzLnJvb3QsIHRoaXMua2V5cGF0aCApO1xuXHRcdH07XG5cdFx0QmluZGluZy5wcm90b3R5cGUgPSB7XG5cdFx0XHR1cGRhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgdmFsdWU7XG5cdFx0XHRcdGlmICggdGhpcy51cGRhdGluZyB8fCB0aGlzLmNvdW50ZXJwYXJ0ICYmIHRoaXMuY291bnRlcnBhcnQudXBkYXRpbmcgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHZhbHVlID0gZ2V0KCB0aGlzLnJvb3QsIHRoaXMua2V5cGF0aCApO1xuXHRcdFx0XHRpZiAoIGlzQXJyYXkoIHZhbHVlICkgJiYgdmFsdWUuX3JhY3RpdmUgJiYgdmFsdWUuX3JhY3RpdmUuc2V0dGluZyApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCAhaXNFcXVhbCggdmFsdWUsIHRoaXMudmFsdWUgKSApIHtcblx0XHRcdFx0XHR0aGlzLnVwZGF0aW5nID0gdHJ1ZTtcblx0XHRcdFx0XHRzZXQoIHRoaXMub3RoZXJJbnN0YW5jZSwgdGhpcy5vdGhlcktleXBhdGgsIHZhbHVlICk7XG5cdFx0XHRcdFx0dGhpcy52YWx1ZSA9IHZhbHVlO1xuXHRcdFx0XHRcdHRoaXMudXBkYXRpbmcgPSBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dW5yZWdpc3RlckRlcGVuZGFudCggdGhpcyApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIGZ1bmN0aW9uIGNyZWF0ZUNvbXBvbmVudEJpbmRpbmcoIGNvbXBvbmVudCwgcGFyZW50SW5zdGFuY2UsIHBhcmVudEtleXBhdGgsIGNoaWxkS2V5cGF0aCApIHtcblx0XHRcdHZhciBoYXNoLCBjaGlsZEluc3RhbmNlLCBiaW5kaW5ncywgcHJpb3JpdHksIHBhcmVudFRvQ2hpbGRCaW5kaW5nLCBjaGlsZFRvUGFyZW50QmluZGluZztcblx0XHRcdGhhc2ggPSBwYXJlbnRLZXlwYXRoICsgJz0nICsgY2hpbGRLZXlwYXRoO1xuXHRcdFx0YmluZGluZ3MgPSBjb21wb25lbnQuYmluZGluZ3M7XG5cdFx0XHRpZiAoIGJpbmRpbmdzWyBoYXNoIF0gKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGJpbmRpbmdzWyBoYXNoIF0gPSB0cnVlO1xuXHRcdFx0Y2hpbGRJbnN0YW5jZSA9IGNvbXBvbmVudC5pbnN0YW5jZTtcblx0XHRcdHByaW9yaXR5ID0gY29tcG9uZW50LnBhcmVudEZyYWdtZW50LnByaW9yaXR5O1xuXHRcdFx0cGFyZW50VG9DaGlsZEJpbmRpbmcgPSBuZXcgQmluZGluZyggcGFyZW50SW5zdGFuY2UsIHBhcmVudEtleXBhdGgsIGNoaWxkSW5zdGFuY2UsIGNoaWxkS2V5cGF0aCwgcHJpb3JpdHkgKTtcblx0XHRcdGJpbmRpbmdzLnB1c2goIHBhcmVudFRvQ2hpbGRCaW5kaW5nICk7XG5cdFx0XHRpZiAoIGNoaWxkSW5zdGFuY2UudHdvd2F5ICkge1xuXHRcdFx0XHRjaGlsZFRvUGFyZW50QmluZGluZyA9IG5ldyBCaW5kaW5nKCBjaGlsZEluc3RhbmNlLCBjaGlsZEtleXBhdGgsIHBhcmVudEluc3RhbmNlLCBwYXJlbnRLZXlwYXRoLCAxICk7XG5cdFx0XHRcdGJpbmRpbmdzLnB1c2goIGNoaWxkVG9QYXJlbnRCaW5kaW5nICk7XG5cdFx0XHRcdHBhcmVudFRvQ2hpbGRCaW5kaW5nLmNvdW50ZXJwYXJ0ID0gY2hpbGRUb1BhcmVudEJpbmRpbmc7XG5cdFx0XHRcdGNoaWxkVG9QYXJlbnRCaW5kaW5nLmNvdW50ZXJwYXJ0ID0gcGFyZW50VG9DaGlsZEJpbmRpbmc7XG5cdFx0XHR9XG5cdFx0fTtcblx0fSggY2lyY3VsYXIsIHV0aWxzX2lzQXJyYXksIHV0aWxzX2lzRXF1YWwsIHNoYXJlZF9yZWdpc3RlckRlcGVuZGFudCwgc2hhcmVkX3VucmVnaXN0ZXJEZXBlbmRhbnQgKTtcblxuXHR2YXIgc2hhcmVkX2dldF9nZXRGcm9tUGFyZW50ID0gZnVuY3Rpb24oIGNpcmN1bGFyLCBjcmVhdGVDb21wb25lbnRCaW5kaW5nLCBzZXQgKSB7XG5cblx0XHR2YXIgZ2V0O1xuXHRcdGNpcmN1bGFyLnB1c2goIGZ1bmN0aW9uKCkge1xuXHRcdFx0Z2V0ID0gY2lyY3VsYXIuZ2V0O1xuXHRcdH0gKTtcblx0XHRyZXR1cm4gZnVuY3Rpb24gZ2V0RnJvbVBhcmVudCggY2hpbGQsIGtleXBhdGggKSB7XG5cdFx0XHR2YXIgcGFyZW50LCBmcmFnbWVudCwga2V5cGF0aFRvVGVzdCwgdmFsdWU7XG5cdFx0XHRwYXJlbnQgPSBjaGlsZC5fcGFyZW50O1xuXHRcdFx0ZnJhZ21lbnQgPSBjaGlsZC5jb21wb25lbnQucGFyZW50RnJhZ21lbnQ7XG5cdFx0XHRkbyB7XG5cdFx0XHRcdGlmICggIWZyYWdtZW50LmNvbnRleHQgKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0a2V5cGF0aFRvVGVzdCA9IGZyYWdtZW50LmNvbnRleHQgKyAnLicgKyBrZXlwYXRoO1xuXHRcdFx0XHR2YWx1ZSA9IGdldCggcGFyZW50LCBrZXlwYXRoVG9UZXN0ICk7XG5cdFx0XHRcdGlmICggdmFsdWUgIT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0XHRjcmVhdGVMYXRlQ29tcG9uZW50QmluZGluZyggcGFyZW50LCBjaGlsZCwga2V5cGF0aFRvVGVzdCwga2V5cGF0aCwgdmFsdWUgKTtcblx0XHRcdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0XHRcdH1cblx0XHRcdH0gd2hpbGUgKCBmcmFnbWVudCA9IGZyYWdtZW50LnBhcmVudCApO1xuXHRcdFx0dmFsdWUgPSBnZXQoIHBhcmVudCwga2V5cGF0aCApO1xuXHRcdFx0aWYgKCB2YWx1ZSAhPT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRjcmVhdGVMYXRlQ29tcG9uZW50QmluZGluZyggcGFyZW50LCBjaGlsZCwga2V5cGF0aCwga2V5cGF0aCwgdmFsdWUgKTtcblx0XHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRmdW5jdGlvbiBjcmVhdGVMYXRlQ29tcG9uZW50QmluZGluZyggcGFyZW50LCBjaGlsZCwgcGFyZW50S2V5cGF0aCwgY2hpbGRLZXlwYXRoLCB2YWx1ZSApIHtcblx0XHRcdHNldCggY2hpbGQsIGNoaWxkS2V5cGF0aCwgdmFsdWUsIHRydWUgKTtcblx0XHRcdGNyZWF0ZUNvbXBvbmVudEJpbmRpbmcoIGNoaWxkLmNvbXBvbmVudCwgcGFyZW50LCBwYXJlbnRLZXlwYXRoLCBjaGlsZEtleXBhdGggKTtcblx0XHR9XG5cdH0oIGNpcmN1bGFyLCBzaGFyZWRfY3JlYXRlQ29tcG9uZW50QmluZGluZywgc2hhcmVkX3NldCApO1xuXG5cdHZhciBzaGFyZWRfZ2V0X0ZBSUxFRF9MT09LVVAgPSB7XG5cdFx0RkFJTEVEX0xPT0tVUDogdHJ1ZVxuXHR9O1xuXG5cdHZhciBzaGFyZWRfZ2V0X19nZXQgPSBmdW5jdGlvbiggY2lyY3VsYXIsIGhhc093blByb3BlcnR5LCBjbG9uZSwgYWRhcHRJZk5lY2Vzc2FyeSwgZ2V0RnJvbVBhcmVudCwgRkFJTEVEX0xPT0tVUCApIHtcblxuXHRcdGZ1bmN0aW9uIGdldCggcmFjdGl2ZSwga2V5cGF0aCwgb3B0aW9ucyApIHtcblx0XHRcdHZhciBjYWNoZSA9IHJhY3RpdmUuX2NhY2hlLFxuXHRcdFx0XHR2YWx1ZSwgd3JhcHBlZCwgZXZhbHVhdG9yO1xuXHRcdFx0aWYgKCBjYWNoZVsga2V5cGF0aCBdID09PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdGlmICggd3JhcHBlZCA9IHJhY3RpdmUuX3dyYXBwZWRbIGtleXBhdGggXSApIHtcblx0XHRcdFx0XHR2YWx1ZSA9IHdyYXBwZWQudmFsdWU7XG5cdFx0XHRcdH0gZWxzZSBpZiAoICFrZXlwYXRoICkge1xuXHRcdFx0XHRcdGFkYXB0SWZOZWNlc3NhcnkoIHJhY3RpdmUsICcnLCByYWN0aXZlLmRhdGEgKTtcblx0XHRcdFx0XHR2YWx1ZSA9IHJhY3RpdmUuZGF0YTtcblx0XHRcdFx0fSBlbHNlIGlmICggZXZhbHVhdG9yID0gcmFjdGl2ZS5fZXZhbHVhdG9yc1sga2V5cGF0aCBdICkge1xuXHRcdFx0XHRcdHZhbHVlID0gZXZhbHVhdG9yLnZhbHVlO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHZhbHVlID0gcmV0cmlldmUoIHJhY3RpdmUsIGtleXBhdGggKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjYWNoZVsga2V5cGF0aCBdID0gdmFsdWU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR2YWx1ZSA9IGNhY2hlWyBrZXlwYXRoIF07XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHZhbHVlID09PSBGQUlMRURfTE9PS1VQICkge1xuXHRcdFx0XHRpZiAoIHJhY3RpdmUuX3BhcmVudCAmJiAhcmFjdGl2ZS5pc29sYXRlZCApIHtcblx0XHRcdFx0XHR2YWx1ZSA9IGdldEZyb21QYXJlbnQoIHJhY3RpdmUsIGtleXBhdGgsIG9wdGlvbnMgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR2YWx1ZSA9IHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCBvcHRpb25zICYmIG9wdGlvbnMuZXZhbHVhdGVXcmFwcGVkICYmICggd3JhcHBlZCA9IHJhY3RpdmUuX3dyYXBwZWRbIGtleXBhdGggXSApICkge1xuXHRcdFx0XHR2YWx1ZSA9IHdyYXBwZWQuZ2V0KCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0fVxuXHRcdGNpcmN1bGFyLmdldCA9IGdldDtcblx0XHRyZXR1cm4gZ2V0O1xuXG5cdFx0ZnVuY3Rpb24gcmV0cmlldmUoIHJhY3RpdmUsIGtleXBhdGggKSB7XG5cdFx0XHR2YXIga2V5cywga2V5LCBwYXJlbnRLZXlwYXRoLCBwYXJlbnRWYWx1ZSwgY2FjaGVNYXAsIHZhbHVlLCB3cmFwcGVkLCBzaG91bGRDbG9uZTtcblx0XHRcdGtleXMgPSBrZXlwYXRoLnNwbGl0KCAnLicgKTtcblx0XHRcdGtleSA9IGtleXMucG9wKCk7XG5cdFx0XHRwYXJlbnRLZXlwYXRoID0ga2V5cy5qb2luKCAnLicgKTtcblx0XHRcdHBhcmVudFZhbHVlID0gZ2V0KCByYWN0aXZlLCBwYXJlbnRLZXlwYXRoICk7XG5cdFx0XHRpZiAoIHdyYXBwZWQgPSByYWN0aXZlLl93cmFwcGVkWyBwYXJlbnRLZXlwYXRoIF0gKSB7XG5cdFx0XHRcdHBhcmVudFZhbHVlID0gd3JhcHBlZC5nZXQoKTtcblx0XHRcdH1cblx0XHRcdGlmICggcGFyZW50VmFsdWUgPT09IG51bGwgfHwgcGFyZW50VmFsdWUgPT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhKCBjYWNoZU1hcCA9IHJhY3RpdmUuX2NhY2hlTWFwWyBwYXJlbnRLZXlwYXRoIF0gKSApIHtcblx0XHRcdFx0cmFjdGl2ZS5fY2FjaGVNYXBbIHBhcmVudEtleXBhdGggXSA9IFsga2V5cGF0aCBdO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKCBjYWNoZU1hcC5pbmRleE9mKCBrZXlwYXRoICkgPT09IC0xICkge1xuXHRcdFx0XHRcdGNhY2hlTWFwLnB1c2goIGtleXBhdGggKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCB0eXBlb2YgcGFyZW50VmFsdWUgPT09ICdvYmplY3QnICYmICEoIGtleSBpbiBwYXJlbnRWYWx1ZSApICkge1xuXHRcdFx0XHRyZXR1cm4gcmFjdGl2ZS5fY2FjaGVbIGtleXBhdGggXSA9IEZBSUxFRF9MT09LVVA7XG5cdFx0XHR9XG5cdFx0XHRzaG91bGRDbG9uZSA9ICFoYXNPd25Qcm9wZXJ0eS5jYWxsKCBwYXJlbnRWYWx1ZSwga2V5ICk7XG5cdFx0XHR2YWx1ZSA9IHNob3VsZENsb25lID8gY2xvbmUoIHBhcmVudFZhbHVlWyBrZXkgXSApIDogcGFyZW50VmFsdWVbIGtleSBdO1xuXHRcdFx0dmFsdWUgPSBhZGFwdElmTmVjZXNzYXJ5KCByYWN0aXZlLCBrZXlwYXRoLCB2YWx1ZSwgZmFsc2UgKTtcblx0XHRcdHJhY3RpdmUuX2NhY2hlWyBrZXlwYXRoIF0gPSB2YWx1ZTtcblx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHR9XG5cdH0oIGNpcmN1bGFyLCB1dGlsc19oYXNPd25Qcm9wZXJ0eSwgdXRpbHNfY2xvbmUsIHNoYXJlZF9hZGFwdElmTmVjZXNzYXJ5LCBzaGFyZWRfZ2V0X2dldEZyb21QYXJlbnQsIHNoYXJlZF9nZXRfRkFJTEVEX0xPT0tVUCApO1xuXG5cdC8qIGdsb2JhbCBjb25zb2xlICovXG5cdHZhciB1dGlsc193YXJuID0gZnVuY3Rpb24oKSB7XG5cblx0XHRpZiAoIHR5cGVvZiBjb25zb2xlICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgY29uc29sZS53YXJuID09PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBjb25zb2xlLndhcm4uYXBwbHkgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGNvbnNvbGUud2Fybi5hcHBseSggY29uc29sZSwgYXJndW1lbnRzICk7XG5cdFx0XHR9O1xuXHRcdH1cblx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7fTtcblx0fSgpO1xuXG5cdHZhciB1dGlsc19pc09iamVjdCA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0dmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblx0XHRyZXR1cm4gZnVuY3Rpb24oIHRoaW5nICkge1xuXHRcdFx0cmV0dXJuIHR5cGVvZiB0aGluZyA9PT0gJ29iamVjdCcgJiYgdG9TdHJpbmcuY2FsbCggdGhpbmcgKSA9PT0gJ1tvYmplY3QgT2JqZWN0XSc7XG5cdFx0fTtcblx0fSgpO1xuXG5cdHZhciByZWdpc3RyaWVzX2ludGVycG9sYXRvcnMgPSBmdW5jdGlvbiggY2lyY3VsYXIsIGhhc093blByb3BlcnR5LCBpc0FycmF5LCBpc09iamVjdCwgaXNOdW1lcmljICkge1xuXG5cdFx0dmFyIGludGVycG9sYXRvcnMsIGludGVycG9sYXRlLCBjc3NMZW5ndGhQYXR0ZXJuO1xuXHRcdGNpcmN1bGFyLnB1c2goIGZ1bmN0aW9uKCkge1xuXHRcdFx0aW50ZXJwb2xhdGUgPSBjaXJjdWxhci5pbnRlcnBvbGF0ZTtcblx0XHR9ICk7XG5cdFx0Y3NzTGVuZ3RoUGF0dGVybiA9IC9eKFsrLV0/WzAtOV0rXFwuPyg/OlswLTldKyk/KShweHxlbXxleHwlfGlufGNtfG1tfHB0fHBjKSQvO1xuXHRcdGludGVycG9sYXRvcnMgPSB7XG5cdFx0XHRudW1iZXI6IGZ1bmN0aW9uKCBmcm9tLCB0byApIHtcblx0XHRcdFx0dmFyIGRlbHRhO1xuXHRcdFx0XHRpZiAoICFpc051bWVyaWMoIGZyb20gKSB8fCAhaXNOdW1lcmljKCB0byApICkge1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGZyb20gPSArZnJvbTtcblx0XHRcdFx0dG8gPSArdG87XG5cdFx0XHRcdGRlbHRhID0gdG8gLSBmcm9tO1xuXHRcdFx0XHRpZiAoICFkZWx0YSApIHtcblx0XHRcdFx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZnJvbTtcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBmdW5jdGlvbiggdCApIHtcblx0XHRcdFx0XHRyZXR1cm4gZnJvbSArIHQgKiBkZWx0YTtcblx0XHRcdFx0fTtcblx0XHRcdH0sXG5cdFx0XHRhcnJheTogZnVuY3Rpb24oIGZyb20sIHRvICkge1xuXHRcdFx0XHR2YXIgaW50ZXJtZWRpYXRlLCBpbnRlcnBvbGF0b3JzLCBsZW4sIGk7XG5cdFx0XHRcdGlmICggIWlzQXJyYXkoIGZyb20gKSB8fCAhaXNBcnJheSggdG8gKSApIHtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRpbnRlcm1lZGlhdGUgPSBbXTtcblx0XHRcdFx0aW50ZXJwb2xhdG9ycyA9IFtdO1xuXHRcdFx0XHRpID0gbGVuID0gTWF0aC5taW4oIGZyb20ubGVuZ3RoLCB0by5sZW5ndGggKTtcblx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0aW50ZXJwb2xhdG9yc1sgaSBdID0gaW50ZXJwb2xhdGUoIGZyb21bIGkgXSwgdG9bIGkgXSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGZvciAoIGkgPSBsZW47IGkgPCBmcm9tLmxlbmd0aDsgaSArPSAxICkge1xuXHRcdFx0XHRcdGludGVybWVkaWF0ZVsgaSBdID0gZnJvbVsgaSBdO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGZvciAoIGkgPSBsZW47IGkgPCB0by5sZW5ndGg7IGkgKz0gMSApIHtcblx0XHRcdFx0XHRpbnRlcm1lZGlhdGVbIGkgXSA9IHRvWyBpIF07XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCB0ICkge1xuXHRcdFx0XHRcdHZhciBpID0gbGVuO1xuXHRcdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdFx0aW50ZXJtZWRpYXRlWyBpIF0gPSBpbnRlcnBvbGF0b3JzWyBpIF0oIHQgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIGludGVybWVkaWF0ZTtcblx0XHRcdFx0fTtcblx0XHRcdH0sXG5cdFx0XHRvYmplY3Q6IGZ1bmN0aW9uKCBmcm9tLCB0byApIHtcblx0XHRcdFx0dmFyIHByb3BlcnRpZXMsIGxlbiwgaW50ZXJwb2xhdG9ycywgaW50ZXJtZWRpYXRlLCBwcm9wO1xuXHRcdFx0XHRpZiAoICFpc09iamVjdCggZnJvbSApIHx8ICFpc09iamVjdCggdG8gKSApIHtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRwcm9wZXJ0aWVzID0gW107XG5cdFx0XHRcdGludGVybWVkaWF0ZSA9IHt9O1xuXHRcdFx0XHRpbnRlcnBvbGF0b3JzID0ge307XG5cdFx0XHRcdGZvciAoIHByb3AgaW4gZnJvbSApIHtcblx0XHRcdFx0XHRpZiAoIGhhc093blByb3BlcnR5LmNhbGwoIGZyb20sIHByb3AgKSApIHtcblx0XHRcdFx0XHRcdGlmICggaGFzT3duUHJvcGVydHkuY2FsbCggdG8sIHByb3AgKSApIHtcblx0XHRcdFx0XHRcdFx0cHJvcGVydGllcy5wdXNoKCBwcm9wICk7XG5cdFx0XHRcdFx0XHRcdGludGVycG9sYXRvcnNbIHByb3AgXSA9IGludGVycG9sYXRlKCBmcm9tWyBwcm9wIF0sIHRvWyBwcm9wIF0gKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGludGVybWVkaWF0ZVsgcHJvcCBdID0gZnJvbVsgcHJvcCBdO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRmb3IgKCBwcm9wIGluIHRvICkge1xuXHRcdFx0XHRcdGlmICggaGFzT3duUHJvcGVydHkuY2FsbCggdG8sIHByb3AgKSAmJiAhaGFzT3duUHJvcGVydHkuY2FsbCggZnJvbSwgcHJvcCApICkge1xuXHRcdFx0XHRcdFx0aW50ZXJtZWRpYXRlWyBwcm9wIF0gPSB0b1sgcHJvcCBdO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRsZW4gPSBwcm9wZXJ0aWVzLmxlbmd0aDtcblx0XHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCB0ICkge1xuXHRcdFx0XHRcdHZhciBpID0gbGVuLFxuXHRcdFx0XHRcdFx0cHJvcDtcblx0XHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRcdHByb3AgPSBwcm9wZXJ0aWVzWyBpIF07XG5cdFx0XHRcdFx0XHRpbnRlcm1lZGlhdGVbIHByb3AgXSA9IGludGVycG9sYXRvcnNbIHByb3AgXSggdCApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gaW50ZXJtZWRpYXRlO1xuXHRcdFx0XHR9O1xuXHRcdFx0fSxcblx0XHRcdGNzc0xlbmd0aDogZnVuY3Rpb24oIGZyb20sIHRvICkge1xuXHRcdFx0XHR2YXIgZnJvbU1hdGNoLCB0b01hdGNoLCBmcm9tVW5pdCwgdG9Vbml0LCBmcm9tVmFsdWUsIHRvVmFsdWUsIHVuaXQsIGRlbHRhO1xuXHRcdFx0XHRpZiAoIGZyb20gIT09IDAgJiYgdHlwZW9mIGZyb20gIT09ICdzdHJpbmcnIHx8IHRvICE9PSAwICYmIHR5cGVvZiB0byAhPT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZnJvbU1hdGNoID0gY3NzTGVuZ3RoUGF0dGVybi5leGVjKCBmcm9tICk7XG5cdFx0XHRcdHRvTWF0Y2ggPSBjc3NMZW5ndGhQYXR0ZXJuLmV4ZWMoIHRvICk7XG5cdFx0XHRcdGZyb21Vbml0ID0gZnJvbU1hdGNoID8gZnJvbU1hdGNoWyAyIF0gOiAnJztcblx0XHRcdFx0dG9Vbml0ID0gdG9NYXRjaCA/IHRvTWF0Y2hbIDIgXSA6ICcnO1xuXHRcdFx0XHRpZiAoIGZyb21Vbml0ICYmIHRvVW5pdCAmJiBmcm9tVW5pdCAhPT0gdG9Vbml0ICkge1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHVuaXQgPSBmcm9tVW5pdCB8fCB0b1VuaXQ7XG5cdFx0XHRcdGZyb21WYWx1ZSA9IGZyb21NYXRjaCA/ICtmcm9tTWF0Y2hbIDEgXSA6IDA7XG5cdFx0XHRcdHRvVmFsdWUgPSB0b01hdGNoID8gK3RvTWF0Y2hbIDEgXSA6IDA7XG5cdFx0XHRcdGRlbHRhID0gdG9WYWx1ZSAtIGZyb21WYWx1ZTtcblx0XHRcdFx0aWYgKCAhZGVsdGEgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGZyb21WYWx1ZSArIHVuaXQ7XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZnVuY3Rpb24oIHQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZyb21WYWx1ZSArIHQgKiBkZWx0YSArIHVuaXQ7XG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gaW50ZXJwb2xhdG9ycztcblx0fSggY2lyY3VsYXIsIHV0aWxzX2hhc093blByb3BlcnR5LCB1dGlsc19pc0FycmF5LCB1dGlsc19pc09iamVjdCwgdXRpbHNfaXNOdW1lcmljICk7XG5cblx0dmFyIHNoYXJlZF9pbnRlcnBvbGF0ZSA9IGZ1bmN0aW9uKCBjaXJjdWxhciwgd2FybiwgaW50ZXJwb2xhdG9ycyApIHtcblxuXHRcdHZhciBpbnRlcnBvbGF0ZSA9IGZ1bmN0aW9uKCBmcm9tLCB0bywgcmFjdGl2ZSwgdHlwZSApIHtcblx0XHRcdGlmICggZnJvbSA9PT0gdG8gKSB7XG5cdFx0XHRcdHJldHVybiBzbmFwKCB0byApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0eXBlICkge1xuXHRcdFx0XHRpZiAoIHJhY3RpdmUuaW50ZXJwb2xhdG9yc1sgdHlwZSBdICkge1xuXHRcdFx0XHRcdHJldHVybiByYWN0aXZlLmludGVycG9sYXRvcnNbIHR5cGUgXSggZnJvbSwgdG8gKSB8fCBzbmFwKCB0byApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHdhcm4oICdNaXNzaW5nIFwiJyArIHR5cGUgKyAnXCIgaW50ZXJwb2xhdG9yLiBZb3UgbWF5IG5lZWQgdG8gZG93bmxvYWQgYSBwbHVnaW4gZnJvbSBbVE9ET10nICk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gaW50ZXJwb2xhdG9ycy5udW1iZXIoIGZyb20sIHRvICkgfHwgaW50ZXJwb2xhdG9ycy5hcnJheSggZnJvbSwgdG8gKSB8fCBpbnRlcnBvbGF0b3JzLm9iamVjdCggZnJvbSwgdG8gKSB8fCBpbnRlcnBvbGF0b3JzLmNzc0xlbmd0aCggZnJvbSwgdG8gKSB8fCBzbmFwKCB0byApO1xuXHRcdH07XG5cdFx0Y2lyY3VsYXIuaW50ZXJwb2xhdGUgPSBpbnRlcnBvbGF0ZTtcblx0XHRyZXR1cm4gaW50ZXJwb2xhdGU7XG5cblx0XHRmdW5jdGlvbiBzbmFwKCB0byApIHtcblx0XHRcdHJldHVybiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRvO1xuXHRcdFx0fTtcblx0XHR9XG5cdH0oIGNpcmN1bGFyLCB1dGlsc193YXJuLCByZWdpc3RyaWVzX2ludGVycG9sYXRvcnMgKTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfYW5pbWF0ZV9BbmltYXRpb24gPSBmdW5jdGlvbiggd2FybiwgcnVubG9vcCwgaW50ZXJwb2xhdGUsIHNldCApIHtcblxuXHRcdHZhciBBbmltYXRpb24gPSBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdHZhciBrZXk7XG5cdFx0XHR0aGlzLnN0YXJ0VGltZSA9IERhdGUubm93KCk7XG5cdFx0XHRmb3IgKCBrZXkgaW4gb3B0aW9ucyApIHtcblx0XHRcdFx0aWYgKCBvcHRpb25zLmhhc093blByb3BlcnR5KCBrZXkgKSApIHtcblx0XHRcdFx0XHR0aGlzWyBrZXkgXSA9IG9wdGlvbnNbIGtleSBdO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmludGVycG9sYXRvciA9IGludGVycG9sYXRlKCB0aGlzLmZyb20sIHRoaXMudG8sIHRoaXMucm9vdCwgdGhpcy5pbnRlcnBvbGF0b3IgKTtcblx0XHRcdHRoaXMucnVubmluZyA9IHRydWU7XG5cdFx0fTtcblx0XHRBbmltYXRpb24ucHJvdG90eXBlID0ge1xuXHRcdFx0dGljazogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBlbGFwc2VkLCB0LCB2YWx1ZSwgdGltZU5vdywgaW5kZXgsIGtleXBhdGg7XG5cdFx0XHRcdGtleXBhdGggPSB0aGlzLmtleXBhdGg7XG5cdFx0XHRcdGlmICggdGhpcy5ydW5uaW5nICkge1xuXHRcdFx0XHRcdHRpbWVOb3cgPSBEYXRlLm5vdygpO1xuXHRcdFx0XHRcdGVsYXBzZWQgPSB0aW1lTm93IC0gdGhpcy5zdGFydFRpbWU7XG5cdFx0XHRcdFx0aWYgKCBlbGFwc2VkID49IHRoaXMuZHVyYXRpb24gKSB7XG5cdFx0XHRcdFx0XHRpZiAoIGtleXBhdGggIT09IG51bGwgKSB7XG5cdFx0XHRcdFx0XHRcdHJ1bmxvb3Auc3RhcnQoIHRoaXMucm9vdCApO1xuXHRcdFx0XHRcdFx0XHRzZXQoIHRoaXMucm9vdCwga2V5cGF0aCwgdGhpcy50byApO1xuXHRcdFx0XHRcdFx0XHRydW5sb29wLmVuZCgpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKCB0aGlzLnN0ZXAgKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuc3RlcCggMSwgdGhpcy50byApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0dGhpcy5jb21wbGV0ZSggdGhpcy50byApO1xuXHRcdFx0XHRcdFx0aW5kZXggPSB0aGlzLnJvb3QuX2FuaW1hdGlvbnMuaW5kZXhPZiggdGhpcyApO1xuXHRcdFx0XHRcdFx0aWYgKCBpbmRleCA9PT0gLTEgKSB7XG5cdFx0XHRcdFx0XHRcdHdhcm4oICdBbmltYXRpb24gd2FzIG5vdCBmb3VuZCcgKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHRoaXMucm9vdC5fYW5pbWF0aW9ucy5zcGxpY2UoIGluZGV4LCAxICk7XG5cdFx0XHRcdFx0XHR0aGlzLnJ1bm5pbmcgPSBmYWxzZTtcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dCA9IHRoaXMuZWFzaW5nID8gdGhpcy5lYXNpbmcoIGVsYXBzZWQgLyB0aGlzLmR1cmF0aW9uICkgOiBlbGFwc2VkIC8gdGhpcy5kdXJhdGlvbjtcblx0XHRcdFx0XHRpZiAoIGtleXBhdGggIT09IG51bGwgKSB7XG5cdFx0XHRcdFx0XHR2YWx1ZSA9IHRoaXMuaW50ZXJwb2xhdG9yKCB0ICk7XG5cdFx0XHRcdFx0XHRydW5sb29wLnN0YXJ0KCB0aGlzLnJvb3QgKTtcblx0XHRcdFx0XHRcdHNldCggdGhpcy5yb290LCBrZXlwYXRoLCB2YWx1ZSApO1xuXHRcdFx0XHRcdFx0cnVubG9vcC5lbmQoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCB0aGlzLnN0ZXAgKSB7XG5cdFx0XHRcdFx0XHR0aGlzLnN0ZXAoIHQsIHZhbHVlICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH0sXG5cdFx0XHRzdG9wOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIGluZGV4O1xuXHRcdFx0XHR0aGlzLnJ1bm5pbmcgPSBmYWxzZTtcblx0XHRcdFx0aW5kZXggPSB0aGlzLnJvb3QuX2FuaW1hdGlvbnMuaW5kZXhPZiggdGhpcyApO1xuXHRcdFx0XHRpZiAoIGluZGV4ID09PSAtMSApIHtcblx0XHRcdFx0XHR3YXJuKCAnQW5pbWF0aW9uIHdhcyBub3QgZm91bmQnICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5yb290Ll9hbmltYXRpb25zLnNwbGljZSggaW5kZXgsIDEgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBBbmltYXRpb247XG5cdH0oIHV0aWxzX3dhcm4sIGdsb2JhbF9ydW5sb29wLCBzaGFyZWRfaW50ZXJwb2xhdGUsIHNoYXJlZF9zZXQgKTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfYW5pbWF0ZV9fYW5pbWF0ZSA9IGZ1bmN0aW9uKCBpc0VxdWFsLCBQcm9taXNlLCBub3JtYWxpc2VLZXlwYXRoLCBhbmltYXRpb25zLCBnZXQsIEFuaW1hdGlvbiApIHtcblxuXHRcdHZhciBub29wID0gZnVuY3Rpb24oKSB7fSwgbm9BbmltYXRpb24gPSB7XG5cdFx0XHRcdHN0b3A6IG5vb3Bcblx0XHRcdH07XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBrZXlwYXRoLCB0bywgb3B0aW9ucyApIHtcblx0XHRcdHZhciBwcm9taXNlLCBmdWxmaWxQcm9taXNlLCBrLCBhbmltYXRpb24sIGFuaW1hdGlvbnMsIGVhc2luZywgZHVyYXRpb24sIHN0ZXAsIGNvbXBsZXRlLCBtYWtlVmFsdWVDb2xsZWN0b3IsIGN1cnJlbnRWYWx1ZXMsIGNvbGxlY3RWYWx1ZSwgZHVtbXksIGR1bW15T3B0aW9ucztcblx0XHRcdHByb21pc2UgPSBuZXcgUHJvbWlzZSggZnVuY3Rpb24oIGZ1bGZpbCApIHtcblx0XHRcdFx0ZnVsZmlsUHJvbWlzZSA9IGZ1bGZpbDtcblx0XHRcdH0gKTtcblx0XHRcdGlmICggdHlwZW9mIGtleXBhdGggPT09ICdvYmplY3QnICkge1xuXHRcdFx0XHRvcHRpb25zID0gdG8gfHwge307XG5cdFx0XHRcdGVhc2luZyA9IG9wdGlvbnMuZWFzaW5nO1xuXHRcdFx0XHRkdXJhdGlvbiA9IG9wdGlvbnMuZHVyYXRpb247XG5cdFx0XHRcdGFuaW1hdGlvbnMgPSBbXTtcblx0XHRcdFx0c3RlcCA9IG9wdGlvbnMuc3RlcDtcblx0XHRcdFx0Y29tcGxldGUgPSBvcHRpb25zLmNvbXBsZXRlO1xuXHRcdFx0XHRpZiAoIHN0ZXAgfHwgY29tcGxldGUgKSB7XG5cdFx0XHRcdFx0Y3VycmVudFZhbHVlcyA9IHt9O1xuXHRcdFx0XHRcdG9wdGlvbnMuc3RlcCA9IG51bGw7XG5cdFx0XHRcdFx0b3B0aW9ucy5jb21wbGV0ZSA9IG51bGw7XG5cdFx0XHRcdFx0bWFrZVZhbHVlQ29sbGVjdG9yID0gZnVuY3Rpb24oIGtleXBhdGggKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZnVuY3Rpb24oIHQsIHZhbHVlICkge1xuXHRcdFx0XHRcdFx0XHRjdXJyZW50VmFsdWVzWyBrZXlwYXRoIF0gPSB2YWx1ZTtcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXHRcdFx0XHRmb3IgKCBrIGluIGtleXBhdGggKSB7XG5cdFx0XHRcdFx0aWYgKCBrZXlwYXRoLmhhc093blByb3BlcnR5KCBrICkgKSB7XG5cdFx0XHRcdFx0XHRpZiAoIHN0ZXAgfHwgY29tcGxldGUgKSB7XG5cdFx0XHRcdFx0XHRcdGNvbGxlY3RWYWx1ZSA9IG1ha2VWYWx1ZUNvbGxlY3RvciggayApO1xuXHRcdFx0XHRcdFx0XHRvcHRpb25zID0ge1xuXHRcdFx0XHRcdFx0XHRcdGVhc2luZzogZWFzaW5nLFxuXHRcdFx0XHRcdFx0XHRcdGR1cmF0aW9uOiBkdXJhdGlvblxuXHRcdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0XHRpZiAoIHN0ZXAgKSB7XG5cdFx0XHRcdFx0XHRcdFx0b3B0aW9ucy5zdGVwID0gY29sbGVjdFZhbHVlO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRvcHRpb25zLmNvbXBsZXRlID0gY29tcGxldGUgPyBjb2xsZWN0VmFsdWUgOiBub29wO1xuXHRcdFx0XHRcdFx0YW5pbWF0aW9ucy5wdXNoKCBhbmltYXRlKCB0aGlzLCBrLCBrZXlwYXRoWyBrIF0sIG9wdGlvbnMgKSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHN0ZXAgfHwgY29tcGxldGUgKSB7XG5cdFx0XHRcdFx0ZHVtbXlPcHRpb25zID0ge1xuXHRcdFx0XHRcdFx0ZWFzaW5nOiBlYXNpbmcsXG5cdFx0XHRcdFx0XHRkdXJhdGlvbjogZHVyYXRpb25cblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdGlmICggc3RlcCApIHtcblx0XHRcdFx0XHRcdGR1bW15T3B0aW9ucy5zdGVwID0gZnVuY3Rpb24oIHQgKSB7XG5cdFx0XHRcdFx0XHRcdHN0ZXAoIHQsIGN1cnJlbnRWYWx1ZXMgKTtcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICggY29tcGxldGUgKSB7XG5cdFx0XHRcdFx0XHRwcm9taXNlLnRoZW4oIGZ1bmN0aW9uKCB0ICkge1xuXHRcdFx0XHRcdFx0XHRjb21wbGV0ZSggdCwgY3VycmVudFZhbHVlcyApO1xuXHRcdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRkdW1teU9wdGlvbnMuY29tcGxldGUgPSBmdWxmaWxQcm9taXNlO1xuXHRcdFx0XHRcdGR1bW15ID0gYW5pbWF0ZSggdGhpcywgbnVsbCwgbnVsbCwgZHVtbXlPcHRpb25zICk7XG5cdFx0XHRcdFx0YW5pbWF0aW9ucy5wdXNoKCBkdW1teSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0c3RvcDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHR2YXIgYW5pbWF0aW9uO1xuXHRcdFx0XHRcdFx0d2hpbGUgKCBhbmltYXRpb24gPSBhbmltYXRpb25zLnBvcCgpICkge1xuXHRcdFx0XHRcdFx0XHRhbmltYXRpb24uc3RvcCgpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKCBkdW1teSApIHtcblx0XHRcdFx0XHRcdFx0ZHVtbXkuc3RvcCgpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHRcdG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXHRcdFx0aWYgKCBvcHRpb25zLmNvbXBsZXRlICkge1xuXHRcdFx0XHRwcm9taXNlLnRoZW4oIG9wdGlvbnMuY29tcGxldGUgKTtcblx0XHRcdH1cblx0XHRcdG9wdGlvbnMuY29tcGxldGUgPSBmdWxmaWxQcm9taXNlO1xuXHRcdFx0YW5pbWF0aW9uID0gYW5pbWF0ZSggdGhpcywga2V5cGF0aCwgdG8sIG9wdGlvbnMgKTtcblx0XHRcdHByb21pc2Uuc3RvcCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRhbmltYXRpb24uc3RvcCgpO1xuXHRcdFx0fTtcblx0XHRcdHJldHVybiBwcm9taXNlO1xuXHRcdH07XG5cblx0XHRmdW5jdGlvbiBhbmltYXRlKCByb290LCBrZXlwYXRoLCB0bywgb3B0aW9ucyApIHtcblx0XHRcdHZhciBlYXNpbmcsIGR1cmF0aW9uLCBhbmltYXRpb24sIGZyb207XG5cdFx0XHRpZiAoIGtleXBhdGggKSB7XG5cdFx0XHRcdGtleXBhdGggPSBub3JtYWxpc2VLZXlwYXRoKCBrZXlwYXRoICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGtleXBhdGggIT09IG51bGwgKSB7XG5cdFx0XHRcdGZyb20gPSBnZXQoIHJvb3QsIGtleXBhdGggKTtcblx0XHRcdH1cblx0XHRcdGFuaW1hdGlvbnMuYWJvcnQoIGtleXBhdGgsIHJvb3QgKTtcblx0XHRcdGlmICggaXNFcXVhbCggZnJvbSwgdG8gKSApIHtcblx0XHRcdFx0aWYgKCBvcHRpb25zLmNvbXBsZXRlICkge1xuXHRcdFx0XHRcdG9wdGlvbnMuY29tcGxldGUoIG9wdGlvbnMudG8gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gbm9BbmltYXRpb247XG5cdFx0XHR9XG5cdFx0XHRpZiAoIG9wdGlvbnMuZWFzaW5nICkge1xuXHRcdFx0XHRpZiAoIHR5cGVvZiBvcHRpb25zLmVhc2luZyA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdFx0XHRlYXNpbmcgPSBvcHRpb25zLmVhc2luZztcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRlYXNpbmcgPSByb290LmVhc2luZ1sgb3B0aW9ucy5lYXNpbmcgXTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHR5cGVvZiBlYXNpbmcgIT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRcdFx0ZWFzaW5nID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0ZHVyYXRpb24gPSBvcHRpb25zLmR1cmF0aW9uID09PSB1bmRlZmluZWQgPyA0MDAgOiBvcHRpb25zLmR1cmF0aW9uO1xuXHRcdFx0YW5pbWF0aW9uID0gbmV3IEFuaW1hdGlvbigge1xuXHRcdFx0XHRrZXlwYXRoOiBrZXlwYXRoLFxuXHRcdFx0XHRmcm9tOiBmcm9tLFxuXHRcdFx0XHR0bzogdG8sXG5cdFx0XHRcdHJvb3Q6IHJvb3QsXG5cdFx0XHRcdGR1cmF0aW9uOiBkdXJhdGlvbixcblx0XHRcdFx0ZWFzaW5nOiBlYXNpbmcsXG5cdFx0XHRcdGludGVycG9sYXRvcjogb3B0aW9ucy5pbnRlcnBvbGF0b3IsXG5cdFx0XHRcdHN0ZXA6IG9wdGlvbnMuc3RlcCxcblx0XHRcdFx0Y29tcGxldGU6IG9wdGlvbnMuY29tcGxldGVcblx0XHRcdH0gKTtcblx0XHRcdGFuaW1hdGlvbnMuYWRkKCBhbmltYXRpb24gKTtcblx0XHRcdHJvb3QuX2FuaW1hdGlvbnMucHVzaCggYW5pbWF0aW9uICk7XG5cdFx0XHRyZXR1cm4gYW5pbWF0aW9uO1xuXHRcdH1cblx0fSggdXRpbHNfaXNFcXVhbCwgdXRpbHNfUHJvbWlzZSwgdXRpbHNfbm9ybWFsaXNlS2V5cGF0aCwgc2hhcmVkX2FuaW1hdGlvbnMsIHNoYXJlZF9nZXRfX2dldCwgUmFjdGl2ZV9wcm90b3R5cGVfYW5pbWF0ZV9BbmltYXRpb24gKTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfZGV0YWNoID0gZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuIHRoaXMuZnJhZ21lbnQuZGV0YWNoKCk7XG5cdH07XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX2ZpbmQgPSBmdW5jdGlvbiggc2VsZWN0b3IgKSB7XG5cdFx0aWYgKCAhdGhpcy5lbCApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5mcmFnbWVudC5maW5kKCBzZWxlY3RvciApO1xuXHR9O1xuXG5cdHZhciB1dGlsc19tYXRjaGVzID0gZnVuY3Rpb24oIGlzQ2xpZW50LCB2ZW5kb3JzLCBjcmVhdGVFbGVtZW50ICkge1xuXG5cdFx0dmFyIGRpdiwgbWV0aG9kTmFtZXMsIHVucHJlZml4ZWQsIHByZWZpeGVkLCBpLCBqLCBtYWtlRnVuY3Rpb247XG5cdFx0aWYgKCAhaXNDbGllbnQgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGRpdiA9IGNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdFx0bWV0aG9kTmFtZXMgPSBbXG5cdFx0XHQnbWF0Y2hlcycsXG5cdFx0XHQnbWF0Y2hlc1NlbGVjdG9yJ1xuXHRcdF07XG5cdFx0bWFrZUZ1bmN0aW9uID0gZnVuY3Rpb24oIG1ldGhvZE5hbWUgKSB7XG5cdFx0XHRyZXR1cm4gZnVuY3Rpb24oIG5vZGUsIHNlbGVjdG9yICkge1xuXHRcdFx0XHRyZXR1cm4gbm9kZVsgbWV0aG9kTmFtZSBdKCBzZWxlY3RvciApO1xuXHRcdFx0fTtcblx0XHR9O1xuXHRcdGkgPSBtZXRob2ROYW1lcy5sZW5ndGg7XG5cdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHR1bnByZWZpeGVkID0gbWV0aG9kTmFtZXNbIGkgXTtcblx0XHRcdGlmICggZGl2WyB1bnByZWZpeGVkIF0gKSB7XG5cdFx0XHRcdHJldHVybiBtYWtlRnVuY3Rpb24oIHVucHJlZml4ZWQgKTtcblx0XHRcdH1cblx0XHRcdGogPSB2ZW5kb3JzLmxlbmd0aDtcblx0XHRcdHdoaWxlICggai0tICkge1xuXHRcdFx0XHRwcmVmaXhlZCA9IHZlbmRvcnNbIGkgXSArIHVucHJlZml4ZWQuc3Vic3RyKCAwLCAxICkudG9VcHBlckNhc2UoKSArIHVucHJlZml4ZWQuc3Vic3RyaW5nKCAxICk7XG5cdFx0XHRcdGlmICggZGl2WyBwcmVmaXhlZCBdICkge1xuXHRcdFx0XHRcdHJldHVybiBtYWtlRnVuY3Rpb24oIHByZWZpeGVkICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBub2RlLCBzZWxlY3RvciApIHtcblx0XHRcdHZhciBub2RlcywgaTtcblx0XHRcdG5vZGVzID0gKCBub2RlLnBhcmVudE5vZGUgfHwgbm9kZS5kb2N1bWVudCApLnF1ZXJ5U2VsZWN0b3JBbGwoIHNlbGVjdG9yICk7XG5cdFx0XHRpID0gbm9kZXMubGVuZ3RoO1xuXHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdGlmICggbm9kZXNbIGkgXSA9PT0gbm9kZSApIHtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH07XG5cdH0oIGNvbmZpZ19pc0NsaWVudCwgY29uZmlnX3ZlbmRvcnMsIHV0aWxzX2NyZWF0ZUVsZW1lbnQgKTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfc2hhcmVkX21ha2VRdWVyeV90ZXN0ID0gZnVuY3Rpb24oIG1hdGNoZXMgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIGl0ZW0sIG5vRGlydHkgKSB7XG5cdFx0XHR2YXIgaXRlbU1hdGNoZXMgPSB0aGlzLl9pc0NvbXBvbmVudFF1ZXJ5ID8gIXRoaXMuc2VsZWN0b3IgfHwgaXRlbS5uYW1lID09PSB0aGlzLnNlbGVjdG9yIDogbWF0Y2hlcyggaXRlbS5ub2RlLCB0aGlzLnNlbGVjdG9yICk7XG5cdFx0XHRpZiAoIGl0ZW1NYXRjaGVzICkge1xuXHRcdFx0XHR0aGlzLnB1c2goIGl0ZW0ubm9kZSB8fCBpdGVtLmluc3RhbmNlICk7XG5cdFx0XHRcdGlmICggIW5vRGlydHkgKSB7XG5cdFx0XHRcdFx0dGhpcy5fbWFrZURpcnR5KCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fTtcblx0fSggdXRpbHNfbWF0Y2hlcyApO1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9zaGFyZWRfbWFrZVF1ZXJ5X2NhbmNlbCA9IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBsaXZlUXVlcmllcywgc2VsZWN0b3IsIGluZGV4O1xuXHRcdGxpdmVRdWVyaWVzID0gdGhpcy5fcm9vdFsgdGhpcy5faXNDb21wb25lbnRRdWVyeSA/ICdsaXZlQ29tcG9uZW50UXVlcmllcycgOiAnbGl2ZVF1ZXJpZXMnIF07XG5cdFx0c2VsZWN0b3IgPSB0aGlzLnNlbGVjdG9yO1xuXHRcdGluZGV4ID0gbGl2ZVF1ZXJpZXMuaW5kZXhPZiggc2VsZWN0b3IgKTtcblx0XHRpZiAoIGluZGV4ICE9PSAtMSApIHtcblx0XHRcdGxpdmVRdWVyaWVzLnNwbGljZSggaW5kZXgsIDEgKTtcblx0XHRcdGxpdmVRdWVyaWVzWyBzZWxlY3RvciBdID0gbnVsbDtcblx0XHR9XG5cdH07XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX3NoYXJlZF9tYWtlUXVlcnlfc29ydEJ5SXRlbVBvc2l0aW9uID0gZnVuY3Rpb24oKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIGEsIGIgKSB7XG5cdFx0XHR2YXIgYW5jZXN0cnlBLCBhbmNlc3RyeUIsIG9sZGVzdEEsIG9sZGVzdEIsIG11dHVhbEFuY2VzdG9yLCBpbmRleEEsIGluZGV4QiwgZnJhZ21lbnRzLCBmcmFnbWVudEEsIGZyYWdtZW50Qjtcblx0XHRcdGFuY2VzdHJ5QSA9IGdldEFuY2VzdHJ5KCBhLmNvbXBvbmVudCB8fCBhLl9yYWN0aXZlLnByb3h5ICk7XG5cdFx0XHRhbmNlc3RyeUIgPSBnZXRBbmNlc3RyeSggYi5jb21wb25lbnQgfHwgYi5fcmFjdGl2ZS5wcm94eSApO1xuXHRcdFx0b2xkZXN0QSA9IGFuY2VzdHJ5QVsgYW5jZXN0cnlBLmxlbmd0aCAtIDEgXTtcblx0XHRcdG9sZGVzdEIgPSBhbmNlc3RyeUJbIGFuY2VzdHJ5Qi5sZW5ndGggLSAxIF07XG5cdFx0XHR3aGlsZSAoIG9sZGVzdEEgJiYgb2xkZXN0QSA9PT0gb2xkZXN0QiApIHtcblx0XHRcdFx0YW5jZXN0cnlBLnBvcCgpO1xuXHRcdFx0XHRhbmNlc3RyeUIucG9wKCk7XG5cdFx0XHRcdG11dHVhbEFuY2VzdG9yID0gb2xkZXN0QTtcblx0XHRcdFx0b2xkZXN0QSA9IGFuY2VzdHJ5QVsgYW5jZXN0cnlBLmxlbmd0aCAtIDEgXTtcblx0XHRcdFx0b2xkZXN0QiA9IGFuY2VzdHJ5QlsgYW5jZXN0cnlCLmxlbmd0aCAtIDEgXTtcblx0XHRcdH1cblx0XHRcdG9sZGVzdEEgPSBvbGRlc3RBLmNvbXBvbmVudCB8fCBvbGRlc3RBO1xuXHRcdFx0b2xkZXN0QiA9IG9sZGVzdEIuY29tcG9uZW50IHx8IG9sZGVzdEI7XG5cdFx0XHRmcmFnbWVudEEgPSBvbGRlc3RBLnBhcmVudEZyYWdtZW50O1xuXHRcdFx0ZnJhZ21lbnRCID0gb2xkZXN0Qi5wYXJlbnRGcmFnbWVudDtcblx0XHRcdGlmICggZnJhZ21lbnRBID09PSBmcmFnbWVudEIgKSB7XG5cdFx0XHRcdGluZGV4QSA9IGZyYWdtZW50QS5pdGVtcy5pbmRleE9mKCBvbGRlc3RBICk7XG5cdFx0XHRcdGluZGV4QiA9IGZyYWdtZW50Qi5pdGVtcy5pbmRleE9mKCBvbGRlc3RCICk7XG5cdFx0XHRcdHJldHVybiBpbmRleEEgLSBpbmRleEIgfHwgYW5jZXN0cnlBLmxlbmd0aCAtIGFuY2VzdHJ5Qi5sZW5ndGg7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGZyYWdtZW50cyA9IG11dHVhbEFuY2VzdG9yLmZyYWdtZW50cyApIHtcblx0XHRcdFx0aW5kZXhBID0gZnJhZ21lbnRzLmluZGV4T2YoIGZyYWdtZW50QSApO1xuXHRcdFx0XHRpbmRleEIgPSBmcmFnbWVudHMuaW5kZXhPZiggZnJhZ21lbnRCICk7XG5cdFx0XHRcdHJldHVybiBpbmRleEEgLSBpbmRleEIgfHwgYW5jZXN0cnlBLmxlbmd0aCAtIGFuY2VzdHJ5Qi5sZW5ndGg7XG5cdFx0XHR9XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdBbiB1bmV4cGVjdGVkIGNvbmRpdGlvbiB3YXMgbWV0IHdoaWxlIGNvbXBhcmluZyB0aGUgcG9zaXRpb24gb2YgdHdvIGNvbXBvbmVudHMuIFBsZWFzZSBmaWxlIGFuIGlzc3VlIGF0IGh0dHBzOi8vZ2l0aHViLmNvbS9SYWN0aXZlSlMvUmFjdGl2ZS9pc3N1ZXMgLSB0aGFua3MhJyApO1xuXHRcdH07XG5cblx0XHRmdW5jdGlvbiBnZXRQYXJlbnQoIGl0ZW0gKSB7XG5cdFx0XHR2YXIgcGFyZW50RnJhZ21lbnQ7XG5cdFx0XHRpZiAoIHBhcmVudEZyYWdtZW50ID0gaXRlbS5wYXJlbnRGcmFnbWVudCApIHtcblx0XHRcdFx0cmV0dXJuIHBhcmVudEZyYWdtZW50Lm93bmVyO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBpdGVtLmNvbXBvbmVudCAmJiAoIHBhcmVudEZyYWdtZW50ID0gaXRlbS5jb21wb25lbnQucGFyZW50RnJhZ21lbnQgKSApIHtcblx0XHRcdFx0cmV0dXJuIHBhcmVudEZyYWdtZW50Lm93bmVyO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldEFuY2VzdHJ5KCBpdGVtICkge1xuXHRcdFx0dmFyIGFuY2VzdHJ5LCBhbmNlc3Rvcjtcblx0XHRcdGFuY2VzdHJ5ID0gWyBpdGVtIF07XG5cdFx0XHRhbmNlc3RvciA9IGdldFBhcmVudCggaXRlbSApO1xuXHRcdFx0d2hpbGUgKCBhbmNlc3RvciApIHtcblx0XHRcdFx0YW5jZXN0cnkucHVzaCggYW5jZXN0b3IgKTtcblx0XHRcdFx0YW5jZXN0b3IgPSBnZXRQYXJlbnQoIGFuY2VzdG9yICk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gYW5jZXN0cnk7XG5cdFx0fVxuXHR9KCk7XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX3NoYXJlZF9tYWtlUXVlcnlfc29ydEJ5RG9jdW1lbnRQb3NpdGlvbiA9IGZ1bmN0aW9uKCBzb3J0QnlJdGVtUG9zaXRpb24gKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIG5vZGUsIG90aGVyTm9kZSApIHtcblx0XHRcdHZhciBiaXRtYXNrO1xuXHRcdFx0aWYgKCBub2RlLmNvbXBhcmVEb2N1bWVudFBvc2l0aW9uICkge1xuXHRcdFx0XHRiaXRtYXNrID0gbm9kZS5jb21wYXJlRG9jdW1lbnRQb3NpdGlvbiggb3RoZXJOb2RlICk7XG5cdFx0XHRcdHJldHVybiBiaXRtYXNrICYgMiA/IDEgOiAtMTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBzb3J0QnlJdGVtUG9zaXRpb24oIG5vZGUsIG90aGVyTm9kZSApO1xuXHRcdH07XG5cdH0oIFJhY3RpdmVfcHJvdG90eXBlX3NoYXJlZF9tYWtlUXVlcnlfc29ydEJ5SXRlbVBvc2l0aW9uICk7XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX3NoYXJlZF9tYWtlUXVlcnlfc29ydCA9IGZ1bmN0aW9uKCBzb3J0QnlEb2N1bWVudFBvc2l0aW9uLCBzb3J0QnlJdGVtUG9zaXRpb24gKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLnNvcnQoIHRoaXMuX2lzQ29tcG9uZW50UXVlcnkgPyBzb3J0QnlJdGVtUG9zaXRpb24gOiBzb3J0QnlEb2N1bWVudFBvc2l0aW9uICk7XG5cdFx0XHR0aGlzLl9kaXJ0eSA9IGZhbHNlO1xuXHRcdH07XG5cdH0oIFJhY3RpdmVfcHJvdG90eXBlX3NoYXJlZF9tYWtlUXVlcnlfc29ydEJ5RG9jdW1lbnRQb3NpdGlvbiwgUmFjdGl2ZV9wcm90b3R5cGVfc2hhcmVkX21ha2VRdWVyeV9zb3J0QnlJdGVtUG9zaXRpb24gKTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfc2hhcmVkX21ha2VRdWVyeV9kaXJ0eSA9IGZ1bmN0aW9uKCBydW5sb29wICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYgKCAhdGhpcy5fZGlydHkgKSB7XG5cdFx0XHRcdHJ1bmxvb3AuYWRkTGl2ZVF1ZXJ5KCB0aGlzICk7XG5cdFx0XHRcdHRoaXMuX2RpcnR5ID0gdHJ1ZTtcblx0XHRcdH1cblx0XHR9O1xuXHR9KCBnbG9iYWxfcnVubG9vcCApO1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9zaGFyZWRfbWFrZVF1ZXJ5X3JlbW92ZSA9IGZ1bmN0aW9uKCBub2RlT3JDb21wb25lbnQgKSB7XG5cdFx0dmFyIGluZGV4ID0gdGhpcy5pbmRleE9mKCB0aGlzLl9pc0NvbXBvbmVudFF1ZXJ5ID8gbm9kZU9yQ29tcG9uZW50Lmluc3RhbmNlIDogbm9kZU9yQ29tcG9uZW50ICk7XG5cdFx0aWYgKCBpbmRleCAhPT0gLTEgKSB7XG5cdFx0XHR0aGlzLnNwbGljZSggaW5kZXgsIDEgKTtcblx0XHR9XG5cdH07XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX3NoYXJlZF9tYWtlUXVlcnlfX21ha2VRdWVyeSA9IGZ1bmN0aW9uKCBkZWZpbmVQcm9wZXJ0aWVzLCB0ZXN0LCBjYW5jZWwsIHNvcnQsIGRpcnR5LCByZW1vdmUgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHJhY3RpdmUsIHNlbGVjdG9yLCBsaXZlLCBpc0NvbXBvbmVudFF1ZXJ5ICkge1xuXHRcdFx0dmFyIHF1ZXJ5ID0gW107XG5cdFx0XHRkZWZpbmVQcm9wZXJ0aWVzKCBxdWVyeSwge1xuXHRcdFx0XHRzZWxlY3Rvcjoge1xuXHRcdFx0XHRcdHZhbHVlOiBzZWxlY3RvclxuXHRcdFx0XHR9LFxuXHRcdFx0XHRsaXZlOiB7XG5cdFx0XHRcdFx0dmFsdWU6IGxpdmVcblx0XHRcdFx0fSxcblx0XHRcdFx0X2lzQ29tcG9uZW50UXVlcnk6IHtcblx0XHRcdFx0XHR2YWx1ZTogaXNDb21wb25lbnRRdWVyeVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRfdGVzdDoge1xuXHRcdFx0XHRcdHZhbHVlOiB0ZXN0XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdGlmICggIWxpdmUgKSB7XG5cdFx0XHRcdHJldHVybiBxdWVyeTtcblx0XHRcdH1cblx0XHRcdGRlZmluZVByb3BlcnRpZXMoIHF1ZXJ5LCB7XG5cdFx0XHRcdGNhbmNlbDoge1xuXHRcdFx0XHRcdHZhbHVlOiBjYW5jZWxcblx0XHRcdFx0fSxcblx0XHRcdFx0X3Jvb3Q6IHtcblx0XHRcdFx0XHR2YWx1ZTogcmFjdGl2ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRfc29ydDoge1xuXHRcdFx0XHRcdHZhbHVlOiBzb3J0XG5cdFx0XHRcdH0sXG5cdFx0XHRcdF9tYWtlRGlydHk6IHtcblx0XHRcdFx0XHR2YWx1ZTogZGlydHlcblx0XHRcdFx0fSxcblx0XHRcdFx0X3JlbW92ZToge1xuXHRcdFx0XHRcdHZhbHVlOiByZW1vdmVcblx0XHRcdFx0fSxcblx0XHRcdFx0X2RpcnR5OiB7XG5cdFx0XHRcdFx0dmFsdWU6IGZhbHNlLFxuXHRcdFx0XHRcdHdyaXRhYmxlOiB0cnVlXG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdHJldHVybiBxdWVyeTtcblx0XHR9O1xuXHR9KCB1dGlsc19kZWZpbmVQcm9wZXJ0aWVzLCBSYWN0aXZlX3Byb3RvdHlwZV9zaGFyZWRfbWFrZVF1ZXJ5X3Rlc3QsIFJhY3RpdmVfcHJvdG90eXBlX3NoYXJlZF9tYWtlUXVlcnlfY2FuY2VsLCBSYWN0aXZlX3Byb3RvdHlwZV9zaGFyZWRfbWFrZVF1ZXJ5X3NvcnQsIFJhY3RpdmVfcHJvdG90eXBlX3NoYXJlZF9tYWtlUXVlcnlfZGlydHksIFJhY3RpdmVfcHJvdG90eXBlX3NoYXJlZF9tYWtlUXVlcnlfcmVtb3ZlICk7XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX2ZpbmRBbGwgPSBmdW5jdGlvbiggbWFrZVF1ZXJ5ICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBzZWxlY3Rvciwgb3B0aW9ucyApIHtcblx0XHRcdHZhciBsaXZlUXVlcmllcywgcXVlcnk7XG5cdFx0XHRpZiAoICF0aGlzLmVsICkge1xuXHRcdFx0XHRyZXR1cm4gW107XG5cdFx0XHR9XG5cdFx0XHRvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblx0XHRcdGxpdmVRdWVyaWVzID0gdGhpcy5fbGl2ZVF1ZXJpZXM7XG5cdFx0XHRpZiAoIHF1ZXJ5ID0gbGl2ZVF1ZXJpZXNbIHNlbGVjdG9yIF0gKSB7XG5cdFx0XHRcdHJldHVybiBvcHRpb25zICYmIG9wdGlvbnMubGl2ZSA/IHF1ZXJ5IDogcXVlcnkuc2xpY2UoKTtcblx0XHRcdH1cblx0XHRcdHF1ZXJ5ID0gbWFrZVF1ZXJ5KCB0aGlzLCBzZWxlY3RvciwgISEgb3B0aW9ucy5saXZlLCBmYWxzZSApO1xuXHRcdFx0aWYgKCBxdWVyeS5saXZlICkge1xuXHRcdFx0XHRsaXZlUXVlcmllcy5wdXNoKCBzZWxlY3RvciApO1xuXHRcdFx0XHRsaXZlUXVlcmllc1sgc2VsZWN0b3IgXSA9IHF1ZXJ5O1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5mcmFnbWVudC5maW5kQWxsKCBzZWxlY3RvciwgcXVlcnkgKTtcblx0XHRcdHJldHVybiBxdWVyeTtcblx0XHR9O1xuXHR9KCBSYWN0aXZlX3Byb3RvdHlwZV9zaGFyZWRfbWFrZVF1ZXJ5X19tYWtlUXVlcnkgKTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfZmluZEFsbENvbXBvbmVudHMgPSBmdW5jdGlvbiggbWFrZVF1ZXJ5ICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBzZWxlY3Rvciwgb3B0aW9ucyApIHtcblx0XHRcdHZhciBsaXZlUXVlcmllcywgcXVlcnk7XG5cdFx0XHRvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblx0XHRcdGxpdmVRdWVyaWVzID0gdGhpcy5fbGl2ZUNvbXBvbmVudFF1ZXJpZXM7XG5cdFx0XHRpZiAoIHF1ZXJ5ID0gbGl2ZVF1ZXJpZXNbIHNlbGVjdG9yIF0gKSB7XG5cdFx0XHRcdHJldHVybiBvcHRpb25zICYmIG9wdGlvbnMubGl2ZSA/IHF1ZXJ5IDogcXVlcnkuc2xpY2UoKTtcblx0XHRcdH1cblx0XHRcdHF1ZXJ5ID0gbWFrZVF1ZXJ5KCB0aGlzLCBzZWxlY3RvciwgISEgb3B0aW9ucy5saXZlLCB0cnVlICk7XG5cdFx0XHRpZiAoIHF1ZXJ5LmxpdmUgKSB7XG5cdFx0XHRcdGxpdmVRdWVyaWVzLnB1c2goIHNlbGVjdG9yICk7XG5cdFx0XHRcdGxpdmVRdWVyaWVzWyBzZWxlY3RvciBdID0gcXVlcnk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmZyYWdtZW50LmZpbmRBbGxDb21wb25lbnRzKCBzZWxlY3RvciwgcXVlcnkgKTtcblx0XHRcdHJldHVybiBxdWVyeTtcblx0XHR9O1xuXHR9KCBSYWN0aXZlX3Byb3RvdHlwZV9zaGFyZWRfbWFrZVF1ZXJ5X19tYWtlUXVlcnkgKTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfZmluZENvbXBvbmVudCA9IGZ1bmN0aW9uKCBzZWxlY3RvciApIHtcblx0XHRyZXR1cm4gdGhpcy5mcmFnbWVudC5maW5kQ29tcG9uZW50KCBzZWxlY3RvciApO1xuXHR9O1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9maXJlID0gZnVuY3Rpb24oIGV2ZW50TmFtZSApIHtcblx0XHR2YXIgYXJncywgaSwgbGVuLCBzdWJzY3JpYmVycyA9IHRoaXMuX3N1YnNbIGV2ZW50TmFtZSBdO1xuXHRcdGlmICggIXN1YnNjcmliZXJzICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoIGFyZ3VtZW50cywgMSApO1xuXHRcdGZvciAoIGkgPSAwLCBsZW4gPSBzdWJzY3JpYmVycy5sZW5ndGg7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdHN1YnNjcmliZXJzWyBpIF0uYXBwbHkoIHRoaXMsIGFyZ3MgKTtcblx0XHR9XG5cdH07XG5cblx0dmFyIHNoYXJlZF9nZXRfVW5yZXNvbHZlZEltcGxpY2l0RGVwZW5kZW5jeSA9IGZ1bmN0aW9uKCBjaXJjdWxhciwgcmVtb3ZlRnJvbUFycmF5LCBydW5sb29wLCBub3RpZnlEZXBlbmRhbnRzICkge1xuXG5cdFx0dmFyIGdldCwgZW1wdHkgPSB7fTtcblx0XHRjaXJjdWxhci5wdXNoKCBmdW5jdGlvbigpIHtcblx0XHRcdGdldCA9IGNpcmN1bGFyLmdldDtcblx0XHR9ICk7XG5cdFx0dmFyIFVucmVzb2x2ZWRJbXBsaWNpdERlcGVuZGVuY3kgPSBmdW5jdGlvbiggcmFjdGl2ZSwga2V5cGF0aCApIHtcblx0XHRcdHRoaXMucm9vdCA9IHJhY3RpdmU7XG5cdFx0XHR0aGlzLnJlZiA9IGtleXBhdGg7XG5cdFx0XHR0aGlzLnBhcmVudEZyYWdtZW50ID0gZW1wdHk7XG5cdFx0XHRyYWN0aXZlLl91bnJlc29sdmVkSW1wbGljaXREZXBlbmRlbmNpZXNbIGtleXBhdGggXSA9IHRydWU7XG5cdFx0XHRyYWN0aXZlLl91bnJlc29sdmVkSW1wbGljaXREZXBlbmRlbmNpZXMucHVzaCggdGhpcyApO1xuXHRcdFx0cnVubG9vcC5hZGRVbnJlc29sdmVkKCB0aGlzICk7XG5cdFx0fTtcblx0XHRVbnJlc29sdmVkSW1wbGljaXREZXBlbmRlbmN5LnByb3RvdHlwZSA9IHtcblx0XHRcdHJlc29sdmU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgcmFjdGl2ZSA9IHRoaXMucm9vdDtcblx0XHRcdFx0bm90aWZ5RGVwZW5kYW50cyggcmFjdGl2ZSwgdGhpcy5yZWYgKTtcblx0XHRcdFx0cmFjdGl2ZS5fdW5yZXNvbHZlZEltcGxpY2l0RGVwZW5kZW5jaWVzWyB0aGlzLnJlZiBdID0gZmFsc2U7XG5cdFx0XHRcdHJlbW92ZUZyb21BcnJheSggcmFjdGl2ZS5fdW5yZXNvbHZlZEltcGxpY2l0RGVwZW5kZW5jaWVzLCB0aGlzICk7XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRydW5sb29wLnJlbW92ZVVucmVzb2x2ZWQoIHRoaXMgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBVbnJlc29sdmVkSW1wbGljaXREZXBlbmRlbmN5O1xuXHR9KCBjaXJjdWxhciwgdXRpbHNfcmVtb3ZlRnJvbUFycmF5LCBnbG9iYWxfcnVubG9vcCwgc2hhcmVkX25vdGlmeURlcGVuZGFudHMgKTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfZ2V0ID0gZnVuY3Rpb24oIG5vcm1hbGlzZUtleXBhdGgsIGdldCwgVW5yZXNvbHZlZEltcGxpY2l0RGVwZW5kZW5jeSApIHtcblxuXHRcdHZhciBvcHRpb25zID0ge1xuXHRcdFx0aXNUb3BMZXZlbDogdHJ1ZVxuXHRcdH07XG5cdFx0cmV0dXJuIGZ1bmN0aW9uIFJhY3RpdmVfcHJvdG90eXBlX2dldCgga2V5cGF0aCApIHtcblx0XHRcdHZhciB2YWx1ZTtcblx0XHRcdGtleXBhdGggPSBub3JtYWxpc2VLZXlwYXRoKCBrZXlwYXRoICk7XG5cdFx0XHR2YWx1ZSA9IGdldCggdGhpcywga2V5cGF0aCwgb3B0aW9ucyApO1xuXHRcdFx0aWYgKCB0aGlzLl9jYXB0dXJlZCAmJiB0aGlzLl9jYXB0dXJlZFsga2V5cGF0aCBdICE9PSB0cnVlICkge1xuXHRcdFx0XHR0aGlzLl9jYXB0dXJlZC5wdXNoKCBrZXlwYXRoICk7XG5cdFx0XHRcdHRoaXMuX2NhcHR1cmVkWyBrZXlwYXRoIF0gPSB0cnVlO1xuXHRcdFx0XHRpZiAoIHZhbHVlID09PSB1bmRlZmluZWQgJiYgdGhpcy5fdW5yZXNvbHZlZEltcGxpY2l0RGVwZW5kZW5jaWVzWyBrZXlwYXRoIF0gIT09IHRydWUgKSB7XG5cdFx0XHRcdFx0bmV3IFVucmVzb2x2ZWRJbXBsaWNpdERlcGVuZGVuY3koIHRoaXMsIGtleXBhdGggKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdH07XG5cdH0oIHV0aWxzX25vcm1hbGlzZUtleXBhdGgsIHNoYXJlZF9nZXRfX2dldCwgc2hhcmVkX2dldF9VbnJlc29sdmVkSW1wbGljaXREZXBlbmRlbmN5ICk7XG5cblx0dmFyIHV0aWxzX2dldEVsZW1lbnQgPSBmdW5jdGlvbiggaW5wdXQgKSB7XG5cdFx0dmFyIG91dHB1dDtcblx0XHRpZiAoIHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnIHx8ICFkb2N1bWVudCB8fCAhaW5wdXQgKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0aWYgKCBpbnB1dC5ub2RlVHlwZSApIHtcblx0XHRcdHJldHVybiBpbnB1dDtcblx0XHR9XG5cdFx0aWYgKCB0eXBlb2YgaW5wdXQgPT09ICdzdHJpbmcnICkge1xuXHRcdFx0b3V0cHV0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIGlucHV0ICk7XG5cdFx0XHRpZiAoICFvdXRwdXQgJiYgZG9jdW1lbnQucXVlcnlTZWxlY3RvciApIHtcblx0XHRcdFx0b3V0cHV0ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggaW5wdXQgKTtcblx0XHRcdH1cblx0XHRcdGlmICggb3V0cHV0ICYmIG91dHB1dC5ub2RlVHlwZSApIHtcblx0XHRcdFx0cmV0dXJuIG91dHB1dDtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKCBpbnB1dFsgMCBdICYmIGlucHV0WyAwIF0ubm9kZVR5cGUgKSB7XG5cdFx0XHRyZXR1cm4gaW5wdXRbIDAgXTtcblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH07XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX2luc2VydCA9IGZ1bmN0aW9uKCBnZXRFbGVtZW50ICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB0YXJnZXQsIGFuY2hvciApIHtcblx0XHRcdHRhcmdldCA9IGdldEVsZW1lbnQoIHRhcmdldCApO1xuXHRcdFx0YW5jaG9yID0gZ2V0RWxlbWVudCggYW5jaG9yICkgfHwgbnVsbDtcblx0XHRcdGlmICggIXRhcmdldCApIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnWW91IG11c3Qgc3BlY2lmeSBhIHZhbGlkIHRhcmdldCB0byBpbnNlcnQgaW50bycgKTtcblx0XHRcdH1cblx0XHRcdHRhcmdldC5pbnNlcnRCZWZvcmUoIHRoaXMuZGV0YWNoKCksIGFuY2hvciApO1xuXHRcdFx0dGhpcy5mcmFnbWVudC5wTm9kZSA9IHRoaXMuZWwgPSB0YXJnZXQ7XG5cdFx0fTtcblx0fSggdXRpbHNfZ2V0RWxlbWVudCApO1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9tZXJnZV9tYXBPbGRUb05ld0luZGV4ID0gZnVuY3Rpb24oIG9sZEFycmF5LCBuZXdBcnJheSApIHtcblx0XHR2YXIgdXNlZEluZGljZXMsIGZpcnN0VW51c2VkSW5kZXgsIG5ld0luZGljZXMsIGNoYW5nZWQ7XG5cdFx0dXNlZEluZGljZXMgPSB7fTtcblx0XHRmaXJzdFVudXNlZEluZGV4ID0gMDtcblx0XHRuZXdJbmRpY2VzID0gb2xkQXJyYXkubWFwKCBmdW5jdGlvbiggaXRlbSwgaSApIHtcblx0XHRcdHZhciBpbmRleCwgc3RhcnQsIGxlbjtcblx0XHRcdHN0YXJ0ID0gZmlyc3RVbnVzZWRJbmRleDtcblx0XHRcdGxlbiA9IG5ld0FycmF5Lmxlbmd0aDtcblx0XHRcdGRvIHtcblx0XHRcdFx0aW5kZXggPSBuZXdBcnJheS5pbmRleE9mKCBpdGVtLCBzdGFydCApO1xuXHRcdFx0XHRpZiAoIGluZGV4ID09PSAtMSApIHtcblx0XHRcdFx0XHRjaGFuZ2VkID0gdHJ1ZTtcblx0XHRcdFx0XHRyZXR1cm4gLTE7XG5cdFx0XHRcdH1cblx0XHRcdFx0c3RhcnQgPSBpbmRleCArIDE7XG5cdFx0XHR9IHdoaWxlICggdXNlZEluZGljZXNbIGluZGV4IF0gJiYgc3RhcnQgPCBsZW4gKTtcblx0XHRcdGlmICggaW5kZXggPT09IGZpcnN0VW51c2VkSW5kZXggKSB7XG5cdFx0XHRcdGZpcnN0VW51c2VkSW5kZXggKz0gMTtcblx0XHRcdH1cblx0XHRcdGlmICggaW5kZXggIT09IGkgKSB7XG5cdFx0XHRcdGNoYW5nZWQgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0dXNlZEluZGljZXNbIGluZGV4IF0gPSB0cnVlO1xuXHRcdFx0cmV0dXJuIGluZGV4O1xuXHRcdH0gKTtcblx0XHRuZXdJbmRpY2VzLnVuY2hhbmdlZCA9ICFjaGFuZ2VkO1xuXHRcdHJldHVybiBuZXdJbmRpY2VzO1xuXHR9O1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9tZXJnZV9wcm9wYWdhdGVDaGFuZ2VzID0gZnVuY3Rpb24oIHR5cGVzLCBub3RpZnlEZXBlbmRhbnRzICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCByYWN0aXZlLCBrZXlwYXRoLCBuZXdJbmRpY2VzLCBsZW5ndGhVbmNoYW5nZWQgKSB7XG5cdFx0XHR2YXIgdXBkYXRlRGVwZW5kYW50O1xuXHRcdFx0cmFjdGl2ZS5fY2hhbmdlcy5wdXNoKCBrZXlwYXRoICk7XG5cdFx0XHR1cGRhdGVEZXBlbmRhbnQgPSBmdW5jdGlvbiggZGVwZW5kYW50ICkge1xuXHRcdFx0XHRpZiAoIGRlcGVuZGFudC50eXBlID09PSB0eXBlcy5SRUZFUkVOQ0UgKSB7XG5cdFx0XHRcdFx0ZGVwZW5kYW50LnVwZGF0ZSgpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCBkZXBlbmRhbnQua2V5cGF0aCA9PT0ga2V5cGF0aCAmJiBkZXBlbmRhbnQudHlwZSA9PT0gdHlwZXMuU0VDVElPTiAmJiAhZGVwZW5kYW50LmludmVydGVkICYmIGRlcGVuZGFudC5kb2NGcmFnICkge1xuXHRcdFx0XHRcdGRlcGVuZGFudC5tZXJnZSggbmV3SW5kaWNlcyApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGRlcGVuZGFudC51cGRhdGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHRcdHJhY3RpdmUuX2RlcHMuZm9yRWFjaCggZnVuY3Rpb24oIGRlcHNCeUtleXBhdGggKSB7XG5cdFx0XHRcdHZhciBkZXBlbmRhbnRzID0gZGVwc0J5S2V5cGF0aFsga2V5cGF0aCBdO1xuXHRcdFx0XHRpZiAoIGRlcGVuZGFudHMgKSB7XG5cdFx0XHRcdFx0ZGVwZW5kYW50cy5mb3JFYWNoKCB1cGRhdGVEZXBlbmRhbnQgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCAhbGVuZ3RoVW5jaGFuZ2VkICkge1xuXHRcdFx0XHRub3RpZnlEZXBlbmRhbnRzKCByYWN0aXZlLCBrZXlwYXRoICsgJy5sZW5ndGgnLCB0cnVlICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fSggY29uZmlnX3R5cGVzLCBzaGFyZWRfbm90aWZ5RGVwZW5kYW50cyApO1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9tZXJnZV9fbWVyZ2UgPSBmdW5jdGlvbiggcnVubG9vcCwgd2FybiwgaXNBcnJheSwgUHJvbWlzZSwgc2V0LCBtYXBPbGRUb05ld0luZGV4LCBwcm9wYWdhdGVDaGFuZ2VzICkge1xuXG5cdFx0dmFyIGNvbXBhcmF0b3JzID0ge307XG5cdFx0cmV0dXJuIGZ1bmN0aW9uIG1lcmdlKCBrZXlwYXRoLCBhcnJheSwgb3B0aW9ucyApIHtcblx0XHRcdHZhciBjdXJyZW50QXJyYXksIG9sZEFycmF5LCBuZXdBcnJheSwgY29tcGFyYXRvciwgbGVuZ3RoVW5jaGFuZ2VkLCBuZXdJbmRpY2VzLCBwcm9taXNlLCBmdWxmaWxQcm9taXNlO1xuXHRcdFx0Y3VycmVudEFycmF5ID0gdGhpcy5nZXQoIGtleXBhdGggKTtcblx0XHRcdGlmICggIWlzQXJyYXkoIGN1cnJlbnRBcnJheSApIHx8ICFpc0FycmF5KCBhcnJheSApICkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5zZXQoIGtleXBhdGgsIGFycmF5LCBvcHRpb25zICYmIG9wdGlvbnMuY29tcGxldGUgKTtcblx0XHRcdH1cblx0XHRcdGxlbmd0aFVuY2hhbmdlZCA9IGN1cnJlbnRBcnJheS5sZW5ndGggPT09IGFycmF5Lmxlbmd0aDtcblx0XHRcdGlmICggb3B0aW9ucyAmJiBvcHRpb25zLmNvbXBhcmUgKSB7XG5cdFx0XHRcdGNvbXBhcmF0b3IgPSBnZXRDb21wYXJhdG9yRnVuY3Rpb24oIG9wdGlvbnMuY29tcGFyZSApO1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdG9sZEFycmF5ID0gY3VycmVudEFycmF5Lm1hcCggY29tcGFyYXRvciApO1xuXHRcdFx0XHRcdG5ld0FycmF5ID0gYXJyYXkubWFwKCBjb21wYXJhdG9yICk7XG5cdFx0XHRcdH0gY2F0Y2ggKCBlcnIgKSB7XG5cdFx0XHRcdFx0aWYgKCB0aGlzLmRlYnVnICkge1xuXHRcdFx0XHRcdFx0dGhyb3cgZXJyO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR3YXJuKCAnTWVyZ2Ugb3BlcmF0aW9uOiBjb21wYXJpc29uIGZhaWxlZC4gRmFsbGluZyBiYWNrIHRvIGlkZW50aXR5IGNoZWNraW5nJyApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRvbGRBcnJheSA9IGN1cnJlbnRBcnJheTtcblx0XHRcdFx0XHRuZXdBcnJheSA9IGFycmF5O1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRvbGRBcnJheSA9IGN1cnJlbnRBcnJheTtcblx0XHRcdFx0bmV3QXJyYXkgPSBhcnJheTtcblx0XHRcdH1cblx0XHRcdG5ld0luZGljZXMgPSBtYXBPbGRUb05ld0luZGV4KCBvbGRBcnJheSwgbmV3QXJyYXkgKTtcblx0XHRcdHByb21pc2UgPSBuZXcgUHJvbWlzZSggZnVuY3Rpb24oIGZ1bGZpbCApIHtcblx0XHRcdFx0ZnVsZmlsUHJvbWlzZSA9IGZ1bGZpbDtcblx0XHRcdH0gKTtcblx0XHRcdHJ1bmxvb3Auc3RhcnQoIHRoaXMsIGZ1bGZpbFByb21pc2UgKTtcblx0XHRcdHNldCggdGhpcywga2V5cGF0aCwgYXJyYXksIHRydWUgKTtcblx0XHRcdHByb3BhZ2F0ZUNoYW5nZXMoIHRoaXMsIGtleXBhdGgsIG5ld0luZGljZXMsIGxlbmd0aFVuY2hhbmdlZCApO1xuXHRcdFx0cnVubG9vcC5lbmQoKTtcblx0XHRcdGlmICggb3B0aW9ucyAmJiBvcHRpb25zLmNvbXBsZXRlICkge1xuXHRcdFx0XHRwcm9taXNlLnRoZW4oIG9wdGlvbnMuY29tcGxldGUgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBwcm9taXNlO1xuXHRcdH07XG5cblx0XHRmdW5jdGlvbiBzdHJpbmdpZnkoIGl0ZW0gKSB7XG5cdFx0XHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkoIGl0ZW0gKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXRDb21wYXJhdG9yRnVuY3Rpb24oIGNvbXBhcmF0b3IgKSB7XG5cdFx0XHRpZiAoIGNvbXBhcmF0b3IgPT09IHRydWUgKSB7XG5cdFx0XHRcdHJldHVybiBzdHJpbmdpZnk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHR5cGVvZiBjb21wYXJhdG9yID09PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0aWYgKCAhY29tcGFyYXRvcnNbIGNvbXBhcmF0b3IgXSApIHtcblx0XHRcdFx0XHRjb21wYXJhdG9yc1sgY29tcGFyYXRvciBdID0gZnVuY3Rpb24oIGl0ZW0gKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gaXRlbVsgY29tcGFyYXRvciBdO1xuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGNvbXBhcmF0b3JzWyBjb21wYXJhdG9yIF07XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHR5cGVvZiBjb21wYXJhdG9yID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0XHRyZXR1cm4gY29tcGFyYXRvcjtcblx0XHRcdH1cblx0XHRcdHRocm93IG5ldyBFcnJvciggJ1RoZSBgY29tcGFyZWAgb3B0aW9uIG11c3QgYmUgYSBmdW5jdGlvbiwgb3IgYSBzdHJpbmcgcmVwcmVzZW50aW5nIGFuIGlkZW50aWZ5aW5nIGZpZWxkIChvciBgdHJ1ZWAgdG8gdXNlIEpTT04uc3RyaW5naWZ5KScgKTtcblx0XHR9XG5cdH0oIGdsb2JhbF9ydW5sb29wLCB1dGlsc193YXJuLCB1dGlsc19pc0FycmF5LCB1dGlsc19Qcm9taXNlLCBzaGFyZWRfc2V0LCBSYWN0aXZlX3Byb3RvdHlwZV9tZXJnZV9tYXBPbGRUb05ld0luZGV4LCBSYWN0aXZlX3Byb3RvdHlwZV9tZXJnZV9wcm9wYWdhdGVDaGFuZ2VzICk7XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX29ic2VydmVfT2JzZXJ2ZXIgPSBmdW5jdGlvbiggcnVubG9vcCwgaXNFcXVhbCwgZ2V0ICkge1xuXG5cdFx0dmFyIE9ic2VydmVyID0gZnVuY3Rpb24oIHJhY3RpdmUsIGtleXBhdGgsIGNhbGxiYWNrLCBvcHRpb25zICkge1xuXHRcdFx0dmFyIHNlbGYgPSB0aGlzO1xuXHRcdFx0dGhpcy5yb290ID0gcmFjdGl2ZTtcblx0XHRcdHRoaXMua2V5cGF0aCA9IGtleXBhdGg7XG5cdFx0XHR0aGlzLmNhbGxiYWNrID0gY2FsbGJhY2s7XG5cdFx0XHR0aGlzLmRlZmVyID0gb3B0aW9ucy5kZWZlcjtcblx0XHRcdHRoaXMuZGVidWcgPSBvcHRpb25zLmRlYnVnO1xuXHRcdFx0dGhpcy5wcm94eSA9IHtcblx0XHRcdFx0dXBkYXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRzZWxmLnJlYWxseVVwZGF0ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5wcmlvcml0eSA9IDA7XG5cdFx0XHR0aGlzLmNvbnRleHQgPSBvcHRpb25zICYmIG9wdGlvbnMuY29udGV4dCA/IG9wdGlvbnMuY29udGV4dCA6IHJhY3RpdmU7XG5cdFx0fTtcblx0XHRPYnNlcnZlci5wcm90b3R5cGUgPSB7XG5cdFx0XHRpbml0OiBmdW5jdGlvbiggaW1tZWRpYXRlICkge1xuXHRcdFx0XHRpZiAoIGltbWVkaWF0ZSAhPT0gZmFsc2UgKSB7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGUoKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLnZhbHVlID0gZ2V0KCB0aGlzLnJvb3QsIHRoaXMua2V5cGF0aCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0dXBkYXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0aWYgKCB0aGlzLmRlZmVyICYmIHRoaXMucmVhZHkgKSB7XG5cdFx0XHRcdFx0cnVubG9vcC5hZGRPYnNlcnZlciggdGhpcy5wcm94eSApO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLnJlYWxseVVwZGF0ZSgpO1xuXHRcdFx0fSxcblx0XHRcdHJlYWxseVVwZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBvbGRWYWx1ZSwgbmV3VmFsdWU7XG5cdFx0XHRcdG9sZFZhbHVlID0gdGhpcy52YWx1ZTtcblx0XHRcdFx0bmV3VmFsdWUgPSBnZXQoIHRoaXMucm9vdCwgdGhpcy5rZXlwYXRoICk7XG5cdFx0XHRcdHRoaXMudmFsdWUgPSBuZXdWYWx1ZTtcblx0XHRcdFx0aWYgKCB0aGlzLnVwZGF0aW5nICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLnVwZGF0aW5nID0gdHJ1ZTtcblx0XHRcdFx0aWYgKCAhaXNFcXVhbCggbmV3VmFsdWUsIG9sZFZhbHVlICkgfHwgIXRoaXMucmVhZHkgKSB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdHRoaXMuY2FsbGJhY2suY2FsbCggdGhpcy5jb250ZXh0LCBuZXdWYWx1ZSwgb2xkVmFsdWUsIHRoaXMua2V5cGF0aCApO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKCBlcnIgKSB7XG5cdFx0XHRcdFx0XHRpZiAoIHRoaXMuZGVidWcgfHwgdGhpcy5yb290LmRlYnVnICkge1xuXHRcdFx0XHRcdFx0XHR0aHJvdyBlcnI7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMudXBkYXRpbmcgPSBmYWxzZTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBPYnNlcnZlcjtcblx0fSggZ2xvYmFsX3J1bmxvb3AsIHV0aWxzX2lzRXF1YWwsIHNoYXJlZF9nZXRfX2dldCApO1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9vYnNlcnZlX2dldFBhdHRlcm4gPSBmdW5jdGlvbiggaXNBcnJheSApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggcmFjdGl2ZSwgcGF0dGVybiApIHtcblx0XHRcdHZhciBrZXlzLCBrZXksIHZhbHVlcywgdG9HZXQsIG5ld1RvR2V0LCBleHBhbmQsIGNvbmNhdGVuYXRlO1xuXHRcdFx0a2V5cyA9IHBhdHRlcm4uc3BsaXQoICcuJyApO1xuXHRcdFx0dG9HZXQgPSBbXTtcblx0XHRcdGV4cGFuZCA9IGZ1bmN0aW9uKCBrZXlwYXRoICkge1xuXHRcdFx0XHR2YXIgdmFsdWUsIGtleTtcblx0XHRcdFx0dmFsdWUgPSByYWN0aXZlLl93cmFwcGVkWyBrZXlwYXRoIF0gPyByYWN0aXZlLl93cmFwcGVkWyBrZXlwYXRoIF0uZ2V0KCkgOiByYWN0aXZlLmdldCgga2V5cGF0aCApO1xuXHRcdFx0XHRmb3IgKCBrZXkgaW4gdmFsdWUgKSB7XG5cdFx0XHRcdFx0aWYgKCB2YWx1ZS5oYXNPd25Qcm9wZXJ0eSgga2V5ICkgJiYgKCBrZXkgIT09ICdfcmFjdGl2ZScgfHwgIWlzQXJyYXkoIHZhbHVlICkgKSApIHtcblx0XHRcdFx0XHRcdG5ld1RvR2V0LnB1c2goIGtleXBhdGggKyAnLicgKyBrZXkgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHRjb25jYXRlbmF0ZSA9IGZ1bmN0aW9uKCBrZXlwYXRoICkge1xuXHRcdFx0XHRyZXR1cm4ga2V5cGF0aCArICcuJyArIGtleTtcblx0XHRcdH07XG5cdFx0XHR3aGlsZSAoIGtleSA9IGtleXMuc2hpZnQoKSApIHtcblx0XHRcdFx0aWYgKCBrZXkgPT09ICcqJyApIHtcblx0XHRcdFx0XHRuZXdUb0dldCA9IFtdO1xuXHRcdFx0XHRcdHRvR2V0LmZvckVhY2goIGV4cGFuZCApO1xuXHRcdFx0XHRcdHRvR2V0ID0gbmV3VG9HZXQ7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aWYgKCAhdG9HZXRbIDAgXSApIHtcblx0XHRcdFx0XHRcdHRvR2V0WyAwIF0gPSBrZXk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRvR2V0ID0gdG9HZXQubWFwKCBjb25jYXRlbmF0ZSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0dmFsdWVzID0ge307XG5cdFx0XHR0b0dldC5mb3JFYWNoKCBmdW5jdGlvbigga2V5cGF0aCApIHtcblx0XHRcdFx0dmFsdWVzWyBrZXlwYXRoIF0gPSByYWN0aXZlLmdldCgga2V5cGF0aCApO1xuXHRcdFx0fSApO1xuXHRcdFx0cmV0dXJuIHZhbHVlcztcblx0XHR9O1xuXHR9KCB1dGlsc19pc0FycmF5ICk7XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX29ic2VydmVfUGF0dGVybk9ic2VydmVyID0gZnVuY3Rpb24oIHJ1bmxvb3AsIGlzRXF1YWwsIGdldCwgZ2V0UGF0dGVybiApIHtcblxuXHRcdHZhciBQYXR0ZXJuT2JzZXJ2ZXIsIHdpbGRjYXJkID0gL1xcKi87XG5cdFx0UGF0dGVybk9ic2VydmVyID0gZnVuY3Rpb24oIHJhY3RpdmUsIGtleXBhdGgsIGNhbGxiYWNrLCBvcHRpb25zICkge1xuXHRcdFx0dGhpcy5yb290ID0gcmFjdGl2ZTtcblx0XHRcdHRoaXMuY2FsbGJhY2sgPSBjYWxsYmFjaztcblx0XHRcdHRoaXMuZGVmZXIgPSBvcHRpb25zLmRlZmVyO1xuXHRcdFx0dGhpcy5kZWJ1ZyA9IG9wdGlvbnMuZGVidWc7XG5cdFx0XHR0aGlzLmtleXBhdGggPSBrZXlwYXRoO1xuXHRcdFx0dGhpcy5yZWdleCA9IG5ldyBSZWdFeHAoICdeJyArIGtleXBhdGgucmVwbGFjZSggL1xcLi9nLCAnXFxcXC4nICkucmVwbGFjZSggL1xcKi9nLCAnW15cXFxcLl0rJyApICsgJyQnICk7XG5cdFx0XHR0aGlzLnZhbHVlcyA9IHt9O1xuXHRcdFx0aWYgKCB0aGlzLmRlZmVyICkge1xuXHRcdFx0XHR0aGlzLnByb3hpZXMgPSBbXTtcblx0XHRcdH1cblx0XHRcdHRoaXMucHJpb3JpdHkgPSAncGF0dGVybic7XG5cdFx0XHR0aGlzLmNvbnRleHQgPSBvcHRpb25zICYmIG9wdGlvbnMuY29udGV4dCA/IG9wdGlvbnMuY29udGV4dCA6IHJhY3RpdmU7XG5cdFx0fTtcblx0XHRQYXR0ZXJuT2JzZXJ2ZXIucHJvdG90eXBlID0ge1xuXHRcdFx0aW5pdDogZnVuY3Rpb24oIGltbWVkaWF0ZSApIHtcblx0XHRcdFx0dmFyIHZhbHVlcywga2V5cGF0aDtcblx0XHRcdFx0dmFsdWVzID0gZ2V0UGF0dGVybiggdGhpcy5yb290LCB0aGlzLmtleXBhdGggKTtcblx0XHRcdFx0aWYgKCBpbW1lZGlhdGUgIT09IGZhbHNlICkge1xuXHRcdFx0XHRcdGZvciAoIGtleXBhdGggaW4gdmFsdWVzICkge1xuXHRcdFx0XHRcdFx0aWYgKCB2YWx1ZXMuaGFzT3duUHJvcGVydHkoIGtleXBhdGggKSApIHtcblx0XHRcdFx0XHRcdFx0dGhpcy51cGRhdGUoIGtleXBhdGggKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy52YWx1ZXMgPSB2YWx1ZXM7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHR1cGRhdGU6IGZ1bmN0aW9uKCBrZXlwYXRoICkge1xuXHRcdFx0XHR2YXIgdmFsdWVzO1xuXHRcdFx0XHRpZiAoIHdpbGRjYXJkLnRlc3QoIGtleXBhdGggKSApIHtcblx0XHRcdFx0XHR2YWx1ZXMgPSBnZXRQYXR0ZXJuKCB0aGlzLnJvb3QsIGtleXBhdGggKTtcblx0XHRcdFx0XHRmb3IgKCBrZXlwYXRoIGluIHZhbHVlcyApIHtcblx0XHRcdFx0XHRcdGlmICggdmFsdWVzLmhhc093blByb3BlcnR5KCBrZXlwYXRoICkgKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMudXBkYXRlKCBrZXlwYXRoICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHRoaXMuZGVmZXIgJiYgdGhpcy5yZWFkeSApIHtcblx0XHRcdFx0XHRydW5sb29wLmFkZE9ic2VydmVyKCB0aGlzLmdldFByb3h5KCBrZXlwYXRoICkgKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5yZWFsbHlVcGRhdGUoIGtleXBhdGggKTtcblx0XHRcdH0sXG5cdFx0XHRyZWFsbHlVcGRhdGU6IGZ1bmN0aW9uKCBrZXlwYXRoICkge1xuXHRcdFx0XHR2YXIgdmFsdWUgPSBnZXQoIHRoaXMucm9vdCwga2V5cGF0aCApO1xuXHRcdFx0XHRpZiAoIHRoaXMudXBkYXRpbmcgKSB7XG5cdFx0XHRcdFx0dGhpcy52YWx1ZXNbIGtleXBhdGggXSA9IHZhbHVlO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLnVwZGF0aW5nID0gdHJ1ZTtcblx0XHRcdFx0aWYgKCAhaXNFcXVhbCggdmFsdWUsIHRoaXMudmFsdWVzWyBrZXlwYXRoIF0gKSB8fCAhdGhpcy5yZWFkeSApIHtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0dGhpcy5jYWxsYmFjay5jYWxsKCB0aGlzLmNvbnRleHQsIHZhbHVlLCB0aGlzLnZhbHVlc1sga2V5cGF0aCBdLCBrZXlwYXRoICk7XG5cdFx0XHRcdFx0fSBjYXRjaCAoIGVyciApIHtcblx0XHRcdFx0XHRcdGlmICggdGhpcy5kZWJ1ZyB8fCB0aGlzLnJvb3QuZGVidWcgKSB7XG5cdFx0XHRcdFx0XHRcdHRocm93IGVycjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGhpcy52YWx1ZXNbIGtleXBhdGggXSA9IHZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMudXBkYXRpbmcgPSBmYWxzZTtcblx0XHRcdH0sXG5cdFx0XHRnZXRQcm94eTogZnVuY3Rpb24oIGtleXBhdGggKSB7XG5cdFx0XHRcdHZhciBzZWxmID0gdGhpcztcblx0XHRcdFx0aWYgKCAhdGhpcy5wcm94aWVzWyBrZXlwYXRoIF0gKSB7XG5cdFx0XHRcdFx0dGhpcy5wcm94aWVzWyBrZXlwYXRoIF0gPSB7XG5cdFx0XHRcdFx0XHR1cGRhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0XHRzZWxmLnJlYWxseVVwZGF0ZSgga2V5cGF0aCApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRoaXMucHJveGllc1sga2V5cGF0aCBdO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIFBhdHRlcm5PYnNlcnZlcjtcblx0fSggZ2xvYmFsX3J1bmxvb3AsIHV0aWxzX2lzRXF1YWwsIHNoYXJlZF9nZXRfX2dldCwgUmFjdGl2ZV9wcm90b3R5cGVfb2JzZXJ2ZV9nZXRQYXR0ZXJuICk7XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX29ic2VydmVfZ2V0T2JzZXJ2ZXJGYWNhZGUgPSBmdW5jdGlvbiggbm9ybWFsaXNlS2V5cGF0aCwgcmVnaXN0ZXJEZXBlbmRhbnQsIHVucmVnaXN0ZXJEZXBlbmRhbnQsIE9ic2VydmVyLCBQYXR0ZXJuT2JzZXJ2ZXIgKSB7XG5cblx0XHR2YXIgd2lsZGNhcmQgPSAvXFwqLyxcblx0XHRcdGVtcHR5T2JqZWN0ID0ge307XG5cdFx0cmV0dXJuIGZ1bmN0aW9uIGdldE9ic2VydmVyRmFjYWRlKCByYWN0aXZlLCBrZXlwYXRoLCBjYWxsYmFjaywgb3B0aW9ucyApIHtcblx0XHRcdHZhciBvYnNlcnZlciwgaXNQYXR0ZXJuT2JzZXJ2ZXI7XG5cdFx0XHRrZXlwYXRoID0gbm9ybWFsaXNlS2V5cGF0aCgga2V5cGF0aCApO1xuXHRcdFx0b3B0aW9ucyA9IG9wdGlvbnMgfHwgZW1wdHlPYmplY3Q7XG5cdFx0XHRpZiAoIHdpbGRjYXJkLnRlc3QoIGtleXBhdGggKSApIHtcblx0XHRcdFx0b2JzZXJ2ZXIgPSBuZXcgUGF0dGVybk9ic2VydmVyKCByYWN0aXZlLCBrZXlwYXRoLCBjYWxsYmFjaywgb3B0aW9ucyApO1xuXHRcdFx0XHRyYWN0aXZlLl9wYXR0ZXJuT2JzZXJ2ZXJzLnB1c2goIG9ic2VydmVyICk7XG5cdFx0XHRcdGlzUGF0dGVybk9ic2VydmVyID0gdHJ1ZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG9ic2VydmVyID0gbmV3IE9ic2VydmVyKCByYWN0aXZlLCBrZXlwYXRoLCBjYWxsYmFjaywgb3B0aW9ucyApO1xuXHRcdFx0fVxuXHRcdFx0cmVnaXN0ZXJEZXBlbmRhbnQoIG9ic2VydmVyICk7XG5cdFx0XHRvYnNlcnZlci5pbml0KCBvcHRpb25zLmluaXQgKTtcblx0XHRcdG9ic2VydmVyLnJlYWR5ID0gdHJ1ZTtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGNhbmNlbDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0dmFyIGluZGV4O1xuXHRcdFx0XHRcdGlmICggaXNQYXR0ZXJuT2JzZXJ2ZXIgKSB7XG5cdFx0XHRcdFx0XHRpbmRleCA9IHJhY3RpdmUuX3BhdHRlcm5PYnNlcnZlcnMuaW5kZXhPZiggb2JzZXJ2ZXIgKTtcblx0XHRcdFx0XHRcdGlmICggaW5kZXggIT09IC0xICkge1xuXHRcdFx0XHRcdFx0XHRyYWN0aXZlLl9wYXR0ZXJuT2JzZXJ2ZXJzLnNwbGljZSggaW5kZXgsIDEgKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dW5yZWdpc3RlckRlcGVuZGFudCggb2JzZXJ2ZXIgKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHR9O1xuXHR9KCB1dGlsc19ub3JtYWxpc2VLZXlwYXRoLCBzaGFyZWRfcmVnaXN0ZXJEZXBlbmRhbnQsIHNoYXJlZF91bnJlZ2lzdGVyRGVwZW5kYW50LCBSYWN0aXZlX3Byb3RvdHlwZV9vYnNlcnZlX09ic2VydmVyLCBSYWN0aXZlX3Byb3RvdHlwZV9vYnNlcnZlX1BhdHRlcm5PYnNlcnZlciApO1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9vYnNlcnZlX19vYnNlcnZlID0gZnVuY3Rpb24oIGlzT2JqZWN0LCBnZXRPYnNlcnZlckZhY2FkZSApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiBvYnNlcnZlKCBrZXlwYXRoLCBjYWxsYmFjaywgb3B0aW9ucyApIHtcblx0XHRcdHZhciBvYnNlcnZlcnMsIG1hcCwga2V5cGF0aHMsIGk7XG5cdFx0XHRpZiAoIGlzT2JqZWN0KCBrZXlwYXRoICkgKSB7XG5cdFx0XHRcdG9wdGlvbnMgPSBjYWxsYmFjaztcblx0XHRcdFx0bWFwID0ga2V5cGF0aDtcblx0XHRcdFx0b2JzZXJ2ZXJzID0gW107XG5cdFx0XHRcdGZvciAoIGtleXBhdGggaW4gbWFwICkge1xuXHRcdFx0XHRcdGlmICggbWFwLmhhc093blByb3BlcnR5KCBrZXlwYXRoICkgKSB7XG5cdFx0XHRcdFx0XHRjYWxsYmFjayA9IG1hcFsga2V5cGF0aCBdO1xuXHRcdFx0XHRcdFx0b2JzZXJ2ZXJzLnB1c2goIHRoaXMub2JzZXJ2ZSgga2V5cGF0aCwgY2FsbGJhY2ssIG9wdGlvbnMgKSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGNhbmNlbDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHR3aGlsZSAoIG9ic2VydmVycy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0XHRcdG9ic2VydmVycy5wb3AoKS5jYW5jZWwoKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHR5cGVvZiBrZXlwYXRoID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0XHRvcHRpb25zID0gY2FsbGJhY2s7XG5cdFx0XHRcdGNhbGxiYWNrID0ga2V5cGF0aDtcblx0XHRcdFx0a2V5cGF0aCA9ICcnO1xuXHRcdFx0XHRyZXR1cm4gZ2V0T2JzZXJ2ZXJGYWNhZGUoIHRoaXMsIGtleXBhdGgsIGNhbGxiYWNrLCBvcHRpb25zICk7XG5cdFx0XHR9XG5cdFx0XHRrZXlwYXRocyA9IGtleXBhdGguc3BsaXQoICcgJyApO1xuXHRcdFx0aWYgKCBrZXlwYXRocy5sZW5ndGggPT09IDEgKSB7XG5cdFx0XHRcdHJldHVybiBnZXRPYnNlcnZlckZhY2FkZSggdGhpcywga2V5cGF0aCwgY2FsbGJhY2ssIG9wdGlvbnMgKTtcblx0XHRcdH1cblx0XHRcdG9ic2VydmVycyA9IFtdO1xuXHRcdFx0aSA9IGtleXBhdGhzLmxlbmd0aDtcblx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRrZXlwYXRoID0ga2V5cGF0aHNbIGkgXTtcblx0XHRcdFx0aWYgKCBrZXlwYXRoICkge1xuXHRcdFx0XHRcdG9ic2VydmVycy5wdXNoKCBnZXRPYnNlcnZlckZhY2FkZSggdGhpcywga2V5cGF0aCwgY2FsbGJhY2ssIG9wdGlvbnMgKSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRjYW5jZWw6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdHdoaWxlICggb2JzZXJ2ZXJzLmxlbmd0aCApIHtcblx0XHRcdFx0XHRcdG9ic2VydmVycy5wb3AoKS5jYW5jZWwoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0fTtcblx0fSggdXRpbHNfaXNPYmplY3QsIFJhY3RpdmVfcHJvdG90eXBlX29ic2VydmVfZ2V0T2JzZXJ2ZXJGYWNhZGUgKTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfb2ZmID0gZnVuY3Rpb24oIGV2ZW50TmFtZSwgY2FsbGJhY2sgKSB7XG5cdFx0dmFyIHN1YnNjcmliZXJzLCBpbmRleDtcblx0XHRpZiAoICFjYWxsYmFjayApIHtcblx0XHRcdGlmICggIWV2ZW50TmFtZSApIHtcblx0XHRcdFx0Zm9yICggZXZlbnROYW1lIGluIHRoaXMuX3N1YnMgKSB7XG5cdFx0XHRcdFx0ZGVsZXRlIHRoaXMuX3N1YnNbIGV2ZW50TmFtZSBdO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9zdWJzWyBldmVudE5hbWUgXSA9IFtdO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRzdWJzY3JpYmVycyA9IHRoaXMuX3N1YnNbIGV2ZW50TmFtZSBdO1xuXHRcdGlmICggc3Vic2NyaWJlcnMgKSB7XG5cdFx0XHRpbmRleCA9IHN1YnNjcmliZXJzLmluZGV4T2YoIGNhbGxiYWNrICk7XG5cdFx0XHRpZiAoIGluZGV4ICE9PSAtMSApIHtcblx0XHRcdFx0c3Vic2NyaWJlcnMuc3BsaWNlKCBpbmRleCwgMSApO1xuXHRcdFx0fVxuXHRcdH1cblx0fTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfb24gPSBmdW5jdGlvbiggZXZlbnROYW1lLCBjYWxsYmFjayApIHtcblx0XHR2YXIgc2VsZiA9IHRoaXMsXG5cdFx0XHRsaXN0ZW5lcnMsIG47XG5cdFx0aWYgKCB0eXBlb2YgZXZlbnROYW1lID09PSAnb2JqZWN0JyApIHtcblx0XHRcdGxpc3RlbmVycyA9IFtdO1xuXHRcdFx0Zm9yICggbiBpbiBldmVudE5hbWUgKSB7XG5cdFx0XHRcdGlmICggZXZlbnROYW1lLmhhc093blByb3BlcnR5KCBuICkgKSB7XG5cdFx0XHRcdFx0bGlzdGVuZXJzLnB1c2goIHRoaXMub24oIG4sIGV2ZW50TmFtZVsgbiBdICkgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0Y2FuY2VsOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHR2YXIgbGlzdGVuZXI7XG5cdFx0XHRcdFx0d2hpbGUgKCBsaXN0ZW5lciA9IGxpc3RlbmVycy5wb3AoKSApIHtcblx0XHRcdFx0XHRcdGxpc3RlbmVyLmNhbmNlbCgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHR9XG5cdFx0aWYgKCAhdGhpcy5fc3Vic1sgZXZlbnROYW1lIF0gKSB7XG5cdFx0XHR0aGlzLl9zdWJzWyBldmVudE5hbWUgXSA9IFsgY2FsbGJhY2sgXTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fc3Vic1sgZXZlbnROYW1lIF0ucHVzaCggY2FsbGJhY2sgKTtcblx0XHR9XG5cdFx0cmV0dXJuIHtcblx0XHRcdGNhbmNlbDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHNlbGYub2ZmKCBldmVudE5hbWUsIGNhbGxiYWNrICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fTtcblxuXHR2YXIgdXRpbHNfY3JlYXRlID0gZnVuY3Rpb24oKSB7XG5cblx0XHR2YXIgY3JlYXRlO1xuXHRcdHRyeSB7XG5cdFx0XHRPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cdFx0XHRjcmVhdGUgPSBPYmplY3QuY3JlYXRlO1xuXHRcdH0gY2F0Y2ggKCBlcnIgKSB7XG5cdFx0XHRjcmVhdGUgPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIEYgPSBmdW5jdGlvbigpIHt9O1xuXHRcdFx0XHRyZXR1cm4gZnVuY3Rpb24oIHByb3RvLCBwcm9wcyApIHtcblx0XHRcdFx0XHR2YXIgb2JqO1xuXHRcdFx0XHRcdGlmICggcHJvdG8gPT09IG51bGwgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4ge307XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdEYucHJvdG90eXBlID0gcHJvdG87XG5cdFx0XHRcdFx0b2JqID0gbmV3IEYoKTtcblx0XHRcdFx0XHRpZiAoIHByb3BzICkge1xuXHRcdFx0XHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnRpZXMoIG9iaiwgcHJvcHMgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIG9iajtcblx0XHRcdFx0fTtcblx0XHRcdH0oKTtcblx0XHR9XG5cdFx0cmV0dXJuIGNyZWF0ZTtcblx0fSgpO1xuXG5cdHZhciByZW5kZXJfc2hhcmVkX2luaXRGcmFnbWVudCA9IGZ1bmN0aW9uKCB0eXBlcywgY3JlYXRlICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uIGluaXRGcmFnbWVudCggZnJhZ21lbnQsIG9wdGlvbnMgKSB7XG5cdFx0XHR2YXIgbnVtSXRlbXMsIGksIHBhcmVudEZyYWdtZW50LCBwYXJlbnRSZWZzLCByZWY7XG5cdFx0XHRmcmFnbWVudC5vd25lciA9IG9wdGlvbnMub3duZXI7XG5cdFx0XHRwYXJlbnRGcmFnbWVudCA9IGZyYWdtZW50LnBhcmVudCA9IGZyYWdtZW50Lm93bmVyLnBhcmVudEZyYWdtZW50O1xuXHRcdFx0ZnJhZ21lbnQucm9vdCA9IG9wdGlvbnMucm9vdDtcblx0XHRcdGZyYWdtZW50LnBOb2RlID0gb3B0aW9ucy5wTm9kZTtcblx0XHRcdGZyYWdtZW50LnBFbGVtZW50ID0gb3B0aW9ucy5wRWxlbWVudDtcblx0XHRcdGZyYWdtZW50LmNvbnRleHQgPSBvcHRpb25zLmNvbnRleHQ7XG5cdFx0XHRpZiAoIGZyYWdtZW50Lm93bmVyLnR5cGUgPT09IHR5cGVzLlNFQ1RJT04gKSB7XG5cdFx0XHRcdGZyYWdtZW50LmluZGV4ID0gb3B0aW9ucy5pbmRleDtcblx0XHRcdH1cblx0XHRcdGlmICggcGFyZW50RnJhZ21lbnQgKSB7XG5cdFx0XHRcdHBhcmVudFJlZnMgPSBwYXJlbnRGcmFnbWVudC5pbmRleFJlZnM7XG5cdFx0XHRcdGlmICggcGFyZW50UmVmcyApIHtcblx0XHRcdFx0XHRmcmFnbWVudC5pbmRleFJlZnMgPSBjcmVhdGUoIG51bGwgKTtcblx0XHRcdFx0XHRmb3IgKCByZWYgaW4gcGFyZW50UmVmcyApIHtcblx0XHRcdFx0XHRcdGZyYWdtZW50LmluZGV4UmVmc1sgcmVmIF0gPSBwYXJlbnRSZWZzWyByZWYgXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGZyYWdtZW50LnByaW9yaXR5ID0gcGFyZW50RnJhZ21lbnQgPyBwYXJlbnRGcmFnbWVudC5wcmlvcml0eSArIDEgOiAxO1xuXHRcdFx0aWYgKCBvcHRpb25zLmluZGV4UmVmICkge1xuXHRcdFx0XHRpZiAoICFmcmFnbWVudC5pbmRleFJlZnMgKSB7XG5cdFx0XHRcdFx0ZnJhZ21lbnQuaW5kZXhSZWZzID0ge307XG5cdFx0XHRcdH1cblx0XHRcdFx0ZnJhZ21lbnQuaW5kZXhSZWZzWyBvcHRpb25zLmluZGV4UmVmIF0gPSBvcHRpb25zLmluZGV4O1xuXHRcdFx0fVxuXHRcdFx0ZnJhZ21lbnQuaXRlbXMgPSBbXTtcblx0XHRcdG51bUl0ZW1zID0gb3B0aW9ucy5kZXNjcmlwdG9yID8gb3B0aW9ucy5kZXNjcmlwdG9yLmxlbmd0aCA6IDA7XG5cdFx0XHRmb3IgKCBpID0gMDsgaSA8IG51bUl0ZW1zOyBpICs9IDEgKSB7XG5cdFx0XHRcdGZyYWdtZW50Lml0ZW1zWyBmcmFnbWVudC5pdGVtcy5sZW5ndGggXSA9IGZyYWdtZW50LmNyZWF0ZUl0ZW0oIHtcblx0XHRcdFx0XHRwYXJlbnRGcmFnbWVudDogZnJhZ21lbnQsXG5cdFx0XHRcdFx0cEVsZW1lbnQ6IG9wdGlvbnMucEVsZW1lbnQsXG5cdFx0XHRcdFx0ZGVzY3JpcHRvcjogb3B0aW9ucy5kZXNjcmlwdG9yWyBpIF0sXG5cdFx0XHRcdFx0aW5kZXg6IGlcblx0XHRcdFx0fSApO1xuXHRcdFx0fVxuXHRcdH07XG5cdH0oIGNvbmZpZ190eXBlcywgdXRpbHNfY3JlYXRlICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9zaGFyZWRfaW5zZXJ0SHRtbCA9IGZ1bmN0aW9uKCBjcmVhdGVFbGVtZW50ICkge1xuXG5cdFx0dmFyIGVsZW1lbnRDYWNoZSA9IHt9LCBpZUJ1ZywgaWVCbGFja2xpc3Q7XG5cdFx0dHJ5IHtcblx0XHRcdGNyZWF0ZUVsZW1lbnQoICd0YWJsZScgKS5pbm5lckhUTUwgPSAnZm9vJztcblx0XHR9IGNhdGNoICggZXJyICkge1xuXHRcdFx0aWVCdWcgPSB0cnVlO1xuXHRcdFx0aWVCbGFja2xpc3QgPSB7XG5cdFx0XHRcdFRBQkxFOiBbXG5cdFx0XHRcdFx0Jzx0YWJsZSBjbGFzcz1cInhcIj4nLFxuXHRcdFx0XHRcdCc8L3RhYmxlPidcblx0XHRcdFx0XSxcblx0XHRcdFx0VEhFQUQ6IFtcblx0XHRcdFx0XHQnPHRhYmxlPjx0aGVhZCBjbGFzcz1cInhcIj4nLFxuXHRcdFx0XHRcdCc8L3RoZWFkPjwvdGFibGU+J1xuXHRcdFx0XHRdLFxuXHRcdFx0XHRUQk9EWTogW1xuXHRcdFx0XHRcdCc8dGFibGU+PHRib2R5IGNsYXNzPVwieFwiPicsXG5cdFx0XHRcdFx0JzwvdGJvZHk+PC90YWJsZT4nXG5cdFx0XHRcdF0sXG5cdFx0XHRcdFRSOiBbXG5cdFx0XHRcdFx0Jzx0YWJsZT48dHIgY2xhc3M9XCJ4XCI+Jyxcblx0XHRcdFx0XHQnPC90cj48L3RhYmxlPidcblx0XHRcdFx0XSxcblx0XHRcdFx0U0VMRUNUOiBbXG5cdFx0XHRcdFx0JzxzZWxlY3QgY2xhc3M9XCJ4XCI+Jyxcblx0XHRcdFx0XHQnPC9zZWxlY3Q+J1xuXHRcdFx0XHRdXG5cdFx0XHR9O1xuXHRcdH1cblx0XHRyZXR1cm4gZnVuY3Rpb24oIGh0bWwsIHRhZ05hbWUsIGRvY0ZyYWcgKSB7XG5cdFx0XHR2YXIgY29udGFpbmVyLCBub2RlcyA9IFtdLFxuXHRcdFx0XHR3cmFwcGVyO1xuXHRcdFx0aWYgKCBodG1sICkge1xuXHRcdFx0XHRpZiAoIGllQnVnICYmICggd3JhcHBlciA9IGllQmxhY2tsaXN0WyB0YWdOYW1lIF0gKSApIHtcblx0XHRcdFx0XHRjb250YWluZXIgPSBlbGVtZW50KCAnRElWJyApO1xuXHRcdFx0XHRcdGNvbnRhaW5lci5pbm5lckhUTUwgPSB3cmFwcGVyWyAwIF0gKyBodG1sICsgd3JhcHBlclsgMSBdO1xuXHRcdFx0XHRcdGNvbnRhaW5lciA9IGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yKCAnLngnICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29udGFpbmVyID0gZWxlbWVudCggdGFnTmFtZSApO1xuXHRcdFx0XHRcdGNvbnRhaW5lci5pbm5lckhUTUwgPSBodG1sO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHdoaWxlICggY29udGFpbmVyLmZpcnN0Q2hpbGQgKSB7XG5cdFx0XHRcdFx0bm9kZXMucHVzaCggY29udGFpbmVyLmZpcnN0Q2hpbGQgKTtcblx0XHRcdFx0XHRkb2NGcmFnLmFwcGVuZENoaWxkKCBjb250YWluZXIuZmlyc3RDaGlsZCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbm9kZXM7XG5cdFx0fTtcblxuXHRcdGZ1bmN0aW9uIGVsZW1lbnQoIHRhZ05hbWUgKSB7XG5cdFx0XHRyZXR1cm4gZWxlbWVudENhY2hlWyB0YWdOYW1lIF0gfHwgKCBlbGVtZW50Q2FjaGVbIHRhZ05hbWUgXSA9IGNyZWF0ZUVsZW1lbnQoIHRhZ05hbWUgKSApO1xuXHRcdH1cblx0fSggdXRpbHNfY3JlYXRlRWxlbWVudCApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfc2hhcmVkX2RldGFjaCA9IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBub2RlID0gdGhpcy5ub2RlLFxuXHRcdFx0cGFyZW50Tm9kZTtcblx0XHRpZiAoIG5vZGUgJiYgKCBwYXJlbnROb2RlID0gbm9kZS5wYXJlbnROb2RlICkgKSB7XG5cdFx0XHRwYXJlbnROb2RlLnJlbW92ZUNoaWxkKCBub2RlICk7XG5cdFx0XHRyZXR1cm4gbm9kZTtcblx0XHR9XG5cdH07XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9UZXh0ID0gZnVuY3Rpb24oIHR5cGVzLCBkZXRhY2ggKSB7XG5cblx0XHR2YXIgRG9tVGV4dCwgbGVzc1RoYW4sIGdyZWF0ZXJUaGFuO1xuXHRcdGxlc3NUaGFuID0gLzwvZztcblx0XHRncmVhdGVyVGhhbiA9IC8+L2c7XG5cdFx0RG9tVGV4dCA9IGZ1bmN0aW9uKCBvcHRpb25zLCBkb2NGcmFnICkge1xuXHRcdFx0dGhpcy50eXBlID0gdHlwZXMuVEVYVDtcblx0XHRcdHRoaXMuZGVzY3JpcHRvciA9IG9wdGlvbnMuZGVzY3JpcHRvcjtcblx0XHRcdGlmICggZG9jRnJhZyApIHtcblx0XHRcdFx0dGhpcy5ub2RlID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoIG9wdGlvbnMuZGVzY3JpcHRvciApO1xuXHRcdFx0XHRkb2NGcmFnLmFwcGVuZENoaWxkKCB0aGlzLm5vZGUgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdERvbVRleHQucHJvdG90eXBlID0ge1xuXHRcdFx0ZGV0YWNoOiBkZXRhY2gsXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oIGRlc3Ryb3kgKSB7XG5cdFx0XHRcdGlmICggZGVzdHJveSApIHtcblx0XHRcdFx0XHR0aGlzLmRldGFjaCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0Zmlyc3ROb2RlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMubm9kZTtcblx0XHRcdH0sXG5cdFx0XHR0b1N0cmluZzogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiAoICcnICsgdGhpcy5kZXNjcmlwdG9yICkucmVwbGFjZSggbGVzc1RoYW4sICcmbHQ7JyApLnJlcGxhY2UoIGdyZWF0ZXJUaGFuLCAnJmd0OycgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBEb21UZXh0O1xuXHR9KCBjb25maWdfdHlwZXMsIHJlbmRlcl9Eb21GcmFnbWVudF9zaGFyZWRfZGV0YWNoICk7XG5cblx0dmFyIHNoYXJlZF90ZWFyZG93biA9IGZ1bmN0aW9uKCBydW5sb29wLCB1bnJlZ2lzdGVyRGVwZW5kYW50ICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB0aGluZyApIHtcblx0XHRcdGlmICggIXRoaW5nLmtleXBhdGggKSB7XG5cdFx0XHRcdHJ1bmxvb3AucmVtb3ZlVW5yZXNvbHZlZCggdGhpbmcgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHVucmVnaXN0ZXJEZXBlbmRhbnQoIHRoaW5nICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fSggZ2xvYmFsX3J1bmxvb3AsIHNoYXJlZF91bnJlZ2lzdGVyRGVwZW5kYW50ICk7XG5cblx0dmFyIHJlbmRlcl9zaGFyZWRfRXZhbHVhdG9yX1JlZmVyZW5jZSA9IGZ1bmN0aW9uKCB0eXBlcywgaXNFcXVhbCwgZGVmaW5lUHJvcGVydHksIHJlZ2lzdGVyRGVwZW5kYW50LCB1bnJlZ2lzdGVyRGVwZW5kYW50ICkge1xuXG5cdFx0dmFyIFJlZmVyZW5jZSwgdGhpc1BhdHRlcm47XG5cdFx0dGhpc1BhdHRlcm4gPSAvdGhpcy87XG5cdFx0UmVmZXJlbmNlID0gZnVuY3Rpb24oIHJvb3QsIGtleXBhdGgsIGV2YWx1YXRvciwgYXJnTnVtLCBwcmlvcml0eSApIHtcblx0XHRcdHZhciB2YWx1ZTtcblx0XHRcdHRoaXMuZXZhbHVhdG9yID0gZXZhbHVhdG9yO1xuXHRcdFx0dGhpcy5rZXlwYXRoID0ga2V5cGF0aDtcblx0XHRcdHRoaXMucm9vdCA9IHJvb3Q7XG5cdFx0XHR0aGlzLmFyZ051bSA9IGFyZ051bTtcblx0XHRcdHRoaXMudHlwZSA9IHR5cGVzLlJFRkVSRU5DRTtcblx0XHRcdHRoaXMucHJpb3JpdHkgPSBwcmlvcml0eTtcblx0XHRcdHZhbHVlID0gcm9vdC5nZXQoIGtleXBhdGggKTtcblx0XHRcdGlmICggdHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0XHR2YWx1ZSA9IHdyYXBGdW5jdGlvbiggdmFsdWUsIHJvb3QsIGV2YWx1YXRvciApO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy52YWx1ZSA9IGV2YWx1YXRvci52YWx1ZXNbIGFyZ051bSBdID0gdmFsdWU7XG5cdFx0XHRyZWdpc3RlckRlcGVuZGFudCggdGhpcyApO1xuXHRcdH07XG5cdFx0UmVmZXJlbmNlLnByb3RvdHlwZSA9IHtcblx0XHRcdHVwZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciB2YWx1ZSA9IHRoaXMucm9vdC5nZXQoIHRoaXMua2V5cGF0aCApO1xuXHRcdFx0XHRpZiAoIHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyAmJiAhdmFsdWUuX25vd3JhcCApIHtcblx0XHRcdFx0XHR2YWx1ZSA9IHdyYXBGdW5jdGlvbiggdmFsdWUsIHRoaXMucm9vdCwgdGhpcy5ldmFsdWF0b3IgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoICFpc0VxdWFsKCB2YWx1ZSwgdGhpcy52YWx1ZSApICkge1xuXHRcdFx0XHRcdHRoaXMuZXZhbHVhdG9yLnZhbHVlc1sgdGhpcy5hcmdOdW0gXSA9IHZhbHVlO1xuXHRcdFx0XHRcdHRoaXMuZXZhbHVhdG9yLmJ1YmJsZSgpO1xuXHRcdFx0XHRcdHRoaXMudmFsdWUgPSB2YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dW5yZWdpc3RlckRlcGVuZGFudCggdGhpcyApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIFJlZmVyZW5jZTtcblxuXHRcdGZ1bmN0aW9uIHdyYXBGdW5jdGlvbiggZm4sIHJhY3RpdmUsIGV2YWx1YXRvciApIHtcblx0XHRcdHZhciBwcm9wLCBldmFsdWF0b3JzLCBpbmRleDtcblx0XHRcdGlmICggIXRoaXNQYXR0ZXJuLnRlc3QoIGZuLnRvU3RyaW5nKCkgKSApIHtcblx0XHRcdFx0ZGVmaW5lUHJvcGVydHkoIGZuLCAnX25vd3JhcCcsIHtcblx0XHRcdFx0XHR2YWx1ZTogdHJ1ZVxuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdHJldHVybiBmbjtcblx0XHRcdH1cblx0XHRcdGlmICggIWZuWyAnXycgKyByYWN0aXZlLl9ndWlkIF0gKSB7XG5cdFx0XHRcdGRlZmluZVByb3BlcnR5KCBmbiwgJ18nICsgcmFjdGl2ZS5fZ3VpZCwge1xuXHRcdFx0XHRcdHZhbHVlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdHZhciBvcmlnaW5hbENhcHR1cmVkLCByZXN1bHQsIGksIGV2YWx1YXRvcjtcblx0XHRcdFx0XHRcdG9yaWdpbmFsQ2FwdHVyZWQgPSByYWN0aXZlLl9jYXB0dXJlZDtcblx0XHRcdFx0XHRcdGlmICggIW9yaWdpbmFsQ2FwdHVyZWQgKSB7XG5cdFx0XHRcdFx0XHRcdHJhY3RpdmUuX2NhcHR1cmVkID0gW107XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRyZXN1bHQgPSBmbi5hcHBseSggcmFjdGl2ZSwgYXJndW1lbnRzICk7XG5cdFx0XHRcdFx0XHRpZiAoIHJhY3RpdmUuX2NhcHR1cmVkLmxlbmd0aCApIHtcblx0XHRcdFx0XHRcdFx0aSA9IGV2YWx1YXRvcnMubGVuZ3RoO1xuXHRcdFx0XHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRcdFx0XHRldmFsdWF0b3IgPSBldmFsdWF0b3JzWyBpIF07XG5cdFx0XHRcdFx0XHRcdFx0ZXZhbHVhdG9yLnVwZGF0ZVNvZnREZXBlbmRlbmNpZXMoIHJhY3RpdmUuX2NhcHR1cmVkICk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHJhY3RpdmUuX2NhcHR1cmVkID0gb3JpZ2luYWxDYXB0dXJlZDtcblx0XHRcdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR3cml0YWJsZTogdHJ1ZVxuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdGZvciAoIHByb3AgaW4gZm4gKSB7XG5cdFx0XHRcdFx0aWYgKCBmbi5oYXNPd25Qcm9wZXJ0eSggcHJvcCApICkge1xuXHRcdFx0XHRcdFx0Zm5bICdfJyArIHJhY3RpdmUuX2d1aWQgXVsgcHJvcCBdID0gZm5bIHByb3AgXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0Zm5bICdfJyArIHJhY3RpdmUuX2d1aWQgKyAnX2V2YWx1YXRvcnMnIF0gPSBbXTtcblx0XHRcdH1cblx0XHRcdGV2YWx1YXRvcnMgPSBmblsgJ18nICsgcmFjdGl2ZS5fZ3VpZCArICdfZXZhbHVhdG9ycycgXTtcblx0XHRcdGluZGV4ID0gZXZhbHVhdG9ycy5pbmRleE9mKCBldmFsdWF0b3IgKTtcblx0XHRcdGlmICggaW5kZXggPT09IC0xICkge1xuXHRcdFx0XHRldmFsdWF0b3JzLnB1c2goIGV2YWx1YXRvciApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGZuWyAnXycgKyByYWN0aXZlLl9ndWlkIF07XG5cdFx0fVxuXHR9KCBjb25maWdfdHlwZXMsIHV0aWxzX2lzRXF1YWwsIHV0aWxzX2RlZmluZVByb3BlcnR5LCBzaGFyZWRfcmVnaXN0ZXJEZXBlbmRhbnQsIHNoYXJlZF91bnJlZ2lzdGVyRGVwZW5kYW50ICk7XG5cblx0dmFyIHJlbmRlcl9zaGFyZWRfRXZhbHVhdG9yX1NvZnRSZWZlcmVuY2UgPSBmdW5jdGlvbiggaXNFcXVhbCwgcmVnaXN0ZXJEZXBlbmRhbnQsIHVucmVnaXN0ZXJEZXBlbmRhbnQgKSB7XG5cblx0XHR2YXIgU29mdFJlZmVyZW5jZSA9IGZ1bmN0aW9uKCByb290LCBrZXlwYXRoLCBldmFsdWF0b3IgKSB7XG5cdFx0XHR0aGlzLnJvb3QgPSByb290O1xuXHRcdFx0dGhpcy5rZXlwYXRoID0ga2V5cGF0aDtcblx0XHRcdHRoaXMucHJpb3JpdHkgPSBldmFsdWF0b3IucHJpb3JpdHk7XG5cdFx0XHR0aGlzLmV2YWx1YXRvciA9IGV2YWx1YXRvcjtcblx0XHRcdHJlZ2lzdGVyRGVwZW5kYW50KCB0aGlzICk7XG5cdFx0fTtcblx0XHRTb2Z0UmVmZXJlbmNlLnByb3RvdHlwZSA9IHtcblx0XHRcdHVwZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciB2YWx1ZSA9IHRoaXMucm9vdC5nZXQoIHRoaXMua2V5cGF0aCApO1xuXHRcdFx0XHRpZiAoICFpc0VxdWFsKCB2YWx1ZSwgdGhpcy52YWx1ZSApICkge1xuXHRcdFx0XHRcdHRoaXMuZXZhbHVhdG9yLmJ1YmJsZSgpO1xuXHRcdFx0XHRcdHRoaXMudmFsdWUgPSB2YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dW5yZWdpc3RlckRlcGVuZGFudCggdGhpcyApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIFNvZnRSZWZlcmVuY2U7XG5cdH0oIHV0aWxzX2lzRXF1YWwsIHNoYXJlZF9yZWdpc3RlckRlcGVuZGFudCwgc2hhcmVkX3VucmVnaXN0ZXJEZXBlbmRhbnQgKTtcblxuXHR2YXIgcmVuZGVyX3NoYXJlZF9FdmFsdWF0b3JfX0V2YWx1YXRvciA9IGZ1bmN0aW9uKCBydW5sb29wLCB3YXJuLCBpc0VxdWFsLCBjbGVhckNhY2hlLCBub3RpZnlEZXBlbmRhbnRzLCBhZGFwdElmTmVjZXNzYXJ5LCBSZWZlcmVuY2UsIFNvZnRSZWZlcmVuY2UgKSB7XG5cblx0XHR2YXIgRXZhbHVhdG9yLCBjYWNoZSA9IHt9O1xuXHRcdEV2YWx1YXRvciA9IGZ1bmN0aW9uKCByb290LCBrZXlwYXRoLCB1bmlxdWVTdHJpbmcsIGZ1bmN0aW9uU3RyLCBhcmdzLCBwcmlvcml0eSApIHtcblx0XHRcdHZhciBpLCBhcmc7XG5cdFx0XHR0aGlzLnJvb3QgPSByb290O1xuXHRcdFx0dGhpcy51bmlxdWVTdHJpbmcgPSB1bmlxdWVTdHJpbmc7XG5cdFx0XHR0aGlzLmtleXBhdGggPSBrZXlwYXRoO1xuXHRcdFx0dGhpcy5wcmlvcml0eSA9IHByaW9yaXR5O1xuXHRcdFx0dGhpcy5mbiA9IGdldEZ1bmN0aW9uRnJvbVN0cmluZyggZnVuY3Rpb25TdHIsIGFyZ3MubGVuZ3RoICk7XG5cdFx0XHR0aGlzLnZhbHVlcyA9IFtdO1xuXHRcdFx0dGhpcy5yZWZzID0gW107XG5cdFx0XHRpID0gYXJncy5sZW5ndGg7XG5cdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0aWYgKCBhcmcgPSBhcmdzWyBpIF0gKSB7XG5cdFx0XHRcdFx0aWYgKCBhcmdbIDAgXSApIHtcblx0XHRcdFx0XHRcdHRoaXMudmFsdWVzWyBpIF0gPSBhcmdbIDEgXTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhpcy5yZWZzLnB1c2goIG5ldyBSZWZlcmVuY2UoIHJvb3QsIGFyZ1sgMSBdLCB0aGlzLCBpLCBwcmlvcml0eSApICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMudmFsdWVzWyBpIF0gPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHRoaXMuc2VsZlVwZGF0aW5nID0gdGhpcy5yZWZzLmxlbmd0aCA8PSAxO1xuXHRcdH07XG5cdFx0RXZhbHVhdG9yLnByb3RvdHlwZSA9IHtcblx0XHRcdGJ1YmJsZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmICggdGhpcy5zZWxmVXBkYXRpbmcgKSB7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGUoKTtcblx0XHRcdFx0fSBlbHNlIGlmICggIXRoaXMuZGVmZXJyZWQgKSB7XG5cdFx0XHRcdFx0cnVubG9vcC5hZGRFdmFsdWF0b3IoIHRoaXMgKTtcblx0XHRcdFx0XHR0aGlzLmRlZmVycmVkID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHVwZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciB2YWx1ZTtcblx0XHRcdFx0aWYgKCB0aGlzLmV2YWx1YXRpbmcgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5ldmFsdWF0aW5nID0gdHJ1ZTtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHR2YWx1ZSA9IHRoaXMuZm4uYXBwbHkoIG51bGwsIHRoaXMudmFsdWVzICk7XG5cdFx0XHRcdH0gY2F0Y2ggKCBlcnIgKSB7XG5cdFx0XHRcdFx0aWYgKCB0aGlzLnJvb3QuZGVidWcgKSB7XG5cdFx0XHRcdFx0XHR3YXJuKCAnRXJyb3IgZXZhbHVhdGluZyBcIicgKyB0aGlzLnVuaXF1ZVN0cmluZyArICdcIjogJyArIGVyci5tZXNzYWdlIHx8IGVyciApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR2YWx1ZSA9IHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoICFpc0VxdWFsKCB2YWx1ZSwgdGhpcy52YWx1ZSApICkge1xuXHRcdFx0XHRcdHRoaXMudmFsdWUgPSB2YWx1ZTtcblx0XHRcdFx0XHRjbGVhckNhY2hlKCB0aGlzLnJvb3QsIHRoaXMua2V5cGF0aCApO1xuXHRcdFx0XHRcdGFkYXB0SWZOZWNlc3NhcnkoIHRoaXMucm9vdCwgdGhpcy5rZXlwYXRoLCB2YWx1ZSwgdHJ1ZSApO1xuXHRcdFx0XHRcdG5vdGlmeURlcGVuZGFudHMoIHRoaXMucm9vdCwgdGhpcy5rZXlwYXRoICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5ldmFsdWF0aW5nID0gZmFsc2U7XG5cdFx0XHRcdHJldHVybiB0aGlzO1xuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0d2hpbGUgKCB0aGlzLnJlZnMubGVuZ3RoICkge1xuXHRcdFx0XHRcdHRoaXMucmVmcy5wb3AoKS50ZWFyZG93bigpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNsZWFyQ2FjaGUoIHRoaXMucm9vdCwgdGhpcy5rZXlwYXRoICk7XG5cdFx0XHRcdHRoaXMucm9vdC5fZXZhbHVhdG9yc1sgdGhpcy5rZXlwYXRoIF0gPSBudWxsO1xuXHRcdFx0fSxcblx0XHRcdHJlZnJlc2g6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZiAoICF0aGlzLnNlbGZVcGRhdGluZyApIHtcblx0XHRcdFx0XHR0aGlzLmRlZmVycmVkID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHR2YXIgaSA9IHRoaXMucmVmcy5sZW5ndGg7XG5cdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdHRoaXMucmVmc1sgaSBdLnVwZGF0ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggdGhpcy5kZWZlcnJlZCApIHtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZSgpO1xuXHRcdFx0XHRcdHRoaXMuZGVmZXJyZWQgPSBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHVwZGF0ZVNvZnREZXBlbmRlbmNpZXM6IGZ1bmN0aW9uKCBzb2Z0RGVwcyApIHtcblx0XHRcdFx0dmFyIGksIGtleXBhdGgsIHJlZjtcblx0XHRcdFx0aWYgKCAhdGhpcy5zb2Z0UmVmcyApIHtcblx0XHRcdFx0XHR0aGlzLnNvZnRSZWZzID0gW107XG5cdFx0XHRcdH1cblx0XHRcdFx0aSA9IHRoaXMuc29mdFJlZnMubGVuZ3RoO1xuXHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRyZWYgPSB0aGlzLnNvZnRSZWZzWyBpIF07XG5cdFx0XHRcdFx0aWYgKCAhc29mdERlcHNbIHJlZi5rZXlwYXRoIF0gKSB7XG5cdFx0XHRcdFx0XHR0aGlzLnNvZnRSZWZzLnNwbGljZSggaSwgMSApO1xuXHRcdFx0XHRcdFx0dGhpcy5zb2Z0UmVmc1sgcmVmLmtleXBhdGggXSA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0cmVmLnRlYXJkb3duKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGkgPSBzb2Z0RGVwcy5sZW5ndGg7XG5cdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdGtleXBhdGggPSBzb2Z0RGVwc1sgaSBdO1xuXHRcdFx0XHRcdGlmICggIXRoaXMuc29mdFJlZnNbIGtleXBhdGggXSApIHtcblx0XHRcdFx0XHRcdHJlZiA9IG5ldyBTb2Z0UmVmZXJlbmNlKCB0aGlzLnJvb3QsIGtleXBhdGgsIHRoaXMgKTtcblx0XHRcdFx0XHRcdHRoaXMuc29mdFJlZnMucHVzaCggcmVmICk7XG5cdFx0XHRcdFx0XHR0aGlzLnNvZnRSZWZzWyBrZXlwYXRoIF0gPSB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLnNlbGZVcGRhdGluZyA9IHRoaXMucmVmcy5sZW5ndGggKyB0aGlzLnNvZnRSZWZzLmxlbmd0aCA8PSAxO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIEV2YWx1YXRvcjtcblxuXHRcdGZ1bmN0aW9uIGdldEZ1bmN0aW9uRnJvbVN0cmluZyggc3RyLCBpICkge1xuXHRcdFx0dmFyIGZuLCBhcmdzO1xuXHRcdFx0c3RyID0gc3RyLnJlcGxhY2UoIC9cXCRcXHsoWzAtOV0rKVxcfS9nLCAnXyQxJyApO1xuXHRcdFx0aWYgKCBjYWNoZVsgc3RyIF0gKSB7XG5cdFx0XHRcdHJldHVybiBjYWNoZVsgc3RyIF07XG5cdFx0XHR9XG5cdFx0XHRhcmdzID0gW107XG5cdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0YXJnc1sgaSBdID0gJ18nICsgaTtcblx0XHRcdH1cblx0XHRcdGZuID0gbmV3IEZ1bmN0aW9uKCBhcmdzLmpvaW4oICcsJyApLCAncmV0dXJuKCcgKyBzdHIgKyAnKScgKTtcblx0XHRcdGNhY2hlWyBzdHIgXSA9IGZuO1xuXHRcdFx0cmV0dXJuIGZuO1xuXHRcdH1cblx0fSggZ2xvYmFsX3J1bmxvb3AsIHV0aWxzX3dhcm4sIHV0aWxzX2lzRXF1YWwsIHNoYXJlZF9jbGVhckNhY2hlLCBzaGFyZWRfbm90aWZ5RGVwZW5kYW50cywgc2hhcmVkX2FkYXB0SWZOZWNlc3NhcnksIHJlbmRlcl9zaGFyZWRfRXZhbHVhdG9yX1JlZmVyZW5jZSwgcmVuZGVyX3NoYXJlZF9FdmFsdWF0b3JfU29mdFJlZmVyZW5jZSApO1xuXG5cdHZhciByZW5kZXJfc2hhcmVkX0V4cHJlc3Npb25SZXNvbHZlcl9SZWZlcmVuY2VTY291dCA9IGZ1bmN0aW9uKCBydW5sb29wLCByZXNvbHZlUmVmLCB0ZWFyZG93biApIHtcblxuXHRcdHZhciBSZWZlcmVuY2VTY291dCA9IGZ1bmN0aW9uKCByZXNvbHZlciwgcmVmLCBwYXJlbnRGcmFnbWVudCwgYXJnTnVtICkge1xuXHRcdFx0dmFyIGtleXBhdGgsIHJhY3RpdmU7XG5cdFx0XHRyYWN0aXZlID0gdGhpcy5yb290ID0gcmVzb2x2ZXIucm9vdDtcblx0XHRcdHRoaXMucmVmID0gcmVmO1xuXHRcdFx0dGhpcy5wYXJlbnRGcmFnbWVudCA9IHBhcmVudEZyYWdtZW50O1xuXHRcdFx0a2V5cGF0aCA9IHJlc29sdmVSZWYoIHJhY3RpdmUsIHJlZiwgcGFyZW50RnJhZ21lbnQgKTtcblx0XHRcdGlmICgga2V5cGF0aCAhPT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRyZXNvbHZlci5yZXNvbHZlKCBhcmdOdW0sIGZhbHNlLCBrZXlwYXRoICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmFyZ051bSA9IGFyZ051bTtcblx0XHRcdFx0dGhpcy5yZXNvbHZlciA9IHJlc29sdmVyO1xuXHRcdFx0XHRydW5sb29wLmFkZFVucmVzb2x2ZWQoIHRoaXMgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdFJlZmVyZW5jZVNjb3V0LnByb3RvdHlwZSA9IHtcblx0XHRcdHJlc29sdmU6IGZ1bmN0aW9uKCBrZXlwYXRoICkge1xuXHRcdFx0XHR0aGlzLmtleXBhdGggPSBrZXlwYXRoO1xuXHRcdFx0XHR0aGlzLnJlc29sdmVyLnJlc29sdmUoIHRoaXMuYXJnTnVtLCBmYWxzZSwga2V5cGF0aCApO1xuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0aWYgKCAhdGhpcy5rZXlwYXRoICkge1xuXHRcdFx0XHRcdHRlYXJkb3duKCB0aGlzICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBSZWZlcmVuY2VTY291dDtcblx0fSggZ2xvYmFsX3J1bmxvb3AsIHNoYXJlZF9yZXNvbHZlUmVmLCBzaGFyZWRfdGVhcmRvd24gKTtcblxuXHR2YXIgcmVuZGVyX3NoYXJlZF9FeHByZXNzaW9uUmVzb2x2ZXJfZ2V0VW5pcXVlU3RyaW5nID0gZnVuY3Rpb24oIHN0ciwgYXJncyApIHtcblx0XHRyZXR1cm4gc3RyLnJlcGxhY2UoIC9cXCRcXHsoWzAtOV0rKVxcfS9nLCBmdW5jdGlvbiggbWF0Y2gsICQxICkge1xuXHRcdFx0cmV0dXJuIGFyZ3NbICQxIF0gPyBhcmdzWyAkMSBdWyAxIF0gOiAndW5kZWZpbmVkJztcblx0XHR9ICk7XG5cdH07XG5cblx0dmFyIHJlbmRlcl9zaGFyZWRfRXhwcmVzc2lvblJlc29sdmVyX2lzUmVndWxhcktleXBhdGggPSBmdW5jdGlvbigpIHtcblxuXHRcdHZhciBrZXlQYXR0ZXJuID0gL14oPzooPzpbYS16QS1aJF9dW2EtekEtWiRfMC05XSopfCg/OlswLTldfFsxLTldWzAtOV0rKSkkLztcblx0XHRyZXR1cm4gZnVuY3Rpb24oIGtleXBhdGggKSB7XG5cdFx0XHR2YXIga2V5cywga2V5LCBpO1xuXHRcdFx0a2V5cyA9IGtleXBhdGguc3BsaXQoICcuJyApO1xuXHRcdFx0aSA9IGtleXMubGVuZ3RoO1xuXHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdGtleSA9IGtleXNbIGkgXTtcblx0XHRcdFx0aWYgKCBrZXkgPT09ICd1bmRlZmluZWQnIHx8ICFrZXlQYXR0ZXJuLnRlc3QoIGtleSApICkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fTtcblx0fSgpO1xuXG5cdHZhciByZW5kZXJfc2hhcmVkX0V4cHJlc3Npb25SZXNvbHZlcl9nZXRLZXlwYXRoID0gZnVuY3Rpb24oIG5vcm1hbGlzZUtleXBhdGgsIGlzUmVndWxhcktleXBhdGggKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHVuaXF1ZVN0cmluZyApIHtcblx0XHRcdHZhciBub3JtYWxpc2VkO1xuXHRcdFx0bm9ybWFsaXNlZCA9IG5vcm1hbGlzZUtleXBhdGgoIHVuaXF1ZVN0cmluZyApO1xuXHRcdFx0aWYgKCBpc1JlZ3VsYXJLZXlwYXRoKCBub3JtYWxpc2VkICkgKSB7XG5cdFx0XHRcdHJldHVybiBub3JtYWxpc2VkO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuICckeycgKyBub3JtYWxpc2VkLnJlcGxhY2UoIC9bXFwuXFxbXFxdXS9nLCAnLScgKSArICd9Jztcblx0XHR9O1xuXHR9KCB1dGlsc19ub3JtYWxpc2VLZXlwYXRoLCByZW5kZXJfc2hhcmVkX0V4cHJlc3Npb25SZXNvbHZlcl9pc1JlZ3VsYXJLZXlwYXRoICk7XG5cblx0dmFyIHJlbmRlcl9zaGFyZWRfRXhwcmVzc2lvblJlc29sdmVyX19FeHByZXNzaW9uUmVzb2x2ZXIgPSBmdW5jdGlvbiggRXZhbHVhdG9yLCBSZWZlcmVuY2VTY291dCwgZ2V0VW5pcXVlU3RyaW5nLCBnZXRLZXlwYXRoICkge1xuXG5cdFx0dmFyIEV4cHJlc3Npb25SZXNvbHZlciA9IGZ1bmN0aW9uKCBtdXN0YWNoZSApIHtcblx0XHRcdHZhciBleHByZXNzaW9uLCBpLCBsZW4sIHJlZiwgaW5kZXhSZWZzO1xuXHRcdFx0dGhpcy5yb290ID0gbXVzdGFjaGUucm9vdDtcblx0XHRcdHRoaXMubXVzdGFjaGUgPSBtdXN0YWNoZTtcblx0XHRcdHRoaXMuYXJncyA9IFtdO1xuXHRcdFx0dGhpcy5zY291dHMgPSBbXTtcblx0XHRcdGV4cHJlc3Npb24gPSBtdXN0YWNoZS5kZXNjcmlwdG9yLng7XG5cdFx0XHRpbmRleFJlZnMgPSBtdXN0YWNoZS5wYXJlbnRGcmFnbWVudC5pbmRleFJlZnM7XG5cdFx0XHR0aGlzLnN0ciA9IGV4cHJlc3Npb24ucztcblx0XHRcdGxlbiA9IHRoaXMudW5yZXNvbHZlZCA9IHRoaXMuYXJncy5sZW5ndGggPSBleHByZXNzaW9uLnIgPyBleHByZXNzaW9uLnIubGVuZ3RoIDogMDtcblx0XHRcdGlmICggIWxlbiApIHtcblx0XHRcdFx0dGhpcy5yZXNvbHZlZCA9IHRoaXMucmVhZHkgPSB0cnVlO1xuXHRcdFx0XHR0aGlzLmJ1YmJsZSgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRyZWYgPSBleHByZXNzaW9uLnJbIGkgXTtcblx0XHRcdFx0aWYgKCBpbmRleFJlZnMgJiYgaW5kZXhSZWZzWyByZWYgXSAhPT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRcdHRoaXMucmVzb2x2ZSggaSwgdHJ1ZSwgaW5kZXhSZWZzWyByZWYgXSApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuc2NvdXRzLnB1c2goIG5ldyBSZWZlcmVuY2VTY291dCggdGhpcywgcmVmLCBtdXN0YWNoZS5wYXJlbnRGcmFnbWVudCwgaSApICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHRoaXMucmVhZHkgPSB0cnVlO1xuXHRcdFx0dGhpcy5idWJibGUoKTtcblx0XHR9O1xuXHRcdEV4cHJlc3Npb25SZXNvbHZlci5wcm90b3R5cGUgPSB7XG5cdFx0XHRidWJibGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgb2xkS2V5cGF0aDtcblx0XHRcdFx0aWYgKCAhdGhpcy5yZWFkeSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0b2xkS2V5cGF0aCA9IHRoaXMua2V5cGF0aDtcblx0XHRcdFx0dGhpcy51bmlxdWVTdHJpbmcgPSBnZXRVbmlxdWVTdHJpbmcoIHRoaXMuc3RyLCB0aGlzLmFyZ3MgKTtcblx0XHRcdFx0dGhpcy5rZXlwYXRoID0gZ2V0S2V5cGF0aCggdGhpcy51bmlxdWVTdHJpbmcgKTtcblx0XHRcdFx0aWYgKCB0aGlzLmtleXBhdGguc3Vic3RyKCAwLCAyICkgPT09ICckeycgKSB7XG5cdFx0XHRcdFx0dGhpcy5jcmVhdGVFdmFsdWF0b3IoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLm11c3RhY2hlLnJlc29sdmUoIHRoaXMua2V5cGF0aCApO1xuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0d2hpbGUgKCB0aGlzLnNjb3V0cy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0dGhpcy5zY291dHMucG9wKCkudGVhcmRvd24oKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHJlc29sdmU6IGZ1bmN0aW9uKCBhcmdOdW0sIGlzSW5kZXhSZWYsIHZhbHVlICkge1xuXHRcdFx0XHR0aGlzLmFyZ3NbIGFyZ051bSBdID0gW1xuXHRcdFx0XHRcdGlzSW5kZXhSZWYsXG5cdFx0XHRcdFx0dmFsdWVcblx0XHRcdFx0XTtcblx0XHRcdFx0dGhpcy5idWJibGUoKTtcblx0XHRcdFx0dGhpcy5yZXNvbHZlZCA9ICEtLXRoaXMudW5yZXNvbHZlZDtcblx0XHRcdH0sXG5cdFx0XHRjcmVhdGVFdmFsdWF0b3I6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgZXZhbHVhdG9yO1xuXHRcdFx0XHRpZiAoICF0aGlzLnJvb3QuX2V2YWx1YXRvcnNbIHRoaXMua2V5cGF0aCBdICkge1xuXHRcdFx0XHRcdGV2YWx1YXRvciA9IG5ldyBFdmFsdWF0b3IoIHRoaXMucm9vdCwgdGhpcy5rZXlwYXRoLCB0aGlzLnVuaXF1ZVN0cmluZywgdGhpcy5zdHIsIHRoaXMuYXJncywgdGhpcy5tdXN0YWNoZS5wcmlvcml0eSApO1xuXHRcdFx0XHRcdHRoaXMucm9vdC5fZXZhbHVhdG9yc1sgdGhpcy5rZXlwYXRoIF0gPSBldmFsdWF0b3I7XG5cdFx0XHRcdFx0ZXZhbHVhdG9yLnVwZGF0ZSgpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMucm9vdC5fZXZhbHVhdG9yc1sgdGhpcy5rZXlwYXRoIF0ucmVmcmVzaCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gRXhwcmVzc2lvblJlc29sdmVyO1xuXHR9KCByZW5kZXJfc2hhcmVkX0V2YWx1YXRvcl9fRXZhbHVhdG9yLCByZW5kZXJfc2hhcmVkX0V4cHJlc3Npb25SZXNvbHZlcl9SZWZlcmVuY2VTY291dCwgcmVuZGVyX3NoYXJlZF9FeHByZXNzaW9uUmVzb2x2ZXJfZ2V0VW5pcXVlU3RyaW5nLCByZW5kZXJfc2hhcmVkX0V4cHJlc3Npb25SZXNvbHZlcl9nZXRLZXlwYXRoICk7XG5cblx0dmFyIHJlbmRlcl9zaGFyZWRfaW5pdE11c3RhY2hlID0gZnVuY3Rpb24oIHJ1bmxvb3AsIHJlc29sdmVSZWYsIEV4cHJlc3Npb25SZXNvbHZlciApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiBpbml0TXVzdGFjaGUoIG11c3RhY2hlLCBvcHRpb25zICkge1xuXHRcdFx0dmFyIGtleXBhdGgsIGluZGV4UmVmLCBwYXJlbnRGcmFnbWVudDtcblx0XHRcdHBhcmVudEZyYWdtZW50ID0gbXVzdGFjaGUucGFyZW50RnJhZ21lbnQgPSBvcHRpb25zLnBhcmVudEZyYWdtZW50O1xuXHRcdFx0bXVzdGFjaGUucm9vdCA9IHBhcmVudEZyYWdtZW50LnJvb3Q7XG5cdFx0XHRtdXN0YWNoZS5kZXNjcmlwdG9yID0gb3B0aW9ucy5kZXNjcmlwdG9yO1xuXHRcdFx0bXVzdGFjaGUuaW5kZXggPSBvcHRpb25zLmluZGV4IHx8IDA7XG5cdFx0XHRtdXN0YWNoZS5wcmlvcml0eSA9IHBhcmVudEZyYWdtZW50LnByaW9yaXR5O1xuXHRcdFx0bXVzdGFjaGUudHlwZSA9IG9wdGlvbnMuZGVzY3JpcHRvci50O1xuXHRcdFx0aWYgKCBvcHRpb25zLmRlc2NyaXB0b3IuciApIHtcblx0XHRcdFx0aWYgKCBwYXJlbnRGcmFnbWVudC5pbmRleFJlZnMgJiYgcGFyZW50RnJhZ21lbnQuaW5kZXhSZWZzWyBvcHRpb25zLmRlc2NyaXB0b3IuciBdICE9PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdFx0aW5kZXhSZWYgPSBwYXJlbnRGcmFnbWVudC5pbmRleFJlZnNbIG9wdGlvbnMuZGVzY3JpcHRvci5yIF07XG5cdFx0XHRcdFx0bXVzdGFjaGUuaW5kZXhSZWYgPSBvcHRpb25zLmRlc2NyaXB0b3Iucjtcblx0XHRcdFx0XHRtdXN0YWNoZS52YWx1ZSA9IGluZGV4UmVmO1xuXHRcdFx0XHRcdG11c3RhY2hlLnJlbmRlciggbXVzdGFjaGUudmFsdWUgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRrZXlwYXRoID0gcmVzb2x2ZVJlZiggbXVzdGFjaGUucm9vdCwgb3B0aW9ucy5kZXNjcmlwdG9yLnIsIG11c3RhY2hlLnBhcmVudEZyYWdtZW50ICk7XG5cdFx0XHRcdFx0aWYgKCBrZXlwYXRoICE9PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdFx0XHRtdXN0YWNoZS5yZXNvbHZlKCBrZXlwYXRoICk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdG11c3RhY2hlLnJlZiA9IG9wdGlvbnMuZGVzY3JpcHRvci5yO1xuXHRcdFx0XHRcdFx0cnVubG9vcC5hZGRVbnJlc29sdmVkKCBtdXN0YWNoZSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCBvcHRpb25zLmRlc2NyaXB0b3IueCApIHtcblx0XHRcdFx0bXVzdGFjaGUuZXhwcmVzc2lvblJlc29sdmVyID0gbmV3IEV4cHJlc3Npb25SZXNvbHZlciggbXVzdGFjaGUgKTtcblx0XHRcdH1cblx0XHRcdGlmICggbXVzdGFjaGUuZGVzY3JpcHRvci5uICYmICFtdXN0YWNoZS5oYXNPd25Qcm9wZXJ0eSggJ3ZhbHVlJyApICkge1xuXHRcdFx0XHRtdXN0YWNoZS5yZW5kZXIoIHVuZGVmaW5lZCApO1xuXHRcdFx0fVxuXHRcdH07XG5cdH0oIGdsb2JhbF9ydW5sb29wLCBzaGFyZWRfcmVzb2x2ZVJlZiwgcmVuZGVyX3NoYXJlZF9FeHByZXNzaW9uUmVzb2x2ZXJfX0V4cHJlc3Npb25SZXNvbHZlciApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfU2VjdGlvbl9yZWFzc2lnbkZyYWdtZW50ID0gZnVuY3Rpb24oIHR5cGVzLCBFeHByZXNzaW9uUmVzb2x2ZXIgKSB7XG5cblx0XHRyZXR1cm4gcmVhc3NpZ25GcmFnbWVudDtcblxuXHRcdGZ1bmN0aW9uIHJlYXNzaWduRnJhZ21lbnQoIGZyYWdtZW50LCBpbmRleFJlZiwgbmV3SW5kZXgsIG9sZEtleXBhdGgsIG5ld0tleXBhdGggKSB7XG5cdFx0XHR2YXIgaSwgaXRlbSwgcXVlcnk7XG5cdFx0XHRpZiAoIGZyYWdtZW50Lmh0bWwgIT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0YXNzaWduTmV3S2V5cGF0aCggZnJhZ21lbnQsICdjb250ZXh0Jywgb2xkS2V5cGF0aCwgbmV3S2V5cGF0aCApO1xuXHRcdFx0aWYgKCBmcmFnbWVudC5pbmRleFJlZnMgJiYgZnJhZ21lbnQuaW5kZXhSZWZzWyBpbmRleFJlZiBdICE9PSB1bmRlZmluZWQgJiYgZnJhZ21lbnQuaW5kZXhSZWZzWyBpbmRleFJlZiBdICE9PSBuZXdJbmRleCApIHtcblx0XHRcdFx0ZnJhZ21lbnQuaW5kZXhSZWZzWyBpbmRleFJlZiBdID0gbmV3SW5kZXg7XG5cdFx0XHR9XG5cdFx0XHRpID0gZnJhZ21lbnQuaXRlbXMubGVuZ3RoO1xuXHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdGl0ZW0gPSBmcmFnbWVudC5pdGVtc1sgaSBdO1xuXHRcdFx0XHRzd2l0Y2ggKCBpdGVtLnR5cGUgKSB7XG5cdFx0XHRcdFx0Y2FzZSB0eXBlcy5FTEVNRU5UOlxuXHRcdFx0XHRcdFx0cmVhc3NpZ25FbGVtZW50KCBpdGVtLCBpbmRleFJlZiwgbmV3SW5kZXgsIG9sZEtleXBhdGgsIG5ld0tleXBhdGggKTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGNhc2UgdHlwZXMuUEFSVElBTDpcblx0XHRcdFx0XHRcdHJlYXNzaWduRnJhZ21lbnQoIGl0ZW0uZnJhZ21lbnQsIGluZGV4UmVmLCBuZXdJbmRleCwgb2xkS2V5cGF0aCwgbmV3S2V5cGF0aCApO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSB0eXBlcy5DT01QT05FTlQ6XG5cdFx0XHRcdFx0XHRyZWFzc2lnbkZyYWdtZW50KCBpdGVtLmluc3RhbmNlLmZyYWdtZW50LCBpbmRleFJlZiwgbmV3SW5kZXgsIG9sZEtleXBhdGgsIG5ld0tleXBhdGggKTtcblx0XHRcdFx0XHRcdGlmICggcXVlcnkgPSBmcmFnbWVudC5yb290Ll9saXZlQ29tcG9uZW50UXVlcmllc1sgaXRlbS5uYW1lIF0gKSB7XG5cdFx0XHRcdFx0XHRcdHF1ZXJ5Ll9tYWtlRGlydHkoKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGNhc2UgdHlwZXMuU0VDVElPTjpcblx0XHRcdFx0XHRjYXNlIHR5cGVzLklOVEVSUE9MQVRPUjpcblx0XHRcdFx0XHRjYXNlIHR5cGVzLlRSSVBMRTpcblx0XHRcdFx0XHRcdHJlYXNzaWduTXVzdGFjaGUoIGl0ZW0sIGluZGV4UmVmLCBuZXdJbmRleCwgb2xkS2V5cGF0aCwgbmV3S2V5cGF0aCApO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRmdW5jdGlvbiBhc3NpZ25OZXdLZXlwYXRoKCB0YXJnZXQsIHByb3BlcnR5LCBvbGRLZXlwYXRoLCBuZXdLZXlwYXRoICkge1xuXHRcdFx0aWYgKCAhdGFyZ2V0WyBwcm9wZXJ0eSBdIHx8IHN0YXJ0c1dpdGgoIHRhcmdldFsgcHJvcGVydHkgXSwgbmV3S2V5cGF0aCApICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0YXJnZXRbIHByb3BlcnR5IF0gPSBnZXROZXdLZXlwYXRoKCB0YXJnZXRbIHByb3BlcnR5IF0sIG9sZEtleXBhdGgsIG5ld0tleXBhdGggKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBzdGFydHNXaXRoKCB0YXJnZXQsIGtleXBhdGggKSB7XG5cdFx0XHRyZXR1cm4gdGFyZ2V0ID09PSBrZXlwYXRoIHx8IHN0YXJ0c1dpdGhLZXlwYXRoKCB0YXJnZXQsIGtleXBhdGggKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBzdGFydHNXaXRoS2V5cGF0aCggdGFyZ2V0LCBrZXlwYXRoICkge1xuXHRcdFx0cmV0dXJuIHRhcmdldC5zdWJzdHIoIDAsIGtleXBhdGgubGVuZ3RoICsgMSApID09PSBrZXlwYXRoICsgJy4nO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldE5ld0tleXBhdGgoIHRhcmdldEtleXBhdGgsIG9sZEtleXBhdGgsIG5ld0tleXBhdGggKSB7XG5cdFx0XHRpZiAoIHRhcmdldEtleXBhdGggPT09IG9sZEtleXBhdGggKSB7XG5cdFx0XHRcdHJldHVybiBuZXdLZXlwYXRoO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBzdGFydHNXaXRoS2V5cGF0aCggdGFyZ2V0S2V5cGF0aCwgb2xkS2V5cGF0aCApICkge1xuXHRcdFx0XHRyZXR1cm4gdGFyZ2V0S2V5cGF0aC5yZXBsYWNlKCBvbGRLZXlwYXRoICsgJy4nLCBuZXdLZXlwYXRoICsgJy4nICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gcmVhc3NpZ25FbGVtZW50KCBlbGVtZW50LCBpbmRleFJlZiwgbmV3SW5kZXgsIG9sZEtleXBhdGgsIG5ld0tleXBhdGggKSB7XG5cdFx0XHR2YXIgaSwgYXR0cmlidXRlLCBzdG9yYWdlLCBtYXN0ZXJFdmVudE5hbWUsIHByb3hpZXMsIHByb3h5LCBiaW5kaW5nLCBiaW5kaW5ncywgbGl2ZVF1ZXJpZXMsIHJhY3RpdmU7XG5cdFx0XHRpID0gZWxlbWVudC5hdHRyaWJ1dGVzLmxlbmd0aDtcblx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRhdHRyaWJ1dGUgPSBlbGVtZW50LmF0dHJpYnV0ZXNbIGkgXTtcblx0XHRcdFx0aWYgKCBhdHRyaWJ1dGUuZnJhZ21lbnQgKSB7XG5cdFx0XHRcdFx0cmVhc3NpZ25GcmFnbWVudCggYXR0cmlidXRlLmZyYWdtZW50LCBpbmRleFJlZiwgbmV3SW5kZXgsIG9sZEtleXBhdGgsIG5ld0tleXBhdGggKTtcblx0XHRcdFx0XHRpZiAoIGF0dHJpYnV0ZS50d293YXkgKSB7XG5cdFx0XHRcdFx0XHRhdHRyaWJ1dGUudXBkYXRlQmluZGluZ3MoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICggc3RvcmFnZSA9IGVsZW1lbnQubm9kZS5fcmFjdGl2ZSApIHtcblx0XHRcdFx0YXNzaWduTmV3S2V5cGF0aCggc3RvcmFnZSwgJ2tleXBhdGgnLCBvbGRLZXlwYXRoLCBuZXdLZXlwYXRoICk7XG5cdFx0XHRcdGlmICggaW5kZXhSZWYgIT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRcdHN0b3JhZ2UuaW5kZXhbIGluZGV4UmVmIF0gPSBuZXdJbmRleDtcblx0XHRcdFx0fVxuXHRcdFx0XHRmb3IgKCBtYXN0ZXJFdmVudE5hbWUgaW4gc3RvcmFnZS5ldmVudHMgKSB7XG5cdFx0XHRcdFx0cHJveGllcyA9IHN0b3JhZ2UuZXZlbnRzWyBtYXN0ZXJFdmVudE5hbWUgXS5wcm94aWVzO1xuXHRcdFx0XHRcdGkgPSBwcm94aWVzLmxlbmd0aDtcblx0XHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRcdHByb3h5ID0gcHJveGllc1sgaSBdO1xuXHRcdFx0XHRcdFx0aWYgKCB0eXBlb2YgcHJveHkubiA9PT0gJ29iamVjdCcgKSB7XG5cdFx0XHRcdFx0XHRcdHJlYXNzaWduRnJhZ21lbnQoIHByb3h5LmEsIGluZGV4UmVmLCBuZXdJbmRleCwgb2xkS2V5cGF0aCwgbmV3S2V5cGF0aCApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKCBwcm94eS5kICkge1xuXHRcdFx0XHRcdFx0XHRyZWFzc2lnbkZyYWdtZW50KCBwcm94eS5kLCBpbmRleFJlZiwgbmV3SW5kZXgsIG9sZEtleXBhdGgsIG5ld0tleXBhdGggKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBiaW5kaW5nID0gc3RvcmFnZS5iaW5kaW5nICkge1xuXHRcdFx0XHRcdGlmICggYmluZGluZy5rZXlwYXRoLnN1YnN0ciggMCwgb2xkS2V5cGF0aC5sZW5ndGggKSA9PT0gb2xkS2V5cGF0aCApIHtcblx0XHRcdFx0XHRcdGJpbmRpbmdzID0gc3RvcmFnZS5yb290Ll90d293YXlCaW5kaW5nc1sgYmluZGluZy5rZXlwYXRoIF07XG5cdFx0XHRcdFx0XHRiaW5kaW5ncy5zcGxpY2UoIGJpbmRpbmdzLmluZGV4T2YoIGJpbmRpbmcgKSwgMSApO1xuXHRcdFx0XHRcdFx0YmluZGluZy5rZXlwYXRoID0gYmluZGluZy5rZXlwYXRoLnJlcGxhY2UoIG9sZEtleXBhdGgsIG5ld0tleXBhdGggKTtcblx0XHRcdFx0XHRcdGJpbmRpbmdzID0gc3RvcmFnZS5yb290Ll90d293YXlCaW5kaW5nc1sgYmluZGluZy5rZXlwYXRoIF0gfHwgKCBzdG9yYWdlLnJvb3QuX3R3b3dheUJpbmRpbmdzWyBiaW5kaW5nLmtleXBhdGggXSA9IFtdICk7XG5cdFx0XHRcdFx0XHRiaW5kaW5ncy5wdXNoKCBiaW5kaW5nICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGVsZW1lbnQuZnJhZ21lbnQgKSB7XG5cdFx0XHRcdHJlYXNzaWduRnJhZ21lbnQoIGVsZW1lbnQuZnJhZ21lbnQsIGluZGV4UmVmLCBuZXdJbmRleCwgb2xkS2V5cGF0aCwgbmV3S2V5cGF0aCApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBsaXZlUXVlcmllcyA9IGVsZW1lbnQubGl2ZVF1ZXJpZXMgKSB7XG5cdFx0XHRcdHJhY3RpdmUgPSBlbGVtZW50LnJvb3Q7XG5cdFx0XHRcdGkgPSBsaXZlUXVlcmllcy5sZW5ndGg7XG5cdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdGxpdmVRdWVyaWVzWyBpIF0uX21ha2VEaXJ0eSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gcmVhc3NpZ25NdXN0YWNoZSggbXVzdGFjaGUsIGluZGV4UmVmLCBuZXdJbmRleCwgb2xkS2V5cGF0aCwgbmV3S2V5cGF0aCApIHtcblx0XHRcdHZhciB1cGRhdGVkLCBpO1xuXHRcdFx0aWYgKCBtdXN0YWNoZS5kZXNjcmlwdG9yLnggKSB7XG5cdFx0XHRcdGlmICggbXVzdGFjaGUuZXhwcmVzc2lvblJlc29sdmVyICkge1xuXHRcdFx0XHRcdG11c3RhY2hlLmV4cHJlc3Npb25SZXNvbHZlci50ZWFyZG93bigpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdG11c3RhY2hlLmV4cHJlc3Npb25SZXNvbHZlciA9IG5ldyBFeHByZXNzaW9uUmVzb2x2ZXIoIG11c3RhY2hlICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIG11c3RhY2hlLmtleXBhdGggKSB7XG5cdFx0XHRcdHVwZGF0ZWQgPSBnZXROZXdLZXlwYXRoKCBtdXN0YWNoZS5rZXlwYXRoLCBvbGRLZXlwYXRoLCBuZXdLZXlwYXRoICk7XG5cdFx0XHRcdGlmICggdXBkYXRlZCApIHtcblx0XHRcdFx0XHRtdXN0YWNoZS5yZXNvbHZlKCB1cGRhdGVkICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoIGluZGV4UmVmICE9PSB1bmRlZmluZWQgJiYgbXVzdGFjaGUuaW5kZXhSZWYgPT09IGluZGV4UmVmICkge1xuXHRcdFx0XHRtdXN0YWNoZS52YWx1ZSA9IG5ld0luZGV4O1xuXHRcdFx0XHRtdXN0YWNoZS5yZW5kZXIoIG5ld0luZGV4ICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIG11c3RhY2hlLmZyYWdtZW50cyApIHtcblx0XHRcdFx0aSA9IG11c3RhY2hlLmZyYWdtZW50cy5sZW5ndGg7XG5cdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdHJlYXNzaWduRnJhZ21lbnQoIG11c3RhY2hlLmZyYWdtZW50c1sgaSBdLCBpbmRleFJlZiwgbmV3SW5kZXgsIG9sZEtleXBhdGgsIG5ld0tleXBhdGggKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fSggY29uZmlnX3R5cGVzLCByZW5kZXJfc2hhcmVkX0V4cHJlc3Npb25SZXNvbHZlcl9fRXhwcmVzc2lvblJlc29sdmVyICk7XG5cblx0dmFyIHJlbmRlcl9zaGFyZWRfcmVzb2x2ZU11c3RhY2hlID0gZnVuY3Rpb24oIHR5cGVzLCByZWdpc3RlckRlcGVuZGFudCwgdW5yZWdpc3RlckRlcGVuZGFudCwgcmVhc3NpZ25GcmFnbWVudCApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiByZXNvbHZlTXVzdGFjaGUoIGtleXBhdGggKSB7XG5cdFx0XHR2YXIgaTtcblx0XHRcdGlmICgga2V5cGF0aCA9PT0gdGhpcy5rZXlwYXRoICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRoaXMucmVnaXN0ZXJlZCApIHtcblx0XHRcdFx0dW5yZWdpc3RlckRlcGVuZGFudCggdGhpcyApO1xuXHRcdFx0XHRpZiAoIHRoaXMudHlwZSA9PT0gdHlwZXMuU0VDVElPTiApIHtcblx0XHRcdFx0XHRpID0gdGhpcy5mcmFnbWVudHMubGVuZ3RoO1xuXHRcdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdFx0cmVhc3NpZ25GcmFnbWVudCggdGhpcy5mcmFnbWVudHNbIGkgXSwgbnVsbCwgbnVsbCwgdGhpcy5rZXlwYXRoLCBrZXlwYXRoICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmtleXBhdGggPSBrZXlwYXRoO1xuXHRcdFx0cmVnaXN0ZXJEZXBlbmRhbnQoIHRoaXMgKTtcblx0XHRcdHRoaXMudXBkYXRlKCk7XG5cdFx0XHRpZiAoIHRoaXMucm9vdC50d293YXkgJiYgdGhpcy5wYXJlbnRGcmFnbWVudC5vd25lci50eXBlID09PSB0eXBlcy5BVFRSSUJVVEUgKSB7XG5cdFx0XHRcdHRoaXMucGFyZW50RnJhZ21lbnQub3duZXIuZWxlbWVudC5iaW5kKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRoaXMuZXhwcmVzc2lvblJlc29sdmVyICYmIHRoaXMuZXhwcmVzc2lvblJlc29sdmVyLnJlc29sdmVkICkge1xuXHRcdFx0XHR0aGlzLmV4cHJlc3Npb25SZXNvbHZlciA9IG51bGw7XG5cdFx0XHR9XG5cdFx0fTtcblx0fSggY29uZmlnX3R5cGVzLCBzaGFyZWRfcmVnaXN0ZXJEZXBlbmRhbnQsIHNoYXJlZF91bnJlZ2lzdGVyRGVwZW5kYW50LCByZW5kZXJfRG9tRnJhZ21lbnRfU2VjdGlvbl9yZWFzc2lnbkZyYWdtZW50ICk7XG5cblx0dmFyIHJlbmRlcl9zaGFyZWRfdXBkYXRlTXVzdGFjaGUgPSBmdW5jdGlvbiggaXNFcXVhbCwgZ2V0ICkge1xuXG5cdFx0dmFyIG9wdGlvbnMgPSB7XG5cdFx0XHRldmFsdWF0ZVdyYXBwZWQ6IHRydWVcblx0XHR9O1xuXHRcdHJldHVybiBmdW5jdGlvbiB1cGRhdGVNdXN0YWNoZSgpIHtcblx0XHRcdHZhciB2YWx1ZSA9IGdldCggdGhpcy5yb290LCB0aGlzLmtleXBhdGgsIG9wdGlvbnMgKTtcblx0XHRcdGlmICggIWlzRXF1YWwoIHZhbHVlLCB0aGlzLnZhbHVlICkgKSB7XG5cdFx0XHRcdHRoaXMucmVuZGVyKCB2YWx1ZSApO1xuXHRcdFx0XHR0aGlzLnZhbHVlID0gdmFsdWU7XG5cdFx0XHR9XG5cdFx0fTtcblx0fSggdXRpbHNfaXNFcXVhbCwgc2hhcmVkX2dldF9fZ2V0ICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9JbnRlcnBvbGF0b3IgPSBmdW5jdGlvbiggdHlwZXMsIHRlYXJkb3duLCBpbml0TXVzdGFjaGUsIHJlc29sdmVNdXN0YWNoZSwgdXBkYXRlTXVzdGFjaGUsIGRldGFjaCApIHtcblxuXHRcdHZhciBEb21JbnRlcnBvbGF0b3IsIGxlc3NUaGFuLCBncmVhdGVyVGhhbjtcblx0XHRsZXNzVGhhbiA9IC88L2c7XG5cdFx0Z3JlYXRlclRoYW4gPSAvPi9nO1xuXHRcdERvbUludGVycG9sYXRvciA9IGZ1bmN0aW9uKCBvcHRpb25zLCBkb2NGcmFnICkge1xuXHRcdFx0dGhpcy50eXBlID0gdHlwZXMuSU5URVJQT0xBVE9SO1xuXHRcdFx0aWYgKCBkb2NGcmFnICkge1xuXHRcdFx0XHR0aGlzLm5vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSggJycgKTtcblx0XHRcdFx0ZG9jRnJhZy5hcHBlbmRDaGlsZCggdGhpcy5ub2RlICk7XG5cdFx0XHR9XG5cdFx0XHRpbml0TXVzdGFjaGUoIHRoaXMsIG9wdGlvbnMgKTtcblx0XHR9O1xuXHRcdERvbUludGVycG9sYXRvci5wcm90b3R5cGUgPSB7XG5cdFx0XHR1cGRhdGU6IHVwZGF0ZU11c3RhY2hlLFxuXHRcdFx0cmVzb2x2ZTogcmVzb2x2ZU11c3RhY2hlLFxuXHRcdFx0ZGV0YWNoOiBkZXRhY2gsXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oIGRlc3Ryb3kgKSB7XG5cdFx0XHRcdGlmICggZGVzdHJveSApIHtcblx0XHRcdFx0XHR0aGlzLmRldGFjaCgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRlYXJkb3duKCB0aGlzICk7XG5cdFx0XHR9LFxuXHRcdFx0cmVuZGVyOiBmdW5jdGlvbiggdmFsdWUgKSB7XG5cdFx0XHRcdGlmICggdGhpcy5ub2RlICkge1xuXHRcdFx0XHRcdHRoaXMubm9kZS5kYXRhID0gdmFsdWUgPT0gdW5kZWZpbmVkID8gJycgOiB2YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGZpcnN0Tm9kZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLm5vZGU7XG5cdFx0XHR9LFxuXHRcdFx0dG9TdHJpbmc6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgdmFsdWUgPSB0aGlzLnZhbHVlICE9IHVuZGVmaW5lZCA/ICcnICsgdGhpcy52YWx1ZSA6ICcnO1xuXHRcdFx0XHRyZXR1cm4gdmFsdWUucmVwbGFjZSggbGVzc1RoYW4sICcmbHQ7JyApLnJlcGxhY2UoIGdyZWF0ZXJUaGFuLCAnJmd0OycgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBEb21JbnRlcnBvbGF0b3I7XG5cdH0oIGNvbmZpZ190eXBlcywgc2hhcmVkX3RlYXJkb3duLCByZW5kZXJfc2hhcmVkX2luaXRNdXN0YWNoZSwgcmVuZGVyX3NoYXJlZF9yZXNvbHZlTXVzdGFjaGUsIHJlbmRlcl9zaGFyZWRfdXBkYXRlTXVzdGFjaGUsIHJlbmRlcl9Eb21GcmFnbWVudF9zaGFyZWRfZGV0YWNoICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9TZWN0aW9uX3Byb3RvdHlwZV9tZXJnZSA9IGZ1bmN0aW9uKCByZWFzc2lnbkZyYWdtZW50ICkge1xuXG5cdFx0dmFyIHRvVGVhcmRvd24gPSBbXTtcblx0XHRyZXR1cm4gZnVuY3Rpb24gc2VjdGlvbk1lcmdlKCBuZXdJbmRpY2VzICkge1xuXHRcdFx0dmFyIHNlY3Rpb24gPSB0aGlzLFxuXHRcdFx0XHRwYXJlbnRGcmFnbWVudCwgZmlyc3RDaGFuZ2UsIGksIG5ld0xlbmd0aCwgcmVhc3NpZ25lZEZyYWdtZW50cywgZnJhZ21lbnRPcHRpb25zLCBmcmFnbWVudCwgbmV4dE5vZGU7XG5cdFx0XHRwYXJlbnRGcmFnbWVudCA9IHRoaXMucGFyZW50RnJhZ21lbnQ7XG5cdFx0XHRyZWFzc2lnbmVkRnJhZ21lbnRzID0gW107XG5cdFx0XHRuZXdJbmRpY2VzLmZvckVhY2goIGZ1bmN0aW9uIHJlYXNzaWduSWZOZWNlc3NhcnkoIG5ld0luZGV4LCBvbGRJbmRleCApIHtcblx0XHRcdFx0dmFyIGZyYWdtZW50LCBieSwgb2xkS2V5cGF0aCwgbmV3S2V5cGF0aDtcblx0XHRcdFx0aWYgKCBuZXdJbmRleCA9PT0gb2xkSW5kZXggKSB7XG5cdFx0XHRcdFx0cmVhc3NpZ25lZEZyYWdtZW50c1sgbmV3SW5kZXggXSA9IHNlY3Rpb24uZnJhZ21lbnRzWyBvbGRJbmRleCBdO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIGZpcnN0Q2hhbmdlID09PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdFx0Zmlyc3RDaGFuZ2UgPSBvbGRJbmRleDtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIG5ld0luZGV4ID09PSAtMSApIHtcblx0XHRcdFx0XHR0b1RlYXJkb3duLnB1c2goIHNlY3Rpb24uZnJhZ21lbnRzWyBvbGRJbmRleCBdICk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGZyYWdtZW50ID0gc2VjdGlvbi5mcmFnbWVudHNbIG9sZEluZGV4IF07XG5cdFx0XHRcdGJ5ID0gbmV3SW5kZXggLSBvbGRJbmRleDtcblx0XHRcdFx0b2xkS2V5cGF0aCA9IHNlY3Rpb24ua2V5cGF0aCArICcuJyArIG9sZEluZGV4O1xuXHRcdFx0XHRuZXdLZXlwYXRoID0gc2VjdGlvbi5rZXlwYXRoICsgJy4nICsgbmV3SW5kZXg7XG5cdFx0XHRcdHJlYXNzaWduRnJhZ21lbnQoIGZyYWdtZW50LCBzZWN0aW9uLmRlc2NyaXB0b3IuaSwgb2xkSW5kZXgsIG5ld0luZGV4LCBieSwgb2xkS2V5cGF0aCwgbmV3S2V5cGF0aCApO1xuXHRcdFx0XHRyZWFzc2lnbmVkRnJhZ21lbnRzWyBuZXdJbmRleCBdID0gZnJhZ21lbnQ7XG5cdFx0XHR9ICk7XG5cdFx0XHR3aGlsZSAoIGZyYWdtZW50ID0gdG9UZWFyZG93bi5wb3AoKSApIHtcblx0XHRcdFx0ZnJhZ21lbnQudGVhcmRvd24oIHRydWUgKTtcblx0XHRcdH1cblx0XHRcdGlmICggZmlyc3RDaGFuZ2UgPT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0Zmlyc3RDaGFuZ2UgPSB0aGlzLmxlbmd0aDtcblx0XHRcdH1cblx0XHRcdHRoaXMubGVuZ3RoID0gbmV3TGVuZ3RoID0gdGhpcy5yb290LmdldCggdGhpcy5rZXlwYXRoICkubGVuZ3RoO1xuXHRcdFx0aWYgKCBuZXdMZW5ndGggPT09IGZpcnN0Q2hhbmdlICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRmcmFnbWVudE9wdGlvbnMgPSB7XG5cdFx0XHRcdGRlc2NyaXB0b3I6IHRoaXMuZGVzY3JpcHRvci5mLFxuXHRcdFx0XHRyb290OiB0aGlzLnJvb3QsXG5cdFx0XHRcdHBOb2RlOiBwYXJlbnRGcmFnbWVudC5wTm9kZSxcblx0XHRcdFx0b3duZXI6IHRoaXNcblx0XHRcdH07XG5cdFx0XHRpZiAoIHRoaXMuZGVzY3JpcHRvci5pICkge1xuXHRcdFx0XHRmcmFnbWVudE9wdGlvbnMuaW5kZXhSZWYgPSB0aGlzLmRlc2NyaXB0b3IuaTtcblx0XHRcdH1cblx0XHRcdGZvciAoIGkgPSBmaXJzdENoYW5nZTsgaSA8IG5ld0xlbmd0aDsgaSArPSAxICkge1xuXHRcdFx0XHRpZiAoIGZyYWdtZW50ID0gcmVhc3NpZ25lZEZyYWdtZW50c1sgaSBdICkge1xuXHRcdFx0XHRcdHRoaXMuZG9jRnJhZy5hcHBlbmRDaGlsZCggZnJhZ21lbnQuZGV0YWNoKCBmYWxzZSApICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZnJhZ21lbnRPcHRpb25zLmNvbnRleHQgPSB0aGlzLmtleXBhdGggKyAnLicgKyBpO1xuXHRcdFx0XHRcdGZyYWdtZW50T3B0aW9ucy5pbmRleCA9IGk7XG5cdFx0XHRcdFx0ZnJhZ21lbnQgPSB0aGlzLmNyZWF0ZUZyYWdtZW50KCBmcmFnbWVudE9wdGlvbnMgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLmZyYWdtZW50c1sgaSBdID0gZnJhZ21lbnQ7XG5cdFx0XHR9XG5cdFx0XHRuZXh0Tm9kZSA9IHBhcmVudEZyYWdtZW50LmZpbmROZXh0Tm9kZSggdGhpcyApO1xuXHRcdFx0cGFyZW50RnJhZ21lbnQucE5vZGUuaW5zZXJ0QmVmb3JlKCB0aGlzLmRvY0ZyYWcsIG5leHROb2RlICk7XG5cdFx0fTtcblx0fSggcmVuZGVyX0RvbUZyYWdtZW50X1NlY3Rpb25fcmVhc3NpZ25GcmFnbWVudCApO1xuXG5cdHZhciByZW5kZXJfc2hhcmVkX3VwZGF0ZVNlY3Rpb24gPSBmdW5jdGlvbiggaXNBcnJheSwgaXNPYmplY3QgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24gdXBkYXRlU2VjdGlvbiggc2VjdGlvbiwgdmFsdWUgKSB7XG5cdFx0XHR2YXIgZnJhZ21lbnRPcHRpb25zID0ge1xuXHRcdFx0XHRkZXNjcmlwdG9yOiBzZWN0aW9uLmRlc2NyaXB0b3IuZixcblx0XHRcdFx0cm9vdDogc2VjdGlvbi5yb290LFxuXHRcdFx0XHRwTm9kZTogc2VjdGlvbi5wYXJlbnRGcmFnbWVudC5wTm9kZSxcblx0XHRcdFx0cEVsZW1lbnQ6IHNlY3Rpb24ucGFyZW50RnJhZ21lbnQucEVsZW1lbnQsXG5cdFx0XHRcdG93bmVyOiBzZWN0aW9uXG5cdFx0XHR9O1xuXHRcdFx0aWYgKCBzZWN0aW9uLmRlc2NyaXB0b3IubiApIHtcblx0XHRcdFx0dXBkYXRlQ29uZGl0aW9uYWxTZWN0aW9uKCBzZWN0aW9uLCB2YWx1ZSwgdHJ1ZSwgZnJhZ21lbnRPcHRpb25zICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggaXNBcnJheSggdmFsdWUgKSApIHtcblx0XHRcdFx0dXBkYXRlTGlzdFNlY3Rpb24oIHNlY3Rpb24sIHZhbHVlLCBmcmFnbWVudE9wdGlvbnMgKTtcblx0XHRcdH0gZWxzZSBpZiAoIGlzT2JqZWN0KCB2YWx1ZSApIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdFx0aWYgKCBzZWN0aW9uLmRlc2NyaXB0b3IuaSApIHtcblx0XHRcdFx0XHR1cGRhdGVMaXN0T2JqZWN0U2VjdGlvbiggc2VjdGlvbiwgdmFsdWUsIGZyYWdtZW50T3B0aW9ucyApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHVwZGF0ZUNvbnRleHRTZWN0aW9uKCBzZWN0aW9uLCBmcmFnbWVudE9wdGlvbnMgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dXBkYXRlQ29uZGl0aW9uYWxTZWN0aW9uKCBzZWN0aW9uLCB2YWx1ZSwgZmFsc2UsIGZyYWdtZW50T3B0aW9ucyApO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRmdW5jdGlvbiB1cGRhdGVMaXN0U2VjdGlvbiggc2VjdGlvbiwgdmFsdWUsIGZyYWdtZW50T3B0aW9ucyApIHtcblx0XHRcdHZhciBpLCBsZW5ndGgsIGZyYWdtZW50c1RvUmVtb3ZlO1xuXHRcdFx0bGVuZ3RoID0gdmFsdWUubGVuZ3RoO1xuXHRcdFx0aWYgKCBsZW5ndGggPCBzZWN0aW9uLmxlbmd0aCApIHtcblx0XHRcdFx0ZnJhZ21lbnRzVG9SZW1vdmUgPSBzZWN0aW9uLmZyYWdtZW50cy5zcGxpY2UoIGxlbmd0aCwgc2VjdGlvbi5sZW5ndGggLSBsZW5ndGggKTtcblx0XHRcdFx0d2hpbGUgKCBmcmFnbWVudHNUb1JlbW92ZS5sZW5ndGggKSB7XG5cdFx0XHRcdFx0ZnJhZ21lbnRzVG9SZW1vdmUucG9wKCkudGVhcmRvd24oIHRydWUgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKCBsZW5ndGggPiBzZWN0aW9uLmxlbmd0aCApIHtcblx0XHRcdFx0XHRmb3IgKCBpID0gc2VjdGlvbi5sZW5ndGg7IGkgPCBsZW5ndGg7IGkgKz0gMSApIHtcblx0XHRcdFx0XHRcdGZyYWdtZW50T3B0aW9ucy5jb250ZXh0ID0gc2VjdGlvbi5rZXlwYXRoICsgJy4nICsgaTtcblx0XHRcdFx0XHRcdGZyYWdtZW50T3B0aW9ucy5pbmRleCA9IGk7XG5cdFx0XHRcdFx0XHRpZiAoIHNlY3Rpb24uZGVzY3JpcHRvci5pICkge1xuXHRcdFx0XHRcdFx0XHRmcmFnbWVudE9wdGlvbnMuaW5kZXhSZWYgPSBzZWN0aW9uLmRlc2NyaXB0b3IuaTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHNlY3Rpb24uZnJhZ21lbnRzWyBpIF0gPSBzZWN0aW9uLmNyZWF0ZUZyYWdtZW50KCBmcmFnbWVudE9wdGlvbnMgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHNlY3Rpb24ubGVuZ3RoID0gbGVuZ3RoO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHVwZGF0ZUxpc3RPYmplY3RTZWN0aW9uKCBzZWN0aW9uLCB2YWx1ZSwgZnJhZ21lbnRPcHRpb25zICkge1xuXHRcdFx0dmFyIGlkLCBpLCBoYXNLZXksIGZyYWdtZW50O1xuXHRcdFx0aGFzS2V5ID0gc2VjdGlvbi5oYXNLZXkgfHwgKCBzZWN0aW9uLmhhc0tleSA9IHt9ICk7XG5cdFx0XHRpID0gc2VjdGlvbi5mcmFnbWVudHMubGVuZ3RoO1xuXHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdGZyYWdtZW50ID0gc2VjdGlvbi5mcmFnbWVudHNbIGkgXTtcblx0XHRcdFx0aWYgKCAhKCBmcmFnbWVudC5pbmRleCBpbiB2YWx1ZSApICkge1xuXHRcdFx0XHRcdHNlY3Rpb24uZnJhZ21lbnRzWyBpIF0udGVhcmRvd24oIHRydWUgKTtcblx0XHRcdFx0XHRzZWN0aW9uLmZyYWdtZW50cy5zcGxpY2UoIGksIDEgKTtcblx0XHRcdFx0XHRoYXNLZXlbIGZyYWdtZW50LmluZGV4IF0gPSBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Zm9yICggaWQgaW4gdmFsdWUgKSB7XG5cdFx0XHRcdGlmICggIWhhc0tleVsgaWQgXSApIHtcblx0XHRcdFx0XHRmcmFnbWVudE9wdGlvbnMuY29udGV4dCA9IHNlY3Rpb24ua2V5cGF0aCArICcuJyArIGlkO1xuXHRcdFx0XHRcdGZyYWdtZW50T3B0aW9ucy5pbmRleCA9IGlkO1xuXHRcdFx0XHRcdGlmICggc2VjdGlvbi5kZXNjcmlwdG9yLmkgKSB7XG5cdFx0XHRcdFx0XHRmcmFnbWVudE9wdGlvbnMuaW5kZXhSZWYgPSBzZWN0aW9uLmRlc2NyaXB0b3IuaTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0c2VjdGlvbi5mcmFnbWVudHMucHVzaCggc2VjdGlvbi5jcmVhdGVGcmFnbWVudCggZnJhZ21lbnRPcHRpb25zICkgKTtcblx0XHRcdFx0XHRoYXNLZXlbIGlkIF0gPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRzZWN0aW9uLmxlbmd0aCA9IHNlY3Rpb24uZnJhZ21lbnRzLmxlbmd0aDtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiB1cGRhdGVDb250ZXh0U2VjdGlvbiggc2VjdGlvbiwgZnJhZ21lbnRPcHRpb25zICkge1xuXHRcdFx0aWYgKCAhc2VjdGlvbi5sZW5ndGggKSB7XG5cdFx0XHRcdGZyYWdtZW50T3B0aW9ucy5jb250ZXh0ID0gc2VjdGlvbi5rZXlwYXRoO1xuXHRcdFx0XHRmcmFnbWVudE9wdGlvbnMuaW5kZXggPSAwO1xuXHRcdFx0XHRzZWN0aW9uLmZyYWdtZW50c1sgMCBdID0gc2VjdGlvbi5jcmVhdGVGcmFnbWVudCggZnJhZ21lbnRPcHRpb25zICk7XG5cdFx0XHRcdHNlY3Rpb24ubGVuZ3RoID0gMTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRmdW5jdGlvbiB1cGRhdGVDb25kaXRpb25hbFNlY3Rpb24oIHNlY3Rpb24sIHZhbHVlLCBpbnZlcnRlZCwgZnJhZ21lbnRPcHRpb25zICkge1xuXHRcdFx0dmFyIGRvUmVuZGVyLCBlbXB0eUFycmF5LCBmcmFnbWVudHNUb1JlbW92ZSwgZnJhZ21lbnQ7XG5cdFx0XHRlbXB0eUFycmF5ID0gaXNBcnJheSggdmFsdWUgKSAmJiB2YWx1ZS5sZW5ndGggPT09IDA7XG5cdFx0XHRpZiAoIGludmVydGVkICkge1xuXHRcdFx0XHRkb1JlbmRlciA9IGVtcHR5QXJyYXkgfHwgIXZhbHVlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZG9SZW5kZXIgPSB2YWx1ZSAmJiAhZW1wdHlBcnJheTtcblx0XHRcdH1cblx0XHRcdGlmICggZG9SZW5kZXIgKSB7XG5cdFx0XHRcdGlmICggIXNlY3Rpb24ubGVuZ3RoICkge1xuXHRcdFx0XHRcdGZyYWdtZW50T3B0aW9ucy5pbmRleCA9IDA7XG5cdFx0XHRcdFx0c2VjdGlvbi5mcmFnbWVudHNbIDAgXSA9IHNlY3Rpb24uY3JlYXRlRnJhZ21lbnQoIGZyYWdtZW50T3B0aW9ucyApO1xuXHRcdFx0XHRcdHNlY3Rpb24ubGVuZ3RoID0gMTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHNlY3Rpb24ubGVuZ3RoID4gMSApIHtcblx0XHRcdFx0XHRmcmFnbWVudHNUb1JlbW92ZSA9IHNlY3Rpb24uZnJhZ21lbnRzLnNwbGljZSggMSApO1xuXHRcdFx0XHRcdHdoaWxlICggZnJhZ21lbnQgPSBmcmFnbWVudHNUb1JlbW92ZS5wb3AoKSApIHtcblx0XHRcdFx0XHRcdGZyYWdtZW50LnRlYXJkb3duKCB0cnVlICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKCBzZWN0aW9uLmxlbmd0aCApIHtcblx0XHRcdFx0c2VjdGlvbi50ZWFyZG93bkZyYWdtZW50cyggdHJ1ZSApO1xuXHRcdFx0XHRzZWN0aW9uLmxlbmd0aCA9IDA7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KCB1dGlsc19pc0FycmF5LCB1dGlsc19pc09iamVjdCApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfU2VjdGlvbl9wcm90b3R5cGVfcmVuZGVyID0gZnVuY3Rpb24oIGlzQ2xpZW50LCB1cGRhdGVTZWN0aW9uICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uIERvbVNlY3Rpb25fcHJvdG90eXBlX3JlbmRlciggdmFsdWUgKSB7XG5cdFx0XHR2YXIgbmV4dE5vZGUsIHdyYXBwZWQ7XG5cdFx0XHRpZiAoIHdyYXBwZWQgPSB0aGlzLnJvb3QuX3dyYXBwZWRbIHRoaXMua2V5cGF0aCBdICkge1xuXHRcdFx0XHR2YWx1ZSA9IHdyYXBwZWQuZ2V0KCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRoaXMucmVuZGVyaW5nICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnJlbmRlcmluZyA9IHRydWU7XG5cdFx0XHR1cGRhdGVTZWN0aW9uKCB0aGlzLCB2YWx1ZSApO1xuXHRcdFx0dGhpcy5yZW5kZXJpbmcgPSBmYWxzZTtcblx0XHRcdGlmICggdGhpcy5kb2NGcmFnICYmICF0aGlzLmRvY0ZyYWcuY2hpbGROb2Rlcy5sZW5ndGggKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggIXRoaXMuaW5pdGlhbGlzaW5nICYmIGlzQ2xpZW50ICkge1xuXHRcdFx0XHRuZXh0Tm9kZSA9IHRoaXMucGFyZW50RnJhZ21lbnQuZmluZE5leHROb2RlKCB0aGlzICk7XG5cdFx0XHRcdGlmICggbmV4dE5vZGUgJiYgbmV4dE5vZGUucGFyZW50Tm9kZSA9PT0gdGhpcy5wYXJlbnRGcmFnbWVudC5wTm9kZSApIHtcblx0XHRcdFx0XHR0aGlzLnBhcmVudEZyYWdtZW50LnBOb2RlLmluc2VydEJlZm9yZSggdGhpcy5kb2NGcmFnLCBuZXh0Tm9kZSApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMucGFyZW50RnJhZ21lbnQucE5vZGUuYXBwZW5kQ2hpbGQoIHRoaXMuZG9jRnJhZyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0fSggY29uZmlnX2lzQ2xpZW50LCByZW5kZXJfc2hhcmVkX3VwZGF0ZVNlY3Rpb24gKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X1NlY3Rpb25fcmVhc3NpZ25GcmFnbWVudHMgPSBmdW5jdGlvbiggcmVhc3NpZ25GcmFnbWVudCApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggc2VjdGlvbiwgc3RhcnQsIGVuZCwgYnkgKSB7XG5cdFx0XHRpZiAoIHN0YXJ0ICsgYnkgPT09IGVuZCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBzdGFydCA9PT0gZW5kICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR2YXIgaSwgZnJhZ21lbnQsIGluZGV4UmVmLCBvbGRJbmRleCwgbmV3SW5kZXgsIG9sZEtleXBhdGgsIG5ld0tleXBhdGg7XG5cdFx0XHRpbmRleFJlZiA9IHNlY3Rpb24uZGVzY3JpcHRvci5pO1xuXHRcdFx0Zm9yICggaSA9IHN0YXJ0OyBpIDwgZW5kOyBpICs9IDEgKSB7XG5cdFx0XHRcdGZyYWdtZW50ID0gc2VjdGlvbi5mcmFnbWVudHNbIGkgXTtcblx0XHRcdFx0b2xkSW5kZXggPSBpIC0gYnk7XG5cdFx0XHRcdG5ld0luZGV4ID0gaTtcblx0XHRcdFx0b2xkS2V5cGF0aCA9IHNlY3Rpb24ua2V5cGF0aCArICcuJyArICggaSAtIGJ5ICk7XG5cdFx0XHRcdG5ld0tleXBhdGggPSBzZWN0aW9uLmtleXBhdGggKyAnLicgKyBpO1xuXHRcdFx0XHRmcmFnbWVudC5pbmRleCArPSBieTtcblx0XHRcdFx0cmVhc3NpZ25GcmFnbWVudCggZnJhZ21lbnQsIGluZGV4UmVmLCBuZXdJbmRleCwgb2xkS2V5cGF0aCwgbmV3S2V5cGF0aCApO1xuXHRcdFx0fVxuXHRcdH07XG5cdH0oIHJlbmRlcl9Eb21GcmFnbWVudF9TZWN0aW9uX3JlYXNzaWduRnJhZ21lbnQgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X1NlY3Rpb25fcHJvdG90eXBlX3NwbGljZSA9IGZ1bmN0aW9uKCByZWFzc2lnbkZyYWdtZW50cyApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggc3BsaWNlU3VtbWFyeSApIHtcblx0XHRcdHZhciBzZWN0aW9uID0gdGhpcyxcblx0XHRcdFx0aW5zZXJ0aW9uUG9pbnQsIGJhbGFuY2UsIGksIHN0YXJ0LCBlbmQsIGluc2VydFN0YXJ0LCBpbnNlcnRFbmQsIHNwbGljZUFyZ3MsIGZyYWdtZW50T3B0aW9ucztcblx0XHRcdGJhbGFuY2UgPSBzcGxpY2VTdW1tYXJ5LmJhbGFuY2U7XG5cdFx0XHRpZiAoICFiYWxhbmNlICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRzZWN0aW9uLnJlbmRlcmluZyA9IHRydWU7XG5cdFx0XHRzdGFydCA9IHNwbGljZVN1bW1hcnkuc3RhcnQ7XG5cdFx0XHRpZiAoIGJhbGFuY2UgPCAwICkge1xuXHRcdFx0XHRlbmQgPSBzdGFydCAtIGJhbGFuY2U7XG5cdFx0XHRcdGZvciAoIGkgPSBzdGFydDsgaSA8IGVuZDsgaSArPSAxICkge1xuXHRcdFx0XHRcdHNlY3Rpb24uZnJhZ21lbnRzWyBpIF0udGVhcmRvd24oIHRydWUgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzZWN0aW9uLmZyYWdtZW50cy5zcGxpY2UoIHN0YXJ0LCAtYmFsYW5jZSApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZnJhZ21lbnRPcHRpb25zID0ge1xuXHRcdFx0XHRcdGRlc2NyaXB0b3I6IHNlY3Rpb24uZGVzY3JpcHRvci5mLFxuXHRcdFx0XHRcdHJvb3Q6IHNlY3Rpb24ucm9vdCxcblx0XHRcdFx0XHRwTm9kZTogc2VjdGlvbi5wYXJlbnRGcmFnbWVudC5wTm9kZSxcblx0XHRcdFx0XHRvd25lcjogc2VjdGlvblxuXHRcdFx0XHR9O1xuXHRcdFx0XHRpZiAoIHNlY3Rpb24uZGVzY3JpcHRvci5pICkge1xuXHRcdFx0XHRcdGZyYWdtZW50T3B0aW9ucy5pbmRleFJlZiA9IHNlY3Rpb24uZGVzY3JpcHRvci5pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGluc2VydFN0YXJ0ID0gc3RhcnQgKyBzcGxpY2VTdW1tYXJ5LnJlbW92ZWQ7XG5cdFx0XHRcdGluc2VydEVuZCA9IHN0YXJ0ICsgc3BsaWNlU3VtbWFyeS5hZGRlZDtcblx0XHRcdFx0aW5zZXJ0aW9uUG9pbnQgPSBzZWN0aW9uLmZyYWdtZW50c1sgaW5zZXJ0U3RhcnQgXSA/IHNlY3Rpb24uZnJhZ21lbnRzWyBpbnNlcnRTdGFydCBdLmZpcnN0Tm9kZSgpIDogc2VjdGlvbi5wYXJlbnRGcmFnbWVudC5maW5kTmV4dE5vZGUoIHNlY3Rpb24gKTtcblx0XHRcdFx0c3BsaWNlQXJncyA9IFtcblx0XHRcdFx0XHRpbnNlcnRTdGFydCxcblx0XHRcdFx0XHQwXG5cdFx0XHRcdF0uY29uY2F0KCBuZXcgQXJyYXkoIGJhbGFuY2UgKSApO1xuXHRcdFx0XHRzZWN0aW9uLmZyYWdtZW50cy5zcGxpY2UuYXBwbHkoIHNlY3Rpb24uZnJhZ21lbnRzLCBzcGxpY2VBcmdzICk7XG5cdFx0XHRcdGZvciAoIGkgPSBpbnNlcnRTdGFydDsgaSA8IGluc2VydEVuZDsgaSArPSAxICkge1xuXHRcdFx0XHRcdGZyYWdtZW50T3B0aW9ucy5jb250ZXh0ID0gc2VjdGlvbi5rZXlwYXRoICsgJy4nICsgaTtcblx0XHRcdFx0XHRmcmFnbWVudE9wdGlvbnMuaW5kZXggPSBpO1xuXHRcdFx0XHRcdHNlY3Rpb24uZnJhZ21lbnRzWyBpIF0gPSBzZWN0aW9uLmNyZWF0ZUZyYWdtZW50KCBmcmFnbWVudE9wdGlvbnMgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzZWN0aW9uLnBhcmVudEZyYWdtZW50LnBOb2RlLmluc2VydEJlZm9yZSggc2VjdGlvbi5kb2NGcmFnLCBpbnNlcnRpb25Qb2ludCApO1xuXHRcdFx0fVxuXHRcdFx0c2VjdGlvbi5sZW5ndGggKz0gYmFsYW5jZTtcblx0XHRcdHJlYXNzaWduRnJhZ21lbnRzKCBzZWN0aW9uLCBzdGFydCwgc2VjdGlvbi5sZW5ndGgsIGJhbGFuY2UgKTtcblx0XHRcdHNlY3Rpb24ucmVuZGVyaW5nID0gZmFsc2U7XG5cdFx0fTtcblx0fSggcmVuZGVyX0RvbUZyYWdtZW50X1NlY3Rpb25fcmVhc3NpZ25GcmFnbWVudHMgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X1NlY3Rpb25fX1NlY3Rpb24gPSBmdW5jdGlvbiggdHlwZXMsIGluaXRNdXN0YWNoZSwgdXBkYXRlTXVzdGFjaGUsIHJlc29sdmVNdXN0YWNoZSwgbWVyZ2UsIHJlbmRlciwgc3BsaWNlLCB0ZWFyZG93biwgY2lyY3VsYXIgKSB7XG5cblx0XHR2YXIgRG9tU2VjdGlvbiwgRG9tRnJhZ21lbnQ7XG5cdFx0Y2lyY3VsYXIucHVzaCggZnVuY3Rpb24oKSB7XG5cdFx0XHREb21GcmFnbWVudCA9IGNpcmN1bGFyLkRvbUZyYWdtZW50O1xuXHRcdH0gKTtcblx0XHREb21TZWN0aW9uID0gZnVuY3Rpb24oIG9wdGlvbnMsIGRvY0ZyYWcgKSB7XG5cdFx0XHR0aGlzLnR5cGUgPSB0eXBlcy5TRUNUSU9OO1xuXHRcdFx0dGhpcy5pbnZlcnRlZCA9ICEhIG9wdGlvbnMuZGVzY3JpcHRvci5uO1xuXHRcdFx0dGhpcy5mcmFnbWVudHMgPSBbXTtcblx0XHRcdHRoaXMubGVuZ3RoID0gMDtcblx0XHRcdGlmICggZG9jRnJhZyApIHtcblx0XHRcdFx0dGhpcy5kb2NGcmFnID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5pbml0aWFsaXNpbmcgPSB0cnVlO1xuXHRcdFx0aW5pdE11c3RhY2hlKCB0aGlzLCBvcHRpb25zICk7XG5cdFx0XHRpZiAoIGRvY0ZyYWcgKSB7XG5cdFx0XHRcdGRvY0ZyYWcuYXBwZW5kQ2hpbGQoIHRoaXMuZG9jRnJhZyApO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5pbml0aWFsaXNpbmcgPSBmYWxzZTtcblx0XHR9O1xuXHRcdERvbVNlY3Rpb24ucHJvdG90eXBlID0ge1xuXHRcdFx0dXBkYXRlOiB1cGRhdGVNdXN0YWNoZSxcblx0XHRcdHJlc29sdmU6IHJlc29sdmVNdXN0YWNoZSxcblx0XHRcdHNwbGljZTogc3BsaWNlLFxuXHRcdFx0bWVyZ2U6IG1lcmdlLFxuXHRcdFx0ZGV0YWNoOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIGksIGxlbjtcblx0XHRcdFx0aWYgKCB0aGlzLmRvY0ZyYWcgKSB7XG5cdFx0XHRcdFx0bGVuID0gdGhpcy5mcmFnbWVudHMubGVuZ3RoO1xuXHRcdFx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmRvY0ZyYWcuYXBwZW5kQ2hpbGQoIHRoaXMuZnJhZ21lbnRzWyBpIF0uZGV0YWNoKCkgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuZG9jRnJhZztcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbiggZGVzdHJveSApIHtcblx0XHRcdFx0dGhpcy50ZWFyZG93bkZyYWdtZW50cyggZGVzdHJveSApO1xuXHRcdFx0XHR0ZWFyZG93biggdGhpcyApO1xuXHRcdFx0fSxcblx0XHRcdGZpcnN0Tm9kZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmICggdGhpcy5mcmFnbWVudHNbIDAgXSApIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5mcmFnbWVudHNbIDAgXS5maXJzdE5vZGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdGhpcy5wYXJlbnRGcmFnbWVudC5maW5kTmV4dE5vZGUoIHRoaXMgKTtcblx0XHRcdH0sXG5cdFx0XHRmaW5kTmV4dE5vZGU6IGZ1bmN0aW9uKCBmcmFnbWVudCApIHtcblx0XHRcdFx0aWYgKCB0aGlzLmZyYWdtZW50c1sgZnJhZ21lbnQuaW5kZXggKyAxIF0gKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuZnJhZ21lbnRzWyBmcmFnbWVudC5pbmRleCArIDEgXS5maXJzdE5vZGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdGhpcy5wYXJlbnRGcmFnbWVudC5maW5kTmV4dE5vZGUoIHRoaXMgKTtcblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bkZyYWdtZW50czogZnVuY3Rpb24oIGRlc3Ryb3kgKSB7XG5cdFx0XHRcdHZhciBmcmFnbWVudDtcblx0XHRcdFx0d2hpbGUgKCBmcmFnbWVudCA9IHRoaXMuZnJhZ21lbnRzLnNoaWZ0KCkgKSB7XG5cdFx0XHRcdFx0ZnJhZ21lbnQudGVhcmRvd24oIGRlc3Ryb3kgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHJlbmRlcjogcmVuZGVyLFxuXHRcdFx0Y3JlYXRlRnJhZ21lbnQ6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XHR2YXIgZnJhZ21lbnQgPSBuZXcgRG9tRnJhZ21lbnQoIG9wdGlvbnMgKTtcblx0XHRcdFx0aWYgKCB0aGlzLmRvY0ZyYWcgKSB7XG5cdFx0XHRcdFx0dGhpcy5kb2NGcmFnLmFwcGVuZENoaWxkKCBmcmFnbWVudC5kb2NGcmFnICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGZyYWdtZW50O1xuXHRcdFx0fSxcblx0XHRcdHRvU3RyaW5nOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHN0ciwgaSwgbGVuO1xuXHRcdFx0XHRzdHIgPSAnJztcblx0XHRcdFx0aSA9IDA7XG5cdFx0XHRcdGxlbiA9IHRoaXMubGVuZ3RoO1xuXHRcdFx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRcdHN0ciArPSB0aGlzLmZyYWdtZW50c1sgaSBdLnRvU3RyaW5nKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHN0cjtcblx0XHRcdH0sXG5cdFx0XHRmaW5kOiBmdW5jdGlvbiggc2VsZWN0b3IgKSB7XG5cdFx0XHRcdHZhciBpLCBsZW4sIHF1ZXJ5UmVzdWx0O1xuXHRcdFx0XHRsZW4gPSB0aGlzLmZyYWdtZW50cy5sZW5ndGg7XG5cdFx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0aWYgKCBxdWVyeVJlc3VsdCA9IHRoaXMuZnJhZ21lbnRzWyBpIF0uZmluZCggc2VsZWN0b3IgKSApIHtcblx0XHRcdFx0XHRcdHJldHVybiBxdWVyeVJlc3VsdDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9LFxuXHRcdFx0ZmluZEFsbDogZnVuY3Rpb24oIHNlbGVjdG9yLCBxdWVyeSApIHtcblx0XHRcdFx0dmFyIGksIGxlbjtcblx0XHRcdFx0bGVuID0gdGhpcy5mcmFnbWVudHMubGVuZ3RoO1xuXHRcdFx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRcdHRoaXMuZnJhZ21lbnRzWyBpIF0uZmluZEFsbCggc2VsZWN0b3IsIHF1ZXJ5ICk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRmaW5kQ29tcG9uZW50OiBmdW5jdGlvbiggc2VsZWN0b3IgKSB7XG5cdFx0XHRcdHZhciBpLCBsZW4sIHF1ZXJ5UmVzdWx0O1xuXHRcdFx0XHRsZW4gPSB0aGlzLmZyYWdtZW50cy5sZW5ndGg7XG5cdFx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0aWYgKCBxdWVyeVJlc3VsdCA9IHRoaXMuZnJhZ21lbnRzWyBpIF0uZmluZENvbXBvbmVudCggc2VsZWN0b3IgKSApIHtcblx0XHRcdFx0XHRcdHJldHVybiBxdWVyeVJlc3VsdDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9LFxuXHRcdFx0ZmluZEFsbENvbXBvbmVudHM6IGZ1bmN0aW9uKCBzZWxlY3RvciwgcXVlcnkgKSB7XG5cdFx0XHRcdHZhciBpLCBsZW47XG5cdFx0XHRcdGxlbiA9IHRoaXMuZnJhZ21lbnRzLmxlbmd0aDtcblx0XHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0XHR0aGlzLmZyYWdtZW50c1sgaSBdLmZpbmRBbGxDb21wb25lbnRzKCBzZWxlY3RvciwgcXVlcnkgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIERvbVNlY3Rpb247XG5cdH0oIGNvbmZpZ190eXBlcywgcmVuZGVyX3NoYXJlZF9pbml0TXVzdGFjaGUsIHJlbmRlcl9zaGFyZWRfdXBkYXRlTXVzdGFjaGUsIHJlbmRlcl9zaGFyZWRfcmVzb2x2ZU11c3RhY2hlLCByZW5kZXJfRG9tRnJhZ21lbnRfU2VjdGlvbl9wcm90b3R5cGVfbWVyZ2UsIHJlbmRlcl9Eb21GcmFnbWVudF9TZWN0aW9uX3Byb3RvdHlwZV9yZW5kZXIsIHJlbmRlcl9Eb21GcmFnbWVudF9TZWN0aW9uX3Byb3RvdHlwZV9zcGxpY2UsIHNoYXJlZF90ZWFyZG93biwgY2lyY3VsYXIgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X1RyaXBsZSA9IGZ1bmN0aW9uKCB0eXBlcywgbWF0Y2hlcywgaW5pdE11c3RhY2hlLCB1cGRhdGVNdXN0YWNoZSwgcmVzb2x2ZU11c3RhY2hlLCBpbnNlcnRIdG1sLCB0ZWFyZG93biApIHtcblxuXHRcdHZhciBEb21UcmlwbGUgPSBmdW5jdGlvbiggb3B0aW9ucywgZG9jRnJhZyApIHtcblx0XHRcdHRoaXMudHlwZSA9IHR5cGVzLlRSSVBMRTtcblx0XHRcdGlmICggZG9jRnJhZyApIHtcblx0XHRcdFx0dGhpcy5ub2RlcyA9IFtdO1xuXHRcdFx0XHR0aGlzLmRvY0ZyYWcgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmluaXRpYWxpc2luZyA9IHRydWU7XG5cdFx0XHRpbml0TXVzdGFjaGUoIHRoaXMsIG9wdGlvbnMgKTtcblx0XHRcdGlmICggZG9jRnJhZyApIHtcblx0XHRcdFx0ZG9jRnJhZy5hcHBlbmRDaGlsZCggdGhpcy5kb2NGcmFnICk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmluaXRpYWxpc2luZyA9IGZhbHNlO1xuXHRcdH07XG5cdFx0RG9tVHJpcGxlLnByb3RvdHlwZSA9IHtcblx0XHRcdHVwZGF0ZTogdXBkYXRlTXVzdGFjaGUsXG5cdFx0XHRyZXNvbHZlOiByZXNvbHZlTXVzdGFjaGUsXG5cdFx0XHRkZXRhY2g6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgbGVuLCBpO1xuXHRcdFx0XHRpZiAoIHRoaXMuZG9jRnJhZyApIHtcblx0XHRcdFx0XHRsZW4gPSB0aGlzLm5vZGVzLmxlbmd0aDtcblx0XHRcdFx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRcdFx0dGhpcy5kb2NGcmFnLmFwcGVuZENoaWxkKCB0aGlzLm5vZGVzWyBpIF0gKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuZG9jRnJhZztcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbiggZGVzdHJveSApIHtcblx0XHRcdFx0aWYgKCBkZXN0cm95ICkge1xuXHRcdFx0XHRcdHRoaXMuZGV0YWNoKCk7XG5cdFx0XHRcdFx0dGhpcy5kb2NGcmFnID0gdGhpcy5ub2RlcyA9IG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGVhcmRvd24oIHRoaXMgKTtcblx0XHRcdH0sXG5cdFx0XHRmaXJzdE5vZGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZiAoIHRoaXMubm9kZXNbIDAgXSApIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5ub2Rlc1sgMCBdO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0aGlzLnBhcmVudEZyYWdtZW50LmZpbmROZXh0Tm9kZSggdGhpcyApO1xuXHRcdFx0fSxcblx0XHRcdHJlbmRlcjogZnVuY3Rpb24oIGh0bWwgKSB7XG5cdFx0XHRcdHZhciBub2RlLCBwTm9kZTtcblx0XHRcdFx0aWYgKCAhdGhpcy5ub2RlcyApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0d2hpbGUgKCB0aGlzLm5vZGVzLmxlbmd0aCApIHtcblx0XHRcdFx0XHRub2RlID0gdGhpcy5ub2Rlcy5wb3AoKTtcblx0XHRcdFx0XHRub2RlLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoIG5vZGUgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoICFodG1sICkge1xuXHRcdFx0XHRcdHRoaXMubm9kZXMgPSBbXTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0cE5vZGUgPSB0aGlzLnBhcmVudEZyYWdtZW50LnBOb2RlO1xuXHRcdFx0XHR0aGlzLm5vZGVzID0gaW5zZXJ0SHRtbCggaHRtbCwgcE5vZGUudGFnTmFtZSwgdGhpcy5kb2NGcmFnICk7XG5cdFx0XHRcdGlmICggIXRoaXMuaW5pdGlhbGlzaW5nICkge1xuXHRcdFx0XHRcdHBOb2RlLmluc2VydEJlZm9yZSggdGhpcy5kb2NGcmFnLCB0aGlzLnBhcmVudEZyYWdtZW50LmZpbmROZXh0Tm9kZSggdGhpcyApICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBwTm9kZS50YWdOYW1lID09PSAnU0VMRUNUJyAmJiBwTm9kZS5fcmFjdGl2ZSAmJiBwTm9kZS5fcmFjdGl2ZS5iaW5kaW5nICkge1xuXHRcdFx0XHRcdHBOb2RlLl9yYWN0aXZlLmJpbmRpbmcudXBkYXRlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHR0b1N0cmluZzogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnZhbHVlICE9IHVuZGVmaW5lZCA/IHRoaXMudmFsdWUgOiAnJztcblx0XHRcdH0sXG5cdFx0XHRmaW5kOiBmdW5jdGlvbiggc2VsZWN0b3IgKSB7XG5cdFx0XHRcdHZhciBpLCBsZW4sIG5vZGUsIHF1ZXJ5UmVzdWx0O1xuXHRcdFx0XHRsZW4gPSB0aGlzLm5vZGVzLmxlbmd0aDtcblx0XHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0XHRub2RlID0gdGhpcy5ub2Rlc1sgaSBdO1xuXHRcdFx0XHRcdGlmICggbm9kZS5ub2RlVHlwZSAhPT0gMSApIHtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIG1hdGNoZXMoIG5vZGUsIHNlbGVjdG9yICkgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbm9kZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCBxdWVyeVJlc3VsdCA9IG5vZGUucXVlcnlTZWxlY3Rvciggc2VsZWN0b3IgKSApIHtcblx0XHRcdFx0XHRcdHJldHVybiBxdWVyeVJlc3VsdDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9LFxuXHRcdFx0ZmluZEFsbDogZnVuY3Rpb24oIHNlbGVjdG9yLCBxdWVyeVJlc3VsdCApIHtcblx0XHRcdFx0dmFyIGksIGxlbiwgbm9kZSwgcXVlcnlBbGxSZXN1bHQsIG51bU5vZGVzLCBqO1xuXHRcdFx0XHRsZW4gPSB0aGlzLm5vZGVzLmxlbmd0aDtcblx0XHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0XHRub2RlID0gdGhpcy5ub2Rlc1sgaSBdO1xuXHRcdFx0XHRcdGlmICggbm9kZS5ub2RlVHlwZSAhPT0gMSApIHtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIG1hdGNoZXMoIG5vZGUsIHNlbGVjdG9yICkgKSB7XG5cdFx0XHRcdFx0XHRxdWVyeVJlc3VsdC5wdXNoKCBub2RlICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICggcXVlcnlBbGxSZXN1bHQgPSBub2RlLnF1ZXJ5U2VsZWN0b3JBbGwoIHNlbGVjdG9yICkgKSB7XG5cdFx0XHRcdFx0XHRudW1Ob2RlcyA9IHF1ZXJ5QWxsUmVzdWx0Lmxlbmd0aDtcblx0XHRcdFx0XHRcdGZvciAoIGogPSAwOyBqIDwgbnVtTm9kZXM7IGogKz0gMSApIHtcblx0XHRcdFx0XHRcdFx0cXVlcnlSZXN1bHQucHVzaCggcXVlcnlBbGxSZXN1bHRbIGogXSApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIERvbVRyaXBsZTtcblx0fSggY29uZmlnX3R5cGVzLCB1dGlsc19tYXRjaGVzLCByZW5kZXJfc2hhcmVkX2luaXRNdXN0YWNoZSwgcmVuZGVyX3NoYXJlZF91cGRhdGVNdXN0YWNoZSwgcmVuZGVyX3NoYXJlZF9yZXNvbHZlTXVzdGFjaGUsIHJlbmRlcl9Eb21GcmFnbWVudF9zaGFyZWRfaW5zZXJ0SHRtbCwgc2hhcmVkX3RlYXJkb3duICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X2luaXRpYWxpc2VfZ2V0RWxlbWVudE5hbWVzcGFjZSA9IGZ1bmN0aW9uKCBuYW1lc3BhY2VzICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBkZXNjcmlwdG9yLCBwYXJlbnROb2RlICkge1xuXHRcdFx0aWYgKCBkZXNjcmlwdG9yLmEgJiYgZGVzY3JpcHRvci5hLnhtbG5zICkge1xuXHRcdFx0XHRyZXR1cm4gZGVzY3JpcHRvci5hLnhtbG5zO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGRlc2NyaXB0b3IuZSA9PT0gJ3N2ZycgPyBuYW1lc3BhY2VzLnN2ZyA6IHBhcmVudE5vZGUubmFtZXNwYWNlVVJJIHx8IG5hbWVzcGFjZXMuaHRtbDtcblx0XHR9O1xuXHR9KCBjb25maWdfbmFtZXNwYWNlcyApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfc2hhcmVkX2VuZm9yY2VDYXNlID0gZnVuY3Rpb24oKSB7XG5cblx0XHR2YXIgc3ZnQ2FtZWxDYXNlRWxlbWVudHMsIHN2Z0NhbWVsQ2FzZUF0dHJpYnV0ZXMsIGNyZWF0ZU1hcCwgbWFwO1xuXHRcdHN2Z0NhbWVsQ2FzZUVsZW1lbnRzID0gJ2FsdEdseXBoIGFsdEdseXBoRGVmIGFsdEdseXBoSXRlbSBhbmltYXRlQ29sb3IgYW5pbWF0ZU1vdGlvbiBhbmltYXRlVHJhbnNmb3JtIGNsaXBQYXRoIGZlQmxlbmQgZmVDb2xvck1hdHJpeCBmZUNvbXBvbmVudFRyYW5zZmVyIGZlQ29tcG9zaXRlIGZlQ29udm9sdmVNYXRyaXggZmVEaWZmdXNlTGlnaHRpbmcgZmVEaXNwbGFjZW1lbnRNYXAgZmVEaXN0YW50TGlnaHQgZmVGbG9vZCBmZUZ1bmNBIGZlRnVuY0IgZmVGdW5jRyBmZUZ1bmNSIGZlR2F1c3NpYW5CbHVyIGZlSW1hZ2UgZmVNZXJnZSBmZU1lcmdlTm9kZSBmZU1vcnBob2xvZ3kgZmVPZmZzZXQgZmVQb2ludExpZ2h0IGZlU3BlY3VsYXJMaWdodGluZyBmZVNwb3RMaWdodCBmZVRpbGUgZmVUdXJidWxlbmNlIGZvcmVpZ25PYmplY3QgZ2x5cGhSZWYgbGluZWFyR3JhZGllbnQgcmFkaWFsR3JhZGllbnQgdGV4dFBhdGggdmtlcm4nLnNwbGl0KCAnICcgKTtcblx0XHRzdmdDYW1lbENhc2VBdHRyaWJ1dGVzID0gJ2F0dHJpYnV0ZU5hbWUgYXR0cmlidXRlVHlwZSBiYXNlRnJlcXVlbmN5IGJhc2VQcm9maWxlIGNhbGNNb2RlIGNsaXBQYXRoVW5pdHMgY29udGVudFNjcmlwdFR5cGUgY29udGVudFN0eWxlVHlwZSBkaWZmdXNlQ29uc3RhbnQgZWRnZU1vZGUgZXh0ZXJuYWxSZXNvdXJjZXNSZXF1aXJlZCBmaWx0ZXJSZXMgZmlsdGVyVW5pdHMgZ2x5cGhSZWYgZ3JhZGllbnRUcmFuc2Zvcm0gZ3JhZGllbnRVbml0cyBrZXJuZWxNYXRyaXgga2VybmVsVW5pdExlbmd0aCBrZXlQb2ludHMga2V5U3BsaW5lcyBrZXlUaW1lcyBsZW5ndGhBZGp1c3QgbGltaXRpbmdDb25lQW5nbGUgbWFya2VySGVpZ2h0IG1hcmtlclVuaXRzIG1hcmtlcldpZHRoIG1hc2tDb250ZW50VW5pdHMgbWFza1VuaXRzIG51bU9jdGF2ZXMgcGF0aExlbmd0aCBwYXR0ZXJuQ29udGVudFVuaXRzIHBhdHRlcm5UcmFuc2Zvcm0gcGF0dGVyblVuaXRzIHBvaW50c0F0WCBwb2ludHNBdFkgcG9pbnRzQXRaIHByZXNlcnZlQWxwaGEgcHJlc2VydmVBc3BlY3RSYXRpbyBwcmltaXRpdmVVbml0cyByZWZYIHJlZlkgcmVwZWF0Q291bnQgcmVwZWF0RHVyIHJlcXVpcmVkRXh0ZW5zaW9ucyByZXF1aXJlZEZlYXR1cmVzIHNwZWN1bGFyQ29uc3RhbnQgc3BlY3VsYXJFeHBvbmVudCBzcHJlYWRNZXRob2Qgc3RhcnRPZmZzZXQgc3RkRGV2aWF0aW9uIHN0aXRjaFRpbGVzIHN1cmZhY2VTY2FsZSBzeXN0ZW1MYW5ndWFnZSB0YWJsZVZhbHVlcyB0YXJnZXRYIHRhcmdldFkgdGV4dExlbmd0aCB2aWV3Qm94IHZpZXdUYXJnZXQgeENoYW5uZWxTZWxlY3RvciB5Q2hhbm5lbFNlbGVjdG9yIHpvb21BbmRQYW4nLnNwbGl0KCAnICcgKTtcblx0XHRjcmVhdGVNYXAgPSBmdW5jdGlvbiggaXRlbXMgKSB7XG5cdFx0XHR2YXIgbWFwID0ge30sIGkgPSBpdGVtcy5sZW5ndGg7XG5cdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0bWFwWyBpdGVtc1sgaSBdLnRvTG93ZXJDYXNlKCkgXSA9IGl0ZW1zWyBpIF07XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbWFwO1xuXHRcdH07XG5cdFx0bWFwID0gY3JlYXRlTWFwKCBzdmdDYW1lbENhc2VFbGVtZW50cy5jb25jYXQoIHN2Z0NhbWVsQ2FzZUF0dHJpYnV0ZXMgKSApO1xuXHRcdHJldHVybiBmdW5jdGlvbiggZWxlbWVudE5hbWUgKSB7XG5cdFx0XHR2YXIgbG93ZXJDYXNlRWxlbWVudE5hbWUgPSBlbGVtZW50TmFtZS50b0xvd2VyQ2FzZSgpO1xuXHRcdFx0cmV0dXJuIG1hcFsgbG93ZXJDYXNlRWxlbWVudE5hbWUgXSB8fCBsb3dlckNhc2VFbGVtZW50TmFtZTtcblx0XHR9O1xuXHR9KCk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9BdHRyaWJ1dGVfaGVscGVyc19kZXRlcm1pbmVOYW1lQW5kTmFtZXNwYWNlID0gZnVuY3Rpb24oIG5hbWVzcGFjZXMsIGVuZm9yY2VDYXNlICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBhdHRyaWJ1dGUsIG5hbWUgKSB7XG5cdFx0XHR2YXIgY29sb25JbmRleCwgbmFtZXNwYWNlUHJlZml4O1xuXHRcdFx0Y29sb25JbmRleCA9IG5hbWUuaW5kZXhPZiggJzonICk7XG5cdFx0XHRpZiAoIGNvbG9uSW5kZXggIT09IC0xICkge1xuXHRcdFx0XHRuYW1lc3BhY2VQcmVmaXggPSBuYW1lLnN1YnN0ciggMCwgY29sb25JbmRleCApO1xuXHRcdFx0XHRpZiAoIG5hbWVzcGFjZVByZWZpeCAhPT0gJ3htbG5zJyApIHtcblx0XHRcdFx0XHRuYW1lID0gbmFtZS5zdWJzdHJpbmcoIGNvbG9uSW5kZXggKyAxICk7XG5cdFx0XHRcdFx0YXR0cmlidXRlLm5hbWUgPSBlbmZvcmNlQ2FzZSggbmFtZSApO1xuXHRcdFx0XHRcdGF0dHJpYnV0ZS5sY05hbWUgPSBhdHRyaWJ1dGUubmFtZS50b0xvd2VyQ2FzZSgpO1xuXHRcdFx0XHRcdGF0dHJpYnV0ZS5uYW1lc3BhY2UgPSBuYW1lc3BhY2VzWyBuYW1lc3BhY2VQcmVmaXgudG9Mb3dlckNhc2UoKSBdO1xuXHRcdFx0XHRcdGlmICggIWF0dHJpYnV0ZS5uYW1lc3BhY2UgKSB7XG5cdFx0XHRcdFx0XHR0aHJvdyAnVW5rbm93biBuYW1lc3BhY2UgKFwiJyArIG5hbWVzcGFjZVByZWZpeCArICdcIiknO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGF0dHJpYnV0ZS5uYW1lID0gYXR0cmlidXRlLmVsZW1lbnQubmFtZXNwYWNlICE9PSBuYW1lc3BhY2VzLmh0bWwgPyBlbmZvcmNlQ2FzZSggbmFtZSApIDogbmFtZTtcblx0XHRcdGF0dHJpYnV0ZS5sY05hbWUgPSBhdHRyaWJ1dGUubmFtZS50b0xvd2VyQ2FzZSgpO1xuXHRcdH07XG5cdH0oIGNvbmZpZ19uYW1lc3BhY2VzLCByZW5kZXJfRG9tRnJhZ21lbnRfc2hhcmVkX2VuZm9yY2VDYXNlICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9BdHRyaWJ1dGVfaGVscGVyc19zZXRTdGF0aWNBdHRyaWJ1dGUgPSBmdW5jdGlvbiggbmFtZXNwYWNlcyApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiBzZXRTdGF0aWNBdHRyaWJ1dGUoIGF0dHJpYnV0ZSwgb3B0aW9ucyApIHtcblx0XHRcdHZhciBub2RlLCB2YWx1ZSA9IG9wdGlvbnMudmFsdWUgPT09IG51bGwgPyAnJyA6IG9wdGlvbnMudmFsdWU7XG5cdFx0XHRpZiAoIG5vZGUgPSBvcHRpb25zLnBOb2RlICkge1xuXHRcdFx0XHRpZiAoIGF0dHJpYnV0ZS5uYW1lc3BhY2UgKSB7XG5cdFx0XHRcdFx0bm9kZS5zZXRBdHRyaWJ1dGVOUyggYXR0cmlidXRlLm5hbWVzcGFjZSwgb3B0aW9ucy5uYW1lLCB2YWx1ZSApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGlmICggb3B0aW9ucy5uYW1lID09PSAnc3R5bGUnICYmIG5vZGUuc3R5bGUuc2V0QXR0cmlidXRlICkge1xuXHRcdFx0XHRcdFx0bm9kZS5zdHlsZS5zZXRBdHRyaWJ1dGUoICdjc3NUZXh0JywgdmFsdWUgKTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKCBvcHRpb25zLm5hbWUgPT09ICdjbGFzcycgJiYgKCAhbm9kZS5uYW1lc3BhY2VVUkkgfHwgbm9kZS5uYW1lc3BhY2VVUkkgPT09IG5hbWVzcGFjZXMuaHRtbCApICkge1xuXHRcdFx0XHRcdFx0bm9kZS5jbGFzc05hbWUgPSB2YWx1ZTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0bm9kZS5zZXRBdHRyaWJ1dGUoIG9wdGlvbnMubmFtZSwgdmFsdWUgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBhdHRyaWJ1dGUubmFtZSA9PT0gJ2lkJyApIHtcblx0XHRcdFx0XHRvcHRpb25zLnJvb3Qubm9kZXNbIG9wdGlvbnMudmFsdWUgXSA9IG5vZGU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBhdHRyaWJ1dGUubmFtZSA9PT0gJ3ZhbHVlJyApIHtcblx0XHRcdFx0XHRub2RlLl9yYWN0aXZlLnZhbHVlID0gb3B0aW9ucy52YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0YXR0cmlidXRlLnZhbHVlID0gb3B0aW9ucy52YWx1ZTtcblx0XHR9O1xuXHR9KCBjb25maWdfbmFtZXNwYWNlcyApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfQXR0cmlidXRlX2hlbHBlcnNfZGV0ZXJtaW5lUHJvcGVydHlOYW1lID0gZnVuY3Rpb24oIG5hbWVzcGFjZXMgKSB7XG5cblx0XHR2YXIgcHJvcGVydHlOYW1lcyA9IHtcblx0XHRcdCdhY2NlcHQtY2hhcnNldCc6ICdhY2NlcHRDaGFyc2V0Jyxcblx0XHRcdGFjY2Vzc2tleTogJ2FjY2Vzc0tleScsXG5cdFx0XHRiZ2NvbG9yOiAnYmdDb2xvcicsXG5cdFx0XHQnY2xhc3MnOiAnY2xhc3NOYW1lJyxcblx0XHRcdGNvZGViYXNlOiAnY29kZUJhc2UnLFxuXHRcdFx0Y29sc3BhbjogJ2NvbFNwYW4nLFxuXHRcdFx0Y29udGVudGVkaXRhYmxlOiAnY29udGVudEVkaXRhYmxlJyxcblx0XHRcdGRhdGV0aW1lOiAnZGF0ZVRpbWUnLFxuXHRcdFx0ZGlybmFtZTogJ2Rpck5hbWUnLFxuXHRcdFx0J2Zvcic6ICdodG1sRm9yJyxcblx0XHRcdCdodHRwLWVxdWl2JzogJ2h0dHBFcXVpdicsXG5cdFx0XHRpc21hcDogJ2lzTWFwJyxcblx0XHRcdG1heGxlbmd0aDogJ21heExlbmd0aCcsXG5cdFx0XHRub3ZhbGlkYXRlOiAnbm9WYWxpZGF0ZScsXG5cdFx0XHRwdWJkYXRlOiAncHViRGF0ZScsXG5cdFx0XHRyZWFkb25seTogJ3JlYWRPbmx5Jyxcblx0XHRcdHJvd3NwYW46ICdyb3dTcGFuJyxcblx0XHRcdHRhYmluZGV4OiAndGFiSW5kZXgnLFxuXHRcdFx0dXNlbWFwOiAndXNlTWFwJ1xuXHRcdH07XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBhdHRyaWJ1dGUsIG9wdGlvbnMgKSB7XG5cdFx0XHR2YXIgcHJvcGVydHlOYW1lO1xuXHRcdFx0aWYgKCBhdHRyaWJ1dGUucE5vZGUgJiYgIWF0dHJpYnV0ZS5uYW1lc3BhY2UgJiYgKCAhb3B0aW9ucy5wTm9kZS5uYW1lc3BhY2VVUkkgfHwgb3B0aW9ucy5wTm9kZS5uYW1lc3BhY2VVUkkgPT09IG5hbWVzcGFjZXMuaHRtbCApICkge1xuXHRcdFx0XHRwcm9wZXJ0eU5hbWUgPSBwcm9wZXJ0eU5hbWVzWyBhdHRyaWJ1dGUubmFtZSBdIHx8IGF0dHJpYnV0ZS5uYW1lO1xuXHRcdFx0XHRpZiAoIG9wdGlvbnMucE5vZGVbIHByb3BlcnR5TmFtZSBdICE9PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdFx0YXR0cmlidXRlLnByb3BlcnR5TmFtZSA9IHByb3BlcnR5TmFtZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHR5cGVvZiBvcHRpb25zLnBOb2RlWyBwcm9wZXJ0eU5hbWUgXSA9PT0gJ2Jvb2xlYW4nIHx8IHByb3BlcnR5TmFtZSA9PT0gJ3ZhbHVlJyApIHtcblx0XHRcdFx0XHRhdHRyaWJ1dGUudXNlUHJvcGVydHkgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0fSggY29uZmlnX25hbWVzcGFjZXMgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0F0dHJpYnV0ZV9oZWxwZXJzX2dldEludGVycG9sYXRvciA9IGZ1bmN0aW9uKCB0eXBlcyApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiBnZXRJbnRlcnBvbGF0b3IoIGF0dHJpYnV0ZSApIHtcblx0XHRcdHZhciBpdGVtcywgaXRlbTtcblx0XHRcdGl0ZW1zID0gYXR0cmlidXRlLmZyYWdtZW50Lml0ZW1zO1xuXHRcdFx0aWYgKCBpdGVtcy5sZW5ndGggIT09IDEgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGl0ZW0gPSBpdGVtc1sgMCBdO1xuXHRcdFx0aWYgKCBpdGVtLnR5cGUgIT09IHR5cGVzLklOVEVSUE9MQVRPUiB8fCAhaXRlbS5rZXlwYXRoICYmICFpdGVtLnJlZiApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGl0ZW07XG5cdFx0fTtcblx0fSggY29uZmlnX3R5cGVzICk7XG5cblx0dmFyIHV0aWxzX2FycmF5Q29udGVudHNNYXRjaCA9IGZ1bmN0aW9uKCBpc0FycmF5ICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBhLCBiICkge1xuXHRcdFx0dmFyIGk7XG5cdFx0XHRpZiAoICFpc0FycmF5KCBhICkgfHwgIWlzQXJyYXkoIGIgKSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBhLmxlbmd0aCAhPT0gYi5sZW5ndGggKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGkgPSBhLmxlbmd0aDtcblx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRpZiAoIGFbIGkgXSAhPT0gYlsgaSBdICkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fTtcblx0fSggdXRpbHNfaXNBcnJheSApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfQXR0cmlidXRlX3Byb3RvdHlwZV9iaW5kID0gZnVuY3Rpb24oIHJ1bmxvb3AsIHdhcm4sIGFycmF5Q29udGVudHNNYXRjaCwgZ2V0VmFsdWVGcm9tQ2hlY2tib3hlcywgZ2V0LCBzZXQgKSB7XG5cblx0XHR2YXIgc2luZ2xlTXVzdGFjaGVFcnJvciA9ICdGb3IgdHdvLXdheSBiaW5kaW5nIHRvIHdvcmssIGF0dHJpYnV0ZSB2YWx1ZSBtdXN0IGJlIGEgc2luZ2xlIGludGVycG9sYXRvciAoZS5nLiB2YWx1ZT1cInt7Zm9vfX1cIiknLFxuXHRcdFx0ZXhwcmVzc2lvbkVycm9yID0gJ1lvdSBjYW5ub3Qgc2V0IHVwIHR3by13YXkgYmluZGluZyBhZ2FpbnN0IGFuIGV4cHJlc3Npb24gJyxcblx0XHRcdGJpbmRBdHRyaWJ1dGUsIHVwZGF0ZU1vZGVsLCBnZXRPcHRpb25zLCB1cGRhdGUsIGdldEJpbmRpbmcsIGluaGVyaXRQcm9wZXJ0aWVzLCBNdWx0aXBsZVNlbGVjdEJpbmRpbmcsIFNlbGVjdEJpbmRpbmcsIFJhZGlvTmFtZUJpbmRpbmcsIENoZWNrYm94TmFtZUJpbmRpbmcsIENoZWNrZWRCaW5kaW5nLCBGaWxlTGlzdEJpbmRpbmcsIENvbnRlbnRFZGl0YWJsZUJpbmRpbmcsIEdlbmVyaWNCaW5kaW5nO1xuXHRcdGJpbmRBdHRyaWJ1dGUgPSBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBub2RlID0gdGhpcy5wTm9kZSxcblx0XHRcdFx0aW50ZXJwb2xhdG9yLCBiaW5kaW5nLCBiaW5kaW5ncztcblx0XHRcdGludGVycG9sYXRvciA9IHRoaXMuaW50ZXJwb2xhdG9yO1xuXHRcdFx0aWYgKCAhaW50ZXJwb2xhdG9yICkge1xuXHRcdFx0XHR3YXJuKCBzaW5nbGVNdXN0YWNoZUVycm9yICk7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmICggaW50ZXJwb2xhdG9yLmtleXBhdGggJiYgaW50ZXJwb2xhdG9yLmtleXBhdGguc3Vic3RyID09PSAnJHsnICkge1xuXHRcdFx0XHR3YXJuKCBleHByZXNzaW9uRXJyb3IgKyBpbnRlcnBvbGF0b3Iua2V5cGF0aCApO1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICFpbnRlcnBvbGF0b3Iua2V5cGF0aCApIHtcblx0XHRcdFx0aW50ZXJwb2xhdG9yLnJlc29sdmUoIGludGVycG9sYXRvci5kZXNjcmlwdG9yLnIgKTtcblx0XHRcdH1cblx0XHRcdHRoaXMua2V5cGF0aCA9IGludGVycG9sYXRvci5rZXlwYXRoO1xuXHRcdFx0YmluZGluZyA9IGdldEJpbmRpbmcoIHRoaXMgKTtcblx0XHRcdGlmICggIWJpbmRpbmcgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdG5vZGUuX3JhY3RpdmUuYmluZGluZyA9IHRoaXMuZWxlbWVudC5iaW5kaW5nID0gYmluZGluZztcblx0XHRcdHRoaXMudHdvd2F5ID0gdHJ1ZTtcblx0XHRcdGJpbmRpbmdzID0gdGhpcy5yb290Ll90d293YXlCaW5kaW5nc1sgdGhpcy5rZXlwYXRoIF0gfHwgKCB0aGlzLnJvb3QuX3R3b3dheUJpbmRpbmdzWyB0aGlzLmtleXBhdGggXSA9IFtdICk7XG5cdFx0XHRiaW5kaW5ncy5wdXNoKCBiaW5kaW5nICk7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9O1xuXHRcdHVwZGF0ZU1vZGVsID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRydW5sb29wLnN0YXJ0KCB0aGlzLl9yYWN0aXZlLnJvb3QgKTtcblx0XHRcdHRoaXMuX3JhY3RpdmUuYmluZGluZy51cGRhdGUoKTtcblx0XHRcdHJ1bmxvb3AuZW5kKCk7XG5cdFx0fTtcblx0XHRnZXRPcHRpb25zID0ge1xuXHRcdFx0ZXZhbHVhdGVXcmFwcGVkOiB0cnVlXG5cdFx0fTtcblx0XHR1cGRhdGUgPSBmdW5jdGlvbigpIHtcblx0XHRcdHZhciB2YWx1ZSA9IGdldCggdGhpcy5fcmFjdGl2ZS5yb290LCB0aGlzLl9yYWN0aXZlLmJpbmRpbmcua2V5cGF0aCwgZ2V0T3B0aW9ucyApO1xuXHRcdFx0dGhpcy52YWx1ZSA9IHZhbHVlID09IHVuZGVmaW5lZCA/ICcnIDogdmFsdWU7XG5cdFx0fTtcblx0XHRnZXRCaW5kaW5nID0gZnVuY3Rpb24oIGF0dHJpYnV0ZSApIHtcblx0XHRcdHZhciBub2RlID0gYXR0cmlidXRlLnBOb2RlO1xuXHRcdFx0aWYgKCBub2RlLnRhZ05hbWUgPT09ICdTRUxFQ1QnICkge1xuXHRcdFx0XHRyZXR1cm4gbm9kZS5tdWx0aXBsZSA/IG5ldyBNdWx0aXBsZVNlbGVjdEJpbmRpbmcoIGF0dHJpYnV0ZSwgbm9kZSApIDogbmV3IFNlbGVjdEJpbmRpbmcoIGF0dHJpYnV0ZSwgbm9kZSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBub2RlLnR5cGUgPT09ICdjaGVja2JveCcgfHwgbm9kZS50eXBlID09PSAncmFkaW8nICkge1xuXHRcdFx0XHRpZiAoIGF0dHJpYnV0ZS5wcm9wZXJ0eU5hbWUgPT09ICduYW1lJyApIHtcblx0XHRcdFx0XHRpZiAoIG5vZGUudHlwZSA9PT0gJ2NoZWNrYm94JyApIHtcblx0XHRcdFx0XHRcdHJldHVybiBuZXcgQ2hlY2tib3hOYW1lQmluZGluZyggYXR0cmlidXRlLCBub2RlICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICggbm9kZS50eXBlID09PSAncmFkaW8nICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIG5ldyBSYWRpb05hbWVCaW5kaW5nKCBhdHRyaWJ1dGUsIG5vZGUgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBhdHRyaWJ1dGUucHJvcGVydHlOYW1lID09PSAnY2hlY2tlZCcgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBDaGVja2VkQmluZGluZyggYXR0cmlidXRlLCBub2RlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGF0dHJpYnV0ZS5sY05hbWUgIT09ICd2YWx1ZScgKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ0F0dGVtcHRlZCB0byBzZXQgdXAgYW4gaWxsZWdhbCB0d28td2F5IGJpbmRpbmcuIFRoaXMgZXJyb3IgaXMgdW5leHBlY3RlZCAtIGlmIHlvdSBjYW4sIHBsZWFzZSBmaWxlIGFuIGlzc3VlIGF0IGh0dHBzOi8vZ2l0aHViLmNvbS9SYWN0aXZlSlMvUmFjdGl2ZSwgb3IgY29udGFjdCBAUmFjdGl2ZUpTIG9uIFR3aXR0ZXIuIFRoYW5rcyEnICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIG5vZGUudHlwZSA9PT0gJ2ZpbGUnICkge1xuXHRcdFx0XHRyZXR1cm4gbmV3IEZpbGVMaXN0QmluZGluZyggYXR0cmlidXRlLCBub2RlICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIG5vZGUuZ2V0QXR0cmlidXRlKCAnY29udGVudGVkaXRhYmxlJyApICkge1xuXHRcdFx0XHRyZXR1cm4gbmV3IENvbnRlbnRFZGl0YWJsZUJpbmRpbmcoIGF0dHJpYnV0ZSwgbm9kZSApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG5ldyBHZW5lcmljQmluZGluZyggYXR0cmlidXRlLCBub2RlICk7XG5cdFx0fTtcblx0XHRNdWx0aXBsZVNlbGVjdEJpbmRpbmcgPSBmdW5jdGlvbiggYXR0cmlidXRlLCBub2RlICkge1xuXHRcdFx0dmFyIHZhbHVlRnJvbU1vZGVsO1xuXHRcdFx0aW5oZXJpdFByb3BlcnRpZXMoIHRoaXMsIGF0dHJpYnV0ZSwgbm9kZSApO1xuXHRcdFx0bm9kZS5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgdXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0XHR2YWx1ZUZyb21Nb2RlbCA9IGdldCggdGhpcy5yb290LCB0aGlzLmtleXBhdGggKTtcblx0XHRcdGlmICggdmFsdWVGcm9tTW9kZWwgPT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0dGhpcy51cGRhdGUoKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdE11bHRpcGxlU2VsZWN0QmluZGluZy5wcm90b3R5cGUgPSB7XG5cdFx0XHR2YWx1ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBzZWxlY3RlZFZhbHVlcywgb3B0aW9ucywgaSwgbGVuLCBvcHRpb24sIG9wdGlvblZhbHVlO1xuXHRcdFx0XHRzZWxlY3RlZFZhbHVlcyA9IFtdO1xuXHRcdFx0XHRvcHRpb25zID0gdGhpcy5ub2RlLm9wdGlvbnM7XG5cdFx0XHRcdGxlbiA9IG9wdGlvbnMubGVuZ3RoO1xuXHRcdFx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRcdG9wdGlvbiA9IG9wdGlvbnNbIGkgXTtcblx0XHRcdFx0XHRpZiAoIG9wdGlvbi5zZWxlY3RlZCApIHtcblx0XHRcdFx0XHRcdG9wdGlvblZhbHVlID0gb3B0aW9uLl9yYWN0aXZlID8gb3B0aW9uLl9yYWN0aXZlLnZhbHVlIDogb3B0aW9uLnZhbHVlO1xuXHRcdFx0XHRcdFx0c2VsZWN0ZWRWYWx1ZXMucHVzaCggb3B0aW9uVmFsdWUgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHNlbGVjdGVkVmFsdWVzO1xuXHRcdFx0fSxcblx0XHRcdHVwZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBhdHRyaWJ1dGUsIHByZXZpb3VzVmFsdWUsIHZhbHVlO1xuXHRcdFx0XHRhdHRyaWJ1dGUgPSB0aGlzLmF0dHI7XG5cdFx0XHRcdHByZXZpb3VzVmFsdWUgPSBhdHRyaWJ1dGUudmFsdWU7XG5cdFx0XHRcdHZhbHVlID0gdGhpcy52YWx1ZSgpO1xuXHRcdFx0XHRpZiAoIHByZXZpb3VzVmFsdWUgPT09IHVuZGVmaW5lZCB8fCAhYXJyYXlDb250ZW50c01hdGNoKCB2YWx1ZSwgcHJldmlvdXNWYWx1ZSApICkge1xuXHRcdFx0XHRcdGF0dHJpYnV0ZS5yZWNlaXZpbmcgPSB0cnVlO1xuXHRcdFx0XHRcdGF0dHJpYnV0ZS52YWx1ZSA9IHZhbHVlO1xuXHRcdFx0XHRcdHNldCggdGhpcy5yb290LCB0aGlzLmtleXBhdGgsIHZhbHVlICk7XG5cdFx0XHRcdFx0cnVubG9vcC50cmlnZ2VyKCk7XG5cdFx0XHRcdFx0YXR0cmlidXRlLnJlY2VpdmluZyA9IGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0aGlzO1xuXHRcdFx0fSxcblx0XHRcdGRlZmVyVXBkYXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0aWYgKCB0aGlzLmRlZmVycmVkID09PSB0cnVlICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRydW5sb29wLmFkZEF0dHJpYnV0ZSggdGhpcyApO1xuXHRcdFx0XHR0aGlzLmRlZmVycmVkID0gdHJ1ZTtcblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHRoaXMubm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgdXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRTZWxlY3RCaW5kaW5nID0gZnVuY3Rpb24oIGF0dHJpYnV0ZSwgbm9kZSApIHtcblx0XHRcdHZhciB2YWx1ZUZyb21Nb2RlbDtcblx0XHRcdGluaGVyaXRQcm9wZXJ0aWVzKCB0aGlzLCBhdHRyaWJ1dGUsIG5vZGUgKTtcblx0XHRcdG5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIHVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdFx0dmFsdWVGcm9tTW9kZWwgPSBnZXQoIHRoaXMucm9vdCwgdGhpcy5rZXlwYXRoICk7XG5cdFx0XHRpZiAoIHZhbHVlRnJvbU1vZGVsID09PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlKCk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRTZWxlY3RCaW5kaW5nLnByb3RvdHlwZSA9IHtcblx0XHRcdHZhbHVlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIG9wdGlvbnMsIGksIGxlbiwgb3B0aW9uLCBvcHRpb25WYWx1ZTtcblx0XHRcdFx0b3B0aW9ucyA9IHRoaXMubm9kZS5vcHRpb25zO1xuXHRcdFx0XHRsZW4gPSBvcHRpb25zLmxlbmd0aDtcblx0XHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0XHRvcHRpb24gPSBvcHRpb25zWyBpIF07XG5cdFx0XHRcdFx0aWYgKCBvcHRpb25zWyBpIF0uc2VsZWN0ZWQgKSB7XG5cdFx0XHRcdFx0XHRvcHRpb25WYWx1ZSA9IG9wdGlvbi5fcmFjdGl2ZSA/IG9wdGlvbi5fcmFjdGl2ZS52YWx1ZSA6IG9wdGlvbi52YWx1ZTtcblx0XHRcdFx0XHRcdHJldHVybiBvcHRpb25WYWx1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHR1cGRhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgdmFsdWUgPSB0aGlzLnZhbHVlKCk7XG5cdFx0XHRcdHRoaXMuYXR0ci5yZWNlaXZpbmcgPSB0cnVlO1xuXHRcdFx0XHR0aGlzLmF0dHIudmFsdWUgPSB2YWx1ZTtcblx0XHRcdFx0c2V0KCB0aGlzLnJvb3QsIHRoaXMua2V5cGF0aCwgdmFsdWUgKTtcblx0XHRcdFx0cnVubG9vcC50cmlnZ2VyKCk7XG5cdFx0XHRcdHRoaXMuYXR0ci5yZWNlaXZpbmcgPSBmYWxzZTtcblx0XHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0XHR9LFxuXHRcdFx0ZGVmZXJVcGRhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZiAoIHRoaXMuZGVmZXJyZWQgPT09IHRydWUgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJ1bmxvb3AuYWRkQXR0cmlidXRlKCB0aGlzICk7XG5cdFx0XHRcdHRoaXMuZGVmZXJyZWQgPSB0cnVlO1xuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dGhpcy5ub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCB1cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdFJhZGlvTmFtZUJpbmRpbmcgPSBmdW5jdGlvbiggYXR0cmlidXRlLCBub2RlICkge1xuXHRcdFx0dmFyIHZhbHVlRnJvbU1vZGVsO1xuXHRcdFx0dGhpcy5yYWRpb05hbWUgPSB0cnVlO1xuXHRcdFx0aW5oZXJpdFByb3BlcnRpZXMoIHRoaXMsIGF0dHJpYnV0ZSwgbm9kZSApO1xuXHRcdFx0bm9kZS5uYW1lID0gJ3t7JyArIGF0dHJpYnV0ZS5rZXlwYXRoICsgJ319Jztcblx0XHRcdG5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIHVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdFx0aWYgKCBub2RlLmF0dGFjaEV2ZW50ICkge1xuXHRcdFx0XHRub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIHVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdFx0fVxuXHRcdFx0dmFsdWVGcm9tTW9kZWwgPSBnZXQoIHRoaXMucm9vdCwgdGhpcy5rZXlwYXRoICk7XG5cdFx0XHRpZiAoIHZhbHVlRnJvbU1vZGVsICE9PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdG5vZGUuY2hlY2tlZCA9IHZhbHVlRnJvbU1vZGVsID09IG5vZGUuX3JhY3RpdmUudmFsdWU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRydW5sb29wLmFkZFJhZGlvKCB0aGlzICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRSYWRpb05hbWVCaW5kaW5nLnByb3RvdHlwZSA9IHtcblx0XHRcdHZhbHVlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMubm9kZS5fcmFjdGl2ZSA/IHRoaXMubm9kZS5fcmFjdGl2ZS52YWx1ZSA6IHRoaXMubm9kZS52YWx1ZTtcblx0XHRcdH0sXG5cdFx0XHR1cGRhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgbm9kZSA9IHRoaXMubm9kZTtcblx0XHRcdFx0aWYgKCBub2RlLmNoZWNrZWQgKSB7XG5cdFx0XHRcdFx0dGhpcy5hdHRyLnJlY2VpdmluZyA9IHRydWU7XG5cdFx0XHRcdFx0c2V0KCB0aGlzLnJvb3QsIHRoaXMua2V5cGF0aCwgdGhpcy52YWx1ZSgpICk7XG5cdFx0XHRcdFx0cnVubG9vcC50cmlnZ2VyKCk7XG5cdFx0XHRcdFx0dGhpcy5hdHRyLnJlY2VpdmluZyA9IGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR0aGlzLm5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIHVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdFx0XHR0aGlzLm5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgdXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRDaGVja2JveE5hbWVCaW5kaW5nID0gZnVuY3Rpb24oIGF0dHJpYnV0ZSwgbm9kZSApIHtcblx0XHRcdHZhciB2YWx1ZUZyb21Nb2RlbCwgY2hlY2tlZDtcblx0XHRcdHRoaXMuY2hlY2tib3hOYW1lID0gdHJ1ZTtcblx0XHRcdGluaGVyaXRQcm9wZXJ0aWVzKCB0aGlzLCBhdHRyaWJ1dGUsIG5vZGUgKTtcblx0XHRcdG5vZGUubmFtZSA9ICd7eycgKyB0aGlzLmtleXBhdGggKyAnfX0nO1xuXHRcdFx0bm9kZS5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgdXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0XHRpZiAoIG5vZGUuYXR0YWNoRXZlbnQgKSB7XG5cdFx0XHRcdG5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgdXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0XHR2YWx1ZUZyb21Nb2RlbCA9IGdldCggdGhpcy5yb290LCB0aGlzLmtleXBhdGggKTtcblx0XHRcdGlmICggdmFsdWVGcm9tTW9kZWwgIT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0Y2hlY2tlZCA9IHZhbHVlRnJvbU1vZGVsLmluZGV4T2YoIG5vZGUuX3JhY3RpdmUudmFsdWUgKSAhPT0gLTE7XG5cdFx0XHRcdG5vZGUuY2hlY2tlZCA9IGNoZWNrZWQ7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRydW5sb29wLmFkZENoZWNrYm94KCB0aGlzICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRDaGVja2JveE5hbWVCaW5kaW5nLnByb3RvdHlwZSA9IHtcblx0XHRcdGNoYW5nZWQ6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5ub2RlLmNoZWNrZWQgIT09ICEhIHRoaXMuY2hlY2tlZDtcblx0XHRcdH0sXG5cdFx0XHR1cGRhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR0aGlzLmNoZWNrZWQgPSB0aGlzLm5vZGUuY2hlY2tlZDtcblx0XHRcdFx0dGhpcy5hdHRyLnJlY2VpdmluZyA9IHRydWU7XG5cdFx0XHRcdHNldCggdGhpcy5yb290LCB0aGlzLmtleXBhdGgsIGdldFZhbHVlRnJvbUNoZWNrYm94ZXMoIHRoaXMucm9vdCwgdGhpcy5rZXlwYXRoICkgKTtcblx0XHRcdFx0cnVubG9vcC50cmlnZ2VyKCk7XG5cdFx0XHRcdHRoaXMuYXR0ci5yZWNlaXZpbmcgPSBmYWxzZTtcblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHRoaXMubm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgdXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0XHRcdHRoaXMubm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2xpY2snLCB1cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdENoZWNrZWRCaW5kaW5nID0gZnVuY3Rpb24oIGF0dHJpYnV0ZSwgbm9kZSApIHtcblx0XHRcdGluaGVyaXRQcm9wZXJ0aWVzKCB0aGlzLCBhdHRyaWJ1dGUsIG5vZGUgKTtcblx0XHRcdG5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIHVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdFx0aWYgKCBub2RlLmF0dGFjaEV2ZW50ICkge1xuXHRcdFx0XHRub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIHVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0Q2hlY2tlZEJpbmRpbmcucHJvdG90eXBlID0ge1xuXHRcdFx0dmFsdWU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5ub2RlLmNoZWNrZWQ7XG5cdFx0XHR9LFxuXHRcdFx0dXBkYXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dGhpcy5hdHRyLnJlY2VpdmluZyA9IHRydWU7XG5cdFx0XHRcdHNldCggdGhpcy5yb290LCB0aGlzLmtleXBhdGgsIHRoaXMudmFsdWUoKSApO1xuXHRcdFx0XHRydW5sb29wLnRyaWdnZXIoKTtcblx0XHRcdFx0dGhpcy5hdHRyLnJlY2VpdmluZyA9IGZhbHNlO1xuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dGhpcy5ub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCB1cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHRcdFx0dGhpcy5ub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdjbGljaycsIHVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0RmlsZUxpc3RCaW5kaW5nID0gZnVuY3Rpb24oIGF0dHJpYnV0ZSwgbm9kZSApIHtcblx0XHRcdGluaGVyaXRQcm9wZXJ0aWVzKCB0aGlzLCBhdHRyaWJ1dGUsIG5vZGUgKTtcblx0XHRcdG5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIHVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdH07XG5cdFx0RmlsZUxpc3RCaW5kaW5nLnByb3RvdHlwZSA9IHtcblx0XHRcdHZhbHVlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuYXR0ci5wTm9kZS5maWxlcztcblx0XHRcdH0sXG5cdFx0XHR1cGRhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRzZXQoIHRoaXMuYXR0ci5yb290LCB0aGlzLmF0dHIua2V5cGF0aCwgdGhpcy52YWx1ZSgpICk7XG5cdFx0XHRcdHJ1bmxvb3AudHJpZ2dlcigpO1xuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dGhpcy5ub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCB1cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdENvbnRlbnRFZGl0YWJsZUJpbmRpbmcgPSBmdW5jdGlvbiggYXR0cmlidXRlLCBub2RlICkge1xuXHRcdFx0aW5oZXJpdFByb3BlcnRpZXMoIHRoaXMsIGF0dHJpYnV0ZSwgbm9kZSApO1xuXHRcdFx0bm9kZS5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgdXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0XHRpZiAoICF0aGlzLnJvb3QubGF6eSApIHtcblx0XHRcdFx0bm9kZS5hZGRFdmVudExpc3RlbmVyKCAnaW5wdXQnLCB1cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHRcdFx0aWYgKCBub2RlLmF0dGFjaEV2ZW50ICkge1xuXHRcdFx0XHRcdG5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ2tleXVwJywgdXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHRcdENvbnRlbnRFZGl0YWJsZUJpbmRpbmcucHJvdG90eXBlID0ge1xuXHRcdFx0dXBkYXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dGhpcy5hdHRyLnJlY2VpdmluZyA9IHRydWU7XG5cdFx0XHRcdHNldCggdGhpcy5yb290LCB0aGlzLmtleXBhdGgsIHRoaXMubm9kZS5pbm5lckhUTUwgKTtcblx0XHRcdFx0cnVubG9vcC50cmlnZ2VyKCk7XG5cdFx0XHRcdHRoaXMuYXR0ci5yZWNlaXZpbmcgPSBmYWxzZTtcblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHRoaXMubm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgdXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0XHRcdHRoaXMubm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKCAnaW5wdXQnLCB1cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHRcdFx0dGhpcy5ub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdrZXl1cCcsIHVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0R2VuZXJpY0JpbmRpbmcgPSBmdW5jdGlvbiggYXR0cmlidXRlLCBub2RlICkge1xuXHRcdFx0aW5oZXJpdFByb3BlcnRpZXMoIHRoaXMsIGF0dHJpYnV0ZSwgbm9kZSApO1xuXHRcdFx0bm9kZS5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgdXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0XHRpZiAoICF0aGlzLnJvb3QubGF6eSApIHtcblx0XHRcdFx0bm9kZS5hZGRFdmVudExpc3RlbmVyKCAnaW5wdXQnLCB1cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHRcdFx0aWYgKCBub2RlLmF0dGFjaEV2ZW50ICkge1xuXHRcdFx0XHRcdG5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ2tleXVwJywgdXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHRoaXMubm9kZS5hZGRFdmVudExpc3RlbmVyKCAnYmx1cicsIHVwZGF0ZSwgZmFsc2UgKTtcblx0XHR9O1xuXHRcdEdlbmVyaWNCaW5kaW5nLnByb3RvdHlwZSA9IHtcblx0XHRcdHZhbHVlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHZhbHVlID0gdGhpcy5hdHRyLnBOb2RlLnZhbHVlO1xuXHRcdFx0XHRpZiAoICt2YWx1ZSArICcnID09PSB2YWx1ZSAmJiB2YWx1ZS5pbmRleE9mKCAnZScgKSA9PT0gLTEgKSB7XG5cdFx0XHRcdFx0dmFsdWUgPSArdmFsdWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdFx0fSxcblx0XHRcdHVwZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBhdHRyaWJ1dGUgPSB0aGlzLmF0dHIsXG5cdFx0XHRcdFx0dmFsdWUgPSB0aGlzLnZhbHVlKCk7XG5cdFx0XHRcdGF0dHJpYnV0ZS5yZWNlaXZpbmcgPSB0cnVlO1xuXHRcdFx0XHRzZXQoIGF0dHJpYnV0ZS5yb290LCBhdHRyaWJ1dGUua2V5cGF0aCwgdmFsdWUgKTtcblx0XHRcdFx0cnVubG9vcC50cmlnZ2VyKCk7XG5cdFx0XHRcdGF0dHJpYnV0ZS5yZWNlaXZpbmcgPSBmYWxzZTtcblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHRoaXMubm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgdXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0XHRcdHRoaXMubm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKCAnaW5wdXQnLCB1cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHRcdFx0dGhpcy5ub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdrZXl1cCcsIHVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdFx0XHR0aGlzLm5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2JsdXInLCB1cGRhdGUsIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRpbmhlcml0UHJvcGVydGllcyA9IGZ1bmN0aW9uKCBiaW5kaW5nLCBhdHRyaWJ1dGUsIG5vZGUgKSB7XG5cdFx0XHRiaW5kaW5nLmF0dHIgPSBhdHRyaWJ1dGU7XG5cdFx0XHRiaW5kaW5nLm5vZGUgPSBub2RlO1xuXHRcdFx0YmluZGluZy5yb290ID0gYXR0cmlidXRlLnJvb3Q7XG5cdFx0XHRiaW5kaW5nLmtleXBhdGggPSBhdHRyaWJ1dGUua2V5cGF0aDtcblx0XHR9O1xuXHRcdHJldHVybiBiaW5kQXR0cmlidXRlO1xuXHR9KCBnbG9iYWxfcnVubG9vcCwgdXRpbHNfd2FybiwgdXRpbHNfYXJyYXlDb250ZW50c01hdGNoLCBzaGFyZWRfZ2V0VmFsdWVGcm9tQ2hlY2tib3hlcywgc2hhcmVkX2dldF9fZ2V0LCBzaGFyZWRfc2V0ICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9BdHRyaWJ1dGVfcHJvdG90eXBlX3VwZGF0ZSA9IGZ1bmN0aW9uKCBydW5sb29wLCBuYW1lc3BhY2VzLCBpc0FycmF5ICkge1xuXG5cdFx0dmFyIHVwZGF0ZUF0dHJpYnV0ZSwgdXBkYXRlRmlsZUlucHV0VmFsdWUsIGRlZmVyU2VsZWN0LCBpbml0U2VsZWN0LCB1cGRhdGVTZWxlY3QsIHVwZGF0ZU11bHRpcGxlU2VsZWN0LCB1cGRhdGVSYWRpb05hbWUsIHVwZGF0ZUNoZWNrYm94TmFtZSwgdXBkYXRlSUVTdHlsZUF0dHJpYnV0ZSwgdXBkYXRlQ2xhc3NOYW1lLCB1cGRhdGVDb250ZW50RWRpdGFibGVWYWx1ZSwgdXBkYXRlRXZlcnl0aGluZ0Vsc2U7XG5cdFx0dXBkYXRlQXR0cmlidXRlID0gZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbm9kZTtcblx0XHRcdGlmICggIXRoaXMucmVhZHkgKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzO1xuXHRcdFx0fVxuXHRcdFx0bm9kZSA9IHRoaXMucE5vZGU7XG5cdFx0XHRpZiAoIG5vZGUudGFnTmFtZSA9PT0gJ1NFTEVDVCcgJiYgdGhpcy5sY05hbWUgPT09ICd2YWx1ZScgKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlID0gZGVmZXJTZWxlY3Q7XG5cdFx0XHRcdHRoaXMuZGVmZXJyZWRVcGRhdGUgPSBpbml0U2VsZWN0O1xuXHRcdFx0XHRyZXR1cm4gdGhpcy51cGRhdGUoKTtcblx0XHRcdH1cblx0XHRcdGlmICggdGhpcy5pc0ZpbGVJbnB1dFZhbHVlICkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZSA9IHVwZGF0ZUZpbGVJbnB1dFZhbHVlO1xuXHRcdFx0XHRyZXR1cm4gdGhpcztcblx0XHRcdH1cblx0XHRcdGlmICggdGhpcy50d293YXkgJiYgdGhpcy5sY05hbWUgPT09ICduYW1lJyApIHtcblx0XHRcdFx0aWYgKCBub2RlLnR5cGUgPT09ICdyYWRpbycgKSB7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGUgPSB1cGRhdGVSYWRpb05hbWU7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMudXBkYXRlKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBub2RlLnR5cGUgPT09ICdjaGVja2JveCcgKSB7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGUgPSB1cGRhdGVDaGVja2JveE5hbWU7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMudXBkYXRlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICggdGhpcy5sY05hbWUgPT09ICdzdHlsZScgJiYgbm9kZS5zdHlsZS5zZXRBdHRyaWJ1dGUgKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlID0gdXBkYXRlSUVTdHlsZUF0dHJpYnV0ZTtcblx0XHRcdFx0cmV0dXJuIHRoaXMudXBkYXRlKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRoaXMubGNOYW1lID09PSAnY2xhc3MnICYmICggIW5vZGUubmFtZXNwYWNlVVJJIHx8IG5vZGUubmFtZXNwYWNlVVJJID09PSBuYW1lc3BhY2VzLmh0bWwgKSApIHtcblx0XHRcdFx0dGhpcy51cGRhdGUgPSB1cGRhdGVDbGFzc05hbWU7XG5cdFx0XHRcdHJldHVybiB0aGlzLnVwZGF0ZSgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBub2RlLmdldEF0dHJpYnV0ZSggJ2NvbnRlbnRlZGl0YWJsZScgKSAmJiB0aGlzLmxjTmFtZSA9PT0gJ3ZhbHVlJyApIHtcblx0XHRcdFx0dGhpcy51cGRhdGUgPSB1cGRhdGVDb250ZW50RWRpdGFibGVWYWx1ZTtcblx0XHRcdFx0cmV0dXJuIHRoaXMudXBkYXRlKCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnVwZGF0ZSA9IHVwZGF0ZUV2ZXJ5dGhpbmdFbHNlO1xuXHRcdFx0cmV0dXJuIHRoaXMudXBkYXRlKCk7XG5cdFx0fTtcblx0XHR1cGRhdGVGaWxlSW5wdXRWYWx1ZSA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fTtcblx0XHRpbml0U2VsZWN0ID0gZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLmRlZmVycmVkVXBkYXRlID0gdGhpcy5wTm9kZS5tdWx0aXBsZSA/IHVwZGF0ZU11bHRpcGxlU2VsZWN0IDogdXBkYXRlU2VsZWN0O1xuXHRcdFx0dGhpcy5kZWZlcnJlZFVwZGF0ZSgpO1xuXHRcdH07XG5cdFx0ZGVmZXJTZWxlY3QgPSBmdW5jdGlvbigpIHtcblx0XHRcdHJ1bmxvb3AuYWRkU2VsZWN0VmFsdWUoIHRoaXMgKTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH07XG5cdFx0dXBkYXRlU2VsZWN0ID0gZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgdmFsdWUgPSB0aGlzLmZyYWdtZW50LmdldFZhbHVlKCksXG5cdFx0XHRcdG9wdGlvbnMsIG9wdGlvbiwgb3B0aW9uVmFsdWUsIGk7XG5cdFx0XHR0aGlzLnZhbHVlID0gdGhpcy5wTm9kZS5fcmFjdGl2ZS52YWx1ZSA9IHZhbHVlO1xuXHRcdFx0b3B0aW9ucyA9IHRoaXMucE5vZGUub3B0aW9ucztcblx0XHRcdGkgPSBvcHRpb25zLmxlbmd0aDtcblx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRvcHRpb24gPSBvcHRpb25zWyBpIF07XG5cdFx0XHRcdG9wdGlvblZhbHVlID0gb3B0aW9uLl9yYWN0aXZlID8gb3B0aW9uLl9yYWN0aXZlLnZhbHVlIDogb3B0aW9uLnZhbHVlO1xuXHRcdFx0XHRpZiAoIG9wdGlvblZhbHVlID09IHZhbHVlICkge1xuXHRcdFx0XHRcdG9wdGlvbi5zZWxlY3RlZCA9IHRydWU7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH07XG5cdFx0dXBkYXRlTXVsdGlwbGVTZWxlY3QgPSBmdW5jdGlvbigpIHtcblx0XHRcdHZhciB2YWx1ZSA9IHRoaXMuZnJhZ21lbnQuZ2V0VmFsdWUoKSxcblx0XHRcdFx0b3B0aW9ucywgaSwgb3B0aW9uLCBvcHRpb25WYWx1ZTtcblx0XHRcdGlmICggIWlzQXJyYXkoIHZhbHVlICkgKSB7XG5cdFx0XHRcdHZhbHVlID0gWyB2YWx1ZSBdO1xuXHRcdFx0fVxuXHRcdFx0b3B0aW9ucyA9IHRoaXMucE5vZGUub3B0aW9ucztcblx0XHRcdGkgPSBvcHRpb25zLmxlbmd0aDtcblx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRvcHRpb24gPSBvcHRpb25zWyBpIF07XG5cdFx0XHRcdG9wdGlvblZhbHVlID0gb3B0aW9uLl9yYWN0aXZlID8gb3B0aW9uLl9yYWN0aXZlLnZhbHVlIDogb3B0aW9uLnZhbHVlO1xuXHRcdFx0XHRvcHRpb24uc2VsZWN0ZWQgPSB2YWx1ZS5pbmRleE9mKCBvcHRpb25WYWx1ZSApICE9PSAtMTtcblx0XHRcdH1cblx0XHRcdHRoaXMudmFsdWUgPSB2YWx1ZTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH07XG5cdFx0dXBkYXRlUmFkaW9OYW1lID0gZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbm9kZSwgdmFsdWU7XG5cdFx0XHRub2RlID0gdGhpcy5wTm9kZTtcblx0XHRcdHZhbHVlID0gdGhpcy5mcmFnbWVudC5nZXRWYWx1ZSgpO1xuXHRcdFx0bm9kZS5jaGVja2VkID0gdmFsdWUgPT0gbm9kZS5fcmFjdGl2ZS52YWx1ZTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH07XG5cdFx0dXBkYXRlQ2hlY2tib3hOYW1lID0gZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbm9kZSwgdmFsdWU7XG5cdFx0XHRub2RlID0gdGhpcy5wTm9kZTtcblx0XHRcdHZhbHVlID0gdGhpcy5mcmFnbWVudC5nZXRWYWx1ZSgpO1xuXHRcdFx0aWYgKCAhaXNBcnJheSggdmFsdWUgKSApIHtcblx0XHRcdFx0bm9kZS5jaGVja2VkID0gdmFsdWUgPT0gbm9kZS5fcmFjdGl2ZS52YWx1ZTtcblx0XHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0XHR9XG5cdFx0XHRub2RlLmNoZWNrZWQgPSB2YWx1ZS5pbmRleE9mKCBub2RlLl9yYWN0aXZlLnZhbHVlICkgIT09IC0xO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fTtcblx0XHR1cGRhdGVJRVN0eWxlQXR0cmlidXRlID0gZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbm9kZSwgdmFsdWU7XG5cdFx0XHRub2RlID0gdGhpcy5wTm9kZTtcblx0XHRcdHZhbHVlID0gdGhpcy5mcmFnbWVudC5nZXRWYWx1ZSgpO1xuXHRcdFx0aWYgKCB2YWx1ZSA9PT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHR2YWx1ZSA9ICcnO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB2YWx1ZSAhPT0gdGhpcy52YWx1ZSApIHtcblx0XHRcdFx0bm9kZS5zdHlsZS5zZXRBdHRyaWJ1dGUoICdjc3NUZXh0JywgdmFsdWUgKTtcblx0XHRcdFx0dGhpcy52YWx1ZSA9IHZhbHVlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fTtcblx0XHR1cGRhdGVDbGFzc05hbWUgPSBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBub2RlLCB2YWx1ZTtcblx0XHRcdG5vZGUgPSB0aGlzLnBOb2RlO1xuXHRcdFx0dmFsdWUgPSB0aGlzLmZyYWdtZW50LmdldFZhbHVlKCk7XG5cdFx0XHRpZiAoIHZhbHVlID09PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdHZhbHVlID0gJyc7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHZhbHVlICE9PSB0aGlzLnZhbHVlICkge1xuXHRcdFx0XHRub2RlLmNsYXNzTmFtZSA9IHZhbHVlO1xuXHRcdFx0XHR0aGlzLnZhbHVlID0gdmFsdWU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9O1xuXHRcdHVwZGF0ZUNvbnRlbnRFZGl0YWJsZVZhbHVlID0gZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbm9kZSwgdmFsdWU7XG5cdFx0XHRub2RlID0gdGhpcy5wTm9kZTtcblx0XHRcdHZhbHVlID0gdGhpcy5mcmFnbWVudC5nZXRWYWx1ZSgpO1xuXHRcdFx0aWYgKCB2YWx1ZSA9PT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHR2YWx1ZSA9ICcnO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB2YWx1ZSAhPT0gdGhpcy52YWx1ZSApIHtcblx0XHRcdFx0aWYgKCAhdGhpcy5yZWNlaXZpbmcgKSB7XG5cdFx0XHRcdFx0bm9kZS5pbm5lckhUTUwgPSB2YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLnZhbHVlID0gdmFsdWU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9O1xuXHRcdHVwZGF0ZUV2ZXJ5dGhpbmdFbHNlID0gZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbm9kZSwgdmFsdWU7XG5cdFx0XHRub2RlID0gdGhpcy5wTm9kZTtcblx0XHRcdHZhbHVlID0gdGhpcy5mcmFnbWVudC5nZXRWYWx1ZSgpO1xuXHRcdFx0aWYgKCB0aGlzLmlzVmFsdWVBdHRyaWJ1dGUgKSB7XG5cdFx0XHRcdG5vZGUuX3JhY3RpdmUudmFsdWUgPSB2YWx1ZTtcblx0XHRcdH1cblx0XHRcdGlmICggdmFsdWUgPT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHR2YWx1ZSA9ICcnO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB2YWx1ZSAhPT0gdGhpcy52YWx1ZSApIHtcblx0XHRcdFx0aWYgKCB0aGlzLnVzZVByb3BlcnR5ICkge1xuXHRcdFx0XHRcdGlmICggIXRoaXMucmVjZWl2aW5nICkge1xuXHRcdFx0XHRcdFx0bm9kZVsgdGhpcy5wcm9wZXJ0eU5hbWUgXSA9IHZhbHVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGlzLnZhbHVlID0gdmFsdWU7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCB0aGlzLm5hbWVzcGFjZSApIHtcblx0XHRcdFx0XHRub2RlLnNldEF0dHJpYnV0ZU5TKCB0aGlzLm5hbWVzcGFjZSwgdGhpcy5uYW1lLCB2YWx1ZSApO1xuXHRcdFx0XHRcdHRoaXMudmFsdWUgPSB2YWx1ZTtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcztcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHRoaXMubGNOYW1lID09PSAnaWQnICkge1xuXHRcdFx0XHRcdGlmICggdGhpcy52YWx1ZSAhPT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRcdFx0dGhpcy5yb290Lm5vZGVzWyB0aGlzLnZhbHVlIF0gPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoaXMucm9vdC5ub2Rlc1sgdmFsdWUgXSA9IG5vZGU7XG5cdFx0XHRcdH1cblx0XHRcdFx0bm9kZS5zZXRBdHRyaWJ1dGUoIHRoaXMubmFtZSwgdmFsdWUgKTtcblx0XHRcdFx0dGhpcy52YWx1ZSA9IHZhbHVlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fTtcblx0XHRyZXR1cm4gdXBkYXRlQXR0cmlidXRlO1xuXHR9KCBnbG9iYWxfcnVubG9vcCwgY29uZmlnX25hbWVzcGFjZXMsIHV0aWxzX2lzQXJyYXkgKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX3V0aWxzX2dldFN0cmluZ01hdGNoID0gZnVuY3Rpb24oIHN0cmluZyApIHtcblx0XHR2YXIgc3Vic3RyO1xuXHRcdHN1YnN0ciA9IHRoaXMuc3RyLnN1YnN0ciggdGhpcy5wb3MsIHN0cmluZy5sZW5ndGggKTtcblx0XHRpZiAoIHN1YnN0ciA9PT0gc3RyaW5nICkge1xuXHRcdFx0dGhpcy5wb3MgKz0gc3RyaW5nLmxlbmd0aDtcblx0XHRcdHJldHVybiBzdHJpbmc7XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9O1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfdXRpbHNfYWxsb3dXaGl0ZXNwYWNlID0gZnVuY3Rpb24oKSB7XG5cblx0XHR2YXIgbGVhZGluZ1doaXRlc3BhY2UgPSAvXlxccysvO1xuXHRcdHJldHVybiBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBtYXRjaCA9IGxlYWRpbmdXaGl0ZXNwYWNlLmV4ZWMoIHRoaXMucmVtYWluaW5nKCkgKTtcblx0XHRcdGlmICggIW1hdGNoICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHRoaXMucG9zICs9IG1hdGNoWyAwIF0ubGVuZ3RoO1xuXHRcdFx0cmV0dXJuIG1hdGNoWyAwIF07XG5cdFx0fTtcblx0fSgpO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfdXRpbHNfbWFrZVJlZ2V4TWF0Y2hlciA9IGZ1bmN0aW9uKCByZWdleCApIHtcblx0XHRyZXR1cm4gZnVuY3Rpb24oIHRva2VuaXplciApIHtcblx0XHRcdHZhciBtYXRjaCA9IHJlZ2V4LmV4ZWMoIHRva2VuaXplci5zdHIuc3Vic3RyaW5nKCB0b2tlbml6ZXIucG9zICkgKTtcblx0XHRcdGlmICggIW1hdGNoICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHRva2VuaXplci5wb3MgKz0gbWF0Y2hbIDAgXS5sZW5ndGg7XG5cdFx0XHRyZXR1cm4gbWF0Y2hbIDEgXSB8fCBtYXRjaFsgMCBdO1xuXHRcdH07XG5cdH07XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfZ2V0TGl0ZXJhbF9nZXRTdHJpbmdMaXRlcmFsX21ha2VRdW90ZWRTdHJpbmdNYXRjaGVyID0gZnVuY3Rpb24oIG1ha2VSZWdleE1hdGNoZXIgKSB7XG5cblx0XHR2YXIgZ2V0U3RyaW5nTWlkZGxlLCBnZXRFc2NhcGVTZXF1ZW5jZSwgZ2V0TGluZUNvbnRpbnVhdGlvbjtcblx0XHRnZXRTdHJpbmdNaWRkbGUgPSBtYWtlUmVnZXhNYXRjaGVyKCAvXig/PS4pW15cIidcXFxcXSs/KD86KD8hLil8KD89W1wiJ1xcXFxdKSkvICk7XG5cdFx0Z2V0RXNjYXBlU2VxdWVuY2UgPSBtYWtlUmVnZXhNYXRjaGVyKCAvXlxcXFwoPzpbJ1wiXFxcXGJmbnJ0XXwwKD8hWzAtOV0pfHhbMC05YS1mQS1GXXsyfXx1WzAtOWEtZkEtRl17NH18KD89LilbXnV4MC05XSkvICk7XG5cdFx0Z2V0TGluZUNvbnRpbnVhdGlvbiA9IG1ha2VSZWdleE1hdGNoZXIoIC9eXFxcXCg/OlxcclxcbnxbXFx1MDAwQVxcdTAwMERcXHUyMDI4XFx1MjAyOV0pLyApO1xuXHRcdHJldHVybiBmdW5jdGlvbiggcXVvdGUsIG9rUXVvdGUgKSB7XG5cdFx0XHRyZXR1cm4gZnVuY3Rpb24oIHRva2VuaXplciApIHtcblx0XHRcdFx0dmFyIHN0YXJ0LCBsaXRlcmFsLCBkb25lLCBuZXh0O1xuXHRcdFx0XHRzdGFydCA9IHRva2VuaXplci5wb3M7XG5cdFx0XHRcdGxpdGVyYWwgPSAnXCInO1xuXHRcdFx0XHRkb25lID0gZmFsc2U7XG5cdFx0XHRcdHdoaWxlICggIWRvbmUgKSB7XG5cdFx0XHRcdFx0bmV4dCA9IGdldFN0cmluZ01pZGRsZSggdG9rZW5pemVyICkgfHwgZ2V0RXNjYXBlU2VxdWVuY2UoIHRva2VuaXplciApIHx8IHRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggb2tRdW90ZSApO1xuXHRcdFx0XHRcdGlmICggbmV4dCApIHtcblx0XHRcdFx0XHRcdGlmICggbmV4dCA9PT0gJ1wiJyApIHtcblx0XHRcdFx0XHRcdFx0bGl0ZXJhbCArPSAnXFxcXFwiJztcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoIG5leHQgPT09ICdcXFxcXFwnJyApIHtcblx0XHRcdFx0XHRcdFx0bGl0ZXJhbCArPSAnXFwnJztcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGxpdGVyYWwgKz0gbmV4dDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0bmV4dCA9IGdldExpbmVDb250aW51YXRpb24oIHRva2VuaXplciApO1xuXHRcdFx0XHRcdFx0aWYgKCBuZXh0ICkge1xuXHRcdFx0XHRcdFx0XHRsaXRlcmFsICs9ICdcXFxcdScgKyAoICcwMDAnICsgbmV4dC5jaGFyQ29kZUF0KCAxICkudG9TdHJpbmcoIDE2ICkgKS5zbGljZSggLTQgKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGRvbmUgPSB0cnVlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRsaXRlcmFsICs9ICdcIic7XG5cdFx0XHRcdHJldHVybiBKU09OLnBhcnNlKCBsaXRlcmFsICk7XG5cdFx0XHR9O1xuXHRcdH07XG5cdH0oIHBhcnNlX1Rva2VuaXplcl91dGlsc19tYWtlUmVnZXhNYXRjaGVyICk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfZ2V0TGl0ZXJhbF9nZXRTdHJpbmdMaXRlcmFsX2dldFNpbmdsZVF1b3RlZFN0cmluZyA9IGZ1bmN0aW9uKCBtYWtlUXVvdGVkU3RyaW5nTWF0Y2hlciApIHtcblxuXHRcdHJldHVybiBtYWtlUXVvdGVkU3RyaW5nTWF0Y2hlciggJ1xcJycsICdcIicgKTtcblx0fSggcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9nZXRMaXRlcmFsX2dldFN0cmluZ0xpdGVyYWxfbWFrZVF1b3RlZFN0cmluZ01hdGNoZXIgKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9nZXRMaXRlcmFsX2dldFN0cmluZ0xpdGVyYWxfZ2V0RG91YmxlUXVvdGVkU3RyaW5nID0gZnVuY3Rpb24oIG1ha2VRdW90ZWRTdHJpbmdNYXRjaGVyICkge1xuXG5cdFx0cmV0dXJuIG1ha2VRdW90ZWRTdHJpbmdNYXRjaGVyKCAnXCInLCAnXFwnJyApO1xuXHR9KCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X2dldExpdGVyYWxfZ2V0U3RyaW5nTGl0ZXJhbF9tYWtlUXVvdGVkU3RyaW5nTWF0Y2hlciApO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X2dldExpdGVyYWxfZ2V0U3RyaW5nTGl0ZXJhbF9fZ2V0U3RyaW5nTGl0ZXJhbCA9IGZ1bmN0aW9uKCB0eXBlcywgZ2V0U2luZ2xlUXVvdGVkU3RyaW5nLCBnZXREb3VibGVRdW90ZWRTdHJpbmcgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHRva2VuaXplciApIHtcblx0XHRcdHZhciBzdGFydCwgc3RyaW5nO1xuXHRcdFx0c3RhcnQgPSB0b2tlbml6ZXIucG9zO1xuXHRcdFx0aWYgKCB0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICdcIicgKSApIHtcblx0XHRcdFx0c3RyaW5nID0gZ2V0RG91YmxlUXVvdGVkU3RyaW5nKCB0b2tlbml6ZXIgKTtcblx0XHRcdFx0aWYgKCAhdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnXCInICkgKSB7XG5cdFx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0dDogdHlwZXMuU1RSSU5HX0xJVEVSQUwsXG5cdFx0XHRcdFx0djogc3RyaW5nXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJ1xcJycgKSApIHtcblx0XHRcdFx0c3RyaW5nID0gZ2V0U2luZ2xlUXVvdGVkU3RyaW5nKCB0b2tlbml6ZXIgKTtcblx0XHRcdFx0aWYgKCAhdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnXFwnJyApICkge1xuXHRcdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHQ6IHR5cGVzLlNUUklOR19MSVRFUkFMLFxuXHRcdFx0XHRcdHY6IHN0cmluZ1xuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fTtcblx0fSggY29uZmlnX3R5cGVzLCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X2dldExpdGVyYWxfZ2V0U3RyaW5nTGl0ZXJhbF9nZXRTaW5nbGVRdW90ZWRTdHJpbmcsIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfZ2V0TGl0ZXJhbF9nZXRTdHJpbmdMaXRlcmFsX2dldERvdWJsZVF1b3RlZFN0cmluZyApO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X2dldExpdGVyYWxfZ2V0TnVtYmVyTGl0ZXJhbCA9IGZ1bmN0aW9uKCB0eXBlcywgbWFrZVJlZ2V4TWF0Y2hlciApIHtcblxuXHRcdHZhciBnZXROdW1iZXIgPSBtYWtlUmVnZXhNYXRjaGVyKCAvXig/OlsrLV0/KSg/Oig/Oig/OjB8WzEtOV1cXGQqKT9cXC5cXGQrKXwoPzooPzowfFsxLTldXFxkKilcXC4pfCg/OjB8WzEtOV1cXGQqKSkoPzpbZUVdWystXT9cXGQrKT8vICk7XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB0b2tlbml6ZXIgKSB7XG5cdFx0XHR2YXIgcmVzdWx0O1xuXHRcdFx0aWYgKCByZXN1bHQgPSBnZXROdW1iZXIoIHRva2VuaXplciApICkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHQ6IHR5cGVzLk5VTUJFUl9MSVRFUkFMLFxuXHRcdFx0XHRcdHY6IHJlc3VsdFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fTtcblx0fSggY29uZmlnX3R5cGVzLCBwYXJzZV9Ub2tlbml6ZXJfdXRpbHNfbWFrZVJlZ2V4TWF0Y2hlciApO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9zaGFyZWRfZ2V0TmFtZSA9IGZ1bmN0aW9uKCBtYWtlUmVnZXhNYXRjaGVyICkge1xuXG5cdFx0cmV0dXJuIG1ha2VSZWdleE1hdGNoZXIoIC9eW2EtekEtWl8kXVthLXpBLVpfJDAtOV0qLyApO1xuXHR9KCBwYXJzZV9Ub2tlbml6ZXJfdXRpbHNfbWFrZVJlZ2V4TWF0Y2hlciApO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9zaGFyZWRfZ2V0S2V5ID0gZnVuY3Rpb24oIGdldFN0cmluZ0xpdGVyYWwsIGdldE51bWJlckxpdGVyYWwsIGdldE5hbWUgKSB7XG5cblx0XHR2YXIgaWRlbnRpZmllciA9IC9eW2EtekEtWl8kXVthLXpBLVpfJDAtOV0qJC87XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB0b2tlbml6ZXIgKSB7XG5cdFx0XHR2YXIgdG9rZW47XG5cdFx0XHRpZiAoIHRva2VuID0gZ2V0U3RyaW5nTGl0ZXJhbCggdG9rZW5pemVyICkgKSB7XG5cdFx0XHRcdHJldHVybiBpZGVudGlmaWVyLnRlc3QoIHRva2VuLnYgKSA/IHRva2VuLnYgOiAnXCInICsgdG9rZW4udi5yZXBsYWNlKCAvXCIvZywgJ1xcXFxcIicgKSArICdcIic7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRva2VuID0gZ2V0TnVtYmVyTGl0ZXJhbCggdG9rZW5pemVyICkgKSB7XG5cdFx0XHRcdHJldHVybiB0b2tlbi52O1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0b2tlbiA9IGdldE5hbWUoIHRva2VuaXplciApICkge1xuXHRcdFx0XHRyZXR1cm4gdG9rZW47XG5cdFx0XHR9XG5cdFx0fTtcblx0fSggcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9nZXRMaXRlcmFsX2dldFN0cmluZ0xpdGVyYWxfX2dldFN0cmluZ0xpdGVyYWwsIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfZ2V0TGl0ZXJhbF9nZXROdW1iZXJMaXRlcmFsLCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9zaGFyZWRfZ2V0TmFtZSApO1xuXG5cdHZhciB1dGlsc19wYXJzZUpTT04gPSBmdW5jdGlvbiggZ2V0U3RyaW5nTWF0Y2gsIGFsbG93V2hpdGVzcGFjZSwgZ2V0U3RyaW5nTGl0ZXJhbCwgZ2V0S2V5ICkge1xuXG5cdFx0dmFyIFRva2VuaXplciwgc3BlY2lhbHMsIHNwZWNpYWxzUGF0dGVybiwgbnVtYmVyUGF0dGVybiwgcGxhY2Vob2xkZXJQYXR0ZXJuLCBwbGFjZWhvbGRlckF0U3RhcnRQYXR0ZXJuO1xuXHRcdHNwZWNpYWxzID0ge1xuXHRcdFx0J3RydWUnOiB0cnVlLFxuXHRcdFx0J2ZhbHNlJzogZmFsc2UsXG5cdFx0XHQndW5kZWZpbmVkJzogdW5kZWZpbmVkLFxuXHRcdFx0J251bGwnOiBudWxsXG5cdFx0fTtcblx0XHRzcGVjaWFsc1BhdHRlcm4gPSBuZXcgUmVnRXhwKCAnXig/OicgKyBPYmplY3Qua2V5cyggc3BlY2lhbHMgKS5qb2luKCAnfCcgKSArICcpJyApO1xuXHRcdG51bWJlclBhdHRlcm4gPSAvXig/OlsrLV0/KSg/Oig/Oig/OjB8WzEtOV1cXGQqKT9cXC5cXGQrKXwoPzooPzowfFsxLTldXFxkKilcXC4pfCg/OjB8WzEtOV1cXGQqKSkoPzpbZUVdWystXT9cXGQrKT8vO1xuXHRcdHBsYWNlaG9sZGVyUGF0dGVybiA9IC9cXCRcXHsoW15cXH1dKylcXH0vZztcblx0XHRwbGFjZWhvbGRlckF0U3RhcnRQYXR0ZXJuID0gL15cXCRcXHsoW15cXH1dKylcXH0vO1xuXHRcdFRva2VuaXplciA9IGZ1bmN0aW9uKCBzdHIsIHZhbHVlcyApIHtcblx0XHRcdHRoaXMuc3RyID0gc3RyO1xuXHRcdFx0dGhpcy52YWx1ZXMgPSB2YWx1ZXM7XG5cdFx0XHR0aGlzLnBvcyA9IDA7XG5cdFx0XHR0aGlzLnJlc3VsdCA9IHRoaXMuZ2V0VG9rZW4oKTtcblx0XHR9O1xuXHRcdFRva2VuaXplci5wcm90b3R5cGUgPSB7XG5cdFx0XHRyZW1haW5pbmc6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5zdHIuc3Vic3RyaW5nKCB0aGlzLnBvcyApO1xuXHRcdFx0fSxcblx0XHRcdGdldFN0cmluZ01hdGNoOiBnZXRTdHJpbmdNYXRjaCxcblx0XHRcdGdldFRva2VuOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dGhpcy5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdFx0cmV0dXJuIHRoaXMuZ2V0UGxhY2Vob2xkZXIoKSB8fCB0aGlzLmdldFNwZWNpYWwoKSB8fCB0aGlzLmdldE51bWJlcigpIHx8IHRoaXMuZ2V0U3RyaW5nKCkgfHwgdGhpcy5nZXRPYmplY3QoKSB8fCB0aGlzLmdldEFycmF5KCk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0UGxhY2Vob2xkZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgbWF0Y2g7XG5cdFx0XHRcdGlmICggIXRoaXMudmFsdWVzICkge1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggKCBtYXRjaCA9IHBsYWNlaG9sZGVyQXRTdGFydFBhdHRlcm4uZXhlYyggdGhpcy5yZW1haW5pbmcoKSApICkgJiYgdGhpcy52YWx1ZXMuaGFzT3duUHJvcGVydHkoIG1hdGNoWyAxIF0gKSApIHtcblx0XHRcdFx0XHR0aGlzLnBvcyArPSBtYXRjaFsgMCBdLmxlbmd0aDtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0djogdGhpcy52YWx1ZXNbIG1hdGNoWyAxIF0gXVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRnZXRTcGVjaWFsOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIG1hdGNoO1xuXHRcdFx0XHRpZiAoIG1hdGNoID0gc3BlY2lhbHNQYXR0ZXJuLmV4ZWMoIHRoaXMucmVtYWluaW5nKCkgKSApIHtcblx0XHRcdFx0XHR0aGlzLnBvcyArPSBtYXRjaFsgMCBdLmxlbmd0aDtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0djogc3BlY2lhbHNbIG1hdGNoWyAwIF0gXVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRnZXROdW1iZXI6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgbWF0Y2g7XG5cdFx0XHRcdGlmICggbWF0Y2ggPSBudW1iZXJQYXR0ZXJuLmV4ZWMoIHRoaXMucmVtYWluaW5nKCkgKSApIHtcblx0XHRcdFx0XHR0aGlzLnBvcyArPSBtYXRjaFsgMCBdLmxlbmd0aDtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0djogK21hdGNoWyAwIF1cblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0Z2V0U3RyaW5nOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHN0cmluZ0xpdGVyYWwgPSBnZXRTdHJpbmdMaXRlcmFsKCB0aGlzICksXG5cdFx0XHRcdFx0dmFsdWVzO1xuXHRcdFx0XHRpZiAoIHN0cmluZ0xpdGVyYWwgJiYgKCB2YWx1ZXMgPSB0aGlzLnZhbHVlcyApICkge1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHR2OiBzdHJpbmdMaXRlcmFsLnYucmVwbGFjZSggcGxhY2Vob2xkZXJQYXR0ZXJuLCBmdW5jdGlvbiggbWF0Y2gsICQxICkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdmFsdWVzWyAkMSBdIHx8ICQxO1xuXHRcdFx0XHRcdFx0fSApXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gc3RyaW5nTGl0ZXJhbDtcblx0XHRcdH0sXG5cdFx0XHRnZXRPYmplY3Q6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgcmVzdWx0LCBwYWlyO1xuXHRcdFx0XHRpZiAoICF0aGlzLmdldFN0cmluZ01hdGNoKCAneycgKSApIHtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXN1bHQgPSB7fTtcblx0XHRcdFx0d2hpbGUgKCBwYWlyID0gZ2V0S2V5VmFsdWVQYWlyKCB0aGlzICkgKSB7XG5cdFx0XHRcdFx0cmVzdWx0WyBwYWlyLmtleSBdID0gcGFpci52YWx1ZTtcblx0XHRcdFx0XHR0aGlzLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0XHRcdGlmICggdGhpcy5nZXRTdHJpbmdNYXRjaCggJ30nICkgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0XHR2OiByZXN1bHRcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICggIXRoaXMuZ2V0U3RyaW5nTWF0Y2goICcsJyApICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fSxcblx0XHRcdGdldEFycmF5OiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHJlc3VsdCwgdmFsdWVUb2tlbjtcblx0XHRcdFx0aWYgKCAhdGhpcy5nZXRTdHJpbmdNYXRjaCggJ1snICkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVzdWx0ID0gW107XG5cdFx0XHRcdHdoaWxlICggdmFsdWVUb2tlbiA9IHRoaXMuZ2V0VG9rZW4oKSApIHtcblx0XHRcdFx0XHRyZXN1bHQucHVzaCggdmFsdWVUb2tlbi52ICk7XG5cdFx0XHRcdFx0aWYgKCB0aGlzLmdldFN0cmluZ01hdGNoKCAnXScgKSApIHtcblx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdHY6IHJlc3VsdFxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCAhdGhpcy5nZXRTdHJpbmdNYXRjaCggJywnICkgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9LFxuXHRcdFx0YWxsb3dXaGl0ZXNwYWNlOiBhbGxvd1doaXRlc3BhY2Vcblx0XHR9O1xuXG5cdFx0ZnVuY3Rpb24gZ2V0S2V5VmFsdWVQYWlyKCB0b2tlbml6ZXIgKSB7XG5cdFx0XHR2YXIga2V5LCB2YWx1ZVRva2VuLCBwYWlyO1xuXHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0a2V5ID0gZ2V0S2V5KCB0b2tlbml6ZXIgKTtcblx0XHRcdGlmICggIWtleSApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRwYWlyID0ge1xuXHRcdFx0XHRrZXk6IGtleVxuXHRcdFx0fTtcblx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdGlmICggIXRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJzonICkgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0dmFsdWVUb2tlbiA9IHRva2VuaXplci5nZXRUb2tlbigpO1xuXHRcdFx0aWYgKCAhdmFsdWVUb2tlbiApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRwYWlyLnZhbHVlID0gdmFsdWVUb2tlbi52O1xuXHRcdFx0cmV0dXJuIHBhaXI7XG5cdFx0fVxuXHRcdHJldHVybiBmdW5jdGlvbiggc3RyLCB2YWx1ZXMgKSB7XG5cdFx0XHR2YXIgdG9rZW5pemVyID0gbmV3IFRva2VuaXplciggc3RyLCB2YWx1ZXMgKTtcblx0XHRcdGlmICggdG9rZW5pemVyLnJlc3VsdCApIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHR2YWx1ZTogdG9rZW5pemVyLnJlc3VsdC52LFxuXHRcdFx0XHRcdHJlbWFpbmluZzogdG9rZW5pemVyLnJlbWFpbmluZygpXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9O1xuXHR9KCBwYXJzZV9Ub2tlbml6ZXJfdXRpbHNfZ2V0U3RyaW5nTWF0Y2gsIHBhcnNlX1Rva2VuaXplcl91dGlsc19hbGxvd1doaXRlc3BhY2UsIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfZ2V0TGl0ZXJhbF9nZXRTdHJpbmdMaXRlcmFsX19nZXRTdHJpbmdMaXRlcmFsLCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9zaGFyZWRfZ2V0S2V5ICk7XG5cblx0dmFyIHJlbmRlcl9TdHJpbmdGcmFnbWVudF9JbnRlcnBvbGF0b3IgPSBmdW5jdGlvbiggdHlwZXMsIHRlYXJkb3duLCBpbml0TXVzdGFjaGUsIHVwZGF0ZU11c3RhY2hlLCByZXNvbHZlTXVzdGFjaGUgKSB7XG5cblx0XHR2YXIgU3RyaW5nSW50ZXJwb2xhdG9yID0gZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHR0aGlzLnR5cGUgPSB0eXBlcy5JTlRFUlBPTEFUT1I7XG5cdFx0XHRpbml0TXVzdGFjaGUoIHRoaXMsIG9wdGlvbnMgKTtcblx0XHR9O1xuXHRcdFN0cmluZ0ludGVycG9sYXRvci5wcm90b3R5cGUgPSB7XG5cdFx0XHR1cGRhdGU6IHVwZGF0ZU11c3RhY2hlLFxuXHRcdFx0cmVzb2x2ZTogcmVzb2x2ZU11c3RhY2hlLFxuXHRcdFx0cmVuZGVyOiBmdW5jdGlvbiggdmFsdWUgKSB7XG5cdFx0XHRcdHRoaXMudmFsdWUgPSB2YWx1ZTtcblx0XHRcdFx0dGhpcy5wYXJlbnRGcmFnbWVudC5idWJibGUoKTtcblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHRlYXJkb3duKCB0aGlzICk7XG5cdFx0XHR9LFxuXHRcdFx0dG9TdHJpbmc6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZiAoIHRoaXMudmFsdWUgPT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRcdHJldHVybiAnJztcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gc3RyaW5naWZ5KCB0aGlzLnZhbHVlICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gU3RyaW5nSW50ZXJwb2xhdG9yO1xuXG5cdFx0ZnVuY3Rpb24gc3RyaW5naWZ5KCB2YWx1ZSApIHtcblx0XHRcdGlmICggdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KCB2YWx1ZSApO1xuXHRcdH1cblx0fSggY29uZmlnX3R5cGVzLCBzaGFyZWRfdGVhcmRvd24sIHJlbmRlcl9zaGFyZWRfaW5pdE11c3RhY2hlLCByZW5kZXJfc2hhcmVkX3VwZGF0ZU11c3RhY2hlLCByZW5kZXJfc2hhcmVkX3Jlc29sdmVNdXN0YWNoZSApO1xuXG5cdHZhciByZW5kZXJfU3RyaW5nRnJhZ21lbnRfU2VjdGlvbiA9IGZ1bmN0aW9uKCB0eXBlcywgaW5pdE11c3RhY2hlLCB1cGRhdGVNdXN0YWNoZSwgcmVzb2x2ZU11c3RhY2hlLCB1cGRhdGVTZWN0aW9uLCB0ZWFyZG93biwgY2lyY3VsYXIgKSB7XG5cblx0XHR2YXIgU3RyaW5nU2VjdGlvbiwgU3RyaW5nRnJhZ21lbnQ7XG5cdFx0Y2lyY3VsYXIucHVzaCggZnVuY3Rpb24oKSB7XG5cdFx0XHRTdHJpbmdGcmFnbWVudCA9IGNpcmN1bGFyLlN0cmluZ0ZyYWdtZW50O1xuXHRcdH0gKTtcblx0XHRTdHJpbmdTZWN0aW9uID0gZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHR0aGlzLnR5cGUgPSB0eXBlcy5TRUNUSU9OO1xuXHRcdFx0dGhpcy5mcmFnbWVudHMgPSBbXTtcblx0XHRcdHRoaXMubGVuZ3RoID0gMDtcblx0XHRcdGluaXRNdXN0YWNoZSggdGhpcywgb3B0aW9ucyApO1xuXHRcdH07XG5cdFx0U3RyaW5nU2VjdGlvbi5wcm90b3R5cGUgPSB7XG5cdFx0XHR1cGRhdGU6IHVwZGF0ZU11c3RhY2hlLFxuXHRcdFx0cmVzb2x2ZTogcmVzb2x2ZU11c3RhY2hlLFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR0aGlzLnRlYXJkb3duRnJhZ21lbnRzKCk7XG5cdFx0XHRcdHRlYXJkb3duKCB0aGlzICk7XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd25GcmFnbWVudHM6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR3aGlsZSAoIHRoaXMuZnJhZ21lbnRzLmxlbmd0aCApIHtcblx0XHRcdFx0XHR0aGlzLmZyYWdtZW50cy5zaGlmdCgpLnRlYXJkb3duKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5sZW5ndGggPSAwO1xuXHRcdFx0fSxcblx0XHRcdGJ1YmJsZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHRoaXMudmFsdWUgPSB0aGlzLmZyYWdtZW50cy5qb2luKCAnJyApO1xuXHRcdFx0XHR0aGlzLnBhcmVudEZyYWdtZW50LmJ1YmJsZSgpO1xuXHRcdFx0fSxcblx0XHRcdHJlbmRlcjogZnVuY3Rpb24oIHZhbHVlICkge1xuXHRcdFx0XHR2YXIgd3JhcHBlZDtcblx0XHRcdFx0aWYgKCB3cmFwcGVkID0gdGhpcy5yb290Ll93cmFwcGVkWyB0aGlzLmtleXBhdGggXSApIHtcblx0XHRcdFx0XHR2YWx1ZSA9IHdyYXBwZWQuZ2V0KCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dXBkYXRlU2VjdGlvbiggdGhpcywgdmFsdWUgKTtcblx0XHRcdFx0dGhpcy5wYXJlbnRGcmFnbWVudC5idWJibGUoKTtcblx0XHRcdH0sXG5cdFx0XHRjcmVhdGVGcmFnbWVudDogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRcdHJldHVybiBuZXcgU3RyaW5nRnJhZ21lbnQoIG9wdGlvbnMgKTtcblx0XHRcdH0sXG5cdFx0XHR0b1N0cmluZzogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmZyYWdtZW50cy5qb2luKCAnJyApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIFN0cmluZ1NlY3Rpb247XG5cdH0oIGNvbmZpZ190eXBlcywgcmVuZGVyX3NoYXJlZF9pbml0TXVzdGFjaGUsIHJlbmRlcl9zaGFyZWRfdXBkYXRlTXVzdGFjaGUsIHJlbmRlcl9zaGFyZWRfcmVzb2x2ZU11c3RhY2hlLCByZW5kZXJfc2hhcmVkX3VwZGF0ZVNlY3Rpb24sIHNoYXJlZF90ZWFyZG93biwgY2lyY3VsYXIgKTtcblxuXHR2YXIgcmVuZGVyX1N0cmluZ0ZyYWdtZW50X1RleHQgPSBmdW5jdGlvbiggdHlwZXMgKSB7XG5cblx0XHR2YXIgU3RyaW5nVGV4dCA9IGZ1bmN0aW9uKCB0ZXh0ICkge1xuXHRcdFx0dGhpcy50eXBlID0gdHlwZXMuVEVYVDtcblx0XHRcdHRoaXMudGV4dCA9IHRleHQ7XG5cdFx0fTtcblx0XHRTdHJpbmdUZXh0LnByb3RvdHlwZSA9IHtcblx0XHRcdHRvU3RyaW5nOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMudGV4dDtcblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oKSB7fVxuXHRcdH07XG5cdFx0cmV0dXJuIFN0cmluZ1RleHQ7XG5cdH0oIGNvbmZpZ190eXBlcyApO1xuXG5cdHZhciByZW5kZXJfU3RyaW5nRnJhZ21lbnRfcHJvdG90eXBlX3RvQXJnc0xpc3QgPSBmdW5jdGlvbiggd2FybiwgcGFyc2VKU09OICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIHZhbHVlcywgY291bnRlciwganNvbmVzcXVlLCBndWlkLCBlcnJvck1lc3NhZ2UsIHBhcnNlZCwgcHJvY2Vzc0l0ZW1zO1xuXHRcdFx0aWYgKCAhdGhpcy5hcmdzTGlzdCB8fCB0aGlzLmRpcnR5ICkge1xuXHRcdFx0XHR2YWx1ZXMgPSB7fTtcblx0XHRcdFx0Y291bnRlciA9IDA7XG5cdFx0XHRcdGd1aWQgPSB0aGlzLnJvb3QuX2d1aWQ7XG5cdFx0XHRcdHByb2Nlc3NJdGVtcyA9IGZ1bmN0aW9uKCBpdGVtcyApIHtcblx0XHRcdFx0XHRyZXR1cm4gaXRlbXMubWFwKCBmdW5jdGlvbiggaXRlbSApIHtcblx0XHRcdFx0XHRcdHZhciBwbGFjZWhvbGRlcklkLCB3cmFwcGVkLCB2YWx1ZTtcblx0XHRcdFx0XHRcdGlmICggaXRlbS50ZXh0ICkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gaXRlbS50ZXh0O1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKCBpdGVtLmZyYWdtZW50cyApIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGl0ZW0uZnJhZ21lbnRzLm1hcCggZnVuY3Rpb24oIGZyYWdtZW50ICkge1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybiBwcm9jZXNzSXRlbXMoIGZyYWdtZW50Lml0ZW1zICk7XG5cdFx0XHRcdFx0XHRcdH0gKS5qb2luKCAnJyApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cGxhY2Vob2xkZXJJZCA9IGd1aWQgKyAnLScgKyBjb3VudGVyKys7XG5cdFx0XHRcdFx0XHRpZiAoIHdyYXBwZWQgPSBpdGVtLnJvb3QuX3dyYXBwZWRbIGl0ZW0ua2V5cGF0aCBdICkge1xuXHRcdFx0XHRcdFx0XHR2YWx1ZSA9IHdyYXBwZWQudmFsdWU7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHR2YWx1ZSA9IGl0ZW0udmFsdWU7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR2YWx1ZXNbIHBsYWNlaG9sZGVySWQgXSA9IHZhbHVlO1xuXHRcdFx0XHRcdFx0cmV0dXJuICckeycgKyBwbGFjZWhvbGRlcklkICsgJ30nO1xuXHRcdFx0XHRcdH0gKS5qb2luKCAnJyApO1xuXHRcdFx0XHR9O1xuXHRcdFx0XHRqc29uZXNxdWUgPSBwcm9jZXNzSXRlbXMoIHRoaXMuaXRlbXMgKTtcblx0XHRcdFx0cGFyc2VkID0gcGFyc2VKU09OKCAnWycgKyBqc29uZXNxdWUgKyAnXScsIHZhbHVlcyApO1xuXHRcdFx0XHRpZiAoICFwYXJzZWQgKSB7XG5cdFx0XHRcdFx0ZXJyb3JNZXNzYWdlID0gJ0NvdWxkIG5vdCBwYXJzZSBkaXJlY3RpdmUgYXJndW1lbnRzICgnICsgdGhpcy50b1N0cmluZygpICsgJykuIElmIHlvdSB0aGluayB0aGlzIGlzIGEgYnVnLCBwbGVhc2UgZmlsZSBhbiBpc3N1ZSBhdCBodHRwOi8vZ2l0aHViLmNvbS9SYWN0aXZlSlMvUmFjdGl2ZS9pc3N1ZXMnO1xuXHRcdFx0XHRcdGlmICggdGhpcy5yb290LmRlYnVnICkge1xuXHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCBlcnJvck1lc3NhZ2UgKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0d2FybiggZXJyb3JNZXNzYWdlICk7XG5cdFx0XHRcdFx0XHR0aGlzLmFyZ3NMaXN0ID0gWyBqc29uZXNxdWUgXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5hcmdzTGlzdCA9IHBhcnNlZC52YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLmRpcnR5ID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGhpcy5hcmdzTGlzdDtcblx0XHR9O1xuXHR9KCB1dGlsc193YXJuLCB1dGlsc19wYXJzZUpTT04gKTtcblxuXHR2YXIgcmVuZGVyX1N0cmluZ0ZyYWdtZW50X19TdHJpbmdGcmFnbWVudCA9IGZ1bmN0aW9uKCB0eXBlcywgcGFyc2VKU09OLCBpbml0RnJhZ21lbnQsIEludGVycG9sYXRvciwgU2VjdGlvbiwgVGV4dCwgdG9BcmdzTGlzdCwgY2lyY3VsYXIgKSB7XG5cblx0XHR2YXIgU3RyaW5nRnJhZ21lbnQgPSBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdGluaXRGcmFnbWVudCggdGhpcywgb3B0aW9ucyApO1xuXHRcdH07XG5cdFx0U3RyaW5nRnJhZ21lbnQucHJvdG90eXBlID0ge1xuXHRcdFx0Y3JlYXRlSXRlbTogZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRcdGlmICggdHlwZW9mIG9wdGlvbnMuZGVzY3JpcHRvciA9PT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBUZXh0KCBvcHRpb25zLmRlc2NyaXB0b3IgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzd2l0Y2ggKCBvcHRpb25zLmRlc2NyaXB0b3IudCApIHtcblx0XHRcdFx0XHRjYXNlIHR5cGVzLklOVEVSUE9MQVRPUjpcblx0XHRcdFx0XHRcdHJldHVybiBuZXcgSW50ZXJwb2xhdG9yKCBvcHRpb25zICk7XG5cdFx0XHRcdFx0Y2FzZSB0eXBlcy5UUklQTEU6XG5cdFx0XHRcdFx0XHRyZXR1cm4gbmV3IEludGVycG9sYXRvciggb3B0aW9ucyApO1xuXHRcdFx0XHRcdGNhc2UgdHlwZXMuU0VDVElPTjpcblx0XHRcdFx0XHRcdHJldHVybiBuZXcgU2VjdGlvbiggb3B0aW9ucyApO1xuXHRcdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0XHR0aHJvdyAnU29tZXRoaW5nIHdlbnQgd3JvbmcgaW4gYSByYXRoZXIgaW50ZXJlc3Rpbmcgd2F5Jztcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGJ1YmJsZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHRoaXMuZGlydHkgPSB0cnVlO1xuXHRcdFx0XHR0aGlzLm93bmVyLmJ1YmJsZSgpO1xuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIG51bUl0ZW1zLCBpO1xuXHRcdFx0XHRudW1JdGVtcyA9IHRoaXMuaXRlbXMubGVuZ3RoO1xuXHRcdFx0XHRmb3IgKCBpID0gMDsgaSA8IG51bUl0ZW1zOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0dGhpcy5pdGVtc1sgaSBdLnRlYXJkb3duKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRnZXRWYWx1ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciB2YWx1ZTtcblx0XHRcdFx0aWYgKCB0aGlzLml0ZW1zLmxlbmd0aCA9PT0gMSAmJiB0aGlzLml0ZW1zWyAwIF0udHlwZSA9PT0gdHlwZXMuSU5URVJQT0xBVE9SICkge1xuXHRcdFx0XHRcdHZhbHVlID0gdGhpcy5pdGVtc1sgMCBdLnZhbHVlO1xuXHRcdFx0XHRcdGlmICggdmFsdWUgIT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRoaXMudG9TdHJpbmcoKTtcblx0XHRcdH0sXG5cdFx0XHRpc1NpbXBsZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBpLCBpdGVtLCBjb250YWluc0ludGVycG9sYXRvcjtcblx0XHRcdFx0aWYgKCB0aGlzLnNpbXBsZSAhPT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLnNpbXBsZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpID0gdGhpcy5pdGVtcy5sZW5ndGg7XG5cdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdGl0ZW0gPSB0aGlzLml0ZW1zWyBpIF07XG5cdFx0XHRcdFx0aWYgKCBpdGVtLnR5cGUgPT09IHR5cGVzLlRFWFQgKSB7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCBpdGVtLnR5cGUgPT09IHR5cGVzLklOVEVSUE9MQVRPUiApIHtcblx0XHRcdFx0XHRcdGlmICggY29udGFpbnNJbnRlcnBvbGF0b3IgKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGNvbnRhaW5zSW50ZXJwb2xhdG9yID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB0aGlzLnNpbXBsZSA9IGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0aGlzLnNpbXBsZSA9IHRydWU7XG5cdFx0XHR9LFxuXHRcdFx0dG9TdHJpbmc6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5pdGVtcy5qb2luKCAnJyApO1xuXHRcdFx0fSxcblx0XHRcdHRvSlNPTjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciB2YWx1ZSA9IHRoaXMuZ2V0VmFsdWUoKSxcblx0XHRcdFx0XHRwYXJzZWQ7XG5cdFx0XHRcdGlmICggdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0XHRwYXJzZWQgPSBwYXJzZUpTT04oIHZhbHVlICk7XG5cdFx0XHRcdFx0dmFsdWUgPSBwYXJzZWQgPyBwYXJzZWQudmFsdWUgOiB2YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0XHR9LFxuXHRcdFx0dG9BcmdzTGlzdDogdG9BcmdzTGlzdFxuXHRcdH07XG5cdFx0Y2lyY3VsYXIuU3RyaW5nRnJhZ21lbnQgPSBTdHJpbmdGcmFnbWVudDtcblx0XHRyZXR1cm4gU3RyaW5nRnJhZ21lbnQ7XG5cdH0oIGNvbmZpZ190eXBlcywgdXRpbHNfcGFyc2VKU09OLCByZW5kZXJfc2hhcmVkX2luaXRGcmFnbWVudCwgcmVuZGVyX1N0cmluZ0ZyYWdtZW50X0ludGVycG9sYXRvciwgcmVuZGVyX1N0cmluZ0ZyYWdtZW50X1NlY3Rpb24sIHJlbmRlcl9TdHJpbmdGcmFnbWVudF9UZXh0LCByZW5kZXJfU3RyaW5nRnJhZ21lbnRfcHJvdG90eXBlX3RvQXJnc0xpc3QsIGNpcmN1bGFyICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9BdHRyaWJ1dGVfX0F0dHJpYnV0ZSA9IGZ1bmN0aW9uKCBydW5sb29wLCB0eXBlcywgZGV0ZXJtaW5lTmFtZUFuZE5hbWVzcGFjZSwgc2V0U3RhdGljQXR0cmlidXRlLCBkZXRlcm1pbmVQcm9wZXJ0eU5hbWUsIGdldEludGVycG9sYXRvciwgYmluZCwgdXBkYXRlLCBTdHJpbmdGcmFnbWVudCApIHtcblxuXHRcdHZhciBEb21BdHRyaWJ1dGUgPSBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdHRoaXMudHlwZSA9IHR5cGVzLkFUVFJJQlVURTtcblx0XHRcdHRoaXMuZWxlbWVudCA9IG9wdGlvbnMuZWxlbWVudDtcblx0XHRcdGRldGVybWluZU5hbWVBbmROYW1lc3BhY2UoIHRoaXMsIG9wdGlvbnMubmFtZSApO1xuXHRcdFx0aWYgKCBvcHRpb25zLnZhbHVlID09PSBudWxsIHx8IHR5cGVvZiBvcHRpb25zLnZhbHVlID09PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0c2V0U3RhdGljQXR0cmlidXRlKCB0aGlzLCBvcHRpb25zICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMucm9vdCA9IG9wdGlvbnMucm9vdDtcblx0XHRcdHRoaXMucE5vZGUgPSBvcHRpb25zLnBOb2RlO1xuXHRcdFx0dGhpcy5wYXJlbnRGcmFnbWVudCA9IHRoaXMuZWxlbWVudC5wYXJlbnRGcmFnbWVudDtcblx0XHRcdHRoaXMuZnJhZ21lbnQgPSBuZXcgU3RyaW5nRnJhZ21lbnQoIHtcblx0XHRcdFx0ZGVzY3JpcHRvcjogb3B0aW9ucy52YWx1ZSxcblx0XHRcdFx0cm9vdDogdGhpcy5yb290LFxuXHRcdFx0XHRvd25lcjogdGhpc1xuXHRcdFx0fSApO1xuXHRcdFx0dGhpcy5pbnRlcnBvbGF0b3IgPSBnZXRJbnRlcnBvbGF0b3IoIHRoaXMgKTtcblx0XHRcdGlmICggIXRoaXMucE5vZGUgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggdGhpcy5uYW1lID09PSAndmFsdWUnICkge1xuXHRcdFx0XHR0aGlzLmlzVmFsdWVBdHRyaWJ1dGUgPSB0cnVlO1xuXHRcdFx0XHRpZiAoIHRoaXMucE5vZGUudGFnTmFtZSA9PT0gJ0lOUFVUJyAmJiB0aGlzLnBOb2RlLnR5cGUgPT09ICdmaWxlJyApIHtcblx0XHRcdFx0XHR0aGlzLmlzRmlsZUlucHV0VmFsdWUgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRkZXRlcm1pbmVQcm9wZXJ0eU5hbWUoIHRoaXMsIG9wdGlvbnMgKTtcblx0XHRcdHRoaXMuc2VsZlVwZGF0aW5nID0gdGhpcy5mcmFnbWVudC5pc1NpbXBsZSgpO1xuXHRcdFx0dGhpcy5yZWFkeSA9IHRydWU7XG5cdFx0fTtcblx0XHREb21BdHRyaWJ1dGUucHJvdG90eXBlID0ge1xuXHRcdFx0YmluZDogYmluZCxcblx0XHRcdHVwZGF0ZTogdXBkYXRlLFxuXHRcdFx0dXBkYXRlQmluZGluZ3M6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR0aGlzLmtleXBhdGggPSB0aGlzLmludGVycG9sYXRvci5rZXlwYXRoIHx8IHRoaXMuaW50ZXJwb2xhdG9yLnJlZjtcblx0XHRcdFx0aWYgKCB0aGlzLnByb3BlcnR5TmFtZSA9PT0gJ25hbWUnICkge1xuXHRcdFx0XHRcdHRoaXMucE5vZGUubmFtZSA9ICd7eycgKyB0aGlzLmtleXBhdGggKyAnfX0nO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgaTtcblx0XHRcdFx0aWYgKCB0aGlzLmJvdW5kRXZlbnRzICkge1xuXHRcdFx0XHRcdGkgPSB0aGlzLmJvdW5kRXZlbnRzLmxlbmd0aDtcblx0XHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRcdHRoaXMucE5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggdGhpcy5ib3VuZEV2ZW50c1sgaSBdLCB0aGlzLnVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHRoaXMuZnJhZ21lbnQgKSB7XG5cdFx0XHRcdFx0dGhpcy5mcmFnbWVudC50ZWFyZG93bigpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0YnViYmxlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0aWYgKCB0aGlzLnNlbGZVcGRhdGluZyApIHtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZSgpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCAhdGhpcy5kZWZlcnJlZCAmJiB0aGlzLnJlYWR5ICkge1xuXHRcdFx0XHRcdHJ1bmxvb3AuYWRkQXR0cmlidXRlKCB0aGlzICk7XG5cdFx0XHRcdFx0dGhpcy5kZWZlcnJlZCA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHR0b1N0cmluZzogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBzdHIsIGludGVycG9sYXRvcjtcblx0XHRcdFx0aWYgKCB0aGlzLnZhbHVlID09PSBudWxsICkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLm5hbWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCB0aGlzLm5hbWUgPT09ICd2YWx1ZScgJiYgdGhpcy5lbGVtZW50LmxjTmFtZSA9PT0gJ3NlbGVjdCcgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggdGhpcy5uYW1lID09PSAnbmFtZScgJiYgdGhpcy5lbGVtZW50LmxjTmFtZSA9PT0gJ2lucHV0JyAmJiAoIGludGVycG9sYXRvciA9IHRoaXMuaW50ZXJwb2xhdG9yICkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuICduYW1lPXt7JyArICggaW50ZXJwb2xhdG9yLmtleXBhdGggfHwgaW50ZXJwb2xhdG9yLnJlZiApICsgJ319Jztcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoICF0aGlzLmZyYWdtZW50ICkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLm5hbWUgKyAnPScgKyBKU09OLnN0cmluZ2lmeSggdGhpcy52YWx1ZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHN0ciA9IHRoaXMuZnJhZ21lbnQudG9TdHJpbmcoKTtcblx0XHRcdFx0cmV0dXJuIHRoaXMubmFtZSArICc9JyArIEpTT04uc3RyaW5naWZ5KCBzdHIgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBEb21BdHRyaWJ1dGU7XG5cdH0oIGdsb2JhbF9ydW5sb29wLCBjb25maWdfdHlwZXMsIHJlbmRlcl9Eb21GcmFnbWVudF9BdHRyaWJ1dGVfaGVscGVyc19kZXRlcm1pbmVOYW1lQW5kTmFtZXNwYWNlLCByZW5kZXJfRG9tRnJhZ21lbnRfQXR0cmlidXRlX2hlbHBlcnNfc2V0U3RhdGljQXR0cmlidXRlLCByZW5kZXJfRG9tRnJhZ21lbnRfQXR0cmlidXRlX2hlbHBlcnNfZGV0ZXJtaW5lUHJvcGVydHlOYW1lLCByZW5kZXJfRG9tRnJhZ21lbnRfQXR0cmlidXRlX2hlbHBlcnNfZ2V0SW50ZXJwb2xhdG9yLCByZW5kZXJfRG9tRnJhZ21lbnRfQXR0cmlidXRlX3Byb3RvdHlwZV9iaW5kLCByZW5kZXJfRG9tRnJhZ21lbnRfQXR0cmlidXRlX3Byb3RvdHlwZV91cGRhdGUsIHJlbmRlcl9TdHJpbmdGcmFnbWVudF9fU3RyaW5nRnJhZ21lbnQgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfaW5pdGlhbGlzZV9jcmVhdGVFbGVtZW50QXR0cmlidXRlcyA9IGZ1bmN0aW9uKCBEb21BdHRyaWJ1dGUgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIGVsZW1lbnQsIGF0dHJpYnV0ZXMgKSB7XG5cdFx0XHR2YXIgYXR0ck5hbWUsIGF0dHJWYWx1ZSwgYXR0cjtcblx0XHRcdGVsZW1lbnQuYXR0cmlidXRlcyA9IFtdO1xuXHRcdFx0Zm9yICggYXR0ck5hbWUgaW4gYXR0cmlidXRlcyApIHtcblx0XHRcdFx0aWYgKCBhdHRyaWJ1dGVzLmhhc093blByb3BlcnR5KCBhdHRyTmFtZSApICkge1xuXHRcdFx0XHRcdGF0dHJWYWx1ZSA9IGF0dHJpYnV0ZXNbIGF0dHJOYW1lIF07XG5cdFx0XHRcdFx0YXR0ciA9IG5ldyBEb21BdHRyaWJ1dGUoIHtcblx0XHRcdFx0XHRcdGVsZW1lbnQ6IGVsZW1lbnQsXG5cdFx0XHRcdFx0XHRuYW1lOiBhdHRyTmFtZSxcblx0XHRcdFx0XHRcdHZhbHVlOiBhdHRyVmFsdWUsXG5cdFx0XHRcdFx0XHRyb290OiBlbGVtZW50LnJvb3QsXG5cdFx0XHRcdFx0XHRwTm9kZTogZWxlbWVudC5ub2RlXG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdGVsZW1lbnQuYXR0cmlidXRlcy5wdXNoKCBlbGVtZW50LmF0dHJpYnV0ZXNbIGF0dHJOYW1lIF0gPSBhdHRyICk7XG5cdFx0XHRcdFx0aWYgKCBhdHRyTmFtZSAhPT0gJ25hbWUnICkge1xuXHRcdFx0XHRcdFx0YXR0ci51cGRhdGUoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBlbGVtZW50LmF0dHJpYnV0ZXM7XG5cdFx0fTtcblx0fSggcmVuZGVyX0RvbUZyYWdtZW50X0F0dHJpYnV0ZV9fQXR0cmlidXRlICk7XG5cblx0dmFyIHV0aWxzX3RvQXJyYXkgPSBmdW5jdGlvbiB0b0FycmF5KCBhcnJheUxpa2UgKSB7XG5cdFx0dmFyIGFycmF5ID0gW10sXG5cdFx0XHRpID0gYXJyYXlMaWtlLmxlbmd0aDtcblx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdGFycmF5WyBpIF0gPSBhcnJheUxpa2VbIGkgXTtcblx0XHR9XG5cdFx0cmV0dXJuIGFycmF5O1xuXHR9O1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZ2V0TWF0Y2hpbmdTdGF0aWNOb2RlcyA9IGZ1bmN0aW9uKCB0b0FycmF5ICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uIGdldE1hdGNoaW5nU3RhdGljTm9kZXMoIGVsZW1lbnQsIHNlbGVjdG9yICkge1xuXHRcdFx0aWYgKCAhZWxlbWVudC5tYXRjaGluZ1N0YXRpY05vZGVzWyBzZWxlY3RvciBdICkge1xuXHRcdFx0XHRlbGVtZW50Lm1hdGNoaW5nU3RhdGljTm9kZXNbIHNlbGVjdG9yIF0gPSB0b0FycmF5KCBlbGVtZW50Lm5vZGUucXVlcnlTZWxlY3RvckFsbCggc2VsZWN0b3IgKSApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGVsZW1lbnQubWF0Y2hpbmdTdGF0aWNOb2Rlc1sgc2VsZWN0b3IgXTtcblx0XHR9O1xuXHR9KCB1dGlsc190b0FycmF5ICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X2luaXRpYWxpc2VfYXBwZW5kRWxlbWVudENoaWxkcmVuID0gZnVuY3Rpb24oIHdhcm4sIG5hbWVzcGFjZXMsIFN0cmluZ0ZyYWdtZW50LCBnZXRNYXRjaGluZ1N0YXRpY05vZGVzLCBjaXJjdWxhciApIHtcblxuXHRcdHZhciBEb21GcmFnbWVudCwgdXBkYXRlQ3NzLCB1cGRhdGVTY3JpcHQ7XG5cdFx0Y2lyY3VsYXIucHVzaCggZnVuY3Rpb24oKSB7XG5cdFx0XHREb21GcmFnbWVudCA9IGNpcmN1bGFyLkRvbUZyYWdtZW50O1xuXHRcdH0gKTtcblx0XHR1cGRhdGVDc3MgPSBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBub2RlID0gdGhpcy5ub2RlLFxuXHRcdFx0XHRjb250ZW50ID0gdGhpcy5mcmFnbWVudC50b1N0cmluZygpO1xuXHRcdFx0aWYgKCBub2RlLnN0eWxlU2hlZXQgKSB7XG5cdFx0XHRcdG5vZGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY29udGVudDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG5vZGUuaW5uZXJIVE1MID0gY29udGVudDtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHVwZGF0ZVNjcmlwdCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYgKCAhdGhpcy5ub2RlLnR5cGUgfHwgdGhpcy5ub2RlLnR5cGUgPT09ICd0ZXh0L2phdmFzY3JpcHQnICkge1xuXHRcdFx0XHR3YXJuKCAnU2NyaXB0IHRhZyB3YXMgdXBkYXRlZC4gVGhpcyBkb2VzIG5vdCBjYXVzZSB0aGUgY29kZSB0byBiZSByZS1ldmFsdWF0ZWQhJyApO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5ub2RlLnRleHQgPSB0aGlzLmZyYWdtZW50LnRvU3RyaW5nKCk7XG5cdFx0fTtcblx0XHRyZXR1cm4gZnVuY3Rpb24gYXBwZW5kRWxlbWVudENoaWxkcmVuKCBlbGVtZW50LCBub2RlLCBkZXNjcmlwdG9yLCBkb2NGcmFnICkge1xuXHRcdFx0aWYgKCBlbGVtZW50LmxjTmFtZSA9PT0gJ3NjcmlwdCcgfHwgZWxlbWVudC5sY05hbWUgPT09ICdzdHlsZScgKSB7XG5cdFx0XHRcdGVsZW1lbnQuZnJhZ21lbnQgPSBuZXcgU3RyaW5nRnJhZ21lbnQoIHtcblx0XHRcdFx0XHRkZXNjcmlwdG9yOiBkZXNjcmlwdG9yLmYsXG5cdFx0XHRcdFx0cm9vdDogZWxlbWVudC5yb290LFxuXHRcdFx0XHRcdG93bmVyOiBlbGVtZW50XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0aWYgKCBkb2NGcmFnICkge1xuXHRcdFx0XHRcdGlmICggZWxlbWVudC5sY05hbWUgPT09ICdzY3JpcHQnICkge1xuXHRcdFx0XHRcdFx0ZWxlbWVudC5idWJibGUgPSB1cGRhdGVTY3JpcHQ7XG5cdFx0XHRcdFx0XHRlbGVtZW50Lm5vZGUudGV4dCA9IGVsZW1lbnQuZnJhZ21lbnQudG9TdHJpbmcoKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0ZWxlbWVudC5idWJibGUgPSB1cGRhdGVDc3M7XG5cdFx0XHRcdFx0XHRlbGVtZW50LmJ1YmJsZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHR5cGVvZiBkZXNjcmlwdG9yLmYgPT09ICdzdHJpbmcnICYmICggIW5vZGUgfHwgKCAhbm9kZS5uYW1lc3BhY2VVUkkgfHwgbm9kZS5uYW1lc3BhY2VVUkkgPT09IG5hbWVzcGFjZXMuaHRtbCApICkgKSB7XG5cdFx0XHRcdGVsZW1lbnQuaHRtbCA9IGRlc2NyaXB0b3IuZjtcblx0XHRcdFx0aWYgKCBkb2NGcmFnICkge1xuXHRcdFx0XHRcdG5vZGUuaW5uZXJIVE1MID0gZWxlbWVudC5odG1sO1xuXHRcdFx0XHRcdGVsZW1lbnQubWF0Y2hpbmdTdGF0aWNOb2RlcyA9IHt9O1xuXHRcdFx0XHRcdHVwZGF0ZUxpdmVRdWVyaWVzKCBlbGVtZW50ICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGVsZW1lbnQuZnJhZ21lbnQgPSBuZXcgRG9tRnJhZ21lbnQoIHtcblx0XHRcdFx0XHRkZXNjcmlwdG9yOiBkZXNjcmlwdG9yLmYsXG5cdFx0XHRcdFx0cm9vdDogZWxlbWVudC5yb290LFxuXHRcdFx0XHRcdHBOb2RlOiBub2RlLFxuXHRcdFx0XHRcdG93bmVyOiBlbGVtZW50LFxuXHRcdFx0XHRcdHBFbGVtZW50OiBlbGVtZW50XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0aWYgKCBkb2NGcmFnICkge1xuXHRcdFx0XHRcdG5vZGUuYXBwZW5kQ2hpbGQoIGVsZW1lbnQuZnJhZ21lbnQuZG9jRnJhZyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGZ1bmN0aW9uIHVwZGF0ZUxpdmVRdWVyaWVzKCBlbGVtZW50ICkge1xuXHRcdFx0dmFyIGluc3RhbmNlLCBsaXZlUXVlcmllcywgbm9kZSwgc2VsZWN0b3IsIHF1ZXJ5LCBtYXRjaGluZ1N0YXRpY05vZGVzLCBpO1xuXHRcdFx0bm9kZSA9IGVsZW1lbnQubm9kZTtcblx0XHRcdGluc3RhbmNlID0gZWxlbWVudC5yb290O1xuXHRcdFx0ZG8ge1xuXHRcdFx0XHRsaXZlUXVlcmllcyA9IGluc3RhbmNlLl9saXZlUXVlcmllcztcblx0XHRcdFx0aSA9IGxpdmVRdWVyaWVzLmxlbmd0aDtcblx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0c2VsZWN0b3IgPSBsaXZlUXVlcmllc1sgaSBdO1xuXHRcdFx0XHRcdHF1ZXJ5ID0gbGl2ZVF1ZXJpZXNbIHNlbGVjdG9yIF07XG5cdFx0XHRcdFx0bWF0Y2hpbmdTdGF0aWNOb2RlcyA9IGdldE1hdGNoaW5nU3RhdGljTm9kZXMoIGVsZW1lbnQsIHNlbGVjdG9yICk7XG5cdFx0XHRcdFx0cXVlcnkucHVzaC5hcHBseSggcXVlcnksIG1hdGNoaW5nU3RhdGljTm9kZXMgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSB3aGlsZSAoIGluc3RhbmNlID0gaW5zdGFuY2UuX3BhcmVudCApO1xuXHRcdH1cblx0fSggdXRpbHNfd2FybiwgY29uZmlnX25hbWVzcGFjZXMsIHJlbmRlcl9TdHJpbmdGcmFnbWVudF9fU3RyaW5nRnJhZ21lbnQsIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9nZXRNYXRjaGluZ1N0YXRpY05vZGVzLCBjaXJjdWxhciApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9pbml0aWFsaXNlX2RlY29yYXRlX0RlY29yYXRvciA9IGZ1bmN0aW9uKCB3YXJuLCBTdHJpbmdGcmFnbWVudCApIHtcblxuXHRcdHZhciBEZWNvcmF0b3IgPSBmdW5jdGlvbiggZGVzY3JpcHRvciwgcmFjdGl2ZSwgb3duZXIgKSB7XG5cdFx0XHR2YXIgZGVjb3JhdG9yID0gdGhpcyxcblx0XHRcdFx0bmFtZSwgZnJhZ21lbnQsIGVycm9yTWVzc2FnZTtcblx0XHRcdGRlY29yYXRvci5yb290ID0gcmFjdGl2ZTtcblx0XHRcdGRlY29yYXRvci5ub2RlID0gb3duZXIubm9kZTtcblx0XHRcdG5hbWUgPSBkZXNjcmlwdG9yLm4gfHwgZGVzY3JpcHRvcjtcblx0XHRcdGlmICggdHlwZW9mIG5hbWUgIT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHRmcmFnbWVudCA9IG5ldyBTdHJpbmdGcmFnbWVudCgge1xuXHRcdFx0XHRcdGRlc2NyaXB0b3I6IG5hbWUsXG5cdFx0XHRcdFx0cm9vdDogcmFjdGl2ZSxcblx0XHRcdFx0XHRvd25lcjogb3duZXJcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRuYW1lID0gZnJhZ21lbnQudG9TdHJpbmcoKTtcblx0XHRcdFx0ZnJhZ21lbnQudGVhcmRvd24oKTtcblx0XHRcdH1cblx0XHRcdGlmICggZGVzY3JpcHRvci5hICkge1xuXHRcdFx0XHRkZWNvcmF0b3IucGFyYW1zID0gZGVzY3JpcHRvci5hO1xuXHRcdFx0fSBlbHNlIGlmICggZGVzY3JpcHRvci5kICkge1xuXHRcdFx0XHRkZWNvcmF0b3IuZnJhZ21lbnQgPSBuZXcgU3RyaW5nRnJhZ21lbnQoIHtcblx0XHRcdFx0XHRkZXNjcmlwdG9yOiBkZXNjcmlwdG9yLmQsXG5cdFx0XHRcdFx0cm9vdDogcmFjdGl2ZSxcblx0XHRcdFx0XHRvd25lcjogb3duZXJcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRkZWNvcmF0b3IucGFyYW1zID0gZGVjb3JhdG9yLmZyYWdtZW50LnRvQXJnc0xpc3QoKTtcblx0XHRcdFx0ZGVjb3JhdG9yLmZyYWdtZW50LmJ1YmJsZSA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdHRoaXMuZGlydHkgPSB0cnVlO1xuXHRcdFx0XHRcdGRlY29yYXRvci5wYXJhbXMgPSB0aGlzLnRvQXJnc0xpc3QoKTtcblx0XHRcdFx0XHRpZiAoIGRlY29yYXRvci5yZWFkeSApIHtcblx0XHRcdFx0XHRcdGRlY29yYXRvci51cGRhdGUoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0XHRkZWNvcmF0b3IuZm4gPSByYWN0aXZlLmRlY29yYXRvcnNbIG5hbWUgXTtcblx0XHRcdGlmICggIWRlY29yYXRvci5mbiApIHtcblx0XHRcdFx0ZXJyb3JNZXNzYWdlID0gJ01pc3NpbmcgXCInICsgbmFtZSArICdcIiBkZWNvcmF0b3IuIFlvdSBtYXkgbmVlZCB0byBkb3dubG9hZCBhIHBsdWdpbiB2aWEgaHR0cDovL2RvY3MucmFjdGl2ZWpzLm9yZy9sYXRlc3QvcGx1Z2lucyNkZWNvcmF0b3JzJztcblx0XHRcdFx0aWYgKCByYWN0aXZlLmRlYnVnICkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggZXJyb3JNZXNzYWdlICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0d2FybiggZXJyb3JNZXNzYWdlICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHRcdERlY29yYXRvci5wcm90b3R5cGUgPSB7XG5cdFx0XHRpbml0OiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHJlc3VsdCwgYXJncztcblx0XHRcdFx0aWYgKCB0aGlzLnBhcmFtcyApIHtcblx0XHRcdFx0XHRhcmdzID0gWyB0aGlzLm5vZGUgXS5jb25jYXQoIHRoaXMucGFyYW1zICk7XG5cdFx0XHRcdFx0cmVzdWx0ID0gdGhpcy5mbi5hcHBseSggdGhpcy5yb290LCBhcmdzICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmVzdWx0ID0gdGhpcy5mbi5jYWxsKCB0aGlzLnJvb3QsIHRoaXMubm9kZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggIXJlc3VsdCB8fCAhcmVzdWx0LnRlYXJkb3duICkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ0RlY29yYXRvciBkZWZpbml0aW9uIG11c3QgcmV0dXJuIGFuIG9iamVjdCB3aXRoIGEgdGVhcmRvd24gbWV0aG9kJyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuYWN0dWFsID0gcmVzdWx0O1xuXHRcdFx0XHR0aGlzLnJlYWR5ID0gdHJ1ZTtcblx0XHRcdH0sXG5cdFx0XHR1cGRhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZiAoIHRoaXMuYWN0dWFsLnVwZGF0ZSApIHtcblx0XHRcdFx0XHR0aGlzLmFjdHVhbC51cGRhdGUuYXBwbHkoIHRoaXMucm9vdCwgdGhpcy5wYXJhbXMgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLmFjdHVhbC50ZWFyZG93biggdHJ1ZSApO1xuXHRcdFx0XHRcdHRoaXMuaW5pdCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCB1cGRhdGluZyApIHtcblx0XHRcdFx0dGhpcy5hY3R1YWwudGVhcmRvd24oKTtcblx0XHRcdFx0aWYgKCAhdXBkYXRpbmcgKSB7XG5cdFx0XHRcdFx0dGhpcy5mcmFnbWVudC50ZWFyZG93bigpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gRGVjb3JhdG9yO1xuXHR9KCB1dGlsc193YXJuLCByZW5kZXJfU3RyaW5nRnJhZ21lbnRfX1N0cmluZ0ZyYWdtZW50ICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X2luaXRpYWxpc2VfZGVjb3JhdGVfX2RlY29yYXRlID0gZnVuY3Rpb24oIHJ1bmxvb3AsIERlY29yYXRvciApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggZGVzY3JpcHRvciwgcm9vdCwgb3duZXIgKSB7XG5cdFx0XHR2YXIgZGVjb3JhdG9yID0gbmV3IERlY29yYXRvciggZGVzY3JpcHRvciwgcm9vdCwgb3duZXIgKTtcblx0XHRcdGlmICggZGVjb3JhdG9yLmZuICkge1xuXHRcdFx0XHRvd25lci5kZWNvcmF0b3IgPSBkZWNvcmF0b3I7XG5cdFx0XHRcdHJ1bmxvb3AuYWRkRGVjb3JhdG9yKCBvd25lci5kZWNvcmF0b3IgKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9KCBnbG9iYWxfcnVubG9vcCwgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfaW5pdGlhbGlzZV9kZWNvcmF0ZV9EZWNvcmF0b3IgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfaW5pdGlhbGlzZV9hZGRFdmVudFByb3hpZXNfYWRkRXZlbnRQcm94eSA9IGZ1bmN0aW9uKCB3YXJuLCBTdHJpbmdGcmFnbWVudCApIHtcblxuXHRcdHZhciBhZGRFdmVudFByb3h5LCBNYXN0ZXJFdmVudEhhbmRsZXIsIFByb3h5RXZlbnQsIGZpcmVQbGFpbkV2ZW50LCBmaXJlRXZlbnRXaXRoQXJncywgZmlyZUV2ZW50V2l0aER5bmFtaWNBcmdzLCBjdXN0b21IYW5kbGVycywgZ2VuZXJpY0hhbmRsZXIsIGdldEN1c3RvbUhhbmRsZXI7XG5cdFx0YWRkRXZlbnRQcm94eSA9IGZ1bmN0aW9uKCBlbGVtZW50LCB0cmlnZ2VyRXZlbnROYW1lLCBwcm94eURlc2NyaXB0b3IsIGluZGV4UmVmcyApIHtcblx0XHRcdHZhciBldmVudHMsIG1hc3Rlcjtcblx0XHRcdGV2ZW50cyA9IGVsZW1lbnQubm9kZS5fcmFjdGl2ZS5ldmVudHM7XG5cdFx0XHRtYXN0ZXIgPSBldmVudHNbIHRyaWdnZXJFdmVudE5hbWUgXSB8fCAoIGV2ZW50c1sgdHJpZ2dlckV2ZW50TmFtZSBdID0gbmV3IE1hc3RlckV2ZW50SGFuZGxlciggZWxlbWVudCwgdHJpZ2dlckV2ZW50TmFtZSwgaW5kZXhSZWZzICkgKTtcblx0XHRcdG1hc3Rlci5hZGQoIHByb3h5RGVzY3JpcHRvciApO1xuXHRcdH07XG5cdFx0TWFzdGVyRXZlbnRIYW5kbGVyID0gZnVuY3Rpb24oIGVsZW1lbnQsIGV2ZW50TmFtZSApIHtcblx0XHRcdHZhciBkZWZpbml0aW9uO1xuXHRcdFx0dGhpcy5lbGVtZW50ID0gZWxlbWVudDtcblx0XHRcdHRoaXMucm9vdCA9IGVsZW1lbnQucm9vdDtcblx0XHRcdHRoaXMubm9kZSA9IGVsZW1lbnQubm9kZTtcblx0XHRcdHRoaXMubmFtZSA9IGV2ZW50TmFtZTtcblx0XHRcdHRoaXMucHJveGllcyA9IFtdO1xuXHRcdFx0aWYgKCBkZWZpbml0aW9uID0gdGhpcy5yb290LmV2ZW50c1sgZXZlbnROYW1lIF0gKSB7XG5cdFx0XHRcdHRoaXMuY3VzdG9tID0gZGVmaW5pdGlvbiggdGhpcy5ub2RlLCBnZXRDdXN0b21IYW5kbGVyKCBldmVudE5hbWUgKSApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKCAhKCAnb24nICsgZXZlbnROYW1lIGluIHRoaXMubm9kZSApICkge1xuXHRcdFx0XHRcdHdhcm4oICdNaXNzaW5nIFwiJyArIHRoaXMubmFtZSArICdcIiBldmVudC4gWW91IG1heSBuZWVkIHRvIGRvd25sb2FkIGEgcGx1Z2luIHZpYSBodHRwOi8vZG9jcy5yYWN0aXZlanMub3JnL2xhdGVzdC9wbHVnaW5zI2V2ZW50cycgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLm5vZGUuYWRkRXZlbnRMaXN0ZW5lciggZXZlbnROYW1lLCBnZW5lcmljSGFuZGxlciwgZmFsc2UgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdE1hc3RlckV2ZW50SGFuZGxlci5wcm90b3R5cGUgPSB7XG5cdFx0XHRhZGQ6IGZ1bmN0aW9uKCBwcm94eSApIHtcblx0XHRcdFx0dGhpcy5wcm94aWVzLnB1c2goIG5ldyBQcm94eUV2ZW50KCB0aGlzLmVsZW1lbnQsIHRoaXMucm9vdCwgcHJveHkgKSApO1xuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIGk7XG5cdFx0XHRcdGlmICggdGhpcy5jdXN0b20gKSB7XG5cdFx0XHRcdFx0dGhpcy5jdXN0b20udGVhcmRvd24oKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLm5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggdGhpcy5uYW1lLCBnZW5lcmljSGFuZGxlciwgZmFsc2UgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpID0gdGhpcy5wcm94aWVzLmxlbmd0aDtcblx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0dGhpcy5wcm94aWVzWyBpIF0udGVhcmRvd24oKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGZpcmU6IGZ1bmN0aW9uKCBldmVudCApIHtcblx0XHRcdFx0dmFyIGkgPSB0aGlzLnByb3hpZXMubGVuZ3RoO1xuXHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHR0aGlzLnByb3hpZXNbIGkgXS5maXJlKCBldmVudCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRQcm94eUV2ZW50ID0gZnVuY3Rpb24oIGVsZW1lbnQsIHJhY3RpdmUsIGRlc2NyaXB0b3IgKSB7XG5cdFx0XHR2YXIgbmFtZTtcblx0XHRcdHRoaXMucm9vdCA9IHJhY3RpdmU7XG5cdFx0XHRuYW1lID0gZGVzY3JpcHRvci5uIHx8IGRlc2NyaXB0b3I7XG5cdFx0XHRpZiAoIHR5cGVvZiBuYW1lID09PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0dGhpcy5uID0gbmFtZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMubiA9IG5ldyBTdHJpbmdGcmFnbWVudCgge1xuXHRcdFx0XHRcdGRlc2NyaXB0b3I6IGRlc2NyaXB0b3Iubixcblx0XHRcdFx0XHRyb290OiB0aGlzLnJvb3QsXG5cdFx0XHRcdFx0b3duZXI6IGVsZW1lbnRcblx0XHRcdFx0fSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBkZXNjcmlwdG9yLmEgKSB7XG5cdFx0XHRcdHRoaXMuYSA9IGRlc2NyaXB0b3IuYTtcblx0XHRcdFx0dGhpcy5maXJlID0gZmlyZUV2ZW50V2l0aEFyZ3M7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggZGVzY3JpcHRvci5kICkge1xuXHRcdFx0XHR0aGlzLmQgPSBuZXcgU3RyaW5nRnJhZ21lbnQoIHtcblx0XHRcdFx0XHRkZXNjcmlwdG9yOiBkZXNjcmlwdG9yLmQsXG5cdFx0XHRcdFx0cm9vdDogdGhpcy5yb290LFxuXHRcdFx0XHRcdG93bmVyOiBlbGVtZW50XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0dGhpcy5maXJlID0gZmlyZUV2ZW50V2l0aER5bmFtaWNBcmdzO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmZpcmUgPSBmaXJlUGxhaW5FdmVudDtcblx0XHR9O1xuXHRcdFByb3h5RXZlbnQucHJvdG90eXBlID0ge1xuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZiAoIHRoaXMubi50ZWFyZG93biApIHtcblx0XHRcdFx0XHR0aGlzLm4udGVhcmRvd24oKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHRoaXMuZCApIHtcblx0XHRcdFx0XHR0aGlzLmQudGVhcmRvd24oKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGJ1YmJsZTogZnVuY3Rpb24oKSB7fVxuXHRcdH07XG5cdFx0ZmlyZVBsYWluRXZlbnQgPSBmdW5jdGlvbiggZXZlbnQgKSB7XG5cdFx0XHR0aGlzLnJvb3QuZmlyZSggdGhpcy5uLnRvU3RyaW5nKCksIGV2ZW50ICk7XG5cdFx0fTtcblx0XHRmaXJlRXZlbnRXaXRoQXJncyA9IGZ1bmN0aW9uKCBldmVudCApIHtcblx0XHRcdHRoaXMucm9vdC5maXJlLmFwcGx5KCB0aGlzLnJvb3QsIFtcblx0XHRcdFx0dGhpcy5uLnRvU3RyaW5nKCksXG5cdFx0XHRcdGV2ZW50XG5cdFx0XHRdLmNvbmNhdCggdGhpcy5hICkgKTtcblx0XHR9O1xuXHRcdGZpcmVFdmVudFdpdGhEeW5hbWljQXJncyA9IGZ1bmN0aW9uKCBldmVudCApIHtcblx0XHRcdHZhciBhcmdzID0gdGhpcy5kLnRvQXJnc0xpc3QoKTtcblx0XHRcdGlmICggdHlwZW9mIGFyZ3MgPT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHRhcmdzID0gYXJncy5zdWJzdHIoIDEsIGFyZ3MubGVuZ3RoIC0gMiApO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5yb290LmZpcmUuYXBwbHkoIHRoaXMucm9vdCwgW1xuXHRcdFx0XHR0aGlzLm4udG9TdHJpbmcoKSxcblx0XHRcdFx0ZXZlbnRcblx0XHRcdF0uY29uY2F0KCBhcmdzICkgKTtcblx0XHR9O1xuXHRcdGdlbmVyaWNIYW5kbGVyID0gZnVuY3Rpb24oIGV2ZW50ICkge1xuXHRcdFx0dmFyIHN0b3JhZ2UgPSB0aGlzLl9yYWN0aXZlO1xuXHRcdFx0c3RvcmFnZS5ldmVudHNbIGV2ZW50LnR5cGUgXS5maXJlKCB7XG5cdFx0XHRcdG5vZGU6IHRoaXMsXG5cdFx0XHRcdG9yaWdpbmFsOiBldmVudCxcblx0XHRcdFx0aW5kZXg6IHN0b3JhZ2UuaW5kZXgsXG5cdFx0XHRcdGtleXBhdGg6IHN0b3JhZ2Uua2V5cGF0aCxcblx0XHRcdFx0Y29udGV4dDogc3RvcmFnZS5yb290LmdldCggc3RvcmFnZS5rZXlwYXRoIClcblx0XHRcdH0gKTtcblx0XHR9O1xuXHRcdGN1c3RvbUhhbmRsZXJzID0ge307XG5cdFx0Z2V0Q3VzdG9tSGFuZGxlciA9IGZ1bmN0aW9uKCBldmVudE5hbWUgKSB7XG5cdFx0XHRpZiAoIGN1c3RvbUhhbmRsZXJzWyBldmVudE5hbWUgXSApIHtcblx0XHRcdFx0cmV0dXJuIGN1c3RvbUhhbmRsZXJzWyBldmVudE5hbWUgXTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBjdXN0b21IYW5kbGVyc1sgZXZlbnROYW1lIF0gPSBmdW5jdGlvbiggZXZlbnQgKSB7XG5cdFx0XHRcdHZhciBzdG9yYWdlID0gZXZlbnQubm9kZS5fcmFjdGl2ZTtcblx0XHRcdFx0ZXZlbnQuaW5kZXggPSBzdG9yYWdlLmluZGV4O1xuXHRcdFx0XHRldmVudC5rZXlwYXRoID0gc3RvcmFnZS5rZXlwYXRoO1xuXHRcdFx0XHRldmVudC5jb250ZXh0ID0gc3RvcmFnZS5yb290LmdldCggc3RvcmFnZS5rZXlwYXRoICk7XG5cdFx0XHRcdHN0b3JhZ2UuZXZlbnRzWyBldmVudE5hbWUgXS5maXJlKCBldmVudCApO1xuXHRcdFx0fTtcblx0XHR9O1xuXHRcdHJldHVybiBhZGRFdmVudFByb3h5O1xuXHR9KCB1dGlsc193YXJuLCByZW5kZXJfU3RyaW5nRnJhZ21lbnRfX1N0cmluZ0ZyYWdtZW50ICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X2luaXRpYWxpc2VfYWRkRXZlbnRQcm94aWVzX19hZGRFdmVudFByb3hpZXMgPSBmdW5jdGlvbiggYWRkRXZlbnRQcm94eSApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggZWxlbWVudCwgcHJveGllcyApIHtcblx0XHRcdHZhciBpLCBldmVudE5hbWUsIGV2ZW50TmFtZXM7XG5cdFx0XHRmb3IgKCBldmVudE5hbWUgaW4gcHJveGllcyApIHtcblx0XHRcdFx0aWYgKCBwcm94aWVzLmhhc093blByb3BlcnR5KCBldmVudE5hbWUgKSApIHtcblx0XHRcdFx0XHRldmVudE5hbWVzID0gZXZlbnROYW1lLnNwbGl0KCAnLScgKTtcblx0XHRcdFx0XHRpID0gZXZlbnROYW1lcy5sZW5ndGg7XG5cdFx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0XHRhZGRFdmVudFByb3h5KCBlbGVtZW50LCBldmVudE5hbWVzWyBpIF0sIHByb3hpZXNbIGV2ZW50TmFtZSBdICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0fSggcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfaW5pdGlhbGlzZV9hZGRFdmVudFByb3hpZXNfYWRkRXZlbnRQcm94eSApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9pbml0aWFsaXNlX3VwZGF0ZUxpdmVRdWVyaWVzID0gZnVuY3Rpb24oIGVsZW1lbnQgKSB7XG5cdFx0dmFyIGluc3RhbmNlLCBsaXZlUXVlcmllcywgaSwgc2VsZWN0b3IsIHF1ZXJ5O1xuXHRcdGluc3RhbmNlID0gZWxlbWVudC5yb290O1xuXHRcdGRvIHtcblx0XHRcdGxpdmVRdWVyaWVzID0gaW5zdGFuY2UuX2xpdmVRdWVyaWVzO1xuXHRcdFx0aSA9IGxpdmVRdWVyaWVzLmxlbmd0aDtcblx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRzZWxlY3RvciA9IGxpdmVRdWVyaWVzWyBpIF07XG5cdFx0XHRcdHF1ZXJ5ID0gbGl2ZVF1ZXJpZXNbIHNlbGVjdG9yIF07XG5cdFx0XHRcdGlmICggcXVlcnkuX3Rlc3QoIGVsZW1lbnQgKSApIHtcblx0XHRcdFx0XHQoIGVsZW1lbnQubGl2ZVF1ZXJpZXMgfHwgKCBlbGVtZW50LmxpdmVRdWVyaWVzID0gW10gKSApLnB1c2goIHF1ZXJ5ICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IHdoaWxlICggaW5zdGFuY2UgPSBpbnN0YW5jZS5fcGFyZW50ICk7XG5cdH07XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9leGVjdXRlVHJhbnNpdGlvbl9UcmFuc2l0aW9uX3Byb3RvdHlwZV9pbml0ID0gZnVuY3Rpb24oKSB7XG5cdFx0aWYgKCB0aGlzLl9pbml0ZWQgKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdDYW5ub3QgaW5pdGlhbGl6ZSBhIHRyYW5zaXRpb24gbW9yZSB0aGFuIG9uY2UnICk7XG5cdFx0fVxuXHRcdHRoaXMuX2luaXRlZCA9IHRydWU7XG5cdFx0dGhpcy5fZm4uYXBwbHkoIHRoaXMucm9vdCwgWyB0aGlzIF0uY29uY2F0KCB0aGlzLnBhcmFtcyApICk7XG5cdH07XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9leGVjdXRlVHJhbnNpdGlvbl9UcmFuc2l0aW9uX2hlbHBlcnNfcHJlZml4ID0gZnVuY3Rpb24oIGlzQ2xpZW50LCB2ZW5kb3JzLCBjcmVhdGVFbGVtZW50ICkge1xuXG5cdFx0dmFyIHByZWZpeENhY2hlLCB0ZXN0U3R5bGU7XG5cdFx0aWYgKCAhaXNDbGllbnQgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHByZWZpeENhY2hlID0ge307XG5cdFx0dGVzdFN0eWxlID0gY3JlYXRlRWxlbWVudCggJ2RpdicgKS5zdHlsZTtcblx0XHRyZXR1cm4gZnVuY3Rpb24oIHByb3AgKSB7XG5cdFx0XHR2YXIgaSwgdmVuZG9yLCBjYXBwZWQ7XG5cdFx0XHRpZiAoICFwcmVmaXhDYWNoZVsgcHJvcCBdICkge1xuXHRcdFx0XHRpZiAoIHRlc3RTdHlsZVsgcHJvcCBdICE9PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdFx0cHJlZml4Q2FjaGVbIHByb3AgXSA9IHByb3A7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y2FwcGVkID0gcHJvcC5jaGFyQXQoIDAgKS50b1VwcGVyQ2FzZSgpICsgcHJvcC5zdWJzdHJpbmcoIDEgKTtcblx0XHRcdFx0XHRpID0gdmVuZG9ycy5sZW5ndGg7XG5cdFx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0XHR2ZW5kb3IgPSB2ZW5kb3JzWyBpIF07XG5cdFx0XHRcdFx0XHRpZiAoIHRlc3RTdHlsZVsgdmVuZG9yICsgY2FwcGVkIF0gIT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0XHRcdFx0cHJlZml4Q2FjaGVbIHByb3AgXSA9IHZlbmRvciArIGNhcHBlZDtcblx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcHJlZml4Q2FjaGVbIHByb3AgXTtcblx0XHR9O1xuXHR9KCBjb25maWdfaXNDbGllbnQsIGNvbmZpZ192ZW5kb3JzLCB1dGlsc19jcmVhdGVFbGVtZW50ICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9leGVjdXRlVHJhbnNpdGlvbl9UcmFuc2l0aW9uX3Byb3RvdHlwZV9nZXRTdHlsZSA9IGZ1bmN0aW9uKCBsZWdhY3ksIGlzQ2xpZW50LCBpc0FycmF5LCBwcmVmaXggKSB7XG5cblx0XHR2YXIgZ2V0Q29tcHV0ZWRTdHlsZTtcblx0XHRpZiAoICFpc0NsaWVudCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Z2V0Q29tcHV0ZWRTdHlsZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlIHx8IGxlZ2FjeS5nZXRDb21wdXRlZFN0eWxlO1xuXHRcdHJldHVybiBmdW5jdGlvbiggcHJvcHMgKSB7XG5cdFx0XHR2YXIgY29tcHV0ZWRTdHlsZSwgc3R5bGVzLCBpLCBwcm9wLCB2YWx1ZTtcblx0XHRcdGNvbXB1dGVkU3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSggdGhpcy5ub2RlICk7XG5cdFx0XHRpZiAoIHR5cGVvZiBwcm9wcyA9PT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdHZhbHVlID0gY29tcHV0ZWRTdHlsZVsgcHJlZml4KCBwcm9wcyApIF07XG5cdFx0XHRcdGlmICggdmFsdWUgPT09ICcwcHgnICkge1xuXHRcdFx0XHRcdHZhbHVlID0gMDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICFpc0FycmF5KCBwcm9wcyApICkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdUcmFuc2l0aW9uI2dldFN0eWxlIG11c3QgYmUgcGFzc2VkIGEgc3RyaW5nLCBvciBhbiBhcnJheSBvZiBzdHJpbmdzIHJlcHJlc2VudGluZyBDU1MgcHJvcGVydGllcycgKTtcblx0XHRcdH1cblx0XHRcdHN0eWxlcyA9IHt9O1xuXHRcdFx0aSA9IHByb3BzLmxlbmd0aDtcblx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRwcm9wID0gcHJvcHNbIGkgXTtcblx0XHRcdFx0dmFsdWUgPSBjb21wdXRlZFN0eWxlWyBwcmVmaXgoIHByb3AgKSBdO1xuXHRcdFx0XHRpZiAoIHZhbHVlID09PSAnMHB4JyApIHtcblx0XHRcdFx0XHR2YWx1ZSA9IDA7XG5cdFx0XHRcdH1cblx0XHRcdFx0c3R5bGVzWyBwcm9wIF0gPSB2YWx1ZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBzdHlsZXM7XG5cdFx0fTtcblx0fSggbGVnYWN5LCBjb25maWdfaXNDbGllbnQsIHV0aWxzX2lzQXJyYXksIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9leGVjdXRlVHJhbnNpdGlvbl9UcmFuc2l0aW9uX2hlbHBlcnNfcHJlZml4ICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9leGVjdXRlVHJhbnNpdGlvbl9UcmFuc2l0aW9uX3Byb3RvdHlwZV9zZXRTdHlsZSA9IGZ1bmN0aW9uKCBwcmVmaXggKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHN0eWxlLCB2YWx1ZSApIHtcblx0XHRcdHZhciBwcm9wO1xuXHRcdFx0aWYgKCB0eXBlb2Ygc3R5bGUgPT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHR0aGlzLm5vZGUuc3R5bGVbIHByZWZpeCggc3R5bGUgKSBdID0gdmFsdWU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRmb3IgKCBwcm9wIGluIHN0eWxlICkge1xuXHRcdFx0XHRcdGlmICggc3R5bGUuaGFzT3duUHJvcGVydHkoIHByb3AgKSApIHtcblx0XHRcdFx0XHRcdHRoaXMubm9kZS5zdHlsZVsgcHJlZml4KCBwcm9wICkgXSA9IHN0eWxlWyBwcm9wIF07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9O1xuXHR9KCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZXhlY3V0ZVRyYW5zaXRpb25fVHJhbnNpdGlvbl9oZWxwZXJzX3ByZWZpeCApO1xuXG5cdHZhciB1dGlsc19jYW1lbENhc2UgPSBmdW5jdGlvbiggaHlwaGVuYXRlZFN0ciApIHtcblx0XHRyZXR1cm4gaHlwaGVuYXRlZFN0ci5yZXBsYWNlKCAvLShbYS16QS1aXSkvZywgZnVuY3Rpb24oIG1hdGNoLCAkMSApIHtcblx0XHRcdHJldHVybiAkMS50b1VwcGVyQ2FzZSgpO1xuXHRcdH0gKTtcblx0fTtcblxuXHR2YXIgc2hhcmVkX1RpY2tlciA9IGZ1bmN0aW9uKCB3YXJuLCBnZXRUaW1lLCBhbmltYXRpb25zICkge1xuXG5cdFx0dmFyIFRpY2tlciA9IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0dmFyIGVhc2luZztcblx0XHRcdHRoaXMuZHVyYXRpb24gPSBvcHRpb25zLmR1cmF0aW9uO1xuXHRcdFx0dGhpcy5zdGVwID0gb3B0aW9ucy5zdGVwO1xuXHRcdFx0dGhpcy5jb21wbGV0ZSA9IG9wdGlvbnMuY29tcGxldGU7XG5cdFx0XHRpZiAoIHR5cGVvZiBvcHRpb25zLmVhc2luZyA9PT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdGVhc2luZyA9IG9wdGlvbnMucm9vdC5lYXNpbmdbIG9wdGlvbnMuZWFzaW5nIF07XG5cdFx0XHRcdGlmICggIWVhc2luZyApIHtcblx0XHRcdFx0XHR3YXJuKCAnTWlzc2luZyBlYXNpbmcgZnVuY3Rpb24gKFwiJyArIG9wdGlvbnMuZWFzaW5nICsgJ1wiKS4gWW91IG1heSBuZWVkIHRvIGRvd25sb2FkIGEgcGx1Z2luIGZyb20gW1RPRE9dJyApO1xuXHRcdFx0XHRcdGVhc2luZyA9IGxpbmVhcjtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmICggdHlwZW9mIG9wdGlvbnMuZWFzaW5nID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0XHRlYXNpbmcgPSBvcHRpb25zLmVhc2luZztcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGVhc2luZyA9IGxpbmVhcjtcblx0XHRcdH1cblx0XHRcdHRoaXMuZWFzaW5nID0gZWFzaW5nO1xuXHRcdFx0dGhpcy5zdGFydCA9IGdldFRpbWUoKTtcblx0XHRcdHRoaXMuZW5kID0gdGhpcy5zdGFydCArIHRoaXMuZHVyYXRpb247XG5cdFx0XHR0aGlzLnJ1bm5pbmcgPSB0cnVlO1xuXHRcdFx0YW5pbWF0aW9ucy5hZGQoIHRoaXMgKTtcblx0XHR9O1xuXHRcdFRpY2tlci5wcm90b3R5cGUgPSB7XG5cdFx0XHR0aWNrOiBmdW5jdGlvbiggbm93ICkge1xuXHRcdFx0XHR2YXIgZWxhcHNlZCwgZWFzZWQ7XG5cdFx0XHRcdGlmICggIXRoaXMucnVubmluZyApIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBub3cgPiB0aGlzLmVuZCApIHtcblx0XHRcdFx0XHRpZiAoIHRoaXMuc3RlcCApIHtcblx0XHRcdFx0XHRcdHRoaXMuc3RlcCggMSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIHRoaXMuY29tcGxldGUgKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmNvbXBsZXRlKCAxICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRlbGFwc2VkID0gbm93IC0gdGhpcy5zdGFydDtcblx0XHRcdFx0ZWFzZWQgPSB0aGlzLmVhc2luZyggZWxhcHNlZCAvIHRoaXMuZHVyYXRpb24gKTtcblx0XHRcdFx0aWYgKCB0aGlzLnN0ZXAgKSB7XG5cdFx0XHRcdFx0dGhpcy5zdGVwKCBlYXNlZCApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fSxcblx0XHRcdHN0b3A6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZiAoIHRoaXMuYWJvcnQgKSB7XG5cdFx0XHRcdFx0dGhpcy5hYm9ydCgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMucnVubmluZyA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIFRpY2tlcjtcblxuXHRcdGZ1bmN0aW9uIGxpbmVhciggdCApIHtcblx0XHRcdHJldHVybiB0O1xuXHRcdH1cblx0fSggdXRpbHNfd2FybiwgdXRpbHNfZ2V0VGltZSwgc2hhcmVkX2FuaW1hdGlvbnMgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2V4ZWN1dGVUcmFuc2l0aW9uX1RyYW5zaXRpb25faGVscGVyc191bnByZWZpeCA9IGZ1bmN0aW9uKCB2ZW5kb3JzICkge1xuXG5cdFx0dmFyIHVucHJlZml4UGF0dGVybiA9IG5ldyBSZWdFeHAoICdeLSg/OicgKyB2ZW5kb3JzLmpvaW4oICd8JyApICsgJyktJyApO1xuXHRcdHJldHVybiBmdW5jdGlvbiggcHJvcCApIHtcblx0XHRcdHJldHVybiBwcm9wLnJlcGxhY2UoIHVucHJlZml4UGF0dGVybiwgJycgKTtcblx0XHR9O1xuXHR9KCBjb25maWdfdmVuZG9ycyApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZXhlY3V0ZVRyYW5zaXRpb25fVHJhbnNpdGlvbl9oZWxwZXJzX2h5cGhlbmF0ZSA9IGZ1bmN0aW9uKCB2ZW5kb3JzICkge1xuXG5cdFx0dmFyIHZlbmRvclBhdHRlcm4gPSBuZXcgUmVnRXhwKCAnXig/OicgKyB2ZW5kb3JzLmpvaW4oICd8JyApICsgJykoW0EtWl0pJyApO1xuXHRcdHJldHVybiBmdW5jdGlvbiggc3RyICkge1xuXHRcdFx0dmFyIGh5cGhlbmF0ZWQ7XG5cdFx0XHRpZiAoICFzdHIgKSB7XG5cdFx0XHRcdHJldHVybiAnJztcblx0XHRcdH1cblx0XHRcdGlmICggdmVuZG9yUGF0dGVybi50ZXN0KCBzdHIgKSApIHtcblx0XHRcdFx0c3RyID0gJy0nICsgc3RyO1xuXHRcdFx0fVxuXHRcdFx0aHlwaGVuYXRlZCA9IHN0ci5yZXBsYWNlKCAvW0EtWl0vZywgZnVuY3Rpb24oIG1hdGNoICkge1xuXHRcdFx0XHRyZXR1cm4gJy0nICsgbWF0Y2gudG9Mb3dlckNhc2UoKTtcblx0XHRcdH0gKTtcblx0XHRcdHJldHVybiBoeXBoZW5hdGVkO1xuXHRcdH07XG5cdH0oIGNvbmZpZ192ZW5kb3JzICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9leGVjdXRlVHJhbnNpdGlvbl9UcmFuc2l0aW9uX3Byb3RvdHlwZV9hbmltYXRlU3R5bGVfY3JlYXRlVHJhbnNpdGlvbnMgPSBmdW5jdGlvbiggaXNDbGllbnQsIHdhcm4sIGNyZWF0ZUVsZW1lbnQsIGNhbWVsQ2FzZSwgaW50ZXJwb2xhdGUsIFRpY2tlciwgcHJlZml4LCB1bnByZWZpeCwgaHlwaGVuYXRlICkge1xuXG5cdFx0dmFyIHRlc3RTdHlsZSwgVFJBTlNJVElPTiwgVFJBTlNJVElPTkVORCwgQ1NTX1RSQU5TSVRJT05TX0VOQUJMRUQsIFRSQU5TSVRJT05fRFVSQVRJT04sIFRSQU5TSVRJT05fUFJPUEVSVFksIFRSQU5TSVRJT05fVElNSU5HX0ZVTkNUSU9OLCBjYW5Vc2VDc3NUcmFuc2l0aW9ucyA9IHt9LCBjYW5ub3RVc2VDc3NUcmFuc2l0aW9ucyA9IHt9O1xuXHRcdGlmICggIWlzQ2xpZW50ICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0ZXN0U3R5bGUgPSBjcmVhdGVFbGVtZW50KCAnZGl2JyApLnN0eWxlO1xuXHRcdCggZnVuY3Rpb24oKSB7XG5cdFx0XHRpZiAoIHRlc3RTdHlsZS50cmFuc2l0aW9uICE9PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdFRSQU5TSVRJT04gPSAndHJhbnNpdGlvbic7XG5cdFx0XHRcdFRSQU5TSVRJT05FTkQgPSAndHJhbnNpdGlvbmVuZCc7XG5cdFx0XHRcdENTU19UUkFOU0lUSU9OU19FTkFCTEVEID0gdHJ1ZTtcblx0XHRcdH0gZWxzZSBpZiAoIHRlc3RTdHlsZS53ZWJraXRUcmFuc2l0aW9uICE9PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdFRSQU5TSVRJT04gPSAnd2Via2l0VHJhbnNpdGlvbic7XG5cdFx0XHRcdFRSQU5TSVRJT05FTkQgPSAnd2Via2l0VHJhbnNpdGlvbkVuZCc7XG5cdFx0XHRcdENTU19UUkFOU0lUSU9OU19FTkFCTEVEID0gdHJ1ZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdENTU19UUkFOU0lUSU9OU19FTkFCTEVEID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fSgpICk7XG5cdFx0aWYgKCBUUkFOU0lUSU9OICkge1xuXHRcdFx0VFJBTlNJVElPTl9EVVJBVElPTiA9IFRSQU5TSVRJT04gKyAnRHVyYXRpb24nO1xuXHRcdFx0VFJBTlNJVElPTl9QUk9QRVJUWSA9IFRSQU5TSVRJT04gKyAnUHJvcGVydHknO1xuXHRcdFx0VFJBTlNJVElPTl9USU1JTkdfRlVOQ1RJT04gPSBUUkFOU0lUSU9OICsgJ1RpbWluZ0Z1bmN0aW9uJztcblx0XHR9XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB0LCB0bywgb3B0aW9ucywgY2hhbmdlZFByb3BlcnRpZXMsIHRyYW5zaXRpb25FbmRIYW5kbGVyLCByZXNvbHZlICkge1xuXHRcdFx0c2V0VGltZW91dCggZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBoYXNoUHJlZml4LCBqc1RyYW5zaXRpb25zQ29tcGxldGUsIGNzc1RyYW5zaXRpb25zQ29tcGxldGUsIGNoZWNrQ29tcGxldGU7XG5cdFx0XHRcdGNoZWNrQ29tcGxldGUgPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRpZiAoIGpzVHJhbnNpdGlvbnNDb21wbGV0ZSAmJiBjc3NUcmFuc2l0aW9uc0NvbXBsZXRlICkge1xuXHRcdFx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fTtcblx0XHRcdFx0aGFzaFByZWZpeCA9IHQubm9kZS5uYW1lc3BhY2VVUkkgKyB0Lm5vZGUudGFnTmFtZTtcblx0XHRcdFx0dC5ub2RlLnN0eWxlWyBUUkFOU0lUSU9OX1BST1BFUlRZIF0gPSBjaGFuZ2VkUHJvcGVydGllcy5tYXAoIHByZWZpeCApLm1hcCggaHlwaGVuYXRlICkuam9pbiggJywnICk7XG5cdFx0XHRcdHQubm9kZS5zdHlsZVsgVFJBTlNJVElPTl9USU1JTkdfRlVOQ1RJT04gXSA9IGh5cGhlbmF0ZSggb3B0aW9ucy5lYXNpbmcgfHwgJ2xpbmVhcicgKTtcblx0XHRcdFx0dC5ub2RlLnN0eWxlWyBUUkFOU0lUSU9OX0RVUkFUSU9OIF0gPSBvcHRpb25zLmR1cmF0aW9uIC8gMTAwMCArICdzJztcblx0XHRcdFx0dHJhbnNpdGlvbkVuZEhhbmRsZXIgPSBmdW5jdGlvbiggZXZlbnQgKSB7XG5cdFx0XHRcdFx0dmFyIGluZGV4O1xuXHRcdFx0XHRcdGluZGV4ID0gY2hhbmdlZFByb3BlcnRpZXMuaW5kZXhPZiggY2FtZWxDYXNlKCB1bnByZWZpeCggZXZlbnQucHJvcGVydHlOYW1lICkgKSApO1xuXHRcdFx0XHRcdGlmICggaW5kZXggIT09IC0xICkge1xuXHRcdFx0XHRcdFx0Y2hhbmdlZFByb3BlcnRpZXMuc3BsaWNlKCBpbmRleCwgMSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIGNoYW5nZWRQcm9wZXJ0aWVzLmxlbmd0aCApIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dC5yb290LmZpcmUoIHQubmFtZSArICc6ZW5kJyApO1xuXHRcdFx0XHRcdHQubm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKCBUUkFOU0lUSU9ORU5ELCB0cmFuc2l0aW9uRW5kSGFuZGxlciwgZmFsc2UgKTtcblx0XHRcdFx0XHRjc3NUcmFuc2l0aW9uc0NvbXBsZXRlID0gdHJ1ZTtcblx0XHRcdFx0XHRjaGVja0NvbXBsZXRlKCk7XG5cdFx0XHRcdH07XG5cdFx0XHRcdHQubm9kZS5hZGRFdmVudExpc3RlbmVyKCBUUkFOU0lUSU9ORU5ELCB0cmFuc2l0aW9uRW5kSGFuZGxlciwgZmFsc2UgKTtcblx0XHRcdFx0c2V0VGltZW91dCggZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0dmFyIGkgPSBjaGFuZ2VkUHJvcGVydGllcy5sZW5ndGgsXG5cdFx0XHRcdFx0XHRoYXNoLCBvcmlnaW5hbFZhbHVlLCBpbmRleCwgcHJvcGVydGllc1RvVHJhbnNpdGlvbkluSnMgPSBbXSxcblx0XHRcdFx0XHRcdHByb3A7XG5cdFx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0XHRwcm9wID0gY2hhbmdlZFByb3BlcnRpZXNbIGkgXTtcblx0XHRcdFx0XHRcdGhhc2ggPSBoYXNoUHJlZml4ICsgcHJvcDtcblx0XHRcdFx0XHRcdGlmICggY2FuVXNlQ3NzVHJhbnNpdGlvbnNbIGhhc2ggXSApIHtcblx0XHRcdFx0XHRcdFx0dC5ub2RlLnN0eWxlWyBwcmVmaXgoIHByb3AgKSBdID0gdG9bIHByb3AgXTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdG9yaWdpbmFsVmFsdWUgPSB0LmdldFN0eWxlKCBwcm9wICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoIGNhblVzZUNzc1RyYW5zaXRpb25zWyBoYXNoIF0gPT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0XHRcdFx0dC5ub2RlLnN0eWxlWyBwcmVmaXgoIHByb3AgKSBdID0gdG9bIHByb3AgXTtcblx0XHRcdFx0XHRcdFx0Y2FuVXNlQ3NzVHJhbnNpdGlvbnNbIGhhc2ggXSA9IHQuZ2V0U3R5bGUoIHByb3AgKSAhPSB0b1sgcHJvcCBdO1xuXHRcdFx0XHRcdFx0XHRjYW5ub3RVc2VDc3NUcmFuc2l0aW9uc1sgaGFzaCBdID0gIWNhblVzZUNzc1RyYW5zaXRpb25zWyBoYXNoIF07XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoIGNhbm5vdFVzZUNzc1RyYW5zaXRpb25zWyBoYXNoIF0gKSB7XG5cdFx0XHRcdFx0XHRcdGluZGV4ID0gY2hhbmdlZFByb3BlcnRpZXMuaW5kZXhPZiggcHJvcCApO1xuXHRcdFx0XHRcdFx0XHRpZiAoIGluZGV4ID09PSAtMSApIHtcblx0XHRcdFx0XHRcdFx0XHR3YXJuKCAnU29tZXRoaW5nIHZlcnkgc3RyYW5nZSBoYXBwZW5lZCB3aXRoIHRyYW5zaXRpb25zLiBJZiB5b3Ugc2VlIHRoaXMgbWVzc2FnZSwgcGxlYXNlIGxldCBAUmFjdGl2ZUpTIGtub3cuIFRoYW5rcyEnICk7XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0Y2hhbmdlZFByb3BlcnRpZXMuc3BsaWNlKCBpbmRleCwgMSApO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdHQubm9kZS5zdHlsZVsgcHJlZml4KCBwcm9wICkgXSA9IG9yaWdpbmFsVmFsdWU7XG5cdFx0XHRcdFx0XHRcdHByb3BlcnRpZXNUb1RyYW5zaXRpb25JbkpzLnB1c2goIHtcblx0XHRcdFx0XHRcdFx0XHRuYW1lOiBwcmVmaXgoIHByb3AgKSxcblx0XHRcdFx0XHRcdFx0XHRpbnRlcnBvbGF0b3I6IGludGVycG9sYXRlKCBvcmlnaW5hbFZhbHVlLCB0b1sgcHJvcCBdIClcblx0XHRcdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIHByb3BlcnRpZXNUb1RyYW5zaXRpb25JbkpzLmxlbmd0aCApIHtcblx0XHRcdFx0XHRcdG5ldyBUaWNrZXIoIHtcblx0XHRcdFx0XHRcdFx0cm9vdDogdC5yb290LFxuXHRcdFx0XHRcdFx0XHRkdXJhdGlvbjogb3B0aW9ucy5kdXJhdGlvbixcblx0XHRcdFx0XHRcdFx0ZWFzaW5nOiBjYW1lbENhc2UoIG9wdGlvbnMuZWFzaW5nICksXG5cdFx0XHRcdFx0XHRcdHN0ZXA6IGZ1bmN0aW9uKCBwb3MgKSB7XG5cdFx0XHRcdFx0XHRcdFx0dmFyIHByb3AsIGk7XG5cdFx0XHRcdFx0XHRcdFx0aSA9IHByb3BlcnRpZXNUb1RyYW5zaXRpb25JbkpzLmxlbmd0aDtcblx0XHRcdFx0XHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRcdFx0XHRcdHByb3AgPSBwcm9wZXJ0aWVzVG9UcmFuc2l0aW9uSW5Kc1sgaSBdO1xuXHRcdFx0XHRcdFx0XHRcdFx0dC5ub2RlLnN0eWxlWyBwcm9wLm5hbWUgXSA9IHByb3AuaW50ZXJwb2xhdG9yKCBwb3MgKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdGNvbXBsZXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdFx0XHRqc1RyYW5zaXRpb25zQ29tcGxldGUgPSB0cnVlO1xuXHRcdFx0XHRcdFx0XHRcdGNoZWNrQ29tcGxldGUoKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRqc1RyYW5zaXRpb25zQ29tcGxldGUgPSB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoICFjaGFuZ2VkUHJvcGVydGllcy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0XHR0Lm5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggVFJBTlNJVElPTkVORCwgdHJhbnNpdGlvbkVuZEhhbmRsZXIsIGZhbHNlICk7XG5cdFx0XHRcdFx0XHRjc3NUcmFuc2l0aW9uc0NvbXBsZXRlID0gdHJ1ZTtcblx0XHRcdFx0XHRcdGNoZWNrQ29tcGxldGUoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sIDAgKTtcblx0XHRcdH0sIG9wdGlvbnMuZGVsYXkgfHwgMCApO1xuXHRcdH07XG5cdH0oIGNvbmZpZ19pc0NsaWVudCwgdXRpbHNfd2FybiwgdXRpbHNfY3JlYXRlRWxlbWVudCwgdXRpbHNfY2FtZWxDYXNlLCBzaGFyZWRfaW50ZXJwb2xhdGUsIHNoYXJlZF9UaWNrZXIsIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9leGVjdXRlVHJhbnNpdGlvbl9UcmFuc2l0aW9uX2hlbHBlcnNfcHJlZml4LCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZXhlY3V0ZVRyYW5zaXRpb25fVHJhbnNpdGlvbl9oZWxwZXJzX3VucHJlZml4LCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZXhlY3V0ZVRyYW5zaXRpb25fVHJhbnNpdGlvbl9oZWxwZXJzX2h5cGhlbmF0ZSApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZXhlY3V0ZVRyYW5zaXRpb25fVHJhbnNpdGlvbl9wcm90b3R5cGVfYW5pbWF0ZVN0eWxlX19hbmltYXRlU3R5bGUgPSBmdW5jdGlvbiggbGVnYWN5LCBpc0NsaWVudCwgd2FybiwgUHJvbWlzZSwgcHJlZml4LCBjcmVhdGVUcmFuc2l0aW9ucyApIHtcblxuXHRcdHZhciBnZXRDb21wdXRlZFN0eWxlO1xuXHRcdGlmICggIWlzQ2xpZW50ICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRnZXRDb21wdXRlZFN0eWxlID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUgfHwgbGVnYWN5LmdldENvbXB1dGVkU3R5bGU7XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBzdHlsZSwgdmFsdWUsIG9wdGlvbnMsIGNvbXBsZXRlICkge1xuXHRcdFx0dmFyIHQgPSB0aGlzLFxuXHRcdFx0XHR0bztcblx0XHRcdGlmICggdHlwZW9mIHN0eWxlID09PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0dG8gPSB7fTtcblx0XHRcdFx0dG9bIHN0eWxlIF0gPSB2YWx1ZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRvID0gc3R5bGU7XG5cdFx0XHRcdGNvbXBsZXRlID0gb3B0aW9ucztcblx0XHRcdFx0b3B0aW9ucyA9IHZhbHVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhb3B0aW9ucyApIHtcblx0XHRcdFx0d2FybiggJ1RoZSBcIicgKyB0Lm5hbWUgKyAnXCIgdHJhbnNpdGlvbiBkb2VzIG5vdCBzdXBwbHkgYW4gb3B0aW9ucyBvYmplY3QgdG8gYHQuYW5pbWF0ZVN0eWxlKClgLiBUaGlzIHdpbGwgYnJlYWsgaW4gYSBmdXR1cmUgdmVyc2lvbiBvZiBSYWN0aXZlLiBGb3IgbW9yZSBpbmZvIHNlZSBodHRwczovL2dpdGh1Yi5jb20vUmFjdGl2ZUpTL1JhY3RpdmUvaXNzdWVzLzM0MCcgKTtcblx0XHRcdFx0b3B0aW9ucyA9IHQ7XG5cdFx0XHRcdGNvbXBsZXRlID0gdC5jb21wbGV0ZTtcblx0XHRcdH1cblx0XHRcdHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoIGZ1bmN0aW9uKCByZXNvbHZlICkge1xuXHRcdFx0XHR2YXIgcHJvcGVydHlOYW1lcywgY2hhbmdlZFByb3BlcnRpZXMsIGNvbXB1dGVkU3R5bGUsIGN1cnJlbnQsIGZyb20sIHRyYW5zaXRpb25FbmRIYW5kbGVyLCBpLCBwcm9wO1xuXHRcdFx0XHRpZiAoICFvcHRpb25zLmR1cmF0aW9uICkge1xuXHRcdFx0XHRcdHQuc2V0U3R5bGUoIHRvICk7XG5cdFx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRwcm9wZXJ0eU5hbWVzID0gT2JqZWN0LmtleXMoIHRvICk7XG5cdFx0XHRcdGNoYW5nZWRQcm9wZXJ0aWVzID0gW107XG5cdFx0XHRcdGNvbXB1dGVkU3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSggdC5ub2RlICk7XG5cdFx0XHRcdGZyb20gPSB7fTtcblx0XHRcdFx0aSA9IHByb3BlcnR5TmFtZXMubGVuZ3RoO1xuXHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRwcm9wID0gcHJvcGVydHlOYW1lc1sgaSBdO1xuXHRcdFx0XHRcdGN1cnJlbnQgPSBjb21wdXRlZFN0eWxlWyBwcmVmaXgoIHByb3AgKSBdO1xuXHRcdFx0XHRcdGlmICggY3VycmVudCA9PT0gJzBweCcgKSB7XG5cdFx0XHRcdFx0XHRjdXJyZW50ID0gMDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCBjdXJyZW50ICE9IHRvWyBwcm9wIF0gKSB7XG5cdFx0XHRcdFx0XHRjaGFuZ2VkUHJvcGVydGllcy5wdXNoKCBwcm9wICk7XG5cdFx0XHRcdFx0XHR0Lm5vZGUuc3R5bGVbIHByZWZpeCggcHJvcCApIF0gPSBjdXJyZW50O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoICFjaGFuZ2VkUHJvcGVydGllcy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRjcmVhdGVUcmFuc2l0aW9ucyggdCwgdG8sIG9wdGlvbnMsIGNoYW5nZWRQcm9wZXJ0aWVzLCB0cmFuc2l0aW9uRW5kSGFuZGxlciwgcmVzb2x2ZSApO1xuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCBjb21wbGV0ZSApIHtcblx0XHRcdFx0d2FybiggJ3QuYW5pbWF0ZVN0eWxlIHJldHVybnMgYSBQcm9taXNlIGFzIG9mIDAuNC4wLiBUcmFuc2l0aW9uIGF1dGhvcnMgc2hvdWxkIGRvIHQuYW5pbWF0ZVN0eWxlKC4uLikudGhlbihjYWxsYmFjayknICk7XG5cdFx0XHRcdHByb21pc2UudGhlbiggY29tcGxldGUgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBwcm9taXNlO1xuXHRcdH07XG5cdH0oIGxlZ2FjeSwgY29uZmlnX2lzQ2xpZW50LCB1dGlsc193YXJuLCB1dGlsc19Qcm9taXNlLCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZXhlY3V0ZVRyYW5zaXRpb25fVHJhbnNpdGlvbl9oZWxwZXJzX3ByZWZpeCwgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2V4ZWN1dGVUcmFuc2l0aW9uX1RyYW5zaXRpb25fcHJvdG90eXBlX2FuaW1hdGVTdHlsZV9jcmVhdGVUcmFuc2l0aW9ucyApO1xuXG5cdHZhciB1dGlsc19maWxsR2FwcyA9IGZ1bmN0aW9uKCB0YXJnZXQsIHNvdXJjZSApIHtcblx0XHR2YXIga2V5O1xuXHRcdGZvciAoIGtleSBpbiBzb3VyY2UgKSB7XG5cdFx0XHRpZiAoIHNvdXJjZS5oYXNPd25Qcm9wZXJ0eSgga2V5ICkgJiYgISgga2V5IGluIHRhcmdldCApICkge1xuXHRcdFx0XHR0YXJnZXRbIGtleSBdID0gc291cmNlWyBrZXkgXTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRhcmdldDtcblx0fTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2V4ZWN1dGVUcmFuc2l0aW9uX1RyYW5zaXRpb25fcHJvdG90eXBlX3Byb2Nlc3NQYXJhbXMgPSBmdW5jdGlvbiggZmlsbEdhcHMgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHBhcmFtcywgZGVmYXVsdHMgKSB7XG5cdFx0XHRpZiAoIHR5cGVvZiBwYXJhbXMgPT09ICdudW1iZXInICkge1xuXHRcdFx0XHRwYXJhbXMgPSB7XG5cdFx0XHRcdFx0ZHVyYXRpb246IHBhcmFtc1xuXHRcdFx0XHR9O1xuXHRcdFx0fSBlbHNlIGlmICggdHlwZW9mIHBhcmFtcyA9PT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdGlmICggcGFyYW1zID09PSAnc2xvdycgKSB7XG5cdFx0XHRcdFx0cGFyYW1zID0ge1xuXHRcdFx0XHRcdFx0ZHVyYXRpb246IDYwMFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0gZWxzZSBpZiAoIHBhcmFtcyA9PT0gJ2Zhc3QnICkge1xuXHRcdFx0XHRcdHBhcmFtcyA9IHtcblx0XHRcdFx0XHRcdGR1cmF0aW9uOiAyMDBcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHBhcmFtcyA9IHtcblx0XHRcdFx0XHRcdGR1cmF0aW9uOiA0MDBcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKCAhcGFyYW1zICkge1xuXHRcdFx0XHRwYXJhbXMgPSB7fTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBmaWxsR2FwcyggcGFyYW1zLCBkZWZhdWx0cyApO1xuXHRcdH07XG5cdH0oIHV0aWxzX2ZpbGxHYXBzICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9leGVjdXRlVHJhbnNpdGlvbl9UcmFuc2l0aW9uX3Byb3RvdHlwZV9yZXNldFN0eWxlID0gZnVuY3Rpb24oKSB7XG5cdFx0aWYgKCB0aGlzLm9yaWdpbmFsU3R5bGUgKSB7XG5cdFx0XHR0aGlzLm5vZGUuc2V0QXR0cmlidXRlKCAnc3R5bGUnLCB0aGlzLm9yaWdpbmFsU3R5bGUgKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5ub2RlLmdldEF0dHJpYnV0ZSggJ3N0eWxlJyApO1xuXHRcdFx0dGhpcy5ub2RlLnJlbW92ZUF0dHJpYnV0ZSggJ3N0eWxlJyApO1xuXHRcdH1cblx0fTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2V4ZWN1dGVUcmFuc2l0aW9uX1RyYW5zaXRpb25fX1RyYW5zaXRpb24gPSBmdW5jdGlvbiggd2FybiwgU3RyaW5nRnJhZ21lbnQsIGluaXQsIGdldFN0eWxlLCBzZXRTdHlsZSwgYW5pbWF0ZVN0eWxlLCBwcm9jZXNzUGFyYW1zLCByZXNldFN0eWxlICkge1xuXG5cdFx0dmFyIFRyYW5zaXRpb247XG5cdFx0VHJhbnNpdGlvbiA9IGZ1bmN0aW9uKCBkZXNjcmlwdG9yLCByb290LCBvd25lciwgaXNJbnRybyApIHtcblx0XHRcdHZhciB0ID0gdGhpcyxcblx0XHRcdFx0bmFtZSwgZnJhZ21lbnQsIGVycm9yTWVzc2FnZTtcblx0XHRcdHRoaXMucm9vdCA9IHJvb3Q7XG5cdFx0XHR0aGlzLm5vZGUgPSBvd25lci5ub2RlO1xuXHRcdFx0dGhpcy5pc0ludHJvID0gaXNJbnRybztcblx0XHRcdHRoaXMub3JpZ2luYWxTdHlsZSA9IHRoaXMubm9kZS5nZXRBdHRyaWJ1dGUoICdzdHlsZScgKTtcblx0XHRcdHQuY29tcGxldGUgPSBmdW5jdGlvbiggbm9SZXNldCApIHtcblx0XHRcdFx0aWYgKCAhbm9SZXNldCAmJiB0LmlzSW50cm8gKSB7XG5cdFx0XHRcdFx0dC5yZXNldFN0eWxlKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dC5ub2RlLl9yYWN0aXZlLnRyYW5zaXRpb24gPSBudWxsO1xuXHRcdFx0XHR0Ll9tYW5hZ2VyLnJlbW92ZSggdCApO1xuXHRcdFx0fTtcblx0XHRcdG5hbWUgPSBkZXNjcmlwdG9yLm4gfHwgZGVzY3JpcHRvcjtcblx0XHRcdGlmICggdHlwZW9mIG5hbWUgIT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHRmcmFnbWVudCA9IG5ldyBTdHJpbmdGcmFnbWVudCgge1xuXHRcdFx0XHRcdGRlc2NyaXB0b3I6IG5hbWUsXG5cdFx0XHRcdFx0cm9vdDogdGhpcy5yb290LFxuXHRcdFx0XHRcdG93bmVyOiBvd25lclxuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdG5hbWUgPSBmcmFnbWVudC50b1N0cmluZygpO1xuXHRcdFx0XHRmcmFnbWVudC50ZWFyZG93bigpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5uYW1lID0gbmFtZTtcblx0XHRcdGlmICggZGVzY3JpcHRvci5hICkge1xuXHRcdFx0XHR0aGlzLnBhcmFtcyA9IGRlc2NyaXB0b3IuYTtcblx0XHRcdH0gZWxzZSBpZiAoIGRlc2NyaXB0b3IuZCApIHtcblx0XHRcdFx0ZnJhZ21lbnQgPSBuZXcgU3RyaW5nRnJhZ21lbnQoIHtcblx0XHRcdFx0XHRkZXNjcmlwdG9yOiBkZXNjcmlwdG9yLmQsXG5cdFx0XHRcdFx0cm9vdDogdGhpcy5yb290LFxuXHRcdFx0XHRcdG93bmVyOiBvd25lclxuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdHRoaXMucGFyYW1zID0gZnJhZ21lbnQudG9BcmdzTGlzdCgpO1xuXHRcdFx0XHRmcmFnbWVudC50ZWFyZG93bigpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fZm4gPSByb290LnRyYW5zaXRpb25zWyBuYW1lIF07XG5cdFx0XHRpZiAoICF0aGlzLl9mbiApIHtcblx0XHRcdFx0ZXJyb3JNZXNzYWdlID0gJ01pc3NpbmcgXCInICsgbmFtZSArICdcIiB0cmFuc2l0aW9uLiBZb3UgbWF5IG5lZWQgdG8gZG93bmxvYWQgYSBwbHVnaW4gdmlhIGh0dHA6Ly9kb2NzLnJhY3RpdmVqcy5vcmcvbGF0ZXN0L3BsdWdpbnMjdHJhbnNpdGlvbnMnO1xuXHRcdFx0XHRpZiAoIHJvb3QuZGVidWcgKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCBlcnJvck1lc3NhZ2UgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR3YXJuKCBlcnJvck1lc3NhZ2UgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRUcmFuc2l0aW9uLnByb3RvdHlwZSA9IHtcblx0XHRcdGluaXQ6IGluaXQsXG5cdFx0XHRnZXRTdHlsZTogZ2V0U3R5bGUsXG5cdFx0XHRzZXRTdHlsZTogc2V0U3R5bGUsXG5cdFx0XHRhbmltYXRlU3R5bGU6IGFuaW1hdGVTdHlsZSxcblx0XHRcdHByb2Nlc3NQYXJhbXM6IHByb2Nlc3NQYXJhbXMsXG5cdFx0XHRyZXNldFN0eWxlOiByZXNldFN0eWxlXG5cdFx0fTtcblx0XHRyZXR1cm4gVHJhbnNpdGlvbjtcblx0fSggdXRpbHNfd2FybiwgcmVuZGVyX1N0cmluZ0ZyYWdtZW50X19TdHJpbmdGcmFnbWVudCwgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2V4ZWN1dGVUcmFuc2l0aW9uX1RyYW5zaXRpb25fcHJvdG90eXBlX2luaXQsIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9leGVjdXRlVHJhbnNpdGlvbl9UcmFuc2l0aW9uX3Byb3RvdHlwZV9nZXRTdHlsZSwgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2V4ZWN1dGVUcmFuc2l0aW9uX1RyYW5zaXRpb25fcHJvdG90eXBlX3NldFN0eWxlLCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZXhlY3V0ZVRyYW5zaXRpb25fVHJhbnNpdGlvbl9wcm90b3R5cGVfYW5pbWF0ZVN0eWxlX19hbmltYXRlU3R5bGUsIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9leGVjdXRlVHJhbnNpdGlvbl9UcmFuc2l0aW9uX3Byb3RvdHlwZV9wcm9jZXNzUGFyYW1zLCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZXhlY3V0ZVRyYW5zaXRpb25fVHJhbnNpdGlvbl9wcm90b3R5cGVfcmVzZXRTdHlsZSApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZXhlY3V0ZVRyYW5zaXRpb25fX2V4ZWN1dGVUcmFuc2l0aW9uID0gZnVuY3Rpb24oIHJ1bmxvb3AsIFRyYW5zaXRpb24gKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIGRlc2NyaXB0b3IsIHJhY3RpdmUsIG93bmVyLCBpc0ludHJvICkge1xuXHRcdFx0dmFyIHRyYW5zaXRpb24sIG5vZGUsIG9sZFRyYW5zaXRpb247XG5cdFx0XHRpZiAoICFyYWN0aXZlLnRyYW5zaXRpb25zRW5hYmxlZCB8fCByYWN0aXZlLl9wYXJlbnQgJiYgIXJhY3RpdmUuX3BhcmVudC50cmFuc2l0aW9uc0VuYWJsZWQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRyYW5zaXRpb24gPSBuZXcgVHJhbnNpdGlvbiggZGVzY3JpcHRvciwgcmFjdGl2ZSwgb3duZXIsIGlzSW50cm8gKTtcblx0XHRcdGlmICggdHJhbnNpdGlvbi5fZm4gKSB7XG5cdFx0XHRcdG5vZGUgPSB0cmFuc2l0aW9uLm5vZGU7XG5cdFx0XHRcdGlmICggb2xkVHJhbnNpdGlvbiA9IG5vZGUuX3JhY3RpdmUudHJhbnNpdGlvbiApIHtcblx0XHRcdFx0XHRvbGRUcmFuc2l0aW9uLmNvbXBsZXRlKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0bm9kZS5fcmFjdGl2ZS50cmFuc2l0aW9uID0gdHJhbnNpdGlvbjtcblx0XHRcdFx0cnVubG9vcC5hZGRUcmFuc2l0aW9uKCB0cmFuc2l0aW9uICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fSggZ2xvYmFsX3J1bmxvb3AsIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9leGVjdXRlVHJhbnNpdGlvbl9UcmFuc2l0aW9uX19UcmFuc2l0aW9uICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X2luaXRpYWxpc2VfX2luaXRpYWxpc2UgPSBmdW5jdGlvbiggcnVubG9vcCwgdHlwZXMsIG5hbWVzcGFjZXMsIGNyZWF0ZSwgZGVmaW5lUHJvcGVydHksIHdhcm4sIGNyZWF0ZUVsZW1lbnQsIGdldElubmVyQ29udGV4dCwgZ2V0RWxlbWVudE5hbWVzcGFjZSwgY3JlYXRlRWxlbWVudEF0dHJpYnV0ZXMsIGFwcGVuZEVsZW1lbnRDaGlsZHJlbiwgZGVjb3JhdGUsIGFkZEV2ZW50UHJveGllcywgdXBkYXRlTGl2ZVF1ZXJpZXMsIGV4ZWN1dGVUcmFuc2l0aW9uLCBlbmZvcmNlQ2FzZSApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiBpbml0aWFsaXNlRWxlbWVudCggZWxlbWVudCwgb3B0aW9ucywgZG9jRnJhZyApIHtcblx0XHRcdHZhciBwYXJlbnRGcmFnbWVudCwgcE5vZGUsIGRlc2NyaXB0b3IsIG5hbWVzcGFjZSwgbmFtZSwgYXR0cmlidXRlcywgd2lkdGgsIGhlaWdodCwgbG9hZEhhbmRsZXIsIHJvb3QsIHNlbGVjdEJpbmRpbmcsIGVycm9yTWVzc2FnZTtcblx0XHRcdGVsZW1lbnQudHlwZSA9IHR5cGVzLkVMRU1FTlQ7XG5cdFx0XHRwYXJlbnRGcmFnbWVudCA9IGVsZW1lbnQucGFyZW50RnJhZ21lbnQgPSBvcHRpb25zLnBhcmVudEZyYWdtZW50O1xuXHRcdFx0cE5vZGUgPSBwYXJlbnRGcmFnbWVudC5wTm9kZTtcblx0XHRcdGRlc2NyaXB0b3IgPSBlbGVtZW50LmRlc2NyaXB0b3IgPSBvcHRpb25zLmRlc2NyaXB0b3I7XG5cdFx0XHRlbGVtZW50LnBhcmVudCA9IG9wdGlvbnMucEVsZW1lbnQ7XG5cdFx0XHRlbGVtZW50LnJvb3QgPSByb290ID0gcGFyZW50RnJhZ21lbnQucm9vdDtcblx0XHRcdGVsZW1lbnQuaW5kZXggPSBvcHRpb25zLmluZGV4O1xuXHRcdFx0ZWxlbWVudC5sY05hbWUgPSBkZXNjcmlwdG9yLmUudG9Mb3dlckNhc2UoKTtcblx0XHRcdGVsZW1lbnQuZXZlbnRMaXN0ZW5lcnMgPSBbXTtcblx0XHRcdGVsZW1lbnQuY3VzdG9tRXZlbnRMaXN0ZW5lcnMgPSBbXTtcblx0XHRcdGVsZW1lbnQuY3NzRGV0YWNoUXVldWUgPSBbXTtcblx0XHRcdGlmICggcE5vZGUgKSB7XG5cdFx0XHRcdG5hbWVzcGFjZSA9IGVsZW1lbnQubmFtZXNwYWNlID0gZ2V0RWxlbWVudE5hbWVzcGFjZSggZGVzY3JpcHRvciwgcE5vZGUgKTtcblx0XHRcdFx0bmFtZSA9IG5hbWVzcGFjZSAhPT0gbmFtZXNwYWNlcy5odG1sID8gZW5mb3JjZUNhc2UoIGRlc2NyaXB0b3IuZSApIDogZGVzY3JpcHRvci5lO1xuXHRcdFx0XHRlbGVtZW50Lm5vZGUgPSBjcmVhdGVFbGVtZW50KCBuYW1lLCBuYW1lc3BhY2UgKTtcblx0XHRcdFx0aWYgKCByb290LmNzcyAmJiBwTm9kZSA9PT0gcm9vdC5lbCApIHtcblx0XHRcdFx0XHRlbGVtZW50Lm5vZGUuc2V0QXR0cmlidXRlKCAnZGF0YS1ydmNndWlkJywgcm9vdC5jb25zdHJ1Y3Rvci5fZ3VpZCB8fCByb290Ll9ndWlkICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZGVmaW5lUHJvcGVydHkoIGVsZW1lbnQubm9kZSwgJ19yYWN0aXZlJywge1xuXHRcdFx0XHRcdHZhbHVlOiB7XG5cdFx0XHRcdFx0XHRwcm94eTogZWxlbWVudCxcblx0XHRcdFx0XHRcdGtleXBhdGg6IGdldElubmVyQ29udGV4dCggcGFyZW50RnJhZ21lbnQgKSxcblx0XHRcdFx0XHRcdGluZGV4OiBwYXJlbnRGcmFnbWVudC5pbmRleFJlZnMsXG5cdFx0XHRcdFx0XHRldmVudHM6IGNyZWF0ZSggbnVsbCApLFxuXHRcdFx0XHRcdFx0cm9vdDogcm9vdFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSApO1xuXHRcdFx0fVxuXHRcdFx0YXR0cmlidXRlcyA9IGNyZWF0ZUVsZW1lbnRBdHRyaWJ1dGVzKCBlbGVtZW50LCBkZXNjcmlwdG9yLmEgKTtcblx0XHRcdGlmICggZGVzY3JpcHRvci5mICkge1xuXHRcdFx0XHRpZiAoIGVsZW1lbnQubm9kZSAmJiBlbGVtZW50Lm5vZGUuZ2V0QXR0cmlidXRlKCAnY29udGVudGVkaXRhYmxlJyApICkge1xuXHRcdFx0XHRcdGlmICggZWxlbWVudC5ub2RlLmlubmVySFRNTCApIHtcblx0XHRcdFx0XHRcdGVycm9yTWVzc2FnZSA9ICdBIHByZS1wb3B1bGF0ZWQgY29udGVudGVkaXRhYmxlIGVsZW1lbnQgc2hvdWxkIG5vdCBoYXZlIGNoaWxkcmVuJztcblx0XHRcdFx0XHRcdGlmICggcm9vdC5kZWJ1ZyApIHtcblx0XHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCBlcnJvck1lc3NhZ2UgKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHdhcm4oIGVycm9yTWVzc2FnZSApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRhcHBlbmRFbGVtZW50Q2hpbGRyZW4oIGVsZW1lbnQsIGVsZW1lbnQubm9kZSwgZGVzY3JpcHRvciwgZG9jRnJhZyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBkb2NGcmFnICYmIGRlc2NyaXB0b3IudiApIHtcblx0XHRcdFx0YWRkRXZlbnRQcm94aWVzKCBlbGVtZW50LCBkZXNjcmlwdG9yLnYgKTtcblx0XHRcdH1cblx0XHRcdGlmICggZG9jRnJhZyApIHtcblx0XHRcdFx0aWYgKCByb290LnR3b3dheSApIHtcblx0XHRcdFx0XHRlbGVtZW50LmJpbmQoKTtcblx0XHRcdFx0XHRpZiAoIGVsZW1lbnQubm9kZS5nZXRBdHRyaWJ1dGUoICdjb250ZW50ZWRpdGFibGUnICkgJiYgZWxlbWVudC5ub2RlLl9yYWN0aXZlLmJpbmRpbmcgKSB7XG5cdFx0XHRcdFx0XHRlbGVtZW50Lm5vZGUuX3JhY3RpdmUuYmluZGluZy51cGRhdGUoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBhdHRyaWJ1dGVzLm5hbWUgJiYgIWF0dHJpYnV0ZXMubmFtZS50d293YXkgKSB7XG5cdFx0XHRcdFx0YXR0cmlidXRlcy5uYW1lLnVwZGF0ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggZWxlbWVudC5ub2RlLnRhZ05hbWUgPT09ICdJTUcnICYmICggKCB3aWR0aCA9IGVsZW1lbnQuYXR0cmlidXRlcy53aWR0aCApIHx8ICggaGVpZ2h0ID0gZWxlbWVudC5hdHRyaWJ1dGVzLmhlaWdodCApICkgKSB7XG5cdFx0XHRcdFx0ZWxlbWVudC5ub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdsb2FkJywgbG9hZEhhbmRsZXIgPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdGlmICggd2lkdGggKSB7XG5cdFx0XHRcdFx0XHRcdGVsZW1lbnQubm9kZS53aWR0aCA9IHdpZHRoLnZhbHVlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKCBoZWlnaHQgKSB7XG5cdFx0XHRcdFx0XHRcdGVsZW1lbnQubm9kZS5oZWlnaHQgPSBoZWlnaHQudmFsdWU7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRlbGVtZW50Lm5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2xvYWQnLCBsb2FkSGFuZGxlciwgZmFsc2UgKTtcblx0XHRcdFx0XHR9LCBmYWxzZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGRvY0ZyYWcuYXBwZW5kQ2hpbGQoIGVsZW1lbnQubm9kZSApO1xuXHRcdFx0XHRpZiAoIGRlc2NyaXB0b3IubyApIHtcblx0XHRcdFx0XHRkZWNvcmF0ZSggZGVzY3JpcHRvci5vLCByb290LCBlbGVtZW50ICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBkZXNjcmlwdG9yLnQxICkge1xuXHRcdFx0XHRcdGV4ZWN1dGVUcmFuc2l0aW9uKCBkZXNjcmlwdG9yLnQxLCByb290LCBlbGVtZW50LCB0cnVlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBlbGVtZW50Lm5vZGUudGFnTmFtZSA9PT0gJ09QVElPTicgKSB7XG5cdFx0XHRcdFx0aWYgKCBwTm9kZS50YWdOYW1lID09PSAnU0VMRUNUJyAmJiAoIHNlbGVjdEJpbmRpbmcgPSBwTm9kZS5fcmFjdGl2ZS5iaW5kaW5nICkgKSB7XG5cdFx0XHRcdFx0XHRzZWxlY3RCaW5kaW5nLmRlZmVyVXBkYXRlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICggZWxlbWVudC5ub2RlLl9yYWN0aXZlLnZhbHVlID09IHBOb2RlLl9yYWN0aXZlLnZhbHVlICkge1xuXHRcdFx0XHRcdFx0ZWxlbWVudC5ub2RlLnNlbGVjdGVkID0gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBlbGVtZW50Lm5vZGUuYXV0b2ZvY3VzICkge1xuXHRcdFx0XHRcdHJ1bmxvb3AuZm9jdXMoIGVsZW1lbnQubm9kZSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGVsZW1lbnQubGNOYW1lID09PSAnb3B0aW9uJyApIHtcblx0XHRcdFx0ZWxlbWVudC5zZWxlY3QgPSBmaW5kUGFyZW50U2VsZWN0KCBlbGVtZW50LnBhcmVudCApO1xuXHRcdFx0fVxuXHRcdFx0dXBkYXRlTGl2ZVF1ZXJpZXMoIGVsZW1lbnQgKTtcblx0XHR9O1xuXG5cdFx0ZnVuY3Rpb24gZmluZFBhcmVudFNlbGVjdCggZWxlbWVudCApIHtcblx0XHRcdGRvIHtcblx0XHRcdFx0aWYgKCBlbGVtZW50LmxjTmFtZSA9PT0gJ3NlbGVjdCcgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGVsZW1lbnQ7XG5cdFx0XHRcdH1cblx0XHRcdH0gd2hpbGUgKCBlbGVtZW50ID0gZWxlbWVudC5wYXJlbnQgKTtcblx0XHR9XG5cdH0oIGdsb2JhbF9ydW5sb29wLCBjb25maWdfdHlwZXMsIGNvbmZpZ19uYW1lc3BhY2VzLCB1dGlsc19jcmVhdGUsIHV0aWxzX2RlZmluZVByb3BlcnR5LCB1dGlsc193YXJuLCB1dGlsc19jcmVhdGVFbGVtZW50LCBzaGFyZWRfZ2V0SW5uZXJDb250ZXh0LCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9pbml0aWFsaXNlX2dldEVsZW1lbnROYW1lc3BhY2UsIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X2luaXRpYWxpc2VfY3JlYXRlRWxlbWVudEF0dHJpYnV0ZXMsIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X2luaXRpYWxpc2VfYXBwZW5kRWxlbWVudENoaWxkcmVuLCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9pbml0aWFsaXNlX2RlY29yYXRlX19kZWNvcmF0ZSwgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfaW5pdGlhbGlzZV9hZGRFdmVudFByb3hpZXNfX2FkZEV2ZW50UHJveGllcywgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfaW5pdGlhbGlzZV91cGRhdGVMaXZlUXVlcmllcywgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2V4ZWN1dGVUcmFuc2l0aW9uX19leGVjdXRlVHJhbnNpdGlvbiwgcmVuZGVyX0RvbUZyYWdtZW50X3NoYXJlZF9lbmZvcmNlQ2FzZSApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9wcm90b3R5cGVfdGVhcmRvd24gPSBmdW5jdGlvbiggcnVubG9vcCwgZXhlY3V0ZVRyYW5zaXRpb24gKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24gRWxlbWVudF9wcm90b3R5cGVfdGVhcmRvd24oIGRlc3Ryb3kgKSB7XG5cdFx0XHR2YXIgZXZlbnROYW1lLCBiaW5kaW5nLCBiaW5kaW5ncztcblx0XHRcdGlmICggZGVzdHJveSApIHtcblx0XHRcdFx0dGhpcy53aWxsRGV0YWNoID0gdHJ1ZTtcblx0XHRcdFx0cnVubG9vcC5kZXRhY2hXaGVuUmVhZHkoIHRoaXMgKTtcblx0XHRcdH1cblx0XHRcdGlmICggdGhpcy5mcmFnbWVudCApIHtcblx0XHRcdFx0dGhpcy5mcmFnbWVudC50ZWFyZG93biggZmFsc2UgKTtcblx0XHRcdH1cblx0XHRcdHdoaWxlICggdGhpcy5hdHRyaWJ1dGVzLmxlbmd0aCApIHtcblx0XHRcdFx0dGhpcy5hdHRyaWJ1dGVzLnBvcCgpLnRlYXJkb3duKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRoaXMubm9kZSApIHtcblx0XHRcdFx0Zm9yICggZXZlbnROYW1lIGluIHRoaXMubm9kZS5fcmFjdGl2ZS5ldmVudHMgKSB7XG5cdFx0XHRcdFx0dGhpcy5ub2RlLl9yYWN0aXZlLmV2ZW50c1sgZXZlbnROYW1lIF0udGVhcmRvd24oKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIGJpbmRpbmcgPSB0aGlzLm5vZGUuX3JhY3RpdmUuYmluZGluZyApIHtcblx0XHRcdFx0XHRiaW5kaW5nLnRlYXJkb3duKCk7XG5cdFx0XHRcdFx0YmluZGluZ3MgPSB0aGlzLnJvb3QuX3R3b3dheUJpbmRpbmdzWyBiaW5kaW5nLmF0dHIua2V5cGF0aCBdO1xuXHRcdFx0XHRcdGJpbmRpbmdzLnNwbGljZSggYmluZGluZ3MuaW5kZXhPZiggYmluZGluZyApLCAxICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICggdGhpcy5kZWNvcmF0b3IgKSB7XG5cdFx0XHRcdHRoaXMuZGVjb3JhdG9yLnRlYXJkb3duKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRoaXMuZGVzY3JpcHRvci50MiApIHtcblx0XHRcdFx0ZXhlY3V0ZVRyYW5zaXRpb24oIHRoaXMuZGVzY3JpcHRvci50MiwgdGhpcy5yb290LCB0aGlzLCBmYWxzZSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aGlzLmxpdmVRdWVyaWVzICkge1xuXHRcdFx0XHRyZW1vdmVGcm9tTGl2ZVF1ZXJpZXMoIHRoaXMgKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0ZnVuY3Rpb24gcmVtb3ZlRnJvbUxpdmVRdWVyaWVzKCBlbGVtZW50ICkge1xuXHRcdFx0dmFyIHF1ZXJ5LCBzZWxlY3RvciwgbWF0Y2hpbmdTdGF0aWNOb2RlcywgaSwgajtcblx0XHRcdGkgPSBlbGVtZW50LmxpdmVRdWVyaWVzLmxlbmd0aDtcblx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRxdWVyeSA9IGVsZW1lbnQubGl2ZVF1ZXJpZXNbIGkgXTtcblx0XHRcdFx0c2VsZWN0b3IgPSBxdWVyeS5zZWxlY3Rvcjtcblx0XHRcdFx0cXVlcnkuX3JlbW92ZSggZWxlbWVudC5ub2RlICk7XG5cdFx0XHRcdGlmICggZWxlbWVudC5tYXRjaGluZ1N0YXRpY05vZGVzICYmICggbWF0Y2hpbmdTdGF0aWNOb2RlcyA9IGVsZW1lbnQubWF0Y2hpbmdTdGF0aWNOb2Rlc1sgc2VsZWN0b3IgXSApICkge1xuXHRcdFx0XHRcdGogPSBtYXRjaGluZ1N0YXRpY05vZGVzLmxlbmd0aDtcblx0XHRcdFx0XHR3aGlsZSAoIGotLSApIHtcblx0XHRcdFx0XHRcdHF1ZXJ5LnJlbW92ZSggbWF0Y2hpbmdTdGF0aWNOb2Rlc1sgaiBdICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9KCBnbG9iYWxfcnVubG9vcCwgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2V4ZWN1dGVUcmFuc2l0aW9uX19leGVjdXRlVHJhbnNpdGlvbiApO1xuXG5cdHZhciBjb25maWdfdm9pZEVsZW1lbnROYW1lcyA9ICdhcmVhIGJhc2UgYnIgY29sIGNvbW1hbmQgZG9jdHlwZSBlbWJlZCBociBpbWcgaW5wdXQga2V5Z2VuIGxpbmsgbWV0YSBwYXJhbSBzb3VyY2UgdHJhY2sgd2JyJy5zcGxpdCggJyAnICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3Byb3RvdHlwZV90b1N0cmluZyA9IGZ1bmN0aW9uKCB2b2lkRWxlbWVudE5hbWVzLCBpc0FycmF5ICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIHN0ciwgaSwgbGVuLCBhdHRyU3RyO1xuXHRcdFx0c3RyID0gJzwnICsgKCB0aGlzLmRlc2NyaXB0b3IueSA/ICchZG9jdHlwZScgOiB0aGlzLmRlc2NyaXB0b3IuZSApO1xuXHRcdFx0bGVuID0gdGhpcy5hdHRyaWJ1dGVzLmxlbmd0aDtcblx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdGlmICggYXR0clN0ciA9IHRoaXMuYXR0cmlidXRlc1sgaSBdLnRvU3RyaW5nKCkgKSB7XG5cdFx0XHRcdFx0c3RyICs9ICcgJyArIGF0dHJTdHI7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICggdGhpcy5sY05hbWUgPT09ICdvcHRpb24nICYmIG9wdGlvbklzU2VsZWN0ZWQoIHRoaXMgKSApIHtcblx0XHRcdFx0c3RyICs9ICcgc2VsZWN0ZWQnO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aGlzLmxjTmFtZSA9PT0gJ2lucHV0JyAmJiBpbnB1dElzQ2hlY2tlZFJhZGlvKCB0aGlzICkgKSB7XG5cdFx0XHRcdHN0ciArPSAnIGNoZWNrZWQnO1xuXHRcdFx0fVxuXHRcdFx0c3RyICs9ICc+Jztcblx0XHRcdGlmICggdGhpcy5odG1sICkge1xuXHRcdFx0XHRzdHIgKz0gdGhpcy5odG1sO1xuXHRcdFx0fSBlbHNlIGlmICggdGhpcy5mcmFnbWVudCApIHtcblx0XHRcdFx0c3RyICs9IHRoaXMuZnJhZ21lbnQudG9TdHJpbmcoKTtcblx0XHRcdH1cblx0XHRcdGlmICggdm9pZEVsZW1lbnROYW1lcy5pbmRleE9mKCB0aGlzLmRlc2NyaXB0b3IuZSApID09PSAtMSApIHtcblx0XHRcdFx0c3RyICs9ICc8LycgKyB0aGlzLmRlc2NyaXB0b3IuZSArICc+Jztcblx0XHRcdH1cblx0XHRcdHRoaXMuc3RyaW5naWZ5aW5nID0gZmFsc2U7XG5cdFx0XHRyZXR1cm4gc3RyO1xuXHRcdH07XG5cblx0XHRmdW5jdGlvbiBvcHRpb25Jc1NlbGVjdGVkKCBlbGVtZW50ICkge1xuXHRcdFx0dmFyIG9wdGlvblZhbHVlLCBzZWxlY3RWYWx1ZUF0dHJpYnV0ZSwgc2VsZWN0VmFsdWVJbnRlcnBvbGF0b3IsIHNlbGVjdFZhbHVlLCBpO1xuXHRcdFx0b3B0aW9uVmFsdWUgPSBlbGVtZW50LmF0dHJpYnV0ZXMudmFsdWUudmFsdWU7XG5cdFx0XHRzZWxlY3RWYWx1ZUF0dHJpYnV0ZSA9IGVsZW1lbnQuc2VsZWN0LmF0dHJpYnV0ZXMudmFsdWU7XG5cdFx0XHRzZWxlY3RWYWx1ZUludGVycG9sYXRvciA9IHNlbGVjdFZhbHVlQXR0cmlidXRlLmludGVycG9sYXRvcjtcblx0XHRcdGlmICggIXNlbGVjdFZhbHVlSW50ZXJwb2xhdG9yICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRzZWxlY3RWYWx1ZSA9IGVsZW1lbnQucm9vdC5nZXQoIHNlbGVjdFZhbHVlSW50ZXJwb2xhdG9yLmtleXBhdGggfHwgc2VsZWN0VmFsdWVJbnRlcnBvbGF0b3IucmVmICk7XG5cdFx0XHRpZiAoIHNlbGVjdFZhbHVlID09IG9wdGlvblZhbHVlICkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICggZWxlbWVudC5zZWxlY3QuYXR0cmlidXRlcy5tdWx0aXBsZSAmJiBpc0FycmF5KCBzZWxlY3RWYWx1ZSApICkge1xuXHRcdFx0XHRpID0gc2VsZWN0VmFsdWUubGVuZ3RoO1xuXHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRpZiAoIHNlbGVjdFZhbHVlWyBpIF0gPT0gb3B0aW9uVmFsdWUgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRmdW5jdGlvbiBpbnB1dElzQ2hlY2tlZFJhZGlvKCBlbGVtZW50ICkge1xuXHRcdFx0dmFyIGF0dHJpYnV0ZXMsIHR5cGVBdHRyaWJ1dGUsIHZhbHVlQXR0cmlidXRlLCBuYW1lQXR0cmlidXRlO1xuXHRcdFx0YXR0cmlidXRlcyA9IGVsZW1lbnQuYXR0cmlidXRlcztcblx0XHRcdHR5cGVBdHRyaWJ1dGUgPSBhdHRyaWJ1dGVzLnR5cGU7XG5cdFx0XHR2YWx1ZUF0dHJpYnV0ZSA9IGF0dHJpYnV0ZXMudmFsdWU7XG5cdFx0XHRuYW1lQXR0cmlidXRlID0gYXR0cmlidXRlcy5uYW1lO1xuXHRcdFx0aWYgKCAhdHlwZUF0dHJpYnV0ZSB8fCB0eXBlQXR0cmlidXRlLnZhbHVlICE9PSAncmFkaW8nIHx8ICF2YWx1ZUF0dHJpYnV0ZSB8fCAhbmFtZUF0dHJpYnV0ZS5pbnRlcnBvbGF0b3IgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggdmFsdWVBdHRyaWJ1dGUudmFsdWUgPT09IG5hbWVBdHRyaWJ1dGUuaW50ZXJwb2xhdG9yLnZhbHVlICkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cdH0oIGNvbmZpZ192b2lkRWxlbWVudE5hbWVzLCB1dGlsc19pc0FycmF5ICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3Byb3RvdHlwZV9maW5kID0gZnVuY3Rpb24oIG1hdGNoZXMgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHNlbGVjdG9yICkge1xuXHRcdFx0dmFyIHF1ZXJ5UmVzdWx0O1xuXHRcdFx0aWYgKCBtYXRjaGVzKCB0aGlzLm5vZGUsIHNlbGVjdG9yICkgKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLm5vZGU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRoaXMuaHRtbCAmJiAoIHF1ZXJ5UmVzdWx0ID0gdGhpcy5ub2RlLnF1ZXJ5U2VsZWN0b3IoIHNlbGVjdG9yICkgKSApIHtcblx0XHRcdFx0cmV0dXJuIHF1ZXJ5UmVzdWx0O1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aGlzLmZyYWdtZW50ICYmIHRoaXMuZnJhZ21lbnQuZmluZCApIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuZnJhZ21lbnQuZmluZCggc2VsZWN0b3IgKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9KCB1dGlsc19tYXRjaGVzICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3Byb3RvdHlwZV9maW5kQWxsID0gZnVuY3Rpb24oIGdldE1hdGNoaW5nU3RhdGljTm9kZXMgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHNlbGVjdG9yLCBxdWVyeSApIHtcblx0XHRcdHZhciBtYXRjaGluZ1N0YXRpY05vZGVzLCBtYXRjaGVkU2VsZjtcblx0XHRcdGlmICggcXVlcnkuX3Rlc3QoIHRoaXMsIHRydWUgKSAmJiBxdWVyeS5saXZlICkge1xuXHRcdFx0XHQoIHRoaXMubGl2ZVF1ZXJpZXMgfHwgKCB0aGlzLmxpdmVRdWVyaWVzID0gW10gKSApLnB1c2goIHF1ZXJ5ICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRoaXMuaHRtbCApIHtcblx0XHRcdFx0bWF0Y2hpbmdTdGF0aWNOb2RlcyA9IGdldE1hdGNoaW5nU3RhdGljTm9kZXMoIHRoaXMsIHNlbGVjdG9yICk7XG5cdFx0XHRcdHF1ZXJ5LnB1c2guYXBwbHkoIHF1ZXJ5LCBtYXRjaGluZ1N0YXRpY05vZGVzICk7XG5cdFx0XHRcdGlmICggcXVlcnkubGl2ZSAmJiAhbWF0Y2hlZFNlbGYgKSB7XG5cdFx0XHRcdFx0KCB0aGlzLmxpdmVRdWVyaWVzIHx8ICggdGhpcy5saXZlUXVlcmllcyA9IFtdICkgKS5wdXNoKCBxdWVyeSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRoaXMuZnJhZ21lbnQgKSB7XG5cdFx0XHRcdHRoaXMuZnJhZ21lbnQuZmluZEFsbCggc2VsZWN0b3IsIHF1ZXJ5ICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fSggcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2dldE1hdGNoaW5nU3RhdGljTm9kZXMgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfcHJvdG90eXBlX2ZpbmRDb21wb25lbnQgPSBmdW5jdGlvbiggc2VsZWN0b3IgKSB7XG5cdFx0aWYgKCB0aGlzLmZyYWdtZW50ICkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZnJhZ21lbnQuZmluZENvbXBvbmVudCggc2VsZWN0b3IgKTtcblx0XHR9XG5cdH07XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3Byb3RvdHlwZV9maW5kQWxsQ29tcG9uZW50cyA9IGZ1bmN0aW9uKCBzZWxlY3RvciwgcXVlcnkgKSB7XG5cdFx0aWYgKCB0aGlzLmZyYWdtZW50ICkge1xuXHRcdFx0dGhpcy5mcmFnbWVudC5maW5kQWxsQ29tcG9uZW50cyggc2VsZWN0b3IsIHF1ZXJ5ICk7XG5cdFx0fVxuXHR9O1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9wcm90b3R5cGVfYmluZCA9IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBhdHRyaWJ1dGVzID0gdGhpcy5hdHRyaWJ1dGVzO1xuXHRcdGlmICggIXRoaXMubm9kZSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCB0aGlzLmJpbmRpbmcgKSB7XG5cdFx0XHR0aGlzLmJpbmRpbmcudGVhcmRvd24oKTtcblx0XHRcdHRoaXMuYmluZGluZyA9IG51bGw7XG5cdFx0fVxuXHRcdGlmICggdGhpcy5ub2RlLmdldEF0dHJpYnV0ZSggJ2NvbnRlbnRlZGl0YWJsZScgKSAmJiBhdHRyaWJ1dGVzLnZhbHVlICYmIGF0dHJpYnV0ZXMudmFsdWUuYmluZCgpICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRzd2l0Y2ggKCB0aGlzLmRlc2NyaXB0b3IuZSApIHtcblx0XHRcdGNhc2UgJ3NlbGVjdCc6XG5cdFx0XHRjYXNlICd0ZXh0YXJlYSc6XG5cdFx0XHRcdGlmICggYXR0cmlidXRlcy52YWx1ZSApIHtcblx0XHRcdFx0XHRhdHRyaWJ1dGVzLnZhbHVlLmJpbmQoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHRjYXNlICdpbnB1dCc6XG5cdFx0XHRcdGlmICggdGhpcy5ub2RlLnR5cGUgPT09ICdyYWRpbycgfHwgdGhpcy5ub2RlLnR5cGUgPT09ICdjaGVja2JveCcgKSB7XG5cdFx0XHRcdFx0aWYgKCBhdHRyaWJ1dGVzLm5hbWUgJiYgYXR0cmlidXRlcy5uYW1lLmJpbmQoKSApIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCBhdHRyaWJ1dGVzLmNoZWNrZWQgJiYgYXR0cmlidXRlcy5jaGVja2VkLmJpbmQoKSApIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBhdHRyaWJ1dGVzLnZhbHVlICYmIGF0dHJpYnV0ZXMudmFsdWUuYmluZCgpICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdH1cblx0fTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfX0VsZW1lbnQgPSBmdW5jdGlvbiggcnVubG9vcCwgY3NzLCBpbml0aWFsaXNlLCB0ZWFyZG93biwgdG9TdHJpbmcsIGZpbmQsIGZpbmRBbGwsIGZpbmRDb21wb25lbnQsIGZpbmRBbGxDb21wb25lbnRzLCBiaW5kICkge1xuXG5cdFx0dmFyIERvbUVsZW1lbnQgPSBmdW5jdGlvbiggb3B0aW9ucywgZG9jRnJhZyApIHtcblx0XHRcdGluaXRpYWxpc2UoIHRoaXMsIG9wdGlvbnMsIGRvY0ZyYWcgKTtcblx0XHR9O1xuXHRcdERvbUVsZW1lbnQucHJvdG90eXBlID0ge1xuXHRcdFx0ZGV0YWNoOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIENvbXBvbmVudDtcblx0XHRcdFx0aWYgKCB0aGlzLm5vZGUgKSB7XG5cdFx0XHRcdFx0aWYgKCB0aGlzLm5vZGUucGFyZW50Tm9kZSApIHtcblx0XHRcdFx0XHRcdHRoaXMubm9kZS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKCB0aGlzLm5vZGUgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMubm9kZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHRoaXMuY3NzRGV0YWNoUXVldWUubGVuZ3RoICkge1xuXHRcdFx0XHRcdHJ1bmxvb3Auc3RhcnQoKTtcblx0XHRcdFx0XHR3aGlsZSAoIENvbXBvbmVudCA9PT0gdGhpcy5jc3NEZXRhY2hRdWV1ZS5wb3AoKSApIHtcblx0XHRcdFx0XHRcdGNzcy5yZW1vdmUoIENvbXBvbmVudCApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRydW5sb29wLmVuZCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IHRlYXJkb3duLFxuXHRcdFx0Zmlyc3ROb2RlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMubm9kZTtcblx0XHRcdH0sXG5cdFx0XHRmaW5kTmV4dE5vZGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH0sXG5cdFx0XHRidWJibGU6IGZ1bmN0aW9uKCkge30sXG5cdFx0XHR0b1N0cmluZzogdG9TdHJpbmcsXG5cdFx0XHRmaW5kOiBmaW5kLFxuXHRcdFx0ZmluZEFsbDogZmluZEFsbCxcblx0XHRcdGZpbmRDb21wb25lbnQ6IGZpbmRDb21wb25lbnQsXG5cdFx0XHRmaW5kQWxsQ29tcG9uZW50czogZmluZEFsbENvbXBvbmVudHMsXG5cdFx0XHRiaW5kOiBiaW5kXG5cdFx0fTtcblx0XHRyZXR1cm4gRG9tRWxlbWVudDtcblx0fSggZ2xvYmFsX3J1bmxvb3AsIGdsb2JhbF9jc3MsIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X2luaXRpYWxpc2VfX2luaXRpYWxpc2UsIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3Byb3RvdHlwZV90ZWFyZG93biwgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfcHJvdG90eXBlX3RvU3RyaW5nLCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9wcm90b3R5cGVfZmluZCwgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfcHJvdG90eXBlX2ZpbmRBbGwsIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3Byb3RvdHlwZV9maW5kQ29tcG9uZW50LCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9wcm90b3R5cGVfZmluZEFsbENvbXBvbmVudHMsIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3Byb3RvdHlwZV9iaW5kICk7XG5cblx0dmFyIGNvbmZpZ19lcnJvcnMgPSB7XG5cdFx0bWlzc2luZ1BhcnNlcjogJ01pc3NpbmcgUmFjdGl2ZS5wYXJzZSAtIGNhbm5vdCBwYXJzZSB0ZW1wbGF0ZS4gRWl0aGVyIHByZXBhcnNlIG9yIHVzZSB0aGUgdmVyc2lvbiB0aGF0IGluY2x1ZGVzIHRoZSBwYXJzZXInXG5cdH07XG5cblx0dmFyIHJlZ2lzdHJpZXNfcGFydGlhbHMgPSB7fTtcblxuXHR2YXIgcGFyc2VfdXRpbHNfc3RyaXBIdG1sQ29tbWVudHMgPSBmdW5jdGlvbiggaHRtbCApIHtcblx0XHR2YXIgY29tbWVudFN0YXJ0LCBjb21tZW50RW5kLCBwcm9jZXNzZWQ7XG5cdFx0cHJvY2Vzc2VkID0gJyc7XG5cdFx0d2hpbGUgKCBodG1sLmxlbmd0aCApIHtcblx0XHRcdGNvbW1lbnRTdGFydCA9IGh0bWwuaW5kZXhPZiggJzwhLS0nICk7XG5cdFx0XHRjb21tZW50RW5kID0gaHRtbC5pbmRleE9mKCAnLS0+JyApO1xuXHRcdFx0aWYgKCBjb21tZW50U3RhcnQgPT09IC0xICYmIGNvbW1lbnRFbmQgPT09IC0xICkge1xuXHRcdFx0XHRwcm9jZXNzZWQgKz0gaHRtbDtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGNvbW1lbnRTdGFydCAhPT0gLTEgJiYgY29tbWVudEVuZCA9PT0gLTEgKSB7XG5cdFx0XHRcdHRocm93ICdJbGxlZ2FsIEhUTUwgLSBleHBlY3RlZCBjbG9zaW5nIGNvbW1lbnQgc2VxdWVuY2UgKFxcJy0tPlxcJyknO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBjb21tZW50RW5kICE9PSAtMSAmJiBjb21tZW50U3RhcnQgPT09IC0xIHx8IGNvbW1lbnRFbmQgPCBjb21tZW50U3RhcnQgKSB7XG5cdFx0XHRcdHRocm93ICdJbGxlZ2FsIEhUTUwgLSB1bmV4cGVjdGVkIGNsb3NpbmcgY29tbWVudCBzZXF1ZW5jZSAoXFwnLS0+XFwnKSc7XG5cdFx0XHR9XG5cdFx0XHRwcm9jZXNzZWQgKz0gaHRtbC5zdWJzdHIoIDAsIGNvbW1lbnRTdGFydCApO1xuXHRcdFx0aHRtbCA9IGh0bWwuc3Vic3RyaW5nKCBjb21tZW50RW5kICsgMyApO1xuXHRcdH1cblx0XHRyZXR1cm4gcHJvY2Vzc2VkO1xuXHR9O1xuXG5cdHZhciBwYXJzZV91dGlsc19zdHJpcFN0YW5kYWxvbmVzID0gZnVuY3Rpb24oIHR5cGVzICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB0b2tlbnMgKSB7XG5cdFx0XHR2YXIgaSwgY3VycmVudCwgYmFja09uZSwgYmFja1R3bywgbGVhZGluZ0xpbmVicmVhaywgdHJhaWxpbmdMaW5lYnJlYWs7XG5cdFx0XHRsZWFkaW5nTGluZWJyZWFrID0gL15cXHMqXFxyP1xcbi87XG5cdFx0XHR0cmFpbGluZ0xpbmVicmVhayA9IC9cXHI/XFxuXFxzKiQvO1xuXHRcdFx0Zm9yICggaSA9IDI7IGkgPCB0b2tlbnMubGVuZ3RoOyBpICs9IDEgKSB7XG5cdFx0XHRcdGN1cnJlbnQgPSB0b2tlbnNbIGkgXTtcblx0XHRcdFx0YmFja09uZSA9IHRva2Vuc1sgaSAtIDEgXTtcblx0XHRcdFx0YmFja1R3byA9IHRva2Vuc1sgaSAtIDIgXTtcblx0XHRcdFx0aWYgKCBjdXJyZW50LnR5cGUgPT09IHR5cGVzLlRFWFQgJiYgKCBiYWNrT25lLnR5cGUgPT09IHR5cGVzLk1VU1RBQ0hFICYmIGJhY2tPbmUubXVzdGFjaGVUeXBlICE9PSB0eXBlcy5QQVJUSUFMICkgJiYgYmFja1R3by50eXBlID09PSB0eXBlcy5URVhUICkge1xuXHRcdFx0XHRcdGlmICggdHJhaWxpbmdMaW5lYnJlYWsudGVzdCggYmFja1R3by52YWx1ZSApICYmIGxlYWRpbmdMaW5lYnJlYWsudGVzdCggY3VycmVudC52YWx1ZSApICkge1xuXHRcdFx0XHRcdFx0aWYgKCBiYWNrT25lLm11c3RhY2hlVHlwZSAhPT0gdHlwZXMuSU5URVJQT0xBVE9SICYmIGJhY2tPbmUubXVzdGFjaGVUeXBlICE9PSB0eXBlcy5UUklQTEUgKSB7XG5cdFx0XHRcdFx0XHRcdGJhY2tUd28udmFsdWUgPSBiYWNrVHdvLnZhbHVlLnJlcGxhY2UoIHRyYWlsaW5nTGluZWJyZWFrLCAnXFxuJyApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y3VycmVudC52YWx1ZSA9IGN1cnJlbnQudmFsdWUucmVwbGFjZSggbGVhZGluZ0xpbmVicmVhaywgJycgKTtcblx0XHRcdFx0XHRcdGlmICggY3VycmVudC52YWx1ZSA9PT0gJycgKSB7XG5cdFx0XHRcdFx0XHRcdHRva2Vucy5zcGxpY2UoIGktLSwgMSApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRva2Vucztcblx0XHR9O1xuXHR9KCBjb25maWdfdHlwZXMgKTtcblxuXHR2YXIgcGFyc2VfdXRpbHNfc3RyaXBDb21tZW50VG9rZW5zID0gZnVuY3Rpb24oIHR5cGVzICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB0b2tlbnMgKSB7XG5cdFx0XHR2YXIgaSwgY3VycmVudCwgcHJldmlvdXMsIG5leHQ7XG5cdFx0XHRmb3IgKCBpID0gMDsgaSA8IHRva2Vucy5sZW5ndGg7IGkgKz0gMSApIHtcblx0XHRcdFx0Y3VycmVudCA9IHRva2Vuc1sgaSBdO1xuXHRcdFx0XHRwcmV2aW91cyA9IHRva2Vuc1sgaSAtIDEgXTtcblx0XHRcdFx0bmV4dCA9IHRva2Vuc1sgaSArIDEgXTtcblx0XHRcdFx0aWYgKCBjdXJyZW50Lm11c3RhY2hlVHlwZSA9PT0gdHlwZXMuQ09NTUVOVCB8fCBjdXJyZW50Lm11c3RhY2hlVHlwZSA9PT0gdHlwZXMuREVMSU1DSEFOR0UgKSB7XG5cdFx0XHRcdFx0dG9rZW5zLnNwbGljZSggaSwgMSApO1xuXHRcdFx0XHRcdGlmICggcHJldmlvdXMgJiYgbmV4dCApIHtcblx0XHRcdFx0XHRcdGlmICggcHJldmlvdXMudHlwZSA9PT0gdHlwZXMuVEVYVCAmJiBuZXh0LnR5cGUgPT09IHR5cGVzLlRFWFQgKSB7XG5cdFx0XHRcdFx0XHRcdHByZXZpb3VzLnZhbHVlICs9IG5leHQudmFsdWU7XG5cdFx0XHRcdFx0XHRcdHRva2Vucy5zcGxpY2UoIGksIDEgKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aSAtPSAxO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdG9rZW5zO1xuXHRcdH07XG5cdH0oIGNvbmZpZ190eXBlcyApO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfZ2V0TXVzdGFjaGVfZ2V0RGVsaW1pdGVyQ2hhbmdlID0gZnVuY3Rpb24oIG1ha2VSZWdleE1hdGNoZXIgKSB7XG5cblx0XHR2YXIgZ2V0RGVsaW1pdGVyID0gbWFrZVJlZ2V4TWF0Y2hlciggL15bXlxccz1dKy8gKTtcblx0XHRyZXR1cm4gZnVuY3Rpb24oIHRva2VuaXplciApIHtcblx0XHRcdHZhciBzdGFydCwgb3BlbmluZywgY2xvc2luZztcblx0XHRcdGlmICggIXRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJz0nICkgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0c3RhcnQgPSB0b2tlbml6ZXIucG9zO1xuXHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0b3BlbmluZyA9IGdldERlbGltaXRlciggdG9rZW5pemVyICk7XG5cdFx0XHRpZiAoICFvcGVuaW5nICkge1xuXHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0Y2xvc2luZyA9IGdldERlbGltaXRlciggdG9rZW5pemVyICk7XG5cdFx0XHRpZiAoICFjbG9zaW5nICkge1xuXHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0aWYgKCAhdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnPScgKSApIHtcblx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHJldHVybiBbXG5cdFx0XHRcdG9wZW5pbmcsXG5cdFx0XHRcdGNsb3Npbmdcblx0XHRcdF07XG5cdFx0fTtcblx0fSggcGFyc2VfVG9rZW5pemVyX3V0aWxzX21ha2VSZWdleE1hdGNoZXIgKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX2dldE11c3RhY2hlX2dldE11c3RhY2hlVHlwZSA9IGZ1bmN0aW9uKCB0eXBlcyApIHtcblxuXHRcdHZhciBtdXN0YWNoZVR5cGVzID0ge1xuXHRcdFx0JyMnOiB0eXBlcy5TRUNUSU9OLFxuXHRcdFx0J14nOiB0eXBlcy5JTlZFUlRFRCxcblx0XHRcdCcvJzogdHlwZXMuQ0xPU0lORyxcblx0XHRcdCc+JzogdHlwZXMuUEFSVElBTCxcblx0XHRcdCchJzogdHlwZXMuQ09NTUVOVCxcblx0XHRcdCcmJzogdHlwZXMuVFJJUExFXG5cdFx0fTtcblx0XHRyZXR1cm4gZnVuY3Rpb24oIHRva2VuaXplciApIHtcblx0XHRcdHZhciB0eXBlID0gbXVzdGFjaGVUeXBlc1sgdG9rZW5pemVyLnN0ci5jaGFyQXQoIHRva2VuaXplci5wb3MgKSBdO1xuXHRcdFx0aWYgKCAhdHlwZSApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHR0b2tlbml6ZXIucG9zICs9IDE7XG5cdFx0XHRyZXR1cm4gdHlwZTtcblx0XHR9O1xuXHR9KCBjb25maWdfdHlwZXMgKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX2dldE11c3RhY2hlX2dldE11c3RhY2hlQ29udGVudCA9IGZ1bmN0aW9uKCB0eXBlcywgbWFrZVJlZ2V4TWF0Y2hlciwgZ2V0TXVzdGFjaGVUeXBlICkge1xuXG5cdFx0dmFyIGdldEluZGV4UmVmID0gbWFrZVJlZ2V4TWF0Y2hlciggL15cXHMqOlxccyooW2EtekEtWl8kXVthLXpBLVpfJDAtOV0qKS8gKSxcblx0XHRcdGFycmF5TWVtYmVyID0gL15bMC05XVsxLTldKiQvO1xuXHRcdHJldHVybiBmdW5jdGlvbiggdG9rZW5pemVyLCBpc1RyaXBsZSApIHtcblx0XHRcdHZhciBzdGFydCwgbXVzdGFjaGUsIHR5cGUsIGV4cHIsIGksIHJlbWFpbmluZywgaW5kZXgsIGRlbGltaXRlcjtcblx0XHRcdHN0YXJ0ID0gdG9rZW5pemVyLnBvcztcblx0XHRcdG11c3RhY2hlID0ge1xuXHRcdFx0XHR0eXBlOiBpc1RyaXBsZSA/IHR5cGVzLlRSSVBMRSA6IHR5cGVzLk1VU1RBQ0hFXG5cdFx0XHR9O1xuXHRcdFx0aWYgKCAhaXNUcmlwbGUgKSB7XG5cdFx0XHRcdGlmICggZXhwciA9IHRva2VuaXplci5nZXRFeHByZXNzaW9uKCkgKSB7XG5cdFx0XHRcdFx0bXVzdGFjaGUubXVzdGFjaGVUeXBlID0gdHlwZXMuSU5URVJQT0xBVE9SO1xuXHRcdFx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdFx0XHRpZiAoIHRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggdG9rZW5pemVyLmRlbGltaXRlcnNbIDEgXSApICkge1xuXHRcdFx0XHRcdFx0dG9rZW5pemVyLnBvcyAtPSB0b2tlbml6ZXIuZGVsaW1pdGVyc1sgMSBdLmxlbmd0aDtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRcdFx0ZXhwciA9IG51bGw7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggIWV4cHIgKSB7XG5cdFx0XHRcdFx0dHlwZSA9IGdldE11c3RhY2hlVHlwZSggdG9rZW5pemVyICk7XG5cdFx0XHRcdFx0aWYgKCB0eXBlID09PSB0eXBlcy5UUklQTEUgKSB7XG5cdFx0XHRcdFx0XHRtdXN0YWNoZSA9IHtcblx0XHRcdFx0XHRcdFx0dHlwZTogdHlwZXMuVFJJUExFXG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRtdXN0YWNoZS5tdXN0YWNoZVR5cGUgPSB0eXBlIHx8IHR5cGVzLklOVEVSUE9MQVRPUjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCB0eXBlID09PSB0eXBlcy5DT01NRU5UIHx8IHR5cGUgPT09IHR5cGVzLkNMT1NJTkcgKSB7XG5cdFx0XHRcdFx0XHRyZW1haW5pbmcgPSB0b2tlbml6ZXIucmVtYWluaW5nKCk7XG5cdFx0XHRcdFx0XHRpbmRleCA9IHJlbWFpbmluZy5pbmRleE9mKCB0b2tlbml6ZXIuZGVsaW1pdGVyc1sgMSBdICk7XG5cdFx0XHRcdFx0XHRpZiAoIGluZGV4ICE9PSAtMSApIHtcblx0XHRcdFx0XHRcdFx0bXVzdGFjaGUucmVmID0gcmVtYWluaW5nLnN1YnN0ciggMCwgaW5kZXggKTtcblx0XHRcdFx0XHRcdFx0dG9rZW5pemVyLnBvcyArPSBpbmRleDtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIG11c3RhY2hlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCAhZXhwciApIHtcblx0XHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0XHRleHByID0gdG9rZW5pemVyLmdldEV4cHJlc3Npb24oKTtcblx0XHRcdFx0cmVtYWluaW5nID0gdG9rZW5pemVyLnJlbWFpbmluZygpO1xuXHRcdFx0XHRkZWxpbWl0ZXIgPSBpc1RyaXBsZSA/IHRva2VuaXplci50cmlwbGVEZWxpbWl0ZXJzWyAxIF0gOiB0b2tlbml6ZXIuZGVsaW1pdGVyc1sgMSBdO1xuXHRcdFx0XHRpZiAoIHJlbWFpbmluZy5zdWJzdHIoIDAsIGRlbGltaXRlci5sZW5ndGggKSAhPT0gZGVsaW1pdGVyICYmIHJlbWFpbmluZy5jaGFyQXQoIDAgKSAhPT0gJzonICkge1xuXHRcdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0XHRyZW1haW5pbmcgPSB0b2tlbml6ZXIucmVtYWluaW5nKCk7XG5cdFx0XHRcdFx0aW5kZXggPSByZW1haW5pbmcuaW5kZXhPZiggdG9rZW5pemVyLmRlbGltaXRlcnNbIDEgXSApO1xuXHRcdFx0XHRcdGlmICggaW5kZXggIT09IC0xICkge1xuXHRcdFx0XHRcdFx0bXVzdGFjaGUucmVmID0gcmVtYWluaW5nLnN1YnN0ciggMCwgaW5kZXggKS50cmltKCk7XG5cdFx0XHRcdFx0XHR0b2tlbml6ZXIucG9zICs9IGluZGV4O1xuXHRcdFx0XHRcdFx0cmV0dXJuIG11c3RhY2hlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0d2hpbGUgKCBleHByLnQgPT09IHR5cGVzLkJSQUNLRVRFRCAmJiBleHByLnggKSB7XG5cdFx0XHRcdGV4cHIgPSBleHByLng7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGV4cHIudCA9PT0gdHlwZXMuUkVGRVJFTkNFICkge1xuXHRcdFx0XHRtdXN0YWNoZS5yZWYgPSBleHByLm47XG5cdFx0XHR9IGVsc2UgaWYgKCBleHByLnQgPT09IHR5cGVzLk5VTUJFUl9MSVRFUkFMICYmIGFycmF5TWVtYmVyLnRlc3QoIGV4cHIudiApICkge1xuXHRcdFx0XHRtdXN0YWNoZS5yZWYgPSBleHByLnY7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRtdXN0YWNoZS5leHByZXNzaW9uID0gZXhwcjtcblx0XHRcdH1cblx0XHRcdGkgPSBnZXRJbmRleFJlZiggdG9rZW5pemVyICk7XG5cdFx0XHRpZiAoIGkgIT09IG51bGwgKSB7XG5cdFx0XHRcdG11c3RhY2hlLmluZGV4UmVmID0gaTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBtdXN0YWNoZTtcblx0XHR9O1xuXHR9KCBjb25maWdfdHlwZXMsIHBhcnNlX1Rva2VuaXplcl91dGlsc19tYWtlUmVnZXhNYXRjaGVyLCBwYXJzZV9Ub2tlbml6ZXJfZ2V0TXVzdGFjaGVfZ2V0TXVzdGFjaGVUeXBlICk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9nZXRNdXN0YWNoZV9fZ2V0TXVzdGFjaGUgPSBmdW5jdGlvbiggdHlwZXMsIGdldERlbGltaXRlckNoYW5nZSwgZ2V0TXVzdGFjaGVDb250ZW50ICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIHNlZWtUcmlwbGVGaXJzdCA9IHRoaXMudHJpcGxlRGVsaW1pdGVyc1sgMCBdLmxlbmd0aCA+IHRoaXMuZGVsaW1pdGVyc1sgMCBdLmxlbmd0aDtcblx0XHRcdHJldHVybiBnZXRNdXN0YWNoZSggdGhpcywgc2Vla1RyaXBsZUZpcnN0ICkgfHwgZ2V0TXVzdGFjaGUoIHRoaXMsICFzZWVrVHJpcGxlRmlyc3QgKTtcblx0XHR9O1xuXG5cdFx0ZnVuY3Rpb24gZ2V0TXVzdGFjaGUoIHRva2VuaXplciwgc2Vla1RyaXBsZSApIHtcblx0XHRcdHZhciBzdGFydCA9IHRva2VuaXplci5wb3MsXG5cdFx0XHRcdGNvbnRlbnQsIGRlbGltaXRlcnM7XG5cdFx0XHRkZWxpbWl0ZXJzID0gc2Vla1RyaXBsZSA/IHRva2VuaXplci50cmlwbGVEZWxpbWl0ZXJzIDogdG9rZW5pemVyLmRlbGltaXRlcnM7XG5cdFx0XHRpZiAoICF0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goIGRlbGltaXRlcnNbIDAgXSApICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGNvbnRlbnQgPSBnZXREZWxpbWl0ZXJDaGFuZ2UoIHRva2VuaXplciApO1xuXHRcdFx0aWYgKCBjb250ZW50ICkge1xuXHRcdFx0XHRpZiAoICF0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goIGRlbGltaXRlcnNbIDEgXSApICkge1xuXHRcdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHR0b2tlbml6ZXJbIHNlZWtUcmlwbGUgPyAndHJpcGxlRGVsaW1pdGVycycgOiAnZGVsaW1pdGVycycgXSA9IGNvbnRlbnQ7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0dHlwZTogdHlwZXMuTVVTVEFDSEUsXG5cdFx0XHRcdFx0bXVzdGFjaGVUeXBlOiB0eXBlcy5ERUxJTUNIQU5HRVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0Y29udGVudCA9IGdldE11c3RhY2hlQ29udGVudCggdG9rZW5pemVyLCBzZWVrVHJpcGxlICk7XG5cdFx0XHRpZiAoIGNvbnRlbnQgPT09IG51bGwgKSB7XG5cdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRpZiAoICF0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goIGRlbGltaXRlcnNbIDEgXSApICkge1xuXHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGNvbnRlbnQ7XG5cdFx0fVxuXHR9KCBjb25maWdfdHlwZXMsIHBhcnNlX1Rva2VuaXplcl9nZXRNdXN0YWNoZV9nZXREZWxpbWl0ZXJDaGFuZ2UsIHBhcnNlX1Rva2VuaXplcl9nZXRNdXN0YWNoZV9nZXRNdXN0YWNoZUNvbnRlbnQgKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX2dldENvbW1lbnRfZ2V0Q29tbWVudCA9IGZ1bmN0aW9uKCB0eXBlcyApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBjb250ZW50LCByZW1haW5pbmcsIGVuZEluZGV4O1xuXHRcdFx0aWYgKCAhdGhpcy5nZXRTdHJpbmdNYXRjaCggJzwhLS0nICkgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0cmVtYWluaW5nID0gdGhpcy5yZW1haW5pbmcoKTtcblx0XHRcdGVuZEluZGV4ID0gcmVtYWluaW5nLmluZGV4T2YoICctLT4nICk7XG5cdFx0XHRpZiAoIGVuZEluZGV4ID09PSAtMSApIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnVW5leHBlY3RlZCBlbmQgb2YgaW5wdXQgKGV4cGVjdGVkIFwiLS0+XCIgdG8gY2xvc2UgY29tbWVudCknICk7XG5cdFx0XHR9XG5cdFx0XHRjb250ZW50ID0gcmVtYWluaW5nLnN1YnN0ciggMCwgZW5kSW5kZXggKTtcblx0XHRcdHRoaXMucG9zICs9IGVuZEluZGV4ICsgMztcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHR5cGU6IHR5cGVzLkNPTU1FTlQsXG5cdFx0XHRcdGNvbnRlbnQ6IGNvbnRlbnRcblx0XHRcdH07XG5cdFx0fTtcblx0fSggY29uZmlnX3R5cGVzICk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl91dGlsc19nZXRMb3dlc3RJbmRleCA9IGZ1bmN0aW9uKCBoYXlzdGFjaywgbmVlZGxlcyApIHtcblx0XHR2YXIgaSwgaW5kZXgsIGxvd2VzdDtcblx0XHRpID0gbmVlZGxlcy5sZW5ndGg7XG5cdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRpbmRleCA9IGhheXN0YWNrLmluZGV4T2YoIG5lZWRsZXNbIGkgXSApO1xuXHRcdFx0aWYgKCAhaW5kZXggKSB7XG5cdFx0XHRcdHJldHVybiAwO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBpbmRleCA9PT0gLTEgKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhbG93ZXN0IHx8IGluZGV4IDwgbG93ZXN0ICkge1xuXHRcdFx0XHRsb3dlc3QgPSBpbmRleDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGxvd2VzdCB8fCAtMTtcblx0fTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX2dldFRhZ19fZ2V0VGFnID0gZnVuY3Rpb24oIHR5cGVzLCBtYWtlUmVnZXhNYXRjaGVyLCBnZXRMb3dlc3RJbmRleCApIHtcblxuXHRcdHZhciBnZXRUYWcsIGdldE9wZW5pbmdUYWcsIGdldENsb3NpbmdUYWcsIGdldFRhZ05hbWUsIGdldEF0dHJpYnV0ZXMsIGdldEF0dHJpYnV0ZSwgZ2V0QXR0cmlidXRlTmFtZSwgZ2V0QXR0cmlidXRlVmFsdWUsIGdldFVucXVvdGVkQXR0cmlidXRlVmFsdWUsIGdldFVucXVvdGVkQXR0cmlidXRlVmFsdWVUb2tlbiwgZ2V0VW5xdW90ZWRBdHRyaWJ1dGVWYWx1ZVRleHQsIGdldFF1b3RlZFN0cmluZ1Rva2VuLCBnZXRRdW90ZWRBdHRyaWJ1dGVWYWx1ZTtcblx0XHRnZXRUYWcgPSBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiBnZXRPcGVuaW5nVGFnKCB0aGlzICkgfHwgZ2V0Q2xvc2luZ1RhZyggdGhpcyApO1xuXHRcdH07XG5cdFx0Z2V0T3BlbmluZ1RhZyA9IGZ1bmN0aW9uKCB0b2tlbml6ZXIgKSB7XG5cdFx0XHR2YXIgc3RhcnQsIHRhZywgYXR0cnMsIGxvd2VyQ2FzZU5hbWU7XG5cdFx0XHRzdGFydCA9IHRva2VuaXplci5wb3M7XG5cdFx0XHRpZiAoIHRva2VuaXplci5pbnNpZGUgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnPCcgKSApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHR0YWcgPSB7XG5cdFx0XHRcdHR5cGU6IHR5cGVzLlRBR1xuXHRcdFx0fTtcblx0XHRcdGlmICggdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnIScgKSApIHtcblx0XHRcdFx0dGFnLmRvY3R5cGUgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0dGFnLm5hbWUgPSBnZXRUYWdOYW1lKCB0b2tlbml6ZXIgKTtcblx0XHRcdGlmICggIXRhZy5uYW1lICkge1xuXHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0YXR0cnMgPSBnZXRBdHRyaWJ1dGVzKCB0b2tlbml6ZXIgKTtcblx0XHRcdGlmICggYXR0cnMgKSB7XG5cdFx0XHRcdHRhZy5hdHRycyA9IGF0dHJzO1xuXHRcdFx0fVxuXHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0aWYgKCB0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICcvJyApICkge1xuXHRcdFx0XHR0YWcuc2VsZkNsb3NpbmcgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnPicgKSApIHtcblx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGxvd2VyQ2FzZU5hbWUgPSB0YWcubmFtZS50b0xvd2VyQ2FzZSgpO1xuXHRcdFx0aWYgKCBsb3dlckNhc2VOYW1lID09PSAnc2NyaXB0JyB8fCBsb3dlckNhc2VOYW1lID09PSAnc3R5bGUnICkge1xuXHRcdFx0XHR0b2tlbml6ZXIuaW5zaWRlID0gbG93ZXJDYXNlTmFtZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0YWc7XG5cdFx0fTtcblx0XHRnZXRDbG9zaW5nVGFnID0gZnVuY3Rpb24oIHRva2VuaXplciApIHtcblx0XHRcdHZhciBzdGFydCwgdGFnLCBleHBlY3RlZDtcblx0XHRcdHN0YXJ0ID0gdG9rZW5pemVyLnBvcztcblx0XHRcdGV4cGVjdGVkID0gZnVuY3Rpb24oIHN0ciApIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnVW5leHBlY3RlZCBjaGFyYWN0ZXIgJyArIHRva2VuaXplci5yZW1haW5pbmcoKS5jaGFyQXQoIDAgKSArICcgKGV4cGVjdGVkICcgKyBzdHIgKyAnKScgKTtcblx0XHRcdH07XG5cdFx0XHRpZiAoICF0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICc8JyApICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHRhZyA9IHtcblx0XHRcdFx0dHlwZTogdHlwZXMuVEFHLFxuXHRcdFx0XHRjbG9zaW5nOiB0cnVlXG5cdFx0XHR9O1xuXHRcdFx0aWYgKCAhdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnLycgKSApIHtcblx0XHRcdFx0ZXhwZWN0ZWQoICdcIi9cIicgKTtcblx0XHRcdH1cblx0XHRcdHRhZy5uYW1lID0gZ2V0VGFnTmFtZSggdG9rZW5pemVyICk7XG5cdFx0XHRpZiAoICF0YWcubmFtZSApIHtcblx0XHRcdFx0ZXhwZWN0ZWQoICd0YWcgbmFtZScgKTtcblx0XHRcdH1cblx0XHRcdGlmICggIXRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJz4nICkgKSB7XG5cdFx0XHRcdGV4cGVjdGVkKCAnXCI+XCInICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRva2VuaXplci5pbnNpZGUgKSB7XG5cdFx0XHRcdGlmICggdGFnLm5hbWUudG9Mb3dlckNhc2UoKSAhPT0gdG9rZW5pemVyLmluc2lkZSApIHtcblx0XHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0dG9rZW5pemVyLmluc2lkZSA9IG51bGw7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGFnO1xuXHRcdH07XG5cdFx0Z2V0VGFnTmFtZSA9IG1ha2VSZWdleE1hdGNoZXIoIC9eW2EtekEtWl17MSx9Oj9bYS16QS1aMC05XFwtXSovICk7XG5cdFx0Z2V0QXR0cmlidXRlcyA9IGZ1bmN0aW9uKCB0b2tlbml6ZXIgKSB7XG5cdFx0XHR2YXIgc3RhcnQsIGF0dHJzLCBhdHRyO1xuXHRcdFx0c3RhcnQgPSB0b2tlbml6ZXIucG9zO1xuXHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0YXR0ciA9IGdldEF0dHJpYnV0ZSggdG9rZW5pemVyICk7XG5cdFx0XHRpZiAoICFhdHRyICkge1xuXHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0YXR0cnMgPSBbXTtcblx0XHRcdHdoaWxlICggYXR0ciAhPT0gbnVsbCApIHtcblx0XHRcdFx0YXR0cnMucHVzaCggYXR0ciApO1xuXHRcdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRcdGF0dHIgPSBnZXRBdHRyaWJ1dGUoIHRva2VuaXplciApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGF0dHJzO1xuXHRcdH07XG5cdFx0Z2V0QXR0cmlidXRlID0gZnVuY3Rpb24oIHRva2VuaXplciApIHtcblx0XHRcdHZhciBhdHRyLCBuYW1lLCB2YWx1ZTtcblx0XHRcdG5hbWUgPSBnZXRBdHRyaWJ1dGVOYW1lKCB0b2tlbml6ZXIgKTtcblx0XHRcdGlmICggIW5hbWUgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0YXR0ciA9IHtcblx0XHRcdFx0bmFtZTogbmFtZVxuXHRcdFx0fTtcblx0XHRcdHZhbHVlID0gZ2V0QXR0cmlidXRlVmFsdWUoIHRva2VuaXplciApO1xuXHRcdFx0aWYgKCB2YWx1ZSApIHtcblx0XHRcdFx0YXR0ci52YWx1ZSA9IHZhbHVlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGF0dHI7XG5cdFx0fTtcblx0XHRnZXRBdHRyaWJ1dGVOYW1lID0gbWFrZVJlZ2V4TWF0Y2hlciggL15bXlxcc1wiJz5cXC89XSsvICk7XG5cdFx0Z2V0QXR0cmlidXRlVmFsdWUgPSBmdW5jdGlvbiggdG9rZW5pemVyICkge1xuXHRcdFx0dmFyIHN0YXJ0LCB2YWx1ZTtcblx0XHRcdHN0YXJ0ID0gdG9rZW5pemVyLnBvcztcblx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdGlmICggIXRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJz0nICkgKSB7XG5cdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHR2YWx1ZSA9IGdldFF1b3RlZEF0dHJpYnV0ZVZhbHVlKCB0b2tlbml6ZXIsICdcXCcnICkgfHwgZ2V0UXVvdGVkQXR0cmlidXRlVmFsdWUoIHRva2VuaXplciwgJ1wiJyApIHx8IGdldFVucXVvdGVkQXR0cmlidXRlVmFsdWUoIHRva2VuaXplciApO1xuXHRcdFx0aWYgKCB2YWx1ZSA9PT0gbnVsbCApIHtcblx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHR9O1xuXHRcdGdldFVucXVvdGVkQXR0cmlidXRlVmFsdWVUZXh0ID0gbWFrZVJlZ2V4TWF0Y2hlciggL15bXlxcc1wiJz08PmBdKy8gKTtcblx0XHRnZXRVbnF1b3RlZEF0dHJpYnV0ZVZhbHVlVG9rZW4gPSBmdW5jdGlvbiggdG9rZW5pemVyICkge1xuXHRcdFx0dmFyIHN0YXJ0LCB0ZXh0LCBpbmRleDtcblx0XHRcdHN0YXJ0ID0gdG9rZW5pemVyLnBvcztcblx0XHRcdHRleHQgPSBnZXRVbnF1b3RlZEF0dHJpYnV0ZVZhbHVlVGV4dCggdG9rZW5pemVyICk7XG5cdFx0XHRpZiAoICF0ZXh0ICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGlmICggKCBpbmRleCA9IHRleHQuaW5kZXhPZiggdG9rZW5pemVyLmRlbGltaXRlcnNbIDAgXSApICkgIT09IC0xICkge1xuXHRcdFx0XHR0ZXh0ID0gdGV4dC5zdWJzdHIoIDAsIGluZGV4ICk7XG5cdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydCArIHRleHQubGVuZ3RoO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0dHlwZTogdHlwZXMuVEVYVCxcblx0XHRcdFx0dmFsdWU6IHRleHRcblx0XHRcdH07XG5cdFx0fTtcblx0XHRnZXRVbnF1b3RlZEF0dHJpYnV0ZVZhbHVlID0gZnVuY3Rpb24oIHRva2VuaXplciApIHtcblx0XHRcdHZhciB0b2tlbnMsIHRva2VuO1xuXHRcdFx0dG9rZW5zID0gW107XG5cdFx0XHR0b2tlbiA9IHRva2VuaXplci5nZXRNdXN0YWNoZSgpIHx8IGdldFVucXVvdGVkQXR0cmlidXRlVmFsdWVUb2tlbiggdG9rZW5pemVyICk7XG5cdFx0XHR3aGlsZSAoIHRva2VuICE9PSBudWxsICkge1xuXHRcdFx0XHR0b2tlbnMucHVzaCggdG9rZW4gKTtcblx0XHRcdFx0dG9rZW4gPSB0b2tlbml6ZXIuZ2V0TXVzdGFjaGUoKSB8fCBnZXRVbnF1b3RlZEF0dHJpYnV0ZVZhbHVlVG9rZW4oIHRva2VuaXplciApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhdG9rZW5zLmxlbmd0aCApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdG9rZW5zO1xuXHRcdH07XG5cdFx0Z2V0UXVvdGVkQXR0cmlidXRlVmFsdWUgPSBmdW5jdGlvbiggdG9rZW5pemVyLCBxdW90ZU1hcmsgKSB7XG5cdFx0XHR2YXIgc3RhcnQsIHRva2VucywgdG9rZW47XG5cdFx0XHRzdGFydCA9IHRva2VuaXplci5wb3M7XG5cdFx0XHRpZiAoICF0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goIHF1b3RlTWFyayApICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHRva2VucyA9IFtdO1xuXHRcdFx0dG9rZW4gPSB0b2tlbml6ZXIuZ2V0TXVzdGFjaGUoKSB8fCBnZXRRdW90ZWRTdHJpbmdUb2tlbiggdG9rZW5pemVyLCBxdW90ZU1hcmsgKTtcblx0XHRcdHdoaWxlICggdG9rZW4gIT09IG51bGwgKSB7XG5cdFx0XHRcdHRva2Vucy5wdXNoKCB0b2tlbiApO1xuXHRcdFx0XHR0b2tlbiA9IHRva2VuaXplci5nZXRNdXN0YWNoZSgpIHx8IGdldFF1b3RlZFN0cmluZ1Rva2VuKCB0b2tlbml6ZXIsIHF1b3RlTWFyayApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCBxdW90ZU1hcmsgKSApIHtcblx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0b2tlbnM7XG5cdFx0fTtcblx0XHRnZXRRdW90ZWRTdHJpbmdUb2tlbiA9IGZ1bmN0aW9uKCB0b2tlbml6ZXIsIHF1b3RlTWFyayApIHtcblx0XHRcdHZhciBzdGFydCwgaW5kZXgsIHJlbWFpbmluZztcblx0XHRcdHN0YXJ0ID0gdG9rZW5pemVyLnBvcztcblx0XHRcdHJlbWFpbmluZyA9IHRva2VuaXplci5yZW1haW5pbmcoKTtcblx0XHRcdGluZGV4ID0gZ2V0TG93ZXN0SW5kZXgoIHJlbWFpbmluZywgW1xuXHRcdFx0XHRxdW90ZU1hcmssXG5cdFx0XHRcdHRva2VuaXplci5kZWxpbWl0ZXJzWyAwIF0sXG5cdFx0XHRcdHRva2VuaXplci5kZWxpbWl0ZXJzWyAxIF1cblx0XHRcdF0gKTtcblx0XHRcdGlmICggaW5kZXggPT09IC0xICkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdRdW90ZWQgYXR0cmlidXRlIHZhbHVlIG11c3QgaGF2ZSBhIGNsb3NpbmcgcXVvdGUnICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICFpbmRleCApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHR0b2tlbml6ZXIucG9zICs9IGluZGV4O1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0dHlwZTogdHlwZXMuVEVYVCxcblx0XHRcdFx0dmFsdWU6IHJlbWFpbmluZy5zdWJzdHIoIDAsIGluZGV4IClcblx0XHRcdH07XG5cdFx0fTtcblx0XHRyZXR1cm4gZ2V0VGFnO1xuXHR9KCBjb25maWdfdHlwZXMsIHBhcnNlX1Rva2VuaXplcl91dGlsc19tYWtlUmVnZXhNYXRjaGVyLCBwYXJzZV9Ub2tlbml6ZXJfdXRpbHNfZ2V0TG93ZXN0SW5kZXggKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX2dldFRleHRfX2dldFRleHQgPSBmdW5jdGlvbiggdHlwZXMsIGdldExvd2VzdEluZGV4ICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIGluZGV4LCByZW1haW5pbmcsIGJhcnJpZXI7XG5cdFx0XHRyZW1haW5pbmcgPSB0aGlzLnJlbWFpbmluZygpO1xuXHRcdFx0YmFycmllciA9IHRoaXMuaW5zaWRlID8gJzwvJyArIHRoaXMuaW5zaWRlIDogJzwnO1xuXHRcdFx0aWYgKCB0aGlzLmluc2lkZSAmJiAhdGhpcy5pbnRlcnBvbGF0ZVsgdGhpcy5pbnNpZGUgXSApIHtcblx0XHRcdFx0aW5kZXggPSByZW1haW5pbmcuaW5kZXhPZiggYmFycmllciApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aW5kZXggPSBnZXRMb3dlc3RJbmRleCggcmVtYWluaW5nLCBbXG5cdFx0XHRcdFx0YmFycmllcixcblx0XHRcdFx0XHR0aGlzLmRlbGltaXRlcnNbIDAgXSxcblx0XHRcdFx0XHR0aGlzLnRyaXBsZURlbGltaXRlcnNbIDAgXVxuXHRcdFx0XHRdICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICFpbmRleCApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGluZGV4ID09PSAtMSApIHtcblx0XHRcdFx0aW5kZXggPSByZW1haW5pbmcubGVuZ3RoO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5wb3MgKz0gaW5kZXg7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR0eXBlOiB0eXBlcy5URVhULFxuXHRcdFx0XHR2YWx1ZTogcmVtYWluaW5nLnN1YnN0ciggMCwgaW5kZXggKVxuXHRcdFx0fTtcblx0XHR9O1xuXHR9KCBjb25maWdfdHlwZXMsIHBhcnNlX1Rva2VuaXplcl91dGlsc19nZXRMb3dlc3RJbmRleCApO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X2dldExpdGVyYWxfZ2V0Qm9vbGVhbkxpdGVyYWwgPSBmdW5jdGlvbiggdHlwZXMgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHRva2VuaXplciApIHtcblx0XHRcdHZhciByZW1haW5pbmcgPSB0b2tlbml6ZXIucmVtYWluaW5nKCk7XG5cdFx0XHRpZiAoIHJlbWFpbmluZy5zdWJzdHIoIDAsIDQgKSA9PT0gJ3RydWUnICkge1xuXHRcdFx0XHR0b2tlbml6ZXIucG9zICs9IDQ7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0dDogdHlwZXMuQk9PTEVBTl9MSVRFUkFMLFxuXHRcdFx0XHRcdHY6ICd0cnVlJ1xuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdFx0aWYgKCByZW1haW5pbmcuc3Vic3RyKCAwLCA1ICkgPT09ICdmYWxzZScgKSB7XG5cdFx0XHRcdHRva2VuaXplci5wb3MgKz0gNTtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHR0OiB0eXBlcy5CT09MRUFOX0xJVEVSQUwsXG5cdFx0XHRcdFx0djogJ2ZhbHNlJ1xuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fTtcblx0fSggY29uZmlnX3R5cGVzICk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfZ2V0TGl0ZXJhbF9nZXRPYmplY3RMaXRlcmFsX2dldEtleVZhbHVlUGFpciA9IGZ1bmN0aW9uKCB0eXBlcywgZ2V0S2V5ICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB0b2tlbml6ZXIgKSB7XG5cdFx0XHR2YXIgc3RhcnQsIGtleSwgdmFsdWU7XG5cdFx0XHRzdGFydCA9IHRva2VuaXplci5wb3M7XG5cdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRrZXkgPSBnZXRLZXkoIHRva2VuaXplciApO1xuXHRcdFx0aWYgKCBrZXkgPT09IG51bGwgKSB7XG5cdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRpZiAoICF0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICc6JyApICkge1xuXHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0dmFsdWUgPSB0b2tlbml6ZXIuZ2V0RXhwcmVzc2lvbigpO1xuXHRcdFx0aWYgKCB2YWx1ZSA9PT0gbnVsbCApIHtcblx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHQ6IHR5cGVzLktFWV9WQUxVRV9QQUlSLFxuXHRcdFx0XHRrOiBrZXksXG5cdFx0XHRcdHY6IHZhbHVlXG5cdFx0XHR9O1xuXHRcdH07XG5cdH0oIGNvbmZpZ190eXBlcywgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fc2hhcmVkX2dldEtleSApO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X2dldExpdGVyYWxfZ2V0T2JqZWN0TGl0ZXJhbF9nZXRLZXlWYWx1ZVBhaXJzID0gZnVuY3Rpb24oIGdldEtleVZhbHVlUGFpciApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiBnZXRLZXlWYWx1ZVBhaXJzKCB0b2tlbml6ZXIgKSB7XG5cdFx0XHR2YXIgc3RhcnQsIHBhaXJzLCBwYWlyLCBrZXlWYWx1ZVBhaXJzO1xuXHRcdFx0c3RhcnQgPSB0b2tlbml6ZXIucG9zO1xuXHRcdFx0cGFpciA9IGdldEtleVZhbHVlUGFpciggdG9rZW5pemVyICk7XG5cdFx0XHRpZiAoIHBhaXIgPT09IG51bGwgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0cGFpcnMgPSBbIHBhaXIgXTtcblx0XHRcdGlmICggdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnLCcgKSApIHtcblx0XHRcdFx0a2V5VmFsdWVQYWlycyA9IGdldEtleVZhbHVlUGFpcnMoIHRva2VuaXplciApO1xuXHRcdFx0XHRpZiAoICFrZXlWYWx1ZVBhaXJzICkge1xuXHRcdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcGFpcnMuY29uY2F0KCBrZXlWYWx1ZVBhaXJzICk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcGFpcnM7XG5cdFx0fTtcblx0fSggcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9nZXRMaXRlcmFsX2dldE9iamVjdExpdGVyYWxfZ2V0S2V5VmFsdWVQYWlyICk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfZ2V0TGl0ZXJhbF9nZXRPYmplY3RMaXRlcmFsX19nZXRPYmplY3RMaXRlcmFsID0gZnVuY3Rpb24oIHR5cGVzLCBnZXRLZXlWYWx1ZVBhaXJzICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB0b2tlbml6ZXIgKSB7XG5cdFx0XHR2YXIgc3RhcnQsIGtleVZhbHVlUGFpcnM7XG5cdFx0XHRzdGFydCA9IHRva2VuaXplci5wb3M7XG5cdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRpZiAoICF0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICd7JyApICkge1xuXHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0a2V5VmFsdWVQYWlycyA9IGdldEtleVZhbHVlUGFpcnMoIHRva2VuaXplciApO1xuXHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0aWYgKCAhdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnfScgKSApIHtcblx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHQ6IHR5cGVzLk9CSkVDVF9MSVRFUkFMLFxuXHRcdFx0XHRtOiBrZXlWYWx1ZVBhaXJzXG5cdFx0XHR9O1xuXHRcdH07XG5cdH0oIGNvbmZpZ190eXBlcywgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9nZXRMaXRlcmFsX2dldE9iamVjdExpdGVyYWxfZ2V0S2V5VmFsdWVQYWlycyApO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9zaGFyZWRfZ2V0RXhwcmVzc2lvbkxpc3QgPSBmdW5jdGlvbiBnZXRFeHByZXNzaW9uTGlzdCggdG9rZW5pemVyICkge1xuXHRcdHZhciBzdGFydCwgZXhwcmVzc2lvbnMsIGV4cHIsIG5leHQ7XG5cdFx0c3RhcnQgPSB0b2tlbml6ZXIucG9zO1xuXHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRleHByID0gdG9rZW5pemVyLmdldEV4cHJlc3Npb24oKTtcblx0XHRpZiAoIGV4cHIgPT09IG51bGwgKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0ZXhwcmVzc2lvbnMgPSBbIGV4cHIgXTtcblx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0aWYgKCB0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICcsJyApICkge1xuXHRcdFx0bmV4dCA9IGdldEV4cHJlc3Npb25MaXN0KCB0b2tlbml6ZXIgKTtcblx0XHRcdGlmICggbmV4dCA9PT0gbnVsbCApIHtcblx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGV4cHJlc3Npb25zID0gZXhwcmVzc2lvbnMuY29uY2F0KCBuZXh0ICk7XG5cdFx0fVxuXHRcdHJldHVybiBleHByZXNzaW9ucztcblx0fTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9nZXRMaXRlcmFsX2dldEFycmF5TGl0ZXJhbCA9IGZ1bmN0aW9uKCB0eXBlcywgZ2V0RXhwcmVzc2lvbkxpc3QgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHRva2VuaXplciApIHtcblx0XHRcdHZhciBzdGFydCwgZXhwcmVzc2lvbkxpc3Q7XG5cdFx0XHRzdGFydCA9IHRva2VuaXplci5wb3M7XG5cdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRpZiAoICF0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICdbJyApICkge1xuXHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0ZXhwcmVzc2lvbkxpc3QgPSBnZXRFeHByZXNzaW9uTGlzdCggdG9rZW5pemVyICk7XG5cdFx0XHRpZiAoICF0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICddJyApICkge1xuXHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0dDogdHlwZXMuQVJSQVlfTElURVJBTCxcblx0XHRcdFx0bTogZXhwcmVzc2lvbkxpc3Rcblx0XHRcdH07XG5cdFx0fTtcblx0fSggY29uZmlnX3R5cGVzLCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9zaGFyZWRfZ2V0RXhwcmVzc2lvbkxpc3QgKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9nZXRMaXRlcmFsX19nZXRMaXRlcmFsID0gZnVuY3Rpb24oIGdldE51bWJlckxpdGVyYWwsIGdldEJvb2xlYW5MaXRlcmFsLCBnZXRTdHJpbmdMaXRlcmFsLCBnZXRPYmplY3RMaXRlcmFsLCBnZXRBcnJheUxpdGVyYWwgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHRva2VuaXplciApIHtcblx0XHRcdHZhciBsaXRlcmFsID0gZ2V0TnVtYmVyTGl0ZXJhbCggdG9rZW5pemVyICkgfHwgZ2V0Qm9vbGVhbkxpdGVyYWwoIHRva2VuaXplciApIHx8IGdldFN0cmluZ0xpdGVyYWwoIHRva2VuaXplciApIHx8IGdldE9iamVjdExpdGVyYWwoIHRva2VuaXplciApIHx8IGdldEFycmF5TGl0ZXJhbCggdG9rZW5pemVyICk7XG5cdFx0XHRyZXR1cm4gbGl0ZXJhbDtcblx0XHR9O1xuXHR9KCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X2dldExpdGVyYWxfZ2V0TnVtYmVyTGl0ZXJhbCwgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9nZXRMaXRlcmFsX2dldEJvb2xlYW5MaXRlcmFsLCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X2dldExpdGVyYWxfZ2V0U3RyaW5nTGl0ZXJhbF9fZ2V0U3RyaW5nTGl0ZXJhbCwgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9nZXRMaXRlcmFsX2dldE9iamVjdExpdGVyYWxfX2dldE9iamVjdExpdGVyYWwsIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfZ2V0TGl0ZXJhbF9nZXRBcnJheUxpdGVyYWwgKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9nZXRSZWZlcmVuY2UgPSBmdW5jdGlvbiggdHlwZXMsIG1ha2VSZWdleE1hdGNoZXIsIGdldE5hbWUgKSB7XG5cblx0XHR2YXIgZ2V0RG90UmVmaW5lbWVudCwgZ2V0QXJyYXlSZWZpbmVtZW50LCBnZXRBcnJheU1lbWJlciwgZ2xvYmFscztcblx0XHRnZXREb3RSZWZpbmVtZW50ID0gbWFrZVJlZ2V4TWF0Y2hlciggL15cXC5bYS16QS1aXyQwLTldKy8gKTtcblx0XHRnZXRBcnJheVJlZmluZW1lbnQgPSBmdW5jdGlvbiggdG9rZW5pemVyICkge1xuXHRcdFx0dmFyIG51bSA9IGdldEFycmF5TWVtYmVyKCB0b2tlbml6ZXIgKTtcblx0XHRcdGlmICggbnVtICkge1xuXHRcdFx0XHRyZXR1cm4gJy4nICsgbnVtO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fTtcblx0XHRnZXRBcnJheU1lbWJlciA9IG1ha2VSZWdleE1hdGNoZXIoIC9eXFxbKDB8WzEtOV1bMC05XSopXFxdLyApO1xuXHRcdGdsb2JhbHMgPSAvXig/OkFycmF5fERhdGV8UmVnRXhwfGRlY29kZVVSSUNvbXBvbmVudHxkZWNvZGVVUkl8ZW5jb2RlVVJJQ29tcG9uZW50fGVuY29kZVVSSXxpc0Zpbml0ZXxpc05hTnxwYXJzZUZsb2F0fHBhcnNlSW50fEpTT058TWF0aHxOYU58dW5kZWZpbmVkfG51bGwpJC87XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB0b2tlbml6ZXIgKSB7XG5cdFx0XHR2YXIgc3RhcnRQb3MsIGFuY2VzdG9yLCBuYW1lLCBkb3QsIGNvbWJvLCByZWZpbmVtZW50LCBsYXN0RG90SW5kZXg7XG5cdFx0XHRzdGFydFBvcyA9IHRva2VuaXplci5wb3M7XG5cdFx0XHRhbmNlc3RvciA9ICcnO1xuXHRcdFx0d2hpbGUgKCB0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICcuLi8nICkgKSB7XG5cdFx0XHRcdGFuY2VzdG9yICs9ICcuLi8nO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhYW5jZXN0b3IgKSB7XG5cdFx0XHRcdGRvdCA9IHRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJy4nICkgfHwgJyc7XG5cdFx0XHR9XG5cdFx0XHRuYW1lID0gZ2V0TmFtZSggdG9rZW5pemVyICkgfHwgJyc7XG5cdFx0XHRpZiAoICFhbmNlc3RvciAmJiAhZG90ICYmIGdsb2JhbHMudGVzdCggbmFtZSApICkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHQ6IHR5cGVzLkdMT0JBTCxcblx0XHRcdFx0XHR2OiBuYW1lXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0XHRpZiAoIG5hbWUgPT09ICd0aGlzJyAmJiAhYW5jZXN0b3IgJiYgIWRvdCApIHtcblx0XHRcdFx0bmFtZSA9ICcuJztcblx0XHRcdFx0c3RhcnRQb3MgKz0gMztcblx0XHRcdH1cblx0XHRcdGNvbWJvID0gKCBhbmNlc3RvciB8fCBkb3QgKSArIG5hbWU7XG5cdFx0XHRpZiAoICFjb21ibyApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHR3aGlsZSAoIHJlZmluZW1lbnQgPSBnZXREb3RSZWZpbmVtZW50KCB0b2tlbml6ZXIgKSB8fCBnZXRBcnJheVJlZmluZW1lbnQoIHRva2VuaXplciApICkge1xuXHRcdFx0XHRjb21ibyArPSByZWZpbmVtZW50O1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICcoJyApICkge1xuXHRcdFx0XHRsYXN0RG90SW5kZXggPSBjb21iby5sYXN0SW5kZXhPZiggJy4nICk7XG5cdFx0XHRcdGlmICggbGFzdERvdEluZGV4ICE9PSAtMSApIHtcblx0XHRcdFx0XHRjb21ibyA9IGNvbWJvLnN1YnN0ciggMCwgbGFzdERvdEluZGV4ICk7XG5cdFx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0UG9zICsgY29tYm8ubGVuZ3RoO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRva2VuaXplci5wb3MgLT0gMTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0dDogdHlwZXMuUkVGRVJFTkNFLFxuXHRcdFx0XHRuOiBjb21ib1xuXHRcdFx0fTtcblx0XHR9O1xuXHR9KCBjb25maWdfdHlwZXMsIHBhcnNlX1Rva2VuaXplcl91dGlsc19tYWtlUmVnZXhNYXRjaGVyLCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9zaGFyZWRfZ2V0TmFtZSApO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X2dldEJyYWNrZXRlZEV4cHJlc3Npb24gPSBmdW5jdGlvbiggdHlwZXMgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHRva2VuaXplciApIHtcblx0XHRcdHZhciBzdGFydCwgZXhwcjtcblx0XHRcdHN0YXJ0ID0gdG9rZW5pemVyLnBvcztcblx0XHRcdGlmICggIXRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJygnICkgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0ZXhwciA9IHRva2VuaXplci5nZXRFeHByZXNzaW9uKCk7XG5cdFx0XHRpZiAoICFleHByICkge1xuXHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0aWYgKCAhdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnKScgKSApIHtcblx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHQ6IHR5cGVzLkJSQUNLRVRFRCxcblx0XHRcdFx0eDogZXhwclxuXHRcdFx0fTtcblx0XHR9O1xuXHR9KCBjb25maWdfdHlwZXMgKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9fZ2V0UHJpbWFyeSA9IGZ1bmN0aW9uKCBnZXRMaXRlcmFsLCBnZXRSZWZlcmVuY2UsIGdldEJyYWNrZXRlZEV4cHJlc3Npb24gKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHRva2VuaXplciApIHtcblx0XHRcdHJldHVybiBnZXRMaXRlcmFsKCB0b2tlbml6ZXIgKSB8fCBnZXRSZWZlcmVuY2UoIHRva2VuaXplciApIHx8IGdldEJyYWNrZXRlZEV4cHJlc3Npb24oIHRva2VuaXplciApO1xuXHRcdH07XG5cdH0oIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfZ2V0TGl0ZXJhbF9fZ2V0TGl0ZXJhbCwgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9nZXRSZWZlcmVuY2UsIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfZ2V0QnJhY2tldGVkRXhwcmVzc2lvbiApO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9zaGFyZWRfZ2V0UmVmaW5lbWVudCA9IGZ1bmN0aW9uKCB0eXBlcywgZ2V0TmFtZSApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiBnZXRSZWZpbmVtZW50KCB0b2tlbml6ZXIgKSB7XG5cdFx0XHR2YXIgc3RhcnQsIG5hbWUsIGV4cHI7XG5cdFx0XHRzdGFydCA9IHRva2VuaXplci5wb3M7XG5cdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRpZiAoIHRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJy4nICkgKSB7XG5cdFx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdFx0aWYgKCBuYW1lID0gZ2V0TmFtZSggdG9rZW5pemVyICkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdHQ6IHR5cGVzLlJFRklORU1FTlQsXG5cdFx0XHRcdFx0XHRuOiBuYW1lXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0b2tlbml6ZXIuZXhwZWN0ZWQoICdhIHByb3BlcnR5IG5hbWUnICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJ1snICkgKSB7XG5cdFx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdFx0ZXhwciA9IHRva2VuaXplci5nZXRFeHByZXNzaW9uKCk7XG5cdFx0XHRcdGlmICggIWV4cHIgKSB7XG5cdFx0XHRcdFx0dG9rZW5pemVyLmV4cGVjdGVkKCAnYW4gZXhwcmVzc2lvbicgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRcdGlmICggIXRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJ10nICkgKSB7XG5cdFx0XHRcdFx0dG9rZW5pemVyLmV4cGVjdGVkKCAnXCJdXCInICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHR0OiB0eXBlcy5SRUZJTkVNRU5ULFxuXHRcdFx0XHRcdHg6IGV4cHJcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH07XG5cdH0oIGNvbmZpZ190eXBlcywgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fc2hhcmVkX2dldE5hbWUgKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0TWVtYmVyT3JJbnZvY2F0aW9uID0gZnVuY3Rpb24oIHR5cGVzLCBnZXRQcmltYXJ5LCBnZXRFeHByZXNzaW9uTGlzdCwgZ2V0UmVmaW5lbWVudCApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggdG9rZW5pemVyICkge1xuXHRcdFx0dmFyIGN1cnJlbnQsIGV4cHJlc3Npb24sIHJlZmluZW1lbnQsIGV4cHJlc3Npb25MaXN0O1xuXHRcdFx0ZXhwcmVzc2lvbiA9IGdldFByaW1hcnkoIHRva2VuaXplciApO1xuXHRcdFx0aWYgKCAhZXhwcmVzc2lvbiApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHR3aGlsZSAoIGV4cHJlc3Npb24gKSB7XG5cdFx0XHRcdGN1cnJlbnQgPSB0b2tlbml6ZXIucG9zO1xuXHRcdFx0XHRpZiAoIHJlZmluZW1lbnQgPSBnZXRSZWZpbmVtZW50KCB0b2tlbml6ZXIgKSApIHtcblx0XHRcdFx0XHRleHByZXNzaW9uID0ge1xuXHRcdFx0XHRcdFx0dDogdHlwZXMuTUVNQkVSLFxuXHRcdFx0XHRcdFx0eDogZXhwcmVzc2lvbixcblx0XHRcdFx0XHRcdHI6IHJlZmluZW1lbnRcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9IGVsc2UgaWYgKCB0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICcoJyApICkge1xuXHRcdFx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdFx0XHRleHByZXNzaW9uTGlzdCA9IGdldEV4cHJlc3Npb25MaXN0KCB0b2tlbml6ZXIgKTtcblx0XHRcdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRcdFx0aWYgKCAhdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnKScgKSApIHtcblx0XHRcdFx0XHRcdHRva2VuaXplci5wb3MgPSBjdXJyZW50O1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGV4cHJlc3Npb24gPSB7XG5cdFx0XHRcdFx0XHR0OiB0eXBlcy5JTlZPQ0FUSU9OLFxuXHRcdFx0XHRcdFx0eDogZXhwcmVzc2lvblxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0aWYgKCBleHByZXNzaW9uTGlzdCApIHtcblx0XHRcdFx0XHRcdGV4cHJlc3Npb24ubyA9IGV4cHJlc3Npb25MaXN0O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGV4cHJlc3Npb247XG5cdFx0fTtcblx0fSggY29uZmlnX3R5cGVzLCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X19nZXRQcmltYXJ5LCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9zaGFyZWRfZ2V0RXhwcmVzc2lvbkxpc3QsIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX3NoYXJlZF9nZXRSZWZpbmVtZW50ICk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFR5cGVPZiA9IGZ1bmN0aW9uKCB0eXBlcywgZ2V0TWVtYmVyT3JJbnZvY2F0aW9uICkge1xuXG5cdFx0dmFyIGdldFR5cGVPZiwgbWFrZVByZWZpeFNlcXVlbmNlTWF0Y2hlcjtcblx0XHRtYWtlUHJlZml4U2VxdWVuY2VNYXRjaGVyID0gZnVuY3Rpb24oIHN5bWJvbCwgZmFsbHRocm91Z2ggKSB7XG5cdFx0XHRyZXR1cm4gZnVuY3Rpb24oIHRva2VuaXplciApIHtcblx0XHRcdFx0dmFyIHN0YXJ0LCBleHByZXNzaW9uO1xuXHRcdFx0XHRpZiAoICF0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goIHN5bWJvbCApICkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxsdGhyb3VnaCggdG9rZW5pemVyICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0c3RhcnQgPSB0b2tlbml6ZXIucG9zO1xuXHRcdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRcdGV4cHJlc3Npb24gPSB0b2tlbml6ZXIuZ2V0RXhwcmVzc2lvbigpO1xuXHRcdFx0XHRpZiAoICFleHByZXNzaW9uICkge1xuXHRcdFx0XHRcdHRva2VuaXplci5leHBlY3RlZCggJ2FuIGV4cHJlc3Npb24nICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRzOiBzeW1ib2wsXG5cdFx0XHRcdFx0bzogZXhwcmVzc2lvbixcblx0XHRcdFx0XHR0OiB0eXBlcy5QUkVGSVhfT1BFUkFUT1Jcblx0XHRcdFx0fTtcblx0XHRcdH07XG5cdFx0fTtcblx0XHQoIGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIGksIGxlbiwgbWF0Y2hlciwgcHJlZml4T3BlcmF0b3JzLCBmYWxsdGhyb3VnaDtcblx0XHRcdHByZWZpeE9wZXJhdG9ycyA9ICchIH4gKyAtIHR5cGVvZicuc3BsaXQoICcgJyApO1xuXHRcdFx0ZmFsbHRocm91Z2ggPSBnZXRNZW1iZXJPckludm9jYXRpb247XG5cdFx0XHRmb3IgKCBpID0gMCwgbGVuID0gcHJlZml4T3BlcmF0b3JzLmxlbmd0aDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRtYXRjaGVyID0gbWFrZVByZWZpeFNlcXVlbmNlTWF0Y2hlciggcHJlZml4T3BlcmF0b3JzWyBpIF0sIGZhbGx0aHJvdWdoICk7XG5cdFx0XHRcdGZhbGx0aHJvdWdoID0gbWF0Y2hlcjtcblx0XHRcdH1cblx0XHRcdGdldFR5cGVPZiA9IGZhbGx0aHJvdWdoO1xuXHRcdH0oKSApO1xuXHRcdHJldHVybiBnZXRUeXBlT2Y7XG5cdH0oIGNvbmZpZ190eXBlcywgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0TWVtYmVyT3JJbnZvY2F0aW9uICk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldExvZ2ljYWxPciA9IGZ1bmN0aW9uKCB0eXBlcywgZ2V0VHlwZU9mICkge1xuXG5cdFx0dmFyIGdldExvZ2ljYWxPciwgbWFrZUluZml4U2VxdWVuY2VNYXRjaGVyO1xuXHRcdG1ha2VJbmZpeFNlcXVlbmNlTWF0Y2hlciA9IGZ1bmN0aW9uKCBzeW1ib2wsIGZhbGx0aHJvdWdoICkge1xuXHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCB0b2tlbml6ZXIgKSB7XG5cdFx0XHRcdHZhciBzdGFydCwgbGVmdCwgcmlnaHQ7XG5cdFx0XHRcdGxlZnQgPSBmYWxsdGhyb3VnaCggdG9rZW5pemVyICk7XG5cdFx0XHRcdGlmICggIWxlZnQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0d2hpbGUgKCB0cnVlICkge1xuXHRcdFx0XHRcdHN0YXJ0ID0gdG9rZW5pemVyLnBvcztcblx0XHRcdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRcdFx0aWYgKCAhdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCBzeW1ib2wgKSApIHtcblx0XHRcdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0XHRcdHJldHVybiBsZWZ0O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIHN5bWJvbCA9PT0gJ2luJyAmJiAvW2EtekEtWl8kMC05XS8udGVzdCggdG9rZW5pemVyLnJlbWFpbmluZygpLmNoYXJBdCggMCApICkgKSB7XG5cdFx0XHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbGVmdDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0XHRcdHJpZ2h0ID0gZmFsbHRocm91Z2goIHRva2VuaXplciApO1xuXHRcdFx0XHRcdGlmICggIXJpZ2h0ICkge1xuXHRcdFx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRcdFx0cmV0dXJuIGxlZnQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGxlZnQgPSB7XG5cdFx0XHRcdFx0XHR0OiB0eXBlcy5JTkZJWF9PUEVSQVRPUixcblx0XHRcdFx0XHRcdHM6IHN5bWJvbCxcblx0XHRcdFx0XHRcdG86IFtcblx0XHRcdFx0XHRcdFx0bGVmdCxcblx0XHRcdFx0XHRcdFx0cmlnaHRcblx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdH07XG5cdFx0KCBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBpLCBsZW4sIG1hdGNoZXIsIGluZml4T3BlcmF0b3JzLCBmYWxsdGhyb3VnaDtcblx0XHRcdGluZml4T3BlcmF0b3JzID0gJyogLyAlICsgLSA8PCA+PiA+Pj4gPCA8PSA+ID49IGluIGluc3RhbmNlb2YgPT0gIT0gPT09ICE9PSAmIF4gfCAmJiB8fCcuc3BsaXQoICcgJyApO1xuXHRcdFx0ZmFsbHRocm91Z2ggPSBnZXRUeXBlT2Y7XG5cdFx0XHRmb3IgKCBpID0gMCwgbGVuID0gaW5maXhPcGVyYXRvcnMubGVuZ3RoOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdG1hdGNoZXIgPSBtYWtlSW5maXhTZXF1ZW5jZU1hdGNoZXIoIGluZml4T3BlcmF0b3JzWyBpIF0sIGZhbGx0aHJvdWdoICk7XG5cdFx0XHRcdGZhbGx0aHJvdWdoID0gbWF0Y2hlcjtcblx0XHRcdH1cblx0XHRcdGdldExvZ2ljYWxPciA9IGZhbGx0aHJvdWdoO1xuXHRcdH0oKSApO1xuXHRcdHJldHVybiBnZXRMb2dpY2FsT3I7XG5cdH0oIGNvbmZpZ190eXBlcywgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0VHlwZU9mICk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldENvbmRpdGlvbmFsID0gZnVuY3Rpb24oIHR5cGVzLCBnZXRMb2dpY2FsT3IgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHRva2VuaXplciApIHtcblx0XHRcdHZhciBzdGFydCwgZXhwcmVzc2lvbiwgaWZUcnVlLCBpZkZhbHNlO1xuXHRcdFx0ZXhwcmVzc2lvbiA9IGdldExvZ2ljYWxPciggdG9rZW5pemVyICk7XG5cdFx0XHRpZiAoICFleHByZXNzaW9uICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHN0YXJ0ID0gdG9rZW5pemVyLnBvcztcblx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdGlmICggIXRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJz8nICkgKSB7XG5cdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0cmV0dXJuIGV4cHJlc3Npb247XG5cdFx0XHR9XG5cdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRpZlRydWUgPSB0b2tlbml6ZXIuZ2V0RXhwcmVzc2lvbigpO1xuXHRcdFx0aWYgKCAhaWZUcnVlICkge1xuXHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdHJldHVybiBleHByZXNzaW9uO1xuXHRcdFx0fVxuXHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0aWYgKCAhdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnOicgKSApIHtcblx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRyZXR1cm4gZXhwcmVzc2lvbjtcblx0XHRcdH1cblx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdGlmRmFsc2UgPSB0b2tlbml6ZXIuZ2V0RXhwcmVzc2lvbigpO1xuXHRcdFx0aWYgKCAhaWZGYWxzZSApIHtcblx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRyZXR1cm4gZXhwcmVzc2lvbjtcblx0XHRcdH1cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHQ6IHR5cGVzLkNPTkRJVElPTkFMLFxuXHRcdFx0XHRvOiBbXG5cdFx0XHRcdFx0ZXhwcmVzc2lvbixcblx0XHRcdFx0XHRpZlRydWUsXG5cdFx0XHRcdFx0aWZGYWxzZVxuXHRcdFx0XHRdXG5cdFx0XHR9O1xuXHRcdH07XG5cdH0oIGNvbmZpZ190eXBlcywgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0TG9naWNhbE9yICk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX19nZXRFeHByZXNzaW9uID0gZnVuY3Rpb24oIGdldENvbmRpdGlvbmFsICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIGdldENvbmRpdGlvbmFsKCB0aGlzICk7XG5cdFx0fTtcblx0fSggcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0Q29uZGl0aW9uYWwgKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX19Ub2tlbml6ZXIgPSBmdW5jdGlvbiggZ2V0TXVzdGFjaGUsIGdldENvbW1lbnQsIGdldFRhZywgZ2V0VGV4dCwgZ2V0RXhwcmVzc2lvbiwgYWxsb3dXaGl0ZXNwYWNlLCBnZXRTdHJpbmdNYXRjaCApIHtcblxuXHRcdHZhciBUb2tlbml6ZXI7XG5cdFx0VG9rZW5pemVyID0gZnVuY3Rpb24oIHN0ciwgb3B0aW9ucyApIHtcblx0XHRcdHZhciB0b2tlbjtcblx0XHRcdHRoaXMuc3RyID0gc3RyO1xuXHRcdFx0dGhpcy5wb3MgPSAwO1xuXHRcdFx0dGhpcy5kZWxpbWl0ZXJzID0gb3B0aW9ucy5kZWxpbWl0ZXJzO1xuXHRcdFx0dGhpcy50cmlwbGVEZWxpbWl0ZXJzID0gb3B0aW9ucy50cmlwbGVEZWxpbWl0ZXJzO1xuXHRcdFx0dGhpcy5pbnRlcnBvbGF0ZSA9IG9wdGlvbnMuaW50ZXJwb2xhdGU7XG5cdFx0XHR0aGlzLnRva2VucyA9IFtdO1xuXHRcdFx0d2hpbGUgKCB0aGlzLnBvcyA8IHRoaXMuc3RyLmxlbmd0aCApIHtcblx0XHRcdFx0dG9rZW4gPSB0aGlzLmdldFRva2VuKCk7XG5cdFx0XHRcdGlmICggdG9rZW4gPT09IG51bGwgJiYgdGhpcy5yZW1haW5pbmcoKSApIHtcblx0XHRcdFx0XHR0aGlzLmZhaWwoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLnRva2Vucy5wdXNoKCB0b2tlbiApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0VG9rZW5pemVyLnByb3RvdHlwZSA9IHtcblx0XHRcdGdldFRva2VuOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHRva2VuID0gdGhpcy5nZXRNdXN0YWNoZSgpIHx8IHRoaXMuZ2V0Q29tbWVudCgpIHx8IHRoaXMuZ2V0VGFnKCkgfHwgdGhpcy5nZXRUZXh0KCk7XG5cdFx0XHRcdHJldHVybiB0b2tlbjtcblx0XHRcdH0sXG5cdFx0XHRnZXRNdXN0YWNoZTogZ2V0TXVzdGFjaGUsXG5cdFx0XHRnZXRDb21tZW50OiBnZXRDb21tZW50LFxuXHRcdFx0Z2V0VGFnOiBnZXRUYWcsXG5cdFx0XHRnZXRUZXh0OiBnZXRUZXh0LFxuXHRcdFx0Z2V0RXhwcmVzc2lvbjogZ2V0RXhwcmVzc2lvbixcblx0XHRcdGFsbG93V2hpdGVzcGFjZTogYWxsb3dXaGl0ZXNwYWNlLFxuXHRcdFx0Z2V0U3RyaW5nTWF0Y2g6IGdldFN0cmluZ01hdGNoLFxuXHRcdFx0cmVtYWluaW5nOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuc3RyLnN1YnN0cmluZyggdGhpcy5wb3MgKTtcblx0XHRcdH0sXG5cdFx0XHRmYWlsOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIGxhc3QyMCwgbmV4dDIwO1xuXHRcdFx0XHRsYXN0MjAgPSB0aGlzLnN0ci5zdWJzdHIoIDAsIHRoaXMucG9zICkuc3Vic3RyKCAtMjAgKTtcblx0XHRcdFx0aWYgKCBsYXN0MjAubGVuZ3RoID09PSAyMCApIHtcblx0XHRcdFx0XHRsYXN0MjAgPSAnLi4uJyArIGxhc3QyMDtcblx0XHRcdFx0fVxuXHRcdFx0XHRuZXh0MjAgPSB0aGlzLnJlbWFpbmluZygpLnN1YnN0ciggMCwgMjAgKTtcblx0XHRcdFx0aWYgKCBuZXh0MjAubGVuZ3RoID09PSAyMCApIHtcblx0XHRcdFx0XHRuZXh0MjAgPSBuZXh0MjAgKyAnLi4uJztcblx0XHRcdFx0fVxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdDb3VsZCBub3QgcGFyc2UgdGVtcGxhdGU6ICcgKyAoIGxhc3QyMCA/IGxhc3QyMCArICc8LSAnIDogJycgKSArICdmYWlsZWQgYXQgY2hhcmFjdGVyICcgKyB0aGlzLnBvcyArICcgLT4nICsgbmV4dDIwICk7XG5cdFx0XHR9LFxuXHRcdFx0ZXhwZWN0ZWQ6IGZ1bmN0aW9uKCB0aGluZyApIHtcblx0XHRcdFx0dmFyIHJlbWFpbmluZyA9IHRoaXMucmVtYWluaW5nKCkuc3Vic3RyKCAwLCA0MCApO1xuXHRcdFx0XHRpZiAoIHJlbWFpbmluZy5sZW5ndGggPT09IDQwICkge1xuXHRcdFx0XHRcdHJlbWFpbmluZyArPSAnLi4uJztcblx0XHRcdFx0fVxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdUb2tlbml6ZXIgZmFpbGVkOiB1bmV4cGVjdGVkIHN0cmluZyBcIicgKyByZW1haW5pbmcgKyAnXCIgKGV4cGVjdGVkICcgKyB0aGluZyArICcpJyApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIFRva2VuaXplcjtcblx0fSggcGFyc2VfVG9rZW5pemVyX2dldE11c3RhY2hlX19nZXRNdXN0YWNoZSwgcGFyc2VfVG9rZW5pemVyX2dldENvbW1lbnRfZ2V0Q29tbWVudCwgcGFyc2VfVG9rZW5pemVyX2dldFRhZ19fZ2V0VGFnLCBwYXJzZV9Ub2tlbml6ZXJfZ2V0VGV4dF9fZ2V0VGV4dCwgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fX2dldEV4cHJlc3Npb24sIHBhcnNlX1Rva2VuaXplcl91dGlsc19hbGxvd1doaXRlc3BhY2UsIHBhcnNlX1Rva2VuaXplcl91dGlsc19nZXRTdHJpbmdNYXRjaCApO1xuXG5cdHZhciBwYXJzZV90b2tlbml6ZSA9IGZ1bmN0aW9uKCBpbml0T3B0aW9ucywgc3RyaXBIdG1sQ29tbWVudHMsIHN0cmlwU3RhbmRhbG9uZXMsIHN0cmlwQ29tbWVudFRva2VucywgVG9rZW5pemVyICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB0ZW1wbGF0ZSwgb3B0aW9ucyApIHtcblx0XHRcdHZhciB0b2tlbml6ZXIsIHRva2Vucztcblx0XHRcdG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXHRcdFx0aWYgKCBvcHRpb25zLnN0cmlwQ29tbWVudHMgIT09IGZhbHNlICkge1xuXHRcdFx0XHR0ZW1wbGF0ZSA9IHN0cmlwSHRtbENvbW1lbnRzKCB0ZW1wbGF0ZSApO1xuXHRcdFx0fVxuXHRcdFx0dG9rZW5pemVyID0gbmV3IFRva2VuaXplciggdGVtcGxhdGUsIHtcblx0XHRcdFx0ZGVsaW1pdGVyczogb3B0aW9ucy5kZWxpbWl0ZXJzIHx8IGluaXRPcHRpb25zLmRlZmF1bHRzLmRlbGltaXRlcnMsXG5cdFx0XHRcdHRyaXBsZURlbGltaXRlcnM6IG9wdGlvbnMudHJpcGxlRGVsaW1pdGVycyB8fCBpbml0T3B0aW9ucy5kZWZhdWx0cy50cmlwbGVEZWxpbWl0ZXJzLFxuXHRcdFx0XHRpbnRlcnBvbGF0ZToge1xuXHRcdFx0XHRcdHNjcmlwdDogb3B0aW9ucy5pbnRlcnBvbGF0ZVNjcmlwdHMgIT09IGZhbHNlID8gdHJ1ZSA6IGZhbHNlLFxuXHRcdFx0XHRcdHN0eWxlOiBvcHRpb25zLmludGVycG9sYXRlU3R5bGVzICE9PSBmYWxzZSA/IHRydWUgOiBmYWxzZVxuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHR0b2tlbnMgPSB0b2tlbml6ZXIudG9rZW5zO1xuXHRcdFx0c3RyaXBTdGFuZGFsb25lcyggdG9rZW5zICk7XG5cdFx0XHRzdHJpcENvbW1lbnRUb2tlbnMoIHRva2VucyApO1xuXHRcdFx0cmV0dXJuIHRva2Vucztcblx0XHR9O1xuXHR9KCBjb25maWdfaW5pdE9wdGlvbnMsIHBhcnNlX3V0aWxzX3N0cmlwSHRtbENvbW1lbnRzLCBwYXJzZV91dGlsc19zdHJpcFN0YW5kYWxvbmVzLCBwYXJzZV91dGlsc19zdHJpcENvbW1lbnRUb2tlbnMsIHBhcnNlX1Rva2VuaXplcl9fVG9rZW5pemVyICk7XG5cblx0dmFyIHBhcnNlX1BhcnNlcl9nZXRUZXh0X1RleHRTdHViX19UZXh0U3R1YiA9IGZ1bmN0aW9uKCB0eXBlcyApIHtcblxuXHRcdHZhciBUZXh0U3R1YiwgaHRtbEVudGl0aWVzLCBjb250cm9sQ2hhcmFjdGVycywgbmFtZWRFbnRpdHlQYXR0ZXJuLCBoZXhFbnRpdHlQYXR0ZXJuLCBkZWNpbWFsRW50aXR5UGF0dGVybiwgdmFsaWRhdGVDb2RlLCBkZWNvZGVDaGFyYWN0ZXJSZWZlcmVuY2VzLCB3aGl0ZXNwYWNlO1xuXHRcdFRleHRTdHViID0gZnVuY3Rpb24oIHRva2VuLCBwcmVzZXJ2ZVdoaXRlc3BhY2UgKSB7XG5cdFx0XHR0aGlzLnRleHQgPSBwcmVzZXJ2ZVdoaXRlc3BhY2UgPyB0b2tlbi52YWx1ZSA6IHRva2VuLnZhbHVlLnJlcGxhY2UoIHdoaXRlc3BhY2UsICcgJyApO1xuXHRcdH07XG5cdFx0VGV4dFN0dWIucHJvdG90eXBlID0ge1xuXHRcdFx0dHlwZTogdHlwZXMuVEVYVCxcblx0XHRcdHRvSlNPTjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmRlY29kZWQgfHwgKCB0aGlzLmRlY29kZWQgPSBkZWNvZGVDaGFyYWN0ZXJSZWZlcmVuY2VzKCB0aGlzLnRleHQgKSApO1xuXHRcdFx0fSxcblx0XHRcdHRvU3RyaW5nOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMudGV4dDtcblx0XHRcdH1cblx0XHR9O1xuXHRcdGh0bWxFbnRpdGllcyA9IHtcblx0XHRcdHF1b3Q6IDM0LFxuXHRcdFx0YW1wOiAzOCxcblx0XHRcdGFwb3M6IDM5LFxuXHRcdFx0bHQ6IDYwLFxuXHRcdFx0Z3Q6IDYyLFxuXHRcdFx0bmJzcDogMTYwLFxuXHRcdFx0aWV4Y2w6IDE2MSxcblx0XHRcdGNlbnQ6IDE2Mixcblx0XHRcdHBvdW5kOiAxNjMsXG5cdFx0XHRjdXJyZW46IDE2NCxcblx0XHRcdHllbjogMTY1LFxuXHRcdFx0YnJ2YmFyOiAxNjYsXG5cdFx0XHRzZWN0OiAxNjcsXG5cdFx0XHR1bWw6IDE2OCxcblx0XHRcdGNvcHk6IDE2OSxcblx0XHRcdG9yZGY6IDE3MCxcblx0XHRcdGxhcXVvOiAxNzEsXG5cdFx0XHRub3Q6IDE3Mixcblx0XHRcdHNoeTogMTczLFxuXHRcdFx0cmVnOiAxNzQsXG5cdFx0XHRtYWNyOiAxNzUsXG5cdFx0XHRkZWc6IDE3Nixcblx0XHRcdHBsdXNtbjogMTc3LFxuXHRcdFx0c3VwMjogMTc4LFxuXHRcdFx0c3VwMzogMTc5LFxuXHRcdFx0YWN1dGU6IDE4MCxcblx0XHRcdG1pY3JvOiAxODEsXG5cdFx0XHRwYXJhOiAxODIsXG5cdFx0XHRtaWRkb3Q6IDE4Myxcblx0XHRcdGNlZGlsOiAxODQsXG5cdFx0XHRzdXAxOiAxODUsXG5cdFx0XHRvcmRtOiAxODYsXG5cdFx0XHRyYXF1bzogMTg3LFxuXHRcdFx0ZnJhYzE0OiAxODgsXG5cdFx0XHRmcmFjMTI6IDE4OSxcblx0XHRcdGZyYWMzNDogMTkwLFxuXHRcdFx0aXF1ZXN0OiAxOTEsXG5cdFx0XHRBZ3JhdmU6IDE5Mixcblx0XHRcdEFhY3V0ZTogMTkzLFxuXHRcdFx0QWNpcmM6IDE5NCxcblx0XHRcdEF0aWxkZTogMTk1LFxuXHRcdFx0QXVtbDogMTk2LFxuXHRcdFx0QXJpbmc6IDE5Nyxcblx0XHRcdEFFbGlnOiAxOTgsXG5cdFx0XHRDY2VkaWw6IDE5OSxcblx0XHRcdEVncmF2ZTogMjAwLFxuXHRcdFx0RWFjdXRlOiAyMDEsXG5cdFx0XHRFY2lyYzogMjAyLFxuXHRcdFx0RXVtbDogMjAzLFxuXHRcdFx0SWdyYXZlOiAyMDQsXG5cdFx0XHRJYWN1dGU6IDIwNSxcblx0XHRcdEljaXJjOiAyMDYsXG5cdFx0XHRJdW1sOiAyMDcsXG5cdFx0XHRFVEg6IDIwOCxcblx0XHRcdE50aWxkZTogMjA5LFxuXHRcdFx0T2dyYXZlOiAyMTAsXG5cdFx0XHRPYWN1dGU6IDIxMSxcblx0XHRcdE9jaXJjOiAyMTIsXG5cdFx0XHRPdGlsZGU6IDIxMyxcblx0XHRcdE91bWw6IDIxNCxcblx0XHRcdHRpbWVzOiAyMTUsXG5cdFx0XHRPc2xhc2g6IDIxNixcblx0XHRcdFVncmF2ZTogMjE3LFxuXHRcdFx0VWFjdXRlOiAyMTgsXG5cdFx0XHRVY2lyYzogMjE5LFxuXHRcdFx0VXVtbDogMjIwLFxuXHRcdFx0WWFjdXRlOiAyMjEsXG5cdFx0XHRUSE9STjogMjIyLFxuXHRcdFx0c3psaWc6IDIyMyxcblx0XHRcdGFncmF2ZTogMjI0LFxuXHRcdFx0YWFjdXRlOiAyMjUsXG5cdFx0XHRhY2lyYzogMjI2LFxuXHRcdFx0YXRpbGRlOiAyMjcsXG5cdFx0XHRhdW1sOiAyMjgsXG5cdFx0XHRhcmluZzogMjI5LFxuXHRcdFx0YWVsaWc6IDIzMCxcblx0XHRcdGNjZWRpbDogMjMxLFxuXHRcdFx0ZWdyYXZlOiAyMzIsXG5cdFx0XHRlYWN1dGU6IDIzMyxcblx0XHRcdGVjaXJjOiAyMzQsXG5cdFx0XHRldW1sOiAyMzUsXG5cdFx0XHRpZ3JhdmU6IDIzNixcblx0XHRcdGlhY3V0ZTogMjM3LFxuXHRcdFx0aWNpcmM6IDIzOCxcblx0XHRcdGl1bWw6IDIzOSxcblx0XHRcdGV0aDogMjQwLFxuXHRcdFx0bnRpbGRlOiAyNDEsXG5cdFx0XHRvZ3JhdmU6IDI0Mixcblx0XHRcdG9hY3V0ZTogMjQzLFxuXHRcdFx0b2NpcmM6IDI0NCxcblx0XHRcdG90aWxkZTogMjQ1LFxuXHRcdFx0b3VtbDogMjQ2LFxuXHRcdFx0ZGl2aWRlOiAyNDcsXG5cdFx0XHRvc2xhc2g6IDI0OCxcblx0XHRcdHVncmF2ZTogMjQ5LFxuXHRcdFx0dWFjdXRlOiAyNTAsXG5cdFx0XHR1Y2lyYzogMjUxLFxuXHRcdFx0dXVtbDogMjUyLFxuXHRcdFx0eWFjdXRlOiAyNTMsXG5cdFx0XHR0aG9ybjogMjU0LFxuXHRcdFx0eXVtbDogMjU1LFxuXHRcdFx0T0VsaWc6IDMzOCxcblx0XHRcdG9lbGlnOiAzMzksXG5cdFx0XHRTY2Fyb246IDM1Mixcblx0XHRcdHNjYXJvbjogMzUzLFxuXHRcdFx0WXVtbDogMzc2LFxuXHRcdFx0Zm5vZjogNDAyLFxuXHRcdFx0Y2lyYzogNzEwLFxuXHRcdFx0dGlsZGU6IDczMixcblx0XHRcdEFscGhhOiA5MTMsXG5cdFx0XHRCZXRhOiA5MTQsXG5cdFx0XHRHYW1tYTogOTE1LFxuXHRcdFx0RGVsdGE6IDkxNixcblx0XHRcdEVwc2lsb246IDkxNyxcblx0XHRcdFpldGE6IDkxOCxcblx0XHRcdEV0YTogOTE5LFxuXHRcdFx0VGhldGE6IDkyMCxcblx0XHRcdElvdGE6IDkyMSxcblx0XHRcdEthcHBhOiA5MjIsXG5cdFx0XHRMYW1iZGE6IDkyMyxcblx0XHRcdE11OiA5MjQsXG5cdFx0XHROdTogOTI1LFxuXHRcdFx0WGk6IDkyNixcblx0XHRcdE9taWNyb246IDkyNyxcblx0XHRcdFBpOiA5MjgsXG5cdFx0XHRSaG86IDkyOSxcblx0XHRcdFNpZ21hOiA5MzEsXG5cdFx0XHRUYXU6IDkzMixcblx0XHRcdFVwc2lsb246IDkzMyxcblx0XHRcdFBoaTogOTM0LFxuXHRcdFx0Q2hpOiA5MzUsXG5cdFx0XHRQc2k6IDkzNixcblx0XHRcdE9tZWdhOiA5MzcsXG5cdFx0XHRhbHBoYTogOTQ1LFxuXHRcdFx0YmV0YTogOTQ2LFxuXHRcdFx0Z2FtbWE6IDk0Nyxcblx0XHRcdGRlbHRhOiA5NDgsXG5cdFx0XHRlcHNpbG9uOiA5NDksXG5cdFx0XHR6ZXRhOiA5NTAsXG5cdFx0XHRldGE6IDk1MSxcblx0XHRcdHRoZXRhOiA5NTIsXG5cdFx0XHRpb3RhOiA5NTMsXG5cdFx0XHRrYXBwYTogOTU0LFxuXHRcdFx0bGFtYmRhOiA5NTUsXG5cdFx0XHRtdTogOTU2LFxuXHRcdFx0bnU6IDk1Nyxcblx0XHRcdHhpOiA5NTgsXG5cdFx0XHRvbWljcm9uOiA5NTksXG5cdFx0XHRwaTogOTYwLFxuXHRcdFx0cmhvOiA5NjEsXG5cdFx0XHRzaWdtYWY6IDk2Mixcblx0XHRcdHNpZ21hOiA5NjMsXG5cdFx0XHR0YXU6IDk2NCxcblx0XHRcdHVwc2lsb246IDk2NSxcblx0XHRcdHBoaTogOTY2LFxuXHRcdFx0Y2hpOiA5NjcsXG5cdFx0XHRwc2k6IDk2OCxcblx0XHRcdG9tZWdhOiA5NjksXG5cdFx0XHR0aGV0YXN5bTogOTc3LFxuXHRcdFx0dXBzaWg6IDk3OCxcblx0XHRcdHBpdjogOTgyLFxuXHRcdFx0ZW5zcDogODE5NCxcblx0XHRcdGVtc3A6IDgxOTUsXG5cdFx0XHR0aGluc3A6IDgyMDEsXG5cdFx0XHR6d25qOiA4MjA0LFxuXHRcdFx0endqOiA4MjA1LFxuXHRcdFx0bHJtOiA4MjA2LFxuXHRcdFx0cmxtOiA4MjA3LFxuXHRcdFx0bmRhc2g6IDgyMTEsXG5cdFx0XHRtZGFzaDogODIxMixcblx0XHRcdGxzcXVvOiA4MjE2LFxuXHRcdFx0cnNxdW86IDgyMTcsXG5cdFx0XHRzYnF1bzogODIxOCxcblx0XHRcdGxkcXVvOiA4MjIwLFxuXHRcdFx0cmRxdW86IDgyMjEsXG5cdFx0XHRiZHF1bzogODIyMixcblx0XHRcdGRhZ2dlcjogODIyNCxcblx0XHRcdERhZ2dlcjogODIyNSxcblx0XHRcdGJ1bGw6IDgyMjYsXG5cdFx0XHRoZWxsaXA6IDgyMzAsXG5cdFx0XHRwZXJtaWw6IDgyNDAsXG5cdFx0XHRwcmltZTogODI0Mixcblx0XHRcdFByaW1lOiA4MjQzLFxuXHRcdFx0bHNhcXVvOiA4MjQ5LFxuXHRcdFx0cnNhcXVvOiA4MjUwLFxuXHRcdFx0b2xpbmU6IDgyNTQsXG5cdFx0XHRmcmFzbDogODI2MCxcblx0XHRcdGV1cm86IDgzNjQsXG5cdFx0XHRpbWFnZTogODQ2NSxcblx0XHRcdHdlaWVycDogODQ3Mixcblx0XHRcdHJlYWw6IDg0NzYsXG5cdFx0XHR0cmFkZTogODQ4Mixcblx0XHRcdGFsZWZzeW06IDg1MDEsXG5cdFx0XHRsYXJyOiA4NTkyLFxuXHRcdFx0dWFycjogODU5Myxcblx0XHRcdHJhcnI6IDg1OTQsXG5cdFx0XHRkYXJyOiA4NTk1LFxuXHRcdFx0aGFycjogODU5Nixcblx0XHRcdGNyYXJyOiA4NjI5LFxuXHRcdFx0bEFycjogODY1Nixcblx0XHRcdHVBcnI6IDg2NTcsXG5cdFx0XHRyQXJyOiA4NjU4LFxuXHRcdFx0ZEFycjogODY1OSxcblx0XHRcdGhBcnI6IDg2NjAsXG5cdFx0XHRmb3JhbGw6IDg3MDQsXG5cdFx0XHRwYXJ0OiA4NzA2LFxuXHRcdFx0ZXhpc3Q6IDg3MDcsXG5cdFx0XHRlbXB0eTogODcwOSxcblx0XHRcdG5hYmxhOiA4NzExLFxuXHRcdFx0aXNpbjogODcxMixcblx0XHRcdG5vdGluOiA4NzEzLFxuXHRcdFx0bmk6IDg3MTUsXG5cdFx0XHRwcm9kOiA4NzE5LFxuXHRcdFx0c3VtOiA4NzIxLFxuXHRcdFx0bWludXM6IDg3MjIsXG5cdFx0XHRsb3dhc3Q6IDg3MjcsXG5cdFx0XHRyYWRpYzogODczMCxcblx0XHRcdHByb3A6IDg3MzMsXG5cdFx0XHRpbmZpbjogODczNCxcblx0XHRcdGFuZzogODczNixcblx0XHRcdGFuZDogODc0Myxcblx0XHRcdG9yOiA4NzQ0LFxuXHRcdFx0Y2FwOiA4NzQ1LFxuXHRcdFx0Y3VwOiA4NzQ2LFxuXHRcdFx0J2ludCc6IDg3NDcsXG5cdFx0XHR0aGVyZTQ6IDg3NTYsXG5cdFx0XHRzaW06IDg3NjQsXG5cdFx0XHRjb25nOiA4NzczLFxuXHRcdFx0YXN5bXA6IDg3NzYsXG5cdFx0XHRuZTogODgwMCxcblx0XHRcdGVxdWl2OiA4ODAxLFxuXHRcdFx0bGU6IDg4MDQsXG5cdFx0XHRnZTogODgwNSxcblx0XHRcdHN1YjogODgzNCxcblx0XHRcdHN1cDogODgzNSxcblx0XHRcdG5zdWI6IDg4MzYsXG5cdFx0XHRzdWJlOiA4ODM4LFxuXHRcdFx0c3VwZTogODgzOSxcblx0XHRcdG9wbHVzOiA4ODUzLFxuXHRcdFx0b3RpbWVzOiA4ODU1LFxuXHRcdFx0cGVycDogODg2OSxcblx0XHRcdHNkb3Q6IDg5MDEsXG5cdFx0XHRsY2VpbDogODk2OCxcblx0XHRcdHJjZWlsOiA4OTY5LFxuXHRcdFx0bGZsb29yOiA4OTcwLFxuXHRcdFx0cmZsb29yOiA4OTcxLFxuXHRcdFx0bGFuZzogOTAwMSxcblx0XHRcdHJhbmc6IDkwMDIsXG5cdFx0XHRsb3o6IDk2NzQsXG5cdFx0XHRzcGFkZXM6IDk4MjQsXG5cdFx0XHRjbHViczogOTgyNyxcblx0XHRcdGhlYXJ0czogOTgyOSxcblx0XHRcdGRpYW1zOiA5ODMwXG5cdFx0fTtcblx0XHRjb250cm9sQ2hhcmFjdGVycyA9IFtcblx0XHRcdDgzNjQsXG5cdFx0XHQxMjksXG5cdFx0XHQ4MjE4LFxuXHRcdFx0NDAyLFxuXHRcdFx0ODIyMixcblx0XHRcdDgyMzAsXG5cdFx0XHQ4MjI0LFxuXHRcdFx0ODIyNSxcblx0XHRcdDcxMCxcblx0XHRcdDgyNDAsXG5cdFx0XHQzNTIsXG5cdFx0XHQ4MjQ5LFxuXHRcdFx0MzM4LFxuXHRcdFx0MTQxLFxuXHRcdFx0MzgxLFxuXHRcdFx0MTQzLFxuXHRcdFx0MTQ0LFxuXHRcdFx0ODIxNixcblx0XHRcdDgyMTcsXG5cdFx0XHQ4MjIwLFxuXHRcdFx0ODIyMSxcblx0XHRcdDgyMjYsXG5cdFx0XHQ4MjExLFxuXHRcdFx0ODIxMixcblx0XHRcdDczMixcblx0XHRcdDg0ODIsXG5cdFx0XHQzNTMsXG5cdFx0XHQ4MjUwLFxuXHRcdFx0MzM5LFxuXHRcdFx0MTU3LFxuXHRcdFx0MzgyLFxuXHRcdFx0Mzc2XG5cdFx0XTtcblx0XHRuYW1lZEVudGl0eVBhdHRlcm4gPSBuZXcgUmVnRXhwKCAnJignICsgT2JqZWN0LmtleXMoIGh0bWxFbnRpdGllcyApLmpvaW4oICd8JyApICsgJyk7PycsICdnJyApO1xuXHRcdGhleEVudGl0eVBhdHRlcm4gPSAvJiN4KFswLTldKyk7Py9nO1xuXHRcdGRlY2ltYWxFbnRpdHlQYXR0ZXJuID0gLyYjKFswLTldKyk7Py9nO1xuXHRcdHZhbGlkYXRlQ29kZSA9IGZ1bmN0aW9uKCBjb2RlICkge1xuXHRcdFx0aWYgKCAhY29kZSApIHtcblx0XHRcdFx0cmV0dXJuIDY1NTMzO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBjb2RlID09PSAxMCApIHtcblx0XHRcdFx0cmV0dXJuIDMyO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBjb2RlIDwgMTI4ICkge1xuXHRcdFx0XHRyZXR1cm4gY29kZTtcblx0XHRcdH1cblx0XHRcdGlmICggY29kZSA8PSAxNTkgKSB7XG5cdFx0XHRcdHJldHVybiBjb250cm9sQ2hhcmFjdGVyc1sgY29kZSAtIDEyOCBdO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBjb2RlIDwgNTUyOTYgKSB7XG5cdFx0XHRcdHJldHVybiBjb2RlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBjb2RlIDw9IDU3MzQzICkge1xuXHRcdFx0XHRyZXR1cm4gNjU1MzM7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGNvZGUgPD0gNjU1MzUgKSB7XG5cdFx0XHRcdHJldHVybiBjb2RlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIDY1NTMzO1xuXHRcdH07XG5cdFx0ZGVjb2RlQ2hhcmFjdGVyUmVmZXJlbmNlcyA9IGZ1bmN0aW9uKCBodG1sICkge1xuXHRcdFx0dmFyIHJlc3VsdDtcblx0XHRcdHJlc3VsdCA9IGh0bWwucmVwbGFjZSggbmFtZWRFbnRpdHlQYXR0ZXJuLCBmdW5jdGlvbiggbWF0Y2gsIG5hbWUgKSB7XG5cdFx0XHRcdGlmICggaHRtbEVudGl0aWVzWyBuYW1lIF0gKSB7XG5cdFx0XHRcdFx0cmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoIGh0bWxFbnRpdGllc1sgbmFtZSBdICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIG1hdGNoO1xuXHRcdFx0fSApO1xuXHRcdFx0cmVzdWx0ID0gcmVzdWx0LnJlcGxhY2UoIGhleEVudGl0eVBhdHRlcm4sIGZ1bmN0aW9uKCBtYXRjaCwgaGV4ICkge1xuXHRcdFx0XHRyZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZSggdmFsaWRhdGVDb2RlKCBwYXJzZUludCggaGV4LCAxNiApICkgKTtcblx0XHRcdH0gKTtcblx0XHRcdHJlc3VsdCA9IHJlc3VsdC5yZXBsYWNlKCBkZWNpbWFsRW50aXR5UGF0dGVybiwgZnVuY3Rpb24oIG1hdGNoLCBjaGFyQ29kZSApIHtcblx0XHRcdFx0cmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoIHZhbGlkYXRlQ29kZSggY2hhckNvZGUgKSApO1xuXHRcdFx0fSApO1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9O1xuXHRcdHdoaXRlc3BhY2UgPSAvXFxzKy9nO1xuXHRcdHJldHVybiBUZXh0U3R1Yjtcblx0fSggY29uZmlnX3R5cGVzICk7XG5cblx0dmFyIHBhcnNlX1BhcnNlcl9nZXRUZXh0X19nZXRUZXh0ID0gZnVuY3Rpb24oIHR5cGVzLCBUZXh0U3R1YiApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggdG9rZW4sIHByZXNlcnZlV2hpdGVzcGFjZSApIHtcblx0XHRcdGlmICggdG9rZW4udHlwZSA9PT0gdHlwZXMuVEVYVCApIHtcblx0XHRcdFx0dGhpcy5wb3MgKz0gMTtcblx0XHRcdFx0cmV0dXJuIG5ldyBUZXh0U3R1YiggdG9rZW4sIHByZXNlcnZlV2hpdGVzcGFjZSApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fTtcblx0fSggY29uZmlnX3R5cGVzLCBwYXJzZV9QYXJzZXJfZ2V0VGV4dF9UZXh0U3R1Yl9fVGV4dFN0dWIgKTtcblxuXHR2YXIgcGFyc2VfUGFyc2VyX2dldENvbW1lbnRfQ29tbWVudFN0dWJfX0NvbW1lbnRTdHViID0gZnVuY3Rpb24oIHR5cGVzICkge1xuXG5cdFx0dmFyIENvbW1lbnRTdHViO1xuXHRcdENvbW1lbnRTdHViID0gZnVuY3Rpb24oIHRva2VuICkge1xuXHRcdFx0dGhpcy5jb250ZW50ID0gdG9rZW4uY29udGVudDtcblx0XHR9O1xuXHRcdENvbW1lbnRTdHViLnByb3RvdHlwZSA9IHtcblx0XHRcdHRvSlNPTjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0dDogdHlwZXMuQ09NTUVOVCxcblx0XHRcdFx0XHRmOiB0aGlzLmNvbnRlbnRcblx0XHRcdFx0fTtcblx0XHRcdH0sXG5cdFx0XHR0b1N0cmluZzogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiAnPCEtLScgKyB0aGlzLmNvbnRlbnQgKyAnLS0+Jztcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBDb21tZW50U3R1Yjtcblx0fSggY29uZmlnX3R5cGVzICk7XG5cblx0dmFyIHBhcnNlX1BhcnNlcl9nZXRDb21tZW50X19nZXRDb21tZW50ID0gZnVuY3Rpb24oIHR5cGVzLCBDb21tZW50U3R1YiApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggdG9rZW4gKSB7XG5cdFx0XHRpZiAoIHRva2VuLnR5cGUgPT09IHR5cGVzLkNPTU1FTlQgKSB7XG5cdFx0XHRcdHRoaXMucG9zICs9IDE7XG5cdFx0XHRcdHJldHVybiBuZXcgQ29tbWVudFN0dWIoIHRva2VuLCB0aGlzLnByZXNlcnZlV2hpdGVzcGFjZSApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fTtcblx0fSggY29uZmlnX3R5cGVzLCBwYXJzZV9QYXJzZXJfZ2V0Q29tbWVudF9Db21tZW50U3R1Yl9fQ29tbWVudFN0dWIgKTtcblxuXHR2YXIgcGFyc2VfUGFyc2VyX2dldE11c3RhY2hlX0V4cHJlc3Npb25TdHViX19FeHByZXNzaW9uU3R1YiA9IGZ1bmN0aW9uKCB0eXBlcywgaXNPYmplY3QgKSB7XG5cblx0XHR2YXIgRXhwcmVzc2lvblN0dWIgPSBmdW5jdGlvbiggdG9rZW4gKSB7XG5cdFx0XHR0aGlzLnJlZnMgPSBbXTtcblx0XHRcdGdldFJlZnMoIHRva2VuLCB0aGlzLnJlZnMgKTtcblx0XHRcdHRoaXMuc3RyID0gc3RyaW5naWZ5KCB0b2tlbiwgdGhpcy5yZWZzICk7XG5cdFx0fTtcblx0XHRFeHByZXNzaW9uU3R1Yi5wcm90b3R5cGUgPSB7XG5cdFx0XHR0b0pTT046IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZiAoIHRoaXMuanNvbiApIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5qc29uO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuanNvbiA9IHtcblx0XHRcdFx0XHRyOiB0aGlzLnJlZnMsXG5cdFx0XHRcdFx0czogdGhpcy5zdHJcblx0XHRcdFx0fTtcblx0XHRcdFx0cmV0dXJuIHRoaXMuanNvbjtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBFeHByZXNzaW9uU3R1YjtcblxuXHRcdGZ1bmN0aW9uIHF1b3RlU3RyaW5nTGl0ZXJhbCggc3RyICkge1xuXHRcdFx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KCBTdHJpbmcoIHN0ciApICk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0UmVmcyggdG9rZW4sIHJlZnMgKSB7XG5cdFx0XHR2YXIgaSwgbGlzdDtcblx0XHRcdGlmICggdG9rZW4udCA9PT0gdHlwZXMuUkVGRVJFTkNFICkge1xuXHRcdFx0XHRpZiAoIHJlZnMuaW5kZXhPZiggdG9rZW4ubiApID09PSAtMSApIHtcblx0XHRcdFx0XHRyZWZzLnVuc2hpZnQoIHRva2VuLm4gKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0bGlzdCA9IHRva2VuLm8gfHwgdG9rZW4ubTtcblx0XHRcdGlmICggbGlzdCApIHtcblx0XHRcdFx0aWYgKCBpc09iamVjdCggbGlzdCApICkge1xuXHRcdFx0XHRcdGdldFJlZnMoIGxpc3QsIHJlZnMgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRpID0gbGlzdC5sZW5ndGg7XG5cdFx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0XHRnZXRSZWZzKCBsaXN0WyBpIF0sIHJlZnMgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICggdG9rZW4ueCApIHtcblx0XHRcdFx0Z2V0UmVmcyggdG9rZW4ueCwgcmVmcyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0b2tlbi5yICkge1xuXHRcdFx0XHRnZXRSZWZzKCB0b2tlbi5yLCByZWZzICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRva2VuLnYgKSB7XG5cdFx0XHRcdGdldFJlZnMoIHRva2VuLnYsIHJlZnMgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRmdW5jdGlvbiBzdHJpbmdpZnkoIHRva2VuLCByZWZzICkge1xuXHRcdFx0dmFyIG1hcCA9IGZ1bmN0aW9uKCBpdGVtICkge1xuXHRcdFx0XHRyZXR1cm4gc3RyaW5naWZ5KCBpdGVtLCByZWZzICk7XG5cdFx0XHR9O1xuXHRcdFx0c3dpdGNoICggdG9rZW4udCApIHtcblx0XHRcdFx0Y2FzZSB0eXBlcy5CT09MRUFOX0xJVEVSQUw6XG5cdFx0XHRcdGNhc2UgdHlwZXMuR0xPQkFMOlxuXHRcdFx0XHRjYXNlIHR5cGVzLk5VTUJFUl9MSVRFUkFMOlxuXHRcdFx0XHRcdHJldHVybiB0b2tlbi52O1xuXHRcdFx0XHRjYXNlIHR5cGVzLlNUUklOR19MSVRFUkFMOlxuXHRcdFx0XHRcdHJldHVybiBxdW90ZVN0cmluZ0xpdGVyYWwoIHRva2VuLnYgKTtcblx0XHRcdFx0Y2FzZSB0eXBlcy5BUlJBWV9MSVRFUkFMOlxuXHRcdFx0XHRcdHJldHVybiAnWycgKyAoIHRva2VuLm0gPyB0b2tlbi5tLm1hcCggbWFwICkuam9pbiggJywnICkgOiAnJyApICsgJ10nO1xuXHRcdFx0XHRjYXNlIHR5cGVzLk9CSkVDVF9MSVRFUkFMOlxuXHRcdFx0XHRcdHJldHVybiAneycgKyAoIHRva2VuLm0gPyB0b2tlbi5tLm1hcCggbWFwICkuam9pbiggJywnICkgOiAnJyApICsgJ30nO1xuXHRcdFx0XHRjYXNlIHR5cGVzLktFWV9WQUxVRV9QQUlSOlxuXHRcdFx0XHRcdHJldHVybiB0b2tlbi5rICsgJzonICsgc3RyaW5naWZ5KCB0b2tlbi52LCByZWZzICk7XG5cdFx0XHRcdGNhc2UgdHlwZXMuUFJFRklYX09QRVJBVE9SOlxuXHRcdFx0XHRcdHJldHVybiAoIHRva2VuLnMgPT09ICd0eXBlb2YnID8gJ3R5cGVvZiAnIDogdG9rZW4ucyApICsgc3RyaW5naWZ5KCB0b2tlbi5vLCByZWZzICk7XG5cdFx0XHRcdGNhc2UgdHlwZXMuSU5GSVhfT1BFUkFUT1I6XG5cdFx0XHRcdFx0cmV0dXJuIHN0cmluZ2lmeSggdG9rZW4ub1sgMCBdLCByZWZzICkgKyAoIHRva2VuLnMuc3Vic3RyKCAwLCAyICkgPT09ICdpbicgPyAnICcgKyB0b2tlbi5zICsgJyAnIDogdG9rZW4ucyApICsgc3RyaW5naWZ5KCB0b2tlbi5vWyAxIF0sIHJlZnMgKTtcblx0XHRcdFx0Y2FzZSB0eXBlcy5JTlZPQ0FUSU9OOlxuXHRcdFx0XHRcdHJldHVybiBzdHJpbmdpZnkoIHRva2VuLngsIHJlZnMgKSArICcoJyArICggdG9rZW4ubyA/IHRva2VuLm8ubWFwKCBtYXAgKS5qb2luKCAnLCcgKSA6ICcnICkgKyAnKSc7XG5cdFx0XHRcdGNhc2UgdHlwZXMuQlJBQ0tFVEVEOlxuXHRcdFx0XHRcdHJldHVybiAnKCcgKyBzdHJpbmdpZnkoIHRva2VuLngsIHJlZnMgKSArICcpJztcblx0XHRcdFx0Y2FzZSB0eXBlcy5NRU1CRVI6XG5cdFx0XHRcdFx0cmV0dXJuIHN0cmluZ2lmeSggdG9rZW4ueCwgcmVmcyApICsgc3RyaW5naWZ5KCB0b2tlbi5yLCByZWZzICk7XG5cdFx0XHRcdGNhc2UgdHlwZXMuUkVGSU5FTUVOVDpcblx0XHRcdFx0XHRyZXR1cm4gdG9rZW4ubiA/ICcuJyArIHRva2VuLm4gOiAnWycgKyBzdHJpbmdpZnkoIHRva2VuLngsIHJlZnMgKSArICddJztcblx0XHRcdFx0Y2FzZSB0eXBlcy5DT05ESVRJT05BTDpcblx0XHRcdFx0XHRyZXR1cm4gc3RyaW5naWZ5KCB0b2tlbi5vWyAwIF0sIHJlZnMgKSArICc/JyArIHN0cmluZ2lmeSggdG9rZW4ub1sgMSBdLCByZWZzICkgKyAnOicgKyBzdHJpbmdpZnkoIHRva2VuLm9bIDIgXSwgcmVmcyApO1xuXHRcdFx0XHRjYXNlIHR5cGVzLlJFRkVSRU5DRTpcblx0XHRcdFx0XHRyZXR1cm4gJyR7JyArIHJlZnMuaW5kZXhPZiggdG9rZW4ubiApICsgJ30nO1xuXHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ0NvdWxkIG5vdCBzdHJpbmdpZnkgZXhwcmVzc2lvbiB0b2tlbi4gVGhpcyBlcnJvciBpcyB1bmV4cGVjdGVkJyApO1xuXHRcdFx0fVxuXHRcdH1cblx0fSggY29uZmlnX3R5cGVzLCB1dGlsc19pc09iamVjdCApO1xuXG5cdHZhciBwYXJzZV9QYXJzZXJfZ2V0TXVzdGFjaGVfTXVzdGFjaGVTdHViX19NdXN0YWNoZVN0dWIgPSBmdW5jdGlvbiggdHlwZXMsIEV4cHJlc3Npb25TdHViICkge1xuXG5cdFx0dmFyIE11c3RhY2hlU3R1YiA9IGZ1bmN0aW9uKCB0b2tlbiwgcGFyc2VyICkge1xuXHRcdFx0dGhpcy50eXBlID0gdG9rZW4udHlwZSA9PT0gdHlwZXMuVFJJUExFID8gdHlwZXMuVFJJUExFIDogdG9rZW4ubXVzdGFjaGVUeXBlO1xuXHRcdFx0aWYgKCB0b2tlbi5yZWYgKSB7XG5cdFx0XHRcdHRoaXMucmVmID0gdG9rZW4ucmVmO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0b2tlbi5leHByZXNzaW9uICkge1xuXHRcdFx0XHR0aGlzLmV4cHIgPSBuZXcgRXhwcmVzc2lvblN0dWIoIHRva2VuLmV4cHJlc3Npb24gKTtcblx0XHRcdH1cblx0XHRcdHBhcnNlci5wb3MgKz0gMTtcblx0XHR9O1xuXHRcdE11c3RhY2hlU3R1Yi5wcm90b3R5cGUgPSB7XG5cdFx0XHR0b0pTT046IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIganNvbjtcblx0XHRcdFx0aWYgKCB0aGlzLmpzb24gKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuanNvbjtcblx0XHRcdFx0fVxuXHRcdFx0XHRqc29uID0ge1xuXHRcdFx0XHRcdHQ6IHRoaXMudHlwZVxuXHRcdFx0XHR9O1xuXHRcdFx0XHRpZiAoIHRoaXMucmVmICkge1xuXHRcdFx0XHRcdGpzb24uciA9IHRoaXMucmVmO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggdGhpcy5leHByICkge1xuXHRcdFx0XHRcdGpzb24ueCA9IHRoaXMuZXhwci50b0pTT04oKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLmpzb24gPSBqc29uO1xuXHRcdFx0XHRyZXR1cm4ganNvbjtcblx0XHRcdH0sXG5cdFx0XHR0b1N0cmluZzogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBNdXN0YWNoZVN0dWI7XG5cdH0oIGNvbmZpZ190eXBlcywgcGFyc2VfUGFyc2VyX2dldE11c3RhY2hlX0V4cHJlc3Npb25TdHViX19FeHByZXNzaW9uU3R1YiApO1xuXG5cdHZhciBwYXJzZV9QYXJzZXJfdXRpbHNfc3RyaW5naWZ5U3R1YnMgPSBmdW5jdGlvbiggaXRlbXMgKSB7XG5cdFx0dmFyIHN0ciA9ICcnLFxuXHRcdFx0aXRlbVN0ciwgaSwgbGVuO1xuXHRcdGlmICggIWl0ZW1zICkge1xuXHRcdFx0cmV0dXJuICcnO1xuXHRcdH1cblx0XHRmb3IgKCBpID0gMCwgbGVuID0gaXRlbXMubGVuZ3RoOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRpdGVtU3RyID0gaXRlbXNbIGkgXS50b1N0cmluZygpO1xuXHRcdFx0aWYgKCBpdGVtU3RyID09PSBmYWxzZSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0c3RyICs9IGl0ZW1TdHI7XG5cdFx0fVxuXHRcdHJldHVybiBzdHI7XG5cdH07XG5cblx0dmFyIHBhcnNlX1BhcnNlcl91dGlsc19qc29uaWZ5U3R1YnMgPSBmdW5jdGlvbiggc3RyaW5naWZ5U3R1YnMgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIGl0ZW1zLCBub1N0cmluZ2lmeSwgdG9wTGV2ZWwgKSB7XG5cdFx0XHR2YXIgc3RyLCBqc29uO1xuXHRcdFx0aWYgKCAhdG9wTGV2ZWwgJiYgIW5vU3RyaW5naWZ5ICkge1xuXHRcdFx0XHRzdHIgPSBzdHJpbmdpZnlTdHVicyggaXRlbXMgKTtcblx0XHRcdFx0aWYgKCBzdHIgIT09IGZhbHNlICkge1xuXHRcdFx0XHRcdHJldHVybiBzdHI7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGpzb24gPSBpdGVtcy5tYXAoIGZ1bmN0aW9uKCBpdGVtICkge1xuXHRcdFx0XHRyZXR1cm4gaXRlbS50b0pTT04oIG5vU3RyaW5naWZ5ICk7XG5cdFx0XHR9ICk7XG5cdFx0XHRyZXR1cm4ganNvbjtcblx0XHR9O1xuXHR9KCBwYXJzZV9QYXJzZXJfdXRpbHNfc3RyaW5naWZ5U3R1YnMgKTtcblxuXHR2YXIgcGFyc2VfUGFyc2VyX2dldE11c3RhY2hlX1NlY3Rpb25TdHViX19TZWN0aW9uU3R1YiA9IGZ1bmN0aW9uKCB0eXBlcywgbm9ybWFsaXNlS2V5cGF0aCwganNvbmlmeVN0dWJzLCBFeHByZXNzaW9uU3R1YiApIHtcblxuXHRcdHZhciBTZWN0aW9uU3R1YiA9IGZ1bmN0aW9uKCBmaXJzdFRva2VuLCBwYXJzZXIgKSB7XG5cdFx0XHR2YXIgbmV4dDtcblx0XHRcdHRoaXMucmVmID0gZmlyc3RUb2tlbi5yZWY7XG5cdFx0XHR0aGlzLmluZGV4UmVmID0gZmlyc3RUb2tlbi5pbmRleFJlZjtcblx0XHRcdHRoaXMuaW52ZXJ0ZWQgPSBmaXJzdFRva2VuLm11c3RhY2hlVHlwZSA9PT0gdHlwZXMuSU5WRVJURUQ7XG5cdFx0XHRpZiAoIGZpcnN0VG9rZW4uZXhwcmVzc2lvbiApIHtcblx0XHRcdFx0dGhpcy5leHByID0gbmV3IEV4cHJlc3Npb25TdHViKCBmaXJzdFRva2VuLmV4cHJlc3Npb24gKTtcblx0XHRcdH1cblx0XHRcdHBhcnNlci5wb3MgKz0gMTtcblx0XHRcdHRoaXMuaXRlbXMgPSBbXTtcblx0XHRcdG5leHQgPSBwYXJzZXIubmV4dCgpO1xuXHRcdFx0d2hpbGUgKCBuZXh0ICkge1xuXHRcdFx0XHRpZiAoIG5leHQubXVzdGFjaGVUeXBlID09PSB0eXBlcy5DTE9TSU5HICkge1xuXHRcdFx0XHRcdGlmICggbm9ybWFsaXNlS2V5cGF0aCggbmV4dC5yZWYudHJpbSgpICkgPT09IHRoaXMucmVmIHx8IHRoaXMuZXhwciApIHtcblx0XHRcdFx0XHRcdHBhcnNlci5wb3MgKz0gMTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdDb3VsZCBub3QgcGFyc2UgdGVtcGxhdGU6IElsbGVnYWwgY2xvc2luZyBzZWN0aW9uJyApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLml0ZW1zLnB1c2goIHBhcnNlci5nZXRTdHViKCkgKTtcblx0XHRcdFx0bmV4dCA9IHBhcnNlci5uZXh0KCk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRTZWN0aW9uU3R1Yi5wcm90b3R5cGUgPSB7XG5cdFx0XHR0b0pTT046IGZ1bmN0aW9uKCBub1N0cmluZ2lmeSApIHtcblx0XHRcdFx0dmFyIGpzb247XG5cdFx0XHRcdGlmICggdGhpcy5qc29uICkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmpzb247XG5cdFx0XHRcdH1cblx0XHRcdFx0anNvbiA9IHtcblx0XHRcdFx0XHR0OiB0eXBlcy5TRUNUSU9OXG5cdFx0XHRcdH07XG5cdFx0XHRcdGlmICggdGhpcy5yZWYgKSB7XG5cdFx0XHRcdFx0anNvbi5yID0gdGhpcy5yZWY7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCB0aGlzLmluZGV4UmVmICkge1xuXHRcdFx0XHRcdGpzb24uaSA9IHRoaXMuaW5kZXhSZWY7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCB0aGlzLmludmVydGVkICkge1xuXHRcdFx0XHRcdGpzb24ubiA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCB0aGlzLmV4cHIgKSB7XG5cdFx0XHRcdFx0anNvbi54ID0gdGhpcy5leHByLnRvSlNPTigpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggdGhpcy5pdGVtcy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0anNvbi5mID0ganNvbmlmeVN0dWJzKCB0aGlzLml0ZW1zLCBub1N0cmluZ2lmeSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuanNvbiA9IGpzb247XG5cdFx0XHRcdHJldHVybiBqc29uO1xuXHRcdFx0fSxcblx0XHRcdHRvU3RyaW5nOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIFNlY3Rpb25TdHViO1xuXHR9KCBjb25maWdfdHlwZXMsIHV0aWxzX25vcm1hbGlzZUtleXBhdGgsIHBhcnNlX1BhcnNlcl91dGlsc19qc29uaWZ5U3R1YnMsIHBhcnNlX1BhcnNlcl9nZXRNdXN0YWNoZV9FeHByZXNzaW9uU3R1Yl9fRXhwcmVzc2lvblN0dWIgKTtcblxuXHR2YXIgcGFyc2VfUGFyc2VyX2dldE11c3RhY2hlX19nZXRNdXN0YWNoZSA9IGZ1bmN0aW9uKCB0eXBlcywgTXVzdGFjaGVTdHViLCBTZWN0aW9uU3R1YiApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggdG9rZW4gKSB7XG5cdFx0XHRpZiAoIHRva2VuLnR5cGUgPT09IHR5cGVzLk1VU1RBQ0hFIHx8IHRva2VuLnR5cGUgPT09IHR5cGVzLlRSSVBMRSApIHtcblx0XHRcdFx0aWYgKCB0b2tlbi5tdXN0YWNoZVR5cGUgPT09IHR5cGVzLlNFQ1RJT04gfHwgdG9rZW4ubXVzdGFjaGVUeXBlID09PSB0eXBlcy5JTlZFUlRFRCApIHtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IFNlY3Rpb25TdHViKCB0b2tlbiwgdGhpcyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBuZXcgTXVzdGFjaGVTdHViKCB0b2tlbiwgdGhpcyApO1xuXHRcdFx0fVxuXHRcdH07XG5cdH0oIGNvbmZpZ190eXBlcywgcGFyc2VfUGFyc2VyX2dldE11c3RhY2hlX011c3RhY2hlU3R1Yl9fTXVzdGFjaGVTdHViLCBwYXJzZV9QYXJzZXJfZ2V0TXVzdGFjaGVfU2VjdGlvblN0dWJfX1NlY3Rpb25TdHViICk7XG5cblx0dmFyIHBhcnNlX1BhcnNlcl9nZXRFbGVtZW50X0VsZW1lbnRTdHViX3V0aWxzX3NpYmxpbmdzQnlUYWdOYW1lID0ge1xuXHRcdGxpOiBbICdsaScgXSxcblx0XHRkdDogW1xuXHRcdFx0J2R0Jyxcblx0XHRcdCdkZCdcblx0XHRdLFxuXHRcdGRkOiBbXG5cdFx0XHQnZHQnLFxuXHRcdFx0J2RkJ1xuXHRcdF0sXG5cdFx0cDogJ2FkZHJlc3MgYXJ0aWNsZSBhc2lkZSBibG9ja3F1b3RlIGRpciBkaXYgZGwgZmllbGRzZXQgZm9vdGVyIGZvcm0gaDEgaDIgaDMgaDQgaDUgaDYgaGVhZGVyIGhncm91cCBociBtZW51IG5hdiBvbCBwIHByZSBzZWN0aW9uIHRhYmxlIHVsJy5zcGxpdCggJyAnICksXG5cdFx0cnQ6IFtcblx0XHRcdCdydCcsXG5cdFx0XHQncnAnXG5cdFx0XSxcblx0XHRycDogW1xuXHRcdFx0J3JwJyxcblx0XHRcdCdydCdcblx0XHRdLFxuXHRcdG9wdGdyb3VwOiBbICdvcHRncm91cCcgXSxcblx0XHRvcHRpb246IFtcblx0XHRcdCdvcHRpb24nLFxuXHRcdFx0J29wdGdyb3VwJ1xuXHRcdF0sXG5cdFx0dGhlYWQ6IFtcblx0XHRcdCd0Ym9keScsXG5cdFx0XHQndGZvb3QnXG5cdFx0XSxcblx0XHR0Ym9keTogW1xuXHRcdFx0J3Rib2R5Jyxcblx0XHRcdCd0Zm9vdCdcblx0XHRdLFxuXHRcdHRyOiBbICd0cicgXSxcblx0XHR0ZDogW1xuXHRcdFx0J3RkJyxcblx0XHRcdCd0aCdcblx0XHRdLFxuXHRcdHRoOiBbXG5cdFx0XHQndGQnLFxuXHRcdFx0J3RoJ1xuXHRcdF1cblx0fTtcblxuXHR2YXIgcGFyc2VfUGFyc2VyX2dldEVsZW1lbnRfRWxlbWVudFN0dWJfdXRpbHNfZmlsdGVyQXR0cmlidXRlcyA9IGZ1bmN0aW9uKCBpc0FycmF5ICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBpdGVtcyApIHtcblx0XHRcdHZhciBhdHRycywgcHJveGllcywgZmlsdGVyZWQsIGksIGxlbiwgaXRlbTtcblx0XHRcdGZpbHRlcmVkID0ge307XG5cdFx0XHRhdHRycyA9IFtdO1xuXHRcdFx0cHJveGllcyA9IFtdO1xuXHRcdFx0bGVuID0gaXRlbXMubGVuZ3RoO1xuXHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0aXRlbSA9IGl0ZW1zWyBpIF07XG5cdFx0XHRcdGlmICggaXRlbS5uYW1lID09PSAnaW50cm8nICkge1xuXHRcdFx0XHRcdGlmICggZmlsdGVyZWQuaW50cm8gKSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdBbiBlbGVtZW50IGNhbiBvbmx5IGhhdmUgb25lIGludHJvIHRyYW5zaXRpb24nICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGZpbHRlcmVkLmludHJvID0gaXRlbTtcblx0XHRcdFx0fSBlbHNlIGlmICggaXRlbS5uYW1lID09PSAnb3V0cm8nICkge1xuXHRcdFx0XHRcdGlmICggZmlsdGVyZWQub3V0cm8gKSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdBbiBlbGVtZW50IGNhbiBvbmx5IGhhdmUgb25lIG91dHJvIHRyYW5zaXRpb24nICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGZpbHRlcmVkLm91dHJvID0gaXRlbTtcblx0XHRcdFx0fSBlbHNlIGlmICggaXRlbS5uYW1lID09PSAnaW50cm8tb3V0cm8nICkge1xuXHRcdFx0XHRcdGlmICggZmlsdGVyZWQuaW50cm8gfHwgZmlsdGVyZWQub3V0cm8gKSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdBbiBlbGVtZW50IGNhbiBvbmx5IGhhdmUgb25lIGludHJvIGFuZCBvbmUgb3V0cm8gdHJhbnNpdGlvbicgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZmlsdGVyZWQuaW50cm8gPSBpdGVtO1xuXHRcdFx0XHRcdGZpbHRlcmVkLm91dHJvID0gZGVlcENsb25lKCBpdGVtICk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoIGl0ZW0ubmFtZS5zdWJzdHIoIDAsIDYgKSA9PT0gJ3Byb3h5LScgKSB7XG5cdFx0XHRcdFx0aXRlbS5uYW1lID0gaXRlbS5uYW1lLnN1YnN0cmluZyggNiApO1xuXHRcdFx0XHRcdHByb3hpZXMucHVzaCggaXRlbSApO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCBpdGVtLm5hbWUuc3Vic3RyKCAwLCAzICkgPT09ICdvbi0nICkge1xuXHRcdFx0XHRcdGl0ZW0ubmFtZSA9IGl0ZW0ubmFtZS5zdWJzdHJpbmcoIDMgKTtcblx0XHRcdFx0XHRwcm94aWVzLnB1c2goIGl0ZW0gKTtcblx0XHRcdFx0fSBlbHNlIGlmICggaXRlbS5uYW1lID09PSAnZGVjb3JhdG9yJyApIHtcblx0XHRcdFx0XHRmaWx0ZXJlZC5kZWNvcmF0b3IgPSBpdGVtO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGF0dHJzLnB1c2goIGl0ZW0gKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0ZmlsdGVyZWQuYXR0cnMgPSBhdHRycztcblx0XHRcdGZpbHRlcmVkLnByb3hpZXMgPSBwcm94aWVzO1xuXHRcdFx0cmV0dXJuIGZpbHRlcmVkO1xuXHRcdH07XG5cblx0XHRmdW5jdGlvbiBkZWVwQ2xvbmUoIG9iaiApIHtcblx0XHRcdHZhciByZXN1bHQsIGtleTtcblx0XHRcdGlmICggdHlwZW9mIG9iaiAhPT0gJ29iamVjdCcgKSB7XG5cdFx0XHRcdHJldHVybiBvYmo7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGlzQXJyYXkoIG9iaiApICkge1xuXHRcdFx0XHRyZXR1cm4gb2JqLm1hcCggZGVlcENsb25lICk7XG5cdFx0XHR9XG5cdFx0XHRyZXN1bHQgPSB7fTtcblx0XHRcdGZvciAoIGtleSBpbiBvYmogKSB7XG5cdFx0XHRcdGlmICggb2JqLmhhc093blByb3BlcnR5KCBrZXkgKSApIHtcblx0XHRcdFx0XHRyZXN1bHRbIGtleSBdID0gZGVlcENsb25lKCBvYmpbIGtleSBdICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXHR9KCB1dGlsc19pc0FycmF5ICk7XG5cblx0dmFyIHBhcnNlX1BhcnNlcl9nZXRFbGVtZW50X0VsZW1lbnRTdHViX3V0aWxzX3Byb2Nlc3NEaXJlY3RpdmUgPSBmdW5jdGlvbiggdHlwZXMsIHBhcnNlSlNPTiApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggZGlyZWN0aXZlICkge1xuXHRcdFx0dmFyIHByb2Nlc3NlZCwgdG9rZW5zLCB0b2tlbiwgY29sb25JbmRleCwgdGhyb3dFcnJvciwgZGlyZWN0aXZlTmFtZSwgZGlyZWN0aXZlQXJncywgcGFyc2VkO1xuXHRcdFx0dGhyb3dFcnJvciA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdJbGxlZ2FsIGRpcmVjdGl2ZScgKTtcblx0XHRcdH07XG5cdFx0XHRpZiAoICFkaXJlY3RpdmUubmFtZSB8fCAhZGlyZWN0aXZlLnZhbHVlICkge1xuXHRcdFx0XHR0aHJvd0Vycm9yKCk7XG5cdFx0XHR9XG5cdFx0XHRwcm9jZXNzZWQgPSB7XG5cdFx0XHRcdGRpcmVjdGl2ZVR5cGU6IGRpcmVjdGl2ZS5uYW1lXG5cdFx0XHR9O1xuXHRcdFx0dG9rZW5zID0gZGlyZWN0aXZlLnZhbHVlO1xuXHRcdFx0ZGlyZWN0aXZlTmFtZSA9IFtdO1xuXHRcdFx0ZGlyZWN0aXZlQXJncyA9IFtdO1xuXHRcdFx0d2hpbGUgKCB0b2tlbnMubGVuZ3RoICkge1xuXHRcdFx0XHR0b2tlbiA9IHRva2Vucy5zaGlmdCgpO1xuXHRcdFx0XHRpZiAoIHRva2VuLnR5cGUgPT09IHR5cGVzLlRFWFQgKSB7XG5cdFx0XHRcdFx0Y29sb25JbmRleCA9IHRva2VuLnZhbHVlLmluZGV4T2YoICc6JyApO1xuXHRcdFx0XHRcdGlmICggY29sb25JbmRleCA9PT0gLTEgKSB7XG5cdFx0XHRcdFx0XHRkaXJlY3RpdmVOYW1lLnB1c2goIHRva2VuICk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGlmICggY29sb25JbmRleCApIHtcblx0XHRcdFx0XHRcdFx0ZGlyZWN0aXZlTmFtZS5wdXNoKCB7XG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogdHlwZXMuVEVYVCxcblx0XHRcdFx0XHRcdFx0XHR2YWx1ZTogdG9rZW4udmFsdWUuc3Vic3RyKCAwLCBjb2xvbkluZGV4IClcblx0XHRcdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKCB0b2tlbi52YWx1ZS5sZW5ndGggPiBjb2xvbkluZGV4ICsgMSApIHtcblx0XHRcdFx0XHRcdFx0ZGlyZWN0aXZlQXJnc1sgMCBdID0ge1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6IHR5cGVzLlRFWFQsXG5cdFx0XHRcdFx0XHRcdFx0dmFsdWU6IHRva2VuLnZhbHVlLnN1YnN0cmluZyggY29sb25JbmRleCArIDEgKVxuXHRcdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGRpcmVjdGl2ZU5hbWUucHVzaCggdG9rZW4gKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0ZGlyZWN0aXZlQXJncyA9IGRpcmVjdGl2ZUFyZ3MuY29uY2F0KCB0b2tlbnMgKTtcblx0XHRcdGlmICggZGlyZWN0aXZlTmFtZS5sZW5ndGggPT09IDEgJiYgZGlyZWN0aXZlTmFtZVsgMCBdLnR5cGUgPT09IHR5cGVzLlRFWFQgKSB7XG5cdFx0XHRcdHByb2Nlc3NlZC5uYW1lID0gZGlyZWN0aXZlTmFtZVsgMCBdLnZhbHVlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cHJvY2Vzc2VkLm5hbWUgPSBkaXJlY3RpdmVOYW1lO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBkaXJlY3RpdmVBcmdzLmxlbmd0aCApIHtcblx0XHRcdFx0aWYgKCBkaXJlY3RpdmVBcmdzLmxlbmd0aCA9PT0gMSAmJiBkaXJlY3RpdmVBcmdzWyAwIF0udHlwZSA9PT0gdHlwZXMuVEVYVCApIHtcblx0XHRcdFx0XHRwYXJzZWQgPSBwYXJzZUpTT04oICdbJyArIGRpcmVjdGl2ZUFyZ3NbIDAgXS52YWx1ZSArICddJyApO1xuXHRcdFx0XHRcdHByb2Nlc3NlZC5hcmdzID0gcGFyc2VkID8gcGFyc2VkLnZhbHVlIDogZGlyZWN0aXZlQXJnc1sgMCBdLnZhbHVlO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHByb2Nlc3NlZC5keW5hbWljQXJncyA9IGRpcmVjdGl2ZUFyZ3M7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBwcm9jZXNzZWQ7XG5cdFx0fTtcblx0fSggY29uZmlnX3R5cGVzLCB1dGlsc19wYXJzZUpTT04gKTtcblxuXHR2YXIgcGFyc2VfUGFyc2VyX1N0cmluZ1N0dWJfU3RyaW5nUGFyc2VyID0gZnVuY3Rpb24oIGdldFRleHQsIGdldE11c3RhY2hlICkge1xuXG5cdFx0dmFyIFN0cmluZ1BhcnNlcjtcblx0XHRTdHJpbmdQYXJzZXIgPSBmdW5jdGlvbiggdG9rZW5zLCBvcHRpb25zICkge1xuXHRcdFx0dmFyIHN0dWI7XG5cdFx0XHR0aGlzLnRva2VucyA9IHRva2VucyB8fCBbXTtcblx0XHRcdHRoaXMucG9zID0gMDtcblx0XHRcdHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG5cdFx0XHR0aGlzLnJlc3VsdCA9IFtdO1xuXHRcdFx0d2hpbGUgKCBzdHViID0gdGhpcy5nZXRTdHViKCkgKSB7XG5cdFx0XHRcdHRoaXMucmVzdWx0LnB1c2goIHN0dWIgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdFN0cmluZ1BhcnNlci5wcm90b3R5cGUgPSB7XG5cdFx0XHRnZXRTdHViOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHRva2VuID0gdGhpcy5uZXh0KCk7XG5cdFx0XHRcdGlmICggIXRva2VuICkge1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0aGlzLmdldFRleHQoIHRva2VuICkgfHwgdGhpcy5nZXRNdXN0YWNoZSggdG9rZW4gKTtcblx0XHRcdH0sXG5cdFx0XHRnZXRUZXh0OiBnZXRUZXh0LFxuXHRcdFx0Z2V0TXVzdGFjaGU6IGdldE11c3RhY2hlLFxuXHRcdFx0bmV4dDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnRva2Vuc1sgdGhpcy5wb3MgXTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBTdHJpbmdQYXJzZXI7XG5cdH0oIHBhcnNlX1BhcnNlcl9nZXRUZXh0X19nZXRUZXh0LCBwYXJzZV9QYXJzZXJfZ2V0TXVzdGFjaGVfX2dldE11c3RhY2hlICk7XG5cblx0dmFyIHBhcnNlX1BhcnNlcl9TdHJpbmdTdHViX19TdHJpbmdTdHViID0gZnVuY3Rpb24oIFN0cmluZ1BhcnNlciwgc3RyaW5naWZ5U3R1YnMsIGpzb25pZnlTdHVicyApIHtcblxuXHRcdHZhciBTdHJpbmdTdHViO1xuXHRcdFN0cmluZ1N0dWIgPSBmdW5jdGlvbiggdG9rZW5zICkge1xuXHRcdFx0dmFyIHBhcnNlciA9IG5ldyBTdHJpbmdQYXJzZXIoIHRva2VucyApO1xuXHRcdFx0dGhpcy5zdHVicyA9IHBhcnNlci5yZXN1bHQ7XG5cdFx0fTtcblx0XHRTdHJpbmdTdHViLnByb3RvdHlwZSA9IHtcblx0XHRcdHRvSlNPTjogZnVuY3Rpb24oIG5vU3RyaW5naWZ5ICkge1xuXHRcdFx0XHR2YXIganNvbjtcblx0XHRcdFx0aWYgKCB0aGlzWyAnanNvbl8nICsgbm9TdHJpbmdpZnkgXSApIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpc1sgJ2pzb25fJyArIG5vU3RyaW5naWZ5IF07XG5cdFx0XHRcdH1cblx0XHRcdFx0anNvbiA9IHRoaXNbICdqc29uXycgKyBub1N0cmluZ2lmeSBdID0ganNvbmlmeVN0dWJzKCB0aGlzLnN0dWJzLCBub1N0cmluZ2lmeSApO1xuXHRcdFx0XHRyZXR1cm4ganNvbjtcblx0XHRcdH0sXG5cdFx0XHR0b1N0cmluZzogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmICggdGhpcy5zdHIgIT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5zdHI7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5zdHIgPSBzdHJpbmdpZnlTdHVicyggdGhpcy5zdHVicyApO1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5zdHI7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gU3RyaW5nU3R1Yjtcblx0fSggcGFyc2VfUGFyc2VyX1N0cmluZ1N0dWJfU3RyaW5nUGFyc2VyLCBwYXJzZV9QYXJzZXJfdXRpbHNfc3RyaW5naWZ5U3R1YnMsIHBhcnNlX1BhcnNlcl91dGlsc19qc29uaWZ5U3R1YnMgKTtcblxuXHR2YXIgcGFyc2VfUGFyc2VyX2dldEVsZW1lbnRfRWxlbWVudFN0dWJfdXRpbHNfanNvbmlmeURpcmVjdGl2ZSA9IGZ1bmN0aW9uKCBTdHJpbmdTdHViICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBkaXJlY3RpdmUgKSB7XG5cdFx0XHR2YXIgcmVzdWx0LCBuYW1lO1xuXHRcdFx0aWYgKCB0eXBlb2YgZGlyZWN0aXZlLm5hbWUgPT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHRpZiAoICFkaXJlY3RpdmUuYXJncyAmJiAhZGlyZWN0aXZlLmR5bmFtaWNBcmdzICkge1xuXHRcdFx0XHRcdHJldHVybiBkaXJlY3RpdmUubmFtZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRuYW1lID0gZGlyZWN0aXZlLm5hbWU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRuYW1lID0gbmV3IFN0cmluZ1N0dWIoIGRpcmVjdGl2ZS5uYW1lICkudG9KU09OKCk7XG5cdFx0XHR9XG5cdFx0XHRyZXN1bHQgPSB7XG5cdFx0XHRcdG46IG5hbWVcblx0XHRcdH07XG5cdFx0XHRpZiAoIGRpcmVjdGl2ZS5hcmdzICkge1xuXHRcdFx0XHRyZXN1bHQuYSA9IGRpcmVjdGl2ZS5hcmdzO1xuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBkaXJlY3RpdmUuZHluYW1pY0FyZ3MgKSB7XG5cdFx0XHRcdHJlc3VsdC5kID0gbmV3IFN0cmluZ1N0dWIoIGRpcmVjdGl2ZS5keW5hbWljQXJncyApLnRvSlNPTigpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9O1xuXHR9KCBwYXJzZV9QYXJzZXJfU3RyaW5nU3R1Yl9fU3RyaW5nU3R1YiApO1xuXG5cdHZhciBwYXJzZV9QYXJzZXJfZ2V0RWxlbWVudF9FbGVtZW50U3R1Yl90b0pTT04gPSBmdW5jdGlvbiggdHlwZXMsIGpzb25pZnlTdHVicywganNvbmlmeURpcmVjdGl2ZSApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggbm9TdHJpbmdpZnkgKSB7XG5cdFx0XHR2YXIganNvbiwgbmFtZSwgdmFsdWUsIHByb3h5LCBpLCBsZW4sIGF0dHJpYnV0ZTtcblx0XHRcdGlmICggdGhpc1sgJ2pzb25fJyArIG5vU3RyaW5naWZ5IF0gKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzWyAnanNvbl8nICsgbm9TdHJpbmdpZnkgXTtcblx0XHRcdH1cblx0XHRcdGpzb24gPSB7XG5cdFx0XHRcdHQ6IHR5cGVzLkVMRU1FTlQsXG5cdFx0XHRcdGU6IHRoaXMudGFnXG5cdFx0XHR9O1xuXHRcdFx0aWYgKCB0aGlzLmRvY3R5cGUgKSB7XG5cdFx0XHRcdGpzb24ueSA9IDE7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRoaXMuYXR0cmlidXRlcyAmJiB0aGlzLmF0dHJpYnV0ZXMubGVuZ3RoICkge1xuXHRcdFx0XHRqc29uLmEgPSB7fTtcblx0XHRcdFx0bGVuID0gdGhpcy5hdHRyaWJ1dGVzLmxlbmd0aDtcblx0XHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0XHRhdHRyaWJ1dGUgPSB0aGlzLmF0dHJpYnV0ZXNbIGkgXTtcblx0XHRcdFx0XHRuYW1lID0gYXR0cmlidXRlLm5hbWU7XG5cdFx0XHRcdFx0aWYgKCBqc29uLmFbIG5hbWUgXSApIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ1lvdSBjYW5ub3QgaGF2ZSBtdWx0aXBsZSBhdHRyaWJ1dGVzIHdpdGggdGhlIHNhbWUgbmFtZScgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCBhdHRyaWJ1dGUudmFsdWUgPT09IG51bGwgKSB7XG5cdFx0XHRcdFx0XHR2YWx1ZSA9IG51bGw7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHZhbHVlID0gYXR0cmlidXRlLnZhbHVlLnRvSlNPTiggbm9TdHJpbmdpZnkgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0anNvbi5hWyBuYW1lIF0gPSB2YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aGlzLml0ZW1zICYmIHRoaXMuaXRlbXMubGVuZ3RoICkge1xuXHRcdFx0XHRqc29uLmYgPSBqc29uaWZ5U3R1YnMoIHRoaXMuaXRlbXMsIG5vU3RyaW5naWZ5ICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRoaXMucHJveGllcyAmJiB0aGlzLnByb3hpZXMubGVuZ3RoICkge1xuXHRcdFx0XHRqc29uLnYgPSB7fTtcblx0XHRcdFx0bGVuID0gdGhpcy5wcm94aWVzLmxlbmd0aDtcblx0XHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0XHRwcm94eSA9IHRoaXMucHJveGllc1sgaSBdO1xuXHRcdFx0XHRcdGpzb24udlsgcHJveHkuZGlyZWN0aXZlVHlwZSBdID0ganNvbmlmeURpcmVjdGl2ZSggcHJveHkgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aGlzLmludHJvICkge1xuXHRcdFx0XHRqc29uLnQxID0ganNvbmlmeURpcmVjdGl2ZSggdGhpcy5pbnRybyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aGlzLm91dHJvICkge1xuXHRcdFx0XHRqc29uLnQyID0ganNvbmlmeURpcmVjdGl2ZSggdGhpcy5vdXRybyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aGlzLmRlY29yYXRvciApIHtcblx0XHRcdFx0anNvbi5vID0ganNvbmlmeURpcmVjdGl2ZSggdGhpcy5kZWNvcmF0b3IgKTtcblx0XHRcdH1cblx0XHRcdHRoaXNbICdqc29uXycgKyBub1N0cmluZ2lmeSBdID0ganNvbjtcblx0XHRcdHJldHVybiBqc29uO1xuXHRcdH07XG5cdH0oIGNvbmZpZ190eXBlcywgcGFyc2VfUGFyc2VyX3V0aWxzX2pzb25pZnlTdHVicywgcGFyc2VfUGFyc2VyX2dldEVsZW1lbnRfRWxlbWVudFN0dWJfdXRpbHNfanNvbmlmeURpcmVjdGl2ZSApO1xuXG5cdHZhciBwYXJzZV9QYXJzZXJfZ2V0RWxlbWVudF9FbGVtZW50U3R1Yl90b1N0cmluZyA9IGZ1bmN0aW9uKCBzdHJpbmdpZnlTdHVicywgdm9pZEVsZW1lbnROYW1lcyApIHtcblxuXHRcdHZhciBodG1sRWxlbWVudHM7XG5cdFx0aHRtbEVsZW1lbnRzID0gJ2EgYWJiciBhY3JvbnltIGFkZHJlc3MgYXBwbGV0IGFyZWEgYiBiYXNlIGJhc2Vmb250IGJkbyBiaWcgYmxvY2txdW90ZSBib2R5IGJyIGJ1dHRvbiBjYXB0aW9uIGNlbnRlciBjaXRlIGNvZGUgY29sIGNvbGdyb3VwIGRkIGRlbCBkZm4gZGlyIGRpdiBkbCBkdCBlbSBmaWVsZHNldCBmb250IGZvcm0gZnJhbWUgZnJhbWVzZXQgaDEgaDIgaDMgaDQgaDUgaDYgaGVhZCBociBodG1sIGkgaWZyYW1lIGltZyBpbnB1dCBpbnMgaXNpbmRleCBrYmQgbGFiZWwgbGVnZW5kIGxpIGxpbmsgbWFwIG1lbnUgbWV0YSBub2ZyYW1lcyBub3NjcmlwdCBvYmplY3Qgb2wgcCBwYXJhbSBwcmUgcSBzIHNhbXAgc2NyaXB0IHNlbGVjdCBzbWFsbCBzcGFuIHN0cmlrZSBzdHJvbmcgc3R5bGUgc3ViIHN1cCB0ZXh0YXJlYSB0aXRsZSB0dCB1IHVsIHZhciBhcnRpY2xlIGFzaWRlIGF1ZGlvIGJkaSBjYW52YXMgY29tbWFuZCBkYXRhIGRhdGFncmlkIGRhdGFsaXN0IGRldGFpbHMgZW1iZWQgZXZlbnRzb3VyY2UgZmlnY2FwdGlvbiBmaWd1cmUgZm9vdGVyIGhlYWRlciBoZ3JvdXAga2V5Z2VuIG1hcmsgbWV0ZXIgbmF2IG91dHB1dCBwcm9ncmVzcyBydWJ5IHJwIHJ0IHNlY3Rpb24gc291cmNlIHN1bW1hcnkgdGltZSB0cmFjayB2aWRlbyB3YnInLnNwbGl0KCAnICcgKTtcblx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgc3RyLCBpLCBsZW4sIGF0dHJTdHIsIG5hbWUsIGF0dHJWYWx1ZVN0ciwgZnJhZ1N0ciwgaXNWb2lkO1xuXHRcdFx0aWYgKCB0aGlzLnN0ciAhPT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5zdHI7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGh0bWxFbGVtZW50cy5pbmRleE9mKCB0aGlzLnRhZy50b0xvd2VyQ2FzZSgpICkgPT09IC0xICkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5zdHIgPSBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmICggdGhpcy5wcm94aWVzIHx8IHRoaXMuaW50cm8gfHwgdGhpcy5vdXRybyB8fCB0aGlzLmRlY29yYXRvciApIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuc3RyID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRmcmFnU3RyID0gc3RyaW5naWZ5U3R1YnMoIHRoaXMuaXRlbXMgKTtcblx0XHRcdGlmICggZnJhZ1N0ciA9PT0gZmFsc2UgKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnN0ciA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aXNWb2lkID0gdm9pZEVsZW1lbnROYW1lcy5pbmRleE9mKCB0aGlzLnRhZy50b0xvd2VyQ2FzZSgpICkgIT09IC0xO1xuXHRcdFx0c3RyID0gJzwnICsgdGhpcy50YWc7XG5cdFx0XHRpZiAoIHRoaXMuYXR0cmlidXRlcyApIHtcblx0XHRcdFx0Zm9yICggaSA9IDAsIGxlbiA9IHRoaXMuYXR0cmlidXRlcy5sZW5ndGg7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0XHRuYW1lID0gdGhpcy5hdHRyaWJ1dGVzWyBpIF0ubmFtZTtcblx0XHRcdFx0XHRpZiAoIG5hbWUuaW5kZXhPZiggJzonICkgIT09IC0xICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuc3RyID0gZmFsc2U7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICggbmFtZSA9PT0gJ2lkJyB8fCBuYW1lID09PSAnaW50cm8nIHx8IG5hbWUgPT09ICdvdXRybycgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdGhpcy5zdHIgPSBmYWxzZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YXR0clN0ciA9ICcgJyArIG5hbWU7XG5cdFx0XHRcdFx0aWYgKCB0aGlzLmF0dHJpYnV0ZXNbIGkgXS52YWx1ZSAhPT0gbnVsbCApIHtcblx0XHRcdFx0XHRcdGF0dHJWYWx1ZVN0ciA9IHRoaXMuYXR0cmlidXRlc1sgaSBdLnZhbHVlLnRvU3RyaW5nKCk7XG5cdFx0XHRcdFx0XHRpZiAoIGF0dHJWYWx1ZVN0ciA9PT0gZmFsc2UgKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiB0aGlzLnN0ciA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKCBhdHRyVmFsdWVTdHIgIT09ICcnICkge1xuXHRcdFx0XHRcdFx0XHRhdHRyU3RyICs9ICc9Jztcblx0XHRcdFx0XHRcdFx0aWYgKCAvW1xcc1wiJz08PmBdLy50ZXN0KCBhdHRyVmFsdWVTdHIgKSApIHtcblx0XHRcdFx0XHRcdFx0XHRhdHRyU3RyICs9ICdcIicgKyBhdHRyVmFsdWVTdHIucmVwbGFjZSggL1wiL2csICcmcXVvdDsnICkgKyAnXCInO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdGF0dHJTdHIgKz0gYXR0clZhbHVlU3RyO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHN0ciArPSBhdHRyU3RyO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRoaXMuc2VsZkNsb3NpbmcgJiYgIWlzVm9pZCApIHtcblx0XHRcdFx0c3RyICs9ICcvPic7XG5cdFx0XHRcdHJldHVybiB0aGlzLnN0ciA9IHN0cjtcblx0XHRcdH1cblx0XHRcdHN0ciArPSAnPic7XG5cdFx0XHRpZiAoIGlzVm9pZCApIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuc3RyID0gc3RyO1xuXHRcdFx0fVxuXHRcdFx0c3RyICs9IGZyYWdTdHI7XG5cdFx0XHRzdHIgKz0gJzwvJyArIHRoaXMudGFnICsgJz4nO1xuXHRcdFx0cmV0dXJuIHRoaXMuc3RyID0gc3RyO1xuXHRcdH07XG5cdH0oIHBhcnNlX1BhcnNlcl91dGlsc19zdHJpbmdpZnlTdHVicywgY29uZmlnX3ZvaWRFbGVtZW50TmFtZXMgKTtcblxuXHR2YXIgcGFyc2VfUGFyc2VyX2dldEVsZW1lbnRfRWxlbWVudFN0dWJfX0VsZW1lbnRTdHViID0gZnVuY3Rpb24oIHR5cGVzLCB2b2lkRWxlbWVudE5hbWVzLCB3YXJuLCBzaWJsaW5nc0J5VGFnTmFtZSwgZmlsdGVyQXR0cmlidXRlcywgcHJvY2Vzc0RpcmVjdGl2ZSwgdG9KU09OLCB0b1N0cmluZywgU3RyaW5nU3R1YiApIHtcblxuXHRcdHZhciBFbGVtZW50U3R1YiwgYWxsRWxlbWVudE5hbWVzLCBjbG9zZWRCeVBhcmVudENsb3NlLCBvblBhdHRlcm4sIHNhbml0aXplLCBsZWFkaW5nV2hpdGVzcGFjZSA9IC9eXFxzKy8sXG5cdFx0XHR0cmFpbGluZ1doaXRlc3BhY2UgPSAvXFxzKyQvO1xuXHRcdEVsZW1lbnRTdHViID0gZnVuY3Rpb24oIGZpcnN0VG9rZW4sIHBhcnNlciwgcHJlc2VydmVXaGl0ZXNwYWNlICkge1xuXHRcdFx0dmFyIG5leHQsIGF0dHJzLCBmaWx0ZXJlZCwgcHJveGllcywgaXRlbSwgZ2V0RnJhZywgbG93ZXJDYXNlVGFnO1xuXHRcdFx0cGFyc2VyLnBvcyArPSAxO1xuXHRcdFx0Z2V0RnJhZyA9IGZ1bmN0aW9uKCBhdHRyICkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdG5hbWU6IGF0dHIubmFtZSxcblx0XHRcdFx0XHR2YWx1ZTogYXR0ci52YWx1ZSA/IG5ldyBTdHJpbmdTdHViKCBhdHRyLnZhbHVlICkgOiBudWxsXG5cdFx0XHRcdH07XG5cdFx0XHR9O1xuXHRcdFx0dGhpcy50YWcgPSBmaXJzdFRva2VuLm5hbWU7XG5cdFx0XHRsb3dlckNhc2VUYWcgPSBmaXJzdFRva2VuLm5hbWUudG9Mb3dlckNhc2UoKTtcblx0XHRcdGlmICggbG93ZXJDYXNlVGFnLnN1YnN0ciggMCwgMyApID09PSAncnYtJyApIHtcblx0XHRcdFx0d2FybiggJ1RoZSBcInJ2LVwiIHByZWZpeCBmb3IgY29tcG9uZW50cyBoYXMgYmVlbiBkZXByZWNhdGVkLiBTdXBwb3J0IHdpbGwgYmUgcmVtb3ZlZCBpbiBhIGZ1dHVyZSB2ZXJzaW9uJyApO1xuXHRcdFx0XHR0aGlzLnRhZyA9IHRoaXMudGFnLnN1YnN0cmluZyggMyApO1xuXHRcdFx0fVxuXHRcdFx0cHJlc2VydmVXaGl0ZXNwYWNlID0gcHJlc2VydmVXaGl0ZXNwYWNlIHx8IGxvd2VyQ2FzZVRhZyA9PT0gJ3ByZScgfHwgbG93ZXJDYXNlVGFnID09PSAnc3R5bGUnIHx8IGxvd2VyQ2FzZVRhZyA9PT0gJ3NjcmlwdCc7XG5cdFx0XHRpZiAoIGZpcnN0VG9rZW4uYXR0cnMgKSB7XG5cdFx0XHRcdGZpbHRlcmVkID0gZmlsdGVyQXR0cmlidXRlcyggZmlyc3RUb2tlbi5hdHRycyApO1xuXHRcdFx0XHRhdHRycyA9IGZpbHRlcmVkLmF0dHJzO1xuXHRcdFx0XHRwcm94aWVzID0gZmlsdGVyZWQucHJveGllcztcblx0XHRcdFx0aWYgKCBwYXJzZXIub3B0aW9ucy5zYW5pdGl6ZSAmJiBwYXJzZXIub3B0aW9ucy5zYW5pdGl6ZS5ldmVudEF0dHJpYnV0ZXMgKSB7XG5cdFx0XHRcdFx0YXR0cnMgPSBhdHRycy5maWx0ZXIoIHNhbml0aXplICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBhdHRycy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0dGhpcy5hdHRyaWJ1dGVzID0gYXR0cnMubWFwKCBnZXRGcmFnICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBwcm94aWVzLmxlbmd0aCApIHtcblx0XHRcdFx0XHR0aGlzLnByb3hpZXMgPSBwcm94aWVzLm1hcCggcHJvY2Vzc0RpcmVjdGl2ZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggZmlsdGVyZWQuaW50cm8gKSB7XG5cdFx0XHRcdFx0dGhpcy5pbnRybyA9IHByb2Nlc3NEaXJlY3RpdmUoIGZpbHRlcmVkLmludHJvICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBmaWx0ZXJlZC5vdXRybyApIHtcblx0XHRcdFx0XHR0aGlzLm91dHJvID0gcHJvY2Vzc0RpcmVjdGl2ZSggZmlsdGVyZWQub3V0cm8gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIGZpbHRlcmVkLmRlY29yYXRvciApIHtcblx0XHRcdFx0XHR0aGlzLmRlY29yYXRvciA9IHByb2Nlc3NEaXJlY3RpdmUoIGZpbHRlcmVkLmRlY29yYXRvciApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGZpcnN0VG9rZW4uZG9jdHlwZSApIHtcblx0XHRcdFx0dGhpcy5kb2N0eXBlID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICggZmlyc3RUb2tlbi5zZWxmQ2xvc2luZyApIHtcblx0XHRcdFx0dGhpcy5zZWxmQ2xvc2luZyA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHZvaWRFbGVtZW50TmFtZXMuaW5kZXhPZiggbG93ZXJDYXNlVGFnICkgIT09IC0xICkge1xuXHRcdFx0XHR0aGlzLmlzVm9pZCA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRoaXMuc2VsZkNsb3NpbmcgfHwgdGhpcy5pc1ZvaWQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMuc2libGluZ3MgPSBzaWJsaW5nc0J5VGFnTmFtZVsgbG93ZXJDYXNlVGFnIF07XG5cdFx0XHR0aGlzLml0ZW1zID0gW107XG5cdFx0XHRuZXh0ID0gcGFyc2VyLm5leHQoKTtcblx0XHRcdHdoaWxlICggbmV4dCApIHtcblx0XHRcdFx0aWYgKCBuZXh0Lm11c3RhY2hlVHlwZSA9PT0gdHlwZXMuQ0xPU0lORyApIHtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIG5leHQudHlwZSA9PT0gdHlwZXMuVEFHICkge1xuXHRcdFx0XHRcdGlmICggbmV4dC5jbG9zaW5nICkge1xuXHRcdFx0XHRcdFx0aWYgKCBuZXh0Lm5hbWUudG9Mb3dlckNhc2UoKSA9PT0gbG93ZXJDYXNlVGFnICkge1xuXHRcdFx0XHRcdFx0XHRwYXJzZXIucG9zICs9IDE7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9IGVsc2UgaWYgKCB0aGlzLnNpYmxpbmdzICYmIHRoaXMuc2libGluZ3MuaW5kZXhPZiggbmV4dC5uYW1lLnRvTG93ZXJDYXNlKCkgKSAhPT0gLTEgKSB7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5pdGVtcy5wdXNoKCBwYXJzZXIuZ2V0U3R1YiggcHJlc2VydmVXaGl0ZXNwYWNlICkgKTtcblx0XHRcdFx0bmV4dCA9IHBhcnNlci5uZXh0KCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICFwcmVzZXJ2ZVdoaXRlc3BhY2UgKSB7XG5cdFx0XHRcdGl0ZW0gPSB0aGlzLml0ZW1zWyAwIF07XG5cdFx0XHRcdGlmICggaXRlbSAmJiBpdGVtLnR5cGUgPT09IHR5cGVzLlRFWFQgKSB7XG5cdFx0XHRcdFx0aXRlbS50ZXh0ID0gaXRlbS50ZXh0LnJlcGxhY2UoIGxlYWRpbmdXaGl0ZXNwYWNlLCAnJyApO1xuXHRcdFx0XHRcdGlmICggIWl0ZW0udGV4dCApIHtcblx0XHRcdFx0XHRcdHRoaXMuaXRlbXMuc2hpZnQoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0aXRlbSA9IHRoaXMuaXRlbXNbIHRoaXMuaXRlbXMubGVuZ3RoIC0gMSBdO1xuXHRcdFx0XHRpZiAoIGl0ZW0gJiYgaXRlbS50eXBlID09PSB0eXBlcy5URVhUICkge1xuXHRcdFx0XHRcdGl0ZW0udGV4dCA9IGl0ZW0udGV4dC5yZXBsYWNlKCB0cmFpbGluZ1doaXRlc3BhY2UsICcnICk7XG5cdFx0XHRcdFx0aWYgKCAhaXRlbS50ZXh0ICkge1xuXHRcdFx0XHRcdFx0dGhpcy5pdGVtcy5wb3AoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHRcdEVsZW1lbnRTdHViLnByb3RvdHlwZSA9IHtcblx0XHRcdHRvSlNPTjogdG9KU09OLFxuXHRcdFx0dG9TdHJpbmc6IHRvU3RyaW5nXG5cdFx0fTtcblx0XHRhbGxFbGVtZW50TmFtZXMgPSAnYSBhYmJyIGFjcm9ueW0gYWRkcmVzcyBhcHBsZXQgYXJlYSBiIGJhc2UgYmFzZWZvbnQgYmRvIGJpZyBibG9ja3F1b3RlIGJvZHkgYnIgYnV0dG9uIGNhcHRpb24gY2VudGVyIGNpdGUgY29kZSBjb2wgY29sZ3JvdXAgZGQgZGVsIGRmbiBkaXIgZGl2IGRsIGR0IGVtIGZpZWxkc2V0IGZvbnQgZm9ybSBmcmFtZSBmcmFtZXNldCBoMSBoMiBoMyBoNCBoNSBoNiBoZWFkIGhyIGh0bWwgaSBpZnJhbWUgaW1nIGlucHV0IGlucyBpc2luZGV4IGtiZCBsYWJlbCBsZWdlbmQgbGkgbGluayBtYXAgbWVudSBtZXRhIG5vZnJhbWVzIG5vc2NyaXB0IG9iamVjdCBvbCBwIHBhcmFtIHByZSBxIHMgc2FtcCBzY3JpcHQgc2VsZWN0IHNtYWxsIHNwYW4gc3RyaWtlIHN0cm9uZyBzdHlsZSBzdWIgc3VwIHRleHRhcmVhIHRpdGxlIHR0IHUgdWwgdmFyIGFydGljbGUgYXNpZGUgYXVkaW8gYmRpIGNhbnZhcyBjb21tYW5kIGRhdGEgZGF0YWdyaWQgZGF0YWxpc3QgZGV0YWlscyBlbWJlZCBldmVudHNvdXJjZSBmaWdjYXB0aW9uIGZpZ3VyZSBmb290ZXIgaGVhZGVyIGhncm91cCBrZXlnZW4gbWFyayBtZXRlciBuYXYgb3V0cHV0IHByb2dyZXNzIHJ1YnkgcnAgcnQgc2VjdGlvbiBzb3VyY2Ugc3VtbWFyeSB0aW1lIHRyYWNrIHZpZGVvIHdicicuc3BsaXQoICcgJyApO1xuXHRcdGNsb3NlZEJ5UGFyZW50Q2xvc2UgPSAnbGkgZGQgcnQgcnAgb3B0Z3JvdXAgb3B0aW9uIHRib2R5IHRmb290IHRyIHRkIHRoJy5zcGxpdCggJyAnICk7XG5cdFx0b25QYXR0ZXJuID0gL15vblthLXpBLVpdLztcblx0XHRzYW5pdGl6ZSA9IGZ1bmN0aW9uKCBhdHRyICkge1xuXHRcdFx0dmFyIHZhbGlkID0gIW9uUGF0dGVybi50ZXN0KCBhdHRyLm5hbWUgKTtcblx0XHRcdHJldHVybiB2YWxpZDtcblx0XHR9O1xuXHRcdHJldHVybiBFbGVtZW50U3R1Yjtcblx0fSggY29uZmlnX3R5cGVzLCBjb25maWdfdm9pZEVsZW1lbnROYW1lcywgdXRpbHNfd2FybiwgcGFyc2VfUGFyc2VyX2dldEVsZW1lbnRfRWxlbWVudFN0dWJfdXRpbHNfc2libGluZ3NCeVRhZ05hbWUsIHBhcnNlX1BhcnNlcl9nZXRFbGVtZW50X0VsZW1lbnRTdHViX3V0aWxzX2ZpbHRlckF0dHJpYnV0ZXMsIHBhcnNlX1BhcnNlcl9nZXRFbGVtZW50X0VsZW1lbnRTdHViX3V0aWxzX3Byb2Nlc3NEaXJlY3RpdmUsIHBhcnNlX1BhcnNlcl9nZXRFbGVtZW50X0VsZW1lbnRTdHViX3RvSlNPTiwgcGFyc2VfUGFyc2VyX2dldEVsZW1lbnRfRWxlbWVudFN0dWJfdG9TdHJpbmcsIHBhcnNlX1BhcnNlcl9TdHJpbmdTdHViX19TdHJpbmdTdHViICk7XG5cblx0dmFyIHBhcnNlX1BhcnNlcl9nZXRFbGVtZW50X19nZXRFbGVtZW50ID0gZnVuY3Rpb24oIHR5cGVzLCBFbGVtZW50U3R1YiApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggdG9rZW4gKSB7XG5cdFx0XHRpZiAoIHRoaXMub3B0aW9ucy5zYW5pdGl6ZSAmJiB0aGlzLm9wdGlvbnMuc2FuaXRpemUuZWxlbWVudHMgKSB7XG5cdFx0XHRcdGlmICggdGhpcy5vcHRpb25zLnNhbml0aXplLmVsZW1lbnRzLmluZGV4T2YoIHRva2VuLm5hbWUudG9Mb3dlckNhc2UoKSApICE9PSAtMSApIHtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG5ldyBFbGVtZW50U3R1YiggdG9rZW4sIHRoaXMsIHRoaXMucHJlc2VydmVXaGl0ZXNwYWNlICk7XG5cdFx0fTtcblx0fSggY29uZmlnX3R5cGVzLCBwYXJzZV9QYXJzZXJfZ2V0RWxlbWVudF9FbGVtZW50U3R1Yl9fRWxlbWVudFN0dWIgKTtcblxuXHR2YXIgcGFyc2VfUGFyc2VyX19QYXJzZXIgPSBmdW5jdGlvbiggZ2V0VGV4dCwgZ2V0Q29tbWVudCwgZ2V0TXVzdGFjaGUsIGdldEVsZW1lbnQsIGpzb25pZnlTdHVicyApIHtcblxuXHRcdHZhciBQYXJzZXI7XG5cdFx0UGFyc2VyID0gZnVuY3Rpb24oIHRva2Vucywgb3B0aW9ucyApIHtcblx0XHRcdHZhciBzdHViLCBzdHVicztcblx0XHRcdHRoaXMudG9rZW5zID0gdG9rZW5zIHx8IFtdO1xuXHRcdFx0dGhpcy5wb3MgPSAwO1xuXHRcdFx0dGhpcy5vcHRpb25zID0gb3B0aW9ucztcblx0XHRcdHRoaXMucHJlc2VydmVXaGl0ZXNwYWNlID0gb3B0aW9ucy5wcmVzZXJ2ZVdoaXRlc3BhY2U7XG5cdFx0XHRzdHVicyA9IFtdO1xuXHRcdFx0d2hpbGUgKCBzdHViID0gdGhpcy5nZXRTdHViKCkgKSB7XG5cdFx0XHRcdHN0dWJzLnB1c2goIHN0dWIgKTtcblx0XHRcdH1cblx0XHRcdHRoaXMucmVzdWx0ID0ganNvbmlmeVN0dWJzKCBzdHVicywgb3B0aW9ucy5ub1N0cmluZ2lmeSwgdHJ1ZSApO1xuXHRcdH07XG5cdFx0UGFyc2VyLnByb3RvdHlwZSA9IHtcblx0XHRcdGdldFN0dWI6IGZ1bmN0aW9uKCBwcmVzZXJ2ZVdoaXRlc3BhY2UgKSB7XG5cdFx0XHRcdHZhciB0b2tlbiA9IHRoaXMubmV4dCgpO1xuXHRcdFx0XHRpZiAoICF0b2tlbiApIHtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdGhpcy5nZXRUZXh0KCB0b2tlbiwgdGhpcy5wcmVzZXJ2ZVdoaXRlc3BhY2UgfHwgcHJlc2VydmVXaGl0ZXNwYWNlICkgfHwgdGhpcy5nZXRDb21tZW50KCB0b2tlbiApIHx8IHRoaXMuZ2V0TXVzdGFjaGUoIHRva2VuICkgfHwgdGhpcy5nZXRFbGVtZW50KCB0b2tlbiApO1xuXHRcdFx0fSxcblx0XHRcdGdldFRleHQ6IGdldFRleHQsXG5cdFx0XHRnZXRDb21tZW50OiBnZXRDb21tZW50LFxuXHRcdFx0Z2V0TXVzdGFjaGU6IGdldE11c3RhY2hlLFxuXHRcdFx0Z2V0RWxlbWVudDogZ2V0RWxlbWVudCxcblx0XHRcdG5leHQ6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy50b2tlbnNbIHRoaXMucG9zIF07XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gUGFyc2VyO1xuXHR9KCBwYXJzZV9QYXJzZXJfZ2V0VGV4dF9fZ2V0VGV4dCwgcGFyc2VfUGFyc2VyX2dldENvbW1lbnRfX2dldENvbW1lbnQsIHBhcnNlX1BhcnNlcl9nZXRNdXN0YWNoZV9fZ2V0TXVzdGFjaGUsIHBhcnNlX1BhcnNlcl9nZXRFbGVtZW50X19nZXRFbGVtZW50LCBwYXJzZV9QYXJzZXJfdXRpbHNfanNvbmlmeVN0dWJzICk7XG5cblx0Ly8gUmFjdGl2ZS5wYXJzZVxuXHQvLyA9PT09PT09PT09PT09PT1cblx0Ly9cblx0Ly8gVGFrZXMgaW4gYSBzdHJpbmcsIGFuZCByZXR1cm5zIGFuIG9iamVjdCByZXByZXNlbnRpbmcgdGhlIHBhcnNlZCB0ZW1wbGF0ZS5cblx0Ly8gQSBwYXJzZWQgdGVtcGxhdGUgaXMgYW4gYXJyYXkgb2YgMSBvciBtb3JlICdkZXNjcmlwdG9ycycsIHdoaWNoIGluIHNvbWVcblx0Ly8gY2FzZXMgaGF2ZSBjaGlsZHJlbi5cblx0Ly9cblx0Ly8gVGhlIGZvcm1hdCBpcyBvcHRpbWlzZWQgZm9yIHNpemUsIG5vdCByZWFkYWJpbGl0eSwgaG93ZXZlciBmb3IgcmVmZXJlbmNlIHRoZVxuXHQvLyBrZXlzIGZvciBlYWNoIGRlc2NyaXB0b3IgYXJlIGFzIGZvbGxvd3M6XG5cdC8vXG5cdC8vICogciAtIFJlZmVyZW5jZSwgZS5nLiAnbXVzdGFjaGUnIGluIHt7bXVzdGFjaGV9fVxuXHQvLyAqIHQgLSBUeXBlIGNvZGUgKGUuZy4gMSBpcyB0ZXh0LCAyIGlzIGludGVycG9sYXRvci4uLilcblx0Ly8gKiBmIC0gRnJhZ21lbnQuIENvbnRhaW5zIGEgZGVzY3JpcHRvcidzIGNoaWxkcmVuXG5cdC8vICogZSAtIEVsZW1lbnQgbmFtZVxuXHQvLyAqIGEgLSBtYXAgb2YgZWxlbWVudCBBdHRyaWJ1dGVzLCBvciBwcm94eSBldmVudC90cmFuc2l0aW9uIEFyZ3VtZW50c1xuXHQvLyAqIGQgLSBEeW5hbWljIHByb3h5IGV2ZW50L3RyYW5zaXRpb24gYXJndW1lbnRzXG5cdC8vICogbiAtIGluZGljYXRlcyBhbiBpTnZlcnRlZCBzZWN0aW9uXG5cdC8vICogaSAtIEluZGV4IHJlZmVyZW5jZSwgZS5nLiAnbnVtJyBpbiB7eyNzZWN0aW9uOm51bX19Y29udGVudHt7L3NlY3Rpb259fVxuXHQvLyAqIHYgLSBlVmVudCBwcm94aWVzIChpLmUuIHdoZW4gdXNlciBlLmcuIGNsaWNrcyBvbiBhIG5vZGUsIGZpcmUgcHJveHkgZXZlbnQpXG5cdC8vICogeCAtIGVYcHJlc3Npb25zXG5cdC8vICogcyAtIFN0cmluZyByZXByZXNlbnRhdGlvbiBvZiBhbiBleHByZXNzaW9uIGZ1bmN0aW9uXG5cdC8vICogdDEgLSBpbnRybyBUcmFuc2l0aW9uXG5cdC8vICogdDIgLSBvdXRybyBUcmFuc2l0aW9uXG5cdC8vICogbyAtIGRlY09yYXRvclxuXHQvLyAqIHkgLSBpcyBkb2N0WXBlXG5cdHZhciBwYXJzZV9fcGFyc2UgPSBmdW5jdGlvbiggdG9rZW5pemUsIHR5cGVzLCBQYXJzZXIgKSB7XG5cblx0XHR2YXIgcGFyc2UsIG9ubHlXaGl0ZXNwYWNlLCBpbmxpbmVQYXJ0aWFsU3RhcnQsIGlubGluZVBhcnRpYWxFbmQsIHBhcnNlQ29tcG91bmRUZW1wbGF0ZTtcblx0XHRvbmx5V2hpdGVzcGFjZSA9IC9eXFxzKiQvO1xuXHRcdGlubGluZVBhcnRpYWxTdGFydCA9IC88IS0tXFxzKlxce1xce1xccyo+XFxzKihbYS16QS1aXyRdW2EtekEtWl8kMC05XSopXFxzKn1cXH1cXHMqLS0+Lztcblx0XHRpbmxpbmVQYXJ0aWFsRW5kID0gLzwhLS1cXHMqXFx7XFx7XFxzKlxcL1xccyooW2EtekEtWl8kXVthLXpBLVpfJDAtOV0qKVxccyp9XFx9XFxzKi0tPi87XG5cdFx0cGFyc2UgPSBmdW5jdGlvbiggdGVtcGxhdGUsIG9wdGlvbnMgKSB7XG5cdFx0XHR2YXIgdG9rZW5zLCBqc29uLCB0b2tlbjtcblx0XHRcdG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXHRcdFx0aWYgKCBpbmxpbmVQYXJ0aWFsU3RhcnQudGVzdCggdGVtcGxhdGUgKSApIHtcblx0XHRcdFx0cmV0dXJuIHBhcnNlQ29tcG91bmRUZW1wbGF0ZSggdGVtcGxhdGUsIG9wdGlvbnMgKTtcblx0XHRcdH1cblx0XHRcdGlmICggb3B0aW9ucy5zYW5pdGl6ZSA9PT0gdHJ1ZSApIHtcblx0XHRcdFx0b3B0aW9ucy5zYW5pdGl6ZSA9IHtcblx0XHRcdFx0XHRlbGVtZW50czogJ2FwcGxldCBiYXNlIGJhc2Vmb250IGJvZHkgZnJhbWUgZnJhbWVzZXQgaGVhZCBodG1sIGlzaW5kZXggbGluayBtZXRhIG5vZnJhbWVzIG5vc2NyaXB0IG9iamVjdCBwYXJhbSBzY3JpcHQgc3R5bGUgdGl0bGUnLnNwbGl0KCAnICcgKSxcblx0XHRcdFx0XHRldmVudEF0dHJpYnV0ZXM6IHRydWVcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHRcdHRva2VucyA9IHRva2VuaXplKCB0ZW1wbGF0ZSwgb3B0aW9ucyApO1xuXHRcdFx0aWYgKCAhb3B0aW9ucy5wcmVzZXJ2ZVdoaXRlc3BhY2UgKSB7XG5cdFx0XHRcdHRva2VuID0gdG9rZW5zWyAwIF07XG5cdFx0XHRcdGlmICggdG9rZW4gJiYgdG9rZW4udHlwZSA9PT0gdHlwZXMuVEVYVCAmJiBvbmx5V2hpdGVzcGFjZS50ZXN0KCB0b2tlbi52YWx1ZSApICkge1xuXHRcdFx0XHRcdHRva2Vucy5zaGlmdCgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRva2VuID0gdG9rZW5zWyB0b2tlbnMubGVuZ3RoIC0gMSBdO1xuXHRcdFx0XHRpZiAoIHRva2VuICYmIHRva2VuLnR5cGUgPT09IHR5cGVzLlRFWFQgJiYgb25seVdoaXRlc3BhY2UudGVzdCggdG9rZW4udmFsdWUgKSApIHtcblx0XHRcdFx0XHR0b2tlbnMucG9wKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGpzb24gPSBuZXcgUGFyc2VyKCB0b2tlbnMsIG9wdGlvbnMgKS5yZXN1bHQ7XG5cdFx0XHRpZiAoIHR5cGVvZiBqc29uID09PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0cmV0dXJuIFsganNvbiBdO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGpzb247XG5cdFx0fTtcblx0XHRwYXJzZUNvbXBvdW5kVGVtcGxhdGUgPSBmdW5jdGlvbiggdGVtcGxhdGUsIG9wdGlvbnMgKSB7XG5cdFx0XHR2YXIgbWFpblRlbXBsYXRlLCByZW1haW5pbmcsIHBhcnRpYWxzLCBuYW1lLCBzdGFydE1hdGNoLCBlbmRNYXRjaDtcblx0XHRcdHBhcnRpYWxzID0ge307XG5cdFx0XHRtYWluVGVtcGxhdGUgPSAnJztcblx0XHRcdHJlbWFpbmluZyA9IHRlbXBsYXRlO1xuXHRcdFx0d2hpbGUgKCBzdGFydE1hdGNoID0gaW5saW5lUGFydGlhbFN0YXJ0LmV4ZWMoIHJlbWFpbmluZyApICkge1xuXHRcdFx0XHRuYW1lID0gc3RhcnRNYXRjaFsgMSBdO1xuXHRcdFx0XHRtYWluVGVtcGxhdGUgKz0gcmVtYWluaW5nLnN1YnN0ciggMCwgc3RhcnRNYXRjaC5pbmRleCApO1xuXHRcdFx0XHRyZW1haW5pbmcgPSByZW1haW5pbmcuc3Vic3RyaW5nKCBzdGFydE1hdGNoLmluZGV4ICsgc3RhcnRNYXRjaFsgMCBdLmxlbmd0aCApO1xuXHRcdFx0XHRlbmRNYXRjaCA9IGlubGluZVBhcnRpYWxFbmQuZXhlYyggcmVtYWluaW5nICk7XG5cdFx0XHRcdGlmICggIWVuZE1hdGNoIHx8IGVuZE1hdGNoWyAxIF0gIT09IG5hbWUgKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnSW5saW5lIHBhcnRpYWxzIG11c3QgaGF2ZSBhIGNsb3NpbmcgZGVsaW1pdGVyLCBhbmQgY2Fubm90IGJlIG5lc3RlZCcgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRwYXJ0aWFsc1sgbmFtZSBdID0gcGFyc2UoIHJlbWFpbmluZy5zdWJzdHIoIDAsIGVuZE1hdGNoLmluZGV4ICksIG9wdGlvbnMgKTtcblx0XHRcdFx0cmVtYWluaW5nID0gcmVtYWluaW5nLnN1YnN0cmluZyggZW5kTWF0Y2guaW5kZXggKyBlbmRNYXRjaFsgMCBdLmxlbmd0aCApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0bWFpbjogcGFyc2UoIG1haW5UZW1wbGF0ZSwgb3B0aW9ucyApLFxuXHRcdFx0XHRwYXJ0aWFsczogcGFydGlhbHNcblx0XHRcdH07XG5cdFx0fTtcblx0XHRyZXR1cm4gcGFyc2U7XG5cdH0oIHBhcnNlX3Rva2VuaXplLCBjb25maWdfdHlwZXMsIHBhcnNlX1BhcnNlcl9fUGFyc2VyICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9QYXJ0aWFsX2RlSW5kZW50ID0gZnVuY3Rpb24oKSB7XG5cblx0XHR2YXIgZW1wdHkgPSAvXlxccyokLyxcblx0XHRcdGxlYWRpbmdXaGl0ZXNwYWNlID0gL15cXHMqLztcblx0XHRyZXR1cm4gZnVuY3Rpb24oIHN0ciApIHtcblx0XHRcdHZhciBsaW5lcywgZmlyc3RMaW5lLCBsYXN0TGluZSwgbWluSW5kZW50O1xuXHRcdFx0bGluZXMgPSBzdHIuc3BsaXQoICdcXG4nICk7XG5cdFx0XHRmaXJzdExpbmUgPSBsaW5lc1sgMCBdO1xuXHRcdFx0aWYgKCBmaXJzdExpbmUgIT09IHVuZGVmaW5lZCAmJiBlbXB0eS50ZXN0KCBmaXJzdExpbmUgKSApIHtcblx0XHRcdFx0bGluZXMuc2hpZnQoKTtcblx0XHRcdH1cblx0XHRcdGxhc3RMaW5lID0gbGluZXNbIGxpbmVzLmxlbmd0aCAtIDEgXTtcblx0XHRcdGlmICggbGFzdExpbmUgIT09IHVuZGVmaW5lZCAmJiBlbXB0eS50ZXN0KCBsYXN0TGluZSApICkge1xuXHRcdFx0XHRsaW5lcy5wb3AoKTtcblx0XHRcdH1cblx0XHRcdG1pbkluZGVudCA9IGxpbmVzLnJlZHVjZSggcmVkdWNlciwgbnVsbCApO1xuXHRcdFx0aWYgKCBtaW5JbmRlbnQgKSB7XG5cdFx0XHRcdHN0ciA9IGxpbmVzLm1hcCggZnVuY3Rpb24oIGxpbmUgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGxpbmUucmVwbGFjZSggbWluSW5kZW50LCAnJyApO1xuXHRcdFx0XHR9ICkuam9pbiggJ1xcbicgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBzdHI7XG5cdFx0fTtcblxuXHRcdGZ1bmN0aW9uIHJlZHVjZXIoIHByZXZpb3VzLCBsaW5lICkge1xuXHRcdFx0dmFyIGxpbmVJbmRlbnQgPSBsZWFkaW5nV2hpdGVzcGFjZS5leGVjKCBsaW5lIClbIDAgXTtcblx0XHRcdGlmICggcHJldmlvdXMgPT09IG51bGwgfHwgbGluZUluZGVudC5sZW5ndGggPCBwcmV2aW91cy5sZW5ndGggKSB7XG5cdFx0XHRcdHJldHVybiBsaW5lSW5kZW50O1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHByZXZpb3VzO1xuXHRcdH1cblx0fSgpO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfUGFydGlhbF9nZXRQYXJ0aWFsRGVzY3JpcHRvciA9IGZ1bmN0aW9uKCBlcnJvcnMsIGlzQ2xpZW50LCB3YXJuLCBpc09iamVjdCwgcGFydGlhbHMsIHBhcnNlLCBkZUluZGVudCApIHtcblxuXHRcdHZhciBnZXRQYXJ0aWFsRGVzY3JpcHRvciwgcmVnaXN0ZXJQYXJ0aWFsLCBnZXRQYXJ0aWFsRnJvbVJlZ2lzdHJ5LCB1bnBhY2s7XG5cdFx0Z2V0UGFydGlhbERlc2NyaXB0b3IgPSBmdW5jdGlvbiggcm9vdCwgbmFtZSApIHtcblx0XHRcdHZhciBlbCwgcGFydGlhbCwgZXJyb3JNZXNzYWdlO1xuXHRcdFx0aWYgKCBwYXJ0aWFsID0gZ2V0UGFydGlhbEZyb21SZWdpc3RyeSggcm9vdCwgbmFtZSApICkge1xuXHRcdFx0XHRyZXR1cm4gcGFydGlhbDtcblx0XHRcdH1cblx0XHRcdGlmICggaXNDbGllbnQgKSB7XG5cdFx0XHRcdGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIG5hbWUgKTtcblx0XHRcdFx0aWYgKCBlbCAmJiBlbC50YWdOYW1lID09PSAnU0NSSVBUJyApIHtcblx0XHRcdFx0XHRpZiAoICFwYXJzZSApIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggZXJyb3JzLm1pc3NpbmdQYXJzZXIgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmVnaXN0ZXJQYXJ0aWFsKCBwYXJzZSggZGVJbmRlbnQoIGVsLnRleHQgKSwgcm9vdC5wYXJzZU9wdGlvbnMgKSwgbmFtZSwgcGFydGlhbHMgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cGFydGlhbCA9IHBhcnRpYWxzWyBuYW1lIF07XG5cdFx0XHRpZiAoICFwYXJ0aWFsICkge1xuXHRcdFx0XHRlcnJvck1lc3NhZ2UgPSAnQ291bGQgbm90IGZpbmQgZGVzY3JpcHRvciBmb3IgcGFydGlhbCBcIicgKyBuYW1lICsgJ1wiJztcblx0XHRcdFx0aWYgKCByb290LmRlYnVnICkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggZXJyb3JNZXNzYWdlICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0d2FybiggZXJyb3JNZXNzYWdlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHVucGFjayggcGFydGlhbCApO1xuXHRcdH07XG5cdFx0Z2V0UGFydGlhbEZyb21SZWdpc3RyeSA9IGZ1bmN0aW9uKCByYWN0aXZlLCBuYW1lICkge1xuXHRcdFx0dmFyIHBhcnRpYWw7XG5cdFx0XHRpZiAoIHJhY3RpdmUucGFydGlhbHNbIG5hbWUgXSApIHtcblx0XHRcdFx0aWYgKCB0eXBlb2YgcmFjdGl2ZS5wYXJ0aWFsc1sgbmFtZSBdID09PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0XHRpZiAoICFwYXJzZSApIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggZXJyb3JzLm1pc3NpbmdQYXJzZXIgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cGFydGlhbCA9IHBhcnNlKCByYWN0aXZlLnBhcnRpYWxzWyBuYW1lIF0sIHJhY3RpdmUucGFyc2VPcHRpb25zICk7XG5cdFx0XHRcdFx0cmVnaXN0ZXJQYXJ0aWFsKCBwYXJ0aWFsLCBuYW1lLCByYWN0aXZlLnBhcnRpYWxzICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHVucGFjayggcmFjdGl2ZS5wYXJ0aWFsc1sgbmFtZSBdICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZWdpc3RlclBhcnRpYWwgPSBmdW5jdGlvbiggcGFydGlhbCwgbmFtZSwgcmVnaXN0cnkgKSB7XG5cdFx0XHR2YXIga2V5O1xuXHRcdFx0aWYgKCBpc09iamVjdCggcGFydGlhbCApICkge1xuXHRcdFx0XHRyZWdpc3RyeVsgbmFtZSBdID0gcGFydGlhbC5tYWluO1xuXHRcdFx0XHRmb3IgKCBrZXkgaW4gcGFydGlhbC5wYXJ0aWFscyApIHtcblx0XHRcdFx0XHRpZiAoIHBhcnRpYWwucGFydGlhbHMuaGFzT3duUHJvcGVydHkoIGtleSApICkge1xuXHRcdFx0XHRcdFx0cmVnaXN0cnlbIGtleSBdID0gcGFydGlhbC5wYXJ0aWFsc1sga2V5IF07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZWdpc3RyeVsgbmFtZSBdID0gcGFydGlhbDtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHVucGFjayA9IGZ1bmN0aW9uKCBwYXJ0aWFsICkge1xuXHRcdFx0aWYgKCBwYXJ0aWFsLmxlbmd0aCA9PT0gMSAmJiB0eXBlb2YgcGFydGlhbFsgMCBdID09PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0cmV0dXJuIHBhcnRpYWxbIDAgXTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBwYXJ0aWFsO1xuXHRcdH07XG5cdFx0cmV0dXJuIGdldFBhcnRpYWxEZXNjcmlwdG9yO1xuXHR9KCBjb25maWdfZXJyb3JzLCBjb25maWdfaXNDbGllbnQsIHV0aWxzX3dhcm4sIHV0aWxzX2lzT2JqZWN0LCByZWdpc3RyaWVzX3BhcnRpYWxzLCBwYXJzZV9fcGFyc2UsIHJlbmRlcl9Eb21GcmFnbWVudF9QYXJ0aWFsX2RlSW5kZW50ICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9QYXJ0aWFsX2FwcGx5SW5kZW50ID0gZnVuY3Rpb24oIHN0cmluZywgaW5kZW50ICkge1xuXHRcdHZhciBpbmRlbnRlZDtcblx0XHRpZiAoICFpbmRlbnQgKSB7XG5cdFx0XHRyZXR1cm4gc3RyaW5nO1xuXHRcdH1cblx0XHRpbmRlbnRlZCA9IHN0cmluZy5zcGxpdCggJ1xcbicgKS5tYXAoIGZ1bmN0aW9uKCBsaW5lLCBub3RGaXJzdExpbmUgKSB7XG5cdFx0XHRyZXR1cm4gbm90Rmlyc3RMaW5lID8gaW5kZW50ICsgbGluZSA6IGxpbmU7XG5cdFx0fSApLmpvaW4oICdcXG4nICk7XG5cdFx0cmV0dXJuIGluZGVudGVkO1xuXHR9O1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfUGFydGlhbF9fUGFydGlhbCA9IGZ1bmN0aW9uKCB0eXBlcywgZ2V0UGFydGlhbERlc2NyaXB0b3IsIGFwcGx5SW5kZW50LCBjaXJjdWxhciApIHtcblxuXHRcdHZhciBEb21QYXJ0aWFsLCBEb21GcmFnbWVudDtcblx0XHRjaXJjdWxhci5wdXNoKCBmdW5jdGlvbigpIHtcblx0XHRcdERvbUZyYWdtZW50ID0gY2lyY3VsYXIuRG9tRnJhZ21lbnQ7XG5cdFx0fSApO1xuXHRcdERvbVBhcnRpYWwgPSBmdW5jdGlvbiggb3B0aW9ucywgZG9jRnJhZyApIHtcblx0XHRcdHZhciBwYXJlbnRGcmFnbWVudCA9IHRoaXMucGFyZW50RnJhZ21lbnQgPSBvcHRpb25zLnBhcmVudEZyYWdtZW50LFxuXHRcdFx0XHRkZXNjcmlwdG9yO1xuXHRcdFx0dGhpcy50eXBlID0gdHlwZXMuUEFSVElBTDtcblx0XHRcdHRoaXMubmFtZSA9IG9wdGlvbnMuZGVzY3JpcHRvci5yO1xuXHRcdFx0dGhpcy5pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG5cdFx0XHRpZiAoICFvcHRpb25zLmRlc2NyaXB0b3IuciApIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnUGFydGlhbHMgbXVzdCBoYXZlIGEgc3RhdGljIHJlZmVyZW5jZSAobm8gZXhwcmVzc2lvbnMpLiBUaGlzIG1heSBjaGFuZ2UgaW4gYSBmdXR1cmUgdmVyc2lvbiBvZiBSYWN0aXZlLicgKTtcblx0XHRcdH1cblx0XHRcdGRlc2NyaXB0b3IgPSBnZXRQYXJ0aWFsRGVzY3JpcHRvciggcGFyZW50RnJhZ21lbnQucm9vdCwgb3B0aW9ucy5kZXNjcmlwdG9yLnIgKTtcblx0XHRcdHRoaXMuZnJhZ21lbnQgPSBuZXcgRG9tRnJhZ21lbnQoIHtcblx0XHRcdFx0ZGVzY3JpcHRvcjogZGVzY3JpcHRvcixcblx0XHRcdFx0cm9vdDogcGFyZW50RnJhZ21lbnQucm9vdCxcblx0XHRcdFx0cE5vZGU6IHBhcmVudEZyYWdtZW50LnBOb2RlLFxuXHRcdFx0XHRvd25lcjogdGhpc1xuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCBkb2NGcmFnICkge1xuXHRcdFx0XHRkb2NGcmFnLmFwcGVuZENoaWxkKCB0aGlzLmZyYWdtZW50LmRvY0ZyYWcgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdERvbVBhcnRpYWwucHJvdG90eXBlID0ge1xuXHRcdFx0Zmlyc3ROb2RlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuZnJhZ21lbnQuZmlyc3ROb2RlKCk7XG5cdFx0XHR9LFxuXHRcdFx0ZmluZE5leHROb2RlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMucGFyZW50RnJhZ21lbnQuZmluZE5leHROb2RlKCB0aGlzICk7XG5cdFx0XHR9LFxuXHRcdFx0ZGV0YWNoOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuZnJhZ21lbnQuZGV0YWNoKCk7XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCBkZXN0cm95ICkge1xuXHRcdFx0XHR0aGlzLmZyYWdtZW50LnRlYXJkb3duKCBkZXN0cm95ICk7XG5cdFx0XHR9LFxuXHRcdFx0dG9TdHJpbmc6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgc3RyaW5nLCBwcmV2aW91c0l0ZW0sIGxhc3RMaW5lLCBtYXRjaDtcblx0XHRcdFx0c3RyaW5nID0gdGhpcy5mcmFnbWVudC50b1N0cmluZygpO1xuXHRcdFx0XHRwcmV2aW91c0l0ZW0gPSB0aGlzLnBhcmVudEZyYWdtZW50Lml0ZW1zWyB0aGlzLmluZGV4IC0gMSBdO1xuXHRcdFx0XHRpZiAoICFwcmV2aW91c0l0ZW0gfHwgcHJldmlvdXNJdGVtLnR5cGUgIT09IHR5cGVzLlRFWFQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHN0cmluZztcblx0XHRcdFx0fVxuXHRcdFx0XHRsYXN0TGluZSA9IHByZXZpb3VzSXRlbS5kZXNjcmlwdG9yLnNwbGl0KCAnXFxuJyApLnBvcCgpO1xuXHRcdFx0XHRpZiAoIG1hdGNoID0gL15cXHMrJC8uZXhlYyggbGFzdExpbmUgKSApIHtcblx0XHRcdFx0XHRyZXR1cm4gYXBwbHlJbmRlbnQoIHN0cmluZywgbWF0Y2hbIDAgXSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBzdHJpbmc7XG5cdFx0XHR9LFxuXHRcdFx0ZmluZDogZnVuY3Rpb24oIHNlbGVjdG9yICkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5mcmFnbWVudC5maW5kKCBzZWxlY3RvciApO1xuXHRcdFx0fSxcblx0XHRcdGZpbmRBbGw6IGZ1bmN0aW9uKCBzZWxlY3RvciwgcXVlcnkgKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmZyYWdtZW50LmZpbmRBbGwoIHNlbGVjdG9yLCBxdWVyeSApO1xuXHRcdFx0fSxcblx0XHRcdGZpbmRDb21wb25lbnQ6IGZ1bmN0aW9uKCBzZWxlY3RvciApIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuZnJhZ21lbnQuZmluZENvbXBvbmVudCggc2VsZWN0b3IgKTtcblx0XHRcdH0sXG5cdFx0XHRmaW5kQWxsQ29tcG9uZW50czogZnVuY3Rpb24oIHNlbGVjdG9yLCBxdWVyeSApIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuZnJhZ21lbnQuZmluZEFsbENvbXBvbmVudHMoIHNlbGVjdG9yLCBxdWVyeSApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIERvbVBhcnRpYWw7XG5cdH0oIGNvbmZpZ190eXBlcywgcmVuZGVyX0RvbUZyYWdtZW50X1BhcnRpYWxfZ2V0UGFydGlhbERlc2NyaXB0b3IsIHJlbmRlcl9Eb21GcmFnbWVudF9QYXJ0aWFsX2FwcGx5SW5kZW50LCBjaXJjdWxhciApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfQ29tcG9uZW50X2luaXRpYWxpc2VfY3JlYXRlTW9kZWxfQ29tcG9uZW50UGFyYW1ldGVyID0gZnVuY3Rpb24oIHJ1bmxvb3AsIFN0cmluZ0ZyYWdtZW50ICkge1xuXG5cdFx0dmFyIENvbXBvbmVudFBhcmFtZXRlciA9IGZ1bmN0aW9uKCBjb21wb25lbnQsIGtleSwgdmFsdWUgKSB7XG5cdFx0XHR0aGlzLnBhcmVudEZyYWdtZW50ID0gY29tcG9uZW50LnBhcmVudEZyYWdtZW50O1xuXHRcdFx0dGhpcy5jb21wb25lbnQgPSBjb21wb25lbnQ7XG5cdFx0XHR0aGlzLmtleSA9IGtleTtcblx0XHRcdHRoaXMuZnJhZ21lbnQgPSBuZXcgU3RyaW5nRnJhZ21lbnQoIHtcblx0XHRcdFx0ZGVzY3JpcHRvcjogdmFsdWUsXG5cdFx0XHRcdHJvb3Q6IGNvbXBvbmVudC5yb290LFxuXHRcdFx0XHRvd25lcjogdGhpc1xuXHRcdFx0fSApO1xuXHRcdFx0dGhpcy5zZWxmVXBkYXRpbmcgPSB0aGlzLmZyYWdtZW50LmlzU2ltcGxlKCk7XG5cdFx0XHR0aGlzLnZhbHVlID0gdGhpcy5mcmFnbWVudC5nZXRWYWx1ZSgpO1xuXHRcdH07XG5cdFx0Q29tcG9uZW50UGFyYW1ldGVyLnByb3RvdHlwZSA9IHtcblx0XHRcdGJ1YmJsZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmICggdGhpcy5zZWxmVXBkYXRpbmcgKSB7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGUoKTtcblx0XHRcdFx0fSBlbHNlIGlmICggIXRoaXMuZGVmZXJyZWQgJiYgdGhpcy5yZWFkeSApIHtcblx0XHRcdFx0XHRydW5sb29wLmFkZEF0dHJpYnV0ZSggdGhpcyApO1xuXHRcdFx0XHRcdHRoaXMuZGVmZXJyZWQgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0dXBkYXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHZhbHVlID0gdGhpcy5mcmFnbWVudC5nZXRWYWx1ZSgpO1xuXHRcdFx0XHR0aGlzLmNvbXBvbmVudC5pbnN0YW5jZS5zZXQoIHRoaXMua2V5LCB2YWx1ZSApO1xuXHRcdFx0XHR0aGlzLnZhbHVlID0gdmFsdWU7XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR0aGlzLmZyYWdtZW50LnRlYXJkb3duKCk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gQ29tcG9uZW50UGFyYW1ldGVyO1xuXHR9KCBnbG9iYWxfcnVubG9vcCwgcmVuZGVyX1N0cmluZ0ZyYWdtZW50X19TdHJpbmdGcmFnbWVudCApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfQ29tcG9uZW50X2luaXRpYWxpc2VfY3JlYXRlTW9kZWxfX2NyZWF0ZU1vZGVsID0gZnVuY3Rpb24oIHR5cGVzLCBwYXJzZUpTT04sIHJlc29sdmVSZWYsIGdldCwgQ29tcG9uZW50UGFyYW1ldGVyICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBjb21wb25lbnQsIGRlZmF1bHREYXRhLCBhdHRyaWJ1dGVzLCB0b0JpbmQgKSB7XG5cdFx0XHR2YXIgZGF0YSwga2V5LCB2YWx1ZTtcblx0XHRcdGRhdGEgPSB7fTtcblx0XHRcdGNvbXBvbmVudC5jb21wbGV4UGFyYW1ldGVycyA9IFtdO1xuXHRcdFx0Zm9yICgga2V5IGluIGF0dHJpYnV0ZXMgKSB7XG5cdFx0XHRcdGlmICggYXR0cmlidXRlcy5oYXNPd25Qcm9wZXJ0eSgga2V5ICkgKSB7XG5cdFx0XHRcdFx0dmFsdWUgPSBnZXRWYWx1ZSggY29tcG9uZW50LCBrZXksIGF0dHJpYnV0ZXNbIGtleSBdLCB0b0JpbmQgKTtcblx0XHRcdFx0XHRpZiAoIHZhbHVlICE9PSB1bmRlZmluZWQgfHwgZGVmYXVsdERhdGFbIGtleSBdID09PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdFx0XHRkYXRhWyBrZXkgXSA9IHZhbHVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGRhdGE7XG5cdFx0fTtcblxuXHRcdGZ1bmN0aW9uIGdldFZhbHVlKCBjb21wb25lbnQsIGtleSwgZGVzY3JpcHRvciwgdG9CaW5kICkge1xuXHRcdFx0dmFyIHBhcmFtZXRlciwgcGFyc2VkLCBwYXJlbnRJbnN0YW5jZSwgcGFyZW50RnJhZ21lbnQsIGtleXBhdGg7XG5cdFx0XHRwYXJlbnRJbnN0YW5jZSA9IGNvbXBvbmVudC5yb290O1xuXHRcdFx0cGFyZW50RnJhZ21lbnQgPSBjb21wb25lbnQucGFyZW50RnJhZ21lbnQ7XG5cdFx0XHRpZiAoIHR5cGVvZiBkZXNjcmlwdG9yID09PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0cGFyc2VkID0gcGFyc2VKU09OKCBkZXNjcmlwdG9yICk7XG5cdFx0XHRcdHJldHVybiBwYXJzZWQgPyBwYXJzZWQudmFsdWUgOiBkZXNjcmlwdG9yO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBkZXNjcmlwdG9yID09PSBudWxsICkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICggZGVzY3JpcHRvci5sZW5ndGggPT09IDEgJiYgZGVzY3JpcHRvclsgMCBdLnQgPT09IHR5cGVzLklOVEVSUE9MQVRPUiAmJiBkZXNjcmlwdG9yWyAwIF0uciApIHtcblx0XHRcdFx0aWYgKCBwYXJlbnRGcmFnbWVudC5pbmRleFJlZnMgJiYgcGFyZW50RnJhZ21lbnQuaW5kZXhSZWZzWyBkZXNjcmlwdG9yWyAwIF0uciBdICE9PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHBhcmVudEZyYWdtZW50LmluZGV4UmVmc1sgZGVzY3JpcHRvclsgMCBdLnIgXTtcblx0XHRcdFx0fVxuXHRcdFx0XHRrZXlwYXRoID0gcmVzb2x2ZVJlZiggcGFyZW50SW5zdGFuY2UsIGRlc2NyaXB0b3JbIDAgXS5yLCBwYXJlbnRGcmFnbWVudCApIHx8IGRlc2NyaXB0b3JbIDAgXS5yO1xuXHRcdFx0XHR0b0JpbmQucHVzaCgge1xuXHRcdFx0XHRcdGNoaWxkS2V5cGF0aDoga2V5LFxuXHRcdFx0XHRcdHBhcmVudEtleXBhdGg6IGtleXBhdGhcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRyZXR1cm4gZ2V0KCBwYXJlbnRJbnN0YW5jZSwga2V5cGF0aCApO1xuXHRcdFx0fVxuXHRcdFx0cGFyYW1ldGVyID0gbmV3IENvbXBvbmVudFBhcmFtZXRlciggY29tcG9uZW50LCBrZXksIGRlc2NyaXB0b3IgKTtcblx0XHRcdGNvbXBvbmVudC5jb21wbGV4UGFyYW1ldGVycy5wdXNoKCBwYXJhbWV0ZXIgKTtcblx0XHRcdHJldHVybiBwYXJhbWV0ZXIudmFsdWU7XG5cdFx0fVxuXHR9KCBjb25maWdfdHlwZXMsIHV0aWxzX3BhcnNlSlNPTiwgc2hhcmVkX3Jlc29sdmVSZWYsIHNoYXJlZF9nZXRfX2dldCwgcmVuZGVyX0RvbUZyYWdtZW50X0NvbXBvbmVudF9pbml0aWFsaXNlX2NyZWF0ZU1vZGVsX0NvbXBvbmVudFBhcmFtZXRlciApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfQ29tcG9uZW50X2luaXRpYWxpc2VfY3JlYXRlSW5zdGFuY2UgPSBmdW5jdGlvbigpIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggY29tcG9uZW50LCBDb21wb25lbnQsIGRhdGEsIGRvY0ZyYWcsIGNvbnRlbnREZXNjcmlwdG9yICkge1xuXHRcdFx0dmFyIGluc3RhbmNlLCBwYXJlbnRGcmFnbWVudCwgcGFydGlhbHMsIHJvb3QsIGFkYXB0O1xuXHRcdFx0cGFyZW50RnJhZ21lbnQgPSBjb21wb25lbnQucGFyZW50RnJhZ21lbnQ7XG5cdFx0XHRyb290ID0gY29tcG9uZW50LnJvb3Q7XG5cdFx0XHRwYXJ0aWFscyA9IHtcblx0XHRcdFx0Y29udGVudDogY29udGVudERlc2NyaXB0b3IgfHwgW11cblx0XHRcdH07XG5cdFx0XHRhZGFwdCA9IGNvbWJpbmVBZGFwdG9ycyggcm9vdCwgQ29tcG9uZW50LmRlZmF1bHRzLmFkYXB0LCBDb21wb25lbnQuYWRhcHRvcnMgKTtcblx0XHRcdGluc3RhbmNlID0gbmV3IENvbXBvbmVudCgge1xuXHRcdFx0XHRlbDogcGFyZW50RnJhZ21lbnQucE5vZGUsXG5cdFx0XHRcdGFwcGVuZDogdHJ1ZSxcblx0XHRcdFx0ZGF0YTogZGF0YSxcblx0XHRcdFx0cGFydGlhbHM6IHBhcnRpYWxzLFxuXHRcdFx0XHRtYWdpYzogcm9vdC5tYWdpYyB8fCBDb21wb25lbnQuZGVmYXVsdHMubWFnaWMsXG5cdFx0XHRcdG1vZGlmeUFycmF5czogcm9vdC5tb2RpZnlBcnJheXMsXG5cdFx0XHRcdF9wYXJlbnQ6IHJvb3QsXG5cdFx0XHRcdF9jb21wb25lbnQ6IGNvbXBvbmVudCxcblx0XHRcdFx0YWRhcHQ6IGFkYXB0XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoIGRvY0ZyYWcgKSB7XG5cdFx0XHRcdGluc3RhbmNlLmluc2VydCggZG9jRnJhZyApO1xuXHRcdFx0XHRpbnN0YW5jZS5mcmFnbWVudC5wTm9kZSA9IGluc3RhbmNlLmVsID0gcGFyZW50RnJhZ21lbnQucE5vZGU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gaW5zdGFuY2U7XG5cdFx0fTtcblxuXHRcdGZ1bmN0aW9uIGNvbWJpbmVBZGFwdG9ycyggcm9vdCwgZGVmYXVsdEFkYXB0ICkge1xuXHRcdFx0dmFyIGFkYXB0LCBsZW4sIGk7XG5cdFx0XHRpZiAoIHJvb3QuYWRhcHQubGVuZ3RoICkge1xuXHRcdFx0XHRhZGFwdCA9IHJvb3QuYWRhcHQubWFwKCBmdW5jdGlvbiggc3RyaW5nT3JPYmplY3QgKSB7XG5cdFx0XHRcdFx0aWYgKCB0eXBlb2Ygc3RyaW5nT3JPYmplY3QgPT09ICdvYmplY3QnICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHN0cmluZ09yT2JqZWN0O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gcm9vdC5hZGFwdG9yc1sgc3RyaW5nT3JPYmplY3QgXSB8fCBzdHJpbmdPck9iamVjdDtcblx0XHRcdFx0fSApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YWRhcHQgPSBbXTtcblx0XHRcdH1cblx0XHRcdGlmICggbGVuID0gZGVmYXVsdEFkYXB0Lmxlbmd0aCApIHtcblx0XHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0XHRpZiAoIGFkYXB0LmluZGV4T2YoIGRlZmF1bHRBZGFwdFsgaSBdICkgPT09IC0xICkge1xuXHRcdFx0XHRcdFx0YWRhcHQucHVzaCggZGVmYXVsdEFkYXB0WyBpIF0gKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBhZGFwdDtcblx0XHR9XG5cdH0oKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0NvbXBvbmVudF9pbml0aWFsaXNlX2NyZWF0ZUJpbmRpbmdzID0gZnVuY3Rpb24oIGNyZWF0ZUNvbXBvbmVudEJpbmRpbmcsIGdldCwgc2V0ICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uIGNyZWF0ZUluaXRpYWxDb21wb25lbnRCaW5kaW5ncyggY29tcG9uZW50LCB0b0JpbmQgKSB7XG5cdFx0XHR0b0JpbmQuZm9yRWFjaCggZnVuY3Rpb24gY3JlYXRlSW5pdGlhbENvbXBvbmVudEJpbmRpbmcoIHBhaXIgKSB7XG5cdFx0XHRcdHZhciBjaGlsZFZhbHVlO1xuXHRcdFx0XHRjcmVhdGVDb21wb25lbnRCaW5kaW5nKCBjb21wb25lbnQsIGNvbXBvbmVudC5yb290LCBwYWlyLnBhcmVudEtleXBhdGgsIHBhaXIuY2hpbGRLZXlwYXRoICk7XG5cdFx0XHRcdGNoaWxkVmFsdWUgPSBnZXQoIGNvbXBvbmVudC5pbnN0YW5jZSwgcGFpci5jaGlsZEtleXBhdGggKTtcblx0XHRcdFx0aWYgKCBjaGlsZFZhbHVlICE9PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdFx0c2V0KCBjb21wb25lbnQucm9vdCwgcGFpci5wYXJlbnRLZXlwYXRoLCBjaGlsZFZhbHVlICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHR9O1xuXHR9KCBzaGFyZWRfY3JlYXRlQ29tcG9uZW50QmluZGluZywgc2hhcmVkX2dldF9fZ2V0LCBzaGFyZWRfc2V0ICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9Db21wb25lbnRfaW5pdGlhbGlzZV9wcm9wYWdhdGVFdmVudHMgPSBmdW5jdGlvbiggd2FybiApIHtcblxuXHRcdHZhciBlcnJvck1lc3NhZ2UgPSAnQ29tcG9uZW50cyBjdXJyZW50bHkgb25seSBzdXBwb3J0IHNpbXBsZSBldmVudHMgLSB5b3UgY2Fubm90IGluY2x1ZGUgYXJndW1lbnRzLiBTb3JyeSEnO1xuXHRcdHJldHVybiBmdW5jdGlvbiggY29tcG9uZW50LCBldmVudHNEZXNjcmlwdG9yICkge1xuXHRcdFx0dmFyIGV2ZW50TmFtZTtcblx0XHRcdGZvciAoIGV2ZW50TmFtZSBpbiBldmVudHNEZXNjcmlwdG9yICkge1xuXHRcdFx0XHRpZiAoIGV2ZW50c0Rlc2NyaXB0b3IuaGFzT3duUHJvcGVydHkoIGV2ZW50TmFtZSApICkge1xuXHRcdFx0XHRcdHByb3BhZ2F0ZUV2ZW50KCBjb21wb25lbnQuaW5zdGFuY2UsIGNvbXBvbmVudC5yb290LCBldmVudE5hbWUsIGV2ZW50c0Rlc2NyaXB0b3JbIGV2ZW50TmFtZSBdICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0ZnVuY3Rpb24gcHJvcGFnYXRlRXZlbnQoIGNoaWxkSW5zdGFuY2UsIHBhcmVudEluc3RhbmNlLCBldmVudE5hbWUsIHByb3h5RXZlbnROYW1lICkge1xuXHRcdFx0aWYgKCB0eXBlb2YgcHJveHlFdmVudE5hbWUgIT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHRpZiAoIHBhcmVudEluc3RhbmNlLmRlYnVnICkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggZXJyb3JNZXNzYWdlICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0d2FybiggZXJyb3JNZXNzYWdlICk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRjaGlsZEluc3RhbmNlLm9uKCBldmVudE5hbWUsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKCBhcmd1bWVudHMgKTtcblx0XHRcdFx0YXJncy51bnNoaWZ0KCBwcm94eUV2ZW50TmFtZSApO1xuXHRcdFx0XHRwYXJlbnRJbnN0YW5jZS5maXJlLmFwcGx5KCBwYXJlbnRJbnN0YW5jZSwgYXJncyApO1xuXHRcdFx0fSApO1xuXHRcdH1cblx0fSggdXRpbHNfd2FybiApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfQ29tcG9uZW50X2luaXRpYWxpc2VfdXBkYXRlTGl2ZVF1ZXJpZXMgPSBmdW5jdGlvbiggY29tcG9uZW50ICkge1xuXHRcdHZhciBhbmNlc3RvciwgcXVlcnk7XG5cdFx0YW5jZXN0b3IgPSBjb21wb25lbnQucm9vdDtcblx0XHR3aGlsZSAoIGFuY2VzdG9yICkge1xuXHRcdFx0aWYgKCBxdWVyeSA9IGFuY2VzdG9yLl9saXZlQ29tcG9uZW50UXVlcmllc1sgY29tcG9uZW50Lm5hbWUgXSApIHtcblx0XHRcdFx0cXVlcnkucHVzaCggY29tcG9uZW50Lmluc3RhbmNlICk7XG5cdFx0XHR9XG5cdFx0XHRhbmNlc3RvciA9IGFuY2VzdG9yLl9wYXJlbnQ7XG5cdFx0fVxuXHR9O1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfQ29tcG9uZW50X2luaXRpYWxpc2VfX2luaXRpYWxpc2UgPSBmdW5jdGlvbiggdHlwZXMsIHdhcm4sIGNyZWF0ZU1vZGVsLCBjcmVhdGVJbnN0YW5jZSwgY3JlYXRlQmluZGluZ3MsIHByb3BhZ2F0ZUV2ZW50cywgdXBkYXRlTGl2ZVF1ZXJpZXMgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24gaW5pdGlhbGlzZUNvbXBvbmVudCggY29tcG9uZW50LCBvcHRpb25zLCBkb2NGcmFnICkge1xuXHRcdFx0dmFyIHBhcmVudEZyYWdtZW50LCByb290LCBDb21wb25lbnQsIGRhdGEsIHRvQmluZDtcblx0XHRcdHBhcmVudEZyYWdtZW50ID0gY29tcG9uZW50LnBhcmVudEZyYWdtZW50ID0gb3B0aW9ucy5wYXJlbnRGcmFnbWVudDtcblx0XHRcdHJvb3QgPSBwYXJlbnRGcmFnbWVudC5yb290O1xuXHRcdFx0Y29tcG9uZW50LnJvb3QgPSByb290O1xuXHRcdFx0Y29tcG9uZW50LnR5cGUgPSB0eXBlcy5DT01QT05FTlQ7XG5cdFx0XHRjb21wb25lbnQubmFtZSA9IG9wdGlvbnMuZGVzY3JpcHRvci5lO1xuXHRcdFx0Y29tcG9uZW50LmluZGV4ID0gb3B0aW9ucy5pbmRleDtcblx0XHRcdGNvbXBvbmVudC5iaW5kaW5ncyA9IFtdO1xuXHRcdFx0Q29tcG9uZW50ID0gcm9vdC5jb21wb25lbnRzWyBvcHRpb25zLmRlc2NyaXB0b3IuZSBdO1xuXHRcdFx0aWYgKCAhQ29tcG9uZW50ICkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdDb21wb25lbnQgXCInICsgb3B0aW9ucy5kZXNjcmlwdG9yLmUgKyAnXCIgbm90IGZvdW5kJyApO1xuXHRcdFx0fVxuXHRcdFx0dG9CaW5kID0gW107XG5cdFx0XHRkYXRhID0gY3JlYXRlTW9kZWwoIGNvbXBvbmVudCwgQ29tcG9uZW50LmRhdGEgfHwge30sIG9wdGlvbnMuZGVzY3JpcHRvci5hLCB0b0JpbmQgKTtcblx0XHRcdGNyZWF0ZUluc3RhbmNlKCBjb21wb25lbnQsIENvbXBvbmVudCwgZGF0YSwgZG9jRnJhZywgb3B0aW9ucy5kZXNjcmlwdG9yLmYgKTtcblx0XHRcdGNyZWF0ZUJpbmRpbmdzKCBjb21wb25lbnQsIHRvQmluZCApO1xuXHRcdFx0cHJvcGFnYXRlRXZlbnRzKCBjb21wb25lbnQsIG9wdGlvbnMuZGVzY3JpcHRvci52ICk7XG5cdFx0XHRpZiAoIG9wdGlvbnMuZGVzY3JpcHRvci50MSB8fCBvcHRpb25zLmRlc2NyaXB0b3IudDIgfHwgb3B0aW9ucy5kZXNjcmlwdG9yLm8gKSB7XG5cdFx0XHRcdHdhcm4oICdUaGUgXCJpbnRyb1wiLCBcIm91dHJvXCIgYW5kIFwiZGVjb3JhdG9yXCIgZGlyZWN0aXZlcyBoYXZlIG5vIGVmZmVjdCBvbiBjb21wb25lbnRzJyApO1xuXHRcdFx0fVxuXHRcdFx0dXBkYXRlTGl2ZVF1ZXJpZXMoIGNvbXBvbmVudCApO1xuXHRcdH07XG5cdH0oIGNvbmZpZ190eXBlcywgdXRpbHNfd2FybiwgcmVuZGVyX0RvbUZyYWdtZW50X0NvbXBvbmVudF9pbml0aWFsaXNlX2NyZWF0ZU1vZGVsX19jcmVhdGVNb2RlbCwgcmVuZGVyX0RvbUZyYWdtZW50X0NvbXBvbmVudF9pbml0aWFsaXNlX2NyZWF0ZUluc3RhbmNlLCByZW5kZXJfRG9tRnJhZ21lbnRfQ29tcG9uZW50X2luaXRpYWxpc2VfY3JlYXRlQmluZGluZ3MsIHJlbmRlcl9Eb21GcmFnbWVudF9Db21wb25lbnRfaW5pdGlhbGlzZV9wcm9wYWdhdGVFdmVudHMsIHJlbmRlcl9Eb21GcmFnbWVudF9Db21wb25lbnRfaW5pdGlhbGlzZV91cGRhdGVMaXZlUXVlcmllcyApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfQ29tcG9uZW50X19Db21wb25lbnQgPSBmdW5jdGlvbiggaW5pdGlhbGlzZSApIHtcblxuXHRcdHZhciBEb21Db21wb25lbnQgPSBmdW5jdGlvbiggb3B0aW9ucywgZG9jRnJhZyApIHtcblx0XHRcdGluaXRpYWxpc2UoIHRoaXMsIG9wdGlvbnMsIGRvY0ZyYWcgKTtcblx0XHR9O1xuXHRcdERvbUNvbXBvbmVudC5wcm90b3R5cGUgPSB7XG5cdFx0XHRmaXJzdE5vZGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5pbnN0YW5jZS5mcmFnbWVudC5maXJzdE5vZGUoKTtcblx0XHRcdH0sXG5cdFx0XHRmaW5kTmV4dE5vZGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5wYXJlbnRGcmFnbWVudC5maW5kTmV4dE5vZGUoIHRoaXMgKTtcblx0XHRcdH0sXG5cdFx0XHRkZXRhY2g6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5pbnN0YW5jZS5mcmFnbWVudC5kZXRhY2goKTtcblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oIGRlc3Ryb3kgKSB7XG5cdFx0XHRcdHdoaWxlICggdGhpcy5jb21wbGV4UGFyYW1ldGVycy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0dGhpcy5jb21wbGV4UGFyYW1ldGVycy5wb3AoKS50ZWFyZG93bigpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHdoaWxlICggdGhpcy5iaW5kaW5ncy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0dGhpcy5iaW5kaW5ncy5wb3AoKS50ZWFyZG93bigpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlbW92ZUZyb21MaXZlQ29tcG9uZW50UXVlcmllcyggdGhpcyApO1xuXHRcdFx0XHR0aGlzLnNob3VsZERlc3Ryb3kgPSBkZXN0cm95O1xuXHRcdFx0XHR0aGlzLmluc3RhbmNlLnRlYXJkb3duKCk7XG5cdFx0XHR9LFxuXHRcdFx0dG9TdHJpbmc6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5pbnN0YW5jZS5mcmFnbWVudC50b1N0cmluZygpO1xuXHRcdFx0fSxcblx0XHRcdGZpbmQ6IGZ1bmN0aW9uKCBzZWxlY3RvciApIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuaW5zdGFuY2UuZnJhZ21lbnQuZmluZCggc2VsZWN0b3IgKTtcblx0XHRcdH0sXG5cdFx0XHRmaW5kQWxsOiBmdW5jdGlvbiggc2VsZWN0b3IsIHF1ZXJ5ICkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5pbnN0YW5jZS5mcmFnbWVudC5maW5kQWxsKCBzZWxlY3RvciwgcXVlcnkgKTtcblx0XHRcdH0sXG5cdFx0XHRmaW5kQ29tcG9uZW50OiBmdW5jdGlvbiggc2VsZWN0b3IgKSB7XG5cdFx0XHRcdGlmICggIXNlbGVjdG9yIHx8IHNlbGVjdG9yID09PSB0aGlzLm5hbWUgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuaW5zdGFuY2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCB0aGlzLmluc3RhbmNlLmZyYWdtZW50ICkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmluc3RhbmNlLmZyYWdtZW50LmZpbmRDb21wb25lbnQoIHNlbGVjdG9yICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9LFxuXHRcdFx0ZmluZEFsbENvbXBvbmVudHM6IGZ1bmN0aW9uKCBzZWxlY3RvciwgcXVlcnkgKSB7XG5cdFx0XHRcdHF1ZXJ5Ll90ZXN0KCB0aGlzLCB0cnVlICk7XG5cdFx0XHRcdGlmICggdGhpcy5pbnN0YW5jZS5mcmFnbWVudCApIHtcblx0XHRcdFx0XHR0aGlzLmluc3RhbmNlLmZyYWdtZW50LmZpbmRBbGxDb21wb25lbnRzKCBzZWxlY3RvciwgcXVlcnkgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIERvbUNvbXBvbmVudDtcblxuXHRcdGZ1bmN0aW9uIHJlbW92ZUZyb21MaXZlQ29tcG9uZW50UXVlcmllcyggY29tcG9uZW50ICkge1xuXHRcdFx0dmFyIGluc3RhbmNlLCBxdWVyeTtcblx0XHRcdGluc3RhbmNlID0gY29tcG9uZW50LnJvb3Q7XG5cdFx0XHRkbyB7XG5cdFx0XHRcdGlmICggcXVlcnkgPSBpbnN0YW5jZS5fbGl2ZUNvbXBvbmVudFF1ZXJpZXNbIGNvbXBvbmVudC5uYW1lIF0gKSB7XG5cdFx0XHRcdFx0cXVlcnkuX3JlbW92ZSggY29tcG9uZW50ICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gd2hpbGUgKCBpbnN0YW5jZSA9IGluc3RhbmNlLl9wYXJlbnQgKTtcblx0XHR9XG5cdH0oIHJlbmRlcl9Eb21GcmFnbWVudF9Db21wb25lbnRfaW5pdGlhbGlzZV9faW5pdGlhbGlzZSApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfQ29tbWVudCA9IGZ1bmN0aW9uKCB0eXBlcywgZGV0YWNoICkge1xuXG5cdFx0dmFyIERvbUNvbW1lbnQgPSBmdW5jdGlvbiggb3B0aW9ucywgZG9jRnJhZyApIHtcblx0XHRcdHRoaXMudHlwZSA9IHR5cGVzLkNPTU1FTlQ7XG5cdFx0XHR0aGlzLmRlc2NyaXB0b3IgPSBvcHRpb25zLmRlc2NyaXB0b3I7XG5cdFx0XHRpZiAoIGRvY0ZyYWcgKSB7XG5cdFx0XHRcdHRoaXMubm9kZSA9IGRvY3VtZW50LmNyZWF0ZUNvbW1lbnQoIG9wdGlvbnMuZGVzY3JpcHRvci5mICk7XG5cdFx0XHRcdGRvY0ZyYWcuYXBwZW5kQ2hpbGQoIHRoaXMubm9kZSApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0RG9tQ29tbWVudC5wcm90b3R5cGUgPSB7XG5cdFx0XHRkZXRhY2g6IGRldGFjaCxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbiggZGVzdHJveSApIHtcblx0XHRcdFx0aWYgKCBkZXN0cm95ICkge1xuXHRcdFx0XHRcdHRoaXMuZGV0YWNoKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRmaXJzdE5vZGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5ub2RlO1xuXHRcdFx0fSxcblx0XHRcdHRvU3RyaW5nOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuICc8IS0tJyArIHRoaXMuZGVzY3JpcHRvci5mICsgJy0tPic7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gRG9tQ29tbWVudDtcblx0fSggY29uZmlnX3R5cGVzLCByZW5kZXJfRG9tRnJhZ21lbnRfc2hhcmVkX2RldGFjaCApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfX0RvbUZyYWdtZW50ID0gZnVuY3Rpb24oIHR5cGVzLCBtYXRjaGVzLCBpbml0RnJhZ21lbnQsIGluc2VydEh0bWwsIFRleHQsIEludGVycG9sYXRvciwgU2VjdGlvbiwgVHJpcGxlLCBFbGVtZW50LCBQYXJ0aWFsLCBDb21wb25lbnQsIENvbW1lbnQsIGNpcmN1bGFyICkge1xuXG5cdFx0dmFyIERvbUZyYWdtZW50ID0gZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRpZiAoIG9wdGlvbnMucE5vZGUgKSB7XG5cdFx0XHRcdHRoaXMuZG9jRnJhZyA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcblx0XHRcdH1cblx0XHRcdGlmICggdHlwZW9mIG9wdGlvbnMuZGVzY3JpcHRvciA9PT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdHRoaXMuaHRtbCA9IG9wdGlvbnMuZGVzY3JpcHRvcjtcblx0XHRcdFx0aWYgKCB0aGlzLmRvY0ZyYWcgKSB7XG5cdFx0XHRcdFx0dGhpcy5ub2RlcyA9IGluc2VydEh0bWwoIHRoaXMuaHRtbCwgb3B0aW9ucy5wTm9kZS50YWdOYW1lLCB0aGlzLmRvY0ZyYWcgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aW5pdEZyYWdtZW50KCB0aGlzLCBvcHRpb25zICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHREb21GcmFnbWVudC5wcm90b3R5cGUgPSB7XG5cdFx0XHRkZXRhY2g6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgbGVuLCBpO1xuXHRcdFx0XHRpZiAoIHRoaXMuZG9jRnJhZyApIHtcblx0XHRcdFx0XHRpZiAoIHRoaXMubm9kZXMgKSB7XG5cdFx0XHRcdFx0XHRsZW4gPSB0aGlzLm5vZGVzLmxlbmd0aDtcblx0XHRcdFx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuZG9jRnJhZy5hcHBlbmRDaGlsZCggdGhpcy5ub2Rlc1sgaSBdICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIGlmICggdGhpcy5pdGVtcyApIHtcblx0XHRcdFx0XHRcdGxlbiA9IHRoaXMuaXRlbXMubGVuZ3RoO1xuXHRcdFx0XHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5kb2NGcmFnLmFwcGVuZENoaWxkKCB0aGlzLml0ZW1zWyBpIF0uZGV0YWNoKCkgKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuZG9jRnJhZztcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGNyZWF0ZUl0ZW06IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XHRpZiAoIHR5cGVvZiBvcHRpb25zLmRlc2NyaXB0b3IgPT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHRcdHJldHVybiBuZXcgVGV4dCggb3B0aW9ucywgdGhpcy5kb2NGcmFnICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0c3dpdGNoICggb3B0aW9ucy5kZXNjcmlwdG9yLnQgKSB7XG5cdFx0XHRcdFx0Y2FzZSB0eXBlcy5JTlRFUlBPTEFUT1I6XG5cdFx0XHRcdFx0XHRyZXR1cm4gbmV3IEludGVycG9sYXRvciggb3B0aW9ucywgdGhpcy5kb2NGcmFnICk7XG5cdFx0XHRcdFx0Y2FzZSB0eXBlcy5TRUNUSU9OOlxuXHRcdFx0XHRcdFx0cmV0dXJuIG5ldyBTZWN0aW9uKCBvcHRpb25zLCB0aGlzLmRvY0ZyYWcgKTtcblx0XHRcdFx0XHRjYXNlIHR5cGVzLlRSSVBMRTpcblx0XHRcdFx0XHRcdHJldHVybiBuZXcgVHJpcGxlKCBvcHRpb25zLCB0aGlzLmRvY0ZyYWcgKTtcblx0XHRcdFx0XHRjYXNlIHR5cGVzLkVMRU1FTlQ6XG5cdFx0XHRcdFx0XHRpZiAoIHRoaXMucm9vdC5jb21wb25lbnRzWyBvcHRpb25zLmRlc2NyaXB0b3IuZSBdICkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gbmV3IENvbXBvbmVudCggb3B0aW9ucywgdGhpcy5kb2NGcmFnICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRyZXR1cm4gbmV3IEVsZW1lbnQoIG9wdGlvbnMsIHRoaXMuZG9jRnJhZyApO1xuXHRcdFx0XHRcdGNhc2UgdHlwZXMuUEFSVElBTDpcblx0XHRcdFx0XHRcdHJldHVybiBuZXcgUGFydGlhbCggb3B0aW9ucywgdGhpcy5kb2NGcmFnICk7XG5cdFx0XHRcdFx0Y2FzZSB0eXBlcy5DT01NRU5UOlxuXHRcdFx0XHRcdFx0cmV0dXJuIG5ldyBDb21tZW50KCBvcHRpb25zLCB0aGlzLmRvY0ZyYWcgKTtcblx0XHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnU29tZXRoaW5nIHZlcnkgc3RyYW5nZSBoYXBwZW5lZC4gUGxlYXNlIGZpbGUgYW4gaXNzdWUgYXQgaHR0cHM6Ly9naXRodWIuY29tL1JhY3RpdmVKUy9SYWN0aXZlL2lzc3Vlcy4gVGhhbmtzIScgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbiggZGVzdHJveSApIHtcblx0XHRcdFx0dmFyIG5vZGU7XG5cdFx0XHRcdGlmICggdGhpcy5ub2RlcyAmJiBkZXN0cm95ICkge1xuXHRcdFx0XHRcdHdoaWxlICggbm9kZSA9IHRoaXMubm9kZXMucG9wKCkgKSB7XG5cdFx0XHRcdFx0XHRub2RlLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoIG5vZGUgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSBpZiAoIHRoaXMuaXRlbXMgKSB7XG5cdFx0XHRcdFx0d2hpbGUgKCB0aGlzLml0ZW1zLmxlbmd0aCApIHtcblx0XHRcdFx0XHRcdHRoaXMuaXRlbXMucG9wKCkudGVhcmRvd24oIGRlc3Ryb3kgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5ub2RlcyA9IHRoaXMuaXRlbXMgPSB0aGlzLmRvY0ZyYWcgPSBudWxsO1xuXHRcdFx0fSxcblx0XHRcdGZpcnN0Tm9kZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmICggdGhpcy5pdGVtcyAmJiB0aGlzLml0ZW1zWyAwIF0gKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuaXRlbXNbIDAgXS5maXJzdE5vZGUoKTtcblx0XHRcdFx0fSBlbHNlIGlmICggdGhpcy5ub2RlcyApIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5ub2Rlc1sgMCBdIHx8IG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9LFxuXHRcdFx0ZmluZE5leHROb2RlOiBmdW5jdGlvbiggaXRlbSApIHtcblx0XHRcdFx0dmFyIGluZGV4ID0gaXRlbS5pbmRleDtcblx0XHRcdFx0aWYgKCB0aGlzLml0ZW1zWyBpbmRleCArIDEgXSApIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5pdGVtc1sgaW5kZXggKyAxIF0uZmlyc3ROb2RlKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCB0aGlzLm93bmVyID09PSB0aGlzLnJvb3QgKSB7XG5cdFx0XHRcdFx0aWYgKCAhdGhpcy5vd25lci5jb21wb25lbnQgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMub3duZXIuY29tcG9uZW50LmZpbmROZXh0Tm9kZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0aGlzLm93bmVyLmZpbmROZXh0Tm9kZSggdGhpcyApO1xuXHRcdFx0fSxcblx0XHRcdHRvU3RyaW5nOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIGh0bWwsIGksIGxlbiwgaXRlbTtcblx0XHRcdFx0aWYgKCB0aGlzLmh0bWwgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuaHRtbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRodG1sID0gJyc7XG5cdFx0XHRcdGlmICggIXRoaXMuaXRlbXMgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGh0bWw7XG5cdFx0XHRcdH1cblx0XHRcdFx0bGVuID0gdGhpcy5pdGVtcy5sZW5ndGg7XG5cdFx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0aXRlbSA9IHRoaXMuaXRlbXNbIGkgXTtcblx0XHRcdFx0XHRodG1sICs9IGl0ZW0udG9TdHJpbmcoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gaHRtbDtcblx0XHRcdH0sXG5cdFx0XHRmaW5kOiBmdW5jdGlvbiggc2VsZWN0b3IgKSB7XG5cdFx0XHRcdHZhciBpLCBsZW4sIGl0ZW0sIG5vZGUsIHF1ZXJ5UmVzdWx0O1xuXHRcdFx0XHRpZiAoIHRoaXMubm9kZXMgKSB7XG5cdFx0XHRcdFx0bGVuID0gdGhpcy5ub2Rlcy5sZW5ndGg7XG5cdFx0XHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0XHRcdG5vZGUgPSB0aGlzLm5vZGVzWyBpIF07XG5cdFx0XHRcdFx0XHRpZiAoIG5vZGUubm9kZVR5cGUgIT09IDEgKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKCBtYXRjaGVzKCBub2RlLCBzZWxlY3RvciApICkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gbm9kZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmICggcXVlcnlSZXN1bHQgPSBub2RlLnF1ZXJ5U2VsZWN0b3IoIHNlbGVjdG9yICkgKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBxdWVyeVJlc3VsdDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCB0aGlzLml0ZW1zICkge1xuXHRcdFx0XHRcdGxlbiA9IHRoaXMuaXRlbXMubGVuZ3RoO1xuXHRcdFx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0XHRpdGVtID0gdGhpcy5pdGVtc1sgaSBdO1xuXHRcdFx0XHRcdFx0aWYgKCBpdGVtLmZpbmQgJiYgKCBxdWVyeVJlc3VsdCA9IGl0ZW0uZmluZCggc2VsZWN0b3IgKSApICkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gcXVlcnlSZXN1bHQ7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0ZmluZEFsbDogZnVuY3Rpb24oIHNlbGVjdG9yLCBxdWVyeSApIHtcblx0XHRcdFx0dmFyIGksIGxlbiwgaXRlbSwgbm9kZSwgcXVlcnlBbGxSZXN1bHQsIG51bU5vZGVzLCBqO1xuXHRcdFx0XHRpZiAoIHRoaXMubm9kZXMgKSB7XG5cdFx0XHRcdFx0bGVuID0gdGhpcy5ub2Rlcy5sZW5ndGg7XG5cdFx0XHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0XHRcdG5vZGUgPSB0aGlzLm5vZGVzWyBpIF07XG5cdFx0XHRcdFx0XHRpZiAoIG5vZGUubm9kZVR5cGUgIT09IDEgKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKCBtYXRjaGVzKCBub2RlLCBzZWxlY3RvciApICkge1xuXHRcdFx0XHRcdFx0XHRxdWVyeS5wdXNoKCBub2RlICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoIHF1ZXJ5QWxsUmVzdWx0ID0gbm9kZS5xdWVyeVNlbGVjdG9yQWxsKCBzZWxlY3RvciApICkge1xuXHRcdFx0XHRcdFx0XHRudW1Ob2RlcyA9IHF1ZXJ5QWxsUmVzdWx0Lmxlbmd0aDtcblx0XHRcdFx0XHRcdFx0Zm9yICggaiA9IDA7IGogPCBudW1Ob2RlczsgaiArPSAxICkge1xuXHRcdFx0XHRcdFx0XHRcdHF1ZXJ5LnB1c2goIHF1ZXJ5QWxsUmVzdWx0WyBqIF0gKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIGlmICggdGhpcy5pdGVtcyApIHtcblx0XHRcdFx0XHRsZW4gPSB0aGlzLml0ZW1zLmxlbmd0aDtcblx0XHRcdFx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRcdFx0aXRlbSA9IHRoaXMuaXRlbXNbIGkgXTtcblx0XHRcdFx0XHRcdGlmICggaXRlbS5maW5kQWxsICkge1xuXHRcdFx0XHRcdFx0XHRpdGVtLmZpbmRBbGwoIHNlbGVjdG9yLCBxdWVyeSApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcXVlcnk7XG5cdFx0XHR9LFxuXHRcdFx0ZmluZENvbXBvbmVudDogZnVuY3Rpb24oIHNlbGVjdG9yICkge1xuXHRcdFx0XHR2YXIgbGVuLCBpLCBpdGVtLCBxdWVyeVJlc3VsdDtcblx0XHRcdFx0aWYgKCB0aGlzLml0ZW1zICkge1xuXHRcdFx0XHRcdGxlbiA9IHRoaXMuaXRlbXMubGVuZ3RoO1xuXHRcdFx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0XHRpdGVtID0gdGhpcy5pdGVtc1sgaSBdO1xuXHRcdFx0XHRcdFx0aWYgKCBpdGVtLmZpbmRDb21wb25lbnQgJiYgKCBxdWVyeVJlc3VsdCA9IGl0ZW0uZmluZENvbXBvbmVudCggc2VsZWN0b3IgKSApICkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gcXVlcnlSZXN1bHQ7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0ZmluZEFsbENvbXBvbmVudHM6IGZ1bmN0aW9uKCBzZWxlY3RvciwgcXVlcnkgKSB7XG5cdFx0XHRcdHZhciBpLCBsZW4sIGl0ZW07XG5cdFx0XHRcdGlmICggdGhpcy5pdGVtcyApIHtcblx0XHRcdFx0XHRsZW4gPSB0aGlzLml0ZW1zLmxlbmd0aDtcblx0XHRcdFx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRcdFx0aXRlbSA9IHRoaXMuaXRlbXNbIGkgXTtcblx0XHRcdFx0XHRcdGlmICggaXRlbS5maW5kQWxsQ29tcG9uZW50cyApIHtcblx0XHRcdFx0XHRcdFx0aXRlbS5maW5kQWxsQ29tcG9uZW50cyggc2VsZWN0b3IsIHF1ZXJ5ICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBxdWVyeTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdGNpcmN1bGFyLkRvbUZyYWdtZW50ID0gRG9tRnJhZ21lbnQ7XG5cdFx0cmV0dXJuIERvbUZyYWdtZW50O1xuXHR9KCBjb25maWdfdHlwZXMsIHV0aWxzX21hdGNoZXMsIHJlbmRlcl9zaGFyZWRfaW5pdEZyYWdtZW50LCByZW5kZXJfRG9tRnJhZ21lbnRfc2hhcmVkX2luc2VydEh0bWwsIHJlbmRlcl9Eb21GcmFnbWVudF9UZXh0LCByZW5kZXJfRG9tRnJhZ21lbnRfSW50ZXJwb2xhdG9yLCByZW5kZXJfRG9tRnJhZ21lbnRfU2VjdGlvbl9fU2VjdGlvbiwgcmVuZGVyX0RvbUZyYWdtZW50X1RyaXBsZSwgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfX0VsZW1lbnQsIHJlbmRlcl9Eb21GcmFnbWVudF9QYXJ0aWFsX19QYXJ0aWFsLCByZW5kZXJfRG9tRnJhZ21lbnRfQ29tcG9uZW50X19Db21wb25lbnQsIHJlbmRlcl9Eb21GcmFnbWVudF9Db21tZW50LCBjaXJjdWxhciApO1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9yZW5kZXIgPSBmdW5jdGlvbiggcnVubG9vcCwgY3NzLCBEb21GcmFnbWVudCApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiBSYWN0aXZlX3Byb3RvdHlwZV9yZW5kZXIoIHRhcmdldCwgY2FsbGJhY2sgKSB7XG5cdFx0XHR0aGlzLl9yZW5kZXJpbmcgPSB0cnVlO1xuXHRcdFx0cnVubG9vcC5zdGFydCggdGhpcywgY2FsbGJhY2sgKTtcblx0XHRcdGlmICggIXRoaXMuX2luaXRpbmcgKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ1lvdSBjYW5ub3QgY2FsbCByYWN0aXZlLnJlbmRlcigpIGRpcmVjdGx5IScgKTtcblx0XHRcdH1cblx0XHRcdGlmICggdGhpcy5jb25zdHJ1Y3Rvci5jc3MgKSB7XG5cdFx0XHRcdGNzcy5hZGQoIHRoaXMuY29uc3RydWN0b3IgKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuZnJhZ21lbnQgPSBuZXcgRG9tRnJhZ21lbnQoIHtcblx0XHRcdFx0ZGVzY3JpcHRvcjogdGhpcy50ZW1wbGF0ZSxcblx0XHRcdFx0cm9vdDogdGhpcyxcblx0XHRcdFx0b3duZXI6IHRoaXMsXG5cdFx0XHRcdHBOb2RlOiB0YXJnZXRcblx0XHRcdH0gKTtcblx0XHRcdGlmICggdGFyZ2V0ICkge1xuXHRcdFx0XHR0YXJnZXQuYXBwZW5kQ2hpbGQoIHRoaXMuZnJhZ21lbnQuZG9jRnJhZyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhdGhpcy5fcGFyZW50IHx8ICF0aGlzLl9wYXJlbnQuX3JlbmRlcmluZyApIHtcblx0XHRcdFx0aW5pdENoaWxkcmVuKCB0aGlzICk7XG5cdFx0XHR9XG5cdFx0XHRkZWxldGUgdGhpcy5fcmVuZGVyaW5nO1xuXHRcdFx0cnVubG9vcC5lbmQoKTtcblx0XHR9O1xuXG5cdFx0ZnVuY3Rpb24gaW5pdENoaWxkcmVuKCBpbnN0YW5jZSApIHtcblx0XHRcdHZhciBjaGlsZDtcblx0XHRcdHdoaWxlICggY2hpbGQgPSBpbnN0YW5jZS5fY2hpbGRJbml0UXVldWUucG9wKCkgKSB7XG5cdFx0XHRcdGlmICggY2hpbGQuaW5zdGFuY2UuaW5pdCApIHtcblx0XHRcdFx0XHRjaGlsZC5pbnN0YW5jZS5pbml0KCBjaGlsZC5vcHRpb25zICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aW5pdENoaWxkcmVuKCBjaGlsZC5pbnN0YW5jZSApO1xuXHRcdFx0fVxuXHRcdH1cblx0fSggZ2xvYmFsX3J1bmxvb3AsIGdsb2JhbF9jc3MsIHJlbmRlcl9Eb21GcmFnbWVudF9fRG9tRnJhZ21lbnQgKTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfcmVuZGVySFRNTCA9IGZ1bmN0aW9uKCB3YXJuICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdFx0d2FybiggJ3JlbmRlckhUTUwoKSBoYXMgYmVlbiBkZXByZWNhdGVkIGFuZCB3aWxsIGJlIHJlbW92ZWQgaW4gYSBmdXR1cmUgdmVyc2lvbi4gUGxlYXNlIHVzZSB0b0hUTUwoKSBpbnN0ZWFkJyApO1xuXHRcdFx0cmV0dXJuIHRoaXMudG9IVE1MKCk7XG5cdFx0fTtcblx0fSggdXRpbHNfd2FybiApO1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9yZXNldCA9IGZ1bmN0aW9uKCBQcm9taXNlLCBydW5sb29wLCBjbGVhckNhY2hlLCBub3RpZnlEZXBlbmRhbnRzICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBkYXRhLCBjYWxsYmFjayApIHtcblx0XHRcdHZhciBwcm9taXNlLCBmdWxmaWxQcm9taXNlLCB3cmFwcGVyO1xuXHRcdFx0aWYgKCB0eXBlb2YgZGF0YSA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdFx0Y2FsbGJhY2sgPSBkYXRhO1xuXHRcdFx0XHRkYXRhID0ge307XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRkYXRhID0gZGF0YSB8fCB7fTtcblx0XHRcdH1cblx0XHRcdGlmICggdHlwZW9mIGRhdGEgIT09ICdvYmplY3QnICkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdUaGUgcmVzZXQgbWV0aG9kIHRha2VzIGVpdGhlciBubyBhcmd1bWVudHMsIG9yIGFuIG9iamVjdCBjb250YWluaW5nIG5ldyBkYXRhJyApO1xuXHRcdFx0fVxuXHRcdFx0cHJvbWlzZSA9IG5ldyBQcm9taXNlKCBmdW5jdGlvbiggZnVsZmlsICkge1xuXHRcdFx0XHRmdWxmaWxQcm9taXNlID0gZnVsZmlsO1xuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCBjYWxsYmFjayApIHtcblx0XHRcdFx0cHJvbWlzZS50aGVuKCBjYWxsYmFjayApO1xuXHRcdFx0fVxuXHRcdFx0cnVubG9vcC5zdGFydCggdGhpcywgZnVsZmlsUHJvbWlzZSApO1xuXHRcdFx0aWYgKCAoIHdyYXBwZXIgPSB0aGlzLl93cmFwcGVkWyAnJyBdICkgJiYgd3JhcHBlci5yZXNldCApIHtcblx0XHRcdFx0aWYgKCB3cmFwcGVyLnJlc2V0KCBkYXRhICkgPT09IGZhbHNlICkge1xuXHRcdFx0XHRcdHRoaXMuZGF0YSA9IGRhdGE7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuZGF0YSA9IGRhdGE7XG5cdFx0XHR9XG5cdFx0XHRjbGVhckNhY2hlKCB0aGlzLCAnJyApO1xuXHRcdFx0bm90aWZ5RGVwZW5kYW50cyggdGhpcywgJycgKTtcblx0XHRcdHJ1bmxvb3AuZW5kKCk7XG5cdFx0XHR0aGlzLmZpcmUoICdyZXNldCcsIGRhdGEgKTtcblx0XHRcdHJldHVybiBwcm9taXNlO1xuXHRcdH07XG5cdH0oIHV0aWxzX1Byb21pc2UsIGdsb2JhbF9ydW5sb29wLCBzaGFyZWRfY2xlYXJDYWNoZSwgc2hhcmVkX25vdGlmeURlcGVuZGFudHMgKTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfc2V0ID0gZnVuY3Rpb24oIHJ1bmxvb3AsIGlzT2JqZWN0LCBub3JtYWxpc2VLZXlwYXRoLCBQcm9taXNlLCBzZXQgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24gUmFjdGl2ZV9wcm90b3R5cGVfc2V0KCBrZXlwYXRoLCB2YWx1ZSwgY2FsbGJhY2sgKSB7XG5cdFx0XHR2YXIgbWFwLCBwcm9taXNlLCBmdWxmaWxQcm9taXNlO1xuXHRcdFx0cHJvbWlzZSA9IG5ldyBQcm9taXNlKCBmdW5jdGlvbiggZnVsZmlsICkge1xuXHRcdFx0XHRmdWxmaWxQcm9taXNlID0gZnVsZmlsO1xuXHRcdFx0fSApO1xuXHRcdFx0cnVubG9vcC5zdGFydCggdGhpcywgZnVsZmlsUHJvbWlzZSApO1xuXHRcdFx0aWYgKCBpc09iamVjdCgga2V5cGF0aCApICkge1xuXHRcdFx0XHRtYXAgPSBrZXlwYXRoO1xuXHRcdFx0XHRjYWxsYmFjayA9IHZhbHVlO1xuXHRcdFx0XHRmb3IgKCBrZXlwYXRoIGluIG1hcCApIHtcblx0XHRcdFx0XHRpZiAoIG1hcC5oYXNPd25Qcm9wZXJ0eSgga2V5cGF0aCApICkge1xuXHRcdFx0XHRcdFx0dmFsdWUgPSBtYXBbIGtleXBhdGggXTtcblx0XHRcdFx0XHRcdGtleXBhdGggPSBub3JtYWxpc2VLZXlwYXRoKCBrZXlwYXRoICk7XG5cdFx0XHRcdFx0XHRzZXQoIHRoaXMsIGtleXBhdGgsIHZhbHVlICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRrZXlwYXRoID0gbm9ybWFsaXNlS2V5cGF0aCgga2V5cGF0aCApO1xuXHRcdFx0XHRzZXQoIHRoaXMsIGtleXBhdGgsIHZhbHVlICk7XG5cdFx0XHR9XG5cdFx0XHRydW5sb29wLmVuZCgpO1xuXHRcdFx0aWYgKCBjYWxsYmFjayApIHtcblx0XHRcdFx0cHJvbWlzZS50aGVuKCBjYWxsYmFjay5iaW5kKCB0aGlzICkgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBwcm9taXNlO1xuXHRcdH07XG5cdH0oIGdsb2JhbF9ydW5sb29wLCB1dGlsc19pc09iamVjdCwgdXRpbHNfbm9ybWFsaXNlS2V5cGF0aCwgdXRpbHNfUHJvbWlzZSwgc2hhcmVkX3NldCApO1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9zdWJ0cmFjdCA9IGZ1bmN0aW9uKCBhZGQgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIGtleXBhdGgsIGQgKSB7XG5cdFx0XHRyZXR1cm4gYWRkKCB0aGlzLCBrZXlwYXRoLCBkID09PSB1bmRlZmluZWQgPyAtMSA6IC1kICk7XG5cdFx0fTtcblx0fSggUmFjdGl2ZV9wcm90b3R5cGVfc2hhcmVkX2FkZCApO1xuXG5cdC8vIFRlYXJkb3duLiBUaGlzIGdvZXMgdGhyb3VnaCB0aGUgcm9vdCBmcmFnbWVudCBhbmQgYWxsIGl0cyBjaGlsZHJlbiwgcmVtb3Zpbmcgb2JzZXJ2ZXJzXG5cdC8vIGFuZCBnZW5lcmFsbHkgY2xlYW5pbmcgdXAgYWZ0ZXIgaXRzZWxmXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV90ZWFyZG93biA9IGZ1bmN0aW9uKCB0eXBlcywgY3NzLCBydW5sb29wLCBQcm9taXNlLCBjbGVhckNhY2hlICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBjYWxsYmFjayApIHtcblx0XHRcdHZhciBrZXlwYXRoLCBwcm9taXNlLCBmdWxmaWxQcm9taXNlLCBzaG91bGREZXN0cm95LCBvcmlnaW5hbENhbGxiYWNrLCBmcmFnbWVudCwgbmVhcmVzdERldGFjaGluZ0VsZW1lbnQsIHVucmVzb2x2ZWRJbXBsaWNpdERlcGVuZGVuY3k7XG5cdFx0XHR0aGlzLmZpcmUoICd0ZWFyZG93bicgKTtcblx0XHRcdHNob3VsZERlc3Ryb3kgPSAhdGhpcy5jb21wb25lbnQgfHwgdGhpcy5jb21wb25lbnQuc2hvdWxkRGVzdHJveTtcblx0XHRcdGlmICggdGhpcy5jb25zdHJ1Y3Rvci5jc3MgKSB7XG5cdFx0XHRcdGlmICggc2hvdWxkRGVzdHJveSApIHtcblx0XHRcdFx0XHRvcmlnaW5hbENhbGxiYWNrID0gY2FsbGJhY2s7XG5cdFx0XHRcdFx0Y2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdGlmICggb3JpZ2luYWxDYWxsYmFjayApIHtcblx0XHRcdFx0XHRcdFx0b3JpZ2luYWxDYWxsYmFjay5jYWxsKCB0aGlzICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjc3MucmVtb3ZlKCB0aGlzLmNvbnN0cnVjdG9yICk7XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRmcmFnbWVudCA9IHRoaXMuY29tcG9uZW50LnBhcmVudEZyYWdtZW50O1xuXHRcdFx0XHRcdGRvIHtcblx0XHRcdFx0XHRcdGlmICggZnJhZ21lbnQub3duZXIudHlwZSAhPT0gdHlwZXMuRUxFTUVOVCApIHtcblx0XHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoIGZyYWdtZW50Lm93bmVyLndpbGxEZXRhY2ggKSB7XG5cdFx0XHRcdFx0XHRcdG5lYXJlc3REZXRhY2hpbmdFbGVtZW50ID0gZnJhZ21lbnQub3duZXI7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSB3aGlsZSAoICFuZWFyZXN0RGV0YWNoaW5nRWxlbWVudCAmJiAoIGZyYWdtZW50ID0gZnJhZ21lbnQucGFyZW50ICkgKTtcblx0XHRcdFx0XHRpZiAoICFuZWFyZXN0RGV0YWNoaW5nRWxlbWVudCApIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ0EgY29tcG9uZW50IGlzIGJlaW5nIHRvcm4gZG93biBidXQgZG9lc25cXCd0IGhhdmUgYSBuZWFyZXN0IGRldGFjaGluZyBlbGVtZW50Li4uIHRoaXMgc2hvdWxkblxcJ3QgaGFwcGVuIScgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bmVhcmVzdERldGFjaGluZ0VsZW1lbnQuY3NzRGV0YWNoUXVldWUucHVzaCggdGhpcy5jb25zdHJ1Y3RvciApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRwcm9taXNlID0gbmV3IFByb21pc2UoIGZ1bmN0aW9uKCBmdWxmaWwgKSB7XG5cdFx0XHRcdGZ1bGZpbFByb21pc2UgPSBmdWxmaWw7XG5cdFx0XHR9ICk7XG5cdFx0XHRydW5sb29wLnN0YXJ0KCB0aGlzLCBmdWxmaWxQcm9taXNlICk7XG5cdFx0XHR0aGlzLmZyYWdtZW50LnRlYXJkb3duKCBzaG91bGREZXN0cm95ICk7XG5cdFx0XHR3aGlsZSAoIHRoaXMuX2FuaW1hdGlvbnNbIDAgXSApIHtcblx0XHRcdFx0dGhpcy5fYW5pbWF0aW9uc1sgMCBdLnN0b3AoKTtcblx0XHRcdH1cblx0XHRcdGZvciAoIGtleXBhdGggaW4gdGhpcy5fY2FjaGUgKSB7XG5cdFx0XHRcdGNsZWFyQ2FjaGUoIHRoaXMsIGtleXBhdGggKTtcblx0XHRcdH1cblx0XHRcdHdoaWxlICggdW5yZXNvbHZlZEltcGxpY2l0RGVwZW5kZW5jeSA9IHRoaXMuX3VucmVzb2x2ZWRJbXBsaWNpdERlcGVuZGVuY2llcy5wb3AoKSApIHtcblx0XHRcdFx0dW5yZXNvbHZlZEltcGxpY2l0RGVwZW5kZW5jeS50ZWFyZG93bigpO1xuXHRcdFx0fVxuXHRcdFx0cnVubG9vcC5lbmQoKTtcblx0XHRcdGlmICggY2FsbGJhY2sgKSB7XG5cdFx0XHRcdHByb21pc2UudGhlbiggY2FsbGJhY2suYmluZCggdGhpcyApICk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcHJvbWlzZTtcblx0XHR9O1xuXHR9KCBjb25maWdfdHlwZXMsIGdsb2JhbF9jc3MsIGdsb2JhbF9ydW5sb29wLCB1dGlsc19Qcm9taXNlLCBzaGFyZWRfY2xlYXJDYWNoZSApO1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV90b0hUTUwgPSBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5mcmFnbWVudC50b1N0cmluZygpO1xuXHR9O1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV90b2dnbGUgPSBmdW5jdGlvbigga2V5cGF0aCwgY2FsbGJhY2sgKSB7XG5cdFx0dmFyIHZhbHVlO1xuXHRcdGlmICggdHlwZW9mIGtleXBhdGggIT09ICdzdHJpbmcnICkge1xuXHRcdFx0aWYgKCB0aGlzLmRlYnVnICkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdCYWQgYXJndW1lbnRzJyApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR2YWx1ZSA9IHRoaXMuZ2V0KCBrZXlwYXRoICk7XG5cdFx0cmV0dXJuIHRoaXMuc2V0KCBrZXlwYXRoLCAhdmFsdWUsIGNhbGxiYWNrICk7XG5cdH07XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX3VwZGF0ZSA9IGZ1bmN0aW9uKCBydW5sb29wLCBQcm9taXNlLCBjbGVhckNhY2hlLCBub3RpZnlEZXBlbmRhbnRzICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBrZXlwYXRoLCBjYWxsYmFjayApIHtcblx0XHRcdHZhciBwcm9taXNlLCBmdWxmaWxQcm9taXNlO1xuXHRcdFx0aWYgKCB0eXBlb2Yga2V5cGF0aCA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdFx0Y2FsbGJhY2sgPSBrZXlwYXRoO1xuXHRcdFx0XHRrZXlwYXRoID0gJyc7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRrZXlwYXRoID0ga2V5cGF0aCB8fCAnJztcblx0XHRcdH1cblx0XHRcdHByb21pc2UgPSBuZXcgUHJvbWlzZSggZnVuY3Rpb24oIGZ1bGZpbCApIHtcblx0XHRcdFx0ZnVsZmlsUHJvbWlzZSA9IGZ1bGZpbDtcblx0XHRcdH0gKTtcblx0XHRcdHJ1bmxvb3Auc3RhcnQoIHRoaXMsIGZ1bGZpbFByb21pc2UgKTtcblx0XHRcdGNsZWFyQ2FjaGUoIHRoaXMsIGtleXBhdGggKTtcblx0XHRcdG5vdGlmeURlcGVuZGFudHMoIHRoaXMsIGtleXBhdGggKTtcblx0XHRcdHJ1bmxvb3AuZW5kKCk7XG5cdFx0XHR0aGlzLmZpcmUoICd1cGRhdGUnLCBrZXlwYXRoICk7XG5cdFx0XHRpZiAoIGNhbGxiYWNrICkge1xuXHRcdFx0XHRwcm9taXNlLnRoZW4oIGNhbGxiYWNrLmJpbmQoIHRoaXMgKSApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHByb21pc2U7XG5cdFx0fTtcblx0fSggZ2xvYmFsX3J1bmxvb3AsIHV0aWxzX1Byb21pc2UsIHNoYXJlZF9jbGVhckNhY2hlLCBzaGFyZWRfbm90aWZ5RGVwZW5kYW50cyApO1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV91cGRhdGVNb2RlbCA9IGZ1bmN0aW9uKCBnZXRWYWx1ZUZyb21DaGVja2JveGVzLCBhcnJheUNvbnRlbnRzTWF0Y2gsIGlzRXF1YWwgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24gUmFjdGl2ZV9wcm90b3R5cGVfdXBkYXRlTW9kZWwoIGtleXBhdGgsIGNhc2NhZGUgKSB7XG5cdFx0XHR2YXIgdmFsdWVzLCBkZWZlcnJlZENoZWNrYm94ZXMsIGk7XG5cdFx0XHRpZiAoIHR5cGVvZiBrZXlwYXRoICE9PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0a2V5cGF0aCA9ICcnO1xuXHRcdFx0XHRjYXNjYWRlID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGNvbnNvbGlkYXRlQ2hhbmdlZFZhbHVlcyggdGhpcywga2V5cGF0aCwgdmFsdWVzID0ge30sIGRlZmVycmVkQ2hlY2tib3hlcyA9IFtdLCBjYXNjYWRlICk7XG5cdFx0XHRpZiAoIGkgPSBkZWZlcnJlZENoZWNrYm94ZXMubGVuZ3RoICkge1xuXHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRrZXlwYXRoID0gZGVmZXJyZWRDaGVja2JveGVzWyBpIF07XG5cdFx0XHRcdFx0dmFsdWVzWyBrZXlwYXRoIF0gPSBnZXRWYWx1ZUZyb21DaGVja2JveGVzKCB0aGlzLCBrZXlwYXRoICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHRoaXMuc2V0KCB2YWx1ZXMgKTtcblx0XHR9O1xuXG5cdFx0ZnVuY3Rpb24gY29uc29saWRhdGVDaGFuZ2VkVmFsdWVzKCByYWN0aXZlLCBrZXlwYXRoLCB2YWx1ZXMsIGRlZmVycmVkQ2hlY2tib3hlcywgY2FzY2FkZSApIHtcblx0XHRcdHZhciBiaW5kaW5ncywgY2hpbGREZXBzLCBpLCBiaW5kaW5nLCBvbGRWYWx1ZSwgbmV3VmFsdWU7XG5cdFx0XHRiaW5kaW5ncyA9IHJhY3RpdmUuX3R3b3dheUJpbmRpbmdzWyBrZXlwYXRoIF07XG5cdFx0XHRpZiAoIGJpbmRpbmdzICkge1xuXHRcdFx0XHRpID0gYmluZGluZ3MubGVuZ3RoO1xuXHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRiaW5kaW5nID0gYmluZGluZ3NbIGkgXTtcblx0XHRcdFx0XHRpZiAoIGJpbmRpbmcucmFkaW9OYW1lICYmICFiaW5kaW5nLm5vZGUuY2hlY2tlZCApIHtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIGJpbmRpbmcuY2hlY2tib3hOYW1lICkge1xuXHRcdFx0XHRcdFx0aWYgKCBiaW5kaW5nLmNoYW5nZWQoKSAmJiBkZWZlcnJlZENoZWNrYm94ZXNbIGtleXBhdGggXSAhPT0gdHJ1ZSApIHtcblx0XHRcdFx0XHRcdFx0ZGVmZXJyZWRDaGVja2JveGVzWyBrZXlwYXRoIF0gPSB0cnVlO1xuXHRcdFx0XHRcdFx0XHRkZWZlcnJlZENoZWNrYm94ZXMucHVzaCgga2V5cGF0aCApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdG9sZFZhbHVlID0gYmluZGluZy5hdHRyLnZhbHVlO1xuXHRcdFx0XHRcdG5ld1ZhbHVlID0gYmluZGluZy52YWx1ZSgpO1xuXHRcdFx0XHRcdGlmICggYXJyYXlDb250ZW50c01hdGNoKCBvbGRWYWx1ZSwgbmV3VmFsdWUgKSApIHtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoICFpc0VxdWFsKCBvbGRWYWx1ZSwgbmV3VmFsdWUgKSApIHtcblx0XHRcdFx0XHRcdHZhbHVlc1sga2V5cGF0aCBdID0gbmV3VmFsdWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoICFjYXNjYWRlICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjaGlsZERlcHMgPSByYWN0aXZlLl9kZXBzTWFwWyBrZXlwYXRoIF07XG5cdFx0XHRpZiAoIGNoaWxkRGVwcyApIHtcblx0XHRcdFx0aSA9IGNoaWxkRGVwcy5sZW5ndGg7XG5cdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdGNvbnNvbGlkYXRlQ2hhbmdlZFZhbHVlcyggcmFjdGl2ZSwgY2hpbGREZXBzWyBpIF0sIHZhbHVlcywgZGVmZXJyZWRDaGVja2JveGVzLCBjYXNjYWRlICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH0oIHNoYXJlZF9nZXRWYWx1ZUZyb21DaGVja2JveGVzLCB1dGlsc19hcnJheUNvbnRlbnRzTWF0Y2gsIHV0aWxzX2lzRXF1YWwgKTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfX3Byb3RvdHlwZSA9IGZ1bmN0aW9uKCBhZGQsIGFuaW1hdGUsIGRldGFjaCwgZmluZCwgZmluZEFsbCwgZmluZEFsbENvbXBvbmVudHMsIGZpbmRDb21wb25lbnQsIGZpcmUsIGdldCwgaW5zZXJ0LCBtZXJnZSwgb2JzZXJ2ZSwgb2ZmLCBvbiwgcmVuZGVyLCByZW5kZXJIVE1MLCByZXNldCwgc2V0LCBzdWJ0cmFjdCwgdGVhcmRvd24sIHRvSFRNTCwgdG9nZ2xlLCB1cGRhdGUsIHVwZGF0ZU1vZGVsICkge1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGFkZDogYWRkLFxuXHRcdFx0YW5pbWF0ZTogYW5pbWF0ZSxcblx0XHRcdGRldGFjaDogZGV0YWNoLFxuXHRcdFx0ZmluZDogZmluZCxcblx0XHRcdGZpbmRBbGw6IGZpbmRBbGwsXG5cdFx0XHRmaW5kQWxsQ29tcG9uZW50czogZmluZEFsbENvbXBvbmVudHMsXG5cdFx0XHRmaW5kQ29tcG9uZW50OiBmaW5kQ29tcG9uZW50LFxuXHRcdFx0ZmlyZTogZmlyZSxcblx0XHRcdGdldDogZ2V0LFxuXHRcdFx0aW5zZXJ0OiBpbnNlcnQsXG5cdFx0XHRtZXJnZTogbWVyZ2UsXG5cdFx0XHRvYnNlcnZlOiBvYnNlcnZlLFxuXHRcdFx0b2ZmOiBvZmYsXG5cdFx0XHRvbjogb24sXG5cdFx0XHRyZW5kZXI6IHJlbmRlcixcblx0XHRcdHJlbmRlckhUTUw6IHJlbmRlckhUTUwsXG5cdFx0XHRyZXNldDogcmVzZXQsXG5cdFx0XHRzZXQ6IHNldCxcblx0XHRcdHN1YnRyYWN0OiBzdWJ0cmFjdCxcblx0XHRcdHRlYXJkb3duOiB0ZWFyZG93bixcblx0XHRcdHRvSFRNTDogdG9IVE1MLFxuXHRcdFx0dG9nZ2xlOiB0b2dnbGUsXG5cdFx0XHR1cGRhdGU6IHVwZGF0ZSxcblx0XHRcdHVwZGF0ZU1vZGVsOiB1cGRhdGVNb2RlbFxuXHRcdH07XG5cdH0oIFJhY3RpdmVfcHJvdG90eXBlX2FkZCwgUmFjdGl2ZV9wcm90b3R5cGVfYW5pbWF0ZV9fYW5pbWF0ZSwgUmFjdGl2ZV9wcm90b3R5cGVfZGV0YWNoLCBSYWN0aXZlX3Byb3RvdHlwZV9maW5kLCBSYWN0aXZlX3Byb3RvdHlwZV9maW5kQWxsLCBSYWN0aXZlX3Byb3RvdHlwZV9maW5kQWxsQ29tcG9uZW50cywgUmFjdGl2ZV9wcm90b3R5cGVfZmluZENvbXBvbmVudCwgUmFjdGl2ZV9wcm90b3R5cGVfZmlyZSwgUmFjdGl2ZV9wcm90b3R5cGVfZ2V0LCBSYWN0aXZlX3Byb3RvdHlwZV9pbnNlcnQsIFJhY3RpdmVfcHJvdG90eXBlX21lcmdlX19tZXJnZSwgUmFjdGl2ZV9wcm90b3R5cGVfb2JzZXJ2ZV9fb2JzZXJ2ZSwgUmFjdGl2ZV9wcm90b3R5cGVfb2ZmLCBSYWN0aXZlX3Byb3RvdHlwZV9vbiwgUmFjdGl2ZV9wcm90b3R5cGVfcmVuZGVyLCBSYWN0aXZlX3Byb3RvdHlwZV9yZW5kZXJIVE1MLCBSYWN0aXZlX3Byb3RvdHlwZV9yZXNldCwgUmFjdGl2ZV9wcm90b3R5cGVfc2V0LCBSYWN0aXZlX3Byb3RvdHlwZV9zdWJ0cmFjdCwgUmFjdGl2ZV9wcm90b3R5cGVfdGVhcmRvd24sIFJhY3RpdmVfcHJvdG90eXBlX3RvSFRNTCwgUmFjdGl2ZV9wcm90b3R5cGVfdG9nZ2xlLCBSYWN0aXZlX3Byb3RvdHlwZV91cGRhdGUsIFJhY3RpdmVfcHJvdG90eXBlX3VwZGF0ZU1vZGVsICk7XG5cblx0dmFyIHJlZ2lzdHJpZXNfY29tcG9uZW50cyA9IHt9O1xuXG5cdC8vIFRoZXNlIGFyZSBhIHN1YnNldCBvZiB0aGUgZWFzaW5nIGVxdWF0aW9ucyBmb3VuZCBhdFxuXHQvLyBodHRwczovL3Jhdy5naXRodWIuY29tL2RhbnJvL2Vhc2luZy1qcyAtIGxpY2Vuc2UgaW5mb1xuXHQvLyBmb2xsb3dzOlxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXHQvLyBlYXNpbmcuanMgdjAuNS40XG5cdC8vIEdlbmVyaWMgc2V0IG9mIGVhc2luZyBmdW5jdGlvbnMgd2l0aCBBTUQgc3VwcG9ydFxuXHQvLyBodHRwczovL2dpdGh1Yi5jb20vZGFucm8vZWFzaW5nLWpzXG5cdC8vIFRoaXMgY29kZSBtYXkgYmUgZnJlZWx5IGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBNSVQgbGljZW5zZVxuXHQvLyBodHRwOi8vZGFucm8ubWl0LWxpY2Vuc2Uub3JnL1xuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXHQvLyBBbGwgZnVuY3Rpb25zIGFkYXB0ZWQgZnJvbSBUaG9tYXMgRnVjaHMgJiBKZXJlbXkgS2FoblxuXHQvLyBFYXNpbmcgRXF1YXRpb25zIChjKSAyMDAzIFJvYmVydCBQZW5uZXIsIEJTRCBsaWNlbnNlXG5cdC8vIGh0dHBzOi8vcmF3LmdpdGh1Yi5jb20vZGFucm8vZWFzaW5nLWpzL21hc3Rlci9MSUNFTlNFXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cdC8vIEluIHRoYXQgbGlicmFyeSwgdGhlIGZ1bmN0aW9ucyBuYW1lZCBlYXNlSW4sIGVhc2VPdXQsIGFuZFxuXHQvLyBlYXNlSW5PdXQgYmVsb3cgYXJlIG5hbWVkIGVhc2VJbkN1YmljLCBlYXNlT3V0Q3ViaWMsIGFuZFxuXHQvLyAoeW91IGd1ZXNzZWQgaXQpIGVhc2VJbk91dEN1YmljLlxuXHQvL1xuXHQvLyBZb3UgY2FuIGFkZCBhZGRpdGlvbmFsIGVhc2luZyBmdW5jdGlvbnMgdG8gdGhpcyBsaXN0LCBhbmQgdGhleVxuXHQvLyB3aWxsIGJlIGdsb2JhbGx5IGF2YWlsYWJsZS5cblx0dmFyIHJlZ2lzdHJpZXNfZWFzaW5nID0ge1xuXHRcdGxpbmVhcjogZnVuY3Rpb24oIHBvcyApIHtcblx0XHRcdHJldHVybiBwb3M7XG5cdFx0fSxcblx0XHRlYXNlSW46IGZ1bmN0aW9uKCBwb3MgKSB7XG5cdFx0XHRyZXR1cm4gTWF0aC5wb3coIHBvcywgMyApO1xuXHRcdH0sXG5cdFx0ZWFzZU91dDogZnVuY3Rpb24oIHBvcyApIHtcblx0XHRcdHJldHVybiBNYXRoLnBvdyggcG9zIC0gMSwgMyApICsgMTtcblx0XHR9LFxuXHRcdGVhc2VJbk91dDogZnVuY3Rpb24oIHBvcyApIHtcblx0XHRcdGlmICggKCBwb3MgLz0gMC41ICkgPCAxICkge1xuXHRcdFx0XHRyZXR1cm4gMC41ICogTWF0aC5wb3coIHBvcywgMyApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIDAuNSAqICggTWF0aC5wb3coIHBvcyAtIDIsIDMgKSArIDIgKTtcblx0XHR9XG5cdH07XG5cblx0dmFyIHV0aWxzX2dldEd1aWQgPSBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gJ3h4eHh4eHh4LXh4eHgtNHh4eC15eHh4LXh4eHh4eHh4eHh4eCcucmVwbGFjZSggL1t4eV0vZywgZnVuY3Rpb24oIGMgKSB7XG5cdFx0XHR2YXIgciwgdjtcblx0XHRcdHIgPSBNYXRoLnJhbmRvbSgpICogMTYgfCAwO1xuXHRcdFx0diA9IGMgPT0gJ3gnID8gciA6IHIgJiAzIHwgODtcblx0XHRcdHJldHVybiB2LnRvU3RyaW5nKCAxNiApO1xuXHRcdH0gKTtcblx0fTtcblxuXHR2YXIgdXRpbHNfZXh0ZW5kID0gZnVuY3Rpb24oIHRhcmdldCApIHtcblx0XHR2YXIgcHJvcCwgc291cmNlLCBzb3VyY2VzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoIGFyZ3VtZW50cywgMSApO1xuXHRcdHdoaWxlICggc291cmNlID0gc291cmNlcy5zaGlmdCgpICkge1xuXHRcdFx0Zm9yICggcHJvcCBpbiBzb3VyY2UgKSB7XG5cdFx0XHRcdGlmICggc291cmNlLmhhc093blByb3BlcnR5KCBwcm9wICkgKSB7XG5cdFx0XHRcdFx0dGFyZ2V0WyBwcm9wIF0gPSBzb3VyY2VbIHByb3AgXTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdGFyZ2V0O1xuXHR9O1xuXG5cdHZhciBjb25maWdfcmVnaXN0cmllcyA9IFtcblx0XHQnYWRhcHRvcnMnLFxuXHRcdCdjb21wb25lbnRzJyxcblx0XHQnZGVjb3JhdG9ycycsXG5cdFx0J2Vhc2luZycsXG5cdFx0J2V2ZW50cycsXG5cdFx0J2ludGVycG9sYXRvcnMnLFxuXHRcdCdwYXJ0aWFscycsXG5cdFx0J3RyYW5zaXRpb25zJyxcblx0XHQnZGF0YSdcblx0XTtcblxuXHR2YXIgZXh0ZW5kX3V0aWxzX3RyYW5zZm9ybUNzcyA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0dmFyIHNlbGVjdG9yc1BhdHRlcm4gPSAvKD86XnxcXH0pP1xccyooW15cXHtcXH1dKylcXHMqXFx7L2csXG5cdFx0XHRjb21tZW50c1BhdHRlcm4gPSAvXFwvXFwqLio/XFwqXFwvL2csXG5cdFx0XHRzZWxlY3RvclVuaXRQYXR0ZXJuID0gLygoPzooPzpcXFtbXlxcXStdXFxdKXwoPzpbXlxcc1xcK1xcPlxcfjpdKSkrKSgoPzo6W15cXHNcXCtcXD5cXH5dKyk/XFxzKltcXHNcXCtcXD5cXH5dPylcXHMqL2c7XG5cdFx0cmV0dXJuIGZ1bmN0aW9uIHRyYW5zZm9ybUNzcyggY3NzLCBndWlkICkge1xuXHRcdFx0dmFyIHRyYW5zZm9ybWVkLCBhZGRHdWlkO1xuXHRcdFx0YWRkR3VpZCA9IGZ1bmN0aW9uKCBzZWxlY3RvciApIHtcblx0XHRcdFx0dmFyIHNlbGVjdG9yVW5pdHMsIG1hdGNoLCB1bml0LCBkYXRhQXR0ciwgYmFzZSwgcHJlcGVuZGVkLCBhcHBlbmRlZCwgaSwgdHJhbnNmb3JtZWQgPSBbXTtcblx0XHRcdFx0c2VsZWN0b3JVbml0cyA9IFtdO1xuXHRcdFx0XHR3aGlsZSAoIG1hdGNoID0gc2VsZWN0b3JVbml0UGF0dGVybi5leGVjKCBzZWxlY3RvciApICkge1xuXHRcdFx0XHRcdHNlbGVjdG9yVW5pdHMucHVzaCgge1xuXHRcdFx0XHRcdFx0c3RyOiBtYXRjaFsgMCBdLFxuXHRcdFx0XHRcdFx0YmFzZTogbWF0Y2hbIDEgXSxcblx0XHRcdFx0XHRcdG1vZGlmaWVyczogbWF0Y2hbIDIgXVxuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRkYXRhQXR0ciA9ICdbZGF0YS1ydmNndWlkPVwiJyArIGd1aWQgKyAnXCJdJztcblx0XHRcdFx0YmFzZSA9IHNlbGVjdG9yVW5pdHMubWFwKCBleHRyYWN0U3RyaW5nICk7XG5cdFx0XHRcdGkgPSBzZWxlY3RvclVuaXRzLmxlbmd0aDtcblx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0YXBwZW5kZWQgPSBiYXNlLnNsaWNlKCk7XG5cdFx0XHRcdFx0dW5pdCA9IHNlbGVjdG9yVW5pdHNbIGkgXTtcblx0XHRcdFx0XHRhcHBlbmRlZFsgaSBdID0gdW5pdC5iYXNlICsgZGF0YUF0dHIgKyB1bml0Lm1vZGlmaWVycyB8fCAnJztcblx0XHRcdFx0XHRwcmVwZW5kZWQgPSBiYXNlLnNsaWNlKCk7XG5cdFx0XHRcdFx0cHJlcGVuZGVkWyBpIF0gPSBkYXRhQXR0ciArICcgJyArIHByZXBlbmRlZFsgaSBdO1xuXHRcdFx0XHRcdHRyYW5zZm9ybWVkLnB1c2goIGFwcGVuZGVkLmpvaW4oICcgJyApLCBwcmVwZW5kZWQuam9pbiggJyAnICkgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdHJhbnNmb3JtZWQuam9pbiggJywgJyApO1xuXHRcdFx0fTtcblx0XHRcdHRyYW5zZm9ybWVkID0gY3NzLnJlcGxhY2UoIGNvbW1lbnRzUGF0dGVybiwgJycgKS5yZXBsYWNlKCBzZWxlY3RvcnNQYXR0ZXJuLCBmdW5jdGlvbiggbWF0Y2gsICQxICkge1xuXHRcdFx0XHR2YXIgc2VsZWN0b3JzLCB0cmFuc2Zvcm1lZDtcblx0XHRcdFx0c2VsZWN0b3JzID0gJDEuc3BsaXQoICcsJyApLm1hcCggdHJpbSApO1xuXHRcdFx0XHR0cmFuc2Zvcm1lZCA9IHNlbGVjdG9ycy5tYXAoIGFkZEd1aWQgKS5qb2luKCAnLCAnICkgKyAnICc7XG5cdFx0XHRcdHJldHVybiBtYXRjaC5yZXBsYWNlKCAkMSwgdHJhbnNmb3JtZWQgKTtcblx0XHRcdH0gKTtcblx0XHRcdHJldHVybiB0cmFuc2Zvcm1lZDtcblx0XHR9O1xuXG5cdFx0ZnVuY3Rpb24gdHJpbSggc3RyICkge1xuXHRcdFx0aWYgKCBzdHIudHJpbSApIHtcblx0XHRcdFx0cmV0dXJuIHN0ci50cmltKCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gc3RyLnJlcGxhY2UoIC9eXFxzKy8sICcnICkucmVwbGFjZSggL1xccyskLywgJycgKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBleHRyYWN0U3RyaW5nKCB1bml0ICkge1xuXHRcdFx0cmV0dXJuIHVuaXQuc3RyO1xuXHRcdH1cblx0fSgpO1xuXG5cdHZhciBleHRlbmRfaW5oZXJpdEZyb21QYXJlbnQgPSBmdW5jdGlvbiggcmVnaXN0cmllcywgY3JlYXRlLCBkZWZpbmVQcm9wZXJ0eSwgdHJhbnNmb3JtQ3NzICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBDaGlsZCwgUGFyZW50ICkge1xuXHRcdFx0cmVnaXN0cmllcy5mb3JFYWNoKCBmdW5jdGlvbiggcHJvcGVydHkgKSB7XG5cdFx0XHRcdGlmICggUGFyZW50WyBwcm9wZXJ0eSBdICkge1xuXHRcdFx0XHRcdENoaWxkWyBwcm9wZXJ0eSBdID0gY3JlYXRlKCBQYXJlbnRbIHByb3BlcnR5IF0gKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0ZGVmaW5lUHJvcGVydHkoIENoaWxkLCAnZGVmYXVsdHMnLCB7XG5cdFx0XHRcdHZhbHVlOiBjcmVhdGUoIFBhcmVudC5kZWZhdWx0cyApXG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoIFBhcmVudC5jc3MgKSB7XG5cdFx0XHRcdGRlZmluZVByb3BlcnR5KCBDaGlsZCwgJ2NzcycsIHtcblx0XHRcdFx0XHR2YWx1ZTogUGFyZW50LmRlZmF1bHRzLm5vQ3NzVHJhbnNmb3JtID8gUGFyZW50LmNzcyA6IHRyYW5zZm9ybUNzcyggUGFyZW50LmNzcywgQ2hpbGQuX2d1aWQgKVxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fSggY29uZmlnX3JlZ2lzdHJpZXMsIHV0aWxzX2NyZWF0ZSwgdXRpbHNfZGVmaW5lUHJvcGVydHksIGV4dGVuZF91dGlsc190cmFuc2Zvcm1Dc3MgKTtcblxuXHR2YXIgZXh0ZW5kX3dyYXBNZXRob2QgPSBmdW5jdGlvbiggbWV0aG9kLCBzdXBlck1ldGhvZCApIHtcblx0XHRpZiAoIC9fc3VwZXIvLnRlc3QoIG1ldGhvZCApICkge1xuXHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgX3N1cGVyID0gdGhpcy5fc3VwZXIsXG5cdFx0XHRcdFx0cmVzdWx0O1xuXHRcdFx0XHR0aGlzLl9zdXBlciA9IHN1cGVyTWV0aG9kO1xuXHRcdFx0XHRyZXN1bHQgPSBtZXRob2QuYXBwbHkoIHRoaXMsIGFyZ3VtZW50cyApO1xuXHRcdFx0XHR0aGlzLl9zdXBlciA9IF9zdXBlcjtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBtZXRob2Q7XG5cdFx0fVxuXHR9O1xuXG5cdHZhciBleHRlbmRfdXRpbHNfYXVnbWVudCA9IGZ1bmN0aW9uKCB0YXJnZXQsIHNvdXJjZSApIHtcblx0XHR2YXIga2V5O1xuXHRcdGZvciAoIGtleSBpbiBzb3VyY2UgKSB7XG5cdFx0XHRpZiAoIHNvdXJjZS5oYXNPd25Qcm9wZXJ0eSgga2V5ICkgKSB7XG5cdFx0XHRcdHRhcmdldFsga2V5IF0gPSBzb3VyY2VbIGtleSBdO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdGFyZ2V0O1xuXHR9O1xuXG5cdHZhciBleHRlbmRfaW5oZXJpdEZyb21DaGlsZFByb3BzID0gZnVuY3Rpb24oIGluaXRPcHRpb25zLCByZWdpc3RyaWVzLCBkZWZpbmVQcm9wZXJ0eSwgd3JhcE1ldGhvZCwgYXVnbWVudCwgdHJhbnNmb3JtQ3NzICkge1xuXG5cdFx0dmFyIGJsYWNrbGlzdGVkID0ge307XG5cdFx0cmVnaXN0cmllcy5jb25jYXQoIGluaXRPcHRpb25zLmtleXMgKS5mb3JFYWNoKCBmdW5jdGlvbiggcHJvcGVydHkgKSB7XG5cdFx0XHRibGFja2xpc3RlZFsgcHJvcGVydHkgXSA9IHRydWU7XG5cdFx0fSApO1xuXHRcdHJldHVybiBmdW5jdGlvbiggQ2hpbGQsIGNoaWxkUHJvcHMgKSB7XG5cdFx0XHR2YXIga2V5LCBtZW1iZXI7XG5cdFx0XHRyZWdpc3RyaWVzLmZvckVhY2goIGZ1bmN0aW9uKCBwcm9wZXJ0eSApIHtcblx0XHRcdFx0dmFyIHZhbHVlID0gY2hpbGRQcm9wc1sgcHJvcGVydHkgXTtcblx0XHRcdFx0aWYgKCB2YWx1ZSApIHtcblx0XHRcdFx0XHRpZiAoIENoaWxkWyBwcm9wZXJ0eSBdICkge1xuXHRcdFx0XHRcdFx0YXVnbWVudCggQ2hpbGRbIHByb3BlcnR5IF0sIHZhbHVlICk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdENoaWxkWyBwcm9wZXJ0eSBdID0gdmFsdWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRpbml0T3B0aW9ucy5rZXlzLmZvckVhY2goIGZ1bmN0aW9uKCBrZXkgKSB7XG5cdFx0XHRcdHZhciB2YWx1ZSA9IGNoaWxkUHJvcHNbIGtleSBdO1xuXHRcdFx0XHRpZiAoIHZhbHVlICE9PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdFx0aWYgKCB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicgJiYgdHlwZW9mIENoaWxkWyBrZXkgXSA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdFx0XHRcdENoaWxkLmRlZmF1bHRzWyBrZXkgXSA9IHdyYXBNZXRob2QoIHZhbHVlLCBDaGlsZFsga2V5IF0gKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Q2hpbGQuZGVmYXVsdHNbIGtleSBdID0gY2hpbGRQcm9wc1sga2V5IF07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRmb3IgKCBrZXkgaW4gY2hpbGRQcm9wcyApIHtcblx0XHRcdFx0aWYgKCAhYmxhY2tsaXN0ZWRbIGtleSBdICYmIGNoaWxkUHJvcHMuaGFzT3duUHJvcGVydHkoIGtleSApICkge1xuXHRcdFx0XHRcdG1lbWJlciA9IGNoaWxkUHJvcHNbIGtleSBdO1xuXHRcdFx0XHRcdGlmICggdHlwZW9mIG1lbWJlciA9PT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgQ2hpbGQucHJvdG90eXBlWyBrZXkgXSA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdFx0XHRcdENoaWxkLnByb3RvdHlwZVsga2V5IF0gPSB3cmFwTWV0aG9kKCBtZW1iZXIsIENoaWxkLnByb3RvdHlwZVsga2V5IF0gKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Q2hpbGQucHJvdG90eXBlWyBrZXkgXSA9IG1lbWJlcjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICggY2hpbGRQcm9wcy5jc3MgKSB7XG5cdFx0XHRcdGRlZmluZVByb3BlcnR5KCBDaGlsZCwgJ2NzcycsIHtcblx0XHRcdFx0XHR2YWx1ZTogQ2hpbGQuZGVmYXVsdHMubm9Dc3NUcmFuc2Zvcm0gPyBjaGlsZFByb3BzLmNzcyA6IHRyYW5zZm9ybUNzcyggY2hpbGRQcm9wcy5jc3MsIENoaWxkLl9ndWlkIClcblx0XHRcdFx0fSApO1xuXHRcdFx0fVxuXHRcdH07XG5cdH0oIGNvbmZpZ19pbml0T3B0aW9ucywgY29uZmlnX3JlZ2lzdHJpZXMsIHV0aWxzX2RlZmluZVByb3BlcnR5LCBleHRlbmRfd3JhcE1ldGhvZCwgZXh0ZW5kX3V0aWxzX2F1Z21lbnQsIGV4dGVuZF91dGlsc190cmFuc2Zvcm1Dc3MgKTtcblxuXHR2YXIgZXh0ZW5kX2V4dHJhY3RJbmxpbmVQYXJ0aWFscyA9IGZ1bmN0aW9uKCBpc09iamVjdCwgYXVnbWVudCApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggQ2hpbGQsIGNoaWxkUHJvcHMgKSB7XG5cdFx0XHRpZiAoIGlzT2JqZWN0KCBDaGlsZC5kZWZhdWx0cy50ZW1wbGF0ZSApICkge1xuXHRcdFx0XHRpZiAoICFDaGlsZC5wYXJ0aWFscyApIHtcblx0XHRcdFx0XHRDaGlsZC5wYXJ0aWFscyA9IHt9O1xuXHRcdFx0XHR9XG5cdFx0XHRcdGF1Z21lbnQoIENoaWxkLnBhcnRpYWxzLCBDaGlsZC5kZWZhdWx0cy50ZW1wbGF0ZS5wYXJ0aWFscyApO1xuXHRcdFx0XHRpZiAoIGNoaWxkUHJvcHMucGFydGlhbHMgKSB7XG5cdFx0XHRcdFx0YXVnbWVudCggQ2hpbGQucGFydGlhbHMsIGNoaWxkUHJvcHMucGFydGlhbHMgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRDaGlsZC5kZWZhdWx0cy50ZW1wbGF0ZSA9IENoaWxkLmRlZmF1bHRzLnRlbXBsYXRlLm1haW47XG5cdFx0XHR9XG5cdFx0fTtcblx0fSggdXRpbHNfaXNPYmplY3QsIGV4dGVuZF91dGlsc19hdWdtZW50ICk7XG5cblx0dmFyIGV4dGVuZF9jb25kaXRpb25hbGx5UGFyc2VUZW1wbGF0ZSA9IGZ1bmN0aW9uKCBlcnJvcnMsIGlzQ2xpZW50LCBwYXJzZSApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggQ2hpbGQgKSB7XG5cdFx0XHR2YXIgdGVtcGxhdGVFbDtcblx0XHRcdGlmICggdHlwZW9mIENoaWxkLmRlZmF1bHRzLnRlbXBsYXRlID09PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0aWYgKCAhcGFyc2UgKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCBlcnJvcnMubWlzc2luZ1BhcnNlciApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggQ2hpbGQuZGVmYXVsdHMudGVtcGxhdGUuY2hhckF0KCAwICkgPT09ICcjJyAmJiBpc0NsaWVudCApIHtcblx0XHRcdFx0XHR0ZW1wbGF0ZUVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIENoaWxkLmRlZmF1bHRzLnRlbXBsYXRlLnN1YnN0cmluZyggMSApICk7XG5cdFx0XHRcdFx0aWYgKCB0ZW1wbGF0ZUVsICYmIHRlbXBsYXRlRWwudGFnTmFtZSA9PT0gJ1NDUklQVCcgKSB7XG5cdFx0XHRcdFx0XHRDaGlsZC5kZWZhdWx0cy50ZW1wbGF0ZSA9IHBhcnNlKCB0ZW1wbGF0ZUVsLmlubmVySFRNTCwgQ2hpbGQgKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnQ291bGQgbm90IGZpbmQgdGVtcGxhdGUgZWxlbWVudCAoJyArIENoaWxkLmRlZmF1bHRzLnRlbXBsYXRlICsgJyknICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdENoaWxkLmRlZmF1bHRzLnRlbXBsYXRlID0gcGFyc2UoIENoaWxkLmRlZmF1bHRzLnRlbXBsYXRlLCBDaGlsZC5kZWZhdWx0cyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0fSggY29uZmlnX2Vycm9ycywgY29uZmlnX2lzQ2xpZW50LCBwYXJzZV9fcGFyc2UgKTtcblxuXHR2YXIgZXh0ZW5kX2NvbmRpdGlvbmFsbHlQYXJzZVBhcnRpYWxzID0gZnVuY3Rpb24oIGVycm9ycywgcGFyc2UgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIENoaWxkICkge1xuXHRcdFx0dmFyIGtleTtcblx0XHRcdGlmICggQ2hpbGQucGFydGlhbHMgKSB7XG5cdFx0XHRcdGZvciAoIGtleSBpbiBDaGlsZC5wYXJ0aWFscyApIHtcblx0XHRcdFx0XHRpZiAoIENoaWxkLnBhcnRpYWxzLmhhc093blByb3BlcnR5KCBrZXkgKSAmJiB0eXBlb2YgQ2hpbGQucGFydGlhbHNbIGtleSBdID09PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0XHRcdGlmICggIXBhcnNlICkge1xuXHRcdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoIGVycm9ycy5taXNzaW5nUGFyc2VyICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRDaGlsZC5wYXJ0aWFsc1sga2V5IF0gPSBwYXJzZSggQ2hpbGQucGFydGlhbHNbIGtleSBdLCBDaGlsZCApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdH0oIGNvbmZpZ19lcnJvcnMsIHBhcnNlX19wYXJzZSApO1xuXG5cdHZhciBSYWN0aXZlX2luaXRpYWxpc2UgPSBmdW5jdGlvbiggaXNDbGllbnQsIGVycm9ycywgaW5pdE9wdGlvbnMsIHJlZ2lzdHJpZXMsIHdhcm4sIGNyZWF0ZSwgZXh0ZW5kLCBmaWxsR2FwcywgZGVmaW5lUHJvcGVydGllcywgZ2V0RWxlbWVudCwgaXNPYmplY3QsIGlzQXJyYXksIGdldEd1aWQsIFByb21pc2UsIG1hZ2ljQWRhcHRvciwgcGFyc2UgKSB7XG5cblx0XHR2YXIgZmxhZ3MgPSBbXG5cdFx0XHQnYWRhcHQnLFxuXHRcdFx0J21vZGlmeUFycmF5cycsXG5cdFx0XHQnbWFnaWMnLFxuXHRcdFx0J3R3b3dheScsXG5cdFx0XHQnbGF6eScsXG5cdFx0XHQnZGVidWcnLFxuXHRcdFx0J2lzb2xhdGVkJ1xuXHRcdF07XG5cdFx0cmV0dXJuIGZ1bmN0aW9uIGluaXRpYWxpc2VSYWN0aXZlSW5zdGFuY2UoIHJhY3RpdmUsIG9wdGlvbnMgKSB7XG5cdFx0XHR2YXIgdGVtcGxhdGUsIHRlbXBsYXRlRWwsIHBhcnNlZFRlbXBsYXRlLCBwcm9taXNlLCBmdWxmaWxQcm9taXNlO1xuXHRcdFx0aWYgKCBpc0FycmF5KCBvcHRpb25zLmFkYXB0b3JzICkgKSB7XG5cdFx0XHRcdHdhcm4oICdUaGUgYGFkYXB0b3JzYCBvcHRpb24sIHRvIGluZGljYXRlIHdoaWNoIGFkYXB0b3JzIHNob3VsZCBiZSB1c2VkIHdpdGggYSBnaXZlbiBSYWN0aXZlIGluc3RhbmNlLCBoYXMgYmVlbiBkZXByZWNhdGVkIGluIGZhdm91ciBvZiBgYWRhcHRgLiBTZWUgW1RPRE9dIGZvciBtb3JlIGluZm9ybWF0aW9uJyApO1xuXHRcdFx0XHRvcHRpb25zLmFkYXB0ID0gb3B0aW9ucy5hZGFwdG9ycztcblx0XHRcdFx0ZGVsZXRlIG9wdGlvbnMuYWRhcHRvcnM7XG5cdFx0XHR9XG5cdFx0XHRpbml0T3B0aW9ucy5rZXlzLmZvckVhY2goIGZ1bmN0aW9uKCBrZXkgKSB7XG5cdFx0XHRcdGlmICggb3B0aW9uc1sga2V5IF0gPT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0XHRvcHRpb25zWyBrZXkgXSA9IHJhY3RpdmUuY29uc3RydWN0b3IuZGVmYXVsdHNbIGtleSBdO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRmbGFncy5mb3JFYWNoKCBmdW5jdGlvbiggZmxhZyApIHtcblx0XHRcdFx0cmFjdGl2ZVsgZmxhZyBdID0gb3B0aW9uc1sgZmxhZyBdO1xuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCB0eXBlb2YgcmFjdGl2ZS5hZGFwdCA9PT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdHJhY3RpdmUuYWRhcHQgPSBbIHJhY3RpdmUuYWRhcHQgXTtcblx0XHRcdH1cblx0XHRcdGlmICggcmFjdGl2ZS5tYWdpYyAmJiAhbWFnaWNBZGFwdG9yICkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdHZXR0ZXJzIGFuZCBzZXR0ZXJzIChtYWdpYyBtb2RlKSBhcmUgbm90IHN1cHBvcnRlZCBpbiB0aGlzIGJyb3dzZXInICk7XG5cdFx0XHR9XG5cdFx0XHRkZWZpbmVQcm9wZXJ0aWVzKCByYWN0aXZlLCB7XG5cdFx0XHRcdF9pbml0aW5nOiB7XG5cdFx0XHRcdFx0dmFsdWU6IHRydWUsXG5cdFx0XHRcdFx0d3JpdGFibGU6IHRydWVcblx0XHRcdFx0fSxcblx0XHRcdFx0X2d1aWQ6IHtcblx0XHRcdFx0XHR2YWx1ZTogZ2V0R3VpZCgpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdF9zdWJzOiB7XG5cdFx0XHRcdFx0dmFsdWU6IGNyZWF0ZSggbnVsbCApLFxuXHRcdFx0XHRcdGNvbmZpZ3VyYWJsZTogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRfY2FjaGU6IHtcblx0XHRcdFx0XHR2YWx1ZToge31cblx0XHRcdFx0fSxcblx0XHRcdFx0X2NhY2hlTWFwOiB7XG5cdFx0XHRcdFx0dmFsdWU6IGNyZWF0ZSggbnVsbCApXG5cdFx0XHRcdH0sXG5cdFx0XHRcdF9kZXBzOiB7XG5cdFx0XHRcdFx0dmFsdWU6IFtdXG5cdFx0XHRcdH0sXG5cdFx0XHRcdF9kZXBzTWFwOiB7XG5cdFx0XHRcdFx0dmFsdWU6IGNyZWF0ZSggbnVsbCApXG5cdFx0XHRcdH0sXG5cdFx0XHRcdF9wYXR0ZXJuT2JzZXJ2ZXJzOiB7XG5cdFx0XHRcdFx0dmFsdWU6IFtdXG5cdFx0XHRcdH0sXG5cdFx0XHRcdF9ldmFsdWF0b3JzOiB7XG5cdFx0XHRcdFx0dmFsdWU6IGNyZWF0ZSggbnVsbCApXG5cdFx0XHRcdH0sXG5cdFx0XHRcdF90d293YXlCaW5kaW5nczoge1xuXHRcdFx0XHRcdHZhbHVlOiB7fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRfYW5pbWF0aW9uczoge1xuXHRcdFx0XHRcdHZhbHVlOiBbXVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRub2Rlczoge1xuXHRcdFx0XHRcdHZhbHVlOiB7fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRfd3JhcHBlZDoge1xuXHRcdFx0XHRcdHZhbHVlOiBjcmVhdGUoIG51bGwgKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRfbGl2ZVF1ZXJpZXM6IHtcblx0XHRcdFx0XHR2YWx1ZTogW11cblx0XHRcdFx0fSxcblx0XHRcdFx0X2xpdmVDb21wb25lbnRRdWVyaWVzOiB7XG5cdFx0XHRcdFx0dmFsdWU6IFtdXG5cdFx0XHRcdH0sXG5cdFx0XHRcdF9jaGlsZEluaXRRdWV1ZToge1xuXHRcdFx0XHRcdHZhbHVlOiBbXVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRfY2hhbmdlczoge1xuXHRcdFx0XHRcdHZhbHVlOiBbXVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRfdW5yZXNvbHZlZEltcGxpY2l0RGVwZW5kZW5jaWVzOiB7XG5cdFx0XHRcdFx0dmFsdWU6IFtdXG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdGlmICggb3B0aW9ucy5fcGFyZW50ICYmIG9wdGlvbnMuX2NvbXBvbmVudCApIHtcblx0XHRcdFx0ZGVmaW5lUHJvcGVydGllcyggcmFjdGl2ZSwge1xuXHRcdFx0XHRcdF9wYXJlbnQ6IHtcblx0XHRcdFx0XHRcdHZhbHVlOiBvcHRpb25zLl9wYXJlbnRcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGNvbXBvbmVudDoge1xuXHRcdFx0XHRcdFx0dmFsdWU6IG9wdGlvbnMuX2NvbXBvbmVudFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSApO1xuXHRcdFx0XHRvcHRpb25zLl9jb21wb25lbnQuaW5zdGFuY2UgPSByYWN0aXZlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBvcHRpb25zLmVsICkge1xuXHRcdFx0XHRyYWN0aXZlLmVsID0gZ2V0RWxlbWVudCggb3B0aW9ucy5lbCApO1xuXHRcdFx0XHRpZiAoICFyYWN0aXZlLmVsICYmIHJhY3RpdmUuZGVidWcgKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnQ291bGQgbm90IGZpbmQgY29udGFpbmVyIGVsZW1lbnQnICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICggb3B0aW9ucy5ldmVudERlZmluaXRpb25zICkge1xuXHRcdFx0XHR3YXJuKCAncmFjdGl2ZS5ldmVudERlZmluaXRpb25zIGhhcyBiZWVuIGRlcHJlY2F0ZWQgaW4gZmF2b3VyIG9mIHJhY3RpdmUuZXZlbnRzLiBTdXBwb3J0IHdpbGwgYmUgcmVtb3ZlZCBpbiBmdXR1cmUgdmVyc2lvbnMnICk7XG5cdFx0XHRcdG9wdGlvbnMuZXZlbnRzID0gb3B0aW9ucy5ldmVudERlZmluaXRpb25zO1xuXHRcdFx0fVxuXHRcdFx0cmVnaXN0cmllcy5mb3JFYWNoKCBmdW5jdGlvbiggcmVnaXN0cnkgKSB7XG5cdFx0XHRcdGlmICggcmFjdGl2ZS5jb25zdHJ1Y3RvclsgcmVnaXN0cnkgXSApIHtcblx0XHRcdFx0XHRyYWN0aXZlWyByZWdpc3RyeSBdID0gZXh0ZW5kKCBjcmVhdGUoIHJhY3RpdmUuY29uc3RydWN0b3JbIHJlZ2lzdHJ5IF0gKSwgb3B0aW9uc1sgcmVnaXN0cnkgXSApO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCBvcHRpb25zWyByZWdpc3RyeSBdICkge1xuXHRcdFx0XHRcdHJhY3RpdmVbIHJlZ2lzdHJ5IF0gPSBvcHRpb25zWyByZWdpc3RyeSBdO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoICFyYWN0aXZlLmRhdGEgKSB7XG5cdFx0XHRcdHJhY3RpdmUuZGF0YSA9IHt9O1xuXHRcdFx0fVxuXHRcdFx0dGVtcGxhdGUgPSBvcHRpb25zLnRlbXBsYXRlO1xuXHRcdFx0aWYgKCB0eXBlb2YgdGVtcGxhdGUgPT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHRpZiAoICFwYXJzZSApIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoIGVycm9ycy5taXNzaW5nUGFyc2VyICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCB0ZW1wbGF0ZS5jaGFyQXQoIDAgKSA9PT0gJyMnICYmIGlzQ2xpZW50ICkge1xuXHRcdFx0XHRcdHRlbXBsYXRlRWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggdGVtcGxhdGUuc3Vic3RyaW5nKCAxICkgKTtcblx0XHRcdFx0XHRpZiAoIHRlbXBsYXRlRWwgKSB7XG5cdFx0XHRcdFx0XHRwYXJzZWRUZW1wbGF0ZSA9IHBhcnNlKCB0ZW1wbGF0ZUVsLmlubmVySFRNTCwgb3B0aW9ucyApO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdDb3VsZCBub3QgZmluZCB0ZW1wbGF0ZSBlbGVtZW50ICgnICsgdGVtcGxhdGUgKyAnKScgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cGFyc2VkVGVtcGxhdGUgPSBwYXJzZSggdGVtcGxhdGUsIG9wdGlvbnMgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cGFyc2VkVGVtcGxhdGUgPSB0ZW1wbGF0ZTtcblx0XHRcdH1cblx0XHRcdGlmICggaXNPYmplY3QoIHBhcnNlZFRlbXBsYXRlICkgKSB7XG5cdFx0XHRcdGZpbGxHYXBzKCByYWN0aXZlLnBhcnRpYWxzLCBwYXJzZWRUZW1wbGF0ZS5wYXJ0aWFscyApO1xuXHRcdFx0XHRwYXJzZWRUZW1wbGF0ZSA9IHBhcnNlZFRlbXBsYXRlLm1haW47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHBhcnNlZFRlbXBsYXRlICYmIHBhcnNlZFRlbXBsYXRlLmxlbmd0aCA9PT0gMSAmJiB0eXBlb2YgcGFyc2VkVGVtcGxhdGVbIDAgXSA9PT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdHBhcnNlZFRlbXBsYXRlID0gcGFyc2VkVGVtcGxhdGVbIDAgXTtcblx0XHRcdH1cblx0XHRcdHJhY3RpdmUudGVtcGxhdGUgPSBwYXJzZWRUZW1wbGF0ZTtcblx0XHRcdGV4dGVuZCggcmFjdGl2ZS5wYXJ0aWFscywgb3B0aW9ucy5wYXJ0aWFscyApO1xuXHRcdFx0cmFjdGl2ZS5wYXJzZU9wdGlvbnMgPSB7XG5cdFx0XHRcdHByZXNlcnZlV2hpdGVzcGFjZTogb3B0aW9ucy5wcmVzZXJ2ZVdoaXRlc3BhY2UsXG5cdFx0XHRcdHNhbml0aXplOiBvcHRpb25zLnNhbml0aXplLFxuXHRcdFx0XHRzdHJpcENvbW1lbnRzOiBvcHRpb25zLnN0cmlwQ29tbWVudHNcblx0XHRcdH07XG5cdFx0XHRyYWN0aXZlLnRyYW5zaXRpb25zRW5hYmxlZCA9IG9wdGlvbnMubm9JbnRybyA/IGZhbHNlIDogb3B0aW9ucy50cmFuc2l0aW9uc0VuYWJsZWQ7XG5cdFx0XHRpZiAoIGlzQ2xpZW50ICYmICFyYWN0aXZlLmVsICkge1xuXHRcdFx0XHRyYWN0aXZlLmVsID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCByYWN0aXZlLmVsICYmICFvcHRpb25zLmFwcGVuZCApIHtcblx0XHRcdFx0cmFjdGl2ZS5lbC5pbm5lckhUTUwgPSAnJztcblx0XHRcdH1cblx0XHRcdHByb21pc2UgPSBuZXcgUHJvbWlzZSggZnVuY3Rpb24oIGZ1bGZpbCApIHtcblx0XHRcdFx0ZnVsZmlsUHJvbWlzZSA9IGZ1bGZpbDtcblx0XHRcdH0gKTtcblx0XHRcdHJhY3RpdmUucmVuZGVyKCByYWN0aXZlLmVsLCBmdWxmaWxQcm9taXNlICk7XG5cdFx0XHRpZiAoIG9wdGlvbnMuY29tcGxldGUgKSB7XG5cdFx0XHRcdHByb21pc2UudGhlbiggb3B0aW9ucy5jb21wbGV0ZS5iaW5kKCByYWN0aXZlICkgKTtcblx0XHRcdH1cblx0XHRcdHJhY3RpdmUudHJhbnNpdGlvbnNFbmFibGVkID0gb3B0aW9ucy50cmFuc2l0aW9uc0VuYWJsZWQ7XG5cdFx0XHRyYWN0aXZlLl9pbml0aW5nID0gZmFsc2U7XG5cdFx0fTtcblx0fSggY29uZmlnX2lzQ2xpZW50LCBjb25maWdfZXJyb3JzLCBjb25maWdfaW5pdE9wdGlvbnMsIGNvbmZpZ19yZWdpc3RyaWVzLCB1dGlsc193YXJuLCB1dGlsc19jcmVhdGUsIHV0aWxzX2V4dGVuZCwgdXRpbHNfZmlsbEdhcHMsIHV0aWxzX2RlZmluZVByb3BlcnRpZXMsIHV0aWxzX2dldEVsZW1lbnQsIHV0aWxzX2lzT2JqZWN0LCB1dGlsc19pc0FycmF5LCB1dGlsc19nZXRHdWlkLCB1dGlsc19Qcm9taXNlLCBzaGFyZWRfZ2V0X21hZ2ljQWRhcHRvciwgcGFyc2VfX3BhcnNlICk7XG5cblx0dmFyIGV4dGVuZF9pbml0Q2hpbGRJbnN0YW5jZSA9IGZ1bmN0aW9uKCBpbml0T3B0aW9ucywgd3JhcE1ldGhvZCwgaW5pdGlhbGlzZSApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiBpbml0Q2hpbGRJbnN0YW5jZSggY2hpbGQsIENoaWxkLCBvcHRpb25zICkge1xuXHRcdFx0aW5pdE9wdGlvbnMua2V5cy5mb3JFYWNoKCBmdW5jdGlvbigga2V5ICkge1xuXHRcdFx0XHR2YXIgdmFsdWUgPSBvcHRpb25zWyBrZXkgXSxcblx0XHRcdFx0XHRkZWZhdWx0VmFsdWUgPSBDaGlsZC5kZWZhdWx0c1sga2V5IF07XG5cdFx0XHRcdGlmICggdHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBkZWZhdWx0VmFsdWUgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRcdFx0b3B0aW9uc1sga2V5IF0gPSB3cmFwTWV0aG9kKCB2YWx1ZSwgZGVmYXVsdFZhbHVlICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdGlmICggY2hpbGQuYmVmb3JlSW5pdCApIHtcblx0XHRcdFx0Y2hpbGQuYmVmb3JlSW5pdCggb3B0aW9ucyApO1xuXHRcdFx0fVxuXHRcdFx0aW5pdGlhbGlzZSggY2hpbGQsIG9wdGlvbnMgKTtcblx0XHRcdGlmICggb3B0aW9ucy5fcGFyZW50ICYmIG9wdGlvbnMuX3BhcmVudC5fcmVuZGVyaW5nICkge1xuXHRcdFx0XHRvcHRpb25zLl9wYXJlbnQuX2NoaWxkSW5pdFF1ZXVlLnB1c2goIHtcblx0XHRcdFx0XHRpbnN0YW5jZTogY2hpbGQsXG5cdFx0XHRcdFx0b3B0aW9uczogb3B0aW9uc1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9IGVsc2UgaWYgKCBjaGlsZC5pbml0ICkge1xuXHRcdFx0XHRjaGlsZC5pbml0KCBvcHRpb25zICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fSggY29uZmlnX2luaXRPcHRpb25zLCBleHRlbmRfd3JhcE1ldGhvZCwgUmFjdGl2ZV9pbml0aWFsaXNlICk7XG5cblx0dmFyIGV4dGVuZF9fZXh0ZW5kID0gZnVuY3Rpb24oIGNyZWF0ZSwgZGVmaW5lUHJvcGVydGllcywgZ2V0R3VpZCwgZXh0ZW5kT2JqZWN0LCBpbmhlcml0RnJvbVBhcmVudCwgaW5oZXJpdEZyb21DaGlsZFByb3BzLCBleHRyYWN0SW5saW5lUGFydGlhbHMsIGNvbmRpdGlvbmFsbHlQYXJzZVRlbXBsYXRlLCBjb25kaXRpb25hbGx5UGFyc2VQYXJ0aWFscywgaW5pdENoaWxkSW5zdGFuY2UsIGNpcmN1bGFyICkge1xuXG5cdFx0dmFyIFJhY3RpdmU7XG5cdFx0Y2lyY3VsYXIucHVzaCggZnVuY3Rpb24oKSB7XG5cdFx0XHRSYWN0aXZlID0gY2lyY3VsYXIuUmFjdGl2ZTtcblx0XHR9ICk7XG5cdFx0cmV0dXJuIGZ1bmN0aW9uIGV4dGVuZCggY2hpbGRQcm9wcyApIHtcblx0XHRcdHZhciBQYXJlbnQgPSB0aGlzLFxuXHRcdFx0XHRDaGlsZCwgYWRhcHRvciwgaTtcblx0XHRcdGlmICggY2hpbGRQcm9wcy5wcm90b3R5cGUgaW5zdGFuY2VvZiBSYWN0aXZlICkge1xuXHRcdFx0XHRjaGlsZFByb3BzID0gZXh0ZW5kT2JqZWN0KCB7fSwgY2hpbGRQcm9wcywgY2hpbGRQcm9wcy5wcm90b3R5cGUsIGNoaWxkUHJvcHMuZGVmYXVsdHMgKTtcblx0XHRcdH1cblx0XHRcdENoaWxkID0gZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRcdGluaXRDaGlsZEluc3RhbmNlKCB0aGlzLCBDaGlsZCwgb3B0aW9ucyB8fCB7fSApO1xuXHRcdFx0fTtcblx0XHRcdENoaWxkLnByb3RvdHlwZSA9IGNyZWF0ZSggUGFyZW50LnByb3RvdHlwZSApO1xuXHRcdFx0Q2hpbGQucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gQ2hpbGQ7XG5cdFx0XHRkZWZpbmVQcm9wZXJ0aWVzKCBDaGlsZCwge1xuXHRcdFx0XHRleHRlbmQ6IHtcblx0XHRcdFx0XHR2YWx1ZTogUGFyZW50LmV4dGVuZFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRfZ3VpZDoge1xuXHRcdFx0XHRcdHZhbHVlOiBnZXRHdWlkKClcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0aW5oZXJpdEZyb21QYXJlbnQoIENoaWxkLCBQYXJlbnQgKTtcblx0XHRcdGluaGVyaXRGcm9tQ2hpbGRQcm9wcyggQ2hpbGQsIGNoaWxkUHJvcHMgKTtcblx0XHRcdGlmICggQ2hpbGQuYWRhcHRvcnMgJiYgKCBpID0gQ2hpbGQuZGVmYXVsdHMuYWRhcHQubGVuZ3RoICkgKSB7XG5cdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdGFkYXB0b3IgPSBDaGlsZC5kZWZhdWx0cy5hZGFwdFsgaSBdO1xuXHRcdFx0XHRcdGlmICggdHlwZW9mIGFkYXB0b3IgPT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHRcdFx0Q2hpbGQuZGVmYXVsdHMuYWRhcHRbIGkgXSA9IENoaWxkLmFkYXB0b3JzWyBhZGFwdG9yIF0gfHwgYWRhcHRvcjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICggY2hpbGRQcm9wcy50ZW1wbGF0ZSApIHtcblx0XHRcdFx0Y29uZGl0aW9uYWxseVBhcnNlVGVtcGxhdGUoIENoaWxkICk7XG5cdFx0XHRcdGV4dHJhY3RJbmxpbmVQYXJ0aWFscyggQ2hpbGQsIGNoaWxkUHJvcHMgKTtcblx0XHRcdFx0Y29uZGl0aW9uYWxseVBhcnNlUGFydGlhbHMoIENoaWxkICk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gQ2hpbGQ7XG5cdFx0fTtcblx0fSggdXRpbHNfY3JlYXRlLCB1dGlsc19kZWZpbmVQcm9wZXJ0aWVzLCB1dGlsc19nZXRHdWlkLCB1dGlsc19leHRlbmQsIGV4dGVuZF9pbmhlcml0RnJvbVBhcmVudCwgZXh0ZW5kX2luaGVyaXRGcm9tQ2hpbGRQcm9wcywgZXh0ZW5kX2V4dHJhY3RJbmxpbmVQYXJ0aWFscywgZXh0ZW5kX2NvbmRpdGlvbmFsbHlQYXJzZVRlbXBsYXRlLCBleHRlbmRfY29uZGl0aW9uYWxseVBhcnNlUGFydGlhbHMsIGV4dGVuZF9pbml0Q2hpbGRJbnN0YW5jZSwgY2lyY3VsYXIgKTtcblxuXHR2YXIgUmFjdGl2ZV9fUmFjdGl2ZSA9IGZ1bmN0aW9uKCBpbml0T3B0aW9ucywgc3ZnLCBkZWZpbmVQcm9wZXJ0aWVzLCBwcm90b3R5cGUsIHBhcnRpYWxSZWdpc3RyeSwgYWRhcHRvclJlZ2lzdHJ5LCBjb21wb25lbnRzUmVnaXN0cnksIGVhc2luZ1JlZ2lzdHJ5LCBpbnRlcnBvbGF0b3JzUmVnaXN0cnksIFByb21pc2UsIGV4dGVuZCwgcGFyc2UsIGluaXRpYWxpc2UsIGNpcmN1bGFyICkge1xuXG5cdFx0dmFyIFJhY3RpdmUgPSBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdGluaXRpYWxpc2UoIHRoaXMsIG9wdGlvbnMgKTtcblx0XHR9O1xuXHRcdGRlZmluZVByb3BlcnRpZXMoIFJhY3RpdmUsIHtcblx0XHRcdHByb3RvdHlwZToge1xuXHRcdFx0XHR2YWx1ZTogcHJvdG90eXBlXG5cdFx0XHR9LFxuXHRcdFx0cGFydGlhbHM6IHtcblx0XHRcdFx0dmFsdWU6IHBhcnRpYWxSZWdpc3RyeVxuXHRcdFx0fSxcblx0XHRcdGFkYXB0b3JzOiB7XG5cdFx0XHRcdHZhbHVlOiBhZGFwdG9yUmVnaXN0cnlcblx0XHRcdH0sXG5cdFx0XHRlYXNpbmc6IHtcblx0XHRcdFx0dmFsdWU6IGVhc2luZ1JlZ2lzdHJ5XG5cdFx0XHR9LFxuXHRcdFx0dHJhbnNpdGlvbnM6IHtcblx0XHRcdFx0dmFsdWU6IHt9XG5cdFx0XHR9LFxuXHRcdFx0ZXZlbnRzOiB7XG5cdFx0XHRcdHZhbHVlOiB7fVxuXHRcdFx0fSxcblx0XHRcdGNvbXBvbmVudHM6IHtcblx0XHRcdFx0dmFsdWU6IGNvbXBvbmVudHNSZWdpc3RyeVxuXHRcdFx0fSxcblx0XHRcdGRlY29yYXRvcnM6IHtcblx0XHRcdFx0dmFsdWU6IHt9XG5cdFx0XHR9LFxuXHRcdFx0aW50ZXJwb2xhdG9yczoge1xuXHRcdFx0XHR2YWx1ZTogaW50ZXJwb2xhdG9yc1JlZ2lzdHJ5XG5cdFx0XHR9LFxuXHRcdFx0ZGVmYXVsdHM6IHtcblx0XHRcdFx0dmFsdWU6IGluaXRPcHRpb25zLmRlZmF1bHRzXG5cdFx0XHR9LFxuXHRcdFx0c3ZnOiB7XG5cdFx0XHRcdHZhbHVlOiBzdmdcblx0XHRcdH0sXG5cdFx0XHRWRVJTSU9OOiB7XG5cdFx0XHRcdHZhbHVlOiAndjAuMy45LTMxNy1kMjNlNDA4J1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0XHRSYWN0aXZlLmV2ZW50RGVmaW5pdGlvbnMgPSBSYWN0aXZlLmV2ZW50cztcblx0XHRSYWN0aXZlLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IFJhY3RpdmU7XG5cdFx0UmFjdGl2ZS5Qcm9taXNlID0gUHJvbWlzZTtcblx0XHRSYWN0aXZlLmV4dGVuZCA9IGV4dGVuZDtcblx0XHRSYWN0aXZlLnBhcnNlID0gcGFyc2U7XG5cdFx0Y2lyY3VsYXIuUmFjdGl2ZSA9IFJhY3RpdmU7XG5cdFx0cmV0dXJuIFJhY3RpdmU7XG5cdH0oIGNvbmZpZ19pbml0T3B0aW9ucywgY29uZmlnX3N2ZywgdXRpbHNfZGVmaW5lUHJvcGVydGllcywgUmFjdGl2ZV9wcm90b3R5cGVfX3Byb3RvdHlwZSwgcmVnaXN0cmllc19wYXJ0aWFscywgcmVnaXN0cmllc19hZGFwdG9ycywgcmVnaXN0cmllc19jb21wb25lbnRzLCByZWdpc3RyaWVzX2Vhc2luZywgcmVnaXN0cmllc19pbnRlcnBvbGF0b3JzLCB1dGlsc19Qcm9taXNlLCBleHRlbmRfX2V4dGVuZCwgcGFyc2VfX3BhcnNlLCBSYWN0aXZlX2luaXRpYWxpc2UsIGNpcmN1bGFyICk7XG5cblx0dmFyIFJhY3RpdmUgPSBmdW5jdGlvbiggUmFjdGl2ZSwgY2lyY3VsYXIsIGxlZ2FjeSApIHtcblxuXHRcdHZhciBGVU5DVElPTiA9ICdmdW5jdGlvbic7XG5cdFx0d2hpbGUgKCBjaXJjdWxhci5sZW5ndGggKSB7XG5cdFx0XHRjaXJjdWxhci5wb3AoKSgpO1xuXHRcdH1cblx0XHRpZiAoIHR5cGVvZiBEYXRlLm5vdyAhPT0gRlVOQ1RJT04gfHwgdHlwZW9mIFN0cmluZy5wcm90b3R5cGUudHJpbSAhPT0gRlVOQ1RJT04gfHwgdHlwZW9mIE9iamVjdC5rZXlzICE9PSBGVU5DVElPTiB8fCB0eXBlb2YgQXJyYXkucHJvdG90eXBlLmluZGV4T2YgIT09IEZVTkNUSU9OIHx8IHR5cGVvZiBBcnJheS5wcm90b3R5cGUuZm9yRWFjaCAhPT0gRlVOQ1RJT04gfHwgdHlwZW9mIEFycmF5LnByb3RvdHlwZS5tYXAgIT09IEZVTkNUSU9OIHx8IHR5cGVvZiBBcnJheS5wcm90b3R5cGUuZmlsdGVyICE9PSBGVU5DVElPTiB8fCB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2Ygd2luZG93LmFkZEV2ZW50TGlzdGVuZXIgIT09IEZVTkNUSU9OICkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnSXQgbG9va3MgbGlrZSB5b3VcXCdyZSBhdHRlbXB0aW5nIHRvIHVzZSBSYWN0aXZlLmpzIGluIGFuIG9sZGVyIGJyb3dzZXIuIFlvdVxcJ2xsIG5lZWQgdG8gdXNlIG9uZSBvZiB0aGUgXFwnbGVnYWN5IGJ1aWxkc1xcJyBpbiBvcmRlciB0byBjb250aW51ZSAtIHNlZSBodHRwOi8vZG9jcy5yYWN0aXZlanMub3JnL2xhdGVzdC9sZWdhY3ktYnVpbGRzIGZvciBtb3JlIGluZm9ybWF0aW9uLicgKTtcblx0XHR9XG5cdFx0aWYgKCB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cuTm9kZSAmJiAhd2luZG93Lk5vZGUucHJvdG90eXBlLmNvbnRhaW5zICYmIHdpbmRvdy5IVE1MRWxlbWVudCAmJiB3aW5kb3cuSFRNTEVsZW1lbnQucHJvdG90eXBlLmNvbnRhaW5zICkge1xuXHRcdFx0d2luZG93Lk5vZGUucHJvdG90eXBlLmNvbnRhaW5zID0gd2luZG93LkhUTUxFbGVtZW50LnByb3RvdHlwZS5jb250YWlucztcblx0XHR9XG5cdFx0cmV0dXJuIFJhY3RpdmU7XG5cdH0oIFJhY3RpdmVfX1JhY3RpdmUsIGNpcmN1bGFyLCBsZWdhY3kgKTtcblxuXG5cdC8vIGV4cG9ydCBhcyBDb21tb24gSlMgbW9kdWxlLi4uXG5cdGlmICggdHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cyApIHtcblx0XHRtb2R1bGUuZXhwb3J0cyA9IFJhY3RpdmU7XG5cdH1cblxuXHQvLyAuLi4gb3IgYXMgQU1EIG1vZHVsZVxuXHRlbHNlIGlmICggdHlwZW9mIGRlZmluZSA9PT0gXCJmdW5jdGlvblwiICYmIGRlZmluZS5hbWQgKSB7XG5cdFx0ZGVmaW5lKCBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiBSYWN0aXZlO1xuXHRcdH0gKTtcblx0fVxuXG5cdC8vIC4uLiBvciBhcyBicm93c2VyIGdsb2JhbFxuXHRnbG9iYWwuUmFjdGl2ZSA9IFJhY3RpdmU7XG5cblx0UmFjdGl2ZS5ub0NvbmZsaWN0ID0gZnVuY3Rpb24oKSB7XG5cdFx0Z2xvYmFsLlJhY3RpdmUgPSBub0NvbmZsaWN0O1xuXHRcdHJldHVybiBSYWN0aXZlO1xuXHR9O1xuXG59KCB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyA/IHdpbmRvdyA6IHRoaXMgKSApO1xuIl19
;