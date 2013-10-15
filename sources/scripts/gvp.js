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

        name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");

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
		}
		
		// get intro flag from query string if available
		if ($.trim(getParameterByName("intro")) !== "" && Number($.trim(getParameterByName("intro")))) {
			intro = $.trim(getParameterByName("intro"));
		}
		
		// get width from query string if available
		if ($.trim(getParameterByName("w")) !== "") {
			width = Number($.trim(getParameterByName("w")));
		}
		
		// get height from query string if available
		if ($.trim(getParameterByName("h")) !== "") {
			height = Number($.trim(getParameterByName("h")));
		}
		
		// get downloadable flag from query string if available
		if ($.trim(getParameterByName("dl")) !== "") {
			dl = $.trim(getParameterByName("dl")).split("");
		}
	}
	
	function getSource() {
		var urlToParse = window.location.href, src;
		
		console.log("URL to parse: " + urlToParse);
		src = urlToParse.split("?");
		src = src[0].split("/");
		src = src[src.length-1].replace(".html", "");
		console.log("Parse result: " + src);
	}
	
	function setupIntroVideo() {
	
		$(".video_holder").html("<video id=\"gvp_video\" class=\"video-js vjs-default-skin\" controls preload=\"metadata\" poster=\""+source+".jpg\"></video>");
	
		videojs("gvp_video",{},function() {
			introPlayer = this;
			this.progressTips();
			this.width(width);
			this.height(height);
			this.src({type: "video/mp4", src:"https://mediastreamer.doit.wisc.edu/uwli-ltc/media/intro_videos/"+intro+".mp4"});
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
			async: false,
			beforeSend: function (xhr) {
				xhr.overrideMimeType(content_type);
				xhr.setRequestHeader("Accept", content_type);
			},
			success: function () {
				
				var f = file, downloadBar = $("#download_bar ul");
				
				if (location.protocol === "http:") {
					var url = window.location.href;
					url = url.substr(0,url.lastIndexOf("/")+1).replace("https","http");
					f = url + file;
				}
				
				if (ext === "pdf") {
					downloadBar.append("<li><a href=\"" + f + "." + ext + "\" target=\"_blank\">Transcript</a></li>");
				} else if (ext === "mp3") {
					downloadBar.append("<li><a href=\"" + f + "." + ext + "\" target=\"_blank\">MP3</a></li>");
				} else if (ext === "mp4") {
					downloadBar.append("<li><a href=\"" + f + "." + ext + "\" target=\"_blank\">Video</a></li>");
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
	
	function getDownloadableFiles(files){
		
		if (files !== null) {
				
			for (var i = 0; i < files.length; i++) {
		
				switch (files[i]) {
					case "v":
						dowloadableFile(source,"mp4");
					break;
					case "a":
						dowloadableFile(source,"mp3");
					break;
					case "t":
						dowloadableFile(source,"pdf");
					break;
				} // end case
				
			} // end loop

		} // end files
		
	}
	
	function isMobile() {
	
		var ua = navigator.userAgent,
			checker = {
				ios: ua.match(/(iPad|iPhone|iPod)/g),
				blackberry: ua.match(/BlackBerry/),
				android: ua.match(/Android/),
				window: ua.match(/IEMobile/)
			};
		
		if (checker.ios || checker.blackberry || checker.android) { return true; }
		
		return false;

	}
	
	function setupPlayer() {
	
		$(document).attr('title', ($(".title_bar").html().length <= 0) ? capitalizeEachWord($.trim(source.replace(/\_+/g," "))) : $(".title_bar").html());
	
		if (isMobile() && (getParameterByName("m") === 0 || getParameterByName("m") === "")) {
		
			$(".video_holder").css({
				"background-image":"url("+source+".jpg)",
				"width": width+"px",
				"height": height+"px",
				"cursor":"pointer"
			}).html("<span class=\"newWindow-button\"></span>")
			.on("click",function() {
				var url = window.location.href;
				
				url = url.replace("https", "http").replace(/intro=[0-9]+/g, "intro=0");
				
				if (window.location.search) {
					url += "&m=1";
				} else {
					url += "?m=1";
				}
	
				window.open(url);
			});
			
		} else {
			
			if (intro) {
				setupIntroVideo();
			} else {
				setupMainVideo(true);
			}
			
			// hide the title bar when playback begins
			$(".video_holder").on("click",function() {
				$(".title_bar").hide();
			});
			
		}
	}
	
	/*************************** MAIN CODES (FUNCTION CALLINGS) ***************************************/

	getQueryStringValues();
	getSource();
	setupPlayer();
	getDownloadableFiles(dl);
	
});