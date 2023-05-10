import process from "process";
import concurrently from "concurrently";

const args = process.argv.slice(2);

const config = {
	uiOnly: args.indexOf("--ui-only") >= 0 || false,
	inspectMeteor: args.indexOf("--inspect-meteor") >= 0 || false,
};

function watchPackages() {
	return [
		{
			command: "yarn watch",
			cwd: "packages",
			name: "PACKAGES-TSC",
			prefixColor: "red",
		},
	];
}

function watchWorker() {
	return [
		{
			command: "yarn watch-for-worker-changes",
			cwd: "packages",
			name: "WORKER-RESTART",
			prefixColor: "green",
		},
	];
}

function watchMeteor() {
	return [
		{
			command: "meteor yarn watch-types --preserveWatchOutput",
			cwd: "meteor",
			name: "METEOR-TSC",
			prefixColor: "blue",
		},
		{
			command: "meteor yarn debug" + (config.inspectMeteor ? " --inspect" : ""),
			cwd: "meteor",
			name: "METEOR",
			prefixColor: "cyan",
		},
	];
}

try {
	// Pre-steps:
	{
		// Install and build packages
		console.log("###################################");
		console.log("Installing and building packages...");
		console.log("###################################");
		await concurrently(
			[
				{
					command: "yarn install",
					cwd: "packages",
					name: "PACKAGES-INSTALL",
					prefixColor: "yellow",
				},
			],
			{
				prefix: "name",
				killOthers: ["failure", "success"],
				restartTries: 1,
			}
		).result;
		await concurrently(
			[
				{
					command: "yarn build:try",
					cwd: "packages",
					name: "PACKAGES-BUILD",
					prefixColor: "yellow",
				},
			],
			{
				prefix: "name",
				killOthers: ["failure", "success"],
				restartTries: 1,
			}
		).result;
		console.log("#################################");
		console.log("Installing meteor dependencies...");
		console.log("#################################");
		await concurrently(
			[
				{
					command: "meteor yarn install",
					cwd: "meteor",
					name: "METEOR-INSTALL",
					prefixColor: "red",
				},
			],
			{
				prefix: "name",
				killOthers: ["failure", "success"],
				restartTries: 1,
			}
		).result;
	}

	// The main watching execution
	console.log("#################################");
	console.log("          Starting up...         ");
	console.log("#################################");
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
	).result;
} catch (e) {
	console.error(e.message);
	process.exit(1);
}

function signalHandler(signal) {
	process.exit();
}

// Make sure to exit on interupt
process.on("SIGINT", signalHandler);
process.on("SIGTERM", signalHandler);
process.on("SIGQUIT", signalHandler);
