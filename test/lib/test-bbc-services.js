var BBCServices = require("../../lib/services/bbc-services");

describe("cache", function(){
  it("stores data", function(){
    var data = {a: "b"},
        subject = BBCServices.create();

    subject.cacheStore("station1", "data", data);

    assert.equal(subject.cache["station1"]["data"], data);
  });
});

describe("fetch service data", function(){
  beforeEach(function(){
    var subject = BBCServices.create();

    subject.cacheStore("radio1", "a", 1);
    subject.cacheStore("radio2", "b", 2);

    this.subject = subject;
  });

  it("returns data for all services", function(){
    var subject = this.subject;

    assert.deepEqual(
      [{id: "radio1", a: 1}, {id: "radio2", b: 2}],
      subject.get()
    );
  });

  it("returns data for a specific service", function(){
    var subject = this.subject,
        data    = this.data;

    assert.deepEqual({a:1}, subject.get("radio1"));
  });

  it("returns null when service is not found", function(){
    var subject = this.subject;

    assert.equal(null, subject.get("NOSERVICE"));
  });
});

describe("on eventstream", function(){
  beforeEach(function() {
    var noOp = function(){},
        nullLog = {error: noOp, debug: noOp, warn: noOp};

    this.subject = BBCServices.create(nullLog),
    this.eventMock = new EventEmitter();
    this.eventMock.addEventListener = this.eventMock.on;

    this.subject.listenForEvents(this.eventMock);
  });

  it("stores data in cache", function(){
    var self = this,
        data = {service: "radio1", topic: "liveData", data: {"a": "b"}},
        cached;

    this.eventMock.emit('message', {data: JSON.stringify(data)});

    cached = self.subject.cache["radio1"]["liveData"];
    assert.deepEqual(data.data, cached);
  });

  it("emits events from recieved topic", function(done){
    var self = this,
        data = {service: "1xtra", topic: "nowPlaying", data: {"a": "b"}},
        stationPromise = utils.promise.defer(),
        topicPromise = utils.promise.defer();

    self.subject.once("1xtra", function(topic, emitData) {
      assert.deepEqual(data.topic, topic);
      assert.deepEqual(data.data, emitData);

      stationPromise.resolve();
    });

    self.subject.once("1xtra.nowPlaying", function(emitData) {
      assert.deepEqual(data.data, emitData);

      topicPromise.resolve();
    });

    this.eventMock.emit('message', {data: JSON.stringify(data)});

    assert.isFulfilled(stationPromise.promise)
      .then(function(){
        return assert.isFulfilled(topicPromise.promise);
      })
      .then(done,done);
  });
});
