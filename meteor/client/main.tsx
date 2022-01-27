import * as React from 'react'
import { Meteor } from 'meteor/meteor'
import { render } from 'react-dom'

import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { SorensenContextProvider } from './lib/SorensenContext'
import { isRunningInPWA } from './lib/lib'

// Import some browser polyfills to handle rare features
import './lib/polyfill/polyfills'

import './ui/i18n'

import '../lib/main'

// Import files that call Meteor.startup:
import './lib/currentTimeReactive'
import './lib/uncaughtErrorHandler'
import './lib/dev'

import App from './ui/App'

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
			<SorensenContextProvider>
				<App />
			</SorensenContextProvider>
		</DndProvider>,
		document.getElementById('render-target')
	)

	if (isRunningInPWA()) {
		document.addEventListener(
			'mousedown',
			() => {
				document.documentElement
					.requestFullscreen({
						navigationUI: 'auto',
					})
					.catch((e) => console.error('Could not get FullScreen when running as a PWA', e))

				// Use Keyboard API to lock the keyboard and disable all browser shortcuts
				if ('keyboard' in navigator) {
					//@ts-ignore
					navigator.keyboard.lock().catch((e) => console.error('Could not get Keyboard Lock when running as a PWA', e))
				}
			},
			{
				once: true,
				passive: false,
			}
		)
	}
})
