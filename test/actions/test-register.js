var ActionRegister = require(libDir + '/actions/register');

describe('Action Register', function() {
  beforeEach(function() {
    this.subject = ActionRegister.create();
    this.actionStub = sinon.stub();
    this.action = {
      name: 'newAction',
      events: [{
        name: 'newAction', action: this.actionStub, states: ['online']
      }]
    };
  });

  it('accepts actions to register', function(){
    var action = this.action;

    this.subject.register(action);
    assert.deepEqual(this.subject.cache, {'newAction': action});
  });

  it('exports actions to an object for use with state', function(){
    var action = this.action,
        exportedActions;

    this.subject.register(action);
    exportedActions = this.subject.export();

    assert.deepEqual(
      exportedActions['online'],
      {'newAction': this.actionStub}
    );

    assert.deepEqual(
      exportedActions['standby'],
      {}
    );

    assert.deepEqual(
      exportedActions['shutdown'],
      {}
    );
  });

  it('denies actions with same id', function() {
    var action1 = this.action,
        action2 = utils.mergeObjects(this.action),
        subject = this.subject;

    function registerAction1() {
      return subject.register(action1);
    }

    function registerAction2() {
      return subject.register(action2);
    }

    assert.doesNotThrow(registerAction1);
    assert.throws(registerAction2, /Already cached action newAction/);
  });

  it('denies actions for undefined states', function() {
    var action = this.action
        subject = this.subject;

    action.events[0].states = ['notARealState'];

    function registerAction() {
      subject.register(action);
    }

    assert.throws(registerAction, /Illegal state name notARealState/);
  });
});
