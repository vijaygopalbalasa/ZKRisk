export const CONTRACT_ADDRESSES = {
  polygonAmoy: {
    realOracle: "0x449c4eC0676c71c177Ca7B4545285b853C07B685",
    selfBridge: "0xD4D659D2d90D541Ef2A8Ea4DA54efEBC43207e3c",
    crossChainLending: "0x1527614b6cFbA4747Aa46465Aa59a85eEF2485D0",
    x402Payment: "0x2735E02bc823dcac973555490c51ac99D514c313",
    loan: "0x3902514624442c302571cA8B60ecba1B66eBF13A",
    memeLoan: "0x2959E7CE18CA72CF65fB010f0aF892B8B59F7CEB",
    pythVolReader: "0xeac8332cf62C030FFB0bed5Bb8275BA78ACa606E",
    paperHandInsurance: "0x78511D827687aA52dA5bf61e22AE2F6BF9323213",
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
  }
} as const

// Contract ABIs (simplified for frontend use)
export const CONTRACT_ABIS = {
  MemeLoan: [
    "function deposit(address token, uint256 amount) external",
    "function borrow(address token, uint256 amount) external",
    "function getUserPosition(address user) external view returns (uint256 collateral, uint256 borrowed, uint256 ltv)",
    "function getMaxBorrow(address user, address collateralToken) external view returns (uint256)",
    "function calculateLTV(address user, address collateralToken) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "event Deposit(address indexed user, address indexed token, uint256 amount)",
    "event Borrow(address indexed user, address indexed token, uint256 amount)"
  ],
  MockERC20: [
    "function balanceOf(address account) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function decimals() external view returns (uint8)",
    "function symbol() external view returns (string)",
    "function name() external view returns (string)"
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