import { useState, useEffect, useRef } from 'react';
import { usePublicClient } from 'wagmi';
import { CONFIG } from '../config';
import { coreAbi } from '../abi/core';
import { lensAbi } from '../abi/lens';

const SkeletonRow = () => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: '0.9fr 1.1fr 1fr 1fr',
    padding: '6px 8px',
    fontSize: '11px',
    borderBottom: '1px solid rgba(255,255,255,0.02)',
    alignItems: 'center',
    animation: 'shimmer-pulse 1.5s infinite ease-in-out'
  }}>
    <div style={{ height: '10px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', width: '40px' }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <div style={{ height: '10px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', width: '55px' }} />
      <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', width: '20px' }} />
    </div>
    <div style={{ height: '10px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', width: '35px', marginLeft: 'auto' }} />
    <div style={{ height: '10px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', width: '30px', marginLeft: 'auto' }} />
  </div>
);

export default function OrderBook() {
  const publicClient = usePublicClient();
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const scrollRef = useRef(null);

  const [liveGoldPrice, setLiveGoldPrice] = useState(2315.00);
  const [spreadLong, setSpreadLong] = useState(0);
  const [spreadShort, setSpreadShort] = useState(0);
  const [borrowRateHourlyRaw, setBorrowRateHourlyRaw] = useState(null);

  const liveGoldPriceRef = useRef(2315.00);
  const spreadLongRef = useRef(0);
  const spreadShortRef = useRef(0);
  const borrowRateHourlyRawRef = useRef(null);

  useEffect(() => { liveGoldPriceRef.current = liveGoldPrice; }, [liveGoldPrice]);
  useEffect(() => { spreadLongRef.current = spreadLong; }, [spreadLong]);
  useEffect(() => { spreadShortRef.current = spreadShort; }, [spreadShort]);
  useEffect(() => { borrowRateHourlyRawRef.current = borrowRateHourlyRaw; }, [borrowRateHourlyRaw]);

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
          console.error("OrderBook Gold WS parse error:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("OrderBook Gold WS error:", err);
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
          console.error("OrderBook Spread WS parsing error:", err);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connectWS, 3000);
      };

      ws.onerror = (err) => {
        console.error("OrderBook Spread WS error:", err);
      };
    };

    connectWS();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // Fetch borrow rate from Lens Snapshot
  const fetchBorrowRate = async () => {
    try {
      const snapshot = await publicClient.readContract({
        address: CONFIG.addresses.lens,
        abi: lensAbi,
        functionName: 'getAssetSnapshot',
        args: [5500n],
      });
      if (snapshot) {
        let target = snapshot;
        if (Array.isArray(snapshot) && snapshot.length === 1 && typeof snapshot[0] === 'object') {
          target = snapshot[0];
        }
        const snapConfig = target.config || target[4];
        if (snapConfig && snapConfig.borrowRateHourly !== undefined && snapConfig.borrowRateHourly !== null) {
          setBorrowRateHourlyRaw(snapConfig.borrowRateHourly);
        }
      }
    } catch (err) {
      console.error("OrderBook failed to fetch borrow rate snapshot:", err);
    }
  };

  // Track where we are in our paging cursor
  const lastFetchedIdRef = useRef(0n);
  // Track the largest trade ID we have ever fetched/seen
  const largestTradeIdRef = useRef(0n);

  const fetchChunk = async (fromId, countToFetch) => {
    if (fromId <= 0n) return [];

    let startId = fromId - BigInt(countToFetch) + 1n;
    if (startId < 1n) {
      startId = 1n;
    }
    const length = fromId - startId + 1n;
    if (length <= 0n) return [];

    try {
      const results = await publicClient.readContract({
        address: CONFIG.addresses.lens,
        abi: lensAbi,
        functionName: 'getTradeRange',
        args: [startId, length],
      });

      // We want to return them in reverse order (most recent first)
      return [...results].reverse();
    } catch (err) {
      console.error("Failed to fetch trade range chunk:", err);
      return [];
    }
  };

  const loadInitialTrades = async () => {
    setLoading(true);
    try {
      // Load initial borrow rate
      await fetchBorrowRate();

      // 1. Get nextTradeId from Core
      const nextId = await publicClient.readContract({
        address: CONFIG.addresses.core,
        abi: coreAbi,
        functionName: 'nextTradeId',
      });

      const nextIdBig = BigInt(nextId);
      const lastTradeId = nextIdBig - 1n;

      largestTradeIdRef.current = lastTradeId;

      if (lastTradeId <= 0n) {
        setHasMore(false);
        setTrades([]);
        return;
      }

      // 2. Fetch the most recent 30 trades (length = 30)
      const initialChunk = await fetchChunk(lastTradeId, 30);
      setTrades(initialChunk);

      // Update our paging cursor to the remaining un-fetched range
      lastFetchedIdRef.current = lastTradeId - BigInt(initialChunk.length);
      if (lastFetchedIdRef.current <= 0n) {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Failed to load initial orderbook trades:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialTrades();
  }, []);

  // Poll nextTradeId and borrow rate every 10 seconds to smoothly append newly created trades
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await fetchBorrowRate();

        const nextId = await publicClient.readContract({
          address: CONFIG.addresses.core,
          abi: coreAbi,
          functionName: 'nextTradeId',
        });

        const nextIdBig = BigInt(nextId);
        const newLastTradeId = nextIdBig - 1n;

        if (largestTradeIdRef.current > 0n && newLastTradeId > largestTradeIdRef.current) {
          const countToFetch = Number(newLastTradeId - largestTradeIdRef.current);
          if (countToFetch > 0) {
            const newChunk = await fetchChunk(newLastTradeId, countToFetch);
            if (newChunk.length > 0) {
              // Prepend newly found trades smoothly to existing list
              setTrades(prev => [...newChunk, ...prev]);
            }
          }
          largestTradeIdRef.current = newLastTradeId;
        } else if (largestTradeIdRef.current === 0n && newLastTradeId > 0n) {
          // If initially there were no trades, but now a trade is created
          largestTradeIdRef.current = newLastTradeId;
          const newChunk = await fetchChunk(newLastTradeId, Number(newLastTradeId));
          setTrades(newChunk);
        }
      } catch (err) {
        console.error("Failed to poll for new orderbook trades:", err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [publicClient]);

  const handleScroll = async (e) => {
    if (loading || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      // Near bottom, load the next 30 more ancient trades!
      setLoading(true);
      const cursor = lastFetchedIdRef.current;
      const nextChunk = await fetchChunk(cursor, 30);

      if (nextChunk.length > 0) {
        setTrades(prev => [...prev, ...nextChunk]);
        lastFetchedIdRef.current = cursor - BigInt(nextChunk.length);
      }

      if (lastFetchedIdRef.current <= 0n || nextChunk.length === 0) {
        setHasMore(false);
      }
      setLoading(false);
    }
  };

  const formatTrade = (trade) => {
    // Format open timestamp
    const timestamp = Number(trade.openTimestamp) * 1000;
    let timeStr = '—';
    if (timestamp > 0) {
      const date = new Date(timestamp);
      timeStr = date.toLocaleTimeString('en-GB', { hour12: false });
    }

    // Format size
    const marginVal = parseFloat(trade.margin) || 0;
    const leverageVal = parseFloat(trade.leverage) || 0;
    const sizeVal = (marginVal * leverageVal) / 1e6;
    const sizeStr = `$${sizeVal.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

    // Format PnL
    let pnlStr = '—';
    const stateNum = Number(trade.state);
    const dirNum = Number(trade.direction);
    if (stateNum === 1 || stateNum >= 2) {
      const openPriceVal = parseFloat(trade.openPrice) / 1e6;
      const closePriceVal = parseFloat(trade.closePrice) / 1e6;
      
      if (openPriceVal > 0) {
        let pnlVal = 0;
        
        if (stateNum === 1) {
          // Live/Open positions: compute PnL against current gold price adjusted by spread
          let actualMarketPrice = liveGoldPrice;
          if (dirNum === 1) {
            // For a Long position, exit price is the Short price (bid price)
            actualMarketPrice = liveGoldPrice * (1 - spreadShort / 1000000);
          } else {
            // For a Short position, exit price is the Long price (ask price)
            actualMarketPrice = liveGoldPrice * (1 + spreadLong / 1000000);
          }
          
          if (dirNum === 1) {
            pnlVal = sizeVal * (actualMarketPrice - openPriceVal) / openPriceVal;
          } else {
            pnlVal = sizeVal * (openPriceVal - actualMarketPrice) / openPriceVal;
          }
        } else {
          // Closed/Settled positions: compute PnL using closePrice
          if (dirNum === 1) {
            pnlVal = sizeVal * (closePriceVal - openPriceVal) / openPriceVal;
          } else {
            pnlVal = sizeVal * (openPriceVal - closePriceVal) / openPriceVal;
          }
        }
        
        // Accrued borrow fee calculation
        const openTime = Number(trade.openTimestamp || 0);
        const closeTime = stateNum === 1 
          ? Math.floor(Date.now() / 1000) 
          : Number(trade.closeTimestamp || 0);
        const durationSeconds = Math.max(0, closeTime - openTime);
        const durationHours = durationSeconds / 3600;

        const borrowRateDecimal = borrowRateHourlyRaw !== null 
          ? Number(borrowRateHourlyRaw) / 1000000 
          : 0.0001; // default to 0.01% hourly if not loaded
        
        const accruedBorrowFeeUSD = sizeVal * borrowRateDecimal * durationHours;

        // Subtract borrow fee directly from PnL
        pnlVal = pnlVal - accruedBorrowFeeUSD;
        
        pnlStr = (pnlVal >= 0 ? '+' : '-') + '$' + Math.abs(pnlVal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
    }

    return {
      id: Number(trade.id),
      time: timeStr,
      asset: Number(trade.supraId) === 0 ? 'BTC/USD' : 'XAU/USD',
      side: dirNum === 1 ? 'buy' : 'sell',
      size: sizeStr,
      pnl: pnlStr,
      isOrder: stateNum === 0
    };
  };

  return (
    <div className="book panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>


      {/* Table Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '0.9fr 1.1fr 1fr 1fr',
        padding: '8px 8px',
        fontSize: '10px',
        color: 'var(--text-grey)',
        borderBottom: '1px solid rgba(255,255,255,0.03)',
        textTransform: 'uppercase'
      }}>
        <div>Time</div>
        <div>Asset</div>
        <div style={{ textAlign: 'right' }}>Size</div>
        <div style={{ textAlign: 'right' }}>PnL</div>
      </div>

      {/* Table Content */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: 'auto', padding: '5px 0' }}
      >
        {trades.length === 0 && loading ? (
          Array.from({ length: 15 }, (_, i) => <SkeletonRow key={i} />)
        ) : (
          trades.map((rawTrade, i) => {
            const trade = formatTrade(rawTrade);
            return (
              <div key={i} style={{
                display: 'grid',
                gridTemplateColumns: '0.9fr 1.1fr 1fr 1fr',
                padding: '6px 8px',
                fontSize: '11px',
                borderBottom: '1px solid rgba(255,255,255,0.02)',
                transition: 'background 0.2s',
                cursor: 'pointer'
              }} className="trade-row">
                <div style={{ color: 'var(--text-grey)', fontFamily: 'Source Code Pro, monospace', fontSize: '10px' }}>{trade.time}</div>
                <div style={{ fontWeight: '600', color: 'var(--text-dark)', display: 'inline-flex', alignItems: 'baseline' }}>
                  {trade.asset}
                  <sup style={{
                    fontSize: '5.5px',
                    marginLeft: '1px',
                    color: trade.side === 'buy' ? '#3b82f6' : '#ef4444',
                    fontWeight: '900',
                    verticalAlign: 'super',
                    lineHeight: '0',
                    position: 'relative',
                    top: '-4px'
                  }}>
                    {trade.side === 'buy' ? 'LONG' : 'SHORT'}
                  </sup>
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'Source Code Pro, monospace' }}>{trade.size}</div>
                <div style={{
                  textAlign: 'right',
                  fontFamily: 'Source Code Pro, monospace',
                  color: trade.pnl.startsWith('+') ? '#3b82f6' : trade.pnl === '—' ? 'var(--text-grey)' : '#ef4444'
                }}>
                  {trade.pnl}
                </div>
              </div>
            );
          })
        )}

        {trades.length > 0 && loading && (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        )}
        {trades.length === 0 && !loading && (
          <div style={{ padding: '30px', textAlign: 'center', fontSize: '11px', color: 'var(--text-grey)' }}>
            No trades active on-chain
          </div>
        )}
      </div>

      <style>{`
        .trade-row:hover {
          background: rgba(255,255,255,0.03);
        }
        .book.panel div::-webkit-scrollbar {
          width: 4px;
        }
        .book.panel div::-webkit-scrollbar-thumb {
          background: var(--border-color);
          border-radius: 2px;
        }
        @keyframes shimmer-pulse {
          0% { opacity: 0.35; }
          50% { opacity: 0.75; }
          100% { opacity: 0.35; }
        }
      `}</style>
    </div>
  );
}
