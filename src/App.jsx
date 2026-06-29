
// ── SUPABASE CLIENT ──────────────────────────────────────────
var SUPABASE_URL = "https://vukczlbuonvisuyobprq.supabase.co";
var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1a2N6bGJ1b252aXN1eW9icHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNDUyNzUsImV4cCI6MjA5NzcyMTI3NX0.Gb5rsh_Nd6MsAE3HQVv2sqFOME9lziaYn4a-y6-uvNI";

function createSupabaseClient() {
  function headers() {
    var h = {
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + (sbSession ? sbSession.access_token : SUPABASE_KEY),
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    };
    return h;
  }

  function rest(table) {
    return SUPABASE_URL + "/rest/v1/" + table;
  }

  function auth_url(path) {
    return SUPABASE_URL + "/auth/v1" + path;
  }

  return {
    // AUTH
    signUp: function(email, password) {
      return fetch(auth_url("/signup"), {
        method:"POST", headers:{"apikey":SUPABASE_KEY,"Content-Type":"application/json"},
        body: JSON.stringify({email:email, password:password})
      }).then(function(r){return r.json();});
    },
    signIn: function(email, password) {
      return fetch(auth_url("/token?grant_type=password"), {
        method:"POST", headers:{"apikey":SUPABASE_KEY,"Content-Type":"application/json"},
        body: JSON.stringify({email:email, password:password})
      }).then(function(r){return r.json();});
    },
    signOut: function() {
      return fetch(auth_url("/logout"), {
        method:"POST", headers:headers()
      }).then(function(){
        sbSession = null;
        localStorage.removeItem("mf_session");
      });
    },
    getSession: function() {
      return fetch(auth_url("/user"), {
        headers:headers()
      }).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});
    },

    // DATABASE
    from: function(table) {
      return {
        select: function(cols) {
          var url = rest(table) + "?select=" + (cols||"*");
          var filters = [];
          var order_str = "";
          var obj = {
            eq: function(col, val) { filters.push(col+"=eq."+val); return obj; },
            order: function(col, opts) {
              order_str = "&order="+col+(opts&&opts.ascending===false?".desc":".asc");
              return obj;
            },
            then: function(resolve, reject) {
              var full = url + (filters.length?"&"+filters.join("&"):"") + order_str;
              return fetch(full, {headers:headers()})
                .then(function(r){return r.json();})
                .then(resolve, reject);
            }
          };
          return obj;
        },
        insert: function(data) {
          return fetch(rest(table), {
            method:"POST", headers:headers(),
            body: JSON.stringify(Array.isArray(data)?data:[data])
          }).then(function(r){return r.json();});
        },
        upsert: function(data, opts) {
          var h = Object.assign({}, headers());
          h["Prefer"] = "resolution=merge-duplicates,return=representation";
          return fetch(rest(table), {
            method:"POST", headers:h,
            body: JSON.stringify(Array.isArray(data)?data:[data])
          }).then(function(r){return r.json();});
        },
        update: function(data) {
          var filters = [];
          var obj = {
            eq: function(col, val) { filters.push(col+"=eq."+val); return obj; },
            then: function(resolve, reject) {
              var url = rest(table) + "?" + filters.join("&");
              return fetch(url, {
                method:"PATCH", headers:headers(),
                body: JSON.stringify(data)
              }).then(function(r){return r.json();}).then(resolve, reject);
            }
          };
          return obj;
        },
        delete: function() {
          var filters = [];
          var obj = {
            eq: function(col, val) { filters.push(col+"=eq."+val); return obj; },
            then: function(resolve, reject) {
              var url = rest(table) + "?" + filters.join("&");
              return fetch(url, {
                method:"DELETE", headers:headers()
              }).then(function(r){return r.ok?{}:r.json();}).then(resolve, reject);
            }
          };
          return obj;
        }
      };
    }
  };
}

var sbSession = null;
try {
  var saved = localStorage.getItem("mf_session");
  if(saved) sbSession = JSON.parse(saved);
} catch(e) {}

var supabase = createSupabaseClient();

import { useState, useMemo, useCallback, useEffect } from "react";

const DAYS = ["Lunedi","Martedi","Mercoledi","Giovedi","Venerdi","Sabato","Domenica"];
const MEALS = ["Colazione","Pranzo","Spuntino","Merenda","Cena","Extra"];

const COLORI = ["#2E5F8A","#1B3A5C","#6B9EC4","#C2355A","#C2355A","#C2355A","#1B3A5C"];

const PATOLOGIE_LIST = [
  {id:"nessuna",     label:"Nessuna",          kcal:2000, prot:80,  note:""},
  {id:"dimagrimento",label:"Dieta dimagrante",  kcal:1400, prot:80,  note:"Deficit calorico moderato"},
  {id:"ipoproteica", label:"Dieta ipoproteica", kcal:1500, prot:20,  note:"Max proteine prescritto dal nefrologo"},
  {id:"celiachia",   label:"Celiachia",         kcal:2000, prot:80,  note:"Eliminare glutine"},
  {id:"diabete",     label:"Diabete",           kcal:1800, prot:80,  note:"Controllare carboidrati"},
  {id:"ipertensione",label:"Ipertensione",      kcal:2000, prot:80,  note:"Ridurre sodio <1.5g/die"},
  {id:"vegetariano", label:"Vegetariano",       kcal:2000, prot:80,  note:"No carne e pesce"},
  {id:"vegano",      label:"Vegano",            kcal:2000, prot:80,  note:"No prodotti animali"},
  {id:"svezzamento", label:"Svezzamento",       kcal:800,  prot:14,  note:"No sale, no miele"},
  {id:"colite",      label:"Colite/IBS",        kcal:2000, prot:80,  note:"Low-FODMAP"},
];

const DB_PASTI = {
  c1:{nome:"Yogurt + frutta + cereali",emoji:"?",tipo:"Colazione",
    adulta:{kcal:220,prot:14,piatto:"Yogurt greco 150g + frutta + 30g avena"},
    adulto:{kcal:280,prot:18,piatto:"Yogurt greco 200g + frutta + 40g avena"},
    bimbo:{kcal:200,prot:7,piatto:"Yogurt intero 125g + banana + avena 25g"},
    apro:{kcal:250,prot:1,piatto:"Yogurt apr 150g + frutta + cereali apr"},
    neo:{kcal:90,prot:2,piatto:"Yogurt intero 60g + banana schiacciata"}},
  c2:{nome:"Pane + ricotta + frutta",emoji:"?",tipo:"Colazione",
    adulta:{kcal:230,prot:11,piatto:"2 fette pane int + 60g ricotta + fragole"},
    adulto:{kcal:310,prot:14,piatto:"3 fette pane + 80g ricotta + frutta"},
    bimbo:{kcal:210,prot:9,piatto:"2 fette pane + 50g ricotta + fragole"},
    apro:{kcal:220,prot:1,piatto:"2 fette pane apr + marmellata + olio"},
    neo:{kcal:85,prot:3,piatto:"Pane morbido 15g + ricotta 30g"}},
  p1:{nome:"Pasta al pomodoro",emoji:"?",tipo:"Pranzo",
    adulta:{kcal:330,prot:10,piatto:"70g pasta int + pomodoro fresco + basilico"},
    adulto:{kcal:410,prot:13,piatto:"90g pasta + pomodoro + olio EVO"},
    bimbo:{kcal:360,prot:11,piatto:"80g pasta + pomodoro + parmigiano"},
    apro:{kcal:390,prot:2,piatto:"80g pasta apr + pomodoro + 2c olio EVO"},
    neo:{kcal:120,prot:3,piatto:"40g pastina + pomodoro cotto passato"}},
  p2:{nome:"Riso con pollo e verdure",emoji:"?",tipo:"Pranzo",
    adulta:{kcal:360,prot:28,piatto:"70g riso + 90g pollo + verdure + olio"},
    adulto:{kcal:450,prot:35,piatto:"90g riso + 120g pollo + verdure"},
    bimbo:{kcal:350,prot:22,piatto:"75g riso + 70g pollo + verdure"},
    apro:{kcal:400,prot:2,piatto:"80g riso apr + verdure abbondanti + olio"},
    neo:{kcal:150,prot:8,piatto:"40g riso + 30g pollo tritato + verdure"}},
  p3:{nome:"Pasta con salmone e zucchine",emoji:"?",tipo:"Pranzo",
    adulta:{kcal:380,prot:26,piatto:"70g pasta + 80g salmone + zucchine"},
    adulto:{kcal:460,prot:32,piatto:"90g pasta + 100g salmone + zucchine"},
    bimbo:{kcal:370,prot:20,piatto:"80g pasta + 60g salmone + zucchine"},
    apro:{kcal:400,prot:2,piatto:"80g pasta apr + zucchine + olio"},
    neo:{kcal:155,prot:9,piatto:"40g pastina + salmone 30g + zucchine"}},
  p4:{nome:"Orzo con tacchino e pomodori",emoji:"?",tipo:"Pranzo",
    adulta:{kcal:360,prot:29,piatto:"70g orzo + 90g tacchino + pomodori"},
    adulto:{kcal:450,prot:36,piatto:"90g orzo + 110g tacchino + pomodori"},
    bimbo:{kcal:350,prot:22,piatto:"75g orzo + 70g tacchino + pomodori"},
    apro:{kcal:400,prot:2,piatto:"80g riso apr + pomodori + olio"},
    neo:{kcal:148,prot:8,piatto:"40g pastina + 30g tacchino + pomodoro"}},
  p5:{nome:"Pasta con ceci e pomodoro",emoji:"?",tipo:"Pranzo",
    adulta:{kcal:350,prot:16,piatto:"65g pasta + 80g ceci + pomodori"},
    adulto:{kcal:440,prot:20,piatto:"85g pasta + 100g ceci + pomodori"},
    bimbo:{kcal:365,prot:15,piatto:"75g pasta + 70g ceci + pomodoro"},
    apro:{kcal:395,prot:2,piatto:"80g pasta apr + pomodori + olio"},
    neo:{kcal:150,prot:6,piatto:"40g pastina + ceci passati 30g"}},
  ce1:{nome:"Merluzzo con patate e fagiolini",emoji:"?",tipo:"Cena",
    adulta:{kcal:285,prot:25,piatto:"120g merluzzo + 100g patate + fagiolini"},
    adulto:{kcal:365,prot:31,piatto:"150g merluzzo + 130g patate + fagiolini"},
    bimbo:{kcal:285,prot:19,piatto:"80g merluzzo + 100g patate + fagiolini"},
    apro:{kcal:380,prot:3,piatto:"Patate + fagiolini + pane apr + olio"},
    neo:{kcal:128,prot:9,piatto:"50g merluzzo + 40g patate schiacciate"}},
  ce2:{nome:"Pollo con riso e spinaci",emoji:"?",tipo:"Cena",
    adulta:{kcal:350,prot:30,piatto:"100g pollo + 60g riso + spinaci"},
    adulto:{kcal:445,prot:37,piatto:"130g pollo + 80g riso + spinaci"},
    bimbo:{kcal:338,prot:23,piatto:"80g pollo + 60g riso + spinaci"},
    apro:{kcal:350,prot:3,piatto:"60g riso apr + spinaci abbondanti + olio"},
    neo:{kcal:138,prot:9,piatto:"30g riso + 35g pollo tritato + spinaci"}},
  ce3:{nome:"Salmone con patate e broccoli",emoji:"?",tipo:"Cena",
    adulta:{kcal:338,prot:27,piatto:"120g salmone + 100g patate + broccoli"},
    adulto:{kcal:422,prot:33,piatto:"150g salmone + 120g patate + broccoli"},
    bimbo:{kcal:312,prot:20,piatto:"80g salmone + patate + broccoli"},
    apro:{kcal:388,prot:3,piatto:"Patate + broccoli + pane apr + olio"},
    neo:{kcal:153,prot:9,piatto:"50g salmone + 40g patate + broccoli"}},
  ce4:{nome:"Uova con patate e spinaci",emoji:"?",tipo:"Cena",
    adulta:{kcal:292,prot:17,piatto:"2 uova + 100g patate al forno + spinaci"},
    adulto:{kcal:388,prot:24,piatto:"3 uova + 130g patate + spinaci"},
    bimbo:{kcal:282,prot:16,piatto:"2 uova + patate + spinaci"},
    apro:{kcal:382,prot:3,piatto:"Patate + spinaci + pane apr + olio"},
    neo:{kcal:113,prot:5,piatto:"1 tuorlo + 40g patate + spinaci passati"}},
  s1:{nome:"Yogurt e frutta",emoji:"?",tipo:"Spuntino",
    adulta:{kcal:140,prot:10,piatto:"Yogurt greco 100g + pesca"},
    adulto:{kcal:180,prot:12,piatto:"Yogurt greco 150g + banana"},
    bimbo:{kcal:155,prot:6,piatto:"Yogurt intero 100g + frutta"},
    apro:{kcal:260,prot:1,piatto:"Yogurt apr + frutta + miele"},
    neo:{kcal:85,prot:2,piatto:"Yogurt intero 60g + frutta schiacciata"}},
  m1:{nome:"Frutta + noci",emoji:"?",tipo:"Merenda",
    adulta:{kcal:150,prot:3,piatto:"1 frutto + 15g noci"},
    adulto:{kcal:200,prot:4,piatto:"1 frutto + 20g noci"},
    bimbo:{kcal:165,prot:3,piatto:"1 frutto + 10g noci tritate"},
    apro:{kcal:265,prot:2,piatto:"Frutta + 25g noci + biscotto apr"},
    neo:{kcal:70,prot:1,piatto:"Frutta morbida 80g schiacciata"}},
  e1:{nome:"Brodo vegetale",emoji:"?",tipo:"Extra",
    adulta:{kcal:25,prot:1,piatto:"300ml brodo vegetale"},
    adulto:{kcal:35,prot:1,piatto:"400ml brodo vegetale"},
    bimbo:{kcal:60,prot:2,piatto:"200ml brodo + pastina 15g"},
    apro:{kcal:60,prot:0,piatto:"300ml brodo + olio EVO"},
    neo:{kcal:10,prot:0,piatto:"100ml brodo no sale"}},
};

function getColor(pid, profili) {
  return (profili[pid]||{}).colore || "#888";
}

function buildMenu(week, profili) {
  const keys = Object.keys(DB_PASTI);
  const result = {};
  DAYS.forEach((d,di) => {
    MEALS.forEach((m,mi) => {
      const filtered = keys.filter(k => DB_PASTI[k].tipo === m);
      if(filtered.length === 0) return;
      const idx = (di * MEALS.length + mi + week * 7) % filtered.length;
      result[d+"-"+m] = {pastoId: filtered[idx], confermato:false, note:""};
    });
  });
  return result;
}

function Bar({val, max, color}) {
  const pct = Math.min(100, Math.round((val/(max||1))*100));
  return (
    <div style={{background:"#f0f0f0",borderRadius:12,height:6,overflow:"hidden",marginTop:2}}>
      <div style={{width:pct+"%",height:"100%",background:color,borderRadius:12,transition:"width .3s"}}/>
    </div>
  );
}

function Btn({onClick,children,bg,color,border,small}) {
  return (
    <button onClick={onClick} style={{
      flex:1,padding:small?"6px 10px":"10px 14px",borderRadius:20,border:border||"none",
      background:bg||"#2E5F8A",color:color||"#fff",fontSize:small?10:12,
      fontWeight:700,cursor:"pointer"
    }}>{children}</button>
  );
}

// ── GESTIONE FAMIGLIA ─────────────────────────────────────────
function TabFamiglia({profili, setProfili}) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    nome:"", emoji:"", patologia:"nessuna",
    eta:30, peso:0, altezza:170, colore:"#6B9EC4",
    kcal_custom:"", prot_custom:"", note:""
  });

  const patInfo = PATOLOGIE_LIST.find(p => p.id === form.patologia) || PATOLOGIE_LIST[0];

  const apri = (pid) => {
    if(pid) {
      const p = profili[pid];
      setForm({nome:p.nome, emoji:p.emoji, patologia:p.patologia||"nessuna",
        eta:p.eta||30, peso:p.peso||0, altezza:p.altezza||170,
        colore:p.colore||"#6B9EC4", kcal_custom:p.kcal_custom||"",
        prot_custom:p.prot_custom||"", note:p.note||""});
      setEditId(pid);
    } else {
      const usedColors = Object.values(profili).map(p=>p.colore);
      const freeColor = COLORI.find(c=>!usedColors.includes(c)) || COLORI[0];
      setForm({nome:"",emoji:"",patologia:"nessuna",eta:30,peso:0,altezza:170,
        colore:freeColor,kcal_custom:"",prot_custom:"",note:""});
      setEditId(null);
    }
    setShowForm(true);
  };

  const salva = () => {
    if(!form.nome.trim()) return;
    const kcal = form.kcal_custom ? parseInt(form.kcal_custom) : patInfo.kcal;
    const prot = form.prot_custom ? parseFloat(form.prot_custom) : patInfo.prot;
    const id = editId || ("m_"+Date.now());
    const profilo = {id, nome:form.nome.trim(), emoji:form.emoji,
      patologia:form.patologia, kcal_target:kcal, prot_max:prot,
      colore:form.colore, eta:form.eta, peso:form.peso, altezza:form.altezza,
      kcal_custom:form.kcal_custom, prot_custom:form.prot_custom, note:form.note};
    setProfili(prev => ({...prev, [id]: profilo}));
    setShowForm(false);
  };

  const rimuovi = (pid) => {
    if(Object.keys(profili).length <= 1) return;
    setProfili(prev => {const n={...prev}; delete n[pid]; return n;});
  };

  const EMOJIS = ["?","?","?","?","?","?","?","?"];

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:14,fontWeight:800,color:"#2E5F8A"}}>La tua famiglia</div>
        <button onClick={()=>apri(null)} style={{background:"#2E5F8A",color:"#fff",border:"none",
          borderRadius:20,padding:"6px 14px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
          + Aggiungi
        </button>
      </div>

      {!showForm && Object.entries(profili).map(([pid,p]) => (
        <div key={pid} style={{background:"#fff",borderRadius:14,padding:"12px 14px",
          marginBottom:10,boxShadow:"0 1px 6px rgba(0,0,0,.07)",borderLeft:"4px solid "+p.colore}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:22}}>{p.nome.slice(0,1)}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:800}}>{p.nome}</div>
              <div style={{display:"flex",gap:5,marginTop:3,flexWrap:"wrap"}}>
                <span style={{fontSize:9,background:p.colore+"22",color:p.colore,
                  fontWeight:700,padding:"2px 8px",borderRadius:20}}>
                  {(PATOLOGIE_LIST.find(x=>x.id===p.patologia)||{}).label||"Nessuna"}
                </span>
                <span style={{fontSize:9,background:"#EBF3FA",color:"#2E5F8A",padding:"2px 8px",borderRadius:20}}>
                  {p.kcal_target} kcal
                </span>
                <span style={{fontSize:9,background:"#EBF3FA",color:"#2E5F8A",padding:"2px 8px",borderRadius:20}}>
                  max {p.prot_max}g prot
                </span>
              </div>
            </div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>apri(pid)} style={{background:"#EBF3FA",border:"none",
                borderRadius:20,padding:"4px 10px",fontSize:10,fontWeight:700,cursor:"pointer",color:"#2E5F8A"}}>
                Modifica
              </button>
              {Object.keys(profili).length > 1 && (
                <button onClick={()=>rimuovi(pid)} style={{background:"#FDE8E4",border:"none",
                  borderRadius:20,padding:"4px 10px",fontSize:10,cursor:"pointer",color:"#C0392B"}}>
                  Rimuovi
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {showForm && (
        <div style={{background:"#EBF3FA",borderRadius:14,padding:"14px",border:"1.5px solid #C8E6C9"}}>
          <div style={{fontSize:12,fontWeight:800,color:"#2E5F8A",marginBottom:12}}>
            {editId ? "Modifica membro" : "Nuovo membro"}
          </div>

          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <div>
              <div style={{fontSize:9,fontWeight:700,color:"#888",marginBottom:4}}>Emoji</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",maxWidth:160}}>
                {EMOJIS.map((e,i) => (
                  <button key={i} onClick={()=>setForm(f=>({...f,emoji:e}))}
                    style={{fontSize:18,background:form.emoji===e?"#2D6A4F22":"transparent",
                      border:form.emoji===e?"2px solid #2D6A4F":"2px solid transparent",
                      borderRadius:8,padding:"2px",cursor:"pointer"}}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:9,fontWeight:700,color:"#888",marginBottom:3}}>Nome</div>
              <input value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))}
                placeholder="Es. Mamma, Marco..."
                style={{width:"100%",padding:"8px",borderRadius:8,border:"1.5px solid #C8E6C9",
                  fontSize:12,boxSizing:"border-box"}}/>
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginBottom:10}}>
            {[{k:"eta",l:"Eta (anni)"},{k:"peso",l:"Peso (kg)"},{k:"altezza",l:"Altezza (cm)"}].map(f=>(
              <div key={f.k}>
                <div style={{fontSize:9,fontWeight:700,color:"#888",marginBottom:3}}>{f.l}</div>
                <input type="number" value={form[f.k]||""}
                  onChange={e=>setForm(p=>({...p,[f.k]:parseFloat(e.target.value)||0}))}
                  style={{width:"100%",padding:"6px 8px",borderRadius:8,border:"1.5px solid #C8E6C9",
                    fontSize:11,boxSizing:"border-box"}}/>
              </div>
            ))}
          </div>

          <div style={{marginBottom:10}}>
            <div style={{fontSize:9,fontWeight:700,color:"#888",marginBottom:4}}>Colore</div>
            <div style={{display:"flex",gap:5}}>
              {COLORI.map(c => (
                <button key={c} onClick={()=>setForm(f=>({...f,colore:c}))}
                  style={{width:24,height:24,borderRadius:"50%",background:c,cursor:"pointer",
                    border:form.colore===c?"3px solid #333":"3px solid transparent"}}/>
              ))}
            </div>
          </div>

          <div style={{marginBottom:10}}>
            <div style={{fontSize:10,fontWeight:700,color:"#333",marginBottom:6}}>Patologia / esigenza</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {PATOLOGIE_LIST.map(pat => (
                <button key={pat.id} onClick={()=>setForm(f=>({...f,patologia:pat.id,
                  kcal_custom:"",prot_custom:""}))}
                  style={{background:form.patologia===pat.id?"#2E5F8A":"#fff",
                    color:form.patologia===pat.id?"#fff":"#444",
                    border:"1.5px solid "+(form.patologia===pat.id?"#2E5F8A":"#ddd"),
                    borderRadius:20,padding:"3px 10px",fontSize:10,cursor:"pointer"}}>
                  {pat.label}
                </button>
              ))}
            </div>
            {form.patologia !== "nessuna" && (
              <div style={{background:"#EBF3FA",borderRadius:8,padding:"8px 10px",marginTop:6,fontSize:10}}>
                <b>{patInfo.note}</b>
                <div style={{marginTop:4,color:"#888"}}>
                  Default: {patInfo.kcal} kcal/die, max {patInfo.prot}g prot/die
                </div>
              </div>
            )}
          </div>

          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <div style={{flex:1}}>
              <div style={{fontSize:9,fontWeight:700,color:"#888",marginBottom:3}}>
                Kcal prescritte (lascia vuoto = auto)
              </div>
              <input type="number" placeholder={"Auto: "+patInfo.kcal}
                value={form.kcal_custom}
                onChange={e=>setForm(f=>({...f,kcal_custom:e.target.value}))}
                style={{width:"100%",padding:"6px",borderRadius:8,border:"1.5px solid #C8E6C9",
                  fontSize:12,fontWeight:700,boxSizing:"border-box"}}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:9,fontWeight:700,color:"#888",marginBottom:3}}>
                Prot max prescritte (g/die)
              </div>
              <input type="number" step="0.5" placeholder={"Auto: "+patInfo.prot}
                value={form.prot_custom}
                onChange={e=>setForm(f=>({...f,prot_custom:e.target.value}))}
                style={{width:"100%",padding:"6px",borderRadius:8,border:"1.5px solid #C8E6C9",
                  fontSize:12,fontWeight:700,boxSizing:"border-box"}}/>
            </div>
          </div>

          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setShowForm(false)} style={{flex:1,padding:"10px",borderRadius:12,
              border:"1.5px solid #ddd",background:"#fff",fontSize:12,cursor:"pointer",color:"#666"}}>
              Annulla
            </button>
            <button onClick={salva} disabled={!form.nome.trim()} style={{flex:2,padding:"10px",
              borderRadius:12,border:"none",
              background:form.nome.trim()?"#2E5F8A":"#ccc",
              color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>
              {editId ? "Aggiorna" : "Aggiungi"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── TAB MENU ──────────────────────────────────────────────────
// ── BADGE COMPLETEZZA PASTO ───────────────────────────────────
const CAT_CEREALI  = ["Colazione","Pranzo","Cena"];
const CAT_VALUTA   = ["Pranzo","Cena"];

function calcolaCompletezza(pasto, meal) {
  if(!CAT_VALUTA.includes(meal)) return null;
  if(!pasto) return null;
  const nome = (pasto.nome||"").toLowerCase();
  const haCarbo  = nome.includes("pasta")||nome.includes("riso")||nome.includes("orzo")||
                   nome.includes("pane")||nome.includes("patate")||nome.includes("polenta")||
                   nome.includes("cous")||nome.includes("farro");
  const haProt   = nome.includes("pollo")||nome.includes("manzo")||nome.includes("pesce")||
                   nome.includes("merluzzo")||nome.includes("salmone")||nome.includes("tonno")||
                   nome.includes("uova")||nome.includes("ceci")||nome.includes("lenticchie")||
                   nome.includes("tacchino")||nome.includes("orata")||nome.includes("branzino");
  const haVerdura = nome.includes("verdure")||nome.includes("spinaci")||nome.includes("zucchine")||
                    nome.includes("broccoli")||nome.includes("fagiolini")||nome.includes("carote")||
                    nome.includes("pomodori")||nome.includes("insalata")||nome.includes("patate");
  const mancanti = [];
  if(!haCarbo)   mancanti.push({l:"carboidrati", c:"#C2355A"});
  if(!haProt)    mancanti.push({l:"proteine",    c:"#C2355A"});
  if(!haVerdura) mancanti.push({l:"verdura",     c:"#6B9EC4"});
  return {completo: mancanti.length===0, mancanti};
}

function BadgeCompletezza({pasto, meal, profili}) {
  const [sug, setSug] = useState(null);
  const [loading, setLoading] = useState(false);
  const res = calcolaCompletezza(pasto, meal);
  if(!res) return null;
  if(res.completo) return (
    <span style={{fontSize:9,background:"#EBF3FA",color:"#2E5F8A",
      fontWeight:700,padding:"3px 8px",borderRadius:20}}>
      pasto completo
    </span>
  );

  const chiedi = () => {
    setLoading(true); setSug(null);
    const manca = res.mancanti.map(m=>m.l).join(" e ");
    // Suggerimenti locali in base a cosa manca
    const sugg = {
      adulti: "Aggiungi "+manca+" - es. "+(
        res.mancanti.map(m=>
          m.l==="carboidrati"?"pane integrale o patate":
          m.l==="proteine"?"uova, legumi o carne magra":
          "verdure miste o insalata"
        ).join(", ")
      ),
      bimbo: "Per il bambino: "+(
        res.mancanti.map(m=>
          m.l==="carboidrati"?"pane morbido o pasta":
          m.l==="proteine"?"formaggio o prosciutto cotto":
          "carote o zucchine cotte"
        ).join(", ")
      ),
      apro: "Aproteico: "+(
        res.mancanti.map(m=>
          m.l==="carboidrati"?"pasta aproteica o pane apr.":
          m.l==="proteine"?"NO - mantieni proteine basse":
          "verdure abbondanti + olio EVO"
        ).join(", ")
      ),
      neo: "Neonato: "+(
        res.mancanti.map(m=>
          m.l==="carboidrati"?"pastina o purea di patate":
          m.l==="proteine"?"solo se >8 mesi: pollo o merluzzo frullato":
          "purea di verdure mista"
        ).join(", ")
      ),
    };
    setTimeout(()=>{ setSug(sugg); setLoading(false); }, 200);
  };

  return (
    <div style={{background:"#EBF3FA",borderRadius:8,padding:"7px 9px",marginTop:6}}>
      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",
        marginBottom:sug?6:0}}>
        <span style={{fontSize:10,fontWeight:700,color:"#1B3A5C"}}>Manca:</span>
        {res.mancanti.map(m=>(
          <span key={m.l} style={{fontSize:9,background:m.c+"18",color:m.c,
            fontWeight:700,padding:"2px 8px",borderRadius:20,border:"1px solid "+m.c+"33"}}>
            {m.l}
          </span>
        ))}
        <button onClick={chiedi} disabled={loading}
          style={{marginLeft:"auto",background:loading?"#ccc":"linear-gradient(135deg,#C2355A,#E8637A)",
            color:"#fff",border:"none",borderRadius:20,padding:"3px 10px",
            fontSize:9,fontWeight:700,cursor:loading?"wait":"pointer",whiteSpace:"nowrap"}}>
          {loading?"...":"Cosa aggiungo?"}
        </button>
      </div>
      {sug&&(
        <div style={{borderTop:"1px solid #F2E2A0",paddingTop:6}}>
          {[{e:"Adulti",k:"adulti"},{e:"Bambini",k:"bimbo"},{e:"Aproteico",k:"apro"},{e:"Neonato",k:"neo"}].map(p=>
            sug[p.k]?(
              <div key={p.k} style={{display:"flex",gap:5,padding:"2px 0",fontSize:9,color:"#555"}}>
                <span>{p.e}</span><span style={{flex:1}}>{sug[p.k]}</span>
              </div>
            ):null
          )}
        </div>
      )}
    </div>
  );
}

// ── TAB CALORIE ───────────────────────────────────────────────
function TabCalorie({menu, profili, builderScelte}) {
  var GIORNI_C = ["Lunedi","Martedi","Mercoledi","Giovedi","Venerdi","Sabato","Domenica"];
  var PASTI_C  = ["Colazione","Spuntino","Pranzo","Merenda","Cena"];
  var allDB    = CARBOIDRATI.concat(PROTEINE).concat(VERDURE).concat(FRUTTA).concat(SALSE);
  var PORZ = {pasta:80,riso:80,cereali:70,tuberi:180,pane:60,colazione:50,
    "carne bianca":150,"carne rossa":150,pesce:150,uova:120,legumi:200,latticini:100,verdura:150,frutta:120};

  var s0=useState(0); var giornoSel=s0[0]; var setGiornoSel=s0[1];
  var oggi = new Date().getDay(); var todayIdx = oggi===0?6:oggi-1;

  // Profili famiglia hardcoded + da profili config
  var PROFILI_CAL = [
    {id:"adulto",   nome:"Adulto",   emoji:"?", kcal_target:1600, prot_max:60,  mult:1.0,   isApro:false},
    {id:"adulta",   nome:"Adulta",   emoji:"?", kcal_target:1400, prot_max:55,  mult:0.85,  isApro:false},
    {id:"bambino",  nome:"Bambino",  emoji:"?", kcal_target:1400, prot_max:40,  mult:0.65,  isApro:false},
    {id:"aproteico",nome:"Aproteico",emoji:"?", kcal_target:1200, prot_max:20,  mult:0.5,   isApro:true},
    {id:"neonato",  nome:"Neonato",  emoji:"?", kcal_target:800,  prot_max:15,  mult:0.25,  isApro:false},
  ];

  function calcGiorno(g, profilo) {
    return PASTI_C.reduce(function(acc, pasto) {
      var s = builderScelte[g+"-"+pasto];
      if(!s) return acc;
      var kcal=0, prot=0;
      ["carbo","proteina","verdura","verdura2","frutta","latticino"].forEach(function(k){
        var id=s[k]; if(!id) return;
        var it=allDB.find(function(x){return x.id===id;});
        if(!it||!it.kcal_p) return;
        var gr=PORZ[it.cat]||100;
        kcal+=Math.round(it.kcal_p*gr/100*profilo.mult);
        prot+=Math.round((it.prot_p||0)*gr/100*profilo.mult);
      });
      return {kcal:acc.kcal+kcal, prot:acc.prot+prot,
              pasti:acc.pasti.concat([{pasto:pasto,kcal:kcal,prot:prot}])};
    },{kcal:0,prot:0,pasti:[]});
  }

  var g = GIORNI_C[giornoSel];
  var hasDati = PASTI_C.some(function(p){var s=builderScelte[g+"-"+p];return s&&(s.carbo||s.proteina);});

  return (
    <div>
      <div style={{display:"flex",gap:4,marginBottom:12,overflowX:"auto"}}>
        {GIORNI_C.map(function(giorno,i){
          var isToday=i===todayIdx; var isSel=i===giornoSel;
          var hasD=PASTI_C.some(function(p){var s=builderScelte[giorno+"-"+p];return s&&(s.carbo||s.proteina);});
          return (
            <button key={giorno} onClick={function(){setGiornoSel(i);}}
              style={{minWidth:48,padding:"7px 4px",borderRadius:12,flexShrink:0,cursor:"pointer",
                border:"2px solid "+(isSel?"#2E5F8A":isToday?"#E07A5F":hasD?"#C2D9EC":"#eee"),
                background:isSel?"#2E5F8A":isToday?"#FDE8E4":"#fff",
                color:isSel?"#fff":isToday?"#C0392B":"#888",
                fontSize:11,fontWeight:isSel?800:400,textAlign:"center"}}>
              {giorno.slice(0,3)}
            </button>
          );
        })}
      </div>

      {!hasDati&&(
        <div style={{textAlign:"center",padding:"30px",background:"#F5F8FC",borderRadius:12}}>
          <div style={{fontSize:28,marginBottom:8}}>📊</div>
          <div style={{fontSize:13,fontWeight:700,color:"#888"}}>Nessun dato per {g}</div>
          <div style={{fontSize:11,color:"#aaa",marginTop:4}}>Inserisci i pasti dal tab Builder</div>
        </div>
      )}

      {hasDati&&PROFILI_CAL.map(function(profilo){
        var tot = calcGiorno(g, profilo);
        if(tot.kcal===0) return null;
        var overKcal = tot.kcal > profilo.kcal_target;
        var overProt = profilo.isApro && tot.prot > profilo.prot_max;
        var pctKcal  = Math.min(100, Math.round(tot.kcal/profilo.kcal_target*100));
        var pctProt  = Math.min(100, Math.round(tot.prot/profilo.prot_max*100));
        return (
          <div key={profilo.id} style={{background:"#fff",borderRadius:14,padding:"12px 14px",
            marginBottom:10,boxShadow:"0 1px 8px rgba(0,0,0,.07)",
            border:"1.5px solid "+(overProt?"#FDE8E4":"#eee")}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:20}}>{profilo.emoji}</span>
                <div>
                  <div style={{fontSize:12,fontWeight:800}}>{profilo.nome}</div>
                  <div style={{fontSize:9,color:"#aaa"}}>target {profilo.kcal_target}kcal / max {profilo.prot_max}g prot</div>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:18,fontWeight:800,color:overKcal?"#C0392B":"#2E5F8A"}}>{tot.kcal}</div>
                <div style={{fontSize:9,color:"#aaa"}}>kcal</div>
              </div>
            </div>
            <div style={{marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#888",marginBottom:3}}>
                <span>Calorie</span>
                <span style={{fontWeight:700,color:overKcal?"#C0392B":"#555"}}>
                  {tot.kcal}/{profilo.kcal_target} ({pctKcal}%)
                  {overKcal?" +"+( tot.kcal-profilo.kcal_target):" -"+(profilo.kcal_target-tot.kcal)}
                </span>
              </div>
              <div style={{background:"#f0f0f0",borderRadius:6,height:8,overflow:"hidden"}}>
                <div style={{width:pctKcal+"%",height:"100%",borderRadius:6,
                  background:overKcal?"#C0392B":"#2E5F8A",transition:"width .3s"}}/>
              </div>
            </div>
            <div style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#888",marginBottom:3}}>
                <span>Proteine</span>
                <span style={{fontWeight:700,color:overProt?"#C0392B":profilo.isApro?"#E65100":"#555"}}>
                  {tot.prot}g / {profilo.prot_max}g max
                  {overProt?" SUPERATO":""}
                </span>
              </div>
              <div style={{background:"#f0f0f0",borderRadius:6,height:8,overflow:"hidden"}}>
                <div style={{width:pctProt+"%",height:"100%",borderRadius:6,
                  background:overProt?"#C0392B":profilo.isApro?"#E65100":"#52B788"}}/>
              </div>
            </div>
            <div style={{borderTop:"1px solid #f5f5f5",paddingTop:8}}>
              {tot.pasti.filter(function(p){return p.kcal>0;}).map(function(p){
                return (
                  <div key={p.pasto} style={{display:"flex",justifyContent:"space-between",
                    padding:"3px 0",fontSize:10}}>
                    <span style={{color:"#888"}}>{p.pasto}</span>
                    <span style={{color:"#555",fontWeight:600}}>
                      {p.kcal} kcal {p.prot>0?"/ "+p.prot+"g":""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}


function TabMenu({menu, setMenuOverride, profili, settimana, setSettimana,
                  activeDay, setActiveDay, giorniFuori, toggleFuori, autoGenera,
                  builderScelte, setBuilderScelte, builderScelteProssima, setBuilderScelteProssima}) {
  var GIORNI_M = ["Lunedi","Martedi","Mercoledi","Giovedi","Venerdi","Sabato","Domenica"];
  var PASTI_M  = ["Colazione","Spuntino","Pranzo","Merenda","Cena"];
  var allDB    = CARBOIDRATI.concat(PROTEINE).concat(VERDURE).concat(FRUTTA).concat(SALSE);
  var s0=useState(0); var settSel=s0[0]; var setSettSel=s0[1];
  var s1=useState(null); var popup=s1[0]; var setPopup=s1[1];
  var s2=useState(null); var giornoAperto=s2[0]; var setGiornoAperto=s2[1];

  var scelteVis = settSel===0 ? builderScelte : builderScelteProssima;

  function getNome(id) {
    var it=allDB.find(function(x){return x.id===id;}); return it?it.nome:"";
  }
  function getEmoji(id) {
    var it=allDB.find(function(x){return x.id===id;}); return it?it.emoji:"";
  }
  function hasPasto(g,p) {
    var s=scelteVis[g+"-"+p]; return s&&(s.carbo||s.proteina||s.frutta||s.latticino);
  }

  var completi=0;
  GIORNI_M.forEach(function(g){PASTI_M.forEach(function(p){if(hasPasto(g,p))completi++;});});

  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center"}}>
        <button onClick={function(){setSettSel(0);}}
          style={{flex:1,padding:"8px",borderRadius:6,cursor:"pointer",fontSize:11,
            border:"none",borderBottom:"2px solid "+(settSel===0?"#0D1B2A":"transparent"),
            background:"transparent",fontWeight:settSel===0?800:400,
            color:settSel===0?"#0D1B2A":"#aaa"}}>
          Questa settimana
        </button>
        <button onClick={function(){setSettSel(1);}}
          style={{flex:1,padding:"8px",borderRadius:6,cursor:"pointer",fontSize:11,
            border:"none",borderBottom:"2px solid "+(settSel===1?"#0D1B2A":"transparent"),
            background:"transparent",fontWeight:settSel===1?800:400,
            color:settSel===1?"#0D1B2A":"#aaa"}}>
          Prossima settimana
        </button>
      </div>

      <div style={{fontSize:10,color:"#aaa",marginBottom:12}}>
        {completi} / {GIORNI_M.length*PASTI_M.length} pasti inseriti
      </div>

      {GIORNI_M.map(function(g){
        var pastiG=PASTI_M.filter(function(p){return hasPasto(g,p);});
        var aperto=giornoAperto===g;
        return (
          <div key={g} style={{borderBottom:"1px solid #f0f0f0"}}>
            <button onClick={function(){setGiornoAperto(aperto?null:g);}}
              style={{width:"100%",display:"flex",justifyContent:"space-between",
                alignItems:"center",padding:"12px 0",background:"transparent",
                border:"none",cursor:"pointer",textAlign:"left"}}>
              <div>
                <span style={{fontSize:12,fontWeight:700,color:"#0D1B2A"}}>{g}</span>
                {pastiG.length>0&&(
                  <span style={{fontSize:10,color:"#888",marginLeft:8}}>
                    {pastiG.length} pasto{pastiG.length!==1?"i":""}
                  </span>
                )}
                {pastiG.length===0&&(
                  <span style={{fontSize:10,color:"#ccc",marginLeft:8}}>vuoto</span>
                )}
              </div>
              <span style={{color:"#ccc",fontSize:13,transform:aperto?"rotate(90deg)":"none"}}>›</span>
            </button>

            {aperto&&(
              <div style={{paddingBottom:12}}>
                {PASTI_M.map(function(pasto){
                  var s=scelteVis[g+"-"+pasto];
                  if(!s) return (
                    <div key={pasto} style={{display:"flex",gap:12,padding:"7px 0",
                      borderTop:"1px solid #fafafa",alignItems:"center"}}>
                      <span style={{width:66,fontSize:10,color:"#ccc",flexShrink:0}}>{pasto}</span>
                      <span style={{fontSize:10,color:"#ddd"}}>—</span>
                    </div>
                  );
                  var protItem =allDB.find(function(x){return x.id===s.proteina;});
                  var carboItem=allDB.find(function(x){return x.id===s.carbo;});
                  var fruttaItem=allDB.find(function(x){return x.id===s.frutta;});
                  var principale=protItem||carboItem||fruttaItem;
                  var secondo   =protItem&&carboItem?carboItem:null;
                  return (
                    <div key={pasto}
                      onClick={function(){setPopup({g:g,pasto:pasto,s:s});}}
                      style={{display:"flex",gap:12,padding:"8px 0",
                        borderTop:"1px solid #fafafa",alignItems:"flex-start",cursor:"pointer"}}>
                      <span style={{width:66,fontSize:10,color:"#888",flexShrink:0,paddingTop:1}}>
                        {pasto}
                      </span>
                      <div style={{flex:1}}>
                        {principale&&<span style={{fontSize:11,fontWeight:600,color:"#0D1B2A"}}>
                          {principale.nome}
                        </span>}
                        {secondo&&<span style={{fontSize:10,color:"#aaa"}}> + {secondo.nome}</span>}
                        {s.verdura&&<span style={{fontSize:10,color:"#aaa"}}>
                          {" ? "}{getNome(s.verdura)}
                        </span>}
                        {s.nota&&<div style={{fontSize:9,color:"#bbb",fontStyle:"italic",marginTop:2}}>{s.nota}</div>}
                      </div>
                      <span style={{color:"#ddd",fontSize:12,marginTop:1}}>›</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {popup&&(
        <div onClick={function(){setPopup(null);}}
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:200,
            display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div onClick={function(e){e.stopPropagation();}}
            style={{background:"#fff",borderRadius:"16px 16px 0 0",width:"100%",maxWidth:520,
              maxHeight:"70vh",overflow:"auto",padding:"20px 20px 32px"}}>
            <div style={{fontSize:10,color:"#888",marginBottom:2}}>{popup.g} — {popup.pasto}</div>
            <div style={{fontSize:16,fontWeight:800,color:"#0D1B2A",marginBottom:16}}>
              {(function(){
                var p=allDB.find(function(x){return x.id===popup.s.proteina;});
                var c=allDB.find(function(x){return x.id===popup.s.carbo;});
                if(p&&c) return c.nome+" con "+p.nome;
                if(p) return p.nome;
                if(c) return c.nome;
                var f=allDB.find(function(x){return x.id===popup.s.frutta;});
                return f?f.nome:"Pasto";
              })()}
            </div>
            {["carbo","proteina","verdura","verdura2","frutta","latticino","salsa"].map(function(k){
              var id=popup.s[k]; if(!id) return null;
              var labels={carbo:"Carboidrati",proteina:"Proteina",verdura:"Verdura",
                verdura2:"2a verdura",frutta:"Frutta",latticino:"Latticino",salsa:"Salsa"};
              var it=allDB.find(function(x){return x.id===id;});
              if(!it) return null;
              return (
                <div key={k} style={{display:"flex",gap:12,padding:"8px 0",
                  borderBottom:"1px solid #f5f5f5",alignItems:"center"}}>
                  <span style={{width:70,fontSize:9,color:"#aaa"}}>{labels[k]}</span>
                  <span style={{fontSize:11,color:"#0D1B2A",fontWeight:500}}>{it.emoji} {it.nome}</span>
                  {it.kcal_p&&<span style={{marginLeft:"auto",fontSize:9,color:"#aaa"}}>
                    {it.kcal_p}kcal/100g
                  </span>}
                </div>
              );
            })}
            {popup.s.nota&&(
              <div style={{marginTop:12,padding:"10px",background:"#f8f8f8",borderRadius:8,
                fontSize:11,color:"#555",fontStyle:"italic"}}>{popup.s.nota}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TabDiario({menu, profili, regolaApro, setRegolaApro, builderScelte}) {
  var GIORNI_D = ["Lunedi","Martedi","Mercoledi","Giovedi","Venerdi","Sabato","Domenica"];
  var PASTI_D  = ["Colazione","Spuntino","Pranzo","Merenda","Cena"];
  var allDB    = CARBOIDRATI.concat(PROTEINE).concat(VERDURE).concat(FRUTTA).concat(SALSE);
  var PORZ     = {pasta:80,riso:80,cereali:70,tuberi:180,pane:60,colazione:50,
    "carne bianca":150,"carne rossa":150,pesce:150,uova:120,legumi:200,latticini:100,verdura:150,frutta:120};
  var oggi=new Date().getDay(); var todayIdx=oggi===0?6:oggi-1;
  var s0=useState(todayIdx); var giornoSel=s0[0]; var setGiornoSel=s0[1];

  var g=GIORNI_D[giornoSel];

  var PROFILI_D=[
    {id:"adulto",   label:"Adulto",   kcal_t:1600,prot_max:60, mult:1.0,  apro:false},
    {id:"adulta",   label:"Adulta",   kcal_t:1400,prot_max:55, mult:0.85, apro:false},
    {id:"bambino",  label:"Bambino",  kcal_t:1400,prot_max:40, mult:0.65, apro:false},
    {id:"aproteico",label:"Aproteico",kcal_t:1200,prot_max:20, mult:0.5,  apro:true},
    {id:"neonato",  label:"Neonato",  kcal_t:800, prot_max:15, mult:0.25, apro:false},
  ];

  function calcPasto(s, mult) {
    if(!s) return {kcal:0,prot:0};
    var kcal=0,prot=0;
    ["carbo","proteina","verdura","verdura2","frutta","latticino"].forEach(function(k){
      var id=s[k]; if(!id) return;
      var it=allDB.find(function(x){return x.id===id;});
      if(!it||!it.kcal_p) return;
      var gr=PORZ[it.cat]||100;
      kcal+=Math.round(it.kcal_p*gr/100*mult);
      prot+=Math.round((it.prot_p||0)*gr/100*mult);
    });
    return {kcal:kcal,prot:prot};
  }

  var hasDati=PASTI_D.some(function(p){var s=builderScelte[g+"-"+p];return s&&(s.carbo||s.proteina);});

  return (
    <div>
      <div style={{display:"flex",gap:4,marginBottom:16,overflowX:"auto"}}>
        {GIORNI_D.map(function(giorno,i){
          var isToday=i===todayIdx;
          var isSel=i===giornoSel;
          var hasD=PASTI_D.some(function(p){var s=builderScelte[giorno+"-"+p];return s&&(s.carbo||s.proteina);});
          return (
            <button key={giorno} onClick={function(){setGiornoSel(i);}}
              style={{minWidth:46,padding:"7px 3px",flexShrink:0,cursor:"pointer",
                border:"none",borderBottom:"2px solid "+(isSel?"#0D1B2A":"transparent"),
                background:"transparent",
                color:isSel?"#0D1B2A":hasD?"#555":"#ccc",
                fontSize:10,fontWeight:isSel?800:400,textAlign:"center"}}>
              {giorno.slice(0,3)}
              {isToday&&<div style={{width:4,height:4,borderRadius:"50%",background:"#0D1B2A",margin:"3px auto 0"}}/>}
            </button>
          );
        })}
      </div>

      {!hasDati&&(
        <div style={{padding:"24px 0",borderTop:"1px solid #f0f0f0",
          fontSize:11,color:"#aaa",textAlign:"center"}}>
          Nessun pasto inserito per {g}
        </div>
      )}

      {hasDati&&(
        <div>
          {PASTI_D.map(function(pasto){
            var s=builderScelte[g+"-"+pasto];
            return (
              <div key={pasto} style={{borderBottom:"1px solid #f0f0f0",paddingBottom:12,marginBottom:12}}>
                <div style={{fontSize:10,fontWeight:700,color:"#888",
                  textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>
                  {pasto}
                </div>
                {!s?(
                  <div style={{fontSize:11,color:"#ccc"}}>Non pianificato</div>
                ):(
                  <div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                      {["carbo","proteina","verdura","verdura2","frutta","latticino"].map(function(k){
                        var id=s[k]; if(!id) return null;
                        var it=allDB.find(function(x){return x.id===id;});
                        if(!it) return null;
                        return (
                          <span key={k} style={{fontSize:10,color:"#0D1B2A",
                            padding:"3px 8px",borderRadius:4,background:"#f5f5f5"}}>
                            {it.nome}
                          </span>
                        );
                      })}
                    </div>
                    {s.nota&&<div style={{fontSize:9,color:"#aaa",fontStyle:"italic",marginBottom:8}}>{s.nota}</div>}
                    <div style={{display:"flex",flexDirection:"column",gap:3}}>
                      {PROFILI_D.map(function(p){
                        var n=calcPasto(s,p.mult);
                        if(n.kcal===0) return null;
                        var overProt=p.apro&&n.prot>5;
                        return (
                          <div key={p.id} style={{display:"flex",gap:8,alignItems:"center",fontSize:10}}>
                            <span style={{width:62,color:"#aaa"}}>{p.label}</span>
                            <span style={{color:"#555",fontWeight:500}}>{n.kcal} kcal</span>
                            {n.prot>0&&(
                              <span style={{color:overProt?"#C0392B":"#aaa",fontWeight:overProt?700:400}}>
                                {n.prot}g prot{overProt?" !!":""}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Totale giorno */}
          <div style={{paddingTop:8}}>
            <div style={{fontSize:10,fontWeight:700,color:"#888",textTransform:"uppercase",
              letterSpacing:1,marginBottom:10}}>Totale giorno</div>
            {PROFILI_D.map(function(p){
              var tot=PASTI_D.reduce(function(acc,pasto){
                var n=calcPasto(builderScelte[g+"-"+pasto],p.mult);
                return {kcal:acc.kcal+n.kcal,prot:acc.prot+n.prot};
              },{kcal:0,prot:0});
              if(tot.kcal===0) return null;
              var overKcal=tot.kcal>p.kcal_t;
              var overProt=p.apro&&tot.prot>p.prot_max;
              var pct=Math.min(100,Math.round(tot.kcal/p.kcal_t*100));
              return (
                <div key={p.id} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",
                    alignItems:"center",marginBottom:3}}>
                    <span style={{fontSize:11,fontWeight:600,color:"#0D1B2A"}}>{p.label}</span>
                    <div style={{display:"flex",gap:10,fontSize:10}}>
                      <span style={{color:overKcal?"#C0392B":"#555",fontWeight:overKcal?700:400}}>
                        {tot.kcal}/{p.kcal_t} kcal
                      </span>
                      {tot.prot>0&&(
                        <span style={{color:overProt?"#C0392B":"#aaa",fontWeight:overProt?700:400}}>
                          {tot.prot}/{p.prot_max}g{overProt?" !!":""}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{background:"#f0f0f0",borderRadius:2,height:4}}>
                    <div style={{width:pct+"%",height:"100%",borderRadius:2,
                      background:overKcal?"#C0392B":overProt?"#E65100":"#0D1B2A"}}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── TAB SALUTE ────────────────────────────────────────────────
function TabSalute({profili, setProfili, pesoLog, setPesoLog, onSavePeso}) {
  var s0=useState(Object.keys(profili)[0]||""); var pid=s0[0]; var setPid=s0[1];
  var s1=useState(""); var nuovoPeso=s1[0]; var setNuovoPeso=s1[1];
  var prof = profili[pid];

  function aggiungiPeso() {
    var val = parseFloat(nuovoPeso);
    if(!val) return;
    var data = new Date().toISOString().split("T")[0];
    var newLog = Object.assign({},pesoLog);
    var arr = (pesoLog[pid]||[]).slice();
    var idx = arr.findIndex(function(x){return x.data===data;});
    if(idx>=0) arr[idx]={data:data,valore:val};
    else arr.push({data:data,valore:val});
    arr.sort(function(a,b){return a.data.localeCompare(b.data);});
    newLog[pid]=arr;
    setPesoLog(newLog);
    var newP=Object.assign({},profili);
    newP[pid]=Object.assign({},profili[pid],{peso:val});
    setProfili(newP);
    if(onSavePeso) onSavePeso(pid, data, val);
    setNuovoPeso("");
  }

  var log = pesoLog[pid]||[];
  var bmi = prof&&prof.peso&&prof.altezza
    ? (prof.peso/((prof.altezza/100)*(prof.altezza/100))).toFixed(1)
    : null;
  var bmiCat = !bmi?"":
    parseFloat(bmi)<18.5?"Sottopeso":
    parseFloat(bmi)<25?"Normopeso":
    parseFloat(bmi)<30?"Sovrappeso":"Obesita";

  // Grafico SVG andamento peso
  function GraficoAndamento(gProps) {
    var dati=gProps.dati;
    if(!dati||dati.length<2) return null;
    var ultimi=dati.slice(-12);
    var valori=ultimi.map(function(d){return d.valore;});
    var minV=Math.min.apply(null,valori)-0.5;
    var maxV=Math.max.apply(null,valori)+0.5;
    var W=280; var H=80; var PAD=4;
    function xPx(i){return PAD+(i/(ultimi.length-1))*(W-PAD*2);}
    function yPx(v){return PAD+(1-(v-minV)/(maxV-minV||1))*(H-PAD*2);}
    var primo=valori[0]; var ultimo=valori[valori.length-1];
    var delta=(ultimo-primo).toFixed(1);
    var trend=parseFloat(delta);
    var colore=trend<0?"#2D6A4F":trend>0?"#C0392B":"#888";

    var punti=ultimi.map(function(d,i){return xPx(i)+","+yPx(d.valore);}).join("?");

    return (
      <div style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
          <span style={{fontSize:10,color:"#888"}}>Ultimi {ultimi.length} rilevamenti</span>
          <span style={{fontSize:12,fontWeight:700,color:colore}}>
            {trend>0?"+":""}{delta} kg
            <span style={{fontSize:9,fontWeight:400,color:"#aaa",marginLeft:4}}>
              ({primo} → {ultimo} kg)
            </span>
          </span>
        </div>
        <svg width="100%" viewBox={"0 0 "+W+"?"+H}
          style={{display:"block",overflow:"visible"}}>
          {/* Linea zero change */}
          {ultimi.map(function(d,i){
            if(i===0) return null;
            var prev=ultimi[i-1];
            var su=d.valore>prev.valore;
            var giu=d.valore<prev.valore;
            return (
              <line key={i}
                x1={xPx(i-1)} y1={yPx(prev.valore)}
                x2={xPx(i)}   y2={yPx(d.valore)}
                stroke={su?"#C0392B":giu?"#2D6A4F":"#ccc"}
                strokeWidth={2} strokeLinecap="round"/>
            );
          })}
          {/* Punti */}
          {ultimi.map(function(d,i){
            var isLast=i===ultimi.length-1;
            return (
              <circle key={"c"+i} cx={xPx(i)} cy={yPx(d.valore)}
                r={isLast?4:2.5}
                fill={isLast?colore:"#fff"}
                stroke={colore} strokeWidth={1.5}/>
            );
          })}
          {/* Label primo e ultimo */}
          <text x={xPx(0)} y={yPx(valori[0])-7} fontSize={8} fill="#aaa" textAnchor="middle">
            {valori[0]}
          </text>
          <text x={xPx(ultimi.length-1)} y={yPx(valori[valori.length-1])-7}
            fontSize={8} fill={colore} textAnchor="middle" fontWeight="700">
            {valori[valori.length-1]}
          </text>
        </svg>
        {/* Etichette date */}
        <div style={{display:"flex",justifyContent:"space-between",fontSize:8,color:"#ccc",marginTop:2}}>
          <span>{ultimi[0].data.slice(5)}</span>
          <span>{ultimi[ultimi.length-1].data.slice(5)}</span>
        </div>
      </div>
    );
  }

  if(!prof) return null;

  return (
    <div>
      {/* Selettore persona */}
      <div style={{display:"flex",gap:0,marginBottom:16,borderBottom:"1px solid #f0f0f0"}}>
        {Object.keys(profili).map(function(id){
          var p=profili[id];
          var isSel=pid===id;
          return (
            <button key={id} onClick={function(){setPid(id);}}
              style={{flex:1,padding:"8px 4px",background:"transparent",border:"none",
                borderBottom:"2px solid "+(isSel?"#0D1B2A":"transparent"),
                fontSize:11,fontWeight:isSel?800:400,
                color:isSel?"#0D1B2A":"#aaa",cursor:"pointer",textAlign:"center"}}>
              {p.nome.split("?")[0]}
            </button>
          );
        })}
      </div>

      {/* Dati principali */}
      <div style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:4}}>
          <div>
            <div style={{fontSize:24,fontWeight:800,color:"#0D1B2A"}}>
              {prof.peso||""}
              <span style={{fontSize:13,fontWeight:400,color:"#aaa",marginLeft:4}}>kg</span>
            </div>
            <div style={{fontSize:10,color:"#aaa"}}>{prof.nome}</div>
          </div>
          {bmi&&(
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:20,fontWeight:700,color:"#0D1B2A"}}>{bmi}</div>
              <div style={{fontSize:10,color:"#aaa"}}>BMI — {bmiCat}</div>
            </div>
          )}
        </div>
        {prof.altezza&&<div style={{fontSize:10,color:"#aaa"}}>
          {prof.altezza} cm
          {prof.eta&&""+prof.eta+" anni"}
        </div>}
      </div>

      {/* Grafico andamento */}
      <GraficoAndamento dati={log}/>

      {log.length<2&&log.length>0&&(
        <div style={{fontSize:10,color:"#aaa",marginBottom:12}}>
          Aggiungi almeno 2 rilevamenti per vedere l andamento
        </div>
      )}

      {/* Input nuovo peso */}
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:20,
        paddingBottom:16,borderBottom:"1px solid #f0f0f0"}}>
        <input type="number" step="0.1" placeholder="Peso oggi (kg)"
          value={nuovoPeso}
          onChange={function(e){setNuovoPeso(e.target.value);}}
          onKeyDown={function(e){if(e.key==="Enter")aggiungiPeso();}}
          style={{flex:1,padding:"9px 12px",borderRadius:6,
            border:"1.5px solid #ddd",fontSize:12,outline:"none"}}/>
        <button onClick={aggiungiPeso}
          style={{padding:"9px 16px",borderRadius:6,border:"none",
            background:"#0D1B2A",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>
          Salva
        </button>
      </div>

      {/* Storico */}
      {log.length>0&&(
        <div>
          <div style={{fontSize:10,fontWeight:700,color:"#888",textTransform:"uppercase",
            letterSpacing:1,marginBottom:10}}>Storico</div>
          {log.slice().reverse().map(function(entry,i){
            var arr=log.slice().reverse();
            var prevEntry=arr[i+1];
            var delta=prevEntry?(entry.valore-prevEntry.valore).toFixed(1):null;
            var deltaNum=delta?parseFloat(delta):0;
            return (
              <div key={entry.data} style={{display:"flex",alignItems:"center",gap:10,
                padding:"9px 0",borderBottom:"1px solid #f0f0f0"}}>
                <span style={{fontSize:10,color:"#aaa",minWidth:54}}>{entry.data.slice(5)}</span>
                <span style={{flex:1,fontSize:12,fontWeight:600,color:"#0D1B2A"}}>
                  {entry.valore} kg
                </span>
                {delta&&(
                  <span style={{fontSize:10,fontWeight:700,
                    color:deltaNum<0?"#2D6A4F":deltaNum>0?"#C0392B":"#aaa"}}>
                    {deltaNum>0?"+":""}{delta}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── TAB DISPENSA ─────────────────────────────────────────────
function TabDispensa({dispensa, setDispensa, spesa, setSpesa}) {
  const [vista, setVista] = useState("dispensa");
  const [nuovoItem, setNuovoItem] = useState({nome:"",cat:"frigo",qty:"1",unita:"pz",scadenza:""});
  const [nuovaSpesa, setNuovaSpesa] = useState("");
  const oggi = new Date().toISOString().split("T")[0];

  const CATS = [
    {id:"frigo",      l:"Frigo",           emoji:"frig"},
    {id:"ortofrutta", l:"Ortofrutta",      emoji:"?"},
    {id:"carne_p",    l:"Carne e Pesce",   emoji:"?"},
    {id:"pasta",      l:"Pasta e Cereali", emoji:"?"},
    {id:"pane_cereal",l:"Pane e Dolci",    emoji:"?"},
    {id:"latticini",  l:"Latticini e Uova",emoji:"?"},
    {id:"scatole",    l:"Scatolame",       emoji:"?"},
    {id:"salse_cond", l:"Salse e Oli",     emoji:"?"},
    {id:"surgelati",  l:"Surgelati",       emoji:"?"},
    {id:"altro",      l:"Altro",           emoji:"?"},
  ];

  const isScad = (s) => s && s < oggi;
  const isProxScad = (s) => {
    if(!s || s < oggi) return false;
    return (new Date(s)-new Date())/(1000*60*60*24) <= 3;
  };

  const aggiungi = () => {
    if(!nuovoItem.nome.trim()) return;
    setDispensa(prev=>[...prev,{id:"d"+Date.now(),...nuovoItem}]);
    setNuovoItem({nome:"",cat:"frigo",qty:"1",unita:"pz",scadenza:"",emoji:""});
  };

  const addSpesa = () => {
    if(!nuovaSpesa.trim()) return;
    setSpesa(prev=>[...prev,{id:"s"+Date.now(),nome:nuovaSpesa,checked:false}]);
    setNuovaSpesa("");
  };

  return (
    <div>
      <div style={{display:"flex",gap:6,marginBottom:14}}>
        {[{id:"dispensa",l:"Dispensa ("+dispensa.length+")"},{id:"spesa",l:"Spesa ("+spesa.filter(x=>!x.checked).length+")"}].map(v => (
          <button key={v.id} onClick={()=>setVista(v.id)}
            style={{flex:1,padding:"8px",borderRadius:12,border:"none",cursor:"pointer",
              background:vista===v.id?"#2E5F8A":"#fff",
              color:vista===v.id?"#fff":"#555",fontWeight:vista===v.id?700:400,fontSize:11,
              boxShadow:vista===v.id?"none":"0 1px 6px rgba(0,0,0,.07)"}}>
            {v.l}
          </button>
        ))}
      </div>

      {vista==="dispensa" && (
        <div>
          <div style={{background:"#EBF3FA",borderRadius:14,padding:"12px",marginBottom:12,
            border:"1.5px solid #C8E6C9"}}>
            <input placeholder="Nome prodotto" value={nuovoItem.nome}
              onChange={e=>setNuovoItem(p=>({...p,nome:e.target.value}))}
              style={{width:"100%",padding:"7px",borderRadius:8,border:"1.5px solid #C8E6C9",
                fontSize:12,marginBottom:6,boxSizing:"border-box"}}/>
            <div style={{display:"flex",gap:6,marginBottom:6}}>
              <select value={nuovoItem.cat} onChange={e=>setNuovoItem(p=>({...p,cat:e.target.value}))}
                style={{flex:2,padding:"6px",borderRadius:8,border:"1.5px solid #C8E6C9",fontSize:11}}>
                {CATS.map(c=><option key={c.id} value={c.id}>{c.l}</option>)}
              </select>
              <input value={nuovoItem.qty} onChange={e=>setNuovoItem(p=>({...p,qty:e.target.value}))}
                placeholder="Qty" style={{flex:1,padding:"6px",borderRadius:8,
                  border:"1.5px solid #C8E6C9",fontSize:11}}/>
            </div>
            <input type="date" value={nuovoItem.scadenza}
              onChange={e=>setNuovoItem(p=>({...p,scadenza:e.target.value}))}
              style={{width:"100%",padding:"6px",borderRadius:8,border:"1.5px solid #C8E6C9",
                fontSize:11,marginBottom:8,boxSizing:"border-box"}}/>
            <button onClick={aggiungi} disabled={!nuovoItem.nome.trim()}
              style={{width:"100%",padding:"9px",borderRadius:12,border:"none",
                background:nuovoItem.nome.trim()?"#2E5F8A":"#ccc",
                color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>
              Aggiungi
            </button>
          </div>

          {dispensa.length===0 ? (
            <div style={{textAlign:"center",padding:"30px",color:"#aaa",fontSize:12}}>
              Dispensa vuota
            </div>
          ) : dispensa.map(item => (
            <div key={item.id} style={{background:"#fff",borderRadius:12,padding:"12px 14px",
              marginBottom:8,boxShadow:"0 1px 6px rgba(0,0,0,.07)",
              border:isScad(item.scadenza)?"1.5px solid #C0392B":
                isProxScad(item.scadenza)?"1.5px solid #F4A261":"1px solid transparent"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:700}}>{item.nome}</div>
                  <div style={{fontSize:9,color:"#aaa"}}>{item.qty}{item.unita} - {(CATS.find(c=>c.id===item.cat)||{}).l}</div>
                  {item.scadenza && (
                    <div style={{fontSize:9,color:isScad(item.scadenza)?"#C0392B":
                      isProxScad(item.scadenza)?"#C2D9EC":"#aaa"}}>
                      Scade: {item.scadenza}
                      {isScad(item.scadenza)?" - SCADUTO":""}
                      {isProxScad(item.scadenza)?" - in scadenza":""}
                    </div>
                  )}
                </div>
                <button onClick={()=>setDispensa(prev=>prev.filter(x=>x.id!==item.id))}
                  style={{background:"none",border:"none",cursor:"pointer",
                    fontSize:14,color:"#ddd"}}>x</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {vista==="spesa" && (
        <div>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <input placeholder="Aggiungi alla spesa..." value={nuovaSpesa}
              onChange={e=>setNuovaSpesa(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter")addSpesa();}}
              style={{flex:1,padding:"8px",borderRadius:8,border:"1.5px solid #C8E6C9",fontSize:12}}/>
            <button onClick={addSpesa}
              style={{background:"#2E5F8A",color:"#fff",border:"none",borderRadius:20,
                padding:"8px 14px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
              +
            </button>
          </div>

          {spesa.length===0 ? (
            <div style={{textAlign:"center",padding:"30px",color:"#aaa",fontSize:12}}>
              Lista spesa vuota
            </div>
          ) : (
            <div>
              {spesa.filter(x=>!x.checked).map(item => (
                <div key={item.id} style={{background:"#fff",borderRadius:12,padding:"12px 14px",
                  marginBottom:6,display:"flex",alignItems:"center",gap:10,
                  boxShadow:"0 1px 6px rgba(0,0,0,.07)"}}>
                  <input type="checkbox" onChange={()=>setSpesa(prev=>prev.map(x=>
                    x.id===item.id?{...x,checked:true}:x))}/>
                  <span style={{flex:1,fontSize:12}}>{item.nome}</span>
                  <button onClick={()=>setSpesa(prev=>prev.filter(x=>x.id!==item.id))}
                    style={{background:"none",border:"none",cursor:"pointer",color:"#ddd"}}>x</button>
                </div>
              ))}
              {spesa.some(x=>x.checked) && (
                <div style={{marginTop:10}}>
                  <div style={{fontSize:10,color:"#aaa",marginBottom:5}}>Acquistati:</div>
                  {spesa.filter(x=>x.checked).map(item => (
                    <div key={item.id} style={{background:"#f5f5f5",borderRadius:12,padding:"8px 12px",
                      marginBottom:4,display:"flex",alignItems:"center",gap:10}}>
                      <span style={{flex:1,fontSize:12,color:"#aaa",textDecoration:"line-through"}}>
                        {item.nome}
                      </span>
                      <button onClick={()=>setSpesa(prev=>prev.filter(x=>x.id!==item.id))}
                        style={{background:"none",border:"none",cursor:"pointer",color:"#ddd"}}>x</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── TAB MEAL PREP ─────────────────────────────────────────────
function TabMealPrep({mealPrep, setMealPrep, profili}) {
  const [showForm, setShowForm] = useState(false);
  const [filtro, setFiltro] = useState("tutti");
  const [form, setForm] = useState({
    nome:"", emoji:"", pid:Object.keys(profili)[0]||"",
    cons:"freezer", note:"", kcal:"", prot:"", porzioni:"1",
    data: new Date().toISOString().split("T")[0]
  });
  const oggi = new Date().toISOString().split("T")[0];
  const CONS = [{id:"frigo",l:"Frigo",g:3,c:"#C2355A"},{id:"freezer",l:"Freezer",g:90,c:"#2E5F8A"},{id:"tavola",l:"T.amb",g:1,c:"#C2D9EC"}];

  const aggiungi = () => {
    if(!form.nome.trim()) return;
    const cons = CONS.find(c=>c.id===form.cons);
    const scad = new Date();
    scad.setDate(scad.getDate()+((cons&&cons.g)||3));
    setMealPrep(prev=>[...prev,{id:"mp"+Date.now(), nome:form.nome.trim(),
      emoji:form.emoji, pid:form.pid, cons:form.cons,
      kcal:parseFloat(form.kcal)||0, prot:parseFloat(form.prot)||0,
      porzioni:parseInt(form.porzioni)||1,
      porzioniRimaste:parseInt(form.porzioni)||1,
      dataProd:form.data, note:form.note,
      scadenza:scad.toISOString().split("T")[0]}]);
    setForm({nome:"",emoji:"",pid:Object.keys(profili)[0]||"",cons:"freezer",
      note:"",kcal:"",prot:"",porzioni:"1",data:oggi});
    setShowForm(false);
  };

  const usaPorzione = (id) => {
    setMealPrep(prev=>prev.map(p=>p.id!==id?p:
      {...p,porzioniRimaste:Math.max(0,p.porzioniRimaste-1)}));
  };

  const isScad = (s) => s && s < oggi;
  const isProx = (s) => {
    if(!s||s<oggi) return false;
    return (new Date(s)-new Date())/(1000*60*60*24) <= 2;
  };

  const filtrati = filtro==="tutti"?mealPrep:mealPrep.filter(p=>p.pid===filtro);
  const alerts = mealPrep.filter(p=>p.porzioniRimaste>0&&(isScad(p.scadenza)||isProx(p.scadenza))).length;

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <div style={{fontSize:14,fontWeight:800,color:"#2E5F8A"}}>Meal Prep</div>
        <button onClick={()=>setShowForm(s=>!s)}
          style={{background:showForm?"#FDE8E4":"#2E5F8A",color:showForm?"#C0392B":"#fff",
            border:"none",borderRadius:20,padding:"5px 14px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
          {showForm?"Annulla":"+ Aggiungi"}
        </button>
      </div>
      <div style={{fontSize:10,color:"#888",marginBottom:12}}>
        Pasti preparati e conservati
      </div>

      {alerts > 0 && (
        <div style={{background:"#FDE8E4",borderRadius:12,padding:"8px 12px",marginBottom:10,
          display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>!</span>
          <div style={{fontSize:11,fontWeight:700,color:"#C0392B"}}>
            {alerts} pasti in scadenza
          </div>
        </div>
      )}

      {showForm && (
        <div style={{background:"#EBF3FA",borderRadius:14,padding:"13px",marginBottom:14,
          border:"1.5px solid #C8E6C9"}}>
          <div style={{display:"flex",gap:7,marginBottom:8}}>
            <input value={form.emoji} onChange={e=>setForm(p=>({...p,emoji:e.target.value}))}
              style={{width:46,padding:"7px 4px",borderRadius:8,border:"1.5px solid #C8E6C9",
                fontSize:18,textAlign:"center"}}/>
            <input placeholder="Nome pasto preparato" value={form.nome}
              onChange={e=>setForm(p=>({...p,nome:e.target.value}))}
              style={{flex:1,padding:"7px",borderRadius:8,border:"1.5px solid #C8E6C9",fontSize:12}}/>
          </div>

          <div style={{marginBottom:8}}>
            <div style={{fontSize:9,fontWeight:700,color:"#888",marginBottom:4}}>Per chi:</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {Object.entries(profili).map(([pid,p])=>(
                <button key={pid} onClick={()=>setForm(f=>({...f,pid}))}
                  style={{background:form.pid===pid?p.colore:"#fff",
                    color:form.pid===pid?"#fff":"#555",
                    border:"1.5px solid "+(form.pid===pid?p.colore:"#ddd"),
                    borderRadius:20,padding:"3px 10px",fontSize:10,cursor:"pointer"}}>
                  {p.nome.slice(0,1)} {p.nome.split("?")[0]}
                </button>
              ))}
            </div>
          </div>

          <div style={{display:"flex",gap:5,marginBottom:8}}>
            {CONS.map(c=>(
              <button key={c.id} onClick={()=>setForm(f=>({...f,cons:c.id}))}
                style={{flex:1,background:form.cons===c.id?c.c:"#fff",
                  color:form.cons===c.id?"#fff":"#555",
                  border:"1.5px solid "+(form.cons===c.id?c.c:"#ddd"),
                  borderRadius:20,padding:"4px",fontSize:10,cursor:"pointer"}}>
                {c.l}
              </button>
            ))}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
            {[{k:"porzioni",l:"Porzioni"},{k:"kcal",l:"Kcal"},{k:"prot",l:"Prot(g)"}].map(f=>(
              <div key={f.k}>
                <div style={{fontSize:9,color:"#888",marginBottom:2}}>{f.l}</div>
                <input type="number" value={form[f.k]}
                  onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))}
                  style={{width:"100%",padding:"5px",borderRadius:8,border:"1.5px solid #C8E6C9",
                    fontSize:11,boxSizing:"border-box"}}/>
              </div>
            ))}
          </div>

          <input placeholder="Note (es. senza sale, porzioni 80g...)" value={form.note}
            onChange={e=>setForm(p=>({...p,note:e.target.value}))}
            style={{width:"100%",padding:"6px",borderRadius:8,border:"1.5px solid #C8E6C9",
              fontSize:11,marginBottom:10,boxSizing:"border-box"}}/>

          <button onClick={aggiungi} disabled={!form.nome.trim()}
            style={{width:"100%",padding:"10px",borderRadius:12,border:"none",
              background:form.nome.trim()?"#2E5F8A":"#ccc",color:"#fff",
              fontSize:12,fontWeight:700,cursor:"pointer"}}>
            Salva nel meal prep
          </button>
        </div>
      )}

      <div style={{display:"flex",gap:5,marginBottom:12,overflowX:"auto"}}>
        <button onClick={()=>setFiltro("tutti")}
          style={{padding:"4px 10px",borderRadius:20,
            border:filtro==="tutti"?"2px solid #2D6A4F":"2px solid #ddd",
            background:filtro==="tutti"?"#2E5F8A":"#fff",
            color:filtro==="tutti"?"#fff":"#555",fontSize:10,cursor:"pointer"}}>
          Tutti ({mealPrep.length})
        </button>
        {Object.entries(profili).map(([pid,p])=>{
          const n = mealPrep.filter(m=>m.pid===pid).length;
          if(!n) return null;
          return (
            <button key={pid} onClick={()=>setFiltro(pid)}
              style={{padding:"4px 10px",borderRadius:20,
                border:filtro===pid?"2px solid "+p.colore:"2px solid #ddd",
                background:filtro===pid?p.colore:"#fff",
                color:filtro===pid?"#fff":"#555",fontSize:10,cursor:"pointer"}}>
              {p.nome.slice(0,1)} ({n})
            </button>
          );
        })}
      </div>

      {filtrati.length===0 ? (
        <div style={{background:"#F5F8FC",borderRadius:14,padding:"28px",textAlign:"center"}}>
          <div style={{fontSize:20,marginBottom:8}}></div>
          <div style={{fontSize:12,color:"#888"}}>Nessun pasto preparato</div>
        </div>
      ) : filtrati.map(item => {
        const cons = CONS.find(c=>c.id===item.cons);
        const p = profili[item.pid];
        const scad = isScad(item.scadenza);
        const prox = isProx(item.scadenza);
        const finito = item.porzioniRimaste===0;
        return (
          <div key={item.id} style={{background:"#fff",borderRadius:14,padding:"12px 14px",
            marginBottom:10,opacity:finito?0.6:1,
            boxShadow:scad?"0 0 0 2px #C0392B,0 2px 6px rgba(0,0,0,.05)":
              prox?"0 0 0 2px #F4A261,0 2px 6px rgba(0,0,0,.05)":
              "0 1px 6px rgba(0,0,0,.07)"}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:9,marginBottom:6}}>
              <span style={{fontSize:20}}>{item.emoji}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:800,color:finito?"#aaa":"#222"}}>
                  {item.nome}
                </div>
                <div style={{display:"flex",gap:5,marginTop:3,flexWrap:"wrap"}}>
                  {p && <span style={{fontSize:9,background:p.colore+"22",color:p.colore,
                    fontWeight:700,padding:"2px 8px",borderRadius:20}}>{p.nome.slice(0,1)} {p.nome}</span>}
                  {cons && <span style={{fontSize:9,background:cons.c+"22",color:cons.c,
                    fontWeight:700,padding:"2px 8px",borderRadius:20}}>{cons.l}</span>}
                  {scad && <span style={{fontSize:9,background:"#FDE8E4",color:"#C0392B",
                    fontWeight:700,padding:"2px 8px",borderRadius:20}}>SCADUTO</span>}
                  {!scad&&prox && <span style={{fontSize:9,background:"#EBF3FA",color:"#1B3A5C",
                    fontWeight:700,padding:"2px 8px",borderRadius:20}}>scade presto</span>}
                  {finito && <span style={{fontSize:9,background:"#f5f5f5",color:"#aaa",
                    fontWeight:700,padding:"2px 8px",borderRadius:20}}>esaurito</span>}
                </div>
              </div>
              <button onClick={()=>setMealPrep(prev=>prev.filter(x=>x.id!==item.id))}
                style={{background:"none",border:"none",cursor:"pointer",color:"#ddd"}}>x</button>
            </div>

            <div style={{display:"flex",gap:10,fontSize:10,color:"#666",marginBottom:6}}>
              {item.porzioniRimaste > 0 && <span>Porzioni: {item.porzioniRimaste}/{item.porzioni}</span>}
              {item.kcal > 0 && <span>{item.kcal} kcal</span>}
              {item.prot > 0 && <span>{item.prot}g prot</span>}
              <span style={{color:scad?"#C0392B":prox?"#1B3A5C":"#888"}}>
                Scade: {item.scadenza}
              </span>
            </div>

            {item.note && <div style={{fontSize:10,color:"#888",fontStyle:"italic",marginBottom:6}}>
              {item.note}
            </div>}

            {!finito && (
              <button onClick={()=>usaPorzione(item.id)}
                style={{background:"#2E5F8A",color:"#fff",border:"none",borderRadius:20,
                  padding:"5px 14px",fontSize:10,fontWeight:700,cursor:"pointer"}}>
                Usa 1 porzione
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}


// ── TAB PIRAMIDE ─────────────────────────────────────────────
const PIRAMIDE_GRUPPI = [
  {id:"cereali",  l:"Cereali integrali", target:6, unit:"porz/die", c:"#C2355A", note:"Pasta, riso, pane - base di ogni pasto"},
  {id:"verdura",  l:"Verdura",           target:5, unit:"porz/die", c:"#6B9EC4", note:"Almeno 2-3 porzioni crude"},
  {id:"frutta",   l:"Frutta",            target:3, unit:"porz/die", c:"#C2355A", note:"Frutta di stagione, varia i colori"},
  {id:"legumi",   l:"Legumi",            target:3, unit:"x/sett",   c:"#1B3A5C", note:"Ceci, lenticchie, fagioli"},
  {id:"pesce",    l:"Pesce",             target:3, unit:"x/sett",   c:"#C2355A", note:"Pesce azzurro ricco di omega-3"},
  {id:"carne",    l:"Carne bianca",      target:3, unit:"x/sett",   c:"#C2D9EC", note:"Pollo, tacchino, coniglio"},
  {id:"latticini",l:"Latticini",         target:2, unit:"porz/die", c:"#C2355A", note:"Yogurt, formaggi freschi"},
  {id:"uova",     l:"Uova",              target:2, unit:"x/sett",   c:"#C2355A", note:"Fonte proteica economica"},
  {id:"grassi",   l:"Olio EVO",          target:3, unit:"cucch/die",c:"#2E5F8A", note:"A crudo, extravergine italiano"},
];

function TabPiramide({menu, builderScelte}) {
  var allDB = CARBOIDRATI.concat(PROTEINE).concat(VERDURE).concat(FRUTTA);
  var SETTIMANE = ["Questa settimana","Settimana prossima"];
  var s0=useState(0); var settSel=s0[0]; var setSettSel=s0[1];

  var scelteVis = settSel===0 ? builderScelte : {};

  // Conta per categoria piramide
  var conteggi = {cereali:0,verdura:0,frutta:0,legumi:0,pesce:0,carne:0,carne_rossa:0,uova:0,latticini:0};
  Object.values(scelteVis).forEach(function(s){
    if(!s) return;
    if(s.carbo) conteggi.cereali++;
    if(s.verdura) conteggi.verdura++;
    if(s.verdura2) conteggi.verdura++;
    if(s.frutta) conteggi.frutta++;
    if(s.latticino) conteggi.latticini++;
    if(s.proteina){
      var p=PROTEINE.find(function(x){return x.id===s.proteina;});
      if(p&&conteggi[p.piramide]!==undefined) conteggi[p.piramide]++;
    }
  });

  var LIVELLI = [
    {id:"cereali",    label:"Cereali e carboidrati", target:14, color:"#D4A017", desc:"2 porzioni/giorno"},
    {id:"verdura",    label:"Verdure",                target:21, color:"#52B788", desc:"3 porzioni/giorno"},
    {id:"frutta",     label:"Frutta",                 target:14, color:"#E07A5F", desc:"2 porzioni/giorno"},
    {id:"legumi",     label:"Legumi",                 target:3,  color:"#8E44AD", desc:"3x settimana"},
    {id:"pesce",      label:"Pesce",                  target:3,  color:"#5390D9", desc:"3x settimana"},
    {id:"carne",      label:"Carne bianca",            target:3,  color:"#F4A261", desc:"3x settimana"},
    {id:"carne_rossa",label:"Carne rossa",             target:1,  color:"#C0392B", desc:"max 1x settimana"},
    {id:"uova",       label:"Uova",                   target:2,  color:"#B7791F", desc:"max 2x settimana"},
    {id:"latticini",  label:"Latticini",               target:7,  color:"#1565C0", desc:"1 porzione/giorno"},
  ];

  var totPasti = Object.keys(scelteVis).length;

  return (
    <div>
      <div style={{display:"flex",gap:6,marginBottom:16}}>
        {SETTIMANE.map(function(s,i){
          return (
            <button key={s} onClick={function(){setSettSel(i);}}
              style={{flex:1,padding:"8px",borderRadius:10,cursor:"pointer",fontSize:11,
                border:"2px solid "+(settSel===i?"#2E5F8A":"#eee"),
                background:settSel===i?"#2E5F8A":"#fff",
                color:settSel===i?"#fff":"#888",fontWeight:settSel===i?800:400}}>
              {s}
            </button>
          );
        })}
      </div>

      {totPasti===0&&(
        <div style={{textAlign:"center",padding:"30px",background:"#F5F8FC",borderRadius:12,marginBottom:16}}>
          <div style={{fontSize:28,marginBottom:8}}>🌿</div>
          <div style={{fontSize:13,fontWeight:700,color:"#888"}}>Nessun pasto inserito</div>
          <div style={{fontSize:11,color:"#aaa",marginTop:4}}>Costruisci il menu dal tab Builder</div>
        </div>
      )}

      {LIVELLI.map(function(l){
        var val = conteggi[l.id]||0;
        var pct = Math.min(100, Math.round(val/l.target*100));
        var ok  = val >= l.target;
        var over= l.id==="carne_rossa"&&val>l.target;
        return (
          <div key={l.id} style={{marginBottom:14,background:"#fff",borderRadius:12,
            padding:"12px 14px",border:"1.5px solid "+(over?"#FDE8E4":ok?"#E8F5E9":"#eee"),
            boxShadow:"0 1px 6px rgba(0,0,0,.05)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div>
                <div style={{fontSize:11,fontWeight:800,color:"#0D1B2A"}}>{l.label}</div>
                <div style={{fontSize:9,color:"#aaa"}}>{l.desc}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <span style={{fontSize:18,fontWeight:800,
                  color:over?"#C0392B":ok?"#2D6A4F":l.color}}>{val}</span>
                <span style={{fontSize:10,color:"#aaa"}}>/{l.target}</span>
              </div>
            </div>
            <div style={{background:"#f0f0f0",borderRadius:6,height:10,overflow:"hidden",marginBottom:5}}>
              <div style={{width:pct+"%",height:"100%",borderRadius:6,
                background:over?"#C0392B":ok?"#2D6A4F":l.color,transition:"width .4s"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:9}}>
              <span style={{color:over?"#C0392B":ok?"#2D6A4F":"#888",fontWeight:over||ok?700:400}}>
                {over?"Superato! Riduci":ok?"Obiettivo raggiunto!":"mancano "+(l.target-val)+" porzioni"}
              </span>
              <span style={{color:"#aaa"}}>{pct}%</span>
            </div>
            {l.id==="carne_rossa"&&over&&(
              <div style={{background:"#FDE8E4",borderRadius:6,padding:"5px 8px",marginTop:6,fontSize:9,color:"#C0392B",fontWeight:600}}>
                Linee guida: max 1 volta a settimana. Attenzione per dieta ipoproteica.
              </div>
            )}
          </div>
        );
      })}

      <div style={{background:"#F0F7F4",borderRadius:12,padding:"12px 14px",marginTop:4}}>
        <div style={{fontSize:10,fontWeight:800,color:"#2D6A4F",marginBottom:6}}>Consigli settimana</div>
        {conteggi.pesce<3&&<div style={{fontSize:10,color:"#555",marginBottom:3}}>
          Pesce: aggiungi {3-conteggi.pesce} pasto/i (omega-3)
        </div>}
        {conteggi.verdura<14&&<div style={{fontSize:10,color:"#555",marginBottom:3}}>
          Verdure: {14-conteggi.verdura} porzioni mancanti (fibra e vitamine)
        </div>}
        {conteggi.legumi<3&&<div style={{fontSize:10,color:"#555",marginBottom:3}}>
          Legumi: {3-conteggi.legumi} pasto/i mancanti (proteine vegetali)
        </div>}
        {conteggi.carne_rossa>1&&<div style={{fontSize:10,color:"#C0392B",fontWeight:700,marginBottom:3}}>
          Carne rossa: ridurre ({conteggi.carne_rossa} su 1 max)
        </div>}
        {conteggi.pesce>=3&&conteggi.verdura>=14&&conteggi.legumi>=3&&conteggi.carne_rossa<=1&&(
          <div style={{fontSize:11,color:"#2D6A4F",fontWeight:700}}>
            Ottima settimana! Menu bilanciato.
          </div>
        )}
      </div>
    </div>
  );
}

// ── TAB IDEE E ISPIRAZIONI ────────────────────────────────────


// ── DATABASE RICETTE COMPLETO ────────────────────────────────
const DB_RICETTE = [

  // ── PRIMI ────────────────────────────────────────────────
  {
    id:"r001", titolo:"Pasta al pomodoro fresco", categoria:"Primo",
    emoji:"?", tempo:"20 min", difficolta:"Facile", stagione:["estate","primavera"],
    img:"https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=400&q=80",
    ingredienti:[
      {nome:"Pasta",qty:"320g"},{nome:"Pomodori",qty:"500g"},
      {nome:"Basilico",qty:"q.b."},{nome:"Aglio",qty:"2 spicchi"},
      {nome:"Olio EVO",qty:"4 cucchiai"},{nome:"Sale",qty:"q.b."}
    ],
    porzioni:{
      adulta:{piatto:"70g pasta + sugo abbondante",kcal:330,prot:10},
      adulto:{piatto:"90g pasta + sugo abbondante",kcal:420,prot:13},
      bimbo: {piatto:"80g pasta + sugo",kcal:370,prot:11},
      apro:  {piatto:"80g pasta apr. + sugo senza sale",kcal:400,prot:2},
      neo:   {piatto:"40g pastina + sugo passato",kcal:130,prot:3},
    },
    procedimento:"Soffriggi aglio in olio EVO. Aggiungi pomodori tagliati e cuoci 15 min. Sala, aggiungi basilico. Scola la pasta al dente e manteca nel sugo.",
    note:"Per aproteico usa pasta speciale senza glutine aproteica. Per neonato frulla il sugo.",
    tag:["veloce","vegetariano","classico"]
  },
  {
    id:"r002", titolo:"Risotto zucchine e fiori", categoria:"Primo",
    emoji:"?", tempo:"30 min", difficolta:"Media", stagione:["estate"],
    img:"https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=400&q=80",
    ingredienti:[
      {nome:"Riso Carnaroli",qty:"320g"},{nome:"Zucchine",qty:"3"},
      {nome:"Fiori di zucca",qty:"8"},{nome:"Cipolla",qty:"1"},
      {nome:"Vino bianco",qty:"1/2 bicchiere"},{nome:"Brodo vegetale",qty:"1.2L"},
      {nome:"Parmigiano",qty:"50g"},{nome:"Burro",qty:"30g"}
    ],
    porzioni:{
      adulta:{piatto:"70g riso + zucchine + fiori",kcal:345,prot:11},
      adulto:{piatto:"90g riso + zucchine + fiori",kcal:430,prot:14},
      bimbo: {piatto:"75g riso + zucchine",kcal:360,prot:11},
      apro:  {piatto:"80g riso apr. + zucchine + 1c olio",kcal:395,prot:2},
      neo:   {piatto:"40g riso + zucchine schiacciate",kcal:145,prot:3},
    },
    procedimento:"Soffriggi cipolla, tosta il riso, sfuma col vino. Aggiungi brodo poco a poco mescolando. A meta cottura aggiungi zucchine. Manteca con burro e parmigiano. Guarnisci con fiori.",
    note:"Per aproteico usa riso normale senza mantecatura col parmigiano.",
    tag:["estivo","vegetariano","cremoso"]
  },
  {
    id:"r003", titolo:"Pasta al forno", categoria:"Primo",
    emoji:"?", tempo:"60 min", difficolta:"Media", stagione:["autunno","inverno"],
    img:"https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400&q=80",
    ingredienti:[
      {nome:"Rigatoni",qty:"400g"},{nome:"Passata di pomodoro",qty:"500ml"},
      {nome:"Carne macinata",qty:"300g"},{nome:"Mozzarella",qty:"200g"},
      {nome:"Parmigiano",qty:"80g"},{nome:"Cipolla",qty:"1"},
      {nome:"Olio EVO",qty:"3 cucchiai"}
    ],
    porzioni:{
      adulta:{piatto:"Porzione media 200g",kcal:420,prot:24},
      adulto:{piatto:"Porzione abbondante 260g",kcal:530,prot:30},
      bimbo: {piatto:"Porzione piccola 180g",kcal:375,prot:21},
      apro:  {piatto:"Pasta apr. in bianco con pomodoro, no carne no formaggio",kcal:380,prot:2},
      neo:   {piatto:"Pastina con sugo passato, no carne",kcal:120,prot:3},
    },
    procedimento:"Prepara il ragu con cipolla, carne e passata. Cuoci la pasta al dente. Assembla a strati: pasta, ragu, mozzarella, parmigiano. Forno 180 gradi per 25 minuti.",
    note:"Prepara la sera prima, il giorno dopo e ancora piu buona.",
    tag:["famiglia","forno","comfort"]
  },
  {
    id:"r004", titolo:"Spaghetti alla carbonara", categoria:"Primo",
    emoji:"?", tempo:"25 min", difficolta:"Media", stagione:["tutto l anno"],
    img:"https://images.unsplash.com/photo-1612874742237-6526221588e3?w=400&q=80",
    ingredienti:[
      {nome:"Spaghetti",qty:"320g"},{nome:"Guanciale",qty:"150g"},
      {nome:"Uova",qty:"4"},{nome:"Pecorino romano",qty:"80g"},
      {nome:"Pepe nero",qty:"q.b."}
    ],
    porzioni:{
      adulta:{piatto:"70g spaghetti + carbonara",kcal:480,prot:22},
      adulto:{piatto:"90g spaghetti + carbonara",kcal:590,prot:28},
      bimbo: {piatto:"80g spaghetti + carbonara ridotta",kcal:510,prot:22},
      apro:  {piatto:"Pasta apr. in bianco con solo tuorlo e olio",kcal:390,prot:3},
      neo:   {piatto:"Pastina con tuorlo d uovo cotto, no guanciale",kcal:130,prot:5},
    },
    procedimento:"Rosola il guanciale. Mescola tuorli con pecorino e pepe. Cuoci spaghetti, tieni l acqua. Manteca fuori dal fuoco con uova e guanciale. Aggiungi acqua se serve.",
    note:"Non far rapprendere le uova - fuoco spento prima di aggiungere il composto.",
    tag:["classico","veloce","romano"]
  },
  {
    id:"r005", titolo:"Pasta con salmone e zucchine", categoria:"Primo",
    emoji:"?", tempo:"25 min", difficolta:"Facile", stagione:["tutto l anno"],
    img:"https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=400&q=80",
    ingredienti:[
      {nome:"Pasta",qty:"320g"},{nome:"Salmone fresco",qty:"300g"},
      {nome:"Zucchine",qty:"2"},{nome:"Panna fresca",qty:"100ml"},
      {nome:"Cipolla",qty:"1/2"},{nome:"Aneto",qty:"q.b."},
      {nome:"Olio EVO",qty:"3 cucchiai"}
    ],
    porzioni:{
      adulta:{piatto:"70g pasta + 80g salmone + zucchine",kcal:420,prot:28},
      adulto:{piatto:"90g pasta + 100g salmone + zucchine",kcal:520,prot:35},
      bimbo: {piatto:"80g pasta + 60g salmone + zucchine",kcal:400,prot:22},
      apro:  {piatto:"80g pasta apr. + zucchine + olio, no salmone",kcal:390,prot:2},
      neo:   {piatto:"40g pastina + salmone 30g schiacciato + zucchine",kcal:160,prot:9},
    },
    procedimento:"Soffriggi cipolla, aggiungi zucchine a rondelle. Aggiungi salmone a cubetti e cuoci 5 min. Aggiungi panna e riduci. Condisci la pasta e decora con aneto.",
    note:"Per il neonato spinare accuratamente il salmone. Omettere la panna per versione piu leggera.",
    tag:["pesce","cremoso","veloce"]
  },
  {
    id:"r006", titolo:"Risotto al pesto e gamberi", categoria:"Primo",
    emoji:"?", tempo:"35 min", difficolta:"Media", stagione:["estate","primavera"],
    img:"https://images.unsplash.com/photo-1665049330280-71b96a8beae5?w=400&q=80",
    ingredienti:[
      {nome:"Riso",qty:"320g"},{nome:"Gamberi",qty:"300g"},
      {nome:"Pesto genovese",qty:"4 cucchiai"},{nome:"Vino bianco",qty:"1/2 bicchiere"},
      {nome:"Brodo vegetale",qty:"1.2L"},{nome:"Cipolla",qty:"1"},
      {nome:"Olio EVO",qty:"3 cucchiai"}
    ],
    porzioni:{
      adulta:{piatto:"70g riso + gamberi + pesto",kcal:380,prot:22},
      adulto:{piatto:"90g riso + gamberi + pesto",kcal:470,prot:28},
      bimbo: {piatto:"75g riso + pesto, pochi gamberi",kcal:360,prot:14},
      apro:  {piatto:"80g riso apr. + pesto senza parmigiano",kcal:390,prot:3},
      neo:   {piatto:"No gamberi sotto 12m. 40g riso con pesto diluito",kcal:140,prot:3},
    },
    procedimento:"Soffriggi cipolla, tosta riso, sfuma col vino. Cuoci con brodo. A fine cottura aggiungi gamberi saltati e pesto. Manteca senza burro.",
    note:"No gamberi per neonati. Per aproteico pesto senza parmigiano.",
    tag:["pesce","estivo","elegante"]
  },

  // ── SECONDI ───────────────────────────────────────────────
  {
    id:"r007", titolo:"Pollo al limone con erbe", categoria:"Secondo",
    emoji:"?", tempo:"45 min", difficolta:"Facile", stagione:["tutto l anno"],
    img:"https://images.unsplash.com/photo-1598103442097-8b74394b95c2?w=400&q=80",
    ingredienti:[
      {nome:"Cosce di pollo",qty:"4"},{nome:"Limoni",qty:"2"},
      {nome:"Aglio",qty:"3 spicchi"},{nome:"Rosmarino",qty:"2 rametti"},
      {nome:"Olio EVO",qty:"4 cucchiai"},{nome:"Sale e pepe",qty:"q.b."}
    ],
    porzioni:{
      adulta:{piatto:"1 coscia + contorno verdure",kcal:280,prot:30},
      adulto:{piatto:"2 cosce + contorno verdure",kcal:430,prot:48},
      bimbo: {piatto:"1 coscia disossata + patate",kcal:300,prot:28},
      apro:  {piatto:"Solo verdure e patate al limone, no pollo",kcal:250,prot:3},
      neo:   {piatto:"30g pollo tritato + verdure frullate",kcal:110,prot:8},
    },
    procedimento:"Marina il pollo con limone, aglio, rosmarino e olio per 30 min. Cuoci in forno a 200 gradi per 35-40 min girando a meta cottura.",
    note:"Marinare la sera prima per piu sapore. Per neonato usa solo petto senza pelle.",
    tag:["classico","forno","facile"]
  },
  {
    id:"r008", titolo:"Salmone al forno con patate", categoria:"Secondo",
    emoji:"?", tempo:"35 min", difficolta:"Facile", stagione:["tutto l anno"],
    img:"https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&q=80",
    ingredienti:[
      {nome:"Trancio salmone",qty:"4 x 150g"},{nome:"Patate",qty:"600g"},
      {nome:"Limone",qty:"1"},{nome:"Aneto",qty:"q.b."},
      {nome:"Olio EVO",qty:"4 cucchiai"},{nome:"Aglio",qty:"2 spicchi"}
    ],
    porzioni:{
      adulta:{piatto:"120g salmone + 150g patate",kcal:360,prot:28},
      adulto:{piatto:"150g salmone + 200g patate",kcal:450,prot:35},
      bimbo: {piatto:"80g salmone + 150g patate",kcal:310,prot:20},
      apro:  {piatto:"200g patate al forno + aneto + olio",kcal:280,prot:3},
      neo:   {piatto:"50g salmone spinato + 50g patate schiacciate",kcal:160,prot:9},
    },
    procedimento:"Preriscalda forno 200 gradi. Cuoci patate a cubetti 15 min. Aggiungi tranci di salmone, limone e aneto. Cuoci altri 15-18 min.",
    note:"Spinare con cura per neonato. Per aproteico sostituire salmone con piu patate e verdure.",
    tag:["pesce","forno","sano"]
  },
  {
    id:"r009", titolo:"Polpette di tacchino al sugo", categoria:"Secondo",
    emoji:"?", tempo:"40 min", difficolta:"Facile", stagione:["tutto l anno"],
    img:"https://images.unsplash.com/photo-1529042410759-befb1204b468?w=400&q=80",
    ingredienti:[
      {nome:"Macinato di tacchino",qty:"500g"},{nome:"Pane raffermo",qty:"2 fette"},
      {nome:"Uovo",qty:"1"},{nome:"Parmigiano",qty:"30g"},
      {nome:"Passata pomodoro",qty:"400ml"},{nome:"Cipolla",qty:"1"},
      {nome:"Olio EVO",qty:"3 cucchiai"}
    ],
    porzioni:{
      adulta:{piatto:"3 polpette + sugo",kcal:310,prot:28},
      adulto:{piatto:"4 polpette + sugo",kcal:400,prot:36},
      bimbo: {piatto:"3 polpette piccole + sugo",kcal:290,prot:26},
      apro:  {piatto:"Solo sugo di pomodoro + pane apr.",kcal:180,prot:2},
      neo:   {piatto:"1 polpetta schiacciata + sugo passato",kcal:90,prot:8},
    },
    procedimento:"Mescola tacchino, pane ammollato, uovo, parmigiano. Forma palline. Rosola in padella. Copri con sugo e cuoci 20 min a fuoco lento.",
    note:"Per aproteico omettere le polpette. Per neonato no sale e schiaccia bene.",
    tag:["famiglia","comfort","economico"]
  },
  {
    id:"r010", titolo:"Branzino al cartoccio", categoria:"Secondo",
    emoji:"?", tempo:"30 min", difficolta:"Facile", stagione:["estate","primavera"],
    img:"https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&q=80",
    ingredienti:[
      {nome:"Branzino",qty:"2 da 400g"},{nome:"Pomodorini",qty:"200g"},
      {nome:"Olive",qty:"50g"},{nome:"Capperi",qty:"1 cucchiaio"},
      {nome:"Limone",qty:"1"},{nome:"Prezzemolo",qty:"q.b."},
      {nome:"Olio EVO",qty:"4 cucchiai"}
    ],
    porzioni:{
      adulta:{piatto:"200g branzino + pomodorini",kcal:240,prot:30},
      adulto:{piatto:"250g branzino + pomodorini",kcal:300,prot:38},
      bimbo: {piatto:"120g branzino + pomodorini",kcal:180,prot:22},
      apro:  {piatto:"Patate al cartoccio + pomodorini + olio",kcal:220,prot:3},
      neo:   {piatto:"60g branzino spinato + succo limone",kcal:90,prot:10},
    },
    procedimento:"Crea cartocci di carta forno. Adagia branzino, aggiungi pomodorini, olive, capperi, limone. Chiudi bene. Forno 200 gradi per 20-25 min.",
    note:"Spinare accuratamente per bambini. Per aproteico cartoccio solo verdure.",
    tag:["pesce","forno","leggero"]
  },
  {
    id:"r011", titolo:"Hamburger di manzo fatto in casa", categoria:"Secondo",
    emoji:"?", tempo:"20 min", difficolta:"Facile", stagione:["tutto l anno"],
    img:"https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80",
    ingredienti:[
      {nome:"Macinato manzo",qty:"500g"},{nome:"Panino hamburger",qty:"4"},
      {nome:"Lattuga",qty:"4 foglie"},{nome:"Pomodoro",qty:"2"},
      {nome:"Cipolla",qty:"1"},{nome:"Formaggio",qty:"4 fette"},
      {nome:"Senape e ketchup",qty:"q.b."}
    ],
    porzioni:{
      adulta:{piatto:"1 hamburger 120g + verdure, no formaggio",kcal:420,prot:30},
      adulto:{piatto:"1 hamburger 150g + formaggio",kcal:550,prot:38},
      bimbo: {piatto:"1 hamburger 100g + pane + pomodoro",kcal:400,prot:25},
      apro:  {piatto:"Solo il panino con pomodoro e lattuga",kcal:250,prot:6},
      neo:   {piatto:"30g manzo ben cotto schiacciato + verdure",kcal:100,prot:8},
    },
    procedimento:"Mescola la carne con sale e pepe. Forma dischi da 150g. Cuoci 3-4 min per lato su griglia bollente. Assembla nel panino con verdure.",
    note:"Per neonato no condimenti. Per aproteico solo parte vegetale.",
    tag:["famiglia","veloce","bambini"]
  },
  {
    id:"r012", titolo:"Tacchino ripieno al forno", categoria:"Secondo",
    emoji:"?", tempo:"120 min", difficolta:"Difficile", stagione:["autunno","inverno"],
    img:"https://images.unsplash.com/photo-1574672280600-4accfa5b6f98?w=400&q=80",
    ingredienti:[
      {nome:"Petto di tacchino intero",qty:"1kg"},{nome:"Prosciutto cotto",qty:"100g"},
      {nome:"Spinaci",qty:"200g"},{nome:"Ricotta",qty:"150g"},
      {nome:"Parmigiano",qty:"40g"},{nome:"Rosmarino e salvia",qty:"q.b."},
      {nome:"Olio EVO",qty:"4 cucchiai"}
    ],
    porzioni:{
      adulta:{piatto:"150g tacchino + farcia",kcal:310,prot:38},
      adulto:{piatto:"200g tacchino + farcia",kcal:410,prot:50},
      bimbo: {piatto:"120g tacchino senza prosciutto",kcal:260,prot:32},
      apro:  {piatto:"Solo spinaci e ricotta al forno",kcal:180,prot:8},
      neo:   {piatto:"40g tacchino frullato + spinaci",kcal:120,prot:10},
    },
    procedimento:"Apri il petto a libro. Farcisci con spinaci saltati, ricotta, parmigiano, prosciutto. Arrotola e lega. Rosola e cuoci in forno 180 gradi per 70-80 min.",
    note:"Per aproteico omettere il tacchino e servire solo il ripieno di verdure.",
    tag:["festivo","forno","elegante"]
  },

  // ── CONTORNI / VERDURE ───────────────────────────────────
  {
    id:"r013", titolo:"Caponata siciliana", categoria:"Contorno",
    emoji:"?", tempo:"45 min", difficolta:"Media", stagione:["estate"],
    img:"https://images.unsplash.com/photo-1596997000103-e597b3ca3ce4?w=400&q=80",
    ingredienti:[
      {nome:"Melanzane",qty:"3"},{nome:"Pomodori pelati",qty:"400g"},
      {nome:"Sedano",qty:"3 coste"},{nome:"Olive verdi",qty:"80g"},
      {nome:"Capperi",qty:"2 cucchiai"},{nome:"Aceto di vino",qty:"3 cucchiai"},
      {nome:"Zucchero",qty:"1 cucchiaio"},{nome:"Olio EVO",qty:"6 cucchiai"}
    ],
    porzioni:{
      adulta:{piatto:"Porzione abbondante come contorno",kcal:180,prot:3},
      adulto:{piatto:"Porzione abbondante come contorno",kcal:200,prot:3},
      bimbo: {piatto:"Porzione piccola, no capperi e olive",kcal:120,prot:2},
      apro:  {piatto:"Porzione abbondante, ottimo per calorie",kcal:220,prot:3},
      neo:   {piatto:"Solo melanzane e pomodoro frullati, no sale",kcal:60,prot:1},
    },
    procedimento:"Friggi melanzane a cubetti. In padella rosola sedano, aggiungi pomodori, olive, capperi. Aggiungi aceto e zucchero. Unisci melanzane e cuoci 15 min.",
    note:"Ottima fredda il giorno dopo. Per bambini piccoli ometti capperi e olive.",
    tag:["siciliana","vegetariano","preparabile"]
  },
  {
    id:"r014", titolo:"Insalata di pomodori e mozzarella", categoria:"Contorno",
    emoji:"?", tempo:"10 min", difficolta:"Facile", stagione:["estate"],
    img:"https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&q=80",
    ingredienti:[
      {nome:"Pomodori cuore di bue",qty:"4"},{nome:"Mozzarella",qty:"250g"},
      {nome:"Basilico",qty:"q.b."},{nome:"Olio EVO",qty:"4 cucchiai"},
      {nome:"Sale e pepe",qty:"q.b."}
    ],
    porzioni:{
      adulta:{piatto:"2-3 fette + 60g mozzarella",kcal:220,prot:12},
      adulto:{piatto:"3-4 fette + 80g mozzarella",kcal:290,prot:16},
      bimbo: {piatto:"2 fette + 50g mozzarella",kcal:190,prot:10},
      apro:  {piatto:"Solo pomodori con olio e basilico",kcal:90,prot:1},
      neo:   {piatto:"Pomodoro maturo passato con olio",kcal:40,prot:1},
    },
    procedimento:"Affetta pomodori e mozzarella. Alterna su piatto. Condisci con olio, sale, pepe e basilico. Servi subito.",
    note:"Per aproteico omettere la mozzarella.",
    tag:["estivo","no cottura","veloce"]
  },
  {
    id:"r015", titolo:"Verdure grigliate miste", categoria:"Contorno",
    emoji:"?", tempo:"25 min", difficolta:"Facile", stagione:["estate","primavera"],
    img:"https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&q=80",
    ingredienti:[
      {nome:"Zucchine",qty:"3"},{nome:"Peperoni",qty:"2"},
      {nome:"Melanzane",qty:"2"},{nome:"Cipolla rossa",qty:"2"},
      {nome:"Olio EVO",qty:"5 cucchiai"},{nome:"Erbe aromatiche",qty:"q.b."}
    ],
    porzioni:{
      adulta:{piatto:"Porzione abbondante mista",kcal:140,prot:3},
      adulto:{piatto:"Porzione abbondante mista",kcal:160,prot:3},
      bimbo: {piatto:"Zucchine e peperoni, no cipolla",kcal:100,prot:2},
      apro:  {piatto:"Porzione molto abbondante + olio extra",kcal:200,prot:3},
      neo:   {piatto:"Zucchine e carote grigliate schiacciate, no sale",kcal:50,prot:1},
    },
    procedimento:"Taglia verdure a fette. Griglia su piastra rovente 3-4 min per lato. Condisci con olio, aglio ed erbe. Servi tiepide o a temperatura ambiente.",
    note:"Per aproteico aggiungere piu olio per aumentare le calorie.",
    tag:["estivo","vegetariano","leggero"]
  },

  // ── ZUPPE E MINESTRE ─────────────────────────────────────
  {
    id:"r016", titolo:"Minestrone di verdure", categoria:"Zuppa",
    emoji:"?", tempo:"45 min", difficolta:"Facile", stagione:["autunno","inverno"],
    img:"https://images.unsplash.com/photo-1547592180-85f173990554?w=400&q=80",
    ingredienti:[
      {nome:"Patate",qty:"3"},{nome:"Carote",qty:"3"},
      {nome:"Zucchine",qty:"2"},{nome:"Pomodori",qty:"2"},
      {nome:"Sedano",qty:"2 coste"},{nome:"Fagioli borlotti",qty:"200g"},
      {nome:"Pasta corta",qty:"100g"},{nome:"Olio EVO",qty:"4 cucchiai"}
    ],
    porzioni:{
      adulta:{piatto:"Piatto fondo abbondante",kcal:280,prot:10},
      adulto:{piatto:"Piatto fondo abbondante",kcal:320,prot:12},
      bimbo: {piatto:"Piatto fondo, pasta in piu",kcal:290,prot:10},
      apro:  {piatto:"Minestrone senza fagioli + pasta apr.",kcal:300,prot:3},
      neo:   {piatto:"Verdure passate senza sale + pastina",kcal:120,prot:3},
    },
    procedimento:"Soffriggi cipolla in olio. Aggiungi verdure a cubetti e copri con acqua. Cuoci 20 min. Aggiungi fagioli e pasta negli ultimi 10 min. Servi con olio a crudo.",
    note:"Per aproteico usare pasta aproteica e omettere i fagioli.",
    tag:["invernale","vegetariano","famiglia"]
  },
  {
    id:"r017", titolo:"Zuppa di lenticchie rosse", categoria:"Zuppa",
    emoji:"?", tempo:"35 min", difficolta:"Facile", stagione:["autunno","inverno"],
    img:"https://images.unsplash.com/photo-1547592180-85f173990554?w=400&q=80",
    ingredienti:[
      {nome:"Lenticchie rosse",qty:"300g"},{nome:"Carote",qty:"2"},
      {nome:"Cipolla",qty:"1"},{nome:"Pomodori pelati",qty:"200g"},
      {nome:"Curcuma",qty:"1 cucchiaino"},{nome:"Cumino",qty:"q.b."},
      {nome:"Olio EVO",qty:"3 cucchiai"}
    ],
    porzioni:{
      adulta:{piatto:"Piatto fondo",kcal:290,prot:18},
      adulto:{piatto:"Piatto fondo abbondante",kcal:360,prot:22},
      bimbo: {piatto:"Piatto fondo + pane",kcal:310,prot:18},
      apro:  {piatto:"Solo brodo di verdure con carote, no lenticchie",kcal:80,prot:1},
      neo:   {piatto:"Lenticchie rosse passate (digeribili) no sale",kcal:100,prot:6},
    },
    procedimento:"Soffriggi cipolla con spezie. Aggiungi carote e lenticchie lavate. Copri con brodo e cuoci 25 min. Frulla meta zuppa per cremosita. Aggiungi pomodori.",
    note:"Le lenticchie rosse sono le piu digeribili per i bambini. Per aproteico omettere.",
    tag:["invernale","legumi","economico"]
  },

  // ── INSALATE PASTO ───────────────────────────────────────
  {
    id:"r018", titolo:"Insalata di farro con verdure estive", categoria:"Piatto unico",
    emoji:"?", tempo:"35 min", difficolta:"Facile", stagione:["estate"],
    img:"https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80",
    ingredienti:[
      {nome:"Farro perlato",qty:"320g"},{nome:"Zucchine",qty:"2"},
      {nome:"Peperoni",qty:"1"},{nome:"Pomodorini",qty:"200g"},
      {nome:"Rucola",qty:"80g"},{nome:"Feta",qty:"100g"},
      {nome:"Olio EVO",qty:"5 cucchiai"}
    ],
    porzioni:{
      adulta:{piatto:"Piatto abbondante 300g",kcal:370,prot:14},
      adulto:{piatto:"Piatto abbondante 380g",kcal:450,prot:17},
      bimbo: {piatto:"Piatto 250g, no feta",kcal:310,prot:10},
      apro:  {piatto:"Riso apr. con verdure grigliate + olio",kcal:380,prot:3},
      neo:   {piatto:"Farro passato con verdure 80g",kcal:130,prot:4},
    },
    procedimento:"Cuoci farro in acqua salata 25 min. Griglia zucchine e peperoni. Mescola tutto con pomodorini, rucola, feta sbriciolata e olio.",
    note:"Si prepara in anticipo, ottima anche il giorno dopo.",
    tag:["estivo","preparabile","vegetariano"]
  },
  {
    id:"r019", titolo:"Bowl di riso con pollo teriyaki", categoria:"Piatto unico",
    emoji:"?", tempo:"30 min", difficolta:"Facile", stagione:["tutto l anno"],
    img:"https://images.unsplash.com/photo-1547592180-85f173990554?w=400&q=80",
    ingredienti:[
      {nome:"Riso",qty:"320g"},{nome:"Petto di pollo",qty:"400g"},
      {nome:"Salsa di soia",qty:"3 cucchiai"},{nome:"Miele",qty:"2 cucchiai"},
      {nome:"Zenzero",qty:"q.b."},{nome:"Edamame",qty:"100g"},
      {nome:"Avocado",qty:"1"},{nome:"Carote",qty:"2"}
    ],
    porzioni:{
      adulta:{piatto:"Bowl con 70g riso + 90g pollo",kcal:420,prot:32},
      adulto:{piatto:"Bowl con 90g riso + 120g pollo",kcal:530,prot:42},
      bimbo: {piatto:"Bowl con 80g riso + 80g pollo, no salsa",kcal:400,prot:28},
      apro:  {piatto:"Bowl di riso apr. con carote + avocado",kcal:410,prot:4},
      neo:   {piatto:"Riso + carote cotte + pollo frullato",kcal:150,prot:9},
    },
    procedimento:"Cuoci riso. Marina pollo in salsa soia, miele, zenzero. Cuoci in padella. Assembla bowl con riso, pollo, edamame, avocado, carote julienne.",
    note:"Per neonato no salsa soia (troppo sodio). Per aproteico usa riso apr.",
    tag:["fusion","sano","colorato"]
  },

  // ── DOLCI / COLAZIONI ────────────────────────────────────
  {
    id:"r020", titolo:"Pancakes integrali con frutti rossi", categoria:"Colazione",
    emoji:"?", tempo:"20 min", difficolta:"Facile", stagione:["tutto l anno"],
    img:"https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=400&q=80",
    ingredienti:[
      {nome:"Farina integrale",qty:"200g"},{nome:"Latte",qty:"250ml"},
      {nome:"Uova",qty:"2"},{nome:"Miele",qty:"2 cucchiai"},
      {nome:"Lievito",qty:"1 cucchiaino"},{nome:"Frutti rossi misti",qty:"200g"},
      {nome:"Yogurt greco",qty:"100g"}
    ],
    porzioni:{
      adulta:{piatto:"3 pancakes + frutti rossi + yogurt",kcal:320,prot:14},
      adulto:{piatto:"4 pancakes + frutti rossi + yogurt",kcal:400,prot:18},
      bimbo: {piatto:"3 pancakes + frutti rossi",kcal:280,prot:12},
      apro:  {piatto:"2 pancakes apr. + frutti rossi + miele",kcal:350,prot:3},
      neo:   {piatto:"1 pancake morbido + purea fragole",kcal:100,prot:4},
    },
    procedimento:"Mescola farina, uova, latte, miele, lievito. Cuoci cucchiaiate su padella antiaderente. Servi con frutti rossi e yogurt.",
    note:"Per neonato no miele sotto 12 mesi.",
    tag:["colazione","veloce","bambini"]
  },
  {
    id:"r021", titolo:"Torta di mele e cannella", categoria:"Dolce",
    emoji:"?", tempo:"60 min", difficolta:"Facile", stagione:["autunno","inverno"],
    img:"https://images.unsplash.com/photo-1568571780765-9276ac8b75a2?w=400&q=80",
    ingredienti:[
      {nome:"Mele",qty:"4"},{nome:"Farina",qty:"250g"},
      {nome:"Uova",qty:"3"},{nome:"Zucchero",qty:"150g"},
      {nome:"Olio di semi",qty:"100ml"},{nome:"Cannella",qty:"1 cucchiaino"},
      {nome:"Lievito",qty:"1 bustina"}
    ],
    porzioni:{
      adulta:{piatto:"1 fetta media",kcal:280,prot:5},
      adulto:{piatto:"1 fetta abbondante",kcal:340,prot:6},
      bimbo: {piatto:"1 fetta piccola",kcal:240,prot:4},
      apro:  {piatto:"1 fetta con farina apr.",kcal:290,prot:2},
      neo:   {piatto:"Piccolo pezzo morbido senza zucchero",kcal:80,prot:2},
    },
    procedimento:"Mescola uova e zucchero. Aggiungi olio, farina, lievito, cannella. Incorpora mele a cubetti. Versa in stampo e cuoci 180 gradi per 45 min.",
    note:"Per neonato prepara versione senza zucchero con miele (no sotto 12 mesi).",
    tag:["dolce","autunnale","famiglia"]
  },
  {
    id:"r022", titolo:"Panna cotta ai frutti di bosco", categoria:"Dolce",
    emoji:"?", tempo:"20 min + 2h riposo", difficolta:"Facile", stagione:["tutto l anno"],
    img:"https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&q=80",
    ingredienti:[
      {nome:"Panna fresca",qty:"500ml"},{nome:"Zucchero",qty:"80g"},
      {nome:"Gelatina",qty:"8g"},{nome:"Vaniglia",qty:"1 baccello"},
      {nome:"Frutti di bosco misti",qty:"300g"}
    ],
    porzioni:{
      adulta:{piatto:"1 stampino + frutti bosco",kcal:280,prot:3},
      adulto:{piatto:"1 stampino abbondante",kcal:320,prot:3},
      bimbo: {piatto:"1 stampino piccolo",kcal:230,prot:3},
      apro:  {piatto:"Solo coulis di frutti di bosco con yogurt apr.",kcal:120,prot:1},
      neo:   {piatto:"Purea di frutti di bosco",kcal:50,prot:1},
    },
    procedimento:"Scalda panna con zucchero e vaniglia. Sciogli gelatina ammollata. Versa in stampini e raffredda 2 ore. Servi con coulis di frutti di bosco.",
    note:"Per aproteico la panna cotta e troppo proteica, servire solo i frutti.",
    tag:["dolce","elegante","no forno"]
  },

  // ── PIATTI UNICI VELOCI ──────────────────────────────────
  {
    id:"r023", titolo:"Frittata di verdure al forno", categoria:"Piatto unico",
    emoji:"?", tempo:"30 min", difficolta:"Facile", stagione:["tutto l anno"],
    img:"https://images.unsplash.com/photo-1614957004131-9e8f2b1a2aba?w=400&q=80",
    ingredienti:[
      {nome:"Uova",qty:"6"},{nome:"Zucchine",qty:"2"},
      {nome:"Peperoni",qty:"1"},{nome:"Cipolla",qty:"1"},
      {nome:"Parmigiano",qty:"40g"},{nome:"Olio EVO",qty:"3 cucchiai"},
      {nome:"Sale e pepe",qty:"q.b."}
    ],
    porzioni:{
      adulta:{piatto:"2 fette + insalata",kcal:260,prot:18},
      adulto:{piatto:"3 fette + insalata",kcal:380,prot:27},
      bimbo: {piatto:"2 fette + pane",kcal:280,prot:18},
      apro:  {piatto:"Solo verdure al forno senza uova",kcal:120,prot:2},
      neo:   {piatto:"1 fetta piccola schiacciata (da 10 mesi)",kcal:90,prot:6},
    },
    procedimento:"Soffriggi verdure. Sbatti uova con parmigiano, sale, pepe. Mescola con verdure. Versa in teglia e cuoci 180 gradi per 20 min.",
    note:"Ottima fredda. Per aproteico servire solo le verdure.",
    tag:["veloce","economico","versatile"]
  },
  {
    id:"r024", titolo:"Poke bowl salmone e avocado", categoria:"Piatto unico",
    emoji:"?", tempo:"20 min", difficolta:"Facile", stagione:["estate","primavera"],
    img:"https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80",
    ingredienti:[
      {nome:"Riso per sushi",qty:"320g"},{nome:"Salmone fresco",qty:"300g"},
      {nome:"Avocado",qty:"2"},{nome:"Edamame",qty:"100g"},
      {nome:"Carote",qty:"2"},{nome:"Sesamo",qty:"2 cucchiai"},
      {nome:"Salsa di soia",qty:"3 cucchiai"}
    ],
    porzioni:{
      adulta:{piatto:"Bowl con 70g riso + 80g salmone",kcal:440,prot:28},
      adulto:{piatto:"Bowl con 90g riso + 100g salmone",kcal:540,prot:35},
      bimbo: {piatto:"Bowl con 80g riso + 60g salmone, no salsa soia",kcal:400,prot:22},
      apro:  {piatto:"Bowl con riso apr. + avocado + carote",kcal:420,prot:4},
      neo:   {piatto:"No crudo per neonati. Salmone cotto + riso",kcal:150,prot:9},
    },
    procedimento:"Cuoci e raffredda riso. Taglia salmone a cubetti. Assembla bowl con riso, salmone, avocado, edamame, carote. Condisci con salsa soia e sesamo.",
    note:"Per neonato cuocere il salmone. Per aproteico riso speciale.",
    tag:["fusion","estivo","sano"]
  },

];

const RICETTE_ESTATE = [
  {titolo:"Pasta fredda con tonno e olive",emoji:"?",categoria:"Primo",descrizione:"Pasta fredda con tonno, olive e pomodorini. Si prepara in anticipo.",tempo:"20 min",tag:["estivo","veloce","preparabile"]},
  {titolo:"Insalata di farro con verdure grigliate",emoji:"?",categoria:"Piatto unico",descrizione:"Farro con zucchine, peperoni e melanzane grigliate, olio EVO e basilico.",tempo:"35 min",tag:["estivo","vegetariano","sano"]},
  {titolo:"Pollo al limone con patate novelle",emoji:"?",categoria:"Secondo",descrizione:"Pollo marinato al limone con patate novelle al forno. Leggero e profumato.",tempo:"50 min",tag:["classico","famiglia","forno"]},
  {titolo:"Risotto con zucchine e fiori",emoji:"?",categoria:"Primo",descrizione:"Risotto cremoso con zucchine fresche e fiori di zucca.",tempo:"30 min",tag:["estivo","vegetariano","classico"]},
  {titolo:"Branzino al cartoccio",emoji:"?",categoria:"Secondo",descrizione:"Branzino con erbe aromatiche, limone e pomodorini. Leggero e sano.",tempo:"30 min",tag:["pesce","sano","estivo"]},
  {titolo:"Panzanella toscana",emoji:"?",categoria:"Contorno",descrizione:"Pane raffermo con pomodori, cipolla rossa, basilico e aceto. Zero sprechi.",tempo:"15 min",tag:["estivo","no cottura","tradizionale"]},
  {titolo:"Melanzane alla parmigiana",emoji:"?",categoria:"Secondo",descrizione:"Melanzane fritte a strati con pomodoro, mozzarella e parmigiano.",tempo:"60 min",tag:["classico","famiglia","forno"]},
  {titolo:"Insalata di polpo e patate",emoji:"?",categoria:"Secondo",descrizione:"Polpo tenero con patate lesse, prezzemolo e olio EVO. Fresco e saporito.",tempo:"45 min",tag:["pesce","estivo","classico"]},
];

function TabIdee({profili, dispensa}) {
  const [vista, setVista] = useState("live");
  const [ricette, setRicette] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [aggiornato, setAggiornato] = useState(null);
  const [adattata, setAdattata] = useState(null);
  const [loadAdatta, setLoadAdatta] = useState(false);
  const [ricAperta, setRicAperta] = useState(null);
  const [selIng, setSelIng] = useState([]);
  const [ricSvuota, setRicSvuota] = useState(null);
  const [loadSvuota, setLoadSvuota] = useState(false);

  // Instagram
  const [pagine, setPagine] = useState([
    {id:"p1", nome:"Giallo Zafferano", handle:"giallozafferano", url:"https://www.instagram.com/giallozafferano/"},
    {id:"p2", nome:"Fatto in Casa da Benedetta", handle:"fattoincasadabenedetta", url:"https://www.instagram.com/fattoincasadabenedetta/"},
  ]);
  const [ricetteIG, setRicetteIG] = useState([]);
  const [showAddPagina, setShowAddPagina] = useState(false);
  const [showAddRicetta, setShowAddRicetta] = useState(false);
  const [nuovaPagina, setNuovaPagina] = useState({nome:"", handle:""});
  const [nuovaRicetta, setNuovaRicetta] = useState({
    titolo:"", fonte:"", note:"", ingredienti:"", foto:null
  });
  const [filtroFonte, setFiltroFonte] = useState("tutte");

  const caricaLive = () => {
    setLoading(true); setErr(null);
    setTimeout(() => {
      // Filtra per stagione corrente e mescola
      const mese = new Date().getMonth();
      const stagione = mese>=2&&mese<=4?"primavera":mese>=5&&mese<=7?"estate":
                       mese>=8&&mese<=10?"autunno":"inverno";
      const filtrate = DB_RICETTE.filter(r=>
        r.stagione.includes(stagione)||r.stagione.includes("tutto l anno")
      );
      const shuffled = [...filtrate].sort(()=>Math.random()-0.5).slice(0,8);
      setRicette(shuffled);
      setAggiornato(new Date().toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"}));
      setLoading(false);
    }, 400);
  };

  const adatta = (ric) => {
    setRicAperta(ric); setAdattata(null); setLoadAdatta(true);
    const apro = Object.values(profili).find(p=>p.patologia==="ipoproteica");
    const neo  = Object.values(profili).find(p=>p.patologia==="svezzamento");
    setTimeout(()=>{
      setAdattata({
        base: ric.titolo+" - prepara la base comune per tutti",
        adulti: "Porzione standard con tutti gli ingredienti originali",
        bimbo: "Porzione ridotta, riduci sale e spezie",
        apro: apro
          ? "Per "+apro.nome+": usa solo la parte vegetale/carboidratica, max "+apro.prot_max+"g proteine totali"
          : "Versione ridotta in proteine",
        neo: neo
          ? "Per "+neo.nome+": ingredienti frullati o schiacciati, zero sale, zero miele"
          : "Versione frullata senza sale",
        note: "Adatta le porzioni alle esigenze di ciascuno. Separa prima di aggiungere condimenti."
      });
      setLoadAdatta(false);
    }, 300);
  };

  const toggleIng = (nome) => setSelIng(prev =>
    prev.includes(nome) ? prev.filter(x=>x!==nome) : [...prev, nome]
  );

  const svuota = () => {
    if(!selIng.length) return;
    setLoadSvuota(true); setRicSvuota(null);

    // Genera ricette localmente in base agli ingredienti selezionati
    const ing = selIng.map(s=>s.toLowerCase());

    const haProteina = ing.some(i=>
      ["pollo","tacchino","manzo","maiale","uova","uova","pesce","merluzzo",
       "salmone","tonno","ceci","lenticchie","fagioli","mozzarella"].includes(i));
    const haCarbo = ing.some(i=>
      ["pasta","riso","pane","patate","farro","orzo","polenta","cous cous"].includes(i));
    const haVerdura = ing.some(i=>
      ["zucchine","melanzane","peperoni","pomodori","spinaci","carote","broccoli",
       "fagiolini","cipolla","lattuga","insalata","bietola"].includes(i));

    const apro = Object.values(profili).find(p=>p.patologia==="ipoproteica");
    const neo  = Object.values(profili).find(p=>p.patologia==="svezzamento");
    const nomeApro = apro ? apro.nome : "Aproteico";
    const nomeNeo  = neo  ? neo.nome  : "Neonato";

    // Crea 3 ricette combinando gli ingredienti
    const ricette = [];
    const ingStr = selIng.join(", ");

    // Ricetta 1 - pasto principale
    ricette.push({
      titolo: "Piatto unico con "+selIng.slice(0,2).join(" e "),
      emoji: "?",
      tempo: "25 min",
      base: "Cuoci "+ingStr+" in padella con olio EVO, aglio e erbe aromatiche",
      adulti: haCarbo
        ? "Porzione abbondante con "+selIng[0]+" come base"
        : "Piatto proteico con "+ingStr+", contorno di pane",
      apro: haCarbo
        ? "Porzione normale senza condimenti proteici in eccesso"
        : "Solo la parte vegetale/carboidratica, senza proteine animali",
      neo: "Ingredienti frullati o schiacciati, no sale, porzione piccola",
      note: "Usa gli ingredienti in scadenza prima degli altri"
    });

    // Ricetta 2 - variante con cottura diversa
    if(haVerdura) {
      ricette.push({
        titolo: "Teglia mista al forno",
        emoji: "?",
        tempo: "35 min",
        base: "Disponi "+ingStr+" in teglia, condisci con olio EVO e rosmarino, forno 200 gradi per 25 min",
        adulti: "Porzione generosa dalla teglia",
        apro: "Abbondante parte vegetale, limita le proteine a "+nomeApro,
        neo: "Verdure ben cotte schiacciate, no sale",
        note: "Si conserva in frigo 2 giorni"
      });
    } else {
      ricette.push({
        titolo: "Pasta veloce con "+selIng[0],
        emoji: "?",
        tempo: "20 min",
        base: "Cuoci pasta, salta "+ingStr+" in padella con olio EVO",
        adulti: "80g pasta + condimento",
        apro: "Pasta aproteica con solo la parte vegetale del condimento",
        neo: "Pastina piccola, ingredienti ben cotti e schiacciati",
        note: "Aggiungi un filo di olio a crudo"
      });
    }

    // Ricetta 3 - salva-avanzi creativo
    ricette.push({
      titolo: "Frittata o torta salata con "+selIng.slice(-2).join(" e "),
      emoji: "?",
      tempo: "20 min",
      base: "Sbatti uova con "+ingStr+", cuoci in padella antiaderente o in forno",
      adulti: "2-3 fette con contorno di insalata",
      apro: "Porzione piccola di frittata, abbondante verdura cruda",
      neo: "Solo la parte vegetale cotta, no uovo intero se sotto 10 mesi",
      note: "Ottima fredda il giorno dopo"
    });

    setTimeout(()=>{
      setRicSvuota(ricette);
      setLoadSvuota(false);
    }, 400);
  };

  return (
    <div>
      <div style={{fontSize:14,fontWeight:800,color:"#2E5F8A",marginBottom:4}}>Idee e ispirazioni</div>
      <div style={{fontSize:10,color:"#888",marginBottom:12}}>Ricette, ispirazioni e pagine preferite</div>

      <div style={{display:"flex",gap:5,marginBottom:14,overflowX:"auto",paddingBottom:2}}>
        {[
          {id:"live",   l:"Stagione"},
          {id:"ig",     l:"Instagram ("+ricetteIG.length+")"},
          {id:"svuota", l:"Svuota dispensa"},
        ].map(v => (
          <button key={v.id} onClick={()=>setVista(v.id)}
            style={{flex:1,padding:"8px 6px",borderRadius:12,border:"none",cursor:"pointer",
              whiteSpace:"nowrap",
              background:vista===v.id?"#2E5F8A":"#fff",color:vista===v.id?"#fff":"#555",
              fontWeight:vista===v.id?700:400,fontSize:10,
              boxShadow:vista===v.id?"none":"0 1px 6px rgba(0,0,0,.07)"}}>
            {v.l}
          </button>
        ))}
      </div>

      {vista==="live" && (
        <div>
          <button onClick={caricaLive} disabled={loading}
            style={{width:"100%",padding:"11px",borderRadius:12,border:"none",
              background:loading?"#ccc":"linear-gradient(135deg,#0D1B2A,#2E5F8A)",
              color:"#fff",fontSize:12,fontWeight:700,cursor:loading?"wait":"pointer",
              marginBottom:12}}>
            {loading?"Claude cerca ricette...":aggiornato?"Aggiorna ("+aggiornato+")":"Carica ispirazioni di oggi"}
          </button>

          {err && <div style={{background:"#FDE8E4",borderRadius:12,padding:"8px 12px",
            fontSize:10,color:"#C0392B",marginBottom:10}}>{err}</div>}

          {!ricette.length && !loading && (
            <div style={{background:"#F5F8FC",borderRadius:14,padding:"24px",textAlign:"center"}}>
              <div style={{fontSize:20,marginBottom:8}}></div>
              <div style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:4}}>
                Premi per caricare le ricette di oggi
              </div>
              <div style={{fontSize:10,color:"#888"}}>
                Claude genera ricette stagionali aggiornate
              </div>
            </div>
          )}

          {ricette.map((ric,i) => (
            <div key={i} style={{background:"#fff",borderRadius:14,
              marginBottom:12,overflow:"hidden",
              boxShadow:ricAperta===ric
                ?"0 0 0 2px #2E5F8A,0 2px 10px rgba(0,0,0,.1)"
                :"0 1px 6px rgba(0,0,0,.07)"}}>
              {ric.img&&(
                <img src={ric.img} alt={ric.titolo}
                  style={{width:"100%",height:160,objectFit:"cover",display:"block"}}/>
              )}
              <div style={{padding:"12px 14px"}}>
                <div style={{fontSize:13,fontWeight:800,color:"#222",marginBottom:4}}>
                  {ric.emoji||""} {ric.titolo}
                </div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
                  {ric.categoria&&<span style={{fontSize:9,background:"#EBF3FA",color:"#2E5F8A",
                    fontWeight:700,padding:"2px 8px",borderRadius:20}}>{ric.categoria}</span>}
                  {ric.tempo&&<span style={{fontSize:9,background:"#f5f5f5",color:"#888",
                    padding:"2px 8px",borderRadius:20}}>{ric.tempo}</span>}
                  {ric.difficolta&&<span style={{fontSize:9,background:"#f5f5f5",color:"#888",
                    padding:"2px 8px",borderRadius:20}}>{ric.difficolta}</span>}
                </div>
                {ric.ingredienti&&(
                  <div style={{marginBottom:8}}>
                    <div style={{fontSize:9,fontWeight:700,color:"#888",marginBottom:4}}>
                      Ingredienti
                    </div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      {ric.ingredienti.map((ing,j)=>(
                        <span key={j} style={{fontSize:9,background:"#F5F8FC",color:"#555",
                          padding:"2px 7px",borderRadius:20,border:"1px solid #C2D9EC"}}>
                          {ing.nome} {ing.qty}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {ric.procedimento&&(
                  <div style={{fontSize:10,color:"#555",lineHeight:1.6,marginBottom:10}}>
                    {ric.procedimento}
                  </div>
                )}
                {ricAperta===ric&&ric.porzioni&&(
                  <div style={{background:"#EBF3FA",borderRadius:10,padding:"10px 12px",marginBottom:10}}>
                    <div style={{fontSize:10,fontWeight:800,color:"#2E5F8A",marginBottom:6}}>
                      Porzioni famiglia
                    </div>
                    {Object.entries(profili).map(([pid,prof])=>{
                      const pat=prof.patologia;
                      const por=pat==="svezzamento"?ric.porzioni.neo:
                                pat==="ipoproteica"?ric.porzioni.apro:
                                prof.eta<12?ric.porzioni.bimbo:
                                prof.kcal_target<1600?ric.porzioni.adulta:
                                ric.porzioni.adulto;
                      if(!por) return null;
                      return (
                        <div key={pid} style={{display:"flex",gap:8,padding:"4px 0",
                          borderTop:"1px solid #C2D9EC",fontSize:10}}>
                          <span style={{fontWeight:700,color:prof.colore,minWidth:60,flexShrink:0}}>
                            {prof.nome}
                          </span>
                          <span style={{flex:1,color:"#333"}}>{por.piatto}</span>
                          <span style={{color:"#888",whiteSpace:"nowrap"}}>{por.kcal}kcal</span>
                        </div>
                      );
                    })}
                    {ric.note&&<div style={{fontSize:9,color:"#888",fontStyle:"italic",
                      marginTop:6,paddingTop:6,borderTop:"1px solid #C2D9EC"}}>{ric.note}</div>}
                  </div>
                )}
                <button onClick={()=>setRicAperta(ricAperta===ric?null:ric)}
                  style={{background:ricAperta===ric?"#EBF3FA":"#2E5F8A",
                    color:ricAperta===ric?"#2E5F8A":"#fff",
                    border:ricAperta===ric?"1.5px solid #2E5F8A":"none",
                    borderRadius:20,padding:"6px 14px",fontSize:10,
                    fontWeight:700,cursor:"pointer"}}>
                  {ricAperta===ric?"Chiudi":"Vedi porzioni famiglia"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {vista==="ig" && (
        <div>
          {/* Pagine preferite */}
          <div style={{background:"#fff",borderRadius:14,padding:"12px 14px",
            marginBottom:12,boxShadow:"0 1px 6px rgba(0,0,0,.07)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontSize:12,fontWeight:800,color:"#222"}}>Pagine preferite</div>
              <button onClick={()=>setShowAddPagina(s=>!s)}
                style={{background:"#2E5F8A",color:"#fff",border:"none",borderRadius:20,
                  padding:"4px 12px",fontSize:10,fontWeight:700,cursor:"pointer"}}>
                {showAddPagina?"Annulla":"+ Aggiungi"}
              </button>
            </div>

            {showAddPagina && (
              <div style={{background:"#EBF3FA",borderRadius:10,padding:"10px 12px",marginBottom:10}}>
                <input placeholder="Nome pagina (es. Giallo Zafferano)"
                  value={nuovaPagina.nome}
                  onChange={e=>setNuovaPagina(p=>({...p,nome:e.target.value}))}
                  style={{width:"100%",padding:"7px",borderRadius:8,border:"1.5px solid #C2D9EC",
                    fontSize:11,marginBottom:6,boxSizing:"border-box"}}/>
                <input placeholder="Handle Instagram (es. giallozafferano)"
                  value={nuovaPagina.handle}
                  onChange={e=>setNuovaPagina(p=>({...p,handle:e.target.value.replace(/[@\s]/g,"")}))}
                  style={{width:"100%",padding:"7px",borderRadius:8,border:"1.5px solid #C2D9EC",
                    fontSize:11,marginBottom:8,boxSizing:"border-box"}}/>
                <button onClick={()=>{
                    if(!nuovaPagina.nome.trim()||!nuovaPagina.handle.trim()) return;
                    setPagine(prev=>[...prev,{
                      id:"p"+Date.now(), nome:nuovaPagina.nome.trim(),
                      handle:nuovaPagina.handle.trim(),
                      url:"https://www.instagram.com/"+nuovaPagina.handle.trim()+"/"
                    }]);
                    setNuovaPagina({nome:"",handle:""});
                    setShowAddPagina(false);
                  }}
                  style={{width:"100%",padding:"8px",borderRadius:10,border:"none",
                    background:"#2E5F8A",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                  Salva pagina
                </button>
              </div>
            )}

            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {pagine.map(p=>(
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,
                  padding:"8px 10px",background:"#F5F8FC",borderRadius:10}}>
                  <div style={{width:32,height:32,borderRadius:"50%",
                    background:"linear-gradient(135deg,#C2355A,#E8637A)",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    color:"#fff",fontSize:13,fontWeight:800,flexShrink:0}}>
                    {p.nome.slice(0,1)}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#222"}}>{p.nome}</div>
                    <div style={{fontSize:10,color:"#888"}}>@{p.handle}</div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <a href={p.url} target="_blank" rel="noreferrer"
                      style={{background:"#2E5F8A",color:"#fff",borderRadius:20,
                        padding:"4px 10px",fontSize:10,fontWeight:700,
                        textDecoration:"none"}}>
                      Apri
                    </a>
                    <button onClick={()=>setPagine(prev=>prev.filter(x=>x.id!==p.id))}
                      style={{background:"none",border:"none",color:"#ddd",
                        cursor:"pointer",fontSize:14,padding:"0 4px"}}>
                      x
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ricette salvate da Instagram */}
          <div style={{background:"#fff",borderRadius:14,padding:"12px 14px",
            boxShadow:"0 1px 6px rgba(0,0,0,.07)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontSize:12,fontWeight:800,color:"#222"}}>
                Ricette salvate ({ricetteIG.length})
              </div>
              <button onClick={()=>setShowAddRicetta(s=>!s)}
                style={{background:"#C2355A",color:"#fff",border:"none",borderRadius:20,
                  padding:"4px 12px",fontSize:10,fontWeight:700,cursor:"pointer"}}>
                {showAddRicetta?"Annulla":"+ Salva ricetta"}
              </button>
            </div>

            {showAddRicetta && (
              <div style={{background:"#F5E8EC",borderRadius:10,padding:"10px 12px",marginBottom:10}}>
                <div style={{fontSize:10,fontWeight:700,color:"#C2355A",marginBottom:8}}>
                  Nuova ricetta da Instagram
                </div>
                <input placeholder="Nome ricetta"
                  value={nuovaRicetta.titolo}
                  onChange={e=>setNuovaRicetta(p=>({...p,titolo:e.target.value}))}
                  style={{width:"100%",padding:"7px",borderRadius:8,border:"1.5px solid #F0A8B5",
                    fontSize:12,marginBottom:6,boxSizing:"border-box",fontWeight:700}}/>
                <select value={nuovaRicetta.fonte}
                  onChange={e=>setNuovaRicetta(p=>({...p,fonte:e.target.value}))}
                  style={{width:"100%",padding:"7px",borderRadius:8,border:"1.5px solid #F0A8B5",
                    fontSize:11,marginBottom:6,boxSizing:"border-box"}}>
                  <option value="">Fonte (pagina Instagram)</option>
                  {pagine.map(p=><option key={p.id} value={p.nome}>@{p.handle}</option>)}
                </select>
                <textarea placeholder="Ingredienti principali"
                  value={nuovaRicetta.ingredienti}
                  onChange={e=>setNuovaRicetta(p=>({...p,ingredienti:e.target.value}))}
                  rows={2}
                  style={{width:"100%",padding:"7px",borderRadius:8,border:"1.5px solid #F0A8B5",
                    fontSize:11,marginBottom:6,resize:"none",boxSizing:"border-box"}}/>
                <textarea placeholder="Note (come adattarla, cosa cambiare per i bambini...)"
                  value={nuovaRicetta.note}
                  onChange={e=>setNuovaRicetta(p=>({...p,note:e.target.value}))}
                  rows={2}
                  style={{width:"100%",padding:"7px",borderRadius:8,border:"1.5px solid #F0A8B5",
                    fontSize:11,marginBottom:6,resize:"none",boxSizing:"border-box"}}/>

                {/* Upload foto */}
                <div style={{marginBottom:8}}>
                  <div style={{fontSize:9,fontWeight:700,color:"#888",marginBottom:4}}>
                    Foto del piatto (opzionale)
                  </div>
                  {nuovaRicetta.foto ? (
                    <div style={{position:"relative"}}>
                      <img src={nuovaRicetta.foto} alt="foto"
                        style={{width:"100%",height:140,objectFit:"cover",
                          borderRadius:10,display:"block"}}/>
                      <button onClick={()=>setNuovaRicetta(p=>({...p,foto:null}))}
                        style={{position:"absolute",top:6,right:6,background:"rgba(0,0,0,.5)",
                          color:"#fff",border:"none",borderRadius:"50%",
                          width:24,height:24,cursor:"pointer",fontSize:12,fontWeight:700}}>
                        x
                      </button>
                    </div>
                  ) : (
                    <label style={{display:"block",border:"1.5px dashed #F0A8B5",
                      borderRadius:10,padding:"14px",textAlign:"center",cursor:"pointer",
                      background:"#fff"}}>
                      <div style={{fontSize:20,marginBottom:4}}>📷</div>
                      <div style={{fontSize:10,color:"#C2355A",fontWeight:700}}>
                        Tocca per aggiungere foto
                      </div>
                      <div style={{fontSize:9,color:"#aaa",marginTop:2}}>
                        Dal rullino o scatta ora
                      </div>
                      <input type="file" accept="image/*" capture="environment"
                        style={{display:"none"}}
                        onChange={e=>{
                          const file = e.target.files[0];
                          if(!file) return;
                          const reader = new FileReader();
                          reader.onload = ev => setNuovaRicetta(p=>({...p,foto:ev.target.result}));
                          reader.readAsDataURL(file);
                        }}/>
                    </label>
                  )}
                </div>                <button onClick={()=>{
                    if(!nuovaRicetta.titolo.trim()) return;
                    setRicetteIG(prev=>[{
                      id:"r"+Date.now(),
                      titolo:nuovaRicetta.titolo.trim(),
                      fonte:nuovaRicetta.fonte,
                      ingredienti:nuovaRicetta.ingredienti,
                      note:nuovaRicetta.note,
                      foto:nuovaRicetta.foto||null,
                      data:new Date().toLocaleDateString("it-IT")
                    },...prev]);
                    setNuovaRicetta({titolo:"",fonte:"",ingredienti:"",note:"",foto:null});
                    setShowAddRicetta(false);
                  }}
                  style={{width:"100%",padding:"8px",borderRadius:10,border:"none",
                    background:"#C2355A",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                  Salva ricetta
                </button>
              </div>
            )}

            {/* Filtro per fonte */}
            {ricetteIG.length>0 && (
              <div style={{display:"flex",gap:5,marginBottom:10,overflowX:"auto"}}>
                {["tutte",...new Set(ricetteIG.map(r=>r.fonte).filter(Boolean))].map(f=>(
                  <button key={f} onClick={()=>setFiltroFonte(f)}
                    style={{padding:"3px 10px",borderRadius:20,whiteSpace:"nowrap",
                      border:"1.5px solid "+(filtroFonte===f?"#C2355A":"#ddd"),
                      background:filtroFonte===f?"#C2355A":"#fff",
                      color:filtroFonte===f?"#fff":"#555",
                      fontSize:9,fontWeight:filtroFonte===f?700:400,cursor:"pointer"}}>
                    {f==="tutte"?"Tutte":f}
                  </button>
                ))}
              </div>
            )}

            {ricetteIG.length===0 && !showAddRicetta && (
              <div style={{textAlign:"center",padding:"20px",color:"#aaa",fontSize:11}}>
                Nessuna ricetta salvata.<br/>
                Apri Instagram, trova una ricetta che ti ispira<br/>
                e salvala qui con le tue note.
              </div>
            )}

            {ricetteIG
              .filter(r=>filtroFonte==="tutte"||r.fonte===filtroFonte)
              .map(r=>(
              <div key={r.id} style={{borderTop:"1px solid #f0f0f0",paddingTop:10,marginTop:6}}>
                {/* Foto */}
                {r.foto && (
                  <img src={r.foto} alt={r.titolo}
                    style={{width:"100%",height:160,objectFit:"cover",
                      borderRadius:10,marginBottom:8,display:"block"}}/>
                )}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#222",marginBottom:2}}>
                      {r.titolo}
                    </div>
                    {r.fonte && (
                      <div style={{fontSize:9,color:"#C2355A",fontWeight:600,marginBottom:4}}>
                        {r.fonte}
                      </div>
                    )}
                    {r.ingredienti && (
                      <div style={{fontSize:10,color:"#555",marginBottom:3}}>
                        {r.ingredienti}
                      </div>
                    )}
                    {r.note && (
                      <div style={{fontSize:10,color:"#888",fontStyle:"italic"}}>
                        {r.note}
                      </div>
                    )}
                    <div style={{fontSize:9,color:"#ccc",marginTop:4}}>{r.data}</div>
                  </div>
                  <button onClick={()=>setRicetteIG(prev=>prev.filter(x=>x.id!==r.id))}
                    style={{background:"none",border:"none",color:"#ddd",
                      cursor:"pointer",fontSize:14,padding:"0 4px",marginLeft:8}}>
                    x
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {vista==="svuota"&&(
        <div>
          <div style={{background:"#EBF3FA",borderRadius:12,padding:"12px 14px",marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:800,color:"#1B3A5C",marginBottom:4}}>
              Svuota dispensa - zero sprechi
            </div>
            <div style={{fontSize:10,color:"#555"}}>
              Seleziona gli ingredienti da finire e Claude crea 3 ricette
            </div>
          </div>

          {!dispensa.length?(
            <div style={{background:"#F5F8FC",borderRadius:14,padding:"20px",textAlign:"center"}}>
              <div style={{fontSize:10,color:"#888"}}>Dispensa vuota - aggiungila nella tab Dispensa</div>
            </div>
          ):(
            <div>
              <div style={{background:"#fff",borderRadius:12,padding:"12px 14px",marginBottom:10,
                boxShadow:"0 1px 6px rgba(0,0,0,.07)"}}>
                <div style={{fontSize:10,fontWeight:700,color:"#555",marginBottom:6}}>Seleziona ingredienti:</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {dispensa.map(item=>{
                    const sel=selIng.includes(item.nome);
                    return(
                      <button key={item.id} onClick={()=>toggleIng(item.nome)}
                        style={{background:sel?"#2E5F8A":"#F5F8FC",
                          color:sel?"#fff":"#444",
                          border:"1.5px solid "+(sel?"#2E5F8A":"#C2D9EC"),
                          borderRadius:20,padding:"3px 10px",fontSize:10,
                          fontWeight:sel?700:400,cursor:"pointer"}}>
                        {sel?"v ":""}{item.nome}
                      </button>
                    );
                  })}
                </div>
              </div>

              {selIng.length>0&&(
                <div style={{background:"#EBF3FA",borderRadius:12,padding:"12px 14px",
                  marginBottom:10,border:"1.5px solid #C8E6C9"}}>
                  <div style={{fontSize:10,fontWeight:700,color:"#2E5F8A",marginBottom:5}}>
                    Selezionati: {selIng.join(", ")}
                  </div>
                  <button onClick={svuota} disabled={loadSvuota}
                    style={{width:"100%",padding:"10px",borderRadius:12,border:"none",
                      background:loadSvuota?"#ccc":"linear-gradient(135deg,#0D1B2A,#2E5F8A)",
                      color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                    {loadSvuota?"Claude crea le ricette...":"Genera ricette svuota-dispensa"}
                  </button>
                </div>
              )}

              {ricSvuota&&ricSvuota.map((ric,i)=>(
                <div key={i} style={{background:"#fff",borderRadius:14,padding:"12px 14px",
                  marginBottom:10,boxShadow:"0 1px 6px rgba(0,0,0,.07)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:8}}>
                    <span style={{fontSize:20}}>{ric.emoji||""}</span>
                    <div>
                      <div style={{fontSize:12,fontWeight:800,color:"#222"}}>{ric.titolo}</div>
                      <div style={{fontSize:9,color:"#aaa"}}>{ric.tempo}</div>
                    </div>
                  </div>
                  <div style={{background:"#EBF3FA",borderRadius:8,padding:"5px 9px",
                    marginBottom:7,fontSize:10,color:"#2E5F8A"}}>
                    <b>Base:</b> {ric.base}
                  </div>
                  {[{e:"Adulti",k:"adulti"},{e:"Bambini",k:"bimbo"},{e:"Aproteico",k:"apro"},{e:"Neonato",k:"neo"}].map(p=>
                    ric[p.k]?(
                      <div key={p.k} style={{display:"flex",gap:7,padding:"3px 0",
                        borderTop:"1px solid #f5f5f5",fontSize:10,color:"#333"}}>
                        <span>{p.e}</span><span style={{flex:1}}>{ric[p.k]}</span>
                      </div>
                    ):null
                  )}
                  {ric.note&&<div style={{marginTop:6,fontSize:9,color:"#888",fontStyle:"italic"}}>{ric.note}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── APP PRINCIPALE ────────────────────────────────────────────
// ── TAB HOME / DASHBOARD ─────────────────────────────────────
const ORDINE_PASTI = ["Colazione","Spuntino","Pranzo","Merenda","Cena","Extra"];

function TabHome({menu, profili, dispensa, mealPrep, giorniFuori, setTab, builderScelte}) {
  var GIORNI_H = ["Lunedi","Martedi","Mercoledi","Giovedi","Venerdi","Sabato","Domenica"];
  var PASTI_H  = ["Colazione","Spuntino","Pranzo","Merenda","Cena"];
  var allDB    = CARBOIDRATI.concat(PROTEINE).concat(VERDURE).concat(FRUTTA).concat(SALSE);
  var PORZ     = {pasta:80,riso:80,cereali:70,tuberi:180,pane:60,colazione:50,
    "carne bianca":150,"carne rossa":150,pesce:150,uova:120,legumi:200,latticini:100,verdura:150,frutta:120};

  var oggi    = new Date().getDay();
  var todayIdx= oggi===0?6:oggi-1;
  var gOggi   = GIORNI_H[todayIdx];
  var oggiStr = new Date().toISOString().split("T")[0];

  // Pasti di oggi
  var pastiOggi = PASTI_H.map(function(p){
    return {pasto:p, s:builderScelte[gOggi+"-"+p]||null};
  });
  var inseriti = pastiOggi.filter(function(x){return x.s&&(x.s.carbo||x.s.proteina||x.s.frutta);});

  // Kcal oggi adulto
  var kcalOggi = inseriti.reduce(function(tot,x){
    var k=0;
    ["carbo","proteina","verdura","frutta"].forEach(function(key){
      var id=x.s[key]; if(!id) return;
      var it=allDB.find(function(a){return a.id===id;});
      if(!it||!it.kcal_p) return;
      k+=Math.round(it.kcal_p*(PORZ[it.cat]||100)/100);
    });
    return tot+k;
  },0);

  // Progresso settimana
  var completi=0; var totale=GIORNI_H.length*PASTI_H.length;
  GIORNI_H.forEach(function(g){
    PASTI_H.forEach(function(p){
      var s=builderScelte[g+"-"+p];
      if(s&&(s.carbo||s.proteina||s.frutta||s.latticino)) completi++;
    });
  });

  // Scaduti e in scadenza
  var scaduti = dispensa.filter(function(d){return d.scadenza&&d.scadenza<oggiStr;});
  var presto  = dispensa.filter(function(d){
    if(!d.scadenza||d.scadenza<oggiStr) return false;
    return (new Date(d.scadenza)-new Date())/86400000<=3;
  });

  // Cibi mancanti per pasti programmati
  var needed={};
  GIORNI_H.forEach(function(g){
    PASTI_H.forEach(function(p){
      var s=builderScelte[g+"-"+p]; if(!s) return;
      ["carbo","proteina","verdura","verdura2","frutta"].forEach(function(k){
        var id=s[k]; if(!id||needed[id]) return;
        var it=allDB.find(function(x){return x.id===id;});
        if(it) needed[id]=it.nome;
      });
    });
  });
  var dispNomi=dispensa.map(function(d){return d.nome.toLowerCase();});
  var mancanti=Object.values(needed).filter(function(nome){
    return !dispNomi.some(function(n){return n.indexOf(nome.toLowerCase())>=0;});
  });

  // Prossimo giorno con pasti inseriti
  var prossimoGiorno=null;
  for(var gi=todayIdx+1;gi<GIORNI_H.length;gi++){
    var g2=GIORNI_H[gi];
    if(PASTI_H.some(function(p){return builderScelte[g2+"-"+p];})){
      prossimoGiorno=g2; break;
    }
  }

  return (
    <div>

      {/* Oggi */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:10,color:"#aaa",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>
          Oggi — {gOggi}
        </div>
        {inseriti.length===0?(
          <div>
            <div style={{fontSize:13,color:"#888",marginBottom:10}}>
              Nessun pasto pianificato.
            </div>
            <button onClick={function(){setTab("builder");}}
              style={{padding:"8px 14px",borderRadius:6,border:"1.5px solid #0D1B2A",
                background:"transparent",color:"#0D1B2A",fontSize:11,fontWeight:600,cursor:"pointer"}}>
              Pianifica ora
            </button>
          </div>
        ):(
          <div>
            {pastiOggi.map(function(x){
              if(!x.s) return null;
              var s=x.s;
              var protItem =allDB.find(function(a){return a.id===s.proteina;});
              var carboItem=allDB.find(function(a){return a.id===s.carbo;});
              var fruttaItem=allDB.find(function(a){return a.id===s.frutta;});
              var principale=protItem||carboItem||fruttaItem;
              var secondo=protItem&&carboItem?carboItem:null;
              return (
                <div key={x.pasto} style={{display:"flex",gap:12,padding:"8px 0",
                  borderBottom:"1px solid #f5f5f5",alignItems:"center"}}>
                  <span style={{width:66,fontSize:10,color:"#aaa",flexShrink:0}}>{x.pasto}</span>
                  <span style={{fontSize:11,color:"#0D1B2A"}}>
                    {principale?principale.nome:""}
                    {secondo&&<span style={{color:"#aaa"}}> / {secondo.nome}</span>}
                  </span>
                </div>
              );
            })}
            {kcalOggi>0&&(
              <div style={{fontSize:10,color:"#aaa",marginTop:6}}>
                {kcalOggi} kcal adulto — {inseriti.length}/{PASTI_H.length} pasti
              </div>
            )}
          </div>
        )}
      </div>

      {/* Settimana */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:10,color:"#aaa",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>
          Settimana
        </div>
        <div style={{background:"#f0f0f0",borderRadius:3,height:4,marginBottom:4}}>
          <div style={{width:Math.round(completi/totale*100)+"%",height:"100%",
            background:"#0D1B2A",borderRadius:3}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#aaa"}}>
          <span>{completi} pasti inseriti su {totale}</span>
          {prossimoGiorno&&<span>Prossimo: {prossimoGiorno}</span>}
        </div>
      </div>

      {/* Dispensa: scaduti */}
      {scaduti.length>0&&(
        <div style={{marginBottom:16,paddingBottom:16,borderBottom:"1px solid #f0f0f0"}}>
          <div style={{fontSize:10,color:"#C0392B",fontWeight:700,
            textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>
            Scaduti — da buttare
          </div>
          {scaduti.map(function(d){
            return (
              <div key={d.id} style={{fontSize:11,color:"#C0392B",padding:"4px 0"}}>
                {d.nome}
                {d.qty&&<span style={{color:"#E07A7A",fontSize:10}}> — {d.qty} {d.unita||""}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Dispensa: in scadenza */}
      {presto.length>0&&(
        <div style={{marginBottom:16,paddingBottom:16,borderBottom:"1px solid #f0f0f0"}}>
          <div style={{fontSize:10,color:"#E65100",fontWeight:700,
            textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>
            In scadenza nei prossimi 3 giorni
          </div>
          {presto.map(function(d){
            var giorni=Math.round((new Date(d.scadenza)-new Date())/86400000);
            return (
              <div key={d.id} style={{display:"flex",justifyContent:"space-between",
                padding:"5px 0",fontSize:11,color:"#0D1B2A",borderBottom:"1px solid #fafafa"}}>
                <span>{d.nome}</span>
                <span style={{color:"#E65100",fontSize:10}}>
                  {giorni===0?"oggi":giorni===1?"domani":"fra "+giorni+" giorni"}
                </span>
              </div>
            );
          })}
          <div style={{fontSize:10,color:"#aaa",marginTop:6}}>
            Considera di usarli nei pasti di questa settimana
          </div>
        </div>
      )}

      {/* Da acquistare */}
      {mancanti.length>0&&(
        <div style={{marginBottom:16}}>
          <div style={{fontSize:10,color:"#555",fontWeight:700,
            textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>
            Da acquistare per i pasti programmati
          </div>
          <div style={{fontSize:9,color:"#aaa",marginBottom:8}}>
            Non trovati in dispensa
          </div>
          {mancanti.slice(0,8).map(function(nome){
            return (
              <div key={nome} style={{display:"flex",alignItems:"center",gap:8,
                padding:"6px 0",borderBottom:"1px solid #f5f5f5",fontSize:11,color:"#0D1B2A"}}>
                <div style={{width:4,height:4,borderRadius:"50%",background:"#888",flexShrink:0}}/>
                {nome}
              </div>
            );
          })}
          {mancanti.length>8&&(
            <div style={{fontSize:10,color:"#aaa",marginTop:4}}>
              + altri {mancanti.length-8}
            </div>
          )}
          <button onClick={function(){setTab("dispensa");}}
            style={{marginTop:10,padding:"7px 14px",borderRadius:6,
              border:"1.5px solid #888",background:"transparent",
              color:"#555",fontSize:10,cursor:"pointer"}}>
            Vai alla spesa
          </button>
        </div>
      )}
    </div>
  );
}

// ── TAB IMPOSTAZIONI ─────────────────────────────────────────
const GIORNI_IMP = ["Lunedi","Martedi","Mercoledi","Giovedi","Venerdi","Sabato","Domenica"];
const ORI_IMP    = ["07:00","08:00","09:00","10:00","17:00","18:00","19:00","20:00","21:00"];

function TabImpostazioni({profili, setProfili, pianificazione, setPianificazione,
                          pesoLog, setPesoLog, pin, setPin}) {
  const [sezione, setSezione] = useState("famiglia");
  const [nuovoPin, setNuovoPin] = useState("");
  const [confPin, setConfPin] = useState("");
  const [pinErr, setPinErr] = useState("");
  const [pinSalvato, setPinSalvato] = useState(false);

  const salvaPin = () => {
    if(nuovoPin.length < 4) { setPinErr("Minimo 4 cifre"); return; }
    if(nuovoPin !== confPin) { setPinErr("I PIN non coincidono"); return; }
    setPin({attivo:true, codice:nuovoPin, sbloccato:true});
    setPinErr(""); setPinSalvato(true);
    setNuovoPin(""); setConfPin("");
  };

  const richiediNotifica = async () => {
    if(!("Notification" in window)) return false;
    if(Notification.permission==="granted") return true;
    const p = await Notification.requestPermission();
    return p==="granted";
  };

  const salvaPiano = async (g, o) => {
    const ok = await richiediNotifica();
    setPianificazione({giorno:g, ora:o, attiva:true, notifiche:ok});
  };

  const SEZIONI = [
    {id:"famiglia",   l:"Familiari"},
    {id:"nutrizionale",l:"Nutrizione"},
    {id:"pesi",       l:"Pesi iniziali"},
    {id:"piano",      l:"Pianificazione"},
    {id:"sicurezza",  l:"PIN"},
  ];

  return (
    <div>
      <div style={{fontSize:14,fontWeight:800,color:"#2E5F8A",marginBottom:12}}>
        Impostazioni
      </div>

      {/* Selector sezioni */}
      <div style={{display:"flex",gap:5,marginBottom:14,overflowX:"auto",paddingBottom:3}}>
        {SEZIONI.map(s=>(
          <button key={s.id} onClick={()=>setSezione(s.id)}
            style={{padding:"5px 12px",borderRadius:20,whiteSpace:"nowrap",
              border:"1.5px solid "+(sezione===s.id?"#2E5F8A":"#ddd"),
              background:sezione===s.id?"#2E5F8A":"#fff",
              color:sezione===s.id?"#fff":"#555",
              fontWeight:sezione===s.id?700:400,fontSize:10,cursor:"pointer"}}>
            {s.l}
          </button>
        ))}
      </div>

      {/* ── FAMILIARI ── */}
      {sezione==="famiglia" && (
        <TabFamiglia profili={profili} setProfili={setProfiliLS}/>
      )}

      {/* ── ESIGENZE NUTRIZIONALI ── */}
      {sezione==="nutrizionale" && (
        <div>
          <div style={{fontSize:11,color:"#888",marginBottom:12}}>
            Modifica kcal e proteine prescritte per ogni membro.
            Lascia vuoto per usare i valori automatici della patologia.
          </div>
          {Object.entries(profili).map(([pid,prof])=>(
            <div key={pid} style={{background:"#fff",borderRadius:14,padding:"12px 14px",
              marginBottom:10,boxShadow:"0 1px 6px rgba(0,0,0,.07)",
              borderLeft:"4px solid "+prof.colore}}>
              <div style={{fontSize:12,fontWeight:800,color:"#222",marginBottom:10}}>
                {prof.nome}
                <span style={{fontSize:10,fontWeight:400,color:"#888",marginLeft:6}}>
                  {(PATOLOGIE_LIST.find(p=>p.id===prof.patologia)||{}).label||""}
                </span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <div>
                  <div style={{fontSize:9,fontWeight:700,color:"#888",marginBottom:3}}>
                    Kcal/giorno
                  </div>
                  <input type="number"
                    value={prof.kcal_custom||prof.kcal_target}
                    onChange={e=>{
                      const v = parseInt(e.target.value)||prof.kcal_target;
                      setProfili(prev=>({...prev,[pid]:{...prev[pid],
                        kcal_target:v, kcal_custom:e.target.value}}));
                    }}
                    style={{width:"100%",padding:"7px 8px",borderRadius:8,
                      border:"1.5px solid #E0EAE4",fontSize:13,fontWeight:700,
                      color:prof.colore,boxSizing:"border-box"}}/>
                </div>
                <div>
                  <div style={{fontSize:9,fontWeight:700,color:"#888",marginBottom:3}}>
                    Proteine max (g/die)
                  </div>
                  <input type="number" step="0.5"
                    value={prof.prot_custom||prof.prot_max}
                    onChange={e=>{
                      const v = parseFloat(e.target.value)||prof.prot_max;
                      setProfili(prev=>({...prev,[pid]:{...prev[pid],
                        prot_max:v, prot_custom:e.target.value}}));
                    }}
                    style={{width:"100%",padding:"7px 8px",borderRadius:8,
                      border:"1.5px solid #E0EAE4",fontSize:13,fontWeight:700,
                      color:prof.patologia==="ipoproteica"?"#C0392B":prof.colore,
                      boxSizing:"border-box"}}/>
                </div>
              </div>
              {prof.patologia==="ipoproteica"&&(
                <div style={{marginTop:8,fontSize:9,color:"#C2355A",fontWeight:600}}>
                  Ipoproteica  -  inserisci il valore esatto prescritto dal nefrologo
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── PESI INIZIALI ── */}
      {sezione==="pesi" && (
        <div>
          <div style={{fontSize:11,color:"#888",marginBottom:12}}>
            Inserisci il peso di partenza per ogni membro. Serve per calcolare il BMI
            e monitorare il trend nel tempo.
          </div>
          {Object.entries(profili).map(([pid,prof])=>{
            const log = pesoLog[pid]||[];
            const ultimoPeso = log.length>0 ? log[log.length-1].valore : prof.peso||0;
            const bmi = prof.altezza>0 && ultimoPeso>0
              ? (ultimoPeso/((prof.altezza/100)**2)).toFixed(1) : null;
            return (
              <div key={pid} style={{background:"#fff",borderRadius:14,padding:"12px 14px",
                marginBottom:10,boxShadow:"0 1px 6px rgba(0,0,0,.07)",
                borderLeft:"4px solid "+prof.colore}}>
                <div style={{display:"flex",justifyContent:"space-between",
                  alignItems:"center",marginBottom:8}}>
                  <div style={{fontSize:12,fontWeight:800}}>{prof.nome}</div>
                  {bmi&&<div style={{fontSize:11,fontWeight:700,color:prof.colore}}>
                    BMI {bmi}
                  </div>}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7}}>
                  {[{k:"peso",l:"Peso (kg)",step:"0.1"},
                    {k:"altezza",l:"Altezza (cm)",step:"1"},
                    {k:"eta",l:"Eta (anni)",step:"1"}].map(f=>(
                    <div key={f.k}>
                      <div style={{fontSize:9,fontWeight:700,color:"#888",marginBottom:3}}>
                        {f.l}
                      </div>
                      <input type="number" step={f.step}
                        value={prof[f.k]||""}
                        onChange={e=>{
                          const v = parseFloat(e.target.value)||0;
                          setProfili(prev=>({...prev,[pid]:{...prev[pid],[f.k]:v}}));
                          if(f.k==="peso" && v>0) {
                            const oggi = new Date().toISOString().split("T")[0];
                            setPesoLog(prev=>{
                              const arr=[...(prev[pid]||[])];
                              const idx=arr.findIndex(x=>x.data===oggi);
                              if(idx>=0) arr[idx]={data:oggi,valore:v};
                              else arr.push({data:oggi,valore:v});
                              return {...prev,[pid]:arr};
                            });
                          }
                        }}
                        style={{width:"100%",padding:"7px 8px",borderRadius:8,
                          border:"1.5px solid #E0EAE4",fontSize:13,fontWeight:700,
                          color:prof.colore,boxSizing:"border-box"}}/>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── PIANIFICAZIONE ── */}
      {sezione==="piano" && (
        <div>
          <div style={{background:"#fff",borderRadius:14,padding:"14px",
            boxShadow:"0 1px 6px rgba(0,0,0,.07)"}}>
            <div style={{fontSize:12,fontWeight:800,color:"#222",marginBottom:4}}>
              Giorno di pianificazione settimanale
            </div>
            <div style={{fontSize:10,color:"#888",marginBottom:14}}>
              Scegli quando vuoi organizzare il menu della settimana successiva.
              Riceverai una notifica in quel momento.
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,fontWeight:700,color:"#555",marginBottom:7}}>
                Giorno
              </div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {GIORNI_IMP.map((g,i)=>(
                  <button key={i}
                    onClick={()=>setPianificazione(p=>({...p,giorno:i}))}
                    style={{padding:"6px 12px",borderRadius:20,fontSize:10,cursor:"pointer",
                      border:"1.5px solid "+(pianificazione.giorno===i?"#2E5F8A":"#ddd"),
                      background:pianificazione.giorno===i?"#2E5F8A":"#fff",
                      color:pianificazione.giorno===i?"#fff":"#555",
                      fontWeight:pianificazione.giorno===i?700:400}}>
                    {g.slice(0,3)}
                  </button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,fontWeight:700,color:"#555",marginBottom:7}}>
                Orario
              </div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {ORI_IMP.map(o=>(
                  <button key={o}
                    onClick={()=>setPianificazione(p=>({...p,ora:o}))}
                    style={{padding:"6px 12px",borderRadius:20,fontSize:10,cursor:"pointer",
                      border:"1.5px solid "+(pianificazione.ora===o?"#2E5F8A":"#ddd"),
                      background:pianificazione.ora===o?"#2E5F8A":"#fff",
                      color:pianificazione.ora===o?"#fff":"#555",
                      fontWeight:pianificazione.ora===o?700:400}}>
                    {o}
                  </button>
                ))}
              </div>
            </div>

            {pianificazione.attiva&&(
              <div style={{background:"#EBF3FA",borderRadius:10,padding:"8px 12px",
                marginBottom:10,fontSize:10,color:"#2E5F8A",fontWeight:700}}>
                Attivo: ogni {GIORNI_IMP[pianificazione.giorno]} alle {pianificazione.ora}
                {pianificazione.notifiche?" con notifica":" (notifica non attiva)"}
              </div>
            )}

            <button onClick={()=>salvaPiano(pianificazione.giorno, pianificazione.ora)}
              style={{width:"100%",padding:"10px",borderRadius:12,border:"none",
                background:"#2E5F8A",color:"#fff",fontSize:12,
                fontWeight:700,cursor:"pointer"}}>
              {pianificazione.attiva?"Aggiorna pianificazione":"Attiva pianificazione"}
            </button>
          </div>
        </div>
      )}

      {/* ── PIN / SICUREZZA ── */}
      {sezione==="sicurezza" && (
        <div>
          <div style={{background:"#fff",borderRadius:14,padding:"14px",
            boxShadow:"0 1px 6px rgba(0,0,0,.07)"}}>
            <div style={{fontSize:12,fontWeight:800,color:"#222",marginBottom:4}}>
              PIN di accesso
            </div>
            <div style={{fontSize:10,color:"#888",marginBottom:14}}>
              Proteggi l'app con un PIN numerico. Ogni membro della famiglia
              puo usare lo stesso PIN per accedere ai propri dati.
            </div>

            {pin.attivo&&(
              <div style={{background:"#EBF3FA",borderRadius:10,padding:"9px 12px",
                marginBottom:12,display:"flex",justifyContent:"space-between",
                alignItems:"center"}}>
                <div style={{fontSize:11,fontWeight:700,color:"#2E5F8A"}}>
                  PIN attivo
                </div>
                <button onClick={()=>setPin({attivo:false,codice:"",sbloccato:true})}
                  style={{background:"#FDE8E4",border:"none",borderRadius:20,
                    padding:"3px 10px",fontSize:10,cursor:"pointer",color:"#C0392B",fontWeight:700}}>
                  Rimuovi PIN
                </button>
              </div>
            )}

            {pinSalvato&&(
              <div style={{background:"#EBF3FA",borderRadius:10,padding:"8px 12px",
                marginBottom:12,fontSize:11,fontWeight:700,color:"#2E5F8A"}}>
                PIN salvato correttamente
              </div>
            )}

            <div style={{marginBottom:8}}>
              <div style={{fontSize:10,fontWeight:700,color:"#555",marginBottom:5}}>
                {pin.attivo?"Nuovo PIN":"Crea PIN"}
              </div>
              <input type="password" inputMode="numeric" pattern="[0-9]*"
                placeholder="Es. 1234" maxLength={8}
                value={nuovoPin}
                onChange={e=>{setNuovoPin(e.target.value.replace(/[^0-9]/g,""));
                  setPinErr(""); setPinSalvato(false);}}
                style={{width:"100%",padding:"10px 12px",borderRadius:8,
                  border:"1.5px solid #E0EAE4",fontSize:18,fontWeight:700,
                  letterSpacing:6,textAlign:"center",boxSizing:"border-box"}}/>
            </div>
            <div style={{marginBottom:pinErr?8:12}}>
              <div style={{fontSize:10,fontWeight:700,color:"#555",marginBottom:5}}>
                Conferma PIN
              </div>
              <input type="password" inputMode="numeric" pattern="[0-9]*"
                placeholder="Ripeti" maxLength={8}
                value={confPin}
                onChange={e=>{setConfPin(e.target.value.replace(/[^0-9]/g,""));
                  setPinErr(""); setPinSalvato(false);}}
                style={{width:"100%",padding:"10px 12px",borderRadius:8,
                  border:"1.5px solid "+(pinErr?"#C0392B":"#C2D9EC"),
                  fontSize:18,fontWeight:700,
                  letterSpacing:6,textAlign:"center",boxSizing:"border-box"}}/>
            </div>
            {pinErr&&<div style={{fontSize:10,color:"#C0392B",
              fontWeight:700,marginBottom:10}}>{pinErr}</div>}

            <button onClick={salvaPin}
              disabled={!nuovoPin||!confPin}
              style={{width:"100%",padding:"10px",borderRadius:12,border:"none",
                background:nuovoPin&&confPin?"#2E5F8A":"#ccc",
                color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>
              Salva PIN
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PROFILI INIZIALI ─────────────────────────────────────────
const PROFILI_INIZIALI = {
  adulta: {id:"adulta",nome:"Mamma",emoji:"?",patologia:"dimagrimento",
    kcal_target:1400,prot_max:70,colore:"#2E5F8A",eta:35,peso:0,altezza:165,
    kcal_custom:"",prot_custom:""},
  adulto: {id:"adulto",nome:"Papa",emoji:"?",patologia:"dimagrimento",
    kcal_target:1600,prot_max:80,colore:"#1B3A5C",eta:38,peso:0,altezza:178,
    kcal_custom:"",prot_custom:""},
  bimbo: {id:"bimbo",nome:"Bimbo grande",emoji:"?",patologia:"nessuna",
    kcal_target:1600,prot_max:45,colore:"#6B9EC4",eta:8,peso:0,altezza:130,
    kcal_custom:"",prot_custom:""},
  apro: {id:"apro",nome:"Bimbo aproteico",emoji:"?",patologia:"ipoproteica",
    kcal_target:1500,prot_max:20,colore:"#C2355A",eta:4,peso:0,altezza:100,
    kcal_custom:"",prot_custom:""},
  neo: {id:"neo",nome:"Neonato",emoji:"?",patologia:"svezzamento",
    kcal_target:800,prot_max:14,colore:"#E8637A",eta:0,peso:0,altezza:70,
    kcal_custom:"",prot_custom:""},
};


// ── CONSTANTS ────────────────────────────────────────────────
var GIORNI = ["Lunedi","Martedi","Mercoledi","Giovedi","Venerdi","Sabato","Domenica"];
var PASTI  = ["Colazione","Spuntino","Pranzo","Merenda","Cena"];
var PASTI_TIPO = {Colazione:"colazione",Spuntino:"spuntino",Pranzo:"pranzo",Merenda:"spuntino",Cena:"cena"};

var CARBO_CATS = {pasta:"Pasta",riso:"Riso",cereali:"Cereali",tuberi:"Patate",pane:"Pane"};
var PROT_CATS  = {"carne bianca":"Carne bianca","carne rossa":"Carne rossa",pesce:"Pesce",uova:"Uova",legumi:"Legumi",affettati:"Affettati",latticini:"Latticini"};

var CARBOIDRATI = [
  {id:"spaghetti",nome:"Spaghetti",cat:"pasta",emoji:"?",kcal_p:350,stagione:"tutto"},
  {id:"rigatoni",nome:"Rigatoni",cat:"pasta",emoji:"?",kcal_p:350,stagione:"tutto"},
  {id:"penne",nome:"Penne rigate",cat:"pasta",emoji:"?",kcal_p:350,stagione:"tutto"},
  {id:"fusilli",nome:"Fusilli",cat:"pasta",emoji:"?",kcal_p:350,stagione:"tutto"},
  {id:"farfalle",nome:"Farfalle",cat:"pasta",emoji:"?",kcal_p:350,stagione:"tutto"},
  {id:"tagliatelle",nome:"Tagliatelle",cat:"pasta",emoji:"?",kcal_p:350,stagione:"tutto"},
  {id:"orecchiette",nome:"Orecchiette",cat:"pasta",emoji:"?",kcal_p:350,stagione:"tutto"},
  {id:"lasagne",nome:"Lasagne",cat:"pasta",emoji:"?",kcal_p:380,stagione:"tutto"},
  {id:"gnocchi",nome:"Gnocchi di patate",cat:"pasta",emoji:"?",kcal_p:280,stagione:"tutto"},
  {id:"ravioli",nome:"Ravioli",cat:"pasta",emoji:"?",kcal_p:320,stagione:"tutto"},
  {id:"noodles",nome:"Noodles di riso",cat:"pasta",emoji:"?",kcal_p:360,stagione:"tutto"},
  {id:"soba",nome:"Soba grano saraceno",cat:"pasta",emoji:"?",kcal_p:340,stagione:"tutto"},
  {id:"pasta_leg",nome:"Pasta di legumi",cat:"pasta",emoji:"?",kcal_p:330,stagione:"tutto"},
  {id:"riso_b",nome:"Riso bianco",cat:"riso",emoji:"?",kcal_p:300,stagione:"tutto"},
  {id:"riso_int",nome:"Riso integrale",cat:"riso",emoji:"?",kcal_p:290,stagione:"tutto"},
  {id:"riso_bas",nome:"Riso basmati",cat:"riso",emoji:"?",kcal_p:300,stagione:"tutto"},
  {id:"risotto",nome:"Risotto",cat:"riso",emoji:"?",kcal_p:340,stagione:"tutto"},
  {id:"farro",nome:"Farro",cat:"cereali",emoji:"?",kcal_p:305,stagione:"tutto"},
  {id:"orzo",nome:"Orzo perlato",cat:"cereali",emoji:"?",kcal_p:295,stagione:"tutto"},
  {id:"quinoa",nome:"Quinoa",cat:"cereali",emoji:"?",kcal_p:320,stagione:"tutto"},
  {id:"cous",nome:"Cous cous",cat:"cereali",emoji:"?",kcal_p:310,stagione:"tutto"},
  {id:"polenta",nome:"Polenta",cat:"cereali",emoji:"?",kcal_p:250,stagione:"tutto"},
  {id:"patate",nome:"Patate",cat:"tuberi",emoji:"?",kcal_p:200,stagione:"tutto"},
  {id:"patate_d",nome:"Patate dolci",cat:"tuberi",emoji:"?",kcal_p:220,stagione:"tutto"},
  {id:"pane_b",nome:"Pane bianco",cat:"pane",emoji:"?",kcal_p:265,stagione:"tutto"},
  {id:"pane_int",nome:"Pane integrale",cat:"pane",emoji:"?",kcal_p:240,stagione:"tutto"},
  {id:"focaccia",nome:"Focaccia",cat:"pane",emoji:"?",kcal_p:310,stagione:"tutto"},
  {id:"pizza",nome:"Pizza",cat:"pane",emoji:"?",kcal_p:420,stagione:"tutto"},
  {id:"piadina",nome:"Piadina",cat:"pane",emoji:"?",kcal_p:340,stagione:"tutto"},
  {id:"pinsa",nome:"Pinsa romana",cat:"pane",emoji:"?",kcal_p:260,stagione:"tutto"},
  {id:"avena",nome:"Avena/porridge",cat:"colazione",emoji:"?",kcal_p:370,stagione:"tutto"},
  {id:"muesli",nome:"Muesli",cat:"colazione",emoji:"?",kcal_p:360,stagione:"tutto"},
  {id:"granola",nome:"Granola",cat:"colazione",emoji:"?",kcal_p:410,stagione:"tutto"},
  {id:"fette_int",nome:"Fette biscottate",cat:"colazione",emoji:"?",kcal_p:380,stagione:"tutto"},
  {id:"gallette",nome:"Gallette di riso",cat:"colazione",emoji:"?",kcal_p:380,stagione:"tutto"},
  {id:"pancakes",nome:"Pancakes",cat:"colazione",emoji:"?",kcal_p:280,stagione:"tutto"},
];

var PROTEINE = [
  {id:"pollo_f",nome:"Petto di pollo",cat:"carne bianca",emoji:"?",kcal_p:165,prot_p:31,piramide:"carne",freq:"3/sett"},
  {id:"pollo_c",nome:"Cosce di pollo",cat:"carne bianca",emoji:"?",kcal_p:215,prot_p:26,piramide:"carne",freq:"3/sett"},
  {id:"tacchino",nome:"Tacchino",cat:"carne bianca",emoji:"?",kcal_p:135,prot_p:30,piramide:"carne",freq:"3/sett"},
  {id:"manzo",nome:"Manzo",cat:"carne rossa",emoji:"?",kcal_p:250,prot_p:26,piramide:"carne_rossa",limit:1,freq:"1/sett"},
  {id:"agnello",nome:"Agnello",cat:"carne rossa",emoji:"?",kcal_p:294,prot_p:25,piramide:"carne_rossa",limit:1,freq:"1/sett"},
  {id:"salmone",nome:"Salmone",cat:"pesce",emoji:"?",kcal_p:208,prot_p:20,piramide:"pesce",freq:"3/sett"},
  {id:"merluzzo",nome:"Merluzzo",cat:"pesce",emoji:"?",kcal_p:82,prot_p:18,piramide:"pesce",freq:"3/sett"},
  {id:"tonno",nome:"Tonno",cat:"pesce",emoji:"?",kcal_p:132,prot_p:28,piramide:"pesce",freq:"3/sett"},
  {id:"orata",nome:"Orata",cat:"pesce",emoji:"?",kcal_p:120,prot_p:20,piramide:"pesce",freq:"3/sett"},
  {id:"gamberetti",nome:"Gamberetti",cat:"pesce",emoji:"?",kcal_p:106,prot_p:20,piramide:"pesce",freq:"3/sett"},
  {id:"uova",nome:"Uova",cat:"uova",emoji:"?",kcal_p:155,prot_p:13,piramide:"uova",limit:2,freq:"2/sett"},
  {id:"ceci",nome:"Ceci",cat:"legumi",emoji:"?",kcal_p:130,prot_p:9,piramide:"legumi",freq:"3/sett"},
  {id:"lenticchie",nome:"Lenticchie",cat:"legumi",emoji:"?",kcal_p:116,prot_p:9,piramide:"legumi",freq:"3/sett"},
  {id:"fagioli",nome:"Fagioli",cat:"legumi",emoji:"?",kcal_p:127,prot_p:9,piramide:"legumi",freq:"3/sett"},
  {id:"prosciutto",nome:"Prosciutto cotto",cat:"affettati",emoji:"?",kcal_p:145,prot_p:19,piramide:"carne",freq:"libero"},
  {id:"bresaola",nome:"Bresaola",cat:"affettati",emoji:"?",kcal_p:151,prot_p:32,piramide:"carne",freq:"libero"},
  {id:"mortadella",nome:"Mortadella",cat:"affettati",emoji:"?",kcal_p:311,prot_p:15,piramide:"carne",freq:"libero"},
  {id:"yogurt_g",nome:"Yogurt greco",cat:"latticini",emoji:"?",kcal_p:100,prot_p:10,piramide:"latticini",freq:"libero"},
  {id:"ricotta",nome:"Ricotta",cat:"latticini",emoji:"?",kcal_p:174,prot_p:11,piramide:"latticini",freq:"libero"},
  {id:"mozzarella",nome:"Mozzarella",cat:"latticini",emoji:"?",kcal_p:280,prot_p:18,piramide:"latticini",freq:"libero"},
  {id:"feta",nome:"Feta",cat:"latticini",emoji:"?",kcal_p:264,prot_p:14,piramide:"latticini",freq:"libero"},
];

var VERDURE = [
  {id:"zucchine",nome:"Zucchine",emoji:"?",stagione:"estate,primavera",kcal_p:17,prot_p:1.2},
  {id:"melanzane",nome:"Melanzane",emoji:"?",stagione:"estate",kcal_p:25,prot_p:1.0},
  {id:"peperoni",nome:"Peperoni",emoji:"?",stagione:"estate",kcal_p:31,prot_p:1.0},
  {id:"pomodori",nome:"Pomodori",emoji:"?",stagione:"estate",kcal_p:18,prot_p:0.9},
  {id:"spinaci",nome:"Spinaci",emoji:"?",stagione:"inverno,primavera",kcal_p:23,prot_p:2.9},
  {id:"broccoli",nome:"Broccoli",emoji:"?",stagione:"autunno,inverno",kcal_p:34,prot_p:2.8},
  {id:"cavolfiore",nome:"Cavolfiore",emoji:"?",stagione:"autunno,inverno",kcal_p:25,prot_p:1.9},
  {id:"carote",nome:"Carote",emoji:"?",stagione:"tutto",kcal_p:41,prot_p:0.9},
  {id:"funghi",nome:"Funghi",emoji:"?",stagione:"autunno",kcal_p:22,prot_p:3.1},
  {id:"asparagi",nome:"Asparagi",emoji:"?",stagione:"primavera",kcal_p:20,prot_p:2.2},
  {id:"fagiolini",nome:"Fagiolini",emoji:"?",stagione:"estate",kcal_p:31,prot_p:1.8},
  {id:"insalata",nome:"Insalata mista",emoji:"?",stagione:"tutto",kcal_p:15,prot_p:1.3},
  {id:"cipolla",nome:"Cipolla",emoji:"?",stagione:"tutto",kcal_p:40,prot_p:1.1},
  {id:"aglio",nome:"Aglio",emoji:"?",stagione:"tutto",kcal_p:149,prot_p:6.4},
  {id:"pomodori_c",nome:"Pomodorini",emoji:"?",stagione:"estate",kcal_p:18,prot_p:0.9},
  {id:"rucola",nome:"Rucola",emoji:"?",stagione:"tutto",kcal_p:25,prot_p:2.6},
  {id:"zucca",nome:"Zucca",emoji:"?",stagione:"autunno",kcal_p:26,prot_p:1.0},
  {id:"cavolo_n",nome:"Cavolo nero",emoji:"?",stagione:"inverno",kcal_p:35,prot_p:3.3},
  {id:"bietola",nome:"Bietola",emoji:"?",stagione:"tutto",kcal_p:19,prot_p:1.8},
  {id:"piselli_v",nome:"Piselli",emoji:"?",stagione:"primavera",kcal_p:81,prot_p:5.4},
];

var FRUTTA = [
  {id:"mele",nome:"Mele",emoji:"?",stagione:"autunno,inverno",kcal_p:52,prot_p:0.3},
  {id:"pere",nome:"Pere",emoji:"?",stagione:"autunno",kcal_p:57,prot_p:0.4},
  {id:"arance",nome:"Arance",emoji:"?",stagione:"inverno",kcal_p:47,prot_p:0.9},
  {id:"fragole",nome:"Fragole",emoji:"?",stagione:"primavera",kcal_p:32,prot_p:0.7},
  {id:"pesche",nome:"Pesche",emoji:"?",stagione:"estate",kcal_p:39,prot_p:0.9},
  {id:"anguria",nome:"Anguria",emoji:"?",stagione:"estate",kcal_p:30,prot_p:0.6},
  {id:"uva",nome:"Uva",emoji:"?",stagione:"autunno",kcal_p:69,prot_p:0.6},
  {id:"banana",nome:"Banana",emoji:"?",stagione:"tutto",kcal_p:89,prot_p:1.1},
  {id:"kiwi",nome:"Kiwi",emoji:"?",stagione:"inverno,primavera",kcal_p:61,prot_p:1.1},
  {id:"mirtilli",nome:"Mirtilli",emoji:"?",stagione:"estate",kcal_p:57,prot_p:0.7},
  {id:"ciliegie",nome:"Ciliegie",emoji:"?",stagione:"estate",kcal_p:50,prot_p:1.0},
  {id:"fichi",nome:"Fichi",emoji:"?",stagione:"estate",kcal_p:74,prot_p:0.8},
];

var SALSE = [
  {id:"pomodoro",nome:"Passata di pomodoro",emoji:"?",cat:"base"},
  {id:"pesto",nome:"Pesto genovese",emoji:"?",cat:"base"},
  {id:"ragu",nome:"Ragu di carne",emoji:"?",cat:"base"},
  {id:"besciamella",nome:"Besciamella",emoji:"?",cat:"base"},
  {id:"curry",nome:"Curry",emoji:"?",cat:"etnica"},
  {id:"salsa_soy",nome:"Salsa di soia",emoji:"?",cat:"etnica"},
  {id:"pesto_r",nome:"Pesto rosso",emoji:"?",cat:"base"},
];

var GRASSI = [
  {id:"olio_evo",nome:"Olio EVO",emoji:"?",cat:"oli"},
  {id:"burro",nome:"Burro",emoji:"?",cat:"burri"},
  {id:"noci",nome:"Noci",emoji:"?",cat:"frutta_sec"},
  {id:"mandorle",nome:"Mandorle",emoji:"?",cat:"frutta_sec"},
];

var SPEZIE = [
  {id:"basilico",nome:"Basilico",emoji:"?",cat:"erbe"},
  {id:"rosmarino",nome:"Rosmarino",emoji:"?",cat:"erbe"},
  {id:"origano",nome:"Origano",emoji:"?",cat:"erbe"},
  {id:"peperoncino",nome:"Peperoncino",emoji:"?",cat:"spezie"},
  {id:"curcuma",nome:"Curcuma",emoji:"?",cat:"spezie"},
];

var PREPARAZIONI = {
  spaghetti:[{id:"pom",nome:"Al pomodoro",emoji:"?"},{id:"aco",nome:"Aglio olio",emoji:"?"},{id:"car",nome:"Carbonara",emoji:"?"},{id:"pes",nome:"Al pesto",emoji:"?"}],
  rigatoni:[{id:"ama",nome:"Amatriciana",emoji:"?"},{id:"cac",nome:"Cacio e pepe",emoji:"?"},{id:"rag",nome:"Al ragu",emoji:"?"}],
  penne:[{id:"arr",nome:"Arrabbiata",emoji:"?"},{id:"pes2",nome:"Al pesto",emoji:"?"}],
  gnocchi:[{id:"bur",nome:"Burro e salvia",emoji:"?"},{id:"gor",nome:"Al gorgonzola",emoji:"?"}],
  lasagne:[{id:"cla",nome:"Classica",emoji:"?"},{id:"veg",nome:"Alle verdure",emoji:"?"}],
  patate:[{id:"pur",nome:"Puree",emoji:"?"},{id:"arr2",nome:"Arrosto",emoji:"?"},{id:"vap",nome:"Al vapore",emoji:"?"}],
  uova:[{id:"str",nome:"Strapazzate",emoji:"?"},{id:"sod",nome:"Sode",emoji:"?"},{id:"fri",nome:"Frittata",emoji:"?"},{id:"pan",nome:"Pancakes",emoji:"?"}],
  pollo_f:[{id:"gri",nome:"Grigliato",emoji:"?"},{id:"forn",nome:"Al forno",emoji:"?"},{id:"pan2",nome:"Panato",emoji:"?"}],
  salmone:[{id:"forn2",nome:"Al forno",emoji:"?"},{id:"gri2",nome:"Grigliato",emoji:"?"},{id:"cru",nome:"Marinato",emoji:"?"}],
  merluzzo:[{id:"vap2",nome:"Al vapore",emoji:"?"},{id:"forn3",nome:"Al forno",emoji:"?"}],
  ceci:[{id:"zup",nome:"Zuppa",emoji:"?"},{id:"hum",nome:"Hummus",emoji:"?"}],
  lenticchie:[{id:"zup2",nome:"Zuppa",emoji:"?"},{id:"cur",nome:"Al curry",emoji:"?"}],
  avena:[{id:"por",nome:"Porridge",emoji:"?"},{id:"ove",nome:"Overnight oats",emoji:"?"}],
  pancakes:[{id:"mie",nome:"Con miele",emoji:"?"},{id:"fru",nome:"Con frutta",emoji:"?"},{id:"cno",nome:"Con crema nocciole",emoji:"?"}],
  fette_int:[{id:"mar",nome:"Con marmellata",emoji:"?"},{id:"crn",nome:"Con crema nocciole",emoji:"?"},{id:"avo",nome:"Con avocado",emoji:"?"}],
  gallette:[{id:"mar2",nome:"Con marmellata",emoji:"?"},{id:"crn2",nome:"Con crema nocciole",emoji:"?"},{id:"ric",nome:"Con ricotta",emoji:"?"}],
  _verdura:[{id:"cru2",nome:"Crude",emoji:"?"},{id:"vap3",nome:"Al vapore",emoji:"?"},{id:"pad",nome:"In padella",emoji:"?"},{id:"forn4",nome:"Al forno",emoji:"?"},{id:"gri3",nome:"Grigliate",emoji:"?"}],
  _frutta:[{id:"fre",nome:"Fresca",emoji:"?"},{id:"mac",nome:"Macedonia",emoji:"?"},{id:"fru2",nome:"Frullato",emoji:"?"}],
  _latticino:[{id:"nat",nome:"Al naturale",emoji:"?"},{id:"cfr",nome:"Con frutta",emoji:"?"}],
};

function getPrep(id, tipo) {
  if(PREPARAZIONI[id]) return PREPARAZIONI[id];
  if(tipo==="verdura"||tipo==="verdura2") return PREPARAZIONI._verdura;
  if(tipo==="frutta") return PREPARAZIONI._frutta;
  if(tipo==="latticino") return PREPARAZIONI._latticino;
  return [{id:"lib",nome:"Libero",emoji:""}];
}

function getStagione() {
  var m = new Date().getMonth();
  if(m>=2&&m<=4) return "primavera";
  if(m>=5&&m<=7) return "estate";
  if(m>=8&&m<=10) return "autunno";
  return "inverno";
}

// ── COMPONENTS ───────────────────────────────────────────────

function PiattoVisivo(props) {
  var carbo=props.carbo, prot=props.prot, verdura=props.verdura;
  var isPrinc=props.isPrinc;
  var c=!!carbo, p=!!prot, v=!!verdura;
  var ok=isPrinc?(c&&p&&v):(c||p||props.frutta||props.lattic);
  return (
    <div style={{background:"#fff",borderRadius:12,padding:"8px",
      boxShadow:"0 1px 6px rgba(0,0,0,.07)",marginBottom:8,textAlign:"center"}}>
      <div style={{fontSize:9,fontWeight:700,color:ok?"#2E5F8A":"#888",marginBottom:5}}>
        {ok?"Pasto ok":"Piatto"}
      </div>
      <div style={{width:80,height:80,borderRadius:"50%",margin:"0 auto 6px",
        border:"3px solid "+(ok?"#2E5F8A":"#ddd"),
        overflow:"hidden",display:"flex",flexWrap:"wrap"}}>
        {isPrinc ? (
          <div style={{width:"100%",height:"100%",display:"flex",flexWrap:"wrap"}}>
            <div style={{width:"50%",height:"50%",background:c?"#D4A01799":"#f0f0f0"}}/>
            <div style={{width:"50%",height:"50%",background:v?"#52B78899":"#f0f0f0"}}/>
            <div style={{width:"100%",height:"50%",background:p?"#E07A5F99":"#f0f0f0"}}/>
          </div>
        ) : (
          <div style={{width:"100%",height:"100%",
            background:props.frutta?"#E07A5F88":props.lattic?"#5390D988":carbo?"#D4A01788":"#f0f0f0"}}/>
        )}
      </div>
      {isPrinc && (
        <div style={{display:"flex",flexDirection:"column",gap:3}}>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:c?"#D4A017":"#ddd"}}/>
            <span style={{fontSize:8,color:c?"#D4A017":"#bbb"}}>{c?"Carbo":"manca C"}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:v?"#52B788":"#ddd"}}/>
            <span style={{fontSize:8,color:v?"#52B788":"#bbb"}}>{v?"Verdura":"manca V"}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:p?"#E07A5F":"#ddd"}}/>
            <span style={{fontSize:8,color:p?"#E07A5F":"#bbb"}}>{p?"Prot.":"manca P"}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function PiramideLive(props) {
  var scelte=props.scelte;
  var conteggi={cereali:0,verdura:0,frutta:0,legumi:0,pesce:0,carne:0,carne_rossa:0,uova:0,latticini:0};
  Object.values(scelte).forEach(function(s){
    if(!s) return;
    if(s.carbo) conteggi.cereali++;
    if(s.verdura) conteggi.verdura++;
    if(s.verdura2) conteggi.verdura++;
    if(s.frutta) conteggi.frutta++;
    if(s.latticino) conteggi.latticini++;
    if(s.proteina) {
      var p=PROTEINE.find(function(x){return x.id===s.proteina;});
      if(p&&conteggi[p.piramide]!==undefined) conteggi[p.piramide]++;
    }
  });
  var rows=[
    {id:"cereali",label:"Cereali",target:14,color:"#D4A017"},
    {id:"verdura",label:"Verdura",target:35,color:"#52B788"},
    {id:"frutta",label:"Frutta",target:21,color:"#E07A5F"},
    {id:"legumi",label:"Legumi",target:3,color:"#8E44AD"},
    {id:"pesce",label:"Pesce",target:3,color:"#5390D9"},
    {id:"carne",label:"Carne bianca",target:3,color:"#F4A261"},
    {id:"carne_rossa",label:"Carne rossa",target:1,color:"#C0392B"},
    {id:"uova",label:"Uova",target:2,color:"#D4A017"},
    {id:"latticini",label:"Latticini",target:14,color:"#5390D9"},
  ];
  return (
    <div style={{background:"#fff",borderRadius:12,padding:"8px",
      boxShadow:"0 1px 6px rgba(0,0,0,.07)"}}>
      <div style={{fontSize:9,fontWeight:700,color:"#2E5F8A",marginBottom:6}}>Piramide</div>
      {rows.map(function(r){
        var val=conteggi[r.id]||0;
        var pct=Math.min(100,Math.round(val/r.target*100));
        return (
          <div key={r.id} style={{marginBottom:4}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:8,marginBottom:1}}>
              <span style={{color:"#666"}}>{r.label}</span>
              <span style={{fontWeight:700,color:r.color}}>{val}/{r.target}</span>
            </div>
            <div style={{background:"#f0f0f0",borderRadius:4,height:3}}>
              <div style={{width:pct+"%",height:"100%",background:r.color,borderRadius:4}}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Drop(props) {
  var sel=props.opts.find(function(o){return o.id===props.value;});
  return (
    <div style={{marginBottom:8}}>
      <div style={{fontSize:9,fontWeight:700,marginBottom:3,
        color:props.warn?"#C0392B":props.color||"#555"}}>{props.label}</div>
      <select value={props.value||""} onChange={function(e){props.onChange(e.target.value||null);}}
        style={{width:"100%",padding:"7px 10px",borderRadius:10,
          border:"1.5px solid "+(props.value?props.color:props.warn?"#C0392B":"#ddd"),
          background:props.value?props.color+"15":"#fff",
          color:props.value?"#222":"#888",fontSize:11,cursor:"pointer",outline:"none"}}>
        <option value="">-- scegli --</option>
        {props.opts.map(function(o){
          return (
            <option key={o.id} value={o.disabled?"":o.id} disabled={!!o.disabled}>
              {o.emoji?o.emoji+"?":""}{o.nome}
            </option>
          );
        })}
      </select>
      {sel&&!sel.disabled&&(
        <div style={{display:"flex",justifyContent:"space-between",padding:"2px 4px 0"}}>
          <span style={{fontSize:10,color:props.color,fontWeight:700}}>{sel.emoji} {sel.nome}</span>
          <button onClick={function(){props.onChange(null);}}
            style={{background:"none",border:"none",color:"#ccc",fontSize:13,cursor:"pointer"}}>x</button>
        </div>
      )}
    </div>
  );
}

function TwoLevelDrop(props) {
  var db=props.db, cats=props.cats, value=props.value;
  var selItem=db.find(function(x){return x.id===value;});
  var selCat=selItem?selItem.cat:null;
  var firstCat=Object.keys(cats)[0];
  var openCatState=useState(selCat||firstCat||null);
  var openCat=openCatState[0];
  var setOpenCat=openCatState[1];
  var itemsForCat=openCat?db.filter(function(x){return x.cat===openCat;}):[];
  return (
    <div style={{marginBottom:10}}>
      <div style={{fontSize:9,fontWeight:700,marginBottom:5,color:props.warn?"#C0392B":props.color||"#555"}}>
        {props.label}
        {selItem&&<span style={{marginLeft:6,fontWeight:800,fontSize:10,color:props.color}}>{selItem.emoji} {selItem.nome}</span>}
        {selItem&&<button onClick={function(){props.onChange(null);}} style={{marginLeft:6,background:"none",border:"none",color:"#aaa",fontSize:11,cursor:"pointer"}}>x</button>}
      </div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:openCat?6:0}}>
        {Object.keys(cats).map(function(cat){
          var nome=cats[cat];
          if(!db.some(function(x){return x.cat===cat;})) return null;
          var isSel=openCat===cat;
          var hasVal=selItem&&selItem.cat===cat;
          return (
            <button key={cat} onClick={function(){setOpenCat(isSel&&!hasVal?null:cat);}}
              style={{padding:"5px 11px",borderRadius:20,fontSize:10,cursor:"pointer",
                border:"1.5px solid "+(hasVal?"#2E5F8A":isSel?props.color:props.warn?"#C0392B":"#ddd"),
                background:hasVal?"#2E5F8A":isSel?props.color+"15":"#fff",
                color:hasVal?"#fff":isSel?props.color:"#555",
                fontWeight:hasVal||isSel?700:400}}>
              {nome}
            </button>
          );
        })}
      </div>
      {openCat&&itemsForCat.length>0&&(
        <div style={{background:"#F5F8FC",borderRadius:10,padding:"8px",border:"1.5px solid "+props.color+"33"}}>
          <select value={selItem&&selItem.cat===openCat?value:""} onChange={function(e){props.onChange(e.target.value||null);}}
            style={{width:"100%",padding:"7px 10px",borderRadius:8,
              border:"1.5px solid "+(value&&selItem&&selItem.cat===openCat?props.color:"#ddd"),
              fontSize:11,cursor:"pointer",outline:"none"}}>
            <option value="">-- scegli --</option>
            {itemsForCat.map(function(o){
              return (
                <option key={o.id} value={o.id}>
                  {o.emoji?o.emoji+"?":""}{o.nome}
                </option>
              );
            })}
          </select>
        </div>
      )}
    </div>
  );
}

function NutriPanel(props) {
  var allDB = CARBOIDRATI.concat(PROTEINE).concat(VERDURE).concat(FRUTTA);
  var PORZ = {pasta:80,riso:80,cereali:70,tuberi:180,pane:60,colazione:50,
    "carne bianca":150,"carne rossa":150,pesce:150,uova:120,legumi:200,latticini:100,
    verdura:150,frutta:120};

  var items = [];
  function addItem(id, tipo) {
    if(!id) return;
    var it = allDB.find(function(x){return x.id===id;});
    if(!it||!it.kcal_p) return;
    var g = PORZ[it.cat||tipo] || 100;
    items.push({nome:it.nome, emoji:it.emoji, g:g, kcal:Math.round(it.kcal_p*g/100), prot:Math.round((it.prot_p||0)*g/100)});
  }
  addItem(props.carbo,"carbo");
  addItem(props.prot,"proteina");
  addItem(props.verd,"verdura");
  addItem(props.verd2,"verdura");
  addItem(props.frutta,"frutta");
  addItem(props.lattic,"latticino");

  if(!items.length) return null;

  var totKcal = items.reduce(function(s,x){return s+x.kcal;},0);
  var totProt = items.reduce(function(s,x){return s+x.prot;},0);

  var profili = [
    {nome:"Adulto",  mult:1.0,  target:600},
    {nome:"Adulta",  mult:0.85, target:500},
    {nome:"Bambino", mult:0.65, target:420},
    {nome:"Neonato", mult:0.25, target:180},
  ];

  return (
    <div style={{background:"#F5F8FC",borderRadius:10,padding:"10px 12px",marginBottom:8,border:"1.5px solid #C2D9EC"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontSize:10,fontWeight:800,color:"#2E5F8A"}}>Valori stimati pasto</div>
        <div style={{display:"flex",gap:10}}>
          <span style={{fontSize:12,fontWeight:800,color:"#2E5F8A"}}>{totKcal} <span style={{fontSize:9,fontWeight:400}}>kcal</span></span>
          {totProt>0&&<span style={{fontSize:12,fontWeight:800,color:"#E07A5F"}}>{totProt}<span style={{fontSize:9,fontWeight:400}}>g prot</span></span>}
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:2,marginBottom:8}}>
        {profili.map(function(p){
          var kc=Math.round(totKcal*p.mult);
          var pr=Math.round(totProt*p.mult);
          var pct=Math.min(100,Math.round(kc/p.target*100));
          return (
            <div key={p.nome} style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{minWidth:58,fontSize:9,color:"#555",fontWeight:600}}>{p.nome}</span>
              <span style={{minWidth:44,fontSize:9,fontWeight:700,color:"#2E5F8A"}}>{kc} kcal</span>
              {pr>0&&<span style={{minWidth:36,fontSize:9,color:"#E07A5F"}}>{pr}g</span>}
              <div style={{flex:1,background:"#ddd",borderRadius:4,height:4}}>
                <div style={{width:pct+"%",height:"100%",background:"#2E5F8A",borderRadius:4}}/>
              </div>
            </div>
          );
        })}
      </div>

      {(totProt>0||totKcal>0)&&(
        <div style={{background:"#FFF3E0",borderRadius:8,padding:"8px 10px",marginBottom:8,border:"1.5px solid #FFB74D"}}>
          <div style={{fontSize:9,fontWeight:800,color:"#E65100",marginBottom:4}}>Stima aproteico</div>
          <div style={{fontSize:9,color:"#555",lineHeight:1.6}}>
            Carbo normale + proteina ridotta (~20% adulto):
          </div>
          <div style={{display:"flex",gap:10,marginTop:4}}>
            <span style={{fontSize:11,fontWeight:800,color:"#E65100"}}>
              {Math.round(totKcal*0.7)} kcal
            </span>
            {totProt>0&&(
              <span style={{fontSize:11,fontWeight:800,color:Math.round(totProt*0.2)>5?"#C0392B":"#27AE60"}}>
                {Math.round(totProt*0.2)}g prot
                {Math.round(totProt*0.2)>5?"!! riduci proteina":"ok"}
              </span>
            )}
          </div>
          <div style={{fontSize:8,color:"#888",marginTop:3}}>
            Max 20g proteine/die — controlla con il dietologo la quota per pasto
          </div>
        </div>
      )}
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
        {items.map(function(it){
          return (
            <span key={it.nome} style={{fontSize:8,background:"#EBF3FA",color:"#2E5F8A",padding:"2px 7px",borderRadius:20}}>
              {it.emoji} {it.kcal}kcal{it.prot>0?" / "+it.prot+"g":""}
            </span>
          );
        })}
      </div>
      {totProt>0&&totKcal>0&&totProt/totKcal*100<10&&totKcal>300&&(
        <div style={{background:"#FFF3E0",borderRadius:6,padding:"5px 8px",fontSize:9,color:"#E65100"}}>
          Pasto ipoproteico (&lt;10% kcal da prot). Compatibile dieta ingrassante se carbo adeguati.
        </div>
      )}
      {totProt>0&&totKcal>0&&totProt/totKcal*100>25&&(
        <div style={{background:"#F0F7F4",borderRadius:6,padding:"5px 8px",fontSize:9,color:"#2D6A4F"}}>
          Pasto iperproteico (&gt;25% kcal da prot). Attenzione dieta ipoproteica.
        </div>
      )}
    </div>
  );
}

function CostruttorePasto(props) {
  var giorno=props.giorno, pasto=props.pasto, scelta=props.scelta;
  var onSalva=props.onSalva, stepEst=props.stepEst, setStepEst=props.setStepEst;
  var onLive=props.onLive, customIng=props.customIng||[], setCustomIng=props.setCustomIng;

  var tipo=PASTI_TIPO[pasto]||"pranzo";
  var isCol=tipo==="colazione", isSpu=tipo==="spuntino", isPrinc=tipo==="pranzo"||tipo==="cena";
  var stagione=getStagione();

  var s0=useState((scelta&&scelta.carbo)||null); var carbo=s0[0]; var setCarbo=s0[1];
  var s1=useState((scelta&&scelta.proteina)||null); var prot=s1[0]; var setProt=s1[1];
  var s2=useState((scelta&&scelta.verdura)||null); var verd=s2[0]; var setVerd=s2[1];
  var s3=useState((scelta&&scelta.verdura2)||null); var verd2=s3[0]; var setVerd2=s3[1];
  var s4=useState((scelta&&scelta.frutta)||null); var frutta=s4[0]; var setFrutta=s4[1];
  var s5=useState((scelta&&scelta.latticino)||null); var lattic=s5[0]; var setLattic=s5[1];
  var s6=useState((scelta&&scelta.salsa)||null); var salsa=s6[0]; var setSalsa=s6[1];
  var s7=useState((scelta&&scelta.prep)||{}); var prep=s7[0]; var setPrep=s7[1];
  var s8=useState((scelta&&scelta.nota)||""); var nota=s8[0]; var setNota=s8[1];
  var s9=useState(null); var addingCat=s9[0]; var setAddingCat=s9[1];
  var s10=useState(""); var newIngNome=s10[0]; var setNewIngNome=s10[1];
  var step=stepEst||1;
  var setStep=setStepEst||(function(){});

  function notify(updates) {
    if(onLive) {
      var obj={carbo:carbo,proteina:prot,verdura:verd,verdura2:verd2,frutta:frutta,latticino:lattic};
      Object.keys(updates).forEach(function(k){obj[k]=updates[k];});
      onLive(obj);
    }
  }
  function setCarboN(v){setCarbo(v);notify({carbo:v});}
  function setProtN(v){setProt(v);notify({proteina:v});}
  function setVerdN(v){setVerd(v);notify({verdura:v});}
  function setVerd2N(v){setVerd2(v);notify({verdura2:v});}
  function setFruttaN(v){setFrutta(v);notify({frutta:v});}
  function setLatticN(v){setLattic(v);notify({latticino:v});}

  var mancanti=isPrinc?[!carbo&&"carbo",!prot&&"prot",!verd&&"verdura"].filter(Boolean):[];
  var haQualcosa=!!(carbo||prot||frutta||lattic);
  var completo=isPrinc?(haQualcosa&&mancanti.length===0):haQualcosa;

  var CARBO_ALL=CARBOIDRATI.concat(customIng.filter(function(x){return ["pasta","riso","cereali","tuberi","pane","colazione"].indexOf(x.cat)>=0;}));
  var PROT_ALL=PROTEINE.concat(customIng.filter(function(x){return Object.keys(PROT_CATS).indexOf(x.cat)>=0;}));
  var stagVerd=VERDURE.filter(function(v){return v.stagione==="tutto"||v.stagione.indexOf(stagione)>=0;});
  var altriVerd=VERDURE.filter(function(v){return v.stagione!=="tutto"&&v.stagione.indexOf(stagione)<0;});
  var stagFru=FRUTTA.filter(function(f){return f.stagione==="tutto"||f.stagione.indexOf(stagione)>=0;});
  var altriF=FRUTTA.filter(function(f){return f.stagione!=="tutto"&&f.stagione.indexOf(stagione)<0;});

  function mkOpts(groups,db,keyFn,labelFn){
    return groups.reduce(function(acc,cat){
      return acc.concat([{id:"_"+cat,nome:labelFn(cat),emoji:"",disabled:true}].concat(db.filter(function(x){return keyFn(x)===cat;})));
    },[]);
  }
  var fruOpts=[{id:"_s",nome:"Di stagione",emoji:"",disabled:true}].concat(stagFru).concat([{id:"_a",nome:"Altra stagione",emoji:"",disabled:true}]).concat(altriF);
  var salsaOpts=mkOpts(["base","etnica"],SALSE,function(s){return s.cat;},function(c){return c==="base"?"Base":"Etniche";});
  var lattColOpts=mkOpts(["yogurt","latte"],PROTEINE.filter(function(p){return p.cat==="latticini";}),function(x){return x.cat;},function(){return "Latticini";});

  function aggiungi(){
    if(!newIngNome.trim()) return;
    var id="custom_"+Date.now();
    var nuovo={id:id,nome:newIngNome.trim(),cat:addingCat,emoji:"",kcal_p:200,prot_p:0,stagione:"tutto",custom:true};
    if(setCustomIng) setCustomIng(customIng.concat([nuovo]));
    setNewIngNome(""); setAddingCat(null);
  }

  var selCarbo=CARBOIDRATI.find(function(c){return c.id===carbo;});
  var selVerd=VERDURE.find(function(v){return v.id===verd;});

  function doSalva(){
    onSalva({carbo:carbo,proteina:prot,verdura:verd,verdura2:verd2,frutta:frutta,latticino:lattic,salsa:salsa,prep:prep,nota:nota});
  }

  return (
    <div style={{flex:1}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontSize:13,fontWeight:800,color:"#0D1B2A"}}>{giorno} - {pasto}</div>
        {isPrinc&&(
          <div style={{display:"flex",gap:4}}>
            <div style={{width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:carbo?"#D4A017":"#f0f0f0",border:"1.5px solid "+(carbo?"#D4A017":"#ddd")}}>
              <span style={{fontSize:9,fontWeight:800,color:carbo?"#fff":"#bbb"}}>C</span>
            </div>
            <div style={{width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:prot?"#E07A5F":"#f0f0f0",border:"1.5px solid "+(prot?"#E07A5F":"#ddd")}}>
              <span style={{fontSize:9,fontWeight:800,color:prot?"#fff":"#bbb"}}>P</span>
            </div>
            <div style={{width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:verd?"#52B788":"#f0f0f0",border:"1.5px solid "+(verd?"#52B788":"#ddd")}}>
              <span style={{fontSize:9,fontWeight:800,color:verd?"#fff":"#bbb"}}>V</span>
            </div>
            {completo&&<div style={{width:22,height:22,borderRadius:"50%",background:"#2E5F8A",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:9,fontWeight:800,color:"#fff"}}>ok</span></div>}
          </div>
        )}
      </div>

      {step===1&&(
        <div>
          {(isCol||isSpu)&&(
            <div>
              <Drop label="Frutta" value={frutta} onChange={setFruttaN} color="#E07A5F" opts={fruOpts}/>
              <Drop label="Latticini" value={lattic} onChange={setLatticN} color="#5390D9" opts={PROTEINE.filter(function(p){return p.cat==="latticini";}).map(function(p){return p;})}/>
              <Drop label="Cereali e pane" value={carbo} onChange={setCarboN} color="#D4A017"
                opts={CARBO_ALL.filter(function(c){return c.cat==="colazione"||c.cat==="pane";})}/>
            </div>
          )}

          {isPrinc&&(
            <div>
              {!carbo&&!prot&&(
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:9,fontWeight:700,color:"#888",marginBottom:6}}>Suggerimenti rapidi</div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    {[
                      {nome:"Spaghetti pomodoro",c:"spaghetti",s:"pomodoro",v:"pomodori"},
                      {nome:"Pollo e patate",c:"patate",p:"pollo_f",v:"carote"},
                      {nome:"Salmone e riso",c:"riso_b",p:"salmone",v:"spinaci"},
                      {nome:"Ceci e farro",c:"farro",p:"ceci",v:"carote"},
                      {nome:"Pasta al pesto",c:"penne",s:"pesto",v:"zucchine"},
                      {nome:"Merluzzo e patate",c:"patate",p:"merluzzo",v:"fagiolini"},
                    ].map(function(sug){
                      return (
                        <button key={sug.nome} onClick={function(){
                          if(sug.c) setCarboN(sug.c);
                          if(sug.p) setProtN(sug.p);
                          if(sug.v) setVerdN(sug.v);
                          if(sug.s) setSalsa(sug.s);
                        }} style={{padding:"6px 12px",borderRadius:20,fontSize:10,cursor:"pointer",
                          border:"1.5px solid #C2D9EC",background:"#EBF3FA",color:"#2E5F8A",fontWeight:600}}>
                          {sug.nome}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <TwoLevelDrop label="Carboidrati" value={carbo} onChange={setCarboN} cats={CARBO_CATS} db={CARBO_ALL} color="#D4A017" warn={!carbo}/>

              <TwoLevelDrop label="Proteine" value={prot} onChange={setProtN} cats={PROT_CATS} db={PROT_ALL} color="#E07A5F" warn={!prot}/>

              <div style={{marginBottom:10}}>
                <div style={{fontSize:9,fontWeight:700,marginBottom:5,color:!verd?"#C0392B":"#52B788"}}>
                  Verdura
                  {verd&&<span style={{marginLeft:6,fontSize:10}}>{selVerd&&(selVerd.emoji+"?"+selVerd.nome)}<button onClick={function(){setVerdN(null);}} style={{marginLeft:4,background:"none",border:"none",color:"#aaa",fontSize:11,cursor:"pointer"}}>x</button></span>}
                </div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:4}}>
                  {stagVerd.slice(0,12).map(function(v){
                    return (
                      <button key={v.id} onClick={function(){setVerdN(verd===v.id?null:v.id);}}
                        style={{padding:"5px 9px",borderRadius:20,fontSize:9,cursor:"pointer",
                          border:"1.5px solid "+(verd===v.id?"#52B788":"#ddd"),
                          background:verd===v.id?"#52B788":"#fff",
                          color:verd===v.id?"#fff":"#444",fontWeight:verd===v.id?700:400}}>
                        {v.emoji} {v.nome}
                      </button>
                    );
                  })}
                </div>
              </div>

              {verd&&(
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:9,fontWeight:700,color:"#2D6A4F",marginBottom:4}}>
                    2a verdura (opz.) {verd2&&<button onClick={function(){setVerd2N(null);}} style={{marginLeft:4,background:"none",border:"none",color:"#aaa",fontSize:11,cursor:"pointer"}}>x</button>}
                  </div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    {stagVerd.filter(function(v){return v.id!==verd;}).slice(0,8).map(function(v){
                      return (
                        <button key={v.id} onClick={function(){setVerd2N(verd2===v.id?null:v.id);}}
                          style={{padding:"4px 8px",borderRadius:20,fontSize:9,cursor:"pointer",
                            border:"1.5px solid "+(verd2===v.id?"#2D6A4F":"#ddd"),
                            background:verd2===v.id?"#2D6A4F":"#fff",
                            color:verd2===v.id?"#fff":"#555"}}>
                          {v.emoji} {v.nome}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <Drop label="Salsa (opz.)" value={salsa} onChange={setSalsa} color="#E07A5F" opts={salsaOpts}/>
            </div>
          )}

          {haQualcosa&&(
            <NutriPanel carbo={carbo} prot={prot} verd={verd} verd2={verd2} frutta={frutta} lattic={lattic}/>
          )}

          <button onClick={function(){setStep(2);}} disabled={!haQualcosa}
            style={{width:"100%",padding:"11px",borderRadius:12,border:"none",marginTop:4,
              background:completo?"#2E5F8A":haQualcosa?"#6B9EC4":"#ddd",
              color:"#fff",fontSize:12,fontWeight:800,cursor:haQualcosa?"pointer":"default"}}>
            {completo?"Avanti: come li cucini?":haQualcosa?"Avanti (manca: "+mancanti.join(", ")+")":"Seleziona alimento"}
          </button>
        </div>
      )}

      {step===2&&(
        <div>
          <div style={{background:"linear-gradient(135deg,#C2355A,#E8637A)",borderRadius:12,padding:"10px 14px",marginBottom:12,color:"#fff"}}>
            <div style={{fontSize:9,opacity:0.7,marginBottom:2}}>Passo 2 di 2</div>
            <div style={{fontSize:13,fontWeight:800}}>{[selCarbo&&selCarbo.nome,prot&&(PROTEINE.find(function(p){return p.id===prot;})||{}).nome].filter(Boolean).join(" + ")||"Come li cucini?"}</div>
          </div>

          {[{id:carbo,tipo:"carbo"},{id:prot,tipo:"proteina"},{id:verd,tipo:"verdura"},{id:frutta,tipo:"frutta"},{id:lattic,tipo:"latticino"}].filter(function(x){return x.id;}).map(function(x){
            var allIt=CARBOIDRATI.concat(PROTEINE).concat(VERDURE).concat(FRUTTA);
            var ing=allIt.find(function(a){return a.id===x.id;});
            if(!ing) return null;
            var pl=getPrep(x.id,x.tipo);
            if(!pl||!pl.length) return null;
            var selPrep=prep[x.id];
            return (
              <div key={x.id} style={{background:"#fff",borderRadius:12,padding:"10px 12px",marginBottom:8,boxShadow:"0 1px 6px rgba(0,0,0,.07)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <span style={{fontSize:11,fontWeight:800}}>{ing.emoji} {ing.nome}</span>
                  {selPrep&&<span style={{fontSize:9,background:"#EBF3FA",color:"#2E5F8A",fontWeight:700,padding:"2px 8px",borderRadius:20}}>{(pl.find(function(p){return p.id===selPrep;})||{}).nome}</span>}
                </div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {pl.map(function(p){
                    return (
                      <button key={p.id} onClick={function(){
                        var n=Object.assign({},prep);
                        n[x.id]=prep[x.id]===p.id?null:p.id;
                        setPrep(n);
                      }} style={{padding:"5px 10px",borderRadius:20,fontSize:10,cursor:"pointer",
                        border:"1.5px solid "+(selPrep===p.id?"#2E5F8A":"#ddd"),
                        background:selPrep===p.id?"#2E5F8A":"#fff",
                        color:selPrep===p.id?"#fff":"#444"}}>
                        {p.emoji} {p.nome}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div style={{marginBottom:12}}>
            <div style={{fontSize:10,fontWeight:700,color:"#555",marginBottom:6}}>Note</div>
            <textarea value={nota} onChange={function(e){setNota(e.target.value);}}
              placeholder="Es. marinato al limone..." rows={2}
              style={{width:"100%",padding:"8px 10px",borderRadius:10,border:"1.5px solid #ddd",
                fontSize:11,resize:"none",fontFamily:"inherit",boxSizing:"border-box"}}></textarea>
          </div>

          <div style={{display:"flex",gap:8}}>
            <button onClick={function(){setStep(1);}}
              style={{flex:1,padding:"10px",borderRadius:12,border:"1.5px solid #ddd",background:"#fff",fontSize:11,cursor:"pointer",color:"#555"}}>
              Indietro
            </button>
            <button onClick={doSalva}
              style={{flex:2,padding:"10px",borderRadius:12,border:"none",background:"#2E5F8A",color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer"}}>
              Salva pasto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function GrigliaSettimana(props) {
  var scelte=props.scelte, GIORNI=props.GIORNI, PASTI=props.PASTI;
  var giornoSel=props.giornoSel, pastoSel=props.pastoSel;
  var cambiaGiorno=props.cambiaGiorno, cambiaPasto=props.cambiaPasto;
  var setPopup=props.setPopup;
  var allIt=CARBOIDRATI.concat(PROTEINE).concat(VERDURE).concat(FRUTTA);
  var pasti5=["Colazione","Spuntino","Pranzo","Merenda","Cena"];
  var rows=[];

  GIORNI.forEach(function(g,gi){
    var isSel=gi===giornoSel;
    rows.push(
      <div key={"g"+gi} onClick={function(){cambiaGiorno(gi);}}
        style={{fontSize:10,fontWeight:isSel?800:500,color:isSel?"#2E5F8A":"#666",
          cursor:"pointer",background:isSel?"#EBF3FA":"transparent",
          borderRadius:6,padding:"2px 3px",display:"flex",alignItems:"center"}}>
        {g.slice(0,3)}
      </div>
    );
    pasti5.forEach(function(pasto){
      var s=scelte[g+"-"+pasto];
      if(!s){
        rows.push(<div key={g+pasto} onClick={function(){cambiaGiorno(gi);cambiaPasto(pasto);}} style={{background:"#fafafa",borderRadius:6,minHeight:26,cursor:"pointer",border:"1px dashed #eee"}}/>);
        return;
      }
      var protItem=allIt.find(function(x){return x.id===s.proteina;});
      var carboItem=allIt.find(function(x){return x.id===s.carbo;});
      var fruttaItem=allIt.find(function(x){return x.id===s.frutta;});
      var cat=protItem?protItem.cat:"";
      var bgMap={"pesce":"#EBF3FA","carne rossa":"#FDE8E4","uova":"#FFF8E1","legumi":"#F0F7F4","affettati":"#FAE0E5","carne bianca":"#E8F5E9"};
      var txMap={"pesce":"#1565C0","carne rossa":"#C0392B","uova":"#B7791F","legumi":"#2D6A4F","affettati":"#C2355A"};
      var bg=bgMap[cat]||(s.frutta?"#FFF3E0":"#f5f5f5");
      var tx=txMap[cat]||"#555";
      rows.push(
        <div key={g+pasto} onClick={function(){setPopup({giorno:g,pasto:pasto,s:s,gi:gi});}}
          style={{background:bg,borderRadius:6,padding:"3px 3px",cursor:"pointer",position:"relative",minHeight:26,
            border:isSel&&pastoSel===pasto?"2px solid #0D1B2A":"1.5px solid transparent"}}>
          {protItem&&<div style={{fontSize:8,fontWeight:700,color:tx,lineHeight:1.2}}>{protItem.emoji} {protItem.nome.slice(0,10)}</div>}
          {carboItem&&<div style={{fontSize:7,color:"#888",lineHeight:1.1}}>{carboItem.emoji} {carboItem.nome.slice(0,9)}</div>}
          {!protItem&&fruttaItem&&<div style={{fontSize:8,color:"#E07A5F"}}>{fruttaItem.emoji} {fruttaItem.nome.slice(0,10)}</div>}
        </div>
      );
    });
  });

  return (
    <div style={{display:"grid",gridTemplateColumns:"44px repeat(5,1fr)",gap:3}}>
      <div/>
      <div style={{fontSize:8,color:"#aaa",textAlign:"center"}}>Col</div>
      <div style={{fontSize:8,color:"#aaa",textAlign:"center"}}>Spu</div>
      <div style={{fontSize:8,color:"#aaa",textAlign:"center"}}>Pra</div>
      <div style={{fontSize:8,color:"#aaa",textAlign:"center"}}>Mer</div>
      <div style={{fontSize:8,color:"#aaa",textAlign:"center"}}>Cen</div>
      {rows}
    </div>
  );
}

function PopupPasto(props) {
  var data=props.data, scelte=props.scelte;
  var setScelte=props.setScelte, setPopup=props.setPopup;
  var cambiaGiorno=props.cambiaGiorno, cambiaPasto=props.cambiaPasto;
  var GIORNI=props.GIORNI, PASTI=props.PASTI;
  var giorno=data.giorno, pasto=data.pasto, s=data.s, gi=data.gi;
  var copyState=useState(false); var showCopia=copyState[0]; var setShowCopia=copyState[1];
  var allIt=CARBOIDRATI.concat(PROTEINE).concat(VERDURE).concat(FRUTTA).concat(SALSE);
  function find2(id){return allIt.find(function(x){return x.id===id;});}
  var ings=[
    {label:"Carbo",item:find2(s.carbo)},{label:"Proteina",item:find2(s.proteina)},
    {label:"Verdura",item:find2(s.verdura)},{label:"Verdura 2",item:find2(s.verdura2)},
    {label:"Frutta",item:find2(s.frutta)},{label:"Latticino",item:find2(s.latticino)},
    {label:"Salsa",item:find2(s.salsa)},
  ].filter(function(x){return x.item;});

  return (
    <div onClick={function(){setPopup(null);}}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:200,
        display:"flex",alignItems:"center",justifyContent:"center",padding:"0 16px"}}>
      <div onClick={function(e){e.stopPropagation();}}
        style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:440,
          maxHeight:"80vh",overflow:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
        <div style={{background:"linear-gradient(135deg,#0D1B2A,#2E5F8A)",
          padding:"16px 20px",borderRadius:"20px 20px 0 0",color:"#fff"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontSize:11,opacity:0.7,marginBottom:2}}>{giorno} - {pasto}</div>
              <div style={{fontSize:16,fontWeight:800}}>{s.nomePiatto||pasto}</div>
              {s.nota&&<div style={{fontSize:11,opacity:0.8,marginTop:4,fontStyle:"italic"}}>{s.nota}</div>}
            </div>
            <button onClick={function(){setPopup(null);}}
              style={{background:"rgba(255,255,255,.2)",border:"none",color:"#fff",
                width:32,height:32,borderRadius:"50%",fontSize:16,cursor:"pointer"}}>x</button>
          </div>
        </div>
        <div style={{padding:"16px 20px"}}>
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
            {ings.map(function(x){
              return (
                <div key={x.label} style={{display:"flex",alignItems:"center",gap:10,
                  padding:"7px 12px",background:"#F5F8FC",borderRadius:10}}>
                  <span style={{fontSize:18}}>{x.item.emoji}</span>
                  <div>
                    <div style={{fontSize:9,color:"#888",fontWeight:600}}>{x.label}</div>
                    <div style={{fontSize:12,fontWeight:700,color:"#0D1B2A"}}>{x.item.nome}</div>
                  </div>
                </div>
              );
            })}
          </div>
          {!showCopia?(
            <button onClick={function(){setShowCopia(true);}}
              style={{width:"100%",padding:"9px",borderRadius:12,marginBottom:8,
                border:"1.5px solid #C2D9EC",background:"#EBF3FA",color:"#2E5F8A",
                fontSize:11,fontWeight:700,cursor:"pointer"}}>
              Copia su altro giorno...
            </button>
          ):(
            <div style={{background:"#EBF3FA",borderRadius:12,padding:"12px",marginBottom:8}}>
              <div style={{fontSize:10,fontWeight:700,color:"#2E5F8A",marginBottom:8}}>Copia su:</div>
              {GIORNI.filter(function(g2){return g2!==giorno;}).map(function(g2){
                return (
                  <div key={g2} style={{marginBottom:5}}>
                    <div style={{fontSize:9,color:"#888",marginBottom:3}}>{g2}</div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      {PASTI.map(function(p2){
                        return (
                          <button key={p2} onClick={function(){
                            var n=Object.assign({},scelte);
                            n[g2+"-"+p2]=Object.assign({},s);
                            setScelte(n);
                            setPopup(null);
                          }} style={{padding:"4px 10px",borderRadius:20,fontSize:9,cursor:"pointer",
                            border:"1.5px solid #C2D9EC",background:"#fff",color:"#2E5F8A"}}>
                            {p2.slice(0,3)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{display:"flex",gap:8}}>
            <button onClick={function(){cambiaGiorno(gi);cambiaPasto(pasto);setPopup(null);}}
              style={{flex:1,padding:"11px",borderRadius:12,border:"none",background:"#2E5F8A",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>
              Modifica
            </button>
            <button onClick={function(){
              var n=Object.assign({},scelte);
              delete n[giorno+"-"+pasto];
              setScelte(n);
              setPopup(null);
            }} style={{padding:"11px 16px",borderRadius:12,border:"1.5px solid #FDE8E4",background:"#fff",color:"#C0392B",fontSize:12,cursor:"pointer"}}>
              Elimina
            </button>
          </div>
          {props.onSalvaRicetta&&(
            <button onClick={function(){
              var nome=window.prompt("Nome ricetta:")||pasto;
              if(nome) props.onSalvaRicetta({id:"r"+Date.now(),nome:nome,pasto:s,nota:s.nota,note_famiglia:{}});
              setPopup(null);
            }} style={{width:"100%",padding:"9px",borderRadius:12,marginTop:6,
              border:"1.5px solid #FAE0E5",background:"#FFF0F3",
              color:"#C2355A",fontSize:11,fontWeight:700,cursor:"pointer"}}>
              Salva come ricetta preferita
            </button>
          )}
        </div>
      </div>
    </div>
  );
}



// Categorie supermercato per la spesa
var CATS_SPESA = [
  {id:"ortofrutta",  l:"Ortofrutta",      emoji:"?", color:"#52B788"},
  {id:"carne_pesce", l:"Carne e Pesce",   emoji:"?", color:"#E07A5F"},
  {id:"pasta_riso",  l:"Pasta e Riso",    emoji:"?", color:"#D4A017"},
  {id:"pane_cereal", l:"Pane e Cereali",  emoji:"?", color:"#C9A85C"},
  {id:"latticini",   l:"Latticini e Uova",emoji:"?", color:"#5390D9"},
  {id:"salse_cond",  l:"Salse e Condim.", emoji:"?", color:"#8E44AD"},
  {id:"altro",       l:"Altro",           emoji:"?", color:"#888"},
];

// Mappa categoria DB -> categoria supermercato
function catSpesa(item) {
  var c = item.cat||"";
  if(["verdura"].indexOf(c)>=0 || VERDURE.some(function(v){return v.id===item.id;})) return "ortofrutta";
  if(FRUTTA.some(function(f){return f.id===item.id;})) return "ortofrutta";
  if(["carne bianca","carne rossa","pesce","affettati"].indexOf(c)>=0) return "carne_pesce";
  if(["uova"].indexOf(c)>=0) return "carne_pesce";
  if(["pasta","riso","cereali","tuberi"].indexOf(c)>=0) return "pasta_riso";
  if(["pane","colazione"].indexOf(c)>=0) return "pane_cereal";
  if(["latticini"].indexOf(c)>=0) return "latticini";
  if(["legumi"].indexOf(c)>=0) return "pasta_riso";
  if(SALSE.some(function(s){return s.id===item.id;})) return "salse_cond";
  if(GRASSI.some(function(g){return g.id===item.id;})) return "salse_cond";
  return "altro";
}

function SpesaItemsB(props) {
  var scelte=props.scelte, spesaCheck=props.spesaCheck, setSpesaCheck=props.setSpesaCheck;
  var allDB=CARBOIDRATI.concat(PROTEINE).concat(VERDURE).concat(FRUTTA).concat(SALSE).concat(GRASSI);
  var cats={}; CATS_SPESA.forEach(function(c){cats[c.id]=[];});
  var seen={};
  function tryAdd(id){
    if(!id||seen[id]) return;
    var it=allDB.find(function(x){return x.id===id;});
    if(!it) return; seen[id]=true;
    var c=catSpesa(it);
    if(cats[c]) cats[c].push(it);
  }
  Object.values(scelte).forEach(function(s){
    if(!s) return;
    tryAdd(s.carbo); tryAdd(s.proteina); tryAdd(s.verdura);
    tryAdd(s.verdura2); tryAdd(s.frutta); tryAdd(s.latticino); tryAdd(s.salsa);
  });
  return (
    <div>
      {CATS_SPESA.map(function(cat){
        var items=cats[cat.id];
        if(!items||!items.length) return null;
        return (
          <div key={cat.id} style={{marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,
              paddingBottom:4,borderBottom:"2px solid "+cat.color+"33"}}>
              <span style={{fontSize:14}}>{cat.emoji}</span>
              <span style={{fontSize:10,fontWeight:800,color:cat.color}}>{cat.l}</span>
              <span style={{fontSize:9,color:"#aaa"}}>({items.length})</span>
            </div>
            {items.map(function(it){
              var chk=spesaCheck[it.id]||false;
              return (
                <div key={it.id} onClick={function(){var n=Object.assign({},spesaCheck);n[it.id]=!chk;setSpesaCheck(n);}}
                  style={{display:"flex",alignItems:"center",gap:8,padding:"7px 4px",
                    borderBottom:"1px solid #f8f8f8",cursor:"pointer",opacity:chk?0.4:1}}>
                  <div style={{width:20,height:20,borderRadius:5,border:"1.5px solid "+(chk?cat.color:"#ddd"),
                    background:chk?cat.color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    {chk&&<span style={{color:"#fff",fontSize:11,fontWeight:800}}>v</span>}
                  </div>
                  <span style={{fontSize:11,flex:1,textDecoration:chk?"line-through":"none"}}>{it.emoji} {it.nome}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}


function TabBuilder({menu, setMenuOverride, profili, builderScelte, setBuilderScelte, builderScelteProssima, setBuilderScelteProssima, onSavePasto}) {
  var GIORNI_B = ["Lunedi","Martedi","Mercoledi","Giovedi","Venerdi","Sabato","Domenica"];
  var PASTI_B  = ["Colazione","Spuntino","Pranzo","Merenda","Cena"];

  var scelte=builderScelte; var setScelte=setBuilderScelte;
  var s1=useState(0); var giornoSel=s1[0]; var setGiornoSel=s1[1];
  var s2=useState("Pranzo"); var pastoSel=s2[0]; var setPastoSel=s2[1];
  var s3=useState(1); var stepCorrente=s3[0]; var setStepCorrente=s3[1];
  var s4=useState(false); var step2Done=s4[0]; var setStep2Done=s4[1];
  var s5=useState({}); var liveScelta=s5[0]; var setLiveScelta=s5[1];
  var s6=useState(false); var showSpesa=s6[0]; var setShowSpesa=s6[1];
  var s7=useState({}); var spesaCheck=s7[0]; var setSpesaCheck=s7[1];
  var s8=useState(null); var popup=s8[0]; var setPopup=s8[1];
  var s9=useState([]); var customIng=s9[0]; var setCustomIng=s9[1];
  var s10=useState(0); var settB=s10[0]; var setSettB=s10[1]; // 0=questa sett, 1=prossima
  var scelteProssima=builderScelteProssima; var setScelteProssima=setBuilderScelteProssima;
  var s12=useState(null); var showRicette=s12[0]; var setShowRicette=s12[1];
  var s13=useState([]); var ricette=s13[0]; var setRicette=s13[1];

  // Scelte attive in base alla settimana selezionata
  var scelteAttive = settB===0 ? scelte : scelteProssima;
  var setScelteAttive = settB===0 ? setScelte : setScelteProssima;

  var key=GIORNI_B[giornoSel]+"-"+pastoSel;
  var sceltaCorrente=scelteAttive[key]||null;

  function hasSaved(g,p){var s=scelteAttive[g+"-"+p];return !!(s&&(s.carbo||s.proteina||s.frutta||s.latticino));}
  function isCompleto(g,p){var s=scelteAttive[g+"-"+p];if(!s)return false;var t=PASTI_TIPO[p]||"pranzo";if(t==="pranzo"||t==="cena")return !!(s.carbo&&s.proteina&&s.verdura);return !!(s.carbo||s.frutta||s.latticino);}
  function cambiaGiorno(i){setGiornoSel(i);setStepCorrente(1);setLiveScelta(scelteAttive[GIORNI_B[i]+"-"+pastoSel]||{});}
  function cambiaPasto(p){setPastoSel(p);setStepCorrente(1);setLiveScelta(scelteAttive[GIORNI_B[giornoSel]+"-"+p]||{});}

  function salva(dati) {
    var n=Object.assign({},scelteAttive);
    n[key]=dati;
    setScelteAttive(n);
    if(onSavePasto) onSavePasto(settB, GIORNI_B[giornoSel], pastoSel, dati);
    setStep2Done(true);
    setStepCorrente(1);
    var idx=PASTI_B.indexOf(pastoSel);
    if(idx<PASTI_B.length-1){
      setTimeout(function(){cambiaPasto(PASTI_B[idx+1]);setStep2Done(false);},800);
    } else if(giornoSel<GIORNI_B.length-1){
      setTimeout(function(){cambiaGiorno(giornoSel+1);setPastoSel(PASTI_B[0]);setStep2Done(false);},800);
    } else {
      setTimeout(function(){setStep2Done(false);},1500);
    }
  }

  var completati=GIORNI_B.reduce(function(n,g){return n+PASTI_B.filter(function(p){return isCompleto(g,p);}).length;},0);
  var totale=GIORNI_B.length*PASTI_B.length;

  return (
    <div style={{background:"#F5F8FC",minHeight:"60vh"}}>
      <div style={{display:"flex",gap:6,marginBottom:10,alignItems:"center"}}>
        <button onClick={function(){setSettB(0);setStepCorrente(1);}}
          style={{flex:1,padding:"8px",borderRadius:10,border:"2px solid "+(settB===0?"#2E5F8A":"#eee"),
            background:settB===0?"#2E5F8A":"#fff",color:settB===0?"#fff":"#888",
            fontSize:11,fontWeight:settB===0?800:400,cursor:"pointer"}}>
          Questa settimana
        </button>
        <button onClick={function(){setSettB(1);setStepCorrente(1);}}
          style={{flex:1,padding:"8px",borderRadius:10,border:"2px solid "+(settB===1?"#2E5F8A":"#eee"),
            background:settB===1?"#2E5F8A":"#fff",color:settB===1?"#fff":"#888",
            fontSize:11,fontWeight:settB===1?800:400,cursor:"pointer"}}>
          Settimana prossima
        </button>
        <button onClick={function(){
          if(window.confirm("Copia il menu di questa settimana nella prossima?")) {
            setScelteProssima(Object.assign({},scelte));
          }
        }} title="Copia questa sett. nella prossima"
          style={{padding:"8px 10px",borderRadius:10,border:"1.5px solid #C2D9EC",
            background:"#EBF3FA",color:"#2E5F8A",fontSize:11,cursor:"pointer",fontWeight:700}}>
          Copia
        </button>
        <button onClick={function(){setShowRicette(true);}}
          title="Ricette salvate"
          style={{padding:"8px 10px",borderRadius:10,border:"1.5px solid #FAE0E5",
            background:"#FFF0F3",color:"#C2355A",fontSize:11,cursor:"pointer",fontWeight:700}}>
          Ricette
        </button>
      </div>

      {settB===1&&(
        <div style={{background:"#EBF3FA",borderRadius:8,padding:"6px 10px",marginBottom:8,fontSize:10,color:"#2E5F8A",fontWeight:600}}>
          Stai pianificando la settimana prossima
        </div>
      )}

      <div style={{background:"linear-gradient(135deg,#0D1B2A,#2E5F8A)",padding:"10px 14px",borderRadius:12,marginBottom:10,color:"#fff"}}>
        <div style={{fontSize:13,fontWeight:800,marginBottom:2}}>Costruttore Menu</div>
        <div style={{fontSize:10,opacity:0.7}}>{completati}/{totale} pasti completi</div>
        <div style={{background:"rgba(255,255,255,.2)",borderRadius:10,height:4,marginTop:5}}>
          <div style={{width:(totale>0?completati/totale*100:0)+"%",height:"100%",background:"#E8637A",borderRadius:10}}/>
        </div>
      </div>

      <div style={{background:"#fff",padding:"8px",borderRadius:10,marginBottom:8,border:"1px solid #eee"}}>
        <div style={{display:"flex",gap:4,marginBottom:8,overflowX:"auto"}}>
          {GIORNI_B.map(function(g,i){
            var hasAny=PASTI_B.some(function(p){return hasSaved(g,p);});
            var isSel=giornoSel===i;
            return (
              <button key={g} onClick={function(){cambiaGiorno(i);}}
                style={{minWidth:46,padding:"6px 3px",borderRadius:10,flexShrink:0,
                  border:"2px solid "+(isSel?"#2E5F8A":hasAny?"#C2D9EC":"#eee"),
                  background:isSel?"#2E5F8A":hasAny?"#EBF3FA":"#fff",
                  color:isSel?"#fff":hasAny?"#2E5F8A":"#aaa",
                  fontSize:10,fontWeight:isSel?800:400,cursor:"pointer",textAlign:"center"}}>
                {g.slice(0,3)}
                <div style={{display:"flex",gap:2,justifyContent:"center",marginTop:2}}>
                  <div style={{width:5,height:5,borderRadius:"50%",background:isCompleto(g,"Pranzo")?(isSel?"rgba(255,255,255,.9)":"#2E5F8A"):(isSel?"rgba(255,255,255,.2)":"#eee")}}/>
                  <div style={{width:5,height:5,borderRadius:"50%",background:isCompleto(g,"Cena")?(isSel?"rgba(255,255,255,.9)":"#2E5F8A"):(isSel?"rgba(255,255,255,.2)":"#eee")}}/>
                </div>
              </button>
            );
          })}
        </div>
        <div style={{display:"flex",gap:4}}>
          {PASTI_B.map(function(p){
            var g=GIORNI_B[giornoSel];
            var comp=isCompleto(g,p); var saved=hasSaved(g,p); var sel=pastoSel===p;
            return (
              <button key={p} onClick={function(){cambiaPasto(p);}}
                style={{flex:1,padding:"6px 2px",borderRadius:10,fontSize:9,cursor:"pointer",
                  border:"2px solid "+(sel?"#C2355A":comp?"#2E5F8A":saved?"#6B9EC4":"#eee"),
                  background:sel?"#C2355A":comp?"#EBF3FA":saved?"#F0F6FA":"#fff",
                  color:sel?"#fff":comp?"#2E5F8A":saved?"#6B9EC4":"#aaa",
                  fontWeight:sel||comp?700:400,textAlign:"center"}}>
                {p.slice(0,3)}
                <div style={{fontSize:7,marginTop:1}}>{comp?"ok":saved?"...":"--"}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{display:"flex",gap:8}}>
        <div style={{flex:1}}>
          {step2Done&&<div style={{background:"#2E5F8A",color:"#fff",padding:"8px",textAlign:"center",fontSize:11,fontWeight:800,borderRadius:10,marginBottom:8}}>Pasto salvato</div>}
          <CostruttorePasto
            key={key}
            giorno={GIORNI_B[giornoSel]}
            pasto={pastoSel}
            scelta={sceltaCorrente}
            onSalva={salva}
            stepEst={stepCorrente}
            setStepEst={setStepCorrente}
            onLive={setLiveScelta}
            customIng={customIng}
            setCustomIng={setCustomIng}/>
        </div>
        <div style={{width:100,flexShrink:0}}>
          <PiattoVisivo
            carbo={liveScelta.carbo||null}
            prot={liveScelta.proteina||null}
            verdura={liveScelta.verdura||null}
            frutta={liveScelta.frutta||null}
            lattic={liveScelta.latticino||null}
            isPrinc={pastoSel==="Pranzo"||pastoSel==="Cena"}/>
          <PiramideLive scelte={scelteAttive}/>
        </div>
      </div>

      <div style={{background:"#fff",padding:"10px",borderRadius:10,marginTop:8,border:"1px solid #eee"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <span style={{fontSize:10,fontWeight:800,color:"#0D1B2A"}}>Settimana</span>
          <button onClick={function(){setShowSpesa(true);}}
            style={{background:"#C2355A",color:"#fff",border:"none",borderRadius:20,padding:"3px 10px",fontSize:9,fontWeight:700,cursor:"pointer"}}>
            Lista spesa
          </button>
        </div>
        <GrigliaSettimana
          scelte={scelteAttive} GIORNI={GIORNI_B} PASTI={PASTI_B}
          giornoSel={giornoSel} pastoSel={pastoSel}
          cambiaGiorno={cambiaGiorno} cambiaPasto={cambiaPasto}
          setPopup={setPopup}/>
      </div>

      {popup&&<PopupPasto data={popup} scelte={scelteAttive} setScelte={setScelteAttive} setPopup={setPopup} cambiaGiorno={cambiaGiorno} cambiaPasto={cambiaPasto} GIORNI={GIORNI_B} PASTI={PASTI_B} onSalvaRicetta={function(r){setRicette(ricette.concat([r]));}}/>}

      {showSpesa&&(
        <div onClick={function(){setShowSpesa(false);}}
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div onClick={function(e){e.stopPropagation();}}
            style={{background:"#fff",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:520,maxHeight:"70vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"14px 16px 8px",borderBottom:"1px solid #eee",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:13,fontWeight:800}}>Lista della spesa</div>
              <button onClick={function(){setShowSpesa(false);}} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#aaa"}}>x</button>
            </div>
            <div style={{overflowY:"auto",padding:"10px 14px 24px"}}>
              <SpesaItemsB scelte={scelteAttive} spesaCheck={spesaCheck} setSpesaCheck={setSpesaCheck}/>
            </div>
          </div>
        </div>
      )}

      {showRicette&&(
        <div onClick={function(){setShowRicette(null);}}
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:300,
            display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div onClick={function(e){e.stopPropagation();}}
            style={{background:"#fff",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:520,
              maxHeight:"75vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"14px 16px 8px",borderBottom:"1px solid #eee",
              display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:14,fontWeight:800,color:"#C2355A"}}>Ricette preferite</div>
              <button onClick={function(){setShowRicette(null);}}
                style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#aaa"}}>x</button>
            </div>
            <div style={{overflowY:"auto",padding:"10px 14px 24px"}}>
              {ricette.length===0&&(
                <div style={{textAlign:"center",padding:"30px 0",color:"#aaa",fontSize:12}}>
                  Nessuna ricetta salvata. Salva un pasto dalla griglia settimanale.
                </div>
              )}
              {ricette.map(function(r,ri){
                var allDB=CARBOIDRATI.concat(PROTEINE).concat(VERDURE).concat(FRUTTA).concat(SALSE);
                return (
                  <div key={r.id} style={{background:"#F5F8FC",borderRadius:12,padding:"12px",marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                      <div>
                        <div style={{fontSize:12,fontWeight:800,color:"#0D1B2A"}}>{r.nome}</div>
                        {r.nota&&<div style={{fontSize:10,color:"#888",fontStyle:"italic"}}>{r.nota}</div>}
                      </div>
                      <div style={{display:"flex",gap:4}}>
                        <button onClick={function(){
                          var n=Object.assign({},scelteAttive);
                          n[key]=Object.assign({},r.pasto);
                          setScelteAttive(n);
                          setShowRicette(null);
                        }} style={{padding:"4px 10px",borderRadius:20,border:"none",
                          background:"#2E5F8A",color:"#fff",fontSize:9,cursor:"pointer",fontWeight:700}}>
                          Usa
                        </button>
                        <button onClick={function(){
                          setRicette(ricette.filter(function(_,i){return i!==ri;}));
                        }} style={{padding:"4px 8px",borderRadius:20,border:"1px solid #eee",
                          background:"#fff",color:"#C0392B",fontSize:9,cursor:"pointer"}}>
                          x
                        </button>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      {["carbo","proteina","verdura","frutta"].map(function(k){
                        var id=r.pasto[k];
                        if(!id) return null;
                        var it=allDB.find(function(x){return x.id===id;});
                        if(!it) return null;
                        return <span key={k} style={{fontSize:9,background:"#EBF3FA",color:"#2E5F8A",padding:"2px 7px",borderRadius:20}}>{it.emoji} {it.nome}</span>;
                      })}
                    </div>
                    {r.note_famiglia&&Object.keys(r.note_famiglia).length>0&&(
                      <div style={{marginTop:6,paddingTop:6,borderTop:"1px solid #eee"}}>
                        <div style={{fontSize:9,color:"#888",marginBottom:3}}>Note per membro:</div>
                        {Object.keys(r.note_famiglia).map(function(membro){
                          return (
                            <div key={membro} style={{fontSize:9,color:"#555"}}>
                              <strong>{membro}:</strong> {r.note_famiglia[membro]}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


export default function App() {
  // ── localStorage fallback ───────────────────────────────────
  function loadLS(key, def) {
    try {
      var v = localStorage.getItem("mf_"+key);
      return v ? JSON.parse(v) : def;
    } catch(e) { return def; }
  }
  function saveLS(key, val) {
    try { localStorage.setItem("mf_"+key, JSON.stringify(val)); } catch(e) {}
  }

  // ── Auth state ──────────────────────────────────────────────
  var s_user    = useState(sbSession?{email:sbSession.email}:null);
  var utente    = s_user[0]; var setUtente = s_user[1];
  var s_fid     = useState(loadLS("family_id",null));
  var familyId  = s_fid[0]; var setFamilyId = s_fid[1];
  var s_loading = useState(!!sbSession);
  var loading   = s_loading[0]; var setLoading = s_loading[1];
  var s_authErr = useState("");
  var authErr   = s_authErr[0]; var setAuthErr = s_authErr[1];
  var s_email   = useState(""); var emailInput=s_email[0]; var setEmailInput=s_email[1];
  var s_pwd     = useState(""); var pwdInput=s_pwd[0]; var setPwdInput=s_pwd[1];
  var s_isReg   = useState(false); var isReg=s_isReg[0]; var setIsReg=s_isReg[1];
  var s_syncing = useState(false); var syncing=s_syncing[0]; var setSyncing=s_syncing[1];

  const [tab, setTab] = useState("home");
  const [orariPasti, setOrariPasti] = useState({
    Colazione:"07:30", Spuntino:"10:30", Pranzo:"12:30",
    Merenda:"16:00", Cena:"19:00", Extra:"21:00"
  });
  const [pianificazione, setPianificazione] = useState({
    giorno: 4, ora: "09:00", attiva: false
  });
  const [pin, setPin] = useState(loadLS("pin", {attivo:false, codice:"", sbloccato:true}));
  // Reset auto-genera dopo che TabMenu lo ha usato
  const [autoGeneraMenu, setAutoGeneraMenu] = useState(false);

  function initFamily(userId) {
    setTimeout(function(){ setLoading(false); }, 8000);
    supabase.from("families").select("id").eq("owner_id", userId)
    .then(function(rows) {
      if(rows && rows.length > 0) {
        var fid=rows[0].id; setFamilyId(fid); saveLS("family_id",fid); loadFromSupabase(fid);
      } else {
        supabase.from("families").insert({owner_id:userId}).then(function(r2) {
          if(r2&&r2.length>0){var f2=r2[0].id;setFamilyId(f2);saveLS("family_id",f2);}
          else{ console.error("Supabase: insert families fallito", r2); }
          setLoading(false);
        }, function(e){ console.error("Supabase: insert families errore", e); setLoading(false); });
      }
    }, function(e){ console.error("Supabase: select families errore", e); setLoading(false); })
    .catch(function(e){ console.error("Supabase: initFamily errore", e); setLoading(false); });
  }

  function loadFromSupabase(fid) {
    if(!fid){setLoading(false);return;}
    supabase.from("builder_scelte").select("*").eq("family_id",fid).then(function(rows){
      if(rows&&rows.length>0){
        var q={};var p={};
        rows.forEach(function(r){var k=r.giorno+"-"+r.pasto;if(r.settimana===0)q[k]=r.dati;else p[k]=r.dati;});
        setBuilderScelte(q);saveLS("builderScelte",q);
        setBuilderScelteProssima(p);saveLS("builderScelteProssima",p);
      }
    }, function(e){ console.error("Supabase: builder_scelte errore", e); });
    supabase.from("dispensa").select("*").eq("family_id",fid).then(function(rows){
      if(rows&&rows.length>0){setDispensa(rows);saveLS("dispensa",rows);}
      setLoading(false);
    }, function(e){ console.error("Supabase: dispensa errore", e); setLoading(false); });
    supabase.from("peso_log").select("*").eq("family_id",fid).then(function(rows){
      if(rows&&rows.length>0){
        var log={};
        rows.forEach(function(r){if(!log[r.profile_nome])log[r.profile_nome]=[];log[r.profile_nome].push({data:r.data,valore:r.valore});});
        setPesoLog(log);saveLS("pesoLog",log);
      }
    }, function(e){ console.error("Supabase: peso_log errore", e); });
  }

  function savePastoToSupabase(sett,giorno,pasto,dati) {
    if(!familyId)return;
    supabase.from("builder_scelte").upsert({family_id:familyId,settimana:sett,giorno:giorno,pasto:pasto,dati:dati,updated_at:new Date().toISOString()});
  }

  function savePesoToSupabase(nome,data,valore) {
    if(!familyId)return;
    supabase.from("peso_log").upsert({family_id:familyId,profile_nome:nome,data:data,valore:valore});
  }

  function doLogin() {
    setAuthErr("");setLoading(true);
    supabase.signIn(emailInput,pwdInput).then(function(res){
      if(res.error){setAuthErr(res.error.message||"Errore");setLoading(false);}
      else{sbSession=res;localStorage.setItem("mf_session",JSON.stringify(res));setUtente({email:res.user.email});initFamily(res.user.id);}
    }).catch(function(){setAuthErr("Errore di rete");setLoading(false);});
  }

  function doSignup() {
    setAuthErr("");setLoading(true);
    supabase.signUp(emailInput,pwdInput).then(function(res){
      if(res.error){setAuthErr(res.error.message||"Errore");setLoading(false);}
      else{sbSession=res;localStorage.setItem("mf_session",JSON.stringify(res));setUtente({email:emailInput});initFamily(res.user?res.user.id:res.id);}
    }).catch(function(){setAuthErr("Errore di rete");setLoading(false);});
  }

  function doLogout() {
    supabase.signOut();setUtente(null);setFamilyId(null);
    localStorage.removeItem("mf_session");localStorage.removeItem("mf_family_id");
  }

  useEffect(function(){
    if(sbSession&&!utente&&loading){
      supabase.getSession().then(function(user){
        if(user&&user.id){setUtente({email:user.email});initFamily(user.id);}
        else{sbSession=null;localStorage.removeItem("mf_session");setLoading(false);}
      });
    }
  }, []);

  const handleSetTab = (t) => {
    if(t !== "menu") setAutoGeneraMenu(false);
    setTab(t);
  };
  const [settimana, setSettimana] = useState(0);
  const [activeDay, setActiveDay] = useState(0);
  const [profili, setProfili] = useState(loadLS("profili", PROFILI_INIZIALI));
  const [menuOverride, setMenuOverride] = useState(loadLS("menuOverride", {}));
  const [builderScelte, setBuilderScelte] = useState(loadLS("builderScelte", {}));
  const [builderScelteProssima, setBuilderScelteProssima] = useState(loadLS("builderScelteProssima", {}));
  const [giorniFuori, setGiorniFuori] = useState(loadLS("giorniFuori", {}));
  const [pesoLog, setPesoLog] = useState(loadLS("pesoLog", {}));
  const [dispensa, setDispensa] = useState(loadLS("dispensa", []));
  const [spesa, setSpesa] = useState(loadLS("spesa", []));
  const [mealPrep, setMealPrep] = useState(loadLS("mealPrep", []));
  const [regolaApro, setRegolaApro] = useState({
    Colazione:2, Spuntino:2, Pranzo:7, Merenda:3, Cena:8, Extra:0
  });

  const menuBase = useMemo(() => buildMenu(settimana, profili), [settimana, profili]);
  const menu = useMemo(() => ({...menuBase, ...menuOverride}), [menuBase, menuOverride]);

  const toggleFuori = useCallback((giorno, pid) => {
    setGiorniFuori(prev => {
      const set = new Set(prev[giorno]||[]);
      set.has(pid) ? set.delete(pid) : set.add(pid);
      return {...prev, [giorno]: set};
    });
  }, []);

  const prepAlert = mealPrep.filter(p => {
    if(p.porzioniRimaste <= 0) return false;
    const oggi = new Date().toISOString().split("T")[0];
    if(p.scadenza < oggi) return true;
    return (new Date(p.scadenza)-new Date()) / (1000*60*60*24) <= 2;
  }).length;

  const TABS = [
    {id:"home",        l:"Home"},
    {id:"menu",        l:"Menu"},
    {id:"diario",      l:"Diario"},
    {id:"salute",      l:"Salute"},
    {id:"dispensa",    l:"Dispensa"},
    {id:"mealprep",    l:"Prep",    badge:prepAlert||null},
    {id:"calorie",     l:"Calorie"},
    {id:"piramide",    l:"Piramide"},
    {id:"idee",        l:"Idee"},
    {id:"impostazioni",l:"Impost."},
    {id:"builder",     l:"Builder"},
  ];

  const TABS_ROW1 = TABS.slice(0,5);
  const TABS_ROW2 = TABS.slice(5);


  // ── Salvataggio automatico localStorage ────────────────────
  // Wrappa i setter per salvare automaticamente
  function mkSetter(key, setter) {
    return function(val) {
      if(typeof val === "function") {
        setter(function(prev) {
          var next = val(prev);
          saveLS(key, next);
          return next;
        });
      } else {
        saveLS(key, val);
        setter(val);
      }
    };
  }

  var setProfiliLS            = mkSetter("profili", setProfili);
  var setBuilderScelteLS      = mkSetter("builderScelte", setBuilderScelte);
  var setBuilderScelteProssimaLS = mkSetter("builderScelteProssima", setBuilderScelteProssima);
  var setPesoLogLS            = mkSetter("pesoLog", setPesoLog);
  var setDispensaLS           = mkSetter("dispensa", setDispensa);
  var setSpesaLS              = mkSetter("spesa", setSpesa);
  var setMealPrepLS           = mkSetter("mealPrep", setMealPrep);
  var setPinLS                = mkSetter("pin", setPin);
  var setMenuOverrideLS       = mkSetter("menuOverride", setMenuOverride);
  var setGiorniFuoriLS        = mkSetter("giorniFuori", setGiorniFuori);

  const [pinInput, setPinInput] = useState("");
  const [pinWrong, setPinWrong] = useState(false);
  const verificaPin = () => {
    if(pinInput === pin.codice) {
      setPin(p=>({...p,sbloccato:true}));
      setPinInput(""); setPinWrong(false);
    } else {
      setPinWrong(true); setPinInput("");
    }
  };

  if(pin.attivo && !pin.sbloccato) return (
    <div style={{background:"#F5F8FC",minHeight:"100vh",maxWidth:520,margin:"0 auto",
      display:"flex",alignItems:"center",justifyContent:"center",padding:"30px"}}>
      <div style={{width:"100%",textAlign:"center"}}>
        <div style={{fontSize:14,fontWeight:800,color:"#2E5F8A",marginBottom:4}}>
          Menu Famiglia
        </div>
        <div style={{fontSize:11,color:"#888",marginBottom:24}}>Inserisci il PIN</div>
        <input type="password" inputMode="numeric" pattern="[0-9]*"
          placeholder="PIN" maxLength={8} value={pinInput}
          onChange={e=>setPinInput(e.target.value.replace(/[^0-9]/g,""))}
          onKeyDown={e=>{ if(e.key==="Enter") verificaPin(); }}
          style={{width:"100%",padding:"14px",borderRadius:12,
            border:"2px solid "+(pinWrong?"#C0392B":"#C2D9EC"),
            fontSize:24,fontWeight:700,letterSpacing:8,textAlign:"center",
            marginBottom:pinWrong?6:12,boxSizing:"border-box"}}/>
        {pinWrong&&<div style={{fontSize:11,color:"#C0392B",
          fontWeight:700,marginBottom:10}}>PIN errato - riprova</div>}
        <button onClick={verificaPin}
          style={{width:"100%",padding:"12px",borderRadius:12,border:"none",
            background:"#2E5F8A",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
          Accedi
        </button>
      </div>
    </div>
  );

  return (
    <div style={{background:"#F5F8FC",minHeight:"100vh",maxWidth:520,margin:"0 auto",fontFamily:"system-ui,sans-serif"}}>

      {/* Loading */}
      {loading&&(
        <div style={{position:"fixed",inset:0,background:"#fff",display:"flex",
          alignItems:"center",justifyContent:"center",zIndex:999}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:28,marginBottom:12}}>🍽</div>
            <div style={{fontSize:13,color:"#888"}}>Caricamento...</div>
          </div>
        </div>
      )}

      {/* Login screen */}
      {!loading&&!utente&&(
        <div style={{minHeight:"100vh",display:"flex",alignItems:"center",
          justifyContent:"center",padding:"24px"}}>
          <div style={{width:"100%",maxWidth:340}}>
            <div style={{marginBottom:32,textAlign:"center"}}>
              <div style={{fontSize:32,marginBottom:8}}>🍽</div>
              <div style={{fontSize:22,fontWeight:800,color:"#0D1B2A"}}>Menu Famiglia</div>
              <div style={{fontSize:13,color:"#aaa",marginTop:4}}>
                {isReg?"Crea il tuo account":"Accedi al tuo account"}
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
              <input type="email" placeholder="Email"
                value={emailInput} onChange={function(e){setEmailInput(e.target.value);}}
                onKeyDown={function(e){if(e.key==="Enter")isReg?doSignup():doLogin();}}
                style={{padding:"12px 14px",borderRadius:8,border:"1.5px solid #ddd",
                  fontSize:14,outline:"none",width:"100%",boxSizing:"border-box"}}/>
              <input type="password" placeholder="Password"
                value={pwdInput} onChange={function(e){setPwdInput(e.target.value);}}
                onKeyDown={function(e){if(e.key==="Enter")isReg?doSignup():doLogin();}}
                style={{padding:"12px 14px",borderRadius:8,border:"1.5px solid #ddd",
                  fontSize:14,outline:"none",width:"100%",boxSizing:"border-box"}}/>
            </div>
            {authErr&&(
              <div style={{fontSize:12,color:"#C0392B",marginBottom:10,textAlign:"center"}}>
                {authErr}
              </div>
            )}
            <button onClick={isReg?doSignup:doLogin}
              style={{width:"100%",padding:"13px",borderRadius:8,border:"none",
                background:"#0D1B2A",color:"#fff",fontSize:14,fontWeight:700,
                cursor:"pointer",marginBottom:12}}>
              {isReg?"Registrati":"Accedi"}
            </button>
            <button onClick={function(){setIsReg(!isReg);setAuthErr("");}}
              style={{width:"100%",padding:"10px",borderRadius:8,
                border:"1.5px solid #ddd",background:"transparent",
                color:"#555",fontSize:12,cursor:"pointer"}}>
              {isReg?"Hai gi  un account? Accedi":"Non hai un account? Registrati"}
            </button>
          </div>
        </div>
      )}

      {/* App principale */}
      {!loading&&utente&&(
      <div style={{background:"#F5F8FC",minHeight:"100vh",maxWidth:520,margin:"0 auto",fontFamily:"system-ui,sans-serif"}}>

      <div style={{background:"linear-gradient(135deg,#0D1B2A 0%,#2E5F8A 100%)",
        padding:"16px 16px 12px",color:"#fff",
        display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
        <div>
          <div style={{fontSize:18,fontWeight:800}}>Menu Famiglia</div>
          <div style={{fontSize:10,opacity:0.75,marginTop:2}}>
            {Object.keys(profili).length} profili attivi
          </div>
        </div>
        <div style={{display:"flex",gap:5}}>
          {Object.values(profili).slice(0,5).map(p=>(
            <div key={p.id} style={{width:26,height:26,borderRadius:"50%",
              background:p.colore,display:"flex",alignItems:"center",
              justifyContent:"center",fontSize:12,
              border:"2px solid rgba(255,255,255,.35)"}}>
              {p.nome.slice(0,1)}
            </div>
          ))}
        </div>
      </div>

      <div style={{background:"#fff",borderBottom:"1px solid #eee"}}>
        <div style={{display:"flex",padding:"0 6px"}}>
          {TABS_ROW1.map(t=>(
            <button key={t.id} onClick={()=>handleSetTab(t.id)}
              style={{flex:1,padding:"9px 2px 7px",border:"none",background:"transparent",
                cursor:"pointer",position:"relative",
                borderBottom:tab===t.id?"2.5px solid #2D6A4F":"2.5px solid transparent",
                color:tab===t.id?"#2E5F8A":"#aaa",
                fontWeight:tab===t.id?700:400,fontSize:10,whiteSpace:"nowrap"}}>
              {t.l}
              {t.badge&&<span style={{position:"absolute",top:4,right:0,
                background:"#C0392B",color:"#fff",fontSize:9,fontWeight:800,
                borderRadius:12,padding:"0 3px"}}>{t.badge}</span>}
            </button>
          ))}
        </div>
        <div style={{display:"flex",padding:"0 6px",borderTop:"1px solid #f0f0f0"}}>
          {TABS_ROW2.map(t=>(
            <button key={t.id} onClick={()=>handleSetTab(t.id)}
              style={{flex:1,padding:"7px 2px 5px",border:"none",background:"transparent",
                cursor:"pointer",position:"relative",
                borderBottom:tab===t.id?"2.5px solid #2D6A4F":"2.5px solid transparent",
                color:tab===t.id?"#2E5F8A":"#aaa",
                fontWeight:tab===t.id?700:400,fontSize:10,whiteSpace:"nowrap"}}>
              {t.l}
              {t.badge&&<span style={{position:"absolute",top:4,right:0,
                background:"#C0392B",color:"#fff",fontSize:9,fontWeight:800,
                borderRadius:12,padding:"0 3px"}}>{t.badge}</span>}
            </button>
          ))}
        </div>
      </div>

      <div style={{padding:"16px 14px 90px"}}>
        {tab==="home" && (
          <TabHome menu={menu} profili={profili} dispensa={dispensa}
            mealPrep={mealPrep} giorniFuori={giorniFuori}
            orariPasti={orariPasti} setOrariPasti={setOrariPasti}
            prepAlert={prepAlert} setTab={handleSetTab}
            pianificazione={pianificazione} setPianificazione={setPianificazione} builderScelte={builderScelte}/>
        )}
        {tab==="menu" && (
          <TabMenu menu={menu} setMenuOverride={setMenuOverrideLS}
            profili={profili} settimana={settimana} setSettimana={setSettimana}
            activeDay={activeDay} setActiveDay={setActiveDay}
            giorniFuori={giorniFuori} toggleFuori={toggleFuori}
            autoGenera={autoGeneraMenu}
            builderScelte={builderScelte} setBuilderScelte={setBuilderScelteLS}
            builderScelteProssima={builderScelteProssima} setBuilderScelteProssima={setBuilderScelteProssimaLS}/>
        )}
        {tab==="diario" && (
          <TabDiario menu={menu} profili={profili}
            regolaApro={regolaApro} setRegolaApro={setRegolaApro}
            builderScelte={builderScelte}/>
        )}
        {tab==="salute" && (
          <TabSalute profili={profili} setProfili={setProfiliLS} onSavePeso={savePesoToSupabase}
            pesoLog={pesoLog} setPesoLog={setPesoLogLS}/>
        )}
        {tab==="dispensa" && (
          <TabDispensa dispensa={dispensa} setDispensa={setDispensaLS}
            spesa={spesa} setSpesa={setSpesaLS}/>
        )}
        {tab==="mealprep" && (
          <TabMealPrep mealPrep={mealPrep} setMealPrep={setMealPrepLS}
            profili={profili}/>
        )}
        {tab==="calorie" && (
          <TabCalorie menu={menu} profili={profili} builderScelte={builderScelte}/>
        )}
        {tab==="impostazioni" && (
          <TabImpostazioni
            profili={profili} setProfili={setProfiliLS}
            pianificazione={pianificazione} setPianificazione={setPianificazione}
            pesoLog={pesoLog} setPesoLog={setPesoLogLS}
            pin={pin} setPin={setPinLS}/>
        )}
        {tab==="piramide" && (
          <TabPiramide menu={menu} builderScelte={builderScelte}/>
        )}
        {tab==="idee" && (
          <TabIdee profili={profili} dispensa={dispensa}/>
        )}
        {tab==="builder" && (
          <TabBuilder menu={menu} setMenuOverride={setMenuOverrideLS} profili={profili}
            builderScelte={builderScelte} setBuilderScelte={setBuilderScelteLS}
            builderScelteProssima={builderScelteProssima} setBuilderScelteProssima={setBuilderScelteProssimaLS}
            onSavePasto={savePastoToSupabase}/>
        )}
      </div>
    </div>
    )}
    </div>
  );
}
