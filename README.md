# Sofie: The Modern TV News Studio Automation System (tv-automation-server-core)

This is the core application of the [**Sofie** TV News Studio Automation System](https://github.com/nrkno/Sofie-TV-automation/).


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


## Additional views

For the purpose of running the system in a studio environment, there are additional endpoints, unavailable from the menu structure.

|Path     |Function     |
|---------|-------------|
|`/countdowns/:studioId/presenter`|Countdown clocks for a given studio, to be shown to the studio presenter|
|`/activeRo/:studioId`|Redirects to the running order currently active in a given studio|
|`/prompter/:studioId`|A simple prompter for the studio presenter|

## Studio mode

In general, you will want to limit the amount of client stations that have full control of the studio (such as activating running orders, taking segment lines, ad-libbing, etc.). In order to mark a given client station (browser) as a Studio Control station, you should append `?studio=1` to any query string, for example:

```http://localhost:3000/?studio=1```

This setting is persisted in browser's Local Storage. To disable studio mode in a given client, append `?studio=0`.

## Configuration mode

In the default mode, the Settings page will be unavailable from main navigation. If you want access to the Settings page on a given client station, append `?configure=1` to any query string.

```http://localhost:3000/?configure=1```

## Developer mode

In developer mode, right click is not disabled

```http://localhost:3000/?dvelop=1```

## Language selection

The UI will automatically detect user browser's default matching and select the best match, falling back to english. You can also force the UI language to any language by navigating to a page with `?lng=xx` query string, for example:

```http://localhost:3000/?lng=xx```

This choice is persisted in browser's Local Storage, and the same language will be used until a new forced language is chosen using this method.

## Operating the prompter screen

The prompter can be operated using pressing & holding keyboard arrow keys: `Up` & `Down`. Press `Home` to enable auto-scroll mode. `Shift+Up` and `Shift+Down` scrolls in 3x speed. If the studio setup requries a mirrored-image prompter, you can append `?mirror=1` to enable mirror mode. This setting is not persisted in browser. 

## Translating Sofie

For support of various languages in the User Interface, Sofie uses the i18next framework. It uses JSON-based translation files to store UI strings. In order to build a new translation file, first extract a PO template file from Sofie UI source code:

```
cd meteor
npm run i18n-extract-pot
```

Find the created `template.pot` file in `meteor/i18n` folder. Create a new PO file based on that template using a PO editor of your choice. Save it in the `meteor/i18n` folder using your ISO 639-1 language code of choice as the filename.

Next, modify the `package.json` scripts and create a new language compilations script:

```
"i18n-compile-json": "npm run i18n-compile-json-nb & npm run i18n-compile-json-sv & npm run i18n-compile-json-xx",
"i18n-compile-json-xx": "i18next-conv -l nb -s i18n/xx.po -t public/locales/xx/translations.json",
```

Then, run the compillation script:

```npm run i18n-compile-json```

The resulting JSON file will be placed in `meteor/public/locales/xx`, where it will be available to the Sofie UI for use and autodetection.

---

*The NRK logo is a registered trademark of Norsk rikskringkasting AS. The license does not grant any right to use, in any way, any trademarks, service marks or logos of Norsk rikskringkasting AS.*
