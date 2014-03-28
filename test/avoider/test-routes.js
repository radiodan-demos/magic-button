/* globals describe, it, before */
"use strict";

var chai     = require("chai"),
    assert   = chai.assert,
    swig     = require("swig"),
    sinon    = require("sinon"),
    request  = require("supertest"),
    express  = require("express"),
    routes   = require("../../app/avoider/routes"),
    settings = require("../../lib/settings").create(null, { inMemoryOnly: true }),
    app      = express();

app.engine("html", swig.renderFile);
app.set("view engine", "html");

app.use("/", routes(express.Router(), {}, {}, settings));

var utils = require("radiodan-client").utils;

describe("/avoider", function(){
  describe("/index", function(){
    it("does whatever that is", function(done){
      request(app)
      .get("/")
      .expect(200)
      .expect(/THIS IS AVOID HOMEPGE/, done);
    });
  });

  describe("/avoid", function(){
    it("starts the avoider");
    it("redirects to index");
  });

  describe("/settings", function(){
    it("saves settings to persistence");
    it("redirects to index");
  });
});
