import * as React from 'react'
import { Meteor } from 'meteor/meteor'
import { createRoot } from 'react-dom/client'

import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { SorensenContextProvider } from './lib/SorensenContext'

// Import some browser polyfills to handle rare features
import './lib/polyfill/polyfills'

import './ui/i18n'

import '../lib/main'

// Import files that call Meteor.startup:
import './lib/currentTimeReactive'
import './lib/uncaughtErrorHandler'
import './lib/dev'

import App from './ui/App'
import { logger } from '../lib/logging'
import './lib/logStatus'

if ('serviceWorker' in navigator) {
	// Use the window load event to keep the page load performant
	window.addEventListener('load', () => {
		// in some versions of Chrome, registering the Service Worker over HTTP throws an arror
		if (window.location.protocol === 'https:' || window.location.hostname === 'localhost') {
			navigator.serviceWorker.register('/sw.js').catch((err) => {
				logger.error('Error registering serviceWorker', err)
			})
		}
	})
}

Meteor.startup(() => {
	const targetEl = document.getElementById('render-target')

	if (!targetEl) {
		logger.error('Could not find target element for mounting UI')
		return
	}

	const root = createRoot(targetEl)

	root.render(
		<DndProvider backend={HTML5Backend}>
			<SorensenContextProvider>
				<App />
			</SorensenContextProvider>
		</DndProvider>
	)
})
