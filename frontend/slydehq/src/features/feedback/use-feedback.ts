import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { ApiSuccess } from "@/types/api";

interface FeedbackPayload {
  message: string;
  category?: string;
}

/** Send an in-app feedback/support message to the team inbox. */
export function useSendFeedback() {
  return useMutation({
    mutationFn: (payload: FeedbackPayload) =>
      apiClient
        .post<ApiSuccess<{ sent: boolean }>>("/feedback", payload)
        .then((r) => r.data.data),
  });
}
