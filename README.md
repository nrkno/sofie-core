# tv-automation-server-core

*Note: This is a work in progress!*

This is the core application of the NRK News Automation system.

## Local development
First, install meteor:

* [Meteor Installation Guide](https://www.meteor.com/install)

Then, clone the repository and install all dependencies:

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