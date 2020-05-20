import React, { Component } from 'react';
import './App.css';
import Chart from './Chart';
import moment from 'moment';

class App extends Component {

  constructor() {
    super();
    this.state = {
      sessions: null,
      selected: null,
      stats: {}
    };
    this.init();
  }

  async init() {
    const response = await fetch('https:/localhost:8443/session');
    const sessions = await response.json();
    this.setState({
      sessions
    });
  }

  updateStats = async (id) => {
    const response = await fetch(`https:/localhost:8443/session/${id}/stats`);
    const rawStats = await response.json();
    const session = this.state.sessions.find(s => s.session_id === id);
    const stats = {
      [session.from]: {},
      [session.to]: {}
    };
    rawStats.forEach(dp => {
      if(!stats[dp.peer][dp.stat]) {
        stats[dp.peer][dp.stat] = [];
      }
      stats[dp.peer][dp.stat].push(
        {
        x: dp.timestamp,
        y: parseFloat(dp.value)
        }
      );
    });
    this.setState({
      stats: { ...this.state.stats, [id]: stats }
    });
  }

  select = (id) => {
    this.setState({ selected: id });
    if (id) {
      this.updateStats(id);
    }
  }

  renderPeerStats(stats) {
    const charts = [];
    for (const stat in stats) {
      if (stats.hasOwnProperty(stat)) {
        const data = stats[stat];
        charts.push(
          <Chart key={stat} title={stat} data={data} />
        );
      }
    }
    return charts;
  }

  render() {
    const { sessions, selected, stats } = this.state;
    const session = selected ? sessions.find(s => s.session_id === selected) : null;
    return (
      <div className="App">
        <div className="App-content">
          { selected ? 
            <div>
              <h3>Call from {session.from} to {session.to} on {moment(session.created_at).format('LLL')}</h3>
              <a href="/" onClick={() => this.select(null)}>Go back</a>
              { stats[selected] &&
                <div>
                  <div>
                    <h4>Caller stats</h4>
                    <div className="chart-container">
                      {this.renderPeerStats(stats[selected][session.from])}
                    </div>
                  </div>
                  <div>
                    <h4>Callee stats</h4>
                    <div className="chart-container">
                      {this.renderPeerStats(stats[selected][session.to])}
                    </div>
                  </div>
                </div>
              }
            </div>
            :
            <div>
              <h3>Sessions</h3>
              <ul>
                {sessions ? sessions.map(s =>
                  <li key={s.id}>
                    <div>
                      <a href="#" onClick={() => this.select(s.session_id)}>{s.from} -> {s.to}</a> {moment(s.created_at).format('lll')}
                    </div>
                  </li>
                ) : 'Loading ...'}
              </ul>
            </div>
          }
        </div>
      </div>
    );
  }
}

export default App;
