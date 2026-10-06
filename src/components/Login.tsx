import React, { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { LogIn, ShieldCheck, Lock, User as UserIcon, AlertCircle, Store, ShieldAlert, ArrowLeft } from "lucide-react";
import { 
  getAdminSession, setAdminSession, verifyRestaurantAdminCredentials, 
  fetchRestaurantBySlug, getAllRestaurants, RestaurantProfile 
} from "../firebase";

export default function Login() {
  const { restaurantSlug } = useParams<{ restaurantSlug?: string }>();
  const [currentRestaurant, setCurrentRestaurant] = useState<RestaurantProfile | null>(null);
  const [allRestaurants, setAllRestaurants] = useState<RestaurantProfile[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>(restaurantSlug || "");
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // If already logged in, redirect
    const session = getAdminSession();
    if (session) {
      if (session.restaurantSlug) {
        navigate(`/r/${session.restaurantSlug}/admin`);
      } else {
        navigate("/admin");
      }
    }
  }, [navigate]);

  useEffect(() => {
    // Fetch restaurant details if slug provided
    if (restaurantSlug) {
      fetchRestaurantBySlug(restaurantSlug).then(r => {
        if (r) {
          setCurrentRestaurant(r);
          setSelectedSlug(r.slug);
        }
      });
    } else {
      getAllRestaurants().then(list => {
        setAllRestaurants(list);
        if (list.length > 0 && !selectedSlug) {
          setSelectedSlug(list[0].slug);
        }
      });
    }
  }, [restaurantSlug]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim() || !password.trim()) {
      setError("Please enter both User ID and Password.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const targetSlug = restaurantSlug || selectedSlug || "";
      const result = await verifyRestaurantAdminCredentials(targetSlug, userId, password);
      
      if (result.isValid && result.restaurant) {
        setAdminSession({
          userId: userId.trim(),
          restaurantId: result.restaurant.id,
          restaurantSlug: result.restaurant.slug,
          restaurantName: result.restaurant.name
        });
        navigate(`/r/${result.restaurant.slug}/admin`);
      } else if (result.isValid) {
        setAdminSession({ userId: userId.trim() });
        navigate("/admin");
      } else {
        setError("Invalid User ID or Password for this restaurant. Please verify credentials.");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Failed to verify credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const displayName = currentRestaurant 
    ? currentRestaurant.name 
    : (allRestaurants.find(r => r.slug === selectedSlug)?.name || "Restaurant Portal");

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fdfaf6] p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-[#e5d5c5]">
        {/* Top Header */}
        <div className="mb-6 flex justify-between items-center">
          <Link
            to={restaurantSlug ? `/r/${restaurantSlug}` : "/"}
            className="inline-flex items-center gap-1.5 text-xs text-[#8b7355] hover:text-[#2c1810]"
          >
            <ArrowLeft size={14} /> View Menu
          </Link>

          <Link
            to="/super-admin/login"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#d4af37] bg-[#2c1810] px-2.5 py-1 rounded-lg hover:bg-[#4a2c1d] transition-all"
          >
            <ShieldAlert size={12} />
            Super Admin
          </Link>
        </div>

        <div className="mb-4 flex justify-center">
          <div className="w-16 h-16 bg-[#2c1810] rounded-2xl flex items-center justify-center text-[#d4af37] shadow-md">
            <ShieldCheck size={32} />
          </div>
        </div>

        <h1 className="text-2xl font-serif font-bold text-[#2c1810] text-center mb-1">
          {displayName}
        </h1>
        <p className="text-[#5c4033] text-center mb-6 text-xs font-semibold uppercase tracking-wider">
          Restaurant Management Authentication
        </p>

        {/* Global Restaurant Selector if no slug in URL and multiple exist */}
        {!restaurantSlug && allRestaurants.length > 1 && (
          <div className="mb-4">
            <label className="block text-xs font-semibold text-[#4a2c1d] uppercase tracking-wider mb-1">
              Select Restaurant Location
            </label>
            <div className="relative">
              <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b7355]" />
              <select
                value={selectedSlug}
                onChange={(e) => setSelectedSlug(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#fdfaf6] border border-[#e5d5c5] rounded-xl text-[#2c1810] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
              >
                {allRestaurants.map(r => (
                  <option key={r.id} value={r.slug}>
                    {r.name} (/{r.slug})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#4a2c1d] uppercase tracking-wider mb-1">
              Staff / Admin User ID
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b7355]" />
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter Restaurant User ID"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-[#fdfaf6] border border-[#e5d5c5] rounded-xl text-[#2c1810] placeholder-[#a89078] focus:outline-none focus:ring-2 focus:ring-[#d4af37] text-sm transition-all"
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
                className="w-full pl-10 pr-4 py-2.5 bg-[#fdfaf6] border border-[#e5d5c5] rounded-xl text-[#2c1810] placeholder-[#a89078] focus:outline-none focus:ring-2 focus:ring-[#d4af37] text-sm transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 bg-[#2c1810] text-[#fdfaf6] py-3 px-6 rounded-xl hover:bg-[#4a2c1d] transition-all font-bold text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogIn size={18} />
            {loading ? "Signing in..." : "Enter Restaurant Portal"}
          </button>
        </form>

        <p className="mt-8 text-xs text-[#8b7355] text-center leading-relaxed border-t border-[#f5ede6] pt-4">
          Access is provisioned by Super Admin.
          <br />
          Need a restaurant setup? Contact Super Admin.
        </p>
      </div>
    </div>
  );
}
