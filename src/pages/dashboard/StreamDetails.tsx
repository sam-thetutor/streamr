// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import { Text, Button, Icon } from "@stellar/design-system";
import { useParams, useNavigate } from "react-router-dom";
import { Box } from "../../components/layout/Box";
import { useStreams } from "../../hooks/useStreams";
import { useWallet } from "../../hooks/useWallet";
import { useStreamerContract } from "../../hooks/useStreamerContract";
import { useNotification } from "../../hooks/useNotification";
import { useQueryClient } from "@tanstack/react-query";
import { getTokenSymbol } from "../../contracts/tokens";
import { stellarNetwork } from "../../contracts/util";
import "./stream-details.css";

type RecipientInfo = {
  address: string;
  totalWithdrawn: bigint;
  accrued: bigint;
  lastWithdrawTime: bigint;
};

export const StreamDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { address } = useWallet();
  const { streams, withdraw, cancel, isWithdrawing, isCancelling } = useStreams();
  const { getContractClient, executeContractMethod } = useStreamerContract();
  const { addNotification } = useNotification();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<RecipientInfo[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const streamId = id ? parseInt(id, 10) : null;
  const stream = streamId ? streams.find(s => s.id === streamId) : null;

  const tokenSymbol = stream ? getTokenSymbol(stream.token_contract, stellarNetwork) : "";

  const TOKEN_SCALE = 10_000_000;

  const fmt = (v: string | number | bigint) => {
    const n = typeof v === "bigint" ? Number(v) : typeof v === "string" ? parseFloat(v) : v;
    return (Number(n) / TOKEN_SCALE).toFixed(6);
  };

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
        if (value instanceof Date) {
          return BigInt(Math.trunc(value.getTime() / 1000));
        }
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
    } catch (err) {
      console.warn("Unable to parse value to BigInt:", value, err);
    }
    return 0n;
  };

  const toTimestamp = (value: unknown): bigint => {
    if (typeof value === "bigint") return value;
    if (typeof value === "number") return BigInt(Math.max(0, Math.trunc(value)));
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed === "") return 0n;
      if (/^\d+$/.test(trimmed)) return BigInt(trimmed);
      const asNumber = Number(trimmed);
      if (!Number.isNaN(asNumber)) return BigInt(Math.max(0, Math.trunc(asNumber)));
    }
    if (typeof value === "object" && value !== null) {
      if (value instanceof Date) {
        return BigInt(Math.trunc(value.getTime() / 1000));
      }
      const maybeHi = (value as any).hi ?? (value as any).high;
      const maybeLo = (value as any).lo ?? (value as any).low;
      if (maybeHi !== undefined && maybeLo !== undefined) {
        const hi = toBigInt(maybeHi);
        const lo = toBigInt(maybeLo);
        return hi * BigInt("18446744073709551616") + lo;
      }
      if ("value" in value) {
        return toTimestamp((value as any).value);
      }
    }
    return 0n;
  };

  const formatTimestamp = (value: bigint) => {
    if (!value || value <= 0n) {
      return "Never";
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return `${value.toString()}s`;
    }
    const date = new Date(numeric * 1000);
    if (Number.isNaN(date.getTime())) {
      return `${value.toString()}s`;
    }
    return date.toLocaleString();
  };

  // Check if current user is a recipient (check after recipients are loaded)
  const isRecipient = address && recipients.length > 0 && recipients.some(r => r.address === address);
  // For withdraw, check if user is recipient and has withdrawable amount
  // We need to check the accrued amount from recipients list, not stream.withdrawableAmount
  const userRecipientInfo = address ? recipients.find(r => r.address === address) : null;
  const userAccrued = userRecipientInfo?.accrued ?? 0n;
  const canWithdraw = stream && stream.is_active && isRecipient && userAccrued > 0n;
  const canCancel = stream && stream.is_active && stream.sender === address;

  useEffect(() => {
    const load = async () => {
      if (!streamId || !stream) return;
      try {
        setLoading(true);
        setError(null);
        const client = getContractClient();
        if (!client) return;
        if (typeof (client as any).get_all_recipients_info === "function") {
          // stream_id should be u32 (number), not BigInt
          const res = await (client as any).get_all_recipients_info({ stream_id: streamId }, { simulate: true });
          // Handle the result - it might be in result.result or directly the array
          const resultData = res?.result || res;
          const mapped: RecipientInfo[] = (Array.isArray(resultData) ? resultData : []).map((tuple: any) => {
            const address = String(tuple?.[0] ?? tuple?.address ?? "");
            const totalWithdrawn = toBigInt(tuple?.[1] ?? tuple?.total_withdrawn ?? 0);
            const accrued = toBigInt(tuple?.[2] ?? tuple?.accrued ?? 0);
            const lastWithdrawTime = toTimestamp(tuple?.[3] ?? tuple?.last_withdraw_time ?? 0);
            return {
              address,
              totalWithdrawn,
              accrued,
              lastWithdrawTime,
            };
          });
          setRecipients(mapped);
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load details");
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId, stream?.id, refreshTrigger]);

  const { streamedAmount, remainingAmount, progressPercent } = useMemo(() => {
    if (!stream) {
      return {
        streamedAmount: 0n,
        remainingAmount: 0n,
        progressPercent: stream?.progress ?? 0,
      };
    }

    const withdrawnSum = recipients.reduce((sum, recipient) => sum + recipient.totalWithdrawn, 0n);
    const accruedSum = recipients.reduce((sum, recipient) => sum + recipient.accrued, 0n);
    const streamedTotal = withdrawnSum + accruedSum;
    const deposit = toBigInt(stream.deposit);
    const remaining = deposit > streamedTotal ? deposit - streamedTotal : 0n;
    let progressValue = stream.progress ?? 0;
    if (deposit > 0n) {
      const scaled = (streamedTotal * 10000n) / deposit; // two decimal places
      progressValue = Number(scaled) / 100;
      if (progressValue > 100) {
        progressValue = 100;
      }
    }

    return {
      streamedAmount: streamedTotal,
      remainingAmount: remaining,
      progressPercent: progressValue,
    };
  }, [recipients, stream]);

  const totalStreamedDisplay = recipients.length > 0 ? streamedAmount : toBigInt(stream?.totalStreamed ?? 0);
  const remainingDepositDisplay = recipients.length > 0 ? remainingAmount : toBigInt(stream?.remainingDeposit ?? 0);
  const progressDisplay = recipients.length > 0 ? progressPercent : stream?.progress ?? 0;

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  const displayTitle = stream?.title && stream.title.trim().length > 0 ? stream.title.trim() : `Stream #${stream?.id ?? ""}`;
  const displayDescription = stream?.description && stream.description.trim().length > 0 ? stream.description.trim() : "";  

  const handleWithdraw = async () => {
    if (!streamId || !address) return;
    
    try {
      // Use the withdraw function from useStreams hook
      // But we need to pass the recipient address, so we'll call it directly
      const client = getContractClient();
      if (!client) return;

      await executeContractMethod(async () => {
        return await client.withdraw_stream({ 
          stream_id: streamId, 
          recipient: address 
        });
      });

      addNotification("Successfully withdrawn from stream!", "success");
      // Invalidate streams query to refresh stream data
      queryClient.invalidateQueries({ queryKey: ["streams"] });
      // Trigger a refresh of recipient data after a short delay
      setTimeout(() => {
        setRefreshTrigger(prev => prev + 1);
      }, 2000);
    } catch (err: any) {
      console.error("Withdraw failed:", err);
      let errorMessage = "Failed to withdraw from stream.";
      if (err?.message) {
        if (err.message.includes("NothingToWithdraw")) {
          errorMessage = "No funds available to withdraw.";
        } else if (err.message.includes("rejected")) {
          errorMessage = "Transaction was cancelled.";
        } else {
          errorMessage = err.message;
        }
      }
      addNotification(errorMessage, "error");
    }
  };

  const handleCancel = async () => {
    if (!streamId) return;
    
    try {
      cancel(streamId);
      addNotification("Stream cancelled successfully!", "success");
      setTimeout(() => {
        navigate("/dashboard/streams");
      }, 2000);
    } catch (err: any) {
      console.error("Cancel failed:", err);
      addNotification("Failed to cancel stream.", "error");
    }
  };

  if (!streamId || !stream) {
    return (
      <div className="stream-details-page">
        <Box gap="lg" direction="column" align="center">
          <Icon.AlertCircle size="xl" />
          <Text as="h2" size="lg">Stream not found</Text>
          <Button variant="secondary" onClick={() => navigate("/dashboard/streams")}>
            Back to Streams
          </Button>
        </Box>
      </div>
    );
  }

  return (
    <div className="stream-details-page">
      <Box gap="lg" direction="column">
        {/* Header with Back Button */}
        <Box gap="md" direction="row" justify="space-between" align="center" wrap="wrap">
          <Box gap="sm" direction="row" align="center">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate("/dashboard/streams")}
            >
              <Icon.ArrowLeft size="sm" />
              Back to Streams
            </Button>
            <Box gap="xs" direction="column">
              <Text as="h1" size="xl" className="page-title">{displayTitle}</Text>
              <Text as="p" size="sm" style={{ opacity: 0.75 }}>
                {displayDescription}
              </Text>
            </Box>
          </Box>
          {/* Action Buttons */}
          {(canWithdraw || canCancel) && (
            <Box gap="sm" direction="row" wrap="wrap">
              {canWithdraw && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleWithdraw}
                  disabled={isWithdrawing}
                >
                  {isWithdrawing ? (
                    <>
                      <Icon.Loading01 size="sm" />
                      Withdrawing...
                    </>
                  ) : (
                    <>
                      Withdraw {fmt(userAccrued)} {tokenSymbol}
                    </>
                  )}
                </Button>
              )}
              {canCancel && (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleCancel}
                  disabled={isCancelling}
                >
                  {isCancelling ? (
                    <>
                      <Icon.Loading01 size="sm" />
                      Cancelling...
                    </>
                  ) : (
                    <>
                      Cancel Stream
                    </>
                  )}
                </Button>
              )}
            </Box>
          )}
        </Box>

        {/* Stream Overview Cards */}
        <div className="preview-grid">
          <div className="preview-card">
            <Text as="p" size="sm" style={{ opacity: 0.8 }}>Token</Text>
            <Text as="p" size="lg" className="stream-stat-value">{tokenSymbol}</Text>
          </div>
          <div className="preview-card">
            <Text as="p" size="sm" style={{ opacity: 0.8 }}>Status</Text>
            <Text as="p" size="lg" className="stream-stat-value">{stream.is_active ? 'Active' : 'Inactive'}</Text>
          </div>
          <div className="preview-card">
            <Text as="p" size="sm" style={{ opacity: 0.8 }}>Total Streamed</Text>
            <Text as="p" size="lg" className="stream-stat-value">{fmt(totalStreamedDisplay)} {tokenSymbol}</Text>
          </div>
          <div className="preview-card">
            <Text as="p" size="sm" style={{ opacity: 0.8 }}>Remaining</Text>
            <Text as="p" size="lg" className="stream-stat-value">{fmt(remainingDepositDisplay)} {tokenSymbol}</Text>
          </div>
          <div className="preview-card">
            <Text as="p" size="sm" style={{ opacity: 0.8 }}>Progress</Text>
            <Text as="p" size="lg" className="stream-stat-value">{progressDisplay.toFixed(1)}%</Text>
          </div>
          <div className="preview-card">
            <Text as="p" size="sm" style={{ opacity: 0.8 }}>Sender</Text>
            <Text as="p" size="sm" className="stream-stat-value" style={{ wordBreak: "break-all" }}>{formatAddress(stream.sender)}</Text>
          </div>
        </div>

        {/* Recipients Section */}
        <div className="stream-details-section glass-form-card">
          <Box gap="md" direction="column">
            <Text as="h3" size="lg" className="stream-card-title">Recipients</Text>
            {loading ? (
              <Box gap="sm" direction="row" align="center">
                <Icon.Loading01 size="sm" />
                <Text as="p" size="sm">Loading recipient details...</Text>
              </Box>
            ) : error ? (
              <Box gap="sm" direction="row" align="center">
                <Icon.AlertCircle size="sm" />
                <Text as="p" size="sm" color="error">{error}</Text>
              </Box>
            ) : recipients.length === 0 ? (
              <Text as="p" size="sm" color="secondary">No recipient data available.</Text>
            ) : (
              <div className="preview-table">
                <div className="preview-table-header">
                  <span>Recipient Address</span>
                  <span>Accrued</span>
                  <span>Total Withdrawn</span>
                  <span>Last Withdraw</span>
                </div>
                {recipients.map((r) => (
                  <div key={r.address} className="preview-table-row">
                    <code className="addr" style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}>{r.address}</code>
                    <span>{fmt(r.accrued)} {tokenSymbol}</span>
                    <span>{fmt(r.totalWithdrawn)} {tokenSymbol}</span>
                    <span>{formatTimestamp(r.lastWithdrawTime)}</span>
                  </div>
                ))}
              </div>
            )}
          </Box>
        </div>
      </Box>
    </div>
  );
};

