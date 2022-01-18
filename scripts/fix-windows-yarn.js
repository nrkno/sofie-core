// this is expected to run from within `meteor`
const process = require('process')
const fs = require('fs')
var path = require('path')

function mkdirSyncIfNotExists(path) {
	if (fs.existsSync(path)) return
	fs.mkdirSync(path)
}

function copyFileSyncIfNotExists(source, target) {
	if (fs.existsSync(target)) return
	fs.copyFileSync(source, target)
}

function copyFileSync(source, target) {

	var targetFile = target

	// If target is a directory, a new file with the same name will be created
	if (fs.existsSync(target)) {
		if (fs.lstatSync(target).isDirectory()) {
			targetFile = path.join(target, path.basename(source))
		}
	}

	fs.copyFileSync(source, targetFile)
}

function copyFolderRecursiveSync(source, target) {
	var files = [];

	// Check if folder needs to be created or integrated
	var targetFolder = path.join(target, path.basename(source));
	if (!fs.existsSync(targetFolder)) {
		fs.mkdirSync(targetFolder)
	}

	// Copy
	if (fs.lstatSync(source).isDirectory()) {
		files = fs.readdirSync(source);
		files.forEach(function (file) {
			var curSource = path.join(source, file);
			if (fs.lstatSync(curSource).isDirectory()) {
				copyFolderRecursiveSync(curSource, targetFolder)
			} else {
				copyFileSync(curSource, targetFolder)
			}
		});
	}
}

// only run on Windows
if (process.platform !== 'win32') return

const files = ['yarn', 'yarn.cmd', 'yarnpkg', 'yarnpkg.cmd', 'yarn.js']

files.forEach((file) => {
	copyFileSyncIfNotExists(`.meteor/local/dev_bundle/node_modules/yarn/bin/${file}`, `.meteor/local/dev_bundle/bin/${file}`)
})

mkdirSyncIfNotExists('.meteor/local/dev_bundle/lib')
copyFolderRecursiveSync('.meteor/local/dev_bundle/node_modules/yarn/lib', '.meteor/local/dev_bundle')
