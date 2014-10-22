var ServicesRegister = require('../../lib/services/register');

describe('ServicesRegister', function(){
  it('registers a service provider', function(done){
    var subject = ServicesRegister.create(),
        servicesPromise = utils.promise.resolve([]),
        fetchServices = function() { return servicesPromise; },
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
        servicesPromise = utils.promise.resolve(['testService']),
        fetchServices = function() { return servicesPromise;},
        source  = { id: 'testSource', fetchServices: fetchServices };

    var promise = subject.register(source);

    assert.isFulfilled(promise)
      .then(function(){
        assert.deepEqual(subject.services(), ['testService'])
      })
      .then(done, done);
  });

  it('prevents a provider from being registered twice', function(done) {
     var subject = ServicesRegister.create(),
        servicesPromise = utils.promise.resolve(['testService']),
        fetchServices = function() { return servicesPromise;},
        source  = { id: 'testSource', fetchServices: fetchServices },
        firstRegister, secondRegister;

    firstRegister = subject.register(source);

    assert.isFulfilled(firstRegister).then(function() {
      secondRegister = subject.register(source);

      return assert.isRejected(secondRegister,
        /Provider testSource already registered/).notify(done);
    });
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

  it('defers metadata requests to service provider', function(done) {
    var subject = ServicesRegister.create(),
        servicesPromise = utils.promise.resolve(['testService']),
        fetchServices = function() { return servicesPromise;},
        metadataSpy = sinon.spy(),
        source  = {
          id: 'testSource', fetchServices: fetchServices,
          metadata: metadataSpy
        },
        firstRegister, secondRegister;

    register = subject.register(source);

    assert.isFulfilled(register).then(function() {
      subject.metadata('testService');
      assert.equal(metadataSpy.callCount, 1);
    }).then(done,done);
  });

  it('collects all station metadata from providers', function(done) {
    var subject = ServicesRegister.create(),
    radio1 = {stations: function() { return utils.promise.resolve(['radio1'])}},
    radio2 = {stations: function() { return utils.promise.resolve(['radio2', 'radio3'])}};

    subject._providers = {radio1: radio1, radio2: radio2};

    assert.eventually.deepEqual(
      subject.stations(), ['radio1', 'radio2', 'radio3'])
      .notify(done);
  });
});
