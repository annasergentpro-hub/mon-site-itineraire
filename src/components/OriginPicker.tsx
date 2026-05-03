// Remplacer le contenu de OriginPicker.tsx

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Crosshair, Loader2, MapPin, Navigation, CheckCircle2 } from "lucide-react";
import { reverseGeocode, geocodeAddress, GeoPoint } from "@/lib/distances";
import { toast } from "sonner";
import { AddressAutocomplete } from "./AddressAutocomplete";

interface OriginPickerProps {
  origin: GeoPoint | null;
  onOriginChange: (origin: GeoPoint | null) => void;
}

export const OriginPicker = ({ origin, onOriginChange }: OriginPickerProps) => {
  const [loading, setLoading] = useState(false);
  const [manualValue, setManualValue] = useState("");

  const handleGeolocate = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Géolocalisation non disponible sur ce navigateur");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const label = await reverseGeocode(latitude, longitude);
        onOriginChange({ lat: latitude, lon: longitude, label });
        setLoading(false);
        toast.success("Position détectée");
      },
      (err) => {
        setLoading(false);
        toast.error(`Impossible de récupérer la position : ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const handleManual = async () => {
    if (!manualValue.trim()) return;
    setLoading(true);
    try {
      const point = await geocodeAddress(manualValue);
      onOriginChange(point);
      toast.success("Adresse de départ enregistrée");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur de géocodage");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-[25px] bg-white dark:bg-neutral-900/60 p-8 shadow-card flex flex-col h-full px-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold">
          <MapPin className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-bold text-slate-900 dark:text-slate-100">Point de départ</h2>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">Configuration</p>
        </div>
      </div>

      <Tabs defaultValue="gps" className="w-full flex-1">
        <TabsList className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl w-full h-auto grid grid-cols-2 gap-1 border border-slate-200/50 dark:border-slate-700/50">
          <TabsTrigger 
            value="gps" 
            className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white dark:data-[state=active]:bg-indigo-600 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-white data-[state=active]:shadow-md transition-all font-bold flex items-center justify-center gap-2"
          >
            <Crosshair className="h-4 w-4" /> GPS
          </TabsTrigger>
          <TabsTrigger 
            value="manual" 
            className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white dark:data-[state=active]:bg-indigo-600 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-white data-[state=active]:shadow-md transition-all font-bold flex items-center justify-center gap-2"
          >
            <MapPin className="h-4 w-4" /> Adresse
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gps" className="mt-6">
          <Button
            onClick={handleGeolocate}
            disabled={loading}
            className="w-full h-12 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white shadow-[0_8px_20px_rgba(99,102,241,0.3)] hover:shadow-[0_10px_25px_rgba(99,102,241,0.4)] dark:shadow-[0_8px_20px_rgba(99,102,241,0.15)] rounded-xl font-black uppercase tracking-widest text-[11px] transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Crosshair className="h-4 w-4 mr-2" />
            )}
            Détecter ma position
          </Button>
        </TabsContent>

        <TabsContent value="manual" className="mt-6 space-y-2">
          <Label htmlFor="manual-origin" className="text-[10px] font-black text-indigo-500/80 dark:text-indigo-400/80 uppercase tracking-widest ml-1">Recherche précise</Label>
          <div className="flex gap-2 z-[999]">
            <AddressAutocomplete
              id="manual-origin"
              value={manualValue}
              onChange={setManualValue}
              onSelect={(s) => {
                onOriginChange({ lat: s.lat, lon: s.lon, label: s.label, raw: s.label });
                setManualValue(s.label);
                toast.success("Adresse de départ enregistrée");
              }}
              onSubmit={handleManual}
              placeholder="Ex : 12 rue de Rivoli, Paris"
              className="rounded-xl h-12"
            />
            <Button 
              onClick={handleManual} 
              disabled={loading || !manualValue.trim()}
              className="h-12 w-12 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white shadow-md"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* --- NOUVEAU DESIGN PREMIUM POUR LA POSITION ENREGISTRÉE --- */}
      {origin && (
        <div className="mt-6 relative overflow-hidden rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 p-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
          
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  point de départ validée
                </p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">
                  {origin.label}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/50 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <Crosshair className="h-3 w-3" />
              <span className="text-[10px] font-mono font-medium">
                {origin.lat.toFixed(6)}, {origin.lon.toFixed(6)}
              </span>
            </div>
            <div className="text-[9px] font-black uppercase tracking-widest text-indigo-500/50">
              GPS Lock
            </div>
          </div>
        </div>
      )}
    </div>
  );
};