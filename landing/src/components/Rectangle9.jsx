import React from 'react';

function Rectangle9() {
  return (
    <div className="rectangle rect-split">
      <div className="split-container">
        <div className="split-left" style={{ backgroundImage: "url('/parispixel.png')" }}>
        </div>
        <div className="split-right" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', padding: '3rem', textAlign: 'right' }}>
          <div className="spec-badge">PARIS</div>
          <h3 className="spec-title">European Gateway</h3>
          <p className="spec-description" style={{ margin: 0, width: '100%' }}>
            Bridging Eurozone asset managers with next-generation decentralized clearing protocols.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Rectangle9;
