import React, { useState, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { CONFIG } from '../../config';
import MobileLayout from '../components/MobileLayout';
import { MobilePositions, MobilePositionManager } from '../components/MobileTradeComponents';

export default function MobilePortfolio() {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  // Position Manager Modal State
  const [isPosManagerOpen, setIsPosManagerOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [posManagerTab, setPosManagerTab] = useState('close');

  const [apiTrades, setApiTrades] = useState([]);
  const [liveGoldPrice, setLiveGoldPrice] = useState(2315.50);
  const [usdcBalance, setUsdcBalance] = useState('0.00');

  const handleManagePosition = (position, tab) => {
    setSelectedPosition(position);
    setPosManagerTab(tab);
    setIsPosManagerOpen(true);
  };

  // Establish WebSocket connection for live Gold price ticking
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
              setLiveGoldPrice(priceVal);
            }
          }
        } catch (err) {
          // Keep base price if parsing error
        }
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

  // Fetch direct USDC balance via eth_call RPC every 5 seconds
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
        console.error("Failed to fetch direct USDC balance on MobilePortfolio page:", err);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 5000);
    return () => clearInterval(interval);
  }, [address]);

  // Fetch user trades from API
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
        .catch(err => console.error("MobilePortfolio fetch trades error:", err));
    };

    fetchTrades();
    const interval = setInterval(fetchTrades, 10000);

    const handleTradeUpdated = () => {
      fetchTrades();
    };
    window.addEventListener('trade-updated', handleTradeUpdated);

    return () => {
      clearInterval(interval);
      window.removeEventListener('trade-updated', handleTradeUpdated);
    };
  }, [address, isConnected]);

  // Dynamically compute all portfolio statistics with elegant mock fallbacks when not connected
  const portfolioStats = useMemo(() => {
    if (!isConnected || !address) {
      return {
        freeMargin: 1500.00,
        unrealizedPnl: 465.60,
        unrealizedPnlPct: 46.56,
        lockedCapital: 1000.00,
        totalMargin: 2500.00,
        isMock: true
      };
    }

    const activeList = apiTrades.filter(t => t.state === 1);

    // Sum of margins in active positions (scaled down by 1e6)
    const lockedCapital = activeList.reduce((sum, t) => sum + (parseFloat(t.margin || '0') / 1e6), 0);

    // Free margin is the direct wallet USDC balance
    const freeMargin = parseFloat(usdcBalance) || 0;

    // Unrealized PnL based on real-time gold price feed
    let unrealizedPnl = 0;
    activeList.forEach(t => {
      const sizeVal = parseFloat(t.openInterest || '0') / 1e6;
      const openPriceVal = parseFloat(t.openPrice || '0') / 1e6;
      if (openPriceVal > 0) {
        if (t.direction === 1) { // Long
          unrealizedPnl += sizeVal * (liveGoldPrice - openPriceVal) / openPriceVal;
        } else { // Short
          unrealizedPnl += sizeVal * (openPriceVal - liveGoldPrice) / openPriceVal;
        }
      }
    });

    const unrealizedPnlPct = lockedCapital > 0 ? (unrealizedPnl / lockedCapital) * 100 : 0;

    // Total Margin: Free Margin + Locked Capital
    const totalMargin = freeMargin + lockedCapital;

    return {
      freeMargin,
      unrealizedPnl,
      unrealizedPnlPct,
      lockedCapital,
      totalMargin,
      isMock: false
    };
  }, [apiTrades, isConnected, address, liveGoldPrice, usdcBalance]);

  return (
    <MobileLayout>
      {/* Premium Portfolio Overview Card */}
      <div style={{
        background: 'var(--panel-bg)',
        border: '1px solid var(--panel-border)',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-grey)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.05em' }}>
            Account Summary
          </span>
          <span style={{ fontSize: '8.5px', color: isConnected ? 'var(--gold)' : 'var(--text-grey)', backgroundColor: isConnected ? 'rgba(200, 169, 126, 0.1)' : 'rgba(255, 255, 255, 0.03)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
            {isConnected ? 'LIVE ACCOUNT' : 'DISCONNECTED'}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '24px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace', color: isConnected ? 'var(--text-dark)' : 'var(--text-grey)' }}>
              {isConnected ? `$${portfolioStats.freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
            </span>
            <span style={{ fontSize: '9px', color: 'var(--text-grey)', marginTop: '2px' }}>
              Free Margin (USDC)
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ 
              fontSize: '18px', 
              fontWeight: 'bold', 
              fontFamily: 'Source Code Pro, monospace', 
              color: !isConnected ? 'var(--text-grey)' : (portfolioStats.unrealizedPnl >= 0 ? '#3b82f6' : '#ef4444')
            }}>
              {isConnected ? `${portfolioStats.unrealizedPnl >= 0 ? '+' : '-'}$${Math.abs(portfolioStats.unrealizedPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
            </span>
            <span style={{ fontSize: '9px', color: 'var(--text-grey)', marginTop: '2px' }}>
              Unrealized PnL {isConnected ? `(${portfolioStats.unrealizedPnl >= 0 ? '+' : '-'}${Math.abs(portfolioStats.unrealizedPnlPct).toFixed(2)}%)` : ''}
            </span>
          </div>
        </div>

        <div style={{ height: '1px', backgroundColor: 'var(--border-color)' }} />

        {/* Mini stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '11px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-grey)' }}>Locked Capital:</span>
            <span style={{ fontWeight: '600', color: isConnected ? 'var(--text-dark)' : 'var(--text-grey)', fontFamily: 'Source Code Pro' }}>
              {isConnected ? `$${portfolioStats.lockedCapital.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-grey)' }}>Total Margin:</span>
            <span style={{ fontWeight: '600', color: isConnected ? 'var(--text-dark)' : 'var(--text-grey)', fontFamily: 'Source Code Pro' }}>
              {isConnected ? `$${portfolioStats.totalMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Actual Positions, Orders, and History List */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <MobilePositions 
          onManagePosition={handleManagePosition} 
          isFullPage={true} 
        />
      </div>

      {/* Dialog modal overlays for margin / close action */}
      <MobilePositionManager
        isOpen={isPosManagerOpen}
        onClose={() => setIsPosManagerOpen(false)}
        position={selectedPosition}
        initialTab={posManagerTab}
      />
    </MobileLayout>
  );
}
