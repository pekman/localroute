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

	// TODO: init graphics-related things

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
		
		// TODO: draw

	});

	nextTask();
}

window.onload=init;
