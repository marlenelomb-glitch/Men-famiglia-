// Database ricette Menu Famiglia
// Ogni ricetta: porzioni per adulta, adulto, bimbo, apro (aproteico), neo (neonato/svezzamento).
// I valori nutrizionali sono stime indicative, non a uso medico.

function r(id, titolo, categoria, emoji, tempo, difficolta, stagione, ingredienti, porzioni, procedimento, note, tag) {
  return {id:id, titolo:titolo, categoria:categoria, emoji:emoji, tempo:tempo, difficolta:difficolta,
    stagione:stagione, ingredienti:ingredienti, porzioni:porzioni, procedimento:procedimento, note:note, tag:tag};
}
function p(adulta, adulto, bimbo, apro, neo) {
  return {adulta:adulta, adulto:adulto, bimbo:bimbo, apro:apro, neo:neo};
}
function porz(piatto, kcal, prot) { return {piatto:piatto, kcal:kcal, prot:prot}; }

export const DB_RICETTE = [

  // ── PRIMI ────────────────────────────────────────────────
  r("r101","Pasta al pomodoro","Primo","🍝","20 min","Facile",["tutto l anno"],
    [{nome:"Pasta",qty:"320g"},{nome:"Passata di pomodoro",qty:"500g"},{nome:"Basilico",qty:"q.b."},{nome:"Aglio",qty:"1 spicchio"},{nome:"Olio EVO",qty:"3 cucchiai"}],
    p(porz("70g pasta + sugo",320,10),porz("90g pasta + sugo",410,13),porz("70g pasta + sugo",330,10),porz("80g pasta aproteica + sugo senza sale",400,2),porz("40g pastina + sugo passato",130,3)),
    "Soffriggi l'aglio nell'olio, aggiungi la passata e cuoci 15 min. Profuma col basilico e condisci la pasta al dente.",
    "Per aproteico usa pasta aproteica. Per neonato frulla il sugo e non salare.",["veloce","vegetariano","classico"]),

  r("r102","Pasta al pesto","Primo","🌿","15 min","Facile",["primavera","estate"],
    [{nome:"Pasta",qty:"320g"},{nome:"Pesto alla genovese",qty:"6 cucchiai"},{nome:"Patate",qty:"1"},{nome:"Fagiolini",qty:"100g"}],
    p(porz("70g pasta + pesto",380,12),porz("90g pasta + pesto",470,15),porz("70g pasta + poco pesto",370,11),porz("80g pasta apr. + pesto senza formaggio",410,3),porz("40g pastina + poco pesto",150,3)),
    "Lessa la pasta con patate e fagiolini a pezzetti, scola e manteca col pesto e un po' di acqua di cottura.",
    "Per aproteico prepara un pesto senza parmigiano. Per neonato ometti il pesto e condisci con olio.",["estivo","vegetariano","classico"]),

  r("r103","Spaghetti aglio, olio e peperoncino","Primo","🌶️","15 min","Facile",["tutto l anno"],
    [{nome:"Spaghetti",qty:"320g"},{nome:"Aglio",qty:"2 spicchi"},{nome:"Peperoncino",qty:"1"},{nome:"Olio EVO",qty:"5 cucchiai"},{nome:"Prezzemolo",qty:"q.b."}],
    p(porz("70g spaghetti conditi",360,10),porz("90g spaghetti conditi",450,13),porz("70g spaghetti senza peperoncino",350,10),porz("80g pasta apr. aglio e olio",420,2),porz("Non adatto - preferire pastina in bianco",120,3)),
    "Scalda l'olio con aglio e peperoncino, salta gli spaghetti al dente e spolvera di prezzemolo.",
    "Per i bambini togli il peperoncino.",["veloce","vegetariano","economico"]),

  r("r104","Risotto ai funghi","Primo","🍄","35 min","Media",["autunno","inverno"],
    [{nome:"Riso Carnaroli",qty:"320g"},{nome:"Funghi",qty:"300g"},{nome:"Cipolla",qty:"1"},{nome:"Brodo vegetale",qty:"1L"},{nome:"Parmigiano",qty:"40g"},{nome:"Burro",qty:"20g"}],
    p(porz("70g riso + funghi",360,11),porz("90g riso + funghi",450,14),porz("70g riso + funghi",350,10),porz("80g riso apr. + funghi, senza formaggio",400,3),porz("40g riso + funghi tritati",150,3)),
    "Soffriggi la cipolla, tosta il riso, aggiungi i funghi e sfuma. Porta a cottura col brodo e manteca con burro e parmigiano.",
    "Per aproteico non mantecare col parmigiano. Per neonato trita bene i funghi.",["autunnale","vegetariano","cremoso"]),

  r("r105","Risotto alla zucca","Primo","🎃","35 min","Media",["autunno","inverno"],
    [{nome:"Riso",qty:"320g"},{nome:"Zucca",qty:"400g"},{nome:"Cipolla",qty:"1"},{nome:"Brodo vegetale",qty:"1L"},{nome:"Parmigiano",qty:"40g"}],
    p(porz("70g riso + zucca",350,10),porz("90g riso + zucca",440,13),porz("70g riso + zucca",345,10),porz("80g riso apr. + zucca",395,3),porz("40g riso + zucca schiacciata",145,3)),
    "Rosola cipolla e zucca a cubetti, aggiungi il riso e cuoci col brodo. Manteca con parmigiano.",
    "Per aproteico ometti il parmigiano. Per neonato ottima la zucca schiacciata.",["autunnale","vegetariano","dolce"]),

  r("r106","Lasagne al ragù","Primo","🍝","90 min","Media",["autunno","inverno"],
    [{nome:"Sfoglie lasagne",qty:"250g"},{nome:"Ragù di carne",qty:"600g"},{nome:"Besciamella",qty:"500g"},{nome:"Parmigiano",qty:"80g"}],
    p(porz("1 porzione media",450,20),porz("1 porzione abbondante",560,25),porz("1 porzione piccola",380,16),porz("Solo strato di pasta apr. con verdure",350,3),porz("Non adatto - preferire pastina",150,4)),
    "Alterna sfoglie, ragù, besciamella e parmigiano. Inforna a 180 gradi per 35 min.",
    "Per aproteico usa sfoglie aproteiche e sostituisci il ragù con verdure. Per neonato non adatto per sale e condimenti.",["classico","famiglia","forno"]),

  r("r107","Pasta e fagioli","Primo","🫘","40 min","Facile",["autunno","inverno"],
    [{nome:"Fagioli borlotti",qty:"400g"},{nome:"Pasta corta",qty:"200g"},{nome:"Sedano",qty:"1 gambo"},{nome:"Carota",qty:"1"},{nome:"Passata",qty:"200g"}],
    p(porz("1 piatto medio",370,15),porz("1 piatto abbondante",460,19),porz("1 piatto piccolo",330,13),porz("Solo brodo e pasta apr., pochi fagioli",320,4),porz("Passato di legumi e pastina",150,5)),
    "Prepara un soffritto, aggiungi fagioli e passata, poi la pasta e cuoci nel brodo.",
    "Per aproteico limita i fagioli e usa pasta aproteica. Per neonato passa i legumi e togli la buccia.",["invernale","vegetariano","tradizionale"]),

  r("r108","Minestrone di verdure","Primo","🥣","45 min","Facile",["tutto l anno"],
    [{nome:"Verdure miste",qty:"600g"},{nome:"Patate",qty:"2"},{nome:"Fagioli",qty:"150g"},{nome:"Pasta o riso",qty:"120g"}],
    p(porz("1 ciotola",250,9),porz("1 ciotola abbondante",320,12),porz("1 ciotola piccola",230,8),porz("Minestrone senza legumi + pasta apr.",240,3),porz("Minestrone passato senza sale",120,3)),
    "Cuoci tutte le verdure a pezzi in acqua o brodo, aggiungi pasta o riso a fine cottura.",
    "Per aproteico riduci i legumi. Per neonato frulla e non salare.",["sano","vegetariano","riciclo"]),

  r("r109","Pasta al tonno","Primo","🐟","20 min","Facile",["tutto l anno"],
    [{nome:"Pasta",qty:"320g"},{nome:"Tonno in scatola",qty:"200g"},{nome:"Passata",qty:"400g"},{nome:"Aglio",qty:"1 spicchio"},{nome:"Olive",qty:"50g"}],
    p(porz("70g pasta + sugo tonno",370,16),porz("90g pasta + sugo tonno",460,20),porz("70g pasta + sugo tonno",360,15),porz("80g pasta apr. con solo sugo",400,3),porz("40g pastina + sugo passato senza tonno",130,3)),
    "Prepara un sugo veloce con aglio, passata e tonno sgocciolato, condisci la pasta.",
    "Per aproteico usa solo il sugo di pomodoro su pasta aproteica. Per neonato evita tonno e olive.",["veloce","pesce","economico"]),

  r("r110","Gnocchi al pomodoro","Primo","🥔","20 min","Facile",["tutto l anno"],
    [{nome:"Gnocchi di patate",qty:"500g"},{nome:"Passata",qty:"400g"},{nome:"Basilico",qty:"q.b."},{nome:"Parmigiano",qty:"30g"}],
    p(porz("Porzione media",340,9),porz("Porzione abbondante",420,11),porz("Porzione piccola",320,8),porz("Gnocchi apr. con sugo senza formaggio",380,3),porz("Pochi gnocchi schiacciati col sugo",140,3)),
    "Cuoci gli gnocchi in acqua bollente, scolali quando salgono e condisci col sugo.",
    "Per aproteico servono gnocchi aproteici. Per neonato schiaccia bene.",["veloce","vegetariano","bambini"]),

  r("r111","Pasta zucchine e speck","Primo","🥓","25 min","Facile",["primavera","estate"],
    [{nome:"Pasta",qty:"320g"},{nome:"Zucchine",qty:"3"},{nome:"Speck",qty:"100g"},{nome:"Panna o ricotta",qty:"100g"}],
    p(porz("70g pasta condita",390,14),porz("90g pasta condita",480,17),porz("70g pasta con zucchine, poco speck",370,12),porz("80g pasta apr. con sole zucchine",400,3),porz("40g pastina con zucchine schiacciate",150,3)),
    "Rosola le zucchine con lo speck, aggiungi panna o ricotta e condisci la pasta.",
    "Per aproteico ometti speck e formaggio, solo zucchine. Per neonato niente speck.",["veloce","classico"]),

  r("r112","Pasta al forno","Primo","🧀","50 min","Media",["autunno","inverno"],
    [{nome:"Pasta corta",qty:"400g"},{nome:"Passata",qty:"500g"},{nome:"Mozzarella",qty:"200g"},{nome:"Parmigiano",qty:"60g"}],
    p(porz("Porzione media",430,18),porz("Porzione abbondante",530,22),porz("Porzione piccola",380,15),porz("Pasta apr. con sugo, senza formaggio",400,3),porz("Non adatto - preferire pastina in bianco",150,4)),
    "Condisci la pasta col sugo, aggiungi mozzarella e parmigiano e inforna a 200 gradi per 20 min.",
    "Per aproteico usa pasta aproteica e niente formaggio. Per neonato non adatto.",["classico","famiglia","forno"]),

  r("r113","Orzotto alle verdure","Primo","🌾","40 min","Facile",["tutto l anno"],
    [{nome:"Orzo perlato",qty:"280g"},{nome:"Zucchine",qty:"2"},{nome:"Carote",qty:"2"},{nome:"Brodo vegetale",qty:"1L"}],
    p(porz("Porzione media",330,10),porz("Porzione abbondante",410,13),porz("Porzione piccola",300,9),porz("Non adatto (orzo ricco di proteine)",0,0),porz("Orzotto ben cotto e schiacciato",140,4)),
    "Tosta l'orzo, aggiungi le verdure e cuoci col brodo mescolando.",
    "L'orzo non e adatto all'aproteico. Per neonato cuoci a lungo e schiaccia.",["sano","vegetariano","cereali"]),

  r("r114","Penne all'arrabbiata","Primo","🍅","20 min","Facile",["tutto l anno"],
    [{nome:"Penne",qty:"320g"},{nome:"Passata",qty:"500g"},{nome:"Aglio",qty:"2 spicchi"},{nome:"Peperoncino",qty:"1"},{nome:"Prezzemolo",qty:"q.b."}],
    p(porz("70g pasta + sugo piccante",330,10),porz("90g pasta + sugo piccante",420,13),porz("70g pasta + sugo senza peperoncino",330,10),porz("80g pasta apr. + sugo senza sale",400,2),porz("40g pastina + sugo passato senza piccante",130,3)),
    "Prepara un sugo con aglio, peperoncino e passata, condisci le penne.",
    "Per i bambini togli il peperoncino. Per neonato frulla il sugo.",["veloce","vegetariano","piccante"]),

  // ── SECONDI DI CARNE ─────────────────────────────────────
  r("r115","Pollo al forno con patate","Secondo","🍗","55 min","Facile",["tutto l anno"],
    [{nome:"Pollo a pezzi",qty:"800g"},{nome:"Patate",qty:"600g"},{nome:"Rosmarino",qty:"q.b."},{nome:"Olio EVO",qty:"3 cucchiai"}],
    p(porz("1 coscia + patate",380,30),porz("1 coscia grande + patate",470,36),porz("1/2 coscia + patate",300,20),porz("Solo patate al forno",240,3),porz("Patata schiacciata senza sale",90,2)),
    "Condisci pollo e patate con olio e rosmarino, inforna a 200 gradi per 45 min.",
    "Per aproteico servi solo le patate. Per neonato solo patata schiacciata senza sale.",["classico","famiglia","forno"]),

  r("r116","Scaloppine al limone","Secondo","🍋","20 min","Facile",["tutto l anno"],
    [{nome:"Fettine di vitello",qty:"600g"},{nome:"Limone",qty:"1"},{nome:"Farina",qty:"q.b."},{nome:"Burro",qty:"30g"}],
    p(porz("2 scaloppine",250,28),porz("3 scaloppine",330,36),porz("1 scaloppina",150,16),porz("Non adatto (carne)",0,0),porz("Non adatto",0,0)),
    "Infarina le fettine, cuocile nel burro e sfuma col succo di limone.",
    "Piatto proteico non adatto ad aproteico o neonato: prevedi un contorno per loro.",["veloce","classico"]),

  r("r117","Polpette al sugo","Secondo","🍖","45 min","Facile",["tutto l anno"],
    [{nome:"Carne macinata",qty:"500g"},{nome:"Pane",qty:"50g"},{nome:"Uovo",qty:"1"},{nome:"Passata",qty:"500g"}],
    p(porz("4 polpette + sugo",320,26),porz("5 polpette + sugo",400,32),porz("2-3 polpette + sugo",220,16),porz("Solo il sugo di pomodoro",90,2),porz("Poco sugo passato senza sale",70,2)),
    "Impasta carne, pane ammollato e uovo, forma le polpette e cuocile nel sugo 30 min.",
    "Per aproteico servi solo il sugo. Per neonato solo sugo passato senza sale.",["classico","famiglia","bambini"]),

  r("r118","Spezzatino con piselli","Secondo","🍲","70 min","Media",["autunno","inverno"],
    [{nome:"Manzo a cubetti",qty:"600g"},{nome:"Piselli",qty:"300g"},{nome:"Passata",qty:"300g"},{nome:"Cipolla",qty:"1"},{nome:"Patate",qty:"2"}],
    p(porz("Porzione media",350,28),porz("Porzione abbondante",440,35),porz("Porzione piccola",240,18),porz("Solo patate e poco sughetto",180,4),porz("Patata e piselli schiacciati",100,4)),
    "Rosola la carne, aggiungi cipolla, passata e patate, cuoci a fuoco lento, unisci i piselli.",
    "Per aproteico servi solo le patate. Per neonato schiaccia patata e piselli.",["invernale","classico"]),

  r("r119","Cotolette al forno","Secondo","🍗","30 min","Facile",["tutto l anno"],
    [{nome:"Fettine di pollo",qty:"600g"},{nome:"Pangrattato",qty:"150g"},{nome:"Uovo",qty:"1"},{nome:"Olio EVO",qty:"q.b."}],
    p(porz("1 cotoletta",300,28),porz("1 cotoletta grande",380,34),porz("1/2 cotoletta",180,16),porz("Non adatto (carne e uovo)",0,0),porz("Non adatto",0,0)),
    "Passa le fettine in uovo e pangrattato, disponile in teglia con un filo d'olio e inforna a 200 gradi per 20 min.",
    "Piatto proteico non adatto ad aproteico o neonato: prevedi un contorno.",["bambini","forno","classico"]),

  r("r120","Petto di pollo alla piastra","Secondo","🍗","15 min","Facile",["tutto l anno"],
    [{nome:"Petto di pollo",qty:"600g"},{nome:"Limone",qty:"1"},{nome:"Rosmarino",qty:"q.b."},{nome:"Olio EVO",qty:"1 cucchiaio"}],
    p(porz("1 fetta",180,32),porz("1 fetta grande",230,40),porz("1/2 fetta",100,17),porz("Non adatto (carne)",0,0),porz("Non adatto",0,0)),
    "Marina il pollo con limone e rosmarino e cuocilo sulla piastra 4 min per lato.",
    "Piatto proteico: per aproteico e neonato prevedi un piatto vegetale.",["leggero","proteico","veloce"]),

  r("r121","Arrosto di vitello","Secondo","🥩","80 min","Media",["autunno","inverno"],
    [{nome:"Girello di vitello",qty:"800g"},{nome:"Carote",qty:"2"},{nome:"Sedano",qty:"1"},{nome:"Vino bianco",qty:"1 bicchiere"}],
    p(porz("2 fette + sugo",270,30),porz("3 fette + sugo",350,38),porz("1 fetta + sugo",150,16),porz("Solo verdure di cottura",90,2),porz("Verdura schiacciata",60,2)),
    "Rosola la carne, sfuma col vino, aggiungi le verdure e cuoci coperto 70 min.",
    "Per aproteico servi solo le verdure di cottura. Per neonato verdura schiacciata.",["domenica","classico","forno"]),

  r("r122","Tacchino con verdure","Secondo","🦃","30 min","Facile",["tutto l anno"],
    [{nome:"Fesa di tacchino",qty:"600g"},{nome:"Zucchine",qty:"2"},{nome:"Peperoni",qty:"1"},{nome:"Olio EVO",qty:"2 cucchiai"}],
    p(porz("Porzione media + verdure",240,30),porz("Porzione abbondante",310,37),porz("Porzione piccola",140,16),porz("Solo verdure saltate",90,3),porz("Verdure schiacciate",60,2)),
    "Salta il tacchino a straccetti con le verdure a listarelle.",
    "Per aproteico e neonato servi solo le verdure.",["leggero","veloce","proteico"]),

  r("r123","Hamburger fatto in casa","Secondo","🍔","20 min","Facile",["tutto l anno"],
    [{nome:"Carne macinata",qty:"500g"},{nome:"Pane per hamburger",qty:"4"},{nome:"Insalata",qty:"q.b."},{nome:"Pomodoro",qty:"1"}],
    p(porz("1 hamburger + panino",400,26),porz("1 hamburger grande + panino",500,32),porz("1/2 hamburger + panino",270,16),porz("Solo panino apr. con verdure",250,3),porz("Non adatto",0,0)),
    "Forma gli hamburger, cuocili in padella e componi il panino con insalata e pomodoro.",
    "Per aproteico usa pane aproteico e riempi con verdure. Per neonato non adatto.",["bambini","veloce","americano"]),

  // ── SECONDI DI PESCE ─────────────────────────────────────
  r("r124","Merluzzo al forno con patate","Secondo","🐟","40 min","Facile",["tutto l anno"],
    [{nome:"Filetti di merluzzo",qty:"600g"},{nome:"Patate",qty:"500g"},{nome:"Pomodorini",qty:"200g"},{nome:"Olio EVO",qty:"2 cucchiai"}],
    p(porz("1 filetto + patate",280,28),porz("1 filetto grande + patate",350,34),porz("1/2 filetto + patate",180,16),porz("Solo patate al forno",200,3),porz("Patata e poco pesce ben spinato",90,5)),
    "Disponi patate a fette, adagia il merluzzo e i pomodorini, condisci e inforna a 200 gradi per 30 min.",
    "Per aproteico servi solo le patate. Per neonato pochissimo pesce ben spinato.",["pesce","sano","forno"]),

  r("r125","Salmone al vapore","Secondo","🐟","20 min","Facile",["tutto l anno"],
    [{nome:"Filetti di salmone",qty:"600g"},{nome:"Limone",qty:"1"},{nome:"Zucchine",qty:"2"},{nome:"Olio EVO",qty:"1 cucchiaio"}],
    p(porz("1 filetto + zucchine",300,30),porz("1 filetto grande",380,36),porz("1/2 filetto",180,17),porz("Solo zucchine al vapore",70,2),porz("Zucchina schiacciata",40,1)),
    "Cuoci il salmone al vapore con le zucchine, condisci con limone e olio.",
    "Per aproteico servi solo le verdure. Per neonato zucchina schiacciata.",["pesce","leggero","omega3"]),

  r("r126","Orata al cartoccio","Secondo","🐟","30 min","Facile",["primavera","estate"],
    [{nome:"Orata",qty:"2"},{nome:"Pomodorini",qty:"200g"},{nome:"Prezzemolo",qty:"q.b."},{nome:"Limone",qty:"1"}],
    p(porz("1/2 orata + pomodorini",240,30),porz("1 orata + pomodorini",320,38),porz("1/4 orata",140,15),porz("Solo pomodorini e pane apr.",150,3),porz("Non adatto - lische",0,0)),
    "Chiudi l'orata nel cartoccio con pomodorini, prezzemolo e limone, inforna a 200 gradi per 20 min.",
    "Per aproteico prevedi un contorno vegetale. Per neonato non adatto per le lische.",["pesce","estivo","leggero"]),

  r("r127","Bastoncini di pesce fatti in casa","Secondo","🐟","30 min","Facile",["tutto l anno"],
    [{nome:"Filetti di merluzzo",qty:"500g"},{nome:"Pangrattato",qty:"120g"},{nome:"Uovo",qty:"1"}],
    p(porz("4 bastoncini",240,24),porz("5 bastoncini",300,30),porz("2-3 bastoncini",150,14),porz("Non adatto (pesce e uovo)",0,0),porz("Non adatto",0,0)),
    "Taglia il pesce a bastoncini, passalo in uovo e pangrattato e cuoci in forno a 200 gradi per 15 min.",
    "Piatto proteico: per aproteico e neonato prevedi un'alternativa vegetale.",["bambini","pesce","forno"]),

  r("r128","Frittata di zucchine","Secondo","🍳","20 min","Facile",["primavera","estate"],
    [{nome:"Uova",qty:"6"},{nome:"Zucchine",qty:"2"},{nome:"Parmigiano",qty:"30g"},{nome:"Olio EVO",qty:"1 cucchiaio"}],
    p(porz("1 fetta",200,16),porz("1 fetta grande",260,20),porz("1/2 fetta",120,9),porz("Non adatto (uova)",0,0),porz("Non adatto",0,0)),
    "Sbatti le uova con zucchine grattugiate e parmigiano, cuoci in padella da entrambi i lati.",
    "Le uova non sono adatte all'aproteico: prevedi un piatto vegetale.",["veloce","vegetariano","economico"]),

  r("r129","Seppie con piselli","Secondo","🦑","45 min","Media",["primavera"],
    [{nome:"Seppie",qty:"600g"},{nome:"Piselli",qty:"300g"},{nome:"Passata",qty:"200g"},{nome:"Cipolla",qty:"1"}],
    p(porz("Porzione media",240,26),porz("Porzione abbondante",310,33),porz("Porzione piccola",140,14),porz("Solo piselli e sughetto",90,4),porz("Piselli schiacciati",60,3)),
    "Rosola la cipolla, aggiungi le seppie a pezzi, la passata e i piselli, cuoci 35 min.",
    "Per aproteico servi solo i piselli. Per neonato piselli schiacciati.",["pesce","primaverile"]),

  // ── CONTORNI E VERDURE ───────────────────────────────────
  r("r130","Insalata mista","Contorno","🥗","10 min","Facile",["tutto l anno"],
    [{nome:"Insalata",qty:"1 cespo"},{nome:"Pomodori",qty:"2"},{nome:"Carote",qty:"1"},{nome:"Olio EVO",qty:"2 cucchiai"}],
    p(porz("1 ciotola",90,2),porz("1 ciotola abbondante",110,3),porz("1 ciotola piccola",70,2),porz("1 ciotola condita con olio",120,1),porz("Non adatto crudo",0,0)),
    "Lava e taglia le verdure, condisci con olio e poco sale.",
    "Per neonato preferire verdure cotte e schiacciate.",["fresco","leggero","veloce"]),

  r("r131","Patate al forno","Contorno","🥔","45 min","Facile",["tutto l anno"],
    [{nome:"Patate",qty:"700g"},{nome:"Rosmarino",qty:"q.b."},{nome:"Olio EVO",qty:"3 cucchiai"}],
    p(porz("Porzione media",220,4),porz("Porzione abbondante",280,5),porz("Porzione piccola",160,3),porz("Porzione media (ottime per apro)",240,3),porz("Patata schiacciata senza sale",90,2)),
    "Taglia le patate a spicchi, condisci con olio e rosmarino e inforna a 200 gradi per 35 min.",
    "Ottime per l'aproteico come fonte di energia. Per neonato schiaccia senza sale.",["contorno","forno","bambini"]),

  r("r132","Verdure grigliate","Contorno","🍆","25 min","Facile",["estate"],
    [{nome:"Zucchine",qty:"2"},{nome:"Melanzane",qty:"1"},{nome:"Peperoni",qty:"2"},{nome:"Olio EVO",qty:"2 cucchiai"}],
    p(porz("1 piatto",90,3),porz("1 piatto abbondante",120,4),porz("1 piatto piccolo",70,2),porz("1 piatto condito con olio",130,2),porz("Verdure ben cotte schiacciate",50,2)),
    "Taglia le verdure a fette, grigliale e condisci con olio.",
    "Per neonato cuoci molto bene e schiaccia.",["estivo","leggero","vegetariano"]),

  r("r133","Pure di patate","Contorno","🥔","30 min","Facile",["tutto l anno"],
    [{nome:"Patate",qty:"700g"},{nome:"Latte",qty:"150ml"},{nome:"Burro",qty:"30g"}],
    p(porz("Porzione media",220,5),porz("Porzione abbondante",280,6),porz("Porzione piccola",160,4),porz("Pure con olio al posto di latte e burro",230,2),porz("Pure senza sale",100,3)),
    "Lessa le patate, schiacciale e mantecale con latte e burro caldi.",
    "Per aproteico usa olio invece di latte e burro. Per neonato niente sale.",["contorno","bambini","comfort"]),

  r("r134","Broccoli ripassati","Contorno","🥦","25 min","Facile",["autunno","inverno"],
    [{nome:"Broccoli",qty:"600g"},{nome:"Aglio",qty:"1 spicchio"},{nome:"Olio EVO",qty:"2 cucchiai"}],
    p(porz("1 piatto",90,5),porz("1 piatto abbondante",110,6),porz("1 piatto piccolo",70,4),porz("1 piatto (limita la quantita)",110,4),porz("Broccoli schiacciati",50,3)),
    "Lessa i broccoli, poi ripassali in padella con aglio e olio.",
    "Per aproteico limita la porzione. Per neonato schiaccia bene.",["inverno","sano","vegetariano"]),

  r("r135","Caponata","Contorno","🍆","40 min","Media",["estate"],
    [{nome:"Melanzane",qty:"2"},{nome:"Sedano",qty:"2 gambi"},{nome:"Pomodoro",qty:"300g"},{nome:"Olive",qty:"60g"},{nome:"Aceto",qty:"2 cucchiai"}],
    p(porz("1 piatto",150,3),porz("1 piatto abbondante",190,4),porz("1 piatto piccolo",110,2),porz("1 piatto (ottimo, vegetale)",170,2),porz("Non adatto per aceto e olive",0,0)),
    "Friggi le melanzane, unisci sedano, pomodoro, olive e aceto e cuoci insieme.",
    "Ottima per l'aproteico. Per neonato non adatta per aceto e olive.",["estivo","siciliano","agrodolce"]),

  // ── PIATTI UNICI E LEGUMI ────────────────────────────────
  r("r136","Zuppa di lenticchie","Piatto unico","🍲","50 min","Facile",["autunno","inverno"],
    [{nome:"Lenticchie",qty:"300g"},{nome:"Carota",qty:"1"},{nome:"Sedano",qty:"1"},{nome:"Passata",qty:"200g"},{nome:"Pane",qty:"q.b."}],
    p(porz("1 ciotola + pane",320,18),porz("1 ciotola abbondante",400,22),porz("1 ciotola piccola",240,13),porz("Poche lenticchie + pane apr.",250,4),porz("Lenticchie passate senza buccia",120,5)),
    "Cuoci le lenticchie con il soffritto e la passata fino a farle diventare morbide.",
    "Per aproteico limita le lenticchie. Per neonato passa e togli le bucce.",["invernale","vegetariano","proteico"]),

  r("r137","Insalata di ceci","Piatto unico","🫘","15 min","Facile",["estate"],
    [{nome:"Ceci lessati",qty:"400g"},{nome:"Pomodorini",qty:"200g"},{nome:"Cipolla rossa",qty:"1/2"},{nome:"Olio EVO",qty:"2 cucchiai"}],
    p(porz("1 ciotola",280,15),porz("1 ciotola abbondante",350,19),porz("1 ciotola piccola",210,11),porz("Pochi ceci + pane apr. e verdure",230,4),porz("Ceci passati",110,5)),
    "Condisci i ceci con pomodorini, cipolla, olio e basilico.",
    "Per aproteico limita i ceci. Per neonato passa i ceci.",["estivo","vegetariano","veloce"]),

  r("r138","Farro con verdure","Piatto unico","🌾","40 min","Facile",["primavera","estate"],
    [{nome:"Farro",qty:"280g"},{nome:"Zucchine",qty:"2"},{nome:"Pomodorini",qty:"200g"},{nome:"Olio EVO",qty:"2 cucchiai"}],
    p(porz("1 ciotola",330,12),porz("1 ciotola abbondante",410,15),porz("1 ciotola piccola",250,9),porz("Non adatto (farro ricco di proteine)",0,0),porz("Farro ben cotto e schiacciato",130,4)),
    "Lessa il farro, condiscilo con le verdure saltate e olio.",
    "Il farro non e adatto all'aproteico. Per neonato cuoci a lungo.",["estivo","vegetariano","cereali"]),

  r("r139","Vellutata di zucca","Piatto unico","🎃","35 min","Facile",["autunno","inverno"],
    [{nome:"Zucca",qty:"600g"},{nome:"Patata",qty:"1"},{nome:"Cipolla",qty:"1"},{nome:"Crostini",qty:"q.b."}],
    p(porz("1 ciotola + crostini",210,5),porz("1 ciotola abbondante",270,6),porz("1 ciotola piccola",150,4),porz("Vellutata + crostini apr.",200,2),porz("Vellutata senza sale",90,2)),
    "Cuoci zucca, patata e cipolla, poi frulla fino a ottenere una crema.",
    "Ottima per l'aproteico con crostini aproteici. Per neonato senza sale.",["autunnale","comfort","vegetariano"]),

  r("r140","Cous cous di verdure","Piatto unico","🥘","30 min","Facile",["estate"],
    [{nome:"Cous cous",qty:"280g"},{nome:"Zucchine",qty:"1"},{nome:"Peperoni",qty:"1"},{nome:"Ceci",qty:"150g"}],
    p(porz("1 piatto",340,12),porz("1 piatto abbondante",420,15),porz("1 piatto piccolo",250,9),porz("Cous cous con sole verdure",300,4),porz("Cous cous ben idratato con verdure",120,3)),
    "Idrata il cous cous, saltalo con le verdure a cubetti e i ceci.",
    "Per aproteico ometti i ceci. Per neonato solo cous cous morbido e verdure.",["estivo","vegetariano","etnico"]),

  // ── COLAZIONI ────────────────────────────────────────────
  r("r141","Porridge di avena","Colazione","🥣","10 min","Facile",["tutto l anno"],
    [{nome:"Fiocchi d'avena",qty:"60g"},{nome:"Latte o bevanda vegetale",qty:"200ml"},{nome:"Frutta",qty:"1"},{nome:"Miele",qty:"1 cucchiaino"}],
    p(porz("1 ciotola",280,10),porz("1 ciotola abbondante",340,12),porz("1 ciotola piccola",220,8),porz("Porridge con acqua e frutta",230,4),porz("Crema d'avena senza miele",140,4)),
    "Cuoci l'avena nel latte finche non si addensa, guarnisci con frutta e miele.",
    "Per aproteico usa acqua e riduci l'avena. Per neonato niente miele.",["colazione","sano","energia"]),

  r("r142","Pancake","Colazione","🥞","20 min","Facile",["tutto l anno"],
    [{nome:"Farina",qty:"150g"},{nome:"Uovo",qty:"1"},{nome:"Latte",qty:"150ml"},{nome:"Lievito",qty:"1 cucchiaino"}],
    p(porz("3 pancake",300,10),porz("4 pancake",380,12),porz("2 pancake",200,7),porz("Non adatto (uova e latte)",0,0),porz("Non adatto",0,0)),
    "Mescola gli ingredienti e cuoci piccole frittelle in padella.",
    "Contengono uova: per aproteico prevedi un'alternativa (pane e marmellata aproteici).",["colazione","bambini","dolce"]),

  r("r143","Yogurt con frutta e granola","Colazione","🥛","5 min","Facile",["tutto l anno"],
    [{nome:"Yogurt",qty:"250g"},{nome:"Frutta fresca",qty:"1"},{nome:"Granola",qty:"40g"}],
    p(porz("1 coppa",220,10),porz("1 coppa abbondante",280,12),porz("1 coppa piccola",170,8),porz("Non adatto (yogurt proteico)",0,0),porz("Frutta schiacciata senza granola",60,1)),
    "Alterna yogurt, frutta a pezzi e granola in una coppa.",
    "Lo yogurt e proteico: per aproteico preferire frutta con pane aproteico.",["colazione","veloce","sano"]),

  r("r144","Pane, burro e marmellata","Colazione","🍞","5 min","Facile",["tutto l anno"],
    [{nome:"Pane",qty:"4 fette"},{nome:"Burro",qty:"20g"},{nome:"Marmellata",qty:"q.b."}],
    p(porz("2 fette",260,6),porz("3 fette",340,8),porz("1 fetta",130,3),porz("Pane apr. con marmellata",240,1),porz("Pane ammorbidito con poca marmellata",90,2)),
    "Spalma burro e marmellata sul pane.",
    "Per aproteico usa pane aproteico. Per neonato ammorbidisci il pane.",["colazione","veloce","classico"]),

  // ── DOLCI E MERENDE ──────────────────────────────────────
  r("r145","Torta di mele","Dolce","🍎","60 min","Media",["autunno","inverno"],
    [{nome:"Farina",qty:"250g"},{nome:"Mele",qty:"3"},{nome:"Uova",qty:"2"},{nome:"Zucchero",qty:"150g"},{nome:"Latte",qty:"100ml"}],
    p(porz("1 fetta",250,5),porz("1 fetta abbondante",320,6),porz("1 fetta piccola",180,4),porz("Non adatto (uova)",0,0),porz("Non adatto",0,0)),
    "Mescola gli ingredienti, aggiungi le mele a fette e inforna a 180 gradi per 45 min.",
    "Contiene uova: per aproteico prevedi frutta fresca come alternativa.",["dolce","famiglia","merenda"]),

  r("r146","Ciambellone allo yogurt","Dolce","🍰","55 min","Facile",["tutto l anno"],
    [{nome:"Farina",qty:"250g"},{nome:"Yogurt",qty:"125g"},{nome:"Uova",qty:"3"},{nome:"Zucchero",qty:"150g"},{nome:"Olio",qty:"80ml"}],
    p(porz("1 fetta",270,6),porz("1 fetta abbondante",340,7),porz("1 fetta piccola",190,4),porz("Non adatto (uova e yogurt)",0,0),porz("Non adatto",0,0)),
    "Sbatti uova e zucchero, aggiungi yogurt, olio e farina, inforna a 180 gradi per 40 min.",
    "Contiene uova: per aproteico non adatto, offri frutta.",["dolce","classico","merenda"]),

  r("r147","Biscotti all'avena","Merenda","🍪","30 min","Facile",["tutto l anno"],
    [{nome:"Fiocchi d'avena",qty:"150g"},{nome:"Banana",qty:"2"},{nome:"Gocce di cioccolato",qty:"40g"}],
    p(porz("3 biscotti",180,4),porz("4 biscotti",230,5),porz("2 biscotti",120,3),porz("Non adatto (avena)",0,0),porz("Banana schiacciata",70,1)),
    "Schiaccia le banane, mescola con avena e cioccolato e cuoci in forno a 180 gradi per 15 min.",
    "L'avena non e adatta all'aproteico. Per neonato solo banana schiacciata.",["merenda","sano","bambini"]),

  // ── SVEZZAMENTO E BIMBI ──────────────────────────────────
  r("r148","Pappa di verdure","Svezzamento","🥕","40 min","Facile",["tutto l anno"],
    [{nome:"Patata",qty:"1"},{nome:"Carota",qty:"1"},{nome:"Zucchina",qty:"1"},{nome:"Olio EVO",qty:"1 cucchiaino"}],
    p(porz("Non indicato",0,0),porz("Non indicato",0,0),porz("Piccola porzione con pastina",180,5),porz("Pappa con pastina apr.",170,3),porz("Pappa frullata senza sale",110,3)),
    "Lessa le verdure, frullale con un filo d'olio e aggiungi pastina o crema di riso.",
    "Ideale per neonato: senza sale. Per aproteico usa pastina aproteica.",["svezzamento","neonato","sano"]),

  r("r149","Crema di riso","Svezzamento","🍚","20 min","Facile",["tutto l anno"],
    [{nome:"Crema di riso",qty:"4 cucchiai"},{nome:"Brodo vegetale",qty:"200ml"},{nome:"Olio EVO",qty:"1 cucchiaino"}],
    p(porz("Non indicato",0,0),porz("Non indicato",0,0),porz("Ciotola piccola",150,3),porz("Crema di riso con verdure",150,2),porz("Crema liscia senza sale",100,2)),
    "Stempera la crema di riso nel brodo caldo mescolando fino ad addensare.",
    "Ottima per neonato e per aproteico: naturalmente povera di proteine.",["svezzamento","neonato","aproteico"]),

  r("r150","Passato di verdure con pastina","Svezzamento","🍲","40 min","Facile",["tutto l anno"],
    [{nome:"Verdure miste",qty:"400g"},{nome:"Patata",qty:"1"},{nome:"Pastina",qty:"60g"},{nome:"Olio EVO",qty:"1 cucchiaino"}],
    p(porz("Ciotola",180,6),porz("Ciotola abbondante",230,7),porz("Ciotola piccola",150,5),porz("Passato con pastina apr.",170,3),porz("Passato frullato senza sale",110,3)),
    "Cuoci le verdure, frullale e aggiungi la pastina, completa con un filo d'olio.",
    "Per neonato senza sale. Per aproteico usa pastina aproteica.",["svezzamento","bambini","sano"])

];
