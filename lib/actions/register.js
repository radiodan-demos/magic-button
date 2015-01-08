var utils = require('radiodan-client').utils;

module.exports.create = create;

function create(){
  var exportActions, instance;

  actionsForStates = {standby: {}, online: {}, shutdown: {}};

  instance = {
    cache: {},
    register: register,
    parse: parse,
    export: function() { return actionsForStates; }
  };

  return instance;

  function register(newAction) {
    validateAction(newAction);

    addToCache(newAction);

    //export state changers to export variable
    exportActions(newAction);
  }

  function parse(actionState) {
    var parts = actionState.split(':');
    if (parts.length == 1) {
      return {
        isAtomic: true,
        name: parts[0]
      };
    }
  }

  function validateAction(newAction) {
    var errors = [];

    newAction = newAction || {};
    newAction.events = newAction.events || [];

    if(!newAction.name) {
      errors.push('no name set');
    }

    if(!newAction.events || newAction.events.length == 0) {
      errors.push('no events found');
    }

    newAction.events.forEach(function(thisEvent) {
      var eventErrors = validateEvent(thisEvent);
      errors = errors.concat(eventErrors);
    });

    if(errors.length > 0) {
      throw new Error(errors.join(', '));
    }
  }

  function validateEvent(thisEvent) {
    var errors = [];
    thisEvent = thisEvent || {};
    thisEvent.states = thisEvent.states || [];

    if(thisEvent.states.length == 0) {
      errors.push('No states found for event');
    }

    thisEvent.states.forEach(function(state) {
      if(Object.keys(actionsForStates).indexOf(state) == -1) {
        errors.push('Illegal state name '+state);
      }
    });

    if(!thisEvent.name) {
      errors.push('No name for event');
    }

    if(!thisEvent.action || typeof thisEvent.action != 'function') {
      errors.push('No action function for event');
    };

    return errors;
  }

  function addToCache(newAction) {
    var cachedActions = Object.keys(instance.cache),
        newActionKey  = newAction.name;

    if(cachedActions.indexOf(newActionKey) > -1) {
      throw new Error('Already cached action ' + newActionKey);
    } else {
      instance.cache[newActionKey] = newAction;
    }
  }

  function exportActions(newAction) {
    newAction.events.forEach(function(thisEvent) {
      thisEvent.states.forEach(function(state) {
        exportEventForState(state, thisEvent.name, thisEvent.action);
      });
    });
  }

  function exportEventForState(state, name, method) {
    var currentActions = Object.keys(actionsForStates[state]),
        actionExists   = currentActions.indexOf(name) > -1;

    if(actionExists) {
      throw new Error('Action '+name+' exists for state '+state);
    } else {
      actionsForStates[state][name] = method;
    }
  }
}
