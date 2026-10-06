import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  Building2, Plus, Search, ExternalLink, Key, Copy, Check, LogOut, 
  Trash2, Edit3, ShieldAlert, Store, ShoppingBag, DollarSign, 
  CheckCircle2, XCircle, Clock, Phone, Mail, MapPin, Eye, EyeOff,
  Share2, MessageSquare, UtensilsCrossed, RefreshCw, QrCode,
  Image as ImageIcon, FileText, Receipt, Building, Percent
} from "lucide-react";
import { 
  getSuperAdminSession, logoutSuperAdmin, getAllRestaurants, 
  createRestaurantProfile, updateRestaurantProfile, deleteRestaurantProfile,
  RestaurantProfile, setAdminSession, ensureDefaultRestaurant, db
} from "../firebase";
import { collection, onSnapshot, query, collectionGroup } from "firebase/firestore";
import { cn, normalizeImageUrl } from "../lib/utils";

interface GlobalOrder {
  id: string;
  restaurantId: string;
  restaurantName?: string;
  restaurantSlug?: string;
  customerName: string;
  customerPhone: string;
  tableNumber: string;
  totalAmount: number;
  status: "pending" | "approved" | "completed" | "rejected";
  createdAt?: any;
  items?: any[];
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState<RestaurantProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"restaurants" | "global-orders">("restaurants");
  
  // Realtime global orders across all restaurants
  const [globalOrders, setGlobalOrders] = useState<GlobalOrder[]>([]);
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<RestaurantProfile | null>(null);
  const [handoverModalRestaurant, setHandoverModalRestaurant] = useState<RestaurantProfile | null>(null);
  
  // Copy to clipboard state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  // New restaurant form state with all restaurant profile configuration fields
  const [newRestaurant, setNewRestaurant] = useState({
    name: "",
    slug: "",
    subtitle: "",
    logoUrl: "",
    coverUrl: "",
    phone: "",
    email: "",
    address: "",
    gstin: "",
    fssai: "",
    taxRate: 5,
    serviceChargeRate: 0,
    billFooter: "THANK YOU FOR DINING WITH US",
    adminUserId: "",
    adminPassword: "",
    seedMenu: true,
  });

  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check auth
  useEffect(() => {
    const session = getSuperAdminSession();
    if (!session) {
      navigate("/super-admin/login");
    }
  }, [navigate]);

  // Load restaurants in realtime
  useEffect(() => {
    const q = query(collection(db, "restaurants"));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        // Ensure at least one default restaurant exists
        try {
          await ensureDefaultRestaurant();
        } catch (e) {
          console.error("Failed to seed default restaurant:", e);
        }
      }
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RestaurantProfile));
      setRestaurants(list);
      setLoading(false);
    }, (err) => {
      console.error("Failed to fetch restaurants:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Listen to global orders across all restaurants
  useEffect(() => {
    try {
      const qOrders = query(collectionGroup(db, "orderRequests"));
      const unsubscribe = onSnapshot(qOrders, (snapshot) => {
        const orders: GlobalOrder[] = snapshot.docs.map(d => {
          const pathSegments = d.ref.path.split("/");
          // path format: restaurants/{restaurantId}/orderRequests/{orderId} OR orderRequests/{orderId}
          const restaurantId = pathSegments[0] === "restaurants" ? pathSegments[1] : "root";
          return {
            id: d.id,
            restaurantId,
            ...d.data()
          } as GlobalOrder;
        });
        setGlobalOrders(orders);
      }, (err) => {
        console.warn("Global orderRequests collectionGroup listener notice:", err);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("Failed to attach global order listener:", e);
    }
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Auto-generate slug and user credentials when restaurant name changes
  const handleNameChange = (name: string) => {
    const autoSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    
    const autoUser = autoSlug ? `${autoSlug.replace(/-/g, "_")}_admin` : "";
    const autoPass = `foqr${Math.floor(1000 + Math.random() * 9000)}`;

    setNewRestaurant(prev => ({
      ...prev,
      name,
      slug: autoSlug,
      adminUserId: prev.adminUserId || autoUser,
      adminPassword: prev.adminPassword || autoPass
    }));
  };

  const handleCreateRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!newRestaurant.name.trim()) {
      setFormError("Restaurant name is required.");
      return;
    }
    if (!newRestaurant.slug.trim()) {
      setFormError("Restaurant slug is required.");
      return;
    }
    if (!newRestaurant.adminUserId.trim() || !newRestaurant.adminPassword.trim()) {
      setFormError("Admin User ID and Password are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const createdId = await createRestaurantProfile({
        name: newRestaurant.name.trim(),
        slug: newRestaurant.slug.trim().toLowerCase(),
        subtitle: newRestaurant.subtitle.trim(),
        logoUrl: newRestaurant.logoUrl.trim(),
        coverUrl: newRestaurant.coverUrl.trim(),
        phone: newRestaurant.phone.trim(),
        email: newRestaurant.email.trim(),
        address: newRestaurant.address.trim(),
        gstin: newRestaurant.gstin.trim(),
        fssai: newRestaurant.fssai.trim(),
        taxRate: Number(newRestaurant.taxRate) || 5,
        serviceChargeRate: Number(newRestaurant.serviceChargeRate) || 0,
        billFooter: newRestaurant.billFooter.trim() || "THANK YOU FOR DINING WITH US",
        adminUserId: newRestaurant.adminUserId.trim(),
        adminPassword: newRestaurant.adminPassword.trim(),
        isActive: true,
      }, newRestaurant.seedMenu);

      const createdRestaurant: RestaurantProfile = {
        id: createdId,
        name: newRestaurant.name.trim(),
        slug: newRestaurant.slug.trim().toLowerCase(),
        subtitle: newRestaurant.subtitle.trim(),
        logoUrl: newRestaurant.logoUrl.trim(),
        coverUrl: newRestaurant.coverUrl.trim(),
        phone: newRestaurant.phone.trim(),
        email: newRestaurant.email.trim(),
        address: newRestaurant.address.trim(),
        gstin: newRestaurant.gstin.trim(),
        fssai: newRestaurant.fssai.trim(),
        taxRate: Number(newRestaurant.taxRate) || 5,
        serviceChargeRate: Number(newRestaurant.serviceChargeRate) || 0,
        billFooter: newRestaurant.billFooter.trim() || "THANK YOU FOR DINING WITH US",
        adminUserId: newRestaurant.adminUserId.trim(),
        adminPassword: newRestaurant.adminPassword.trim(),
        isActive: true
      };

      setIsAddModalOpen(false);
      setHandoverModalRestaurant(createdRestaurant);
      // Reset form
      setNewRestaurant({
        name: "",
        slug: "",
        subtitle: "",
        logoUrl: "",
        coverUrl: "",
        phone: "",
        email: "",
        address: "",
        gstin: "",
        fssai: "",
        taxRate: 5,
        serviceChargeRate: 0,
        billFooter: "THANK YOU FOR DINING WITH US",
        adminUserId: "",
        adminPassword: "",
        seedMenu: true,
      });
    } catch (err: any) {
      console.error("Failed to create restaurant:", err);
      setFormError(err.message || "Failed to create restaurant. Check slug uniqueness.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRestaurant) return;

    try {
      await updateRestaurantProfile(editingRestaurant.id, {
        name: editingRestaurant.name,
        subtitle: editingRestaurant.subtitle,
        logoUrl: editingRestaurant.logoUrl,
        coverUrl: editingRestaurant.coverUrl,
        phone: editingRestaurant.phone,
        email: editingRestaurant.email,
        address: editingRestaurant.address,
        gstin: editingRestaurant.gstin,
        fssai: editingRestaurant.fssai,
        taxRate: editingRestaurant.taxRate,
        serviceChargeRate: editingRestaurant.serviceChargeRate,
        billFooter: editingRestaurant.billFooter,
        adminUserId: editingRestaurant.adminUserId,
        adminPassword: editingRestaurant.adminPassword,
        isActive: editingRestaurant.isActive
      });
      setIsEditModalOpen(false);
      setEditingRestaurant(null);
    } catch (err) {
      console.error("Failed to update restaurant:", err);
      alert("Failed to update restaurant details.");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you completely sure you want to permanently delete '${name}' and all its menus, orders, and tables? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteRestaurantProfile(id);
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete restaurant.");
    }
  };

  const handleToggleStatus = async (r: RestaurantProfile) => {
    try {
      await updateRestaurantProfile(r.id, { isActive: !r.isActive });
    } catch (err) {
      console.error("Status toggle failed:", err);
    }
  };

  // Direct login into a restaurant dashboard as Super Admin
  const handleImpersonateRestaurant = (r: RestaurantProfile) => {
    setAdminSession({
      userId: `superadmin_view_${r.adminUserId}`,
      restaurantId: r.id,
      restaurantSlug: r.slug,
      restaurantName: r.name
    });
    navigate(`/r/${r.slug}/admin`);
  };

  const handleLogout = () => {
    logoutSuperAdmin();
    navigate("/super-admin/login");
  };

  // Filtered restaurants
  const filteredRestaurants = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return restaurants;
    return restaurants.filter(r => 
      r.name.toLowerCase().includes(q) ||
      r.slug.toLowerCase().includes(q) ||
      (r.phone && r.phone.toLowerCase().includes(q)) ||
      (r.email && r.email.toLowerCase().includes(q))
    );
  }, [restaurants, searchQuery]);

  // Metrics
  const totalRevenue = useMemo(() => {
    return globalOrders
    
      .filter(o => o.status === "completed" || o.status === "approved")
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  }, [globalOrders]);

  const activeCount = restaurants.filter(r => r.isActive).length;

  return (
    <div className="min-h-screen bg-[#0e0a08] text-[#f7f2eb] font-sans flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-[#160f0c]/90 backdrop-blur-md border-b border-[#d4af37]/20 px-6 py-4 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#d4af37] to-[#967d28] flex items-center justify-center text-[#160f0c] shadow-lg shadow-[#d4af37]/20">
            <ShieldAlert size={22} strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif font-bold text-lg text-white tracking-wide">
                foQR Super Admin Console
              </h1>
              <span className="text-[10px] font-bold bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/40 px-2 py-0.5 rounded-full uppercase tracking-widest">
                Central Fleet Command
              </span>
            </div>
            <p className="text-xs text-[#a89078]">
              Manage restaurant profiles, handover portals & global operations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-[#d4af37] to-[#b39023] text-[#160f0c] font-bold px-4 py-2 rounded-xl text-xs shadow-md shadow-[#d4af37]/20 hover:brightness-110 active:scale-95 transition-all"
          >
            <Plus size={16} strokeWidth={3} />
            Onboard New Restaurant
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-[#a89078] hover:text-white bg-[#221713] hover:bg-[#33221b] border border-[#3d2b22] px-3 py-2 rounded-xl transition-all"
            title="Sign out of Super Admin"
          >
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#18110e] border border-[#2e2019] rounded-2xl p-4 shadow-lg flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Store size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{restaurants.length}</div>
              <div className="text-xs text-[#a89078] font-medium">Total Registered Restaurants</div>
            </div>
          </div>

          <div className="bg-[#18110e] border border-[#2e2019] rounded-2xl p-4 shadow-lg flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{activeCount} / {restaurants.length}</div>
              <div className="text-xs text-[#a89078] font-medium">Active Dining Operations</div>
            </div>
          </div>

          <div className="bg-[#18110e] border border-[#2e2019] rounded-2xl p-4 shadow-lg flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShoppingBag size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{globalOrders.length}</div>
              <div className="text-xs text-[#a89078] font-medium">All-Time Fleet Orders</div>
            </div>
          </div>

          <div className="bg-[#18110e] border border-[#2e2019] rounded-2xl p-4 shadow-lg flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <DollarSign size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">₹{totalRevenue.toLocaleString()}</div>
              <div className="text-xs text-[#a89078] font-medium">Fleet Gross Revenue</div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[#2e2019] pb-4">
          <div className="flex items-center gap-2 bg-[#18110e] p-1 rounded-xl border border-[#2e2019]">
            <button
              onClick={() => setActiveTab("restaurants")}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2",
                activeTab === "restaurants"
                  ? "bg-[#d4af37] text-[#160f0c] shadow-sm"
                  : "text-[#a89078] hover:text-white"
              )}
            >
              <Store size={14} />
              Restaurants Fleet ({restaurants.length})
            </button>
            <button
              onClick={() => setActiveTab("global-orders")}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2",
                activeTab === "global-orders"
                  ? "bg-[#d4af37] text-[#160f0c] shadow-sm"
                  : "text-[#a89078] hover:text-white"
              )}
            >
              <ShoppingBag size={14} />
              Global Orders Feed ({globalOrders.length})
            </button>
          </div>

          {activeTab === "restaurants" && (
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8c7355]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search restaurant by name, slug..."
                className="w-full pl-10 pr-4 py-2 bg-[#18110e] border border-[#2e2019] rounded-xl text-white placeholder-[#6d5648] text-xs focus:outline-none focus:border-[#d4af37]"
              />
            </div>
          )}
        </div>

        {/* View 1: Restaurants Fleet */}
        {activeTab === "restaurants" && (
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-20 text-[#a89078] text-sm animate-pulse">
                Loading restaurant profiles...
              </div>
            ) : filteredRestaurants.length === 0 ? (
              <div className="bg-[#18110e] border border-[#2e2019] rounded-2xl p-12 text-center space-y-4">
                <Store className="w-12 h-12 text-[#6d5648] mx-auto" />
                <h3 className="text-base font-semibold text-white">No Restaurants Found</h3>
                <p className="text-xs text-[#a89078] max-w-md mx-auto">
                  {searchQuery ? "No restaurant matches your search criteria." : "You haven't added any restaurants yet. Click 'Onboard New Restaurant' above to launch your first location."}
                </p>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="inline-flex items-center gap-2 bg-[#d4af37] text-[#160f0c] font-bold px-4 py-2 rounded-xl text-xs"
                >
                  <Plus size={16} /> Onboard Restaurant Now
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredRestaurants.map((r) => {
                  const customerUrl = `${window.location.origin}/r/${r.slug}`;
                  const adminUrl = `${window.location.origin}/r/${r.slug}/admin`;
                  const isPwVisible = showPasswords[r.id];

                  return (
                    <div
                      key={r.id}
                      className={cn(
                        "bg-[#18110e] border rounded-2xl p-5 shadow-lg space-y-4 transition-all relative overflow-hidden",
                        r.isActive ? "border-[#2e2019] hover:border-[#d4af37]/40" : "border-red-900/30 opacity-70"
                      )}
                    >
                      {/* Top Header of Card */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-14 h-14 rounded-xl bg-[#241a15] border border-[#3d2b22] flex items-center justify-center text-[#d4af37] font-serif font-bold text-xl shrink-0 overflow-hidden relative shadow-sm">
                            {r.coverUrl ? (
                              <img 
                                src={normalizeImageUrl(r.coverUrl)} 
                                alt={r.name} 
                                className="w-full h-full object-cover" 
                                referrerPolicy="no-referrer"
                              />
                            ) : r.logoUrl ? (
                              <img 
                                src={normalizeImageUrl(r.logoUrl)} 
                                alt={r.name} 
                                className="w-full h-full object-contain p-1" 
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              r.name.charAt(0)
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h2 className="text-base font-bold text-white">{r.name}</h2>
                              <span className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                                r.isActive 
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                  : "bg-red-500/10 text-red-400 border border-red-500/20"
                              )}>
                                {r.isActive ? "Active" : "Suspended"}
                              </span>
                            </div>
                            <p className="text-xs text-[#a89078] line-clamp-1">{r.subtitle || "FINE DINING & MULTI CUISINE"}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="font-mono text-[11px] text-[#d4af37] bg-[#241a15] px-2 py-0.5 rounded border border-[#3d2b22]">
                                /{r.slug}
                              </span>
                              {r.gstin && (
                                <span className="text-[10px] text-[#8c7355] bg-[#120d0b] px-1.5 py-0.5 rounded border border-[#2e2019] font-mono">
                                  GST: {r.gstin}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Handover & Quick Enter Action */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setHandoverModalRestaurant(r)}
                            className="bg-[#241a15] hover:bg-[#d4af37] hover:text-[#160f0c] text-[#d4af37] border border-[#d4af37]/40 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                            title="Open Restaurant Handover Pack"
                          >
                            <Share2 size={13} />
                            Handover
                          </button>
                          <button
                            onClick={() => handleImpersonateRestaurant(r)}
                            className="bg-[#d4af37] hover:brightness-110 text-[#160f0c] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                            title="Enter Restaurant Admin Console directly"
                          >
                            <ExternalLink size={13} />
                            Manage
                          </button>
                        </div>
                      </div>

                      {/* URLs Handover Box */}
                      <div className="bg-[#120d0b] rounded-xl p-3 border border-[#261b16] space-y-2 text-xs">
                        {/* Customer URL */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8c7355] w-20 shrink-0">
                              Guest Menu:
                            </span>
                            <a
                              href={customerUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-400 hover:underline truncate font-mono text-[11px]"
                            >
                              {customerUrl}
                            </a>
                          </div>
                          <button
                            onClick={() => copyToClipboard(customerUrl, `cust_${r.id}`)}
                            className="text-[#8c7355] hover:text-[#d4af37] p-1 rounded transition-colors"
                            title="Copy Guest URL"
                          >
                            {copiedKey === `cust_${r.id}` ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                          </button>
                        </div>

                        {/* Admin Portal URL */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8c7355] w-20 shrink-0">
                              Admin Portal:
                            </span>
                            <a
                              href={adminUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#e5c185] hover:underline truncate font-mono text-[11px]"
                            >
                              {adminUrl}
                            </a>
                          </div>
                          <button
                            onClick={() => copyToClipboard(adminUrl, `admin_${r.id}`)}
                            className="text-[#8c7355] hover:text-[#d4af37] p-1 rounded transition-colors"
                            title="Copy Admin Portal URL"
                          >
                            {copiedKey === `admin_${r.id}` ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                          </button>
                        </div>

                        {/* Owner Credentials */}
                        <div className="pt-2 border-t border-[#261b16] flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 text-[#a89078]">
                              <Key size={12} className="text-[#d4af37]" />
                              <span>Login ID:</span>
                              <span className="font-mono text-white font-semibold">{r.adminUserId}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[#a89078]">
                              <span>Pass:</span>
                              <span className="font-mono text-white font-semibold">
                                {isPwVisible ? r.adminPassword : "••••••••"}
                              </span>
                              <button
                                onClick={() => togglePasswordVisibility(r.id)}
                                className="text-[#8c7355] hover:text-white"
                              >
                                {isPwVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                              </button>
                            </div>
                          </div>

                          <button
                            onClick={() => copyToClipboard(`ID: ${r.adminUserId} | Password: ${r.adminPassword}`, `cred_${r.id}`)}
                            className="text-[10px] text-[#d4af37] hover:underline flex items-center gap-1"
                          >
                            {copiedKey === `cred_${r.id}` ? "Copied!" : "Copy Creds"}
                          </button>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-[#241a15]">
                        <div className="flex items-center gap-3 text-[#8c7355] text-[11px]">
                          {r.phone && <span>📞 {r.phone}</span>}
                          {r.taxRate !== undefined && <span>GST: {r.taxRate}%</span>}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleStatus(r)}
                            className={cn(
                              "px-2.5 py-1 rounded text-[11px] font-medium transition-all",
                              r.isActive ? "text-amber-400 hover:bg-amber-950/30" : "text-emerald-400 hover:bg-emerald-950/30"
                            )}
                          >
                            {r.isActive ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            onClick={() => {
                              setEditingRestaurant(r);
                              setIsEditModalOpen(true);
                            }}
                            className="text-[#a89078] hover:text-white p-1.5 rounded-lg hover:bg-[#221713] transition-all"
                            title="Edit Restaurant Details"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(r.id, r.name)}
                            className="text-red-400 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-950/30 transition-all"
                            title="Delete Restaurant Profile"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* View 2: Global Orders Feed */}
        {activeTab === "global-orders" && (
          <div className="bg-[#18110e] border border-[#2e2019] rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-[#2e2019] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-white">Fleet-Wide Live Order Stream</h3>
                <p className="text-xs text-[#a89078]">Aggregated live dining orders across all restaurant locations</p>
              </div>
              <span className="text-xs text-[#d4af37] font-semibold bg-[#241a15] px-3 py-1 rounded-full border border-[#3d2b22]">
                {globalOrders.length} Total Orders
              </span>
            </div>

            {globalOrders.length === 0 ? (
              <div className="p-12 text-center text-[#a89078] text-xs">
                No active or historical orders found in the system yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#120d0b] text-[#8c7355] uppercase tracking-wider text-[10px] border-b border-[#261b16]">
                    <tr>
                      <th className="py-3 px-4">Restaurant</th>
                      <th className="py-3 px-4">Order ID</th>
                      <th className="py-3 px-4">Table</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Items</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#261b16]">
                    {globalOrders.map((ord) => {
                      const matchedRestaurant = restaurants.find(r => r.id === ord.restaurantId);
                      return (
                        <tr key={ord.id} className="hover:bg-[#221713] transition-colors">
                          <td className="py-3 px-4 font-semibold text-white">
                            {matchedRestaurant ? matchedRestaurant.name : (ord.restaurantId || "Default")}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-[#a89078]">
                            #{ord.id.slice(0, 7)}
                          </td>
                          <td className="py-3 px-4 font-medium text-[#e5c185]">
                            {ord.tableNumber || "Direct"}
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-white font-medium">{ord.customerName || "Guest"}</div>
                            <div className="text-[10px] text-[#8c7355]">{ord.customerPhone}</div>
                          </td>
                          <td className="py-3 px-4 text-[#a89078]">
                            {ord.items?.length ? `${ord.items.length} items` : "-"}
                          </td>
                          <td className="py-3 px-4 font-bold text-white">
                            ₹{ord.totalAmount?.toLocaleString() || 0}
                          </td>
                          <td className="py-3 px-4">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                              ord.status === "completed" && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                              ord.status === "approved" && "bg-blue-500/10 text-blue-400 border border-blue-500/20",
                              ord.status === "pending" && "bg-amber-500/10 text-amber-400 border border-amber-500/20",
                              ord.status === "rejected" && "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            )}>
                              {ord.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL 1: Onboard New Restaurant */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#18110e] border border-[#d4af37]/40 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-[#2e2019] pb-4">
                <div>
                  <h3 className="text-lg font-serif font-bold text-white">
                    Onboard New Restaurant Profile
                  </h3>
                  <p className="text-xs text-[#a89078]">
                    Set up restaurant branding, URL slug, and handover credentials
                  </p>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-[#a89078] hover:text-white text-sm p-1 rounded"
                >
                  ✕
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-200 text-xs">
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreateRestaurant} className="space-y-4">
                {/* Restaurant Name */}
                <div>
                  <label className="block text-[11px] font-bold text-[#c9b89c] uppercase tracking-wider mb-1">
                    Restaurant Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newRestaurant.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Royal Spice Bistro"
                    className="w-full px-3.5 py-2.5 bg-[#241a15] border border-[#3d2b22] focus:border-[#d4af37] rounded-xl text-white text-xs focus:outline-none"
                  />
                </div>

                {/* Slug (URL key) */}
                <div>
                  <label className="block text-[11px] font-bold text-[#c9b89c] uppercase tracking-wider mb-1">
                    Restaurant URL Slug *
                  </label>
                  <div className="flex items-center">
                    <span className="bg-[#120d0b] border border-r-0 border-[#3d2b22] px-3 py-2.5 rounded-l-xl text-xs text-[#8c7355] font-mono">
                      /r/
                    </span>
                    <input
                      type="text"
                      required
                      value={newRestaurant.slug}
                      onChange={(e) => setNewRestaurant(prev => ({ ...prev, slug: e.target.value }))}
                      placeholder="royal-spice-bistro"
                      className="w-full px-3.5 py-2.5 bg-[#241a15] border border-[#3d2b22] focus:border-[#d4af37] rounded-r-xl text-white text-xs font-mono focus:outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-[#8c7355] mt-1">
                    This forms the unique link handed over to the restaurant owner.
                  </p>
                </div>

                {/* Subtitle / Tagline */}
                <div>
                  <label className="block text-[11px] font-bold text-[#c9b89c] uppercase tracking-wider mb-1">
                    Tagline / Subtitle
                  </label>
                  <input
                    type="text"
                    value={newRestaurant.subtitle}
                    onChange={(e) => setNewRestaurant(prev => ({ ...prev, subtitle: e.target.value }))}
                    placeholder="e.g. Authentic North Indian & Tandoori Cuisine"
                    className="w-full px-3.5 py-2.5 bg-[#241a15] border border-[#3d2b22] focus:border-[#d4af37] rounded-xl text-white text-xs focus:outline-none"
                  />
                </div>

                {/* Restaurant Visuals: Photo URL & Logo URL */}
                <div className="bg-[#120d0b] p-4 rounded-2xl border border-[#2e2019] space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#d4af37]">
                    <ImageIcon size={14} /> Restaurant Visuals & Imagery
                  </div>

                  {/* Photo / Banner URL */}
                  <div>
                    <label className="block text-[10px] font-bold text-[#a89078] uppercase mb-1">
                      Restaurant Photo / Cover Image URL
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="url"
                        value={newRestaurant.coverUrl}
                        onChange={(e) => setNewRestaurant(prev => ({ ...prev, coverUrl: e.target.value }))}
                        placeholder="https://images.unsplash.com/... or Google Drive URL"
                        className="w-full px-3 py-2 bg-[#1a130f] border border-[#3d2b22] rounded-lg text-white text-xs focus:outline-none focus:border-[#d4af37]"
                      />
                      {newRestaurant.coverUrl && (
                        <img
                          src={normalizeImageUrl(newRestaurant.coverUrl)}
                          alt="Cover Preview"
                          className="w-14 h-9 object-cover rounded-lg border border-[#3d2b22] bg-[#1a130f] shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      )}
                    </div>
                    <p className="text-[10px] text-[#8c7355] mt-1">
                      Displayed on the customer menu header and fleet restaurant cards.
                    </p>
                  </div>

                  {/* Logo URL */}
                  <div>
                    <label className="block text-[10px] font-bold text-[#a89078] uppercase mb-1">
                      Restaurant Logo URL
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="url"
                        value={newRestaurant.logoUrl}
                        onChange={(e) => setNewRestaurant(prev => ({ ...prev, logoUrl: e.target.value }))}
                        placeholder="https://example.com/logo.png"
                        className="w-full px-3 py-2 bg-[#1a130f] border border-[#3d2b22] rounded-lg text-white text-xs focus:outline-none focus:border-[#d4af37]"
                      />
                      {newRestaurant.logoUrl && (
                        <img
                          src={normalizeImageUrl(newRestaurant.logoUrl)}
                          alt="Logo Preview"
                          className="w-9 h-9 object-contain rounded-lg border border-[#3d2b22] bg-white p-0.5 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      )}
                    </div>
                    <p className="text-[10px] text-[#8c7355] mt-1">
                      Appears on customer menus, printable bills, and receipt headers.
                    </p>
                  </div>
                </div>

                {/* Contact: Phone & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#c9b89c] uppercase tracking-wider mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={newRestaurant.phone}
                      onChange={(e) => setNewRestaurant(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+91 98765 43210"
                      className="w-full px-3.5 py-2.5 bg-[#241a15] border border-[#3d2b22] focus:border-[#d4af37] rounded-xl text-white text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#c9b89c] uppercase tracking-wider mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={newRestaurant.email}
                      onChange={(e) => setNewRestaurant(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="owner@royalspice.com"
                      className="w-full px-3.5 py-2.5 bg-[#241a15] border border-[#3d2b22] focus:border-[#d4af37] rounded-xl text-white text-xs focus:outline-none"
                    />
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-[11px] font-bold text-[#c9b89c] uppercase tracking-wider mb-1">
                    Physical Address (Prints on Bill Header)
                  </label>
                  <input
                    type="text"
                    value={newRestaurant.address}
                    onChange={(e) => setNewRestaurant(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Sector 29, Food Court, Gurugram"
                    className="w-full px-3.5 py-2.5 bg-[#241a15] border border-[#3d2b22] focus:border-[#d4af37] rounded-xl text-white text-xs focus:outline-none"
                  />
                </div>

                {/* Legal & Taxation Compliance */}
                <div className="bg-[#120d0b] p-4 rounded-2xl border border-[#2e2019] space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#d4af37]">
                    <FileText size={14} /> Legal & Taxation Compliance
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-[#a89078] uppercase mb-1">
                        GSTIN Number
                      </label>
                      <input
                        type="text"
                        value={newRestaurant.gstin}
                        onChange={(e) => setNewRestaurant(prev => ({ ...prev, gstin: e.target.value }))}
                        placeholder="07AAAAA0000A1Z5"
                        className="w-full px-3 py-2 bg-[#1a130f] border border-[#3d2b22] rounded-lg text-white font-mono uppercase text-xs focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#a89078] uppercase mb-1">
                        FSSAI License No.
                      </label>
                      <input
                        type="text"
                        value={newRestaurant.fssai}
                        onChange={(e) => setNewRestaurant(prev => ({ ...prev, fssai: e.target.value }))}
                        placeholder="10021011000432"
                        className="w-full px-3 py-2 bg-[#1a130f] border border-[#3d2b22] rounded-lg text-white font-mono text-xs focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold text-[#a89078] uppercase mb-1">
                        GST / Tax Rate (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        step="0.1"
                        value={newRestaurant.taxRate}
                        onChange={(e) => setNewRestaurant(prev => ({ ...prev, taxRate: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 bg-[#1a130f] border border-[#3d2b22] rounded-lg text-white text-xs focus:outline-none focus:border-[#d4af37]"
                      />
                      <p className="text-[9px] text-[#8c7355] mt-0.5">
                        Splits into CGST ({(newRestaurant.taxRate / 2).toFixed(1)}%) & SGST ({(newRestaurant.taxRate / 2).toFixed(1)}%)
                      </p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#a89078] uppercase mb-1">
                        Service Charge Rate (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        step="0.1"
                        value={newRestaurant.serviceChargeRate}
                        onChange={(e) => setNewRestaurant(prev => ({ ...prev, serviceChargeRate: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 bg-[#1a130f] border border-[#3d2b22] rounded-lg text-white text-xs focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>
                  </div>
                </div>

                {/* Bill Customization & Receipt Header Preview */}
                <div className="bg-[#120d0b] p-4 rounded-2xl border border-[#2e2019] space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#d4af37]">
                    <Receipt size={14} /> Bill Receipt Customization
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#a89078] uppercase mb-1">
                      Bill Footer / Thank You Note
                    </label>
                    <input
                      type="text"
                      value={newRestaurant.billFooter}
                      onChange={(e) => setNewRestaurant(prev => ({ ...prev, billFooter: e.target.value }))}
                      placeholder="THANK YOU FOR DINING WITH US"
                      className="w-full px-3 py-2 bg-[#1a130f] border border-[#3d2b22] rounded-lg text-white text-xs focus:outline-none focus:border-[#d4af37]"
                    />
                  </div>

                  {/* Live Bill Receipt Preview Box */}
                  <div className="bg-white p-3 rounded-xl border border-slate-300 font-mono text-[9px] text-slate-800 space-y-1 leading-tight shadow-xs select-none">
                    <div className="text-center border-b border-dashed border-slate-300 pb-1">
                      <p className="font-extrabold uppercase text-[#2c1810] text-[10px]">{newRestaurant.name || "Restaurant Name"}</p>
                      {newRestaurant.subtitle && (
                        <p className="text-[8px] text-slate-600 uppercase font-semibold">{newRestaurant.subtitle}</p>
                      )}
                      <p className="text-[7.5px] text-slate-500">{newRestaurant.address || "Physical Address"} {newRestaurant.phone ? `| Ph: ${newRestaurant.phone}` : ''}</p>
                      <p className="text-[7.5px] font-bold text-slate-700">GSTIN: {newRestaurant.gstin || 'N/A'} | FSSAI: {newRestaurant.fssai || 'N/A'}</p>
                    </div>
                    <div className="text-center pt-1 text-[8px] font-extrabold text-slate-700">
                      *** {newRestaurant.billFooter || "THANK YOU FOR DINING WITH US"} ***
                    </div>
                  </div>
                </div>

                {/* Handover Credentials Section */}
                <div className="bg-[#120d0b] p-4 rounded-2xl border border-[#2e2019] space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#d4af37]">
                    <Key size={14} /> Handover Admin Credentials
                  </div>
                  <p className="text-[11px] text-[#8c7355]">
                    These credentials will be provided to the restaurant owner so they can log into their dashboard.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-[#a89078] uppercase mb-1">
                        Admin User ID *
                      </label>
                      <input
                        type="text"
                        required
                        value={newRestaurant.adminUserId}
                        onChange={(e) => setNewRestaurant(prev => ({ ...prev, adminUserId: e.target.value }))}
                        className="w-full px-3 py-2 bg-[#1a130f] border border-[#3d2b22] rounded-lg text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#a89078] uppercase mb-1">
                        Admin Password *
                      </label>
                      <input
                        type="text"
                        required
                        value={newRestaurant.adminPassword}
                        onChange={(e) => setNewRestaurant(prev => ({ ...prev, adminPassword: e.target.value }))}
                        className="w-full px-3 py-2 bg-[#1a130f] border border-[#3d2b22] rounded-lg text-white font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Starter Menu Checkbox */}
                <label className="flex items-center gap-2 cursor-pointer bg-[#241a15] p-3 rounded-xl border border-[#3d2b22]">
                  <input
                    type="checkbox"
                    checked={newRestaurant.seedMenu}
                    onChange={(e) => setNewRestaurant(prev => ({ ...prev, seedMenu: e.target.checked }))}
                    className="w-4 h-4 accent-[#d4af37] rounded"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-white">Pre-populate Starter Menu & Tables</span>
                    <p className="text-[10px] text-[#8c7355]">
                      Instantly adds standard categories (Starters, Mains, Breads, Drinks) & sample dishes so the restaurant can test immediately.
                    </p>
                  </div>
                </label>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2e2019]">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-[#3d2b22] text-xs text-[#a89078] hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b39023] text-[#160f0c] font-bold text-xs shadow-md shadow-[#d4af37]/20 hover:brightness-110 disabled:opacity-50"
                  >
                    {isSubmitting ? "Creating & Initializing..." : "Create Restaurant & Generate Handover"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Handover Pack Modal */}
      <AnimatePresence>
        {handoverModalRestaurant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#18110e] border border-[#d4af37] rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-5 my-8"
            >
              <div className="flex items-center justify-between border-b border-[#2e2019] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-serif font-bold text-white">
                      Restaurant Handover Package
                    </h3>
                    <p className="text-xs text-[#a89078]">{handoverModalRestaurant.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setHandoverModalRestaurant(null)}
                  className="text-[#a89078] hover:text-white text-sm p-1 rounded"
                >
                  ✕
                </button>
              </div>

              {/* Ready-to-copy summary message */}
              <div className="bg-[#120d0b] p-4 rounded-2xl border border-[#2e2019] space-y-4">
                <div className="text-xs font-semibold text-[#d4af37] uppercase tracking-wider">
                  Handover URLs & Credentials
                </div>

                {/* QR / Guest Link */}
                <div className="space-y-1">
                  <span className="text-[10px] text-[#8c7355] uppercase font-bold">1. Customer Menu / QR URL</span>
                  <div className="flex items-center justify-between bg-[#1b1410] p-2.5 rounded-xl border border-[#33221b]">
                    <span className="font-mono text-xs text-blue-400 truncate">
                      {window.location.origin}/r/{handoverModalRestaurant.slug}
                    </span>
                    <button
                      onClick={() => copyToClipboard(`${window.location.origin}/r/${handoverModalRestaurant.slug}`, "modal_cust")}
                      className="ml-2 text-xs text-[#d4af37] hover:underline shrink-0"
                    >
                      {copiedKey === "modal_cust" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                {/* Admin Portal Link */}
                <div className="space-y-1">
                  <span className="text-[10px] text-[#8c7355] uppercase font-bold">2. Restaurant Management Portal URL</span>
                  <div className="flex items-center justify-between bg-[#1b1410] p-2.5 rounded-xl border border-[#33221b]">
                    <span className="font-mono text-xs text-[#e5c185] truncate">
                      {window.location.origin}/r/{handoverModalRestaurant.slug}/admin
                    </span>
                    <button
                      onClick={() => copyToClipboard(`${window.location.origin}/r/${handoverModalRestaurant.slug}/admin`, "modal_admin")}
                      className="ml-2 text-xs text-[#d4af37] hover:underline shrink-0"
                    >
                      {copiedKey === "modal_admin" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                {/* Login Credentials */}
                <div className="bg-[#1b1410] p-3 rounded-xl border border-[#33221b] grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-[#8c7355] uppercase block font-bold">User ID</span>
                    <span className="font-mono text-white font-bold">{handoverModalRestaurant.adminUserId}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#8c7355] uppercase block font-bold">Password</span>
                    <span className="font-mono text-white font-bold">{handoverModalRestaurant.adminPassword}</span>
                  </div>
                </div>
              </div>

              {/* Complete WhatsApp / Email Share Template */}
              {(() => {
                const messageText = `*Welcome to foQR Multi-Restaurant Platform!*
Restaurant: ${handoverModalRestaurant.name}

📱 *Customer QR & Digital Menu Link:*
${window.location.origin}/r/${handoverModalRestaurant.slug}

💻 *Restaurant Owner / Staff Management Portal:*
${window.location.origin}/r/${handoverModalRestaurant.slug}/admin

🔑 *Your Login Credentials:*
User ID: ${handoverModalRestaurant.adminUserId}
Password: ${handoverModalRestaurant.adminPassword}

_You can now log in, update items, oversee live table orders, and print table QR codes!_`;

                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#c9b89c]">Shareable Handover Note</span>
                      <button
                        onClick={() => copyToClipboard(messageText, "modal_full_msg")}
                        className="text-xs text-[#d4af37] hover:underline flex items-center gap-1"
                      >
                        {copiedKey === "modal_full_msg" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        {copiedKey === "modal_full_msg" ? "Copied to Clipboard!" : "Copy Complete Note"}
                      </button>
                    </div>

                    <pre className="p-3 bg-[#120d0b] border border-[#2e2019] rounded-xl text-[11px] text-[#a89078] whitespace-pre-wrap font-sans max-h-36 overflow-y-auto">
                      {messageText}
                    </pre>

                    <div className="flex items-center gap-3 pt-2">
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(messageText)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition-all"
                      >
                        <MessageSquare size={15} />
                        Share Directly on WhatsApp
                      </a>

                      <button
                        onClick={() => handleImpersonateRestaurant(handoverModalRestaurant)}
                        className="flex-1 flex items-center justify-center gap-2 bg-[#d4af37] text-[#160f0c] font-bold py-2.5 rounded-xl text-xs hover:brightness-110 transition-all shadow-md"
                      >
                        <ExternalLink size={15} />
                        Launch Dashboard Now
                      </button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: Edit Restaurant Profile Modal */}
      <AnimatePresence>
        {isEditModalOpen && editingRestaurant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#18110e] border border-[#d4af37]/40 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 my-8"
            >
              <div className="flex items-center justify-between border-b border-[#2e2019] pb-4">
                <h3 className="text-base font-serif font-bold text-white">
                  Edit Restaurant: {editingRestaurant.name}
                </h3>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-[#a89078] hover:text-white text-sm p-1 rounded"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUpdateRestaurant} className="space-y-4 text-xs max-h-[80vh] overflow-y-auto pr-1">
                <div>
                  <label className="block text-[#c9b89c] font-bold mb-1">Restaurant Name *</label>
                  <input
                    type="text"
                    required
                    value={editingRestaurant.name}
                    onChange={(e) => setEditingRestaurant({ ...editingRestaurant, name: e.target.value })}
                    className="w-full px-3 py-2 bg-[#241a15] border border-[#3d2b22] rounded-xl text-white focus:outline-none focus:border-[#d4af37]"
                  />
                </div>

                <div>
                  <label className="block text-[#c9b89c] font-bold mb-1">Tagline / Subtitle</label>
                  <input
                    type="text"
                    value={editingRestaurant.subtitle || ""}
                    onChange={(e) => setEditingRestaurant({ ...editingRestaurant, subtitle: e.target.value })}
                    className="w-full px-3 py-2 bg-[#241a15] border border-[#3d2b22] rounded-xl text-white focus:outline-none focus:border-[#d4af37]"
                  />
                </div>

                {/* Imagery: Cover Photo & Logo */}
                <div className="bg-[#120d0b] p-3.5 rounded-xl border border-[#2e2019] space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#d4af37]">
                    <ImageIcon size={14} /> Restaurant Visuals & Imagery
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#a89078] uppercase mb-1">
                      Restaurant Photo / Cover Image URL
                    </label>
                    <div className="flex items-center gap-2.5">
                      <input
                        type="url"
                        value={editingRestaurant.coverUrl || ""}
                        onChange={(e) => setEditingRestaurant({ ...editingRestaurant, coverUrl: e.target.value })}
                        placeholder="https://images.unsplash.com/... or Google Drive URL"
                        className="w-full px-3 py-2 bg-[#1a130f] border border-[#3d2b22] rounded-lg text-white text-xs focus:outline-none focus:border-[#d4af37]"
                      />
                      {editingRestaurant.coverUrl && (
                        <img
                          src={normalizeImageUrl(editingRestaurant.coverUrl)}
                          alt="Cover Preview"
                          className="w-12 h-8 object-cover rounded-lg border border-[#3d2b22] bg-[#1a130f] shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#a89078] uppercase mb-1">
                      Restaurant Logo URL
                    </label>
                    <div className="flex items-center gap-2.5">
                      <input
                        type="url"
                        value={editingRestaurant.logoUrl || ""}
                        onChange={(e) => setEditingRestaurant({ ...editingRestaurant, logoUrl: e.target.value })}
                        placeholder="https://example.com/logo.png"
                        className="w-full px-3 py-2 bg-[#1a130f] border border-[#3d2b22] rounded-lg text-white text-xs focus:outline-none focus:border-[#d4af37]"
                      />
                      {editingRestaurant.logoUrl && (
                        <img
                          src={normalizeImageUrl(editingRestaurant.logoUrl)}
                          alt="Logo Preview"
                          className="w-8 h-8 object-contain rounded-lg border border-[#3d2b22] bg-white p-0.5 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact: Phone & Email */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#c9b89c] font-bold mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={editingRestaurant.phone || ""}
                      onChange={(e) => setEditingRestaurant({ ...editingRestaurant, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-[#241a15] border border-[#3d2b22] rounded-xl text-white focus:outline-none focus:border-[#d4af37]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#c9b89c] font-bold mb-1">Email Address</label>
                    <input
                      type="email"
                      value={editingRestaurant.email || ""}
                      onChange={(e) => setEditingRestaurant({ ...editingRestaurant, email: e.target.value })}
                      className="w-full px-3 py-2 bg-[#241a15] border border-[#3d2b22] rounded-xl text-white focus:outline-none focus:border-[#d4af37]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[#c9b89c] font-bold mb-1">Physical Address</label>
                  <input
                    type="text"
                    value={editingRestaurant.address || ""}
                    onChange={(e) => setEditingRestaurant({ ...editingRestaurant, address: e.target.value })}
                    className="w-full px-3 py-2 bg-[#241a15] border border-[#3d2b22] rounded-xl text-white focus:outline-none focus:border-[#d4af37]"
                  />
                </div>

                {/* Legal & Taxes */}
                <div className="bg-[#120d0b] p-3.5 rounded-xl border border-[#2e2019] space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#d4af37]">
                    <FileText size={14} /> Legal & Taxation
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-[#a89078] uppercase mb-1">GSTIN Number</label>
                      <input
                        type="text"
                        value={editingRestaurant.gstin || ""}
                        onChange={(e) => setEditingRestaurant({ ...editingRestaurant, gstin: e.target.value })}
                        className="w-full px-3 py-2 bg-[#1a130f] border border-[#3d2b22] rounded-lg text-white font-mono uppercase text-xs focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#a89078] uppercase mb-1">FSSAI License</label>
                      <input
                        type="text"
                        value={editingRestaurant.fssai || ""}
                        onChange={(e) => setEditingRestaurant({ ...editingRestaurant, fssai: e.target.value })}
                        className="w-full px-3 py-2 bg-[#1a130f] border border-[#3d2b22] rounded-lg text-white font-mono text-xs focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-[#a89078] uppercase mb-1">GST / Tax (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={editingRestaurant.taxRate ?? 5}
                        onChange={(e) => setEditingRestaurant({ ...editingRestaurant, taxRate: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-[#1a130f] border border-[#3d2b22] rounded-lg text-white focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#a89078] uppercase mb-1">Service Charge (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={editingRestaurant.serviceChargeRate ?? 0}
                        onChange={(e) => setEditingRestaurant({ ...editingRestaurant, serviceChargeRate: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-[#1a130f] border border-[#3d2b22] rounded-lg text-white focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>
                  </div>
                </div>

                {/* Bill Customization */}
                <div className="bg-[#120d0b] p-3.5 rounded-xl border border-[#2e2019] space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#d4af37]">
                    <Receipt size={14} /> Bill Receipt Customization
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#a89078] uppercase mb-1">Bill Footer / Thank You Note</label>
                    <input
                      type="text"
                      value={editingRestaurant.billFooter || ""}
                      onChange={(e) => setEditingRestaurant({ ...editingRestaurant, billFooter: e.target.value })}
                      placeholder="THANK YOU FOR DINING WITH US"
                      className="w-full px-3 py-2 bg-[#1a130f] border border-[#3d2b22] rounded-lg text-white text-xs focus:outline-none focus:border-[#d4af37]"
                    />
                  </div>

                  {/* Live Receipt Preview */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-300 font-mono text-[8.5px] text-slate-800 space-y-1 leading-tight shadow-xs select-none">
                    <div className="text-center border-b border-dashed border-slate-300 pb-1">
                      <p className="font-extrabold uppercase text-[#2c1810] text-[9.5px]">{editingRestaurant.name || "Restaurant Name"}</p>
                      {editingRestaurant.subtitle && (
                        <p className="text-[7.5px] text-slate-600 uppercase font-semibold">{editingRestaurant.subtitle}</p>
                      )}
                      <p className="text-[7px] text-slate-500">{editingRestaurant.address || "Physical Address"} {editingRestaurant.phone ? `| Ph: ${editingRestaurant.phone}` : ''}</p>
                      <p className="text-[7px] font-bold text-slate-700">GSTIN: {editingRestaurant.gstin || 'N/A'} | FSSAI: {editingRestaurant.fssai || 'N/A'}</p>
                    </div>
                    <div className="text-center pt-1 text-[7.5px] font-extrabold text-slate-700">
                      *** {editingRestaurant.billFooter || "THANK YOU FOR DINING WITH US"} ***
                    </div>
                  </div>
                </div>

                {/* Admin Credentials */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[#c9b89c] font-bold mb-1">Admin User ID</label>
                    <input
                      type="text"
                      required
                      value={editingRestaurant.adminUserId}
                      onChange={(e) => setEditingRestaurant({ ...editingRestaurant, adminUserId: e.target.value })}
                      className="w-full px-3 py-2 bg-[#241a15] border border-[#3d2b22] rounded-xl text-white font-mono focus:outline-none focus:border-[#d4af37]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#c9b89c] font-bold mb-1">Admin Password</label>
                    <input
                      type="text"
                      required
                      value={editingRestaurant.adminPassword}
                      onChange={(e) => setEditingRestaurant({ ...editingRestaurant, adminPassword: e.target.value })}
                      className="w-full px-3 py-2 bg-[#241a15] border border-[#3d2b22] rounded-xl text-white font-mono focus:outline-none focus:border-[#d4af37]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2e2019]">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-[#3d2b22] text-[#a89078]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#d4af37] text-[#160f0c] font-bold hover:brightness-110"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
