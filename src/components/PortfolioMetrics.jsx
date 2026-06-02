import React, { useState, useEffect, useMemo } from 'react';
import { CONFIG } from '../config';
import { useAccount } from 'wagmi';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Helper to generate a list of Date objects from N days ago to today
function getDatesRange(days) {
  const dates = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    dates.push(d);
  }
  return dates;
}

export default function PortfolioMetrics() {
  const [activeMainTab, setActiveMainTab] = useState('pnl'); // 'pnl' | 'volume' | 'gainloss'
  const [isNet, setIsNet] = useState(false);
  const [activeTimeframe, setActiveTimeframe] = useState('7D'); // '7D' | '14D' | '28D'

  const goldAccent = '#BC8961';
  const goldAccentLight = 'rgba(188, 137, 97, 0.15)';

  const { address, isConnected } = useAccount();
  const [apiTrades, setApiTrades] = useState([]);

  // 1. Fetch trades from api.brokex.trade on mount, address changes, or custom trade events
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
        .catch(err => console.error("PortfolioMetrics fetch error:", err));
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

  // 2. Pure dynamic data compiler (100% computed from api.brokex.trade responses)
  const processedData = useMemo(() => {
    const daysCount = activeTimeframe === '7D' ? 7 : activeTimeframe === '14D' ? 14 : 28;
    const dates = getDatesRange(daysCount);

    const labels = dates.map(d => {
      if (activeTimeframe === '7D') {
        return d.toLocaleDateString('en-US', { weekday: 'short' });
      }
      return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    });

    // If not connected or has no trades, return a pure 0 flatline
    if (!isConnected || !address || apiTrades.length === 0) {
      return {
        labels,
        pnl: { gross: Array(daysCount).fill(0), net: Array(daysCount).fill(0) },
        volume: Array(daysCount).fill(0),
        gainLoss: { wins: Array(daysCount).fill(0), losses: Array(daysCount).fill(0) },
        stats: {
          pnl: '$0.00',
          volume: '$0.00',
          gainloss: '0 vs 0',
          winRate: '0.0% Win Rate'
        }
      };
    }

    const grossPnLSet = [];
    const netPnLSet = [];
    const volSet = [];
    const winsSet = [];
    const lossesSet = [];

    let cumulativePnL = 0;
    let totalRealizedVol = 0;
    let totalWins = 0;
    let totalLosses = 0;

    dates.forEach((d) => {
      const startOfDay = new Date(d);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(d);
      endOfDay.setHours(23, 59, 59, 999);

      const startMs = startOfDay.getTime();
      const endMs = endOfDay.getTime();

      let dayGrossPnL = 0;
      let dayVol = 0;
      let dayWins = 0;
      let dayLosses = 0;

      // Volume calculations: sum openInterest size of trades opened OR closed on this day
      const dayTradesOpened = apiTrades.filter(t => {
        const openMs = Number(t.openTimestamp || '0') * 1000;
        return openMs >= startMs && openMs <= endMs;
      });
      const openVol = dayTradesOpened.reduce((sum, t) => sum + (parseFloat(t.openInterest || '0') / 1e6), 0);

      const dayTradesClosedForVol = apiTrades.filter(t => {
        const closeMs = Number(t.closeTimestamp || '0') * 1000;
        return t.state >= 2 && closeMs >= startMs && closeMs <= endMs;
      });
      const closeVol = dayTradesClosedForVol.reduce((sum, t) => sum + (parseFloat(t.openInterest || '0') / 1e6), 0);

      dayVol += (openVol + closeVol);

      // PnL & Wins/Losses calculations: look at closed historical trades (state >= 2)
      const dayTradesClosed = dayTradesClosedForVol;

      dayTradesClosed.forEach(t => {
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
          dayGrossPnL += pnlVal;

          if (pnlVal > 0) {
            dayWins++;
          } else if (pnlVal < 0) {
            dayLosses++;
          }
        }
      });

      cumulativePnL += dayGrossPnL;
      grossPnLSet.push(parseFloat(cumulativePnL.toFixed(2)));
      netPnLSet.push(parseFloat((cumulativePnL * 0.94).toFixed(2))); // Estimated Net after protocol fees
      volSet.push(dayVol);
      winsSet.push(dayWins);
      lossesSet.push(-dayLosses); // Align downward for Losses bar charts

      totalRealizedVol += dayVol;
      totalWins += dayWins;
      totalLosses += dayLosses;
    });

    const finalPnL = grossPnLSet[grossPnLSet.length - 1];
    const winRate = (totalWins + totalLosses) > 0 ? ((totalWins / (totalWins + totalLosses)) * 100).toFixed(1) : '0.0';

    return {
      labels,
      pnl: { gross: grossPnLSet, net: netPnLSet },
      volume: volSet,
      gainLoss: { wins: winsSet, losses: lossesSet },
      stats: {
        pnl: `$${finalPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        volume: `$${totalRealizedVol.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        gainloss: `${totalWins} vs ${totalLosses}`,
        winRate: `${winRate}% Win Rate`
      }
    };
  }, [apiTrades, activeTimeframe, isConnected, address]);

  // Tab stats using the 100% pure calculated statistics
  const topStats = {
    pnl: { label: 'Realized PNL', value: processedData.stats.pnl, sub: '+0.0% vs last period' },
    volume: { label: 'Total Volume', value: processedData.stats.volume, sub: `${apiTrades.length} trades recorded` },
    gainloss: { label: 'Gain & Loss', value: processedData.stats.gainloss, sub: processedData.stats.winRate }
  };

  const currentLabels = processedData.labels;

  // Configure Chart.js options
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true,
        backgroundColor: '#0a0a0a',
        titleColor: '#fff',
        titleFont: {
          family: "'Source Code Pro', monospace",
          size: 10
        },
        bodyColor: goldAccent,
        bodyFont: {
          family: "'Source Code Pro', monospace",
          size: 11,
          weight: 'bold'
        },
        borderColor: goldAccent,
        borderWidth: 1,
        padding: 10,
        displayColors: false,
        callbacks: {
          label: (context) => {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              if (activeMainTab === 'gainloss') {
                label += Math.abs(context.parsed.y) + ' trades';
              } else {
                label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
              }
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: '#888888',
          font: {
            family: "'Source Code Pro', monospace",
            size: 9
          }
        }
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.02)',
          drawTicks: false
        },
        ticks: {
          color: '#888888',
          font: {
            family: "'Source Code Pro', monospace",
            size: 9
          },
          callback: (value) => {
            if (activeMainTab === 'gainloss') return Math.abs(value);
            if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
            if (value <= -1000) return `-$${(Math.abs(value) / 1000).toFixed(0)}k`;
            return value < 0 ? `-$${Math.abs(value)}` : `$${value}`;
          }
        }
      }
    }
  };

  // Generate chart data based on active tab
  const getChartData = () => {
    const barThickness = activeTimeframe === '28D' ? 6 : activeTimeframe === '14D' ? 12 : 24;

    if (activeMainTab === 'pnl') {
      const grossSet = processedData.pnl.gross;
      const netSet = processedData.pnl.net;

      const datasets = [
        {
          label: 'Gross Realized Profit',
          data: grossSet,
          borderColor: goldAccent,
          borderWidth: 2,
          fill: false,
          tension: 0.4,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: goldAccent,
          pointBorderWidth: 2,
          pointHoverRadius: 6,
          pointRadius: activeTimeframe === '28D' ? 0 : 4
        }
      ];

      if (isNet) {
        datasets.push({
          label: 'Net Realized Profit',
          data: netSet,
          borderColor: '#3b82f6',
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false,
          tension: 0.4,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#3b82f6',
          pointBorderWidth: 2,
          pointHoverRadius: 6,
          pointRadius: activeTimeframe === '28D' ? 0 : 4
        });
      }

      return { labels: currentLabels, datasets };
    } else if (activeMainTab === 'volume') {
      const volSet = processedData.volume;
      return {
        labels: currentLabels,
        datasets: [
          {
            label: 'Volume',
            data: volSet,
            backgroundColor: goldAccent,
            borderRadius: 4,
            borderWidth: 0,
            barThickness: barThickness
          }
        ]
      };
    } else {
      const wins = processedData.gainLoss.wins;
      const losses = processedData.gainLoss.losses;
      return {
        labels: currentLabels,
        datasets: [
          {
            label: 'Wins',
            data: wins,
            backgroundColor: '#3b82f6',
            borderRadius: 4,
            borderWidth: 0,
            barThickness: barThickness
          },
          {
            label: 'Losses',
            data: losses,
            backgroundColor: '#ef4444',
            borderRadius: 4,
            borderWidth: 0,
            barThickness: barThickness
          }
        ]
      };
    }
  };

  return (
    <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      
      {/* Tab Selector Headers */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--panel-border)' }}>
        {Object.keys(topStats).map((tab) => {
          const active = activeMainTab === tab;
          return (
            <div 
              key={tab} 
              onClick={() => setActiveMainTab(tab)}
              style={{
                flex: 1,
                padding: '10px 16px',
                cursor: 'pointer',
                background: active ? 'rgba(255,255,255,0.01)' : 'transparent',
                borderBottom: `2px solid ${active ? goldAccent : 'transparent'}`,
                transition: 'all 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}
            >
              <span style={{ fontSize: '9px', color: 'var(--text-grey)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>
                {topStats[tab].label}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ 
                  fontSize: '13px', 
                  fontWeight: 'bold', 
                  color: active ? goldAccent : 'var(--text-dark)', 
                  fontFamily: 'Source Code Pro',
                  transition: 'color 0.3s'
                }}>
                  {topStats[tab].value}
                </span>
                <span style={{ fontSize: '9px', color: active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)', transition: 'color 0.3s' }}>
                  {topStats[tab].sub}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart Controls & Canvas Area */}
      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Toggle switch */}
          <div 
            onClick={() => setIsNet(!isNet)}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}
          >
            <div style={{ 
              width: '34px', 
              height: '18px', 
              borderRadius: '10px', 
              backgroundColor: isNet ? goldAccent : 'rgba(255,255,255,0.1)', 
              position: 'relative',
              transition: 'background-color 0.2s',
              border: '1px solid var(--panel-border)'
            }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: isNet ? '#fff' : 'var(--text-grey)',
                position: 'absolute',
                top: '2px',
                left: isNet ? '18px' : '3px',
                transition: 'left 0.2s, background-color 0.2s'
              }} />
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-grey)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Compare Gross vs. Net
            </span>
          </div>

          {/* Timeframe Selectors: 7D, 14D, 28D */}
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.02)', padding: '3px', borderRadius: '6px', border: '1px solid var(--panel-border)' }}>
            {['7D', '14D', '28D'].map((tf) => (
              <button
                key={tf}
                onClick={() => setActiveTimeframe(tf)}
                style={{
                  padding: '4px 10px',
                  fontSize: '10px',
                  fontFamily: 'Source Code Pro',
                  fontWeight: 'bold',
                  background: activeTimeframe === tf ? goldAccentLight : 'transparent',
                  border: `1px solid ${activeTimeframe === tf ? goldAccent : 'transparent'}`,
                  borderRadius: '4px',
                  color: activeTimeframe === tf ? goldAccent : 'var(--text-grey)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Glowing ChartJS Plot Area */}
        <div style={{ position: 'relative', width: '100%', flex: 1, minHeight: 0 }}>
          {activeMainTab === 'volume' || activeMainTab === 'gainloss' ? (
            <Bar data={getChartData()} options={options} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
          ) : (
            <Line data={getChartData()} options={options} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
          )}
        </div>
      </div>
    </div>
  );
}
