import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, ShieldCheck, Lock, User as UserIcon, AlertCircle } from "lucide-react";
import { getAdminSession, setAdminSession, verifyAdminCredentials } from "../firebase";

export default function Login() {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const session = getAdminSession();
    if (session) {
      navigate("/admin");
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim() || !password.trim()) {
      setError("Please enter both User ID and Password.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const isValid = await verifyAdminCredentials(userId, password);
      if (isValid) {
        setAdminSession({ userId: userId.trim() });
        navigate("/admin");
      } else {
        setError("Invalid User ID or Password. Please try again.");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Failed to verify credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fdfaf6] p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-[#e5d5c5]">
        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 bg-[#2c1810] rounded-full flex items-center justify-center text-[#d4af37] shadow-md">
            <ShieldCheck size={32} />
          </div>
        </div>
        <h1 className="text-3xl font-serif font-bold text-[#2c1810] text-center mb-1">Spice & Silk</h1>
        <p className="text-[#5c4033] text-center mb-6 text-sm font-medium">Admin Portal Authentication</p>
        
        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#4a2c1d] uppercase tracking-wider mb-1">
              User ID
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b7355]" />
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter User ID"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-[#fdfaf6] border border-[#e5d5c5] rounded-lg text-[#2c1810] placeholder-[#a89078] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent text-sm transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#4a2c1d] uppercase tracking-wider mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b7355]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter Password"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-[#fdfaf6] border border-[#e5d5c5] rounded-lg text-[#2c1810] placeholder-[#a89078] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent text-sm transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 bg-[#2c1810] text-[#fdfaf6] py-3 px-6 rounded-lg hover:bg-[#4a2c1d] transition-all font-medium text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogIn size={18} />
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        
        <p className="mt-8 text-xs text-[#8b7355] text-center leading-relaxed border-t border-[#f5ede6] pt-4">
          Access restricted to authorized personnel. 
          Default credentials: <span className="font-mono text-[#2c1810] font-semibold">admin</span> / <span className="font-mono text-[#2c1810] font-semibold">admin</span>
        </p>
      </div>
    </div>
  );
}
