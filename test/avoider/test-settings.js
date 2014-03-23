/* globals describe, it, before */
"use strict";

var chai = require("chai"),
    assert = chai.assert,
    chaiAsPromised = require("chai-as-promised"),
    sinon  = require("sinon");

var utils = require("radiodan-client").utils;

var Settings = require("../../app/avoider/settings");

chai.use(chaiAsPromised);

beforeEach(function() {
  var options  = { inMemoryOnly: true };
  this.subject = Settings.create(options);
});

describe("settings", function(){
  it("stores a settings object", function(done){
    var subject = this.subject,
        data    = { station: "radio1", avoidType: "track" },
        set;

    set = subject.set(data);

    assert.isFulfilled(set).then(function(updated){
      assert.equal(1, updated);
    }).then(done,done);
  });

  it("fetches a stored object", function(done){
    var subject = this.subject,
        data    = { station: "radio2", avoidType: "track" },
        get;

    get = subject.set(data).then(subject.get);

    assert.isFulfilled(get).then(function(settings){
      assert.deepEqual(data, settings);
    }).then(done,done);
  });

  it("returns a default object if nothing is found", function(done){
    var subject = this.subject,
        settingsPromise = subject.get();

    assert.isFulfilled(settingsPromise).then(function(settings) {
      assert.deepEqual(
        { station: false, avoidType: "programme" },
        settings
      );
    }).then(done, done);
  });
});
