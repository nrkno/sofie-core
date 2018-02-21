import { Mongo } from 'meteor/mongo';

const Tasks = new Mongo.Collection('tasks');

//console.log('Tasks');

if (Meteor.isClient) {

	window.Tasks = Tasks;
}


export {Tasks};
