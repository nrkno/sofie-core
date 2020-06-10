import React from 'react'
import { Meteor } from 'meteor/meteor'
import { render } from 'react-dom'

import { I18nextProvider, translate } from 'react-i18next'
import { i18nInstance } from './ui/i18n.js'
import { DragDropContextProvider } from 'react-dnd'
import HTML5Backend from 'react-dnd-html5-backend'

import App from './ui/App.js'

if (!Meteor.isProduction && Meteor.settings.public.whyDidYouRender === true) {
	const whyDidYouRender = require('@welldone-software/why-did-you-render/dist/no-classes-transpile/umd/whyDidYouRender.min.js')
	whyDidYouRender(React)
}

if ('serviceWorker' in navigator) {
	// Use the window load event to keep the page load performant
	window.addEventListener('load', () => {
		// in some versions of Chrome, registering the Service Worker over HTTP throws
		// an arror
		if (window.location.protocol === 'https:' || window.location.hostname === 'localhost') {
			navigator.serviceWorker.register('/sw.js').catch((err) => {
				console.error(err)
			})
		}
	})
}

Meteor.startup(() => {
	render(
		<I18nextProvider i18n={i18nInstance}>
			<DragDropContextProvider backend={HTML5Backend}>
				<App />
			</DragDropContextProvider>
		</I18nextProvider>,
		document.getElementById('render-target')
	)
})
