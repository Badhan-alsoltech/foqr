import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { seedDummyData, db, handleFirestoreError, OperationType } from "../firebase";
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, doc, updateDoc, increment } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import { Search, ShoppingBag, Menu as MenuIcon, X, Shield, Plus, Minus, Trash2, CheckCircle2, Phone, User as UserIcon, ChevronRight, Sparkles, Flame, Eye, LayoutList, LayoutGrid, Filter, RotateCcw, AlertCircle } from "lucide-react";
import { cn, normalizeImageUrl } from "../lib/utils";

interface Category {
  id: string;
  name: string;
  order: number;
}

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  categoryId: string;
  imageUrl: string;
  isAvailable: boolean;
  isSpicy: boolean;
  isVegetarian: boolean;
  tags?: string[];
  recommendedItemIds?: string[];
  isSignature?: boolean;
  views?: number;
}

interface CartItem {
  item: MenuItem;
  quantity: number;
}

interface Table {
  id: string;
  name: string;
  tableNumber: string | number;
  location?: string;
}

// Authentic Indian Veg / Non-Veg Indicator Symbol
function FoodTypeBadge({ isVegetarian }: { isVegetarian: boolean }) {
  return (
    <span 
      className={cn(
        "inline-flex items-center justify-center w-4 h-4 border-2 rounded-[4px] bg-white p-[2px] shrink-0 shadow-sm",
        isVegetarian ? "border-emerald-600" : "border-rose-600"
      )} 
      title={isVegetarian ? "Vegetarian" : "Non-Vegetarian"}
    >
      <span className={cn("w-2 h-2 rounded-full", isVegetarian ? "bg-emerald-600" : "bg-rose-600")} />
    </span>
  );
}

export default function Menu() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const hasTableSelected = Boolean(tableId);
  const tableParam = tableId || null;

  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<MenuItem | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  
  // Advanced Dietary Filters
  const [vegOnlyFilter, setVegOnlyFilter] = useState(false);
  const [nonVegOnlyFilter, setNonVegOnlyFilter] = useState(false);
  const [spicyFilter, setSpicyFilter] = useState(false);

  // Cart & Order State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [tableNumber, setTableNumber] = useState(tableParam);
  const [tableName, setTableName] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);

  const [settings, setSettings] = useState({
    spicyLabel: "Spicy",
    vegetarianLabel: "Vegetarian"
  });

  useEffect(() => {
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
    }, 2000);

    let isSeedingTriggered = false;

    const catQuery = query(collection(db, "categories"), orderBy("order", "asc"));
    const unsubscribeCats = onSnapshot(catQuery, (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      setCategories(cats);
      if (cats.length === 0 && !isSeedingTriggered) {
        isSeedingTriggered = true;
        seedDummyData().catch(err => console.error("Auto seeding failed:", err));
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "categories");
      setLoading(false);
    });

    const itemQuery = query(collection(db, "menuItems"));
    const unsubscribeItems = onSnapshot(itemQuery, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem));
      setMenuItems(items);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "menuItems");
      setLoading(false);
    });

    const tableQuery = query(collection(db, "tables"));
    const unsubscribeTables = onSnapshot(tableQuery, (snapshot) => {
      const fetchedTables = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Table));
      setTables(fetchedTables);
      const matched = fetchedTables.find(t => String(t.tableNumber) === String(tableParam) || t.id === tableParam);
      if (matched) {
        setTableName(matched.name);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "tables");
    });

    // Track scan once per browser session per table to avoid duplicate counts on page refresh
    const trackScan = async () => {
      const targetTable = tableParam || "1";
      const sessionKey = `foqr_scan_tracked_${targetTable}`;
      
      // Skip if already tracked during this browser session
      if (sessionStorage.getItem(sessionKey)) {
        return;
      }

      try {
        await addDoc(collection(db, "scans"), {
          tableNumber: targetTable,
          qrId: targetTable,
          timestamp: serverTimestamp(),
          userAgent: navigator.userAgent
        });
        sessionStorage.setItem(sessionKey, "true");
      } catch (e) {
        console.error("Scan tracking failed", e);
      }
    };
    trackScan();

    const unsubscribeSettings = onSnapshot(doc(db, "settings", "general"), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as any);
      }
    });

    const ordersQuery = query(collection(db, "orderRequests"));
    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      const fetchedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActiveOrders(fetchedOrders);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "orderRequests");
    });

    return () => {
      clearTimeout(loadingTimeout);
      unsubscribeCats();
      unsubscribeItems();
      unsubscribeTables();
      unsubscribeSettings();
      unsubscribeOrders();
    };
  }, [tableParam]);

  const displayTableName = hasTableSelected
    ? (tableName || 
       tables.find(t => String(t.tableNumber) === String(tableNumber) || t.id === tableNumber)?.name || 
       (String(tableNumber).toLowerCase().includes("table") ? tableNumber : `Table ${tableNumber}`))
    : "No Table Selected";

  const targetTableClean = (tableName || displayTableName || tableNumber || tableParam || "").toString().toLowerCase().replace("table", "").trim();

  const activeTableOrder = activeOrders.find(o => {
    if (o.status !== "pending" && o.status !== "approved") return false;
    const orderTableClean = (o.tableNumber || "").toString().toLowerCase().replace("table", "").trim();
    return orderTableClean === targetTableClean || o.tableNumber === tableName || o.tableNumber === displayTableName;
  });

  const isTableOccupied = Boolean(activeTableOrder);

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory ? item.categoryId === selectedCategory : true;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesVeg = vegOnlyFilter ? item.isVegetarian : true;
    const matchesNonVeg = nonVegOnlyFilter ? !item.isVegetarian : true;
    const matchesSpicy = spicyFilter ? item.isSpicy : true;
    return matchesCategory && matchesSearch && matchesVeg && matchesNonVeg && matchesSpicy && item.isAvailable;
  });

  const categoriesToDisplay = selectedCategory
    ? categories.filter(c => c.id === selectedCategory)
    : categories;

  const activeFilterCount = (selectedCategory ? 1 : 0) + (vegOnlyFilter ? 1 : 0) + (nonVegOnlyFilter ? 1 : 0) + (spicyFilter ? 1 : 0);

  const resetAllFilters = () => {
    setSelectedCategory(null);
    setVegOnlyFilter(false);
    setNonVegOnlyFilter(false);
    setSpicyFilter(false);
    setSearchQuery("");
  };

  const handleViewDetails = async (item: MenuItem) => {
    setViewingItem(item);
    try {
      const itemRef = doc(db, "menuItems", item.id);
      await updateDoc(itemRef, {
        views: increment(1)
      });
    } catch (e) {
      console.error("Failed to increment views", e);
    }
  };

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) {
        return prev.map(i => i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.item.id === itemId) {
        const newQty = i.quantity + delta;
        return newQty > 0 ? { ...i, quantity: newQty } : null;
      }
      return i;
    }).filter(Boolean) as CartItem[]);
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(i => i.item.id !== itemId));
  };

  const cartTotal = cart.reduce((sum, i) => sum + (i.item.price * i.quantity), 0);
  const totalItemCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/\D/g, "").slice(0, 10);
    setCustomerPhone(cleaned);
    if (cleaned.length > 0 && cleaned.length !== 10) {
      setPhoneError("Phone number must be exactly 10 digits");
    } else {
      setPhoneError("");
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasTableSelected) {
      alert("No table selected! Ordering is disabled. Please scan your Table QR Code to place an order.");
      return;
    }
    if (isTableOccupied) {
      alert(`Table ${displayTableName} is currently occupied with an active order in progress. You cannot place a new order until the current table session is completed by staff.`);
      return;
    }
    if (!customerName.trim()) {
      alert("Please enter your name.");
      return;
    }
    if (customerPhone.length !== 10) {
      setPhoneError("Please enter a valid 10-digit mobile number");
      return;
    }
    if (cart.length === 0) return;

    setIsSubmittingOrder(true);
    try {
      await addDoc(collection(db, "orderRequests"), {
        customerName: customerName.trim(),
        customerPhone: `+91 ${customerPhone}`,
        tableNumber: displayTableName,
        items: cart.map(c => ({
          id: c.item.id,
          name: c.item.name,
          price: c.item.price,
          quantity: c.quantity,
          subtotal: c.item.price * c.quantity
        })),
        totalAmount: cartTotal,
        status: "pending",
        createdAt: serverTimestamp()
      });
      setOrderSuccess(true);
      setCart([]);
    } catch (err) {
      console.error("Failed to submit order request:", err);
      alert("Failed to submit order request. Please try again.");
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#140c0a] flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-[#d4af37] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-[#d4af37] font-serif italic text-lg tracking-wider">Crafting your menu experience...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#f7f2eb] text-[#2c1810] font-sans flex flex-col justify-between overflow-x-hidden">
      {/* Full-Width Hero Header */}
      <div className="relative w-full bg-gradient-to-b from-[#140c0a] via-[#221612] to-[#140c0a] text-[#fdfaf6] pt-12 pb-16 px-4 sm:px-8 shadow-2xl border-b border-[#d4af37]/30 overflow-hidden">
        <div className="absolute top-[-40%] left-[50%] -translate-x-1/2 w-[1000px] h-[600px] bg-[#d4af37]/15 rounded-full blur-[140px] pointer-events-none" />
        
        <div className="relative w-full text-center space-y-3 z-10">
          <div className="inline-flex items-center gap-2 bg-[#d4af37]/20 border border-[#d4af37]/50 px-4 py-1.5 rounded-full backdrop-blur-md">
            <Sparkles size={14} className="text-[#d4af37] animate-pulse" />
            <span className="text-[11px] font-bold tracking-[0.25em] uppercase text-[#e5c185]">
              {displayTableName}
            </span>
          </div>

          <div className="flex flex-col items-center gap-2">
            {(settings as any).logoUrl && (
              <img 
                src={normalizeImageUrl((settings as any).logoUrl)} 
                alt="Restaurant Logo" 
                className="h-14 sm:h-18 max-w-[200px] object-contain drop-shadow-lg rounded-lg"
                referrerPolicy="no-referrer"
              />
            )}
            <h1 className="font-serif font-extrabold text-4xl sm:text-6xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-[#fdfaf6] to-[#d4af37]">
              {(settings as any).restaurantName || "foQR"}
            </h1>
          </div>

          <p className="text-xs sm:text-sm text-[#bcaaa0] max-w-xl mx-auto font-light leading-relaxed">
            {(settings as any).restaurantSubtitle || "Handcrafted dishes, authentic flavors & culinary excellence at your fingertips."}
          </p>

          {!hasTableSelected ? (
            <div className="bg-amber-500/20 border-2 border-amber-500/60 text-amber-200 p-4 rounded-2xl backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm font-medium shadow-xl max-w-xl mx-auto mt-4 text-left">
              <div className="flex items-center gap-3">
                <AlertCircle className="text-amber-400 shrink-0" size={24} />
                <div>
                  <p className="font-extrabold text-amber-300 text-sm">No Table Selected</p>
                  <p className="text-[11px] text-amber-200/90 leading-tight">Please scan your Table QR code to place an order. Browsing mode active.</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-amber-500/30 border border-amber-400/50 rounded-lg text-[10px] uppercase font-bold text-amber-300 shrink-0 self-start sm:self-center">
                VIEW ONLY
              </span>
            </div>
          ) : isTableOccupied ? (
            <div className="bg-amber-500/20 border-2 border-amber-500/60 text-amber-200 p-4 rounded-2xl backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm font-medium shadow-xl animate-pulse max-w-xl mx-auto mt-4 text-left">
              <div className="flex items-center gap-3">
                <AlertCircle className="text-amber-400 shrink-0" size={24} />
                <div>
                  <p className="font-extrabold text-amber-300 text-sm">Table {displayTableName} is Occupied</p>
                  <p className="text-[11px] text-amber-200/90 leading-tight">An active order is currently in progress for this table. New orders cannot be placed until staff completes the current order session.</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-amber-500/30 border border-amber-400/50 rounded-lg text-[10px] uppercase font-bold text-amber-300 shrink-0 self-start sm:self-center">
                OCCUPIED
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Prominent Full-Width High-Contrast Search & Control Dock */}
      <div className="w-full px-3 sm:px-6 lg:px-8 -mt-8 relative z-30">
        <div className="bg-[#140c0a] rounded-2xl p-2 sm:p-3.5 border-2 border-[#d4af37] shadow-[0_20px_40px_rgba(0,0,0,0.4)] flex items-center justify-between gap-1.5 sm:gap-3 text-white">
          {/* Menu Drawer Button */}
          <button 
            onClick={() => setIsMenuOpen(true)} 
            className="p-2 sm:p-3 bg-[#2a1b16] hover:bg-[#3d2720] border border-[#d4af37]/40 rounded-xl text-[#d4af37] transition-all shadow-inner shrink-0"
            title="Menu Drawer"
          >
            <MenuIcon size={18} />
          </button>

          {/* Filter Modal Trigger Button */}
          <button
            onClick={() => setIsFilterOpen(true)}
            className={cn(
              "p-2 sm:px-3 sm:py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border border-[#d4af37]/40 shadow-sm",
              activeFilterCount > 0 
                ? "bg-[#d4af37] text-[#140c0a]" 
                : "bg-[#251713] text-[#d4af37] hover:bg-[#38231c]"
            )}
            title="Filter Categories & Dietary Options"
          >
            <Filter size={16} />
            <span className="hidden sm:inline">Filter</span>
            {activeFilterCount > 0 && (
              <span className="bg-[#140c0a] text-[#d4af37] text-[10px] font-extrabold px-1.5 py-0.2 rounded-full min-w-[16px] text-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* View Mode Toggle Button */}
          <div className="flex bg-[#251713] p-0.5 sm:p-1 rounded-xl border border-[#4a3229] shrink-0">
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-1.5 sm:p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                viewMode === "list" ? "bg-[#d4af37] text-[#140c0a] shadow" : "text-[#a8907a] hover:text-white"
              )}
              title="List View"
            >
              <LayoutList size={16} />
              <span className="hidden md:inline">List View</span>
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-1.5 sm:p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                viewMode === "grid" ? "bg-[#d4af37] text-[#140c0a] shadow" : "text-[#a8907a] hover:text-white"
              )}
              title="Grid View"
            >
              <LayoutGrid size={16} />
              <span className="hidden md:inline">Grid</span>
            </button>
          </div>

          {/* Search Input - Elastic min-w-0 */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5c4033]" size={16} />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border-2 border-[#d4af37]/60 rounded-xl py-2 pl-9 pr-2 sm:py-2.5 sm:pl-10 sm:pr-4 text-xs sm:text-sm text-[#140c0a] font-medium placeholder-[#7a6050] focus:outline-none focus:border-[#d4af37] transition-all shadow-inner truncate"
            />
          </div>

          {/* Cart Button */}
          <button 
            onClick={() => setIsCartOpen(true)} 
            className="relative bg-gradient-to-r from-[#d4af37] via-[#e5c185] to-[#b8860b] hover:brightness-110 text-[#140c0a] px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-extrabold text-xs transition-all shadow-lg flex items-center gap-1.5 shrink-0 border border-white/30"
          >
            <ShoppingBag size={16} />
            <span className="hidden sm:inline">Cart</span>
            <span className="bg-[#140c0a] text-[#d4af37] text-[10px] sm:text-[11px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
              {totalItemCount}
            </span>
          </button>
        </div>
      </div>

      {/* Full-Width Main Dishes Section */}
      <main className="w-full px-3 sm:px-6 lg:px-8 mt-6 pb-20 space-y-10">
        {categoriesToDisplay.map((category) => {
          const categoryItems = filteredItems.filter(item => item.categoryId === category.id);
          if (categoryItems.length === 0) return null;

          return (
            <section key={category.id} className="space-y-3.5">
              {/* Category Header Bar */}
              <div className="flex items-center gap-3 pt-1">
                <h2 className="font-serif font-extrabold text-xl sm:text-2xl text-[#140c0a] tracking-tight">
                  {category.name}
                </h2>
                <div className="flex-1 h-px bg-gradient-to-r from-[#d4af37]/60 via-[#e5d5c5] to-transparent" />
                <span className="text-[11px] font-bold text-[#8b7355] bg-white/90 px-2.5 py-0.5 rounded-full border border-[#e8ded3]">
                  {categoryItems.length} Dishes
                </span>
              </div>

              {/* 3-COLUMN COMPACT LIST VIEW across full width */}
              {viewMode === "list" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                  {categoryItems.map((item, itemIdx) => {
                    const cartEntry = cart.find(c => c.item.id === item.id);
                    const isSignature = item.isSignature || itemIdx === 0;

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: itemIdx * 0.02 }}
                        className={cn(
                          "rounded-xl p-3.5 sm:p-4 transition-all duration-200 flex flex-col justify-between border shadow-sm hover:shadow-md group relative",
                          isSignature 
                            ? "bg-gradient-to-r from-[#1c120f] via-[#261915] to-[#160f0d] text-white border-[#d4af37]/40" 
                            : "bg-white text-[#140c0a] border-[#e8ded3] hover:border-[#d4af37]/50"
                        )}
                      >
                        <div className="flex justify-between items-start gap-3">
                          {/* Item Text Details */}
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <FoodTypeBadge isVegetarian={item.isVegetarian} />
                              <h3 
                                onClick={() => handleViewDetails(item)}
                                className={cn(
                                  "font-serif font-extrabold text-sm sm:text-base cursor-pointer transition-colors leading-tight",
                                  isSignature ? "text-white group-hover:text-[#d4af37]" : "text-[#140c0a] group-hover:text-[#b8860b]"
                                )}
                              >
                                {item.name}
                              </h3>
                              {item.isSpicy && (
                                <span className="bg-red-600/90 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full flex items-center gap-0.5 shrink-0">
                                  <Flame size={9} /> Spicy
                                </span>
                              )}
                              {isSignature && (
                                <span className="bg-[#d4af37] text-[#140c0a] text-[8px] font-extrabold px-2 py-0.2 rounded-full uppercase tracking-wider shrink-0">
                                  SPECIAL
                                </span>
                              )}
                            </div>

                            <p className={cn("text-[11px] leading-snug line-clamp-2", isSignature ? "text-[#c2b2a6]" : "text-[#6e5849]")}>
                              {item.description}
                            </p>

                            <div className="flex items-center gap-2 pt-0.5">
                              <span className={cn("text-lg sm:text-2xl font-black font-mono tracking-tight", isSignature ? "text-[#d4af37]" : "text-[#140c0a]")}>
                                ₹{item.price}
                              </span>
                              {item.views !== undefined && item.views > 0 && (
                                <span className={cn("text-[10px] flex items-center gap-1 font-medium", isSignature ? "text-[#a8907a]" : "text-[#8b7355]")}>
                                  <Eye size={10} /> {item.views}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Right Image Thumbnail */}
                          {item.imageUrl && (
                            <img 
                              src={item.imageUrl} 
                              alt={item.name}
                              onClick={() => handleViewDetails(item)}
                              className="w-16 h-16 sm:w-18 sm:h-18 rounded-lg object-cover shadow-sm cursor-pointer hover:scale-105 transition-transform shrink-0 border border-black/10" 
                              referrerPolicy="no-referrer"
                            />
                          )}
                        </div>

                        {/* Bottom Row Actions */}
                        <div className="mt-3 pt-2 flex items-center justify-between border-t border-dashed border-[#e5d5c5]/40">
                          <button
                            onClick={() => handleViewDetails(item)}
                            className={cn("text-[11px] font-semibold hover:underline", isSignature ? "text-[#d4af37]" : "text-[#8b7355]")}
                          >
                            Details
                          </button>

                          {cartEntry ? (
                            <div className={cn(
                              "flex items-center rounded-lg p-0.5 border shadow-sm",
                              isSignature 
                                ? "bg-[#281a16] border-[#d4af37]/40 text-white" 
                                : "bg-[#fdfaf6] border-[#e5d5c5] text-[#140c0a]"
                            )}>
                              <button 
                                onClick={() => updateQuantity(item.id, -1)} 
                                className="p-1 hover:text-[#d4af37] transition-colors"
                              >
                                <Minus size={12} />
                              </button>
                              <span className="text-xs font-bold px-2.5 font-mono">{cartEntry.quantity}</span>
                              <button 
                                onClick={() => updateQuantity(item.id, 1)} 
                                className="p-1 hover:text-[#d4af37] transition-colors"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => addToCart(item)}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow flex items-center gap-1 active:scale-95 whitespace-nowrap",
                                isSignature 
                                  ? "bg-[#d4af37] text-[#140c0a] hover:bg-yellow-400" 
                                  : "bg-[#140c0a] text-white hover:bg-[#2c1810]"
                              )}
                            >
                              <Plus size={12} /> Add
                            </button>
                          )}
                        </div>

                        {/* Recommended Best Combo Items for this Card (Only shown after item is added to cart) */}
                        {(() => {
                          if (!cartEntry) return null;

                          const cardRecommendations = (item.recommendedItemIds || [])
                            .map(id => menuItems.find(m => m.id === id))
                            .filter((rec): rec is MenuItem => Boolean(rec))
                            .filter(rec => !cart.some(c => c.item.id === rec.id));

                          if (cardRecommendations.length === 0) return null;

                          return (
                            <div className="mt-2.5 pt-2 border-t border-dashed border-[#e5d5c5]/40 space-y-1.5">
                              <div className="flex items-center gap-1 text-[10px] font-bold text-[#b8860b]">
                                <Sparkles size={11} className="text-[#d4af37]" />
                                <span>Pairs Best With (Best Combo):</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {cardRecommendations.map(rec => (
                                  <div 
                                    key={rec.id} 
                                    className={cn(
                                      "flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg border text-[10px] font-medium w-full sm:w-auto",
                                      isSignature ? "bg-[#281a16] border-[#d4af37]/30 text-white" : "bg-[#fdfaf6] border-[#e5d5c5] text-[#2c1810]"
                                    )}
                                  >
                                    <div className="flex items-center gap-1.5 truncate">
                                      <FoodTypeBadge isVegetarian={rec.isVegetarian} />
                                      <span className="font-bold truncate">{rec.name}</span>
                                      <span className="text-[#b8860b] font-mono text-[10px]">₹{rec.price}</span>
                                    </div>
                                    <button
                                      onClick={() => addToCart(rec)}
                                      className="px-2 py-0.5 bg-[#140c0a] text-[#d4af37] rounded-md text-[9px] font-bold hover:bg-[#2c1810] transition-colors shrink-0 flex items-center gap-0.5 shadow-xs"
                                    >
                                      <Plus size={10} /> Add
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                /* 4-COLUMN COMPACT GRID VIEW */
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                  {categoryItems.map((item, itemIdx) => {
                    const cartEntry = cart.find(c => c.item.id === item.id);
                    const isSignature = item.isSignature || itemIdx === 0;

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: itemIdx * 0.03 }}
                        className={cn(
                          "rounded-2xl p-3.5 transition-all duration-200 flex flex-col justify-between relative group border shadow-sm hover:shadow-md",
                          isSignature 
                            ? "bg-gradient-to-br from-[#1c120f] via-[#261915] to-[#120b09] text-white border-[#d4af37]/40 shadow-md" 
                            : "bg-white text-[#140c0a] border-[#e8ded3] hover:border-[#d4af37]/40"
                        )}
                      >
                        <div>
                          {item.imageUrl && (
                            <div className="relative w-full h-32 rounded-xl overflow-hidden mb-2.5 border border-black/10">
                              <img 
                                src={normalizeImageUrl(item.imageUrl)} 
                                alt={item.name} 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                              
                              <div className="absolute top-2 left-2 flex items-center gap-1">
                                <FoodTypeBadge isVegetarian={item.isVegetarian} />
                                {item.isSpicy && (
                                  <span className="bg-red-600/90 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                                    <Flame size={9} />
                                  </span>
                                )}
                              </div>

                              <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center text-white">
                                <span className="text-base sm:text-lg font-black font-mono tracking-tight drop-shadow-md">
                                  ₹{item.price}
                                </span>
                              </div>
                            </div>
                          )}

                          <div className="flex justify-between items-start gap-1 mb-1">
                            <h3 
                              onClick={() => handleViewDetails(item)}
                              className={cn(
                                "font-serif font-extrabold text-sm cursor-pointer transition-colors leading-tight line-clamp-1",
                                isSignature ? "text-white group-hover:text-[#d4af37]" : "text-[#140c0a] group-hover:text-[#b8860b]"
                              )}
                            >
                              {item.name}
                            </h3>
                          </div>

                          <p className={cn("text-[11px] leading-snug line-clamp-2", isSignature ? "text-[#c2b2a6]" : "text-[#6e5849]")}>
                            {item.description}
                          </p>
                        </div>

                        <div className="mt-3 pt-2 flex items-center justify-between border-t border-dashed border-[#e5d5c5]/30">
                          <span className={cn("text-base sm:text-xl font-black font-mono tracking-tight", isSignature ? "text-[#d4af37]" : "text-[#140c0a]")}>
                            ₹{item.price}
                          </span>

                          {cartEntry ? (
                            <div className={cn(
                              "flex items-center rounded-lg p-0.5 border shadow-sm",
                              isSignature 
                                ? "bg-[#281a16] border-[#d4af37]/40 text-white" 
                                : "bg-[#fdfaf6] border-[#e5d5c5] text-[#140c0a]"
                            )}>
                              <button 
                                onClick={() => updateQuantity(item.id, -1)} 
                                className="p-1 hover:text-[#d4af37] transition-colors"
                              >
                                <Minus size={12} />
                              </button>
                              <span className="text-xs font-bold px-2 font-mono">{cartEntry.quantity}</span>
                              <button 
                                onClick={() => updateQuantity(item.id, 1)} 
                                className="p-1 hover:text-[#d4af37] transition-colors"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => addToCart(item)}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow flex items-center gap-1 active:scale-95",
                                isSignature 
                                  ? "bg-[#d4af37] text-[#140c0a] hover:bg-yellow-400" 
                                  : "bg-[#140c0a] text-white hover:bg-[#2c1810]"
                              )}
                            >
                              <Plus size={12} /> Add
                            </button>
                          )}
                        </div>

                        {/* Recommended Best Combo Items for this Card (Only shown after item is added to cart) */}
                        {(() => {
                          if (!cartEntry) return null;

                          const cardRecommendations = (item.recommendedItemIds || [])
                            .map(id => menuItems.find(m => m.id === id))
                            .filter((rec): rec is MenuItem => Boolean(rec))
                            .filter(rec => !cart.some(c => c.item.id === rec.id));

                          if (cardRecommendations.length === 0) return null;

                          return (
                            <div className="mt-2.5 pt-2 border-t border-dashed border-[#e5d5c5]/40 space-y-1.5">
                              <div className="flex items-center gap-1 text-[10px] font-bold text-[#b8860b]">
                                <Sparkles size={11} className="text-[#d4af37]" />
                                <span>Pairs Best With (Best Combo):</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {cardRecommendations.map(rec => (
                                  <div 
                                    key={rec.id} 
                                    className={cn(
                                      "flex items-center justify-between gap-2 px-2 py-1 rounded-lg border text-[10px] font-medium w-full",
                                      isSignature ? "bg-[#281a16] border-[#d4af37]/30 text-white" : "bg-[#fdfaf6] border-[#e5d5c5] text-[#2c1810]"
                                    )}
                                  >
                                    <div className="flex items-center gap-1.5 truncate">
                                      <FoodTypeBadge isVegetarian={rec.isVegetarian} />
                                      <span className="font-bold truncate">{rec.name}</span>
                                      <span className="text-[#b8860b] font-mono">₹{rec.price}</span>
                                    </div>
                                    <button
                                      onClick={() => addToCart(rec)}
                                      className="px-2 py-0.5 bg-[#140c0a] text-[#d4af37] rounded-md text-[9px] font-bold hover:bg-[#2c1810] transition-colors shrink-0 flex items-center gap-0.5 shadow-xs"
                                    >
                                      <Plus size={10} /> Add
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="text-center py-20 space-y-4 bg-white rounded-3xl p-8 border border-[#e8ded3]">
            <div className="w-14 h-14 mx-auto border border-[#e5d5c5] rounded-full flex items-center justify-center text-[#8b7355] bg-[#f7f2eb]">
              <Search size={20} />
            </div>
            <p className="text-[#8b7355] font-serif italic text-base">No dishes match your filters... Try resetting filters.</p>
            <button
              onClick={resetAllFilters}
              className="inline-flex items-center gap-2 bg-[#140c0a] text-[#d4af37] px-4 py-2 rounded-xl text-xs font-bold"
            >
              <RotateCcw size={14} /> Reset All Filters
            </button>
          </div>
        )}
      </main>

      {/* Dedicated Filter Drawer Modal */}
      <AnimatePresence>
        {isFilterOpen && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFilterOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-sm bg-[#fdfaf6] h-full shadow-2xl flex flex-col z-10 overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="p-5 border-b border-[#e5d5c5] bg-[#140c0a] text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Filter size={18} className="text-[#d4af37]" />
                  <h3 className="font-serif font-extrabold text-lg text-[#d4af37]">Filter Menu</h3>
                </div>
                <button onClick={() => setIsFilterOpen(false)} className="p-1.5 text-[#a8907a] hover:text-white">
                  <X size={20} />
                </button>
              </div>

              {/* Filter Options Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Category Filters */}
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#8b7355]">Categories</h4>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs font-bold transition-all border",
                        !selectedCategory
                          ? "bg-[#140c0a] text-[#d4af37] border-[#d4af37]"
                          : "bg-white text-[#5c4033] border-[#e5d5c5] hover:border-[#d4af37]/40"
                      )}
                    >
                      ALL
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                        className={cn(
                          "px-3.5 py-2 rounded-xl text-xs font-bold transition-all border",
                          selectedCategory === cat.id
                            ? "bg-[#140c0a] text-[#d4af37] border-[#d4af37]"
                            : "bg-white text-[#5c4033] border-[#e5d5c5] hover:border-[#d4af37]/40"
                        )}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dietary Preference Filters */}
                <div className="space-y-3 pt-4 border-t border-[#e5d5c5]">
                  <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#8b7355]">Dietary Preference</h4>
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        setVegOnlyFilter(!vegOnlyFilter);
                        if (!vegOnlyFilter) setNonVegOnlyFilter(false);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all",
                        vegOnlyFilter 
                          ? "bg-emerald-50 text-emerald-800 border-emerald-500 shadow-sm" 
                          : "bg-white text-[#5c4033] border-[#e5d5c5]"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <FoodTypeBadge isVegetarian={true} />
                        <span>Vegetarian Only</span>
                      </div>
                      {vegOnlyFilter && <CheckCircle2 size={16} className="text-emerald-600" />}
                    </button>

                    <button
                      onClick={() => {
                        setNonVegOnlyFilter(!nonVegOnlyFilter);
                        if (!nonVegOnlyFilter) setVegOnlyFilter(false);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all",
                        nonVegOnlyFilter 
                          ? "bg-rose-50 text-rose-800 border-rose-500 shadow-sm" 
                          : "bg-white text-[#5c4033] border-[#e5d5c5]"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <FoodTypeBadge isVegetarian={false} />
                        <span>Non-Vegetarian Only</span>
                      </div>
                      {nonVegOnlyFilter && <CheckCircle2 size={16} className="text-rose-600" />}
                    </button>

                    <button
                      onClick={() => setSpicyFilter(!spicyFilter)}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all",
                        spicyFilter 
                          ? "bg-red-50 text-red-800 border-red-500 shadow-sm" 
                          : "bg-white text-[#5c4033] border-[#e5d5c5]"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Flame size={16} className="text-red-500" />
                        <span>Spicy Dishes</span>
                      </div>
                      {spicyFilter && <CheckCircle2 size={16} className="text-red-600" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-5 border-t border-[#e5d5c5] bg-white flex gap-3">
                <button
                  onClick={resetAllFilters}
                  className="flex-1 border border-[#e5d5c5] text-[#5c4033] py-3 rounded-xl font-bold text-xs hover:bg-[#f7f2eb] transition-all flex items-center justify-center gap-1.5"
                >
                  <RotateCcw size={14} /> Reset
                </button>
                <button
                  onClick={() => setIsFilterOpen(false)}
                  className="flex-1 bg-[#140c0a] text-[#d4af37] py-3 rounded-xl font-bold text-xs hover:bg-[#2c1810] transition-all shadow-md"
                >
                  Apply Filters
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Bottom Cart Bar */}
      <AnimatePresence>
        {totalItemCount > 0 && !isCartOpen && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-4 right-4 z-40 max-w-lg mx-auto bg-[#140c0a]/95 backdrop-blur-xl text-[#fdfaf6] p-4 rounded-2xl shadow-2xl border-2 border-[#d4af37] flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-r from-[#d4af37] to-[#b8860b] text-[#140c0a] rounded-xl flex items-center justify-center font-extrabold font-mono text-base shadow">
                {totalItemCount}
              </div>
              <div>
                <p className="text-[10px] text-[#d4af37] uppercase font-bold tracking-widest">Order Total</p>
                <p className="text-base font-extrabold text-white font-mono">₹{cartTotal.toFixed(2)}</p>
              </div>
            </div>
            <button
              onClick={() => setIsCartOpen(true)}
              className="flex items-center gap-2 bg-[#d4af37] hover:bg-yellow-400 text-[#140c0a] px-5 py-3 rounded-xl font-extrabold text-xs transition-all shadow-lg active:scale-95"
            >
              Checkout Order
              <ChevronRight size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Side Navigation Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-[300px] bg-[#140c0a] text-[#fdfaf6] z-[70] p-6 shadow-2xl flex flex-col justify-between border-r border-[#d4af37]/30"
            >
              <div>
                <div className="flex justify-between items-center mb-10 pb-4 border-b border-[#3a251c]">
                  <div className="font-serif font-extrabold text-3xl text-[#d4af37]">foQR</div>
                  <button onClick={() => setIsMenuOpen(false)} className="p-2 text-[#a8907a] hover:text-white">
                    <X size={24} />
                  </button>
                </div>
                <nav className="space-y-3">
                  <button 
                    onClick={() => { setSelectedCategory(null); setIsMenuOpen(false); }} 
                    className="w-full text-left py-3 px-4 rounded-xl bg-[#241814] text-sm font-bold text-[#d4af37] border border-[#d4af37]/30 transition-all flex items-center justify-between"
                  >
                    <span>Explore All Categories</span>
                    <ChevronRight size={16} />
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedCategory(c.id); setIsMenuOpen(false); }}
                      className="w-full text-left py-2.5 px-4 rounded-xl hover:bg-[#241814] text-sm font-medium text-[#c4b2a6] hover:text-white transition-all flex items-center justify-between"
                    >
                      <span>{c.name}</span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </nav>
              </div>

              <div className="pt-6 border-t border-[#3a251c] space-y-3">
                <div className="text-[10px] text-[#d4af37] uppercase tracking-widest font-bold">Table Session</div>
                <p className="text-xs text-[#a8907a] font-mono">{displayTableName}</p>
                <button 
                  onClick={() => { setIsMenuOpen(false); navigate("/login"); }}
                  className="w-full flex items-center gap-2 text-xs text-[#c4b2a6] hover:text-[#d4af37] pt-2"
                >
                  <Shield size={14} />
                  Staff Login
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Item Details Modal */}
      <AnimatePresence>
        {viewingItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingItem(null)}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-[#fdfaf6] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-[#e5d5c5] z-10"
            >
              <button 
                onClick={() => setViewingItem(null)}
                className="absolute top-4 right-4 z-10 p-2 bg-[#140c0a]/80 backdrop-blur-md rounded-full text-white shadow-lg"
              >
                <X size={20} />
              </button>
              {viewingItem.imageUrl && (
                <div className="aspect-video overflow-hidden relative">
                  <img 
                    src={normalizeImageUrl(viewingItem.imageUrl)}
                    alt={viewingItem.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#140c0a] via-transparent to-transparent opacity-80" />
                </div>
              )}
              <div className="p-8 space-y-6">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <FoodTypeBadge isVegetarian={viewingItem.isVegetarian} />
                      <h3 className="text-2xl font-serif font-extrabold text-[#140c0a]">{viewingItem.name}</h3>
                    </div>
                    <div className="flex gap-2 pt-1">
                      {viewingItem.isSpicy && (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                          {settings.spicyLabel}
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-[#5c4033] bg-[#f0e4d8] px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                        {viewingItem.isVegetarian ? settings.vegetarianLabel : "Non-Veg"}
                      </span>
                    </div>
                  </div>
                  <span className="text-2xl font-extrabold text-[#140c0a] font-mono">₹{viewingItem.price}</span>
                </div>
                <p className="text-sm text-[#5c4033] leading-relaxed">
                  {viewingItem.description}
                </p>

                {/* Best Combo Recommendations for this dish */}
                {(() => {
                  const itemRecommendations = (viewingItem.recommendedItemIds || [])
                    .map(id => menuItems.find(m => m.id === id))
                    .filter((item): item is MenuItem => Boolean(item))
                    .filter(recItem => !cart.some(c => c.item.id === recItem.id));

                  if (itemRecommendations.length === 0) return null;

                  return (
                    <div className="space-y-2 pt-3 border-t border-[#e5d5c5]">
                      <h4 className="text-xs font-serif font-bold text-[#140c0a] flex items-center gap-1.5">
                        <Sparkles size={14} className="text-[#d4af37]" />
                        Best Combo with this Dish
                      </h4>
                      <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                        {itemRecommendations.map(rec => (
                          <div key={rec.id} className="flex items-center justify-between p-2.5 bg-[#fdfaf6] rounded-xl border border-[#e5d5c5]">
                            <div className="flex items-center gap-2.5">
                              <FoodTypeBadge isVegetarian={rec.isVegetarian} />
                              <div>
                                <p className="text-xs font-bold text-[#140c0a]">{rec.name}</p>
                                <p className="text-[10px] text-[#b8860b] font-bold font-mono">₹{rec.price}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => addToCart(rec)}
                              className="px-3 py-1 bg-[#140c0a] text-[#d4af37] rounded-lg text-xs font-bold hover:bg-[#2c1810] flex items-center gap-1 shadow-xs"
                            >
                              <Plus size={12} /> Add
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => {
                      addToCart(viewingItem);
                      setViewingItem(null);
                      setIsCartOpen(true);
                    }}
                    className="flex-1 bg-[#140c0a] text-[#d4af37] py-4 rounded-2xl font-extrabold shadow-xl hover:bg-[#2c1810] transition-all flex items-center justify-center gap-2 text-sm border border-[#d4af37]/40"
                  >
                    <Plus size={18} />
                    Add to Cart (₹{viewingItem.price})
                  </button>
                  <button 
                    onClick={() => setViewingItem(null)}
                    className="px-6 border border-[#e5d5c5] text-[#5c4033] py-4 rounded-2xl font-medium hover:bg-white transition-all text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md bg-[#fdfaf6] h-full shadow-2xl flex flex-col z-10 overflow-hidden"
            >
              <div className="p-6 border-b border-[#e5d5c5] bg-[#140c0a] text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#d4af37] text-[#140c0a] rounded-xl font-bold">
                    <ShoppingBag size={20} />
                  </div>
                  <div>
                    <h3 className="font-serif font-extrabold text-xl text-[#d4af37]">Your Order Request</h3>
                    <p className="text-xs text-[#a8907a] font-mono">{displayTableName}</p>
                  </div>
                </div>
                <button onClick={() => setIsCartOpen(false)} className="p-2 text-[#a8907a] hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {orderSuccess ? (
                  <div className="py-12 text-center space-y-4">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle2 size={36} />
                    </div>
                    <h4 className="text-2xl font-serif font-extrabold text-[#140c0a]">Order Request Submitted!</h4>
                    <p className="text-sm text-[#5c4033] leading-relaxed max-w-xs mx-auto">
                      Your order request for <strong>{displayTableName}</strong> has been sent to the manager. Once approved by the admin, your dishes will be prepared.
                    </p>
                    <button
                      onClick={() => {
                        setOrderSuccess(false);
                        setIsCartOpen(false);
                      }}
                      className="mt-6 bg-[#140c0a] text-[#d4af37] px-8 py-3.5 rounded-xl font-extrabold text-sm hover:bg-[#2c1810] transition-all shadow-lg border border-[#d4af37]/30"
                    >
                      Back to Menu
                    </button>
                  </div>
                ) : cart.length === 0 ? (
                  <div className="py-20 text-center space-y-4">
                    <div className="w-16 h-16 bg-[#e5d5c5]/30 text-[#8b7355] rounded-full flex items-center justify-center mx-auto">
                      <ShoppingBag size={32} />
                    </div>
                    <p className="text-[#8b7355] font-serif italic text-lg">Your cart is currently empty.</p>
                    <button
                      onClick={() => setIsCartOpen(false)}
                      className="bg-[#140c0a] text-white px-6 py-2.5 rounded-xl font-medium text-sm hover:bg-[#2c1810]"
                    >
                      Browse Dishes
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#8b7355]">Selected Items ({totalItemCount})</h4>
                      {cart.map(({ item, quantity }) => (
                        <div key={item.id} className="flex items-center justify-between bg-white p-4 rounded-2xl border border-[#e5d5c5] shadow-sm">
                          <div className="flex items-center gap-3 overflow-hidden">
                            {item.imageUrl && (
                              <img src={normalizeImageUrl(item.imageUrl)} alt={item.name} className="w-12 h-12 rounded-xl object-cover" />
                            )}
                            <div className="overflow-hidden">
                              <p className="text-sm font-extrabold text-[#140c0a] truncate">{item.name}</p>
                              <p className="text-xs text-[#b8860b] font-bold font-mono">₹{item.price}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center bg-[#fdfaf6] border border-[#e5d5c5] rounded-xl px-2 py-1">
                              <button onClick={() => updateQuantity(item.id, -1)} className="p-1 text-[#5c4033] hover:text-[#140c0a]">
                                <Minus size={14} />
                              </button>
                              <span className="text-xs font-bold px-2 font-mono">{quantity}</span>
                              <button onClick={() => updateQuantity(item.id, 1)} className="p-1 text-[#5c4033] hover:text-[#140c0a]">
                                <Plus size={14} />
                              </button>
                            </div>
                            <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600 p-1">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Best Combo / Recommended Additions for Cart */}
                    {(() => {
                      const cartRecommendedIds = Array.from(
                        new Set(cart.flatMap(c => c.item.recommendedItemIds || []))
                      );

                      const unaddedRecommendations = menuItems.filter(m => 
                        cartRecommendedIds.includes(m.id) && !cart.some(c => c.item.id === m.id)
                      );

                      if (unaddedRecommendations.length === 0) return null;

                      return (
                        <div className="p-4 bg-[#fdfaf6] rounded-2xl border border-[#d4af37]/40 space-y-3 shadow-xs">
                          <div className="flex items-center gap-1.5 text-xs font-serif font-extrabold text-[#140c0a]">
                            <Sparkles size={16} className="text-[#d4af37]" />
                            <span>Pairs Best with Your Order (Best Combos)</span>
                          </div>
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {unaddedRecommendations.map(rec => (
                              <div key={rec.id} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-[#e5d5c5]">
                                <div className="flex items-center gap-2.5 overflow-hidden">
                                  {rec.imageUrl ? (
                                    <img src={normalizeImageUrl(rec.imageUrl)} alt={rec.name} className="w-10 h-10 rounded-lg object-cover" />
                                  ) : (
                                    <FoodTypeBadge isVegetarian={rec.isVegetarian} />
                                  )}
                                  <div className="overflow-hidden">
                                    <p className="text-xs font-bold text-[#140c0a] truncate">{rec.name}</p>
                                    <p className="text-[10px] text-[#b8860b] font-bold font-mono">₹{rec.price}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => addToCart(rec)}
                                  className="px-3 py-1.5 bg-[#140c0a] text-[#d4af37] rounded-lg text-xs font-bold hover:bg-[#2c1810] transition-colors shadow-xs flex items-center gap-1 shrink-0"
                                >
                                  <Plus size={12} /> Add
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    <form onSubmit={handleSubmitOrder} id="checkout-form" className="space-y-4 pt-4 border-t border-[#e5d5c5]">
                      {!hasTableSelected && (
                        <div className="p-3 bg-amber-50 border border-amber-300/80 rounded-xl text-amber-900 text-xs flex items-center gap-2 font-medium">
                          <AlertCircle size={18} className="text-amber-600 shrink-0" />
                          <span>No table selected! Please scan your Table QR code to place an order.</span>
                        </div>
                      )}
                      
                      <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#8b7355]">Customer Information</h4>
                      
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-[#5c4033]">Your Name *</label>
                        <div className="relative">
                          <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8b7355]" size={16} />
                          <input
                            type="text"
                            required
                            placeholder="Enter your full name"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            disabled={!hasTableSelected}
                            className="w-full bg-white border border-[#e5d5c5] rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40 disabled:bg-gray-100 disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-[#5c4033]">Mobile Number (+91 - 10 Digits) *</label>
                        <div className="relative flex items-center">
                          <span className="absolute left-3 font-bold text-sm text-[#140c0a] select-none bg-[#fdfaf6] px-1.5 py-0.5 border border-[#e5d5c5] rounded-md">
                            🇮🇳 +91
                          </span>
                          <input
                            type="tel"
                            required
                            placeholder="10-digit mobile number"
                            value={customerPhone}
                            onChange={handlePhoneChange}
                            maxLength={10}
                            disabled={!hasTableSelected}
                            className={cn(
                              "w-full bg-white border rounded-xl pl-20 pr-12 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40 font-mono tracking-wider disabled:bg-gray-100 disabled:cursor-not-allowed",
                              phoneError ? "border-red-500" : "border-[#e5d5c5]"
                            )}
                          />
                          <span className="absolute right-3 text-xs text-[#8b7355] font-mono">
                            {customerPhone.length}/10
                          </span>
                        </div>
                      </div>
                    </form>
                  </>
                )}
              </div>

              {!orderSuccess && cart.length > 0 && (
                <div className="p-6 border-t border-[#e5d5c5] bg-white space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-[#8b7355] font-medium">Subtotal</span>
                    <span className="font-extrabold text-[#140c0a] font-mono">₹{cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-lg font-bold border-t border-dashed border-[#e5d5c5] pt-3">
                    <span className="text-[#140c0a]">Total Amount</span>
                    <span className="text-[#b8860b] font-mono font-extrabold text-xl">₹{cartTotal.toFixed(2)}</span>
                  </div>

                  <button
                    type="submit"
                    form="checkout-form"
                    disabled={isSubmittingOrder || isTableOccupied || !hasTableSelected}
                    className={cn(
                      "w-full border py-4 rounded-xl font-extrabold shadow-xl transition-all flex items-center justify-center gap-2",
                      !hasTableSelected
                        ? "bg-stone-800 border-stone-600 text-stone-300 opacity-90 cursor-not-allowed"
                        : isTableOccupied
                        ? "bg-red-900/80 border-red-500/50 text-red-200 opacity-80 cursor-not-allowed"
                        : "bg-gradient-to-r from-[#140c0a] to-[#2c1810] text-[#d4af37] border-[#d4af37]/40 hover:brightness-125 disabled:opacity-50"
                    )}
                  >
                    {!hasTableSelected ? (
                      <>
                        <AlertCircle size={18} className="text-amber-400" />
                        Scan Table QR Code to Order
                      </>
                    ) : isTableOccupied ? (
                      <>
                        <AlertCircle size={18} className="text-red-400" />
                        Table Currently Occupied
                      </>
                    ) : isSubmittingOrder ? (
                      <span>Sending Request...</span>
                    ) : (
                      <>
                        <ShoppingBag size={18} />
                        Send Order Request (₹{cartTotal.toFixed(2)})
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full-Width Footer */}
      <footer className="w-full bg-[#140c0a] text-[#fdfaf6] pt-16 pb-12 px-6 mt-20 border-t-2 border-[#d4af37]/40 shadow-2xl">
        <div className="w-full max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10">
          <div className="space-y-3">
            <h4 className="font-serif font-extrabold text-3xl tracking-tight text-[#d4af37]">foQR</h4>
            <p className="text-[#a8907a] text-xs leading-relaxed max-w-xs font-light">
              Experience modern dining excellence. Handcrafted recipes, premium ingredients, and seamless contactless table ordering.
            </p>
          </div>
          <div className="space-y-3">
            <h5 className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-[#d4af37]">OPERATING HOURS</h5>
            <div className="space-y-1.5 text-xs text-[#a8907a]">
              <p><span className="text-white font-semibold">Mon - Thu:</span> 11:30 AM - 10:00 PM</p>
              <p><span className="text-white font-semibold">Fri - Sat:</span> 11:30 AM - 11:00 PM</p>
              <p><span className="text-white font-semibold">Sun:</span> 12:00 PM - 9:00 PM</p>
            </div>
          </div>
          <div className="space-y-3">
            <h5 className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-[#d4af37]">MANAGEMENT</h5>
            <div className="space-y-2 text-xs">
              <a 
                href="/login" 
                className="inline-flex items-center gap-1.5 text-[#c4b2a6] hover:text-[#d4af37] transition-colors"
              >
                <Shield size={14} />
                Admin Dashboard Login
              </a>
              <div className="block"><a href="#" className="text-[#a8907a] hover:text-white transition-colors">Privacy Policy</a></div>
              <div className="block"><a href="#" className="text-[#a8907a] hover:text-white transition-colors">Terms & Service</a></div>
            </div>
          </div>
        </div>
        <div className="w-full max-w-7xl mx-auto mt-14 pt-6 border-t border-[#34241d] text-center">
          <p className="text-[10px] text-[#7a6758] font-bold uppercase tracking-[0.25em]">
            © 2026 FOQR. ALL RIGHTS RESERVED.
          </p>
        </div>
      </footer>
    </div>
  );
}
