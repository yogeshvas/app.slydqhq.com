import { apiClient } from "@/lib/api-client";
import type { ApiSuccess } from "@/types/api";

export type Currency = "INR" | "USD";

export interface RechargePack {
  id: string;
  credits: number;
  price: number;
  bonusPct: number;
}
export interface PlanDef {
  tier: "free" | "pro";
  name: string;
  price: number;
  monthlyCredits: number;
  cardsPerPrompt: number;
  features: {
    members: boolean;
    api: boolean;
    emailGeneration: boolean;
    removeWatermark: boolean;
  };
}
export interface Catalog {
  currency: Currency;
  creditUnitPrice: number;
  packs: RechargePack[];
  plans: PlanDef[];
}
export interface Wallet {
  balance: number;
  plan: "free" | "pro";
  currency: Currency;
  billingEnabled: boolean;
  renewsAt: string | null;
  cancelAtPeriodEnd: boolean;
}
export interface LedgerEntry {
  _id: string;
  delta: number;
  reason: string;
  balanceAfter: number;
  kind: "expiring" | "permanent";
  createdAt: string;
}
export interface LedgerPage {
  items: LedgerEntry[];
  total: number;
  page: number;
  hasMore: boolean;
}
export interface Invoice {
  _id: string;
  invoiceNo: string;
  amount: number;
  currency: Currency;
  credits: number;
  kind: string;
  gatewayPaymentId: string;
  createdAt: string;
}
export interface RechargeOrder {
  orderId: string;
  amount: number; // minor units (paise/cents)
  currency: Currency;
  keyId?: string;
  credits: number;
}
export interface SubscribeResult {
  subscriptionId: string;
  keyId?: string;
  shortUrl?: string;
}

export const billingApi = {
  plans: () =>
    apiClient
      .get<ApiSuccess<Catalog>>("/billing/plans")
      .then((r) => r.data.data),
  wallet: () =>
    apiClient.get<ApiSuccess<Wallet>>("/billing/wallet").then((r) => r.data.data),
  ledger: (page = 1) =>
    apiClient
      .get<ApiSuccess<LedgerPage>>("/billing/ledger", { params: { page } })
      .then((r) => r.data.data),
  invoices: () =>
    apiClient
      .get<ApiSuccess<{ invoices: Invoice[] }>>("/billing/invoices")
      .then((r) => r.data.data.invoices),
  recharge: (packId: string) =>
    apiClient
      .post<ApiSuccess<RechargeOrder>>("/billing/recharge", { packId })
      .then((r) => r.data.data),
  subscribe: () =>
    apiClient
      .post<ApiSuccess<SubscribeResult>>("/billing/subscribe")
      .then((r) => r.data.data),
  cancel: () =>
    apiClient
      .post<ApiSuccess<{ ok: boolean }>>("/billing/cancel")
      .then((r) => r.data.data),
};
