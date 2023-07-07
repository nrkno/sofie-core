import { Socket } from 'socket.io'
import { ClientToServerEvents, ServerToClientEvents } from '..'

export type MySocket = Socket<ClientToServerEvents, ServerToClientEvents>
