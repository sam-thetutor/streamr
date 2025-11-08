import React, { useEffect, useState } from "react";
import { Text, Button, Icon, Modal } from "@stellar/design-system";
import { Box } from "../layout/Box";
import { FormattedStream } from "../../hooks/useStreams";
import { useStreamerContract } from "../../hooks/useStreamerContract";
import { getTokenSymbol } from "../../contracts/tokens";
import { stellarNetwork } from "../../contracts/util";

interface StreamDetailsModalProps {
  open: boolean;
  onClose: () => void;
  stream: FormattedStream | null;
}

type RecipientInfo = {
  address: string;
  totalWithdrawn: bigint;
  accrued: bigint;
  lastWithdrawTime: bigint;
};

export const StreamDetailsModal: React.FC<StreamDetailsModalProps> = ({ open, onClose, stream }) => {
  const { getContractClient } = useStreamerContract();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<RecipientInfo[]>([]);

  const tokenSymbol = stream ? getTokenSymbol(stream.token_contract, stellarNetwork) : "";

  const TOKEN_SCALE = 10_000_000;

  const fmt = (value: string | number | bigint) => {
    const n = typeof value === "bigint" ? Number(value) : typeof value === "string" ? parseFloat(value) : value;
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
    if (!value || value <= 0n) return "Never";
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

  useEffect(() => {
    const fetchDetails = async () => {
      if (!open || !stream) return;
      try {
        setLoading(true);
        setError(null);
        const client = getContractClient();
        if (!client) return;
        // Use optional method if available
        if (typeof (client as any).get_all_recipients_info === "function") {
          const res = await (client as any).get_all_recipients_info({ stream_id: Number(stream.id) }, { simulate: true });
          // res is Vec<(Address, i128, i128, u64)>
          const resultData = (res as any)?.result ?? res;
          const mapped: RecipientInfo[] = (Array.isArray(resultData) ? resultData : []).map((tuple: any) => ({
            address: String(tuple?.[0] ?? tuple?.address ?? ""),
            totalWithdrawn: toBigInt(tuple?.[1] ?? tuple?.total_withdrawn ?? 0),
            accrued: toBigInt(tuple?.[2] ?? tuple?.accrued ?? 0),
            lastWithdrawTime: toTimestamp(tuple?.[3] ?? tuple?.last_withdraw_time ?? 0),
          }));
          setRecipients(mapped);
        } else {
          setRecipients([]);
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load details");
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stream?.id]);

  if (!open || !stream) return null;

  const formatAmount = (value: string | number | bigint) => fmt(value);

  return (
    <Modal visible={open} onClose={onClose}>
      <Modal.Heading>Stream #{stream.id} Details</Modal.Heading>
      <Modal.Body>
        <Box gap="md" direction="column">
          <Box gap="xs" direction="row" justify="space-between" align="center">
            <Text as="p" size="sm">Token</Text>
            <Text as="p" size="sm">{tokenSymbol}</Text>
          </Box>
          <Box gap="xs" direction="row" justify="space-between" align="center">
            <Text as="p" size="sm">Status</Text>
            <Text as="p" size="sm">{stream.is_active ? "Active" : "Inactive"}</Text>
          </Box>

          <Text as="h4" size="md">Recipients</Text>
          {loading ? (
            <Box gap="sm" direction="row" align="center"><Icon.Loading01 size="sm" /><Text as="p" size="sm">Loading...</Text></Box>
          ) : error ? (
            <Box gap="sm" direction="row" align="center"><Icon.AlertCircle size="sm" /><Text as="p" size="sm" color="error">{error}</Text></Box>
          ) : recipients.length === 0 ? (
            <Text as="p" size="sm" color="secondary">No recipient data available.</Text>
          ) : (
            <div>
              {recipients.map((r) => (
                <Box
                  key={r.address}
                  gap="xs"
                  direction="column"
                  style={{ padding: "0.75rem 0", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <code style={{ wordBreak: "break-all", fontSize: "0.75rem" }}>{r.address}</code>
                  <Text as="p" size="xs">Accrued: {formatAmount(r.accrued)} {tokenSymbol}</Text>
                  <Text as="p" size="xs">Total withdrawn: {formatAmount(r.totalWithdrawn)} {tokenSymbol}</Text>
                  <Text as="p" size="xs">Last withdraw: {formatTimestamp(r.lastWithdrawTime)}</Text>
                </Box>
              ))}
            </div>
          )}
        </Box>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" size="md" onClick={onClose}>Close</Button>
      </Modal.Footer>
    </Modal>
  );
};


