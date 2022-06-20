const fs = require('fs')
const path = require('path')
const lerna = require('../lerna.json')

/*
    This script is intended to be run before lerna sets a new relase and (pre-)publishes the packages.
    Due to Meteor not really supporting linked packages in the mono-repo, some of the packages need to
    depend on other packages using the "link:../package-name" syntax.

    This script will update the package.json files to use the absolute version instead, something that
    works when the packages are published.
*/


const basePath = path.resolve('.')

const folders = fs.readdirSync(basePath, { withFileTypes: true }).filter(dir => dir.isDirectory())

const packageNames = []

for (const folder of folders) {



    const packageJSONPath = path.join(basePath, folder.name, 'package.json')

    if (fs.existsSync(packageJSONPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJSONPath))
        packageNames.push(packageJson.name)
    }
}


// Change the dependency
for (const folder of folders) {
    const packageJSONPath = path.join(basePath, folder.name, 'package.json')

    if (fs.existsSync(packageJSONPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJSONPath))

        for (const dep of Object.keys(packageJson.dependencies) ) {

            if (packageNames.includes(dep)) {
                if (packageJson.dependencies[dep] !== lerna.version) {
                    console.log(`${packageJson.name}: ${dep}@${packageJson.dependencies[dep]} -> ${lerna.version}`)
                    packageJson.dependencies[dep] = lerna.version
                }
            }
        }
        fs.writeFileSync(packageJSONPath, JSON.stringify(packageJson, null, '\t')+'\n')
    }
}
