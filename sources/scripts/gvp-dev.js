/*
 * Generic Video Player (GVP)
 *
 * @author: Ethan Lin
 * @url: https://github.com/oel-mediateam/gvp_v4
 * @version: 4.0.0
 * Released pending
 *
 * @license: GNU GENERAL PUBLIC LICENSE v3
 *
    Storybook Plus is an web application that serves multimedia contents.
    Copyright (C) 2013-2018  Ethan S. Lin, UWEX CEOEL Media Services

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
 *
 *
 
    WARNING:
    This JavaScript file uses features from ECMAScript 2015, 2016, and 2017.
    All modern web browsers (excluding Internet Explorer 11) support ECMAScript
    2015, 2016, and 2017. For web browsers that do not support ECMAScript 2015
    2016, and 2017 features, compile this JavaScript using Babel with Polyfill
    (http://babeljs.io/).
 
 *
 */

let manifest = {};
let urn = window.location.href;
let source = '';
let kaltura = {};
let isLocal = false;
let file = {
    kalturaIDFile: 'kaltura.txt'
};

( function ready( fn ) {
    
    if ( document.attachEvent ? document.readyState === 'complete' : document.readyState !== 'loading' ) {
        fn();
    } else {
        document.addEventListener( 'DOMContentLoaded', fn );
    }
    
} )( initGVP );

function initGVP() {
    
    let manifestURL = document.getElementById( 'gvp-manifest' ).href;
    
    // parse directories from the URL
    urn = urn.split( '?' );
    urn = urn[0];
    
    if ( urn.lastIndexOf( '/' ) !== urn.length - 1 ) {
		urn += '/';
	}
	
	urn = cleanArray( urn.split( '/' ) );
    
    // get the data from the manifest file
    getFile( manifestURL, true ).then( result => {
        
        manifest = result;
        
        if ( manifest.gvp_root_directory.length <= 0 ) {
            manifest.gvp_root_directory = 'sources/';
        }
        
        file.kalturaLib = manifest.gvp_root_directory + 'scripts/mwembedloader.js';
        file.kalturaSource = manifest.gvp_root_directory + 'scripts/kwidget.getsources.js';
        file.gvpTemplate = manifest.gvp_root_directory + 'scripts/templates/gvp.tpl';
        
        getGVPTemplate();
        
    } );
    
}

function getGVPTemplate() {
    
    getFile( file.gvpTemplate ).then( result => {
        
        if ( result ) {
            
            let gvpWrapper = document.getElementById( 'gvp-wrapper' );
            
            gvpWrapper.innerHTML = result;
            
            // get/set copyright year
            let copyrightYearHolder = document.getElementsByClassName( 'gvp-copyright-year' )[0];
            let date = new Date();
            let year = date.getFullYear();
            
            copyrightYearHolder.innerHTML = year;
            
            setGvpUi();
            
        }
        
    } );
    
}

function setGvpUi() {
    
    // get URL Query Parameters for settings
    let settingsQuery = new URLSearchParams( location.search );
    
    // get program name
    let programName = '';
    
    if ( urn[3] === undefined ) {
        programName = manifest.gvp_logo_default;
    } else {
        programName = urn[3];
    }
    
    // display logo
    let logoURL = manifest.gvp_logo_directory + programName + '.svg';
    
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
    
    if ( settingsQuery.has( 'light' ) && settingsQuery.get( "light" ) === '1' ) {
        
        let body = document.getElementsByTagName( 'body' )[0];
        
        if ( !body.classList.contains( 'light-off' ) ) {
            
            body.classList.add( 'light-off' );
            
        }
        
    } else {
        
        // apply theme
        if ( manifest.gvp_custom_themes ) {
                
            let decorationBar = document.getElementsByClassName( 'gvp-decoration-bar' )[0];
            
            for ( let theme of manifest.gvp_custom_themes ) {
                
                if ( theme.name === programName ) {
                    
                    theme.colors.forEach( function( hex ) {
                        
                        let span = document.createElement( 'span' );
                        span.style.backgroundColor = hex;
                        decorationBar.appendChild(span);
                        
                    } );
                    
                    break;
                    
                }
                
            }
            
        }
        
    }
    
    setVideo();
    
}

function setVideo() {
    
    // get the kaltura video id from kaltura.txt file
    // otherwist default to URN
    getFile( file.kalturaIDFile ).then( result => {
        
        if ( result ) {
            
            source = result;
            getKalturaLibrary();
            isLocal = false;
            
        } else {
            
            isLocal = true;
            
            if ( urn[5] === undefined ) {
                
                source = "video";
                
            } else {
                
                source = urn[5];
                
            }
    		
    		setTitle();
            loadVideoJS();
            setDownloadables();
            
        }
        
    } );
    
}

function getKalturaLibrary() {

    getScript( file.kalturaLib, false, false );
    getScript( file.kalturaSource, false, loadLalturaSource );
    
}

function loadLalturaSource() {
    
    if ( kWidget ) {
        
        kWidget.getSources( {

            'partnerId': manifest.gvp_kaltura.id,
            'entryId': source,
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
                
                setTitle();
                loadVideoJS();
                setDownloadables();
                
            }
    
        } );
        
    }
    
}

function loadVideoJS() {
    
    // set player
    
    let playerOptions = {
        
        techOrder: ['html5'],
        controls: true,
        autoplay: false,
        preload: 'auto',
        playbackRates: [0.5, 1, 1.5, 2],
        fluid: true,
        plugins: {}
        
    };
    
    if ( kaltura && isLocal === false ) {
        Object.assign( playerOptions.plugins, { videoJsResolutionSwitcher: { 'default': 720 } } );
        
    }
    
    videojs( 'gvp-video', playerOptions, function() {
        
        let self = this;
        
        if ( kaltura && isLocal === false ) {
            
            self.poster( kaltura.poster + '/width/900/quality/100' );
            self.updateSrc( [
                { type: 'video/mp4', src: kaltura.flavor.low, label: 'low', res: 360 },
                { type: 'video/mp4', src: kaltura.flavor.normal, label: 'normal', res: 720 },
                { type: 'video/mp4', src: kaltura.flavor.medium, label: 'medium', res: 640 } 
            ] );
            
            if ( kaltura.captionId ) {
                
                self.addRemoteTextTrack( {
            		kind: 'captions',
            		language: 'en',
            		label: 'English',
            		src: 'https://www.kaltura.com/api_v3/?service=caption_captionasset&action=servewebvtt&captionAssetId=' + kaltura.captionId + '&segmentDuration=' + kaltura.duration + '&segmentIndex=1'
        		}, true );
                
            }
            
        } else {
            
            self.src( source + '.mp4' );
            
            if ( fileExist( source + '.vtt' ) ) {
                
                self.addRemoteTextTrack( {
            		kind: 'captions',
            		language: 'en',
            		label: 'English',
            		src: source + '.vtt'
        		}, true );
        		
            }
            
        }
        
        self.on( 'playing', function() {
            let logo = document.getElementsByClassName( 'gvp-program-logo' )[1];
            logo.style.display = 'none';
        } );
        
        self.on( 'ended', function() {
            
            let logo = document.getElementsByClassName( 'gvp-program-logo' )[1];
            logo.style.display = 'initial';
            
            self.bigPlayButton.el_.classList.add( 'replay' );
            self.hasStarted( false );
            
        } );
        
    });
    
    hideCover();
    
}

function setTitle() {
    
    let name = "";
    
    if ( kaltura && isLocal === false ) {
        name = kaltura.name;
    }
    
    // set title and downloadables
    document.getElementsByTagName( 'title' )[0].innerHTML = name;
    document.getElementsByClassName( 'gvp-title-bar' )[0].children[0].innerHTML = name;
    
}

function setDownloadables() {
    
    let name = source + '.mp4';
    let url = name;
    
    if ( kaltura && isLocal === false ) {
        
        name = cleanString( kaltura.name ) + ".mp4";
        url = kaltura.flavor.normal;
        
    } else {
        
        if ( urn[5] !== undefined ) {
            
            name = urn[5] + ".mp4";
            url = name;
            
        }
        
    }
    
    // display download
    let fileDownloads = document.getElementsByClassName( 'gvp-downloads' )[0];
    let vidDownloadLink = document.createElement( 'a' );
    
    vidDownloadLink.href = url;
    vidDownloadLink.innerHTML = '<i class="fa fa-cloud-download fa-lg"></i><span>Video</span>';
    vidDownloadLink.download = name;
    fileDownloads.appendChild( vidDownloadLink );
    
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
        
    }, 500 );
    
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
    
    return str.replace(/[^\w]/gi, '').toLowerCase();
    
}