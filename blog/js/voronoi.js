var l_array = [];
var width = 500;
var height = 750;

function voronoimapN20(mapN20, url) {
	// set up svg
	svg = d3.select(mapN20.getPanes().overlayPane).append("svg")
		.attr("id", 'svgProj')
		.attr("width", width)
		.attr("height", height);

	stations = []
	d3.json(url, function(d) {
		list = d.stationBeanList;
		for (var i = 0; i < list.length; i++) {
			stations.push([list[i].latitude, list[i].longitude]);
		};
		create(stations);
		});
}

function create(stations) {
	points = []
	for (var i = 0; i < stations.length; i++) {
			L.circle(stations[i], 1, {
				color: 'red',
				fillOpacity: 1,
				stroke: 0}).addTo(mapN20);
			var latlng = new L.LatLng(stations[i][0], stations[i][1]);
			var point = mapN20.latLngToLayerPoint(latlng);
			l_array.push(point);
			points.push([point.x, point.y]);
		};
		draw(points);
	};

function draw(points) {

	var voronoi = d3.geom.voronoi()
		.clipExtent([[0, 0], [width, height]]);

	var path = svg.append("g").selectAll("path");

	path = path.data(voronoi(points), polygon);
	path.exit().remove();

	path.enter().append("path")
		.attr("class", "svgDefault")
		.attr("d", polygon);

	path.order();
};

function polygon(d) {
		return "M" + d.join("L") + "Z";
}