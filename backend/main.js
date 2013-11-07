var http = require('http');
var url = require('url');
var express = require('express');
var cors = require('cors');
var fs = require('fs');
var crypto = require('crypto');
var mongodb = require('mongodb');
var winston = require('winston');
var multipart = require('connect-multiparty');

var multipartMiddleware = multipart();
var app = express().use(express.json()).use(express.urlencoded());

// Global vars
var CONTENT_PATH = process.env.NODE_ENV == "production" ? 
                    __dirname + "../content" : __dirname + "/uploads";
var PORT = process.env.NODE_ENV == "production" ? "systemd" : 8888; 
var DB = "pictory", DATA_COLLECTION = "data", LOG_COLLECTION = "logs";

// En producción nginx es quien se encarga de lo estático
if (process.env.NODE_ENV != "production") {
    app.use('/thumbnails', express.static(__dirname + '/uploads'));
    app.use('/aluapp', express.static(__dirname + '/../app/'));
    app.use('/manifest.webapp', express.static(__dirname + '/test/manifest.webapp'));
} 

// Define los ficheros de log y los distintos niveles
var logger = new (winston.Logger)({
    transports: [
        new (winston.transports.File)({filename:'info.log', colorize:true, json:false, timestamp:true})
    ]
}), debug = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({colorize:true})
    ]
});

// Para producción esto hay que cambiarlo y dejar las rutas que sean
var db = new mongodb.Db(DB, new mongodb.Server("localhost", 27017, {auto_reconnect:true}), {w:-1}), con;

db.open(function(err, client) {
	if (err) {
		db.close();
		throw err;
	}
	con = client;
});

app.get('/timeline', function(req, res) {

	res.contentType('application/json');
	
	var collection = new mongodb.Collection(con, DATA_COLLECTION),
	query = url.parse(req.url, true).query,
	latitud = parseFloat(query.latitud),
	longitud = parseFloat(query.longitud);

	if (isNaN(latitud) || isNaN(longitud)) {
        logger.log('warn','%s - GET /timeline - parametros inválidos.',req.headers['X-Real-IP'] || req.ip);
		res.send("what?!", 400);
		return;
	}
		

    var map = function() {
        emit(Math.floor(this.fecha/86400000)*86400000, 1)
	}
	var reduce = function(key, val) {
		return Array.sum(val)
	}
		
	collection.mapReduce(map, reduce, {out : {inline: 1}, query: {"posicion":{$near:{$geometry:{type:"Point",coordinates:new Array(longitud, latitud)},$maxDistance:5000}}}},function(err, docs){
		if (err) {
            logger.log('error','%s - GET /timeline - consulta mapReduce a BD', req.headers['X-Real-IP'] || req.ip);
			res.send("bd error", 500);
		} else {
			res.send(JSON.stringify(docs), 200);
		}
	});

});

app.get('/view', function(req, res) {

	res.contentType('application/json');

	var collection = new mongodb.Collection(con, DATA_COLLECTION),
	query = url.parse(req.url, true).query,
	latitud = parseFloat(query.latitud),
	longitud = parseFloat(query.longitud),
	fecha = parseInt(query.fecha, 10);
	
	if (isNaN(latitud) || isNaN(longitud) || isNaN(fecha)) {
        logger.log('warn','%s - GET /view - parametros inválidos.', req.headers['X-Real-IP'] || req.ip);
		res.send("what?!", 400);
		return;
	}
		
	// hacer benchmarks con timestamp y Date y con las coordenadas
    logger.log('info','%s - GET /view?coord=%s&fecha=%s.',req.headers['X-Real-IP'] || req.ip, new Array(longitud, latitud), new Date(fecha).toISOString()); 
		
	collection.find({"posicion":{$near:{$geometry:{type:"Point",coordinates:new Array(longitud, latitud)},$maxDistance:5000}},"fecha":{$gte:fecha, $lt:fecha+86400000}}).sort({fecha:-1}).toArray(function(err, docs) {
		if (err) {
            logger.log('error','%s - GET /find - consulta find a BD', req.headers['X-Real-IP'] || req.ip);
			res.send("bd error", 500);
		} else {
			res.send(JSON.stringify(docs), 200);
		}
	});
	
});

app.post('/upload', multipartMiddleware, function(req, res) {

	res.contentType('application/json');

	var file = req.files['media'], ext;
	
	function validaExtension(e) {
		if (/png$/.test(e)) {
			return "png";
		} else if (/jpe?g$/.test(e)) {
			return "jpg";
		} else {
			return null;
		}
	}

	if (file != null) ext = validaExtension(file.type);
	
	if (file == null || ext == null || req.body.titulo == '' || isNaN(parseFloat(req.body.latitud)) || isNaN(parseFloat(req.body.longitud))) {
        logger.log('warn','%s - POST /upload - invalid upload.', req.headers['X-Real-IP'] || req.ip);
		res.send(JSON.stringify({"error":"datos inválidos"}), 400);
		return;
	}
	// validar extension y mejorar reconocimiento (faltará diferenciar videos de imágenes o contenido externo [tuits, noticias, instagram])
	
	fs.readFile(file.path, function(err, data) {
	
		// Mientras tanto se quedan en /tmp las copias;
		
		var hash = crypto.createHash('md5').update(Math.random()
				+ file.name).digest("hex"),
		fileName = (new Date().getTime()) + hash,
		newPath = fileName + "." + ext,
		latitud = parseFloat(req.body.latitud),
		longitud = parseFloat(req.body.longitud),
		titulo = req.body.titulo.substr(0,30),
		desc = req.body.descripcion.substr(0,120),
		size = file.size,
		categoria = req.body.categoria;
		
		var collection = new mongodb.Collection(con, DATA_COLLECTION);
		
		collection.insert({titulo:titulo, descripcion:desc, fecha: new Date().getTime(), posicion: {type:"Point", coordinates: new Array(longitud, latitud)}, media:{tipo:"imagen", ruta:fileName + "." + ext, tamaño:size}, categoria:categoria}, {safe:true}, function(err, docs){
			if (err) {
                logger.log('error','%s - POST /upload - insertando a BD.', req.headers['X-Real-IP'] || req.ip);
			}
		});
		
		fs.writeFile(CONTENT_PATH + "/img/" + newPath, data, function(err) {
			if (err) {
                logger.log('error','%s - POST /upload - escribiendo archivo.', req.headers['X-Real-IP'] || req.ip);
				res.send(JSON.stringify({"error":"error fs"}), 500);
			} else {
				res.send("{}",  200);
			}
		});
		
	});

});

app.listen(PORT);
