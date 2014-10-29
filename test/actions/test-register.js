var ActionRegister = require(libDir + '/actions/register');

describe('Action Register', function() {
  beforeEach(function() {
    this.subject = ActionRegister.create();
  });

  it('accepts actions to register', function(){
    var action = {
      id: 'newAction', action: sinon.stub(), states: ['online']
    };

    this.subject.register(action);
    assert.deepEqual(this.subject.cache, {'newAction': action});
  });

  it('exports actions to an object for use with state', function(){
    var action = {
      id: 'newAction', action: sinon.stub(), states: ['standby', 'online']
    }, exportedActions;

    this.subject.register(action);
    exportedActions = this.subject.export();

    assert.deepEqual(
      exportedActions['standby'],
      {'newAction': action.action}
    );

    assert.deepEqual(
      exportedActions['online'],
      {'newAction': action.action}
    );

    assert.deepEqual(
      exportedActions['shutdown'],
      {}
    );
  });

  it('denies actions with same id', function() {
    var action1 = {id: 'testAction', action: sinon.stub(), states: ['online']},
        action2 = {id: 'testAction', action: sinon.stub(), states: ['standby']}
        subject = this.subject;

    function registerAction1() {
      return subject.register(action1);
    }

    function registerAction2() {
      return subject.register(action2);
    }

    assert.doesNotThrow(registerAction1);
    assert.throws(registerAction2, /Already cached action testAction/);
  });

  it('denies actions for undefined states', function() {
    var action = {id: 'badAction', states: ['notARealState']},
        subject = this.subject;

    function registerAction() {
      subject.register(action);
    }

    assert.throws(registerAction, /Illegal state name notARealState/);
  });
});
