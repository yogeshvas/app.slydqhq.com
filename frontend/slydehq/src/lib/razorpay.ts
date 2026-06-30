/** Lazily load the Razorpay Checkout script (once). */
let loaded: Promise<boolean> | null = null;

export function loadRazorpay(): Promise<boolean> {
  if (loaded) return loaded;
  loaded = new Promise((resolve) => {
    if ((window as any).Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
  return loaded;
}

export interface CheckoutOptions {
  keyId: string;
  amount?: number; // minor units (orders)
  currency: string;
  orderId?: string; // one-time recharge
  subscriptionId?: string; // subscription
  name: string;
  description: string;
  prefill?: { email?: string; name?: string };
  onSuccess: () => void;
  onDismiss?: () => void;
  onFailure?: (reason?: string) => void;
}

/**
 * Open Razorpay Checkout for an order (recharge) or a subscription. Crediting
 * happens server-side via the webhook; `onSuccess` just refreshes the UI.
 */
export async function openCheckout(opts: CheckoutOptions): Promise<void> {
  const ok = await loadRazorpay();
  if (!ok) throw new Error("Couldn't load the payment gateway. Try again.");

  const rzp = new (window as any).Razorpay({
    key: opts.keyId,
    amount: opts.amount,
    currency: opts.currency,
    order_id: opts.orderId,
    subscription_id: opts.subscriptionId,
    name: opts.name,
    description: opts.description,
    prefill: opts.prefill,
    theme: { color: "#4F46E5" },
    handler: () => opts.onSuccess(),
    modal: { ondismiss: () => opts.onDismiss?.() },
  });
  rzp.on("payment.failed", (resp: any) =>
    opts.onFailure?.(resp?.error?.description),
  );
  rzp.open();
}
