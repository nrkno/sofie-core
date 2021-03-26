/* eslint-disable no-process-exit */
// eslint-disable-next-line node/no-extraneous-import
import { Atem } from 'atem-connection'
import * as fs from 'fs'
import * as _ from 'underscore'

/**
 * This script is a temporary implementation to upload media to the atem.
 * @todo: proper atem media management
 */

const AtemMaxFilenameLength = 63

function consoleLog(...args: any[]) {
	console.log('AtemUpload:', ...args)
}
function consoleError(...args: any[]) {
	console.error('AtemUpload:', ...args)
}
export class AtemUploadScript {
	private readonly connection: Atem
	private readonly fileUrl: string

	constructor(fileUrl: string) {
		this.connection = new Atem()
		this.fileUrl = fileUrl

		this.connection.on('error', consoleError)
	}

	public connect(ip: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this.connection.once('connected', () => {
				resolve()
			})
			this.connection.connect(ip).catch((err) => {
				reject(err)
			})
		})
	}

	public loadFile(): Promise<Buffer> {
		return new Promise<Buffer>((resolve, reject) => {
			fs.readFile(this.fileUrl, (e, data) => {
				consoleLog('got file')
				if (e) reject(e)
				else resolve(data)
			})
		})
	}

	public checkIfFileExistsOnAtem(fileName: string, stillIndex: number): boolean {
		consoleLog('got a file')

		const still = this.connection.state ? this.connection.state.media.stillPool[stillIndex] : undefined
		if (still) {
			consoleLog('has still')
			if (still.isUsed) {
				consoleLog('still is used')
				if (fileName.length === AtemMaxFilenameLength) {
					consoleLog('filename is max length, change detection might fail')
				}

				if (still.fileName === fileName) {
					consoleLog('name equals')
					return true
				} else {
					return false
				}
			} else {
				return false
			}
		} else {
			consoleLog('has no still')
			throw Error('Atem appears to be missing still')
		}
	}

	public async uploadToAtem(fileData: Buffer, stillIndex: number): Promise<void> {
		const fileName = this.fileUrl.substr(-AtemMaxFilenameLength) // cannot be longer than 63 chars
		if (!this.checkIfFileExistsOnAtem(fileName, stillIndex)) {
			consoleLog('does not exist on ATEM')
			await this.connection.clearMediaPoolStill(stillIndex)
			await this.connection.uploadStill(stillIndex, fileData, fileName, '')
		} else {
			consoleLog('does exist on ATEM')
		}
	}
}

console.log('Setup AtemUploader...')
const singleton = new AtemUploadScript(process.argv[3])
singleton.connect(process.argv[2]).then(
	async () => {
		consoleLog('ATEM upload connected')
		const fileData = await singleton.loadFile().catch((e) => {
			consoleError(e)
			console.error('Exiting process due to atemUpload error')
			process.exit(-1)
		})
		let stillIndexSTr: string | undefined
		if (process.argv.length >= 5) {
			stillIndexSTr = process.argv[4]
		}
		let stillIndex: number | undefined
		if (stillIndexSTr !== undefined) {
			stillIndex = parseInt(stillIndexSTr, 10)
		}

		if (stillIndex === undefined || isNaN(stillIndex) || !_.isNumber(stillIndex)) {
			console.error('Exiting due to invalid mediaPool')
			process.exit(-1)
		}

		singleton.uploadToAtem(fileData, stillIndex).then(
			() => {
				consoleLog('uploaded ATEM media to still ' + stillIndex)
				process.exit(0)
			},
			() => process.exit(-1)
		)
	},
	() => process.exit(-1)
)
