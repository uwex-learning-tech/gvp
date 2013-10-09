/* global videojs */
/* global console */

$(document).ready(function(){

	function getParameterByName(name) {
        var regexS = "[\\?&]" + name + "=([^&#]*)";
        var regex = new RegExp(regexS);
        var results = regex.exec(window.location.href);

        name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");

        if (results === null) {
            return "";
        } else {
            return decodeURIComponent(results[1].replace(/\+/g, " "));
        }
	}
	
	var width = 640, height = 360, intro = false, type = 0, title = "", dl="";
	
	console.log(getParameterByName("codekitCB"));
	console.log(getParameterByName("title"));
	
	videojs("gvp_video",{},function() {
		this.progressTips();
	});
	
	$(".video_holder").on("click",function() {
		$(".title_bar").hide();
	});
	
});