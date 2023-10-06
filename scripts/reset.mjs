/* eslint-disable no-console */
import rimraf from "rimraf";

console.log("Removing all artifacts...");

async function rimrafLog(command) {
	console.log("  " + command);
	return rimraf(command);
}

await rimrafLog("./meteor/.meteor/local");
await rimrafLog("./meteor/node_modules");
await rimrafLog("./meteor/coverage");

await rimrafLog("./packages/node_modules");
await rimrafLog("./packages/*/node_modules");
await rimrafLog("./packages/*/dist");

console.log(`...done!`);
console.log(`To install everything again, run "yarn start"`);
