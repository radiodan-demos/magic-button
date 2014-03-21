/* globals describe, it, before */
"use strict";

var chai = require("chai"),
    assert = chai.assert,
    chaiAsPromised = require("chai-as-promised"),
    sinon  = require("sinon");

var utils = require("radiodan-client").utils;

chai.use(chaiAsPromised);

var BBCServices = require("../../lib/bbc-services");

describe("cache", function (){
  it("stores data", function() {
    var data = {a: "b"}, subject = BBCServices.create();

    subject.cacheStore("station1", "data", data);

    assert.equal(subject.cache["station1"]["data"], data);
  });
});
