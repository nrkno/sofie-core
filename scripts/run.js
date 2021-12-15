const concurrently = require("concurrently");

(async () => {
	// Pre-steps
	await concurrently(
		[
			{
				command: "yarn build:packages",
				name: "PACKAGES-BUILD",
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
			{
				command: "yarn watch",
				cwd: "packages",
				name: "PACKAGES-TSC",
			},
			{
				command: "meteor npm run watch-types -- --preserveWatchOutput",
				cwd: "meteor",
				name: "METEOR-TSC",
			},
			{
				command: "meteor npm run debug",
				cwd: "meteor",
				name: "METEOR",
			},
		],
		{
			prefix: "name",
			killOthers: ["failure", "success"],
			restartTries: 1,
		}
	);
})();
