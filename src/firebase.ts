import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, limit, addDoc, serverTimestamp, Timestamp, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);                                                                         
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);

// Admin Credentials Authentication in Firestore
export interface RestaurantProfile {
  id: string;
  name: string;
  slug: string;
  subtitle?: string;
  description?: string;
  logoUrl?: string;
  coverUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  fssai?: string;
  taxRate?: number;
  serviceChargeRate?: number;
  billFooter?: string;
  customTags?: Array<{ id: string; label: string; color: string; enabled: boolean }>;
  adminUserId: string;
  adminPassword: string;
  isActive: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface SuperAdminSession {
  userId: string;
  isSuperAdmin: true;
}

export interface AdminUserSession {
  userId: string;
  restaurantId?: string;
  restaurantSlug?: string;
  restaurantName?: string;
}

// Super Admin Authentication
export async function verifySuperAdminCredentials(userIdInput: string, passwordInput: string): Promise<boolean> {
  try {
    const credRef = doc(db, "superadmin", "credentials");
    const credSnap = await getDoc(credRef);
    
    if (!credSnap.exists()) {
      const defaultCreds = { userId: "superadmin", username: "superadmin", password: "superadmin123" };
      await setDoc(credRef, defaultCreds);
      return (userIdInput.trim() === "superadmin" && passwordInput.trim() === "superadmin123");
    }
    
    const data = credSnap.data();
    const validUser = data.userId || data.username || "superadmin";
    const validPass = data.password || "superadmin123";
    
    return (userIdInput.trim() === validUser && passwordInput.trim() === validPass);
  } catch (error) {
    console.error("Error verifying super admin credentials:", error);
    if (userIdInput.trim() === "superadmin" && passwordInput.trim() === "superadmin123") {
      return true;
    }
    return false;
  }
}

export function setSuperAdminSession(user: { userId: string } | null) {
  if (user) {
    localStorage.setItem("superadmin_user", JSON.stringify({ ...user, isSuperAdmin: true }));
  } else {
    localStorage.removeItem("superadmin_user");
  }
}

export function getSuperAdminSession(): SuperAdminSession | null {
  try {
    const item = localStorage.getItem("superadmin_user");
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
}

export function logoutSuperAdmin() {
  localStorage.removeItem("superadmin_user");
}

// Restaurant Admin Credentials Verification
export async function verifyRestaurantAdminCredentials(
  identifier: string, // slug or id or empty for global
  userIdInput: string, 
  passwordInput: string
): Promise<{ isValid: boolean; restaurant?: RestaurantProfile }> {
  try {
    // 1. Try finding specific restaurant if identifier given
    if (identifier && identifier.trim()) {
      const r = await fetchRestaurantBySlug(identifier.trim().toLowerCase());
      if (r) {
        if (r.adminUserId === userIdInput.trim() && r.adminPassword === passwordInput.trim()) {
          return { isValid: true, restaurant: r };
        }
      }
      const rById = await fetchRestaurantById(identifier.trim());
      if (rById) {
        if (rById.adminUserId === userIdInput.trim() && rById.adminPassword === passwordInput.trim()) {
          return { isValid: true, restaurant: rById };
        }
      }
    }

    // 2. Search all restaurants for matching admin credentials
    const restaurants = await getAllRestaurants();
    const matched = restaurants.find(r => 
      r.adminUserId === userIdInput.trim() && r.adminPassword === passwordInput.trim()
    );
    if (matched) {
      return { isValid: true, restaurant: matched };
    }

    // 3. Fallback to default legacy admin credentials
    const isLegacyAdmin = await verifyAdminCredentials(userIdInput, passwordInput);
    if (isLegacyAdmin) {
      // Find or default to first restaurant
      const defaultR = restaurants[0] || null;
      return { isValid: true, restaurant: defaultR || undefined };
    }

    return { isValid: false };
  } catch (error) {
    console.error("Error in verifyRestaurantAdminCredentials:", error);
    return { isValid: false };
  }
}

export async function verifyAdminCredentials(userIdInput: string, passwordInput: string): Promise<boolean> {
  try {
    const credRef = doc(db, "admin", "credentials");
    const credSnap = await getDoc(credRef);
    
    if (!credSnap.exists()) {
      const defaultCreds = { userId: "admin", username: "admin", password: "admin" };
      await setDoc(credRef, defaultCreds);
      return (userIdInput.trim() === "admin" && passwordInput.trim() === "admin");
    }
    
    const data = credSnap.data();
    const validUser = data.userId || data.username || "admin";
    const validPass = data.password || "admin";
    
    return (userIdInput.trim() === validUser && passwordInput.trim() === validPass);
  } catch (error) {
    console.error("Error verifying admin credentials:", error);
    if (userIdInput.trim() === "admin" && passwordInput.trim() === "admin") {
      return true;
    }
    return false;
  }
}

export function setAdminSession(user: AdminUserSession | null) {
  if (user) {
    localStorage.setItem("admin_user", JSON.stringify(user));
  } else {
    localStorage.removeItem("admin_user");
  }
}

export function getAdminSession(): AdminUserSession | null {
  try {
    const item = localStorage.getItem("admin_user");
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
}

export function logoutAdmin() {
  localStorage.removeItem("admin_user");
}

// Scoped collections helper for multi-tenancy
export function getRestaurantCol(restaurantId: string | null | undefined, colName: string) {
  if (restaurantId && restaurantId.trim()) {
    return collection(db, "restaurants", restaurantId.trim(), colName);
  }
  return collection(db, colName);
}

export function getRestaurantDoc(restaurantId: string | null | undefined, colName: string, docId: string) {
  if (restaurantId && restaurantId.trim()) {
    return doc(db, "restaurants", restaurantId.trim(), colName, docId);
  }
  return doc(db, colName, docId);
}

// Restaurant CRUD & Queries
export async function getAllRestaurants(): Promise<RestaurantProfile[]> {
  try {
    const snap = await getDocs(collection(db, "restaurants"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as RestaurantProfile));
  } catch (error) {
    console.error("Failed to load restaurants:", error);
    return [];
  }
}

export async function fetchRestaurantBySlug(slug: string): Promise<RestaurantProfile | null> {
  try {
    const cleanSlug = slug.trim().toLowerCase();
    const q = query(collection(db, "restaurants"), where("slug", "==", cleanSlug), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      return { id: d.id, ...d.data() } as RestaurantProfile;
    }
    // Also check direct doc by id in case slug was an id
    const docDirect = await getDoc(doc(db, "restaurants", cleanSlug));
    if (docDirect.exists()) {
      return { id: docDirect.id, ...docDirect.data() } as RestaurantProfile;
    }
    return null;
  } catch (error) {
    console.error("Failed to fetch restaurant by slug:", error);
    return null;
  }
}

export async function fetchRestaurantById(id: string): Promise<RestaurantProfile | null> {
  try {
    const d = await getDoc(doc(db, "restaurants", id));
    if (d.exists()) {
      return { id: d.id, ...d.data() } as RestaurantProfile;
    }
    return null;
  } catch (error) {
    console.error("Failed to fetch restaurant by id:", error);
    return null;
  }
}

export async function createRestaurantProfile(
  data: Omit<RestaurantProfile, "id" | "createdAt" | "updatedAt">,
  seedSample = true
): Promise<string> {
  const cleanSlug = data.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
  
  // Check if slug already exists
  const existing = await fetchRestaurantBySlug(cleanSlug);
  if (existing) {
    throw new Error(`A restaurant with the URL slug '${cleanSlug}' already exists.`);
  }

  const docRef = await addDoc(collection(db, "restaurants"), {
    ...data,
    slug: cleanSlug,
    isActive: data.isActive ?? true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  const restaurantId = docRef.id;

  // Initialize restaurant settings doc
  await setDoc(doc(db, "restaurants", restaurantId, "settings", "general"), {
    restaurantName: data.name,
    restaurantSubtitle: data.subtitle || "",
    address: data.address || "",
    phone: data.phone || "",
    email: data.email || "",
    logoUrl: data.logoUrl || "",
    coverUrl: data.coverUrl || "",
    gstin: data.gstin || "",
    fssai: data.fssai || "",
    taxRate: data.taxRate !== undefined ? Number(data.taxRate) : 5,
    serviceChargeRate: data.serviceChargeRate !== undefined ? Number(data.serviceChargeRate) : 0,
    billFooter: data.billFooter || "THANK YOU FOR DINING WITH US",
    spicyLabel: "Spicy Dish",
    vegetarianLabel: "Vegetarian",
    customTags: data.customTags || [
      { id: "tag_1", label: "Spicy Dish", color: "#ef4444", enabled: true },
      { id: "tag_2", label: "Vegetarian", color: "#22c55e", enabled: true },
      { id: "tag_3", label: "Chef's Special", color: "#f59e0b", enabled: true },
      { id: "tag_4", label: "Gluten-Free", color: "#3b82f6", enabled: true },
      { id: "tag_5", label: "Bestseller", color: "#a855f7", enabled: true },
    ]
  });

  // Seed sample menu if requested
  if (seedSample) {
    await seedRestaurantStarterData(restaurantId, data.name);
  } else {
    // Add default tables at least
    const defaultTables = [
      { name: "Table 1", tableNumber: "1", location: "Main Hall" },
      { name: "Table 2", tableNumber: "2", location: "Main Hall" },
      { name: "Table 3", tableNumber: "3", location: "Patio" },
      { name: "Table 4", tableNumber: "4", location: "VIP Lounge" }
    ];
    for (const table of defaultTables) {
      await addDoc(collection(db, "restaurants", restaurantId, "tables"), {
        ...table,
        createdAt: serverTimestamp()
      });
    }
  }

  return restaurantId;
}

export async function updateRestaurantProfile(
  restaurantId: string,
  data: Partial<RestaurantProfile>
): Promise<void> {
  const ref = doc(db, "restaurants", restaurantId);
  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp()
  });

  // Also update sub-settings if name/branding changed
  const updates: any = {};
  if (data.name) updates.restaurantName = data.name;
  if (data.subtitle !== undefined) updates.restaurantSubtitle = data.subtitle;
  if (data.logoUrl !== undefined) updates.logoUrl = data.logoUrl;
  if (data.address !== undefined) updates.address = data.address;
  if (data.phone !== undefined) updates.phone = data.phone;
  if (data.email !== undefined) updates.email = data.email;
  if (data.gstin !== undefined) updates.gstin = data.gstin;
  if (data.fssai !== undefined) updates.fssai = data.fssai;
  if (data.taxRate !== undefined) updates.taxRate = Number(data.taxRate);
  if (data.serviceChargeRate !== undefined) updates.serviceChargeRate = Number(data.serviceChargeRate);
  if (data.billFooter !== undefined) updates.billFooter = data.billFooter;
  if (data.customTags !== undefined) updates.customTags = data.customTags;

  if (Object.keys(updates).length > 0) {
    try {
      await setDoc(doc(db, "restaurants", restaurantId, "settings", "general"), updates, { merge: true });
    } catch (e) {
      console.error("Failed to update restaurant settings general doc:", e);
    }
  }
}

export async function deleteRestaurantProfile(restaurantId: string): Promise<void> {
  // Delete subcollections documents
  const subcols = ["categories", "menuItems", "tables", "orderRequests", "scans", "settings"];
  for (const col of subcols) {
    try {
      const snap = await getDocs(collection(db, "restaurants", restaurantId, col));
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }
    } catch (e) {
      console.warn(`Could not clear subcollection ${col}:`, e);
    }
  }
  await deleteDoc(doc(db, "restaurants", restaurantId));
}

// Test connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your database configuration.");
    }
  }
}
testConnection();

// Error handler
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Database Error: ', errInfo);
  return errInfo;
}

// Seeding utility for authentic Indian restaurant menu
export async function seedDummyData() {
  const categories = [
    { name: "Starters & Appetizers", order: 1 },
    { name: "Tandoori Specialities", order: 2 },
    { name: "Main Course", order: 3 },
    { name: "Indian Breads & Rice", order: 4 },
    { name: "Traditional Desserts", order: 5 },
    { name: "Beverages & Drinks", order: 6 }
  ];

  const items = [
    // Starters & Appetizers
    { name: "Paneer Tikka", description: "Cottage cheese cubes marinated in yogurt and Indian spices, grilled to perfection in a clay oven.", price: 280, categoryName: "Starters & Appetizers", isSpicy: false, isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=800&q=80", views: 210 },
    { name: "Crispy Samosa Platter", description: "Crispy fried pastry filled with spiced potatoes, green peas, served with mint and tamarind chutney.", price: 150, categoryName: "Starters & Appetizers", isSpicy: false, isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80", views: 180 },
    { name: "Chicken 65", description: "Spicy, deep-fried chicken marinated with chili, garlic, curry leaves, and South Indian spices.", price: 320, categoryName: "Starters & Appetizers", isSpicy: true, isVegetarian: false, imageUrl: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80", views: 240 },
    
    // Tandoori Specialities
    { name: "Tandoori Chicken", description: "Whole chicken marinated in mustard oil, yogurt, Kashmiri red chili, roasted in a traditional clay oven.", price: 490, categoryName: "Tandoori Specialities", isSpicy: true, isVegetarian: false, imageUrl: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80", views: 310 },
    { name: "Malai Soya Chaap", description: "Soy protein chunks marinated in cashew cream, green cardamom, and grilled over charcoal.", price: 290, categoryName: "Tandoori Specialities", isSpicy: false, isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=800&q=80", views: 160 },
    
    // Main Course
    { name: "Butter Chicken (Murgh Makhani)", description: "Tender tandoori chicken pieces cooked in a velvety tomato, butter, and cream gravy with fenugreek leaves.", price: 420, categoryName: "Main Course", isSpicy: false, isVegetarian: false, imageUrl: "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=800&q=80", views: 450 },
    { name: "Dal Makhani", description: "Black lentils slow-cooked overnight with white butter, cream, and subtle Punjabi spices.", price: 340, categoryName: "Main Course", isSpicy: false, isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80", views: 380 },
    { name: "Shahi Paneer", description: "Cottage cheese cubes in a rich, mild aromatic cashew nut and saffron gravy.", price: 360, categoryName: "Main Course", isSpicy: false, isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=800&q=80", views: 290 },
    
    // Indian Breads & Rice
    { name: "Hyderabadi Dum Biryani", description: "Aromatic basmati rice layered with marinated spiced chicken, saffron, and fried onions, dum-cooked.", price: 390, categoryName: "Indian Breads & Rice", isSpicy: true, isVegetarian: false, imageUrl: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80", views: 520 },
    { name: "Garlic Butter Naan", description: "Soft leavened Indian flatbread brushed with garlic butter and fresh coriander.", price: 70, categoryName: "Indian Breads & Rice", isSpicy: false, isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1626074353765-517a681e40be?auto=format&fit=crop&w=800&q=80", views: 330 },
    
    // Traditional Desserts
    { name: "Gulab Jamun (2 Pcs)", description: "Soft, golden milk-solid dumplings soaked in warm rose and cardamom scented sugar syrup.", price: 140, categoryName: "Traditional Desserts", isSpicy: false, isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=800&q=80", views: 270 },
    { name: "Saffron Rasmalai", description: "Spongy cottage cheese patties soaked in saffron-infused chilled thickened milk, garnished with pistachios.", price: 160, categoryName: "Traditional Desserts", isSpicy: false, isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&w=800&q=80", views: 220 },
    
    // Beverages & Drinks
    { name: "Special Mango Lassi", description: "Thick and creamy sweet yogurt drink blended with fresh Alphonso mango pulp and cardamom.", price: 120, categoryName: "Beverages & Drinks", isSpicy: false, isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=800&q=80", views: 190 },
    { name: "Masala Cutting Chai", description: "Traditional Indian spiced milk tea infused with fresh ginger, green cardamom, and clove.", price: 60, categoryName: "Beverages & Drinks", isSpicy: false, isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80", views: 150 }
  ];

  try {
    // 1. Add Categories and store their IDs
    const categoryMap: Record<string, string> = {};
    for (const cat of categories) {
      const docRef = await addDoc(collection(db, "categories"), cat);
      categoryMap[cat.name] = docRef.id;
    }

    // 2. Add Menu Items using the category IDs
    for (const item of items) {
      const { categoryName, ...itemData } = item;
      await addDoc(collection(db, "menuItems"), {
        ...itemData,
        categoryId: categoryMap[categoryName],
        isAvailable: true,
        createdAt: serverTimestamp()
      });
    }

    // 3. Add default settings
    await setDoc(doc(db, "settings", "general"), {
      spicyLabel: "Spicy Dish",
      vegetarianLabel: "Vegetarian"
    });

    // 4. Add default tables
    const defaultTables = [
      { name: "Table 1", tableNumber: "1", location: "Main Hall" },
      { name: "Table 2", tableNumber: "2", location: "Main Hall" },
      { name: "Table 3", tableNumber: "3", location: "Patio" },
      { name: "Table 4", tableNumber: "4", location: "Patio" },
      { name: "Table 5", tableNumber: "5", location: "VIP Lounge" },
      { name: "Table 6", tableNumber: "6", location: "VIP Lounge" }
    ];
    for (const table of defaultTables) {
      await addDoc(collection(db, "tables"), {
        ...table,
        createdAt: serverTimestamp()
      });
    }

    // 5. Add default admin credentials
    await setDoc(doc(db, "admin", "credentials"), {
      userId: "admin",
      username: "admin",
      password: "admin"
    });

    console.log("Indian Hotel Menu Seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding data:", error);
    throw error;
  }
}

export async function seedRestaurantStarterData(restaurantId: string, restaurantName: string) {
  const categories = [
    { name: "Starters & Appetizers", order: 1 },
    { name: "Tandoori Specialities", order: 2 },
    { name: "Main Course", order: 3 },
    { name: "Indian Breads & Rice", order: 4 },
    { name: "Traditional Desserts", order: 5 },
    { name: "Beverages & Drinks", order: 6 }
  ];

  const items = [
    { name: "Paneer Tikka", description: "Cottage cheese cubes marinated in yogurt and spices, grilled in a clay oven.", price: 280, categoryName: "Starters & Appetizers", isSpicy: false, isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=800&q=80", views: 120 },
    { name: "Crispy Samosa Platter", description: "Golden flaky pastry filled with spiced potatoes and peas, with mint chutney.", price: 150, categoryName: "Starters & Appetizers", isSpicy: false, isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80", views: 95 },
    { name: "Chicken 65", description: "Crisp fried spiced chicken infused with curry leaves and mustard seeds.", price: 320, categoryName: "Starters & Appetizers", isSpicy: true, isVegetarian: false, imageUrl: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80", views: 140 },
    { name: "Butter Chicken (Murgh Makhani)", description: "Tender roasted chicken in an authentic butter and cream tomato gravy.", price: 420, categoryName: "Main Course", isSpicy: false, isVegetarian: false, imageUrl: "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=800&q=80", views: 230 },
    { name: "Dal Makhani", description: "Slow-cooked black lentils simmered overnight with fresh churned butter.", price: 340, categoryName: "Main Course", isSpicy: false, isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80", views: 190 },
    { name: "Hyderabadi Dum Biryani", description: "Fragrant basmati rice cooked on slow dum with aromatic spices and saffron.", price: 390, categoryName: "Indian Breads & Rice", isSpicy: true, isVegetarian: false, imageUrl: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80", views: 310 },
    { name: "Garlic Butter Naan", description: "Freshly baked clay oven flatbread basted with garlic butter.", price: 70, categoryName: "Indian Breads & Rice", isSpicy: false, isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1626074353765-517a681e40be?auto=format&fit=crop&w=800&q=80", views: 180 },
    { name: "Gulab Jamun (2 Pcs)", description: "Soft milk dumplings soaked in rose cardamom syrup.", price: 140, categoryName: "Traditional Desserts", isSpicy: false, isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=800&q=80", views: 150 },
    { name: "Special Mango Lassi", description: "Creamy churned yogurt cooler infused with Alphonso mango nectar.", price: 120, categoryName: "Beverages & Drinks", isSpicy: false, isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=800&q=80", views: 110 }
  ];

  try {
    const categoryMap: Record<string, string> = {};
    for (const cat of categories) {
      const docRef = await addDoc(collection(db, "restaurants", restaurantId, "categories"), cat);
      categoryMap[cat.name] = docRef.id;
    }

    for (const item of items) {
      const { categoryName, ...itemData } = item;
      await addDoc(collection(db, "restaurants", restaurantId, "menuItems"), {
        ...itemData,
        categoryId: categoryMap[categoryName] || "",
        isAvailable: true,
        createdAt: serverTimestamp()
      });
    }

    const defaultTables = [
      { name: "Table 1", tableNumber: "1", location: "Main Hall" },
      { name: "Table 2", tableNumber: "2", location: "Main Hall" },
      { name: "Table 3", tableNumber: "3", location: "Patio Garden" },
      { name: "Table 4", tableNumber: "4", location: "Patio Garden" },
      { name: "Table 5", tableNumber: "5", location: "VIP Lounge" }
    ];
    for (const table of defaultTables) {
      await addDoc(collection(db, "restaurants", restaurantId, "tables"), {
        ...table,
        createdAt: serverTimestamp()
      });
    }

    console.log(`Starter data successfully seeded for restaurant: ${restaurantName} (${restaurantId})`);
  } catch (error) {
    console.error("Error seeding restaurant starter data:", error);
    throw error;
  }
}

export async function ensureDefaultRestaurant(): Promise<RestaurantProfile> {
  const restaurants = await getAllRestaurants();
  if (restaurants.length > 0) {
    return restaurants[0];
  }

  // Create default restaurant if none exists
  const defaultProfile = {
    name: "Spice & Silk Fine Dining",
    slug: "spice-and-silk",
    subtitle: "FINE DINING & MULTI CUISINE",
    description: "Authentic royal culinary journey with handcrafted spices and flavors.",
    logoUrl: "",
    coverUrl: "",
    address: "Plot 42, Food Court, Cyber Hub, Sector 29, Gurugram",
    phone: "+91 98765 43210",
    email: "contact@spiceandsilk.com",
    gstin: "07AAAAA0000A1Z5",
    fssai: "10021011000432",
    taxRate: 5,
    serviceChargeRate: 0,
    billFooter: "THANK YOU FOR DINING WITH US",
    adminUserId: "admin",
    adminPassword: "admin",
    isActive: true
  };

  const newId = await createRestaurantProfile(defaultProfile, true);
  return { id: newId, ...defaultProfile };
}
