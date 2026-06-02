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

  // Track where we are in our paging cursor
  const lastFetchedIdRef = useRef(0n);
  // Track the largest trade ID we have ever fetched/seen
  const largestTradeIdRef = useRef(0n);

  const fetchChunk = async (fromId, countToFetch) => {
    if (fromId <= 0n) return [];

    // getTradeRange takes startId and length.
    // If we want to fetch the most recent, say N-30 to N-1:
    // startId = max(1, fromId - countToFetch + 1)
    // length = fromId - startId + 1
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

      // Filter and map to the expected UI format
      const formatted = results
        .map(trade => {
          // Format open timestamp
          const timestamp = Number(trade.openTimestamp) * 1000;
          let timeStr = '—';
          if (timestamp > 0) {
            const date = new Date(timestamp);
            timeStr = date.toLocaleTimeString('en-GB', { hour12: false });
          }

          // Format size
          const sizeVal = (parseFloat(trade.margin) * parseFloat(trade.leverage)) / 1e6;
          const sizeStr = `$${sizeVal.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

          // Format PnL
          let pnlStr = '—';
          const stateNum = Number(trade.state);
          const dirNum = Number(trade.direction);
          if (stateNum === 1) {
            // Live/Open positions: compute PnL against current hardcoded gold price 4511.25
            const liveGoldPrice = 4511.25;
            const openPriceVal = parseFloat(trade.openPrice) / 1e6;
            if (openPriceVal > 0) {
              let pnlVal = 0;
              if (dirNum === 1) {
                pnlVal = sizeVal * (liveGoldPrice - openPriceVal) / openPriceVal;
              } else {
                pnlVal = sizeVal * (openPriceVal - liveGoldPrice) / openPriceVal;
              }
              pnlStr = (pnlVal >= 0 ? '+' : '-') + '$' + Math.abs(pnlVal).toFixed(2);
            }
          } else if (stateNum >= 2) {
            // Closed/Settled positions: compute PnL using closePrice
            const openPriceVal = parseFloat(trade.openPrice) / 1e6;
            const closePriceVal = parseFloat(trade.closePrice) / 1e6;
            if (openPriceVal > 0) {
              let pnlVal = 0;
              if (dirNum === 1) {
                pnlVal = sizeVal * (closePriceVal - openPriceVal) / openPriceVal;
              } else {
                pnlVal = sizeVal * (openPriceVal - closePriceVal) / openPriceVal;
              }
              pnlStr = (pnlVal >= 0 ? '+' : '-') + '$' + Math.abs(pnlVal).toFixed(2);
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
        });

      // We want to return them in reverse order (most recent first)
      return formatted.reverse();
    } catch (err) {
      console.error("Failed to fetch trade range chunk:", err);
      return [];
    }
  };

  const loadInitialTrades = async () => {
    setLoading(true);
    try {
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

  // Poll nextTradeId every 10 seconds to smoothly append newly created trades
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
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
          trades.map((trade, i) => (
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
          ))
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
