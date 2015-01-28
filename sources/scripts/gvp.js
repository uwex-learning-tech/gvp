/*
 * Generic Video Player (GVP) JS
 *
 * @author: Ethan Lin
 * @url: https://github.com/oel-mediateam/gvp
 * @version: 3.3.0
 *
 * @license: The MIT License (MIT)
 * Copyright (c) 2014 UW-EX CEOEL
 *
 */

//document.createElement('video');document.createElement('audio');document.createElement('track');
/* global videojs */
/* global kWidget */

var ROOT_PATH = "https://media.uwex.edu/app/generic_video_player_v3/";

$(document).ready(function(){

	/*************************** GLOBAL-SCOPE VARIALBES ***************************/

	var width = 640, height = 360, intro = 0,
		source,
		programs = ["smgt","msmgt","hwm","himt","bps","il","flx"],
		isKaltura = false, kalturaId, kOptions;

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

		$.get( 'kaltura.txt', function(data) {

            kalturaId = data.trim();
    		isKaltura = true;

		} ).always( setupPlayer );

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

			this.src([
				{type: "video/mp4", src: "https://media.uwex.edu/content/media/intro_videos/"+intro+".mp4"},
				{type: "video/webm", src: "https://media.uwex.edu/content/media/intro_videos/"+intro+".webm"}
			]);

			this.on("ended", function() {
    			this.dispose();
                setupMainVideo();
			} );

		});

	}

	function setupMainVideo() {

        $(".video_holder").html("<video id=\"gvp_video\" class=\"video-js vjs-default-skin\"></video>");

        var video = $("#gvp_video");

		kOptions = {

            techOrder: ["html5", "flash"],
            'width': width,
            'height': height,
            "controls": true,
            "poster": source + '.jpg',
            "autoplay": false,
            "preload": "auto",
            "plugins": null

        };

		if ( isKaltura ) {

    		$.getScript( "../sources/scripts/mwembedloader.js", function() {

        		$.getScript( "../sources/scripts/kwidget.getsources.js", function() {

            		var entryId, captionId, captionExt, captionLang, flavors = {}, posterImg;

                    kWidget.getSources( {

                        'partnerId': 1660872,
                        'entryId': kalturaId,
                        'callback': function( data ) {

                            entryId = data.entryId;
                            captionId = data.captionId;
                            captionExt = data.captionExt;
                            captionLang = data.captionLang;

                            posterImg = "https://cdnsecakmi.kaltura.com/p/1660872/sp/166087200/thumbnail/entry_id/"+entryId+"/width/"+kOptions.width+"/height/"+kOptions.height;

                            $(".title_bar").html(data.name);

                            for( var i in data.sources ) {

                                var kSource = data.sources[i];

                                if ( kSource.flavorParamsId === 487061 ) {

                                    flavors.low = kSource.src;

                                }

                                if ( kSource.flavorParamsId === 487071 ) {

                                    flavors.normal = kSource.src;

                                }

                                if ( kSource.flavorParamsId === 487081 ) {

                                    flavors.high = kSource.src;

                                }

                                if ( kSource.flavorParamsId === 487111 ) {

                                    flavors.webm = kSource.src;

                                }

                            } // end for loop

                            // set low res vid if available
                            if ( flavors.low !== undefined ) {
                                video.append("<source src=\"" + flavors.low + "\" type=\"video/mp4\" data-res=\"low\" />");
                            }

                            // set normal res vid
                            video.append("<source src=\"" + flavors.normal + "\" type=\"video/mp4\" data-res=\"normal\" data-default=\"true\" />");

                            // set high res vid if available
                            if ( flavors.low !== undefined ) {
                                video.append("<source src=\"" + flavors.high + "\" type=\"video/mp4\" data-res=\"high\" />");
                            }

                            if ( flavors.webm !== undefined && $.fn.supportWebm() ) {
                                video.append("<source src=\"" + flavors.webm + "\" type=\"video/webm\" />");
                            }

                            // set caption track if available
                            if ( captionId !== null ) {
                                video.append("<track kind=\"subtitles\" src=\"https://cdnapisec.kaltura.com/api_v3/index.php/service/caption_captionAsset/action/serve/captionAssetId/" + captionId + "\" srclang=\"en\" label=\"English\">");
                            }

                            kOptions.poster = posterImg;
                            kOptions.plugins = { resolutionSelector: { default_res: 'normal' } };

                            loadPlayer();
                            getDownloadableFiles( data.downloadUrl );

                        }

                    } );

        		} );

    		} );

		} else {

            $.get( source + ".vtt", function() {

        		video.append( "<track src=\""+source+".vtt\" kind=\"subtitles\" srcland=\"en\" label=\"English\" />" );

    		} ).always( function() {

                video.append("<source src=\"" + source + ".mp4\" type=\"video/mp4\" />");
        		loadPlayer();
        		getDownloadableFiles( "" );

    		} );

		}

	}

	function loadPlayer() {

        if ( $.fn.supportMp4() === false && $.fn.supportWebm() === false ) {

            kOptions.techOrder = ["flash", "html5"];
            kOptions.plugins = null;

        }

		videojs("gvp_video", kOptions, function() {

                var player = this;

    			this.progressTips();

    			if ( intro ) {
    				this.play();
    			}

    			this.on( "ended", function() {

        			$(".vjs-poster").delay(3000).queue(function() {
        				$(this).html("<span class=\"replay-button\"></span>").show();
        				player.currentTime(0);
        			});

        			$( ".vjs-poster" ).on( "click", function() {
            			$( ".vjs-poster" ).hide();
            			player.play();
        			});


    			} );

    		});

            videojs.options.flash.swf = ROOT_PATH + "videoplayer/video-js.swf";

	}

	function getDownloadableFiles( kUrl ) {

        var downloadBar = $("#download_bar ul");
    	var fileName;
    	var url = window.location.href;

		url = url.substr(0,url.lastIndexOf("/")+1);
		fileName = url + source;

		if ( kUrl.length >= 1 ) {

    		downloadBar.append("<li><a href=\"" + kUrl + "\" target=\"_blank\">Video</a></li>");

    		// get pdf
            $.get( url + source + ".pdf", function() {

                downloadBar.append("<li><a href=\"" + fileName + ".pdf\" target=\"_blank\">Transcript</a></li>");

            } ).always( function() {

                // get supplement zip
                $.get( url + source + ".zip", function() {

                    downloadBar.append("<li><a href=\"" + fileName + ".zip\" target=\"_blank\">Supplement</a></li>");

                } );

            } );

        } else {

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

	}

	function setupPlayer() {

        // if not in a iFrame
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

});

 $.fn.supportWebm = function () {

     return !!document.createElement( 'video' )
                    .canPlayType( 'video/webm; codecs="vp8.0, vorbis"' );

 };

 $.fn.supportMp4 = function () {

     return !!document.createElement( 'video' )
                    .canPlayType( 'video/mp4; codecs="avc1.4D401E, mp4a.40.2"' );

 };