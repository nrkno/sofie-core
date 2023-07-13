import { Socket } from 'socket.io'
import { ParamsIfReturnIsNever, ParamsIfReturnIsValid, ResultCallback } from '../helper'
import { SofieToBlueprintMethods, BlueprintToSofieMethods } from '..'

export type MySocket = Socket<SofieToBlueprintMethods, BlueprintToSofieMethods>

export async function callHelper<T extends keyof BlueprintToSofieMethods>(
	socket: MySocket,
	invocationId: string,
	name: T,
	data: ParamsIfReturnIsValid<BlueprintToSofieMethods[T]>[0]
): Promise<ReturnType<BlueprintToSofieMethods[T]>> {
	if (!socket.connected) throw new Error('Blueprints are unavailable')

	// TODO - ensure #callHandlers is cleaned up

	// TODO - timeouts?
	return new Promise<ReturnType<BlueprintToSofieMethods[T]>>((resolve, reject) => {
		const handleDisconnect = () => {
			reject('Lost connection')
		}
		socket.once('disconnect', handleDisconnect)

		const innerCb: ResultCallback<ReturnType<BlueprintToSofieMethods[T]>> = (
			err: any,
			res: ReturnType<BlueprintToSofieMethods[T]>
		): void => {
			socket.off('disconnect', handleDisconnect)

			if (err) reject(err)
			else resolve(res)
		}
		socket.emit(name as any, invocationId, data, innerCb)
	})
}

export function emitHelper<T extends keyof BlueprintToSofieMethods>(
	socket: MySocket,
	invocationId: string,
	name: T,
	data: ParamsIfReturnIsNever<BlueprintToSofieMethods[T]>[0]
): void {
	if (!socket.connected) throw new Error('Blueprints are unavailable')

	socket.emit(name as any, invocationId, data)
}
