/**
 * Stand alone source grabber.
 */

if( ! window.kWidget ){
	window.kWidget = {};
}
( function( kWidget ) {
	/**
	 * Returns a KalturaAPIException as { code, message }, or null.
	 */
	kWidget.asApiError = function( item ){

		if( item && item.objectType === 'KalturaAPIException' ){
			return {
				'code': item.code || 'UNKNOWN',
				'message': item.message || ''
			};
		}

		return null;

	};

	/**
	 * Returns the first API exception that would actually prevent playback,
	 * or null.
	 *
	 * Only the first two sub-requests are load-bearing: the flavor list and the
	 * entry metadata. The third is the caption list, and a partner with the
	 * caption module disabled or unentitled answers THAT with an exception
	 * while the video itself plays perfectly well. Treating it as fatal would
	 * block a working video over a missing caption track, so it is deliberately
	 * excluded here and left to degrade to "no captions" further down.
	 *
	 * A request that fails outright answers with the exception object on its
	 * own rather than a multirequest array, so both shapes are handled.
	 */
	kWidget.getApiError = function( result ){

		if( ! result || typeof result !== 'object' ){
			return { 'code': 'NO_RESPONSE', 'message': 'The Kaltura API returned no usable result.' };
		}

		if( Object.prototype.toString.call( result ) !== '[object Array]' ){
			return kWidget.asApiError( result )
				|| { 'code': 'BAD_RESPONSE', 'message': 'Unexpected Kaltura API response shape.' };
		}

		// index 0 is the flavor list, index 1 the entry metadata; index 2 is
		// the optional caption list and is intentionally not consulted
		for( var i = 0; i < 2; i++ ){

			var apiError = kWidget.asApiError( result[i] );

			if( apiError ){
				return apiError;
			}

		}

		// A response too short to hold both would otherwise throw on
		// result[0]['flavorAssets'] below -- inside an XHR callback, where
		// nothing catches it -- and the player would sit waiting for a callback
		// that never comes until its own 20s timeout fired with a misleading
		// "Kaltura did not respond".
		if( ! result[0] || ! result[1] ){
			return { 'code': 'BAD_RESPONSE', 'message': 'The Kaltura API response was incomplete.' };
		}

		return null;

	};

	// Add master exported function:
	kWidget.getSources = function( settings ){
		var sourceApi = new kWidget.api( { 'wid' : '_' + settings.partnerId , 'serviceUrl': 'https://cdnapisec.kaltura.com' } );
		sourceApi.doRequest([
		{
			'contextDataParams' : {
				'referrer' : document.URL,
				'objectType' : 'KalturaEntryContextDataParams',
				'flavorTags': 'all'
                },
			'service' : 'baseentry',
			'entryId' : settings.entryId,
			'action' : 'getContextData'
		},
		{
			'service' : 'baseentry',
			'action' : 'get',
			'version' : '-1',
			'entryId' : settings.entryId
		},
		{
			'service' : 'caption_captionasset',
			'action' : 'list',
			'filter:entryIdEqual' : settings.entryId
		}], function( result ){ // API result

			// A restricted, unpublished or misspelled entry answers with a
			// KalturaAPIException rather than with assets. That used to fall
			// through the loop below and reach the player as an empty source
			// list, which reads as "this video does not exist" even when it
			// does and the viewer simply is not entitled to it. Hand the
			// exception up instead so the player can say which it was.
			var apiError = kWidget.getApiError( result );

			if( apiError ){
				if( settings.callback ){
					settings.callback({
						'apiError': apiError,
						'sources': []
					});
				}
				return;
			}

			var ks = sourceApi.ks;
			var ipadAdaptiveFlavors = [];
			var iphoneAdaptiveFlavors = [];
			var deviceSources = [];
			var protocol = location.protocol.substr(0, location.protocol.length-1);
			// Set the service url based on protocol type
			var serviceUrl;

			if( protocol == 'https' ){
				serviceUrl = 'https://cdnapisec.kaltura.com';
			} else {
				serviceUrl = 'http://cdnbakmi.kaltura.com';
			}

			var baseUrl = serviceUrl + '/p/' + settings.partnerId +
					'/sp/' + settings.partnerId + '00/playManifest';


			for( var i in result[0]['flavorAssets'] ){

				var asset = result[0]['flavorAssets'][i];

				// Continue if clip is not ready (2)
				if( asset.status != 2  ) {
					continue;
				}

				// Setup a source object:
				var source = {
					/* 'data-bitrate' : asset.bitrate * 8, */
					'data-width' : asset.width,
					'data-height' : asset.height,
					'flavorParamsId': asset.flavorParamsId,
					'flavorId': asset.id
				};


				var src  = baseUrl + '/entryId/' + asset.entryId;

				// Check if Apple http streaming is enabled and the tags include applembr ( single stream HLS )
				if( asset.tags.indexOf('applembr') != -1 ) {
					src += '/format/applehttp/protocol/'+ protocol + '/a.m3u8';

					deviceSources.push({
						/* 'data-flavorid' : 'AppleMBR', */
						'type' : 'application/vnd.apple.mpegurl',
						'src' : src
					});

					continue;

				} else {
					src += '/flavorId/' + asset.id + '/format/url/protocol/https';
				}

				// add the file extension:
				if( asset.tags.toLowerCase().indexOf('ipad') != -1 ){
					source['src'] = src + '/a.mp4';
					/* source['data-flavorid'] = 'iPad'; */
					source['type'] = 'video/mp4';
				}

				// Check for iPhone src
				if( asset.tags.toLowerCase().indexOf('iphone') != -1 ){
					source['src'] = src + '/a.mp4';
					/* source['data-flavorid'] = 'iPhone'; */
					source['type'] = 'video/mp4';
				}

				// Any other ready MP4 flavor (e.g. the HD/720 and HD/1080 web flavors,
				// which carry no device tags). Which flavors are offered to the viewer
				// is decided by the player from the manifest (gvp_kaltura.flavors), so
				// adding a flavor never requires editing this file.
				if( ! source['src'] && asset.fileExt && asset.fileExt.toLowerCase() == 'mp4' ) {
					source['src'] = src + '/a.mp4';
					source['type'] = 'video/mp4';
				}

				// Check for ogg source
				if( asset.fileExt &&
					(
						asset.fileExt.toLowerCase() == 'ogg'
						||
						asset.fileExt.toLowerCase() == 'ogv'
						||
						( asset.containerFormat && asset.containerFormat.toLowerCase() == 'ogg' )
					)
				){
					source['src'] = src + '/a.ogg';
					/* source['data-flavorid'] = 'ogg'; */
					source['type'] = 'video/ogg';
				}

				// Check for webm source
				if( asset.fileExt == 'webm'
					||
					asset.tags.indexOf('webm') != -1
					|| // Kaltura transcodes give: 'matroska'
					( asset.containerFormat && asset.containerFormat.toLowerCase() == 'matroska' )
					|| // some ingestion systems give "webm"
					( asset.containerFormat && asset.containerFormat.toLowerCase() == 'webm' )
				){
					source['src'] = src + '/a.webm';
					/* source['data-flavorid'] = 'webm'; */
					source['type'] = 'video/webm';
				}

				// Check for 3gp source
				if( asset.fileExt == '3gp' ){
					source['src'] = src + '/a.3gp';
					/* source['data-flavorid'] = '3gp'; */
					source['type'] = 'video/3gp';
				}

				// Add the device sources
				if( source['src'] ){
					deviceSources.push( source );
				}

				// Check for adaptive compatible flavor:
				if( asset.tags.toLowerCase().indexOf('ipadnew') != -1 ){
					ipadAdaptiveFlavors.push( asset.id );
				}

				if( asset.tags.toLowerCase().indexOf('iphonenew') != -1 ){
					iphoneAdaptiveFlavors.push( asset.id );
				}

			};

			// Add the flavor list adaptive style urls ( multiple flavor HLS ):
			// Create iPad flavor for Akamai HTTP
			if( ipadAdaptiveFlavors.length != 0 ) {
				deviceSources.push({
					/* 'data-flavorid' : 'iPadNew', */
					'type' : 'application/vnd.apple.mpegurl',
					'src' : baseUrl + '/entryId/' + asset.entryId + '/flavorIds/' + ipadAdaptiveFlavors.join(',')  + '/format/applehttp/protocol/' + protocol + '/a.m3u8'
				});
			}

			// Create iPhone flavor for Akamai HTTP
			if(iphoneAdaptiveFlavors.length != 0 ) {
				deviceSources.push({
					/* 'data-flavorid' : 'iPhoneNew', */
					'type' : 'application/vnd.apple.mpegurl',
					'src' : baseUrl + '/entryId/' + asset.entryId + '/flavorIds/' + iphoneAdaptiveFlavors.join(',')  + '/format/applehttp/protocol/' + protocol + '/a.m3u8'
				});
			}

			// callback with device sources, poster
			if( settings.callback ){
				settings.callback({
					'poster': result[1]['thumbnailUrl'],
					'duration': result[1]['duration'],
					'name': result[1]['name'],
					'entryId' :  result[1]['id'],
					//'description': result[2]['description'],
                    //'captionId': ( ( result[2]['totalCount'] > 0 ) ? result[2]['objects'][0]['id'] : null ),
					'caption': ( ( result[2] && result[2]['totalCount'] > 0 ) ? result[2]['objects'] : null ),
					'sources': deviceSources
				});
				
			}

		});
	};
} )( window.kWidget );
