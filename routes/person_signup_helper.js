var contentType = require('../middleware/contentType'),
    ngpvanAPIClient = require('../lib/ngpvanapi-client'),
    osdi = require('../lib/osdi'),
    config = require('../config'),
    vanRequest = require('../lib/van-request-helper'),
    auth = require('basic-auth');



var vanEndpoint = config.get('vanEndpoint');

function getCredentials(req) {

  var pass=req.get('OSDI-API-Token');
  if (typeof pass !== 'string') {
    return {};
  }

  var parts = pass.split('|');
  return { apiKey: parts[0], dbMode: parts[1] };
}

function translate(req) {
  var osdiPerson = {};
  var vanPerson = {};
  if (req && req.body && req.body.person) {
    osdiPerson = req.body.person;
  }

  var vanPerson = {
    firstName: osdiPerson.given_name,
    middleName: osdiPerson.additional_name,
    lastName: osdiPerson.family_name,
  };

  if (osdiPerson.email_addresses && osdiPerson.email_addresses[0]) {
    vanPerson.email = {};
    vanPerson.email.email = osdiPerson.email_addresses[0].address;
    var isPreferred = false;

    if (osdiPerson.email_addresses[0].primary) {
      isPreferred = true;
    }

    vanPerson.email.isPreferred = isPreferred;
    vanPerson.email.address_type = 'Personal';
  }

  return vanPerson;
}

function signup(req, res) {
  var vanPerson = translate(req);
  var credentials = getCredentials(req);

  var success = function(vanResponse) {
    var answer = {
      identifiers: [
        'van:' + vanResponse.vanId
      ],
      given_name: vanPerson.firstName,
      additional_name: vanPerson.middleName,
      family_name: vanPerson.lastName,
    };
    osdi.response.addSelfLink(answer, 'people', vanResponse.vanId);

    var email_addresses = [];
    if (vanPerson.email && vanPerson.email.email) {
      email_addresses.push({ 
        address: vanPerson.email.email,
        primary: vanPerson.email.isPreferred, 
        address_type: 'Personal' 
      });
    }
    answer.email_addresses = email_addresses;

    return res.status(200).send(answer);
  };

  ngpvanAPIClient.people.findOrCreate(vanEndpoint,
    credentials.apiKey, credentials.dbMode, vanPerson,
    osdi.response.unauthorized(res), osdi.response.badRequest(res), 
    success);
}


module.exports = function (app) {
  app.post('/api/v1/people/person_signup_helper', contentType, signup);
};
