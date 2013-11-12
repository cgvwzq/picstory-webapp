// Variables globales para las coordenadas
var LONG, LAT;
var URL_B = "http://backend.pictory.es/";
var URL_D = "http://media.pictory.es/";

// Inicializa al cargar el documento
$(document).ready(function() {

	// Si puede obtener las coordenadas solicita el Timeline
	if ("geolocation" in navigator) {
		//navigator.geolocation.getCurrentPosition(requestTimeline, errorNoGPS, {enableHighAccuracy:true, maximumAge:0, timeout:30000});
		LONG= -0.889581;
		LAT= 41.648790999999996;
		requestTimeline();
	} 
	// Sino muestra un error y la aplicación no inciia
	else {
		errorNoGPS();
	}
	
	// Define los eventos para el tab menu principal
	$('nav ul li').click(function(){
		var tab_id = $(this).attr('data-tab');
		$('nav ul li').removeClass('current');
		$('main > section').fadeOut(0).removeClass('current');
		$(this).addClass('current');
		$("#"+tab_id).fadeIn().addClass('current');
	});

});

// Muestra mensaje de error y cierra la aplicación o resolicita los permisos
function errorNoGPS(e) {
	alert("No GPS");
	window.close();
}

// Una vez ha cargado el timeline se desbloquean los menus y
// se definen las transiciones entre pantallas
function unlockMenu() {

	$("img.loading").fadeOut();
	$("svg").delay(500).fadeIn();
	
	$("main > header > menu > a").click(function(){
		$("#main").css('left','-100%').delay(800).hide(0);
		$("#"+$(this).attr('data-link')).show(100).css('left','0%');
	});
	
	$("section[role=region] > header > a").click(function() {
		$("section[role=region]").css('left','100%').delay(800).hide(0);
		$("#"+$(this).attr('data-link')).show(0).css('left','0%');
	});
}

// Solicita un timeline para las coordenadas dadas y devuelve el JSON
// con un array de objectos fecha y cantidad
function requestTimeline(p) {

	if (p) {
		LONG= p.coords.longitude;
		LAT= p.coords.latitude;
	} else {
		$("img.loading").show();
	}
	
	var http = new XMLHttpRequest();
	
	http.open('GET', URL_B+'timeline?longitud='+LONG+'&latitud='+LAT, true);
	http.onload = function() {
		data = JSON.parse(http.responseText);
		data.map(function(e){
			e._id = new Date(e._id);
		});
		loadTimeline(data);
        // Carga contenido del bloque más actual
        requestImages({"_id":new Date(data[0]._id)})
	}
	http.onerror = function(e){ alert(e) };
	http.send();
	
}

// Solicita el contenido ya seleccionada una fecha
function requestImages(d){

	var http = new XMLHttpRequest();
		
	http.open('GET', URL_B+'view?longitud='+LONG+'&latitud='+LAT+'&fecha='+d._id.getTime(), true);
	http.onload = function() {
		$("#carousel").empty();
		loadImages(http.responseText);
	}
	http.onerror = function(e){ alert(e) };
	http.send();

}

// Una vez obtenido el array de documentos se parsean y se renderizan en la
// pantalla principal con forma de carousel y se activa el efecto swipe para
// desplazarzse entre ellos.
function loadImages(json) {
		
	var docs = JSON.parse(json), wrap, titulo, fecha, desc;
	
	if (docs.length == 0) {
		$("<p>", {text:"No content.", class:"msg"}).appendTo("#mine");
	} else {
		$("#mine").empty();
		wrap = $("<div>",{class:"img_slides_wrap wrap slides_wrap"}).appendTo("#mine");
		for (var i in docs) {
			titulo = $("<span>", {text:docs[i].titulo, class:"titulo"});
			fecha = $("<span>", {text:new Date(docs[i].fecha).toISOString().substring(0,10), class:"fecha"});
			desc = $("<span>", {text:docs[i].descripcion, class:"desc"});
			$("<article>", {id:"slide_"+docs[i]._id, class:"slide img_slide right"})
			.append(
				$("<header>").append(titulo, fecha, desc),
				$("<img>", {src:URL_D+"pictures/"+docs[i].media.ruta})
			)
			.appendTo(wrap);
		}
		
		$("#mine article:first-child").removeClass("right").addClass("active");
		$("#mine").trigger("activate");
		
	}
}

// Formulario de compartir contenido
$(document).ready(function() {

	var file, blobUrl;
	
	function check(o) {
		return (file != null && o.longitud.value != '' && o.latitud.value != ''
				&& o.titulo.value != '' && o.categoria.selectedIndex != 0);
	}
	
	function cambiaImagen() {
		if (typeof this.result != "undefined") {
			file = this.result.blob;
		} else {
			file = this.files[0]
		}
		blobUrl = window.URL.createObjectURL(file);
		$("#media").attr("src", blobUrl);
		$("#media").removeClass("empty");
		$(".removeImage").show(200);
	}
	
	$("#media-sec").change(cambiaImagen);
	
	$("#media").click(function() {
		try {
			var pick = new MozActivity({
				name: "pick",
				data: {type: ["image/png", "image/jpg", "image/jpeg"]}
			});
			pick.onsuccess = cambiaImagen;
			pick.onerror = function() {alert("Invalid file")};
		} catch(e) {
			$("#media-sec").click();
		}
	});
	
	$(".removeImage").click(function(){
		window.URL.revokeObjectURL(blobUrl);
		$("#media-sec").val("");
		$("#media").attr("src","img/empty.png");
		$("#media").addClass("empty");
		$(".removeImage").hide(200);
	});
	
	$("#upload button").click(function(){
		$("#upload input[name=longitud]").val(LONG);
		$("#upload input[name=latitud]").val(LAT);
		if (check($("#upload")[0])) { 
			var formData = new FormData($("#upload")[0]);
			formData.append("media", file);
			$.ajax({
				url: URL_B+'upload',
				type: 'POST',
				beforeSend: null,
				success: function(d){
					requestTimeline();
					alert("Compartida!");
					$("#upload")[0].reset();
					$(".removeImage").click()
				},
				error: function(e){
					alert("Error:" + e)
				},
				data: formData,
				contentType: false,
				processData: false
			});
		} else {
			alert("Campos incorrectos.");
		}
	});
	
});
