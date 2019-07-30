var osdi = require('../lib/osdi'),
    config = require('../config'),
    bridge = require('../lib/bridge'),
    _ = require('lodash'),
    moment = require('moment'),
    selectn = require('selectn');


var default_expand = ['phones', 'emails', 'addresses', 'externalIds', 'customFields'];

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
    middleName: valueOrBlank(osdiPerson.additional_name),
    lastName: valueOrBlank(osdiPerson.family_name),
    title: valueOrBlank(osdiPerson.honorific_prefix),
    suffix: valueOrBlank(osdiPerson.honorific_suffix)
  };


  if (osdiPerson.email_addresses && osdiPerson.email_addresses[0]) {
    answer.emails = _.map(osdiPerson.email_addresses, function(osdiEmail){
      var vanEmail={
        email: osdiEmail.address
      }

      if (osdiEmail.primary) {
        vanEmail.isPreferred = true;
      }

      return vanEmail;
    });
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

    var addressTypeMapping = {
      'Home': 'H',
      'Work': 'W',
      'Mailing': 'M',
      'Custom': 'C'
    };

    answer.addresses = _.map(osdiPerson.postal_addresses, function(osdiAddress) {
      var vanAddress={};

      if (osdiAddress.address_lines) {
        vanAddress.addressLine1 = osdiAddress.address_lines[0];
        vanAddress.addressLine2 = valueOrBlank(osdiAddress.address_lines[1]);
        vanAddress.addressLine3 = valueOrBlank(osdiAddress.address_lines[2]);
      }

      vanAddress.city = osdiAddress.locality;
      vanAddress.stateOrProvince = osdiAddress.region;
      vanAddress.zipOrPostalCode = osdiAddress.postal_code;
      vanAddress.countryCode = osdiAddress.country;

      var osdiAddressType = addressTypeMapping[osdiAddress.address_type];
      vanAddress.address_type = osdiAddressType ? osdiAddressType : null;
      vanAddress.isPreferred = osdiAddress.primary ? true : false;
      return vanAddress
    });
  }


// * _.forEach({ 'a': 1, 'b': 2 }, function(n, key) {
//   *   console.log(n, key);
// //   * });
//   var re = /api\/v1\/questions\/(.*)$/i;
//   var questionId = survey_answer.question.match(re)[1];
  if (osdiPerson.custom_fields) {
    var cfs=osdiPerson.custom_fields;
    var num;
    var re = /^van_([0-9]+)_([0-9]+)\|?(.*)$/i;

    var customFieldValues= _.map(cfs,function(v,k){
      var matches=k.match(re);

      if (matches) {
        return {
          customFieldId: matches[2],
          customFieldGroupId: matches[1],
          assignedValue: v
        }
      } else {
        return {};
      }

    });
    customFieldValues= _.reject(customFieldValues, function(cf) { return _.isEmpty(cf )});

    answer.customFieldValues= customFieldValues;

  }

  // intentionally ignoring identifiers for now - bit tricky semantically
  //console.log(answer);

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
function translateToEmpty(vanPerson) {
  var answer= {
    identifiers: [
      'VAN' + vanPerson.vanId
    ]
  };

  osdi.response.addSelfLink(answer, 'people', vanPerson.vanId);
  osdi.response.addLink(answer, 'osdi:attendances', 'people/' + vanPerson.vanId + '/attendances');
  osdi.response.addCurie(answer, config.get('curieTemplate'));
  return answer;
}

function translateToOSDIPerson(vanPerson) {
  if (vanPerson.return_response==false) {
    return translateToEmpty(vanPerson);
  }

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
      month: dob.month() + 1,
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

//
// * _.forEach({ 'a': 1, 'b': 2 }, function(n, key) {
//   *   console.log(n, key);
//   * });
  if (vanPerson.customFields) {
    var custom_fields={};
    _.forEach(vanPerson.customFields, function(cfi) {
      var cf=cfi['customField'];
      var id=cf['customFieldId'];
      var gid=cf['customFieldGroupId'];

      var label=_.snakeCase(cf['customFieldName']);

      var value=cfi['assignedValue'];

      if (cf['customFieldTypeId']=='B') {
        value= value=="true" ? true : false
      }

      custom_fields['van_' + gid + '_' + id + '|' + label]=value;
    });
    answer.custom_fields=custom_fields;
  }
  answer._links= {
    self: {
      href: config.get('apiEndpoint') + 'people/' + vanPerson.vanId
    },
    'osdi:record_canvass_helper': {
      href: config.get('apiEndpoint') +
      'people/' + vanPerson.vanId + '/record_canvass_helper'
    },
    'osdi:attendances': {
      href: config.get('apiEndpoint') + 'people/' + vanPerson.vanId + '/attendances'
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
  var return_response=true;

  if (req.body && req.body['osdi:control']) {
    var control = req.body['osdi:control'];

    if (control.return_response == false) {
      return_response = false;
    }
  }


  var personPromise = vanClient.people.findOrCreate(matchCandidate).
    then(function(matchResponse) {
      originalMatchResponse = matchResponse;
      var vanId = matchResponse.vanId;
      return vanClient.people.applyActivistCodes(vanId, activistCodeIds);
    }).
    then(function () {
    if (return_response) {
      var expand = osdi.request.getExpands(req, default_expand);
      return vanClient.people.getOne(originalMatchResponse.vanId, expand);
    } else {
      return {
        return_response: false,
        vanId: originalMatchResponse.vanId
      }
    }
  });

  bridge.sendSingleResourceResponse(personPromise, translateToOSDIPerson,'people', res);
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

function getAttendances(req, res) {

  var vanClient = bridge.createClient(req);

  var id = 0;
  if (req && req.params && req.params.id) {
    id = req.params.id;
  }

  var vanPaginationParams = bridge.getVANPaginationParams(req);


  var resourcePromise = vanClient.people.getAttendances(id);

  bridge.sendMultiResourceResponse(resourcePromise, vanPaginationParams,
    oneAttendanceTranslator, 'attendances', res);
}


function oneAttendanceTranslator(vanitem) {
  var answer = osdi.response.createCommonItem(
    "Attendance",
    "");

  var statuses = {
    'Scheduled': 'accepted',
    'Confirmed': 'accepted'
  };

  answer['van:shift'] = {
    shift_id: selectn('shift.eventShiftId', vanitem),
    name: selectn('shift.name', vanitem)
  };

  answer['van:location'] = {
    location_id: selectn('location.locationId', vanitem),
    venue: selectn('location.name', vanitem),
    description: selectn('location.displayName', vanitem)
  };

  answer['van:role'] = {
    role_id: selectn('role.roleId', vanitem),
    name: selectn('role.name', vanitem)
  };

  answer['van:status'] = {
    status_id: selectn('status.statusId', vanitem),
    status_name: selectn('status.name', vanitem),
  };

  answer['van:person'] = {
    first_name: selectn('person.firstName', vanitem),
    last_name: selectn('person.lastName', vanitem),
    van_id: selectn('person.vanId', vanitem)
  };

  answer.status = statuses[selectn('status.name', vanitem)] || selectn('status.name', vanitem)

  osdi.response.addIdentifier(answer, 'VAN:' + vanitem.eventSignupId);
  osdi.response.addSelfLink(answer, 'attendances', vanitem.eventSignupId);
  osdi.response.addLink(answer, 'osdi:person', 'people/' + vanitem.person.vanId);
  osdi.response.addLink(answer, 'osdi:event', 'events/' + vanitem.event.eventId);
  osdi.response.addCurie(answer, config.get('curieTemplate'));

  return answer;
}

module.exports = function (app) {
  app.get('/api/v1/people/:id', getOne);
  app.post('/api/v1/people/person_signup_helper', signup);
  app.post('/api/v1/people/:id/record_canvass_helper', canvass);
  app.get('/api/v1/people/:id/attendances', getAttendances);
};
