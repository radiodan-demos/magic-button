var ServicesManager = require(libDir + 'services/manager'),
    EventEmitter    = require('events').EventEmitter;

describe('Services Manager', function() {
  beforeEach(function() {
    this.register = {metadata: function() {}};
    this.eventBus = new EventEmitter();
    this.settings = {
      get: function(){ return utils.promise.resolve({})},
      update: function(){ return utils.promise.resolve({})}
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
        subject = ServicesManager.create(
            {metadata: registerMock},
            {emit: eventMock, on: sinon.stub()}, this.settings);

    subject.change('my-music');
    assert.deepEqual(['my-music'], registerMock.args[0]);
    assert.deepEqual(['service.changed', metadataMock], eventMock.args[1]);
  });

  it('loops through services using #next', function(done) {
    var preferredServices = ['radio1', 'radio2', 'radio3'],
        servicesMock = sinon.stub().returns(
          utils.promise.resolve({preferredServices: preferredServices})),
        settings = {get: servicesMock, update: this.settings.update},
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
});
