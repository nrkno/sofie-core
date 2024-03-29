/* eslint-disable */

// XXX docs

// Things we explicitly do NOT support:
//    - heterogenous arrays

const { Meteor } = require('meteor/meteor')
const util = require('util')

Meteor.makeErrorType = function (name, constructor) {
	var errorClass = function (/*arguments*/) {
		// Ensure we get a proper stack trace in most Javascript environments
		if (Error.captureStackTrace) {
			// V8 environments (Chrome and Node.js)
			Error.captureStackTrace(this, errorClass)
		} else {
			// Borrow the .stack property of a native Error object.
			this.stack = new Error().stack
		}
		// Safari magically works.

		constructor.apply(this, arguments)

		this.errorType = name
	}

	util.inherits(errorClass, Error)

	return errorClass
}

// var currentArgumentChecker = new Meteor.EnvironmentVariable;
var isPlainObject = require('./isPlainObject.js').isPlainObject
var hasOwn = Object.prototype.hasOwnProperty

/**
 * @summary Check that a value matches a [pattern](#matchpatterns).
 * If the value does not match the pattern, throw a `Match.Error`.
 *
 * Particularly useful to assert that arguments to a function have the right
 * types and structure.
 * @locus Anywhere
 * @param {Any} value The value to check
 * @param {MatchPattern} pattern The pattern to match
 * `value` against
 */
function check(value, pattern) {
	// Record that check got called, if somebody cared.
	//
	// We use getOrNullIfOutsideFiber so that it's OK to call check()
	// from non-Fiber server contexts; the downside is that if you forget to
	// bindEnvironment on some random callback in your method/publisher,
	// it might not find the argumentChecker and you'll get an error about
	// not checking an argument that it looks like you're checking (instead
	// of just getting a "Node code must run in a Fiber" error).
	//   var argChecker = currentArgumentChecker.getOrNullIfOutsideFiber();
	//   if (argChecker)
	//     argChecker.checking(value);
	var result = testSubtree(value, pattern)
	if (result) {
		var err = new Match.Error(result.message)
		if (result.path) {
			err.message += ' in field ' + result.path
			err.path = result.path
		}
		throw err
	}
}

/**
 * @namespace Match
 * @summary The namespace for all Match types and methods.
 */
const Match = {
	Optional: function (pattern) {
		return new Optional(pattern)
	},
	Maybe: function (pattern) {
		return new Maybe(pattern)
	},
	OneOf: function (...args) {
		return new OneOf(args)
	},
	Any: ['__any__'],
	Where: function (condition) {
		return new Where(condition)
	},
	ObjectIncluding: function (pattern) {
		return new ObjectIncluding(pattern)
	},
	ObjectWithValues: function (pattern) {
		return new ObjectWithValues(pattern)
	},
	// Matches only signed 32-bit integers
	Integer: ['__integer__'],

	// XXX matchers should know how to describe themselves for errors
	Error: Meteor.makeErrorType('Match.Error', function (msg) {
		this.message = 'Match error: ' + msg
		// The path of the value that failed to match. Initially empty, this gets
		// populated by catching and rethrowing the exception as it goes back up the
		// stack.
		// E.g.: "vals[3].entity.created"
		this.path = ''
		// If this gets sent over DDP, don't give full internal details but at least
		// provide something better than 500 Internal server error.
		this.sanitizedError = new Meteor.Error(400, 'Match failed')
	}),

	// Tests to see if value matches pattern. Unlike check, it merely returns true
	// or false (unless an error other than Match.Error was thrown). It does not
	// interact with _failIfArgumentsAreNotAllChecked.
	// XXX maybe also implement a Match.match which returns more information about
	//     failures but without using exception handling or doing what check()
	//     does with _failIfArgumentsAreNotAllChecked and Meteor.Error conversion

	/**
	 * @summary Returns true if the value matches the pattern.
	 * @locus Anywhere
	 * @param {Any} value The value to check
	 * @param {MatchPattern} pattern The pattern to match `value` against
	 */
	test(value, pattern) {
		return !testSubtree(value, pattern)
	},

	// Runs `f.apply(context, args)`. If check() is not called on every element of
	// `args` (either directly or in the first level of an array), throws an error
	// (using `description` in the message).
	//
	_failIfArgumentsAreNotAllChecked(f, context, args, description) {
		var argChecker = new ArgumentChecker(args, description)
		var result = currentArgumentChecker.withValue(argChecker, function () {
			return f.apply(context, args)
		})
		// If f didn't itself throw, make sure it checked all of its arguments.
		argChecker.throwUnlessAllArgumentsHaveBeenChecked()
		return result
	},
}

class Optional {
	constructor(pattern) {
		this.pattern = pattern
	}
}

class Maybe {
	constructor(pattern) {
		this.pattern = pattern
	}
}

class OneOf {
	constructor(choices) {
		if (!choices || choices.length === 0) throw new Error('Must provide at least one choice to Match.OneOf')
		this.choices = choices
	}
}

class Where {
	constructor(condition) {
		this.condition = condition
	}
}

class ObjectIncluding {
	constructor(pattern) {
		this.pattern = pattern
	}
}

class ObjectWithValues {
	constructor(pattern) {
		this.pattern = pattern
	}
}

var stringForErrorMessage = function (value, options) {
	options = options || {}

	if (value === null) return 'null'

	if (options.onlyShowType) {
		return typeof value
	}

	// This is a simplification of the actual stringForErrorMessage implementation
	try {
		return JSON.stringify(value)
	} catch (stringifyError) {
		return typeof value
	}
}

var typeofChecks = [
	[String, 'string'],
	[Number, 'number'],
	[Boolean, 'boolean'],
	// While we don't allow undefined/function in EJSON, this is good for optional
	// arguments with OneOf.
	[Function, 'function'],
	[undefined, 'undefined'],
]

// Return `false` if it matches. Otherwise, return an object with a `message` and a `path` field.
var testSubtree = function (value, pattern) {
	// Match anything!
	if (pattern === Match.Any) return false

	// Basic atomic types.
	// Do not match boxed objects (e.g. String, Boolean)
	for (var i = 0; i < typeofChecks.length; ++i) {
		if (pattern === typeofChecks[i][0]) {
			if (typeof value === typeofChecks[i][1]) return false
			return {
				message:
					'Expected ' + typeofChecks[i][1] + ', got ' + stringForErrorMessage(value, { onlyShowType: true }),
				path: '',
			}
		}
	}

	if (pattern === null) {
		if (value === null) {
			return false
		}
		return {
			message: 'Expected null, got ' + stringForErrorMessage(value),
			path: '',
		}
	}

	// Strings, numbers, and booleans match literally. Goes well with Match.OneOf.
	if (typeof pattern === 'string' || typeof pattern === 'number' || typeof pattern === 'boolean') {
		if (value === pattern) return false
		return {
			message: 'Expected ' + pattern + ', got ' + stringForErrorMessage(value),
			path: '',
		}
	}

	// Match.Integer is special type encoded with array
	if (pattern === Match.Integer) {
		// There is no consistent and reliable way to check if variable is a 64-bit
		// integer. One of the popular solutions is to get reminder of division by 1
		// but this method fails on really large floats with big precision.
		// E.g.: 1.348192308491824e+23 % 1 === 0 in V8
		// Bitwise operators work consistantly but always cast variable to 32-bit
		// signed integer according to JavaScript specs.
		if (typeof value === 'number' && (value | 0) === value) return false
		return {
			message: 'Expected Integer, got ' + stringForErrorMessage(value),
			path: '',
		}
	}

	// "Object" is shorthand for Match.ObjectIncluding({});
	if (pattern === Object) pattern = Match.ObjectIncluding({})

	// Array (checked AFTER Any, which is implemented as an Array).
	if (pattern instanceof Array) {
		if (pattern.length !== 1) {
			return {
				message: 'Bad pattern: arrays must have one type element' + stringForErrorMessage(pattern),
				path: '',
			}
		}
		if (!Array.isArray(value) && !isArguments(value)) {
			return {
				message: 'Expected array, got ' + stringForErrorMessage(value),
				path: '',
			}
		}

		for (var i = 0, length = value.length; i < length; i++) {
			var result = testSubtree(value[i], pattern[0])
			if (result) {
				result.path = _prependPath(i, result.path)
				return result
			}
		}
		return false
	}

	// Arbitrary validation checks. The condition can return false or throw a
	// Match.Error (ie, it can internally use check()) to fail.
	if (pattern instanceof Where) {
		var result
		try {
			result = pattern.condition(value)
		} catch (err) {
			if (!(err instanceof Match.Error)) throw err
			return {
				message: err.message,
				path: err.path,
			}
		}
		if (result) return false
		// XXX this error is terrible
		return {
			message: 'Failed Match.Where validation',
			path: '',
		}
	}

	if (pattern instanceof Maybe) {
		pattern = Match.OneOf(undefined, null, pattern.pattern)
	} else if (pattern instanceof Optional) {
		pattern = Match.OneOf(undefined, pattern.pattern)
	}

	if (pattern instanceof OneOf) {
		for (var i = 0; i < pattern.choices.length; ++i) {
			var result = testSubtree(value, pattern.choices[i])
			if (!result) {
				// No error? Yay, return.
				return false
			}
			// Match errors just mean try another choice.
		}
		// XXX this error is terrible
		return {
			message: 'Failed Match.OneOf, Match.Maybe or Match.Optional validation',
			path: '',
		}
	}

	// A function that isn't something we special-case is assumed to be a
	// constructor.
	if (pattern instanceof Function) {
		if (value instanceof pattern) return false
		return {
			message: 'Expected ' + (pattern.name || 'particular constructor'),
			path: '',
		}
	}

	var unknownKeysAllowed = false
	var unknownKeyPattern
	if (pattern instanceof ObjectIncluding) {
		unknownKeysAllowed = true
		pattern = pattern.pattern
	}
	if (pattern instanceof ObjectWithValues) {
		unknownKeysAllowed = true
		unknownKeyPattern = [pattern.pattern]
		pattern = {} // no required keys
	}

	if (typeof pattern !== 'object') {
		return {
			message: 'Bad pattern: unknown pattern type',
			path: '',
		}
	}

	// An object, with required and optional keys. Note that this does NOT do
	// structural matches against objects of special types that happen to match
	// the pattern: this really needs to be a plain old {Object}!
	if (typeof value !== 'object') {
		return {
			message: 'Expected object, got ' + typeof value,
			path: '',
		}
	}
	if (value === null) {
		return {
			message: 'Expected object, got null',
			path: '',
		}
	}
	if (!isPlainObject(value)) {
		return {
			message: 'Expected plain object',
			path: '',
		}
	}

	var requiredPatterns = {}
	var optionalPatterns = {}

	Object.keys(pattern).forEach((key) => {
		const subPattern = pattern[key]
		if (subPattern instanceof Optional || subPattern instanceof Maybe) {
			optionalPatterns[key] = subPattern.pattern
		} else {
			requiredPatterns[key] = subPattern
		}
	})

	for (var key in Object(value)) {
		var subValue = value[key]
		if (hasOwn.call(requiredPatterns, key)) {
			var result = testSubtree(subValue, requiredPatterns[key])
			if (result) {
				result.path = _prependPath(key, result.path)
				return result
			}
			delete requiredPatterns[key]
		} else if (hasOwn.call(optionalPatterns, key)) {
			var result = testSubtree(subValue, optionalPatterns[key])
			if (result) {
				result.path = _prependPath(key, result.path)
				return result
			}
		} else {
			if (!unknownKeysAllowed) {
				return {
					message: 'Unknown key',
					path: key,
				}
			}
			if (unknownKeyPattern) {
				var result = testSubtree(subValue, unknownKeyPattern[0])
				if (result) {
					result.path = _prependPath(key, result.path)
					return result
				}
			}
		}
	}

	var keys = Object.keys(requiredPatterns)
	if (keys.length) {
		return {
			message: "Missing key '" + keys[0] + "'",
			path: '',
		}
	}
}

class ArgumentChecker {
	constructor(args, description) {
		// Make a SHALLOW copy of the arguments. (We'll be doing identity checks
		// against its contents.)
		this.args = [...args]
		// Since the common case will be to check arguments in order, and we splice
		// out arguments when we check them, make it so we splice out from the end
		// rather than the beginning.
		this.args.reverse()
		this.description = description
	}

	checking(value) {
		if (this._checkingOneValue(value)) return
		// Allow check(arguments, [String]) or check(arguments.slice(1), [String])
		// or check([foo, bar], [String]) to count... but only if value wasn't
		// itself an argument.
		if (Array.isArray(value) || isArguments(value)) {
			Array.prototype.forEach.call(value, this._checkingOneValue.bind(this))
		}
	}

	_checkingOneValue(value) {
		for (var i = 0; i < this.args.length; ++i) {
			// Is this value one of the arguments? (This can have a false positive if
			// the argument is an interned primitive, but it's still a good enough
			// check.)
			// (NaN is not === to itself, so we have to check specially.)
			if (value === this.args[i] || (Number.isNaN(value) && Number.isNaN(this.args[i]))) {
				this.args.splice(i, 1)
				return true
			}
		}
		return false
	}

	throwUnlessAllArgumentsHaveBeenChecked() {
		if (this.args.length > 0) throw new Error('Did not check() all arguments during ' + this.description)
	}
}

var _jsKeywords = [
	'do',
	'if',
	'in',
	'for',
	'let',
	'new',
	'try',
	'var',
	'case',
	'else',
	'enum',
	'eval',
	'false',
	'null',
	'this',
	'true',
	'void',
	'with',
	'break',
	'catch',
	'class',
	'const',
	'super',
	'throw',
	'while',
	'yield',
	'delete',
	'export',
	'import',
	'public',
	'return',
	'static',
	'switch',
	'typeof',
	'default',
	'extends',
	'finally',
	'package',
	'private',
	'continue',
	'debugger',
	'function',
	'arguments',
	'interface',
	'protected',
	'implements',
	'instanceof',
]

// Assumes the base of path is already escaped properly
// returns key + base
function _prependPath(key, base) {
	if (typeof key === 'number' || key.match(/^\d+$/)) {
		key = '[' + key + ']'
	} else if (!key.match(/^[a-z_$][0-9a-z_$]*$/i) || _jsKeywords.indexOf(key) >= 0) {
		key = JSON.stringify([key])
	}

	if (base && base[0] !== '[') {
		return key + '.' + base
	}

	return key + base
}

function isObject(value) {
	return typeof value === 'object' && value !== null
}

function baseIsArguments(item) {
	return isObject(item) && Object.prototype.toString.call(item) === '[object Arguments]'
}

var isArguments = baseIsArguments(
	(function () {
		return arguments
	})()
)
	? baseIsArguments
	: function (value) {
			return isObject(value) && typeof value.callee === 'function'
	  }

module.exports = {
	check,
	Match,
}
