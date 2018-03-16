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
let program = {};
let reference = {
    names: window.location.href,
    params:new URLSearchParams( window.location.search )
};
let gvp = {
    source: '',
    template: null
};
let kaltura = {
    lib: null,
    widget: null
};
let xml = {
    file: 'gvp.xml',
    doc: null,
    titleTag: null,
    kalturaTag: null,
    fileNameTag: null,
    markersTag: null
};
let flags = {
    isLocal: false,
    isIframe: false
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
    reference.names = reference.names.split( '?' );
    reference.names = reference.names[0];
    
    if ( reference.names.lastIndexOf( '/' ) !== reference.names.length - 1 ) {
		reference.names += '/';
	}
	
	reference.names = cleanArray( reference.names.split( '/' ) );
	
	// if inside an iframe
	if ( window.self != window.top ) {
    	
    	flags.isIframe = true;
    	
    	if ( String( window.location.hash ).indexOf( 'sbplus' ) === 1 ) {
        	
        	flags.isInsideSBPlus = true;
        	
    	}
    	
	}
    
    // get the data from the manifest file
    getFile( manifestURL, true ).then( result => {
        
        manifest = result;
        
        if ( manifest.gvp_root_directory.length <= 0 ) {
            manifest.gvp_root_directory = 'sources/';
        }
        
        kaltura.lib = manifest.gvp_root_directory + 'scripts/mwembedloader.js';
        kaltura.widget = manifest.gvp_root_directory + 'scripts/kwidget.getsources.js';
        gvp.template = manifest.gvp_root_directory + 'scripts/templates/gvp.tpl';
        
        setProgram();
        setGvpTemplate();
        
    } );
    
}

function setProgram() {
    
    if ( manifest.gvp_custom_themes ) {

        program = manifest.gvp_custom_themes.find( function (obj) {
            return obj.name === reference.names[3];
        } );
        
        if ( program === undefined ) {
            
            program = manifest.gvp_custom_themes.find( function (obj) {
                return obj.name === manifest.gvp_logo_default;
            } );
            
        }
        
    }
    
}

function setGvpTemplate() {
    
    getFile( gvp.template ).then( result => {
        
        if ( result ) {
            
            let gvpWrapper = document.getElementById( 'gvp-wrapper' );
            
            gvpWrapper.innerHTML = result;
            
            if ( !flags.isIframe ) {
                
                // get/set copyright year
                let copyrightYearHolder = document.getElementsByClassName( 'gvp-copyright-year' )[0];
                let date = new Date();
                let year = date.getFullYear();
                
                copyrightYearHolder.innerHTML = year;
                
                // set copyright notice
                let noticeHolder = document.getElementById( 'gvp_notice' );
                noticeHolder.innerHTML = manifest.gvp_copyright;
                
            } else {
                
                gvpWrapper.classList.add( "embedded" );
                
            }

            setGvpUi();
            
        }
        
    } );
    
}

function setGvpUi() {
    
    // display logo
    let logoURL = manifest.gvp_logo_directory + program.name + '.svg';
    
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
    
    if ( !flags.isIframe ) {
        
        if ( reference.params.has( 'light' ) && reference.params.get( "light" ) === '1' ) {
            
            let body = document.getElementsByTagName( 'body' )[0];
            
            if ( !body.classList.contains( 'light-off' ) ) {
                
                body.classList.add( 'light-off' );
                
            }
            
        }
        
        setProgramTheme();
        
    }
    
    getVideoSource();
    
}

function setProgramTheme() {
    
    let decorationBar = document.getElementsByClassName( 'gvp-decoration-bar' )[0];
    
    program.colors.forEach( function( hex ) {
                    
        let span = document.createElement( 'span' );
        span.style.backgroundColor = hex;
        decorationBar.appendChild(span);
        
    } );
    
}

function getVideoSource() {

    // get the kaltura video id from gvp.xml file
    // otherwist default to URN
    getFile( xml.file ).then( result => {
        
        if ( result ) {
            
            // parse the xml
            let xmlParser = new DOMParser();
            
            xml.doc = xmlParser.parseFromString( result, 'text/xml' );
            
            // see if kalturaId tag is specified
            xml.kalturaTag = xml.doc.getElementsByTagName( 'kalturaId' )[0];
            
            if ( xml.kalturaTag !== undefined ) {
                
                if ( xml.kalturaTag.childNodes[0] !== undefined
                     && xml.kalturaTag.childNodes[0].nodeValue.trim() != '' ) {
                    
                    gvp.source = xml.kalturaTag.childNodes[0].nodeValue.trim();
                
                    flags.isLocal = false;
                    getKalturaLibrary();
                    return;
                    
                }
                
            }
            
            // see if fileName tag is specified
            xml.fileNameTag = xml.doc.getElementsByTagName( 'fileName' )[0];
            
            if ( xml.fileNameTag !== undefined ) {
                
                if ( xml.fileNameTag.childNodes[0] !== undefined
                     && xml.fileNameTag.childNodes[0].nodeValue.trim() != '' ) {
                     
                    gvp.source = xml.fileNameTag.childNodes[0].nodeValue;
                    flags.isLocal = true;
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
        
        setVideoJs();

        
    } );
    
}

function setVideoJs() {
    
    setTitle();
    loadVideoJS();
    setDownloadables();
    
}

function getKalturaLibrary() {

    getScript( kaltura.lib, false, false );
    getScript( kaltura.widget, false, loadLalturaSource );
    
}

function loadLalturaSource() {
    
    if ( kWidget ) {
        
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
                
                setVideoJs();
                
            }
    
        } );
        
    }
    
}

function loadVideoJS() {
        
    let isAutoplay = false;
    let player = null;
    let markersCollection = [];

    if ( reference.params.has( 'autoplay' ) && reference.params.get( 'autoplay' ) === '1' ) {
        
        isAutoplay = true;
        
    }
    
    let playerOptions = {
        
        techOrder: ['html5'],
        controls: true,
        autoplay: isAutoplay,
        preload: 'auto',
        playbackRates: [0.5, 1, 1.5, 2],
        fluid: true,
        plugins: {}
        
    };
    
    if ( kaltura && flags.isLocal === false ) {
        Object.assign( playerOptions.plugins, { videoJsResolutionSwitcher: { 'default': 720 } } );
    }
    
    player = videojs( 'gvp-video', playerOptions, function() {
        
        let self = this;
        
        if ( kaltura && flags.isLocal === false ) {
            
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
        
        // queried event listeners
        
        if ( reference.params.has( 'start' ) ) {
            
            self.on( 'play', function() {
            
                if ( self.played().length === 0 ) {
                    
                    self.currentTime( queryToSeconds( reference.params.get( 'start' ) ) );
                    
                }
                
            } );
            
        }
        
        if ( reference.params.has( 'end' ) ) {

            self.on( 'timeupdate', function() {
                
                if ( self.currentTime() >= queryToSeconds( reference.params.get( 'end' ) ) ) {
                    
                    self.pause();
                    self.off( 'timeupdate' );
                    
                }
                
            } );
            
        }
        
        // event listeners
        
        self.on( 'playing', function() {

            let logo = document.getElementsByClassName( 'gvp-program-logo' )[1];
            logo.style.display = 'none';
            
            if ( flags.isIframe ) {
                let titleBar = document.getElementsByClassName( 'gvp-title-bar' )[0];
                titleBar.style.display = 'none';
            }
            
        } );
        
        self.on( 'ended', function() {
            
            let logo = document.getElementsByClassName( 'gvp-program-logo' )[1];
            logo.style.display = 'initial';
            
            if ( flags.isIframe ) {
                let titleBar = document.getElementsByClassName( 'gvp-title-bar' )[0];
                titleBar.style.display = 'block';
            }
            
            self.bigPlayButton.el_.classList.add( 'replay' );
            self.hasStarted( false );
            
        } );
        
        self.on( 'error', function() {
            
            let msg = 'Please double check the file name.<br>Expecting: ' + self.currentSrc() + '<br><br>';
            showErrorMsgOnCover( msg + self.error_.message  );
            
        } );
        
        // add forward and backward seconds button
        addForwardButton( self );
        addBackwardButton( self );
        
        // add download button
        addDownloadFilesButton( self );
        
        self.on( 'canplay', function() {
            hideCover();
        } );
        
    } );
    
    // check to see is there are markers
    if ( xml.doc != null ) {
        
        xml.markersTag = xml.doc.getElementsByTagName( 'markers' )[0];
        
        if ( xml.markersTag !== undefined ) {
            
            if ( xml.markersTag.children.length ) {
                
                let markerTag = xml.doc.getElementsByTagName( 'marker' );
                
                for ( var i = 0; i < markerTag.length; i++ ) {
                    
                    let marker = {
                        time: toSeconds( markerTag[i].attributes.timecode.nodeValue ),
                        text: markerTag[i].childNodes[0].nodeValue
                    };
                    
                    markersCollection.push( marker );

                }
                
                player.markers( {
                    
                    markerStyle: {
                        'background-color': 'rgb(166, 231, 141)'
                    },
                    markers: markersCollection
                    
                } );
                
            }
            
        }
        
    }
    
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
    
    if ( kaltura && flags.isLocal === false ) {
        
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
    let forwardTenBtn = videojs.extend( Button, {
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

    videojs.registerComponent( 'ForwardBtn', forwardTenBtn );
    vjs.getChild( 'controlBar' ).addChild( 'ForwardBtn', {}, 1 );
    
    vjs.on( 'play', function() {
        
        secToSkip = getSecToSkip( vjs.duration() );
        document.getElementsByClassName('vjs-forward-button')[0].classList.add( 'sec' + secToSkip );
        
    } );
    
}

function addBackwardButton( vjs ) {
    
    let secToSkip = 5;
    let Button = videojs.getComponent( 'Button' );
    let forwardTenBtn = videojs.extend( Button, {
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

    videojs.registerComponent( 'BackwardBtn', forwardTenBtn );
    vjs.getChild( 'controlBar' ).addChild( 'BackwardBtn', {}, 1 );
    
    vjs.on( 'play', function() {
       
        secToSkip = getSecToSkip( vjs.duration() );
        document.getElementsByClassName('vjs-backward-button')[0].classList.add( 'sec' + secToSkip );
        
    } );
    
}

function getSecToSkip( duration ) {
    
    if ( isNaN( duration ) ) {
        
        return 0;
        
    }
    
    if ( duration >= 120 && duration < 180 ) {
            
        return 10;
        
    } else if ( duration >= 180 && duration < 300 ) {
        
        return 15;
        
    } else if ( duration >= 300 ) {
        
        return 30;
        
    }
    
    return 0;
        
}

function addDownloadFilesButton( vjs ) {
    
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

function downloadables( vjs ) {
    
    let files = document.getElementsByClassName( 'gvp-downloads' )[0].childNodes;
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
        
      document.getElementById( this.options_.id ).click();
      
    };
    
    MenuItem.registerComponent( 'DownloadMenuItem', DownloadMenuItem );
    
    for ( let i = 0; i < files.length; i++ ) {
        
        let fileLabel = files[i].childNodes[0].nodeValue;
        let fileId = files[i].id;
        
        items.push( new DownloadMenuItem(
            vjs,
            {
                label: fileLabel,
                id: fileId
            }
        ) );
        
    }
    
    return items;
    
}

function setDownloadables() {
    
    let supportedFiles = manifest.gvp_download_files;
    let fileName = gvp.source;
    
    supportedFiles.forEach( function( file ) {
        
        let fileLabel = file.label;
        let ext = file.format;
        let filePath = cleanString( fileName ) + '.' + ext;
        
        // video
        if ( ext === "mp4" ) {
            
            let dwnldName = fileName;
            let dwnldPath = filePath;
            
            if ( kaltura && flags.isLocal === false ) {
        
                dwnldName = kaltura.name;
                dwnldPath = kaltura.flavor.normal;
                
            } else {
                
                if ( reference.names[5] !== undefined ) {
                    
                    dwnldName = reference.names[5];
                    dwnldPath = cleanString( dwnldName ) + '.' + ext;
                    
                }
                
            }
            
            createDownloadLink( dwnldName, dwnldPath, fileLabel );
            
            return;
            
        }
        
        fileExist( filePath ).then( result => {
                
            if ( result ) {
                
                createDownloadLink( fileName, filePath, fileLabel );
                
            }
            
        } );
        
    } );
    
}

function createDownloadLink( name, path, label ) {
    
    let downloads = document.getElementsByClassName( 'gvp-downloads' )[0];
    let link = document.createElement( 'a' );
    
    link.id = label.toLowerCase() + "Dl";
    link.href = path;
    link.innerHTML = label;
    link.download = name;
    
    downloads.appendChild( link );
    
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