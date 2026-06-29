# Menu Famiglia

## Progetto
App per la gestione del menu settimanale familiare con database nutrizionale.

## Stack
- React + Vite
- Supabase per database e autenticazione
- Vercel per il deploy
- GitHub: https://github.com/marlenelomb-glitch/Men-famiglia-

## Famiglia
- Adulto: 1600 kcal/die
- Adulta: 1400 kcal/die
- Bambino 6-10 anni: 1400 kcal/die
- Bambino aproteico 3-6 anni: max 20g proteine/die
- Neonato 9-12 mesi: 800 kcal/die

## Regole importanti
- Niente arrow functions nei componenti principali
- Niente array destructuring con useState, usare var s=useState(); var a=s[0]; var b=s[1];
- Tutti i componenti devono essere top-level, mai annidati
- Niente optional chaining (?.)
- Niente commenti JSX

## Supabase
- URL: https://vukczlbuonvisuyobprq.supabase.co
- Tabelle: families, profiles, builder_scelte, peso_log, dispensa, ricette

## Deploy
- git add . && git commit -m "descrizione" && git push
- Vercel aggiorna automaticamente
