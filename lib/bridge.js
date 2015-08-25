
/**
 * Creates a bridge between OSDI and VAN using the osdi and ngpvan-api-client 
 * modules.
 */

var ngpvanAPIClient = require('./ngpvan-api-client'),
    osdi = require('../lib/osdi'),
    config = require('../config');

/**
 * Take an OSDI request and create a VAN client.
 */
function createClient(req) {
  var endpoint = config.get('vanEndpoint');
  
  var apiToken = osdi.request.getAPIToken(req);
  var credentials = getCredentials(apiToken);
  
  return ngpvanAPIClient.van(endpoint, credentials.apiKey, credentials.dbMode);
}

function getCredentials(apiToken) {
  if (typeof apiToken !== 'string') {
    return {};
  }

  var parts = apiToken.split('|');
  return { apiKey: parts[0], dbMode: parts[1] };
}

/**
 * Take an OSDI request and return VAN pagination parameters in the form
 * { top: 10, skip: 0 }
 */
function getVANPaginationParams(req) {
  var pagination = osdi.request.getPaginationOptions(req);
  
  var top = config.get('defaultVanPageSize');
  var skip = null;
  
  if (pagination.page && pagination.perPage) {
    top = pagination.perPage;
    skip = (pagination.page - 1) * pagination.perPage;
  }
  else if (pagination.perPage) {
    top = pagination.perPage;
  }
  
  return { 'top': top, 'skip': skip };
}

/**
 * Send an OSDI "single-resource" response, given the VAN resource promise
 * and a translator function.
 */
function sendSingleResourceResponse(resourcePromise, translator, 
  resourceType, res) {
  
  resourcePromise.
    then(function(vanResource) {
  	  var osdiResource = translator(vanResource);
      return res.status(200).send(osdiResource);
    }).
    catch(ngpvanAPIClient.errors.Forbidden, 
      function() { return osdi.response.unauthorized(res); }).
    catch(ngpvanAPIClient.errors.NotFound, function(ex) { 
      return osdi.response.badRequest(res, resourceType)(ex);
    }).
    catch(ngpvanAPIClient.errors.Unexpected, function (ex) { 
      return osdi.response.badRequest(res, resourceType)(ex);
    });
}

/**
 * Send an OSDI "single-resource" response, given the VAN resource promise and 
 * OSDI pagination parameters, and a function for translating a single 
 * VAN resource into a single OSDI resource.
 */
function sendMultiResourceResponse(resourcePromise, vanPaginationParams, 
  translator, resourceType, res) {
  
  resourcePromise.
    then(function(vanResources) {
      var totalRecords = vanResources.count;
      var totalPages = Math.ceil(totalRecords / vanPaginationParams.top);
      var page = Math.floor(vanPaginationParams.skip / vanPaginationParams.top) 
        + 1;
      
      var answer = osdi.response.createPaginatedItem(page,
        vanPaginationParams.top, totalPages, totalRecords, resourceType);

      var items = vanResources.items;
      osdi.response.addEmbeddedItems(answer, items, translator);
      return res.status(200).send(answer);
    }).
    catch(ngpvanAPIClient.errors.Forbidden,
      function() { return osdi.response.unauthorized(res)(); }).
    catch(ngpvanAPIClient.errors.NotFound, function(ex) {
      return osdi.response.badRequest(res, resourceType)(ex);
    }).
    catch(ngpvanAPIClient.errors.Unexpected, function (ex) {
      return osdi.response.badRequest(res, resourceType)(ex);
    }).
    catch(function(ex) {
      return osdi.response.badRequest(res, resourceType)(ex);
    });
}

module.exports = {
  createClient: createClient,
  getVANPaginationParams: getVANPaginationParams,
  sendSingleResourceResponse: sendSingleResourceResponse,
  sendMultiResourceResponse: sendMultiResourceResponse
};