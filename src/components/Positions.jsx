import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useReadContract } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import PositionManager from './PositionManager'
import { coreAbi } from '../abi/core'
import { lensAbi } from '../abi/lens'
import { CONFIG } from '../config'
import { useNotifications } from '../context/NotificationContext'

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

  // Decimal rate = (borrowRateHourlyRaw / 100) / 100
  const borrowRateDecimal = borrowRateHourlyRaw !== null 
    ? (Number(borrowRateHourlyRaw) / 100) / 100 
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
    openPrice: openPriceStr,
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

const SkeletonRow = ({ showOpenPrice = true, activeTab }) => (
  <div
    className="skeleton-row"
    style={{
      display: 'flex',
      width: '100%',
      padding: '6px 15px',
      alignItems: 'center',
      borderBottom: '1px solid rgba(255,255,255,0.02)',
      height: '32px'
    }}
  >
    <div style={{ width: '60px' }}><div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', width: '30px' }} /></div>
    <div style={{ width: '140px', display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', width: '50px' }} />
      <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', width: '25px' }} />
    </div>
    <div style={{ flex: 1 }}><div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', width: '40px' }} /></div>
    <div style={{ flex: 1 }}><div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', width: '20px' }} /></div>
    <div style={{ flex: 1 }}><div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', width: '35px' }} /></div>
    <div style={{ flex: 1 }}><div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', width: '45px' }} /></div>
    {showOpenPrice && <div style={{ flex: 1 }}><div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', width: '45px' }} /></div>}
    <div style={{ flex: 1 }}><div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', width: '30px' }} /></div>
    <div style={{ flex: 1 }}><div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', width: '30px' }} /></div>
    <div style={{ flex: 1 }}><div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', width: '45px' }} /></div>
    <div style={{ flex: 1.5, display: 'flex', justifyContent: 'flex-end' }}><div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', width: '60px' }} /></div>
    {activeTab !== 'history' && <div style={{ width: '80px', display: 'flex', justifyContent: 'flex-end' }}><div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', width: '45px' }} /></div>}
  </div>
);

export default function Positions() {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [activeTab, setActiveTab] = useState('open')
  const [filter, setFilter] = useState('all')
  const [selectedPosition, setSelectedPosition] = useState(null)
  const [isManagerOpen, setIsManagerOpen] = useState(false)
  const [apiTrades, setApiTrades] = useState([]);
  const { writeContractAsync } = useWriteContract();
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
          console.error("Positions Gold WS parse error:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("Positions Gold WS error:", err);
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
          console.error("Positions Spread WS parsing error:", err);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connectWS, 3000);
      };

      ws.onerror = (err) => {
        console.error("Positions Spread WS error:", err);
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

  const openManager = (pos) => {
    setSelectedPosition(pos);
    setIsManagerOpen(true);
  };

  const sortedTrades = [...apiTrades].sort((a, b) => {
    const idA = BigInt(a.id || 0);
    const idB = BigInt(b.id || 0);
    if (idA < idB) return 1;
    if (idA > idB) return -1;
    return 0;
  });

  const activePositions = sortedTrades.filter(t => t.state === 1).map(t => mapApiTrade(t, liveGoldPrice, spreadLong, spreadShort, borrowRateHourlyRaw));
  const activeOrders = sortedTrades.filter(t => t.state === 0).map(t => mapApiTrade(t, liveGoldPrice, spreadLong, spreadShort, borrowRateHourlyRaw));
  const activeHistory = sortedTrades.filter(t => t.state >= 2).map(t => mapApiTrade(t, liveGoldPrice, spreadLong, spreadShort, borrowRateHourlyRaw));

  const positions = isConnected ? activePositions : [];
  const orders = isConnected ? activeOrders : [];
  const history = isConnected ? activeHistory : [];

  return (
    <div className="positions panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{`
        .custom-positions-scroll::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-positions-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-positions-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.03);
          border-radius: 4px;
          transition: background 0.3s ease;
        }
        body.light-mode .custom-positions-scroll::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.03);
        }
        .custom-positions-scroll:hover::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
        }
        body.light-mode .custom-positions-scroll:hover::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.15);
        }
        .custom-positions-scroll::-webkit-scrollbar-thumb:hover {
          background: #BC8961;
        }
        body.light-mode .custom-positions-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--gold);
        }
      `}</style>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 10px',
        height: '40px',
        flexShrink: 0,
        borderBottom: '1px solid var(--border-color)'
      }}>
        {/* Left Tabs */}
        <div style={{ display: 'flex', gap: '5px' }}>
          {['open', 'orders', 'history'].map(tab => {
            const count = tab === 'open' ? positions.length : tab === 'orders' ? orders.length : history.length;
            const labelText = tab === 'open' ? `open positions [${count}]` : tab === 'orders' ? `orders [${count}]` : `history [${count}]`;
            return (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  const currentHeightStr = getComputedStyle(document.documentElement).getPropertyValue('--positions-height');
                  const currentHeight = parseFloat(currentHeightStr) || 280;
                  const threshold = window.innerHeight * 0.20;
                  if (currentHeight < threshold) {
                    document.documentElement.style.setProperty('--positions-height', '280px');
                  }
                }}
                style={{
                  background: 'transparent',
                  border: activeTab === tab ? '1px solid #BC8961' : '1px solid transparent',
                  color: activeTab === tab ? '#BC8961' : 'var(--text-grey)',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textTransform: 'uppercase'
                }}
              >{labelText}</button>
            );
          })}
        </div>

        {/* Right Section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '5px', background: 'rgba(255,255,255,0.03)', padding: '3px', borderRadius: '8px' }}>
            {['all', 'xau'].map(f => (
              <button
                key={f}
                onClick={() => {
                  setFilter(f);
                  const currentHeightStr = getComputedStyle(document.documentElement).getPropertyValue('--positions-height');
                  const currentHeight = parseFloat(currentHeightStr) || 280;
                  const threshold = window.innerHeight * 0.20;
                  if (currentHeight < threshold) {
                    document.documentElement.style.setProperty('--positions-height', '280px');
                  }
                }}
                style={{
                  background: 'transparent',
                  border: filter === f ? '1px solid #BC8961' : '1px solid transparent',
                  color: filter === f ? '#BC8961' : 'var(--text-grey)',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textTransform: 'uppercase'
                }}
                >{f}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="custom-positions-scroll" style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Table Header */}
          <div style={{
            display: 'flex',
            width: '100%',
            padding: '6px 15px',
            fontSize: '10px',
            color: 'var(--text-grey)',
            borderBottom: '1px solid var(--border-color)',
            textTransform: 'uppercase',
            fontWeight: '600',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            background: 'var(--panel-bg)',
            backdropFilter: 'blur(10px)',
            zIndex: 10
          }}>
            <div style={{ width: '60px' }}>ID</div>
            <div style={{ width: '140px' }}>Asset</div>
            <div style={{ flex: 1 }}>Size</div>
            <div style={{ flex: 1 }}>Lev.</div>
            <div style={{ flex: 1 }}>Coll.</div>
            <div style={{ flex: 1 }}>{activeTab === 'history' ? 'Status' : 'Liq. Price'}</div>
            {activeTab === 'open' && <div style={{ flex: 1 }}>Open Price</div>}
            <div style={{ flex: 1 }}>{activeTab === 'history' ? 'Open Time' : 'SL'}</div>
            <div style={{ flex: 1 }}>{activeTab === 'history' ? 'Close Time' : 'TP'}</div>
            <div style={{ flex: 1 }}>{activeTab === 'orders' ? 'Order' : activeTab === 'history' ? 'Close' : 'Market'}</div>
            {activeTab === 'history' && <div style={{ flex: 1, textAlign: 'right' }}>Borrow Fee</div>}
            <div style={{ flex: 1.5, textAlign: 'right' }}>{activeTab === 'orders' ? 'Status' : 'PnL (USD/%)'}</div>
            {activeTab !== 'history' && <div style={{ width: '80px', textAlign: 'right' }}>Action</div>}
          </div>

          {/* Table Content */}
          {!isConnected ? (
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              <style>{`
                @keyframes pulse-shimmer {
                  0% { opacity: 0.3; }
                  50% { opacity: 0.7; }
                  100% { opacity: 0.3; }
                }
                .skeleton-row {
                  animation: pulse-shimmer 1.8s infinite ease-in-out;
                }
              `}</style>
              <SkeletonRow showOpenPrice={activeTab === 'open'} activeTab={activeTab} />
              <SkeletonRow showOpenPrice={activeTab === 'open'} activeTab={activeTab} />
              <SkeletonRow showOpenPrice={activeTab === 'open'} activeTab={activeTab} />
              <SkeletonRow showOpenPrice={activeTab === 'open'} activeTab={activeTab} />
            </div>
          ) : (
            <>
              {activeTab === 'open' && (
                positions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-grey)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    No Open Positions
                  </div>
                ) : (
                  positions.map((pos, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      width: '100%',
                      padding: '6px 15px',
                      fontSize: '11px',
                      alignItems: 'center',
                      borderBottom: '1px solid rgba(255,255,255,0.02)',
                      height: '32px'
                    }} className="position-row">
                      <div style={{ width: '60px', fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)' }}>{pos.id}</div>
                      <div style={{ width: '140px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ minWidth: '65px' }}>{pos.asset}</span>
                        <span style={{ fontSize: '7px', padding: '1px 4px', borderRadius: '3px', background: pos.side === 'Long' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: pos.side === 'Long' ? '#3b82f6' : '#ef4444', fontWeight: 'bold' }}>{pos.side.toUpperCase()}</span>
                      </div>
                      <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', fontWeight: '500' }}>{pos.size}</div>
                      <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: '#BC8961', fontWeight: '600' }}>{pos.leverage}</div>
                      <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {pos.collateral}
                        <button
                          onClick={() => openManager(pos)}
                          style={{ background: 'transparent', border: 'none', color: '#BC8961', cursor: 'pointer', padding: '2px', display: 'flex' }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                        </button>
                      </div>
                      <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: '#ef4444' }}>{pos.liqPrice}</div>
                      <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)' }}>{pos.openPrice}</div>
                      <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {pos.sl}
                        <button
                          onClick={() => openManager(pos)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-grey)', cursor: 'pointer', padding: '2px', opacity: 0.6 }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                        </button>
                      </div>
                      <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {pos.tp}
                        <button
                          onClick={() => openManager(pos)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-grey)', cursor: 'pointer', padding: '2px', opacity: 0.6 }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                        </button>
                      </div>
                      <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px' }}>{pos.marketPrice}</div>
                      <div style={{ flex: 1.5, textAlign: 'right', fontFamily: 'Source Code Pro, monospace', fontSize: '10px', fontWeight: 'bold', color: pos.pnlUsd.startsWith('+') ? '#3b82f6' : '#ef4444' }}>
                        {pos.pnlUsd} <span style={{ fontSize: '9px', opacity: 0.8 }}>({pos.pnlPct})</span>
                      </div>
                      <div style={{ width: '80px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleClosePosition(pos.raw.id)}
                          disabled={actionLoading}
                          style={{
                            background: 'transparent',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#ef4444',
                            fontSize: '9px',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            cursor: actionLoading ? 'not-allowed' : 'pointer',
                            fontWeight: '600',
                            opacity: actionLoading ? 0.5 : 1
                          }}
                        >
                          {actionLoading ? '...' : 'CLOSE'}
                        </button>
                      </div>
                    </div>
                  ))
                )
              )}

              {activeTab === 'orders' && (
                orders.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-grey)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    No Active Orders
                  </div>
                ) : (
                  orders.map((order, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      width: '100%',
                      padding: '6px 15px',
                      fontSize: '11px',
                      alignItems: 'center',
                      borderBottom: '1px solid rgba(255,255,255,0.02)',
                      height: '32px'
                    }} className="position-row">
                      <div style={{ width: '60px', fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)' }}>{order.id}</div>
                      <div style={{ width: '140px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ minWidth: '65px' }}>{order.asset}</span>
                        <span style={{ fontSize: '7px', padding: '1px 4px', borderRadius: '3px', background: order.side === 'Long' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: order.side === 'Long' ? '#3b82f6' : '#ef4444', fontWeight: 'bold' }}>{order.side.toUpperCase()}</span>
                      </div>
                      <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', fontWeight: '500' }}>{order.size}</div>
                      <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: '#BC8961', fontWeight: '600' }}>{order.leverage}</div>
                      <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px' }}>{order.collateral}</div>
                      <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)' }}>{order.liqPrice}</div>
                      <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)' }}>{order.sl}</div>
                      <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)' }}>{order.tp}</div>
                      <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px' }}>{order.orderPrice}</div>
                      <div style={{ flex: 1.5, textAlign: 'right', fontWeight: 'bold', color: '#BC8961' }}>{order.status}</div>
                      <div style={{ width: '80px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleCancelOrder(order.raw.id)}
                          disabled={actionLoading}
                          style={{
                            background: 'transparent',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#ef4444',
                            fontSize: '9px',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            cursor: actionLoading ? 'not-allowed' : 'pointer',
                            fontWeight: '600',
                            opacity: actionLoading ? 0.5 : 1
                          }}
                        >
                          {actionLoading ? '...' : 'CANCEL'}
                        </button>
                      </div>
                    </div>
                  ))
                )
              )}

              {activeTab === 'history' && (
                history.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-grey)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    No Transaction History
                  </div>
                ) : (
                  history.map((hist, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      width: '100%',
                      padding: '6px 15px',
                      fontSize: '11px',
                      alignItems: 'center',
                      borderBottom: '1px solid rgba(255,255,255,0.02)',
                      height: '32px'
                    }} className="position-row">
                      <div style={{ width: '60px', fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)' }}>{hist.id}</div>
                      <div style={{ width: '140px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ minWidth: '65px' }}>{hist.asset}</span>
                        <span style={{ fontSize: '7px', padding: '1px 4px', borderRadius: '3px', background: hist.side === 'Long' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: hist.side === 'Long' ? '#3b82f6' : '#ef4444', fontWeight: 'bold' }}>{hist.side.toUpperCase()}</span>
                      </div>
                      <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', fontWeight: '500' }}>{hist.size}</div>
                      <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: '#BC8961', fontWeight: '600' }}>{hist.leverage}</div>
                      <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px' }}>{hist.collateral}</div>
                      <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)' }}>CLOSED</div>
                      <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '9px', color: 'var(--text-grey)' }}>{hist.openTimeStr}</div>
                      <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '9px', color: 'var(--text-grey)' }}>{hist.closeTimeStr}</div>
                      <div style={{ flex: 1, fontFamily: 'Source Code Pro, monospace', fontSize: '10px' }}>{hist.closePrice}</div>
                      <div style={{ flex: 1, textAlign: 'right', fontFamily: 'Source Code Pro, monospace', fontSize: '10px', color: 'var(--text-grey)' }}>{hist.borrowFee}</div>
                      <div style={{ flex: 1.5, textAlign: 'right', fontFamily: 'Source Code Pro, monospace', fontSize: '10px', fontWeight: 'bold', color: hist.pnlUsd.startsWith('+') ? '#3b82f6' : '#ef4444' }}>
                        {hist.pnlUsd} <span style={{ fontSize: '9px', opacity: 0.8 }}>({hist.pnlPct})</span>
                      </div>
                    </div>
                  ))
                )
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        .position-row:hover {
          background: rgba(255,255,255,0.03);
        }
      `}</style>

      <PositionManager
        isOpen={isManagerOpen}
        onClose={() => setIsManagerOpen(false)}
        position={selectedPosition}
      />
    </div>
  )
}
