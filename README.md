# Sofie: The Modern TV News Studio Automation System (tv-automation-server-core)

This is the "Core" application of the [**Sofie** TV News Studio Automation System](https://github.com/nrkno/Sofie-TV-automation/).

The Core is a Meteor/Node.JS-based web server that serves the web-GUI:s as well as handling the business logic for the Sofie TV Automation system.

System documentation can be found here: [Sofie system documentation](https://sofie.gitbook.io/sofie-tv-automation/documentation).

# For developers

## Gettings started, local development

Follow these instructions to start up Sofie Core in development mode. (For production deploys, see [System documentation](https://sofie.gitbook.io/sofie-tv-automation/documentation/installation).)

### Prerequisites

- Install [Meteor](https://www.meteor.com/install)
- Install [Node.js](https://nodejs.org) 12
- Install [Yarn](https://yarnpkg.com)
- If on windows `npm install --global windows-build-tools`

### Quick-start:

```
git clone -b master https://github.com/nrkno/tv-automation-server-core.git
cd tv-automation-server-core
yarn start
```

### Slightly more detailed start:

1. Clone the repository (for development, it is recommended to base your work on the latest unstable release branch)

   `git clone -b releaseXYZ https://github.com/nrkno/tv-automation-server-core.git`

2. Go into the cloned directory

   `cd tv-automation-server-core`

3. Setup meteor and dependencies. (Before this, make sure your NODE_ENV environment variable is NOT set to "production"!)

   `yarn install`

4. Start development mode

   `yarn dev`

5. In another window, start the playout-gateway. You will need to manually restart this upon making changes

   `cd tv-automation-server-core/packages/playout-gateway`  
   `yarn buildstart`

If you make any changes to the libraries inside packages, you will need to run the typescript compiler in another terminal.  
 `cd tv-automation-server-core/packages`  
 `yarn watch` # or yarn build to build just once

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

## Version numbering scheme

This project does not follow semver. We believe that semver does not make sense for this system as there are so many moving parts that a majority of releases could be considered breaking in some way.

Instead of semver, the Major number gets incremented whenever we feel like Sofie has evolved enough to warrant the change. The minor number gets incremented for each iteration of the development cycle, with the digit matching the cycle number. The patch number gets incremented for patch releases as expected.

The version numbers of the blueprints-integration and server-core-integration libraries are tied to this, and as such they also do not follow semver currently. In future these may be decoupled.  
The api of server-core-integration is pretty stable and rarely undergoes any breaking changes, so is ok to be mismatched.
The api of blueprints-integration is rather volatile, and often has breaking changes. Because of this, we recommend matching the minor version of blueprints-integration with Sofie core. Sofie will warn if these do not match. We expect this to settle down in the future, and will review this decision when we feel it is worthwhile.

## Additional information

Background image used for previewing graphical elements is based on "Sunset over dark forest" by Aliis Sinisalu: https://unsplash.com/photos/8NiAH5YRZPs used under the [Unsplash License](https://unsplash.com/license).

---

_The NRK logo is a registered trademark of Norsk rikskringkasting AS. The license does not grant any right to use, in any way, any trademarks, service marks or logos of Norsk rikskringkasting AS._
