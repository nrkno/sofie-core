const process = require('process');
const concurrently = require("concurrently");
const args = process.argv.slice(2);

const config = {
	uiOnly: (args.indexOf('--ui-only') >= 0) || false
}

function watchPackages() {
	return [
		{
			command: "yarn watch",
			cwd: "packages",
			name: "PACKAGES-TSC",
			prefixColor: 'red',
		}
	]
}

function watchWorker() {
	return [
		{
			command: "yarn watch-for-worker-changes",
			cwd: "packages",
			name: "WORKER-RESTART",
			prefixColor: 'green',
		}
	]
}

function watchMeteor() {
	return [
		{
			command: "meteor yarn watch-types -- --preserveWatchOutput",
			cwd: "meteor",
			name: "METEOR-TSC",
			prefixColor: 'blue',
		},
		{
			command: "meteor yarn debug",
			cwd: "meteor",
			name: "METEOR",
			prefixColor: 'cyan',
		}
	]
}

(async () => {
	// Pre-steps
	await concurrently(
		[
			{
				command: "yarn build:try || true",
				cwd: "packages",
				name: "PACKAGES-BUILD",
				prefixColor: 'yellow',
			},
		],
		{
			prefix: "name",
			killOthers: ["failure", "success"],
			restartTries: 1,
		}
	);

	// The main watching execution
	await concurrently(
		[
			...(config.uiOnly ? [] : watchPackages()),
			...(config.uiOnly ? [] : watchWorker()),
			...watchMeteor(),
		],
		{
			prefix: "name",
			killOthers: ["failure", "success"],
			restartTries: 0,
		}
	);
})();
