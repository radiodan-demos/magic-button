var Ractive = require('ractive'),
    moment  = require('moment');

var helpers = Ractive.defaults.data;

helpers.formatTime = function(timeString){
  return moment(timeString).format("HH:mm");
}