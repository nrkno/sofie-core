import * as fs from 'fs'
import { Meteor } from 'meteor/meteor'
import { logger } from './logging'
import { Methods } from './methods'
import * as _ from 'underscore'

export const fsWriteFile: (path: fs.PathLike | number, data: any, options?: { encoding?: string | null; mode?: number | string; flag?: string; } | string | undefined | null) => void
	= Meteor.wrapAsync(fs.writeFile)
export const fsReadFile: (path: fs.PathLike | number, options?: { encoding?: null; flag?: string; } | undefined | null) => Buffer
	= Meteor.wrapAsync(fs.readFile)
export const fsUnlinkFile: (path: fs.PathLike) => void
	= Meteor.wrapAsync(fs.unlink)

export function getAbsolutePath (): string {
	// @ts-ignore Meteor.absolutePath is injected by the package ostrio:meteor-root
	return Meteor.absolutePath
}

/**
 * Wraps the methods so the thrown errors are formatted nicely
 * @param methods
 */
export function wrapMethods (methods: Methods): Methods {
	let methodsOut: Methods = {}
	_.each(methods, (fcn: Function, key) => {
		methodsOut[key] = (...args: any[]) => {
			// logger.info('------- Method call -------')
			// logger.info(key)
			// logger.info(args)
			// logger.info('---------------------------')
			try {
				return fcn.apply(null, args)
			} catch (e) {
				logger.error(e.message || e.reason || (e.toString ? e.toString() : null) || e)
				throw e
			}
		}
	})
	return methodsOut
}
