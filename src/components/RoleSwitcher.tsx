import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { User, Shield, Database } from "lucide-react";
import { seedDummyData } from "../firebase";
import { cn } from "../lib/utils";

export default function RoleSwitcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSeeding, setIsSeeding] = React.useState(false);

  const handleSeed = async () => {
    if (confirm("This will add dummy categories and items to your database. Continue?")) {
      setIsSeeding(true);
      try {
        await seedDummyData();
        alert("Dummy data seeded successfully! Refreshing...");
        window.location.reload();
      } catch (error) {
        alert("Seeding failed. Check console for details.");
      } finally {
        setIsSeeding(false);
      }
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3">
      <div className="bg-[#2c1810] rounded-2xl shadow-2xl p-2 border border-[#d4af37]/30 flex flex-col gap-2">
        <button
          onClick={() => navigate("/")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
            location.pathname === "/" 
              ? "bg-[#d4af37] text-[#2c1810]" 
              : "text-[#8b7355] hover:text-[#fdfaf6] hover:bg-[#4a2c1d]"
          )}
        >
          <User size={16} />
          Guest View
        </button>
        <button
          onClick={() => navigate("/admin")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
            location.pathname.startsWith("/admin") 
              ? "bg-[#d4af37] text-[#2c1810]" 
              : "text-[#8b7355] hover:text-[#fdfaf6] hover:bg-[#4a2c1d]"
          )}
        >
          <Shield size={16} />
          Owner View
        </button>
        <div className="h-px bg-[#4a2c1d] mx-2" />
        <button
          onClick={handleSeed}
          disabled={isSeeding}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-[#d4af37] hover:bg-[#4a2c1d] transition-all disabled:opacity-50"
        >
          <Database size={16} />
          {isSeeding ? "Seeding..." : "Seed Dummy Data"}
        </button>
      </div>
      <div className="text-[10px] text-center text-[#8b7355] font-bold uppercase tracking-widest bg-[#fdfaf6] py-1 rounded-full border border-[#e5d5c5]">
        Demo Controls
      </div>
    </div>
  );
}
