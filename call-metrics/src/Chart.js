import ChartJS from 'chart.js';
import React, { Component } from 'react';

export default class Chart extends Component {

  canvasSetup = (ref) => {
    this.ctx = ref.getContext('2d');
    const data = this.props.data;
    this.chart = new ChartJS(this.ctx, {
      type: 'line',
      data: {
        labels: data.map(p => p.x),
        datasets: [
          {
            label: this.props.title,
            data: data.map(p => p.y),
            backgroundColor: 'rgba(255, 255, 255, 0.6)',
            borderColor: 'rgba(255, 255, 255, 0.9)',
            steppedLine: false
        }]
      },
      options: {
        legend: {
          labels: {
            fontColor: 'white'
          }
        },
        scales: {
          xAxes: [{
            display: false
          }]
        },
      }
    });
  }

  render() {
    return (
      <div className="chart-item">
        <h5></h5>
        <canvas width="300" height="200" ref={this.canvasSetup}></canvas>
      </div>
    );
  }
}