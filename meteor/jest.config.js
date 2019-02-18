module.exports = {
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
	testMatch: [
		'**/__tests__/**/*.(spec|test).(ts|js)'
	],
	testEnvironment: 'node',
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
		"**/*.{js,ts}",
		"!**/*.{tsx}",
		"!**/client/main.js",
	],
	collectCoverage: true
}
