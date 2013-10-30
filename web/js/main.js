$(document).ready(function(){

	$("#towork").click(function(){
		$("html, body").animate({ scrollTop : "1250px" }, 800);	
		return false;
	});

	$("div[data-type='vertical'], img[data-type='vertical']").each(function(){
		var $obj=$(this);
		$(window).scroll(function(){
			var y=$(window).scrollTop();
			var yhome=$obj.data("current")-(y/$obj.data("speed"));
			if($obj.data("start") != '' && $obj.data("end") != ''){
				if(y >= $obj.data("start") && y <= $obj.data("end")){
					$obj.css({ "top" : yhome });
				}
			}else{
				$obj.css({ "top" : yhome });
			}
		});
	});
	
});
