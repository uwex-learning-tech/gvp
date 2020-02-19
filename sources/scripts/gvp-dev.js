/*
 * Generic Video Player (GVP)
 *
 * @author: Ethan Lin
 * @url: https://github.com/oel-mediateam/gvp_v4
 * @version: 4.0.7
 * Released 02/xx/2020
 *
 * @license: GNU GENERAL PUBLIC LICENSE v3
 *
    Generic Video Player is a video player build on top of VideoJS to serve
    video contents.
    Copyright (C) 2013-2020  Ethan S. Lin, UW Extended Campus

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
 
    WARNING:
    This JavaScript file uses features from ECMAScript 2015, 2016, and 2017.
    All modern web browsers (excluding Internet Explorer 11) support ECMAScript
    2015, 2016, and 2017. For web browsers that do not support ECMAScript 2015
    2016, and 2017 features, compile this JavaScript using Babel with Polyfill
    (http://babeljs.io/).
 
 *
 */

/**** GLOBAL VARIABLES ****/

const sessionId = guid(); // an unique id for session
let manifest = {}; // an object to hold the data from the manifest file
let theme = {}; // an object to hold the theme data
let program = {}; // an object to hold the program data

// an object to hold current browser window URL and queries
let reference = {
    names: window.location.href,
    params: new URLSearchParams( window.location.search )
};

// an object to hold player source and template
let gvp = {
    source: '',
    template: null,
    player: null
};

// an object to hold the kaltura library
let kaltura = {
    lib: null,
    widget: null
};

// an object to hold data from the XML
let xml = {
    file: 'gvp.xml',
    doc: null,
    titleTag: null,
    kalturaTag: null,
    fileNameTag: null,
    markersTag: null,
    markersCollection: []
};

// an object that holds the state of the player
let flags = {
    isLocal: false,
    isYouTube: false,
    isKaltura: false,
    isIframe: false,
    played: false,
    playReached25: false,
    playReached50: false,
    playReached75: false
};

/**** ON DOM READY; RUNS THE initGVP function ****/

( function ready( fn ) {
    
    if ( document.attachEvent ? document.readyState === 'complete' : document.readyState !== 'loading' ) {
        fn();
    } else {
        document.addEventListener( 'DOMContentLoaded', fn );
    }
    
} )( initGVP );

/**** GVP CORE FUNCTIONS ****/

/**
 * Initialize the generic video player first by loading the data
 * from the manifest JSON file.
 * 
 * @function initGVP
 */
function initGVP() {
    
    // set the URL to the manifest JSON file
    let manifestURL = document.getElementById( 'gvp-manifest' ).href;
    
    // parse directories from the URL
    reference.names = reference.names.split( '?' );
    reference.names = reference.names[0];
    
    if ( reference.names.lastIndexOf( '/' ) !== reference.names.length - 1 ) {
		reference.names += '/';
	}
	
	reference.names = cleanArray( reference.names.split( '/' ) );
	
	// if inside an iframe, set the isFrame flag to true
	if ( window.self != window.top ) {
    	flags.isIframe = true;
	}
    
    // get the data from the manifest file
    getFile( manifestURL, true ).then( result => {
        
        // set JSON data to the manifest object
        manifest = result;
        
        // default the player root director to 'sources/'
        // if not specified in the JSON data
        if ( manifest.gvp_root_directory.length <= 0 ) {
            manifest.gvp_root_directory = 'sources/';
        }

        // set the URL to the Kaltura libraries
        kaltura.lib = manifest.gvp_root_directory + 'scripts/mwembedloader.js';
        kaltura.widget = manifest.gvp_root_directory + 'scripts/kwidget.getsources.js';

        // set the URL to the player template file
        gvp.template = manifest.gvp_root_directory + 'scripts/templates/gvp.tpl';
        
        // call to setup the program theme
        setProgram();
        
    } );
    
}

/**
 * Retrieved program data from the manifest JSON file.
 * 
 * @function setProgram
 */
function setProgram() {
    
    // if program themes data is set in the manifest JSON
    if ( manifest.gvp_program_themes ) {
        
        // get the program theme data
        getFile( manifest.gvp_program_themes, true ).then( results => {
            
            if ( results != undefined ) {
                
                // set the theme data to the theme object
                theme = results;
                
                // set the program if it matches the program
                // from the URL
                program = theme.program_themes.find( function (obj) {
                    return obj.name === reference.names[3];
                } );
                
                // if program is undfined, set to the default program
                if ( program === undefined ) {
                    
                    program = theme.program_themes.find( function (obj) {
                        return obj.name === manifest.gvp_logo_default;
                    } );
                    
                }
                
            }
            
            // call to setup the player template
            setGvpTemplate();
            
        } );
        
    }
    
}

/**
 * Retrieved player HTML template from the template file.
 * 
 * @function setGvpTemplate
 */
function setGvpTemplate() {
    
    // get the template file
    getFile( gvp.template ).then( result => {
        
        if ( result ) {
            
            // get the DOM element to hold the HTML template
            let gvpWrapper = document.getElementById( 'gvp-wrapper' );
            
            // set the HTML template to the DOM
            gvpWrapper.innerHTML = result;
            
            // if it is not embeded in an iFrame
            if ( !flags.isIframe ) {
                
                // get/set copyright year
                let copyrightYearHolder = document.getElementsByClassName( 'gvp-copyright-year' )[0];
                let date = new Date();
                let year = date.getFullYear();
                
                copyrightYearHolder.innerHTML = year;
                
                // set copyright notice
                if ( theme.copyright !== undefined ) {
                    
                    let noticeHolder = document.getElementById( 'gvp_notice' );
                    noticeHolder.innerHTML = theme.copyright;
                    
                }

            // it is in an iFrame
            } else {
                
                // add the embedded class to the DOM element
                gvpWrapper.classList.add( "embedded" );
                
                // if it is embedde in an iFrame and inside
                // a Storybook+ presentation...
                try {
                    
                    // remove the title bar
                    if ( window.parent.SBPLUS !== undefined ) {
                        
                    	gvpWrapper.classList.add( 'sbplus-embed' );
                    	
                    	let titleBar = document.getElementsByClassName( 'gvp-title-bar' )[0];
                    	titleBar.style.display = 'none';
                    	
                    	flags.sbplusEmbed = true;
                    	
                	}
                    
                } catch( e ) {
                    
                    flags.sbplusEmbed = false;
                    
                }
                
            }

            // call to setup the player UI
            setGvpUi();
            
        }
        
    } );
    
}

/**
 * Setup the player user interface with the correct program,
 * theme, and environment.
 * 
 * @function setGvpUi
 */
function setGvpUi() {
    
    // display logo
    let logoURL = manifest.gvp_logo_directory + program.name + '.svg';
    
    // retrive the program logo
    fileExist( logoURL ).then( result => {
        
        let programLogoDiv = document.getElementsByClassName( 'gvp-program-logo' );
        let url = logoURL;
        
        if ( result ) {
            url = logoURL;
        } else {
            url = manifest.gvp_logo_directory + manifest.gvp_logo_default + '.svg'
        }
        
        for ( let i = 0; i < programLogoDiv.length; i++ ) {
            programLogoDiv[i].style.backgroundImage = 'url(' + url + ')';
        }
        
    } );
    
    // if it is not inside an iFrame
    // allow the ability to black out the background
    if ( !flags.isIframe ) {
        
        if ( reference.params.has( 'light' ) && reference.params.get( "light" ) === '1' ) {
            
            let body = document.getElementsByTagName( 'body' )[0];
            
            if ( !body.classList.contains( 'light-off' ) ) {
                
                body.classList.add( 'light-off' );
                
            }
            
        }
        
        // call to setup the program theme
        setProgramTheme();
        
    }
    
    // call to the video source at the same time
    getVideoSource();
    
}

/**
 * Setup the theme color bar if the data is available.
 * 
 * @function setProgramTheme
 */
function setProgramTheme() {
    
    if ( program.colors !== undefined ) {
        
        let decorationBar = document.getElementsByClassName( 'gvp-decoration-bar' )[0];
        
        program.colors.forEach( function( hex ) {
                    
            let span = document.createElement( 'span' );
            span.style.backgroundColor = hex;
            decorationBar.appendChild(span);
            
        } );
        
    }
    
}

/**
 * Read and parse the XML file that contains the video source
 * and additional data. 
 * 
 * @function getVideoSource
 */
function getVideoSource() {
    
    // get the kaltura video id from gvp.xml file
    // otherwist default to URN
    getFile( xml.file ).then( result => {
        
        if ( result ) {
            
            // parse the xml
            let xmlParser = new DOMParser();
            
            xml.doc = xmlParser.parseFromString( result, 'text/xml' );
            
            // check to see is there are markers
            if ( xml.doc != null ) {
                
                xml.markersTag = xml.doc.getElementsByTagName( 'markers' )[0];
                
                if ( xml.markersTag !== undefined ) {

                    if ( xml.doc.getElementsByTagName( 'markers' )[0].querySelectorAll('marker').length ) {
                        
                        let markerTag = xml.doc.getElementsByTagName( 'marker' );
                        
                        for ( var i = 0; i < markerTag.length; i++ ) {
                            
                            let markerColor = '';
                            
                            if ( markerTag[i].attributes.color !== undefined ) {
        
                                if ( markerTag[i].attributes.color.nodeValue.trim() !== '' ) {
                                    markerColor = markerTag[i].attributes.color.nodeValue.trim();
                                }
                                
                            }
                            
                            let marker = {
                                time: toSeconds( markerTag[i].attributes.timecode.nodeValue ),
                                text: markerTag[i].childNodes[0].nodeValue,
                                color: markerColor
                            };
                            
                            xml.markersCollection.push( marker );
        
                        }
                        
                    }
                    
                }
                
            }
            
            // see if kalturaId tag is specified
            // and load the Kaltura libraries if it is
            if ( xml.doc.getElementsByTagName( 'kalturaId' )[0] !== undefined ) {
                
                xml.kalturaTag = xml.doc.getElementsByTagName( 'kalturaId' )[0];

                if ( xml.kalturaTag !== undefined ) {
                    
                    if ( xml.kalturaTag.childNodes[0] !== undefined
                         && xml.kalturaTag.childNodes[0].nodeValue.trim() != '' ) {
                        
                        gvp.source = xml.kalturaTag.childNodes[0].nodeValue.trim();
                    
                        flags.isLocal = false;
                        flags.isKaltura = true;
                        getKalturaLibrary();
                        return;
                        
                    }
                    
                }
                
            }
            
            // see if youtubeId tag is specified
            if ( xml.doc.getElementsByTagName( 'youtubeId' )[0] !== undefined ) {

                xml.youtubeTag = xml.doc.getElementsByTagName( 'youtubeId' )[0];
    
                if ( xml.youtubeTag !== undefined ) {
                    
                    if ( xml.youtubeTag.childNodes[0] !== undefined
                         && xml.youtubeTag.childNodes[0].nodeValue.trim() != '' ) {
                        
                        gvp.source = xml.youtubeTag.childNodes[0].nodeValue.trim();
                    
                        flags.isLocal = false;
                        flags.isYouTube = true;
                        setVideoJs();
                        return;
                        
                    }
                    
                }
                
            }
            
            // see if fileName tag is specified
            xml.fileNameTag = xml.doc.getElementsByTagName( 'fileName' )[0];
            
            if ( xml.fileNameTag !== undefined ) {
                
                if ( xml.fileNameTag.childNodes[0] !== undefined
                     && xml.fileNameTag.childNodes[0].nodeValue.trim() != '' ) {
                     
                    gvp.source = xml.fileNameTag.childNodes[0].nodeValue;
                    flags.isLocal = true;
                    setVideoJs();
                    return;
                
                }
                
            }
            
            // default to 'video' if both tags are not found/available
            gvp.source = 'video';
            flags.isLocal = true;
            
        } else {
            
            flags.isLocal = true;
            
            if ( reference.names[5] === undefined ) {
                
                gvp.source = "video";
                
            } else {
                
                gvp.source = reference.names[5];
                
            }
            
        }
        
        // call to setup the video player functionality
        setVideoJs();

    } );
    
}

/**
 * Contains functions to set title, load the video JS, and
 * set downloadable files. 
 * 
 * @function setVideoJs
 */
function setVideoJs() {
    setTitle();
    loadVideoJS();
    setDownloadables();
}

/**
 * Loads the Kaltura libraries.
 * 
 * @function getKalturaLibrary
 */
function getKalturaLibrary() {
    getScript( kaltura.lib, false, false );
    getScript( kaltura.widget, false, loadLalturaSource );
}

/**
 * Get video information from Kaltura.
 * 
 * @function loadLalturaSource
 */
function loadLalturaSource() {
    
    if ( kWidget ) {
        
        // get the video source base on the provided
        // configrations
        kWidget.getSources( {
            
            'partnerId': manifest.gvp_kaltura.id,
            'entryId': gvp.source,
            'callback': function( data ) {
                
                kaltura = data;
                kaltura.flavor = {};
                
                kaltura.sources.forEach( function( flavor ) {
                    
                    if ( flavor.flavorParamsId === manifest.gvp_kaltura.low ) {
                        kaltura.flavor.low = flavor.src;
                        return;
                    }
                    
                    if ( flavor.flavorParamsId === manifest.gvp_kaltura.medium ) {
                        kaltura.flavor.medium = flavor.src;
                        return;
                    }
                    
                    if ( flavor.flavorParamsId === manifest.gvp_kaltura.normal ) {
                        kaltura.flavor.normal = flavor.src;
                        return;
                    }
                    
                } );
                
                if ( kaltura.sources.length === 0 ) {
                    showErrorMsgOnCover( 'Kaltura video Id (' + gvp.source + ') not found.' );
                    return;
                }
                
                // call to setup the videoJS player
                setVideoJs();
                
            }
    
        } );
        
    }
    
}

/**
 * Loads the videoJS player.
 * 
 * @function loadVideoJS
 */
function loadVideoJS() {
    
    // autoplay settings
    let isAutoplay = false;

    if ( reference.params.has( 'autoplay' ) && reference.params.get( 'autoplay' ) === '1' ) {
        isAutoplay = true;
    }
    
    // player options
    let playerOptions = {
        techOrder: ['html5'],
        controls: true,
        autoplay: isAutoplay,
        preload: 'auto',
        playbackRates: [0.5, 1, 1.5, 2],
        fluid: true,
        plugins: {}
    };
    
    // additional options if the video is from YouTube
    if ( flags.isYouTube && flags.isLocal === false ) {
        playerOptions.techOrder = ['youtube'];
        playerOptions.sources = [{ type: "video/youtube", src: "https://www.youtube.com/watch?v=" + gvp.source }];
        playerOptions.youtube = {
            'modestbranding': 1,
            'iv_load_policy' : 3
        }
    }
    
    // add video qualitiy functionality if video is from YouTube or Kaltura
    if ( ( flags.isYouTube || flags.isKaltura ) && flags.isLocal === false ) {
        Object.assign( playerOptions.plugins, { videoJsResolutionSwitcher: { 'default': 720 } } );
    }
    
    // initialize the video player bases options/configurations
    gvp.player = videojs( 'gvp-video', playerOptions, function() {
        
        let self = this;
        
        // if video is from Kaltura, set the video sources
        // mulitple Kaltura flavors
        if ( flags.isKaltura && flags.isLocal === false ) {
            
            self.poster( kaltura.poster + '/width/900/quality/100' );
            self.updateSrc( [
                { type: 'video/mp4', src: kaltura.flavor.low, label: 'low', res: 360 },
                { type: 'video/mp4', src: kaltura.flavor.normal, label: 'normal', res: 720 },
                { type: 'video/mp4', src: kaltura.flavor.medium, label: 'medium', res: 640 } 
            ] );
            
            // setup the caption if applicable
            if ( kaltura.captionId ) {
                
                self.addRemoteTextTrack( {
            		kind: 'captions',
            		language: 'en',
            		label: 'English',
            		src: 'https://www.kaltura.com/api_v3/?service=caption_captionasset&action=servewebvtt&captionAssetId=' + kaltura.captionId + '&segmentDuration=' + kaltura.duration + '&segmentIndex=1'
        		}, true );
                
            }
            
        } else if ( flags.isYouTube && flags.isLocal === false ) {
            
            // do nothing
            
        } else { // if the video is local
            
            self.src( gvp.source + '.mp4' );
            
            if ( fileExist( gvp.source + '.vtt' ) ) {
                
                self.addRemoteTextTrack( {
            		kind: 'captions',
            		language: 'en',
            		label: 'English',
            		src: gvp.source + '.vtt'
        		}, true );
        		
            }
            
        }
        
        // URL queried event listeners
        // if start time is specified
        if ( reference.params.has( 'start' ) ) {
            
            self.on( 'play', function() {
                
                if ( flags.played === false ) {
                    
                    if ( flags.isYouTube ) {
                        self.currentTime( queryToSeconds( reference.params.get( 'start' ) ) );
                    }
                    
                    flags.played = true;
                    
                }
                
                if ( self.played().length === 0 ) {
                    
                    self.currentTime( queryToSeconds( reference.params.get( 'start' ) ) );
                    
                }
                
            } );
            
        }
        
        // if end time is specified
        if ( reference.params.has( 'end' ) ) {
            
            self.on( 'timeupdate', function() {
                
                if ( self.currentTime() >= queryToSeconds( reference.params.get( 'end' ) ) ) {
                    
                    self.pause();
                    self.off( 'timeupdate' );
                    
                }
                
            } );
            
        }
        
        // media event listeners        

        // on load
        self.on( 'loadedmetadata', function() {
            
            if ( flags.isKaltura ) {

                sendToKalturaAnalytics( '2' );

                if ( playerOptions.autoplay ) {
                    
                    sendToKalturaAnalytics( '3' );
                    
                } else {
                    
                    let bigPlayBtn = document.getElementsByClassName( 'vjs-big-play-button' )[0];
                    
                    bigPlayBtn.addEventListener( 'click', function() {
                        
                        sendToKalturaAnalytics( '3' );
                        
                    }, { once: true } );
                    
                }

            }
            
        } );
        
        // on playing
        self.on( 'playing', function() {
            
            let logo = document.getElementsByClassName( 'gvp-program-logo' )[1];
            let splashDwnldBtn = document.getElementsByClassName( 'gvp-download-btn' )[0];
            
            logo.style.display = 'none';
            splashDwnldBtn.style.display = 'none';
            
            if ( flags.isIframe ) {
                
                let titleBar = document.getElementsByClassName( 'gvp-title-bar' )[0];
                titleBar.style.display = 'none';
                
            }
            
        } );

        // as video playback progresses
        self.on( 'timeupdate', function() {

            if ( flags.isKaltura && self.duration() ) {

                let progressPercentage = ( self.currentTime() / self.duration() ) * 100;

                if ( progressPercentage >= 25 && flags.playReached25 == false ) {
                    flags.playReached25 = true;
                    sendToKalturaAnalytics( '4' );
                }

                if ( progressPercentage >= 50 && flags.playReached50 == false ) {
                    flags.playReached50 = true;
                    sendToKalturaAnalytics( '5' );
                }

                if ( progressPercentage >= 75 && flags.playReached75 == false ) {
                    flags.playReached75 = true;
                    sendToKalturaAnalytics( '6' );
                }

            }

        } );
        
        // as video completely ended
        self.on( 'ended', function() {
            
            document.getElementsByClassName( 'gvp-download-btn' )[0].style.display = 'initial';
            
            if ( flags.sbplusEmbed === undefined || flags.sbplusEmbed === false) {
                
                self.bigPlayButton.el_.classList.add( 'replay' );
                self.hasStarted( false );
                
            }

            if ( flags.isIframe ) {
                
                if ( flags.sbplusEmbed === undefined || flags.sbplusEmbed === false ) {
                    
                    let logo = document.getElementsByClassName( 'gvp-program-logo' )[1];
                    
                    logo.style.display = 'initial';
                    
                    let titleBar = document.getElementsByClassName( 'gvp-title-bar' )[0];
                    titleBar.style.display = 'block';
                    
                }
                
            }
            
            if ( flags.isKaltura ) {

                sendToKalturaAnalytics( '7' );

                let bigReplayBtn = document.querySelector( '.vjs-big-play-button.replay' );

                bigReplayBtn.addEventListener( 'click', function() {
                    
                    sendToKalturaAnalytics( '16' );
                    
                }, { once: true } );

            }

        } );

        self.on( 'fullscreenchange', function() {
            
            if ( flags.isKaltura ) {

                let isFullScreen = document.fullScreen || document.mozFullScreen || document.webkitIsFullScreen;
        
                if ( isFullScreen ) {
                    sendToKalturaAnalytics( '14' );
                } else {
                    sendToKalturaAnalytics( '15' );
                }

            }
    
        } );
        
        self.on( 'error', function() {
            
            let msg = 'Please double check the file name.<br>Expecting: ' + self.currentSrc() + '<br><br>';
            showErrorMsgOnCover( msg + self.error_.message  );
            
        } );
        
        // add forward and backward seconds button if video is longer than 1 minutes
        addForwardButton( self );
        addBackwardButton( self );
        
        // add download button if it is not indside
        addDownloadFilesButton( self );
        
        // add markers if any
        setupMarkers( gvp.player );
        
        // if youtube, hide cover on ready and reset markers
        if ( flags.isYouTube ) {
            
            let ytCaption = 'https://www.youtube.com/api/timedtext?fmt=vtt&v=' + gvp.source + '&lang=en';
            
            let ytPromise = new Promise( ( resolve, reject ) => {
                
                resolve( remoteYTCaptionExist( ytCaption ) );
                reject( noYTCaptionExist() );
                
            } );
            
            ytPromise.then( ( result ) => {
                
                if ( result !== null || result !== undefined ) {
                    
                    if ( result.length > 0 ) {
                    
                        self.addRemoteTextTrack( {
                            kind: 'captions',
                            label: 'English',
                            srclang: 'en',
                            src: ytCaption
                        }, false );
                        
                    }
                    
                }
                
            } );
            
            self.on( 'play', function() {
                gvp.player.markers.reset(xml.markersCollection);
            } );
            
        }
        
        // hide the program theme cover
        hideCover();
        
    } );

}

function sendToKalturaAnalytics( eventType ) {

    if ( gvp.player ) {

        let timestamp = + new Date();
        let statHttp = new XMLHttpRequest();
        let trackUrl = 'https://www.kaltura.com/api_v3/index.php?service=stats&action=collect&event%3AsessionId=' + sessionId + '&event%3AeventType=' + eventType + '&event%3ApartnerId=' + manifest.gvp_kaltura.id + '&event%3AentryId=' + gvp.source + '&event%3Areferrer=https%3A%2F%2Fmedia.uwex.edu&event%3Aseek=false&event%3Aduration=' + gvp.player.duration() + '&event%3AeventTimestamp=' + timestamp;
        
        statHttp.open( 'GET', trackUrl, true );
        statHttp.send( null );

    }

}

function setupMarkers( player ) {
    
    // add markers
    player.markers( {
                    
        markers: xml.markersCollection
        
    } );
    
}

function setTitle() {
    
    let title = "";
    
    // see if title tag is specified
    if ( xml.doc !== null ) {
        
        xml.titleTag = xml.doc.getElementsByTagName( 'title' )[0];
        
        if ( xml.titleTag !== undefined ) {
            
            if (  xml.titleTag.childNodes[0] !== undefined
                  &&  xml.titleTag.childNodes[0].nodeValue.trim() !== '' ) {
                
                title = xml.titleTag.childNodes[0].nodeValue.trim();
                
            } else {
                
                title = setDefaultTitle();
                
            }
            
        } else {
            
            title = setDefaultTitle();
            
        }

    } else {
        
        title = setDefaultTitle();
        
    }
    
    document.getElementsByTagName( 'title' )[0].innerHTML = title;
    document.getElementsByClassName( 'gvp-title-bar' )[0].children[0].innerHTML = title;
    
}

function setDefaultTitle() {
    
    if ( flags.isKaltura && flags.isLocal === false ) {
        
        return kaltura.name;
        
    } else {
        
        if ( reference.params.has( 'title' ) ) {
            
            return reference.params.get( 'title' );
            
        }
        
    }
    
    return '';
        
}

function hideCover() {
    
    setTimeout( function() {
        
        let cover = document.getElementsByClassName( 'gvp-cover' )[0];
    
        if ( cover.style.display !== 'none' ) {
            
            cover.style.opacity = 1;
            
            let last = +new Date();
            let tick = function() {
                
                cover.style.opacity = +cover.style.opacity - ( new Date() - last ) / 500;
                last = +new Date();
                
                if ( +cover.style.opacity > 0 && +cover.style.opacity <= 1 ) {
                    (window.requestAnimationFrame && requestAnimationFrame(tick)) || setTimeout(tick, 500);
                }
                
                if ( +cover.style.opacity <= 0 ) {
                    cover.style.opacity = 0;
                    cover.style.display = 'none';
                }
                
            };
            
            tick();

        }
        
    }, 250 );
    
}

function addForwardButton( vjs ) {
    
    let secToSkip = 5;
    let Button = videojs.getComponent( 'Button' );
    let forwardBtn = videojs.extend( Button, {
        constructor: function( player, options ) {
            
            Button.call( this, player, options );
            this.el().setAttribute( 'aria-label','Skip Forward' );
            this.controlText( 'Skip Forward' );

        },
        handleClick: function() {
            
            if ( vjs.seekable() ) {
                
                secToSkip = getSecToSkip( vjs.duration() );
                
                let seekTime = vjs.currentTime() + secToSkip;
                
                if ( seekTime >= vjs.duration() ) {
                    seekTime = vjs.duration();
                }
                
                vjs.currentTime( seekTime );
                
            }
            
        },
        buildCSSClass: function() {
            return 'vjs-forward-button vjs-control vjs-button';
        } 
    } );

    videojs.registerComponent( 'ForwardBtn', forwardBtn );
    vjs.getChild( 'controlBar' ).addChild( 'ForwardBtn', {}, 1 );
    
/*
    vjs.on( 'play', function() {
        
        secToSkip = getSecToSkip( vjs.duration() );
        document.getElementsByClassName('vjs-forward-button')[0].classList.add( 'sec' + secToSkip );
        
    } );
*/
    
}

function addBackwardButton( vjs ) {
    
    let secToSkip = 5;
    let Button = videojs.getComponent( 'Button' );
    let backwardBtn = videojs.extend( Button, {
        constructor: function( player, options ) {
            
            Button.call( this, player, options );
            this.el().setAttribute( 'aria-label','Skip Backward' );
            this.controlText( 'Skip Backward' );

        },
        handleClick: function() {
            
            if ( vjs.seekable() ) {
                
                secToSkip = getSecToSkip( vjs.duration() );
                
                let seekTime = vjs.currentTime() - secToSkip;
                
                if ( seekTime <= 0 ) {
                    seekTime = 0;
                }
                
                vjs.currentTime( seekTime );
                
            }
            
        },
        
        buildCSSClass: function() {
            return 'vjs-backward-button vjs-control vjs-button';
        }
        
    } );

    videojs.registerComponent( 'BackwardBtn', backwardBtn );
    vjs.getChild( 'controlBar' ).addChild( 'BackwardBtn', {}, 1 );
    
/*
    vjs.on( 'play', function() {
       
        secToSkip = getSecToSkip( vjs.duration() );
        document.getElementsByClassName('vjs-backward-button')[0].classList.add( 'sec' + secToSkip );
       
    } );
*/
    
}

function getSecToSkip( duration ) {
    
    if ( isNaN( duration ) ) {
        
        return 0;
        
    }
    
    if ( duration >= 180 && duration < 300 ) {
        
        return 15;
        
    } else if ( duration >= 300 ) {
        
        return 30;
        
    }
    
    return 10;
        
}

function addDownloadFilesButton( vjs ) {
    
    if ( flags. sbplusEmbed === undefined ) {
        
        setTimeout( function() {
            
            let MenuButton = videojs.getComponent( 'MenuButton' );
            let downloadButton = videojs.extend( MenuButton, {
                constructor: function( player, options ) {
                    
                    MenuButton.call( this, player, options );
                    this.el().setAttribute( 'aria-label','Downloads' );
                    this.controlText( 'Downloads' );
    
                },
                createItems: function() {
                    
                    return downloadables( vjs );
    
                },
                handleClick: function() {
                    // do something but nothing in this case
                },
                buildCSSClass: function() {
                    return 'vjs-downloads-button';
                } 
            } );
    
            videojs.registerComponent( 'DownloadButton', downloadButton );
            vjs.getChild( 'controlBar' ).addChild( 'DownloadButton', {}, 13 );
            
        }, 1000 );
        
    }
    
}

function downloadables( vjs ) {
    
    let files = document.getElementsByClassName( 'gvp-download-list' )[0].childNodes;
    let items = [];
    
    let MenuItem = videojs.getComponent( 'MenuItem' );
    
    let DownloadMenuItem = videojs.extend( MenuItem, {
        
      constructor: function( player, options ) {
          
        options.selectable = true;
        MenuItem.call( this, player, options );
        this.src = options.src;
        
      }
      
    } );
    
    DownloadMenuItem.prototype.handleClick = function() {

      if ( this.options_.kaltura === true ) {
          
          if ( this.options_.id === 'videoDl' ) {

                downloadKalVid( this.options_.id );
              
          } else {
              
              document.getElementById( this.options_.id ).click();
              
          }
          
      } else {
          
          document.getElementById( this.options_.id ).click();
          
      }
      
    };
    
    MenuItem.registerComponent( 'DownloadMenuItem', DownloadMenuItem );
    
    for ( let i = 0; i < files.length; i++ ) {
        
        let fileLabel = files[i].childNodes[0].nodeValue;
        let fileId = files[i].id;
        let isKaltura = false;
        
        if ( !flags.isLocal ) {
            isKaltura = true;
        }
        
        items.push( new DownloadMenuItem(
            vjs,
            {
                label: fileLabel,
                id: fileId,
                kaltura: isKaltura
            }
        ) );
        
    }
    
    return items;
    
}

function setDownloadables() {
    
    let supportedFiles = manifest.gvp_download_files;
    let fileName = gvp.source;
    
    let lastIndex = reference.names.length;
    
    if ( lastIndex <= 2 ) {
        
        lastIndex = -1;
        
    } else {
        
        lastIndex--;
        
    }
    
    if ( flags.isYouTube ) {
        
        if ( reference.names[lastIndex] !== undefined ) {
                    
            fileName = reference.names[lastIndex];
            
        } else {
            
            fileName = 'video';
            
        }
        
    } else if ( flags.isKaltura ) {
        
        if ( reference.names[lastIndex] !== undefined ) {
                    
            fileName = reference.names[lastIndex];
            
        } else {
            
            fileName = 'video';
            
        }
        
    }
    
    supportedFiles.forEach( function( file ) {
        
        let fileLabel = file.label;
        let ext = file.format;
        let filePath = cleanString( fileName ) + '.' + ext;
        
        // video
        if ( ext === "mp4" ) {

            let dwnldPath = filePath;
            
            if ( flags.isKaltura && flags.isLocal === false ) {
                
                dwnldPath = kaltura.flavor.normal;
                
            } else {
                
                if ( reference.names[lastIndex] !== undefined ) {
                    
                    dwnldPath = cleanString( fileName ) + '.' + ext;
                    
                }
                
            }
            
            if ( flags.isYouTube === false ) {
                createDownloadLink( dwnldPath, fileLabel );
            }
            
            return;
            
        }
        
        fileExist( filePath ).then( result => {
                
            if ( result ) {
                
                createDownloadLink( filePath, fileLabel );
                
            }
            
        } );
        
    } );
    
    let downloadList =  document.getElementsByClassName( 'gvp-download-list' )[0];
    let anywhere = document.getElementsByTagName( 'body' )[0];
    
    if ( downloadList.childNodes.length ) {
        
        let downloadBtn = document.getElementsByClassName( 'gvp-download-btn' )[0];
        
        downloadBtn.style.display = 'block';
        
        downloadBtn.addEventListener( 'click', function() {
            
            if ( downloadList.style.display == 'block' ) {
                
                downloadList.style.display = 'none';
                downloadBtn.classList.remove( 'active' );
                
            } else {
                
                downloadList.style.display = 'block';
                downloadBtn.classList.add( 'active' );
                
            }
            
        } );
        
        anywhere.addEventListener( 'click', function( evt ) {
            
            if ( !evt.target.classList.contains( 'gvp-download-btn' ) ) {
                
                if ( downloadList.style.display == 'block' ) {
                
                    downloadList.style.display = 'none';
                    downloadBtn.classList.remove( 'active' );
                    
                }
                
            }

        } );
        
        if ( flags.isKaltura ) {
    
            let vidDwnldLink = document.getElementById( 'videoDl' );
            
            vidDwnldLink.addEventListener( 'click', function( evt ) {
                downloadKalVid( 'videoDl' );
                evt.preventDefault();
            } );
            
        }
        
    }
    
}

function createDownloadLink( path, label ) {
    
    let downloads = document.getElementsByClassName( 'gvp-download-list' )[0];
    let link = document.createElement( 'a' );
    
    link.id = label.toLowerCase() + "Dl";
    link.href = path;
    link.innerHTML = label;
    link.download = path;
    link.target = '_blank';
    
    downloads.appendChild( link );
    
}

function downloadKalVid( id ) {
    
    let videoUrl = document.getElementById( id ).href;
    let xhr = new XMLHttpRequest();
    let fileName = "";
    
    xhr.open( 'GET', videoUrl );
    xhr.responseType = 'arraybuffer';
    xhr.send( null );
    
    if ( reference.names[reference.names.length] ) {
        
        fileName = cleanString( reference.names[reference.names.length] );
        
    } else {
        
        fileName = cleanString(kaltura.name);
        
    }
    
    xhr.onload = function() {
      
      if ( this.status === 200 ) {
          
          let blob = new Blob( [this.response], { type: 'octet/stream' } );
          let url = window.URL.createObjectURL( blob );
          let dlLink = document.createElement( 'a' );
          let body = document.getElementsByTagName( 'body' )[0];
          
          dlLink.style.display = 'none';
          dlLink.href = url;
          dlLink.download = fileName + '.mp4';
          
          body.appendChild( dlLink );
          
          dlLink.click();
          
          window.URL.revokeObjectURL( url );
          dlLink.parentNode.removeChild( dlLink );
          
      }
      
    };
    
}

/****** HELPER FUNCTIONS ******/

function getScript( file, isAsync = true, callback = false ) {
    
    let script = document.createElement( 'script' );
    let head = document.getElementsByTagName( 'head' )[0];
    
    script.async = isAsync;
    
    if ( callback ) {
        script.onload = callback;
    }
    
    script.onerror = function() {
        console.warn( 'Failed to load ' + file );
    };
    
    script.src = file;
    head.appendChild( script );
    
}

async function fileExist( file ) {
    
    let options = {
        method: 'HEAD'
    };
    
    try {
        
        let response = await fetch( file, options );
        
        if ( response.ok ) {
            return true;
        }
        
        return false;
        
    } catch ( e ) {
        return false;
    }
    
}

async function remoteYTCaptionExist( file ) {
    
    let options = {
        method: 'GET'
    };
    
    try {
        
        let response = await fetch( file, options );
        
        if ( response.ok ) {
            return response.text();
        }
        
        return false;
        
    } catch ( e ) {
        return false;
    }
    
}

function noYTCaptionExist() {
    
    console.warn("YouTube caption failed to retreive or not found.");
    
}

async function getFile( file, isJson = false ) {
    
    let httpHeaders = new Headers();

    if ( isJson ) {
        httpHeaders.append( 'Content-Type', 'application/json' );
    } else {
        httpHeaders.append( 'Content-Type', 'text/html; charset=utf8' );
    }
    
    let options = {
        method: 'GET',
        headers: httpHeaders,
        mode: 'same-origin',
        cache: 'default'
    };
    
    try {
        
        let response = await fetch( file, options );
        let data = null;
        
        if ( response.ok ) {
            
            if ( isJson ) {
                data = await response.json();
            } else {
                data = await response.text();
            }
            
        }
        
        return data;
        
    } catch ( e ) {
        
        console.warn( 'Cannot fetch file: ' + file );
        
    }
    
}

function cleanArray( arr ) {
    
    arr.forEach( function( value, index ) {
        
        if ( value === '' ) {
            arr.splice( index, 1 );
        }
        
    } );
    
    if ( ( /(\w*|(\w*\-\w*)*)\.\w*/ig ).test( arr[arr.length-1] ) ) {
        arr.pop();
    }
    
    return arr;
    
}

function cleanString( str ) {
    
    return str.replace(/[^\w-]/gi, '').toLowerCase();
    
}

function queryToSeconds( str ) {
    
    let hrIndex = str.indexOf( 'h' );
    let minIndex = str.indexOf( 'm' );
    let secIndex = str.indexOf( 's' );
    
    let hr = 0;
    let min = 0;
    let sec = 0;
    
    if ( hrIndex != -1 ) {
        
        hr = Number( str.substring( 0, hrIndex ) );
        
    }
    
    if ( minIndex != -1 ) {
        
        if ( hrIndex != -1 ) {
            
            min = Number( str.substring( hrIndex + 1, minIndex ) );
            
        } else {
            
            min = Number( str.substring( 0, minIndex ) );
            
        }
        
        if ( min >= 60 ) {
            
            min = 59;
            
        }

    }
    
    if ( secIndex != -1 ) {
        
        
        if ( minIndex != -1 ) {
            
            sec = Number( str.substring( minIndex + 1, secIndex ) );
            
        } else {
            
            sec = Number( str.substring( 0, secIndex ) );
            
        }
        
        if ( sec >= 60 ) {
            
            sec = 59;
            
        }

    }
    
    hr = hr * 60 * 60;
    min = min * 60;
    
    return hr + min + sec;
    
}

function guid() {
    
    function s4() {
        return Math.floor( ( 1 + Math.random() ) * 0x10000 ).toString( 16 ).substring (1 );
    }
    
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
    
}

function toSeconds( str ) {
    
    let arr = str.split( ':' );
    
    if ( arr.length >= 3 ) {
        return Number( arr[0] * 60 ) * 60 + Number( arr[1] * 60 ) + Number( arr[2] );
    } else {
        return Number( arr[0] * 60 ) + Number( arr[1] );
    }
    
}

function showErrorMsgOnCover( str ) {
    
    let msg = document.getElementsByClassName( 'gvp-error-msg' )[0];
    
    msg.innerHTML = str;
    msg.style.display = 'block';
    
}