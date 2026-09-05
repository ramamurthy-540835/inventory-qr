"use client";

import { useEffect, useRef, useState } from "react";
import { ConfirmationResult, onAuthStateChanged, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { firebaseAuth, isFirebaseClientConfigured } from "@/lib/firebase-client";

export default function ParentAuth({ onChange }: { onChange: (phone: string | null) => void }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [message, setMessage] = useState("");
  const verifier = useRef<RecaptchaVerifier | null>(null);
  const auth = firebaseAuth();

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (user) => onChange(user?.phoneNumber?.replace(/^\+91/, "") || null));
  }, [auth, onChange]);

  if (!isFirebaseClientConfigured || !auth) return <small>Firebase phone sign-in is not configured.</small>;

  async function sendCode() {
    if (!/^[6-9]\d{9}$/.test(phone)) return setMessage("Enter a valid 10-digit mobile number.");
    try {
      verifier.current ||= new RecaptchaVerifier(auth!, "phone-recaptcha", { size: "invisible" });
      setConfirmation(await signInWithPhoneNumber(auth!, `+91${phone}`, verifier.current));
      setMessage("Verification code sent.");
    } catch (error) {
      verifier.current?.clear();
      verifier.current = null;
      const details = error instanceof Error ? error.message : "";
      setMessage(details.includes("requests-from-referer") ? "Firebase is blocking this live domain. Add lunchbox-foovqasysa-el.a.run.app in Firebase Console → Authentication → Settings → Authorized domains, then reload." : details || "Unable to send verification code.");
    }
  }

  async function verifyCode() {
    try {
      await confirmation?.confirm(code);
      setMessage("Phone number verified.");
    } catch {
      setMessage("The verification code is invalid or expired.");
    }
  }

  return <div>
    <div id="phone-recaptcha" />
    {!confirmation ? <label>Parent mobile<input value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="tel" placeholder="10-digit mobile number" /><button type="button" onClick={sendCode}>Send OTP</button></label> :
      <label>Verification code<input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="6-digit OTP" /><button type="button" onClick={verifyCode}>Verify OTP</button></label>}
    {message && <small role="status">{message}</small>}
  </div>;
}
