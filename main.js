var express        = require('express'),
    http           = require('http'),
    swig           = require('swig'),
    radiodanClient = require('radiodan-client'),
    logger         = radiodanClient.utils.logger(__filename),
    eventBus       = require('./lib/event-bus').create(),
    Settings       = require('./lib/settings').create(eventBus),
    services       = require('./lib/services').create(
                       eventBus, Settings.get('radio')
                     ),
    device         = require('./lib/device').create(services, eventBus),
    app            = module.exports = express(),
    port           = (process.env.PORT || 5000);

app.engine('html', swig.renderFile);
app.set('view engine', 'html');

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

if ('development' == process.env.NODE_ENV) {
  swig.setDefaults({ cache: false });
}

logger.info('ENVIRONMENT', process.env.NODE_ENV);

app.use(require('errorhandler')({
  dumpExceptions: true,
  showStack: true
}));

app.use(require('body-parser')());
app.use(require('method-override')())
app.use(require('serve-static')(__dirname + '/public'));
app.use(require('morgan')('dev'));

app.use('/announcer',
  require('./app/announcer/routes')(
    express.Router(), device, Settings.get('announcer')
  )
);

app.use('/avoider',
  require('./app/avoider/routes')(
    express.Router(), device, Settings.get('avoider'), eventBus
  )
);

app.use('/events',
  require('./app/events/routes')(
    express.Router(), eventBus, services
  )
);

app.use('/magic-button',
  require('./app/magic-button/routes')(
    express.Router(), device, Settings.get('magic-button')
  )
);

app.use('/radio',
  require('./app/radio/routes')(
    express.Router(), eventBus,
    device, services, Settings.get('radio')
  )
);

app.use('/',
  require('./app/ui/routes')(
    express.Router()
  )
);

http.createServer(app).listen(port);
logger.info('Started server on port', port);
