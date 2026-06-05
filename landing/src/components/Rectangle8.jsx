import React from 'react';

function Rectangle8() {
  return (
    <div className="rectangle rect-split">
      <div className="split-container">
        <div className="split-left" style={{ backgroundImage: "url('/londonpixel.png')" }}>
        </div>
        <div className="split-right" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', padding: '3rem', textAlign: 'right' }}>
          <div className="spec-badge">LONDON</div>
          <h3 className="spec-title">European Capital</h3>
          <p className="spec-description" style={{ margin: 0, width: '100%' }}>
            Deep liquidity pooling and routing tailored for European institutional hours.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Rectangle8;
