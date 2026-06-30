import { z } from "zod";
import { INVITABLE_ROLES } from "../config/constants";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id.");
const role = z.enum(INVITABLE_ROLES);

export const switchWorkspaceSchema = z.object({
  body: z.object({ workspaceId: objectId }),
});

export const inviteMemberSchema = z.object({
  body: z.object({
    email: z.string().email("Please enter a valid email address."),
    role: role.default("member"),
  }),
});

export const updateRoleSchema = z.object({
  params: z.object({ userId: objectId }),
  body: z.object({ role }),
});

export const memberParamSchema = z.object({
  params: z.object({ userId: objectId }),
});

export const inviteIdParamSchema = z.object({
  params: z.object({ id: objectId }),
});

export const inviteTokenParamSchema = z.object({
  params: z.object({ token: z.string().min(10, "Invalid invite link.") }),
});
