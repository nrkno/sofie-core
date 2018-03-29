import { Mongo } from 'meteor/mongo'

export interface Task {
	_id: string
	text: string
	createdAt: Date

}

export const Tasks = new Mongo.Collection<Task>('tasks')
