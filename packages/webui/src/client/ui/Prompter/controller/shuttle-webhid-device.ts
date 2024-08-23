import { ControllerAbstract } from './lib'
import { AccessRequestCallback, PrompterViewInner } from '../PrompterView'
import { logger } from '../../../../lib/logging'

import { getOpenedDevices, requestAccess, setupShuttle, Shuttle } from 'shuttle-webhid'

/**
 * This class handles control of the prompter using Contour Shuttle / Multimedia Controller line of devices
 */
export class ShuttleWebHidController extends ControllerAbstract {
	private prompterView: PrompterViewInner

	private speedMap = [0, 1, 2, 3, 5, 7, 9, 30]
	private jogMultiplierMap = this.speedMap.slice(1)

	private readonly MIN_JOG_MULTIPLIER = 0
	private readonly MAX_JOG_MULTIPLIER = this.jogMultiplierMap.length - 1
	private readonly JOG_BASE_MOVEMENT_PX = 20

	private updateSpeedHandle: number | null = null
	private lastSpeed = 0
	private currentPosition = 0

	private connectedShuttle: Shuttle | undefined

	private jogMultiplierIndex = 3

	private accessRequestCallback: AccessRequestCallback = {
		callback: this.requestAccess.bind(this),
		deviceName: 'Contour Shuttle',
	}

	constructor(view: PrompterViewInner) {
		super()
		this.prompterView = view

		this.attemptConnectingToKnownDevice()
	}

	protected static makeSpeedStepMap(speedMap: number[]): number[] {
		return [
			...speedMap
				.slice(1)
				.reverse()
				.map((i) => i * -1),
			...speedMap.slice(),
		]
	}

	public requestAccess(): void {
		requestAccess()
			.then((devices) => {
				if (devices.length === 0) {
					logger.error('No device was selected')
					return
				}
				logger.info(`Access granted to "${devices[0].productName}"`)
				this.openDevice(devices[0]).catch(logger.error)
			})
			.catch(logger.error)
	}

	protected attemptConnectingToKnownDevice(): void {
		getOpenedDevices()
			.then((devices) => {
				if (devices.length > 0) {
					logger.info(`"${devices[0].productName}" already granted in a previous session`)
					this.openDevice(devices[0]).catch(logger.error)
				}
				this.prompterView.registerAccessRequestCallback(this.accessRequestCallback)
			})
			.catch(logger.error)
	}

	protected async openDevice(device: HIDDevice): Promise<void> {
		const shuttle = await setupShuttle(device)

		this.prompterView.unregisterAccessRequestCallback(this.accessRequestCallback)

		this.connectedShuttle = shuttle

		logger.info(`Connected to "${shuttle.info.name}"`)

		shuttle.on('error', (error) => {
			logger.error(`Error: ${error}`)
		})
		shuttle.on('disconnected', () => {
			logger.warn(`disconnected`)
		})
		shuttle.on('down', (keyIndex: number) => {
			this.onButtonPressed(keyIndex)
			logger.debug(`Button ${keyIndex} down`)
		})
		shuttle.on('up', (keyIndex: number) => {
			logger.debug(`Button ${keyIndex} up`)
		})
		shuttle.on('jog', (delta, value) => {
			this.onJog(delta)
			logger.debug(`jog ${delta} ${value}`)
		})
		shuttle.on('shuttle', (value) => {
			this.onShuttle(value)
			logger.debug(`shuttle ${value}`)
		})
	}

	public destroy(): void {
		this.connectedShuttle?.close().catch(logger.error)
		// Nothing
	}
	public onKeyDown(_e: KeyboardEvent): void {
		// Nothing
	}
	public onKeyUp(_e: KeyboardEvent): void {
		// Nothing
	}
	public onMouseKeyDown(_e: MouseEvent): void {
		// Nothing
	}
	public onMouseKeyUp(_e: MouseEvent): void {
		// Nothing
	}
	public onWheel(_e: WheelEvent): void {
		// Nothing
	}

	protected onButtonPressed(keyIndex: number): void {
		switch (keyIndex) {
			case 0:
				this.onJogMultipierDelta(-1)
				break
			case 1:
				this.resetSpeed()
				this.prompterView.scrollToPrevious()
				break
			case 2:
				this.resetSpeed()
				this.prompterView.scrollToLive()
				break
			case 3:
				this.resetSpeed()
				this.prompterView.scrollToFollowing()
				break
			case 4:
				this.onJogMultipierDelta(1)
				break
		}
	}

	protected onJogMultipierDelta(delta: number): void {
		this.jogMultiplierIndex = Math.min(
			Math.max(this.jogMultiplierIndex + delta, this.MIN_JOG_MULTIPLIER),
			this.MAX_JOG_MULTIPLIER
		)
	}

	protected onJog(delta: number): void {
		if (Math.abs(delta) > 1) return // this is a hack because sometimes, right after connecting to the device, the delta would be larger than 1 or -1

		this.resetSpeed()
		window.scrollBy(0, this.JOG_BASE_MOVEMENT_PX * delta * this.jogMultiplierMap[this.jogMultiplierIndex])
	}

	protected onShuttle(value: number): void {
		this.lastSpeed = this.speedMap[Math.abs(value)] * Math.sign(value)
		this.updateScrollPosition()
	}

	protected resetSpeed(): void {
		this.lastSpeed = 0
	}

	private updateScrollPosition() {
		if (this.updateSpeedHandle !== null) return

		if (this.lastSpeed !== 0) {
			window.scrollBy(0, this.lastSpeed)

			const scrollPosition = window.scrollY
			// check for reached end-of-scroll:
			if (this.currentPosition !== undefined && scrollPosition !== undefined) {
				if (this.currentPosition === scrollPosition) {
					// We tried to move, but haven't
					this.resetSpeed()
				}
				this.currentPosition = scrollPosition
			}
		}

		this.updateSpeedHandle = window.requestAnimationFrame(() => {
			this.updateSpeedHandle = null
			this.updateScrollPosition()
		})
	}
}
