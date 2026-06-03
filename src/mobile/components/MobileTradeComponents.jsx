import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import { coreAbi } from '../../abi/core';
import { lensAbi } from '../../abi/lens';
import { CONFIG } from '../../config';
import { useNotifications } from '../../context/NotificationContext';
import MobileTradeHeader from './MobileTradeHeader';
import MobilePositions from './MobilePositions';
import MobileOrderPanel from './MobileOrderPanel';

export { MobileTradeHeader, MobilePositions, MobileOrderPanel };

// Common Accent Colors (Theme-aware via CSS variables)
const goldAccent = '#BC8961';
const goldAccentLight = 'rgba(188, 137, 97, 0.15)';
const buyColor = '#3b82f6'; // blue
const sellColor = '#ef4444'; // red
const buyColorBg = 'rgba(59, 130, 246, 0.1)';
const sellColorBg = 'rgba(239, 68, 68, 0.1)';

// ----------------------------------------------------
// 0.5. MOBILE TOPNAV (TradeHeader + Scrollable Metrics Row)
// ----------------------------------------------------
export function MobileTopNav({ activeMarketInfo, setIsMarketSelectorOpen }) {
  const isPositive = activeMarketInfo.change.startsWith('+');
  const [spreadLong, setSpreadLong] = useState(0);
  const [spreadShort, setSpreadShort] = useState(0);

  // Fetch real-time spreads from WebSocket
  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;

    const connectWS = () => {
      const wsUrl = `${CONFIG.apiUrl.replace('https', 'wss').replace('http', 'ws')}/ws/spread`;
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const currentNetwork = CONFIG.network || 'testnet';
          const networkSpreads = data[currentNetwork];
          if (networkSpreads) {
            setSpreadLong(parseFloat(networkSpreads.spreadLong) || 0);
            setSpreadShort(parseFloat(networkSpreads.spreadShort) || 0);
          }
        } catch (err) {
          console.error("MobileTopNav Spread WS parsing error:", err);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connectWS, 3000);
      };

      ws.onerror = (err) => {
        console.error("MobileTopNav Spread WS error:", err);
      };
    };

    connectWS();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // Fetch real-time asset snapshot from smart contract Lens
  const { data: snapshot } = useReadContract({
    address: CONFIG.addresses.lens,
    abi: lensAbi,
    functionName: 'getAssetSnapshot',
    args: [5500n],
    chainId: CONFIG.chainId,
    query: {
      refetchInterval: 10000, // Refetch every 10 seconds
    }
  });

  const getSnapshotValue = (snap, key, index) => {
    if (!snap) return 0;
    let target = snap;
    if (Array.isArray(snap) && snap.length === 1 && typeof snap[0] === 'object') {
      target = snap[0];
    }
    if (target[key] !== undefined && target[key] !== null) {
      return Number(target[key]);
    }
    if (target[index] !== undefined && target[index] !== null) {
      return Number(target[index]);
    }
    return 0;
  };

  const getSnapshotConfigValue = (snap, key) => {
    if (!snap) return null;
    let target = snap;
    if (Array.isArray(snap) && snap.length === 1 && typeof snap[0] === 'object') {
      target = snap[0];
    }
    const snapConfig = target.config || target[4];
    if (snapConfig && snapConfig[key] !== undefined && snapConfig[key] !== null) {
      return snapConfig[key];
    }
    return null;
  };

  const oiLongRaw = getSnapshotValue(snapshot, 'openInterestLong', 1);
  const oiShortRaw = getSnapshotValue(snapshot, 'openInterestShort', 2);
  const borrowRateHourlyRaw = getSnapshotConfigValue(snapshot, 'borrowRateHourly');

  const oiLongUSD = oiLongRaw / 1e6;
  const oiShortUSD = oiShortRaw / 1e6;
  const totalOi = oiLongUSD + oiShortUSD;

  const formattedBorrowRate = borrowRateHourlyRaw !== null 
    ? `${(Number(borrowRateHourlyRaw) / 10000).toFixed(4)}%/h`
    : '0.0000%/h';

  const formatOIVal = (val) => {
    if (!val || val === 0) return '0';
    if (val >= 1e6) {
      const formatted = val / 1e6;
      return formatted % 1 === 0 ? `${formatted}M` : `${formatted.toFixed(1)}M`;
    }
    if (val >= 1e3) {
      return `${Math.round(val / 1e3)}K`;
    }
    return Math.round(val).toString();
  };

  const longRatio = totalOi > 0 ? Math.round((oiLongUSD / totalOi) * 100) : 50;

  // Compute live spread value
  const basePriceNum = parseFloat(activeMarketInfo.price.replace(/,/g, '')) || 2315.10;
  const longPriceNum = basePriceNum * (1 + spreadLong / 1000000);
  const shortPriceNum = basePriceNum * (1 - spreadShort / 1000000);
  const spreadUSD = Math.max(0, longPriceNum - shortPriceNum);
  const formattedSpread = `$${spreadUSD.toFixed(4)}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* 1. Header Title & Select */}
      <MobileTradeHeader 
        activeMarketInfo={activeMarketInfo} 
        setIsMarketSelectorOpen={setIsMarketSelectorOpen} 
      />

      {/* 2. Scrollable stats row (matching TopNav.jsx exactly, with Price/Variation cleanly omitted as they are placed in Header) */}
      <div className="mobile-metrics-scroll no-scrollbar" style={{
        display: 'flex',
        gap: '18px',
        overflowX: 'auto',
        padding: '4px 12px 12px 12px',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        borderBottom: '1px solid var(--border-color)',
        background: 'transparent'
      }}>
        {/* Style to prevent shrink on mobile metric items */}
        <style>{`
          .mobile-metrics-scroll > * { flex-shrink: 0; }
        `}</style>

        {/* Borrow Fee */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '8px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>Borrow Fee</span>
          <span style={{ fontSize: '10.5px', fontFamily: 'Source Code Pro, monospace', fontWeight: 'bold', color: 'var(--text-dark)' }}>
            {formattedBorrowRate}
          </span>
        </div>

        {/* Spread */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '8px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>Spread</span>
          <span style={{ fontSize: '10.5px', fontFamily: 'Source Code Pro, monospace', fontWeight: 'bold', color: 'var(--text-dark)' }}>
            {formattedSpread}
          </span>
        </div>

        {/* Open Interest */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '8px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>Open Interest</span>
          <span style={{ fontSize: '10.5px', fontFamily: 'Source Code Pro, monospace', fontWeight: 'bold', color: 'var(--text-dark)' }}>
            {formatOIVal(totalOi)} / 200K
          </span>
        </div>

        {/* Long/Short Ratio */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '8px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>L/S Ratio</span>
          <span style={{ fontSize: '10.5px', fontFamily: 'Source Code Pro, monospace', fontWeight: 'bold' }}>
            <span style={{ color: '#3b82f6' }}>{longRatio}%</span>
            <span style={{ color: 'var(--text-grey)', margin: '0 2px' }}>/</span>
            <span style={{ color: '#ef4444' }}>{100 - longRatio}%</span>
          </span>
        </div>

        {/* 24h Volume */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '8px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>24h Volume</span>
          <span style={{ fontSize: '10.5px', fontFamily: 'Source Code Pro, monospace', fontWeight: 'bold', color: 'var(--text-dark)' }}>
            {activeMarketInfo.volume}
          </span>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 1. MOBILE TRADE INFO (Ticker & Market Stats)
// ----------------------------------------------------
export function MobileTradeInfo({ onOpenMarket, activeView, setActiveView }) {
  const stats = {
    ticker: 'XAU/USD',
    price: '2,315.10',
    change: '+0.12%',
    fundingLong: '0.0100%',
    fundingShort: '-0.0100%',
    oi: '125.4M',
    maxOi: '500M',
    longRatio: 65,
    vol24h: '842.5M'
  };

  return (
    <div style={{
      background: 'var(--panel-bg)',
      borderTop: 'none',
      borderLeft: 'none',
      borderRight: 'none',
      borderBottom: '1px solid var(--border-color)',
      borderRadius: '0px',
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      width: '100%'
    }}>
      {/* Top Ticker Selector & Main Price */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        {/* Left: Ticker selector */}
        <div 
          onClick={onOpenMarket}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            cursor: 'pointer'
          }}
        >
          <div style={{ 
            width: '22px', 
            height: '22px', 
            background: goldAccent, 
            borderRadius: '5px', 
            color: '#000', 
            fontWeight: 'bold', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: '12px'
          }}>
            G
          </div>
          <span style={{ fontSize: '13px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '3px' }}>
            {stats.ticker}
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--text-grey)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </span>
        </div>

        {/* Right: Main Price (Larger font size) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace', color: 'var(--text-dark)', lineHeight: '1.1' }}>
            ${stats.price}
          </span>
        </div>
      </div>

      {activeView !== 'positions' && (
        <>
          <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '2px 0' }} />

          {/* Horizontal Scrolling Stats grid for clean fit */}
          <div style={{
            display: 'flex',
            gap: '16px',
            overflowX: 'auto',
            paddingBottom: '4px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}>
            <style>{`
              .mobile-scroll-stats::-webkit-scrollbar { display: none; }
            `}</style>
            
            <div className="mobile-scroll-stats" style={{ display: 'flex', gap: '16px', flexShrink: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>Borrow Fee</span>
                <span style={{ fontSize: '10px', fontFamily: 'Source Code Pro, monospace', fontWeight: '500', color: 'var(--text-dark)' }}>
                  0.00%
                </span>
              </div>

              <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-color)', alignSelf: 'center' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>Open Interest</span>
                <span style={{ fontSize: '10px', fontFamily: 'Source Code Pro, monospace', fontWeight: '500' }}>
                  {stats.oi} <span style={{ color: 'var(--text-grey)', fontSize: '8px' }}>/ {stats.maxOi}</span>
                </span>
              </div>

              <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-color)', alignSelf: 'center' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>Long/Short Ratio</span>
                <span style={{ fontSize: '10px', fontFamily: 'Source Code Pro, monospace', fontWeight: '500' }}>
                  <span style={{ color: '#3b82f6' }}>{stats.longRatio}%</span>
                  <span style={{ color: 'var(--text-grey)', margin: '0 2px' }}>/</span>
                  <span style={{ color: '#ef4444' }}>{100 - stats.longRatio}%</span>
                </span>
              </div>

              <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-color)', alignSelf: 'center' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>24h Volume</span>
                <span style={{ fontSize: '10px', fontFamily: 'Source Code Pro, monospace', fontWeight: '500' }}>
                  ${stats.vol24h}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ----------------------------------------------------
// 2. MOBILE POSITIONS (Imported from Standalone Component)
// ----------------------------------------------------

// ----------------------------------------------------
// 3. MOBILE ORDER PANEL (Imported from Standalone Component)
// ----------------------------------------------------

// ----------------------------------------------------
// 4. MOBILE POSITION MANAGER (Details & Edit Modal)
// ----------------------------------------------------
export function MobilePositionManager({ isOpen, onClose, position, initialTab = 'close' }) {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { showNotification } = useNotifications();

  const [activeTab, setActiveTab] = useState(initialTab);
  const [closeAmount, setCloseAmount] = useState(100);
  const [tpValue, setTpValue] = useState('');
  const [slValue, setSlValue] = useState('');
  const [marginAction, setMarginAction] = useState('add');
  const [marginAmount, setMarginAmount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Sync initial state when position/isOpen changes
  useEffect(() => {
    if (isOpen && position) {
      // Extract raw numeric values from the smart contract database record
      const rawTP = position.raw?.takeProfit ? (Number(position.raw.takeProfit) / 1e6).toString() : '';
      const rawSL = position.raw?.stopLoss ? (Number(position.raw.stopLoss) / 1e6).toString() : '';
      
      setTpValue(rawTP === '0' ? '' : rawTP);
      setSlValue(rawSL === '0' ? '' : rawSL);
    }
  }, [isOpen, position]);

  // Sync tab when opened via specific quick buttons
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

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

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(4px)',
      zIndex: 9999999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      {/* Modal Card container */}
      <div style={{
        background: 'var(--bg-dark)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '440px',
        maxHeight: '90vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)'
      }}>
        
        {/* Header Block */}
        <div style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255, 255, 255, 0.01)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{position.asset}</span>
            <span style={{
              fontSize: '8px',
              padding: '2px 6px',
              borderRadius: '4px',
              fontWeight: 'bold',
              background: position.side === 'Long' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: position.side === 'Long' ? '#3b82f6' : '#ef4444'
            }}>
              {position.side.toUpperCase()}
            </span>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-grey)',
              fontSize: '22px',
              cursor: 'pointer',
              lineHeight: '1',
              padding: '2px'
            }}
          >
            &times;
          </button>
        </div>

        {/* Quick Position Status */}
        <div style={{
          padding: '12px 16px',
          background: 'rgba(255,255,255,0.01)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>Unrealized PnL</span>
            <span style={{ 
              fontSize: '15px', 
              fontWeight: 'bold', 
              fontFamily: 'Source Code Pro',
              color: position.pnlUsd.startsWith('+') ? '#3b82f6' : '#ef4444' 
            }}>
              {position.pnlUsd} <span style={{ fontSize: '11px', fontWeight: '500' }}>({position.pnlPct})</span>
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>Collateral</span>
            <span style={{ fontSize: '12px', fontWeight: '600', fontFamily: 'Source Code Pro' }}>
              {position.collateral}
            </span>
          </div>
        </div>

        {/* Tab Selection */}
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '8px 16px',
          background: 'rgba(0,0,0,0.1)'
        }}>
          {['tpsl', 'close', 'collateral'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '6px 0',
                fontSize: '10px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                borderRadius: '6px',
                cursor: 'pointer',
                background: activeTab === tab ? goldAccentLight : 'transparent',
                color: activeTab === tab ? goldAccent : 'var(--text-grey)',
                border: `1px solid ${activeTab === tab ? goldAccent : 'transparent'}`
              }}
            >
              {tab === 'collateral' ? 'Margin' : tab === 'tpsl' ? 'TP/SL' : 'Close'}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div style={{ padding: '16px', flex: 1, minHeight: '180px' }}>
          
          {activeTab === 'close' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>Close Percentage</span>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: goldAccent, fontFamily: 'Source Code Pro' }}>{closeAmount}%</span>
              </div>
              <input
                type="range" min="1" max="100" value={closeAmount} onChange={e => setCloseAmount(Number(e.target.value))}
                style={{ width: '100%', accentColor: goldAccent, height: '4px', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px' }}>
                {[25, 50, 75, 100].map(p => (
                  <button
                    key={p} onClick={() => setCloseAmount(p)}
                    style={{ 
                      flex: 1, 
                      padding: '4px', 
                      fontSize: '9px', 
                      background: closeAmount === p ? goldAccentLight : 'rgba(255,255,255,0.02)', 
                      border: `1px solid ${closeAmount === p ? goldAccent : 'var(--border-color)'}`, 
                      borderRadius: '4px', 
                      color: closeAmount === p ? goldAccent : 'var(--text-grey)', 
                      cursor: 'pointer',
                      fontWeight: 'bold' 
                    }}
                  >{p}%</button>
                ))}
              </div>
              <div style={{ 
                padding: '10px', 
                background: 'rgba(255,255,255,0.02)', 
                borderRadius: '6px', 
                fontSize: '10px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '6px', 
                marginTop: '6px' 
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-grey)' }}>Closing size</span>
                  <span style={{ color: 'var(--text-dark)', fontFamily: 'Source Code Pro' }}>
                    ${(closeAmount / 100 * parseFloat(position.size.replace('$', '').replace(',', ''))).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-grey)' }}>Estimated Return</span>
                  <span style={{ color: goldAccent, fontWeight: 'bold', fontFamily: 'Source Code Pro' }}>
                    ${(closeAmount / 100 * (parseFloat(position.collateral.replace('$', '')) + parseFloat(position.pnlUsd.replace('$', '').replace('+', '')))).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'collateral' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ 
                display: 'flex', 
                gap: '4px', 
                background: 'rgba(255,255,255,0.02)', 
                padding: '3px', 
                borderRadius: '6px',
                border: '1px solid var(--border-color)'
              }}>
                <button 
                  onClick={() => setMarginAction('add')} 
                  style={{ 
                    flex: 1, padding: '5px', fontSize: '10px', fontWeight: 'bold',
                    background: marginAction === 'add' ? goldAccentLight : 'transparent', 
                    border: `1px solid ${marginAction === 'add' ? goldAccent : 'transparent'}`, 
                    borderRadius: '4px', color: marginAction === 'add' ? goldAccent : 'var(--text-grey)', 
                    cursor: 'pointer' 
                  }}
                >ADD MARGIN</button>
                <button 
                  onClick={() => setMarginAction('remove')} 
                  style={{ 
                    flex: 1, padding: '5px', fontSize: '10px', fontWeight: 'bold',
                    background: marginAction === 'remove' ? goldAccentLight : 'transparent', 
                    border: `1px solid ${marginAction === 'remove' ? goldAccent : 'transparent'}`, 
                    borderRadius: '4px', color: marginAction === 'remove' ? goldAccent : 'var(--text-grey)', 
                    cursor: 'pointer' 
                  }}
                >REMOVE MARGIN</button>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border-color)', padding: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>Amount</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <input
                    type="number" value={marginAmount} onChange={e => setMarginAmount(e.target.value)} placeholder="0.00"
                    style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-dark)', fontSize: '18px', fontWeight: 'bold', fontFamily: 'Source Code Pro', width: '70%' }}
                  />
                  <span style={{ fontWeight: 'bold', fontSize: '11px', color: 'var(--text-dark)' }}>USDC</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tpsl' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-grey)' }}>TAKE PROFIT (USD)</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {['10%', '25%', '50%', '100%'].map(p => (
                      <button key={p} style={{ fontSize: '8px', padding: '1px 4px', borderRadius: '3px', backgroundColor: 'rgba(255,255,255,0.04)', color: 'var(--text-grey)', cursor: 'pointer', border: '1px solid var(--border-color)' }} onClick={() => handlePercentClick('tp', p)}>{p}</button>
                    ))}
                  </div>
                </div>
                <input
                  type="number" value={tpValue} onChange={e => setTpValue(e.target.value)} placeholder="Target Price"
                  style={{ width: '100%', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px', color: 'var(--text-dark)', fontSize: '12px', outline: 'none', fontFamily: 'Source Code Pro' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-grey)' }}>STOP LOSS (USD)</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {['10%', '25%', '50%', '100%'].map(p => (
                      <button key={p} style={{ fontSize: '8px', padding: '1px 4px', borderRadius: '3px', backgroundColor: 'rgba(255,255,255,0.04)', color: 'var(--text-grey)', cursor: 'pointer', border: '1px solid var(--border-color)' }} onClick={() => handlePercentClick('sl', p)}>{p}</button>
                    ))}
                  </div>
                </div>
                <input
                  type="number" value={slValue} onChange={e => setSlValue(e.target.value)} placeholder="Stop Price"
                  style={{ width: '100%', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px', color: 'var(--text-dark)', fontSize: '12px', outline: 'none', fontFamily: 'Source Code Pro' }}
                />
              </div>
            </div>
          )}

        </div>

        {/* Submit Actions Button */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
          <button
            onClick={handleExecuteAction}
            disabled={actionLoading}
            style={{ 
              width: '100%', 
              padding: '10px', 
              background: goldAccent, 
              border: 'none', 
              borderRadius: '6px', 
              color: '#000', 
              fontWeight: 'bold', 
              fontSize: '12px', 
              cursor: 'pointer', 
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              opacity: actionLoading ? 0.6 : 1
            }}
          >
            {actionLoading ? 'Broadcasting...' : activeTab === 'close' ? `Close ${closeAmount}% Position` : activeTab === 'collateral' ? `${marginAction === 'add' ? 'Add' : 'Remove'} Margin` : 'Update TP/SL'}
          </button>
        </div>
      </div>
    </div>
  );
}
