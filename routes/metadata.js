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

  bridge.sendMetadataResourceResponse(resourcePromise, req,
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
    "M": "number",
    "S": "SingleChoice"

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

  if (field_type == "SingleChoice") {
    var responses= _.map(res.availableValues, function(value) {
      return {
        key: value.id,
        name: value.name
      }
    })
    answer.responses=responses;
  }
  return answer;
}

function oneResourceTranslator(res) {

  var answer = res;
  //osdi.response.addIdentifier(answer, 'VAN:' + res.id);
  //osdi.response.addSelfLink(answer, 'groups', s.id);
  //osdi.response.addLink(answer,'osdi:items','groups/' + sg.id + '/items');
  osdi.response.addCurie(answer, config.get('curieTemplate'));

  return answer;
}


module.exports = function (app) {
  app.get('/api/v1/metadata/:resource', getAll);

};
