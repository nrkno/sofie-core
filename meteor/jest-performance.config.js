const commonConfig = {
	modulePaths: ['<rootDir>/node_modules/'],
	moduleNameMapper: {},
	unmockedModulePathPatterns: ['/^imports\\/.*\\.jsx?$/', '/^node_modules/'],
	globals: {
		'ts-jest': {
			tsConfig: 'tsconfig.json',
			babelConfig: {
				plugins: [
					'@babel/plugin-transform-modules-commonjs',
					// Fibers and await do not work well together. This transpiles await calls to something that works
					'meteor-babel/plugins/async-await.js',
				],
			},
			diagnostics: {
				ignoreCodes: ['TS151001'],
			},
		},
	},
	moduleFileExtensions: ['ts', 'js'],
	transform: {
		'^.+\\.(ts|tsx)$': 'ts-jest',
	},
	globalSetup: './__mocks__/global-setup.js',
	setupFilesAfterEnv: ['./__mocks__/_setupMocks.ts'],
	collectCoverage: false,
	watchPathIgnorePatterns: ['/.meteor/'],
}

module.exports = {
	projects: [
		Object.assign({}, commonConfig, {
			displayName: 'lib',
			testMatch: [
				'<rootDir>/lib/__tests-performance__/**/*.(spec|test).(ts|js)',
				'<rootDir>/lib/**/__tests-performance__/**/*.(spec|test).(ts|js)',
				'!.meteor/*.*',
			],
			testEnvironment: 'node',
		}),
		Object.assign({}, commonConfig, {
			displayName: 'server',
			testMatch: [
				'<rootDir>/server/__tests-performance__/**/*.(spec|test).(ts|js)',
				'<rootDir>/server/**/__tests-performance__/**/*.(spec|test).(ts|js)',
				'!.meteor/*.*',
			],
			testEnvironment: 'node',
		}),
	],
}
