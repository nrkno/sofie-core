import * as fs from 'fs'
import { Meteor } from 'meteor/meteor'
import { logger } from './logging'
import { Methods } from '../lib/methods'
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
