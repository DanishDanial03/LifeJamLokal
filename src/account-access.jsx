import React, { useState } from "react";
import {
  Mail,
  CheckCheck,
  LoaderCircle,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { api } from "./api";
export function GoogleButton({ enabled, role }) {
  return (
    <>
      <button
        type="button"
        className="google-signin"
        disabled={!enabled}
        onClick={() =>
          location.assign(
            "/api/auth/google/start?role=" + encodeURIComponent(role),
          )
        }
      >
        <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285f4"
            d="M22 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.6a4.8 4.8 0 0 1-2.1 3.2v2.6h3.4c2-1.8 3.1-4.5 3.1-7.7Z"
          />
          <path
            fill="#34a853"
            d="M12 22c2.8 0 5.1-.9 6.9-2.5l-3.4-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.7v2.7A10.4 10.4 0 0 0 12 22Z"
          />
          <path
            fill="#fbbc05"
            d="M6.2 13.6a6 6 0 0 1 0-3.2V7.7H2.7a10 10 0 0 0 0 8.6Z"
          />
          <path
            fill="#ea4335"
            d="M12 6.1c1.5 0 2.9.5 4 1.5l3-3A10 10 0 0 0 2.7 7.7l3.5 2.7A6.1 6.1 0 0 1 12 6.1Z"
          />
        </svg>
        Continue with Google
      </button>
      {!enabled && (
        <p className="auth-setup-note">
          Google sign-in will be available once the site owner completes Google
          setup.
        </p>
      )}
      <div className="auth-divider">
        <span>or use your email</span>
      </div>
    </>
  );
}
export function VerificationNotice({ email, onBack, initialError = "" }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(initialError),
    [cooldown, setCooldown] = useState(false);
  async function resend() {
    setBusy(true);
    setError("");
    try {
      const d = await api("/auth/resend-verification", {
        method: "POST",
        body: { email },
      });
      setMessage(d.message);
      setCooldown(true);
      setTimeout(() => setCooldown(false), 60000);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="verification-notice">
      <span className="empty-icon">
        <Mail size={30} />
      </span>
      <h3>{initialError ? "Let’s verify your email." : "Check your inbox."}</h3>
      <p>
        Open the verification email for <strong>{email}</strong> and confirm
        your address to activate your account. The link is valid for 24 hours.
      </p>
      <p>Don’t see it? Check your spam folder.</p>
      {message && (
        <p className="verification-success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="btn outline full"
        disabled={busy || cooldown}
        onClick={resend}
      >
        {busy && <LoaderCircle size={16} className="spin" />}
        {cooldown
          ? "Please wait before resending"
          : "Resend verification email"}
      </button>
      <button className="btn ghost full" onClick={onBack}>
        Back to sign in
      </button>
    </div>
  );
}
export function VerificationPage({ token, onSignIn }) {
  const [status, setStatus] = useState("pending"),
    [error, setError] = useState(""),
    [email, setEmail] = useState(""),
    [message, setMessage] = useState("");
  async function verify() {
    setStatus("loading");
    try {
      const d = await api("/auth/verify-email", {
        method: "POST",
        body: { token },
      });
      setMessage(d.message);
      setStatus("success");
      history.replaceState(null, "", location.pathname + "#verify-email");
    } catch (e) {
      setError(e.message);
      setStatus("error");
    }
  }
  async function resend(e) {
    e.preventDefault();
    try {
      const d = await api("/auth/resend-verification", {
        method: "POST",
        body: { email },
      });
      setMessage(d.message);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <div className="card account-access-page">
      <span className="empty-icon">
        {status === "success" ? (
          <CheckCheck size={32} />
        ) : (
          <ShieldCheck size={32} />
        )}
      </span>
      <h1>
        {status === "success"
          ? "You’re verified. Let’s make some noise."
          : "Confirm your email address."}
      </h1>
      {status === "success" ? (
        <>
          <p>{message}</p>
          <button className="btn" onClick={onSignIn}>
            Sign in to LifeJamLokal <ArrowUpRight size={17} />
          </button>
        </>
      ) : (
        <>
          <p>
            Confirm that this is your email address to activate your
            LifeJamLokal account.
          </p>
          {token && status !== "error" && (
            <button
              className="btn"
              disabled={status === "loading"}
              onClick={verify}
            >
              {status === "loading" ? (
                <LoaderCircle className="spin" size={16} />
              ) : null}
              Verify my email
            </button>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {(!token || status === "error") && (
            <form className="form-stack" onSubmit={resend}>
              <label className="field">
                <span>Your email address</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@gmail.com"
                />
              </label>
              <button className="btn outline" type="submit">
                Request a new verification email
              </button>
              {message && <p role="status">{message}</p>}
            </form>
          )}
        </>
      )}
    </div>
  );
}
export function GoogleResult({ result, onSignIn }) {
  const success = result === "success";
  const error = (() => {
    try {
      return decodeURIComponent(result.slice(6));
    } catch {
      return "Google sign-in could not be completed.";
    }
  })();
  return (
    <div className="card account-access-page">
      <span className="empty-icon">
        <ShieldCheck size={32} />
      </span>
      <h1>
        {success
          ? "Welcome to your local scene."
          : "Let’s try signing in again."}
      </h1>
      <p>
        {success
          ? "Your Google account is connected and your Gmail address is verified."
          : error}
      </p>
      {success ? (
        <a className="btn" href="#home">
          Explore the scene <ArrowUpRight size={17} />
        </a>
      ) : (
        <button className="btn" onClick={onSignIn}>
          Back to sign in
        </button>
      )}
    </div>
  );
}
