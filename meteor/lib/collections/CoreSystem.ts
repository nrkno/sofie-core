import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { Time, registerCollection, getCurrentTime } from '../lib'
import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { logger } from '../logging'

export const SYSTEM_ID = 'core'
export interface ICoreSystem {
	_id: 'core'
	/** Timestamp of creation, (ie the time the database was created) */
	created: number
	/** Last modified time */
	modified: number
	/** Database version, on the form x.y.z */
	version: string
	/** Previous version, on the form x.y.z */
	previousVersion: string | null

	/** File path to store persistant data (like snapshots, etc) */
	storePath: string
}

// The CoreSystem collection will contain one (exactly 1) object.
// This represents the "system"

export const CoreSystem: TransformedCollection<ICoreSystem, ICoreSystem>
	= new Mongo.Collection<ICoreSystem>('coreSystem')
registerCollection('CoreSystem', CoreSystem)

export function getCoreSystem (): ICoreSystem | undefined {
	return CoreSystem.findOne(SYSTEM_ID)
}
export function getCoreSystemCursor () {
	return CoreSystem.find(SYSTEM_ID)
}
export function setCoreSystemVersion (versionStr: string): string {
	let system = getCoreSystem()
	if (!system) throw new Meteor.Error(500, 'CoreSystem not found')

	if (!Meteor.isServer) throw new Meteor.Error(500, 'This function can only be run server-side')

	let version = parseVersion(versionStr)

	if (version.toString() === versionStr) {

		logger.info(`Updating database version, from "${system.version}" to "${version.toString()}".`)

		let previousVersion: string | null = null

		if (system.version && compareVersions(version, parseVersion(system.version)) > 0) { // the new version is higher than previous version
			previousVersion = system.version
		}

		CoreSystem.update(system._id, {$set: {
			version: versionStr,
			previousVersion: previousVersion
		}})
		return versionStr
	} else {
		throw new Meteor.Error(500, `Unable to set version. Parsed version differ from expected: "${versionStr}", "${version.toString()}"`)
	}
}
export function setCoreSystemStorePath (storePath: string): void {
	let system = getCoreSystem()
	if (!system) throw new Meteor.Error(500, 'CoreSystem not found')
	if (!Meteor.isServer) throw new Meteor.Error(500, 'This function can only be run server-side')

	storePath = (storePath + '').trim().replace(/(.*)[\/\\]$/, '$1') // remove last "/" or "\"

	CoreSystem.update(system._id, {$set: {
		storePath: storePath
	}})
}
export interface Version {
	toString: () => string
	major: number
	minor: number
	patch: number
	label?: string
}
export function stripVersion (v: string): string {
	return v.replace(/[^\d.]/g,'')
}
export function parseVersion (v: string | Version): Version {

	let m: any
	if (_.isString(v)) {
		// https://github.com/semver/semver/issues/232
		m = (v + '').match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-(0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(\.(0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?(\+[0-9a-zA-Z-]+(\.[0-9a-zA-Z-]+)*)?$/)

	} else if (_.isObject(v)) {
		m = [
			'',
			v.major + '',
			v.minor + '',
			v.patch + '',
			v.label + ''
		]
	}
	if (m) {
		let major = parseInt(m[1], 10)
		let minor = parseInt(m[2], 10)
		let patch = parseInt(m[3], 10)
		let label = (m[4] ? (m[4] + '').trim() : '')
		if (
			!_.isNaN(major) &&
			!_.isNaN(minor) &&
			!_.isNaN(patch)
		) {
			return {
				major: major,
				minor: minor,
				patch: patch,
				label: label,
				toString: () => {
					return `${major}.${minor}.${patch}` + (label ? '-' + label : '')
				}
			}
		}
	}
	throw new Meteor.Error(500, `Invalid version: "${v}"`)
}
/**
 * Compares versions, returns 1 if larger, -1 if smaller, 0 if equal.
 * (Excluding version label)
 * @param v0
 * @param v1
 */
export function compareVersions (v0: Version, v1: Version): number {

	if (v0.major > v1.major) return 1
	if (v0.major < v1.major) return -1

	if (v0.minor > v1.minor) return 1
	if (v0.minor < v1.minor) return -1

	if (v0.patch > v1.patch) return 1
	if (v0.patch < v1.patch) return -1

	return 0
}
