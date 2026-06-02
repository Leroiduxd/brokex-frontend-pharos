import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { CONFIG } from '../../config';
import Chart from '../../components/Chart';
import MobileLayout from '../components/MobileLayout';
import { 
  MobilePositions,
  MobileOrderPanel, 
  MobilePositionManager,
  MobileTradeHeader,
  MobileTopNav
} from '../components/MobileTradeComponents';

const marketsData = [
  // CRYPTO
  { symbol: 'BTC-USDC', price: '78,207.00', change: '-1.10%', volume: '$1.64B', leverage: '40x', category: 'Crypto', logo: 'BTC', company: 'Bitcoin / USDC CFD' },
  { symbol: 'ETH-USDC', price: '2,180.50', change: '-1.74%', volume: '$592.5M', leverage: '25x', category: 'Crypto', logo: 'ETH', company: 'Ethereum / USDC CFD' },
  { symbol: 'SOL-USDC', price: '142.12', change: '+2.85%', volume: '$452.1M', leverage: '20x', category: 'Crypto', logo: 'SOL', company: 'Solana / USDC CFD' },
  
  // COMMODITIES
  { symbol: 'XAU-USD', price: '2,315.10', change: '+0.45%', volume: '$452.0M', leverage: '50x', category: 'Commodities', logo: 'XAU', company: 'Gold / US Dollar CFD' },
  { symbol: 'XAG-USD', price: '28.45', change: '-0.21%', volume: '$104.0M', leverage: '20x', category: 'Commodities', logo: 'XAG', company: 'Silver / US Dollar CFD' },
  { symbol: 'WTI-USD', price: '82.45', change: '+0.15%', volume: '$85.0M', leverage: '20x', category: 'Commodities', logo: 'WTI', company: 'Crude Oil / US Dollar CFD' },

  // FOREX
  { symbol: 'EUR-USD', price: '1.0842', change: '+0.12%', volume: '$12.4B', leverage: '100x', category: 'Forex', logo: 'EUR', company: 'Euro / US Dollar CFD' },
  { symbol: 'GBP-USD', price: '1.2645', change: '-0.08%', volume: '$8.1B', leverage: '100x', category: 'Forex', logo: 'GBP', company: 'Pound / US Dollar CFD' },
  { symbol: 'USD-JPY', price: '149.52', change: '+0.34%', volume: '$15.2B', leverage: '100x', category: 'Forex', logo: 'JPY', company: 'US Dollar / Yen CFD' },
  
  // STOCKS
  { symbol: 'AAPL-USD', price: '189.45', change: '+0.24%', volume: '$1.2B', leverage: '10x', category: 'Stocks', logo: 'AAPL', company: 'Apple Inc. CFD' },
  { symbol: 'META-USD', price: '502.12', change: '-0.45%', volume: '$840.0M', leverage: '10x', category: 'Stocks', logo: 'META', company: 'Meta Platforms Inc. CFD' },
  { symbol: 'MSFT-USD', price: '415.67', change: '+0.51%', volume: '$950.0M', leverage: '10x', category: 'Stocks', logo: 'MSFT', company: 'Microsoft Corporation CFD' },
];

const categories = ['All', 'Crypto', 'Commodities', 'Forex', 'Stocks'];

export default function MobileTrade() {
  const navigate = useNavigate();
  const location = useLocation();

  // Primary active tab switcher: 'markets', 'trade', 'portfolio'
  // On first load, parse path to select matching tab, fallback to 'markets' by default
  const [activeTab, setActiveTab] = useState(() => {
    if (location.pathname === '/portfolio') return 'portfolio';
    if (location.pathname === '/trade') return 'trade';
    return 'markets';
  });

  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
  };

  // State to manage Market selection overlay/subview inside Markets tab
  const [isMarketSelectorOpen, setIsMarketSelectorOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedPair, setSelectedPair] = useState(() => {
    return localStorage.getItem('brokex_selected_pair') || 'XAU-USD';
  });

  // Position Manager Modal State (for Portfolio positions)
  const [isPosManagerOpen, setIsPosManagerOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [posManagerTab, setPosManagerTab] = useState('close');

  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  const [apiTrades, setApiTrades] = useState([]);
  const [liveGoldPrice, setLiveGoldPrice] = useState(2315.50);
  const [spreadLong, setSpreadLong] = useState(0);
  const [spreadShort, setSpreadShort] = useState(0);
  const [usdcBalance, setUsdcBalance] = useState('0.00');

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
          console.error("MobileTrade Spread WS parsing error:", err);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connectWS, 3000);
      };

      ws.onerror = (err) => {
        console.error("MobileTrade Spread WS error:", err);
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
        console.error("Failed to fetch direct USDC balance on mobile portfolio:", err);
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
        .catch(err => console.error("MobileTrade fetch trades error:", err));
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
        totalEquity: 1965.60,
        unrealizedPnl: 465.60,
        unrealizedPnlPct: 31.0,
        freeMargin: 1500.00,
        lockedCapital: 1000.00,
        realizedPnl: 1799.63,
        totalVolume: 203444.31,
        winRate: 62.8,
        tradesCount: 35,
        winsCount: 22,
        lossesCount: 13,
        isMock: true
      };
    }

    const activeList = apiTrades.filter(t => t.state === 1);
    const closedList = apiTrades.filter(t => t.state >= 2);

    // Sum of margins in active positions (scaled down by 1e6)
    const lockedCapital = activeList.reduce((sum, t) => sum + (parseFloat(t.margin || '0') / 1e6), 0);

    // Free margin is the direct wallet USDC balance
    const freeMargin = parseFloat(usdcBalance) || 0;

    // Unrealized PnL based on real-time gold price feed with spreads taken into account
    let unrealizedPnl = 0;
    activeList.forEach(t => {
      const sizeVal = parseFloat(t.openInterest || '0') / 1e6;
      const openPriceVal = parseFloat(t.openPrice || '0') / 1e6;
      if (openPriceVal > 0) {
        if (t.direction === 1) { // Long -> exits at Bid (Short price)
          const actualMarketPrice = liveGoldPrice * (1 - spreadShort / 1000000);
          unrealizedPnl += sizeVal * (actualMarketPrice - openPriceVal) / openPriceVal;
        } else { // Short -> exits at Ask (Long price)
          const actualMarketPrice = liveGoldPrice * (1 + spreadLong / 1000000);
          unrealizedPnl += sizeVal * (openPriceVal - actualMarketPrice) / openPriceVal;
        }
      }
    });

    const unrealizedPnlPct = lockedCapital > 0 ? (unrealizedPnl / lockedCapital) * 100 : 0;

    // Total Equity = Free Margin + Locked Capital + Unrealized PnL
    const totalEquity = freeMargin + lockedCapital + unrealizedPnl;

    // Realized PnL & Wins/Losses
    let realizedPnl = 0;
    let winsCount = 0;
    let lossesCount = 0;
    closedList.forEach(t => {
      const sizeVal = parseFloat(t.openInterest || '0') / 1e6;
      const openPriceVal = parseFloat(t.openPrice || '0') / 1e6;
      const closePriceVal = parseFloat(t.closePrice || '0') / 1e6;
      if (openPriceVal > 0) {
        let pnlVal = 0;
        if (t.direction === 1) { // Long
          pnlVal = sizeVal * (closePriceVal - openPriceVal) / openPriceVal;
        } else { // Short
          pnlVal = sizeVal * (openPriceVal - closePriceVal) / openPriceVal;
        }
        realizedPnl += pnlVal;
        if (pnlVal > 0) winsCount++;
        if (pnlVal < 0) lossesCount++;
      }
    });

    // Total Volume
    let totalVolume = 0;
    apiTrades.forEach(t => {
      const sizeVal = parseFloat(t.openInterest || '0') / 1e6;
      totalVolume += sizeVal;
    });

    const winRate = (winsCount + lossesCount) > 0 ? (winsCount / (winsCount + lossesCount)) * 100 : 0;

    return {
      totalEquity,
      unrealizedPnl,
      unrealizedPnlPct,
      freeMargin,
      lockedCapital,
      realizedPnl,
      totalVolume,
      winRate,
      tradesCount: apiTrades.length,
      closedCount: closedList.length,
      winsCount,
      lossesCount,
      isMock: false
    };
  }, [apiTrades, isConnected, address, liveGoldPrice, usdcBalance, spreadLong, spreadShort]);

  useEffect(() => {
    if (activeTab === 'trade') {
      setSelectedPair('XAU-USD');
      localStorage.setItem('brokex_selected_pair', 'XAU-USD');
      window.dispatchEvent(new Event('brokex_pair_changed'));
    }
  }, [activeTab]);

  const handleSelectMarket = (symbol) => {
    setSelectedPair(symbol);
    localStorage.setItem('brokex_selected_pair', symbol);
    window.dispatchEvent(new Event('brokex_pair_changed'));
    setIsMarketSelectorOpen(false);
  };

  const handleManagePosition = (position, tab) => {
    setSelectedPosition(position);
    setPosManagerTab(tab);
    setIsPosManagerOpen(true);
  };

  const filteredMarkets = useMemo(() => {
    if (activeCategory === 'All') return marketsData;
    return marketsData.filter(m => m.category === activeCategory);
  }, [activeCategory]);

  const activeMarketInfo = useMemo(() => {
    const market = marketsData.find(m => m.symbol === selectedPair);
    if (market) {
      if (market.symbol === 'XAU-USD') {
        return {
          ...market,
          price: liveGoldPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        };
      }
      return market;
    }
    return { 
      symbol: 'XAU-USD', 
      price: liveGoldPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 
      change: '+0.45%', 
      volume: '$452.0M', 
      leverage: '50x', 
      logo: 'XAU', 
      company: 'Gold / US Dollar CFD' 
    };
  }, [selectedPair, liveGoldPrice]);

  return (
    <MobileLayout disablePadding={true}>
      <style>{`
        .mobile-main-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          width: 100%;
        }
        
        .mobile-chart-area {
          flex: 1;
          background: var(--panel-bg);
          overflow: hidden;
          position: relative;
        }

        .chart.panel {
          border-radius: 0px !important;
          border-left: none !important;
          border-right: none !important;
        }

        /* Premium Bottom Tab Bar styling */
        .mobile-bottom-tabs {
          display: flex;
          background: rgba(10, 10, 10, 0.92);
          backdrop-filter: blur(25px);
          border-top: 1px solid var(--border-color);
          height: 46px;
          padding-bottom: env(safe-area-inset-bottom, 0);
          align-items: center;
          justify-content: space-around;
          z-index: 1000;
          flex-shrink: 0;
        }

        body.light-mode .mobile-bottom-tabs {
          background: rgba(255, 255, 255, 0.92);
        }

        .mobile-tab-item {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          color: var(--text-grey);
          cursor: pointer;
          gap: 6px;
          flex: 1;
          height: 100%;
          transition: all 0.2s ease;
          border: none;
          background: transparent;
          outline: none;
        }

        .mobile-tab-item.active {
          color: var(--gold);
        }

        .mobile-tab-label {
          font-size: 10px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .market-list-card:active {
          transform: scale(0.98);
          background: rgba(200, 169, 126, 0.04);
        }

        /* Hide scrollbars across the app for ultra-clean mobile feeling */
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Main viewport */}
      <main className="mobile-main-container">
        
        {/* TAB 1: MARKETS VIEW (CHART + DETAILS + POSITIONS) */}
        {activeTab === 'markets' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%' }}>
            {isMarketSelectorOpen ? (
              /* Market Selection Subview */
              <div className="no-scrollbar" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', gap: '16px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-dark)', textTransform: 'uppercase', margin: 0 }}>
                    Select Asset
                  </h3>
                  <button 
                    onClick={() => setIsMarketSelectorOpen(false)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-grey)', fontSize: '20px', cursor: 'pointer' }}
                  >
                    &times;
                  </button>
                </div>

                {/* Categories */}
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    {categories.map((cat) => {
                      const isActive = activeCategory === cat;
                      return (
                        <button
                          key={cat}
                          onClick={() => setActiveCategory(cat)}
                          style={{
                            background: isActive ? 'var(--gold-glow)' : 'rgba(255, 255, 255, 0.02)',
                            border: `1px solid ${isActive ? 'var(--gold)' : 'var(--border-color)'}`,
                            color: isActive ? 'var(--gold)' : 'var(--text-grey)',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Markets List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {filteredMarkets.map((m) => {
                    const isPositive = m.change.startsWith('+');
                    return (
                      <div
                        key={m.symbol}
                        onClick={() => handleSelectMarket(m.symbol)}
                        style={{
                          background: 'var(--panel-bg)',
                          border: '1px solid var(--panel-border)',
                          borderRadius: '12px',
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        className="market-list-card"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            background: 'rgba(200, 169, 126, 0.08)',
                            border: '1px solid rgba(200, 169, 126, 0.2)',
                            borderRadius: '8px',
                            color: 'var(--gold)',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            flexShrink: 0
                          }}>
                            {m.logo}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-dark)' }}>
                              {m.symbol}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--text-grey)' }}>
                              Vol {m.volume} ({m.leverage})
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace', color: 'var(--text-dark)' }}>
                            ${m.price}
                          </span>
                          <span style={{ fontSize: '9.5px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace', color: isPositive ? '#3b82f6' : '#ef4444' }}>
                            {m.change}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Unified Chart + Ticker stats + Positions scrollable container */
              <div className="no-scrollbar" style={{ 
                flex: 1, 
                overflowY: 'auto', 
                display: 'flex', 
                flexDirection: 'column', 
                backgroundColor: 'var(--bg-dark)',
                padding: '8px',
                gap: '2px'
              }}>
                
                {/* CARD 1: Unified TradeHeader + Metrics Stats + Chart (看起来像一个整体 div) */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  backgroundColor: 'var(--panel-bg)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  flexShrink: 0
                }}>
                  {/* Unified Header & Market Stats Row */}
                  <MobileTopNav 
                    activeMarketInfo={activeMarketInfo} 
                  />

                  {/* 3. Chart Container */}
                  <div style={{ height: '320px', width: '100%', overflow: 'hidden' }}>
                    <Chart />
                  </div>
                </div>

                {/* CARD 2: Positions Section Card */}
                <div style={{ 
                  flexShrink: 0, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  width: '100%',
                  backgroundColor: 'var(--panel-bg)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  marginBottom: '16px'
                }}>
                  <MobilePositions 
                    onManagePosition={handleManagePosition} 
                    isFullPage={false} 
                  />
                </div>

              </div>
            )}
          </div>
        )}

        {/* TAB 2: TRADE VIEW (ORDER PANEL ONLY) */}
        {activeTab === 'trade' && (
          <div 
            className="no-scrollbar"
            style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              backgroundColor: 'var(--bg-dark)', 
              padding: '8px', 
              width: '100%',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {/* Unified Trade TopNav + Order Panel (One Single Div!) */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              backgroundColor: 'var(--panel-bg)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              overflow: 'visible'
            }}>
              <MobileTopNav 
                activeMarketInfo={activeMarketInfo} 
              />
              
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'visible' }}>
                <MobileOrderPanel 
                  isOpen={true} 
                  onClose={() => handleTabChange('markets')} 
                  initialSide="buy" 
                  isInline={true}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PORTFOLIO VIEW */}
        {activeTab === 'portfolio' && (
          <div 
            className="no-scrollbar"
            style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              backgroundColor: 'var(--bg-dark)', 
              padding: '8px', 
              width: '100%',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {/* Unified Portfolio Stats + Positions (One Single Div!) */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              backgroundColor: 'var(--panel-bg)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              overflow: 'visible'
            }}>
              {/* Top Summary Header Section */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '14px 12px',
                borderBottom: '1px solid var(--border-color)'
              }}>
                {/* Account Summary Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-grey)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.05em' }}>
                    Account Summary
                  </span>
                  <span style={{ fontSize: '8.5px', color: isConnected ? 'var(--gold)' : 'var(--text-grey)', backgroundColor: isConnected ? 'rgba(200, 169, 126, 0.1)' : 'rgba(255, 255, 255, 0.03)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                    {isConnected ? 'LIVE ACCOUNT' : 'DISCONNECTED'}
                  </span>
                </div>

                {/* Main Net Worth / Balance Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid rgba(255, 255, 255, 0.03)', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace', color: isConnected ? 'var(--text-dark)' : 'var(--text-grey)' }}>
                      {isConnected ? `$${portfolioStats.totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </span>
                    <span style={{ fontSize: '9px', color: 'var(--text-grey)', marginTop: '2px' }}>
                      Total Equity (USDC)
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span style={{ 
                      fontSize: '14px', 
                      fontWeight: 'bold', 
                      fontFamily: 'Source Code Pro, monospace', 
                      color: !isConnected ? 'var(--text-grey)' : (portfolioStats.unrealizedPnl >= 0 ? '#3b82f6' : '#ef4444')
                    }}>
                      {isConnected ? `${portfolioStats.unrealizedPnl >= 0 ? '+' : '-'}$${Math.abs(portfolioStats.unrealizedPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </span>
                    <span style={{ fontSize: '9px', color: 'var(--text-grey)', marginTop: '2px' }}>
                      Unrealized PnL {isConnected ? `(${portfolioStats.unrealizedPnl >= 0 ? '+' : '-'}${Math.abs(portfolioStats.unrealizedPnlPct).toFixed(1)}%)` : ''}
                    </span>
                  </div>
                </div>

                {/* Detailed Metrics Grid (Realized PnL, Win Rate, Volume, Wins/Losses) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
                  
                  {/* 1. Free Margin */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '8.5px', color: 'var(--text-grey)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Free Margin</span>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace', color: isConnected ? 'var(--text-dark)' : 'var(--text-grey)' }}>
                      {isConnected ? `$${portfolioStats.freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </span>
                  </div>

                  {/* 2. Realized PNL */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '8.5px', color: 'var(--text-grey)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Realized PNL</span>
                    <span style={{ 
                      fontSize: '12px', 
                      fontWeight: 'bold', 
                      fontFamily: 'Source Code Pro, monospace', 
                      color: !isConnected ? 'var(--text-grey)' : (portfolioStats.realizedPnl >= 0 ? '#3b82f6' : '#ef4444')
                    }}>
                      {isConnected ? `${portfolioStats.realizedPnl >= 0 ? '+' : '-'}$${Math.abs(portfolioStats.realizedPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </span>
                  </div>

                  {/* 3. Total Volume */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '8.5px', color: 'var(--text-grey)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Total Volume</span>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace', color: isConnected ? 'var(--text-dark)' : 'var(--text-grey)' }}>
                      {isConnected ? `$${portfolioStats.totalVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </span>
                  </div>

                  {/* 4. Win Rate */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '8.5px', color: 'var(--text-grey)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                      Win Rate {isConnected ? `(${portfolioStats.closedCount} Tr.)` : ''}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace', color: isConnected ? 'var(--gold)' : 'var(--text-grey)' }}>
                      {isConnected ? (
                        <>{portfolioStats.winRate.toFixed(1)}% <span style={{ fontSize: '9.5px', color: 'var(--text-grey)', fontWeight: 'normal', fontFamily: 'Inter, sans-serif' }}>({portfolioStats.winsCount}W - {portfolioStats.lossesCount}L)</span></>
                      ) : '—'}
                    </span>
                  </div>

                </div>
              </div>

              {/* Bottom Positions Section inside same parent */}
              <div style={{ display: 'flex', flexDirection: 'column', width: '100%', overflow: 'visible' }}>
                <MobilePositions 
                  onManagePosition={handleManagePosition} 
                  isFullPage={true} 
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Premium Sticky Bottom Tab Bar */}
      <footer className="mobile-bottom-tabs">
        {/* Markets Tab Button */}
        <button 
          className={`mobile-tab-item ${activeTab === 'markets' ? 'active' : ''}`}
          onClick={() => handleTabChange('markets')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" />
          </svg>
          <span className="mobile-tab-label">Markets</span>
        </button>

        {/* Trade Tab Button */}
        <button 
          className={`mobile-tab-item ${activeTab === 'trade' ? 'active' : ''}`}
          onClick={() => handleTabChange('trade')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" /><circle cx="12" cy="12" r="3" /><path d="m14 10 2-2" /><path d="m10 14-2 2" /><path d="m14 14 2 2" /><path d="m10 10-2-2" />
          </svg>
          <span className="mobile-tab-label">Trade</span>
        </button>

        {/* Portfolio Tab Button */}
        <button 
          className={`mobile-tab-item ${activeTab === 'portfolio' ? 'active' : ''}`}
          onClick={() => handleTabChange('portfolio')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="14" x="2" y="7" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          <span className="mobile-tab-label">Portfolio</span>
        </button>
      </footer>

      {/* Position action overlay manager */}
      <MobilePositionManager
        isOpen={isPosManagerOpen}
        onClose={() => setIsPosManagerOpen(false)}
        position={selectedPosition}
        initialTab={posManagerTab}
      />
    </MobileLayout>
  );
}
