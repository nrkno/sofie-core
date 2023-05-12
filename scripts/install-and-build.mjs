import process from "process";
import concurrently from "concurrently";

const args = process.argv.slice(2);

const config = {
	uiOnly: args.indexOf("--ui-only") >= 0 || false,
	inspectMeteor: args.indexOf("--inspect-meteor") >= 0 || false,
};

try {
	// Install and build packages
	console.log("###################################");
	console.log("Installing dependencies...");
	console.log("###################################");

	await concurrently(
		[
			// Install meteor & Core dependencies
			{
				command: "yarn install:meteor",
				name: "METEOR-INSTALL",
				prefixColor: "red",
			},
			// Install packages depencencies
			{
				command: "yarn install:packages",
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

	console.log("#################################");
	console.log("Build packages...");
	console.log("#################################");

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
