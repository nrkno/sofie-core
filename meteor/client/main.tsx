import * as React from 'react'
import { Meteor } from 'meteor/meteor'
import { render } from 'react-dom'

import { I18nextProvider, withTranslation} from 'react-i18next'
import './ui/i18n'

import '../lib/main'

// Import files that call Meteor.startup:
import './lib/currentTimeReactive'
import './lib/keyboardShortcuts'
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
		// <I18nextProvider i18n={i18nInstance}> // Note: Check if translation actually works without this?
			<App />
		// </I18nextProvider>
		, document.getElementById('render-target')
	)

})

