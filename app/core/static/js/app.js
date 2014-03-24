console.log('Core app started');

var volume = require('./controls/volume')('default');
var volumeUi = require('./ui/volume')('.volume input');

volume.on('volume', function (value) {
  volumeUi.set({ volume: value });
});

volumeUi.on('volume', function (value) {
  volume.set({ value: value });
});

var eventSource = new EventSource('/events');

eventSource.addEventListener('nowPlaying', function (evt) {
  var data = JSON.parse(evt.data);
  console.log('Now Playing for %o:', data.service, data);
});
