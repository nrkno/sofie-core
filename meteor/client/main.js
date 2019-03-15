import React from 'react';
import { Meteor } from 'meteor/meteor';
import { render } from 'react-dom';
 
import { I18nextProvider, translate } from 'react-i18next';
import { i18nInstance } from './ui/i18n.js';

import App from './ui/App.js';
 
if ('serviceWorker' in navigator) {
  // Use the window load event to keep the page load performant
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}
 
Meteor.startup(() => {
  render(
    <I18nextProvider i18n={i18nInstance}>
      <App />
    </I18nextProvider>
    , document.getElementById('render-target'));
});

