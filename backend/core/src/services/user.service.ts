import { User } from "../models/identity/user.model";
import { provisionDefaultWorkspace } from "./workspace.service";

/** Find a free userName, appending a number on collisions (e.g. "jane", "jane1"). */
export async function generateUniqueUserName(base: string): Promise<string> {
  const root = base.trim() || "user";
  let candidate = root;
  let n = 0;
  while (await User.exists({ userName: candidate })) {
    n += 1;
    candidate = `${root}${n}`;
  }
  return candidate;
}

interface FindOrCreateParams {
  email: string;
  userName?: string;
  avatar?: string;
  provider?: string;
  providerId?: string;
}

/**
 * Look up a user by email, creating one if needed. Used by passwordless flows
 * (email OTP) where signing in and signing up are the same action.
 */
export async function findOrCreateUserByEmail(params: FindOrCreateParams) {
  const email = params.email.toLowerCase().trim();

  const existing = await User.findOne({ email });
  if (existing) return existing;

  const userName = await generateUniqueUserName(
    params.userName || email.split("@")[0] || "user",
  );

  const user = await User.create({
    email,
    userName,
    avatar: params.avatar ?? "",
    authProviders: params.provider
      ? [{ provider: params.provider, providerId: params.providerId ?? email }]
      : [],
  });

  // Every new user gets a default personal workspace + starter credits.
  await provisionDefaultWorkspace(user);

  return user;
}
