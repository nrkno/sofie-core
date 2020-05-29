import * as mousetrap from 'mousetrap'
import { Meteor } from 'meteor/meteor'

Meteor.startup(() => {
	// Prevent opening the Help page:
	mousetrap.bind(
		'f1',
		(e: KeyboardEvent) => {
			e.preventDefault()
		},
		'keydown'
	)

	// Prevent Search from opening, thus grabbing focus:
	mousetrap.bind(
		'f3',
		(e: KeyboardEvent) => {
			e.preventDefault()
		},
		'keydown'
	)

	mousetrap.bind('space', (e: KeyboardEvent) => {
		e.preventDefault()
	})
})
