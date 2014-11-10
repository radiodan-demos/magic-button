var ServicesManager = require(libDir + 'services/manager'),
    EventEmitter    = require('events').EventEmitter;

describe('Services Manager', function() {
  beforeEach(function() {
    this.register = {metadata: function() {}, providerOf: function () { return {}; }};
    this.eventBus = new EventEmitter();
    this.settings = {
      get: function(){ return utils.promise.resolve({})},
      update: function(){ return utils.promise.resolve({})},
      on: function(){}
    };
  });

  it('changes current service', function() {
    var subject = ServicesManager.create(
      this.register, this.eventBus, this.settings);

    subject.change('radio1');
    assert.equal(subject.current(), 'radio1');

    subject.change('my-music');
    assert.equal(subject.current(), 'my-music');
  });

  it('throws if service doesn\'t exist', function() {
    var subject = ServicesManager.create(
      this.register, this.eventBus, this.settings);

    this.register.providerOf = function () {
      return undefined;
    };

    assert.throws(function () {
      subject.change(null);
    });

    assert.throws(function () {
      subject.change('my-80s-music');
    });
  });

  it('current returns default service from settings on creation', function(done) {

    this.settings.get = function () {
      return utils.promise.resolve({ serviceId: 'koolfm' });
    };

    var subject = ServicesManager.create(
      this.register, this.eventBus, this.settings);

    subject.ready.then(function () {
      assert.equal(subject.current(), 'koolfm');
    })
    .then(done, done);
  });

  it('emits new service on eventBus', function() {
    var eventMock = sinon.spy(),
        subject = ServicesManager.create(
          this.register, {emit: eventMock, on: sinon.stub()}, this.settings);

    subject.change('radio3');
    assert.deepEqual(['service.id', 'radio3'], eventMock.args[0]);
  });

  it('emits metadata on eventBus', function() {
    var eventMock = sinon.spy(),
        metadataMock = sinon.stub(),
        registerMock = sinon.stub().returns(metadataMock),
        subject;

    this.register.metadata = registerMock;

    subject = ServicesManager.create(
            this.register,
            {emit: eventMock, on: sinon.stub()}, this.settings);

    subject.change('my-music');
    assert.deepEqual(['my-music'], registerMock.args[0]);
    assert.deepEqual(['service.changed', metadataMock], eventMock.args[1]);
  });

  it('loops through services using #next', function(done) {
    var preferredServices = ['radio1', 'radio2', 'radio3'],
        servicesMock = sinon.stub().returns(
          utils.promise.resolve({preferredServices: preferredServices})),
        settings = {get: servicesMock, update: this.settings.update, on: function () {}},
        subject = ServicesManager.create(
          this.register, this.eventBus, settings);

    subject.change('radio2');
    assert.equal(subject.current(), 'radio2');

    assert.eventually.equal(subject.next(), 'radio3')
      .then(function() {
        subject.change('radio3');
        return assert.eventually.equal(subject.next(), 'radio1');
      })
    .then(done, done);
  });

  it('fetches initial service from settings', function (done) {
    var settings = new EventEmitter(),
        subject;

    settings.get = function () { return utils.promise.resolve({ serviceId: 'radio4' }) };

    subject = ServicesManager.create(
          this.register, this.eventBus, settings);

    subject.ready.then(function () {
      assert.equal(subject.default, 'radio4');
    }).then(done, done);
  });

  it('tracks changes to service settings', function () {
    var settings = new EventEmitter(),
        subject;

    settings.get = function () { return utils.promise.resolve({}) };

    subject = ServicesManager.create(
          this.register, this.eventBus, settings);

    settings.emit('update', { serviceId: 'radio1' });
    assert.equal(subject.default, 'radio1');

    settings.emit('update', { serviceId: 'radio2' });
    assert.equal(subject.default, 'radio2');
  });
});
