# tv-automation-server-core

*Note: This is a work in progress!*

This is the core application of the NRK News Automation system.

## Local development
First, install meteor:

* [Meteor Installation Guide](https://www.meteor.com/install)

Then, clone the repository and install all dependencies:
(Make sure your NODE_ENV is NOT set to production!)

```
git clone https://github.com/nrkno/tv-automation-server-core.git
cd tv-automation-server-core
meteor npm install
meteor
```

If you run into any issues while installing the dependencies, clone any offending packages from Git and link them using `npm link`. For exmaple, for `tv-automation-mos-connection` library:

```
git clone https://github.com/nrkno/tv-automation-mos-connection.git
cd tv-automation-mos-connection
npm run build
npm link
cd ../tv-automation-server-core/meteor
npm link mos-connection
```

## System settings

In order for the system to work properly, it may be neccessary to set up several system properties. These can be set through environement variables - if not present, default values will be used.

|Setting         |Use                                                       |Default value      |
|----------------|----------------------------------------------------------|-------------------|
|`NTP_SERVERS`   |Comma separated list of time servers to sync the system to|`0.se.pool.ntp.org`|
|`FRAME_RATE`    |Framerate to be used when displaying time with frame accuracy|`25`            |
|`MEDIA_PREVIEW_SERVICE`|User-facing web service providing media file thumbnails and previews|`http://localhost:9010/mediaPreview/`|


---

*The NRK logo is a registered trademark of Norsk rikskringkasting AS. The license does not grant any right to use, in any way, any trademarks, service marks or logos of Norsk rikskringkasting AS.*