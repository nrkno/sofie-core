/* eslint-disable no-console */
import { rimraf } from "rimraf";

async function rimrafLog(command) {
	console.log("  " + command);
	return rimraf(command, {
		glob: true,
	});
}

// Check Nodejs version:
// (rimraf requires Node 16 or higher)
const m = process.versions.node.match(/^(\d+)\.(\d+)\.(\d+)$/);
if (parseInt(m[1]) < 16) {
	console.log("The reset script requires Node.js 16 or higher");
	process.exit(1);
}

console.log("Removing all artifacts...");

await rimrafLog("./meteor/.meteor/local");
await rimrafLog("./meteor/node_modules");
await rimrafLog("./meteor/coverage");

await rimrafLog("./packages/node_modules");
await rimrafLog("./packages/*/node_modules");
await rimrafLog("./packages/*/dist");

console.log(`...done!`);
console.log(`To install everything again, run "yarn install-and-build"`);
