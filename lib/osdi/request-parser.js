var config = require('../../config');
_ = require('lodash')

function getAPIToken(req) {
  if (!req || !req.headers || !req.headers ||
      !req.headers['osdi-api-token']) {
    return '';
  }
  return req.headers['osdi-api-token'];
}

function getExpands(req, defaults) {
  var expands=defaults;
  var query = req.query;

  if (query['$expand']) {

    expands=defaults.concat(query['$expand'].split(','));
  }

  expands= _.uniq(expands);
  return expands;
}

function getFilter(req) {
  var query = req.query;
  filter={};
  if ( query.starting_before ) {
    filter.startingBefore = query.starting_before;
  }
  if (query.starting_after) {
    filter.startingAfter=query.starting_after;
  }
  if (query.code_ids) {
    filter.codeIds=query.code_ids;
  }

  return filter;
}

function getPaginationOptions(req) {
  var options = {};
  if (!req || !req.query) {
    return options;
  }

  var query = req.query;
  if (query.per_page) {
    options.perPage = parseInt(query.per_page, 10);
  }
  else {
    // TODO: remove this, not really an OSDI property
    options.perPage = config.get('defaultVanPageSize');
  }

  if (query.page) {
    // TODO: shouldn't this be 1, not 10?  default page number is 1 right?
    options.page = parseInt(query.page, 10);
  }

  return options;
}

module.exports = {
  getExpands: getExpands,
  getFilter: getFilter,
  getAPIToken: getAPIToken,
  getPaginationOptions: getPaginationOptions
};
