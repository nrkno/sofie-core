const concurrently = require("concurrently");

(async () => {
	// Pre-steps
	await concurrently(
		[
			{
				command: "yarn build:try || true",
				cwd: "packages",
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
				command: "yarn watch-for-worker-changes",
				cwd: "packages",
				name: "WORKER-RESTART",
			},
			{
				command: "meteor yarn watch-types -- --preserveWatchOutput",
				cwd: "meteor",
				name: "METEOR-TSC",
			},
			{
				command: "meteor yarn debug",
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
