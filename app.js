/*jslint nodejs: true*/

var express = require('express'),
    iefix = require('express-ie-cors'),
    bodyParser = require('body-parser'),
    cors = require('cors'),
    routes = require('./routes'),
    config = require('./config'),
    app = module.exports = express();

app.use(iefix({ contentType: 'application/x-www-form-urlencoded' }));
app.use(bodyParser.json());
app.use(cors());

var key;
for (key in routes) {
  if (routes.hasOwnProperty(key)) {
    routes[key](app);
  }
}

if (!module.parent) {
  var port = config.get('port');
  app.listen(port, function() {
    console.log('Listening on %d.', port);
  });
}

