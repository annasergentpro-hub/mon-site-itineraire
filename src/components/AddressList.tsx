import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  GripVertical,
  ListPlus,
  MapPinPlus,
  Pen,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { cn } from "@/lib/utils";
import { geocodeAddress } from "@/lib/distances";

// --- IMPORTS DND-KIT ---
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface AddressListProps {
  addresses: string[];
  onChange: (addresses: string[]) => void;
  onValidationChange?: (isValidating: boolean, invalidAddresses: Set<string>) => void;
}

// --- COMPOSANT ENFANT SORTABLE ---
// Ce composant représente UNE ligne de la liste, gérée par dnd-kit
const SortableAddress = ({
  id,
  addr,
  i,
  isEditing,
  isInvalid,
  isValidatingThis,
  editValue,
  setEditValue,
  saveEdit,
  cancelEdit,
  startEdit,
  move,
  remove,
  totalAddresses,
}: {
  id: string;
  addr: string;
  i: number;
  isEditing: boolean;
  isInvalid: boolean;
  isValidatingThis: boolean;
  editValue: string;
  setEditValue: (v: string) => void;
  saveEdit: () => void;
  cancelEdit: () => void;
  startEdit: (i: number) => void;
  move: (from: number, to: number) => void;
  remove: (i: number) => void;
  totalAddresses: number;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id }); // ID stable unique (pas l'adresse, pour éviter collisions)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1, // Passe au dessus pendant le drag
  };

  return (
    <div ref={setNodeRef} style={style}>
      <li
        className={cn(
          "group flex flex-col gap-1 rounded-2xl border px-3 py-3 transition-colors duration-200",
          isDragging && "border-orange-500 bg-orange-50 dark:bg-orange-900/20 shadow-lg scale-[1.02] opacity-90",
          !isDragging && isValidatingThis && "border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900/40 opacity-60",
          !isDragging && isInvalid && !isValidatingThis && "border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900/40",
          !isDragging && !isInvalid && !isValidatingThis && "border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40"
        )}
      >
        <div className="flex items-center gap-3">
          {/* POIGNÉE DE DRAG : on attache les attributes et listeners ICI */}
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 hover:text-slate-500 p-1 touch-none"
          >
            <GripVertical className="h-5 w-5 pointer-events-none" />
          </div>

          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-[11px] font-black shadow-sm border",
              isValidatingThis
                ? "bg-blue-500 border-blue-400 text-white animate-pulse"
                : isInvalid
                ? "bg-red-500 border-red-400 text-white"
                : "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300"
            )}
          >
            {isValidatingThis ? "..." : i + 1}
          </span>

          {isEditing ? (
            <div className="flex-1 flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") cancelEdit();
                }}
                autoFocus
                className="h-9 text-sm rounded-xl border-orange-300 focus:ring-orange-500 dark:border-orange-500/50 dark:focus:ring-orange-400 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
              <button
                onClick={saveEdit}
                className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition-colors"
              >
                <Check className="h-4 w-4 font-bold" />
              </button>
              <button
                onClick={cancelEdit}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
  // 1. On enveloppe l'adresse et les boutons dans un conteneur flex
  <div className="flex-1 flex items-center min-w-0 overflow-hidden">
    
    {/* 2. L'adresse : flex-1 lui permet de prendre tout l'espace */}
    <span
      className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200 truncate cursor-default min-w-0"
      title={addr}
    >
      {addr}
    </span>

    {/* 3. LES BOUTONS : On remplace 'opacity-0' par 'hidden' et 'group-hover:flex' */}
    <div className="hidden group-hover:flex items-center gap-1 shrink-0 ml-2 animate-in fade-in slide-in-from-right-2 duration-200">
      <button
        onClick={() => move(i, i - 1)}
        disabled={i === 0}
        className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-md disabled:opacity-30 transition-colors"
      >
        <ArrowUp className="h-4 w-4" />
      </button>
      <button
        onClick={() => move(i, i + 1)}
        disabled={i === totalAddresses - 1}
        className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-md disabled:opacity-30 transition-colors"
      >
        <ArrowDown className="h-4 w-4" />
      </button>
      <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
      <button
        onClick={() => startEdit(i)}
        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => remove(i)}
        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  </div>
)}
        </div>

        {isValidatingThis && (
          <div className="flex items-center gap-1.5 mt-1.5 ml-10 animate-pulse">
            <div className="h-3 w-3 rounded-full bg-blue-500 animate-bounce" />
            <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-tight">
              Vérification en cours...
            </p>
          </div>
        )}

        {!isValidatingThis && isInvalid && (
          <div className="flex items-center gap-1.5 mt-1.5 ml-10 animate-in slide-in-from-top-1">
            <AlertCircle className="h-3.5 w-3.5 text-red-500" />
            <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-tight">
              Adresse introuvable : Essayez de modifier ou d'enlever la rue.
            </p>
          </div>
        )}
      </li>
    </div>
  );
};


// --- COMPOSANT PRINCIPAL ---
export const AddressList = ({ 
  addresses, 
  onChange,
  onValidationChange
}: AddressListProps) => {
  const [single, setSingle] = useState("");
  const [bulk, setBulk] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  
  const [invalidAddresses, setInvalidAddresses] = useState<Set<string>>(new Set());
  const [isValidating, setIsValidating] = useState(false);
  const validationIdRef = useRef(0);
  const [validatingAddresses, setValidatingAddresses] = useState<Set<string>>(new Set());

  // IDs stables uniques pour le drag-and-drop (évite les collisions si 2 adresses identiques
  // ou si une adresse change pendant l'édition)
  const idCounterRef = useRef(0);
  const [ids, setIds] = useState<string[]>(() => addresses.map(() => `addr-${idCounterRef.current++}`));

  // Synchronise les ids avec la longueur du tableau d'adresses (ajout/suppression)
  useEffect(() => {
    setIds((prev) => {
      if (prev.length === addresses.length) return prev;
      if (prev.length < addresses.length) {
        const added = Array.from({ length: addresses.length - prev.length }, () => `addr-${idCounterRef.current++}`);
        return [...prev, ...added];
      }
      return prev.slice(0, addresses.length);
    });
  }, [addresses.length]);

  // Senseurs pour dnd-kit (évite que le clic normal ne déclenche le drag)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Il faut bouger de 8px pour déclencher le glissement
      },
    })
  );

  const addOne = () => {
    const v = single.trim();
    if (!v) return;
    onChange([...addresses, v]);
    setSingle("");
  };

  const addBulk = () => {
    const lines = bulk
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return;
    onChange([...addresses, ...lines]);
    setBulk("");
  };

  const remove = (i: number) => {
    const removedAddr = addresses[i];
    // Nettoyage du cache de validation
    delete validationCacheRef.current[removedAddr];
    onChange(addresses.filter((_, idx) => idx !== i));
  };

  // ... à l'intérieur de AddressList ...

// ... à l'intérieur du composant principal AddressList ...

// On crée un cache pour stocker le statut des adresses (true = valide, false = invalide)
const validationCacheRef = useRef<Record<string, boolean>>({});

const validateAddresses = async (currentAddresses: string[]) => {
  if (currentAddresses.length === 0) {
    setIsValidating(false);
    onValidationChange?.(false, new Set());
    return;
  }

  // Identifier les adresses qui n'ont jamais été testées
  const addressesToTest = currentAddresses.filter(
    (addr) => validationCacheRef.current[addr] === undefined
  );

  // Si toutes les adresses sont déjà connues, on met juste à jour l'état global
  if (addressesToTest.length === 0) {
    const newInvalid = new Set<string>();
    currentAddresses.forEach(addr => {
      if (validationCacheRef.current[addr] === false) newInvalid.add(addr);
    });
    setInvalidAddresses(newInvalid);
    onValidationChange?.(false, newInvalid);
    return;
  }

  const validationId = ++validationIdRef.current;
  setIsValidating(true);
  onValidationChange?.(true, invalidAddresses); 

  // On ne marque comme "en cours" que celles qu'on teste vraiment
  setValidatingAddresses(new Set(addressesToTest));

  for (const addr of addressesToTest) {
    if (validationId !== validationIdRef.current) return;
    
    try {
      const res = await geocodeAddress(addr);
      const isValid = !!res;
      // On mémorise le résultat
      validationCacheRef.current[addr] = isValid;
    } catch (e) {
      validationCacheRef.current[addr] = false;
    }
    
    // Mise à jour de l'UI de chargement
    setValidatingAddresses((prev) => {
      const next = new Set(prev);
      next.delete(addr);
      return next;
    });
    
    // Mise à jour des adresses invalides basée sur le cache
    setInvalidAddresses((prev) => {
      const next = new Set();
      currentAddresses.forEach(a => {
        if (validationCacheRef.current[a] === false) next.add(a);
      });
      return next as Set<string>;
    });

    await new Promise((resolve) => setTimeout(resolve, 300)); 
  }

  if (validationId === validationIdRef.current) {
    setIsValidating(false);
    const finalInvalid = new Set<string>();
    currentAddresses.forEach(a => {
      if (validationCacheRef.current[a] === false) finalInvalid.add(a);
    });
    onValidationChange?.(false, finalInvalid); 
  }
};

// --- MODIFICATION DU USEEFFECT ---
// Pour éviter de déclencher la validation lors d'un simple déplacement (DND),
// nous comparons le contenu de la liste plutôt que sa structure.
const prevAddressesRef = useRef<string[]>([]);

useEffect(() => {
  // On vérifie si une adresse a été ajoutée ou modifiée
  // On ignore si c'est juste un changement d'ordre
  const hasNewOrModified = addresses.some(addr => !prevAddressesRef.current.includes(addr));
  
  // On déclenche la validation seulement si le contenu change (ajout/modif)
  // ou si c'est le premier chargement
  if (hasNewOrModified || prevAddressesRef.current.length === 0) {
    validateAddresses(addresses);
  } else {
    // Si c'est juste un déplacement ou une suppression, 
    // on recalcule juste l'état des erreurs sans appeler l'API
    const newInvalid = new Set<string>();
    addresses.forEach(a => {
      if (validationCacheRef.current[a] === false) newInvalid.add(a);
    });
    setInvalidAddresses(newInvalid);
    onValidationChange?.(false, newInvalid);
  }

  prevAddressesRef.current = addresses;
}, [addresses]);

  const clearAll = () => {
    // Nettoyage complet du cache de validation
    validationCacheRef.current = {};
    onChange([]);
    setInvalidAddresses(new Set());
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= addresses.length) return;
    const next = [...addresses];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const startEdit = (i: number) => {
    setEditingIdx(i);
    setEditValue(addresses[i]);
  };

  const cancelEdit = () => {
    setEditingIdx(null);
    setEditValue("");
  };

  const saveEdit = () => {
    if (editingIdx === null) return;
    
    const oldAddr = addresses[editingIdx];
    const newAddr = editValue.trim();
    
    // Supprime l'ancienne adresse du cache
    delete validationCacheRef.current[oldAddr];
    
    // Supprime aussi de invalidAddresses
    setInvalidAddresses((prev) => {
      const next = new Set(prev);
      next.delete(oldAddr);
      return next;
    });
    
    if (!newAddr) {
      remove(editingIdx);
    } else {
      const next = [...addresses];
      next[editingIdx] = newAddr;
      onChange(next);
    }
    cancelEdit();
  };

  // Gestionnaire de fin de glisser-déposer (utilise les IDs stables)
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;
      onChange(arrayMove(addresses, oldIndex, newIndex));
      setIds((prev) => arrayMove(prev, oldIndex, newIndex));
    }
  };

  return (
    <div className="rounded-[25px] bg-white dark:bg-neutral-900/60 p-5 sm:p-5 shadow-card px-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 shadow-sm font-bold">
            <ListPlus className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Destinations</h2>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">
              {addresses.length} Arrêts
              {isValidating && " • Validation en cours..."}
            </p>
          </div>
        </div>
        {addresses.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground hover:bg-red-500">
            <Trash2 className="h-3.5 w-3.5" /> Vider
          </Button>
        )}
      </div>

      <Tabs defaultValue="single">
        <TabsList className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl w-full h-auto grid grid-cols-2 gap-1 border border-slate-200/50 dark:border-slate-700/50">
          <TabsTrigger value="single" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white dark:data-[state=active]:bg-black data-[state=active]:text-orange-600 dark:data-[state=active]:text-white data-[state=active]:shadow-md transition-all font-bold flex items-center justify-center gap-2">
            <Pen className="h-4 w-4" /> Manuel
          </TabsTrigger>
          <TabsTrigger value="bulk" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white dark:data-[state=active]:bg-black data-[state=active]:text-orange-600 dark:data-[state=active]:text-white data-[state=active]:shadow-md transition-all font-bold flex items-center justify-center gap-2">
            <ListPlus className="h-4 w-4" /> En bloc
          </TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="mt-8">
          <p className="text-[8px] sm:text-[10px] lg:text-[10px] font-black text-indigo-500/80 dark:text-indigo-400/80 uppercase tracking-widest ml-1">
            Choisissez une suggestion dans la liste pour garantir la reconnaissance.
          </p>
          <div className="flex gap-2 items-start mt-2 relative z-[50]">
            <AddressAutocomplete
              value={single}
              onChange={setSingle}
              onSelect={(s) => {
                onChange([...addresses, s.label]);
                setSingle("");
              }}
              onSubmit={addOne}
              placeholder="Ajouter une ville ou adresse..."
              className="rounded-xl h-12 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:text-black" 
            />
            <Button onClick={addOne} disabled={!single.trim()} className="h-12 w-12 rounded-xl ">
              <MapPinPlus className="h-12 w-12 text-white" />
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="bulk" className="mt-8 space-y-2 z-50">
          <Textarea
            placeholder={"Une adresse par ligne :\n10 rue de la Paix, Paris\nTour Eiffel, Paris"}
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            rows={5}
            onPointerDown={(e) => e.stopPropagation()}
            className="rounded-2xl h-24 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 z-50"
          />
          <div className="w-full mt-6">
            <Button 
              onClick={addBulk} 
              disabled={!bulk.trim()} 
              className="w-full h-12 mt-6 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-[0_8px_20px_rgba(249,115,22,0.3)] hover:shadow-[0_10px_25px_rgba(249,115,22,0.4)] dark:shadow-[0_8px_20px_rgba(249,115,22,0.15)] rounded-xl font-black uppercase tracking-widest text-[11px] transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
            >
              <ListPlus className="h-4 w-4 mr-2" /> Ajouter toutes les lignes
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {addresses.length > 0 && (
        <div className="mt-6">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={ids}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar pb-4">
                {addresses.map((addr, i) => {
                  const id = ids[i] ?? `addr-fallback-${i}`;
                  return (
                    <SortableAddress
                      key={id}
                      id={id}
                      addr={addr}
                      i={i}
                      isEditing={editingIdx === i}
                      isInvalid={invalidAddresses.has(addr)}
                      isValidatingThis={validatingAddresses.has(addr)}
                      editValue={editValue}
                      setEditValue={setEditValue}
                      saveEdit={saveEdit}
                      cancelEdit={cancelEdit}
                      startEdit={startEdit}
                      move={move}
                      remove={remove}
                      totalAddresses={addresses.length}
                    />
                  );
                })}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
};