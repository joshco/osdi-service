var _ = require('lodash'),
  vanRequestBuilder = require('./van-request-builder');

function widgetsClient(vanHTTP) {

  var client = vanHTTP;

  return {
    getOne: function (resource,id) {
      return client.getResource(resource +'/' + id);
    },

    getMany: function (resource, top, skip) {
      var params = {};

      vanRequestBuilder.addPaginationParameters(params, top, skip);

      return client.getResource(resource, params);
    }
  }
}

module.exports = widgetsClient;
