import React, { useEffect, useState } from "react";
import { auth, db, handleFirestoreError, OperationType, logout } from "../firebase";
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  LayoutDashboard, Utensils, QrCode, BarChart3, Settings, LogOut, 
  Plus, Edit2, Trash2, Save, X, ChevronRight, Image as ImageIcon,
  Flame, Leaf, Check, AlertCircle, TrendingUp, Users, MousePointer2,
  ShoppingBag, CheckCircle2, XCircle, Clock, Phone, History, Receipt, Printer, Menu as MenuIcon,
  ChevronDown, ChevronUp
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "../lib/utils";

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
  views?: number;
}

interface Scan {
  id: string;
  qrId: string;
  timestamp: Timestamp;
  userAgent: string;
}

interface Table {
  id: string;
  name: string;
  tableNumber: string | number;
  location?: string;
  createdAt?: Timestamp;
}

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

interface OrderRequest {
  id: string;
  customerName: string;
  customerPhone: string;
  tableNumber: string;
  items: OrderItem[];
  totalAmount: number;
  status: "pending" | "approved" | "completed" | "rejected";
  createdAt?: Timestamp;
}

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "menu" | "orders" | "qr" | "analytics" | "settings">("overview");
  const [menuSubTab, setMenuSubTab] = useState<"items" | "categories">("items");
  const [orderSubTab, setOrderSubTab] = useState<"pending" | "approved" | "completed" | "rejected">("pending");
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [orderRequests, setOrderRequests] = useState<OrderRequest[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isBulkPrintModalOpen, setIsBulkPrintModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedCompletedTableNum, setSelectedCompletedTableNum] = useState<string | null>(null);
  const [expandedMobileTableNum, setExpandedMobileTableNum] = useState<string | null>(null);

  const completedOrdersList = orderRequests.filter(o => o.status === "completed");
  const completedTableNumbers: string[] = Array.from(
    new Set(completedOrdersList.map(o => o.tableNumber?.toString().trim()))
  ).filter((t): t is string => Boolean(t)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const activeCompletedTable = (selectedCompletedTableNum && completedTableNumbers.includes(selectedCompletedTableNum))
    ? selectedCompletedTableNum
    : (completedTableNumbers[0] || null);

  const approvedOrdersList = orderRequests.filter(o => o.status === "approved");

  const toggleOrderSelection = (id: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllApproved = () => {
    if (selectedOrderIds.length === approvedOrdersList.length && approvedOrdersList.length > 0) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(approvedOrdersList.map(o => o.id));
    }
  };
  const [settings, setSettings] = useState({
    spicyLabel: "Spicy Dish",
    vegetarianLabel: "Vegetarian"
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Form states
  const [isEditingItem, setIsEditingItem] = useState<MenuItem | null>(null);
  const [isEditingCategory, setIsEditingCategory] = useState<Category | null>(null);
  const [isEditingTable, setIsEditingTable] = useState<Table | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isAddingTable, setIsAddingTable] = useState(false);

  useEffect(() => {
    // Safety fallback timer to ensure screen never gets stuck loading forever
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
    }, 2000);

    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      if (!u) navigate("/login");
      setUser(u);
    });

    const catQuery = query(collection(db, "categories"), orderBy("order", "asc"));
    const unsubscribeCats = onSnapshot(catQuery, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, "categories"));

    const itemQuery = query(collection(db, "menuItems"));
    const unsubscribeItems = onSnapshot(itemQuery, (snapshot) => {
      setMenuItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "menuItems");
      setLoading(false);
    });

    const scanQuery = query(collection(db, "scans"), orderBy("timestamp", "desc"));
    const unsubscribeScans = onSnapshot(scanQuery, (snapshot) => {
      setScans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Scan)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, "scans"));

    const tableQuery = query(collection(db, "tables"));
    const unsubscribeTables = onSnapshot(tableQuery, (snapshot) => {
      setTables(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Table)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, "tables"));

    const orderQuery = query(collection(db, "orderRequests"), orderBy("createdAt", "desc"));
    const unsubscribeOrders = onSnapshot(orderQuery, (snapshot) => {
      setOrderRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderRequest)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, "orderRequests"));

    const unsubscribeSettings = onSnapshot(doc(db, "settings", "general"), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as any);
      }
    });

    return () => {
      clearTimeout(loadingTimeout);
      unsubscribeAuth();
      unsubscribeCats();
      unsubscribeItems();
      unsubscribeScans();
      unsubscribeTables();
      unsubscribeOrders();
      unsubscribeSettings();
    };
  }, [navigate]);

  const handleApproveOrder = async (orderId: string) => {
    try {
      await updateDoc(doc(db, "orderRequests", orderId), { status: "approved" });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, "orderRequests");
    }
  };

  const handleCompleteOrder = async (orderId: string) => {
    try {
      await updateDoc(doc(db, "orderRequests", orderId), { status: "completed" });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, "orderRequests");
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to reject this order request?")) return;
    try {
      await updateDoc(doc(db, "orderRequests", orderId), { status: "rejected" });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, "orderRequests");
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleAddItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const itemData = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      price: parseFloat(formData.get("price") as string),
      categoryId: formData.get("categoryId") as string,
      imageUrl: formData.get("imageUrl") as string,
      isAvailable: true,
      isSpicy: formData.get("isSpicy") === "on",
      isVegetarian: formData.get("isVegetarian") === "on",
    };

    try {
      if (isEditingItem) {
        await updateDoc(doc(db, "menuItems", isEditingItem.id), itemData);
        setIsEditingItem(null);
      } else {
        await addDoc(collection(db, "menuItems"), {
          ...itemData,
          createdAt: serverTimestamp(),
        });
        setIsAddingItem(false);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "menuItems");
    }
  };

  const handleAddCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const categoryData = {
      name: formData.get("name") as string,
      order: parseInt(formData.get("order") as string) || categories.length + 1,
    };

    try {
      if (isEditingCategory) {
        await updateDoc(doc(db, "categories", isEditingCategory.id), categoryData);
        setIsEditingCategory(null);
      } else {
        await addDoc(collection(db, "categories"), categoryData);
        setIsAddingCategory(false);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "categories");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const linkedItems = menuItems.filter(item => item.categoryId === id);
    if (linkedItems.length > 0) {
      alert(`Cannot delete category. It has ${linkedItems.length} items linked to it. Please move or delete those items first.`);
      return;
    }
    if (!confirm("Are you sure you want to delete this category?")) return;
    try {
      await deleteDoc(doc(db, "categories", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "categories");
    }
  };

  const handleAddTable = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const tableNumVal = formData.get("tableNumber") as string;
    const tableNameVal = (formData.get("name") as string) || `Table ${tableNumVal}`;
    const tableData = {
      name: tableNameVal,
      tableNumber: tableNumVal,
      location: formData.get("location") as string || "",
    };

    // Uniqueness validation
    const editingId = isEditingTable?.id;
    const duplicateName = tables.find(t => t.name.toLowerCase() === tableNameVal.toLowerCase() && t.id !== editingId);
    if (duplicateName) {
      alert(`A table with display name "${tableNameVal}" already exists. Please use a unique name.`);
      return;
    }
    const duplicateNumber = tables.find(t => String(t.tableNumber) === String(tableNumVal) && t.id !== editingId);
    if (duplicateNumber) {
      alert(`A table with Table Number / QR Code ID "${tableNumVal}" already exists. Please use a unique ID.`);
      return;
    }

    try {
      if (isEditingTable) {
        await updateDoc(doc(db, "tables", isEditingTable.id), tableData);
        setIsEditingTable(null);
      } else {
        await addDoc(collection(db, "tables"), {
          ...tableData,
          createdAt: serverTimestamp(),
        });
        setIsAddingTable(false);
      }
    } catch (error) {
      console.error("Failed to save table to Firestore:", error);
      alert("Failed to save table to Firestore: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleDeleteTable = async (id: string) => {
    if (!confirm("Are you sure you want to delete this table?")) return;
    try {
      await deleteDoc(doc(db, "tables", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "tables");
    }
  };

  const seedDefaultTables = async () => {
    try {
      const defaultTables = [
        { name: "Table 1", tableNumber: "1", location: "Main Hall" },
        { name: "Table 2", tableNumber: "2", location: "Main Hall" },
        { name: "Table 3", tableNumber: "3", location: "Patio" },
        { name: "Table 4", tableNumber: "4", location: "Patio" },
        { name: "Table 5", tableNumber: "5", location: "VIP Area" },
        { name: "Table 6", tableNumber: "6", location: "VIP Area" },
      ];
      for (const t of defaultTables) {
        await addDoc(collection(db, "tables"), {
          ...t,
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "tables");
    }
  };

  const downloadQRCode = (elementId: string, fileName: string) => {
    const svg = document.getElementById(elementId);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `${fileName.replace(/\s+/g, '_')}_QR.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    try {
      await deleteDoc(doc(db, "menuItems", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "menuItems");
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newSettings = {
      spicyLabel: formData.get("spicyLabel") as string,
      vegetarianLabel: formData.get("vegetarianLabel") as string,
    };

    try {
      await setDoc(doc(db, "settings", "general"), newSettings);
      alert("Settings updated successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "settings");
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#fdfaf6]">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#fdfaf6] flex flex-col md:flex-row relative">
      {/* Mobile Top Header Bar */}
      <div className="md:hidden bg-[#2c1810] text-[#fdfaf6] px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            className="p-2 rounded-xl bg-[#4a2c1d] text-[#d4af37] hover:bg-[#5c3826] transition-colors"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileSidebarOpen ? <X size={20} /> : <MenuIcon size={20} />}
          </button>
          <div>
            <h1 className="text-xl font-serif font-bold text-[#d4af37] leading-none">foQR</h1>
            <p className="text-[9px] uppercase tracking-widest text-[#8b7355]">Admin Panel</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => navigate("/")}
            className="px-3 py-1.5 bg-[#d4af37] text-[#2c1810] rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <MousePointer2 size={14} />
            Menu
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay Backdrop */}
      {isMobileSidebarOpen && (
        <div 
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "w-64 bg-[#2c1810] text-[#fdfaf6] p-6 flex flex-col fixed md:static inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out md:translate-x-0 shrink-0",
        isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="mb-10 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-serif font-bold text-[#d4af37]">foQR</h1>
            <p className="text-[10px] uppercase tracking-widest text-[#8b7355]">Admin Dashboard</p>
          </div>
          <button 
            onClick={() => setIsMobileSidebarOpen(false)}
            className="md:hidden text-[#8b7355] hover:text-[#fdfaf6]"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto">
          {[
            { id: "overview", icon: LayoutDashboard, label: "Overview" },
            { id: "menu", icon: Utensils, label: "Menu Management" },
            { 
              id: "orders", 
              icon: ShoppingBag, 
              label: "Order Requests",
              badge: orderRequests.filter(o => o.status === "pending").length
            },
            { id: "qr", icon: QrCode, label: "QR Codes" },
            { id: "analytics", icon: BarChart3, label: "Analytics" },
            { id: "settings", icon: Settings, label: "Settings" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setIsMobileSidebarOpen(false);
              }}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-sm font-medium",
                activeTab === tab.id 
                  ? "bg-[#d4af37] text-[#2c1810] shadow-lg" 
                  : "text-[#8b7355] hover:text-[#fdfaf6] hover:bg-[#4a2c1d]"
              )}
            >
              <div className="flex items-center gap-3">
                <tab.icon size={20} />
                {tab.label}
              </div>
              {Boolean(tab.badge && tab.badge > 0) && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-[#4a2c1d]">
          <div className="flex items-center gap-3 mb-6 px-2">
            <img 
              src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.email}`} 
              className="w-10 h-10 rounded-full border-2 border-[#d4af37]"
              alt="User"
            />
            <div className="overflow-hidden">
              <p className="text-xs font-bold truncate">{user?.displayName || "Admin"}</p>
              <p className="text-[10px] text-[#8b7355] truncate">{user?.email}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all text-sm font-medium"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto w-full min-w-0">
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-10">
          <div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#2c1810] capitalize">{activeTab}</h2>
            <p className="text-xs sm:text-sm text-[#5c4033]">Welcome back, {user?.displayName?.split(' ')[0] || 'Admin'}</p>
          </div>
          <div className="hidden sm:flex gap-4">
            <button 
              onClick={() => navigate("/")}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-[#e5d5c5] rounded-xl text-[#2c1810] hover:shadow-md transition-all text-sm font-medium"
            >
              <MousePointer2 size={18} />
              View Menu
            </button>
            <button 
              onClick={() => setActiveTab("settings")}
              className="p-2 bg-white border border-[#e5d5c5] rounded-xl text-[#5c4033] hover:shadow-md transition-all"
            >
              <Settings size={20} />
            </button>
          </div>
        </header>

        {activeTab === "overview" && (
          <div className="space-y-6 sm:space-y-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              {[
                { label: "Total Items", value: menuItems.length, icon: Utensils, color: "bg-blue-500" },
                { label: "Categories", value: categories.length, icon: LayoutDashboard, color: "bg-purple-500" },
                { label: "Total Scans", value: scans.length, icon: MousePointer2, color: "bg-orange-500" },
                { label: "Active QR Codes", value: 4, icon: QrCode, color: "bg-green-500" },
              ].map((stat, i) => (
                <div key={i} className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-[#e5d5c5]">
                  <div className="flex justify-between items-start mb-3 sm:mb-4">
                    <div className={cn("p-2 sm:p-3 rounded-xl text-white", stat.color)}>
                      <stat.icon size={20} className="sm:w-6 sm:h-6" />
                    </div>
                    <TrendingUp size={18} className="text-green-500 shrink-0" />
                  </div>
                  <p className="text-[#8b7355] text-xs sm:text-sm font-medium truncate">{stat.label}</p>
                  <h3 className="text-xl sm:text-2xl font-bold text-[#2c1810]">{stat.value}</h3>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#e5d5c5]">
                <h3 className="text-lg font-serif font-bold mb-6 flex items-center gap-2">
                  <TrendingUp size={20} className="text-[#d4af37]" />
                  Recent Scans
                </h3>
                <div className="space-y-4">
                  {scans.slice(0, 5).map((scan) => (
                    <div key={scan.id} className="flex items-center justify-between p-4 bg-[#fdfaf6] rounded-xl border border-[#e5d5c5]">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#2c1810] rounded-lg flex items-center justify-center text-[#d4af37]">
                          <QrCode size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#2c1810]">Table {scan.qrId === 'direct' ? 'Main' : scan.qrId}</p>
                          <p className="text-[10px] text-[#8b7355]">{scan.userAgent.split(') ')[0].slice(0, 30)}...</p>
                        </div>
                      </div>
                      <p className="text-xs text-[#8b7355]">{scan.timestamp?.toDate().toLocaleTimeString()}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#e5d5c5]">
                <h3 className="text-lg font-serif font-bold mb-6 flex items-center gap-2">
                  <Utensils size={20} className="text-[#d4af37]" />
                  Most Viewed Items
                </h3>
                <div className="space-y-4">
                  {menuItems.sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5).map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-[#fdfaf6] rounded-xl border border-[#e5d5c5]">
                      <div className="flex items-center gap-3">
                        <img src={item.imageUrl || `https://picsum.photos/seed/${item.name}/100/100`} className="w-12 h-12 rounded-lg object-cover" alt={item.name} />
                        <div>
                          <p className="text-sm font-bold text-[#2c1810]">{item.name}</p>
                          <p className="text-[10px] text-[#8b7355]">{item.views || Math.floor(Math.random() * 100)} impressions</p>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-[#d4af37]">Rs {item.price.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "menu" && (
          <div className="space-y-6 sm:space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
              <div className="flex bg-white border border-[#e5d5c5] p-1 rounded-xl w-full sm:w-auto">
                <button 
                  onClick={() => setMenuSubTab("items")}
                  className={cn(
                    "flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all text-center",
                    menuSubTab === "items" ? "bg-[#2c1810] text-[#fdfaf6] shadow-md" : "text-[#8b7355] hover:text-[#2c1810]"
                  )}
                >
                  Menu Items
                </button>
                <button 
                  onClick={() => setMenuSubTab("categories")}
                  className={cn(
                    "flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all text-center",
                    menuSubTab === "categories" ? "bg-[#2c1810] text-[#fdfaf6] shadow-md" : "text-[#8b7355] hover:text-[#2c1810]"
                  )}
                >
                  Categories
                </button>
              </div>
              <div className="flex gap-3">
                {menuSubTab === "items" ? (
                  <button 
                    onClick={() => setIsAddingItem(true)}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#2c1810] text-[#fdfaf6] px-4 py-2.5 rounded-xl hover:bg-[#4a2c1d] transition-all text-xs sm:text-sm font-medium shadow-lg"
                  >
                    <Plus size={18} />
                    Add Menu Item
                  </button>
                ) : (
                  <button 
                    onClick={() => setIsAddingCategory(true)}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#2c1810] text-[#fdfaf6] px-4 py-2.5 rounded-xl hover:bg-[#4a2c1d] transition-all text-xs sm:text-sm font-medium shadow-lg"
                  >
                    <Plus size={18} />
                    Add Category
                  </button>
                )}
              </div>
            </div>

            {menuSubTab === "items" ? (
              <div className="bg-white rounded-2xl shadow-sm border border-[#e5d5c5] overflow-x-auto w-full">
                <table className="w-full text-left border-collapse min-w-[640px]">
                  <thead className="bg-[#fdfaf6] border-b border-[#e5d5c5]">
                    <tr>
                      <th className="px-6 py-4 text-xs uppercase tracking-widest text-[#8b7355] font-bold">Item</th>
                      <th className="px-6 py-4 text-xs uppercase tracking-widest text-[#8b7355] font-bold">Category</th>
                      <th className="px-6 py-4 text-xs uppercase tracking-widest text-[#8b7355] font-bold">Price</th>
                      <th className="px-6 py-4 text-xs uppercase tracking-widest text-[#8b7355] font-bold">Status</th>
                      <th className="px-6 py-4 text-xs uppercase tracking-widest text-[#8b7355] font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5d5c5]">
                    {menuItems.map((item) => (
                      <tr key={item.id} className="hover:bg-[#fdfaf6]/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <img src={item.imageUrl || `https://picsum.photos/seed/${item.name}/100/100`} className="w-12 h-12 rounded-xl object-cover" alt={item.name} />
                            <div>
                              <p className="text-sm font-bold text-[#2c1810]">{item.name}</p>
                              <div className="flex gap-2 mt-1">
                                {item.isSpicy && (
                                  <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 uppercase">
                                    {settings.spicyLabel}
                                  </span>
                                )}
                                {item.isVegetarian && (
                                  <span className="text-[9px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-100 uppercase">
                                    {settings.vegetarianLabel}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs bg-[#fdfaf6] border border-[#e5d5c5] px-2 py-1 rounded-md text-[#5c4033]">
                            {categories.find(c => c.id === item.categoryId)?.name || 'Uncategorized'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-[#2c1810]">Rs {item.price.toFixed(2)}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-2 h-2 rounded-full", item.isAvailable ? "bg-green-500" : "bg-red-500")} />
                            <span className="text-xs text-[#5c4033]">{item.isAvailable ? "Available" : "Sold Out"}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => setIsEditingItem(item)}
                              className="p-2 text-[#8b7355] hover:text-[#d4af37] transition-colors"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button 
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-2 text-[#8b7355] hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-[#e5d5c5] overflow-x-auto w-full">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead className="bg-[#fdfaf6] border-b border-[#e5d5c5]">
                    <tr>
                      <th className="px-6 py-4 text-xs uppercase tracking-widest text-[#8b7355] font-bold">Order</th>
                      <th className="px-6 py-4 text-xs uppercase tracking-widest text-[#8b7355] font-bold">Category Name</th>
                      <th className="px-6 py-4 text-xs uppercase tracking-widest text-[#8b7355] font-bold">Linked Items</th>
                      <th className="px-6 py-4 text-xs uppercase tracking-widest text-[#8b7355] font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5d5c5]">
                    {categories.map((cat) => (
                      <tr key={cat.id} className="hover:bg-[#fdfaf6]/50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="text-sm font-mono text-[#8b7355]">#{cat.order}</span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-[#2c1810]">{cat.name}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs bg-[#fdfaf6] border border-[#e5d5c5] px-2 py-1 rounded-md text-[#5c4033]">
                            {menuItems.filter(i => i.categoryId === cat.id).length} items
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => setIsEditingCategory(cat)}
                              className="p-2 text-[#8b7355] hover:text-[#d4af37] transition-colors"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button 
                              onClick={() => handleDeleteCategory(cat.id)}
                              className="p-2 text-[#8b7355] hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {activeTab === "orders" && (
          <div className="space-y-6 sm:space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-[#e5d5c5]">
              <div>
                <h3 className="text-lg sm:text-xl font-serif font-bold text-[#2c1810]">Customer Order Requests</h3>
                <p className="text-xs sm:text-sm text-[#8b7355]">Review pending table orders from customers, verify details, and approve or decline requests.</p>
              </div>
              <div className="flex bg-[#fdfaf6] border border-[#e5d5c5] p-1 rounded-xl overflow-x-auto no-scrollbar w-full sm:w-auto max-w-full">
                {(["pending", "approved", "completed", "rejected"] as const).map((status) => {
                  const count = orderRequests.filter(o => o.status === status).length;
                  return (
                    <button 
                      key={status}
                      onClick={() => setOrderSubTab(status)}
                      className={cn(
                        "px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all capitalize flex items-center gap-1.5 sm:gap-2 shrink-0",
                        orderSubTab === status 
                          ? "bg-[#2c1810] text-[#fdfaf6] shadow-md" 
                          : "text-[#8b7355] hover:text-[#2c1810]"
                      )}
                    >
                      {status}
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full",
                        status === "pending" && count > 0 ? "bg-blue-500 text-white" : "bg-[#e5d5c5] text-[#2c1810]"
                      )}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bulk Bill Payment Banner for Approved Orders */}
            {orderSubTab === "approved" && approvedOrdersList.length > 0 && (
              <div className="bg-[#2c1810] text-[#fdfaf6] p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 shadow-md border border-[#d4af37]/30">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="selectAllApproved"
                    checked={selectedOrderIds.length === approvedOrdersList.length && approvedOrdersList.length > 0}
                    onChange={toggleSelectAllApproved}
                    className="w-5 h-5 accent-[#d4af37] rounded cursor-pointer"
                  />
                  <label htmlFor="selectAllApproved" className="text-sm font-bold cursor-pointer text-[#d4af37] flex items-center gap-2">
                    Select All Approved Orders ({selectedOrderIds.length}/{approvedOrdersList.length})
                  </label>
                </div>

                <div className="flex items-center gap-4">
                  {selectedOrderIds.length > 0 && (
                    <div className="text-xs font-mono text-[#c2b2a6]">
                      Selected Total: <span className="text-sm font-bold text-[#d4af37]">Rs {
                        approvedOrdersList
                          .filter(o => selectedOrderIds.includes(o.id))
                          .reduce((sum, o) => sum + (o.totalAmount || 0), 0)
                          .toFixed(2)
                      }</span>
                    </div>
                  )}
                  <button
                    disabled={selectedOrderIds.length === 0}
                    onClick={() => setIsBulkPrintModalOpen(true)}
                    className="bg-[#d4af37] text-[#140c0a] hover:bg-[#e6c250] disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md flex items-center gap-2"
                  >
                    <Receipt size={16} />
                    Bulk Bill Print ({selectedOrderIds.length})
                  </button>
                </div>
              </div>
            )}

            {/* Order Requests List / Completed View */}
            {orderSubTab === "completed" ? (
              completedOrdersList.length === 0 ? (
                <div className="bg-white p-12 rounded-3xl shadow-sm border border-[#e5d5c5] text-center space-y-4">
                  <div className="w-16 h-16 bg-[#fdfaf6] text-[#8b7355] border border-[#e5d5c5] rounded-2xl flex items-center justify-center mx-auto">
                    <CheckCircle2 size={32} className="text-green-600" />
                  </div>
                  <h4 className="text-xl font-serif font-bold text-[#2c1810]">No Completed Order Requests</h4>
                  <p className="text-sm text-[#8b7355] max-w-md mx-auto">
                    When customer orders are marked as completed, they will appear here organized by table number.
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile Accordion View (< md) */}
                  <div className="block md:hidden space-y-3">
                    <div className="bg-white p-4 rounded-2xl border border-[#e5d5c5] flex justify-between items-center mb-3">
                      <div>
                        <h4 className="text-base font-serif font-bold text-[#2c1810]">Table Orders</h4>
                        <p className="text-xs text-[#8b7355]">Tap a table to view or hide bookings</p>
                      </div>
                      <span className="text-xs bg-[#fdfaf6] border border-[#e5d5c5] px-2.5 py-1 rounded-full font-bold text-[#2c1810]">
                        {completedOrdersList.length} Bills
                      </span>
                    </div>

                    {completedTableNumbers.map((tNum) => {
                      const tableOrders = completedOrdersList.filter(o => o.tableNumber?.toString().trim() === tNum);
                      const tableTotalRevenue = tableOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
                      const isExpanded = expandedMobileTableNum === tNum;
                      const displayTableName = String(tNum).toLowerCase().startsWith("table") ? String(tNum) : `Table ${tNum}`;

                      return (
                        <div key={tNum} className="space-y-2">
                          <button
                            onClick={() => {
                              setSelectedCompletedTableNum(tNum);
                              setExpandedMobileTableNum(prev => prev === tNum ? null : tNum);
                            }}
                            className={cn(
                              "w-full text-left p-4 rounded-2xl border transition-all flex justify-between items-center shadow-xs",
                              isExpanded
                                ? "bg-[#2c1810] text-[#fdfaf6] border-[#2c1810]"
                                : "bg-white text-[#2c1810] border-[#e5d5c5]"
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className={cn(
                                "font-bold text-sm",
                                isExpanded ? "text-[#d4af37]" : "text-[#2c1810]"
                              )}>
                                {displayTableName}
                              </span>
                              <span className={cn(
                                "text-xs font-mono px-2 py-0.5 rounded-full text-[10px]",
                                isExpanded ? "bg-[#4a2c1d] text-[#c2b2a6]" : "bg-[#fdfaf6] text-[#8b7355] border border-[#e5d5c5]"
                              )}>
                                {tableOrders.length} {tableOrders.length === 1 ? "bill" : "bills"}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "text-xs font-bold font-mono px-2.5 py-1 rounded-lg",
                                isExpanded ? "bg-[#d4af37] text-[#140c0a]" : "bg-[#e5d5c5] text-[#2c1810]"
                              )}>
                                Rs {tableTotalRevenue.toFixed(0)}
                              </span>
                              {isExpanded ? (
                                <ChevronUp size={18} className="text-[#d4af37] shrink-0" />
                              ) : (
                                <ChevronDown size={18} className="text-[#8b7355] shrink-0" />
                              )}
                            </div>
                          </button>

                          {/* Accordion Bookings Content directly below table button */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-3 pl-1 pr-1 pt-1 pb-2 overflow-hidden"
                              >
                                {tableOrders.map((order) => (
                                  <div key={order.id} className="bg-white rounded-2xl p-4 border border-[#e5d5c5] space-y-3 shadow-xs">
                                    <div className="flex justify-between items-start">
                                      <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded border bg-green-50 text-green-700 border-green-200">
                                          completed
                                        </span>
                                        <span className="text-xs font-mono text-[#8b7355]">INV-{order.id.slice(-6).toUpperCase()}</span>
                                      </div>
                                      <span className="text-[11px] font-bold text-[#2c1810] font-mono">
                                        {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                      </span>
                                    </div>

                                    <div className="flex justify-between items-center text-xs text-[#5c4033] bg-[#fdfaf6] p-2.5 rounded-xl border border-[#e5d5c5]">
                                      <p><strong className="text-[#2c1810]">{order.customerName || 'Guest'}</strong></p>
                                      <a href={`tel:${order.customerPhone}`} className="font-mono font-bold text-[#2c1810] hover:text-[#d4af37]">
                                        {order.customerPhone}
                                      </a>
                                    </div>

                                    <div className="divide-y divide-[#e5d5c5] bg-[#fdfaf6]/50 rounded-xl p-2.5 border border-[#e5d5c5] text-xs">
                                      {order.items?.map((item, idx) => (
                                        <div key={idx} className="flex justify-between py-1">
                                          <span><strong className="text-[#d4af37] mr-1">{item.quantity}x</strong>{item.name}</span>
                                          <span className="font-bold">Rs {(item.subtotal || (item.price * item.quantity)).toFixed(2)}</span>
                                        </div>
                                      ))}
                                    </div>

                                    <div className="flex justify-between items-center pt-2 border-t border-[#e5d5c5]">
                                      <span className="text-xs font-bold text-[#2c1810]">Total: Rs {order.totalAmount?.toFixed(2)}</span>
                                      <button
                                        onClick={() => {
                                          setSelectedOrderIds([order.id]);
                                          setIsBulkPrintModalOpen(true);
                                        }}
                                        className="bg-[#2c1810] text-[#d4af37] px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1"
                                      >
                                        <Receipt size={14} />
                                        GST Bill
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Split Dual-Column View (>= md) */}
                  <div className="hidden md:grid md:grid-cols-12 gap-6 items-start">
                    {/* Left Column: Table Numbers List (Independent Scroll) */}
                    <div className="md:col-span-4 bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-[#e5d5c5] space-y-4">
                      <div className="flex justify-between items-center pb-3 border-b border-[#e5d5c5]">
                        <div>
                          <h4 className="text-base font-serif font-bold text-[#2c1810]">Tables</h4>
                          <p className="text-xs text-[#8b7355]">{completedTableNumbers.length} Tables with Completed Orders</p>
                        </div>
                        <span className="text-xs bg-[#fdfaf6] border border-[#e5d5c5] px-2.5 py-1 rounded-full font-bold text-[#2c1810]">
                          {completedOrdersList.length} Total
                        </span>
                      </div>

                      {/* Left Independent Scroll */}
                      <div className="overflow-y-auto max-h-[60vh] md:max-h-[calc(100vh-280px)] space-y-2.5 pr-1 no-scrollbar">
                        {completedTableNumbers.map((tNum) => {
                          const tableOrders = completedOrdersList.filter(o => o.tableNumber?.toString().trim() === tNum);
                          const tableTotalRevenue = tableOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
                          const isSelected = activeCompletedTable === tNum;
                          const displayTableName = String(tNum).toLowerCase().startsWith("table") ? String(tNum) : `Table ${tNum}`;

                          return (
                            <button
                              key={tNum}
                              onClick={() => setSelectedCompletedTableNum(tNum)}
                              className={cn(
                                "w-full text-left p-3.5 sm:p-4 rounded-2xl border transition-all flex justify-between items-center group",
                                isSelected
                                  ? "bg-[#2c1810] text-[#fdfaf6] border-[#2c1810] shadow-md scale-[1.01]"
                                  : "bg-[#fdfaf6] text-[#2c1810] border-[#e5d5c5] hover:border-[#d4af37] hover:bg-white"
                              )}
                            >
                              <div className="space-y-0.5">
                                <span className={cn(
                                  "font-bold text-sm block",
                                  isSelected ? "text-[#d4af37]" : "text-[#2c1810]"
                                )}>
                                  {displayTableName}
                                </span>
                                <p className={cn(
                                  "text-xs font-mono",
                                  isSelected ? "text-[#c2b2a6]" : "text-[#8b7355]"
                                )}>
                                  {tableOrders.length} {tableOrders.length === 1 ? "Booking" : "Bookings"}
                                </p>
                              </div>

                              <span className={cn(
                                "text-xs font-bold font-mono px-2.5 py-1 rounded-lg",
                                isSelected ? "bg-[#d4af37] text-[#140c0a]" : "bg-[#e5d5c5] text-[#2c1810]"
                              )}>
                                Rs {tableTotalRevenue.toFixed(0)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right Column: Bookings for Selected Table (Independent Scroll) */}
                    <div className="md:col-span-8 bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-[#e5d5c5] space-y-4">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center pb-4 border-b border-[#e5d5c5] gap-2">
                        <div>
                          <h4 className="text-lg font-serif font-bold text-[#2c1810] flex items-center gap-2">
                            <span className="px-3 py-1 bg-[#2c1810] text-[#d4af37] text-xs font-bold rounded-full">
                              {activeCompletedTable?.toLowerCase().startsWith("table") ? activeCompletedTable : `Table ${activeCompletedTable}`}
                            </span>
                            Completed Bookings
                          </h4>
                          <p className="text-xs text-[#8b7355]">
                            Showing completed order bills specifically for this table.
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono text-[#8b7355]">
                            Table Total: <strong className="text-sm font-bold text-[#2c1810]">Rs {
                              completedOrdersList
                                .filter(o => o.tableNumber?.toString().trim() === activeCompletedTable)
                                .reduce((sum, o) => sum + (o.totalAmount || 0), 0)
                                .toFixed(2)
                            }</strong>
                          </span>
                        </div>
                      </div>

                      {/* Right Independent Scroll */}
                      <div className="overflow-y-auto max-h-[60vh] md:max-h-[calc(100vh-280px)] space-y-4 pr-1 no-scrollbar">
                        {completedOrdersList
                          .filter(o => o.tableNumber?.toString().trim() === activeCompletedTable)
                          .map((order) => (
                            <div key={order.id} className="bg-[#fdfaf6] rounded-2xl p-4 sm:p-5 border border-[#e5d5c5] space-y-4 hover:shadow-sm transition-all">
                              {/* Booking Header */}
                              <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                  <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md border bg-green-50 text-green-700 border-green-200">
                                    completed
                                  </span>
                                  <span className="text-xs font-mono text-[#8b7355]">
                                    INV-{order.id.slice(-6).toUpperCase()}
                                  </span>
                                </div>
                                <span className="text-xs font-bold text-[#2c1810] bg-white border border-[#e5d5c5] px-2.5 py-1 rounded-xl flex items-center gap-1.5 font-mono shadow-2xs">
                                  <Clock size={13} className="text-[#d4af37]" />
                                  {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                                </span>
                              </div>

                              {/* Customer Details */}
                              <div className="bg-white p-3 rounded-xl border border-[#e5d5c5] flex justify-between items-center text-xs">
                                <div>
                                  <span className="text-[#8b7355] font-bold">Customer: </span>
                                  <span className="font-bold text-[#2c1810]">{order.customerName || 'Guest'}</span>
                                </div>
                                <div>
                                  <span className="text-[#8b7355] font-bold">Phone: </span>
                                  <a href={`tel:${order.customerPhone}`} className="font-bold text-[#2c1810] hover:text-[#d4af37] font-mono">
                                    {order.customerPhone}
                                  </a>
                                </div>
                              </div>

                              {/* Items List */}
                              <div className="space-y-1.5">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-[#8b7355]">Ordered Dishes</p>
                                <div className="divide-y divide-[#e5d5c5] bg-white rounded-xl p-3 border border-[#e5d5c5]">
                                  {order.items?.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center py-1 text-xs">
                                      <span className="font-medium text-[#2c1810]">
                                        <span className="font-bold text-[#d4af37] mr-2">{item.quantity}x</span>
                                        {item.name}
                                      </span>
                                      <span className="font-bold text-[#5c4033]">
                                        Rs {(item.subtotal || (item.price * item.quantity)).toFixed(2)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Total & Action */}
                              <div className="pt-3 border-t border-[#e5d5c5] flex justify-between items-center">
                                <div>
                                  <span className="text-[10px] uppercase font-bold text-[#8b7355]">Total: </span>
                                  <span className="text-base font-bold text-[#2c1810]">Rs {order.totalAmount?.toFixed(2)}</span>
                                </div>
                                <button
                                  onClick={() => {
                                    setSelectedOrderIds([order.id]);
                                    setIsBulkPrintModalOpen(true);
                                  }}
                                  className="bg-[#2c1810] text-[#d4af37] border border-[#d4af37]/40 hover:bg-[#4a2c1d] px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-sm flex items-center gap-1.5"
                                >
                                  <Receipt size={14} className="text-[#d4af37]" />
                                  Print GST Bill
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </>
              )
            ) : orderRequests.filter(o => o.status === orderSubTab).length === 0 ? (
              <div className="bg-white p-12 rounded-3xl shadow-sm border border-[#e5d5c5] text-center space-y-4">
                <div className="w-16 h-16 bg-[#fdfaf6] text-[#8b7355] border border-[#e5d5c5] rounded-2xl flex items-center justify-center mx-auto">
                  <ShoppingBag size={32} />
                </div>
                <h4 className="text-xl font-serif font-bold text-[#2c1810] capitalize">No {orderSubTab} Order Requests</h4>
                <p className="text-sm text-[#8b7355] max-w-md mx-auto">
                  When customers scan QR codes at tables and submit orders, they will appear here for your review and approval.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {orderRequests.filter(o => o.status === orderSubTab).map((order) => (
                  <div key={order.id} className="bg-white rounded-3xl p-6 shadow-sm border border-[#e5d5c5] space-y-5 flex flex-col justify-between hover:shadow-md transition-all">
                    {/* Header Info */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          {order.status === "approved" && (
                            <input
                              type="checkbox"
                              checked={selectedOrderIds.includes(order.id)}
                              onChange={() => toggleOrderSelection(order.id)}
                              className="w-4 h-4 accent-[#d4af37] rounded cursor-pointer mr-1"
                            />
                          )}
                          <span className="px-3 py-1 bg-[#2c1810] text-[#d4af37] font-bold text-xs rounded-full">
                            {order.tableNumber?.toString().toLowerCase().startsWith("table") ? order.tableNumber : `Table ${order.tableNumber}`}
                          </span>
                          <span className={cn(
                            "px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md border",
                            order.status === "pending" && "bg-blue-50 text-blue-700 border-blue-200",
                            order.status === "approved" && "bg-amber-50 text-amber-700 border-amber-200",
                            order.status === "completed" && "bg-green-50 text-green-700 border-green-200",
                            order.status === "rejected" && "bg-red-50 text-red-700 border-red-200"
                          )}>
                            {order.status === "approved" ? "active" : order.status}
                          </span>
                        </div>
                        <span className="text-xs sm:text-sm font-bold text-[#2c1810] bg-[#fdfaf6] border-2 border-[#d4af37]/60 px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-mono shadow-sm hover:border-[#d4af37] transition-all">
                          <Clock size={15} className="text-[#d4af37] shrink-0" />
                          {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                        </span>
                      </div>

                      {/* Customer Details */}
                      <div className="bg-[#fdfaf6] p-4 rounded-2xl border border-[#e5d5c5] flex justify-between items-center">
                        <div>
                          <p className="text-xs text-[#8b7355] font-bold uppercase tracking-wider">Customer Name</p>
                          <p className="text-sm font-bold text-[#2c1810]">{order.customerName || 'Guest'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-[#8b7355] font-bold uppercase tracking-wider">Mobile Number</p>
                          <a 
                            href={`tel:${order.customerPhone}`} 
                            className="text-sm font-bold text-[#2c1810] hover:text-[#d4af37] font-mono flex items-center gap-1 justify-end"
                          >
                            <Phone size={12} />
                            {order.customerPhone}
                          </a>
                        </div>
                      </div>

                      {/* Items List */}
                      <div className="space-y-2 pt-2">
                        <p className="text-xs font-bold uppercase tracking-widest text-[#8b7355]">Ordered Dishes</p>
                        <div className="divide-y divide-[#e5d5c5] bg-[#fdfaf6]/50 rounded-xl p-3 border border-[#e5d5c5]">
                          {order.items?.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center py-1.5 text-xs">
                              <span className="font-medium text-[#2c1810]">
                                <span className="font-bold text-[#d4af37] mr-2">{item.quantity}x</span>
                                {item.name}
                              </span>
                              <span className="font-bold text-[#5c4033]">
                                Rs {(item.subtotal || (item.price * item.quantity)).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Total & Action Buttons */}
                    <div className="pt-4 border-t border-[#e5d5c5] space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs uppercase font-bold text-[#8b7355] tracking-widest">Total Amount</span>
                        <span className="text-xl font-bold text-[#2c1810]">Rs {order.totalAmount?.toFixed(2)}</span>
                      </div>

                      {order.status === "pending" && (
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleRejectOrder(order.id)}
                            className="flex-1 border border-red-200 text-red-600 hover:bg-red-50 py-2.5 rounded-xl font-medium text-xs transition-all flex items-center justify-center gap-1.5"
                          >
                            <XCircle size={16} />
                            Decline Request
                          </button>
                          <button
                            onClick={() => handleApproveOrder(order.id)}
                            className="flex-1 bg-green-700 text-white hover:bg-green-800 py-2.5 rounded-xl font-medium text-xs transition-all shadow-md flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle2 size={16} />
                            Approve Order
                          </button>
                        </div>
                      )}

                      {order.status === "approved" && (
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              setSelectedOrderIds([order.id]);
                              setIsBulkPrintModalOpen(true);
                            }}
                            className="flex-1 bg-[#2c1810] text-[#d4af37] border border-[#d4af37]/40 hover:bg-[#4a2c1d] py-2.5 rounded-xl font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 group"
                          >
                            <Receipt size={16} className="group-hover:scale-110 transition-transform text-[#d4af37]" />
                            Generate GST Bill
                          </button>
                          <button
                            onClick={() => handleCompleteOrder(order.id)}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle2 size={16} />
                            Mark as Completed
                          </button>
                        </div>
                      )}

                      {order.status === "completed" && (
                        <button
                          onClick={() => {
                            setSelectedOrderIds([order.id]);
                            setIsBulkPrintModalOpen(true);
                          }}
                          className="w-full bg-[#2c1810] text-[#d4af37] border border-[#d4af37]/40 hover:bg-[#4a2c1d] py-2.5 rounded-xl font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 group"
                        >
                          <Receipt size={16} className="group-hover:scale-110 transition-transform text-[#d4af37]" />
                          Generate GST Bill
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "qr" && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-[#e5d5c5]">
              <div>
                <h3 className="text-xl font-serif font-bold text-[#2c1810]">Table QR Code Management</h3>
                <p className="text-sm text-[#8b7355]">Add, edit, modify or remove tables and export high-resolution QR codes.</p>
              </div>
              <div className="flex gap-3">
                {tables.length === 0 && (
                  <button 
                    onClick={seedDefaultTables}
                    className="flex items-center gap-2 bg-[#fdfaf6] border border-[#e5d5c5] text-[#2c1810] px-4 py-2.5 rounded-xl hover:bg-white transition-all text-sm font-medium"
                  >
                    Seed Default Tables (1-6)
                  </button>
                )}
                <button 
                  onClick={() => setIsAddingTable(true)}
                  className="flex items-center gap-2 bg-[#2c1810] text-[#fdfaf6] px-4 py-2.5 rounded-xl hover:bg-[#4a2c1d] transition-all text-sm font-medium shadow-lg"
                >
                  <Plus size={18} />
                  Add New Table
                </button>
              </div>
            </div>

            {tables.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl shadow-sm border border-[#e5d5c5] text-center space-y-4">
                <div className="w-16 h-16 bg-[#fdfaf6] text-[#d4af37] border border-[#e5d5c5] rounded-2xl flex items-center justify-center mx-auto">
                  <QrCode size={32} />
                </div>
                <h4 className="text-xl font-serif font-bold text-[#2c1810]">No Tables Found in Firestore</h4>
                <p className="text-sm text-[#8b7355] max-w-md mx-auto">
                  Add your restaurant tables below. Every table added will be stored directly into your Firebase Firestore database.
                </p>
                <div className="flex flex-wrap justify-center gap-4 pt-2">
                  <button 
                    onClick={() => setIsAddingTable(true)}
                    className="flex items-center gap-2 bg-[#2c1810] text-[#fdfaf6] px-6 py-3 rounded-xl hover:bg-[#4a2c1d] transition-all text-sm font-medium shadow-lg"
                  >
                    <Plus size={18} />
                    Add Table to Firestore
                  </button>
                  <button 
                    onClick={seedDefaultTables}
                    className="flex items-center gap-2 bg-[#fdfaf6] border border-[#e5d5c5] text-[#2c1810] px-6 py-3 rounded-xl hover:bg-white transition-all text-sm font-medium"
                  >
                    Seed Standard Tables (1-6) to Firestore
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {tables.map((table) => (
                  <div key={table.id} className="bg-white p-8 rounded-3xl shadow-sm border border-[#e5d5c5] text-center group hover:shadow-xl transition-all relative">
                    <div className="absolute top-4 right-4 flex gap-1">
                      <button 
                        onClick={() => setIsEditingTable(table)}
                        className="p-2 text-[#8b7355] hover:text-[#d4af37] hover:bg-[#fdfaf6] rounded-lg transition-all"
                        title="Modify Table"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDeleteTable(table.id)}
                        className="p-2 text-[#8b7355] hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete Table"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    <div className="mb-6 flex justify-center pt-2">
                      <div className="p-4 bg-white border-2 border-[#2c1810] rounded-2xl shadow-inner">
                        <QRCodeSVG 
                          id={`qr-table-${table.id}`}
                          value={`${window.location.origin}/${table.tableNumber || table.id}`} 
                          size={160}
                          fgColor="#2c1810"
                        />
                      </div>
                    </div>

                    <h3 className="text-xl font-serif font-bold text-[#2c1810] mb-1">{table.name}</h3>
                    {table.location && (
                      <span className="inline-block px-3 py-1 text-xs bg-[#fdfaf6] text-[#5c4033] border border-[#e5d5c5] rounded-full mb-3 font-medium">
                        📍 {table.location}
                      </span>
                    )}
                    <p className="text-xs text-[#8b7355] mb-6">Scan code maps to Table ID: {table.tableNumber}</p>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => downloadQRCode(`qr-table-${table.id}`, table.name)}
                        className="flex-1 bg-[#2c1810] text-[#fdfaf6] py-2.5 rounded-xl text-sm font-medium hover:bg-[#4a2c1d] transition-all shadow-md flex items-center justify-center gap-2"
                      >
                        <QrCode size={16} />
                        Download QR
                      </button>
                      <button 
                        onClick={() => navigate(`/admin/table-history/${table.id}`)}
                        className="flex-1 bg-[#fdfaf6] border border-[#e5d5c5] text-[#2c1810] py-2.5 rounded-xl text-sm font-medium hover:bg-[#d4af37]/10 transition-all shadow-md flex items-center justify-center gap-2"
                      >
                        <History size={16} />
                        History
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === "analytics" && (
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-[#e5d5c5]">
              <h3 className="text-xl font-serif font-bold mb-8">Scan Activity (Last 30 Days)</h3>
              <div className="h-64 flex items-end gap-2 px-4">
                {/* Simple bar chart mock */}
                {Array.from({ length: 14 }).map((_, i) => {
                  const height = Math.floor(Math.random() * 80) + 20;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                      <div 
                        className="w-full bg-[#d4af37] rounded-t-lg transition-all hover:bg-[#2c1810]" 
                        style={{ height: `${height}%` }}
                      />
                      <span className="text-[8px] text-[#8b7355] uppercase font-bold">Day {i + 1}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-[#e5d5c5]">
                <h3 className="text-lg font-serif font-bold mb-6">Traffic Sources</h3>
                <div className="space-y-4">
                  {[
                    { label: "Mobile (iOS)", value: "65%", color: "bg-blue-500" },
                    { label: "Mobile (Android)", value: "28%", color: "bg-green-500" },
                    { label: "Desktop", value: "7%", color: "bg-gray-400" },
                  ].map((source, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-[#5c4033]">{source.label}</span>
                        <span className="font-bold">{source.value}</span>
                      </div>
                      <div className="h-2 bg-[#fdfaf6] rounded-full overflow-hidden">
                        <div className={cn("h-full", source.color)} style={{ width: source.value }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-[#e5d5c5]">
                <h3 className="text-lg font-serif font-bold mb-6">Peak Hours</h3>
                <div className="space-y-4">
                  {[
                    { time: "12:00 PM - 2:00 PM", level: "High", color: "text-red-500" },
                    { time: "7:00 PM - 9:00 PM", level: "Peak", color: "text-red-600 font-bold" },
                    { time: "3:00 PM - 5:00 PM", level: "Low", color: "text-green-500" },
                  ].map((peak, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-[#fdfaf6] rounded-xl">
                      <span className="text-sm text-[#5c4033]">{peak.time}</span>
                      <span className={cn("text-xs uppercase tracking-widest", peak.color)}>{peak.level}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === "settings" && (
          <div className="max-w-2xl space-y-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-[#e5d5c5]">
              <h3 className="text-xl font-serif font-bold mb-6 flex items-center gap-2">
                <Settings size={20} className="text-[#d4af37]" />
                Menu Customization
              </h3>
              <form onSubmit={handleUpdateSettings} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#8b7355]">Spicy Indicator Label</label>
                  <input 
                    name="spicyLabel" 
                    defaultValue={settings.spicyLabel}
                    className="w-full bg-[#fdfaf6] border border-[#e5d5c5] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/20" 
                    placeholder="e.g. Spicy Dish"
                  />
                  <p className="text-[10px] text-[#8b7355]">This label will appear in the Admin forms.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#8b7355]">Vegetarian Indicator Label</label>
                  <input 
                    name="vegetarianLabel" 
                    defaultValue={settings.vegetarianLabel}
                    className="w-full bg-[#fdfaf6] border border-[#e5d5c5] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/20" 
                    placeholder="e.g. Vegetarian"
                  />
                  <p className="text-[10px] text-[#8b7355]">This label will appear in the Admin forms.</p>
                </div>
                <button type="submit" className="w-full bg-[#2c1810] text-[#fdfaf6] py-3 rounded-xl font-bold hover:bg-[#4a2c1d] transition-all shadow-lg flex items-center justify-center gap-2">
                  <Save size={18} />
                  Save Settings
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Add/Edit Item Modal */}
      <AnimatePresence>
        {(isAddingItem || isEditingItem) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsAddingItem(false); setIsEditingItem(null); }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-[#fdfaf6] w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-[#e5d5c5] max-h-[90vh] flex flex-col z-10"
            >
              <div className="p-4 sm:p-8 border-b border-[#e5d5c5] flex justify-between items-center bg-white shrink-0">
                <h3 className="text-xl sm:text-2xl font-serif font-bold text-[#2c1810]">
                  {isEditingItem ? "Edit Menu Item" : "Add New Menu Item"}
                </h3>
                <button onClick={() => { setIsAddingItem(false); setIsEditingItem(null); }} className="p-2 text-[#8b7355] hover:text-[#2c1810]">
                  <X size={20} className="sm:w-6 sm:h-6" />
                </button>
              </div>
              <form onSubmit={handleAddItem} className="p-4 sm:p-8 space-y-4 sm:space-y-6 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#8b7355]">Item Name</label>
                    <input 
                      name="name" 
                      required 
                      defaultValue={isEditingItem?.name}
                      className="w-full bg-white border border-[#e5d5c5] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/20" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#8b7355]">Price (Rs)</label>
                    <input 
                      name="price" 
                      type="number" 
                      step="0.01" 
                      required 
                      defaultValue={isEditingItem?.price}
                      className="w-full bg-white border border-[#e5d5c5] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/20" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#8b7355]">Category</label>
                  <select 
                    name="categoryId" 
                    required 
                    defaultValue={isEditingItem?.categoryId}
                    className="w-full bg-white border border-[#e5d5c5] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/20"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#8b7355]">Description</label>
                  <textarea 
                    name="description" 
                    rows={3} 
                    defaultValue={isEditingItem?.description}
                    className="w-full bg-white border border-[#e5d5c5] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/20" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#8b7355]">Image URL</label>
                  <input 
                    name="imageUrl" 
                    defaultValue={isEditingItem?.imageUrl}
                    className="w-full bg-white border border-[#e5d5c5] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/20" 
                    placeholder="https://..." 
                  />
                </div>

                <div className="flex gap-8 pt-4">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      name="isSpicy" 
                      defaultChecked={isEditingItem?.isSpicy}
                      className="w-5 h-5 rounded border-[#e5d5c5] text-[#d4af37] focus:ring-[#d4af37]/20" 
                    />
                    <span className="text-sm font-medium text-[#5c4033] group-hover:text-[#2c1810]">{settings.spicyLabel}</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      name="isVegetarian" 
                      defaultChecked={isEditingItem?.isVegetarian}
                      className="w-5 h-5 rounded border-[#e5d5c5] text-[#d4af37] focus:ring-[#d4af37]/20" 
                    />
                    <span className="text-sm font-medium text-[#5c4033] group-hover:text-[#2c1810]">{settings.vegetarianLabel}</span>
                  </label>
                </div>

                <div className="pt-6 flex gap-4">
                  <button 
                    type="button" 
                    onClick={() => { setIsAddingItem(false); setIsEditingItem(null); }} 
                    className="flex-1 px-6 py-3 border border-[#e5d5c5] rounded-xl text-[#5c4033] font-medium hover:bg-white transition-all"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 px-6 py-3 bg-[#2c1810] text-[#fdfaf6] rounded-xl font-medium hover:bg-[#4a2c1d] transition-all shadow-lg">
                    {isEditingItem ? "Update Item" : "Save Item"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {(isAddingCategory || isEditingCategory) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsAddingCategory(false); setIsEditingCategory(null); }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-[#fdfaf6] w-full max-w-md rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-[#e5d5c5] max-h-[90vh] flex flex-col z-10"
            >
              <div className="p-4 sm:p-8 border-b border-[#e5d5c5] flex justify-between items-center bg-white shrink-0">
                <h3 className="text-xl sm:text-2xl font-serif font-bold text-[#2c1810]">
                  {isEditingCategory ? "Edit Category" : "Add Category"}
                </h3>
                <button onClick={() => { setIsAddingCategory(false); setIsEditingCategory(null); }} className="p-2 text-[#8b7355] hover:text-[#2c1810]">
                  <X size={20} className="sm:w-6 sm:h-6" />
                </button>
              </div>
              <form onSubmit={handleAddCategory} className="p-4 sm:p-8 space-y-4 sm:space-y-6 overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#8b7355]">Category Name</label>
                  <input 
                    name="name" 
                    required 
                    defaultValue={isEditingCategory?.name}
                    className="w-full bg-white border border-[#e5d5c5] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/20" 
                    placeholder="e.g. Desserts" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#8b7355]">Display Order</label>
                  <input 
                    name="order" 
                    type="number" 
                    defaultValue={isEditingCategory?.order}
                    className="w-full bg-white border border-[#e5d5c5] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/20" 
                    placeholder="1" 
                  />
                </div>
                <div className="pt-6 flex gap-4">
                  <button type="button" onClick={() => { setIsAddingCategory(false); setIsEditingCategory(null); }} className="flex-1 px-6 py-3 border border-[#e5d5c5] rounded-xl text-[#5c4033] font-medium hover:bg-white transition-all">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 px-6 py-3 bg-[#2c1810] text-[#fdfaf6] rounded-xl font-medium hover:bg-[#4a2c1d] transition-all shadow-lg">
                    {isEditingCategory ? "Update Category" : "Add Category"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
        {(isAddingTable || isEditingTable) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsAddingTable(false); setIsEditingTable(null); }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-[#fdfaf6] w-full max-w-md rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-[#e5d5c5] max-h-[90vh] flex flex-col z-10"
            >
              <div className="p-4 sm:p-8 border-b border-[#e5d5c5] flex justify-between items-center bg-white shrink-0">
                <h3 className="text-xl sm:text-2xl font-serif font-bold text-[#2c1810]">
                  {isEditingTable ? "Modify Table" : "Add New Table"}
                </h3>
                <button onClick={() => { setIsAddingTable(false); setIsEditingTable(null); }} className="p-2 text-[#8b7355] hover:text-[#2c1810]">
                  <X size={20} className="sm:w-6 sm:h-6" />
                </button>
              </div>
              <form onSubmit={handleAddTable} className="p-4 sm:p-8 space-y-4 sm:space-y-6 overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#8b7355]">Table Display Name</label>
                  <input 
                    name="name" 
                    required 
                    defaultValue={isEditingTable?.name || (isAddingTable ? `Table ${tables.length + 1}` : "")}
                    className="w-full bg-white border border-[#e5d5c5] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/20" 
                    placeholder="e.g. Table 7 or VIP Booth 1" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#8b7355]">Table Number / QR Code ID</label>
                  <input 
                    name="tableNumber" 
                    required 
                    defaultValue={isEditingTable?.tableNumber || (tables.length + 1)}
                    className="w-full bg-white border border-[#e5d5c5] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/20" 
                    placeholder="e.g. 7 or T7" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#8b7355]">Location / Section (Optional)</label>
                  <input 
                    name="location" 
                    defaultValue={isEditingTable?.location || ""}
                    className="w-full bg-white border border-[#e5d5c5] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/20" 
                    placeholder="e.g. Main Hall, Patio, VIP Area" 
                  />
                </div>
                <div className="pt-6 flex gap-4">
                  <button type="button" onClick={() => { setIsAddingTable(false); setIsEditingTable(null); }} className="flex-1 px-6 py-3 border border-[#e5d5c5] rounded-xl text-[#5c4033] font-medium hover:bg-white transition-all">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 px-6 py-3 bg-[#2c1810] text-[#fdfaf6] rounded-xl font-medium hover:bg-[#4a2c1d] transition-all shadow-lg">
                    {isEditingTable ? "Update Table" : "Save Table"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isBulkPrintModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 print:p-0 print:static print:bg-white">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBulkPrintModalOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm print-hide"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border border-[#e5d5c5] my-6 max-h-[90vh] flex flex-col print-bulk-modal print:max-h-none print:w-full print:m-0"
            >
              {/* Top Control Bar */}
              <div className="p-4 bg-[#2c1810] text-white flex justify-between items-center print-hide shrink-0">
                <div className="flex items-center gap-2">
                  <Receipt className="text-[#d4af37]" size={20} />
                  <span className="font-serif font-bold text-sm text-[#d4af37]">
                    {selectedOrderIds.length === 1 
                      ? `GST Restaurant Tax Invoice (Order #${orderRequests.find(o => o.id === selectedOrderIds[0])?.id.slice(-6).toUpperCase() || ''})`
                      : `Bulk GST Bills (${selectedOrderIds.length} Selected) - 4 per A4 Sheet Layout`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 bg-[#d4af37] text-[#140c0a] px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#e6c250] transition-all shadow"
                  >
                    <Printer size={16} />
                    {selectedOrderIds.length === 1 ? "Print Bill" : "Print All Bills"}
                  </button>
                  <button
                    onClick={() => setIsBulkPrintModalOpen(false)}
                    className="p-1.5 text-[#8b7355] hover:text-white rounded-lg hover:bg-white/10"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Printable Grid of Bills (4 per page in print) */}
              <div className="p-6 overflow-y-auto bg-slate-50 print:bg-white print:p-0 print:overflow-visible">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print-bulk-grid">
                  {orderRequests
                    .filter(o => selectedOrderIds.includes(o.id))
                    .map((order) => {
                      const itemsSubtotal = order.items?.reduce((sum, item) => sum + (item.subtotal || (item.price * item.quantity)), 0) || order.totalAmount || 0;
                      const cgst = itemsSubtotal * 0.025;
                      const sgst = itemsSubtotal * 0.025;
                      const grossTotal = itemsSubtotal + cgst + sgst;
                      const grandTotalRounded = Math.round(grossTotal);
                      const roundOff = grandTotalRounded - grossTotal;

                      return (
                        <div key={order.id} className="bg-white p-3 rounded-xl border border-slate-300 font-mono text-[9px] text-slate-900 space-y-1.5 print-bulk-card leading-tight">
                          {/* Header */}
                          <div className="text-center space-y-0.5 border-b border-dashed border-slate-400 pb-1.5">
                            <h2 className="text-xs font-extrabold uppercase tracking-wide text-black">foQR RESTAURANT</h2>
                            <p className="text-[8px] text-slate-700">FINE DINING & MULTI CUISINE</p>
                            <p className="text-[7.5px] text-slate-600">Plot 42, Food Court, Cyber Hub, Sector 29, Gurugram | Ph: +91 98765 43210</p>
                            <div className="text-[7.5px] font-bold text-slate-800 pt-0.5">
                              GSTIN: 07AAAAA0000A1Z5 | FSSAI: 10021011000432 | SAC: 996331
                            </div>
                          </div>

                          <div className="text-center bg-slate-100 py-0.5 font-bold border border-slate-300 text-[8px] uppercase">
                            TAX INVOICE / CASH MEMO
                          </div>

                          {/* Details */}
                          <div className="grid grid-cols-2 text-[8px] border-b border-dashed border-slate-400 pb-1">
                            <div>
                              <p>Bill: <strong className="text-black font-bold">INV-{order.id.slice(-6).toUpperCase()}</strong></p>
                              <p>Table: <strong className="text-black font-bold">{order.tableNumber?.toString().toLowerCase().startsWith("table") ? order.tableNumber : `Table ${order.tableNumber}`}</strong> (Dine-In)</p>
                            </div>
                            <div className="text-right">
                              <p>Date: {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')} {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString('en-IN')}</p>
                              <p>Guest: {order.customerName || 'Guest'} ({order.customerPhone || 'N/A'})</p>
                            </div>
                          </div>

                          {/* Items */}
                          <div>
                            <table className="w-full text-[8px] text-left border-collapse">
                              <thead>
                                <tr className="border-b border-slate-800 font-bold uppercase text-[7.5px]">
                                  <th className="py-0.5 w-3 text-slate-600">#</th>
                                  <th className="py-0.5 text-slate-900">ITEM</th>
                                  <th className="py-0.5 text-center w-6 text-slate-900">QTY</th>
                                  <th className="py-0.5 text-right w-10 text-slate-900">RATE</th>
                                  <th className="py-0.5 text-right w-12 text-slate-900">AMT (₹)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-dashed divide-slate-200">
                                {order.items?.map((item, idx) => {
                                  const price = item.price || (item.subtotal ? item.subtotal / item.quantity : 0);
                                  const amt = item.subtotal || (price * item.quantity);
                                  return (
                                    <tr key={idx} className="py-0.5">
                                      <td className="py-0.5 text-slate-500 font-mono">{idx + 1}</td>
                                      <td className="py-0.5 font-bold text-slate-900">{item.name}</td>
                                      <td className="py-0.5 text-center font-bold">{item.quantity}</td>
                                      <td className="py-0.5 text-right text-slate-700">{price.toFixed(2)}</td>
                                      <td className="py-0.5 text-right font-bold text-black">{amt.toFixed(2)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Total */}
                          <div className="border-t border-b border-dashed border-slate-400 py-1 space-y-0.5 text-[8px]">
                            <div className="flex justify-between text-slate-700">
                              <span>Taxable Amt: ₹{itemsSubtotal.toFixed(2)}</span>
                              <span>CGST (2.5%): ₹{cgst.toFixed(2)} | SGST (2.5%): ₹{sgst.toFixed(2)}</span>
                            </div>
                            {Math.abs(roundOff) > 0.001 && (
                              <div className="flex justify-between text-slate-500 text-[7.5px]">
                                <span>Round Off:</span>
                                <span>{roundOff > 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-extrabold text-[10px] text-black border-t border-slate-800 pt-0.5">
                              <span>NET AMOUNT PAYABLE:</span>
                              <span className="text-xs">₹{grandTotalRounded.toFixed(2)}</span>
                            </div>
                          </div>

                          {/* Footer */}
                          <div className="text-center pt-0.5 space-y-0.5 text-[7.5px] border-t border-dashed border-slate-400">
                            <p className="font-extrabold tracking-wider text-black uppercase">*** THANK YOU FOR DINING WITH US ***</p>
                            <p className="text-slate-600">Computer generated tax invoice. Powered by foQR</p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

