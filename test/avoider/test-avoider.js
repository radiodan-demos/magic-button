/* globals describe, it, before */
"use strict";

var chai = require("chai"),
    assert = chai.assert,
    sinon  = require("sinon");

var utils = require("radiodan-client").utils;


describe("setup", function(){
  before(function() {
    this.Avoider = require("../../app/avoider/avoider")();
  });

  it("sets avoid type", function(){
    var subject = this.Avoider.create("testService", "avoidTest");

    assert.equal(subject.avoidTopic, "avoidTest");
  });
});

describe("on avoid", function(){
  beforeEach(function() {
    this.services    = { change: sinon.spy(), current: sinon.spy(), get: sinon.spy() };
    this.bbcServices = { once: sinon.spy() };
    function createResolvedStub() {
      return sinon.stub().returns(utils.promise.resolve());
    }
    function createMockPlayer() {
      return {
        play  : createResolvedStub(),
        stop  : createResolvedStub(),
        add   : createResolvedStub()
      };
    }
    this.players = {
      main: createMockPlayer(),
      avoider: createMockPlayer()
    };

    this.Avoider = require("../../app/avoider/avoider")(
      {},
      this.bbcServices
    );
  });

  it("starts avoiding", function(){
    var subject = this.Avoider.create("avoidStation", "testTopic"),
        emitSpy = sinon.spy(),
        avoidCallBack;

    subject.startAvoiding({}, this.players, this.services, emitSpy);

    assert.ok(emitSpy.called);
    assert.ok(emitSpy.calledWith('avoider.start'))
  });
});
