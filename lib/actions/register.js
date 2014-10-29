var utils = require('radiodan-client').utils;

module.exports.create = create;

function create(){
  var exportActions, instance;

  exportActions = {standby: {}, online: {}, shutdown: {}};

  instance = {
    cache: {},
    register: register,
    export: function() { return exportActions; }
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
    newAction.states.forEach(function(state) {
      exportActionForState(state, newAction.id, newAction.action);
    });
  }

  function exportActionForState(state, id, method) {
    var actionsForState = Object.keys(exportActions[state]),
        actionExists    = actionsForState.indexOf(id) > -1;

    if(actionExists) {
      throw new Error('Action '+id+' exists for state '+state);
    } else {
      exportActions[state][id] = method;
    }
  }
}
