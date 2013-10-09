/* global videojs */
/* global console */

$(document).ready(function(){

	/*************************** GLOBAL-SCOPE VARIALBES ***************************/

	var width = 640, height = 360, intro = false, type = null, dl = null, introPlayer;

	/*************************** FUNCTIONS ***************************************/

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
	
	function capitalizeEachWord(string) {
		var mystring = string;
		var sp = mystring.split(' ');
		var f, r, i;
		var word = [], newstring;
		
		for (i = 0 ; i < sp.length; i++) {
			f = sp[i].substring(0,1).toUpperCase();
			r = sp[i].substring(1);
			word[i] = f + r;
		}
		
		newstring = word.join(' ');
		return newstring;
	}
	
	function getQueryStringValues() {
		// get title from query string if available
		if ($.trim(getParameterByName("ttl")) !== "") {
			$(".title_bar").html(capitalizeEachWord($.trim(getParameterByName("ttl")).replace(/\_+/g," ")));
			console.log("Title: " + capitalizeEachWord($.trim(getParameterByName("ttl")).replace(/\_+/g," ")));
		}
		
		// get intro flag from query string if available
		if ($.trim(getParameterByName("intro")) !== "" && Number($.trim(getParameterByName("intro"))) === 1) {
			intro = true;
			console.log("Intro: " + intro);
		}
		
		// get intro type from the query string if intro is true
		if (intro && $.trim(getParameterByName("type")) !== "") {
			type = $.trim(getParameterByName("type"));
			console.log("Intro type: " + type);
		}
		
		// get width from query string if available
		if ($.trim(getParameterByName("w")) !== "") {
			width = Number($.trim(getParameterByName("w")));
			console.log("Width: " + width);
		}
		
		// get height from query string if available
		if ($.trim(getParameterByName("h")) !== "") {
			height = Number($.trim(getParameterByName("h")));
			console.log("Height: " + height);
		}
		
		// get downloadable flag from query string if available
		if ($.trim(getParameterByName("dl")) !== "") {
			dl = $.trim(getParameterByName("dl"));
			dl = dl.split("");
			console.log("Downloadable flag: " + dl);
		}
	}
	
	function setupIntroVideo() {
	
		$(".video_holder").html("<video id=\"gvp_video\" class=\"video-js vjs-default-skin\" controls preload=\"metadata\" poster=\"smgt370_course_intro.jpg\"></video>");
	
		videojs("gvp_video",{},function() {
			introPlayer = this;
			this.progressTips();
			this.width(width);
			this.height(height);
			this.src({type: "video/mp4", src:type+".mp4"});
		});
		
		introPlayer.on("ended", function() {
			this.dispose();
			setupMainVideo();
		});
		
	}
	
	function setupMainVideo(poster) {
	
		if (typeof poster === "undefined" || typeof poster === null) {
			poster = false;
		}
		
		if (poster) {
			$(".video_holder").html("<video id=\"gvp_video\" class=\"video-js vjs-default-skin\" controls poster=\"smgt370_course_intro.jpg\"><track src=\"smgt370_course_intro.vtt\" kind=\"subtitles\" srcland=\"en\" label=\"English\" default /></video>");
		} else {
			$(".video_holder").html("<video id=\"gvp_video\" class=\"video-js vjs-default-skin\" controls><track src=\"smgt370_course_intro.vtt\" kind=\"subtitles\" srcland=\"en\" label=\"English\" default /></video>");
		}
		
		videojs("gvp_video",{},function() {
			this.progressTips();
			this.width(width);
			this.height(height);
			this.src({type: "video/mp4", src:"smgt370_course_intro.mp4"});
			if (intro) {
				this.play();
			}
		});
		
	}
	
	/*************************** MAIN CODES (FUNCTION CALLINGS) ***************************************/
	
	// call functions
	getQueryStringValues();
	
	if (intro) {
		setupIntroVideo();
	} else {
		setupMainVideo(true);
	}
	
	// hide the title bar when playback begins
	$(".video_holder").on("click",function() {
		$(".title_bar").hide();
	});
	
});