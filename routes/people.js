var osdi = require('../lib/osdi'),
    config = require('../config'),
    bridge = require('../lib/bridge'),
    _ = require('lodash'),
    moment = require('moment');

var default_expand = ['phones', 'emails', 'addresses', 'externalIds'];

function valueOrBlank(value) {
  var answer = value;

  if (!value) {
    answer = '';
  }

  return answer;
}

function translateToMatchCandidate(req) {
  // TODO refactor to use osdi.translator.osdiPersonToVANMatchCandidate
  var osdiPerson = {};

  if (req && req.body && req.body.person) {
    osdiPerson = req.body.person;
  }
  var answer = {
    firstName: osdiPerson.given_name,
    middleName: osdiPerson.additional_name,
    lastName: osdiPerson.family_name,
  };

  if (osdiPerson.email_addresses && osdiPerson.email_addresses[0]) {
    answer.email = {};
    answer.email.email = osdiPerson.email_addresses[0].address;
    var isPreferred = false;

    if (osdiPerson.email_addresses[0].primary) {
      isPreferred = true;
    }

    answer.email.isPreferred = isPreferred;
  }

  if (osdiPerson.phone_numbers && osdiPerson.phone_numbers[0]) {
    var typeMapping = {
      'Home': 'H',
      'Work': 'W',
      'Mobile': 'C',
      'Fax': 'F'
    };

    answer.phones= _.map(osdiPerson.phone_numbers, function (phone) {
      var osdiNumberType = typeMapping[phone.number_type];
      return {
        phoneNumber: phone.number,
        ext: phone.extension,
        isPreferred: phone.primary ? true : false,
        phoneType: osdiNumberType ? osdiNumberType : null
      }
    });

  }

  if (osdiPerson.postal_addresses && osdiPerson.postal_addresses[0]) {
    var osdiAddress = osdiPerson.postal_addresses[0];
    var addressTypeMapping = {
      'Home': 'H',
      'Work': 'W',
      'Mailing': 'M'
    };

    answer.address = {};

    if (osdiAddress.address_lines) {
      answer.address.addressLine1 = osdiAddress.address_lines[0];
      answer.address.addressLine2 = osdiAddress.address_lines[1];
      answer.address.addressLine3 = osdiAddress.address_lines[2];
    }

    answer.address.city = osdiAddress.locality;
    answer.address.stateOrProvince = osdiAddress.region;
    answer.address.zipOrPostalCode = osdiAddress.postal_code;
    answer.address.countryCode = osdiAddress.country;

    var osdiAddressType = addressTypeMapping[osdiAddress.address_type];
    answer.address.address_type = osdiAddressType ? osdiAddressType : null;
    answer.address.isPreferred = osdiAddress.primary ? true : false;
  }

  // intentionally ignoring identifiers for now - bit tricky semantically

  return answer;
}

function translateToActivistCodes(req) {
  var answer = [];

  if (req && req.body && req.body.add_tags) {
    answer = req.body.add_tags;
  }

  return answer;
}

function translateToScriptResponse(req) {
  var answer = [];

  if (req && req.body && req.body.add_answers) {
    answer = _.map(req.body.add_answers, function(survey_answer) {
      var re = /api\/v1\/questions\/(.*)$/i;
      var questionId = survey_answer.question.match(re)[1];

      return {
        surveyQuestionId: questionId,
        surveyResponseId: survey_answer.responses[0]
      };
    });
  }

  return answer;

}
function translateDistrictsToOSDI(districts) {
  /*
          "division_info" : [
                  {
                    "name": "State",
                    "divisions": [
                      {
                        "id": "OH",
                        "name": "Ohio",
                        "ocd_id": "ocd-division/country:us/state:oh"
                      }

                    ]
                  },
   */
  var divisions=_.map(districts,function(district){
    return {
      name: district.name,
      divisions: _.map(district.districtFieldValues,function(dfv){
        return {
          id: dfv.id,
          name: dfv.name
        }
      })
    }
  });
  return divisions;
}
function translateToOSDIPerson(vanPerson) {
  var answer = {
    identifiers: [
      'VAN:' + vanPerson.vanId
    ],
    given_name: valueOrBlank(vanPerson.firstName),
    family_name: valueOrBlank(vanPerson.lastName),
    additional_name: valueOrBlank(vanPerson.middleName),
    party: valueOrBlank(vanPerson.party)

  };

  if (vanPerson.districts) {
    answer.division_info=translateDistrictsToOSDI(vanPerson.districts);
  }

  if (vanPerson.dateOfBirth) {
    var dob=moment(vanPerson.dateOfBirth);
    answer.birthdate ={
      month: dob.month(),
      day: dob.date(),
      year: dob.year()
    }
  }

  var xidentifiers= _.map(vanPerson.identifiers, function(id){
    return id.type + ":" + id.externalId;
  });
  answer.identifiers=answer.identifiers.concat(xidentifiers);

  var addressTypes = [ 'Home', 'Work', 'Mailing' ];

  answer.postal_addresses = _.map(vanPerson.addresses, function(address) {
    var address_lines = [];
    if (address.addressLine1) {
      address_lines.push(address.addressLine1);
    }

    if (address.addressLine2) {
      address_lines.push(address.addressLine2);
    }

    if (address.addressLine3) {
      address_lines.push(address.addressLine3);
    }


    return {
      primary: address.isPreferred ? true : false,
      address_lines: address_lines,
      locality: valueOrBlank(address.city),
      region: valueOrBlank(address.stateOrProvince),
      postal_code: valueOrBlank(address.zipOrPostalCode),
      country: valueOrBlank(address.countryCode),
      address_type: valueOrBlank(address.type)
    };
  });

  answer.email_addresses = _.map(vanPerson.emails, function(email) {
    return {
      primary: email.isPreferred ? true: false,
      address: valueOrBlank(email.email),
    };
  });

  var phoneTypes = [ 'Home', 'Work', 'Cell', 'Mobile', 'Fax' ];

  answer.phone_numbers = _.map(vanPerson.phones, function(phone) {
    var phoneType = (phone.phoneType == 'Cell') ? 'Mobile' : phone.phoneType;
    return {
      primary: phone.isPreferred ? true : false,
      number: valueOrBlank(phone.phoneNumber),
      extension: valueOrBlank(phone.ext),
      number_type: phoneType

    };
  });

  answer._links= {
    self: {
      href: config.get('apiEndpoint') + 'people/' + vanPerson.vanId
    },
    'osdi:record_canvass_helper': {
      href: config.get('apiEndpoint') +
      'people/' + vanPerson.vanId + '/record_canvass_helper'
    }
  }
  osdi.response.addCurie(answer, config.get('curieTemplate'));

  return answer;
}

function signup(req, res) {
  var vanClient = bridge.createClient(req);

  var matchCandidate = translateToMatchCandidate(req);
  var activistCodeIds = translateToActivistCodes(req);
  var originalMatchResponse = null;

  var personPromise = vanClient.people.findOrCreate(matchCandidate).
    then(function(matchResponse) {
      originalMatchResponse = matchResponse;
      var vanId = matchResponse.vanId;
      return vanClient.people.applyActivistCodes(vanId, activistCodeIds);
    }).
    then(function() {
      var expand = osdi.request.getExpands(req,default_expand);
      return vanClient.people.getOne(originalMatchResponse.vanId, expand);
    });

  bridge.sendSingleResourceResponse(personPromise, translateToOSDIPerson,
    'people', res);
}

function getOne(req, res) {
  var vanClient = bridge.createClient(req);

  var vanId = 0;
  if (req && req.params && req.params.id) {
    vanId = req.params.id;
  }


  var expand = osdi.request.getExpands(req,default_expand);
  var personPromise = vanClient.people.getOne(vanId, expand);

  bridge.sendSingleResourceResponse(personPromise, translateToOSDIPerson,
    'people', res);
}


function canvass(req, res) {
  var vanClient = bridge.createClient(req);

  var vanId = 0;
  if (req && req.params && req.params.id) {
    vanId = req.params.id;
  }

  var canvassPromise;

  var requestedCanvass = req.body.canvass;

  var contactTypeId = null;
  if (requestedCanvass.contact_type === 'phone') {
    contactTypeId = 1;
  }
  else if (requestedCanvass.contact_type === 'walk') {
    contactTypeId = 2;
  }

  if (requestedCanvass.status_code) {
    canvassPromise = vanClient.people.postNonCanvass(vanId,
      requestedCanvass.status_code, contactTypeId,
      requestedCanvass.action_date);
  }

  else {
    var activistCodeIds = translateToActivistCodes(req);
    var surveyResponses = translateToScriptResponse(req);

    var canvassResponses = _.union(
      _.map(activistCodeIds, function(id) {
        return {
          'activistCodeId': id,
          'action': 'Apply',
          'type': 'ActivistCode'
        };
      }),
      _.map(surveyResponses, function(surveyResponse) {
        var answer = surveyResponse;
        answer.type = 'SurveyResponse';
        return answer;
      })
    );

    canvassPromise = vanClient.people.postCanvassResponses(vanId,
      canvassResponses, contactTypeId,
      requestedCanvass.action_date);
  }

  function translateToOSDICanvass() {
    var requestedCanvass = req.body.canvass;
    var answer = requestedCanvass;
    answer.identifiers = [ 'VAN:' + vanId ];
    answer._links = {
      'osdi:target': {
        href: config.get('apiEndpoint') + 'people/' + vanId
      }
    };

    return answer;
  }

  bridge.sendSingleResourceResponse(canvassPromise,
    translateToOSDICanvass, 'people', res);
}


module.exports = function (app) {
  app.get('/api/v1/people/:id', getOne);
  app.post('/api/v1/people/person_signup_helper', signup);
  app.post('/api/v1/people/:id/record_canvass_helper', canvass);
};
