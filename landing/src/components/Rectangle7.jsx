import React from 'react';

function Rectangle7() {
  return (
    <div className="rectangle rect-split">
      <div className="split-container">
        <div className="split-left" style={{ backgroundImage: "url('/tokyopixel.png')" }}>
        </div>
        <div className="split-right" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', padding: '3rem', textAlign: 'right' }}>
          <div className="spec-badge">TOKYO</div>
          <h3 className="spec-title">Asian Liquidity Hub</h3>
          <p className="spec-description" style={{ margin: 0, width: '100%' }}>
            Enabling seamless localized trading gateways across the Asia-Pacific region.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Rectangle7;
