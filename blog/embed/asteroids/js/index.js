
// create the canvas
var canvas   = document.createElement('canvas');
canvas.id = "cvs"
var ctx      = canvas.getContext('2d');

// dump in body
document.body.style.margin  = 'auto';
document.body.style.padding = 'auto';

document.body.appendChild(canvas);

var resizeCanvas = function() {
	canvas.width  = .55*800;
	canvas.height = .45*600;
	canvas.cs
};

// resize on load and listen for window change
window.onresize = resizeCanvas;
resizeCanvas();

// add background image for monitor aesthetic
var background = new Image();
background.src = "monitor.jpg";

// make a vector class
function Vector(x, y) {
	this.x = x;
	this.y = y;

	this.rotate = function(center, angle) {
		angle = (angle) * (Math.PI/180);
		var rotatedX = Math.cos(angle) * (this.x - center.x) - Math.sin(angle) * (this.y-center.y) + center.x;
		var rotatedY = Math.sin(angle) * (this.x - center.x) + Math.cos(angle) * (this.y - center.y) + center.y;
		this.x = rotatedX;
		this.y = rotatedY;
		return this;
	};
	this.clone = function() {
		return new Vector(this.x, this.y);
	}
};

// now a class for all space objects (ships, asteroids, lazers)
function spaceObj(loc, dir) {
	this.location = loc;
	this.direction = dir;
	this.angle = 0;
	this.speed = 0;
	this.scale = 1;
}

// the ship object
var ship = new spaceObj(new Vector(canvas.width/2, canvas.height/2), new Vector(0, 0));

// global (interstellar?) array of asteroids in space
var asteroids = [];
var lasers = [];
var approachRate = 0;
var level = 1;
var loop = false;

APP = {};

APP.core = {
	then: Date.now(),
	now: Date.now(),
	delta: 0,
	
	frame: function() {
		APP.core.setApproach();
		APP.core.setDelta();
		APP.core.populate();
		APP.core.update();
		APP.core.collisionCheck();
		APP.core.render();
		if (loop) { window.requestAnimationFrame(APP.core.frame) };
	},
	setApproach: function() {
		approachRate = 0.05 + level*0.01;
	},
	setDelta: function() {
		APP.core.now = Date.now();
		APP.core.delta = (APP.core.now - APP.core.then) / 1000;
		APP.core.then = APP.core.now;
	},
	populate: function() {
		if (Math.random() < approachRate) {
			random = Math.random()
			if (random < 0.25) {
				var asteroid = new spaceObj(new Vector(0, canvas.height*Math.random()), new Vector((Math.random()-0.5)*40, (Math.random()-0.5)*40));
			}
			else if (random > 0.25 && random < 0.5) {
				var asteroid = new spaceObj(new Vector(canvas.width, canvas.height*Math.random()), new Vector((Math.random()-0.5)*40, (Math.random()-0.5)*40));
			}
			else if (random > 0.5 && random < 0.75) {
				var asteroid = new spaceObj(new Vector(canvas.width*Math.random(), 0), new Vector((Math.random()-0.5)*40, (Math.random()-0.5)*40));
			}
			else {
				var asteroid = new spaceObj(new Vector(canvas.width*Math.random(), canvas.height), new Vector((Math.random()-0.5)*40, (Math.random()-0.5)*40));
			}
			asteroid.angle = Math.random()*360;
			asteroid.scale = Math.random()*2+0.5;
			asteroid.speed = new Vector(Math.random()*3, Math.random()*3)
			asteroids.push(asteroid);
		}
	},
	update: function() {

		// handle the space ship
		var dx = ship.direction.x * APP.core.delta;
		ship.location.x = ship.location.x + dx;

		var dy = ship.direction.y * APP.core.delta; 
		ship.location.y = ship.location.y + dy;

		if (ship.location.x > canvas.width) {
			ship.location.x = 0 }

		else if (ship.location.x < 0) {
			ship.location.x = canvas.width }

		else if (ship.location.y > canvas.height) {
			ship.location.y = 0 }

		else if (ship.location.y < 0) {
			ship.location.y = canvas.height }

		// update all the asteroids
		for (var i=0; i < asteroids.length; i++) {

			// slow rotation of space rocks
			if (asteroids[i].angle < 360/2) {
				asteroids[i].angle -= 0.5;
			}
			else if (asteroids[i].angle >= 360/2) {
				asteroids[i].angle += 0.5;
			};

			var dx = asteroids[i].direction.x * asteroids[i].speed.x * APP.core.delta;
			asteroids[i].location.x = asteroids[i].location.x + dx;

			var dy = asteroids[i].direction.y * asteroids[i].speed.y * APP.core.delta; 
			asteroids[i].location.y = asteroids[i].location.y + dy;

			if (asteroids[i].location.x > canvas.width) {
				asteroids.splice(i, 1) }

			else if (asteroids[i].location.x < 0) {
				asteroids.splice(i, 1) }

			else if (asteroids[i].location.y > canvas.height) {
				asteroids.splice(i, 1) }

			else if (asteroids[i].location.y < 0) {
				asteroids.splice(i, 1) }
		};

		// update all the laser beams
		for (var i=0; i < lasers.length; i++) {

			var dx = lasers[i].direction.x * lasers[i].speed.x * APP.core.delta;
			lasers[i].location.x = lasers[i].location.x + dx;

			var dy = lasers[i].direction.y * lasers[i].speed.y * APP.core.delta; 
			lasers[i].location.y = lasers[i].location.y + dy;

			if (lasers[i].location.x > canvas.width) {
				lasers.splice(i, 1) }

			else if (lasers[i].location.x < 0) {
				lasers.splice(i, 1) }

			else if (lasers[i].location.y > canvas.height) {
				lasers.splice(i, 1) }

			else if (lasers[i].location.y < 0) {
				lasers.splice(i, 1) }
		}
	},
	collisionCheck: function() {
		// lasers hitting roids
		for (var a=0; a < asteroids.length; a++) {
			for (var l=0; l < lasers.length; l++) {
				if (Math.abs(asteroids[a].location.x - lasers[l].location.x) < 18*asteroids[a].scale && Math.abs(asteroids[a].location.y - lasers[l].location.y) < 18*asteroids[a].scale) {
					asteroids.splice(a, 1);
					lasers.splice(l, 1)
				}
			}
		};
		// roids hitting other roids
		for (var a=0; a < asteroids.length; a++) {
			var subArray = asteroids.slice(a+1, a.length)
			for (var b=0; b < subArray.length; b++) {
				if ((Math.abs(asteroids[a].location.x - subArray[b].location.x)) < (8*asteroids[a].scale + 8*subArray[b].scale) && 
					(Math.abs(asteroids[a].location.y - subArray[b].location.y)) < (8*asteroids[a].scale + 8*subArray[b].scale)) {
					if (asteroids[a].scale < subArray[b].scale) { asteroids.splice(a,     1); }
					if (asteroids[a].scale > subArray[b].scale) { asteroids.splice(a+1+b, 1); }
				}
			}
		};
		// roids hitting ships
		for (var a=0; a < asteroids.length; a++) {
			var subArray = asteroids.slice(a+1, a.length)
			if ((Math.abs(asteroids[a].location.x - ship.location.x)) < (8*asteroids[a].scale + 8*ship.scale) && 
				(Math.abs(asteroids[a].location.y - ship.location.y)) < (8*asteroids[a].scale + 8*ship.scale)) {
				ship = new spaceObj(new Vector(canvas.width/2, canvas.height/2), new Vector(0, 0));
				asteroids = [];
				lasers = [];
				document.getElementById('start').style.visibility = 'visible';
				loop = false;
			}
		}
	},
	render: function() {
		ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
		drawShip(ship);
		for (var i=0; i < asteroids.length; i++) {
			drawAsteroid(asteroids[i]);
		};
		for (var i=0; i < lasers.length; i++) {
			drawLaser(lasers[i]);
		}
	}
}

function checkKey(e) {
    e = e || window.event;
    if (e.keyCode == '38') {
     	ship.direction.y -= 5*Math.cos((ship.angle) * (Math.PI/180));
     	ship.direction.x += 5*Math.sin((ship.angle) * (Math.PI/180));
    }
    else if (e.keyCode == '37') {
        ship.angle -= 5;
        if (ship.angle < 0) { ship.angle += 360}
    }
    else if (e.keyCode == '40') {
    	// quadrant 1
    	if (ship.angle >= 0 && ship.angle < 90) { 
    		if (ship.direction.y < 0) { ship.direction.y += 5*Math.abs(Math.cos((ship.angle) * (Math.PI/180))) };
    		if (ship.direction.y > 0) { ship.direction.y -= 5*Math.abs(Math.cos((ship.angle) * (Math.PI/180))) }; 
    		if (ship.direction.x > 0) { ship.direction.x -= 5*Math.abs(Math.sin((ship.angle) * (Math.PI/180))) };
    		if (ship.direction.x < 0) { ship.direction.x += 5*Math.abs(Math.sin((ship.angle) * (Math.PI/180))) }}
    	// quadrant 2
    	if (ship.angle >= 90 && ship.angle < 180) { 
    		if (ship.direction.y > 0) { ship.direction.y -= 5*Math.abs(Math.cos((ship.angle) * (Math.PI/180))) };
    		if (ship.direction.y < 0) { ship.direction.y += 5*Math.abs(Math.cos((ship.angle) * (Math.PI/180))) }; 
    		if (ship.direction.x > 0) { ship.direction.x -= 5*Math.abs(Math.sin((ship.angle) * (Math.PI/180))) }
    		if (ship.direction.x < 0) { ship.direction.x += 5*Math.abs(Math.sin((ship.angle) * (Math.PI/180))) }}
    	// quadrant 3
    	if (ship.angle >= 180 && ship.angle < 270) { 
    		if (ship.direction.y > 0) { ship.direction.y -= 5*Math.abs(Math.cos((ship.angle) * (Math.PI/180))) }; 
    		if (ship.direction.y < 0) { ship.direction.y += 5*Math.abs(Math.cos((ship.angle) * (Math.PI/180))) }; 
    		if (ship.direction.x < 0) { ship.direction.x += 5*Math.abs(Math.sin((ship.angle) * (Math.PI/180))) };
    		if (ship.direction.x > 0) { ship.direction.x -= 5*Math.abs(Math.sin((ship.angle) * (Math.PI/180))) }}
    	// quadrant 4
    	if (ship.angle >= 270 && ship.angle < 360) { 
    		if (ship.direction.y < 0) { ship.direction.y += 5*Math.abs(Math.cos((ship.angle) * (Math.PI/180))) };
    		if (ship.direction.y > 0) { ship.direction.y -= 5*Math.abs(Math.cos((ship.angle) * (Math.PI/180))) }; 
    		if (ship.direction.x < 0) { ship.direction.x += 5*Math.abs(Math.sin((ship.angle) * (Math.PI/180))) };
    		if (ship.direction.x > 0) { ship.direction.x -= 5*Math.abs(Math.sin((ship.angle) * (Math.PI/180))) }}
    }
    else if (e.keyCode == '39') {
        ship.angle += 5;
        if (ship.angle > 360) { ship.angle -= 360}
    }
    else if (e.keyCode == '32') {
    	document.getElementById("laser").play();
        var laser = new spaceObj(ship.location.clone(), ship.direction.clone());
        laser.speed = new Vector(5, 5);
        laser.angle = ship.angle;
    	// quadrant 1
    	if (ship.angle >= 0 && ship.angle < 90) { 
    		laser.direction.y = -100*Math.abs(Math.cos((ship.angle) * (Math.PI/180))); 
    		laser.direction.x =  100*Math.abs(Math.sin((ship.angle) * (Math.PI/180)))}
    	// quadrant 2
    	if (ship.angle >= 90 && ship.angle < 180) { 
    		laser.direction.y =  100*Math.abs(Math.cos((ship.angle) * (Math.PI/180))); 
    		laser.direction.x =  100*Math.abs(Math.sin((ship.angle) * (Math.PI/180)))}
    	// quadrant 3
    	if (ship.angle >= 180 && ship.angle < 270) { 
    		laser.direction.y =  100*Math.abs(Math.cos((ship.angle) * (Math.PI/180))); 
    		laser.direction.x = -100*Math.abs(Math.sin((ship.angle) * (Math.PI/180)))}
    	// quadrant 4
    	if (ship.angle >= 270 && ship.angle < 360) { 
    		laser.direction.y = -100*Math.abs(Math.cos((ship.angle) * (Math.PI/180))); 
    		laser.direction.x = -100*Math.abs(Math.sin((ship.angle) * (Math.PI/180)))}
    	lasers.push(laser)
    }
}

// make a fucking spaceship
function drawShip(ship) {

	ctx.beginPath();
	ctx.moveTo(ship.location.x, ship.location.y);

	var backRight = ship.location.clone();
	backRight.x += 10;
	backRight.y += 20;
	backRight.rotate(ship.location, ship.angle);

	ctx.lineTo(backRight.x,backRight.y);
    
    var backMiddleL = ship.location.clone();
	backMiddleL.x += 3;
	backMiddleL.y += 15;
	backMiddleL.rotate(ship.location, ship.angle);	

    ctx.lineTo(backMiddleL.x,backMiddleL.y);
    
    var backMiddleR = ship.location.clone();
    backMiddleR.x -= 3;
	backMiddleR.y += 15;
	backMiddleR.rotate(ship.location, ship.angle);	

    ctx.lineTo(backMiddleR.x,backMiddleR.y);
    
	var backLeft = ship.location.clone();
	backLeft.x -= 10;
	backLeft.y += 20;
	backLeft.rotate(ship.location, ship.angle);	

    ctx.lineTo(backLeft.x,backLeft.y);

    ctx.lineTo(ship.location.x,ship.location.y);

	ctx.strokeStyle = 'red';
	ctx.shadowColor = 'red';
	ctx.shadowBlur = 10;
	ctx.stroke();
	ctx.closePath();
};


// make a tons of space rocks
function drawAsteroid(roid) {
	ctx.beginPath();
	ctx.moveTo(roid.location.x, roid.location.y);

	var pt = roid.location.clone();
	pt.x += 1*roid.scale;
	pt.y += -16*roid.scale;
	pt.rotate(roid.location, roid.angle);
	ctx.lineTo(pt.x,pt.y);

	var pt = roid.location.clone();
	pt.x += 6*roid.scale;
	pt.y += -13*roid.scale;
	pt.rotate(roid.location, roid.angle);
	ctx.lineTo(pt.x,pt.y);

	var pt = roid.location.clone();
	pt.x += 15*roid.scale;
	pt.y += 0*roid.scale;
	pt.rotate(roid.location, roid.angle);
	ctx.lineTo(pt.x,pt.y);

	var pt = roid.location.clone();
	pt.x += 12*roid.scale;
	pt.y += 3*roid.scale;
	pt.rotate(roid.location, roid.angle);
	ctx.lineTo(pt.x,pt.y);

	var pt = roid.location.clone();
	pt.x += 12*roid.scale;
	pt.y += 10*roid.scale;
	pt.rotate(roid.location, roid.angle);
	ctx.lineTo(pt.x,pt.y);

	var pt = roid.location.clone();
	pt.x += 0*roid.scale;
	pt.y += 16*roid.scale;
	pt.rotate(roid.location, roid.angle);
	ctx.lineTo(pt.x,pt.y);

	var pt = roid.location.clone();
	pt.x += -10*roid.scale;
	pt.y += 8*roid.scale;
	pt.rotate(roid.location, roid.angle);
	ctx.lineTo(pt.x,pt.y);

	var pt = roid.location.clone();
	pt.x += -2*roid.scale;
	pt.y += 5*roid.scale;
	pt.rotate(roid.location, roid.angle);
	ctx.lineTo(pt.x,pt.y);

	var pt = roid.location.clone();
	pt.x += -11*roid.scale;
	pt.y += 7*roid.scale;
	pt.rotate(roid.location, roid.angle);
	ctx.lineTo(pt.x,pt.y);

	var pt = roid.location.clone();
	pt.x += -13*roid.scale;
	pt.y += -4*roid.scale;
	pt.rotate(roid.location, roid.angle);
	ctx.lineTo(pt.x,pt.y);

	var pt = roid.location.clone();
	pt.x += -8*roid.scale;
	pt.y += -4*roid.scale;
	pt.rotate(roid.location, roid.angle);
	ctx.lineTo(pt.x,pt.y);

	var pt = roid.location.clone();
	pt.x += -1*roid.scale;
	pt.y += -17*roid.scale;
	pt.rotate(roid.location, roid.angle);
	ctx.lineTo(pt.x,pt.y);

    ctx.lineTo(roid.location.x,roid.location.y);

	ctx.strokeStyle = 'orange';
	ctx.shadowColor = 'orange';
	ctx.shadowBlur = 10;
	ctx.stroke();
	ctx.closePath();
};


// blast dem lasers
function drawLaser(lzr, scale) {

	ctx.beginPath();
	ctx.moveTo(lzr.location.x, lzr.location.y);

	var endBeam = lzr.location.clone();
	endBeam.x += 1;
	endBeam.y += 1;
	endBeam.rotate(lzr.location, lzr.angle);
	ctx.lineTo(endBeam.x,endBeam.y);

	var endBeam = lzr.location.clone();
	endBeam.x += 0;
	endBeam.y += 2;
	endBeam.rotate(lzr.location, lzr.angle);
	ctx.lineTo(endBeam.x,endBeam.y);

	var endBeam = lzr.location.clone();
	endBeam.x += -1;
	endBeam.y += 1;
	endBeam.rotate(lzr.location, lzr.angle);
	ctx.lineTo(endBeam.x,endBeam.y);

    ctx.lineTo(lzr.location.x,lzr.location.y);

	ctx.strokeStyle = '#B6212D';
	ctx.shadowColor = '#B6212D';
	ctx.shadowBlur = 20;
	ctx.stroke();
	ctx.closePath();
};

function startGame() {
	document.getElementById('start').style.visibility = 'hidden';
	loop = true;
	APP.core.frame()
};

document.onkeydown = checkKey;
drawShip(ship);



