/**
 * Homepage mini map
 *
 * Adapted from the standalone MiniMap toy: a fixed grid grows inside a
 * responsive canvas while small vehicles travel between colored stations.
 */
(function (global) {
  'use strict';

  var CELL = 21;
  var ROAD_WIDTH = 6;
  var STATION_RADIUS = 7;
  var MOVEMENT_TIME_SCALE = 2;
  var BURST_GROWTH_TIME_SCALE = 4;
  var SETTLED_GROWTH_TIME_SCALE = 2;
  var BURST_DURATION = 10;
  var STATION_GAP = 2;
  var CITY_STATION_RADIUS = 5;
  var CITY_STATION_THRESHOLD = 4;
  var CITY_DESTINATION_THRESHOLD = 2;
  var MAX_ROADS = 320;
  var MAX_STATIONS = 72;
  var MAX_VEHICLES = 60;
  var MAX_X = 18;
  var MAX_Y = 10;
  var DIRECTIONS = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 }
  ];
  var COLORS = {
    road: '#c5c1b8',
    roadEdge: '#b0aca3',
    vehicle: '#3a3a3a',
    origins: ['#e85d4c', '#3d8bdb', '#e6b325', '#2fa36b', '#8e5bb8', '#e07a3d'],
    destinations: ['#c44536', '#2b6cb0', '#c49214', '#1e7a52', '#6f3d99', '#c45e22']
  };

  function key(x, y) {
    return x + ',' + y;
  }

  function parseKey(value) {
    var parts = value.split(',');
    return { x: Number(parts[0]), y: Number(parts[1]) };
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function mount(target) {
    var host = typeof target === 'string' ? document.querySelector(target) : target;
    if (!host) throw new Error('HomeMiniMap.mount: target not found');

    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    host.innerHTML = '';
    host.appendChild(canvas);

    var context = canvas.getContext('2d');
    var roads = new Map();
    var stations = [];
    var stationAt = new Map();
    var vehicles = [];
    var originCount = 0;
    var destinationCount = 0;
    var nextStationIsOrigin = true;
    var viewWidth = 1;
    var viewHeight = 1;
    var elapsed = 0;
    var wallElapsed = 0;
    var lastTime = 0;
    var nextRoadAt = 3.2;
    var nextStationAt = 4;
    var nextVehicleAt = 2;
    var frame = 0;
    var alive = true;
    var seed = 246813579;

    function random() {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    function pick(items) {
      return items[Math.floor(random() * items.length)];
    }

    function weightedPick(items, weightFor) {
      var total = items.reduce(function (sum, item) {
        return sum + weightFor(item);
      }, 0);
      var cursor = random() * total;
      for (var index = 0; index < items.length; index += 1) {
        cursor -= weightFor(items[index]);
        if (cursor <= 0) return items[index];
      }
      return items[items.length - 1];
    }

    function isInBounds(point) {
      return Math.abs(point.x) <= MAX_X && Math.abs(point.y) <= MAX_Y;
    }

    function adjacentPoints(x, y) {
      return DIRECTIONS.map(function (direction) {
        return { x: x + direction.x, y: y + direction.y };
      });
    }

    function addRoad(x, y) {
      var roadKey = key(x, y);
      if (roads.has(roadKey)) return roads.get(roadKey);
      if (roads.size >= MAX_ROADS || !isInBounds({ x: x, y: y })) return null;

      var road = { x: x, y: y, neighbors: [] };
      roads.set(roadKey, road);
      DIRECTIONS.forEach(function (direction) {
        var neighbor = roads.get(key(x + direction.x, y + direction.y));
        if (neighbor) {
          road.neighbors.push(neighbor);
          neighbor.neighbors.push(road);
        }
      });
      return road;
    }

    function frontier() {
      var candidates = new Map();
      roads.forEach(function (road) {
        adjacentPoints(road.x, road.y).forEach(function (point) {
          var pointKey = key(point.x, point.y);
          if (!isInBounds(point) || roads.has(pointKey)) return;
          if (candidates.has(pointKey)) {
            candidates.get(pointKey).roadConnections += 1;
          } else {
            candidates.set(pointKey, {
              x: point.x,
              y: point.y,
              roadConnections: 1
            });
          }
        });
      });
      return Array.from(candidates.values());
    }

    function localStationDensity(point) {
      var nearby = 0;
      var destinations = 0;
      stations.forEach(function (station) {
        if (distance(station, point) <= CITY_STATION_RADIUS) {
          nearby += 1;
          if (station.type === 'destination') destinations += 1;
        }
      });
      return { nearby: nearby, destinations: destinations };
    }

    function nearestStationDistance(point) {
      var nearest = MAX_X + MAX_Y;
      stations.forEach(function (station) {
        nearest = Math.min(nearest, distance(station, point));
      });
      return nearest;
    }

    function layoutDirectionWeight(point) {
      if (point.roadConnections !== 1) return 1;

      var horizontalExtension = roads.has(key(point.x - 1, point.y)) ||
        roads.has(key(point.x + 1, point.y));
      var verticalExtension = roads.has(key(point.x, point.y - 1)) ||
        roads.has(key(point.x, point.y + 1));
      var longestSide = Math.max(viewWidth, viewHeight);
      var aspectStrength = longestSide > 0
        ? Math.abs(viewWidth - viewHeight) / longestSide
        : 0;
      var prefersHorizontal = viewWidth >= viewHeight;
      var followsLayout = prefersHorizontal ? horizontalExtension : verticalExtension;

      return followsLayout ? 1 + aspectStrength * 0.65 : 1;
    }

    function canCloseCityGrid(point) {
      var density = localStationDensity(point);
      return density.nearby >= CITY_STATION_THRESHOLD &&
        density.destinations >= CITY_DESTINATION_THRESHOLD;
    }

    function extendRoads(count) {
      for (var index = 0; index < count && roads.size < MAX_ROADS; index += 1) {
        var candidates = frontier();
        if (!candidates.length) return;
        var branches = candidates.filter(function (point) {
          return point.roadConnections === 1;
        });
        var cityGrid = candidates.filter(function (point) {
          return point.roadConnections > 1 && canCloseCityGrid(point);
        });
        var useCityGrid = cityGrid.length && random() < 0.45;
        var pool = useCityGrid ? cityGrid : branches;
        if (!pool.length) pool = cityGrid;
        if (!pool.length) return;

        var point = weightedPick(pool, function (candidate) {
          if (candidate.roadConnections > 1) {
            return 2 + candidate.roadConnections * 2;
          }
          return layoutDirectionWeight(candidate) * (1 +
            Math.min(nearestStationDistance(candidate), 8) * 0.4 +
            distance(candidate, { x: 0, y: 0 }) * 0.06);
        });
        addRoad(point.x, point.y);
      }
    }

    function distance(a, b) {
      return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }

    function isNearStation(point) {
      return stations.some(function (station) {
        return distance(station, point) < STATION_GAP;
      });
    }

    function createStation(point, type) {
      if (stations.length >= MAX_STATIONS || stationAt.has(key(point.x, point.y))) return;
      if (!addRoad(point.x, point.y)) return;

      if (!type) {
        type = nextStationIsOrigin ? 'origin' : 'destination';
        if (!originCount) type = 'origin';
        else if (!destinationCount) type = 'destination';
      }
      var palette = type === 'origin' ? COLORS.origins : COLORS.destinations;
      var station = {
        x: point.x,
        y: point.y,
        type: type,
        color: palette[stations.length % palette.length]
      };

      stations.push(station);
      stationAt.set(key(point.x, point.y), station);
      if (type === 'origin') originCount += 1;
      else destinationCount += 1;
      nextStationIsOrigin = !nextStationIsOrigin;
    }

    function addStation() {
      if (stations.length >= MAX_STATIONS) return;

      var candidates = frontier().filter(function (point) {
        var roadShapeAllowed = point.roadConnections === 1 || canCloseCityGrid(point);
        return roadShapeAllowed &&
          !stationAt.has(key(point.x, point.y)) &&
          !isNearStation(point);
      });
      if (!candidates.length) return;
      createStation(weightedPick(candidates, function (candidate) {
        return layoutDirectionWeight(candidate) *
          (1 + Math.min(nearestStationDistance(candidate), 6) * 0.12);
      }));
    }

    function findPath(start, end) {
      var startKey = key(start.x, start.y);
      var endKey = key(end.x, end.y);
      var queue = [startKey];
      var cameFrom = new Map();
      var cursor = 0;
      cameFrom.set(startKey, null);

      while (cursor < queue.length) {
        var currentKey = queue[cursor];
        cursor += 1;
        if (currentKey === endKey) break;
        roads.get(currentKey).neighbors.forEach(function (neighbor) {
          var neighborKey = key(neighbor.x, neighbor.y);
          if (!cameFrom.has(neighborKey)) {
            cameFrom.set(neighborKey, currentKey);
            queue.push(neighborKey);
          }
        });
      }

      if (!cameFrom.has(endKey)) return null;
      var path = [];
      var step = endKey;
      while (step) {
        path.push(parseKey(step));
        step = cameFrom.get(step);
      }
      return path.reverse();
    }

    function spawnVehicle() {
      if (vehicles.length >= MAX_VEHICLES) return;
      var origins = stations.filter(function (station) { return station.type === 'origin'; });
      var destinations = stations.filter(function (station) { return station.type === 'destination'; });
      if (!origins.length || !destinations.length) return;

      var returning = random() < 0.45;
      var start = returning ? pick(destinations) : pick(origins);
      var end = returning ? pick(origins) : pick(destinations);
      var path = findPath(start, end);
      if (!path || path.length < 2) return;
      var homeStation = returning ? end : start;

      vehicles.push({
        path: path,
        segment: 0,
        progress: 0,
        speed: 1.45 + random() * 0.75,
        opacity: 0,
        leaving: false,
        color: homeStation.color
      });
    }

    function updateVehicles(delta) {
      for (var index = vehicles.length - 1; index >= 0; index -= 1) {
        var vehicle = vehicles[index];
        if (vehicle.leaving) {
          vehicle.opacity -= delta * 3;
          if (vehicle.opacity <= 0) vehicles.splice(index, 1);
          continue;
        }

        vehicle.opacity = clamp(vehicle.opacity + delta * 3.5, 0, 1);
        vehicle.progress += vehicle.speed * delta;
        while (vehicle.progress >= 1 && !vehicle.leaving) {
          vehicle.progress -= 1;
          vehicle.segment += 1;
          if (vehicle.segment >= vehicle.path.length - 1) {
            vehicle.segment = vehicle.path.length - 1;
            vehicle.progress = 0;
            vehicle.leaving = true;
          }
        }
      }
    }

    function screenPoint(x, y) {
      return {
        x: viewWidth / 2 + x * CELL,
        y: viewHeight / 2 + y * CELL
      };
    }

    function roundedRectangle(x, y, width, height, radius) {
      context.beginPath();
      context.moveTo(x + radius, y);
      context.arcTo(x + width, y, x + width, y + height, radius);
      context.arcTo(x + width, y + height, x, y + height, radius);
      context.arcTo(x, y + height, x, y, radius);
      context.arcTo(x, y, x + width, y, radius);
      context.closePath();
    }

    function drawRoadLayer(color, width) {
      context.strokeStyle = color;
      context.lineWidth = width;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.beginPath();
      roads.forEach(function (road) {
        var from = screenPoint(road.x, road.y);
        road.neighbors.forEach(function (neighbor) {
          if (neighbor.x < road.x || (neighbor.x === road.x && neighbor.y < road.y)) return;
          var to = screenPoint(neighbor.x, neighbor.y);
          context.moveTo(from.x, from.y);
          context.lineTo(to.x, to.y);
        });
      });
      context.stroke();
    }

    function drawStation(station) {
      var point = screenPoint(station.x, station.y);
      context.save();
      context.translate(point.x, point.y);
      context.globalCompositeOperation = 'destination-out';
      context.beginPath();
      context.arc(0, 0, STATION_RADIUS + 3.5, 0, Math.PI * 2);
      context.fill();
      context.globalCompositeOperation = 'source-over';

      if (station.type === 'origin') {
        context.beginPath();
        context.arc(0, 0, STATION_RADIUS, 0, Math.PI * 2);
        context.fillStyle = station.color;
        context.fill();
        context.lineWidth = 2;
        context.strokeStyle = '#fff';
        context.stroke();
      } else {
        context.rotate(Math.PI / 4);
        context.fillStyle = station.color;
        roundedRectangle(-1.55, -5.4, 3.1, 10.8, 1.2);
        context.fill();
        roundedRectangle(-5.4, -1.55, 10.8, 3.1, 1.2);
        context.fill();
      }
      context.restore();
    }

    function drawVehicle(vehicle) {
      var start = vehicle.path[Math.min(vehicle.segment, vehicle.path.length - 1)];
      var end = vehicle.path[Math.min(vehicle.segment + 1, vehicle.path.length - 1)];
      var progress = vehicle.leaving ? 0 : vehicle.progress;
      var x = start.x + (end.x - start.x) * progress;
      var y = start.y + (end.y - start.y) * progress;
      var point = screenPoint(x, y);

      context.save();
      context.translate(point.x, point.y);
      context.rotate(Math.atan2(end.y - start.y, end.x - start.x));
      context.globalAlpha = vehicle.opacity;
      context.shadowColor = 'rgba(45, 40, 32, 0.45)';
      context.shadowBlur = 3.5;
      context.shadowOffsetX = 0;
      context.shadowOffsetY = 1.2;
      context.fillStyle = vehicle.color || COLORS.vehicle;
      roundedRectangle(-6.5, -3.5, 13, 7, 2);
      context.fill();
      context.shadowColor = 'transparent';
      context.lineWidth = 1.15;
      context.strokeStyle = 'rgba(45, 40, 32, 0.35)';
      context.stroke();
      context.restore();
    }

    function draw() {
      context.clearRect(0, 0, viewWidth, viewHeight);
      drawRoadLayer(COLORS.roadEdge, ROAD_WIDTH + 1.5);
      drawRoadLayer(COLORS.road, ROAD_WIDTH);
      vehicles.forEach(drawVehicle);
      stations.forEach(drawStation);
    }

    function resize() {
      var bounds = host.getBoundingClientRect();
      var pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      viewWidth = Math.max(1, bounds.width);
      viewHeight = Math.max(1, bounds.height);
      canvas.width = Math.round(viewWidth * pixelRatio);
      canvas.height = Math.round(viewHeight * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      draw();
    }

    function tick(time) {
      if (!alive) return;
      if (!lastTime) lastTime = time;
      var realDelta = clamp((time - lastTime) / 1000, 0, 0.05);
      lastTime = time;
      wallElapsed += realDelta;
      var growthScale = wallElapsed < BURST_DURATION
        ? BURST_GROWTH_TIME_SCALE
        : SETTLED_GROWTH_TIME_SCALE;
      elapsed += realDelta * growthScale;

      if (elapsed >= nextRoadAt) {
        extendRoads(1 + Math.floor(random() * 3));
        nextRoadAt = elapsed + 0.9 + random() * 0.8;
      }
      if (elapsed >= nextStationAt) {
        addStation();
        nextStationAt = elapsed + 0.9 + random() * 0.9;
      }
      if (elapsed >= nextVehicleAt) {
        spawnVehicle();
        nextVehicleAt = elapsed + clamp(1.25 - stations.length * 0.03, 0.35, 1.25);
      }

      updateVehicles(realDelta * MOVEMENT_TIME_SCALE);
      draw();
      frame = window.requestAnimationFrame(tick);
    }

    for (var x = -1; x <= 1; x += 1) addRoad(x, 0);
    createStation({ x: -1, y: 0 }, 'origin');
    createStation({ x: 1, y: 0 }, 'destination');

    var resizeObserver = window.ResizeObserver ? new ResizeObserver(resize) : null;

    resize();
    if (resizeObserver) resizeObserver.observe(host);
    else window.addEventListener('resize', resize);
    frame = window.requestAnimationFrame(tick);

    return {
      destroy: function () {
        alive = false;
        window.cancelAnimationFrame(frame);
        if (resizeObserver) resizeObserver.disconnect();
        else window.removeEventListener('resize', resize);
        host.innerHTML = '';
      }
    };
  }

  global.HomeMiniMap = { mount: mount };
})(window);
