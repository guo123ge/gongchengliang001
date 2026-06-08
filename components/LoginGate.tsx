"use client";

import { useEffect, useState, type ReactNode } from "react";
import { HardHat, Lock, Loader2 } from "lucide-react";

export default function LoginGate({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const check = async () => {
    try {
      const resp = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await resp.json();
      setConfigured(data.configured !== false);
      setAuthenticated(data.authenticated === true);
    } catch {
      setConfigured(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    check();
  }, []);

  const login = async () => {
    setBusy(true);
    setError("");
    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setError(data.error || "登录失败");
        return;
      }
      setAuthenticated(true);
    } catch (e: any) {
      setError(e?.message || "登录失败");
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background text-on-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (authenticated) return <>{children}</>;

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background text-on-background px-4">
      <div className="panel w-full max-w-sm p-5 shadow-xl">
        <div className="flex items-center gap-2 mb-5">
          <HardHat className="w-6 h-6 text-primary" />
          <div>
            <div className="font-semibold text-on-surface">BIM.Core 管理员登录</div>
            <div className="text-xs text-on-surface-variant">腾讯云单教师版访问保护</div>
          </div>
        </div>

        {!configured ? (
          <div className="text-sm text-error bg-error/10 border border-error/20 rounded-lg p-3">
            服务器未配置 ADMIN_PASSWORD，请先在部署环境变量中设置管理员密码。
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              login();
            }}
          >
            <div>
              <div className="text-xs text-on-surface-variant mb-1">管理员密码</div>
              <input
                className="input-eng"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
            </div>
            {error && <div className="text-xs text-error">{error}</div>}
            <button className="btn-primary w-full justify-center" disabled={busy || !password}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              登录
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
