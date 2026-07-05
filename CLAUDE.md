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
- Font SEMPRE Nunito (su input/textarea/button va messo esplicito: fontFamily:"'Nunito',system-ui,sans-serif", perché non lo ereditano)
- Colori SOLO dalla palette qui sotto, mai verde né colori estranei
- Niente arrow functions nei componenti principali
- Niente array destructuring con useState, usare var s=useState(); var a=s[0]; var b=s[1];
- Tutti i componenti devono essere top-level, mai annidati
- Niente optional chaining (?.)
- Niente commenti JSX

## Stile grafico e colori (SEMPRE, ogni modifica presente e futura)
Ogni nuova UI deve usare SOLO questa palette, coerente col resto dell'app. Niente verde né altri colori estranei.
- Primario (testo forte, bottoni pieni, icone attive): #2F6586
- Secondario / bordi accento: #6BA6C9
- Tinta chiara (sfondi tenui, chip attivi, badge): #E2EEF5
- Bordo tenue accento: #CADCE8
- Sfondo pagina: #F2F6F8
- Testo principale: #2C3338 · Testo secondario/label: #8A949B
- Accento (rosso, solo stati "fuori"/eliminazioni/errori): #C2355A su sfondo #FBE7EC
- Avviso (giallo, solo warning/limiti superati): testo #8A5A12 su sfondo #F6ECD9
- Card: sfondo #fff, bordo 1px #E3EAEE, border-radius 14-18
- Font: 'Nunito', system-ui. Icone: Tabler (classe "ti ti-...")
- Classi utili già presenti: mf-card, mf-card acc (tinta blu), mf-card warn (giallo), cap (label maiuscola)

## Supabase
- URL: https://vukczlbuonvisuyobprq.supabase.co
- Tabelle: families, profiles, builder_scelte, peso_log, dispensa, ricette

## Deploy
- git add . && git commit -m "descrizione" && git push
- Vercel aggiorna automaticamente
