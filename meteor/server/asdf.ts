

import { Meteor } from 'meteor/meteor';

console.log('test');

class aaa{

	static b(a:string) {

	}

	sayHello() {
		console.log('hello!!!!');
	}
}


var a = new aaa();

a.sayHello();



Meteor.startup(() => {
	
	console.log('startup');
})