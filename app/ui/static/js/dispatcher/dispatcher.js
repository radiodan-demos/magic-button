
var _ = require('underscore'),
    Dispatcher = require('../lib/flux').Dispatcher,
    Constants  = require('../constants/constants');

module.exports = _.extend(new Dispatcher(), {
  handleServerAction: function(action) {
    var payload = {
      source: Constants.Payload.SERVER_ACTION,
      action: action
    };
    this.dispatch(payload);
  },
  handleViewAction: function(action) {
    var payload = {
      source: Constants.Payload.VIEW_ACTION,
      action: action
    };
    this.dispatch(payload);
  }
});