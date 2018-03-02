import React, { Component } from 'react';
import ReactDOM             from 'react-dom';
import { withTracker }      from 'meteor/react-meteor-data';
import TasksSample          from './TasksSample.js';
import NymansPlayground     from './NymansPlayground.js';
import {
  BrowserRouter as Router,
  Route,
  Link
} from 'react-router-dom';

// App component - represents the whole app
class App extends Component {
  render() {
    return (
      <Router>
        <div className="container">
          <Route exact path="/" component={TasksSample} />
          <Route path="/nymansPlayground" component={NymansPlayground} />
        </div>
      </Router>
    );
  }
}

export default App;
