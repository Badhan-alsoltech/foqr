import React, { useEffect, useState } from "react";
import { db, handleFirestoreError, OperationType, getAdminSession, logoutAdmin } from "../firebase";
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { User } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  LayoutDashboard, Utensils, QrCode, BarChart3, Settings, LogOut, 
  Plus, Edit2, Trash2, Save, X, ChevronRight, Image as ImageIcon,
  Flame, Leaf, Check, AlertCircle, TrendingUp, Users, MousePointer2,
  ShoppingBag, CheckCircle2, XCircle, Clock, Phone, History, Receipt, Printer, Menu as MenuIcon,
  ChevronDown, ChevronUp, Search, User as UserIcon, Store, FileText, MapPin, Mail, Percent, Building
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
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
  views?: number;
}

interface Scan {
  id: string;
  qrId: string;
  timestamp: Timestamp;
  userAgent: string;
}

export interface CustomTag {
  id: string;
  label: string;
  color: string;
  enabled: boolean;
}

const DEFAULT_CUSTOM_TAGS: CustomTag[] = [
  { id: "tag_1", label: "Spicy Dish", color: "#ef4444", enabled: true },
  { id: "tag_2", label: "Vegetarian", color: "#22c55e", enabled: true },
  { id: "tag_3", label: "Chef's Special", color: "#f59e0b", enabled: true },
  { id: "tag_4", label: "Gluten-Free", color: "#3b82f6", enabled: true },
  { id: "tag_5", label: "Bestseller", color: "#a855f7", enabled: true },
];

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
  const [activeTab, setActiveTab] = useState<"overview" | "menu" | "orders" | "qr" | "analytics" | "profile" | "settings">("overview");
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
  const [analyticsMetric, setAnalyticsMetric] = useState<"scans" | "orders" | "revenue">("scans");
  const [timeRange, setTimeRange] = useState<"1d" | "7d" | "1m" | "3m" | "6m">("7d");

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

  const [settings, setSettings] = useState<{
    spicyLabel: string;
    vegetarianLabel: string;
    customTags: CustomTag[];
    restaurantName: string;
    restaurantSubtitle: string;
    logoUrl: string;
    address: string;
    phone: string;
    email: string;
    gstin: string;
    fssai: string;
    taxRate: number;
    serviceChargeRate: number;
    billFooter: string;
  }>({
    spicyLabel: "Spicy Dish",
    vegetarianLabel: "Vegetarian",
    customTags: DEFAULT_CUSTOM_TAGS,
    restaurantName: "foQR Restaurant",
    restaurantSubtitle: "FINE DINING & MULTI CUISINE",
    logoUrl: "",
    address: "Plot 42, Food Court, Cyber Hub, Sector 29, Gurugram",
    phone: "+91 98765 43210",
    email: "contact@foqr.com",
    gstin: "07AAAAA0000A1Z5",
    fssai: "10021011000432",
    taxRate: 5,
    serviceChargeRate: 0,
    billFooter: "THANK YOU FOR DINING WITH US",
  });

  const updateCustomTag = (index: number, updatedFields: Partial<CustomTag>) => {
    setSettings(prev => {
      const tags = [...prev.customTags];
      if (tags[index]) {
        tags[index] = { ...tags[index], ...updatedFields };
      }
      return { ...prev, customTags: tags };
    });
  };

  const handleAddCustomTag = () => {
    setSettings(prev => ({
      ...prev,
      customTags: [
        ...prev.customTags,
        {
          id: `tag_${Date.now()}`,
          label: `New Tag ${prev.customTags.length + 1}`,
          color: "#3b82f6",
          enabled: true,
        }
      ]
    }));
  };

  const handleDeleteCustomTag = (index: number) => {
    setSettings(prev => ({
      ...prev,
      customTags: prev.customTags.filter((_, i) => i !== index)
    }));
  };
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Form states
  const [isEditingItem, setIsEditingItem] = useState<MenuItem | null>(null);
  const [isEditingCategory, setIsEditingCategory] = useState<Category | null>(null);
  const [isEditingTable, setIsEditingTable] = useState<Table | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isAddingTable, setIsAddingTable] = useState(false);

  const [selectedRecIds, setSelectedRecIds] = useState<string[]>([]);
  const [recSearchQuery, setRecSearchQuery] = useState("");
  const [menuSearchQuery, setMenuSearchQuery] = useState("");
  const [categorySearchQuery, setCategorySearchQuery] = useState("");

  useEffect(() => {
    if (isEditingItem) {
      setSelectedRecIds(isEditingItem.recommendedItemIds || []);
      setRecSearchQuery("");
    } else if (isAddingItem) {
      setSelectedRecIds([]);
      setRecSearchQuery("");
    }
  }, [isEditingItem, isAddingItem]);

  useEffect(() => {
    // Safety fallback timer to ensure screen never gets stuck loading forever
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
    }, 2000);

    const session = getAdminSession();
    if (!session) {
      navigate("/login");
    } else {
      setUser({ uid: "admin", email: "admin@hotel.com", displayName: session.userId } as any);
    }

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
        const data = snapshot.data();
        setSettings({
          spicyLabel: data.spicyLabel || "Spicy Dish",
          vegetarianLabel: data.vegetarianLabel || "Vegetarian",
          customTags: Array.isArray(data.customTags) ? data.customTags : DEFAULT_CUSTOM_TAGS,
          restaurantName: data.restaurantName || "foQR Restaurant",
          restaurantSubtitle: data.restaurantSubtitle || "FINE DINING & MULTI CUISINE",
          logoUrl: data.logoUrl || "",
          address: data.address || "Plot 42, Food Court, Cyber Hub, Sector 29, Gurugram",
          phone: data.phone || "+91 98765 43210",
          email: data.email || "contact@foqr.com",
          gstin: data.gstin || "07AAAAA0000A1Z5",
          fssai: data.fssai || "10021011000432",
          taxRate: data.taxRate !== undefined ? Number(data.taxRate) : 5,
          serviceChargeRate: data.serviceChargeRate !== undefined ? Number(data.serviceChargeRate) : 0,
          billFooter: data.billFooter || "THANK YOU FOR DINING WITH US",
        });
      }
    });

    return () => {
      clearTimeout(loadingTimeout);
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
    logoutAdmin();
    navigate("/login");
  };

  const handleAddItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const selectedTags = formData.getAll("tags") as string[];

    const itemData = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      price: parseFloat(formData.get("price") as string),
      categoryId: formData.get("categoryId") as string,
      imageUrl: normalizeImageUrl(formData.get("imageUrl") as string),
      isAvailable: true,
      isSpicy: selectedTags.includes("tag_1") || formData.get("isSpicy") === "on",
      isVegetarian: selectedTags.includes("tag_2") || formData.get("isVegetarian") === "on",
      tags: selectedTags,
      recommendedItemIds: selectedRecIds,
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
      console.error("Failed to save table:", error);
      alert("Failed to save table: " + (error instanceof Error ? error.message : String(error)));
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

  // Generate a single vintage stand card canvas for a given SVG element + table name
  const generateCardCanvas = (svgElement: SVGElement, tableName: string): Promise<HTMLCanvasElement> => {
    return new Promise((resolve, reject) => {
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const qrImage = new Image();

      qrImage.onload = async () => {
        const canvas = document.createElement("canvas");
        const W = 800;
        const H = 1200;
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas context failed")); return; }

        const GOLD = "#c59b27";
        const GOLD_LIGHT = "#d4af37";
        const NAVY = "#1b365d";
        const CREAM = "#faf6ee";

        const drawLeaf = (x: number, y: number, len: number, angle: number, color: string) => {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(angle);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(len * 0.35, -len * 0.5, 0, -len);
          ctx.quadraticCurveTo(-len * 0.35, -len * 0.5, 0, 0);
          ctx.fill();
          ctx.strokeStyle = CREAM;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(0, -2);
          ctx.lineTo(0, -len * 0.85);
          ctx.stroke();
          ctx.restore();
        };

        const drawFlower = (fx: number, fy: number, radius: number, color: string, centerColor: string) => {
          ctx.save();
          ctx.translate(fx, fy);
          const petals = 8;
          ctx.fillStyle = color;
          for (let i = 0; i < petals; i++) {
            const angle = (i / petals) * Math.PI * 2;
            ctx.save(); ctx.rotate(angle);
            ctx.beginPath();
            ctx.ellipse(0, -radius * 0.55, radius * 0.45, radius * 0.65, 0, 0, Math.PI * 2);
            ctx.fill(); ctx.restore();
          }
          for (let i = 0; i < petals; i++) {
            const angle = (i / petals) * Math.PI * 2 + Math.PI / petals;
            ctx.save(); ctx.rotate(angle);
            ctx.beginPath();
            ctx.ellipse(0, -radius * 0.35, radius * 0.3, radius * 0.45, 0, 0, Math.PI * 2);
            ctx.fill(); ctx.restore();
          }
          ctx.fillStyle = centerColor;
          ctx.beginPath();
          ctx.arc(0, 0, radius * 0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        };

        const drawBaroqueCorner = (ox: number, oy: number, sx: number, sy: number) => {
          ctx.save();
          ctx.translate(ox, oy);
          ctx.scale(sx, sy);
          ctx.strokeStyle = GOLD; ctx.fillStyle = GOLD; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(8, 120); ctx.bezierCurveTo(8, 60, 30, 20, 80, 10); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(120, 8); ctx.bezierCurveTo(60, 8, 20, 30, 10, 80); ctx.stroke();
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(80, 10); ctx.bezierCurveTo(110, 10, 130, 18, 140, 30); ctx.bezierCurveTo(150, 45, 135, 55, 120, 50); ctx.bezierCurveTo(105, 45, 100, 35, 110, 25); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(10, 80); ctx.bezierCurveTo(10, 110, 18, 130, 30, 140); ctx.bezierCurveTo(45, 150, 55, 135, 50, 120); ctx.bezierCurveTo(45, 105, 35, 100, 25, 110); ctx.stroke();
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(25, 25); ctx.bezierCurveTo(40, 15, 60, 20, 55, 40); ctx.bezierCurveTo(50, 55, 35, 50, 35, 40); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(25, 25); ctx.bezierCurveTo(15, 40, 20, 60, 40, 55); ctx.bezierCurveTo(55, 50, 50, 35, 40, 35); ctx.stroke();
          ctx.lineWidth = 1.5;
          [{x:95,y:18,a:-0.3,l:16},{x:115,y:22,a:-0.5,l:14},{x:130,y:32,a:-0.8,l:12}].forEach(lp => {
            ctx.save(); ctx.translate(lp.x, lp.y); ctx.rotate(lp.a);
            ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(lp.l*0.4,-lp.l*0.5,0,-lp.l); ctx.quadraticCurveTo(-lp.l*0.4,-lp.l*0.5,0,0); ctx.fill(); ctx.restore();
          });
          [{x:18,y:95,a:0.3+Math.PI/2,l:16},{x:22,y:115,a:0.5+Math.PI/2,l:14},{x:32,y:130,a:0.8+Math.PI/2,l:12}].forEach(lp => {
            ctx.save(); ctx.translate(lp.x, lp.y); ctx.rotate(lp.a);
            ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(lp.l*0.4,-lp.l*0.5,0,-lp.l); ctx.quadraticCurveTo(-lp.l*0.4,-lp.l*0.5,0,0); ctx.fill(); ctx.restore();
          });
          ctx.beginPath(); ctx.arc(42, 42, 5, 0, Math.PI * 2); ctx.fill();
          [[65,12],[75,15],[12,65],[15,75],[130,45],[45,130]].forEach(([dx,dy]) => { ctx.beginPath(); ctx.arc(dx,dy,2.5,0,Math.PI*2); ctx.fill(); });
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(140, 8); ctx.lineTo(170, 8); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(8, 140); ctx.lineTo(8, 170); ctx.stroke();
          ctx.restore();
        };

        const drawSideScrollwork = (sx: number, sy: number, flipX: boolean) => {
          ctx.save();
          ctx.translate(sx, sy);
          if (flipX) ctx.scale(-1, 1);
          ctx.strokeStyle = GOLD; ctx.fillStyle = GOLD; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(0, -80); ctx.bezierCurveTo(-30, -60, -40, -30, -30, 0); ctx.bezierCurveTo(-20, 30, -35, 60, -10, 80); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-30, -50); ctx.bezierCurveTo(-55, -45, -60, -25, -45, -15); ctx.bezierCurveTo(-30, -5, -20, -20, -30, -30); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-25, 50); ctx.bezierCurveTo(-55, 45, -60, 25, -45, 15); ctx.bezierCurveTo(-30, 5, -20, 20, -30, 30); ctx.stroke();
          [{x:-48,y:-35,a:0.3,l:15},{x:-50,y:-15,a:-0.2,l:12},{x:-48,y:35,a:-0.3,l:15},{x:-50,y:15,a:0.2,l:12}].forEach(lp => {
            ctx.save(); ctx.translate(lp.x, lp.y); ctx.rotate(lp.a);
            ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(lp.l*0.4,-lp.l*0.5,0,-lp.l); ctx.quadraticCurveTo(-lp.l*0.4,-lp.l*0.5,0,0); ctx.fill(); ctx.restore();
          });
          [[-35,-65],[-40,0],[-35,65],[-20,-40],[-20,40]].forEach(([dx,dy]) => { ctx.beginPath(); ctx.arc(dx,dy,2.5,0,Math.PI*2); ctx.fill(); });
          ctx.restore();
        };

        // 1. Background
        ctx.fillStyle = CREAM;
        ctx.fillRect(0, 0, W, H);

        // 2. Double gold border
        ctx.lineWidth = 3; ctx.strokeStyle = GOLD; ctx.strokeRect(28, 28, W - 56, H - 56);
        ctx.lineWidth = 1.5; ctx.strokeStyle = GOLD_LIGHT; ctx.strokeRect(36, 36, W - 72, H - 72);

        // 3. Corners
        drawBaroqueCorner(28, 28, 1, 1);
        drawBaroqueCorner(W - 28, 28, -1, 1);
        drawBaroqueCorner(28, H - 28, 1, -1);
        drawBaroqueCorner(W - 28, H - 28, -1, -1);

        // 4. Logo
        let logoLoaded = false;
        if (settings.logoUrl) {
          try {
            const normalized = normalizeImageUrl(settings.logoUrl);
            const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(normalized)}`;
            let activeImg: HTMLImageElement | null = null;
            await new Promise((res) => {
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.onload = () => { activeImg = img; res(true); };
              img.onerror = () => {
                const fb = new Image(); fb.crossOrigin = "anonymous";
                fb.onload = () => { activeImg = fb; res(true); };
                fb.onerror = () => res(false);
                fb.src = normalized;
              };
              img.src = proxyUrl;
            });
            if (activeImg && (activeImg as HTMLImageElement).width > 0 && (activeImg as HTMLImageElement).height > 0) {
              const li = activeImg as HTMLImageElement;
              const mxW = 200, mxH = 100;
              const ratio = Math.min(mxW / li.width, mxH / li.height);
              const dW = li.width * ratio, dH = li.height * ratio;
              ctx.drawImage(li, (W - dW) / 2, 60 + (100 - dH) / 2, dW, dH);
              logoLoaded = true;
            }
          } catch (_e) { logoLoaded = false; }
        }

        if (!logoLoaded) {
          ctx.save();
          const cx = W / 2, cy = 100;
          ctx.strokeStyle = NAVY; ctx.fillStyle = NAVY; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(cx - 30, cy + 5); ctx.bezierCurveTo(cx - 50, cy - 15, cx - 35, cy - 50, cx - 10, cy - 55); ctx.stroke();
          [{x:cx-42,y:cy-10,a:-0.8,l:18},{x:cx-45,y:cy-25,a:-1.0,l:20},{x:cx-38,y:cy-40,a:-1.3,l:18},{x:cx-25,y:cy-50,a:-1.6,l:16},{x:cx-12,y:cy-55,a:-2.0,l:14},{x:cx-35,y:cy-5,a:-0.4,l:14}].forEach(lp => drawLeaf(lp.x, lp.y, lp.l, lp.a, NAVY));
          ctx.fillStyle = NAVY; ctx.font = "bold 58px Georgia, 'Playfair Display', serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText("H", cx, cy + 5);
          ctx.fillStyle = GOLD; ctx.strokeStyle = GOLD; ctx.lineWidth = 2.5;
          ctx.fillRect(cx + 38, cy - 8, 3.5, 30); ctx.fillRect(cx + 32, cy - 25, 15, 3);
          ctx.fillRect(cx + 33, cy - 35, 2.5, 12); ctx.fillRect(cx + 38, cy - 35, 2.5, 12); ctx.fillRect(cx + 43, cy - 35, 2.5, 12);
          ctx.beginPath(); ctx.moveTo(cx+54,cy-35); ctx.quadraticCurveTo(cx+62,cy-20,cx+55,cy-5); ctx.lineTo(cx+55,cy+22); ctx.lineTo(cx+51,cy+22); ctx.lineTo(cx+51,cy-35); ctx.closePath(); ctx.fill();
          ctx.restore();
        }

        // 5. Restaurant name
        ctx.fillStyle = NAVY; ctx.font = "bold 40px Georgia, 'Playfair Display', serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        ctx.fillText((settings.restaurantName || "THE HARVEST BISTRO").toUpperCase(), W / 2, 200);

        // 6. Subtitle
        const subtitleText = (settings.restaurantSubtitle || "FARM-TO-TABLE CUISINE").toUpperCase();
        ctx.font = "bold 14px 'Segoe UI', Arial, sans-serif";
        ctx.letterSpacing = "3px";
        const stWidth = ctx.measureText(subtitleText).width;
        const lineGap = 12, lineLen = 80, stY = 232;
        ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(W/2 - stWidth/2 - lineGap - lineLen, stY - 4); ctx.lineTo(W/2 - stWidth/2 - lineGap, stY - 4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W/2 + stWidth/2 + lineGap, stY - 4); ctx.lineTo(W/2 + stWidth/2 + lineGap + lineLen, stY - 4); ctx.stroke();
        ctx.fillStyle = NAVY; ctx.fillText(subtitleText, W / 2, stY);

        // 7. QR box
        const qrAreaCX = W / 2, qrAreaCY = 490, outerBoxW = 440, outerBoxH = 440;
        ctx.strokeStyle = GOLD; ctx.lineWidth = 4;
        ctx.strokeRect(qrAreaCX - outerBoxW/2 - 8, qrAreaCY - outerBoxH/2 - 8, outerBoxW + 16, outerBoxH + 16);
        ctx.fillStyle = NAVY; ctx.fillRect(qrAreaCX - outerBoxW/2, qrAreaCY - outerBoxH/2, outerBoxW, outerBoxH);
        ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
        ctx.strokeRect(qrAreaCX - outerBoxW/2 + 10, qrAreaCY - outerBoxH/2 + 10, outerBoxW - 20, outerBoxH - 20);
        const whiteInset = 18;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(qrAreaCX - outerBoxW/2 + whiteInset, qrAreaCY - outerBoxH/2 + whiteInset, outerBoxW - whiteInset*2, outerBoxH - whiteInset*2);
        ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5;
        ctx.strokeRect(qrAreaCX - outerBoxW/2 + whiteInset, qrAreaCY - outerBoxH/2 + whiteInset, outerBoxW - whiteInset*2, outerBoxH - whiteInset*2);
        const qrSize = 360;
        ctx.drawImage(qrImage, qrAreaCX - qrSize/2, qrAreaCY - qrSize/2, qrSize, qrSize);

        // 8. Botanicals
        const botTLx = qrAreaCX - outerBoxW/2 - 20, botTLy = qrAreaCY - outerBoxH/2 - 20;
        drawFlower(botTLx + 10, botTLy + 15, 20, NAVY, GOLD_LIGHT);
        ctx.strokeStyle = NAVY; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(botTLx+20, botTLy+30); ctx.bezierCurveTo(botTLx+45,botTLy+60,botTLx+30,botTLy+100,botTLx+15,botTLy+140); ctx.stroke();
        [{x:botTLx+30,y:botTLy+45,a:0.6,l:22},{x:botTLx+22,y:botTLy+42,a:2.2,l:18},{x:botTLx+40,y:botTLy+65,a:0.4,l:24},{x:botTLx+25,y:botTLy+62,a:2.5,l:20},{x:botTLx+38,y:botTLy+85,a:0.5,l:22},{x:botTLx+22,y:botTLy+80,a:2.3,l:18},{x:botTLx+30,y:botTLy+105,a:0.6,l:20},{x:botTLx+18,y:botTLy+100,a:2.1,l:16},{x:botTLx+22,y:botTLy+125,a:0.8,l:18},{x:botTLx+15,y:botTLy+138,a:1.0,l:14}].forEach(lp => drawLeaf(lp.x, lp.y, lp.l, lp.a, NAVY));
        drawLeaf(botTLx - 5, botTLy + 5, 14, -0.5, NAVY);
        drawLeaf(botTLx + 5, botTLy - 2, 12, -1.2, NAVY);

        const botBRx = qrAreaCX + outerBoxW/2 + 20, botBRy = qrAreaCY + outerBoxH/2 + 20;
        ctx.strokeStyle = NAVY; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(botBRx-20,botBRy-30); ctx.bezierCurveTo(botBRx-45,botBRy-60,botBRx-30,botBRy-100,botBRx-15,botBRy-140); ctx.stroke();
        [{x:botBRx-30,y:botBRy-45,a:0.6+Math.PI,l:22},{x:botBRx-22,y:botBRy-42,a:2.2+Math.PI,l:18},{x:botBRx-40,y:botBRy-65,a:0.4+Math.PI,l:24},{x:botBRx-25,y:botBRy-62,a:2.5+Math.PI,l:20},{x:botBRx-38,y:botBRy-85,a:0.5+Math.PI,l:22},{x:botBRx-22,y:botBRy-80,a:2.3+Math.PI,l:18},{x:botBRx-30,y:botBRy-105,a:0.6+Math.PI,l:20},{x:botBRx-18,y:botBRy-100,a:2.1+Math.PI,l:16},{x:botBRx-22,y:botBRy-125,a:0.8+Math.PI,l:18},{x:botBRx-15,y:botBRy-138,a:1.0+Math.PI,l:14}].forEach(lp => drawLeaf(lp.x, lp.y, lp.l, lp.a, NAVY));
        drawLeaf(botBRx + 5, botBRy - 5, 14, -0.5 + Math.PI, NAVY);
        drawLeaf(botBRx - 5, botBRy + 2, 12, -1.2 + Math.PI, NAVY);

        // 9. Side scrollwork
        drawSideScrollwork(qrAreaCX - outerBoxW/2 - 40, qrAreaCY, false);
        drawSideScrollwork(qrAreaCX + outerBoxW/2 + 40, qrAreaCY, true);

        // 10. Text
        const tableTextClean = (tableName || "TABLE 12").toUpperCase();
        ctx.fillStyle = NAVY; ctx.font = "bold 26px Georgia, 'Playfair Display', serif"; ctx.textAlign = "center";
        ctx.fillText("SCAN TO VIEW MENU", W / 2, 770);
        ctx.fillText(`& ORDER FROM ${tableTextClean}`, W / 2, 806);
        ctx.font = "bold 56px Georgia, 'Playfair Display', serif";
        ctx.fillText(tableTextClean, W / 2, 895);

        // 11. Footer
        ctx.fillStyle = NAVY; ctx.font = "bold 15px 'Segoe UI', Arial, sans-serif";
        ctx.fillText("VIEW MENU  •  ORDER EASILY  •  STAY INFORMED", W / 2, 990);
        ctx.font = "13px 'Segoe UI', Arial, sans-serif";
        const domainName = window.location.hostname !== "localhost" ? window.location.hostname : "www.foqr.com";
        const rName = settings.restaurantName || "Harvest Bistro";
        ctx.fillText(`Powered by ${rName}  |  ${domainName}`, W / 2, 1020);

        resolve(canvas);
      };

      qrImage.onerror = () => reject(new Error("QR image load failed"));
      qrImage.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
    });
  };

  const downloadQRCode = async (elementId: string, fileName: string) => {
    const svg = document.getElementById(elementId);
    if (!svg) return;
    try {
      const canvas = await generateCardCanvas(svg as unknown as SVGElement, fileName);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `${fileName.replace(/\s+/g, '_')}_Vintage_Stand_Card.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    } catch (err) {
      console.error("Failed to generate QR card:", err);
    }
  };

  const printAllQRCards = async () => {
    if (tables.length === 0) { alert("No tables to print."); return; }

    // Generate all card canvases
    const cardCanvases: HTMLCanvasElement[] = [];
    for (const table of tables) {
      const svgEl = document.getElementById(`qr-table-${table.id}`);
      if (!svgEl) continue;
      try {
        const canvas = await generateCardCanvas(svgEl as unknown as SVGElement, table.name);
        cardCanvases.push(canvas);
      } catch (err) {
        console.error(`Failed to generate card for ${table.name}:`, err);
      }
    }

    if (cardCanvases.length === 0) { alert("Failed to generate any QR cards."); return; }

    // Build print HTML: 4 cards per A4 page (2x2 grid)
    const cardsPerPage = 4;
    const totalPages = Math.ceil(cardCanvases.length / cardsPerPage);

    let pagesHtml = "";
    for (let page = 0; page < totalPages; page++) {
      const startIdx = page * cardsPerPage;
      const pageCards = cardCanvases.slice(startIdx, startIdx + cardsPerPage);

      let cardsHtml = "";
      for (const cardCanvas of pageCards) {
        const dataUrl = cardCanvas.toDataURL("image/png");
        cardsHtml += `<div class="card"><img src="${dataUrl}" /></div>`;
      }

      pagesHtml += `<div class="page">${cardsHtml}</div>`;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) { alert("Popup blocked. Please allow popups for this site."); return; }

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Print All QR Table Cards - ${settings.restaurantName || "foQR"}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4 portrait; margin: 8mm; }
    body { font-family: Arial, sans-serif; background: #fff; }
    .page {
      width: 100%;
      height: 100vh;
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr 1fr;
      gap: 4mm;
      page-break-after: always;
      padding: 2mm;
    }
    .page:last-child { page-break-after: avoid; }
    .card {
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .card img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page {
        height: calc(297mm - 16mm);
        width: calc(210mm - 16mm);
      }
      .no-print { display: none !important; }
    }
    .no-print {
      position: fixed;
      top: 0; left: 0; right: 0;
      background: #2c1810;
      color: #fdfaf6;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 100;
      font-size: 14px;
    }
    .no-print button {
      background: #d4af37;
      color: #2c1810;
      border: none;
      padding: 10px 28px;
      border-radius: 8px;
      font-weight: bold;
      font-size: 14px;
      cursor: pointer;
    }
    .no-print button:hover { background: #e6c250; }
  </style>
</head>
<body>
  <div class="no-print">
    <span><strong>${cardCanvases.length}</strong> QR cards across <strong>${totalPages}</strong> A4 page${totalPages > 1 ? 's' : ''} (4 cards per page)</span>
    <button onclick="window.print()">🖨️ Print Now</button>
  </div>
  ${pagesHtml}
  <script>
    setTimeout(function() { window.print(); }, 600);
  </script>
</body>
</html>`);
    printWindow.document.close();
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
    try {
      await setDoc(doc(db, "settings", "general"), settings);
      alert("Settings and Menu Customization Tags saved successfully!");
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
            { id: "profile", icon: Store, label: "Restaurant Profile" },
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
                { label: "Active QR Codes", value: tables.length, icon: QrCode, color: "bg-green-500" },
                { 
                  label: "Pending Orders", 
                  value: orderRequests.filter(o => o.status === "pending").length, 
                  icon: Clock, 
                  color: "bg-amber-500" 
                },
                { 
                  label: "Total Revenue", 
                  value: `Rs ${orderRequests.filter(o => o.status === "completed").reduce((sum, o) => sum + (o.totalAmount || 0), 0).toFixed(0)}`, 
                  icon: Receipt, 
                  color: "bg-emerald-600" 
                },
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
                  {scans.length === 0 ? (
                    <p className="text-sm text-[#8b7355] italic text-center py-6">No scan records recorded yet.</p>
                  ) : (
                    scans.slice(0, 5).map((scan) => (
                      <div key={scan.id} className="flex items-center justify-between p-4 bg-[#fdfaf6] rounded-xl border border-[#e5d5c5]">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#2c1810] rounded-lg flex items-center justify-center text-[#d4af37]">
                            <QrCode size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[#2c1810]">
                              Table {scan.qrId === 'direct' ? 'Main Menu' : scan.qrId}
                            </p>
                            <p className="text-[10px] text-[#8b7355]">
                              {scan.userAgent ? (scan.userAgent.split(') ')[0]?.slice(0, 30) || 'Mobile Device') : 'Scan Event'}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-[#8b7355]">
                          {scan.timestamp?.toDate ? scan.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#e5d5c5]">
                <h3 className="text-lg font-serif font-bold mb-6 flex items-center gap-2">
                  <Utensils size={20} className="text-[#d4af37]" />
                  Most Viewed Items
                </h3>
                <div className="space-y-4">
                  {menuItems.length === 0 ? (
                    <p className="text-sm text-[#8b7355] italic text-center py-6">No menu items created yet.</p>
                  ) : (
                    [...menuItems].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5).map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-4 bg-[#fdfaf6] rounded-xl border border-[#e5d5c5]">
                        <div className="flex items-center gap-3">
                          <img 
                            src={normalizeImageUrl(item.imageUrl) || `https://picsum.photos/seed/${encodeURIComponent(item.name)}/100/100`} 
                            className="w-12 h-12 rounded-lg object-cover" 
                            alt={item.name} 
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <p className="text-sm font-bold text-[#2c1810]">{item.name}</p>
                            <p className="text-[10px] text-[#8b7355]">{item.views || 0} views</p>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-[#d4af37]">Rs {item.price.toFixed(2)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "menu" && (
          <div className="space-y-6 sm:space-y-8">
            {/* Top Control Bar: Subtabs with Total Counts, Search Input, and Add Action */}
            <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-white p-4 rounded-2xl border border-[#e5d5c5] shadow-xs">
              <div className="flex bg-[#fdfaf6] border border-[#e5d5c5] p-1 rounded-xl w-full md:w-auto">
                <button 
                  onClick={() => setMenuSubTab("items")}
                  className={cn(
                    "flex-1 md:flex-initial px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all text-center flex items-center justify-center gap-2",
                    menuSubTab === "items" ? "bg-[#2c1810] text-[#fdfaf6] shadow-md" : "text-[#8b7355] hover:text-[#2c1810]"
                  )}
                >
                  <span>Menu Items</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold font-mono", 
                    menuSubTab === "items" ? "bg-[#d4af37] text-[#2c1810]" : "bg-[#e5d5c5]/40 text-[#5c4033]"
                  )}>
                    {menuItems.length} Total
                  </span>
                </button>
                <button 
                  onClick={() => setMenuSubTab("categories")}
                  className={cn(
                    "flex-1 md:flex-initial px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all text-center flex items-center justify-center gap-2",
                    menuSubTab === "categories" ? "bg-[#2c1810] text-[#fdfaf6] shadow-md" : "text-[#8b7355] hover:text-[#2c1810]"
                  )}
                >
                  <span>Categories</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold font-mono", 
                    menuSubTab === "categories" ? "bg-[#d4af37] text-[#2c1810]" : "bg-[#e5d5c5]/40 text-[#5c4033]"
                  )}>
                    {categories.length} Total
                  </span>
                </button>
              </div>

              {/* Search & Add button */}
              <div className="flex items-center gap-3 w-full md:w-auto flex-1 md:max-w-md">
                {menuSubTab === "items" ? (
                  <>
                    <div className="relative flex-1">
                      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8b7355]" />
                      <input 
                        type="text"
                        value={menuSearchQuery}
                        onChange={(e) => setMenuSearchQuery(e.target.value)}
                        placeholder={`Search ${menuItems.length} menu items...`}
                        className="w-full bg-[#fdfaf6] border border-[#e5d5c5] rounded-xl pl-9 pr-8 py-2.5 text-xs text-[#2c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37]/30"
                      />
                      {menuSearchQuery && (
                        <button onClick={() => setMenuSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <button 
                      onClick={() => setIsAddingItem(true)}
                      className="flex items-center justify-center gap-2 bg-[#2c1810] text-[#fdfaf6] px-4 py-2.5 rounded-xl hover:bg-[#4a2c1d] transition-all text-xs font-medium shadow-lg shrink-0"
                    >
                      <Plus size={16} />
                      Add Item
                    </button>
                  </>
                ) : (
                  <>
                    <div className="relative flex-1">
                      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8b7355]" />
                      <input 
                        type="text"
                        value={categorySearchQuery}
                        onChange={(e) => setCategorySearchQuery(e.target.value)}
                        placeholder={`Search ${categories.length} categories...`}
                        className="w-full bg-[#fdfaf6] border border-[#e5d5c5] rounded-xl pl-9 pr-8 py-2.5 text-xs text-[#2c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37]/30"
                      />
                      {categorySearchQuery && (
                        <button onClick={() => setCategorySearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <button 
                      onClick={() => setIsAddingCategory(true)}
                      className="flex items-center justify-center gap-2 bg-[#2c1810] text-[#fdfaf6] px-4 py-2.5 rounded-xl hover:bg-[#4a2c1d] transition-all text-xs font-medium shadow-lg shrink-0"
                    >
                      <Plus size={16} />
                      Add Category
                    </button>
                  </>
                )}
              </div>
            </div>

            {menuSubTab === "items" ? (
              <div className="space-y-3">
                {/* Search result count */}
                {menuSearchQuery && (
                  <div className="flex items-center justify-between text-xs text-[#8b7355] px-1">
                    <span>Showing matching items for "<strong>{menuSearchQuery}</strong>"</span>
                    <span className="font-bold text-[#2c1810]">{
                      menuItems.filter(item => {
                        const q = menuSearchQuery.toLowerCase();
                        const catName = categories.find(c => c.id === item.categoryId)?.name || "";
                        return item.name.toLowerCase().includes(q) || 
                               item.description?.toLowerCase().includes(q) || 
                               catName.toLowerCase().includes(q);
                      }).length
                    } of {menuItems.length} Items</span>
                  </div>
                )}

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
                      {menuItems.filter(item => {
                        if (!menuSearchQuery) return true;
                        const q = menuSearchQuery.toLowerCase();
                        const catName = categories.find(c => c.id === item.categoryId)?.name || "";
                        return item.name.toLowerCase().includes(q) || 
                               item.description?.toLowerCase().includes(q) || 
                               catName.toLowerCase().includes(q);
                      }).map((item) => (
                        <tr key={item.id} className="hover:bg-[#fdfaf6]/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <img src={normalizeImageUrl(item.imageUrl) || `https://picsum.photos/seed/${item.name}/100/100`} className="w-12 h-12 rounded-xl object-cover" alt={item.name} referrerPolicy="no-referrer" />
                              <div>
                                <p className="text-sm font-bold text-[#2c1810]">{item.name}</p>
                                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                                  {settings.customTags.filter(t => t.enabled).map(t => {
                                    const isTagActive = item.tags?.includes(t.id) ||
                                      (t.id === 'tag_1' && item.isSpicy) ||
                                      (t.id === 'tag_2' && item.isVegetarian);
                                    if (!isTagActive) return null;
                                    return (
                                      <span 
                                        key={t.id} 
                                        className="text-[9px] font-bold text-white px-2 py-0.5 rounded-full shadow-xs uppercase tracking-wider"
                                        style={{ backgroundColor: t.color || '#2c1810' }}
                                      >
                                        {t.label}
                                      </span>
                                    );
                                  })}
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
              </div>
            ) : (
              <div className="space-y-3">
                {/* Search result count */}
                {categorySearchQuery && (
                  <div className="flex items-center justify-between text-xs text-[#8b7355] px-1">
                    <span>Showing matching categories for "<strong>{categorySearchQuery}</strong>"</span>
                    <span className="font-bold text-[#2c1810]">{
                      categories.filter(cat => cat.name.toLowerCase().includes(categorySearchQuery.toLowerCase())).length
                    } of {categories.length} Categories</span>
                  </div>
                )}

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
                      {categories.filter(cat => {
                        if (!categorySearchQuery) return true;
                        return cat.name.toLowerCase().includes(categorySearchQuery.toLowerCase());
                      }).map((cat) => (
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
              <div className="flex flex-wrap gap-3">
                {tables.length === 0 && (
                  <button 
                    onClick={seedDefaultTables}
                    className="flex items-center gap-2 bg-[#fdfaf6] border border-[#e5d5c5] text-[#2c1810] px-4 py-2.5 rounded-xl hover:bg-white transition-all text-sm font-medium"
                  >
                    Seed Default Tables (1-6)
                  </button>
                )}
                {tables.length > 0 && (
                  <button 
                    onClick={printAllQRCards}
                    className="flex items-center gap-2 bg-[#d4af37] text-[#2c1810] px-4 py-2.5 rounded-xl hover:bg-[#e6c250] transition-all text-sm font-bold shadow-md"
                  >
                    <Printer size={18} />
                    Print All QR Cards
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
                <h4 className="text-xl font-serif font-bold text-[#2c1810]">No Tables Found</h4>
                <p className="text-sm text-[#8b7355] max-w-md mx-auto">
                  Add your restaurant tables below. Every table added will be stored directly into your system database.
                </p>
                <div className="flex flex-wrap justify-center gap-4 pt-2">
                  <button 
                    onClick={() => setIsAddingTable(true)}
                    className="flex items-center gap-2 bg-[#2c1810] text-[#fdfaf6] px-6 py-3 rounded-xl hover:bg-[#4a2c1d] transition-all text-sm font-medium shadow-lg"
                  >
                    <Plus size={18} />
                    Add Table
                  </button>
                  <button 
                    onClick={seedDefaultTables}
                    className="flex items-center gap-2 bg-[#fdfaf6] border border-[#e5d5c5] text-[#2c1810] px-6 py-3 rounded-xl hover:bg-white transition-all text-sm font-medium"
                  >
                    Seed Standard Tables (1-6)
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
                          fgColor="#1b365d"
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
        {activeTab === "analytics" && (() => {
          // Dynamic calculation helper for timestamps
          const getDateObj = (ts: any): Date | null => {
            if (!ts) return null;
            if (typeof ts.toDate === "function") return ts.toDate();
            if (ts.seconds) return new Date(ts.seconds * 1000);
            if (typeof ts === "number" || typeof ts === "string") return new Date(ts);
            return null;
          };

          // Calculate timeRange cutoff date
          const now = new Date();
          const rangeStart = new Date();
          if (timeRange === "1d") {
            rangeStart.setHours(now.getHours() - 24);
          } else if (timeRange === "7d") {
            rangeStart.setDate(now.getDate() - 7);
            rangeStart.setHours(0, 0, 0, 0);
          } else if (timeRange === "1m") {
            rangeStart.setDate(now.getDate() - 30);
            rangeStart.setHours(0, 0, 0, 0);
          } else if (timeRange === "3m") {
            rangeStart.setDate(now.getDate() - 90);
            rangeStart.setHours(0, 0, 0, 0);
          } else if (timeRange === "6m") {
            rangeStart.setDate(now.getDate() - 180);
            rangeStart.setHours(0, 0, 0, 0);
          }

          // Filter scans and orders within selected timeRange
          const filteredScans = scans.filter(s => {
            const d = getDateObj(s.timestamp);
            return d && d >= rangeStart;
          });

          const filteredOrders = orderRequests.filter(o => {
            const d = getDateObj(o.createdAt);
            return d && d >= rangeStart;
          });

          // 1. Core KPIs
          const validOrders = filteredOrders.filter(o => o.status === "completed" || o.status === "approved");
          const totalRevenue = validOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
          const totalScansCount = filteredScans.length;
          const totalOrdersCount = filteredOrders.length;
          const avgOrderValue = validOrders.length > 0 ? Math.round(totalRevenue / validOrders.length) : 0;

          // 2. Dynamic intervals based on timeRange
          let intervals: { slotStart: Date; slotEnd: Date; label: string; dateStr: string }[] = [];

          if (timeRange === "1d") {
            intervals = Array.from({ length: 8 }).map((_, i) => {
              const slotStart = new Date(now.getTime() - (7 - i) * 3 * 3600 * 1000);
              const slotEnd = new Date(slotStart.getTime() + 3 * 3600 * 1000);
              const label = slotStart.toLocaleTimeString("en-US", { hour: "numeric" });
              const dateStr = slotStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              return { slotStart, slotEnd, label, dateStr };
            });
          } else if (timeRange === "7d") {
            intervals = Array.from({ length: 7 }).map((_, i) => {
              const slotStart = new Date();
              slotStart.setDate(now.getDate() - (6 - i));
              slotStart.setHours(0, 0, 0, 0);
              const slotEnd = new Date(slotStart);
              slotEnd.setDate(slotEnd.getDate() + 1);
              const label = slotStart.toLocaleDateString("en-US", { weekday: "short" });
              const dateStr = slotStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              return { slotStart, slotEnd, label, dateStr };
            });
          } else if (timeRange === "1m") {
            intervals = Array.from({ length: 7 }).map((_, i) => {
              const slotStart = new Date();
              slotStart.setDate(now.getDate() - (6 - i) * 4);
              slotStart.setHours(0, 0, 0, 0);
              const slotEnd = new Date(slotStart);
              slotEnd.setDate(slotEnd.getDate() + 4);
              const label = slotStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              const dateStr = `4-day period`;
              return { slotStart, slotEnd, label, dateStr };
            });
          } else if (timeRange === "3m") {
            intervals = Array.from({ length: 7 }).map((_, i) => {
              const slotStart = new Date();
              slotStart.setDate(now.getDate() - (6 - i) * 12);
              slotStart.setHours(0, 0, 0, 0);
              const slotEnd = new Date(slotStart);
              slotEnd.setDate(slotEnd.getDate() + 12);
              const label = slotStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              const dateStr = `12-day period`;
              return { slotStart, slotEnd, label, dateStr };
            });
          } else {
            intervals = Array.from({ length: 6 }).map((_, i) => {
              const slotStart = new Date();
              slotStart.setMonth(now.getMonth() - (5 - i));
              slotStart.setDate(1);
              slotStart.setHours(0, 0, 0, 0);
              const slotEnd = new Date(slotStart);
              slotEnd.setMonth(slotEnd.getMonth() + 1);
              const label = slotStart.toLocaleDateString("en-US", { month: "short" });
              const dateStr = slotStart.getFullYear().toString();
              return { slotStart, slotEnd, label, dateStr };
            });
          }

          const dailyStats = intervals.map(inv => {
            const dayScans = scans.filter(s => {
              const d = getDateObj(s.timestamp);
              return d && d >= inv.slotStart && d < inv.slotEnd;
            }).length;

            const dayOrdersList = orderRequests.filter(o => {
              const d = getDateObj(o.createdAt);
              return d && d >= inv.slotStart && d < inv.slotEnd;
            });

            const dayOrders = dayOrdersList.length;
            const dayRevenue = dayOrdersList
              .filter(o => o.status === "completed" || o.status === "approved")
              .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

            return { label: inv.label, dateStr: inv.dateStr, scans: dayScans, orders: dayOrders, revenue: dayRevenue };
          });

          const maxVal = Math.max(
            ...dailyStats.map(d => analyticsMetric === "scans" ? d.scans : analyticsMetric === "orders" ? d.orders : d.revenue),
            1
          );

          // SVG Line Chart Calculations
          const svgWidth = 700;
          const svgHeight = 220;
          const paddingX = 45;
          const paddingTop = 30;
          const paddingBottom = 40;
          const plotWidth = svgWidth - paddingX * 2;
          const plotHeight = svgHeight - paddingTop - paddingBottom;

          const points = dailyStats.map((day, i) => {
            const val = analyticsMetric === "scans" ? day.scans : analyticsMetric === "orders" ? day.orders : day.revenue;
            const x = paddingX + (i / (dailyStats.length - 1)) * plotWidth;
            const ratio = maxVal > 0 ? val / maxVal : 0;
            const y = (svgHeight - paddingBottom) - ratio * plotHeight;
            return { x, y, val, label: day.label, dateStr: day.dateStr };
          });

          let lineD = `M ${points[0].x} ${points[0].y}`;
          for (let i = 0; i < points.length - 1; i++) {
            const curr = points[i];
            const next = points[i + 1];
            const cp1x = curr.x + (next.x - curr.x) / 2;
            const cp1y = curr.y;
            const cp2x = curr.x + (next.x - curr.x) / 2;
            const cp2y = next.y;
            lineD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
          }

          const areaD = `${lineD} L ${points[points.length - 1].x} ${svgHeight - paddingBottom} L ${points[0].x} ${svgHeight - paddingBottom} Z`;

          // 3. Top Ordered / Popular Dishes
          const dishMap: Record<string, { count: number; revenue: number; views: number }> = {};
          
          menuItems.forEach(item => {
            dishMap[item.name] = { count: 0, revenue: 0, views: item.views || 0 };
          });

          validOrders.forEach(o => {
            (o.items || []).forEach(item => {
              if (!dishMap[item.name]) {
                dishMap[item.name] = { count: 0, revenue: 0, views: 0 };
              }
              dishMap[item.name].count += (item.quantity || 1);
              dishMap[item.name].revenue += (item.subtotal || ((item.price || 0) * (item.quantity || 1)));
            });
          });

          const popularDishes = Object.entries(dishMap)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => (b.count || b.views) - (a.count || a.views))
            .slice(0, 5);

          const maxDishOrders = Math.max(...popularDishes.map(d => d.count || d.views || 1), 1);

          // 4. Table breakdown
          const tableActivity: Record<string, { scans: number; orders: number; revenue: number }> = {};
          tables.forEach(t => {
            tableActivity[String(t.tableNumber)] = { scans: 0, orders: 0, revenue: 0 };
          });
          filteredScans.forEach(s => {
            const tNum = String(s.tableNumber || "");
            if (tNum) {
              if (!tableActivity[tNum]) tableActivity[tNum] = { scans: 0, orders: 0, revenue: 0 };
              tableActivity[tNum].scans += 1;
            }
          });
          filteredOrders.forEach(o => {
            const tNum = String(o.tableNumber || "");
            if (tNum) {
              if (!tableActivity[tNum]) tableActivity[tNum] = { scans: 0, orders: 0, revenue: 0 };
              tableActivity[tNum].orders += 1;
              if (o.status === "completed" || o.status === "approved") {
                tableActivity[tNum].revenue += (Number(o.totalAmount) || 0);
              }
            }
          });

          const sortedTables = Object.entries(tableActivity)
            .map(([tableNumber, stats]) => ({ tableNumber, ...stats }))
            .sort((a, b) => (b.scans + b.orders) - (a.scans + a.orders));

          // 5. Order Status Counts
          const statusCounts = {
            completed: filteredOrders.filter(o => o.status === "completed").length,
            approved: filteredOrders.filter(o => o.status === "approved").length,
            pending: filteredOrders.filter(o => o.status === "pending").length,
            rejected: filteredOrders.filter(o => o.status === "rejected").length,
          };

          // 6. Peak Hours breakdown
          const hourBuckets = [
            { label: "Morning (8 AM - 12 PM)", hours: [8, 9, 10, 11] },
            { label: "Lunch (12 PM - 4 PM)", hours: [12, 13, 14, 15] },
            { label: "Evening (4 PM - 8 PM)", hours: [16, 17, 18, 19] },
            { label: "Night (8 PM - 12 AM)", hours: [20, 21, 22, 23] },
          ];

          const hourActivity = hourBuckets.map(b => {
            let count = 0;
            [...filteredScans, ...filteredOrders].forEach((item: any) => {
              const d = getDateObj(item.timestamp || item.createdAt);
              if (d && b.hours.includes(d.getHours())) {
                count += 1;
              }
            });
            return { ...b, count };
          });

          const maxHourCount = Math.max(...hourActivity.map(h => h.count), 1);

          // 7. Dish Quantity Bar Graph calculation (Dishes on X-axis vs Quantity on Left Y-axis)
          const dishQtyMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
          
          menuItems.forEach(item => {
            dishQtyMap[item.name] = { name: item.name, quantity: 0, revenue: 0 };
          });

          filteredOrders.forEach(o => {
            (o.items || []).forEach(item => {
              if (!dishQtyMap[item.name]) {
                dishQtyMap[item.name] = { name: item.name, quantity: 0, revenue: 0 };
              }
              const q = Number(item.quantity) || 1;
              const rev = Number(item.subtotal) || ((Number(item.price) || 0) * q);
              dishQtyMap[item.name].quantity += q;
              dishQtyMap[item.name].revenue += rev;
            });
          });

          const dishBarData = Object.values(dishQtyMap)
            .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));

          const maxQuantity = Math.max(...dishBarData.map(d => d.quantity), 5);
          const barSvgWidth = Math.max(750, 60 + dishBarData.length * 55 + 30);
          const chartEndX = barSvgWidth - 20;

          // 8. Most Selling vs Least Selling Performance Lists
          const allDishPerformance = menuItems.map(item => {
            const data = dishQtyMap[item.name] || { quantity: 0, revenue: 0 };
            return {
              id: item.id,
              name: item.name,
              price: item.price || 0,
              imageUrl: item.imageUrl,
              views: item.views || 0,
              quantityOrdered: data.quantity,
              totalRevenue: data.revenue,
            };
          });

          const mostSellingItems = [...allDishPerformance]
            .sort((a, b) => (b.quantityOrdered - a.quantityOrdered) || (b.totalRevenue - a.totalRevenue) || (b.views - a.views))
            .slice(0, 5);

          const leastSellingItems = [...allDishPerformance]
            .sort((a, b) => (a.quantityOrdered - b.quantityOrdered) || (a.totalRevenue - b.totalRevenue) || (a.views - b.views))
            .slice(0, 5);

          return (
            <div className="space-y-8">
              {/* Analytics Header & Time Range Selection Options (Top Right) */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#e5d5c5] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#2c1810] flex items-center gap-2">
                    <BarChart3 size={24} className="text-[#d4af37]" />
                    Analytics & Performance Intelligence
                  </h2>
                  <p className="text-xs text-[#8b7355] mt-1 font-medium">Real-time metrics calculated dynamically over your chosen timeframe.</p>
                </div>

                {/* Top Right Time Range Selection Buttons */}
                <div className="flex items-center gap-1 bg-[#fdfaf6] p-1.5 rounded-2xl border border-[#e5d5c5] shadow-xs flex-wrap">
                  {[
                    { key: "1d", label: "1 Day" },
                    { key: "7d", label: "7 Days" },
                    { key: "1m", label: "1 Month" },
                    { key: "3m", label: "3 Months" },
                    { key: "6m", label: "6 Months" },
                  ].map(t => (
                    <button
                      key={t.key}
                      onClick={() => setTimeRange(t.key as any)}
                      className={cn(
                        "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all select-none",
                        timeRange === t.key
                          ? "bg-[#2c1810] text-[#fdfaf6] shadow-sm"
                          : "text-[#8b7355] hover:text-[#2c1810] hover:bg-white"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Header & KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#e5d5c5]">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#8b7355]">Total QR Scans</span>
                    <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-[#d4af37]">
                      <QrCode size={20} />
                    </div>
                  </div>
                  <div className="text-3xl font-serif font-bold text-[#2c1810]">{totalScansCount}</div>
                  <p className="text-[11px] text-[#8b7355] mt-1 font-medium">Real-time table QR scans</p>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#e5d5c5]">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#8b7355]">Total Orders</span>
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                      <ShoppingBag size={20} />
                    </div>
                  </div>
                  <div className="text-3xl font-serif font-bold text-[#2c1810]">{totalOrdersCount}</div>
                  <p className="text-[11px] text-[#8b7355] mt-1 font-medium">{statusCounts.completed} completed, {statusCounts.pending} pending</p>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#e5d5c5]">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#8b7355]">Total Revenue</span>
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <TrendingUp size={20} />
                    </div>
                  </div>
                  <div className="text-3xl font-serif font-bold text-[#2c1810]">₹{totalRevenue.toLocaleString()}</div>
                  <p className="text-[11px] text-[#8b7355] mt-1 font-medium">From approved & completed orders</p>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#e5d5c5]">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#8b7355]">Avg Order Value</span>
                    <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
                      <BarChart3 size={20} />
                    </div>
                  </div>
                  <div className="text-3xl font-serif font-bold text-[#2c1810]">₹{avgOrderValue.toLocaleString()}</div>
                  <p className="text-[11px] text-[#8b7355] mt-1 font-medium">Per completed order</p>
                </div>
              </div>

              {/* Dynamic Line Graph Chart */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-[#e5d5c5]">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <h3 className="text-xl font-serif font-bold text-[#2c1810] flex items-center gap-2">
                      <TrendingUp size={22} className="text-[#d4af37]" />
                      Dynamic {timeRange === "1d" ? "24-Hour" : timeRange === "7d" ? "7-Day" : timeRange === "1m" ? "30-Day" : timeRange === "3m" ? "3-Month" : "6-Month"} Performance Trend
                    </h3>
                    <p className="text-xs text-[#8b7355] mt-1">Real-time dynamic trend line graph powered by live data.</p>
                  </div>

                  {/* Toggle Metric */}
                  <div className="flex items-center gap-1 bg-[#fdfaf6] p-1 rounded-2xl border border-[#e5d5c5]">
                    <button
                      onClick={() => setAnalyticsMetric("scans")}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                        analyticsMetric === "scans"
                          ? "bg-[#2c1810] text-[#fdfaf6] shadow-sm"
                          : "text-[#8b7355] hover:text-[#2c1810]"
                      )}
                    >
                      Scans
                    </button>
                    <button
                      onClick={() => setAnalyticsMetric("orders")}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                        analyticsMetric === "orders"
                          ? "bg-[#2c1810] text-[#fdfaf6] shadow-sm"
                          : "text-[#8b7355] hover:text-[#2c1810]"
                      )}
                    >
                      Orders
                    </button>
                    <button
                      onClick={() => setAnalyticsMetric("revenue")}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                        analyticsMetric === "revenue"
                          ? "bg-[#2c1810] text-[#fdfaf6] shadow-sm"
                          : "text-[#8b7355] hover:text-[#2c1810]"
                      )}
                    >
                      Revenue (₹)
                    </button>
                  </div>
                </div>

                {/* SVG Line Graph Container */}
                <div className="relative w-full overflow-x-auto">
                  <div className="min-w-[620px]">
                    <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto overflow-visible">
                      <defs>
                        <linearGradient id="gradient-scans" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#d4af37" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#d4af37" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="gradient-orders" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="gradient-revenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Horizontal Grid Lines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((r, idx) => {
                        const y = (svgHeight - paddingBottom) - r * plotHeight;
                        const gridVal = Math.round(r * maxVal);
                        return (
                          <g key={idx}>
                            <line 
                              x1={paddingX} 
                              y1={y} 
                              x2={svgWidth - paddingX} 
                              y2={y} 
                              stroke="#f0e6dd" 
                              strokeDasharray="4 4" 
                              strokeWidth="1" 
                            />
                            <text 
                              x={paddingX - 8} 
                              y={y + 3} 
                              textAnchor="end" 
                              fontSize="9" 
                              fontWeight="600" 
                              fill="#a89078"
                            >
                              {analyticsMetric === "revenue" ? `₹${gridVal}` : gridVal}
                            </text>
                          </g>
                        );
                      })}

                      {/* Area Fill Under Curve */}
                      <path 
                        d={areaD} 
                        fill={
                          analyticsMetric === "scans" ? "url(#gradient-scans)" :
                          analyticsMetric === "orders" ? "url(#gradient-orders)" :
                          "url(#gradient-revenue)"
                        } 
                      />

                      {/* Smooth Line Curve */}
                      <path 
                        d={lineD} 
                        fill="none" 
                        stroke={
                          analyticsMetric === "scans" ? "#d4af37" :
                          analyticsMetric === "orders" ? "#3b82f6" :
                          "#10b981"
                        } 
                        strokeWidth="3.5" 
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Interactive Data Points & Labels */}
                      {points.map((pt, i) => (
                        <g key={i} className="group cursor-pointer">
                          {/* Vertical guide line on hover */}
                          <line 
                            x1={pt.x} 
                            y1={paddingTop} 
                            x2={pt.x} 
                            y2={svgHeight - paddingBottom} 
                            stroke="#2c1810" 
                            strokeOpacity="0.15" 
                            strokeDasharray="2 2"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          />

                          {/* Outer pulse ring & Data Point Node centered in transform group */}
                          <g transform={`translate(${pt.x}, ${pt.y})`}>
                            <circle 
                              cx="0" 
                              cy="0" 
                              r="10" 
                              fill={
                                analyticsMetric === "scans" ? "#d4af37" :
                                analyticsMetric === "orders" ? "#3b82f6" :
                                "#10b981"
                              } 
                              opacity="0.3"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            />

                            <circle 
                              cx="0" 
                              cy="0" 
                              r="5" 
                              fill={
                                analyticsMetric === "scans" ? "#2c1810" :
                                analyticsMetric === "orders" ? "#1e40af" :
                                "#065f46"
                              } 
                              stroke={
                                analyticsMetric === "scans" ? "#d4af37" :
                                analyticsMetric === "orders" ? "#60a5fa" :
                                "#34d399"
                              } 
                              strokeWidth="2.5" 
                              className="transition-transform duration-300 group-hover:scale-125"
                            />
                          </g>

                          {/* Value Badge Label above Point */}
                          <g transform={`translate(${pt.x}, ${pt.y - 12})`}>
                            <rect 
                              x="-22" 
                              y="-16" 
                              width="44" 
                              height="17" 
                              rx="5" 
                              fill="#2c1810" 
                            />
                            <text 
                              x="0" 
                              y="-4" 
                              textAnchor="middle" 
                              fontSize="9" 
                              fontWeight="bold" 
                              fill="#fdfaf6"
                            >
                              {analyticsMetric === "revenue" ? `₹${pt.val}` : pt.val}
                            </text>
                          </g>

                          {/* X-Axis Day & Date Labels */}
                          <text 
                            x={pt.x} 
                            y={svgHeight - paddingBottom + 16} 
                            textAnchor="middle" 
                            fontSize="11" 
                            fontWeight="bold" 
                            fill="#2c1810"
                          >
                            {pt.label}
                          </text>
                          <text 
                            x={pt.x} 
                            y={svgHeight - paddingBottom + 28} 
                            textAnchor="middle" 
                            fontSize="9" 
                            fontWeight="500" 
                            fill="#8b7355"
                          >
                            {pt.dateStr}
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>
                </div>
              </div>

              {/* Dish Quantity Bar Graph (Dishes on Bottom X-axis, Quantity on Left Y-axis) */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-[#e5d5c5]">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <h3 className="text-xl font-serif font-bold text-[#2c1810] flex items-center gap-2">
                      <Utensils size={22} className="text-[#d4af37]" />
                      Dish Order Quantity Bar Graph
                    </h3>
                    <p className="text-xs text-[#8b7355] mt-1 font-medium">
                      Quantity ordered on the left Y-axis vs Dishes on the bottom X-axis.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 bg-[#fdfaf6] px-3 py-1.5 rounded-xl border border-[#e5d5c5]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#2c1810]" />
                    <span className="text-xs font-bold text-[#2c1810]">
                      Total Items Ordered: {dishBarData.reduce((acc, d) => acc + d.quantity, 0)}
                    </span>
                  </div>
                </div>

                {dishBarData.length === 0 ? (
                  <div className="p-8 text-center bg-[#fdfaf6] rounded-2xl border border-dashed border-[#e5d5c5]">
                    <p className="text-xs text-[#8b7355]">No dish orders recorded yet for this timeframe.</p>
                  </div>
                ) : (
                  <div className="relative w-full overflow-x-auto">
                    <div className="pt-4" style={{ minWidth: `${Math.max(650, barSvgWidth)}px` }}>
                      {/* SVG Bar Chart with Y-axis Quantity on left and X-axis Dishes on bottom */}
                      <svg viewBox={`0 0 ${barSvgWidth} 280`} className="w-full h-auto overflow-visible">
                        <defs>
                          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2c1810" />
                            <stop offset="100%" stopColor="#5c4033" />
                          </linearGradient>
                          <linearGradient id="barGradientGold" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#d4af37" />
                            <stop offset="100%" stopColor="#9a7b20" />
                          </linearGradient>
                        </defs>

                        {/* Y-Axis Label (Quantity on Left Side) */}
                        <text
                          x="-120"
                          y="18"
                          transform="rotate(-90)"
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight="bold"
                          fill="#8b7355"
                          className="uppercase tracking-widest"
                        >
                          Quantity (Items Ordered)
                        </text>

                        {/* Horizontal Y-Axis Grid Lines & Step Labels (Left Side Quantity) */}
                        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                          const y = 200 - ratio * 160;
                          const qtyStep = Math.round(ratio * maxQuantity);
                          return (
                            <g key={idx}>
                              <line
                                x1="60"
                                y1={y}
                                x2={chartEndX}
                                y2={y}
                                stroke="#f0e6dd"
                                strokeDasharray="4 4"
                                strokeWidth="1"
                              />
                              {/* Y-Axis Left Side Quantity Number */}
                              <text
                                x="52"
                                y={y + 4}
                                textAnchor="end"
                                fontSize="10"
                                fontWeight="bold"
                                fill="#4a2c1d"
                              >
                                {qtyStep}
                              </text>
                            </g>
                          );
                        })}

                        {/* Y-Axis Baseline Line */}
                        <line x1="60" y1="200" x2={chartEndX} y2="200" stroke="#e5d5c5" strokeWidth="2" />
                        {/* X-Axis Baseline Line */}
                        <line x1="60" y1="40" x2="60" y2="200" stroke="#e5d5c5" strokeWidth="2" />

                        {/* Render Vertical Bars for Dishes */}
                        {dishBarData.map((dish, idx) => {
                          const barCount = dishBarData.length;
                          const groupWidth = (chartEndX - 60) / barCount;
                          const barWidth = Math.min(38, groupWidth * 0.55);
                          const xCenter = 60 + idx * groupWidth + groupWidth / 2;
                          const xLeft = xCenter - barWidth / 2;
                          const barHeight = Math.max((dish.quantity / maxQuantity) * 160, dish.quantity > 0 ? 8 : 3);
                          const yTop = 200 - barHeight;
                          const isTopDish = idx === 0 && dish.quantity > 0;

                          return (
                            <g key={idx} className="group cursor-pointer">
                              {/* Bar Column Background hover highlight */}
                              <rect
                                x={xCenter - groupWidth / 2 + 2}
                                y="40"
                                width={groupWidth - 4}
                                height="160"
                                fill="#2c1810"
                                opacity="0"
                                className="group-hover:opacity-[0.03] transition-opacity"
                              />

                              {/* Vertical Bar */}
                              <rect
                                x={xLeft}
                                y={yTop}
                                width={barWidth}
                                height={barHeight}
                                rx="6"
                                fill={isTopDish ? "url(#barGradientGold)" : "url(#barGradient)"}
                                className="transition-all duration-300 group-hover:brightness-125"
                              />

                              {/* Quantity Badge on Top of Bar */}
                              <g transform={`translate(${xCenter}, ${yTop - 10})`}>
                                <rect
                                  x="-14"
                                  y="-12"
                                  width="28"
                                  height="16"
                                  rx="4"
                                  fill={isTopDish ? "#d4af37" : "#2c1810"}
                                />
                                <text
                                  x="0"
                                  y="-1"
                                  textAnchor="middle"
                                  fontSize="9"
                                  fontWeight="extrabold"
                                  fill={isTopDish ? "#2c1810" : "#fdfaf6"}
                                >
                                  {dish.quantity}
                                </text>
                              </g>

                              {/* Bottom X-Axis Dish Name Label */}
                              <g transform={`translate(${xCenter}, 214)`}>
                                <text
                                  x="0"
                                  y="0"
                                  textAnchor="end"
                                  transform="rotate(-35)"
                                  fontSize="10"
                                  fontWeight="bold"
                                  fill="#2c1810"
                                  className="group-hover:fill-[#d4af37] transition-colors"
                                >
                                  {dish.name.length > 14 ? dish.name.slice(0, 13) + "…" : dish.name}
                                </text>
                              </g>
                            </g>
                          );
                        })}

                        {/* X-Axis Bottom Label (Dishes) */}
                        <text
                          x={60 + (chartEndX - 60) / 2}
                          y="272"
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight="bold"
                          fill="#8b7355"
                          className="uppercase tracking-wider"
                        >
                          Dishes & Menu Items (Bottom X-Axis)
                        </text>
                      </svg>
                    </div>
                  </div>
                )}
              </div>

              {/* Grid Section: Popular Items & Order Status & Peak Hours */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Popular Menu Items */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#e5d5c5] space-y-6">
                  <h3 className="text-lg font-serif font-bold text-[#2c1810]">Top Popular Dishes</h3>
                  {popularDishes.length === 0 ? (
                    <p className="text-xs text-[#8b7355]">No menu order data recorded yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {popularDishes.map((dish, i) => (
                        <div key={i} className="flex items-center gap-3 bg-[#fdfaf6] p-3 rounded-2xl border border-[#e5d5c5]">
                          <span className="w-6 h-6 rounded-full bg-[#2c1810] text-[#d4af37] text-xs font-bold flex items-center justify-center shrink-0">
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-bold text-[#2c1810] truncate">{dish.name}</h4>
                            <div className="flex items-center gap-3 text-[10px] text-[#8b7355] mt-0.5">
                              <span>Orders: <strong>{dish.count}</strong></span>
                              <span>Views: <strong>{dish.views}</strong></span>
                            </div>
                            <div className="w-full bg-white h-1.5 rounded-full mt-2 overflow-hidden border border-[#e5d5c5]">
                              <div 
                                className="bg-[#d4af37] h-full rounded-full" 
                                style={{ width: `${Math.min(100, Math.round(((dish.count || dish.views) / maxDishOrders) * 100))}%` }}
                              />
                            </div>
                          </div>
                          {dish.revenue > 0 && (
                            <span className="text-xs font-bold font-mono text-[#2c1810] shrink-0">
                              ₹{dish.revenue}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Table Performance */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#e5d5c5] space-y-6">
                  <h3 className="text-lg font-serif font-bold text-[#2c1810]">Table Activity Breakdown</h3>
                  {sortedTables.length === 0 ? (
                    <p className="text-xs text-[#8b7355]">No tables found.</p>
                  ) : (
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {sortedTables.map((t, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-[#fdfaf6] rounded-2xl border border-[#e5d5c5]">
                          <div>
                            <span className="text-xs font-bold text-[#2c1810]">Table {t.tableNumber}</span>
                            <div className="flex items-center gap-3 text-[10px] text-[#8b7355] mt-0.5">
                              <span>{t.scans} Scans</span>
                              <span>•</span>
                              <span>{t.orders} Orders</span>
                            </div>
                          </div>
                          <span className="text-xs font-bold font-mono text-[#2c1810]">
                            ₹{t.revenue.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Peak Hours & Status Overview */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#e5d5c5] space-y-6">
                  <h3 className="text-lg font-serif font-bold text-[#2c1810]">Peak Activity Hours</h3>
                  <div className="space-y-3">
                    {hourActivity.map((peak, i) => {
                      const isPeak = peak.count === maxHourCount && peak.count > 0;
                      return (
                        <div key={i} className="p-3 bg-[#fdfaf6] rounded-2xl border border-[#e5d5c5] space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-[#2c1810]">{peak.label}</span>
                            <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md", isPeak ? "bg-red-100 text-red-700" : "bg-gray-100 text-[#8b7355]")}>
                              {isPeak ? "Peak Activity" : `${peak.count} Events`}
                            </span>
                          </div>
                          <div className="w-full bg-white h-2 rounded-full overflow-hidden border border-[#e5d5c5]">
                            <div 
                              className={cn("h-full rounded-full", isPeak ? "bg-red-500" : "bg-[#d4af37]")} 
                              style={{ width: `${Math.round((peak.count / maxHourCount) * 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-4 border-t border-[#e5d5c5]">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#8b7355] mb-3">Order Status Ratio</h4>
                    <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold">
                      <div className="bg-emerald-50 text-emerald-800 p-2.5 rounded-xl border border-emerald-200">
                        <div>{statusCounts.completed}</div>
                        <div className="text-[9px] uppercase font-normal text-emerald-600">Completed</div>
                      </div>
                      <div className="bg-blue-50 text-blue-800 p-2.5 rounded-xl border border-blue-200">
                        <div>{statusCounts.approved}</div>
                        <div className="text-[9px] uppercase font-normal text-blue-600">Approved</div>
                      </div>
                      <div className="bg-amber-50 text-amber-800 p-2.5 rounded-xl border border-amber-200">
                        <div>{statusCounts.pending}</div>
                        <div className="text-[9px] uppercase font-normal text-amber-600">Pending</div>
                      </div>
                      <div className="bg-red-50 text-red-800 p-2.5 rounded-xl border border-red-200">
                        <div>{statusCounts.rejected}</div>
                        <div className="text-[9px] uppercase font-normal text-red-600">Rejected</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Section: Most Selling vs Least Selling Items */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Most Selling Items Card */}
                <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-[#e5d5c5]">
                  <div className="flex items-center justify-between mb-6 pb-3 border-b border-[#e5d5c5]">
                    <div>
                      <h3 className="text-lg font-serif font-bold text-[#2c1810] flex items-center gap-2">
                        <Flame size={20} className="text-orange-500" />
                        Top Most Selling Items
                      </h3>
                      <p className="text-xs text-[#8b7355] mt-0.5 font-medium">Highest order volume and customer favorites</p>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-200">
                      Best Sellers
                    </span>
                  </div>

                  {mostSellingItems.length === 0 ? (
                    <p className="text-xs text-[#8b7355]">No item sales recorded.</p>
                  ) : (
                    <div className="space-y-3">
                      {mostSellingItems.map((dish, i) => (
                        <div key={dish.id || i} className="flex items-center justify-between p-3 bg-[#fdfaf6] rounded-2xl border border-[#e5d5c5] gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-xs">
                              #{i + 1}
                            </span>
                            {dish.imageUrl ? (
                              <img 
                                src={normalizeImageUrl(dish.imageUrl)} 
                                alt={dish.name} 
                                className="w-10 h-10 rounded-xl object-cover border border-[#e5d5c5] shrink-0" 
                                referrerPolicy="no-referrer" 
                                onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                              />
                            ) : null}
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-[#2c1810] truncate">{dish.name}</h4>
                              <p className="text-[10px] text-[#8b7355] font-medium">₹{dish.price} • {dish.views} Views</p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="inline-block bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-extrabold px-2.5 py-1 rounded-lg">
                              {dish.quantityOrdered} Sold
                            </span>
                            <p className="text-[10px] font-mono font-bold text-[#2c1810] mt-1">₹{dish.totalRevenue.toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Least Selling Items Card */}
                <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-[#e5d5c5]">
                  <div className="flex items-center justify-between mb-6 pb-3 border-b border-[#e5d5c5]">
                    <div>
                      <h3 className="text-lg font-serif font-bold text-[#2c1810] flex items-center gap-2">
                        <AlertCircle size={20} className="text-amber-500" />
                        Least Selling / Slow Moving Items
                      </h3>
                      <p className="text-xs text-[#8b7355] mt-0.5 font-medium">Lowest sales volume requiring promotion or menu review</p>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full border border-amber-200">
                      Needs Action
                    </span>
                  </div>

                  {leastSellingItems.length === 0 ? (
                    <p className="text-xs text-[#8b7355]">No item data available.</p>
                  ) : (
                    <div className="space-y-3">
                      {leastSellingItems.map((dish, i) => (
                        <div key={dish.id || i} className="flex items-center justify-between p-3 bg-[#fdfaf6] rounded-2xl border border-[#e5d5c5] gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-xs">
                              #{i + 1}
                            </span>
                            {dish.imageUrl ? (
                              <img 
                                src={normalizeImageUrl(dish.imageUrl)} 
                                alt={dish.name} 
                                className="w-10 h-10 rounded-xl object-cover border border-[#e5d5c5] shrink-0" 
                                referrerPolicy="no-referrer" 
                                onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                              />
                            ) : null}
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-[#2c1810] truncate">{dish.name}</h4>
                              <p className="text-[10px] text-[#8b7355] font-medium">₹{dish.price} • {dish.views} Views</p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="inline-block bg-amber-50 text-amber-800 border border-amber-200 text-xs font-extrabold px-2.5 py-1 rounded-lg">
                              {dish.quantityOrdered} Sold
                            </span>
                            <p className="text-[10px] font-mono font-bold text-[#2c1810] mt-1">₹{dish.totalRevenue.toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
        {activeTab === "profile" && (
          <div className="max-w-5xl space-y-8">
            <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-[#e5d5c5]">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-[#e5d5c5]">
                <div>
                  <h3 className="text-xl font-serif font-bold text-[#2c1810] flex items-center gap-2">
                    <Store size={24} className="text-[#d4af37]" />
                    Restaurant Profile & Billing Configuration
                  </h3>
                  <p className="text-xs text-[#8b7355] mt-1">
                    Control restaurant information, legal numbers (GSTIN/FSSAI), address, tax rates, and bill receipt footer text. All customer bills update dynamically.
                  </p>
                </div>
                <button 
                  onClick={(e) => {
                    const fakeEvent = { preventDefault: () => {} } as React.FormEvent<HTMLFormElement>;
                    handleUpdateSettings(fakeEvent);
                  }}
                  className="w-full sm:w-auto bg-[#2c1810] text-[#fdfaf6] px-6 py-3 rounded-xl font-bold hover:bg-[#4a2c1d] transition-all shadow-md flex items-center justify-center gap-2 text-xs"
                >
                  <Save size={16} />
                  Save Profile
                </button>
              </div>

              <form onSubmit={handleUpdateSettings} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Restaurant Branding */}
                  <div className="bg-[#fdfaf6] p-5 rounded-2xl border border-[#e5d5c5] space-y-4">
                    <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#2c1810] flex items-center gap-2">
                      <Building size={16} className="text-[#d4af37]" />
                      Restaurant Branding
                    </h4>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#5c4033]">Restaurant Name *</label>
                      <input 
                        type="text"
                        required
                        value={settings.restaurantName}
                        onChange={(e) => setSettings(prev => ({ ...prev, restaurantName: e.target.value }))}
                        placeholder="e.g. foQR Gourmet Restaurant"
                        className="w-full bg-white border border-[#e5d5c5] rounded-xl px-4 py-2.5 text-sm text-[#2c1810] font-medium focus:outline-none focus:ring-2 focus:ring-[#d4af37]/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#5c4033]">Tagline / Subtitle *</label>
                      <input 
                        type="text"
                        value={settings.restaurantSubtitle}
                        onChange={(e) => setSettings(prev => ({ ...prev, restaurantSubtitle: e.target.value }))}
                        placeholder="e.g. FINE DINING & MULTI CUISINE"
                        className="w-full bg-white border border-[#e5d5c5] rounded-xl px-4 py-2.5 text-sm text-[#2c1810] font-medium focus:outline-none focus:ring-2 focus:ring-[#d4af37]/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#5c4033]">Restaurant Logo Image URL</label>
                      <div className="flex items-center gap-3">
                        <input 
                          type="url"
                          value={settings.logoUrl || ""}
                          onChange={(e) => setSettings(prev => ({ ...prev, logoUrl: e.target.value }))}
                          placeholder="https://example.com/logo.png"
                          className="w-full bg-white border border-[#e5d5c5] rounded-xl px-4 py-2.5 text-xs text-[#2c1810] font-medium focus:outline-none focus:ring-2 focus:ring-[#d4af37]/30"
                        />
                        {settings.logoUrl && (
                          <img 
                            src={normalizeImageUrl(settings.logoUrl)} 
                            alt="Logo Preview" 
                            className="w-10 h-10 object-contain rounded-lg border border-[#e5d5c5] bg-white p-1 shrink-0 shadow-xs" 
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              const target = e.currentTarget;
                              const match = settings.logoUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || settings.logoUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                              if (match && match[1] && !target.dataset.triedFallback) {
                                target.dataset.triedFallback = "true";
                                target.src = `https://lh3.googleusercontent.com/d/${match[1]}`;
                              }
                            }}
                          />
                        )}
                      </div>
                      <p className="text-[10px] text-[#8b7355]">Paste direct image URL for your logo. It will render on printable bills and customer menu.</p>
                    </div>
                  </div>

                  {/* Contact & Location */}
                  <div className="bg-[#fdfaf6] p-5 rounded-2xl border border-[#e5d5c5] space-y-4">
                    <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#2c1810] flex items-center gap-2">
                      <MapPin size={16} className="text-[#d4af37]" />
                      Contact & Address Details
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-[#5c4033]">Phone Number</label>
                        <input 
                          type="text"
                          value={settings.phone}
                          onChange={(e) => setSettings(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="+91 98765 43210"
                          className="w-full bg-white border border-[#e5d5c5] rounded-xl px-3.5 py-2.5 text-xs text-[#2c1810] font-mono focus:outline-none focus:ring-2 focus:ring-[#d4af37]/30"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-[#5c4033]">Email Address</label>
                        <input 
                          type="email"
                          value={settings.email}
                          onChange={(e) => setSettings(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="contact@restaurant.com"
                          className="w-full bg-white border border-[#e5d5c5] rounded-xl px-3.5 py-2.5 text-xs text-[#2c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37]/30"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#5c4033]">Full Address (Prints on Bill Header)</label>
                      <input 
                        type="text"
                        value={settings.address}
                        onChange={(e) => setSettings(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Plot 42, Food Court, Cyber Hub, Gurugram"
                        className="w-full bg-white border border-[#e5d5c5] rounded-xl px-4 py-2.5 text-xs text-[#2c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37]/30"
                      />
                    </div>
                  </div>

                  {/* Tax & Legal Compliance */}
                  <div className="bg-[#fdfaf6] p-5 rounded-2xl border border-[#e5d5c5] space-y-4">
                    <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#2c1810] flex items-center gap-2">
                      <FileText size={16} className="text-[#d4af37]" />
                      Taxation & License Numbers
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-[#5c4033]">GSTIN Number</label>
                        <input 
                          type="text"
                          value={settings.gstin}
                          onChange={(e) => setSettings(prev => ({ ...prev, gstin: e.target.value }))}
                          placeholder="07AAAAA0000A1Z5"
                          className="w-full bg-white border border-[#e5d5c5] rounded-xl px-3.5 py-2.5 text-xs text-[#2c1810] font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#d4af37]/30"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-[#5c4033]">FSSAI License No.</label>
                        <input 
                          type="text"
                          value={settings.fssai}
                          onChange={(e) => setSettings(prev => ({ ...prev, fssai: e.target.value }))}
                          placeholder="10021011000432"
                          className="w-full bg-white border border-[#e5d5c5] rounded-xl px-3.5 py-2.5 text-xs text-[#2c1810] font-mono focus:outline-none focus:ring-2 focus:ring-[#d4af37]/30"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-[#5c4033]">Total GST Tax Rate (%)</label>
                        <div className="relative">
                          <input 
                            type="number"
                            step="0.1"
                            value={settings.taxRate}
                            onChange={(e) => setSettings(prev => ({ ...prev, taxRate: parseFloat(e.target.value) || 0 }))}
                            placeholder="5"
                            className="w-full bg-white border border-[#e5d5c5] rounded-xl px-3.5 py-2.5 text-xs text-[#2c1810] font-mono focus:outline-none focus:ring-2 focus:ring-[#d4af37]/30"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8b7355]">%</span>
                        </div>
                        <p className="text-[10px] text-[#8b7355]">Splits into equal CGST ({(settings.taxRate / 2).toFixed(1)}%) + SGST ({(settings.taxRate / 2).toFixed(1)}%)</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-[#5c4033]">Service Charge Rate (%)</label>
                        <div className="relative">
                          <input 
                            type="number"
                            step="0.1"
                            value={settings.serviceChargeRate}
                            onChange={(e) => setSettings(prev => ({ ...prev, serviceChargeRate: parseFloat(e.target.value) || 0 }))}
                            placeholder="0"
                            className="w-full bg-white border border-[#e5d5c5] rounded-xl px-3.5 py-2.5 text-xs text-[#2c1810] font-mono focus:outline-none focus:ring-2 focus:ring-[#d4af37]/30"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8b7355]">%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bill Receipt Customization & Live Preview */}
                  <div className="bg-[#fdfaf6] p-5 rounded-2xl border border-[#e5d5c5] space-y-4">
                    <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#2c1810] flex items-center gap-2">
                      <Receipt size={16} className="text-[#d4af37]" />
                      Bill Receipt Custom Footer
                    </h4>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#5c4033]">Bill Footer Message / Thank You Note</label>
                      <input 
                        type="text"
                        value={settings.billFooter}
                        onChange={(e) => setSettings(prev => ({ ...prev, billFooter: e.target.value }))}
                        placeholder="THANK YOU FOR DINING WITH US"
                        className="w-full bg-white border border-[#e5d5c5] rounded-xl px-4 py-2.5 text-xs text-[#2c1810] font-medium focus:outline-none focus:ring-2 focus:ring-[#d4af37]/30"
                      />
                    </div>

                    {/* Live Bill Header Preview Box */}
                    <div className="mt-3 bg-white p-3 rounded-xl border border-slate-300 font-mono text-[9px] text-slate-800 space-y-1 leading-tight shadow-xs">
                      <div className="text-center border-b border-dashed border-slate-300 pb-1">
                        <p className="font-extrabold uppercase text-[#2c1810] text-[10px]">{settings.restaurantName || "foQR Restaurant"}</p>
                        <p className="text-[8px] text-slate-600 uppercase font-semibold">{settings.restaurantSubtitle || "FINE DINING & MULTI CUISINE"}</p>
                        <p className="text-[7.5px] text-slate-500">{settings.address || "123 Address"} {settings.phone ? `| Ph: ${settings.phone}` : ''}</p>
                        <p className="text-[7.5px] font-bold text-slate-700">GSTIN: {settings.gstin || 'N/A'} | FSSAI: {settings.fssai || 'N/A'}</p>
                      </div>
                      <div className="text-center pt-1 text-[8px] font-extrabold text-slate-700">
                        *** {settings.billFooter || "THANK YOU FOR DINING WITH US"} ***
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#e5d5c5] flex justify-end">
                  <button 
                    type="submit" 
                    className="w-full sm:w-auto bg-[#2c1810] text-[#fdfaf6] px-8 py-3.5 rounded-xl font-bold hover:bg-[#4a2c1d] transition-all shadow-lg flex items-center justify-center gap-2 text-sm"
                  >
                    <Save size={18} />
                    Save Profile & Billing Settings
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {activeTab === "settings" && (
          <div className="max-w-4xl space-y-8">
            <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-[#e5d5c5]">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-[#e5d5c5]">
                <div>
                  <h3 className="text-xl font-serif font-bold text-[#2c1810] flex items-center gap-2">
                    <Settings size={22} className="text-[#d4af37]" />
                    Dynamic Menu Tag Customization
                  </h3>
                  <p className="text-xs text-[#8b7355] mt-1">
                    Add, edit, or delete custom menu tags with user-selected colors. Changes sync in real-time.
                  </p>
                </div>
                <div className="w-full sm:w-auto">
                  <button 
                    onClick={(e) => {
                      const fakeEvent = { preventDefault: () => {} } as React.FormEvent<HTMLFormElement>;
                      handleUpdateSettings(fakeEvent);
                    }}
                    className="w-full sm:w-auto bg-[#2c1810] text-[#fdfaf6] px-6 py-2.5 rounded-xl font-bold hover:bg-[#4a2c1d] transition-all shadow-md flex items-center justify-center gap-2 text-xs"
                  >
                    <Save size={16} />
                    Save Settings
                  </button>
                </div>
              </div>

              <form onSubmit={handleUpdateSettings} className="space-y-6">
                {settings.customTags.length === 0 ? (
                  <div className="p-8 text-center bg-[#fdfaf6] rounded-2xl border border-dashed border-[#e5d5c5]">
                    <p className="text-sm text-[#8b7355] mb-3">No custom tags created yet.</p>
                    <button
                      type="button"
                      onClick={handleAddCustomTag}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#2c1810] text-white rounded-xl text-xs font-bold"
                    >
                      <Plus size={16} />
                      Add First Custom Tag
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {settings.customTags.map((tag, index) => {
                      const presetColors = [
                        "#ef4444", "#22c55e", "#f59e0b", "#3b82f6", 
                        "#a855f7", "#ec4899", "#06b6d4", "#14b8a6", "#64748b", "#2c1810"
                      ];

                      return (
                        <div 
                          key={tag.id || index} 
                          className={cn(
                            "p-4 sm:p-5 rounded-2xl border transition-all space-y-3",
                            tag.enabled 
                              ? "bg-[#fdfaf6] border-[#e5d5c5] shadow-sm" 
                              : "bg-gray-50 border-gray-200 opacity-60"
                          )}
                        >
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 rounded-full bg-[#2c1810] text-[#d4af37] text-xs font-bold flex items-center justify-center">
                                {index + 1}
                              </span>
                              <span className="text-xs font-extrabold uppercase tracking-widest text-[#8b7355]">
                                Tag #{index + 1}
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              {/* Live Tag Badge Preview */}
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase font-bold text-[#8b7355] hidden sm:inline">Preview:</span>
                                <span 
                                  className="px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm transition-all flex items-center gap-1.5"
                                  style={{ backgroundColor: tag.color || '#2c1810' }}
                                >
                                  <span className="w-2 h-2 rounded-full bg-white/80" />
                                  {tag.label || `Tag ${index + 1}`}
                                </span>
                              </div>

                              {/* Enable/Disable switch */}
                              <label className="flex items-center gap-1.5 cursor-pointer select-none border-l border-r border-[#e5d5c5] px-3 py-0.5">
                                <input 
                                  type="checkbox"
                                  checked={tag.enabled}
                                  onChange={(e) => updateCustomTag(index, { enabled: e.target.checked })}
                                  className="w-4 h-4 rounded text-[#2c1810] focus:ring-[#d4af37]"
                                />
                                <span className="text-xs font-bold text-[#5c4033]">
                                  {tag.enabled ? "Active" : "Disabled"}
                                </span>
                              </label>

                              {/* Delete Tag Button */}
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomTag(index)}
                                className="p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors"
                                title="Delete Custom Tag"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center pt-2">
                            {/* Label input */}
                            <div className="md:col-span-6 space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-[#8b7355]">Tag Name / Label</label>
                              <input 
                                type="text"
                                value={tag.label}
                                onChange={(e) => {
                                  const newLabel = e.target.value;
                                  updateCustomTag(index, { label: newLabel });
                                  if (index === 0) setSettings(prev => ({ ...prev, spicyLabel: newLabel }));
                                  if (index === 1) setSettings(prev => ({ ...prev, vegetarianLabel: newLabel }));
                                }}
                                className="w-full bg-white border border-[#e5d5c5] rounded-xl px-3.5 py-2 text-sm text-[#2c1810] font-medium focus:outline-none focus:ring-2 focus:ring-[#d4af37]/30"
                                placeholder={`Tag ${index + 1} Label`}
                              />
                            </div>

                            {/* Color Tag Picker */}
                            <div className="md:col-span-6 space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-[#8b7355]">User-Selected Color Tag</label>
                              <div className="flex items-center gap-2 flex-wrap bg-white p-1.5 rounded-xl border border-[#e5d5c5]">
                                {presetColors.map((hex) => (
                                  <button
                                    type="button"
                                    key={hex}
                                    onClick={() => updateCustomTag(index, { color: hex })}
                                    className={cn(
                                      "w-6 h-6 rounded-full border-2 transition-transform hover:scale-110",
                                      tag.color === hex ? "border-[#2c1810] scale-110 shadow-md" : "border-transparent"
                                    )}
                                    style={{ backgroundColor: hex }}
                                    title={hex}
                                  />
                                ))}
                                {/* Custom Color Input */}
                                <div className="flex items-center gap-1.5 ml-auto pl-2 border-l border-[#e5d5c5]">
                                  <input 
                                    type="color"
                                    value={tag.color}
                                    onChange={(e) => updateCustomTag(index, { color: e.target.value })}
                                    className="w-7 h-7 rounded-lg cursor-pointer border-0 bg-transparent"
                                    title="Pick Custom Hex Color"
                                  />
                                  <span className="text-[10px] font-mono font-bold text-[#8b7355]">{tag.color}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="pt-4 border-t border-[#e5d5c5] flex justify-between items-center gap-4 flex-wrap">
                  <button
                    type="button"
                    onClick={handleAddCustomTag}
                    className="flex items-center gap-2 px-5 py-3 bg-[#fdfaf6] border border-[#e5d5c5] rounded-xl text-xs font-bold text-[#2c1810] hover:bg-white transition-all"
                  >
                    <Plus size={16} />
                    Add Another Tag
                  </button>
                  <button 
                    type="submit" 
                    className="w-full sm:w-auto bg-[#2c1810] text-[#fdfaf6] px-8 py-3.5 rounded-xl font-bold hover:bg-[#4a2c1d] transition-all shadow-lg flex items-center justify-center gap-2 text-sm"
                  >
                    <Save size={18} />
                    Save All Settings
                  </button>
                </div>
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

                <div className="space-y-2 pt-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#8b7355]">Select Item Indicator Tags</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white p-4 rounded-xl border border-[#e5d5c5]">
                    {settings.customTags.filter(t => t.enabled).map((tag, idx) => {
                      const isChecked = isEditingItem?.tags?.includes(tag.id) ||
                        (tag.id === 'tag_1' && isEditingItem?.isSpicy) ||
                        (tag.id === 'tag_2' && isEditingItem?.isVegetarian);

                      return (
                        <label key={tag.id || idx} className="flex items-center gap-2.5 cursor-pointer select-none group">
                          <input 
                            type="checkbox" 
                            name="tags"
                            value={tag.id}
                            defaultChecked={isChecked}
                            className="w-4 h-4 rounded text-[#2c1810] focus:ring-[#d4af37]"
                          />
                          <span 
                            className="px-2.5 py-0.5 rounded-full text-xs font-bold text-white shadow-xs transition-transform group-hover:scale-105"
                            style={{ backgroundColor: tag.color || '#2c1810' }}
                          >
                            {tag.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Recommended item with this dish (Best Combos) */}
                <div className="space-y-2.5 pt-4 border-t border-[#e5d5c5]">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#8b7355]">
                      Recommended Items with this Dish (Best Combos)
                    </label>
                    <span className="text-[10px] font-bold text-[#d4af37] bg-[#2c1810] px-2 py-0.5 rounded-md">
                      {selectedRecIds.length} Selected
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8b7355]">
                    Search and select complementary items to suggest to customers when viewing this dish or adding it to cart.
                  </p>

                  {/* Search Input */}
                  <div className="relative">
                    <input 
                      type="text"
                      value={recSearchQuery}
                      onChange={(e) => setRecSearchQuery(e.target.value)}
                      placeholder="Search menu items to add as recommendation..."
                      className="w-full bg-white border border-[#e5d5c5] rounded-xl px-4 py-2.5 text-xs text-[#2c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37]/30"
                    />
                    {recSearchQuery && (
                      <button 
                        type="button" 
                        onClick={() => setRecSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Selected Recommended Items Badges with Delete option */}
                  {selectedRecIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 py-1">
                      {selectedRecIds.map(id => {
                        const item = menuItems.find(m => m.id === id);
                        if (!item) return null;
                        return (
                          <span 
                            key={id} 
                            className="inline-flex items-center gap-2 px-3 py-1 bg-[#2c1810] text-[#d4af37] text-xs font-bold rounded-full shadow-xs"
                          >
                            <span>{item.name} (Rs {item.price})</span>
                            <button 
                              type="button" 
                              onClick={() => setSelectedRecIds(prev => prev.filter(rId => rId !== id))}
                              className="hover:text-red-400 p-0.5 rounded-full hover:bg-white/10 transition-colors"
                              title="Delete recommendation"
                            >
                              <X size={14} />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Scrollable Items Selection List */}
                  <div className="max-h-44 overflow-y-auto space-y-1 bg-white p-2.5 rounded-xl border border-[#e5d5c5]">
                    {menuItems
                      .filter(item => item.id !== isEditingItem?.id)
                      .filter(item => recSearchQuery === "" || item.name.toLowerCase().includes(recSearchQuery.toLowerCase()))
                      .map(item => {
                        const isChecked = selectedRecIds.includes(item.id);
                        return (
                          <div 
                            key={item.id} 
                            onClick={() => {
                              setSelectedRecIds(prev => 
                                prev.includes(item.id) 
                                  ? prev.filter(rId => rId !== item.id) 
                                  : [...prev, item.id]
                              );
                            }}
                            className={cn(
                              "flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors text-xs select-none",
                              isChecked ? "bg-[#fdfaf6] border border-[#d4af37]/40 font-bold text-[#2c1810]" : "hover:bg-gray-50 text-[#5c4033]"
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              <input 
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                className="w-4 h-4 rounded text-[#2c1810] focus:ring-[#d4af37]"
                              />
                              <span>{item.name}</span>
                            </div>
                            <span className="text-[11px] font-mono text-[#8b7355]">Rs {item.price.toFixed(2)}</span>
                          </div>
                        );
                      })}
                  </div>
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
                      const taxRate = settings.taxRate !== undefined ? settings.taxRate : 5;
                      const halfTaxRate = taxRate / 2;
                      const cgst = itemsSubtotal * (halfTaxRate / 100);
                      const sgst = itemsSubtotal * (halfTaxRate / 100);
                      const serviceChargeRate = settings.serviceChargeRate || 0;
                      const serviceCharge = itemsSubtotal * (serviceChargeRate / 100);
                      const grossTotal = itemsSubtotal + cgst + sgst + serviceCharge;
                      const grandTotalRounded = Math.round(grossTotal);
                      const roundOff = grandTotalRounded - grossTotal;

                      return (
                        <div key={order.id} className="bg-white p-3 rounded-xl border border-slate-300 font-mono text-[9px] text-slate-900 space-y-1.5 print-bulk-card leading-tight">
                          {/* Header */}
                          <div className="text-center space-y-0.5 border-b border-dashed border-slate-400 pb-1.5">
                            {settings.logoUrl && (
                              <div className="flex justify-center pb-0.5">
                                <img src={normalizeImageUrl(settings.logoUrl)} alt="Logo" className="h-8 max-w-[120px] object-contain" referrerPolicy="no-referrer" />
                              </div>
                            )}
                            <h2 className="text-xs font-extrabold uppercase tracking-wide text-black">{settings.restaurantName || "foQR RESTAURANT"}</h2>
                            <p className="text-[8px] text-slate-700 uppercase font-semibold">{settings.restaurantSubtitle || "FINE DINING & MULTI CUISINE"}</p>
                            <p className="text-[7.5px] text-slate-600">
                              {settings.address || "Plot 42, Food Court, Cyber Hub, Sector 29, Gurugram"}
                              {settings.phone ? ` | Ph: ${settings.phone}` : ''}
                              {settings.email ? ` | Email: ${settings.email}` : ''}
                            </p>
                            <div className="text-[7.5px] font-bold text-slate-800 pt-0.5">
                              {settings.gstin ? `GSTIN: ${settings.gstin}` : ''}
                              {settings.gstin && settings.fssai ? ' | ' : ''}
                              {settings.fssai ? `FSSAI: ${settings.fssai}` : ''}
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
                            <div className="flex justify-between text-slate-700 flex-wrap">
                              <span>Taxable: ₹{itemsSubtotal.toFixed(2)}</span>
                              <span>CGST ({halfTaxRate.toFixed(1)}%): ₹{cgst.toFixed(2)} | SGST ({halfTaxRate.toFixed(1)}%): ₹{sgst.toFixed(2)}</span>
                            </div>
                            {serviceCharge > 0 && (
                              <div className="flex justify-between text-slate-700">
                                <span>Service Charge ({serviceChargeRate}%):</span>
                                <span>₹{serviceCharge.toFixed(2)}</span>
                              </div>
                            )}
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
                            <p className="font-extrabold tracking-wider text-black uppercase">*** {settings.billFooter || "THANK YOU FOR DINING WITH US"} ***</p>
                            <p className="text-slate-600">Computer generated tax invoice. Powered by {settings.restaurantName || "foQR"}</p>
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

