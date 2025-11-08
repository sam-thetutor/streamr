// @ts-nocheck
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useEffect } from "react";
import { useWallet } from "./useWallet";
import { useStreamerContract } from "./useStreamerContract";
import { useNotification } from "./useNotification";
import { createTokenTrustline } from "../util/token";

/**
 * Subscription data structure from contract
 */
export interface Subscription {
  id: number;
  subscriber: string;
  receiver: string;
  token_contract: string;
  amount_per_interval: bigint;
  interval_seconds: bigint;
  next_payment_time: bigint;
  active: boolean;
  balance: bigint; // NEW: Escrowed balance for this subscription (isolated)
  title?: string | null;
  description?: string | null;
}

/**
 * Formatted subscription for UI display
 */
export interface FormattedSubscription extends Subscription {
  nextPaymentDate: Date;
  timeUntilNextPayment: number; // seconds
  isDue: boolean;
  amountPerIntervalFormatted: string;
  balanceFormatted: string; // NEW: Formatted balance for display
}

/**
 * Hook for fetching and managing subscriptions
 */
export const useSubscriptions = () => {
  const { address, signTransaction } = useWallet();
  const { getContractClient, executeContractMethod } = useStreamerContract();
  const queryClient = useQueryClient();
  const { addNotification } = useNotification();

  const unwrapOptionalText = useCallback((value: any): string | null => {
    if (value === undefined || value === null) return null;
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length ? trimmed : null;
    }
    if (typeof value === "object") {
      if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
        const decoded = value.toString("utf-8").trim();
        return decoded.length ? decoded : null;
      }
      if (typeof value._value === "object" && value._value?.type === "Buffer" && Array.isArray(value._value?.data)) {
        const bytes = Uint8Array.from(value._value.data);
        let decoded = "";
        if (typeof Buffer !== "undefined") {
          decoded = Buffer.from(bytes).toString("utf-8").trim();
        } else if (typeof TextDecoder !== "undefined") {
          decoded = new TextDecoder("utf-8").decode(bytes).trim();
        }
        return decoded.length ? decoded : null;
      }
      if ("some" in value) return unwrapOptionalText(value.some);
      if ("value" in value) return unwrapOptionalText(value.value);
      if ("str" in value) return unwrapOptionalText(value.str);
      if (Array.isArray(value)) {
        if (value.length === 0) return null;
        return unwrapOptionalText(value[0]);
      }
      if (typeof value.toString === "function") {
        const asString = value.toString();
        if (asString && asString !== "[object Object]") {
          return unwrapOptionalText(asString);
        }
      }
    }
    const fallback = String(value ?? "").trim();
    return fallback.length ? fallback : null;
  }, []);

  /**
   * Format subscription data for UI
   */
  const formatSubscription = useCallback(
    (subscription: Subscription): FormattedSubscription => {
      const nextPaymentDate = new Date(Number(subscription.next_payment_time) * 1000);
      const now = Math.floor(Date.now() / 1000);
      const timeUntilNextPayment = Number(subscription.next_payment_time) - now;

      // Format amount (assuming 7 decimals like USDC)
      const amountPerIntervalFormatted = (
        Number(subscription.amount_per_interval) / 10000000
      ).toFixed(2);

      // Format balance (assuming 7 decimals)
      const balanceFormatted = (Number(subscription.balance) / 10000000).toFixed(2);

      const normalizedSubscriber = subscription.subscriber ? subscription.subscriber.trim() : "";
      const normalizedReceiver = subscription.receiver ? subscription.receiver.trim() : "";

      return {
        ...subscription,
        nextPaymentDate,
        timeUntilNextPayment: Math.max(0, timeUntilNextPayment),
        isDue: timeUntilNextPayment <= 0 && subscription.active,
        amountPerIntervalFormatted,
        balanceFormatted,
        subscriber: normalizedSubscriber,
        receiver: normalizedReceiver,
      };
    },
    []
  );

  /**
   * Fetch a single subscription by ID
   */
  const fetchSubscription = useCallback(
    async (subscriptionId: number): Promise<Subscription> => {
      const client = getContractClient();
      const result = await client.get_subscription({ subscription_id: subscriptionId });
      const subscription = result as any;
      return {
        ...(subscription as Subscription),
        title: unwrapOptionalText(subscription.title),
        description: unwrapOptionalText(subscription.description),
      };
    },
    [getContractClient, unwrapOptionalText]
  );

  /**
   * Fetch all subscriptions for the current user using the new contract method
   * This is much more efficient than iterating through subscription IDs
   */
  const fetchAllSubscriptions = useCallback(async (): Promise<Subscription[]> => {
    if (!address) {
      return [];
    }

    const client = getContractClient();
    
    try {
      // Use the new contract method to get all user subscriptions
      // This is a read-only query, so we simulate it and get the result
      const result = await client.get_user_subscriptions_all({ 
        user: address 
      }, {
        simulate: true, // Explicitly simulate to get the result
      });
      
      // For read-only queries, the result is available after simulation
      // Access the result from the AssembledTransaction
      const subscriptions = result.result || [];
      
      // Convert contract Subscription[] to our Subscription[] format
      // Handle the case where subscriptions might be an array or ScVal
      let subscriptionArray: any[] = [];
      if (Array.isArray(subscriptions)) {
        subscriptionArray = subscriptions;
      } else if (subscriptions && typeof subscriptions === 'object') {
        // If it's a wrapped array or ScVal, extract the array
        subscriptionArray = (subscriptions as any).value || (subscriptions as any).values || [];
      }
      
      // Map and deduplicate subscriptions by ID
      const subscriptionMap = new Map<number, Subscription>();
      
      subscriptionArray.forEach((subscription: any) => {
        // Handle different possible formats
        const id = subscription.id?.toString() || subscription.id;
        const subscriptionId = Number(id);
        
        // Only add if we haven't seen this subscription ID before
        if (!subscriptionMap.has(subscriptionId)) {
          const amount = subscription.amount_per_interval?.toString() || subscription.amount_per_interval;
          const intervalSeconds = subscription.interval_seconds?.toString() || subscription.interval_seconds;
          const nextPaymentTime = subscription.next_payment_time?.toString() || subscription.next_payment_time;
          
          const balance = subscription.balance?.toString() || subscription.balance || '0';
          const subscriber = String(subscription.subscriber ?? "").trim();
          const receiver = String(subscription.receiver ?? "").trim();
          
          subscriptionMap.set(subscriptionId, {
            id: subscriptionId,
            subscriber,
            receiver,
            token_contract: subscription.token_contract || '',
            amount_per_interval: BigInt(amount || '0'),
            interval_seconds: BigInt(intervalSeconds || '0'),
            next_payment_time: BigInt(nextPaymentTime || '0'),
            active: subscription.active || false,
            balance: BigInt(balance),
            title: unwrapOptionalText(subscription.title),
            description: unwrapOptionalText(subscription.description),
          });
        }
      });
      
      return Array.from(subscriptionMap.values());
    } catch (error) {
      console.error("Error fetching user subscriptions:", error);
      return [];
    }
  }, [address, getContractClient, unwrapOptionalText]);

  /**
   * Query hook for fetching all subscriptions
   */
  const {
    data: subscriptions = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["subscriptions", address],
    queryFn: fetchAllSubscriptions,
    enabled: !!address,
    refetchInterval: 10000, // Refetch every 10 seconds
    staleTime: 0, // Always consider data stale to ensure fresh data on address change
  });

  /**
   * Invalidate queries when address changes to ensure fresh data
   */
  useEffect(() => {
    if (address) {
      // Invalidate and refetch subscriptions when address changes
      queryClient.invalidateQueries({ queryKey: ["subscriptions", address] });
    } else {
      // Clear subscriptions data when wallet is disconnected
      queryClient.setQueryData(["subscriptions", null], []);
      queryClient.setQueryData(["subscriptions", undefined], []);
    }
  }, [address, queryClient]);

  /**
   * Format subscriptions
   */
  const formattedSubscriptions = useMemo(() => {
    return subscriptions.map(formatSubscription);
  }, [subscriptions, formatSubscription]);

  /**
   * Filter subscriptions by type
   */
  const mySubscriptions = useMemo(
    () =>
      formattedSubscriptions.filter(
        (sub) => sub.subscriber && address && sub.subscriber.toString().trim() === address.trim(),
      ),
    [formattedSubscriptions, address]
  );

  const subscriptionsToMe = useMemo(
    () =>
      formattedSubscriptions.filter(
        (sub) => sub.receiver && address && sub.receiver.toString().trim() === address.trim(),
      ),
    [formattedSubscriptions, address]
  );

  /**
   * Cancel a subscription
   */
  const cancelMutation = useMutation({
    mutationFn: async (subscriptionId: number) => {
      return executeContractMethod(async () => {
        const client = getContractClient();
        return await client.cancel_subscription({ subscription_id: subscriptionId });
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions", address] });
      addNotification("Subscription cancelled successfully!", "success");
    },
    onError: (error: any) => {
      console.error("Cancel subscription failed:", error);
      let errorMessage = "Failed to cancel subscription. Please try again.";
      if (error?.message) {
        if (error.message.includes("rejected") || error.message.includes("User rejected")) {
          errorMessage = "Transaction was cancelled.";
        } else {
          errorMessage = error.message;
        }
      }
      addNotification(errorMessage, "error");
    },
  });

  /**
   * Charge a subscription (execute payment)
   * Can be called by anyone, but only works if subscription is due
   */
  const chargeMutation = useMutation({
    mutationFn: async (subscriptionId: number) => {
      return executeContractMethod(async () => {
        const client = getContractClient();
        return await client.charge_subscription({ subscription_id: subscriptionId });
      });
    },
    onSuccess: async () => {
      // Wait a bit for the transaction to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));
      queryClient.invalidateQueries({ queryKey: ["subscriptions", address] });
      addNotification("Subscription charged successfully!", "success");
    },
    onError: (error: any) => {
      console.error("Charge subscription failed:", error);
      let errorMessage = "Failed to charge subscription. Please try again.";
      if (error?.message) {
        if (error.message.includes("NotDueYet") || error.message.includes("not due")) {
          errorMessage = "Subscription is not due yet.";
        } else if (error.message.includes("InsufficientContractBalance") || error.message.includes("balance")) {
          errorMessage = "Subscription has insufficient balance. Please deposit funds first.";
        } else if (error.message.includes("rejected") || error.message.includes("User rejected")) {
          errorMessage = "Transaction was cancelled.";
        } else {
          errorMessage = error.message;
        }
      }
      addNotification(errorMessage, "error");
    },
  });

  /**
   * Deposit funds to a subscription (isolated escrow)
   * Only the subscriber can deposit
   * Automatically creates trustline if missing
   */
  const depositMutation = useMutation({
    mutationFn: async ({ subscriptionId, amount, tokenContract }: { subscriptionId: number; amount: bigint; tokenContract?: string }) => {
      // First, try to deposit
      try {
        return await executeContractMethod(async () => {
          const client = getContractClient();
          return await client.deposit_to_subscription({ 
            subscription_id: subscriptionId,
            amount: amount,
          });
        });
      } catch (error: any) {
        // If error is about missing trustline, try to create it first
        if (error?.message?.includes("trustline") || error?.message?.includes("TrustLine") || error?.message?.includes("trustline entry is missing")) {
          if (!address || !signTransaction || !tokenContract) {
            throw new Error("Missing trustline: Unable to create trustline automatically. Please ensure you have a trustline for this token.");
          }

          console.log("Trustline missing, attempting to create trustline...");
          addNotification("Creating trustline for token...", "primary");
          
          try {
            // Create the trustline by calling approve on the token contract
            await createTokenTrustline(tokenContract, address, signTransaction);
            
            // Wait a bit for trustline to be established
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Retry the deposit
            console.log("Trustline created, retrying deposit...");
            addNotification("Trustline created. Retrying deposit...", "primary");
            
            return await executeContractMethod(async () => {
              const client = getContractClient();
              return await client.deposit_to_subscription({ 
                subscription_id: subscriptionId,
                amount: amount,
              });
            });
          } catch (trustlineError: any) {
            console.error("Failed to create trustline:", trustlineError);
            throw new Error("Failed to create trustline. Please ensure you have a trustline for this token before depositing.");
          }
        }
        
        // Re-throw other errors
        throw error;
      }
    },
    onSuccess: async () => {
      // Wait a bit for the transaction to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));
      queryClient.invalidateQueries({ queryKey: ["subscriptions", address] });
      addNotification("Deposit successful! Funds added to subscription.", "success");
    },
    onError: (error: any) => {
      console.error("Deposit failed:", error);
      let errorMessage = "Failed to deposit funds. Please try again.";
      if (error?.message) {
        if (error.message.includes("rejected") || error.message.includes("User rejected")) {
          errorMessage = "Transaction was cancelled.";
        } else if (error.message.includes("trustline") || error.message.includes("TrustLine")) {
          errorMessage = "Missing trustline: Unable to create trustline automatically. Please create a trustline for this token first.";
        } else if (error.message.includes("insufficient") || error.message.includes("balance")) {
          errorMessage = "Insufficient balance. Please ensure you have enough tokens in your wallet.";
        } else {
          errorMessage = error.message;
        }
      }
      addNotification(errorMessage, "error");
    },
  });

  return {
    subscriptions: formattedSubscriptions,
    mySubscriptions,
    subscriptionsToMe,
    isLoading,
    error,
    refetch,
    cancel: cancelMutation.mutate,
    charge: chargeMutation.mutate,
    deposit: depositMutation.mutate,
    isCancelling: cancelMutation.isPending,
    isCharging: chargeMutation.isPending,
    isDepositing: depositMutation.isPending,
  };
};

