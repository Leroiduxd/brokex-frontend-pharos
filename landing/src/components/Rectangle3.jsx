import React from 'react';

function Rectangle3() {
  return (
    <div className="rectangle rect-emerald spec-card">
      <div className="spec-badge">LOW FEES</div>
      <h3 className="spec-title">0.06% Opening Commission</h3>
      <p className="spec-description">
        We cut trading friction to the bone. Pay raw oracle spreads with absolutely zero hidden markup fees.
      </p>

      {/* Structured Gold Table */}
      <div className="spec-table-container">
        <table className="spec-table">
          <thead>
            <tr>
              <th>Fee Category</th>
              <th>Rate / Value</th>
              <th>Impact</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Opening Commission</strong></td>
              <td className="gold-text font-mono">0.06%</td>
              <td>One-time fee at entry</td>
            </tr>
            <tr>
              <td><strong>Closing Commission</strong></td>
              <td className="gold-text font-mono">0.00%</td>
              <td>Free exits</td>
            </tr>
            <tr>
              <td><strong>Overnight Rollover</strong></td>
              <td className="gold-text font-mono">0.00%</td>
              <td>No holding costs</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div className="spec-comparison">
        <div className="comp-row">
          <span className="comp-name">Brokex Core</span>
          <div className="comp-bar-wrapper">
            <div className="comp-bar brokex-bar" style={{ width: '12%' }}></div>
          </div>
          <span className="comp-pct">0.06%</span>
        </div>
        <div className="comp-row">
          <span className="comp-name">Legacy Brokers</span>
          <div className="comp-bar-wrapper">
            <div className="comp-bar legacy-bar" style={{ width: '90%' }}></div>
          </div>
          <span className="comp-pct">0.45%</span>
        </div>
      </div>
    </div>
  );
}

export default Rectangle3;
