module.exports = {
	globals: {
		'ts-jest': {
			tsConfig: 'tsconfig.json'
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
		'**/integrationTests/**/*.spec.(ts|js)'
	],
	testEnvironment: 'node',
	coverageThreshold: {
		"global": {
		  "branches": 100,
		  "functions": 100,
		  "lines": 100,
		  "statements": 100
		}
	  }
};