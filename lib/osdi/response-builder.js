var config = require('../../config');

var root = config.get('apiEndpoint');
var _ = require('lodash');

function createCommonItem(name, description) {
  var embedded = {
    'origin_system': 'VAN',
    'name': name,
    'description': description
  };

  return embedded;
}

function createPaginatedItem(page, perPage, totalPages, totalRecords, path) {
  var paginated = {
    'total_pages': totalPages,
    'per_page': perPage,
    'page': page,
    'total_records': totalRecords
  };

  if (typeof page !== 'undefined' && page < 0) {
    throw new Error('page must be a non-negative integer');
  }

  if (page < totalPages) {
    var nextPath = path + '?page=' + (page + 1) + '&per_page=' + perPage;
    addLink(paginated, 'next', nextPath);
  }
  if (page > 1) {
    var previousPath = path + '?page=' + (page - 1) + '&per_page=' + perPage;
    addLink(paginated, 'previous', previousPath);
  }

  return paginated;
}

function addEmbeddedItems(paginated, items, formatter, resourceType) {
  if (resourceType) {
    var key = "";

    if (String(resourceType).includes(":")) {
      key = resourceType;
    } else {
      key = ("osdi:" + resourceType);
    }

    paginated._embedded = {};
    paginated._embedded[key] = items.map(formatter);

  } else {
    paginated._embedded = items.map(formatter);
  }

}


function addEmbeddedItem(paginated, item, formatter, resourceType) {
  if (resourceType) {
    var key = ("osdi:" + resourceType);
    paginated._embedded = {};
    paginated._embedded[key] = formatter(item);

  } else {
    paginated._embedded = formatter(item);
  }


}

function addLink(item, name, path) {
  item._links = item._links || {};
  item._links[name] = {
    href: root + path
  };
}

function addSelfLink(item, type, id) {
  addLink(item, 'self', type + '/' + id);
}

function addIdentifier(item, identifier) {
  item.identifiers = item.identifiers || [];
  item.identifiers.push(identifier);
}

function addCurie(item, template) {
  item._links = item._links || {};
  item._links.curies = [
    {
      name: 'osdi',
      'href': template,
      'templated': true
    }
  ];
}

function unauthorized(res) {
  return function () {
    return res.status(401).end();
  };
}

function badRequest(res, type) {
  return function (errors) {
    var response_code = 400;

    var answer = {
      'request_type': 'atomic',
      'response_code': response_code,
      'resource_status': [
        {
          'resource': 'osdi:' + type,
          'response_code': response_code,
          'errors': errors
        }
      ]
    };

    return res.status(response_code).send(answer);
  };
}

function notFound(res) {
  return function () {
    return res.status(404).end();
  };
}

function unexpected(res, type) {
  return function (referenceCode) {
    var response_code = 500;

    var answer = {
      'request_type': 'atomic',
      'response_code': response_code,
      'resource_status': [
        {
          'resource': 'osdi:' + type,
          'response_code': response_code,
          'errors': [
            {
              'error_code': 'UNEXPECTED_ERROR',
              'description': 'An unexpected error has occurred',
              'properties': [],
              'reference_code': referenceCode
            }
          ]
        }
      ]
    };

    return res.status(response_code).send(answer);
  };
}

module.exports = {
  createCommonItem: createCommonItem,
  createPaginatedItem: createPaginatedItem,
  addEmbeddedItems: addEmbeddedItems,
  addEmbeddedItem: addEmbeddedItem,
  addLink: addLink,
  addSelfLink: addSelfLink,
  addIdentifier: addIdentifier,
  addCurie: addCurie,
  unauthorized: unauthorized,
  badRequest: badRequest,
  notFound: notFound,
  unexpected: unexpected
};
