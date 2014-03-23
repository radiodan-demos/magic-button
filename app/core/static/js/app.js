console.log('Core app started');

var audio = radiodan.audio.create('default');

var volEl = document.querySelector('.volume input');
volEl.addEventListener('click', function (evt) {
  var value = volEl.value;
  audio.volume({ value: value });
});
