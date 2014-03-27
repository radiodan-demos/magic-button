(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
console.log('Core app started');

var Ractive = require('ractive'),
    xhr     = require('./xhr'),
    utils   = require('./utils');

var container = document.querySelector('[data-ui-container]'),
    template  = document.querySelector('[data-ui-template]').innerText,
    defaults  = {
      services: [],
      audio   : {}
    },
    ui;

window.ui = ui = new Ractive({
  el: container,
  template: template,
  data: data || defaults
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

function uiVolumeChange(evt) {
  var value = evt.context.volume;
  console.log('ui: volume changed', value);
  xhr.post('/radio/volume/value/' + value ).then(success, failure);
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

},{"./utils":2,"./xhr":3,"ractive":16}],2:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvYW5kcmV3L1Byb2plY3RzL29zcy9yYWRpb2Rhbi9tYWdpYy1idXR0b24vbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9hbmRyZXcvUHJvamVjdHMvb3NzL3JhZGlvZGFuL21hZ2ljLWJ1dHRvbi9hcHAvdWkvc3RhdGljL2pzL2FwcC5qcyIsIi9Vc2Vycy9hbmRyZXcvUHJvamVjdHMvb3NzL3JhZGlvZGFuL21hZ2ljLWJ1dHRvbi9hcHAvdWkvc3RhdGljL2pzL3V0aWxzLmpzIiwiL1VzZXJzL2FuZHJldy9Qcm9qZWN0cy9vc3MvcmFkaW9kYW4vbWFnaWMtYnV0dG9uL2FwcC91aS9zdGF0aWMvanMveGhyLmpzIiwiL1VzZXJzL2FuZHJldy9Qcm9qZWN0cy9vc3MvcmFkaW9kYW4vbWFnaWMtYnV0dG9uL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9pbnNlcnQtbW9kdWxlLWdsb2JhbHMvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIi9Vc2Vycy9hbmRyZXcvUHJvamVjdHMvb3NzL3JhZGlvZGFuL21hZ2ljLWJ1dHRvbi9ub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9jb21tb25qcy9tYWluLmpzIiwiL1VzZXJzL2FuZHJldy9Qcm9qZWN0cy9vc3MvcmFkaW9kYW4vbWFnaWMtYnV0dG9uL25vZGVfbW9kdWxlcy9lczYtcHJvbWlzZS9kaXN0L2NvbW1vbmpzL3Byb21pc2UvYWxsLmpzIiwiL1VzZXJzL2FuZHJldy9Qcm9qZWN0cy9vc3MvcmFkaW9kYW4vbWFnaWMtYnV0dG9uL25vZGVfbW9kdWxlcy9lczYtcHJvbWlzZS9kaXN0L2NvbW1vbmpzL3Byb21pc2UvYXNhcC5qcyIsIi9Vc2Vycy9hbmRyZXcvUHJvamVjdHMvb3NzL3JhZGlvZGFuL21hZ2ljLWJ1dHRvbi9ub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9jb21tb25qcy9wcm9taXNlL2Nhc3QuanMiLCIvVXNlcnMvYW5kcmV3L1Byb2plY3RzL29zcy9yYWRpb2Rhbi9tYWdpYy1idXR0b24vbm9kZV9tb2R1bGVzL2VzNi1wcm9taXNlL2Rpc3QvY29tbW9uanMvcHJvbWlzZS9jb25maWcuanMiLCIvVXNlcnMvYW5kcmV3L1Byb2plY3RzL29zcy9yYWRpb2Rhbi9tYWdpYy1idXR0b24vbm9kZV9tb2R1bGVzL2VzNi1wcm9taXNlL2Rpc3QvY29tbW9uanMvcHJvbWlzZS9wb2x5ZmlsbC5qcyIsIi9Vc2Vycy9hbmRyZXcvUHJvamVjdHMvb3NzL3JhZGlvZGFuL21hZ2ljLWJ1dHRvbi9ub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9jb21tb25qcy9wcm9taXNlL3Byb21pc2UuanMiLCIvVXNlcnMvYW5kcmV3L1Byb2plY3RzL29zcy9yYWRpb2Rhbi9tYWdpYy1idXR0b24vbm9kZV9tb2R1bGVzL2VzNi1wcm9taXNlL2Rpc3QvY29tbW9uanMvcHJvbWlzZS9yYWNlLmpzIiwiL1VzZXJzL2FuZHJldy9Qcm9qZWN0cy9vc3MvcmFkaW9kYW4vbWFnaWMtYnV0dG9uL25vZGVfbW9kdWxlcy9lczYtcHJvbWlzZS9kaXN0L2NvbW1vbmpzL3Byb21pc2UvcmVqZWN0LmpzIiwiL1VzZXJzL2FuZHJldy9Qcm9qZWN0cy9vc3MvcmFkaW9kYW4vbWFnaWMtYnV0dG9uL25vZGVfbW9kdWxlcy9lczYtcHJvbWlzZS9kaXN0L2NvbW1vbmpzL3Byb21pc2UvcmVzb2x2ZS5qcyIsIi9Vc2Vycy9hbmRyZXcvUHJvamVjdHMvb3NzL3JhZGlvZGFuL21hZ2ljLWJ1dHRvbi9ub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9jb21tb25qcy9wcm9taXNlL3V0aWxzLmpzIiwiL1VzZXJzL2FuZHJldy9Qcm9qZWN0cy9vc3MvcmFkaW9kYW4vbWFnaWMtYnV0dG9uL25vZGVfbW9kdWxlcy9yYWN0aXZlL2J1aWxkL1JhY3RpdmUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsImNvbnNvbGUubG9nKCdDb3JlIGFwcCBzdGFydGVkJyk7XG5cbnZhciBSYWN0aXZlID0gcmVxdWlyZSgncmFjdGl2ZScpLFxuICAgIHhociAgICAgPSByZXF1aXJlKCcuL3hocicpLFxuICAgIHV0aWxzICAgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG5cbnZhciBjb250YWluZXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdbZGF0YS11aS1jb250YWluZXJdJyksXG4gICAgdGVtcGxhdGUgID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignW2RhdGEtdWktdGVtcGxhdGVdJykuaW5uZXJUZXh0LFxuICAgIGRlZmF1bHRzICA9IHtcbiAgICAgIHNlcnZpY2VzOiBbXSxcbiAgICAgIGF1ZGlvICAgOiB7fVxuICAgIH0sXG4gICAgdWk7XG5cbndpbmRvdy51aSA9IHVpID0gbmV3IFJhY3RpdmUoe1xuICBlbDogY29udGFpbmVyLFxuICB0ZW1wbGF0ZTogdGVtcGxhdGUsXG4gIGRhdGE6IGRhdGEgfHwgZGVmYXVsdHNcbn0pO1xuXG4vKlxuICBMb2dnaW5nXG4qL1xudWkub24oJ3NldCcsIGZ1bmN0aW9uIChrZXlwYXRoLCB2YWx1ZSkge1xuICBjb25zb2xlLmxvZygnc2V0Jywga2V5cGF0aCwgdmFsdWUpO1xufSk7XG5cbi8qXG4gIEdlbmVyaWMgcHJvbWlzZSBzdWNjZXNzIG9yIGZhaWx1cmUgb3B0aW9uc1xuKi9cbmZ1bmN0aW9uIHN1Y2Nlc3MoY29udGVudCkge1xuICBjb25zb2xlLmxvZygnc3VjY2VzcycsIGNvbnRlbnQpO1xufVxuXG5mdW5jdGlvbiBmYWlsdXJlKGVycikge1xuICBjb25zb2xlLndhcm4oJ2ZhaWx1cmUnLCBlcnIpO1xufVxuXG4vKlxuICBVSSAtPiBTdGF0ZVxuKi9cbnVpLm9uKCd2b2x1bWUnLCB1dGlscy5kZWJvdW5jZSh1aVZvbHVtZUNoYW5nZSwgMjUwKSk7XG5cbmZ1bmN0aW9uIHVpVm9sdW1lQ2hhbmdlKGV2dCkge1xuICB2YXIgdmFsdWUgPSBldnQuY29udGV4dC52b2x1bWU7XG4gIGNvbnNvbGUubG9nKCd1aTogdm9sdW1lIGNoYW5nZWQnLCB2YWx1ZSk7XG4gIHhoci5wb3N0KCcvcmFkaW8vdm9sdW1lL3ZhbHVlLycgKyB2YWx1ZSApLnRoZW4oc3VjY2VzcywgZmFpbHVyZSk7XG59XG5cbi8qXG4gIFN0YXRlIC0+IFVJXG4qL1xudmFyIGV2ZW50U291cmNlID0gbmV3IEV2ZW50U291cmNlKCcvZXZlbnRzJyk7XG5cbmV2ZW50U291cmNlLmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBmdW5jdGlvbiAoZXZ0KSB7XG4gIHZhciBjb250ZW50ID0gSlNPTi5wYXJzZShldnQuZGF0YSk7XG4gIGNvbnNvbGUubG9nKCclbyBmb3IgJW8nLCBjb250ZW50LnRvcGljLCBjb250ZW50KTtcbiAgc3dpdGNoKGNvbnRlbnQudG9waWMpIHtcbiAgICBjYXNlICdhdWRpby52b2x1bWUnOlxuICAgICAgdWkuc2V0KGNvbnRlbnQudG9waWMsIGNvbnRlbnQuZGF0YS52b2x1bWUpO1xuICAgICAgYnJlYWs7XG4gIH1cbn0pO1xuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gIGRlYm91bmNlOiBmdW5jdGlvbiBkZWJvdW5jZShmbiwgZGVsYXkpIHtcbiAgICB2YXIgdGltZXIgPSBudWxsO1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgY29udGV4dCA9IHRoaXMsIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICBjbGVhclRpbWVvdXQodGltZXIpO1xuICAgICAgdGltZXIgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZm4uYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICB9LCBkZWxheSk7XG4gICAgfTtcbiAgfSxcbiAgdGhyb3R0bGU6IGZ1bmN0aW9uIHRocm90dGxlKGZuLCB0aHJlc2hob2xkLCBzY29wZSkge1xuICAgIHRocmVzaGhvbGQgfHwgKHRocmVzaGhvbGQgPSAyNTApO1xuICAgIHZhciBsYXN0LFxuICAgICAgICBkZWZlclRpbWVyO1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgY29udGV4dCA9IHNjb3BlIHx8IHRoaXM7XG5cbiAgICAgIHZhciBub3cgPSArbmV3IERhdGUsXG4gICAgICAgICAgYXJncyA9IGFyZ3VtZW50cztcbiAgICAgIGlmIChsYXN0ICYmIG5vdyA8IGxhc3QgKyB0aHJlc2hob2xkKSB7XG4gICAgICAgIC8vIGhvbGQgb24gdG8gaXRcbiAgICAgICAgY2xlYXJUaW1lb3V0KGRlZmVyVGltZXIpO1xuICAgICAgICBkZWZlclRpbWVyID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgbGFzdCA9IG5vdztcbiAgICAgICAgICBmbi5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICAgICAgfSwgdGhyZXNoaG9sZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsYXN0ID0gbm93O1xuICAgICAgICBmbi5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG59O1xuIiwidmFyIFByb21pc2UgPSBQcm9taXNlIHx8IHJlcXVpcmUoJ2VzNi1wcm9taXNlJykuUHJvbWlzZTtcblxubW9kdWxlLmV4cG9ydHMgPSB4aHI7XG5cblsnZ2V0JywgJ2RlbGV0ZScsICdwb3N0JywgJ3B1dCddLmZvckVhY2goZnVuY3Rpb24gKG1ldGhvZCkge1xuICBjb25zb2xlLmxvZygnYmluZGluZyAnLCBtZXRob2QpXG4gIG1vZHVsZS5leHBvcnRzW21ldGhvZF0gPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyksXG4gICAgICAgIG5ld0FyZ3MgPSBbbWV0aG9kXS5jb25jYXQoYXJncyk7XG5cbiAgICBjb25zb2xlLmxvZygnYXJncyAlbyAtIG5ld0FyZ3MgJW8nLCBhcmdzLCBuZXdBcmdzKTtcblxuICAgIHJldHVybiB4aHIuYXBwbHkobnVsbCwgbmV3QXJncyk7XG4gIH1cbn0pXG5cbmZ1bmN0aW9uIHhocihtZXRob2QsIHVybCkge1xuICBtZXRob2QgPSBtZXRob2QgPyBtZXRob2QudG9VcHBlckNhc2UoKSA6ICdHRVQnO1xuICAvLyBSZXR1cm4gYSBuZXcgcHJvbWlzZS5cbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgIC8vIERvIHRoZSB1c3VhbCBYSFIgc3R1ZmZcbiAgICB2YXIgcmVxID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgcmVxLm9wZW4obWV0aG9kLCB1cmwpO1xuXG4gICAgcmVxLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgLy8gVGhpcyBpcyBjYWxsZWQgZXZlbiBvbiA0MDQgZXRjXG4gICAgICAvLyBzbyBjaGVjayB0aGUgc3RhdHVzXG4gICAgICBpZiAocmVxLnN0YXR1cyA9PSAyMDApIHtcbiAgICAgICAgLy8gUmVzb2x2ZSB0aGUgcHJvbWlzZSB3aXRoIHRoZSByZXNwb25zZSB0ZXh0XG4gICAgICAgIHJlc29sdmUocmVxLnJlc3BvbnNlKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICAvLyBPdGhlcndpc2UgcmVqZWN0IHdpdGggdGhlIHN0YXR1cyB0ZXh0XG4gICAgICAgIC8vIHdoaWNoIHdpbGwgaG9wZWZ1bGx5IGJlIGEgbWVhbmluZ2Z1bCBlcnJvclxuICAgICAgICByZWplY3QoRXJyb3IocmVxLnN0YXR1c1RleHQpKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gSGFuZGxlIG5ldHdvcmsgZXJyb3JzXG4gICAgcmVxLm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJlamVjdChFcnJvcihcIk5ldHdvcmsgRXJyb3JcIikpO1xuICAgIH07XG5cbiAgICAvLyBNYWtlIHRoZSByZXF1ZXN0XG4gICAgcmVxLnNlbmQoKTtcbiAgfSk7XG59XG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG5wcm9jZXNzLm5leHRUaWNrID0gKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgY2FuU2V0SW1tZWRpYXRlID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCdcbiAgICAmJiB3aW5kb3cuc2V0SW1tZWRpYXRlO1xuICAgIHZhciBjYW5Qb3N0ID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCdcbiAgICAmJiB3aW5kb3cucG9zdE1lc3NhZ2UgJiYgd2luZG93LmFkZEV2ZW50TGlzdGVuZXJcbiAgICA7XG5cbiAgICBpZiAoY2FuU2V0SW1tZWRpYXRlKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoZikgeyByZXR1cm4gd2luZG93LnNldEltbWVkaWF0ZShmKSB9O1xuICAgIH1cblxuICAgIGlmIChjYW5Qb3N0KSB7XG4gICAgICAgIHZhciBxdWV1ZSA9IFtdO1xuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uIChldikge1xuICAgICAgICAgICAgdmFyIHNvdXJjZSA9IGV2LnNvdXJjZTtcbiAgICAgICAgICAgIGlmICgoc291cmNlID09PSB3aW5kb3cgfHwgc291cmNlID09PSBudWxsKSAmJiBldi5kYXRhID09PSAncHJvY2Vzcy10aWNrJykge1xuICAgICAgICAgICAgICAgIGV2LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgIGlmIChxdWV1ZS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBmbiA9IHF1ZXVlLnNoaWZ0KCk7XG4gICAgICAgICAgICAgICAgICAgIGZuKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LCB0cnVlKTtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gbmV4dFRpY2soZm4pIHtcbiAgICAgICAgICAgIHF1ZXVlLnB1c2goZm4pO1xuICAgICAgICAgICAgd2luZG93LnBvc3RNZXNzYWdlKCdwcm9jZXNzLXRpY2snLCAnKicpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBmdW5jdGlvbiBuZXh0VGljayhmbikge1xuICAgICAgICBzZXRUaW1lb3V0KGZuLCAwKTtcbiAgICB9O1xufSkoKTtcblxucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufVxuXG4vLyBUT0RPKHNodHlsbWFuKVxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG4iLCJcInVzZSBzdHJpY3RcIjtcbnZhciBQcm9taXNlID0gcmVxdWlyZShcIi4vcHJvbWlzZS9wcm9taXNlXCIpLlByb21pc2U7XG52YXIgcG9seWZpbGwgPSByZXF1aXJlKFwiLi9wcm9taXNlL3BvbHlmaWxsXCIpLnBvbHlmaWxsO1xuZXhwb3J0cy5Qcm9taXNlID0gUHJvbWlzZTtcbmV4cG9ydHMucG9seWZpbGwgPSBwb2x5ZmlsbDsiLCJcInVzZSBzdHJpY3RcIjtcbi8qIGdsb2JhbCB0b1N0cmluZyAqL1xuXG52YXIgaXNBcnJheSA9IHJlcXVpcmUoXCIuL3V0aWxzXCIpLmlzQXJyYXk7XG52YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoXCIuL3V0aWxzXCIpLmlzRnVuY3Rpb247XG5cbi8qKlxuICBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aGVuIGFsbCB0aGUgZ2l2ZW4gcHJvbWlzZXMgaGF2ZSBiZWVuXG4gIGZ1bGZpbGxlZCwgb3IgcmVqZWN0ZWQgaWYgYW55IG9mIHRoZW0gYmVjb21lIHJlamVjdGVkLiBUaGUgcmV0dXJuIHByb21pc2VcbiAgaXMgZnVsZmlsbGVkIHdpdGggYW4gYXJyYXkgdGhhdCBnaXZlcyBhbGwgdGhlIHZhbHVlcyBpbiB0aGUgb3JkZXIgdGhleSB3ZXJlXG4gIHBhc3NlZCBpbiB0aGUgYHByb21pc2VzYCBhcnJheSBhcmd1bWVudC5cblxuICBFeGFtcGxlOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgdmFyIHByb21pc2UxID0gUlNWUC5yZXNvbHZlKDEpO1xuICB2YXIgcHJvbWlzZTIgPSBSU1ZQLnJlc29sdmUoMik7XG4gIHZhciBwcm9taXNlMyA9IFJTVlAucmVzb2x2ZSgzKTtcbiAgdmFyIHByb21pc2VzID0gWyBwcm9taXNlMSwgcHJvbWlzZTIsIHByb21pc2UzIF07XG5cbiAgUlNWUC5hbGwocHJvbWlzZXMpLnRoZW4oZnVuY3Rpb24oYXJyYXkpe1xuICAgIC8vIFRoZSBhcnJheSBoZXJlIHdvdWxkIGJlIFsgMSwgMiwgMyBdO1xuICB9KTtcbiAgYGBgXG5cbiAgSWYgYW55IG9mIHRoZSBgcHJvbWlzZXNgIGdpdmVuIHRvIGBSU1ZQLmFsbGAgYXJlIHJlamVjdGVkLCB0aGUgZmlyc3QgcHJvbWlzZVxuICB0aGF0IGlzIHJlamVjdGVkIHdpbGwgYmUgZ2l2ZW4gYXMgYW4gYXJndW1lbnQgdG8gdGhlIHJldHVybmVkIHByb21pc2VzJ3NcbiAgcmVqZWN0aW9uIGhhbmRsZXIuIEZvciBleGFtcGxlOlxuXG4gIEV4YW1wbGU6XG5cbiAgYGBgamF2YXNjcmlwdFxuICB2YXIgcHJvbWlzZTEgPSBSU1ZQLnJlc29sdmUoMSk7XG4gIHZhciBwcm9taXNlMiA9IFJTVlAucmVqZWN0KG5ldyBFcnJvcihcIjJcIikpO1xuICB2YXIgcHJvbWlzZTMgPSBSU1ZQLnJlamVjdChuZXcgRXJyb3IoXCIzXCIpKTtcbiAgdmFyIHByb21pc2VzID0gWyBwcm9taXNlMSwgcHJvbWlzZTIsIHByb21pc2UzIF07XG5cbiAgUlNWUC5hbGwocHJvbWlzZXMpLnRoZW4oZnVuY3Rpb24oYXJyYXkpe1xuICAgIC8vIENvZGUgaGVyZSBuZXZlciBydW5zIGJlY2F1c2UgdGhlcmUgYXJlIHJlamVjdGVkIHByb21pc2VzIVxuICB9LCBmdW5jdGlvbihlcnJvcikge1xuICAgIC8vIGVycm9yLm1lc3NhZ2UgPT09IFwiMlwiXG4gIH0pO1xuICBgYGBcblxuICBAbWV0aG9kIGFsbFxuICBAZm9yIFJTVlBcbiAgQHBhcmFtIHtBcnJheX0gcHJvbWlzZXNcbiAgQHBhcmFtIHtTdHJpbmd9IGxhYmVsXG4gIEByZXR1cm4ge1Byb21pc2V9IHByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2hlbiBhbGwgYHByb21pc2VzYCBoYXZlIGJlZW5cbiAgZnVsZmlsbGVkLCBvciByZWplY3RlZCBpZiBhbnkgb2YgdGhlbSBiZWNvbWUgcmVqZWN0ZWQuXG4qL1xuZnVuY3Rpb24gYWxsKHByb21pc2VzKSB7XG4gIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gIHZhciBQcm9taXNlID0gdGhpcztcblxuICBpZiAoIWlzQXJyYXkocHJvbWlzZXMpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignWW91IG11c3QgcGFzcyBhbiBhcnJheSB0byBhbGwuJyk7XG4gIH1cblxuICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgdmFyIHJlc3VsdHMgPSBbXSwgcmVtYWluaW5nID0gcHJvbWlzZXMubGVuZ3RoLFxuICAgIHByb21pc2U7XG5cbiAgICBpZiAocmVtYWluaW5nID09PSAwKSB7XG4gICAgICByZXNvbHZlKFtdKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZXNvbHZlcihpbmRleCkge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHJlc29sdmVBbGwoaW5kZXgsIHZhbHVlKTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcmVzb2x2ZUFsbChpbmRleCwgdmFsdWUpIHtcbiAgICAgIHJlc3VsdHNbaW5kZXhdID0gdmFsdWU7XG4gICAgICBpZiAoLS1yZW1haW5pbmcgPT09IDApIHtcbiAgICAgICAgcmVzb2x2ZShyZXN1bHRzKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHByb21pc2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBwcm9taXNlID0gcHJvbWlzZXNbaV07XG5cbiAgICAgIGlmIChwcm9taXNlICYmIGlzRnVuY3Rpb24ocHJvbWlzZS50aGVuKSkge1xuICAgICAgICBwcm9taXNlLnRoZW4ocmVzb2x2ZXIoaSksIHJlamVjdCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXNvbHZlQWxsKGksIHByb21pc2UpO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG59XG5cbmV4cG9ydHMuYWxsID0gYWxsOyIsIihmdW5jdGlvbiAocHJvY2VzcyxnbG9iYWwpe1xuXCJ1c2Ugc3RyaWN0XCI7XG52YXIgYnJvd3Nlckdsb2JhbCA9ICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykgPyB3aW5kb3cgOiB7fTtcbnZhciBCcm93c2VyTXV0YXRpb25PYnNlcnZlciA9IGJyb3dzZXJHbG9iYWwuTXV0YXRpb25PYnNlcnZlciB8fCBicm93c2VyR2xvYmFsLldlYktpdE11dGF0aW9uT2JzZXJ2ZXI7XG52YXIgbG9jYWwgPSAodHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcpID8gZ2xvYmFsIDogdGhpcztcblxuLy8gbm9kZVxuZnVuY3Rpb24gdXNlTmV4dFRpY2soKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBwcm9jZXNzLm5leHRUaWNrKGZsdXNoKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gdXNlTXV0YXRpb25PYnNlcnZlcigpIHtcbiAgdmFyIGl0ZXJhdGlvbnMgPSAwO1xuICB2YXIgb2JzZXJ2ZXIgPSBuZXcgQnJvd3Nlck11dGF0aW9uT2JzZXJ2ZXIoZmx1c2gpO1xuICB2YXIgbm9kZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcnKTtcbiAgb2JzZXJ2ZXIub2JzZXJ2ZShub2RlLCB7IGNoYXJhY3RlckRhdGE6IHRydWUgfSk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIG5vZGUuZGF0YSA9IChpdGVyYXRpb25zID0gKytpdGVyYXRpb25zICUgMik7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHVzZVNldFRpbWVvdXQoKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBsb2NhbC5zZXRUaW1lb3V0KGZsdXNoLCAxKTtcbiAgfTtcbn1cblxudmFyIHF1ZXVlID0gW107XG5mdW5jdGlvbiBmbHVzaCgpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBxdWV1ZS5sZW5ndGg7IGkrKykge1xuICAgIHZhciB0dXBsZSA9IHF1ZXVlW2ldO1xuICAgIHZhciBjYWxsYmFjayA9IHR1cGxlWzBdLCBhcmcgPSB0dXBsZVsxXTtcbiAgICBjYWxsYmFjayhhcmcpO1xuICB9XG4gIHF1ZXVlID0gW107XG59XG5cbnZhciBzY2hlZHVsZUZsdXNoO1xuXG4vLyBEZWNpZGUgd2hhdCBhc3luYyBtZXRob2QgdG8gdXNlIHRvIHRyaWdnZXJpbmcgcHJvY2Vzc2luZyBvZiBxdWV1ZWQgY2FsbGJhY2tzOlxuaWYgKHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJyAmJiB7fS50b1N0cmluZy5jYWxsKHByb2Nlc3MpID09PSAnW29iamVjdCBwcm9jZXNzXScpIHtcbiAgc2NoZWR1bGVGbHVzaCA9IHVzZU5leHRUaWNrKCk7XG59IGVsc2UgaWYgKEJyb3dzZXJNdXRhdGlvbk9ic2VydmVyKSB7XG4gIHNjaGVkdWxlRmx1c2ggPSB1c2VNdXRhdGlvbk9ic2VydmVyKCk7XG59IGVsc2Uge1xuICBzY2hlZHVsZUZsdXNoID0gdXNlU2V0VGltZW91dCgpO1xufVxuXG5mdW5jdGlvbiBhc2FwKGNhbGxiYWNrLCBhcmcpIHtcbiAgdmFyIGxlbmd0aCA9IHF1ZXVlLnB1c2goW2NhbGxiYWNrLCBhcmddKTtcbiAgaWYgKGxlbmd0aCA9PT0gMSkge1xuICAgIC8vIElmIGxlbmd0aCBpcyAxLCB0aGF0IG1lYW5zIHRoYXQgd2UgbmVlZCB0byBzY2hlZHVsZSBhbiBhc3luYyBmbHVzaC5cbiAgICAvLyBJZiBhZGRpdGlvbmFsIGNhbGxiYWNrcyBhcmUgcXVldWVkIGJlZm9yZSB0aGUgcXVldWUgaXMgZmx1c2hlZCwgdGhleVxuICAgIC8vIHdpbGwgYmUgcHJvY2Vzc2VkIGJ5IHRoaXMgZmx1c2ggdGhhdCB3ZSBhcmUgc2NoZWR1bGluZy5cbiAgICBzY2hlZHVsZUZsdXNoKCk7XG4gIH1cbn1cblxuZXhwb3J0cy5hc2FwID0gYXNhcDtcbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwiL1VzZXJzL2FuZHJldy9Qcm9qZWN0cy9vc3MvcmFkaW9kYW4vbWFnaWMtYnV0dG9uL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9pbnNlcnQtbW9kdWxlLWdsb2JhbHMvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qc1wiKSx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pIiwiXCJ1c2Ugc3RyaWN0XCI7XG4vKipcbiAgYFJTVlAuUHJvbWlzZS5jYXN0YCByZXR1cm5zIHRoZSBzYW1lIHByb21pc2UgaWYgdGhhdCBwcm9taXNlIHNoYXJlcyBhIGNvbnN0cnVjdG9yXG4gIHdpdGggdGhlIHByb21pc2UgYmVpbmcgY2FzdGVkLlxuXG4gIEV4YW1wbGU6XG5cbiAgYGBgamF2YXNjcmlwdFxuICB2YXIgcHJvbWlzZSA9IFJTVlAucmVzb2x2ZSgxKTtcbiAgdmFyIGNhc3RlZCA9IFJTVlAuUHJvbWlzZS5jYXN0KHByb21pc2UpO1xuXG4gIGNvbnNvbGUubG9nKHByb21pc2UgPT09IGNhc3RlZCk7IC8vIHRydWVcbiAgYGBgXG5cbiAgSW4gdGhlIGNhc2Ugb2YgYSBwcm9taXNlIHdob3NlIGNvbnN0cnVjdG9yIGRvZXMgbm90IG1hdGNoLCBpdCBpcyBhc3NpbWlsYXRlZC5cbiAgVGhlIHJlc3VsdGluZyBwcm9taXNlIHdpbGwgZnVsZmlsbCBvciByZWplY3QgYmFzZWQgb24gdGhlIG91dGNvbWUgb2YgdGhlXG4gIHByb21pc2UgYmVpbmcgY2FzdGVkLlxuXG4gIEluIHRoZSBjYXNlIG9mIGEgbm9uLXByb21pc2UsIGEgcHJvbWlzZSB3aGljaCB3aWxsIGZ1bGZpbGwgd2l0aCB0aGF0IHZhbHVlIGlzXG4gIHJldHVybmVkLlxuXG4gIEV4YW1wbGU6XG5cbiAgYGBgamF2YXNjcmlwdFxuICB2YXIgdmFsdWUgPSAxOyAvLyBjb3VsZCBiZSBhIG51bWJlciwgYm9vbGVhbiwgc3RyaW5nLCB1bmRlZmluZWQuLi5cbiAgdmFyIGNhc3RlZCA9IFJTVlAuUHJvbWlzZS5jYXN0KHZhbHVlKTtcblxuICBjb25zb2xlLmxvZyh2YWx1ZSA9PT0gY2FzdGVkKTsgLy8gZmFsc2VcbiAgY29uc29sZS5sb2coY2FzdGVkIGluc3RhbmNlb2YgUlNWUC5Qcm9taXNlKSAvLyB0cnVlXG5cbiAgY2FzdGVkLnRoZW4oZnVuY3Rpb24odmFsKSB7XG4gICAgdmFsID09PSB2YWx1ZSAvLyA9PiB0cnVlXG4gIH0pO1xuICBgYGBcblxuICBgUlNWUC5Qcm9taXNlLmNhc3RgIGlzIHNpbWlsYXIgdG8gYFJTVlAucmVzb2x2ZWAsIGJ1dCBgUlNWUC5Qcm9taXNlLmNhc3RgIGRpZmZlcnMgaW4gdGhlXG4gIGZvbGxvd2luZyB3YXlzOlxuICAqIGBSU1ZQLlByb21pc2UuY2FzdGAgc2VydmVzIGFzIGEgbWVtb3J5LWVmZmljaWVudCB3YXkgb2YgZ2V0dGluZyBhIHByb21pc2UsIHdoZW4geW91XG4gIGhhdmUgc29tZXRoaW5nIHRoYXQgY291bGQgZWl0aGVyIGJlIGEgcHJvbWlzZSBvciBhIHZhbHVlLiBSU1ZQLnJlc29sdmVcbiAgd2lsbCBoYXZlIHRoZSBzYW1lIGVmZmVjdCBidXQgd2lsbCBjcmVhdGUgYSBuZXcgcHJvbWlzZSB3cmFwcGVyIGlmIHRoZVxuICBhcmd1bWVudCBpcyBhIHByb21pc2UuXG4gICogYFJTVlAuUHJvbWlzZS5jYXN0YCBpcyBhIHdheSBvZiBjYXN0aW5nIGluY29taW5nIHRoZW5hYmxlcyBvciBwcm9taXNlIHN1YmNsYXNzZXMgdG9cbiAgcHJvbWlzZXMgb2YgdGhlIGV4YWN0IGNsYXNzIHNwZWNpZmllZCwgc28gdGhhdCB0aGUgcmVzdWx0aW5nIG9iamVjdCdzIGB0aGVuYCBpc1xuICBlbnN1cmVkIHRvIGhhdmUgdGhlIGJlaGF2aW9yIG9mIHRoZSBjb25zdHJ1Y3RvciB5b3UgYXJlIGNhbGxpbmcgY2FzdCBvbiAoaS5lLiwgUlNWUC5Qcm9taXNlKS5cblxuICBAbWV0aG9kIGNhc3RcbiAgQGZvciBSU1ZQXG4gIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgdG8gYmUgY2FzdGVkXG4gIEByZXR1cm4ge1Byb21pc2V9IHByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2hlbiBhbGwgcHJvcGVydGllcyBvZiBgcHJvbWlzZXNgXG4gIGhhdmUgYmVlbiBmdWxmaWxsZWQsIG9yIHJlamVjdGVkIGlmIGFueSBvZiB0aGVtIGJlY29tZSByZWplY3RlZC5cbiovXG5cblxuZnVuY3Rpb24gY2FzdChvYmplY3QpIHtcbiAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgaWYgKG9iamVjdCAmJiB0eXBlb2Ygb2JqZWN0ID09PSAnb2JqZWN0JyAmJiBvYmplY3QuY29uc3RydWN0b3IgPT09IHRoaXMpIHtcbiAgICByZXR1cm4gb2JqZWN0O1xuICB9XG5cbiAgdmFyIFByb21pc2UgPSB0aGlzO1xuXG4gIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlKSB7XG4gICAgcmVzb2x2ZShvYmplY3QpO1xuICB9KTtcbn1cblxuZXhwb3J0cy5jYXN0ID0gY2FzdDsiLCJcInVzZSBzdHJpY3RcIjtcbnZhciBjb25maWcgPSB7XG4gIGluc3RydW1lbnQ6IGZhbHNlXG59O1xuXG5mdW5jdGlvbiBjb25maWd1cmUobmFtZSwgdmFsdWUpIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHtcbiAgICBjb25maWdbbmFtZV0gPSB2YWx1ZTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gY29uZmlnW25hbWVdO1xuICB9XG59XG5cbmV4cG9ydHMuY29uZmlnID0gY29uZmlnO1xuZXhwb3J0cy5jb25maWd1cmUgPSBjb25maWd1cmU7IiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgUlNWUFByb21pc2UgPSByZXF1aXJlKFwiLi9wcm9taXNlXCIpLlByb21pc2U7XG52YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoXCIuL3V0aWxzXCIpLmlzRnVuY3Rpb247XG5cbmZ1bmN0aW9uIHBvbHlmaWxsKCkge1xuICB2YXIgZXM2UHJvbWlzZVN1cHBvcnQgPSBcbiAgICBcIlByb21pc2VcIiBpbiB3aW5kb3cgJiZcbiAgICAvLyBTb21lIG9mIHRoZXNlIG1ldGhvZHMgYXJlIG1pc3NpbmcgZnJvbVxuICAgIC8vIEZpcmVmb3gvQ2hyb21lIGV4cGVyaW1lbnRhbCBpbXBsZW1lbnRhdGlvbnNcbiAgICBcImNhc3RcIiBpbiB3aW5kb3cuUHJvbWlzZSAmJlxuICAgIFwicmVzb2x2ZVwiIGluIHdpbmRvdy5Qcm9taXNlICYmXG4gICAgXCJyZWplY3RcIiBpbiB3aW5kb3cuUHJvbWlzZSAmJlxuICAgIFwiYWxsXCIgaW4gd2luZG93LlByb21pc2UgJiZcbiAgICBcInJhY2VcIiBpbiB3aW5kb3cuUHJvbWlzZSAmJlxuICAgIC8vIE9sZGVyIHZlcnNpb24gb2YgdGhlIHNwZWMgaGFkIGEgcmVzb2x2ZXIgb2JqZWN0XG4gICAgLy8gYXMgdGhlIGFyZyByYXRoZXIgdGhhbiBhIGZ1bmN0aW9uXG4gICAgKGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHJlc29sdmU7XG4gICAgICBuZXcgd2luZG93LlByb21pc2UoZnVuY3Rpb24ocikgeyByZXNvbHZlID0gcjsgfSk7XG4gICAgICByZXR1cm4gaXNGdW5jdGlvbihyZXNvbHZlKTtcbiAgICB9KCkpO1xuXG4gIGlmICghZXM2UHJvbWlzZVN1cHBvcnQpIHtcbiAgICB3aW5kb3cuUHJvbWlzZSA9IFJTVlBQcm9taXNlO1xuICB9XG59XG5cbmV4cG9ydHMucG9seWZpbGwgPSBwb2x5ZmlsbDsiLCJcInVzZSBzdHJpY3RcIjtcbnZhciBjb25maWcgPSByZXF1aXJlKFwiLi9jb25maWdcIikuY29uZmlnO1xudmFyIGNvbmZpZ3VyZSA9IHJlcXVpcmUoXCIuL2NvbmZpZ1wiKS5jb25maWd1cmU7XG52YXIgb2JqZWN0T3JGdW5jdGlvbiA9IHJlcXVpcmUoXCIuL3V0aWxzXCIpLm9iamVjdE9yRnVuY3Rpb247XG52YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoXCIuL3V0aWxzXCIpLmlzRnVuY3Rpb247XG52YXIgbm93ID0gcmVxdWlyZShcIi4vdXRpbHNcIikubm93O1xudmFyIGNhc3QgPSByZXF1aXJlKFwiLi9jYXN0XCIpLmNhc3Q7XG52YXIgYWxsID0gcmVxdWlyZShcIi4vYWxsXCIpLmFsbDtcbnZhciByYWNlID0gcmVxdWlyZShcIi4vcmFjZVwiKS5yYWNlO1xudmFyIHN0YXRpY1Jlc29sdmUgPSByZXF1aXJlKFwiLi9yZXNvbHZlXCIpLnJlc29sdmU7XG52YXIgc3RhdGljUmVqZWN0ID0gcmVxdWlyZShcIi4vcmVqZWN0XCIpLnJlamVjdDtcbnZhciBhc2FwID0gcmVxdWlyZShcIi4vYXNhcFwiKS5hc2FwO1xuXG52YXIgY291bnRlciA9IDA7XG5cbmNvbmZpZy5hc3luYyA9IGFzYXA7IC8vIGRlZmF1bHQgYXN5bmMgaXMgYXNhcDtcblxuZnVuY3Rpb24gUHJvbWlzZShyZXNvbHZlcikge1xuICBpZiAoIWlzRnVuY3Rpb24ocmVzb2x2ZXIpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignWW91IG11c3QgcGFzcyBhIHJlc29sdmVyIGZ1bmN0aW9uIGFzIHRoZSBmaXJzdCBhcmd1bWVudCB0byB0aGUgcHJvbWlzZSBjb25zdHJ1Y3RvcicpO1xuICB9XG5cbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFByb21pc2UpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkZhaWxlZCB0byBjb25zdHJ1Y3QgJ1Byb21pc2UnOiBQbGVhc2UgdXNlIHRoZSAnbmV3JyBvcGVyYXRvciwgdGhpcyBvYmplY3QgY29uc3RydWN0b3IgY2Fubm90IGJlIGNhbGxlZCBhcyBhIGZ1bmN0aW9uLlwiKTtcbiAgfVxuXG4gIHRoaXMuX3N1YnNjcmliZXJzID0gW107XG5cbiAgaW52b2tlUmVzb2x2ZXIocmVzb2x2ZXIsIHRoaXMpO1xufVxuXG5mdW5jdGlvbiBpbnZva2VSZXNvbHZlcihyZXNvbHZlciwgcHJvbWlzZSkge1xuICBmdW5jdGlvbiByZXNvbHZlUHJvbWlzZSh2YWx1ZSkge1xuICAgIHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVqZWN0UHJvbWlzZShyZWFzb24pIHtcbiAgICByZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgcmVzb2x2ZXIocmVzb2x2ZVByb21pc2UsIHJlamVjdFByb21pc2UpO1xuICB9IGNhdGNoKGUpIHtcbiAgICByZWplY3RQcm9taXNlKGUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGludm9rZUNhbGxiYWNrKHNldHRsZWQsIHByb21pc2UsIGNhbGxiYWNrLCBkZXRhaWwpIHtcbiAgdmFyIGhhc0NhbGxiYWNrID0gaXNGdW5jdGlvbihjYWxsYmFjayksXG4gICAgICB2YWx1ZSwgZXJyb3IsIHN1Y2NlZWRlZCwgZmFpbGVkO1xuXG4gIGlmIChoYXNDYWxsYmFjaykge1xuICAgIHRyeSB7XG4gICAgICB2YWx1ZSA9IGNhbGxiYWNrKGRldGFpbCk7XG4gICAgICBzdWNjZWVkZWQgPSB0cnVlO1xuICAgIH0gY2F0Y2goZSkge1xuICAgICAgZmFpbGVkID0gdHJ1ZTtcbiAgICAgIGVycm9yID0gZTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdmFsdWUgPSBkZXRhaWw7XG4gICAgc3VjY2VlZGVkID0gdHJ1ZTtcbiAgfVxuXG4gIGlmIChoYW5kbGVUaGVuYWJsZShwcm9taXNlLCB2YWx1ZSkpIHtcbiAgICByZXR1cm47XG4gIH0gZWxzZSBpZiAoaGFzQ2FsbGJhY2sgJiYgc3VjY2VlZGVkKSB7XG4gICAgcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG4gIH0gZWxzZSBpZiAoZmFpbGVkKSB7XG4gICAgcmVqZWN0KHByb21pc2UsIGVycm9yKTtcbiAgfSBlbHNlIGlmIChzZXR0bGVkID09PSBGVUxGSUxMRUQpIHtcbiAgICByZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgfSBlbHNlIGlmIChzZXR0bGVkID09PSBSRUpFQ1RFRCkge1xuICAgIHJlamVjdChwcm9taXNlLCB2YWx1ZSk7XG4gIH1cbn1cblxudmFyIFBFTkRJTkcgICA9IHZvaWQgMDtcbnZhciBTRUFMRUQgICAgPSAwO1xudmFyIEZVTEZJTExFRCA9IDE7XG52YXIgUkVKRUNURUQgID0gMjtcblxuZnVuY3Rpb24gc3Vic2NyaWJlKHBhcmVudCwgY2hpbGQsIG9uRnVsZmlsbG1lbnQsIG9uUmVqZWN0aW9uKSB7XG4gIHZhciBzdWJzY3JpYmVycyA9IHBhcmVudC5fc3Vic2NyaWJlcnM7XG4gIHZhciBsZW5ndGggPSBzdWJzY3JpYmVycy5sZW5ndGg7XG5cbiAgc3Vic2NyaWJlcnNbbGVuZ3RoXSA9IGNoaWxkO1xuICBzdWJzY3JpYmVyc1tsZW5ndGggKyBGVUxGSUxMRURdID0gb25GdWxmaWxsbWVudDtcbiAgc3Vic2NyaWJlcnNbbGVuZ3RoICsgUkVKRUNURURdICA9IG9uUmVqZWN0aW9uO1xufVxuXG5mdW5jdGlvbiBwdWJsaXNoKHByb21pc2UsIHNldHRsZWQpIHtcbiAgdmFyIGNoaWxkLCBjYWxsYmFjaywgc3Vic2NyaWJlcnMgPSBwcm9taXNlLl9zdWJzY3JpYmVycywgZGV0YWlsID0gcHJvbWlzZS5fZGV0YWlsO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3Vic2NyaWJlcnMubGVuZ3RoOyBpICs9IDMpIHtcbiAgICBjaGlsZCA9IHN1YnNjcmliZXJzW2ldO1xuICAgIGNhbGxiYWNrID0gc3Vic2NyaWJlcnNbaSArIHNldHRsZWRdO1xuXG4gICAgaW52b2tlQ2FsbGJhY2soc2V0dGxlZCwgY2hpbGQsIGNhbGxiYWNrLCBkZXRhaWwpO1xuICB9XG5cbiAgcHJvbWlzZS5fc3Vic2NyaWJlcnMgPSBudWxsO1xufVxuXG5Qcm9taXNlLnByb3RvdHlwZSA9IHtcbiAgY29uc3RydWN0b3I6IFByb21pc2UsXG5cbiAgX3N0YXRlOiB1bmRlZmluZWQsXG4gIF9kZXRhaWw6IHVuZGVmaW5lZCxcbiAgX3N1YnNjcmliZXJzOiB1bmRlZmluZWQsXG5cbiAgdGhlbjogZnVuY3Rpb24ob25GdWxmaWxsbWVudCwgb25SZWplY3Rpb24pIHtcbiAgICB2YXIgcHJvbWlzZSA9IHRoaXM7XG5cbiAgICB2YXIgdGhlblByb21pc2UgPSBuZXcgdGhpcy5jb25zdHJ1Y3RvcihmdW5jdGlvbigpIHt9KTtcblxuICAgIGlmICh0aGlzLl9zdGF0ZSkge1xuICAgICAgdmFyIGNhbGxiYWNrcyA9IGFyZ3VtZW50cztcbiAgICAgIGNvbmZpZy5hc3luYyhmdW5jdGlvbiBpbnZva2VQcm9taXNlQ2FsbGJhY2soKSB7XG4gICAgICAgIGludm9rZUNhbGxiYWNrKHByb21pc2UuX3N0YXRlLCB0aGVuUHJvbWlzZSwgY2FsbGJhY2tzW3Byb21pc2UuX3N0YXRlIC0gMV0sIHByb21pc2UuX2RldGFpbCk7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3Vic2NyaWJlKHRoaXMsIHRoZW5Qcm9taXNlLCBvbkZ1bGZpbGxtZW50LCBvblJlamVjdGlvbik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoZW5Qcm9taXNlO1xuICB9LFxuXG4gICdjYXRjaCc6IGZ1bmN0aW9uKG9uUmVqZWN0aW9uKSB7XG4gICAgcmV0dXJuIHRoaXMudGhlbihudWxsLCBvblJlamVjdGlvbik7XG4gIH1cbn07XG5cblByb21pc2UuYWxsID0gYWxsO1xuUHJvbWlzZS5jYXN0ID0gY2FzdDtcblByb21pc2UucmFjZSA9IHJhY2U7XG5Qcm9taXNlLnJlc29sdmUgPSBzdGF0aWNSZXNvbHZlO1xuUHJvbWlzZS5yZWplY3QgPSBzdGF0aWNSZWplY3Q7XG5cbmZ1bmN0aW9uIGhhbmRsZVRoZW5hYmxlKHByb21pc2UsIHZhbHVlKSB7XG4gIHZhciB0aGVuID0gbnVsbCxcbiAgcmVzb2x2ZWQ7XG5cbiAgdHJ5IHtcbiAgICBpZiAocHJvbWlzZSA9PT0gdmFsdWUpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJBIHByb21pc2VzIGNhbGxiYWNrIGNhbm5vdCByZXR1cm4gdGhhdCBzYW1lIHByb21pc2UuXCIpO1xuICAgIH1cblxuICAgIGlmIChvYmplY3RPckZ1bmN0aW9uKHZhbHVlKSkge1xuICAgICAgdGhlbiA9IHZhbHVlLnRoZW47XG5cbiAgICAgIGlmIChpc0Z1bmN0aW9uKHRoZW4pKSB7XG4gICAgICAgIHRoZW4uY2FsbCh2YWx1ZSwgZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgaWYgKHJlc29sdmVkKSB7IHJldHVybiB0cnVlOyB9XG4gICAgICAgICAgcmVzb2x2ZWQgPSB0cnVlO1xuXG4gICAgICAgICAgaWYgKHZhbHVlICE9PSB2YWwpIHtcbiAgICAgICAgICAgIHJlc29sdmUocHJvbWlzZSwgdmFsKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZnVsZmlsbChwcm9taXNlLCB2YWwpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSwgZnVuY3Rpb24odmFsKSB7XG4gICAgICAgICAgaWYgKHJlc29sdmVkKSB7IHJldHVybiB0cnVlOyB9XG4gICAgICAgICAgcmVzb2x2ZWQgPSB0cnVlO1xuXG4gICAgICAgICAgcmVqZWN0KHByb21pc2UsIHZhbCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAocmVzb2x2ZWQpIHsgcmV0dXJuIHRydWU7IH1cbiAgICByZWplY3QocHJvbWlzZSwgZXJyb3IpO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiByZXNvbHZlKHByb21pc2UsIHZhbHVlKSB7XG4gIGlmIChwcm9taXNlID09PSB2YWx1ZSkge1xuICAgIGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpO1xuICB9IGVsc2UgaWYgKCFoYW5kbGVUaGVuYWJsZShwcm9taXNlLCB2YWx1ZSkpIHtcbiAgICBmdWxmaWxsKHByb21pc2UsIHZhbHVlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBmdWxmaWxsKHByb21pc2UsIHZhbHVlKSB7XG4gIGlmIChwcm9taXNlLl9zdGF0ZSAhPT0gUEVORElORykgeyByZXR1cm47IH1cbiAgcHJvbWlzZS5fc3RhdGUgPSBTRUFMRUQ7XG4gIHByb21pc2UuX2RldGFpbCA9IHZhbHVlO1xuXG4gIGNvbmZpZy5hc3luYyhwdWJsaXNoRnVsZmlsbG1lbnQsIHByb21pc2UpO1xufVxuXG5mdW5jdGlvbiByZWplY3QocHJvbWlzZSwgcmVhc29uKSB7XG4gIGlmIChwcm9taXNlLl9zdGF0ZSAhPT0gUEVORElORykgeyByZXR1cm47IH1cbiAgcHJvbWlzZS5fc3RhdGUgPSBTRUFMRUQ7XG4gIHByb21pc2UuX2RldGFpbCA9IHJlYXNvbjtcblxuICBjb25maWcuYXN5bmMocHVibGlzaFJlamVjdGlvbiwgcHJvbWlzZSk7XG59XG5cbmZ1bmN0aW9uIHB1Ymxpc2hGdWxmaWxsbWVudChwcm9taXNlKSB7XG4gIHB1Ymxpc2gocHJvbWlzZSwgcHJvbWlzZS5fc3RhdGUgPSBGVUxGSUxMRUQpO1xufVxuXG5mdW5jdGlvbiBwdWJsaXNoUmVqZWN0aW9uKHByb21pc2UpIHtcbiAgcHVibGlzaChwcm9taXNlLCBwcm9taXNlLl9zdGF0ZSA9IFJFSkVDVEVEKTtcbn1cblxuZXhwb3J0cy5Qcm9taXNlID0gUHJvbWlzZTsiLCJcInVzZSBzdHJpY3RcIjtcbi8qIGdsb2JhbCB0b1N0cmluZyAqL1xudmFyIGlzQXJyYXkgPSByZXF1aXJlKFwiLi91dGlsc1wiKS5pc0FycmF5O1xuXG4vKipcbiAgYFJTVlAucmFjZWAgYWxsb3dzIHlvdSB0byB3YXRjaCBhIHNlcmllcyBvZiBwcm9taXNlcyBhbmQgYWN0IGFzIHNvb24gYXMgdGhlXG4gIGZpcnN0IHByb21pc2UgZ2l2ZW4gdG8gdGhlIGBwcm9taXNlc2AgYXJndW1lbnQgZnVsZmlsbHMgb3IgcmVqZWN0cy5cblxuICBFeGFtcGxlOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgdmFyIHByb21pc2UxID0gbmV3IFJTVlAuUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgIHJlc29sdmUoXCJwcm9taXNlIDFcIik7XG4gICAgfSwgMjAwKTtcbiAgfSk7XG5cbiAgdmFyIHByb21pc2UyID0gbmV3IFJTVlAuUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgIHJlc29sdmUoXCJwcm9taXNlIDJcIik7XG4gICAgfSwgMTAwKTtcbiAgfSk7XG5cbiAgUlNWUC5yYWNlKFtwcm9taXNlMSwgcHJvbWlzZTJdKS50aGVuKGZ1bmN0aW9uKHJlc3VsdCl7XG4gICAgLy8gcmVzdWx0ID09PSBcInByb21pc2UgMlwiIGJlY2F1c2UgaXQgd2FzIHJlc29sdmVkIGJlZm9yZSBwcm9taXNlMVxuICAgIC8vIHdhcyByZXNvbHZlZC5cbiAgfSk7XG4gIGBgYFxuXG4gIGBSU1ZQLnJhY2VgIGlzIGRldGVybWluaXN0aWMgaW4gdGhhdCBvbmx5IHRoZSBzdGF0ZSBvZiB0aGUgZmlyc3QgY29tcGxldGVkXG4gIHByb21pc2UgbWF0dGVycy4gRm9yIGV4YW1wbGUsIGV2ZW4gaWYgb3RoZXIgcHJvbWlzZXMgZ2l2ZW4gdG8gdGhlIGBwcm9taXNlc2BcbiAgYXJyYXkgYXJndW1lbnQgYXJlIHJlc29sdmVkLCBidXQgdGhlIGZpcnN0IGNvbXBsZXRlZCBwcm9taXNlIGhhcyBiZWNvbWVcbiAgcmVqZWN0ZWQgYmVmb3JlIHRoZSBvdGhlciBwcm9taXNlcyBiZWNhbWUgZnVsZmlsbGVkLCB0aGUgcmV0dXJuZWQgcHJvbWlzZVxuICB3aWxsIGJlY29tZSByZWplY3RlZDpcblxuICBgYGBqYXZhc2NyaXB0XG4gIHZhciBwcm9taXNlMSA9IG5ldyBSU1ZQLlByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICByZXNvbHZlKFwicHJvbWlzZSAxXCIpO1xuICAgIH0sIDIwMCk7XG4gIH0pO1xuXG4gIHZhciBwcm9taXNlMiA9IG5ldyBSU1ZQLlByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICByZWplY3QobmV3IEVycm9yKFwicHJvbWlzZSAyXCIpKTtcbiAgICB9LCAxMDApO1xuICB9KTtcblxuICBSU1ZQLnJhY2UoW3Byb21pc2UxLCBwcm9taXNlMl0pLnRoZW4oZnVuY3Rpb24ocmVzdWx0KXtcbiAgICAvLyBDb2RlIGhlcmUgbmV2ZXIgcnVucyBiZWNhdXNlIHRoZXJlIGFyZSByZWplY3RlZCBwcm9taXNlcyFcbiAgfSwgZnVuY3Rpb24ocmVhc29uKXtcbiAgICAvLyByZWFzb24ubWVzc2FnZSA9PT0gXCJwcm9taXNlMlwiIGJlY2F1c2UgcHJvbWlzZSAyIGJlY2FtZSByZWplY3RlZCBiZWZvcmVcbiAgICAvLyBwcm9taXNlIDEgYmVjYW1lIGZ1bGZpbGxlZFxuICB9KTtcbiAgYGBgXG5cbiAgQG1ldGhvZCByYWNlXG4gIEBmb3IgUlNWUFxuICBAcGFyYW0ge0FycmF5fSBwcm9taXNlcyBhcnJheSBvZiBwcm9taXNlcyB0byBvYnNlcnZlXG4gIEBwYXJhbSB7U3RyaW5nfSBsYWJlbCBvcHRpb25hbCBzdHJpbmcgZm9yIGRlc2NyaWJpbmcgdGhlIHByb21pc2UgcmV0dXJuZWQuXG4gIFVzZWZ1bCBmb3IgdG9vbGluZy5cbiAgQHJldHVybiB7UHJvbWlzZX0gYSBwcm9taXNlIHRoYXQgYmVjb21lcyBmdWxmaWxsZWQgd2l0aCB0aGUgdmFsdWUgdGhlIGZpcnN0XG4gIGNvbXBsZXRlZCBwcm9taXNlcyBpcyByZXNvbHZlZCB3aXRoIGlmIHRoZSBmaXJzdCBjb21wbGV0ZWQgcHJvbWlzZSB3YXNcbiAgZnVsZmlsbGVkLCBvciByZWplY3RlZCB3aXRoIHRoZSByZWFzb24gdGhhdCB0aGUgZmlyc3QgY29tcGxldGVkIHByb21pc2VcbiAgd2FzIHJlamVjdGVkIHdpdGguXG4qL1xuZnVuY3Rpb24gcmFjZShwcm9taXNlcykge1xuICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICB2YXIgUHJvbWlzZSA9IHRoaXM7XG5cbiAgaWYgKCFpc0FycmF5KHByb21pc2VzKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1lvdSBtdXN0IHBhc3MgYW4gYXJyYXkgdG8gcmFjZS4nKTtcbiAgfVxuICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgdmFyIHJlc3VsdHMgPSBbXSwgcHJvbWlzZTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcHJvbWlzZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHByb21pc2UgPSBwcm9taXNlc1tpXTtcblxuICAgICAgaWYgKHByb21pc2UgJiYgdHlwZW9mIHByb21pc2UudGhlbiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBwcm9taXNlLnRoZW4ocmVzb2x2ZSwgcmVqZWN0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc29sdmUocHJvbWlzZSk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcbn1cblxuZXhwb3J0cy5yYWNlID0gcmFjZTsiLCJcInVzZSBzdHJpY3RcIjtcbi8qKlxuICBgUlNWUC5yZWplY3RgIHJldHVybnMgYSBwcm9taXNlIHRoYXQgd2lsbCBiZWNvbWUgcmVqZWN0ZWQgd2l0aCB0aGUgcGFzc2VkXG4gIGByZWFzb25gLiBgUlNWUC5yZWplY3RgIGlzIGVzc2VudGlhbGx5IHNob3J0aGFuZCBmb3IgdGhlIGZvbGxvd2luZzpcblxuICBgYGBqYXZhc2NyaXB0XG4gIHZhciBwcm9taXNlID0gbmV3IFJTVlAuUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgIHJlamVjdChuZXcgRXJyb3IoJ1dIT09QUycpKTtcbiAgfSk7XG5cbiAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHZhbHVlKXtcbiAgICAvLyBDb2RlIGhlcmUgZG9lc24ndCBydW4gYmVjYXVzZSB0aGUgcHJvbWlzZSBpcyByZWplY3RlZCFcbiAgfSwgZnVuY3Rpb24ocmVhc29uKXtcbiAgICAvLyByZWFzb24ubWVzc2FnZSA9PT0gJ1dIT09QUydcbiAgfSk7XG4gIGBgYFxuXG4gIEluc3RlYWQgb2Ygd3JpdGluZyB0aGUgYWJvdmUsIHlvdXIgY29kZSBub3cgc2ltcGx5IGJlY29tZXMgdGhlIGZvbGxvd2luZzpcblxuICBgYGBqYXZhc2NyaXB0XG4gIHZhciBwcm9taXNlID0gUlNWUC5yZWplY3QobmV3IEVycm9yKCdXSE9PUFMnKSk7XG5cbiAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHZhbHVlKXtcbiAgICAvLyBDb2RlIGhlcmUgZG9lc24ndCBydW4gYmVjYXVzZSB0aGUgcHJvbWlzZSBpcyByZWplY3RlZCFcbiAgfSwgZnVuY3Rpb24ocmVhc29uKXtcbiAgICAvLyByZWFzb24ubWVzc2FnZSA9PT0gJ1dIT09QUydcbiAgfSk7XG4gIGBgYFxuXG4gIEBtZXRob2QgcmVqZWN0XG4gIEBmb3IgUlNWUFxuICBAcGFyYW0ge0FueX0gcmVhc29uIHZhbHVlIHRoYXQgdGhlIHJldHVybmVkIHByb21pc2Ugd2lsbCBiZSByZWplY3RlZCB3aXRoLlxuICBAcGFyYW0ge1N0cmluZ30gbGFiZWwgb3B0aW9uYWwgc3RyaW5nIGZvciBpZGVudGlmeWluZyB0aGUgcmV0dXJuZWQgcHJvbWlzZS5cbiAgVXNlZnVsIGZvciB0b29saW5nLlxuICBAcmV0dXJuIHtQcm9taXNlfSBhIHByb21pc2UgdGhhdCB3aWxsIGJlY29tZSByZWplY3RlZCB3aXRoIHRoZSBnaXZlblxuICBgcmVhc29uYC5cbiovXG5mdW5jdGlvbiByZWplY3QocmVhc29uKSB7XG4gIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gIHZhciBQcm9taXNlID0gdGhpcztcblxuICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgIHJlamVjdChyZWFzb24pO1xuICB9KTtcbn1cblxuZXhwb3J0cy5yZWplY3QgPSByZWplY3Q7IiwiXCJ1c2Ugc3RyaWN0XCI7XG4vKipcbiAgYFJTVlAucmVzb2x2ZWAgcmV0dXJucyBhIHByb21pc2UgdGhhdCB3aWxsIGJlY29tZSBmdWxmaWxsZWQgd2l0aCB0aGUgcGFzc2VkXG4gIGB2YWx1ZWAuIGBSU1ZQLnJlc29sdmVgIGlzIGVzc2VudGlhbGx5IHNob3J0aGFuZCBmb3IgdGhlIGZvbGxvd2luZzpcblxuICBgYGBqYXZhc2NyaXB0XG4gIHZhciBwcm9taXNlID0gbmV3IFJTVlAuUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgIHJlc29sdmUoMSk7XG4gIH0pO1xuXG4gIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSl7XG4gICAgLy8gdmFsdWUgPT09IDFcbiAgfSk7XG4gIGBgYFxuXG4gIEluc3RlYWQgb2Ygd3JpdGluZyB0aGUgYWJvdmUsIHlvdXIgY29kZSBub3cgc2ltcGx5IGJlY29tZXMgdGhlIGZvbGxvd2luZzpcblxuICBgYGBqYXZhc2NyaXB0XG4gIHZhciBwcm9taXNlID0gUlNWUC5yZXNvbHZlKDEpO1xuXG4gIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSl7XG4gICAgLy8gdmFsdWUgPT09IDFcbiAgfSk7XG4gIGBgYFxuXG4gIEBtZXRob2QgcmVzb2x2ZVxuICBAZm9yIFJTVlBcbiAgQHBhcmFtIHtBbnl9IHZhbHVlIHZhbHVlIHRoYXQgdGhlIHJldHVybmVkIHByb21pc2Ugd2lsbCBiZSByZXNvbHZlZCB3aXRoXG4gIEBwYXJhbSB7U3RyaW5nfSBsYWJlbCBvcHRpb25hbCBzdHJpbmcgZm9yIGlkZW50aWZ5aW5nIHRoZSByZXR1cm5lZCBwcm9taXNlLlxuICBVc2VmdWwgZm9yIHRvb2xpbmcuXG4gIEByZXR1cm4ge1Byb21pc2V9IGEgcHJvbWlzZSB0aGF0IHdpbGwgYmVjb21lIGZ1bGZpbGxlZCB3aXRoIHRoZSBnaXZlblxuICBgdmFsdWVgXG4qL1xuZnVuY3Rpb24gcmVzb2x2ZSh2YWx1ZSkge1xuICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICB2YXIgUHJvbWlzZSA9IHRoaXM7XG4gIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICByZXNvbHZlKHZhbHVlKTtcbiAgfSk7XG59XG5cbmV4cG9ydHMucmVzb2x2ZSA9IHJlc29sdmU7IiwiXCJ1c2Ugc3RyaWN0XCI7XG5mdW5jdGlvbiBvYmplY3RPckZ1bmN0aW9uKHgpIHtcbiAgcmV0dXJuIGlzRnVuY3Rpb24oeCkgfHwgKHR5cGVvZiB4ID09PSBcIm9iamVjdFwiICYmIHggIT09IG51bGwpO1xufVxuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKHgpIHtcbiAgcmV0dXJuIHR5cGVvZiB4ID09PSBcImZ1bmN0aW9uXCI7XG59XG5cbmZ1bmN0aW9uIGlzQXJyYXkoeCkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHgpID09PSBcIltvYmplY3QgQXJyYXldXCI7XG59XG5cbi8vIERhdGUubm93IGlzIG5vdCBhdmFpbGFibGUgaW4gYnJvd3NlcnMgPCBJRTlcbi8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL0RhdGUvbm93I0NvbXBhdGliaWxpdHlcbnZhciBub3cgPSBEYXRlLm5vdyB8fCBmdW5jdGlvbigpIHsgcmV0dXJuIG5ldyBEYXRlKCkuZ2V0VGltZSgpOyB9O1xuXG5cbmV4cG9ydHMub2JqZWN0T3JGdW5jdGlvbiA9IG9iamVjdE9yRnVuY3Rpb247XG5leHBvcnRzLmlzRnVuY3Rpb24gPSBpc0Z1bmN0aW9uO1xuZXhwb3J0cy5pc0FycmF5ID0gaXNBcnJheTtcbmV4cG9ydHMubm93ID0gbm93OyIsIi8qXG5cblx0UmFjdGl2ZSAtIHYwLjMuOS0zMTctZDIzZTQwOCAtIDIwMTQtMDMtMjFcblx0PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuXHROZXh0LWdlbmVyYXRpb24gRE9NIG1hbmlwdWxhdGlvbiAtIGh0dHA6Ly9yYWN0aXZlanMub3JnXG5cdEZvbGxvdyBAUmFjdGl2ZUpTIGZvciB1cGRhdGVzXG5cblx0LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuXHRDb3B5cmlnaHQgMjAxNCBSaWNoIEhhcnJpcyBhbmQgY29udHJpYnV0b3JzXG5cblx0UGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb25cblx0b2J0YWluaW5nIGEgY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb25cblx0ZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0XG5cdHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLFxuXHRjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbFxuXHRjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGVcblx0U29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmdcblx0Y29uZGl0aW9uczpcblxuXHRUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZVxuXHRpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cblxuXHRUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELFxuXHRFWFBSRVNTIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVNcblx0T0YgTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkRcblx0Tk9OSU5GUklOR0VNRU5ULiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFRcblx0SE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSwgREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksXG5cdFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lOR1xuXHRGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SXG5cdE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuKi9cblxuKCBmdW5jdGlvbiggZ2xvYmFsICkge1xuXG5cblxuXHR2YXIgbm9Db25mbGljdCA9IGdsb2JhbC5SYWN0aXZlO1xuXG5cdHZhciBsZWdhY3kgPSB1bmRlZmluZWQ7XG5cblx0dmFyIGNvbmZpZ19pbml0T3B0aW9ucyA9IGZ1bmN0aW9uKCBsZWdhY3kgKSB7XG5cblx0XHR2YXIgZGVmYXVsdHMsIGluaXRPcHRpb25zO1xuXHRcdGRlZmF1bHRzID0ge1xuXHRcdFx0ZWw6IG51bGwsXG5cdFx0XHR0ZW1wbGF0ZTogJycsXG5cdFx0XHRjb21wbGV0ZTogbnVsbCxcblx0XHRcdHByZXNlcnZlV2hpdGVzcGFjZTogZmFsc2UsXG5cdFx0XHRhcHBlbmQ6IGZhbHNlLFxuXHRcdFx0dHdvd2F5OiB0cnVlLFxuXHRcdFx0bW9kaWZ5QXJyYXlzOiB0cnVlLFxuXHRcdFx0bGF6eTogZmFsc2UsXG5cdFx0XHRkZWJ1ZzogZmFsc2UsXG5cdFx0XHRub0ludHJvOiBmYWxzZSxcblx0XHRcdHRyYW5zaXRpb25zRW5hYmxlZDogdHJ1ZSxcblx0XHRcdG1hZ2ljOiBmYWxzZSxcblx0XHRcdG5vQ3NzVHJhbnNmb3JtOiBmYWxzZSxcblx0XHRcdGFkYXB0OiBbXSxcblx0XHRcdHNhbml0aXplOiBmYWxzZSxcblx0XHRcdHN0cmlwQ29tbWVudHM6IHRydWUsXG5cdFx0XHRpc29sYXRlZDogZmFsc2UsXG5cdFx0XHRkZWxpbWl0ZXJzOiBbXG5cdFx0XHRcdCd7eycsXG5cdFx0XHRcdCd9fSdcblx0XHRcdF0sXG5cdFx0XHR0cmlwbGVEZWxpbWl0ZXJzOiBbXG5cdFx0XHRcdCd7e3snLFxuXHRcdFx0XHQnfX19J1xuXHRcdFx0XVxuXHRcdH07XG5cdFx0aW5pdE9wdGlvbnMgPSB7XG5cdFx0XHRrZXlzOiBPYmplY3Qua2V5cyggZGVmYXVsdHMgKSxcblx0XHRcdGRlZmF1bHRzOiBkZWZhdWx0c1xuXHRcdH07XG5cdFx0cmV0dXJuIGluaXRPcHRpb25zO1xuXHR9KCBsZWdhY3kgKTtcblxuXHR2YXIgY29uZmlnX3N2ZyA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0aWYgKCB0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRyZXR1cm4gZG9jdW1lbnQgJiYgZG9jdW1lbnQuaW1wbGVtZW50YXRpb24uaGFzRmVhdHVyZSggJ2h0dHA6Ly93d3cudzMub3JnL1RSL1NWRzExL2ZlYXR1cmUjQmFzaWNTdHJ1Y3R1cmUnLCAnMS4xJyApO1xuXHR9KCk7XG5cblx0dmFyIGNvbmZpZ19uYW1lc3BhY2VzID0ge1xuXHRcdGh0bWw6ICdodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hodG1sJyxcblx0XHRtYXRobWw6ICdodHRwOi8vd3d3LnczLm9yZy8xOTk4L01hdGgvTWF0aE1MJyxcblx0XHRzdmc6ICdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZycsXG5cdFx0eGxpbms6ICdodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rJyxcblx0XHR4bWw6ICdodHRwOi8vd3d3LnczLm9yZy9YTUwvMTk5OC9uYW1lc3BhY2UnLFxuXHRcdHhtbG5zOiAnaHR0cDovL3d3dy53My5vcmcvMjAwMC94bWxucy8nXG5cdH07XG5cblx0dmFyIHV0aWxzX2NyZWF0ZUVsZW1lbnQgPSBmdW5jdGlvbiggc3ZnLCBuYW1lc3BhY2VzICkge1xuXG5cdFx0aWYgKCAhc3ZnICkge1xuXHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCB0eXBlLCBucyApIHtcblx0XHRcdFx0aWYgKCBucyAmJiBucyAhPT0gbmFtZXNwYWNlcy5odG1sICkge1xuXHRcdFx0XHRcdHRocm93ICdUaGlzIGJyb3dzZXIgZG9lcyBub3Qgc3VwcG9ydCBuYW1lc3BhY2VzIG90aGVyIHRoYW4gaHR0cDovL3d3dy53My5vcmcvMTk5OS94aHRtbC4gVGhlIG1vc3QgbGlrZWx5IGNhdXNlIG9mIHRoaXMgZXJyb3IgaXMgdGhhdCB5b3VcXCdyZSB0cnlpbmcgdG8gcmVuZGVyIFNWRyBpbiBhbiBvbGRlciBicm93c2VyLiBTZWUgaHR0cDovL2RvY3MucmFjdGl2ZWpzLm9yZy9sYXRlc3Qvc3ZnLWFuZC1vbGRlci1icm93c2VycyBmb3IgbW9yZSBpbmZvcm1hdGlvbic7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoIHR5cGUgKTtcblx0XHRcdH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBmdW5jdGlvbiggdHlwZSwgbnMgKSB7XG5cdFx0XHRcdGlmICggIW5zICkge1xuXHRcdFx0XHRcdHJldHVybiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCB0eXBlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyggbnMsIHR5cGUgKTtcblx0XHRcdH07XG5cdFx0fVxuXHR9KCBjb25maWdfc3ZnLCBjb25maWdfbmFtZXNwYWNlcyApO1xuXG5cdHZhciBjb25maWdfaXNDbGllbnQgPSB0eXBlb2YgZG9jdW1lbnQgPT09ICdvYmplY3QnO1xuXG5cdHZhciB1dGlsc19kZWZpbmVQcm9wZXJ0eSA9IGZ1bmN0aW9uKCBpc0NsaWVudCApIHtcblxuXHRcdHRyeSB7XG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoIHt9LCAndGVzdCcsIHtcblx0XHRcdFx0dmFsdWU6IDBcblx0XHRcdH0gKTtcblx0XHRcdGlmICggaXNDbGllbnQgKSB7XG5cdFx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eSggZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKSwgJ3Rlc3QnLCB7XG5cdFx0XHRcdFx0dmFsdWU6IDBcblx0XHRcdFx0fSApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIE9iamVjdC5kZWZpbmVQcm9wZXJ0eTtcblx0XHR9IGNhdGNoICggZXJyICkge1xuXHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCBvYmosIHByb3AsIGRlc2MgKSB7XG5cdFx0XHRcdG9ialsgcHJvcCBdID0gZGVzYy52YWx1ZTtcblx0XHRcdH07XG5cdFx0fVxuXHR9KCBjb25maWdfaXNDbGllbnQgKTtcblxuXHR2YXIgdXRpbHNfZGVmaW5lUHJvcGVydGllcyA9IGZ1bmN0aW9uKCBjcmVhdGVFbGVtZW50LCBkZWZpbmVQcm9wZXJ0eSwgaXNDbGllbnQgKSB7XG5cblx0XHR0cnkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnRpZXMoIHt9LCB7XG5cdFx0XHRcdFx0dGVzdDoge1xuXHRcdFx0XHRcdFx0dmFsdWU6IDBcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gKTtcblx0XHRcdH0gY2F0Y2ggKCBlcnIgKSB7XG5cdFx0XHRcdHRocm93IGVycjtcblx0XHRcdH1cblx0XHRcdGlmICggaXNDbGllbnQgKSB7XG5cdFx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKCBjcmVhdGVFbGVtZW50KCAnZGl2JyApLCB7XG5cdFx0XHRcdFx0dGVzdDoge1xuXHRcdFx0XHRcdFx0dmFsdWU6IDBcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBPYmplY3QuZGVmaW5lUHJvcGVydGllcztcblx0XHR9IGNhdGNoICggZXJyICkge1xuXHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCBvYmosIHByb3BzICkge1xuXHRcdFx0XHR2YXIgcHJvcDtcblx0XHRcdFx0Zm9yICggcHJvcCBpbiBwcm9wcyApIHtcblx0XHRcdFx0XHRpZiAoIHByb3BzLmhhc093blByb3BlcnR5KCBwcm9wICkgKSB7XG5cdFx0XHRcdFx0XHRkZWZpbmVQcm9wZXJ0eSggb2JqLCBwcm9wLCBwcm9wc1sgcHJvcCBdICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdH1cblx0fSggdXRpbHNfY3JlYXRlRWxlbWVudCwgdXRpbHNfZGVmaW5lUHJvcGVydHksIGNvbmZpZ19pc0NsaWVudCApO1xuXG5cdHZhciB1dGlsc19pc051bWVyaWMgPSBmdW5jdGlvbiggdGhpbmcgKSB7XG5cdFx0cmV0dXJuICFpc05hTiggcGFyc2VGbG9hdCggdGhpbmcgKSApICYmIGlzRmluaXRlKCB0aGluZyApO1xuXHR9O1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9zaGFyZWRfYWRkID0gZnVuY3Rpb24oIGlzTnVtZXJpYyApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggcm9vdCwga2V5cGF0aCwgZCApIHtcblx0XHRcdHZhciB2YWx1ZTtcblx0XHRcdGlmICggdHlwZW9mIGtleXBhdGggIT09ICdzdHJpbmcnIHx8ICFpc051bWVyaWMoIGQgKSApIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnQmFkIGFyZ3VtZW50cycgKTtcblx0XHRcdH1cblx0XHRcdHZhbHVlID0gK3Jvb3QuZ2V0KCBrZXlwYXRoICkgfHwgMDtcblx0XHRcdGlmICggIWlzTnVtZXJpYyggdmFsdWUgKSApIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnQ2Fubm90IGFkZCB0byBhIG5vbi1udW1lcmljIHZhbHVlJyApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJvb3Quc2V0KCBrZXlwYXRoLCB2YWx1ZSArIGQgKTtcblx0XHR9O1xuXHR9KCB1dGlsc19pc051bWVyaWMgKTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfYWRkID0gZnVuY3Rpb24oIGFkZCApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbigga2V5cGF0aCwgZCApIHtcblx0XHRcdHJldHVybiBhZGQoIHRoaXMsIGtleXBhdGgsIGQgPT09IHVuZGVmaW5lZCA/IDEgOiArZCApO1xuXHRcdH07XG5cdH0oIFJhY3RpdmVfcHJvdG90eXBlX3NoYXJlZF9hZGQgKTtcblxuXHR2YXIgdXRpbHNfaXNFcXVhbCA9IGZ1bmN0aW9uKCBhLCBiICkge1xuXHRcdGlmICggYSA9PT0gbnVsbCAmJiBiID09PSBudWxsICkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGlmICggdHlwZW9mIGEgPT09ICdvYmplY3QnIHx8IHR5cGVvZiBiID09PSAnb2JqZWN0JyApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIGEgPT09IGI7XG5cdH07XG5cblx0dmFyIHV0aWxzX1Byb21pc2UgPSBmdW5jdGlvbigpIHtcblxuXHRcdHZhciBQcm9taXNlLCBQRU5ESU5HID0ge30sIEZVTEZJTExFRCA9IHt9LCBSRUpFQ1RFRCA9IHt9O1xuXHRcdFByb21pc2UgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XG5cdFx0XHR2YXIgZnVsZmlsbGVkSGFuZGxlcnMgPSBbXSxcblx0XHRcdFx0cmVqZWN0ZWRIYW5kbGVycyA9IFtdLFxuXHRcdFx0XHRzdGF0ZSA9IFBFTkRJTkcsXG5cdFx0XHRcdHJlc3VsdCwgZGlzcGF0Y2hIYW5kbGVycywgbWFrZVJlc29sdmVyLCBmdWxmaWwsIHJlamVjdCwgcHJvbWlzZTtcblx0XHRcdG1ha2VSZXNvbHZlciA9IGZ1bmN0aW9uKCBuZXdTdGF0ZSApIHtcblx0XHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCB2YWx1ZSApIHtcblx0XHRcdFx0XHRpZiAoIHN0YXRlICE9PSBQRU5ESU5HICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXN1bHQgPSB2YWx1ZTtcblx0XHRcdFx0XHRzdGF0ZSA9IG5ld1N0YXRlO1xuXHRcdFx0XHRcdGRpc3BhdGNoSGFuZGxlcnMgPSBtYWtlRGlzcGF0Y2hlciggc3RhdGUgPT09IEZVTEZJTExFRCA/IGZ1bGZpbGxlZEhhbmRsZXJzIDogcmVqZWN0ZWRIYW5kbGVycywgcmVzdWx0ICk7XG5cdFx0XHRcdFx0d2FpdCggZGlzcGF0Y2hIYW5kbGVycyApO1xuXHRcdFx0XHR9O1xuXHRcdFx0fTtcblx0XHRcdGZ1bGZpbCA9IG1ha2VSZXNvbHZlciggRlVMRklMTEVEICk7XG5cdFx0XHRyZWplY3QgPSBtYWtlUmVzb2x2ZXIoIFJFSkVDVEVEICk7XG5cdFx0XHRjYWxsYmFjayggZnVsZmlsLCByZWplY3QgKTtcblx0XHRcdHByb21pc2UgPSB7XG5cdFx0XHRcdHRoZW46IGZ1bmN0aW9uKCBvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCApIHtcblx0XHRcdFx0XHR2YXIgcHJvbWlzZTIgPSBuZXcgUHJvbWlzZSggZnVuY3Rpb24oIGZ1bGZpbCwgcmVqZWN0ICkge1xuXHRcdFx0XHRcdFx0dmFyIHByb2Nlc3NSZXNvbHV0aW9uSGFuZGxlciA9IGZ1bmN0aW9uKCBoYW5kbGVyLCBoYW5kbGVycywgZm9yd2FyZCApIHtcblx0XHRcdFx0XHRcdFx0aWYgKCB0eXBlb2YgaGFuZGxlciA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdFx0XHRcdFx0XHRoYW5kbGVycy5wdXNoKCBmdW5jdGlvbiggcDFyZXN1bHQgKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHR2YXIgeDtcblx0XHRcdFx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHggPSBoYW5kbGVyKCBwMXJlc3VsdCApO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRyZXNvbHZlKCBwcm9taXNlMiwgeCwgZnVsZmlsLCByZWplY3QgKTtcblx0XHRcdFx0XHRcdFx0XHRcdH0gY2F0Y2ggKCBlcnIgKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHJlamVjdCggZXJyICk7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdGhhbmRsZXJzLnB1c2goIGZvcndhcmQgKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdHByb2Nlc3NSZXNvbHV0aW9uSGFuZGxlciggb25GdWxmaWxsZWQsIGZ1bGZpbGxlZEhhbmRsZXJzLCBmdWxmaWwgKTtcblx0XHRcdFx0XHRcdHByb2Nlc3NSZXNvbHV0aW9uSGFuZGxlciggb25SZWplY3RlZCwgcmVqZWN0ZWRIYW5kbGVycywgcmVqZWN0ICk7XG5cdFx0XHRcdFx0XHRpZiAoIHN0YXRlICE9PSBQRU5ESU5HICkge1xuXHRcdFx0XHRcdFx0XHR3YWl0KCBkaXNwYXRjaEhhbmRsZXJzICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdHJldHVybiBwcm9taXNlMjtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHRcdHByb21pc2VbICdjYXRjaCcgXSA9IGZ1bmN0aW9uKCBvblJlamVjdGVkICkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy50aGVuKCBudWxsLCBvblJlamVjdGVkICk7XG5cdFx0XHR9O1xuXHRcdFx0cmV0dXJuIHByb21pc2U7XG5cdFx0fTtcblx0XHRQcm9taXNlLmFsbCA9IGZ1bmN0aW9uKCBwcm9taXNlcyApIHtcblx0XHRcdHJldHVybiBuZXcgUHJvbWlzZSggZnVuY3Rpb24oIGZ1bGZpbCwgcmVqZWN0ICkge1xuXHRcdFx0XHR2YXIgcmVzdWx0ID0gW10sXG5cdFx0XHRcdFx0cGVuZGluZywgaSwgcHJvY2Vzc1Byb21pc2U7XG5cdFx0XHRcdGlmICggIXByb21pc2VzLmxlbmd0aCApIHtcblx0XHRcdFx0XHRmdWxmaWwoIHJlc3VsdCApO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRwcm9jZXNzUHJvbWlzZSA9IGZ1bmN0aW9uKCBpICkge1xuXHRcdFx0XHRcdHByb21pc2VzWyBpIF0udGhlbiggZnVuY3Rpb24oIHZhbHVlICkge1xuXHRcdFx0XHRcdFx0cmVzdWx0WyBpIF0gPSB2YWx1ZTtcblx0XHRcdFx0XHRcdGlmICggIS0tcGVuZGluZyApIHtcblx0XHRcdFx0XHRcdFx0ZnVsZmlsKCByZXN1bHQgKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9LCByZWplY3QgKTtcblx0XHRcdFx0fTtcblx0XHRcdFx0cGVuZGluZyA9IGkgPSBwcm9taXNlcy5sZW5ndGg7XG5cdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdHByb2Nlc3NQcm9taXNlKCBpICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHR9O1xuXHRcdFByb21pc2UucmVzb2x2ZSA9IGZ1bmN0aW9uKCB2YWx1ZSApIHtcblx0XHRcdHJldHVybiBuZXcgUHJvbWlzZSggZnVuY3Rpb24oIGZ1bGZpbCApIHtcblx0XHRcdFx0ZnVsZmlsKCB2YWx1ZSApO1xuXHRcdFx0fSApO1xuXHRcdH07XG5cdFx0UHJvbWlzZS5yZWplY3QgPSBmdW5jdGlvbiggcmVhc29uICkge1xuXHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlKCBmdW5jdGlvbiggZnVsZmlsLCByZWplY3QgKSB7XG5cdFx0XHRcdHJlamVjdCggcmVhc29uICk7XG5cdFx0XHR9ICk7XG5cdFx0fTtcblx0XHRyZXR1cm4gUHJvbWlzZTtcblxuXHRcdGZ1bmN0aW9uIHdhaXQoIGNhbGxiYWNrICkge1xuXHRcdFx0c2V0VGltZW91dCggY2FsbGJhY2ssIDAgKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBtYWtlRGlzcGF0Y2hlciggaGFuZGxlcnMsIHJlc3VsdCApIHtcblx0XHRcdHJldHVybiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIGhhbmRsZXI7XG5cdFx0XHRcdHdoaWxlICggaGFuZGxlciA9IGhhbmRsZXJzLnNoaWZ0KCkgKSB7XG5cdFx0XHRcdFx0aGFuZGxlciggcmVzdWx0ICk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gcmVzb2x2ZSggcHJvbWlzZSwgeCwgZnVsZmlsLCByZWplY3QgKSB7XG5cdFx0XHR2YXIgdGhlbjtcblx0XHRcdGlmICggeCA9PT0gcHJvbWlzZSApIHtcblx0XHRcdFx0dGhyb3cgbmV3IFR5cGVFcnJvciggJ0EgcHJvbWlzZVxcJ3MgZnVsZmlsbG1lbnQgaGFuZGxlciBjYW5ub3QgcmV0dXJuIHRoZSBzYW1lIHByb21pc2UnICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHggaW5zdGFuY2VvZiBQcm9taXNlICkge1xuXHRcdFx0XHR4LnRoZW4oIGZ1bGZpbCwgcmVqZWN0ICk7XG5cdFx0XHR9IGVsc2UgaWYgKCB4ICYmICggdHlwZW9mIHggPT09ICdvYmplY3QnIHx8IHR5cGVvZiB4ID09PSAnZnVuY3Rpb24nICkgKSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0dGhlbiA9IHgudGhlbjtcblx0XHRcdFx0fSBjYXRjaCAoIGUgKSB7XG5cdFx0XHRcdFx0cmVqZWN0KCBlICk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggdHlwZW9mIHRoZW4gPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRcdFx0dmFyIGNhbGxlZCwgcmVzb2x2ZVByb21pc2UsIHJlamVjdFByb21pc2U7XG5cdFx0XHRcdFx0cmVzb2x2ZVByb21pc2UgPSBmdW5jdGlvbiggeSApIHtcblx0XHRcdFx0XHRcdGlmICggY2FsbGVkICkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjYWxsZWQgPSB0cnVlO1xuXHRcdFx0XHRcdFx0cmVzb2x2ZSggcHJvbWlzZSwgeSwgZnVsZmlsLCByZWplY3QgKTtcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdHJlamVjdFByb21pc2UgPSBmdW5jdGlvbiggciApIHtcblx0XHRcdFx0XHRcdGlmICggY2FsbGVkICkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjYWxsZWQgPSB0cnVlO1xuXHRcdFx0XHRcdFx0cmVqZWN0KCByICk7XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0dGhlbi5jYWxsKCB4LCByZXNvbHZlUHJvbWlzZSwgcmVqZWN0UHJvbWlzZSApO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKCBlICkge1xuXHRcdFx0XHRcdFx0aWYgKCAhY2FsbGVkICkge1xuXHRcdFx0XHRcdFx0XHRyZWplY3QoIGUgKTtcblx0XHRcdFx0XHRcdFx0Y2FsbGVkID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRmdWxmaWwoIHggKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZnVsZmlsKCB4ICk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KCk7XG5cblx0dmFyIHV0aWxzX25vcm1hbGlzZUtleXBhdGggPSBmdW5jdGlvbigpIHtcblxuXHRcdHZhciByZWdleCA9IC9cXFtcXHMqKFxcKnxbMC05XXxbMS05XVswLTldKylcXHMqXFxdL2c7XG5cdFx0cmV0dXJuIGZ1bmN0aW9uIG5vcm1hbGlzZUtleXBhdGgoIGtleXBhdGggKSB7XG5cdFx0XHRyZXR1cm4gKCBrZXlwYXRoIHx8ICcnICkucmVwbGFjZSggcmVnZXgsICcuJDEnICk7XG5cdFx0fTtcblx0fSgpO1xuXG5cdHZhciBjb25maWdfdmVuZG9ycyA9IFtcblx0XHQnbycsXG5cdFx0J21zJyxcblx0XHQnbW96Jyxcblx0XHQnd2Via2l0J1xuXHRdO1xuXG5cdHZhciB1dGlsc19yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSBmdW5jdGlvbiggdmVuZG9ycyApIHtcblxuXHRcdGlmICggdHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdCggZnVuY3Rpb24oIHZlbmRvcnMsIGxhc3RUaW1lLCB3aW5kb3cgKSB7XG5cdFx0XHR2YXIgeCwgc2V0VGltZW91dDtcblx0XHRcdGlmICggd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Zm9yICggeCA9IDA7IHggPCB2ZW5kb3JzLmxlbmd0aCAmJiAhd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZTsgKyt4ICkge1xuXHRcdFx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gd2luZG93WyB2ZW5kb3JzWyB4IF0gKyAnUmVxdWVzdEFuaW1hdGlvbkZyYW1lJyBdO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSApIHtcblx0XHRcdFx0c2V0VGltZW91dCA9IHdpbmRvdy5zZXRUaW1lb3V0O1xuXHRcdFx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gZnVuY3Rpb24oIGNhbGxiYWNrICkge1xuXHRcdFx0XHRcdHZhciBjdXJyVGltZSwgdGltZVRvQ2FsbCwgaWQ7XG5cdFx0XHRcdFx0Y3VyclRpbWUgPSBEYXRlLm5vdygpO1xuXHRcdFx0XHRcdHRpbWVUb0NhbGwgPSBNYXRoLm1heCggMCwgMTYgLSAoIGN1cnJUaW1lIC0gbGFzdFRpbWUgKSApO1xuXHRcdFx0XHRcdGlkID0gc2V0VGltZW91dCggZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRjYWxsYmFjayggY3VyclRpbWUgKyB0aW1lVG9DYWxsICk7XG5cdFx0XHRcdFx0fSwgdGltZVRvQ2FsbCApO1xuXHRcdFx0XHRcdGxhc3RUaW1lID0gY3VyclRpbWUgKyB0aW1lVG9DYWxsO1xuXHRcdFx0XHRcdHJldHVybiBpZDtcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9KCB2ZW5kb3JzLCAwLCB3aW5kb3cgKSApO1xuXHRcdHJldHVybiB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lO1xuXHR9KCBjb25maWdfdmVuZG9ycyApO1xuXG5cdHZhciB1dGlsc19nZXRUaW1lID0gZnVuY3Rpb24oKSB7XG5cblx0XHRpZiAoIHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHdpbmRvdy5wZXJmb3JtYW5jZSAmJiB0eXBlb2Ygd2luZG93LnBlcmZvcm1hbmNlLm5vdyA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdHJldHVybiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHdpbmRvdy5wZXJmb3JtYW5jZS5ub3coKTtcblx0XHRcdH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIERhdGUubm93KCk7XG5cdFx0XHR9O1xuXHRcdH1cblx0fSgpO1xuXG5cdC8vIFRoaXMgbW9kdWxlIHByb3ZpZGVzIGEgcGxhY2UgdG8gc3RvcmUgYSkgY2lyY3VsYXIgZGVwZW5kZW5jaWVzIGFuZFxuXHQvLyBiKSB0aGUgY2FsbGJhY2sgZnVuY3Rpb25zIHRoYXQgcmVxdWlyZSB0aG9zZSBjaXJjdWxhciBkZXBlbmRlbmNpZXNcblx0dmFyIGNpcmN1bGFyID0gW107XG5cblx0dmFyIHV0aWxzX3JlbW92ZUZyb21BcnJheSA9IGZ1bmN0aW9uKCBhcnJheSwgbWVtYmVyICkge1xuXHRcdHZhciBpbmRleCA9IGFycmF5LmluZGV4T2YoIG1lbWJlciApO1xuXHRcdGlmICggaW5kZXggIT09IC0xICkge1xuXHRcdFx0YXJyYXkuc3BsaWNlKCBpbmRleCwgMSApO1xuXHRcdH1cblx0fTtcblxuXHR2YXIgZ2xvYmFsX2NzcyA9IGZ1bmN0aW9uKCBjaXJjdWxhciwgaXNDbGllbnQsIHJlbW92ZUZyb21BcnJheSApIHtcblxuXHRcdHZhciBydW5sb29wLCBzdHlsZUVsZW1lbnQsIGhlYWQsIHN0eWxlU2hlZXQsIGluRG9tLCBwcmVmaXggPSAnLyogUmFjdGl2ZS5qcyBjb21wb25lbnQgc3R5bGVzICovXFxuJyxcblx0XHRcdGNvbXBvbmVudHNJblBhZ2UgPSB7fSwgc3R5bGVzID0gW107XG5cdFx0aWYgKCAhaXNDbGllbnQgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNpcmN1bGFyLnB1c2goIGZ1bmN0aW9uKCkge1xuXHRcdFx0cnVubG9vcCA9IGNpcmN1bGFyLnJ1bmxvb3A7XG5cdFx0fSApO1xuXHRcdHN0eWxlRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdzdHlsZScgKTtcblx0XHRzdHlsZUVsZW1lbnQudHlwZSA9ICd0ZXh0L2Nzcyc7XG5cdFx0aGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCAnaGVhZCcgKVsgMCBdO1xuXHRcdGluRG9tID0gZmFsc2U7XG5cdFx0c3R5bGVTaGVldCA9IHN0eWxlRWxlbWVudC5zdHlsZVNoZWV0O1xuXHRcdHJldHVybiB7XG5cdFx0XHRhZGQ6IGZ1bmN0aW9uKCBDb21wb25lbnQgKSB7XG5cdFx0XHRcdGlmICggIUNvbXBvbmVudC5jc3MgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggIWNvbXBvbmVudHNJblBhZ2VbIENvbXBvbmVudC5fZ3VpZCBdICkge1xuXHRcdFx0XHRcdGNvbXBvbmVudHNJblBhZ2VbIENvbXBvbmVudC5fZ3VpZCBdID0gMDtcblx0XHRcdFx0XHRzdHlsZXMucHVzaCggQ29tcG9uZW50LmNzcyApO1xuXHRcdFx0XHRcdHJ1bmxvb3Auc2NoZWR1bGVDc3NVcGRhdGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb21wb25lbnRzSW5QYWdlWyBDb21wb25lbnQuX2d1aWQgXSArPSAxO1xuXHRcdFx0fSxcblx0XHRcdHJlbW92ZTogZnVuY3Rpb24oIENvbXBvbmVudCApIHtcblx0XHRcdFx0aWYgKCAhQ29tcG9uZW50LmNzcyApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29tcG9uZW50c0luUGFnZVsgQ29tcG9uZW50Ll9ndWlkIF0gLT0gMTtcblx0XHRcdFx0aWYgKCAhY29tcG9uZW50c0luUGFnZVsgQ29tcG9uZW50Ll9ndWlkIF0gKSB7XG5cdFx0XHRcdFx0cmVtb3ZlRnJvbUFycmF5KCBzdHlsZXMsIENvbXBvbmVudC5jc3MgKTtcblx0XHRcdFx0XHRydW5sb29wLnNjaGVkdWxlQ3NzVXBkYXRlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHR1cGRhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgY3NzO1xuXHRcdFx0XHRpZiAoIHN0eWxlcy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0Y3NzID0gcHJlZml4ICsgc3R5bGVzLmpvaW4oICcgJyApO1xuXHRcdFx0XHRcdGlmICggc3R5bGVTaGVldCApIHtcblx0XHRcdFx0XHRcdHN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzcztcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0c3R5bGVFbGVtZW50LmlubmVySFRNTCA9IGNzcztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCAhaW5Eb20gKSB7XG5cdFx0XHRcdFx0XHRoZWFkLmFwcGVuZENoaWxkKCBzdHlsZUVsZW1lbnQgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSBpZiAoIGluRG9tICkge1xuXHRcdFx0XHRcdGhlYWQucmVtb3ZlQ2hpbGQoIHN0eWxlRWxlbWVudCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0fSggY2lyY3VsYXIsIGNvbmZpZ19pc0NsaWVudCwgdXRpbHNfcmVtb3ZlRnJvbUFycmF5ICk7XG5cblx0dmFyIHNoYXJlZF9nZXRWYWx1ZUZyb21DaGVja2JveGVzID0gZnVuY3Rpb24oIHJhY3RpdmUsIGtleXBhdGggKSB7XG5cdFx0dmFyIHZhbHVlLCBjaGVja2JveGVzLCBjaGVja2JveCwgbGVuLCBpLCByb290RWw7XG5cdFx0dmFsdWUgPSBbXTtcblx0XHRyb290RWwgPSByYWN0aXZlLl9yZW5kZXJpbmcgPyByYWN0aXZlLmZyYWdtZW50LmRvY0ZyYWcgOiByYWN0aXZlLmVsO1xuXHRcdGNoZWNrYm94ZXMgPSByb290RWwucXVlcnlTZWxlY3RvckFsbCggJ2lucHV0W3R5cGU9XCJjaGVja2JveFwiXVtuYW1lPVwie3snICsga2V5cGF0aCArICd9fVwiXScgKTtcblx0XHRsZW4gPSBjaGVja2JveGVzLmxlbmd0aDtcblx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0Y2hlY2tib3ggPSBjaGVja2JveGVzWyBpIF07XG5cdFx0XHRpZiAoIGNoZWNrYm94Lmhhc0F0dHJpYnV0ZSggJ2NoZWNrZWQnICkgfHwgY2hlY2tib3guY2hlY2tlZCApIHtcblx0XHRcdFx0dmFsdWUucHVzaCggY2hlY2tib3guX3JhY3RpdmUudmFsdWUgKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHZhbHVlO1xuXHR9O1xuXG5cdHZhciB1dGlsc19oYXNPd25Qcm9wZXJ0eSA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cblx0dmFyIHNoYXJlZF9nZXRJbm5lckNvbnRleHQgPSBmdW5jdGlvbiggZnJhZ21lbnQgKSB7XG5cdFx0ZG8ge1xuXHRcdFx0aWYgKCBmcmFnbWVudC5jb250ZXh0ICkge1xuXHRcdFx0XHRyZXR1cm4gZnJhZ21lbnQuY29udGV4dDtcblx0XHRcdH1cblx0XHR9IHdoaWxlICggZnJhZ21lbnQgPSBmcmFnbWVudC5wYXJlbnQgKTtcblx0XHRyZXR1cm4gJyc7XG5cdH07XG5cblx0dmFyIHNoYXJlZF9yZXNvbHZlUmVmID0gZnVuY3Rpb24oIGNpcmN1bGFyLCBub3JtYWxpc2VLZXlwYXRoLCBoYXNPd25Qcm9wZXJ0eSwgZ2V0SW5uZXJDb250ZXh0ICkge1xuXG5cdFx0dmFyIGdldCwgYW5jZXN0b3JFcnJvck1lc3NhZ2UgPSAnQ291bGQgbm90IHJlc29sdmUgcmVmZXJlbmNlIC0gdG9vIG1hbnkgXCIuLi9cIiBwcmVmaXhlcyc7XG5cdFx0Y2lyY3VsYXIucHVzaCggZnVuY3Rpb24oKSB7XG5cdFx0XHRnZXQgPSBjaXJjdWxhci5nZXQ7XG5cdFx0fSApO1xuXHRcdHJldHVybiBmdW5jdGlvbiByZXNvbHZlUmVmKCByYWN0aXZlLCByZWYsIGZyYWdtZW50ICkge1xuXHRcdFx0dmFyIGNvbnRleHQsIGNvbnRleHRLZXlzLCBrZXlzLCBsYXN0S2V5LCBwb3N0Zml4LCBwYXJlbnRLZXlwYXRoLCBwYXJlbnRWYWx1ZSwgd3JhcHBlZDtcblx0XHRcdHJlZiA9IG5vcm1hbGlzZUtleXBhdGgoIHJlZiApO1xuXHRcdFx0aWYgKCByZWYgPT09ICcuJyApIHtcblx0XHRcdFx0cmV0dXJuIGdldElubmVyQ29udGV4dCggZnJhZ21lbnQgKTtcblx0XHRcdH1cblx0XHRcdGlmICggcmVmLmNoYXJBdCggMCApID09PSAnLicgKSB7XG5cdFx0XHRcdGNvbnRleHQgPSBnZXRJbm5lckNvbnRleHQoIGZyYWdtZW50ICk7XG5cdFx0XHRcdGNvbnRleHRLZXlzID0gY29udGV4dCA/IGNvbnRleHQuc3BsaXQoICcuJyApIDogW107XG5cdFx0XHRcdGlmICggcmVmLnN1YnN0ciggMCwgMyApID09PSAnLi4vJyApIHtcblx0XHRcdFx0XHR3aGlsZSAoIHJlZi5zdWJzdHIoIDAsIDMgKSA9PT0gJy4uLycgKSB7XG5cdFx0XHRcdFx0XHRpZiAoICFjb250ZXh0S2V5cy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggYW5jZXN0b3JFcnJvck1lc3NhZ2UgKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNvbnRleHRLZXlzLnBvcCgpO1xuXHRcdFx0XHRcdFx0cmVmID0gcmVmLnN1YnN0cmluZyggMyApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb250ZXh0S2V5cy5wdXNoKCByZWYgKTtcblx0XHRcdFx0XHRyZXR1cm4gY29udGV4dEtleXMuam9pbiggJy4nICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCAhY29udGV4dCApIHtcblx0XHRcdFx0XHRyZXR1cm4gcmVmLnN1YnN0cmluZyggMSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBjb250ZXh0ICsgcmVmO1xuXHRcdFx0fVxuXHRcdFx0a2V5cyA9IHJlZi5zcGxpdCggJy4nICk7XG5cdFx0XHRsYXN0S2V5ID0ga2V5cy5wb3AoKTtcblx0XHRcdHBvc3RmaXggPSBrZXlzLmxlbmd0aCA/ICcuJyArIGtleXMuam9pbiggJy4nICkgOiAnJztcblx0XHRcdGRvIHtcblx0XHRcdFx0Y29udGV4dCA9IGZyYWdtZW50LmNvbnRleHQ7XG5cdFx0XHRcdGlmICggIWNvbnRleHQgKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0cGFyZW50S2V5cGF0aCA9IGNvbnRleHQgKyBwb3N0Zml4O1xuXHRcdFx0XHRwYXJlbnRWYWx1ZSA9IGdldCggcmFjdGl2ZSwgcGFyZW50S2V5cGF0aCApO1xuXHRcdFx0XHRpZiAoIHdyYXBwZWQgPSByYWN0aXZlLl93cmFwcGVkWyBwYXJlbnRLZXlwYXRoIF0gKSB7XG5cdFx0XHRcdFx0cGFyZW50VmFsdWUgPSB3cmFwcGVkLmdldCgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggcGFyZW50VmFsdWUgJiYgKCB0eXBlb2YgcGFyZW50VmFsdWUgPT09ICdvYmplY3QnIHx8IHR5cGVvZiBwYXJlbnRWYWx1ZSA9PT0gJ2Z1bmN0aW9uJyApICYmIGxhc3RLZXkgaW4gcGFyZW50VmFsdWUgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGNvbnRleHQgKyAnLicgKyByZWY7XG5cdFx0XHRcdH1cblx0XHRcdH0gd2hpbGUgKCBmcmFnbWVudCA9IGZyYWdtZW50LnBhcmVudCApO1xuXHRcdFx0aWYgKCBoYXNPd25Qcm9wZXJ0eS5jYWxsKCByYWN0aXZlLmRhdGEsIHJlZiApICkge1xuXHRcdFx0XHRyZXR1cm4gcmVmO1xuXHRcdFx0fSBlbHNlIGlmICggZ2V0KCByYWN0aXZlLCByZWYgKSAhPT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRyZXR1cm4gcmVmO1xuXHRcdFx0fVxuXHRcdH07XG5cdH0oIGNpcmN1bGFyLCB1dGlsc19ub3JtYWxpc2VLZXlwYXRoLCB1dGlsc19oYXNPd25Qcm9wZXJ0eSwgc2hhcmVkX2dldElubmVyQ29udGV4dCApO1xuXG5cdHZhciBzaGFyZWRfZ2V0VXBzdHJlYW1DaGFuZ2VzID0gZnVuY3Rpb24gZ2V0VXBzdHJlYW1DaGFuZ2VzKCBjaGFuZ2VzICkge1xuXHRcdHZhciB1cHN0cmVhbUNoYW5nZXMgPSBbICcnIF0sXG5cdFx0XHRpLCBrZXlwYXRoLCBrZXlzLCB1cHN0cmVhbUtleXBhdGg7XG5cdFx0aSA9IGNoYW5nZXMubGVuZ3RoO1xuXHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0a2V5cGF0aCA9IGNoYW5nZXNbIGkgXTtcblx0XHRcdGtleXMgPSBrZXlwYXRoLnNwbGl0KCAnLicgKTtcblx0XHRcdHdoaWxlICgga2V5cy5sZW5ndGggPiAxICkge1xuXHRcdFx0XHRrZXlzLnBvcCgpO1xuXHRcdFx0XHR1cHN0cmVhbUtleXBhdGggPSBrZXlzLmpvaW4oICcuJyApO1xuXHRcdFx0XHRpZiAoIHVwc3RyZWFtQ2hhbmdlc1sgdXBzdHJlYW1LZXlwYXRoIF0gIT09IHRydWUgKSB7XG5cdFx0XHRcdFx0dXBzdHJlYW1DaGFuZ2VzLnB1c2goIHVwc3RyZWFtS2V5cGF0aCApO1xuXHRcdFx0XHRcdHVwc3RyZWFtQ2hhbmdlc1sgdXBzdHJlYW1LZXlwYXRoIF0gPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB1cHN0cmVhbUNoYW5nZXM7XG5cdH07XG5cblx0dmFyIHNoYXJlZF9ub3RpZnlEZXBlbmRhbnRzID0gZnVuY3Rpb24oKSB7XG5cblx0XHR2YXIgbGFzdEtleSwgc3Rhck1hcHMgPSB7fTtcblx0XHRsYXN0S2V5ID0gL1teXFwuXSskLztcblxuXHRcdGZ1bmN0aW9uIG5vdGlmeURlcGVuZGFudHMoIHJhY3RpdmUsIGtleXBhdGgsIG9ubHlEaXJlY3QgKSB7XG5cdFx0XHR2YXIgaTtcblx0XHRcdGlmICggcmFjdGl2ZS5fcGF0dGVybk9ic2VydmVycy5sZW5ndGggKSB7XG5cdFx0XHRcdG5vdGlmeVBhdHRlcm5PYnNlcnZlcnMoIHJhY3RpdmUsIGtleXBhdGgsIGtleXBhdGgsIG9ubHlEaXJlY3QsIHRydWUgKTtcblx0XHRcdH1cblx0XHRcdGZvciAoIGkgPSAwOyBpIDwgcmFjdGl2ZS5fZGVwcy5sZW5ndGg7IGkgKz0gMSApIHtcblx0XHRcdFx0bm90aWZ5RGVwZW5kYW50c0F0UHJpb3JpdHkoIHJhY3RpdmUsIGtleXBhdGgsIGksIG9ubHlEaXJlY3QgKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0bm90aWZ5RGVwZW5kYW50cy5tdWx0aXBsZSA9IGZ1bmN0aW9uIG5vdGlmeU11bHRpcGxlRGVwZW5kYW50cyggcmFjdGl2ZSwga2V5cGF0aHMsIG9ubHlEaXJlY3QgKSB7XG5cdFx0XHR2YXIgaSwgaiwgbGVuO1xuXHRcdFx0bGVuID0ga2V5cGF0aHMubGVuZ3RoO1xuXHRcdFx0aWYgKCByYWN0aXZlLl9wYXR0ZXJuT2JzZXJ2ZXJzLmxlbmd0aCApIHtcblx0XHRcdFx0aSA9IGxlbjtcblx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0bm90aWZ5UGF0dGVybk9ic2VydmVycyggcmFjdGl2ZSwga2V5cGF0aHNbIGkgXSwga2V5cGF0aHNbIGkgXSwgb25seURpcmVjdCwgdHJ1ZSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRmb3IgKCBpID0gMDsgaSA8IHJhY3RpdmUuX2RlcHMubGVuZ3RoOyBpICs9IDEgKSB7XG5cdFx0XHRcdGlmICggcmFjdGl2ZS5fZGVwc1sgaSBdICkge1xuXHRcdFx0XHRcdGogPSBsZW47XG5cdFx0XHRcdFx0d2hpbGUgKCBqLS0gKSB7XG5cdFx0XHRcdFx0XHRub3RpZnlEZXBlbmRhbnRzQXRQcmlvcml0eSggcmFjdGl2ZSwga2V5cGF0aHNbIGogXSwgaSwgb25seURpcmVjdCApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIG5vdGlmeURlcGVuZGFudHM7XG5cblx0XHRmdW5jdGlvbiBub3RpZnlEZXBlbmRhbnRzQXRQcmlvcml0eSggcmFjdGl2ZSwga2V5cGF0aCwgcHJpb3JpdHksIG9ubHlEaXJlY3QgKSB7XG5cdFx0XHR2YXIgZGVwc0J5S2V5cGF0aCA9IHJhY3RpdmUuX2RlcHNbIHByaW9yaXR5IF07XG5cdFx0XHRpZiAoICFkZXBzQnlLZXlwYXRoICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR1cGRhdGVBbGwoIGRlcHNCeUtleXBhdGhbIGtleXBhdGggXSApO1xuXHRcdFx0aWYgKCBvbmx5RGlyZWN0ICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjYXNjYWRlKCByYWN0aXZlLl9kZXBzTWFwWyBrZXlwYXRoIF0sIHJhY3RpdmUsIHByaW9yaXR5ICk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gdXBkYXRlQWxsKCBkZXBzICkge1xuXHRcdFx0dmFyIGksIGxlbjtcblx0XHRcdGlmICggZGVwcyApIHtcblx0XHRcdFx0bGVuID0gZGVwcy5sZW5ndGg7XG5cdFx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0ZGVwc1sgaSBdLnVwZGF0ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gY2FzY2FkZSggY2hpbGREZXBzLCByYWN0aXZlLCBwcmlvcml0eSwgb25seURpcmVjdCApIHtcblx0XHRcdHZhciBpO1xuXHRcdFx0aWYgKCBjaGlsZERlcHMgKSB7XG5cdFx0XHRcdGkgPSBjaGlsZERlcHMubGVuZ3RoO1xuXHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRub3RpZnlEZXBlbmRhbnRzQXRQcmlvcml0eSggcmFjdGl2ZSwgY2hpbGREZXBzWyBpIF0sIHByaW9yaXR5LCBvbmx5RGlyZWN0ICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRmdW5jdGlvbiBub3RpZnlQYXR0ZXJuT2JzZXJ2ZXJzKCByYWN0aXZlLCByZWdpc3RlcmVkS2V5cGF0aCwgYWN0dWFsS2V5cGF0aCwgaXNQYXJlbnRPZkNoYW5nZWRLZXlwYXRoLCBpc1RvcExldmVsQ2FsbCApIHtcblx0XHRcdHZhciBpLCBwYXR0ZXJuT2JzZXJ2ZXIsIGNoaWxkcmVuLCBjaGlsZCwga2V5LCBjaGlsZEFjdHVhbEtleXBhdGgsIHBvdGVudGlhbFdpbGRjYXJkTWF0Y2hlcywgY2FzY2FkZTtcblx0XHRcdGkgPSByYWN0aXZlLl9wYXR0ZXJuT2JzZXJ2ZXJzLmxlbmd0aDtcblx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRwYXR0ZXJuT2JzZXJ2ZXIgPSByYWN0aXZlLl9wYXR0ZXJuT2JzZXJ2ZXJzWyBpIF07XG5cdFx0XHRcdGlmICggcGF0dGVybk9ic2VydmVyLnJlZ2V4LnRlc3QoIGFjdHVhbEtleXBhdGggKSApIHtcblx0XHRcdFx0XHRwYXR0ZXJuT2JzZXJ2ZXIudXBkYXRlKCBhY3R1YWxLZXlwYXRoICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICggaXNQYXJlbnRPZkNoYW5nZWRLZXlwYXRoICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjYXNjYWRlID0gZnVuY3Rpb24oIGtleXBhdGggKSB7XG5cdFx0XHRcdGlmICggY2hpbGRyZW4gPSByYWN0aXZlLl9kZXBzTWFwWyBrZXlwYXRoIF0gKSB7XG5cdFx0XHRcdFx0aSA9IGNoaWxkcmVuLmxlbmd0aDtcblx0XHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRcdGNoaWxkID0gY2hpbGRyZW5bIGkgXTtcblx0XHRcdFx0XHRcdGtleSA9IGxhc3RLZXkuZXhlYyggY2hpbGQgKVsgMCBdO1xuXHRcdFx0XHRcdFx0Y2hpbGRBY3R1YWxLZXlwYXRoID0gYWN0dWFsS2V5cGF0aCArICcuJyArIGtleTtcblx0XHRcdFx0XHRcdG5vdGlmeVBhdHRlcm5PYnNlcnZlcnMoIHJhY3RpdmUsIGNoaWxkLCBjaGlsZEFjdHVhbEtleXBhdGggKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHRpZiAoIGlzVG9wTGV2ZWxDYWxsICkge1xuXHRcdFx0XHRwb3RlbnRpYWxXaWxkY2FyZE1hdGNoZXMgPSBnZXRQb3RlbnRpYWxXaWxkY2FyZE1hdGNoZXMoIGFjdHVhbEtleXBhdGggKTtcblx0XHRcdFx0cG90ZW50aWFsV2lsZGNhcmRNYXRjaGVzLmZvckVhY2goIGNhc2NhZGUgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNhc2NhZGUoIHJlZ2lzdGVyZWRLZXlwYXRoICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0UG90ZW50aWFsV2lsZGNhcmRNYXRjaGVzKCBrZXlwYXRoICkge1xuXHRcdFx0dmFyIGtleXMsIHN0YXJNYXAsIG1hcHBlciwgaSwgcmVzdWx0LCB3aWxkY2FyZEtleXBhdGg7XG5cdFx0XHRrZXlzID0ga2V5cGF0aC5zcGxpdCggJy4nICk7XG5cdFx0XHRzdGFyTWFwID0gZ2V0U3Rhck1hcCgga2V5cy5sZW5ndGggKTtcblx0XHRcdHJlc3VsdCA9IFtdO1xuXHRcdFx0bWFwcGVyID0gZnVuY3Rpb24oIHN0YXIsIGkgKSB7XG5cdFx0XHRcdHJldHVybiBzdGFyID8gJyonIDoga2V5c1sgaSBdO1xuXHRcdFx0fTtcblx0XHRcdGkgPSBzdGFyTWFwLmxlbmd0aDtcblx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHR3aWxkY2FyZEtleXBhdGggPSBzdGFyTWFwWyBpIF0ubWFwKCBtYXBwZXIgKS5qb2luKCAnLicgKTtcblx0XHRcdFx0aWYgKCAhcmVzdWx0WyB3aWxkY2FyZEtleXBhdGggXSApIHtcblx0XHRcdFx0XHRyZXN1bHQucHVzaCggd2lsZGNhcmRLZXlwYXRoICk7XG5cdFx0XHRcdFx0cmVzdWx0WyB3aWxkY2FyZEtleXBhdGggXSA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0U3Rhck1hcCggbnVtICkge1xuXHRcdFx0dmFyIG9uZXMgPSAnJyxcblx0XHRcdFx0bWF4LCBiaW5hcnksIHN0YXJNYXAsIG1hcHBlciwgaTtcblx0XHRcdGlmICggIXN0YXJNYXBzWyBudW0gXSApIHtcblx0XHRcdFx0c3Rhck1hcCA9IFtdO1xuXHRcdFx0XHR3aGlsZSAoIG9uZXMubGVuZ3RoIDwgbnVtICkge1xuXHRcdFx0XHRcdG9uZXMgKz0gMTtcblx0XHRcdFx0fVxuXHRcdFx0XHRtYXggPSBwYXJzZUludCggb25lcywgMiApO1xuXHRcdFx0XHRtYXBwZXIgPSBmdW5jdGlvbiggZGlnaXQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGRpZ2l0ID09PSAnMSc7XG5cdFx0XHRcdH07XG5cdFx0XHRcdGZvciAoIGkgPSAwOyBpIDw9IG1heDsgaSArPSAxICkge1xuXHRcdFx0XHRcdGJpbmFyeSA9IGkudG9TdHJpbmcoIDIgKTtcblx0XHRcdFx0XHR3aGlsZSAoIGJpbmFyeS5sZW5ndGggPCBudW0gKSB7XG5cdFx0XHRcdFx0XHRiaW5hcnkgPSAnMCcgKyBiaW5hcnk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHN0YXJNYXBbIGkgXSA9IEFycmF5LnByb3RvdHlwZS5tYXAuY2FsbCggYmluYXJ5LCBtYXBwZXIgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzdGFyTWFwc1sgbnVtIF0gPSBzdGFyTWFwO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHN0YXJNYXBzWyBudW0gXTtcblx0XHR9XG5cdH0oKTtcblxuXHR2YXIgc2hhcmVkX21ha2VUcmFuc2l0aW9uTWFuYWdlciA9IGZ1bmN0aW9uKCByZW1vdmVGcm9tQXJyYXkgKSB7XG5cblx0XHR2YXIgbWFrZVRyYW5zaXRpb25NYW5hZ2VyLCBjaGVja0NvbXBsZXRlLCByZW1vdmUsIGluaXQ7XG5cdFx0bWFrZVRyYW5zaXRpb25NYW5hZ2VyID0gZnVuY3Rpb24oIGNhbGxiYWNrLCBwcmV2aW91cyApIHtcblx0XHRcdHZhciB0cmFuc2l0aW9uTWFuYWdlciA9IFtdO1xuXHRcdFx0dHJhbnNpdGlvbk1hbmFnZXIuZGV0YWNoUXVldWUgPSBbXTtcblx0XHRcdHRyYW5zaXRpb25NYW5hZ2VyLnJlbW92ZSA9IHJlbW92ZTtcblx0XHRcdHRyYW5zaXRpb25NYW5hZ2VyLmluaXQgPSBpbml0O1xuXHRcdFx0dHJhbnNpdGlvbk1hbmFnZXIuX2NoZWNrID0gY2hlY2tDb21wbGV0ZTtcblx0XHRcdHRyYW5zaXRpb25NYW5hZ2VyLl9jYWxsYmFjayA9IGNhbGxiYWNrO1xuXHRcdFx0dHJhbnNpdGlvbk1hbmFnZXIuX3ByZXZpb3VzID0gcHJldmlvdXM7XG5cdFx0XHRpZiAoIHByZXZpb3VzICkge1xuXHRcdFx0XHRwcmV2aW91cy5wdXNoKCB0cmFuc2l0aW9uTWFuYWdlciApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRyYW5zaXRpb25NYW5hZ2VyO1xuXHRcdH07XG5cdFx0Y2hlY2tDb21wbGV0ZSA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIGVsZW1lbnQ7XG5cdFx0XHRpZiAoIHRoaXMuX3JlYWR5ICYmICF0aGlzLmxlbmd0aCApIHtcblx0XHRcdFx0d2hpbGUgKCBlbGVtZW50ID0gdGhpcy5kZXRhY2hRdWV1ZS5wb3AoKSApIHtcblx0XHRcdFx0XHRlbGVtZW50LmRldGFjaCgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggdHlwZW9mIHRoaXMuX2NhbGxiYWNrID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0XHRcdHRoaXMuX2NhbGxiYWNrKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCB0aGlzLl9wcmV2aW91cyApIHtcblx0XHRcdFx0XHR0aGlzLl9wcmV2aW91cy5yZW1vdmUoIHRoaXMgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmVtb3ZlID0gZnVuY3Rpb24oIHRyYW5zaXRpb24gKSB7XG5cdFx0XHRyZW1vdmVGcm9tQXJyYXkoIHRoaXMsIHRyYW5zaXRpb24gKTtcblx0XHRcdHRoaXMuX2NoZWNrKCk7XG5cdFx0fTtcblx0XHRpbml0ID0gZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLl9yZWFkeSA9IHRydWU7XG5cdFx0XHR0aGlzLl9jaGVjaygpO1xuXHRcdH07XG5cdFx0cmV0dXJuIG1ha2VUcmFuc2l0aW9uTWFuYWdlcjtcblx0fSggdXRpbHNfcmVtb3ZlRnJvbUFycmF5ICk7XG5cblx0dmFyIGdsb2JhbF9ydW5sb29wID0gZnVuY3Rpb24oIGNpcmN1bGFyLCBjc3MsIHJlbW92ZUZyb21BcnJheSwgZ2V0VmFsdWVGcm9tQ2hlY2tib3hlcywgcmVzb2x2ZVJlZiwgZ2V0VXBzdHJlYW1DaGFuZ2VzLCBub3RpZnlEZXBlbmRhbnRzLCBtYWtlVHJhbnNpdGlvbk1hbmFnZXIgKSB7XG5cblx0XHRjaXJjdWxhci5wdXNoKCBmdW5jdGlvbigpIHtcblx0XHRcdGdldCA9IGNpcmN1bGFyLmdldDtcblx0XHRcdHNldCA9IGNpcmN1bGFyLnNldDtcblx0XHR9ICk7XG5cdFx0dmFyIHJ1bmxvb3AsIGdldCwgc2V0LCBkaXJ0eSA9IGZhbHNlLFxuXHRcdFx0Zmx1c2hpbmcgPSBmYWxzZSxcblx0XHRcdHBlbmRpbmdDc3NDaGFuZ2VzLCBpbkZsaWdodCA9IDAsXG5cdFx0XHR0b0ZvY3VzID0gbnVsbCxcblx0XHRcdGxpdmVRdWVyaWVzID0gW10sXG5cdFx0XHRkZWNvcmF0b3JzID0gW10sXG5cdFx0XHR0cmFuc2l0aW9ucyA9IFtdLFxuXHRcdFx0b2JzZXJ2ZXJzID0gW10sXG5cdFx0XHRhdHRyaWJ1dGVzID0gW10sXG5cdFx0XHRldmFsdWF0b3JzID0gW10sXG5cdFx0XHRzZWxlY3RWYWx1ZXMgPSBbXSxcblx0XHRcdGNoZWNrYm94S2V5cGF0aHMgPSB7fSwgY2hlY2tib3hlcyA9IFtdLFxuXHRcdFx0cmFkaW9zID0gW10sXG5cdFx0XHR1bnJlc29sdmVkID0gW10sXG5cdFx0XHRpbnN0YW5jZXMgPSBbXSxcblx0XHRcdHRyYW5zaXRpb25NYW5hZ2VyO1xuXHRcdHJ1bmxvb3AgPSB7XG5cdFx0XHRzdGFydDogZnVuY3Rpb24oIGluc3RhbmNlLCBjYWxsYmFjayApIHtcblx0XHRcdFx0aWYgKCBpbnN0YW5jZSAmJiAhaW5zdGFuY2VzWyBpbnN0YW5jZS5fZ3VpZCBdICkge1xuXHRcdFx0XHRcdGluc3RhbmNlcy5wdXNoKCBpbnN0YW5jZSApO1xuXHRcdFx0XHRcdGluc3RhbmNlc1sgaW5zdGFuY2VzLl9ndWlkIF0gPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggIWZsdXNoaW5nICkge1xuXHRcdFx0XHRcdGluRmxpZ2h0ICs9IDE7XG5cdFx0XHRcdFx0dHJhbnNpdGlvbk1hbmFnZXIgPSBtYWtlVHJhbnNpdGlvbk1hbmFnZXIoIGNhbGxiYWNrLCB0cmFuc2l0aW9uTWFuYWdlciApO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0ZW5kOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0aWYgKCBmbHVzaGluZyApIHtcblx0XHRcdFx0XHRhdHRlbXB0S2V5cGF0aFJlc29sdXRpb24oKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCAhLS1pbkZsaWdodCApIHtcblx0XHRcdFx0XHRmbHVzaGluZyA9IHRydWU7XG5cdFx0XHRcdFx0Zmx1c2hDaGFuZ2VzKCk7XG5cdFx0XHRcdFx0Zmx1c2hpbmcgPSBmYWxzZTtcblx0XHRcdFx0XHRsYW5kKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dHJhbnNpdGlvbk1hbmFnZXIuaW5pdCgpO1xuXHRcdFx0XHR0cmFuc2l0aW9uTWFuYWdlciA9IHRyYW5zaXRpb25NYW5hZ2VyLl9wcmV2aW91cztcblx0XHRcdH0sXG5cdFx0XHR0cmlnZ2VyOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0aWYgKCBpbkZsaWdodCB8fCBmbHVzaGluZyApIHtcblx0XHRcdFx0XHRhdHRlbXB0S2V5cGF0aFJlc29sdXRpb24oKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Zmx1c2hpbmcgPSB0cnVlO1xuXHRcdFx0XHRmbHVzaENoYW5nZXMoKTtcblx0XHRcdFx0Zmx1c2hpbmcgPSBmYWxzZTtcblx0XHRcdFx0bGFuZCgpO1xuXHRcdFx0fSxcblx0XHRcdGZvY3VzOiBmdW5jdGlvbiggbm9kZSApIHtcblx0XHRcdFx0dG9Gb2N1cyA9IG5vZGU7XG5cdFx0XHR9LFxuXHRcdFx0YWRkTGl2ZVF1ZXJ5OiBmdW5jdGlvbiggcXVlcnkgKSB7XG5cdFx0XHRcdGxpdmVRdWVyaWVzLnB1c2goIHF1ZXJ5ICk7XG5cdFx0XHR9LFxuXHRcdFx0YWRkRGVjb3JhdG9yOiBmdW5jdGlvbiggZGVjb3JhdG9yICkge1xuXHRcdFx0XHRkZWNvcmF0b3JzLnB1c2goIGRlY29yYXRvciApO1xuXHRcdFx0fSxcblx0XHRcdGFkZFRyYW5zaXRpb246IGZ1bmN0aW9uKCB0cmFuc2l0aW9uICkge1xuXHRcdFx0XHR0cmFuc2l0aW9uLl9tYW5hZ2VyID0gdHJhbnNpdGlvbk1hbmFnZXI7XG5cdFx0XHRcdHRyYW5zaXRpb25NYW5hZ2VyLnB1c2goIHRyYW5zaXRpb24gKTtcblx0XHRcdFx0dHJhbnNpdGlvbnMucHVzaCggdHJhbnNpdGlvbiApO1xuXHRcdFx0fSxcblx0XHRcdGFkZE9ic2VydmVyOiBmdW5jdGlvbiggb2JzZXJ2ZXIgKSB7XG5cdFx0XHRcdG9ic2VydmVycy5wdXNoKCBvYnNlcnZlciApO1xuXHRcdFx0fSxcblx0XHRcdGFkZEF0dHJpYnV0ZTogZnVuY3Rpb24oIGF0dHJpYnV0ZSApIHtcblx0XHRcdFx0YXR0cmlidXRlcy5wdXNoKCBhdHRyaWJ1dGUgKTtcblx0XHRcdH0sXG5cdFx0XHRzY2hlZHVsZUNzc1VwZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmICggIWluRmxpZ2h0ICYmICFmbHVzaGluZyApIHtcblx0XHRcdFx0XHRjc3MudXBkYXRlKCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cGVuZGluZ0Nzc0NoYW5nZXMgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0YWRkRXZhbHVhdG9yOiBmdW5jdGlvbiggZXZhbHVhdG9yICkge1xuXHRcdFx0XHRkaXJ0eSA9IHRydWU7XG5cdFx0XHRcdGV2YWx1YXRvcnMucHVzaCggZXZhbHVhdG9yICk7XG5cdFx0XHR9LFxuXHRcdFx0YWRkU2VsZWN0VmFsdWU6IGZ1bmN0aW9uKCBzZWxlY3RWYWx1ZSApIHtcblx0XHRcdFx0ZGlydHkgPSB0cnVlO1xuXHRcdFx0XHRzZWxlY3RWYWx1ZXMucHVzaCggc2VsZWN0VmFsdWUgKTtcblx0XHRcdH0sXG5cdFx0XHRhZGRDaGVja2JveDogZnVuY3Rpb24oIGNoZWNrYm94ICkge1xuXHRcdFx0XHRpZiAoICFjaGVja2JveEtleXBhdGhzWyBjaGVja2JveC5rZXlwYXRoIF0gKSB7XG5cdFx0XHRcdFx0ZGlydHkgPSB0cnVlO1xuXHRcdFx0XHRcdGNoZWNrYm94ZXMucHVzaCggY2hlY2tib3ggKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGFkZFJhZGlvOiBmdW5jdGlvbiggcmFkaW8gKSB7XG5cdFx0XHRcdGRpcnR5ID0gdHJ1ZTtcblx0XHRcdFx0cmFkaW9zLnB1c2goIHJhZGlvICk7XG5cdFx0XHR9LFxuXHRcdFx0YWRkVW5yZXNvbHZlZDogZnVuY3Rpb24oIHRoaW5nICkge1xuXHRcdFx0XHRkaXJ0eSA9IHRydWU7XG5cdFx0XHRcdHVucmVzb2x2ZWQucHVzaCggdGhpbmcgKTtcblx0XHRcdH0sXG5cdFx0XHRyZW1vdmVVbnJlc29sdmVkOiBmdW5jdGlvbiggdGhpbmcgKSB7XG5cdFx0XHRcdHJlbW92ZUZyb21BcnJheSggdW5yZXNvbHZlZCwgdGhpbmcgKTtcblx0XHRcdH0sXG5cdFx0XHRkZXRhY2hXaGVuUmVhZHk6IGZ1bmN0aW9uKCB0aGluZyApIHtcblx0XHRcdFx0dHJhbnNpdGlvbk1hbmFnZXIuZGV0YWNoUXVldWUucHVzaCggdGhpbmcgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdGNpcmN1bGFyLnJ1bmxvb3AgPSBydW5sb29wO1xuXHRcdHJldHVybiBydW5sb29wO1xuXG5cdFx0ZnVuY3Rpb24gbGFuZCgpIHtcblx0XHRcdHZhciB0aGluZywgY2hhbmdlZEtleXBhdGgsIGNoYW5nZUhhc2g7XG5cdFx0XHRpZiAoIHRvRm9jdXMgKSB7XG5cdFx0XHRcdHRvRm9jdXMuZm9jdXMoKTtcblx0XHRcdFx0dG9Gb2N1cyA9IG51bGw7XG5cdFx0XHR9XG5cdFx0XHR3aGlsZSAoIHRoaW5nID0gYXR0cmlidXRlcy5wb3AoKSApIHtcblx0XHRcdFx0dGhpbmcudXBkYXRlKCkuZGVmZXJyZWQgPSBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHdoaWxlICggdGhpbmcgPSBsaXZlUXVlcmllcy5wb3AoKSApIHtcblx0XHRcdFx0dGhpbmcuX3NvcnQoKTtcblx0XHRcdH1cblx0XHRcdHdoaWxlICggdGhpbmcgPSBkZWNvcmF0b3JzLnBvcCgpICkge1xuXHRcdFx0XHR0aGluZy5pbml0KCk7XG5cdFx0XHR9XG5cdFx0XHR3aGlsZSAoIHRoaW5nID0gdHJhbnNpdGlvbnMucG9wKCkgKSB7XG5cdFx0XHRcdHRoaW5nLmluaXQoKTtcblx0XHRcdH1cblx0XHRcdHdoaWxlICggdGhpbmcgPSBvYnNlcnZlcnMucG9wKCkgKSB7XG5cdFx0XHRcdHRoaW5nLnVwZGF0ZSgpO1xuXHRcdFx0fVxuXHRcdFx0d2hpbGUgKCB0aGluZyA9IGluc3RhbmNlcy5wb3AoKSApIHtcblx0XHRcdFx0aW5zdGFuY2VzWyB0aGluZy5fZ3VpZCBdID0gZmFsc2U7XG5cdFx0XHRcdGlmICggdGhpbmcuX2NoYW5nZXMubGVuZ3RoICkge1xuXHRcdFx0XHRcdGNoYW5nZUhhc2ggPSB7fTtcblx0XHRcdFx0XHR3aGlsZSAoIGNoYW5nZWRLZXlwYXRoID0gdGhpbmcuX2NoYW5nZXMucG9wKCkgKSB7XG5cdFx0XHRcdFx0XHRjaGFuZ2VIYXNoWyBjaGFuZ2VkS2V5cGF0aCBdID0gZ2V0KCB0aGluZywgY2hhbmdlZEtleXBhdGggKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGhpbmcuZmlyZSggJ2NoYW5nZScsIGNoYW5nZUhhc2ggKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCBwZW5kaW5nQ3NzQ2hhbmdlcyApIHtcblx0XHRcdFx0Y3NzLnVwZGF0ZSgpO1xuXHRcdFx0XHRwZW5kaW5nQ3NzQ2hhbmdlcyA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGZsdXNoQ2hhbmdlcygpIHtcblx0XHRcdHZhciB0aGluZywgdXBzdHJlYW1DaGFuZ2VzLCBpO1xuXHRcdFx0aSA9IGluc3RhbmNlcy5sZW5ndGg7XG5cdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0dGhpbmcgPSBpbnN0YW5jZXNbIGkgXTtcblx0XHRcdFx0aWYgKCB0aGluZy5fY2hhbmdlcy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0dXBzdHJlYW1DaGFuZ2VzID0gZ2V0VXBzdHJlYW1DaGFuZ2VzKCB0aGluZy5fY2hhbmdlcyApO1xuXHRcdFx0XHRcdG5vdGlmeURlcGVuZGFudHMubXVsdGlwbGUoIHRoaW5nLCB1cHN0cmVhbUNoYW5nZXMsIHRydWUgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0YXR0ZW1wdEtleXBhdGhSZXNvbHV0aW9uKCk7XG5cdFx0XHR3aGlsZSAoIGRpcnR5ICkge1xuXHRcdFx0XHRkaXJ0eSA9IGZhbHNlO1xuXHRcdFx0XHR3aGlsZSAoIHRoaW5nID0gZXZhbHVhdG9ycy5wb3AoKSApIHtcblx0XHRcdFx0XHR0aGluZy51cGRhdGUoKS5kZWZlcnJlZCA9IGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHdoaWxlICggdGhpbmcgPSBzZWxlY3RWYWx1ZXMucG9wKCkgKSB7XG5cdFx0XHRcdFx0dGhpbmcuZGVmZXJyZWRVcGRhdGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR3aGlsZSAoIHRoaW5nID0gY2hlY2tib3hlcy5wb3AoKSApIHtcblx0XHRcdFx0XHRzZXQoIHRoaW5nLnJvb3QsIHRoaW5nLmtleXBhdGgsIGdldFZhbHVlRnJvbUNoZWNrYm94ZXMoIHRoaW5nLnJvb3QsIHRoaW5nLmtleXBhdGggKSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHdoaWxlICggdGhpbmcgPSByYWRpb3MucG9wKCkgKSB7XG5cdFx0XHRcdFx0dGhpbmcudXBkYXRlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRmdW5jdGlvbiBhdHRlbXB0S2V5cGF0aFJlc29sdXRpb24oKSB7XG5cdFx0XHR2YXIgYXJyYXksIHRoaW5nLCBrZXlwYXRoO1xuXHRcdFx0aWYgKCAhdW5yZXNvbHZlZC5sZW5ndGggKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGFycmF5ID0gdW5yZXNvbHZlZC5zcGxpY2UoIDAsIHVucmVzb2x2ZWQubGVuZ3RoICk7XG5cdFx0XHR3aGlsZSAoIHRoaW5nID0gYXJyYXkucG9wKCkgKSB7XG5cdFx0XHRcdGlmICggdGhpbmcua2V5cGF0aCApIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRrZXlwYXRoID0gcmVzb2x2ZVJlZiggdGhpbmcucm9vdCwgdGhpbmcucmVmLCB0aGluZy5wYXJlbnRGcmFnbWVudCApO1xuXHRcdFx0XHRpZiAoIGtleXBhdGggIT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0XHR0aGluZy5yZXNvbHZlKCBrZXlwYXRoICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dW5yZXNvbHZlZC5wdXNoKCB0aGluZyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9KCBjaXJjdWxhciwgZ2xvYmFsX2NzcywgdXRpbHNfcmVtb3ZlRnJvbUFycmF5LCBzaGFyZWRfZ2V0VmFsdWVGcm9tQ2hlY2tib3hlcywgc2hhcmVkX3Jlc29sdmVSZWYsIHNoYXJlZF9nZXRVcHN0cmVhbUNoYW5nZXMsIHNoYXJlZF9ub3RpZnlEZXBlbmRhbnRzLCBzaGFyZWRfbWFrZVRyYW5zaXRpb25NYW5hZ2VyICk7XG5cblx0dmFyIHNoYXJlZF9hbmltYXRpb25zID0gZnVuY3Rpb24oIHJBRiwgZ2V0VGltZSwgcnVubG9vcCApIHtcblxuXHRcdHZhciBxdWV1ZSA9IFtdO1xuXHRcdHZhciBhbmltYXRpb25zID0ge1xuXHRcdFx0dGljazogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBpLCBhbmltYXRpb24sIG5vdztcblx0XHRcdFx0bm93ID0gZ2V0VGltZSgpO1xuXHRcdFx0XHRydW5sb29wLnN0YXJ0KCk7XG5cdFx0XHRcdGZvciAoIGkgPSAwOyBpIDwgcXVldWUubGVuZ3RoOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0YW5pbWF0aW9uID0gcXVldWVbIGkgXTtcblx0XHRcdFx0XHRpZiAoICFhbmltYXRpb24udGljayggbm93ICkgKSB7XG5cdFx0XHRcdFx0XHRxdWV1ZS5zcGxpY2UoIGktLSwgMSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRydW5sb29wLmVuZCgpO1xuXHRcdFx0XHRpZiAoIHF1ZXVlLmxlbmd0aCApIHtcblx0XHRcdFx0XHRyQUYoIGFuaW1hdGlvbnMudGljayApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGFuaW1hdGlvbnMucnVubmluZyA9IGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0YWRkOiBmdW5jdGlvbiggYW5pbWF0aW9uICkge1xuXHRcdFx0XHRxdWV1ZS5wdXNoKCBhbmltYXRpb24gKTtcblx0XHRcdFx0aWYgKCAhYW5pbWF0aW9ucy5ydW5uaW5nICkge1xuXHRcdFx0XHRcdGFuaW1hdGlvbnMucnVubmluZyA9IHRydWU7XG5cdFx0XHRcdFx0ckFGKCBhbmltYXRpb25zLnRpY2sgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGFib3J0OiBmdW5jdGlvbigga2V5cGF0aCwgcm9vdCApIHtcblx0XHRcdFx0dmFyIGkgPSBxdWV1ZS5sZW5ndGgsXG5cdFx0XHRcdFx0YW5pbWF0aW9uO1xuXHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRhbmltYXRpb24gPSBxdWV1ZVsgaSBdO1xuXHRcdFx0XHRcdGlmICggYW5pbWF0aW9uLnJvb3QgPT09IHJvb3QgJiYgYW5pbWF0aW9uLmtleXBhdGggPT09IGtleXBhdGggKSB7XG5cdFx0XHRcdFx0XHRhbmltYXRpb24uc3RvcCgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIGFuaW1hdGlvbnM7XG5cdH0oIHV0aWxzX3JlcXVlc3RBbmltYXRpb25GcmFtZSwgdXRpbHNfZ2V0VGltZSwgZ2xvYmFsX3J1bmxvb3AgKTtcblxuXHR2YXIgdXRpbHNfaXNBcnJheSA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0dmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblx0XHRyZXR1cm4gZnVuY3Rpb24oIHRoaW5nICkge1xuXHRcdFx0cmV0dXJuIHRvU3RyaW5nLmNhbGwoIHRoaW5nICkgPT09ICdbb2JqZWN0IEFycmF5XSc7XG5cdFx0fTtcblx0fSgpO1xuXG5cdHZhciB1dGlsc19jbG9uZSA9IGZ1bmN0aW9uKCBpc0FycmF5ICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBzb3VyY2UgKSB7XG5cdFx0XHR2YXIgdGFyZ2V0LCBrZXk7XG5cdFx0XHRpZiAoICFzb3VyY2UgfHwgdHlwZW9mIHNvdXJjZSAhPT0gJ29iamVjdCcgKSB7XG5cdFx0XHRcdHJldHVybiBzb3VyY2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGlzQXJyYXkoIHNvdXJjZSApICkge1xuXHRcdFx0XHRyZXR1cm4gc291cmNlLnNsaWNlKCk7XG5cdFx0XHR9XG5cdFx0XHR0YXJnZXQgPSB7fTtcblx0XHRcdGZvciAoIGtleSBpbiBzb3VyY2UgKSB7XG5cdFx0XHRcdGlmICggc291cmNlLmhhc093blByb3BlcnR5KCBrZXkgKSApIHtcblx0XHRcdFx0XHR0YXJnZXRbIGtleSBdID0gc291cmNlWyBrZXkgXTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRhcmdldDtcblx0XHR9O1xuXHR9KCB1dGlsc19pc0FycmF5ICk7XG5cblx0dmFyIHJlZ2lzdHJpZXNfYWRhcHRvcnMgPSB7fTtcblxuXHR2YXIgc2hhcmVkX2dldF9hcnJheUFkYXB0b3JfZ2V0U3BsaWNlRXF1aXZhbGVudCA9IGZ1bmN0aW9uKCBhcnJheSwgbWV0aG9kTmFtZSwgYXJncyApIHtcblx0XHRzd2l0Y2ggKCBtZXRob2ROYW1lICkge1xuXHRcdFx0Y2FzZSAnc3BsaWNlJzpcblx0XHRcdFx0cmV0dXJuIGFyZ3M7XG5cdFx0XHRjYXNlICdzb3J0Jzpcblx0XHRcdGNhc2UgJ3JldmVyc2UnOlxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdGNhc2UgJ3BvcCc6XG5cdFx0XHRcdGlmICggYXJyYXkubGVuZ3RoICkge1xuXHRcdFx0XHRcdHJldHVybiBbIC0xIF07XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRjYXNlICdwdXNoJzpcblx0XHRcdFx0cmV0dXJuIFtcblx0XHRcdFx0XHRhcnJheS5sZW5ndGgsXG5cdFx0XHRcdFx0MFxuXHRcdFx0XHRdLmNvbmNhdCggYXJncyApO1xuXHRcdFx0Y2FzZSAnc2hpZnQnOlxuXHRcdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRcdDAsXG5cdFx0XHRcdFx0MVxuXHRcdFx0XHRdO1xuXHRcdFx0Y2FzZSAndW5zaGlmdCc6XG5cdFx0XHRcdHJldHVybiBbXG5cdFx0XHRcdFx0MCxcblx0XHRcdFx0XHQwXG5cdFx0XHRcdF0uY29uY2F0KCBhcmdzICk7XG5cdFx0fVxuXHR9O1xuXG5cdHZhciBzaGFyZWRfZ2V0X2FycmF5QWRhcHRvcl9zdW1tYXJpc2VTcGxpY2VPcGVyYXRpb24gPSBmdW5jdGlvbiggYXJyYXksIGFyZ3MgKSB7XG5cdFx0dmFyIHN0YXJ0LCBhZGRlZEl0ZW1zLCByZW1vdmVkSXRlbXMsIGJhbGFuY2U7XG5cdFx0aWYgKCAhYXJncyApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRzdGFydCA9ICsoIGFyZ3NbIDAgXSA8IDAgPyBhcnJheS5sZW5ndGggKyBhcmdzWyAwIF0gOiBhcmdzWyAwIF0gKTtcblx0XHRhZGRlZEl0ZW1zID0gTWF0aC5tYXgoIDAsIGFyZ3MubGVuZ3RoIC0gMiApO1xuXHRcdHJlbW92ZWRJdGVtcyA9IGFyZ3NbIDEgXSAhPT0gdW5kZWZpbmVkID8gYXJnc1sgMSBdIDogYXJyYXkubGVuZ3RoIC0gc3RhcnQ7XG5cdFx0cmVtb3ZlZEl0ZW1zID0gTWF0aC5taW4oIHJlbW92ZWRJdGVtcywgYXJyYXkubGVuZ3RoIC0gc3RhcnQgKTtcblx0XHRiYWxhbmNlID0gYWRkZWRJdGVtcyAtIHJlbW92ZWRJdGVtcztcblx0XHRyZXR1cm4ge1xuXHRcdFx0c3RhcnQ6IHN0YXJ0LFxuXHRcdFx0YmFsYW5jZTogYmFsYW5jZSxcblx0XHRcdGFkZGVkOiBhZGRlZEl0ZW1zLFxuXHRcdFx0cmVtb3ZlZDogcmVtb3ZlZEl0ZW1zXG5cdFx0fTtcblx0fTtcblxuXHR2YXIgY29uZmlnX3R5cGVzID0ge1xuXHRcdFRFWFQ6IDEsXG5cdFx0SU5URVJQT0xBVE9SOiAyLFxuXHRcdFRSSVBMRTogMyxcblx0XHRTRUNUSU9OOiA0LFxuXHRcdElOVkVSVEVEOiA1LFxuXHRcdENMT1NJTkc6IDYsXG5cdFx0RUxFTUVOVDogNyxcblx0XHRQQVJUSUFMOiA4LFxuXHRcdENPTU1FTlQ6IDksXG5cdFx0REVMSU1DSEFOR0U6IDEwLFxuXHRcdE1VU1RBQ0hFOiAxMSxcblx0XHRUQUc6IDEyLFxuXHRcdEFUVFJJQlVURTogMTMsXG5cdFx0Q09NUE9ORU5UOiAxNSxcblx0XHROVU1CRVJfTElURVJBTDogMjAsXG5cdFx0U1RSSU5HX0xJVEVSQUw6IDIxLFxuXHRcdEFSUkFZX0xJVEVSQUw6IDIyLFxuXHRcdE9CSkVDVF9MSVRFUkFMOiAyMyxcblx0XHRCT09MRUFOX0xJVEVSQUw6IDI0LFxuXHRcdEdMT0JBTDogMjYsXG5cdFx0S0VZX1ZBTFVFX1BBSVI6IDI3LFxuXHRcdFJFRkVSRU5DRTogMzAsXG5cdFx0UkVGSU5FTUVOVDogMzEsXG5cdFx0TUVNQkVSOiAzMixcblx0XHRQUkVGSVhfT1BFUkFUT1I6IDMzLFxuXHRcdEJSQUNLRVRFRDogMzQsXG5cdFx0Q09ORElUSU9OQUw6IDM1LFxuXHRcdElORklYX09QRVJBVE9SOiAzNixcblx0XHRJTlZPQ0FUSU9OOiA0MFxuXHR9O1xuXG5cdHZhciBzaGFyZWRfY2xlYXJDYWNoZSA9IGZ1bmN0aW9uIGNsZWFyQ2FjaGUoIHJhY3RpdmUsIGtleXBhdGgsIGRvbnRUZWFyZG93bldyYXBwZXIgKSB7XG5cdFx0dmFyIGNhY2hlTWFwLCB3cmFwcGVkUHJvcGVydHk7XG5cdFx0aWYgKCAhZG9udFRlYXJkb3duV3JhcHBlciApIHtcblx0XHRcdGlmICggd3JhcHBlZFByb3BlcnR5ID0gcmFjdGl2ZS5fd3JhcHBlZFsga2V5cGF0aCBdICkge1xuXHRcdFx0XHRpZiAoIHdyYXBwZWRQcm9wZXJ0eS50ZWFyZG93bigpICE9PSBmYWxzZSApIHtcblx0XHRcdFx0XHRyYWN0aXZlLl93cmFwcGVkWyBrZXlwYXRoIF0gPSBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJhY3RpdmUuX2NhY2hlWyBrZXlwYXRoIF0gPSB1bmRlZmluZWQ7XG5cdFx0aWYgKCBjYWNoZU1hcCA9IHJhY3RpdmUuX2NhY2hlTWFwWyBrZXlwYXRoIF0gKSB7XG5cdFx0XHR3aGlsZSAoIGNhY2hlTWFwLmxlbmd0aCApIHtcblx0XHRcdFx0Y2xlYXJDYWNoZSggcmFjdGl2ZSwgY2FjaGVNYXAucG9wKCkgKTtcblx0XHRcdH1cblx0XHR9XG5cdH07XG5cblx0dmFyIHV0aWxzX2NyZWF0ZUJyYW5jaCA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0dmFyIG51bWVyaWMgPSAvXlxccypbMC05XStcXHMqJC87XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBrZXkgKSB7XG5cdFx0XHRyZXR1cm4gbnVtZXJpYy50ZXN0KCBrZXkgKSA/IFtdIDoge307XG5cdFx0fTtcblx0fSgpO1xuXG5cdHZhciBzaGFyZWRfc2V0ID0gZnVuY3Rpb24oIGNpcmN1bGFyLCBpc0VxdWFsLCBjcmVhdGVCcmFuY2gsIGNsZWFyQ2FjaGUsIG5vdGlmeURlcGVuZGFudHMgKSB7XG5cblx0XHR2YXIgZ2V0O1xuXHRcdGNpcmN1bGFyLnB1c2goIGZ1bmN0aW9uKCkge1xuXHRcdFx0Z2V0ID0gY2lyY3VsYXIuZ2V0O1xuXHRcdH0gKTtcblxuXHRcdGZ1bmN0aW9uIHNldCggcmFjdGl2ZSwga2V5cGF0aCwgdmFsdWUsIHNpbGVudCApIHtcblx0XHRcdHZhciBrZXlzLCBsYXN0S2V5LCBwYXJlbnRLZXlwYXRoLCBwYXJlbnRWYWx1ZSwgd3JhcHBlciwgZXZhbHVhdG9yLCBkb250VGVhcmRvd25XcmFwcGVyO1xuXHRcdFx0aWYgKCBpc0VxdWFsKCByYWN0aXZlLl9jYWNoZVsga2V5cGF0aCBdLCB2YWx1ZSApICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR3cmFwcGVyID0gcmFjdGl2ZS5fd3JhcHBlZFsga2V5cGF0aCBdO1xuXHRcdFx0ZXZhbHVhdG9yID0gcmFjdGl2ZS5fZXZhbHVhdG9yc1sga2V5cGF0aCBdO1xuXHRcdFx0aWYgKCB3cmFwcGVyICYmIHdyYXBwZXIucmVzZXQgKSB7XG5cdFx0XHRcdHdyYXBwZXIucmVzZXQoIHZhbHVlICk7XG5cdFx0XHRcdHZhbHVlID0gd3JhcHBlci5nZXQoKTtcblx0XHRcdFx0ZG9udFRlYXJkb3duV3JhcHBlciA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGV2YWx1YXRvciApIHtcblx0XHRcdFx0ZXZhbHVhdG9yLnZhbHVlID0gdmFsdWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICFldmFsdWF0b3IgJiYgKCAhd3JhcHBlciB8fCAhd3JhcHBlci5yZXNldCApICkge1xuXHRcdFx0XHRrZXlzID0ga2V5cGF0aC5zcGxpdCggJy4nICk7XG5cdFx0XHRcdGxhc3RLZXkgPSBrZXlzLnBvcCgpO1xuXHRcdFx0XHRwYXJlbnRLZXlwYXRoID0ga2V5cy5qb2luKCAnLicgKTtcblx0XHRcdFx0d3JhcHBlciA9IHJhY3RpdmUuX3dyYXBwZWRbIHBhcmVudEtleXBhdGggXTtcblx0XHRcdFx0aWYgKCB3cmFwcGVyICYmIHdyYXBwZXIuc2V0ICkge1xuXHRcdFx0XHRcdHdyYXBwZXIuc2V0KCBsYXN0S2V5LCB2YWx1ZSApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHBhcmVudFZhbHVlID0gd3JhcHBlciA/IHdyYXBwZXIuZ2V0KCkgOiBnZXQoIHJhY3RpdmUsIHBhcmVudEtleXBhdGggKTtcblx0XHRcdFx0XHRpZiAoICFwYXJlbnRWYWx1ZSApIHtcblx0XHRcdFx0XHRcdHBhcmVudFZhbHVlID0gY3JlYXRlQnJhbmNoKCBsYXN0S2V5ICk7XG5cdFx0XHRcdFx0XHRzZXQoIHJhY3RpdmUsIHBhcmVudEtleXBhdGgsIHBhcmVudFZhbHVlICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHBhcmVudFZhbHVlWyBsYXN0S2V5IF0gPSB2YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Y2xlYXJDYWNoZSggcmFjdGl2ZSwga2V5cGF0aCwgZG9udFRlYXJkb3duV3JhcHBlciApO1xuXHRcdFx0aWYgKCAhc2lsZW50ICkge1xuXHRcdFx0XHRyYWN0aXZlLl9jaGFuZ2VzLnB1c2goIGtleXBhdGggKTtcblx0XHRcdFx0bm90aWZ5RGVwZW5kYW50cyggcmFjdGl2ZSwga2V5cGF0aCApO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRjaXJjdWxhci5zZXQgPSBzZXQ7XG5cdFx0cmV0dXJuIHNldDtcblx0fSggY2lyY3VsYXIsIHV0aWxzX2lzRXF1YWwsIHV0aWxzX2NyZWF0ZUJyYW5jaCwgc2hhcmVkX2NsZWFyQ2FjaGUsIHNoYXJlZF9ub3RpZnlEZXBlbmRhbnRzICk7XG5cblx0dmFyIHNoYXJlZF9nZXRfYXJyYXlBZGFwdG9yX3Byb2Nlc3NXcmFwcGVyID0gZnVuY3Rpb24oIHR5cGVzLCBjbGVhckNhY2hlLCBub3RpZnlEZXBlbmRhbnRzLCBzZXQgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHdyYXBwZXIsIGFycmF5LCBtZXRob2ROYW1lLCBzcGxpY2VTdW1tYXJ5ICkge1xuXHRcdFx0dmFyIHJvb3QsIGtleXBhdGgsIGNsZWFyRW5kLCB1cGRhdGVEZXBlbmRhbnQsIGksIGNoYW5nZWQsIHN0YXJ0LCBlbmQsIGNoaWxkS2V5cGF0aCwgbGVuZ3RoVW5jaGFuZ2VkO1xuXHRcdFx0cm9vdCA9IHdyYXBwZXIucm9vdDtcblx0XHRcdGtleXBhdGggPSB3cmFwcGVyLmtleXBhdGg7XG5cdFx0XHRyb290Ll9jaGFuZ2VzLnB1c2goIGtleXBhdGggKTtcblx0XHRcdGlmICggbWV0aG9kTmFtZSA9PT0gJ3NvcnQnIHx8IG1ldGhvZE5hbWUgPT09ICdyZXZlcnNlJyApIHtcblx0XHRcdFx0c2V0KCByb290LCBrZXlwYXRoLCBhcnJheSApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoICFzcGxpY2VTdW1tYXJ5ICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjbGVhckVuZCA9ICFzcGxpY2VTdW1tYXJ5LmJhbGFuY2UgPyBzcGxpY2VTdW1tYXJ5LmFkZGVkIDogYXJyYXkubGVuZ3RoIC0gTWF0aC5taW4oIHNwbGljZVN1bW1hcnkuYmFsYW5jZSwgMCApO1xuXHRcdFx0Zm9yICggaSA9IHNwbGljZVN1bW1hcnkuc3RhcnQ7IGkgPCBjbGVhckVuZDsgaSArPSAxICkge1xuXHRcdFx0XHRjbGVhckNhY2hlKCByb290LCBrZXlwYXRoICsgJy4nICsgaSApO1xuXHRcdFx0fVxuXHRcdFx0dXBkYXRlRGVwZW5kYW50ID0gZnVuY3Rpb24oIGRlcGVuZGFudCApIHtcblx0XHRcdFx0aWYgKCBkZXBlbmRhbnQua2V5cGF0aCA9PT0ga2V5cGF0aCAmJiBkZXBlbmRhbnQudHlwZSA9PT0gdHlwZXMuU0VDVElPTiAmJiAhZGVwZW5kYW50LmludmVydGVkICYmIGRlcGVuZGFudC5kb2NGcmFnICkge1xuXHRcdFx0XHRcdGRlcGVuZGFudC5zcGxpY2UoIHNwbGljZVN1bW1hcnkgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRkZXBlbmRhbnQudXBkYXRlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHRyb290Ll9kZXBzLmZvckVhY2goIGZ1bmN0aW9uKCBkZXBzQnlLZXlwYXRoICkge1xuXHRcdFx0XHR2YXIgZGVwZW5kYW50cyA9IGRlcHNCeUtleXBhdGhbIGtleXBhdGggXTtcblx0XHRcdFx0aWYgKCBkZXBlbmRhbnRzICkge1xuXHRcdFx0XHRcdGRlcGVuZGFudHMuZm9yRWFjaCggdXBkYXRlRGVwZW5kYW50ICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdGlmICggc3BsaWNlU3VtbWFyeS5hZGRlZCAmJiBzcGxpY2VTdW1tYXJ5LnJlbW92ZWQgKSB7XG5cdFx0XHRcdGNoYW5nZWQgPSBNYXRoLm1heCggc3BsaWNlU3VtbWFyeS5hZGRlZCwgc3BsaWNlU3VtbWFyeS5yZW1vdmVkICk7XG5cdFx0XHRcdHN0YXJ0ID0gc3BsaWNlU3VtbWFyeS5zdGFydDtcblx0XHRcdFx0ZW5kID0gc3RhcnQgKyBjaGFuZ2VkO1xuXHRcdFx0XHRsZW5ndGhVbmNoYW5nZWQgPSBzcGxpY2VTdW1tYXJ5LmFkZGVkID09PSBzcGxpY2VTdW1tYXJ5LnJlbW92ZWQ7XG5cdFx0XHRcdGZvciAoIGkgPSBzdGFydDsgaSA8IGVuZDsgaSArPSAxICkge1xuXHRcdFx0XHRcdGNoaWxkS2V5cGF0aCA9IGtleXBhdGggKyAnLicgKyBpO1xuXHRcdFx0XHRcdG5vdGlmeURlcGVuZGFudHMoIHJvb3QsIGNoaWxkS2V5cGF0aCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoICFsZW5ndGhVbmNoYW5nZWQgKSB7XG5cdFx0XHRcdGNsZWFyQ2FjaGUoIHJvb3QsIGtleXBhdGggKyAnLmxlbmd0aCcgKTtcblx0XHRcdFx0bm90aWZ5RGVwZW5kYW50cyggcm9vdCwga2V5cGF0aCArICcubGVuZ3RoJywgdHJ1ZSApO1xuXHRcdFx0fVxuXHRcdH07XG5cdH0oIGNvbmZpZ190eXBlcywgc2hhcmVkX2NsZWFyQ2FjaGUsIHNoYXJlZF9ub3RpZnlEZXBlbmRhbnRzLCBzaGFyZWRfc2V0ICk7XG5cblx0dmFyIHNoYXJlZF9nZXRfYXJyYXlBZGFwdG9yX3BhdGNoID0gZnVuY3Rpb24oIHJ1bmxvb3AsIGRlZmluZVByb3BlcnR5LCBnZXRTcGxpY2VFcXVpdmFsZW50LCBzdW1tYXJpc2VTcGxpY2VPcGVyYXRpb24sIHByb2Nlc3NXcmFwcGVyICkge1xuXG5cdFx0dmFyIHBhdGNoZWRBcnJheVByb3RvID0gW10sXG5cdFx0XHRtdXRhdG9yTWV0aG9kcyA9IFtcblx0XHRcdFx0J3BvcCcsXG5cdFx0XHRcdCdwdXNoJyxcblx0XHRcdFx0J3JldmVyc2UnLFxuXHRcdFx0XHQnc2hpZnQnLFxuXHRcdFx0XHQnc29ydCcsXG5cdFx0XHRcdCdzcGxpY2UnLFxuXHRcdFx0XHQndW5zaGlmdCdcblx0XHRcdF0sXG5cdFx0XHR0ZXN0T2JqLCBwYXRjaEFycmF5TWV0aG9kcywgdW5wYXRjaEFycmF5TWV0aG9kcztcblx0XHRtdXRhdG9yTWV0aG9kcy5mb3JFYWNoKCBmdW5jdGlvbiggbWV0aG9kTmFtZSApIHtcblx0XHRcdHZhciBtZXRob2QgPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHNwbGljZUVxdWl2YWxlbnQsIHNwbGljZVN1bW1hcnksIHJlc3VsdCwgd3JhcHBlciwgaTtcblx0XHRcdFx0c3BsaWNlRXF1aXZhbGVudCA9IGdldFNwbGljZUVxdWl2YWxlbnQoIHRoaXMsIG1ldGhvZE5hbWUsIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKCBhcmd1bWVudHMgKSApO1xuXHRcdFx0XHRzcGxpY2VTdW1tYXJ5ID0gc3VtbWFyaXNlU3BsaWNlT3BlcmF0aW9uKCB0aGlzLCBzcGxpY2VFcXVpdmFsZW50ICk7XG5cdFx0XHRcdHJlc3VsdCA9IEFycmF5LnByb3RvdHlwZVsgbWV0aG9kTmFtZSBdLmFwcGx5KCB0aGlzLCBhcmd1bWVudHMgKTtcblx0XHRcdFx0dGhpcy5fcmFjdGl2ZS5zZXR0aW5nID0gdHJ1ZTtcblx0XHRcdFx0aSA9IHRoaXMuX3JhY3RpdmUud3JhcHBlcnMubGVuZ3RoO1xuXHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHR3cmFwcGVyID0gdGhpcy5fcmFjdGl2ZS53cmFwcGVyc1sgaSBdO1xuXHRcdFx0XHRcdHJ1bmxvb3Auc3RhcnQoIHdyYXBwZXIucm9vdCApO1xuXHRcdFx0XHRcdHByb2Nlc3NXcmFwcGVyKCB3cmFwcGVyLCB0aGlzLCBtZXRob2ROYW1lLCBzcGxpY2VTdW1tYXJ5ICk7XG5cdFx0XHRcdFx0cnVubG9vcC5lbmQoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9yYWN0aXZlLnNldHRpbmcgPSBmYWxzZTtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdH07XG5cdFx0XHRkZWZpbmVQcm9wZXJ0eSggcGF0Y2hlZEFycmF5UHJvdG8sIG1ldGhvZE5hbWUsIHtcblx0XHRcdFx0dmFsdWU6IG1ldGhvZFxuXHRcdFx0fSApO1xuXHRcdH0gKTtcblx0XHR0ZXN0T2JqID0ge307XG5cdFx0aWYgKCB0ZXN0T2JqLl9fcHJvdG9fXyApIHtcblx0XHRcdHBhdGNoQXJyYXlNZXRob2RzID0gZnVuY3Rpb24oIGFycmF5ICkge1xuXHRcdFx0XHRhcnJheS5fX3Byb3RvX18gPSBwYXRjaGVkQXJyYXlQcm90bztcblx0XHRcdH07XG5cdFx0XHR1bnBhdGNoQXJyYXlNZXRob2RzID0gZnVuY3Rpb24oIGFycmF5ICkge1xuXHRcdFx0XHRhcnJheS5fX3Byb3RvX18gPSBBcnJheS5wcm90b3R5cGU7XG5cdFx0XHR9O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRwYXRjaEFycmF5TWV0aG9kcyA9IGZ1bmN0aW9uKCBhcnJheSApIHtcblx0XHRcdFx0dmFyIGksIG1ldGhvZE5hbWU7XG5cdFx0XHRcdGkgPSBtdXRhdG9yTWV0aG9kcy5sZW5ndGg7XG5cdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdG1ldGhvZE5hbWUgPSBtdXRhdG9yTWV0aG9kc1sgaSBdO1xuXHRcdFx0XHRcdGRlZmluZVByb3BlcnR5KCBhcnJheSwgbWV0aG9kTmFtZSwge1xuXHRcdFx0XHRcdFx0dmFsdWU6IHBhdGNoZWRBcnJheVByb3RvWyBtZXRob2ROYW1lIF0sXG5cdFx0XHRcdFx0XHRjb25maWd1cmFibGU6IHRydWVcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHR1bnBhdGNoQXJyYXlNZXRob2RzID0gZnVuY3Rpb24oIGFycmF5ICkge1xuXHRcdFx0XHR2YXIgaTtcblx0XHRcdFx0aSA9IG11dGF0b3JNZXRob2RzLmxlbmd0aDtcblx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0ZGVsZXRlIGFycmF5WyBtdXRhdG9yTWV0aG9kc1sgaSBdIF07XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0fVxuXHRcdHBhdGNoQXJyYXlNZXRob2RzLnVucGF0Y2ggPSB1bnBhdGNoQXJyYXlNZXRob2RzO1xuXHRcdHJldHVybiBwYXRjaEFycmF5TWV0aG9kcztcblx0fSggZ2xvYmFsX3J1bmxvb3AsIHV0aWxzX2RlZmluZVByb3BlcnR5LCBzaGFyZWRfZ2V0X2FycmF5QWRhcHRvcl9nZXRTcGxpY2VFcXVpdmFsZW50LCBzaGFyZWRfZ2V0X2FycmF5QWRhcHRvcl9zdW1tYXJpc2VTcGxpY2VPcGVyYXRpb24sIHNoYXJlZF9nZXRfYXJyYXlBZGFwdG9yX3Byb2Nlc3NXcmFwcGVyICk7XG5cblx0dmFyIHNoYXJlZF9nZXRfYXJyYXlBZGFwdG9yX19hcnJheUFkYXB0b3IgPSBmdW5jdGlvbiggZGVmaW5lUHJvcGVydHksIGlzQXJyYXksIHBhdGNoICkge1xuXG5cdFx0dmFyIGFycmF5QWRhcHRvciwgQXJyYXlXcmFwcGVyLCBlcnJvck1lc3NhZ2U7XG5cdFx0YXJyYXlBZGFwdG9yID0ge1xuXHRcdFx0ZmlsdGVyOiBmdW5jdGlvbiggb2JqZWN0ICkge1xuXHRcdFx0XHRyZXR1cm4gaXNBcnJheSggb2JqZWN0ICkgJiYgKCAhb2JqZWN0Ll9yYWN0aXZlIHx8ICFvYmplY3QuX3JhY3RpdmUuc2V0dGluZyApO1xuXHRcdFx0fSxcblx0XHRcdHdyYXA6IGZ1bmN0aW9uKCByYWN0aXZlLCBhcnJheSwga2V5cGF0aCApIHtcblx0XHRcdFx0cmV0dXJuIG5ldyBBcnJheVdyYXBwZXIoIHJhY3RpdmUsIGFycmF5LCBrZXlwYXRoICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRBcnJheVdyYXBwZXIgPSBmdW5jdGlvbiggcmFjdGl2ZSwgYXJyYXksIGtleXBhdGggKSB7XG5cdFx0XHR0aGlzLnJvb3QgPSByYWN0aXZlO1xuXHRcdFx0dGhpcy52YWx1ZSA9IGFycmF5O1xuXHRcdFx0dGhpcy5rZXlwYXRoID0ga2V5cGF0aDtcblx0XHRcdGlmICggIWFycmF5Ll9yYWN0aXZlICkge1xuXHRcdFx0XHRkZWZpbmVQcm9wZXJ0eSggYXJyYXksICdfcmFjdGl2ZScsIHtcblx0XHRcdFx0XHR2YWx1ZToge1xuXHRcdFx0XHRcdFx0d3JhcHBlcnM6IFtdLFxuXHRcdFx0XHRcdFx0aW5zdGFuY2VzOiBbXSxcblx0XHRcdFx0XHRcdHNldHRpbmc6IGZhbHNlXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRjb25maWd1cmFibGU6IHRydWVcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRwYXRjaCggYXJyYXkgKTtcblx0XHRcdH1cblx0XHRcdGlmICggIWFycmF5Ll9yYWN0aXZlLmluc3RhbmNlc1sgcmFjdGl2ZS5fZ3VpZCBdICkge1xuXHRcdFx0XHRhcnJheS5fcmFjdGl2ZS5pbnN0YW5jZXNbIHJhY3RpdmUuX2d1aWQgXSA9IDA7XG5cdFx0XHRcdGFycmF5Ll9yYWN0aXZlLmluc3RhbmNlcy5wdXNoKCByYWN0aXZlICk7XG5cdFx0XHR9XG5cdFx0XHRhcnJheS5fcmFjdGl2ZS5pbnN0YW5jZXNbIHJhY3RpdmUuX2d1aWQgXSArPSAxO1xuXHRcdFx0YXJyYXkuX3JhY3RpdmUud3JhcHBlcnMucHVzaCggdGhpcyApO1xuXHRcdH07XG5cdFx0QXJyYXlXcmFwcGVyLnByb3RvdHlwZSA9IHtcblx0XHRcdGdldDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnZhbHVlO1xuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIGFycmF5LCBzdG9yYWdlLCB3cmFwcGVycywgaW5zdGFuY2VzLCBpbmRleDtcblx0XHRcdFx0YXJyYXkgPSB0aGlzLnZhbHVlO1xuXHRcdFx0XHRzdG9yYWdlID0gYXJyYXkuX3JhY3RpdmU7XG5cdFx0XHRcdHdyYXBwZXJzID0gc3RvcmFnZS53cmFwcGVycztcblx0XHRcdFx0aW5zdGFuY2VzID0gc3RvcmFnZS5pbnN0YW5jZXM7XG5cdFx0XHRcdGlmICggc3RvcmFnZS5zZXR0aW5nICkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpbmRleCA9IHdyYXBwZXJzLmluZGV4T2YoIHRoaXMgKTtcblx0XHRcdFx0aWYgKCBpbmRleCA9PT0gLTEgKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCBlcnJvck1lc3NhZ2UgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR3cmFwcGVycy5zcGxpY2UoIGluZGV4LCAxICk7XG5cdFx0XHRcdGlmICggIXdyYXBwZXJzLmxlbmd0aCApIHtcblx0XHRcdFx0XHRkZWxldGUgYXJyYXkuX3JhY3RpdmU7XG5cdFx0XHRcdFx0cGF0Y2gudW5wYXRjaCggdGhpcy52YWx1ZSApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGluc3RhbmNlc1sgdGhpcy5yb290Ll9ndWlkIF0gLT0gMTtcblx0XHRcdFx0XHRpZiAoICFpbnN0YW5jZXNbIHRoaXMucm9vdC5fZ3VpZCBdICkge1xuXHRcdFx0XHRcdFx0aW5kZXggPSBpbnN0YW5jZXMuaW5kZXhPZiggdGhpcy5yb290ICk7XG5cdFx0XHRcdFx0XHRpZiAoIGluZGV4ID09PSAtMSApIHtcblx0XHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCBlcnJvck1lc3NhZ2UgKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGluc3RhbmNlcy5zcGxpY2UoIGluZGV4LCAxICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRlcnJvck1lc3NhZ2UgPSAnU29tZXRoaW5nIHdlbnQgd3JvbmcgaW4gYSByYXRoZXIgaW50ZXJlc3Rpbmcgd2F5Jztcblx0XHRyZXR1cm4gYXJyYXlBZGFwdG9yO1xuXHR9KCB1dGlsc19kZWZpbmVQcm9wZXJ0eSwgdXRpbHNfaXNBcnJheSwgc2hhcmVkX2dldF9hcnJheUFkYXB0b3JfcGF0Y2ggKTtcblxuXHR2YXIgc2hhcmVkX2dldF9tYWdpY0FkYXB0b3IgPSBmdW5jdGlvbiggcnVubG9vcCwgY3JlYXRlQnJhbmNoLCBpc0FycmF5LCBjbGVhckNhY2hlLCBub3RpZnlEZXBlbmRhbnRzICkge1xuXG5cdFx0dmFyIG1hZ2ljQWRhcHRvciwgTWFnaWNXcmFwcGVyO1xuXHRcdHRyeSB7XG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoIHt9LCAndGVzdCcsIHtcblx0XHRcdFx0dmFsdWU6IDBcblx0XHRcdH0gKTtcblx0XHR9IGNhdGNoICggZXJyICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRtYWdpY0FkYXB0b3IgPSB7XG5cdFx0XHRmaWx0ZXI6IGZ1bmN0aW9uKCBvYmplY3QsIGtleXBhdGgsIHJhY3RpdmUgKSB7XG5cdFx0XHRcdHZhciBrZXlzLCBrZXksIHBhcmVudEtleXBhdGgsIHBhcmVudFdyYXBwZXIsIHBhcmVudFZhbHVlO1xuXHRcdFx0XHRpZiAoICFrZXlwYXRoICkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRrZXlzID0ga2V5cGF0aC5zcGxpdCggJy4nICk7XG5cdFx0XHRcdGtleSA9IGtleXMucG9wKCk7XG5cdFx0XHRcdHBhcmVudEtleXBhdGggPSBrZXlzLmpvaW4oICcuJyApO1xuXHRcdFx0XHRpZiAoICggcGFyZW50V3JhcHBlciA9IHJhY3RpdmUuX3dyYXBwZWRbIHBhcmVudEtleXBhdGggXSApICYmICFwYXJlbnRXcmFwcGVyLm1hZ2ljICkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRwYXJlbnRWYWx1ZSA9IHJhY3RpdmUuZ2V0KCBwYXJlbnRLZXlwYXRoICk7XG5cdFx0XHRcdGlmICggaXNBcnJheSggcGFyZW50VmFsdWUgKSAmJiAvXlswLTldKyQvLnRlc3QoIGtleSApICkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcGFyZW50VmFsdWUgJiYgKCB0eXBlb2YgcGFyZW50VmFsdWUgPT09ICdvYmplY3QnIHx8IHR5cGVvZiBwYXJlbnRWYWx1ZSA9PT0gJ2Z1bmN0aW9uJyApO1xuXHRcdFx0fSxcblx0XHRcdHdyYXA6IGZ1bmN0aW9uKCByYWN0aXZlLCBwcm9wZXJ0eSwga2V5cGF0aCApIHtcblx0XHRcdFx0cmV0dXJuIG5ldyBNYWdpY1dyYXBwZXIoIHJhY3RpdmUsIHByb3BlcnR5LCBrZXlwYXRoICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRNYWdpY1dyYXBwZXIgPSBmdW5jdGlvbiggcmFjdGl2ZSwgdmFsdWUsIGtleXBhdGggKSB7XG5cdFx0XHR2YXIga2V5cywgb2JqS2V5cGF0aCwgZGVzY3JpcHRvciwgc2libGluZ3M7XG5cdFx0XHR0aGlzLm1hZ2ljID0gdHJ1ZTtcblx0XHRcdHRoaXMucmFjdGl2ZSA9IHJhY3RpdmU7XG5cdFx0XHR0aGlzLmtleXBhdGggPSBrZXlwYXRoO1xuXHRcdFx0dGhpcy52YWx1ZSA9IHZhbHVlO1xuXHRcdFx0a2V5cyA9IGtleXBhdGguc3BsaXQoICcuJyApO1xuXHRcdFx0dGhpcy5wcm9wID0ga2V5cy5wb3AoKTtcblx0XHRcdG9iaktleXBhdGggPSBrZXlzLmpvaW4oICcuJyApO1xuXHRcdFx0dGhpcy5vYmogPSBvYmpLZXlwYXRoID8gcmFjdGl2ZS5nZXQoIG9iaktleXBhdGggKSA6IHJhY3RpdmUuZGF0YTtcblx0XHRcdGRlc2NyaXB0b3IgPSB0aGlzLm9yaWdpbmFsRGVzY3JpcHRvciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoIHRoaXMub2JqLCB0aGlzLnByb3AgKTtcblx0XHRcdGlmICggZGVzY3JpcHRvciAmJiBkZXNjcmlwdG9yLnNldCAmJiAoIHNpYmxpbmdzID0gZGVzY3JpcHRvci5zZXQuX3JhY3RpdmVXcmFwcGVycyApICkge1xuXHRcdFx0XHRpZiAoIHNpYmxpbmdzLmluZGV4T2YoIHRoaXMgKSA9PT0gLTEgKSB7XG5cdFx0XHRcdFx0c2libGluZ3MucHVzaCggdGhpcyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNyZWF0ZUFjY2Vzc29ycyggdGhpcywgdmFsdWUsIGRlc2NyaXB0b3IgKTtcblx0XHR9O1xuXHRcdE1hZ2ljV3JhcHBlci5wcm90b3R5cGUgPSB7XG5cdFx0XHRnZXQ6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy52YWx1ZTtcblx0XHRcdH0sXG5cdFx0XHRyZXNldDogZnVuY3Rpb24oIHZhbHVlICkge1xuXHRcdFx0XHRpZiAoIHRoaXMudXBkYXRpbmcgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMudXBkYXRpbmcgPSB0cnVlO1xuXHRcdFx0XHR0aGlzLm9ialsgdGhpcy5wcm9wIF0gPSB2YWx1ZTtcblx0XHRcdFx0Y2xlYXJDYWNoZSggdGhpcy5yYWN0aXZlLCB0aGlzLmtleXBhdGggKTtcblx0XHRcdFx0dGhpcy51cGRhdGluZyA9IGZhbHNlO1xuXHRcdFx0fSxcblx0XHRcdHNldDogZnVuY3Rpb24oIGtleSwgdmFsdWUgKSB7XG5cdFx0XHRcdGlmICggdGhpcy51cGRhdGluZyApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCAhdGhpcy5vYmpbIHRoaXMucHJvcCBdICkge1xuXHRcdFx0XHRcdHRoaXMudXBkYXRpbmcgPSB0cnVlO1xuXHRcdFx0XHRcdHRoaXMub2JqWyB0aGlzLnByb3AgXSA9IGNyZWF0ZUJyYW5jaCgga2V5ICk7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGluZyA9IGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMub2JqWyB0aGlzLnByb3AgXVsga2V5IF0gPSB2YWx1ZTtcblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBkZXNjcmlwdG9yLCBzZXQsIHZhbHVlLCB3cmFwcGVycywgaW5kZXg7XG5cdFx0XHRcdGlmICggdGhpcy51cGRhdGluZyApIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZGVzY3JpcHRvciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoIHRoaXMub2JqLCB0aGlzLnByb3AgKTtcblx0XHRcdFx0c2V0ID0gZGVzY3JpcHRvciAmJiBkZXNjcmlwdG9yLnNldDtcblx0XHRcdFx0aWYgKCAhc2V0ICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHR3cmFwcGVycyA9IHNldC5fcmFjdGl2ZVdyYXBwZXJzO1xuXHRcdFx0XHRpbmRleCA9IHdyYXBwZXJzLmluZGV4T2YoIHRoaXMgKTtcblx0XHRcdFx0aWYgKCBpbmRleCAhPT0gLTEgKSB7XG5cdFx0XHRcdFx0d3JhcHBlcnMuc3BsaWNlKCBpbmRleCwgMSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggIXdyYXBwZXJzLmxlbmd0aCApIHtcblx0XHRcdFx0XHR2YWx1ZSA9IHRoaXMub2JqWyB0aGlzLnByb3AgXTtcblx0XHRcdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoIHRoaXMub2JqLCB0aGlzLnByb3AsIHRoaXMub3JpZ2luYWxEZXNjcmlwdG9yIHx8IHtcblx0XHRcdFx0XHRcdHdyaXRhYmxlOiB0cnVlLFxuXHRcdFx0XHRcdFx0ZW51bWVyYWJsZTogdHJ1ZSxcblx0XHRcdFx0XHRcdGNvbmZpZ3VyYWJsZTogdHJ1ZVxuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHR0aGlzLm9ialsgdGhpcy5wcm9wIF0gPSB2YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRmdW5jdGlvbiBjcmVhdGVBY2Nlc3NvcnMoIG9yaWdpbmFsV3JhcHBlciwgdmFsdWUsIGRlc2NyaXB0b3IgKSB7XG5cdFx0XHR2YXIgb2JqZWN0LCBwcm9wZXJ0eSwgb2xkR2V0LCBvbGRTZXQsIGdldCwgc2V0O1xuXHRcdFx0b2JqZWN0ID0gb3JpZ2luYWxXcmFwcGVyLm9iajtcblx0XHRcdHByb3BlcnR5ID0gb3JpZ2luYWxXcmFwcGVyLnByb3A7XG5cdFx0XHRpZiAoIGRlc2NyaXB0b3IgJiYgIWRlc2NyaXB0b3IuY29uZmlndXJhYmxlICkge1xuXHRcdFx0XHRpZiAoIHByb3BlcnR5ID09PSAnbGVuZ3RoJyApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnQ2Fubm90IHVzZSBtYWdpYyBtb2RlIHdpdGggcHJvcGVydHkgXCInICsgcHJvcGVydHkgKyAnXCIgLSBvYmplY3QgaXMgbm90IGNvbmZpZ3VyYWJsZScgKTtcblx0XHRcdH1cblx0XHRcdGlmICggZGVzY3JpcHRvciApIHtcblx0XHRcdFx0b2xkR2V0ID0gZGVzY3JpcHRvci5nZXQ7XG5cdFx0XHRcdG9sZFNldCA9IGRlc2NyaXB0b3Iuc2V0O1xuXHRcdFx0fVxuXHRcdFx0Z2V0ID0gb2xkR2V0IHx8IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0XHR9O1xuXHRcdFx0c2V0ID0gZnVuY3Rpb24oIHYgKSB7XG5cdFx0XHRcdGlmICggb2xkU2V0ICkge1xuXHRcdFx0XHRcdG9sZFNldCggdiApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHZhbHVlID0gb2xkR2V0ID8gb2xkR2V0KCkgOiB2O1xuXHRcdFx0XHRzZXQuX3JhY3RpdmVXcmFwcGVycy5mb3JFYWNoKCB1cGRhdGVXcmFwcGVyICk7XG5cdFx0XHR9O1xuXG5cdFx0XHRmdW5jdGlvbiB1cGRhdGVXcmFwcGVyKCB3cmFwcGVyICkge1xuXHRcdFx0XHR2YXIga2V5cGF0aCwgcmFjdGl2ZTtcblx0XHRcdFx0d3JhcHBlci52YWx1ZSA9IHZhbHVlO1xuXHRcdFx0XHRpZiAoIHdyYXBwZXIudXBkYXRpbmcgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJhY3RpdmUgPSB3cmFwcGVyLnJhY3RpdmU7XG5cdFx0XHRcdGtleXBhdGggPSB3cmFwcGVyLmtleXBhdGg7XG5cdFx0XHRcdHdyYXBwZXIudXBkYXRpbmcgPSB0cnVlO1xuXHRcdFx0XHRydW5sb29wLnN0YXJ0KCByYWN0aXZlICk7XG5cdFx0XHRcdHJhY3RpdmUuX2NoYW5nZXMucHVzaCgga2V5cGF0aCApO1xuXHRcdFx0XHRjbGVhckNhY2hlKCByYWN0aXZlLCBrZXlwYXRoICk7XG5cdFx0XHRcdG5vdGlmeURlcGVuZGFudHMoIHJhY3RpdmUsIGtleXBhdGggKTtcblx0XHRcdFx0cnVubG9vcC5lbmQoKTtcblx0XHRcdFx0d3JhcHBlci51cGRhdGluZyA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0c2V0Ll9yYWN0aXZlV3JhcHBlcnMgPSBbIG9yaWdpbmFsV3JhcHBlciBdO1xuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KCBvYmplY3QsIHByb3BlcnR5LCB7XG5cdFx0XHRcdGdldDogZ2V0LFxuXHRcdFx0XHRzZXQ6IHNldCxcblx0XHRcdFx0ZW51bWVyYWJsZTogdHJ1ZSxcblx0XHRcdFx0Y29uZmlndXJhYmxlOiB0cnVlXG5cdFx0XHR9ICk7XG5cdFx0fVxuXHRcdHJldHVybiBtYWdpY0FkYXB0b3I7XG5cdH0oIGdsb2JhbF9ydW5sb29wLCB1dGlsc19jcmVhdGVCcmFuY2gsIHV0aWxzX2lzQXJyYXksIHNoYXJlZF9jbGVhckNhY2hlLCBzaGFyZWRfbm90aWZ5RGVwZW5kYW50cyApO1xuXG5cdHZhciBzaGFyZWRfZ2V0X21hZ2ljQXJyYXlBZGFwdG9yID0gZnVuY3Rpb24oIG1hZ2ljQWRhcHRvciwgYXJyYXlBZGFwdG9yICkge1xuXG5cdFx0aWYgKCAhbWFnaWNBZGFwdG9yICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHR2YXIgbWFnaWNBcnJheUFkYXB0b3IsIE1hZ2ljQXJyYXlXcmFwcGVyO1xuXHRcdG1hZ2ljQXJyYXlBZGFwdG9yID0ge1xuXHRcdFx0ZmlsdGVyOiBmdW5jdGlvbiggb2JqZWN0LCBrZXlwYXRoLCByYWN0aXZlICkge1xuXHRcdFx0XHRyZXR1cm4gbWFnaWNBZGFwdG9yLmZpbHRlciggb2JqZWN0LCBrZXlwYXRoLCByYWN0aXZlICkgJiYgYXJyYXlBZGFwdG9yLmZpbHRlciggb2JqZWN0ICk7XG5cdFx0XHR9LFxuXHRcdFx0d3JhcDogZnVuY3Rpb24oIHJhY3RpdmUsIGFycmF5LCBrZXlwYXRoICkge1xuXHRcdFx0XHRyZXR1cm4gbmV3IE1hZ2ljQXJyYXlXcmFwcGVyKCByYWN0aXZlLCBhcnJheSwga2V5cGF0aCApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0TWFnaWNBcnJheVdyYXBwZXIgPSBmdW5jdGlvbiggcmFjdGl2ZSwgYXJyYXksIGtleXBhdGggKSB7XG5cdFx0XHR0aGlzLnZhbHVlID0gYXJyYXk7XG5cdFx0XHR0aGlzLm1hZ2ljID0gdHJ1ZTtcblx0XHRcdHRoaXMubWFnaWNXcmFwcGVyID0gbWFnaWNBZGFwdG9yLndyYXAoIHJhY3RpdmUsIGFycmF5LCBrZXlwYXRoICk7XG5cdFx0XHR0aGlzLmFycmF5V3JhcHBlciA9IGFycmF5QWRhcHRvci53cmFwKCByYWN0aXZlLCBhcnJheSwga2V5cGF0aCApO1xuXHRcdH07XG5cdFx0TWFnaWNBcnJheVdyYXBwZXIucHJvdG90eXBlID0ge1xuXHRcdFx0Z2V0OiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMudmFsdWU7XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR0aGlzLmFycmF5V3JhcHBlci50ZWFyZG93bigpO1xuXHRcdFx0XHR0aGlzLm1hZ2ljV3JhcHBlci50ZWFyZG93bigpO1xuXHRcdFx0fSxcblx0XHRcdHJlc2V0OiBmdW5jdGlvbiggdmFsdWUgKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLm1hZ2ljV3JhcHBlci5yZXNldCggdmFsdWUgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBtYWdpY0FycmF5QWRhcHRvcjtcblx0fSggc2hhcmVkX2dldF9tYWdpY0FkYXB0b3IsIHNoYXJlZF9nZXRfYXJyYXlBZGFwdG9yX19hcnJheUFkYXB0b3IgKTtcblxuXHR2YXIgc2hhcmVkX2FkYXB0SWZOZWNlc3NhcnkgPSBmdW5jdGlvbiggYWRhcHRvclJlZ2lzdHJ5LCBhcnJheUFkYXB0b3IsIG1hZ2ljQWRhcHRvciwgbWFnaWNBcnJheUFkYXB0b3IgKSB7XG5cblx0XHR2YXIgcHJlZml4ZXJzID0ge307XG5cdFx0cmV0dXJuIGZ1bmN0aW9uIGFkYXB0SWZOZWNlc3NhcnkoIHJhY3RpdmUsIGtleXBhdGgsIHZhbHVlLCBpc0V4cHJlc3Npb25SZXN1bHQgKSB7XG5cdFx0XHR2YXIgbGVuLCBpLCBhZGFwdG9yLCB3cmFwcGVkO1xuXHRcdFx0bGVuID0gcmFjdGl2ZS5hZGFwdC5sZW5ndGg7XG5cdFx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRhZGFwdG9yID0gcmFjdGl2ZS5hZGFwdFsgaSBdO1xuXHRcdFx0XHRpZiAoIHR5cGVvZiBhZGFwdG9yID09PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0XHRpZiAoICFhZGFwdG9yUmVnaXN0cnlbIGFkYXB0b3IgXSApIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ01pc3NpbmcgYWRhcHRvciBcIicgKyBhZGFwdG9yICsgJ1wiJyApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRhZGFwdG9yID0gcmFjdGl2ZS5hZGFwdFsgaSBdID0gYWRhcHRvclJlZ2lzdHJ5WyBhZGFwdG9yIF07XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBhZGFwdG9yLmZpbHRlciggdmFsdWUsIGtleXBhdGgsIHJhY3RpdmUgKSApIHtcblx0XHRcdFx0XHR3cmFwcGVkID0gcmFjdGl2ZS5fd3JhcHBlZFsga2V5cGF0aCBdID0gYWRhcHRvci53cmFwKCByYWN0aXZlLCB2YWx1ZSwga2V5cGF0aCwgZ2V0UHJlZml4ZXIoIGtleXBhdGggKSApO1xuXHRcdFx0XHRcdHdyYXBwZWQudmFsdWUgPSB2YWx1ZTtcblx0XHRcdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICggIWlzRXhwcmVzc2lvblJlc3VsdCApIHtcblx0XHRcdFx0aWYgKCByYWN0aXZlLm1hZ2ljICkge1xuXHRcdFx0XHRcdGlmICggbWFnaWNBcnJheUFkYXB0b3IuZmlsdGVyKCB2YWx1ZSwga2V5cGF0aCwgcmFjdGl2ZSApICkge1xuXHRcdFx0XHRcdFx0cmFjdGl2ZS5fd3JhcHBlZFsga2V5cGF0aCBdID0gbWFnaWNBcnJheUFkYXB0b3Iud3JhcCggcmFjdGl2ZSwgdmFsdWUsIGtleXBhdGggKTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKCBtYWdpY0FkYXB0b3IuZmlsdGVyKCB2YWx1ZSwga2V5cGF0aCwgcmFjdGl2ZSApICkge1xuXHRcdFx0XHRcdFx0cmFjdGl2ZS5fd3JhcHBlZFsga2V5cGF0aCBdID0gbWFnaWNBZGFwdG9yLndyYXAoIHJhY3RpdmUsIHZhbHVlLCBrZXlwYXRoICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2UgaWYgKCByYWN0aXZlLm1vZGlmeUFycmF5cyAmJiBhcnJheUFkYXB0b3IuZmlsdGVyKCB2YWx1ZSwga2V5cGF0aCwgcmFjdGl2ZSApICkge1xuXHRcdFx0XHRcdHJhY3RpdmUuX3dyYXBwZWRbIGtleXBhdGggXSA9IGFycmF5QWRhcHRvci53cmFwKCByYWN0aXZlLCB2YWx1ZSwga2V5cGF0aCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0fTtcblxuXHRcdGZ1bmN0aW9uIHByZWZpeEtleXBhdGgoIG9iaiwgcHJlZml4ICkge1xuXHRcdFx0dmFyIHByZWZpeGVkID0ge30sIGtleTtcblx0XHRcdGlmICggIXByZWZpeCApIHtcblx0XHRcdFx0cmV0dXJuIG9iajtcblx0XHRcdH1cblx0XHRcdHByZWZpeCArPSAnLic7XG5cdFx0XHRmb3IgKCBrZXkgaW4gb2JqICkge1xuXHRcdFx0XHRpZiAoIG9iai5oYXNPd25Qcm9wZXJ0eSgga2V5ICkgKSB7XG5cdFx0XHRcdFx0cHJlZml4ZWRbIHByZWZpeCArIGtleSBdID0gb2JqWyBrZXkgXTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHByZWZpeGVkO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldFByZWZpeGVyKCByb290S2V5cGF0aCApIHtcblx0XHRcdHZhciByb290RG90O1xuXHRcdFx0aWYgKCAhcHJlZml4ZXJzWyByb290S2V5cGF0aCBdICkge1xuXHRcdFx0XHRyb290RG90ID0gcm9vdEtleXBhdGggPyByb290S2V5cGF0aCArICcuJyA6ICcnO1xuXHRcdFx0XHRwcmVmaXhlcnNbIHJvb3RLZXlwYXRoIF0gPSBmdW5jdGlvbiggcmVsYXRpdmVLZXlwYXRoLCB2YWx1ZSApIHtcblx0XHRcdFx0XHR2YXIgb2JqO1xuXHRcdFx0XHRcdGlmICggdHlwZW9mIHJlbGF0aXZlS2V5cGF0aCA9PT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdFx0XHRvYmogPSB7fTtcblx0XHRcdFx0XHRcdG9ialsgcm9vdERvdCArIHJlbGF0aXZlS2V5cGF0aCBdID0gdmFsdWU7XG5cdFx0XHRcdFx0XHRyZXR1cm4gb2JqO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIHR5cGVvZiByZWxhdGl2ZUtleXBhdGggPT09ICdvYmplY3QnICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHJvb3REb3QgPyBwcmVmaXhLZXlwYXRoKCByZWxhdGl2ZUtleXBhdGgsIHJvb3RLZXlwYXRoICkgOiByZWxhdGl2ZUtleXBhdGg7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHByZWZpeGVyc1sgcm9vdEtleXBhdGggXTtcblx0XHR9XG5cdH0oIHJlZ2lzdHJpZXNfYWRhcHRvcnMsIHNoYXJlZF9nZXRfYXJyYXlBZGFwdG9yX19hcnJheUFkYXB0b3IsIHNoYXJlZF9nZXRfbWFnaWNBZGFwdG9yLCBzaGFyZWRfZ2V0X21hZ2ljQXJyYXlBZGFwdG9yICk7XG5cblx0dmFyIHNoYXJlZF9yZWdpc3RlckRlcGVuZGFudCA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uIHJlZ2lzdGVyRGVwZW5kYW50KCBkZXBlbmRhbnQgKSB7XG5cdFx0XHR2YXIgZGVwc0J5S2V5cGF0aCwgZGVwcywgcmFjdGl2ZSwga2V5cGF0aCwgcHJpb3JpdHk7XG5cdFx0XHRyYWN0aXZlID0gZGVwZW5kYW50LnJvb3Q7XG5cdFx0XHRrZXlwYXRoID0gZGVwZW5kYW50LmtleXBhdGg7XG5cdFx0XHRwcmlvcml0eSA9IGRlcGVuZGFudC5wcmlvcml0eTtcblx0XHRcdGRlcHNCeUtleXBhdGggPSByYWN0aXZlLl9kZXBzWyBwcmlvcml0eSBdIHx8ICggcmFjdGl2ZS5fZGVwc1sgcHJpb3JpdHkgXSA9IHt9ICk7XG5cdFx0XHRkZXBzID0gZGVwc0J5S2V5cGF0aFsga2V5cGF0aCBdIHx8ICggZGVwc0J5S2V5cGF0aFsga2V5cGF0aCBdID0gW10gKTtcblx0XHRcdGRlcHMucHVzaCggZGVwZW5kYW50ICk7XG5cdFx0XHRkZXBlbmRhbnQucmVnaXN0ZXJlZCA9IHRydWU7XG5cdFx0XHRpZiAoICFrZXlwYXRoICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR1cGRhdGVEZXBlbmRhbnRzTWFwKCByYWN0aXZlLCBrZXlwYXRoICk7XG5cdFx0fTtcblxuXHRcdGZ1bmN0aW9uIHVwZGF0ZURlcGVuZGFudHNNYXAoIHJhY3RpdmUsIGtleXBhdGggKSB7XG5cdFx0XHR2YXIga2V5cywgcGFyZW50S2V5cGF0aCwgbWFwO1xuXHRcdFx0a2V5cyA9IGtleXBhdGguc3BsaXQoICcuJyApO1xuXHRcdFx0d2hpbGUgKCBrZXlzLmxlbmd0aCApIHtcblx0XHRcdFx0a2V5cy5wb3AoKTtcblx0XHRcdFx0cGFyZW50S2V5cGF0aCA9IGtleXMuam9pbiggJy4nICk7XG5cdFx0XHRcdG1hcCA9IHJhY3RpdmUuX2RlcHNNYXBbIHBhcmVudEtleXBhdGggXSB8fCAoIHJhY3RpdmUuX2RlcHNNYXBbIHBhcmVudEtleXBhdGggXSA9IFtdICk7XG5cdFx0XHRcdGlmICggbWFwWyBrZXlwYXRoIF0gPT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0XHRtYXBbIGtleXBhdGggXSA9IDA7XG5cdFx0XHRcdFx0bWFwWyBtYXAubGVuZ3RoIF0gPSBrZXlwYXRoO1xuXHRcdFx0XHR9XG5cdFx0XHRcdG1hcFsga2V5cGF0aCBdICs9IDE7XG5cdFx0XHRcdGtleXBhdGggPSBwYXJlbnRLZXlwYXRoO1xuXHRcdFx0fVxuXHRcdH1cblx0fSgpO1xuXG5cdHZhciBzaGFyZWRfdW5yZWdpc3RlckRlcGVuZGFudCA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uIHVucmVnaXN0ZXJEZXBlbmRhbnQoIGRlcGVuZGFudCApIHtcblx0XHRcdHZhciBkZXBzLCBpbmRleCwgcmFjdGl2ZSwga2V5cGF0aCwgcHJpb3JpdHk7XG5cdFx0XHRyYWN0aXZlID0gZGVwZW5kYW50LnJvb3Q7XG5cdFx0XHRrZXlwYXRoID0gZGVwZW5kYW50LmtleXBhdGg7XG5cdFx0XHRwcmlvcml0eSA9IGRlcGVuZGFudC5wcmlvcml0eTtcblx0XHRcdGRlcHMgPSByYWN0aXZlLl9kZXBzWyBwcmlvcml0eSBdWyBrZXlwYXRoIF07XG5cdFx0XHRpbmRleCA9IGRlcHMuaW5kZXhPZiggZGVwZW5kYW50ICk7XG5cdFx0XHRpZiAoIGluZGV4ID09PSAtMSB8fCAhZGVwZW5kYW50LnJlZ2lzdGVyZWQgKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ0F0dGVtcHRlZCB0byByZW1vdmUgYSBkZXBlbmRhbnQgdGhhdCB3YXMgbm8gbG9uZ2VyIHJlZ2lzdGVyZWQhIFRoaXMgc2hvdWxkIG5vdCBoYXBwZW4uIElmIHlvdSBhcmUgc2VlaW5nIHRoaXMgYnVnIGluIGRldmVsb3BtZW50IHBsZWFzZSByYWlzZSBhbiBpc3N1ZSBhdCBodHRwczovL2dpdGh1Yi5jb20vUmFjdGl2ZUpTL1JhY3RpdmUvaXNzdWVzIC0gdGhhbmtzJyApO1xuXHRcdFx0fVxuXHRcdFx0ZGVwcy5zcGxpY2UoIGluZGV4LCAxICk7XG5cdFx0XHRkZXBlbmRhbnQucmVnaXN0ZXJlZCA9IGZhbHNlO1xuXHRcdFx0aWYgKCAha2V5cGF0aCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dXBkYXRlRGVwZW5kYW50c01hcCggcmFjdGl2ZSwga2V5cGF0aCApO1xuXHRcdH07XG5cblx0XHRmdW5jdGlvbiB1cGRhdGVEZXBlbmRhbnRzTWFwKCByYWN0aXZlLCBrZXlwYXRoICkge1xuXHRcdFx0dmFyIGtleXMsIHBhcmVudEtleXBhdGgsIG1hcDtcblx0XHRcdGtleXMgPSBrZXlwYXRoLnNwbGl0KCAnLicgKTtcblx0XHRcdHdoaWxlICgga2V5cy5sZW5ndGggKSB7XG5cdFx0XHRcdGtleXMucG9wKCk7XG5cdFx0XHRcdHBhcmVudEtleXBhdGggPSBrZXlzLmpvaW4oICcuJyApO1xuXHRcdFx0XHRtYXAgPSByYWN0aXZlLl9kZXBzTWFwWyBwYXJlbnRLZXlwYXRoIF07XG5cdFx0XHRcdG1hcFsga2V5cGF0aCBdIC09IDE7XG5cdFx0XHRcdGlmICggIW1hcFsga2V5cGF0aCBdICkge1xuXHRcdFx0XHRcdG1hcC5zcGxpY2UoIG1hcC5pbmRleE9mKCBrZXlwYXRoICksIDEgKTtcblx0XHRcdFx0XHRtYXBbIGtleXBhdGggXSA9IHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0XHRrZXlwYXRoID0gcGFyZW50S2V5cGF0aDtcblx0XHRcdH1cblx0XHR9XG5cdH0oKTtcblxuXHR2YXIgc2hhcmVkX2NyZWF0ZUNvbXBvbmVudEJpbmRpbmcgPSBmdW5jdGlvbiggY2lyY3VsYXIsIGlzQXJyYXksIGlzRXF1YWwsIHJlZ2lzdGVyRGVwZW5kYW50LCB1bnJlZ2lzdGVyRGVwZW5kYW50ICkge1xuXG5cdFx0dmFyIGdldCwgc2V0O1xuXHRcdGNpcmN1bGFyLnB1c2goIGZ1bmN0aW9uKCkge1xuXHRcdFx0Z2V0ID0gY2lyY3VsYXIuZ2V0O1xuXHRcdFx0c2V0ID0gY2lyY3VsYXIuc2V0O1xuXHRcdH0gKTtcblx0XHR2YXIgQmluZGluZyA9IGZ1bmN0aW9uKCByYWN0aXZlLCBrZXlwYXRoLCBvdGhlckluc3RhbmNlLCBvdGhlcktleXBhdGgsIHByaW9yaXR5ICkge1xuXHRcdFx0dGhpcy5yb290ID0gcmFjdGl2ZTtcblx0XHRcdHRoaXMua2V5cGF0aCA9IGtleXBhdGg7XG5cdFx0XHR0aGlzLnByaW9yaXR5ID0gcHJpb3JpdHk7XG5cdFx0XHR0aGlzLm90aGVySW5zdGFuY2UgPSBvdGhlckluc3RhbmNlO1xuXHRcdFx0dGhpcy5vdGhlcktleXBhdGggPSBvdGhlcktleXBhdGg7XG5cdFx0XHRyZWdpc3RlckRlcGVuZGFudCggdGhpcyApO1xuXHRcdFx0dGhpcy52YWx1ZSA9IGdldCggdGhpcy5yb290LCB0aGlzLmtleXBhdGggKTtcblx0XHR9O1xuXHRcdEJpbmRpbmcucHJvdG90eXBlID0ge1xuXHRcdFx0dXBkYXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHZhbHVlO1xuXHRcdFx0XHRpZiAoIHRoaXMudXBkYXRpbmcgfHwgdGhpcy5jb3VudGVycGFydCAmJiB0aGlzLmNvdW50ZXJwYXJ0LnVwZGF0aW5nICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHR2YWx1ZSA9IGdldCggdGhpcy5yb290LCB0aGlzLmtleXBhdGggKTtcblx0XHRcdFx0aWYgKCBpc0FycmF5KCB2YWx1ZSApICYmIHZhbHVlLl9yYWN0aXZlICYmIHZhbHVlLl9yYWN0aXZlLnNldHRpbmcgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggIWlzRXF1YWwoIHZhbHVlLCB0aGlzLnZhbHVlICkgKSB7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGluZyA9IHRydWU7XG5cdFx0XHRcdFx0c2V0KCB0aGlzLm90aGVySW5zdGFuY2UsIHRoaXMub3RoZXJLZXlwYXRoLCB2YWx1ZSApO1xuXHRcdFx0XHRcdHRoaXMudmFsdWUgPSB2YWx1ZTtcblx0XHRcdFx0XHR0aGlzLnVwZGF0aW5nID0gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHVucmVnaXN0ZXJEZXBlbmRhbnQoIHRoaXMgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBmdW5jdGlvbiBjcmVhdGVDb21wb25lbnRCaW5kaW5nKCBjb21wb25lbnQsIHBhcmVudEluc3RhbmNlLCBwYXJlbnRLZXlwYXRoLCBjaGlsZEtleXBhdGggKSB7XG5cdFx0XHR2YXIgaGFzaCwgY2hpbGRJbnN0YW5jZSwgYmluZGluZ3MsIHByaW9yaXR5LCBwYXJlbnRUb0NoaWxkQmluZGluZywgY2hpbGRUb1BhcmVudEJpbmRpbmc7XG5cdFx0XHRoYXNoID0gcGFyZW50S2V5cGF0aCArICc9JyArIGNoaWxkS2V5cGF0aDtcblx0XHRcdGJpbmRpbmdzID0gY29tcG9uZW50LmJpbmRpbmdzO1xuXHRcdFx0aWYgKCBiaW5kaW5nc1sgaGFzaCBdICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRiaW5kaW5nc1sgaGFzaCBdID0gdHJ1ZTtcblx0XHRcdGNoaWxkSW5zdGFuY2UgPSBjb21wb25lbnQuaW5zdGFuY2U7XG5cdFx0XHRwcmlvcml0eSA9IGNvbXBvbmVudC5wYXJlbnRGcmFnbWVudC5wcmlvcml0eTtcblx0XHRcdHBhcmVudFRvQ2hpbGRCaW5kaW5nID0gbmV3IEJpbmRpbmcoIHBhcmVudEluc3RhbmNlLCBwYXJlbnRLZXlwYXRoLCBjaGlsZEluc3RhbmNlLCBjaGlsZEtleXBhdGgsIHByaW9yaXR5ICk7XG5cdFx0XHRiaW5kaW5ncy5wdXNoKCBwYXJlbnRUb0NoaWxkQmluZGluZyApO1xuXHRcdFx0aWYgKCBjaGlsZEluc3RhbmNlLnR3b3dheSApIHtcblx0XHRcdFx0Y2hpbGRUb1BhcmVudEJpbmRpbmcgPSBuZXcgQmluZGluZyggY2hpbGRJbnN0YW5jZSwgY2hpbGRLZXlwYXRoLCBwYXJlbnRJbnN0YW5jZSwgcGFyZW50S2V5cGF0aCwgMSApO1xuXHRcdFx0XHRiaW5kaW5ncy5wdXNoKCBjaGlsZFRvUGFyZW50QmluZGluZyApO1xuXHRcdFx0XHRwYXJlbnRUb0NoaWxkQmluZGluZy5jb3VudGVycGFydCA9IGNoaWxkVG9QYXJlbnRCaW5kaW5nO1xuXHRcdFx0XHRjaGlsZFRvUGFyZW50QmluZGluZy5jb3VudGVycGFydCA9IHBhcmVudFRvQ2hpbGRCaW5kaW5nO1xuXHRcdFx0fVxuXHRcdH07XG5cdH0oIGNpcmN1bGFyLCB1dGlsc19pc0FycmF5LCB1dGlsc19pc0VxdWFsLCBzaGFyZWRfcmVnaXN0ZXJEZXBlbmRhbnQsIHNoYXJlZF91bnJlZ2lzdGVyRGVwZW5kYW50ICk7XG5cblx0dmFyIHNoYXJlZF9nZXRfZ2V0RnJvbVBhcmVudCA9IGZ1bmN0aW9uKCBjaXJjdWxhciwgY3JlYXRlQ29tcG9uZW50QmluZGluZywgc2V0ICkge1xuXG5cdFx0dmFyIGdldDtcblx0XHRjaXJjdWxhci5wdXNoKCBmdW5jdGlvbigpIHtcblx0XHRcdGdldCA9IGNpcmN1bGFyLmdldDtcblx0XHR9ICk7XG5cdFx0cmV0dXJuIGZ1bmN0aW9uIGdldEZyb21QYXJlbnQoIGNoaWxkLCBrZXlwYXRoICkge1xuXHRcdFx0dmFyIHBhcmVudCwgZnJhZ21lbnQsIGtleXBhdGhUb1Rlc3QsIHZhbHVlO1xuXHRcdFx0cGFyZW50ID0gY2hpbGQuX3BhcmVudDtcblx0XHRcdGZyYWdtZW50ID0gY2hpbGQuY29tcG9uZW50LnBhcmVudEZyYWdtZW50O1xuXHRcdFx0ZG8ge1xuXHRcdFx0XHRpZiAoICFmcmFnbWVudC5jb250ZXh0ICkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGtleXBhdGhUb1Rlc3QgPSBmcmFnbWVudC5jb250ZXh0ICsgJy4nICsga2V5cGF0aDtcblx0XHRcdFx0dmFsdWUgPSBnZXQoIHBhcmVudCwga2V5cGF0aFRvVGVzdCApO1xuXHRcdFx0XHRpZiAoIHZhbHVlICE9PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdFx0Y3JlYXRlTGF0ZUNvbXBvbmVudEJpbmRpbmcoIHBhcmVudCwgY2hpbGQsIGtleXBhdGhUb1Rlc3QsIGtleXBhdGgsIHZhbHVlICk7XG5cdFx0XHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9IHdoaWxlICggZnJhZ21lbnQgPSBmcmFnbWVudC5wYXJlbnQgKTtcblx0XHRcdHZhbHVlID0gZ2V0KCBwYXJlbnQsIGtleXBhdGggKTtcblx0XHRcdGlmICggdmFsdWUgIT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0Y3JlYXRlTGF0ZUNvbXBvbmVudEJpbmRpbmcoIHBhcmVudCwgY2hpbGQsIGtleXBhdGgsIGtleXBhdGgsIHZhbHVlICk7XG5cdFx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0ZnVuY3Rpb24gY3JlYXRlTGF0ZUNvbXBvbmVudEJpbmRpbmcoIHBhcmVudCwgY2hpbGQsIHBhcmVudEtleXBhdGgsIGNoaWxkS2V5cGF0aCwgdmFsdWUgKSB7XG5cdFx0XHRzZXQoIGNoaWxkLCBjaGlsZEtleXBhdGgsIHZhbHVlLCB0cnVlICk7XG5cdFx0XHRjcmVhdGVDb21wb25lbnRCaW5kaW5nKCBjaGlsZC5jb21wb25lbnQsIHBhcmVudCwgcGFyZW50S2V5cGF0aCwgY2hpbGRLZXlwYXRoICk7XG5cdFx0fVxuXHR9KCBjaXJjdWxhciwgc2hhcmVkX2NyZWF0ZUNvbXBvbmVudEJpbmRpbmcsIHNoYXJlZF9zZXQgKTtcblxuXHR2YXIgc2hhcmVkX2dldF9GQUlMRURfTE9PS1VQID0ge1xuXHRcdEZBSUxFRF9MT09LVVA6IHRydWVcblx0fTtcblxuXHR2YXIgc2hhcmVkX2dldF9fZ2V0ID0gZnVuY3Rpb24oIGNpcmN1bGFyLCBoYXNPd25Qcm9wZXJ0eSwgY2xvbmUsIGFkYXB0SWZOZWNlc3NhcnksIGdldEZyb21QYXJlbnQsIEZBSUxFRF9MT09LVVAgKSB7XG5cblx0XHRmdW5jdGlvbiBnZXQoIHJhY3RpdmUsIGtleXBhdGgsIG9wdGlvbnMgKSB7XG5cdFx0XHR2YXIgY2FjaGUgPSByYWN0aXZlLl9jYWNoZSxcblx0XHRcdFx0dmFsdWUsIHdyYXBwZWQsIGV2YWx1YXRvcjtcblx0XHRcdGlmICggY2FjaGVbIGtleXBhdGggXSA9PT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRpZiAoIHdyYXBwZWQgPSByYWN0aXZlLl93cmFwcGVkWyBrZXlwYXRoIF0gKSB7XG5cdFx0XHRcdFx0dmFsdWUgPSB3cmFwcGVkLnZhbHVlO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCAha2V5cGF0aCApIHtcblx0XHRcdFx0XHRhZGFwdElmTmVjZXNzYXJ5KCByYWN0aXZlLCAnJywgcmFjdGl2ZS5kYXRhICk7XG5cdFx0XHRcdFx0dmFsdWUgPSByYWN0aXZlLmRhdGE7XG5cdFx0XHRcdH0gZWxzZSBpZiAoIGV2YWx1YXRvciA9IHJhY3RpdmUuX2V2YWx1YXRvcnNbIGtleXBhdGggXSApIHtcblx0XHRcdFx0XHR2YWx1ZSA9IGV2YWx1YXRvci52YWx1ZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR2YWx1ZSA9IHJldHJpZXZlKCByYWN0aXZlLCBrZXlwYXRoICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y2FjaGVbIGtleXBhdGggXSA9IHZhbHVlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dmFsdWUgPSBjYWNoZVsga2V5cGF0aCBdO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB2YWx1ZSA9PT0gRkFJTEVEX0xPT0tVUCApIHtcblx0XHRcdFx0aWYgKCByYWN0aXZlLl9wYXJlbnQgJiYgIXJhY3RpdmUuaXNvbGF0ZWQgKSB7XG5cdFx0XHRcdFx0dmFsdWUgPSBnZXRGcm9tUGFyZW50KCByYWN0aXZlLCBrZXlwYXRoLCBvcHRpb25zICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dmFsdWUgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICggb3B0aW9ucyAmJiBvcHRpb25zLmV2YWx1YXRlV3JhcHBlZCAmJiAoIHdyYXBwZWQgPSByYWN0aXZlLl93cmFwcGVkWyBrZXlwYXRoIF0gKSApIHtcblx0XHRcdFx0dmFsdWUgPSB3cmFwcGVkLmdldCgpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdH1cblx0XHRjaXJjdWxhci5nZXQgPSBnZXQ7XG5cdFx0cmV0dXJuIGdldDtcblxuXHRcdGZ1bmN0aW9uIHJldHJpZXZlKCByYWN0aXZlLCBrZXlwYXRoICkge1xuXHRcdFx0dmFyIGtleXMsIGtleSwgcGFyZW50S2V5cGF0aCwgcGFyZW50VmFsdWUsIGNhY2hlTWFwLCB2YWx1ZSwgd3JhcHBlZCwgc2hvdWxkQ2xvbmU7XG5cdFx0XHRrZXlzID0ga2V5cGF0aC5zcGxpdCggJy4nICk7XG5cdFx0XHRrZXkgPSBrZXlzLnBvcCgpO1xuXHRcdFx0cGFyZW50S2V5cGF0aCA9IGtleXMuam9pbiggJy4nICk7XG5cdFx0XHRwYXJlbnRWYWx1ZSA9IGdldCggcmFjdGl2ZSwgcGFyZW50S2V5cGF0aCApO1xuXHRcdFx0aWYgKCB3cmFwcGVkID0gcmFjdGl2ZS5fd3JhcHBlZFsgcGFyZW50S2V5cGF0aCBdICkge1xuXHRcdFx0XHRwYXJlbnRWYWx1ZSA9IHdyYXBwZWQuZ2V0KCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHBhcmVudFZhbHVlID09PSBudWxsIHx8IHBhcmVudFZhbHVlID09PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggISggY2FjaGVNYXAgPSByYWN0aXZlLl9jYWNoZU1hcFsgcGFyZW50S2V5cGF0aCBdICkgKSB7XG5cdFx0XHRcdHJhY3RpdmUuX2NhY2hlTWFwWyBwYXJlbnRLZXlwYXRoIF0gPSBbIGtleXBhdGggXTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmICggY2FjaGVNYXAuaW5kZXhPZigga2V5cGF0aCApID09PSAtMSApIHtcblx0XHRcdFx0XHRjYWNoZU1hcC5wdXNoKCBrZXlwYXRoICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICggdHlwZW9mIHBhcmVudFZhbHVlID09PSAnb2JqZWN0JyAmJiAhKCBrZXkgaW4gcGFyZW50VmFsdWUgKSApIHtcblx0XHRcdFx0cmV0dXJuIHJhY3RpdmUuX2NhY2hlWyBrZXlwYXRoIF0gPSBGQUlMRURfTE9PS1VQO1xuXHRcdFx0fVxuXHRcdFx0c2hvdWxkQ2xvbmUgPSAhaGFzT3duUHJvcGVydHkuY2FsbCggcGFyZW50VmFsdWUsIGtleSApO1xuXHRcdFx0dmFsdWUgPSBzaG91bGRDbG9uZSA/IGNsb25lKCBwYXJlbnRWYWx1ZVsga2V5IF0gKSA6IHBhcmVudFZhbHVlWyBrZXkgXTtcblx0XHRcdHZhbHVlID0gYWRhcHRJZk5lY2Vzc2FyeSggcmFjdGl2ZSwga2V5cGF0aCwgdmFsdWUsIGZhbHNlICk7XG5cdFx0XHRyYWN0aXZlLl9jYWNoZVsga2V5cGF0aCBdID0gdmFsdWU7XG5cdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0fVxuXHR9KCBjaXJjdWxhciwgdXRpbHNfaGFzT3duUHJvcGVydHksIHV0aWxzX2Nsb25lLCBzaGFyZWRfYWRhcHRJZk5lY2Vzc2FyeSwgc2hhcmVkX2dldF9nZXRGcm9tUGFyZW50LCBzaGFyZWRfZ2V0X0ZBSUxFRF9MT09LVVAgKTtcblxuXHQvKiBnbG9iYWwgY29uc29sZSAqL1xuXHR2YXIgdXRpbHNfd2FybiA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0aWYgKCB0eXBlb2YgY29uc29sZSAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIGNvbnNvbGUud2FybiA9PT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgY29uc29sZS53YXJuLmFwcGx5ID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRjb25zb2xlLndhcm4uYXBwbHkoIGNvbnNvbGUsIGFyZ3VtZW50cyApO1xuXHRcdFx0fTtcblx0XHR9XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCkge307XG5cdH0oKTtcblxuXHR2YXIgdXRpbHNfaXNPYmplY3QgPSBmdW5jdGlvbigpIHtcblxuXHRcdHZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB0aGluZyApIHtcblx0XHRcdHJldHVybiB0eXBlb2YgdGhpbmcgPT09ICdvYmplY3QnICYmIHRvU3RyaW5nLmNhbGwoIHRoaW5nICkgPT09ICdbb2JqZWN0IE9iamVjdF0nO1xuXHRcdH07XG5cdH0oKTtcblxuXHR2YXIgcmVnaXN0cmllc19pbnRlcnBvbGF0b3JzID0gZnVuY3Rpb24oIGNpcmN1bGFyLCBoYXNPd25Qcm9wZXJ0eSwgaXNBcnJheSwgaXNPYmplY3QsIGlzTnVtZXJpYyApIHtcblxuXHRcdHZhciBpbnRlcnBvbGF0b3JzLCBpbnRlcnBvbGF0ZSwgY3NzTGVuZ3RoUGF0dGVybjtcblx0XHRjaXJjdWxhci5wdXNoKCBmdW5jdGlvbigpIHtcblx0XHRcdGludGVycG9sYXRlID0gY2lyY3VsYXIuaW50ZXJwb2xhdGU7XG5cdFx0fSApO1xuXHRcdGNzc0xlbmd0aFBhdHRlcm4gPSAvXihbKy1dP1swLTldK1xcLj8oPzpbMC05XSspPykocHh8ZW18ZXh8JXxpbnxjbXxtbXxwdHxwYykkLztcblx0XHRpbnRlcnBvbGF0b3JzID0ge1xuXHRcdFx0bnVtYmVyOiBmdW5jdGlvbiggZnJvbSwgdG8gKSB7XG5cdFx0XHRcdHZhciBkZWx0YTtcblx0XHRcdFx0aWYgKCAhaXNOdW1lcmljKCBmcm9tICkgfHwgIWlzTnVtZXJpYyggdG8gKSApIHtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRmcm9tID0gK2Zyb207XG5cdFx0XHRcdHRvID0gK3RvO1xuXHRcdFx0XHRkZWx0YSA9IHRvIC0gZnJvbTtcblx0XHRcdFx0aWYgKCAhZGVsdGEgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGZyb207XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZnVuY3Rpb24oIHQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZyb20gKyB0ICogZGVsdGE7XG5cdFx0XHRcdH07XG5cdFx0XHR9LFxuXHRcdFx0YXJyYXk6IGZ1bmN0aW9uKCBmcm9tLCB0byApIHtcblx0XHRcdFx0dmFyIGludGVybWVkaWF0ZSwgaW50ZXJwb2xhdG9ycywgbGVuLCBpO1xuXHRcdFx0XHRpZiAoICFpc0FycmF5KCBmcm9tICkgfHwgIWlzQXJyYXkoIHRvICkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0aW50ZXJtZWRpYXRlID0gW107XG5cdFx0XHRcdGludGVycG9sYXRvcnMgPSBbXTtcblx0XHRcdFx0aSA9IGxlbiA9IE1hdGgubWluKCBmcm9tLmxlbmd0aCwgdG8ubGVuZ3RoICk7XG5cdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdGludGVycG9sYXRvcnNbIGkgXSA9IGludGVycG9sYXRlKCBmcm9tWyBpIF0sIHRvWyBpIF0gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRmb3IgKCBpID0gbGVuOyBpIDwgZnJvbS5sZW5ndGg7IGkgKz0gMSApIHtcblx0XHRcdFx0XHRpbnRlcm1lZGlhdGVbIGkgXSA9IGZyb21bIGkgXTtcblx0XHRcdFx0fVxuXHRcdFx0XHRmb3IgKCBpID0gbGVuOyBpIDwgdG8ubGVuZ3RoOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0aW50ZXJtZWRpYXRlWyBpIF0gPSB0b1sgaSBdO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBmdW5jdGlvbiggdCApIHtcblx0XHRcdFx0XHR2YXIgaSA9IGxlbjtcblx0XHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRcdGludGVybWVkaWF0ZVsgaSBdID0gaW50ZXJwb2xhdG9yc1sgaSBdKCB0ICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBpbnRlcm1lZGlhdGU7XG5cdFx0XHRcdH07XG5cdFx0XHR9LFxuXHRcdFx0b2JqZWN0OiBmdW5jdGlvbiggZnJvbSwgdG8gKSB7XG5cdFx0XHRcdHZhciBwcm9wZXJ0aWVzLCBsZW4sIGludGVycG9sYXRvcnMsIGludGVybWVkaWF0ZSwgcHJvcDtcblx0XHRcdFx0aWYgKCAhaXNPYmplY3QoIGZyb20gKSB8fCAhaXNPYmplY3QoIHRvICkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0cHJvcGVydGllcyA9IFtdO1xuXHRcdFx0XHRpbnRlcm1lZGlhdGUgPSB7fTtcblx0XHRcdFx0aW50ZXJwb2xhdG9ycyA9IHt9O1xuXHRcdFx0XHRmb3IgKCBwcm9wIGluIGZyb20gKSB7XG5cdFx0XHRcdFx0aWYgKCBoYXNPd25Qcm9wZXJ0eS5jYWxsKCBmcm9tLCBwcm9wICkgKSB7XG5cdFx0XHRcdFx0XHRpZiAoIGhhc093blByb3BlcnR5LmNhbGwoIHRvLCBwcm9wICkgKSB7XG5cdFx0XHRcdFx0XHRcdHByb3BlcnRpZXMucHVzaCggcHJvcCApO1xuXHRcdFx0XHRcdFx0XHRpbnRlcnBvbGF0b3JzWyBwcm9wIF0gPSBpbnRlcnBvbGF0ZSggZnJvbVsgcHJvcCBdLCB0b1sgcHJvcCBdICk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRpbnRlcm1lZGlhdGVbIHByb3AgXSA9IGZyb21bIHByb3AgXTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0Zm9yICggcHJvcCBpbiB0byApIHtcblx0XHRcdFx0XHRpZiAoIGhhc093blByb3BlcnR5LmNhbGwoIHRvLCBwcm9wICkgJiYgIWhhc093blByb3BlcnR5LmNhbGwoIGZyb20sIHByb3AgKSApIHtcblx0XHRcdFx0XHRcdGludGVybWVkaWF0ZVsgcHJvcCBdID0gdG9bIHByb3AgXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0bGVuID0gcHJvcGVydGllcy5sZW5ndGg7XG5cdFx0XHRcdHJldHVybiBmdW5jdGlvbiggdCApIHtcblx0XHRcdFx0XHR2YXIgaSA9IGxlbixcblx0XHRcdFx0XHRcdHByb3A7XG5cdFx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0XHRwcm9wID0gcHJvcGVydGllc1sgaSBdO1xuXHRcdFx0XHRcdFx0aW50ZXJtZWRpYXRlWyBwcm9wIF0gPSBpbnRlcnBvbGF0b3JzWyBwcm9wIF0oIHQgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIGludGVybWVkaWF0ZTtcblx0XHRcdFx0fTtcblx0XHRcdH0sXG5cdFx0XHRjc3NMZW5ndGg6IGZ1bmN0aW9uKCBmcm9tLCB0byApIHtcblx0XHRcdFx0dmFyIGZyb21NYXRjaCwgdG9NYXRjaCwgZnJvbVVuaXQsIHRvVW5pdCwgZnJvbVZhbHVlLCB0b1ZhbHVlLCB1bml0LCBkZWx0YTtcblx0XHRcdFx0aWYgKCBmcm9tICE9PSAwICYmIHR5cGVvZiBmcm9tICE9PSAnc3RyaW5nJyB8fCB0byAhPT0gMCAmJiB0eXBlb2YgdG8gIT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGZyb21NYXRjaCA9IGNzc0xlbmd0aFBhdHRlcm4uZXhlYyggZnJvbSApO1xuXHRcdFx0XHR0b01hdGNoID0gY3NzTGVuZ3RoUGF0dGVybi5leGVjKCB0byApO1xuXHRcdFx0XHRmcm9tVW5pdCA9IGZyb21NYXRjaCA/IGZyb21NYXRjaFsgMiBdIDogJyc7XG5cdFx0XHRcdHRvVW5pdCA9IHRvTWF0Y2ggPyB0b01hdGNoWyAyIF0gOiAnJztcblx0XHRcdFx0aWYgKCBmcm9tVW5pdCAmJiB0b1VuaXQgJiYgZnJvbVVuaXQgIT09IHRvVW5pdCApIHtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHR1bml0ID0gZnJvbVVuaXQgfHwgdG9Vbml0O1xuXHRcdFx0XHRmcm9tVmFsdWUgPSBmcm9tTWF0Y2ggPyArZnJvbU1hdGNoWyAxIF0gOiAwO1xuXHRcdFx0XHR0b1ZhbHVlID0gdG9NYXRjaCA/ICt0b01hdGNoWyAxIF0gOiAwO1xuXHRcdFx0XHRkZWx0YSA9IHRvVmFsdWUgLSBmcm9tVmFsdWU7XG5cdFx0XHRcdGlmICggIWRlbHRhICkge1xuXHRcdFx0XHRcdHJldHVybiBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdHJldHVybiBmcm9tVmFsdWUgKyB1bml0O1xuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCB0ICkge1xuXHRcdFx0XHRcdHJldHVybiBmcm9tVmFsdWUgKyB0ICogZGVsdGEgKyB1bml0O1xuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIGludGVycG9sYXRvcnM7XG5cdH0oIGNpcmN1bGFyLCB1dGlsc19oYXNPd25Qcm9wZXJ0eSwgdXRpbHNfaXNBcnJheSwgdXRpbHNfaXNPYmplY3QsIHV0aWxzX2lzTnVtZXJpYyApO1xuXG5cdHZhciBzaGFyZWRfaW50ZXJwb2xhdGUgPSBmdW5jdGlvbiggY2lyY3VsYXIsIHdhcm4sIGludGVycG9sYXRvcnMgKSB7XG5cblx0XHR2YXIgaW50ZXJwb2xhdGUgPSBmdW5jdGlvbiggZnJvbSwgdG8sIHJhY3RpdmUsIHR5cGUgKSB7XG5cdFx0XHRpZiAoIGZyb20gPT09IHRvICkge1xuXHRcdFx0XHRyZXR1cm4gc25hcCggdG8gKTtcblx0XHRcdH1cblx0XHRcdGlmICggdHlwZSApIHtcblx0XHRcdFx0aWYgKCByYWN0aXZlLmludGVycG9sYXRvcnNbIHR5cGUgXSApIHtcblx0XHRcdFx0XHRyZXR1cm4gcmFjdGl2ZS5pbnRlcnBvbGF0b3JzWyB0eXBlIF0oIGZyb20sIHRvICkgfHwgc25hcCggdG8gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR3YXJuKCAnTWlzc2luZyBcIicgKyB0eXBlICsgJ1wiIGludGVycG9sYXRvci4gWW91IG1heSBuZWVkIHRvIGRvd25sb2FkIGEgcGx1Z2luIGZyb20gW1RPRE9dJyApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGludGVycG9sYXRvcnMubnVtYmVyKCBmcm9tLCB0byApIHx8IGludGVycG9sYXRvcnMuYXJyYXkoIGZyb20sIHRvICkgfHwgaW50ZXJwb2xhdG9ycy5vYmplY3QoIGZyb20sIHRvICkgfHwgaW50ZXJwb2xhdG9ycy5jc3NMZW5ndGgoIGZyb20sIHRvICkgfHwgc25hcCggdG8gKTtcblx0XHR9O1xuXHRcdGNpcmN1bGFyLmludGVycG9sYXRlID0gaW50ZXJwb2xhdGU7XG5cdFx0cmV0dXJuIGludGVycG9sYXRlO1xuXG5cdFx0ZnVuY3Rpb24gc25hcCggdG8gKSB7XG5cdFx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0bztcblx0XHRcdH07XG5cdFx0fVxuXHR9KCBjaXJjdWxhciwgdXRpbHNfd2FybiwgcmVnaXN0cmllc19pbnRlcnBvbGF0b3JzICk7XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX2FuaW1hdGVfQW5pbWF0aW9uID0gZnVuY3Rpb24oIHdhcm4sIHJ1bmxvb3AsIGludGVycG9sYXRlLCBzZXQgKSB7XG5cblx0XHR2YXIgQW5pbWF0aW9uID0gZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHR2YXIga2V5O1xuXHRcdFx0dGhpcy5zdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuXHRcdFx0Zm9yICgga2V5IGluIG9wdGlvbnMgKSB7XG5cdFx0XHRcdGlmICggb3B0aW9ucy5oYXNPd25Qcm9wZXJ0eSgga2V5ICkgKSB7XG5cdFx0XHRcdFx0dGhpc1sga2V5IF0gPSBvcHRpb25zWyBrZXkgXTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0dGhpcy5pbnRlcnBvbGF0b3IgPSBpbnRlcnBvbGF0ZSggdGhpcy5mcm9tLCB0aGlzLnRvLCB0aGlzLnJvb3QsIHRoaXMuaW50ZXJwb2xhdG9yICk7XG5cdFx0XHR0aGlzLnJ1bm5pbmcgPSB0cnVlO1xuXHRcdH07XG5cdFx0QW5pbWF0aW9uLnByb3RvdHlwZSA9IHtcblx0XHRcdHRpY2s6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgZWxhcHNlZCwgdCwgdmFsdWUsIHRpbWVOb3csIGluZGV4LCBrZXlwYXRoO1xuXHRcdFx0XHRrZXlwYXRoID0gdGhpcy5rZXlwYXRoO1xuXHRcdFx0XHRpZiAoIHRoaXMucnVubmluZyApIHtcblx0XHRcdFx0XHR0aW1lTm93ID0gRGF0ZS5ub3coKTtcblx0XHRcdFx0XHRlbGFwc2VkID0gdGltZU5vdyAtIHRoaXMuc3RhcnRUaW1lO1xuXHRcdFx0XHRcdGlmICggZWxhcHNlZCA+PSB0aGlzLmR1cmF0aW9uICkge1xuXHRcdFx0XHRcdFx0aWYgKCBrZXlwYXRoICE9PSBudWxsICkge1xuXHRcdFx0XHRcdFx0XHRydW5sb29wLnN0YXJ0KCB0aGlzLnJvb3QgKTtcblx0XHRcdFx0XHRcdFx0c2V0KCB0aGlzLnJvb3QsIGtleXBhdGgsIHRoaXMudG8gKTtcblx0XHRcdFx0XHRcdFx0cnVubG9vcC5lbmQoKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmICggdGhpcy5zdGVwICkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLnN0ZXAoIDEsIHRoaXMudG8gKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHRoaXMuY29tcGxldGUoIHRoaXMudG8gKTtcblx0XHRcdFx0XHRcdGluZGV4ID0gdGhpcy5yb290Ll9hbmltYXRpb25zLmluZGV4T2YoIHRoaXMgKTtcblx0XHRcdFx0XHRcdGlmICggaW5kZXggPT09IC0xICkge1xuXHRcdFx0XHRcdFx0XHR3YXJuKCAnQW5pbWF0aW9uIHdhcyBub3QgZm91bmQnICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR0aGlzLnJvb3QuX2FuaW1hdGlvbnMuc3BsaWNlKCBpbmRleCwgMSApO1xuXHRcdFx0XHRcdFx0dGhpcy5ydW5uaW5nID0gZmFsc2U7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHQgPSB0aGlzLmVhc2luZyA/IHRoaXMuZWFzaW5nKCBlbGFwc2VkIC8gdGhpcy5kdXJhdGlvbiApIDogZWxhcHNlZCAvIHRoaXMuZHVyYXRpb247XG5cdFx0XHRcdFx0aWYgKCBrZXlwYXRoICE9PSBudWxsICkge1xuXHRcdFx0XHRcdFx0dmFsdWUgPSB0aGlzLmludGVycG9sYXRvciggdCApO1xuXHRcdFx0XHRcdFx0cnVubG9vcC5zdGFydCggdGhpcy5yb290ICk7XG5cdFx0XHRcdFx0XHRzZXQoIHRoaXMucm9vdCwga2V5cGF0aCwgdmFsdWUgKTtcblx0XHRcdFx0XHRcdHJ1bmxvb3AuZW5kKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICggdGhpcy5zdGVwICkge1xuXHRcdFx0XHRcdFx0dGhpcy5zdGVwKCB0LCB2YWx1ZSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9LFxuXHRcdFx0c3RvcDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBpbmRleDtcblx0XHRcdFx0dGhpcy5ydW5uaW5nID0gZmFsc2U7XG5cdFx0XHRcdGluZGV4ID0gdGhpcy5yb290Ll9hbmltYXRpb25zLmluZGV4T2YoIHRoaXMgKTtcblx0XHRcdFx0aWYgKCBpbmRleCA9PT0gLTEgKSB7XG5cdFx0XHRcdFx0d2FybiggJ0FuaW1hdGlvbiB3YXMgbm90IGZvdW5kJyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMucm9vdC5fYW5pbWF0aW9ucy5zcGxpY2UoIGluZGV4LCAxICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gQW5pbWF0aW9uO1xuXHR9KCB1dGlsc193YXJuLCBnbG9iYWxfcnVubG9vcCwgc2hhcmVkX2ludGVycG9sYXRlLCBzaGFyZWRfc2V0ICk7XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX2FuaW1hdGVfX2FuaW1hdGUgPSBmdW5jdGlvbiggaXNFcXVhbCwgUHJvbWlzZSwgbm9ybWFsaXNlS2V5cGF0aCwgYW5pbWF0aW9ucywgZ2V0LCBBbmltYXRpb24gKSB7XG5cblx0XHR2YXIgbm9vcCA9IGZ1bmN0aW9uKCkge30sIG5vQW5pbWF0aW9uID0ge1xuXHRcdFx0XHRzdG9wOiBub29wXG5cdFx0XHR9O1xuXHRcdHJldHVybiBmdW5jdGlvbigga2V5cGF0aCwgdG8sIG9wdGlvbnMgKSB7XG5cdFx0XHR2YXIgcHJvbWlzZSwgZnVsZmlsUHJvbWlzZSwgaywgYW5pbWF0aW9uLCBhbmltYXRpb25zLCBlYXNpbmcsIGR1cmF0aW9uLCBzdGVwLCBjb21wbGV0ZSwgbWFrZVZhbHVlQ29sbGVjdG9yLCBjdXJyZW50VmFsdWVzLCBjb2xsZWN0VmFsdWUsIGR1bW15LCBkdW1teU9wdGlvbnM7XG5cdFx0XHRwcm9taXNlID0gbmV3IFByb21pc2UoIGZ1bmN0aW9uKCBmdWxmaWwgKSB7XG5cdFx0XHRcdGZ1bGZpbFByb21pc2UgPSBmdWxmaWw7XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoIHR5cGVvZiBrZXlwYXRoID09PSAnb2JqZWN0JyApIHtcblx0XHRcdFx0b3B0aW9ucyA9IHRvIHx8IHt9O1xuXHRcdFx0XHRlYXNpbmcgPSBvcHRpb25zLmVhc2luZztcblx0XHRcdFx0ZHVyYXRpb24gPSBvcHRpb25zLmR1cmF0aW9uO1xuXHRcdFx0XHRhbmltYXRpb25zID0gW107XG5cdFx0XHRcdHN0ZXAgPSBvcHRpb25zLnN0ZXA7XG5cdFx0XHRcdGNvbXBsZXRlID0gb3B0aW9ucy5jb21wbGV0ZTtcblx0XHRcdFx0aWYgKCBzdGVwIHx8IGNvbXBsZXRlICkge1xuXHRcdFx0XHRcdGN1cnJlbnRWYWx1ZXMgPSB7fTtcblx0XHRcdFx0XHRvcHRpb25zLnN0ZXAgPSBudWxsO1xuXHRcdFx0XHRcdG9wdGlvbnMuY29tcGxldGUgPSBudWxsO1xuXHRcdFx0XHRcdG1ha2VWYWx1ZUNvbGxlY3RvciA9IGZ1bmN0aW9uKCBrZXlwYXRoICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCB0LCB2YWx1ZSApIHtcblx0XHRcdFx0XHRcdFx0Y3VycmVudFZhbHVlc1sga2V5cGF0aCBdID0gdmFsdWU7XG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblx0XHRcdFx0Zm9yICggayBpbiBrZXlwYXRoICkge1xuXHRcdFx0XHRcdGlmICgga2V5cGF0aC5oYXNPd25Qcm9wZXJ0eSggayApICkge1xuXHRcdFx0XHRcdFx0aWYgKCBzdGVwIHx8IGNvbXBsZXRlICkge1xuXHRcdFx0XHRcdFx0XHRjb2xsZWN0VmFsdWUgPSBtYWtlVmFsdWVDb2xsZWN0b3IoIGsgKTtcblx0XHRcdFx0XHRcdFx0b3B0aW9ucyA9IHtcblx0XHRcdFx0XHRcdFx0XHRlYXNpbmc6IGVhc2luZyxcblx0XHRcdFx0XHRcdFx0XHRkdXJhdGlvbjogZHVyYXRpb25cblx0XHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdFx0aWYgKCBzdGVwICkge1xuXHRcdFx0XHRcdFx0XHRcdG9wdGlvbnMuc3RlcCA9IGNvbGxlY3RWYWx1ZTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0b3B0aW9ucy5jb21wbGV0ZSA9IGNvbXBsZXRlID8gY29sbGVjdFZhbHVlIDogbm9vcDtcblx0XHRcdFx0XHRcdGFuaW1hdGlvbnMucHVzaCggYW5pbWF0ZSggdGhpcywgaywga2V5cGF0aFsgayBdLCBvcHRpb25zICkgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBzdGVwIHx8IGNvbXBsZXRlICkge1xuXHRcdFx0XHRcdGR1bW15T3B0aW9ucyA9IHtcblx0XHRcdFx0XHRcdGVhc2luZzogZWFzaW5nLFxuXHRcdFx0XHRcdFx0ZHVyYXRpb246IGR1cmF0aW9uXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRpZiAoIHN0ZXAgKSB7XG5cdFx0XHRcdFx0XHRkdW1teU9wdGlvbnMuc3RlcCA9IGZ1bmN0aW9uKCB0ICkge1xuXHRcdFx0XHRcdFx0XHRzdGVwKCB0LCBjdXJyZW50VmFsdWVzICk7XG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIGNvbXBsZXRlICkge1xuXHRcdFx0XHRcdFx0cHJvbWlzZS50aGVuKCBmdW5jdGlvbiggdCApIHtcblx0XHRcdFx0XHRcdFx0Y29tcGxldGUoIHQsIGN1cnJlbnRWYWx1ZXMgKTtcblx0XHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZHVtbXlPcHRpb25zLmNvbXBsZXRlID0gZnVsZmlsUHJvbWlzZTtcblx0XHRcdFx0XHRkdW1teSA9IGFuaW1hdGUoIHRoaXMsIG51bGwsIG51bGwsIGR1bW15T3B0aW9ucyApO1xuXHRcdFx0XHRcdGFuaW1hdGlvbnMucHVzaCggZHVtbXkgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHN0b3A6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0dmFyIGFuaW1hdGlvbjtcblx0XHRcdFx0XHRcdHdoaWxlICggYW5pbWF0aW9uID0gYW5pbWF0aW9ucy5wb3AoKSApIHtcblx0XHRcdFx0XHRcdFx0YW5pbWF0aW9uLnN0b3AoKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmICggZHVtbXkgKSB7XG5cdFx0XHRcdFx0XHRcdGR1bW15LnN0b3AoKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0XHRvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblx0XHRcdGlmICggb3B0aW9ucy5jb21wbGV0ZSApIHtcblx0XHRcdFx0cHJvbWlzZS50aGVuKCBvcHRpb25zLmNvbXBsZXRlICk7XG5cdFx0XHR9XG5cdFx0XHRvcHRpb25zLmNvbXBsZXRlID0gZnVsZmlsUHJvbWlzZTtcblx0XHRcdGFuaW1hdGlvbiA9IGFuaW1hdGUoIHRoaXMsIGtleXBhdGgsIHRvLCBvcHRpb25zICk7XG5cdFx0XHRwcm9taXNlLnN0b3AgPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0YW5pbWF0aW9uLnN0b3AoKTtcblx0XHRcdH07XG5cdFx0XHRyZXR1cm4gcHJvbWlzZTtcblx0XHR9O1xuXG5cdFx0ZnVuY3Rpb24gYW5pbWF0ZSggcm9vdCwga2V5cGF0aCwgdG8sIG9wdGlvbnMgKSB7XG5cdFx0XHR2YXIgZWFzaW5nLCBkdXJhdGlvbiwgYW5pbWF0aW9uLCBmcm9tO1xuXHRcdFx0aWYgKCBrZXlwYXRoICkge1xuXHRcdFx0XHRrZXlwYXRoID0gbm9ybWFsaXNlS2V5cGF0aCgga2V5cGF0aCApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBrZXlwYXRoICE9PSBudWxsICkge1xuXHRcdFx0XHRmcm9tID0gZ2V0KCByb290LCBrZXlwYXRoICk7XG5cdFx0XHR9XG5cdFx0XHRhbmltYXRpb25zLmFib3J0KCBrZXlwYXRoLCByb290ICk7XG5cdFx0XHRpZiAoIGlzRXF1YWwoIGZyb20sIHRvICkgKSB7XG5cdFx0XHRcdGlmICggb3B0aW9ucy5jb21wbGV0ZSApIHtcblx0XHRcdFx0XHRvcHRpb25zLmNvbXBsZXRlKCBvcHRpb25zLnRvICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIG5vQW5pbWF0aW9uO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBvcHRpb25zLmVhc2luZyApIHtcblx0XHRcdFx0aWYgKCB0eXBlb2Ygb3B0aW9ucy5lYXNpbmcgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRcdFx0ZWFzaW5nID0gb3B0aW9ucy5lYXNpbmc7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZWFzaW5nID0gcm9vdC5lYXNpbmdbIG9wdGlvbnMuZWFzaW5nIF07XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCB0eXBlb2YgZWFzaW5nICE9PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0XHRcdGVhc2luZyA9IG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGR1cmF0aW9uID0gb3B0aW9ucy5kdXJhdGlvbiA9PT0gdW5kZWZpbmVkID8gNDAwIDogb3B0aW9ucy5kdXJhdGlvbjtcblx0XHRcdGFuaW1hdGlvbiA9IG5ldyBBbmltYXRpb24oIHtcblx0XHRcdFx0a2V5cGF0aDoga2V5cGF0aCxcblx0XHRcdFx0ZnJvbTogZnJvbSxcblx0XHRcdFx0dG86IHRvLFxuXHRcdFx0XHRyb290OiByb290LFxuXHRcdFx0XHRkdXJhdGlvbjogZHVyYXRpb24sXG5cdFx0XHRcdGVhc2luZzogZWFzaW5nLFxuXHRcdFx0XHRpbnRlcnBvbGF0b3I6IG9wdGlvbnMuaW50ZXJwb2xhdG9yLFxuXHRcdFx0XHRzdGVwOiBvcHRpb25zLnN0ZXAsXG5cdFx0XHRcdGNvbXBsZXRlOiBvcHRpb25zLmNvbXBsZXRlXG5cdFx0XHR9ICk7XG5cdFx0XHRhbmltYXRpb25zLmFkZCggYW5pbWF0aW9uICk7XG5cdFx0XHRyb290Ll9hbmltYXRpb25zLnB1c2goIGFuaW1hdGlvbiApO1xuXHRcdFx0cmV0dXJuIGFuaW1hdGlvbjtcblx0XHR9XG5cdH0oIHV0aWxzX2lzRXF1YWwsIHV0aWxzX1Byb21pc2UsIHV0aWxzX25vcm1hbGlzZUtleXBhdGgsIHNoYXJlZF9hbmltYXRpb25zLCBzaGFyZWRfZ2V0X19nZXQsIFJhY3RpdmVfcHJvdG90eXBlX2FuaW1hdGVfQW5pbWF0aW9uICk7XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX2RldGFjaCA9IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiB0aGlzLmZyYWdtZW50LmRldGFjaCgpO1xuXHR9O1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9maW5kID0gZnVuY3Rpb24oIHNlbGVjdG9yICkge1xuXHRcdGlmICggIXRoaXMuZWwgKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuZnJhZ21lbnQuZmluZCggc2VsZWN0b3IgKTtcblx0fTtcblxuXHR2YXIgdXRpbHNfbWF0Y2hlcyA9IGZ1bmN0aW9uKCBpc0NsaWVudCwgdmVuZG9ycywgY3JlYXRlRWxlbWVudCApIHtcblxuXHRcdHZhciBkaXYsIG1ldGhvZE5hbWVzLCB1bnByZWZpeGVkLCBwcmVmaXhlZCwgaSwgaiwgbWFrZUZ1bmN0aW9uO1xuXHRcdGlmICggIWlzQ2xpZW50ICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRkaXYgPSBjcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuXHRcdG1ldGhvZE5hbWVzID0gW1xuXHRcdFx0J21hdGNoZXMnLFxuXHRcdFx0J21hdGNoZXNTZWxlY3Rvcidcblx0XHRdO1xuXHRcdG1ha2VGdW5jdGlvbiA9IGZ1bmN0aW9uKCBtZXRob2ROYW1lICkge1xuXHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCBub2RlLCBzZWxlY3RvciApIHtcblx0XHRcdFx0cmV0dXJuIG5vZGVbIG1ldGhvZE5hbWUgXSggc2VsZWN0b3IgKTtcblx0XHRcdH07XG5cdFx0fTtcblx0XHRpID0gbWV0aG9kTmFtZXMubGVuZ3RoO1xuXHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0dW5wcmVmaXhlZCA9IG1ldGhvZE5hbWVzWyBpIF07XG5cdFx0XHRpZiAoIGRpdlsgdW5wcmVmaXhlZCBdICkge1xuXHRcdFx0XHRyZXR1cm4gbWFrZUZ1bmN0aW9uKCB1bnByZWZpeGVkICk7XG5cdFx0XHR9XG5cdFx0XHRqID0gdmVuZG9ycy5sZW5ndGg7XG5cdFx0XHR3aGlsZSAoIGotLSApIHtcblx0XHRcdFx0cHJlZml4ZWQgPSB2ZW5kb3JzWyBpIF0gKyB1bnByZWZpeGVkLnN1YnN0ciggMCwgMSApLnRvVXBwZXJDYXNlKCkgKyB1bnByZWZpeGVkLnN1YnN0cmluZyggMSApO1xuXHRcdFx0XHRpZiAoIGRpdlsgcHJlZml4ZWQgXSApIHtcblx0XHRcdFx0XHRyZXR1cm4gbWFrZUZ1bmN0aW9uKCBwcmVmaXhlZCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBmdW5jdGlvbiggbm9kZSwgc2VsZWN0b3IgKSB7XG5cdFx0XHR2YXIgbm9kZXMsIGk7XG5cdFx0XHRub2RlcyA9ICggbm9kZS5wYXJlbnROb2RlIHx8IG5vZGUuZG9jdW1lbnQgKS5xdWVyeVNlbGVjdG9yQWxsKCBzZWxlY3RvciApO1xuXHRcdFx0aSA9IG5vZGVzLmxlbmd0aDtcblx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRpZiAoIG5vZGVzWyBpIF0gPT09IG5vZGUgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9O1xuXHR9KCBjb25maWdfaXNDbGllbnQsIGNvbmZpZ192ZW5kb3JzLCB1dGlsc19jcmVhdGVFbGVtZW50ICk7XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX3NoYXJlZF9tYWtlUXVlcnlfdGVzdCA9IGZ1bmN0aW9uKCBtYXRjaGVzICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBpdGVtLCBub0RpcnR5ICkge1xuXHRcdFx0dmFyIGl0ZW1NYXRjaGVzID0gdGhpcy5faXNDb21wb25lbnRRdWVyeSA/ICF0aGlzLnNlbGVjdG9yIHx8IGl0ZW0ubmFtZSA9PT0gdGhpcy5zZWxlY3RvciA6IG1hdGNoZXMoIGl0ZW0ubm9kZSwgdGhpcy5zZWxlY3RvciApO1xuXHRcdFx0aWYgKCBpdGVtTWF0Y2hlcyApIHtcblx0XHRcdFx0dGhpcy5wdXNoKCBpdGVtLm5vZGUgfHwgaXRlbS5pbnN0YW5jZSApO1xuXHRcdFx0XHRpZiAoICFub0RpcnR5ICkge1xuXHRcdFx0XHRcdHRoaXMuX21ha2VEaXJ0eSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH07XG5cdH0oIHV0aWxzX21hdGNoZXMgKTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfc2hhcmVkX21ha2VRdWVyeV9jYW5jZWwgPSBmdW5jdGlvbigpIHtcblx0XHR2YXIgbGl2ZVF1ZXJpZXMsIHNlbGVjdG9yLCBpbmRleDtcblx0XHRsaXZlUXVlcmllcyA9IHRoaXMuX3Jvb3RbIHRoaXMuX2lzQ29tcG9uZW50UXVlcnkgPyAnbGl2ZUNvbXBvbmVudFF1ZXJpZXMnIDogJ2xpdmVRdWVyaWVzJyBdO1xuXHRcdHNlbGVjdG9yID0gdGhpcy5zZWxlY3Rvcjtcblx0XHRpbmRleCA9IGxpdmVRdWVyaWVzLmluZGV4T2YoIHNlbGVjdG9yICk7XG5cdFx0aWYgKCBpbmRleCAhPT0gLTEgKSB7XG5cdFx0XHRsaXZlUXVlcmllcy5zcGxpY2UoIGluZGV4LCAxICk7XG5cdFx0XHRsaXZlUXVlcmllc1sgc2VsZWN0b3IgXSA9IG51bGw7XG5cdFx0fVxuXHR9O1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9zaGFyZWRfbWFrZVF1ZXJ5X3NvcnRCeUl0ZW1Qb3NpdGlvbiA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBhLCBiICkge1xuXHRcdFx0dmFyIGFuY2VzdHJ5QSwgYW5jZXN0cnlCLCBvbGRlc3RBLCBvbGRlc3RCLCBtdXR1YWxBbmNlc3RvciwgaW5kZXhBLCBpbmRleEIsIGZyYWdtZW50cywgZnJhZ21lbnRBLCBmcmFnbWVudEI7XG5cdFx0XHRhbmNlc3RyeUEgPSBnZXRBbmNlc3RyeSggYS5jb21wb25lbnQgfHwgYS5fcmFjdGl2ZS5wcm94eSApO1xuXHRcdFx0YW5jZXN0cnlCID0gZ2V0QW5jZXN0cnkoIGIuY29tcG9uZW50IHx8IGIuX3JhY3RpdmUucHJveHkgKTtcblx0XHRcdG9sZGVzdEEgPSBhbmNlc3RyeUFbIGFuY2VzdHJ5QS5sZW5ndGggLSAxIF07XG5cdFx0XHRvbGRlc3RCID0gYW5jZXN0cnlCWyBhbmNlc3RyeUIubGVuZ3RoIC0gMSBdO1xuXHRcdFx0d2hpbGUgKCBvbGRlc3RBICYmIG9sZGVzdEEgPT09IG9sZGVzdEIgKSB7XG5cdFx0XHRcdGFuY2VzdHJ5QS5wb3AoKTtcblx0XHRcdFx0YW5jZXN0cnlCLnBvcCgpO1xuXHRcdFx0XHRtdXR1YWxBbmNlc3RvciA9IG9sZGVzdEE7XG5cdFx0XHRcdG9sZGVzdEEgPSBhbmNlc3RyeUFbIGFuY2VzdHJ5QS5sZW5ndGggLSAxIF07XG5cdFx0XHRcdG9sZGVzdEIgPSBhbmNlc3RyeUJbIGFuY2VzdHJ5Qi5sZW5ndGggLSAxIF07XG5cdFx0XHR9XG5cdFx0XHRvbGRlc3RBID0gb2xkZXN0QS5jb21wb25lbnQgfHwgb2xkZXN0QTtcblx0XHRcdG9sZGVzdEIgPSBvbGRlc3RCLmNvbXBvbmVudCB8fCBvbGRlc3RCO1xuXHRcdFx0ZnJhZ21lbnRBID0gb2xkZXN0QS5wYXJlbnRGcmFnbWVudDtcblx0XHRcdGZyYWdtZW50QiA9IG9sZGVzdEIucGFyZW50RnJhZ21lbnQ7XG5cdFx0XHRpZiAoIGZyYWdtZW50QSA9PT0gZnJhZ21lbnRCICkge1xuXHRcdFx0XHRpbmRleEEgPSBmcmFnbWVudEEuaXRlbXMuaW5kZXhPZiggb2xkZXN0QSApO1xuXHRcdFx0XHRpbmRleEIgPSBmcmFnbWVudEIuaXRlbXMuaW5kZXhPZiggb2xkZXN0QiApO1xuXHRcdFx0XHRyZXR1cm4gaW5kZXhBIC0gaW5kZXhCIHx8IGFuY2VzdHJ5QS5sZW5ndGggLSBhbmNlc3RyeUIubGVuZ3RoO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBmcmFnbWVudHMgPSBtdXR1YWxBbmNlc3Rvci5mcmFnbWVudHMgKSB7XG5cdFx0XHRcdGluZGV4QSA9IGZyYWdtZW50cy5pbmRleE9mKCBmcmFnbWVudEEgKTtcblx0XHRcdFx0aW5kZXhCID0gZnJhZ21lbnRzLmluZGV4T2YoIGZyYWdtZW50QiApO1xuXHRcdFx0XHRyZXR1cm4gaW5kZXhBIC0gaW5kZXhCIHx8IGFuY2VzdHJ5QS5sZW5ndGggLSBhbmNlc3RyeUIubGVuZ3RoO1xuXHRcdFx0fVxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnQW4gdW5leHBlY3RlZCBjb25kaXRpb24gd2FzIG1ldCB3aGlsZSBjb21wYXJpbmcgdGhlIHBvc2l0aW9uIG9mIHR3byBjb21wb25lbnRzLiBQbGVhc2UgZmlsZSBhbiBpc3N1ZSBhdCBodHRwczovL2dpdGh1Yi5jb20vUmFjdGl2ZUpTL1JhY3RpdmUvaXNzdWVzIC0gdGhhbmtzIScgKTtcblx0XHR9O1xuXG5cdFx0ZnVuY3Rpb24gZ2V0UGFyZW50KCBpdGVtICkge1xuXHRcdFx0dmFyIHBhcmVudEZyYWdtZW50O1xuXHRcdFx0aWYgKCBwYXJlbnRGcmFnbWVudCA9IGl0ZW0ucGFyZW50RnJhZ21lbnQgKSB7XG5cdFx0XHRcdHJldHVybiBwYXJlbnRGcmFnbWVudC5vd25lcjtcblx0XHRcdH1cblx0XHRcdGlmICggaXRlbS5jb21wb25lbnQgJiYgKCBwYXJlbnRGcmFnbWVudCA9IGl0ZW0uY29tcG9uZW50LnBhcmVudEZyYWdtZW50ICkgKSB7XG5cdFx0XHRcdHJldHVybiBwYXJlbnRGcmFnbWVudC5vd25lcjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXRBbmNlc3RyeSggaXRlbSApIHtcblx0XHRcdHZhciBhbmNlc3RyeSwgYW5jZXN0b3I7XG5cdFx0XHRhbmNlc3RyeSA9IFsgaXRlbSBdO1xuXHRcdFx0YW5jZXN0b3IgPSBnZXRQYXJlbnQoIGl0ZW0gKTtcblx0XHRcdHdoaWxlICggYW5jZXN0b3IgKSB7XG5cdFx0XHRcdGFuY2VzdHJ5LnB1c2goIGFuY2VzdG9yICk7XG5cdFx0XHRcdGFuY2VzdG9yID0gZ2V0UGFyZW50KCBhbmNlc3RvciApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGFuY2VzdHJ5O1xuXHRcdH1cblx0fSgpO1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9zaGFyZWRfbWFrZVF1ZXJ5X3NvcnRCeURvY3VtZW50UG9zaXRpb24gPSBmdW5jdGlvbiggc29ydEJ5SXRlbVBvc2l0aW9uICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBub2RlLCBvdGhlck5vZGUgKSB7XG5cdFx0XHR2YXIgYml0bWFzaztcblx0XHRcdGlmICggbm9kZS5jb21wYXJlRG9jdW1lbnRQb3NpdGlvbiApIHtcblx0XHRcdFx0Yml0bWFzayA9IG5vZGUuY29tcGFyZURvY3VtZW50UG9zaXRpb24oIG90aGVyTm9kZSApO1xuXHRcdFx0XHRyZXR1cm4gYml0bWFzayAmIDIgPyAxIDogLTE7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gc29ydEJ5SXRlbVBvc2l0aW9uKCBub2RlLCBvdGhlck5vZGUgKTtcblx0XHR9O1xuXHR9KCBSYWN0aXZlX3Byb3RvdHlwZV9zaGFyZWRfbWFrZVF1ZXJ5X3NvcnRCeUl0ZW1Qb3NpdGlvbiApO1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9zaGFyZWRfbWFrZVF1ZXJ5X3NvcnQgPSBmdW5jdGlvbiggc29ydEJ5RG9jdW1lbnRQb3NpdGlvbiwgc29ydEJ5SXRlbVBvc2l0aW9uICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5zb3J0KCB0aGlzLl9pc0NvbXBvbmVudFF1ZXJ5ID8gc29ydEJ5SXRlbVBvc2l0aW9uIDogc29ydEJ5RG9jdW1lbnRQb3NpdGlvbiApO1xuXHRcdFx0dGhpcy5fZGlydHkgPSBmYWxzZTtcblx0XHR9O1xuXHR9KCBSYWN0aXZlX3Byb3RvdHlwZV9zaGFyZWRfbWFrZVF1ZXJ5X3NvcnRCeURvY3VtZW50UG9zaXRpb24sIFJhY3RpdmVfcHJvdG90eXBlX3NoYXJlZF9tYWtlUXVlcnlfc29ydEJ5SXRlbVBvc2l0aW9uICk7XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX3NoYXJlZF9tYWtlUXVlcnlfZGlydHkgPSBmdW5jdGlvbiggcnVubG9vcCApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbigpIHtcblx0XHRcdGlmICggIXRoaXMuX2RpcnR5ICkge1xuXHRcdFx0XHRydW5sb29wLmFkZExpdmVRdWVyeSggdGhpcyApO1xuXHRcdFx0XHR0aGlzLl9kaXJ0eSA9IHRydWU7XG5cdFx0XHR9XG5cdFx0fTtcblx0fSggZ2xvYmFsX3J1bmxvb3AgKTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfc2hhcmVkX21ha2VRdWVyeV9yZW1vdmUgPSBmdW5jdGlvbiggbm9kZU9yQ29tcG9uZW50ICkge1xuXHRcdHZhciBpbmRleCA9IHRoaXMuaW5kZXhPZiggdGhpcy5faXNDb21wb25lbnRRdWVyeSA/IG5vZGVPckNvbXBvbmVudC5pbnN0YW5jZSA6IG5vZGVPckNvbXBvbmVudCApO1xuXHRcdGlmICggaW5kZXggIT09IC0xICkge1xuXHRcdFx0dGhpcy5zcGxpY2UoIGluZGV4LCAxICk7XG5cdFx0fVxuXHR9O1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9zaGFyZWRfbWFrZVF1ZXJ5X19tYWtlUXVlcnkgPSBmdW5jdGlvbiggZGVmaW5lUHJvcGVydGllcywgdGVzdCwgY2FuY2VsLCBzb3J0LCBkaXJ0eSwgcmVtb3ZlICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCByYWN0aXZlLCBzZWxlY3RvciwgbGl2ZSwgaXNDb21wb25lbnRRdWVyeSApIHtcblx0XHRcdHZhciBxdWVyeSA9IFtdO1xuXHRcdFx0ZGVmaW5lUHJvcGVydGllcyggcXVlcnksIHtcblx0XHRcdFx0c2VsZWN0b3I6IHtcblx0XHRcdFx0XHR2YWx1ZTogc2VsZWN0b3Jcblx0XHRcdFx0fSxcblx0XHRcdFx0bGl2ZToge1xuXHRcdFx0XHRcdHZhbHVlOiBsaXZlXG5cdFx0XHRcdH0sXG5cdFx0XHRcdF9pc0NvbXBvbmVudFF1ZXJ5OiB7XG5cdFx0XHRcdFx0dmFsdWU6IGlzQ29tcG9uZW50UXVlcnlcblx0XHRcdFx0fSxcblx0XHRcdFx0X3Rlc3Q6IHtcblx0XHRcdFx0XHR2YWx1ZTogdGVzdFxuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoICFsaXZlICkge1xuXHRcdFx0XHRyZXR1cm4gcXVlcnk7XG5cdFx0XHR9XG5cdFx0XHRkZWZpbmVQcm9wZXJ0aWVzKCBxdWVyeSwge1xuXHRcdFx0XHRjYW5jZWw6IHtcblx0XHRcdFx0XHR2YWx1ZTogY2FuY2VsXG5cdFx0XHRcdH0sXG5cdFx0XHRcdF9yb290OiB7XG5cdFx0XHRcdFx0dmFsdWU6IHJhY3RpdmVcblx0XHRcdFx0fSxcblx0XHRcdFx0X3NvcnQ6IHtcblx0XHRcdFx0XHR2YWx1ZTogc29ydFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRfbWFrZURpcnR5OiB7XG5cdFx0XHRcdFx0dmFsdWU6IGRpcnR5XG5cdFx0XHRcdH0sXG5cdFx0XHRcdF9yZW1vdmU6IHtcblx0XHRcdFx0XHR2YWx1ZTogcmVtb3ZlXG5cdFx0XHRcdH0sXG5cdFx0XHRcdF9kaXJ0eToge1xuXHRcdFx0XHRcdHZhbHVlOiBmYWxzZSxcblx0XHRcdFx0XHR3cml0YWJsZTogdHJ1ZVxuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRyZXR1cm4gcXVlcnk7XG5cdFx0fTtcblx0fSggdXRpbHNfZGVmaW5lUHJvcGVydGllcywgUmFjdGl2ZV9wcm90b3R5cGVfc2hhcmVkX21ha2VRdWVyeV90ZXN0LCBSYWN0aXZlX3Byb3RvdHlwZV9zaGFyZWRfbWFrZVF1ZXJ5X2NhbmNlbCwgUmFjdGl2ZV9wcm90b3R5cGVfc2hhcmVkX21ha2VRdWVyeV9zb3J0LCBSYWN0aXZlX3Byb3RvdHlwZV9zaGFyZWRfbWFrZVF1ZXJ5X2RpcnR5LCBSYWN0aXZlX3Byb3RvdHlwZV9zaGFyZWRfbWFrZVF1ZXJ5X3JlbW92ZSApO1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9maW5kQWxsID0gZnVuY3Rpb24oIG1ha2VRdWVyeSApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggc2VsZWN0b3IsIG9wdGlvbnMgKSB7XG5cdFx0XHR2YXIgbGl2ZVF1ZXJpZXMsIHF1ZXJ5O1xuXHRcdFx0aWYgKCAhdGhpcy5lbCApIHtcblx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0fVxuXHRcdFx0b3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cdFx0XHRsaXZlUXVlcmllcyA9IHRoaXMuX2xpdmVRdWVyaWVzO1xuXHRcdFx0aWYgKCBxdWVyeSA9IGxpdmVRdWVyaWVzWyBzZWxlY3RvciBdICkge1xuXHRcdFx0XHRyZXR1cm4gb3B0aW9ucyAmJiBvcHRpb25zLmxpdmUgPyBxdWVyeSA6IHF1ZXJ5LnNsaWNlKCk7XG5cdFx0XHR9XG5cdFx0XHRxdWVyeSA9IG1ha2VRdWVyeSggdGhpcywgc2VsZWN0b3IsICEhIG9wdGlvbnMubGl2ZSwgZmFsc2UgKTtcblx0XHRcdGlmICggcXVlcnkubGl2ZSApIHtcblx0XHRcdFx0bGl2ZVF1ZXJpZXMucHVzaCggc2VsZWN0b3IgKTtcblx0XHRcdFx0bGl2ZVF1ZXJpZXNbIHNlbGVjdG9yIF0gPSBxdWVyeTtcblx0XHRcdH1cblx0XHRcdHRoaXMuZnJhZ21lbnQuZmluZEFsbCggc2VsZWN0b3IsIHF1ZXJ5ICk7XG5cdFx0XHRyZXR1cm4gcXVlcnk7XG5cdFx0fTtcblx0fSggUmFjdGl2ZV9wcm90b3R5cGVfc2hhcmVkX21ha2VRdWVyeV9fbWFrZVF1ZXJ5ICk7XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX2ZpbmRBbGxDb21wb25lbnRzID0gZnVuY3Rpb24oIG1ha2VRdWVyeSApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggc2VsZWN0b3IsIG9wdGlvbnMgKSB7XG5cdFx0XHR2YXIgbGl2ZVF1ZXJpZXMsIHF1ZXJ5O1xuXHRcdFx0b3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cdFx0XHRsaXZlUXVlcmllcyA9IHRoaXMuX2xpdmVDb21wb25lbnRRdWVyaWVzO1xuXHRcdFx0aWYgKCBxdWVyeSA9IGxpdmVRdWVyaWVzWyBzZWxlY3RvciBdICkge1xuXHRcdFx0XHRyZXR1cm4gb3B0aW9ucyAmJiBvcHRpb25zLmxpdmUgPyBxdWVyeSA6IHF1ZXJ5LnNsaWNlKCk7XG5cdFx0XHR9XG5cdFx0XHRxdWVyeSA9IG1ha2VRdWVyeSggdGhpcywgc2VsZWN0b3IsICEhIG9wdGlvbnMubGl2ZSwgdHJ1ZSApO1xuXHRcdFx0aWYgKCBxdWVyeS5saXZlICkge1xuXHRcdFx0XHRsaXZlUXVlcmllcy5wdXNoKCBzZWxlY3RvciApO1xuXHRcdFx0XHRsaXZlUXVlcmllc1sgc2VsZWN0b3IgXSA9IHF1ZXJ5O1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5mcmFnbWVudC5maW5kQWxsQ29tcG9uZW50cyggc2VsZWN0b3IsIHF1ZXJ5ICk7XG5cdFx0XHRyZXR1cm4gcXVlcnk7XG5cdFx0fTtcblx0fSggUmFjdGl2ZV9wcm90b3R5cGVfc2hhcmVkX21ha2VRdWVyeV9fbWFrZVF1ZXJ5ICk7XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX2ZpbmRDb21wb25lbnQgPSBmdW5jdGlvbiggc2VsZWN0b3IgKSB7XG5cdFx0cmV0dXJuIHRoaXMuZnJhZ21lbnQuZmluZENvbXBvbmVudCggc2VsZWN0b3IgKTtcblx0fTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfZmlyZSA9IGZ1bmN0aW9uKCBldmVudE5hbWUgKSB7XG5cdFx0dmFyIGFyZ3MsIGksIGxlbiwgc3Vic2NyaWJlcnMgPSB0aGlzLl9zdWJzWyBldmVudE5hbWUgXTtcblx0XHRpZiAoICFzdWJzY3JpYmVycyApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0YXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKCBhcmd1bWVudHMsIDEgKTtcblx0XHRmb3IgKCBpID0gMCwgbGVuID0gc3Vic2NyaWJlcnMubGVuZ3RoOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRzdWJzY3JpYmVyc1sgaSBdLmFwcGx5KCB0aGlzLCBhcmdzICk7XG5cdFx0fVxuXHR9O1xuXG5cdHZhciBzaGFyZWRfZ2V0X1VucmVzb2x2ZWRJbXBsaWNpdERlcGVuZGVuY3kgPSBmdW5jdGlvbiggY2lyY3VsYXIsIHJlbW92ZUZyb21BcnJheSwgcnVubG9vcCwgbm90aWZ5RGVwZW5kYW50cyApIHtcblxuXHRcdHZhciBnZXQsIGVtcHR5ID0ge307XG5cdFx0Y2lyY3VsYXIucHVzaCggZnVuY3Rpb24oKSB7XG5cdFx0XHRnZXQgPSBjaXJjdWxhci5nZXQ7XG5cdFx0fSApO1xuXHRcdHZhciBVbnJlc29sdmVkSW1wbGljaXREZXBlbmRlbmN5ID0gZnVuY3Rpb24oIHJhY3RpdmUsIGtleXBhdGggKSB7XG5cdFx0XHR0aGlzLnJvb3QgPSByYWN0aXZlO1xuXHRcdFx0dGhpcy5yZWYgPSBrZXlwYXRoO1xuXHRcdFx0dGhpcy5wYXJlbnRGcmFnbWVudCA9IGVtcHR5O1xuXHRcdFx0cmFjdGl2ZS5fdW5yZXNvbHZlZEltcGxpY2l0RGVwZW5kZW5jaWVzWyBrZXlwYXRoIF0gPSB0cnVlO1xuXHRcdFx0cmFjdGl2ZS5fdW5yZXNvbHZlZEltcGxpY2l0RGVwZW5kZW5jaWVzLnB1c2goIHRoaXMgKTtcblx0XHRcdHJ1bmxvb3AuYWRkVW5yZXNvbHZlZCggdGhpcyApO1xuXHRcdH07XG5cdFx0VW5yZXNvbHZlZEltcGxpY2l0RGVwZW5kZW5jeS5wcm90b3R5cGUgPSB7XG5cdFx0XHRyZXNvbHZlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHJhY3RpdmUgPSB0aGlzLnJvb3Q7XG5cdFx0XHRcdG5vdGlmeURlcGVuZGFudHMoIHJhY3RpdmUsIHRoaXMucmVmICk7XG5cdFx0XHRcdHJhY3RpdmUuX3VucmVzb2x2ZWRJbXBsaWNpdERlcGVuZGVuY2llc1sgdGhpcy5yZWYgXSA9IGZhbHNlO1xuXHRcdFx0XHRyZW1vdmVGcm9tQXJyYXkoIHJhY3RpdmUuX3VucmVzb2x2ZWRJbXBsaWNpdERlcGVuZGVuY2llcywgdGhpcyApO1xuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cnVubG9vcC5yZW1vdmVVbnJlc29sdmVkKCB0aGlzICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gVW5yZXNvbHZlZEltcGxpY2l0RGVwZW5kZW5jeTtcblx0fSggY2lyY3VsYXIsIHV0aWxzX3JlbW92ZUZyb21BcnJheSwgZ2xvYmFsX3J1bmxvb3AsIHNoYXJlZF9ub3RpZnlEZXBlbmRhbnRzICk7XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX2dldCA9IGZ1bmN0aW9uKCBub3JtYWxpc2VLZXlwYXRoLCBnZXQsIFVucmVzb2x2ZWRJbXBsaWNpdERlcGVuZGVuY3kgKSB7XG5cblx0XHR2YXIgb3B0aW9ucyA9IHtcblx0XHRcdGlzVG9wTGV2ZWw6IHRydWVcblx0XHR9O1xuXHRcdHJldHVybiBmdW5jdGlvbiBSYWN0aXZlX3Byb3RvdHlwZV9nZXQoIGtleXBhdGggKSB7XG5cdFx0XHR2YXIgdmFsdWU7XG5cdFx0XHRrZXlwYXRoID0gbm9ybWFsaXNlS2V5cGF0aCgga2V5cGF0aCApO1xuXHRcdFx0dmFsdWUgPSBnZXQoIHRoaXMsIGtleXBhdGgsIG9wdGlvbnMgKTtcblx0XHRcdGlmICggdGhpcy5fY2FwdHVyZWQgJiYgdGhpcy5fY2FwdHVyZWRbIGtleXBhdGggXSAhPT0gdHJ1ZSApIHtcblx0XHRcdFx0dGhpcy5fY2FwdHVyZWQucHVzaCgga2V5cGF0aCApO1xuXHRcdFx0XHR0aGlzLl9jYXB0dXJlZFsga2V5cGF0aCBdID0gdHJ1ZTtcblx0XHRcdFx0aWYgKCB2YWx1ZSA9PT0gdW5kZWZpbmVkICYmIHRoaXMuX3VucmVzb2x2ZWRJbXBsaWNpdERlcGVuZGVuY2llc1sga2V5cGF0aCBdICE9PSB0cnVlICkge1xuXHRcdFx0XHRcdG5ldyBVbnJlc29sdmVkSW1wbGljaXREZXBlbmRlbmN5KCB0aGlzLCBrZXlwYXRoICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHR9O1xuXHR9KCB1dGlsc19ub3JtYWxpc2VLZXlwYXRoLCBzaGFyZWRfZ2V0X19nZXQsIHNoYXJlZF9nZXRfVW5yZXNvbHZlZEltcGxpY2l0RGVwZW5kZW5jeSApO1xuXG5cdHZhciB1dGlsc19nZXRFbGVtZW50ID0gZnVuY3Rpb24oIGlucHV0ICkge1xuXHRcdHZhciBvdXRwdXQ7XG5cdFx0aWYgKCB0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJyB8fCAhZG9jdW1lbnQgfHwgIWlucHV0ICkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGlmICggaW5wdXQubm9kZVR5cGUgKSB7XG5cdFx0XHRyZXR1cm4gaW5wdXQ7XG5cdFx0fVxuXHRcdGlmICggdHlwZW9mIGlucHV0ID09PSAnc3RyaW5nJyApIHtcblx0XHRcdG91dHB1dCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBpbnB1dCApO1xuXHRcdFx0aWYgKCAhb3V0cHV0ICYmIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IgKSB7XG5cdFx0XHRcdG91dHB1dCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoIGlucHV0ICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIG91dHB1dCAmJiBvdXRwdXQubm9kZVR5cGUgKSB7XG5cdFx0XHRcdHJldHVybiBvdXRwdXQ7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmICggaW5wdXRbIDAgXSAmJiBpbnB1dFsgMCBdLm5vZGVUeXBlICkge1xuXHRcdFx0cmV0dXJuIGlucHV0WyAwIF07XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9O1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9pbnNlcnQgPSBmdW5jdGlvbiggZ2V0RWxlbWVudCApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggdGFyZ2V0LCBhbmNob3IgKSB7XG5cdFx0XHR0YXJnZXQgPSBnZXRFbGVtZW50KCB0YXJnZXQgKTtcblx0XHRcdGFuY2hvciA9IGdldEVsZW1lbnQoIGFuY2hvciApIHx8IG51bGw7XG5cdFx0XHRpZiAoICF0YXJnZXQgKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ1lvdSBtdXN0IHNwZWNpZnkgYSB2YWxpZCB0YXJnZXQgdG8gaW5zZXJ0IGludG8nICk7XG5cdFx0XHR9XG5cdFx0XHR0YXJnZXQuaW5zZXJ0QmVmb3JlKCB0aGlzLmRldGFjaCgpLCBhbmNob3IgKTtcblx0XHRcdHRoaXMuZnJhZ21lbnQucE5vZGUgPSB0aGlzLmVsID0gdGFyZ2V0O1xuXHRcdH07XG5cdH0oIHV0aWxzX2dldEVsZW1lbnQgKTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfbWVyZ2VfbWFwT2xkVG9OZXdJbmRleCA9IGZ1bmN0aW9uKCBvbGRBcnJheSwgbmV3QXJyYXkgKSB7XG5cdFx0dmFyIHVzZWRJbmRpY2VzLCBmaXJzdFVudXNlZEluZGV4LCBuZXdJbmRpY2VzLCBjaGFuZ2VkO1xuXHRcdHVzZWRJbmRpY2VzID0ge307XG5cdFx0Zmlyc3RVbnVzZWRJbmRleCA9IDA7XG5cdFx0bmV3SW5kaWNlcyA9IG9sZEFycmF5Lm1hcCggZnVuY3Rpb24oIGl0ZW0sIGkgKSB7XG5cdFx0XHR2YXIgaW5kZXgsIHN0YXJ0LCBsZW47XG5cdFx0XHRzdGFydCA9IGZpcnN0VW51c2VkSW5kZXg7XG5cdFx0XHRsZW4gPSBuZXdBcnJheS5sZW5ndGg7XG5cdFx0XHRkbyB7XG5cdFx0XHRcdGluZGV4ID0gbmV3QXJyYXkuaW5kZXhPZiggaXRlbSwgc3RhcnQgKTtcblx0XHRcdFx0aWYgKCBpbmRleCA9PT0gLTEgKSB7XG5cdFx0XHRcdFx0Y2hhbmdlZCA9IHRydWU7XG5cdFx0XHRcdFx0cmV0dXJuIC0xO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHN0YXJ0ID0gaW5kZXggKyAxO1xuXHRcdFx0fSB3aGlsZSAoIHVzZWRJbmRpY2VzWyBpbmRleCBdICYmIHN0YXJ0IDwgbGVuICk7XG5cdFx0XHRpZiAoIGluZGV4ID09PSBmaXJzdFVudXNlZEluZGV4ICkge1xuXHRcdFx0XHRmaXJzdFVudXNlZEluZGV4ICs9IDE7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGluZGV4ICE9PSBpICkge1xuXHRcdFx0XHRjaGFuZ2VkID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdHVzZWRJbmRpY2VzWyBpbmRleCBdID0gdHJ1ZTtcblx0XHRcdHJldHVybiBpbmRleDtcblx0XHR9ICk7XG5cdFx0bmV3SW5kaWNlcy51bmNoYW5nZWQgPSAhY2hhbmdlZDtcblx0XHRyZXR1cm4gbmV3SW5kaWNlcztcblx0fTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfbWVyZ2VfcHJvcGFnYXRlQ2hhbmdlcyA9IGZ1bmN0aW9uKCB0eXBlcywgbm90aWZ5RGVwZW5kYW50cyApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggcmFjdGl2ZSwga2V5cGF0aCwgbmV3SW5kaWNlcywgbGVuZ3RoVW5jaGFuZ2VkICkge1xuXHRcdFx0dmFyIHVwZGF0ZURlcGVuZGFudDtcblx0XHRcdHJhY3RpdmUuX2NoYW5nZXMucHVzaCgga2V5cGF0aCApO1xuXHRcdFx0dXBkYXRlRGVwZW5kYW50ID0gZnVuY3Rpb24oIGRlcGVuZGFudCApIHtcblx0XHRcdFx0aWYgKCBkZXBlbmRhbnQudHlwZSA9PT0gdHlwZXMuUkVGRVJFTkNFICkge1xuXHRcdFx0XHRcdGRlcGVuZGFudC51cGRhdGUoKTtcblx0XHRcdFx0fSBlbHNlIGlmICggZGVwZW5kYW50LmtleXBhdGggPT09IGtleXBhdGggJiYgZGVwZW5kYW50LnR5cGUgPT09IHR5cGVzLlNFQ1RJT04gJiYgIWRlcGVuZGFudC5pbnZlcnRlZCAmJiBkZXBlbmRhbnQuZG9jRnJhZyApIHtcblx0XHRcdFx0XHRkZXBlbmRhbnQubWVyZ2UoIG5ld0luZGljZXMgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRkZXBlbmRhbnQudXBkYXRlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHRyYWN0aXZlLl9kZXBzLmZvckVhY2goIGZ1bmN0aW9uKCBkZXBzQnlLZXlwYXRoICkge1xuXHRcdFx0XHR2YXIgZGVwZW5kYW50cyA9IGRlcHNCeUtleXBhdGhbIGtleXBhdGggXTtcblx0XHRcdFx0aWYgKCBkZXBlbmRhbnRzICkge1xuXHRcdFx0XHRcdGRlcGVuZGFudHMuZm9yRWFjaCggdXBkYXRlRGVwZW5kYW50ICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdGlmICggIWxlbmd0aFVuY2hhbmdlZCApIHtcblx0XHRcdFx0bm90aWZ5RGVwZW5kYW50cyggcmFjdGl2ZSwga2V5cGF0aCArICcubGVuZ3RoJywgdHJ1ZSApO1xuXHRcdFx0fVxuXHRcdH07XG5cdH0oIGNvbmZpZ190eXBlcywgc2hhcmVkX25vdGlmeURlcGVuZGFudHMgKTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfbWVyZ2VfX21lcmdlID0gZnVuY3Rpb24oIHJ1bmxvb3AsIHdhcm4sIGlzQXJyYXksIFByb21pc2UsIHNldCwgbWFwT2xkVG9OZXdJbmRleCwgcHJvcGFnYXRlQ2hhbmdlcyApIHtcblxuXHRcdHZhciBjb21wYXJhdG9ycyA9IHt9O1xuXHRcdHJldHVybiBmdW5jdGlvbiBtZXJnZSgga2V5cGF0aCwgYXJyYXksIG9wdGlvbnMgKSB7XG5cdFx0XHR2YXIgY3VycmVudEFycmF5LCBvbGRBcnJheSwgbmV3QXJyYXksIGNvbXBhcmF0b3IsIGxlbmd0aFVuY2hhbmdlZCwgbmV3SW5kaWNlcywgcHJvbWlzZSwgZnVsZmlsUHJvbWlzZTtcblx0XHRcdGN1cnJlbnRBcnJheSA9IHRoaXMuZ2V0KCBrZXlwYXRoICk7XG5cdFx0XHRpZiAoICFpc0FycmF5KCBjdXJyZW50QXJyYXkgKSB8fCAhaXNBcnJheSggYXJyYXkgKSApIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuc2V0KCBrZXlwYXRoLCBhcnJheSwgb3B0aW9ucyAmJiBvcHRpb25zLmNvbXBsZXRlICk7XG5cdFx0XHR9XG5cdFx0XHRsZW5ndGhVbmNoYW5nZWQgPSBjdXJyZW50QXJyYXkubGVuZ3RoID09PSBhcnJheS5sZW5ndGg7XG5cdFx0XHRpZiAoIG9wdGlvbnMgJiYgb3B0aW9ucy5jb21wYXJlICkge1xuXHRcdFx0XHRjb21wYXJhdG9yID0gZ2V0Q29tcGFyYXRvckZ1bmN0aW9uKCBvcHRpb25zLmNvbXBhcmUgKTtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRvbGRBcnJheSA9IGN1cnJlbnRBcnJheS5tYXAoIGNvbXBhcmF0b3IgKTtcblx0XHRcdFx0XHRuZXdBcnJheSA9IGFycmF5Lm1hcCggY29tcGFyYXRvciApO1xuXHRcdFx0XHR9IGNhdGNoICggZXJyICkge1xuXHRcdFx0XHRcdGlmICggdGhpcy5kZWJ1ZyApIHtcblx0XHRcdFx0XHRcdHRocm93IGVycjtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0d2FybiggJ01lcmdlIG9wZXJhdGlvbjogY29tcGFyaXNvbiBmYWlsZWQuIEZhbGxpbmcgYmFjayB0byBpZGVudGl0eSBjaGVja2luZycgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0b2xkQXJyYXkgPSBjdXJyZW50QXJyYXk7XG5cdFx0XHRcdFx0bmV3QXJyYXkgPSBhcnJheTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0b2xkQXJyYXkgPSBjdXJyZW50QXJyYXk7XG5cdFx0XHRcdG5ld0FycmF5ID0gYXJyYXk7XG5cdFx0XHR9XG5cdFx0XHRuZXdJbmRpY2VzID0gbWFwT2xkVG9OZXdJbmRleCggb2xkQXJyYXksIG5ld0FycmF5ICk7XG5cdFx0XHRwcm9taXNlID0gbmV3IFByb21pc2UoIGZ1bmN0aW9uKCBmdWxmaWwgKSB7XG5cdFx0XHRcdGZ1bGZpbFByb21pc2UgPSBmdWxmaWw7XG5cdFx0XHR9ICk7XG5cdFx0XHRydW5sb29wLnN0YXJ0KCB0aGlzLCBmdWxmaWxQcm9taXNlICk7XG5cdFx0XHRzZXQoIHRoaXMsIGtleXBhdGgsIGFycmF5LCB0cnVlICk7XG5cdFx0XHRwcm9wYWdhdGVDaGFuZ2VzKCB0aGlzLCBrZXlwYXRoLCBuZXdJbmRpY2VzLCBsZW5ndGhVbmNoYW5nZWQgKTtcblx0XHRcdHJ1bmxvb3AuZW5kKCk7XG5cdFx0XHRpZiAoIG9wdGlvbnMgJiYgb3B0aW9ucy5jb21wbGV0ZSApIHtcblx0XHRcdFx0cHJvbWlzZS50aGVuKCBvcHRpb25zLmNvbXBsZXRlICk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcHJvbWlzZTtcblx0XHR9O1xuXG5cdFx0ZnVuY3Rpb24gc3RyaW5naWZ5KCBpdGVtICkge1xuXHRcdFx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KCBpdGVtICk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0Q29tcGFyYXRvckZ1bmN0aW9uKCBjb21wYXJhdG9yICkge1xuXHRcdFx0aWYgKCBjb21wYXJhdG9yID09PSB0cnVlICkge1xuXHRcdFx0XHRyZXR1cm4gc3RyaW5naWZ5O1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0eXBlb2YgY29tcGFyYXRvciA9PT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdGlmICggIWNvbXBhcmF0b3JzWyBjb21wYXJhdG9yIF0gKSB7XG5cdFx0XHRcdFx0Y29tcGFyYXRvcnNbIGNvbXBhcmF0b3IgXSA9IGZ1bmN0aW9uKCBpdGVtICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGl0ZW1bIGNvbXBhcmF0b3IgXTtcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBjb21wYXJhdG9yc1sgY29tcGFyYXRvciBdO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0eXBlb2YgY29tcGFyYXRvciA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdFx0cmV0dXJuIGNvbXBhcmF0b3I7XG5cdFx0XHR9XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdUaGUgYGNvbXBhcmVgIG9wdGlvbiBtdXN0IGJlIGEgZnVuY3Rpb24sIG9yIGEgc3RyaW5nIHJlcHJlc2VudGluZyBhbiBpZGVudGlmeWluZyBmaWVsZCAob3IgYHRydWVgIHRvIHVzZSBKU09OLnN0cmluZ2lmeSknICk7XG5cdFx0fVxuXHR9KCBnbG9iYWxfcnVubG9vcCwgdXRpbHNfd2FybiwgdXRpbHNfaXNBcnJheSwgdXRpbHNfUHJvbWlzZSwgc2hhcmVkX3NldCwgUmFjdGl2ZV9wcm90b3R5cGVfbWVyZ2VfbWFwT2xkVG9OZXdJbmRleCwgUmFjdGl2ZV9wcm90b3R5cGVfbWVyZ2VfcHJvcGFnYXRlQ2hhbmdlcyApO1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9vYnNlcnZlX09ic2VydmVyID0gZnVuY3Rpb24oIHJ1bmxvb3AsIGlzRXF1YWwsIGdldCApIHtcblxuXHRcdHZhciBPYnNlcnZlciA9IGZ1bmN0aW9uKCByYWN0aXZlLCBrZXlwYXRoLCBjYWxsYmFjaywgb3B0aW9ucyApIHtcblx0XHRcdHZhciBzZWxmID0gdGhpcztcblx0XHRcdHRoaXMucm9vdCA9IHJhY3RpdmU7XG5cdFx0XHR0aGlzLmtleXBhdGggPSBrZXlwYXRoO1xuXHRcdFx0dGhpcy5jYWxsYmFjayA9IGNhbGxiYWNrO1xuXHRcdFx0dGhpcy5kZWZlciA9IG9wdGlvbnMuZGVmZXI7XG5cdFx0XHR0aGlzLmRlYnVnID0gb3B0aW9ucy5kZWJ1Zztcblx0XHRcdHRoaXMucHJveHkgPSB7XG5cdFx0XHRcdHVwZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0c2VsZi5yZWFsbHlVcGRhdGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHRcdHRoaXMucHJpb3JpdHkgPSAwO1xuXHRcdFx0dGhpcy5jb250ZXh0ID0gb3B0aW9ucyAmJiBvcHRpb25zLmNvbnRleHQgPyBvcHRpb25zLmNvbnRleHQgOiByYWN0aXZlO1xuXHRcdH07XG5cdFx0T2JzZXJ2ZXIucHJvdG90eXBlID0ge1xuXHRcdFx0aW5pdDogZnVuY3Rpb24oIGltbWVkaWF0ZSApIHtcblx0XHRcdFx0aWYgKCBpbW1lZGlhdGUgIT09IGZhbHNlICkge1xuXHRcdFx0XHRcdHRoaXMudXBkYXRlKCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy52YWx1ZSA9IGdldCggdGhpcy5yb290LCB0aGlzLmtleXBhdGggKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHVwZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmICggdGhpcy5kZWZlciAmJiB0aGlzLnJlYWR5ICkge1xuXHRcdFx0XHRcdHJ1bmxvb3AuYWRkT2JzZXJ2ZXIoIHRoaXMucHJveHkgKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5yZWFsbHlVcGRhdGUoKTtcblx0XHRcdH0sXG5cdFx0XHRyZWFsbHlVcGRhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgb2xkVmFsdWUsIG5ld1ZhbHVlO1xuXHRcdFx0XHRvbGRWYWx1ZSA9IHRoaXMudmFsdWU7XG5cdFx0XHRcdG5ld1ZhbHVlID0gZ2V0KCB0aGlzLnJvb3QsIHRoaXMua2V5cGF0aCApO1xuXHRcdFx0XHR0aGlzLnZhbHVlID0gbmV3VmFsdWU7XG5cdFx0XHRcdGlmICggdGhpcy51cGRhdGluZyApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy51cGRhdGluZyA9IHRydWU7XG5cdFx0XHRcdGlmICggIWlzRXF1YWwoIG5ld1ZhbHVlLCBvbGRWYWx1ZSApIHx8ICF0aGlzLnJlYWR5ICkge1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHR0aGlzLmNhbGxiYWNrLmNhbGwoIHRoaXMuY29udGV4dCwgbmV3VmFsdWUsIG9sZFZhbHVlLCB0aGlzLmtleXBhdGggKTtcblx0XHRcdFx0XHR9IGNhdGNoICggZXJyICkge1xuXHRcdFx0XHRcdFx0aWYgKCB0aGlzLmRlYnVnIHx8IHRoaXMucm9vdC5kZWJ1ZyApIHtcblx0XHRcdFx0XHRcdFx0dGhyb3cgZXJyO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLnVwZGF0aW5nID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gT2JzZXJ2ZXI7XG5cdH0oIGdsb2JhbF9ydW5sb29wLCB1dGlsc19pc0VxdWFsLCBzaGFyZWRfZ2V0X19nZXQgKTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfb2JzZXJ2ZV9nZXRQYXR0ZXJuID0gZnVuY3Rpb24oIGlzQXJyYXkgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHJhY3RpdmUsIHBhdHRlcm4gKSB7XG5cdFx0XHR2YXIga2V5cywga2V5LCB2YWx1ZXMsIHRvR2V0LCBuZXdUb0dldCwgZXhwYW5kLCBjb25jYXRlbmF0ZTtcblx0XHRcdGtleXMgPSBwYXR0ZXJuLnNwbGl0KCAnLicgKTtcblx0XHRcdHRvR2V0ID0gW107XG5cdFx0XHRleHBhbmQgPSBmdW5jdGlvbigga2V5cGF0aCApIHtcblx0XHRcdFx0dmFyIHZhbHVlLCBrZXk7XG5cdFx0XHRcdHZhbHVlID0gcmFjdGl2ZS5fd3JhcHBlZFsga2V5cGF0aCBdID8gcmFjdGl2ZS5fd3JhcHBlZFsga2V5cGF0aCBdLmdldCgpIDogcmFjdGl2ZS5nZXQoIGtleXBhdGggKTtcblx0XHRcdFx0Zm9yICgga2V5IGluIHZhbHVlICkge1xuXHRcdFx0XHRcdGlmICggdmFsdWUuaGFzT3duUHJvcGVydHkoIGtleSApICYmICgga2V5ICE9PSAnX3JhY3RpdmUnIHx8ICFpc0FycmF5KCB2YWx1ZSApICkgKSB7XG5cdFx0XHRcdFx0XHRuZXdUb0dldC5wdXNoKCBrZXlwYXRoICsgJy4nICsga2V5ICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdFx0Y29uY2F0ZW5hdGUgPSBmdW5jdGlvbigga2V5cGF0aCApIHtcblx0XHRcdFx0cmV0dXJuIGtleXBhdGggKyAnLicgKyBrZXk7XG5cdFx0XHR9O1xuXHRcdFx0d2hpbGUgKCBrZXkgPSBrZXlzLnNoaWZ0KCkgKSB7XG5cdFx0XHRcdGlmICgga2V5ID09PSAnKicgKSB7XG5cdFx0XHRcdFx0bmV3VG9HZXQgPSBbXTtcblx0XHRcdFx0XHR0b0dldC5mb3JFYWNoKCBleHBhbmQgKTtcblx0XHRcdFx0XHR0b0dldCA9IG5ld1RvR2V0O1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGlmICggIXRvR2V0WyAwIF0gKSB7XG5cdFx0XHRcdFx0XHR0b0dldFsgMCBdID0ga2V5O1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0b0dldCA9IHRvR2V0Lm1hcCggY29uY2F0ZW5hdGUgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHZhbHVlcyA9IHt9O1xuXHRcdFx0dG9HZXQuZm9yRWFjaCggZnVuY3Rpb24oIGtleXBhdGggKSB7XG5cdFx0XHRcdHZhbHVlc1sga2V5cGF0aCBdID0gcmFjdGl2ZS5nZXQoIGtleXBhdGggKTtcblx0XHRcdH0gKTtcblx0XHRcdHJldHVybiB2YWx1ZXM7XG5cdFx0fTtcblx0fSggdXRpbHNfaXNBcnJheSApO1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9vYnNlcnZlX1BhdHRlcm5PYnNlcnZlciA9IGZ1bmN0aW9uKCBydW5sb29wLCBpc0VxdWFsLCBnZXQsIGdldFBhdHRlcm4gKSB7XG5cblx0XHR2YXIgUGF0dGVybk9ic2VydmVyLCB3aWxkY2FyZCA9IC9cXCovO1xuXHRcdFBhdHRlcm5PYnNlcnZlciA9IGZ1bmN0aW9uKCByYWN0aXZlLCBrZXlwYXRoLCBjYWxsYmFjaywgb3B0aW9ucyApIHtcblx0XHRcdHRoaXMucm9vdCA9IHJhY3RpdmU7XG5cdFx0XHR0aGlzLmNhbGxiYWNrID0gY2FsbGJhY2s7XG5cdFx0XHR0aGlzLmRlZmVyID0gb3B0aW9ucy5kZWZlcjtcblx0XHRcdHRoaXMuZGVidWcgPSBvcHRpb25zLmRlYnVnO1xuXHRcdFx0dGhpcy5rZXlwYXRoID0ga2V5cGF0aDtcblx0XHRcdHRoaXMucmVnZXggPSBuZXcgUmVnRXhwKCAnXicgKyBrZXlwYXRoLnJlcGxhY2UoIC9cXC4vZywgJ1xcXFwuJyApLnJlcGxhY2UoIC9cXCovZywgJ1teXFxcXC5dKycgKSArICckJyApO1xuXHRcdFx0dGhpcy52YWx1ZXMgPSB7fTtcblx0XHRcdGlmICggdGhpcy5kZWZlciApIHtcblx0XHRcdFx0dGhpcy5wcm94aWVzID0gW107XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnByaW9yaXR5ID0gJ3BhdHRlcm4nO1xuXHRcdFx0dGhpcy5jb250ZXh0ID0gb3B0aW9ucyAmJiBvcHRpb25zLmNvbnRleHQgPyBvcHRpb25zLmNvbnRleHQgOiByYWN0aXZlO1xuXHRcdH07XG5cdFx0UGF0dGVybk9ic2VydmVyLnByb3RvdHlwZSA9IHtcblx0XHRcdGluaXQ6IGZ1bmN0aW9uKCBpbW1lZGlhdGUgKSB7XG5cdFx0XHRcdHZhciB2YWx1ZXMsIGtleXBhdGg7XG5cdFx0XHRcdHZhbHVlcyA9IGdldFBhdHRlcm4oIHRoaXMucm9vdCwgdGhpcy5rZXlwYXRoICk7XG5cdFx0XHRcdGlmICggaW1tZWRpYXRlICE9PSBmYWxzZSApIHtcblx0XHRcdFx0XHRmb3IgKCBrZXlwYXRoIGluIHZhbHVlcyApIHtcblx0XHRcdFx0XHRcdGlmICggdmFsdWVzLmhhc093blByb3BlcnR5KCBrZXlwYXRoICkgKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMudXBkYXRlKCBrZXlwYXRoICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMudmFsdWVzID0gdmFsdWVzO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0dXBkYXRlOiBmdW5jdGlvbigga2V5cGF0aCApIHtcblx0XHRcdFx0dmFyIHZhbHVlcztcblx0XHRcdFx0aWYgKCB3aWxkY2FyZC50ZXN0KCBrZXlwYXRoICkgKSB7XG5cdFx0XHRcdFx0dmFsdWVzID0gZ2V0UGF0dGVybiggdGhpcy5yb290LCBrZXlwYXRoICk7XG5cdFx0XHRcdFx0Zm9yICgga2V5cGF0aCBpbiB2YWx1ZXMgKSB7XG5cdFx0XHRcdFx0XHRpZiAoIHZhbHVlcy5oYXNPd25Qcm9wZXJ0eSgga2V5cGF0aCApICkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLnVwZGF0ZSgga2V5cGF0aCApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCB0aGlzLmRlZmVyICYmIHRoaXMucmVhZHkgKSB7XG5cdFx0XHRcdFx0cnVubG9vcC5hZGRPYnNlcnZlciggdGhpcy5nZXRQcm94eSgga2V5cGF0aCApICk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMucmVhbGx5VXBkYXRlKCBrZXlwYXRoICk7XG5cdFx0XHR9LFxuXHRcdFx0cmVhbGx5VXBkYXRlOiBmdW5jdGlvbigga2V5cGF0aCApIHtcblx0XHRcdFx0dmFyIHZhbHVlID0gZ2V0KCB0aGlzLnJvb3QsIGtleXBhdGggKTtcblx0XHRcdFx0aWYgKCB0aGlzLnVwZGF0aW5nICkge1xuXHRcdFx0XHRcdHRoaXMudmFsdWVzWyBrZXlwYXRoIF0gPSB2YWx1ZTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy51cGRhdGluZyA9IHRydWU7XG5cdFx0XHRcdGlmICggIWlzRXF1YWwoIHZhbHVlLCB0aGlzLnZhbHVlc1sga2V5cGF0aCBdICkgfHwgIXRoaXMucmVhZHkgKSB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdHRoaXMuY2FsbGJhY2suY2FsbCggdGhpcy5jb250ZXh0LCB2YWx1ZSwgdGhpcy52YWx1ZXNbIGtleXBhdGggXSwga2V5cGF0aCApO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKCBlcnIgKSB7XG5cdFx0XHRcdFx0XHRpZiAoIHRoaXMuZGVidWcgfHwgdGhpcy5yb290LmRlYnVnICkge1xuXHRcdFx0XHRcdFx0XHR0aHJvdyBlcnI7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoaXMudmFsdWVzWyBrZXlwYXRoIF0gPSB2YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLnVwZGF0aW5nID0gZmFsc2U7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0UHJveHk6IGZ1bmN0aW9uKCBrZXlwYXRoICkge1xuXHRcdFx0XHR2YXIgc2VsZiA9IHRoaXM7XG5cdFx0XHRcdGlmICggIXRoaXMucHJveGllc1sga2V5cGF0aCBdICkge1xuXHRcdFx0XHRcdHRoaXMucHJveGllc1sga2V5cGF0aCBdID0ge1xuXHRcdFx0XHRcdFx0dXBkYXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdFx0c2VsZi5yZWFsbHlVcGRhdGUoIGtleXBhdGggKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0aGlzLnByb3hpZXNbIGtleXBhdGggXTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBQYXR0ZXJuT2JzZXJ2ZXI7XG5cdH0oIGdsb2JhbF9ydW5sb29wLCB1dGlsc19pc0VxdWFsLCBzaGFyZWRfZ2V0X19nZXQsIFJhY3RpdmVfcHJvdG90eXBlX29ic2VydmVfZ2V0UGF0dGVybiApO1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV9vYnNlcnZlX2dldE9ic2VydmVyRmFjYWRlID0gZnVuY3Rpb24oIG5vcm1hbGlzZUtleXBhdGgsIHJlZ2lzdGVyRGVwZW5kYW50LCB1bnJlZ2lzdGVyRGVwZW5kYW50LCBPYnNlcnZlciwgUGF0dGVybk9ic2VydmVyICkge1xuXG5cdFx0dmFyIHdpbGRjYXJkID0gL1xcKi8sXG5cdFx0XHRlbXB0eU9iamVjdCA9IHt9O1xuXHRcdHJldHVybiBmdW5jdGlvbiBnZXRPYnNlcnZlckZhY2FkZSggcmFjdGl2ZSwga2V5cGF0aCwgY2FsbGJhY2ssIG9wdGlvbnMgKSB7XG5cdFx0XHR2YXIgb2JzZXJ2ZXIsIGlzUGF0dGVybk9ic2VydmVyO1xuXHRcdFx0a2V5cGF0aCA9IG5vcm1hbGlzZUtleXBhdGgoIGtleXBhdGggKTtcblx0XHRcdG9wdGlvbnMgPSBvcHRpb25zIHx8IGVtcHR5T2JqZWN0O1xuXHRcdFx0aWYgKCB3aWxkY2FyZC50ZXN0KCBrZXlwYXRoICkgKSB7XG5cdFx0XHRcdG9ic2VydmVyID0gbmV3IFBhdHRlcm5PYnNlcnZlciggcmFjdGl2ZSwga2V5cGF0aCwgY2FsbGJhY2ssIG9wdGlvbnMgKTtcblx0XHRcdFx0cmFjdGl2ZS5fcGF0dGVybk9ic2VydmVycy5wdXNoKCBvYnNlcnZlciApO1xuXHRcdFx0XHRpc1BhdHRlcm5PYnNlcnZlciA9IHRydWU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRvYnNlcnZlciA9IG5ldyBPYnNlcnZlciggcmFjdGl2ZSwga2V5cGF0aCwgY2FsbGJhY2ssIG9wdGlvbnMgKTtcblx0XHRcdH1cblx0XHRcdHJlZ2lzdGVyRGVwZW5kYW50KCBvYnNlcnZlciApO1xuXHRcdFx0b2JzZXJ2ZXIuaW5pdCggb3B0aW9ucy5pbml0ICk7XG5cdFx0XHRvYnNlcnZlci5yZWFkeSA9IHRydWU7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRjYW5jZWw6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdHZhciBpbmRleDtcblx0XHRcdFx0XHRpZiAoIGlzUGF0dGVybk9ic2VydmVyICkge1xuXHRcdFx0XHRcdFx0aW5kZXggPSByYWN0aXZlLl9wYXR0ZXJuT2JzZXJ2ZXJzLmluZGV4T2YoIG9ic2VydmVyICk7XG5cdFx0XHRcdFx0XHRpZiAoIGluZGV4ICE9PSAtMSApIHtcblx0XHRcdFx0XHRcdFx0cmFjdGl2ZS5fcGF0dGVybk9ic2VydmVycy5zcGxpY2UoIGluZGV4LCAxICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHVucmVnaXN0ZXJEZXBlbmRhbnQoIG9ic2VydmVyICk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0fTtcblx0fSggdXRpbHNfbm9ybWFsaXNlS2V5cGF0aCwgc2hhcmVkX3JlZ2lzdGVyRGVwZW5kYW50LCBzaGFyZWRfdW5yZWdpc3RlckRlcGVuZGFudCwgUmFjdGl2ZV9wcm90b3R5cGVfb2JzZXJ2ZV9PYnNlcnZlciwgUmFjdGl2ZV9wcm90b3R5cGVfb2JzZXJ2ZV9QYXR0ZXJuT2JzZXJ2ZXIgKTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfb2JzZXJ2ZV9fb2JzZXJ2ZSA9IGZ1bmN0aW9uKCBpc09iamVjdCwgZ2V0T2JzZXJ2ZXJGYWNhZGUgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24gb2JzZXJ2ZSgga2V5cGF0aCwgY2FsbGJhY2ssIG9wdGlvbnMgKSB7XG5cdFx0XHR2YXIgb2JzZXJ2ZXJzLCBtYXAsIGtleXBhdGhzLCBpO1xuXHRcdFx0aWYgKCBpc09iamVjdCgga2V5cGF0aCApICkge1xuXHRcdFx0XHRvcHRpb25zID0gY2FsbGJhY2s7XG5cdFx0XHRcdG1hcCA9IGtleXBhdGg7XG5cdFx0XHRcdG9ic2VydmVycyA9IFtdO1xuXHRcdFx0XHRmb3IgKCBrZXlwYXRoIGluIG1hcCApIHtcblx0XHRcdFx0XHRpZiAoIG1hcC5oYXNPd25Qcm9wZXJ0eSgga2V5cGF0aCApICkge1xuXHRcdFx0XHRcdFx0Y2FsbGJhY2sgPSBtYXBbIGtleXBhdGggXTtcblx0XHRcdFx0XHRcdG9ic2VydmVycy5wdXNoKCB0aGlzLm9ic2VydmUoIGtleXBhdGgsIGNhbGxiYWNrLCBvcHRpb25zICkgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRjYW5jZWw6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0d2hpbGUgKCBvYnNlcnZlcnMubGVuZ3RoICkge1xuXHRcdFx0XHRcdFx0XHRvYnNlcnZlcnMucG9wKCkuY2FuY2VsKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0eXBlb2Yga2V5cGF0aCA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdFx0b3B0aW9ucyA9IGNhbGxiYWNrO1xuXHRcdFx0XHRjYWxsYmFjayA9IGtleXBhdGg7XG5cdFx0XHRcdGtleXBhdGggPSAnJztcblx0XHRcdFx0cmV0dXJuIGdldE9ic2VydmVyRmFjYWRlKCB0aGlzLCBrZXlwYXRoLCBjYWxsYmFjaywgb3B0aW9ucyApO1xuXHRcdFx0fVxuXHRcdFx0a2V5cGF0aHMgPSBrZXlwYXRoLnNwbGl0KCAnICcgKTtcblx0XHRcdGlmICgga2V5cGF0aHMubGVuZ3RoID09PSAxICkge1xuXHRcdFx0XHRyZXR1cm4gZ2V0T2JzZXJ2ZXJGYWNhZGUoIHRoaXMsIGtleXBhdGgsIGNhbGxiYWNrLCBvcHRpb25zICk7XG5cdFx0XHR9XG5cdFx0XHRvYnNlcnZlcnMgPSBbXTtcblx0XHRcdGkgPSBrZXlwYXRocy5sZW5ndGg7XG5cdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0a2V5cGF0aCA9IGtleXBhdGhzWyBpIF07XG5cdFx0XHRcdGlmICgga2V5cGF0aCApIHtcblx0XHRcdFx0XHRvYnNlcnZlcnMucHVzaCggZ2V0T2JzZXJ2ZXJGYWNhZGUoIHRoaXMsIGtleXBhdGgsIGNhbGxiYWNrLCBvcHRpb25zICkgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0Y2FuY2VsOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHR3aGlsZSAoIG9ic2VydmVycy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0XHRvYnNlcnZlcnMucG9wKCkuY2FuY2VsKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdH07XG5cdH0oIHV0aWxzX2lzT2JqZWN0LCBSYWN0aXZlX3Byb3RvdHlwZV9vYnNlcnZlX2dldE9ic2VydmVyRmFjYWRlICk7XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX29mZiA9IGZ1bmN0aW9uKCBldmVudE5hbWUsIGNhbGxiYWNrICkge1xuXHRcdHZhciBzdWJzY3JpYmVycywgaW5kZXg7XG5cdFx0aWYgKCAhY2FsbGJhY2sgKSB7XG5cdFx0XHRpZiAoICFldmVudE5hbWUgKSB7XG5cdFx0XHRcdGZvciAoIGV2ZW50TmFtZSBpbiB0aGlzLl9zdWJzICkge1xuXHRcdFx0XHRcdGRlbGV0ZSB0aGlzLl9zdWJzWyBldmVudE5hbWUgXTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fc3Vic1sgZXZlbnROYW1lIF0gPSBbXTtcblx0XHRcdH1cblx0XHR9XG5cdFx0c3Vic2NyaWJlcnMgPSB0aGlzLl9zdWJzWyBldmVudE5hbWUgXTtcblx0XHRpZiAoIHN1YnNjcmliZXJzICkge1xuXHRcdFx0aW5kZXggPSBzdWJzY3JpYmVycy5pbmRleE9mKCBjYWxsYmFjayApO1xuXHRcdFx0aWYgKCBpbmRleCAhPT0gLTEgKSB7XG5cdFx0XHRcdHN1YnNjcmliZXJzLnNwbGljZSggaW5kZXgsIDEgKTtcblx0XHRcdH1cblx0XHR9XG5cdH07XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX29uID0gZnVuY3Rpb24oIGV2ZW50TmFtZSwgY2FsbGJhY2sgKSB7XG5cdFx0dmFyIHNlbGYgPSB0aGlzLFxuXHRcdFx0bGlzdGVuZXJzLCBuO1xuXHRcdGlmICggdHlwZW9mIGV2ZW50TmFtZSA9PT0gJ29iamVjdCcgKSB7XG5cdFx0XHRsaXN0ZW5lcnMgPSBbXTtcblx0XHRcdGZvciAoIG4gaW4gZXZlbnROYW1lICkge1xuXHRcdFx0XHRpZiAoIGV2ZW50TmFtZS5oYXNPd25Qcm9wZXJ0eSggbiApICkge1xuXHRcdFx0XHRcdGxpc3RlbmVycy5wdXNoKCB0aGlzLm9uKCBuLCBldmVudE5hbWVbIG4gXSApICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGNhbmNlbDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0dmFyIGxpc3RlbmVyO1xuXHRcdFx0XHRcdHdoaWxlICggbGlzdGVuZXIgPSBsaXN0ZW5lcnMucG9wKCkgKSB7XG5cdFx0XHRcdFx0XHRsaXN0ZW5lci5jYW5jZWwoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0fVxuXHRcdGlmICggIXRoaXMuX3N1YnNbIGV2ZW50TmFtZSBdICkge1xuXHRcdFx0dGhpcy5fc3Vic1sgZXZlbnROYW1lIF0gPSBbIGNhbGxiYWNrIF07XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX3N1YnNbIGV2ZW50TmFtZSBdLnB1c2goIGNhbGxiYWNrICk7XG5cdFx0fVxuXHRcdHJldHVybiB7XG5cdFx0XHRjYW5jZWw6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRzZWxmLm9mZiggZXZlbnROYW1lLCBjYWxsYmFjayApO1xuXHRcdFx0fVxuXHRcdH07XG5cdH07XG5cblx0dmFyIHV0aWxzX2NyZWF0ZSA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0dmFyIGNyZWF0ZTtcblx0XHR0cnkge1xuXHRcdFx0T2JqZWN0LmNyZWF0ZSggbnVsbCApO1xuXHRcdFx0Y3JlYXRlID0gT2JqZWN0LmNyZWF0ZTtcblx0XHR9IGNhdGNoICggZXJyICkge1xuXHRcdFx0Y3JlYXRlID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBGID0gZnVuY3Rpb24oKSB7fTtcblx0XHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCBwcm90bywgcHJvcHMgKSB7XG5cdFx0XHRcdFx0dmFyIG9iajtcblx0XHRcdFx0XHRpZiAoIHByb3RvID09PSBudWxsICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHt9O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRGLnByb3RvdHlwZSA9IHByb3RvO1xuXHRcdFx0XHRcdG9iaiA9IG5ldyBGKCk7XG5cdFx0XHRcdFx0aWYgKCBwcm9wcyApIHtcblx0XHRcdFx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKCBvYmosIHByb3BzICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBvYmo7XG5cdFx0XHRcdH07XG5cdFx0XHR9KCk7XG5cdFx0fVxuXHRcdHJldHVybiBjcmVhdGU7XG5cdH0oKTtcblxuXHR2YXIgcmVuZGVyX3NoYXJlZF9pbml0RnJhZ21lbnQgPSBmdW5jdGlvbiggdHlwZXMsIGNyZWF0ZSApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiBpbml0RnJhZ21lbnQoIGZyYWdtZW50LCBvcHRpb25zICkge1xuXHRcdFx0dmFyIG51bUl0ZW1zLCBpLCBwYXJlbnRGcmFnbWVudCwgcGFyZW50UmVmcywgcmVmO1xuXHRcdFx0ZnJhZ21lbnQub3duZXIgPSBvcHRpb25zLm93bmVyO1xuXHRcdFx0cGFyZW50RnJhZ21lbnQgPSBmcmFnbWVudC5wYXJlbnQgPSBmcmFnbWVudC5vd25lci5wYXJlbnRGcmFnbWVudDtcblx0XHRcdGZyYWdtZW50LnJvb3QgPSBvcHRpb25zLnJvb3Q7XG5cdFx0XHRmcmFnbWVudC5wTm9kZSA9IG9wdGlvbnMucE5vZGU7XG5cdFx0XHRmcmFnbWVudC5wRWxlbWVudCA9IG9wdGlvbnMucEVsZW1lbnQ7XG5cdFx0XHRmcmFnbWVudC5jb250ZXh0ID0gb3B0aW9ucy5jb250ZXh0O1xuXHRcdFx0aWYgKCBmcmFnbWVudC5vd25lci50eXBlID09PSB0eXBlcy5TRUNUSU9OICkge1xuXHRcdFx0XHRmcmFnbWVudC5pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHBhcmVudEZyYWdtZW50ICkge1xuXHRcdFx0XHRwYXJlbnRSZWZzID0gcGFyZW50RnJhZ21lbnQuaW5kZXhSZWZzO1xuXHRcdFx0XHRpZiAoIHBhcmVudFJlZnMgKSB7XG5cdFx0XHRcdFx0ZnJhZ21lbnQuaW5kZXhSZWZzID0gY3JlYXRlKCBudWxsICk7XG5cdFx0XHRcdFx0Zm9yICggcmVmIGluIHBhcmVudFJlZnMgKSB7XG5cdFx0XHRcdFx0XHRmcmFnbWVudC5pbmRleFJlZnNbIHJlZiBdID0gcGFyZW50UmVmc1sgcmVmIF07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRmcmFnbWVudC5wcmlvcml0eSA9IHBhcmVudEZyYWdtZW50ID8gcGFyZW50RnJhZ21lbnQucHJpb3JpdHkgKyAxIDogMTtcblx0XHRcdGlmICggb3B0aW9ucy5pbmRleFJlZiApIHtcblx0XHRcdFx0aWYgKCAhZnJhZ21lbnQuaW5kZXhSZWZzICkge1xuXHRcdFx0XHRcdGZyYWdtZW50LmluZGV4UmVmcyA9IHt9O1xuXHRcdFx0XHR9XG5cdFx0XHRcdGZyYWdtZW50LmluZGV4UmVmc1sgb3B0aW9ucy5pbmRleFJlZiBdID0gb3B0aW9ucy5pbmRleDtcblx0XHRcdH1cblx0XHRcdGZyYWdtZW50Lml0ZW1zID0gW107XG5cdFx0XHRudW1JdGVtcyA9IG9wdGlvbnMuZGVzY3JpcHRvciA/IG9wdGlvbnMuZGVzY3JpcHRvci5sZW5ndGggOiAwO1xuXHRcdFx0Zm9yICggaSA9IDA7IGkgPCBudW1JdGVtczsgaSArPSAxICkge1xuXHRcdFx0XHRmcmFnbWVudC5pdGVtc1sgZnJhZ21lbnQuaXRlbXMubGVuZ3RoIF0gPSBmcmFnbWVudC5jcmVhdGVJdGVtKCB7XG5cdFx0XHRcdFx0cGFyZW50RnJhZ21lbnQ6IGZyYWdtZW50LFxuXHRcdFx0XHRcdHBFbGVtZW50OiBvcHRpb25zLnBFbGVtZW50LFxuXHRcdFx0XHRcdGRlc2NyaXB0b3I6IG9wdGlvbnMuZGVzY3JpcHRvclsgaSBdLFxuXHRcdFx0XHRcdGluZGV4OiBpXG5cdFx0XHRcdH0gKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9KCBjb25maWdfdHlwZXMsIHV0aWxzX2NyZWF0ZSApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfc2hhcmVkX2luc2VydEh0bWwgPSBmdW5jdGlvbiggY3JlYXRlRWxlbWVudCApIHtcblxuXHRcdHZhciBlbGVtZW50Q2FjaGUgPSB7fSwgaWVCdWcsIGllQmxhY2tsaXN0O1xuXHRcdHRyeSB7XG5cdFx0XHRjcmVhdGVFbGVtZW50KCAndGFibGUnICkuaW5uZXJIVE1MID0gJ2Zvbyc7XG5cdFx0fSBjYXRjaCAoIGVyciApIHtcblx0XHRcdGllQnVnID0gdHJ1ZTtcblx0XHRcdGllQmxhY2tsaXN0ID0ge1xuXHRcdFx0XHRUQUJMRTogW1xuXHRcdFx0XHRcdCc8dGFibGUgY2xhc3M9XCJ4XCI+Jyxcblx0XHRcdFx0XHQnPC90YWJsZT4nXG5cdFx0XHRcdF0sXG5cdFx0XHRcdFRIRUFEOiBbXG5cdFx0XHRcdFx0Jzx0YWJsZT48dGhlYWQgY2xhc3M9XCJ4XCI+Jyxcblx0XHRcdFx0XHQnPC90aGVhZD48L3RhYmxlPidcblx0XHRcdFx0XSxcblx0XHRcdFx0VEJPRFk6IFtcblx0XHRcdFx0XHQnPHRhYmxlPjx0Ym9keSBjbGFzcz1cInhcIj4nLFxuXHRcdFx0XHRcdCc8L3Rib2R5PjwvdGFibGU+J1xuXHRcdFx0XHRdLFxuXHRcdFx0XHRUUjogW1xuXHRcdFx0XHRcdCc8dGFibGU+PHRyIGNsYXNzPVwieFwiPicsXG5cdFx0XHRcdFx0JzwvdHI+PC90YWJsZT4nXG5cdFx0XHRcdF0sXG5cdFx0XHRcdFNFTEVDVDogW1xuXHRcdFx0XHRcdCc8c2VsZWN0IGNsYXNzPVwieFwiPicsXG5cdFx0XHRcdFx0Jzwvc2VsZWN0Pidcblx0XHRcdFx0XVxuXHRcdFx0fTtcblx0XHR9XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBodG1sLCB0YWdOYW1lLCBkb2NGcmFnICkge1xuXHRcdFx0dmFyIGNvbnRhaW5lciwgbm9kZXMgPSBbXSxcblx0XHRcdFx0d3JhcHBlcjtcblx0XHRcdGlmICggaHRtbCApIHtcblx0XHRcdFx0aWYgKCBpZUJ1ZyAmJiAoIHdyYXBwZXIgPSBpZUJsYWNrbGlzdFsgdGFnTmFtZSBdICkgKSB7XG5cdFx0XHRcdFx0Y29udGFpbmVyID0gZWxlbWVudCggJ0RJVicgKTtcblx0XHRcdFx0XHRjb250YWluZXIuaW5uZXJIVE1MID0gd3JhcHBlclsgMCBdICsgaHRtbCArIHdyYXBwZXJbIDEgXTtcblx0XHRcdFx0XHRjb250YWluZXIgPSBjb250YWluZXIucXVlcnlTZWxlY3RvciggJy54JyApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnRhaW5lciA9IGVsZW1lbnQoIHRhZ05hbWUgKTtcblx0XHRcdFx0XHRjb250YWluZXIuaW5uZXJIVE1MID0gaHRtbDtcblx0XHRcdFx0fVxuXHRcdFx0XHR3aGlsZSAoIGNvbnRhaW5lci5maXJzdENoaWxkICkge1xuXHRcdFx0XHRcdG5vZGVzLnB1c2goIGNvbnRhaW5lci5maXJzdENoaWxkICk7XG5cdFx0XHRcdFx0ZG9jRnJhZy5hcHBlbmRDaGlsZCggY29udGFpbmVyLmZpcnN0Q2hpbGQgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG5vZGVzO1xuXHRcdH07XG5cblx0XHRmdW5jdGlvbiBlbGVtZW50KCB0YWdOYW1lICkge1xuXHRcdFx0cmV0dXJuIGVsZW1lbnRDYWNoZVsgdGFnTmFtZSBdIHx8ICggZWxlbWVudENhY2hlWyB0YWdOYW1lIF0gPSBjcmVhdGVFbGVtZW50KCB0YWdOYW1lICkgKTtcblx0XHR9XG5cdH0oIHV0aWxzX2NyZWF0ZUVsZW1lbnQgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X3NoYXJlZF9kZXRhY2ggPSBmdW5jdGlvbigpIHtcblx0XHR2YXIgbm9kZSA9IHRoaXMubm9kZSxcblx0XHRcdHBhcmVudE5vZGU7XG5cdFx0aWYgKCBub2RlICYmICggcGFyZW50Tm9kZSA9IG5vZGUucGFyZW50Tm9kZSApICkge1xuXHRcdFx0cGFyZW50Tm9kZS5yZW1vdmVDaGlsZCggbm9kZSApO1xuXHRcdFx0cmV0dXJuIG5vZGU7XG5cdFx0fVxuXHR9O1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfVGV4dCA9IGZ1bmN0aW9uKCB0eXBlcywgZGV0YWNoICkge1xuXG5cdFx0dmFyIERvbVRleHQsIGxlc3NUaGFuLCBncmVhdGVyVGhhbjtcblx0XHRsZXNzVGhhbiA9IC88L2c7XG5cdFx0Z3JlYXRlclRoYW4gPSAvPi9nO1xuXHRcdERvbVRleHQgPSBmdW5jdGlvbiggb3B0aW9ucywgZG9jRnJhZyApIHtcblx0XHRcdHRoaXMudHlwZSA9IHR5cGVzLlRFWFQ7XG5cdFx0XHR0aGlzLmRlc2NyaXB0b3IgPSBvcHRpb25zLmRlc2NyaXB0b3I7XG5cdFx0XHRpZiAoIGRvY0ZyYWcgKSB7XG5cdFx0XHRcdHRoaXMubm9kZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCBvcHRpb25zLmRlc2NyaXB0b3IgKTtcblx0XHRcdFx0ZG9jRnJhZy5hcHBlbmRDaGlsZCggdGhpcy5ub2RlICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHREb21UZXh0LnByb3RvdHlwZSA9IHtcblx0XHRcdGRldGFjaDogZGV0YWNoLFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCBkZXN0cm95ICkge1xuXHRcdFx0XHRpZiAoIGRlc3Ryb3kgKSB7XG5cdFx0XHRcdFx0dGhpcy5kZXRhY2goKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGZpcnN0Tm9kZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLm5vZGU7XG5cdFx0XHR9LFxuXHRcdFx0dG9TdHJpbmc6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gKCAnJyArIHRoaXMuZGVzY3JpcHRvciApLnJlcGxhY2UoIGxlc3NUaGFuLCAnJmx0OycgKS5yZXBsYWNlKCBncmVhdGVyVGhhbiwgJyZndDsnICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gRG9tVGV4dDtcblx0fSggY29uZmlnX3R5cGVzLCByZW5kZXJfRG9tRnJhZ21lbnRfc2hhcmVkX2RldGFjaCApO1xuXG5cdHZhciBzaGFyZWRfdGVhcmRvd24gPSBmdW5jdGlvbiggcnVubG9vcCwgdW5yZWdpc3RlckRlcGVuZGFudCApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggdGhpbmcgKSB7XG5cdFx0XHRpZiAoICF0aGluZy5rZXlwYXRoICkge1xuXHRcdFx0XHRydW5sb29wLnJlbW92ZVVucmVzb2x2ZWQoIHRoaW5nICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR1bnJlZ2lzdGVyRGVwZW5kYW50KCB0aGluZyApO1xuXHRcdFx0fVxuXHRcdH07XG5cdH0oIGdsb2JhbF9ydW5sb29wLCBzaGFyZWRfdW5yZWdpc3RlckRlcGVuZGFudCApO1xuXG5cdHZhciByZW5kZXJfc2hhcmVkX0V2YWx1YXRvcl9SZWZlcmVuY2UgPSBmdW5jdGlvbiggdHlwZXMsIGlzRXF1YWwsIGRlZmluZVByb3BlcnR5LCByZWdpc3RlckRlcGVuZGFudCwgdW5yZWdpc3RlckRlcGVuZGFudCApIHtcblxuXHRcdHZhciBSZWZlcmVuY2UsIHRoaXNQYXR0ZXJuO1xuXHRcdHRoaXNQYXR0ZXJuID0gL3RoaXMvO1xuXHRcdFJlZmVyZW5jZSA9IGZ1bmN0aW9uKCByb290LCBrZXlwYXRoLCBldmFsdWF0b3IsIGFyZ051bSwgcHJpb3JpdHkgKSB7XG5cdFx0XHR2YXIgdmFsdWU7XG5cdFx0XHR0aGlzLmV2YWx1YXRvciA9IGV2YWx1YXRvcjtcblx0XHRcdHRoaXMua2V5cGF0aCA9IGtleXBhdGg7XG5cdFx0XHR0aGlzLnJvb3QgPSByb290O1xuXHRcdFx0dGhpcy5hcmdOdW0gPSBhcmdOdW07XG5cdFx0XHR0aGlzLnR5cGUgPSB0eXBlcy5SRUZFUkVOQ0U7XG5cdFx0XHR0aGlzLnByaW9yaXR5ID0gcHJpb3JpdHk7XG5cdFx0XHR2YWx1ZSA9IHJvb3QuZ2V0KCBrZXlwYXRoICk7XG5cdFx0XHRpZiAoIHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdFx0dmFsdWUgPSB3cmFwRnVuY3Rpb24oIHZhbHVlLCByb290LCBldmFsdWF0b3IgKTtcblx0XHRcdH1cblx0XHRcdHRoaXMudmFsdWUgPSBldmFsdWF0b3IudmFsdWVzWyBhcmdOdW0gXSA9IHZhbHVlO1xuXHRcdFx0cmVnaXN0ZXJEZXBlbmRhbnQoIHRoaXMgKTtcblx0XHR9O1xuXHRcdFJlZmVyZW5jZS5wcm90b3R5cGUgPSB7XG5cdFx0XHR1cGRhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgdmFsdWUgPSB0aGlzLnJvb3QuZ2V0KCB0aGlzLmtleXBhdGggKTtcblx0XHRcdFx0aWYgKCB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicgJiYgIXZhbHVlLl9ub3dyYXAgKSB7XG5cdFx0XHRcdFx0dmFsdWUgPSB3cmFwRnVuY3Rpb24oIHZhbHVlLCB0aGlzLnJvb3QsIHRoaXMuZXZhbHVhdG9yICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCAhaXNFcXVhbCggdmFsdWUsIHRoaXMudmFsdWUgKSApIHtcblx0XHRcdFx0XHR0aGlzLmV2YWx1YXRvci52YWx1ZXNbIHRoaXMuYXJnTnVtIF0gPSB2YWx1ZTtcblx0XHRcdFx0XHR0aGlzLmV2YWx1YXRvci5idWJibGUoKTtcblx0XHRcdFx0XHR0aGlzLnZhbHVlID0gdmFsdWU7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHVucmVnaXN0ZXJEZXBlbmRhbnQoIHRoaXMgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBSZWZlcmVuY2U7XG5cblx0XHRmdW5jdGlvbiB3cmFwRnVuY3Rpb24oIGZuLCByYWN0aXZlLCBldmFsdWF0b3IgKSB7XG5cdFx0XHR2YXIgcHJvcCwgZXZhbHVhdG9ycywgaW5kZXg7XG5cdFx0XHRpZiAoICF0aGlzUGF0dGVybi50ZXN0KCBmbi50b1N0cmluZygpICkgKSB7XG5cdFx0XHRcdGRlZmluZVByb3BlcnR5KCBmbiwgJ19ub3dyYXAnLCB7XG5cdFx0XHRcdFx0dmFsdWU6IHRydWVcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRyZXR1cm4gZm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoICFmblsgJ18nICsgcmFjdGl2ZS5fZ3VpZCBdICkge1xuXHRcdFx0XHRkZWZpbmVQcm9wZXJ0eSggZm4sICdfJyArIHJhY3RpdmUuX2d1aWQsIHtcblx0XHRcdFx0XHR2YWx1ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHR2YXIgb3JpZ2luYWxDYXB0dXJlZCwgcmVzdWx0LCBpLCBldmFsdWF0b3I7XG5cdFx0XHRcdFx0XHRvcmlnaW5hbENhcHR1cmVkID0gcmFjdGl2ZS5fY2FwdHVyZWQ7XG5cdFx0XHRcdFx0XHRpZiAoICFvcmlnaW5hbENhcHR1cmVkICkge1xuXHRcdFx0XHRcdFx0XHRyYWN0aXZlLl9jYXB0dXJlZCA9IFtdO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmVzdWx0ID0gZm4uYXBwbHkoIHJhY3RpdmUsIGFyZ3VtZW50cyApO1xuXHRcdFx0XHRcdFx0aWYgKCByYWN0aXZlLl9jYXB0dXJlZC5sZW5ndGggKSB7XG5cdFx0XHRcdFx0XHRcdGkgPSBldmFsdWF0b3JzLmxlbmd0aDtcblx0XHRcdFx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0XHRcdFx0ZXZhbHVhdG9yID0gZXZhbHVhdG9yc1sgaSBdO1xuXHRcdFx0XHRcdFx0XHRcdGV2YWx1YXRvci51cGRhdGVTb2Z0RGVwZW5kZW5jaWVzKCByYWN0aXZlLl9jYXB0dXJlZCApO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRyYWN0aXZlLl9jYXB0dXJlZCA9IG9yaWdpbmFsQ2FwdHVyZWQ7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0d3JpdGFibGU6IHRydWVcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRmb3IgKCBwcm9wIGluIGZuICkge1xuXHRcdFx0XHRcdGlmICggZm4uaGFzT3duUHJvcGVydHkoIHByb3AgKSApIHtcblx0XHRcdFx0XHRcdGZuWyAnXycgKyByYWN0aXZlLl9ndWlkIF1bIHByb3AgXSA9IGZuWyBwcm9wIF07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGZuWyAnXycgKyByYWN0aXZlLl9ndWlkICsgJ19ldmFsdWF0b3JzJyBdID0gW107XG5cdFx0XHR9XG5cdFx0XHRldmFsdWF0b3JzID0gZm5bICdfJyArIHJhY3RpdmUuX2d1aWQgKyAnX2V2YWx1YXRvcnMnIF07XG5cdFx0XHRpbmRleCA9IGV2YWx1YXRvcnMuaW5kZXhPZiggZXZhbHVhdG9yICk7XG5cdFx0XHRpZiAoIGluZGV4ID09PSAtMSApIHtcblx0XHRcdFx0ZXZhbHVhdG9ycy5wdXNoKCBldmFsdWF0b3IgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBmblsgJ18nICsgcmFjdGl2ZS5fZ3VpZCBdO1xuXHRcdH1cblx0fSggY29uZmlnX3R5cGVzLCB1dGlsc19pc0VxdWFsLCB1dGlsc19kZWZpbmVQcm9wZXJ0eSwgc2hhcmVkX3JlZ2lzdGVyRGVwZW5kYW50LCBzaGFyZWRfdW5yZWdpc3RlckRlcGVuZGFudCApO1xuXG5cdHZhciByZW5kZXJfc2hhcmVkX0V2YWx1YXRvcl9Tb2Z0UmVmZXJlbmNlID0gZnVuY3Rpb24oIGlzRXF1YWwsIHJlZ2lzdGVyRGVwZW5kYW50LCB1bnJlZ2lzdGVyRGVwZW5kYW50ICkge1xuXG5cdFx0dmFyIFNvZnRSZWZlcmVuY2UgPSBmdW5jdGlvbiggcm9vdCwga2V5cGF0aCwgZXZhbHVhdG9yICkge1xuXHRcdFx0dGhpcy5yb290ID0gcm9vdDtcblx0XHRcdHRoaXMua2V5cGF0aCA9IGtleXBhdGg7XG5cdFx0XHR0aGlzLnByaW9yaXR5ID0gZXZhbHVhdG9yLnByaW9yaXR5O1xuXHRcdFx0dGhpcy5ldmFsdWF0b3IgPSBldmFsdWF0b3I7XG5cdFx0XHRyZWdpc3RlckRlcGVuZGFudCggdGhpcyApO1xuXHRcdH07XG5cdFx0U29mdFJlZmVyZW5jZS5wcm90b3R5cGUgPSB7XG5cdFx0XHR1cGRhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgdmFsdWUgPSB0aGlzLnJvb3QuZ2V0KCB0aGlzLmtleXBhdGggKTtcblx0XHRcdFx0aWYgKCAhaXNFcXVhbCggdmFsdWUsIHRoaXMudmFsdWUgKSApIHtcblx0XHRcdFx0XHR0aGlzLmV2YWx1YXRvci5idWJibGUoKTtcblx0XHRcdFx0XHR0aGlzLnZhbHVlID0gdmFsdWU7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHVucmVnaXN0ZXJEZXBlbmRhbnQoIHRoaXMgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBTb2Z0UmVmZXJlbmNlO1xuXHR9KCB1dGlsc19pc0VxdWFsLCBzaGFyZWRfcmVnaXN0ZXJEZXBlbmRhbnQsIHNoYXJlZF91bnJlZ2lzdGVyRGVwZW5kYW50ICk7XG5cblx0dmFyIHJlbmRlcl9zaGFyZWRfRXZhbHVhdG9yX19FdmFsdWF0b3IgPSBmdW5jdGlvbiggcnVubG9vcCwgd2FybiwgaXNFcXVhbCwgY2xlYXJDYWNoZSwgbm90aWZ5RGVwZW5kYW50cywgYWRhcHRJZk5lY2Vzc2FyeSwgUmVmZXJlbmNlLCBTb2Z0UmVmZXJlbmNlICkge1xuXG5cdFx0dmFyIEV2YWx1YXRvciwgY2FjaGUgPSB7fTtcblx0XHRFdmFsdWF0b3IgPSBmdW5jdGlvbiggcm9vdCwga2V5cGF0aCwgdW5pcXVlU3RyaW5nLCBmdW5jdGlvblN0ciwgYXJncywgcHJpb3JpdHkgKSB7XG5cdFx0XHR2YXIgaSwgYXJnO1xuXHRcdFx0dGhpcy5yb290ID0gcm9vdDtcblx0XHRcdHRoaXMudW5pcXVlU3RyaW5nID0gdW5pcXVlU3RyaW5nO1xuXHRcdFx0dGhpcy5rZXlwYXRoID0ga2V5cGF0aDtcblx0XHRcdHRoaXMucHJpb3JpdHkgPSBwcmlvcml0eTtcblx0XHRcdHRoaXMuZm4gPSBnZXRGdW5jdGlvbkZyb21TdHJpbmcoIGZ1bmN0aW9uU3RyLCBhcmdzLmxlbmd0aCApO1xuXHRcdFx0dGhpcy52YWx1ZXMgPSBbXTtcblx0XHRcdHRoaXMucmVmcyA9IFtdO1xuXHRcdFx0aSA9IGFyZ3MubGVuZ3RoO1xuXHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdGlmICggYXJnID0gYXJnc1sgaSBdICkge1xuXHRcdFx0XHRcdGlmICggYXJnWyAwIF0gKSB7XG5cdFx0XHRcdFx0XHR0aGlzLnZhbHVlc1sgaSBdID0gYXJnWyAxIF07XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRoaXMucmVmcy5wdXNoKCBuZXcgUmVmZXJlbmNlKCByb290LCBhcmdbIDEgXSwgdGhpcywgaSwgcHJpb3JpdHkgKSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLnZhbHVlc1sgaSBdID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnNlbGZVcGRhdGluZyA9IHRoaXMucmVmcy5sZW5ndGggPD0gMTtcblx0XHR9O1xuXHRcdEV2YWx1YXRvci5wcm90b3R5cGUgPSB7XG5cdFx0XHRidWJibGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZiAoIHRoaXMuc2VsZlVwZGF0aW5nICkge1xuXHRcdFx0XHRcdHRoaXMudXBkYXRlKCk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoICF0aGlzLmRlZmVycmVkICkge1xuXHRcdFx0XHRcdHJ1bmxvb3AuYWRkRXZhbHVhdG9yKCB0aGlzICk7XG5cdFx0XHRcdFx0dGhpcy5kZWZlcnJlZCA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHR1cGRhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgdmFsdWU7XG5cdFx0XHRcdGlmICggdGhpcy5ldmFsdWF0aW5nICkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuZXZhbHVhdGluZyA9IHRydWU7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0dmFsdWUgPSB0aGlzLmZuLmFwcGx5KCBudWxsLCB0aGlzLnZhbHVlcyApO1xuXHRcdFx0XHR9IGNhdGNoICggZXJyICkge1xuXHRcdFx0XHRcdGlmICggdGhpcy5yb290LmRlYnVnICkge1xuXHRcdFx0XHRcdFx0d2FybiggJ0Vycm9yIGV2YWx1YXRpbmcgXCInICsgdGhpcy51bmlxdWVTdHJpbmcgKyAnXCI6ICcgKyBlcnIubWVzc2FnZSB8fCBlcnIgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dmFsdWUgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCAhaXNFcXVhbCggdmFsdWUsIHRoaXMudmFsdWUgKSApIHtcblx0XHRcdFx0XHR0aGlzLnZhbHVlID0gdmFsdWU7XG5cdFx0XHRcdFx0Y2xlYXJDYWNoZSggdGhpcy5yb290LCB0aGlzLmtleXBhdGggKTtcblx0XHRcdFx0XHRhZGFwdElmTmVjZXNzYXJ5KCB0aGlzLnJvb3QsIHRoaXMua2V5cGF0aCwgdmFsdWUsIHRydWUgKTtcblx0XHRcdFx0XHRub3RpZnlEZXBlbmRhbnRzKCB0aGlzLnJvb3QsIHRoaXMua2V5cGF0aCApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuZXZhbHVhdGluZyA9IGZhbHNlO1xuXHRcdFx0XHRyZXR1cm4gdGhpcztcblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHdoaWxlICggdGhpcy5yZWZzLmxlbmd0aCApIHtcblx0XHRcdFx0XHR0aGlzLnJlZnMucG9wKCkudGVhcmRvd24oKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjbGVhckNhY2hlKCB0aGlzLnJvb3QsIHRoaXMua2V5cGF0aCApO1xuXHRcdFx0XHR0aGlzLnJvb3QuX2V2YWx1YXRvcnNbIHRoaXMua2V5cGF0aCBdID0gbnVsbDtcblx0XHRcdH0sXG5cdFx0XHRyZWZyZXNoOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0aWYgKCAhdGhpcy5zZWxmVXBkYXRpbmcgKSB7XG5cdFx0XHRcdFx0dGhpcy5kZWZlcnJlZCA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0dmFyIGkgPSB0aGlzLnJlZnMubGVuZ3RoO1xuXHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHR0aGlzLnJlZnNbIGkgXS51cGRhdGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHRoaXMuZGVmZXJyZWQgKSB7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGUoKTtcblx0XHRcdFx0XHR0aGlzLmRlZmVycmVkID0gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHR1cGRhdGVTb2Z0RGVwZW5kZW5jaWVzOiBmdW5jdGlvbiggc29mdERlcHMgKSB7XG5cdFx0XHRcdHZhciBpLCBrZXlwYXRoLCByZWY7XG5cdFx0XHRcdGlmICggIXRoaXMuc29mdFJlZnMgKSB7XG5cdFx0XHRcdFx0dGhpcy5zb2Z0UmVmcyA9IFtdO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGkgPSB0aGlzLnNvZnRSZWZzLmxlbmd0aDtcblx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0cmVmID0gdGhpcy5zb2Z0UmVmc1sgaSBdO1xuXHRcdFx0XHRcdGlmICggIXNvZnREZXBzWyByZWYua2V5cGF0aCBdICkge1xuXHRcdFx0XHRcdFx0dGhpcy5zb2Z0UmVmcy5zcGxpY2UoIGksIDEgKTtcblx0XHRcdFx0XHRcdHRoaXMuc29mdFJlZnNbIHJlZi5rZXlwYXRoIF0gPSBmYWxzZTtcblx0XHRcdFx0XHRcdHJlZi50ZWFyZG93bigpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpID0gc29mdERlcHMubGVuZ3RoO1xuXHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRrZXlwYXRoID0gc29mdERlcHNbIGkgXTtcblx0XHRcdFx0XHRpZiAoICF0aGlzLnNvZnRSZWZzWyBrZXlwYXRoIF0gKSB7XG5cdFx0XHRcdFx0XHRyZWYgPSBuZXcgU29mdFJlZmVyZW5jZSggdGhpcy5yb290LCBrZXlwYXRoLCB0aGlzICk7XG5cdFx0XHRcdFx0XHR0aGlzLnNvZnRSZWZzLnB1c2goIHJlZiApO1xuXHRcdFx0XHRcdFx0dGhpcy5zb2Z0UmVmc1sga2V5cGF0aCBdID0gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5zZWxmVXBkYXRpbmcgPSB0aGlzLnJlZnMubGVuZ3RoICsgdGhpcy5zb2Z0UmVmcy5sZW5ndGggPD0gMTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBFdmFsdWF0b3I7XG5cblx0XHRmdW5jdGlvbiBnZXRGdW5jdGlvbkZyb21TdHJpbmcoIHN0ciwgaSApIHtcblx0XHRcdHZhciBmbiwgYXJncztcblx0XHRcdHN0ciA9IHN0ci5yZXBsYWNlKCAvXFwkXFx7KFswLTldKylcXH0vZywgJ18kMScgKTtcblx0XHRcdGlmICggY2FjaGVbIHN0ciBdICkge1xuXHRcdFx0XHRyZXR1cm4gY2FjaGVbIHN0ciBdO1xuXHRcdFx0fVxuXHRcdFx0YXJncyA9IFtdO1xuXHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdGFyZ3NbIGkgXSA9ICdfJyArIGk7XG5cdFx0XHR9XG5cdFx0XHRmbiA9IG5ldyBGdW5jdGlvbiggYXJncy5qb2luKCAnLCcgKSwgJ3JldHVybignICsgc3RyICsgJyknICk7XG5cdFx0XHRjYWNoZVsgc3RyIF0gPSBmbjtcblx0XHRcdHJldHVybiBmbjtcblx0XHR9XG5cdH0oIGdsb2JhbF9ydW5sb29wLCB1dGlsc193YXJuLCB1dGlsc19pc0VxdWFsLCBzaGFyZWRfY2xlYXJDYWNoZSwgc2hhcmVkX25vdGlmeURlcGVuZGFudHMsIHNoYXJlZF9hZGFwdElmTmVjZXNzYXJ5LCByZW5kZXJfc2hhcmVkX0V2YWx1YXRvcl9SZWZlcmVuY2UsIHJlbmRlcl9zaGFyZWRfRXZhbHVhdG9yX1NvZnRSZWZlcmVuY2UgKTtcblxuXHR2YXIgcmVuZGVyX3NoYXJlZF9FeHByZXNzaW9uUmVzb2x2ZXJfUmVmZXJlbmNlU2NvdXQgPSBmdW5jdGlvbiggcnVubG9vcCwgcmVzb2x2ZVJlZiwgdGVhcmRvd24gKSB7XG5cblx0XHR2YXIgUmVmZXJlbmNlU2NvdXQgPSBmdW5jdGlvbiggcmVzb2x2ZXIsIHJlZiwgcGFyZW50RnJhZ21lbnQsIGFyZ051bSApIHtcblx0XHRcdHZhciBrZXlwYXRoLCByYWN0aXZlO1xuXHRcdFx0cmFjdGl2ZSA9IHRoaXMucm9vdCA9IHJlc29sdmVyLnJvb3Q7XG5cdFx0XHR0aGlzLnJlZiA9IHJlZjtcblx0XHRcdHRoaXMucGFyZW50RnJhZ21lbnQgPSBwYXJlbnRGcmFnbWVudDtcblx0XHRcdGtleXBhdGggPSByZXNvbHZlUmVmKCByYWN0aXZlLCByZWYsIHBhcmVudEZyYWdtZW50ICk7XG5cdFx0XHRpZiAoIGtleXBhdGggIT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0cmVzb2x2ZXIucmVzb2x2ZSggYXJnTnVtLCBmYWxzZSwga2V5cGF0aCApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5hcmdOdW0gPSBhcmdOdW07XG5cdFx0XHRcdHRoaXMucmVzb2x2ZXIgPSByZXNvbHZlcjtcblx0XHRcdFx0cnVubG9vcC5hZGRVbnJlc29sdmVkKCB0aGlzICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRSZWZlcmVuY2VTY291dC5wcm90b3R5cGUgPSB7XG5cdFx0XHRyZXNvbHZlOiBmdW5jdGlvbigga2V5cGF0aCApIHtcblx0XHRcdFx0dGhpcy5rZXlwYXRoID0ga2V5cGF0aDtcblx0XHRcdFx0dGhpcy5yZXNvbHZlci5yZXNvbHZlKCB0aGlzLmFyZ051bSwgZmFsc2UsIGtleXBhdGggKTtcblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmICggIXRoaXMua2V5cGF0aCApIHtcblx0XHRcdFx0XHR0ZWFyZG93biggdGhpcyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gUmVmZXJlbmNlU2NvdXQ7XG5cdH0oIGdsb2JhbF9ydW5sb29wLCBzaGFyZWRfcmVzb2x2ZVJlZiwgc2hhcmVkX3RlYXJkb3duICk7XG5cblx0dmFyIHJlbmRlcl9zaGFyZWRfRXhwcmVzc2lvblJlc29sdmVyX2dldFVuaXF1ZVN0cmluZyA9IGZ1bmN0aW9uKCBzdHIsIGFyZ3MgKSB7XG5cdFx0cmV0dXJuIHN0ci5yZXBsYWNlKCAvXFwkXFx7KFswLTldKylcXH0vZywgZnVuY3Rpb24oIG1hdGNoLCAkMSApIHtcblx0XHRcdHJldHVybiBhcmdzWyAkMSBdID8gYXJnc1sgJDEgXVsgMSBdIDogJ3VuZGVmaW5lZCc7XG5cdFx0fSApO1xuXHR9O1xuXG5cdHZhciByZW5kZXJfc2hhcmVkX0V4cHJlc3Npb25SZXNvbHZlcl9pc1JlZ3VsYXJLZXlwYXRoID0gZnVuY3Rpb24oKSB7XG5cblx0XHR2YXIga2V5UGF0dGVybiA9IC9eKD86KD86W2EtekEtWiRfXVthLXpBLVokXzAtOV0qKXwoPzpbMC05XXxbMS05XVswLTldKykpJC87XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBrZXlwYXRoICkge1xuXHRcdFx0dmFyIGtleXMsIGtleSwgaTtcblx0XHRcdGtleXMgPSBrZXlwYXRoLnNwbGl0KCAnLicgKTtcblx0XHRcdGkgPSBrZXlzLmxlbmd0aDtcblx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRrZXkgPSBrZXlzWyBpIF07XG5cdFx0XHRcdGlmICgga2V5ID09PSAndW5kZWZpbmVkJyB8fCAha2V5UGF0dGVybi50ZXN0KCBrZXkgKSApIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH07XG5cdH0oKTtcblxuXHR2YXIgcmVuZGVyX3NoYXJlZF9FeHByZXNzaW9uUmVzb2x2ZXJfZ2V0S2V5cGF0aCA9IGZ1bmN0aW9uKCBub3JtYWxpc2VLZXlwYXRoLCBpc1JlZ3VsYXJLZXlwYXRoICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB1bmlxdWVTdHJpbmcgKSB7XG5cdFx0XHR2YXIgbm9ybWFsaXNlZDtcblx0XHRcdG5vcm1hbGlzZWQgPSBub3JtYWxpc2VLZXlwYXRoKCB1bmlxdWVTdHJpbmcgKTtcblx0XHRcdGlmICggaXNSZWd1bGFyS2V5cGF0aCggbm9ybWFsaXNlZCApICkge1xuXHRcdFx0XHRyZXR1cm4gbm9ybWFsaXNlZDtcblx0XHRcdH1cblx0XHRcdHJldHVybiAnJHsnICsgbm9ybWFsaXNlZC5yZXBsYWNlKCAvW1xcLlxcW1xcXV0vZywgJy0nICkgKyAnfSc7XG5cdFx0fTtcblx0fSggdXRpbHNfbm9ybWFsaXNlS2V5cGF0aCwgcmVuZGVyX3NoYXJlZF9FeHByZXNzaW9uUmVzb2x2ZXJfaXNSZWd1bGFyS2V5cGF0aCApO1xuXG5cdHZhciByZW5kZXJfc2hhcmVkX0V4cHJlc3Npb25SZXNvbHZlcl9fRXhwcmVzc2lvblJlc29sdmVyID0gZnVuY3Rpb24oIEV2YWx1YXRvciwgUmVmZXJlbmNlU2NvdXQsIGdldFVuaXF1ZVN0cmluZywgZ2V0S2V5cGF0aCApIHtcblxuXHRcdHZhciBFeHByZXNzaW9uUmVzb2x2ZXIgPSBmdW5jdGlvbiggbXVzdGFjaGUgKSB7XG5cdFx0XHR2YXIgZXhwcmVzc2lvbiwgaSwgbGVuLCByZWYsIGluZGV4UmVmcztcblx0XHRcdHRoaXMucm9vdCA9IG11c3RhY2hlLnJvb3Q7XG5cdFx0XHR0aGlzLm11c3RhY2hlID0gbXVzdGFjaGU7XG5cdFx0XHR0aGlzLmFyZ3MgPSBbXTtcblx0XHRcdHRoaXMuc2NvdXRzID0gW107XG5cdFx0XHRleHByZXNzaW9uID0gbXVzdGFjaGUuZGVzY3JpcHRvci54O1xuXHRcdFx0aW5kZXhSZWZzID0gbXVzdGFjaGUucGFyZW50RnJhZ21lbnQuaW5kZXhSZWZzO1xuXHRcdFx0dGhpcy5zdHIgPSBleHByZXNzaW9uLnM7XG5cdFx0XHRsZW4gPSB0aGlzLnVucmVzb2x2ZWQgPSB0aGlzLmFyZ3MubGVuZ3RoID0gZXhwcmVzc2lvbi5yID8gZXhwcmVzc2lvbi5yLmxlbmd0aCA6IDA7XG5cdFx0XHRpZiAoICFsZW4gKSB7XG5cdFx0XHRcdHRoaXMucmVzb2x2ZWQgPSB0aGlzLnJlYWR5ID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy5idWJibGUoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0cmVmID0gZXhwcmVzc2lvbi5yWyBpIF07XG5cdFx0XHRcdGlmICggaW5kZXhSZWZzICYmIGluZGV4UmVmc1sgcmVmIF0gIT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0XHR0aGlzLnJlc29sdmUoIGksIHRydWUsIGluZGV4UmVmc1sgcmVmIF0gKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLnNjb3V0cy5wdXNoKCBuZXcgUmVmZXJlbmNlU2NvdXQoIHRoaXMsIHJlZiwgbXVzdGFjaGUucGFyZW50RnJhZ21lbnQsIGkgKSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnJlYWR5ID0gdHJ1ZTtcblx0XHRcdHRoaXMuYnViYmxlKCk7XG5cdFx0fTtcblx0XHRFeHByZXNzaW9uUmVzb2x2ZXIucHJvdG90eXBlID0ge1xuXHRcdFx0YnViYmxlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIG9sZEtleXBhdGg7XG5cdFx0XHRcdGlmICggIXRoaXMucmVhZHkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdG9sZEtleXBhdGggPSB0aGlzLmtleXBhdGg7XG5cdFx0XHRcdHRoaXMudW5pcXVlU3RyaW5nID0gZ2V0VW5pcXVlU3RyaW5nKCB0aGlzLnN0ciwgdGhpcy5hcmdzICk7XG5cdFx0XHRcdHRoaXMua2V5cGF0aCA9IGdldEtleXBhdGgoIHRoaXMudW5pcXVlU3RyaW5nICk7XG5cdFx0XHRcdGlmICggdGhpcy5rZXlwYXRoLnN1YnN0ciggMCwgMiApID09PSAnJHsnICkge1xuXHRcdFx0XHRcdHRoaXMuY3JlYXRlRXZhbHVhdG9yKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5tdXN0YWNoZS5yZXNvbHZlKCB0aGlzLmtleXBhdGggKTtcblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHdoaWxlICggdGhpcy5zY291dHMubGVuZ3RoICkge1xuXHRcdFx0XHRcdHRoaXMuc2NvdXRzLnBvcCgpLnRlYXJkb3duKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRyZXNvbHZlOiBmdW5jdGlvbiggYXJnTnVtLCBpc0luZGV4UmVmLCB2YWx1ZSApIHtcblx0XHRcdFx0dGhpcy5hcmdzWyBhcmdOdW0gXSA9IFtcblx0XHRcdFx0XHRpc0luZGV4UmVmLFxuXHRcdFx0XHRcdHZhbHVlXG5cdFx0XHRcdF07XG5cdFx0XHRcdHRoaXMuYnViYmxlKCk7XG5cdFx0XHRcdHRoaXMucmVzb2x2ZWQgPSAhLS10aGlzLnVucmVzb2x2ZWQ7XG5cdFx0XHR9LFxuXHRcdFx0Y3JlYXRlRXZhbHVhdG9yOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIGV2YWx1YXRvcjtcblx0XHRcdFx0aWYgKCAhdGhpcy5yb290Ll9ldmFsdWF0b3JzWyB0aGlzLmtleXBhdGggXSApIHtcblx0XHRcdFx0XHRldmFsdWF0b3IgPSBuZXcgRXZhbHVhdG9yKCB0aGlzLnJvb3QsIHRoaXMua2V5cGF0aCwgdGhpcy51bmlxdWVTdHJpbmcsIHRoaXMuc3RyLCB0aGlzLmFyZ3MsIHRoaXMubXVzdGFjaGUucHJpb3JpdHkgKTtcblx0XHRcdFx0XHR0aGlzLnJvb3QuX2V2YWx1YXRvcnNbIHRoaXMua2V5cGF0aCBdID0gZXZhbHVhdG9yO1xuXHRcdFx0XHRcdGV2YWx1YXRvci51cGRhdGUoKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLnJvb3QuX2V2YWx1YXRvcnNbIHRoaXMua2V5cGF0aCBdLnJlZnJlc2goKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIEV4cHJlc3Npb25SZXNvbHZlcjtcblx0fSggcmVuZGVyX3NoYXJlZF9FdmFsdWF0b3JfX0V2YWx1YXRvciwgcmVuZGVyX3NoYXJlZF9FeHByZXNzaW9uUmVzb2x2ZXJfUmVmZXJlbmNlU2NvdXQsIHJlbmRlcl9zaGFyZWRfRXhwcmVzc2lvblJlc29sdmVyX2dldFVuaXF1ZVN0cmluZywgcmVuZGVyX3NoYXJlZF9FeHByZXNzaW9uUmVzb2x2ZXJfZ2V0S2V5cGF0aCApO1xuXG5cdHZhciByZW5kZXJfc2hhcmVkX2luaXRNdXN0YWNoZSA9IGZ1bmN0aW9uKCBydW5sb29wLCByZXNvbHZlUmVmLCBFeHByZXNzaW9uUmVzb2x2ZXIgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24gaW5pdE11c3RhY2hlKCBtdXN0YWNoZSwgb3B0aW9ucyApIHtcblx0XHRcdHZhciBrZXlwYXRoLCBpbmRleFJlZiwgcGFyZW50RnJhZ21lbnQ7XG5cdFx0XHRwYXJlbnRGcmFnbWVudCA9IG11c3RhY2hlLnBhcmVudEZyYWdtZW50ID0gb3B0aW9ucy5wYXJlbnRGcmFnbWVudDtcblx0XHRcdG11c3RhY2hlLnJvb3QgPSBwYXJlbnRGcmFnbWVudC5yb290O1xuXHRcdFx0bXVzdGFjaGUuZGVzY3JpcHRvciA9IG9wdGlvbnMuZGVzY3JpcHRvcjtcblx0XHRcdG11c3RhY2hlLmluZGV4ID0gb3B0aW9ucy5pbmRleCB8fCAwO1xuXHRcdFx0bXVzdGFjaGUucHJpb3JpdHkgPSBwYXJlbnRGcmFnbWVudC5wcmlvcml0eTtcblx0XHRcdG11c3RhY2hlLnR5cGUgPSBvcHRpb25zLmRlc2NyaXB0b3IudDtcblx0XHRcdGlmICggb3B0aW9ucy5kZXNjcmlwdG9yLnIgKSB7XG5cdFx0XHRcdGlmICggcGFyZW50RnJhZ21lbnQuaW5kZXhSZWZzICYmIHBhcmVudEZyYWdtZW50LmluZGV4UmVmc1sgb3B0aW9ucy5kZXNjcmlwdG9yLnIgXSAhPT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRcdGluZGV4UmVmID0gcGFyZW50RnJhZ21lbnQuaW5kZXhSZWZzWyBvcHRpb25zLmRlc2NyaXB0b3IuciBdO1xuXHRcdFx0XHRcdG11c3RhY2hlLmluZGV4UmVmID0gb3B0aW9ucy5kZXNjcmlwdG9yLnI7XG5cdFx0XHRcdFx0bXVzdGFjaGUudmFsdWUgPSBpbmRleFJlZjtcblx0XHRcdFx0XHRtdXN0YWNoZS5yZW5kZXIoIG11c3RhY2hlLnZhbHVlICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0a2V5cGF0aCA9IHJlc29sdmVSZWYoIG11c3RhY2hlLnJvb3QsIG9wdGlvbnMuZGVzY3JpcHRvci5yLCBtdXN0YWNoZS5wYXJlbnRGcmFnbWVudCApO1xuXHRcdFx0XHRcdGlmICgga2V5cGF0aCAhPT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRcdFx0bXVzdGFjaGUucmVzb2x2ZSgga2V5cGF0aCApO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRtdXN0YWNoZS5yZWYgPSBvcHRpb25zLmRlc2NyaXB0b3Iucjtcblx0XHRcdFx0XHRcdHJ1bmxvb3AuYWRkVW5yZXNvbHZlZCggbXVzdGFjaGUgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICggb3B0aW9ucy5kZXNjcmlwdG9yLnggKSB7XG5cdFx0XHRcdG11c3RhY2hlLmV4cHJlc3Npb25SZXNvbHZlciA9IG5ldyBFeHByZXNzaW9uUmVzb2x2ZXIoIG11c3RhY2hlICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIG11c3RhY2hlLmRlc2NyaXB0b3IubiAmJiAhbXVzdGFjaGUuaGFzT3duUHJvcGVydHkoICd2YWx1ZScgKSApIHtcblx0XHRcdFx0bXVzdGFjaGUucmVuZGVyKCB1bmRlZmluZWQgKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9KCBnbG9iYWxfcnVubG9vcCwgc2hhcmVkX3Jlc29sdmVSZWYsIHJlbmRlcl9zaGFyZWRfRXhwcmVzc2lvblJlc29sdmVyX19FeHByZXNzaW9uUmVzb2x2ZXIgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X1NlY3Rpb25fcmVhc3NpZ25GcmFnbWVudCA9IGZ1bmN0aW9uKCB0eXBlcywgRXhwcmVzc2lvblJlc29sdmVyICkge1xuXG5cdFx0cmV0dXJuIHJlYXNzaWduRnJhZ21lbnQ7XG5cblx0XHRmdW5jdGlvbiByZWFzc2lnbkZyYWdtZW50KCBmcmFnbWVudCwgaW5kZXhSZWYsIG5ld0luZGV4LCBvbGRLZXlwYXRoLCBuZXdLZXlwYXRoICkge1xuXHRcdFx0dmFyIGksIGl0ZW0sIHF1ZXJ5O1xuXHRcdFx0aWYgKCBmcmFnbWVudC5odG1sICE9PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGFzc2lnbk5ld0tleXBhdGgoIGZyYWdtZW50LCAnY29udGV4dCcsIG9sZEtleXBhdGgsIG5ld0tleXBhdGggKTtcblx0XHRcdGlmICggZnJhZ21lbnQuaW5kZXhSZWZzICYmIGZyYWdtZW50LmluZGV4UmVmc1sgaW5kZXhSZWYgXSAhPT0gdW5kZWZpbmVkICYmIGZyYWdtZW50LmluZGV4UmVmc1sgaW5kZXhSZWYgXSAhPT0gbmV3SW5kZXggKSB7XG5cdFx0XHRcdGZyYWdtZW50LmluZGV4UmVmc1sgaW5kZXhSZWYgXSA9IG5ld0luZGV4O1xuXHRcdFx0fVxuXHRcdFx0aSA9IGZyYWdtZW50Lml0ZW1zLmxlbmd0aDtcblx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRpdGVtID0gZnJhZ21lbnQuaXRlbXNbIGkgXTtcblx0XHRcdFx0c3dpdGNoICggaXRlbS50eXBlICkge1xuXHRcdFx0XHRcdGNhc2UgdHlwZXMuRUxFTUVOVDpcblx0XHRcdFx0XHRcdHJlYXNzaWduRWxlbWVudCggaXRlbSwgaW5kZXhSZWYsIG5ld0luZGV4LCBvbGRLZXlwYXRoLCBuZXdLZXlwYXRoICk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlIHR5cGVzLlBBUlRJQUw6XG5cdFx0XHRcdFx0XHRyZWFzc2lnbkZyYWdtZW50KCBpdGVtLmZyYWdtZW50LCBpbmRleFJlZiwgbmV3SW5kZXgsIG9sZEtleXBhdGgsIG5ld0tleXBhdGggKTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGNhc2UgdHlwZXMuQ09NUE9ORU5UOlxuXHRcdFx0XHRcdFx0cmVhc3NpZ25GcmFnbWVudCggaXRlbS5pbnN0YW5jZS5mcmFnbWVudCwgaW5kZXhSZWYsIG5ld0luZGV4LCBvbGRLZXlwYXRoLCBuZXdLZXlwYXRoICk7XG5cdFx0XHRcdFx0XHRpZiAoIHF1ZXJ5ID0gZnJhZ21lbnQucm9vdC5fbGl2ZUNvbXBvbmVudFF1ZXJpZXNbIGl0ZW0ubmFtZSBdICkge1xuXHRcdFx0XHRcdFx0XHRxdWVyeS5fbWFrZURpcnR5KCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlIHR5cGVzLlNFQ1RJT046XG5cdFx0XHRcdFx0Y2FzZSB0eXBlcy5JTlRFUlBPTEFUT1I6XG5cdFx0XHRcdFx0Y2FzZSB0eXBlcy5UUklQTEU6XG5cdFx0XHRcdFx0XHRyZWFzc2lnbk11c3RhY2hlKCBpdGVtLCBpbmRleFJlZiwgbmV3SW5kZXgsIG9sZEtleXBhdGgsIG5ld0tleXBhdGggKTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gYXNzaWduTmV3S2V5cGF0aCggdGFyZ2V0LCBwcm9wZXJ0eSwgb2xkS2V5cGF0aCwgbmV3S2V5cGF0aCApIHtcblx0XHRcdGlmICggIXRhcmdldFsgcHJvcGVydHkgXSB8fCBzdGFydHNXaXRoKCB0YXJnZXRbIHByb3BlcnR5IF0sIG5ld0tleXBhdGggKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dGFyZ2V0WyBwcm9wZXJ0eSBdID0gZ2V0TmV3S2V5cGF0aCggdGFyZ2V0WyBwcm9wZXJ0eSBdLCBvbGRLZXlwYXRoLCBuZXdLZXlwYXRoICk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gc3RhcnRzV2l0aCggdGFyZ2V0LCBrZXlwYXRoICkge1xuXHRcdFx0cmV0dXJuIHRhcmdldCA9PT0ga2V5cGF0aCB8fCBzdGFydHNXaXRoS2V5cGF0aCggdGFyZ2V0LCBrZXlwYXRoICk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gc3RhcnRzV2l0aEtleXBhdGgoIHRhcmdldCwga2V5cGF0aCApIHtcblx0XHRcdHJldHVybiB0YXJnZXQuc3Vic3RyKCAwLCBrZXlwYXRoLmxlbmd0aCArIDEgKSA9PT0ga2V5cGF0aCArICcuJztcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXROZXdLZXlwYXRoKCB0YXJnZXRLZXlwYXRoLCBvbGRLZXlwYXRoLCBuZXdLZXlwYXRoICkge1xuXHRcdFx0aWYgKCB0YXJnZXRLZXlwYXRoID09PSBvbGRLZXlwYXRoICkge1xuXHRcdFx0XHRyZXR1cm4gbmV3S2V5cGF0aDtcblx0XHRcdH1cblx0XHRcdGlmICggc3RhcnRzV2l0aEtleXBhdGgoIHRhcmdldEtleXBhdGgsIG9sZEtleXBhdGggKSApIHtcblx0XHRcdFx0cmV0dXJuIHRhcmdldEtleXBhdGgucmVwbGFjZSggb2xkS2V5cGF0aCArICcuJywgbmV3S2V5cGF0aCArICcuJyApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHJlYXNzaWduRWxlbWVudCggZWxlbWVudCwgaW5kZXhSZWYsIG5ld0luZGV4LCBvbGRLZXlwYXRoLCBuZXdLZXlwYXRoICkge1xuXHRcdFx0dmFyIGksIGF0dHJpYnV0ZSwgc3RvcmFnZSwgbWFzdGVyRXZlbnROYW1lLCBwcm94aWVzLCBwcm94eSwgYmluZGluZywgYmluZGluZ3MsIGxpdmVRdWVyaWVzLCByYWN0aXZlO1xuXHRcdFx0aSA9IGVsZW1lbnQuYXR0cmlidXRlcy5sZW5ndGg7XG5cdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0YXR0cmlidXRlID0gZWxlbWVudC5hdHRyaWJ1dGVzWyBpIF07XG5cdFx0XHRcdGlmICggYXR0cmlidXRlLmZyYWdtZW50ICkge1xuXHRcdFx0XHRcdHJlYXNzaWduRnJhZ21lbnQoIGF0dHJpYnV0ZS5mcmFnbWVudCwgaW5kZXhSZWYsIG5ld0luZGV4LCBvbGRLZXlwYXRoLCBuZXdLZXlwYXRoICk7XG5cdFx0XHRcdFx0aWYgKCBhdHRyaWJ1dGUudHdvd2F5ICkge1xuXHRcdFx0XHRcdFx0YXR0cmlidXRlLnVwZGF0ZUJpbmRpbmdzKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHN0b3JhZ2UgPSBlbGVtZW50Lm5vZGUuX3JhY3RpdmUgKSB7XG5cdFx0XHRcdGFzc2lnbk5ld0tleXBhdGgoIHN0b3JhZ2UsICdrZXlwYXRoJywgb2xkS2V5cGF0aCwgbmV3S2V5cGF0aCApO1xuXHRcdFx0XHRpZiAoIGluZGV4UmVmICE9IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0XHRzdG9yYWdlLmluZGV4WyBpbmRleFJlZiBdID0gbmV3SW5kZXg7XG5cdFx0XHRcdH1cblx0XHRcdFx0Zm9yICggbWFzdGVyRXZlbnROYW1lIGluIHN0b3JhZ2UuZXZlbnRzICkge1xuXHRcdFx0XHRcdHByb3hpZXMgPSBzdG9yYWdlLmV2ZW50c1sgbWFzdGVyRXZlbnROYW1lIF0ucHJveGllcztcblx0XHRcdFx0XHRpID0gcHJveGllcy5sZW5ndGg7XG5cdFx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0XHRwcm94eSA9IHByb3hpZXNbIGkgXTtcblx0XHRcdFx0XHRcdGlmICggdHlwZW9mIHByb3h5Lm4gPT09ICdvYmplY3QnICkge1xuXHRcdFx0XHRcdFx0XHRyZWFzc2lnbkZyYWdtZW50KCBwcm94eS5hLCBpbmRleFJlZiwgbmV3SW5kZXgsIG9sZEtleXBhdGgsIG5ld0tleXBhdGggKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmICggcHJveHkuZCApIHtcblx0XHRcdFx0XHRcdFx0cmVhc3NpZ25GcmFnbWVudCggcHJveHkuZCwgaW5kZXhSZWYsIG5ld0luZGV4LCBvbGRLZXlwYXRoLCBuZXdLZXlwYXRoICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggYmluZGluZyA9IHN0b3JhZ2UuYmluZGluZyApIHtcblx0XHRcdFx0XHRpZiAoIGJpbmRpbmcua2V5cGF0aC5zdWJzdHIoIDAsIG9sZEtleXBhdGgubGVuZ3RoICkgPT09IG9sZEtleXBhdGggKSB7XG5cdFx0XHRcdFx0XHRiaW5kaW5ncyA9IHN0b3JhZ2Uucm9vdC5fdHdvd2F5QmluZGluZ3NbIGJpbmRpbmcua2V5cGF0aCBdO1xuXHRcdFx0XHRcdFx0YmluZGluZ3Muc3BsaWNlKCBiaW5kaW5ncy5pbmRleE9mKCBiaW5kaW5nICksIDEgKTtcblx0XHRcdFx0XHRcdGJpbmRpbmcua2V5cGF0aCA9IGJpbmRpbmcua2V5cGF0aC5yZXBsYWNlKCBvbGRLZXlwYXRoLCBuZXdLZXlwYXRoICk7XG5cdFx0XHRcdFx0XHRiaW5kaW5ncyA9IHN0b3JhZ2Uucm9vdC5fdHdvd2F5QmluZGluZ3NbIGJpbmRpbmcua2V5cGF0aCBdIHx8ICggc3RvcmFnZS5yb290Ll90d293YXlCaW5kaW5nc1sgYmluZGluZy5rZXlwYXRoIF0gPSBbXSApO1xuXHRcdFx0XHRcdFx0YmluZGluZ3MucHVzaCggYmluZGluZyApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCBlbGVtZW50LmZyYWdtZW50ICkge1xuXHRcdFx0XHRyZWFzc2lnbkZyYWdtZW50KCBlbGVtZW50LmZyYWdtZW50LCBpbmRleFJlZiwgbmV3SW5kZXgsIG9sZEtleXBhdGgsIG5ld0tleXBhdGggKTtcblx0XHRcdH1cblx0XHRcdGlmICggbGl2ZVF1ZXJpZXMgPSBlbGVtZW50LmxpdmVRdWVyaWVzICkge1xuXHRcdFx0XHRyYWN0aXZlID0gZWxlbWVudC5yb290O1xuXHRcdFx0XHRpID0gbGl2ZVF1ZXJpZXMubGVuZ3RoO1xuXHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRsaXZlUXVlcmllc1sgaSBdLl9tYWtlRGlydHkoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHJlYXNzaWduTXVzdGFjaGUoIG11c3RhY2hlLCBpbmRleFJlZiwgbmV3SW5kZXgsIG9sZEtleXBhdGgsIG5ld0tleXBhdGggKSB7XG5cdFx0XHR2YXIgdXBkYXRlZCwgaTtcblx0XHRcdGlmICggbXVzdGFjaGUuZGVzY3JpcHRvci54ICkge1xuXHRcdFx0XHRpZiAoIG11c3RhY2hlLmV4cHJlc3Npb25SZXNvbHZlciApIHtcblx0XHRcdFx0XHRtdXN0YWNoZS5leHByZXNzaW9uUmVzb2x2ZXIudGVhcmRvd24oKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRtdXN0YWNoZS5leHByZXNzaW9uUmVzb2x2ZXIgPSBuZXcgRXhwcmVzc2lvblJlc29sdmVyKCBtdXN0YWNoZSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBtdXN0YWNoZS5rZXlwYXRoICkge1xuXHRcdFx0XHR1cGRhdGVkID0gZ2V0TmV3S2V5cGF0aCggbXVzdGFjaGUua2V5cGF0aCwgb2xkS2V5cGF0aCwgbmV3S2V5cGF0aCApO1xuXHRcdFx0XHRpZiAoIHVwZGF0ZWQgKSB7XG5cdFx0XHRcdFx0bXVzdGFjaGUucmVzb2x2ZSggdXBkYXRlZCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKCBpbmRleFJlZiAhPT0gdW5kZWZpbmVkICYmIG11c3RhY2hlLmluZGV4UmVmID09PSBpbmRleFJlZiApIHtcblx0XHRcdFx0bXVzdGFjaGUudmFsdWUgPSBuZXdJbmRleDtcblx0XHRcdFx0bXVzdGFjaGUucmVuZGVyKCBuZXdJbmRleCApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBtdXN0YWNoZS5mcmFnbWVudHMgKSB7XG5cdFx0XHRcdGkgPSBtdXN0YWNoZS5mcmFnbWVudHMubGVuZ3RoO1xuXHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRyZWFzc2lnbkZyYWdtZW50KCBtdXN0YWNoZS5mcmFnbWVudHNbIGkgXSwgaW5kZXhSZWYsIG5ld0luZGV4LCBvbGRLZXlwYXRoLCBuZXdLZXlwYXRoICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH0oIGNvbmZpZ190eXBlcywgcmVuZGVyX3NoYXJlZF9FeHByZXNzaW9uUmVzb2x2ZXJfX0V4cHJlc3Npb25SZXNvbHZlciApO1xuXG5cdHZhciByZW5kZXJfc2hhcmVkX3Jlc29sdmVNdXN0YWNoZSA9IGZ1bmN0aW9uKCB0eXBlcywgcmVnaXN0ZXJEZXBlbmRhbnQsIHVucmVnaXN0ZXJEZXBlbmRhbnQsIHJlYXNzaWduRnJhZ21lbnQgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24gcmVzb2x2ZU11c3RhY2hlKCBrZXlwYXRoICkge1xuXHRcdFx0dmFyIGk7XG5cdFx0XHRpZiAoIGtleXBhdGggPT09IHRoaXMua2V5cGF0aCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aGlzLnJlZ2lzdGVyZWQgKSB7XG5cdFx0XHRcdHVucmVnaXN0ZXJEZXBlbmRhbnQoIHRoaXMgKTtcblx0XHRcdFx0aWYgKCB0aGlzLnR5cGUgPT09IHR5cGVzLlNFQ1RJT04gKSB7XG5cdFx0XHRcdFx0aSA9IHRoaXMuZnJhZ21lbnRzLmxlbmd0aDtcblx0XHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRcdHJlYXNzaWduRnJhZ21lbnQoIHRoaXMuZnJhZ21lbnRzWyBpIF0sIG51bGwsIG51bGwsIHRoaXMua2V5cGF0aCwga2V5cGF0aCApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0dGhpcy5rZXlwYXRoID0ga2V5cGF0aDtcblx0XHRcdHJlZ2lzdGVyRGVwZW5kYW50KCB0aGlzICk7XG5cdFx0XHR0aGlzLnVwZGF0ZSgpO1xuXHRcdFx0aWYgKCB0aGlzLnJvb3QudHdvd2F5ICYmIHRoaXMucGFyZW50RnJhZ21lbnQub3duZXIudHlwZSA9PT0gdHlwZXMuQVRUUklCVVRFICkge1xuXHRcdFx0XHR0aGlzLnBhcmVudEZyYWdtZW50Lm93bmVyLmVsZW1lbnQuYmluZCgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aGlzLmV4cHJlc3Npb25SZXNvbHZlciAmJiB0aGlzLmV4cHJlc3Npb25SZXNvbHZlci5yZXNvbHZlZCApIHtcblx0XHRcdFx0dGhpcy5leHByZXNzaW9uUmVzb2x2ZXIgPSBudWxsO1xuXHRcdFx0fVxuXHRcdH07XG5cdH0oIGNvbmZpZ190eXBlcywgc2hhcmVkX3JlZ2lzdGVyRGVwZW5kYW50LCBzaGFyZWRfdW5yZWdpc3RlckRlcGVuZGFudCwgcmVuZGVyX0RvbUZyYWdtZW50X1NlY3Rpb25fcmVhc3NpZ25GcmFnbWVudCApO1xuXG5cdHZhciByZW5kZXJfc2hhcmVkX3VwZGF0ZU11c3RhY2hlID0gZnVuY3Rpb24oIGlzRXF1YWwsIGdldCApIHtcblxuXHRcdHZhciBvcHRpb25zID0ge1xuXHRcdFx0ZXZhbHVhdGVXcmFwcGVkOiB0cnVlXG5cdFx0fTtcblx0XHRyZXR1cm4gZnVuY3Rpb24gdXBkYXRlTXVzdGFjaGUoKSB7XG5cdFx0XHR2YXIgdmFsdWUgPSBnZXQoIHRoaXMucm9vdCwgdGhpcy5rZXlwYXRoLCBvcHRpb25zICk7XG5cdFx0XHRpZiAoICFpc0VxdWFsKCB2YWx1ZSwgdGhpcy52YWx1ZSApICkge1xuXHRcdFx0XHR0aGlzLnJlbmRlciggdmFsdWUgKTtcblx0XHRcdFx0dGhpcy52YWx1ZSA9IHZhbHVlO1xuXHRcdFx0fVxuXHRcdH07XG5cdH0oIHV0aWxzX2lzRXF1YWwsIHNoYXJlZF9nZXRfX2dldCApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfSW50ZXJwb2xhdG9yID0gZnVuY3Rpb24oIHR5cGVzLCB0ZWFyZG93biwgaW5pdE11c3RhY2hlLCByZXNvbHZlTXVzdGFjaGUsIHVwZGF0ZU11c3RhY2hlLCBkZXRhY2ggKSB7XG5cblx0XHR2YXIgRG9tSW50ZXJwb2xhdG9yLCBsZXNzVGhhbiwgZ3JlYXRlclRoYW47XG5cdFx0bGVzc1RoYW4gPSAvPC9nO1xuXHRcdGdyZWF0ZXJUaGFuID0gLz4vZztcblx0XHREb21JbnRlcnBvbGF0b3IgPSBmdW5jdGlvbiggb3B0aW9ucywgZG9jRnJhZyApIHtcblx0XHRcdHRoaXMudHlwZSA9IHR5cGVzLklOVEVSUE9MQVRPUjtcblx0XHRcdGlmICggZG9jRnJhZyApIHtcblx0XHRcdFx0dGhpcy5ub2RlID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoICcnICk7XG5cdFx0XHRcdGRvY0ZyYWcuYXBwZW5kQ2hpbGQoIHRoaXMubm9kZSApO1xuXHRcdFx0fVxuXHRcdFx0aW5pdE11c3RhY2hlKCB0aGlzLCBvcHRpb25zICk7XG5cdFx0fTtcblx0XHREb21JbnRlcnBvbGF0b3IucHJvdG90eXBlID0ge1xuXHRcdFx0dXBkYXRlOiB1cGRhdGVNdXN0YWNoZSxcblx0XHRcdHJlc29sdmU6IHJlc29sdmVNdXN0YWNoZSxcblx0XHRcdGRldGFjaDogZGV0YWNoLFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCBkZXN0cm95ICkge1xuXHRcdFx0XHRpZiAoIGRlc3Ryb3kgKSB7XG5cdFx0XHRcdFx0dGhpcy5kZXRhY2goKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0ZWFyZG93biggdGhpcyApO1xuXHRcdFx0fSxcblx0XHRcdHJlbmRlcjogZnVuY3Rpb24oIHZhbHVlICkge1xuXHRcdFx0XHRpZiAoIHRoaXMubm9kZSApIHtcblx0XHRcdFx0XHR0aGlzLm5vZGUuZGF0YSA9IHZhbHVlID09IHVuZGVmaW5lZCA/ICcnIDogdmFsdWU7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRmaXJzdE5vZGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5ub2RlO1xuXHRcdFx0fSxcblx0XHRcdHRvU3RyaW5nOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHZhbHVlID0gdGhpcy52YWx1ZSAhPSB1bmRlZmluZWQgPyAnJyArIHRoaXMudmFsdWUgOiAnJztcblx0XHRcdFx0cmV0dXJuIHZhbHVlLnJlcGxhY2UoIGxlc3NUaGFuLCAnJmx0OycgKS5yZXBsYWNlKCBncmVhdGVyVGhhbiwgJyZndDsnICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gRG9tSW50ZXJwb2xhdG9yO1xuXHR9KCBjb25maWdfdHlwZXMsIHNoYXJlZF90ZWFyZG93biwgcmVuZGVyX3NoYXJlZF9pbml0TXVzdGFjaGUsIHJlbmRlcl9zaGFyZWRfcmVzb2x2ZU11c3RhY2hlLCByZW5kZXJfc2hhcmVkX3VwZGF0ZU11c3RhY2hlLCByZW5kZXJfRG9tRnJhZ21lbnRfc2hhcmVkX2RldGFjaCApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfU2VjdGlvbl9wcm90b3R5cGVfbWVyZ2UgPSBmdW5jdGlvbiggcmVhc3NpZ25GcmFnbWVudCApIHtcblxuXHRcdHZhciB0b1RlYXJkb3duID0gW107XG5cdFx0cmV0dXJuIGZ1bmN0aW9uIHNlY3Rpb25NZXJnZSggbmV3SW5kaWNlcyApIHtcblx0XHRcdHZhciBzZWN0aW9uID0gdGhpcyxcblx0XHRcdFx0cGFyZW50RnJhZ21lbnQsIGZpcnN0Q2hhbmdlLCBpLCBuZXdMZW5ndGgsIHJlYXNzaWduZWRGcmFnbWVudHMsIGZyYWdtZW50T3B0aW9ucywgZnJhZ21lbnQsIG5leHROb2RlO1xuXHRcdFx0cGFyZW50RnJhZ21lbnQgPSB0aGlzLnBhcmVudEZyYWdtZW50O1xuXHRcdFx0cmVhc3NpZ25lZEZyYWdtZW50cyA9IFtdO1xuXHRcdFx0bmV3SW5kaWNlcy5mb3JFYWNoKCBmdW5jdGlvbiByZWFzc2lnbklmTmVjZXNzYXJ5KCBuZXdJbmRleCwgb2xkSW5kZXggKSB7XG5cdFx0XHRcdHZhciBmcmFnbWVudCwgYnksIG9sZEtleXBhdGgsIG5ld0tleXBhdGg7XG5cdFx0XHRcdGlmICggbmV3SW5kZXggPT09IG9sZEluZGV4ICkge1xuXHRcdFx0XHRcdHJlYXNzaWduZWRGcmFnbWVudHNbIG5ld0luZGV4IF0gPSBzZWN0aW9uLmZyYWdtZW50c1sgb2xkSW5kZXggXTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBmaXJzdENoYW5nZSA9PT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRcdGZpcnN0Q2hhbmdlID0gb2xkSW5kZXg7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBuZXdJbmRleCA9PT0gLTEgKSB7XG5cdFx0XHRcdFx0dG9UZWFyZG93bi5wdXNoKCBzZWN0aW9uLmZyYWdtZW50c1sgb2xkSW5kZXggXSApO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRmcmFnbWVudCA9IHNlY3Rpb24uZnJhZ21lbnRzWyBvbGRJbmRleCBdO1xuXHRcdFx0XHRieSA9IG5ld0luZGV4IC0gb2xkSW5kZXg7XG5cdFx0XHRcdG9sZEtleXBhdGggPSBzZWN0aW9uLmtleXBhdGggKyAnLicgKyBvbGRJbmRleDtcblx0XHRcdFx0bmV3S2V5cGF0aCA9IHNlY3Rpb24ua2V5cGF0aCArICcuJyArIG5ld0luZGV4O1xuXHRcdFx0XHRyZWFzc2lnbkZyYWdtZW50KCBmcmFnbWVudCwgc2VjdGlvbi5kZXNjcmlwdG9yLmksIG9sZEluZGV4LCBuZXdJbmRleCwgYnksIG9sZEtleXBhdGgsIG5ld0tleXBhdGggKTtcblx0XHRcdFx0cmVhc3NpZ25lZEZyYWdtZW50c1sgbmV3SW5kZXggXSA9IGZyYWdtZW50O1xuXHRcdFx0fSApO1xuXHRcdFx0d2hpbGUgKCBmcmFnbWVudCA9IHRvVGVhcmRvd24ucG9wKCkgKSB7XG5cdFx0XHRcdGZyYWdtZW50LnRlYXJkb3duKCB0cnVlICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGZpcnN0Q2hhbmdlID09PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdGZpcnN0Q2hhbmdlID0gdGhpcy5sZW5ndGg7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmxlbmd0aCA9IG5ld0xlbmd0aCA9IHRoaXMucm9vdC5nZXQoIHRoaXMua2V5cGF0aCApLmxlbmd0aDtcblx0XHRcdGlmICggbmV3TGVuZ3RoID09PSBmaXJzdENoYW5nZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0ZnJhZ21lbnRPcHRpb25zID0ge1xuXHRcdFx0XHRkZXNjcmlwdG9yOiB0aGlzLmRlc2NyaXB0b3IuZixcblx0XHRcdFx0cm9vdDogdGhpcy5yb290LFxuXHRcdFx0XHRwTm9kZTogcGFyZW50RnJhZ21lbnQucE5vZGUsXG5cdFx0XHRcdG93bmVyOiB0aGlzXG5cdFx0XHR9O1xuXHRcdFx0aWYgKCB0aGlzLmRlc2NyaXB0b3IuaSApIHtcblx0XHRcdFx0ZnJhZ21lbnRPcHRpb25zLmluZGV4UmVmID0gdGhpcy5kZXNjcmlwdG9yLmk7XG5cdFx0XHR9XG5cdFx0XHRmb3IgKCBpID0gZmlyc3RDaGFuZ2U7IGkgPCBuZXdMZW5ndGg7IGkgKz0gMSApIHtcblx0XHRcdFx0aWYgKCBmcmFnbWVudCA9IHJlYXNzaWduZWRGcmFnbWVudHNbIGkgXSApIHtcblx0XHRcdFx0XHR0aGlzLmRvY0ZyYWcuYXBwZW5kQ2hpbGQoIGZyYWdtZW50LmRldGFjaCggZmFsc2UgKSApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGZyYWdtZW50T3B0aW9ucy5jb250ZXh0ID0gdGhpcy5rZXlwYXRoICsgJy4nICsgaTtcblx0XHRcdFx0XHRmcmFnbWVudE9wdGlvbnMuaW5kZXggPSBpO1xuXHRcdFx0XHRcdGZyYWdtZW50ID0gdGhpcy5jcmVhdGVGcmFnbWVudCggZnJhZ21lbnRPcHRpb25zICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5mcmFnbWVudHNbIGkgXSA9IGZyYWdtZW50O1xuXHRcdFx0fVxuXHRcdFx0bmV4dE5vZGUgPSBwYXJlbnRGcmFnbWVudC5maW5kTmV4dE5vZGUoIHRoaXMgKTtcblx0XHRcdHBhcmVudEZyYWdtZW50LnBOb2RlLmluc2VydEJlZm9yZSggdGhpcy5kb2NGcmFnLCBuZXh0Tm9kZSApO1xuXHRcdH07XG5cdH0oIHJlbmRlcl9Eb21GcmFnbWVudF9TZWN0aW9uX3JlYXNzaWduRnJhZ21lbnQgKTtcblxuXHR2YXIgcmVuZGVyX3NoYXJlZF91cGRhdGVTZWN0aW9uID0gZnVuY3Rpb24oIGlzQXJyYXksIGlzT2JqZWN0ICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uIHVwZGF0ZVNlY3Rpb24oIHNlY3Rpb24sIHZhbHVlICkge1xuXHRcdFx0dmFyIGZyYWdtZW50T3B0aW9ucyA9IHtcblx0XHRcdFx0ZGVzY3JpcHRvcjogc2VjdGlvbi5kZXNjcmlwdG9yLmYsXG5cdFx0XHRcdHJvb3Q6IHNlY3Rpb24ucm9vdCxcblx0XHRcdFx0cE5vZGU6IHNlY3Rpb24ucGFyZW50RnJhZ21lbnQucE5vZGUsXG5cdFx0XHRcdHBFbGVtZW50OiBzZWN0aW9uLnBhcmVudEZyYWdtZW50LnBFbGVtZW50LFxuXHRcdFx0XHRvd25lcjogc2VjdGlvblxuXHRcdFx0fTtcblx0XHRcdGlmICggc2VjdGlvbi5kZXNjcmlwdG9yLm4gKSB7XG5cdFx0XHRcdHVwZGF0ZUNvbmRpdGlvbmFsU2VjdGlvbiggc2VjdGlvbiwgdmFsdWUsIHRydWUsIGZyYWdtZW50T3B0aW9ucyApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGlzQXJyYXkoIHZhbHVlICkgKSB7XG5cdFx0XHRcdHVwZGF0ZUxpc3RTZWN0aW9uKCBzZWN0aW9uLCB2YWx1ZSwgZnJhZ21lbnRPcHRpb25zICk7XG5cdFx0XHR9IGVsc2UgaWYgKCBpc09iamVjdCggdmFsdWUgKSB8fCB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRcdGlmICggc2VjdGlvbi5kZXNjcmlwdG9yLmkgKSB7XG5cdFx0XHRcdFx0dXBkYXRlTGlzdE9iamVjdFNlY3Rpb24oIHNlY3Rpb24sIHZhbHVlLCBmcmFnbWVudE9wdGlvbnMgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR1cGRhdGVDb250ZXh0U2VjdGlvbiggc2VjdGlvbiwgZnJhZ21lbnRPcHRpb25zICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHVwZGF0ZUNvbmRpdGlvbmFsU2VjdGlvbiggc2VjdGlvbiwgdmFsdWUsIGZhbHNlLCBmcmFnbWVudE9wdGlvbnMgKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0ZnVuY3Rpb24gdXBkYXRlTGlzdFNlY3Rpb24oIHNlY3Rpb24sIHZhbHVlLCBmcmFnbWVudE9wdGlvbnMgKSB7XG5cdFx0XHR2YXIgaSwgbGVuZ3RoLCBmcmFnbWVudHNUb1JlbW92ZTtcblx0XHRcdGxlbmd0aCA9IHZhbHVlLmxlbmd0aDtcblx0XHRcdGlmICggbGVuZ3RoIDwgc2VjdGlvbi5sZW5ndGggKSB7XG5cdFx0XHRcdGZyYWdtZW50c1RvUmVtb3ZlID0gc2VjdGlvbi5mcmFnbWVudHMuc3BsaWNlKCBsZW5ndGgsIHNlY3Rpb24ubGVuZ3RoIC0gbGVuZ3RoICk7XG5cdFx0XHRcdHdoaWxlICggZnJhZ21lbnRzVG9SZW1vdmUubGVuZ3RoICkge1xuXHRcdFx0XHRcdGZyYWdtZW50c1RvUmVtb3ZlLnBvcCgpLnRlYXJkb3duKCB0cnVlICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmICggbGVuZ3RoID4gc2VjdGlvbi5sZW5ndGggKSB7XG5cdFx0XHRcdFx0Zm9yICggaSA9IHNlY3Rpb24ubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0XHRmcmFnbWVudE9wdGlvbnMuY29udGV4dCA9IHNlY3Rpb24ua2V5cGF0aCArICcuJyArIGk7XG5cdFx0XHRcdFx0XHRmcmFnbWVudE9wdGlvbnMuaW5kZXggPSBpO1xuXHRcdFx0XHRcdFx0aWYgKCBzZWN0aW9uLmRlc2NyaXB0b3IuaSApIHtcblx0XHRcdFx0XHRcdFx0ZnJhZ21lbnRPcHRpb25zLmluZGV4UmVmID0gc2VjdGlvbi5kZXNjcmlwdG9yLmk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRzZWN0aW9uLmZyYWdtZW50c1sgaSBdID0gc2VjdGlvbi5jcmVhdGVGcmFnbWVudCggZnJhZ21lbnRPcHRpb25zICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRzZWN0aW9uLmxlbmd0aCA9IGxlbmd0aDtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiB1cGRhdGVMaXN0T2JqZWN0U2VjdGlvbiggc2VjdGlvbiwgdmFsdWUsIGZyYWdtZW50T3B0aW9ucyApIHtcblx0XHRcdHZhciBpZCwgaSwgaGFzS2V5LCBmcmFnbWVudDtcblx0XHRcdGhhc0tleSA9IHNlY3Rpb24uaGFzS2V5IHx8ICggc2VjdGlvbi5oYXNLZXkgPSB7fSApO1xuXHRcdFx0aSA9IHNlY3Rpb24uZnJhZ21lbnRzLmxlbmd0aDtcblx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRmcmFnbWVudCA9IHNlY3Rpb24uZnJhZ21lbnRzWyBpIF07XG5cdFx0XHRcdGlmICggISggZnJhZ21lbnQuaW5kZXggaW4gdmFsdWUgKSApIHtcblx0XHRcdFx0XHRzZWN0aW9uLmZyYWdtZW50c1sgaSBdLnRlYXJkb3duKCB0cnVlICk7XG5cdFx0XHRcdFx0c2VjdGlvbi5mcmFnbWVudHMuc3BsaWNlKCBpLCAxICk7XG5cdFx0XHRcdFx0aGFzS2V5WyBmcmFnbWVudC5pbmRleCBdID0gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGZvciAoIGlkIGluIHZhbHVlICkge1xuXHRcdFx0XHRpZiAoICFoYXNLZXlbIGlkIF0gKSB7XG5cdFx0XHRcdFx0ZnJhZ21lbnRPcHRpb25zLmNvbnRleHQgPSBzZWN0aW9uLmtleXBhdGggKyAnLicgKyBpZDtcblx0XHRcdFx0XHRmcmFnbWVudE9wdGlvbnMuaW5kZXggPSBpZDtcblx0XHRcdFx0XHRpZiAoIHNlY3Rpb24uZGVzY3JpcHRvci5pICkge1xuXHRcdFx0XHRcdFx0ZnJhZ21lbnRPcHRpb25zLmluZGV4UmVmID0gc2VjdGlvbi5kZXNjcmlwdG9yLmk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHNlY3Rpb24uZnJhZ21lbnRzLnB1c2goIHNlY3Rpb24uY3JlYXRlRnJhZ21lbnQoIGZyYWdtZW50T3B0aW9ucyApICk7XG5cdFx0XHRcdFx0aGFzS2V5WyBpZCBdID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0c2VjdGlvbi5sZW5ndGggPSBzZWN0aW9uLmZyYWdtZW50cy5sZW5ndGg7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gdXBkYXRlQ29udGV4dFNlY3Rpb24oIHNlY3Rpb24sIGZyYWdtZW50T3B0aW9ucyApIHtcblx0XHRcdGlmICggIXNlY3Rpb24ubGVuZ3RoICkge1xuXHRcdFx0XHRmcmFnbWVudE9wdGlvbnMuY29udGV4dCA9IHNlY3Rpb24ua2V5cGF0aDtcblx0XHRcdFx0ZnJhZ21lbnRPcHRpb25zLmluZGV4ID0gMDtcblx0XHRcdFx0c2VjdGlvbi5mcmFnbWVudHNbIDAgXSA9IHNlY3Rpb24uY3JlYXRlRnJhZ21lbnQoIGZyYWdtZW50T3B0aW9ucyApO1xuXHRcdFx0XHRzZWN0aW9uLmxlbmd0aCA9IDE7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gdXBkYXRlQ29uZGl0aW9uYWxTZWN0aW9uKCBzZWN0aW9uLCB2YWx1ZSwgaW52ZXJ0ZWQsIGZyYWdtZW50T3B0aW9ucyApIHtcblx0XHRcdHZhciBkb1JlbmRlciwgZW1wdHlBcnJheSwgZnJhZ21lbnRzVG9SZW1vdmUsIGZyYWdtZW50O1xuXHRcdFx0ZW1wdHlBcnJheSA9IGlzQXJyYXkoIHZhbHVlICkgJiYgdmFsdWUubGVuZ3RoID09PSAwO1xuXHRcdFx0aWYgKCBpbnZlcnRlZCApIHtcblx0XHRcdFx0ZG9SZW5kZXIgPSBlbXB0eUFycmF5IHx8ICF2YWx1ZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGRvUmVuZGVyID0gdmFsdWUgJiYgIWVtcHR5QXJyYXk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGRvUmVuZGVyICkge1xuXHRcdFx0XHRpZiAoICFzZWN0aW9uLmxlbmd0aCApIHtcblx0XHRcdFx0XHRmcmFnbWVudE9wdGlvbnMuaW5kZXggPSAwO1xuXHRcdFx0XHRcdHNlY3Rpb24uZnJhZ21lbnRzWyAwIF0gPSBzZWN0aW9uLmNyZWF0ZUZyYWdtZW50KCBmcmFnbWVudE9wdGlvbnMgKTtcblx0XHRcdFx0XHRzZWN0aW9uLmxlbmd0aCA9IDE7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBzZWN0aW9uLmxlbmd0aCA+IDEgKSB7XG5cdFx0XHRcdFx0ZnJhZ21lbnRzVG9SZW1vdmUgPSBzZWN0aW9uLmZyYWdtZW50cy5zcGxpY2UoIDEgKTtcblx0XHRcdFx0XHR3aGlsZSAoIGZyYWdtZW50ID0gZnJhZ21lbnRzVG9SZW1vdmUucG9wKCkgKSB7XG5cdFx0XHRcdFx0XHRmcmFnbWVudC50ZWFyZG93biggdHJ1ZSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmICggc2VjdGlvbi5sZW5ndGggKSB7XG5cdFx0XHRcdHNlY3Rpb24udGVhcmRvd25GcmFnbWVudHMoIHRydWUgKTtcblx0XHRcdFx0c2VjdGlvbi5sZW5ndGggPSAwO1xuXHRcdFx0fVxuXHRcdH1cblx0fSggdXRpbHNfaXNBcnJheSwgdXRpbHNfaXNPYmplY3QgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X1NlY3Rpb25fcHJvdG90eXBlX3JlbmRlciA9IGZ1bmN0aW9uKCBpc0NsaWVudCwgdXBkYXRlU2VjdGlvbiApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiBEb21TZWN0aW9uX3Byb3RvdHlwZV9yZW5kZXIoIHZhbHVlICkge1xuXHRcdFx0dmFyIG5leHROb2RlLCB3cmFwcGVkO1xuXHRcdFx0aWYgKCB3cmFwcGVkID0gdGhpcy5yb290Ll93cmFwcGVkWyB0aGlzLmtleXBhdGggXSApIHtcblx0XHRcdFx0dmFsdWUgPSB3cmFwcGVkLmdldCgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aGlzLnJlbmRlcmluZyApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5yZW5kZXJpbmcgPSB0cnVlO1xuXHRcdFx0dXBkYXRlU2VjdGlvbiggdGhpcywgdmFsdWUgKTtcblx0XHRcdHRoaXMucmVuZGVyaW5nID0gZmFsc2U7XG5cdFx0XHRpZiAoIHRoaXMuZG9jRnJhZyAmJiAhdGhpcy5kb2NGcmFnLmNoaWxkTm9kZXMubGVuZ3RoICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoICF0aGlzLmluaXRpYWxpc2luZyAmJiBpc0NsaWVudCApIHtcblx0XHRcdFx0bmV4dE5vZGUgPSB0aGlzLnBhcmVudEZyYWdtZW50LmZpbmROZXh0Tm9kZSggdGhpcyApO1xuXHRcdFx0XHRpZiAoIG5leHROb2RlICYmIG5leHROb2RlLnBhcmVudE5vZGUgPT09IHRoaXMucGFyZW50RnJhZ21lbnQucE5vZGUgKSB7XG5cdFx0XHRcdFx0dGhpcy5wYXJlbnRGcmFnbWVudC5wTm9kZS5pbnNlcnRCZWZvcmUoIHRoaXMuZG9jRnJhZywgbmV4dE5vZGUgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLnBhcmVudEZyYWdtZW50LnBOb2RlLmFwcGVuZENoaWxkKCB0aGlzLmRvY0ZyYWcgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdH0oIGNvbmZpZ19pc0NsaWVudCwgcmVuZGVyX3NoYXJlZF91cGRhdGVTZWN0aW9uICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9TZWN0aW9uX3JlYXNzaWduRnJhZ21lbnRzID0gZnVuY3Rpb24oIHJlYXNzaWduRnJhZ21lbnQgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHNlY3Rpb24sIHN0YXJ0LCBlbmQsIGJ5ICkge1xuXHRcdFx0aWYgKCBzdGFydCArIGJ5ID09PSBlbmQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggc3RhcnQgPT09IGVuZCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dmFyIGksIGZyYWdtZW50LCBpbmRleFJlZiwgb2xkSW5kZXgsIG5ld0luZGV4LCBvbGRLZXlwYXRoLCBuZXdLZXlwYXRoO1xuXHRcdFx0aW5kZXhSZWYgPSBzZWN0aW9uLmRlc2NyaXB0b3IuaTtcblx0XHRcdGZvciAoIGkgPSBzdGFydDsgaSA8IGVuZDsgaSArPSAxICkge1xuXHRcdFx0XHRmcmFnbWVudCA9IHNlY3Rpb24uZnJhZ21lbnRzWyBpIF07XG5cdFx0XHRcdG9sZEluZGV4ID0gaSAtIGJ5O1xuXHRcdFx0XHRuZXdJbmRleCA9IGk7XG5cdFx0XHRcdG9sZEtleXBhdGggPSBzZWN0aW9uLmtleXBhdGggKyAnLicgKyAoIGkgLSBieSApO1xuXHRcdFx0XHRuZXdLZXlwYXRoID0gc2VjdGlvbi5rZXlwYXRoICsgJy4nICsgaTtcblx0XHRcdFx0ZnJhZ21lbnQuaW5kZXggKz0gYnk7XG5cdFx0XHRcdHJlYXNzaWduRnJhZ21lbnQoIGZyYWdtZW50LCBpbmRleFJlZiwgbmV3SW5kZXgsIG9sZEtleXBhdGgsIG5ld0tleXBhdGggKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9KCByZW5kZXJfRG9tRnJhZ21lbnRfU2VjdGlvbl9yZWFzc2lnbkZyYWdtZW50ICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9TZWN0aW9uX3Byb3RvdHlwZV9zcGxpY2UgPSBmdW5jdGlvbiggcmVhc3NpZ25GcmFnbWVudHMgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHNwbGljZVN1bW1hcnkgKSB7XG5cdFx0XHR2YXIgc2VjdGlvbiA9IHRoaXMsXG5cdFx0XHRcdGluc2VydGlvblBvaW50LCBiYWxhbmNlLCBpLCBzdGFydCwgZW5kLCBpbnNlcnRTdGFydCwgaW5zZXJ0RW5kLCBzcGxpY2VBcmdzLCBmcmFnbWVudE9wdGlvbnM7XG5cdFx0XHRiYWxhbmNlID0gc3BsaWNlU3VtbWFyeS5iYWxhbmNlO1xuXHRcdFx0aWYgKCAhYmFsYW5jZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0c2VjdGlvbi5yZW5kZXJpbmcgPSB0cnVlO1xuXHRcdFx0c3RhcnQgPSBzcGxpY2VTdW1tYXJ5LnN0YXJ0O1xuXHRcdFx0aWYgKCBiYWxhbmNlIDwgMCApIHtcblx0XHRcdFx0ZW5kID0gc3RhcnQgLSBiYWxhbmNlO1xuXHRcdFx0XHRmb3IgKCBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkgKz0gMSApIHtcblx0XHRcdFx0XHRzZWN0aW9uLmZyYWdtZW50c1sgaSBdLnRlYXJkb3duKCB0cnVlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0c2VjdGlvbi5mcmFnbWVudHMuc3BsaWNlKCBzdGFydCwgLWJhbGFuY2UgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGZyYWdtZW50T3B0aW9ucyA9IHtcblx0XHRcdFx0XHRkZXNjcmlwdG9yOiBzZWN0aW9uLmRlc2NyaXB0b3IuZixcblx0XHRcdFx0XHRyb290OiBzZWN0aW9uLnJvb3QsXG5cdFx0XHRcdFx0cE5vZGU6IHNlY3Rpb24ucGFyZW50RnJhZ21lbnQucE5vZGUsXG5cdFx0XHRcdFx0b3duZXI6IHNlY3Rpb25cblx0XHRcdFx0fTtcblx0XHRcdFx0aWYgKCBzZWN0aW9uLmRlc2NyaXB0b3IuaSApIHtcblx0XHRcdFx0XHRmcmFnbWVudE9wdGlvbnMuaW5kZXhSZWYgPSBzZWN0aW9uLmRlc2NyaXB0b3IuaTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpbnNlcnRTdGFydCA9IHN0YXJ0ICsgc3BsaWNlU3VtbWFyeS5yZW1vdmVkO1xuXHRcdFx0XHRpbnNlcnRFbmQgPSBzdGFydCArIHNwbGljZVN1bW1hcnkuYWRkZWQ7XG5cdFx0XHRcdGluc2VydGlvblBvaW50ID0gc2VjdGlvbi5mcmFnbWVudHNbIGluc2VydFN0YXJ0IF0gPyBzZWN0aW9uLmZyYWdtZW50c1sgaW5zZXJ0U3RhcnQgXS5maXJzdE5vZGUoKSA6IHNlY3Rpb24ucGFyZW50RnJhZ21lbnQuZmluZE5leHROb2RlKCBzZWN0aW9uICk7XG5cdFx0XHRcdHNwbGljZUFyZ3MgPSBbXG5cdFx0XHRcdFx0aW5zZXJ0U3RhcnQsXG5cdFx0XHRcdFx0MFxuXHRcdFx0XHRdLmNvbmNhdCggbmV3IEFycmF5KCBiYWxhbmNlICkgKTtcblx0XHRcdFx0c2VjdGlvbi5mcmFnbWVudHMuc3BsaWNlLmFwcGx5KCBzZWN0aW9uLmZyYWdtZW50cywgc3BsaWNlQXJncyApO1xuXHRcdFx0XHRmb3IgKCBpID0gaW5zZXJ0U3RhcnQ7IGkgPCBpbnNlcnRFbmQ7IGkgKz0gMSApIHtcblx0XHRcdFx0XHRmcmFnbWVudE9wdGlvbnMuY29udGV4dCA9IHNlY3Rpb24ua2V5cGF0aCArICcuJyArIGk7XG5cdFx0XHRcdFx0ZnJhZ21lbnRPcHRpb25zLmluZGV4ID0gaTtcblx0XHRcdFx0XHRzZWN0aW9uLmZyYWdtZW50c1sgaSBdID0gc2VjdGlvbi5jcmVhdGVGcmFnbWVudCggZnJhZ21lbnRPcHRpb25zICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0c2VjdGlvbi5wYXJlbnRGcmFnbWVudC5wTm9kZS5pbnNlcnRCZWZvcmUoIHNlY3Rpb24uZG9jRnJhZywgaW5zZXJ0aW9uUG9pbnQgKTtcblx0XHRcdH1cblx0XHRcdHNlY3Rpb24ubGVuZ3RoICs9IGJhbGFuY2U7XG5cdFx0XHRyZWFzc2lnbkZyYWdtZW50cyggc2VjdGlvbiwgc3RhcnQsIHNlY3Rpb24ubGVuZ3RoLCBiYWxhbmNlICk7XG5cdFx0XHRzZWN0aW9uLnJlbmRlcmluZyA9IGZhbHNlO1xuXHRcdH07XG5cdH0oIHJlbmRlcl9Eb21GcmFnbWVudF9TZWN0aW9uX3JlYXNzaWduRnJhZ21lbnRzICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9TZWN0aW9uX19TZWN0aW9uID0gZnVuY3Rpb24oIHR5cGVzLCBpbml0TXVzdGFjaGUsIHVwZGF0ZU11c3RhY2hlLCByZXNvbHZlTXVzdGFjaGUsIG1lcmdlLCByZW5kZXIsIHNwbGljZSwgdGVhcmRvd24sIGNpcmN1bGFyICkge1xuXG5cdFx0dmFyIERvbVNlY3Rpb24sIERvbUZyYWdtZW50O1xuXHRcdGNpcmN1bGFyLnB1c2goIGZ1bmN0aW9uKCkge1xuXHRcdFx0RG9tRnJhZ21lbnQgPSBjaXJjdWxhci5Eb21GcmFnbWVudDtcblx0XHR9ICk7XG5cdFx0RG9tU2VjdGlvbiA9IGZ1bmN0aW9uKCBvcHRpb25zLCBkb2NGcmFnICkge1xuXHRcdFx0dGhpcy50eXBlID0gdHlwZXMuU0VDVElPTjtcblx0XHRcdHRoaXMuaW52ZXJ0ZWQgPSAhISBvcHRpb25zLmRlc2NyaXB0b3Iubjtcblx0XHRcdHRoaXMuZnJhZ21lbnRzID0gW107XG5cdFx0XHR0aGlzLmxlbmd0aCA9IDA7XG5cdFx0XHRpZiAoIGRvY0ZyYWcgKSB7XG5cdFx0XHRcdHRoaXMuZG9jRnJhZyA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuaW5pdGlhbGlzaW5nID0gdHJ1ZTtcblx0XHRcdGluaXRNdXN0YWNoZSggdGhpcywgb3B0aW9ucyApO1xuXHRcdFx0aWYgKCBkb2NGcmFnICkge1xuXHRcdFx0XHRkb2NGcmFnLmFwcGVuZENoaWxkKCB0aGlzLmRvY0ZyYWcgKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuaW5pdGlhbGlzaW5nID0gZmFsc2U7XG5cdFx0fTtcblx0XHREb21TZWN0aW9uLnByb3RvdHlwZSA9IHtcblx0XHRcdHVwZGF0ZTogdXBkYXRlTXVzdGFjaGUsXG5cdFx0XHRyZXNvbHZlOiByZXNvbHZlTXVzdGFjaGUsXG5cdFx0XHRzcGxpY2U6IHNwbGljZSxcblx0XHRcdG1lcmdlOiBtZXJnZSxcblx0XHRcdGRldGFjaDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBpLCBsZW47XG5cdFx0XHRcdGlmICggdGhpcy5kb2NGcmFnICkge1xuXHRcdFx0XHRcdGxlbiA9IHRoaXMuZnJhZ21lbnRzLmxlbmd0aDtcblx0XHRcdFx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRcdFx0dGhpcy5kb2NGcmFnLmFwcGVuZENoaWxkKCB0aGlzLmZyYWdtZW50c1sgaSBdLmRldGFjaCgpICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB0aGlzLmRvY0ZyYWc7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oIGRlc3Ryb3kgKSB7XG5cdFx0XHRcdHRoaXMudGVhcmRvd25GcmFnbWVudHMoIGRlc3Ryb3kgKTtcblx0XHRcdFx0dGVhcmRvd24oIHRoaXMgKTtcblx0XHRcdH0sXG5cdFx0XHRmaXJzdE5vZGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZiAoIHRoaXMuZnJhZ21lbnRzWyAwIF0gKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuZnJhZ21lbnRzWyAwIF0uZmlyc3ROb2RlKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRoaXMucGFyZW50RnJhZ21lbnQuZmluZE5leHROb2RlKCB0aGlzICk7XG5cdFx0XHR9LFxuXHRcdFx0ZmluZE5leHROb2RlOiBmdW5jdGlvbiggZnJhZ21lbnQgKSB7XG5cdFx0XHRcdGlmICggdGhpcy5mcmFnbWVudHNbIGZyYWdtZW50LmluZGV4ICsgMSBdICkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmZyYWdtZW50c1sgZnJhZ21lbnQuaW5kZXggKyAxIF0uZmlyc3ROb2RlKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRoaXMucGFyZW50RnJhZ21lbnQuZmluZE5leHROb2RlKCB0aGlzICk7XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd25GcmFnbWVudHM6IGZ1bmN0aW9uKCBkZXN0cm95ICkge1xuXHRcdFx0XHR2YXIgZnJhZ21lbnQ7XG5cdFx0XHRcdHdoaWxlICggZnJhZ21lbnQgPSB0aGlzLmZyYWdtZW50cy5zaGlmdCgpICkge1xuXHRcdFx0XHRcdGZyYWdtZW50LnRlYXJkb3duKCBkZXN0cm95ICk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRyZW5kZXI6IHJlbmRlcixcblx0XHRcdGNyZWF0ZUZyYWdtZW50OiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFx0dmFyIGZyYWdtZW50ID0gbmV3IERvbUZyYWdtZW50KCBvcHRpb25zICk7XG5cdFx0XHRcdGlmICggdGhpcy5kb2NGcmFnICkge1xuXHRcdFx0XHRcdHRoaXMuZG9jRnJhZy5hcHBlbmRDaGlsZCggZnJhZ21lbnQuZG9jRnJhZyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBmcmFnbWVudDtcblx0XHRcdH0sXG5cdFx0XHR0b1N0cmluZzogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBzdHIsIGksIGxlbjtcblx0XHRcdFx0c3RyID0gJyc7XG5cdFx0XHRcdGkgPSAwO1xuXHRcdFx0XHRsZW4gPSB0aGlzLmxlbmd0aDtcblx0XHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0XHRzdHIgKz0gdGhpcy5mcmFnbWVudHNbIGkgXS50b1N0cmluZygpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBzdHI7XG5cdFx0XHR9LFxuXHRcdFx0ZmluZDogZnVuY3Rpb24oIHNlbGVjdG9yICkge1xuXHRcdFx0XHR2YXIgaSwgbGVuLCBxdWVyeVJlc3VsdDtcblx0XHRcdFx0bGVuID0gdGhpcy5mcmFnbWVudHMubGVuZ3RoO1xuXHRcdFx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRcdGlmICggcXVlcnlSZXN1bHQgPSB0aGlzLmZyYWdtZW50c1sgaSBdLmZpbmQoIHNlbGVjdG9yICkgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcXVlcnlSZXN1bHQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fSxcblx0XHRcdGZpbmRBbGw6IGZ1bmN0aW9uKCBzZWxlY3RvciwgcXVlcnkgKSB7XG5cdFx0XHRcdHZhciBpLCBsZW47XG5cdFx0XHRcdGxlbiA9IHRoaXMuZnJhZ21lbnRzLmxlbmd0aDtcblx0XHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0XHR0aGlzLmZyYWdtZW50c1sgaSBdLmZpbmRBbGwoIHNlbGVjdG9yLCBxdWVyeSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0ZmluZENvbXBvbmVudDogZnVuY3Rpb24oIHNlbGVjdG9yICkge1xuXHRcdFx0XHR2YXIgaSwgbGVuLCBxdWVyeVJlc3VsdDtcblx0XHRcdFx0bGVuID0gdGhpcy5mcmFnbWVudHMubGVuZ3RoO1xuXHRcdFx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRcdGlmICggcXVlcnlSZXN1bHQgPSB0aGlzLmZyYWdtZW50c1sgaSBdLmZpbmRDb21wb25lbnQoIHNlbGVjdG9yICkgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcXVlcnlSZXN1bHQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fSxcblx0XHRcdGZpbmRBbGxDb21wb25lbnRzOiBmdW5jdGlvbiggc2VsZWN0b3IsIHF1ZXJ5ICkge1xuXHRcdFx0XHR2YXIgaSwgbGVuO1xuXHRcdFx0XHRsZW4gPSB0aGlzLmZyYWdtZW50cy5sZW5ndGg7XG5cdFx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0dGhpcy5mcmFnbWVudHNbIGkgXS5maW5kQWxsQ29tcG9uZW50cyggc2VsZWN0b3IsIHF1ZXJ5ICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBEb21TZWN0aW9uO1xuXHR9KCBjb25maWdfdHlwZXMsIHJlbmRlcl9zaGFyZWRfaW5pdE11c3RhY2hlLCByZW5kZXJfc2hhcmVkX3VwZGF0ZU11c3RhY2hlLCByZW5kZXJfc2hhcmVkX3Jlc29sdmVNdXN0YWNoZSwgcmVuZGVyX0RvbUZyYWdtZW50X1NlY3Rpb25fcHJvdG90eXBlX21lcmdlLCByZW5kZXJfRG9tRnJhZ21lbnRfU2VjdGlvbl9wcm90b3R5cGVfcmVuZGVyLCByZW5kZXJfRG9tRnJhZ21lbnRfU2VjdGlvbl9wcm90b3R5cGVfc3BsaWNlLCBzaGFyZWRfdGVhcmRvd24sIGNpcmN1bGFyICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9UcmlwbGUgPSBmdW5jdGlvbiggdHlwZXMsIG1hdGNoZXMsIGluaXRNdXN0YWNoZSwgdXBkYXRlTXVzdGFjaGUsIHJlc29sdmVNdXN0YWNoZSwgaW5zZXJ0SHRtbCwgdGVhcmRvd24gKSB7XG5cblx0XHR2YXIgRG9tVHJpcGxlID0gZnVuY3Rpb24oIG9wdGlvbnMsIGRvY0ZyYWcgKSB7XG5cdFx0XHR0aGlzLnR5cGUgPSB0eXBlcy5UUklQTEU7XG5cdFx0XHRpZiAoIGRvY0ZyYWcgKSB7XG5cdFx0XHRcdHRoaXMubm9kZXMgPSBbXTtcblx0XHRcdFx0dGhpcy5kb2NGcmFnID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5pbml0aWFsaXNpbmcgPSB0cnVlO1xuXHRcdFx0aW5pdE11c3RhY2hlKCB0aGlzLCBvcHRpb25zICk7XG5cdFx0XHRpZiAoIGRvY0ZyYWcgKSB7XG5cdFx0XHRcdGRvY0ZyYWcuYXBwZW5kQ2hpbGQoIHRoaXMuZG9jRnJhZyApO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5pbml0aWFsaXNpbmcgPSBmYWxzZTtcblx0XHR9O1xuXHRcdERvbVRyaXBsZS5wcm90b3R5cGUgPSB7XG5cdFx0XHR1cGRhdGU6IHVwZGF0ZU11c3RhY2hlLFxuXHRcdFx0cmVzb2x2ZTogcmVzb2x2ZU11c3RhY2hlLFxuXHRcdFx0ZGV0YWNoOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIGxlbiwgaTtcblx0XHRcdFx0aWYgKCB0aGlzLmRvY0ZyYWcgKSB7XG5cdFx0XHRcdFx0bGVuID0gdGhpcy5ub2Rlcy5sZW5ndGg7XG5cdFx0XHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0XHRcdHRoaXMuZG9jRnJhZy5hcHBlbmRDaGlsZCggdGhpcy5ub2Rlc1sgaSBdICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB0aGlzLmRvY0ZyYWc7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oIGRlc3Ryb3kgKSB7XG5cdFx0XHRcdGlmICggZGVzdHJveSApIHtcblx0XHRcdFx0XHR0aGlzLmRldGFjaCgpO1xuXHRcdFx0XHRcdHRoaXMuZG9jRnJhZyA9IHRoaXMubm9kZXMgPSBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRlYXJkb3duKCB0aGlzICk7XG5cdFx0XHR9LFxuXHRcdFx0Zmlyc3ROb2RlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0aWYgKCB0aGlzLm5vZGVzWyAwIF0gKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMubm9kZXNbIDAgXTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdGhpcy5wYXJlbnRGcmFnbWVudC5maW5kTmV4dE5vZGUoIHRoaXMgKTtcblx0XHRcdH0sXG5cdFx0XHRyZW5kZXI6IGZ1bmN0aW9uKCBodG1sICkge1xuXHRcdFx0XHR2YXIgbm9kZSwgcE5vZGU7XG5cdFx0XHRcdGlmICggIXRoaXMubm9kZXMgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHdoaWxlICggdGhpcy5ub2Rlcy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0bm9kZSA9IHRoaXMubm9kZXMucG9wKCk7XG5cdFx0XHRcdFx0bm9kZS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKCBub2RlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCAhaHRtbCApIHtcblx0XHRcdFx0XHR0aGlzLm5vZGVzID0gW107XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHBOb2RlID0gdGhpcy5wYXJlbnRGcmFnbWVudC5wTm9kZTtcblx0XHRcdFx0dGhpcy5ub2RlcyA9IGluc2VydEh0bWwoIGh0bWwsIHBOb2RlLnRhZ05hbWUsIHRoaXMuZG9jRnJhZyApO1xuXHRcdFx0XHRpZiAoICF0aGlzLmluaXRpYWxpc2luZyApIHtcblx0XHRcdFx0XHRwTm9kZS5pbnNlcnRCZWZvcmUoIHRoaXMuZG9jRnJhZywgdGhpcy5wYXJlbnRGcmFnbWVudC5maW5kTmV4dE5vZGUoIHRoaXMgKSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggcE5vZGUudGFnTmFtZSA9PT0gJ1NFTEVDVCcgJiYgcE5vZGUuX3JhY3RpdmUgJiYgcE5vZGUuX3JhY3RpdmUuYmluZGluZyApIHtcblx0XHRcdFx0XHRwTm9kZS5fcmFjdGl2ZS5iaW5kaW5nLnVwZGF0ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0dG9TdHJpbmc6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy52YWx1ZSAhPSB1bmRlZmluZWQgPyB0aGlzLnZhbHVlIDogJyc7XG5cdFx0XHR9LFxuXHRcdFx0ZmluZDogZnVuY3Rpb24oIHNlbGVjdG9yICkge1xuXHRcdFx0XHR2YXIgaSwgbGVuLCBub2RlLCBxdWVyeVJlc3VsdDtcblx0XHRcdFx0bGVuID0gdGhpcy5ub2Rlcy5sZW5ndGg7XG5cdFx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0bm9kZSA9IHRoaXMubm9kZXNbIGkgXTtcblx0XHRcdFx0XHRpZiAoIG5vZGUubm9kZVR5cGUgIT09IDEgKSB7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCBtYXRjaGVzKCBub2RlLCBzZWxlY3RvciApICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIG5vZGU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICggcXVlcnlSZXN1bHQgPSBub2RlLnF1ZXJ5U2VsZWN0b3IoIHNlbGVjdG9yICkgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcXVlcnlSZXN1bHQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fSxcblx0XHRcdGZpbmRBbGw6IGZ1bmN0aW9uKCBzZWxlY3RvciwgcXVlcnlSZXN1bHQgKSB7XG5cdFx0XHRcdHZhciBpLCBsZW4sIG5vZGUsIHF1ZXJ5QWxsUmVzdWx0LCBudW1Ob2Rlcywgajtcblx0XHRcdFx0bGVuID0gdGhpcy5ub2Rlcy5sZW5ndGg7XG5cdFx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0bm9kZSA9IHRoaXMubm9kZXNbIGkgXTtcblx0XHRcdFx0XHRpZiAoIG5vZGUubm9kZVR5cGUgIT09IDEgKSB7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCBtYXRjaGVzKCBub2RlLCBzZWxlY3RvciApICkge1xuXHRcdFx0XHRcdFx0cXVlcnlSZXN1bHQucHVzaCggbm9kZSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIHF1ZXJ5QWxsUmVzdWx0ID0gbm9kZS5xdWVyeVNlbGVjdG9yQWxsKCBzZWxlY3RvciApICkge1xuXHRcdFx0XHRcdFx0bnVtTm9kZXMgPSBxdWVyeUFsbFJlc3VsdC5sZW5ndGg7XG5cdFx0XHRcdFx0XHRmb3IgKCBqID0gMDsgaiA8IG51bU5vZGVzOyBqICs9IDEgKSB7XG5cdFx0XHRcdFx0XHRcdHF1ZXJ5UmVzdWx0LnB1c2goIHF1ZXJ5QWxsUmVzdWx0WyBqIF0gKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBEb21UcmlwbGU7XG5cdH0oIGNvbmZpZ190eXBlcywgdXRpbHNfbWF0Y2hlcywgcmVuZGVyX3NoYXJlZF9pbml0TXVzdGFjaGUsIHJlbmRlcl9zaGFyZWRfdXBkYXRlTXVzdGFjaGUsIHJlbmRlcl9zaGFyZWRfcmVzb2x2ZU11c3RhY2hlLCByZW5kZXJfRG9tRnJhZ21lbnRfc2hhcmVkX2luc2VydEh0bWwsIHNoYXJlZF90ZWFyZG93biApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9pbml0aWFsaXNlX2dldEVsZW1lbnROYW1lc3BhY2UgPSBmdW5jdGlvbiggbmFtZXNwYWNlcyApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggZGVzY3JpcHRvciwgcGFyZW50Tm9kZSApIHtcblx0XHRcdGlmICggZGVzY3JpcHRvci5hICYmIGRlc2NyaXB0b3IuYS54bWxucyApIHtcblx0XHRcdFx0cmV0dXJuIGRlc2NyaXB0b3IuYS54bWxucztcblx0XHRcdH1cblx0XHRcdHJldHVybiBkZXNjcmlwdG9yLmUgPT09ICdzdmcnID8gbmFtZXNwYWNlcy5zdmcgOiBwYXJlbnROb2RlLm5hbWVzcGFjZVVSSSB8fCBuYW1lc3BhY2VzLmh0bWw7XG5cdFx0fTtcblx0fSggY29uZmlnX25hbWVzcGFjZXMgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X3NoYXJlZF9lbmZvcmNlQ2FzZSA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0dmFyIHN2Z0NhbWVsQ2FzZUVsZW1lbnRzLCBzdmdDYW1lbENhc2VBdHRyaWJ1dGVzLCBjcmVhdGVNYXAsIG1hcDtcblx0XHRzdmdDYW1lbENhc2VFbGVtZW50cyA9ICdhbHRHbHlwaCBhbHRHbHlwaERlZiBhbHRHbHlwaEl0ZW0gYW5pbWF0ZUNvbG9yIGFuaW1hdGVNb3Rpb24gYW5pbWF0ZVRyYW5zZm9ybSBjbGlwUGF0aCBmZUJsZW5kIGZlQ29sb3JNYXRyaXggZmVDb21wb25lbnRUcmFuc2ZlciBmZUNvbXBvc2l0ZSBmZUNvbnZvbHZlTWF0cml4IGZlRGlmZnVzZUxpZ2h0aW5nIGZlRGlzcGxhY2VtZW50TWFwIGZlRGlzdGFudExpZ2h0IGZlRmxvb2QgZmVGdW5jQSBmZUZ1bmNCIGZlRnVuY0cgZmVGdW5jUiBmZUdhdXNzaWFuQmx1ciBmZUltYWdlIGZlTWVyZ2UgZmVNZXJnZU5vZGUgZmVNb3JwaG9sb2d5IGZlT2Zmc2V0IGZlUG9pbnRMaWdodCBmZVNwZWN1bGFyTGlnaHRpbmcgZmVTcG90TGlnaHQgZmVUaWxlIGZlVHVyYnVsZW5jZSBmb3JlaWduT2JqZWN0IGdseXBoUmVmIGxpbmVhckdyYWRpZW50IHJhZGlhbEdyYWRpZW50IHRleHRQYXRoIHZrZXJuJy5zcGxpdCggJyAnICk7XG5cdFx0c3ZnQ2FtZWxDYXNlQXR0cmlidXRlcyA9ICdhdHRyaWJ1dGVOYW1lIGF0dHJpYnV0ZVR5cGUgYmFzZUZyZXF1ZW5jeSBiYXNlUHJvZmlsZSBjYWxjTW9kZSBjbGlwUGF0aFVuaXRzIGNvbnRlbnRTY3JpcHRUeXBlIGNvbnRlbnRTdHlsZVR5cGUgZGlmZnVzZUNvbnN0YW50IGVkZ2VNb2RlIGV4dGVybmFsUmVzb3VyY2VzUmVxdWlyZWQgZmlsdGVyUmVzIGZpbHRlclVuaXRzIGdseXBoUmVmIGdyYWRpZW50VHJhbnNmb3JtIGdyYWRpZW50VW5pdHMga2VybmVsTWF0cml4IGtlcm5lbFVuaXRMZW5ndGgga2V5UG9pbnRzIGtleVNwbGluZXMga2V5VGltZXMgbGVuZ3RoQWRqdXN0IGxpbWl0aW5nQ29uZUFuZ2xlIG1hcmtlckhlaWdodCBtYXJrZXJVbml0cyBtYXJrZXJXaWR0aCBtYXNrQ29udGVudFVuaXRzIG1hc2tVbml0cyBudW1PY3RhdmVzIHBhdGhMZW5ndGggcGF0dGVybkNvbnRlbnRVbml0cyBwYXR0ZXJuVHJhbnNmb3JtIHBhdHRlcm5Vbml0cyBwb2ludHNBdFggcG9pbnRzQXRZIHBvaW50c0F0WiBwcmVzZXJ2ZUFscGhhIHByZXNlcnZlQXNwZWN0UmF0aW8gcHJpbWl0aXZlVW5pdHMgcmVmWCByZWZZIHJlcGVhdENvdW50IHJlcGVhdER1ciByZXF1aXJlZEV4dGVuc2lvbnMgcmVxdWlyZWRGZWF0dXJlcyBzcGVjdWxhckNvbnN0YW50IHNwZWN1bGFyRXhwb25lbnQgc3ByZWFkTWV0aG9kIHN0YXJ0T2Zmc2V0IHN0ZERldmlhdGlvbiBzdGl0Y2hUaWxlcyBzdXJmYWNlU2NhbGUgc3lzdGVtTGFuZ3VhZ2UgdGFibGVWYWx1ZXMgdGFyZ2V0WCB0YXJnZXRZIHRleHRMZW5ndGggdmlld0JveCB2aWV3VGFyZ2V0IHhDaGFubmVsU2VsZWN0b3IgeUNoYW5uZWxTZWxlY3RvciB6b29tQW5kUGFuJy5zcGxpdCggJyAnICk7XG5cdFx0Y3JlYXRlTWFwID0gZnVuY3Rpb24oIGl0ZW1zICkge1xuXHRcdFx0dmFyIG1hcCA9IHt9LCBpID0gaXRlbXMubGVuZ3RoO1xuXHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdG1hcFsgaXRlbXNbIGkgXS50b0xvd2VyQ2FzZSgpIF0gPSBpdGVtc1sgaSBdO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG1hcDtcblx0XHR9O1xuXHRcdG1hcCA9IGNyZWF0ZU1hcCggc3ZnQ2FtZWxDYXNlRWxlbWVudHMuY29uY2F0KCBzdmdDYW1lbENhc2VBdHRyaWJ1dGVzICkgKTtcblx0XHRyZXR1cm4gZnVuY3Rpb24oIGVsZW1lbnROYW1lICkge1xuXHRcdFx0dmFyIGxvd2VyQ2FzZUVsZW1lbnROYW1lID0gZWxlbWVudE5hbWUudG9Mb3dlckNhc2UoKTtcblx0XHRcdHJldHVybiBtYXBbIGxvd2VyQ2FzZUVsZW1lbnROYW1lIF0gfHwgbG93ZXJDYXNlRWxlbWVudE5hbWU7XG5cdFx0fTtcblx0fSgpO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfQXR0cmlidXRlX2hlbHBlcnNfZGV0ZXJtaW5lTmFtZUFuZE5hbWVzcGFjZSA9IGZ1bmN0aW9uKCBuYW1lc3BhY2VzLCBlbmZvcmNlQ2FzZSApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggYXR0cmlidXRlLCBuYW1lICkge1xuXHRcdFx0dmFyIGNvbG9uSW5kZXgsIG5hbWVzcGFjZVByZWZpeDtcblx0XHRcdGNvbG9uSW5kZXggPSBuYW1lLmluZGV4T2YoICc6JyApO1xuXHRcdFx0aWYgKCBjb2xvbkluZGV4ICE9PSAtMSApIHtcblx0XHRcdFx0bmFtZXNwYWNlUHJlZml4ID0gbmFtZS5zdWJzdHIoIDAsIGNvbG9uSW5kZXggKTtcblx0XHRcdFx0aWYgKCBuYW1lc3BhY2VQcmVmaXggIT09ICd4bWxucycgKSB7XG5cdFx0XHRcdFx0bmFtZSA9IG5hbWUuc3Vic3RyaW5nKCBjb2xvbkluZGV4ICsgMSApO1xuXHRcdFx0XHRcdGF0dHJpYnV0ZS5uYW1lID0gZW5mb3JjZUNhc2UoIG5hbWUgKTtcblx0XHRcdFx0XHRhdHRyaWJ1dGUubGNOYW1lID0gYXR0cmlidXRlLm5hbWUudG9Mb3dlckNhc2UoKTtcblx0XHRcdFx0XHRhdHRyaWJ1dGUubmFtZXNwYWNlID0gbmFtZXNwYWNlc1sgbmFtZXNwYWNlUHJlZml4LnRvTG93ZXJDYXNlKCkgXTtcblx0XHRcdFx0XHRpZiAoICFhdHRyaWJ1dGUubmFtZXNwYWNlICkge1xuXHRcdFx0XHRcdFx0dGhyb3cgJ1Vua25vd24gbmFtZXNwYWNlIChcIicgKyBuYW1lc3BhY2VQcmVmaXggKyAnXCIpJztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRhdHRyaWJ1dGUubmFtZSA9IGF0dHJpYnV0ZS5lbGVtZW50Lm5hbWVzcGFjZSAhPT0gbmFtZXNwYWNlcy5odG1sID8gZW5mb3JjZUNhc2UoIG5hbWUgKSA6IG5hbWU7XG5cdFx0XHRhdHRyaWJ1dGUubGNOYW1lID0gYXR0cmlidXRlLm5hbWUudG9Mb3dlckNhc2UoKTtcblx0XHR9O1xuXHR9KCBjb25maWdfbmFtZXNwYWNlcywgcmVuZGVyX0RvbUZyYWdtZW50X3NoYXJlZF9lbmZvcmNlQ2FzZSApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfQXR0cmlidXRlX2hlbHBlcnNfc2V0U3RhdGljQXR0cmlidXRlID0gZnVuY3Rpb24oIG5hbWVzcGFjZXMgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24gc2V0U3RhdGljQXR0cmlidXRlKCBhdHRyaWJ1dGUsIG9wdGlvbnMgKSB7XG5cdFx0XHR2YXIgbm9kZSwgdmFsdWUgPSBvcHRpb25zLnZhbHVlID09PSBudWxsID8gJycgOiBvcHRpb25zLnZhbHVlO1xuXHRcdFx0aWYgKCBub2RlID0gb3B0aW9ucy5wTm9kZSApIHtcblx0XHRcdFx0aWYgKCBhdHRyaWJ1dGUubmFtZXNwYWNlICkge1xuXHRcdFx0XHRcdG5vZGUuc2V0QXR0cmlidXRlTlMoIGF0dHJpYnV0ZS5uYW1lc3BhY2UsIG9wdGlvbnMubmFtZSwgdmFsdWUgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRpZiAoIG9wdGlvbnMubmFtZSA9PT0gJ3N0eWxlJyAmJiBub2RlLnN0eWxlLnNldEF0dHJpYnV0ZSApIHtcblx0XHRcdFx0XHRcdG5vZGUuc3R5bGUuc2V0QXR0cmlidXRlKCAnY3NzVGV4dCcsIHZhbHVlICk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmICggb3B0aW9ucy5uYW1lID09PSAnY2xhc3MnICYmICggIW5vZGUubmFtZXNwYWNlVVJJIHx8IG5vZGUubmFtZXNwYWNlVVJJID09PSBuYW1lc3BhY2VzLmh0bWwgKSApIHtcblx0XHRcdFx0XHRcdG5vZGUuY2xhc3NOYW1lID0gdmFsdWU7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdG5vZGUuc2V0QXR0cmlidXRlKCBvcHRpb25zLm5hbWUsIHZhbHVlICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggYXR0cmlidXRlLm5hbWUgPT09ICdpZCcgKSB7XG5cdFx0XHRcdFx0b3B0aW9ucy5yb290Lm5vZGVzWyBvcHRpb25zLnZhbHVlIF0gPSBub2RlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggYXR0cmlidXRlLm5hbWUgPT09ICd2YWx1ZScgKSB7XG5cdFx0XHRcdFx0bm9kZS5fcmFjdGl2ZS52YWx1ZSA9IG9wdGlvbnMudmFsdWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGF0dHJpYnV0ZS52YWx1ZSA9IG9wdGlvbnMudmFsdWU7XG5cdFx0fTtcblx0fSggY29uZmlnX25hbWVzcGFjZXMgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0F0dHJpYnV0ZV9oZWxwZXJzX2RldGVybWluZVByb3BlcnR5TmFtZSA9IGZ1bmN0aW9uKCBuYW1lc3BhY2VzICkge1xuXG5cdFx0dmFyIHByb3BlcnR5TmFtZXMgPSB7XG5cdFx0XHQnYWNjZXB0LWNoYXJzZXQnOiAnYWNjZXB0Q2hhcnNldCcsXG5cdFx0XHRhY2Nlc3NrZXk6ICdhY2Nlc3NLZXknLFxuXHRcdFx0Ymdjb2xvcjogJ2JnQ29sb3InLFxuXHRcdFx0J2NsYXNzJzogJ2NsYXNzTmFtZScsXG5cdFx0XHRjb2RlYmFzZTogJ2NvZGVCYXNlJyxcblx0XHRcdGNvbHNwYW46ICdjb2xTcGFuJyxcblx0XHRcdGNvbnRlbnRlZGl0YWJsZTogJ2NvbnRlbnRFZGl0YWJsZScsXG5cdFx0XHRkYXRldGltZTogJ2RhdGVUaW1lJyxcblx0XHRcdGRpcm5hbWU6ICdkaXJOYW1lJyxcblx0XHRcdCdmb3InOiAnaHRtbEZvcicsXG5cdFx0XHQnaHR0cC1lcXVpdic6ICdodHRwRXF1aXYnLFxuXHRcdFx0aXNtYXA6ICdpc01hcCcsXG5cdFx0XHRtYXhsZW5ndGg6ICdtYXhMZW5ndGgnLFxuXHRcdFx0bm92YWxpZGF0ZTogJ25vVmFsaWRhdGUnLFxuXHRcdFx0cHViZGF0ZTogJ3B1YkRhdGUnLFxuXHRcdFx0cmVhZG9ubHk6ICdyZWFkT25seScsXG5cdFx0XHRyb3dzcGFuOiAncm93U3BhbicsXG5cdFx0XHR0YWJpbmRleDogJ3RhYkluZGV4Jyxcblx0XHRcdHVzZW1hcDogJ3VzZU1hcCdcblx0XHR9O1xuXHRcdHJldHVybiBmdW5jdGlvbiggYXR0cmlidXRlLCBvcHRpb25zICkge1xuXHRcdFx0dmFyIHByb3BlcnR5TmFtZTtcblx0XHRcdGlmICggYXR0cmlidXRlLnBOb2RlICYmICFhdHRyaWJ1dGUubmFtZXNwYWNlICYmICggIW9wdGlvbnMucE5vZGUubmFtZXNwYWNlVVJJIHx8IG9wdGlvbnMucE5vZGUubmFtZXNwYWNlVVJJID09PSBuYW1lc3BhY2VzLmh0bWwgKSApIHtcblx0XHRcdFx0cHJvcGVydHlOYW1lID0gcHJvcGVydHlOYW1lc1sgYXR0cmlidXRlLm5hbWUgXSB8fCBhdHRyaWJ1dGUubmFtZTtcblx0XHRcdFx0aWYgKCBvcHRpb25zLnBOb2RlWyBwcm9wZXJ0eU5hbWUgXSAhPT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRcdGF0dHJpYnV0ZS5wcm9wZXJ0eU5hbWUgPSBwcm9wZXJ0eU5hbWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCB0eXBlb2Ygb3B0aW9ucy5wTm9kZVsgcHJvcGVydHlOYW1lIF0gPT09ICdib29sZWFuJyB8fCBwcm9wZXJ0eU5hbWUgPT09ICd2YWx1ZScgKSB7XG5cdFx0XHRcdFx0YXR0cmlidXRlLnVzZVByb3BlcnR5ID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdH0oIGNvbmZpZ19uYW1lc3BhY2VzICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9BdHRyaWJ1dGVfaGVscGVyc19nZXRJbnRlcnBvbGF0b3IgPSBmdW5jdGlvbiggdHlwZXMgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24gZ2V0SW50ZXJwb2xhdG9yKCBhdHRyaWJ1dGUgKSB7XG5cdFx0XHR2YXIgaXRlbXMsIGl0ZW07XG5cdFx0XHRpdGVtcyA9IGF0dHJpYnV0ZS5mcmFnbWVudC5pdGVtcztcblx0XHRcdGlmICggaXRlbXMubGVuZ3RoICE9PSAxICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpdGVtID0gaXRlbXNbIDAgXTtcblx0XHRcdGlmICggaXRlbS50eXBlICE9PSB0eXBlcy5JTlRFUlBPTEFUT1IgfHwgIWl0ZW0ua2V5cGF0aCAmJiAhaXRlbS5yZWYgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHJldHVybiBpdGVtO1xuXHRcdH07XG5cdH0oIGNvbmZpZ190eXBlcyApO1xuXG5cdHZhciB1dGlsc19hcnJheUNvbnRlbnRzTWF0Y2ggPSBmdW5jdGlvbiggaXNBcnJheSApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggYSwgYiApIHtcblx0XHRcdHZhciBpO1xuXHRcdFx0aWYgKCAhaXNBcnJheSggYSApIHx8ICFpc0FycmF5KCBiICkgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmICggYS5sZW5ndGggIT09IGIubGVuZ3RoICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpID0gYS5sZW5ndGg7XG5cdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0aWYgKCBhWyBpIF0gIT09IGJbIGkgXSApIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH07XG5cdH0oIHV0aWxzX2lzQXJyYXkgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0F0dHJpYnV0ZV9wcm90b3R5cGVfYmluZCA9IGZ1bmN0aW9uKCBydW5sb29wLCB3YXJuLCBhcnJheUNvbnRlbnRzTWF0Y2gsIGdldFZhbHVlRnJvbUNoZWNrYm94ZXMsIGdldCwgc2V0ICkge1xuXG5cdFx0dmFyIHNpbmdsZU11c3RhY2hlRXJyb3IgPSAnRm9yIHR3by13YXkgYmluZGluZyB0byB3b3JrLCBhdHRyaWJ1dGUgdmFsdWUgbXVzdCBiZSBhIHNpbmdsZSBpbnRlcnBvbGF0b3IgKGUuZy4gdmFsdWU9XCJ7e2Zvb319XCIpJyxcblx0XHRcdGV4cHJlc3Npb25FcnJvciA9ICdZb3UgY2Fubm90IHNldCB1cCB0d28td2F5IGJpbmRpbmcgYWdhaW5zdCBhbiBleHByZXNzaW9uICcsXG5cdFx0XHRiaW5kQXR0cmlidXRlLCB1cGRhdGVNb2RlbCwgZ2V0T3B0aW9ucywgdXBkYXRlLCBnZXRCaW5kaW5nLCBpbmhlcml0UHJvcGVydGllcywgTXVsdGlwbGVTZWxlY3RCaW5kaW5nLCBTZWxlY3RCaW5kaW5nLCBSYWRpb05hbWVCaW5kaW5nLCBDaGVja2JveE5hbWVCaW5kaW5nLCBDaGVja2VkQmluZGluZywgRmlsZUxpc3RCaW5kaW5nLCBDb250ZW50RWRpdGFibGVCaW5kaW5nLCBHZW5lcmljQmluZGluZztcblx0XHRiaW5kQXR0cmlidXRlID0gZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbm9kZSA9IHRoaXMucE5vZGUsXG5cdFx0XHRcdGludGVycG9sYXRvciwgYmluZGluZywgYmluZGluZ3M7XG5cdFx0XHRpbnRlcnBvbGF0b3IgPSB0aGlzLmludGVycG9sYXRvcjtcblx0XHRcdGlmICggIWludGVycG9sYXRvciApIHtcblx0XHRcdFx0d2Fybiggc2luZ2xlTXVzdGFjaGVFcnJvciApO1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGludGVycG9sYXRvci5rZXlwYXRoICYmIGludGVycG9sYXRvci5rZXlwYXRoLnN1YnN0ciA9PT0gJyR7JyApIHtcblx0XHRcdFx0d2FybiggZXhwcmVzc2lvbkVycm9yICsgaW50ZXJwb2xhdG9yLmtleXBhdGggKTtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhaW50ZXJwb2xhdG9yLmtleXBhdGggKSB7XG5cdFx0XHRcdGludGVycG9sYXRvci5yZXNvbHZlKCBpbnRlcnBvbGF0b3IuZGVzY3JpcHRvci5yICk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmtleXBhdGggPSBpbnRlcnBvbGF0b3Iua2V5cGF0aDtcblx0XHRcdGJpbmRpbmcgPSBnZXRCaW5kaW5nKCB0aGlzICk7XG5cdFx0XHRpZiAoICFiaW5kaW5nICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRub2RlLl9yYWN0aXZlLmJpbmRpbmcgPSB0aGlzLmVsZW1lbnQuYmluZGluZyA9IGJpbmRpbmc7XG5cdFx0XHR0aGlzLnR3b3dheSA9IHRydWU7XG5cdFx0XHRiaW5kaW5ncyA9IHRoaXMucm9vdC5fdHdvd2F5QmluZGluZ3NbIHRoaXMua2V5cGF0aCBdIHx8ICggdGhpcy5yb290Ll90d293YXlCaW5kaW5nc1sgdGhpcy5rZXlwYXRoIF0gPSBbXSApO1xuXHRcdFx0YmluZGluZ3MucHVzaCggYmluZGluZyApO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fTtcblx0XHR1cGRhdGVNb2RlbCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0cnVubG9vcC5zdGFydCggdGhpcy5fcmFjdGl2ZS5yb290ICk7XG5cdFx0XHR0aGlzLl9yYWN0aXZlLmJpbmRpbmcudXBkYXRlKCk7XG5cdFx0XHRydW5sb29wLmVuZCgpO1xuXHRcdH07XG5cdFx0Z2V0T3B0aW9ucyA9IHtcblx0XHRcdGV2YWx1YXRlV3JhcHBlZDogdHJ1ZVxuXHRcdH07XG5cdFx0dXBkYXRlID0gZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgdmFsdWUgPSBnZXQoIHRoaXMuX3JhY3RpdmUucm9vdCwgdGhpcy5fcmFjdGl2ZS5iaW5kaW5nLmtleXBhdGgsIGdldE9wdGlvbnMgKTtcblx0XHRcdHRoaXMudmFsdWUgPSB2YWx1ZSA9PSB1bmRlZmluZWQgPyAnJyA6IHZhbHVlO1xuXHRcdH07XG5cdFx0Z2V0QmluZGluZyA9IGZ1bmN0aW9uKCBhdHRyaWJ1dGUgKSB7XG5cdFx0XHR2YXIgbm9kZSA9IGF0dHJpYnV0ZS5wTm9kZTtcblx0XHRcdGlmICggbm9kZS50YWdOYW1lID09PSAnU0VMRUNUJyApIHtcblx0XHRcdFx0cmV0dXJuIG5vZGUubXVsdGlwbGUgPyBuZXcgTXVsdGlwbGVTZWxlY3RCaW5kaW5nKCBhdHRyaWJ1dGUsIG5vZGUgKSA6IG5ldyBTZWxlY3RCaW5kaW5nKCBhdHRyaWJ1dGUsIG5vZGUgKTtcblx0XHRcdH1cblx0XHRcdGlmICggbm9kZS50eXBlID09PSAnY2hlY2tib3gnIHx8IG5vZGUudHlwZSA9PT0gJ3JhZGlvJyApIHtcblx0XHRcdFx0aWYgKCBhdHRyaWJ1dGUucHJvcGVydHlOYW1lID09PSAnbmFtZScgKSB7XG5cdFx0XHRcdFx0aWYgKCBub2RlLnR5cGUgPT09ICdjaGVja2JveCcgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbmV3IENoZWNrYm94TmFtZUJpbmRpbmcoIGF0dHJpYnV0ZSwgbm9kZSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIG5vZGUudHlwZSA9PT0gJ3JhZGlvJyApIHtcblx0XHRcdFx0XHRcdHJldHVybiBuZXcgUmFkaW9OYW1lQmluZGluZyggYXR0cmlidXRlLCBub2RlICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggYXR0cmlidXRlLnByb3BlcnR5TmFtZSA9PT0gJ2NoZWNrZWQnICkge1xuXHRcdFx0XHRcdHJldHVybiBuZXcgQ2hlY2tlZEJpbmRpbmcoIGF0dHJpYnV0ZSwgbm9kZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBhdHRyaWJ1dGUubGNOYW1lICE9PSAndmFsdWUnICkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdBdHRlbXB0ZWQgdG8gc2V0IHVwIGFuIGlsbGVnYWwgdHdvLXdheSBiaW5kaW5nLiBUaGlzIGVycm9yIGlzIHVuZXhwZWN0ZWQgLSBpZiB5b3UgY2FuLCBwbGVhc2UgZmlsZSBhbiBpc3N1ZSBhdCBodHRwczovL2dpdGh1Yi5jb20vUmFjdGl2ZUpTL1JhY3RpdmUsIG9yIGNvbnRhY3QgQFJhY3RpdmVKUyBvbiBUd2l0dGVyLiBUaGFua3MhJyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBub2RlLnR5cGUgPT09ICdmaWxlJyApIHtcblx0XHRcdFx0cmV0dXJuIG5ldyBGaWxlTGlzdEJpbmRpbmcoIGF0dHJpYnV0ZSwgbm9kZSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBub2RlLmdldEF0dHJpYnV0ZSggJ2NvbnRlbnRlZGl0YWJsZScgKSApIHtcblx0XHRcdFx0cmV0dXJuIG5ldyBDb250ZW50RWRpdGFibGVCaW5kaW5nKCBhdHRyaWJ1dGUsIG5vZGUgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBuZXcgR2VuZXJpY0JpbmRpbmcoIGF0dHJpYnV0ZSwgbm9kZSApO1xuXHRcdH07XG5cdFx0TXVsdGlwbGVTZWxlY3RCaW5kaW5nID0gZnVuY3Rpb24oIGF0dHJpYnV0ZSwgbm9kZSApIHtcblx0XHRcdHZhciB2YWx1ZUZyb21Nb2RlbDtcblx0XHRcdGluaGVyaXRQcm9wZXJ0aWVzKCB0aGlzLCBhdHRyaWJ1dGUsIG5vZGUgKTtcblx0XHRcdG5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIHVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdFx0dmFsdWVGcm9tTW9kZWwgPSBnZXQoIHRoaXMucm9vdCwgdGhpcy5rZXlwYXRoICk7XG5cdFx0XHRpZiAoIHZhbHVlRnJvbU1vZGVsID09PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlKCk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRNdWx0aXBsZVNlbGVjdEJpbmRpbmcucHJvdG90eXBlID0ge1xuXHRcdFx0dmFsdWU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgc2VsZWN0ZWRWYWx1ZXMsIG9wdGlvbnMsIGksIGxlbiwgb3B0aW9uLCBvcHRpb25WYWx1ZTtcblx0XHRcdFx0c2VsZWN0ZWRWYWx1ZXMgPSBbXTtcblx0XHRcdFx0b3B0aW9ucyA9IHRoaXMubm9kZS5vcHRpb25zO1xuXHRcdFx0XHRsZW4gPSBvcHRpb25zLmxlbmd0aDtcblx0XHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0XHRvcHRpb24gPSBvcHRpb25zWyBpIF07XG5cdFx0XHRcdFx0aWYgKCBvcHRpb24uc2VsZWN0ZWQgKSB7XG5cdFx0XHRcdFx0XHRvcHRpb25WYWx1ZSA9IG9wdGlvbi5fcmFjdGl2ZSA/IG9wdGlvbi5fcmFjdGl2ZS52YWx1ZSA6IG9wdGlvbi52YWx1ZTtcblx0XHRcdFx0XHRcdHNlbGVjdGVkVmFsdWVzLnB1c2goIG9wdGlvblZhbHVlICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBzZWxlY3RlZFZhbHVlcztcblx0XHRcdH0sXG5cdFx0XHR1cGRhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgYXR0cmlidXRlLCBwcmV2aW91c1ZhbHVlLCB2YWx1ZTtcblx0XHRcdFx0YXR0cmlidXRlID0gdGhpcy5hdHRyO1xuXHRcdFx0XHRwcmV2aW91c1ZhbHVlID0gYXR0cmlidXRlLnZhbHVlO1xuXHRcdFx0XHR2YWx1ZSA9IHRoaXMudmFsdWUoKTtcblx0XHRcdFx0aWYgKCBwcmV2aW91c1ZhbHVlID09PSB1bmRlZmluZWQgfHwgIWFycmF5Q29udGVudHNNYXRjaCggdmFsdWUsIHByZXZpb3VzVmFsdWUgKSApIHtcblx0XHRcdFx0XHRhdHRyaWJ1dGUucmVjZWl2aW5nID0gdHJ1ZTtcblx0XHRcdFx0XHRhdHRyaWJ1dGUudmFsdWUgPSB2YWx1ZTtcblx0XHRcdFx0XHRzZXQoIHRoaXMucm9vdCwgdGhpcy5rZXlwYXRoLCB2YWx1ZSApO1xuXHRcdFx0XHRcdHJ1bmxvb3AudHJpZ2dlcigpO1xuXHRcdFx0XHRcdGF0dHJpYnV0ZS5yZWNlaXZpbmcgPSBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdGhpcztcblx0XHRcdH0sXG5cdFx0XHRkZWZlclVwZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmICggdGhpcy5kZWZlcnJlZCA9PT0gdHJ1ZSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0cnVubG9vcC5hZGRBdHRyaWJ1dGUoIHRoaXMgKTtcblx0XHRcdFx0dGhpcy5kZWZlcnJlZCA9IHRydWU7XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR0aGlzLm5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIHVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0U2VsZWN0QmluZGluZyA9IGZ1bmN0aW9uKCBhdHRyaWJ1dGUsIG5vZGUgKSB7XG5cdFx0XHR2YXIgdmFsdWVGcm9tTW9kZWw7XG5cdFx0XHRpbmhlcml0UHJvcGVydGllcyggdGhpcywgYXR0cmlidXRlLCBub2RlICk7XG5cdFx0XHRub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCB1cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHRcdHZhbHVlRnJvbU1vZGVsID0gZ2V0KCB0aGlzLnJvb3QsIHRoaXMua2V5cGF0aCApO1xuXHRcdFx0aWYgKCB2YWx1ZUZyb21Nb2RlbCA9PT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZSgpO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0U2VsZWN0QmluZGluZy5wcm90b3R5cGUgPSB7XG5cdFx0XHR2YWx1ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBvcHRpb25zLCBpLCBsZW4sIG9wdGlvbiwgb3B0aW9uVmFsdWU7XG5cdFx0XHRcdG9wdGlvbnMgPSB0aGlzLm5vZGUub3B0aW9ucztcblx0XHRcdFx0bGVuID0gb3B0aW9ucy5sZW5ndGg7XG5cdFx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0b3B0aW9uID0gb3B0aW9uc1sgaSBdO1xuXHRcdFx0XHRcdGlmICggb3B0aW9uc1sgaSBdLnNlbGVjdGVkICkge1xuXHRcdFx0XHRcdFx0b3B0aW9uVmFsdWUgPSBvcHRpb24uX3JhY3RpdmUgPyBvcHRpb24uX3JhY3RpdmUudmFsdWUgOiBvcHRpb24udmFsdWU7XG5cdFx0XHRcdFx0XHRyZXR1cm4gb3B0aW9uVmFsdWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0dXBkYXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHZhbHVlID0gdGhpcy52YWx1ZSgpO1xuXHRcdFx0XHR0aGlzLmF0dHIucmVjZWl2aW5nID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy5hdHRyLnZhbHVlID0gdmFsdWU7XG5cdFx0XHRcdHNldCggdGhpcy5yb290LCB0aGlzLmtleXBhdGgsIHZhbHVlICk7XG5cdFx0XHRcdHJ1bmxvb3AudHJpZ2dlcigpO1xuXHRcdFx0XHR0aGlzLmF0dHIucmVjZWl2aW5nID0gZmFsc2U7XG5cdFx0XHRcdHJldHVybiB0aGlzO1xuXHRcdFx0fSxcblx0XHRcdGRlZmVyVXBkYXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0aWYgKCB0aGlzLmRlZmVycmVkID09PSB0cnVlICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRydW5sb29wLmFkZEF0dHJpYnV0ZSggdGhpcyApO1xuXHRcdFx0XHR0aGlzLmRlZmVycmVkID0gdHJ1ZTtcblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHRoaXMubm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgdXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRSYWRpb05hbWVCaW5kaW5nID0gZnVuY3Rpb24oIGF0dHJpYnV0ZSwgbm9kZSApIHtcblx0XHRcdHZhciB2YWx1ZUZyb21Nb2RlbDtcblx0XHRcdHRoaXMucmFkaW9OYW1lID0gdHJ1ZTtcblx0XHRcdGluaGVyaXRQcm9wZXJ0aWVzKCB0aGlzLCBhdHRyaWJ1dGUsIG5vZGUgKTtcblx0XHRcdG5vZGUubmFtZSA9ICd7eycgKyBhdHRyaWJ1dGUua2V5cGF0aCArICd9fSc7XG5cdFx0XHRub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCB1cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHRcdGlmICggbm9kZS5hdHRhY2hFdmVudCApIHtcblx0XHRcdFx0bm9kZS5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCB1cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHRcdH1cblx0XHRcdHZhbHVlRnJvbU1vZGVsID0gZ2V0KCB0aGlzLnJvb3QsIHRoaXMua2V5cGF0aCApO1xuXHRcdFx0aWYgKCB2YWx1ZUZyb21Nb2RlbCAhPT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRub2RlLmNoZWNrZWQgPSB2YWx1ZUZyb21Nb2RlbCA9PSBub2RlLl9yYWN0aXZlLnZhbHVlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cnVubG9vcC5hZGRSYWRpbyggdGhpcyApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0UmFkaW9OYW1lQmluZGluZy5wcm90b3R5cGUgPSB7XG5cdFx0XHR2YWx1ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLm5vZGUuX3JhY3RpdmUgPyB0aGlzLm5vZGUuX3JhY3RpdmUudmFsdWUgOiB0aGlzLm5vZGUudmFsdWU7XG5cdFx0XHR9LFxuXHRcdFx0dXBkYXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIG5vZGUgPSB0aGlzLm5vZGU7XG5cdFx0XHRcdGlmICggbm9kZS5jaGVja2VkICkge1xuXHRcdFx0XHRcdHRoaXMuYXR0ci5yZWNlaXZpbmcgPSB0cnVlO1xuXHRcdFx0XHRcdHNldCggdGhpcy5yb290LCB0aGlzLmtleXBhdGgsIHRoaXMudmFsdWUoKSApO1xuXHRcdFx0XHRcdHJ1bmxvb3AudHJpZ2dlcigpO1xuXHRcdFx0XHRcdHRoaXMuYXR0ci5yZWNlaXZpbmcgPSBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dGhpcy5ub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCB1cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHRcdFx0dGhpcy5ub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdjbGljaycsIHVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0Q2hlY2tib3hOYW1lQmluZGluZyA9IGZ1bmN0aW9uKCBhdHRyaWJ1dGUsIG5vZGUgKSB7XG5cdFx0XHR2YXIgdmFsdWVGcm9tTW9kZWwsIGNoZWNrZWQ7XG5cdFx0XHR0aGlzLmNoZWNrYm94TmFtZSA9IHRydWU7XG5cdFx0XHRpbmhlcml0UHJvcGVydGllcyggdGhpcywgYXR0cmlidXRlLCBub2RlICk7XG5cdFx0XHRub2RlLm5hbWUgPSAne3snICsgdGhpcy5rZXlwYXRoICsgJ319Jztcblx0XHRcdG5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIHVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdFx0aWYgKCBub2RlLmF0dGFjaEV2ZW50ICkge1xuXHRcdFx0XHRub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIHVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdFx0fVxuXHRcdFx0dmFsdWVGcm9tTW9kZWwgPSBnZXQoIHRoaXMucm9vdCwgdGhpcy5rZXlwYXRoICk7XG5cdFx0XHRpZiAoIHZhbHVlRnJvbU1vZGVsICE9PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdGNoZWNrZWQgPSB2YWx1ZUZyb21Nb2RlbC5pbmRleE9mKCBub2RlLl9yYWN0aXZlLnZhbHVlICkgIT09IC0xO1xuXHRcdFx0XHRub2RlLmNoZWNrZWQgPSBjaGVja2VkO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cnVubG9vcC5hZGRDaGVja2JveCggdGhpcyApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0Q2hlY2tib3hOYW1lQmluZGluZy5wcm90b3R5cGUgPSB7XG5cdFx0XHRjaGFuZ2VkOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMubm9kZS5jaGVja2VkICE9PSAhISB0aGlzLmNoZWNrZWQ7XG5cdFx0XHR9LFxuXHRcdFx0dXBkYXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dGhpcy5jaGVja2VkID0gdGhpcy5ub2RlLmNoZWNrZWQ7XG5cdFx0XHRcdHRoaXMuYXR0ci5yZWNlaXZpbmcgPSB0cnVlO1xuXHRcdFx0XHRzZXQoIHRoaXMucm9vdCwgdGhpcy5rZXlwYXRoLCBnZXRWYWx1ZUZyb21DaGVja2JveGVzKCB0aGlzLnJvb3QsIHRoaXMua2V5cGF0aCApICk7XG5cdFx0XHRcdHJ1bmxvb3AudHJpZ2dlcigpO1xuXHRcdFx0XHR0aGlzLmF0dHIucmVjZWl2aW5nID0gZmFsc2U7XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR0aGlzLm5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIHVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdFx0XHR0aGlzLm5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgdXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRDaGVja2VkQmluZGluZyA9IGZ1bmN0aW9uKCBhdHRyaWJ1dGUsIG5vZGUgKSB7XG5cdFx0XHRpbmhlcml0UHJvcGVydGllcyggdGhpcywgYXR0cmlidXRlLCBub2RlICk7XG5cdFx0XHRub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCB1cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHRcdGlmICggbm9kZS5hdHRhY2hFdmVudCApIHtcblx0XHRcdFx0bm9kZS5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCB1cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdENoZWNrZWRCaW5kaW5nLnByb3RvdHlwZSA9IHtcblx0XHRcdHZhbHVlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMubm9kZS5jaGVja2VkO1xuXHRcdFx0fSxcblx0XHRcdHVwZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHRoaXMuYXR0ci5yZWNlaXZpbmcgPSB0cnVlO1xuXHRcdFx0XHRzZXQoIHRoaXMucm9vdCwgdGhpcy5rZXlwYXRoLCB0aGlzLnZhbHVlKCkgKTtcblx0XHRcdFx0cnVubG9vcC50cmlnZ2VyKCk7XG5cdFx0XHRcdHRoaXMuYXR0ci5yZWNlaXZpbmcgPSBmYWxzZTtcblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHRoaXMubm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgdXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0XHRcdHRoaXMubm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2xpY2snLCB1cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdEZpbGVMaXN0QmluZGluZyA9IGZ1bmN0aW9uKCBhdHRyaWJ1dGUsIG5vZGUgKSB7XG5cdFx0XHRpbmhlcml0UHJvcGVydGllcyggdGhpcywgYXR0cmlidXRlLCBub2RlICk7XG5cdFx0XHRub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCB1cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHR9O1xuXHRcdEZpbGVMaXN0QmluZGluZy5wcm90b3R5cGUgPSB7XG5cdFx0XHR2YWx1ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmF0dHIucE5vZGUuZmlsZXM7XG5cdFx0XHR9LFxuXHRcdFx0dXBkYXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0c2V0KCB0aGlzLmF0dHIucm9vdCwgdGhpcy5hdHRyLmtleXBhdGgsIHRoaXMudmFsdWUoKSApO1xuXHRcdFx0XHRydW5sb29wLnRyaWdnZXIoKTtcblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHRoaXMubm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgdXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRDb250ZW50RWRpdGFibGVCaW5kaW5nID0gZnVuY3Rpb24oIGF0dHJpYnV0ZSwgbm9kZSApIHtcblx0XHRcdGluaGVyaXRQcm9wZXJ0aWVzKCB0aGlzLCBhdHRyaWJ1dGUsIG5vZGUgKTtcblx0XHRcdG5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIHVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdFx0aWYgKCAhdGhpcy5yb290LmxhenkgKSB7XG5cdFx0XHRcdG5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgdXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0XHRcdGlmICggbm9kZS5hdHRhY2hFdmVudCApIHtcblx0XHRcdFx0XHRub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdrZXl1cCcsIHVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRDb250ZW50RWRpdGFibGVCaW5kaW5nLnByb3RvdHlwZSA9IHtcblx0XHRcdHVwZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHRoaXMuYXR0ci5yZWNlaXZpbmcgPSB0cnVlO1xuXHRcdFx0XHRzZXQoIHRoaXMucm9vdCwgdGhpcy5rZXlwYXRoLCB0aGlzLm5vZGUuaW5uZXJIVE1MICk7XG5cdFx0XHRcdHJ1bmxvb3AudHJpZ2dlcigpO1xuXHRcdFx0XHR0aGlzLmF0dHIucmVjZWl2aW5nID0gZmFsc2U7XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR0aGlzLm5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIHVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdFx0XHR0aGlzLm5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgdXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0XHRcdHRoaXMubm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKCAna2V5dXAnLCB1cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdEdlbmVyaWNCaW5kaW5nID0gZnVuY3Rpb24oIGF0dHJpYnV0ZSwgbm9kZSApIHtcblx0XHRcdGluaGVyaXRQcm9wZXJ0aWVzKCB0aGlzLCBhdHRyaWJ1dGUsIG5vZGUgKTtcblx0XHRcdG5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIHVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdFx0aWYgKCAhdGhpcy5yb290LmxhenkgKSB7XG5cdFx0XHRcdG5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgdXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0XHRcdGlmICggbm9kZS5hdHRhY2hFdmVudCApIHtcblx0XHRcdFx0XHRub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdrZXl1cCcsIHVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR0aGlzLm5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ2JsdXInLCB1cGRhdGUsIGZhbHNlICk7XG5cdFx0fTtcblx0XHRHZW5lcmljQmluZGluZy5wcm90b3R5cGUgPSB7XG5cdFx0XHR2YWx1ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciB2YWx1ZSA9IHRoaXMuYXR0ci5wTm9kZS52YWx1ZTtcblx0XHRcdFx0aWYgKCArdmFsdWUgKyAnJyA9PT0gdmFsdWUgJiYgdmFsdWUuaW5kZXhPZiggJ2UnICkgPT09IC0xICkge1xuXHRcdFx0XHRcdHZhbHVlID0gK3ZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHRcdH0sXG5cdFx0XHR1cGRhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgYXR0cmlidXRlID0gdGhpcy5hdHRyLFxuXHRcdFx0XHRcdHZhbHVlID0gdGhpcy52YWx1ZSgpO1xuXHRcdFx0XHRhdHRyaWJ1dGUucmVjZWl2aW5nID0gdHJ1ZTtcblx0XHRcdFx0c2V0KCBhdHRyaWJ1dGUucm9vdCwgYXR0cmlidXRlLmtleXBhdGgsIHZhbHVlICk7XG5cdFx0XHRcdHJ1bmxvb3AudHJpZ2dlcigpO1xuXHRcdFx0XHRhdHRyaWJ1dGUucmVjZWl2aW5nID0gZmFsc2U7XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR0aGlzLm5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIHVwZGF0ZU1vZGVsLCBmYWxzZSApO1xuXHRcdFx0XHR0aGlzLm5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgdXBkYXRlTW9kZWwsIGZhbHNlICk7XG5cdFx0XHRcdHRoaXMubm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKCAna2V5dXAnLCB1cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHRcdFx0dGhpcy5ub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdibHVyJywgdXBkYXRlLCBmYWxzZSApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0aW5oZXJpdFByb3BlcnRpZXMgPSBmdW5jdGlvbiggYmluZGluZywgYXR0cmlidXRlLCBub2RlICkge1xuXHRcdFx0YmluZGluZy5hdHRyID0gYXR0cmlidXRlO1xuXHRcdFx0YmluZGluZy5ub2RlID0gbm9kZTtcblx0XHRcdGJpbmRpbmcucm9vdCA9IGF0dHJpYnV0ZS5yb290O1xuXHRcdFx0YmluZGluZy5rZXlwYXRoID0gYXR0cmlidXRlLmtleXBhdGg7XG5cdFx0fTtcblx0XHRyZXR1cm4gYmluZEF0dHJpYnV0ZTtcblx0fSggZ2xvYmFsX3J1bmxvb3AsIHV0aWxzX3dhcm4sIHV0aWxzX2FycmF5Q29udGVudHNNYXRjaCwgc2hhcmVkX2dldFZhbHVlRnJvbUNoZWNrYm94ZXMsIHNoYXJlZF9nZXRfX2dldCwgc2hhcmVkX3NldCApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfQXR0cmlidXRlX3Byb3RvdHlwZV91cGRhdGUgPSBmdW5jdGlvbiggcnVubG9vcCwgbmFtZXNwYWNlcywgaXNBcnJheSApIHtcblxuXHRcdHZhciB1cGRhdGVBdHRyaWJ1dGUsIHVwZGF0ZUZpbGVJbnB1dFZhbHVlLCBkZWZlclNlbGVjdCwgaW5pdFNlbGVjdCwgdXBkYXRlU2VsZWN0LCB1cGRhdGVNdWx0aXBsZVNlbGVjdCwgdXBkYXRlUmFkaW9OYW1lLCB1cGRhdGVDaGVja2JveE5hbWUsIHVwZGF0ZUlFU3R5bGVBdHRyaWJ1dGUsIHVwZGF0ZUNsYXNzTmFtZSwgdXBkYXRlQ29udGVudEVkaXRhYmxlVmFsdWUsIHVwZGF0ZUV2ZXJ5dGhpbmdFbHNlO1xuXHRcdHVwZGF0ZUF0dHJpYnV0ZSA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIG5vZGU7XG5cdFx0XHRpZiAoICF0aGlzLnJlYWR5ICkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcztcblx0XHRcdH1cblx0XHRcdG5vZGUgPSB0aGlzLnBOb2RlO1xuXHRcdFx0aWYgKCBub2RlLnRhZ05hbWUgPT09ICdTRUxFQ1QnICYmIHRoaXMubGNOYW1lID09PSAndmFsdWUnICkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZSA9IGRlZmVyU2VsZWN0O1xuXHRcdFx0XHR0aGlzLmRlZmVycmVkVXBkYXRlID0gaW5pdFNlbGVjdDtcblx0XHRcdFx0cmV0dXJuIHRoaXMudXBkYXRlKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRoaXMuaXNGaWxlSW5wdXRWYWx1ZSApIHtcblx0XHRcdFx0dGhpcy51cGRhdGUgPSB1cGRhdGVGaWxlSW5wdXRWYWx1ZTtcblx0XHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRoaXMudHdvd2F5ICYmIHRoaXMubGNOYW1lID09PSAnbmFtZScgKSB7XG5cdFx0XHRcdGlmICggbm9kZS50eXBlID09PSAncmFkaW8nICkge1xuXHRcdFx0XHRcdHRoaXMudXBkYXRlID0gdXBkYXRlUmFkaW9OYW1lO1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLnVwZGF0ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggbm9kZS50eXBlID09PSAnY2hlY2tib3gnICkge1xuXHRcdFx0XHRcdHRoaXMudXBkYXRlID0gdXBkYXRlQ2hlY2tib3hOYW1lO1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLnVwZGF0ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRoaXMubGNOYW1lID09PSAnc3R5bGUnICYmIG5vZGUuc3R5bGUuc2V0QXR0cmlidXRlICkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZSA9IHVwZGF0ZUlFU3R5bGVBdHRyaWJ1dGU7XG5cdFx0XHRcdHJldHVybiB0aGlzLnVwZGF0ZSgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aGlzLmxjTmFtZSA9PT0gJ2NsYXNzJyAmJiAoICFub2RlLm5hbWVzcGFjZVVSSSB8fCBub2RlLm5hbWVzcGFjZVVSSSA9PT0gbmFtZXNwYWNlcy5odG1sICkgKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlID0gdXBkYXRlQ2xhc3NOYW1lO1xuXHRcdFx0XHRyZXR1cm4gdGhpcy51cGRhdGUoKTtcblx0XHRcdH1cblx0XHRcdGlmICggbm9kZS5nZXRBdHRyaWJ1dGUoICdjb250ZW50ZWRpdGFibGUnICkgJiYgdGhpcy5sY05hbWUgPT09ICd2YWx1ZScgKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlID0gdXBkYXRlQ29udGVudEVkaXRhYmxlVmFsdWU7XG5cdFx0XHRcdHJldHVybiB0aGlzLnVwZGF0ZSgpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy51cGRhdGUgPSB1cGRhdGVFdmVyeXRoaW5nRWxzZTtcblx0XHRcdHJldHVybiB0aGlzLnVwZGF0ZSgpO1xuXHRcdH07XG5cdFx0dXBkYXRlRmlsZUlucHV0VmFsdWUgPSBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH07XG5cdFx0aW5pdFNlbGVjdCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5kZWZlcnJlZFVwZGF0ZSA9IHRoaXMucE5vZGUubXVsdGlwbGUgPyB1cGRhdGVNdWx0aXBsZVNlbGVjdCA6IHVwZGF0ZVNlbGVjdDtcblx0XHRcdHRoaXMuZGVmZXJyZWRVcGRhdGUoKTtcblx0XHR9O1xuXHRcdGRlZmVyU2VsZWN0ID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRydW5sb29wLmFkZFNlbGVjdFZhbHVlKCB0aGlzICk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9O1xuXHRcdHVwZGF0ZVNlbGVjdCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIHZhbHVlID0gdGhpcy5mcmFnbWVudC5nZXRWYWx1ZSgpLFxuXHRcdFx0XHRvcHRpb25zLCBvcHRpb24sIG9wdGlvblZhbHVlLCBpO1xuXHRcdFx0dGhpcy52YWx1ZSA9IHRoaXMucE5vZGUuX3JhY3RpdmUudmFsdWUgPSB2YWx1ZTtcblx0XHRcdG9wdGlvbnMgPSB0aGlzLnBOb2RlLm9wdGlvbnM7XG5cdFx0XHRpID0gb3B0aW9ucy5sZW5ndGg7XG5cdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0b3B0aW9uID0gb3B0aW9uc1sgaSBdO1xuXHRcdFx0XHRvcHRpb25WYWx1ZSA9IG9wdGlvbi5fcmFjdGl2ZSA/IG9wdGlvbi5fcmFjdGl2ZS52YWx1ZSA6IG9wdGlvbi52YWx1ZTtcblx0XHRcdFx0aWYgKCBvcHRpb25WYWx1ZSA9PSB2YWx1ZSApIHtcblx0XHRcdFx0XHRvcHRpb24uc2VsZWN0ZWQgPSB0cnVlO1xuXHRcdFx0XHRcdHJldHVybiB0aGlzO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9O1xuXHRcdHVwZGF0ZU11bHRpcGxlU2VsZWN0ID0gZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgdmFsdWUgPSB0aGlzLmZyYWdtZW50LmdldFZhbHVlKCksXG5cdFx0XHRcdG9wdGlvbnMsIGksIG9wdGlvbiwgb3B0aW9uVmFsdWU7XG5cdFx0XHRpZiAoICFpc0FycmF5KCB2YWx1ZSApICkge1xuXHRcdFx0XHR2YWx1ZSA9IFsgdmFsdWUgXTtcblx0XHRcdH1cblx0XHRcdG9wdGlvbnMgPSB0aGlzLnBOb2RlLm9wdGlvbnM7XG5cdFx0XHRpID0gb3B0aW9ucy5sZW5ndGg7XG5cdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0b3B0aW9uID0gb3B0aW9uc1sgaSBdO1xuXHRcdFx0XHRvcHRpb25WYWx1ZSA9IG9wdGlvbi5fcmFjdGl2ZSA/IG9wdGlvbi5fcmFjdGl2ZS52YWx1ZSA6IG9wdGlvbi52YWx1ZTtcblx0XHRcdFx0b3B0aW9uLnNlbGVjdGVkID0gdmFsdWUuaW5kZXhPZiggb3B0aW9uVmFsdWUgKSAhPT0gLTE7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnZhbHVlID0gdmFsdWU7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9O1xuXHRcdHVwZGF0ZVJhZGlvTmFtZSA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIG5vZGUsIHZhbHVlO1xuXHRcdFx0bm9kZSA9IHRoaXMucE5vZGU7XG5cdFx0XHR2YWx1ZSA9IHRoaXMuZnJhZ21lbnQuZ2V0VmFsdWUoKTtcblx0XHRcdG5vZGUuY2hlY2tlZCA9IHZhbHVlID09IG5vZGUuX3JhY3RpdmUudmFsdWU7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9O1xuXHRcdHVwZGF0ZUNoZWNrYm94TmFtZSA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIG5vZGUsIHZhbHVlO1xuXHRcdFx0bm9kZSA9IHRoaXMucE5vZGU7XG5cdFx0XHR2YWx1ZSA9IHRoaXMuZnJhZ21lbnQuZ2V0VmFsdWUoKTtcblx0XHRcdGlmICggIWlzQXJyYXkoIHZhbHVlICkgKSB7XG5cdFx0XHRcdG5vZGUuY2hlY2tlZCA9IHZhbHVlID09IG5vZGUuX3JhY3RpdmUudmFsdWU7XG5cdFx0XHRcdHJldHVybiB0aGlzO1xuXHRcdFx0fVxuXHRcdFx0bm9kZS5jaGVja2VkID0gdmFsdWUuaW5kZXhPZiggbm9kZS5fcmFjdGl2ZS52YWx1ZSApICE9PSAtMTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH07XG5cdFx0dXBkYXRlSUVTdHlsZUF0dHJpYnV0ZSA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIG5vZGUsIHZhbHVlO1xuXHRcdFx0bm9kZSA9IHRoaXMucE5vZGU7XG5cdFx0XHR2YWx1ZSA9IHRoaXMuZnJhZ21lbnQuZ2V0VmFsdWUoKTtcblx0XHRcdGlmICggdmFsdWUgPT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0dmFsdWUgPSAnJztcblx0XHRcdH1cblx0XHRcdGlmICggdmFsdWUgIT09IHRoaXMudmFsdWUgKSB7XG5cdFx0XHRcdG5vZGUuc3R5bGUuc2V0QXR0cmlidXRlKCAnY3NzVGV4dCcsIHZhbHVlICk7XG5cdFx0XHRcdHRoaXMudmFsdWUgPSB2YWx1ZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH07XG5cdFx0dXBkYXRlQ2xhc3NOYW1lID0gZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbm9kZSwgdmFsdWU7XG5cdFx0XHRub2RlID0gdGhpcy5wTm9kZTtcblx0XHRcdHZhbHVlID0gdGhpcy5mcmFnbWVudC5nZXRWYWx1ZSgpO1xuXHRcdFx0aWYgKCB2YWx1ZSA9PT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHR2YWx1ZSA9ICcnO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB2YWx1ZSAhPT0gdGhpcy52YWx1ZSApIHtcblx0XHRcdFx0bm9kZS5jbGFzc05hbWUgPSB2YWx1ZTtcblx0XHRcdFx0dGhpcy52YWx1ZSA9IHZhbHVlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fTtcblx0XHR1cGRhdGVDb250ZW50RWRpdGFibGVWYWx1ZSA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIG5vZGUsIHZhbHVlO1xuXHRcdFx0bm9kZSA9IHRoaXMucE5vZGU7XG5cdFx0XHR2YWx1ZSA9IHRoaXMuZnJhZ21lbnQuZ2V0VmFsdWUoKTtcblx0XHRcdGlmICggdmFsdWUgPT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0dmFsdWUgPSAnJztcblx0XHRcdH1cblx0XHRcdGlmICggdmFsdWUgIT09IHRoaXMudmFsdWUgKSB7XG5cdFx0XHRcdGlmICggIXRoaXMucmVjZWl2aW5nICkge1xuXHRcdFx0XHRcdG5vZGUuaW5uZXJIVE1MID0gdmFsdWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy52YWx1ZSA9IHZhbHVlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fTtcblx0XHR1cGRhdGVFdmVyeXRoaW5nRWxzZSA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIG5vZGUsIHZhbHVlO1xuXHRcdFx0bm9kZSA9IHRoaXMucE5vZGU7XG5cdFx0XHR2YWx1ZSA9IHRoaXMuZnJhZ21lbnQuZ2V0VmFsdWUoKTtcblx0XHRcdGlmICggdGhpcy5pc1ZhbHVlQXR0cmlidXRlICkge1xuXHRcdFx0XHRub2RlLl9yYWN0aXZlLnZhbHVlID0gdmFsdWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHZhbHVlID09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0dmFsdWUgPSAnJztcblx0XHRcdH1cblx0XHRcdGlmICggdmFsdWUgIT09IHRoaXMudmFsdWUgKSB7XG5cdFx0XHRcdGlmICggdGhpcy51c2VQcm9wZXJ0eSApIHtcblx0XHRcdFx0XHRpZiAoICF0aGlzLnJlY2VpdmluZyApIHtcblx0XHRcdFx0XHRcdG5vZGVbIHRoaXMucHJvcGVydHlOYW1lIF0gPSB2YWx1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGhpcy52YWx1ZSA9IHZhbHVlO1xuXHRcdFx0XHRcdHJldHVybiB0aGlzO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggdGhpcy5uYW1lc3BhY2UgKSB7XG5cdFx0XHRcdFx0bm9kZS5zZXRBdHRyaWJ1dGVOUyggdGhpcy5uYW1lc3BhY2UsIHRoaXMubmFtZSwgdmFsdWUgKTtcblx0XHRcdFx0XHR0aGlzLnZhbHVlID0gdmFsdWU7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCB0aGlzLmxjTmFtZSA9PT0gJ2lkJyApIHtcblx0XHRcdFx0XHRpZiAoIHRoaXMudmFsdWUgIT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0XHRcdHRoaXMucm9vdC5ub2Rlc1sgdGhpcy52YWx1ZSBdID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGlzLnJvb3Qubm9kZXNbIHZhbHVlIF0gPSBub2RlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdG5vZGUuc2V0QXR0cmlidXRlKCB0aGlzLm5hbWUsIHZhbHVlICk7XG5cdFx0XHRcdHRoaXMudmFsdWUgPSB2YWx1ZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH07XG5cdFx0cmV0dXJuIHVwZGF0ZUF0dHJpYnV0ZTtcblx0fSggZ2xvYmFsX3J1bmxvb3AsIGNvbmZpZ19uYW1lc3BhY2VzLCB1dGlsc19pc0FycmF5ICk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl91dGlsc19nZXRTdHJpbmdNYXRjaCA9IGZ1bmN0aW9uKCBzdHJpbmcgKSB7XG5cdFx0dmFyIHN1YnN0cjtcblx0XHRzdWJzdHIgPSB0aGlzLnN0ci5zdWJzdHIoIHRoaXMucG9zLCBzdHJpbmcubGVuZ3RoICk7XG5cdFx0aWYgKCBzdWJzdHIgPT09IHN0cmluZyApIHtcblx0XHRcdHRoaXMucG9zICs9IHN0cmluZy5sZW5ndGg7XG5cdFx0XHRyZXR1cm4gc3RyaW5nO1xuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX3V0aWxzX2FsbG93V2hpdGVzcGFjZSA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0dmFyIGxlYWRpbmdXaGl0ZXNwYWNlID0gL15cXHMrLztcblx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbWF0Y2ggPSBsZWFkaW5nV2hpdGVzcGFjZS5leGVjKCB0aGlzLnJlbWFpbmluZygpICk7XG5cdFx0XHRpZiAoICFtYXRjaCApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnBvcyArPSBtYXRjaFsgMCBdLmxlbmd0aDtcblx0XHRcdHJldHVybiBtYXRjaFsgMCBdO1xuXHRcdH07XG5cdH0oKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX3V0aWxzX21ha2VSZWdleE1hdGNoZXIgPSBmdW5jdGlvbiggcmVnZXggKSB7XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB0b2tlbml6ZXIgKSB7XG5cdFx0XHR2YXIgbWF0Y2ggPSByZWdleC5leGVjKCB0b2tlbml6ZXIuc3RyLnN1YnN0cmluZyggdG9rZW5pemVyLnBvcyApICk7XG5cdFx0XHRpZiAoICFtYXRjaCApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHR0b2tlbml6ZXIucG9zICs9IG1hdGNoWyAwIF0ubGVuZ3RoO1xuXHRcdFx0cmV0dXJuIG1hdGNoWyAxIF0gfHwgbWF0Y2hbIDAgXTtcblx0XHR9O1xuXHR9O1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X2dldExpdGVyYWxfZ2V0U3RyaW5nTGl0ZXJhbF9tYWtlUXVvdGVkU3RyaW5nTWF0Y2hlciA9IGZ1bmN0aW9uKCBtYWtlUmVnZXhNYXRjaGVyICkge1xuXG5cdFx0dmFyIGdldFN0cmluZ01pZGRsZSwgZ2V0RXNjYXBlU2VxdWVuY2UsIGdldExpbmVDb250aW51YXRpb247XG5cdFx0Z2V0U3RyaW5nTWlkZGxlID0gbWFrZVJlZ2V4TWF0Y2hlciggL14oPz0uKVteXCInXFxcXF0rPyg/Oig/IS4pfCg/PVtcIidcXFxcXSkpLyApO1xuXHRcdGdldEVzY2FwZVNlcXVlbmNlID0gbWFrZVJlZ2V4TWF0Y2hlciggL15cXFxcKD86WydcIlxcXFxiZm5ydF18MCg/IVswLTldKXx4WzAtOWEtZkEtRl17Mn18dVswLTlhLWZBLUZdezR9fCg/PS4pW151eDAtOV0pLyApO1xuXHRcdGdldExpbmVDb250aW51YXRpb24gPSBtYWtlUmVnZXhNYXRjaGVyKCAvXlxcXFwoPzpcXHJcXG58W1xcdTAwMEFcXHUwMDBEXFx1MjAyOFxcdTIwMjldKS8gKTtcblx0XHRyZXR1cm4gZnVuY3Rpb24oIHF1b3RlLCBva1F1b3RlICkge1xuXHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCB0b2tlbml6ZXIgKSB7XG5cdFx0XHRcdHZhciBzdGFydCwgbGl0ZXJhbCwgZG9uZSwgbmV4dDtcblx0XHRcdFx0c3RhcnQgPSB0b2tlbml6ZXIucG9zO1xuXHRcdFx0XHRsaXRlcmFsID0gJ1wiJztcblx0XHRcdFx0ZG9uZSA9IGZhbHNlO1xuXHRcdFx0XHR3aGlsZSAoICFkb25lICkge1xuXHRcdFx0XHRcdG5leHQgPSBnZXRTdHJpbmdNaWRkbGUoIHRva2VuaXplciApIHx8IGdldEVzY2FwZVNlcXVlbmNlKCB0b2tlbml6ZXIgKSB8fCB0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goIG9rUXVvdGUgKTtcblx0XHRcdFx0XHRpZiAoIG5leHQgKSB7XG5cdFx0XHRcdFx0XHRpZiAoIG5leHQgPT09ICdcIicgKSB7XG5cdFx0XHRcdFx0XHRcdGxpdGVyYWwgKz0gJ1xcXFxcIic7XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKCBuZXh0ID09PSAnXFxcXFxcJycgKSB7XG5cdFx0XHRcdFx0XHRcdGxpdGVyYWwgKz0gJ1xcJyc7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRsaXRlcmFsICs9IG5leHQ7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdG5leHQgPSBnZXRMaW5lQ29udGludWF0aW9uKCB0b2tlbml6ZXIgKTtcblx0XHRcdFx0XHRcdGlmICggbmV4dCApIHtcblx0XHRcdFx0XHRcdFx0bGl0ZXJhbCArPSAnXFxcXHUnICsgKCAnMDAwJyArIG5leHQuY2hhckNvZGVBdCggMSApLnRvU3RyaW5nKCAxNiApICkuc2xpY2UoIC00ICk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRkb25lID0gdHJ1ZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0bGl0ZXJhbCArPSAnXCInO1xuXHRcdFx0XHRyZXR1cm4gSlNPTi5wYXJzZSggbGl0ZXJhbCApO1xuXHRcdFx0fTtcblx0XHR9O1xuXHR9KCBwYXJzZV9Ub2tlbml6ZXJfdXRpbHNfbWFrZVJlZ2V4TWF0Y2hlciApO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X2dldExpdGVyYWxfZ2V0U3RyaW5nTGl0ZXJhbF9nZXRTaW5nbGVRdW90ZWRTdHJpbmcgPSBmdW5jdGlvbiggbWFrZVF1b3RlZFN0cmluZ01hdGNoZXIgKSB7XG5cblx0XHRyZXR1cm4gbWFrZVF1b3RlZFN0cmluZ01hdGNoZXIoICdcXCcnLCAnXCInICk7XG5cdH0oIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfZ2V0TGl0ZXJhbF9nZXRTdHJpbmdMaXRlcmFsX21ha2VRdW90ZWRTdHJpbmdNYXRjaGVyICk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfZ2V0TGl0ZXJhbF9nZXRTdHJpbmdMaXRlcmFsX2dldERvdWJsZVF1b3RlZFN0cmluZyA9IGZ1bmN0aW9uKCBtYWtlUXVvdGVkU3RyaW5nTWF0Y2hlciApIHtcblxuXHRcdHJldHVybiBtYWtlUXVvdGVkU3RyaW5nTWF0Y2hlciggJ1wiJywgJ1xcJycgKTtcblx0fSggcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9nZXRMaXRlcmFsX2dldFN0cmluZ0xpdGVyYWxfbWFrZVF1b3RlZFN0cmluZ01hdGNoZXIgKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9nZXRMaXRlcmFsX2dldFN0cmluZ0xpdGVyYWxfX2dldFN0cmluZ0xpdGVyYWwgPSBmdW5jdGlvbiggdHlwZXMsIGdldFNpbmdsZVF1b3RlZFN0cmluZywgZ2V0RG91YmxlUXVvdGVkU3RyaW5nICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB0b2tlbml6ZXIgKSB7XG5cdFx0XHR2YXIgc3RhcnQsIHN0cmluZztcblx0XHRcdHN0YXJ0ID0gdG9rZW5pemVyLnBvcztcblx0XHRcdGlmICggdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnXCInICkgKSB7XG5cdFx0XHRcdHN0cmluZyA9IGdldERvdWJsZVF1b3RlZFN0cmluZyggdG9rZW5pemVyICk7XG5cdFx0XHRcdGlmICggIXRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJ1wiJyApICkge1xuXHRcdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHQ6IHR5cGVzLlNUUklOR19MSVRFUkFMLFxuXHRcdFx0XHRcdHY6IHN0cmluZ1xuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICdcXCcnICkgKSB7XG5cdFx0XHRcdHN0cmluZyA9IGdldFNpbmdsZVF1b3RlZFN0cmluZyggdG9rZW5pemVyICk7XG5cdFx0XHRcdGlmICggIXRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJ1xcJycgKSApIHtcblx0XHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHR0OiB0eXBlcy5TVFJJTkdfTElURVJBTCxcblx0XHRcdFx0XHR2OiBzdHJpbmdcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH07XG5cdH0oIGNvbmZpZ190eXBlcywgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9nZXRMaXRlcmFsX2dldFN0cmluZ0xpdGVyYWxfZ2V0U2luZ2xlUXVvdGVkU3RyaW5nLCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X2dldExpdGVyYWxfZ2V0U3RyaW5nTGl0ZXJhbF9nZXREb3VibGVRdW90ZWRTdHJpbmcgKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9nZXRMaXRlcmFsX2dldE51bWJlckxpdGVyYWwgPSBmdW5jdGlvbiggdHlwZXMsIG1ha2VSZWdleE1hdGNoZXIgKSB7XG5cblx0XHR2YXIgZ2V0TnVtYmVyID0gbWFrZVJlZ2V4TWF0Y2hlciggL14oPzpbKy1dPykoPzooPzooPzowfFsxLTldXFxkKik/XFwuXFxkKyl8KD86KD86MHxbMS05XVxcZCopXFwuKXwoPzowfFsxLTldXFxkKikpKD86W2VFXVsrLV0/XFxkKyk/LyApO1xuXHRcdHJldHVybiBmdW5jdGlvbiggdG9rZW5pemVyICkge1xuXHRcdFx0dmFyIHJlc3VsdDtcblx0XHRcdGlmICggcmVzdWx0ID0gZ2V0TnVtYmVyKCB0b2tlbml6ZXIgKSApIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHR0OiB0eXBlcy5OVU1CRVJfTElURVJBTCxcblx0XHRcdFx0XHR2OiByZXN1bHRcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH07XG5cdH0oIGNvbmZpZ190eXBlcywgcGFyc2VfVG9rZW5pemVyX3V0aWxzX21ha2VSZWdleE1hdGNoZXIgKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fc2hhcmVkX2dldE5hbWUgPSBmdW5jdGlvbiggbWFrZVJlZ2V4TWF0Y2hlciApIHtcblxuXHRcdHJldHVybiBtYWtlUmVnZXhNYXRjaGVyKCAvXlthLXpBLVpfJF1bYS16QS1aXyQwLTldKi8gKTtcblx0fSggcGFyc2VfVG9rZW5pemVyX3V0aWxzX21ha2VSZWdleE1hdGNoZXIgKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fc2hhcmVkX2dldEtleSA9IGZ1bmN0aW9uKCBnZXRTdHJpbmdMaXRlcmFsLCBnZXROdW1iZXJMaXRlcmFsLCBnZXROYW1lICkge1xuXG5cdFx0dmFyIGlkZW50aWZpZXIgPSAvXlthLXpBLVpfJF1bYS16QS1aXyQwLTldKiQvO1xuXHRcdHJldHVybiBmdW5jdGlvbiggdG9rZW5pemVyICkge1xuXHRcdFx0dmFyIHRva2VuO1xuXHRcdFx0aWYgKCB0b2tlbiA9IGdldFN0cmluZ0xpdGVyYWwoIHRva2VuaXplciApICkge1xuXHRcdFx0XHRyZXR1cm4gaWRlbnRpZmllci50ZXN0KCB0b2tlbi52ICkgPyB0b2tlbi52IDogJ1wiJyArIHRva2VuLnYucmVwbGFjZSggL1wiL2csICdcXFxcXCInICkgKyAnXCInO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0b2tlbiA9IGdldE51bWJlckxpdGVyYWwoIHRva2VuaXplciApICkge1xuXHRcdFx0XHRyZXR1cm4gdG9rZW4udjtcblx0XHRcdH1cblx0XHRcdGlmICggdG9rZW4gPSBnZXROYW1lKCB0b2tlbml6ZXIgKSApIHtcblx0XHRcdFx0cmV0dXJuIHRva2VuO1xuXHRcdFx0fVxuXHRcdH07XG5cdH0oIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfZ2V0TGl0ZXJhbF9nZXRTdHJpbmdMaXRlcmFsX19nZXRTdHJpbmdMaXRlcmFsLCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X2dldExpdGVyYWxfZ2V0TnVtYmVyTGl0ZXJhbCwgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fc2hhcmVkX2dldE5hbWUgKTtcblxuXHR2YXIgdXRpbHNfcGFyc2VKU09OID0gZnVuY3Rpb24oIGdldFN0cmluZ01hdGNoLCBhbGxvd1doaXRlc3BhY2UsIGdldFN0cmluZ0xpdGVyYWwsIGdldEtleSApIHtcblxuXHRcdHZhciBUb2tlbml6ZXIsIHNwZWNpYWxzLCBzcGVjaWFsc1BhdHRlcm4sIG51bWJlclBhdHRlcm4sIHBsYWNlaG9sZGVyUGF0dGVybiwgcGxhY2Vob2xkZXJBdFN0YXJ0UGF0dGVybjtcblx0XHRzcGVjaWFscyA9IHtcblx0XHRcdCd0cnVlJzogdHJ1ZSxcblx0XHRcdCdmYWxzZSc6IGZhbHNlLFxuXHRcdFx0J3VuZGVmaW5lZCc6IHVuZGVmaW5lZCxcblx0XHRcdCdudWxsJzogbnVsbFxuXHRcdH07XG5cdFx0c3BlY2lhbHNQYXR0ZXJuID0gbmV3IFJlZ0V4cCggJ14oPzonICsgT2JqZWN0LmtleXMoIHNwZWNpYWxzICkuam9pbiggJ3wnICkgKyAnKScgKTtcblx0XHRudW1iZXJQYXR0ZXJuID0gL14oPzpbKy1dPykoPzooPzooPzowfFsxLTldXFxkKik/XFwuXFxkKyl8KD86KD86MHxbMS05XVxcZCopXFwuKXwoPzowfFsxLTldXFxkKikpKD86W2VFXVsrLV0/XFxkKyk/Lztcblx0XHRwbGFjZWhvbGRlclBhdHRlcm4gPSAvXFwkXFx7KFteXFx9XSspXFx9L2c7XG5cdFx0cGxhY2Vob2xkZXJBdFN0YXJ0UGF0dGVybiA9IC9eXFwkXFx7KFteXFx9XSspXFx9Lztcblx0XHRUb2tlbml6ZXIgPSBmdW5jdGlvbiggc3RyLCB2YWx1ZXMgKSB7XG5cdFx0XHR0aGlzLnN0ciA9IHN0cjtcblx0XHRcdHRoaXMudmFsdWVzID0gdmFsdWVzO1xuXHRcdFx0dGhpcy5wb3MgPSAwO1xuXHRcdFx0dGhpcy5yZXN1bHQgPSB0aGlzLmdldFRva2VuKCk7XG5cdFx0fTtcblx0XHRUb2tlbml6ZXIucHJvdG90eXBlID0ge1xuXHRcdFx0cmVtYWluaW5nOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuc3RyLnN1YnN0cmluZyggdGhpcy5wb3MgKTtcblx0XHRcdH0sXG5cdFx0XHRnZXRTdHJpbmdNYXRjaDogZ2V0U3RyaW5nTWF0Y2gsXG5cdFx0XHRnZXRUb2tlbjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHRoaXMuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRcdHJldHVybiB0aGlzLmdldFBsYWNlaG9sZGVyKCkgfHwgdGhpcy5nZXRTcGVjaWFsKCkgfHwgdGhpcy5nZXROdW1iZXIoKSB8fCB0aGlzLmdldFN0cmluZygpIHx8IHRoaXMuZ2V0T2JqZWN0KCkgfHwgdGhpcy5nZXRBcnJheSgpO1xuXHRcdFx0fSxcblx0XHRcdGdldFBsYWNlaG9sZGVyOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIG1hdGNoO1xuXHRcdFx0XHRpZiAoICF0aGlzLnZhbHVlcyApIHtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoICggbWF0Y2ggPSBwbGFjZWhvbGRlckF0U3RhcnRQYXR0ZXJuLmV4ZWMoIHRoaXMucmVtYWluaW5nKCkgKSApICYmIHRoaXMudmFsdWVzLmhhc093blByb3BlcnR5KCBtYXRjaFsgMSBdICkgKSB7XG5cdFx0XHRcdFx0dGhpcy5wb3MgKz0gbWF0Y2hbIDAgXS5sZW5ndGg7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdHY6IHRoaXMudmFsdWVzWyBtYXRjaFsgMSBdIF1cblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0Z2V0U3BlY2lhbDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBtYXRjaDtcblx0XHRcdFx0aWYgKCBtYXRjaCA9IHNwZWNpYWxzUGF0dGVybi5leGVjKCB0aGlzLnJlbWFpbmluZygpICkgKSB7XG5cdFx0XHRcdFx0dGhpcy5wb3MgKz0gbWF0Y2hbIDAgXS5sZW5ndGg7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdHY6IHNwZWNpYWxzWyBtYXRjaFsgMCBdIF1cblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0Z2V0TnVtYmVyOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIG1hdGNoO1xuXHRcdFx0XHRpZiAoIG1hdGNoID0gbnVtYmVyUGF0dGVybi5leGVjKCB0aGlzLnJlbWFpbmluZygpICkgKSB7XG5cdFx0XHRcdFx0dGhpcy5wb3MgKz0gbWF0Y2hbIDAgXS5sZW5ndGg7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdHY6ICttYXRjaFsgMCBdXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGdldFN0cmluZzogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBzdHJpbmdMaXRlcmFsID0gZ2V0U3RyaW5nTGl0ZXJhbCggdGhpcyApLFxuXHRcdFx0XHRcdHZhbHVlcztcblx0XHRcdFx0aWYgKCBzdHJpbmdMaXRlcmFsICYmICggdmFsdWVzID0gdGhpcy52YWx1ZXMgKSApIHtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0djogc3RyaW5nTGl0ZXJhbC52LnJlcGxhY2UoIHBsYWNlaG9sZGVyUGF0dGVybiwgZnVuY3Rpb24oIG1hdGNoLCAkMSApIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHZhbHVlc1sgJDEgXSB8fCAkMTtcblx0XHRcdFx0XHRcdH0gKVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHN0cmluZ0xpdGVyYWw7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0T2JqZWN0OiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHJlc3VsdCwgcGFpcjtcblx0XHRcdFx0aWYgKCAhdGhpcy5nZXRTdHJpbmdNYXRjaCggJ3snICkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVzdWx0ID0ge307XG5cdFx0XHRcdHdoaWxlICggcGFpciA9IGdldEtleVZhbHVlUGFpciggdGhpcyApICkge1xuXHRcdFx0XHRcdHJlc3VsdFsgcGFpci5rZXkgXSA9IHBhaXIudmFsdWU7XG5cdFx0XHRcdFx0dGhpcy5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdFx0XHRpZiAoIHRoaXMuZ2V0U3RyaW5nTWF0Y2goICd9JyApICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0djogcmVzdWx0XG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoICF0aGlzLmdldFN0cmluZ01hdGNoKCAnLCcgKSApIHtcblx0XHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH0sXG5cdFx0XHRnZXRBcnJheTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciByZXN1bHQsIHZhbHVlVG9rZW47XG5cdFx0XHRcdGlmICggIXRoaXMuZ2V0U3RyaW5nTWF0Y2goICdbJyApICkge1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlc3VsdCA9IFtdO1xuXHRcdFx0XHR3aGlsZSAoIHZhbHVlVG9rZW4gPSB0aGlzLmdldFRva2VuKCkgKSB7XG5cdFx0XHRcdFx0cmVzdWx0LnB1c2goIHZhbHVlVG9rZW4udiApO1xuXHRcdFx0XHRcdGlmICggdGhpcy5nZXRTdHJpbmdNYXRjaCggJ10nICkgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0XHR2OiByZXN1bHRcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICggIXRoaXMuZ2V0U3RyaW5nTWF0Y2goICcsJyApICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fSxcblx0XHRcdGFsbG93V2hpdGVzcGFjZTogYWxsb3dXaGl0ZXNwYWNlXG5cdFx0fTtcblxuXHRcdGZ1bmN0aW9uIGdldEtleVZhbHVlUGFpciggdG9rZW5pemVyICkge1xuXHRcdFx0dmFyIGtleSwgdmFsdWVUb2tlbiwgcGFpcjtcblx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdGtleSA9IGdldEtleSggdG9rZW5pemVyICk7XG5cdFx0XHRpZiAoICFrZXkgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0cGFpciA9IHtcblx0XHRcdFx0a2V5OiBrZXlcblx0XHRcdH07XG5cdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRpZiAoICF0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICc6JyApICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdHZhbHVlVG9rZW4gPSB0b2tlbml6ZXIuZ2V0VG9rZW4oKTtcblx0XHRcdGlmICggIXZhbHVlVG9rZW4gKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0cGFpci52YWx1ZSA9IHZhbHVlVG9rZW4udjtcblx0XHRcdHJldHVybiBwYWlyO1xuXHRcdH1cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHN0ciwgdmFsdWVzICkge1xuXHRcdFx0dmFyIHRva2VuaXplciA9IG5ldyBUb2tlbml6ZXIoIHN0ciwgdmFsdWVzICk7XG5cdFx0XHRpZiAoIHRva2VuaXplci5yZXN1bHQgKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0dmFsdWU6IHRva2VuaXplci5yZXN1bHQudixcblx0XHRcdFx0XHRyZW1haW5pbmc6IHRva2VuaXplci5yZW1haW5pbmcoKVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fTtcblx0fSggcGFyc2VfVG9rZW5pemVyX3V0aWxzX2dldFN0cmluZ01hdGNoLCBwYXJzZV9Ub2tlbml6ZXJfdXRpbHNfYWxsb3dXaGl0ZXNwYWNlLCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X2dldExpdGVyYWxfZ2V0U3RyaW5nTGl0ZXJhbF9fZ2V0U3RyaW5nTGl0ZXJhbCwgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fc2hhcmVkX2dldEtleSApO1xuXG5cdHZhciByZW5kZXJfU3RyaW5nRnJhZ21lbnRfSW50ZXJwb2xhdG9yID0gZnVuY3Rpb24oIHR5cGVzLCB0ZWFyZG93biwgaW5pdE11c3RhY2hlLCB1cGRhdGVNdXN0YWNoZSwgcmVzb2x2ZU11c3RhY2hlICkge1xuXG5cdFx0dmFyIFN0cmluZ0ludGVycG9sYXRvciA9IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0dGhpcy50eXBlID0gdHlwZXMuSU5URVJQT0xBVE9SO1xuXHRcdFx0aW5pdE11c3RhY2hlKCB0aGlzLCBvcHRpb25zICk7XG5cdFx0fTtcblx0XHRTdHJpbmdJbnRlcnBvbGF0b3IucHJvdG90eXBlID0ge1xuXHRcdFx0dXBkYXRlOiB1cGRhdGVNdXN0YWNoZSxcblx0XHRcdHJlc29sdmU6IHJlc29sdmVNdXN0YWNoZSxcblx0XHRcdHJlbmRlcjogZnVuY3Rpb24oIHZhbHVlICkge1xuXHRcdFx0XHR0aGlzLnZhbHVlID0gdmFsdWU7XG5cdFx0XHRcdHRoaXMucGFyZW50RnJhZ21lbnQuYnViYmxlKCk7XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR0ZWFyZG93biggdGhpcyApO1xuXHRcdFx0fSxcblx0XHRcdHRvU3RyaW5nOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0aWYgKCB0aGlzLnZhbHVlID09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0XHRyZXR1cm4gJyc7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHN0cmluZ2lmeSggdGhpcy52YWx1ZSApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIFN0cmluZ0ludGVycG9sYXRvcjtcblxuXHRcdGZ1bmN0aW9uIHN0cmluZ2lmeSggdmFsdWUgKSB7XG5cdFx0XHRpZiAoIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBKU09OLnN0cmluZ2lmeSggdmFsdWUgKTtcblx0XHR9XG5cdH0oIGNvbmZpZ190eXBlcywgc2hhcmVkX3RlYXJkb3duLCByZW5kZXJfc2hhcmVkX2luaXRNdXN0YWNoZSwgcmVuZGVyX3NoYXJlZF91cGRhdGVNdXN0YWNoZSwgcmVuZGVyX3NoYXJlZF9yZXNvbHZlTXVzdGFjaGUgKTtcblxuXHR2YXIgcmVuZGVyX1N0cmluZ0ZyYWdtZW50X1NlY3Rpb24gPSBmdW5jdGlvbiggdHlwZXMsIGluaXRNdXN0YWNoZSwgdXBkYXRlTXVzdGFjaGUsIHJlc29sdmVNdXN0YWNoZSwgdXBkYXRlU2VjdGlvbiwgdGVhcmRvd24sIGNpcmN1bGFyICkge1xuXG5cdFx0dmFyIFN0cmluZ1NlY3Rpb24sIFN0cmluZ0ZyYWdtZW50O1xuXHRcdGNpcmN1bGFyLnB1c2goIGZ1bmN0aW9uKCkge1xuXHRcdFx0U3RyaW5nRnJhZ21lbnQgPSBjaXJjdWxhci5TdHJpbmdGcmFnbWVudDtcblx0XHR9ICk7XG5cdFx0U3RyaW5nU2VjdGlvbiA9IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0dGhpcy50eXBlID0gdHlwZXMuU0VDVElPTjtcblx0XHRcdHRoaXMuZnJhZ21lbnRzID0gW107XG5cdFx0XHR0aGlzLmxlbmd0aCA9IDA7XG5cdFx0XHRpbml0TXVzdGFjaGUoIHRoaXMsIG9wdGlvbnMgKTtcblx0XHR9O1xuXHRcdFN0cmluZ1NlY3Rpb24ucHJvdG90eXBlID0ge1xuXHRcdFx0dXBkYXRlOiB1cGRhdGVNdXN0YWNoZSxcblx0XHRcdHJlc29sdmU6IHJlc29sdmVNdXN0YWNoZSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dGhpcy50ZWFyZG93bkZyYWdtZW50cygpO1xuXHRcdFx0XHR0ZWFyZG93biggdGhpcyApO1xuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duRnJhZ21lbnRzOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0d2hpbGUgKCB0aGlzLmZyYWdtZW50cy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0dGhpcy5mcmFnbWVudHMuc2hpZnQoKS50ZWFyZG93bigpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMubGVuZ3RoID0gMDtcblx0XHRcdH0sXG5cdFx0XHRidWJibGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR0aGlzLnZhbHVlID0gdGhpcy5mcmFnbWVudHMuam9pbiggJycgKTtcblx0XHRcdFx0dGhpcy5wYXJlbnRGcmFnbWVudC5idWJibGUoKTtcblx0XHRcdH0sXG5cdFx0XHRyZW5kZXI6IGZ1bmN0aW9uKCB2YWx1ZSApIHtcblx0XHRcdFx0dmFyIHdyYXBwZWQ7XG5cdFx0XHRcdGlmICggd3JhcHBlZCA9IHRoaXMucm9vdC5fd3JhcHBlZFsgdGhpcy5rZXlwYXRoIF0gKSB7XG5cdFx0XHRcdFx0dmFsdWUgPSB3cmFwcGVkLmdldCgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHVwZGF0ZVNlY3Rpb24oIHRoaXMsIHZhbHVlICk7XG5cdFx0XHRcdHRoaXMucGFyZW50RnJhZ21lbnQuYnViYmxlKCk7XG5cdFx0XHR9LFxuXHRcdFx0Y3JlYXRlRnJhZ21lbnQ6IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XHRyZXR1cm4gbmV3IFN0cmluZ0ZyYWdtZW50KCBvcHRpb25zICk7XG5cdFx0XHR9LFxuXHRcdFx0dG9TdHJpbmc6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5mcmFnbWVudHMuam9pbiggJycgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBTdHJpbmdTZWN0aW9uO1xuXHR9KCBjb25maWdfdHlwZXMsIHJlbmRlcl9zaGFyZWRfaW5pdE11c3RhY2hlLCByZW5kZXJfc2hhcmVkX3VwZGF0ZU11c3RhY2hlLCByZW5kZXJfc2hhcmVkX3Jlc29sdmVNdXN0YWNoZSwgcmVuZGVyX3NoYXJlZF91cGRhdGVTZWN0aW9uLCBzaGFyZWRfdGVhcmRvd24sIGNpcmN1bGFyICk7XG5cblx0dmFyIHJlbmRlcl9TdHJpbmdGcmFnbWVudF9UZXh0ID0gZnVuY3Rpb24oIHR5cGVzICkge1xuXG5cdFx0dmFyIFN0cmluZ1RleHQgPSBmdW5jdGlvbiggdGV4dCApIHtcblx0XHRcdHRoaXMudHlwZSA9IHR5cGVzLlRFWFQ7XG5cdFx0XHR0aGlzLnRleHQgPSB0ZXh0O1xuXHRcdH07XG5cdFx0U3RyaW5nVGV4dC5wcm90b3R5cGUgPSB7XG5cdFx0XHR0b1N0cmluZzogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnRleHQ7XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCkge31cblx0XHR9O1xuXHRcdHJldHVybiBTdHJpbmdUZXh0O1xuXHR9KCBjb25maWdfdHlwZXMgKTtcblxuXHR2YXIgcmVuZGVyX1N0cmluZ0ZyYWdtZW50X3Byb3RvdHlwZV90b0FyZ3NMaXN0ID0gZnVuY3Rpb24oIHdhcm4sIHBhcnNlSlNPTiApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbigpIHtcblx0XHRcdHZhciB2YWx1ZXMsIGNvdW50ZXIsIGpzb25lc3F1ZSwgZ3VpZCwgZXJyb3JNZXNzYWdlLCBwYXJzZWQsIHByb2Nlc3NJdGVtcztcblx0XHRcdGlmICggIXRoaXMuYXJnc0xpc3QgfHwgdGhpcy5kaXJ0eSApIHtcblx0XHRcdFx0dmFsdWVzID0ge307XG5cdFx0XHRcdGNvdW50ZXIgPSAwO1xuXHRcdFx0XHRndWlkID0gdGhpcy5yb290Ll9ndWlkO1xuXHRcdFx0XHRwcm9jZXNzSXRlbXMgPSBmdW5jdGlvbiggaXRlbXMgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGl0ZW1zLm1hcCggZnVuY3Rpb24oIGl0ZW0gKSB7XG5cdFx0XHRcdFx0XHR2YXIgcGxhY2Vob2xkZXJJZCwgd3JhcHBlZCwgdmFsdWU7XG5cdFx0XHRcdFx0XHRpZiAoIGl0ZW0udGV4dCApIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGl0ZW0udGV4dDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmICggaXRlbS5mcmFnbWVudHMgKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBpdGVtLmZyYWdtZW50cy5tYXAoIGZ1bmN0aW9uKCBmcmFnbWVudCApIHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gcHJvY2Vzc0l0ZW1zKCBmcmFnbWVudC5pdGVtcyApO1xuXHRcdFx0XHRcdFx0XHR9ICkuam9pbiggJycgKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHBsYWNlaG9sZGVySWQgPSBndWlkICsgJy0nICsgY291bnRlcisrO1xuXHRcdFx0XHRcdFx0aWYgKCB3cmFwcGVkID0gaXRlbS5yb290Ll93cmFwcGVkWyBpdGVtLmtleXBhdGggXSApIHtcblx0XHRcdFx0XHRcdFx0dmFsdWUgPSB3cmFwcGVkLnZhbHVlO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0dmFsdWUgPSBpdGVtLnZhbHVlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0dmFsdWVzWyBwbGFjZWhvbGRlcklkIF0gPSB2YWx1ZTtcblx0XHRcdFx0XHRcdHJldHVybiAnJHsnICsgcGxhY2Vob2xkZXJJZCArICd9Jztcblx0XHRcdFx0XHR9ICkuam9pbiggJycgKTtcblx0XHRcdFx0fTtcblx0XHRcdFx0anNvbmVzcXVlID0gcHJvY2Vzc0l0ZW1zKCB0aGlzLml0ZW1zICk7XG5cdFx0XHRcdHBhcnNlZCA9IHBhcnNlSlNPTiggJ1snICsganNvbmVzcXVlICsgJ10nLCB2YWx1ZXMgKTtcblx0XHRcdFx0aWYgKCAhcGFyc2VkICkge1xuXHRcdFx0XHRcdGVycm9yTWVzc2FnZSA9ICdDb3VsZCBub3QgcGFyc2UgZGlyZWN0aXZlIGFyZ3VtZW50cyAoJyArIHRoaXMudG9TdHJpbmcoKSArICcpLiBJZiB5b3UgdGhpbmsgdGhpcyBpcyBhIGJ1ZywgcGxlYXNlIGZpbGUgYW4gaXNzdWUgYXQgaHR0cDovL2dpdGh1Yi5jb20vUmFjdGl2ZUpTL1JhY3RpdmUvaXNzdWVzJztcblx0XHRcdFx0XHRpZiAoIHRoaXMucm9vdC5kZWJ1ZyApIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggZXJyb3JNZXNzYWdlICk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHdhcm4oIGVycm9yTWVzc2FnZSApO1xuXHRcdFx0XHRcdFx0dGhpcy5hcmdzTGlzdCA9IFsganNvbmVzcXVlIF07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuYXJnc0xpc3QgPSBwYXJzZWQudmFsdWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5kaXJ0eSA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXMuYXJnc0xpc3Q7XG5cdFx0fTtcblx0fSggdXRpbHNfd2FybiwgdXRpbHNfcGFyc2VKU09OICk7XG5cblx0dmFyIHJlbmRlcl9TdHJpbmdGcmFnbWVudF9fU3RyaW5nRnJhZ21lbnQgPSBmdW5jdGlvbiggdHlwZXMsIHBhcnNlSlNPTiwgaW5pdEZyYWdtZW50LCBJbnRlcnBvbGF0b3IsIFNlY3Rpb24sIFRleHQsIHRvQXJnc0xpc3QsIGNpcmN1bGFyICkge1xuXG5cdFx0dmFyIFN0cmluZ0ZyYWdtZW50ID0gZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRpbml0RnJhZ21lbnQoIHRoaXMsIG9wdGlvbnMgKTtcblx0XHR9O1xuXHRcdFN0cmluZ0ZyYWdtZW50LnByb3RvdHlwZSA9IHtcblx0XHRcdGNyZWF0ZUl0ZW06IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XHRpZiAoIHR5cGVvZiBvcHRpb25zLmRlc2NyaXB0b3IgPT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHRcdHJldHVybiBuZXcgVGV4dCggb3B0aW9ucy5kZXNjcmlwdG9yICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0c3dpdGNoICggb3B0aW9ucy5kZXNjcmlwdG9yLnQgKSB7XG5cdFx0XHRcdFx0Y2FzZSB0eXBlcy5JTlRFUlBPTEFUT1I6XG5cdFx0XHRcdFx0XHRyZXR1cm4gbmV3IEludGVycG9sYXRvciggb3B0aW9ucyApO1xuXHRcdFx0XHRcdGNhc2UgdHlwZXMuVFJJUExFOlxuXHRcdFx0XHRcdFx0cmV0dXJuIG5ldyBJbnRlcnBvbGF0b3IoIG9wdGlvbnMgKTtcblx0XHRcdFx0XHRjYXNlIHR5cGVzLlNFQ1RJT046XG5cdFx0XHRcdFx0XHRyZXR1cm4gbmV3IFNlY3Rpb24oIG9wdGlvbnMgKTtcblx0XHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdFx0dGhyb3cgJ1NvbWV0aGluZyB3ZW50IHdyb25nIGluIGEgcmF0aGVyIGludGVyZXN0aW5nIHdheSc7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRidWJibGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR0aGlzLmRpcnR5ID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy5vd25lci5idWJibGUoKTtcblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBudW1JdGVtcywgaTtcblx0XHRcdFx0bnVtSXRlbXMgPSB0aGlzLml0ZW1zLmxlbmd0aDtcblx0XHRcdFx0Zm9yICggaSA9IDA7IGkgPCBudW1JdGVtczsgaSArPSAxICkge1xuXHRcdFx0XHRcdHRoaXMuaXRlbXNbIGkgXS50ZWFyZG93bigpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0Z2V0VmFsdWU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgdmFsdWU7XG5cdFx0XHRcdGlmICggdGhpcy5pdGVtcy5sZW5ndGggPT09IDEgJiYgdGhpcy5pdGVtc1sgMCBdLnR5cGUgPT09IHR5cGVzLklOVEVSUE9MQVRPUiApIHtcblx0XHRcdFx0XHR2YWx1ZSA9IHRoaXMuaXRlbXNbIDAgXS52YWx1ZTtcblx0XHRcdFx0XHRpZiAoIHZhbHVlICE9PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0aGlzLnRvU3RyaW5nKCk7XG5cdFx0XHR9LFxuXHRcdFx0aXNTaW1wbGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgaSwgaXRlbSwgY29udGFpbnNJbnRlcnBvbGF0b3I7XG5cdFx0XHRcdGlmICggdGhpcy5zaW1wbGUgIT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5zaW1wbGU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aSA9IHRoaXMuaXRlbXMubGVuZ3RoO1xuXHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRpdGVtID0gdGhpcy5pdGVtc1sgaSBdO1xuXHRcdFx0XHRcdGlmICggaXRlbS50eXBlID09PSB0eXBlcy5URVhUICkge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICggaXRlbS50eXBlID09PSB0eXBlcy5JTlRFUlBPTEFUT1IgKSB7XG5cdFx0XHRcdFx0XHRpZiAoIGNvbnRhaW5zSW50ZXJwb2xhdG9yICkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRjb250YWluc0ludGVycG9sYXRvciA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5zaW1wbGUgPSBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdGhpcy5zaW1wbGUgPSB0cnVlO1xuXHRcdFx0fSxcblx0XHRcdHRvU3RyaW5nOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuaXRlbXMuam9pbiggJycgKTtcblx0XHRcdH0sXG5cdFx0XHR0b0pTT046IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgdmFsdWUgPSB0aGlzLmdldFZhbHVlKCksXG5cdFx0XHRcdFx0cGFyc2VkO1xuXHRcdFx0XHRpZiAoIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdFx0cGFyc2VkID0gcGFyc2VKU09OKCB2YWx1ZSApO1xuXHRcdFx0XHRcdHZhbHVlID0gcGFyc2VkID8gcGFyc2VkLnZhbHVlIDogdmFsdWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdFx0fSxcblx0XHRcdHRvQXJnc0xpc3Q6IHRvQXJnc0xpc3Rcblx0XHR9O1xuXHRcdGNpcmN1bGFyLlN0cmluZ0ZyYWdtZW50ID0gU3RyaW5nRnJhZ21lbnQ7XG5cdFx0cmV0dXJuIFN0cmluZ0ZyYWdtZW50O1xuXHR9KCBjb25maWdfdHlwZXMsIHV0aWxzX3BhcnNlSlNPTiwgcmVuZGVyX3NoYXJlZF9pbml0RnJhZ21lbnQsIHJlbmRlcl9TdHJpbmdGcmFnbWVudF9JbnRlcnBvbGF0b3IsIHJlbmRlcl9TdHJpbmdGcmFnbWVudF9TZWN0aW9uLCByZW5kZXJfU3RyaW5nRnJhZ21lbnRfVGV4dCwgcmVuZGVyX1N0cmluZ0ZyYWdtZW50X3Byb3RvdHlwZV90b0FyZ3NMaXN0LCBjaXJjdWxhciApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfQXR0cmlidXRlX19BdHRyaWJ1dGUgPSBmdW5jdGlvbiggcnVubG9vcCwgdHlwZXMsIGRldGVybWluZU5hbWVBbmROYW1lc3BhY2UsIHNldFN0YXRpY0F0dHJpYnV0ZSwgZGV0ZXJtaW5lUHJvcGVydHlOYW1lLCBnZXRJbnRlcnBvbGF0b3IsIGJpbmQsIHVwZGF0ZSwgU3RyaW5nRnJhZ21lbnQgKSB7XG5cblx0XHR2YXIgRG9tQXR0cmlidXRlID0gZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHR0aGlzLnR5cGUgPSB0eXBlcy5BVFRSSUJVVEU7XG5cdFx0XHR0aGlzLmVsZW1lbnQgPSBvcHRpb25zLmVsZW1lbnQ7XG5cdFx0XHRkZXRlcm1pbmVOYW1lQW5kTmFtZXNwYWNlKCB0aGlzLCBvcHRpb25zLm5hbWUgKTtcblx0XHRcdGlmICggb3B0aW9ucy52YWx1ZSA9PT0gbnVsbCB8fCB0eXBlb2Ygb3B0aW9ucy52YWx1ZSA9PT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdHNldFN0YXRpY0F0dHJpYnV0ZSggdGhpcywgb3B0aW9ucyApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnJvb3QgPSBvcHRpb25zLnJvb3Q7XG5cdFx0XHR0aGlzLnBOb2RlID0gb3B0aW9ucy5wTm9kZTtcblx0XHRcdHRoaXMucGFyZW50RnJhZ21lbnQgPSB0aGlzLmVsZW1lbnQucGFyZW50RnJhZ21lbnQ7XG5cdFx0XHR0aGlzLmZyYWdtZW50ID0gbmV3IFN0cmluZ0ZyYWdtZW50KCB7XG5cdFx0XHRcdGRlc2NyaXB0b3I6IG9wdGlvbnMudmFsdWUsXG5cdFx0XHRcdHJvb3Q6IHRoaXMucm9vdCxcblx0XHRcdFx0b3duZXI6IHRoaXNcblx0XHRcdH0gKTtcblx0XHRcdHRoaXMuaW50ZXJwb2xhdG9yID0gZ2V0SW50ZXJwb2xhdG9yKCB0aGlzICk7XG5cdFx0XHRpZiAoICF0aGlzLnBOb2RlICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRoaXMubmFtZSA9PT0gJ3ZhbHVlJyApIHtcblx0XHRcdFx0dGhpcy5pc1ZhbHVlQXR0cmlidXRlID0gdHJ1ZTtcblx0XHRcdFx0aWYgKCB0aGlzLnBOb2RlLnRhZ05hbWUgPT09ICdJTlBVVCcgJiYgdGhpcy5wTm9kZS50eXBlID09PSAnZmlsZScgKSB7XG5cdFx0XHRcdFx0dGhpcy5pc0ZpbGVJbnB1dFZhbHVlID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0ZGV0ZXJtaW5lUHJvcGVydHlOYW1lKCB0aGlzLCBvcHRpb25zICk7XG5cdFx0XHR0aGlzLnNlbGZVcGRhdGluZyA9IHRoaXMuZnJhZ21lbnQuaXNTaW1wbGUoKTtcblx0XHRcdHRoaXMucmVhZHkgPSB0cnVlO1xuXHRcdH07XG5cdFx0RG9tQXR0cmlidXRlLnByb3RvdHlwZSA9IHtcblx0XHRcdGJpbmQ6IGJpbmQsXG5cdFx0XHR1cGRhdGU6IHVwZGF0ZSxcblx0XHRcdHVwZGF0ZUJpbmRpbmdzOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dGhpcy5rZXlwYXRoID0gdGhpcy5pbnRlcnBvbGF0b3Iua2V5cGF0aCB8fCB0aGlzLmludGVycG9sYXRvci5yZWY7XG5cdFx0XHRcdGlmICggdGhpcy5wcm9wZXJ0eU5hbWUgPT09ICduYW1lJyApIHtcblx0XHRcdFx0XHR0aGlzLnBOb2RlLm5hbWUgPSAne3snICsgdGhpcy5rZXlwYXRoICsgJ319Jztcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIGk7XG5cdFx0XHRcdGlmICggdGhpcy5ib3VuZEV2ZW50cyApIHtcblx0XHRcdFx0XHRpID0gdGhpcy5ib3VuZEV2ZW50cy5sZW5ndGg7XG5cdFx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0XHR0aGlzLnBOb2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoIHRoaXMuYm91bmRFdmVudHNbIGkgXSwgdGhpcy51cGRhdGVNb2RlbCwgZmFsc2UgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCB0aGlzLmZyYWdtZW50ICkge1xuXHRcdFx0XHRcdHRoaXMuZnJhZ21lbnQudGVhcmRvd24oKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGJ1YmJsZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmICggdGhpcy5zZWxmVXBkYXRpbmcgKSB7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGUoKTtcblx0XHRcdFx0fSBlbHNlIGlmICggIXRoaXMuZGVmZXJyZWQgJiYgdGhpcy5yZWFkeSApIHtcblx0XHRcdFx0XHRydW5sb29wLmFkZEF0dHJpYnV0ZSggdGhpcyApO1xuXHRcdFx0XHRcdHRoaXMuZGVmZXJyZWQgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0dG9TdHJpbmc6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgc3RyLCBpbnRlcnBvbGF0b3I7XG5cdFx0XHRcdGlmICggdGhpcy52YWx1ZSA9PT0gbnVsbCApIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5uYW1lO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggdGhpcy5uYW1lID09PSAndmFsdWUnICYmIHRoaXMuZWxlbWVudC5sY05hbWUgPT09ICdzZWxlY3QnICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHRoaXMubmFtZSA9PT0gJ25hbWUnICYmIHRoaXMuZWxlbWVudC5sY05hbWUgPT09ICdpbnB1dCcgJiYgKCBpbnRlcnBvbGF0b3IgPSB0aGlzLmludGVycG9sYXRvciApICkge1xuXHRcdFx0XHRcdHJldHVybiAnbmFtZT17eycgKyAoIGludGVycG9sYXRvci5rZXlwYXRoIHx8IGludGVycG9sYXRvci5yZWYgKSArICd9fSc7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCAhdGhpcy5mcmFnbWVudCApIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5uYW1lICsgJz0nICsgSlNPTi5zdHJpbmdpZnkoIHRoaXMudmFsdWUgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzdHIgPSB0aGlzLmZyYWdtZW50LnRvU3RyaW5nKCk7XG5cdFx0XHRcdHJldHVybiB0aGlzLm5hbWUgKyAnPScgKyBKU09OLnN0cmluZ2lmeSggc3RyICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gRG9tQXR0cmlidXRlO1xuXHR9KCBnbG9iYWxfcnVubG9vcCwgY29uZmlnX3R5cGVzLCByZW5kZXJfRG9tRnJhZ21lbnRfQXR0cmlidXRlX2hlbHBlcnNfZGV0ZXJtaW5lTmFtZUFuZE5hbWVzcGFjZSwgcmVuZGVyX0RvbUZyYWdtZW50X0F0dHJpYnV0ZV9oZWxwZXJzX3NldFN0YXRpY0F0dHJpYnV0ZSwgcmVuZGVyX0RvbUZyYWdtZW50X0F0dHJpYnV0ZV9oZWxwZXJzX2RldGVybWluZVByb3BlcnR5TmFtZSwgcmVuZGVyX0RvbUZyYWdtZW50X0F0dHJpYnV0ZV9oZWxwZXJzX2dldEludGVycG9sYXRvciwgcmVuZGVyX0RvbUZyYWdtZW50X0F0dHJpYnV0ZV9wcm90b3R5cGVfYmluZCwgcmVuZGVyX0RvbUZyYWdtZW50X0F0dHJpYnV0ZV9wcm90b3R5cGVfdXBkYXRlLCByZW5kZXJfU3RyaW5nRnJhZ21lbnRfX1N0cmluZ0ZyYWdtZW50ICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X2luaXRpYWxpc2VfY3JlYXRlRWxlbWVudEF0dHJpYnV0ZXMgPSBmdW5jdGlvbiggRG9tQXR0cmlidXRlICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBlbGVtZW50LCBhdHRyaWJ1dGVzICkge1xuXHRcdFx0dmFyIGF0dHJOYW1lLCBhdHRyVmFsdWUsIGF0dHI7XG5cdFx0XHRlbGVtZW50LmF0dHJpYnV0ZXMgPSBbXTtcblx0XHRcdGZvciAoIGF0dHJOYW1lIGluIGF0dHJpYnV0ZXMgKSB7XG5cdFx0XHRcdGlmICggYXR0cmlidXRlcy5oYXNPd25Qcm9wZXJ0eSggYXR0ck5hbWUgKSApIHtcblx0XHRcdFx0XHRhdHRyVmFsdWUgPSBhdHRyaWJ1dGVzWyBhdHRyTmFtZSBdO1xuXHRcdFx0XHRcdGF0dHIgPSBuZXcgRG9tQXR0cmlidXRlKCB7XG5cdFx0XHRcdFx0XHRlbGVtZW50OiBlbGVtZW50LFxuXHRcdFx0XHRcdFx0bmFtZTogYXR0ck5hbWUsXG5cdFx0XHRcdFx0XHR2YWx1ZTogYXR0clZhbHVlLFxuXHRcdFx0XHRcdFx0cm9vdDogZWxlbWVudC5yb290LFxuXHRcdFx0XHRcdFx0cE5vZGU6IGVsZW1lbnQubm9kZVxuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHRlbGVtZW50LmF0dHJpYnV0ZXMucHVzaCggZWxlbWVudC5hdHRyaWJ1dGVzWyBhdHRyTmFtZSBdID0gYXR0ciApO1xuXHRcdFx0XHRcdGlmICggYXR0ck5hbWUgIT09ICduYW1lJyApIHtcblx0XHRcdFx0XHRcdGF0dHIudXBkYXRlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZWxlbWVudC5hdHRyaWJ1dGVzO1xuXHRcdH07XG5cdH0oIHJlbmRlcl9Eb21GcmFnbWVudF9BdHRyaWJ1dGVfX0F0dHJpYnV0ZSApO1xuXG5cdHZhciB1dGlsc190b0FycmF5ID0gZnVuY3Rpb24gdG9BcnJheSggYXJyYXlMaWtlICkge1xuXHRcdHZhciBhcnJheSA9IFtdLFxuXHRcdFx0aSA9IGFycmF5TGlrZS5sZW5ndGg7XG5cdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRhcnJheVsgaSBdID0gYXJyYXlMaWtlWyBpIF07XG5cdFx0fVxuXHRcdHJldHVybiBhcnJheTtcblx0fTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2dldE1hdGNoaW5nU3RhdGljTm9kZXMgPSBmdW5jdGlvbiggdG9BcnJheSApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiBnZXRNYXRjaGluZ1N0YXRpY05vZGVzKCBlbGVtZW50LCBzZWxlY3RvciApIHtcblx0XHRcdGlmICggIWVsZW1lbnQubWF0Y2hpbmdTdGF0aWNOb2Rlc1sgc2VsZWN0b3IgXSApIHtcblx0XHRcdFx0ZWxlbWVudC5tYXRjaGluZ1N0YXRpY05vZGVzWyBzZWxlY3RvciBdID0gdG9BcnJheSggZWxlbWVudC5ub2RlLnF1ZXJ5U2VsZWN0b3JBbGwoIHNlbGVjdG9yICkgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBlbGVtZW50Lm1hdGNoaW5nU3RhdGljTm9kZXNbIHNlbGVjdG9yIF07XG5cdFx0fTtcblx0fSggdXRpbHNfdG9BcnJheSApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9pbml0aWFsaXNlX2FwcGVuZEVsZW1lbnRDaGlsZHJlbiA9IGZ1bmN0aW9uKCB3YXJuLCBuYW1lc3BhY2VzLCBTdHJpbmdGcmFnbWVudCwgZ2V0TWF0Y2hpbmdTdGF0aWNOb2RlcywgY2lyY3VsYXIgKSB7XG5cblx0XHR2YXIgRG9tRnJhZ21lbnQsIHVwZGF0ZUNzcywgdXBkYXRlU2NyaXB0O1xuXHRcdGNpcmN1bGFyLnB1c2goIGZ1bmN0aW9uKCkge1xuXHRcdFx0RG9tRnJhZ21lbnQgPSBjaXJjdWxhci5Eb21GcmFnbWVudDtcblx0XHR9ICk7XG5cdFx0dXBkYXRlQ3NzID0gZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbm9kZSA9IHRoaXMubm9kZSxcblx0XHRcdFx0Y29udGVudCA9IHRoaXMuZnJhZ21lbnQudG9TdHJpbmcoKTtcblx0XHRcdGlmICggbm9kZS5zdHlsZVNoZWV0ICkge1xuXHRcdFx0XHRub2RlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNvbnRlbnQ7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRub2RlLmlubmVySFRNTCA9IGNvbnRlbnQ7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHR1cGRhdGVTY3JpcHQgPSBmdW5jdGlvbigpIHtcblx0XHRcdGlmICggIXRoaXMubm9kZS50eXBlIHx8IHRoaXMubm9kZS50eXBlID09PSAndGV4dC9qYXZhc2NyaXB0JyApIHtcblx0XHRcdFx0d2FybiggJ1NjcmlwdCB0YWcgd2FzIHVwZGF0ZWQuIFRoaXMgZG9lcyBub3QgY2F1c2UgdGhlIGNvZGUgdG8gYmUgcmUtZXZhbHVhdGVkIScgKTtcblx0XHRcdH1cblx0XHRcdHRoaXMubm9kZS50ZXh0ID0gdGhpcy5mcmFnbWVudC50b1N0cmluZygpO1xuXHRcdH07XG5cdFx0cmV0dXJuIGZ1bmN0aW9uIGFwcGVuZEVsZW1lbnRDaGlsZHJlbiggZWxlbWVudCwgbm9kZSwgZGVzY3JpcHRvciwgZG9jRnJhZyApIHtcblx0XHRcdGlmICggZWxlbWVudC5sY05hbWUgPT09ICdzY3JpcHQnIHx8IGVsZW1lbnQubGNOYW1lID09PSAnc3R5bGUnICkge1xuXHRcdFx0XHRlbGVtZW50LmZyYWdtZW50ID0gbmV3IFN0cmluZ0ZyYWdtZW50KCB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRvcjogZGVzY3JpcHRvci5mLFxuXHRcdFx0XHRcdHJvb3Q6IGVsZW1lbnQucm9vdCxcblx0XHRcdFx0XHRvd25lcjogZWxlbWVudFxuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdGlmICggZG9jRnJhZyApIHtcblx0XHRcdFx0XHRpZiAoIGVsZW1lbnQubGNOYW1lID09PSAnc2NyaXB0JyApIHtcblx0XHRcdFx0XHRcdGVsZW1lbnQuYnViYmxlID0gdXBkYXRlU2NyaXB0O1xuXHRcdFx0XHRcdFx0ZWxlbWVudC5ub2RlLnRleHQgPSBlbGVtZW50LmZyYWdtZW50LnRvU3RyaW5nKCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGVsZW1lbnQuYnViYmxlID0gdXBkYXRlQ3NzO1xuXHRcdFx0XHRcdFx0ZWxlbWVudC5idWJibGUoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0eXBlb2YgZGVzY3JpcHRvci5mID09PSAnc3RyaW5nJyAmJiAoICFub2RlIHx8ICggIW5vZGUubmFtZXNwYWNlVVJJIHx8IG5vZGUubmFtZXNwYWNlVVJJID09PSBuYW1lc3BhY2VzLmh0bWwgKSApICkge1xuXHRcdFx0XHRlbGVtZW50Lmh0bWwgPSBkZXNjcmlwdG9yLmY7XG5cdFx0XHRcdGlmICggZG9jRnJhZyApIHtcblx0XHRcdFx0XHRub2RlLmlubmVySFRNTCA9IGVsZW1lbnQuaHRtbDtcblx0XHRcdFx0XHRlbGVtZW50Lm1hdGNoaW5nU3RhdGljTm9kZXMgPSB7fTtcblx0XHRcdFx0XHR1cGRhdGVMaXZlUXVlcmllcyggZWxlbWVudCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRlbGVtZW50LmZyYWdtZW50ID0gbmV3IERvbUZyYWdtZW50KCB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRvcjogZGVzY3JpcHRvci5mLFxuXHRcdFx0XHRcdHJvb3Q6IGVsZW1lbnQucm9vdCxcblx0XHRcdFx0XHRwTm9kZTogbm9kZSxcblx0XHRcdFx0XHRvd25lcjogZWxlbWVudCxcblx0XHRcdFx0XHRwRWxlbWVudDogZWxlbWVudFxuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdGlmICggZG9jRnJhZyApIHtcblx0XHRcdFx0XHRub2RlLmFwcGVuZENoaWxkKCBlbGVtZW50LmZyYWdtZW50LmRvY0ZyYWcgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRmdW5jdGlvbiB1cGRhdGVMaXZlUXVlcmllcyggZWxlbWVudCApIHtcblx0XHRcdHZhciBpbnN0YW5jZSwgbGl2ZVF1ZXJpZXMsIG5vZGUsIHNlbGVjdG9yLCBxdWVyeSwgbWF0Y2hpbmdTdGF0aWNOb2RlcywgaTtcblx0XHRcdG5vZGUgPSBlbGVtZW50Lm5vZGU7XG5cdFx0XHRpbnN0YW5jZSA9IGVsZW1lbnQucm9vdDtcblx0XHRcdGRvIHtcblx0XHRcdFx0bGl2ZVF1ZXJpZXMgPSBpbnN0YW5jZS5fbGl2ZVF1ZXJpZXM7XG5cdFx0XHRcdGkgPSBsaXZlUXVlcmllcy5sZW5ndGg7XG5cdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdHNlbGVjdG9yID0gbGl2ZVF1ZXJpZXNbIGkgXTtcblx0XHRcdFx0XHRxdWVyeSA9IGxpdmVRdWVyaWVzWyBzZWxlY3RvciBdO1xuXHRcdFx0XHRcdG1hdGNoaW5nU3RhdGljTm9kZXMgPSBnZXRNYXRjaGluZ1N0YXRpY05vZGVzKCBlbGVtZW50LCBzZWxlY3RvciApO1xuXHRcdFx0XHRcdHF1ZXJ5LnB1c2guYXBwbHkoIHF1ZXJ5LCBtYXRjaGluZ1N0YXRpY05vZGVzICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gd2hpbGUgKCBpbnN0YW5jZSA9IGluc3RhbmNlLl9wYXJlbnQgKTtcblx0XHR9XG5cdH0oIHV0aWxzX3dhcm4sIGNvbmZpZ19uYW1lc3BhY2VzLCByZW5kZXJfU3RyaW5nRnJhZ21lbnRfX1N0cmluZ0ZyYWdtZW50LCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZ2V0TWF0Y2hpbmdTdGF0aWNOb2RlcywgY2lyY3VsYXIgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfaW5pdGlhbGlzZV9kZWNvcmF0ZV9EZWNvcmF0b3IgPSBmdW5jdGlvbiggd2FybiwgU3RyaW5nRnJhZ21lbnQgKSB7XG5cblx0XHR2YXIgRGVjb3JhdG9yID0gZnVuY3Rpb24oIGRlc2NyaXB0b3IsIHJhY3RpdmUsIG93bmVyICkge1xuXHRcdFx0dmFyIGRlY29yYXRvciA9IHRoaXMsXG5cdFx0XHRcdG5hbWUsIGZyYWdtZW50LCBlcnJvck1lc3NhZ2U7XG5cdFx0XHRkZWNvcmF0b3Iucm9vdCA9IHJhY3RpdmU7XG5cdFx0XHRkZWNvcmF0b3Iubm9kZSA9IG93bmVyLm5vZGU7XG5cdFx0XHRuYW1lID0gZGVzY3JpcHRvci5uIHx8IGRlc2NyaXB0b3I7XG5cdFx0XHRpZiAoIHR5cGVvZiBuYW1lICE9PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0ZnJhZ21lbnQgPSBuZXcgU3RyaW5nRnJhZ21lbnQoIHtcblx0XHRcdFx0XHRkZXNjcmlwdG9yOiBuYW1lLFxuXHRcdFx0XHRcdHJvb3Q6IHJhY3RpdmUsXG5cdFx0XHRcdFx0b3duZXI6IG93bmVyXG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0bmFtZSA9IGZyYWdtZW50LnRvU3RyaW5nKCk7XG5cdFx0XHRcdGZyYWdtZW50LnRlYXJkb3duKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGRlc2NyaXB0b3IuYSApIHtcblx0XHRcdFx0ZGVjb3JhdG9yLnBhcmFtcyA9IGRlc2NyaXB0b3IuYTtcblx0XHRcdH0gZWxzZSBpZiAoIGRlc2NyaXB0b3IuZCApIHtcblx0XHRcdFx0ZGVjb3JhdG9yLmZyYWdtZW50ID0gbmV3IFN0cmluZ0ZyYWdtZW50KCB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRvcjogZGVzY3JpcHRvci5kLFxuXHRcdFx0XHRcdHJvb3Q6IHJhY3RpdmUsXG5cdFx0XHRcdFx0b3duZXI6IG93bmVyXG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0ZGVjb3JhdG9yLnBhcmFtcyA9IGRlY29yYXRvci5mcmFnbWVudC50b0FyZ3NMaXN0KCk7XG5cdFx0XHRcdGRlY29yYXRvci5mcmFnbWVudC5idWJibGUgPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHR0aGlzLmRpcnR5ID0gdHJ1ZTtcblx0XHRcdFx0XHRkZWNvcmF0b3IucGFyYW1zID0gdGhpcy50b0FyZ3NMaXN0KCk7XG5cdFx0XHRcdFx0aWYgKCBkZWNvcmF0b3IucmVhZHkgKSB7XG5cdFx0XHRcdFx0XHRkZWNvcmF0b3IudXBkYXRlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdFx0ZGVjb3JhdG9yLmZuID0gcmFjdGl2ZS5kZWNvcmF0b3JzWyBuYW1lIF07XG5cdFx0XHRpZiAoICFkZWNvcmF0b3IuZm4gKSB7XG5cdFx0XHRcdGVycm9yTWVzc2FnZSA9ICdNaXNzaW5nIFwiJyArIG5hbWUgKyAnXCIgZGVjb3JhdG9yLiBZb3UgbWF5IG5lZWQgdG8gZG93bmxvYWQgYSBwbHVnaW4gdmlhIGh0dHA6Ly9kb2NzLnJhY3RpdmVqcy5vcmcvbGF0ZXN0L3BsdWdpbnMjZGVjb3JhdG9ycyc7XG5cdFx0XHRcdGlmICggcmFjdGl2ZS5kZWJ1ZyApIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoIGVycm9yTWVzc2FnZSApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHdhcm4oIGVycm9yTWVzc2FnZSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0XHREZWNvcmF0b3IucHJvdG90eXBlID0ge1xuXHRcdFx0aW5pdDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciByZXN1bHQsIGFyZ3M7XG5cdFx0XHRcdGlmICggdGhpcy5wYXJhbXMgKSB7XG5cdFx0XHRcdFx0YXJncyA9IFsgdGhpcy5ub2RlIF0uY29uY2F0KCB0aGlzLnBhcmFtcyApO1xuXHRcdFx0XHRcdHJlc3VsdCA9IHRoaXMuZm4uYXBwbHkoIHRoaXMucm9vdCwgYXJncyApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJlc3VsdCA9IHRoaXMuZm4uY2FsbCggdGhpcy5yb290LCB0aGlzLm5vZGUgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoICFyZXN1bHQgfHwgIXJlc3VsdC50ZWFyZG93biApIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdEZWNvcmF0b3IgZGVmaW5pdGlvbiBtdXN0IHJldHVybiBhbiBvYmplY3Qgd2l0aCBhIHRlYXJkb3duIG1ldGhvZCcgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLmFjdHVhbCA9IHJlc3VsdDtcblx0XHRcdFx0dGhpcy5yZWFkeSA9IHRydWU7XG5cdFx0XHR9LFxuXHRcdFx0dXBkYXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0aWYgKCB0aGlzLmFjdHVhbC51cGRhdGUgKSB7XG5cdFx0XHRcdFx0dGhpcy5hY3R1YWwudXBkYXRlLmFwcGx5KCB0aGlzLnJvb3QsIHRoaXMucGFyYW1zICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5hY3R1YWwudGVhcmRvd24oIHRydWUgKTtcblx0XHRcdFx0XHR0aGlzLmluaXQoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbiggdXBkYXRpbmcgKSB7XG5cdFx0XHRcdHRoaXMuYWN0dWFsLnRlYXJkb3duKCk7XG5cdFx0XHRcdGlmICggIXVwZGF0aW5nICkge1xuXHRcdFx0XHRcdHRoaXMuZnJhZ21lbnQudGVhcmRvd24oKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIERlY29yYXRvcjtcblx0fSggdXRpbHNfd2FybiwgcmVuZGVyX1N0cmluZ0ZyYWdtZW50X19TdHJpbmdGcmFnbWVudCApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9pbml0aWFsaXNlX2RlY29yYXRlX19kZWNvcmF0ZSA9IGZ1bmN0aW9uKCBydW5sb29wLCBEZWNvcmF0b3IgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIGRlc2NyaXB0b3IsIHJvb3QsIG93bmVyICkge1xuXHRcdFx0dmFyIGRlY29yYXRvciA9IG5ldyBEZWNvcmF0b3IoIGRlc2NyaXB0b3IsIHJvb3QsIG93bmVyICk7XG5cdFx0XHRpZiAoIGRlY29yYXRvci5mbiApIHtcblx0XHRcdFx0b3duZXIuZGVjb3JhdG9yID0gZGVjb3JhdG9yO1xuXHRcdFx0XHRydW5sb29wLmFkZERlY29yYXRvciggb3duZXIuZGVjb3JhdG9yICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fSggZ2xvYmFsX3J1bmxvb3AsIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X2luaXRpYWxpc2VfZGVjb3JhdGVfRGVjb3JhdG9yICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X2luaXRpYWxpc2VfYWRkRXZlbnRQcm94aWVzX2FkZEV2ZW50UHJveHkgPSBmdW5jdGlvbiggd2FybiwgU3RyaW5nRnJhZ21lbnQgKSB7XG5cblx0XHR2YXIgYWRkRXZlbnRQcm94eSwgTWFzdGVyRXZlbnRIYW5kbGVyLCBQcm94eUV2ZW50LCBmaXJlUGxhaW5FdmVudCwgZmlyZUV2ZW50V2l0aEFyZ3MsIGZpcmVFdmVudFdpdGhEeW5hbWljQXJncywgY3VzdG9tSGFuZGxlcnMsIGdlbmVyaWNIYW5kbGVyLCBnZXRDdXN0b21IYW5kbGVyO1xuXHRcdGFkZEV2ZW50UHJveHkgPSBmdW5jdGlvbiggZWxlbWVudCwgdHJpZ2dlckV2ZW50TmFtZSwgcHJveHlEZXNjcmlwdG9yLCBpbmRleFJlZnMgKSB7XG5cdFx0XHR2YXIgZXZlbnRzLCBtYXN0ZXI7XG5cdFx0XHRldmVudHMgPSBlbGVtZW50Lm5vZGUuX3JhY3RpdmUuZXZlbnRzO1xuXHRcdFx0bWFzdGVyID0gZXZlbnRzWyB0cmlnZ2VyRXZlbnROYW1lIF0gfHwgKCBldmVudHNbIHRyaWdnZXJFdmVudE5hbWUgXSA9IG5ldyBNYXN0ZXJFdmVudEhhbmRsZXIoIGVsZW1lbnQsIHRyaWdnZXJFdmVudE5hbWUsIGluZGV4UmVmcyApICk7XG5cdFx0XHRtYXN0ZXIuYWRkKCBwcm94eURlc2NyaXB0b3IgKTtcblx0XHR9O1xuXHRcdE1hc3RlckV2ZW50SGFuZGxlciA9IGZ1bmN0aW9uKCBlbGVtZW50LCBldmVudE5hbWUgKSB7XG5cdFx0XHR2YXIgZGVmaW5pdGlvbjtcblx0XHRcdHRoaXMuZWxlbWVudCA9IGVsZW1lbnQ7XG5cdFx0XHR0aGlzLnJvb3QgPSBlbGVtZW50LnJvb3Q7XG5cdFx0XHR0aGlzLm5vZGUgPSBlbGVtZW50Lm5vZGU7XG5cdFx0XHR0aGlzLm5hbWUgPSBldmVudE5hbWU7XG5cdFx0XHR0aGlzLnByb3hpZXMgPSBbXTtcblx0XHRcdGlmICggZGVmaW5pdGlvbiA9IHRoaXMucm9vdC5ldmVudHNbIGV2ZW50TmFtZSBdICkge1xuXHRcdFx0XHR0aGlzLmN1c3RvbSA9IGRlZmluaXRpb24oIHRoaXMubm9kZSwgZ2V0Q3VzdG9tSGFuZGxlciggZXZlbnROYW1lICkgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmICggISggJ29uJyArIGV2ZW50TmFtZSBpbiB0aGlzLm5vZGUgKSApIHtcblx0XHRcdFx0XHR3YXJuKCAnTWlzc2luZyBcIicgKyB0aGlzLm5hbWUgKyAnXCIgZXZlbnQuIFlvdSBtYXkgbmVlZCB0byBkb3dubG9hZCBhIHBsdWdpbiB2aWEgaHR0cDovL2RvY3MucmFjdGl2ZWpzLm9yZy9sYXRlc3QvcGx1Z2lucyNldmVudHMnICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5ub2RlLmFkZEV2ZW50TGlzdGVuZXIoIGV2ZW50TmFtZSwgZ2VuZXJpY0hhbmRsZXIsIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRNYXN0ZXJFdmVudEhhbmRsZXIucHJvdG90eXBlID0ge1xuXHRcdFx0YWRkOiBmdW5jdGlvbiggcHJveHkgKSB7XG5cdFx0XHRcdHRoaXMucHJveGllcy5wdXNoKCBuZXcgUHJveHlFdmVudCggdGhpcy5lbGVtZW50LCB0aGlzLnJvb3QsIHByb3h5ICkgKTtcblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBpO1xuXHRcdFx0XHRpZiAoIHRoaXMuY3VzdG9tICkge1xuXHRcdFx0XHRcdHRoaXMuY3VzdG9tLnRlYXJkb3duKCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5ub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoIHRoaXMubmFtZSwgZ2VuZXJpY0hhbmRsZXIsIGZhbHNlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aSA9IHRoaXMucHJveGllcy5sZW5ndGg7XG5cdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdHRoaXMucHJveGllc1sgaSBdLnRlYXJkb3duKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRmaXJlOiBmdW5jdGlvbiggZXZlbnQgKSB7XG5cdFx0XHRcdHZhciBpID0gdGhpcy5wcm94aWVzLmxlbmd0aDtcblx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0dGhpcy5wcm94aWVzWyBpIF0uZmlyZSggZXZlbnQgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdFx0UHJveHlFdmVudCA9IGZ1bmN0aW9uKCBlbGVtZW50LCByYWN0aXZlLCBkZXNjcmlwdG9yICkge1xuXHRcdFx0dmFyIG5hbWU7XG5cdFx0XHR0aGlzLnJvb3QgPSByYWN0aXZlO1xuXHRcdFx0bmFtZSA9IGRlc2NyaXB0b3IubiB8fCBkZXNjcmlwdG9yO1xuXHRcdFx0aWYgKCB0eXBlb2YgbmFtZSA9PT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdHRoaXMubiA9IG5hbWU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLm4gPSBuZXcgU3RyaW5nRnJhZ21lbnQoIHtcblx0XHRcdFx0XHRkZXNjcmlwdG9yOiBkZXNjcmlwdG9yLm4sXG5cdFx0XHRcdFx0cm9vdDogdGhpcy5yb290LFxuXHRcdFx0XHRcdG93bmVyOiBlbGVtZW50XG5cdFx0XHRcdH0gKTtcblx0XHRcdH1cblx0XHRcdGlmICggZGVzY3JpcHRvci5hICkge1xuXHRcdFx0XHR0aGlzLmEgPSBkZXNjcmlwdG9yLmE7XG5cdFx0XHRcdHRoaXMuZmlyZSA9IGZpcmVFdmVudFdpdGhBcmdzO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGRlc2NyaXB0b3IuZCApIHtcblx0XHRcdFx0dGhpcy5kID0gbmV3IFN0cmluZ0ZyYWdtZW50KCB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRvcjogZGVzY3JpcHRvci5kLFxuXHRcdFx0XHRcdHJvb3Q6IHRoaXMucm9vdCxcblx0XHRcdFx0XHRvd25lcjogZWxlbWVudFxuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdHRoaXMuZmlyZSA9IGZpcmVFdmVudFdpdGhEeW5hbWljQXJncztcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5maXJlID0gZmlyZVBsYWluRXZlbnQ7XG5cdFx0fTtcblx0XHRQcm94eUV2ZW50LnByb3RvdHlwZSA9IHtcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0aWYgKCB0aGlzLm4udGVhcmRvd24gKSB7XG5cdFx0XHRcdFx0dGhpcy5uLnRlYXJkb3duKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCB0aGlzLmQgKSB7XG5cdFx0XHRcdFx0dGhpcy5kLnRlYXJkb3duKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRidWJibGU6IGZ1bmN0aW9uKCkge31cblx0XHR9O1xuXHRcdGZpcmVQbGFpbkV2ZW50ID0gZnVuY3Rpb24oIGV2ZW50ICkge1xuXHRcdFx0dGhpcy5yb290LmZpcmUoIHRoaXMubi50b1N0cmluZygpLCBldmVudCApO1xuXHRcdH07XG5cdFx0ZmlyZUV2ZW50V2l0aEFyZ3MgPSBmdW5jdGlvbiggZXZlbnQgKSB7XG5cdFx0XHR0aGlzLnJvb3QuZmlyZS5hcHBseSggdGhpcy5yb290LCBbXG5cdFx0XHRcdHRoaXMubi50b1N0cmluZygpLFxuXHRcdFx0XHRldmVudFxuXHRcdFx0XS5jb25jYXQoIHRoaXMuYSApICk7XG5cdFx0fTtcblx0XHRmaXJlRXZlbnRXaXRoRHluYW1pY0FyZ3MgPSBmdW5jdGlvbiggZXZlbnQgKSB7XG5cdFx0XHR2YXIgYXJncyA9IHRoaXMuZC50b0FyZ3NMaXN0KCk7XG5cdFx0XHRpZiAoIHR5cGVvZiBhcmdzID09PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0YXJncyA9IGFyZ3Muc3Vic3RyKCAxLCBhcmdzLmxlbmd0aCAtIDIgKTtcblx0XHRcdH1cblx0XHRcdHRoaXMucm9vdC5maXJlLmFwcGx5KCB0aGlzLnJvb3QsIFtcblx0XHRcdFx0dGhpcy5uLnRvU3RyaW5nKCksXG5cdFx0XHRcdGV2ZW50XG5cdFx0XHRdLmNvbmNhdCggYXJncyApICk7XG5cdFx0fTtcblx0XHRnZW5lcmljSGFuZGxlciA9IGZ1bmN0aW9uKCBldmVudCApIHtcblx0XHRcdHZhciBzdG9yYWdlID0gdGhpcy5fcmFjdGl2ZTtcblx0XHRcdHN0b3JhZ2UuZXZlbnRzWyBldmVudC50eXBlIF0uZmlyZSgge1xuXHRcdFx0XHRub2RlOiB0aGlzLFxuXHRcdFx0XHRvcmlnaW5hbDogZXZlbnQsXG5cdFx0XHRcdGluZGV4OiBzdG9yYWdlLmluZGV4LFxuXHRcdFx0XHRrZXlwYXRoOiBzdG9yYWdlLmtleXBhdGgsXG5cdFx0XHRcdGNvbnRleHQ6IHN0b3JhZ2Uucm9vdC5nZXQoIHN0b3JhZ2Uua2V5cGF0aCApXG5cdFx0XHR9ICk7XG5cdFx0fTtcblx0XHRjdXN0b21IYW5kbGVycyA9IHt9O1xuXHRcdGdldEN1c3RvbUhhbmRsZXIgPSBmdW5jdGlvbiggZXZlbnROYW1lICkge1xuXHRcdFx0aWYgKCBjdXN0b21IYW5kbGVyc1sgZXZlbnROYW1lIF0gKSB7XG5cdFx0XHRcdHJldHVybiBjdXN0b21IYW5kbGVyc1sgZXZlbnROYW1lIF07XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gY3VzdG9tSGFuZGxlcnNbIGV2ZW50TmFtZSBdID0gZnVuY3Rpb24oIGV2ZW50ICkge1xuXHRcdFx0XHR2YXIgc3RvcmFnZSA9IGV2ZW50Lm5vZGUuX3JhY3RpdmU7XG5cdFx0XHRcdGV2ZW50LmluZGV4ID0gc3RvcmFnZS5pbmRleDtcblx0XHRcdFx0ZXZlbnQua2V5cGF0aCA9IHN0b3JhZ2Uua2V5cGF0aDtcblx0XHRcdFx0ZXZlbnQuY29udGV4dCA9IHN0b3JhZ2Uucm9vdC5nZXQoIHN0b3JhZ2Uua2V5cGF0aCApO1xuXHRcdFx0XHRzdG9yYWdlLmV2ZW50c1sgZXZlbnROYW1lIF0uZmlyZSggZXZlbnQgKTtcblx0XHRcdH07XG5cdFx0fTtcblx0XHRyZXR1cm4gYWRkRXZlbnRQcm94eTtcblx0fSggdXRpbHNfd2FybiwgcmVuZGVyX1N0cmluZ0ZyYWdtZW50X19TdHJpbmdGcmFnbWVudCApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9pbml0aWFsaXNlX2FkZEV2ZW50UHJveGllc19fYWRkRXZlbnRQcm94aWVzID0gZnVuY3Rpb24oIGFkZEV2ZW50UHJveHkgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIGVsZW1lbnQsIHByb3hpZXMgKSB7XG5cdFx0XHR2YXIgaSwgZXZlbnROYW1lLCBldmVudE5hbWVzO1xuXHRcdFx0Zm9yICggZXZlbnROYW1lIGluIHByb3hpZXMgKSB7XG5cdFx0XHRcdGlmICggcHJveGllcy5oYXNPd25Qcm9wZXJ0eSggZXZlbnROYW1lICkgKSB7XG5cdFx0XHRcdFx0ZXZlbnROYW1lcyA9IGV2ZW50TmFtZS5zcGxpdCggJy0nICk7XG5cdFx0XHRcdFx0aSA9IGV2ZW50TmFtZXMubGVuZ3RoO1xuXHRcdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdFx0YWRkRXZlbnRQcm94eSggZWxlbWVudCwgZXZlbnROYW1lc1sgaSBdLCBwcm94aWVzWyBldmVudE5hbWUgXSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdH0oIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X2luaXRpYWxpc2VfYWRkRXZlbnRQcm94aWVzX2FkZEV2ZW50UHJveHkgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfaW5pdGlhbGlzZV91cGRhdGVMaXZlUXVlcmllcyA9IGZ1bmN0aW9uKCBlbGVtZW50ICkge1xuXHRcdHZhciBpbnN0YW5jZSwgbGl2ZVF1ZXJpZXMsIGksIHNlbGVjdG9yLCBxdWVyeTtcblx0XHRpbnN0YW5jZSA9IGVsZW1lbnQucm9vdDtcblx0XHRkbyB7XG5cdFx0XHRsaXZlUXVlcmllcyA9IGluc3RhbmNlLl9saXZlUXVlcmllcztcblx0XHRcdGkgPSBsaXZlUXVlcmllcy5sZW5ndGg7XG5cdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0c2VsZWN0b3IgPSBsaXZlUXVlcmllc1sgaSBdO1xuXHRcdFx0XHRxdWVyeSA9IGxpdmVRdWVyaWVzWyBzZWxlY3RvciBdO1xuXHRcdFx0XHRpZiAoIHF1ZXJ5Ll90ZXN0KCBlbGVtZW50ICkgKSB7XG5cdFx0XHRcdFx0KCBlbGVtZW50LmxpdmVRdWVyaWVzIHx8ICggZWxlbWVudC5saXZlUXVlcmllcyA9IFtdICkgKS5wdXNoKCBxdWVyeSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSB3aGlsZSAoIGluc3RhbmNlID0gaW5zdGFuY2UuX3BhcmVudCApO1xuXHR9O1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZXhlY3V0ZVRyYW5zaXRpb25fVHJhbnNpdGlvbl9wcm90b3R5cGVfaW5pdCA9IGZ1bmN0aW9uKCkge1xuXHRcdGlmICggdGhpcy5faW5pdGVkICkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnQ2Fubm90IGluaXRpYWxpemUgYSB0cmFuc2l0aW9uIG1vcmUgdGhhbiBvbmNlJyApO1xuXHRcdH1cblx0XHR0aGlzLl9pbml0ZWQgPSB0cnVlO1xuXHRcdHRoaXMuX2ZuLmFwcGx5KCB0aGlzLnJvb3QsIFsgdGhpcyBdLmNvbmNhdCggdGhpcy5wYXJhbXMgKSApO1xuXHR9O1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZXhlY3V0ZVRyYW5zaXRpb25fVHJhbnNpdGlvbl9oZWxwZXJzX3ByZWZpeCA9IGZ1bmN0aW9uKCBpc0NsaWVudCwgdmVuZG9ycywgY3JlYXRlRWxlbWVudCApIHtcblxuXHRcdHZhciBwcmVmaXhDYWNoZSwgdGVzdFN0eWxlO1xuXHRcdGlmICggIWlzQ2xpZW50ICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRwcmVmaXhDYWNoZSA9IHt9O1xuXHRcdHRlc3RTdHlsZSA9IGNyZWF0ZUVsZW1lbnQoICdkaXYnICkuc3R5bGU7XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBwcm9wICkge1xuXHRcdFx0dmFyIGksIHZlbmRvciwgY2FwcGVkO1xuXHRcdFx0aWYgKCAhcHJlZml4Q2FjaGVbIHByb3AgXSApIHtcblx0XHRcdFx0aWYgKCB0ZXN0U3R5bGVbIHByb3AgXSAhPT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRcdHByZWZpeENhY2hlWyBwcm9wIF0gPSBwcm9wO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNhcHBlZCA9IHByb3AuY2hhckF0KCAwICkudG9VcHBlckNhc2UoKSArIHByb3Auc3Vic3RyaW5nKCAxICk7XG5cdFx0XHRcdFx0aSA9IHZlbmRvcnMubGVuZ3RoO1xuXHRcdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdFx0dmVuZG9yID0gdmVuZG9yc1sgaSBdO1xuXHRcdFx0XHRcdFx0aWYgKCB0ZXN0U3R5bGVbIHZlbmRvciArIGNhcHBlZCBdICE9PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdFx0XHRcdHByZWZpeENhY2hlWyBwcm9wIF0gPSB2ZW5kb3IgKyBjYXBwZWQ7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHByZWZpeENhY2hlWyBwcm9wIF07XG5cdFx0fTtcblx0fSggY29uZmlnX2lzQ2xpZW50LCBjb25maWdfdmVuZG9ycywgdXRpbHNfY3JlYXRlRWxlbWVudCApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZXhlY3V0ZVRyYW5zaXRpb25fVHJhbnNpdGlvbl9wcm90b3R5cGVfZ2V0U3R5bGUgPSBmdW5jdGlvbiggbGVnYWN5LCBpc0NsaWVudCwgaXNBcnJheSwgcHJlZml4ICkge1xuXG5cdFx0dmFyIGdldENvbXB1dGVkU3R5bGU7XG5cdFx0aWYgKCAhaXNDbGllbnQgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGdldENvbXB1dGVkU3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSB8fCBsZWdhY3kuZ2V0Q29tcHV0ZWRTdHlsZTtcblx0XHRyZXR1cm4gZnVuY3Rpb24oIHByb3BzICkge1xuXHRcdFx0dmFyIGNvbXB1dGVkU3R5bGUsIHN0eWxlcywgaSwgcHJvcCwgdmFsdWU7XG5cdFx0XHRjb21wdXRlZFN0eWxlID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoIHRoaXMubm9kZSApO1xuXHRcdFx0aWYgKCB0eXBlb2YgcHJvcHMgPT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHR2YWx1ZSA9IGNvbXB1dGVkU3R5bGVbIHByZWZpeCggcHJvcHMgKSBdO1xuXHRcdFx0XHRpZiAoIHZhbHVlID09PSAnMHB4JyApIHtcblx0XHRcdFx0XHR2YWx1ZSA9IDA7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhaXNBcnJheSggcHJvcHMgKSApIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnVHJhbnNpdGlvbiNnZXRTdHlsZSBtdXN0IGJlIHBhc3NlZCBhIHN0cmluZywgb3IgYW4gYXJyYXkgb2Ygc3RyaW5ncyByZXByZXNlbnRpbmcgQ1NTIHByb3BlcnRpZXMnICk7XG5cdFx0XHR9XG5cdFx0XHRzdHlsZXMgPSB7fTtcblx0XHRcdGkgPSBwcm9wcy5sZW5ndGg7XG5cdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0cHJvcCA9IHByb3BzWyBpIF07XG5cdFx0XHRcdHZhbHVlID0gY29tcHV0ZWRTdHlsZVsgcHJlZml4KCBwcm9wICkgXTtcblx0XHRcdFx0aWYgKCB2YWx1ZSA9PT0gJzBweCcgKSB7XG5cdFx0XHRcdFx0dmFsdWUgPSAwO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHN0eWxlc1sgcHJvcCBdID0gdmFsdWU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gc3R5bGVzO1xuXHRcdH07XG5cdH0oIGxlZ2FjeSwgY29uZmlnX2lzQ2xpZW50LCB1dGlsc19pc0FycmF5LCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZXhlY3V0ZVRyYW5zaXRpb25fVHJhbnNpdGlvbl9oZWxwZXJzX3ByZWZpeCApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZXhlY3V0ZVRyYW5zaXRpb25fVHJhbnNpdGlvbl9wcm90b3R5cGVfc2V0U3R5bGUgPSBmdW5jdGlvbiggcHJlZml4ICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBzdHlsZSwgdmFsdWUgKSB7XG5cdFx0XHR2YXIgcHJvcDtcblx0XHRcdGlmICggdHlwZW9mIHN0eWxlID09PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0dGhpcy5ub2RlLnN0eWxlWyBwcmVmaXgoIHN0eWxlICkgXSA9IHZhbHVlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Zm9yICggcHJvcCBpbiBzdHlsZSApIHtcblx0XHRcdFx0XHRpZiAoIHN0eWxlLmhhc093blByb3BlcnR5KCBwcm9wICkgKSB7XG5cdFx0XHRcdFx0XHR0aGlzLm5vZGUuc3R5bGVbIHByZWZpeCggcHJvcCApIF0gPSBzdHlsZVsgcHJvcCBdO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fTtcblx0fSggcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2V4ZWN1dGVUcmFuc2l0aW9uX1RyYW5zaXRpb25faGVscGVyc19wcmVmaXggKTtcblxuXHR2YXIgdXRpbHNfY2FtZWxDYXNlID0gZnVuY3Rpb24oIGh5cGhlbmF0ZWRTdHIgKSB7XG5cdFx0cmV0dXJuIGh5cGhlbmF0ZWRTdHIucmVwbGFjZSggLy0oW2EtekEtWl0pL2csIGZ1bmN0aW9uKCBtYXRjaCwgJDEgKSB7XG5cdFx0XHRyZXR1cm4gJDEudG9VcHBlckNhc2UoKTtcblx0XHR9ICk7XG5cdH07XG5cblx0dmFyIHNoYXJlZF9UaWNrZXIgPSBmdW5jdGlvbiggd2FybiwgZ2V0VGltZSwgYW5pbWF0aW9ucyApIHtcblxuXHRcdHZhciBUaWNrZXIgPSBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdHZhciBlYXNpbmc7XG5cdFx0XHR0aGlzLmR1cmF0aW9uID0gb3B0aW9ucy5kdXJhdGlvbjtcblx0XHRcdHRoaXMuc3RlcCA9IG9wdGlvbnMuc3RlcDtcblx0XHRcdHRoaXMuY29tcGxldGUgPSBvcHRpb25zLmNvbXBsZXRlO1xuXHRcdFx0aWYgKCB0eXBlb2Ygb3B0aW9ucy5lYXNpbmcgPT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHRlYXNpbmcgPSBvcHRpb25zLnJvb3QuZWFzaW5nWyBvcHRpb25zLmVhc2luZyBdO1xuXHRcdFx0XHRpZiAoICFlYXNpbmcgKSB7XG5cdFx0XHRcdFx0d2FybiggJ01pc3NpbmcgZWFzaW5nIGZ1bmN0aW9uIChcIicgKyBvcHRpb25zLmVhc2luZyArICdcIikuIFlvdSBtYXkgbmVlZCB0byBkb3dubG9hZCBhIHBsdWdpbiBmcm9tIFtUT0RPXScgKTtcblx0XHRcdFx0XHRlYXNpbmcgPSBsaW5lYXI7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoIHR5cGVvZiBvcHRpb25zLmVhc2luZyA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdFx0ZWFzaW5nID0gb3B0aW9ucy5lYXNpbmc7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRlYXNpbmcgPSBsaW5lYXI7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmVhc2luZyA9IGVhc2luZztcblx0XHRcdHRoaXMuc3RhcnQgPSBnZXRUaW1lKCk7XG5cdFx0XHR0aGlzLmVuZCA9IHRoaXMuc3RhcnQgKyB0aGlzLmR1cmF0aW9uO1xuXHRcdFx0dGhpcy5ydW5uaW5nID0gdHJ1ZTtcblx0XHRcdGFuaW1hdGlvbnMuYWRkKCB0aGlzICk7XG5cdFx0fTtcblx0XHRUaWNrZXIucHJvdG90eXBlID0ge1xuXHRcdFx0dGljazogZnVuY3Rpb24oIG5vdyApIHtcblx0XHRcdFx0dmFyIGVsYXBzZWQsIGVhc2VkO1xuXHRcdFx0XHRpZiAoICF0aGlzLnJ1bm5pbmcgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggbm93ID4gdGhpcy5lbmQgKSB7XG5cdFx0XHRcdFx0aWYgKCB0aGlzLnN0ZXAgKSB7XG5cdFx0XHRcdFx0XHR0aGlzLnN0ZXAoIDEgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCB0aGlzLmNvbXBsZXRlICkge1xuXHRcdFx0XHRcdFx0dGhpcy5jb21wbGV0ZSggMSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxhcHNlZCA9IG5vdyAtIHRoaXMuc3RhcnQ7XG5cdFx0XHRcdGVhc2VkID0gdGhpcy5lYXNpbmcoIGVsYXBzZWQgLyB0aGlzLmR1cmF0aW9uICk7XG5cdFx0XHRcdGlmICggdGhpcy5zdGVwICkge1xuXHRcdFx0XHRcdHRoaXMuc3RlcCggZWFzZWQgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH0sXG5cdFx0XHRzdG9wOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0aWYgKCB0aGlzLmFib3J0ICkge1xuXHRcdFx0XHRcdHRoaXMuYWJvcnQoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLnJ1bm5pbmcgPSBmYWxzZTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBUaWNrZXI7XG5cblx0XHRmdW5jdGlvbiBsaW5lYXIoIHQgKSB7XG5cdFx0XHRyZXR1cm4gdDtcblx0XHR9XG5cdH0oIHV0aWxzX3dhcm4sIHV0aWxzX2dldFRpbWUsIHNoYXJlZF9hbmltYXRpb25zICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9leGVjdXRlVHJhbnNpdGlvbl9UcmFuc2l0aW9uX2hlbHBlcnNfdW5wcmVmaXggPSBmdW5jdGlvbiggdmVuZG9ycyApIHtcblxuXHRcdHZhciB1bnByZWZpeFBhdHRlcm4gPSBuZXcgUmVnRXhwKCAnXi0oPzonICsgdmVuZG9ycy5qb2luKCAnfCcgKSArICcpLScgKTtcblx0XHRyZXR1cm4gZnVuY3Rpb24oIHByb3AgKSB7XG5cdFx0XHRyZXR1cm4gcHJvcC5yZXBsYWNlKCB1bnByZWZpeFBhdHRlcm4sICcnICk7XG5cdFx0fTtcblx0fSggY29uZmlnX3ZlbmRvcnMgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2V4ZWN1dGVUcmFuc2l0aW9uX1RyYW5zaXRpb25faGVscGVyc19oeXBoZW5hdGUgPSBmdW5jdGlvbiggdmVuZG9ycyApIHtcblxuXHRcdHZhciB2ZW5kb3JQYXR0ZXJuID0gbmV3IFJlZ0V4cCggJ14oPzonICsgdmVuZG9ycy5qb2luKCAnfCcgKSArICcpKFtBLVpdKScgKTtcblx0XHRyZXR1cm4gZnVuY3Rpb24oIHN0ciApIHtcblx0XHRcdHZhciBoeXBoZW5hdGVkO1xuXHRcdFx0aWYgKCAhc3RyICkge1xuXHRcdFx0XHRyZXR1cm4gJyc7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHZlbmRvclBhdHRlcm4udGVzdCggc3RyICkgKSB7XG5cdFx0XHRcdHN0ciA9ICctJyArIHN0cjtcblx0XHRcdH1cblx0XHRcdGh5cGhlbmF0ZWQgPSBzdHIucmVwbGFjZSggL1tBLVpdL2csIGZ1bmN0aW9uKCBtYXRjaCApIHtcblx0XHRcdFx0cmV0dXJuICctJyArIG1hdGNoLnRvTG93ZXJDYXNlKCk7XG5cdFx0XHR9ICk7XG5cdFx0XHRyZXR1cm4gaHlwaGVuYXRlZDtcblx0XHR9O1xuXHR9KCBjb25maWdfdmVuZG9ycyApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZXhlY3V0ZVRyYW5zaXRpb25fVHJhbnNpdGlvbl9wcm90b3R5cGVfYW5pbWF0ZVN0eWxlX2NyZWF0ZVRyYW5zaXRpb25zID0gZnVuY3Rpb24oIGlzQ2xpZW50LCB3YXJuLCBjcmVhdGVFbGVtZW50LCBjYW1lbENhc2UsIGludGVycG9sYXRlLCBUaWNrZXIsIHByZWZpeCwgdW5wcmVmaXgsIGh5cGhlbmF0ZSApIHtcblxuXHRcdHZhciB0ZXN0U3R5bGUsIFRSQU5TSVRJT04sIFRSQU5TSVRJT05FTkQsIENTU19UUkFOU0lUSU9OU19FTkFCTEVELCBUUkFOU0lUSU9OX0RVUkFUSU9OLCBUUkFOU0lUSU9OX1BST1BFUlRZLCBUUkFOU0lUSU9OX1RJTUlOR19GVU5DVElPTiwgY2FuVXNlQ3NzVHJhbnNpdGlvbnMgPSB7fSwgY2Fubm90VXNlQ3NzVHJhbnNpdGlvbnMgPSB7fTtcblx0XHRpZiAoICFpc0NsaWVudCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGVzdFN0eWxlID0gY3JlYXRlRWxlbWVudCggJ2RpdicgKS5zdHlsZTtcblx0XHQoIGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYgKCB0ZXN0U3R5bGUudHJhbnNpdGlvbiAhPT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRUUkFOU0lUSU9OID0gJ3RyYW5zaXRpb24nO1xuXHRcdFx0XHRUUkFOU0lUSU9ORU5EID0gJ3RyYW5zaXRpb25lbmQnO1xuXHRcdFx0XHRDU1NfVFJBTlNJVElPTlNfRU5BQkxFRCA9IHRydWU7XG5cdFx0XHR9IGVsc2UgaWYgKCB0ZXN0U3R5bGUud2Via2l0VHJhbnNpdGlvbiAhPT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRUUkFOU0lUSU9OID0gJ3dlYmtpdFRyYW5zaXRpb24nO1xuXHRcdFx0XHRUUkFOU0lUSU9ORU5EID0gJ3dlYmtpdFRyYW5zaXRpb25FbmQnO1xuXHRcdFx0XHRDU1NfVFJBTlNJVElPTlNfRU5BQkxFRCA9IHRydWU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRDU1NfVFJBTlNJVElPTlNfRU5BQkxFRCA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH0oKSApO1xuXHRcdGlmICggVFJBTlNJVElPTiApIHtcblx0XHRcdFRSQU5TSVRJT05fRFVSQVRJT04gPSBUUkFOU0lUSU9OICsgJ0R1cmF0aW9uJztcblx0XHRcdFRSQU5TSVRJT05fUFJPUEVSVFkgPSBUUkFOU0lUSU9OICsgJ1Byb3BlcnR5Jztcblx0XHRcdFRSQU5TSVRJT05fVElNSU5HX0ZVTkNUSU9OID0gVFJBTlNJVElPTiArICdUaW1pbmdGdW5jdGlvbic7XG5cdFx0fVxuXHRcdHJldHVybiBmdW5jdGlvbiggdCwgdG8sIG9wdGlvbnMsIGNoYW5nZWRQcm9wZXJ0aWVzLCB0cmFuc2l0aW9uRW5kSGFuZGxlciwgcmVzb2x2ZSApIHtcblx0XHRcdHNldFRpbWVvdXQoIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgaGFzaFByZWZpeCwganNUcmFuc2l0aW9uc0NvbXBsZXRlLCBjc3NUcmFuc2l0aW9uc0NvbXBsZXRlLCBjaGVja0NvbXBsZXRlO1xuXHRcdFx0XHRjaGVja0NvbXBsZXRlID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0aWYgKCBqc1RyYW5zaXRpb25zQ29tcGxldGUgJiYgY3NzVHJhbnNpdGlvbnNDb21wbGV0ZSApIHtcblx0XHRcdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cdFx0XHRcdGhhc2hQcmVmaXggPSB0Lm5vZGUubmFtZXNwYWNlVVJJICsgdC5ub2RlLnRhZ05hbWU7XG5cdFx0XHRcdHQubm9kZS5zdHlsZVsgVFJBTlNJVElPTl9QUk9QRVJUWSBdID0gY2hhbmdlZFByb3BlcnRpZXMubWFwKCBwcmVmaXggKS5tYXAoIGh5cGhlbmF0ZSApLmpvaW4oICcsJyApO1xuXHRcdFx0XHR0Lm5vZGUuc3R5bGVbIFRSQU5TSVRJT05fVElNSU5HX0ZVTkNUSU9OIF0gPSBoeXBoZW5hdGUoIG9wdGlvbnMuZWFzaW5nIHx8ICdsaW5lYXInICk7XG5cdFx0XHRcdHQubm9kZS5zdHlsZVsgVFJBTlNJVElPTl9EVVJBVElPTiBdID0gb3B0aW9ucy5kdXJhdGlvbiAvIDEwMDAgKyAncyc7XG5cdFx0XHRcdHRyYW5zaXRpb25FbmRIYW5kbGVyID0gZnVuY3Rpb24oIGV2ZW50ICkge1xuXHRcdFx0XHRcdHZhciBpbmRleDtcblx0XHRcdFx0XHRpbmRleCA9IGNoYW5nZWRQcm9wZXJ0aWVzLmluZGV4T2YoIGNhbWVsQ2FzZSggdW5wcmVmaXgoIGV2ZW50LnByb3BlcnR5TmFtZSApICkgKTtcblx0XHRcdFx0XHRpZiAoIGluZGV4ICE9PSAtMSApIHtcblx0XHRcdFx0XHRcdGNoYW5nZWRQcm9wZXJ0aWVzLnNwbGljZSggaW5kZXgsIDEgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCBjaGFuZ2VkUHJvcGVydGllcy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHQucm9vdC5maXJlKCB0Lm5hbWUgKyAnOmVuZCcgKTtcblx0XHRcdFx0XHR0Lm5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciggVFJBTlNJVElPTkVORCwgdHJhbnNpdGlvbkVuZEhhbmRsZXIsIGZhbHNlICk7XG5cdFx0XHRcdFx0Y3NzVHJhbnNpdGlvbnNDb21wbGV0ZSA9IHRydWU7XG5cdFx0XHRcdFx0Y2hlY2tDb21wbGV0ZSgpO1xuXHRcdFx0XHR9O1xuXHRcdFx0XHR0Lm5vZGUuYWRkRXZlbnRMaXN0ZW5lciggVFJBTlNJVElPTkVORCwgdHJhbnNpdGlvbkVuZEhhbmRsZXIsIGZhbHNlICk7XG5cdFx0XHRcdHNldFRpbWVvdXQoIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdHZhciBpID0gY2hhbmdlZFByb3BlcnRpZXMubGVuZ3RoLFxuXHRcdFx0XHRcdFx0aGFzaCwgb3JpZ2luYWxWYWx1ZSwgaW5kZXgsIHByb3BlcnRpZXNUb1RyYW5zaXRpb25JbkpzID0gW10sXG5cdFx0XHRcdFx0XHRwcm9wO1xuXHRcdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdFx0cHJvcCA9IGNoYW5nZWRQcm9wZXJ0aWVzWyBpIF07XG5cdFx0XHRcdFx0XHRoYXNoID0gaGFzaFByZWZpeCArIHByb3A7XG5cdFx0XHRcdFx0XHRpZiAoIGNhblVzZUNzc1RyYW5zaXRpb25zWyBoYXNoIF0gKSB7XG5cdFx0XHRcdFx0XHRcdHQubm9kZS5zdHlsZVsgcHJlZml4KCBwcm9wICkgXSA9IHRvWyBwcm9wIF07XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRvcmlnaW5hbFZhbHVlID0gdC5nZXRTdHlsZSggcHJvcCApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKCBjYW5Vc2VDc3NUcmFuc2l0aW9uc1sgaGFzaCBdID09PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdFx0XHRcdHQubm9kZS5zdHlsZVsgcHJlZml4KCBwcm9wICkgXSA9IHRvWyBwcm9wIF07XG5cdFx0XHRcdFx0XHRcdGNhblVzZUNzc1RyYW5zaXRpb25zWyBoYXNoIF0gPSB0LmdldFN0eWxlKCBwcm9wICkgIT0gdG9bIHByb3AgXTtcblx0XHRcdFx0XHRcdFx0Y2Fubm90VXNlQ3NzVHJhbnNpdGlvbnNbIGhhc2ggXSA9ICFjYW5Vc2VDc3NUcmFuc2l0aW9uc1sgaGFzaCBdO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKCBjYW5ub3RVc2VDc3NUcmFuc2l0aW9uc1sgaGFzaCBdICkge1xuXHRcdFx0XHRcdFx0XHRpbmRleCA9IGNoYW5nZWRQcm9wZXJ0aWVzLmluZGV4T2YoIHByb3AgKTtcblx0XHRcdFx0XHRcdFx0aWYgKCBpbmRleCA9PT0gLTEgKSB7XG5cdFx0XHRcdFx0XHRcdFx0d2FybiggJ1NvbWV0aGluZyB2ZXJ5IHN0cmFuZ2UgaGFwcGVuZWQgd2l0aCB0cmFuc2l0aW9ucy4gSWYgeW91IHNlZSB0aGlzIG1lc3NhZ2UsIHBsZWFzZSBsZXQgQFJhY3RpdmVKUyBrbm93LiBUaGFua3MhJyApO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdGNoYW5nZWRQcm9wZXJ0aWVzLnNwbGljZSggaW5kZXgsIDEgKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR0Lm5vZGUuc3R5bGVbIHByZWZpeCggcHJvcCApIF0gPSBvcmlnaW5hbFZhbHVlO1xuXHRcdFx0XHRcdFx0XHRwcm9wZXJ0aWVzVG9UcmFuc2l0aW9uSW5Kcy5wdXNoKCB7XG5cdFx0XHRcdFx0XHRcdFx0bmFtZTogcHJlZml4KCBwcm9wICksXG5cdFx0XHRcdFx0XHRcdFx0aW50ZXJwb2xhdG9yOiBpbnRlcnBvbGF0ZSggb3JpZ2luYWxWYWx1ZSwgdG9bIHByb3AgXSApXG5cdFx0XHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCBwcm9wZXJ0aWVzVG9UcmFuc2l0aW9uSW5Kcy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0XHRuZXcgVGlja2VyKCB7XG5cdFx0XHRcdFx0XHRcdHJvb3Q6IHQucm9vdCxcblx0XHRcdFx0XHRcdFx0ZHVyYXRpb246IG9wdGlvbnMuZHVyYXRpb24sXG5cdFx0XHRcdFx0XHRcdGVhc2luZzogY2FtZWxDYXNlKCBvcHRpb25zLmVhc2luZyApLFxuXHRcdFx0XHRcdFx0XHRzdGVwOiBmdW5jdGlvbiggcG9zICkge1xuXHRcdFx0XHRcdFx0XHRcdHZhciBwcm9wLCBpO1xuXHRcdFx0XHRcdFx0XHRcdGkgPSBwcm9wZXJ0aWVzVG9UcmFuc2l0aW9uSW5Kcy5sZW5ndGg7XG5cdFx0XHRcdFx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRwcm9wID0gcHJvcGVydGllc1RvVHJhbnNpdGlvbkluSnNbIGkgXTtcblx0XHRcdFx0XHRcdFx0XHRcdHQubm9kZS5zdHlsZVsgcHJvcC5uYW1lIF0gPSBwcm9wLmludGVycG9sYXRvciggcG9zICk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRjb21wbGV0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRcdFx0anNUcmFuc2l0aW9uc0NvbXBsZXRlID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0XHRjaGVja0NvbXBsZXRlKCk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0anNUcmFuc2l0aW9uc0NvbXBsZXRlID0gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCAhY2hhbmdlZFByb3BlcnRpZXMubGVuZ3RoICkge1xuXHRcdFx0XHRcdFx0dC5ub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoIFRSQU5TSVRJT05FTkQsIHRyYW5zaXRpb25FbmRIYW5kbGVyLCBmYWxzZSApO1xuXHRcdFx0XHRcdFx0Y3NzVHJhbnNpdGlvbnNDb21wbGV0ZSA9IHRydWU7XG5cdFx0XHRcdFx0XHRjaGVja0NvbXBsZXRlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LCAwICk7XG5cdFx0XHR9LCBvcHRpb25zLmRlbGF5IHx8IDAgKTtcblx0XHR9O1xuXHR9KCBjb25maWdfaXNDbGllbnQsIHV0aWxzX3dhcm4sIHV0aWxzX2NyZWF0ZUVsZW1lbnQsIHV0aWxzX2NhbWVsQ2FzZSwgc2hhcmVkX2ludGVycG9sYXRlLCBzaGFyZWRfVGlja2VyLCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZXhlY3V0ZVRyYW5zaXRpb25fVHJhbnNpdGlvbl9oZWxwZXJzX3ByZWZpeCwgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2V4ZWN1dGVUcmFuc2l0aW9uX1RyYW5zaXRpb25faGVscGVyc191bnByZWZpeCwgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2V4ZWN1dGVUcmFuc2l0aW9uX1RyYW5zaXRpb25faGVscGVyc19oeXBoZW5hdGUgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2V4ZWN1dGVUcmFuc2l0aW9uX1RyYW5zaXRpb25fcHJvdG90eXBlX2FuaW1hdGVTdHlsZV9fYW5pbWF0ZVN0eWxlID0gZnVuY3Rpb24oIGxlZ2FjeSwgaXNDbGllbnQsIHdhcm4sIFByb21pc2UsIHByZWZpeCwgY3JlYXRlVHJhbnNpdGlvbnMgKSB7XG5cblx0XHR2YXIgZ2V0Q29tcHV0ZWRTdHlsZTtcblx0XHRpZiAoICFpc0NsaWVudCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Z2V0Q29tcHV0ZWRTdHlsZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlIHx8IGxlZ2FjeS5nZXRDb21wdXRlZFN0eWxlO1xuXHRcdHJldHVybiBmdW5jdGlvbiggc3R5bGUsIHZhbHVlLCBvcHRpb25zLCBjb21wbGV0ZSApIHtcblx0XHRcdHZhciB0ID0gdGhpcyxcblx0XHRcdFx0dG87XG5cdFx0XHRpZiAoIHR5cGVvZiBzdHlsZSA9PT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdHRvID0ge307XG5cdFx0XHRcdHRvWyBzdHlsZSBdID0gdmFsdWU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0byA9IHN0eWxlO1xuXHRcdFx0XHRjb21wbGV0ZSA9IG9wdGlvbnM7XG5cdFx0XHRcdG9wdGlvbnMgPSB2YWx1ZTtcblx0XHRcdH1cblx0XHRcdGlmICggIW9wdGlvbnMgKSB7XG5cdFx0XHRcdHdhcm4oICdUaGUgXCInICsgdC5uYW1lICsgJ1wiIHRyYW5zaXRpb24gZG9lcyBub3Qgc3VwcGx5IGFuIG9wdGlvbnMgb2JqZWN0IHRvIGB0LmFuaW1hdGVTdHlsZSgpYC4gVGhpcyB3aWxsIGJyZWFrIGluIGEgZnV0dXJlIHZlcnNpb24gb2YgUmFjdGl2ZS4gRm9yIG1vcmUgaW5mbyBzZWUgaHR0cHM6Ly9naXRodWIuY29tL1JhY3RpdmVKUy9SYWN0aXZlL2lzc3Vlcy8zNDAnICk7XG5cdFx0XHRcdG9wdGlvbnMgPSB0O1xuXHRcdFx0XHRjb21wbGV0ZSA9IHQuY29tcGxldGU7XG5cdFx0XHR9XG5cdFx0XHR2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKCBmdW5jdGlvbiggcmVzb2x2ZSApIHtcblx0XHRcdFx0dmFyIHByb3BlcnR5TmFtZXMsIGNoYW5nZWRQcm9wZXJ0aWVzLCBjb21wdXRlZFN0eWxlLCBjdXJyZW50LCBmcm9tLCB0cmFuc2l0aW9uRW5kSGFuZGxlciwgaSwgcHJvcDtcblx0XHRcdFx0aWYgKCAhb3B0aW9ucy5kdXJhdGlvbiApIHtcblx0XHRcdFx0XHR0LnNldFN0eWxlKCB0byApO1xuXHRcdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0cHJvcGVydHlOYW1lcyA9IE9iamVjdC5rZXlzKCB0byApO1xuXHRcdFx0XHRjaGFuZ2VkUHJvcGVydGllcyA9IFtdO1xuXHRcdFx0XHRjb21wdXRlZFN0eWxlID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoIHQubm9kZSApO1xuXHRcdFx0XHRmcm9tID0ge307XG5cdFx0XHRcdGkgPSBwcm9wZXJ0eU5hbWVzLmxlbmd0aDtcblx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0cHJvcCA9IHByb3BlcnR5TmFtZXNbIGkgXTtcblx0XHRcdFx0XHRjdXJyZW50ID0gY29tcHV0ZWRTdHlsZVsgcHJlZml4KCBwcm9wICkgXTtcblx0XHRcdFx0XHRpZiAoIGN1cnJlbnQgPT09ICcwcHgnICkge1xuXHRcdFx0XHRcdFx0Y3VycmVudCA9IDA7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICggY3VycmVudCAhPSB0b1sgcHJvcCBdICkge1xuXHRcdFx0XHRcdFx0Y2hhbmdlZFByb3BlcnRpZXMucHVzaCggcHJvcCApO1xuXHRcdFx0XHRcdFx0dC5ub2RlLnN0eWxlWyBwcmVmaXgoIHByb3AgKSBdID0gY3VycmVudDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCAhY2hhbmdlZFByb3BlcnRpZXMubGVuZ3RoICkge1xuXHRcdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Y3JlYXRlVHJhbnNpdGlvbnMoIHQsIHRvLCBvcHRpb25zLCBjaGFuZ2VkUHJvcGVydGllcywgdHJhbnNpdGlvbkVuZEhhbmRsZXIsIHJlc29sdmUgKTtcblx0XHRcdH0gKTtcblx0XHRcdGlmICggY29tcGxldGUgKSB7XG5cdFx0XHRcdHdhcm4oICd0LmFuaW1hdGVTdHlsZSByZXR1cm5zIGEgUHJvbWlzZSBhcyBvZiAwLjQuMC4gVHJhbnNpdGlvbiBhdXRob3JzIHNob3VsZCBkbyB0LmFuaW1hdGVTdHlsZSguLi4pLnRoZW4oY2FsbGJhY2spJyApO1xuXHRcdFx0XHRwcm9taXNlLnRoZW4oIGNvbXBsZXRlICk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcHJvbWlzZTtcblx0XHR9O1xuXHR9KCBsZWdhY3ksIGNvbmZpZ19pc0NsaWVudCwgdXRpbHNfd2FybiwgdXRpbHNfUHJvbWlzZSwgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2V4ZWN1dGVUcmFuc2l0aW9uX1RyYW5zaXRpb25faGVscGVyc19wcmVmaXgsIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9leGVjdXRlVHJhbnNpdGlvbl9UcmFuc2l0aW9uX3Byb3RvdHlwZV9hbmltYXRlU3R5bGVfY3JlYXRlVHJhbnNpdGlvbnMgKTtcblxuXHR2YXIgdXRpbHNfZmlsbEdhcHMgPSBmdW5jdGlvbiggdGFyZ2V0LCBzb3VyY2UgKSB7XG5cdFx0dmFyIGtleTtcblx0XHRmb3IgKCBrZXkgaW4gc291cmNlICkge1xuXHRcdFx0aWYgKCBzb3VyY2UuaGFzT3duUHJvcGVydHkoIGtleSApICYmICEoIGtleSBpbiB0YXJnZXQgKSApIHtcblx0XHRcdFx0dGFyZ2V0WyBrZXkgXSA9IHNvdXJjZVsga2V5IF07XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB0YXJnZXQ7XG5cdH07XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9leGVjdXRlVHJhbnNpdGlvbl9UcmFuc2l0aW9uX3Byb3RvdHlwZV9wcm9jZXNzUGFyYW1zID0gZnVuY3Rpb24oIGZpbGxHYXBzICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBwYXJhbXMsIGRlZmF1bHRzICkge1xuXHRcdFx0aWYgKCB0eXBlb2YgcGFyYW1zID09PSAnbnVtYmVyJyApIHtcblx0XHRcdFx0cGFyYW1zID0ge1xuXHRcdFx0XHRcdGR1cmF0aW9uOiBwYXJhbXNcblx0XHRcdFx0fTtcblx0XHRcdH0gZWxzZSBpZiAoIHR5cGVvZiBwYXJhbXMgPT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHRpZiAoIHBhcmFtcyA9PT0gJ3Nsb3cnICkge1xuXHRcdFx0XHRcdHBhcmFtcyA9IHtcblx0XHRcdFx0XHRcdGR1cmF0aW9uOiA2MDBcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9IGVsc2UgaWYgKCBwYXJhbXMgPT09ICdmYXN0JyApIHtcblx0XHRcdFx0XHRwYXJhbXMgPSB7XG5cdFx0XHRcdFx0XHRkdXJhdGlvbjogMjAwXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRwYXJhbXMgPSB7XG5cdFx0XHRcdFx0XHRkdXJhdGlvbjogNDAwXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmICggIXBhcmFtcyApIHtcblx0XHRcdFx0cGFyYW1zID0ge307XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmlsbEdhcHMoIHBhcmFtcywgZGVmYXVsdHMgKTtcblx0XHR9O1xuXHR9KCB1dGlsc19maWxsR2FwcyApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZXhlY3V0ZVRyYW5zaXRpb25fVHJhbnNpdGlvbl9wcm90b3R5cGVfcmVzZXRTdHlsZSA9IGZ1bmN0aW9uKCkge1xuXHRcdGlmICggdGhpcy5vcmlnaW5hbFN0eWxlICkge1xuXHRcdFx0dGhpcy5ub2RlLnNldEF0dHJpYnV0ZSggJ3N0eWxlJywgdGhpcy5vcmlnaW5hbFN0eWxlICk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubm9kZS5nZXRBdHRyaWJ1dGUoICdzdHlsZScgKTtcblx0XHRcdHRoaXMubm9kZS5yZW1vdmVBdHRyaWJ1dGUoICdzdHlsZScgKTtcblx0XHR9XG5cdH07XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9leGVjdXRlVHJhbnNpdGlvbl9UcmFuc2l0aW9uX19UcmFuc2l0aW9uID0gZnVuY3Rpb24oIHdhcm4sIFN0cmluZ0ZyYWdtZW50LCBpbml0LCBnZXRTdHlsZSwgc2V0U3R5bGUsIGFuaW1hdGVTdHlsZSwgcHJvY2Vzc1BhcmFtcywgcmVzZXRTdHlsZSApIHtcblxuXHRcdHZhciBUcmFuc2l0aW9uO1xuXHRcdFRyYW5zaXRpb24gPSBmdW5jdGlvbiggZGVzY3JpcHRvciwgcm9vdCwgb3duZXIsIGlzSW50cm8gKSB7XG5cdFx0XHR2YXIgdCA9IHRoaXMsXG5cdFx0XHRcdG5hbWUsIGZyYWdtZW50LCBlcnJvck1lc3NhZ2U7XG5cdFx0XHR0aGlzLnJvb3QgPSByb290O1xuXHRcdFx0dGhpcy5ub2RlID0gb3duZXIubm9kZTtcblx0XHRcdHRoaXMuaXNJbnRybyA9IGlzSW50cm87XG5cdFx0XHR0aGlzLm9yaWdpbmFsU3R5bGUgPSB0aGlzLm5vZGUuZ2V0QXR0cmlidXRlKCAnc3R5bGUnICk7XG5cdFx0XHR0LmNvbXBsZXRlID0gZnVuY3Rpb24oIG5vUmVzZXQgKSB7XG5cdFx0XHRcdGlmICggIW5vUmVzZXQgJiYgdC5pc0ludHJvICkge1xuXHRcdFx0XHRcdHQucmVzZXRTdHlsZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHQubm9kZS5fcmFjdGl2ZS50cmFuc2l0aW9uID0gbnVsbDtcblx0XHRcdFx0dC5fbWFuYWdlci5yZW1vdmUoIHQgKTtcblx0XHRcdH07XG5cdFx0XHRuYW1lID0gZGVzY3JpcHRvci5uIHx8IGRlc2NyaXB0b3I7XG5cdFx0XHRpZiAoIHR5cGVvZiBuYW1lICE9PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0ZnJhZ21lbnQgPSBuZXcgU3RyaW5nRnJhZ21lbnQoIHtcblx0XHRcdFx0XHRkZXNjcmlwdG9yOiBuYW1lLFxuXHRcdFx0XHRcdHJvb3Q6IHRoaXMucm9vdCxcblx0XHRcdFx0XHRvd25lcjogb3duZXJcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRuYW1lID0gZnJhZ21lbnQudG9TdHJpbmcoKTtcblx0XHRcdFx0ZnJhZ21lbnQudGVhcmRvd24oKTtcblx0XHRcdH1cblx0XHRcdHRoaXMubmFtZSA9IG5hbWU7XG5cdFx0XHRpZiAoIGRlc2NyaXB0b3IuYSApIHtcblx0XHRcdFx0dGhpcy5wYXJhbXMgPSBkZXNjcmlwdG9yLmE7XG5cdFx0XHR9IGVsc2UgaWYgKCBkZXNjcmlwdG9yLmQgKSB7XG5cdFx0XHRcdGZyYWdtZW50ID0gbmV3IFN0cmluZ0ZyYWdtZW50KCB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRvcjogZGVzY3JpcHRvci5kLFxuXHRcdFx0XHRcdHJvb3Q6IHRoaXMucm9vdCxcblx0XHRcdFx0XHRvd25lcjogb3duZXJcblx0XHRcdFx0fSApO1xuXHRcdFx0XHR0aGlzLnBhcmFtcyA9IGZyYWdtZW50LnRvQXJnc0xpc3QoKTtcblx0XHRcdFx0ZnJhZ21lbnQudGVhcmRvd24oKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX2ZuID0gcm9vdC50cmFuc2l0aW9uc1sgbmFtZSBdO1xuXHRcdFx0aWYgKCAhdGhpcy5fZm4gKSB7XG5cdFx0XHRcdGVycm9yTWVzc2FnZSA9ICdNaXNzaW5nIFwiJyArIG5hbWUgKyAnXCIgdHJhbnNpdGlvbi4gWW91IG1heSBuZWVkIHRvIGRvd25sb2FkIGEgcGx1Z2luIHZpYSBodHRwOi8vZG9jcy5yYWN0aXZlanMub3JnL2xhdGVzdC9wbHVnaW5zI3RyYW5zaXRpb25zJztcblx0XHRcdFx0aWYgKCByb290LmRlYnVnICkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggZXJyb3JNZXNzYWdlICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0d2FybiggZXJyb3JNZXNzYWdlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0VHJhbnNpdGlvbi5wcm90b3R5cGUgPSB7XG5cdFx0XHRpbml0OiBpbml0LFxuXHRcdFx0Z2V0U3R5bGU6IGdldFN0eWxlLFxuXHRcdFx0c2V0U3R5bGU6IHNldFN0eWxlLFxuXHRcdFx0YW5pbWF0ZVN0eWxlOiBhbmltYXRlU3R5bGUsXG5cdFx0XHRwcm9jZXNzUGFyYW1zOiBwcm9jZXNzUGFyYW1zLFxuXHRcdFx0cmVzZXRTdHlsZTogcmVzZXRTdHlsZVxuXHRcdH07XG5cdFx0cmV0dXJuIFRyYW5zaXRpb247XG5cdH0oIHV0aWxzX3dhcm4sIHJlbmRlcl9TdHJpbmdGcmFnbWVudF9fU3RyaW5nRnJhZ21lbnQsIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9leGVjdXRlVHJhbnNpdGlvbl9UcmFuc2l0aW9uX3Byb3RvdHlwZV9pbml0LCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZXhlY3V0ZVRyYW5zaXRpb25fVHJhbnNpdGlvbl9wcm90b3R5cGVfZ2V0U3R5bGUsIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9leGVjdXRlVHJhbnNpdGlvbl9UcmFuc2l0aW9uX3Byb3RvdHlwZV9zZXRTdHlsZSwgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2V4ZWN1dGVUcmFuc2l0aW9uX1RyYW5zaXRpb25fcHJvdG90eXBlX2FuaW1hdGVTdHlsZV9fYW5pbWF0ZVN0eWxlLCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZXhlY3V0ZVRyYW5zaXRpb25fVHJhbnNpdGlvbl9wcm90b3R5cGVfcHJvY2Vzc1BhcmFtcywgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2V4ZWN1dGVUcmFuc2l0aW9uX1RyYW5zaXRpb25fcHJvdG90eXBlX3Jlc2V0U3R5bGUgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfc2hhcmVkX2V4ZWN1dGVUcmFuc2l0aW9uX19leGVjdXRlVHJhbnNpdGlvbiA9IGZ1bmN0aW9uKCBydW5sb29wLCBUcmFuc2l0aW9uICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBkZXNjcmlwdG9yLCByYWN0aXZlLCBvd25lciwgaXNJbnRybyApIHtcblx0XHRcdHZhciB0cmFuc2l0aW9uLCBub2RlLCBvbGRUcmFuc2l0aW9uO1xuXHRcdFx0aWYgKCAhcmFjdGl2ZS50cmFuc2l0aW9uc0VuYWJsZWQgfHwgcmFjdGl2ZS5fcGFyZW50ICYmICFyYWN0aXZlLl9wYXJlbnQudHJhbnNpdGlvbnNFbmFibGVkICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0cmFuc2l0aW9uID0gbmV3IFRyYW5zaXRpb24oIGRlc2NyaXB0b3IsIHJhY3RpdmUsIG93bmVyLCBpc0ludHJvICk7XG5cdFx0XHRpZiAoIHRyYW5zaXRpb24uX2ZuICkge1xuXHRcdFx0XHRub2RlID0gdHJhbnNpdGlvbi5ub2RlO1xuXHRcdFx0XHRpZiAoIG9sZFRyYW5zaXRpb24gPSBub2RlLl9yYWN0aXZlLnRyYW5zaXRpb24gKSB7XG5cdFx0XHRcdFx0b2xkVHJhbnNpdGlvbi5jb21wbGV0ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdG5vZGUuX3JhY3RpdmUudHJhbnNpdGlvbiA9IHRyYW5zaXRpb247XG5cdFx0XHRcdHJ1bmxvb3AuYWRkVHJhbnNpdGlvbiggdHJhbnNpdGlvbiApO1xuXHRcdFx0fVxuXHRcdH07XG5cdH0oIGdsb2JhbF9ydW5sb29wLCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9zaGFyZWRfZXhlY3V0ZVRyYW5zaXRpb25fVHJhbnNpdGlvbl9fVHJhbnNpdGlvbiApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9pbml0aWFsaXNlX19pbml0aWFsaXNlID0gZnVuY3Rpb24oIHJ1bmxvb3AsIHR5cGVzLCBuYW1lc3BhY2VzLCBjcmVhdGUsIGRlZmluZVByb3BlcnR5LCB3YXJuLCBjcmVhdGVFbGVtZW50LCBnZXRJbm5lckNvbnRleHQsIGdldEVsZW1lbnROYW1lc3BhY2UsIGNyZWF0ZUVsZW1lbnRBdHRyaWJ1dGVzLCBhcHBlbmRFbGVtZW50Q2hpbGRyZW4sIGRlY29yYXRlLCBhZGRFdmVudFByb3hpZXMsIHVwZGF0ZUxpdmVRdWVyaWVzLCBleGVjdXRlVHJhbnNpdGlvbiwgZW5mb3JjZUNhc2UgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24gaW5pdGlhbGlzZUVsZW1lbnQoIGVsZW1lbnQsIG9wdGlvbnMsIGRvY0ZyYWcgKSB7XG5cdFx0XHR2YXIgcGFyZW50RnJhZ21lbnQsIHBOb2RlLCBkZXNjcmlwdG9yLCBuYW1lc3BhY2UsIG5hbWUsIGF0dHJpYnV0ZXMsIHdpZHRoLCBoZWlnaHQsIGxvYWRIYW5kbGVyLCByb290LCBzZWxlY3RCaW5kaW5nLCBlcnJvck1lc3NhZ2U7XG5cdFx0XHRlbGVtZW50LnR5cGUgPSB0eXBlcy5FTEVNRU5UO1xuXHRcdFx0cGFyZW50RnJhZ21lbnQgPSBlbGVtZW50LnBhcmVudEZyYWdtZW50ID0gb3B0aW9ucy5wYXJlbnRGcmFnbWVudDtcblx0XHRcdHBOb2RlID0gcGFyZW50RnJhZ21lbnQucE5vZGU7XG5cdFx0XHRkZXNjcmlwdG9yID0gZWxlbWVudC5kZXNjcmlwdG9yID0gb3B0aW9ucy5kZXNjcmlwdG9yO1xuXHRcdFx0ZWxlbWVudC5wYXJlbnQgPSBvcHRpb25zLnBFbGVtZW50O1xuXHRcdFx0ZWxlbWVudC5yb290ID0gcm9vdCA9IHBhcmVudEZyYWdtZW50LnJvb3Q7XG5cdFx0XHRlbGVtZW50LmluZGV4ID0gb3B0aW9ucy5pbmRleDtcblx0XHRcdGVsZW1lbnQubGNOYW1lID0gZGVzY3JpcHRvci5lLnRvTG93ZXJDYXNlKCk7XG5cdFx0XHRlbGVtZW50LmV2ZW50TGlzdGVuZXJzID0gW107XG5cdFx0XHRlbGVtZW50LmN1c3RvbUV2ZW50TGlzdGVuZXJzID0gW107XG5cdFx0XHRlbGVtZW50LmNzc0RldGFjaFF1ZXVlID0gW107XG5cdFx0XHRpZiAoIHBOb2RlICkge1xuXHRcdFx0XHRuYW1lc3BhY2UgPSBlbGVtZW50Lm5hbWVzcGFjZSA9IGdldEVsZW1lbnROYW1lc3BhY2UoIGRlc2NyaXB0b3IsIHBOb2RlICk7XG5cdFx0XHRcdG5hbWUgPSBuYW1lc3BhY2UgIT09IG5hbWVzcGFjZXMuaHRtbCA/IGVuZm9yY2VDYXNlKCBkZXNjcmlwdG9yLmUgKSA6IGRlc2NyaXB0b3IuZTtcblx0XHRcdFx0ZWxlbWVudC5ub2RlID0gY3JlYXRlRWxlbWVudCggbmFtZSwgbmFtZXNwYWNlICk7XG5cdFx0XHRcdGlmICggcm9vdC5jc3MgJiYgcE5vZGUgPT09IHJvb3QuZWwgKSB7XG5cdFx0XHRcdFx0ZWxlbWVudC5ub2RlLnNldEF0dHJpYnV0ZSggJ2RhdGEtcnZjZ3VpZCcsIHJvb3QuY29uc3RydWN0b3IuX2d1aWQgfHwgcm9vdC5fZ3VpZCApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGRlZmluZVByb3BlcnR5KCBlbGVtZW50Lm5vZGUsICdfcmFjdGl2ZScsIHtcblx0XHRcdFx0XHR2YWx1ZToge1xuXHRcdFx0XHRcdFx0cHJveHk6IGVsZW1lbnQsXG5cdFx0XHRcdFx0XHRrZXlwYXRoOiBnZXRJbm5lckNvbnRleHQoIHBhcmVudEZyYWdtZW50ICksXG5cdFx0XHRcdFx0XHRpbmRleDogcGFyZW50RnJhZ21lbnQuaW5kZXhSZWZzLFxuXHRcdFx0XHRcdFx0ZXZlbnRzOiBjcmVhdGUoIG51bGwgKSxcblx0XHRcdFx0XHRcdHJvb3Q6IHJvb3Rcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gKTtcblx0XHRcdH1cblx0XHRcdGF0dHJpYnV0ZXMgPSBjcmVhdGVFbGVtZW50QXR0cmlidXRlcyggZWxlbWVudCwgZGVzY3JpcHRvci5hICk7XG5cdFx0XHRpZiAoIGRlc2NyaXB0b3IuZiApIHtcblx0XHRcdFx0aWYgKCBlbGVtZW50Lm5vZGUgJiYgZWxlbWVudC5ub2RlLmdldEF0dHJpYnV0ZSggJ2NvbnRlbnRlZGl0YWJsZScgKSApIHtcblx0XHRcdFx0XHRpZiAoIGVsZW1lbnQubm9kZS5pbm5lckhUTUwgKSB7XG5cdFx0XHRcdFx0XHRlcnJvck1lc3NhZ2UgPSAnQSBwcmUtcG9wdWxhdGVkIGNvbnRlbnRlZGl0YWJsZSBlbGVtZW50IHNob3VsZCBub3QgaGF2ZSBjaGlsZHJlbic7XG5cdFx0XHRcdFx0XHRpZiAoIHJvb3QuZGVidWcgKSB7XG5cdFx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggZXJyb3JNZXNzYWdlICk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHR3YXJuKCBlcnJvck1lc3NhZ2UgKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0YXBwZW5kRWxlbWVudENoaWxkcmVuKCBlbGVtZW50LCBlbGVtZW50Lm5vZGUsIGRlc2NyaXB0b3IsIGRvY0ZyYWcgKTtcblx0XHRcdH1cblx0XHRcdGlmICggZG9jRnJhZyAmJiBkZXNjcmlwdG9yLnYgKSB7XG5cdFx0XHRcdGFkZEV2ZW50UHJveGllcyggZWxlbWVudCwgZGVzY3JpcHRvci52ICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGRvY0ZyYWcgKSB7XG5cdFx0XHRcdGlmICggcm9vdC50d293YXkgKSB7XG5cdFx0XHRcdFx0ZWxlbWVudC5iaW5kKCk7XG5cdFx0XHRcdFx0aWYgKCBlbGVtZW50Lm5vZGUuZ2V0QXR0cmlidXRlKCAnY29udGVudGVkaXRhYmxlJyApICYmIGVsZW1lbnQubm9kZS5fcmFjdGl2ZS5iaW5kaW5nICkge1xuXHRcdFx0XHRcdFx0ZWxlbWVudC5ub2RlLl9yYWN0aXZlLmJpbmRpbmcudXBkYXRlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggYXR0cmlidXRlcy5uYW1lICYmICFhdHRyaWJ1dGVzLm5hbWUudHdvd2F5ICkge1xuXHRcdFx0XHRcdGF0dHJpYnV0ZXMubmFtZS51cGRhdGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIGVsZW1lbnQubm9kZS50YWdOYW1lID09PSAnSU1HJyAmJiAoICggd2lkdGggPSBlbGVtZW50LmF0dHJpYnV0ZXMud2lkdGggKSB8fCAoIGhlaWdodCA9IGVsZW1lbnQuYXR0cmlidXRlcy5oZWlnaHQgKSApICkge1xuXHRcdFx0XHRcdGVsZW1lbnQubm9kZS5hZGRFdmVudExpc3RlbmVyKCAnbG9hZCcsIGxvYWRIYW5kbGVyID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRpZiAoIHdpZHRoICkge1xuXHRcdFx0XHRcdFx0XHRlbGVtZW50Lm5vZGUud2lkdGggPSB3aWR0aC52YWx1ZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmICggaGVpZ2h0ICkge1xuXHRcdFx0XHRcdFx0XHRlbGVtZW50Lm5vZGUuaGVpZ2h0ID0gaGVpZ2h0LnZhbHVlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxlbWVudC5ub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdsb2FkJywgbG9hZEhhbmRsZXIsIGZhbHNlICk7XG5cdFx0XHRcdFx0fSwgZmFsc2UgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRkb2NGcmFnLmFwcGVuZENoaWxkKCBlbGVtZW50Lm5vZGUgKTtcblx0XHRcdFx0aWYgKCBkZXNjcmlwdG9yLm8gKSB7XG5cdFx0XHRcdFx0ZGVjb3JhdGUoIGRlc2NyaXB0b3Iubywgcm9vdCwgZWxlbWVudCApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggZGVzY3JpcHRvci50MSApIHtcblx0XHRcdFx0XHRleGVjdXRlVHJhbnNpdGlvbiggZGVzY3JpcHRvci50MSwgcm9vdCwgZWxlbWVudCwgdHJ1ZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggZWxlbWVudC5ub2RlLnRhZ05hbWUgPT09ICdPUFRJT04nICkge1xuXHRcdFx0XHRcdGlmICggcE5vZGUudGFnTmFtZSA9PT0gJ1NFTEVDVCcgJiYgKCBzZWxlY3RCaW5kaW5nID0gcE5vZGUuX3JhY3RpdmUuYmluZGluZyApICkge1xuXHRcdFx0XHRcdFx0c2VsZWN0QmluZGluZy5kZWZlclVwZGF0ZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIGVsZW1lbnQubm9kZS5fcmFjdGl2ZS52YWx1ZSA9PSBwTm9kZS5fcmFjdGl2ZS52YWx1ZSApIHtcblx0XHRcdFx0XHRcdGVsZW1lbnQubm9kZS5zZWxlY3RlZCA9IHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggZWxlbWVudC5ub2RlLmF1dG9mb2N1cyApIHtcblx0XHRcdFx0XHRydW5sb29wLmZvY3VzKCBlbGVtZW50Lm5vZGUgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCBlbGVtZW50LmxjTmFtZSA9PT0gJ29wdGlvbicgKSB7XG5cdFx0XHRcdGVsZW1lbnQuc2VsZWN0ID0gZmluZFBhcmVudFNlbGVjdCggZWxlbWVudC5wYXJlbnQgKTtcblx0XHRcdH1cblx0XHRcdHVwZGF0ZUxpdmVRdWVyaWVzKCBlbGVtZW50ICk7XG5cdFx0fTtcblxuXHRcdGZ1bmN0aW9uIGZpbmRQYXJlbnRTZWxlY3QoIGVsZW1lbnQgKSB7XG5cdFx0XHRkbyB7XG5cdFx0XHRcdGlmICggZWxlbWVudC5sY05hbWUgPT09ICdzZWxlY3QnICkge1xuXHRcdFx0XHRcdHJldHVybiBlbGVtZW50O1xuXHRcdFx0XHR9XG5cdFx0XHR9IHdoaWxlICggZWxlbWVudCA9IGVsZW1lbnQucGFyZW50ICk7XG5cdFx0fVxuXHR9KCBnbG9iYWxfcnVubG9vcCwgY29uZmlnX3R5cGVzLCBjb25maWdfbmFtZXNwYWNlcywgdXRpbHNfY3JlYXRlLCB1dGlsc19kZWZpbmVQcm9wZXJ0eSwgdXRpbHNfd2FybiwgdXRpbHNfY3JlYXRlRWxlbWVudCwgc2hhcmVkX2dldElubmVyQ29udGV4dCwgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfaW5pdGlhbGlzZV9nZXRFbGVtZW50TmFtZXNwYWNlLCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9pbml0aWFsaXNlX2NyZWF0ZUVsZW1lbnRBdHRyaWJ1dGVzLCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9pbml0aWFsaXNlX2FwcGVuZEVsZW1lbnRDaGlsZHJlbiwgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfaW5pdGlhbGlzZV9kZWNvcmF0ZV9fZGVjb3JhdGUsIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X2luaXRpYWxpc2VfYWRkRXZlbnRQcm94aWVzX19hZGRFdmVudFByb3hpZXMsIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X2luaXRpYWxpc2VfdXBkYXRlTGl2ZVF1ZXJpZXMsIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9leGVjdXRlVHJhbnNpdGlvbl9fZXhlY3V0ZVRyYW5zaXRpb24sIHJlbmRlcl9Eb21GcmFnbWVudF9zaGFyZWRfZW5mb3JjZUNhc2UgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfcHJvdG90eXBlX3RlYXJkb3duID0gZnVuY3Rpb24oIHJ1bmxvb3AsIGV4ZWN1dGVUcmFuc2l0aW9uICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uIEVsZW1lbnRfcHJvdG90eXBlX3RlYXJkb3duKCBkZXN0cm95ICkge1xuXHRcdFx0dmFyIGV2ZW50TmFtZSwgYmluZGluZywgYmluZGluZ3M7XG5cdFx0XHRpZiAoIGRlc3Ryb3kgKSB7XG5cdFx0XHRcdHRoaXMud2lsbERldGFjaCA9IHRydWU7XG5cdFx0XHRcdHJ1bmxvb3AuZGV0YWNoV2hlblJlYWR5KCB0aGlzICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRoaXMuZnJhZ21lbnQgKSB7XG5cdFx0XHRcdHRoaXMuZnJhZ21lbnQudGVhcmRvd24oIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0XHR3aGlsZSAoIHRoaXMuYXR0cmlidXRlcy5sZW5ndGggKSB7XG5cdFx0XHRcdHRoaXMuYXR0cmlidXRlcy5wb3AoKS50ZWFyZG93bigpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aGlzLm5vZGUgKSB7XG5cdFx0XHRcdGZvciAoIGV2ZW50TmFtZSBpbiB0aGlzLm5vZGUuX3JhY3RpdmUuZXZlbnRzICkge1xuXHRcdFx0XHRcdHRoaXMubm9kZS5fcmFjdGl2ZS5ldmVudHNbIGV2ZW50TmFtZSBdLnRlYXJkb3duKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBiaW5kaW5nID0gdGhpcy5ub2RlLl9yYWN0aXZlLmJpbmRpbmcgKSB7XG5cdFx0XHRcdFx0YmluZGluZy50ZWFyZG93bigpO1xuXHRcdFx0XHRcdGJpbmRpbmdzID0gdGhpcy5yb290Ll90d293YXlCaW5kaW5nc1sgYmluZGluZy5hdHRyLmtleXBhdGggXTtcblx0XHRcdFx0XHRiaW5kaW5ncy5zcGxpY2UoIGJpbmRpbmdzLmluZGV4T2YoIGJpbmRpbmcgKSwgMSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRoaXMuZGVjb3JhdG9yICkge1xuXHRcdFx0XHR0aGlzLmRlY29yYXRvci50ZWFyZG93bigpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aGlzLmRlc2NyaXB0b3IudDIgKSB7XG5cdFx0XHRcdGV4ZWN1dGVUcmFuc2l0aW9uKCB0aGlzLmRlc2NyaXB0b3IudDIsIHRoaXMucm9vdCwgdGhpcywgZmFsc2UgKTtcblx0XHRcdH1cblx0XHRcdGlmICggdGhpcy5saXZlUXVlcmllcyApIHtcblx0XHRcdFx0cmVtb3ZlRnJvbUxpdmVRdWVyaWVzKCB0aGlzICk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGZ1bmN0aW9uIHJlbW92ZUZyb21MaXZlUXVlcmllcyggZWxlbWVudCApIHtcblx0XHRcdHZhciBxdWVyeSwgc2VsZWN0b3IsIG1hdGNoaW5nU3RhdGljTm9kZXMsIGksIGo7XG5cdFx0XHRpID0gZWxlbWVudC5saXZlUXVlcmllcy5sZW5ndGg7XG5cdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0cXVlcnkgPSBlbGVtZW50LmxpdmVRdWVyaWVzWyBpIF07XG5cdFx0XHRcdHNlbGVjdG9yID0gcXVlcnkuc2VsZWN0b3I7XG5cdFx0XHRcdHF1ZXJ5Ll9yZW1vdmUoIGVsZW1lbnQubm9kZSApO1xuXHRcdFx0XHRpZiAoIGVsZW1lbnQubWF0Y2hpbmdTdGF0aWNOb2RlcyAmJiAoIG1hdGNoaW5nU3RhdGljTm9kZXMgPSBlbGVtZW50Lm1hdGNoaW5nU3RhdGljTm9kZXNbIHNlbGVjdG9yIF0gKSApIHtcblx0XHRcdFx0XHRqID0gbWF0Y2hpbmdTdGF0aWNOb2Rlcy5sZW5ndGg7XG5cdFx0XHRcdFx0d2hpbGUgKCBqLS0gKSB7XG5cdFx0XHRcdFx0XHRxdWVyeS5yZW1vdmUoIG1hdGNoaW5nU3RhdGljTm9kZXNbIGogXSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fSggZ2xvYmFsX3J1bmxvb3AsIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9leGVjdXRlVHJhbnNpdGlvbl9fZXhlY3V0ZVRyYW5zaXRpb24gKTtcblxuXHR2YXIgY29uZmlnX3ZvaWRFbGVtZW50TmFtZXMgPSAnYXJlYSBiYXNlIGJyIGNvbCBjb21tYW5kIGRvY3R5cGUgZW1iZWQgaHIgaW1nIGlucHV0IGtleWdlbiBsaW5rIG1ldGEgcGFyYW0gc291cmNlIHRyYWNrIHdicicuc3BsaXQoICcgJyApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9wcm90b3R5cGVfdG9TdHJpbmcgPSBmdW5jdGlvbiggdm9pZEVsZW1lbnROYW1lcywgaXNBcnJheSApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBzdHIsIGksIGxlbiwgYXR0clN0cjtcblx0XHRcdHN0ciA9ICc8JyArICggdGhpcy5kZXNjcmlwdG9yLnkgPyAnIWRvY3R5cGUnIDogdGhpcy5kZXNjcmlwdG9yLmUgKTtcblx0XHRcdGxlbiA9IHRoaXMuYXR0cmlidXRlcy5sZW5ndGg7XG5cdFx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRpZiAoIGF0dHJTdHIgPSB0aGlzLmF0dHJpYnV0ZXNbIGkgXS50b1N0cmluZygpICkge1xuXHRcdFx0XHRcdHN0ciArPSAnICcgKyBhdHRyU3RyO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRoaXMubGNOYW1lID09PSAnb3B0aW9uJyAmJiBvcHRpb25Jc1NlbGVjdGVkKCB0aGlzICkgKSB7XG5cdFx0XHRcdHN0ciArPSAnIHNlbGVjdGVkJztcblx0XHRcdH1cblx0XHRcdGlmICggdGhpcy5sY05hbWUgPT09ICdpbnB1dCcgJiYgaW5wdXRJc0NoZWNrZWRSYWRpbyggdGhpcyApICkge1xuXHRcdFx0XHRzdHIgKz0gJyBjaGVja2VkJztcblx0XHRcdH1cblx0XHRcdHN0ciArPSAnPic7XG5cdFx0XHRpZiAoIHRoaXMuaHRtbCApIHtcblx0XHRcdFx0c3RyICs9IHRoaXMuaHRtbDtcblx0XHRcdH0gZWxzZSBpZiAoIHRoaXMuZnJhZ21lbnQgKSB7XG5cdFx0XHRcdHN0ciArPSB0aGlzLmZyYWdtZW50LnRvU3RyaW5nKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHZvaWRFbGVtZW50TmFtZXMuaW5kZXhPZiggdGhpcy5kZXNjcmlwdG9yLmUgKSA9PT0gLTEgKSB7XG5cdFx0XHRcdHN0ciArPSAnPC8nICsgdGhpcy5kZXNjcmlwdG9yLmUgKyAnPic7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnN0cmluZ2lmeWluZyA9IGZhbHNlO1xuXHRcdFx0cmV0dXJuIHN0cjtcblx0XHR9O1xuXG5cdFx0ZnVuY3Rpb24gb3B0aW9uSXNTZWxlY3RlZCggZWxlbWVudCApIHtcblx0XHRcdHZhciBvcHRpb25WYWx1ZSwgc2VsZWN0VmFsdWVBdHRyaWJ1dGUsIHNlbGVjdFZhbHVlSW50ZXJwb2xhdG9yLCBzZWxlY3RWYWx1ZSwgaTtcblx0XHRcdG9wdGlvblZhbHVlID0gZWxlbWVudC5hdHRyaWJ1dGVzLnZhbHVlLnZhbHVlO1xuXHRcdFx0c2VsZWN0VmFsdWVBdHRyaWJ1dGUgPSBlbGVtZW50LnNlbGVjdC5hdHRyaWJ1dGVzLnZhbHVlO1xuXHRcdFx0c2VsZWN0VmFsdWVJbnRlcnBvbGF0b3IgPSBzZWxlY3RWYWx1ZUF0dHJpYnV0ZS5pbnRlcnBvbGF0b3I7XG5cdFx0XHRpZiAoICFzZWxlY3RWYWx1ZUludGVycG9sYXRvciApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0c2VsZWN0VmFsdWUgPSBlbGVtZW50LnJvb3QuZ2V0KCBzZWxlY3RWYWx1ZUludGVycG9sYXRvci5rZXlwYXRoIHx8IHNlbGVjdFZhbHVlSW50ZXJwb2xhdG9yLnJlZiApO1xuXHRcdFx0aWYgKCBzZWxlY3RWYWx1ZSA9PSBvcHRpb25WYWx1ZSApIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGVsZW1lbnQuc2VsZWN0LmF0dHJpYnV0ZXMubXVsdGlwbGUgJiYgaXNBcnJheSggc2VsZWN0VmFsdWUgKSApIHtcblx0XHRcdFx0aSA9IHNlbGVjdFZhbHVlLmxlbmd0aDtcblx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0aWYgKCBzZWxlY3RWYWx1ZVsgaSBdID09IG9wdGlvblZhbHVlICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gaW5wdXRJc0NoZWNrZWRSYWRpbyggZWxlbWVudCApIHtcblx0XHRcdHZhciBhdHRyaWJ1dGVzLCB0eXBlQXR0cmlidXRlLCB2YWx1ZUF0dHJpYnV0ZSwgbmFtZUF0dHJpYnV0ZTtcblx0XHRcdGF0dHJpYnV0ZXMgPSBlbGVtZW50LmF0dHJpYnV0ZXM7XG5cdFx0XHR0eXBlQXR0cmlidXRlID0gYXR0cmlidXRlcy50eXBlO1xuXHRcdFx0dmFsdWVBdHRyaWJ1dGUgPSBhdHRyaWJ1dGVzLnZhbHVlO1xuXHRcdFx0bmFtZUF0dHJpYnV0ZSA9IGF0dHJpYnV0ZXMubmFtZTtcblx0XHRcdGlmICggIXR5cGVBdHRyaWJ1dGUgfHwgdHlwZUF0dHJpYnV0ZS52YWx1ZSAhPT0gJ3JhZGlvJyB8fCAhdmFsdWVBdHRyaWJ1dGUgfHwgIW5hbWVBdHRyaWJ1dGUuaW50ZXJwb2xhdG9yICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHZhbHVlQXR0cmlidXRlLnZhbHVlID09PSBuYW1lQXR0cmlidXRlLmludGVycG9sYXRvci52YWx1ZSApIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KCBjb25maWdfdm9pZEVsZW1lbnROYW1lcywgdXRpbHNfaXNBcnJheSApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9wcm90b3R5cGVfZmluZCA9IGZ1bmN0aW9uKCBtYXRjaGVzICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBzZWxlY3RvciApIHtcblx0XHRcdHZhciBxdWVyeVJlc3VsdDtcblx0XHRcdGlmICggbWF0Y2hlcyggdGhpcy5ub2RlLCBzZWxlY3RvciApICkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5ub2RlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aGlzLmh0bWwgJiYgKCBxdWVyeVJlc3VsdCA9IHRoaXMubm9kZS5xdWVyeVNlbGVjdG9yKCBzZWxlY3RvciApICkgKSB7XG5cdFx0XHRcdHJldHVybiBxdWVyeVJlc3VsdDtcblx0XHRcdH1cblx0XHRcdGlmICggdGhpcy5mcmFnbWVudCAmJiB0aGlzLmZyYWdtZW50LmZpbmQgKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmZyYWdtZW50LmZpbmQoIHNlbGVjdG9yICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fSggdXRpbHNfbWF0Y2hlcyApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9wcm90b3R5cGVfZmluZEFsbCA9IGZ1bmN0aW9uKCBnZXRNYXRjaGluZ1N0YXRpY05vZGVzICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBzZWxlY3RvciwgcXVlcnkgKSB7XG5cdFx0XHR2YXIgbWF0Y2hpbmdTdGF0aWNOb2RlcywgbWF0Y2hlZFNlbGY7XG5cdFx0XHRpZiAoIHF1ZXJ5Ll90ZXN0KCB0aGlzLCB0cnVlICkgJiYgcXVlcnkubGl2ZSApIHtcblx0XHRcdFx0KCB0aGlzLmxpdmVRdWVyaWVzIHx8ICggdGhpcy5saXZlUXVlcmllcyA9IFtdICkgKS5wdXNoKCBxdWVyeSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aGlzLmh0bWwgKSB7XG5cdFx0XHRcdG1hdGNoaW5nU3RhdGljTm9kZXMgPSBnZXRNYXRjaGluZ1N0YXRpY05vZGVzKCB0aGlzLCBzZWxlY3RvciApO1xuXHRcdFx0XHRxdWVyeS5wdXNoLmFwcGx5KCBxdWVyeSwgbWF0Y2hpbmdTdGF0aWNOb2RlcyApO1xuXHRcdFx0XHRpZiAoIHF1ZXJ5LmxpdmUgJiYgIW1hdGNoZWRTZWxmICkge1xuXHRcdFx0XHRcdCggdGhpcy5saXZlUXVlcmllcyB8fCAoIHRoaXMubGl2ZVF1ZXJpZXMgPSBbXSApICkucHVzaCggcXVlcnkgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aGlzLmZyYWdtZW50ICkge1xuXHRcdFx0XHR0aGlzLmZyYWdtZW50LmZpbmRBbGwoIHNlbGVjdG9yLCBxdWVyeSApO1xuXHRcdFx0fVxuXHRcdH07XG5cdH0oIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3NoYXJlZF9nZXRNYXRjaGluZ1N0YXRpY05vZGVzICk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3Byb3RvdHlwZV9maW5kQ29tcG9uZW50ID0gZnVuY3Rpb24oIHNlbGVjdG9yICkge1xuXHRcdGlmICggdGhpcy5mcmFnbWVudCApIHtcblx0XHRcdHJldHVybiB0aGlzLmZyYWdtZW50LmZpbmRDb21wb25lbnQoIHNlbGVjdG9yICk7XG5cdFx0fVxuXHR9O1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9wcm90b3R5cGVfZmluZEFsbENvbXBvbmVudHMgPSBmdW5jdGlvbiggc2VsZWN0b3IsIHF1ZXJ5ICkge1xuXHRcdGlmICggdGhpcy5mcmFnbWVudCApIHtcblx0XHRcdHRoaXMuZnJhZ21lbnQuZmluZEFsbENvbXBvbmVudHMoIHNlbGVjdG9yLCBxdWVyeSApO1xuXHRcdH1cblx0fTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfcHJvdG90eXBlX2JpbmQgPSBmdW5jdGlvbigpIHtcblx0XHR2YXIgYXR0cmlidXRlcyA9IHRoaXMuYXR0cmlidXRlcztcblx0XHRpZiAoICF0aGlzLm5vZGUgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICggdGhpcy5iaW5kaW5nICkge1xuXHRcdFx0dGhpcy5iaW5kaW5nLnRlYXJkb3duKCk7XG5cdFx0XHR0aGlzLmJpbmRpbmcgPSBudWxsO1xuXHRcdH1cblx0XHRpZiAoIHRoaXMubm9kZS5nZXRBdHRyaWJ1dGUoICdjb250ZW50ZWRpdGFibGUnICkgJiYgYXR0cmlidXRlcy52YWx1ZSAmJiBhdHRyaWJ1dGVzLnZhbHVlLmJpbmQoKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0c3dpdGNoICggdGhpcy5kZXNjcmlwdG9yLmUgKSB7XG5cdFx0XHRjYXNlICdzZWxlY3QnOlxuXHRcdFx0Y2FzZSAndGV4dGFyZWEnOlxuXHRcdFx0XHRpZiAoIGF0dHJpYnV0ZXMudmFsdWUgKSB7XG5cdFx0XHRcdFx0YXR0cmlidXRlcy52YWx1ZS5iaW5kKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0Y2FzZSAnaW5wdXQnOlxuXHRcdFx0XHRpZiAoIHRoaXMubm9kZS50eXBlID09PSAncmFkaW8nIHx8IHRoaXMubm9kZS50eXBlID09PSAnY2hlY2tib3gnICkge1xuXHRcdFx0XHRcdGlmICggYXR0cmlidXRlcy5uYW1lICYmIGF0dHJpYnV0ZXMubmFtZS5iaW5kKCkgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICggYXR0cmlidXRlcy5jaGVja2VkICYmIGF0dHJpYnV0ZXMuY2hlY2tlZC5iaW5kKCkgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggYXR0cmlidXRlcy52YWx1ZSAmJiBhdHRyaWJ1dGVzLnZhbHVlLmJpbmQoKSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHR9XG5cdH07XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X19FbGVtZW50ID0gZnVuY3Rpb24oIHJ1bmxvb3AsIGNzcywgaW5pdGlhbGlzZSwgdGVhcmRvd24sIHRvU3RyaW5nLCBmaW5kLCBmaW5kQWxsLCBmaW5kQ29tcG9uZW50LCBmaW5kQWxsQ29tcG9uZW50cywgYmluZCApIHtcblxuXHRcdHZhciBEb21FbGVtZW50ID0gZnVuY3Rpb24oIG9wdGlvbnMsIGRvY0ZyYWcgKSB7XG5cdFx0XHRpbml0aWFsaXNlKCB0aGlzLCBvcHRpb25zLCBkb2NGcmFnICk7XG5cdFx0fTtcblx0XHREb21FbGVtZW50LnByb3RvdHlwZSA9IHtcblx0XHRcdGRldGFjaDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBDb21wb25lbnQ7XG5cdFx0XHRcdGlmICggdGhpcy5ub2RlICkge1xuXHRcdFx0XHRcdGlmICggdGhpcy5ub2RlLnBhcmVudE5vZGUgKSB7XG5cdFx0XHRcdFx0XHR0aGlzLm5vZGUucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCggdGhpcy5ub2RlICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB0aGlzLm5vZGU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCB0aGlzLmNzc0RldGFjaFF1ZXVlLmxlbmd0aCApIHtcblx0XHRcdFx0XHRydW5sb29wLnN0YXJ0KCk7XG5cdFx0XHRcdFx0d2hpbGUgKCBDb21wb25lbnQgPT09IHRoaXMuY3NzRGV0YWNoUXVldWUucG9wKCkgKSB7XG5cdFx0XHRcdFx0XHRjc3MucmVtb3ZlKCBDb21wb25lbnQgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cnVubG9vcC5lbmQoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiB0ZWFyZG93bixcblx0XHRcdGZpcnN0Tm9kZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLm5vZGU7XG5cdFx0XHR9LFxuXHRcdFx0ZmluZE5leHROb2RlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9LFxuXHRcdFx0YnViYmxlOiBmdW5jdGlvbigpIHt9LFxuXHRcdFx0dG9TdHJpbmc6IHRvU3RyaW5nLFxuXHRcdFx0ZmluZDogZmluZCxcblx0XHRcdGZpbmRBbGw6IGZpbmRBbGwsXG5cdFx0XHRmaW5kQ29tcG9uZW50OiBmaW5kQ29tcG9uZW50LFxuXHRcdFx0ZmluZEFsbENvbXBvbmVudHM6IGZpbmRBbGxDb21wb25lbnRzLFxuXHRcdFx0YmluZDogYmluZFxuXHRcdH07XG5cdFx0cmV0dXJuIERvbUVsZW1lbnQ7XG5cdH0oIGdsb2JhbF9ydW5sb29wLCBnbG9iYWxfY3NzLCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9pbml0aWFsaXNlX19pbml0aWFsaXNlLCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9wcm90b3R5cGVfdGVhcmRvd24sIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3Byb3RvdHlwZV90b1N0cmluZywgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfcHJvdG90eXBlX2ZpbmQsIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X3Byb3RvdHlwZV9maW5kQWxsLCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9wcm90b3R5cGVfZmluZENvbXBvbmVudCwgcmVuZGVyX0RvbUZyYWdtZW50X0VsZW1lbnRfcHJvdG90eXBlX2ZpbmRBbGxDb21wb25lbnRzLCByZW5kZXJfRG9tRnJhZ21lbnRfRWxlbWVudF9wcm90b3R5cGVfYmluZCApO1xuXG5cdHZhciBjb25maWdfZXJyb3JzID0ge1xuXHRcdG1pc3NpbmdQYXJzZXI6ICdNaXNzaW5nIFJhY3RpdmUucGFyc2UgLSBjYW5ub3QgcGFyc2UgdGVtcGxhdGUuIEVpdGhlciBwcmVwYXJzZSBvciB1c2UgdGhlIHZlcnNpb24gdGhhdCBpbmNsdWRlcyB0aGUgcGFyc2VyJ1xuXHR9O1xuXG5cdHZhciByZWdpc3RyaWVzX3BhcnRpYWxzID0ge307XG5cblx0dmFyIHBhcnNlX3V0aWxzX3N0cmlwSHRtbENvbW1lbnRzID0gZnVuY3Rpb24oIGh0bWwgKSB7XG5cdFx0dmFyIGNvbW1lbnRTdGFydCwgY29tbWVudEVuZCwgcHJvY2Vzc2VkO1xuXHRcdHByb2Nlc3NlZCA9ICcnO1xuXHRcdHdoaWxlICggaHRtbC5sZW5ndGggKSB7XG5cdFx0XHRjb21tZW50U3RhcnQgPSBodG1sLmluZGV4T2YoICc8IS0tJyApO1xuXHRcdFx0Y29tbWVudEVuZCA9IGh0bWwuaW5kZXhPZiggJy0tPicgKTtcblx0XHRcdGlmICggY29tbWVudFN0YXJ0ID09PSAtMSAmJiBjb21tZW50RW5kID09PSAtMSApIHtcblx0XHRcdFx0cHJvY2Vzc2VkICs9IGh0bWw7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBjb21tZW50U3RhcnQgIT09IC0xICYmIGNvbW1lbnRFbmQgPT09IC0xICkge1xuXHRcdFx0XHR0aHJvdyAnSWxsZWdhbCBIVE1MIC0gZXhwZWN0ZWQgY2xvc2luZyBjb21tZW50IHNlcXVlbmNlIChcXCctLT5cXCcpJztcblx0XHRcdH1cblx0XHRcdGlmICggY29tbWVudEVuZCAhPT0gLTEgJiYgY29tbWVudFN0YXJ0ID09PSAtMSB8fCBjb21tZW50RW5kIDwgY29tbWVudFN0YXJ0ICkge1xuXHRcdFx0XHR0aHJvdyAnSWxsZWdhbCBIVE1MIC0gdW5leHBlY3RlZCBjbG9zaW5nIGNvbW1lbnQgc2VxdWVuY2UgKFxcJy0tPlxcJyknO1xuXHRcdFx0fVxuXHRcdFx0cHJvY2Vzc2VkICs9IGh0bWwuc3Vic3RyKCAwLCBjb21tZW50U3RhcnQgKTtcblx0XHRcdGh0bWwgPSBodG1sLnN1YnN0cmluZyggY29tbWVudEVuZCArIDMgKTtcblx0XHR9XG5cdFx0cmV0dXJuIHByb2Nlc3NlZDtcblx0fTtcblxuXHR2YXIgcGFyc2VfdXRpbHNfc3RyaXBTdGFuZGFsb25lcyA9IGZ1bmN0aW9uKCB0eXBlcyApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggdG9rZW5zICkge1xuXHRcdFx0dmFyIGksIGN1cnJlbnQsIGJhY2tPbmUsIGJhY2tUd28sIGxlYWRpbmdMaW5lYnJlYWssIHRyYWlsaW5nTGluZWJyZWFrO1xuXHRcdFx0bGVhZGluZ0xpbmVicmVhayA9IC9eXFxzKlxccj9cXG4vO1xuXHRcdFx0dHJhaWxpbmdMaW5lYnJlYWsgPSAvXFxyP1xcblxccyokLztcblx0XHRcdGZvciAoIGkgPSAyOyBpIDwgdG9rZW5zLmxlbmd0aDsgaSArPSAxICkge1xuXHRcdFx0XHRjdXJyZW50ID0gdG9rZW5zWyBpIF07XG5cdFx0XHRcdGJhY2tPbmUgPSB0b2tlbnNbIGkgLSAxIF07XG5cdFx0XHRcdGJhY2tUd28gPSB0b2tlbnNbIGkgLSAyIF07XG5cdFx0XHRcdGlmICggY3VycmVudC50eXBlID09PSB0eXBlcy5URVhUICYmICggYmFja09uZS50eXBlID09PSB0eXBlcy5NVVNUQUNIRSAmJiBiYWNrT25lLm11c3RhY2hlVHlwZSAhPT0gdHlwZXMuUEFSVElBTCApICYmIGJhY2tUd28udHlwZSA9PT0gdHlwZXMuVEVYVCApIHtcblx0XHRcdFx0XHRpZiAoIHRyYWlsaW5nTGluZWJyZWFrLnRlc3QoIGJhY2tUd28udmFsdWUgKSAmJiBsZWFkaW5nTGluZWJyZWFrLnRlc3QoIGN1cnJlbnQudmFsdWUgKSApIHtcblx0XHRcdFx0XHRcdGlmICggYmFja09uZS5tdXN0YWNoZVR5cGUgIT09IHR5cGVzLklOVEVSUE9MQVRPUiAmJiBiYWNrT25lLm11c3RhY2hlVHlwZSAhPT0gdHlwZXMuVFJJUExFICkge1xuXHRcdFx0XHRcdFx0XHRiYWNrVHdvLnZhbHVlID0gYmFja1R3by52YWx1ZS5yZXBsYWNlKCB0cmFpbGluZ0xpbmVicmVhaywgJ1xcbicgKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGN1cnJlbnQudmFsdWUgPSBjdXJyZW50LnZhbHVlLnJlcGxhY2UoIGxlYWRpbmdMaW5lYnJlYWssICcnICk7XG5cdFx0XHRcdFx0XHRpZiAoIGN1cnJlbnQudmFsdWUgPT09ICcnICkge1xuXHRcdFx0XHRcdFx0XHR0b2tlbnMuc3BsaWNlKCBpLS0sIDEgKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiB0b2tlbnM7XG5cdFx0fTtcblx0fSggY29uZmlnX3R5cGVzICk7XG5cblx0dmFyIHBhcnNlX3V0aWxzX3N0cmlwQ29tbWVudFRva2VucyA9IGZ1bmN0aW9uKCB0eXBlcyApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggdG9rZW5zICkge1xuXHRcdFx0dmFyIGksIGN1cnJlbnQsIHByZXZpb3VzLCBuZXh0O1xuXHRcdFx0Zm9yICggaSA9IDA7IGkgPCB0b2tlbnMubGVuZ3RoOyBpICs9IDEgKSB7XG5cdFx0XHRcdGN1cnJlbnQgPSB0b2tlbnNbIGkgXTtcblx0XHRcdFx0cHJldmlvdXMgPSB0b2tlbnNbIGkgLSAxIF07XG5cdFx0XHRcdG5leHQgPSB0b2tlbnNbIGkgKyAxIF07XG5cdFx0XHRcdGlmICggY3VycmVudC5tdXN0YWNoZVR5cGUgPT09IHR5cGVzLkNPTU1FTlQgfHwgY3VycmVudC5tdXN0YWNoZVR5cGUgPT09IHR5cGVzLkRFTElNQ0hBTkdFICkge1xuXHRcdFx0XHRcdHRva2Vucy5zcGxpY2UoIGksIDEgKTtcblx0XHRcdFx0XHRpZiAoIHByZXZpb3VzICYmIG5leHQgKSB7XG5cdFx0XHRcdFx0XHRpZiAoIHByZXZpb3VzLnR5cGUgPT09IHR5cGVzLlRFWFQgJiYgbmV4dC50eXBlID09PSB0eXBlcy5URVhUICkge1xuXHRcdFx0XHRcdFx0XHRwcmV2aW91cy52YWx1ZSArPSBuZXh0LnZhbHVlO1xuXHRcdFx0XHRcdFx0XHR0b2tlbnMuc3BsaWNlKCBpLCAxICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGkgLT0gMTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRva2Vucztcblx0XHR9O1xuXHR9KCBjb25maWdfdHlwZXMgKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX2dldE11c3RhY2hlX2dldERlbGltaXRlckNoYW5nZSA9IGZ1bmN0aW9uKCBtYWtlUmVnZXhNYXRjaGVyICkge1xuXG5cdFx0dmFyIGdldERlbGltaXRlciA9IG1ha2VSZWdleE1hdGNoZXIoIC9eW15cXHM9XSsvICk7XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB0b2tlbml6ZXIgKSB7XG5cdFx0XHR2YXIgc3RhcnQsIG9wZW5pbmcsIGNsb3Npbmc7XG5cdFx0XHRpZiAoICF0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICc9JyApICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHN0YXJ0ID0gdG9rZW5pemVyLnBvcztcblx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdG9wZW5pbmcgPSBnZXREZWxpbWl0ZXIoIHRva2VuaXplciApO1xuXHRcdFx0aWYgKCAhb3BlbmluZyApIHtcblx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdGNsb3NpbmcgPSBnZXREZWxpbWl0ZXIoIHRva2VuaXplciApO1xuXHRcdFx0aWYgKCAhY2xvc2luZyApIHtcblx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdGlmICggIXRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJz0nICkgKSB7XG5cdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRvcGVuaW5nLFxuXHRcdFx0XHRjbG9zaW5nXG5cdFx0XHRdO1xuXHRcdH07XG5cdH0oIHBhcnNlX1Rva2VuaXplcl91dGlsc19tYWtlUmVnZXhNYXRjaGVyICk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9nZXRNdXN0YWNoZV9nZXRNdXN0YWNoZVR5cGUgPSBmdW5jdGlvbiggdHlwZXMgKSB7XG5cblx0XHR2YXIgbXVzdGFjaGVUeXBlcyA9IHtcblx0XHRcdCcjJzogdHlwZXMuU0VDVElPTixcblx0XHRcdCdeJzogdHlwZXMuSU5WRVJURUQsXG5cdFx0XHQnLyc6IHR5cGVzLkNMT1NJTkcsXG5cdFx0XHQnPic6IHR5cGVzLlBBUlRJQUwsXG5cdFx0XHQnISc6IHR5cGVzLkNPTU1FTlQsXG5cdFx0XHQnJic6IHR5cGVzLlRSSVBMRVxuXHRcdH07XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB0b2tlbml6ZXIgKSB7XG5cdFx0XHR2YXIgdHlwZSA9IG11c3RhY2hlVHlwZXNbIHRva2VuaXplci5zdHIuY2hhckF0KCB0b2tlbml6ZXIucG9zICkgXTtcblx0XHRcdGlmICggIXR5cGUgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0dG9rZW5pemVyLnBvcyArPSAxO1xuXHRcdFx0cmV0dXJuIHR5cGU7XG5cdFx0fTtcblx0fSggY29uZmlnX3R5cGVzICk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9nZXRNdXN0YWNoZV9nZXRNdXN0YWNoZUNvbnRlbnQgPSBmdW5jdGlvbiggdHlwZXMsIG1ha2VSZWdleE1hdGNoZXIsIGdldE11c3RhY2hlVHlwZSApIHtcblxuXHRcdHZhciBnZXRJbmRleFJlZiA9IG1ha2VSZWdleE1hdGNoZXIoIC9eXFxzKjpcXHMqKFthLXpBLVpfJF1bYS16QS1aXyQwLTldKikvICksXG5cdFx0XHRhcnJheU1lbWJlciA9IC9eWzAtOV1bMS05XSokLztcblx0XHRyZXR1cm4gZnVuY3Rpb24oIHRva2VuaXplciwgaXNUcmlwbGUgKSB7XG5cdFx0XHR2YXIgc3RhcnQsIG11c3RhY2hlLCB0eXBlLCBleHByLCBpLCByZW1haW5pbmcsIGluZGV4LCBkZWxpbWl0ZXI7XG5cdFx0XHRzdGFydCA9IHRva2VuaXplci5wb3M7XG5cdFx0XHRtdXN0YWNoZSA9IHtcblx0XHRcdFx0dHlwZTogaXNUcmlwbGUgPyB0eXBlcy5UUklQTEUgOiB0eXBlcy5NVVNUQUNIRVxuXHRcdFx0fTtcblx0XHRcdGlmICggIWlzVHJpcGxlICkge1xuXHRcdFx0XHRpZiAoIGV4cHIgPSB0b2tlbml6ZXIuZ2V0RXhwcmVzc2lvbigpICkge1xuXHRcdFx0XHRcdG11c3RhY2hlLm11c3RhY2hlVHlwZSA9IHR5cGVzLklOVEVSUE9MQVRPUjtcblx0XHRcdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRcdFx0aWYgKCB0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goIHRva2VuaXplci5kZWxpbWl0ZXJzWyAxIF0gKSApIHtcblx0XHRcdFx0XHRcdHRva2VuaXplci5wb3MgLT0gdG9rZW5pemVyLmRlbGltaXRlcnNbIDEgXS5sZW5ndGg7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0XHRcdGV4cHIgPSBudWxsO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoICFleHByICkge1xuXHRcdFx0XHRcdHR5cGUgPSBnZXRNdXN0YWNoZVR5cGUoIHRva2VuaXplciApO1xuXHRcdFx0XHRcdGlmICggdHlwZSA9PT0gdHlwZXMuVFJJUExFICkge1xuXHRcdFx0XHRcdFx0bXVzdGFjaGUgPSB7XG5cdFx0XHRcdFx0XHRcdHR5cGU6IHR5cGVzLlRSSVBMRVxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0bXVzdGFjaGUubXVzdGFjaGVUeXBlID0gdHlwZSB8fCB0eXBlcy5JTlRFUlBPTEFUT1I7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICggdHlwZSA9PT0gdHlwZXMuQ09NTUVOVCB8fCB0eXBlID09PSB0eXBlcy5DTE9TSU5HICkge1xuXHRcdFx0XHRcdFx0cmVtYWluaW5nID0gdG9rZW5pemVyLnJlbWFpbmluZygpO1xuXHRcdFx0XHRcdFx0aW5kZXggPSByZW1haW5pbmcuaW5kZXhPZiggdG9rZW5pemVyLmRlbGltaXRlcnNbIDEgXSApO1xuXHRcdFx0XHRcdFx0aWYgKCBpbmRleCAhPT0gLTEgKSB7XG5cdFx0XHRcdFx0XHRcdG11c3RhY2hlLnJlZiA9IHJlbWFpbmluZy5zdWJzdHIoIDAsIGluZGV4ICk7XG5cdFx0XHRcdFx0XHRcdHRva2VuaXplci5wb3MgKz0gaW5kZXg7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBtdXN0YWNoZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICggIWV4cHIgKSB7XG5cdFx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdFx0ZXhwciA9IHRva2VuaXplci5nZXRFeHByZXNzaW9uKCk7XG5cdFx0XHRcdHJlbWFpbmluZyA9IHRva2VuaXplci5yZW1haW5pbmcoKTtcblx0XHRcdFx0ZGVsaW1pdGVyID0gaXNUcmlwbGUgPyB0b2tlbml6ZXIudHJpcGxlRGVsaW1pdGVyc1sgMSBdIDogdG9rZW5pemVyLmRlbGltaXRlcnNbIDEgXTtcblx0XHRcdFx0aWYgKCByZW1haW5pbmcuc3Vic3RyKCAwLCBkZWxpbWl0ZXIubGVuZ3RoICkgIT09IGRlbGltaXRlciAmJiByZW1haW5pbmcuY2hhckF0KCAwICkgIT09ICc6JyApIHtcblx0XHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdFx0cmVtYWluaW5nID0gdG9rZW5pemVyLnJlbWFpbmluZygpO1xuXHRcdFx0XHRcdGluZGV4ID0gcmVtYWluaW5nLmluZGV4T2YoIHRva2VuaXplci5kZWxpbWl0ZXJzWyAxIF0gKTtcblx0XHRcdFx0XHRpZiAoIGluZGV4ICE9PSAtMSApIHtcblx0XHRcdFx0XHRcdG11c3RhY2hlLnJlZiA9IHJlbWFpbmluZy5zdWJzdHIoIDAsIGluZGV4ICkudHJpbSgpO1xuXHRcdFx0XHRcdFx0dG9rZW5pemVyLnBvcyArPSBpbmRleDtcblx0XHRcdFx0XHRcdHJldHVybiBtdXN0YWNoZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHdoaWxlICggZXhwci50ID09PSB0eXBlcy5CUkFDS0VURUQgJiYgZXhwci54ICkge1xuXHRcdFx0XHRleHByID0gZXhwci54O1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBleHByLnQgPT09IHR5cGVzLlJFRkVSRU5DRSApIHtcblx0XHRcdFx0bXVzdGFjaGUucmVmID0gZXhwci5uO1xuXHRcdFx0fSBlbHNlIGlmICggZXhwci50ID09PSB0eXBlcy5OVU1CRVJfTElURVJBTCAmJiBhcnJheU1lbWJlci50ZXN0KCBleHByLnYgKSApIHtcblx0XHRcdFx0bXVzdGFjaGUucmVmID0gZXhwci52O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bXVzdGFjaGUuZXhwcmVzc2lvbiA9IGV4cHI7XG5cdFx0XHR9XG5cdFx0XHRpID0gZ2V0SW5kZXhSZWYoIHRva2VuaXplciApO1xuXHRcdFx0aWYgKCBpICE9PSBudWxsICkge1xuXHRcdFx0XHRtdXN0YWNoZS5pbmRleFJlZiA9IGk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbXVzdGFjaGU7XG5cdFx0fTtcblx0fSggY29uZmlnX3R5cGVzLCBwYXJzZV9Ub2tlbml6ZXJfdXRpbHNfbWFrZVJlZ2V4TWF0Y2hlciwgcGFyc2VfVG9rZW5pemVyX2dldE11c3RhY2hlX2dldE11c3RhY2hlVHlwZSApO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfZ2V0TXVzdGFjaGVfX2dldE11c3RhY2hlID0gZnVuY3Rpb24oIHR5cGVzLCBnZXREZWxpbWl0ZXJDaGFuZ2UsIGdldE11c3RhY2hlQ29udGVudCApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBzZWVrVHJpcGxlRmlyc3QgPSB0aGlzLnRyaXBsZURlbGltaXRlcnNbIDAgXS5sZW5ndGggPiB0aGlzLmRlbGltaXRlcnNbIDAgXS5sZW5ndGg7XG5cdFx0XHRyZXR1cm4gZ2V0TXVzdGFjaGUoIHRoaXMsIHNlZWtUcmlwbGVGaXJzdCApIHx8IGdldE11c3RhY2hlKCB0aGlzLCAhc2Vla1RyaXBsZUZpcnN0ICk7XG5cdFx0fTtcblxuXHRcdGZ1bmN0aW9uIGdldE11c3RhY2hlKCB0b2tlbml6ZXIsIHNlZWtUcmlwbGUgKSB7XG5cdFx0XHR2YXIgc3RhcnQgPSB0b2tlbml6ZXIucG9zLFxuXHRcdFx0XHRjb250ZW50LCBkZWxpbWl0ZXJzO1xuXHRcdFx0ZGVsaW1pdGVycyA9IHNlZWtUcmlwbGUgPyB0b2tlbml6ZXIudHJpcGxlRGVsaW1pdGVycyA6IHRva2VuaXplci5kZWxpbWl0ZXJzO1xuXHRcdFx0aWYgKCAhdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCBkZWxpbWl0ZXJzWyAwIF0gKSApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRjb250ZW50ID0gZ2V0RGVsaW1pdGVyQ2hhbmdlKCB0b2tlbml6ZXIgKTtcblx0XHRcdGlmICggY29udGVudCApIHtcblx0XHRcdFx0aWYgKCAhdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCBkZWxpbWl0ZXJzWyAxIF0gKSApIHtcblx0XHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0dG9rZW5pemVyWyBzZWVrVHJpcGxlID8gJ3RyaXBsZURlbGltaXRlcnMnIDogJ2RlbGltaXRlcnMnIF0gPSBjb250ZW50O1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHR5cGU6IHR5cGVzLk1VU1RBQ0hFLFxuXHRcdFx0XHRcdG11c3RhY2hlVHlwZTogdHlwZXMuREVMSU1DSEFOR0Vcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdGNvbnRlbnQgPSBnZXRNdXN0YWNoZUNvbnRlbnQoIHRva2VuaXplciwgc2Vla1RyaXBsZSApO1xuXHRcdFx0aWYgKCBjb250ZW50ID09PSBudWxsICkge1xuXHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0aWYgKCAhdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCBkZWxpbWl0ZXJzWyAxIF0gKSApIHtcblx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHJldHVybiBjb250ZW50O1xuXHRcdH1cblx0fSggY29uZmlnX3R5cGVzLCBwYXJzZV9Ub2tlbml6ZXJfZ2V0TXVzdGFjaGVfZ2V0RGVsaW1pdGVyQ2hhbmdlLCBwYXJzZV9Ub2tlbml6ZXJfZ2V0TXVzdGFjaGVfZ2V0TXVzdGFjaGVDb250ZW50ICk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9nZXRDb21tZW50X2dldENvbW1lbnQgPSBmdW5jdGlvbiggdHlwZXMgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgY29udGVudCwgcmVtYWluaW5nLCBlbmRJbmRleDtcblx0XHRcdGlmICggIXRoaXMuZ2V0U3RyaW5nTWF0Y2goICc8IS0tJyApICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHJlbWFpbmluZyA9IHRoaXMucmVtYWluaW5nKCk7XG5cdFx0XHRlbmRJbmRleCA9IHJlbWFpbmluZy5pbmRleE9mKCAnLS0+JyApO1xuXHRcdFx0aWYgKCBlbmRJbmRleCA9PT0gLTEgKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ1VuZXhwZWN0ZWQgZW5kIG9mIGlucHV0IChleHBlY3RlZCBcIi0tPlwiIHRvIGNsb3NlIGNvbW1lbnQpJyApO1xuXHRcdFx0fVxuXHRcdFx0Y29udGVudCA9IHJlbWFpbmluZy5zdWJzdHIoIDAsIGVuZEluZGV4ICk7XG5cdFx0XHR0aGlzLnBvcyArPSBlbmRJbmRleCArIDM7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR0eXBlOiB0eXBlcy5DT01NRU5ULFxuXHRcdFx0XHRjb250ZW50OiBjb250ZW50XG5cdFx0XHR9O1xuXHRcdH07XG5cdH0oIGNvbmZpZ190eXBlcyApO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfdXRpbHNfZ2V0TG93ZXN0SW5kZXggPSBmdW5jdGlvbiggaGF5c3RhY2ssIG5lZWRsZXMgKSB7XG5cdFx0dmFyIGksIGluZGV4LCBsb3dlc3Q7XG5cdFx0aSA9IG5lZWRsZXMubGVuZ3RoO1xuXHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0aW5kZXggPSBoYXlzdGFjay5pbmRleE9mKCBuZWVkbGVzWyBpIF0gKTtcblx0XHRcdGlmICggIWluZGV4ICkge1xuXHRcdFx0XHRyZXR1cm4gMDtcblx0XHRcdH1cblx0XHRcdGlmICggaW5kZXggPT09IC0xICkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGlmICggIWxvd2VzdCB8fCBpbmRleCA8IGxvd2VzdCApIHtcblx0XHRcdFx0bG93ZXN0ID0gaW5kZXg7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBsb3dlc3QgfHwgLTE7XG5cdH07XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9nZXRUYWdfX2dldFRhZyA9IGZ1bmN0aW9uKCB0eXBlcywgbWFrZVJlZ2V4TWF0Y2hlciwgZ2V0TG93ZXN0SW5kZXggKSB7XG5cblx0XHR2YXIgZ2V0VGFnLCBnZXRPcGVuaW5nVGFnLCBnZXRDbG9zaW5nVGFnLCBnZXRUYWdOYW1lLCBnZXRBdHRyaWJ1dGVzLCBnZXRBdHRyaWJ1dGUsIGdldEF0dHJpYnV0ZU5hbWUsIGdldEF0dHJpYnV0ZVZhbHVlLCBnZXRVbnF1b3RlZEF0dHJpYnV0ZVZhbHVlLCBnZXRVbnF1b3RlZEF0dHJpYnV0ZVZhbHVlVG9rZW4sIGdldFVucXVvdGVkQXR0cmlidXRlVmFsdWVUZXh0LCBnZXRRdW90ZWRTdHJpbmdUb2tlbiwgZ2V0UXVvdGVkQXR0cmlidXRlVmFsdWU7XG5cdFx0Z2V0VGFnID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gZ2V0T3BlbmluZ1RhZyggdGhpcyApIHx8IGdldENsb3NpbmdUYWcoIHRoaXMgKTtcblx0XHR9O1xuXHRcdGdldE9wZW5pbmdUYWcgPSBmdW5jdGlvbiggdG9rZW5pemVyICkge1xuXHRcdFx0dmFyIHN0YXJ0LCB0YWcsIGF0dHJzLCBsb3dlckNhc2VOYW1lO1xuXHRcdFx0c3RhcnQgPSB0b2tlbml6ZXIucG9zO1xuXHRcdFx0aWYgKCB0b2tlbml6ZXIuaW5zaWRlICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGlmICggIXRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJzwnICkgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0dGFnID0ge1xuXHRcdFx0XHR0eXBlOiB0eXBlcy5UQUdcblx0XHRcdH07XG5cdFx0XHRpZiAoIHRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJyEnICkgKSB7XG5cdFx0XHRcdHRhZy5kb2N0eXBlID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdHRhZy5uYW1lID0gZ2V0VGFnTmFtZSggdG9rZW5pemVyICk7XG5cdFx0XHRpZiAoICF0YWcubmFtZSApIHtcblx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGF0dHJzID0gZ2V0QXR0cmlidXRlcyggdG9rZW5pemVyICk7XG5cdFx0XHRpZiAoIGF0dHJzICkge1xuXHRcdFx0XHR0YWcuYXR0cnMgPSBhdHRycztcblx0XHRcdH1cblx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdGlmICggdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnLycgKSApIHtcblx0XHRcdFx0dGFnLnNlbGZDbG9zaW5nID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICggIXRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJz4nICkgKSB7XG5cdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRsb3dlckNhc2VOYW1lID0gdGFnLm5hbWUudG9Mb3dlckNhc2UoKTtcblx0XHRcdGlmICggbG93ZXJDYXNlTmFtZSA9PT0gJ3NjcmlwdCcgfHwgbG93ZXJDYXNlTmFtZSA9PT0gJ3N0eWxlJyApIHtcblx0XHRcdFx0dG9rZW5pemVyLmluc2lkZSA9IGxvd2VyQ2FzZU5hbWU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGFnO1xuXHRcdH07XG5cdFx0Z2V0Q2xvc2luZ1RhZyA9IGZ1bmN0aW9uKCB0b2tlbml6ZXIgKSB7XG5cdFx0XHR2YXIgc3RhcnQsIHRhZywgZXhwZWN0ZWQ7XG5cdFx0XHRzdGFydCA9IHRva2VuaXplci5wb3M7XG5cdFx0XHRleHBlY3RlZCA9IGZ1bmN0aW9uKCBzdHIgKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ1VuZXhwZWN0ZWQgY2hhcmFjdGVyICcgKyB0b2tlbml6ZXIucmVtYWluaW5nKCkuY2hhckF0KCAwICkgKyAnIChleHBlY3RlZCAnICsgc3RyICsgJyknICk7XG5cdFx0XHR9O1xuXHRcdFx0aWYgKCAhdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnPCcgKSApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHR0YWcgPSB7XG5cdFx0XHRcdHR5cGU6IHR5cGVzLlRBRyxcblx0XHRcdFx0Y2xvc2luZzogdHJ1ZVxuXHRcdFx0fTtcblx0XHRcdGlmICggIXRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJy8nICkgKSB7XG5cdFx0XHRcdGV4cGVjdGVkKCAnXCIvXCInICk7XG5cdFx0XHR9XG5cdFx0XHR0YWcubmFtZSA9IGdldFRhZ05hbWUoIHRva2VuaXplciApO1xuXHRcdFx0aWYgKCAhdGFnLm5hbWUgKSB7XG5cdFx0XHRcdGV4cGVjdGVkKCAndGFnIG5hbWUnICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICF0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICc+JyApICkge1xuXHRcdFx0XHRleHBlY3RlZCggJ1wiPlwiJyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0b2tlbml6ZXIuaW5zaWRlICkge1xuXHRcdFx0XHRpZiAoIHRhZy5uYW1lLnRvTG93ZXJDYXNlKCkgIT09IHRva2VuaXplci5pbnNpZGUgKSB7XG5cdFx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRva2VuaXplci5pbnNpZGUgPSBudWxsO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRhZztcblx0XHR9O1xuXHRcdGdldFRhZ05hbWUgPSBtYWtlUmVnZXhNYXRjaGVyKCAvXlthLXpBLVpdezEsfTo/W2EtekEtWjAtOVxcLV0qLyApO1xuXHRcdGdldEF0dHJpYnV0ZXMgPSBmdW5jdGlvbiggdG9rZW5pemVyICkge1xuXHRcdFx0dmFyIHN0YXJ0LCBhdHRycywgYXR0cjtcblx0XHRcdHN0YXJ0ID0gdG9rZW5pemVyLnBvcztcblx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdGF0dHIgPSBnZXRBdHRyaWJ1dGUoIHRva2VuaXplciApO1xuXHRcdFx0aWYgKCAhYXR0ciApIHtcblx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGF0dHJzID0gW107XG5cdFx0XHR3aGlsZSAoIGF0dHIgIT09IG51bGwgKSB7XG5cdFx0XHRcdGF0dHJzLnB1c2goIGF0dHIgKTtcblx0XHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0XHRhdHRyID0gZ2V0QXR0cmlidXRlKCB0b2tlbml6ZXIgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBhdHRycztcblx0XHR9O1xuXHRcdGdldEF0dHJpYnV0ZSA9IGZ1bmN0aW9uKCB0b2tlbml6ZXIgKSB7XG5cdFx0XHR2YXIgYXR0ciwgbmFtZSwgdmFsdWU7XG5cdFx0XHRuYW1lID0gZ2V0QXR0cmlidXRlTmFtZSggdG9rZW5pemVyICk7XG5cdFx0XHRpZiAoICFuYW1lICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGF0dHIgPSB7XG5cdFx0XHRcdG5hbWU6IG5hbWVcblx0XHRcdH07XG5cdFx0XHR2YWx1ZSA9IGdldEF0dHJpYnV0ZVZhbHVlKCB0b2tlbml6ZXIgKTtcblx0XHRcdGlmICggdmFsdWUgKSB7XG5cdFx0XHRcdGF0dHIudmFsdWUgPSB2YWx1ZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBhdHRyO1xuXHRcdH07XG5cdFx0Z2V0QXR0cmlidXRlTmFtZSA9IG1ha2VSZWdleE1hdGNoZXIoIC9eW15cXHNcIic+XFwvPV0rLyApO1xuXHRcdGdldEF0dHJpYnV0ZVZhbHVlID0gZnVuY3Rpb24oIHRva2VuaXplciApIHtcblx0XHRcdHZhciBzdGFydCwgdmFsdWU7XG5cdFx0XHRzdGFydCA9IHRva2VuaXplci5wb3M7XG5cdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRpZiAoICF0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICc9JyApICkge1xuXHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0dmFsdWUgPSBnZXRRdW90ZWRBdHRyaWJ1dGVWYWx1ZSggdG9rZW5pemVyLCAnXFwnJyApIHx8IGdldFF1b3RlZEF0dHJpYnV0ZVZhbHVlKCB0b2tlbml6ZXIsICdcIicgKSB8fCBnZXRVbnF1b3RlZEF0dHJpYnV0ZVZhbHVlKCB0b2tlbml6ZXIgKTtcblx0XHRcdGlmICggdmFsdWUgPT09IG51bGwgKSB7XG5cdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0fTtcblx0XHRnZXRVbnF1b3RlZEF0dHJpYnV0ZVZhbHVlVGV4dCA9IG1ha2VSZWdleE1hdGNoZXIoIC9eW15cXHNcIic9PD5gXSsvICk7XG5cdFx0Z2V0VW5xdW90ZWRBdHRyaWJ1dGVWYWx1ZVRva2VuID0gZnVuY3Rpb24oIHRva2VuaXplciApIHtcblx0XHRcdHZhciBzdGFydCwgdGV4dCwgaW5kZXg7XG5cdFx0XHRzdGFydCA9IHRva2VuaXplci5wb3M7XG5cdFx0XHR0ZXh0ID0gZ2V0VW5xdW90ZWRBdHRyaWJ1dGVWYWx1ZVRleHQoIHRva2VuaXplciApO1xuXHRcdFx0aWYgKCAhdGV4dCApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICggaW5kZXggPSB0ZXh0LmluZGV4T2YoIHRva2VuaXplci5kZWxpbWl0ZXJzWyAwIF0gKSApICE9PSAtMSApIHtcblx0XHRcdFx0dGV4dCA9IHRleHQuc3Vic3RyKCAwLCBpbmRleCApO1xuXHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQgKyB0ZXh0Lmxlbmd0aDtcblx0XHRcdH1cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHR5cGU6IHR5cGVzLlRFWFQsXG5cdFx0XHRcdHZhbHVlOiB0ZXh0XG5cdFx0XHR9O1xuXHRcdH07XG5cdFx0Z2V0VW5xdW90ZWRBdHRyaWJ1dGVWYWx1ZSA9IGZ1bmN0aW9uKCB0b2tlbml6ZXIgKSB7XG5cdFx0XHR2YXIgdG9rZW5zLCB0b2tlbjtcblx0XHRcdHRva2VucyA9IFtdO1xuXHRcdFx0dG9rZW4gPSB0b2tlbml6ZXIuZ2V0TXVzdGFjaGUoKSB8fCBnZXRVbnF1b3RlZEF0dHJpYnV0ZVZhbHVlVG9rZW4oIHRva2VuaXplciApO1xuXHRcdFx0d2hpbGUgKCB0b2tlbiAhPT0gbnVsbCApIHtcblx0XHRcdFx0dG9rZW5zLnB1c2goIHRva2VuICk7XG5cdFx0XHRcdHRva2VuID0gdG9rZW5pemVyLmdldE11c3RhY2hlKCkgfHwgZ2V0VW5xdW90ZWRBdHRyaWJ1dGVWYWx1ZVRva2VuKCB0b2tlbml6ZXIgKTtcblx0XHRcdH1cblx0XHRcdGlmICggIXRva2Vucy5sZW5ndGggKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRva2Vucztcblx0XHR9O1xuXHRcdGdldFF1b3RlZEF0dHJpYnV0ZVZhbHVlID0gZnVuY3Rpb24oIHRva2VuaXplciwgcXVvdGVNYXJrICkge1xuXHRcdFx0dmFyIHN0YXJ0LCB0b2tlbnMsIHRva2VuO1xuXHRcdFx0c3RhcnQgPSB0b2tlbml6ZXIucG9zO1xuXHRcdFx0aWYgKCAhdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCBxdW90ZU1hcmsgKSApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHR0b2tlbnMgPSBbXTtcblx0XHRcdHRva2VuID0gdG9rZW5pemVyLmdldE11c3RhY2hlKCkgfHwgZ2V0UXVvdGVkU3RyaW5nVG9rZW4oIHRva2VuaXplciwgcXVvdGVNYXJrICk7XG5cdFx0XHR3aGlsZSAoIHRva2VuICE9PSBudWxsICkge1xuXHRcdFx0XHR0b2tlbnMucHVzaCggdG9rZW4gKTtcblx0XHRcdFx0dG9rZW4gPSB0b2tlbml6ZXIuZ2V0TXVzdGFjaGUoKSB8fCBnZXRRdW90ZWRTdHJpbmdUb2tlbiggdG9rZW5pemVyLCBxdW90ZU1hcmsgKTtcblx0XHRcdH1cblx0XHRcdGlmICggIXRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggcXVvdGVNYXJrICkgKSB7XG5cdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdG9rZW5zO1xuXHRcdH07XG5cdFx0Z2V0UXVvdGVkU3RyaW5nVG9rZW4gPSBmdW5jdGlvbiggdG9rZW5pemVyLCBxdW90ZU1hcmsgKSB7XG5cdFx0XHR2YXIgc3RhcnQsIGluZGV4LCByZW1haW5pbmc7XG5cdFx0XHRzdGFydCA9IHRva2VuaXplci5wb3M7XG5cdFx0XHRyZW1haW5pbmcgPSB0b2tlbml6ZXIucmVtYWluaW5nKCk7XG5cdFx0XHRpbmRleCA9IGdldExvd2VzdEluZGV4KCByZW1haW5pbmcsIFtcblx0XHRcdFx0cXVvdGVNYXJrLFxuXHRcdFx0XHR0b2tlbml6ZXIuZGVsaW1pdGVyc1sgMCBdLFxuXHRcdFx0XHR0b2tlbml6ZXIuZGVsaW1pdGVyc1sgMSBdXG5cdFx0XHRdICk7XG5cdFx0XHRpZiAoIGluZGV4ID09PSAtMSApIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnUXVvdGVkIGF0dHJpYnV0ZSB2YWx1ZSBtdXN0IGhhdmUgYSBjbG9zaW5nIHF1b3RlJyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhaW5kZXggKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0dG9rZW5pemVyLnBvcyArPSBpbmRleDtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHR5cGU6IHR5cGVzLlRFWFQsXG5cdFx0XHRcdHZhbHVlOiByZW1haW5pbmcuc3Vic3RyKCAwLCBpbmRleCApXG5cdFx0XHR9O1xuXHRcdH07XG5cdFx0cmV0dXJuIGdldFRhZztcblx0fSggY29uZmlnX3R5cGVzLCBwYXJzZV9Ub2tlbml6ZXJfdXRpbHNfbWFrZVJlZ2V4TWF0Y2hlciwgcGFyc2VfVG9rZW5pemVyX3V0aWxzX2dldExvd2VzdEluZGV4ICk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9nZXRUZXh0X19nZXRUZXh0ID0gZnVuY3Rpb24oIHR5cGVzLCBnZXRMb3dlc3RJbmRleCApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBpbmRleCwgcmVtYWluaW5nLCBiYXJyaWVyO1xuXHRcdFx0cmVtYWluaW5nID0gdGhpcy5yZW1haW5pbmcoKTtcblx0XHRcdGJhcnJpZXIgPSB0aGlzLmluc2lkZSA/ICc8LycgKyB0aGlzLmluc2lkZSA6ICc8Jztcblx0XHRcdGlmICggdGhpcy5pbnNpZGUgJiYgIXRoaXMuaW50ZXJwb2xhdGVbIHRoaXMuaW5zaWRlIF0gKSB7XG5cdFx0XHRcdGluZGV4ID0gcmVtYWluaW5nLmluZGV4T2YoIGJhcnJpZXIgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGluZGV4ID0gZ2V0TG93ZXN0SW5kZXgoIHJlbWFpbmluZywgW1xuXHRcdFx0XHRcdGJhcnJpZXIsXG5cdFx0XHRcdFx0dGhpcy5kZWxpbWl0ZXJzWyAwIF0sXG5cdFx0XHRcdFx0dGhpcy50cmlwbGVEZWxpbWl0ZXJzWyAwIF1cblx0XHRcdFx0XSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhaW5kZXggKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBpbmRleCA9PT0gLTEgKSB7XG5cdFx0XHRcdGluZGV4ID0gcmVtYWluaW5nLmxlbmd0aDtcblx0XHRcdH1cblx0XHRcdHRoaXMucG9zICs9IGluZGV4O1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0dHlwZTogdHlwZXMuVEVYVCxcblx0XHRcdFx0dmFsdWU6IHJlbWFpbmluZy5zdWJzdHIoIDAsIGluZGV4IClcblx0XHRcdH07XG5cdFx0fTtcblx0fSggY29uZmlnX3R5cGVzLCBwYXJzZV9Ub2tlbml6ZXJfdXRpbHNfZ2V0TG93ZXN0SW5kZXggKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9nZXRMaXRlcmFsX2dldEJvb2xlYW5MaXRlcmFsID0gZnVuY3Rpb24oIHR5cGVzICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB0b2tlbml6ZXIgKSB7XG5cdFx0XHR2YXIgcmVtYWluaW5nID0gdG9rZW5pemVyLnJlbWFpbmluZygpO1xuXHRcdFx0aWYgKCByZW1haW5pbmcuc3Vic3RyKCAwLCA0ICkgPT09ICd0cnVlJyApIHtcblx0XHRcdFx0dG9rZW5pemVyLnBvcyArPSA0O1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHQ6IHR5cGVzLkJPT0xFQU5fTElURVJBTCxcblx0XHRcdFx0XHR2OiAndHJ1ZSdcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHRcdGlmICggcmVtYWluaW5nLnN1YnN0ciggMCwgNSApID09PSAnZmFsc2UnICkge1xuXHRcdFx0XHR0b2tlbml6ZXIucG9zICs9IDU7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0dDogdHlwZXMuQk9PTEVBTl9MSVRFUkFMLFxuXHRcdFx0XHRcdHY6ICdmYWxzZSdcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH07XG5cdH0oIGNvbmZpZ190eXBlcyApO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X2dldExpdGVyYWxfZ2V0T2JqZWN0TGl0ZXJhbF9nZXRLZXlWYWx1ZVBhaXIgPSBmdW5jdGlvbiggdHlwZXMsIGdldEtleSApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggdG9rZW5pemVyICkge1xuXHRcdFx0dmFyIHN0YXJ0LCBrZXksIHZhbHVlO1xuXHRcdFx0c3RhcnQgPSB0b2tlbml6ZXIucG9zO1xuXHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0a2V5ID0gZ2V0S2V5KCB0b2tlbml6ZXIgKTtcblx0XHRcdGlmICgga2V5ID09PSBudWxsICkge1xuXHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0aWYgKCAhdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnOicgKSApIHtcblx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdHZhbHVlID0gdG9rZW5pemVyLmdldEV4cHJlc3Npb24oKTtcblx0XHRcdGlmICggdmFsdWUgPT09IG51bGwgKSB7XG5cdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR0OiB0eXBlcy5LRVlfVkFMVUVfUEFJUixcblx0XHRcdFx0azoga2V5LFxuXHRcdFx0XHR2OiB2YWx1ZVxuXHRcdFx0fTtcblx0XHR9O1xuXHR9KCBjb25maWdfdHlwZXMsIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX3NoYXJlZF9nZXRLZXkgKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9nZXRMaXRlcmFsX2dldE9iamVjdExpdGVyYWxfZ2V0S2V5VmFsdWVQYWlycyA9IGZ1bmN0aW9uKCBnZXRLZXlWYWx1ZVBhaXIgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24gZ2V0S2V5VmFsdWVQYWlycyggdG9rZW5pemVyICkge1xuXHRcdFx0dmFyIHN0YXJ0LCBwYWlycywgcGFpciwga2V5VmFsdWVQYWlycztcblx0XHRcdHN0YXJ0ID0gdG9rZW5pemVyLnBvcztcblx0XHRcdHBhaXIgPSBnZXRLZXlWYWx1ZVBhaXIoIHRva2VuaXplciApO1xuXHRcdFx0aWYgKCBwYWlyID09PSBudWxsICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHBhaXJzID0gWyBwYWlyIF07XG5cdFx0XHRpZiAoIHRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJywnICkgKSB7XG5cdFx0XHRcdGtleVZhbHVlUGFpcnMgPSBnZXRLZXlWYWx1ZVBhaXJzKCB0b2tlbml6ZXIgKTtcblx0XHRcdFx0aWYgKCAha2V5VmFsdWVQYWlycyApIHtcblx0XHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHBhaXJzLmNvbmNhdCgga2V5VmFsdWVQYWlycyApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHBhaXJzO1xuXHRcdH07XG5cdH0oIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfZ2V0TGl0ZXJhbF9nZXRPYmplY3RMaXRlcmFsX2dldEtleVZhbHVlUGFpciApO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X2dldExpdGVyYWxfZ2V0T2JqZWN0TGl0ZXJhbF9fZ2V0T2JqZWN0TGl0ZXJhbCA9IGZ1bmN0aW9uKCB0eXBlcywgZ2V0S2V5VmFsdWVQYWlycyApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggdG9rZW5pemVyICkge1xuXHRcdFx0dmFyIHN0YXJ0LCBrZXlWYWx1ZVBhaXJzO1xuXHRcdFx0c3RhcnQgPSB0b2tlbml6ZXIucG9zO1xuXHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0aWYgKCAhdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAneycgKSApIHtcblx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGtleVZhbHVlUGFpcnMgPSBnZXRLZXlWYWx1ZVBhaXJzKCB0b2tlbml6ZXIgKTtcblx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdGlmICggIXRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJ30nICkgKSB7XG5cdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR0OiB0eXBlcy5PQkpFQ1RfTElURVJBTCxcblx0XHRcdFx0bToga2V5VmFsdWVQYWlyc1xuXHRcdFx0fTtcblx0XHR9O1xuXHR9KCBjb25maWdfdHlwZXMsIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfZ2V0TGl0ZXJhbF9nZXRPYmplY3RMaXRlcmFsX2dldEtleVZhbHVlUGFpcnMgKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fc2hhcmVkX2dldEV4cHJlc3Npb25MaXN0ID0gZnVuY3Rpb24gZ2V0RXhwcmVzc2lvbkxpc3QoIHRva2VuaXplciApIHtcblx0XHR2YXIgc3RhcnQsIGV4cHJlc3Npb25zLCBleHByLCBuZXh0O1xuXHRcdHN0YXJ0ID0gdG9rZW5pemVyLnBvcztcblx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0ZXhwciA9IHRva2VuaXplci5nZXRFeHByZXNzaW9uKCk7XG5cdFx0aWYgKCBleHByID09PSBudWxsICkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGV4cHJlc3Npb25zID0gWyBleHByIF07XG5cdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdGlmICggdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnLCcgKSApIHtcblx0XHRcdG5leHQgPSBnZXRFeHByZXNzaW9uTGlzdCggdG9rZW5pemVyICk7XG5cdFx0XHRpZiAoIG5leHQgPT09IG51bGwgKSB7XG5cdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRleHByZXNzaW9ucyA9IGV4cHJlc3Npb25zLmNvbmNhdCggbmV4dCApO1xuXHRcdH1cblx0XHRyZXR1cm4gZXhwcmVzc2lvbnM7XG5cdH07XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfZ2V0TGl0ZXJhbF9nZXRBcnJheUxpdGVyYWwgPSBmdW5jdGlvbiggdHlwZXMsIGdldEV4cHJlc3Npb25MaXN0ICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB0b2tlbml6ZXIgKSB7XG5cdFx0XHR2YXIgc3RhcnQsIGV4cHJlc3Npb25MaXN0O1xuXHRcdFx0c3RhcnQgPSB0b2tlbml6ZXIucG9zO1xuXHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0aWYgKCAhdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnWycgKSApIHtcblx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGV4cHJlc3Npb25MaXN0ID0gZ2V0RXhwcmVzc2lvbkxpc3QoIHRva2VuaXplciApO1xuXHRcdFx0aWYgKCAhdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnXScgKSApIHtcblx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHQ6IHR5cGVzLkFSUkFZX0xJVEVSQUwsXG5cdFx0XHRcdG06IGV4cHJlc3Npb25MaXN0XG5cdFx0XHR9O1xuXHRcdH07XG5cdH0oIGNvbmZpZ190eXBlcywgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fc2hhcmVkX2dldEV4cHJlc3Npb25MaXN0ICk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfZ2V0TGl0ZXJhbF9fZ2V0TGl0ZXJhbCA9IGZ1bmN0aW9uKCBnZXROdW1iZXJMaXRlcmFsLCBnZXRCb29sZWFuTGl0ZXJhbCwgZ2V0U3RyaW5nTGl0ZXJhbCwgZ2V0T2JqZWN0TGl0ZXJhbCwgZ2V0QXJyYXlMaXRlcmFsICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB0b2tlbml6ZXIgKSB7XG5cdFx0XHR2YXIgbGl0ZXJhbCA9IGdldE51bWJlckxpdGVyYWwoIHRva2VuaXplciApIHx8IGdldEJvb2xlYW5MaXRlcmFsKCB0b2tlbml6ZXIgKSB8fCBnZXRTdHJpbmdMaXRlcmFsKCB0b2tlbml6ZXIgKSB8fCBnZXRPYmplY3RMaXRlcmFsKCB0b2tlbml6ZXIgKSB8fCBnZXRBcnJheUxpdGVyYWwoIHRva2VuaXplciApO1xuXHRcdFx0cmV0dXJuIGxpdGVyYWw7XG5cdFx0fTtcblx0fSggcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9nZXRMaXRlcmFsX2dldE51bWJlckxpdGVyYWwsIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfZ2V0TGl0ZXJhbF9nZXRCb29sZWFuTGl0ZXJhbCwgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9nZXRMaXRlcmFsX2dldFN0cmluZ0xpdGVyYWxfX2dldFN0cmluZ0xpdGVyYWwsIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfZ2V0TGl0ZXJhbF9nZXRPYmplY3RMaXRlcmFsX19nZXRPYmplY3RMaXRlcmFsLCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X2dldExpdGVyYWxfZ2V0QXJyYXlMaXRlcmFsICk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfZ2V0UmVmZXJlbmNlID0gZnVuY3Rpb24oIHR5cGVzLCBtYWtlUmVnZXhNYXRjaGVyLCBnZXROYW1lICkge1xuXG5cdFx0dmFyIGdldERvdFJlZmluZW1lbnQsIGdldEFycmF5UmVmaW5lbWVudCwgZ2V0QXJyYXlNZW1iZXIsIGdsb2JhbHM7XG5cdFx0Z2V0RG90UmVmaW5lbWVudCA9IG1ha2VSZWdleE1hdGNoZXIoIC9eXFwuW2EtekEtWl8kMC05XSsvICk7XG5cdFx0Z2V0QXJyYXlSZWZpbmVtZW50ID0gZnVuY3Rpb24oIHRva2VuaXplciApIHtcblx0XHRcdHZhciBudW0gPSBnZXRBcnJheU1lbWJlciggdG9rZW5pemVyICk7XG5cdFx0XHRpZiAoIG51bSApIHtcblx0XHRcdFx0cmV0dXJuICcuJyArIG51bTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH07XG5cdFx0Z2V0QXJyYXlNZW1iZXIgPSBtYWtlUmVnZXhNYXRjaGVyKCAvXlxcWygwfFsxLTldWzAtOV0qKVxcXS8gKTtcblx0XHRnbG9iYWxzID0gL14oPzpBcnJheXxEYXRlfFJlZ0V4cHxkZWNvZGVVUklDb21wb25lbnR8ZGVjb2RlVVJJfGVuY29kZVVSSUNvbXBvbmVudHxlbmNvZGVVUkl8aXNGaW5pdGV8aXNOYU58cGFyc2VGbG9hdHxwYXJzZUludHxKU09OfE1hdGh8TmFOfHVuZGVmaW5lZHxudWxsKSQvO1xuXHRcdHJldHVybiBmdW5jdGlvbiggdG9rZW5pemVyICkge1xuXHRcdFx0dmFyIHN0YXJ0UG9zLCBhbmNlc3RvciwgbmFtZSwgZG90LCBjb21ibywgcmVmaW5lbWVudCwgbGFzdERvdEluZGV4O1xuXHRcdFx0c3RhcnRQb3MgPSB0b2tlbml6ZXIucG9zO1xuXHRcdFx0YW5jZXN0b3IgPSAnJztcblx0XHRcdHdoaWxlICggdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnLi4vJyApICkge1xuXHRcdFx0XHRhbmNlc3RvciArPSAnLi4vJztcblx0XHRcdH1cblx0XHRcdGlmICggIWFuY2VzdG9yICkge1xuXHRcdFx0XHRkb3QgPSB0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICcuJyApIHx8ICcnO1xuXHRcdFx0fVxuXHRcdFx0bmFtZSA9IGdldE5hbWUoIHRva2VuaXplciApIHx8ICcnO1xuXHRcdFx0aWYgKCAhYW5jZXN0b3IgJiYgIWRvdCAmJiBnbG9iYWxzLnRlc3QoIG5hbWUgKSApIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHR0OiB0eXBlcy5HTE9CQUwsXG5cdFx0XHRcdFx0djogbmFtZVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBuYW1lID09PSAndGhpcycgJiYgIWFuY2VzdG9yICYmICFkb3QgKSB7XG5cdFx0XHRcdG5hbWUgPSAnLic7XG5cdFx0XHRcdHN0YXJ0UG9zICs9IDM7XG5cdFx0XHR9XG5cdFx0XHRjb21ibyA9ICggYW5jZXN0b3IgfHwgZG90ICkgKyBuYW1lO1xuXHRcdFx0aWYgKCAhY29tYm8gKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0d2hpbGUgKCByZWZpbmVtZW50ID0gZ2V0RG90UmVmaW5lbWVudCggdG9rZW5pemVyICkgfHwgZ2V0QXJyYXlSZWZpbmVtZW50KCB0b2tlbml6ZXIgKSApIHtcblx0XHRcdFx0Y29tYm8gKz0gcmVmaW5lbWVudDtcblx0XHRcdH1cblx0XHRcdGlmICggdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnKCcgKSApIHtcblx0XHRcdFx0bGFzdERvdEluZGV4ID0gY29tYm8ubGFzdEluZGV4T2YoICcuJyApO1xuXHRcdFx0XHRpZiAoIGxhc3REb3RJbmRleCAhPT0gLTEgKSB7XG5cdFx0XHRcdFx0Y29tYm8gPSBjb21iby5zdWJzdHIoIDAsIGxhc3REb3RJbmRleCApO1xuXHRcdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydFBvcyArIGNvbWJvLmxlbmd0aDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0b2tlbml6ZXIucG9zIC09IDE7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHQ6IHR5cGVzLlJFRkVSRU5DRSxcblx0XHRcdFx0bjogY29tYm9cblx0XHRcdH07XG5cdFx0fTtcblx0fSggY29uZmlnX3R5cGVzLCBwYXJzZV9Ub2tlbml6ZXJfdXRpbHNfbWFrZVJlZ2V4TWF0Y2hlciwgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fc2hhcmVkX2dldE5hbWUgKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9nZXRCcmFja2V0ZWRFeHByZXNzaW9uID0gZnVuY3Rpb24oIHR5cGVzICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB0b2tlbml6ZXIgKSB7XG5cdFx0XHR2YXIgc3RhcnQsIGV4cHI7XG5cdFx0XHRzdGFydCA9IHRva2VuaXplci5wb3M7XG5cdFx0XHRpZiAoICF0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICcoJyApICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdGV4cHIgPSB0b2tlbml6ZXIuZ2V0RXhwcmVzc2lvbigpO1xuXHRcdFx0aWYgKCAhZXhwciApIHtcblx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdGlmICggIXRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJyknICkgKSB7XG5cdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR0OiB0eXBlcy5CUkFDS0VURUQsXG5cdFx0XHRcdHg6IGV4cHJcblx0XHRcdH07XG5cdFx0fTtcblx0fSggY29uZmlnX3R5cGVzICk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfX2dldFByaW1hcnkgPSBmdW5jdGlvbiggZ2V0TGl0ZXJhbCwgZ2V0UmVmZXJlbmNlLCBnZXRCcmFja2V0ZWRFeHByZXNzaW9uICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB0b2tlbml6ZXIgKSB7XG5cdFx0XHRyZXR1cm4gZ2V0TGl0ZXJhbCggdG9rZW5pemVyICkgfHwgZ2V0UmVmZXJlbmNlKCB0b2tlbml6ZXIgKSB8fCBnZXRCcmFja2V0ZWRFeHByZXNzaW9uKCB0b2tlbml6ZXIgKTtcblx0XHR9O1xuXHR9KCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X2dldExpdGVyYWxfX2dldExpdGVyYWwsIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFByaW1hcnlfZ2V0UmVmZXJlbmNlLCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRQcmltYXJ5X2dldEJyYWNrZXRlZEV4cHJlc3Npb24gKTtcblxuXHR2YXIgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fc2hhcmVkX2dldFJlZmluZW1lbnQgPSBmdW5jdGlvbiggdHlwZXMsIGdldE5hbWUgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24gZ2V0UmVmaW5lbWVudCggdG9rZW5pemVyICkge1xuXHRcdFx0dmFyIHN0YXJ0LCBuYW1lLCBleHByO1xuXHRcdFx0c3RhcnQgPSB0b2tlbml6ZXIucG9zO1xuXHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0aWYgKCB0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICcuJyApICkge1xuXHRcdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRcdGlmICggbmFtZSA9IGdldE5hbWUoIHRva2VuaXplciApICkge1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHR0OiB0eXBlcy5SRUZJTkVNRU5ULFxuXHRcdFx0XHRcdFx0bjogbmFtZVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblx0XHRcdFx0dG9rZW5pemVyLmV4cGVjdGVkKCAnYSBwcm9wZXJ0eSBuYW1lJyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICdbJyApICkge1xuXHRcdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRcdGV4cHIgPSB0b2tlbml6ZXIuZ2V0RXhwcmVzc2lvbigpO1xuXHRcdFx0XHRpZiAoICFleHByICkge1xuXHRcdFx0XHRcdHRva2VuaXplci5leHBlY3RlZCggJ2FuIGV4cHJlc3Npb24nICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0XHRpZiAoICF0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICddJyApICkge1xuXHRcdFx0XHRcdHRva2VuaXplci5leHBlY3RlZCggJ1wiXVwiJyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0dDogdHlwZXMuUkVGSU5FTUVOVCxcblx0XHRcdFx0XHR4OiBleHByXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9O1xuXHR9KCBjb25maWdfdHlwZXMsIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX3NoYXJlZF9nZXROYW1lICk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldE1lbWJlck9ySW52b2NhdGlvbiA9IGZ1bmN0aW9uKCB0eXBlcywgZ2V0UHJpbWFyeSwgZ2V0RXhwcmVzc2lvbkxpc3QsIGdldFJlZmluZW1lbnQgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHRva2VuaXplciApIHtcblx0XHRcdHZhciBjdXJyZW50LCBleHByZXNzaW9uLCByZWZpbmVtZW50LCBleHByZXNzaW9uTGlzdDtcblx0XHRcdGV4cHJlc3Npb24gPSBnZXRQcmltYXJ5KCB0b2tlbml6ZXIgKTtcblx0XHRcdGlmICggIWV4cHJlc3Npb24gKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0d2hpbGUgKCBleHByZXNzaW9uICkge1xuXHRcdFx0XHRjdXJyZW50ID0gdG9rZW5pemVyLnBvcztcblx0XHRcdFx0aWYgKCByZWZpbmVtZW50ID0gZ2V0UmVmaW5lbWVudCggdG9rZW5pemVyICkgKSB7XG5cdFx0XHRcdFx0ZXhwcmVzc2lvbiA9IHtcblx0XHRcdFx0XHRcdHQ6IHR5cGVzLk1FTUJFUixcblx0XHRcdFx0XHRcdHg6IGV4cHJlc3Npb24sXG5cdFx0XHRcdFx0XHRyOiByZWZpbmVtZW50XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fSBlbHNlIGlmICggdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCAnKCcgKSApIHtcblx0XHRcdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRcdFx0ZXhwcmVzc2lvbkxpc3QgPSBnZXRFeHByZXNzaW9uTGlzdCggdG9rZW5pemVyICk7XG5cdFx0XHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0XHRcdGlmICggIXRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJyknICkgKSB7XG5cdFx0XHRcdFx0XHR0b2tlbml6ZXIucG9zID0gY3VycmVudDtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRleHByZXNzaW9uID0ge1xuXHRcdFx0XHRcdFx0dDogdHlwZXMuSU5WT0NBVElPTixcblx0XHRcdFx0XHRcdHg6IGV4cHJlc3Npb25cblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdGlmICggZXhwcmVzc2lvbkxpc3QgKSB7XG5cdFx0XHRcdFx0XHRleHByZXNzaW9uLm8gPSBleHByZXNzaW9uTGlzdDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBleHByZXNzaW9uO1xuXHRcdH07XG5cdH0oIGNvbmZpZ190eXBlcywgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fZ2V0UHJpbWFyeV9fZ2V0UHJpbWFyeSwgcGFyc2VfVG9rZW5pemVyX2dldEV4cHJlc3Npb25fc2hhcmVkX2dldEV4cHJlc3Npb25MaXN0LCBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9zaGFyZWRfZ2V0UmVmaW5lbWVudCApO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRUeXBlT2YgPSBmdW5jdGlvbiggdHlwZXMsIGdldE1lbWJlck9ySW52b2NhdGlvbiApIHtcblxuXHRcdHZhciBnZXRUeXBlT2YsIG1ha2VQcmVmaXhTZXF1ZW5jZU1hdGNoZXI7XG5cdFx0bWFrZVByZWZpeFNlcXVlbmNlTWF0Y2hlciA9IGZ1bmN0aW9uKCBzeW1ib2wsIGZhbGx0aHJvdWdoICkge1xuXHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCB0b2tlbml6ZXIgKSB7XG5cdFx0XHRcdHZhciBzdGFydCwgZXhwcmVzc2lvbjtcblx0XHRcdFx0aWYgKCAhdG9rZW5pemVyLmdldFN0cmluZ01hdGNoKCBzeW1ib2wgKSApIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsbHRocm91Z2goIHRva2VuaXplciApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHN0YXJ0ID0gdG9rZW5pemVyLnBvcztcblx0XHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0XHRleHByZXNzaW9uID0gdG9rZW5pemVyLmdldEV4cHJlc3Npb24oKTtcblx0XHRcdFx0aWYgKCAhZXhwcmVzc2lvbiApIHtcblx0XHRcdFx0XHR0b2tlbml6ZXIuZXhwZWN0ZWQoICdhbiBleHByZXNzaW9uJyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0czogc3ltYm9sLFxuXHRcdFx0XHRcdG86IGV4cHJlc3Npb24sXG5cdFx0XHRcdFx0dDogdHlwZXMuUFJFRklYX09QRVJBVE9SXG5cdFx0XHRcdH07XG5cdFx0XHR9O1xuXHRcdH07XG5cdFx0KCBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBpLCBsZW4sIG1hdGNoZXIsIHByZWZpeE9wZXJhdG9ycywgZmFsbHRocm91Z2g7XG5cdFx0XHRwcmVmaXhPcGVyYXRvcnMgPSAnISB+ICsgLSB0eXBlb2YnLnNwbGl0KCAnICcgKTtcblx0XHRcdGZhbGx0aHJvdWdoID0gZ2V0TWVtYmVyT3JJbnZvY2F0aW9uO1xuXHRcdFx0Zm9yICggaSA9IDAsIGxlbiA9IHByZWZpeE9wZXJhdG9ycy5sZW5ndGg7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0bWF0Y2hlciA9IG1ha2VQcmVmaXhTZXF1ZW5jZU1hdGNoZXIoIHByZWZpeE9wZXJhdG9yc1sgaSBdLCBmYWxsdGhyb3VnaCApO1xuXHRcdFx0XHRmYWxsdGhyb3VnaCA9IG1hdGNoZXI7XG5cdFx0XHR9XG5cdFx0XHRnZXRUeXBlT2YgPSBmYWxsdGhyb3VnaDtcblx0XHR9KCkgKTtcblx0XHRyZXR1cm4gZ2V0VHlwZU9mO1xuXHR9KCBjb25maWdfdHlwZXMsIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldE1lbWJlck9ySW52b2NhdGlvbiApO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRMb2dpY2FsT3IgPSBmdW5jdGlvbiggdHlwZXMsIGdldFR5cGVPZiApIHtcblxuXHRcdHZhciBnZXRMb2dpY2FsT3IsIG1ha2VJbmZpeFNlcXVlbmNlTWF0Y2hlcjtcblx0XHRtYWtlSW5maXhTZXF1ZW5jZU1hdGNoZXIgPSBmdW5jdGlvbiggc3ltYm9sLCBmYWxsdGhyb3VnaCApIHtcblx0XHRcdHJldHVybiBmdW5jdGlvbiggdG9rZW5pemVyICkge1xuXHRcdFx0XHR2YXIgc3RhcnQsIGxlZnQsIHJpZ2h0O1xuXHRcdFx0XHRsZWZ0ID0gZmFsbHRocm91Z2goIHRva2VuaXplciApO1xuXHRcdFx0XHRpZiAoICFsZWZ0ICkge1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHdoaWxlICggdHJ1ZSApIHtcblx0XHRcdFx0XHRzdGFydCA9IHRva2VuaXplci5wb3M7XG5cdFx0XHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0XHRcdGlmICggIXRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggc3ltYm9sICkgKSB7XG5cdFx0XHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbGVmdDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCBzeW1ib2wgPT09ICdpbicgJiYgL1thLXpBLVpfJDAtOV0vLnRlc3QoIHRva2VuaXplci5yZW1haW5pbmcoKS5jaGFyQXQoIDAgKSApICkge1xuXHRcdFx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRcdFx0cmV0dXJuIGxlZnQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdFx0XHRyaWdodCA9IGZhbGx0aHJvdWdoKCB0b2tlbml6ZXIgKTtcblx0XHRcdFx0XHRpZiAoICFyaWdodCApIHtcblx0XHRcdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0XHRcdHJldHVybiBsZWZ0O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRsZWZ0ID0ge1xuXHRcdFx0XHRcdFx0dDogdHlwZXMuSU5GSVhfT1BFUkFUT1IsXG5cdFx0XHRcdFx0XHRzOiBzeW1ib2wsXG5cdFx0XHRcdFx0XHRvOiBbXG5cdFx0XHRcdFx0XHRcdGxlZnQsXG5cdFx0XHRcdFx0XHRcdHJpZ2h0XG5cdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHR9O1xuXHRcdCggZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgaSwgbGVuLCBtYXRjaGVyLCBpbmZpeE9wZXJhdG9ycywgZmFsbHRocm91Z2g7XG5cdFx0XHRpbmZpeE9wZXJhdG9ycyA9ICcqIC8gJSArIC0gPDwgPj4gPj4+IDwgPD0gPiA+PSBpbiBpbnN0YW5jZW9mID09ICE9ID09PSAhPT0gJiBeIHwgJiYgfHwnLnNwbGl0KCAnICcgKTtcblx0XHRcdGZhbGx0aHJvdWdoID0gZ2V0VHlwZU9mO1xuXHRcdFx0Zm9yICggaSA9IDAsIGxlbiA9IGluZml4T3BlcmF0b3JzLmxlbmd0aDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRtYXRjaGVyID0gbWFrZUluZml4U2VxdWVuY2VNYXRjaGVyKCBpbmZpeE9wZXJhdG9yc1sgaSBdLCBmYWxsdGhyb3VnaCApO1xuXHRcdFx0XHRmYWxsdGhyb3VnaCA9IG1hdGNoZXI7XG5cdFx0XHR9XG5cdFx0XHRnZXRMb2dpY2FsT3IgPSBmYWxsdGhyb3VnaDtcblx0XHR9KCkgKTtcblx0XHRyZXR1cm4gZ2V0TG9naWNhbE9yO1xuXHR9KCBjb25maWdfdHlwZXMsIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldFR5cGVPZiApO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9nZXRDb25kaXRpb25hbCA9IGZ1bmN0aW9uKCB0eXBlcywgZ2V0TG9naWNhbE9yICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCB0b2tlbml6ZXIgKSB7XG5cdFx0XHR2YXIgc3RhcnQsIGV4cHJlc3Npb24sIGlmVHJ1ZSwgaWZGYWxzZTtcblx0XHRcdGV4cHJlc3Npb24gPSBnZXRMb2dpY2FsT3IoIHRva2VuaXplciApO1xuXHRcdFx0aWYgKCAhZXhwcmVzc2lvbiApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRzdGFydCA9IHRva2VuaXplci5wb3M7XG5cdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRpZiAoICF0b2tlbml6ZXIuZ2V0U3RyaW5nTWF0Y2goICc/JyApICkge1xuXHRcdFx0XHR0b2tlbml6ZXIucG9zID0gc3RhcnQ7XG5cdFx0XHRcdHJldHVybiBleHByZXNzaW9uO1xuXHRcdFx0fVxuXHRcdFx0dG9rZW5pemVyLmFsbG93V2hpdGVzcGFjZSgpO1xuXHRcdFx0aWZUcnVlID0gdG9rZW5pemVyLmdldEV4cHJlc3Npb24oKTtcblx0XHRcdGlmICggIWlmVHJ1ZSApIHtcblx0XHRcdFx0dG9rZW5pemVyLnBvcyA9IHN0YXJ0O1xuXHRcdFx0XHRyZXR1cm4gZXhwcmVzc2lvbjtcblx0XHRcdH1cblx0XHRcdHRva2VuaXplci5hbGxvd1doaXRlc3BhY2UoKTtcblx0XHRcdGlmICggIXRva2VuaXplci5nZXRTdHJpbmdNYXRjaCggJzonICkgKSB7XG5cdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0cmV0dXJuIGV4cHJlc3Npb247XG5cdFx0XHR9XG5cdFx0XHR0b2tlbml6ZXIuYWxsb3dXaGl0ZXNwYWNlKCk7XG5cdFx0XHRpZkZhbHNlID0gdG9rZW5pemVyLmdldEV4cHJlc3Npb24oKTtcblx0XHRcdGlmICggIWlmRmFsc2UgKSB7XG5cdFx0XHRcdHRva2VuaXplci5wb3MgPSBzdGFydDtcblx0XHRcdFx0cmV0dXJuIGV4cHJlc3Npb247XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR0OiB0eXBlcy5DT05ESVRJT05BTCxcblx0XHRcdFx0bzogW1xuXHRcdFx0XHRcdGV4cHJlc3Npb24sXG5cdFx0XHRcdFx0aWZUcnVlLFxuXHRcdFx0XHRcdGlmRmFsc2Vcblx0XHRcdFx0XVxuXHRcdFx0fTtcblx0XHR9O1xuXHR9KCBjb25maWdfdHlwZXMsIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldExvZ2ljYWxPciApO1xuXG5cdHZhciBwYXJzZV9Ub2tlbml6ZXJfZ2V0RXhwcmVzc2lvbl9fZ2V0RXhwcmVzc2lvbiA9IGZ1bmN0aW9uKCBnZXRDb25kaXRpb25hbCApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiBnZXRDb25kaXRpb25hbCggdGhpcyApO1xuXHRcdH07XG5cdH0oIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX2dldENvbmRpdGlvbmFsICk7XG5cblx0dmFyIHBhcnNlX1Rva2VuaXplcl9fVG9rZW5pemVyID0gZnVuY3Rpb24oIGdldE11c3RhY2hlLCBnZXRDb21tZW50LCBnZXRUYWcsIGdldFRleHQsIGdldEV4cHJlc3Npb24sIGFsbG93V2hpdGVzcGFjZSwgZ2V0U3RyaW5nTWF0Y2ggKSB7XG5cblx0XHR2YXIgVG9rZW5pemVyO1xuXHRcdFRva2VuaXplciA9IGZ1bmN0aW9uKCBzdHIsIG9wdGlvbnMgKSB7XG5cdFx0XHR2YXIgdG9rZW47XG5cdFx0XHR0aGlzLnN0ciA9IHN0cjtcblx0XHRcdHRoaXMucG9zID0gMDtcblx0XHRcdHRoaXMuZGVsaW1pdGVycyA9IG9wdGlvbnMuZGVsaW1pdGVycztcblx0XHRcdHRoaXMudHJpcGxlRGVsaW1pdGVycyA9IG9wdGlvbnMudHJpcGxlRGVsaW1pdGVycztcblx0XHRcdHRoaXMuaW50ZXJwb2xhdGUgPSBvcHRpb25zLmludGVycG9sYXRlO1xuXHRcdFx0dGhpcy50b2tlbnMgPSBbXTtcblx0XHRcdHdoaWxlICggdGhpcy5wb3MgPCB0aGlzLnN0ci5sZW5ndGggKSB7XG5cdFx0XHRcdHRva2VuID0gdGhpcy5nZXRUb2tlbigpO1xuXHRcdFx0XHRpZiAoIHRva2VuID09PSBudWxsICYmIHRoaXMucmVtYWluaW5nKCkgKSB7XG5cdFx0XHRcdFx0dGhpcy5mYWlsKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy50b2tlbnMucHVzaCggdG9rZW4gKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdFRva2VuaXplci5wcm90b3R5cGUgPSB7XG5cdFx0XHRnZXRUb2tlbjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciB0b2tlbiA9IHRoaXMuZ2V0TXVzdGFjaGUoKSB8fCB0aGlzLmdldENvbW1lbnQoKSB8fCB0aGlzLmdldFRhZygpIHx8IHRoaXMuZ2V0VGV4dCgpO1xuXHRcdFx0XHRyZXR1cm4gdG9rZW47XG5cdFx0XHR9LFxuXHRcdFx0Z2V0TXVzdGFjaGU6IGdldE11c3RhY2hlLFxuXHRcdFx0Z2V0Q29tbWVudDogZ2V0Q29tbWVudCxcblx0XHRcdGdldFRhZzogZ2V0VGFnLFxuXHRcdFx0Z2V0VGV4dDogZ2V0VGV4dCxcblx0XHRcdGdldEV4cHJlc3Npb246IGdldEV4cHJlc3Npb24sXG5cdFx0XHRhbGxvd1doaXRlc3BhY2U6IGFsbG93V2hpdGVzcGFjZSxcblx0XHRcdGdldFN0cmluZ01hdGNoOiBnZXRTdHJpbmdNYXRjaCxcblx0XHRcdHJlbWFpbmluZzogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnN0ci5zdWJzdHJpbmcoIHRoaXMucG9zICk7XG5cdFx0XHR9LFxuXHRcdFx0ZmFpbDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBsYXN0MjAsIG5leHQyMDtcblx0XHRcdFx0bGFzdDIwID0gdGhpcy5zdHIuc3Vic3RyKCAwLCB0aGlzLnBvcyApLnN1YnN0ciggLTIwICk7XG5cdFx0XHRcdGlmICggbGFzdDIwLmxlbmd0aCA9PT0gMjAgKSB7XG5cdFx0XHRcdFx0bGFzdDIwID0gJy4uLicgKyBsYXN0MjA7XG5cdFx0XHRcdH1cblx0XHRcdFx0bmV4dDIwID0gdGhpcy5yZW1haW5pbmcoKS5zdWJzdHIoIDAsIDIwICk7XG5cdFx0XHRcdGlmICggbmV4dDIwLmxlbmd0aCA9PT0gMjAgKSB7XG5cdFx0XHRcdFx0bmV4dDIwID0gbmV4dDIwICsgJy4uLic7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnQ291bGQgbm90IHBhcnNlIHRlbXBsYXRlOiAnICsgKCBsYXN0MjAgPyBsYXN0MjAgKyAnPC0gJyA6ICcnICkgKyAnZmFpbGVkIGF0IGNoYXJhY3RlciAnICsgdGhpcy5wb3MgKyAnIC0+JyArIG5leHQyMCApO1xuXHRcdFx0fSxcblx0XHRcdGV4cGVjdGVkOiBmdW5jdGlvbiggdGhpbmcgKSB7XG5cdFx0XHRcdHZhciByZW1haW5pbmcgPSB0aGlzLnJlbWFpbmluZygpLnN1YnN0ciggMCwgNDAgKTtcblx0XHRcdFx0aWYgKCByZW1haW5pbmcubGVuZ3RoID09PSA0MCApIHtcblx0XHRcdFx0XHRyZW1haW5pbmcgKz0gJy4uLic7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnVG9rZW5pemVyIGZhaWxlZDogdW5leHBlY3RlZCBzdHJpbmcgXCInICsgcmVtYWluaW5nICsgJ1wiIChleHBlY3RlZCAnICsgdGhpbmcgKyAnKScgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBUb2tlbml6ZXI7XG5cdH0oIHBhcnNlX1Rva2VuaXplcl9nZXRNdXN0YWNoZV9fZ2V0TXVzdGFjaGUsIHBhcnNlX1Rva2VuaXplcl9nZXRDb21tZW50X2dldENvbW1lbnQsIHBhcnNlX1Rva2VuaXplcl9nZXRUYWdfX2dldFRhZywgcGFyc2VfVG9rZW5pemVyX2dldFRleHRfX2dldFRleHQsIHBhcnNlX1Rva2VuaXplcl9nZXRFeHByZXNzaW9uX19nZXRFeHByZXNzaW9uLCBwYXJzZV9Ub2tlbml6ZXJfdXRpbHNfYWxsb3dXaGl0ZXNwYWNlLCBwYXJzZV9Ub2tlbml6ZXJfdXRpbHNfZ2V0U3RyaW5nTWF0Y2ggKTtcblxuXHR2YXIgcGFyc2VfdG9rZW5pemUgPSBmdW5jdGlvbiggaW5pdE9wdGlvbnMsIHN0cmlwSHRtbENvbW1lbnRzLCBzdHJpcFN0YW5kYWxvbmVzLCBzdHJpcENvbW1lbnRUb2tlbnMsIFRva2VuaXplciApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggdGVtcGxhdGUsIG9wdGlvbnMgKSB7XG5cdFx0XHR2YXIgdG9rZW5pemVyLCB0b2tlbnM7XG5cdFx0XHRvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblx0XHRcdGlmICggb3B0aW9ucy5zdHJpcENvbW1lbnRzICE9PSBmYWxzZSApIHtcblx0XHRcdFx0dGVtcGxhdGUgPSBzdHJpcEh0bWxDb21tZW50cyggdGVtcGxhdGUgKTtcblx0XHRcdH1cblx0XHRcdHRva2VuaXplciA9IG5ldyBUb2tlbml6ZXIoIHRlbXBsYXRlLCB7XG5cdFx0XHRcdGRlbGltaXRlcnM6IG9wdGlvbnMuZGVsaW1pdGVycyB8fCBpbml0T3B0aW9ucy5kZWZhdWx0cy5kZWxpbWl0ZXJzLFxuXHRcdFx0XHR0cmlwbGVEZWxpbWl0ZXJzOiBvcHRpb25zLnRyaXBsZURlbGltaXRlcnMgfHwgaW5pdE9wdGlvbnMuZGVmYXVsdHMudHJpcGxlRGVsaW1pdGVycyxcblx0XHRcdFx0aW50ZXJwb2xhdGU6IHtcblx0XHRcdFx0XHRzY3JpcHQ6IG9wdGlvbnMuaW50ZXJwb2xhdGVTY3JpcHRzICE9PSBmYWxzZSA/IHRydWUgOiBmYWxzZSxcblx0XHRcdFx0XHRzdHlsZTogb3B0aW9ucy5pbnRlcnBvbGF0ZVN0eWxlcyAhPT0gZmFsc2UgPyB0cnVlIDogZmFsc2Vcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0dG9rZW5zID0gdG9rZW5pemVyLnRva2Vucztcblx0XHRcdHN0cmlwU3RhbmRhbG9uZXMoIHRva2VucyApO1xuXHRcdFx0c3RyaXBDb21tZW50VG9rZW5zKCB0b2tlbnMgKTtcblx0XHRcdHJldHVybiB0b2tlbnM7XG5cdFx0fTtcblx0fSggY29uZmlnX2luaXRPcHRpb25zLCBwYXJzZV91dGlsc19zdHJpcEh0bWxDb21tZW50cywgcGFyc2VfdXRpbHNfc3RyaXBTdGFuZGFsb25lcywgcGFyc2VfdXRpbHNfc3RyaXBDb21tZW50VG9rZW5zLCBwYXJzZV9Ub2tlbml6ZXJfX1Rva2VuaXplciApO1xuXG5cdHZhciBwYXJzZV9QYXJzZXJfZ2V0VGV4dF9UZXh0U3R1Yl9fVGV4dFN0dWIgPSBmdW5jdGlvbiggdHlwZXMgKSB7XG5cblx0XHR2YXIgVGV4dFN0dWIsIGh0bWxFbnRpdGllcywgY29udHJvbENoYXJhY3RlcnMsIG5hbWVkRW50aXR5UGF0dGVybiwgaGV4RW50aXR5UGF0dGVybiwgZGVjaW1hbEVudGl0eVBhdHRlcm4sIHZhbGlkYXRlQ29kZSwgZGVjb2RlQ2hhcmFjdGVyUmVmZXJlbmNlcywgd2hpdGVzcGFjZTtcblx0XHRUZXh0U3R1YiA9IGZ1bmN0aW9uKCB0b2tlbiwgcHJlc2VydmVXaGl0ZXNwYWNlICkge1xuXHRcdFx0dGhpcy50ZXh0ID0gcHJlc2VydmVXaGl0ZXNwYWNlID8gdG9rZW4udmFsdWUgOiB0b2tlbi52YWx1ZS5yZXBsYWNlKCB3aGl0ZXNwYWNlLCAnICcgKTtcblx0XHR9O1xuXHRcdFRleHRTdHViLnByb3RvdHlwZSA9IHtcblx0XHRcdHR5cGU6IHR5cGVzLlRFWFQsXG5cdFx0XHR0b0pTT046IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5kZWNvZGVkIHx8ICggdGhpcy5kZWNvZGVkID0gZGVjb2RlQ2hhcmFjdGVyUmVmZXJlbmNlcyggdGhpcy50ZXh0ICkgKTtcblx0XHRcdH0sXG5cdFx0XHR0b1N0cmluZzogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnRleHQ7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRodG1sRW50aXRpZXMgPSB7XG5cdFx0XHRxdW90OiAzNCxcblx0XHRcdGFtcDogMzgsXG5cdFx0XHRhcG9zOiAzOSxcblx0XHRcdGx0OiA2MCxcblx0XHRcdGd0OiA2Mixcblx0XHRcdG5ic3A6IDE2MCxcblx0XHRcdGlleGNsOiAxNjEsXG5cdFx0XHRjZW50OiAxNjIsXG5cdFx0XHRwb3VuZDogMTYzLFxuXHRcdFx0Y3VycmVuOiAxNjQsXG5cdFx0XHR5ZW46IDE2NSxcblx0XHRcdGJydmJhcjogMTY2LFxuXHRcdFx0c2VjdDogMTY3LFxuXHRcdFx0dW1sOiAxNjgsXG5cdFx0XHRjb3B5OiAxNjksXG5cdFx0XHRvcmRmOiAxNzAsXG5cdFx0XHRsYXF1bzogMTcxLFxuXHRcdFx0bm90OiAxNzIsXG5cdFx0XHRzaHk6IDE3Myxcblx0XHRcdHJlZzogMTc0LFxuXHRcdFx0bWFjcjogMTc1LFxuXHRcdFx0ZGVnOiAxNzYsXG5cdFx0XHRwbHVzbW46IDE3Nyxcblx0XHRcdHN1cDI6IDE3OCxcblx0XHRcdHN1cDM6IDE3OSxcblx0XHRcdGFjdXRlOiAxODAsXG5cdFx0XHRtaWNybzogMTgxLFxuXHRcdFx0cGFyYTogMTgyLFxuXHRcdFx0bWlkZG90OiAxODMsXG5cdFx0XHRjZWRpbDogMTg0LFxuXHRcdFx0c3VwMTogMTg1LFxuXHRcdFx0b3JkbTogMTg2LFxuXHRcdFx0cmFxdW86IDE4Nyxcblx0XHRcdGZyYWMxNDogMTg4LFxuXHRcdFx0ZnJhYzEyOiAxODksXG5cdFx0XHRmcmFjMzQ6IDE5MCxcblx0XHRcdGlxdWVzdDogMTkxLFxuXHRcdFx0QWdyYXZlOiAxOTIsXG5cdFx0XHRBYWN1dGU6IDE5Myxcblx0XHRcdEFjaXJjOiAxOTQsXG5cdFx0XHRBdGlsZGU6IDE5NSxcblx0XHRcdEF1bWw6IDE5Nixcblx0XHRcdEFyaW5nOiAxOTcsXG5cdFx0XHRBRWxpZzogMTk4LFxuXHRcdFx0Q2NlZGlsOiAxOTksXG5cdFx0XHRFZ3JhdmU6IDIwMCxcblx0XHRcdEVhY3V0ZTogMjAxLFxuXHRcdFx0RWNpcmM6IDIwMixcblx0XHRcdEV1bWw6IDIwMyxcblx0XHRcdElncmF2ZTogMjA0LFxuXHRcdFx0SWFjdXRlOiAyMDUsXG5cdFx0XHRJY2lyYzogMjA2LFxuXHRcdFx0SXVtbDogMjA3LFxuXHRcdFx0RVRIOiAyMDgsXG5cdFx0XHROdGlsZGU6IDIwOSxcblx0XHRcdE9ncmF2ZTogMjEwLFxuXHRcdFx0T2FjdXRlOiAyMTEsXG5cdFx0XHRPY2lyYzogMjEyLFxuXHRcdFx0T3RpbGRlOiAyMTMsXG5cdFx0XHRPdW1sOiAyMTQsXG5cdFx0XHR0aW1lczogMjE1LFxuXHRcdFx0T3NsYXNoOiAyMTYsXG5cdFx0XHRVZ3JhdmU6IDIxNyxcblx0XHRcdFVhY3V0ZTogMjE4LFxuXHRcdFx0VWNpcmM6IDIxOSxcblx0XHRcdFV1bWw6IDIyMCxcblx0XHRcdFlhY3V0ZTogMjIxLFxuXHRcdFx0VEhPUk46IDIyMixcblx0XHRcdHN6bGlnOiAyMjMsXG5cdFx0XHRhZ3JhdmU6IDIyNCxcblx0XHRcdGFhY3V0ZTogMjI1LFxuXHRcdFx0YWNpcmM6IDIyNixcblx0XHRcdGF0aWxkZTogMjI3LFxuXHRcdFx0YXVtbDogMjI4LFxuXHRcdFx0YXJpbmc6IDIyOSxcblx0XHRcdGFlbGlnOiAyMzAsXG5cdFx0XHRjY2VkaWw6IDIzMSxcblx0XHRcdGVncmF2ZTogMjMyLFxuXHRcdFx0ZWFjdXRlOiAyMzMsXG5cdFx0XHRlY2lyYzogMjM0LFxuXHRcdFx0ZXVtbDogMjM1LFxuXHRcdFx0aWdyYXZlOiAyMzYsXG5cdFx0XHRpYWN1dGU6IDIzNyxcblx0XHRcdGljaXJjOiAyMzgsXG5cdFx0XHRpdW1sOiAyMzksXG5cdFx0XHRldGg6IDI0MCxcblx0XHRcdG50aWxkZTogMjQxLFxuXHRcdFx0b2dyYXZlOiAyNDIsXG5cdFx0XHRvYWN1dGU6IDI0Myxcblx0XHRcdG9jaXJjOiAyNDQsXG5cdFx0XHRvdGlsZGU6IDI0NSxcblx0XHRcdG91bWw6IDI0Nixcblx0XHRcdGRpdmlkZTogMjQ3LFxuXHRcdFx0b3NsYXNoOiAyNDgsXG5cdFx0XHR1Z3JhdmU6IDI0OSxcblx0XHRcdHVhY3V0ZTogMjUwLFxuXHRcdFx0dWNpcmM6IDI1MSxcblx0XHRcdHV1bWw6IDI1Mixcblx0XHRcdHlhY3V0ZTogMjUzLFxuXHRcdFx0dGhvcm46IDI1NCxcblx0XHRcdHl1bWw6IDI1NSxcblx0XHRcdE9FbGlnOiAzMzgsXG5cdFx0XHRvZWxpZzogMzM5LFxuXHRcdFx0U2Nhcm9uOiAzNTIsXG5cdFx0XHRzY2Fyb246IDM1Myxcblx0XHRcdFl1bWw6IDM3Nixcblx0XHRcdGZub2Y6IDQwMixcblx0XHRcdGNpcmM6IDcxMCxcblx0XHRcdHRpbGRlOiA3MzIsXG5cdFx0XHRBbHBoYTogOTEzLFxuXHRcdFx0QmV0YTogOTE0LFxuXHRcdFx0R2FtbWE6IDkxNSxcblx0XHRcdERlbHRhOiA5MTYsXG5cdFx0XHRFcHNpbG9uOiA5MTcsXG5cdFx0XHRaZXRhOiA5MTgsXG5cdFx0XHRFdGE6IDkxOSxcblx0XHRcdFRoZXRhOiA5MjAsXG5cdFx0XHRJb3RhOiA5MjEsXG5cdFx0XHRLYXBwYTogOTIyLFxuXHRcdFx0TGFtYmRhOiA5MjMsXG5cdFx0XHRNdTogOTI0LFxuXHRcdFx0TnU6IDkyNSxcblx0XHRcdFhpOiA5MjYsXG5cdFx0XHRPbWljcm9uOiA5MjcsXG5cdFx0XHRQaTogOTI4LFxuXHRcdFx0UmhvOiA5MjksXG5cdFx0XHRTaWdtYTogOTMxLFxuXHRcdFx0VGF1OiA5MzIsXG5cdFx0XHRVcHNpbG9uOiA5MzMsXG5cdFx0XHRQaGk6IDkzNCxcblx0XHRcdENoaTogOTM1LFxuXHRcdFx0UHNpOiA5MzYsXG5cdFx0XHRPbWVnYTogOTM3LFxuXHRcdFx0YWxwaGE6IDk0NSxcblx0XHRcdGJldGE6IDk0Nixcblx0XHRcdGdhbW1hOiA5NDcsXG5cdFx0XHRkZWx0YTogOTQ4LFxuXHRcdFx0ZXBzaWxvbjogOTQ5LFxuXHRcdFx0emV0YTogOTUwLFxuXHRcdFx0ZXRhOiA5NTEsXG5cdFx0XHR0aGV0YTogOTUyLFxuXHRcdFx0aW90YTogOTUzLFxuXHRcdFx0a2FwcGE6IDk1NCxcblx0XHRcdGxhbWJkYTogOTU1LFxuXHRcdFx0bXU6IDk1Nixcblx0XHRcdG51OiA5NTcsXG5cdFx0XHR4aTogOTU4LFxuXHRcdFx0b21pY3JvbjogOTU5LFxuXHRcdFx0cGk6IDk2MCxcblx0XHRcdHJobzogOTYxLFxuXHRcdFx0c2lnbWFmOiA5NjIsXG5cdFx0XHRzaWdtYTogOTYzLFxuXHRcdFx0dGF1OiA5NjQsXG5cdFx0XHR1cHNpbG9uOiA5NjUsXG5cdFx0XHRwaGk6IDk2Nixcblx0XHRcdGNoaTogOTY3LFxuXHRcdFx0cHNpOiA5NjgsXG5cdFx0XHRvbWVnYTogOTY5LFxuXHRcdFx0dGhldGFzeW06IDk3Nyxcblx0XHRcdHVwc2loOiA5NzgsXG5cdFx0XHRwaXY6IDk4Mixcblx0XHRcdGVuc3A6IDgxOTQsXG5cdFx0XHRlbXNwOiA4MTk1LFxuXHRcdFx0dGhpbnNwOiA4MjAxLFxuXHRcdFx0enduajogODIwNCxcblx0XHRcdHp3ajogODIwNSxcblx0XHRcdGxybTogODIwNixcblx0XHRcdHJsbTogODIwNyxcblx0XHRcdG5kYXNoOiA4MjExLFxuXHRcdFx0bWRhc2g6IDgyMTIsXG5cdFx0XHRsc3F1bzogODIxNixcblx0XHRcdHJzcXVvOiA4MjE3LFxuXHRcdFx0c2JxdW86IDgyMTgsXG5cdFx0XHRsZHF1bzogODIyMCxcblx0XHRcdHJkcXVvOiA4MjIxLFxuXHRcdFx0YmRxdW86IDgyMjIsXG5cdFx0XHRkYWdnZXI6IDgyMjQsXG5cdFx0XHREYWdnZXI6IDgyMjUsXG5cdFx0XHRidWxsOiA4MjI2LFxuXHRcdFx0aGVsbGlwOiA4MjMwLFxuXHRcdFx0cGVybWlsOiA4MjQwLFxuXHRcdFx0cHJpbWU6IDgyNDIsXG5cdFx0XHRQcmltZTogODI0Myxcblx0XHRcdGxzYXF1bzogODI0OSxcblx0XHRcdHJzYXF1bzogODI1MCxcblx0XHRcdG9saW5lOiA4MjU0LFxuXHRcdFx0ZnJhc2w6IDgyNjAsXG5cdFx0XHRldXJvOiA4MzY0LFxuXHRcdFx0aW1hZ2U6IDg0NjUsXG5cdFx0XHR3ZWllcnA6IDg0NzIsXG5cdFx0XHRyZWFsOiA4NDc2LFxuXHRcdFx0dHJhZGU6IDg0ODIsXG5cdFx0XHRhbGVmc3ltOiA4NTAxLFxuXHRcdFx0bGFycjogODU5Mixcblx0XHRcdHVhcnI6IDg1OTMsXG5cdFx0XHRyYXJyOiA4NTk0LFxuXHRcdFx0ZGFycjogODU5NSxcblx0XHRcdGhhcnI6IDg1OTYsXG5cdFx0XHRjcmFycjogODYyOSxcblx0XHRcdGxBcnI6IDg2NTYsXG5cdFx0XHR1QXJyOiA4NjU3LFxuXHRcdFx0ckFycjogODY1OCxcblx0XHRcdGRBcnI6IDg2NTksXG5cdFx0XHRoQXJyOiA4NjYwLFxuXHRcdFx0Zm9yYWxsOiA4NzA0LFxuXHRcdFx0cGFydDogODcwNixcblx0XHRcdGV4aXN0OiA4NzA3LFxuXHRcdFx0ZW1wdHk6IDg3MDksXG5cdFx0XHRuYWJsYTogODcxMSxcblx0XHRcdGlzaW46IDg3MTIsXG5cdFx0XHRub3RpbjogODcxMyxcblx0XHRcdG5pOiA4NzE1LFxuXHRcdFx0cHJvZDogODcxOSxcblx0XHRcdHN1bTogODcyMSxcblx0XHRcdG1pbnVzOiA4NzIyLFxuXHRcdFx0bG93YXN0OiA4NzI3LFxuXHRcdFx0cmFkaWM6IDg3MzAsXG5cdFx0XHRwcm9wOiA4NzMzLFxuXHRcdFx0aW5maW46IDg3MzQsXG5cdFx0XHRhbmc6IDg3MzYsXG5cdFx0XHRhbmQ6IDg3NDMsXG5cdFx0XHRvcjogODc0NCxcblx0XHRcdGNhcDogODc0NSxcblx0XHRcdGN1cDogODc0Nixcblx0XHRcdCdpbnQnOiA4NzQ3LFxuXHRcdFx0dGhlcmU0OiA4NzU2LFxuXHRcdFx0c2ltOiA4NzY0LFxuXHRcdFx0Y29uZzogODc3Myxcblx0XHRcdGFzeW1wOiA4Nzc2LFxuXHRcdFx0bmU6IDg4MDAsXG5cdFx0XHRlcXVpdjogODgwMSxcblx0XHRcdGxlOiA4ODA0LFxuXHRcdFx0Z2U6IDg4MDUsXG5cdFx0XHRzdWI6IDg4MzQsXG5cdFx0XHRzdXA6IDg4MzUsXG5cdFx0XHRuc3ViOiA4ODM2LFxuXHRcdFx0c3ViZTogODgzOCxcblx0XHRcdHN1cGU6IDg4MzksXG5cdFx0XHRvcGx1czogODg1Myxcblx0XHRcdG90aW1lczogODg1NSxcblx0XHRcdHBlcnA6IDg4NjksXG5cdFx0XHRzZG90OiA4OTAxLFxuXHRcdFx0bGNlaWw6IDg5NjgsXG5cdFx0XHRyY2VpbDogODk2OSxcblx0XHRcdGxmbG9vcjogODk3MCxcblx0XHRcdHJmbG9vcjogODk3MSxcblx0XHRcdGxhbmc6IDkwMDEsXG5cdFx0XHRyYW5nOiA5MDAyLFxuXHRcdFx0bG96OiA5Njc0LFxuXHRcdFx0c3BhZGVzOiA5ODI0LFxuXHRcdFx0Y2x1YnM6IDk4MjcsXG5cdFx0XHRoZWFydHM6IDk4MjksXG5cdFx0XHRkaWFtczogOTgzMFxuXHRcdH07XG5cdFx0Y29udHJvbENoYXJhY3RlcnMgPSBbXG5cdFx0XHQ4MzY0LFxuXHRcdFx0MTI5LFxuXHRcdFx0ODIxOCxcblx0XHRcdDQwMixcblx0XHRcdDgyMjIsXG5cdFx0XHQ4MjMwLFxuXHRcdFx0ODIyNCxcblx0XHRcdDgyMjUsXG5cdFx0XHQ3MTAsXG5cdFx0XHQ4MjQwLFxuXHRcdFx0MzUyLFxuXHRcdFx0ODI0OSxcblx0XHRcdDMzOCxcblx0XHRcdDE0MSxcblx0XHRcdDM4MSxcblx0XHRcdDE0Myxcblx0XHRcdDE0NCxcblx0XHRcdDgyMTYsXG5cdFx0XHQ4MjE3LFxuXHRcdFx0ODIyMCxcblx0XHRcdDgyMjEsXG5cdFx0XHQ4MjI2LFxuXHRcdFx0ODIxMSxcblx0XHRcdDgyMTIsXG5cdFx0XHQ3MzIsXG5cdFx0XHQ4NDgyLFxuXHRcdFx0MzUzLFxuXHRcdFx0ODI1MCxcblx0XHRcdDMzOSxcblx0XHRcdDE1Nyxcblx0XHRcdDM4Mixcblx0XHRcdDM3NlxuXHRcdF07XG5cdFx0bmFtZWRFbnRpdHlQYXR0ZXJuID0gbmV3IFJlZ0V4cCggJyYoJyArIE9iamVjdC5rZXlzKCBodG1sRW50aXRpZXMgKS5qb2luKCAnfCcgKSArICcpOz8nLCAnZycgKTtcblx0XHRoZXhFbnRpdHlQYXR0ZXJuID0gLyYjeChbMC05XSspOz8vZztcblx0XHRkZWNpbWFsRW50aXR5UGF0dGVybiA9IC8mIyhbMC05XSspOz8vZztcblx0XHR2YWxpZGF0ZUNvZGUgPSBmdW5jdGlvbiggY29kZSApIHtcblx0XHRcdGlmICggIWNvZGUgKSB7XG5cdFx0XHRcdHJldHVybiA2NTUzMztcblx0XHRcdH1cblx0XHRcdGlmICggY29kZSA9PT0gMTAgKSB7XG5cdFx0XHRcdHJldHVybiAzMjtcblx0XHRcdH1cblx0XHRcdGlmICggY29kZSA8IDEyOCApIHtcblx0XHRcdFx0cmV0dXJuIGNvZGU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGNvZGUgPD0gMTU5ICkge1xuXHRcdFx0XHRyZXR1cm4gY29udHJvbENoYXJhY3RlcnNbIGNvZGUgLSAxMjggXTtcblx0XHRcdH1cblx0XHRcdGlmICggY29kZSA8IDU1Mjk2ICkge1xuXHRcdFx0XHRyZXR1cm4gY29kZTtcblx0XHRcdH1cblx0XHRcdGlmICggY29kZSA8PSA1NzM0MyApIHtcblx0XHRcdFx0cmV0dXJuIDY1NTMzO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBjb2RlIDw9IDY1NTM1ICkge1xuXHRcdFx0XHRyZXR1cm4gY29kZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiA2NTUzMztcblx0XHR9O1xuXHRcdGRlY29kZUNoYXJhY3RlclJlZmVyZW5jZXMgPSBmdW5jdGlvbiggaHRtbCApIHtcblx0XHRcdHZhciByZXN1bHQ7XG5cdFx0XHRyZXN1bHQgPSBodG1sLnJlcGxhY2UoIG5hbWVkRW50aXR5UGF0dGVybiwgZnVuY3Rpb24oIG1hdGNoLCBuYW1lICkge1xuXHRcdFx0XHRpZiAoIGh0bWxFbnRpdGllc1sgbmFtZSBdICkge1xuXHRcdFx0XHRcdHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKCBodG1sRW50aXRpZXNbIG5hbWUgXSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBtYXRjaDtcblx0XHRcdH0gKTtcblx0XHRcdHJlc3VsdCA9IHJlc3VsdC5yZXBsYWNlKCBoZXhFbnRpdHlQYXR0ZXJuLCBmdW5jdGlvbiggbWF0Y2gsIGhleCApIHtcblx0XHRcdFx0cmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoIHZhbGlkYXRlQ29kZSggcGFyc2VJbnQoIGhleCwgMTYgKSApICk7XG5cdFx0XHR9ICk7XG5cdFx0XHRyZXN1bHQgPSByZXN1bHQucmVwbGFjZSggZGVjaW1hbEVudGl0eVBhdHRlcm4sIGZ1bmN0aW9uKCBtYXRjaCwgY2hhckNvZGUgKSB7XG5cdFx0XHRcdHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKCB2YWxpZGF0ZUNvZGUoIGNoYXJDb2RlICkgKTtcblx0XHRcdH0gKTtcblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fTtcblx0XHR3aGl0ZXNwYWNlID0gL1xccysvZztcblx0XHRyZXR1cm4gVGV4dFN0dWI7XG5cdH0oIGNvbmZpZ190eXBlcyApO1xuXG5cdHZhciBwYXJzZV9QYXJzZXJfZ2V0VGV4dF9fZ2V0VGV4dCA9IGZ1bmN0aW9uKCB0eXBlcywgVGV4dFN0dWIgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHRva2VuLCBwcmVzZXJ2ZVdoaXRlc3BhY2UgKSB7XG5cdFx0XHRpZiAoIHRva2VuLnR5cGUgPT09IHR5cGVzLlRFWFQgKSB7XG5cdFx0XHRcdHRoaXMucG9zICs9IDE7XG5cdFx0XHRcdHJldHVybiBuZXcgVGV4dFN0dWIoIHRva2VuLCBwcmVzZXJ2ZVdoaXRlc3BhY2UgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH07XG5cdH0oIGNvbmZpZ190eXBlcywgcGFyc2VfUGFyc2VyX2dldFRleHRfVGV4dFN0dWJfX1RleHRTdHViICk7XG5cblx0dmFyIHBhcnNlX1BhcnNlcl9nZXRDb21tZW50X0NvbW1lbnRTdHViX19Db21tZW50U3R1YiA9IGZ1bmN0aW9uKCB0eXBlcyApIHtcblxuXHRcdHZhciBDb21tZW50U3R1Yjtcblx0XHRDb21tZW50U3R1YiA9IGZ1bmN0aW9uKCB0b2tlbiApIHtcblx0XHRcdHRoaXMuY29udGVudCA9IHRva2VuLmNvbnRlbnQ7XG5cdFx0fTtcblx0XHRDb21tZW50U3R1Yi5wcm90b3R5cGUgPSB7XG5cdFx0XHR0b0pTT046IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHQ6IHR5cGVzLkNPTU1FTlQsXG5cdFx0XHRcdFx0ZjogdGhpcy5jb250ZW50XG5cdFx0XHRcdH07XG5cdFx0XHR9LFxuXHRcdFx0dG9TdHJpbmc6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gJzwhLS0nICsgdGhpcy5jb250ZW50ICsgJy0tPic7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gQ29tbWVudFN0dWI7XG5cdH0oIGNvbmZpZ190eXBlcyApO1xuXG5cdHZhciBwYXJzZV9QYXJzZXJfZ2V0Q29tbWVudF9fZ2V0Q29tbWVudCA9IGZ1bmN0aW9uKCB0eXBlcywgQ29tbWVudFN0dWIgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHRva2VuICkge1xuXHRcdFx0aWYgKCB0b2tlbi50eXBlID09PSB0eXBlcy5DT01NRU5UICkge1xuXHRcdFx0XHR0aGlzLnBvcyArPSAxO1xuXHRcdFx0XHRyZXR1cm4gbmV3IENvbW1lbnRTdHViKCB0b2tlbiwgdGhpcy5wcmVzZXJ2ZVdoaXRlc3BhY2UgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH07XG5cdH0oIGNvbmZpZ190eXBlcywgcGFyc2VfUGFyc2VyX2dldENvbW1lbnRfQ29tbWVudFN0dWJfX0NvbW1lbnRTdHViICk7XG5cblx0dmFyIHBhcnNlX1BhcnNlcl9nZXRNdXN0YWNoZV9FeHByZXNzaW9uU3R1Yl9fRXhwcmVzc2lvblN0dWIgPSBmdW5jdGlvbiggdHlwZXMsIGlzT2JqZWN0ICkge1xuXG5cdFx0dmFyIEV4cHJlc3Npb25TdHViID0gZnVuY3Rpb24oIHRva2VuICkge1xuXHRcdFx0dGhpcy5yZWZzID0gW107XG5cdFx0XHRnZXRSZWZzKCB0b2tlbiwgdGhpcy5yZWZzICk7XG5cdFx0XHR0aGlzLnN0ciA9IHN0cmluZ2lmeSggdG9rZW4sIHRoaXMucmVmcyApO1xuXHRcdH07XG5cdFx0RXhwcmVzc2lvblN0dWIucHJvdG90eXBlID0ge1xuXHRcdFx0dG9KU09OOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0aWYgKCB0aGlzLmpzb24gKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuanNvbjtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLmpzb24gPSB7XG5cdFx0XHRcdFx0cjogdGhpcy5yZWZzLFxuXHRcdFx0XHRcdHM6IHRoaXMuc3RyXG5cdFx0XHRcdH07XG5cdFx0XHRcdHJldHVybiB0aGlzLmpzb247XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gRXhwcmVzc2lvblN0dWI7XG5cblx0XHRmdW5jdGlvbiBxdW90ZVN0cmluZ0xpdGVyYWwoIHN0ciApIHtcblx0XHRcdHJldHVybiBKU09OLnN0cmluZ2lmeSggU3RyaW5nKCBzdHIgKSApO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldFJlZnMoIHRva2VuLCByZWZzICkge1xuXHRcdFx0dmFyIGksIGxpc3Q7XG5cdFx0XHRpZiAoIHRva2VuLnQgPT09IHR5cGVzLlJFRkVSRU5DRSApIHtcblx0XHRcdFx0aWYgKCByZWZzLmluZGV4T2YoIHRva2VuLm4gKSA9PT0gLTEgKSB7XG5cdFx0XHRcdFx0cmVmcy51bnNoaWZ0KCB0b2tlbi5uICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGxpc3QgPSB0b2tlbi5vIHx8IHRva2VuLm07XG5cdFx0XHRpZiAoIGxpc3QgKSB7XG5cdFx0XHRcdGlmICggaXNPYmplY3QoIGxpc3QgKSApIHtcblx0XHRcdFx0XHRnZXRSZWZzKCBsaXN0LCByZWZzICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aSA9IGxpc3QubGVuZ3RoO1xuXHRcdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdFx0Z2V0UmVmcyggbGlzdFsgaSBdLCByZWZzICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRva2VuLnggKSB7XG5cdFx0XHRcdGdldFJlZnMoIHRva2VuLngsIHJlZnMgKTtcblx0XHRcdH1cblx0XHRcdGlmICggdG9rZW4uciApIHtcblx0XHRcdFx0Z2V0UmVmcyggdG9rZW4uciwgcmVmcyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0b2tlbi52ICkge1xuXHRcdFx0XHRnZXRSZWZzKCB0b2tlbi52LCByZWZzICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gc3RyaW5naWZ5KCB0b2tlbiwgcmVmcyApIHtcblx0XHRcdHZhciBtYXAgPSBmdW5jdGlvbiggaXRlbSApIHtcblx0XHRcdFx0cmV0dXJuIHN0cmluZ2lmeSggaXRlbSwgcmVmcyApO1xuXHRcdFx0fTtcblx0XHRcdHN3aXRjaCAoIHRva2VuLnQgKSB7XG5cdFx0XHRcdGNhc2UgdHlwZXMuQk9PTEVBTl9MSVRFUkFMOlxuXHRcdFx0XHRjYXNlIHR5cGVzLkdMT0JBTDpcblx0XHRcdFx0Y2FzZSB0eXBlcy5OVU1CRVJfTElURVJBTDpcblx0XHRcdFx0XHRyZXR1cm4gdG9rZW4udjtcblx0XHRcdFx0Y2FzZSB0eXBlcy5TVFJJTkdfTElURVJBTDpcblx0XHRcdFx0XHRyZXR1cm4gcXVvdGVTdHJpbmdMaXRlcmFsKCB0b2tlbi52ICk7XG5cdFx0XHRcdGNhc2UgdHlwZXMuQVJSQVlfTElURVJBTDpcblx0XHRcdFx0XHRyZXR1cm4gJ1snICsgKCB0b2tlbi5tID8gdG9rZW4ubS5tYXAoIG1hcCApLmpvaW4oICcsJyApIDogJycgKSArICddJztcblx0XHRcdFx0Y2FzZSB0eXBlcy5PQkpFQ1RfTElURVJBTDpcblx0XHRcdFx0XHRyZXR1cm4gJ3snICsgKCB0b2tlbi5tID8gdG9rZW4ubS5tYXAoIG1hcCApLmpvaW4oICcsJyApIDogJycgKSArICd9Jztcblx0XHRcdFx0Y2FzZSB0eXBlcy5LRVlfVkFMVUVfUEFJUjpcblx0XHRcdFx0XHRyZXR1cm4gdG9rZW4uayArICc6JyArIHN0cmluZ2lmeSggdG9rZW4udiwgcmVmcyApO1xuXHRcdFx0XHRjYXNlIHR5cGVzLlBSRUZJWF9PUEVSQVRPUjpcblx0XHRcdFx0XHRyZXR1cm4gKCB0b2tlbi5zID09PSAndHlwZW9mJyA/ICd0eXBlb2YgJyA6IHRva2VuLnMgKSArIHN0cmluZ2lmeSggdG9rZW4ubywgcmVmcyApO1xuXHRcdFx0XHRjYXNlIHR5cGVzLklORklYX09QRVJBVE9SOlxuXHRcdFx0XHRcdHJldHVybiBzdHJpbmdpZnkoIHRva2VuLm9bIDAgXSwgcmVmcyApICsgKCB0b2tlbi5zLnN1YnN0ciggMCwgMiApID09PSAnaW4nID8gJyAnICsgdG9rZW4ucyArICcgJyA6IHRva2VuLnMgKSArIHN0cmluZ2lmeSggdG9rZW4ub1sgMSBdLCByZWZzICk7XG5cdFx0XHRcdGNhc2UgdHlwZXMuSU5WT0NBVElPTjpcblx0XHRcdFx0XHRyZXR1cm4gc3RyaW5naWZ5KCB0b2tlbi54LCByZWZzICkgKyAnKCcgKyAoIHRva2VuLm8gPyB0b2tlbi5vLm1hcCggbWFwICkuam9pbiggJywnICkgOiAnJyApICsgJyknO1xuXHRcdFx0XHRjYXNlIHR5cGVzLkJSQUNLRVRFRDpcblx0XHRcdFx0XHRyZXR1cm4gJygnICsgc3RyaW5naWZ5KCB0b2tlbi54LCByZWZzICkgKyAnKSc7XG5cdFx0XHRcdGNhc2UgdHlwZXMuTUVNQkVSOlxuXHRcdFx0XHRcdHJldHVybiBzdHJpbmdpZnkoIHRva2VuLngsIHJlZnMgKSArIHN0cmluZ2lmeSggdG9rZW4uciwgcmVmcyApO1xuXHRcdFx0XHRjYXNlIHR5cGVzLlJFRklORU1FTlQ6XG5cdFx0XHRcdFx0cmV0dXJuIHRva2VuLm4gPyAnLicgKyB0b2tlbi5uIDogJ1snICsgc3RyaW5naWZ5KCB0b2tlbi54LCByZWZzICkgKyAnXSc7XG5cdFx0XHRcdGNhc2UgdHlwZXMuQ09ORElUSU9OQUw6XG5cdFx0XHRcdFx0cmV0dXJuIHN0cmluZ2lmeSggdG9rZW4ub1sgMCBdLCByZWZzICkgKyAnPycgKyBzdHJpbmdpZnkoIHRva2VuLm9bIDEgXSwgcmVmcyApICsgJzonICsgc3RyaW5naWZ5KCB0b2tlbi5vWyAyIF0sIHJlZnMgKTtcblx0XHRcdFx0Y2FzZSB0eXBlcy5SRUZFUkVOQ0U6XG5cdFx0XHRcdFx0cmV0dXJuICckeycgKyByZWZzLmluZGV4T2YoIHRva2VuLm4gKSArICd9Jztcblx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdDb3VsZCBub3Qgc3RyaW5naWZ5IGV4cHJlc3Npb24gdG9rZW4uIFRoaXMgZXJyb3IgaXMgdW5leHBlY3RlZCcgKTtcblx0XHRcdH1cblx0XHR9XG5cdH0oIGNvbmZpZ190eXBlcywgdXRpbHNfaXNPYmplY3QgKTtcblxuXHR2YXIgcGFyc2VfUGFyc2VyX2dldE11c3RhY2hlX011c3RhY2hlU3R1Yl9fTXVzdGFjaGVTdHViID0gZnVuY3Rpb24oIHR5cGVzLCBFeHByZXNzaW9uU3R1YiApIHtcblxuXHRcdHZhciBNdXN0YWNoZVN0dWIgPSBmdW5jdGlvbiggdG9rZW4sIHBhcnNlciApIHtcblx0XHRcdHRoaXMudHlwZSA9IHRva2VuLnR5cGUgPT09IHR5cGVzLlRSSVBMRSA/IHR5cGVzLlRSSVBMRSA6IHRva2VuLm11c3RhY2hlVHlwZTtcblx0XHRcdGlmICggdG9rZW4ucmVmICkge1xuXHRcdFx0XHR0aGlzLnJlZiA9IHRva2VuLnJlZjtcblx0XHRcdH1cblx0XHRcdGlmICggdG9rZW4uZXhwcmVzc2lvbiApIHtcblx0XHRcdFx0dGhpcy5leHByID0gbmV3IEV4cHJlc3Npb25TdHViKCB0b2tlbi5leHByZXNzaW9uICk7XG5cdFx0XHR9XG5cdFx0XHRwYXJzZXIucG9zICs9IDE7XG5cdFx0fTtcblx0XHRNdXN0YWNoZVN0dWIucHJvdG90eXBlID0ge1xuXHRcdFx0dG9KU09OOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIGpzb247XG5cdFx0XHRcdGlmICggdGhpcy5qc29uICkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmpzb247XG5cdFx0XHRcdH1cblx0XHRcdFx0anNvbiA9IHtcblx0XHRcdFx0XHR0OiB0aGlzLnR5cGVcblx0XHRcdFx0fTtcblx0XHRcdFx0aWYgKCB0aGlzLnJlZiApIHtcblx0XHRcdFx0XHRqc29uLnIgPSB0aGlzLnJlZjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHRoaXMuZXhwciApIHtcblx0XHRcdFx0XHRqc29uLnggPSB0aGlzLmV4cHIudG9KU09OKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5qc29uID0ganNvbjtcblx0XHRcdFx0cmV0dXJuIGpzb247XG5cdFx0XHR9LFxuXHRcdFx0dG9TdHJpbmc6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gTXVzdGFjaGVTdHViO1xuXHR9KCBjb25maWdfdHlwZXMsIHBhcnNlX1BhcnNlcl9nZXRNdXN0YWNoZV9FeHByZXNzaW9uU3R1Yl9fRXhwcmVzc2lvblN0dWIgKTtcblxuXHR2YXIgcGFyc2VfUGFyc2VyX3V0aWxzX3N0cmluZ2lmeVN0dWJzID0gZnVuY3Rpb24oIGl0ZW1zICkge1xuXHRcdHZhciBzdHIgPSAnJyxcblx0XHRcdGl0ZW1TdHIsIGksIGxlbjtcblx0XHRpZiAoICFpdGVtcyApIHtcblx0XHRcdHJldHVybiAnJztcblx0XHR9XG5cdFx0Zm9yICggaSA9IDAsIGxlbiA9IGl0ZW1zLmxlbmd0aDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0aXRlbVN0ciA9IGl0ZW1zWyBpIF0udG9TdHJpbmcoKTtcblx0XHRcdGlmICggaXRlbVN0ciA9PT0gZmFsc2UgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHN0ciArPSBpdGVtU3RyO1xuXHRcdH1cblx0XHRyZXR1cm4gc3RyO1xuXHR9O1xuXG5cdHZhciBwYXJzZV9QYXJzZXJfdXRpbHNfanNvbmlmeVN0dWJzID0gZnVuY3Rpb24oIHN0cmluZ2lmeVN0dWJzICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBpdGVtcywgbm9TdHJpbmdpZnksIHRvcExldmVsICkge1xuXHRcdFx0dmFyIHN0ciwganNvbjtcblx0XHRcdGlmICggIXRvcExldmVsICYmICFub1N0cmluZ2lmeSApIHtcblx0XHRcdFx0c3RyID0gc3RyaW5naWZ5U3R1YnMoIGl0ZW1zICk7XG5cdFx0XHRcdGlmICggc3RyICE9PSBmYWxzZSApIHtcblx0XHRcdFx0XHRyZXR1cm4gc3RyO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRqc29uID0gaXRlbXMubWFwKCBmdW5jdGlvbiggaXRlbSApIHtcblx0XHRcdFx0cmV0dXJuIGl0ZW0udG9KU09OKCBub1N0cmluZ2lmeSApO1xuXHRcdFx0fSApO1xuXHRcdFx0cmV0dXJuIGpzb247XG5cdFx0fTtcblx0fSggcGFyc2VfUGFyc2VyX3V0aWxzX3N0cmluZ2lmeVN0dWJzICk7XG5cblx0dmFyIHBhcnNlX1BhcnNlcl9nZXRNdXN0YWNoZV9TZWN0aW9uU3R1Yl9fU2VjdGlvblN0dWIgPSBmdW5jdGlvbiggdHlwZXMsIG5vcm1hbGlzZUtleXBhdGgsIGpzb25pZnlTdHVicywgRXhwcmVzc2lvblN0dWIgKSB7XG5cblx0XHR2YXIgU2VjdGlvblN0dWIgPSBmdW5jdGlvbiggZmlyc3RUb2tlbiwgcGFyc2VyICkge1xuXHRcdFx0dmFyIG5leHQ7XG5cdFx0XHR0aGlzLnJlZiA9IGZpcnN0VG9rZW4ucmVmO1xuXHRcdFx0dGhpcy5pbmRleFJlZiA9IGZpcnN0VG9rZW4uaW5kZXhSZWY7XG5cdFx0XHR0aGlzLmludmVydGVkID0gZmlyc3RUb2tlbi5tdXN0YWNoZVR5cGUgPT09IHR5cGVzLklOVkVSVEVEO1xuXHRcdFx0aWYgKCBmaXJzdFRva2VuLmV4cHJlc3Npb24gKSB7XG5cdFx0XHRcdHRoaXMuZXhwciA9IG5ldyBFeHByZXNzaW9uU3R1YiggZmlyc3RUb2tlbi5leHByZXNzaW9uICk7XG5cdFx0XHR9XG5cdFx0XHRwYXJzZXIucG9zICs9IDE7XG5cdFx0XHR0aGlzLml0ZW1zID0gW107XG5cdFx0XHRuZXh0ID0gcGFyc2VyLm5leHQoKTtcblx0XHRcdHdoaWxlICggbmV4dCApIHtcblx0XHRcdFx0aWYgKCBuZXh0Lm11c3RhY2hlVHlwZSA9PT0gdHlwZXMuQ0xPU0lORyApIHtcblx0XHRcdFx0XHRpZiAoIG5vcm1hbGlzZUtleXBhdGgoIG5leHQucmVmLnRyaW0oKSApID09PSB0aGlzLnJlZiB8fCB0aGlzLmV4cHIgKSB7XG5cdFx0XHRcdFx0XHRwYXJzZXIucG9zICs9IDE7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnQ291bGQgbm90IHBhcnNlIHRlbXBsYXRlOiBJbGxlZ2FsIGNsb3Npbmcgc2VjdGlvbicgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5pdGVtcy5wdXNoKCBwYXJzZXIuZ2V0U3R1YigpICk7XG5cdFx0XHRcdG5leHQgPSBwYXJzZXIubmV4dCgpO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0U2VjdGlvblN0dWIucHJvdG90eXBlID0ge1xuXHRcdFx0dG9KU09OOiBmdW5jdGlvbiggbm9TdHJpbmdpZnkgKSB7XG5cdFx0XHRcdHZhciBqc29uO1xuXHRcdFx0XHRpZiAoIHRoaXMuanNvbiApIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5qc29uO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGpzb24gPSB7XG5cdFx0XHRcdFx0dDogdHlwZXMuU0VDVElPTlxuXHRcdFx0XHR9O1xuXHRcdFx0XHRpZiAoIHRoaXMucmVmICkge1xuXHRcdFx0XHRcdGpzb24uciA9IHRoaXMucmVmO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggdGhpcy5pbmRleFJlZiApIHtcblx0XHRcdFx0XHRqc29uLmkgPSB0aGlzLmluZGV4UmVmO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggdGhpcy5pbnZlcnRlZCApIHtcblx0XHRcdFx0XHRqc29uLm4gPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggdGhpcy5leHByICkge1xuXHRcdFx0XHRcdGpzb24ueCA9IHRoaXMuZXhwci50b0pTT04oKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHRoaXMuaXRlbXMubGVuZ3RoICkge1xuXHRcdFx0XHRcdGpzb24uZiA9IGpzb25pZnlTdHVicyggdGhpcy5pdGVtcywgbm9TdHJpbmdpZnkgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLmpzb24gPSBqc29uO1xuXHRcdFx0XHRyZXR1cm4ganNvbjtcblx0XHRcdH0sXG5cdFx0XHR0b1N0cmluZzogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBTZWN0aW9uU3R1Yjtcblx0fSggY29uZmlnX3R5cGVzLCB1dGlsc19ub3JtYWxpc2VLZXlwYXRoLCBwYXJzZV9QYXJzZXJfdXRpbHNfanNvbmlmeVN0dWJzLCBwYXJzZV9QYXJzZXJfZ2V0TXVzdGFjaGVfRXhwcmVzc2lvblN0dWJfX0V4cHJlc3Npb25TdHViICk7XG5cblx0dmFyIHBhcnNlX1BhcnNlcl9nZXRNdXN0YWNoZV9fZ2V0TXVzdGFjaGUgPSBmdW5jdGlvbiggdHlwZXMsIE11c3RhY2hlU3R1YiwgU2VjdGlvblN0dWIgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHRva2VuICkge1xuXHRcdFx0aWYgKCB0b2tlbi50eXBlID09PSB0eXBlcy5NVVNUQUNIRSB8fCB0b2tlbi50eXBlID09PSB0eXBlcy5UUklQTEUgKSB7XG5cdFx0XHRcdGlmICggdG9rZW4ubXVzdGFjaGVUeXBlID09PSB0eXBlcy5TRUNUSU9OIHx8IHRva2VuLm11c3RhY2hlVHlwZSA9PT0gdHlwZXMuSU5WRVJURUQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBTZWN0aW9uU3R1YiggdG9rZW4sIHRoaXMgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gbmV3IE11c3RhY2hlU3R1YiggdG9rZW4sIHRoaXMgKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9KCBjb25maWdfdHlwZXMsIHBhcnNlX1BhcnNlcl9nZXRNdXN0YWNoZV9NdXN0YWNoZVN0dWJfX011c3RhY2hlU3R1YiwgcGFyc2VfUGFyc2VyX2dldE11c3RhY2hlX1NlY3Rpb25TdHViX19TZWN0aW9uU3R1YiApO1xuXG5cdHZhciBwYXJzZV9QYXJzZXJfZ2V0RWxlbWVudF9FbGVtZW50U3R1Yl91dGlsc19zaWJsaW5nc0J5VGFnTmFtZSA9IHtcblx0XHRsaTogWyAnbGknIF0sXG5cdFx0ZHQ6IFtcblx0XHRcdCdkdCcsXG5cdFx0XHQnZGQnXG5cdFx0XSxcblx0XHRkZDogW1xuXHRcdFx0J2R0Jyxcblx0XHRcdCdkZCdcblx0XHRdLFxuXHRcdHA6ICdhZGRyZXNzIGFydGljbGUgYXNpZGUgYmxvY2txdW90ZSBkaXIgZGl2IGRsIGZpZWxkc2V0IGZvb3RlciBmb3JtIGgxIGgyIGgzIGg0IGg1IGg2IGhlYWRlciBoZ3JvdXAgaHIgbWVudSBuYXYgb2wgcCBwcmUgc2VjdGlvbiB0YWJsZSB1bCcuc3BsaXQoICcgJyApLFxuXHRcdHJ0OiBbXG5cdFx0XHQncnQnLFxuXHRcdFx0J3JwJ1xuXHRcdF0sXG5cdFx0cnA6IFtcblx0XHRcdCdycCcsXG5cdFx0XHQncnQnXG5cdFx0XSxcblx0XHRvcHRncm91cDogWyAnb3B0Z3JvdXAnIF0sXG5cdFx0b3B0aW9uOiBbXG5cdFx0XHQnb3B0aW9uJyxcblx0XHRcdCdvcHRncm91cCdcblx0XHRdLFxuXHRcdHRoZWFkOiBbXG5cdFx0XHQndGJvZHknLFxuXHRcdFx0J3Rmb290J1xuXHRcdF0sXG5cdFx0dGJvZHk6IFtcblx0XHRcdCd0Ym9keScsXG5cdFx0XHQndGZvb3QnXG5cdFx0XSxcblx0XHR0cjogWyAndHInIF0sXG5cdFx0dGQ6IFtcblx0XHRcdCd0ZCcsXG5cdFx0XHQndGgnXG5cdFx0XSxcblx0XHR0aDogW1xuXHRcdFx0J3RkJyxcblx0XHRcdCd0aCdcblx0XHRdXG5cdH07XG5cblx0dmFyIHBhcnNlX1BhcnNlcl9nZXRFbGVtZW50X0VsZW1lbnRTdHViX3V0aWxzX2ZpbHRlckF0dHJpYnV0ZXMgPSBmdW5jdGlvbiggaXNBcnJheSApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggaXRlbXMgKSB7XG5cdFx0XHR2YXIgYXR0cnMsIHByb3hpZXMsIGZpbHRlcmVkLCBpLCBsZW4sIGl0ZW07XG5cdFx0XHRmaWx0ZXJlZCA9IHt9O1xuXHRcdFx0YXR0cnMgPSBbXTtcblx0XHRcdHByb3hpZXMgPSBbXTtcblx0XHRcdGxlbiA9IGl0ZW1zLmxlbmd0aDtcblx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdGl0ZW0gPSBpdGVtc1sgaSBdO1xuXHRcdFx0XHRpZiAoIGl0ZW0ubmFtZSA9PT0gJ2ludHJvJyApIHtcblx0XHRcdFx0XHRpZiAoIGZpbHRlcmVkLmludHJvICkge1xuXHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnQW4gZWxlbWVudCBjYW4gb25seSBoYXZlIG9uZSBpbnRybyB0cmFuc2l0aW9uJyApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRmaWx0ZXJlZC5pbnRybyA9IGl0ZW07XG5cdFx0XHRcdH0gZWxzZSBpZiAoIGl0ZW0ubmFtZSA9PT0gJ291dHJvJyApIHtcblx0XHRcdFx0XHRpZiAoIGZpbHRlcmVkLm91dHJvICkge1xuXHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnQW4gZWxlbWVudCBjYW4gb25seSBoYXZlIG9uZSBvdXRybyB0cmFuc2l0aW9uJyApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRmaWx0ZXJlZC5vdXRybyA9IGl0ZW07XG5cdFx0XHRcdH0gZWxzZSBpZiAoIGl0ZW0ubmFtZSA9PT0gJ2ludHJvLW91dHJvJyApIHtcblx0XHRcdFx0XHRpZiAoIGZpbHRlcmVkLmludHJvIHx8IGZpbHRlcmVkLm91dHJvICkge1xuXHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnQW4gZWxlbWVudCBjYW4gb25seSBoYXZlIG9uZSBpbnRybyBhbmQgb25lIG91dHJvIHRyYW5zaXRpb24nICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGZpbHRlcmVkLmludHJvID0gaXRlbTtcblx0XHRcdFx0XHRmaWx0ZXJlZC5vdXRybyA9IGRlZXBDbG9uZSggaXRlbSApO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCBpdGVtLm5hbWUuc3Vic3RyKCAwLCA2ICkgPT09ICdwcm94eS0nICkge1xuXHRcdFx0XHRcdGl0ZW0ubmFtZSA9IGl0ZW0ubmFtZS5zdWJzdHJpbmcoIDYgKTtcblx0XHRcdFx0XHRwcm94aWVzLnB1c2goIGl0ZW0gKTtcblx0XHRcdFx0fSBlbHNlIGlmICggaXRlbS5uYW1lLnN1YnN0ciggMCwgMyApID09PSAnb24tJyApIHtcblx0XHRcdFx0XHRpdGVtLm5hbWUgPSBpdGVtLm5hbWUuc3Vic3RyaW5nKCAzICk7XG5cdFx0XHRcdFx0cHJveGllcy5wdXNoKCBpdGVtICk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoIGl0ZW0ubmFtZSA9PT0gJ2RlY29yYXRvcicgKSB7XG5cdFx0XHRcdFx0ZmlsdGVyZWQuZGVjb3JhdG9yID0gaXRlbTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRhdHRycy5wdXNoKCBpdGVtICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGZpbHRlcmVkLmF0dHJzID0gYXR0cnM7XG5cdFx0XHRmaWx0ZXJlZC5wcm94aWVzID0gcHJveGllcztcblx0XHRcdHJldHVybiBmaWx0ZXJlZDtcblx0XHR9O1xuXG5cdFx0ZnVuY3Rpb24gZGVlcENsb25lKCBvYmogKSB7XG5cdFx0XHR2YXIgcmVzdWx0LCBrZXk7XG5cdFx0XHRpZiAoIHR5cGVvZiBvYmogIT09ICdvYmplY3QnICkge1xuXHRcdFx0XHRyZXR1cm4gb2JqO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBpc0FycmF5KCBvYmogKSApIHtcblx0XHRcdFx0cmV0dXJuIG9iai5tYXAoIGRlZXBDbG9uZSApO1xuXHRcdFx0fVxuXHRcdFx0cmVzdWx0ID0ge307XG5cdFx0XHRmb3IgKCBrZXkgaW4gb2JqICkge1xuXHRcdFx0XHRpZiAoIG9iai5oYXNPd25Qcm9wZXJ0eSgga2V5ICkgKSB7XG5cdFx0XHRcdFx0cmVzdWx0WyBrZXkgXSA9IGRlZXBDbG9uZSggb2JqWyBrZXkgXSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH1cblx0fSggdXRpbHNfaXNBcnJheSApO1xuXG5cdHZhciBwYXJzZV9QYXJzZXJfZ2V0RWxlbWVudF9FbGVtZW50U3R1Yl91dGlsc19wcm9jZXNzRGlyZWN0aXZlID0gZnVuY3Rpb24oIHR5cGVzLCBwYXJzZUpTT04gKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIGRpcmVjdGl2ZSApIHtcblx0XHRcdHZhciBwcm9jZXNzZWQsIHRva2VucywgdG9rZW4sIGNvbG9uSW5kZXgsIHRocm93RXJyb3IsIGRpcmVjdGl2ZU5hbWUsIGRpcmVjdGl2ZUFyZ3MsIHBhcnNlZDtcblx0XHRcdHRocm93RXJyb3IgPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnSWxsZWdhbCBkaXJlY3RpdmUnICk7XG5cdFx0XHR9O1xuXHRcdFx0aWYgKCAhZGlyZWN0aXZlLm5hbWUgfHwgIWRpcmVjdGl2ZS52YWx1ZSApIHtcblx0XHRcdFx0dGhyb3dFcnJvcigpO1xuXHRcdFx0fVxuXHRcdFx0cHJvY2Vzc2VkID0ge1xuXHRcdFx0XHRkaXJlY3RpdmVUeXBlOiBkaXJlY3RpdmUubmFtZVxuXHRcdFx0fTtcblx0XHRcdHRva2VucyA9IGRpcmVjdGl2ZS52YWx1ZTtcblx0XHRcdGRpcmVjdGl2ZU5hbWUgPSBbXTtcblx0XHRcdGRpcmVjdGl2ZUFyZ3MgPSBbXTtcblx0XHRcdHdoaWxlICggdG9rZW5zLmxlbmd0aCApIHtcblx0XHRcdFx0dG9rZW4gPSB0b2tlbnMuc2hpZnQoKTtcblx0XHRcdFx0aWYgKCB0b2tlbi50eXBlID09PSB0eXBlcy5URVhUICkge1xuXHRcdFx0XHRcdGNvbG9uSW5kZXggPSB0b2tlbi52YWx1ZS5pbmRleE9mKCAnOicgKTtcblx0XHRcdFx0XHRpZiAoIGNvbG9uSW5kZXggPT09IC0xICkge1xuXHRcdFx0XHRcdFx0ZGlyZWN0aXZlTmFtZS5wdXNoKCB0b2tlbiApO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRpZiAoIGNvbG9uSW5kZXggKSB7XG5cdFx0XHRcdFx0XHRcdGRpcmVjdGl2ZU5hbWUucHVzaCgge1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6IHR5cGVzLlRFWFQsXG5cdFx0XHRcdFx0XHRcdFx0dmFsdWU6IHRva2VuLnZhbHVlLnN1YnN0ciggMCwgY29sb25JbmRleCApXG5cdFx0XHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmICggdG9rZW4udmFsdWUubGVuZ3RoID4gY29sb25JbmRleCArIDEgKSB7XG5cdFx0XHRcdFx0XHRcdGRpcmVjdGl2ZUFyZ3NbIDAgXSA9IHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiB0eXBlcy5URVhULFxuXHRcdFx0XHRcdFx0XHRcdHZhbHVlOiB0b2tlbi52YWx1ZS5zdWJzdHJpbmcoIGNvbG9uSW5kZXggKyAxIClcblx0XHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRkaXJlY3RpdmVOYW1lLnB1c2goIHRva2VuICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGRpcmVjdGl2ZUFyZ3MgPSBkaXJlY3RpdmVBcmdzLmNvbmNhdCggdG9rZW5zICk7XG5cdFx0XHRpZiAoIGRpcmVjdGl2ZU5hbWUubGVuZ3RoID09PSAxICYmIGRpcmVjdGl2ZU5hbWVbIDAgXS50eXBlID09PSB0eXBlcy5URVhUICkge1xuXHRcdFx0XHRwcm9jZXNzZWQubmFtZSA9IGRpcmVjdGl2ZU5hbWVbIDAgXS52YWx1ZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHByb2Nlc3NlZC5uYW1lID0gZGlyZWN0aXZlTmFtZTtcblx0XHRcdH1cblx0XHRcdGlmICggZGlyZWN0aXZlQXJncy5sZW5ndGggKSB7XG5cdFx0XHRcdGlmICggZGlyZWN0aXZlQXJncy5sZW5ndGggPT09IDEgJiYgZGlyZWN0aXZlQXJnc1sgMCBdLnR5cGUgPT09IHR5cGVzLlRFWFQgKSB7XG5cdFx0XHRcdFx0cGFyc2VkID0gcGFyc2VKU09OKCAnWycgKyBkaXJlY3RpdmVBcmdzWyAwIF0udmFsdWUgKyAnXScgKTtcblx0XHRcdFx0XHRwcm9jZXNzZWQuYXJncyA9IHBhcnNlZCA/IHBhcnNlZC52YWx1ZSA6IGRpcmVjdGl2ZUFyZ3NbIDAgXS52YWx1ZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRwcm9jZXNzZWQuZHluYW1pY0FyZ3MgPSBkaXJlY3RpdmVBcmdzO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcHJvY2Vzc2VkO1xuXHRcdH07XG5cdH0oIGNvbmZpZ190eXBlcywgdXRpbHNfcGFyc2VKU09OICk7XG5cblx0dmFyIHBhcnNlX1BhcnNlcl9TdHJpbmdTdHViX1N0cmluZ1BhcnNlciA9IGZ1bmN0aW9uKCBnZXRUZXh0LCBnZXRNdXN0YWNoZSApIHtcblxuXHRcdHZhciBTdHJpbmdQYXJzZXI7XG5cdFx0U3RyaW5nUGFyc2VyID0gZnVuY3Rpb24oIHRva2Vucywgb3B0aW9ucyApIHtcblx0XHRcdHZhciBzdHViO1xuXHRcdFx0dGhpcy50b2tlbnMgPSB0b2tlbnMgfHwgW107XG5cdFx0XHR0aGlzLnBvcyA9IDA7XG5cdFx0XHR0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuXHRcdFx0dGhpcy5yZXN1bHQgPSBbXTtcblx0XHRcdHdoaWxlICggc3R1YiA9IHRoaXMuZ2V0U3R1YigpICkge1xuXHRcdFx0XHR0aGlzLnJlc3VsdC5wdXNoKCBzdHViICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRTdHJpbmdQYXJzZXIucHJvdG90eXBlID0ge1xuXHRcdFx0Z2V0U3R1YjogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciB0b2tlbiA9IHRoaXMubmV4dCgpO1xuXHRcdFx0XHRpZiAoICF0b2tlbiApIHtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdGhpcy5nZXRUZXh0KCB0b2tlbiApIHx8IHRoaXMuZ2V0TXVzdGFjaGUoIHRva2VuICk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0VGV4dDogZ2V0VGV4dCxcblx0XHRcdGdldE11c3RhY2hlOiBnZXRNdXN0YWNoZSxcblx0XHRcdG5leHQ6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy50b2tlbnNbIHRoaXMucG9zIF07XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gU3RyaW5nUGFyc2VyO1xuXHR9KCBwYXJzZV9QYXJzZXJfZ2V0VGV4dF9fZ2V0VGV4dCwgcGFyc2VfUGFyc2VyX2dldE11c3RhY2hlX19nZXRNdXN0YWNoZSApO1xuXG5cdHZhciBwYXJzZV9QYXJzZXJfU3RyaW5nU3R1Yl9fU3RyaW5nU3R1YiA9IGZ1bmN0aW9uKCBTdHJpbmdQYXJzZXIsIHN0cmluZ2lmeVN0dWJzLCBqc29uaWZ5U3R1YnMgKSB7XG5cblx0XHR2YXIgU3RyaW5nU3R1Yjtcblx0XHRTdHJpbmdTdHViID0gZnVuY3Rpb24oIHRva2VucyApIHtcblx0XHRcdHZhciBwYXJzZXIgPSBuZXcgU3RyaW5nUGFyc2VyKCB0b2tlbnMgKTtcblx0XHRcdHRoaXMuc3R1YnMgPSBwYXJzZXIucmVzdWx0O1xuXHRcdH07XG5cdFx0U3RyaW5nU3R1Yi5wcm90b3R5cGUgPSB7XG5cdFx0XHR0b0pTT046IGZ1bmN0aW9uKCBub1N0cmluZ2lmeSApIHtcblx0XHRcdFx0dmFyIGpzb247XG5cdFx0XHRcdGlmICggdGhpc1sgJ2pzb25fJyArIG5vU3RyaW5naWZ5IF0gKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXNbICdqc29uXycgKyBub1N0cmluZ2lmeSBdO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGpzb24gPSB0aGlzWyAnanNvbl8nICsgbm9TdHJpbmdpZnkgXSA9IGpzb25pZnlTdHVicyggdGhpcy5zdHVicywgbm9TdHJpbmdpZnkgKTtcblx0XHRcdFx0cmV0dXJuIGpzb247XG5cdFx0XHR9LFxuXHRcdFx0dG9TdHJpbmc6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZiAoIHRoaXMuc3RyICE9PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuc3RyO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuc3RyID0gc3RyaW5naWZ5U3R1YnMoIHRoaXMuc3R1YnMgKTtcblx0XHRcdFx0cmV0dXJuIHRoaXMuc3RyO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIFN0cmluZ1N0dWI7XG5cdH0oIHBhcnNlX1BhcnNlcl9TdHJpbmdTdHViX1N0cmluZ1BhcnNlciwgcGFyc2VfUGFyc2VyX3V0aWxzX3N0cmluZ2lmeVN0dWJzLCBwYXJzZV9QYXJzZXJfdXRpbHNfanNvbmlmeVN0dWJzICk7XG5cblx0dmFyIHBhcnNlX1BhcnNlcl9nZXRFbGVtZW50X0VsZW1lbnRTdHViX3V0aWxzX2pzb25pZnlEaXJlY3RpdmUgPSBmdW5jdGlvbiggU3RyaW5nU3R1YiApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggZGlyZWN0aXZlICkge1xuXHRcdFx0dmFyIHJlc3VsdCwgbmFtZTtcblx0XHRcdGlmICggdHlwZW9mIGRpcmVjdGl2ZS5uYW1lID09PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0aWYgKCAhZGlyZWN0aXZlLmFyZ3MgJiYgIWRpcmVjdGl2ZS5keW5hbWljQXJncyApIHtcblx0XHRcdFx0XHRyZXR1cm4gZGlyZWN0aXZlLm5hbWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0bmFtZSA9IGRpcmVjdGl2ZS5uYW1lO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bmFtZSA9IG5ldyBTdHJpbmdTdHViKCBkaXJlY3RpdmUubmFtZSApLnRvSlNPTigpO1xuXHRcdFx0fVxuXHRcdFx0cmVzdWx0ID0ge1xuXHRcdFx0XHRuOiBuYW1lXG5cdFx0XHR9O1xuXHRcdFx0aWYgKCBkaXJlY3RpdmUuYXJncyApIHtcblx0XHRcdFx0cmVzdWx0LmEgPSBkaXJlY3RpdmUuYXJncztcblx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdH1cblx0XHRcdGlmICggZGlyZWN0aXZlLmR5bmFtaWNBcmdzICkge1xuXHRcdFx0XHRyZXN1bHQuZCA9IG5ldyBTdHJpbmdTdHViKCBkaXJlY3RpdmUuZHluYW1pY0FyZ3MgKS50b0pTT04oKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fTtcblx0fSggcGFyc2VfUGFyc2VyX1N0cmluZ1N0dWJfX1N0cmluZ1N0dWIgKTtcblxuXHR2YXIgcGFyc2VfUGFyc2VyX2dldEVsZW1lbnRfRWxlbWVudFN0dWJfdG9KU09OID0gZnVuY3Rpb24oIHR5cGVzLCBqc29uaWZ5U3R1YnMsIGpzb25pZnlEaXJlY3RpdmUgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIG5vU3RyaW5naWZ5ICkge1xuXHRcdFx0dmFyIGpzb24sIG5hbWUsIHZhbHVlLCBwcm94eSwgaSwgbGVuLCBhdHRyaWJ1dGU7XG5cdFx0XHRpZiAoIHRoaXNbICdqc29uXycgKyBub1N0cmluZ2lmeSBdICkge1xuXHRcdFx0XHRyZXR1cm4gdGhpc1sgJ2pzb25fJyArIG5vU3RyaW5naWZ5IF07XG5cdFx0XHR9XG5cdFx0XHRqc29uID0ge1xuXHRcdFx0XHR0OiB0eXBlcy5FTEVNRU5ULFxuXHRcdFx0XHRlOiB0aGlzLnRhZ1xuXHRcdFx0fTtcblx0XHRcdGlmICggdGhpcy5kb2N0eXBlICkge1xuXHRcdFx0XHRqc29uLnkgPSAxO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aGlzLmF0dHJpYnV0ZXMgJiYgdGhpcy5hdHRyaWJ1dGVzLmxlbmd0aCApIHtcblx0XHRcdFx0anNvbi5hID0ge307XG5cdFx0XHRcdGxlbiA9IHRoaXMuYXR0cmlidXRlcy5sZW5ndGg7XG5cdFx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0YXR0cmlidXRlID0gdGhpcy5hdHRyaWJ1dGVzWyBpIF07XG5cdFx0XHRcdFx0bmFtZSA9IGF0dHJpYnV0ZS5uYW1lO1xuXHRcdFx0XHRcdGlmICgganNvbi5hWyBuYW1lIF0gKSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdZb3UgY2Fubm90IGhhdmUgbXVsdGlwbGUgYXR0cmlidXRlcyB3aXRoIHRoZSBzYW1lIG5hbWUnICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICggYXR0cmlidXRlLnZhbHVlID09PSBudWxsICkge1xuXHRcdFx0XHRcdFx0dmFsdWUgPSBudWxsO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR2YWx1ZSA9IGF0dHJpYnV0ZS52YWx1ZS50b0pTT04oIG5vU3RyaW5naWZ5ICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGpzb24uYVsgbmFtZSBdID0gdmFsdWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICggdGhpcy5pdGVtcyAmJiB0aGlzLml0ZW1zLmxlbmd0aCApIHtcblx0XHRcdFx0anNvbi5mID0ganNvbmlmeVN0dWJzKCB0aGlzLml0ZW1zLCBub1N0cmluZ2lmeSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aGlzLnByb3hpZXMgJiYgdGhpcy5wcm94aWVzLmxlbmd0aCApIHtcblx0XHRcdFx0anNvbi52ID0ge307XG5cdFx0XHRcdGxlbiA9IHRoaXMucHJveGllcy5sZW5ndGg7XG5cdFx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0cHJveHkgPSB0aGlzLnByb3hpZXNbIGkgXTtcblx0XHRcdFx0XHRqc29uLnZbIHByb3h5LmRpcmVjdGl2ZVR5cGUgXSA9IGpzb25pZnlEaXJlY3RpdmUoIHByb3h5ICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICggdGhpcy5pbnRybyApIHtcblx0XHRcdFx0anNvbi50MSA9IGpzb25pZnlEaXJlY3RpdmUoIHRoaXMuaW50cm8gKTtcblx0XHRcdH1cblx0XHRcdGlmICggdGhpcy5vdXRybyApIHtcblx0XHRcdFx0anNvbi50MiA9IGpzb25pZnlEaXJlY3RpdmUoIHRoaXMub3V0cm8gKTtcblx0XHRcdH1cblx0XHRcdGlmICggdGhpcy5kZWNvcmF0b3IgKSB7XG5cdFx0XHRcdGpzb24ubyA9IGpzb25pZnlEaXJlY3RpdmUoIHRoaXMuZGVjb3JhdG9yICk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzWyAnanNvbl8nICsgbm9TdHJpbmdpZnkgXSA9IGpzb247XG5cdFx0XHRyZXR1cm4ganNvbjtcblx0XHR9O1xuXHR9KCBjb25maWdfdHlwZXMsIHBhcnNlX1BhcnNlcl91dGlsc19qc29uaWZ5U3R1YnMsIHBhcnNlX1BhcnNlcl9nZXRFbGVtZW50X0VsZW1lbnRTdHViX3V0aWxzX2pzb25pZnlEaXJlY3RpdmUgKTtcblxuXHR2YXIgcGFyc2VfUGFyc2VyX2dldEVsZW1lbnRfRWxlbWVudFN0dWJfdG9TdHJpbmcgPSBmdW5jdGlvbiggc3RyaW5naWZ5U3R1YnMsIHZvaWRFbGVtZW50TmFtZXMgKSB7XG5cblx0XHR2YXIgaHRtbEVsZW1lbnRzO1xuXHRcdGh0bWxFbGVtZW50cyA9ICdhIGFiYnIgYWNyb255bSBhZGRyZXNzIGFwcGxldCBhcmVhIGIgYmFzZSBiYXNlZm9udCBiZG8gYmlnIGJsb2NrcXVvdGUgYm9keSBiciBidXR0b24gY2FwdGlvbiBjZW50ZXIgY2l0ZSBjb2RlIGNvbCBjb2xncm91cCBkZCBkZWwgZGZuIGRpciBkaXYgZGwgZHQgZW0gZmllbGRzZXQgZm9udCBmb3JtIGZyYW1lIGZyYW1lc2V0IGgxIGgyIGgzIGg0IGg1IGg2IGhlYWQgaHIgaHRtbCBpIGlmcmFtZSBpbWcgaW5wdXQgaW5zIGlzaW5kZXgga2JkIGxhYmVsIGxlZ2VuZCBsaSBsaW5rIG1hcCBtZW51IG1ldGEgbm9mcmFtZXMgbm9zY3JpcHQgb2JqZWN0IG9sIHAgcGFyYW0gcHJlIHEgcyBzYW1wIHNjcmlwdCBzZWxlY3Qgc21hbGwgc3BhbiBzdHJpa2Ugc3Ryb25nIHN0eWxlIHN1YiBzdXAgdGV4dGFyZWEgdGl0bGUgdHQgdSB1bCB2YXIgYXJ0aWNsZSBhc2lkZSBhdWRpbyBiZGkgY2FudmFzIGNvbW1hbmQgZGF0YSBkYXRhZ3JpZCBkYXRhbGlzdCBkZXRhaWxzIGVtYmVkIGV2ZW50c291cmNlIGZpZ2NhcHRpb24gZmlndXJlIGZvb3RlciBoZWFkZXIgaGdyb3VwIGtleWdlbiBtYXJrIG1ldGVyIG5hdiBvdXRwdXQgcHJvZ3Jlc3MgcnVieSBycCBydCBzZWN0aW9uIHNvdXJjZSBzdW1tYXJ5IHRpbWUgdHJhY2sgdmlkZW8gd2JyJy5zcGxpdCggJyAnICk7XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIHN0ciwgaSwgbGVuLCBhdHRyU3RyLCBuYW1lLCBhdHRyVmFsdWVTdHIsIGZyYWdTdHIsIGlzVm9pZDtcblx0XHRcdGlmICggdGhpcy5zdHIgIT09IHVuZGVmaW5lZCApIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuc3RyO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBodG1sRWxlbWVudHMuaW5kZXhPZiggdGhpcy50YWcudG9Mb3dlckNhc2UoKSApID09PSAtMSApIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuc3RyID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRoaXMucHJveGllcyB8fCB0aGlzLmludHJvIHx8IHRoaXMub3V0cm8gfHwgdGhpcy5kZWNvcmF0b3IgKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnN0ciA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0ZnJhZ1N0ciA9IHN0cmluZ2lmeVN0dWJzKCB0aGlzLml0ZW1zICk7XG5cdFx0XHRpZiAoIGZyYWdTdHIgPT09IGZhbHNlICkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5zdHIgPSBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlzVm9pZCA9IHZvaWRFbGVtZW50TmFtZXMuaW5kZXhPZiggdGhpcy50YWcudG9Mb3dlckNhc2UoKSApICE9PSAtMTtcblx0XHRcdHN0ciA9ICc8JyArIHRoaXMudGFnO1xuXHRcdFx0aWYgKCB0aGlzLmF0dHJpYnV0ZXMgKSB7XG5cdFx0XHRcdGZvciAoIGkgPSAwLCBsZW4gPSB0aGlzLmF0dHJpYnV0ZXMubGVuZ3RoOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0bmFtZSA9IHRoaXMuYXR0cmlidXRlc1sgaSBdLm5hbWU7XG5cdFx0XHRcdFx0aWYgKCBuYW1lLmluZGV4T2YoICc6JyApICE9PSAtMSApIHtcblx0XHRcdFx0XHRcdHJldHVybiB0aGlzLnN0ciA9IGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIG5hbWUgPT09ICdpZCcgfHwgbmFtZSA9PT0gJ2ludHJvJyB8fCBuYW1lID09PSAnb3V0cm8nICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuc3RyID0gZmFsc2U7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGF0dHJTdHIgPSAnICcgKyBuYW1lO1xuXHRcdFx0XHRcdGlmICggdGhpcy5hdHRyaWJ1dGVzWyBpIF0udmFsdWUgIT09IG51bGwgKSB7XG5cdFx0XHRcdFx0XHRhdHRyVmFsdWVTdHIgPSB0aGlzLmF0dHJpYnV0ZXNbIGkgXS52YWx1ZS50b1N0cmluZygpO1xuXHRcdFx0XHRcdFx0aWYgKCBhdHRyVmFsdWVTdHIgPT09IGZhbHNlICkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdGhpcy5zdHIgPSBmYWxzZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmICggYXR0clZhbHVlU3RyICE9PSAnJyApIHtcblx0XHRcdFx0XHRcdFx0YXR0clN0ciArPSAnPSc7XG5cdFx0XHRcdFx0XHRcdGlmICggL1tcXHNcIic9PD5gXS8udGVzdCggYXR0clZhbHVlU3RyICkgKSB7XG5cdFx0XHRcdFx0XHRcdFx0YXR0clN0ciArPSAnXCInICsgYXR0clZhbHVlU3RyLnJlcGxhY2UoIC9cIi9nLCAnJnF1b3Q7JyApICsgJ1wiJztcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRhdHRyU3RyICs9IGF0dHJWYWx1ZVN0cjtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRzdHIgKz0gYXR0clN0cjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aGlzLnNlbGZDbG9zaW5nICYmICFpc1ZvaWQgKSB7XG5cdFx0XHRcdHN0ciArPSAnLz4nO1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5zdHIgPSBzdHI7XG5cdFx0XHR9XG5cdFx0XHRzdHIgKz0gJz4nO1xuXHRcdFx0aWYgKCBpc1ZvaWQgKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnN0ciA9IHN0cjtcblx0XHRcdH1cblx0XHRcdHN0ciArPSBmcmFnU3RyO1xuXHRcdFx0c3RyICs9ICc8LycgKyB0aGlzLnRhZyArICc+Jztcblx0XHRcdHJldHVybiB0aGlzLnN0ciA9IHN0cjtcblx0XHR9O1xuXHR9KCBwYXJzZV9QYXJzZXJfdXRpbHNfc3RyaW5naWZ5U3R1YnMsIGNvbmZpZ192b2lkRWxlbWVudE5hbWVzICk7XG5cblx0dmFyIHBhcnNlX1BhcnNlcl9nZXRFbGVtZW50X0VsZW1lbnRTdHViX19FbGVtZW50U3R1YiA9IGZ1bmN0aW9uKCB0eXBlcywgdm9pZEVsZW1lbnROYW1lcywgd2Fybiwgc2libGluZ3NCeVRhZ05hbWUsIGZpbHRlckF0dHJpYnV0ZXMsIHByb2Nlc3NEaXJlY3RpdmUsIHRvSlNPTiwgdG9TdHJpbmcsIFN0cmluZ1N0dWIgKSB7XG5cblx0XHR2YXIgRWxlbWVudFN0dWIsIGFsbEVsZW1lbnROYW1lcywgY2xvc2VkQnlQYXJlbnRDbG9zZSwgb25QYXR0ZXJuLCBzYW5pdGl6ZSwgbGVhZGluZ1doaXRlc3BhY2UgPSAvXlxccysvLFxuXHRcdFx0dHJhaWxpbmdXaGl0ZXNwYWNlID0gL1xccyskLztcblx0XHRFbGVtZW50U3R1YiA9IGZ1bmN0aW9uKCBmaXJzdFRva2VuLCBwYXJzZXIsIHByZXNlcnZlV2hpdGVzcGFjZSApIHtcblx0XHRcdHZhciBuZXh0LCBhdHRycywgZmlsdGVyZWQsIHByb3hpZXMsIGl0ZW0sIGdldEZyYWcsIGxvd2VyQ2FzZVRhZztcblx0XHRcdHBhcnNlci5wb3MgKz0gMTtcblx0XHRcdGdldEZyYWcgPSBmdW5jdGlvbiggYXR0ciApIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRuYW1lOiBhdHRyLm5hbWUsXG5cdFx0XHRcdFx0dmFsdWU6IGF0dHIudmFsdWUgPyBuZXcgU3RyaW5nU3R1YiggYXR0ci52YWx1ZSApIDogbnVsbFxuXHRcdFx0XHR9O1xuXHRcdFx0fTtcblx0XHRcdHRoaXMudGFnID0gZmlyc3RUb2tlbi5uYW1lO1xuXHRcdFx0bG93ZXJDYXNlVGFnID0gZmlyc3RUb2tlbi5uYW1lLnRvTG93ZXJDYXNlKCk7XG5cdFx0XHRpZiAoIGxvd2VyQ2FzZVRhZy5zdWJzdHIoIDAsIDMgKSA9PT0gJ3J2LScgKSB7XG5cdFx0XHRcdHdhcm4oICdUaGUgXCJydi1cIiBwcmVmaXggZm9yIGNvbXBvbmVudHMgaGFzIGJlZW4gZGVwcmVjYXRlZC4gU3VwcG9ydCB3aWxsIGJlIHJlbW92ZWQgaW4gYSBmdXR1cmUgdmVyc2lvbicgKTtcblx0XHRcdFx0dGhpcy50YWcgPSB0aGlzLnRhZy5zdWJzdHJpbmcoIDMgKTtcblx0XHRcdH1cblx0XHRcdHByZXNlcnZlV2hpdGVzcGFjZSA9IHByZXNlcnZlV2hpdGVzcGFjZSB8fCBsb3dlckNhc2VUYWcgPT09ICdwcmUnIHx8IGxvd2VyQ2FzZVRhZyA9PT0gJ3N0eWxlJyB8fCBsb3dlckNhc2VUYWcgPT09ICdzY3JpcHQnO1xuXHRcdFx0aWYgKCBmaXJzdFRva2VuLmF0dHJzICkge1xuXHRcdFx0XHRmaWx0ZXJlZCA9IGZpbHRlckF0dHJpYnV0ZXMoIGZpcnN0VG9rZW4uYXR0cnMgKTtcblx0XHRcdFx0YXR0cnMgPSBmaWx0ZXJlZC5hdHRycztcblx0XHRcdFx0cHJveGllcyA9IGZpbHRlcmVkLnByb3hpZXM7XG5cdFx0XHRcdGlmICggcGFyc2VyLm9wdGlvbnMuc2FuaXRpemUgJiYgcGFyc2VyLm9wdGlvbnMuc2FuaXRpemUuZXZlbnRBdHRyaWJ1dGVzICkge1xuXHRcdFx0XHRcdGF0dHJzID0gYXR0cnMuZmlsdGVyKCBzYW5pdGl6ZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggYXR0cnMubGVuZ3RoICkge1xuXHRcdFx0XHRcdHRoaXMuYXR0cmlidXRlcyA9IGF0dHJzLm1hcCggZ2V0RnJhZyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggcHJveGllcy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0dGhpcy5wcm94aWVzID0gcHJveGllcy5tYXAoIHByb2Nlc3NEaXJlY3RpdmUgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIGZpbHRlcmVkLmludHJvICkge1xuXHRcdFx0XHRcdHRoaXMuaW50cm8gPSBwcm9jZXNzRGlyZWN0aXZlKCBmaWx0ZXJlZC5pbnRybyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggZmlsdGVyZWQub3V0cm8gKSB7XG5cdFx0XHRcdFx0dGhpcy5vdXRybyA9IHByb2Nlc3NEaXJlY3RpdmUoIGZpbHRlcmVkLm91dHJvICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBmaWx0ZXJlZC5kZWNvcmF0b3IgKSB7XG5cdFx0XHRcdFx0dGhpcy5kZWNvcmF0b3IgPSBwcm9jZXNzRGlyZWN0aXZlKCBmaWx0ZXJlZC5kZWNvcmF0b3IgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCBmaXJzdFRva2VuLmRvY3R5cGUgKSB7XG5cdFx0XHRcdHRoaXMuZG9jdHlwZSA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGZpcnN0VG9rZW4uc2VsZkNsb3NpbmcgKSB7XG5cdFx0XHRcdHRoaXMuc2VsZkNsb3NpbmcgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB2b2lkRWxlbWVudE5hbWVzLmluZGV4T2YoIGxvd2VyQ2FzZVRhZyApICE9PSAtMSApIHtcblx0XHRcdFx0dGhpcy5pc1ZvaWQgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aGlzLnNlbGZDbG9zaW5nIHx8IHRoaXMuaXNWb2lkICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnNpYmxpbmdzID0gc2libGluZ3NCeVRhZ05hbWVbIGxvd2VyQ2FzZVRhZyBdO1xuXHRcdFx0dGhpcy5pdGVtcyA9IFtdO1xuXHRcdFx0bmV4dCA9IHBhcnNlci5uZXh0KCk7XG5cdFx0XHR3aGlsZSAoIG5leHQgKSB7XG5cdFx0XHRcdGlmICggbmV4dC5tdXN0YWNoZVR5cGUgPT09IHR5cGVzLkNMT1NJTkcgKSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBuZXh0LnR5cGUgPT09IHR5cGVzLlRBRyApIHtcblx0XHRcdFx0XHRpZiAoIG5leHQuY2xvc2luZyApIHtcblx0XHRcdFx0XHRcdGlmICggbmV4dC5uYW1lLnRvTG93ZXJDYXNlKCkgPT09IGxvd2VyQ2FzZVRhZyApIHtcblx0XHRcdFx0XHRcdFx0cGFyc2VyLnBvcyArPSAxO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fSBlbHNlIGlmICggdGhpcy5zaWJsaW5ncyAmJiB0aGlzLnNpYmxpbmdzLmluZGV4T2YoIG5leHQubmFtZS50b0xvd2VyQ2FzZSgpICkgIT09IC0xICkge1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuaXRlbXMucHVzaCggcGFyc2VyLmdldFN0dWIoIHByZXNlcnZlV2hpdGVzcGFjZSApICk7XG5cdFx0XHRcdG5leHQgPSBwYXJzZXIubmV4dCgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhcHJlc2VydmVXaGl0ZXNwYWNlICkge1xuXHRcdFx0XHRpdGVtID0gdGhpcy5pdGVtc1sgMCBdO1xuXHRcdFx0XHRpZiAoIGl0ZW0gJiYgaXRlbS50eXBlID09PSB0eXBlcy5URVhUICkge1xuXHRcdFx0XHRcdGl0ZW0udGV4dCA9IGl0ZW0udGV4dC5yZXBsYWNlKCBsZWFkaW5nV2hpdGVzcGFjZSwgJycgKTtcblx0XHRcdFx0XHRpZiAoICFpdGVtLnRleHQgKSB7XG5cdFx0XHRcdFx0XHR0aGlzLml0ZW1zLnNoaWZ0KCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGl0ZW0gPSB0aGlzLml0ZW1zWyB0aGlzLml0ZW1zLmxlbmd0aCAtIDEgXTtcblx0XHRcdFx0aWYgKCBpdGVtICYmIGl0ZW0udHlwZSA9PT0gdHlwZXMuVEVYVCApIHtcblx0XHRcdFx0XHRpdGVtLnRleHQgPSBpdGVtLnRleHQucmVwbGFjZSggdHJhaWxpbmdXaGl0ZXNwYWNlLCAnJyApO1xuXHRcdFx0XHRcdGlmICggIWl0ZW0udGV4dCApIHtcblx0XHRcdFx0XHRcdHRoaXMuaXRlbXMucG9wKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRFbGVtZW50U3R1Yi5wcm90b3R5cGUgPSB7XG5cdFx0XHR0b0pTT046IHRvSlNPTixcblx0XHRcdHRvU3RyaW5nOiB0b1N0cmluZ1xuXHRcdH07XG5cdFx0YWxsRWxlbWVudE5hbWVzID0gJ2EgYWJiciBhY3JvbnltIGFkZHJlc3MgYXBwbGV0IGFyZWEgYiBiYXNlIGJhc2Vmb250IGJkbyBiaWcgYmxvY2txdW90ZSBib2R5IGJyIGJ1dHRvbiBjYXB0aW9uIGNlbnRlciBjaXRlIGNvZGUgY29sIGNvbGdyb3VwIGRkIGRlbCBkZm4gZGlyIGRpdiBkbCBkdCBlbSBmaWVsZHNldCBmb250IGZvcm0gZnJhbWUgZnJhbWVzZXQgaDEgaDIgaDMgaDQgaDUgaDYgaGVhZCBociBodG1sIGkgaWZyYW1lIGltZyBpbnB1dCBpbnMgaXNpbmRleCBrYmQgbGFiZWwgbGVnZW5kIGxpIGxpbmsgbWFwIG1lbnUgbWV0YSBub2ZyYW1lcyBub3NjcmlwdCBvYmplY3Qgb2wgcCBwYXJhbSBwcmUgcSBzIHNhbXAgc2NyaXB0IHNlbGVjdCBzbWFsbCBzcGFuIHN0cmlrZSBzdHJvbmcgc3R5bGUgc3ViIHN1cCB0ZXh0YXJlYSB0aXRsZSB0dCB1IHVsIHZhciBhcnRpY2xlIGFzaWRlIGF1ZGlvIGJkaSBjYW52YXMgY29tbWFuZCBkYXRhIGRhdGFncmlkIGRhdGFsaXN0IGRldGFpbHMgZW1iZWQgZXZlbnRzb3VyY2UgZmlnY2FwdGlvbiBmaWd1cmUgZm9vdGVyIGhlYWRlciBoZ3JvdXAga2V5Z2VuIG1hcmsgbWV0ZXIgbmF2IG91dHB1dCBwcm9ncmVzcyBydWJ5IHJwIHJ0IHNlY3Rpb24gc291cmNlIHN1bW1hcnkgdGltZSB0cmFjayB2aWRlbyB3YnInLnNwbGl0KCAnICcgKTtcblx0XHRjbG9zZWRCeVBhcmVudENsb3NlID0gJ2xpIGRkIHJ0IHJwIG9wdGdyb3VwIG9wdGlvbiB0Ym9keSB0Zm9vdCB0ciB0ZCB0aCcuc3BsaXQoICcgJyApO1xuXHRcdG9uUGF0dGVybiA9IC9eb25bYS16QS1aXS87XG5cdFx0c2FuaXRpemUgPSBmdW5jdGlvbiggYXR0ciApIHtcblx0XHRcdHZhciB2YWxpZCA9ICFvblBhdHRlcm4udGVzdCggYXR0ci5uYW1lICk7XG5cdFx0XHRyZXR1cm4gdmFsaWQ7XG5cdFx0fTtcblx0XHRyZXR1cm4gRWxlbWVudFN0dWI7XG5cdH0oIGNvbmZpZ190eXBlcywgY29uZmlnX3ZvaWRFbGVtZW50TmFtZXMsIHV0aWxzX3dhcm4sIHBhcnNlX1BhcnNlcl9nZXRFbGVtZW50X0VsZW1lbnRTdHViX3V0aWxzX3NpYmxpbmdzQnlUYWdOYW1lLCBwYXJzZV9QYXJzZXJfZ2V0RWxlbWVudF9FbGVtZW50U3R1Yl91dGlsc19maWx0ZXJBdHRyaWJ1dGVzLCBwYXJzZV9QYXJzZXJfZ2V0RWxlbWVudF9FbGVtZW50U3R1Yl91dGlsc19wcm9jZXNzRGlyZWN0aXZlLCBwYXJzZV9QYXJzZXJfZ2V0RWxlbWVudF9FbGVtZW50U3R1Yl90b0pTT04sIHBhcnNlX1BhcnNlcl9nZXRFbGVtZW50X0VsZW1lbnRTdHViX3RvU3RyaW5nLCBwYXJzZV9QYXJzZXJfU3RyaW5nU3R1Yl9fU3RyaW5nU3R1YiApO1xuXG5cdHZhciBwYXJzZV9QYXJzZXJfZ2V0RWxlbWVudF9fZ2V0RWxlbWVudCA9IGZ1bmN0aW9uKCB0eXBlcywgRWxlbWVudFN0dWIgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIHRva2VuICkge1xuXHRcdFx0aWYgKCB0aGlzLm9wdGlvbnMuc2FuaXRpemUgJiYgdGhpcy5vcHRpb25zLnNhbml0aXplLmVsZW1lbnRzICkge1xuXHRcdFx0XHRpZiAoIHRoaXMub3B0aW9ucy5zYW5pdGl6ZS5lbGVtZW50cy5pbmRleE9mKCB0b2tlbi5uYW1lLnRvTG93ZXJDYXNlKCkgKSAhPT0gLTEgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBuZXcgRWxlbWVudFN0dWIoIHRva2VuLCB0aGlzLCB0aGlzLnByZXNlcnZlV2hpdGVzcGFjZSApO1xuXHRcdH07XG5cdH0oIGNvbmZpZ190eXBlcywgcGFyc2VfUGFyc2VyX2dldEVsZW1lbnRfRWxlbWVudFN0dWJfX0VsZW1lbnRTdHViICk7XG5cblx0dmFyIHBhcnNlX1BhcnNlcl9fUGFyc2VyID0gZnVuY3Rpb24oIGdldFRleHQsIGdldENvbW1lbnQsIGdldE11c3RhY2hlLCBnZXRFbGVtZW50LCBqc29uaWZ5U3R1YnMgKSB7XG5cblx0XHR2YXIgUGFyc2VyO1xuXHRcdFBhcnNlciA9IGZ1bmN0aW9uKCB0b2tlbnMsIG9wdGlvbnMgKSB7XG5cdFx0XHR2YXIgc3R1Yiwgc3R1YnM7XG5cdFx0XHR0aGlzLnRva2VucyA9IHRva2VucyB8fCBbXTtcblx0XHRcdHRoaXMucG9zID0gMDtcblx0XHRcdHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG5cdFx0XHR0aGlzLnByZXNlcnZlV2hpdGVzcGFjZSA9IG9wdGlvbnMucHJlc2VydmVXaGl0ZXNwYWNlO1xuXHRcdFx0c3R1YnMgPSBbXTtcblx0XHRcdHdoaWxlICggc3R1YiA9IHRoaXMuZ2V0U3R1YigpICkge1xuXHRcdFx0XHRzdHVicy5wdXNoKCBzdHViICk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnJlc3VsdCA9IGpzb25pZnlTdHVicyggc3R1YnMsIG9wdGlvbnMubm9TdHJpbmdpZnksIHRydWUgKTtcblx0XHR9O1xuXHRcdFBhcnNlci5wcm90b3R5cGUgPSB7XG5cdFx0XHRnZXRTdHViOiBmdW5jdGlvbiggcHJlc2VydmVXaGl0ZXNwYWNlICkge1xuXHRcdFx0XHR2YXIgdG9rZW4gPSB0aGlzLm5leHQoKTtcblx0XHRcdFx0aWYgKCAhdG9rZW4gKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRoaXMuZ2V0VGV4dCggdG9rZW4sIHRoaXMucHJlc2VydmVXaGl0ZXNwYWNlIHx8IHByZXNlcnZlV2hpdGVzcGFjZSApIHx8IHRoaXMuZ2V0Q29tbWVudCggdG9rZW4gKSB8fCB0aGlzLmdldE11c3RhY2hlKCB0b2tlbiApIHx8IHRoaXMuZ2V0RWxlbWVudCggdG9rZW4gKTtcblx0XHRcdH0sXG5cdFx0XHRnZXRUZXh0OiBnZXRUZXh0LFxuXHRcdFx0Z2V0Q29tbWVudDogZ2V0Q29tbWVudCxcblx0XHRcdGdldE11c3RhY2hlOiBnZXRNdXN0YWNoZSxcblx0XHRcdGdldEVsZW1lbnQ6IGdldEVsZW1lbnQsXG5cdFx0XHRuZXh0OiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMudG9rZW5zWyB0aGlzLnBvcyBdO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIFBhcnNlcjtcblx0fSggcGFyc2VfUGFyc2VyX2dldFRleHRfX2dldFRleHQsIHBhcnNlX1BhcnNlcl9nZXRDb21tZW50X19nZXRDb21tZW50LCBwYXJzZV9QYXJzZXJfZ2V0TXVzdGFjaGVfX2dldE11c3RhY2hlLCBwYXJzZV9QYXJzZXJfZ2V0RWxlbWVudF9fZ2V0RWxlbWVudCwgcGFyc2VfUGFyc2VyX3V0aWxzX2pzb25pZnlTdHVicyApO1xuXG5cdC8vIFJhY3RpdmUucGFyc2Vcblx0Ly8gPT09PT09PT09PT09PT09XG5cdC8vXG5cdC8vIFRha2VzIGluIGEgc3RyaW5nLCBhbmQgcmV0dXJucyBhbiBvYmplY3QgcmVwcmVzZW50aW5nIHRoZSBwYXJzZWQgdGVtcGxhdGUuXG5cdC8vIEEgcGFyc2VkIHRlbXBsYXRlIGlzIGFuIGFycmF5IG9mIDEgb3IgbW9yZSAnZGVzY3JpcHRvcnMnLCB3aGljaCBpbiBzb21lXG5cdC8vIGNhc2VzIGhhdmUgY2hpbGRyZW4uXG5cdC8vXG5cdC8vIFRoZSBmb3JtYXQgaXMgb3B0aW1pc2VkIGZvciBzaXplLCBub3QgcmVhZGFiaWxpdHksIGhvd2V2ZXIgZm9yIHJlZmVyZW5jZSB0aGVcblx0Ly8ga2V5cyBmb3IgZWFjaCBkZXNjcmlwdG9yIGFyZSBhcyBmb2xsb3dzOlxuXHQvL1xuXHQvLyAqIHIgLSBSZWZlcmVuY2UsIGUuZy4gJ211c3RhY2hlJyBpbiB7e211c3RhY2hlfX1cblx0Ly8gKiB0IC0gVHlwZSBjb2RlIChlLmcuIDEgaXMgdGV4dCwgMiBpcyBpbnRlcnBvbGF0b3IuLi4pXG5cdC8vICogZiAtIEZyYWdtZW50LiBDb250YWlucyBhIGRlc2NyaXB0b3IncyBjaGlsZHJlblxuXHQvLyAqIGUgLSBFbGVtZW50IG5hbWVcblx0Ly8gKiBhIC0gbWFwIG9mIGVsZW1lbnQgQXR0cmlidXRlcywgb3IgcHJveHkgZXZlbnQvdHJhbnNpdGlvbiBBcmd1bWVudHNcblx0Ly8gKiBkIC0gRHluYW1pYyBwcm94eSBldmVudC90cmFuc2l0aW9uIGFyZ3VtZW50c1xuXHQvLyAqIG4gLSBpbmRpY2F0ZXMgYW4gaU52ZXJ0ZWQgc2VjdGlvblxuXHQvLyAqIGkgLSBJbmRleCByZWZlcmVuY2UsIGUuZy4gJ251bScgaW4ge3sjc2VjdGlvbjpudW19fWNvbnRlbnR7ey9zZWN0aW9ufX1cblx0Ly8gKiB2IC0gZVZlbnQgcHJveGllcyAoaS5lLiB3aGVuIHVzZXIgZS5nLiBjbGlja3Mgb24gYSBub2RlLCBmaXJlIHByb3h5IGV2ZW50KVxuXHQvLyAqIHggLSBlWHByZXNzaW9uc1xuXHQvLyAqIHMgLSBTdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgYW4gZXhwcmVzc2lvbiBmdW5jdGlvblxuXHQvLyAqIHQxIC0gaW50cm8gVHJhbnNpdGlvblxuXHQvLyAqIHQyIC0gb3V0cm8gVHJhbnNpdGlvblxuXHQvLyAqIG8gLSBkZWNPcmF0b3Jcblx0Ly8gKiB5IC0gaXMgZG9jdFlwZVxuXHR2YXIgcGFyc2VfX3BhcnNlID0gZnVuY3Rpb24oIHRva2VuaXplLCB0eXBlcywgUGFyc2VyICkge1xuXG5cdFx0dmFyIHBhcnNlLCBvbmx5V2hpdGVzcGFjZSwgaW5saW5lUGFydGlhbFN0YXJ0LCBpbmxpbmVQYXJ0aWFsRW5kLCBwYXJzZUNvbXBvdW5kVGVtcGxhdGU7XG5cdFx0b25seVdoaXRlc3BhY2UgPSAvXlxccyokLztcblx0XHRpbmxpbmVQYXJ0aWFsU3RhcnQgPSAvPCEtLVxccypcXHtcXHtcXHMqPlxccyooW2EtekEtWl8kXVthLXpBLVpfJDAtOV0qKVxccyp9XFx9XFxzKi0tPi87XG5cdFx0aW5saW5lUGFydGlhbEVuZCA9IC88IS0tXFxzKlxce1xce1xccypcXC9cXHMqKFthLXpBLVpfJF1bYS16QS1aXyQwLTldKilcXHMqfVxcfVxccyotLT4vO1xuXHRcdHBhcnNlID0gZnVuY3Rpb24oIHRlbXBsYXRlLCBvcHRpb25zICkge1xuXHRcdFx0dmFyIHRva2VucywganNvbiwgdG9rZW47XG5cdFx0XHRvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblx0XHRcdGlmICggaW5saW5lUGFydGlhbFN0YXJ0LnRlc3QoIHRlbXBsYXRlICkgKSB7XG5cdFx0XHRcdHJldHVybiBwYXJzZUNvbXBvdW5kVGVtcGxhdGUoIHRlbXBsYXRlLCBvcHRpb25zICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIG9wdGlvbnMuc2FuaXRpemUgPT09IHRydWUgKSB7XG5cdFx0XHRcdG9wdGlvbnMuc2FuaXRpemUgPSB7XG5cdFx0XHRcdFx0ZWxlbWVudHM6ICdhcHBsZXQgYmFzZSBiYXNlZm9udCBib2R5IGZyYW1lIGZyYW1lc2V0IGhlYWQgaHRtbCBpc2luZGV4IGxpbmsgbWV0YSBub2ZyYW1lcyBub3NjcmlwdCBvYmplY3QgcGFyYW0gc2NyaXB0IHN0eWxlIHRpdGxlJy5zcGxpdCggJyAnICksXG5cdFx0XHRcdFx0ZXZlbnRBdHRyaWJ1dGVzOiB0cnVlXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0XHR0b2tlbnMgPSB0b2tlbml6ZSggdGVtcGxhdGUsIG9wdGlvbnMgKTtcblx0XHRcdGlmICggIW9wdGlvbnMucHJlc2VydmVXaGl0ZXNwYWNlICkge1xuXHRcdFx0XHR0b2tlbiA9IHRva2Vuc1sgMCBdO1xuXHRcdFx0XHRpZiAoIHRva2VuICYmIHRva2VuLnR5cGUgPT09IHR5cGVzLlRFWFQgJiYgb25seVdoaXRlc3BhY2UudGVzdCggdG9rZW4udmFsdWUgKSApIHtcblx0XHRcdFx0XHR0b2tlbnMuc2hpZnQoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0b2tlbiA9IHRva2Vuc1sgdG9rZW5zLmxlbmd0aCAtIDEgXTtcblx0XHRcdFx0aWYgKCB0b2tlbiAmJiB0b2tlbi50eXBlID09PSB0eXBlcy5URVhUICYmIG9ubHlXaGl0ZXNwYWNlLnRlc3QoIHRva2VuLnZhbHVlICkgKSB7XG5cdFx0XHRcdFx0dG9rZW5zLnBvcCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRqc29uID0gbmV3IFBhcnNlciggdG9rZW5zLCBvcHRpb25zICkucmVzdWx0O1xuXHRcdFx0aWYgKCB0eXBlb2YganNvbiA9PT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdHJldHVybiBbIGpzb24gXTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBqc29uO1xuXHRcdH07XG5cdFx0cGFyc2VDb21wb3VuZFRlbXBsYXRlID0gZnVuY3Rpb24oIHRlbXBsYXRlLCBvcHRpb25zICkge1xuXHRcdFx0dmFyIG1haW5UZW1wbGF0ZSwgcmVtYWluaW5nLCBwYXJ0aWFscywgbmFtZSwgc3RhcnRNYXRjaCwgZW5kTWF0Y2g7XG5cdFx0XHRwYXJ0aWFscyA9IHt9O1xuXHRcdFx0bWFpblRlbXBsYXRlID0gJyc7XG5cdFx0XHRyZW1haW5pbmcgPSB0ZW1wbGF0ZTtcblx0XHRcdHdoaWxlICggc3RhcnRNYXRjaCA9IGlubGluZVBhcnRpYWxTdGFydC5leGVjKCByZW1haW5pbmcgKSApIHtcblx0XHRcdFx0bmFtZSA9IHN0YXJ0TWF0Y2hbIDEgXTtcblx0XHRcdFx0bWFpblRlbXBsYXRlICs9IHJlbWFpbmluZy5zdWJzdHIoIDAsIHN0YXJ0TWF0Y2guaW5kZXggKTtcblx0XHRcdFx0cmVtYWluaW5nID0gcmVtYWluaW5nLnN1YnN0cmluZyggc3RhcnRNYXRjaC5pbmRleCArIHN0YXJ0TWF0Y2hbIDAgXS5sZW5ndGggKTtcblx0XHRcdFx0ZW5kTWF0Y2ggPSBpbmxpbmVQYXJ0aWFsRW5kLmV4ZWMoIHJlbWFpbmluZyApO1xuXHRcdFx0XHRpZiAoICFlbmRNYXRjaCB8fCBlbmRNYXRjaFsgMSBdICE9PSBuYW1lICkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ0lubGluZSBwYXJ0aWFscyBtdXN0IGhhdmUgYSBjbG9zaW5nIGRlbGltaXRlciwgYW5kIGNhbm5vdCBiZSBuZXN0ZWQnICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cGFydGlhbHNbIG5hbWUgXSA9IHBhcnNlKCByZW1haW5pbmcuc3Vic3RyKCAwLCBlbmRNYXRjaC5pbmRleCApLCBvcHRpb25zICk7XG5cdFx0XHRcdHJlbWFpbmluZyA9IHJlbWFpbmluZy5zdWJzdHJpbmcoIGVuZE1hdGNoLmluZGV4ICsgZW5kTWF0Y2hbIDAgXS5sZW5ndGggKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdG1haW46IHBhcnNlKCBtYWluVGVtcGxhdGUsIG9wdGlvbnMgKSxcblx0XHRcdFx0cGFydGlhbHM6IHBhcnRpYWxzXG5cdFx0XHR9O1xuXHRcdH07XG5cdFx0cmV0dXJuIHBhcnNlO1xuXHR9KCBwYXJzZV90b2tlbml6ZSwgY29uZmlnX3R5cGVzLCBwYXJzZV9QYXJzZXJfX1BhcnNlciApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfUGFydGlhbF9kZUluZGVudCA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0dmFyIGVtcHR5ID0gL15cXHMqJC8sXG5cdFx0XHRsZWFkaW5nV2hpdGVzcGFjZSA9IC9eXFxzKi87XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBzdHIgKSB7XG5cdFx0XHR2YXIgbGluZXMsIGZpcnN0TGluZSwgbGFzdExpbmUsIG1pbkluZGVudDtcblx0XHRcdGxpbmVzID0gc3RyLnNwbGl0KCAnXFxuJyApO1xuXHRcdFx0Zmlyc3RMaW5lID0gbGluZXNbIDAgXTtcblx0XHRcdGlmICggZmlyc3RMaW5lICE9PSB1bmRlZmluZWQgJiYgZW1wdHkudGVzdCggZmlyc3RMaW5lICkgKSB7XG5cdFx0XHRcdGxpbmVzLnNoaWZ0KCk7XG5cdFx0XHR9XG5cdFx0XHRsYXN0TGluZSA9IGxpbmVzWyBsaW5lcy5sZW5ndGggLSAxIF07XG5cdFx0XHRpZiAoIGxhc3RMaW5lICE9PSB1bmRlZmluZWQgJiYgZW1wdHkudGVzdCggbGFzdExpbmUgKSApIHtcblx0XHRcdFx0bGluZXMucG9wKCk7XG5cdFx0XHR9XG5cdFx0XHRtaW5JbmRlbnQgPSBsaW5lcy5yZWR1Y2UoIHJlZHVjZXIsIG51bGwgKTtcblx0XHRcdGlmICggbWluSW5kZW50ICkge1xuXHRcdFx0XHRzdHIgPSBsaW5lcy5tYXAoIGZ1bmN0aW9uKCBsaW5lICkge1xuXHRcdFx0XHRcdHJldHVybiBsaW5lLnJlcGxhY2UoIG1pbkluZGVudCwgJycgKTtcblx0XHRcdFx0fSApLmpvaW4oICdcXG4nICk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gc3RyO1xuXHRcdH07XG5cblx0XHRmdW5jdGlvbiByZWR1Y2VyKCBwcmV2aW91cywgbGluZSApIHtcblx0XHRcdHZhciBsaW5lSW5kZW50ID0gbGVhZGluZ1doaXRlc3BhY2UuZXhlYyggbGluZSApWyAwIF07XG5cdFx0XHRpZiAoIHByZXZpb3VzID09PSBudWxsIHx8IGxpbmVJbmRlbnQubGVuZ3RoIDwgcHJldmlvdXMubGVuZ3RoICkge1xuXHRcdFx0XHRyZXR1cm4gbGluZUluZGVudDtcblx0XHRcdH1cblx0XHRcdHJldHVybiBwcmV2aW91cztcblx0XHR9XG5cdH0oKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X1BhcnRpYWxfZ2V0UGFydGlhbERlc2NyaXB0b3IgPSBmdW5jdGlvbiggZXJyb3JzLCBpc0NsaWVudCwgd2FybiwgaXNPYmplY3QsIHBhcnRpYWxzLCBwYXJzZSwgZGVJbmRlbnQgKSB7XG5cblx0XHR2YXIgZ2V0UGFydGlhbERlc2NyaXB0b3IsIHJlZ2lzdGVyUGFydGlhbCwgZ2V0UGFydGlhbEZyb21SZWdpc3RyeSwgdW5wYWNrO1xuXHRcdGdldFBhcnRpYWxEZXNjcmlwdG9yID0gZnVuY3Rpb24oIHJvb3QsIG5hbWUgKSB7XG5cdFx0XHR2YXIgZWwsIHBhcnRpYWwsIGVycm9yTWVzc2FnZTtcblx0XHRcdGlmICggcGFydGlhbCA9IGdldFBhcnRpYWxGcm9tUmVnaXN0cnkoIHJvb3QsIG5hbWUgKSApIHtcblx0XHRcdFx0cmV0dXJuIHBhcnRpYWw7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGlzQ2xpZW50ICkge1xuXHRcdFx0XHRlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBuYW1lICk7XG5cdFx0XHRcdGlmICggZWwgJiYgZWwudGFnTmFtZSA9PT0gJ1NDUklQVCcgKSB7XG5cdFx0XHRcdFx0aWYgKCAhcGFyc2UgKSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoIGVycm9ycy5taXNzaW5nUGFyc2VyICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJlZ2lzdGVyUGFydGlhbCggcGFyc2UoIGRlSW5kZW50KCBlbC50ZXh0ICksIHJvb3QucGFyc2VPcHRpb25zICksIG5hbWUsIHBhcnRpYWxzICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHBhcnRpYWwgPSBwYXJ0aWFsc1sgbmFtZSBdO1xuXHRcdFx0aWYgKCAhcGFydGlhbCApIHtcblx0XHRcdFx0ZXJyb3JNZXNzYWdlID0gJ0NvdWxkIG5vdCBmaW5kIGRlc2NyaXB0b3IgZm9yIHBhcnRpYWwgXCInICsgbmFtZSArICdcIic7XG5cdFx0XHRcdGlmICggcm9vdC5kZWJ1ZyApIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoIGVycm9yTWVzc2FnZSApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHdhcm4oIGVycm9yTWVzc2FnZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBbXTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB1bnBhY2soIHBhcnRpYWwgKTtcblx0XHR9O1xuXHRcdGdldFBhcnRpYWxGcm9tUmVnaXN0cnkgPSBmdW5jdGlvbiggcmFjdGl2ZSwgbmFtZSApIHtcblx0XHRcdHZhciBwYXJ0aWFsO1xuXHRcdFx0aWYgKCByYWN0aXZlLnBhcnRpYWxzWyBuYW1lIF0gKSB7XG5cdFx0XHRcdGlmICggdHlwZW9mIHJhY3RpdmUucGFydGlhbHNbIG5hbWUgXSA9PT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdFx0aWYgKCAhcGFyc2UgKSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoIGVycm9ycy5taXNzaW5nUGFyc2VyICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHBhcnRpYWwgPSBwYXJzZSggcmFjdGl2ZS5wYXJ0aWFsc1sgbmFtZSBdLCByYWN0aXZlLnBhcnNlT3B0aW9ucyApO1xuXHRcdFx0XHRcdHJlZ2lzdGVyUGFydGlhbCggcGFydGlhbCwgbmFtZSwgcmFjdGl2ZS5wYXJ0aWFscyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB1bnBhY2soIHJhY3RpdmUucGFydGlhbHNbIG5hbWUgXSApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmVnaXN0ZXJQYXJ0aWFsID0gZnVuY3Rpb24oIHBhcnRpYWwsIG5hbWUsIHJlZ2lzdHJ5ICkge1xuXHRcdFx0dmFyIGtleTtcblx0XHRcdGlmICggaXNPYmplY3QoIHBhcnRpYWwgKSApIHtcblx0XHRcdFx0cmVnaXN0cnlbIG5hbWUgXSA9IHBhcnRpYWwubWFpbjtcblx0XHRcdFx0Zm9yICgga2V5IGluIHBhcnRpYWwucGFydGlhbHMgKSB7XG5cdFx0XHRcdFx0aWYgKCBwYXJ0aWFsLnBhcnRpYWxzLmhhc093blByb3BlcnR5KCBrZXkgKSApIHtcblx0XHRcdFx0XHRcdHJlZ2lzdHJ5WyBrZXkgXSA9IHBhcnRpYWwucGFydGlhbHNbIGtleSBdO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVnaXN0cnlbIG5hbWUgXSA9IHBhcnRpYWw7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHR1bnBhY2sgPSBmdW5jdGlvbiggcGFydGlhbCApIHtcblx0XHRcdGlmICggcGFydGlhbC5sZW5ndGggPT09IDEgJiYgdHlwZW9mIHBhcnRpYWxbIDAgXSA9PT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdHJldHVybiBwYXJ0aWFsWyAwIF07XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcGFydGlhbDtcblx0XHR9O1xuXHRcdHJldHVybiBnZXRQYXJ0aWFsRGVzY3JpcHRvcjtcblx0fSggY29uZmlnX2Vycm9ycywgY29uZmlnX2lzQ2xpZW50LCB1dGlsc193YXJuLCB1dGlsc19pc09iamVjdCwgcmVnaXN0cmllc19wYXJ0aWFscywgcGFyc2VfX3BhcnNlLCByZW5kZXJfRG9tRnJhZ21lbnRfUGFydGlhbF9kZUluZGVudCApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfUGFydGlhbF9hcHBseUluZGVudCA9IGZ1bmN0aW9uKCBzdHJpbmcsIGluZGVudCApIHtcblx0XHR2YXIgaW5kZW50ZWQ7XG5cdFx0aWYgKCAhaW5kZW50ICkge1xuXHRcdFx0cmV0dXJuIHN0cmluZztcblx0XHR9XG5cdFx0aW5kZW50ZWQgPSBzdHJpbmcuc3BsaXQoICdcXG4nICkubWFwKCBmdW5jdGlvbiggbGluZSwgbm90Rmlyc3RMaW5lICkge1xuXHRcdFx0cmV0dXJuIG5vdEZpcnN0TGluZSA/IGluZGVudCArIGxpbmUgOiBsaW5lO1xuXHRcdH0gKS5qb2luKCAnXFxuJyApO1xuXHRcdHJldHVybiBpbmRlbnRlZDtcblx0fTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X1BhcnRpYWxfX1BhcnRpYWwgPSBmdW5jdGlvbiggdHlwZXMsIGdldFBhcnRpYWxEZXNjcmlwdG9yLCBhcHBseUluZGVudCwgY2lyY3VsYXIgKSB7XG5cblx0XHR2YXIgRG9tUGFydGlhbCwgRG9tRnJhZ21lbnQ7XG5cdFx0Y2lyY3VsYXIucHVzaCggZnVuY3Rpb24oKSB7XG5cdFx0XHREb21GcmFnbWVudCA9IGNpcmN1bGFyLkRvbUZyYWdtZW50O1xuXHRcdH0gKTtcblx0XHREb21QYXJ0aWFsID0gZnVuY3Rpb24oIG9wdGlvbnMsIGRvY0ZyYWcgKSB7XG5cdFx0XHR2YXIgcGFyZW50RnJhZ21lbnQgPSB0aGlzLnBhcmVudEZyYWdtZW50ID0gb3B0aW9ucy5wYXJlbnRGcmFnbWVudCxcblx0XHRcdFx0ZGVzY3JpcHRvcjtcblx0XHRcdHRoaXMudHlwZSA9IHR5cGVzLlBBUlRJQUw7XG5cdFx0XHR0aGlzLm5hbWUgPSBvcHRpb25zLmRlc2NyaXB0b3Iucjtcblx0XHRcdHRoaXMuaW5kZXggPSBvcHRpb25zLmluZGV4O1xuXHRcdFx0aWYgKCAhb3B0aW9ucy5kZXNjcmlwdG9yLnIgKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ1BhcnRpYWxzIG11c3QgaGF2ZSBhIHN0YXRpYyByZWZlcmVuY2UgKG5vIGV4cHJlc3Npb25zKS4gVGhpcyBtYXkgY2hhbmdlIGluIGEgZnV0dXJlIHZlcnNpb24gb2YgUmFjdGl2ZS4nICk7XG5cdFx0XHR9XG5cdFx0XHRkZXNjcmlwdG9yID0gZ2V0UGFydGlhbERlc2NyaXB0b3IoIHBhcmVudEZyYWdtZW50LnJvb3QsIG9wdGlvbnMuZGVzY3JpcHRvci5yICk7XG5cdFx0XHR0aGlzLmZyYWdtZW50ID0gbmV3IERvbUZyYWdtZW50KCB7XG5cdFx0XHRcdGRlc2NyaXB0b3I6IGRlc2NyaXB0b3IsXG5cdFx0XHRcdHJvb3Q6IHBhcmVudEZyYWdtZW50LnJvb3QsXG5cdFx0XHRcdHBOb2RlOiBwYXJlbnRGcmFnbWVudC5wTm9kZSxcblx0XHRcdFx0b3duZXI6IHRoaXNcblx0XHRcdH0gKTtcblx0XHRcdGlmICggZG9jRnJhZyApIHtcblx0XHRcdFx0ZG9jRnJhZy5hcHBlbmRDaGlsZCggdGhpcy5mcmFnbWVudC5kb2NGcmFnICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHREb21QYXJ0aWFsLnByb3RvdHlwZSA9IHtcblx0XHRcdGZpcnN0Tm9kZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmZyYWdtZW50LmZpcnN0Tm9kZSgpO1xuXHRcdFx0fSxcblx0XHRcdGZpbmROZXh0Tm9kZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnBhcmVudEZyYWdtZW50LmZpbmROZXh0Tm9kZSggdGhpcyApO1xuXHRcdFx0fSxcblx0XHRcdGRldGFjaDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmZyYWdtZW50LmRldGFjaCgpO1xuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbiggZGVzdHJveSApIHtcblx0XHRcdFx0dGhpcy5mcmFnbWVudC50ZWFyZG93biggZGVzdHJveSApO1xuXHRcdFx0fSxcblx0XHRcdHRvU3RyaW5nOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHN0cmluZywgcHJldmlvdXNJdGVtLCBsYXN0TGluZSwgbWF0Y2g7XG5cdFx0XHRcdHN0cmluZyA9IHRoaXMuZnJhZ21lbnQudG9TdHJpbmcoKTtcblx0XHRcdFx0cHJldmlvdXNJdGVtID0gdGhpcy5wYXJlbnRGcmFnbWVudC5pdGVtc1sgdGhpcy5pbmRleCAtIDEgXTtcblx0XHRcdFx0aWYgKCAhcHJldmlvdXNJdGVtIHx8IHByZXZpb3VzSXRlbS50eXBlICE9PSB0eXBlcy5URVhUICkge1xuXHRcdFx0XHRcdHJldHVybiBzdHJpbmc7XG5cdFx0XHRcdH1cblx0XHRcdFx0bGFzdExpbmUgPSBwcmV2aW91c0l0ZW0uZGVzY3JpcHRvci5zcGxpdCggJ1xcbicgKS5wb3AoKTtcblx0XHRcdFx0aWYgKCBtYXRjaCA9IC9eXFxzKyQvLmV4ZWMoIGxhc3RMaW5lICkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGFwcGx5SW5kZW50KCBzdHJpbmcsIG1hdGNoWyAwIF0gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gc3RyaW5nO1xuXHRcdFx0fSxcblx0XHRcdGZpbmQ6IGZ1bmN0aW9uKCBzZWxlY3RvciApIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuZnJhZ21lbnQuZmluZCggc2VsZWN0b3IgKTtcblx0XHRcdH0sXG5cdFx0XHRmaW5kQWxsOiBmdW5jdGlvbiggc2VsZWN0b3IsIHF1ZXJ5ICkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5mcmFnbWVudC5maW5kQWxsKCBzZWxlY3RvciwgcXVlcnkgKTtcblx0XHRcdH0sXG5cdFx0XHRmaW5kQ29tcG9uZW50OiBmdW5jdGlvbiggc2VsZWN0b3IgKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmZyYWdtZW50LmZpbmRDb21wb25lbnQoIHNlbGVjdG9yICk7XG5cdFx0XHR9LFxuXHRcdFx0ZmluZEFsbENvbXBvbmVudHM6IGZ1bmN0aW9uKCBzZWxlY3RvciwgcXVlcnkgKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmZyYWdtZW50LmZpbmRBbGxDb21wb25lbnRzKCBzZWxlY3RvciwgcXVlcnkgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBEb21QYXJ0aWFsO1xuXHR9KCBjb25maWdfdHlwZXMsIHJlbmRlcl9Eb21GcmFnbWVudF9QYXJ0aWFsX2dldFBhcnRpYWxEZXNjcmlwdG9yLCByZW5kZXJfRG9tRnJhZ21lbnRfUGFydGlhbF9hcHBseUluZGVudCwgY2lyY3VsYXIgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0NvbXBvbmVudF9pbml0aWFsaXNlX2NyZWF0ZU1vZGVsX0NvbXBvbmVudFBhcmFtZXRlciA9IGZ1bmN0aW9uKCBydW5sb29wLCBTdHJpbmdGcmFnbWVudCApIHtcblxuXHRcdHZhciBDb21wb25lbnRQYXJhbWV0ZXIgPSBmdW5jdGlvbiggY29tcG9uZW50LCBrZXksIHZhbHVlICkge1xuXHRcdFx0dGhpcy5wYXJlbnRGcmFnbWVudCA9IGNvbXBvbmVudC5wYXJlbnRGcmFnbWVudDtcblx0XHRcdHRoaXMuY29tcG9uZW50ID0gY29tcG9uZW50O1xuXHRcdFx0dGhpcy5rZXkgPSBrZXk7XG5cdFx0XHR0aGlzLmZyYWdtZW50ID0gbmV3IFN0cmluZ0ZyYWdtZW50KCB7XG5cdFx0XHRcdGRlc2NyaXB0b3I6IHZhbHVlLFxuXHRcdFx0XHRyb290OiBjb21wb25lbnQucm9vdCxcblx0XHRcdFx0b3duZXI6IHRoaXNcblx0XHRcdH0gKTtcblx0XHRcdHRoaXMuc2VsZlVwZGF0aW5nID0gdGhpcy5mcmFnbWVudC5pc1NpbXBsZSgpO1xuXHRcdFx0dGhpcy52YWx1ZSA9IHRoaXMuZnJhZ21lbnQuZ2V0VmFsdWUoKTtcblx0XHR9O1xuXHRcdENvbXBvbmVudFBhcmFtZXRlci5wcm90b3R5cGUgPSB7XG5cdFx0XHRidWJibGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZiAoIHRoaXMuc2VsZlVwZGF0aW5nICkge1xuXHRcdFx0XHRcdHRoaXMudXBkYXRlKCk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoICF0aGlzLmRlZmVycmVkICYmIHRoaXMucmVhZHkgKSB7XG5cdFx0XHRcdFx0cnVubG9vcC5hZGRBdHRyaWJ1dGUoIHRoaXMgKTtcblx0XHRcdFx0XHR0aGlzLmRlZmVycmVkID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHVwZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciB2YWx1ZSA9IHRoaXMuZnJhZ21lbnQuZ2V0VmFsdWUoKTtcblx0XHRcdFx0dGhpcy5jb21wb25lbnQuaW5zdGFuY2Uuc2V0KCB0aGlzLmtleSwgdmFsdWUgKTtcblx0XHRcdFx0dGhpcy52YWx1ZSA9IHZhbHVlO1xuXHRcdFx0fSxcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dGhpcy5mcmFnbWVudC50ZWFyZG93bigpO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIENvbXBvbmVudFBhcmFtZXRlcjtcblx0fSggZ2xvYmFsX3J1bmxvb3AsIHJlbmRlcl9TdHJpbmdGcmFnbWVudF9fU3RyaW5nRnJhZ21lbnQgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0NvbXBvbmVudF9pbml0aWFsaXNlX2NyZWF0ZU1vZGVsX19jcmVhdGVNb2RlbCA9IGZ1bmN0aW9uKCB0eXBlcywgcGFyc2VKU09OLCByZXNvbHZlUmVmLCBnZXQsIENvbXBvbmVudFBhcmFtZXRlciApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggY29tcG9uZW50LCBkZWZhdWx0RGF0YSwgYXR0cmlidXRlcywgdG9CaW5kICkge1xuXHRcdFx0dmFyIGRhdGEsIGtleSwgdmFsdWU7XG5cdFx0XHRkYXRhID0ge307XG5cdFx0XHRjb21wb25lbnQuY29tcGxleFBhcmFtZXRlcnMgPSBbXTtcblx0XHRcdGZvciAoIGtleSBpbiBhdHRyaWJ1dGVzICkge1xuXHRcdFx0XHRpZiAoIGF0dHJpYnV0ZXMuaGFzT3duUHJvcGVydHkoIGtleSApICkge1xuXHRcdFx0XHRcdHZhbHVlID0gZ2V0VmFsdWUoIGNvbXBvbmVudCwga2V5LCBhdHRyaWJ1dGVzWyBrZXkgXSwgdG9CaW5kICk7XG5cdFx0XHRcdFx0aWYgKCB2YWx1ZSAhPT0gdW5kZWZpbmVkIHx8IGRlZmF1bHREYXRhWyBrZXkgXSA9PT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRcdFx0ZGF0YVsga2V5IF0gPSB2YWx1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBkYXRhO1xuXHRcdH07XG5cblx0XHRmdW5jdGlvbiBnZXRWYWx1ZSggY29tcG9uZW50LCBrZXksIGRlc2NyaXB0b3IsIHRvQmluZCApIHtcblx0XHRcdHZhciBwYXJhbWV0ZXIsIHBhcnNlZCwgcGFyZW50SW5zdGFuY2UsIHBhcmVudEZyYWdtZW50LCBrZXlwYXRoO1xuXHRcdFx0cGFyZW50SW5zdGFuY2UgPSBjb21wb25lbnQucm9vdDtcblx0XHRcdHBhcmVudEZyYWdtZW50ID0gY29tcG9uZW50LnBhcmVudEZyYWdtZW50O1xuXHRcdFx0aWYgKCB0eXBlb2YgZGVzY3JpcHRvciA9PT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdHBhcnNlZCA9IHBhcnNlSlNPTiggZGVzY3JpcHRvciApO1xuXHRcdFx0XHRyZXR1cm4gcGFyc2VkID8gcGFyc2VkLnZhbHVlIDogZGVzY3JpcHRvcjtcblx0XHRcdH1cblx0XHRcdGlmICggZGVzY3JpcHRvciA9PT0gbnVsbCApIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGRlc2NyaXB0b3IubGVuZ3RoID09PSAxICYmIGRlc2NyaXB0b3JbIDAgXS50ID09PSB0eXBlcy5JTlRFUlBPTEFUT1IgJiYgZGVzY3JpcHRvclsgMCBdLnIgKSB7XG5cdFx0XHRcdGlmICggcGFyZW50RnJhZ21lbnQuaW5kZXhSZWZzICYmIHBhcmVudEZyYWdtZW50LmluZGV4UmVmc1sgZGVzY3JpcHRvclsgMCBdLnIgXSAhPT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRcdHJldHVybiBwYXJlbnRGcmFnbWVudC5pbmRleFJlZnNbIGRlc2NyaXB0b3JbIDAgXS5yIF07XG5cdFx0XHRcdH1cblx0XHRcdFx0a2V5cGF0aCA9IHJlc29sdmVSZWYoIHBhcmVudEluc3RhbmNlLCBkZXNjcmlwdG9yWyAwIF0uciwgcGFyZW50RnJhZ21lbnQgKSB8fCBkZXNjcmlwdG9yWyAwIF0ucjtcblx0XHRcdFx0dG9CaW5kLnB1c2goIHtcblx0XHRcdFx0XHRjaGlsZEtleXBhdGg6IGtleSxcblx0XHRcdFx0XHRwYXJlbnRLZXlwYXRoOiBrZXlwYXRoXG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0cmV0dXJuIGdldCggcGFyZW50SW5zdGFuY2UsIGtleXBhdGggKTtcblx0XHRcdH1cblx0XHRcdHBhcmFtZXRlciA9IG5ldyBDb21wb25lbnRQYXJhbWV0ZXIoIGNvbXBvbmVudCwga2V5LCBkZXNjcmlwdG9yICk7XG5cdFx0XHRjb21wb25lbnQuY29tcGxleFBhcmFtZXRlcnMucHVzaCggcGFyYW1ldGVyICk7XG5cdFx0XHRyZXR1cm4gcGFyYW1ldGVyLnZhbHVlO1xuXHRcdH1cblx0fSggY29uZmlnX3R5cGVzLCB1dGlsc19wYXJzZUpTT04sIHNoYXJlZF9yZXNvbHZlUmVmLCBzaGFyZWRfZ2V0X19nZXQsIHJlbmRlcl9Eb21GcmFnbWVudF9Db21wb25lbnRfaW5pdGlhbGlzZV9jcmVhdGVNb2RlbF9Db21wb25lbnRQYXJhbWV0ZXIgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0NvbXBvbmVudF9pbml0aWFsaXNlX2NyZWF0ZUluc3RhbmNlID0gZnVuY3Rpb24oKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIGNvbXBvbmVudCwgQ29tcG9uZW50LCBkYXRhLCBkb2NGcmFnLCBjb250ZW50RGVzY3JpcHRvciApIHtcblx0XHRcdHZhciBpbnN0YW5jZSwgcGFyZW50RnJhZ21lbnQsIHBhcnRpYWxzLCByb290LCBhZGFwdDtcblx0XHRcdHBhcmVudEZyYWdtZW50ID0gY29tcG9uZW50LnBhcmVudEZyYWdtZW50O1xuXHRcdFx0cm9vdCA9IGNvbXBvbmVudC5yb290O1xuXHRcdFx0cGFydGlhbHMgPSB7XG5cdFx0XHRcdGNvbnRlbnQ6IGNvbnRlbnREZXNjcmlwdG9yIHx8IFtdXG5cdFx0XHR9O1xuXHRcdFx0YWRhcHQgPSBjb21iaW5lQWRhcHRvcnMoIHJvb3QsIENvbXBvbmVudC5kZWZhdWx0cy5hZGFwdCwgQ29tcG9uZW50LmFkYXB0b3JzICk7XG5cdFx0XHRpbnN0YW5jZSA9IG5ldyBDb21wb25lbnQoIHtcblx0XHRcdFx0ZWw6IHBhcmVudEZyYWdtZW50LnBOb2RlLFxuXHRcdFx0XHRhcHBlbmQ6IHRydWUsXG5cdFx0XHRcdGRhdGE6IGRhdGEsXG5cdFx0XHRcdHBhcnRpYWxzOiBwYXJ0aWFscyxcblx0XHRcdFx0bWFnaWM6IHJvb3QubWFnaWMgfHwgQ29tcG9uZW50LmRlZmF1bHRzLm1hZ2ljLFxuXHRcdFx0XHRtb2RpZnlBcnJheXM6IHJvb3QubW9kaWZ5QXJyYXlzLFxuXHRcdFx0XHRfcGFyZW50OiByb290LFxuXHRcdFx0XHRfY29tcG9uZW50OiBjb21wb25lbnQsXG5cdFx0XHRcdGFkYXB0OiBhZGFwdFxuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCBkb2NGcmFnICkge1xuXHRcdFx0XHRpbnN0YW5jZS5pbnNlcnQoIGRvY0ZyYWcgKTtcblx0XHRcdFx0aW5zdGFuY2UuZnJhZ21lbnQucE5vZGUgPSBpbnN0YW5jZS5lbCA9IHBhcmVudEZyYWdtZW50LnBOb2RlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGluc3RhbmNlO1xuXHRcdH07XG5cblx0XHRmdW5jdGlvbiBjb21iaW5lQWRhcHRvcnMoIHJvb3QsIGRlZmF1bHRBZGFwdCApIHtcblx0XHRcdHZhciBhZGFwdCwgbGVuLCBpO1xuXHRcdFx0aWYgKCByb290LmFkYXB0Lmxlbmd0aCApIHtcblx0XHRcdFx0YWRhcHQgPSByb290LmFkYXB0Lm1hcCggZnVuY3Rpb24oIHN0cmluZ09yT2JqZWN0ICkge1xuXHRcdFx0XHRcdGlmICggdHlwZW9mIHN0cmluZ09yT2JqZWN0ID09PSAnb2JqZWN0JyApIHtcblx0XHRcdFx0XHRcdHJldHVybiBzdHJpbmdPck9iamVjdDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHJvb3QuYWRhcHRvcnNbIHN0cmluZ09yT2JqZWN0IF0gfHwgc3RyaW5nT3JPYmplY3Q7XG5cdFx0XHRcdH0gKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGFkYXB0ID0gW107XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGxlbiA9IGRlZmF1bHRBZGFwdC5sZW5ndGggKSB7XG5cdFx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0aWYgKCBhZGFwdC5pbmRleE9mKCBkZWZhdWx0QWRhcHRbIGkgXSApID09PSAtMSApIHtcblx0XHRcdFx0XHRcdGFkYXB0LnB1c2goIGRlZmF1bHRBZGFwdFsgaSBdICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gYWRhcHQ7XG5cdFx0fVxuXHR9KCk7XG5cblx0dmFyIHJlbmRlcl9Eb21GcmFnbWVudF9Db21wb25lbnRfaW5pdGlhbGlzZV9jcmVhdGVCaW5kaW5ncyA9IGZ1bmN0aW9uKCBjcmVhdGVDb21wb25lbnRCaW5kaW5nLCBnZXQsIHNldCApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiBjcmVhdGVJbml0aWFsQ29tcG9uZW50QmluZGluZ3MoIGNvbXBvbmVudCwgdG9CaW5kICkge1xuXHRcdFx0dG9CaW5kLmZvckVhY2goIGZ1bmN0aW9uIGNyZWF0ZUluaXRpYWxDb21wb25lbnRCaW5kaW5nKCBwYWlyICkge1xuXHRcdFx0XHR2YXIgY2hpbGRWYWx1ZTtcblx0XHRcdFx0Y3JlYXRlQ29tcG9uZW50QmluZGluZyggY29tcG9uZW50LCBjb21wb25lbnQucm9vdCwgcGFpci5wYXJlbnRLZXlwYXRoLCBwYWlyLmNoaWxkS2V5cGF0aCApO1xuXHRcdFx0XHRjaGlsZFZhbHVlID0gZ2V0KCBjb21wb25lbnQuaW5zdGFuY2UsIHBhaXIuY2hpbGRLZXlwYXRoICk7XG5cdFx0XHRcdGlmICggY2hpbGRWYWx1ZSAhPT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRcdHNldCggY29tcG9uZW50LnJvb3QsIHBhaXIucGFyZW50S2V5cGF0aCwgY2hpbGRWYWx1ZSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0fTtcblx0fSggc2hhcmVkX2NyZWF0ZUNvbXBvbmVudEJpbmRpbmcsIHNoYXJlZF9nZXRfX2dldCwgc2hhcmVkX3NldCApO1xuXG5cdHZhciByZW5kZXJfRG9tRnJhZ21lbnRfQ29tcG9uZW50X2luaXRpYWxpc2VfcHJvcGFnYXRlRXZlbnRzID0gZnVuY3Rpb24oIHdhcm4gKSB7XG5cblx0XHR2YXIgZXJyb3JNZXNzYWdlID0gJ0NvbXBvbmVudHMgY3VycmVudGx5IG9ubHkgc3VwcG9ydCBzaW1wbGUgZXZlbnRzIC0geW91IGNhbm5vdCBpbmNsdWRlIGFyZ3VtZW50cy4gU29ycnkhJztcblx0XHRyZXR1cm4gZnVuY3Rpb24oIGNvbXBvbmVudCwgZXZlbnRzRGVzY3JpcHRvciApIHtcblx0XHRcdHZhciBldmVudE5hbWU7XG5cdFx0XHRmb3IgKCBldmVudE5hbWUgaW4gZXZlbnRzRGVzY3JpcHRvciApIHtcblx0XHRcdFx0aWYgKCBldmVudHNEZXNjcmlwdG9yLmhhc093blByb3BlcnR5KCBldmVudE5hbWUgKSApIHtcblx0XHRcdFx0XHRwcm9wYWdhdGVFdmVudCggY29tcG9uZW50Lmluc3RhbmNlLCBjb21wb25lbnQucm9vdCwgZXZlbnROYW1lLCBldmVudHNEZXNjcmlwdG9yWyBldmVudE5hbWUgXSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGZ1bmN0aW9uIHByb3BhZ2F0ZUV2ZW50KCBjaGlsZEluc3RhbmNlLCBwYXJlbnRJbnN0YW5jZSwgZXZlbnROYW1lLCBwcm94eUV2ZW50TmFtZSApIHtcblx0XHRcdGlmICggdHlwZW9mIHByb3h5RXZlbnROYW1lICE9PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0aWYgKCBwYXJlbnRJbnN0YW5jZS5kZWJ1ZyApIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoIGVycm9yTWVzc2FnZSApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHdhcm4oIGVycm9yTWVzc2FnZSApO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Y2hpbGRJbnN0YW5jZS5vbiggZXZlbnROYW1lLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCggYXJndW1lbnRzICk7XG5cdFx0XHRcdGFyZ3MudW5zaGlmdCggcHJveHlFdmVudE5hbWUgKTtcblx0XHRcdFx0cGFyZW50SW5zdGFuY2UuZmlyZS5hcHBseSggcGFyZW50SW5zdGFuY2UsIGFyZ3MgKTtcblx0XHRcdH0gKTtcblx0XHR9XG5cdH0oIHV0aWxzX3dhcm4gKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0NvbXBvbmVudF9pbml0aWFsaXNlX3VwZGF0ZUxpdmVRdWVyaWVzID0gZnVuY3Rpb24oIGNvbXBvbmVudCApIHtcblx0XHR2YXIgYW5jZXN0b3IsIHF1ZXJ5O1xuXHRcdGFuY2VzdG9yID0gY29tcG9uZW50LnJvb3Q7XG5cdFx0d2hpbGUgKCBhbmNlc3RvciApIHtcblx0XHRcdGlmICggcXVlcnkgPSBhbmNlc3Rvci5fbGl2ZUNvbXBvbmVudFF1ZXJpZXNbIGNvbXBvbmVudC5uYW1lIF0gKSB7XG5cdFx0XHRcdHF1ZXJ5LnB1c2goIGNvbXBvbmVudC5pbnN0YW5jZSApO1xuXHRcdFx0fVxuXHRcdFx0YW5jZXN0b3IgPSBhbmNlc3Rvci5fcGFyZW50O1xuXHRcdH1cblx0fTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0NvbXBvbmVudF9pbml0aWFsaXNlX19pbml0aWFsaXNlID0gZnVuY3Rpb24oIHR5cGVzLCB3YXJuLCBjcmVhdGVNb2RlbCwgY3JlYXRlSW5zdGFuY2UsIGNyZWF0ZUJpbmRpbmdzLCBwcm9wYWdhdGVFdmVudHMsIHVwZGF0ZUxpdmVRdWVyaWVzICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uIGluaXRpYWxpc2VDb21wb25lbnQoIGNvbXBvbmVudCwgb3B0aW9ucywgZG9jRnJhZyApIHtcblx0XHRcdHZhciBwYXJlbnRGcmFnbWVudCwgcm9vdCwgQ29tcG9uZW50LCBkYXRhLCB0b0JpbmQ7XG5cdFx0XHRwYXJlbnRGcmFnbWVudCA9IGNvbXBvbmVudC5wYXJlbnRGcmFnbWVudCA9IG9wdGlvbnMucGFyZW50RnJhZ21lbnQ7XG5cdFx0XHRyb290ID0gcGFyZW50RnJhZ21lbnQucm9vdDtcblx0XHRcdGNvbXBvbmVudC5yb290ID0gcm9vdDtcblx0XHRcdGNvbXBvbmVudC50eXBlID0gdHlwZXMuQ09NUE9ORU5UO1xuXHRcdFx0Y29tcG9uZW50Lm5hbWUgPSBvcHRpb25zLmRlc2NyaXB0b3IuZTtcblx0XHRcdGNvbXBvbmVudC5pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG5cdFx0XHRjb21wb25lbnQuYmluZGluZ3MgPSBbXTtcblx0XHRcdENvbXBvbmVudCA9IHJvb3QuY29tcG9uZW50c1sgb3B0aW9ucy5kZXNjcmlwdG9yLmUgXTtcblx0XHRcdGlmICggIUNvbXBvbmVudCApIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnQ29tcG9uZW50IFwiJyArIG9wdGlvbnMuZGVzY3JpcHRvci5lICsgJ1wiIG5vdCBmb3VuZCcgKTtcblx0XHRcdH1cblx0XHRcdHRvQmluZCA9IFtdO1xuXHRcdFx0ZGF0YSA9IGNyZWF0ZU1vZGVsKCBjb21wb25lbnQsIENvbXBvbmVudC5kYXRhIHx8IHt9LCBvcHRpb25zLmRlc2NyaXB0b3IuYSwgdG9CaW5kICk7XG5cdFx0XHRjcmVhdGVJbnN0YW5jZSggY29tcG9uZW50LCBDb21wb25lbnQsIGRhdGEsIGRvY0ZyYWcsIG9wdGlvbnMuZGVzY3JpcHRvci5mICk7XG5cdFx0XHRjcmVhdGVCaW5kaW5ncyggY29tcG9uZW50LCB0b0JpbmQgKTtcblx0XHRcdHByb3BhZ2F0ZUV2ZW50cyggY29tcG9uZW50LCBvcHRpb25zLmRlc2NyaXB0b3IudiApO1xuXHRcdFx0aWYgKCBvcHRpb25zLmRlc2NyaXB0b3IudDEgfHwgb3B0aW9ucy5kZXNjcmlwdG9yLnQyIHx8IG9wdGlvbnMuZGVzY3JpcHRvci5vICkge1xuXHRcdFx0XHR3YXJuKCAnVGhlIFwiaW50cm9cIiwgXCJvdXRyb1wiIGFuZCBcImRlY29yYXRvclwiIGRpcmVjdGl2ZXMgaGF2ZSBubyBlZmZlY3Qgb24gY29tcG9uZW50cycgKTtcblx0XHRcdH1cblx0XHRcdHVwZGF0ZUxpdmVRdWVyaWVzKCBjb21wb25lbnQgKTtcblx0XHR9O1xuXHR9KCBjb25maWdfdHlwZXMsIHV0aWxzX3dhcm4sIHJlbmRlcl9Eb21GcmFnbWVudF9Db21wb25lbnRfaW5pdGlhbGlzZV9jcmVhdGVNb2RlbF9fY3JlYXRlTW9kZWwsIHJlbmRlcl9Eb21GcmFnbWVudF9Db21wb25lbnRfaW5pdGlhbGlzZV9jcmVhdGVJbnN0YW5jZSwgcmVuZGVyX0RvbUZyYWdtZW50X0NvbXBvbmVudF9pbml0aWFsaXNlX2NyZWF0ZUJpbmRpbmdzLCByZW5kZXJfRG9tRnJhZ21lbnRfQ29tcG9uZW50X2luaXRpYWxpc2VfcHJvcGFnYXRlRXZlbnRzLCByZW5kZXJfRG9tRnJhZ21lbnRfQ29tcG9uZW50X2luaXRpYWxpc2VfdXBkYXRlTGl2ZVF1ZXJpZXMgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0NvbXBvbmVudF9fQ29tcG9uZW50ID0gZnVuY3Rpb24oIGluaXRpYWxpc2UgKSB7XG5cblx0XHR2YXIgRG9tQ29tcG9uZW50ID0gZnVuY3Rpb24oIG9wdGlvbnMsIGRvY0ZyYWcgKSB7XG5cdFx0XHRpbml0aWFsaXNlKCB0aGlzLCBvcHRpb25zLCBkb2NGcmFnICk7XG5cdFx0fTtcblx0XHREb21Db21wb25lbnQucHJvdG90eXBlID0ge1xuXHRcdFx0Zmlyc3ROb2RlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuaW5zdGFuY2UuZnJhZ21lbnQuZmlyc3ROb2RlKCk7XG5cdFx0XHR9LFxuXHRcdFx0ZmluZE5leHROb2RlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMucGFyZW50RnJhZ21lbnQuZmluZE5leHROb2RlKCB0aGlzICk7XG5cdFx0XHR9LFxuXHRcdFx0ZGV0YWNoOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuaW5zdGFuY2UuZnJhZ21lbnQuZGV0YWNoKCk7XG5cdFx0XHR9LFxuXHRcdFx0dGVhcmRvd246IGZ1bmN0aW9uKCBkZXN0cm95ICkge1xuXHRcdFx0XHR3aGlsZSAoIHRoaXMuY29tcGxleFBhcmFtZXRlcnMubGVuZ3RoICkge1xuXHRcdFx0XHRcdHRoaXMuY29tcGxleFBhcmFtZXRlcnMucG9wKCkudGVhcmRvd24oKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR3aGlsZSAoIHRoaXMuYmluZGluZ3MubGVuZ3RoICkge1xuXHRcdFx0XHRcdHRoaXMuYmluZGluZ3MucG9wKCkudGVhcmRvd24oKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZW1vdmVGcm9tTGl2ZUNvbXBvbmVudFF1ZXJpZXMoIHRoaXMgKTtcblx0XHRcdFx0dGhpcy5zaG91bGREZXN0cm95ID0gZGVzdHJveTtcblx0XHRcdFx0dGhpcy5pbnN0YW5jZS50ZWFyZG93bigpO1xuXHRcdFx0fSxcblx0XHRcdHRvU3RyaW5nOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuaW5zdGFuY2UuZnJhZ21lbnQudG9TdHJpbmcoKTtcblx0XHRcdH0sXG5cdFx0XHRmaW5kOiBmdW5jdGlvbiggc2VsZWN0b3IgKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmluc3RhbmNlLmZyYWdtZW50LmZpbmQoIHNlbGVjdG9yICk7XG5cdFx0XHR9LFxuXHRcdFx0ZmluZEFsbDogZnVuY3Rpb24oIHNlbGVjdG9yLCBxdWVyeSApIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuaW5zdGFuY2UuZnJhZ21lbnQuZmluZEFsbCggc2VsZWN0b3IsIHF1ZXJ5ICk7XG5cdFx0XHR9LFxuXHRcdFx0ZmluZENvbXBvbmVudDogZnVuY3Rpb24oIHNlbGVjdG9yICkge1xuXHRcdFx0XHRpZiAoICFzZWxlY3RvciB8fCBzZWxlY3RvciA9PT0gdGhpcy5uYW1lICkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmluc3RhbmNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggdGhpcy5pbnN0YW5jZS5mcmFnbWVudCApIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5pbnN0YW5jZS5mcmFnbWVudC5maW5kQ29tcG9uZW50KCBzZWxlY3RvciApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fSxcblx0XHRcdGZpbmRBbGxDb21wb25lbnRzOiBmdW5jdGlvbiggc2VsZWN0b3IsIHF1ZXJ5ICkge1xuXHRcdFx0XHRxdWVyeS5fdGVzdCggdGhpcywgdHJ1ZSApO1xuXHRcdFx0XHRpZiAoIHRoaXMuaW5zdGFuY2UuZnJhZ21lbnQgKSB7XG5cdFx0XHRcdFx0dGhpcy5pbnN0YW5jZS5mcmFnbWVudC5maW5kQWxsQ29tcG9uZW50cyggc2VsZWN0b3IsIHF1ZXJ5ICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBEb21Db21wb25lbnQ7XG5cblx0XHRmdW5jdGlvbiByZW1vdmVGcm9tTGl2ZUNvbXBvbmVudFF1ZXJpZXMoIGNvbXBvbmVudCApIHtcblx0XHRcdHZhciBpbnN0YW5jZSwgcXVlcnk7XG5cdFx0XHRpbnN0YW5jZSA9IGNvbXBvbmVudC5yb290O1xuXHRcdFx0ZG8ge1xuXHRcdFx0XHRpZiAoIHF1ZXJ5ID0gaW5zdGFuY2UuX2xpdmVDb21wb25lbnRRdWVyaWVzWyBjb21wb25lbnQubmFtZSBdICkge1xuXHRcdFx0XHRcdHF1ZXJ5Ll9yZW1vdmUoIGNvbXBvbmVudCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9IHdoaWxlICggaW5zdGFuY2UgPSBpbnN0YW5jZS5fcGFyZW50ICk7XG5cdFx0fVxuXHR9KCByZW5kZXJfRG9tRnJhZ21lbnRfQ29tcG9uZW50X2luaXRpYWxpc2VfX2luaXRpYWxpc2UgKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X0NvbW1lbnQgPSBmdW5jdGlvbiggdHlwZXMsIGRldGFjaCApIHtcblxuXHRcdHZhciBEb21Db21tZW50ID0gZnVuY3Rpb24oIG9wdGlvbnMsIGRvY0ZyYWcgKSB7XG5cdFx0XHR0aGlzLnR5cGUgPSB0eXBlcy5DT01NRU5UO1xuXHRcdFx0dGhpcy5kZXNjcmlwdG9yID0gb3B0aW9ucy5kZXNjcmlwdG9yO1xuXHRcdFx0aWYgKCBkb2NGcmFnICkge1xuXHRcdFx0XHR0aGlzLm5vZGUgPSBkb2N1bWVudC5jcmVhdGVDb21tZW50KCBvcHRpb25zLmRlc2NyaXB0b3IuZiApO1xuXHRcdFx0XHRkb2NGcmFnLmFwcGVuZENoaWxkKCB0aGlzLm5vZGUgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdERvbUNvbW1lbnQucHJvdG90eXBlID0ge1xuXHRcdFx0ZGV0YWNoOiBkZXRhY2gsXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oIGRlc3Ryb3kgKSB7XG5cdFx0XHRcdGlmICggZGVzdHJveSApIHtcblx0XHRcdFx0XHR0aGlzLmRldGFjaCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0Zmlyc3ROb2RlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMubm9kZTtcblx0XHRcdH0sXG5cdFx0XHR0b1N0cmluZzogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiAnPCEtLScgKyB0aGlzLmRlc2NyaXB0b3IuZiArICctLT4nO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV0dXJuIERvbUNvbW1lbnQ7XG5cdH0oIGNvbmZpZ190eXBlcywgcmVuZGVyX0RvbUZyYWdtZW50X3NoYXJlZF9kZXRhY2ggKTtcblxuXHR2YXIgcmVuZGVyX0RvbUZyYWdtZW50X19Eb21GcmFnbWVudCA9IGZ1bmN0aW9uKCB0eXBlcywgbWF0Y2hlcywgaW5pdEZyYWdtZW50LCBpbnNlcnRIdG1sLCBUZXh0LCBJbnRlcnBvbGF0b3IsIFNlY3Rpb24sIFRyaXBsZSwgRWxlbWVudCwgUGFydGlhbCwgQ29tcG9uZW50LCBDb21tZW50LCBjaXJjdWxhciApIHtcblxuXHRcdHZhciBEb21GcmFnbWVudCA9IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0aWYgKCBvcHRpb25zLnBOb2RlICkge1xuXHRcdFx0XHR0aGlzLmRvY0ZyYWcgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHR5cGVvZiBvcHRpb25zLmRlc2NyaXB0b3IgPT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHR0aGlzLmh0bWwgPSBvcHRpb25zLmRlc2NyaXB0b3I7XG5cdFx0XHRcdGlmICggdGhpcy5kb2NGcmFnICkge1xuXHRcdFx0XHRcdHRoaXMubm9kZXMgPSBpbnNlcnRIdG1sKCB0aGlzLmh0bWwsIG9wdGlvbnMucE5vZGUudGFnTmFtZSwgdGhpcy5kb2NGcmFnICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGluaXRGcmFnbWVudCggdGhpcywgb3B0aW9ucyApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0RG9tRnJhZ21lbnQucHJvdG90eXBlID0ge1xuXHRcdFx0ZGV0YWNoOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIGxlbiwgaTtcblx0XHRcdFx0aWYgKCB0aGlzLmRvY0ZyYWcgKSB7XG5cdFx0XHRcdFx0aWYgKCB0aGlzLm5vZGVzICkge1xuXHRcdFx0XHRcdFx0bGVuID0gdGhpcy5ub2Rlcy5sZW5ndGg7XG5cdFx0XHRcdFx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLmRvY0ZyYWcuYXBwZW5kQ2hpbGQoIHRoaXMubm9kZXNbIGkgXSApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZWxzZSBpZiAoIHRoaXMuaXRlbXMgKSB7XG5cdFx0XHRcdFx0XHRsZW4gPSB0aGlzLml0ZW1zLmxlbmd0aDtcblx0XHRcdFx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuZG9jRnJhZy5hcHBlbmRDaGlsZCggdGhpcy5pdGVtc1sgaSBdLmRldGFjaCgpICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB0aGlzLmRvY0ZyYWc7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRjcmVhdGVJdGVtOiBmdW5jdGlvbiggb3B0aW9ucyApIHtcblx0XHRcdFx0aWYgKCB0eXBlb2Ygb3B0aW9ucy5kZXNjcmlwdG9yID09PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IFRleHQoIG9wdGlvbnMsIHRoaXMuZG9jRnJhZyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHN3aXRjaCAoIG9wdGlvbnMuZGVzY3JpcHRvci50ICkge1xuXHRcdFx0XHRcdGNhc2UgdHlwZXMuSU5URVJQT0xBVE9SOlxuXHRcdFx0XHRcdFx0cmV0dXJuIG5ldyBJbnRlcnBvbGF0b3IoIG9wdGlvbnMsIHRoaXMuZG9jRnJhZyApO1xuXHRcdFx0XHRcdGNhc2UgdHlwZXMuU0VDVElPTjpcblx0XHRcdFx0XHRcdHJldHVybiBuZXcgU2VjdGlvbiggb3B0aW9ucywgdGhpcy5kb2NGcmFnICk7XG5cdFx0XHRcdFx0Y2FzZSB0eXBlcy5UUklQTEU6XG5cdFx0XHRcdFx0XHRyZXR1cm4gbmV3IFRyaXBsZSggb3B0aW9ucywgdGhpcy5kb2NGcmFnICk7XG5cdFx0XHRcdFx0Y2FzZSB0eXBlcy5FTEVNRU5UOlxuXHRcdFx0XHRcdFx0aWYgKCB0aGlzLnJvb3QuY29tcG9uZW50c1sgb3B0aW9ucy5kZXNjcmlwdG9yLmUgXSApIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIG5ldyBDb21wb25lbnQoIG9wdGlvbnMsIHRoaXMuZG9jRnJhZyApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmV0dXJuIG5ldyBFbGVtZW50KCBvcHRpb25zLCB0aGlzLmRvY0ZyYWcgKTtcblx0XHRcdFx0XHRjYXNlIHR5cGVzLlBBUlRJQUw6XG5cdFx0XHRcdFx0XHRyZXR1cm4gbmV3IFBhcnRpYWwoIG9wdGlvbnMsIHRoaXMuZG9jRnJhZyApO1xuXHRcdFx0XHRcdGNhc2UgdHlwZXMuQ09NTUVOVDpcblx0XHRcdFx0XHRcdHJldHVybiBuZXcgQ29tbWVudCggb3B0aW9ucywgdGhpcy5kb2NGcmFnICk7XG5cdFx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ1NvbWV0aGluZyB2ZXJ5IHN0cmFuZ2UgaGFwcGVuZWQuIFBsZWFzZSBmaWxlIGFuIGlzc3VlIGF0IGh0dHBzOi8vZ2l0aHViLmNvbS9SYWN0aXZlSlMvUmFjdGl2ZS9pc3N1ZXMuIFRoYW5rcyEnICk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHR0ZWFyZG93bjogZnVuY3Rpb24oIGRlc3Ryb3kgKSB7XG5cdFx0XHRcdHZhciBub2RlO1xuXHRcdFx0XHRpZiAoIHRoaXMubm9kZXMgJiYgZGVzdHJveSApIHtcblx0XHRcdFx0XHR3aGlsZSAoIG5vZGUgPSB0aGlzLm5vZGVzLnBvcCgpICkge1xuXHRcdFx0XHRcdFx0bm9kZS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKCBub2RlICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2UgaWYgKCB0aGlzLml0ZW1zICkge1xuXHRcdFx0XHRcdHdoaWxlICggdGhpcy5pdGVtcy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0XHR0aGlzLml0ZW1zLnBvcCgpLnRlYXJkb3duKCBkZXN0cm95ICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMubm9kZXMgPSB0aGlzLml0ZW1zID0gdGhpcy5kb2NGcmFnID0gbnVsbDtcblx0XHRcdH0sXG5cdFx0XHRmaXJzdE5vZGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZiAoIHRoaXMuaXRlbXMgJiYgdGhpcy5pdGVtc1sgMCBdICkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLml0ZW1zWyAwIF0uZmlyc3ROb2RlKCk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoIHRoaXMubm9kZXMgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMubm9kZXNbIDAgXSB8fCBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fSxcblx0XHRcdGZpbmROZXh0Tm9kZTogZnVuY3Rpb24oIGl0ZW0gKSB7XG5cdFx0XHRcdHZhciBpbmRleCA9IGl0ZW0uaW5kZXg7XG5cdFx0XHRcdGlmICggdGhpcy5pdGVtc1sgaW5kZXggKyAxIF0gKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuaXRlbXNbIGluZGV4ICsgMSBdLmZpcnN0Tm9kZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggdGhpcy5vd25lciA9PT0gdGhpcy5yb290ICkge1xuXHRcdFx0XHRcdGlmICggIXRoaXMub3duZXIuY29tcG9uZW50ICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB0aGlzLm93bmVyLmNvbXBvbmVudC5maW5kTmV4dE5vZGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdGhpcy5vd25lci5maW5kTmV4dE5vZGUoIHRoaXMgKTtcblx0XHRcdH0sXG5cdFx0XHR0b1N0cmluZzogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBodG1sLCBpLCBsZW4sIGl0ZW07XG5cdFx0XHRcdGlmICggdGhpcy5odG1sICkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmh0bWw7XG5cdFx0XHRcdH1cblx0XHRcdFx0aHRtbCA9ICcnO1xuXHRcdFx0XHRpZiAoICF0aGlzLml0ZW1zICkge1xuXHRcdFx0XHRcdHJldHVybiBodG1sO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGxlbiA9IHRoaXMuaXRlbXMubGVuZ3RoO1xuXHRcdFx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRcdGl0ZW0gPSB0aGlzLml0ZW1zWyBpIF07XG5cdFx0XHRcdFx0aHRtbCArPSBpdGVtLnRvU3RyaW5nKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGh0bWw7XG5cdFx0XHR9LFxuXHRcdFx0ZmluZDogZnVuY3Rpb24oIHNlbGVjdG9yICkge1xuXHRcdFx0XHR2YXIgaSwgbGVuLCBpdGVtLCBub2RlLCBxdWVyeVJlc3VsdDtcblx0XHRcdFx0aWYgKCB0aGlzLm5vZGVzICkge1xuXHRcdFx0XHRcdGxlbiA9IHRoaXMubm9kZXMubGVuZ3RoO1xuXHRcdFx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0XHRub2RlID0gdGhpcy5ub2Rlc1sgaSBdO1xuXHRcdFx0XHRcdFx0aWYgKCBub2RlLm5vZGVUeXBlICE9PSAxICkge1xuXHRcdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmICggbWF0Y2hlcyggbm9kZSwgc2VsZWN0b3IgKSApIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIG5vZGU7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoIHF1ZXJ5UmVzdWx0ID0gbm9kZS5xdWVyeVNlbGVjdG9yKCBzZWxlY3RvciApICkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gcXVlcnlSZXN1bHQ7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggdGhpcy5pdGVtcyApIHtcblx0XHRcdFx0XHRsZW4gPSB0aGlzLml0ZW1zLmxlbmd0aDtcblx0XHRcdFx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRcdFx0aXRlbSA9IHRoaXMuaXRlbXNbIGkgXTtcblx0XHRcdFx0XHRcdGlmICggaXRlbS5maW5kICYmICggcXVlcnlSZXN1bHQgPSBpdGVtLmZpbmQoIHNlbGVjdG9yICkgKSApIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHF1ZXJ5UmVzdWx0O1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGZpbmRBbGw6IGZ1bmN0aW9uKCBzZWxlY3RvciwgcXVlcnkgKSB7XG5cdFx0XHRcdHZhciBpLCBsZW4sIGl0ZW0sIG5vZGUsIHF1ZXJ5QWxsUmVzdWx0LCBudW1Ob2Rlcywgajtcblx0XHRcdFx0aWYgKCB0aGlzLm5vZGVzICkge1xuXHRcdFx0XHRcdGxlbiA9IHRoaXMubm9kZXMubGVuZ3RoO1xuXHRcdFx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuOyBpICs9IDEgKSB7XG5cdFx0XHRcdFx0XHRub2RlID0gdGhpcy5ub2Rlc1sgaSBdO1xuXHRcdFx0XHRcdFx0aWYgKCBub2RlLm5vZGVUeXBlICE9PSAxICkge1xuXHRcdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmICggbWF0Y2hlcyggbm9kZSwgc2VsZWN0b3IgKSApIHtcblx0XHRcdFx0XHRcdFx0cXVlcnkucHVzaCggbm9kZSApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKCBxdWVyeUFsbFJlc3VsdCA9IG5vZGUucXVlcnlTZWxlY3RvckFsbCggc2VsZWN0b3IgKSApIHtcblx0XHRcdFx0XHRcdFx0bnVtTm9kZXMgPSBxdWVyeUFsbFJlc3VsdC5sZW5ndGg7XG5cdFx0XHRcdFx0XHRcdGZvciAoIGogPSAwOyBqIDwgbnVtTm9kZXM7IGogKz0gMSApIHtcblx0XHRcdFx0XHRcdFx0XHRxdWVyeS5wdXNoKCBxdWVyeUFsbFJlc3VsdFsgaiBdICk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSBpZiAoIHRoaXMuaXRlbXMgKSB7XG5cdFx0XHRcdFx0bGVuID0gdGhpcy5pdGVtcy5sZW5ndGg7XG5cdFx0XHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0XHRcdGl0ZW0gPSB0aGlzLml0ZW1zWyBpIF07XG5cdFx0XHRcdFx0XHRpZiAoIGl0ZW0uZmluZEFsbCApIHtcblx0XHRcdFx0XHRcdFx0aXRlbS5maW5kQWxsKCBzZWxlY3RvciwgcXVlcnkgKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHF1ZXJ5O1xuXHRcdFx0fSxcblx0XHRcdGZpbmRDb21wb25lbnQ6IGZ1bmN0aW9uKCBzZWxlY3RvciApIHtcblx0XHRcdFx0dmFyIGxlbiwgaSwgaXRlbSwgcXVlcnlSZXN1bHQ7XG5cdFx0XHRcdGlmICggdGhpcy5pdGVtcyApIHtcblx0XHRcdFx0XHRsZW4gPSB0aGlzLml0ZW1zLmxlbmd0aDtcblx0XHRcdFx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbjsgaSArPSAxICkge1xuXHRcdFx0XHRcdFx0aXRlbSA9IHRoaXMuaXRlbXNbIGkgXTtcblx0XHRcdFx0XHRcdGlmICggaXRlbS5maW5kQ29tcG9uZW50ICYmICggcXVlcnlSZXN1bHQgPSBpdGVtLmZpbmRDb21wb25lbnQoIHNlbGVjdG9yICkgKSApIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHF1ZXJ5UmVzdWx0O1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGZpbmRBbGxDb21wb25lbnRzOiBmdW5jdGlvbiggc2VsZWN0b3IsIHF1ZXJ5ICkge1xuXHRcdFx0XHR2YXIgaSwgbGVuLCBpdGVtO1xuXHRcdFx0XHRpZiAoIHRoaXMuaXRlbXMgKSB7XG5cdFx0XHRcdFx0bGVuID0gdGhpcy5pdGVtcy5sZW5ndGg7XG5cdFx0XHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW47IGkgKz0gMSApIHtcblx0XHRcdFx0XHRcdGl0ZW0gPSB0aGlzLml0ZW1zWyBpIF07XG5cdFx0XHRcdFx0XHRpZiAoIGl0ZW0uZmluZEFsbENvbXBvbmVudHMgKSB7XG5cdFx0XHRcdFx0XHRcdGl0ZW0uZmluZEFsbENvbXBvbmVudHMoIHNlbGVjdG9yLCBxdWVyeSApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcXVlcnk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRjaXJjdWxhci5Eb21GcmFnbWVudCA9IERvbUZyYWdtZW50O1xuXHRcdHJldHVybiBEb21GcmFnbWVudDtcblx0fSggY29uZmlnX3R5cGVzLCB1dGlsc19tYXRjaGVzLCByZW5kZXJfc2hhcmVkX2luaXRGcmFnbWVudCwgcmVuZGVyX0RvbUZyYWdtZW50X3NoYXJlZF9pbnNlcnRIdG1sLCByZW5kZXJfRG9tRnJhZ21lbnRfVGV4dCwgcmVuZGVyX0RvbUZyYWdtZW50X0ludGVycG9sYXRvciwgcmVuZGVyX0RvbUZyYWdtZW50X1NlY3Rpb25fX1NlY3Rpb24sIHJlbmRlcl9Eb21GcmFnbWVudF9UcmlwbGUsIHJlbmRlcl9Eb21GcmFnbWVudF9FbGVtZW50X19FbGVtZW50LCByZW5kZXJfRG9tRnJhZ21lbnRfUGFydGlhbF9fUGFydGlhbCwgcmVuZGVyX0RvbUZyYWdtZW50X0NvbXBvbmVudF9fQ29tcG9uZW50LCByZW5kZXJfRG9tRnJhZ21lbnRfQ29tbWVudCwgY2lyY3VsYXIgKTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfcmVuZGVyID0gZnVuY3Rpb24oIHJ1bmxvb3AsIGNzcywgRG9tRnJhZ21lbnQgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24gUmFjdGl2ZV9wcm90b3R5cGVfcmVuZGVyKCB0YXJnZXQsIGNhbGxiYWNrICkge1xuXHRcdFx0dGhpcy5fcmVuZGVyaW5nID0gdHJ1ZTtcblx0XHRcdHJ1bmxvb3Auc3RhcnQoIHRoaXMsIGNhbGxiYWNrICk7XG5cdFx0XHRpZiAoICF0aGlzLl9pbml0aW5nICkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdZb3UgY2Fubm90IGNhbGwgcmFjdGl2ZS5yZW5kZXIoKSBkaXJlY3RseSEnICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRoaXMuY29uc3RydWN0b3IuY3NzICkge1xuXHRcdFx0XHRjc3MuYWRkKCB0aGlzLmNvbnN0cnVjdG9yICk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmZyYWdtZW50ID0gbmV3IERvbUZyYWdtZW50KCB7XG5cdFx0XHRcdGRlc2NyaXB0b3I6IHRoaXMudGVtcGxhdGUsXG5cdFx0XHRcdHJvb3Q6IHRoaXMsXG5cdFx0XHRcdG93bmVyOiB0aGlzLFxuXHRcdFx0XHRwTm9kZTogdGFyZ2V0XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoIHRhcmdldCApIHtcblx0XHRcdFx0dGFyZ2V0LmFwcGVuZENoaWxkKCB0aGlzLmZyYWdtZW50LmRvY0ZyYWcgKTtcblx0XHRcdH1cblx0XHRcdGlmICggIXRoaXMuX3BhcmVudCB8fCAhdGhpcy5fcGFyZW50Ll9yZW5kZXJpbmcgKSB7XG5cdFx0XHRcdGluaXRDaGlsZHJlbiggdGhpcyApO1xuXHRcdFx0fVxuXHRcdFx0ZGVsZXRlIHRoaXMuX3JlbmRlcmluZztcblx0XHRcdHJ1bmxvb3AuZW5kKCk7XG5cdFx0fTtcblxuXHRcdGZ1bmN0aW9uIGluaXRDaGlsZHJlbiggaW5zdGFuY2UgKSB7XG5cdFx0XHR2YXIgY2hpbGQ7XG5cdFx0XHR3aGlsZSAoIGNoaWxkID0gaW5zdGFuY2UuX2NoaWxkSW5pdFF1ZXVlLnBvcCgpICkge1xuXHRcdFx0XHRpZiAoIGNoaWxkLmluc3RhbmNlLmluaXQgKSB7XG5cdFx0XHRcdFx0Y2hpbGQuaW5zdGFuY2UuaW5pdCggY2hpbGQub3B0aW9ucyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGluaXRDaGlsZHJlbiggY2hpbGQuaW5zdGFuY2UgKTtcblx0XHRcdH1cblx0XHR9XG5cdH0oIGdsb2JhbF9ydW5sb29wLCBnbG9iYWxfY3NzLCByZW5kZXJfRG9tRnJhZ21lbnRfX0RvbUZyYWdtZW50ICk7XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX3JlbmRlckhUTUwgPSBmdW5jdGlvbiggd2FybiApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbigpIHtcblx0XHRcdHdhcm4oICdyZW5kZXJIVE1MKCkgaGFzIGJlZW4gZGVwcmVjYXRlZCBhbmQgd2lsbCBiZSByZW1vdmVkIGluIGEgZnV0dXJlIHZlcnNpb24uIFBsZWFzZSB1c2UgdG9IVE1MKCkgaW5zdGVhZCcgKTtcblx0XHRcdHJldHVybiB0aGlzLnRvSFRNTCgpO1xuXHRcdH07XG5cdH0oIHV0aWxzX3dhcm4gKTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfcmVzZXQgPSBmdW5jdGlvbiggUHJvbWlzZSwgcnVubG9vcCwgY2xlYXJDYWNoZSwgbm90aWZ5RGVwZW5kYW50cyApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggZGF0YSwgY2FsbGJhY2sgKSB7XG5cdFx0XHR2YXIgcHJvbWlzZSwgZnVsZmlsUHJvbWlzZSwgd3JhcHBlcjtcblx0XHRcdGlmICggdHlwZW9mIGRhdGEgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRcdGNhbGxiYWNrID0gZGF0YTtcblx0XHRcdFx0ZGF0YSA9IHt9O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZGF0YSA9IGRhdGEgfHwge307XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHR5cGVvZiBkYXRhICE9PSAnb2JqZWN0JyApIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnVGhlIHJlc2V0IG1ldGhvZCB0YWtlcyBlaXRoZXIgbm8gYXJndW1lbnRzLCBvciBhbiBvYmplY3QgY29udGFpbmluZyBuZXcgZGF0YScgKTtcblx0XHRcdH1cblx0XHRcdHByb21pc2UgPSBuZXcgUHJvbWlzZSggZnVuY3Rpb24oIGZ1bGZpbCApIHtcblx0XHRcdFx0ZnVsZmlsUHJvbWlzZSA9IGZ1bGZpbDtcblx0XHRcdH0gKTtcblx0XHRcdGlmICggY2FsbGJhY2sgKSB7XG5cdFx0XHRcdHByb21pc2UudGhlbiggY2FsbGJhY2sgKTtcblx0XHRcdH1cblx0XHRcdHJ1bmxvb3Auc3RhcnQoIHRoaXMsIGZ1bGZpbFByb21pc2UgKTtcblx0XHRcdGlmICggKCB3cmFwcGVyID0gdGhpcy5fd3JhcHBlZFsgJycgXSApICYmIHdyYXBwZXIucmVzZXQgKSB7XG5cdFx0XHRcdGlmICggd3JhcHBlci5yZXNldCggZGF0YSApID09PSBmYWxzZSApIHtcblx0XHRcdFx0XHR0aGlzLmRhdGEgPSBkYXRhO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmRhdGEgPSBkYXRhO1xuXHRcdFx0fVxuXHRcdFx0Y2xlYXJDYWNoZSggdGhpcywgJycgKTtcblx0XHRcdG5vdGlmeURlcGVuZGFudHMoIHRoaXMsICcnICk7XG5cdFx0XHRydW5sb29wLmVuZCgpO1xuXHRcdFx0dGhpcy5maXJlKCAncmVzZXQnLCBkYXRhICk7XG5cdFx0XHRyZXR1cm4gcHJvbWlzZTtcblx0XHR9O1xuXHR9KCB1dGlsc19Qcm9taXNlLCBnbG9iYWxfcnVubG9vcCwgc2hhcmVkX2NsZWFyQ2FjaGUsIHNoYXJlZF9ub3RpZnlEZXBlbmRhbnRzICk7XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX3NldCA9IGZ1bmN0aW9uKCBydW5sb29wLCBpc09iamVjdCwgbm9ybWFsaXNlS2V5cGF0aCwgUHJvbWlzZSwgc2V0ICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uIFJhY3RpdmVfcHJvdG90eXBlX3NldCgga2V5cGF0aCwgdmFsdWUsIGNhbGxiYWNrICkge1xuXHRcdFx0dmFyIG1hcCwgcHJvbWlzZSwgZnVsZmlsUHJvbWlzZTtcblx0XHRcdHByb21pc2UgPSBuZXcgUHJvbWlzZSggZnVuY3Rpb24oIGZ1bGZpbCApIHtcblx0XHRcdFx0ZnVsZmlsUHJvbWlzZSA9IGZ1bGZpbDtcblx0XHRcdH0gKTtcblx0XHRcdHJ1bmxvb3Auc3RhcnQoIHRoaXMsIGZ1bGZpbFByb21pc2UgKTtcblx0XHRcdGlmICggaXNPYmplY3QoIGtleXBhdGggKSApIHtcblx0XHRcdFx0bWFwID0ga2V5cGF0aDtcblx0XHRcdFx0Y2FsbGJhY2sgPSB2YWx1ZTtcblx0XHRcdFx0Zm9yICgga2V5cGF0aCBpbiBtYXAgKSB7XG5cdFx0XHRcdFx0aWYgKCBtYXAuaGFzT3duUHJvcGVydHkoIGtleXBhdGggKSApIHtcblx0XHRcdFx0XHRcdHZhbHVlID0gbWFwWyBrZXlwYXRoIF07XG5cdFx0XHRcdFx0XHRrZXlwYXRoID0gbm9ybWFsaXNlS2V5cGF0aCgga2V5cGF0aCApO1xuXHRcdFx0XHRcdFx0c2V0KCB0aGlzLCBrZXlwYXRoLCB2YWx1ZSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0a2V5cGF0aCA9IG5vcm1hbGlzZUtleXBhdGgoIGtleXBhdGggKTtcblx0XHRcdFx0c2V0KCB0aGlzLCBrZXlwYXRoLCB2YWx1ZSApO1xuXHRcdFx0fVxuXHRcdFx0cnVubG9vcC5lbmQoKTtcblx0XHRcdGlmICggY2FsbGJhY2sgKSB7XG5cdFx0XHRcdHByb21pc2UudGhlbiggY2FsbGJhY2suYmluZCggdGhpcyApICk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcHJvbWlzZTtcblx0XHR9O1xuXHR9KCBnbG9iYWxfcnVubG9vcCwgdXRpbHNfaXNPYmplY3QsIHV0aWxzX25vcm1hbGlzZUtleXBhdGgsIHV0aWxzX1Byb21pc2UsIHNoYXJlZF9zZXQgKTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfc3VidHJhY3QgPSBmdW5jdGlvbiggYWRkICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBrZXlwYXRoLCBkICkge1xuXHRcdFx0cmV0dXJuIGFkZCggdGhpcywga2V5cGF0aCwgZCA9PT0gdW5kZWZpbmVkID8gLTEgOiAtZCApO1xuXHRcdH07XG5cdH0oIFJhY3RpdmVfcHJvdG90eXBlX3NoYXJlZF9hZGQgKTtcblxuXHQvLyBUZWFyZG93bi4gVGhpcyBnb2VzIHRocm91Z2ggdGhlIHJvb3QgZnJhZ21lbnQgYW5kIGFsbCBpdHMgY2hpbGRyZW4sIHJlbW92aW5nIG9ic2VydmVyc1xuXHQvLyBhbmQgZ2VuZXJhbGx5IGNsZWFuaW5nIHVwIGFmdGVyIGl0c2VsZlxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfdGVhcmRvd24gPSBmdW5jdGlvbiggdHlwZXMsIGNzcywgcnVubG9vcCwgUHJvbWlzZSwgY2xlYXJDYWNoZSApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XG5cdFx0XHR2YXIga2V5cGF0aCwgcHJvbWlzZSwgZnVsZmlsUHJvbWlzZSwgc2hvdWxkRGVzdHJveSwgb3JpZ2luYWxDYWxsYmFjaywgZnJhZ21lbnQsIG5lYXJlc3REZXRhY2hpbmdFbGVtZW50LCB1bnJlc29sdmVkSW1wbGljaXREZXBlbmRlbmN5O1xuXHRcdFx0dGhpcy5maXJlKCAndGVhcmRvd24nICk7XG5cdFx0XHRzaG91bGREZXN0cm95ID0gIXRoaXMuY29tcG9uZW50IHx8IHRoaXMuY29tcG9uZW50LnNob3VsZERlc3Ryb3k7XG5cdFx0XHRpZiAoIHRoaXMuY29uc3RydWN0b3IuY3NzICkge1xuXHRcdFx0XHRpZiAoIHNob3VsZERlc3Ryb3kgKSB7XG5cdFx0XHRcdFx0b3JpZ2luYWxDYWxsYmFjayA9IGNhbGxiYWNrO1xuXHRcdFx0XHRcdGNhbGxiYWNrID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRpZiAoIG9yaWdpbmFsQ2FsbGJhY2sgKSB7XG5cdFx0XHRcdFx0XHRcdG9yaWdpbmFsQ2FsbGJhY2suY2FsbCggdGhpcyApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y3NzLnJlbW92ZSggdGhpcy5jb25zdHJ1Y3RvciApO1xuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZnJhZ21lbnQgPSB0aGlzLmNvbXBvbmVudC5wYXJlbnRGcmFnbWVudDtcblx0XHRcdFx0XHRkbyB7XG5cdFx0XHRcdFx0XHRpZiAoIGZyYWdtZW50Lm93bmVyLnR5cGUgIT09IHR5cGVzLkVMRU1FTlQgKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKCBmcmFnbWVudC5vd25lci53aWxsRGV0YWNoICkge1xuXHRcdFx0XHRcdFx0XHRuZWFyZXN0RGV0YWNoaW5nRWxlbWVudCA9IGZyYWdtZW50Lm93bmVyO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gd2hpbGUgKCAhbmVhcmVzdERldGFjaGluZ0VsZW1lbnQgJiYgKCBmcmFnbWVudCA9IGZyYWdtZW50LnBhcmVudCApICk7XG5cdFx0XHRcdFx0aWYgKCAhbmVhcmVzdERldGFjaGluZ0VsZW1lbnQgKSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdBIGNvbXBvbmVudCBpcyBiZWluZyB0b3JuIGRvd24gYnV0IGRvZXNuXFwndCBoYXZlIGEgbmVhcmVzdCBkZXRhY2hpbmcgZWxlbWVudC4uLiB0aGlzIHNob3VsZG5cXCd0IGhhcHBlbiEnICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdG5lYXJlc3REZXRhY2hpbmdFbGVtZW50LmNzc0RldGFjaFF1ZXVlLnB1c2goIHRoaXMuY29uc3RydWN0b3IgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cHJvbWlzZSA9IG5ldyBQcm9taXNlKCBmdW5jdGlvbiggZnVsZmlsICkge1xuXHRcdFx0XHRmdWxmaWxQcm9taXNlID0gZnVsZmlsO1xuXHRcdFx0fSApO1xuXHRcdFx0cnVubG9vcC5zdGFydCggdGhpcywgZnVsZmlsUHJvbWlzZSApO1xuXHRcdFx0dGhpcy5mcmFnbWVudC50ZWFyZG93biggc2hvdWxkRGVzdHJveSApO1xuXHRcdFx0d2hpbGUgKCB0aGlzLl9hbmltYXRpb25zWyAwIF0gKSB7XG5cdFx0XHRcdHRoaXMuX2FuaW1hdGlvbnNbIDAgXS5zdG9wKCk7XG5cdFx0XHR9XG5cdFx0XHRmb3IgKCBrZXlwYXRoIGluIHRoaXMuX2NhY2hlICkge1xuXHRcdFx0XHRjbGVhckNhY2hlKCB0aGlzLCBrZXlwYXRoICk7XG5cdFx0XHR9XG5cdFx0XHR3aGlsZSAoIHVucmVzb2x2ZWRJbXBsaWNpdERlcGVuZGVuY3kgPSB0aGlzLl91bnJlc29sdmVkSW1wbGljaXREZXBlbmRlbmNpZXMucG9wKCkgKSB7XG5cdFx0XHRcdHVucmVzb2x2ZWRJbXBsaWNpdERlcGVuZGVuY3kudGVhcmRvd24oKTtcblx0XHRcdH1cblx0XHRcdHJ1bmxvb3AuZW5kKCk7XG5cdFx0XHRpZiAoIGNhbGxiYWNrICkge1xuXHRcdFx0XHRwcm9taXNlLnRoZW4oIGNhbGxiYWNrLmJpbmQoIHRoaXMgKSApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHByb21pc2U7XG5cdFx0fTtcblx0fSggY29uZmlnX3R5cGVzLCBnbG9iYWxfY3NzLCBnbG9iYWxfcnVubG9vcCwgdXRpbHNfUHJvbWlzZSwgc2hhcmVkX2NsZWFyQ2FjaGUgKTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfdG9IVE1MID0gZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuIHRoaXMuZnJhZ21lbnQudG9TdHJpbmcoKTtcblx0fTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfdG9nZ2xlID0gZnVuY3Rpb24oIGtleXBhdGgsIGNhbGxiYWNrICkge1xuXHRcdHZhciB2YWx1ZTtcblx0XHRpZiAoIHR5cGVvZiBrZXlwYXRoICE9PSAnc3RyaW5nJyApIHtcblx0XHRcdGlmICggdGhpcy5kZWJ1ZyApIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnQmFkIGFyZ3VtZW50cycgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dmFsdWUgPSB0aGlzLmdldCgga2V5cGF0aCApO1xuXHRcdHJldHVybiB0aGlzLnNldCgga2V5cGF0aCwgIXZhbHVlLCBjYWxsYmFjayApO1xuXHR9O1xuXG5cdHZhciBSYWN0aXZlX3Byb3RvdHlwZV91cGRhdGUgPSBmdW5jdGlvbiggcnVubG9vcCwgUHJvbWlzZSwgY2xlYXJDYWNoZSwgbm90aWZ5RGVwZW5kYW50cyApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbigga2V5cGF0aCwgY2FsbGJhY2sgKSB7XG5cdFx0XHR2YXIgcHJvbWlzZSwgZnVsZmlsUHJvbWlzZTtcblx0XHRcdGlmICggdHlwZW9mIGtleXBhdGggPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRcdGNhbGxiYWNrID0ga2V5cGF0aDtcblx0XHRcdFx0a2V5cGF0aCA9ICcnO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0a2V5cGF0aCA9IGtleXBhdGggfHwgJyc7XG5cdFx0XHR9XG5cdFx0XHRwcm9taXNlID0gbmV3IFByb21pc2UoIGZ1bmN0aW9uKCBmdWxmaWwgKSB7XG5cdFx0XHRcdGZ1bGZpbFByb21pc2UgPSBmdWxmaWw7XG5cdFx0XHR9ICk7XG5cdFx0XHRydW5sb29wLnN0YXJ0KCB0aGlzLCBmdWxmaWxQcm9taXNlICk7XG5cdFx0XHRjbGVhckNhY2hlKCB0aGlzLCBrZXlwYXRoICk7XG5cdFx0XHRub3RpZnlEZXBlbmRhbnRzKCB0aGlzLCBrZXlwYXRoICk7XG5cdFx0XHRydW5sb29wLmVuZCgpO1xuXHRcdFx0dGhpcy5maXJlKCAndXBkYXRlJywga2V5cGF0aCApO1xuXHRcdFx0aWYgKCBjYWxsYmFjayApIHtcblx0XHRcdFx0cHJvbWlzZS50aGVuKCBjYWxsYmFjay5iaW5kKCB0aGlzICkgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBwcm9taXNlO1xuXHRcdH07XG5cdH0oIGdsb2JhbF9ydW5sb29wLCB1dGlsc19Qcm9taXNlLCBzaGFyZWRfY2xlYXJDYWNoZSwgc2hhcmVkX25vdGlmeURlcGVuZGFudHMgKTtcblxuXHR2YXIgUmFjdGl2ZV9wcm90b3R5cGVfdXBkYXRlTW9kZWwgPSBmdW5jdGlvbiggZ2V0VmFsdWVGcm9tQ2hlY2tib3hlcywgYXJyYXlDb250ZW50c01hdGNoLCBpc0VxdWFsICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uIFJhY3RpdmVfcHJvdG90eXBlX3VwZGF0ZU1vZGVsKCBrZXlwYXRoLCBjYXNjYWRlICkge1xuXHRcdFx0dmFyIHZhbHVlcywgZGVmZXJyZWRDaGVja2JveGVzLCBpO1xuXHRcdFx0aWYgKCB0eXBlb2Yga2V5cGF0aCAhPT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdGtleXBhdGggPSAnJztcblx0XHRcdFx0Y2FzY2FkZSA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRjb25zb2xpZGF0ZUNoYW5nZWRWYWx1ZXMoIHRoaXMsIGtleXBhdGgsIHZhbHVlcyA9IHt9LCBkZWZlcnJlZENoZWNrYm94ZXMgPSBbXSwgY2FzY2FkZSApO1xuXHRcdFx0aWYgKCBpID0gZGVmZXJyZWRDaGVja2JveGVzLmxlbmd0aCApIHtcblx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0a2V5cGF0aCA9IGRlZmVycmVkQ2hlY2tib3hlc1sgaSBdO1xuXHRcdFx0XHRcdHZhbHVlc1sga2V5cGF0aCBdID0gZ2V0VmFsdWVGcm9tQ2hlY2tib3hlcyggdGhpcywga2V5cGF0aCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnNldCggdmFsdWVzICk7XG5cdFx0fTtcblxuXHRcdGZ1bmN0aW9uIGNvbnNvbGlkYXRlQ2hhbmdlZFZhbHVlcyggcmFjdGl2ZSwga2V5cGF0aCwgdmFsdWVzLCBkZWZlcnJlZENoZWNrYm94ZXMsIGNhc2NhZGUgKSB7XG5cdFx0XHR2YXIgYmluZGluZ3MsIGNoaWxkRGVwcywgaSwgYmluZGluZywgb2xkVmFsdWUsIG5ld1ZhbHVlO1xuXHRcdFx0YmluZGluZ3MgPSByYWN0aXZlLl90d293YXlCaW5kaW5nc1sga2V5cGF0aCBdO1xuXHRcdFx0aWYgKCBiaW5kaW5ncyApIHtcblx0XHRcdFx0aSA9IGJpbmRpbmdzLmxlbmd0aDtcblx0XHRcdFx0d2hpbGUgKCBpLS0gKSB7XG5cdFx0XHRcdFx0YmluZGluZyA9IGJpbmRpbmdzWyBpIF07XG5cdFx0XHRcdFx0aWYgKCBiaW5kaW5nLnJhZGlvTmFtZSAmJiAhYmluZGluZy5ub2RlLmNoZWNrZWQgKSB7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCBiaW5kaW5nLmNoZWNrYm94TmFtZSApIHtcblx0XHRcdFx0XHRcdGlmICggYmluZGluZy5jaGFuZ2VkKCkgJiYgZGVmZXJyZWRDaGVja2JveGVzWyBrZXlwYXRoIF0gIT09IHRydWUgKSB7XG5cdFx0XHRcdFx0XHRcdGRlZmVycmVkQ2hlY2tib3hlc1sga2V5cGF0aCBdID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0ZGVmZXJyZWRDaGVja2JveGVzLnB1c2goIGtleXBhdGggKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRvbGRWYWx1ZSA9IGJpbmRpbmcuYXR0ci52YWx1ZTtcblx0XHRcdFx0XHRuZXdWYWx1ZSA9IGJpbmRpbmcudmFsdWUoKTtcblx0XHRcdFx0XHRpZiAoIGFycmF5Q29udGVudHNNYXRjaCggb2xkVmFsdWUsIG5ld1ZhbHVlICkgKSB7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCAhaXNFcXVhbCggb2xkVmFsdWUsIG5ld1ZhbHVlICkgKSB7XG5cdFx0XHRcdFx0XHR2YWx1ZXNbIGtleXBhdGggXSA9IG5ld1ZhbHVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCAhY2FzY2FkZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y2hpbGREZXBzID0gcmFjdGl2ZS5fZGVwc01hcFsga2V5cGF0aCBdO1xuXHRcdFx0aWYgKCBjaGlsZERlcHMgKSB7XG5cdFx0XHRcdGkgPSBjaGlsZERlcHMubGVuZ3RoO1xuXHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRjb25zb2xpZGF0ZUNoYW5nZWRWYWx1ZXMoIHJhY3RpdmUsIGNoaWxkRGVwc1sgaSBdLCB2YWx1ZXMsIGRlZmVycmVkQ2hlY2tib3hlcywgY2FzY2FkZSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9KCBzaGFyZWRfZ2V0VmFsdWVGcm9tQ2hlY2tib3hlcywgdXRpbHNfYXJyYXlDb250ZW50c01hdGNoLCB1dGlsc19pc0VxdWFsICk7XG5cblx0dmFyIFJhY3RpdmVfcHJvdG90eXBlX19wcm90b3R5cGUgPSBmdW5jdGlvbiggYWRkLCBhbmltYXRlLCBkZXRhY2gsIGZpbmQsIGZpbmRBbGwsIGZpbmRBbGxDb21wb25lbnRzLCBmaW5kQ29tcG9uZW50LCBmaXJlLCBnZXQsIGluc2VydCwgbWVyZ2UsIG9ic2VydmUsIG9mZiwgb24sIHJlbmRlciwgcmVuZGVySFRNTCwgcmVzZXQsIHNldCwgc3VidHJhY3QsIHRlYXJkb3duLCB0b0hUTUwsIHRvZ2dsZSwgdXBkYXRlLCB1cGRhdGVNb2RlbCApIHtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRhZGQ6IGFkZCxcblx0XHRcdGFuaW1hdGU6IGFuaW1hdGUsXG5cdFx0XHRkZXRhY2g6IGRldGFjaCxcblx0XHRcdGZpbmQ6IGZpbmQsXG5cdFx0XHRmaW5kQWxsOiBmaW5kQWxsLFxuXHRcdFx0ZmluZEFsbENvbXBvbmVudHM6IGZpbmRBbGxDb21wb25lbnRzLFxuXHRcdFx0ZmluZENvbXBvbmVudDogZmluZENvbXBvbmVudCxcblx0XHRcdGZpcmU6IGZpcmUsXG5cdFx0XHRnZXQ6IGdldCxcblx0XHRcdGluc2VydDogaW5zZXJ0LFxuXHRcdFx0bWVyZ2U6IG1lcmdlLFxuXHRcdFx0b2JzZXJ2ZTogb2JzZXJ2ZSxcblx0XHRcdG9mZjogb2ZmLFxuXHRcdFx0b246IG9uLFxuXHRcdFx0cmVuZGVyOiByZW5kZXIsXG5cdFx0XHRyZW5kZXJIVE1MOiByZW5kZXJIVE1MLFxuXHRcdFx0cmVzZXQ6IHJlc2V0LFxuXHRcdFx0c2V0OiBzZXQsXG5cdFx0XHRzdWJ0cmFjdDogc3VidHJhY3QsXG5cdFx0XHR0ZWFyZG93bjogdGVhcmRvd24sXG5cdFx0XHR0b0hUTUw6IHRvSFRNTCxcblx0XHRcdHRvZ2dsZTogdG9nZ2xlLFxuXHRcdFx0dXBkYXRlOiB1cGRhdGUsXG5cdFx0XHR1cGRhdGVNb2RlbDogdXBkYXRlTW9kZWxcblx0XHR9O1xuXHR9KCBSYWN0aXZlX3Byb3RvdHlwZV9hZGQsIFJhY3RpdmVfcHJvdG90eXBlX2FuaW1hdGVfX2FuaW1hdGUsIFJhY3RpdmVfcHJvdG90eXBlX2RldGFjaCwgUmFjdGl2ZV9wcm90b3R5cGVfZmluZCwgUmFjdGl2ZV9wcm90b3R5cGVfZmluZEFsbCwgUmFjdGl2ZV9wcm90b3R5cGVfZmluZEFsbENvbXBvbmVudHMsIFJhY3RpdmVfcHJvdG90eXBlX2ZpbmRDb21wb25lbnQsIFJhY3RpdmVfcHJvdG90eXBlX2ZpcmUsIFJhY3RpdmVfcHJvdG90eXBlX2dldCwgUmFjdGl2ZV9wcm90b3R5cGVfaW5zZXJ0LCBSYWN0aXZlX3Byb3RvdHlwZV9tZXJnZV9fbWVyZ2UsIFJhY3RpdmVfcHJvdG90eXBlX29ic2VydmVfX29ic2VydmUsIFJhY3RpdmVfcHJvdG90eXBlX29mZiwgUmFjdGl2ZV9wcm90b3R5cGVfb24sIFJhY3RpdmVfcHJvdG90eXBlX3JlbmRlciwgUmFjdGl2ZV9wcm90b3R5cGVfcmVuZGVySFRNTCwgUmFjdGl2ZV9wcm90b3R5cGVfcmVzZXQsIFJhY3RpdmVfcHJvdG90eXBlX3NldCwgUmFjdGl2ZV9wcm90b3R5cGVfc3VidHJhY3QsIFJhY3RpdmVfcHJvdG90eXBlX3RlYXJkb3duLCBSYWN0aXZlX3Byb3RvdHlwZV90b0hUTUwsIFJhY3RpdmVfcHJvdG90eXBlX3RvZ2dsZSwgUmFjdGl2ZV9wcm90b3R5cGVfdXBkYXRlLCBSYWN0aXZlX3Byb3RvdHlwZV91cGRhdGVNb2RlbCApO1xuXG5cdHZhciByZWdpc3RyaWVzX2NvbXBvbmVudHMgPSB7fTtcblxuXHQvLyBUaGVzZSBhcmUgYSBzdWJzZXQgb2YgdGhlIGVhc2luZyBlcXVhdGlvbnMgZm91bmQgYXRcblx0Ly8gaHR0cHM6Ly9yYXcuZ2l0aHViLmNvbS9kYW5yby9lYXNpbmctanMgLSBsaWNlbnNlIGluZm9cblx0Ly8gZm9sbG93czpcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblx0Ly8gZWFzaW5nLmpzIHYwLjUuNFxuXHQvLyBHZW5lcmljIHNldCBvZiBlYXNpbmcgZnVuY3Rpb25zIHdpdGggQU1EIHN1cHBvcnRcblx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL2RhbnJvL2Vhc2luZy1qc1xuXHQvLyBUaGlzIGNvZGUgbWF5IGJlIGZyZWVseSBkaXN0cmlidXRlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2Vcblx0Ly8gaHR0cDovL2RhbnJvLm1pdC1saWNlbnNlLm9yZy9cblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblx0Ly8gQWxsIGZ1bmN0aW9ucyBhZGFwdGVkIGZyb20gVGhvbWFzIEZ1Y2hzICYgSmVyZW15IEthaG5cblx0Ly8gRWFzaW5nIEVxdWF0aW9ucyAoYykgMjAwMyBSb2JlcnQgUGVubmVyLCBCU0QgbGljZW5zZVxuXHQvLyBodHRwczovL3Jhdy5naXRodWIuY29tL2RhbnJvL2Vhc2luZy1qcy9tYXN0ZXIvTElDRU5TRVxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXHQvLyBJbiB0aGF0IGxpYnJhcnksIHRoZSBmdW5jdGlvbnMgbmFtZWQgZWFzZUluLCBlYXNlT3V0LCBhbmRcblx0Ly8gZWFzZUluT3V0IGJlbG93IGFyZSBuYW1lZCBlYXNlSW5DdWJpYywgZWFzZU91dEN1YmljLCBhbmRcblx0Ly8gKHlvdSBndWVzc2VkIGl0KSBlYXNlSW5PdXRDdWJpYy5cblx0Ly9cblx0Ly8gWW91IGNhbiBhZGQgYWRkaXRpb25hbCBlYXNpbmcgZnVuY3Rpb25zIHRvIHRoaXMgbGlzdCwgYW5kIHRoZXlcblx0Ly8gd2lsbCBiZSBnbG9iYWxseSBhdmFpbGFibGUuXG5cdHZhciByZWdpc3RyaWVzX2Vhc2luZyA9IHtcblx0XHRsaW5lYXI6IGZ1bmN0aW9uKCBwb3MgKSB7XG5cdFx0XHRyZXR1cm4gcG9zO1xuXHRcdH0sXG5cdFx0ZWFzZUluOiBmdW5jdGlvbiggcG9zICkge1xuXHRcdFx0cmV0dXJuIE1hdGgucG93KCBwb3MsIDMgKTtcblx0XHR9LFxuXHRcdGVhc2VPdXQ6IGZ1bmN0aW9uKCBwb3MgKSB7XG5cdFx0XHRyZXR1cm4gTWF0aC5wb3coIHBvcyAtIDEsIDMgKSArIDE7XG5cdFx0fSxcblx0XHRlYXNlSW5PdXQ6IGZ1bmN0aW9uKCBwb3MgKSB7XG5cdFx0XHRpZiAoICggcG9zIC89IDAuNSApIDwgMSApIHtcblx0XHRcdFx0cmV0dXJuIDAuNSAqIE1hdGgucG93KCBwb3MsIDMgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiAwLjUgKiAoIE1hdGgucG93KCBwb3MgLSAyLCAzICkgKyAyICk7XG5cdFx0fVxuXHR9O1xuXG5cdHZhciB1dGlsc19nZXRHdWlkID0gZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuICd4eHh4eHh4eC14eHh4LTR4eHgteXh4eC14eHh4eHh4eHh4eHgnLnJlcGxhY2UoIC9beHldL2csIGZ1bmN0aW9uKCBjICkge1xuXHRcdFx0dmFyIHIsIHY7XG5cdFx0XHRyID0gTWF0aC5yYW5kb20oKSAqIDE2IHwgMDtcblx0XHRcdHYgPSBjID09ICd4JyA/IHIgOiByICYgMyB8IDg7XG5cdFx0XHRyZXR1cm4gdi50b1N0cmluZyggMTYgKTtcblx0XHR9ICk7XG5cdH07XG5cblx0dmFyIHV0aWxzX2V4dGVuZCA9IGZ1bmN0aW9uKCB0YXJnZXQgKSB7XG5cdFx0dmFyIHByb3AsIHNvdXJjZSwgc291cmNlcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKCBhcmd1bWVudHMsIDEgKTtcblx0XHR3aGlsZSAoIHNvdXJjZSA9IHNvdXJjZXMuc2hpZnQoKSApIHtcblx0XHRcdGZvciAoIHByb3AgaW4gc291cmNlICkge1xuXHRcdFx0XHRpZiAoIHNvdXJjZS5oYXNPd25Qcm9wZXJ0eSggcHJvcCApICkge1xuXHRcdFx0XHRcdHRhcmdldFsgcHJvcCBdID0gc291cmNlWyBwcm9wIF07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRhcmdldDtcblx0fTtcblxuXHR2YXIgY29uZmlnX3JlZ2lzdHJpZXMgPSBbXG5cdFx0J2FkYXB0b3JzJyxcblx0XHQnY29tcG9uZW50cycsXG5cdFx0J2RlY29yYXRvcnMnLFxuXHRcdCdlYXNpbmcnLFxuXHRcdCdldmVudHMnLFxuXHRcdCdpbnRlcnBvbGF0b3JzJyxcblx0XHQncGFydGlhbHMnLFxuXHRcdCd0cmFuc2l0aW9ucycsXG5cdFx0J2RhdGEnXG5cdF07XG5cblx0dmFyIGV4dGVuZF91dGlsc190cmFuc2Zvcm1Dc3MgPSBmdW5jdGlvbigpIHtcblxuXHRcdHZhciBzZWxlY3RvcnNQYXR0ZXJuID0gLyg/Ol58XFx9KT9cXHMqKFteXFx7XFx9XSspXFxzKlxcey9nLFxuXHRcdFx0Y29tbWVudHNQYXR0ZXJuID0gL1xcL1xcKi4qP1xcKlxcLy9nLFxuXHRcdFx0c2VsZWN0b3JVbml0UGF0dGVybiA9IC8oKD86KD86XFxbW15cXF0rXVxcXSl8KD86W15cXHNcXCtcXD5cXH46XSkpKykoKD86OlteXFxzXFwrXFw+XFx+XSspP1xccypbXFxzXFwrXFw+XFx+XT8pXFxzKi9nO1xuXHRcdHJldHVybiBmdW5jdGlvbiB0cmFuc2Zvcm1Dc3MoIGNzcywgZ3VpZCApIHtcblx0XHRcdHZhciB0cmFuc2Zvcm1lZCwgYWRkR3VpZDtcblx0XHRcdGFkZEd1aWQgPSBmdW5jdGlvbiggc2VsZWN0b3IgKSB7XG5cdFx0XHRcdHZhciBzZWxlY3RvclVuaXRzLCBtYXRjaCwgdW5pdCwgZGF0YUF0dHIsIGJhc2UsIHByZXBlbmRlZCwgYXBwZW5kZWQsIGksIHRyYW5zZm9ybWVkID0gW107XG5cdFx0XHRcdHNlbGVjdG9yVW5pdHMgPSBbXTtcblx0XHRcdFx0d2hpbGUgKCBtYXRjaCA9IHNlbGVjdG9yVW5pdFBhdHRlcm4uZXhlYyggc2VsZWN0b3IgKSApIHtcblx0XHRcdFx0XHRzZWxlY3RvclVuaXRzLnB1c2goIHtcblx0XHRcdFx0XHRcdHN0cjogbWF0Y2hbIDAgXSxcblx0XHRcdFx0XHRcdGJhc2U6IG1hdGNoWyAxIF0sXG5cdFx0XHRcdFx0XHRtb2RpZmllcnM6IG1hdGNoWyAyIF1cblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZGF0YUF0dHIgPSAnW2RhdGEtcnZjZ3VpZD1cIicgKyBndWlkICsgJ1wiXSc7XG5cdFx0XHRcdGJhc2UgPSBzZWxlY3RvclVuaXRzLm1hcCggZXh0cmFjdFN0cmluZyApO1xuXHRcdFx0XHRpID0gc2VsZWN0b3JVbml0cy5sZW5ndGg7XG5cdFx0XHRcdHdoaWxlICggaS0tICkge1xuXHRcdFx0XHRcdGFwcGVuZGVkID0gYmFzZS5zbGljZSgpO1xuXHRcdFx0XHRcdHVuaXQgPSBzZWxlY3RvclVuaXRzWyBpIF07XG5cdFx0XHRcdFx0YXBwZW5kZWRbIGkgXSA9IHVuaXQuYmFzZSArIGRhdGFBdHRyICsgdW5pdC5tb2RpZmllcnMgfHwgJyc7XG5cdFx0XHRcdFx0cHJlcGVuZGVkID0gYmFzZS5zbGljZSgpO1xuXHRcdFx0XHRcdHByZXBlbmRlZFsgaSBdID0gZGF0YUF0dHIgKyAnICcgKyBwcmVwZW5kZWRbIGkgXTtcblx0XHRcdFx0XHR0cmFuc2Zvcm1lZC5wdXNoKCBhcHBlbmRlZC5qb2luKCAnICcgKSwgcHJlcGVuZGVkLmpvaW4oICcgJyApICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRyYW5zZm9ybWVkLmpvaW4oICcsICcgKTtcblx0XHRcdH07XG5cdFx0XHR0cmFuc2Zvcm1lZCA9IGNzcy5yZXBsYWNlKCBjb21tZW50c1BhdHRlcm4sICcnICkucmVwbGFjZSggc2VsZWN0b3JzUGF0dGVybiwgZnVuY3Rpb24oIG1hdGNoLCAkMSApIHtcblx0XHRcdFx0dmFyIHNlbGVjdG9ycywgdHJhbnNmb3JtZWQ7XG5cdFx0XHRcdHNlbGVjdG9ycyA9ICQxLnNwbGl0KCAnLCcgKS5tYXAoIHRyaW0gKTtcblx0XHRcdFx0dHJhbnNmb3JtZWQgPSBzZWxlY3RvcnMubWFwKCBhZGRHdWlkICkuam9pbiggJywgJyApICsgJyAnO1xuXHRcdFx0XHRyZXR1cm4gbWF0Y2gucmVwbGFjZSggJDEsIHRyYW5zZm9ybWVkICk7XG5cdFx0XHR9ICk7XG5cdFx0XHRyZXR1cm4gdHJhbnNmb3JtZWQ7XG5cdFx0fTtcblxuXHRcdGZ1bmN0aW9uIHRyaW0oIHN0ciApIHtcblx0XHRcdGlmICggc3RyLnRyaW0gKSB7XG5cdFx0XHRcdHJldHVybiBzdHIudHJpbSgpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHN0ci5yZXBsYWNlKCAvXlxccysvLCAnJyApLnJlcGxhY2UoIC9cXHMrJC8sICcnICk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZXh0cmFjdFN0cmluZyggdW5pdCApIHtcblx0XHRcdHJldHVybiB1bml0LnN0cjtcblx0XHR9XG5cdH0oKTtcblxuXHR2YXIgZXh0ZW5kX2luaGVyaXRGcm9tUGFyZW50ID0gZnVuY3Rpb24oIHJlZ2lzdHJpZXMsIGNyZWF0ZSwgZGVmaW5lUHJvcGVydHksIHRyYW5zZm9ybUNzcyApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggQ2hpbGQsIFBhcmVudCApIHtcblx0XHRcdHJlZ2lzdHJpZXMuZm9yRWFjaCggZnVuY3Rpb24oIHByb3BlcnR5ICkge1xuXHRcdFx0XHRpZiAoIFBhcmVudFsgcHJvcGVydHkgXSApIHtcblx0XHRcdFx0XHRDaGlsZFsgcHJvcGVydHkgXSA9IGNyZWF0ZSggUGFyZW50WyBwcm9wZXJ0eSBdICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdGRlZmluZVByb3BlcnR5KCBDaGlsZCwgJ2RlZmF1bHRzJywge1xuXHRcdFx0XHR2YWx1ZTogY3JlYXRlKCBQYXJlbnQuZGVmYXVsdHMgKVxuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCBQYXJlbnQuY3NzICkge1xuXHRcdFx0XHRkZWZpbmVQcm9wZXJ0eSggQ2hpbGQsICdjc3MnLCB7XG5cdFx0XHRcdFx0dmFsdWU6IFBhcmVudC5kZWZhdWx0cy5ub0Nzc1RyYW5zZm9ybSA/IFBhcmVudC5jc3MgOiB0cmFuc2Zvcm1Dc3MoIFBhcmVudC5jc3MsIENoaWxkLl9ndWlkIClcblx0XHRcdFx0fSApO1xuXHRcdFx0fVxuXHRcdH07XG5cdH0oIGNvbmZpZ19yZWdpc3RyaWVzLCB1dGlsc19jcmVhdGUsIHV0aWxzX2RlZmluZVByb3BlcnR5LCBleHRlbmRfdXRpbHNfdHJhbnNmb3JtQ3NzICk7XG5cblx0dmFyIGV4dGVuZF93cmFwTWV0aG9kID0gZnVuY3Rpb24oIG1ldGhvZCwgc3VwZXJNZXRob2QgKSB7XG5cdFx0aWYgKCAvX3N1cGVyLy50ZXN0KCBtZXRob2QgKSApIHtcblx0XHRcdHJldHVybiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIF9zdXBlciA9IHRoaXMuX3N1cGVyLFxuXHRcdFx0XHRcdHJlc3VsdDtcblx0XHRcdFx0dGhpcy5fc3VwZXIgPSBzdXBlck1ldGhvZDtcblx0XHRcdFx0cmVzdWx0ID0gbWV0aG9kLmFwcGx5KCB0aGlzLCBhcmd1bWVudHMgKTtcblx0XHRcdFx0dGhpcy5fc3VwZXIgPSBfc3VwZXI7XG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHR9O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gbWV0aG9kO1xuXHRcdH1cblx0fTtcblxuXHR2YXIgZXh0ZW5kX3V0aWxzX2F1Z21lbnQgPSBmdW5jdGlvbiggdGFyZ2V0LCBzb3VyY2UgKSB7XG5cdFx0dmFyIGtleTtcblx0XHRmb3IgKCBrZXkgaW4gc291cmNlICkge1xuXHRcdFx0aWYgKCBzb3VyY2UuaGFzT3duUHJvcGVydHkoIGtleSApICkge1xuXHRcdFx0XHR0YXJnZXRbIGtleSBdID0gc291cmNlWyBrZXkgXTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRhcmdldDtcblx0fTtcblxuXHR2YXIgZXh0ZW5kX2luaGVyaXRGcm9tQ2hpbGRQcm9wcyA9IGZ1bmN0aW9uKCBpbml0T3B0aW9ucywgcmVnaXN0cmllcywgZGVmaW5lUHJvcGVydHksIHdyYXBNZXRob2QsIGF1Z21lbnQsIHRyYW5zZm9ybUNzcyApIHtcblxuXHRcdHZhciBibGFja2xpc3RlZCA9IHt9O1xuXHRcdHJlZ2lzdHJpZXMuY29uY2F0KCBpbml0T3B0aW9ucy5rZXlzICkuZm9yRWFjaCggZnVuY3Rpb24oIHByb3BlcnR5ICkge1xuXHRcdFx0YmxhY2tsaXN0ZWRbIHByb3BlcnR5IF0gPSB0cnVlO1xuXHRcdH0gKTtcblx0XHRyZXR1cm4gZnVuY3Rpb24oIENoaWxkLCBjaGlsZFByb3BzICkge1xuXHRcdFx0dmFyIGtleSwgbWVtYmVyO1xuXHRcdFx0cmVnaXN0cmllcy5mb3JFYWNoKCBmdW5jdGlvbiggcHJvcGVydHkgKSB7XG5cdFx0XHRcdHZhciB2YWx1ZSA9IGNoaWxkUHJvcHNbIHByb3BlcnR5IF07XG5cdFx0XHRcdGlmICggdmFsdWUgKSB7XG5cdFx0XHRcdFx0aWYgKCBDaGlsZFsgcHJvcGVydHkgXSApIHtcblx0XHRcdFx0XHRcdGF1Z21lbnQoIENoaWxkWyBwcm9wZXJ0eSBdLCB2YWx1ZSApO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRDaGlsZFsgcHJvcGVydHkgXSA9IHZhbHVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0aW5pdE9wdGlvbnMua2V5cy5mb3JFYWNoKCBmdW5jdGlvbigga2V5ICkge1xuXHRcdFx0XHR2YXIgdmFsdWUgPSBjaGlsZFByb3BzWyBrZXkgXTtcblx0XHRcdFx0aWYgKCB2YWx1ZSAhPT0gdW5kZWZpbmVkICkge1xuXHRcdFx0XHRcdGlmICggdHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBDaGlsZFsga2V5IF0gPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRcdFx0XHRDaGlsZC5kZWZhdWx0c1sga2V5IF0gPSB3cmFwTWV0aG9kKCB2YWx1ZSwgQ2hpbGRbIGtleSBdICk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdENoaWxkLmRlZmF1bHRzWyBrZXkgXSA9IGNoaWxkUHJvcHNbIGtleSBdO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0Zm9yICgga2V5IGluIGNoaWxkUHJvcHMgKSB7XG5cdFx0XHRcdGlmICggIWJsYWNrbGlzdGVkWyBrZXkgXSAmJiBjaGlsZFByb3BzLmhhc093blByb3BlcnR5KCBrZXkgKSApIHtcblx0XHRcdFx0XHRtZW1iZXIgPSBjaGlsZFByb3BzWyBrZXkgXTtcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiBtZW1iZXIgPT09ICdmdW5jdGlvbicgJiYgdHlwZW9mIENoaWxkLnByb3RvdHlwZVsga2V5IF0gPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRcdFx0XHRDaGlsZC5wcm90b3R5cGVbIGtleSBdID0gd3JhcE1ldGhvZCggbWVtYmVyLCBDaGlsZC5wcm90b3R5cGVbIGtleSBdICk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdENoaWxkLnByb3RvdHlwZVsga2V5IF0gPSBtZW1iZXI7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGNoaWxkUHJvcHMuY3NzICkge1xuXHRcdFx0XHRkZWZpbmVQcm9wZXJ0eSggQ2hpbGQsICdjc3MnLCB7XG5cdFx0XHRcdFx0dmFsdWU6IENoaWxkLmRlZmF1bHRzLm5vQ3NzVHJhbnNmb3JtID8gY2hpbGRQcm9wcy5jc3MgOiB0cmFuc2Zvcm1Dc3MoIGNoaWxkUHJvcHMuY3NzLCBDaGlsZC5fZ3VpZCApXG5cdFx0XHRcdH0gKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9KCBjb25maWdfaW5pdE9wdGlvbnMsIGNvbmZpZ19yZWdpc3RyaWVzLCB1dGlsc19kZWZpbmVQcm9wZXJ0eSwgZXh0ZW5kX3dyYXBNZXRob2QsIGV4dGVuZF91dGlsc19hdWdtZW50LCBleHRlbmRfdXRpbHNfdHJhbnNmb3JtQ3NzICk7XG5cblx0dmFyIGV4dGVuZF9leHRyYWN0SW5saW5lUGFydGlhbHMgPSBmdW5jdGlvbiggaXNPYmplY3QsIGF1Z21lbnQgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIENoaWxkLCBjaGlsZFByb3BzICkge1xuXHRcdFx0aWYgKCBpc09iamVjdCggQ2hpbGQuZGVmYXVsdHMudGVtcGxhdGUgKSApIHtcblx0XHRcdFx0aWYgKCAhQ2hpbGQucGFydGlhbHMgKSB7XG5cdFx0XHRcdFx0Q2hpbGQucGFydGlhbHMgPSB7fTtcblx0XHRcdFx0fVxuXHRcdFx0XHRhdWdtZW50KCBDaGlsZC5wYXJ0aWFscywgQ2hpbGQuZGVmYXVsdHMudGVtcGxhdGUucGFydGlhbHMgKTtcblx0XHRcdFx0aWYgKCBjaGlsZFByb3BzLnBhcnRpYWxzICkge1xuXHRcdFx0XHRcdGF1Z21lbnQoIENoaWxkLnBhcnRpYWxzLCBjaGlsZFByb3BzLnBhcnRpYWxzICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Q2hpbGQuZGVmYXVsdHMudGVtcGxhdGUgPSBDaGlsZC5kZWZhdWx0cy50ZW1wbGF0ZS5tYWluO1xuXHRcdFx0fVxuXHRcdH07XG5cdH0oIHV0aWxzX2lzT2JqZWN0LCBleHRlbmRfdXRpbHNfYXVnbWVudCApO1xuXG5cdHZhciBleHRlbmRfY29uZGl0aW9uYWxseVBhcnNlVGVtcGxhdGUgPSBmdW5jdGlvbiggZXJyb3JzLCBpc0NsaWVudCwgcGFyc2UgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIENoaWxkICkge1xuXHRcdFx0dmFyIHRlbXBsYXRlRWw7XG5cdFx0XHRpZiAoIHR5cGVvZiBDaGlsZC5kZWZhdWx0cy50ZW1wbGF0ZSA9PT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdGlmICggIXBhcnNlICkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggZXJyb3JzLm1pc3NpbmdQYXJzZXIgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIENoaWxkLmRlZmF1bHRzLnRlbXBsYXRlLmNoYXJBdCggMCApID09PSAnIycgJiYgaXNDbGllbnQgKSB7XG5cdFx0XHRcdFx0dGVtcGxhdGVFbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBDaGlsZC5kZWZhdWx0cy50ZW1wbGF0ZS5zdWJzdHJpbmcoIDEgKSApO1xuXHRcdFx0XHRcdGlmICggdGVtcGxhdGVFbCAmJiB0ZW1wbGF0ZUVsLnRhZ05hbWUgPT09ICdTQ1JJUFQnICkge1xuXHRcdFx0XHRcdFx0Q2hpbGQuZGVmYXVsdHMudGVtcGxhdGUgPSBwYXJzZSggdGVtcGxhdGVFbC5pbm5lckhUTUwsIENoaWxkICk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ0NvdWxkIG5vdCBmaW5kIHRlbXBsYXRlIGVsZW1lbnQgKCcgKyBDaGlsZC5kZWZhdWx0cy50ZW1wbGF0ZSArICcpJyApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRDaGlsZC5kZWZhdWx0cy50ZW1wbGF0ZSA9IHBhcnNlKCBDaGlsZC5kZWZhdWx0cy50ZW1wbGF0ZSwgQ2hpbGQuZGVmYXVsdHMgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdH0oIGNvbmZpZ19lcnJvcnMsIGNvbmZpZ19pc0NsaWVudCwgcGFyc2VfX3BhcnNlICk7XG5cblx0dmFyIGV4dGVuZF9jb25kaXRpb25hbGx5UGFyc2VQYXJ0aWFscyA9IGZ1bmN0aW9uKCBlcnJvcnMsIHBhcnNlICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBDaGlsZCApIHtcblx0XHRcdHZhciBrZXk7XG5cdFx0XHRpZiAoIENoaWxkLnBhcnRpYWxzICkge1xuXHRcdFx0XHRmb3IgKCBrZXkgaW4gQ2hpbGQucGFydGlhbHMgKSB7XG5cdFx0XHRcdFx0aWYgKCBDaGlsZC5wYXJ0aWFscy5oYXNPd25Qcm9wZXJ0eSgga2V5ICkgJiYgdHlwZW9mIENoaWxkLnBhcnRpYWxzWyBrZXkgXSA9PT0gJ3N0cmluZycgKSB7XG5cdFx0XHRcdFx0XHRpZiAoICFwYXJzZSApIHtcblx0XHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCBlcnJvcnMubWlzc2luZ1BhcnNlciApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Q2hpbGQucGFydGlhbHNbIGtleSBdID0gcGFyc2UoIENoaWxkLnBhcnRpYWxzWyBrZXkgXSwgQ2hpbGQgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHR9KCBjb25maWdfZXJyb3JzLCBwYXJzZV9fcGFyc2UgKTtcblxuXHR2YXIgUmFjdGl2ZV9pbml0aWFsaXNlID0gZnVuY3Rpb24oIGlzQ2xpZW50LCBlcnJvcnMsIGluaXRPcHRpb25zLCByZWdpc3RyaWVzLCB3YXJuLCBjcmVhdGUsIGV4dGVuZCwgZmlsbEdhcHMsIGRlZmluZVByb3BlcnRpZXMsIGdldEVsZW1lbnQsIGlzT2JqZWN0LCBpc0FycmF5LCBnZXRHdWlkLCBQcm9taXNlLCBtYWdpY0FkYXB0b3IsIHBhcnNlICkge1xuXG5cdFx0dmFyIGZsYWdzID0gW1xuXHRcdFx0J2FkYXB0Jyxcblx0XHRcdCdtb2RpZnlBcnJheXMnLFxuXHRcdFx0J21hZ2ljJyxcblx0XHRcdCd0d293YXknLFxuXHRcdFx0J2xhenknLFxuXHRcdFx0J2RlYnVnJyxcblx0XHRcdCdpc29sYXRlZCdcblx0XHRdO1xuXHRcdHJldHVybiBmdW5jdGlvbiBpbml0aWFsaXNlUmFjdGl2ZUluc3RhbmNlKCByYWN0aXZlLCBvcHRpb25zICkge1xuXHRcdFx0dmFyIHRlbXBsYXRlLCB0ZW1wbGF0ZUVsLCBwYXJzZWRUZW1wbGF0ZSwgcHJvbWlzZSwgZnVsZmlsUHJvbWlzZTtcblx0XHRcdGlmICggaXNBcnJheSggb3B0aW9ucy5hZGFwdG9ycyApICkge1xuXHRcdFx0XHR3YXJuKCAnVGhlIGBhZGFwdG9yc2Agb3B0aW9uLCB0byBpbmRpY2F0ZSB3aGljaCBhZGFwdG9ycyBzaG91bGQgYmUgdXNlZCB3aXRoIGEgZ2l2ZW4gUmFjdGl2ZSBpbnN0YW5jZSwgaGFzIGJlZW4gZGVwcmVjYXRlZCBpbiBmYXZvdXIgb2YgYGFkYXB0YC4gU2VlIFtUT0RPXSBmb3IgbW9yZSBpbmZvcm1hdGlvbicgKTtcblx0XHRcdFx0b3B0aW9ucy5hZGFwdCA9IG9wdGlvbnMuYWRhcHRvcnM7XG5cdFx0XHRcdGRlbGV0ZSBvcHRpb25zLmFkYXB0b3JzO1xuXHRcdFx0fVxuXHRcdFx0aW5pdE9wdGlvbnMua2V5cy5mb3JFYWNoKCBmdW5jdGlvbigga2V5ICkge1xuXHRcdFx0XHRpZiAoIG9wdGlvbnNbIGtleSBdID09PSB1bmRlZmluZWQgKSB7XG5cdFx0XHRcdFx0b3B0aW9uc1sga2V5IF0gPSByYWN0aXZlLmNvbnN0cnVjdG9yLmRlZmF1bHRzWyBrZXkgXTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0ZmxhZ3MuZm9yRWFjaCggZnVuY3Rpb24oIGZsYWcgKSB7XG5cdFx0XHRcdHJhY3RpdmVbIGZsYWcgXSA9IG9wdGlvbnNbIGZsYWcgXTtcblx0XHRcdH0gKTtcblx0XHRcdGlmICggdHlwZW9mIHJhY3RpdmUuYWRhcHQgPT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHRyYWN0aXZlLmFkYXB0ID0gWyByYWN0aXZlLmFkYXB0IF07XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHJhY3RpdmUubWFnaWMgJiYgIW1hZ2ljQWRhcHRvciApIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnR2V0dGVycyBhbmQgc2V0dGVycyAobWFnaWMgbW9kZSkgYXJlIG5vdCBzdXBwb3J0ZWQgaW4gdGhpcyBicm93c2VyJyApO1xuXHRcdFx0fVxuXHRcdFx0ZGVmaW5lUHJvcGVydGllcyggcmFjdGl2ZSwge1xuXHRcdFx0XHRfaW5pdGluZzoge1xuXHRcdFx0XHRcdHZhbHVlOiB0cnVlLFxuXHRcdFx0XHRcdHdyaXRhYmxlOiB0cnVlXG5cdFx0XHRcdH0sXG5cdFx0XHRcdF9ndWlkOiB7XG5cdFx0XHRcdFx0dmFsdWU6IGdldEd1aWQoKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRfc3Viczoge1xuXHRcdFx0XHRcdHZhbHVlOiBjcmVhdGUoIG51bGwgKSxcblx0XHRcdFx0XHRjb25maWd1cmFibGU6IHRydWVcblx0XHRcdFx0fSxcblx0XHRcdFx0X2NhY2hlOiB7XG5cdFx0XHRcdFx0dmFsdWU6IHt9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdF9jYWNoZU1hcDoge1xuXHRcdFx0XHRcdHZhbHVlOiBjcmVhdGUoIG51bGwgKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRfZGVwczoge1xuXHRcdFx0XHRcdHZhbHVlOiBbXVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRfZGVwc01hcDoge1xuXHRcdFx0XHRcdHZhbHVlOiBjcmVhdGUoIG51bGwgKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRfcGF0dGVybk9ic2VydmVyczoge1xuXHRcdFx0XHRcdHZhbHVlOiBbXVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRfZXZhbHVhdG9yczoge1xuXHRcdFx0XHRcdHZhbHVlOiBjcmVhdGUoIG51bGwgKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRfdHdvd2F5QmluZGluZ3M6IHtcblx0XHRcdFx0XHR2YWx1ZToge31cblx0XHRcdFx0fSxcblx0XHRcdFx0X2FuaW1hdGlvbnM6IHtcblx0XHRcdFx0XHR2YWx1ZTogW11cblx0XHRcdFx0fSxcblx0XHRcdFx0bm9kZXM6IHtcblx0XHRcdFx0XHR2YWx1ZToge31cblx0XHRcdFx0fSxcblx0XHRcdFx0X3dyYXBwZWQ6IHtcblx0XHRcdFx0XHR2YWx1ZTogY3JlYXRlKCBudWxsIClcblx0XHRcdFx0fSxcblx0XHRcdFx0X2xpdmVRdWVyaWVzOiB7XG5cdFx0XHRcdFx0dmFsdWU6IFtdXG5cdFx0XHRcdH0sXG5cdFx0XHRcdF9saXZlQ29tcG9uZW50UXVlcmllczoge1xuXHRcdFx0XHRcdHZhbHVlOiBbXVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRfY2hpbGRJbml0UXVldWU6IHtcblx0XHRcdFx0XHR2YWx1ZTogW11cblx0XHRcdFx0fSxcblx0XHRcdFx0X2NoYW5nZXM6IHtcblx0XHRcdFx0XHR2YWx1ZTogW11cblx0XHRcdFx0fSxcblx0XHRcdFx0X3VucmVzb2x2ZWRJbXBsaWNpdERlcGVuZGVuY2llczoge1xuXHRcdFx0XHRcdHZhbHVlOiBbXVxuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoIG9wdGlvbnMuX3BhcmVudCAmJiBvcHRpb25zLl9jb21wb25lbnQgKSB7XG5cdFx0XHRcdGRlZmluZVByb3BlcnRpZXMoIHJhY3RpdmUsIHtcblx0XHRcdFx0XHRfcGFyZW50OiB7XG5cdFx0XHRcdFx0XHR2YWx1ZTogb3B0aW9ucy5fcGFyZW50XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRjb21wb25lbnQ6IHtcblx0XHRcdFx0XHRcdHZhbHVlOiBvcHRpb25zLl9jb21wb25lbnRcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0b3B0aW9ucy5fY29tcG9uZW50Lmluc3RhbmNlID0gcmFjdGl2ZTtcblx0XHRcdH1cblx0XHRcdGlmICggb3B0aW9ucy5lbCApIHtcblx0XHRcdFx0cmFjdGl2ZS5lbCA9IGdldEVsZW1lbnQoIG9wdGlvbnMuZWwgKTtcblx0XHRcdFx0aWYgKCAhcmFjdGl2ZS5lbCAmJiByYWN0aXZlLmRlYnVnICkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ0NvdWxkIG5vdCBmaW5kIGNvbnRhaW5lciBlbGVtZW50JyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIG9wdGlvbnMuZXZlbnREZWZpbml0aW9ucyApIHtcblx0XHRcdFx0d2FybiggJ3JhY3RpdmUuZXZlbnREZWZpbml0aW9ucyBoYXMgYmVlbiBkZXByZWNhdGVkIGluIGZhdm91ciBvZiByYWN0aXZlLmV2ZW50cy4gU3VwcG9ydCB3aWxsIGJlIHJlbW92ZWQgaW4gZnV0dXJlIHZlcnNpb25zJyApO1xuXHRcdFx0XHRvcHRpb25zLmV2ZW50cyA9IG9wdGlvbnMuZXZlbnREZWZpbml0aW9ucztcblx0XHRcdH1cblx0XHRcdHJlZ2lzdHJpZXMuZm9yRWFjaCggZnVuY3Rpb24oIHJlZ2lzdHJ5ICkge1xuXHRcdFx0XHRpZiAoIHJhY3RpdmUuY29uc3RydWN0b3JbIHJlZ2lzdHJ5IF0gKSB7XG5cdFx0XHRcdFx0cmFjdGl2ZVsgcmVnaXN0cnkgXSA9IGV4dGVuZCggY3JlYXRlKCByYWN0aXZlLmNvbnN0cnVjdG9yWyByZWdpc3RyeSBdICksIG9wdGlvbnNbIHJlZ2lzdHJ5IF0gKTtcblx0XHRcdFx0fSBlbHNlIGlmICggb3B0aW9uc1sgcmVnaXN0cnkgXSApIHtcblx0XHRcdFx0XHRyYWN0aXZlWyByZWdpc3RyeSBdID0gb3B0aW9uc1sgcmVnaXN0cnkgXTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCAhcmFjdGl2ZS5kYXRhICkge1xuXHRcdFx0XHRyYWN0aXZlLmRhdGEgPSB7fTtcblx0XHRcdH1cblx0XHRcdHRlbXBsYXRlID0gb3B0aW9ucy50ZW1wbGF0ZTtcblx0XHRcdGlmICggdHlwZW9mIHRlbXBsYXRlID09PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0aWYgKCAhcGFyc2UgKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCBlcnJvcnMubWlzc2luZ1BhcnNlciApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggdGVtcGxhdGUuY2hhckF0KCAwICkgPT09ICcjJyAmJiBpc0NsaWVudCApIHtcblx0XHRcdFx0XHR0ZW1wbGF0ZUVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIHRlbXBsYXRlLnN1YnN0cmluZyggMSApICk7XG5cdFx0XHRcdFx0aWYgKCB0ZW1wbGF0ZUVsICkge1xuXHRcdFx0XHRcdFx0cGFyc2VkVGVtcGxhdGUgPSBwYXJzZSggdGVtcGxhdGVFbC5pbm5lckhUTUwsIG9wdGlvbnMgKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCAnQ291bGQgbm90IGZpbmQgdGVtcGxhdGUgZWxlbWVudCAoJyArIHRlbXBsYXRlICsgJyknICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHBhcnNlZFRlbXBsYXRlID0gcGFyc2UoIHRlbXBsYXRlLCBvcHRpb25zICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHBhcnNlZFRlbXBsYXRlID0gdGVtcGxhdGU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGlzT2JqZWN0KCBwYXJzZWRUZW1wbGF0ZSApICkge1xuXHRcdFx0XHRmaWxsR2FwcyggcmFjdGl2ZS5wYXJ0aWFscywgcGFyc2VkVGVtcGxhdGUucGFydGlhbHMgKTtcblx0XHRcdFx0cGFyc2VkVGVtcGxhdGUgPSBwYXJzZWRUZW1wbGF0ZS5tYWluO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBwYXJzZWRUZW1wbGF0ZSAmJiBwYXJzZWRUZW1wbGF0ZS5sZW5ndGggPT09IDEgJiYgdHlwZW9mIHBhcnNlZFRlbXBsYXRlWyAwIF0gPT09ICdzdHJpbmcnICkge1xuXHRcdFx0XHRwYXJzZWRUZW1wbGF0ZSA9IHBhcnNlZFRlbXBsYXRlWyAwIF07XG5cdFx0XHR9XG5cdFx0XHRyYWN0aXZlLnRlbXBsYXRlID0gcGFyc2VkVGVtcGxhdGU7XG5cdFx0XHRleHRlbmQoIHJhY3RpdmUucGFydGlhbHMsIG9wdGlvbnMucGFydGlhbHMgKTtcblx0XHRcdHJhY3RpdmUucGFyc2VPcHRpb25zID0ge1xuXHRcdFx0XHRwcmVzZXJ2ZVdoaXRlc3BhY2U6IG9wdGlvbnMucHJlc2VydmVXaGl0ZXNwYWNlLFxuXHRcdFx0XHRzYW5pdGl6ZTogb3B0aW9ucy5zYW5pdGl6ZSxcblx0XHRcdFx0c3RyaXBDb21tZW50czogb3B0aW9ucy5zdHJpcENvbW1lbnRzXG5cdFx0XHR9O1xuXHRcdFx0cmFjdGl2ZS50cmFuc2l0aW9uc0VuYWJsZWQgPSBvcHRpb25zLm5vSW50cm8gPyBmYWxzZSA6IG9wdGlvbnMudHJhbnNpdGlvbnNFbmFibGVkO1xuXHRcdFx0aWYgKCBpc0NsaWVudCAmJiAhcmFjdGl2ZS5lbCApIHtcblx0XHRcdFx0cmFjdGl2ZS5lbCA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcblx0XHRcdH1cblx0XHRcdGlmICggcmFjdGl2ZS5lbCAmJiAhb3B0aW9ucy5hcHBlbmQgKSB7XG5cdFx0XHRcdHJhY3RpdmUuZWwuaW5uZXJIVE1MID0gJyc7XG5cdFx0XHR9XG5cdFx0XHRwcm9taXNlID0gbmV3IFByb21pc2UoIGZ1bmN0aW9uKCBmdWxmaWwgKSB7XG5cdFx0XHRcdGZ1bGZpbFByb21pc2UgPSBmdWxmaWw7XG5cdFx0XHR9ICk7XG5cdFx0XHRyYWN0aXZlLnJlbmRlciggcmFjdGl2ZS5lbCwgZnVsZmlsUHJvbWlzZSApO1xuXHRcdFx0aWYgKCBvcHRpb25zLmNvbXBsZXRlICkge1xuXHRcdFx0XHRwcm9taXNlLnRoZW4oIG9wdGlvbnMuY29tcGxldGUuYmluZCggcmFjdGl2ZSApICk7XG5cdFx0XHR9XG5cdFx0XHRyYWN0aXZlLnRyYW5zaXRpb25zRW5hYmxlZCA9IG9wdGlvbnMudHJhbnNpdGlvbnNFbmFibGVkO1xuXHRcdFx0cmFjdGl2ZS5faW5pdGluZyA9IGZhbHNlO1xuXHRcdH07XG5cdH0oIGNvbmZpZ19pc0NsaWVudCwgY29uZmlnX2Vycm9ycywgY29uZmlnX2luaXRPcHRpb25zLCBjb25maWdfcmVnaXN0cmllcywgdXRpbHNfd2FybiwgdXRpbHNfY3JlYXRlLCB1dGlsc19leHRlbmQsIHV0aWxzX2ZpbGxHYXBzLCB1dGlsc19kZWZpbmVQcm9wZXJ0aWVzLCB1dGlsc19nZXRFbGVtZW50LCB1dGlsc19pc09iamVjdCwgdXRpbHNfaXNBcnJheSwgdXRpbHNfZ2V0R3VpZCwgdXRpbHNfUHJvbWlzZSwgc2hhcmVkX2dldF9tYWdpY0FkYXB0b3IsIHBhcnNlX19wYXJzZSApO1xuXG5cdHZhciBleHRlbmRfaW5pdENoaWxkSW5zdGFuY2UgPSBmdW5jdGlvbiggaW5pdE9wdGlvbnMsIHdyYXBNZXRob2QsIGluaXRpYWxpc2UgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24gaW5pdENoaWxkSW5zdGFuY2UoIGNoaWxkLCBDaGlsZCwgb3B0aW9ucyApIHtcblx0XHRcdGluaXRPcHRpb25zLmtleXMuZm9yRWFjaCggZnVuY3Rpb24oIGtleSApIHtcblx0XHRcdFx0dmFyIHZhbHVlID0gb3B0aW9uc1sga2V5IF0sXG5cdFx0XHRcdFx0ZGVmYXVsdFZhbHVlID0gQ2hpbGQuZGVmYXVsdHNbIGtleSBdO1xuXHRcdFx0XHRpZiAoIHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgZGVmYXVsdFZhbHVlID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0XHRcdG9wdGlvbnNbIGtleSBdID0gd3JhcE1ldGhvZCggdmFsdWUsIGRlZmF1bHRWYWx1ZSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoIGNoaWxkLmJlZm9yZUluaXQgKSB7XG5cdFx0XHRcdGNoaWxkLmJlZm9yZUluaXQoIG9wdGlvbnMgKTtcblx0XHRcdH1cblx0XHRcdGluaXRpYWxpc2UoIGNoaWxkLCBvcHRpb25zICk7XG5cdFx0XHRpZiAoIG9wdGlvbnMuX3BhcmVudCAmJiBvcHRpb25zLl9wYXJlbnQuX3JlbmRlcmluZyApIHtcblx0XHRcdFx0b3B0aW9ucy5fcGFyZW50Ll9jaGlsZEluaXRRdWV1ZS5wdXNoKCB7XG5cdFx0XHRcdFx0aW5zdGFuY2U6IGNoaWxkLFxuXHRcdFx0XHRcdG9wdGlvbnM6IG9wdGlvbnNcblx0XHRcdFx0fSApO1xuXHRcdFx0fSBlbHNlIGlmICggY2hpbGQuaW5pdCApIHtcblx0XHRcdFx0Y2hpbGQuaW5pdCggb3B0aW9ucyApO1xuXHRcdFx0fVxuXHRcdH07XG5cdH0oIGNvbmZpZ19pbml0T3B0aW9ucywgZXh0ZW5kX3dyYXBNZXRob2QsIFJhY3RpdmVfaW5pdGlhbGlzZSApO1xuXG5cdHZhciBleHRlbmRfX2V4dGVuZCA9IGZ1bmN0aW9uKCBjcmVhdGUsIGRlZmluZVByb3BlcnRpZXMsIGdldEd1aWQsIGV4dGVuZE9iamVjdCwgaW5oZXJpdEZyb21QYXJlbnQsIGluaGVyaXRGcm9tQ2hpbGRQcm9wcywgZXh0cmFjdElubGluZVBhcnRpYWxzLCBjb25kaXRpb25hbGx5UGFyc2VUZW1wbGF0ZSwgY29uZGl0aW9uYWxseVBhcnNlUGFydGlhbHMsIGluaXRDaGlsZEluc3RhbmNlLCBjaXJjdWxhciApIHtcblxuXHRcdHZhciBSYWN0aXZlO1xuXHRcdGNpcmN1bGFyLnB1c2goIGZ1bmN0aW9uKCkge1xuXHRcdFx0UmFjdGl2ZSA9IGNpcmN1bGFyLlJhY3RpdmU7XG5cdFx0fSApO1xuXHRcdHJldHVybiBmdW5jdGlvbiBleHRlbmQoIGNoaWxkUHJvcHMgKSB7XG5cdFx0XHR2YXIgUGFyZW50ID0gdGhpcyxcblx0XHRcdFx0Q2hpbGQsIGFkYXB0b3IsIGk7XG5cdFx0XHRpZiAoIGNoaWxkUHJvcHMucHJvdG90eXBlIGluc3RhbmNlb2YgUmFjdGl2ZSApIHtcblx0XHRcdFx0Y2hpbGRQcm9wcyA9IGV4dGVuZE9iamVjdCgge30sIGNoaWxkUHJvcHMsIGNoaWxkUHJvcHMucHJvdG90eXBlLCBjaGlsZFByb3BzLmRlZmF1bHRzICk7XG5cdFx0XHR9XG5cdFx0XHRDaGlsZCA9IGZ1bmN0aW9uKCBvcHRpb25zICkge1xuXHRcdFx0XHRpbml0Q2hpbGRJbnN0YW5jZSggdGhpcywgQ2hpbGQsIG9wdGlvbnMgfHwge30gKTtcblx0XHRcdH07XG5cdFx0XHRDaGlsZC5wcm90b3R5cGUgPSBjcmVhdGUoIFBhcmVudC5wcm90b3R5cGUgKTtcblx0XHRcdENoaWxkLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IENoaWxkO1xuXHRcdFx0ZGVmaW5lUHJvcGVydGllcyggQ2hpbGQsIHtcblx0XHRcdFx0ZXh0ZW5kOiB7XG5cdFx0XHRcdFx0dmFsdWU6IFBhcmVudC5leHRlbmRcblx0XHRcdFx0fSxcblx0XHRcdFx0X2d1aWQ6IHtcblx0XHRcdFx0XHR2YWx1ZTogZ2V0R3VpZCgpXG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdGluaGVyaXRGcm9tUGFyZW50KCBDaGlsZCwgUGFyZW50ICk7XG5cdFx0XHRpbmhlcml0RnJvbUNoaWxkUHJvcHMoIENoaWxkLCBjaGlsZFByb3BzICk7XG5cdFx0XHRpZiAoIENoaWxkLmFkYXB0b3JzICYmICggaSA9IENoaWxkLmRlZmF1bHRzLmFkYXB0Lmxlbmd0aCApICkge1xuXHRcdFx0XHR3aGlsZSAoIGktLSApIHtcblx0XHRcdFx0XHRhZGFwdG9yID0gQ2hpbGQuZGVmYXVsdHMuYWRhcHRbIGkgXTtcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiBhZGFwdG9yID09PSAnc3RyaW5nJyApIHtcblx0XHRcdFx0XHRcdENoaWxkLmRlZmF1bHRzLmFkYXB0WyBpIF0gPSBDaGlsZC5hZGFwdG9yc1sgYWRhcHRvciBdIHx8IGFkYXB0b3I7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGNoaWxkUHJvcHMudGVtcGxhdGUgKSB7XG5cdFx0XHRcdGNvbmRpdGlvbmFsbHlQYXJzZVRlbXBsYXRlKCBDaGlsZCApO1xuXHRcdFx0XHRleHRyYWN0SW5saW5lUGFydGlhbHMoIENoaWxkLCBjaGlsZFByb3BzICk7XG5cdFx0XHRcdGNvbmRpdGlvbmFsbHlQYXJzZVBhcnRpYWxzKCBDaGlsZCApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIENoaWxkO1xuXHRcdH07XG5cdH0oIHV0aWxzX2NyZWF0ZSwgdXRpbHNfZGVmaW5lUHJvcGVydGllcywgdXRpbHNfZ2V0R3VpZCwgdXRpbHNfZXh0ZW5kLCBleHRlbmRfaW5oZXJpdEZyb21QYXJlbnQsIGV4dGVuZF9pbmhlcml0RnJvbUNoaWxkUHJvcHMsIGV4dGVuZF9leHRyYWN0SW5saW5lUGFydGlhbHMsIGV4dGVuZF9jb25kaXRpb25hbGx5UGFyc2VUZW1wbGF0ZSwgZXh0ZW5kX2NvbmRpdGlvbmFsbHlQYXJzZVBhcnRpYWxzLCBleHRlbmRfaW5pdENoaWxkSW5zdGFuY2UsIGNpcmN1bGFyICk7XG5cblx0dmFyIFJhY3RpdmVfX1JhY3RpdmUgPSBmdW5jdGlvbiggaW5pdE9wdGlvbnMsIHN2ZywgZGVmaW5lUHJvcGVydGllcywgcHJvdG90eXBlLCBwYXJ0aWFsUmVnaXN0cnksIGFkYXB0b3JSZWdpc3RyeSwgY29tcG9uZW50c1JlZ2lzdHJ5LCBlYXNpbmdSZWdpc3RyeSwgaW50ZXJwb2xhdG9yc1JlZ2lzdHJ5LCBQcm9taXNlLCBleHRlbmQsIHBhcnNlLCBpbml0aWFsaXNlLCBjaXJjdWxhciApIHtcblxuXHRcdHZhciBSYWN0aXZlID0gZnVuY3Rpb24oIG9wdGlvbnMgKSB7XG5cdFx0XHRpbml0aWFsaXNlKCB0aGlzLCBvcHRpb25zICk7XG5cdFx0fTtcblx0XHRkZWZpbmVQcm9wZXJ0aWVzKCBSYWN0aXZlLCB7XG5cdFx0XHRwcm90b3R5cGU6IHtcblx0XHRcdFx0dmFsdWU6IHByb3RvdHlwZVxuXHRcdFx0fSxcblx0XHRcdHBhcnRpYWxzOiB7XG5cdFx0XHRcdHZhbHVlOiBwYXJ0aWFsUmVnaXN0cnlcblx0XHRcdH0sXG5cdFx0XHRhZGFwdG9yczoge1xuXHRcdFx0XHR2YWx1ZTogYWRhcHRvclJlZ2lzdHJ5XG5cdFx0XHR9LFxuXHRcdFx0ZWFzaW5nOiB7XG5cdFx0XHRcdHZhbHVlOiBlYXNpbmdSZWdpc3RyeVxuXHRcdFx0fSxcblx0XHRcdHRyYW5zaXRpb25zOiB7XG5cdFx0XHRcdHZhbHVlOiB7fVxuXHRcdFx0fSxcblx0XHRcdGV2ZW50czoge1xuXHRcdFx0XHR2YWx1ZToge31cblx0XHRcdH0sXG5cdFx0XHRjb21wb25lbnRzOiB7XG5cdFx0XHRcdHZhbHVlOiBjb21wb25lbnRzUmVnaXN0cnlcblx0XHRcdH0sXG5cdFx0XHRkZWNvcmF0b3JzOiB7XG5cdFx0XHRcdHZhbHVlOiB7fVxuXHRcdFx0fSxcblx0XHRcdGludGVycG9sYXRvcnM6IHtcblx0XHRcdFx0dmFsdWU6IGludGVycG9sYXRvcnNSZWdpc3RyeVxuXHRcdFx0fSxcblx0XHRcdGRlZmF1bHRzOiB7XG5cdFx0XHRcdHZhbHVlOiBpbml0T3B0aW9ucy5kZWZhdWx0c1xuXHRcdFx0fSxcblx0XHRcdHN2Zzoge1xuXHRcdFx0XHR2YWx1ZTogc3ZnXG5cdFx0XHR9LFxuXHRcdFx0VkVSU0lPTjoge1xuXHRcdFx0XHR2YWx1ZTogJ3YwLjMuOS0zMTctZDIzZTQwOCdcblx0XHRcdH1cblx0XHR9ICk7XG5cdFx0UmFjdGl2ZS5ldmVudERlZmluaXRpb25zID0gUmFjdGl2ZS5ldmVudHM7XG5cdFx0UmFjdGl2ZS5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBSYWN0aXZlO1xuXHRcdFJhY3RpdmUuUHJvbWlzZSA9IFByb21pc2U7XG5cdFx0UmFjdGl2ZS5leHRlbmQgPSBleHRlbmQ7XG5cdFx0UmFjdGl2ZS5wYXJzZSA9IHBhcnNlO1xuXHRcdGNpcmN1bGFyLlJhY3RpdmUgPSBSYWN0aXZlO1xuXHRcdHJldHVybiBSYWN0aXZlO1xuXHR9KCBjb25maWdfaW5pdE9wdGlvbnMsIGNvbmZpZ19zdmcsIHV0aWxzX2RlZmluZVByb3BlcnRpZXMsIFJhY3RpdmVfcHJvdG90eXBlX19wcm90b3R5cGUsIHJlZ2lzdHJpZXNfcGFydGlhbHMsIHJlZ2lzdHJpZXNfYWRhcHRvcnMsIHJlZ2lzdHJpZXNfY29tcG9uZW50cywgcmVnaXN0cmllc19lYXNpbmcsIHJlZ2lzdHJpZXNfaW50ZXJwb2xhdG9ycywgdXRpbHNfUHJvbWlzZSwgZXh0ZW5kX19leHRlbmQsIHBhcnNlX19wYXJzZSwgUmFjdGl2ZV9pbml0aWFsaXNlLCBjaXJjdWxhciApO1xuXG5cdHZhciBSYWN0aXZlID0gZnVuY3Rpb24oIFJhY3RpdmUsIGNpcmN1bGFyLCBsZWdhY3kgKSB7XG5cblx0XHR2YXIgRlVOQ1RJT04gPSAnZnVuY3Rpb24nO1xuXHRcdHdoaWxlICggY2lyY3VsYXIubGVuZ3RoICkge1xuXHRcdFx0Y2lyY3VsYXIucG9wKCkoKTtcblx0XHR9XG5cdFx0aWYgKCB0eXBlb2YgRGF0ZS5ub3cgIT09IEZVTkNUSU9OIHx8IHR5cGVvZiBTdHJpbmcucHJvdG90eXBlLnRyaW0gIT09IEZVTkNUSU9OIHx8IHR5cGVvZiBPYmplY3Qua2V5cyAhPT0gRlVOQ1RJT04gfHwgdHlwZW9mIEFycmF5LnByb3RvdHlwZS5pbmRleE9mICE9PSBGVU5DVElPTiB8fCB0eXBlb2YgQXJyYXkucHJvdG90eXBlLmZvckVhY2ggIT09IEZVTkNUSU9OIHx8IHR5cGVvZiBBcnJheS5wcm90b3R5cGUubWFwICE9PSBGVU5DVElPTiB8fCB0eXBlb2YgQXJyYXkucHJvdG90eXBlLmZpbHRlciAhPT0gRlVOQ1RJT04gfHwgdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyICE9PSBGVU5DVElPTiApIHtcblx0XHRcdHRocm93IG5ldyBFcnJvciggJ0l0IGxvb2tzIGxpa2UgeW91XFwncmUgYXR0ZW1wdGluZyB0byB1c2UgUmFjdGl2ZS5qcyBpbiBhbiBvbGRlciBicm93c2VyLiBZb3VcXCdsbCBuZWVkIHRvIHVzZSBvbmUgb2YgdGhlIFxcJ2xlZ2FjeSBidWlsZHNcXCcgaW4gb3JkZXIgdG8gY29udGludWUgLSBzZWUgaHR0cDovL2RvY3MucmFjdGl2ZWpzLm9yZy9sYXRlc3QvbGVnYWN5LWJ1aWxkcyBmb3IgbW9yZSBpbmZvcm1hdGlvbi4nICk7XG5cdFx0fVxuXHRcdGlmICggdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93Lk5vZGUgJiYgIXdpbmRvdy5Ob2RlLnByb3RvdHlwZS5jb250YWlucyAmJiB3aW5kb3cuSFRNTEVsZW1lbnQgJiYgd2luZG93LkhUTUxFbGVtZW50LnByb3RvdHlwZS5jb250YWlucyApIHtcblx0XHRcdHdpbmRvdy5Ob2RlLnByb3RvdHlwZS5jb250YWlucyA9IHdpbmRvdy5IVE1MRWxlbWVudC5wcm90b3R5cGUuY29udGFpbnM7XG5cdFx0fVxuXHRcdHJldHVybiBSYWN0aXZlO1xuXHR9KCBSYWN0aXZlX19SYWN0aXZlLCBjaXJjdWxhciwgbGVnYWN5ICk7XG5cblxuXHQvLyBleHBvcnQgYXMgQ29tbW9uIEpTIG1vZHVsZS4uLlxuXHRpZiAoIHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlLmV4cG9ydHMgKSB7XG5cdFx0bW9kdWxlLmV4cG9ydHMgPSBSYWN0aXZlO1xuXHR9XG5cblx0Ly8gLi4uIG9yIGFzIEFNRCBtb2R1bGVcblx0ZWxzZSBpZiAoIHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiBkZWZpbmUuYW1kICkge1xuXHRcdGRlZmluZSggZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gUmFjdGl2ZTtcblx0XHR9ICk7XG5cdH1cblxuXHQvLyAuLi4gb3IgYXMgYnJvd3NlciBnbG9iYWxcblx0Z2xvYmFsLlJhY3RpdmUgPSBSYWN0aXZlO1xuXG5cdFJhY3RpdmUubm9Db25mbGljdCA9IGZ1bmN0aW9uKCkge1xuXHRcdGdsb2JhbC5SYWN0aXZlID0gbm9Db25mbGljdDtcblx0XHRyZXR1cm4gUmFjdGl2ZTtcblx0fTtcblxufSggdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cgOiB0aGlzICkgKTtcbiJdfQ==
;