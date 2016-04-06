var Station = require('../../trip-models/station');
var GeoPoint = require('../../trip-models/geopoint');
var Trip = require('../../trip-models/trip');
var Leg = require('../../trip-models/leg');
var LegStop = require('../../trip-models/leg-stop');
var Carrier = require('../../trip-models/carrier.js');
var Line = require('../../trip-models/line');
var Location = require('../../trip-models/location');
var RT90Util = require('../../util/rt90-util.js');
var Utils = require('../common/utils.js');

var forceArray = Utils.forceArray;
var parseDate = Utils.parseLocalDate;

function soapBody(json) {
  if (json && json.Envelope) { return json.Envelope.Body; }
  return undefined;
}

function error(res) {
  if (!res) { return 'roerrorinternal'; }
  if (res.Code !== 0) { return res.Message; }
  return undefined;
}

function stationsResult(json) {
  var body = soapBody(json);

  return (body && body.GetStartEndPointResponse) ?
    body.GetStartEndPointResponse.GetStartEndPointResult :
    undefined;
}

exports.stationsError = function(json) {
  return error(stationsResult(json));
};

exports.stations = function stations(json) {
  var res = stationsResult(json);

  if (!res.StartPoints) { return []; }
  return forceArray(res.StartPoints.Point).map(station);
};

function nearbyStationsResult(json) {
  var body = soapBody(json);

  return (body && body.GetNearestStopAreaResponse) ?
    body.GetNearestStopAreaResponse.GetNearestStopAreaResult :
    undefined;
}

exports.nearbyStationsError = function nearbyStationsError(json) {
  return error(nearbyStationsResult(json));
};

exports.nearbyStations = function nearbyStations(json) {
  var res = nearbyStationsResult(json);

  if (!res.NearestStopAreas) { return []; }

  return forceArray(res.NearestStopAreas.NearestStopArea).map(station);
};

function tripsResult(json) {
  var body = soapBody(json);

  return (body && body.GetJourneyResponse) ?
    body.GetJourneyResponse.GetJourneyResult :
    undefined;
}

exports.tripsError = function tripsError(json) {
  return error(tripsResult(json));
};

exports.trips = function(json) {
  var res = tripsResult(json);

  if (!res.Journeys) { return []; }

  return forceArray(res.Journeys.Journey).map(trip);
};

function station(json) {
  if (!json.Type || json.Type === "STOP_AREA") {
    var location = (json.X && json.Y) ? RT90Util.toWGS84(json) : new Location();

    return new Station({
      id: json.Id,
      name: json.Name,
      location: location,
      clientId: 'skt'
    });
  }

  return new GeoPoint({
    id: json.Id,
    name: json.Name,
    location: new Location(json.X, json.Y),
    clientId: 'skt'
  });
}

function trip(json) {
  if (!json.RouteLinks) { return undefined; }

  return new Trip({
    legs: forceArray(json.RouteLinks.RouteLink).map(leg)
  });
}

function leg(json) {
  return new Leg({
    from: legStop(json, 'From', 'Dep'),
    to: legStop(json, 'To', 'Arr'),
    carrier: carrier(json),
    messages: messages(json)
  });
}

function legStop(json, pointKey, timeKeyPrefix) {
  var legStation = json[pointKey];
  var timeString = json[timeKeyPrefix + 'DateTime'];
  var isRealTime = json[timeKeyPrefix + 'IsTimingPoint'] === 'true';

  return new LegStop({
    point: station(legStation),
    track: track(json, legStation, timeKeyPrefix),
    plannedDate: date(timeString),
    realTimeDate: isRealTime ? date(timeString) : undefined,
  });
}

function track(json, station, timeKeyPrefix) {
  var trackRealTimeKey = 'New' + timeKeyPrefix + 'Point';
  var trackName = station.StopPoint;

  if (json.RealTime) {
    forceArray(json.RealTime.RealTimeInfo).map(function(info) {
      if (info[trackRealTimeKey]) {
        trackName = info[trackRealTimeKey];
      }
    });
  }

  return trackName;
}

function carrier(json) {
  var name;
  var lineJson = json.Line;
  var cancelled = json.RealTimeInfo && json.RealTimeInfo.Canceled === 'true';
  var type = carrierType(parseInt(lineJson.TransportModeId));

  if (type === Carrier.Types.train) {
    name = lineJson.Name + ' ' + lineJson.TrainNo;
  } else {
    name = lineJson.TransportModeName + ' ' + lineJson.Name;
  }


  return new Carrier({
    name: name,
    heading: lineJson.Towards,
    type: type,
    line: line(lineJson),
    cancelled: cancelled,
    flags: {
      accessibility: (parseInt(json.Accessibility) > 0),
      needsBooking: json.CallTrip === 'true'
    }
  });
}

function carrierType(type) {
  var types = Carrier.Types;

  if (type === 0) { return types.walk; }
  else if (type === 1 || type === 2 || type === 16) { return types.bus; }
  else if (type === 4) { return types.train; }
  else if (type === 8) { return types.boat; }
  return types.unknown;
}

function date(timeString) {
  var components = timeString.split('T');
  return parseDate(components[0], components[1]);
}

function line(json) {
  return new Line({
    name: json.No || json.TrainNo || '',
    colorFg: '#ffffff',
    colorBg: '#555555'
  });
}

function messages(json) {
  if (!json.Deviations) { return []; }

  return forceArray(json.Deviations.Deviation).map(message);
}

function message(json) {
  return json.Details;
}
