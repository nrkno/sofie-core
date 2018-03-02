import React, { Component } from 'react';
import ReactDOM             from 'react-dom';
import { withTracker }      from 'meteor/react-meteor-data';
import Header               from './Header.js';
import TasksSample          from './TasksSample.js';
import Dashboard            from './Dashboard.js';
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
        <div className="container-fluid">
          <Header />
          <Route exact path="/" component={Dashboard} />
          <Route path="/tasks" component={TasksSample} />
          <Route path="/nymansPlayground" component={NymansPlayground} />
        </div>
      </Router>
    );
  }
}

export default App;
