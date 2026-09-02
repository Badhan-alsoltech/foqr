import React, { useEffect, useState } from "react";
import { auth, signInWithGoogle, logout } from "../firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { LogIn, LogOut, ShieldCheck } from "lucide-react";

export default function Login() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        navigate("/admin");
      }
    });
    return unsubscribe;
  }, [navigate]);

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fdfaf6] p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-[#e5d5c5]">
        <div className="mb-8 flex justify-center">
          <div className="w-16 h-16 bg-[#2c1810] rounded-full flex items-center justify-center text-[#d4af37]">
            <ShieldCheck size={32} />
          </div>
        </div>
        <h1 className="text-3xl font-serif font-bold text-[#2c1810] mb-2">Spice & Silk</h1>
        <p className="text-[#5c4033] mb-8 font-sans">Admin Portal</p>
        
        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 bg-[#2c1810] text-[#fdfaf6] py-3 px-6 rounded-lg hover:bg-[#4a2c1d] transition-all font-medium shadow-md"
        >
          <LogIn size={20} />
          Sign in with Google
        </button>
        
        <p className="mt-8 text-xs text-[#8b7355] leading-relaxed">
          Access restricted to authorized personnel only. 
          Unauthorized access attempts are logged.
        </p>
      </div>
    </div>
  );
}
