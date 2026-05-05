// ============================================================
// AddressList.tsx — Version sécurisée et corrigée v2
// Fix 1 : constantes MAX_ADDRESSES / MAX_ADDRESS_LENGTH définies
//         localement (plus de dépendance fragile à distances.ts).
// Fix 2 : placeholder Textarea rendu via useTranslation + état
//         pour que Google Translate le prenne bien en compte.
// Fix 3 : useCallback + dépendances useEffect corrigés.
// ============================================================

import { useEffect, useState, useRef, useCallback } from "react";
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
import { useTranslation } from "@/contexts/TranslationContext";

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

// ✅ FIX 1 : Constantes définies directement ici — indépendantes de distances.ts
const MAX_ADDRESSES = 50;
const MAX_ADDRESS_LENGTH = 300;

// Textes du placeholder en français + traductions fréquentes
// La langue est détectée via useTranslation, le placeholder est mis à jour dynamiquement
// Ce qui permet à Google Translate de le prendre en compte au rechargement
const BULK_PLACEHOLDERS: Record<string, string> = {
  fr: "Une adresse par ligne :\n10 rue de la Paix, Paris\nTour Eiffel, Paris",
  en: "One address per line:\n10 Downing Street, London\nBig Ben, London",
  es: "Una dirección por línea:\nCalle Mayor 10, Madrid\nSagrada Familia, Barcelona",
  de: "Eine Adresse pro Zeile:\nUnter den Linden 10, Berlin\nBrandenburger Tor, Berlin",
  it: "Un indirizzo per riga:\nVia del Corso 10, Roma\nColosseo, Roma",
  pt: "Um endereço por linha:\nAvenida da Liberdade 10, Lisboa\nTorre de Belém, Lisboa",
  ar: "عنوان واحد في كل سطر:\nشارع الملك فهد 10، الرياض\nبرج الفيصلية، الرياض",
};

interface AddressListProps {
  addresses: string[];
  onChange: (addresses: string[]) => void;
  onValidationChange?: (isValidating: boolean, invalidAddresses: Set<string>) => void;
}

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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <li
        className={cn(
          "group flex flex-col gap-1 rounded-2xl border px-3 py-3 transition-colors duration-200",
          isDragging &&
            "border-orange-500 bg-orange-50 dark:bg-orange-900/20 shadow-lg scale-[1.02] opacity-90",
          !isDragging &&
            isValidatingThis &&
            "border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900/40 opacity-60",
          !isDragging &&
            isInvalid &&
            !isValidatingThis &&
            "border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900/40",
          !isDragging &&
            !isInvalid &&
            !isValidatingThis &&
            "border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40",
        )}
      >
        <div className="flex items-center gap-3">
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
                  : "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300",
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
                maxLength={MAX_ADDRESS_LENGTH}
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
            <div className="flex-1 flex items-center min-w-0 overflow-hidden">
              <span
                className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200 truncate cursor-default min-w-0"
                title={addr}
              >
                {addr}
              </span>
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
  onValidationChange,
}: AddressListProps) => {
  // ✅ FIX 2 : Récupère la langue courante pour adapter le placeholder
  const { lang } = useTranslation();

  const [single, setSingle] = useState("");
  const [bulk, setBulk] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const [invalidAddresses, setInvalidAddresses] = useState<Set<string>>(new Set());
  const [isValidating, setIsValidating] = useState(false);
  const validationIdRef = useRef(0);
  const [validatingAddresses, setValidatingAddresses] = useState<Set<string>>(new Set());

  const idCounterRef = useRef(0);
  const [ids, setIds] = useState<string[]>(() =>
    addresses.map(() => `addr-${idCounterRef.current++}`),
  );

  const validationCacheRef = useRef<Record<string, boolean>>({});
  const prevAddressesRef = useRef<string[]>([]);
  const LimitReachedAlert = ({ max }: { max: number }) => (
  <div className="mt-4 flex items-start gap-3 rounded-2xl border border-orange-200/50 bg-orange-50/50 p-4 dark:border-orange-900/30 dark:bg-orange-900/10 animate-in fade-in slide-in-from-top-2 duration-500">
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500 shadow-lg shadow-orange-500/20">
      <AlertCircle className="h-5 w-5 text-white" />
    </div>
    <div className="space-y-1">
      <p className="text-sm font-bold text-orange-800 dark:text-orange-300">
        Capacité maximale atteinte
      </p>
      <p className="text-[11px] leading-relaxed text-orange-700/80 dark:text-orange-400/80 uppercase tracking-wide font-medium">
        Vous avez atteint la limite de **{max} adresses**. Veuillez en supprimer pour en ajouter de nouvelles.
      </p>
    </div>
  </div>
);
  // ✅ FIX 2 : Placeholder dynamique selon la langue — mis à jour à chaque changement de langue.
  // On prend la langue courante, ou "fr" par défaut si non trouvée dans la table.
  const bulkPlaceholder = BULK_PLACEHOLDERS[lang] ?? BULK_PLACEHOLDERS["fr"];

  // Synchronise les ids avec le tableau d'adresses
  useEffect(() => {
    setIds((prev) => {
      if (prev.length === addresses.length) return prev;
      if (prev.length < addresses.length) {
        const added = Array.from(
          { length: addresses.length - prev.length },
          () => `addr-${idCounterRef.current++}`,
        );
        return [...prev, ...added];
      }
      return prev.slice(0, addresses.length);
    });
  }, [addresses.length]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // ✅ FIX 3 : useCallback pour stabiliser la référence
  const validateAddresses = useCallback(
    async (currentAddresses: string[]) => {
      if (currentAddresses.length === 0) {
        setIsValidating(false);
        setInvalidAddresses(new Set());
        onValidationChange?.(false, new Set());
        return;
      }

      const addressesToTest = currentAddresses.filter(
        (addr) => validationCacheRef.current[addr] === undefined,
      );

      if (addressesToTest.length === 0) {
        const newInvalid = new Set<string>();
        currentAddresses.forEach((addr) => {
          if (validationCacheRef.current[addr] === false) newInvalid.add(addr);
        });
        setInvalidAddresses(newInvalid);
        onValidationChange?.(false, newInvalid);
        return;
      }

      const validationId = ++validationIdRef.current;
      setIsValidating(true);
      setValidatingAddresses(new Set(addressesToTest));

      const currentInvalid = new Set(
        currentAddresses.filter((a) => validationCacheRef.current[a] === false),
      );
      onValidationChange?.(true, currentInvalid);

      for (const addr of addressesToTest) {
        if (validationId !== validationIdRef.current) return;

        try {
          const res = await geocodeAddress(addr);
          validationCacheRef.current[addr] = !!res;
        } catch {
          validationCacheRef.current[addr] = false;
        }

        setValidatingAddresses((prev) => {
          const next = new Set(prev);
          next.delete(addr);
          return next;
        });

        setInvalidAddresses(() => {
          const next = new Set<string>();
          currentAddresses.forEach((a) => {
            if (validationCacheRef.current[a] === false) next.add(a);
          });
          return next;
        });

        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      if (validationId === validationIdRef.current) {
        setIsValidating(false);
        const finalInvalid = new Set<string>();
        currentAddresses.forEach((a) => {
          if (validationCacheRef.current[a] === false) finalInvalid.add(a);
        });
        onValidationChange?.(false, finalInvalid);
      }
    },
    [onValidationChange],
  );

  // ✅ FIX 3 : Dépendances useEffect correctes
  useEffect(() => {
    const hasNewOrModified = addresses.some(
      (addr) => !prevAddressesRef.current.includes(addr),
    );

    if (hasNewOrModified || prevAddressesRef.current.length === 0) {
      validateAddresses(addresses);
    } else {
      const newInvalid = new Set<string>();
      addresses.forEach((a) => {
        if (validationCacheRef.current[a] === false) newInvalid.add(a);
      });
      setInvalidAddresses(newInvalid);
      onValidationChange?.(false, newInvalid);
    }

    prevAddressesRef.current = addresses;
  }, [addresses, validateAddresses, onValidationChange]);

  // ✅ FIX 1 : Vérifie la limite AVANT d'ajouter (constante locale = toujours définie)
  const addOne = () => {
    const v = single.trim();
    if (!v) return;
    if (v.length > MAX_ADDRESS_LENGTH) return;
    if (addresses.length >= MAX_ADDRESSES) return;
    onChange([...addresses, v]);
    setSingle("");
  };

  // ✅ FIX 1 : Limite le bulk import au quota restant
  const addBulk = () => {
    const lines = bulk
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && l.length <= MAX_ADDRESS_LENGTH);

    if (!lines.length) return;

    const available = MAX_ADDRESSES - addresses.length;
    if (available <= 0) return; // déjà à la limite

    const toAdd = lines.slice(0, available);
    onChange([...addresses, ...toAdd]);
    setBulk("");
  };

  const remove = (i: number) => {
    const removedAddr = addresses[i];
    delete validationCacheRef.current[removedAddr];
    onChange(addresses.filter((_, idx) => idx !== i));
  };

  const clearAll = () => {
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
    delete validationCacheRef.current[oldAddr];
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

  const atLimit = addresses.length >= MAX_ADDRESSES;

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
              {addresses.length}/{MAX_ADDRESSES} Arrêts
              {isValidating && " • Validation en cours..."}
              {atLimit && (
                <span className="text-orange-500 ml-1">• Limite atteinte</span>
              )}
            </p>
          </div>
        </div>
        {addresses.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="text-muted-foreground hover:bg-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" /> Vider
          </Button>
        )}
      </div>

      <Tabs defaultValue="single">
        <TabsList className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl w-full h-auto grid grid-cols-2 gap-1 border border-slate-200/50 dark:border-slate-700/50">
          <TabsTrigger
            value="single"
            className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white dark:data-[state=active]:bg-black data-[state=active]:text-orange-600 dark:data-[state=active]:text-white data-[state=active]:shadow-md transition-all font-bold flex items-center justify-center gap-2"
          >
            <Pen className="h-4 w-4" /> Manuel
          </TabsTrigger>
          <TabsTrigger
            value="bulk"
            className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white dark:data-[state=active]:bg-black data-[state=active]:text-orange-600 dark:data-[state=active]:text-white data-[state=active]:shadow-md transition-all font-bold flex items-center justify-center gap-2"
          >
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
                if (addresses.length >= MAX_ADDRESSES) return;
                onChange([...addresses, s.label]);
                setSingle("");
              }}
              onSubmit={addOne}
              placeholder="Ajouter une ville ou adresse..."
              className="rounded-xl h-12 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:text-black"
            />
            <Button
              onClick={addOne}
              disabled={!single.trim() || atLimit}
              className="h-12 w-12 rounded-xl"
            >
              <MapPinPlus className="h-12 w-12 text-white" />
            </Button>
          </div>
          {atLimit && <LimitReachedAlert max={MAX_ADDRESSES} />}
        </TabsContent>

        <TabsContent value="bulk" className="mt-8 space-y-2 z-50">
          {/* ✅ FIX 2 : placeholder mis à jour selon la langue via bulkPlaceholder */}
          <Textarea
            placeholder={bulkPlaceholder}
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            rows={5}
            onPointerDown={(e) => e.stopPropagation()}
            className="rounded-2xl h-24 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 z-50"
          />
          {atLimit && <LimitReachedAlert max={MAX_ADDRESSES} />}
          <div className="w-full mt-6">
            <Button
              onClick={addBulk}
              disabled={!bulk.trim() || atLimit}
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
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
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
