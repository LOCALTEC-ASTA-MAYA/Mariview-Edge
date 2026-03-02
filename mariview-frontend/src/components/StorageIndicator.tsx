/**
 * Storage Indicator Component
 * Menampilkan status penyimpanan data
 */

import { useEffect, useState } from 'react';
import { Check, Database } from 'lucide-react';

export default function StorageIndicator() {
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    // Listen for storage changes
    const handleStorageChange = () => {
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    };

    window.addEventListener('mariview-storage-change', handleStorageChange);
    return () => window.removeEventListener('mariview-storage-change', handleStorageChange);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {showSaved && (
        <div className="bg-[#21A68D] text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4" />
          <span className="text-sm font-medium">Data tersimpan</span>
        </div>
      )}
    </div>
  );
}

// Helper function to trigger storage change event
export function notifyStorageChange() {
  window.dispatchEvent(new CustomEvent('mariview-storage-change'));
}
