/* global videojs */
/* global console */

$(document).ready(function(){

	/*************************** GLOBAL-SCOPE VARIALBES ***************************/

	var width = 640, height = 360, intro = 0, dl = null, introPlayer,
		mainPlayer, source = "smgt370_course_intro";

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
		if ($.trim(getParameterByName("intro")) !== "" && Number($.trim(getParameterByName("intro")))) {
			intro = $.trim(getParameterByName("intro"));
			console.log("Intro: " + intro);
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
	
		$(".video_holder").html("<video id=\"gvp_video\" class=\"video-js vjs-default-skin\" controls preload=\"metadata\" poster=\""+source+".jpg\"></video>");
	
		videojs("gvp_video",{},function() {
			introPlayer = this;
			this.progressTips();
			this.width(width);
			this.height(height);
			this.src({type: "video/mp4", src:"intros/"+intro+".mp4"});
		});
		
		introPlayer.on("error",function() {
			this.dispose();
			$(".video_holder").html("<p class=\"error\">Video Error: intro video not found!<small>Intro video code "+ intro +" is not found or does not exist on the centralized location. Please double check the intro video code table for the correct intro video number.</small></p>");
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
			$(".video_holder").html("<video id=\"gvp_video\" class=\"video-js vjs-default-skin\" controls poster=\""+source+".jpg\"><track src=\""+source+".vtt\" kind=\"subtitles\" srcland=\"en\" label=\"English\" default /></video>");
		} else {
			$(".video_holder").html("<video id=\"gvp_video\" class=\"video-js vjs-default-skin\" controls><track src=\""+source+".vtt\" kind=\"subtitles\" srcland=\"en\" label=\"English\" default /></video>");
		}
		
		videojs("gvp_video",{},function() {
			mainPlayer = this;
			this.progressTips();
			this.width(width);
			this.height(height);
			this.src({type: "video/mp4", src: source+".mp4"});
			if (intro) {
				this.play();
			}
		});
		
		mainPlayer.on("error",function() {
			this.dispose();
			$(".video_holder").html("<p class=\"error\">Video Error: video not found!<small>Video file "+ source +".mp4 is not found or does not exist. Please double check the name of the directory, which holds the video. The name of the directory must the same with the video.</small></p>");
		});
		
		mainPlayer.on("ended", function() {
			this.currentTime(0);
			$(".vjs-poster").delay(6000).queue(function() {
				$(this).css("background-image","url("+source+".jpg)").html("<span class=\"replay-button\"></span>").show();
			});
		});
		
	}
	
	function dowloadableFile(file, ext) {
	
		var content_type;
		
		if (ext === "pdf") {
			content_type = "application/pdf";
		} else if (ext === "mp3") {
			content_type = "audio/mpeg";
		} else if (ext === "mp4") {
			content_type = "video/mp4";
		}
		
		$.ajax({
			url: file + "." + ext,
			type: 'HEAD',
			dataType: 'text',
			contentType: content_type,
			async: true,
			beforeSend: function (xhr) {
				xhr.overrideMimeType(content_type);
				xhr.setRequestHeader("Accept", content_type);
			},
			success: function () {
		
				if (ext === "pdf") {
					$("#download_bar ul").append("<li><a href=\"" + file + "." + ext + "\" target=\"_blank\">Transcript</a></li>");
				} else if (ext === "mp3") {
					$("#download_bar ul").append("<li><a href=\"" + file + "." + ext + "\" target=\"_blank\">MP3</a></li>");
				} else if (ext === "mp4") {
					$("#download_bar ul").append("<li><a href=\"" + file + "." + ext + "\" target=\"_blank\">Video</a></li>");
				}
				
			},
			error: function () {
		
				var string;
		
				if (ext === "pdf") {
					string = "Transcript";
				} else if (ext === "mp3") {
					string = "MP3";
				} else if (ext === "mp4") {
					string = "Video";
				}
		
				string += " pending...";
				$("#download_bar ul").before("<p>" + string + "</p>");
		
			}
		});
	}
	
	/*************************** MAIN CODES (FUNCTION CALLINGS) ***************************************/
	
	getQueryStringValues();
	
	dowloadableFile(source,"mp4");
	dowloadableFile(source,"mp3");
	dowloadableFile(source,"pdf");
	
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