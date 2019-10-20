var config = require('../config'),
  osdi = require('../lib/osdi'),
  ngpvanAPIClient = require('../lib/ngpvan-api-client'),
  _ = require('lodash'),
  bridge = require('../lib/bridge'),
  selectn = require('selectn');

var Promise = require('bluebird');


var reqCache;

// Events
function getAll(req, res) {
  var vanClient = bridge.createClient(req);
  var vanPaginationParams = bridge.getVANPaginationParams(req);
  var vanEventTypeCache = {};
  var vanOriginalEvents;

  reqCache = req;
  // 'codes' and 'notes' can be requested vi &expand query param
  var expand = osdi.request.getExpands(req, ['locations', 'shifts', 'roles']);
  var filter = osdi.request.getFilter(req);

  var resourcePromise = vanClient.events.getMany(expand, vanPaginationParams.top, vanPaginationParams.skip,filter).then(function (vanEvents) {
    var titles;
    vanOriginalEvents = vanEvents;

    // collect needed event types
    var eventTypes= _.uniq(_.map(vanEvents.items,function(event) {
      return selectn('eventType.eventTypeId', event);
    }));

    var promises=_.map(eventTypes, function(eventTypeId) {
      var p = vanClient.events.getEventType(eventTypeId).then(function (newEventTypeBlock) {
        vanEventTypeCache[eventTypeId] = newEventTypeBlock;
      });
      return p;
    });

    return Promise.all(promises).catch(ngpvanAPIClient.errors.NotFound, function(ex) {});

  }).then(function () {
    _.forEach(vanOriginalEvents.items,function(event) {
      var eventTypeId = selectn('eventType.eventTypeId', event);
      event.vanEventTypeBlock = vanEventTypeCache[eventTypeId];

    });
    return vanOriginalEvents;
  });

  bridge.sendMultiResourceResponse(resourcePromise, vanPaginationParams,
    oneResourceTranslator, 'events', res);
}

// Events
function getOne(req, res) {
  var vanClient = bridge.createClient(req);
  var originalVanEvent = null;
  var id = 0;
  if (req && req.params && req.params.id) {
    id = req.params.id;
  }
  // 'codes' and 'notes' can be requested vi &expand query param
  var expand = osdi.request.getExpands(req, ['locations', 'shifts', 'roles']);

  var resourcePromise = vanClient.events.getOne(id, expand).then(function (vanEvent) {
    originalVanEvent = vanEvent;
    var eventTypeId = vanEvent.eventType.eventTypeId;
    return vanClient.events.getEventType(eventTypeId);
  }).then(function (vanEventType) {
    originalVanEvent.vanEventTypeBlock = vanEventType;
    return originalVanEvent;
  });

  bridge.sendSingleResourceResponse(resourcePromise, oneResourceTranslator,
    'events', res);
}

function oneResourceTranslator(vanitem) {
  var answer = osdi.response.createCommonItem(
    vanitem.shortName,
    vanitem.description);
  answer.title = vanitem.name;
  answer.summary = answer.title;

  answer['van:statuses'] = _.map(selectn('vanEventTypeBlock.statuses', vanitem), function (status) {
    return {
      status_id: status.statusId,
      name: status.name,
      is_event_lead: status.isEventLead
    }
  });

  /*
  * Suppress this for now
  answer['van:event_type'] = {
    event_type_id: selectn('eventType.eventTypeId', vanitem),
    name: selectn('eventType.name', vanitem)
  };
*/

  answer.start_date = vanitem.startDate;
  answer.end_date = vanitem.endDate;
  answer.created_date = vanitem.createdDate;
  answer['van:shifts'] = _.map(vanitem.shifts, function (shift) {
    return {
      shift_id: shift.eventShiftId,
      name: shift.name,
      start_date: shift.startTime,
      end_date: shift.endTime
    }
  });

  if ((vanitem.locations) && (vanitem.locations.length >= 1)) {
    answer.location = osdi.translator.vanLocationToOSDI(vanitem.locations[0])
  }

  answer['van:locations'] = _.map(vanitem.locations, function (location) {
    return osdi.translator.vanLocationToOSDI(location);
  });

  answer['van:roles'] = _.map(vanitem.roles, function (role) {
    return {
      role_id: role.roleId,
      name: role.name,
      is_event_lead: role.isEventLead,
      min: role.min,
      max: role.max,
      goal: role.goal
    }
  });
  answer['van:codes'] = _.map(vanitem.codes, function (code) {
    return {
      code_id: code.codeId,
      parent_code_id: code.parentCodeId,
      name: code.parentCodeId,
      code_path: code.codePath,
      created_by_name: code.createdByName,
      created_date: code.dateCreated,
      supported_entities: code.supportedEntities
    }
  });

  answer['van:notes'] = _.map(vanitem.notes,function(note){
    return {
      note_id: note.noteId,
      text: note.text,
      is_view_restricted: note.isViewRestricted,
      category: note.category,
      created_at: note.createdDate
    }
  });

  answer['van:voter_registration_batches'] = vanitem.voterRegistrationBatches;
  answer['van:district_field_value'] = vanitem.districtFieldValue;

  osdi.response.addIdentifier(answer, 'VAN:' + vanitem.eventId);
  osdi.response.addSelfLink(answer, 'events', vanitem.eventId);
  osdi.response.addLink(answer, 'osdi:attendances', 'events/' + vanitem.eventId + '/attendances');
  osdi.response.addLink(answer,'osdi:record_attendance_helper', 'events/' +
    vanitem.eventId + '/record_attendance_helper');
  osdi.response.addCurie(answer, config.get('curieTemplate'));

  return answer;
}

function valueOrBlank(value) {
  var answer = value;

  if (!value) {
    answer = '';
  }

  return answer;
}

function recordAttendance(req,res) {

  if (_.all([
    req.body,
    req.body.person,
    req.body.person.identifiers,
    req.body.person.identifiers[0],
    _.include(req.body.person.identifiers[0],'VAN')
  ])) {
   return recordAttendanceQuick(req, res)
  } else {
    return recordAttendanceNormal(req,res)
  }
}

function recordAttendanceQuick(req, res) {
  var vanClient = bridge.createClient(req);

  var identifier = req.body.person.identifiers[0];
  var vanId = identifier.split(':')[1];
  var eventId = req.params.id;

  console.log("QUICK SIGNUP ".concat(vanId, " ev ", eventId));

  var signup = {
    "person": {
      "vanId": vanId
    },
    "event": {
      "eventId": eventId
    },
    "status": {
      "statusId": req.body['van:status_id'] || selectn('van:status.status_id',req.body)
    },
    "shift": {
      "eventShiftId": req.body['van:shift_id'] || selectn('van:shift.shift_id',req.body)
    },
    "role": {
      "roleId": req.body['van:role_id'] || selectn('van:role.role_id',req.body)
    },
    "location": {
      "locationId": req.body['van:location_id'] || selectn('van:location.location_id',req.body)
    }

  };
  var resourcePromise= vanClient.events.recordAttendance(signup);
  bridge.sendCreatedResponse(resourcePromise,'attendances',res)

}

function recordAttendanceNormal(req, res) {
  var vanClient = bridge.createClient(req);

  var matchCandidate = osdi.translator.osdiHelperToVANMatchCandidate(req);
  var activistCodeIds = osdi.translator.osdiHelperToVANActivistCodes(req);
  var osdiTranslator = osdi.translator;

  var originalMatchResponse = null;

  var eventId = 0;
  if (req && req.params && req.params.id) {
    eventId = req.params.id;
  }
  var personPromise = vanClient.people.findOrCreate(matchCandidate).then(function (matchResponse) {
    originalMatchResponse = matchResponse;
    var vanId = matchResponse.vanId;
    return vanClient.people.applyActivistCodes(vanId, activistCodeIds);
  }).then(function () {

    var signup = {
      "person": {
        "vanId": originalMatchResponse.vanId
      },
      "event": {
        "eventId": eventId
      },
      "status": {
        "statusId": req.body['van:status_id'] || selectn('van:status.status_id',req.body)
      },
      "shift": {
        "eventShiftId": req.body['van:shift_id'] || selectn('van:shift.shift_id',req.body)
      },
      "role": {
        "roleId": req.body['van:role_id'] || selectn('van:role.role_id',req.body)
      },
      "location": {
        "locationId": req.body['van:location_id'] || selectn('van:location.location_id',req.body)
      }

    };

    var expand = ['phones', 'emails', 'addresses'];
    return vanClient.events.recordAttendance(signup);
  }).then(function (recordedAttendance) {
    var signupStub = {
      signupId: recordedAttendance
    };

    return vanClient.events.getAttendance(recordedAttendance);
  });

  bridge.sendSingleResourceResponse(personPromise, oneAttendanceTranslator,
    'attendances', res);

}

function getAttendances(req, res) {
  var rawBody = req.body;

  var vanClient = bridge.createClient(req);

  var id = 0;
  if (req && req.params && req.params.id) {
    id = req.params.id;
  }

  var event_id = parseInt(id);
  var vanPaginationParams = bridge.getVANPaginationParams(req);


  var resourcePromise = vanClient.events.getAttendances(id);

  bridge.sendMultiResourceResponse(resourcePromise, vanPaginationParams,
    oneAttendanceTranslator, 'attendances', res);
}


function getAttendance(req, res) {
  var vanClient = bridge.createClient(req);

  var id = 0;
  if (req && req.params && req.params.id) {
    id = req.params.id;
  }

  var resourcePromise = vanClient.events.getAttendance(id);

  bridge.sendSingleResourceResponse(resourcePromise, oneAttendanceTranslator,
    'attendances', res);
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
  osdi.response.addEmbeddedItem(answer, vanitem.person, signupPersonTranslator, 'personhint');

  return answer;
}

function signupPersonTranslator(vanitem) {
  var answer = osdi.response.createCommonItem(
    "Person",
    "")

  answer.given_name = vanitem.firstName;
  answer.family_name = vanitem.lastName;
  answer.description = vanitem.firstName + ' ' + vanitem.lastName;
  osdi.response.addSelfLink(answer, 'people', vanitem.vanId);

  return answer;

}

function createEvent(req,res) {
  var vanClient = bridge.createClient(req);

  var osdiEvent = req.body

  var root = config.get('apiEndpoint');
  var vanEvent=osdiToEventTranslator(osdiEvent);

  var sresourcePromise = new Promise(function(resolve,reject){


    resolve('1233')
  })

  var resourcePromise = vanClient.events.create(vanEvent)

  bridge.sendCreatedResponse(resourcePromise,'events',res)

}


function osdiToEventTranslator(osdi) {
  var vanEvent={
    name: osdi.title,
    shortName: osdi.name.substr(0,12),
    startDate: osdi.start_date,
    endDate: osdi.end_date,
    eventType: {
      eventTypeId: osdi['van:event_type_id']
    },
    roles: _.map(osdi['van:roles'] || [], function(role){
      return {
        roleId: role['role_id']
      }
    }),
    "isOnlyEditableByCreatingUser": false

  };

  if ( osdi['van:shifts'] ) {
    vanEvent['shifts'] = _.map(osdi['van:shifts'] || [], function(shift) {
      return {
        name: shift['name'],
        startTime: shift.start_date,
        endTime: shift.end_date
      }
    })
  } else {
    vanEvent['shifts'] = [
      {
        name: 'first',
        startTime: osdi.start_date,
        endTime: osdi.end_date
      }
    ]
  }
  return vanEvent
}

module.exports = function (app) {
  app.get('/api/v1/events', getAll);
  app.get('/api/v1/events/:id', getOne);
  app.post('/api/v1/events', createEvent);
  app.post('/api/v1/events/:id/record_attendance_helper', recordAttendance);
  app.get('/api/v1/events/:id/attendances', getAttendances);
  app.get('/api/v1/attendances/:id', getAttendance);
};
