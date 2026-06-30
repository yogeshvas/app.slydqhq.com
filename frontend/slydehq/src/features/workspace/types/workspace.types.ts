/** The signed-in user's current workspace (GET /workspaces/me). */
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: string;
  currency?: "INR" | "USD";
  role: string;
  credits: number;
}
