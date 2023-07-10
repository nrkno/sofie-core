import { Socket } from 'socket.io'
import { ParamsIfReturnIsValid, ResultCallback } from '../helper'
import { ClientToServerEvents, ServerToClientEvents } from '..'

export type MySocket = Socket<ClientToServerEvents, ServerToClientEvents>

export async function callHelper<T extends keyof ServerToClientEvents>(
	socket: MySocket,
	functionId: string,
	name: T,
	data: ParamsIfReturnIsValid<ServerToClientEvents[T]>[0]
): Promise<ReturnType<ServerToClientEvents[T]>> {
	if (!socket.connected) throw new Error('Blueprints are unavailable')

	// TODO - ensure #callHandlers is cleaned up

	// TODO - timeouts?
	return new Promise<ReturnType<ServerToClientEvents[T]>>((resolve, reject) => {
		const handleDisconnect = () => {
			reject('Lost connection')
		}
		socket.once('disconnect', handleDisconnect)

		const innerCb: ResultCallback<ReturnType<ServerToClientEvents[T]>> = (
			err: any,
			res: ReturnType<ServerToClientEvents[T]>
		): void => {
			socket.off('disconnect', handleDisconnect)

			if (err) reject(err)
			else resolve(res)
		}
		socket.emit(name as any, functionId, data, innerCb)
	})
}
