import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, Lock, User as UserIcon, AlertCircle, ArrowLeft, KeyRound } from "lucide-react";
import { getSuperAdminSession, setSuperAdminSession, verifySuperAdminCredentials } from "../firebase";

export default function SuperAdminLogin() {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const session = getSuperAdminSession();
    if (session) {
      navigate("/super-admin");
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim() || !password.trim()) {
      setError("Please provide both Super Admin ID and Password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const isValid = await verifySuperAdminCredentials(userId, password);
      if (isValid) {
        setSuperAdminSession({ userId: userId.trim() });
        navigate("/super-admin");
      } else {
        setError("Invalid Super Admin credentials. Please verify your access details.");
      }
    } catch (err) {
      console.error("Super Admin login error:", err);
      setError("Failed to verify Super Admin credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0908] p-4 text-[#fdfaf6]">
      {/* Background Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#d4af37]/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative max-w-md w-full bg-[#18110e] border border-[#d4af37]/30 rounded-3xl shadow-2xl p-8 backdrop-blur-xl z-10">
        <button
          onClick={() => navigate("/login")}
          className="inline-flex items-center gap-1.5 text-xs text-[#a89078] hover:text-[#d4af37] transition-colors mb-6 font-medium"
        >
          <ArrowLeft size={14} /> Back to Restaurant Login
        </button>

        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 bg-gradient-to-br from-[#d4af37] to-[#8c7322] rounded-2xl flex items-center justify-center text-[#18110e] shadow-lg shadow-[#d4af37]/20">
            <KeyRound size={32} strokeWidth={2.5} />
          </div>
        </div>

        <h1 className="text-2xl font-serif font-bold text-center tracking-wide text-white">
          Super Admin Console
        </h1>
        <p className="text-[#a89078] text-center mb-6 text-xs font-medium tracking-wider uppercase mt-1">
          Multi-Restaurant Fleet Management
        </p>

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-[#c9b89c] uppercase tracking-wider mb-1.5">
              Super Admin ID
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8c7355]" />
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="superadmin"
                required
                className="w-full pl-10 pr-4 py-3 bg-[#241a15] border border-[#3d2b22] focus:border-[#d4af37] rounded-xl text-white placeholder-[#6d5648] focus:outline-none focus:ring-1 focus:ring-[#d4af37] text-sm transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#c9b89c] uppercase tracking-wider mb-1.5">
              Super Admin Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8c7355]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full pl-10 pr-4 py-3 bg-[#241a15] border border-[#3d2b22] focus:border-[#d4af37] rounded-xl text-white placeholder-[#6d5648] focus:outline-none focus:ring-1 focus:ring-[#d4af37] text-sm transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-3 flex items-center justify-center gap-2 bg-gradient-to-r from-[#d4af37] via-[#e5c158] to-[#d4af37] text-[#18110e] py-3.5 px-6 rounded-xl hover:brightness-110 active:scale-[0.99] transition-all font-bold text-sm shadow-lg shadow-[#d4af37]/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ShieldAlert size={18} />
            {loading ? "Authenticating Fleet Access..." : "Access Super Admin Console"}
          </button>
        </form>

        
      </div>
    </div>
  );
}
