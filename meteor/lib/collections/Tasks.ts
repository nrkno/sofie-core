import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from './typings'

export interface Task {
	_id: string
	text: string
	createdAt: Date

}

export const Tasks: TransformedCollection<Task, Task>
	= new Mongo.Collection<Task>('tasks')
