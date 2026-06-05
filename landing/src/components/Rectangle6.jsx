import React from 'react';

function Rectangle6() {
  return (
    <div className="rectangle rect-split">
      <div className="split-container">
        <div className="split-left" style={{ backgroundImage: "url('/nyc.png')" }}>
        </div>
        <div className="split-right" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', padding: '3rem', textAlign: 'right' }}>
          <div className="spec-badge">NEW YORK</div>
          <h3 className="spec-title">Global Access</h3>
          <p className="spec-description" style={{ margin: 0, width: '100%' }}>
            Connecting traditional gold markets with decentralized liquidity hubs worldwide.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Rectangle6;
