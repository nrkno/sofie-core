# Sofie: The Modern TV News Studio Automation System (tv-automation-server-core)

This is the core application of the [**Sofie** TV News Studio Automation System](https://github.com/nrkno/Sofie-TV-automation/).

System documentation can be found here: [Sofie system documentation](https://sofie.gitbook.io/sofie-tv-automation/documentation).

# For developers

## Gettings started, local development

Follow these instructions to start up Sofie Core in development mode. (For production deploys, see [System documentation](https://sofie.gitbook.io/sofie-tv-automation/documentation/installation).)

### Prerequisites

* Install [Meteor](https://www.meteor.com/install)
* Install [Node.js](https://nodejs.org)
* `npm install --global windows-build-tools`

### Quick-start:

```
git clone -b master https://github.com/nrkno/tv-automation-server-core.git
cd tv-automation-server-core/meteor
npm start
```

### Slightly more detailed start:

1. Clone the repository (for development, it is recommended to base your work on the latest unstable release branch)

    `git clone -b releaseXYZ https://github.com/nrkno/tv-automation-server-core.git`

2. Go into the meteor directory

    `cd tv-automation-server-core/meteor`

3. Trigger Meteor to install the right version

    `meteor --version`

4. Install the right dependencies. (Before this, make sure your NODE_ENV environment variable is NOT set to "production"!)

    `meteor npm install`

5. Start Meteor in development mode

    `meteor npm run dev`


If you run into any issues while installing the dependencies, clone any offending packages from Git and link them using `npm link`. For example, for `tv-automation-mos-connection` library:

```
git clone -b master https://github.com/nrkno/tv-automation-mos-connection.git
cd tv-automation-mos-connection
npm run build
npm link
cd ../tv-automation-server-core/meteor
npm link mos-connection
```

## Translating Sofie, add a new language

For support of various languages in the GUI, Sofie uses the i18next framework. It uses JSON-based translation files to store UI strings. In order to build a new translation file, first extract a PO template file from Sofie UI source code:

```
cd meteor
npm run i18n-extract-pot
```

Find the created `template.pot` file in `meteor/i18n` folder. Create a new PO file based on that template using a PO editor of your choice. Save it in the `meteor/i18n` folder using your [ISO 639-1 language code](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) of choice as the filename.

Next, modify the `package.json` scripts and create a new language compilations script:

```
"i18n-compile-json": "npm run i18n-compile-json-nb & npm run i18n-compile-json-sv & npm run i18n-compile-json-xx",
"i18n-compile-json-xx": "i18next-conv -l nb -s i18n/xx.po -t public/locales/xx/translations.json",
```

Then, run the compilation script:

```
npm run i18n-compile-json
```

The resulting JSON file will be placed in `meteor/public/locales/xx`, where it will be available to the Sofie UI for use and auto-detection.

Then submit this as a PR.

## Additional information

Background image used for previewing graphical elements is based on "Sunset over dark forest" by Aliis Sinisalu: https://unsplash.com/photos/8NiAH5YRZPs used under the [Unsplash License](https://unsplash.com/license).

---

*The NRK logo is a registered trademark of Norsk rikskringkasting AS. The license does not grant any right to use, in any way, any trademarks, service marks or logos of Norsk rikskringkasting AS.*

