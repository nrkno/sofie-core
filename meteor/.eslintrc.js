const commonRules = {
	'prettier/prettier': 'error',
	'no-unused-vars': 'off',
	'no-extra-semi': 'off',
	'node/no-unsupported-features/es-syntax': ['error', { ignores: ['modules'] }],
	'no-use-before-define': 'off',
}
const tmpRules = {
	// tmp to remove before commit
	'prefer-const': 'off',
	'@typescript-eslint/no-unused-vars': 'off',
	'@typescript-eslint/no-var-requires': 'off',
	'@typescript-eslint/no-empty-function': 'off',
	'@typescript-eslint/no-inferrable-types': 'off',
	'@typescript-eslint/ban-ts-comment': 'off',
	'no-useless-escape': 'off',
	'@typescript-eslint/no-non-null-assertion': 'off',
	'no-var': 'off',
}

const tsBase = {
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/eslint-recommended',
		'plugin:@typescript-eslint/recommended',
		'plugin:node/recommended',
		'prettier',
		'plugin:prettier/recommended',
		'plugin:custom-rules/all',
	],
	plugins: ['@typescript-eslint', 'prettier'],
	parser: '@typescript-eslint/parser',
	parserOptions: { project: './tsconfig.json' },
	settings: {
		node: {
			tryExtensions: ['.js', '.json', '.node', '.ts', '.tsx', '.d.ts'],
		},
	},
	rules: {
		...commonRules,
		'@typescript-eslint/no-explicit-any': 'off',
		'@typescript-eslint/interface-name-prefix': 'off',
		'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
		'@typescript-eslint/no-floating-promises': 'error',
		// custom
		'no-inner-declarations': 'off', // some functions are unexported and placed inside a namespace next to related ones
		'node/no-missing-import': [
			'error',
			{
				allowModules: ['meteor', 'mongodb'],
				tryExtensions: ['.js', '.json', '.node', '.ts', '.tsx', '.d.ts'],
			},
		],
		'@typescript-eslint/ban-types': 'off',
		'@typescript-eslint/explicit-module-boundary-types': 'off',
		'@typescript-eslint/no-namespace': 'off',
		...tmpRules,
	},
}

module.exports = {
	extends: [
		'eslint:recommended',
		'plugin:node/recommended',
		'plugin:prettier/recommended',
		'plugin:react/recommended',
	],
	plugins: ['prettier'],
	rules: {
		'prettier/prettier': 'error',
	},
	env: { es2017: true },
	parserOptions: { sourceType: 'module', ecmaVersion: 2018 },
	settings: {
		react: {
			version: 'detect', // Tells eslint-plugin-react to automatically detect the version of React to use
		},
	},
	overrides: [
		// Note: these replace the values defined above, so make sure to extend them if they are needed
		{
			files: ['*.ts'],
			...tsBase,
		},
		{
			files: ['*.tsx'],
			...tsBase,
			extends: [...tsBase.extends, 'plugin:react/recommended'],
			parserOptions: {
				...tsBase.parserOptions,
				ecmaFeatures: {
					jsx: true, // Allows for the parsing of JSX
				},
			},
			rules: {
				...tsBase.rules,
				'node/no-extraneous-import': 'off', // because there are a lot of them as dev-dependencies
				'node/no-missing-import': 'off', // erroring on every single import
				'react/prop-types': 'off', // we don't use this
				'@typescript-eslint/no-empty-interface': 'off', // many prop/state types are {}
			},
		},
		{
			files: ['*.js'],
			settings: {
				node: {
					tryExtensions: ['.js', '.json', '.node', '.ts', '.tsx'],
				},
			},
			rules: {
				...commonRules,
				...tmpRules,
			},
		},
		{
			files: ['**/__tests__/**/*.ts', '**/__mocks__/**/*.ts'],
			env: {
				jest: true,
			},
			rules: {
				'prettier/prettier': 'error',
				'@typescript-eslint/ban-ts-ignore': 'off',
				'@typescript-eslint/ban-ts-comment': 'off',
				'no-use-before-define': 'off',
				// custom
				'node/no-unpublished-import': 'off',
				'@typescript-eslint/no-non-null-assertion': 'off',
			},
		},
		{
			files: ['examples/**/*.ts'],
			rules: {
				'prettier/prettier': 'error',
				'no-process-exit': 'off',
				'node/no-missing-import': 'off',
			},
		},
	],
}
