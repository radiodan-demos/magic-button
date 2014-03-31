/* jshint white: false, latedef: nofunc, browser: true, devel: true */
'use strict';

var Promise = Promise || require('es6-promise').Promise;

module.exports = xhr;

['get', 'delete', 'post', 'put'].forEach(function (method) {
  module.exports[method] = function() {
    var args = Array.prototype.slice.call(arguments),
        newArgs = [method].concat(args);

    return xhr.apply(null, newArgs);
  };
});

/*
  XHR implementation from:
    http://www.html5rocks.com/en/tutorials/es6/promises/#toc-promisifying-xmlhttprequest
*/
function xhr(method, url, opts) {
  opts = opts || {};

  method = method ? method.toUpperCase() : 'GET';
  // Return a new promise.
  return new Promise(function(resolve, reject) {
    // Do the usual XHR stuff
    var req = new XMLHttpRequest();
    req.open(method, url);

    // Send headers
    if (opts.headers) {
      Object.keys(opts.headers).forEach(function (header) {
        req.setRequestHeader(header, opts.headers[header]);
      });
    }

    req.onload = function() {
      // This is called even on 404 etc
      // so check the status
      if (req.status === 200) {
        // Resolve the promise with the response text
        resolve(req.response);
      }
      else {
        // Otherwise reject with the status text
        // which will hopefully be a meaningful error
        reject(new Error(req.statusText));
      }
    };

    // Handle network errors
    req.onerror = function() {
      reject(new Error('Network Error'));
    };

    // Make the request
    req.send(opts.data);
  });
}
