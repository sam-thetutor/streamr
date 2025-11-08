/**
 * Token contract addresses by network
 * Centralized location for all token contract addresses used across the application
 */

export type TokenType = "usdc" | "xlm";

export interface TokenContracts {
  usdc: string;
  xlm: string;
}

/**
 * Token contract addresses for each network
 */
export const TOKEN_CONTRACTS: Record<string, TokenContracts> = {
  TESTNET: {
    usdc: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA", // USDC testnet
    xlm: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC", // Native XLM wrapper (placeholder - update with actual testnet address)
  },
  FUTURENET: {
    usdc: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    xlm: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  },
  PUBLIC: {
    usdc: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC", // USDC mainnet
    xlm: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC", // Native XLM wrapper (placeholder - update with actual mainnet address)
  },
  LOCAL: {
    usdc: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    xlm: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  },
};

/**
 * Get token contract address for a specific network and token type
 * @param network - Network name (TESTNET, FUTURENET, PUBLIC, LOCAL)
 * @param tokenType - Token type (usdc or xlm)
 * @returns Token contract address
 */
export function getTokenContractAddress(
  network: string,
  tokenType: TokenType
): string {
  const contracts = TOKEN_CONTRACTS[network.toUpperCase()] || TOKEN_CONTRACTS.TESTNET;
  return contracts[tokenType];
}

/**
 * Get token symbol from contract address
 * @param contractAddress - Contract address to look up
 * @param network - Optional network name for lookup (defaults to TESTNET)
 * @returns Token symbol (USDC or XLM) or "XLM" as default
 */
export function getTokenSymbol(
  contractAddress: string,
  network: string = "TESTNET"
): string {
  const contracts = TOKEN_CONTRACTS[network.toUpperCase()] || TOKEN_CONTRACTS.TESTNET;
  
  // Compare addresses (case-insensitive)
  const normalizedAddress = contractAddress.toLowerCase();
  
  if (normalizedAddress === contracts.usdc.toLowerCase()) {
    return "USDC";
  }
  if (normalizedAddress === contracts.xlm.toLowerCase()) {
    return "XLM";
  }
  
  // Default to XLM if not found
  return "XLM";
}

/**
 * Testnet-specific token addresses (for convenience)
 */
export const TESTNET_TOKENS = {
  USDC: TOKEN_CONTRACTS.TESTNET.usdc,
  XLM: TOKEN_CONTRACTS.TESTNET.xlm,
};

