import { version } from '../../package.json'

export function getCurrentTime(): number {
	return Date.now()
}

export function getSystemVersion(): string {
	// Note: This would be useful to have some git hashes in it
	return version
}
