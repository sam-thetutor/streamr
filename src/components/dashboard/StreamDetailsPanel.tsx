import React, { useEffect, useMemo, useState } from "react";
import { Text, Button, Icon } from "@stellar/design-system";
import { Box } from "../layout/Box";
import { FormattedStream } from "../../hooks/useStreams";
import { useStreamerContract } from "../../hooks/useStreamerContract";
import { getTokenSymbol } from "../../contracts/tokens";
import { stellarNetwork } from "../../contracts/util";

interface StreamDetailsPanelProps {
  stream: FormattedStream;
  onClose: () => void;
}

type RecipientInfo = {
  address: string;
  totalWithdrawn: bigint;
  accrued: bigint;
  lastWithdrawTime: bigint;
};

export const StreamDetailsPanel: React.FC<StreamDetailsPanelProps> = ({ stream, onClose }) => {
  const { getContractClient } = useStreamerContract();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<RecipientInfo[]>([]);

  const tokenSymbol = getTokenSymbol(stream.token_contract, stellarNetwork);

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
    } catch (error) {
      console.warn("Unable to parse value to BigInt:", value, error);
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
    const asNumber = Number(value);
    if (Number.isNaN(asNumber) || !Number.isFinite(asNumber)) {
      return `${value.toString()}s`;
    }
    const date = new Date(asNumber * 1000);
    if (Number.isNaN(date.getTime())) {
      return `${value.toString()}s`;
    }
    return date.toLocaleString();
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const client = getContractClient();
        if (!client) return;
        if (typeof (client as any).get_all_recipients_info === "function") {
          // stream_id should be u32 (number), not BigInt
          const res = await (client as any).get_all_recipients_info({ stream_id: stream.id }, { simulate: true });
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
  }, [stream.id]);

  const { streamedAmount, remainingAmount, progressPercent } = useMemo(() => {
    const withdrawnSum = recipients.reduce((sum, recipient) => {
      return sum + recipient.totalWithdrawn;
    }, 0n);

    const accruedSum = recipients.reduce((sum, recipient) => {
      return sum + recipient.accrued;
    }, 0n);

    const streamed = withdrawnSum + accruedSum;
    const rawDeposit = toBigInt(stream.deposit);
    const remaining = rawDeposit > streamed ? rawDeposit - streamed : 0n;
    let progressValue = stream.progress ?? 0;
    if (rawDeposit > 0n) {
      const scaled = (streamed * 10000n) / rawDeposit;
      progressValue = Number(scaled) / 100;
      if (progressValue > 100) {
        progressValue = 100;
      }
    }

    return {
      streamedAmount: streamed,
      remainingAmount: remaining,
      progressPercent: progressValue,
    };
  }, [recipients, stream.deposit, stream.progress]);

  const totalStreamedDisplay = recipients.length ? streamedAmount : toBigInt(stream.totalStreamed);
  const remainingDepositDisplay = recipients.length
    ? remainingAmount
    : toBigInt(stream.remainingDeposit);
  const progressDisplay = recipients.length ? progressPercent : stream.progress ?? 0;

  return (
    <div className="stream-details-panel glass-form-card" style={{ marginTop: '1rem' }}>
      <Box gap="md" direction="column">
        <Box gap="sm" direction="row" justify="space-between" align="center">
          <Box gap="xs" direction="column">
            <Text as="h3" size="lg" className="stream-card-title">
              {stream.title && stream.title.trim().length ? stream.title : `Stream #${stream.id}`}
            </Text>
            <Text as="p" size="sm" style={{ opacity: 0.7 }}>
              Stream #{stream.id}
            </Text>
            {stream.description && stream.description.trim().length > 0 && (
              <Text as="p" size="sm" style={{ opacity: 0.8 }}>
                {stream.description}
              </Text>
            )}
          </Box>
          <Button variant="secondary" size="sm" onClick={onClose}><Icon.X size="sm" /> Close</Button>
        </Box>

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
        </div>

        <Text as="h4" size="md">Recipients</Text>
        {loading ? (
          <Box gap="sm" direction="row" align="center"><Icon.Loading01 size="sm" /><Text as="p" size="sm">Loading...</Text></Box>
        ) : error ? (
          <Box gap="sm" direction="row" align="center"><Icon.AlertCircle size="sm" /><Text as="p" size="sm" color="error">{error}</Text></Box>
        ) : recipients.length === 0 ? (
          <Text as="p" size="sm" color="secondary">No recipient data available.</Text>
        ) : (
          <div className="preview-table">
            <div className="preview-table-header">
              <span>Recipient</span>
              <span>Accrued</span>
              <span>Last withdraw</span>
            </div>
            {recipients.map((r) => (
              <div key={r.address} className="preview-table-row">
                <code className="addr">{r.address}</code>
                <span>{fmt(r.accrued)} {tokenSymbol}</span>
                <span>{formatTimestamp(r.lastWithdrawTime)}</span>
              </div>
            ))}
          </div>
        )}
      </Box>
    </div>
  );
};


