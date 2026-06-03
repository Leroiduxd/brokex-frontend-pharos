import React from 'react';

function Rectangle4() {
  return (
    <div className="rectangle rect-blue spec-card">
      <div className="spec-badge">USDC SOLVENCY</div>
      <h3 className="spec-title">Vault-Backed Payback Assurance</h3>
      <p className="spec-description">
        Every single open interest unit is fully backed by USDC locked in the smart contract Vault.
      </p>

      {/* Structured Gold Flow Pipeline */}
      <div className="flow-container">
        <div className="flow-step">
          <div className="flow-step-num">01</div>
          <div className="flow-step-label">Margin Deposit</div>
          <div className="flow-step-desc">Trader collateralizes position in USDC</div>
        </div>
        <div className="flow-arrow">→</div>
        <div className="flow-step">
          <div className="flow-step-num">02</div>
          <div className="flow-step-label">Vault Lockup</div>
          <div className="flow-step-desc">Vault collateralizes net Open Interest</div>
        </div>
        <div className="flow-arrow">→</div>
        <div className="flow-step">
          <div className="flow-step-num">03</div>
          <div className="flow-step-label">Settlement</div>
          <div className="flow-step-desc">Profits paid instantly by Vault on exit</div>
        </div>
      </div>
      
      <div className="vault-stats">
        <div className="vault-stat">
          <div className="vault-icon">🛡️</div>
          <div>
            <div className="vault-stat-label">Core Contract</div>
            <div className="vault-stat-value">BrokexVault.sol</div>
          </div>
        </div>
        <div className="vault-status-indicator">
          <span className="status-pulse-green"></span>
          <span className="status-text">Instant Solver Payout Enabled</span>
        </div>
      </div>
    </div>
  );
}

export default Rectangle4;
