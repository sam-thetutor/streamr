import { useCallback } from "react";
import { useWallet } from "./useWallet";
import streamerClient from "../contracts/streamer";
import { networkPassphrase, rpcUrl } from "../contracts/util";
import { TransactionBuilder, xdr } from "@stellar/stellar-sdk";
import { Server } from "@stellar/stellar-sdk/rpc";

/**
 * Hook for interacting with the Streamer contract
 * Provides typed methods for all contract operations
 */
export const useStreamerContract = () => {
  const { address, signTransaction, signAuthEntry, networkPassphrase: walletNetworkPassphrase } = useWallet();

  /**
   * Signer function for contract transactions
   */
  const getSigner = useCallback(() => {
    if (!signTransaction || !address) {
      return null;
    }

    return async (txXdr: string) => {
      const signedResult = await signTransaction(txXdr, {
        address: address,
        networkPassphrase: walletNetworkPassphrase || networkPassphrase,
      });

      if (!signedResult?.signedTxXdr) {
        throw new Error("Transaction signing failed");
      }

      return { signedTxXdr: signedResult.signedTxXdr };
    };
  }, [signTransaction, address, walletNetworkPassphrase, networkPassphrase]);

  /**
   * Auth entry signer for contract operations
   */
  const getAuthEntrySigner = useCallback(() => {
    if (!signAuthEntry || !address) {
      return undefined;
    }

      return async (preimageXdrBase64: string) => {
        try {
          const result = await signAuthEntry(preimageXdrBase64, {
            address: address,
            networkPassphrase: walletNetworkPassphrase || networkPassphrase,
          });

        if (!result?.signedAuthEntry) {
          throw new Error("Auth entry signing failed");
        }

        return result.signedAuthEntry;
      } catch (error) {
        console.error("Error signing auth entry:", error);
        throw error;
      }
    };
  }, [signAuthEntry, address, walletNetworkPassphrase, networkPassphrase]);

  /**
   * Get a configured contract client instance
   * We need to set the publicKey on the client to match the connected wallet
   */
  const getContractClient = useCallback(() => {
    if (!address) {
      throw new Error("Wallet not connected");
    }
    // Set the publicKey on the client to match the connected wallet
    // This ensures transactions are built for the correct account
    (streamerClient as any).options.publicKey = address;
    
    // Note: We don't set signAuthEntry on client options here
    // It will be passed to signAndSend when needed
    // Setting it on client options can cause issues if auth entries aren't needed
    
    return streamerClient;
  }, [address]);

  /**
   * Execute a contract method with automatic signing and submission
   */
  const executeContractMethod = useCallback(
    async <T extends { 
      signAndSend: (options?: { signTransaction?: any; signAuthEntry?: any }) => Promise<any>; 
      needsNonInvokerSigningBy?: (options?: { includeAlreadySigned?: boolean }) => string[];
      signAuthEntries?: (options?: { signAuthEntry?: any; address?: string }) => Promise<void>;
    }>(
      method: () => Promise<T>
    ) => {
      if (!address || !signTransaction) {
        throw new Error("Wallet not connected");
      }

      // Get the assembled transaction
      // The create_stream method automatically simulates by default (simulate: true)
      const assembledTx = await method();

      // The signAndSend method internally calls sign(), which calls needsNonInvokerSigningBy()
      // That method can fail if auth entries have undefined credentials
      // The contract's create_stream requires sender.require_auth() and token.transfer() which may need auth entries
      
      // To avoid double signing, we'll use sign() and send() separately
      // This gives us full control over when signing happens
      
      try {
        // First attempt: rely on the SDK's signAndSend with both signers provided.
        // This path avoids the 'switch' error in most cases when auth entries are present.
        const result = await assembledTx.signAndSend({
          signTransaction: getSigner()!,
          signAuthEntry: getAuthEntrySigner(),
        });
        return result;
      } catch (signAndSendError: any) {
        // Check if this is a user rejection - don't try fallback, just throw
        if (signAndSendError?.message?.includes('rejected') || 
            signAndSendError?.message?.includes('User rejected') ||
            signAndSendError?.message?.includes('denied') ||
            signAndSendError?.message?.includes('cancelled')) {
          throw signAndSendError;
        }

        // Log the error for debugging
        console.error("Transaction sign and send error:", signAndSendError);
        
        // If the error is related to switch/credentials (SDK bug), try manual workaround
        // But skip if user rejected
        if (signAndSendError?.message?.includes('switch') || 
            signAndSendError?.message?.includes('Cannot read properties of undefined') ||
            signAndSendError?.message?.includes('credentials')) {
          
          console.warn("SDK signAndSend failed with auth entry check error, attempting manual transaction signing:", signAndSendError?.message);
          
          try {
            // Rebuild the transaction to get a fresh XDR (not modified by SDK)
            const freshTx = await method();
            
            // Get the built transaction XDR
            let txXdr: string;
            
            if ((freshTx as any).built) {
              txXdr = (freshTx as any).built.toXDR();
            } else if ((freshTx as any).toXDR) {
              txXdr = (freshTx as any).toXDR();
            } else if ((assembledTx as any).built) {
              // Fallback to original if fresh doesn't have it
              txXdr = (assembledTx as any).built.toXDR();
            } else {
              throw new Error("Cannot get transaction XDR - transaction not built");
            }
            
            // Sign auth entries first if needed
            if (freshTx.signAuthEntries && signAuthEntry) {
              try {
                await freshTx.signAuthEntries({
                  signAuthEntry: async (preimageXdrBase64: string) => {
                    const result = await signAuthEntry(preimageXdrBase64, {
                      address: address,
                      networkPassphrase: walletNetworkPassphrase || networkPassphrase,
                    });
                    if (!result?.signedAuthEntry) {
                      throw new Error("Auth entry signing failed");
                    }
                    return result.signedAuthEntry;
                  },
                  address: address,
                });
                // After signing auth entries, get the updated XDR
                if ((freshTx as any).built) {
                  txXdr = (freshTx as any).built.toXDR();
                }
              } catch (authError: any) {
                // If user rejected auth entry signing, throw that error
                if (authError?.message?.includes('rejected') || 
                    authError?.message?.includes('User rejected')) {
                  throw authError;
                }
                console.warn("Auth entry signing in fallback failed:", authError?.message);
                // Continue anyway - some transactions might not need auth entries
              }
            }
            
            // Sign the transaction using StellarWalletsKit
            const signedResult = await signTransaction(txXdr, {
              address: address,
              networkPassphrase: walletNetworkPassphrase || networkPassphrase,
            });
            
            if (!signedResult?.signedTxXdr) {
              throw new Error("Transaction signing failed");
            }

            // Get RPC URL
            const rpcUrlToUse = (freshTx as any).options?.rpcUrl || 
                              (assembledTx as any).options?.rpcUrl || 
                              (streamerClient as any).options?.rpcUrl || 
                              rpcUrl;
            
            if (!rpcUrlToUse) {
              throw new Error("RPC server URL not available");
            }

            // Create RPC server connection
            const rpcServer = new Server(rpcUrlToUse, {
              allowHttp: rpcUrlToUse.includes('localhost') || rpcUrlToUse.includes('127.0.0.1'),
            });

            // Parse and send the signed transaction
            const passphraseToUse = walletNetworkPassphrase || networkPassphrase;
            const signedTx = TransactionBuilder.fromXDR(signedResult.signedTxXdr, passphraseToUse);

            // Send the transaction
            const sentTx = await rpcServer.sendTransaction(signedTx);

            // Wait for transaction to be processed
            const getTx = async (): Promise<any> => {
              try {
                return await rpcServer.getTransaction(sentTx.hash);
              } catch (err: any) {
                if (err?.message?.includes('not found') || err?.status === 404) {
                  return { status: 'NOT_FOUND' };
                }
                throw err;
              }
            };

            let txResponse = await getTx();
            let attempts = 0;
            const maxAttempts = 30;
            
            while (attempts < maxAttempts && (txResponse.status === 'NOT_FOUND' || !txResponse.status)) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              txResponse = await getTx();
              attempts++;
            }

            if (txResponse.status === 'SUCCESS' || txResponse.status === 'PENDING') {
              // Extract the actual return value from the transaction result
              // The resultXdr contains the ScVal encoding of the return value
              let decodedResult: any = null;
              
              if (txResponse.resultXdr) {
                try {
                  // Decode the result XDR manually
                  // For withdraw_stream, it returns i128 which should be a bigint
                  const scVal = xdr.ScVal.fromXDR(txResponse.resultXdr, 'base64');
                  
                  // Handle i128 (signed 128-bit integer)
                  if (scVal.switch() === xdr.ScValType.scvI128()) {
                    const i128 = scVal.i128();
                    const hi = i128.hi();
                    const lo = i128.lo();
                    
                    // Convert Int64/Uint64 to BigInt
                    const hiBig = BigInt(hi.toString());
                    const loBig = BigInt(lo.toString());
                    
                    // Combine: result = hi * 2^64 + lo
                    // For signed i128, we need to handle negative numbers
                    const maxU64 = BigInt('18446744073709551616'); // 2^64
                    let result = hiBig * maxU64 + loBig;
                    
                    // Check if hi is negative (Int64 with high bit set)
                    // If hi is in the range [0, 2^63-1], it's positive
                    // If hi is in the range [2^63, 2^64-1], it's negative
                    const hiStr = hi.toString();
                    const hiNum = Number(hiStr);
                    if (hiNum < 0 || hiNum > 9223372036854775807) {
                      // Negative number: subtract 2^128
                      const maxI128 = BigInt('18446744073709551616') * BigInt('18446744073709551616');
                      decodedResult = result - maxI128;
                    } else {
                      decodedResult = result;
                    }
                    
                    console.log("Decoded i128 result:", decodedResult.toString(), "from hi:", hiStr, "lo:", lo.toString());
                  } else if (scVal.switch() === xdr.ScValType.scvU64()) {
                    decodedResult = BigInt(scVal.u64().toString());
                  } else if (scVal.switch() === xdr.ScValType.scvI64()) {
                    decodedResult = BigInt(scVal.i64().toString());
                  } else {
                    // Fallback: use the raw result
                    console.warn("Unknown ScVal type:", scVal.switch(), "using raw result");
                    decodedResult = txResponse.resultXdr;
                  }
                } catch (decodeError) {
                  console.warn("Could not decode result XDR:", decodeError);
                  decodedResult = txResponse.resultXdr || txResponse.result;
                }
              } else {
                decodedResult = txResponse.result;
              }
              
              return {
                hash: sentTx.hash,
                result: decodedResult,
                rawResult: txResponse.resultXdr || txResponse.result,
              };
            } else {
              throw new Error(`Transaction failed with status: ${txResponse.status || 'UNKNOWN'}`);
            }

          } catch (workaroundError: any) {
            console.error("Manual transaction signing failed:", workaroundError);
            // If user rejected, throw that error directly
            if (workaroundError?.message?.includes('rejected') || 
                workaroundError?.message?.includes('User rejected') ||
                workaroundError?.message?.includes('denied')) {
              throw workaroundError;
            }
            // Otherwise throw with context
            throw new Error(
              `Transaction failed: ${signAndSendError?.message || 'Unknown error'}. ` +
              `Manual workaround also failed: ${workaroundError?.message || 'Unknown error'}`
            );
          }
        }
        
        // Re-throw other errors as-is
        throw signAndSendError;
      }
    },
    [address, signTransaction, signAuthEntry, walletNetworkPassphrase, networkPassphrase]
  );

  /**
   * Query contract method (read-only)
   */
  const queryContractMethod = useCallback(
    async <T>(method: () => Promise<T>): Promise<T> => {
      // For read-only methods, we can call them directly
      // The contract client handles read-only calls differently
      return await method();
    },
    []
  );

  return {
    address,
    isConnected: !!address,
    getContractClient,
    executeContractMethod,
    queryContractMethod,
    getSigner,
    getAuthEntrySigner,
  };
};

