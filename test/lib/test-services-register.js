/* globals describe, it, before */
'use strict';

var chai = require('chai'),
    assert = chai.assert,
    chaiAsPromised = require('chai-as-promised'),
    sinon  = require('sinon');

var utils = require('radiodan-client').utils;

var ServicesRegister = require('../../lib/services-register');

chai.use(chaiAsPromised);

describe('ServicesRegister', function(){
  it('registers a service provider', function(done){
    var subject = ServicesRegister.create(),
        fetchServices = function() { return utils.promise.resolve([]);},
        source  = { id: 'testSource', fetchServices: fetchServices };

    var promise = subject.register(source);

    assert.isFulfilled(promise)
      .then(function(){
        assert.deepEqual(['testSource'], Object.keys(subject._providers))
      })
      .then(done, done);
  });

  it('registers services to a provider', function(done) {
    var subject = ServicesRegister.create(),
        fetchServices = function() { return utils.promise.resolve(['testService']);},
        source  = { id: 'testSource', fetchServices: fetchServices };

    var promise = subject.register(source);

    assert.isFulfilled(promise)
      .then(function(){
        assert.deepEqual(subject.services(), ['testService'])
      })
      .then(done, done);
  });

  it('prevents a service from being registered twice', function(done) {
     var subject = ServicesRegister.create(),
        servicesPromise = utils.promise.resolve(['testService']),
        fetchServices = function() { return servicesPromise;},
        source  = { id: 'testSource', fetchServices: fetchServices },
        firstRegister, secondRegister;

    firstRegister = subject.register(source);

    assert.isFulfilled(firstRegister).then(function() {
      source.id = 'anotherSource';

      secondRegister = subject.register(source);

      return assert.isRejected(secondRegister).notify(done);
    });
 });
});
