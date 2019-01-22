var osdi = require('../lib/osdi'),
    bridge = require('../lib/bridge'),
    config = require('../config'),
    pathMatch = require('path-match')({
      // path-to-regexp options
      sensitive: false,
      strict: false,
      end: false
    });
var parse = require('url').parse;


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


function getItems(req,res) {
  var answer= {
    "_embedded": {
      "osdi:items": []
    }
  };
  osdi.response.addLink(answer,'osdi:group','groups/' + req.params.id);
  osdi.response.addLink(answer,'osdi:list','groups/' + req.params.id);
  osdi.response.addLink(answer,'self','groups/' + req.params.id + '/items');

  return res.status(200).send(answer);

}
function oneResourceTranslator(sg) {
    var answer = osdi.response.createCommonItem(
      valueOrBlank(sg.name),
      valueOrBlank(sg.description));

  osdi.response.addIdentifier(answer, 'VAN:' + sg.id);
  osdi.response.addSelfLink(answer, 'groups', sg.id);
  osdi.response.addLink(answer,'osdi:items','groups/' + sg.id + '/items');
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
  var action='add';

  if (req && req.body && req.body.van_id && req.body.group_id) {
    vanId=req.body.van_id;
    sgId=req.body.group_id;
    if (req.body.action) {
      action=req.body.action;
    }
  }

  var sgPromise = vanClient.supporterGroups.addPerson(sgId,vanId,action);
  bridge.sendSingleResourceResponse(sgPromise,addTranslator, 'groups', res);

}

function post_item(req,res) {
  var vanClient= bridge.createClient(req);
  var vanId=0;
  var sgId=0;
  var action='add';

  if (req && req.params.id) {
    sgId=req.params.id;
  }

  if (req && req.body && req.body._links) {

    if (req.body.action) {
      action=req.body.action;
    }
    sgUrl=req.body._links['osdi:person'].href;
    var sgRoute=pathMatch('/api/v1/people/:id');
    var matches=sgRoute(parse(sgUrl).pathname);
    vanId=matches.id;
  }

  var sgPromise = vanClient.supporterGroups.addPerson(sgId,vanId,action).then(function() { return { body: req.body, params: req.params, vanId: vanId, sgId: sgId, action: action}});
  bridge.sendSingleResourceResponse(sgPromise,addTranslator, 'groups', res);

}

function addTranslator(add) {
  var answer={
    "status": add.action
  };

  osdi.response.addLink(answer,'osdi:person','people/' + add.params.id);

  osdi.response.addLink(answer,'osdi:group','groups/' + add.params.id);
  osdi.response.addLink(answer,'osdi:list','groups/' + add.params.id);
  osdi.response.addLink(answer,'self','groups/' + add.params.id + '/items');

  return answer;

}

module.exports = function (app) {
  app.get('/api/v1/groups', getAll);
  app.get('/api/v1/groups/:id', getOne);
  app.get('/api/v1/groups/:id/items', getItems);
  app.put('/api/v1/groups/:id/people/:vanid', add);
  app.post('/api/v1/groups/add_helper', add_helper);
  app.post('/api/v1/groups/:id/items', post_item);
};
