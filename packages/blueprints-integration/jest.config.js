module.exports = {
	globals: {
		'ts-jest': {
			tsConfig: 'tsconfig.json',
		},
	},
	moduleFileExtensions: [
		'js',
		'ts',
	],
	transform: {
		'^.+\\.(ts|tsx)$': 'ts-jest',
	},
	testMatch: [
		'**/__tests__/**/*.spec.(ts|js)',
	],
	testPathIgnorePatterns: [
		'integrationTests',
	],
	testEnvironment: 'node',
	coverageThreshold: {
		global: {
			branches: 80,
			functions: 100,
			lines: 95,
			statements: 90,
		},
	},
	coverageDirectory: './coverage/',
	collectCoverage: true,
	preset: 'ts-jest',
}
