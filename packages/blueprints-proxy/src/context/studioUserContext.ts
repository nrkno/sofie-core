import { IStudioUserContext } from '@sofie-automation/blueprints-integration'
import { MySocket } from '../routers/util'
import { StudioContextArgs } from '..'
import { StudioContext } from './studioContext'

export class StudioUserContext extends StudioContext implements IStudioUserContext {
	constructor(functionName: string, socket: MySocket, invocationId: string, msg: StudioContextArgs) {
		super(functionName, socket, invocationId, msg)
	}

	notifyUserError(message: string, params?: { [key: string]: any } | undefined): void {
		this.emitMessage('common_notifyUserError', {
			message,
			params,
		})
	}
	notifyUserWarning(message: string, params?: { [key: string]: any } | undefined): void {
		this.emitMessage('common_notifyUserWarning', {
			message,
			params,
		})
	}
	notifyUserInfo(message: string, params?: { [key: string]: any } | undefined): void {
		this.emitMessage('common_notifyUserInfo', {
			message,
			params,
		})
	}
}
