/* globals describe, it, before */
"use strict";

var chai    = require("chai"),
    assert  = chai.assert,
    sinon   = require("sinon"),
    request = require("supertest"),
    express = require("express"),
    routes  = require("../../app/avoider/routes"),
    mockRD  = {player: {get: function(){}}},
    app     = express();

app.use("/", routes(express.Router(), mockRD));

var utils = require("radiodan-client").utils;

describe("index", function(){
  it("does whatever that is", function(done){
    request(app)
      .get("/")
      .expect(200)
      .expect(/THIS IS AVOID HOMEPGE/, done);
  });
});

describe("avoid", function(){
  it("starts the avoider");
  it("redirects to index");
});

describe("settings", function(){
  it("saves settings to persistence");
  it("redirects to index");
});
