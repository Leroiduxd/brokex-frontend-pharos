import React from 'react';

function Rectangle2() {
  return (
    <div className="rectangle rect-purple spec-card">
      <div className="spec-badge">XAU/USD ONLY</div>
      <h3 className="spec-title">Pure Gold Exposure</h3>
      <p className="spec-description">
        No noise. No low-liquidity pairs. Trade the world's most stable asset with maximum capital efficiency.
      </p>

      {/* Structured Gold Key points */}
      <ul className="spec-features-list">
        <li>
          <span className="gold-dot">✦</span> <strong>Physically-backed tracker</strong>: Mirroring exact XAU/USD spot prices.
        </li>
        <li>
          <span className="gold-dot">✦</span> <strong>Zero Slippage execution</strong>: Instantly matched against the pool.
        </li>
        <li>
          <span className="gold-dot">✦</span> <strong>Deep Liquidity</strong>: Supports large-size trade entries without price impact.
        </li>
      </ul>
      
      <div className="spec-grid">
        <div className="spec-item">
          <span className="spec-label">Max Leverage</span>
          <span className="spec-value highlight-gold">50x</span>
        </div>
        <div className="spec-item">
          <span className="spec-label">Liquidation Limit</span>
          <span className="spec-value">90%</span>
        </div>
        <div className="spec-item">
          <span className="spec-label">Asset Class</span>
          <span className="spec-value">Commodities</span>
        </div>
      </div>
    </div>
  );
}

export default Rectangle2;
