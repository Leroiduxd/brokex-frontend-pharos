import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAccount, useWriteContract } from 'wagmi';
import { coreAbi } from '../abi/core';
import { CONFIG } from '../config';
import { useNotifications } from '../context/NotificationContext';

const goldAccent = '#BC8961';
const goldAccentLight = 'rgba(188, 137, 97, 0.15)';

export default function PositionManager({ position, isOpen, onClose }) {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { showNotification } = useNotifications();

  const [position_win, setPositionWin] = useState({ x: window.innerWidth / 2 - 370, y: window.innerHeight / 2 - 260 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const [activeTab, setActiveTab] = useState('tpsl'); // Default to 'tpsl' as requested for stop modifications
  const [closeAmount, setCloseAmount] = useState(100);
  const [tpValue, setTpValue] = useState('');
  const [slValue, setSlValue] = useState('');
  const [marginAction, setMarginAction] = useState('add');
  const [marginAmount, setMarginAmount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const containerRef = useRef(null);

  // Initialize and load real raw values from position.raw on mount/update
  useEffect(() => {
    if (isOpen && position) {
      setPositionWin({ x: window.innerWidth / 2 - 370, y: window.innerHeight / 2 - 260 });
      
      // Extract raw numeric values from the smart contract database record
      const rawTP = position.raw?.takeProfit ? (Number(position.raw.takeProfit) / 1e6).toString() : '';
      const rawSL = position.raw?.stopLoss ? (Number(position.raw.stopLoss) / 1e6).toString() : '';
      
      setTpValue(rawTP === '0' ? '' : rawTP);
      setSlValue(rawSL === '0' ? '' : rawSL);
    }
  }, [isOpen, position]);

  const handleMouseDown = (e) => {
    if (!e.target.closest('button') && !e.target.closest('input') && !e.target.closest('a') && !e.target.closest('input[type="range"]')) {
      setIsDragging(true);
      const rect = containerRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      let newX = e.clientX - dragOffset.x;
      let newY = e.clientY - dragOffset.y;

      newX = Math.max(0, Math.min(newX, window.innerWidth - rect.width));
      newY = Math.max(0, Math.min(newY, window.innerHeight - rect.height));

      setPositionWin({ x: newX, y: newY });
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isDragging, dragOffset]);

  // Compute dynamic SL/TP targets based on exact percentage ROI, entry price and leverage
  const handlePercentClick = (type, percentage) => {
    if (!position || !position.raw) return;

    const pct = parseFloat(percentage) / 100;
    const entryPrice = parseFloat(position.raw.openPrice) / 1e6;
    const leverage = parseFloat(position.raw.leverage);
    const side = position.side;

    if (type === 'tp') {
      let tpPrice = 0;
      if (side === 'Long') {
        tpPrice = entryPrice * (1 + pct / leverage);
      } else {
        tpPrice = entryPrice * (1 - pct / leverage);
      }
      setTpValue(tpPrice.toFixed(2));
    } else {
      let slPrice = 0;
      if (side === 'Long') {
        slPrice = entryPrice * (1 - pct / leverage);
      } else {
        slPrice = entryPrice * (1 + pct / leverage);
      }
      setSlValue(slPrice.toFixed(2));
    }
  };

  // Execute active operations against the smart contract
  const handleExecuteAction = async () => {
    if (!isConnected || !position || !position.raw) return;

    setActionLoading(true);
    try {
      const tradeId = BigInt(position.raw.id);

      if (activeTab === 'tpsl') {
        showNotification('Updating Take Profit & Stop Loss levels...', 'info');

        // Scale inputs back to 1e6 precision for Solidity
        const newSLPrice = slValue && parseFloat(slValue) > 0 ? BigInt(Math.round(parseFloat(slValue) * 1e6)) : 0n;
        const newTPPrice = tpValue && parseFloat(tpValue) > 0 ? BigInt(Math.round(parseFloat(tpValue) * 1e6)) : 0n;

        const hash = await writeContractAsync({
          address: CONFIG.addresses.core,
          abi: coreAbi,
          functionName: 'modifyStops',
          args: [tradeId, newSLPrice, newTPPrice, false],
          chainId: CONFIG.chainId,
        });

        showNotification('TP/SL modifications submitted successfully!', 'success', hash);
        window.dispatchEvent(new CustomEvent('trade-updated'));
        
        setTimeout(() => {
          onClose();
        }, 1000);

      } else if (activeTab === 'close') {
        showNotification('Fetching proofs and closing position...', 'info');

        const supraId = Number(position.raw?.supraId || 5500);

        // 1. Fetch oracle proof
        const proofRes = await fetch(`${CONFIG.apiUrl}/proof?pairs=${supraId}&network=${CONFIG.network}`);
        if (!proofRes.ok) throw new Error("Failed to fetch oracle proof");
        const proofData = await proofRes.json();
        const oracleProof = proofData.proof;

        // 2. Fetch KMS risk proofs
        const kmsRes = await fetch(`${CONFIG.apiUrl}/kms-proof/${supraId}?network=${CONFIG.network}`);
        if (!kmsRes.ok) throw new Error("Failed to fetch KMS risk proof");
        const kmsData = await kmsRes.json();

        const riskProof = {
          supraId: BigInt(kmsData.supraId || supraId),
          maxOILong: BigInt(kmsData.maxOILong),
          maxOIShort: BigInt(kmsData.maxOIShort),
          spreadLong: BigInt(kmsData.spreadLong),
          spreadShort: BigInt(kmsData.spreadShort),
          timestamp: BigInt(kmsData.timestamp),
          sig: kmsData.sig,
        };

        const hash = await writeContractAsync({
          address: CONFIG.addresses.core,
          abi: coreAbi,
          functionName: 'closePositionMarket',
          args: [BigInt(supraId), tradeId, oracleProof, riskProof],
          chainId: CONFIG.chainId,
        });

        showNotification('Close position transaction submitted successfully!', 'success', hash);
        window.dispatchEvent(new CustomEvent('trade-updated'));

        setTimeout(() => {
          onClose();
        }, 1000);

      } else {
        showNotification('Margin adjustments are handled directly through the Brokex dynamic Vault.', 'info');
      }
    } catch (err) {
      console.error("Action execution failed:", err);
      showNotification(`Operation failed: ${err.shortMessage || err.message || err}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen || !position) return null;

  const content = (
    <div
      ref={containerRef}
      className="panel-no-border no-spinners"
      onMouseDown={handleMouseDown}
      style={{
        position: 'fixed',
        left: position_win.x,
        top: position_win.y,
        width: '760px',
        backgroundColor: 'var(--bg-dark)',
        borderRadius: '12px',
        overflow: 'hidden',
        display: 'flex',
        boxShadow: '0 40px 100px rgba(0,0,0,0.8)',
        zIndex: 9999999,
        backdropFilter: 'blur(10px)',
        cursor: isDragging ? 'grabbing' : 'auto'
      }}
    >
      <style>{`
        .no-spinners::-webkit-outer-spin-button,
        .no-spinners::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .no-spinners { -moz-appearance: textfield; }
        
        .manager-tab {
          flex: 1;
          text-align: center;
          padding: 8px;
          cursor: pointer;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          transition: all 0.2s;
          color: var(--text-grey);
          border: 1px solid transparent;
        }
        .manager-tab.active {
          background: ${goldAccentLight};
          color: ${goldAccent};
          border: 1px solid ${goldAccent};
        }
        .info-label {
          color: var(--text-grey);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .info-value {
          color: var(--text-dark);
          font-family: 'Source Code Pro', monospace;
          font-size: 11px;
          font-weight: 600;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 5px 0;
          border-bottom: 1px solid rgba(255,255,255,0.03);
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .section-title {
          font-size: 9px;
          color: ${goldAccent};
          font-weight: bold;
          text-transform: uppercase;
          margin-top: 10px;
          margin-bottom: 5px;
          opacity: 0.7;
        }
        .close-btn-pos {
          position: absolute;
          top: 12px;
          right: 12px;
          background: transparent;
          border: none;
          color: var(--text-grey);
          cursor: pointer;
          font-size: 20px;
          z-index: 10;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }
        .close-btn-pos:hover {
          color: var(--text-dark);
        }
        .pct-btn {
          font-size: 9px;
          padding: 2px 6px;
          border-radius: 3px;
          background-color: rgba(255,255,255,0.04);
          color: var(--text-grey);
          cursor: pointer;
          border: 1px solid var(--border-color);
          transition: all 0.2s;
        }
        .pct-btn:hover {
          color: ${goldAccent};
          border-color: ${goldAccent};
          background-color: ${goldAccentLight};
        }
      `}</style>

      {/* Absolute Close Button */}
      <button onClick={onClose} className="close-btn-pos">&times;</button>

      {/* LEFT COLUMN: Trade Info */}
      <div style={{ flex: '1', background: 'rgba(255,255,255,0.01)', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '15px', borderRight: '1px solid var(--border-color)', maxHeight: '550px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', background: goldAccent, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px', color: '#000' }}>
            {position.asset.split('/')[0]}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-dark)' }}>{position.asset}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10px', padding: '1px 4px', borderRadius: '3px', background: position.side === 'Long' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: position.side === 'Long' ? '#3b82f6' : '#ef4444', fontWeight: 'bold' }}>{position.side.toUpperCase()}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-grey)', fontWeight: 'bold' }}>{position.leverage}</span>
            </div>
          </div>
        </div>

        {/* PnL Block */}
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '14px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span className="info-label">Unrealized PnL</span>
            <span style={{ color: position.pnlUsd.startsWith('+') ? '#3b82f6' : '#ef4444', fontWeight: 'bold', fontFamily: 'Source Code Pro', fontSize: '18px' }}>{position.pnlUsd}</span>
          </div>
          <div style={{ textAlign: 'right', fontSize: '12px', color: position.pnlUsd.startsWith('+') ? '#3b82f6' : '#ef4444', opacity: 0.8 }}>{position.pnlPct}</div>
        </div>

        {/* DETAILS LIST */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="section-title">Trade Identification</div>
          <div className="detail-row">
            <span className="info-label">Trade ID</span>
            <span className="info-value" style={{ color: goldAccent }}>{position.raw?.id}</span>
          </div>
          <div className="detail-row">
            <span className="info-label">Wallet</span>
            <span className="info-value">{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '—'}</span>
          </div>
          <div className="detail-row">
            <span className="info-label">Open Time</span>
            <span className="info-value">
              {position.raw?.openTimestamp 
                ? new Date(Number(position.raw.openTimestamp) * 1000).toLocaleString() 
                : '—'}
            </span>
          </div>

          <div className="section-title">Position Metrics</div>
          <div className="detail-row">
            <span className="info-label">Size (USD)</span>
            <span className="info-value">{position.size}</span>
          </div>
          <div className="detail-row">
            <span className="info-label">Collateral</span>
            <span className="info-value">{position.collateral}</span>
          </div>
          <div className="detail-row">
            <span className="info-label">Entry Price</span>
            <span className="info-value">{position.openPrice}</span>
          </div>
          <div className="detail-row">
            <span className="info-label">Market Price</span>
            <span className="info-value" style={{ color: goldAccent }}>{position.marketPrice}</span>
          </div>

          <div className="section-title">Risk Management</div>
          <div className="detail-row">
            <span className="info-label">Liq. Price</span>
            <span className="info-value" style={{ color: '#ef4444' }}>{position.liqPrice}</span>
          </div>
          <div className="detail-row">
            <span className="info-label">Current TP</span>
            <span className="info-value" style={{ color: '#3b82f6' }}>{position.tp}</span>
          </div>
          <div className="detail-row">
            <span className="info-label">Current SL</span>
            <span className="info-value" style={{ color: '#ef4444' }}>{position.sl}</span>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Actions */}
      <div style={{ flex: '1.1', background: 'var(--bg-dark)', padding: '44px 20px 24px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.02)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div className={`manager-tab ${activeTab === 'tpsl' ? 'active' : ''}`} onClick={() => setActiveTab('tpsl')}>TP/SL</div>
          <div className={`manager-tab ${activeTab === 'close' ? 'active' : ''}`} onClick={() => setActiveTab('close')}>Close</div>
          <div className={`manager-tab ${activeTab === 'collateral' ? 'active' : ''}`} onClick={() => setActiveTab('collateral')}>Margin</div>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, minHeight: '220px' }}>
          {activeTab === 'tpsl' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-grey)' }}>Take Profit (USD)</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {['10%', '25%', '50%', '100%'].map(p => (
                      <button key={p} className="pct-btn" onClick={() => handlePercentClick('tp', p)}>{p}</button>
                    ))}
                  </div>
                </div>
                <input
                  type="number" value={tpValue} onChange={e => setTpValue(e.target.value)} placeholder="Target Price (e.g. 2350.00)"
                  style={{ width: '100%', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px', color: 'var(--text-dark)', fontSize: '13px', outline: 'none', fontFamily: 'Source Code Pro' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-grey)' }}>Stop Loss (USD)</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {['10%', '25%', '50%', '100%'].map(p => (
                      <button key={p} className="pct-btn" onClick={() => handlePercentClick('sl', p)}>{p}</button>
                    ))}
                  </div>
                </div>
                <input
                  type="number" value={slValue} onChange={e => setSlValue(e.target.value)} placeholder="Stop Price (e.g. 2280.00)"
                  style={{ width: '100%', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px', color: 'var(--text-dark)', fontSize: '13px', outline: 'none', fontFamily: 'Source Code Pro' }}
                />
              </div>
            </div>
          )}

          {activeTab === 'close' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-grey)' }}>CLOSE PERCENTAGE</span>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: goldAccent, fontFamily: 'Source Code Pro' }}>{closeAmount}%</span>
              </div>
              <input
                type="range" min="1" max="100" value={closeAmount} onChange={e => setCloseAmount(e.target.value)}
                style={{ width: '100%', accentColor: goldAccent, height: '4px', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
                {[25, 50, 75, 100].map(p => (
                  <button
                    key={p} onClick={() => setCloseAmount(p)}
                    style={{ flex: 1, padding: '6px', fontSize: '10px', background: closeAmount == p ? goldAccentLight : 'rgba(255,255,255,0.03)', border: `1px solid ${closeAmount == p ? goldAccent : 'var(--border-color)'}`, borderRadius: '4px', color: closeAmount == p ? goldAccent : 'var(--text-grey)', cursor: 'pointer' }}
                  >{p}%</button>
                ))}
              </div>
              <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-grey)' }}>Closing Size</span>
                  <span style={{ color: 'var(--text-dark)', fontFamily: 'Source Code Pro' }}>${(closeAmount / 100 * parseFloat(position.size.replace('$', '').replace(',', ''))).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-grey)' }}>Estimated Return</span>
                  <span style={{ color: goldAccent, fontWeight: 'bold', fontFamily: 'Source Code Pro' }}>${(closeAmount / 100 * (parseFloat(position.collateral.replace('$', '')) + parseFloat(position.pnlUsd.replace('$', '').replace('+', '')))).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'collateral' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.02)', padding: '3px', borderRadius: '6px' }}>
                <button onClick={() => setMarginAction('add')} style={{ flex: 1, padding: '6px', fontSize: '10px', background: marginAction === 'add' ? goldAccentLight : 'transparent', border: `1px solid ${marginAction === 'add' ? goldAccent : 'transparent'}`, borderRadius: '4px', color: marginAction === 'add' ? goldAccent : 'var(--text-grey)', cursor: 'pointer' }}>ADD</button>
                <button onClick={() => setMarginAction('remove')} style={{ flex: 1, padding: '6px', fontSize: '10px', background: marginAction === 'remove' ? goldAccentLight : 'transparent', border: `1px solid ${marginAction === 'remove' ? goldAccent : 'transparent'}`, borderRadius: '4px', color: marginAction === 'remove' ? goldAccent : 'var(--text-grey)', cursor: 'pointer' }}>REMOVE</button>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border-color)', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-grey)' }}>Amount</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <input
                    type="number" value={marginAmount} onChange={e => setMarginAmount(e.target.value)} placeholder="0.00"
                    style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-dark)', fontSize: '20px', fontWeight: 'bold', fontFamily: 'Source Code Pro', width: '70%' }}
                  />
                  <span style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--text-dark)' }}>USDC</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Button */}
        <button
          onClick={handleExecuteAction}
          disabled={actionLoading}
          style={{ width: '100%', padding: '14px', background: goldAccent, border: 'none', borderRadius: '6px', color: '#000', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', transition: 'opacity 0.2s', marginTop: 'auto', opacity: actionLoading ? 0.6 : 1 }}
        >
          {actionLoading ? 'Broadcasting...' : activeTab === 'close' ? `Close ${closeAmount}% Position` : activeTab === 'collateral' ? `${marginAction === 'add' ? 'Add' : 'Remove'} Margin` : 'Update TP/SL'}
        </button>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
