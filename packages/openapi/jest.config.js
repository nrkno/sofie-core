module.exports = {
	globals: {
		'ts-jest': {
			tsconfig: 'tsconfig.json',
		},
	},
	moduleFileExtensions: ['js', 'ts'],
	transform: {
		'^.+\\.(ts|tsx)$': 'ts-jest',
	},
	testMatch: ['**/__tests__/**/*.spec.(ts|js)'],
	testEnvironment: 'node',
	testResultsProcessor: 'jest-teamcity-reporter',
	coverageThreshold: {
		global: {
			branches: 0,
			functions: 0,
			lines: 0,
			statements: 0,
		},
	},
	coveragePathIgnorePatterns: ['client/ts/index.ts', 'client/ts/runtime.ts', 'client/ts/models'],
	coverageDirectory: './coverage/',
	collectCoverage: true,
	preset: 'ts-jest',
}
