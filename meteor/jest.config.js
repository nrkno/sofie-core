const commonConfig = {
	modulePaths: [
		'<rootDir>/node_modules/',
		'<rootDir>/node_modules/jest-meteor-stubs/lib/',
	],
	moduleNameMapper: {
	},
	unmockedModulePathPatterns: [
		'/^imports\\/.*\\.jsx?$/',
		'/^node_modules/'
	],
	globals: {
		'ts-jest': {
			tsConfig: 'tsconfig.json',
			diagnostics: {
				ignoreCodes: [
					'TS151001'
				]
			}
		}
	},
	moduleFileExtensions: [
		'ts',
		'js'
	],
	transform: {
		'^.+\\.(ts|tsx)$': 'ts-jest'
	},
	setupFilesAfterEnv: ['./__mocks__/_setupMocks.ts'],
	coverageThreshold: {
		global: {
			branches: 0,
			functions: 0,
			lines: 0,
			statements: 0
		}
	},
	coverageDirectory: "./.coverage/",
	collectCoverageFrom: [
		"server/**/*.{js,ts}",
		"lib/**/*.{js,ts}",
		"client/**/*.{js,ts}",
		"!**/*.{tsx}",
		"!**/client/main.js",
		"!.meteor/**/*.*",
		"!**/__tests__/**",
		"!**/__mocks__/**",
		'!**/node_modules/**'
	],
	collectCoverage: false,
	watchPathIgnorePatterns: [
		'/.meteor/'
	]
}

module.exports = {
	projects: [
		Object.assign({}, commonConfig, {
			displayName: 'client',
			testMatch: [
				'<rootDir>/client/__tests__/**/*.(spec|test).(ts|js)',
				'<rootDir>/client/**/__tests__/**/*.(spec|test).(ts|js)',
				'!.meteor/*.*'
			],
			testEnvironment: 'jsdom'
		}), Object.assign({}, commonConfig, {
			displayName: 'lib',
			testMatch: [
				'<rootDir>/lib/__tests__/**/*.(spec|test).(ts|js)',
				'<rootDir>/lib/**/__tests__/**/*.(spec|test).(ts|js)',
				'!.meteor/*.*'
			],
			testEnvironment: 'node'
		}), Object.assign({}, commonConfig, {
			displayName: 'server',
			testMatch: [
				'<rootDir>/server/__tests__/**/*.(spec|test).(ts|js)',
				'<rootDir>/server/**/__tests__/**/*.(spec|test).(ts|js)',
				'!.meteor/*.*'
			],
			testEnvironment: 'node'
		})
	]
}
