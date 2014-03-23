/* globals describe, it, before */
"use strict";

var chai = require("chai"),
    assert = chai.assert,
    chaiAsPromised = require("chai-as-promised"),
    sinon  = require("sinon");

var utils = require("radiodan-client").utils;

chai.use(chaiAsPromised);

var BBCServices = require("../../lib/bbc-services");

describe("cache", function(){
  it("stores data", function(){
    var data = {a: "b"},
        subject = BBCServices.create();

    subject.cacheStore("station1", "data", data);

    assert.equal(subject.cache["station1"]["data"], data);
  });
});

describe("on eventstream", function(){
  beforeEach(function() {
    var noOp = function(){},
        nullLog = {error: noOp, debug: noOp, warn: noOp};

    this.subject = BBCServices.create(nullLog),
    this.eventMock = {};

    this.subject.listenForEvents(this.eventMock);
  });

  it("stores data in cache", function(){
    var self = this,
        data = {service: "radio1", topic: "liveData", data: {"a": "b"}},
        cached;

    this.eventMock.onmessage({data: JSON.stringify(data)});

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

    self.subject.once("1xtra/nowPlaying", function(emitData) {
      assert.deepEqual(data.data, emitData);

      topicPromise.resolve();
    });

    this.eventMock.onmessage({data: JSON.stringify(data)});

    assert.isFulfilled(stationPromise.promise)
      .then(function(){
        return assert.isFulfilled(topicPromise.promise);
      })
      .then(done,done);
  });
});
