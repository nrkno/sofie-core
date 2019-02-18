module.exports = {
	modulePaths: [
		'<rootDir>/node_modules/',
		'<rootDir>/node_modules/jest-meteor-stubs/lib/',
	],
	moduleNameMapper: {
		'^(.*):(.*)$': '$1_$2',
	},
	unmockedModulePathPatterns: [
		'/^imports\\/.*\\.jsx?$/',
		'/^node_modules/',
	],

	globals: {
		'ts-jest': {
			tsConfigFile: 'tsconfig.json'
		}
	},
	moduleFileExtensions: [
		'ts',
		'js'
	],
	transform: {
		'^.+\\.(ts|tsx)$': './node_modules/ts-jest/preprocessor.js'
	},
	testMatch: [
		'**/*.test.(ts|js)'
	],
	testEnvironment: 'node'
}
