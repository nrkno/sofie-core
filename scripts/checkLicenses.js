console.log('Checking used licenses...');

// Legally only writes it's analysis to console and it's API has no way to reuse it,
// so we need to parse it's text output
console.write = console.log;
let consoleBuffer = ''
console.log = (...args) => {
	consoleBuffer += args.map(arg => `${arg }`).join(', ') + '\n';
	console.write(...args);
};
console.flush = () => {
	consoleBuffer = '';
};

const legally = require('../meteor/node_modules/legally');
const proc = require('process');

let done = false;
let exitCode = 0;
(function wait () {
	// the analysis is async as well, but run after the original legally() promise is already
	// resolved, so we need to make sure that the consoleBuffer already contains the Report
	// to be parsed
	if (!done || consoleBuffer.indexOf('Reports') === -1) {
		setTimeout(wait, 1000);
	} else {
		const m = consoleBuffer.match(/\s+([\d\.\,]+)\% of the dependencies are not/mi)
		if (!m) {
			console.error('Analysis for the licenses not found.');
			exitCode = 10;
		} else if (!m[1] || parseFloat(m[1]) > 0) {
			console.error('Unapproved licenses used.')
			exitCode = 20;
		}
		console.log = console.write;
		proc.exitCode = exitCode;
	}
})();

legally().then(() => {
	done = true;
}).catch((e) => {
	console.error(e);
	exitCode = 100;
	done = true;
});
