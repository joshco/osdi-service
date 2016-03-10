var _ = require('lodash'),
    vanRequestBuilder = require('./van-request-builder');


function eventsClient(vanHTTP) {

  var client = vanHTTP;

  return {
    getOne: function(id, expand) {
      var params={};
      vanRequestBuilder.addPaginationParameters(params, '', '', expand);
      return client.getResource('events/' + id, params );
    },

    getAttendances: function(id) {
      var expand={};
      var params={};
      vanRequestBuilder.addPaginationParameters(params, '', '', expand);
      params.eventId=id;
      return client.getResource('signups', params );
    },

    recordAttendance: function(signup) {
      return client.postResource('signups', signup);
    },

    getMany: function(expand, top, skip) {
      var params = {};

      vanRequestBuilder.addPaginationParameters(params, top, skip, expand);

      return client.getResource('events', params);
    }
  };
}

module.exports = eventsClient;