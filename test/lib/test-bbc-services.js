var BBCServices = require("../../lib/services/bbc-services");

describe("BBC Services", function() {
  it("has a provider id", function() {
    var subject = BBCServices.create();

    assert.equal(subject.id, 'bbc-services');
  });

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

      subject.ready = utils.promise.resolve();

      this.subject = subject;
    });

    it("returns a services list", function(done){
      var subject = this.subject,
          promise = subject.fetchServices();

      assert.becomes(promise, ["radio1", "radio2"]).notify(done);
    });

    it("returns metadata for all services", function(){
      var subject = this.subject;

      assert.deepEqual(
          [{id: "radio1", a: 1}, {id: "radio2", b: 2}],
          subject.metadata()
          );
    });

    it("returns data for a specific service", function(){
      var subject = this.subject,
      data    = this.data;

      assert.deepEqual({a:1}, subject.metadata("radio1"));
    });

    it("returns null when service is not found", function(){
      var subject = this.subject;

      assert.equal(null, subject.metadata("NOSERVICE"));
    });
  });

  describe("playlists", function() {
    before(function() {
      var subject = BBCServices.create();

      subject.cacheStore("radio1",
          "audioStreams", [{url: 'http://playlist'}]);

      subject.ready = utils.promise.resolve();
      this.subject = subject;
    });

    it("returns a playlist for a given station", function() {
      assert.equal(this.subject.playlist("radio1"), 'http://playlist');
    });
  });

  describe("on eventstream", function(){
    beforeEach(function() {
      this.subject = BBCServices.create();
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
});
