import { useQuery, useQueryClient } from "@tanstack/react-query";
import { billingApi } from "../api/billing.api";
import { workspaceKeys } from "@/features/workspace/hooks/use-workspace";

export const billingKeys = {
  all: ["billing"] as const,
  plans: () => [...billingKeys.all, "plans"] as const,
  wallet: () => [...billingKeys.all, "wallet"] as const,
  ledger: (page: number) => [...billingKeys.all, "ledger", page] as const,
  invoices: () => [...billingKeys.all, "invoices"] as const,
};

export function useCatalog() {
  return useQuery({ queryKey: billingKeys.plans(), queryFn: billingApi.plans });
}

export function useWallet() {
  return useQuery({ queryKey: billingKeys.wallet(), queryFn: billingApi.wallet });
}

export function useLedger(page = 1) {
  return useQuery({
    queryKey: billingKeys.ledger(page),
    queryFn: () => billingApi.ledger(page),
  });
}

export function useInvoices() {
  return useQuery({
    queryKey: billingKeys.invoices(),
    queryFn: billingApi.invoices,
  });
}

/** Refresh wallet + workspace credits + ledger after a payment completes. */
export function useRefreshBilling() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: billingKeys.all });
    qc.invalidateQueries({ queryKey: workspaceKeys.me });
  };
}
