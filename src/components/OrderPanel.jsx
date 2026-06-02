import { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useTrade } from '../hooks/useTrade';
import { useNotifications } from '../context/NotificationContext';
import { coreAbi } from '../abi/core';
import { lensAbi } from '../abi/lens';
import { CONFIG } from '../config';

const goldAccent = '#BC8961';
const goldAccentLight = 'rgba(188, 137, 97, 0.15)';

export default function OrderPanel() {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { executeTrade, isLoading, statusText } = useTrade();
  const { showNotification } = useNotifications();

  const [usdcBalance, setUsdcBalance] = useState('0.00');
  const [network, setNetwork] = useState(() => (typeof window !== 'undefined' && localStorage.getItem('brokex_network')) || 'testnet');

  const handleNetworkChange = (newNet) => {
    if (newNet === network) return;
    setNetwork(newNet);
    localStorage.setItem('brokex_network', newNet);
    // Let the smooth CSS color transition finish before reloading
    setTimeout(() => {
      window.location.reload();
    }, 250);
  };

  useEffect(() => {
    if (!address) {
      setUsdcBalance('0.00');
      return;
    }

    const fetchBalance = async () => {
      try {
        const cleanAddr = address.replace('0x', '').toLowerCase().padStart(64, '0');
        const callData = '0x70a08231' + cleanAddr;
        const response = await fetch(CONFIG.rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_call',
            params: [
              {
                to: CONFIG.addresses.usdc,
                data: callData
              },
              'latest'
            ],
            id: 1
          })
        });
        const resData = await response.json();
        if (resData && resData.result && resData.result !== '0x') {
          const rawBal = BigInt(resData.result);
          setUsdcBalance((Number(rawBal) / 1e6).toFixed(2));
        } else {
          setUsdcBalance('0.00');
        }
      } catch (err) {
        console.error("Failed to fetch direct USDC balance:", err);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 5000);
    return () => clearInterval(interval);
  }, [address]);

  // Fetch real-time gold price from WebSocket
  const [livePrice, setLivePrice] = useState('2,315.00');
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
          console.error("OrderPanel Spread WS parsing error:", err);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connectWS, 3000);
      };

      ws.onerror = (err) => {
        console.error("OrderPanel Spread WS error:", err);
      };
    };

    connectWS();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

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
              setLivePrice(priceVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
            }
          }
        } catch (err) {
          console.error("OrderPanel WS parse error:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("OrderPanel WS error:", err);
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

  // Fetch real-time asset snapshot from smart contract Lens
  const { data: snapshot } = useReadContract({
    address: CONFIG.addresses.lens,
    abi: lensAbi,
    functionName: 'getAssetSnapshot',
    args: [5500n],
    chainId: CONFIG.chainId,
    query: {
      refetchInterval: 15000, // Refetch every 15 seconds
    }
  });

  // Extract config fields from snapshot with safe defaults
  let minLeverageNum = 1;
  let maxLeverageNum = 30;
  let commissionBps = 14; // Default to 14 Bps (0.0014)
  let minTradeSize = 1; // Default minimum trade size

  if (snapshot) {
    let target = snapshot;
    if (Array.isArray(snapshot) && snapshot.length === 1 && typeof snapshot[0] === 'object') {
      target = snapshot[0];
    }
    const snapConfig = target.config || target[4];
    if (snapConfig) {
      if (snapConfig.minLeverage !== undefined) minLeverageNum = Number(snapConfig.minLeverage);
      if (snapConfig.maxLeverage !== undefined) maxLeverageNum = Number(snapConfig.maxLeverage);
      if (snapConfig.commissionBps !== undefined) commissionBps = Number(snapConfig.commissionBps);
      if (snapConfig.minTradeSize !== undefined) minTradeSize = Number(snapConfig.minTradeSize) / 1e6;
    }
  }

  const handleTpPercent = (pctStr) => {
    const pct = parseFloat(pctStr) / 100;
    const entryPrice = parseFloat(targetPrice) || parseFloat(livePrice.replace(/,/g, '')) || 2315.00;
    let tp;
    if (side === 'buy') {
      tp = entryPrice * (1 + pct / leverage);
    } else {
      tp = entryPrice * (1 - pct / leverage);
    }
    setTpPrice(parseFloat(tp.toFixed(2)).toString());
  };

  const handleSlPercent = (pctStr) => {
    const pct = parseFloat(pctStr) / 100;
    const entryPrice = parseFloat(targetPrice) || parseFloat(livePrice.replace(/,/g, '')) || 2315.00;
    let sl;
    if (side === 'buy') {
      sl = entryPrice * (1 - pct / leverage);
    } else {
      sl = entryPrice * (1 + pct / leverage);
    }
    setSlPrice(parseFloat(sl.toFixed(2)).toString());
  };

  const handleSubmit = async () => {
    if (!isConnected) {
      if (openConnectModal) openConnectModal();
      return;
    }
    const collateralNum = parseFloat(collateralAmount);
    if (isNaN(collateralNum) || collateralNum < minTradeSize) {
      showNotification(`Minimum trade size is ${minTradeSize} USDC`, 'error');
      return;
    }
    if (orderType !== 'market' && (!targetPrice || isNaN(parseFloat(targetPrice)) || parseFloat(targetPrice) <= 0)) {
      setHasPriceError(true);
      setTimeout(() => setHasPriceError(false), 2500);
      showNotification('Please enter a valid target price', 'error');
      return;
    }
    try {
      showNotification(`Submitting ${orderType} trade...`, 'info');
      const receipt = await executeTrade({
        side,
        orderType,
        collateral: collateralAmount,
        leverage,
        targetPrice,
        tpPrice: tpSlEnabled ? tpPrice : '',
        slPrice: tpSlEnabled ? slPrice : '',
        guaranteedSL: guaranteedSL && tpSlEnabled,
      });
      showNotification(`${orderType.charAt(0).toUpperCase() + orderType.slice(1)} trade placed successfully!`, 'success', receipt.transactionHash);
      window.dispatchEvent(new CustomEvent('trade-updated'));
    } catch (err) {
      showNotification(`Trade failed: ${err.message}`, 'error');
    }
  };

  const [side, setSide] = useState('buy');
  const [orderType, setOrderType] = useState('market');
  const [leverage, setLeverage] = useState(10);
  const [collateralAmount, setCollateralAmount] = useState('10');
  const [targetPrice, setTargetPrice] = useState('');
  const [hasPriceError, setHasPriceError] = useState(false);
  const [sizeCurrency, setSizeCurrency] = useState('USD');
  const [tpSlEnabled, setTpSlEnabled] = useState(false);
  const [tpPrice, setTpPrice] = useState('');
  const [slPrice, setSlPrice] = useState('');
  const [guaranteedSL, setGuaranteedSL] = useState(false);

  // Adjust default leverage if dynamic maxLeverage decreases
  useEffect(() => {
    if (leverage > maxLeverageNum) {
      setLeverage(maxLeverageNum);
    } else if (leverage < minLeverageNum) {
      setLeverage(minLeverageNum);
    }
  }, [minLeverageNum, maxLeverageNum]);

  const selectedAsset = 'XAU';

  let leverageStops = [];
  if (maxLeverageNum === 100) {
    leverageStops = [2, 10, 25, 50, 75, 100];
  } else if (maxLeverageNum === 50) {
    leverageStops = [2, 10, 20, 30, 40, 50];
  } else if (maxLeverageNum === 30) {
    leverageStops = [2, 5, 10, 15, 20, 30];
  } else {
    // Dynamic fallback for other custom values
    leverageStops.push(minLeverageNum);
    const candidates = [];
    for (let i = 10; i < maxLeverageNum; i += 10) {
      if (i > minLeverageNum) candidates.push(i);
    }
    if (candidates.length < 4) {
      for (let i = 5; i < maxLeverageNum; i += 10) {
        if (i > minLeverageNum && !candidates.includes(i)) candidates.push(i);
      }
      candidates.sort((a, b) => a - b);
    }
    if (candidates.length < 4) {
      for (let i = minLeverageNum + 1; i < maxLeverageNum; i++) {
        if (!candidates.includes(i)) candidates.push(i);
      }
      candidates.sort((a, b) => a - b);
    }
    let intermediate = [];
    if (candidates.length <= 4) {
      intermediate = candidates;
    } else {
      const step = (candidates.length - 1) / 3;
      for (let i = 0; i < 4; i++) {
        const idx = Math.round(i * step);
        if (!intermediate.includes(candidates[idx])) intermediate.push(candidates[idx]);
      }
    }
    leverageStops.push(...intermediate);
    if (!leverageStops.includes(maxLeverageNum)) {
      leverageStops.push(maxLeverageNum);
    }
    leverageStops.sort((a, b) => a - b);
  }
  const overnightMaxLeverageNum = maxLeverageNum;

  const percentage = maxLeverageNum > minLeverageNum
    ? ((leverage - minLeverageNum) / (maxLeverageNum - minLeverageNum)) * 100
    : 0;
  const sliderBackground = `linear-gradient(to right, ${goldAccent} ${percentage}%, var(--border-color) ${percentage}%)`;

  const collatNum = Number(collateralAmount || 0);
  const estimatedSizeUSDNum = collatNum * leverage;
  const currentPriceNum = parseFloat(livePrice.replace(/,/g, '')) || 2315.00;
  const longPriceNum = currentPriceNum * (1 + spreadLong / 1000000);
  const shortPriceNum = currentPriceNum * (1 - spreadShort / 1000000);
  const formattedLongPrice = longPriceNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedShortPrice = shortPriceNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  const openFeeVal = (collatNum * leverage * (commissionBps / 1000000)).toFixed(2);
  const totalFeesVal = openFeeVal;

  const displaySize = sizeCurrency === 'USD'
    ? `$${Math.round(estimatedSizeUSDNum).toLocaleString('en-US')}`
    : (estimatedSizeUSDNum / currentPriceNum).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

  const themeBg = 'var(--panel-bg)';
  const themeControlBg = 'var(--bg-subtle)';
  const themeBorder = 'var(--border-color)';
  const themeText = 'var(--text-dark)';
  const themeTextMuted = 'var(--text-grey)';
  const buyColor = '#3b82f6'; // blue
  const sellColor = '#ef4444'; // red
  const buyColorBg = 'rgba(59, 130, 246, 0.1)';
  const sellColorBg = 'rgba(239, 68, 68, 0.1)';

  return (
    <div className="order panel" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden', // Disable main container scroll
      padding: '8px',
      boxSizing: 'border-box',
      gap: '8px',
      backgroundColor: themeBg,
      color: themeText,
      fontSize: '12px'
    }}>
      <style>{`
        .order.panel::-webkit-scrollbar {
          display: none;
        }
        .order.panel {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
        
        .no-spinners::-webkit-outer-spin-button,
        .no-spinners::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .no-spinners {
          -moz-appearance: textfield;
        }

        .custom-leverage-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 4px;
          border-radius: 2px;
          outline: none;
          cursor: pointer;
        }
        .custom-leverage-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          border: 1px solid #333;
          box-shadow: 0 0 4px rgba(0,0,0,0.3);
        }

        .order-input-container {
          border: 1px solid var(--border-color) !important;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
        }
        
        .order-input-container:hover {
          border-color: rgba(200, 169, 126, 0.25) !important;
          background-color: rgba(200, 169, 126, 0.01) !important;
        }
        
        .order-input-container:focus-within {
          border-color: var(--gold) !important;
          box-shadow: 0 0 0 1px rgba(200, 169, 126, 0.15) !important;
          background-color: rgba(200, 169, 126, 0.02) !important;
        }

        .order-input-container input:focus,
        .order-input-container input:focus-visible {
          outline: none !important;
          box-shadow: none !important;
        }
      `}</style>

      {/* Scrollable Form Fields and Metrics */}
      <div 
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          paddingRight: '1px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
        className="hide-scrollbar"
      >
        <style>{`
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        {/* Top Tabs (Long/Short) */}
        <div style={{ display: 'flex', flexShrink: 0, backgroundColor: themeControlBg, borderRadius: '6px', padding: '3px', border: `1px solid ${themeBorder}` }}>
        <div
          onClick={() => setSide('buy')}
          style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '6px 8px', cursor: 'pointer', borderRadius: '4px', backgroundColor: side === 'buy' ? buyColorBg : 'transparent', border: `1px solid ${side === 'buy' ? buyColor : 'transparent'}`, transition: 'all 0.15s' }}>
          <div style={{ color: side === 'buy' ? buyColor : themeTextMuted, fontWeight: side === 'buy' ? 600 : 400, fontSize: '12px' }}>Long</div>
          <div style={{ color: side === 'buy' ? buyColor : themeTextMuted, fontSize: '11px', fontFamily: 'Source Code Pro, monospace' }}>{formattedLongPrice}</div>
        </div>
        <div
          onClick={() => setSide('sell')}
          style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '6px 8px', cursor: 'pointer', borderRadius: '4px', backgroundColor: side === 'sell' ? sellColorBg : 'transparent', border: `1px solid ${side === 'sell' ? sellColor : 'transparent'}`, transition: 'all 0.15s' }}>
          <div style={{ color: side === 'sell' ? sellColor : themeTextMuted, fontWeight: side === 'sell' ? 600 : 400, fontSize: '12px' }}>Short</div>
          <div style={{ color: side === 'sell' ? sellColor : themeTextMuted, fontSize: '11px', fontFamily: 'Source Code Pro, monospace' }}>{formattedShortPrice}</div>
        </div>
      </div>

      {/* Market / Limit / Stop */}
      <div style={{ display: 'flex', flexShrink: 0, backgroundColor: themeControlBg, borderRadius: '6px', padding: '3px', border: `1px solid ${themeBorder}` }}>
        {['market', 'limit', 'stop'].map(type => (
          <div
            key={type}
            onClick={() => setOrderType(type)}
            style={{
              flex: 1, textAlign: 'center', padding: '6px', cursor: 'pointer', borderRadius: '4px',
              backgroundColor: orderType === type ? goldAccentLight : 'transparent',
              color: orderType === type ? goldAccent : themeTextMuted,
              border: `1px solid ${orderType === type ? goldAccent : 'transparent'}`,
              fontSize: '11px', fontWeight: orderType === type ? 600 : 400, textTransform: 'capitalize', transition: 'all 0.15s'
            }}>
            {type}
          </div>
        ))}
      </div>

      {/* Available to Trade */}
      <div style={{ display: 'flex', flexShrink: 0, justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', padding: '0 2px' }}>
        <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}`, cursor: 'help' }}>Available to Trade</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace' }}>{Number(usdcBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC</span>
        </div>
      </div>

      {/* Target Price (Limit/Stop only) */}
      {orderType !== 'market' && (
        <div className="order-input-container" style={{
          flexShrink: 0,
          backgroundColor: themeControlBg,
          borderRadius: '6px',
          padding: '4px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          border: hasPriceError ? '1px solid #BC8961' : '1px solid transparent',
          transition: 'border-color 0.3s ease'
        }}>
          <span style={{ fontSize: '11px', color: themeTextMuted, textTransform: 'capitalize' }}>
            {orderType} price
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '16px', fontWeight: 600, color: goldAccent }}>
              {orderType === 'limit' ? (side === 'buy' ? '≤' : '≥') : (side === 'buy' ? '≥' : '≤')}
            </span>
            <input
              type="number"
              className="no-spinners"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder="None"
              style={{ fontSize: '13px', color: themeText, backgroundColor: 'transparent', border: 'none', outline: 'none', width: '100%', fontWeight: 600, fontFamily: 'Source Code Pro, monospace' }}
            />
          </div>
        </div>
      )}

      {/* Collateral & Estimated Size */}
      <div className="order-input-container" style={{ flexShrink: 0, backgroundColor: themeControlBg, borderRadius: '6px', display: 'flex', flexDirection: 'column' }}>
        {/* Collateral */}
        <div style={{ padding: '6px 8px', borderBottom: `1px solid ${themeBorder}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', color: themeTextMuted }}>Collateral</span>
            <span style={{ fontSize: '11px', color: themeTextMuted, cursor: 'pointer' }} onClick={() => setCollateralAmount(usdcBalance)}>Max</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <input
              type="number"
              className="no-spinners"
              value={collateralAmount}
              onChange={(e) => setCollateralAmount(e.target.value)}
              style={{ fontSize: '14px', color: themeText, backgroundColor: 'transparent', border: 'none', outline: 'none', padding: 0, width: '120px', fontFamily: 'Source Code Pro, monospace' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: themeText, fontWeight: 500, fontSize: '12px' }}>
              USDC
            </div>
          </div>
        </div>

        {/* Estimated Size - Reduced vertical padding */}
        <div style={{ padding: '8px 8px', borderBottom: `1px solid ${themeBorder}` }}>
          <div style={{ fontSize: '11px', color: themeTextMuted, marginBottom: '2px' }}>Estimated Size</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: themeText, fontFamily: 'Source Code Pro, monospace' }}>
              {displaySize}
            </span>
            <div
              onClick={() => setSizeCurrency(prev => prev === 'USD' ? 'ASSET' : 'USD')}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', color: goldAccent, fontWeight: 600, fontSize: '11px', backgroundColor: goldAccentLight, border: `1px solid ${goldAccent}`, padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', userSelect: 'none', transition: 'all 0.2s' }}
            >
              <span>{sizeCurrency === 'USD' ? 'USD' : selectedAsset}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Leverage - Compact padding */}
      <div style={{ flexShrink: 0, backgroundColor: themeControlBg, borderRadius: '6px', border: `1px solid ${themeBorder}`, padding: '6px 8px', display: 'flex', flexDirection: 'column', marginTop: '2px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', color: themeTextMuted }}>Leverage</span>
          <span style={{ color: themeText, fontWeight: 600, fontSize: '13px', fontFamily: 'Source Code Pro, monospace' }}>{leverage}x</span>
        </div>
        <input
          type="range"
          min={minLeverageNum}
          max={maxLeverageNum}
          step="1"
          value={leverage}
          onChange={(e) => setLeverage(Number(e.target.value))}
          className="custom-leverage-slider"
          style={{ background: sliderBackground }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', gap: '6px' }}>
          {leverageStops.map(lev => (
            <button
              key={lev}
              onClick={() => setLeverage(lev)}
              style={{
                flex: 1, padding: '6px 0', fontSize: '10px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: leverage === lev ? goldAccentLight : themeBg,
                color: leverage === lev ? goldAccent : themeTextMuted,
                cursor: 'pointer', transition: 'all 0.1s'
              }}
            >
              {lev}x
            </button>
          ))}
        </div>
      </div>

      {/* TP / SL Management Section */}
      <div style={{ flexShrink: 0, backgroundColor: themeControlBg, borderRadius: '6px', border: `1px solid ${themeBorder}`, padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div 
          onClick={() => setTpSlEnabled(!tpSlEnabled)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
          <span style={{ fontSize: '11px', color: themeText, fontWeight: 600 }}>Take Profit / Stop Loss</span>
          <div style={{ 
            width: '32px', 
            height: '16px', 
            backgroundColor: tpSlEnabled ? goldAccent : 'rgba(128, 128, 128, 0.25)', 
            borderRadius: '8px', 
            position: 'relative',
            transition: 'all 0.2s'
          }}>
            <div style={{ 
              width: '12px', 
              height: '12px', 
              backgroundColor: '#fff', 
              borderRadius: '50%', 
              position: 'absolute',
              top: '2px',
              left: tpSlEnabled ? '18px' : '2px',
              transition: 'all 0.2s'
            }} />
          </div>
        </div>

        {tpSlEnabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Take Profit Row */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: themeTextMuted }}>Take Profit</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {['10%', '25%', '50%', '100%'].map(p => (
                    <div 
                      key={p} 
                      onClick={() => handleTpPercent(p)}
                      style={{ fontSize: '9px', padding: '2px 4px', borderRadius: '3px', backgroundColor: 'rgba(255,255,255,0.05)', color: themeTextMuted, cursor: 'pointer', border: `1px solid ${themeBorder}` }}
                    >
                      {p}
                    </div>
                  ))}
                </div>
              </div>
              <input 
                type="number"
                className="no-spinners"
                value={tpPrice}
                onChange={(e) => setTpPrice(e.target.value)}
                placeholder="Target Price"
                style={{ width: '100%', backgroundColor: themeControlBg, border: `1px solid ${themeBorder}`, borderRadius: '4px', padding: '6px', color: themeText, fontSize: '11px', outline: 'none', fontFamily: 'Source Code Pro, monospace' }}
              />
            </div>

            {/* Stop Loss Row */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: themeTextMuted }}>Stop Loss</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {['10%', '25%', '50%', '100%'].map(p => (
                    <div 
                      key={p} 
                      onClick={() => handleSlPercent(p)}
                      style={{ fontSize: '9px', padding: '2px 4px', borderRadius: '3px', backgroundColor: themeControlBg, color: themeTextMuted, cursor: 'pointer', border: `1px solid ${themeBorder}` }}
                    >
                      {p}
                    </div>
                  ))}
                </div>
              </div>
              <input 
                type="number"
                className="no-spinners"
                value={slPrice}
                onChange={(e) => setSlPrice(e.target.value)}
                placeholder="Stop Price"
                style={{ width: '100%', backgroundColor: themeControlBg, border: `1px solid ${themeBorder}`, borderRadius: '4px', padding: '6px', color: themeText, fontSize: '11px', outline: 'none', fontFamily: 'Source Code Pro, monospace' }}
              />

              {/* Guaranteed Stop Loss nested under Stop Loss */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '2px 0 2px 10px', 
                marginLeft: '4px',
                borderLeft: `1.5px solid ${guaranteedSL ? goldAccent : themeBorder}`,
                marginTop: '3px',
                transition: 'all 0.2s'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5px' }}>
                  <span style={{ fontSize: '9.5px', color: themeText, fontWeight: 500 }}>Guaranteed SL</span>
                  <span style={{ fontSize: '7.5px', color: themeTextMuted }}>Zero slippage execution</span>
                </div>
                <div 
                  onClick={() => setGuaranteedSL(!guaranteedSL)}
                  style={{ 
                     width: '12px', 
                     height: '12px', 
                     border: `1px solid ${guaranteedSL ? goldAccent : themeBorder}`, 
                     borderRadius: '2.5px', 
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'center',
                     cursor: 'pointer',
                     backgroundColor: guaranteedSL ? 'rgba(188, 137, 97, 0.1)' : 'transparent',
                     transition: 'all 0.2s',
                     flexShrink: 0
                  }}>
                  {guaranteedSL && (
                    <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke={goldAccent} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5"/>
                    </svg>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>




      {/* Action Button */}
      <div style={{ flexShrink: 0, display: 'flex', marginTop: '5px' }}>
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          style={{
            flex: 1,
            backgroundColor: isLoading ? 'var(--border-color)' : goldAccent,
            color: isLoading ? 'var(--text-grey)' : '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '11px 8px',
            fontSize: '13px',
            fontWeight: 800,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            transition: 'opacity 0.2s'
          }}>
          {isLoading ? 'Processing...' : (isConnected ? `Go ${side === 'buy' ? 'Long' : 'Short'}` : 'Connect Wallet')}
        </button>
      </div>

      {/* Metrics List */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', marginTop: '5px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}` }}>Amount</span>
          <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace' }}>{(estimatedSizeUSDNum / currentPriceNum).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} {selectedAsset}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}` }}>Exposure</span>
          <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace' }}>${Math.round(estimatedSizeUSDNum).toLocaleString('en-US')}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}` }}>Collateral at Open</span>
          <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace' }}>{Math.round(collatNum)} USDC</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}` }}>Liquidation Price</span>
          <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace' }}>
            {side === 'buy'
              ? Math.round(currentPriceNum * (1 - 0.9 / leverage)).toLocaleString('en-US')
              : Math.round(currentPriceNum * (1 + 0.9 / leverage)).toLocaleString('en-US')
            }
          </span>
        </div>

        <div style={{ height: '1px', backgroundColor: themeBorder, margin: '6px 0' }}></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}` }}>Oracle Fee</span>
          <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace' }}>$0</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}` }}>Open Fee</span>
          <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace' }}>${openFeeVal}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: themeTextMuted, borderBottom: `1px dashed ${themeBorder}` }}>Close Fee</span>
          <span style={{ color: themeText, fontFamily: 'Source Code Pro, monospace' }}>$0</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: `1px solid ${themeBorder}` }}>
          <span style={{ color: themeText, fontWeight: 600 }}>Total Fees</span>
          <span style={{ color: goldAccent, fontWeight: 600, fontFamily: 'Source Code Pro, monospace' }}>
            ~${totalFeesVal}
          </span>
        </div>
      </div>

      </div>

      {/* Dynamic Network Toggle & Social Links Footer */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 'auto',
        paddingTop: '12px',
        borderTop: `1px solid ${themeBorder}`,
        flexShrink: 0
      }}>
        {/* Left: Social Links Icons */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* X / Twitter */}
          <a 
            href="https://x.com/brokexfi" 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{ color: 'var(--text-grey)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={(e) => e.currentTarget.style.color = goldAccent}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-grey)'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>

          {/* Telegram */}
          <a 
            href="https://t.me/brokexfi" 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{ color: 'var(--text-grey)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={(e) => e.currentTarget.style.color = goldAccent}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-grey)'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          </a>

          {/* Docs */}
          <a 
            href="https://docs.brokex.trade" 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{ color: 'var(--text-grey)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={(e) => e.currentTarget.style.color = goldAccent}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-grey)'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <line x1="10" y1="9" x2="8" y2="9" />
            </svg>
          </a>
        </div>

        {/* Right: Testnet / Mainnet Sleek Toggle - Matching Ticker.jsx Button Height */}
        <div style={{
          display: 'flex',
          background: 'rgba(255, 255, 255, 0.03)',
          border: `1px solid ${themeBorder}`,
          borderRadius: '6px',
          padding: '3px',
          cursor: 'pointer',
          userSelect: 'none',
          alignItems: 'center',
          gap: '4px'
        }}>
          {/* Pharos Gold Icon Link */}
          <a 
            href="https://www.pharos.xyz/" 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              cursor: 'pointer',
              transition: 'opacity 0.2s',
              flexShrink: 0
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = 0.75}
            onMouseLeave={(e) => e.currentTarget.style.opacity = 1}
          >
            <svg width="14" height="14" viewBox="220 210 150 190" fill="none" style={{ marginLeft: '4px', marginRight: '2px', flexShrink: 0 }}>
              <defs>
                <linearGradient id="pharosGoldGrad0" x1="298.004" y1="260.206" x2="340.113" y2="260.206" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FFE094" />
                  <stop offset="0.5" stopColor="#BC8961" />
                  <stop offset="1" stopColor="white" stopOpacity="0.01"/>
                </linearGradient>
                <linearGradient id="pharosGoldGrad1" x1="291.81" y1="294.108" x2="347.955" y2="294.108" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FFE094" />
                  <stop offset="0.5" stopColor="#BC8961" />
                  <stop offset="1" stopColor="white" stopOpacity="0.01"/>
                </linearGradient>
                <linearGradient id="pharosGoldSolid" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFE094" />
                  <stop offset="40%" stopColor="#BC8961" />
                  <stop offset="100%" stopColor="#784E2D" />
                </linearGradient>
              </defs>

              <path d="M354.15 256.868L312.304 238.216L283.968 244.76V246.724L319.882 265.704L354.15 257.196V256.868Z" fill="url(#pharosGoldGrad0)"/>
              <path d="M366.67 317.08L315.27 293.519L273.424 304.645V307.263L317.576 331.479L367 317.08H366.67Z" fill="url(#pharosGoldGrad1)"/>
              <path d="M283.968 246.724L312.304 240.179L343.935 232.98V214L283.968 227.09V246.724V246.724Z" fill="url(#pharosGoldSolid)"/>
              <path d="M354.15 256.868L319.882 265.377L273.424 276.83V307.263L315.27 296.137L354.15 285.665V256.868V256.868Z" fill="url(#pharosGoldSolid)"/>
              <path d="M224 358.967C233.885 373.038 247.065 384.819 262.551 393L366.671 359.294V317.08L317.247 331.479L224 358.64V358.967Z" fill="url(#pharosGoldSolid)"/>
            </svg>
          </a>

          <style>{`
            .network-toggle-active {
              color: #ffffff !important;
            }
            body.light-mode .network-toggle-active {
              color: #000000 !important;
            }
          `}</style>

          <div 
            onClick={() => handleNetworkChange('testnet')}
            className={network === 'testnet' ? 'network-toggle-active' : ''}
            style={{
              fontSize: '10px',
              fontWeight: '700',
              padding: '5px 8px',
              borderRadius: '4px',
              color: network === 'testnet' ? undefined : 'var(--text-grey)',
              background: network === 'testnet' ? goldAccent : 'transparent',
              transition: 'all 0.15s ease',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            Testnet
          </div>
          <div 
            onClick={() => handleNetworkChange('mainnet')}
            className={network === 'mainnet' ? 'network-toggle-active' : ''}
            style={{
              fontSize: '10px',
              fontWeight: '700',
              padding: '5px 8px',
              borderRadius: '4px',
              color: network === 'mainnet' ? undefined : 'var(--text-grey)',
              background: network === 'mainnet' ? goldAccent : 'transparent',
              transition: 'all 0.15s ease',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            Mainnet
          </div>
        </div>
      </div>

    </div>
  );
}
