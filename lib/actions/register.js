var utils = require('radiodan-client').utils;

module.exports.create = create;

function create(){
  var exportActions, instance;

  exportActions = {standby: {}, online: {}, shutdown: {}};

  instance = {
    cache: {},
    register: register,
    export: function() { return exportActions }
  };

  return instance;

  function register(newAction) {
    addToCache(newAction);

    //export state changers to export variable
    exportActions(newAction);
  }

  function addToCache(newAction) {
    var cachedActions = Object.keys(instance.cache),
        newActionId   = newAction.id;

    if(cachedActions.indexOf(newActionId) > -1) {
      throw new Error("Already cached action " + newActionId);
    } else {
      instance.cache[newActionId] = newAction;
    }
  }

  function exportActions(newAction) {
    newAction.states.each(function(state) {
      exportActionForState(state, newAction.action);
    });
  }

  function exportActionForState(state, method) {
    console.log('exportActionForState', state, method);
  }
}
