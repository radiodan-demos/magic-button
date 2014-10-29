var utils = require('radiodan-client').utils;

module.exports.create = create;

function create(){
  var exportActions, instance;

  actionsForStates = {standby: {}, online: {}, shutdown: {}};

  instance = {
    cache: {},
    register: register,
    export: function() { return actionsForStates; }
  };

  return instance;

  function register(newAction) {
    validateAction(newAction);

    addToCache(newAction);

    //export state changers to export variable
    exportActions(newAction);
  }

  function validateAction(newAction) {
    var errors = [];

    newAction = newAction || {};
    newAction.states = newAction.states || [];

    if(!newAction.id) {
      errors.push('no id set');
    }

    if(!newAction.action || typeof(newAction.action) != 'function') {
      errors.push('no action function');
    }

    if(newAction.states.length == 0) {
      errors.push('no states set');
    }

    newAction.states.forEach(function(state) {
      if(Object.keys(actionsForStates).indexOf(state) == -1) {
        errors.push('Illegal state name '+state);
      }
    });

    if(errors.length > 0) {
      throw new Error(errors.join(', '));
    }
  }

  function addToCache(newAction) {
    var cachedActions = Object.keys(instance.cache),
        newActionId   = newAction.id;

    if(cachedActions.indexOf(newActionId) > -1) {
      throw new Error('Already cached action ' + newActionId);
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
    var currentActions = Object.keys(actionsForStates[state]),
        actionExists   = currentActions.indexOf(id) > -1;

    if(actionExists) {
      throw new Error('Action '+id+' exists for state '+state);
    } else {
      actionsForStates[state][id] = method;
    }
  }
}
