import { Meteor } from 'meteor/meteor'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { render } from 'react-dom'
import '../lib/main'
// Import files that call Meteor.startup:
import './lib/currentTimeReactive'
import './lib/dev'
import './lib/keyboardShortcuts'
import './lib/uncaughtErrorHandler'
import App from './ui/App'
import './ui/i18n'

if ('serviceWorker' in navigator) {
	// Use the window load event to keep the page load performant
	window.addEventListener('load', () => {
		// in some versions of Chrome, registering the Service Worker over HTTP throws an arror
		if (window.location.protocol === 'https:' || window.location.hostname === 'localhost') {
			navigator.serviceWorker.register('/sw.js').catch((err) => {
				console.error(err)
			})
		}
	})
}

Meteor.startup(() => {
	render(
		<DndProvider backend={HTML5Backend}>
			<App />
		</DndProvider>,
		document.getElementById('render-target')
	)
})
