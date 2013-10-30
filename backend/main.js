var http = require('http');
var url = require('url');
var express = require('express');
var cors = require('cors');
var fs = require('fs');
var crypto = require('crypto');
var mongodb = require('mongodb');
var OAuth = require('oauth').OAuth;
var twitter = require('ntwitter');

var app = express();
app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.session({secret: 'iq$·432!#iDAIS_LÑñ'}));

app.use('/thumbnails', express.static(__dirname + '/uploads'));
app.use('/aluapp', express.static(__dirname + '/test'));
app.use('/manifest.webapp', express.static(__dirname + '/test/manifest.webapp'));

var consumer_key = "5auXGZUC1if8pKU9NkRHg";
var consumer_secret = "AMT7p6KCONq5ZV98QVZrQoFwbO5uwZdWcpWN0A220";

var oa = new OAuth(
	"https://api.twitter.com/oauth/request_token",
	"https://api.twitter.com/oauth/access_token",
	consumer_key,
	consumer_secret,
	"1.0",
	"http://1.17.2.169:8888/auth/twitter/callback",
	"HMAC-SHA1"
);

var db = new mongodb.Db("test", new mongodb.Server("localhost",27017,{auto_reconnect:true}), {w:-1}), con;

db.open(function(err, client) {
	if (err) {
		db.close();
		throw err;
	}
	con = client;
});


app.get('/timeline', function(req, res) {

	res.contentType('application/json');
	
	var collection = new mongodb.Collection(con, "contenido");
	var query = url.parse(req.url, true).query;
	var latitud = parseFloat(query.latitud);
	var longitud = parseFloat(query.longitud);
		
	if (isNaN(latitud) || isNaN(longitud)) {
		console.log("error: parametros inválidos.");
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
			console.log("error: bd");
			res.send("bd error", 500);
		} else {
			res.send(JSON.stringify(docs), 200);
		}
	});

});

app.get('/view', function(req, res) {

	res.contentType('application/json');

	var collection = new mongodb.Collection(con, "contenido");
	var query = url.parse(req.url, true).query;
	var latitud = parseFloat(query.latitud);
	var longitud = parseFloat(query.longitud);
	var fecha = parseInt(query.fecha, 10);
	
	if (isNaN(latitud) || isNaN(longitud) || isNaN(fecha)) {
		console.log("error: parametros inválidos.");
		res.send("what?!", 400);
		return;
	}
		
	// hacer benchmarks con timestamp y Date y con las coordenadas
	console.log("Peticion: " + new Array(longitud, latitud) + " : " + new Date(fecha).toISOString());
		
	collection.find({"posicion":{$near:{$geometry:{type:"Point",coordinates:new Array(longitud, latitud)},$maxDistance:5000}},"fecha":{$gte:fecha, $lt:fecha+86400000}}).sort({fecha:-1}).toArray(function(err, docs) {
		if (err) {
			console.log("error: bd");
			res.send("bd error", 500);
		} else {
			res.send(JSON.stringify(docs), 200);
		}
	});
	
});

app.post('/upload', function(req, res) {

	var file = req.files['media'], ext;
	
	function validaExtension(e) {
		if (/png/.test(e)) {
			return "png";
		} else if (/jpe?g/.test(e)) {
			return "jpg";
		} else {
			return null;
		}
	}
	
	if (file != null) ext = validaExtension(file.type);
	
	if (file == null || ext == null || req.body.titulo == '' || isNaN(parseFloat(req.body.latitud)) || isNaN(parseFloat(req.body.longitud))) {
		console.log("Error: invalid upload");
		res.send("datos inválidos", 400);
		return;
	}
	// validar extension y mejorar reconocimiento (faltará diferenciar videos de imágenes o contenido externo [tuits, noticias, instagram])
	
	fs.readFile(file.path, function(err, data) {
	
		// Mientras tanto se quedan en /tmp las copias;
		
		var hash = crypto.createHash('md5').update(Math.random()
				+ file.name).digest("hex");
		var fileName = (new Date().getTime()) + hash
		var newPath = fileName + "." + ext;
		var latitud = parseFloat(req.body.latitud);
		var longitud = parseFloat(req.body.longitud);
		var titulo = req.body.titulo.substr(0,30);
		var desc = req.body.descripcion.substr(0,120);
		var size = file.size;
		var categoria = req.body.categoria;
		
		var collection = new mongodb.Collection(con, "contenido");
		
		collection.insert({titulo:titulo, descripcion:desc, fecha: new Date().getTime(), posicion: {type:"Point", coordinates: new Array(longitud, latitud)}, media:{tipo:"imagen", ruta:fileName + "." + ext, tamaño:size}, categoria:categoria}, {safe:true}, function(err, docs){
			if (err) {
				console.log(err);
			}
		});
		
		fs.writeFile(__dirname + "/uploads/" + newPath, data, function(err) {
			if (err) {
				console.log(err);
				res.send("error fs", 500);
			} else {
				res.send(200);
			}
		});
		
	});

});

// Si hay múltiples instancias no podemos usar sesiones, hay que elminarlas o utilizar el
// propio mongodb o memcached para almacenarlas
app.get('/auth/twitter', function(req, res){
	oa.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret, results){
		if (error) {
			console.log(error);
			res.send("yeah no. didn't work.")
		}
		else {
			req.session.oauth = {
				token: oauth_token,
				token_secret: oauth_token_secret
			};
			res.redirect('https://twitter.com/oauth/authenticate?oauth_token='+oauth_token)
		}
	});
});

app.get('/auth/twitter/callback', function(req, res, next){

	if (req.session.oauth) {
	
		if (req.session.oauth.token != req.query.oauth_token) {
			next(new Error("fixation attack!? "));
		}
		
		req.session.oauth.verifier = req.query.oauth_verifier;
		
		var oauth = req.session.oauth;
		oa.getOAuthAccessToken(oauth.token, oauth.token_secret, oauth.verifier, function(error, oauth_access_token, oauth_access_token_secret, results){
			if (error){
				console.log(error);
				res.send("yeah something broke.");
			} else {
				req.session.oauth.access_token = oauth_access_token;
				req.session.oauth.access_token_secret = oauth_access_token_secret;
				console.log(results);
				res.redirect('/geotagged_tweets');
			}
		});
	} else {
		res.redirect('/auth/twitter');
	}
});

app.get('/geotagged_tweets', function(req, res, next) {

	if (req.session.oauth) {
	
		var stream = new twitter({
			consumer_key: consumer_key,
			consumer_secret: consumer_secret,
			access_token_key: req.session.oauth.access_token,
			access_token_secret: req.session.oauth.access_token_secret
		});
		
		stream.verifyCredentials(function (err, data) {
			if (err) {
				res.redirect('/auth/twitter');
			}
		});
		
		stream.stream('statuses/filter', {locations:'-122.75,36.8,-121.75,37.8,-74,40,-73,41'}, function(response) {

			response.on("data",function(chunk){
				//var tweet = JSON.parse(chunk);
				console.log("date: " +chunk.created_at);
				console.log("geo: " + chunk.coordinates);
				console.log("tweet: " + chunk.text);
			});
			
			response.on("end",function(){
				console.log('Disconnected');
			});
			
			response.on('destroy', function (response) {
				// Handle a 'silent' disconnection from Twitter, no end/error event fired
			});
			
			// Disconnect stream after five seconds
			setTimeout(stream.destroy, 5000);
			
		});
	
	} else {
		res.redirect('/auth/twitter');
	}

});

app.listen(8888);
