goog.provide('main');
goog.require('gis.Obj');
goog.require('gis.util.Opt');
goog.require('gis.util.Date');
goog.require('reach.trans.TransSet');
goog.require('reach.trans.GTFS');
goog.require('gis.osm.MapSet');
goog.require('gis.osm.PBF');
goog.require('reach.route.GeomSet');
goog.require('reach.route.Batch');
goog.require('reach.route.GeoCoder');
goog.require('reach.Api');

function init() {
	var taskList;

	taskList=[];

	function nextTask() {
		if(taskList.length)
			(taskList.shift())();
	}

	// initialize WebGL
	var gl, positionLoc, colorLoc;
	var viewportWidth, viewportHeight, devicePixelRatio;
	(function() {
		var vertexShaderSrc =
			"attribute vec2 a_position;" +
			"" +
			"void main() {" +
			"  gl_Position = vec4(a_position, 0, 1);" +
			"}";
		var fragmentShaderSrc =
			"precision mediump float;" +
			"" +
			"uniform vec4 u_color;" +
			"" +
			"void main() {" +
			"  gl_FragColor = u_color;"+
			"}";

		var canvas = document.getElementById("map");
		gl = canvas.getContext("webgl", { antialias: true }) ||
			canvas.getContext("experimental-webgl", { antialias: true });
		if (! gl)
			throw "WebGL not supported";

		function getShader(source, type, typeString) {
			var shader = gl.createShader(type);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (! gl.getShaderParameter(shader, gl.COMPILE_STATUS))
				throw "Error in " + typeString + "shader: " + gl.getShaderInfoLog(shader);
			return shader;
		}
		var vertexShader = getShader(vertexShaderSrc, gl.VERTEX_SHADER, "VERTEX");
		var fragmentShader = getShader(fragmentShaderSrc, gl.FRAGMENT_SHADER, "FRAGMENT");

		devicePixelRatio = window.devicePixelRatio || 1;
		viewportWidth = Math.round(canvas.clientWidth * devicePixelRatio);
		viewportHeight = Math.round(canvas.clientHeight * devicePixelRatio);
		canvas.width = viewportWidth;
		canvas.height = viewportHeight;

		gl.viewport(0, 0, viewportWidth, viewportHeight);
		gl.clearColor(1, 1, 1, 1);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		var program = gl.createProgram();
		gl.attachShader(program, vertexShader);
		gl.attachShader(program, fragmentShader);
		gl.linkProgram(program);

		positionLoc = gl.getAttribLocation(program, "a_position");
		colorLoc = gl.getUniformLocation(program, "u_color");

		gl.enableVertexAttribArray(positionLoc);
		gl.useProgram(program);
 	})();

	taskList.push(function() {
		var http;
		var url;

		url='../data/map/helsinki01.txt';
//		url='../data/map.txt';

		http=new XMLHttpRequest();
		http.onreadystatechange=function() {
			if(http.readyState==4) {
				if(http.status==200) {
					mapData=http.responseText;
					nextTask();
				} else {
					// TODO: add more error handling.
					// nextTask();
				}
			}
		};

		http.open('GET',url,true);
		http.send(null);
	});

	taskList.push(function() {
		var stream;

		mapSet=new gis.osm.MapSet();
		stream=new gis.io.PackStream(mapData,null);
		mapSet.importPack(stream);
		nextTask();
	});

	taskList.push(function() {
		mapSet.waySet.prepareTree(2048);

		nextTask();
	});

	taskList.push(function() {

		function line(points, width, color) {
			var buffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);
			gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
			gl.lineWidth(width);
			gl.uniform4fv(colorLoc, color);
			gl.drawArrays(gl.LINE_STRIP, 0, 4);
		}

		// draw example lines
		var points = [
			0.8, -0.8,
			-0.8, -0.8,
			0.8, 0.8,
			-0.8, 0.8
		];
		line(points, 10, [1, 0.5, 0.5, 1]);
		line(points, 4, [0, 0, 0, 1]);

		nextTask();
	});

	nextTask();
}

window.onload=init;
