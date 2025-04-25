import process from "process";
import fs from "fs";
import concurrently from "concurrently";
import { EXTRA_PACKAGES, config } from "./lib.js";

function joinCommand(...parts) {
	return parts.filter((part) => !!part).join(" ");
}

function watchPackages() {
	return [
		{
			command: joinCommand('yarn watch',
				config.uiOnly
					? EXTRA_PACKAGES.map((pkg) => `--ignore ${pkg}`).join(
						" "
					)
					: "",
			),
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
	const settingsFileExists = fs.existsSync("meteor-settings.json");
	if (settingsFileExists) {
		console.log('Found meteor-settings.json')
	} else {
		console.log('No meteor-settings.json')
	}

	return [
		{
			command: "yarn watch-types --preserveWatchOutput",
			cwd: "meteor",
			name: "METEOR-TSC",
			prefixColor: "blue",
		},
		{
			command: joinCommand(
				'yarn debug',
				config.inspectMeteor ? " --inspect" : "",
				config.verbose ? " --verbose" : "",
				settingsFileExists ? " --settings ../meteor-settings.json" : ""
			),
			cwd: "meteor",
			name: "METEOR",
			prefixColor: "cyan",
		},
		{
			command: `yarn dev`,
			cwd: "packages/webui",
			name: "VITE",
			prefixColor: "yellow",
		},
	];
}

function hr() {
	// write regular dashes if this is a "simple" output stream ()
	if (!process.stdout.hasColors || !process.stdout.hasColors())
		return "-".repeat(process.stdout.columns ?? 40);
	return "─".repeat(process.stdout.columns ?? 40);
}

try {
	// Note: This scricpt assumes that install-and-build.mjs has been run before

	// The main watching execution
	console.log(hr());
	console.log(" ⚙️  Starting up in development mode...         ");
	console.log(hr());
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
