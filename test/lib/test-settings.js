var Settings = require('../../lib/settings');

beforeEach(function() {
  this.options  = { inMemoryOnly: true };
  this.defaults = { station: false, avoidType: 'programme' };
  this.subject = Settings.create(null, this.options).get(
    'avoider',
    this.defaults
  );
});

describe('settings', function(){
  it('stores a settings object', function(done){
    var subject = this.subject,
        data    = { station: 'radio1', avoidType: 'track' },
        set;

    set = subject.set(data);

    assert.isFulfilled(set).then(function(updated){
      assert.equal(1, updated);
    }).then(done,done);
  });

  it('fetches a stored object', function(done){
    var subject = this.subject,
        data    = { station: 'radio2', avoidType: 'track' },
        get;

    get = subject.set(data).then(subject.get);

    assert.isFulfilled(get).then(function(settings){
      assert.deepEqual(settings, data);
    }).then(done,done);
  });

  it('Emits when data changes', function(done){
    var mockEmitter = {emit: sinon.spy()},
        subject = Settings.create(mockEmitter, this.options).get(
          'avoider',
          this.defaults
        ),
        data = { station: 'radio2', avoidType: 'track' },
        get;

    get = subject.set(data).then(subject.get);

    assert.isFulfilled(get).then(function(){
      assert.ok(mockEmitter.emit.calledWith('settings.avoider', data));
    }).then(done,done);
  });

  it('rejects objects without required keys', function(done){
    var subject = this.subject,
        data    = { wrongKey: 'yes' },
        set;

    set = subject.set(data);

    assert.isRejected(set, Error).then(done,done);
  });

  it('allows a partial update of data', function(done){
    var mockEmitter = {emit: sinon.spy()},
        subject = Settings.create(mockEmitter, this.options).get(
          'avoider',
          this.defaults
        ),
        data = { station: '6music' },
        get;

    get = subject.update(data).then(subject.get);

    assert.isFulfilled(get).then(function(settings){
      assert.equal(settings.avoidType, 'programme');
      assert.equal(settings.station,   '6music');
    }).then(done,done);
  });

  it('returns a default object if nothing is found', function(done){
    var subject = this.subject,
        settingsPromise = subject.get();

    assert.isFulfilled(settingsPromise).then(function(settings) {
      assert.deepEqual(
        settings,
        { station: false, avoidType: 'programme' }
      );
    }).then(done, done);
  });
});
