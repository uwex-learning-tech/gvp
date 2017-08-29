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
    Copyright (C) 2013-2017  Ethan S. Lin, UWEX CEOEL Media Services

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
let source = '';
let kaltura = {};
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
    
    getFile( manifestURL, true ).then( result => {
        
        manifest = result;
        
        if ( manifest.gvp_root_directory.length <= 0 ) {
            manifest.gvp_root_directory = 'sources/';
        }
        
        file.kalturaLib = manifest.gvp_root_directory + 'scripts/mwembedloader.js';
        file.kalturaSource = manifest.gvp_root_directory + 'scripts/kwidget.getsources.js';
        
    } );
    
    getFile( file.kalturaIDFile ).then( result => {
        
        if ( result ) {
            
            source = result;
            getKalturaLibrary();
            
        } else {
            
            let url = window.location.href;
            
    		source = url.split( '?' );
    		source = source[0];
    		
    		if ( source.lastIndexOf( '/' ) !== source.length - 1 ) {
        		source += '/';
    		}
    		
    		source = cleanArray( source.split( '/' ) );
    		source = source[source.length-1];
    		
    		loadVideoJS();
            
        }
        
    } );
    
    let lightOnOffBtn = document.getElementById( 'gvp-light' );
    
    lightOnOffBtn.addEventListener( 'click', function() {
        
        let body = document.getElementsByTagName( 'body' )[0];
        let toggle = document.getElementsByClassName( 'gvp-toggle-control' )[0];
        
        if ( body.classList.contains( 'light-off' ) ) {
            
            body.classList.remove( 'light-off' );
            body.classList.add( 'light-on' );
            toggle.classList.remove( 'fa-toggle-off' );
            toggle.classList.add( 'fa-toggle-on' );
            this.setAttribute( 'title', 'Turn the light off' );
            
        } else {
            
            body.classList.remove( 'light-on' );
            body.classList.add( 'light-off' );
            toggle.classList.remove( 'fa-toggle-on' );
            toggle.classList.add( 'fa-toggle-off' );
            this.setAttribute( 'title', 'Turn the light on' );
            
        }
        
    } );
    
}

function getKalturaLibrary() {

    getScript( file.kalturaLib, false, false );
    getScript( file.kalturaSource, false, loadLalturaSource );
    
}

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
                
                document.getElementsByTagName( 'title' )[0].innerHTML = data.name;
                document.getElementsByClassName( 'gvp-title-bar' )[0].children[0].innerHTML = data.name;
                
                loadVideoJS();
                
            }
    
        } );
        
    }
    
}

function loadVideoJS() {
    
    let playerOptions = {
        
        techOrder: ['html5'],
        controls: true,
        autoplay: false,
        preload: 'auto',
        playbackRates: [0.5, 1, 1.5, 2],
        fluid: true,
        plugins: {}
        
    };
    
    if ( kaltura ) {
        
        Object.assign( playerOptions.plugins, { videoJsResolutionSwitcher: { 'default': 720 } } );
        
    }
    
    videojs( 'gvp-video', playerOptions, function() {
        
        let self = this;
        
        if ( kaltura ) {
            
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
    
    return arr;
    
}