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
	// Note: This scricpt assumes that install-and-build.mjs has been run before

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
