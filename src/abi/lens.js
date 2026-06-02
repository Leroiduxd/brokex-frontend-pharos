export const lensAbi = [
  {
    "inputs": [],
    "name": "getProtocolSnapshot",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "lastTradeId",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "openInterestLong",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "openInterestShort",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "totalOpenInterest",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "paused",
            "type": "bool"
          },
          {
            "internalType": "bool",
            "name": "emergencyMode",
            "type": "bool"
          },
          {
            "internalType": "address",
            "name": "coreOwner",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "kmsSigner",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "lpTotalCapital",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "lpFreeCapital",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "lpLockedCapital",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "vaultUsageBps",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "totalPayoutPaid",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "vaultOwner",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "vaultCore",
            "type": "address"
          },
          {
            "internalType": "bool",
            "name": "coreLocked",
            "type": "bool"
          },
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "minLeverage",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "maxLeverage",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "minTradeSize",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "commissionBps",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "fundingRateHourly",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "profitCap",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "executionTolerance",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "maxProofAge",
                "type": "uint256"
              }
            ],
            "internalType": "struct IBrokexCore.Config",
            "name": "config",
            "type": "tuple"
          }
        ],
        "internalType": "struct BrokexLens.ProtocolSnapshot",
        "name": "s",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "assetId",
        "type": "uint256"
      }
    ],
    "name": "getAssetSnapshot",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "supraId",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "openInterestLong",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "openInterestShort",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "totalOpenInterest",
            "type": "uint256"
          },
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "minLeverage",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "maxLeverage",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "minTradeSize",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "commissionBps",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "borrowRateHourly",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "profitCap",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "executionTolerance",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "maxProofAge",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "maxTraderOI",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "maxGlobalOI",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "lockedCapitalBps",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "liqThresholdBps",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "guaranteedSLFeeBps",
                "type": "uint256"
              },
              {
                "internalType": "bool",
                "name": "listed",
                "type": "bool"
              },
              {
                "internalType": "bool",
                "name": "frozen",
                "type": "bool"
              }
            ],
            "internalType": "struct IBrokexCore.AssetConfig",
            "name": "config",
            "type": "tuple"
          }
        ],
        "internalType": "struct BrokexLens.AssetSnapshot",
        "name": "s",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "startId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "length",
        "type": "uint256"
      }
    ],
    "name": "getTradeRange",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "id",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "trader",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "supraId",
            "type": "uint256"
          },
          {
            "internalType": "uint8",
            "name": "state",
            "type": "uint8"
          },
          {
            "internalType": "uint8",
            "name": "direction",
            "type": "uint8"
          },
          {
            "internalType": "uint8",
            "name": "orderType",
            "type": "uint8"
          },
          {
            "internalType": "uint256",
            "name": "margin",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "leverage",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "targetPrice",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "openPrice",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "closePrice",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "stopLoss",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "takeProfit",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "openTimestamp",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "closeTimestamp",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "liqPrice",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "guaranteedSL",
            "type": "bool"
          }
        ],
        "internalType": "struct BrokexLens.Trade[]",
        "name": "result",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];
