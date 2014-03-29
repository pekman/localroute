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
	var gl, positionLoc, colorLoc, modelviewMatLoc, projectionMatLoc;
	var viewportWidth, viewportHeight, devicePixelRatio;
	(function() {
		var vertexShaderSrc =
			"attribute vec2 a_position;" +
			"" +
			"uniform mat4 u_modelview;" +
			"uniform mat4 u_projection;" +
			"" +
			"void main() {" +
			"  gl_Position = u_projection * u_modelview * vec4(a_position, 0, 1);" +
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
		modelviewMatLoc = gl.getUniformLocation(program, "u_modelview");
		projectionMatLoc = gl.getUniformLocation(program, "u_projection");
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

		function makeOrtho2d(left, right, bottom, top)
		{
			var tx = -(right + left) / (right - left);
			var ty = -(top + bottom) / (top - bottom);

			return [
				2 / (right - left), 0, 0, tx,
				0, 2 / (top - bottom), 0, ty,
				0, 0, -1, 0,
				0, 0, 0, 1 ];
		}

		// set projection matrix
		var aspectRatio = viewportWidth / viewportHeight;
		var projectionMatrix;
		if (aspectRatio > 1)
			projectionMatrix = makeOrtho2d( -aspectRatio, aspectRatio, -1, 1 );
		else
			projectionMatrix = makeOrtho2d( -1, 1, -1/aspectRatio, 1/aspectRatio );
		gl.uniformMatrix4fv( projectionMatLoc, false, projectionMatrix );


		// set model-view matrix
		// TODO: interactive zooming and panning (i.e. scale and translate)
		// For now, set it to show a 40x40 km square centered at the
		// same point that the canvas-based version uses initially.
		var center = new gis.Deg(60.1687, 24.9409).toMU();
		var swCorner = center.offset(-20000, -20000);
		var neCorner = center.offset(20000, 20000);
		var translateX = -center.llon;
		var translateY = -center.llat;
		var areaHeight = neCorner.llat - swCorner.llat;
		var areaWidth = neCorner.llon - swCorner.llon;
		var scale;
		if (areaWidth/areaHeight > aspectRatio) {
			scale = 2/areaWidth;
			if (aspectRatio > 1)
				scale /= aspectRatio;
		} else {
			scale = 2/areaHeight;
			if (aspectRatio < 1)
				scale *= aspectRatio;
		}
		gl.uniformMatrix4fv(modelviewMatLoc, false, [
			scale, 0, 0, 0,
			0, scale, 0, 0,
			0, 0, 1, 0,
			scale*translateX, scale*translateY, 0, 1
		]);

		function line(points, width, color) {
			var buffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);
			gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
			gl.lineWidth(width);
			gl.uniform4fv(colorLoc, color);
			gl.drawArrays(gl.LINE_STRIP, 0, points.length/2);
		}

		// draw example lines that cover the displayed area
		var points = [
			neCorner.llon, swCorner.llat,
			swCorner.llon, swCorner.llat,
			neCorner.llon, neCorner.llat,
			swCorner.llon, neCorner.llat
		];
		line(points, 10, [1, 0.5, 0.5, 1]);
		line(points, 4, [0, 0, 0, 1]);
		console.log("done");

		nextTask();
	});

	nextTask();
}

window.onload=init;
