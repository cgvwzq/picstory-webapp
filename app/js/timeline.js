var w, h;

function loadTimeline(data) {

	d3.select("svg").remove()

	var margin = [40,30];

	var aside = d3.select("aside#timeline");
	if (!(w || h)) {
		w = parseInt(aside.style("width"),10);
		h = parseInt(aside.style("height"),10);
	}

	var svg = d3.select("#timeline")
		.append("svg")
		.attr("width", w)
		.attr("height", h);
		
	var x = d3.time.scale()
		.domain(d3.extent(data, function(d){return d._id}))
		.range([margin[0], w-margin[0]]),
	y = d3.scale.linear()
		.domain([0, d3.max(data, function(d){return d.value})])
		.range([3, 15]);
	
	var xAxis = d3.svg.axis()
		.scale(x)
		//.tickFormat(d3.time.format("%Y-%m-%d"))
		.ticks(2)
		.innerTickSize(40)
		//.outerTickSize(40)
		.orient("bottom");
		
	svg.append("g")
		.attr("class", "axis")
		.attr("transform", "translate(0,"+margin[1]+")")
		.call(xAxis);
	
	svg.selectAll("circle")
		.data(data)
		.enter()
		.append("g").append("circle")
		.attr("cx", function(d){return x(d._id)})
		.attr("cy", margin[1])
		.attr("r", function(d){return y(d.value)})
		.on("click",function(d,i){
			d3.selectAll(".time-info").remove();
			var g = d3.select(this.parentNode).append("g");
			g.attr("class","time-info");
			g.append("rect")
				.attr("x", w/2-50)
				.attr("y", h-35)
				.attr("width", 100).attr("height", 30)
				.attr("rx",15).attr("ry",15)
			g.append("text")
				.attr("dx", w/2-35)
				.attr("dy", h-15)
				.text(function(d,i) {
					return "Ir a "+d._id.toJSON().substr(0,10);	
				});
			g.on("click", function(d) {
				// Cambiar color y mostrar mensaje
				g.select("text")
					.attr("dx", w/2-43)
					.attr("dy", h-15)
					.text(function(d,i) {
						return d._id.toUTCString().substr(0,16);	
					});
				g.select("rect").transition().attr("class","clicked");
				requestImages(d);
				g.append("text")
					.attr("dx", w/2+60)
					.attr("dy", h-25)
					.attr("class","count")
					.text(function(d,i) {
						return d.value + " fotos";
					});
				d3.select(this).transition(1000).remove(0);
			});
		});

	unlockMenu();

}
