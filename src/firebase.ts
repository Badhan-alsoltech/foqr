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

export function setAdminSession(user: { userId: string } | null) {
  if (user) {
    localStorage.setItem("admin_user", JSON.stringify(user));
  } else {
    localStorage.removeItem("admin_user");
  }
}

export function getAdminSession(): { userId: string } | null {
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

// Test connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
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
  console.error('Firestore Error: ', errInfo);
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
