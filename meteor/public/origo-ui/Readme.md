# Origo design framework

The Origo design framework is a set of CSS files and some SVGs that comprises
the core design building blocks of the Origo applications. It's currently
powering Radioarkivet, and will soon be powering Potion as well.

## Getting started

Look below to learn how to pull down the repo, run the demo server (see below) and then hit
[the getting started tutorial](http://localhost:8666/styleguide/getting-started/).

## Local installation

VERSION is the tagged version you'd like to use, e.g. v7.8.0.

### Npm (preferred)

```sh
npm install --save @nrk/origo-design
```

Note: You'll need to be a registered stash-user or add a public ssh key to the repository for this to work (ie. send your public deploy ssh key to one of the team members)

### Bower

```sh
bower install --save ssh://git@stash.nrk.no:7999/origo/origo-design.git#VERSION
```

### Zip

```sh
wget https://stash.nrk.no/plugins/servlet/archive/projects/ORIGO/repos/origo-design?at=refs%2Fheads%2Fmaster
```

or

[download the zip-file here](https://stash.nrk.no/plugins/servlet/archive/projects/ORIGO/repos/origo-design?at=refs%2Fheads%2Fmaster)

## Consumption & integration

### Clean Build

The build script produces one compact CSS file in the dist directory. For
convenience, this directory is under source control. To update it:

```sh
npm run build
```

### Webpack

Install Origo using the NPM-approach above. Install webpack with sass and the extract-plugin, as well as some loaders

```
  npm install node-sass sass-loader webpack extract-text-webpack-plugin style-loader css-loader file-loader --save-dev
```

Somewhere inside your client scripts, load the styles - e.g. an entry point named `src/client/index.js`

```
// use standard require for loading scss as a module
require('@nrk/origo-design/styles/origo.scss');

// or ES6-style imports
import '@nrk/origo-design/styles/origo.scss';
```

And inside your webpack-config, you need to add the sass-loader and the file loader for the fonts

```
  var ExtractTextPlugin = require("extract-text-webpack-plugin");

  module.exports = {
    // ...
    plugins: [
      new ExtractTextPlugin("style.css", {
        allChunks: true
      })
    ],
    // ...
    rules: [
      // ...
      {
        test: /\.scss$/,
        use: [
          {loader: 'style-loader'},
          {loader: 'css-loader'},
          {
            loader: 'sass-loader',
            options: {
              includePaths: [path.join(__dirname, 'node_modules')]
            }
          }]
      },
      {
        test: /\.(eot|svg|ttf|woff|woff2)$/,
        include: /node_modules\/@nrk\/origo-design\/*/,
        loader: 'file-loader'
      }
    // ...
    ]
  }
```

To add your own styles, do something like this in your own .scss file:
```
$font-path: '../node_modules/@nrk/origo-design/fonts'; // relative to your style sheet
//$primary-color: #bada55; // variable overrides must be before origo-design import
@import '@nrk/origo-design/styles/origo';
// add your own stuff
```

### Browserify

TODO

### RequireJs

Since RequireJs is not able to conveniently load modules from node_modules, a different set of approaches may be use:

- Install using the Bower-approach. Point your link-tag to the dist-folder inside the bower-shared lib folder (eg. /(src|build|dist)/bower/origo-design/dist/origo.css). 
- Install using the NPM-approach. Build the sass files (using grunt, gulp or sass directly from package.json) and set the target folder inside your public files (src/build/dist).
- Install using either the bower- or the npm approach. Inline the css using the [text-plugin](https://github.com/requirejs/text)

## Docker installation

Make sure to add your private ssh key into the docker-container, before installing

```sh
# if running as another user than root, change /root/-path accordingly
RUN mkdir -p /root/.ssh
RUN ssh-keyscan -p 7999 stash.nrk.no >> /root/.ssh/known_hosts
ADD path/to/ssh-key/id_rsa /root/.ssh/id_rsa
RUN chmod g-w /root
RUN chmod 700 /root/.ssh
RUN chmod 600 /root/.ssh/id_rsa

# download dependencies after ss-keys has been setup
RUN npm install
```

## Documentation

The interactive styleguide show-cases everything the framework provides, and
includes some information on the underlying principles. It is currently being
hosted by [Radioarkivet](http://radioarkiv-dev.nrk.no/styleguide/), but a
permanent home for it is pending.

To view the styleguide locally:

```sh
npm run styleguide
```

### Styleguide

The styleguide is split up into sections, and all sections are listed in
`styleguide/sections`. The main html, `styleguide/index.html` is built
from the `styleguide/index.tpl.html` template with all the sections
inlined. The built `index.html` is kept in source control for convenience.

## Icons

The icons are defined in a single SVG-element created by `scripts/icons.js`. The SVG
element is created from the set of SVG files in `images/icons`, and the name of
the icon file (without the "svg_" prefix and ".svg" suffix) is used to map the name
of the icon.

### To update the icons

Copy the updated svg files (from the designer) into `images/icons` and run `grunt icons`.

Note: it is assumed that the icon designer keeps the icon file names consistent.

### Creating new releases

After your changes have been made and committed, you should define the new
version before pushing to the repository. [We use semver for versioning](http://semver.org/). In short the guidelines are:
> Given a version number MAJOR.MINOR.PATCH, increment the:
>
> MAJOR version when you make incompatible API changes,  
> MINOR version when you add functionality in a backwards-compatible manner, and  
> PATCH version when you make backwards-compatible bug fixes.

To increment one of these fields, use the command
```
npm version [major|minor|patch]
```
which will set the version number in package.json, commit the change and create a new tag, which can then be pushed. Remember to also push tags. 
