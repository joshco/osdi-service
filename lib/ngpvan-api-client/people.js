var vanRequestBuilder = require('./van-request-builder'),
    _ = require('lodash'),
    BPromise = require('bluebird');

var API_INPUT_TYPE = 11;

function peopleClient(vanHTTP) {

  var client = vanHTTP;

  return {
    getOne: function(id, expand) {
      var params = {};
      vanRequestBuilder.addPaginationParameters(params, '', '', expand);

      return client.getResource('people/' + id, params);
    },

    findOrCreate: function(matchCandidate) {
      return client.postResource('people/findOrCreate', matchCandidate);
    },

    applyActivistCodes: function (vanId, activistCodeIds) {
      if (!_.isArray(activistCodeIds) || activistCodeIds.length < 1) {
        return BPromise.resolve();
      }
      var re = /^van_(ac|va)_([0-9]+)\|?(.*)$/i;

      var responses = _.map(activistCodeIds, function (activistCodeId) {
        var matches = null;

        if (typeof (activistCodeId) == "string") {
          matches = activistCodeId.match(re);
        }
        ;

        if (matches) {
          var canvass = {
            action: 'Apply'
          };
          if (matches[1] == 'va') {
            canvass.type = 'VolunteerActivity';
            canvass.volunteerActivityId = matches[2];
          } else {
            canvass.type = 'ActivistCode';
            canvass.activistCodeId = matches[2];
          }
          return canvass;
        } else {

          return {
            'action': 'Apply',
            'type': 'ActivistCode',
            'activistCodeId': activistCodeId
          };
        }
      })


      return client.postResource('people/' + vanId + '/canvassResponses',
        {
          'canvassContext': {
            'inputTypeId': API_INPUT_TYPE,
          },
          'responses': responses
        });
    },

    postNonCanvass: function(vanId, nonCanvassResult, contactTypeId,
      dateCanvassed) {

      return client.postResource('people/' + vanId + '/canvassResponses',
        {
          'canvassContext': {
            'inputTypeId': API_INPUT_TYPE,
            'contactTypeId': contactTypeId,
            'dateCanvassed': dateCanvassed
          },
          'resultCodeId': nonCanvassResult
       });
    },

    postCanvassResponses: function(vanId, canvassResponses, contactTypeId,
      dateCanvassed) {

      var validTypes = [
        'ActivistCode',
        'SurveyResponse',
        'VolunteerActivity'
      ];

      var validActions = [ 'Apply', 'Remove' ];

      var validResponses = _.map(canvassResponses, function(canvassResponse) {
        if (!canvassResponse || !_.isObject(canvassResponse) ||
           !canvassResponse.type) {
          return null;
        }

        if (_.indexOf(validTypes, canvassResponse.type) < 0) {
          return null;
        }

        if (canvassResponse.type === 'ActivistCode') {
          if (_.indexOf(validActions, canvassResponse.action) < 0) {
            return null;
          }

          if (isNaN(parseInt(canvassResponse.activistCodeId))) {
            return null;
          }
          return canvassResponse;
        }

        if (canvassResponse.type === 'SurveyResponse') {
          if (isNaN(parseInt(canvassResponse.surveyQuestionId)) ||
              isNaN(parseInt(canvassResponse.surveyResponseId))) {
            return null;
          }

          return canvassResponse;
        }

        if (canvassResponse.type === 'VolunteerActivity') {
          if (_.indexOf(validActions, canvassResponse.action) < 0) {
            return null;
          }

          if (isNaN(parseInt(canvassResponse.volunteerActivityId))) {
            return null;
          }
          return canvassResponse;
        }
      });

      validResponses = _.filter(validResponses);

      if (!_.isArray(validResponses) || validResponses.length < 1) {
        return BPromise.resolve();
      }

      return client.postResource('people/' + vanId + '/canvassResponses',
        {
          'canvassContext': {
            'inputTypeId': API_INPUT_TYPE,
            'contactTypeId': contactTypeId,
            'dateCanvassed': dateCanvassed
          },
          'responses': validResponses
       });
    },
    getAttendances: function(id) {
      var expand={};
      var params={};
      vanRequestBuilder.addPaginationParameters(params, '', '', expand);
      params.vanId=id;
      return client.getResource('signups', params );
    }
  };
}

module.exports = peopleClient;
