var _ = require('lodash'),
    vanRequestBuilder = require('./van-request-builder');

function supporterGroupsClient(vanHTTP) {

  var client = vanHTTP;

  return {
    getOne: function(id) {
      return client.getResource('supporterGroups/' + id);
    },

    getMany: function(top, skip) {
      var params = {};

      vanRequestBuilder.addPaginationParameters(params, top, skip);

      return client.getResource('supporterGroups', params);
    },
    addPerson: function(sgId,vanId,action) {

      return (action=='remove') ? client.deleteResource('supporterGroups/' + sgId + '/people/' + vanId) : client.putResource('supporterGroups/' + sgId + '/people/' + vanId);
    }
  };
}

module.exports = supporterGroupsClient;
