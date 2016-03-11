var config = require('../../config');

var root = config.get('apiEndpoint');
var _ = require('lodash');


function valueOrBlank(value) {
  var answer = value;

  if (!value) {
    answer = '';
  }

  return answer;
}

function osdiHelperToVANMatchCandidate(req) {
  var osdiPerson = {};

  if (req && req.body && req.body.person) {
    osdiPerson = req.body.person;
  }


  var answer = {
    firstName: osdiPerson.given_name,
    middleName: osdiPerson.additional_name,
    lastName: osdiPerson.family_name
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
      'Mobile': 'M',
      'Fax': 'F'
    };

    answer.phone = {};
    answer.phone.phoneNumber = osdiPerson.phone_numbers[0].number;
    answer.phone.ext = osdiPerson.phone_numbers[0].extension;
    answer.phone.isPreferred =
      osdiPerson.phone_numbers[0].primary ? true : false;

    var osdiNumberType = typeMapping[osdiPerson.phone_numbers[0].number_type];
    answer.phone.phoneType  = osdiNumberType ? osdiNumberType : null;
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


function osdiHelperToVANActivistCodes(req) {
  var answer = [];

  if (req && req.body && req.body.add_tags) {
    answer = req.body.add_tags;
  }

  return answer;
}

function vanAddressToOSDI(address) {
  var addressTypes = [ 'Home', 'Work', 'Mailing' ];

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
    locality: address.city,
    region: address.stateOrProvince,
    postal_code: address.zipOrPostalCode,
    country: address.countryCode,
    address_type: _.indexOf(address.type, addressTypes) >= 0 ?
      address.type : ''
  };
}

function vanLocationToOSDI(vanLocation) {
  var location = vanAddressToOSDI(vanLocation.address);

  location.venue=vanLocation.name;
  location.description=vanLocation.displayName;
  location.location_id=vanLocation.locationId;

  return location;
}


function vanMatchToOSDIPerson(vanPerson) {
  var answer = {
    identifiers: [
      'VAN:' + vanPerson.vanId
    ],
    given_name: valueOrBlank(vanPerson.firstName),
    family_name: valueOrBlank(vanPerson.lastName),
    additional_name: valueOrBlank(vanPerson.middleName),
    _links: {
      self: {
        href: config.get('apiEndpoint') + 'people/' + vanPerson.vanId
      },
      'osdi:record_canvass_helper': {
        href: config.get('apiEndpoint') +
        'people/' + vanPerson.vanId + '/record_canvass_helper'
      }
    }
  };

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
      address_type: _.indexOf(address.type, addressTypes) >= 0 ?
        address.type : ''
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
    return {
      primary: phone.isPreferred ? true : false,
      number: valueOrBlank(phone.phoneNumber),
      extension: valueOrBlank(phone.ext),
      number_type: _.indexOf(phone.phoneType, phoneTypes) >= 0 ?
        phone.phoneType : ''

    };
  });

  osdi.response.addCurie(answer, config.get('curieTemplate'));

  return answer;
}



module.exports = {
  vanAddressToOSDI: vanAddressToOSDI,
  vanLocationToOSDI: vanLocationToOSDI,
  osdiHelperToVANMatchCandidate: osdiHelperToVANMatchCandidate,
  osdiHelperToVANActivistCodes: osdiHelperToVANActivistCodes,
  vanMatchToOSDIPerson: vanMatchToOSDIPerson
};

