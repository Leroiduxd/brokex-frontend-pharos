import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useTrade } from '../../hooks/useTrade';
import { useNotifications } from '../../context/NotificationContext';
import { coreAbi } from '../../abi/core';
import { lensAbi } from '../../abi/lens';
import { CONFIG } from '../../config';

// Common Accent Colors (Theme-aware via CSS variables)
const goldAccent = '#BC8961';
const goldAccentLight = 'rgba(188, 137, 97, 0.15)';
const buyColor = '#3b82f6'; // blue
const sellColor = '#ef4444'; // red
const buyColorBg = 'rgba(59, 130, 246, 0.1)';
const sellColorBg = 'rgba(239, 68, 68, 0.1)';

export default function MobileOrderPanel({ isOpen, onClose, initialSide = 'buy', isInline = false }) {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { executeTrade, isLoading, statusText } = useTrade();
  const { showNotification } = useNotifications();

  const [usdcBalance, setUsdcBalance] = useState('0.00');

  useEffect(() => {
    if (!address || !isOpen) {
      if (!address) setUsdcBalance('0.00');
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
        console.error("Failed to fetch direct mobile USDC balance:", err);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 5000);
    return () => clearInterval(interval);
  }, [address, isOpen]);

  // Fetch real-time gold price from WebSocket
  const [livePrice, setLivePrice] = useState('2,315.00');
  const [spreadLong, setSpreadLong] = useState(0);
  const [spreadShort, setSpreadShort] = useState(0);

  // Fetch real-time spreads from WebSocket
  useEffect(() => {
    if (!isOpen) return;

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
          console.error("MobileOrderPanel Spread WS parsing error:", err);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connectWS, 3000);
      };

      ws.onerror = (err) => {
        console.error("MobileOrderPanel Spread WS error:", err);
      };
    };

    connectWS();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

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
              const formattedPrice = priceVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              setLivePrice(formattedPrice);
              document.title = `$${formattedPrice} | [XAUUSD] | Brokex Protocol`;
            }
          }
        } catch (err) {
          console.error("MobileOrderPanel WS parse error:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("MobileOrderPanel WS error:", err);
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
  }, [isOpen]);

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
      if (!isInline && onClose) onClose();
    } catch (err) {
      showNotification(`Trade failed: ${err.message}`, 'error');
    }
  };

  const [side, setSide] = useState(initialSide);
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

  // Sync side with initialSide prop when drawer opens
  useEffect(() => {
    if (isOpen) {
      setSide(initialSide);
    }
  }, [isOpen, initialSide]);

  // Adjust default leverage if dynamic maxLeverage decreases
  useEffect(() => {
    if (leverage > maxLeverageNum) {
      setLeverage(maxLeverageNum);
    } else if (leverage < minLeverageNum) {
      setLeverage(minLeverageNum);
    }
  }, [minLeverageNum, maxLeverageNum, isOpen]);

  if (!isOpen) return null;

  const currentPriceNum = parseFloat(livePrice.replace(/,/g, '')) || 2315.00;
  const longPriceNum = currentPriceNum * (1 + spreadLong / 1000000);
  const shortPriceNum = currentPriceNum * (1 - spreadShort / 1000000);
  const formattedLongPrice = longPriceNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedShortPrice = shortPriceNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  const percentage = maxLeverageNum > minLeverageNum
    ? ((leverage - minLeverageNum) / (maxLeverageNum - minLeverageNum)) * 100
    : 0;
  const sliderBackground = `linear-gradient(to right, ${goldAccent} ${percentage}%, var(--border-color) ${percentage}%)`;

  const collatNum = Number(collateralAmount || 0);
  const estimatedSizeUSDNum = collatNum * leverage;
  const openFeeVal = (collatNum * leverage * (commissionBps / 1000000)).toFixed(2);
  const totalFeesVal = openFeeVal;

  const displaySize = sizeCurrency === 'USD'
    ? `$${Math.round(estimatedSizeUSDNum).toLocaleString('en-US')}`
    : (estimatedSizeUSDNum / currentPriceNum).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

  const selectedSideColor = side === 'buy' ? buyColor : sellColor;
  const selectedSideBg = side === 'buy' ? buyColorBg : sellColorBg;

  const innerSheet = (
    <div style={{
      background: isInline ? 'transparent' : 'var(--bg-dark)',
      borderTop: isInline ? 'none' : '1px solid var(--border-color)',
      borderTopLeftRadius: isInline ? '0px' : '20px',
      borderTopRightRadius: isInline ? '0px' : '20px',
      padding: isInline ? '12px 8px' : '16px 12px',
      maxHeight: isInline ? 'none' : '85vh',
      height: 'auto',
      overflowY: isInline ? 'visible' : 'auto',
      WebkitOverflowScrolling: 'touch',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      boxShadow: isInline ? 'none' : '0 -8px 30px rgba(0, 0, 0, 0.5)',
      width: '100%'
    }}>
      {/* Drag Handle indicator */}
      {!isInline && (
        <div style={{
          width: '40px',
          height: '4px',
          background: 'var(--border-color)',
          borderRadius: '2px',
          alignSelf: 'center',
          marginBottom: '4px'
        }} />
      )}

      {/* Drawer Header */}
      {!isInline && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-dark)', textTransform: 'uppercase' }}>
            Configure Order
          </h3>

          <button 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-grey)',
              fontSize: '22px',
              lineHeight: '1',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            &times;
          </button>
        </div>
      )}

        {/* Long/Short Tabs */}
        <div style={{ 
          display: 'flex', 
          backgroundColor: 'var(--bg-subtle)', 
          borderRadius: '8px', 
          padding: '3px', 
          border: '1px solid var(--border-color)' 
        }}>
          <div
            onClick={() => setSide('buy')}
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              flex: 1, 
              padding: '6px 8px', 
              cursor: 'pointer', 
              borderRadius: '6px', 
              alignItems: 'center',
              backgroundColor: side === 'buy' ? buyColorBg : 'transparent', 
              border: `1px solid ${side === 'buy' ? buyColor : 'transparent'}`, 
              transition: 'all 0.15s' 
            }}
          >
            <div style={{ color: side === 'buy' ? buyColor : 'var(--text-grey)', fontWeight: side === 'buy' ? 700 : 500, fontSize: '12px' }}>LONG</div>
            <div style={{ color: side === 'buy' ? buyColor : 'var(--text-grey)', fontSize: '10px', fontFamily: 'Source Code Pro, monospace' }}>{formattedLongPrice}</div>
          </div>
          <div
            onClick={() => setSide('sell')}
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              flex: 1, 
              padding: '6px 8px', 
              cursor: 'pointer', 
              borderRadius: '6px', 
              alignItems: 'center',
              backgroundColor: side === 'sell' ? sellColorBg : 'transparent', 
              border: `1px solid ${side === 'sell' ? sellColor : 'transparent'}`, 
              transition: 'all 0.15s' 
            }}
          >
            <div style={{ color: side === 'sell' ? sellColor : 'var(--text-grey)', fontWeight: side === 'sell' ? 700 : 500, fontSize: '12px' }}>SHORT</div>
            <div style={{ color: side === 'sell' ? sellColor : 'var(--text-grey)', fontSize: '10px', fontFamily: 'Source Code Pro, monospace' }}>{formattedShortPrice}</div>
          </div>
        </div>

        {/* Order Types */}
        <div style={{ 
          display: 'flex', 
          backgroundColor: 'rgba(255, 255, 255, 0.02)', 
          borderRadius: '8px', 
          padding: '3px', 
          border: '1px solid var(--border-color)' 
        }}>
          {['market', 'limit', 'stop'].map(type => (
            <div
              key={type}
              onClick={() => setOrderType(type)}
              style={{
                flex: 1, 
                textAlign: 'center', 
                padding: '6px', 
                cursor: 'pointer', 
                borderRadius: '6px',
                backgroundColor: orderType === type ? goldAccentLight : 'transparent',
                color: orderType === type ? goldAccent : 'var(--text-grey)',
                border: `1px solid ${orderType === type ? goldAccent : 'transparent'}`,
                fontSize: '11px', 
                fontWeight: orderType === type ? 600 : 400, 
                textTransform: 'uppercase', 
                transition: 'all 0.15s'
              }}
            >
              {type}
            </div>
          ))}
        </div>

        {/* Target Price (Limit/Stop only) */}
        {orderType !== 'market' && (
          <div style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.02)', 
            borderRadius: '8px', 
            border: hasPriceError ? '1px solid #BC8961' : '1px solid var(--border-color)', 
            padding: '6px 10px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '2px',
            transition: 'border-color 0.3s ease'
          }}>
            <span style={{ fontSize: '10px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>
              {orderType} Price
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: goldAccent }}>
                {orderType === 'limit' ? (side === 'buy' ? '≤' : '≥') : (side === 'buy' ? '≥' : '≤')}
              </span>
              <input
                type="number"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="0.00"
                style={{ 
                  fontSize: '13px', 
                  color: 'var(--text-dark)', 
                  backgroundColor: 'transparent', 
                  border: 'none', 
                  outline: 'none', 
                  width: '100%', 
                  fontWeight: '600', 
                  fontFamily: 'Source Code Pro, monospace' 
                }}
              />
            </div>
          </div>
        )}

        {/* Collateral Input */}
        <div style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.02)', 
          borderRadius: '8px', 
          border: '1px solid var(--border-color)', 
          display: 'flex', 
          flexDirection: 'column' 
        }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>Collateral</span>
              <span 
                style={{ fontSize: '10px', color: goldAccent, fontWeight: 'bold', cursor: 'pointer' }} 
                onClick={() => setCollateralAmount('1500')}
              >
                MAX (Bal: {usdcBalance} USDC)
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <input
                type="number"
                value={collateralAmount}
                onChange={(e) => setCollateralAmount(e.target.value)}
                style={{ 
                  fontSize: '14px', 
                  color: 'var(--text-dark)', 
                  backgroundColor: 'transparent', 
                  border: 'none', 
                  outline: 'none', 
                  padding: 0, 
                  width: '120px', 
                  fontWeight: 'bold',
                  fontFamily: 'Source Code Pro, monospace' 
                }}
              />
              <span style={{ fontWeight: '600', fontSize: '11px', color: 'var(--text-dark)' }}>
                USDC
              </span>
            </div>
          </div>

          {/* Size Indicator */}
          <div style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>Estimated Size</span>
              <span style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace' }}>
                {displaySize}
              </span>
            </div>
            <button
              onClick={() => setSizeCurrency(prev => prev === 'USD' ? 'ASSET' : 'USD')}
              style={{ 
                border: `1px solid ${goldAccent}`, 
                background: goldAccentLight, 
                color: goldAccent, 
                padding: '4px 8px', 
                borderRadius: '4px', 
                fontSize: '10px', 
                fontWeight: 'bold',
                cursor: 'pointer' 
              }}
            >
              {sizeCurrency === 'USD' ? 'USD' : selectedAsset}
            </button>
          </div>
        </div>

        {/* Leverage Slider */}
        <div style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.02)', 
          borderRadius: '8px', 
          border: '1px solid var(--border-color)', 
          padding: '8px 10px', 
          display: 'flex', 
          flexDirection: 'column' 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-grey)', textTransform: 'uppercase' }}>Leverage</span>
            <span style={{ color: goldAccent, fontWeight: 'bold', fontSize: '12px', fontFamily: 'Source Code Pro, monospace' }}>{leverage}x</span>
          </div>
          <style>{`
            .custom-leverage-slider {
              -webkit-appearance: none !important;
              appearance: none !important;
              width: 100%;
              height: 4px;
              border-radius: 2px;
              outline: none;
              cursor: pointer;
            }
            .custom-leverage-slider::-webkit-slider-thumb {
              -webkit-appearance: none !important;
              appearance: none !important;
              width: 12px;
              height: 12px;
              border-radius: 50%;
              background: #ffffff !important;
              cursor: pointer;
              border: 1px solid var(--border-color) !important;
              box-shadow: 0 0 4px rgba(0,0,0,0.2) !important;
            }
            .custom-leverage-slider::-moz-range-thumb {
              width: 12px;
              height: 12px;
              border-radius: 50%;
              background: #ffffff !important;
              cursor: pointer;
              border: 1px solid var(--border-color) !important;
              box-shadow: 0 0 4px rgba(0,0,0,0.2) !important;
            }
          `}</style>
          <input
            type="range"
            min={minLeverageNum}
            max={maxLeverageNum}
            step="1"
            value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))}
            className="custom-leverage-slider"
            style={{ 
              width: '100%', 
              background: sliderBackground, 
              accentColor: goldAccent, 
              height: '4px',
              borderRadius: '2px',
              cursor: 'pointer' 
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', gap: '4px' }}>
            {leverageStops.map(lev => (
              <button
                key={lev}
                onClick={() => setLeverage(lev)}
                style={{
                  flex: 1, 
                  padding: '4px 0', 
                  fontSize: '9px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: leverage === lev ? goldAccentLight : 'rgba(255,255,255,0.02)',
                  color: leverage === lev ? goldAccent : 'var(--text-grey)',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontFamily: 'Source Code Pro, monospace'
                }}
              >
                {lev}x
              </button>
            ))}
          </div>
        </div>

        {/* TP / SL Toggle and Fields */}
        <div style={{ 
          backgroundColor: 'var(--bg-subtle)', 
          borderRadius: '8px', 
          border: '1px solid var(--border-color)', 
          padding: '8px 10px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '8px' 
        }}>
          <div 
            onClick={() => setTpSlEnabled(!tpSlEnabled)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          >
            <span style={{ fontSize: '11px', color: 'var(--text-dark)', fontWeight: 'bold' }}>Take Profit / Stop Loss</span>
            <div style={{ 
              width: '28px', 
              height: '14px', 
              backgroundColor: tpSlEnabled ? goldAccent : 'rgba(128, 128, 128, 0.25)', 
              borderRadius: '8px', 
              position: 'relative',
              transition: 'all 0.2s'
            }}>
              <div style={{ 
                width: '10px', 
                height: '10px', 
                backgroundColor: '#fff', 
                borderRadius: '50%', 
                position: 'absolute',
                top: '2px',
                left: tpSlEnabled ? '16px' : '2px',
                transition: 'all 0.2s'
              }} />
            </div>
          </div>

          {tpSlEnabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-grey)' }}>TAKE PROFIT</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {['10%', '25%', '50%', '100%'].map(p => (
                      <div 
                        key={p} 
                        onClick={() => handleTpPercent(p)}
                        style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '3px', backgroundColor: 'var(--bg-subtle)', color: 'var(--text-grey)', cursor: 'pointer', border: '1px solid var(--border-color)' }}
                      >
                        {p}
                      </div>
                    ))}
                  </div>
                </div>
                <input 
                  type="number"
                  value={tpPrice}
                  onChange={(e) => setTpPrice(e.target.value)}
                  placeholder="Target Price"
                  style={{ 
                    width: '100%', 
                    backgroundColor: 'var(--bg-subtle)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '4px', 
                    padding: '5px', 
                    color: 'var(--text-dark)', 
                    fontSize: '11px', 
                    outline: 'none', 
                    fontFamily: 'Source Code Pro, monospace' 
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-grey)' }}>STOP LOSS</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {['10%', '25%', '50%', '100%'].map(p => (
                      <div 
                        key={p} 
                        onClick={() => handleSlPercent(p)}
                        style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '3px', backgroundColor: 'var(--bg-subtle)', color: 'var(--text-grey)', cursor: 'pointer', border: '1px solid var(--border-color)' }}
                      >
                        {p}
                      </div>
                    ))}
                  </div>
                </div>
                <input 
                  type="number"
                  value={slPrice}
                  onChange={(e) => setSlPrice(e.target.value)}
                  placeholder="Stop Price"
                  style={{ 
                    width: '100%', 
                    backgroundColor: 'var(--bg-subtle)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '4px', 
                    padding: '5px', 
                    color: 'var(--text-dark)', 
                    fontSize: '11px', 
                    outline: 'none', 
                    fontFamily: 'Source Code Pro, monospace' 
                  }}
                />

                {/* Guaranteed Stop Loss nested under Stop Loss */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '2px 0 2px 10px', 
                  marginLeft: '4px',
                  borderLeft: `1.5px solid ${guaranteedSL ? goldAccent : 'var(--border-color)'}`,
                  marginTop: '3px',
                  transition: 'all 0.2s'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5px' }}>
                    <span style={{ fontSize: '9.5px', color: 'var(--text-dark)', fontWeight: 500 }}>Guaranteed SL</span>
                    <span style={{ fontSize: '7.5px', color: 'var(--text-grey)' }}>Zero slippage execution</span>
                  </div>
                  <div 
                    onClick={() => setGuaranteedSL(!guaranteedSL)}
                    style={{ 
                      width: '12px', 
                      height: '12px', 
                      border: `1px solid ${guaranteedSL ? goldAccent : 'var(--border-color)'}`, 
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

        {/* Metric Details list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', marginTop: '5px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-grey)' }}>Amount</span>
            <span style={{ color: 'var(--text-dark)', fontFamily: 'Source Code Pro, monospace' }}>{(estimatedSizeUSDNum / currentPriceNum).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} {selectedAsset}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-grey)' }}>Exposure</span>
            <span style={{ color: 'var(--text-dark)', fontFamily: 'Source Code Pro, monospace' }}>${Math.round(estimatedSizeUSDNum).toLocaleString('en-US')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-grey)' }}>Collateral at Open</span>
            <span style={{ color: 'var(--text-dark)', fontFamily: 'Source Code Pro, monospace' }}>{Math.round(collatNum)} USDC</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-grey)' }}>Liquidation Price</span>
            <span style={{ color: 'var(--text-dark)', fontFamily: 'Source Code Pro, monospace' }}>
              {side === 'buy'
                ? Math.round(currentPriceNum * (1 - 0.9 / leverage)).toLocaleString('en-US')
                : Math.round(currentPriceNum * (1 + 0.9 / leverage)).toLocaleString('en-US')
              }
            </span>
          </div>

          <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '6px 0' }}></div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-grey)' }}>Oracle Fee</span>
            <span style={{ color: 'var(--text-dark)', fontFamily: 'Source Code Pro, monospace' }}>$0</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-grey)' }}>Open Fee</span>
            <span style={{ color: 'var(--text-dark)', fontFamily: 'Source Code Pro, monospace' }}>${openFeeVal}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-grey)' }}>Close Fee</span>
            <span style={{ color: 'var(--text-dark)', fontFamily: 'Source Code Pro, monospace' }}>$0</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--text-dark)', fontWeight: 600 }}>Total Fees</span>
            <span style={{ color: goldAccent, fontWeight: 600, fontFamily: 'Source Code Pro, monospace' }}>
              ~${totalFeesVal}
            </span>
          </div>
        </div>



        {/* Large Action Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          style={{
            backgroundColor: isLoading ? 'var(--border-color)' : goldAccent,
            color: isLoading ? 'var(--text-grey)' : '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '12px',
            fontSize: '13px',
            fontWeight: '900',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            textAlign: 'center',
            marginTop: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em'
          }}
        >
          {isLoading ? 'Processing...' : (isConnected ? (side === 'buy' ? 'Go Long' : 'Go Short') : 'Connect Wallet')}
        </button>
      </div>
  );

  if (isInline) return innerSheet;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(4px)',
      zIndex: 999999,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end'
    }}>
      {/* Tap outside to close spacer */}
      <div style={{ flex: 1 }} onClick={onClose} />
      {innerSheet}
    </div>
  );
}
