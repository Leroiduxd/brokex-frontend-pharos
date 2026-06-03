import React from 'react';

function Rectangle5() {
  return (
    <div className="rectangle rect-amber spec-card">
      <div className="spec-badge">HYBRID SECURITY</div>
      <h3 className="spec-title">Stateless Pull Oracles & KMS</h3>
      <p className="spec-description">
        Protects against frontrunning and latency arbitrage using cryptographic AWS KMS Risk Proof signatures.
      </p>

      {/* Structured Security Cycle Diagram */}
      <div className="flow-container">
        <div className="flow-step">
          <div className="flow-step-num">Pyth Live</div>
          <div className="flow-step-label">Oracle Pull</div>
          <div className="flow-step-desc">Real-time price feed request on-demand</div>
        </div>
        <div className="flow-arrow">→</div>
        <div className="flow-step">
          <div className="flow-step-num">AWS KMS</div>
          <div className="flow-step-label">Risk Proof Sig</div>
          <div className="flow-step-desc">Cryptographic latency defense</div>
        </div>
        <div className="flow-arrow">→</div>
        <div className="flow-step">
          <div className="flow-step-num">On-Chain</div>
          <div className="flow-step-label">Execution</div>
          <div className="flow-step-desc">Verified by BrokexCore contract</div>
        </div>
      </div>
      
      <div className="code-snippet-box">
        <pre className="code-lang">solidity</pre>
        <code>
          {`struct RiskProof {
  uint256 supraId;
  uint256 maxOILong;
  uint256 maxOIShort;
  uint256 spreadLong;
  uint256 spreadShort;
  bytes sig;
}`}
        </code>
      </div>
    </div>
  );
}

export default Rectangle5;
