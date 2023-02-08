const { promisify } = require('util')
const glob = require('glob')
const { spawn } = require('child_process')

const pGlob = promisify(glob)

/*************************************************

This script goes through all of the languages (.po files)
and compiles the json-files (used in production).

**************************************************/

;(async () => {
	// List all po-files:
	const poFiles = await pGlob('./i18n/*.po')

	const languages = []
	for (const poFile of poFiles) {
		const mLanguage = poFile.match(/\/(\w+)\.po/)
		if (mLanguage) languages.push(mLanguage[1])
	}

	console.log(`Found languages: ${languages.join(', ')}`)

	for (const lng of languages) {
		await runCmd(
			`i18next-conv -l ${lng} -s i18n/${lng}.po -t public/locales/${lng}/translations.json --skipUntranslated`
		)
	}
})().catch((e) => console.error(`ERROR: ${e}`))

function runCmd(cmd) {
	console.log(cmd)
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, {
			shell: true,
			windowsHide: true,
		})
		child.stdout.on('data', (data) => {
			console.log(`${data}`.trim())
		})
		child.stderr.on('data', (data) => {
			console.error(`${data}`.trim())
		})
		child.on('close', (code) => {
			if (code === 0) resolve()
			else reject(new Error(`child process exited with code ${code}`))
		})
	})
}
