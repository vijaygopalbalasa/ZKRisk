export const CONTRACT_ADDRESSES = {
  polygonAmoy: {
    realOracle: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    selfBridge: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    crossChainLending: "0xA284019Bb11ECba38c3878E5d6e0298fDa671231",
    x402Payment: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
    loan: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    memeLoan: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    pythVolReader: "0x559B0CEB4E421e6b416C7e215B3D51a41E1384a1",
    paperHandInsurance: "0x827ab19526F835730f657F63D2f0ef0B6fea35B3",
    mockSHIB: "0x22595C3725FEDc4e64748542B4C31C2A14a49963"
  },
  localhost: {
    realOracle: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    selfBridge: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    crossChainLending: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    x402Payment: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
    loan: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    memeLoan: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    pythVolReader: "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853",
    paperHandInsurance: "0x0165878A594ca255338adfa4d48449f69242Eb8F",
    mockSHIB: "0x22595C3725FEDc4e64748542B4C31C2A14a49963"
  }
} as const

export const NETWORK_CONFIG = {
  polygonAmoy: {
    chainId: 80002,
    name: "Polygon Amoy Testnet",
    rpcUrl: "https://rpc-amoy.polygon.technology/",
    blockExplorer: "https://amoy.polygonscan.com",
    nativeCurrency: {
      name: "POL",
      symbol: "POL",
      decimals: 18
    }
  },
  localhost: {
    chainId: 31337,
    name: "Localhost",
    rpcUrl: "http://127.0.0.1:8545",
    blockExplorer: "http://localhost:8545",
    nativeCurrency: {
      name: "ETH",
      symbol: "ETH",
      decimals: 18
    }
  }
} as const

// Contract ABIs (simplified for frontend use)
export const CONTRACT_ABIS = {
  Loan: [
    "function deposit(uint256 amount) external",
    "function borrow(uint256 usdcAmount, uint256 lambda, uint256 minLambda, bytes calldata aiProof) external",
    "function vaults(address user) external view returns (uint256 collateralAmount, uint256 debtAmount, uint256 lastLambda, uint256 lastUpdateTime)",
    "function oracle() external view returns (address)",
    "function SHIB() external view returns (address)",
    "function USDC() external view returns (address)",
    "event Deposit(address indexed user, uint256 amount, uint256 timestamp)",
    "event Borrow(address indexed user, uint256 usdcAmount, uint256 lambda, uint256 timestamp)"
  ],
  MemeLoan: [
    "function deposit(uint256 amount) external",
    "function borrow(uint256 usdcAmount, uint256 lambda, uint256 minLambda, bytes calldata aiProof) external",
    "function vaults(address user) external view returns (uint256 collateralAmount, uint256 debtAmount, uint256 lastLambda, uint256 lastUpdateTime)",
    "function oracle() external view returns (address)",
    "function SHIB() external view returns (address)",
    "function USDC() external view returns (address)",
    "event Deposit(address indexed user, uint256 amount, uint256 timestamp)",
    "event Borrow(address indexed user, uint256 usdcAmount, uint256 lambda, uint256 timestamp)"
  ],
  MockERC20: [
    {
      name: "balanceOf",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "account", type: "address" }],
      outputs: [{ name: "", type: "uint256" }]
    },
    {
      name: "approve",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [
        { name: "spender", type: "address" },
        { name: "amount", type: "uint256" }
      ],
      outputs: [{ name: "", type: "bool" }]
    },
    {
      name: "transfer",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" }
      ],
      outputs: [{ name: "", type: "bool" }]
    },
    {
      name: "allowance",
      type: "function",
      stateMutability: "view",
      inputs: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" }
      ],
      outputs: [{ name: "", type: "uint256" }]
    },
    {
      name: "decimals",
      type: "function",
      stateMutability: "view",
      inputs: [],
      outputs: [{ name: "", type: "uint8" }]
    },
    {
      name: "symbol",
      type: "function",
      stateMutability: "view",
      inputs: [],
      outputs: [{ name: "", type: "string" }]
    },
    {
      name: "name",
      type: "function",
      stateMutability: "view",
      inputs: [],
      outputs: [{ name: "", type: "string" }]
    }
  ],
  PaperHandInsurance: [
    "function mintInsurance(string memory memeText, uint256 loanAmount) external returns (uint256)",
    "function claimInsurance(uint256 tokenId) external",
    "function getInsuranceDetails(uint256 tokenId) external view returns (string memory memeText, uint256 loanAmount, bool claimed)",
    "event InsuranceMinted(address indexed user, uint256 indexed tokenId, string memeText)",
    "event InsuranceClaimed(address indexed user, uint256 indexed tokenId, uint256 payout)"
  ]
} as const

export function getContractAddress(network: keyof typeof CONTRACT_ADDRESSES, contract: keyof typeof CONTRACT_ADDRESSES.polygonAmoy): string {
  return CONTRACT_ADDRESSES[network]?.[contract] || ""
}

export function getNetworkConfig(network: keyof typeof NETWORK_CONFIG) {
  return NETWORK_CONFIG[network]
}