# Sofie: The Modern TV News Studio Automation System (Sofie Core)

This is the "Core" application of the [**Sofie** TV News Studio Automation System](https://github.com/nrkno/Sofie-TV-automation/).

The Core is a Meteor/Node.JS-based web server that serves the web-GUIs as well as handling the business logic for the Sofie TV Automation system.

System documentation can be found here: [Sofie system documentation](https://nrkno.github.io/sofie-core/).

# For developers

## Gettings started, local development

Follow these instructions to start up Sofie Core in development mode. (For production deploys, see [System documentation](https://sofie.gitbook.io/sofie-tv-automation/documentation/installation).)

### Prerequisites

- Install [Node.js](https://nodejs.org) 16 (14 will also work) (using [nvm](https://github.com/nvm-sh/nvm) or [nvm-windows](https://github.com/coreybutler/nvm-windows) is the recommended way to install Node.js)
- If on Windows: `npm install --global windows-build-tools`
- Install [Meteor](https://www.meteor.com/install) (`npm install --global meteor`)
- Install [Yarn](https://yarnpkg.com) (`npm install --global corepack && corepack enable`)

### Quick-start:

```bash
git clone -b master https://github.com/nrkno/sofie-core.git
cd sofie-core
yarn install-and-build
yarn start
```

> 💡 First startup may take a while, especially on Windows. To speed things up, consider adding `%LOCALAPPDATA%\.meteor` and the directory where you cloned `server-core` to your Windows Defender virus protection exclusions.

### Slightly more detailed start:

1. Clone the repository (for development, it is recommended to base your work on the latest unstable release branch)

   ```bash
   git clone -b releaseXYZ https://github.com/nrkno/sofie-core.git
   ```

2. Go into the cloned directory

   ```bash
   cd sofie-core
   ```

3. Setup meteor and dependencies. (Before this, make sure your NODE_ENV environment variable is NOT set to "production"!)

   ```bash
   yarn install
   ```

4. Start development mode

   ```bash
   yarn dev
   ```

5. In another window, start the playout-gateway. You will need to manually restart this upon making changes

   ```bash
   cd sofie-core/packages/playout-gateway
   yarn buildstart
   ```

### Lowering memory, CPU footprint in development

If you find yourself in a situation where running Sofie in development mode is too heavy, but you're not planning on modifying any of the low-level packages in the `packages` directory, you may want to run Sofie in the _UI-only mode_, in which only meteor will be rebuilt and type-checked on modification:

```bash
yarn dev --ui-only
```

### When using the Visual Studio Code IDE

We provide a `settings.json.default` file in `.vscode` that you should consider using with your IDE. Also consider installing suggested
extensions, which should help you create PRs consistent with project's code standards.

### Attaching a NodeJS debugger to the Meteor process

You can connect a debugging client to Meteor's Node process on port `9229`. In order for that to be possible, enable the `--inspect-meteor` mode:

```bash
yarn dev --inspect-meteor
```

### Dealing with strange errors

If you get any strange errors (such as the application crashing, "Unable to resolve some modules" or errors during installation of dependencies), the last resort is to reset and restart:

```bash
yarn reset # Removes all installed dependencies and build artifacts
yarn install # Install main dependencies
yarn start # Set up, install and run in dev mode
```

## Translating Sofie, adding a new language

For support of various languages in the GUI, Sofie uses the i18next framework. It uses JSON-based translation files to store UI strings. In order to build a new translation file, first extract a PO template file from Sofie UI source code:

```bash
cd meteor
yarn i18n-extract-pot
```

Find the created `template.pot` file in `meteor/i18n` folder. Create a new PO file based on that template using a PO editor of your choice. Save it in the `meteor/i18n` folder using your [ISO 639-1 language code](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) of choice as the filename.

Then, run the compilation script:

```bash
yarn i18n-compile-json
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
