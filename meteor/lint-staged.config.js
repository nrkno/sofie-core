const jsCssJsonMdScssCommands = ['prettier --write', 'git add']
const tsTsxCommands = ['npm run lintfix --', 'git add']

function chunkWrapAndRun(commands, fileNames) {
	const fileCount = fileNames.length
	let result = []
	for (var i = 0; i < fileCount; i = i + 10) {
		const chunk = fileNames.slice(i, i + 10)
		const wrappedAndJoined = chunk.map((fileName) => `"${fileName}"`).join(' ')
		result = result.concat(result.map((command) => `${command} ${wrappedAndJoined}`))
	}
	return result
}

module.exports = {
	'*.{js,css,json,md,scss}': (fileNames) => chunkWrapAndRun(jsCssJsonMdScssCommands, fileNames),
	'*.{ts,tsx}': (fileNames) => chunkWrapAndRun(tsTsxCommands, fileNames),
}
