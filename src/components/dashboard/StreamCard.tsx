// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import { Text, Button, Icon } from "@stellar/design-system";
import { Box } from "../layout/Box";
import { FormattedStream } from "../../hooks/useStreams";
import { useWallet } from "../../hooks/useWallet";
import { getTokenSymbol } from "../../contracts/tokens";
import { stellarNetwork } from "../../contracts/util";
import { useStreamerContract } from "../../hooks/useStreamerContract";
import "./dashboard-components.css";

interface StreamCardProps {
  stream: FormattedStream;
  type: "sent" | "received";
  onWithdraw?: (streamId: number) => void;
  onCancel?: (streamId: number) => void;
  isWithdrawing?: boolean;
  isCancelling?: boolean;
  onOpenDetails?: (stream: FormattedStream) => void;
}

export const StreamCard: React.FC<StreamCardProps> = ({
  stream,
  type,
  onWithdraw,
  onCancel,
  isWithdrawing = false,
  isCancelling = false,
  onOpenDetails,
}) => {
  const { address } = useWallet();
  const { getContractClient } = useStreamerContract();

  const TOKEN_SCALE = 10_000_000;

  // Format amount for display (assuming 7 decimals)
  const formatAmount = (amount: bigint) => {
    return (Number(amount) / TOKEN_SCALE).toFixed(2);
  };

  // Get token symbol from contract address
  const tokenSymbol = getTokenSymbol(stream.token_contract, stellarNetwork);

  // Format address for display
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const canWithdraw = stream.withdrawableAmount > 0 && type === "received";
  const canCancel = stream.is_active && type === "sent";

  const toBigInt = (value: unknown): bigint => {
    try {
      if (typeof value === "bigint") return value;
      if (typeof value === "number") {
        if (Number.isInteger(value)) {
          return BigInt(value);
        }
        return BigInt(Math.round(value * TOKEN_SCALE));
      }
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed === "") return 0n;
        if (/^-?\d+$/.test(trimmed)) {
          return BigInt(trimmed);
        }
        const asNumber = Number(trimmed);
        if (!Number.isNaN(asNumber)) {
          return BigInt(Math.round(asNumber * TOKEN_SCALE));
        }
      }
      if (typeof value === "object" && value !== null) {
        if ("toString" in value && typeof (value as any).toString === "function") {
          const asString = (value as any).toString();
          if (asString && asString !== "[object Object]") {
            return toBigInt(asString);
          }
        }
        const maybeHi =
          (value as any).hi ??
          (value as any).high ??
          (value as any).upper ??
          (value as any)._hi ??
          (value as any).high_;
        const maybeLo =
          (value as any).lo ??
          (value as any).low ??
          (value as any).lower ??
          (value as any)._lo ??
          (value as any).low_;
        if (maybeHi !== undefined && maybeLo !== undefined) {
          const hi = toBigInt(maybeHi);
          const lo = toBigInt(maybeLo);
          return hi * BigInt("18446744073709551616") + lo;
        }
        if ("value" in value) {
          return toBigInt((value as any).value);
        }
      }
    } catch (error) {
      console.warn("Unable to parse value to BigInt:", value, error);
    }
    return 0n;
  };

  const createMetricsSnapshot = (currentStream: FormattedStream) => {
    const now = Math.floor(Date.now() / 1000);
    let secondsRemaining: number | null = null;

    if (currentStream.remainingDeposit <= 0n || currentStream.progress >= 100) {
      secondsRemaining = 0;
    } else if (currentStream.rate_per_second && currentStream.rate_per_second > 0n) {
      const quotient = currentStream.remainingDeposit / currentStream.rate_per_second;
      const remainder = currentStream.remainingDeposit % currentStream.rate_per_second;
      secondsRemaining = Number(quotient);
      if (remainder > 0n) {
        secondsRemaining += 1;
      }
    }

    return {
      totalStreamed: currentStream.totalStreamed,
      remainingDeposit: currentStream.remainingDeposit,
      progress: currentStream.progress,
      secondsRemaining,
      computedAt: now,
    };
  };

  const initialMetrics = useMemo(() => createMetricsSnapshot(stream), [stream]);

  const [derivedTotals, setDerivedTotals] = useState(initialMetrics);

  useEffect(() => {
    let cancelled = false;

    const computeMetrics = async () => {
      try {
        const client = getContractClient();
        if (!client || typeof client.get_all_recipients_info !== "function") {
          return;
        }

        const res = await client.get_all_recipients_info(
          { stream_id: stream.id },
          { simulate: true }
        );
        const resultData = res?.result || res;
        const recipients = Array.isArray(resultData) ? resultData : [];
        let withdrawn = 0n;
        let accrued = 0n;

        recipients.forEach((tuple: any) => {
          withdrawn += toBigInt(tuple?.[1] ?? tuple?.total_withdrawn ?? 0);
          accrued += toBigInt(tuple?.[2] ?? tuple?.accrued ?? 0);
        });

        const totalStreamed = withdrawn + accrued;
        const deposit = toBigInt(stream.deposit);
        const remaining = deposit > totalStreamed ? deposit - totalStreamed : 0n;
        let progress = stream.progress ?? 0;
        if (deposit > 0n) {
          const scaled = (totalStreamed * 10000n) / deposit;
          progress = Number(scaled) / 100;
          if (progress > 100) {
            progress = 100;
          }
        }

        let secondsRemaining: number | null = null;
        if (remaining === 0n || progress >= 100) {
          secondsRemaining = 0;
        } else if (stream.rate_per_second && stream.rate_per_second > 0n) {
          const quotient = remaining / stream.rate_per_second;
          const remainder = remaining % stream.rate_per_second;
          secondsRemaining = Number(quotient);
          if (remainder > 0n) {
            secondsRemaining += 1;
          }
        }

        if (!cancelled) {
          setDerivedTotals({
            totalStreamed,
            remainingDeposit: remaining,
            progress,
            secondsRemaining,
            computedAt: Math.floor(Date.now() / 1000),
          });
        }
      } catch (error) {
        console.warn("Failed to compute stream metrics for stream", stream.id, error);
        if (!cancelled) {
          setDerivedTotals(initialMetrics);
        }
      }
    };

    computeMetrics();

    return () => {
      cancelled = true;
    };
  }, [stream, getContractClient, initialMetrics]);

  const getTimeRemaining = () => {
    const now = Math.floor(Date.now() / 1000);

    if (derivedTotals.remainingDeposit <= 0n || derivedTotals.progress >= 100) {
      return "Completed";
    }

    if (derivedTotals.secondsRemaining != null) {
      const elapsed = now - derivedTotals.computedAt;
      const secondsLeft = Math.max(0, derivedTotals.secondsRemaining - elapsed);
      if (secondsLeft <= 0) {
        return "Completed";
      }

      const days = Math.floor(secondsLeft / 86400);
      const hours = Math.floor((secondsLeft % 86400) / 3600);
      const minutes = Math.floor((secondsLeft % 3600) / 60);

      if (days > 0) return `${days}d ${hours}h`;
      if (hours > 0) return `${hours}h ${minutes}m`;
      return `${minutes}m`;
    }

    if (!stream.estimatedCompletionTime) {
      return "In progress";
    }

    const seconds = stream.estimatedCompletionTime - now;
    if (seconds <= 0) return "Completed";

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't open modal if clicking on buttons or interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('[role="button"]')) {
      return;
    }
    if (onOpenDetails) {
      console.log('Opening stream details for stream:', stream.id);
      onOpenDetails(stream);
    }
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const streamTitle = (stream.title || "").toString().trim();
  const streamDescription = (stream.description || "").toString().trim();
  const displayTitle = streamTitle.length ? streamTitle : `Stream #${stream.id}`;
  if (process.env.NODE_ENV !== "production") {
    console.debug("StreamCard render", {
      id: stream.id,
      rawTitle: stream.title,
      displayTitle,
    });
  }

  return (
    <div 
      className="stream-card" 
      onClick={handleCardClick} 
      style={{ cursor: onOpenDetails ? 'pointer' : 'default' }}
    >
      <Box gap="sm" direction="column">
        {/* Header */}
        <Box gap="sm" direction="row" justify="space-between" align="center">
          <Box gap="xs" direction="column">
            <Text as="h3" size="md" className="stream-card-title">
              {displayTitle}
            </Text>
            <Text as="p" size="xs" style={{ color: 'var(--color-text-inverse)', opacity: 0.6 }}>
              Stream #{stream.id}
            </Text>
            {streamDescription.length > 0 && (
              <Text as="p" size="sm" className="stream-card-description">
                {streamDescription}
              </Text>
            )}
            <Text as="p" size="sm" style={{ color: 'var(--color-text-inverse)', opacity: 0.8 }}>
              {type === "sent" ? "To" : "From"}: {formatAddress(type === "sent" ? stream.recipient : stream.sender)}
            </Text>
          </Box>
          <div className={`stream-status stream-status-${stream.is_active ? "active" : "inactive"}`}>
            <Text as="span" size="xs">
              {stream.is_active ? "Active" : "Inactive"}
            </Text>
          </div>
        </Box>

        {/* Progress Bar */}
        <Box gap="xs" direction="column">
          <Box gap="xs" direction="row" justify="space-between" align="center">
            <Text as="p" size="sm" style={{ color: 'var(--color-text-inverse)', opacity: 0.8 }}>
              Progress
            </Text>
            <Text as="p" size="sm" className="stream-progress-text">
              {derivedTotals.progress.toFixed(1)}%
            </Text>
          </Box>
          <div className="stream-progress-bar">
            <div
              className="stream-progress-fill"
              style={{ width: `${Math.min(100, derivedTotals.progress)}%` }}
            />
          </div>
        </Box>

        {/* Stats Grid */}
        <div className="stream-stats-grid">
          <Box gap="xs" direction="column">
            <Text as="p" size="xs" style={{ color: 'var(--color-text-inverse)', opacity: 0.8 }}>
              Total Streamed
            </Text>
            <Text as="p" size="md" className="stream-stat-value">
              {formatAmount(derivedTotals.totalStreamed)} {tokenSymbol}
            </Text>
          </Box>
          {canWithdraw && (
            <Box gap="xs" direction="column">
              <Text as="p" size="xs" style={{ color: 'var(--color-text-inverse)', opacity: 0.8 }}>
                Withdrawable
              </Text>
              <Text as="p" size="md" className="stream-stat-value stream-stat-value-highlight">
                {formatAmount(stream.withdrawableAmount)} {tokenSymbol}
              </Text>
            </Box>
          )}
          <Box gap="xs" direction="column">
            <Text as="p" size="xs" style={{ color: 'var(--color-text-inverse)', opacity: 0.8 }}>
              Remaining
            </Text>
            <Text as="p" size="md" className="stream-stat-value">
              {formatAmount(derivedTotals.remainingDeposit)} {tokenSymbol}
            </Text>
          </Box>
          <Box gap="xs" direction="column">
            <Text as="p" size="xs" style={{ color: 'var(--color-text-inverse)', opacity: 0.8 }}>
              Time Remaining
            </Text>
            <Text as="p" size="md" className="stream-stat-value">
              {getTimeRemaining()}
            </Text>
          </Box>
        </div>

        {/* Actions */}
        {(canWithdraw || canCancel) && (
          <Box gap="sm" direction="row" wrap="wrap" onClick={handleButtonClick}>
            {canWithdraw && (
              <Button
                variant="primary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onWithdraw?.(stream.id);
                }}
                disabled={isWithdrawing}
              >
                {isWithdrawing ? (
                  <>
                    <Icon.Loading01 size="sm" />
                    Withdrawing...
                  </>
                ) : (
                  <>
                    Withdraw
                  </>
                )}
              </Button>
            )}
            {canCancel && (
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel?.(stream.id);
                }}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <>
                    <Icon.Loading01 size="sm" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    Cancel
                  </>
                )}
              </Button>
            )}
          </Box>
        )}
      </Box>
    </div>
  );
};

