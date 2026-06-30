import { User } from "../models/identity/user.model";
import { provisionDefaultWorkspace } from "./workspace.service";
import ApiError from "../utils/appError";

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

/** Public profile shape for the signed-in user (GET/PATCH /me). */
function presentUser(u: any) {
  return {
    id: String(u._id),
    name: u.userName,
    email: u.email,
    avatar: u.avatar ?? "",
  };
}

/** The signed-in user's profile. */
export async function getMe(userId: string) {
  const user = await User.findById(userId).lean();
  if (!user) throw ApiError.notFound("User not found.");
  return presentUser(user);
}

/** Update the signed-in user's display name and/or avatar URL. */
export async function updateMe(
  userId: string,
  patch: { name?: string; avatar?: string },
) {
  const user: any = await User.findById(userId);
  if (!user) throw ApiError.notFound("User not found.");

  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) throw ApiError.badRequest("Your name can't be empty.");
    // userName is unique — block collisions with a friendly message.
    if (trimmed !== user.userName) {
      const taken = await User.exists({
        userName: trimmed,
        _id: { $ne: user._id },
      });
      if (taken) throw ApiError.conflict("That name is already taken.");
      user.userName = trimmed;
    }
  }
  if (patch.avatar !== undefined) user.avatar = patch.avatar;

  await user.save();
  return presentUser(user);
}
