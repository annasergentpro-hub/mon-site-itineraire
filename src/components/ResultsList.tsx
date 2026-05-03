import { ArrowDown, ArrowUp, Clock, MapPin, Navigation, Route, Zap } from "lucide-react";
import { RankedStop, formatDistance, formatDuration } from "@/lib/distances";
import { cn } from "@/lib/utils";

interface ResultsListProps {
  stops: RankedStop[];
  order: "asc" | "desc";
  originLabel: string;
}

export const ResultsList = ({ stops, order, originLabel }: ResultsListProps) => {
  if (!stops.length) return null;

  const totalDistance = stops.reduce((acc, s) => acc + s.distanceFromPrev, 0);
  const totalDuration = stops.reduce((acc, s) => acc + s.durationFromPrev, 0);

  // Couleurs dynamiques selon l'ordre (Indigo pour croissant, Orange pour décroissant)
  const isAsc = order === "asc";
  const accentClass = isAsc ? "text-indigo-500" : "text-orange-500";
  const bgAccentClass = isAsc ? "bg-indigo-500" : "bg-orange-500";
  const borderAccentClass = isAsc ? "border-indigo-500/30" : "border-orange-500/30";

  return (
    <div className="relative group overflow-hidden rounded-[2.5rem] border border-slate-200/50 dark:border-slate-800/50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-2xl p-4 sm:p-6 shadow-2xl transition-all duration-500 mx-auto">
      
      {/* Effet de brillance en arrière-plan */}
      <div className={cn(
        "absolute -top-24 -right-24 w-48 h-48 blur-[80px] opacity-20 rounded-full transition-colors duration-1000",
        isAsc ? "bg-indigo-500" : "bg-orange-500"
      )} />

      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10 relative z-10">
        <div className="flex items-center gap-4">
          <div className={cn(
            "flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg transform -rotate-3 group-hover:rotate-0 transition-transform duration-500",
            bgAccentClass,
            "text-white shadow-xl shadow-current/20"
          )}>
            <Route className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
              Séquence <span className={accentClass}>Optimale</span>
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border", borderAccentClass, accentClass)}>
                {isAsc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                {isAsc ? "Croissante" : "Décroissante"}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Zap className="h-3 w-3" /> {stops.length} étapes calculées
              </span>
            </div>
          </div>
        </div>
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-900 flex justify-center"></div>
        {/* STATS CUMULÉES BOX */}
        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/50">
          <div className="text-right">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Budget Trajet Total</p>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black text-slate-900 dark:text-white leading-none">
                {formatDistance(totalDistance)}
              </span>
              <span className={cn("text-xs font-bold uppercase", accentClass)}>
                {formatDuration(totalDuration)}
              </span>
            </div>
          </div>
          <div className={cn("h-8 w-1 rounded-full opacity-30", bgAccentClass)} />
        </div>
      </div>
      <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-900 flex justify-center"></div>
      {/* TIMELINE SECTION */}
      <div className="relative px-2">
        {/* Ligne verticale stylisée - RTL compatible */}
        <div className="absolute ltr:left-[31px] rtl:right-[31px] top-6 bottom-6 w-[2px] bg-gradient-to-b from-transparent via-slate-200 dark:via-slate-800 to-transparent" />

        {/* DÉPART */}
        <div className="relative flex gap-6 pb-12 group/step">
          <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-white shadow-xl group-hover/step:scale-110 transition-transform">
            <MapPin className="h-5 w-5 text-slate-900 dark:text-white" />
            <div className="absolute -inset-1 bg-current blur-md opacity-10 animate-pulse" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Point de départ</p>
            <p className="text-base font-bold text-slate-700 dark:text-slate-200 leading-tight">
              {originLabel}
            </p>
          </div>
        </div>

        {/* ÉTAPES */}
        <div className="space-y-6">
          {stops.map((stop, i) => (
            <div
              key={`${stop.lat}-${stop.lon}-${i}`}
              className="relative flex gap-6 group/item animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              {/* Le numéro d'étape avec halo */}
              <div className="relative flex flex-col items-center">
                <div className={cn(
                  "relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white font-black text-lg transition-all duration-300 group-hover/item:scale-110 group-hover/item:shadow-2xl shadow-lg",
                  bgAccentClass
                )}>
                  {stop.order}
                  <div className="absolute inset-0 bg-white/20 rounded-2xl opacity-0 group-hover/item:opacity-100 transition-opacity" />
                </div>
              </div>

              {/* La Carte d'étape */}
              <div className="flex-1 pb-6 border-b border-slate-100 dark:border-slate-900 last:border-0">
                <div className="bg-slate-50/50 dark:bg-slate-900/30 rounded-3xl p-4 border border-transparent hover:border-slate-200 dark:hover:border-slate-800 hover:bg-white dark:hover:bg-slate-900 transition-all duration-300 shadow-sm hover:shadow-xl group-hover/item:-translate-y-1">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 tracking-tight leading-snug">
                    {stop.label}
                  </p>
                  
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                      <Navigation className={cn("h-3.5 w-3.5", accentClass)} />
                      <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                        {formatDistance(stop.distanceFromPrev)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-xs font-bold text-slate-500">
                        {formatDuration(stop.durationFromPrev)}
                      </span>
                    </div>

                    <div className="hidden sm:block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-auto">
                      depuis {i === 0 ? "Origine" : `Étape ${i}`}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER - Signature visuelle */}
      <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-900 flex justify-center">
        <p className="text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-[0.4em]">
          End of optimized sequence
        </p>
      </div>
    </div>
  );
};