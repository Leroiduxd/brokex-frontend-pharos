import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { coreAbi } from '../../abi/core';
import { lensAbi } from '../../abi/lens';
import { CONFIG } from '../../config';
import { useNotifications } from '../../context/NotificationContext';

const goldAccent = '#BC8961';
const sellColor = '#ef4444'; // red

function mapApiTrade(trade, liveGoldPrice = 2315.00, spreadLong = 0, spreadShort = 0, borrowRateHourlyRaw = null) {
  const idStr = `#${trade.id}`;
  const sideStr = Number(trade.direction) === 1 ? 'Long' : 'Short';
  const rawOpenInterest = parseFloat(trade.openInterest);
  const sizeVal = (!isNaN(rawOpenInterest) && rawOpenInterest > 0)
    ? rawOpenInterest / 1e6
    : (parseFloat(trade.margin) * parseFloat(trade.leverage)) / 1e6;
  const sizeStr = `$${sizeVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const leverageStr = `${trade.leverage}x`;
  const collateralVal = parseFloat(trade.margin) / 1e6;
  const collateralStr = `$${collateralVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  const openPriceVal = parseFloat(trade.openPrice) / 1e6;
  const closePriceVal = parseFloat(trade.closePrice || '0') / 1e6;
  const liqPriceVal = parseFloat(trade.liqPrice) / 1e6;
  const slVal = parseFloat(trade.stopLoss) / 1e6;
  const tpVal = parseFloat(trade.takeProfit) / 1e6;
  const targetPriceVal = parseFloat(trade.targetPrice) / 1e6;

  const liqPriceStr = `$${liqPriceVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const slStr = slVal > 0 ? `$${slVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
  const tpStr = tpVal > 0 ? `$${tpVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
  const openPriceStr = `$${openPriceVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const closePriceStr = `$${closePriceVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const targetPriceStr = `$${targetPriceVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Compute live price with spread taken into account for open positions:
  // "si le trade c'est un long, tu mets le spread short et si c'est un short, tu mets le spread long en Market Price."
  const dirNum = Number(trade.direction);
  let actualMarketPrice = liveGoldPrice;
  if (dirNum === 1) {
    // For a Long position, exit price is the Short price (bid price)
    actualMarketPrice = liveGoldPrice * (1 - spreadShort / 1000000);
  } else {
    // For a Short position, exit price is the Long price (ask price)
    actualMarketPrice = liveGoldPrice * (1 + spreadLong / 1000000);
  }

  // PnL calculation
  let pnlVal = 0;
  const stateNum = Number(trade.state);
  if (stateNum === 1) {
    if (openPriceVal > 0) {
      if (dirNum === 1) {
        pnlVal = sizeVal * (actualMarketPrice - openPriceVal) / openPriceVal;
      } else {
        pnlVal = sizeVal * (openPriceVal - actualMarketPrice) / openPriceVal;
      }
    }
  } else if (stateNum >= 2) {
    if (openPriceVal > 0) {
      if (dirNum === 1) {
        pnlVal = sizeVal * (closePriceVal - openPriceVal) / openPriceVal;
      } else {
        pnlVal = sizeVal * (openPriceVal - closePriceVal) / openPriceVal;
      }
    }
  }

  // Accrued borrow fee calculation
  const openTime = Number(trade.openTimestamp || 0);
  const closeTime = Number(trade.state) === 1 
    ? Math.floor(Date.now() / 1000) 
    : Number(trade.closeTimestamp || 0);
  const durationSeconds = Math.max(0, closeTime - openTime);
  const durationHours = durationSeconds / 3600;

  // Decimal rate = borrowRateHourlyRaw / 1,000,000
  const borrowRateDecimal = borrowRateHourlyRaw !== null 
    ? Number(borrowRateHourlyRaw) / 1000000 
    : 0.0001; // default to 0.01% hourly if not loaded
  
  const accruedBorrowFeeUSD = sizeVal * borrowRateDecimal * durationHours;
  const borrowFeeStr = `$${accruedBorrowFeeUSD.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;

  // Subtract borrow fee directly from PnL
  pnlVal = pnlVal - accruedBorrowFeeUSD;

  const pnlUsdStr = (pnlVal >= 0 ? '+' : '-') + '$' + Math.abs(pnlVal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pnlPctVal = collateralVal > 0 ? (pnlVal / collateralVal) * 100 : 0;
  const pnlPctStr = (pnlPctVal >= 0 ? '+' : '-') + Math.abs(pnlPctVal).toFixed(2) + '%';

  const openDateStr = trade.openTimestamp 
    ? new Date(Number(trade.openTimestamp) * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) 
    : '—';
  const closeDateStr = trade.closeTimestamp 
    ? new Date(Number(trade.closeTimestamp) * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) 
    : '—';

  return {
    id: idStr,
    asset: Number(trade.supraId) === 0 ? 'BTC/USD' : 'XAU/USD',
    side: sideStr,
    size: sizeStr,
    leverage: leverageStr,
    collateral: collateralStr,
    liqPrice: liqPriceStr,
    sl: slStr,
    tp: tpStr,
    marketPrice: `$${actualMarketPrice.toFixed(2)}`,
    orderPrice: targetPriceStr,
    closePrice: closePriceStr,
    status: stateNum === 0 ? (Number(trade.orderType) === 1 ? 'LIMIT' : 'STOP') : 'Pending',
    pnlUsd: pnlUsdStr,
    pnlPct: pnlPctStr,
    borrowFee: borrowFeeStr,
    openTimeStr: openDateStr,
    closeTimeStr: closeDateStr,
    raw: trade
  };
}

export default function MobilePositions({ onManagePosition, isFullPage = false }) {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [liveGoldPrice, setLiveGoldPrice] = useState(2315.00);
  const [spreadLong, setSpreadLong] = useState(0);
  const [spreadShort, setSpreadShort] = useState(0);

  // Fetch real-time gold price from WebSocket
  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;

    const connectWS = () => {
      const wsUrl = `${CONFIG.apiUrl.replace('https', 'wss')}/ws/gold`;
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.xau_usd && data.xau_usd.instruments && data.xau_usd.instruments.length > 0) {
            const priceVal = parseFloat(data.xau_usd.instruments[0].currentPrice);
            if (!isNaN(priceVal)) {
              setLiveGoldPrice(priceVal);
            }
          }
        } catch (err) {
          console.error("MobilePositions Gold WS parse error:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("MobilePositions Gold WS error:", err);
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connectWS, 3000);
      };
    };

    connectWS();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

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
          console.error("MobilePositions Spread WS parsing error:", err);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connectWS, 3000);
      };

      ws.onerror = (err) => {
        console.error("MobilePositions Spread WS error:", err);
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

  const borrowRateHourlyRaw = getSnapshotConfigValue(snapshot, 'borrowRateHourly');

  const [activeTab, setActiveTab] = useState('open');
  const [apiTrades, setApiTrades] = useState([]);
  const { writeContractAsync } = useWriteContract();
  const [actionLoading, setActionLoading] = useState(false);
  const { showNotification } = useNotifications();

  const handleCancelOrder = async (tradeId) => {
    if (!isConnected) return;
    setActionLoading(true);
    showNotification('Sending cancellation transaction...', 'info');
    try {
      const hash = await writeContractAsync({
        address: CONFIG.addresses.core,
        abi: coreAbi,
        functionName: 'cancelOrder',
        args: [BigInt(tradeId)],
        chainId: CONFIG.chainId,
      });
      showNotification('Cancel order transaction submitted successfully!', 'success', hash);
      // Refresh positions
      setTimeout(() => {
        fetch(`${CONFIG.apiUrl}/trades/${address}?network=${CONFIG.network}`)
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data)) setApiTrades(data);
          });
      }, 3000);
    } catch (err) {
      console.error("Cancel order failed:", err);
      showNotification(`Cancel failed: ${err.shortMessage || err.message || err}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClosePosition = async (tradeId) => {
    if (!isConnected) return;
    setActionLoading(true);
    showNotification('Fetching proofs and closing position...', 'info');
    try {
      const trade = apiTrades.find(t => Number(t.id) === Number(tradeId));
      if (!trade) throw new Error("Position not found");
      const supraId = Number(trade.supraId || 5500);

      // 1. Fetch oracle proof
      const proofRes = await fetch(`${CONFIG.apiUrl}/proof?pairs=${supraId}&network=${CONFIG.network}`);
      if (!proofRes.ok) throw new Error("Failed to fetch oracle proof");
      const proofData = await proofRes.json();
      const oracleProof = proofData.proof;

      // 2. Fetch KMS proof
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

      // 3. Call closePositionMarket
      const hash = await writeContractAsync({
        address: CONFIG.addresses.core,
        abi: coreAbi,
        functionName: 'closePositionMarket',
        args: [BigInt(supraId), BigInt(tradeId), oracleProof, riskProof],
        chainId: CONFIG.chainId,
      });
      showNotification('Close position transaction submitted successfully!', 'success', hash);
      // Refresh positions
      setTimeout(() => {
        fetch(`${CONFIG.apiUrl}/trades/${address}?network=${CONFIG.network}`)
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data)) setApiTrades(data);
          });
      }, 3000);
    } catch (err) {
      console.error("Close position failed:", err);
      showNotification(`Close failed: ${err.shortMessage || err.message || err}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    if (!isConnected || !address) {
      setApiTrades([]);
      return;
    }

    const fetchTrades = () => {
      fetch(`${CONFIG.apiUrl}/trades/${address}?network=${CONFIG.network}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setApiTrades(data);
          }
        })
        .catch(err => console.error("Failed to fetch trades:", err));
    };

    // Initial fetch
    fetchTrades();

    // 1. Polling interval every 10 seconds
    const interval = setInterval(fetchTrades, 10000);

    // 2. Immediate update on trade actions (from OrderPanel or custom triggers)
    const handleTradeUpdated = () => {
      fetchTrades();
    };
    window.addEventListener('trade-updated', handleTradeUpdated);

    return () => {
      clearInterval(interval);
      window.removeEventListener('trade-updated', handleTradeUpdated);
    };
  }, [address, isConnected]);

  const activePositions = apiTrades.filter(t => t.state === 1).map(t => mapApiTrade(t, liveGoldPrice, spreadLong, spreadShort, borrowRateHourlyRaw));
  const activeOrders = apiTrades.filter(t => t.state === 0).map(t => mapApiTrade(t, liveGoldPrice, spreadLong, spreadShort, borrowRateHourlyRaw));
  const activeHistory = apiTrades.filter(t => t.state >= 2).map(t => mapApiTrade(t, liveGoldPrice, spreadLong, spreadShort, borrowRateHourlyRaw));

  const positions = isConnected ? activePositions : [];
  const orders = isConnected ? activeOrders : [];
  const history = isConnected ? activeHistory : [];

  const currentList = activeTab === 'open' ? positions : activeTab === 'orders' ? orders : history;

  return (
    <div style={{
      background: 'var(--panel-bg)',
      borderTop: isFullPage ? 'none' : '1px solid var(--border-color)',
      borderLeft: 'none',
      borderRight: 'none',
      borderBottom: 'none',
      borderRadius: '0px',
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: 'auto',
      overflow: 'visible'
    }}>
      {/* Tabs Header */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-color)',
        padding: '12px 12px 0px 12px',
        justifyContent: 'flex-start',
        gap: '16px',
        background: 'rgba(255,255,255,0.01)',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        {['open', 'orders', 'history'].map(tab => {
          const count = tab === 'open' ? positions.length : tab === 'orders' ? orders.length : history.length;
          const isActive = activeTab === tab;
          const labelText = tab === 'open' ? `Open [${count}]` : tab === 'orders' ? `Orders [${count}]` : `History [${count}]`;
          return (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${isActive ? goldAccent : 'transparent'}`,
                color: isActive ? 'var(--text-dark)' : 'var(--text-grey)',
                fontSize: '11px',
                fontWeight: '600',
                padding: '6px 0px 8px 0px',
                borderRadius: '0px',
                cursor: 'pointer',
                textTransform: 'uppercase',
                transition: 'all 0.2s'
              }}
            >
              {labelText}
            </button>
          );
        })}
      </div>

      {/* Cards List container */}
      <div style={{
        padding: '0 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0px',
        flexShrink: 0,
        maxHeight: 'none',
        overflow: 'visible'
      }}>
        {!isConnected ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '40px 24px', 
            gap: '8px',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '13px', color: 'var(--text-dark)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Wallet Not Connected
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-grey)', maxWidth: '240px', lineHeight: '1.5', marginBottom: '4px' }}>
              Connect your Web3 wallet to manage, track, and close your active gold futures positions.
            </span>
            <button 
              onClick={openConnectModal}
              style={{
                background: goldAccent,
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '11px',
                fontWeight: 'bold',
                marginTop: '8px',
                cursor: 'pointer'
              }}
            >
              CONNECT WALLET
            </button>
          </div>
        ) : currentList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-grey)', fontSize: '11px' }}>
            NO ACTIVE ITEMS
          </div>
        ) : (
          currentList.map((item, idx) => (
            <div 
              key={idx}
              style={{
                background: 'transparent',
                borderBottom: idx !== currentList.length - 1 ? '1px solid var(--border-color)' : 'none',
                padding: '12px 0px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              {/* Card Title Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{item.asset}</span>
                  <span style={{
                    fontSize: '8px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                    background: item.side === 'Long' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: item.side === 'Long' ? '#3b82f6' : '#ef4444'
                  }}>
                    {item.side.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '10px', fontFamily: 'Source Code Pro', color: '#BC8961', fontWeight: 'bold' }}>
                    {item.leverage}
                  </span>
                </div>
                
                <span style={{ fontSize: '10px', fontFamily: 'Source Code Pro', color: 'var(--text-grey)' }}>
                  {item.id}
                </span>
              </div>

              {/* Grid Values */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '6px 12px',
                fontSize: '11px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-grey)' }}>Size:</span>
                  <span style={{ fontWeight: '500', fontFamily: 'Source Code Pro' }}>{item.size}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-grey)' }}>Collateral:</span>
                  <span style={{ fontWeight: '500', fontFamily: 'Source Code Pro' }}>{item.collateral}</span>
                </div>
                
                {activeTab === 'open' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-grey)' }}>Market Price:</span>
                      <span style={{ fontWeight: '500', fontFamily: 'Source Code Pro' }}>{item.marketPrice}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-grey)' }}>Liq. Price:</span>
                      <span style={{ color: '#ef4444', fontFamily: 'Source Code Pro', fontWeight: '500' }}>{item.liqPrice}</span>
                    </div>
                  </>
                )}

                {activeTab === 'orders' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-grey)' }}>Trigger Price:</span>
                      <span style={{ fontWeight: '500', fontFamily: 'Source Code Pro' }}>{item.orderPrice}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-grey)' }}>Status:</span>
                      <span style={{ color: goldAccent, fontWeight: 'bold' }}>{item.status}</span>
                    </div>
                  </>
                )}

                {activeTab === 'history' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-grey)' }}>Close Price:</span>
                      <span style={{ fontWeight: '500', fontFamily: 'Source Code Pro' }}>{item.closePrice}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-grey)' }}>Closed:</span>
                      <span style={{ color: 'var(--text-grey)', fontWeight: 'bold' }}>Settled</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gridColumn: 'span 2', paddingTop: '4px', borderTop: '1px dashed var(--border-color)' }}>
                      <span style={{ color: 'var(--text-grey)' }}>Borrow Fee Paid:</span>
                      <span style={{ fontWeight: '600', fontFamily: 'Source Code Pro', color: 'var(--text-dark)' }}>{item.borrowFee}</span>
                    </div>
                  </>
                )}
              </div>

              {/* SL / TP or Timestamps row */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 8px',
                background: 'rgba(255,255,255,0.01)',
                border: '1px dashed var(--border-color)',
                borderRadius: '6px',
                fontSize: '10px'
              }}>
                {activeTab === 'history' ? (
                  <>
                    <div>
                      <span style={{ color: 'var(--text-grey)', marginRight: '4px' }}>Opened:</span>
                      <span style={{ fontFamily: 'Source Code Pro', fontWeight: '500' }}>{item.openTimeStr}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-grey)', marginRight: '4px' }}>Closed:</span>
                      <span style={{ fontFamily: 'Source Code Pro', fontWeight: '500' }}>{item.closeTimeStr}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span style={{ color: 'var(--text-grey)', marginRight: '4px' }}>TP:</span>
                      <span style={{ color: '#3b82f6', fontFamily: 'Source Code Pro', fontWeight: '500' }}>{item.tp}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-grey)', marginRight: '4px' }}>SL:</span>
                      <span style={{ color: '#ef4444', fontFamily: 'Source Code Pro', fontWeight: '500' }}>{item.sl}</span>
                    </div>
                  </>
                )}
              </div>

              {/* PnL and Actions block */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '4px',
                paddingTop: '8px',
                borderTop: '1px solid rgba(255,255,255,0.03)'
              }}>
                <div>
                  {(activeTab === 'open' || activeTab === 'history') && (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-grey)' }}>Unrealized PnL</span>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 'bold',
                        fontFamily: 'Source Code Pro',
                        color: item.pnlUsd.startsWith('+') ? '#3b82f6' : '#ef4444'
                      }}>
                        {item.pnlUsd} <span style={{ fontSize: '10px', fontWeight: '500' }}>({item.pnlPct})</span>
                      </span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  {activeTab === 'open' && (
                    <>
                      <button
                        onClick={() => onManagePosition(item, 'collateral')}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-dark)',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          padding: '4px 8px',
                          cursor: 'pointer'
                        }}
                      >
                        + MARGIN
                      </button>
                      <button
                        onClick={() => handleClosePosition(item.raw.id)}
                        disabled={actionLoading}
                        style={{
                          background: 'transparent',
                          border: `1px solid ${sellColor}`,
                          color: sellColor,
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          padding: '4px 8px',
                          cursor: actionLoading ? 'not-allowed' : 'pointer',
                          opacity: actionLoading ? 0.5 : 1
                        }}
                      >
                        {actionLoading ? '...' : 'CLOSE'}
                      </button>
                    </>
                  )}
                  {activeTab === 'orders' && (
                    <button
                      onClick={() => handleCancelOrder(item.raw.id)}
                      disabled={actionLoading}
                      style={{
                        background: 'transparent',
                        border: `1px solid ${sellColor}`,
                        color: sellColor,
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        padding: '4px 8px',
                        cursor: actionLoading ? 'not-allowed' : 'pointer',
                        opacity: actionLoading ? 0.5 : 1
                      }}
                    >
                      {actionLoading ? '...' : 'CANCEL'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
