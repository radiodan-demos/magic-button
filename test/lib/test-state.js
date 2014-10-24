var State = require(libDir + 'state');

describe('state', function() {
  beforeEach(function() {
    this.subject = State.create();
  });

  it('has a default state of standby', function() {
    assert.equal(this.subject.state, 'standby');
  });

  describe('standby', function() {
    beforeEach(function() {
      this.subject.state = 'standby';
    });

    it('transistions to online', function(){
      this.subject.handle('power');
      assert.equal(this.subject.state, 'online');
    });

    it('transistions to shutdown', function(){
      this.subject.handle('shutdown');
      assert.equal(this.subject.state, 'shutdown');
    });
  });

  describe('online', function() {
    beforeEach(function() {
      this.subject.state = 'online';
    });

    it('transistions to standby', function() {
      this.subject.handle('standby');
      assert.equal(this.subject.state, 'standby');
    });

    it('transistions to shutdown', function(){
      this.subject.handle('shutdown');
      assert.equal(this.subject.state, 'shutdown');
    });
  });

  describe('shutdown', function() {
    beforeEach(function() {
      this.subject.state = 'shutdown';
    });

    it('cannot transition', function(){
      this.subject.handle('online');
      assert.equal(this.subject.state, 'shutdown');
    });
  });
});
