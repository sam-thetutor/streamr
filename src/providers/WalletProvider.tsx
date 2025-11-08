import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { ISupportedWallet } from "@creit.tech/stellar-wallets-kit";
import { walletKit } from "../util/wallet";
import storage from "../util/storage";
import { networkPassphrase } from "../contracts/util";

export interface WalletContextType {
  address?: string;
  network?: string;
  networkPassphrase?: string;
  isPending: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction: (
    txXdr: string,
    options?: {
      address?: string;
      networkPassphrase?: string;
      submit?: boolean;
      submitUrl?: string;
    },
  ) => Promise<{
    signedTxXdr: string;
    signerAddress?: string;
  }>;
  signAuthEntry?: (
    authEntry: string,
    options?: {
      address?: string;
      networkPassphrase?: string;
    },
  ) => Promise<{
    signedAuthEntry: string;
    signerAddress?: string;
  }>;
  refresh: () => Promise<void>;
}

type WalletState = {
  address?: string;
  network?: string;
  networkPassphrase?: string;
};

const initialState: WalletState = {
  address: undefined,
  network: undefined,
  networkPassphrase: undefined,
};

export const WalletContext = createContext<WalletContextType>({
  isPending: true,
  isConnecting: false,
  connect: async () => {},
  disconnect: async () => {},
  signTransaction: async () => ({ signedTxXdr: "", signerAddress: undefined }),
  refresh: async () => {},
});

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<WalletState>(initialState);
  const [isPending, startTransition] = useTransition();
  const [isConnecting, setIsConnecting] = useState(false);

  /**
   * Update wallet state
   */
  const updateState = useCallback(
    (newState: Partial<WalletState>) => {
      setState((prev) => {
        const updated = { ...prev, ...newState };
        // Only update if something actually changed
        if (
          prev.address !== updated.address ||
          prev.network !== updated.network ||
          prev.networkPassphrase !== updated.networkPassphrase
        ) {
          return updated;
        }
        return prev;
      });
    },
    []
  );

  /**
   * Clear wallet state and storage
   */
  const clearState = useCallback(() => {
    updateState(initialState);
    storage.setItem("walletId", "");
    storage.setItem("walletAddress", "");
    storage.setItem("walletNetwork", "");
    storage.setItem("networkPassphrase", "");
  }, [updateState]);

  /**
   * Refresh wallet state from the kit
   */
  const refresh = useCallback(async () => {
    const walletId = storage.getItem("walletId");
    
    if (!walletId) {
      clearState();
      return;
    }

    try {
      walletKit.setWallet(walletId);
      const [addressResult, networkResult] = await Promise.all([
        walletKit.getAddress().catch(() => ({ address: undefined })),
        walletKit.getNetwork().catch(() => ({ network: undefined, networkPassphrase: undefined })),
      ]);

      const address = addressResult.address;
      if (!address) {
        clearState();
        return;
      }

      const newState: WalletState = {
        address,
        network: networkResult.network,
        networkPassphrase: networkResult.networkPassphrase || networkPassphrase,
      };

      // Update storage
      storage.setItem("walletAddress", address);
      if (networkResult.network) {
        storage.setItem("walletNetwork", networkResult.network);
      }
      if (networkResult.networkPassphrase) {
        storage.setItem("networkPassphrase", networkResult.networkPassphrase);
      }

      updateState(newState);
    } catch (error) {
      console.error("Error refreshing wallet state:", error);
      clearState();
    }
  }, [clearState, updateState]);

  /**
   * Connect wallet using StellarWalletsKit modal
   */
  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      await walletKit.openModal({
        modalTitle: "Connect to your wallet",
        onWalletSelected: async (option: ISupportedWallet) => {
          const selectedId = option.id;
          walletKit.setWallet(selectedId);
          storage.setItem("walletId", selectedId);

          try {
            // Get address (this may open wallet extension)
            const addressResult = await walletKit.getAddress();
            
            if (addressResult.address) {
              storage.setItem("walletAddress", addressResult.address);
              
              // For Freighter and Hot Wallet, also get network
              if (selectedId === "freighter" || selectedId === "hot-wallet") {
                try {
                  const networkResult = await walletKit.getNetwork();
                  if (networkResult.network && networkResult.networkPassphrase) {
                    storage.setItem("walletNetwork", networkResult.network);
                    storage.setItem("networkPassphrase", networkResult.networkPassphrase);
                  }
                } catch (networkError) {
                  console.warn("Could not get network:", networkError);
                }
              }

              // Refresh state after connection
              await refresh();
            } else {
              clearState();
            }
          } catch (error) {
            console.error("Error connecting wallet:", error);
            clearState();
          }
        },
      });
    } catch (error) {
      console.error("Error opening wallet modal:", error);
    } finally {
      setIsConnecting(false);
    }
  }, [refresh, clearState]);

  /**
   * Disconnect wallet
   */
  const disconnect = useCallback(async () => {
    try {
      await walletKit.disconnect();
      clearState();
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
      clearState();
    }
  }, [clearState]);

  /**
   * Sign transaction wrapper
   * Matches StellarWalletsKit.signTransaction signature
   */
  const signTransaction = useCallback(
    async (
      txXdr: string,
      options?: {
        address?: string;
        networkPassphrase?: string;
        submit?: boolean;
        submitUrl?: string;
      }
    ) => {
      if (!state.address) {
        throw new Error("Wallet not connected");
      }

      const result = await walletKit.signTransaction(txXdr, {
        address: options?.address || state.address,
        networkPassphrase:
          options?.networkPassphrase ||
          state.networkPassphrase ||
          networkPassphrase,
        submit: options?.submit,
        submitUrl: options?.submitUrl,
      });

      return {
        signedTxXdr: result.signedTxXdr,
        signerAddress: result.signerAddress,
      };
    },
    [state.address, state.networkPassphrase]
  );

  /**
   * Sign auth entry wrapper
   */
  const signAuthEntry = useCallback(
    async (authEntry: string, options?: { address?: string; networkPassphrase?: string }) => {
      if (!state.address) {
        throw new Error("Wallet not connected or auth entry signing not supported");
      }

      const result = await walletKit.signAuthEntry(authEntry, {
        address: options?.address || state.address,
        networkPassphrase: options?.networkPassphrase || state.networkPassphrase || networkPassphrase,
      });

      return {
        signedAuthEntry: result.signedAuthEntry,
        signerAddress: result.signerAddress,
      };
    },
    [state.address, state.networkPassphrase]
  );

  /**
   * Initialize wallet state from storage on mount
   */
  useEffect(() => {
    startTransition(async () => {
      const walletId = storage.getItem("walletId");
      const walletAddress = storage.getItem("walletAddress");
      const walletNetwork = storage.getItem("walletNetwork");
      const storedPassphrase = storage.getItem("networkPassphrase");

      if (walletId && walletAddress) {
        // Set initial state from storage
        updateState({
          address: walletAddress,
          network: walletNetwork || undefined,
          networkPassphrase: storedPassphrase || networkPassphrase,
        });

        // Refresh to verify wallet is still connected
        await refresh();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contextValue = useMemo(
    () => ({
      ...state,
      isPending,
      isConnecting,
      connect,
      disconnect,
      signTransaction,
      signAuthEntry,
      refresh,
    }),
    [state, isPending, isConnecting, connect, disconnect, signTransaction, signAuthEntry, refresh]
  );

  return <WalletContext.Provider value={contextValue}>{children}</WalletContext.Provider>;
};
