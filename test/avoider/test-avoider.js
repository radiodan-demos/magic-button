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

    assert.equal("avoidTest", subject.avoidTopic);
  });

  it("guess avoid type from service", function(){
    var subject = this.Avoider.create("radio1");
    assert.equal("nowPlaying", subject.avoidTopic);

    var subject = this.Avoider.create("radio4");
    assert.equal("nowAndNext", subject.avoidTopic);
  });
});

describe("on avoid", function(){
  beforeEach(function() {
    this.bbcServices = { once: sinon.spy() };
    this.mainPlayer = { play: sinon.spy(), stop: sinon.spy() };
    this.avoidPlayer = { play: sinon.spy(), stop: sinon.spy() };

    this.Avoider = require("../../app/avoider/avoider")(
      this.bbcServices,
      this.mainPlayer,
      this.avoidPlayer
    );
  });

  it("emits events as it avoids", function(done){
    var self = this,
        begin = false,
        subject = self.Avoider.create("testStation", "testTopic"),
        avoidCallBack;

    subject.once("begin", function(){
      assert.equal(1, self.mainPlayer.stop.callCount);
      assert.equal(1, self.avoidPlayer.play.callCount);
      assert.equal(0, self.mainPlayer.play.callCount);
      assert.equal(0, self.avoidPlayer.stop.callCount);
      begin = true;
    });

    subject.once("end", function(){
      assert.equal(1, self.mainPlayer.play.callCount);
      assert.equal(1, self.avoidPlayer.stop.callCount);

      if(begin){
        done();
      }
    });

    subject.avoid();

    assert.ok(self.bbcServices.once.calledWith("testStation/testTopic"));

    avoidCallBack = self.bbcServices.once.args[0][1];
    avoidCallBack();
  });
});
