# Version Change Log

**4.0.12**
* Updated VideoJS to version 7.17.0
* Added a workaround for YouTube video not playing in embedded-iframe in Chromium-based web browser.

**4.0.11**
* Removed codes to get available captions from YouTube directly. Google shut down this API service as of December 2021.
* Added support for local caption file for YouTube
* Added an optional new tag in xml to specify caption language and code

**4.0.10**
* Updated SCSS to use DartSass instead of Compass
* Seeked event is now only send to Google Analytics if greater than 0

**4.0.9**
* Now supports multiple caption tracks
* Added more player event trackings for Google Analytics

**4.0.8**
* Removed Kaltura HTML5 Library
* Updated Kaltura configuration in manifest file
* Implemented Kaltura sources request by calling API script by UWSS
* Video now plays inline on mobile devices
* Fixed an issue where missing Kaltura caption crashed the player

**4.0.7**
* Added an optional `author` tag in the XML to hold author name and will attempt to use author name specified in the centralized author profile.
* Marker text are now optional. Tooltip will not be shown if there is no marker texts.
* Updated VideoJS library to version 7.6.6
* Now sends play reached 25%, 50%, and 75%, entered full screen, exited full screen, seeked, replayed, and transcript download events to Kaltura Analytics
* Now sends page view and playback rate change events to Google Analytics.

**4.0.6**
* Updated Skip Forward and Backward icons.

**4.0.5**
* Force 16:9 aspect ratio
* Updated manifest to get program theme and copyright info from centralized `themes.json` file

**4.0.4**
* Hide title bar in iframe embedded mode

**4.0.3**
* Added a download file button to the splash screen and updated colors (#33)
* Fixed an issue where other downloadable files are not recognized
* Added GET requests to Kaltura Analytics for play, impression, and reached 100% event
* Fixed Kaltura video download file name
* Updated player playback control bar appearance
* Fixed an issue where the replay screen is not showing on video ended

**4.0.2**
* Fixed an issue where embedded is not working outside of SB+ presentation

**4.0.1**
* Fixed CSS issues when embedded inside a Storybook Plus presentation
* Full screen button is removed when embedded inside a Storybook Plus presentation
* Download button is removed when embedded inside a Storybook Plus presentation
* Minor code adjustments for embedding in Storybook Plus presentation
* Video less than one minute will not have skip forward and backward buttons
* Minor fixes and updates

**4.0.0**
* New manifest file to hold global settings and access shared centralized resources
* Removed jQuery dependency
* Rewrote core script
* Updated program themes
* New index.html file
* New program themes can be specified in manifest file and recognized by player automatically
* New file download format can be specified in manifest file and recognized by player automatically
* Updated VideoJS to version 6.6.2
* Removed intro videos
* Download file links are now part of the player controls a download list button
* Kaltura video download are now download as a file rather than opening a new browser tab/window
* Replaced kaltura.txt with gvp.xml file
* New Feature: Markers (and ability to change individual marker color)
* New Feature: YouTube video support (including caption)
* New "Feature": Embed as an HTML page type in Storybook+
* New Feature: Start and End URL string query
* New Feature: Skip forward and backward buttons on player controls (seconds to skip depends on the length of the video)

**3.3.3** (02-04-2016)  
* Added DS program logo
* Updated Kaltura API to version 2.36
* Updated VideoJS to version 5.5.3
* Added new URL query parameter: autoplay
* Updated jQuery to version 2.2.0

**3.3.2** (03-09-2015)  
* Added HTML5 download attribute to download links

**3.3.1** (03-06-2015)  
* Fixed the Kaltura download video

**3.3.0** (02-03-2015)  
* Updated jQuery to version 2.1.3
* Updated VideoJS to version 4.11.4
* Add Kaltura integration
* Refactored download files function

**3.2.4** (12-10-2014)  
* Updated VideoJS to version 4.11.1, which resolved source not found issue on Firefox.

**3.2.3** (11-20-2014)  
* Updated to work with the new media web server
* index.html filed updated

**3.2.2** (11-03-2014)  
* Updated [video.js](https://github.com/videojs/video.js) CSS to version 4.10.0

**3.2.1** (10-31-2014)  
* Updated [video.js](https://github.com/videojs/video.js) to version 4.10.2
* Converted CSS to SCSS
* Combined all program themes into one SCSS file
