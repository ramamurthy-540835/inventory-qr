import { applicationDefault, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { isFirestoreConfigured } from "@/lib/firestore";

const projectId = process.env.GCP_PROJECT_ID;

export class ParentAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParentAuthError";
  }
}

export function isParentAuthRequired() {
  return isFirestoreConfigured() && process.env.REQUIRE_FIREBASE_AUTH !== "false";
}

function adminAuth() {
  const app = getApps().length ? getApp() : initializeApp({ credential: applicationDefault(), projectId });
  return getAuth(app);
}

async function decodeRequest(request: Request) {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) throw new ParentAuthError("Parent sign-in is required.");
  try {
    return await adminAuth().verifyIdToken(authorization.slice(7), true);
  } catch {
    throw new ParentAuthError("The parent session is invalid or expired.");
  }
}

export async function verifyMarketingAdmin(request: Request) {
  const decoded = await decodeRequest(request);
  const allowedEmail = (process.env.MARKETING_ADMIN_EMAIL || "").trim().toLowerCase();
  if (!allowedEmail) throw new ParentAuthError("Marketing administrator access is not configured.");
  if (!decoded.email_verified || decoded.email?.toLowerCase() !== allowedEmail) {
    throw new ParentAuthError("This account is not allowed to access Marketing OS.");
  }
  return { uid: decoded.uid, email: decoded.email };
}

function stringArray(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }

export function canAccessFranchise(claims: { admin?: unknown; roles?: unknown; franchise_ids?: unknown; franchise_id?: unknown }, franchiseId: string) {
  const roles = stringArray(claims.roles);
  if (claims.admin === true || roles.includes("admin")) return true;
  if (!roles.includes("franchise")) return false;
  return stringArray(claims.franchise_ids).includes(franchiseId) || claims.franchise_id === franchiseId;
}

export async function verifyFranchiseAccess(request: Request, franchiseId: string) {
  const decoded = await decodeRequest(request);
  const claims = decoded as unknown as { admin?: unknown; roles?: unknown; franchise_ids?: unknown; franchise_id?: unknown };
  if (!canAccessFranchise(claims, franchiseId)) throw new ParentAuthError("This account is not allowed to access this franchise.");
  return { uid: decoded.uid, isAdmin: claims.admin === true || stringArray(claims.roles).includes("admin") };
}

export async function verifyParent(request: Request) {
  if (!isParentAuthRequired()) return null;
  const decoded = await decodeRequest(request);
  if (!decoded.phone_number) throw new ParentAuthError("The signed-in account has no verified phone number.");
  return { uid: decoded.uid, phone: decoded.phone_number.replace(/^\+91/, "") };
}

export async function verifyStaffRole(request: Request, role: "admin" | "kitchen" | "coordinator" | "driver") {
  const decoded = await decodeRequest(request);
  const roles = Array.isArray(decoded.roles) ? decoded.roles : [];
  if (decoded.admin !== true && !roles.includes(role)) throw new ParentAuthError("This account does not have the required staff role.");
  return {
    uid: decoded.uid,
    role,
    isAdmin: decoded.admin === true,
    kitchenIds: stringArray(decoded.kitchen_ids),
    schoolIds: stringArray(decoded.school_ids),
    routeIds: stringArray(decoded.route_ids),
  };
}
