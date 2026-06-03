import React, { useState, useEffect } from 'react';
import { useReadContract } from 'wagmi';
import { lensAbi } from '../abi/lens';
import { CONFIG } from '../config';

export default function TopNav({ onOpenMarket }) {
  const [livePrice, setLivePrice] = useState('2,315.10');
  const [volume24h, setVolume24h] = useState('$0.00');
  const [priceChange, setPriceChange] = useState('+0.12%');
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
          console.error("TopNav Spread WS parsing error:", err);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connectWS, 3000);
      };

      ws.onerror = (err) => {
        console.error("TopNav Spread WS error:", err);
      };
    };

    connectWS();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // Fetch market summary (price variation)
  useEffect(() => {
    let isMounted = true;
    let pollInterval = null;

    const fetchSummary = async () => {
      try {
        const response = await fetch(`${CONFIG.apiUrl}/market-summary`);
        if (!isMounted) return;
        if (response.ok) {
          const data = await response.json();
          if (data && Array.isArray(data)) {
            const xauData = data.find(item => item.symbol && item.symbol.includes('XAU'));
            if (xauData && xauData.day_price_diff_decimal !== undefined) {
              const diffPercent = xauData.day_price_diff_decimal * 100;
              const formattedDiff = (diffPercent >= 0 ? '+' : '') + diffPercent.toFixed(2) + '%';
              setPriceChange(formattedDiff);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching market summary:", err);
      }
    };

    fetchSummary();
    pollInterval = setInterval(fetchSummary, 15000); // Poll XAU/USD variation details every 15s

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  // Fetch real-time volume stats from Brokex backend
  useEffect(() => {
    let isMounted = true;
    let pollInterval = null;

    const fetchVolume = async () => {
      try {
        const response = await fetch(`${CONFIG.apiUrl}/stats/volume?network=${CONFIG.network}`);
        if (!isMounted) return;
        if (response.ok) {
          const data = await response.json();
          if (data && data.volume24h && data.volume24h.formatted) {
            const volNum = parseFloat(data.volume24h.formatted);
            if (!isNaN(volNum)) {
              if (volNum >= 1e6) {
                setVolume24h(`$${(volNum / 1e6).toFixed(1)}M`);
              } else if (volNum >= 1e3) {
                setVolume24h(`$${(volNum / 1e3).toFixed(1)}K`);
              } else {
                setVolume24h(`$${volNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
              }
            }
          }
        }
      } catch (err) {
        console.error("Error fetching volume:", err);
      }
    };

    fetchVolume();
    pollInterval = setInterval(fetchVolume, 30000); // Poll every 30 seconds

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;

    const connectWS = () => {
      ws = new WebSocket('wss://api.brokex.trade/ws/gold');

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
          console.error("TopNav WS parse error:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("TopNav WS error:", err);
      };

      ws.onclose = () => {
        console.log("TopNav WS connection closed, reconnecting in 3s...");
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
  const { data: snapshot, error: readError } = useReadContract({
    address: CONFIG.addresses.lens,
    abi: lensAbi,
    functionName: 'getAssetSnapshot',
    args: [5500n],
    chainId: CONFIG.chainId,
    query: {
      refetchInterval: 10000, // Refetch every 10 seconds
    }
  });

  useEffect(() => {
    console.log("TopNav Lens Address:", CONFIG.addresses.lens);
    console.log("TopNav Lens Chain ID:", CONFIG.chainId);
    console.log("TopNav Lens snapshot raw output:", snapshot);
    if (readError) {
      console.error("TopNav Lens snapshot read error:", readError);
    }
  }, [snapshot, readError]);

  // Calculate live Open Interest metrics
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
    if (snap[index] !== undefined && snap[index] !== null) {
      return Number(snap[index]);
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

  const basePriceNum = parseFloat(livePrice.replace(/,/g, '')) || 2315.10;
  const longPriceNum = basePriceNum * (1 + spreadLong / 1000000);
  const shortPriceNum = basePriceNum * (1 - spreadShort / 1000000);
  const spreadUSD = Math.max(0, longPriceNum - shortPriceNum);
  const formattedSpread = `$${spreadUSD.toFixed(4)}`;

  const stats = {
    ticker: 'XAU-USD',
    price: livePrice,
    change: priceChange,
    spread: formattedSpread,
    funding: '-0.0100%', // Both long & short set to -0.0100% as requested
    oi: formatOIVal(totalOi),
    maxOi: '200K', // Max Open Interest set to 200K as requested
    longRatio: longRatio,
  };

  const goldAccent = '#BC8961';

  return (
    <div className="nav panel" style={{ overflow: 'hidden' }}>
      <div className="nav-stats-container" style={{ display: 'flex', width: '100%', overflow: 'hidden', gap: '0', paddingRight: '0' }}>
        {/* FIXED LEFT SIDE: Ticker Selector */}
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, gap: '15px', padding: '0 15px 0 0' }}>
          <div className="ticker-selector" style={{ flexShrink: 0, paddingRight: '13px', cursor: 'default' }}>
            <div className="ticker-logo" style={{
              borderRadius: '6px',
              background: '#BC8961',
              color: '#000',
              fontWeight: 'bold',
              width: '32px',
              height: '32px',
              padding: '0',
              fontSize: '9.5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              letterSpacing: '0.01em',
              flexShrink: 0
            }}>[XAU]</div>
            <div className="ticker-info">
              <span className="ticker-name">{stats.ticker}</span>
              <span className="ticker-label" style={{ fontSize: '10px', color: 'var(--text-grey)', fontWeight: 'normal' }}>Gold / US Dollar</span>
            </div>
          </div>
          <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', flexShrink: 0 }}></div>
        </div>

        {/* SCROLLABLE RIGHT SIDE: Stats Items */}
        <div className="scrollable-stats" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          overflowX: 'auto',
          flexGrow: 1,
          padding: '0 20px 0 5px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}>
          <style>{`
            .scrollable-stats::-webkit-scrollbar {
              display: none;
            }
            .scrollable-stats > * {
              flex-shrink: 0;
            }
          `}</style>

          {/* Price Section */}
          <div className="stat-item">
            <span className="stat-label">Price</span>
            <span className="stat-value" style={{ fontSize: '14px', fontWeight: 'bold' }}>${stats.price}</span>
          </div>

          {/* Vertical Separator */}
          <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

          {/* Variation Section */}
          <div className="stat-item">
            <span className="stat-label">Variation</span>
            <span className={`stat-value ${stats.change.startsWith('+') ? 'up' : 'down'}`}>
              {stats.change}
            </span>
          </div>

          {/* Vertical Separator */}
          <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

          {/* Spread Section */}
          <div className="stat-item">
            <span className="stat-label">Spread</span>
            <span className="stat-value" style={{ color: 'var(--text-dark)', fontFamily: 'Source Code Pro, monospace' }}>
              {stats.spread}
            </span>
          </div>

          {/* Vertical Separator */}
          <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

          {/* Borrow Fee */}
          <div className="stat-item">
            <span className="stat-label">Borrow Fee</span>
            <span className="stat-value" style={{ color: 'var(--text-dark)' }}>{formattedBorrowRate}</span>
          </div>

          {/* Vertical Separator */}
          <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

          {/* Open Interest & Ratio Group */}
          <div style={{ display: 'flex', gap: '15px' }}>
            <div className="stat-item">
              <span className="stat-label">Open Interest</span>
              <span className="stat-value">{stats.oi} / {stats.maxOi}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Long/Short Ratio</span>
              <span className="stat-value">
                <span style={{ color: '#3b82f6' }}>{stats.longRatio}%</span>
                <span style={{ color: 'var(--text-grey)', margin: '0 4px' }}>/</span>
                <span style={{ color: '#ef4444' }}>{100 - stats.longRatio}%</span>
              </span>
            </div>
          </div>

          {/* Vertical Separator */}
          <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>

          {/* 24h Volume Section */}
          <div className="stat-item">
            <span className="stat-label">24h Volume</span>
            <span className="stat-value">{volume24h}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
