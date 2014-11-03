document.createElement('video');document.createElement('audio');document.createElement('track');
/* global videojs */

$(document).ready(function(){

	/*************************** GLOBAL-SCOPE VARIALBES ***************************/

	var width = 640, height = 360, intro = 0,
		introPlayer, mainPlayer, source,
		programs = ["smgt","msmgt","hwm","himt","bps","il","flx"];

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
			$(".title_bar").html(capitalizeEachWord($.trim(getParameterByName("ttl"))));
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

	}

	function getSource() {
		var urlToParse = window.location.href, src;

		src = urlToParse.split("?");
		src = src[0].split("/");
		src = src[src.length-2];
		source = src;
	}

	function setupIntroVideo() {

		$(".video_holder").html("<video id=\"gvp_video\" class=\"video-js vjs-default-skin\"></video>");

		videojs("gvp_video", {

            'width': width,
            'height': height,
            "controls": true,
            "poster": source + ".jpg",
            "autoplay": false,
            "preload": "metadata",

        }, function() {
			introPlayer = this;
			this.src([
				{type: "video/mp4", src:"https://mediastreamer.doit.wisc.edu/uwli-ltc/media/intro_videos/"+intro+".mp4"},
				{type: "video/webm", src:"https://mediastreamer.doit.wisc.edu/uwli-ltc/media/intro_videos/"+intro+".webm"}
			]);
		});

		introPlayer.on("error",function() {

			var mp4 = fileAvailable(intro,"mp4","video/mp4"), wm = fileAvailable(intro,"webm","video/webm");

			if (mp4 === false) {
				this.src([{type: "video/webm", src: source+".webm"}]);
			}

			if (wm === false) {
				this.src([{type: "video/mp4", src: source+".mp4"}]);
			}

			if (wm === false && mp4 === false) {
				this.dispose();
				$(".video_holder").html("<p class=\"error\">Video Error: intro video not found!<small>Intro video code "+ intro +" is not found or does not exist on the centralized location. Please double check the intro video code table for the correct intro video number.</small></p><p class=\"error\">If you see this message, both MP4 and WebM are not found.</p>");
			}

		});

		introPlayer.on("ended", function() {
			this.dispose();
			setupMainVideo();
		});

	}

	function setupMainVideo() {

		var subtitle = (fileAvailable(source,"vtt","text/vtt")) ? subtitle = "<track src=\""+source+".vtt\" kind=\"subtitles\" srcland=\"en\" label=\"English\" />" : "";

		$(".video_holder").html("<video id=\"gvp_video\" class=\"video-js vjs-default-skin\">" + subtitle + "</video>");

		videojs("gvp_video", {

            'width': width,
            'height': height,
            "controls": true,
            "poster": source + ".jpg",
            "autoplay": false,
            "preload": "metadata"

        }, function() {

			mainPlayer = this;

			this.progressTips();

			this.src([
				{type: "video/mp4", src: source+".mp4"},
				{type: "video/webm", src: source+".webm"}
			]);

			if (intro) {
				this.play();
			}

		});

        videojs.options.flash.swf = "https://mediastreamer.doit.wisc.edu/uwli-ltc/media/storybook_plus_v2/sources/videoplayer/video-js.swf";

		mainPlayer.on("error",function() {

			var mp4 = fileAvailable(source,"mp4","video/mp4"), wm = fileAvailable(source,"webm","video/webm");

			if (mp4 === false) {

				this.src([{type: "video/webm", src: source+".webm"}]);

			}

			if (wm === false) {
				this.src([{type: "video/mp4", src: source+".mp4"}]);
				//$(".vjs-loading-spinner").hide();
			}

			if (mp4 === false && wm === false) {
				this.dispose();
				$(".video_holder").html("<p class=\"error\">Video Error: video not found!<small>Video file \"<strong>"+ source +"</strong>\" is not found. Please double check the video file name. The file name must match the directory name.</small></p><p class=\"error\">If you see this message, both MP4 and WebM are not found.</p>");
			}

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

				if (location.protocol !== "http:") {
					var url = window.location.href;
					url = url.substr(0,url.lastIndexOf("/")+1).replace("https","http");
					f = url + file;
				}

				if (ext === "pdf") {
					downloadBar.append("<li><a href=\"" + f + "." + ext + "\" target=\"_blank\">Transcript</a></li>");
				} else if (ext === "mp3") {
					downloadBar.append("<li><a href=\"" + f + "." + ext + "\" target=\"_blank\">Audio</a></li>");
				} else if (ext === "mp4") {
					downloadBar.append("<li><a href=\"" + f + "." + ext + "\" target=\"_blank\">Video</a></li>");
				}

			},
			error: function () {


			}
		});
	}

	function getDownloadableFiles(){

		dowloadableFile(source,"mp4");
		dowloadableFile(source,"mp3");
		dowloadableFile(source,"pdf");

	}

	function fileAvailable(file,ext,file_type) {
		var isAvilable = false;
		$.ajax({
			url: file + "." + ext,
			type: 'HEAD',
			dataType: 'text',
			contentType: file_type,
			async: false,
			beforeSend: function (xhr) {
				xhr.overrideMimeType(file_type);
				xhr.setRequestHeader("Accept", file_type);
			},
			success: function () {
				isAvilable = true;
			},
			error: function () {
				isAvilable = false;
			}
		});
		return isAvilable;
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

		if (window.self === window.top) {

			var d = new Date();
			var address = location.href;
			var program = "";

			$.each(programs,function(i){
				if (programs[i] === address.split("/")[4]) {
					if (programs[i] === "msmgt") {
						program = "smgt";
					} else {
						program = programs[i];
					}
					return false;
				} else {
					program = "default";
				}
			});

			$("body").addClass(program);
			$(".gvp_wrapper").prepend("<div class=\"logo\"></div>");
			$(".gvp_wrapper").append("<div class=\"footer\">Copyright &copy; "+d.getFullYear()+". University of Wisconsin System. All rights reserved.</div>");

		}

		$(document).attr('title', ($(".title_bar").html().length <= 0) ? capitalizeEachWord($.trim(source.replace(/\_+/g," "))) : $(".title_bar").html());

		$(".gvp_wrapper").css({
			"width": width+"px"
		});

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
			$(".video_holder").click(function() {
				if (window.self !== window.top) {
					$(".title_bar").hide();
				}
			});

		}
	}

	/*************************** MAIN CODES (FUNCTION CALLINGS) ***************************************/

	getQueryStringValues();
	getSource();
	setupPlayer();
	getDownloadableFiles();

});