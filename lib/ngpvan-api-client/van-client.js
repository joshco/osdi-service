
var errors = require('./errors'),
    config = require('../../config'),
    $http = require('http-as-promised');

function vanHTTP(endpoint, apiKey, dbMode) {

  var myEndpoint = endpoint;
  var myApiKey = apiKey;
  var myDbMode = dbMode;

  function getResource(path, queryStringParams) {
    var pass = myApiKey + '|' + myDbMode;
    var options = {
      headers: { 'Content-Type': 'application/json' },
      auth: { user: 'api', pass: pass }
    };

    if (queryStringParams) {
      options.qs = queryStringParams;
    }

    console.info('Sending get request: ', myEndpoint + path,"q: ",queryStringParams);

    return $http.get(myEndpoint + path, options).
      spread(function(response) {
        if (config.get('trace')) {
          console.info(response.body);
        }
        return parseBody(response.body);
      }).
      catch($http.error['400'], function (response) {
        var parsedBody = parseBody(response.body);
        throw new errors.BadRequest({ 'errors': parsedBody.errors });
      }).
      catch($http.error['401'], function () { throw new errors.Forbidden(); }).
      catch($http.error['403'], function () { throw new errors.Forbidden(); }).
      catch($http.error['404'], function () { throw new errors.NotFound(); }).
      catch($http.error['500'], function (e) {
        var referenceCode = JSON.parse(e.body).errors[0].referenceCode;
        throw new errors.Unexpected({ referenceCode: referenceCode});
      });
  }

  function postResource(path, data) {
    var pass = myApiKey + '|' + myDbMode;

    var options = {
      headers: {'Content-Type': 'application/json'},
      auth: {user: 'api', pass: pass},
      body: JSON.stringify(data)
    };

    console.info('Sending post request: ', myEndpoint + path);

    return $http.post(myEndpoint + path, options).
      spread(function(response) {
        return parseBody(response.body);
      }).
      catch($http.error['400'], function (response) {
        var parsedBody = parseBody(response.body);
        throw new errors.BadRequest({ 'errors': parsedBody.errors });
      }).
      catch($http.error['401'], function () { throw new errors.Forbidden(); }).
      catch($http.error['403'], function () { throw new errors.Forbidden(); }).
      catch($http.error['404'], function () { throw new errors.NotFound(); }).
      catch($http.error['500'], function (e) {
        var referenceCode = JSON.parse(e.body).errors[0].referenceCode;
        throw new errors.Unexpected({ referenceCode: referenceCode});
      });
  }

  function putResource(path) {
    var pass = myApiKey + '|' + myDbMode;

    var options = {
      headers: {'Content-Type': 'application/json'},
      auth: {user: 'api', pass: pass}
    };

    console.info('Sending put request: ', myEndpoint + path);

    return $http.put(myEndpoint + path, options).
    spread(function(response) {
      return parseBody(response.body);
    }).
    catch($http.error['400'], function (response) {
      var parsedBody = parseBody(response.body);
      throw new errors.BadRequest({ 'errors': parsedBody.errors });
    }).
    catch($http.error['401'], function () { throw new errors.Forbidden(); }).
    catch($http.error['403'], function () { throw new errors.Forbidden(); }).
    catch($http.error['404'], function () { throw new errors.NotFound(); }).
    catch($http.error['500'], function (e) {
      var referenceCode = JSON.parse(e.body).errors[0].referenceCode;
      throw new errors.Unexpected({ referenceCode: referenceCode});
    });
  }

  function deleteResource(path) {
    var pass = myApiKey + '|' + myDbMode;

    var options = {
      headers: {'Content-Type': 'application/json'},
      auth: {user: 'api', pass: pass}
    };

    console.info('Sending delete request: ', myEndpoint + path);

    return $http.del(myEndpoint + path, options).
    spread(function(response) {
      return parseBody(response.body);
    }).
    catch($http.error['400'], function (response) {
      var parsedBody = parseBody(response.body);
      throw new errors.BadRequest({ 'errors': parsedBody.errors });
    }).
    catch($http.error['401'], function () { throw new errors.Forbidden(); }).
    catch($http.error['403'], function () { throw new errors.Forbidden(); }).
    catch($http.error['404'], function () { throw new errors.NotFound(); }).
    catch($http.error['500'], function (e) {
      var referenceCode = JSON.parse(e.body).errors[0].referenceCode;
      throw new errors.Unexpected({ referenceCode: referenceCode});
    });
  }

  function parseBody(body) {
    if (body) {
      return JSON.parse(body);
    }
    else {
      return {};
    }
  }

  return {
    getResource: getResource,
    postResource: postResource,
    putResource: putResource,
    deleteResource: deleteResource
  };
}


module.exports = function (endpoint, apiKey, dbMode) {
  var client = vanHTTP(endpoint, apiKey, dbMode);

  return {
    activistCodes: require('./activistCodes')(client),
    surveyQuestions: require('./surveyQuestions')(client),
    people: require('./people')(client),
    events: require('./events')(client),
    resultCodes: require('./resultCodes')(client),
    supporterGroups: require('./supporterGroups')(client),
    widgets: require('./widgets')(client)
  };
};
