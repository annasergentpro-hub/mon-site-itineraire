import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { useAddressSuggestions } from "@/hooks/use-address-suggestions";
import { AddressSuggestion } from "@/lib/distances";
import { cn } from "@/lib/utils";

interface AddressAutocompleteProps {
  value: string;
  onChange: (v: string) => void;
  onSelect?: (s: AddressSuggestion) => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

export const AddressAutocomplete = ({
  value,
  onChange,
  onSelect,
  onSubmit,
  placeholder,
  className,
  id,
}: AddressAutocompleteProps) => {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [justSelected, setJustSelected] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  const wrapperRef = useRef<HTMLDivElement>(null);
  const { suggestions, loading } = useAddressSuggestions(value, !justSelected);

  // 🔵 Fermeture au clic extérieur
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // 🔵 Calcul précis de la position de la liste flottante
  const updatePosition = () => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + window.scrollY + 8, // Petit décalage de 8px pour l'esthétique
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  };

  useEffect(() => {
    if (open) {
      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
    }
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (suggestions.length > 0 && !justSelected) {
      setOpen(true);
      updatePosition();
    } else if (suggestions.length === 0) {
      setOpen(false);
    }
    setHighlight(0);
  }, [suggestions, justSelected]);

  const choose = (s: AddressSuggestion) => {
    setJustSelected(true);
    onChange(s.label); // Met à jour la valeur de l'input
    onSelect?.(s);     // Déclenche l'action de sélection
    setOpen(false);

    // Empêche la liste de se rouvrir immédiatement après la sélection
    setTimeout(() => setJustSelected(false), 200);
  };

  return (
    <div ref={wrapperRef} className={cn("relative w-full group", className)}>
      <div className="relative flex items-center">
        <Search className="absolute left-4 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          className={cn(
            "pl-11 pr-10 h-13 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary text-base dark:text-white",
            className
          )}
          onChange={(e) => {
            setJustSelected(false);
            onChange(e.target.value);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (!open || suggestions.length === 0) {
              if (e.key === "Enter") onSubmit?.();
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => (h + 1) % suggestions.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(suggestions[highlight]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        
        {/* Loader ou Bouton Clear */}
        <div className="absolute right-4 flex items-center gap-2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          ) : value.length > 0 ? (
            <button 
              onClick={() => { onChange(""); setOpen(false); }}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <X className="h-3.5 w-3.5 text-slate-400" />
            </button>
          ) : null}
        </div>
      </div>

      {open && suggestions.length > 0 &&
        createPortal(
          <ul
            style={{
              position: "absolute",
              top: position.top,
              left: position.left,
              width: position.width,
            }}
            className="z-[9999] p-2 bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-[22px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] max-h-[380px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Suggestions
            </div>
            {suggestions.map((s, i) => (
              <li key={`${s.lat}-${s.lon}-${i}`}>
                <button
                  type="button"
                  // 💡 Utiliser onPointerDown au lieu de onClick évite le conflit de blur
                  onPointerDown={(e) => {
                    e.preventDefault();
                    choose(s);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={cn(
                    "w-full text-left px-4 py-3 text-sm rounded-[14px] flex items-start gap-3 transition-all duration-150 mb-1",
                    i === highlight
                      ? "bg-primary text-white shadow-lg shadow-primary/25 scale-[1.02]"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  <MapPin className={cn(
                    "h-4 w-4 mt-0.5 shrink-0",
                    i === highlight ? "text-white" : "text-primary"
                  )} />
                  <div className="flex flex-col">
                    <span className="font-semibold leading-snug">{s.label}</span>
                    <span className={cn(
                      "text-[11px] mt-0.5",
                      i === highlight ? "text-white/80" : "text-slate-400"
                    )}>
                      Adresse vérifiée
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
};