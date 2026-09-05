import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseClientConfigured = Boolean(config.apiKey && config.authDomain && config.projectId);
export const isPhoneAuthEnabled = process.env.NEXT_PUBLIC_ENABLE_PHONE_AUTH !== "false";

export function firebaseAuth() {
  if (!isFirebaseClientConfigured) return null;
  const app = getApps().length ? getApp() : initializeApp(config);
  return getAuth(app);
}
