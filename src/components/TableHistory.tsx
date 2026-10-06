import React, { useEffect, useState, useMemo } from "react";
import { 
  db, handleFirestoreError, OperationType, getAdminSession, logoutAdmin,
  getRestaurantCol, getRestaurantDoc, fetchRestaurantBySlug, fetchRestaurantById, RestaurantProfile 
} from "../firebase";
import { collection, onSnapshot, query, orderBy, doc, getDoc, Timestamp } from "firebase/firestore";
import { User } from "firebase/auth";
import { useNavigate, useParams } from "react-router-dom";
import {
  LayoutDashboard, Utensils, QrCode, BarChart3, Settings, LogOut,
  ShoppingBag, Clock, ArrowLeft, Phone, User as UserIcon
} from "lucide-react";
import { cn } from "../lib/utils";

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
  status: "pending" | "approved" | "rejected";
  createdAt?: Timestamp;
}

export default function TableHistory() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [table, setTable] = useState<Table | null>(null);
  const [allOrders, setAllOrders] = useState<OrderRequest[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [orderRequests, setOrderRequests] = useState<OrderRequest[]>([]);
  const [currentRestaurant, setCurrentRestaurant] = useState<RestaurantProfile | null>(null);

  const { restaurantSlug, tableId } = useParams<{ restaurantSlug?: string; tableId?: string }>();
  const navigate = useNavigate();

  // Auth check and restaurant resolution
  useEffect(() => {
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
    }, 2000);

    const session = getAdminSession();
    if (!session) {
      if (restaurantSlug) {
        navigate(`/r/${restaurantSlug}/login`);
      } else {
        navigate("/login");
      }
    } else {
      setUser({ uid: "admin", email: "admin@hotel.com", displayName: session.userId } as any);
    }

    async function loadRestaurant() {
      if (restaurantSlug) {
        const r = await fetchRestaurantBySlug(restaurantSlug);
        if (r) setCurrentRestaurant(r);
      } else if (session?.restaurantId) {
        const r = await fetchRestaurantById(session.restaurantId);
        if (r) setCurrentRestaurant(r);
      } else if (session?.restaurantSlug) {
        const r = await fetchRestaurantBySlug(session.restaurantSlug);
        if (r) setCurrentRestaurant(r);
      }
    }
    loadRestaurant();

    return () => {
      clearTimeout(loadingTimeout);
    };
  }, [navigate, restaurantSlug]);

  const targetRestaurantId = currentRestaurant?.id || null;

  // Fetch all tables (for sidebar counts) and order requests
  useEffect(() => {
    const tableQuery = query(getRestaurantCol(targetRestaurantId, "tables"));
    const unsubscribeTables = onSnapshot(tableQuery, (snapshot) => {
      setTables(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Table)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, "tables"));

    const orderQuery = query(getRestaurantCol(targetRestaurantId, "orderRequests"), orderBy("createdAt", "desc"));
    const unsubscribeOrders = onSnapshot(orderQuery, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderRequest));
      setOrderRequests(orders);
      setAllOrders(orders);
    }, (error) => handleFirestoreError(error, OperationType.LIST, "orderRequests"));

    return () => {
      unsubscribeTables();
      unsubscribeOrders();
    };
  }, [targetRestaurantId]);

  // Fetch the specific table by ID
  useEffect(() => {
    if (!tableId) return;
    const fetchTable = async () => {
      try {
        const tableDoc = await getDoc(getRestaurantDoc(targetRestaurantId, "tables", tableId));
        if (tableDoc.exists()) {
          setTable({ id: tableDoc.id, ...tableDoc.data() } as Table);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, "tables");
      }
    };
    fetchTable();
  }, [tableId, targetRestaurantId]);

  // Filter booking history for the current table
  const tableOrders = useMemo(() => {
    if (!table) return [];
    return allOrders.filter(order =>
      order.tableNumber === table.name ||
      String(order.tableNumber) === String(table.tableNumber)
    );
  }, [allOrders, table]);

  const handleLogout = async () => {
    logoutAdmin();
    navigate("/login");
  };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#fdfaf6]">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#fdfaf6] flex">
      {/* Sidebar */}
      <aside className="w-64 bg-[#2c1810] text-[#fdfaf6] p-6 flex flex-col hidden md:flex">
        <div className="mb-12">
          <h1 className="text-2xl font-serif font-bold text-[#d4af37]">foQR</h1>
          <p className="text-[10px] uppercase tracking-widest text-[#8b7355]">Admin Dashboard</p>
        </div>

        <nav className="flex-1 space-y-2">
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
              onClick={() => navigate("/admin")}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-sm font-medium",
                "text-[#8b7355] hover:text-[#fdfaf6] hover:bg-[#4a2c1d]"
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
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(restaurantSlug ? `/r/${restaurantSlug}/admin` : "/admin")}
              className="p-2 text-[#8b7355] hover:text-[#d4af37] rounded-xl hover:bg-[#fdfaf6] transition-all"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="text-3xl font-serif font-bold text-[#2c1810]">Table History</h2>
              <p className="text-[#5c4033]">View booking history for a specific table</p>
            </div>
          </div>
        </header>

        {!table && !loading && (
          <div className="bg-white p-12 rounded-3xl shadow-sm border border-[#e5d5c5] text-center space-y-4">
            <div className="w-16 h-16 bg-[#fdfaf6] text-[#8b7355] border border-[#e5d5c5] rounded-2xl flex items-center justify-center mx-auto">
              <QrCode size={32} />
            </div>
            <h4 className="text-xl font-serif font-bold text-[#2c1810]">Table Not Found</h4>
            <p className="text-sm text-[#8b7355]">The table you are looking for does not exist.</p>
          </div>
        )}

        {table && (
          <div className="space-y-8">
            {/* Top: Table Information */}
            <div className="bg-white rounded-3xl shadow-sm border border-[#e5d5c5] overflow-hidden">
              <div className="bg-[#2c1810] px-6 py-4">
                <h3 className="text-xl font-serif font-bold text-[#d4af37]">Table Information</h3>
              </div>
              <div className="p-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e5d5c5]">
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-[#8b7355]">Field</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-[#8b7355]">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-4 py-3 font-medium text-[#8b7355]">Table Number</td>
                      <td className="px-4 py-3 font-bold text-[#2c1810]">{table.tableNumber}</td>
                    </tr>
                    <tr className="bg-[#fdfaf6]">
                      <td className="px-4 py-3 font-medium text-[#8b7355]">Table Name</td>
                      <td className="px-4 py-3 font-bold text-[#2c1810]">{table.name}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-[#8b7355]">Location</td>
                      <td className="px-4 py-3 text-[#2c1810]">{table.location || "N/A"}</td>
                    </tr>
                    <tr className="bg-[#fdfaf6]">
                      <td className="px-4 py-3 font-medium text-[#8b7355]">Total Bookings</td>
                      <td className="px-4 py-3 font-bold text-[#d4af37]">{tableOrders.length} order{tableOrders.length !== 1 ? "s" : ""}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom: Booking History */}
            <div className="bg-white rounded-3xl shadow-sm border border-[#e5d5c5] overflow-hidden">
              <div className="bg-[#2c1810] px-6 py-4">
                <h3 className="text-xl font-serif font-bold text-[#d4af37]">Booking History</h3>
              </div>
              <div className="p-6 overflow-x-auto">
                {tableOrders.length === 0 ? (
                  <div className="text-center py-12 space-y-4">
                    <div className="w-16 h-16 bg-[#fdfaf6] text-[#8b7355] border border-[#e5d5c5] rounded-2xl flex items-center justify-center mx-auto">
                      <ShoppingBag size={32} />
                    </div>
                    <h4 className="text-xl font-serif font-bold text-[#2c1810]">No Booking History</h4>
                    <p className="text-sm text-[#8b7355]">No orders have been placed for this table yet.</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-[#d4af37]">
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-[#8b7355]">#</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-[#8b7355]">Date & Time</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-[#8b7355]">Customer</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-[#8b7355]">Phone</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-[#8b7355]">Dishes</th>
                        <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-widest text-[#8b7355]">Total</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-[#8b7355]">Status</th>
                      </tr>
                    </thead>
                                        <tbody className="divide-y divide-[#e5d5c5]">
                      {tableOrders.map((order, idx) => (
                        <tr key={order.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#fdfaf6]/30"}>
                          <td className="px-4 py-3">
                            <span className="text-[#8b7355] font-mono">{idx + 1}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-xs font-bold text-[#2c1810] bg-[#fdfaf6] border-2 border-[#d4af37]/60 px-2.5 py-1 rounded-xl flex items-center gap-1.5 font-mono shadow-sm">
                              <Clock size={14} className="text-[#d4af37] shrink-0" />
                              {order.createdAt?.toDate
                                ? order.createdAt.toDate().toLocaleString([], {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "Just now"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-bold text-[#2c1810] flex items-center gap-1">
                              <UserIcon size={12} />
                              {order.customerName || "Guest"}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <a
                              href={`tel:${order.customerPhone}`}
                              className="text-[#5c4033] hover:text-[#d4af37] font-mono flex items-center gap-1"
                            >
                              <Phone size={12} />
                              {order.customerPhone}
                            </a>
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1 max-w-xs">
                              {order.items?.map((item, i) => (
                                <div key={i} className="flex justify-between items-center">
                                  <span className="text-[#2c1810]">
                                    <span className="font-bold text-[#d4af37] mr-1">{item.quantity}x</span>
                                    {item.name}
                                  </span>
                                  <span className="text-[#5c4033]">Rs {item.subtotal?.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-bold text-[#2c1810]">Rs {order.totalAmount?.toFixed(2)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              "px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md border",
                              order.status === "pending" && "bg-amber-50 text-amber-700 border-amber-200",
                              order.status === "approved" && "bg-green-50 text-green-700 border-green-200",
                              order.status === "rejected" && "bg-red-50 text-red-700 border-red-200"
                            )}>
                              {order.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

