import { useMemo, useState } from "react";
import { Globe, Check, Search, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LANGUAGES } from "@/lib/languages";
import { useTranslation } from "@/contexts/TranslationContext";
import { cn } from "@/lib/utils";

export const LanguageSwitcher = () => {
  const { lang, setLang, isTranslating } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "flex items-center gap-2 h-9 px-3 rounded-full transition-all duration-300 border border-transparent",
            "hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm text-slate-700 dark:text-slate-200",
            open && "bg-white dark:bg-slate-700 shadow-sm border-slate-200/60 dark:border-slate-600/60"
          )}
          aria-label="Changer de langue"
          data-no-translate
        >
          {isTranslating ? (
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
          ) : (
            <Globe className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
          )}
          
          <div className="flex items-center gap-1.5">
            <span className="uppercase tracking-widest text-[11px] font-black mt-0.5">
              {current.code}
            </span>
            <span className="text-sm leading-none drop-shadow-sm" aria-hidden>
              {current.flag}
            </span>
          </div>

          <ChevronDown
            className={cn(
              "h-3 w-3 text-slate-400 transition-transform duration-300 ml-1",
              open && "rotate-180"
            )}
          />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={12}
        className="w-[280px] p-0 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white dark:border-slate-800 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)] dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden"
        data-no-translate
      >
        {/* En-tête avec barre de recherche stylisée */}
        <div className="p-3 border-b border-slate-100/50 dark:border-slate-800/50 bg-white/40 dark:bg-slate-950/40">
          <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50 focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-500/50 transition-all shadow-inner">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une langue..."
              className="h-6 border-0 bg-transparent p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 text-black dark:text-white"
            />
          </div>
        </div>

        {/* Liste des langues avec ScrollArea */}
        <ScrollArea className="h-[280px] px-2 py-2">
          <div className="flex flex-col gap-1 pb-2">
            {filtered.map((l) => {
              const active = l.code === lang;
              return (
                <button
                  key={l.code}
                  onClick={() => {
                    setLang(l.code);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl text-left transition-all duration-200 group",
                    active
                      ? "bg-indigo-50/80 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200/50 dark:ring-indigo-500/30 shadow-sm"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span 
                      className={cn(
                        "text-xl shrink-0 drop-shadow-sm transition-transform duration-200",
                        !active && "group-hover:scale-110"
                      )} 
                      aria-hidden
                    >
                      {l.flag}
                    </span>
                    <span className={cn("truncate text-sm", active && "font-bold")}>
                      {l.name}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest opacity-40 font-bold shrink-0 mt-0.5">
                      {l.code}
                    </span>
                  </span>
                  
                  {active && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-500/20 shrink-0">
                      <Check className="h-3 w-3 text-indigo-600 dark:text-indigo-400" strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
            
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 opacity-50">
                <Globe className="h-8 w-8 text-slate-400 mb-2" strokeWidth={1.5} />
                <p className="text-center text-xs font-medium text-slate-500">
                  Aucune langue trouvée
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};