/*
 * Generic Video Player (GVP) JS
 *
 * @author: Ethan Lin
 * @url: https://github.com/oel-mediateam/gvp
 * @version: 3.2.4
 *
 * @license: The MIT License (MIT)
 * Copyright (c) 2014 UW-EX CEOEL
 *
 */

document.createElement('video');document.createElement('audio');document.createElement('track');
/* global videojs */

var ROOT_PATH = "https://media.uwex.edu/app/generic_video_player_v3/";

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

		var urlToParse = window.location.href;
		var src;

		src = urlToParse.split("?");
		src = src[0].split("/");
		src = src[src.length-2];

		source = src.toLowerCase();

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
				{type: "video/mp4", src: "https://media.uwex.edu/content/media/intro_videos/"+intro+".mp4"},
				{type: "video/webm", src: "https://media.uwex.edu/content/media/intro_videos/"+intro+".webm"}
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

        videojs.options.flash.swf = "" + ROOT_PATH + "videoplayer/video-js.swf";

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

	function getDownloadableFiles() {

        var downloadBar = $("#download_bar ul");
    	var fileName;
    	var url = window.location.href;

		url = url.substr(0,url.lastIndexOf("/")+1);
		fileName = url + source;

        // get mp4
        $.get( url + source + ".mp4", function() {

            downloadBar.append("<li><a href=\"" + fileName + ".mp4\" target=\"_blank\">Video</a></li>");

        } ).always( function() {

            // get mp3
            $.get( url + source + ".mp3", function() {

                downloadBar.append("<li><a href=\"" + fileName + ".mp3\" target=\"_blank\">Audio</a></li>");

            } ).always( function() {

                // get pdf
                $.get( url + source + ".pdf", function() {

                    downloadBar.append("<li><a href=\"" + fileName + ".pdf\" target=\"_blank\">Transcript</a></li>");

                } ).always( function() {

                    // get supplement zip
                    $.get( url + source + ".zip", function() {

                        downloadBar.append("<li><a href=\"" + fileName + ".zip\" target=\"_blank\">Supplement</a></li>");

                    } );

                } );

            } );

        } );

	}

	function fileAvailable( file, ext, file_type ) {

		var isAvilable = false;

		$.ajax({
			url: file + "." + ext,
			type: 'HEAD',
			dataType: 'text',
			contentType: file_type,
			// async: false,
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

	/*************************** MAIN CODES (FUNCTION CALLINGS) ***************************************/

	getQueryStringValues();
	getSource();
	setupPlayer();
	getDownloadableFiles();

});