import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import { SOURCE_LANG } from "@/lib/languages";

/**
 * TranslationProvider :
 *  - Parcourt le DOM, récupère tous les noeuds texte visibles
 *  - Les envoie en lot à l'API publique Google Translate
 *  - Met en cache les traductions par (langue, texte source)
 *  - Observe les mutations du DOM pour traduire le contenu dynamique
 *
 *  Le contenu source est en français (SOURCE_LANG = "fr").
 *  Si l'utilisateur choisit "fr", on restaure les textes originaux.
 */

const STORAGE_KEY = "rc-language";

type Ctx = {
  lang: string;
  setLang: (lang: string) => void;
  isTranslating: boolean;
};

const TranslationContext = createContext<Ctx>({
  lang: SOURCE_LANG,
  setLang: () => {},
  isTranslating: false,
});

export const useTranslation = () => useContext(TranslationContext);

// Cache global : Map<lang, Map<sourceText, translatedText>>
const translationCache = new Map<string, Map<string, string>>();

// Marqueur sur les noeuds texte pour conserver l'original
const ORIGINAL_KEY = "__rc_original_text__";

// Tags à ignorer
const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "CODE",
  "PRE",
  "TEXTAREA",
]);

// Attribut data pour exclure manuellement
const SKIP_ATTR = "data-no-translate";

const isSkippable = (node: Node): boolean => {
  let parent: HTMLElement | null = node.parentElement;
  while (parent) {
    if (SKIP_TAGS.has(parent.tagName)) return true;
    if (parent.hasAttribute(SKIP_ATTR)) return true;
    parent = parent.parentElement;
  }
  return false;
};

// Récupère tous les noeuds texte non vides
const collectTextNodes = (root: Node): Text[] => {
  const result: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      const text = n.nodeValue;
      if (!text || !text.trim()) return NodeFilter.FILTER_REJECT;
      // Ignore les chaînes uniquement numériques / symboles
      // On utilise \p{L} avec le flag 'u' pour détecter n'importe quelle lettre (universel)
if (!/\p{L}/u.test(text)) return NodeFilter.FILTER_REJECT;
      if (isSkippable(n)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node: Node | null;
  while ((node = walker.nextNode())) result.push(node as Text);
  return result;
};

// NOUVEAU : Marqueur pour se souvenir de la dernière modification du traducteur
const LAST_SET_KEY = "__rc_last_set__";

// Stocke le texte original sur le noeud intelligemment
const ensureOriginal = (n: any): string => {
  const currentText = n.nodeValue ?? "";
  
  if (n[ORIGINAL_KEY] === undefined) {
    n[ORIGINAL_KEY] = currentText;
    n[LAST_SET_KEY] = currentText;
  } else {
    // Si le texte affiché n'est NI l'original de départ, NI notre dernière traduction,
    // c'est que React vient d'injecter une NOUVELLE adresse ! On met donc à jour.
    if (currentText !== n[ORIGINAL_KEY] && currentText !== n[LAST_SET_KEY]) {
      n[ORIGINAL_KEY] = currentText;
      n[LAST_SET_KEY] = currentText;
    }
  }
  
  return n[ORIGINAL_KEY] as string;
};

// Traduit un lot de chaînes via l'endpoint public Google Translate.
// Retourne un Map<source, translation>
const translateBatch = async (
  texts: string[],
  target: string,
): Promise<Map<string, string>> => {
  const out = new Map<string, string>();
  if (texts.length === 0) return out;

  const unique = Array.from(new Set(texts));
  const chunks: string[][] = [];
  let current: string[] = [];
  let currentLen = 0;

  for (const t of unique) {
    if (currentLen + t.length > 1500 && current.length > 0) {
      chunks.push(current);
      current = [];
      currentLen = 0;
    }
    current.push(t);
    currentLen += t.length + 5;
  }
  if (current.length > 0) chunks.push(current);

  // Utilisation d'un séparateur plus neutre et moins susceptible d'être altéré
  const SEP = " ||| "; 

  await Promise.all(
    chunks.map(async (chunk) => {
      const joined = chunk.join(SEP);
      const url =
        `https://translate.googleapis.com/translate_a/single?client=gtx` +
        `&sl=${SOURCE_LANG}&tl=${encodeURIComponent(target)}&dt=t&q=` +
        encodeURIComponent(joined);

      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("fail");
        const data = await res.json();
        
        // Google Translate renvoie parfois plusieurs segments pour une seule chaîne
        // On reconstruit la réponse complète
        const fullTranslated = data[0].map((seg: any) => seg[0]).join("");
        
        // On split avec une regex plus souple sur les espaces (crucial pour le RTL)
        const parts = fullTranslated.split(/\s*\|\|\|\s*/);
        
        chunk.forEach((src, i) => {
          // Si le split échoue, on garde l'original au lieu de rien
          out.set(src, parts[i]?.trim() || src);
        });
      } catch (err) {
        console.error("Erreur traduction:", err);
        chunk.forEach((src) => out.set(src, src));
      }
    }),
  );

  return out;
};

export const TranslationProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<string>(SOURCE_LANG);
  const [isTranslating, setIsTranslating] = useState(false);
  const observerRef = useRef<MutationObserver | null>(null);
  const langRef = useRef(lang);
  langRef.current = lang;

  // Charge la langue stockée
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setLangState(stored);
  }, []);

  // Applique les traductions à un ensemble de noeuds texte
  const applyTo = useCallback(async (nodes: Text[], targetLang: string) => {
     if (targetLang === SOURCE_LANG) {
      // Restaurer les originaux
      nodes.forEach((n: any) => {
        const orig = ensureOriginal(n);
        if (n.nodeValue !== orig) {
          n.nodeValue = orig;
          n[LAST_SET_KEY] = orig; // ✅ NOUVEAU : On mémorise
        }
      });
      restoreAttrs();
      return;
    }

    // Cache existant
    let cache = translationCache.get(targetLang);
    if (!cache) {
      cache = new Map();
      translationCache.set(targetLang, cache);
    }

    const sources: string[] = [];
    nodes.forEach((n) => {
      const orig = ensureOriginal(n).trim();
      if (orig && !cache!.has(orig)) sources.push(orig);
    });

    if (sources.length > 0) {
      const result = await translateBatch(sources, targetLang);
      result.forEach((v, k) => cache!.set(k, v));
    }

    // Si la langue a changé entre temps, on n'applique pas
    if (langRef.current !== targetLang) return;

    nodes.forEach((n: any) => {
      const orig = ensureOriginal(n);
      const trimmed = orig.trim();
      const translated = cache!.get(trimmed);
      if (translated) {
        // Préserve les espaces autour
        const leading = orig.match(/^\s*/)?.[0] ?? "";
        const trailing = orig.match(/\s*$/)?.[0] ?? "";
        const next = leading + translated + trailing;
        if (n.nodeValue !== next) {
          n.nodeValue = next;
          n[LAST_SET_KEY] = next; // ✅ NOUVEAU : On mémorise qu'on a traduit ça
        }
      }
    });

    // Attributs traduisibles : placeholder, title, aria-label, alt
    await translateAttrs(targetLang, cache);
  }, []);

  // Traduction des attributs
  const ATTR_LIST = ["placeholder", "title", "aria-label", "alt"] as const;
  const ATTR_ORIG = "data-rc-orig-attrs";

  const restoreAttrs = () => {
    document.querySelectorAll(`[${ATTR_ORIG}]`).forEach((el) => {
      try {
        const data = JSON.parse(el.getAttribute(ATTR_ORIG) || "{}");
        Object.entries(data).forEach(([k, v]) => {
          el.setAttribute(k, String(v));
        });
      } catch {
        /* ignore */
      }
    });
  };

  const translateAttrs = async (
    targetLang: string,
    cache: Map<string, string>,
  ) => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(
        ATTR_LIST.map((a) => `[${a}]`).join(","),
      ),
    ).filter((el) => {
      if (el.hasAttribute(SKIP_ATTR)) return false;
      const tag = el.tagName;
      if (SKIP_TAGS.has(tag)) return false;
      return true;
    });

    const toTranslate: string[] = [];
    elements.forEach((el) => {
      let stored: Record<string, string> = {};
      const existing = el.getAttribute(ATTR_ORIG);
      if (existing) {
        try {
          stored = JSON.parse(existing);
        } catch {
          stored = {};
        }
      }
      ATTR_LIST.forEach((attr) => {
        const val = el.getAttribute(attr);
        if (!val || !val.trim()) return;
        if (!/[A-Za-zÀ-ÿ\u0400-\u04FF]/.test(val)) return;
        if (!(attr in stored)) {
          stored[attr] = val;
        }
        const orig = stored[attr].trim();
        if (orig && !cache.has(orig)) toTranslate.push(orig);
      });
      if (Object.keys(stored).length > 0) {
        el.setAttribute(ATTR_ORIG, JSON.stringify(stored));
      }
    });

    if (toTranslate.length > 0) {
      const result = await translateBatch(toTranslate, targetLang);
      result.forEach((v, k) => cache.set(k, v));
    }

    if (langRef.current !== targetLang) return;

    elements.forEach((el) => {
      const existing = el.getAttribute(ATTR_ORIG);
      if (!existing) return;
      try {
        const stored = JSON.parse(existing) as Record<string, string>;
        Object.entries(stored).forEach(([attr, orig]) => {
          const tr = cache.get(orig.trim());
          if (tr) el.setAttribute(attr, tr);
        });
      } catch {
        /* ignore */
      }
    });
  };

  // Traduit toute la page
  const translateAll = useCallback(
    async (targetLang: string) => {
      setIsTranslating(true);
      try {
        const nodes = collectTextNodes(document.body);
        await applyTo(nodes, targetLang);
      } finally {
        setIsTranslating(false);
      }
    },
    [applyTo],
  );

  // Setter avec persistance
  const setLang = useCallback(
    (next: string) => {
      localStorage.setItem(STORAGE_KEY, next);
      setLangState(next);
      document.documentElement.lang = next;
      // direction RTL pour certaines langues
      const rtl = ["ar", "he", "fa", "ur", "ps", "yi", "sd"];
      document.documentElement.dir = rtl.includes(next) ? "rtl" : "ltr";
    },
    [],
  );

  // Effet : à chaque changement de langue, retraduire
  useEffect(() => {
    langRef.current = lang;
    document.documentElement.lang = lang;
    const rtl = ["ar", "he", "fa", "ur", "ps", "yi", "sd"];
    document.documentElement.dir = rtl.includes(lang) ? "rtl" : "ltr";
    // Donne un tick pour laisser React peindre
    const t = setTimeout(() => translateAll(lang), 50);
    return () => clearTimeout(t);
  }, [lang, translateAll]);

  // MutationObserver : à chaque changement DOM, traduire les nouveaux noeuds
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    let pending = new Set<Node>();
    let scheduled: number | null = null;

    const flush = () => {
      scheduled = null;
      const targetLang = langRef.current;
      if (targetLang === SOURCE_LANG) {
        // On restaure quand même (au cas où re-render)
        const nodes: Text[] = [];
        pending.forEach((n) => {
          if (n.nodeType === Node.TEXT_NODE) {
            nodes.push(n as Text);
          } else if (n instanceof Element) {
            nodes.push(...collectTextNodes(n));
          }
        });
        applyTo(nodes, targetLang);
        pending.clear();
        return;
      }
      const nodes: Text[] = [];
      pending.forEach((n) => {
        if (n.nodeType === Node.TEXT_NODE) {
          if (!isSkippable(n)) nodes.push(n as Text);
        } else if (n instanceof Element) {
          nodes.push(...collectTextNodes(n));
        }
      });
      pending.clear();
      if (nodes.length > 0) applyTo(nodes, targetLang);
    };

    const schedule = () => {
      if (scheduled !== null) return;
      scheduled = window.setTimeout(flush, 120);
    };

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        m.addedNodes.forEach((n) => pending.add(n));
        if (m.type === "characterData" && m.target.nodeType === Node.TEXT_NODE) {
          pending.add(m.target);
        }
      });
      if (pending.size > 0) schedule();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    observerRef.current = observer;

    return () => observer.disconnect();
  }, [applyTo]);

  const value = useMemo(
    () => ({ lang, setLang, isTranslating }),
    [lang, setLang, isTranslating],
  );

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
};
