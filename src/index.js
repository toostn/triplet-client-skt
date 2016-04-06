var X2JS = require('x2js');
var Client = require('triplet-core/client.js');
var parsers = require('./parsers.js');
var urlParams = require('./url-params');

var BASE_URL = 'http://www.labs.skanetrafiken.se/v2.2';

function sktUrl(endpoint) {
  return BASE_URL + endpoint;
}

module.exports = function sktClientFactory(http) {
  var SKTClient = new Client(http, {
    shortName: 'skt',
    fullName: 'Skånetrafiken',
    params: urlParams,
    parsers: parsers,
    stations: sktUrl('/querypage.asp'),
    trips: sktUrl('/resultspage.asp'),
    nearbyStations: sktUrl('/neareststation.asp'),
    geojson: require('./area.json'),
    supports: {
      realtime: true,
      coordinateSearch: false,
      quickMode: false
    }
  });

  var x2Js = new X2JS();

  function parseXML(response) {
    return (response &&
            typeof response.headers === 'function' &&
            isXML(response.headers('content-type'))) ?
      x2Js.xml2js(response.data) :
      response;
  }

  function isXML(contentType) {
    return contentType ? contentType.search(/\Wxml/i) > -1 : false;
  }

  SKTClient._request = function _request(endpoint, query) {
    var config = this.config;
    return this.http({
      method: 'GET',
      url: config[endpoint],
      params: config.params[endpoint](query, config)
    }).then(function(res) {
      var errorParser = config.parsers[endpoint + 'Error'];
      var json = parseXML(res);
      query.error = errorParser ? errorParser(json) : null;
      query.results = query.error ? null : config.parsers[endpoint](json, query);
      return query;
    }, function(res) {
      query.error = serverErrorText(res);
      return query;
    });
  };

  return SKTClient;
};
