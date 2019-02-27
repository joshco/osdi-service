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

  var resource=req.params.resource;

  var vanResource=_.camelCase(resource);
  var resourcePromise = vanClient.widgets.getMany(vanResource,    vanPaginationParams.top, vanPaginationParams.skip);

  bridge.sendMultiResourceResponse(resourcePromise, vanPaginationParams,
    pick_translator(resource), resource, res);
}

function pick_translator(resource) {
  var trn;
  var map={
    'custom_fields': function(res) { return customFieldTranslator(res)}
  };
  if (!(trn=map[resource])) {
    trn=oneResourceTranslator;
  }
  return trn;
}

function getOne(req, res) {
  var vanClient = bridge.createClient(req);

  var id = 0;
  var resource=req.params.resource;
  var vanResource=_.camelCase(resource);

  if (req && req.params && req.params.id) {
    id = req.params.id;
  }

  var resourcePromise = vanClient.widgets.getOne(vanResource,id);

  bridge.sendSingleResourceResponse(resourcePromise, pick_translator(resource),resource, res);
}

function customFieldTranslator(res) {
/*
{
          "customFieldId": 309,
          "customFieldParentId": null,
          "customFieldName": "BIrth Year",
          "customFieldGroupId": 114,
          "customFieldGroupName": "sync",
          "customFieldGroupType": "Contacts",
          "customFieldTypeId": "N",
          "isEditable": true,
          "maxTextboxCharacters": null,
          "availableValues": null,
          "isExportable": true
 */
  var name="van_" + res.customFieldGroupId + "_" + res.customFieldId + "|" + _.snakeCase(res.customFieldName);

  var field_types={
    "N": "number",
    "D": "datetime",
    "T": "string",
    "B": "boolean",
    "M": "number"

  };

  var field_type=field_types[res.customFieldTypeId] || 'String';

  var id=res.customFieldId;

  var resource_types ={
    "Contacts": "people",
    "Contributions": "donations"
  };

  var resource_type= resource_types[res.customFieldGroupType] || 'Unknown';

  var answer={
    identifiers: [ 'VAN:' + id ],
    name: name,
    field_type: field_type,
    resource_type: resource_type
  };
  osdi.response.addLink(answer,'self','widgets/custom_fields/' + id);

  return answer;
}

function oneResourceTranslator(res) {
  console.log("translator");

  console.log(res);

  var answer = res;
  //osdi.response.addIdentifier(answer, 'VAN:' + res.id);
  //osdi.response.addSelfLink(answer, 'groups', s.id);
  //osdi.response.addLink(answer,'osdi:items','groups/' + sg.id + '/items');
  osdi.response.addCurie(answer, config.get('curieTemplate'));

  return answer;
}


module.exports = function (app) {
  app.get('/api/v1/widgets/:resource', getAll);
  app.get('/api/v1/widgets/:resource/:id', getOne);

};
