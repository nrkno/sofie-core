// eslint-disable-next-line node/no-extraneous-import
import babelJest from 'babel-jest'

export default babelJest.default.createTransformer({
	plugins: ['@babel/plugin-transform-modules-commonjs'],
	babelrc: false,
	configFile: false,
})
