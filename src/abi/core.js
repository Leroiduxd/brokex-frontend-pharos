export const coreAbi = [
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "supraId",
        "type": "uint256"
      },
      {
        "internalType": "uint8",
        "name": "direction",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "collateral",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "leverage",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "slPrice",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "tpPrice",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "guaranteedSL",
        "type": "bool"
      },
      {
        "internalType": "bytes",
        "name": "oracleProof",
        "type": "bytes"
      },
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "supraId",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "maxOILong",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "maxOIShort",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "spreadLong",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "spreadShort",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "timestamp",
            "type": "uint256"
          },
          {
            "internalType": "bytes",
            "name": "sig",
            "type": "bytes"
          }
        ],
        "internalType": "struct BrokexCore.RiskProof",
        "name": "riskProof",
        "type": "tuple"
      }
    ],
    "name": "openMarketPosition",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "tradeId",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "supraId",
        "type": "uint256"
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
        "name": "targetPrice",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "collateral",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "leverage",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "slPrice",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "tpPrice",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "guaranteedSL",
        "type": "bool"
      }
    ],
    "name": "createLimitOrStopOrder",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "tradeId",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "spender",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "approve",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "spender",
        "type": "address"
      }
    ],
    "name": "allowance",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "nextTradeId",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tradeId",
        "type": "uint256"
      }
    ],
    "name": "cancelOrder",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "supraId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "tradeId",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "oracleProof",
        "type": "bytes"
      },
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "supraId",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "maxOILong",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "maxOIShort",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "spreadLong",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "spreadShort",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "timestamp",
            "type": "uint256"
          },
          {
            "internalType": "bytes",
            "name": "sig",
            "type": "bytes"
          }
        ],
        "internalType": "struct BrokexCore.RiskProof",
        "name": "riskProof",
        "type": "tuple"
      }
    ],
    "name": "closePositionMarket",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tradeId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "newSL",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "newTP",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "guaranteedSL",
        "type": "bool"
      }
    ],
    "name": "modifyStops",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];
