import { buildDepTreeFromFiles } from "snyk-nodejs-lockfile-parser";

/**
 * These are the libs we want to consider.
 * Its an array of arrays, to allow for multiple names to be treated as one package
 */
const libsToConsider = [
	["superfly-timeline"],
	["mos-connection"],
	["timeline-state-resolver", "timeline-state-resolver-types"],
];

const allDepVersions = new Map();

async function addDepsForRoot(root, subdir) {
	const tree = await buildDepTreeFromFiles(
			root,
			subdir ? `${subdir}/package.json` : "package.json",
			"yarn.lock",
			true,
			false
		);

	function flattenAndAddDeps(node) {
		let entry = allDepVersions.get(node.name);
		if (!entry) {
			entry = new Set();
			allDepVersions.set(node.name, entry);
		}

		if (!entry.has(node.version)) {
			entry.add(node.version);

			if (node.dependencies) {
				for (const obj of Object.values(node.dependencies)) {
					flattenAndAddDeps(obj);
				}
			}
		}
	}

	flattenAndAddDeps(tree);
}

// Scan each project, that we are interested in.
// Future: This could be made smarter in searching
await addDepsForRoot("./meteor");
await addDepsForRoot("./packages");
await addDepsForRoot("./packages", "blueprints-integration");
await addDepsForRoot("./packages", "server-core-integration");
await addDepsForRoot("./packages", "mos-gateway");
await addDepsForRoot("./packages", "corelib");
await addDepsForRoot("./packages", "job-worker");
await addDepsForRoot("./packages", "playout-gateway");

let hasFailure = false;

// check each library
for (const libName of libsToConsider) {
	const allVersions = new Set();
	const nameStr = libName.join("/");
	for (const name of libName) {
		// get the versions of each library 'alias', and add them to the combined list
		const more = allDepVersions.get(name);
		if (more) {
			more.forEach((v) => allVersions.add(v));
		}
	}

	// output some info
	const str = Array.from(allVersions).join(", ");
	if (allVersions.size === 0) {
		console.log(`No versions of "${nameStr}" installed`);
	} else if (allVersions.size === 1) {
		console.log(`Single version of "${nameStr}" installed: ${str}`);
	} else {
		console.error(`Multiple versions of "${nameStr}" installed: ${str}`);
		hasFailure = true;
	}
}

process.exit(hasFailure ? 1 : 0);
