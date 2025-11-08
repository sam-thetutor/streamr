// @ts-nocheck
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useEffect } from "react";
import { useWallet } from "./useWallet";
import { useStreamerContract } from "./useStreamerContract";
import { useNotification } from "./useNotification";
import { createTokenTrustline } from "../util/token";
import { Address as StellarBaseAddress, scValToBigInt, xdr } from "@stellar/stellar-base";

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

  const unwrapAddress = useCallback((value: unknown): string => {
    if (!value) return "";
    const asString = String(value).trim();
    if (asString.startsWith("\"") && asString.endsWith("\"")) {
      return asString.slice(1, -1);
    }
    return asString;
  }, []);

  const mapRawSubscription = useCallback(
    (subscription: any): Subscription | null => {
      if (!subscription) return null;
      const id = Number(subscription.id?.toString?.() ?? subscription.id);
      if (Number.isNaN(id)) return null;

      const amount = subscription.amount_per_interval?.toString?.() ?? subscription.amount_per_interval ?? "0";
      const intervalSeconds = subscription.interval_seconds?.toString?.() ?? subscription.interval_seconds ?? "0";
      const nextPaymentTime = subscription.next_payment_time?.toString?.() ?? subscription.next_payment_time ?? "0";
      const balance = subscription.balance?.toString?.() ?? subscription.balance ?? "0";

      return {
        id,
        subscriber: unwrapAddress(subscription.subscriber || ""),
        receiver: unwrapAddress(subscription.receiver || ""),
        token_contract: unwrapAddress(subscription.token_contract || ""),
        amount_per_interval: BigInt(amount || "0"),
        interval_seconds: BigInt(intervalSeconds || "0"),
        next_payment_time: BigInt(nextPaymentTime || "0"),
        active: Boolean(subscription.active),
        balance: BigInt(balance || "0"),
        title: unwrapOptionalText(subscription.title),
        description: unwrapOptionalText(subscription.description),
      };
    },
    [unwrapAddress, unwrapOptionalText]
  );

  const decodeSubscriptionScVal = useCallback(
    (scVal: xdr.ScVal): Subscription | null => {
      try {
        if (!scVal) return null;
        if (scVal.switch().value !== xdr.ScValType.scvMap().value) {
          return null;
        }

        const entries = scVal.map() ?? [];
        const fieldMap = new Map<string, xdr.ScVal>();
        entries.forEach((entry) => {
          const keyVal = entry.key();
          if (keyVal.switch().value === xdr.ScValType.scvSymbol().value) {
            fieldMap.set(keyVal.sym().toString(), entry.val());
          }
        });

        const bytesToUtf8 = (value: Buffer | Uint8Array): string => {
          if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
            return value.toString("utf-8");
          }
          const array = value instanceof Uint8Array ? value : Uint8Array.from(value);
          if (typeof TextDecoder !== "undefined") {
            return new TextDecoder("utf-8").decode(array);
          }
          let result = "";
          array.forEach((code) => {
            result += String.fromCharCode(code);
          });
          return result;
        };

        const decodeText = (value?: xdr.ScVal): string | null => {
          if (!value) return null;
          const type = value.switch().value;
          if (type === xdr.ScValType.scvString().value) {
            return unwrapOptionalText(value.str().toString());
          }
          if (type === xdr.ScValType.scvSymbol().value) {
            return unwrapOptionalText(value.sym().toString());
          }
          if (type === xdr.ScValType.scvVec().value) {
            const vec = value.vec() ?? [];
            if (!vec.length) return null;
            const tag = vec[0];
            if (tag && tag.switch().value === xdr.ScValType.scvSymbol().value) {
              const symbol = tag.sym().toString();
              if (symbol === "some" && vec.length > 1) {
                return decodeText(vec[1]);
              }
              if (symbol === "none") {
                return null;
              }
            }
            return decodeText(vec[0]);
          }
          if (type === xdr.ScValType.scvVoid().value) {
            return null;
          }
          if (type === xdr.ScValType.scvBytes().value) {
            const bytes = value.bytes();
            const text = bytesToUtf8(bytes);
            return unwrapOptionalText(text);
          }
          return unwrapOptionalText(value.toString());
        };

        const decodeAddress = (value?: xdr.ScVal): string => {
          if (!value) return "";
          const type = value.switch().value;
          if (type === xdr.ScValType.scvAddress().value) {
            return StellarBaseAddress.fromScAddress(value.address()).toString();
          }
          if (type === xdr.ScValType.scvString().value) {
            return unwrapAddress(value.str().toString());
          }
          if (type === xdr.ScValType.scvVec().value) {
            const vec = value.vec() ?? [];
            if (!vec.length) return "";
            return decodeAddress(vec[0]);
          }
          return "";
        };

        const decodeBigIntVal = (value?: xdr.ScVal): bigint => {
          if (!value) return BigInt(0);
          const t = value.switch().value;
          if (
            t === xdr.ScValType.scvI128().value ||
            t === xdr.ScValType.scvU128().value ||
            t === xdr.ScValType.scvI256().value ||
            t === xdr.ScValType.scvU256().value
          ) {
            return scValToBigInt(value);
          }
          if (t === xdr.ScValType.scvU64().value) {
            return scValToBigInt(xdr.ScVal.scvU64(value.u64()));
          }
          if (t === xdr.ScValType.scvI64().value) {
            return scValToBigInt(xdr.ScVal.scvI64(value.i64()));
          }
          if (t === xdr.ScValType.scvU32().value) {
            return BigInt(value.u32());
          }
          if (t === xdr.ScValType.scvI32().value) {
            return BigInt(value.i32());
          }
          return BigInt(0);
        };

        const idVal = fieldMap.get("id");
        const subscriberVal = fieldMap.get("subscriber");
        const receiverVal = fieldMap.get("receiver");
        const tokenContractVal = fieldMap.get("token_contract");

        const amountVal = decodeBigIntVal(fieldMap.get("amount_per_interval"));
        const intervalSecondsVal = decodeBigIntVal(fieldMap.get("interval_seconds"));
        const nextPaymentTimeVal = decodeBigIntVal(fieldMap.get("next_payment_time"));
        const balanceVal = decodeBigIntVal(fieldMap.get("balance"));
        const activeVal =
          fieldMap.get("active")?.switch().value === xdr.ScValType.scvBool().value
            ? Boolean(fieldMap.get("active")?.b())
            : false;

        const id =
          idVal && idVal.switch().value === xdr.ScValType.scvU32().value ? Number(idVal.u32()) : 0;

        const rawSubscription = {
          id,
          subscriber: decodeAddress(subscriberVal),
          receiver: decodeAddress(receiverVal),
          token_contract: decodeAddress(tokenContractVal),
          amount_per_interval: amountVal,
          interval_seconds: intervalSecondsVal,
          next_payment_time: nextPaymentTimeVal,
          active: activeVal,
          balance: balanceVal,
          title: decodeText(fieldMap.get("title")),
          description: decodeText(fieldMap.get("description")),
        };

        return mapRawSubscription(rawSubscription);
      } catch (err) {
        console.error("Failed to decode subscription ScVal", err);
        return null;
      }
    },
    [mapRawSubscription, unwrapAddress, unwrapOptionalText]
  );

  const decodeSubscriptionListScVal = useCallback(
    (scVal: xdr.ScVal): Subscription[] => {
      if (!scVal) return [];
      if (scVal.switch().value === xdr.ScValType.scvVec().value) {
        const vec = scVal.vec() ?? [];
        const subscriptions: Subscription[] = [];
        vec.forEach((item) => {
          const decoded = decodeSubscriptionScVal(item);
          if (decoded) {
            subscriptions.push(decoded);
          }
        });
        return subscriptions;
      }

      const single = decodeSubscriptionScVal(scVal);
      return single ? [single] : [];
    },
    [decodeSubscriptionScVal]
  );

  /**
   * Fetch a single subscription by ID
   */
  const fetchSubscription = useCallback(
    async (subscriptionId: number): Promise<Subscription> => {
      const client = getContractClient();
      const tx = await client.get_subscription({ subscription_id: subscriptionId }, { simulate: false });

      try {
        await tx.simulate();
      } catch (simulateError) {
        console.warn(`Simulation failed for subscription ${subscriptionId}`, simulateError);
      }

      try {
        const raw = (tx as any).result ?? (tx as any);
        const parsed = raw?.result ?? raw;
        const mapped = mapRawSubscription(parsed);
        if (mapped) {
          return mapped;
        }
      } catch (err) {
        console.warn(`Generated bindings failed to parse subscription ${subscriptionId}`, err);
      }

      const fallback = decodeSubscriptionScVal(tx.simulationData.result.retval);
      if (fallback) {
        return fallback;
      }

      throw new Error(`Unable to decode subscription ${subscriptionId}`);
    },
    [getContractClient, mapRawSubscription, decodeSubscriptionScVal]
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
    const ids = new Set<number>();

    const collectIds = async (promise: Promise<any>) => {
      try {
        const tx = await promise;
        if (!tx || typeof tx.simulate !== "function") {
          console.warn("collectIds received unexpected response", tx);
          return;
        }

        try {
          await tx.simulate();
        } catch (simulateError) {
          console.warn("Simulation failed for subscription ID fetch", simulateError);
        }

        const resultScVal = tx.simulationData?.result?.retval;
        const arr: number[] = [];
        if (resultScVal && resultScVal.switch().value === xdr.ScValType.scvVec().value) {
          const vec = resultScVal.vec() ?? [];
          vec.forEach((item) => {
            if (item.switch().value === xdr.ScValType.scvU32().value) {
              arr.push(Number(item.u32()));
            } else if (item.switch().value === xdr.ScValType.scvI32().value) {
              arr.push(Number(item.i32()));
            } else {
              const num = Number(item.toString?.() ?? NaN);
              if (!Number.isNaN(num)) {
                arr.push(num);
              }
            }
          });
        }

        arr.forEach((num) => {
          if (!Number.isNaN(num)) {
            ids.add(num);
          }
        });
      } catch (err) {
        console.error("Failed to collect subscription IDs", err);
      }
    };

    await collectIds(client.get_user_subs_ids({ user: address }, { simulate: false }));
    await collectIds(client.get_user_rcvd_subs_ids({ user: address }, { simulate: false }));

    const subscriptions: Subscription[] = [];
    for (const id of ids) {
      try {
        const subscription = await fetchSubscription(id);
        if (subscription) {
          subscriptions.push(subscription);
        }
      } catch (err) {
        console.error(`Failed to fetch subscription ${id}`, err);
      }
    }

    return subscriptions;
  }, [address, getContractClient, fetchSubscription]);

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

