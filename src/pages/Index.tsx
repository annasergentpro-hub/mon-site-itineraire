
import { useState } from "react";
import { Header } from "@/components/Header";
import { OriginPicker } from "@/components/OriginPicker";
import { AddressList } from "@/components/AddressList";
import { ResultsList } from "@/components/ResultsList";
import { RouteMap } from "@/components/RouteMap";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Progress } from "@/components/ui/progress";
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Sparkles,
  Scale,
  Trophy,
  MousePointerClick,
  Route,
  Clock,
  Fuel,
  Code2,
  ExternalLink,
  Github,
  Mail,
  ShieldCheck,
} from "lucide-react";
import {
  GeoPoint,
  RankedStop,
  buildChainedRoute,
  geocodeMany,
  recomputeForOrder,
  formatDistance,
  formatDuration,
} from "@/lib/distances";
import { toast } from "sonner";
import heroRoute from "@/assets/hero-route.jpg";

export const Index = () => {
  const [origin, setOrigin] = useState<GeoPoint | null>(null);
  const [addresses, setAddresses] = useState<string[]>([]);
  const [order, setOrder] = useState<"asc" | "desc">("asc");

  const [resultsAsc, setResultsAsc] = useState<RankedStop[]>([]);
  const [resultsDesc, setResultsDesc] = useState<RankedStop[]>([]);
  const [testedOrders, setTestedOrders] = useState<Set<"asc" | "desc">>(new Set());
  const [comparisonShown, setComparisonShown] = useState(false);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  
  const canCompare = testedOrders.has("asc") && testedOrders.has("desc") && !loading;
  
  const totalDistance = (route: RankedStop[]) =>
    route.reduce((acc, s) => acc + (s.distanceFromPrev || 0), 0);
  const totalDuration = (route: RankedStop[]) =>
    route.reduce((acc, s) => acc + (s.durationFromPrev || 0), 0);

  const computeSingle = async (sortOrder: "asc" | "desc", preGeocodedPoints?: GeoPoint[]) => {
    if (!origin) return [];
    
    // ÉTAPE 1 : Géocodage (0% -> 40%)
    let points = preGeocodedPoints;

  // Si on n'a pas encore les points, on géocode
  if (!points) {
    points = await geocodeMany(addresses, (done, total, current) => {
      setProgress(5 + Math.round((done / total) * 35));
      if (current) setProgressLabel(`Géocodage : ${current}`);
    });
  }

    // ÉTAPE 2 : Comparaison et Analyse (40% -> 60%)
    setProgress(45);
    setProgressLabel("Comparaison des points de livraison…");
    await new Promise((r) => setTimeout(r, 600)); // Petit délai pour l'effet visuel

    // ÉTAPE 3 : Recherche d'itinéraire idéal (60% -> 80%)
    setProgress(65);
    setProgressLabel("Analyse des matrices de trafic et distances…");
    await new Promise((r) => setTimeout(r, 800));

    // ÉTAPE 4 : Optimisation finale (80% -> 95%)
    setProgressLabel(
      `Optimisation mathématique ${sortOrder === "asc" ? "Ascendante" : "Descendante"}…`,
    );
    
    const route = await buildChainedRoute(origin, points!, sortOrder, (done, total) => {
    setProgress(80 + Math.round((done / total) * 15));
  });

  return route;
  };

  const handleCompute = async () => {
    setLoading(true);
    setComparisonShown(false);
    setProgress(5);
    try {
      const ranked = await computeSingle(order);
      if (order === "asc") {
        setResultsAsc(ranked);
        setResultsDesc([]);
      } else {
        setResultsDesc(ranked);
        setResultsAsc([]);
      }
      setTestedOrders((prev) => new Set(prev).add(order));
      setProgress(100);
      toast.success(`Itinéraire ${order === "asc" ? "croissant" : "décroissant"} calculé`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 800);
    }
  };

  const handleCompare = async () => {
  setLoading(true);
  setProgress(5);
  try {
    // 1. GÉOCODAGE UNIQUE
    setProgressLabel("Analyse globale des adresses...");
    const points = await geocodeMany(addresses, (done, total, current) => {
      setProgress(5 + Math.round((done / total) * 30));
      if (current) setProgressLabel(`Géocodage : ${current}`);
    });

    // 2. CALCUL CROISSANT
    setProgressLabel("Optimisation de l'itinéraire Croissant...");
    const ascRoute = await computeSingle("asc", points); // On passe les points !
    setResultsAsc(ascRoute);

    // 3. CALCUL DÉCROISSANT
    setProgressLabel("Optimisation de l'itinéraire Décroissant...");
    const descRoute = await computeSingle("desc", points); // On passe les points !
    setResultsDesc(descRoute);

    setTestedOrders(new Set(["asc", "desc"]));
    setComparisonShown(true);
    setProgress(100);
    toast.success("Comparaison terminée !");
  } catch (e) {
    toast.error("Erreur de comparaison");
  } finally {
    setLoading(false);
    setTimeout(() => setProgress(0), 800);
  }
};

  const handleReorderAsc = async (newOrder: GeoPoint[]) => {
    if (!origin) return;
    try {
      toast.info("Recalcul de l'itinéraire bleu…");
      const recomputed = await recomputeForOrder(origin, newOrder);
      setResultsAsc(recomputed);
      toast.success("Itinéraire bleu mis à jour");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur de recalcul");
    }
  };

  const handleReorderDesc = async (newOrder: GeoPoint[]) => {
    if (!origin) return;
    try {
      toast.info("Recalcul de l'itinéraire orange…");
      const recomputed = await recomputeForOrder(origin, newOrder);
      setResultsDesc(recomputed);
      toast.success("Itinéraire orange mis à jour");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur de recalcul");
    }
  };

  const totalAsc = totalDistance(resultsAsc);
  const totalDesc = totalDistance(resultsDesc);
  const durAsc = totalDuration(resultsAsc);
  const durDesc = totalDuration(resultsDesc);
  const bestRoute =
    comparisonShown && resultsAsc.length && resultsDesc.length
      ? totalAsc <= totalDesc
        ? "asc"
        : "desc"
      : null;

  // On part sur une base de consommation de 7L/100km et un prix de 1.65€/L
  const distanceSavedMeters = Math.abs(totalAsc - totalDesc);
  const distanceSavedKm = distanceSavedMeters / 1000;
  const litersSaved = (distanceSavedKm * 7) / 100;
  const moneySaved = litersSaved * 2.1;
  // On initialise à 'true' ou on crée un nouvel état pour le premier chargement
const [isValidatingAddresses, setIsValidatingAddresses] = useState(false);
const [hasValidatedAtLeastOnce, setHasValidatedAtLeastOnce] = useState(false); // 🎯 Ajout crucial
const [invalidAddresses, setInvalidAddresses] = useState<Set<string>>(new Set());

// Modifie la logique de visibilité :
const hasAddresses = addresses.length > 0;
const allAddressesChecked = !isValidatingAddresses && hasValidatedAtLeastOnce; // 🎯 Doit être terminé ET avoir tourné une fois
const noErrors = invalidAddresses.size === 0;
const isVisible = origin && hasAddresses && allAddressesChecked;
const canCompute = isVisible && noErrors && !loading;
  return (
    <div className="min-h-screen flex flex-col bg-[#fdfeff] dark:bg-[#020617] text-slate-900 dark:text-slate-50 transition-colors duration-500">
      <div className=" bg-indigo-200/30 dark:bg-indigo-900/10 " />
          <div className=" bg-cyan-200/30 dark:bg-cyan-900/10 " />
      <Header />

      <main className="flex-1 pt-14 sm:pt-14 md:pt-14 lg:pt-20 xl:pt-24">
        {/* HERO - Design Premium avec Mesh Gradient */}
        <section className="relative overflow-hidden border-b border-indigo-100 dark:border-slate-800 bg-white dark:bg-slate-950">
          
          <div className="container relative py-16 sm:py-24 grid lg:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-in-up">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/50 dark:bg-indigo-900/20 px-4 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-6 tracking-wide shadow-sm">
                <Sparkles className="h-4 w-4" />
                INTELLIGENT ROUTING ENGINE
              </div>
              <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight mb-6 leading-[1.1]">
                Maîtrisez chaque <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500 dark:from-indigo-400 dark:to-cyan-300">
                  kilomètre parcouru.
                </span>
              </h1>
              <p className="text-lg text-slate-600 dark:text-slate-400 max-w-xl mb-10 leading-relaxed font-medium">
                La plateforme de comparaison d'itinéraires qui transforme vos données logistiques en décisions stratégiques. Plus rapide, plus vert, plus intelligent.
              </p>
              
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-3 px-5 py-2.5 bg-white dark:bg-slate-900 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 dark:border-slate-800">
                  <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Algorithme 2-opt V3</span>
                </div>
                <div className="flex items-center gap-3 px-5 py-2.5 bg-white dark:bg-slate-900 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 dark:border-slate-800">
                  <div className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Géo-codage </span>
                </div>
              </div>
            </div>
            
            <div className="relative group animate-fade-in">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
              
                <img
                  src={heroRoute}
                  alt="Interface Map"
                  className="rounded-[2.2rem] w-full h-auto grayscale-[0.2] group-hover:grayscale-0 transition-all duration-500"
                />
              
            </div>
          </div>
        </section>

        <div className="w-full px-4 lg:px-6 py-8"> 
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 max-w-full mx-auto">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800 p-2 transform transition-transform hover:scale-[1.01]">
              <OriginPicker origin={origin} onOriginChange={setOrigin} />
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] mt-6 sm:mt-3 lg:mt-0 border border-slate-100 dark:border-slate-800 p-2 transform transition-transform hover:scale-[1.01]">
              <AddressList
  addresses={addresses}
  onChange={setAddresses}
  onValidationChange={(isValidating, invalid) => {
    setIsValidatingAddresses(isValidating);
    setInvalidAddresses(invalid);
    // Si isValidating passe à false, c'est que le scan est fini
    if (!isValidating && addresses.length > 0) {
      setHasValidatedAtLeastOnce(true);
    }
  }}
/>
            </div>
          </div>

          {/* CONTROLES - Barre Sticky optimisée */}
<div className="mx-auto mt-10 rounded-[2.5rem] bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white dark:border-slate-800 p-4 sm:p-6 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.05)] sticky top-[10px] z-[9999]">
  {/* On change 'justify-between' par une grille ou un flex wrap intelligent */}
  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
    
    {/* SECTION GAUCHE : Stratégie */}
    <div className="space-y-5 min-w-fit px-4 pt-2 sm:px-0">
      <h3 className=" text-[11px] font-black uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-400">
        Stratégie de séquençage
      </h3>
      <ToggleGroup
        type="single"
        value={order}
        onValueChange={(v) => v && setOrder(v as "asc" | "desc")}
        className="bg-slate-100 pt-8 dark:bg-slate-800 p-1.5 rounded-2xl w-fit "
      >
        <ToggleGroupItem
          value="asc"
          className="rounded-xl px-4 sm:px-6 data-[state=on]:bg-white dark:data-[state=on]:bg-indigo-600 data-[state=on]:text-indigo-600 dark:data-[state=on]:text-white data-[state=on]:shadow-md transition-all font-bold text-xs sm:text-sm"
        >
          <ArrowUp className="h-4 w-4 mr-2" /> Ascendant
        </ToggleGroupItem>
        <ToggleGroupItem
          value="desc"
          className="rounded-xl px-4 sm:px-6 data-[state=on]:bg-white dark:data-[state=on]:bg-orange-600 data-[state=on]:text-orange-600 dark:data-[state=on]:text-white data-[state=on]:shadow-md transition-all font-bold text-xs sm:text-sm"
        >
          <ArrowDown className="h-4 w-4 mr-2" /> Descendant
        </ToggleGroupItem>
      </ToggleGroup>
    </div>

    {/* SECTION DROITE : Boutons d'action - On force le regroupement sans débordement */}
    <div className="flex flex-wrap items-center gap-3 self-end xl:self-center">
      {canCompare && (
        <Button
          variant="outline"
          size="lg"
          onClick={handleCompare}
          disabled={!canCompute}
          className="rounded-2xl border-indigo-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 text-indigo-600 dark:text-indigo-400 font-bold hover:bg-indigo-50 dark:hover:bg-slate-800 h-12 sm:h-14 px-4 sm:px-6 shadow-sm text-xs sm:text-sm"
        >
          <Scale className="h-4 w-4 sm:h-5 sm:w-5 mr-2 shrink-0" />
          <span className="whitespace-nowrap">Comparer</span>
        </Button>
      )}

      {isVisible && (
        <Button
          size="lg"
          onClick={handleCompute}
          disabled={!canCompute}
          className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-[0_10px_20px_rgba(79,70,229,0.3)] h-12 sm:h-14 px-5 sm:px-8 font-bold transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 animate-in fade-in zoom-in duration-300 text-xs sm:text-sm"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin mr-2" />
          ) : (
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
          )}
          <span className="whitespace-nowrap">Optimiser le trajet</span>
        </Button>
      )}
    </div>
  </div>
  {progress > 0 && (
  <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
    <div className="flex justify-between items-end">
      <div className="space-y-1">
        <p className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.2em]">
          Analyse en cours
        </p>
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
            {progressLabel}
          </span>
        </div>
      </div>
      <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
        {progress}%
      </span>
    </div>
    <div className="relative">
      {/* Barre de progression avec dégradé vif */}
      <Progress 
        value={progress} 
        className="h-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" 
      />
      {/* Effet de brillance qui suit la progression */}
      <div 
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent w-20 h-full animate-shimmer"
        style={{ left: `${progress - 10}%` }}
      />
    </div>
  </div>
)}
</div>

          {/* BANNIERE RÉSULTAT - Look Ultra-Premium Mesh & Glass */}
{comparisonShown && bestRoute && (
  <div className="max-w-6xl mx-auto mt-12 relative group animate-fade-in-up">
    {/* Effet de lueur diffuse derrière la carte (Glow effect) */}
    <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 rounded-[3rem] opacity-20 group-hover:opacity-40 transition duration-1000"></div>

    <div className="relative overflow-hidden rounded-[3rem] bg-white/70 dark:bg-slate-950/80 backdrop-blur-2xl border border-white/50 dark:border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)]">
      
      {/* MESH GRADIENT DE FOND - Couleurs vives et fluides */}
      <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-[500px] h-[500px] bg-emerald-400/20 dark:bg-emerald-500/10 blur-[100px] rounded-full" />
      <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-[400px] h-[400px] bg-cyan-400/20 dark:bg-cyan-500/10 blur-[80px] rounded-full" />

      <div className="relative p-8 md:p-10 flex flex-col lg:flex-row items-center gap-10">
        
        {/* Section Texte & Icône */}
        <div className="flex items-center gap-8 flex-1">
          <div className="relative shrink-0">
            {/* Animation de cercle pulsant derrière la coupe */}
            <div className="absolute inset-0 bg-emerald-500 blur-2xl opacity-30 animate-pulse" />
            <div className="relative h-20 w-20 rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white shadow-[0_10px_25px_rgba(16,185,129,0.4)] transform rotate-3">
              <Trophy className="h-10 w-10 drop-shadow-lg" />
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
              <Sparkles className="h-3 w-3" /> Efficacité Optimale
            </div>
            <h3 className="font-black text-3xl text-slate-900 dark:text-white tracking-tight leading-none">
              Configuration Idéale
            </h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-sm">
              L'itinéraire <span className="text-emerald-600 dark:text-emerald-400 font-bold underline decoration-emerald-500/30 underline-offset-4">{bestRoute === "asc" ? "Croissant" : "Décroissant"}</span> est le meilleur trajet pour minimiser vos coûts..
            </p>
          </div>
        </div>
 
        {/* Section Stats - Cartes en Glassmorphism */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full lg:w-auto">
          
          {/* Card Distance */}
          <div className="group/card relative bg-white/40 dark:bg-white/5 border border-white dark:border-white/10 p-6 rounded-3xl backdrop-blur-md transition-all hover:bg-white/60 dark:hover:bg-white/10 min-w-[160px]">
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3">Distance</p>
            <div className="flex flex-col">
              <span className="text-2xl font-black text-slate-900 dark:text-white">-{formatDistance(distanceSavedMeters)}</span>
              <span className="text-[11px] font-bold text-emerald-500 mt-1">Économisés</span>
            </div>
          </div>

          {/* Card Temps */}
          <div className="group/card relative bg-white/40 dark:bg-white/5 border border-white dark:border-white/10 p-6 rounded-3xl backdrop-blur-md transition-all hover:bg-white/60 dark:hover:bg-white/10 min-w-[160px]">
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3">Temps</p>
            <div className="flex flex-col">
              <span className="text-2xl font-black text-slate-900 dark:text-white">-{formatDuration(Math.abs(durAsc - durDesc))}</span>
              <span className="text-[11px] font-bold text-emerald-500 mt-1">De trajet</span>
            </div>
          </div>

          {/* Card Gasoil - La plus mise en avant */}
          <div className="group/card relative bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-3xl shadow-[0_15px_30px_rgba(16,185,129,0.25)] min-w-[170px] transform transition hover:scale-105">
            <Fuel className="absolute top-4 right-4 h-5 w-5 text-white" />
            <p className="text-[10px] font-black text-emerald-100 uppercase tracking-[0.2em] mb-3">Gain Gasoil</p>
            <div className="flex flex-col">
              <span className="text-3xl font-black text-white">{litersSaved.toFixed(1)}L</span>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-xs font-bold text-emerald-50">≈ +{moneySaved.toFixed(2)}€</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
)}
          {/* RÉSULTATS & CARTE */}
          {(resultsAsc.length > 0 || resultsDesc.length > 0) && origin && (
            <div className="max-w-6xl mx-auto mt-12 grid lg:grid-cols-2 gap-10 items-start">
              <div className="space-y-8 animate-fade-in">
                {resultsAsc.length > 0 && (
                  
                    <ResultsList stops={resultsAsc} order="asc" originLabel={origin.label} />
                  
                )}
                {resultsDesc.length > 0 && (
                  
                    <ResultsList stops={resultsDesc} order="desc" originLabel={origin.label} />
                  
                )}
              </div>

              <div className="lg:sticky lg:top-32 rounded-[3rem] overflow-hidden border border-slate-100 dark:border-slate-800 shadow-2xl h-[700px] bg-slate-50 dark:bg-slate-900">
                <RouteMap
                  origin={origin}
                  stopsAsc={resultsAsc}
                  stopsDesc={resultsDesc}
                  onReorderAsc={resultsAsc.length > 0 ? handleReorderAsc : undefined}
                  onReorderDesc={resultsDesc.length > 0 ? handleReorderDesc : undefined}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* FOOTER - Design Premium Glassmorphism */}
      <footer className="mt-20 border-t border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 items-start">
            
            {/* Section 1: Brand & Bio */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                  <Route className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-black tracking-tighter text-slate-900 dark:text-white">
                  ROUTE<span className="text-indigo-600"> COMPASS</span>
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Optimisation d'itinéraires intelligente pour professionnels et particuliers. 
                Réduisez votre empreinte carbone et vos coûts de carburant en un clic.
              </p>
              <div className="flex gap-4 pt-2">
                <a href="#" className="text-slate-400 hover:text-indigo-600 transition-colors"><Github className="h-5 w-5" /></a>
                <a href="#" className="text-slate-400 hover:text-indigo-600 transition-colors"><Mail className="h-5 w-5" /></a>
              </div>
            </div>

            {/* Section 2: Crédits & Réalisation */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
                Développement & Design
              </h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Code2 className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Dhaker Bettoumi</p>
                    <p className="text-[11px] text-slate-500">Lead Developer & UI Designer</p>
                  </div>
                </div>
                
              </div>
            </div>

            {/* Section 3: Contact & Support */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
                Contactez-nous
              </h4>
              <ul className="space-y-3">
                <li>
                  <a href="mailto:contact@exemple.com" className="group flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600 transition-colors">
                    <Mail className="h-4 w-4" />
                    <span>Support technique</span>
                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                </li>
                <li className="pt-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                    Système opérationnel
                  </div>
                </li>
              </ul>
            </div>

          </div>

          {/* Bottom Bar */}
          <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-[11px] text-slate-400 font-medium">
              Propulsé par Google Maps API & Algorithme 2-Opt Custom
            </p>
            <div className="flex gap-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Confidentialité</a>
              <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Mentions Légales</a>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 italic flex items-center gap-2">
                  <ShieldCheck className="h-3 w-3" /> Tous droits réservés © {new Date().getFullYear()}
                </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
