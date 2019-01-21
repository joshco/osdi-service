var osdi = require('../lib/osdi'),
    bridge = require('../lib/bridge'),
    config = require('../config');


function valueOrBlank(value) {
  var answer = value;

  if (!value) {
    answer = '';
  }

  return answer;
}

function getAll(req, res) {
  var vanClient = bridge.createClient(req);
  var vanPaginationParams = bridge.getVANPaginationParams(req);

  var resourcePromise = vanClient.supporterGroups.getMany(    vanPaginationParams.top, vanPaginationParams.skip);

  bridge.sendMultiResourceResponse(resourcePromise, vanPaginationParams,
    oneResourceTranslator, 'groups', res);
}

function getOne(req, res) {
  var vanClient = bridge.createClient(req);

  var id = 0;
  if (req && req.params && req.params.id) {
    id = req.params.id;
  }

  var resourcePromise = vanClient.supporterGroups.getOne(id);

  bridge.sendSingleResourceResponse(resourcePromise, oneResourceTranslator,
    'groups', res);
}

function oneResourceTranslator(sg) {
    var answer = osdi.response.createCommonItem(
      valueOrBlank(sg.name),
      valueOrBlank(sg.description));

  osdi.response.addIdentifier(answer, 'VAN:' + sg.id);
  osdi.response.addSelfLink(answer, 'groups', sg.id);
  osdi.response.addCurie(answer, config.get('curieTemplate'));
  
  return answer;
}

function add(req,res) {
  var vanClient= bridge.createClient(req);
  var vanId=0;
  var sgId=0;

  if (req && req.params && req.params.id && req.params.vanid) {
    vanId=req.params.vanid;
    sgId=req.params.id;
  }
  var sgPromise = vanClient.supporterGroups.addPerson(sgId,vanId);
  bridge.sendSingleResourceResponse(sgPromise,addTranslator, 'groups', res);

}


function add_helper(req,res) {
  var vanClient= bridge.createClient(req);
  var vanId=0;
  var sgId=0;

  if (req && req.body && req.body.van_id && req.body.group_id) {
    vanId=req.body.van_id;
    sgId=req.body.group_id;
  }
  var sgPromise = vanClient.supporterGroups.addPerson(sgId,vanId);
  bridge.sendSingleResourceResponse(sgPromise,addTranslator, 'groups', res);

}

function addTranslator(add) {
  var answer=add;
  return answer;

}

module.exports = function (app) {
  app.get('/api/v1/groups', getAll);
  app.get('/api/v1/groups/:id', getOne);
  app.put('/api/v1/groups/:id/people/:vanid', add);
  app.post('/api/v1/groups/add_helper', add_helper);
};
