/* *************************************************************************
 *
 * This script rewrites the package.json files of the packages in this mono-repo.
 * It changes the dependencies of internal packages from "link:../PACKAGE-NAME" to
 * use an absolute version instead, so that the published packages can be used externally.
 *
 *
 * **************************************************************************/
const fs = require('fs')
const fsp = fs.promises
const path = require('path')

const basePath = path.resolve('./packages')


;(async() => {

     // exists?
    if (!await exists(basePath)) throw new Error(`${basePath} does not exist`)

    const packages = []

    for (const dir of await fsp.readdir(basePath, { withFileTypes: true })) {
        if (!dir.isDirectory()) continue

        const dirPath = path.join(basePath, dir.name)
        const packagePath = path.join(dirPath, 'package.json')

        // exists?
        if (!await exists(packagePath)) continue

        packages.push({
            packagePath,
            package: require(packagePath)
        })
    }


    for (const p of packages) {

        let changed = false
        // Rewrite internal dependencies to target the correct version, so that it works when published to npm:
        for (const dep of Object.keys(p.package.dependencies)) {

            const foundPackage = packages.find(p => p.package.name === dep)
            if (foundPackage) {
                if (p.package.dependencies[dep] !== foundPackage.package.version) {
                    p.package.dependencies[dep] = foundPackage.package.version
                    changed = true
                }
            }
        }
        if (changed) {
            await fsp.writeFile(p.packagePath, JSON.stringify(p.package, null, '\t')+'\n')
            console.log(`Updated ${p.package.name}`)
        }
    }

    console.log(`Done`)
})().catch((err) => {
    console.error(err)
    process.exit(1)
})



async function exists(checkPath) {
    try {
        await fsp.access(checkPath, fs.constants.F_OK)
        return true
    } catch (err) {
        return false
    }
}
