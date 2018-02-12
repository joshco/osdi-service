var osdi = require('../lib/osdi'),
  bridge = require('../lib/bridge'),
  config = require('../config');

function getAll(req, res) {
  var vanClient = bridge.createClient(req);
  var vanPaginationParams = bridge.getVANPaginationParams(req);

  var resourcePromise = vanClient.resultCodes.getMany(null, null, null,
    vanPaginationParams.top, vanPaginationParams.skip);

  bridge.sendSingleResourceResponse(resourcePromise, oneArrayTranslator,
    'response_codes', res);

}

function getAll2(req, res) {
  var vanClient = bridge.createClient(req);
  var vanPaginationParams = bridge.getVANPaginationParams(req);

  var resourcePromise = vanClient.resultCodes.getMany(null, null, null,
    vanPaginationParams.top, vanPaginationParams.skip);

  bridge.sendSingleResourceResponse(resourcePromise, arrayTranslator,
    'response_codes', res);

}

function arrayTranslator(res) {
  var answer=res.map(function (rc){
    return {
      response_code: rc.resultCodeId,
      name: rc.name

    }
  } );

  return answer;
}
function oneArrayTranslator(res) {
  var answer = osdi.response.createCommonItem(
    "Available response codes",
    "Available response codes");

  osdi.response.addIdentifier(answer, 'VAN:ResultCodes');
  osdi.response.addLink(answer, 'self', 'metadata/canvass_response_codes');
  osdi.response.addCurie(answer, config.get('curieTemplate'));

  answer.response_codes=res.map(function (rc){
    return {
      response_code: String(rc.resultCodeId),
      name: rc.name

    }
  } );

  return answer;
}
function oneResourceTranslator(rc) {
  console.info(rc);



  return answer;
}

module.exports = function (app) {
  app.get('/api/v1/metadata/canvass_response_codes', getAll);
  app.get('/api/v1/metadata/canvass_response_codes2', getAll2);
};
