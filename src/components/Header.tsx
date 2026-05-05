import { Compass, Moon, Sun } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export const Header = () => {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("rc-theme");
    const prefersDark = stored
      ? stored === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (prefersDark) {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    }
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    const next = !root.classList.contains("dark");
    root.classList.toggle("dark", next);
    localStorage.setItem("rc-theme", next ? "dark" : "light");
    setIsDark(next);
  };

  return (
    <header className="fixed top-2.5 md:top-6 lg:top-6 left-0 right-0 z-40 flex justify-center px-4 md:px-4 lg:px-6">
      <div className="w-full  rounded-[2.5rem] bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white dark:border-slate-800 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.05)] transition-all duration-300">
        
        <div className="flex items-center justify-between px-2 py-3 md:px-6 md:py-4">
          
          <div className="flex items-center gap-3 md:gap-4 lg:gap-6 transition-all duration-300">
  
  {/* Conteneur de l'icône adaptable */}
  <div className="relative">
    <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-primary to-blue-500 blur-md opacity-60" />
    <div className="relative flex 
      h-10 w-10           /* Mobile */
      md:h-12 md:w-12     /* Tablette */
      lg:h-14 lg:w-14     /* Desktop */
      items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-blue-500 shadow-glow transition-all"
    >
      <Compass 
        className="text-white 
          h-5 w-5           /* Mobile */
          md:h-6 md:w-6     /* Tablette */
          lg:h-8 lg:w-8     /* Desktop */
        " 
        strokeWidth={2.5} 
      />
    </div>
  </div>

  {/* Textes adaptables */}
  <div className="flex flex-col justify-center">
    <h1 className="font-bold leading-none tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-primary dark:from-primary dark:to-blue-500 transition-all
      text-lg             /* Mobile (~18px) */
      md:text-2xl         /* Tablette (~24px) */
      lg:text-3xl         /* Desktop (~30px) */
    ">
      Route Compass
    </h1>
    
    <p className="font-medium text-muted-foreground leading-tight transition-all
      text-[8px]         /* Mobile */
      md:text-xs           /* Tablette */
      lg:text-sm          /* Desktop */
      mt-0.5 md:mt-1
    ">
      Comparateur d'itinéraires Premium
    </p>
  </div>
</div>

          {/* 🎯 Actions : Panneau de contrôle RESPONSIVE */}
          <div className="flex items-center 
            gap-0.5 p-0.5          /* Mobile */
            md:gap-3 md:p-2         /* Tablette */
            lg:gap-4 lg:p-2.5       /* Desktop */
            rounded-full bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 shadow-sm backdrop-blur-md transition-all">
            
            {/* Note: Assure-toi que LanguageSwitcher accepte une prop pour sa taille si nécessaire */}
            <LanguageSwitcher />

            {/* Séparateur vertical dynamique */}
            <div className="w-[1px] bg-slate-200 dark:bg-slate-700 mx-1 
              h-3          /* Mobile */
              md:h-6        /* Tablette */
              lg:h-8        /* Desktop */
            " />

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="rounded-full transition-all ml-2
                h-7 w-7               /* Mobile */
                md:h-10 md:w-10       /* Tablette */
                lg:h-12 lg:w-12       /* Desktop */
                hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm"
              aria-label="Basculer le thème"
            >
              {mounted && isDark ? (
                <Sun className="h-2 w-2 md:h-5 md:w-5 lg:h-6 lg:w-6 ml-0 text-amber-500 transition-all" />
              ) : (
                <Moon className="h-2 w-2 md:h-5 md:w-5 lg:h-6 lg:w-6 ml-0 text-indigo-600 transition-all" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};