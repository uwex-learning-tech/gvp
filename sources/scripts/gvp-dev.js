/*
 * Generic Video Player (GVP)
 *
 * @author: Ethan Lin
 * @author: Bryan Bortz
 * @url: https://github.com/uwex-learning-tech/gvp
 *
 * The version and build date are injected at build time from package.json --
 * see the banner at the top of the built file, and __GVP_VERSION__ below.
 *
 * @license: GNU GENERAL PUBLIC LICENSE v3
 *
    Generic Video Player is a video player build on top of VideoJS to serve
    video contents.
    Copyright (C) 2013-2026  Ethan S. Lin, UW Extended Campus

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

import '../scss/gvp.scss';

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
    player: null,
    captionLanguage: {
        code: '',
        label: ''
    }
};

// injected by webpack.DefinePlugin from package.json
const GVP_VERSION = typeof __GVP_VERSION__ !== 'undefined' ? __GVP_VERSION__ : 'dev';

// an object to hold the kaltura library
let kaltura = {
    lib: null,
    widget: null,
    // how long to wait for the Kaltura API before showing an error
    apiTimeout: 20000
};

// an object to hold data from the XML
let xml = {
    file: 'gvp.xml',
    doc: null,
    titleTag: null,
    authorTag: null,
    kalturaTag: null,
    fileNameTag: null,
    captionLanguageTag: null,
    markersTag: null,
    markersCollection: []
};

// an object that holds the state of the player
// Everything that has to be on screen before the cover clears registers here,
// so the whole splash -- poster/thumbnail, download buttons, author chip, corner
// logo -- is revealed in one piece instead of arriving in stages. The duration
// badge is deliberately NOT part of this: it depends on a separate metadata call
// and is allowed to fade in late on its own.
let splashParts = [];

function splashWaitFor( promise ) {
    splashParts.push( Promise.resolve( promise ).catch( function() {} ) );
}

let flags = {
    hasError: false,
    isLocal: false,
    isYouTube: false,
    isKaltura: false,
    isIframe: false,
    played: false,
    firstPlayed: false,
    playReached25: false,
    playReached50: false,
    playReached75: false,
    playReached100: false
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

    // load Google Analytic scripts first
    loadGoogleAnalytics();

    // set the URL to the manifest JSON file
    let manifestLink = document.getElementById( 'gvp-manifest' );

    if ( !manifestLink ) {
        reportError( 'GVP-102' );
        return;
    }

    let manifestURL = manifestLink.href;
    
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
        
        // getFile() resolves to undefined on a 404 or a network failure. This
        // used to walk straight into `manifest.gvp_root_directory` and throw
        // inside the promise, so the page just sat on its cover in silence.
        if ( !result ) {
            reportError( 'GVP-101', { source: manifestURL } );
            return;
        }

        // set JSON data to the manifest object
        manifest = result;

        // manifest.lang/dir were decorative until now -- nothing read them, so a
        // deployment that set them for an RTL or non-English site silently kept
        // announcing the page as English left-to-right.
        if ( manifest.lang ) {
            document.documentElement.setAttribute( 'lang', manifest.lang );
        }

        if ( manifest.dir ) {
            document.documentElement.setAttribute( 'dir', manifest.dir );
        }

        // keep the DOM attribute honest even when the page was not built by
        // webpack (e.g. served straight from sources during development)
        let wrapperEl = document.getElementById( 'gvp-wrapper' );

        if ( wrapperEl && wrapperEl.dataset.version !== GVP_VERSION ) {
            wrapperEl.dataset.version = GVP_VERSION;
        }
        
        // default the player root director to 'sources/'
        // if not specified in the JSON data
        if ( manifest.gvp_root_directory.length <= 0 ) {
            manifest.gvp_root_directory = 'sources/';
        }

        // set the URL to the Kaltura libraries
        kaltura.lib = manifest.gvp_root_directory + 'scripts/mwembedloader.js';
        kaltura.widget = manifest.gvp_root_directory + 'scripts/kwidget.getsources.js';
        gvp.youtubeTech = manifest.gvp_root_directory + 'scripts/videojs/plugins/youtube/youtube.min.js';

        // set the URL to the player template file
        gvp.template = manifest.gvp_root_directory + 'scripts/templates/gvp.tpl';
        
        // call to setup the program theme
        setProgram();
        
    } ).catch( e => {
        reportError( 'GVP-105', { stage: 'manifest', source: manifestURL, native: e && e.message } );
    } );
    
}

/**
 * Load Google Analytics scripts and send pageview event.
 * 
 * @function loadGoogleAnalytics
 */

function loadGoogleAnalytics() {

    /* Google Analytics gtag.js */
    let head = document.getElementsByTagName( 'head' )[0];
    let gtagScript = document.createElement( 'script' );

    gtagScript.type = "text/javascript";
    gtagScript.setAttribute( 'async', true );
    gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-6PC5NDV3F8';

    head.appendChild( gtagScript );
    /* Google Analytics gtag.js */

    /* Google Tag Manager */
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','GTM-NCB47RC');
    
    let noscript = document.getElementsByTagName( 'noscript' )[0];
    let gtagIframe = document.createElement( 'iframe' );

    gtagIframe.src = 'https://www.googletagmanager.com/ns.html?id=GTM-NCB47RC';
    gtagIframe.title = 'Google Tag Manager';
    gtagIframe.width = 0;
    gtagIframe.height = 0;
    gtagIframe.style.display = 'none';
    gtagIframe.style.visibility = 'hidden';

    noscript.appendChild( gtagIframe );
    /* Google Tag Manager */

    /* Google Analytics */
    function gtag(){
        const dataLayer = window.dataLayer = window.dataLayer || [];
        dataLayer.push(arguments);
    }
    gtag('js', new Date());
    gtag('config', 'G-6PC5NDV3F8');
    /* Google Analytics */

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

            // A missing theme file is survivable -- the player falls back to
            // the default logo and colours -- so this warns rather than
            // stopping, but it no longer disappears entirely.
            if ( results == undefined ) {
                console.warn( 'GVP: program themes could not be downloaded from ' + manifest.gvp_program_themes + '; falling back to the default theme.' );
            }
            
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
            
        } ).catch( e => {
            reportError( 'GVP-105', { stage: 'program theme', source: manifest.gvp_program_themes, native: e && e.message } );
        } );

    // Without a theme source nothing downstream ever runs: setGvpTemplate() is
    // only reached from inside the branch above, so the player would hang on
    // its cover with no explanation at all.
    } else {

        reportError( 'GVP-103' );

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
        
        // Nothing used to happen here on failure -- no markup, no player, no
        // message. reportError() builds its own panel for exactly this case,
        // since the panel it normally uses lives in the template that just
        // failed to arrive.
        if ( !result ) {
            reportError( 'GVP-104', { source: gvp.template } );
            return;
        }

        {
            
            // get the DOM element to hold the HTML template
            let gvpWrapper = document.getElementById( 'gvp-wrapper' );
            
            // set the HTML template to the DOM
            gvpWrapper.innerHTML = result;

            // The cover is opaque from this moment, so seal off what it hides.
            coverUp();

            // The cover itself is opaque immediately; only the placeholder logo
            // eases in, so the player behind can never show through early.
            let coverLogo = gvpWrapper.querySelector( '.gvp-cover .gvp-program-logo' );

            if ( coverLogo ) {
                requestAnimationFrame( function() {
                    coverLogo.classList.add( 'is-visible' );
                } );
            }
            
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
                    	titleBar.classList.add( 'gvp-visually-hidden' );
                    	
                    	flags.sbplusEmbed = true;
                    	
                	}
                    
                } catch( e ) {
                    
                    flags.sbplusEmbed = false;
                    
                }
                
            }

            // call to setup the player UI
            setGvpUi();
            
        }
        
    } ).catch( e => {
        reportError( 'GVP-105', { stage: 'template', source: gvp.template, native: e && e.message } );
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

            // DOMParser reports a malformed document by handing back a
            // <parsererror> tree rather than throwing. Left unchecked, every
            // tag lookup below quietly misses and the player falls through to
            // playing video.mp4 -- so a broken description file used to surface
            // as a playback error about a file nobody meant to play.
            let parseError = xml.doc.querySelector( 'parsererror' );

            if ( parseError ) {

                reportError( 'GVP-201', {
                    source: xml.file,
                    native: parseError.textContent.trim().split( '\n' )[0]
                } );

                return;

            }

            // check for caption language setting
            xml.captionLanguageTag = xml.doc.getElementsByTagName( 'captionLanguage' )[0];

            if ( xml.captionLanguageTag ) {
                
                const childNode = xml.captionLanguageTag.childNodes[0];
                const childNodeAttribute = xml.captionLanguageTag.getAttribute( 'code' );

                if ( childNodeAttribute !== undefined && childNodeAttribute.trim() != '' ) {
                    gvp.captionLanguage.code = childNodeAttribute;
                }

                if ( childNode !== undefined
                    && childNode.nodeValue.trim() != '') {
                        gvp.captionLanguage.label = childNode.nodeValue.trim();
                }

            }
            
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
                                text: markerTag[i].childNodes[0] ? markerTag[i].childNodes[0].nodeValue : '',
                                color: markerColor
                            };
                            
                            xml.markersCollection.push( marker );
        
                        }
                        
                    }
                    
                }
                
            }

            // see if author tag is specified
            // and get author name if it is
            if ( xml.doc.getElementsByTagName( 'author' )[0] !== undefined ) {

                xml.authorTag = xml.doc.getElementsByTagName( 'author' )[0];

                let authorName = '';

                if ( xml.authorTag.childNodes[0] !== undefined && xml.authorTag.childNodes[0].nodeValue !== undefined ) {
                    authorName = xml.authorTag.childNodes[0].nodeValue.trim();
                }

                setAuthor(authorName);

            } else {
                document.querySelector( '.gvp-author-wrapper' ).style.display = 'none';
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
                        loadYouTubeTech();
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

    } ).catch( e => {
        reportError( 'GVP-105', { stage: 'video source', source: xml.file, native: e && e.message } );
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
 * Fetches the video.js YouTube tech, then starts the player.
 *
 * The tech used to be concatenated into the main video.js bundle, which meant
 * every page -- including the Kaltura ones, which are the overwhelming majority
 * -- shipped it and had it request youtube.com/iframe_api on load. It is only
 * needed when the XML actually names a youtubeId.
 *
 * @function loadYouTubeTech
 */
function loadYouTubeTech() {

    if ( typeof videojs !== 'undefined' && videojs.getTech && videojs.getTech( 'Youtube' ) ) {
        setVideoJs();
        return;
    }

    getScript( gvp.youtubeTech, false, setVideoJs, function( file ) {
        reportError( 'GVP-401', { source: file } );
    } );

}

/**
 * Loads the Kaltura libraries.
 * 
 * @function getKalturaLibrary
 */
function getKalturaLibrary() {

    let onLibraryError = function( file ) {
        reportError( 'GVP-301', { source: file } );
    };

    getScript( kaltura.lib, false, false, onLibraryError );
    getScript( kaltura.widget, false, loadKalturaSource, onLibraryError );

}

/**
 * Get video source and information from Kaltura.
 * 
 * @function loadKalturaSource
 */
function loadKalturaSource() {

    // kWidget and kWidget.getSources are published by kwidget.getsources.js --
    // the very script whose onload calls this function -- so testing for them
    // alone could never fail. The dependency that actually goes missing is
    // kWidget.api, which comes from mwembedloader.js and is called on the first
    // line of getSources(); without it that call throws synchronously inside a
    // script onload where nothing catches it, and the viewer waits out the full
    // 20s timeout for a misleading "Kaltura did not respond" instead.
    if ( typeof kWidget === 'undefined'
         || typeof kWidget.api !== 'function'
         || typeof kWidget.getSources !== 'function' ) {
        reportError( 'GVP-302' );
        return;
    }

    // kWidget.getSources() simply never calls back if the Kaltura API cannot be
    // reached, which used to leave the player sitting on its cover forever with
    // no message. Fail loudly instead.
    // Validated before the timer is armed: this used to throw on the way into
    // getSources(), leaving the already-running timer to report "Kaltura did not
    // respond within 20 seconds" for what is really a configuration error.
    if ( !manifest.gvp_kaltura || !manifest.gvp_kaltura.id ) {
        reportError( 'GVP-106', { entry: gvp.source } );
        return;
    }

    let settled = false;
    let apiTimeout = kaltura.apiTimeout;

    let apiTimer = setTimeout( function() {

        if ( settled ) {
            return;
        }

        settled = true;
        reportError( 'GVP-303', { seconds: apiTimeout / 1000, entry: gvp.source } );

    }, apiTimeout );

    {

        // get the video source base on the provided
        // configrations
        kWidget.getSources( {

            'partnerId': manifest.gvp_kaltura.id,
            'entryId': gvp.source,
            'callback': function( data ) {

                if ( settled ) {
                    return;
                }

                settled = true;
                clearTimeout( apiTimer );

                kaltura = data;

                // An API exception is not the same thing as an entry with no
                // media: the entry may exist and simply be restricted, or the
                // ID may be wrong. Telling a viewer a restricted video "could
                // not be found" sends whoever fields the report the wrong way.
                if ( kaltura.apiError ) {

                    reportError( 'GVP-304', {
                        entry: gvp.source,
                        apiCode: kaltura.apiError.code,
                        native: kaltura.apiError.message
                    } );

                    return;

                }

                if ( !kaltura.sources || kaltura.sources.length === 0 ) {
                    reportError( 'GVP-305', { entry: gvp.source } );
                    return;
                }

                // build the quality levels from the flavors Kaltura actually
                // returned; configured flavors that do not exist for this
                // entry (e.g. no 1080p for a 720p upload) are skipped
                kaltura.flavors = selectKalturaFlavors( kaltura.sources, manifest.gvp_kaltura );

                if ( kaltura.flavors.length === 0 ) {
                    reportError( 'GVP-306', { entry: gvp.source } );
                    return;
                }

                // the quality to start playback (and the video download) with
                kaltura.defaultFlavor = pickDefaultFlavor( kaltura.flavors, manifest.gvp_kaltura.default_quality );

                // call to setup the videoJS player
                setVideoJs(); 
            }
        } );

    }
    
}

/**
 * Returns the Kaltura flavor params IDs the player may offer, in order of
 * preference, from the manifest's gvp_kaltura settings.
 *
 * Preferred form:   "flavors": [ 487091, 487081, 487061, 487041 ]
 * Legacy form:      "normal": 487091, "medium": 487081, "low": 487041
 *
 * @function getKalturaFlavorWhitelist
 * @param {Object} config - manifest.gvp_kaltura
 * @return {Array} flavor params IDs as numbers
 */
function getKalturaFlavorWhitelist( config ) {

    let ids = Array.isArray( config.flavors ) ? config.flavors : [ config.normal, config.medium, config.low ];

    return ids.map( Number ).filter( id => Number.isFinite( id ) );

}

/**
 * Builds the list of playable quality levels from the sources Kaltura
 * returned for the entry. Only flavors listed in the manifest are offered,
 * and only the ones that actually exist (ready) for this entry; a
 * configured flavor that Kaltura did not return is simply left out, so a
 * 720p upload with no 1080p flavor still plays. Resolution and label come
 * from the real asset height rather than from a fixed slot.
 *
 * If none of the configured flavors exist, any MP4 flavor Kaltura returned
 * is used instead so the viewer still gets a playable video.
 *
 * @function selectKalturaFlavors
 * @param {Array} sources - sources from kWidget.getSources
 * @param {Object} config - manifest.gvp_kaltura
 * @return {Array} video.js sources [{ src, type, res, label }], highest resolution first
 */
function selectKalturaFlavors( sources, config ) {

    let whitelist = getKalturaFlavorWhitelist( config );

    let isPlayableMp4 = source => source.src && source.type === 'video/mp4';

    let flavors = sources.filter( source => {
        return isPlayableMp4( source ) && whitelist.indexOf( Number( source.flavorParamsId ) ) !== -1;
    } );

    if ( flavors.length === 0 ) {
        console.warn( 'GVP: none of the configured Kaltura flavors (' + whitelist.join( ', ' ) + ') exist for entry ' + gvp.source + '; falling back to any available MP4 flavor.' );
        flavors = sources.filter( isPlayableMp4 );
    }

    return flavors.map( source => {

        let height = parseInt( source['data-height'], 10 ) || 0;

        return {
            type: 'video/mp4',
            src: source.src,
            res: height,
            label: height ? height + 'p' : 'default',
            flavorParamsId: source.flavorParamsId
        };

    } )
    // highest quality first (the order the quality menu shows them in)
    .sort( ( a, b ) => b.res - a.res )
    // one entry per resolution
    .filter( ( flavor, index, list ) => index === 0 || flavor.res !== list[index - 1].res );

}

/**
 * Picks the quality level to start playback with: the highest available
 * resolution that does not exceed the preferred one. If every available
 * flavor is above the preferred resolution, the lowest available is used.
 *
 * @function pickDefaultFlavor
 * @param {Array} flavors - from selectKalturaFlavors (highest resolution first)
 * @param {Number} preferredRes - manifest gvp_kaltura.default_quality (defaults to 1080)
 * @return {Object} the chosen flavor
 */
function pickDefaultFlavor( flavors, preferredRes ) {

    let preferred = parseInt( preferredRes, 10 ) || 1080;

    let match = flavors.find( flavor => flavor.res <= preferred );

    return match || flavors[flavors.length - 1];

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
        controlBar: {
            pictureInPictureToggle: false
        }
    };
    
    // additional options if the video is from YouTube
    if ( flags.isYouTube && flags.isLocal === false ) {
        playerOptions.techOrder = ['youtube'];
        playerOptions.sources = [{ type: "video/youtube", src: "https://www.youtube.com/watch?v=" + gvp.source }];
    }
    
    
    // initialize the video player bases options/configurations
    gvp.player = videojs( 'gvp-video', playerOptions, function() {
        
        let self = this;

        // Layer the video fades to when it ends. Inserted directly after
        // .vjs-poster so it paints over the video and the poster but stays
        // under the replay button and control bar (DOM order is the stacking
        // order inside the player).
        let endFade = document.createElement( 'div' );
        endFade.className = 'gvp-end-fade';
        let posterEl = self.el().querySelector( '.vjs-poster' );

        if ( posterEl ) {
            posterEl.insertAdjacentElement( 'afterend', endFade );
        } else {
            self.el().appendChild( endFade );
        }
        
        // The player is only worth sealing once video.js has built it -- before
        // that there is nothing focusable to seal. If the cover has already
        // cleared by now, leave it alone.
        if ( coverSealed ) {
            sealRegion( self.el() );
        }

        // if video is from Kaltura, set the video sources
        // mulitple Kaltura flavors
        if ( flags.isKaltura && flags.isLocal === false ) {
            
            let posterUrl = kaltura.poster + '/width/900/quality/100';

            self.poster( posterUrl );

            // video.js only sets the poster as a background image; nothing waits
            // for it to arrive. Without this the cover would clear over an empty
            // frame and the thumbnail would fade in afterwards, out of step with
            // the download buttons.
            splashWaitFor( new Promise( function( resolve ) {

                let probe = new Image();

                probe.onload = resolve;
                probe.onerror = resolve;
                probe.src = posterUrl;

            } ) );
            // Kaltura only, deliberately. YouTube serves its own adaptive
            // stream and treats quality requests from the embed API as advisory,
            // so a menu there would promise control the player does not have.
            // Local files have a single source and nothing to choose between.
            setupQualityMenu( self, kaltura.flavors, kaltura.defaultFlavor );
            
            // setup the caption if applicable
            if ( kaltura.caption ) {
                
                kaltura.caption.forEach( caption => {
                    
                    if ( caption.label.toLowerCase() !== "english (autocaption)" ) {

                        self.addRemoteTextTrack( {
                            kind: 'captions',
                            language: caption.languageCode,
                            label: caption.language,
                            src: 'https://www.kaltura.com/api_v3/?service=caption_captionasset&action=servewebvtt&captionAssetId=' + caption.id + '&segmentDuration=' + kaltura.duration + '&segmentIndex=1'
                        }, true );

                    }

                } );
                
            }
            
        } else {

            if ( flags.isLocal ) {
                self.src (gvp.source + '.mp4' );
            }

            fileExist( gvp.source + '.vtt' ).then( result => {
                
                if ( result ) {

                    let code = 'en';
                    let label = 'English';

                    if ( gvp.captionLanguage ) {
                        code = gvp.captionLanguage.code.length ? gvp.captionLanguage.code : code;
                        label = gvp.captionLanguage.label.length ? gvp.captionLanguage.label : label;
                    }
                    
                    self.addRemoteTextTrack( {
                        kind: 'captions',
                        language: code,
                        label: label,
                        src: gvp.source + '.vtt'
                    }, true );

                }

            } );

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

            // Named so it can unbind ITSELF. The bare self.off('timeupdate')
            // this replaces tore off every timeupdate listener on the player,
            // including the quartile progress tracking registered further down,
            // so any ?end= session stopped reporting 25/50/75% the moment it
            // reached the end point.
            let stopAtEnd = function() {

                if ( self.currentTime() >= queryToSeconds( reference.params.get( 'end' ) ) ) {

                    self.pause();
                    self.off( 'timeupdate', stopAtEnd );

                }

            };

            self.on( 'timeupdate', stopAtEnd );
            
        }
        
        // media event listeners        

        // on load
        self.on( 'loadedmetadata', function() {

            sendToGoogleAnalytics( 'loadedmetadata' );

            if ( flags.isKaltura ) {
                sendToKalturaAnalytics( '2' );
            }

            if ( !flags.isYouTube ) {
                const badge = document.querySelector( '.gvp-duration-badge' );
                if ( badge && !isNaN( self.duration() ) ) {
                    badge.innerHTML = '<strong>Duration:</strong> ' + formatDuration( self.duration() );
                    badge.hidden = false;
                    // Unhide first, then flip the class on the next frame so the
                    // opacity transition actually has two states to animate
                    // between (you cannot transition out of display:none).
                    requestAnimationFrame( function() {
                        badge.classList.add( 'is-visible' );
                    } );
                }
            }

            if ( playerOptions.autoplay ) {
                    
                if ( flags.firstPlayed === false ) {
                    
                    if ( flags.isKaltura ) {
                        sendToKalturaAnalytics( '3' );
                    }
                    
                    sendToGoogleAnalytics( 'play' );
                    flags.firstPlayed = true;
                }

            } else {
                
                let bigPlayBtn = document.getElementsByClassName( 'vjs-big-play-button' )[0];

                // loadedmetadata fires again on every quality switch, and this
                // used to register another one-shot listener each time -- so a
                // viewer who changed quality twice sent three play/replay events
                // from a single press. The button is the same element across
                // switches, so binding it once is enough.
                if ( bigPlayBtn && !bigPlayBtn.dataset.gvpAnalyticsBound ) {

                    bigPlayBtn.dataset.gvpAnalyticsBound = 'true';

                    bigPlayBtn.addEventListener( 'click', function() {

                        if ( flags.firstPlayed === false ) {

                            if ( flags.isKaltura ) {
                                sendToKalturaAnalytics( '3' );
                            }

                            sendToGoogleAnalytics( 'play' );
                            flags.firstPlayed = true;

                        } else {

                            sendToGoogleAnalytics( 'replay' );

                        }

                    }, { once: true } );

                }
                
            }
            
        } );
        
        // leaving the end card: fade the black back out
        self.on( 'play', function() {

            const videoWrapper = document.getElementsByClassName( 'gvp-video-wrapper' )[0];

            if ( videoWrapper ) {
                videoWrapper.classList.remove( 'is-ended' );
            }

        } );

        // on playing
        self.on( 'playing', function() {
            
            const logo = document.getElementsByClassName( 'gvp-program-logo' )[1];
            const splashDownloads = document.getElementsByClassName( 'gvp-splash-downloads' )[0];
            const authorName = document.getElementsByClassName( 'gvp-author-wrapper' )[0];
            const durationBadge = document.getElementsByClassName( 'gvp-duration-badge' )[0];

            logo.style.display = 'none';
            splashDownloads.style.display = 'none';
            authorName.style.display = 'none';

            if ( durationBadge ) {
                durationBadge.style.display = 'none';
            }
            
            if ( flags.isIframe ) {
                
                // Visually hidden, not display:none: embedded, this <h1> is the
                // only text that names the video, and the host iframe usually
                // has no title either -- so removing it from the accessibility
                // tree leaves a screen reader user inside an unnamed frame with
                // nothing at all identifying what they are on.
                let titleBar = document.getElementsByClassName( 'gvp-title-bar' )[0];
                titleBar.classList.add( 'gvp-visually-hidden' );
                
            }
            
        } );

        // as video playback progresses
        self.on( 'timeupdate', function() {

            let progressPercentage = ( self.currentTime() / self.duration() ) * 100;

            if ( self.duration() ) {

                if ( progressPercentage >= 25 && flags.playReached25 == false ) {
                    flags.playReached25 = true;

                    if ( flags.isKaltura ) {
                        sendToKalturaAnalytics( '4' );
                    }
                    
                    sendToGoogleAnalytics( 'timereached', 25 );
                    
                }

                if ( progressPercentage >= 50 && flags.playReached50 == false ) {
                    flags.playReached50 = true;
                    
                    if ( flags.isKaltura ) {
                        sendToKalturaAnalytics( '5' );
                    }

                    sendToGoogleAnalytics( 'timereached', 50 );

                }

                if ( progressPercentage >= 75 && flags.playReached75 == false ) {
                    flags.playReached75 = true;
                    
                    if ( flags.isKaltura ) {
                        sendToKalturaAnalytics( '6' );
                    }

                    sendToGoogleAnalytics( 'timereached', 75 );

                }

            }

        } );
        
        // as video completely ended
        self.on( 'ended', function() {
            
            document.getElementsByClassName( 'gvp-splash-downloads' )[0].style.display = 'flex';

            // Only restore the author chip if there actually is an author. When
            // the XML has no <author>, setAuthor() hides this wrapper; showing it
            // again here painted an empty padded box with a dark background --
            // the little black square in the top-left of the replay screen.
            const authorWrapper = document.getElementsByClassName( 'gvp-author-wrapper' )[0];
            const authorHeading = authorWrapper ? authorWrapper.querySelector( '.gvp-author-name' ) : null;

            if ( authorHeading && authorHeading.textContent.trim().length ) {
                authorWrapper.style.display = 'initial';
            }
            
            if ( flags.sbplusEmbed === undefined || flags.sbplusEmbed === false) {
                
                self.bigPlayButton.el_.classList.add( 'replay' );
                self.hasStarted( false );
                
            }

            if ( flags.sbplusEmbed === undefined || flags.sbplusEmbed === false ) {

                // Bring the corner logo back over the end card. The embedded
                // title bar deliberately stays hidden here -- it overlays the
                // video, and the end card reads cleaner without it.
                let logo = document.getElementsByClassName( 'gvp-program-logo' )[1];

                if ( logo ) {
                    logo.style.display = 'initial';
                }

            }

            // Fade the picture down to black rather than snapping back to the
            // poster. The class also suppresses .vjs-poster, so the first frame
            // never reappears behind the end card.
            let videoWrapper = document.getElementsByClassName( 'gvp-video-wrapper' )[0];

            if ( videoWrapper ) {
                videoWrapper.classList.add( 'is-ended' );
            }

            if ( flags.playReached100 === false ) {

                if ( flags.isKaltura ) {
                    sendToKalturaAnalytics( '7' );
                }

                sendToGoogleAnalytics( 'timereached', 100 );
                
                flags.playReached100 = true;

            }
            
            let bigReplayBtn = document.querySelector( '.vjs-big-play-button.replay' );

            if ( bigReplayBtn ) {

                bigReplayBtn.addEventListener( 'click', function() {
                
                    sendToGoogleAnalytics( 'replay' );

                    if ( flags.isKaltura ) {
                        sendToKalturaAnalytics( '16' );
                    }
                    
                }, { once: true } );

            }

            sendToGoogleAnalytics( 'ended' );

        } );

        // on entering or exiting full screen
        self.on( 'fullscreenchange', function() {
            
            let isFullScreen = document.fullScreen || document.mozFullScreen || document.webkitIsFullScreen;
        
            if ( isFullScreen ) {

                if ( flags.isKaltura ) {
                    sendToKalturaAnalytics( '14' );
                }

                sendToGoogleAnalytics( 'fullscreenchange', 1 );
                
            } else {

                if ( flags.isKaltura ) {
                    sendToKalturaAnalytics( '15' );
                }

                sendToGoogleAnalytics( 'fullscreenchange', 0 );
                
            }

        } );

        // on playback seeked
        self.on( 'seeked', function() {

            if ( self.currentTime() > 0 ) {

                if ( flags.isKaltura ) {
                    sendToKalturaAnalytics( '17', true );
                }

                sendToGoogleAnalytics( 'seeked', self.currentTime() );
                
            }

        } );

        // on ratechange
        self.on( 'ratechange', function() {
            
            sendToGoogleAnalytics( 'ratechange', self.playbackRate() );

        } );
        
        // on encountering error
        self.on( 'error', function() {
            
            let err = self.error();

            // The four MEDIA_ERR_* codes the browser raises mean genuinely
            // different things -- cancelled, connection lost, undecodable,
            // refused outright -- and collapsing them into one sentence threw
            // away the only signal that says whether to retry, to reload, or to
            // report the video as broken.
            let byMediaError = {
                1: 'GVP-601',
                2: 'GVP-602',
                3: 'GVP-603',
                4: 'GVP-604'
            };

            let code = byMediaError[ err && err.code ] || 'GVP-605';

            let context = {
                source: self.currentSrc() || gvp.source || 'unknown',
                native: ( err && err.message ) ? err.message : ''
            };

            // A browser refuses a 404 and an unplayable codec in exactly the
            // same way, so for a local file the far more likely cause -- the
            // file simply is not there -- is worth one HEAD request to confirm
            // before blaming the format.
            if ( code === 'GVP-604' && flags.isLocal ) {

                let file = gvp.source + '.mp4';

                // Only a definite 404 earns the "not on the server" claim; a
                // host that refuses HEAD would otherwise send triage looking for
                // a missing file that is sitting right there.
                fileStatus( file ).then( function( status ) {

                    if ( status === 'missing' ) {
                        reportError( 'GVP-501', { file: file, source: context.source } );
                    } else {
                        context.file = file;
                        reportError( 'GVP-604', context );
                    }

                } );

                return;

            }

            reportError( code, context );
            
        } );
        
        // Everything from here to hideCover() is decoration -- extra buttons
        // and chapter markers -- but the cover is opaque, so a throw in any of
        // it used to leave the viewer staring at a blank cover forever. The
        // markers plugin in particular is only present once webpack has
        // concatenated it, so serving straight from sources/ threw here. None
        // of it is worth the whole player.
        try {

            // add forward and backward seconds button if video is longer than 1 minutes
            addForwardButton( self );
            addBackwardButton( self );

            // add download button if it is not indside
            addDownloadFilesButton( self );

            // add markers if any -- the dots on the progress bar, plus the
            // chapters menu that makes them reachable without a mouse
            setupMarkers( gvp.player );
            setupChapters( gvp.player );
            clampMenus( gvp.player );
            enableButtonTabbing( gvp.player );

            // if youtube, hide cover on ready and reset markers
            if ( flags.isYouTube ) {

                self.on( 'play', function() {

                    if ( gvp.player.markers ) {
                        gvp.player.markers.reset( xml.markersCollection );
                    }

                } );

            }

        } catch ( e ) {

            console.error( 'GVP: player decoration failed, continuing without it: ' + ( e && e.message ) );

        }
        
        // hide the program theme cover
        hideCover();
        
    } );

}

/**
 * Send stats to Kaltura Analytics.
 * 
 * @function sendToKalturaAnalytics
 */
function sendToKalturaAnalytics( eventType, seeked = false ) {

    if ( gvp.player ) {

        let isSeeked = seeked ? 'true' : 'false';
        let timestamp = + new Date();
        let data = "event%5BentryId%5D=" + gvp.source + "&event%5BpartnerId%5D=" + manifest.gvp_kaltura.id +"&event%5Bduration%5D=" + gvp.player.duration() + "&event%5BeventType%5D=" + eventType + "&event%5Breferrer%5D=https%3A%2F%2Fmedia.uwex.edu&event%5Bseek%5D=" + isSeeked + "&event%5BsessionId%5D=" + sessionId + "&event%5BeventTimestamp%5D=" + timestamp + "&event%5BobjectType%5D=KalturaStatsEvent";

        let xhr = new XMLHttpRequest();
        
        xhr.open("POST", "https://www.kaltura.com/api_v3/service/stats/action/collect");
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        
        xhr.send(data);

        // new kWidget.api({ 'wid' : '_' + manifest.gvp_kaltura.id }).doRequest({
        //     'service': 'analytics',
        //     'action': 'trackEvent',
        //     'entryId': gvp.source,
        //     'eventType': eventType,
        //     'sessionId': sessionId,
        //     'partnerId': manifest.gvp_kaltura.id,
        //     'playbackType': 'vod',
        //     'referer': encodeURI(window.location)
        // }, function (data) {
        //     console.log(data);
        // });

    }

}

function sendToGoogleAnalytics( event, value = 0 ) {

    window.dataLayer = window.dataLayer || [];

    if ( event == 'play' ) {

        window.dataLayer.push({
            'event': 'play',
            'pagePath': window.location.pathname
        });

    } else if ( event == 'replay' ) {

        window.dataLayer.push({
            'event': 'replay',
            'pagePath': window.location.pathname
        });

    } else if ( event == 'loadedmetadata') {
        
        window.dataLayer.push({
            'event': 'loadedmetadata',
            'pagePath': window.location.pathname
        });

    } else if ( event == 'timereached' ) {

        window.dataLayer.push({
            'event': 'timereached',
            'pagePath': window.location.pathname,
            'timeReachedValue': value
        });

    } else if ( event == 'ended' ) {

        window.dataLayer.push({
            'event': 'ended',
            'pagePath': window.location.pathname
        });

    } else if ( event == 'fullscreenchange' ) {

        window.dataLayer.push({
            'event': 'fullscreenchange',
            'pagePath': window.location.pathname,
            'fullScreenChangeValue': value
        });

    } else if ( event == 'seeked' ) {

        window.dataLayer.push({
            'event': 'seeked',
            'pagePath': window.location.pathname,
            'seeked': value
        });

    } else if ( event == 'ratechange' ) {

        window.dataLayer.push({
            'event': 'ratechange',
            'pagePath': window.location.pathname,
            'playbackrate': value
        });

    } else if ( event == 'pageview' ) {

        window.dataLayer.push({
            'event': 'Pageview',
            'pagePath': window.location.pathname,
            'pageTitle': value.length ? value : window.location.hostname
        });

    }

}

/**
 * Add markers specified in the XML to the video
 * progress bar.
 * 
 * @function setupMarkers
 */
/**
 * Gives every marker the label the player should display for it.
 *
 * Numbered by time order, not document order, so the generated names line up
 * with the sequence a viewer actually sees on the progress bar. Written onto the
 * marker objects themselves so the timeline tooltip and the chapters menu are
 * reading the same string rather than each deriving its own.
 *
 * @function labelMarkers
 */
function labelMarkers() {

    xml.markersCollection
        .slice()
        .sort( function( a, b ) { return a.time - b.time; } )
        .forEach( function( marker, i ) {

            marker.label = ( marker.text || '' ).trim() || ( 'Chapter ' + ( i + 1 ) );

        } );

}

function setupMarkers( player ) {

    labelMarkers();
    
    // add markers
    player.markers( {

        markers: xml.markersCollection,

        // A marker with no text between its tags used to get no tooltip at all
        // -- the plugin suppresses the tip when the text is empty -- while the
        // chapters menu showed a generated "Chapter N" for the same marker. Two
        // surfaces, two different answers for one dot. Both read the label
        // computed by labelMarkers() now, so they cannot disagree.
        markerTip: {
            text: function( marker ) {
                return marker.label || marker.text || '';
            }
        }

    } );

    // A hovered chapter dot puts the marker's title above the progress bar, and
    // video.js independently puts the hovered timecode there too -- so the two
    // stack. The title is the more useful of the pair while it is up, so the
    // timecode steps aside for it.
    //
    // This keys off whether the plugin actually SHOWED its tip rather than
    // merely whether a dot is hovered: it hides the tip for a marker with no
    // text (see markerTip visibility in videojs-markers.js), and blanking the
    // timecode for those would leave the viewer with nothing at all.
    let holder = player.el().querySelector( '.vjs-progress-holder' );

    if ( holder ) {

        let syncTipState = function() {

            let tip = holder.querySelector( '.vjs-tip' );
            let shown = !!( tip && tip.style.visibility === 'visible' );

            player.el().classList.toggle( 'gvp-marker-tip-shown', shown );

        };

        holder.addEventListener( 'mouseover', function( e ) {

            if ( e.target && e.target.classList.contains( 'vjs-marker' ) ) {
                // after the plugin's own mouseover handler has set the tip
                requestAnimationFrame( syncTipState );
            }

        } );

        holder.addEventListener( 'mouseout', function( e ) {

            if ( e.target && e.target.classList.contains( 'vjs-marker' ) ) {
                player.el().classList.remove( 'gvp-marker-tip-shown' );
            }

        } );

    }

    // The plugin renders each chapter as a bare, unlabelled <div> on the progress
    // bar with click handlers but no role, no text and no keyboard path. To a
    // screen reader that is meaningless clutter sitting inside the seek control,
    // so it is hidden from the accessibility tree rather than left as noise a
    // user cannot act on. Chapters remain a sighted-mouse affordance; exposing
    // them properly would mean a WebVTT chapters track, which video.js already
    // has a keyboard-navigable menu for.
    player.on( 'loadedmetadata', function() {

        let markers = document.getElementsByClassName( 'vjs-marker' );

        for ( let i = 0; i < markers.length; i++ ) {
            markers[i].setAttribute( 'aria-hidden', 'true' );
        }

    } );
    
}

/**
 * Puts an explicit tabindex on the control-bar buttons.
 *
 * Semantically a no-op -- a <button> is already in the tab order -- but Safari
 * on macOS ships with tabbing restricted to text fields and elements carrying an
 * EXPLICIT tabindex, skipping buttons and links entirely. The seek bar and
 * volume slider are divs that video.js gives `tabindex="0"`, so they take focus
 * while every button beside them is passed over: a keyboard user reaches the
 * scrubber but not Play.
 *
 * Other browsers are unaffected, and this changes nothing for screen readers,
 * which navigate by their own cursor rather than by Tab.
 *
 * Only buttons with no tabindex of their own are touched -- menu items carry
 * `tabindex="-1"` deliberately, because menus move focus themselves.
 *
 * @function enableButtonTabbing
 * @param {Object} player
 */
function enableButtonTabbing( player ) {

    let bar = player.el().querySelector( '.vjs-control-bar' );

    if ( !bar ) {
        return;
    }

    let apply = function() {

        [].forEach.call( bar.querySelectorAll( 'button' ), function( btn ) {

            if ( !btn.hasAttribute( 'tabindex' ) ) {
                btn.setAttribute( 'tabindex', '0' );
            }

        } );

    };

    apply();

    // The quality menu and the downloads button are mounted after ready, so
    // watch for later arrivals rather than guessing at a delay.
    if ( typeof MutationObserver === 'function' ) {

        new MutationObserver( apply ).observe( bar, { childList: true, subtree: true } );

    }

}

/**
 * Keeps popup menus inside the player.
 *
 * The menus are centred on their button, which is fine mid-bar and breaks for
 * the controls nearest the right edge: a chapters menu wide enough to hold a
 * real chapter title hangs off the side of a narrow player. Capping the width
 * does not solve it -- a button close enough to the edge overflows at any width
 * -- so the box is measured after it opens and nudged back inside.
 *
 * @function clampMenus
 * @param {Object} player
 */
function clampMenus( player ) {

    let clamp = function() {

        let playerEl = player.el();

        if ( !playerEl ) {
            return;
        }

        let bounds = playerEl.getBoundingClientRect();
        let menus = playerEl.querySelectorAll( '.vjs-menu-button-popup .vjs-menu .vjs-menu-content' );

        for ( let i = 0; i < menus.length; i++ ) {

            let menu = menus[i];

            // measure unshifted, or the previous nudge skews the reading
            menu.style.setProperty( '--gvp-menu-shift', '0px' );

            let rect = menu.getBoundingClientRect();

            if ( !rect.width ) {
                continue;
            }

            let shift = 0;
            let edge = 8;

            if ( rect.right > bounds.right - edge ) {
                shift = ( bounds.right - edge ) - rect.right;
            }

            if ( rect.left + shift < bounds.left + edge ) {
                shift = ( bounds.left + edge ) - rect.left;
            }

            if ( shift ) {
                menu.style.setProperty( '--gvp-menu-shift', Math.round( shift ) + 'px' );
            }

        }

    };

    let controlBar = player.getChild( 'controlBar' );

    if ( controlBar ) {

        // after the menu has been laid out, not before
        controlBar.el().addEventListener( 'click', function() {
            requestAnimationFrame( clamp );
        }, true );

        controlBar.el().addEventListener( 'mouseover', function() {
            requestAnimationFrame( clamp );
        }, true );

    }

    player.on( 'playerresize', clamp );
    window.addEventListener( 'resize', clamp );

}

/**
 * Publishes the XML chapter markers as a WebVTT chapters track.
 *
 * The markers plugin draws the chapters as dots on the progress bar, which is a
 * pointing affordance: you have to see them and click them. Nothing about it is
 * reachable by keyboard or announced by a screen reader, so chapters simply did
 * not exist for those users.
 *
 * video.js already ships a ChaptersButton in its default control bar -- it just
 * renders nothing until a chapters track exists. Publishing the same marker data
 * as that track gives a proper menu: keyboard operable, chapter names announced,
 * seeks on selection. The dots stay exactly as they were (now aria-hidden), so
 * this adds a second presentation of one data source rather than replacing it.
 *
 * Generated at runtime -- no authored .vtt file, no server involvement.
 *
 * @function setupChapters
 * @param {Object} player
 */
function setupChapters( player ) {

    if ( !xml.markersCollection.length ) {
        return;
    }

    let Cue = window.VTTCue || window.TextTrackCue;

    if ( !Cue ) {
        console.warn( 'GVP: no VTTCue in this browser; the chapters menu is unavailable.' );
        return;
    }

    let build = function() {

        player.off( 'loadedmetadata', build );

        let duration = player.duration();

        if ( !duration || isNaN( duration ) ) {
            return;
        }

        // Markers are points in time; chapters are ranges. Each one therefore
        // runs until the next begins, and the last to the end of the video --
        // which is the reason this cannot be built before the duration is known.
        let points = xml.markersCollection
            .slice()
            .filter( function( m ) { return !isNaN( m.time ) && m.time >= 0 && m.time < duration; } )
            .sort( function( a, b ) { return a.time - b.time; } );

        if ( !points.length ) {
            return;
        }

        let track = player.addTextTrack( 'chapters', 'Chapters', gvp.captionLanguage.code || 'en' );

        points.forEach( function( point, i ) {

            let end = ( i + 1 < points.length ) ? points[ i + 1 ].time : duration;

            if ( end <= point.time ) {
                return;
            }

            // labelMarkers() already worked this out, including the fallback
            // for an untitled marker; deriving it a second time here would
            // renumber whenever a marker is filtered out above.
            let text = point.label || ( point.text || '' ).trim() || ( 'Chapter ' + ( i + 1 ) );

            track.addCue( new Cue( point.time, end, text ) );

        } );

        // hidden: the cues drive the menu, they are not meant to be displayed
        track.mode = 'hidden';

        // The button normally refreshes itself off the track list's addtrack
        // event; nudge it in case that already ran for this load.
        let controlBar = player.getChild( 'controlBar' );
        let chaptersButton = controlBar ? controlBar.getChild( 'ChaptersButton' ) : null;

        if ( chaptersButton && typeof chaptersButton.update === 'function' ) {
            chaptersButton.update();
        }

    };

    if ( player.duration() && !isNaN( player.duration() ) ) {
        build();
    } else {
        player.on( 'loadedmetadata', build );
    }

}

/**
 * Set the title of the video from the XML
 * or from Kaltura if applicable.
 * 
 * @function setTitle
 */
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

    sendToGoogleAnalytics( 'pageview', title );
    
}

/**
 * Get the default video title base on the 
 * specified settings.
 * 
 * @function setDefaultTitle
 */
function setDefaultTitle() {
    
    if ( flags.isKaltura && flags.isLocal === false ) {
        
        return kaltura.name;
        
    } else {
        
        if ( reference.params.has( 'title' ) ) {
            
            return reference.params.get( 'title' );
            
        }
        
    }
    
    // Returning an empty string left both the <h1> and the document title blank
    // for the whole session, so a screen reader landed on a page with no name at
    // all. A generic name is not much, but it is something to announce.
    return 'Untitled video';
        
}

/**
 * Hide the cover or the loading screen with
 * the program logo.
 * 
 * @function hideCover
 */
/**
 * Marks the player as busy and seals off what the cover is hiding.
 *
 * @function coverUp
 */
function coverUp() {

    let wrapper = document.getElementsByClassName( 'gvp-video-wrapper' )[0];

    if ( wrapper ) {
        wrapper.setAttribute( 'aria-busy', 'true' );
    }

    inertedRegions = [];
    coverSealed = true;

    coveredRegions.forEach( function( selector ) {
        sealRegion( document.querySelector( selector ) );
    } );

}

/**
 * Releases exactly what coverUp() sealed.
 *
 * @function releaseCovered
 */
function releaseCovered() {

    let els = inertedRegions.slice();
    let scope = document.getElementsByClassName( 'gvp-video-wrapper' )[0];

    // Belt and braces: if `inert` ever gets copied onto an element we never
    // touched -- which is exactly how video.js propagates attributes -- a
    // stranded one would leave the player permanently unclickable. Sweep for the
    // attribute rather than trusting the list alone.
    if ( scope ) {

        [].forEach.call( scope.querySelectorAll( '[inert]' ), function( el ) {
            if ( els.indexOf( el ) === -1 ) {
                els.push( el );
            }
        } );

    }

    els.forEach( function( el ) {
        el.removeAttribute( 'inert' );
        el.removeAttribute( 'aria-hidden' );
    } );

    inertedRegions = [];
    coverSealed = false;

}

function hideCover() {

    // Hold the cover until the splash behind it is fully composed, so the
    // download buttons, author chip and corner logo all appear together as it
    // fades rather than popping in afterwards. Capped so a slow or failed
    // download check can never strand the viewer on the cover.
    Promise.race( [

        Promise.allSettled( splashParts ),
        new Promise( function( resolve ) { setTimeout( resolve, 4000 ); } )

    ] ).then( startCoverFade );

}

/**
 * Fades the cover out.
 *
 * @function startCoverFade
 */
function startCoverFade() {

    // The splash is composed; hand the player back to the keyboard and to AT.
    let wrapper = document.getElementsByClassName( 'gvp-video-wrapper' )[0];

    if ( wrapper ) {
        wrapper.removeAttribute( 'aria-busy' );
    }

    if ( !flags.hasError ) {
        releaseCovered();
    }

    setTimeout( function() {

        let cover = document.getElementsByClassName( 'gvp-cover' )[0];

        if ( !cover || cover.style.display === 'none' ) {
            return;
        }

        let settled = false;

        let finish = function() {

            if ( settled ) {
                return;
            }

            settled = true;
            cover.removeEventListener( 'transitionend', finish );
            cover.style.display = 'none';

        };

        cover.addEventListener( 'transitionend', finish );
        cover.classList.add( 'is-hidden' );

        // Fallback: if the transition never runs (reduced motion, or the class
        // was never applied) the cover still has to go away.
        setTimeout( finish, 600 );

    }, 250 );
    
}

/**
 * Quality menu.
 *
 * Replaces videojs-resolution-switcher, which was abandoned in 2016, leaned on
 * private video.js internals, and shipped a chooseSrc() that silently fell back
 * to the LOWEST quality whenever the requested one was missing. GVP already
 * works out its own flavor list (selectKalturaFlavors) and starting quality
 * (pickDefaultFlavor), so all this needs to do is present them and switch.
 *
 * Keeps the class and aria-label the stylesheet hooks onto:
 *   .vjs-menu-button-popup[aria-label="Quality"]  -- show/hide by breakpoint
 *   .vjs-resolution-button .vjs-icon-placeholder  -- the cog glyph
 *
 * @function setupQualityMenu
 * @param {Object} player   - the video.js player
 * @param {Array}  flavors  - from selectKalturaFlavors(), highest first
 * @param {Object} startAt  - from pickDefaultFlavor()
 */
function setupQualityMenu( player, flavors, startAt ) {

    if ( !flavors || flavors.length === 0 ) {
        return;
    }

    let current = startAt || flavors[0];

    player.gvpQualityFlavors = flavors;

    player.gvpCurrentQuality = function() {
        return current;
    };

    player.gvpSetQuality = function( label ) {

        let next = flavors.find( function( f ) { return f.label === label; } );

        if ( !next || next.label === current.label ) {
            return;
        }

        // Preserve where the viewer was and whether they were watching.
        let resumeAt = player.currentTime();
        let wasPaused = player.paused();

        // `current` only advances once the new source has actually loaded. It
        // used to be assigned up front, so a flavor that failed to load left the
        // menu showing a quality that was never playing.
        let settleQuality = function() {

            player.off( 'loadedmetadata', onLoaded );
            player.off( 'error', onFailed );

        };

        let onLoaded = function() {

            settleQuality();

            current = next;
            player.currentTime( resumeAt );

            if ( !wasPaused ) {
                player.play();
            }

            player.trigger( 'gvpqualitychange' );
            announce( 'Quality changed to ' + next.label + '.' );

        };

        // Without this the one-shot loadedmetadata handler was never consumed,
        // and the NEXT successful switch fired both it and its own -- seeking to
        // a stale position and resuming playback the viewer had paused.
        let onFailed = function() {

            settleQuality();
            player.trigger( 'gvpqualitychange' );
            announce( 'Could not switch to ' + next.label + '. Staying on ' + current.label + '.' );

        };

        player.one( 'loadedmetadata', onLoaded );
        player.one( 'error', onFailed );

        player.src( { src: next.src, type: next.type } );

    };

    // Register the components once, then mount the button.
    if ( !videojs.getComponent( 'GvpQualityMenuButton' ) ) {

        let MenuItem = videojs.getComponent( 'MenuItem' );
        let MenuButton = videojs.getComponent( 'MenuButton' );

        let GvpQualityMenuItem = class extends MenuItem {

            constructor( p, options ) {
                options.selectable = true;
                options.multiSelectable = false;
                super( p, options );
                p.on( 'gvpqualitychange', this.update.bind( this ) );
            }

            handleClick( event ) {
                super.handleClick( event );
                this.player_.gvpSetQuality( this.options_.label );
            }

            update() {
                this.selected( this.player_.gvpCurrentQuality().label === this.options_.label );
            }

        };

        let GvpQualityMenuButton = class extends MenuButton {

            constructor( p, options ) {
                options = options || {};
                options.label = 'Quality';
                super( p, options );
                this.controlText( 'Quality' );
            }

            createItems() {

                let p = this.player_;

                if ( !p.gvpQualityFlavors ) {
                    return [];
                }

                return p.gvpQualityFlavors.map( function( f ) {
                    return new GvpQualityMenuItem( p, {
                        label: f.label,
                        selected: f.label === p.gvpCurrentQuality().label
                    } );
                } );

            }

            // v8 puts the wrapper class through buildWrapperCSSClass() and the
            // inner <button> through buildCSSClass(); the stylesheet needs the
            // hook on the wrapper, so set it on both.
            buildWrapperCSSClass() {
                // gvp-quality-control is the stylesheet's hook for showing and
                // hiding this control responsively. It goes on the wrapper only,
                // where vjs-resolution-button (kept for the cog glyph styling)
                // cannot discriminate -- video.js puts that class on both the
                // wrapper and the inner button.
                return super.buildWrapperCSSClass() + ' vjs-resolution-button gvp-quality-control';
            }

            buildCSSClass() {
                return super.buildCSSClass() + ' vjs-resolution-button';
            }

        };

        videojs.registerComponent( 'GvpQualityMenuItem', GvpQualityMenuItem );
        videojs.registerComponent( 'GvpQualityMenuButton', GvpQualityMenuButton );

    }

    player.src( { src: current.src, type: current.type } );

    player.ready( function() {

        let controlBar = player.getChild( 'controlBar' );

        if ( !controlBar || controlBar.getChild( 'GvpQualityMenuButton' ) ) {
            return;
        }

        let fullscreen = controlBar.getChild( 'FullscreenToggle' );
        let index = fullscreen ? controlBar.children().indexOf( fullscreen ) : undefined;

        controlBar.addChild( 'GvpQualityMenuButton', {}, index );

    } );

}

/**
 * Add the forward button to the video playback control.
 * 
 * @function addForwardButton
 */
function addForwardButton( vjs ) {
    
    let secToSkip = 5;
    let Button = videojs.getComponent( 'Button' );
    let forwardBtn = class extends Button {
        constructor( player, options ) {
            
            super( player, options );
            this.updateSkipText();

            // The skip amount is derived from the duration, which is not known
            // when this button is constructed -- so the name has to be rebuilt
            // once it is, or it advertises a distance the button never moves.
            player.on( [ 'loadedmetadata', 'durationchange' ], this.updateSkipText.bind( this ) );

        }

        // "Skip Forward" alone left the viewer to find out how far by pressing
        // it and listening for the new position.
        updateSkipText() {

            let duration = vjs.duration();
            let seconds = ( duration && !isNaN( duration ) ) ? getSecToSkip( duration ) : secToSkip;

            this.controlText( 'Skip forward ' + seconds + ' seconds' );

        }
        handleClick() {
            
            if ( vjs.seekable() ) {
                
                secToSkip = getSecToSkip( vjs.duration() );
                
                let seekTime = vjs.currentTime() + secToSkip;
                
                if ( seekTime >= vjs.duration() ) {
                    seekTime = vjs.duration();
                }
                
                vjs.currentTime( seekTime );
                
            }
            
        }
        buildCSSClass() {
            return 'vjs-forward-button vjs-control vjs-button';
        }
    };

    videojs.registerComponent( 'ForwardBtn', forwardBtn );
    vjs.getChild( 'controlBar' ).addChild( 'ForwardBtn', {}, 1 );
    
}

/**
 * Add the backward button to the video playback control.
 * 
 * @function addBackwardButton
 */
function addBackwardButton( vjs ) {
    
    let secToSkip = 5;
    let Button = videojs.getComponent( 'Button' );
    let backwardBtn = class extends Button {
        constructor( player, options ) {
            
            super( player, options );
            this.updateSkipText();

            player.on( [ 'loadedmetadata', 'durationchange' ], this.updateSkipText.bind( this ) );

        }

        updateSkipText() {

            let duration = vjs.duration();
            let seconds = ( duration && !isNaN( duration ) ) ? getSecToSkip( duration ) : secToSkip;

            this.controlText( 'Skip backward ' + seconds + ' seconds' );

        }
        handleClick() {
            
            if ( vjs.seekable() ) {
                
                secToSkip = getSecToSkip( vjs.duration() );
                
                let seekTime = vjs.currentTime() - secToSkip;
                
                if ( seekTime <= 0 ) {
                    seekTime = 0;
                }
                
                vjs.currentTime( seekTime );
                
            }
            
        }
        
        buildCSSClass() {
            return 'vjs-backward-button vjs-control vjs-button';
        }
        
    };

    videojs.registerComponent( 'BackwardBtn', backwardBtn );
    vjs.getChild( 'controlBar' ).addChild( 'BackwardBtn', {}, 1 );
    
}

/**
 * Format a duration in seconds as m:ss or h:mm:ss.
 *
 * @function formatDuration
 */
function formatDuration( seconds ) {

    if ( isNaN( seconds ) || seconds < 0 ) {
        return '';
    }

    const s = Math.floor( seconds % 60 ).toString().padStart( 2, '0' );
    const m = Math.floor( ( seconds / 60 ) % 60 );
    const h = Math.floor( seconds / 3600 );

    if ( h > 0 ) {
        return h + ':' + m.toString().padStart( 2, '0' ) + ':' + s;
    }

    return m + ':' + s;

}

/**
 * Determine the number of seconds to seek forward or backward.
 *
 * @function getSecToSkip
 */
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


/**
 * Add download drop down menu to the playback control.
 * 
 * @function addDownloadFilesButton
 */
function addDownloadFilesButton( vjs ) {
    
    if ( flags. sbplusEmbed === undefined ) {
        
        setTimeout( function() {
            
            let MenuButton = videojs.getComponent( 'MenuButton' );
            let downloadButton = class extends MenuButton {
                constructor( player, options ) {
                    
                    super( player, options );
                    this.controlText( 'Downloads' );
    
                }
                createItems() {
                    
                    return downloadables( vjs );
    
                }
                // No override here. MenuButton wires the inner <button>'s click
                // to handleClick, and a native button fires click on Enter and
                // Space -- so stubbing this out left the menu openable by hover
                // only, and aria-expanded never flipped. The inherited handler
                // is what makes it keyboard-operable.
                buildCSSClass() {
                    return 'vjs-downloads-button';
                }
            };
    
            videojs.registerComponent( 'DownloadButton', downloadButton );

            // Insert immediately before the fullscreen toggle so the order is
            // ... | Settings | Downloads | Fullscreen
            let controlBar = vjs.getChild( 'controlBar' );
            let fullscreenToggle = controlBar.getChild( 'FullscreenToggle' );
            let fullscreenIndex = controlBar.children().indexOf( fullscreenToggle );
            controlBar.addChild( 'DownloadButton', {}, fullscreenIndex );
            
        }, 1000 );
        
    }
    
}

/**
 * Get downloadable file types.
 * 
 * @function downloadables
 */
function downloadables( vjs ) {
    
    let files = document.getElementsByClassName( 'gvp-download-list' )[0].childNodes;
    let items = [];
    
    let MenuItem = videojs.getComponent( 'MenuItem' );
    
    let DownloadMenuItem = class extends MenuItem {
        
      constructor( player, options ) {
          
        options.selectable = true;
        super( player, options );
        this.src = options.src;
        
      }
      
    };
    
    DownloadMenuItem.prototype.handleClick = function() {

      if ( this.options_.kaltura === true ) {
    
          if ( this.options_.id === 'videoDl' ) {

                downloadKalVid( this.options_.id );
              
          } else {

              document.getElementById( this.options_.id ).click();

              if ( this.options_.id === 'transcriptDl' ) {
                  sendToKalturaAnalytics( '10' );
              }              

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

/**
 * Set the downloadable file type with proper name.
 * 
 * @function setDownloadables
 */
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
    
    // Wire the Kaltura transcript-download analytics event onto whichever
    // transcript link ends up in the DOM (HTML or PDF — same element id).
    let attachTranscriptAnalytics = function() {
        if ( flags.isKaltura ) {
            document.getElementById( 'transcriptDl' ).addEventListener( 'click', function() {
                sendToKalturaAnalytics( '10' );
            } );
        }
    };

    // Each non-video entry needs an async fileExist() check, so the pills used
    // to appear one at a time as the checks resolved. Collect the promises and
    // reveal the whole row once, so it never renders half-built.
    let pendingChecks = [];

    supportedFiles.forEach( function( file ) {

        let fileLabel = file.label;
        let ext = file.format;
        let filePath = cleanString( fileName ) + '.' + ext;

        // video
        if ( ext === "mp4" ) {

            let dwnldPath = filePath;

            if ( flags.isKaltura && flags.isLocal === false ) {

                dwnldPath = kaltura.defaultFlavor.src;

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

        // Transcript: prefer a sibling .html file (opens inline in a new tab).
        // Fall back to the manifest-configured format (.pdf) if HTML is absent.
        // Only one format is ever wired up per video.
        if ( fileLabel === 'Transcript' ) {

            let htmlPath = cleanString( fileName ) + '.html';

            pendingChecks.push( fileExist( htmlPath ).then( htmlFound => {

                if ( htmlFound ) {
                    createDownloadLink( htmlPath, fileLabel, true );
                    attachTranscriptAnalytics();
                    return;
                }

                return fileExist( filePath ).then( pdfFound => {
                    if ( pdfFound ) {
                        createDownloadLink( filePath, fileLabel );
                        attachTranscriptAnalytics();
                    }
                } );

            } ) );

            return;

        }

        pendingChecks.push( fileExist( filePath ).then( result => {
            if ( result ) {
                createDownloadLink( filePath, fileLabel );
            }
        } ) );

    } );

    // The pill icons are VideoJS-font glyphs. The face still loads async, so
    // wait for it before revealing or the glyphs pop in; the reserved 1em box
    // below means nothing moves either way. Capped so a slow load never holds
    // the downloads hostage.
    let fontReady = Promise.race( [

        ( document.fonts && document.fonts.load )
            ? document.fonts.load( '1em VideoJS' )
            : Promise.resolve(),

        new Promise( function( resolve ) { setTimeout( resolve, 1500 ); } )

    ] ).catch( function() {} );

    // Reveal the finished row in one go. This also becomes the gate the cover
    // waits on, so the buttons are already in place when it clears.
    splashWaitFor( Promise.allSettled( pendingChecks.concat( [ fontReady ] ) ).then( function() {

        let splash = document.getElementsByClassName( 'gvp-splash-download-wrapper' )[0];

        if ( splash ) {
            splash.classList.add( 'is-visible' );
        }

    } ) );
    
    // Splash pill buttons render via CSS display:flex on .gvp-splash-downloads;
    // no JS toggling needed here. An empty flex container renders nothing.

    if ( flags.isKaltura ) {

        // download video from Kaltura
        document.getElementById( 'videoDl' ).addEventListener( 'click', function( evt ) {
            downloadKalVid( 'videoDl' );
            evt.preventDefault();
        } );

    }
    
}

/**
 * Turn downloadables to a download link.
 *
 * @function createDownloadLink
 */
function createDownloadLink( path, label, inline = false ) {

    let downloads = document.getElementsByClassName( 'gvp-download-list' )[0];
    let splashDownloads = document.getElementsByClassName( 'gvp-splash-downloads' )[0];
    let icon = inline ? 'gvp-icon-transcript' : 'gvp-icon-download';

    // Hidden data-store link (plain text label; read by the control-bar download menu)
    let link = document.createElement( 'a' );
    link.id = label.toLowerCase() + "Dl";
    link.href = path;
    link.innerHTML = label;
    if ( !inline ) {
        link.download = path;
    }
    link.target = '_blank';
    downloads.appendChild( link );

    // Visible splash pill button — proxies its click to the data-store link
    // so Kaltura/analytics handlers attached to the data-store link still fire.
    let splashLink = document.createElement( 'a' );
    splashLink.href = path;
    splashLink.innerHTML = '<span class="gvp-icon ' + icon + '" aria-hidden="true"></span> ' + label;
    if ( !inline ) {
        splashLink.download = path;
    }
    splashLink.target = '_blank';
    splashLink.addEventListener( 'click', function( evt ) {
        evt.preventDefault();
        link.click();
    } );
    splashDownloads.appendChild( splashLink );

}

/**
 * Download video from Kaltura.
 * 
 * @function downloadKalVid
 */
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

/**
 * Set the video title from the XML.
 * 
 * @function setAuthor
 */
function setAuthor( name ) {

    if ( name.length ) {

        const authorEl = document.querySelector( '.gvp-author-wrapper .gvp-author-name' );
        authorEl.innerHTML = name;

        const authorUrl = manifest.gvp_author_directory + name.replace(/[^\w]/gi, '').toLowerCase() + '.json?callback=author';

        fileExist( authorUrl ).then( result => {
        
            if ( result ) {
                
                const authorJsonp = document.createElement("script");
                authorJsonp.src = authorUrl;
                document.body.appendChild( authorJsonp );

            }
            
        } );

    } else {
        document.querySelector( '.gvp-author-wrapper' ).style.display = 'none';
    }
    
}

/**
 * Callback from the centralized author info.
 * 
 * @function author
 */
function author( data ) {
    document.querySelector( '.gvp-author-wrapper .gvp-author-name' ).innerHTML = data.name;
}

/****** HELPER FUNCTIONS ******/

function getScript( file, isAsync = true, callback = false, errorCallback = false ) {

    let script = document.createElement( 'script' );
    let head = document.getElementsByTagName( 'head' )[0];

    script.async = isAsync;

    if ( callback ) {
        script.onload = callback;
    }

    script.onerror = function() {

        console.warn( 'Failed to load ' + file );

        if ( errorCallback ) {
            errorCallback( file );
        }

    };

    script.src = file;
    head.appendChild( script );

}

async function fileExist( file ) {

    return ( await fileStatus( file ) ) === 'found';

}

/**
 * HEADs a file and classifies the answer.
 *
 * fileExist() collapses everything that is not a 200 into false, which is fine
 * for deciding whether to offer a download but not for telling a viewer their
 * video "is not on the server": plenty of hosts answer HEAD with 405 or 403 for
 * a file that is perfectly present. Callers that are about to make a claim
 * about the file need to know the difference.
 *
 * @function fileStatus
 * @param {String} file
 * @return {Promise<String>} 'found', 'missing', or 'unknown'
 */
async function fileStatus( file ) {

    try {

        let response = await fetch( file, { method: 'HEAD' } );

        if ( response.ok ) {
            return 'found';
        }

        // 404/410 are the only answers that actually mean "not there"
        if ( response.status === 404 || response.status === 410 ) {
            return 'missing';
        }

        return 'unknown';

    } catch ( e ) {

        // network failure, CORS, offline -- says nothing about the file
        return 'unknown';

    }

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

/**
 * Every user-facing failure the player can report, one entry per distinct
 * cause.
 *
 * The codes are the point. The on-screen prose has to stay short and free of
 * Kaltura/video.js vocabulary, which means several very different failures
 * used to read identically ("This video could not be played") and a viewer
 * report was worthless for triage. The code narrows it to one line of source,
 * and the console line beside it carries the technical detail the panel omits.
 *
 * Ranges: 1xx bootstrap, 2xx source XML, 3xx Kaltura, 4xx YouTube,
 * 5xx local files, 6xx playback.
 *
 * `detail` may be a function when the message needs values that are only known
 * at the point of failure; it receives the context object passed to
 * reportError().
 */
const gvpErrors = {

    // 1xx -- the player's own configuration, theme and markup
    'GVP-101': {
        title: 'The video player could not start.',
        detail: 'Its configuration file could not be downloaded. Check your connection and reload the page.'
    },
    'GVP-102': {
        title: 'The video player could not start.',
        detail: 'The page is missing its player configuration link.'
    },
    'GVP-103': {
        title: 'The video player is not set up correctly.',
        detail: 'No program theme source is named in the player configuration.'
    },
    'GVP-104': {
        title: 'The video player could not start.',
        detail: 'Its layout file could not be downloaded. Check your connection and reload the page.'
    },
    'GVP-106': {
        title: 'The video player is not set up correctly.',
        detail: 'No Kaltura account is named in the player configuration.'
    },
    'GVP-105': {
        title: 'The video player could not start.',
        detail: c => 'It stopped unexpectedly while loading' + ( c.stage ? ' (' + c.stage + ')' : '' ) + '. Please reload the page.'
    },

    // 2xx -- the XML file that names which video to play
    'GVP-201': {
        title: 'This video is not configured correctly.',
        detail: 'The `gvp.xml` could not be read properly, so the video it refers to is unknown.'
    },

    // 3xx -- Kaltura, the source for the overwhelming majority of videos
    'GVP-301': {
        title: 'The video player could not load.',
        detail: 'A required Kaltura library failed to download. Check your connection and reload the page.'
    },
    'GVP-302': {
        title: 'The video player could not load.',
        detail: 'The Kaltura player library is unavailable. Please reload the page.'
    },
    'GVP-303': {
        title: 'This video is taking too long to load.',
        detail: c => 'Kaltura did not respond within ' + c.seconds + ' seconds. Check your connection and reload the page.'
    },
    'GVP-304': {
        title: 'This video could not be loaded.',
        detail: c => 'Kaltura rejected the request for video ID ' + literal( c.entry ) + ( c.apiCode ? ' (' + literal( c.apiCode ) + ')' : '' ) + '.'
    },
    'GVP-305': {
        title: 'This video could not be found.',
        detail: c => 'Kaltura video ID ' + literal( c.entry ) + ' returned no media. It may have been deleted, or it may not be published yet.'
    },
    'GVP-306': {
        title: 'This video could not be played.',
        detail: c => 'Kaltura video ID ' + literal( c.entry ) + ' has no quality level this player is allowed to offer.'
    },

    // 4xx -- YouTube
    'GVP-401': {
        title: 'This video could not be played.',
        detail: 'The YouTube playback component failed to load. Check your connection and reload the page.'
    },

    // 5xx -- files served alongside the player
    'GVP-501': {
        title: 'This video could not be found.',
        detail: c => 'The file ' + literal( c.file ) + ' is not on the server.'
    },

    // 6xx -- playback itself, mapped from the HTML5 media element error codes.
    // These four used to collapse into one message, which threw away the only
    // signal that says whether to retry, reload, or report the video as broken.
    'GVP-601': {
        // Usually self-inflicted -- the viewer navigated away mid-load and came
        // back -- so this one is a passing notice rather than a panel. Blacking
        // out a video that is still perfectly playable would be worse than the
        // generic message it replaces.
        notice: true,
        title: 'Playback was stopped.',
        detail: 'Loading was cancelled before the video could start. Press play to try again.'
    },
    'GVP-602': {
        showSource: true,
        title: 'This video stopped loading.',
        detail: 'The connection to the video was lost. Check your connection and reload the page.'
    },
    'GVP-603': {
        showSource: true,
        title: 'This video could not be played.',
        detail: 'The video data is damaged, or this browser cannot decode it. Try a different browser.'
    },
    'GVP-604': {
        showSource: true,
        title: 'This video could not be played.',
        // The "missing file" half of this used to be a hedge, because a
        // browser refuses a 404 and a bad codec identically. GVP-501 now
        // answers that question with a HEAD request before this fires, so by
        // the time a local file reaches here the file is known to exist and
        // the format is the only remaining explanation.
        detail: c => {

            if ( !flags.isLocal ) {
                return 'This browser cannot play the format that was returned. Try a different browser.';
            }

            return c.file
                ? 'This browser cannot play the file ' + literal( c.file ) + '. Try a different browser.'
                : 'This browser cannot play this video file. Try a different browser.';

        }
    },
    'GVP-605': {
        showSource: true,
        title: 'This video could not be played.',
        detail: 'An unexpected playback error occurred. Please reload the page.'
    }

};

/**
 * Single entry point for reporting a failure: shows the panel and writes the
 * full technical line to the console.
 *
 * @function reportError
 * @param {String} code - a key of gvpErrors
 * @param {Object} [context] - values for the message, plus optional `source`
 *                             (shown on the panel) and `native`/`stage`
 *                             (console only)
 */
/**
 * Wraps a value as a monospaced run for appendErrorText().
 *
 * Backticks are the delimiter, so a value that contains one would flip the
 * parity of every delimiter after it and swallow the rest of the sentence into
 * the chip. Entry IDs, file names and Kaltura error codes all come from
 * outside, so none of them can be trusted to be backtick-free.
 *
 * @function literal
 * @param {String} value
 * @return {String}
 */
function literal( value ) {
    return '`' + String( value ).replace( /`/g, "'" ) + '`';
}

function reportError( code, context ) {

    context = context || {};

    let entry = gvpErrors[ code ];

    if ( !entry ) {
        entry = gvpErrors['GVP-605'];
        code = 'GVP-605';
    }

    // One fault, one report. Several codes can be raised by a single
    // underlying failure -- both Kaltura libraries share an error callback, and
    // video.js re-fires `error` on every player.src() -- and without this the
    // panel is rebuilt and a duplicate analytics event pushed each time,
    // inflating the counts for precisely the errors that happen most.
    if ( flags.hasError ) {
        console.error( 'GVP ' + code + ': suppressed, a fatal error is already on screen' );
        return;
    }

    let detail = typeof entry.detail === 'function' ? entry.detail( context ) : entry.detail;

    // The source URL is long, wraps badly and means nothing to most viewers, so
    // it is shown only for playback failures -- the one case where knowing
    // which flavour or file broke is worth the clutter. It always reaches the
    // console regardless.
    let panelSource = entry.showSource ? context.source : null;

    // Never say the same thing twice. When the message already names the file
    // -- a local video, where the source is just that file name again -- the
    // Source line underneath adds a second copy of the same string and nothing
    // else. Kaltura and YouTube are unaffected: there the message talks about
    // the format and the source is a long CDN URL that genuinely is new
    // information.
    if ( panelSource
         && ( panelSource === detail
              || detail.indexOf( panelSource ) !== -1
              || ( context.file && detail.indexOf( context.file ) !== -1 ) ) ) {

        panelSource = null;

    }

    if ( entry.notice ) {
        showErrorNotice( entry.title, detail );
    } else {
        showErrorMsgOnCover( entry.title, detail, panelSource, code );
    }

    sendErrorToAnalytics( code );

    // Everything the panel deliberately leaves out lands here instead.
    console.error( 'GVP ' + code + ': ' + entry.title + ' — ' + detail
        + ( context.source ? ' [source: ' + context.source + ']' : '' )
        + ( context.stage ? ' [stage: ' + context.stage + ']' : '' )
        + ( context.native ? ' [native: ' + context.native + ']' : '' ) );

}

/**
 * Reports a failure to Google Tag Manager.
 *
 * Which errors actually reach viewers, and how often, is otherwise invisible --
 * the console line only exists on the one machine that hit it. The code and the
 * video ID together are enough to tell a broken entry from a broken network.
 *
 * @function sendErrorToAnalytics
 * @param {String} code - the GVP error code
 */
function sendErrorToAnalytics( code ) {

    window.dataLayer = window.dataLayer || [];

    window.dataLayer.push( {
        'event': 'gvpError',
        'pagePath': window.location.pathname,
        'gvpErrorCode': code,
        'gvpVideoId': gvp.source || ''
    } );

}

/**
 * Appends text to an element, rendering `backtick` runs as monospaced code.
 *
 * Written as nodes rather than innerHTML so a file name that arrives from XML
 * or from a Kaltura response can never inject markup into the panel.
 *
 * @function appendErrorText
 * @param {Element} el - element to append to
 * @param {String} text - message text, optionally containing `marked` runs
 */
function appendErrorText( el, text ) {

    String( text ).split( '`' ).forEach( function( part, i ) {

        if ( part === '' ) {
            return;
        }

        // odd-numbered segments are the ones that sat between backticks
        if ( i % 2 === 1 ) {

            let mono = document.createElement( 'code' );
            mono.className = 'gvp-error-msg-mono';
            mono.textContent = part;
            el.appendChild( mono );

        } else {

            el.appendChild( document.createTextNode( part ) );

        }

    } );

}

/**
 * A passing, non-blocking message across the top of the video.
 *
 * Used for failures the viewer can recover from without reloading, where the
 * full panel would hide a video that still works.
 *
 * @function showErrorNotice
 * @param {String} title
 * @param {String} detail
 */
let noticeState = {
    node: null,
    timer: null,
    onPlay: null
};

/**
 * Tears down whatever notice is on screen, cancelling its timer and releasing
 * its play handler.
 *
 * Without this a replaced notice left its 8s timer and its one('play')
 * registration alive, so a repeated abort -- an autoplay-blocked retry loop,
 * say -- accumulated one orphaned handler per event, each firing dismiss()
 * against a node that had already been detached.
 *
 * @function dismissErrorNotice
 */
function dismissErrorNotice( fade ) {

    clearTimeout( noticeState.timer );

    if ( noticeState.onPlay && gvp.player ) {
        gvp.player.off( 'play', noticeState.onPlay );
    }

    let node = noticeState.node;

    noticeState.timer = null;
    noticeState.onPlay = null;
    noticeState.node = null;

    if ( !node ) {
        return;
    }

    if ( !fade ) {

        if ( node.parentNode ) {
            node.parentNode.removeChild( node );
        }

        return;

    }

    node.classList.remove( 'is-visible' );

    setTimeout( function() {
        if ( node.parentNode ) {
            node.parentNode.removeChild( node );
        }
    }, 400 );

}

function showErrorNotice( title, detail ) {

    let wrapper = document.getElementsByClassName( 'gvp-video-wrapper' )[0];

    if ( !wrapper ) {
        return;
    }

    // The cover is opaque and sits above this, and unlike the fatal panel a
    // notice has no business tearing it down -- the player behind it is not
    // ready to be looked at yet. An abort during load is harmless anyway, so
    // rather than sliding an invisible message in behind the cover and quietly
    // removing it 8s later, say nothing on screen and leave it to the console.
    let cover = document.getElementsByClassName( 'gvp-cover' )[0];

    if ( cover && cover.style.display !== 'none' && !cover.classList.contains( 'is-hidden' ) ) {
        return;
    }

    dismissErrorNotice( false );

    let notice = document.createElement( 'div' );
    notice.className = 'gvp-error-notice';
    notice.setAttribute( 'role', 'status' );

    // Inserted empty and filled afterwards: a live region that already carries
    // its content when it enters the document does not announce.
    wrapper.appendChild( notice );

    let titleEl = document.createElement( 'span' );
    titleEl.className = 'gvp-error-notice-title';
    appendErrorText( titleEl, title );
    notice.appendChild( titleEl );

    if ( detail ) {
        let detailEl = document.createElement( 'span' );
        detailEl.className = 'gvp-error-notice-detail';
        appendErrorText( detailEl, detail );
        notice.appendChild( detailEl );
    }

    requestAnimationFrame( function() {
        notice.classList.add( 'is-visible' );
    } );

    noticeState.node = notice;

    // whichever comes first: the viewer resolves it by pressing play, or it
    // simply times out
    noticeState.timer = setTimeout( function() {
        dismissErrorNotice( true );
    }, 8000 );

    if ( gvp.player ) {

        noticeState.onPlay = function() {
            dismissErrorNotice( true );
        };

        gvp.player.one( 'play', noticeState.onPlay );

    }

}

/**
 * Takes a region out of the tab order AND out of the accessibility tree, or
 * puts it back.
 *
 * The player has two opaque overlays -- the loading cover and the error panel --
 * and until now neither did anything but paint over the player. Everything
 * underneath stayed focusable and readable, so a keyboard user could tab to the
 * big play button and start a video while the cover still said "loading", and a
 * screen reader user could wander the controls of a video that had already
 * failed. `inert` is the one attribute that closes both holes at once;
 * aria-hidden is set alongside it for older engines that ignore `inert`.
 *
 * @function setRegionInert
 * @param {String} selector - within .gvp-video-wrapper
 * @param {Boolean} isInert
 */
/**
 * Says something to assistive tech without putting it on screen.
 *
 * Several state changes here are conveyed only by a visual change -- the
 * quality menu closes and re-sources the player, the video reaches its end card
 * -- so a screen reader user got no confirmation that anything happened. The
 * menu has already closed by the time a switch settles, so its own live text is
 * no longer exposed; this region is independent of it.
 *
 * @function announce
 * @param {String} message
 */
function announce( message ) {

    let region = document.getElementById( 'gvp-live-region' );

    if ( !region ) {

        let host = document.getElementsByClassName( 'gvp-video-wrapper' )[0] || document.body;

        region = document.createElement( 'p' );
        region.id = 'gvp-live-region';
        region.className = 'gvp-visually-hidden';
        region.setAttribute( 'role', 'status' );

        host.appendChild( region );

    }

    // Re-setting identical text does not re-announce, so clear first.
    region.textContent = '';

    setTimeout( function() {
        region.textContent = message;
    }, 100 );

}

function setRegionInert( selector, isInert ) {

    let el = document.querySelector( selector );

    if ( !el ) {
        return;
    }

    if ( isInert ) {
        el.setAttribute( 'inert', '' );
        el.setAttribute( 'aria-hidden', 'true' );
    } else {
        el.removeAttribute( 'inert' );
        el.removeAttribute( 'aria-hidden' );
    }

}

/**
 * Everything the loading cover is painted over. The cover itself and the error
 * surfaces are deliberately excluded.
 */
// Deliberately NOT the <video> element. Sealing that before video.js
// initialises achieves nothing -- a bare <video> with no controls attribute is
// neither focusable nor interactive -- and it actively breaks the player:
// video.js copies every attribute off the tag it takes over onto the wrapper it
// builds, so `inert` was being duplicated onto the whole player. The player is
// sealed separately, by reference, once it exists.
const coveredRegions = [ '.gvp-splash-meta', '.gvp-splash-download-wrapper' ];

/**
 * The elements coverUp() actually sealed, so they can be released by reference.
 *
 * Selectors are not safe to re-resolve: video.js renames the element it takes
 * over (`#gvp-video` becomes `#gvp-video_html5_api`, and the wrapper inherits
 * the id), so between sealing and releasing a selector can come to mean a
 * different element.
 */
let inertedRegions = [];

/** Whether the loading cover is still up, and so still sealing the player. */
let coverSealed = false;

/**
 * Takes one element out of the tab order and the accessibility tree, and
 * remembers it so it can be released again.
 *
 * @function sealRegion
 * @param {Element} el
 */
function sealRegion( el ) {

    if ( !el || inertedRegions.indexOf( el ) !== -1 ) {
        return;
    }

    el.setAttribute( 'inert', '' );
    el.setAttribute( 'aria-hidden', 'true' );
    inertedRegions.push( el );

}

function showErrorMsgOnCover( title, detail, source, code ) {

    // In native fullscreen only the fullscreen element and its descendants are
    // rendered. The panel is a SIBLING of the player element, so in fullscreen
    // it cannot paint at any z-index -- and because video.js's own error modal
    // is suppressed in favour of this one, a failure during playback (the 6xx
    // codes, exactly the ones that strike mid-playback) would leave the viewer
    // staring at a frozen black screen with nothing to explain it. Drop out of
    // fullscreen so the message is reachable.
    if ( gvp.player
         && typeof gvp.player.isFullscreen === 'function'
         && gvp.player.isFullscreen() ) {

        try {
            gvp.player.exitFullscreen();
        } catch ( e ) {
            console.warn( 'GVP: could not exit fullscreen to show an error: ' + e.message );
        }

    }

    let msg = document.getElementsByClassName( 'gvp-error-msg' )[0];

    // The panel normally comes from gvp.tpl, so a template that failed to
    // download used to leave the player with no way to say so -- the one case
    // where a message matters most. Build the element instead of giving up.
    if ( !msg ) {

        msg = document.createElement( 'div' );
        msg.className = 'gvp-error-msg gvp-error-msg-bare';
        msg.setAttribute( 'role', 'alert' );

        // The panel's styles are scoped to .gvp-video-wrapper, which came from
        // the same template that just failed. Recreate the one element they
        // hang off rather than duplicating the rules for this case.
        let host = document.querySelector( '.gvp-video-wrapper' );

        if ( !host ) {

            host = document.createElement( 'div' );
            host.className = 'gvp-video-wrapper';

            ( document.getElementById( 'gvp-wrapper' ) || document.body ).appendChild( host );

        }

        host.appendChild( msg );

    }

    let inner = document.createElement( 'div' );
    inner.className = 'gvp-error-msg-inner';

    let titleEl = document.createElement( 'span' );
    titleEl.className = 'gvp-error-msg-title';
    appendErrorText( titleEl, title );
    inner.appendChild( titleEl );

    if ( detail ) {
        let detailEl = document.createElement( 'span' );
        detailEl.className = 'gvp-error-msg-detail';
        appendErrorText( detailEl, detail );
        inner.appendChild( detailEl );
    }

    if ( source ) {
        let sourceEl = document.createElement( 'span' );
        sourceEl.className = 'gvp-error-msg-source';
        sourceEl.appendChild( document.createTextNode( 'Source: ' ) );
        appendErrorText( sourceEl, literal( source ) );
        inner.appendChild( sourceEl );
    }

    // Small and dim: it is not for the viewer to act on, it is so a viewer can
    // quote one token in a support request instead of paraphrasing the prose.
    if ( code ) {
        let codeEl = document.createElement( 'span' );
        codeEl.className = 'gvp-error-msg-code';
        codeEl.textContent = 'Error ' + code;
        inner.appendChild( codeEl );
    }

    // role="alert" on an element that is still hidden does not announce, and
    // simply un-hiding an already-populated region is not a content change
    // either. Reveal the empty region first, then put the message into it.
    msg.innerHTML = '';
    msg.hidden = false;
    msg.appendChild( inner );

    // The cover sits above the splash overlays, so it has to go or the error
    // would be stranded behind the loading screen.
    let cover = document.getElementsByClassName( 'gvp-cover' )[0];

    if ( cover ) {
        cover.style.display = 'none';
    }

    // The panel owns the video area now. video.js leaves its control bar fully
    // mounted after an error, so without this a screen reader user tabs straight
    // into play/seek/volume for a video that will never play. The download pills
    // are deliberately NOT included -- they sit above the panel on purpose and
    // are the viewer's remaining way out.
    setRegionInert( '#gvp-video', true );
    setRegionInert( '.gvp-splash-meta', true );

    // The cover is gone, so its own inerting must not outlive it.
    setRegionInert( '.gvp-splash-download-wrapper', false );

    flags.hasError = true;

    // A live region is one announcement and we only ever raise the first error,
    // so if it is missed the user gets nothing at all, ever. Moving focus is a
    // second, independent channel that does not depend on the alert firing --
    // and it also rescues focus that was sitting on a control we just inerted.
    if ( typeof msg.focus === 'function' ) {

        try {
            msg.focus( { preventScroll: true } );
        } catch ( e ) {
            msg.focus();
        }

    }

}