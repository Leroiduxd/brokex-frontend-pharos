import { useState } from 'react';
import { useAccount, useWriteContract, useChainId, useSwitchChain } from 'wagmi';
import { createPublicClient, http } from 'viem';
import { coreAbi } from '../abi/core';
import { CONFIG } from '../config';

const USDC_ADDRESS = CONFIG.addresses.usdc;

// Dedicated, bulletproof public client bound directly to the RPC in .env
const localPublicClient = createPublicClient({
  chain: {
    id: CONFIG.chainId,
    name: 'Pharos Atlantic',
    network: 'pharos-atlantic',
    rpcUrls: {
      default: { http: [CONFIG.rpcUrl] },
      public: { http: [CONFIG.rpcUrl] }
    }
  },
  transport: http(CONFIG.rpcUrl)
});

export function useTrade() {
  const { address, isConnected } = useAccount();
  const currentChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState('');

  const executeTrade = async ({
    supraId = 5500,
    side, // 'buy' or 'sell'
    orderType, // 'market', 'limit', 'stop'
    collateral, // e.g. "100" (string)
    leverage, // e.g. 10 (number)
    targetPrice, // e.g. "2315.50" (string)
    tpPrice, // e.g. "2400.00" (string)
    slPrice, // e.g. "2200.00" (string)
    guaranteedSL, // e.g. true or false
  }) => {
    if (!isConnected || !address) {
      throw new Error("Wallet not connected");
    }

    setIsLoading(true);
    setStatusText("Preparing order...");

    try {
      // Auto-switch network if mismatched
      if (currentChainId !== CONFIG.chainId) {
        setStatusText("Switching network to Pharos Atlantic...");
        try {
          await switchChainAsync({ chainId: CONFIG.chainId });
        } catch (switchErr) {
          throw new Error("Please switch your wallet network to Pharos Atlantic.");
        }
      }

      // 1. Convert parameters to correct decimals (Collateral and Prices are scaled by 10^6)
      const parsedCollateral = BigInt(Math.round(parseFloat(collateral) * 1e6));
      const parsedLeverage = BigInt(leverage); // Leverage is not scaled (standard number, e.g. 10)

      // Dynamic validation check BEFORE contract call to prevent silent reverts/freezes
      if (parsedCollateral < 10000000n) {
        throw new Error("Minimum collateral required by the protocol is 10 USDC");
      }

      const parsedSl = slPrice ? BigInt(Math.round(parseFloat(slPrice) * 1e6)) : 0n;
      const parsedTp = tpPrice ? BigInt(Math.round(parseFloat(tpPrice) * 1e6)) : 0n;

      const direction = side === 'buy' ? 1 : 0; // DIR_LONG = 1, DIR_SHORT = 0

      // 2. Check and handle USDC Allowance using bulletproof local client
      setStatusText("Checking USDC allowance...");
      const allowance = await localPublicClient.readContract({
        address: USDC_ADDRESS,
        abi: coreAbi,
        functionName: 'allowance',
        args: [address, CONFIG.addresses.core],
      });

      if (allowance < parsedCollateral) {
        setStatusText("Approving USDC collateral...");
        const hash = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: coreAbi,
          functionName: 'approve',
          args: [CONFIG.addresses.core, 115792089237316195423570985008687907853269984665640564039457584007913129639935n], // max approval
          gas: 500000n, // Fixed gas to bypass estimation hangs on approve
          chainId: CONFIG.chainId, // Force target chain
        });
        setStatusText("Confirming USDC approval...");
        await localPublicClient.waitForTransactionReceipt({ hash });
      }

      // 3. Handle Market Order vs Limit/Stop Order
      if (orderType === 'market') {
        setStatusText("Fetching oracle pull proof...");
        const proofRes = await fetch(`${CONFIG.apiUrl}/proof?pairs=${supraId}&network=${CONFIG.network}`);
        if (!proofRes.ok) throw new Error("Failed to fetch Supra oracle proof");
        const proofData = await proofRes.json();
        const oracleProof = proofData.proof;

        setStatusText("Fetching signed KMS risk proof...");
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

        setStatusText("Opening market position...");
        const hash = await writeContractAsync({
          address: CONFIG.addresses.core,
          abi: coreAbi,
          functionName: 'openMarketPosition',
          args: [
            BigInt(supraId),
            direction,
            parsedCollateral,
            parsedLeverage,
            parsedSl,
            parsedTp,
            guaranteedSL || false,
            oracleProof,
            riskProof,
          ],
          gas: 3000000n, // Fixed gas to bypass estimation hangs
          chainId: CONFIG.chainId, // Force target chain
        });
        setStatusText("Confirming market transaction...");
        const receipt = await localPublicClient.waitForTransactionReceipt({ hash });
        setStatusText("Market position opened successfully!");
        return receipt;
      } else {
        // Limit or Stop Order
        const typeId = orderType === 'limit' ? 1 : 2; // ORDER_LIMIT = 1, ORDER_STOP = 2
        const parsedTargetPrice = BigInt(Math.round(parseFloat(targetPrice) * 1e6));

        setStatusText(`Creating ${orderType} order...`);
        const hash = await writeContractAsync({
          address: CONFIG.addresses.core,
          abi: coreAbi,
          functionName: 'createLimitOrStopOrder',
          args: [
            BigInt(supraId),
            direction,
            typeId,
            parsedTargetPrice,
            parsedCollateral,
            parsedLeverage,
            parsedSl,
            parsedTp,
            guaranteedSL || false,
          ],
          gas: 3000000n, // Fixed gas to bypass estimation hangs
          chainId: CONFIG.chainId, // Force target chain
        });
        setStatusText("Confirming transaction...");
        const receipt = await localPublicClient.waitForTransactionReceipt({ hash });
        setStatusText(`${orderType.charAt(0).toUpperCase() + orderType.slice(1)} order created successfully!`);
        return receipt;
      }
    } catch (err) {
      console.error("Trade execution failed:", err);
      const errMsg = err.shortMessage || err.message || "Transaction failed";
      setStatusText(`Error: ${errMsg}`);
      throw new Error(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return { executeTrade, isLoading, statusText, setStatusText };
}
