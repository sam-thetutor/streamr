/**
 * Token utility functions for Stellar Soroban
 * Handles trustline creation and token approval
 */

import {
  Address as StellarAddress,
  TransactionBuilder,
  Operation,
  BASE_FEE,
  nativeToScVal,
} from "@stellar/stellar-sdk";
import { rpcUrl, networkPassphrase } from "../contracts/util";
import { Server, Api } from "@stellar/stellar-sdk/rpc";

/**
 * Create a trustline for a Soroban token contract by calling approve
 * This creates the trustline automatically when you approve the token
 * 
 * For Soroban tokens, trustlines are created automatically when you first interact with the token.
 * Calling approve creates the trustline if it doesn't exist.
 * 
 * @param tokenContractAddress - The token contract address
 * @param userAddress - The user's address
 * @param signTransaction - Function to sign the transaction
 * @returns Promise resolving to the transaction result
 */
export async function createTokenTrustline(
  tokenContractAddress: string,
  userAddress: string,
  signTransaction: (txXdr: string, options?: any) => Promise<{ signedTxXdr: string }>
): Promise<{ hash: string }> {
  const rpcServer = new Server(rpcUrl, { allowHttp: true });
  
  // Get the user's account
  const account = await rpcServer.getAccount(userAddress);
  
  // For Soroban tokens, calling approve with the user as both from and spender
  // creates the trustline automatically
  // We'll approve a large amount (max i128) to create the trustline
  const maxAmount = BigInt("9223372036854775807"); // Max i128
  
  // Build the approve transaction using Operation.invokeContractFunction
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: tokenContractAddress,
        function: "approve",
        args: [
          nativeToScVal(StellarAddress.fromString(userAddress), { type: "address" }),
          nativeToScVal(StellarAddress.fromString(userAddress), { type: "address" }),
          nativeToScVal(maxAmount, { type: "i128" }),
        ],
      })
    )
    .setTimeout(30)
    .build();

  // Simulate to get footprint
  const simResponse = await rpcServer.simulateTransaction(tx);
  
  if (Api.isSimulationError(simResponse)) {
    throw new Error(`Transaction simulation failed: ${simResponse.error}`);
  }

  // Prepare transaction with footprint
  const preparedTx = await rpcServer.prepareTransaction(tx);
  
  // Sign transaction
  const signedResult = await signTransaction(preparedTx.toXDR(), {
    address: userAddress,
    networkPassphrase,
  });

  if (!signedResult?.signedTxXdr) {
    throw new Error("Transaction signing failed");
  }

  // Parse and send
  const signedTx = TransactionBuilder.fromXDR(signedResult.signedTxXdr, networkPassphrase);
  const result = await rpcServer.sendTransaction(signedTx);
  
  // Wait for transaction to be confirmed
  let attempts = 0;
  const maxAttempts = 30;
  while (attempts < maxAttempts) {
    try {
      const txResponse = await rpcServer.getTransaction(result.hash);
      if (txResponse.status === Api.GetTransactionStatus.SUCCESS) {
        return { hash: result.hash };
      }
    } catch (err: any) {
      if (err?.message?.includes("not found") || err?.status === 404) {
        // Transaction not yet confirmed, wait and retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
        continue;
      }
      throw err;
    }
  }

  return { hash: result.hash };
}

