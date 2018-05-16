import React from 'react';
import { Meteor } from 'meteor/meteor';
import { render } from 'react-dom';
 
import { I18nextProvider, translate } from 'react-i18next';
import i18n from './ui/i18n.js';

import App from './ui/App.js';
 

 
Meteor.startup(() => {
  render(
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>
    , document.getElementById('render-target'));
});

