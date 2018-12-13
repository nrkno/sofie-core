import * as crypto from 'crypto'
import * as fs from 'fs'
import { Meteor } from 'meteor/meteor'

export function getHash (str: string): string {
	const hash = crypto.createHash('sha1')
	return hash.update(str).digest('base64').replace(/[\+\/\=]/g, '_') // remove +/= from strings, because they cause troubles
}

export const fsWriteFile: (path: fs.PathLike | number, data: any, options?: { encoding?: string | null; mode?: number | string; flag?: string; } | string | undefined | null) => void
	= Meteor.wrapAsync(fs.writeFile)
export const fsReadFile: (path: fs.PathLike | number, options?: { encoding?: null; flag?: string; } | undefined | null) => Buffer
	= Meteor.wrapAsync(fs.readFile)
export const fsUnlinkFile: (path: fs.PathLike) => void
	= Meteor.wrapAsync(fs.unlink)
