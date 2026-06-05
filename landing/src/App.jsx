import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import Rectangle1 from './components/Rectangle1';
import Rectangle6 from './components/Rectangle6';
import Rectangle7 from './components/Rectangle7';
import Rectangle8 from './components/Rectangle8';
import Rectangle9 from './components/Rectangle9';

function App() {
  const [goldPrice, setGoldPrice] = useState('4490.00');
  const [priceDirection, setPriceDirection] = useState(null); // 'up', 'down', or null
  const [spreads, setSpreads] = useState({ long: 10, short: 10 });
  const [liveOpenInterest, setLiveOpenInterest] = useState('$0.00');
  const [totalVolume, setTotalVolume] = useState('$0.00');
  const [tradersCount, setTradersCount] = useState('0');

  const prevPriceRef = useRef('4490.00');

  useEffect(() => {
    let goldWs;
    let spreadWs;
    let goldReconnectTimer;
    let spreadReconnectTimer;

    const connectGold = () => {
      console.log("Connecting to XAU/USD price feed...");
      goldWs = new WebSocket('wss://api.brokex.trade/ws/gold');

      goldWs.onopen = () => {
        console.log("XAU/USD price feed connected successfully!");
      };

      goldWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("XAU Price WS received:", data);
          
          // Target correct production payload shape: data.xau_usd.instruments[0].currentPrice
          const currentPriceStr = data?.xau_usd?.instruments?.[0]?.currentPrice;
          
          if (currentPriceStr) {
            const newPriceVal = parseFloat(currentPriceStr);
            const newPriceStr = newPriceVal.toFixed(2);
            const oldPriceVal = parseFloat(prevPriceRef.current);
            
            if (newPriceVal > oldPriceVal) {
              setPriceDirection('up');
            } else if (newPriceVal < oldPriceVal) {
              setPriceDirection('down');
            }
            
            setGoldPrice(newPriceStr);
            prevPriceRef.current = newPriceStr;
            
            // Clear direction class after uptick/downtick animation ends
            setTimeout(() => {
              setPriceDirection(null);
            }, 800);
          }
        } catch (err) {
          console.error("Error parsing gold price WS message:", err, event.data);
        }
      };

      goldWs.onclose = (event) => {
        console.warn("XAU/USD price feed closed. Reconnecting in 3s...", event);
        goldReconnectTimer = setTimeout(connectGold, 3000);
      };

      goldWs.onerror = (err) => {
        console.error("XAU/USD price feed error:", err);
        goldWs.close();
      };
    };

    const connectSpread = () => {
      console.log("Connecting to spreads & KMS feed...");
      spreadWs = new WebSocket('wss://api.brokex.trade/ws/spread');

      spreadWs.onopen = () => {
        console.log("Spreads & KMS feed connected successfully!");
      };

      spreadWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("Spreads/KMS WS received:", data);
          if (data) {
            // Target correct production payload shape: data.mainnet or data.testnet
            const target = data.mainnet || data.testnet;
            if (target) {
              const rawLong = target.spreadLong !== undefined ? target.spreadLong : "100";
              const rawShort = target.spreadShort !== undefined ? target.spreadShort : "100";
              
              // Formatting: e.g. "100" becomes "10" bps or "10.0"
              const longSpread = parseFloat(rawLong) / 10;
              const shortSpread = parseFloat(rawShort) / 10;
              
              setSpreads({ long: longSpread, short: shortSpread });
            }
          }
        } catch (err) {
          console.error("Error parsing spread WS message:", err, event.data);
        }
      };

      spreadWs.onclose = (event) => {
        console.warn("Spreads & KMS feed closed. Reconnecting in 3s...", event);
        spreadReconnectTimer = setTimeout(connectSpread, 3000);
      };

      spreadWs.onerror = (err) => {
        console.error("Spreads & KMS feed error:", err);
        spreadWs.close();
      };
    };

    connectGold();
    connectSpread();

    return () => {
      if (goldWs) goldWs.close();
      if (spreadWs) spreadWs.close();
      clearTimeout(goldReconnectTimer);
      clearTimeout(spreadReconnectTimer);
    };
  }, []);

  useEffect(() => {
    const fetchGlobalStats = async () => {
      try {
        const volRes = await fetch('https://api.brokex.trade/stats/volume?network=mainnet');
        if (volRes.ok) {
          const volData = await volRes.json();
          if (volData && volData.allTimeVolume) {
            const allTimeVol = parseFloat(volData.allTimeVolume.formatted || '0');
            setTotalVolume('$' + allTimeVol.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
          }
        }
      } catch (err) {
        console.error('Failed to fetch volume stats:', err);
      }

      try {
        const rpcPayload = {
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [
            {
              to: '0x8A602984E3750cBA7770F680ea6493e2567FD65e',
              data: '0xaa5f95f6000000000000000000000000000000000000000000000000000000000000157c'
            },
            'latest'
          ],
          id: 1
        };
        const rpcRes = await fetch('https://rpc.pharos.xyz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rpcPayload)
        });
        if (rpcRes.ok) {
          const rpcData = await rpcRes.json();
          const hex = rpcData.result;
          if (hex && hex !== '0x' && hex.length >= 258) {
            const oiHex = hex.substring(194, 258);
            const oiRaw = BigInt('0x' + oiHex);
            const oiVal = Number(oiRaw) / 1e6;
            setLiveOpenInterest('$' + oiVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
          }
        }
      } catch (err) {
        console.error('Failed to fetch open interest from RPC:', err);
      }

      try {
        const rpcPayloadCore = {
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [
            {
              to: '0xC644c18E5F018696D97F407B0c8937D8c5a30424',
              data: '0x813ad083'
            },
            'latest'
          ],
          id: 2
        };
        const rpcResCore = await fetch('https://rpc.pharos.xyz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rpcPayloadCore)
        });
        if (rpcResCore.ok) {
          const rpcDataCore = await rpcResCore.json();
          const hex = rpcDataCore.result;
          if (hex && hex !== '0x') {
            const nextTradeId = BigInt(hex);
            const activeTraders = Number(nextTradeId) - 1;
            setTradersCount(Math.max(0, activeTraders).toString());
          }
        }
      } catch (err) {
        console.error('Failed to fetch traders count from RPC:', err);
      }
    };

    fetchGlobalStats();
    const statsInterval = setInterval(fetchGlobalStats, 15000);
    return () => clearInterval(statsInterval);
  }, []);

  useEffect(() => {
    if (goldPrice) {
      const formattedPrice = parseFloat(goldPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      document.title = `$${formattedPrice} | Brokex Protocol`;
    }
  }, [goldPrice]);

  const priceVal = parseFloat(goldPrice);
  const longPrice = priceVal * (1 + spreads.long / 10000);
  const shortPrice = priceVal * (1 - spreads.short / 10000);

  const longPriceFormatted = isNaN(longPrice) ? '0.00' : longPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const shortPriceFormatted = isNaN(shortPrice) ? '0.00' : shortPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="app-layout">
      {/* Colonne Gauche */}
      <aside className="left-column">
        <div className="left-content">
          {/* Logo & Titre */}
          <header className="brand-header-container">
            <img src="/logo.svg" alt="brokex logo" className="brand-logo" />
            <h1 className="brand-title">Built<br />to Trade.</h1>
            <p className="brand-subtitle">
              One place to trade, build, discover mini apps, and chat securely.
            </p>
          </header>

          {/* Live Trading Widget */}
          <div className="trading-widget">
            <div className="live-price-header">
              <div className="live-asset-info">
                <span className="live-asset-name">XAU/USD</span>
                <span className="live-badge">
                  <span className="live-dot"></span> Live
                </span>
              </div>
              <div className={`live-price-display ${priceDirection || ''}`}>
                ${parseFloat(goldPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="trade-buttons-row">
              <a 
                href="https://app.brokex.trade" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="trade-btn trade-btn-long"
              >
                <div className="btn-content">
                  <span className="btn-action">Go Long</span>
                  <span className="btn-spread">${longPriceFormatted}</span>
                </div>
              </a>
              
              <a 
                href="https://app.brokex.trade" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="trade-btn trade-btn-short"
              >
                <div className="btn-content">
                  <span className="btn-action">Go Short</span>
                  <span className="btn-spread">${shortPriceFormatted}</span>
                </div>
              </a>
            </div>
          </div>
          <div className="mobile-only-rect1">
            <Rectangle1 />
          </div>
        </div>

        {/* Partie Basse de la colonne Gauche */}
        <div className="left-footer">
          {/* Statistiques du Protocole */}
          <section className="stats-section">
            <h3 className="section-title">Protocol Stats</h3>
            <div className="stats-ticker-container">
              <div className="stats-ticker-track">
                {/* Premier set */}
                <div className="stat-ticker-item">
                  <span className="stat-label">Total Volume</span>
                  <span className="stat-value">{totalVolume}</span>
                </div>
                <div className="stat-ticker-item">
                  <span className="stat-label">Open Interest</span>
                  <span className="stat-value">{liveOpenInterest}</span>
                </div>
                <div className="stat-ticker-item">
                  <span className="stat-label">Traders</span>
                  <span className="stat-value">{tradersCount}</span>
                </div>
                
                {/* Second set */}
                <div className="stat-ticker-item">
                  <span className="stat-label">Total Volume</span>
                  <span className="stat-value">{totalVolume}</span>
                </div>
                <div className="stat-ticker-item">
                  <span className="stat-label">Open Interest</span>
                  <span className="stat-value">{liveOpenInterest}</span>
                </div>
                <div className="stat-ticker-item">
                  <span className="stat-label">Traders</span>
                  <span className="stat-value">{tradersCount}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Partenaires */}
          <div className="partners-section">
            <span className="partners-label">POWERED BY</span>
            <div className="partners-logos">
              <div className="partner-logo">
                <img src="https://supra.com/images/brand/Supra-Red-Light-Horz.svg" alt="Supra" className="partner-logo-img" />
              </div>
              <div className="partner-logo">
                <img src="/Pharos_horizontallogo_fullcolor_png.png" alt="Pharos" className="partner-logo-img" />
              </div>
              <div className="partner-logo">
                <img src="/Circle%20Logo%20SVG.svg" alt="The Circle" className="partner-logo-img" />
              </div>
            </div>
          </div>
          
          {/* Droits Réservés */}
          <div className="copyright-text">
            brokex protocol all rights reserved.
          </div>
        </div>
      </aside>

      {/* Colonne Droite */}
      <main className="right-column">
        <div className="right-content">
          <div className="rectangles-list">
            <div className="desktop-only-rect1">
              <Rectangle1 />
            </div>
            <Rectangle6 />
            <Rectangle7 />
            <Rectangle8 />
            <Rectangle9 />
          </div>

          {/* Website Footer */}
          <footer className="right-footer">
            <div className="footer-socials">
              <a href="#" className="social-link" aria-label="TikTok">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.02 1.63 4.18 1.02 1.13 2.44 1.83 3.93 1.98v3.83c-1.78-.07-3.51-.76-4.83-1.99-.11-.1-.2-.2-.3-.3v7.48c-.02 3.65-2.52 6.87-6.08 7.63-3.8 1-7.85-1.12-9.08-4.75C.42 14.5 2.1 10.22 5.82 9.02c1.21-.4 2.51-.43 3.73-.13V12.9c-.85-.24-1.77-.2-2.57.19-1.39.63-2.22 2.16-1.94 3.67.24 1.5 1.57 2.62 3.08 2.59 1.63-.03 2.87-1.44 2.87-3.07V.02z"/>
                </svg>
              </a>
              <a href="#" className="social-link" aria-label="Instagram">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>
              </a>
              <a href="https://x.com/brokexfi" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="X (Twitter)">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a href="https://t.me/brokexfi" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="Telegram">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M11.944 0C5.344 0 0 5.344 0 12c0 6.656 5.344 12 12 12 6.656 0 12-5.344 12-12C24 5.344 18.656 0 11.944 0zm5.824 8.352l-1.952 9.216c-.144.656-.544.816-1.088.512l-3-2.208-1.44 1.392c-.16.16-.288.288-.592.288l.208-3.008 5.488-4.96c.24-.208-.048-.32-.368-.112l-6.784 4.272-2.912-.912c-.64-.208-.656-.64.128-.944l11.392-4.384c.528-.192.992.128.824.944z"/>
                </svg>
              </a>
            </div>

            <div className="footer-links">
              <a href="#" className="footer-link">Terms of Service</a>
              <a href="#" className="footer-link">Privacy Policy</a>
              <a href="#" className="footer-link">Cookie Policy</a>
            </div>

            <p className="footer-disclaimer">
              *Brokex does not intend for the products described herein to constitute a financial offering in restricted jurisdictions. Gold trading involves significant risk, is highly volatile, and is subject to local regulations. USDC Rewards on Brokex is rolling out in eligible countries. Additional details may be found <a href="#" className="disclaimer-anchor">here</a>.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;
