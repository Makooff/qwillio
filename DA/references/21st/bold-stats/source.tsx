// SOURCE 21st.dev — collé tel quel par l'utilisateur le 2026-08-04
// Composant : Bold Stats (@uilayout.contact) — demo id 18908
// URL : https://21st.dev/@uilayout.contact/components/stats-bold
// Remplace impact-section (@anish-1144), retiré du catalogue. Choix validé utilisateur.
// Ne pas modifier ce fichier : c'est la référence brute. L'adaptation vit dans frontend/src.

import React from "react";

export const BoldStats = () => {
  return (
    <section className="bg-background flex flex-col justify-center">
      <div className="flex flex-col gap-20 py-16 max-w-7xl mx-auto px-5 w-full">
        <div className="md:flex justify-between items-center border-b border-border pb-5 gap-8">
          <div className="flex flex-col md:flex-row items-baseline gap-4">
            <span className="md:text-8xl text-8xl lg:text-9xl font-medium tracking-tighter text-foreground shrink-0">
              10B+
            </span>
            <div className="max-w-xs">
              <h3 className="text-xl font-semibold tracking-tight">
                API Calls Monthly
              </h3>
              <p className="text-sm text-muted-foreground text-pretty">
                Serving the world's most demanding applications with zero
                latency.
              </p>
            </div>
          </div>
          <img
            src="https://images.unsplash.com/photo-1604076984203-587c92ab2e58?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
            alt="supportive img"
            className="sm:w-96 w-full h-52 object-cover rounded-lg shrink-0 mt-6 md:mt-0"
          />
        </div>

        <div className="flex justify-between items-center gap-5">
          <div>
            <p className="md:text-5xl text-4xl font-medium tracking-tighter text-foreground mb-2 ">
              0.1ms
            </p>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              P99 Latency
            </p>
          </div>
          <div>
            <p className="md:text-5xl text-4xl font-medium tracking-tighter text-foreground mb-2 ">
              142
            </p>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Global Regions
            </p>
          </div>
          <div>
            <p className="md:text-5xl text-4xl font-medium tracking-tighter text-foreground mb-2 ">
              24/7
            </p>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Human Support
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BoldStats;
