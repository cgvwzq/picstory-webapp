$(document).ready(function() {

	$("#mine").on("activate", function() {
	
		var wrap = $(this),
		slides = wrap.find(".slide"),
		active = slides.filter(".active"),
		i = slides.index(active);
		
		slides.on("swipeleft", function(e) {
			if (i === slides.length - 1) { return; }
			$(e.target).removeClass('active').addClass('left');
			slides.eq(i+1).removeClass('right').addClass('active');
			i = slides.index(e.target) + 1;
		}).on("swiperight", function(e) {
			if (i === 0) { return; }
			$(e.target).removeClass('active').addClass('right');
			slides.eq(i-1).removeClass('left').addClass('active');
			i = slides.index(e.target) - 1;
		}).on("movestart", function(e) {
			if ((e.distX > e.distY && e.distX < - e.distY) ||
			(e.distX < e.distY && e.distX > - e.distY)) {
				e.preventDefault();
				return;
			}
		}).on("move", function(e) {
			var left = 100 * e.distX / wrap.width();
			if (e.distX < 0) {
				if (slides[i+1]) {
					slides[i].style.left = left + '%';
					slides[i+1].style.left = (left+100) + '%';
				} else {
					slides[i].style.left = left/5 + '%';
				}
			}
			if (e.distX > 0) {
				if (slides[i-1]) {
					slides[i].style.left = left + '%';
					slides[i-1].style.left = (left-100) + '%';
				} else {
					slides[i].style.left = left/5 + '%';
				}
			}
		}).on("moveend", function(e) {
			wrap.removeClass("notransition");
			slides[i].style.left = '';
			if (slides[i+1]) {
				slides[i+1].style.left = '';
			}
			if (slides[i-1]) {
				slides[i-1].style.left = '';
			}
		});
		
		$("#mine article > img").click(function(e){
			$("<div class=\"fullscreen\">").append($("<img>",{src:e.target.src}).click(function(e){
				$(e.target).parent().remove();
			})).appendTo("#mine");
		});
	
	});
	
});
