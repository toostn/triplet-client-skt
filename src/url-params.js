var LocalTime = require('triplet-core/local-time.js')
var rt90Util = require('triplet-core/util/rt90-util.js')
var dtString = require('triplet-core/util/client-util.js').dtString
var PAST_TRIP_SEARCH_TIME = 300000

exports.trips = function trips (query) {
  var params = {
    NoOf: query.maxResults || 6,
    cmdAction: 'search'
  }

  var from = query.from
  var to = query.to

  if (from.id !== null || from.id !== undefined) {
    params.selPointFr = stationParam(from)
  }

  if (to.id !== null && to.id !== undefined) {
    params.selPointTo = stationParam(to)
  }

  var localDate = LocalTime.get()
  var date = query.date || new Date(localDate.getTime() - PAST_TRIP_SEARCH_TIME)

  params.inpDate =
    date.getFullYear().toString().substr(2, 2) +
    dtString(date.getMonth() + 1) +
    dtString(date.getDate())

  params.inpTime = dtString(date.getHours()) + ':' + dtString(date.getMinutes())

  return params
}

function stationParam (station) {
  var type = station.type === 'GeoPoint' ? 1 : 0
  return [station.name, station.id, type].join('|')
}

exports.nearbyStations = function nearbyStations (query) {
  var params = {
    r: query.radius || 3000
  }

  if (query.location) {
    var rt90 = rt90Util.fromWGS84(query.location)
    params.x = rt90.x
    params.y = rt90.y
  }

  return params
}

exports.stations = function stations (query) {
  return {
    inpPointFr: query.queryString,
    inpPointTo: 'abc'
  }
}
