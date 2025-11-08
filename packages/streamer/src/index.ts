import { Buffer } from "buffer";
import { Address } from '@stellar/stellar-sdk';
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from '@stellar/stellar-sdk/contract';
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Typepoint,
  Duration,
} from '@stellar/stellar-sdk/contract';
export * from '@stellar/stellar-sdk'
export * as contract from '@stellar/stellar-sdk/contract'
export * as rpc from '@stellar/stellar-sdk/rpc'

if (typeof window !== 'undefined') {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CDGAKUYVMN3G4R5YQ2QEUPXVODZYQHYBSD4X6VQB2OEL7LG2DFZ2PYML",
  }
} as const

/**
 * Error codes
 */
export enum Errors {
  AlreadyInitialized = 1,
  InvalidParameters = 2,
  ContractInsufficientBalance = 3,
  StreamNotFound = 4,
  StreamInactive = 5,
  NothingToWithdraw = 6,
  SubscriptionNotFound = 7,
  SubscriptionInactive = 8,
  NotDueYet = 9,
  InsufficientContractBalance = 10,
  NotInitialized = 11,
}

/**
 * Data keys in storage
 */
export type DataKey = {tag: "PlatformAdmin", values: void} | {tag: "NextStreamId", values: void} | {tag: "StreamKey", values: readonly [u32]} | {tag: "NextSubscriptionId", values: void} | {tag: "SubscriptionKey", values: readonly [u32]} | {tag: "TokenContract", values: void} | {tag: "UserSentStreams", values: readonly [string]} | {tag: "UserReceivedStreams", values: readonly [string]} | {tag: "UserSubscriptions", values: readonly [string]} | {tag: "UserReceivedSubscriptions", values: readonly [string]};


/**
 * A streaming payment: continuous rate-based escrow
 */
export interface Stream {
  deposit: i128;
  description: Option<string>;
  id: u32;
  is_active: boolean;
  recipient_last_withdraw: Map<string, u64>;
  recipient_rate_per_second: Map<string, i128>;
  recipient_total_withdrawn: Map<string, i128>;
  recipients: Array<string>;
  sender: string;
  start_time: u64;
  title: Option<string>;
  token_contract: string;
}


/**
 * A recurring subscription (pull/payments at intervals)
 */
export interface Subscription {
  active: boolean;
  amount_per_interval: i128;
  balance: i128;
  description: Option<string>;
  id: u32;
  interval_seconds: u64;
  next_payment_time: u64;
  receiver: string;
  subscriber: string;
  title: Option<string>;
  token_contract: string;
}

export interface Client {
  /**
   * Construct and simulate a init transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initialize platform admin and optional default token contract.
   * Call once.
   */
  init: ({platform_admin, default_token}: {platform_admin: string, default_token: Option<string>}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a create_stream transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Create a stream. Transfers `deposit` tokens from the sender to this contract
   * and registers a new payment stream with multiple recipients.
   * Each recipient receives the full `rate_per_second` (multiplicative model).
   * 
   * Returns the stream id.
   */
  create_stream: ({sender, recipients, token_contract, amounts_per_period, period_seconds, deposit, title, description}: {sender: string, recipients: Array<string>, token_contract: string, amounts_per_period: Array<i128>, period_seconds: u64, deposit: i128, title: Option<string>, description: Option<string>}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a withdraw_stream transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Withdraw accrued funds for a stream.
   * The recipient parameter specifies which recipient is withdrawing.
   * Each recipient can withdraw independently based on their own rate (full rate_per_second).
   */
  withdraw_stream: ({stream_id, recipient}: {stream_id: u32, recipient: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a cancel_stream transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Cancel a stream. Caller must be the sender.
   * Calculates remaining deposit after all recipients' withdrawals and refunds to sender.
   */
  cancel_stream: ({stream_id}: {stream_id: u32}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a deposit_to_subscription transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Deposit funds to a subscription (isolated escrow per subscription)
   * Subscriber must authorize (require_auth). Funds are isolated to this specific subscription.
   */
  deposit_to_subscription: ({subscription_id, amount}: {subscription_id: u32, amount: i128}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a create_subscription transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Create a subscription. Subscriber must authorize (require_auth).
   * This model expects the subscriber to periodically ensure the contract has funds to perform the pull,
   * or to have previously transferred allowance/escrow. The sponsor of payments (service owner) receives fixed amounts per interval.
   * 
   * next_payment_time should typically be `now + interval_seconds` or now depending on desired behavior.
   */
  create_subscription: ({subscriber, receiver, token_contract, amount_per_interval, interval_seconds, first_payment_time, title, description}: {subscriber: string, receiver: string, token_contract: string, amount_per_interval: i128, interval_seconds: u64, first_payment_time: u64, title: Option<string>, description: Option<string>}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a charge_subscription transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Charge (execute) a due subscription. Can be called by anyone (keep it open), but it will transfer
   * tokens from contract -> receiver. This assumes the contract already holds the subscriber funds,
   * or you have some pull authorization pattern (not implemented here).
   * 
   * The typical pattern: a keeper checks subscriptions whose next_payment_time <= now and triggers this call.
   */
  charge_subscription: ({subscription_id}: {subscription_id: u32}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a cancel_subscription transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Cancel a subscription (subscriber must auth)
   * Refunds any remaining balance to the subscriber
   */
  cancel_subscription: ({subscription_id}: {subscription_id: u32}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_recipient_info transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get detailed information about a specific recipient in a stream.
   * Returns: (total_withdrawn, current_accrued, last_withdraw_time)
   */
  get_recipient_info: ({stream_id, recipient}: {stream_id: u32, recipient: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<readonly [i128, i128, u64]>>

  /**
   * Construct and simulate a get_all_recipients_info transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get information about all recipients in a stream.
   * Returns a Vec of (Address, total_withdrawn, current_accrued, last_withdraw_time)
   */
  get_all_recipients_info: ({stream_id}: {stream_id: u32}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Array<readonly [string, i128, i128, u64]>>>

  /**
   * Construct and simulate a get_stream transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_stream: ({stream_id}: {stream_id: u32}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Stream>>

  /**
   * Construct and simulate a get_subscription transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_subscription: ({subscription_id}: {subscription_id: u32}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Subscription>>

  /**
   * Construct and simulate a get_user_sent_stream_ids transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get all stream IDs where the user is the sender
   */
  get_user_sent_stream_ids: ({user}: {user: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Array<u32>>>

  /**
   * Construct and simulate a get_user_received_stream_ids transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get all stream IDs where the user is the recipient
   */
  get_user_received_stream_ids: ({user}: {user: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Array<u32>>>

  /**
   * Construct and simulate a get_user_sent_streams transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get all streams where the user is the sender
   */
  get_user_sent_streams: ({user}: {user: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Array<Stream>>>

  /**
   * Construct and simulate a get_user_received_streams transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get all streams where the user is the recipient
   */
  get_user_received_streams: ({user}: {user: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Array<Stream>>>

  /**
   * Construct and simulate a get_user_streams transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get all streams where the user is either sender or recipient
   * Note: This may include duplicates if a stream has the same user as both sender and recipient
   */
  get_user_streams: ({user}: {user: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Array<Stream>>>

  /**
   * Construct and simulate a get_user_subs_ids transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get all subscription IDs where the user is the subscriber
   */
  get_user_subs_ids: ({user}: {user: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Array<u32>>>

  /**
   * Construct and simulate a get_user_rcvd_subs_ids transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get all subscription IDs where the user is the receiver
   */
  get_user_rcvd_subs_ids: ({user}: {user: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Array<u32>>>

  /**
   * Construct and simulate a get_user_subscriptions transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get all subscriptions where the user is the subscriber
   */
  get_user_subscriptions: ({user}: {user: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Array<Subscription>>>

  /**
   * Construct and simulate a get_user_received_subscriptions transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get all subscriptions where the user is the receiver
   */
  get_user_received_subscriptions: ({user}: {user: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Array<Subscription>>>

  /**
   * Construct and simulate a get_user_subscriptions_all transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get all subscriptions where the user is either subscriber or receiver
   * Note: This may include duplicates if a subscription has the same user as both subscriber and receiver
   */
  get_user_subscriptions_all: ({user}: {user: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Array<Subscription>>>

  /**
   * Construct and simulate a set_token_contract transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_token_contract: ({token}: {token: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAwAAAAtFcnJvciBjb2RlcwAAAAAAAAAABUVycm9yAAAAAAAACwAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAAAAAABFJbnZhbGlkUGFyYW1ldGVycwAAAAAAAAIAAAAAAAAAG0NvbnRyYWN0SW5zdWZmaWNpZW50QmFsYW5jZQAAAAADAAAAAAAAAA5TdHJlYW1Ob3RGb3VuZAAAAAAABAAAAAAAAAAOU3RyZWFtSW5hY3RpdmUAAAAAAAUAAAAAAAAAEU5vdGhpbmdUb1dpdGhkcmF3AAAAAAAABgAAAAAAAAAUU3Vic2NyaXB0aW9uTm90Rm91bmQAAAAHAAAAAAAAABRTdWJzY3JpcHRpb25JbmFjdGl2ZQAAAAgAAAAAAAAACU5vdER1ZVlldAAAAAAAAAkAAAAAAAAAG0luc3VmZmljaWVudENvbnRyYWN0QmFsYW5jZQAAAAAKAAAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAACw==",
        "AAAAAgAAABREYXRhIGtleXMgaW4gc3RvcmFnZQAAAAAAAAAHRGF0YUtleQAAAAAKAAAAAAAAAAAAAAANUGxhdGZvcm1BZG1pbgAAAAAAAAAAAAAAAAAADE5leHRTdHJlYW1JZAAAAAEAAAAAAAAACVN0cmVhbUtleQAAAAAAAAEAAAAEAAAAAAAAAAAAAAASTmV4dFN1YnNjcmlwdGlvbklkAAAAAAABAAAAAAAAAA9TdWJzY3JpcHRpb25LZXkAAAAAAQAAAAQAAAAAAAAAAAAAAA1Ub2tlbkNvbnRyYWN0AAAAAAAAAQAAAAAAAAAPVXNlclNlbnRTdHJlYW1zAAAAAAEAAAATAAAAAQAAAAAAAAATVXNlclJlY2VpdmVkU3RyZWFtcwAAAAABAAAAEwAAAAEAAAAAAAAAEVVzZXJTdWJzY3JpcHRpb25zAAAAAAAAAQAAABMAAAABAAAAAAAAABlVc2VyUmVjZWl2ZWRTdWJzY3JpcHRpb25zAAAAAAAAAQAAABM=",
        "AAAAAQAAADFBIHN0cmVhbWluZyBwYXltZW50OiBjb250aW51b3VzIHJhdGUtYmFzZWQgZXNjcm93AAAAAAAAAAAAAAZTdHJlYW0AAAAAAAwAAAAAAAAAB2RlcG9zaXQAAAAACwAAAAAAAAALZGVzY3JpcHRpb24AAAAD6AAAABAAAAAAAAAAAmlkAAAAAAAEAAAAAAAAAAlpc19hY3RpdmUAAAAAAAABAAAAAAAAABdyZWNpcGllbnRfbGFzdF93aXRoZHJhdwAAAAPsAAAAEwAAAAYAAAAAAAAAGXJlY2lwaWVudF9yYXRlX3Blcl9zZWNvbmQAAAAAAAPsAAAAEwAAAAsAAAAAAAAAGXJlY2lwaWVudF90b3RhbF93aXRoZHJhd24AAAAAAAPsAAAAEwAAAAsAAAAAAAAACnJlY2lwaWVudHMAAAAAA+oAAAATAAAAAAAAAAZzZW5kZXIAAAAAABMAAAAAAAAACnN0YXJ0X3RpbWUAAAAAAAYAAAAAAAAABXRpdGxlAAAAAAAD6AAAABAAAAAAAAAADnRva2VuX2NvbnRyYWN0AAAAAAAT",
        "AAAAAQAAADVBIHJlY3VycmluZyBzdWJzY3JpcHRpb24gKHB1bGwvcGF5bWVudHMgYXQgaW50ZXJ2YWxzKQAAAAAAAAAAAAAMU3Vic2NyaXB0aW9uAAAACwAAAAAAAAAGYWN0aXZlAAAAAAABAAAAAAAAABNhbW91bnRfcGVyX2ludGVydmFsAAAAAAsAAAAAAAAAB2JhbGFuY2UAAAAACwAAAAAAAAALZGVzY3JpcHRpb24AAAAD6AAAABAAAAAAAAAAAmlkAAAAAAAEAAAAAAAAABBpbnRlcnZhbF9zZWNvbmRzAAAABgAAAAAAAAARbmV4dF9wYXltZW50X3RpbWUAAAAAAAAGAAAAAAAAAAhyZWNlaXZlcgAAABMAAAAAAAAACnN1YnNjcmliZXIAAAAAABMAAAAAAAAABXRpdGxlAAAAAAAD6AAAABAAAAAAAAAADnRva2VuX2NvbnRyYWN0AAAAAAAT",
        "AAAAAAAAAElJbml0aWFsaXplIHBsYXRmb3JtIGFkbWluIGFuZCBvcHRpb25hbCBkZWZhdWx0IHRva2VuIGNvbnRyYWN0LgpDYWxsIG9uY2UuAAAAAAAABGluaXQAAAACAAAAAAAAAA5wbGF0Zm9ybV9hZG1pbgAAAAAAEwAAAAAAAAANZGVmYXVsdF90b2tlbgAAAAAAA+gAAAATAAAAAA==",
        "AAAAAAAAAOxDcmVhdGUgYSBzdHJlYW0uIFRyYW5zZmVycyBgZGVwb3NpdGAgdG9rZW5zIGZyb20gdGhlIHNlbmRlciB0byB0aGlzIGNvbnRyYWN0CmFuZCByZWdpc3RlcnMgYSBuZXcgcGF5bWVudCBzdHJlYW0gd2l0aCBtdWx0aXBsZSByZWNpcGllbnRzLgpFYWNoIHJlY2lwaWVudCByZWNlaXZlcyB0aGUgZnVsbCBgcmF0ZV9wZXJfc2Vjb25kYCAobXVsdGlwbGljYXRpdmUgbW9kZWwpLgoKUmV0dXJucyB0aGUgc3RyZWFtIGlkLgAAAA1jcmVhdGVfc3RyZWFtAAAAAAAACAAAAAAAAAAGc2VuZGVyAAAAAAATAAAAAAAAAApyZWNpcGllbnRzAAAAAAPqAAAAEwAAAAAAAAAOdG9rZW5fY29udHJhY3QAAAAAABMAAAAAAAAAEmFtb3VudHNfcGVyX3BlcmlvZAAAAAAD6gAAAAsAAAAAAAAADnBlcmlvZF9zZWNvbmRzAAAAAAAGAAAAAAAAAAdkZXBvc2l0AAAAAAsAAAAAAAAABXRpdGxlAAAAAAAD6AAAABAAAAAAAAAAC2Rlc2NyaXB0aW9uAAAAA+gAAAAQAAAAAQAAAAQ=",
        "AAAAAAAAAMBXaXRoZHJhdyBhY2NydWVkIGZ1bmRzIGZvciBhIHN0cmVhbS4KVGhlIHJlY2lwaWVudCBwYXJhbWV0ZXIgc3BlY2lmaWVzIHdoaWNoIHJlY2lwaWVudCBpcyB3aXRoZHJhd2luZy4KRWFjaCByZWNpcGllbnQgY2FuIHdpdGhkcmF3IGluZGVwZW5kZW50bHkgYmFzZWQgb24gdGhlaXIgb3duIHJhdGUgKGZ1bGwgcmF0ZV9wZXJfc2Vjb25kKS4AAAAPd2l0aGRyYXdfc3RyZWFtAAAAAAIAAAAAAAAACXN0cmVhbV9pZAAAAAAAAAQAAAAAAAAACXJlY2lwaWVudAAAAAAAABMAAAABAAAACw==",
        "AAAAAAAAAIFDYW5jZWwgYSBzdHJlYW0uIENhbGxlciBtdXN0IGJlIHRoZSBzZW5kZXIuCkNhbGN1bGF0ZXMgcmVtYWluaW5nIGRlcG9zaXQgYWZ0ZXIgYWxsIHJlY2lwaWVudHMnIHdpdGhkcmF3YWxzIGFuZCByZWZ1bmRzIHRvIHNlbmRlci4AAAAAAAANY2FuY2VsX3N0cmVhbQAAAAAAAAEAAAAAAAAACXN0cmVhbV9pZAAAAAAAAAQAAAAA",
        "AAAAAAAAAJ5EZXBvc2l0IGZ1bmRzIHRvIGEgc3Vic2NyaXB0aW9uIChpc29sYXRlZCBlc2Nyb3cgcGVyIHN1YnNjcmlwdGlvbikKU3Vic2NyaWJlciBtdXN0IGF1dGhvcml6ZSAocmVxdWlyZV9hdXRoKS4gRnVuZHMgYXJlIGlzb2xhdGVkIHRvIHRoaXMgc3BlY2lmaWMgc3Vic2NyaXB0aW9uLgAAAAAAF2RlcG9zaXRfdG9fc3Vic2NyaXB0aW9uAAAAAAIAAAAAAAAAD3N1YnNjcmlwdGlvbl9pZAAAAAAEAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAA",
        "AAAAAAAAAYxDcmVhdGUgYSBzdWJzY3JpcHRpb24uIFN1YnNjcmliZXIgbXVzdCBhdXRob3JpemUgKHJlcXVpcmVfYXV0aCkuClRoaXMgbW9kZWwgZXhwZWN0cyB0aGUgc3Vic2NyaWJlciB0byBwZXJpb2RpY2FsbHkgZW5zdXJlIHRoZSBjb250cmFjdCBoYXMgZnVuZHMgdG8gcGVyZm9ybSB0aGUgcHVsbCwKb3IgdG8gaGF2ZSBwcmV2aW91c2x5IHRyYW5zZmVycmVkIGFsbG93YW5jZS9lc2Nyb3cuIFRoZSBzcG9uc29yIG9mIHBheW1lbnRzIChzZXJ2aWNlIG93bmVyKSByZWNlaXZlcyBmaXhlZCBhbW91bnRzIHBlciBpbnRlcnZhbC4KCm5leHRfcGF5bWVudF90aW1lIHNob3VsZCB0eXBpY2FsbHkgYmUgYG5vdyArIGludGVydmFsX3NlY29uZHNgIG9yIG5vdyBkZXBlbmRpbmcgb24gZGVzaXJlZCBiZWhhdmlvci4AAAATY3JlYXRlX3N1YnNjcmlwdGlvbgAAAAAIAAAAAAAAAApzdWJzY3JpYmVyAAAAAAATAAAAAAAAAAhyZWNlaXZlcgAAABMAAAAAAAAADnRva2VuX2NvbnRyYWN0AAAAAAATAAAAAAAAABNhbW91bnRfcGVyX2ludGVydmFsAAAAAAsAAAAAAAAAEGludGVydmFsX3NlY29uZHMAAAAGAAAAAAAAABJmaXJzdF9wYXltZW50X3RpbWUAAAAAAAYAAAAAAAAABXRpdGxlAAAAAAAD6AAAABAAAAAAAAAAC2Rlc2NyaXB0aW9uAAAAA+gAAAAQAAAAAQAAAAQ=",
        "AAAAAAAAAXBDaGFyZ2UgKGV4ZWN1dGUpIGEgZHVlIHN1YnNjcmlwdGlvbi4gQ2FuIGJlIGNhbGxlZCBieSBhbnlvbmUgKGtlZXAgaXQgb3BlbiksIGJ1dCBpdCB3aWxsIHRyYW5zZmVyCnRva2VucyBmcm9tIGNvbnRyYWN0IC0+IHJlY2VpdmVyLiBUaGlzIGFzc3VtZXMgdGhlIGNvbnRyYWN0IGFscmVhZHkgaG9sZHMgdGhlIHN1YnNjcmliZXIgZnVuZHMsCm9yIHlvdSBoYXZlIHNvbWUgcHVsbCBhdXRob3JpemF0aW9uIHBhdHRlcm4gKG5vdCBpbXBsZW1lbnRlZCBoZXJlKS4KClRoZSB0eXBpY2FsIHBhdHRlcm46IGEga2VlcGVyIGNoZWNrcyBzdWJzY3JpcHRpb25zIHdob3NlIG5leHRfcGF5bWVudF90aW1lIDw9IG5vdyBhbmQgdHJpZ2dlcnMgdGhpcyBjYWxsLgAAABNjaGFyZ2Vfc3Vic2NyaXB0aW9uAAAAAAEAAAAAAAAAD3N1YnNjcmlwdGlvbl9pZAAAAAAEAAAAAA==",
        "AAAAAAAAAFxDYW5jZWwgYSBzdWJzY3JpcHRpb24gKHN1YnNjcmliZXIgbXVzdCBhdXRoKQpSZWZ1bmRzIGFueSByZW1haW5pbmcgYmFsYW5jZSB0byB0aGUgc3Vic2NyaWJlcgAAABNjYW5jZWxfc3Vic2NyaXB0aW9uAAAAAAEAAAAAAAAAD3N1YnNjcmlwdGlvbl9pZAAAAAAEAAAAAA==",
        "AAAAAAAAAIBHZXQgZGV0YWlsZWQgaW5mb3JtYXRpb24gYWJvdXQgYSBzcGVjaWZpYyByZWNpcGllbnQgaW4gYSBzdHJlYW0uClJldHVybnM6ICh0b3RhbF93aXRoZHJhd24sIGN1cnJlbnRfYWNjcnVlZCwgbGFzdF93aXRoZHJhd190aW1lKQAAABJnZXRfcmVjaXBpZW50X2luZm8AAAAAAAIAAAAAAAAACXN0cmVhbV9pZAAAAAAAAAQAAAAAAAAACXJlY2lwaWVudAAAAAAAABMAAAABAAAD7QAAAAMAAAALAAAACwAAAAY=",
        "AAAAAAAAAIJHZXQgaW5mb3JtYXRpb24gYWJvdXQgYWxsIHJlY2lwaWVudHMgaW4gYSBzdHJlYW0uClJldHVybnMgYSBWZWMgb2YgKEFkZHJlc3MsIHRvdGFsX3dpdGhkcmF3biwgY3VycmVudF9hY2NydWVkLCBsYXN0X3dpdGhkcmF3X3RpbWUpAAAAAAAXZ2V0X2FsbF9yZWNpcGllbnRzX2luZm8AAAAAAQAAAAAAAAAJc3RyZWFtX2lkAAAAAAAABAAAAAEAAAPqAAAD7QAAAAQAAAATAAAACwAAAAsAAAAG",
        "AAAAAAAAAAAAAAAKZ2V0X3N0cmVhbQAAAAAAAQAAAAAAAAAJc3RyZWFtX2lkAAAAAAAABAAAAAEAAAfQAAAABlN0cmVhbQAA",
        "AAAAAAAAAAAAAAAQZ2V0X3N1YnNjcmlwdGlvbgAAAAEAAAAAAAAAD3N1YnNjcmlwdGlvbl9pZAAAAAAEAAAAAQAAB9AAAAAMU3Vic2NyaXB0aW9u",
        "AAAAAAAAAC9HZXQgYWxsIHN0cmVhbSBJRHMgd2hlcmUgdGhlIHVzZXIgaXMgdGhlIHNlbmRlcgAAAAAYZ2V0X3VzZXJfc2VudF9zdHJlYW1faWRzAAAAAQAAAAAAAAAEdXNlcgAAABMAAAABAAAD6gAAAAQ=",
        "AAAAAAAAADJHZXQgYWxsIHN0cmVhbSBJRHMgd2hlcmUgdGhlIHVzZXIgaXMgdGhlIHJlY2lwaWVudAAAAAAAHGdldF91c2VyX3JlY2VpdmVkX3N0cmVhbV9pZHMAAAABAAAAAAAAAAR1c2VyAAAAEwAAAAEAAAPqAAAABA==",
        "AAAAAAAAACxHZXQgYWxsIHN0cmVhbXMgd2hlcmUgdGhlIHVzZXIgaXMgdGhlIHNlbmRlcgAAABVnZXRfdXNlcl9zZW50X3N0cmVhbXMAAAAAAAABAAAAAAAAAAR1c2VyAAAAEwAAAAEAAAPqAAAH0AAAAAZTdHJlYW0AAA==",
        "AAAAAAAAAC9HZXQgYWxsIHN0cmVhbXMgd2hlcmUgdGhlIHVzZXIgaXMgdGhlIHJlY2lwaWVudAAAAAAZZ2V0X3VzZXJfcmVjZWl2ZWRfc3RyZWFtcwAAAAAAAAEAAAAAAAAABHVzZXIAAAATAAAAAQAAA+oAAAfQAAAABlN0cmVhbQAA",
        "AAAAAAAAAJlHZXQgYWxsIHN0cmVhbXMgd2hlcmUgdGhlIHVzZXIgaXMgZWl0aGVyIHNlbmRlciBvciByZWNpcGllbnQKTm90ZTogVGhpcyBtYXkgaW5jbHVkZSBkdXBsaWNhdGVzIGlmIGEgc3RyZWFtIGhhcyB0aGUgc2FtZSB1c2VyIGFzIGJvdGggc2VuZGVyIGFuZCByZWNpcGllbnQAAAAAAAAQZ2V0X3VzZXJfc3RyZWFtcwAAAAEAAAAAAAAABHVzZXIAAAATAAAAAQAAA+oAAAfQAAAABlN0cmVhbQAA",
        "AAAAAAAAADlHZXQgYWxsIHN1YnNjcmlwdGlvbiBJRHMgd2hlcmUgdGhlIHVzZXIgaXMgdGhlIHN1YnNjcmliZXIAAAAAAAARZ2V0X3VzZXJfc3Vic19pZHMAAAAAAAABAAAAAAAAAAR1c2VyAAAAEwAAAAEAAAPqAAAABA==",
        "AAAAAAAAADdHZXQgYWxsIHN1YnNjcmlwdGlvbiBJRHMgd2hlcmUgdGhlIHVzZXIgaXMgdGhlIHJlY2VpdmVyAAAAABZnZXRfdXNlcl9yY3ZkX3N1YnNfaWRzAAAAAAABAAAAAAAAAAR1c2VyAAAAEwAAAAEAAAPqAAAABA==",
        "AAAAAAAAADZHZXQgYWxsIHN1YnNjcmlwdGlvbnMgd2hlcmUgdGhlIHVzZXIgaXMgdGhlIHN1YnNjcmliZXIAAAAAABZnZXRfdXNlcl9zdWJzY3JpcHRpb25zAAAAAAABAAAAAAAAAAR1c2VyAAAAEwAAAAEAAAPqAAAH0AAAAAxTdWJzY3JpcHRpb24=",
        "AAAAAAAAADRHZXQgYWxsIHN1YnNjcmlwdGlvbnMgd2hlcmUgdGhlIHVzZXIgaXMgdGhlIHJlY2VpdmVyAAAAH2dldF91c2VyX3JlY2VpdmVkX3N1YnNjcmlwdGlvbnMAAAAAAQAAAAAAAAAEdXNlcgAAABMAAAABAAAD6gAAB9AAAAAMU3Vic2NyaXB0aW9u",
        "AAAAAAAAAKtHZXQgYWxsIHN1YnNjcmlwdGlvbnMgd2hlcmUgdGhlIHVzZXIgaXMgZWl0aGVyIHN1YnNjcmliZXIgb3IgcmVjZWl2ZXIKTm90ZTogVGhpcyBtYXkgaW5jbHVkZSBkdXBsaWNhdGVzIGlmIGEgc3Vic2NyaXB0aW9uIGhhcyB0aGUgc2FtZSB1c2VyIGFzIGJvdGggc3Vic2NyaWJlciBhbmQgcmVjZWl2ZXIAAAAAGmdldF91c2VyX3N1YnNjcmlwdGlvbnNfYWxsAAAAAAABAAAAAAAAAAR1c2VyAAAAEwAAAAEAAAPqAAAH0AAAAAxTdWJzY3JpcHRpb24=",
        "AAAAAAAAAAAAAAASc2V0X3Rva2VuX2NvbnRyYWN0AAAAAAABAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAA" ]),
      options
    )
  }
  public readonly fromJSON = {
    init: this.txFromJSON<null>,
        create_stream: this.txFromJSON<u32>,
        withdraw_stream: this.txFromJSON<i128>,
        cancel_stream: this.txFromJSON<null>,
        deposit_to_subscription: this.txFromJSON<null>,
        create_subscription: this.txFromJSON<u32>,
        charge_subscription: this.txFromJSON<null>,
        cancel_subscription: this.txFromJSON<null>,
        get_recipient_info: this.txFromJSON<readonly [i128, i128, u64]>,
        get_all_recipients_info: this.txFromJSON<Array<readonly [string, i128, i128, u64]>>,
        get_stream: this.txFromJSON<Stream>,
        get_subscription: this.txFromJSON<Subscription>,
        get_user_sent_stream_ids: this.txFromJSON<Array<u32>>,
        get_user_received_stream_ids: this.txFromJSON<Array<u32>>,
        get_user_sent_streams: this.txFromJSON<Array<Stream>>,
        get_user_received_streams: this.txFromJSON<Array<Stream>>,
        get_user_streams: this.txFromJSON<Array<Stream>>,
        get_user_subs_ids: this.txFromJSON<Array<u32>>,
        get_user_rcvd_subs_ids: this.txFromJSON<Array<u32>>,
        get_user_subscriptions: this.txFromJSON<Array<Subscription>>,
        get_user_received_subscriptions: this.txFromJSON<Array<Subscription>>,
        get_user_subscriptions_all: this.txFromJSON<Array<Subscription>>,
        set_token_contract: this.txFromJSON<null>
  }
}