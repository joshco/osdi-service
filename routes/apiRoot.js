
var config = require('../config');

function apiRoot(req, res) {
  var root = config.get('apiEndpoint');
  var answer = {
    motd: 'Welcome to the NGP VAN OSDI Service!',
    max_pagesize: 200,
    vendor_name: 'NGP VAN, Inc.',
    product_name: 'VAN',
    osdi_version: '1.0.3',
    _links: {
      "curies":[
        {"name":"osdi","href":"http://opensupporter.github.io/osdi-docs/{rel}","templated":true}
        ],
      self: {
        href: root,
        title: 'NGP VAN OSDI Service Entry Point'
      },
      'osdi:tags': {
        'href': root + 'tags',
        'title': 'The collection of tags in the system'
      },
      'osdi:questions': {
        'href': root + 'questions',
        'title': 'The collection of questions in the system'
      },
      'osdi:people': {
        'href': root + 'people',
        'title': 'The collection of people in the system'
      },
      'osdi:person_signup_helper': {
          'href': root + 'people/person_signup_helper',
          'title': 'The person signup helper for the system'
      },
      'osdi:scripts' : {
          'href': root + 'scripts',
          'title': 'The collection of scripts in the system'
      },
      'osdi:events' : {
        'href': root + 'events',
        'title': 'The collection of events in the system'
      }

    }
  };

  return res.status(200).send(answer);
}


module.exports = function (app) {
  app.get('/api/v1/', apiRoot);
};


