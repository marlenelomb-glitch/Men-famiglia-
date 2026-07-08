
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
    refreshSession: function() {
      if(!sbSession || !sbSession.refresh_token) return Promise.resolve(null);
      return fetch(auth_url("/token?grant_type=refresh_token"), {
        method:"POST", headers:{"apikey":SUPABASE_KEY,"Content-Type":"application/json"},
        body: JSON.stringify({refresh_token: sbSession.refresh_token})
      }).then(function(r){ return r.json(); }).then(function(res){
        if(res && res.access_token) { sbSession = res; try { localStorage.setItem("mf_session", JSON.stringify(res)); } catch(e){} return res; }
        return null;
      }).catch(function(){ return null; });
    },
    resendConfirm: function(email) {
      return fetch(auth_url("/resend"), {
        method:"POST", headers:{"apikey":SUPABASE_KEY,"Content-Type":"application/json"},
        body: JSON.stringify({type:"signup", email:email})
      }).then(function(r){return r.json();});
    },
    recover: function(email) {
      return fetch(auth_url("/recover"), {
        method:"POST", headers:{"apikey":SUPABASE_KEY,"Content-Type":"application/json"},
        body: JSON.stringify({email:email})
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
          var limit_str = "";
          var obj = {
            eq: function(col, val) { filters.push(col+"=eq."+val); return obj; },
            neq: function(col, val) { filters.push(col+"=neq."+val); return obj; },
            ilike: function(col, val) { filters.push(col+"=ilike."+encodeURIComponent(val)); return obj; },
            or: function(str) { filters.push("or=("+str+")"); return obj; },
            in: function(col, arr) { filters.push(col+"=in.("+arr.join(",")+")"); return obj; },
            limit: function(n) { limit_str = "&limit="+n; return obj; },
            order: function(col, opts) {
              order_str = "&order="+col+(opts&&opts.ascending===false?".desc":".asc");
              return obj;
            },
            then: function(resolve, reject) {
              var full = url + (filters.length?"&"+filters.join("&"):"") + order_str + limit_str;
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
          var url = rest(table);
          if(opts && opts.onConflict) url = url + "?on_conflict=" + opts.onConflict;
          return fetch(url, {
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

// ── CLIENT AI (Claude) ───────────────────────────────────────
var ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_KEY || "";
var AI_MODEL = "claude-sonnet-4-6";

function aiAttiva() { return !!ANTHROPIC_KEY; }

function chiamaAI(system, userText, maxTokens) {
  if(!ANTHROPIC_KEY) return Promise.reject(new Error("Chiave AI non configurata (VITE_ANTHROPIC_KEY)"));
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: maxTokens || 1024,
      system: system,
      messages: [{ role: "user", content: userText }]
    })
  }).then(function(r){ return r.json(); }).then(function(data){
    if(data && data.error) throw new Error(data.error.message || "Errore AI");
    var t = "";
    if(data && data.content) data.content.forEach(function(b){ if(b.type === "text") t += b.text; });
    return t;
  });
}

function descriviProfili(profili) {
  var righe = [];
  Object.keys(profili).forEach(function(pid){
    var p = profili[pid];
    var fin = getParametriFinali(p);
    var eta = p.dataNascita ? calcolaEta(p.dataNascita).anni : (p.eta || "?");
    var vincoli = [];
    if(fin.prot_max !== null) vincoli.push("max " + fin.prot_max + "g proteine/die");
    if(fin.carb_max !== null) vincoli.push("max " + fin.carb_max + "g carboidrati/die");
    if(fin.sodio_max !== null) vincoli.push("max " + fin.sodio_max + "mg sodio/die");
    if(fin.phe_max !== null) vincoli.push("max " + fin.phe_max + "mg fenilalanina/die (PKU)");
    if(fin.vietati && fin.vietati.length) vincoli.push("vietati: " + fin.vietati.join(", "));
    var pats = (fin.patologie && fin.patologie.length) ? fin.patologie.join(", ") : "nessuna";
    righe.push("- " + p.nome + " (" + eta + " anni): " + fin.kcal + " kcal/die; patologie: " + pats + "; " + (vincoli.length ? vincoli.join("; ") : "nessun vincolo particolare"));
  });
  return righe.join("\n");
}

var AI_SYSTEM = "Sei un assistente nutrizionista per un'app di menu familiare italiana. " +
  "Rispondi sempre in italiano, in modo chiaro e conciso. Tieni conto delle patologie e dei vincoli " +
  "nutrizionali di ogni membro della famiglia. Non sostituisci il parere medico: per patologie serie " +
  "(PKU, insufficienza renale, ipoproteica) ricorda di seguire la prescrizione del medico.";

function aiSuggerisciIngredienti(profili, sceltaParziale) {
  var prompt = "Profili famiglia:\n" + descriviProfili(profili) + "\n\n" +
    "Pasto in costruzione (ingredienti gia scelti): " + (sceltaParziale || "nessuno") + ".\n" +
    "Suggerisci 2-3 ingredienti per completare il pasto in modo equilibrato e compatibile con TUTTI i membri " +
    "(rispetta allergie e limiti). Per ognuno una riga breve col perche. Massimo 6 righe.";
  return chiamaAI(AI_SYSTEM, prompt, 600);
}

function aiGeneraMenu(profili) {
  var prompt = "Profili famiglia:\n" + descriviProfili(profili) + "\n\n" +
    "Genera un menu settimanale (Lunedi-Domenica) con Colazione, Pranzo e Cena, " +
    "rispettando tutte le patologie e i vincoli di ogni membro. " +
    "Dove un membro ha bisogno di una variante (es. aproteico, senza glutine), indicala tra parentesi. " +
    "Formato compatto, una riga per pasto.";
  return chiamaAI(AI_SYSTEM, prompt, 2000);
}

function aiDomanda(profili, domanda) {
  var prompt = "Profili famiglia:\n" + descriviProfili(profili) + "\n\n" +
    "Domanda dell'utente: " + domanda;
  return chiamaAI(AI_SYSTEM, prompt, 800);
}

function aiOpzioniCena(profili, giorno) {
  var prompt = "Profili famiglia:\n" + descriviProfili(profili) + "\n\n" +
    "Proponi esattamente 3 opzioni di cena per " + giorno + ", compatibili con tutti i membri. " +
    "Rispondi SOLO con le 3 opzioni, una per riga, numerate 1) 2) 3), senza altro testo.";
  return chiamaAI(AI_SYSTEM, prompt, 500);
}

// ── Notifica nuove iscrizioni (Web3Forms) ───────────────────
var WEB3FORMS_KEY = import.meta.env.VITE_WEB3FORMS_KEY || "";

function traduciErroreAuth(msg) {
  var m = (msg || "").toLowerCase();
  if(m.indexOf("invalid login") >= 0) return "Email o password non corretti.";
  if(m.indexOf("email not confirmed") >= 0) return "Devi confermare l'email prima di accedere. Controlla la posta (anche spam).";
  if(m.indexOf("already registered") >= 0 || m.indexOf("already been registered") >= 0) return "Questa email e gia registrata. Prova ad accedere.";
  if(m.indexOf("password should be at least") >= 0 || m.indexOf("at least 6") >= 0) return "La password deve avere almeno 6 caratteri.";
  if(m.indexOf("unable to validate email") >= 0 || m.indexOf("invalid email") >= 0) return "Email non valida.";
  if(m.indexOf("rate limit") >= 0 || m.indexOf("too many") >= 0) return "Troppi tentativi. Riprova tra qualche minuto.";
  return msg || "Si e verificato un errore.";
}

function salvaIscritto(emailUtente, userId) {
  try {
    supabase.from("iscritti").insert({email: emailUtente, user_id: userId || null, created_at: new Date().toISOString()});
  } catch(e) {}
}

function notificaIscrizione(emailUtente) {
  if(!WEB3FORMS_KEY) return;
  fetch("https://api.web3forms.com/submit", {
    method: "POST",
    headers: {"Content-Type": "application/json", "Accept": "application/json"},
    body: JSON.stringify({
      access_key: WEB3FORMS_KEY,
      subject: "Nuova iscrizione - Menu Famiglia",
      from_name: "Menu Famiglia",
      email: emailUtente,
      message: "Nuovo utente registrato: " + emailUtente
    })
  }).catch(function(){});
}

import { useState, useMemo, useCallback, useEffect, Component } from "react";
import { DB_RICETTE } from "./ricette.js";
import LoadingScreen from "./LoadingScreen.jsx";

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = {err:null}; }
  static getDerivedStateFromError(err) { return {err:err}; }
  componentDidCatch(err, info) { console.error("UI error:", err, info); }
  render() {
    if(this.state.err) {
      var self = this;
      return (
        <div style={{padding:"40px 24px",textAlign:"center",fontFamily:"'Nunito',system-ui,sans-serif"}}>
          <div style={{fontSize:34,marginBottom:10}}>😕</div>
          <div style={{fontSize:16,fontWeight:800,color:"#2C3338",marginBottom:8}}>Questa schermata ha avuto un problema</div>
          <div style={{fontSize:12,color:"#8A949B",marginBottom:16,wordBreak:"break-word"}}>{String((this.state.err && this.state.err.message) || this.state.err)}</div>
          <button onClick={function(){ self.setState({err:null}); }}
            style={{padding:"12px 22px",borderRadius:14,border:"none",background:"#2F6586",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"}}>
            Riprova
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const DAYS = ["Lunedi","Martedi","Mercoledi","Giovedi","Venerdi","Sabato","Domenica"];
const MEALS = ["Colazione","Pranzo","Spuntino","Merenda","Cena","Extra"];

const COLORI = ["#2F6586","#2F6586","#6BA6C9","#C2355A","#C2355A","#C2355A","#2F6586"];

const PATOLOGIE_LIST = [
  {id:"nessuna", label:"Nessuna restrizione", kcal:2000, prot:80, vietati:[], note:""},
  {id:"dimagrante", label:"Dieta dimagrante", kcal:1500, prot:80, kcalMod:{pct:-20}, vietati:[], note:"kcal -20% rispetto al fabbisogno per eta"},
  {id:"ipoproteica", label:"Dieta Ipoproteica", kcal:1800, prot:20, prot_max:20, manuale:"prot", vietati:[], note:"prot_max prescritto dal medico (default 20g)"},
  {id:"celiachia", label:"Celiachia", kcal:2000, prot:80, vietati:["glutine"], note:"No glutine (grano, orzo, segale, farro)"},
  {id:"diabete_t1", label:"Diabete Tipo 1", kcal:2000, prot:80, carb_max:200, vietati:[], note:"Carb max 200g, preferire indice glicemico basso"},
  {id:"diabete_t2", label:"Diabete Tipo 2", kcal:1800, prot:80, carb_max:180, vietati:[], note:"Carb max 180g, indice glicemico basso"},
  {id:"ipertensione", label:"Ipertensione", kcal:2000, prot:80, sodio_max:1500, vietati:[], note:"Sodio max 1500mg/die"},
  {id:"vegetariano", label:"Vegetariano", kcal:2000, prot:80, vietati:["carne","pesce","crostacei"], note:"No carne, no pesce"},
  {id:"vegano", label:"Vegano", kcal:2000, prot:80, vietati:["carne","pesce","crostacei","latticini","uova"], note:"No carne, pesce, latticini, uova"},
  {id:"svezzamento", label:"Svezzamento", kcal:700, prot:11, vietati:[], note:"Parametri neonato 6-12 mesi"},
  {id:"colite_ibs", label:"Colite/IBS", kcal:2000, prot:80, vietati:["legumi","fritto","fermentati"], note:"No cibi fermentati, no legumi interi, no fritto"},
  {id:"allergia_latte", label:"Allergia al Latte", kcal:2000, prot:80, vietati:["latticini"], note:"No latticini"},
  {id:"allergia_uova", label:"Allergia alle Uova", kcal:2000, prot:80, vietati:["uova"], note:"No uova"},
  {id:"allergia_frutta_secca", label:"Allergia Frutta Secca", kcal:2000, prot:80, vietati:["frutta_secca"], note:"No noci, mandorle, nocciole"},
  {id:"allergia_pesce", label:"Allergia al Pesce", kcal:2000, prot:80, vietati:["pesce"], note:"No pesce"},
  {id:"allergia_crostacei", label:"Allergia Crostacei", kcal:2000, prot:80, vietati:["crostacei"], note:"No gamberi, cozze, vongole"},
  {id:"allergia_grano", label:"Allergia al Grano", kcal:2000, prot:80, vietati:["glutine"], note:"No frumento"},
  {id:"fenilchetonuria", label:"Fenilchetonuria PKU", kcal:2000, prot:20, prot_max:20, phe_max:300, manuale:"phe", vietati:[], note:"Fenilalanina max inserita dal medico"},
  {id:"ipercolesterolemia", label:"Ipercolesterolemia", kcal:2000, prot:80, grassi_sat_max:20, vietati:[], note:"Grassi saturi max 20g/die"},
  {id:"ins_renale", label:"Insufficienza Renale", kcal:2000, prot:60, sodio_max:1500, fosforo_max:800, vietati:[], note:"Sodio max 1500mg, fosforo limitato"},
  {id:"gotta", label:"Gotta", kcal:2000, prot:70, vietati:["carne_rossa","alcol"], note:"No carne rossa, no alcolici, purine limitate"},
  {id:"anemia", label:"Anemia", kcal:2000, prot:80, vietati:[], note:"Aumentare ferro e vitamina C"},
  {id:"gravidanza", label:"Gravidanza", kcal:2200, prot:90, vietati:["crudi","alcol"], note:"Aumentare folati, calcio, ferro, no alcol, no crudi"},
  {id:"allattamento", label:"Allattamento", kcal:2300, prot:90, kcalMod:{add:500}, vietati:["alcol"], note:"+500 kcal, calcio elevato"},
  {id:"intoll_lattosio", label:"Intolleranza al Lattosio", kcal:2000, prot:80, vietati:["latticini"], note:"Latticini limitati"},
  {id:"intoll_fruttosio", label:"Intolleranza al Fruttosio", kcal:2000, prot:80, vietati:["miele"], note:"Frutta limitata, no miele"},
  {id:"ingrassante", label:"Dieta Ingrassante/Ipercalorica", kcal:2500, prot:90, kcalMod:{pct:20}, vietati:[], note:"kcal +20% rispetto al fabbisogno per eta"},
];

function calcolaEta(dataNascita) {
  if(!dataNascita) return {anni:30, mesi:360};
  var d = new Date(dataNascita);
  if(isNaN(d.getTime())) return {anni:30, mesi:360};
  var now = new Date();
  var mesi = (now.getFullYear()-d.getFullYear())*12 + (now.getMonth()-d.getMonth());
  if(now.getDate() < d.getDate()) mesi = mesi - 1;
  if(mesi < 0) mesi = 0;
  return {anni: Math.floor(mesi/12), mesi: mesi};
}

function getParametriEta(dataNascita, sesso) {
  var e = calcolaEta(dataNascita);
  var mesi = e.mesi, anni = e.anni;
  var maschio = sesso === "maschio";
  if(mesi < 6)  return {kcal:550,  prot:9,  carb:60};
  if(mesi < 12) return {kcal:700,  prot:11, carb:95};
  if(anni <= 3) return {kcal:1100, prot:14, carb:150};
  if(anni <= 6) return {kcal:1400, prot:20, carb:190};
  if(anni <= 10) return {kcal:1700, prot:28, carb:230};
  if(anni <= 14) return maschio ? {kcal:2000, prot:40, carb:260} : {kcal:1800, prot:36, carb:240};
  if(anni <= 17) return maschio ? {kcal:2300, prot:50, carb:300} : {kcal:1900, prot:43, carb:250};
  if(anni >= 65) return maschio ? {kcal:1900, prot:54, carb:240} : {kcal:1600, prot:54, carb:200};
  return maschio ? {kcal:2100, prot:56, carb:265} : {kcal:1800, prot:46, carb:230};
}

function getParametriFinali(profilo) {
  if(!profilo) profilo = {};
  var base = getParametriEta(profilo.dataNascita, profilo.sesso);
  var res = {kcal: base.kcal, prot: base.prot, carb: base.carb,
    prot_max: null, carb_max: null, sodio_max: null, grassi_sat_max: null, phe_max: null, vietati: []};
  var lista = (profilo.patologie && profilo.patologie.length) ? profilo.patologie
    : (profilo.patologia ? [profilo.patologia] : []);
  lista.forEach(function(pid) {
    var p = PATOLOGIE_LIST.find(function(x){ return x.id === pid; });
    if(!p) return;
    if(p.kcalMod) {
      if(typeof p.kcalMod.pct === "number") res.kcal = Math.round(res.kcal * (1 + p.kcalMod.pct/100));
      if(typeof p.kcalMod.add === "number") res.kcal = res.kcal + p.kcalMod.add;
    }
    if(typeof p.prot_max === "number") res.prot_max = (res.prot_max === null) ? p.prot_max : Math.min(res.prot_max, p.prot_max);
    if(typeof p.carb_max === "number") res.carb_max = (res.carb_max === null) ? p.carb_max : Math.min(res.carb_max, p.carb_max);
    if(typeof p.sodio_max === "number") res.sodio_max = (res.sodio_max === null) ? p.sodio_max : Math.min(res.sodio_max, p.sodio_max);
    if(typeof p.grassi_sat_max === "number") res.grassi_sat_max = (res.grassi_sat_max === null) ? p.grassi_sat_max : Math.min(res.grassi_sat_max, p.grassi_sat_max);
    if(typeof p.phe_max === "number") res.phe_max = (res.phe_max === null) ? p.phe_max : Math.min(res.phe_max, p.phe_max);
    if(p.vietati) p.vietati.forEach(function(v){ if(res.vietati.indexOf(v) < 0) res.vietati.push(v); });
  });
  var vm = profilo.valoriMedico || {};
  if(vm.prot !== undefined && vm.prot !== null && vm.prot !== "") res.prot_max = parseInt(vm.prot,10);
  if(vm.phe !== undefined && vm.phe !== null && vm.phe !== "") res.phe_max = parseInt(vm.phe,10);
  var ov = profilo.override || {};
  if(ov.kcal !== undefined && ov.kcal !== null && ov.kcal !== "") res.kcal = parseInt(ov.kcal,10);
  if(ov.prot_max !== undefined && ov.prot_max !== null && ov.prot_max !== "") res.prot_max = parseInt(ov.prot_max,10);
  if(ov.carb_max !== undefined && ov.carb_max !== null && ov.carb_max !== "") res.carb_max = parseInt(ov.carb_max,10);
  res.patologie = lista;
  return res;
}

function tagsIngrediente(ing) {
  if(!ing) return [];
  var t = [];
  var cat = ing.cat || "";
  var id = ing.id || "";
  var glutenFree = ["pasta_leg","soba","noodles","riso_b","riso_int","riso_bas","risotto","quinoa","polenta","patate","patate_d","gallette"];
  if(cat === "pasta" || cat === "pane") { if(glutenFree.indexOf(id) < 0) t.push("glutine"); }
  if(cat === "cereali") { if(["farro","orzo","cous"].indexOf(id) >= 0) t.push("glutine"); }
  if(cat === "colazione") { if(["avena","muesli","granola","fette_int","pancakes"].indexOf(id) >= 0) t.push("glutine"); }
  if(cat === "latticini") t.push("latticini");
  if(id === "besciamella" || id === "burro") t.push("latticini");
  if(cat === "uova" || id === "uova" || id === "pancakes") t.push("uova");
  if(cat === "pesce") { t.push("pesce"); if(id === "gamberetti") t.push("crostacei"); }
  if(cat === "carne bianca" || cat === "carne rossa" || cat === "affettati") t.push("carne");
  if(cat === "carne rossa") t.push("carne_rossa");
  if(cat === "legumi" || id === "pasta_leg") t.push("legumi");
  if(id === "noci" || id === "mandorle" || cat === "frutta_sec") t.push("frutta_secca");
  return t;
}

function ingredienteVietato(ing, vietati) {
  if(!vietati || !vietati.length) return null;
  var tags = tagsIngrediente(ing);
  for(var i = 0; i < tags.length; i++) {
    if(vietati.indexOf(tags[i]) >= 0) return tags[i];
  }
  return null;
}

var VIETATO_SHORT = {glutine:"glutine", latticini:"lattosio", carne:"carne", carne_rossa:"carne rossa", pesce:"pesce", crostacei:"crostacei", uova:"uova", legumi:"legumi", frutta_secca:"fr. secca", miele:"miele", alcol:"alcol"};
function vietatoShort(tag) { return VIETATO_SHORT[tag] || tag; }

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
  return (profili[pid]||{}).colore || "#8A949B";
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
    <div style={{background:"#F1F4F6",borderRadius:12,height:6,overflow:"hidden",marginTop:2}}>
      <div style={{width:pct+"%",height:"100%",background:color,borderRadius:12,transition:"width .3s"}}/>
    </div>
  );
}

function Btn({onClick,children,bg,color,border,small}) {
  return (
    <button onClick={onClick} style={{
      flex:1,padding:small?"6px 10px":"10px 14px",borderRadius:20,border:border||"none",
      background:bg||"#2F6586",color:color||"#fff",fontSize:small?10:12,
      fontWeight:700,cursor:"pointer"
    }}>{children}</button>
  );
}

// ── GESTIONE FAMIGLIA ─────────────────────────────────────────
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
  if(!haVerdura) mancanti.push({l:"verdura",     c:"#6BA6C9"});
  return {completo: mancanti.length===0, mancanti};
}

function BadgeCompletezza({pasto, meal, profili}) {
  const [sug, setSug] = useState(null);
  const [loading, setLoading] = useState(false);
  const res = calcolaCompletezza(pasto, meal);
  if(!res) return null;
  if(res.completo) return (
    <span style={{fontSize:9,background:"#EBF3FA",color:"#2F6586",
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
        <span style={{fontSize:10,fontWeight:700,color:"#2F6586"}}>Manca:</span>
        {res.mancanti.map(m=>(
          <span key={m.l} style={{fontSize:9,background:m.c+"18",color:m.c,
            fontWeight:700,padding:"2px 8px",borderRadius:20,border:"1px solid "+m.c+"33"}}>
            {m.l}
          </span>
        ))}
        <button onClick={chiedi} disabled={loading}
          style={{marginLeft:"auto",background:loading?"#ccc":"linear-gradient(135deg,#C2355A,#C2355A)",
            color:"#fff",border:"none",borderRadius:20,padding:"3px 10px",
            fontSize:9,fontWeight:700,cursor:loading?"wait":"pointer",whiteSpace:"nowrap"}}>
          {loading?"...":"Cosa aggiungo?"}
        </button>
      </div>
      {sug&&(
        <div style={{borderTop:"1px solid #F6ECD9",paddingTop:6}}>
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
  var allDB    = CARBOIDRATI.concat(PROTEINE).concat(VERDURE).concat(FRUTTA).concat(SALSE).concat(ALIMENTI_CUSTOM);
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
                border:"2px solid "+(isSel?"#2F6586":isToday?"#6BA6C9":hasD?"#E3EAEE":"#eee"),
                background:isSel?"#2F6586":isToday?"#FBE7EC":"#fff",
                color:isSel?"#fff":isToday?"#C2355A":"#8A949B",
                fontSize:11,fontWeight:isSel?800:400,textAlign:"center"}}>
              {giorno.slice(0,3)}
            </button>
          );
        })}
      </div>

      {!hasDati&&(
        <div style={{textAlign:"center",padding:"30px",background:"#F5F8FC",borderRadius:12}}>
          <div style={{fontSize:28,marginBottom:8}}>📊</div>
          <div style={{fontSize:13,fontWeight:700,color:"#8A949B"}}>Nessun dato per {g}</div>
          <div style={{fontSize:11,color:"#8A949B",marginTop:4}}>Inserisci i pasti dal tab Builder</div>
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
            border:"1.5px solid "+(overProt?"#FBE7EC":"#eee")}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:20}}>{profilo.emoji}</span>
                <div>
                  <div style={{fontSize:12,fontWeight:800}}>{profilo.nome}</div>
                  <div style={{fontSize:9,color:"#8A949B"}}>target {profilo.kcal_target}kcal / max {profilo.prot_max}g prot</div>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:18,fontWeight:800,color:overKcal?"#C2355A":"#2F6586"}}>{tot.kcal}</div>
                <div style={{fontSize:9,color:"#8A949B"}}>kcal</div>
              </div>
            </div>
            <div style={{marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#8A949B",marginBottom:3}}>
                <span>Calorie</span>
                <span style={{fontWeight:700,color:overKcal?"#C2355A":"#555"}}>
                  {tot.kcal}/{profilo.kcal_target} ({pctKcal}%)
                  {overKcal?" +"+( tot.kcal-profilo.kcal_target):" -"+(profilo.kcal_target-tot.kcal)}
                </span>
              </div>
              <div style={{background:"#F1F4F6",borderRadius:6,height:8,overflow:"hidden"}}>
                <div style={{width:pctKcal+"%",height:"100%",borderRadius:6,
                  background:overKcal?"#C2355A":"#2F6586",transition:"width .3s"}}/>
              </div>
            </div>
            <div style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#8A949B",marginBottom:3}}>
                <span>Proteine</span>
                <span style={{fontWeight:700,color:overProt?"#C2355A":profilo.isApro?"#8A5A12":"#555"}}>
                  {tot.prot}g / {profilo.prot_max}g max
                  {overProt?" SUPERATO":""}
                </span>
              </div>
              <div style={{background:"#F1F4F6",borderRadius:6,height:8,overflow:"hidden"}}>
                <div style={{width:pctProt+"%",height:"100%",borderRadius:6,
                  background:overProt?"#C2355A":profilo.isApro?"#8A5A12":"#6BA6C9"}}/>
              </div>
            </div>
            <div style={{borderTop:"1px solid #F2F6F8",paddingTop:8}}>
              {tot.pasti.filter(function(p){return p.kcal>0;}).map(function(p){
                return (
                  <div key={p.pasto} style={{display:"flex",justifyContent:"space-between",
                    padding:"3px 0",fontSize:10}}>
                    <span style={{color:"#8A949B"}}>{p.pasto}</span>
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
  var allDB    = CARBOIDRATI.concat(PROTEINE).concat(VERDURE).concat(FRUTTA).concat(SALSE).concat(ALIMENTI_CUSTOM);
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
    var s=scelteVis[g+"-"+p]; return s&&(s.carbo||s.proteina||s.frutta||s.latticino||(s.piattoUnico&&s.piattoUnico.nome&&(""+s.piattoUnico.nome).trim()));
  }

  var completi=0;
  GIORNI_M.forEach(function(g){PASTI_M.forEach(function(p){if(hasPasto(g,p))completi++;});});

  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center"}}>
        <button onClick={function(){setSettSel(0);}}
          style={{flex:1,padding:"8px",borderRadius:6,cursor:"pointer",fontSize:11,
            border:"none",borderBottom:"2px solid "+(settSel===0?"#2C3338":"transparent"),
            background:"transparent",fontWeight:settSel===0?800:400,
            color:settSel===0?"#2C3338":"#8A949B"}}>
          Questa settimana
        </button>
        <button onClick={function(){setSettSel(1);}}
          style={{flex:1,padding:"8px",borderRadius:6,cursor:"pointer",fontSize:11,
            border:"none",borderBottom:"2px solid "+(settSel===1?"#2C3338":"transparent"),
            background:"transparent",fontWeight:settSel===1?800:400,
            color:settSel===1?"#2C3338":"#8A949B"}}>
          Prossima settimana
        </button>
      </div>

      <div style={{fontSize:10,color:"#8A949B",marginBottom:12}}>
        {completi} / {GIORNI_M.length*PASTI_M.length} pasti inseriti
      </div>

      {GIORNI_M.map(function(g){
        var pastiG=PASTI_M.filter(function(p){return hasPasto(g,p);});
        var aperto=giornoAperto===g;
        return (
          <div key={g} style={{borderBottom:"1px solid #F1F4F6"}}>
            <button onClick={function(){setGiornoAperto(aperto?null:g);}}
              style={{width:"100%",display:"flex",justifyContent:"space-between",
                alignItems:"center",padding:"12px 0",background:"transparent",
                border:"none",cursor:"pointer",textAlign:"left"}}>
              <div>
                <span style={{fontSize:12,fontWeight:700,color:"#2C3338"}}>{g}</span>
                {pastiG.length>0&&(
                  <span style={{fontSize:10,color:"#8A949B",marginLeft:8}}>
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
                      borderTop:"1px solid #F2F6F8",alignItems:"center"}}>
                      <span style={{width:66,fontSize:10,color:"#ccc",flexShrink:0}}>{pasto}</span>
                      <span style={{fontSize:10,color:"#ddd"}}>—</span>
                    </div>
                  );
                  var isCompl=s.piattoUnico&&s.piattoUnico.nome&&(""+s.piattoUnico.nome).trim();
                  var protItem =allDB.find(function(x){return x.id===s.proteina;});
                  var carboItem=allDB.find(function(x){return x.id===s.carbo;});
                  var fruttaItem=allDB.find(function(x){return x.id===s.frutta;});
                  var principale=protItem||carboItem||fruttaItem;
                  var secondo   =protItem&&carboItem?carboItem:null;
                  return (
                    <div key={pasto}
                      onClick={function(){setPopup({g:g,pasto:pasto,s:s});}}
                      style={{display:"flex",gap:12,padding:"8px 0",
                        borderTop:"1px solid #F2F6F8",alignItems:"flex-start",cursor:"pointer"}}>
                      <span style={{width:66,fontSize:10,color:"#8A949B",flexShrink:0,paddingTop:1}}>
                        {pasto}
                      </span>
                      <div style={{flex:1}}>
                        {isCompl&&<span style={{fontSize:11,fontWeight:600,color:"#2C3338"}}>
                          {(""+s.piattoUnico.nome).trim()}
                        </span>}
                        {isCompl&&<span style={{fontSize:9,color:"#8A949B",marginLeft:6,fontWeight:600}}>pasto completo{s.piattoUnico.altri&&s.piattoUnico.altri.length>0?(" · +"+s.piattoUnico.altri.length+" piatt"+(s.piattoUnico.altri.length>1?"i":"o")):""}</span>}
                        {!isCompl&&principale&&<span style={{fontSize:11,fontWeight:600,color:"#2C3338"}}>
                          {principale.nome}
                        </span>}
                        {!isCompl&&secondo&&<span style={{fontSize:10,color:"#8A949B"}}> + {secondo.nome}</span>}
                        {!isCompl&&s.verdura&&<span style={{fontSize:10,color:"#8A949B"}}>
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
            style={{background:"#fff",borderRadius:"16px 16px 0 0",width:"100%",maxWidth:390,
              maxHeight:"70vh",overflow:"auto",padding:"20px 20px 32px"}}>
            <div style={{fontSize:10,color:"#8A949B",marginBottom:2}}>{popup.g} — {popup.pasto}</div>
            <div style={{fontSize:16,fontWeight:800,color:"#2C3338",marginBottom:16}}>
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
                  borderBottom:"1px solid #F2F6F8",alignItems:"center"}}>
                  <span style={{width:70,fontSize:9,color:"#8A949B"}}>{labels[k]}</span>
                  <span style={{fontSize:11,color:"#2C3338",fontWeight:500}}>{it.emoji} {it.nome}</span>
                  {it.kcal_p&&<span style={{marginLeft:"auto",fontSize:9,color:"#8A949B"}}>
                    {it.kcal_p}kcal/100g
                  </span>}
                </div>
              );
            })}
            {popup.s.nota&&(
              <div style={{marginTop:12,padding:"10px",background:"#F2F6F8",borderRadius:8,
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
  var allDB    = CARBOIDRATI.concat(PROTEINE).concat(VERDURE).concat(FRUTTA).concat(SALSE).concat(ALIMENTI_CUSTOM);
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
                border:"none",borderBottom:"2px solid "+(isSel?"#2C3338":"transparent"),
                background:"transparent",
                color:isSel?"#2C3338":hasD?"#555":"#ccc",
                fontSize:10,fontWeight:isSel?800:400,textAlign:"center"}}>
              {giorno.slice(0,3)}
              {isToday&&<div style={{width:4,height:4,borderRadius:"50%",background:"#2C3338",margin:"3px auto 0"}}/>}
            </button>
          );
        })}
      </div>

      {!hasDati&&(
        <div style={{padding:"24px 0",borderTop:"1px solid #F1F4F6",
          fontSize:11,color:"#8A949B",textAlign:"center"}}>
          Nessun pasto inserito per {g}
        </div>
      )}

      {hasDati&&(
        <div>
          {PASTI_D.map(function(pasto){
            var s=builderScelte[g+"-"+pasto];
            return (
              <div key={pasto} style={{borderBottom:"1px solid #F1F4F6",paddingBottom:12,marginBottom:12}}>
                <div style={{fontSize:10,fontWeight:700,color:"#8A949B",
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
                          <span key={k} style={{fontSize:10,color:"#2C3338",
                            padding:"3px 8px",borderRadius:4,background:"#F2F6F8"}}>
                            {it.nome}
                          </span>
                        );
                      })}
                    </div>
                    {s.nota&&<div style={{fontSize:9,color:"#8A949B",fontStyle:"italic",marginBottom:8}}>{s.nota}</div>}
                    <div style={{display:"flex",flexDirection:"column",gap:3}}>
                      {PROFILI_D.map(function(p){
                        var n=calcPasto(s,p.mult);
                        if(n.kcal===0) return null;
                        var overProt=p.apro&&n.prot>5;
                        return (
                          <div key={p.id} style={{display:"flex",gap:8,alignItems:"center",fontSize:10}}>
                            <span style={{width:62,color:"#8A949B"}}>{p.label}</span>
                            <span style={{color:"#555",fontWeight:500}}>{n.kcal} kcal</span>
                            {n.prot>0&&(
                              <span style={{color:overProt?"#C2355A":"#8A949B",fontWeight:overProt?700:400}}>
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
            <div style={{fontSize:10,fontWeight:700,color:"#8A949B",textTransform:"uppercase",
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
                    <span style={{fontSize:11,fontWeight:600,color:"#2C3338"}}>{p.label}</span>
                    <div style={{display:"flex",gap:10,fontSize:10}}>
                      <span style={{color:overKcal?"#C2355A":"#555",fontWeight:overKcal?700:400}}>
                        {tot.kcal}/{p.kcal_t} kcal
                      </span>
                      {tot.prot>0&&(
                        <span style={{color:overProt?"#C2355A":"#8A949B",fontWeight:overProt?700:400}}>
                          {tot.prot}/{p.prot_max}g{overProt?" !!":""}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{background:"#F1F4F6",borderRadius:2,height:4}}>
                    <div style={{width:pct+"%",height:"100%",borderRadius:2,
                      background:overKcal?"#C2355A":overProt?"#8A5A12":"#2C3338"}}/>
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
    var colore=trend<0?"#2F6586":trend>0?"#C2355A":"#8A949B";

    var punti=ultimi.map(function(d,i){return xPx(i)+","+yPx(d.valore);}).join("?");

    return (
      <div style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
          <span style={{fontSize:10,color:"#8A949B"}}>Ultimi {ultimi.length} rilevamenti</span>
          <span style={{fontSize:12,fontWeight:700,color:colore}}>
            {trend>0?"+":""}{delta} kg
            <span style={{fontSize:9,fontWeight:400,color:"#8A949B",marginLeft:4}}>
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
                stroke={su?"#C2355A":giu?"#2F6586":"#ccc"}
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
          <text x={xPx(0)} y={yPx(valori[0])-7} fontSize={8} fill="#8A949B" textAnchor="middle">
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
      <div style={{display:"flex",gap:0,marginBottom:16,borderBottom:"1px solid #F1F4F6"}}>
        {Object.keys(profili).map(function(id){
          var p=profili[id];
          var isSel=pid===id;
          return (
            <button key={id} onClick={function(){setPid(id);}}
              style={{flex:1,padding:"8px 4px",background:"transparent",border:"none",
                borderBottom:"2px solid "+(isSel?"#2C3338":"transparent"),
                fontSize:11,fontWeight:isSel?800:400,
                color:isSel?"#2C3338":"#8A949B",cursor:"pointer",textAlign:"center"}}>
              {p.nome.split("?")[0]}
            </button>
          );
        })}
      </div>

      {/* Dati principali */}
      <div style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:4}}>
          <div>
            <div style={{fontSize:24,fontWeight:800,color:"#2C3338"}}>
              {prof.peso||""}
              <span style={{fontSize:13,fontWeight:400,color:"#8A949B",marginLeft:4}}>kg</span>
            </div>
            <div style={{fontSize:10,color:"#8A949B"}}>{prof.nome}</div>
          </div>
          {bmi&&(
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:20,fontWeight:700,color:"#2C3338"}}>{bmi}</div>
              <div style={{fontSize:10,color:"#8A949B"}}>BMI — {bmiCat}</div>
            </div>
          )}
        </div>
        {prof.altezza&&<div style={{fontSize:10,color:"#8A949B"}}>
          {prof.altezza} cm
          {prof.eta&&""+prof.eta+" anni"}
        </div>}
      </div>

      {/* Grafico andamento */}
      <GraficoAndamento dati={log}/>

      {log.length<2&&log.length>0&&(
        <div style={{fontSize:10,color:"#8A949B",marginBottom:12}}>
          Aggiungi almeno 2 rilevamenti per vedere l andamento
        </div>
      )}

      {/* Input nuovo peso */}
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:20,
        paddingBottom:16,borderBottom:"1px solid #F1F4F6"}}>
        <input type="number" step="0.1" placeholder="Peso oggi (kg)"
          value={nuovoPeso}
          onChange={function(e){setNuovoPeso(e.target.value);}}
          onKeyDown={function(e){if(e.key==="Enter")aggiungiPeso();}}
          style={{flex:1,padding:"9px 12px",borderRadius:6,
            border:"1.5px solid #ddd",fontSize:12,outline:"none"}}/>
        <button onClick={aggiungiPeso}
          style={{padding:"9px 16px",borderRadius:6,border:"none",
            background:"#2C3338",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>
          Salva
        </button>
      </div>

      {/* Storico */}
      {log.length>0&&(
        <div>
          <div style={{fontSize:10,fontWeight:700,color:"#8A949B",textTransform:"uppercase",
            letterSpacing:1,marginBottom:10}}>Storico</div>
          {log.slice().reverse().map(function(entry,i){
            var arr=log.slice().reverse();
            var prevEntry=arr[i+1];
            var delta=prevEntry?(entry.valore-prevEntry.valore).toFixed(1):null;
            var deltaNum=delta?parseFloat(delta):0;
            return (
              <div key={entry.data} style={{display:"flex",alignItems:"center",gap:10,
                padding:"9px 0",borderBottom:"1px solid #F1F4F6"}}>
                <span style={{fontSize:10,color:"#8A949B",minWidth:54}}>{entry.data.slice(5)}</span>
                <span style={{flex:1,fontSize:12,fontWeight:600,color:"#2C3338"}}>
                  {entry.valore} kg
                </span>
                {delta&&(
                  <span style={{fontSize:10,fontWeight:700,
                    color:deltaNum<0?"#2F6586":deltaNum>0?"#C2355A":"#8A949B"}}>
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
  const giorniDopoApertoDefault = (nome) => {
    const n = (nome||"").toLowerCase();
    if(n.indexOf("yogurt")>=0) return 2;
    if(n.indexOf("latte")>=0 || n.indexOf("panna")>=0) return 3;
    if(n.indexOf("prosciutto")>=0 || n.indexOf("salame")>=0 || n.indexOf("affettat")>=0 || n.indexOf("mortadella")>=0 || n.indexOf("wurstel")>=0) return 3;
    if(n.indexOf("formaggio")>=0 || n.indexOf("mozzarella")>=0 || n.indexOf("ricotta")>=0 || n.indexOf("stracchino")>=0) return 4;
    if(n.indexOf("succo")>=0 || n.indexOf("passata")>=0 || n.indexOf("pomodoro")>=0 || n.indexOf("salsa")>=0 || n.indexOf("sugo")>=0) return 4;
    return 3;
  };
  const addGiorni = (dstr, n) => { const d = new Date(dstr+"T00:00:00"); d.setDate(d.getDate()+n); return d.toISOString().split("T")[0]; };
  const effAperto = (orig, apData, dur) => { const apEnd = addGiorni(apData||oggi, dur); return (!orig || apEnd < orig) ? apEnd : orig; };
  const giorniRestano = (dstr) => { if(!dstr) return null; return Math.round((new Date(dstr+"T00:00:00")-new Date(oggi+"T00:00:00"))/86400000); };
  const apriItem = (id) => setDispensa(prev=>prev.map(x=>{
    if(x.id!==id) return x;
    const dur = (x.durataAperto!=null ? x.durataAperto : giorniDopoApertoDefault(x.nome));
    const orig = (x.scadenzaOrig!=null ? x.scadenzaOrig : (x.scadenza||""));
    return {...x, aperto:true, apertoData:oggi, durataAperto:dur, scadenzaOrig:orig, scadenza:effAperto(orig, oggi, dur)};
  }));
  const chiudiItem = (id) => setDispensa(prev=>prev.map(x=> x.id!==id?x:{...x,aperto:false,scadenza:(x.scadenzaOrig!=null?x.scadenzaOrig:x.scadenza)}));
  const setDurAperto = (id,d) => setDispensa(prev=>prev.map(x=>{
    if(x.id!==id) return x;
    const dur = Math.max(1,d);
    const orig = (x.scadenzaOrig!=null ? x.scadenzaOrig : (x.scadenza||""));
    return {...x, durataAperto:dur, scadenza:effAperto(orig, x.apertoData||oggi, dur)};
  }));

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
              background:vista===v.id?"#2F6586":"#fff",
              color:vista===v.id?"#fff":"#555",fontWeight:vista===v.id?700:400,fontSize:11,
              boxShadow:vista===v.id?"none":"0 1px 6px rgba(0,0,0,.07)"}}>
            {v.l}
          </button>
        ))}
      </div>

      {vista==="dispensa" && (
        <div>
          <div style={{background:"#EBF3FA",borderRadius:14,padding:"12px",marginBottom:12,
            border:"1.5px solid #CADCE8"}}>
            <input placeholder="Nome prodotto" value={nuovoItem.nome}
              onChange={e=>setNuovoItem(p=>({...p,nome:e.target.value}))}
              style={{width:"100%",padding:"7px",borderRadius:8,border:"1.5px solid #CADCE8",
                fontSize:12,marginBottom:6,boxSizing:"border-box"}}/>
            <div style={{display:"flex",gap:6,marginBottom:6}}>
              <select value={nuovoItem.cat} onChange={e=>setNuovoItem(p=>({...p,cat:e.target.value}))}
                style={{flex:2,padding:"6px",borderRadius:8,border:"1.5px solid #CADCE8",fontSize:11}}>
                {CATS.map(c=><option key={c.id} value={c.id}>{c.l}</option>)}
              </select>
              <input value={nuovoItem.qty} onChange={e=>setNuovoItem(p=>({...p,qty:e.target.value}))}
                placeholder="Qty" style={{flex:1,padding:"6px",borderRadius:8,
                  border:"1.5px solid #CADCE8",fontSize:11}}/>
            </div>
            <input type="date" value={nuovoItem.scadenza}
              onChange={e=>setNuovoItem(p=>({...p,scadenza:e.target.value}))}
              style={{width:"100%",padding:"6px",borderRadius:8,border:"1.5px solid #CADCE8",
                fontSize:11,marginBottom:8,boxSizing:"border-box"}}/>
            <button onClick={aggiungi} disabled={!nuovoItem.nome.trim()}
              style={{width:"100%",padding:"9px",borderRadius:12,border:"none",
                background:nuovoItem.nome.trim()?"#2F6586":"#ccc",
                color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>
              Aggiungi
            </button>
          </div>

          {dispensa.length===0 ? (
            <div style={{textAlign:"center",padding:"30px",color:"#8A949B",fontSize:12}}>
              Dispensa vuota
            </div>
          ) : dispensa.map(item => {
            const se = item.scadenza || "";
            const rem = giorniRestano(se);
            const dur = (item.durataAperto!=null ? item.durataAperto : giorniDopoApertoDefault(item.nome));
            return (
            <div key={item.id} style={{background:"#fff",borderRadius:12,padding:"12px 14px",
              marginBottom:8,boxShadow:"0 1px 6px rgba(0,0,0,.07)",
              border:isScad(se)?"1.5px solid #C2355A":
                isProxScad(se)?"1.5px solid #E8D5AE":"1px solid transparent"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:6}}>{item.nome}{item.aperto&&<span style={{fontSize:9,fontWeight:800,color:"#8A5A12",background:"#F6ECD9",borderRadius:20,padding:"2px 7px"}}>Aperto</span>}</div>
                  <div style={{fontSize:9,color:"#8A949B"}}>{item.qty}{item.unita} - {(CATS.find(c=>c.id===item.cat)||{}).l}</div>
                  {se && (
                    <div style={{fontSize:9,color:isScad(se)?"#C2355A":isProxScad(se)?"#8A5A12":"#8A949B"}}>
                      {item.aperto ? (rem<0?"Scaduto":(rem===0?"Da consumare oggi":("Restano "+rem+(rem===1?" giorno":" giorni")))) : ("Scade: "+se+(isScad(se)?" - SCADUTO":(isProxScad(se)?" - in scadenza":"")))}
                    </div>
                  )}
                </div>
                {item.aperto ? (
                  <div style={{display:"flex",alignItems:"center",gap:5,background:"#F2F6F8",borderRadius:20,padding:3,marginRight:2}}>
                    <button onClick={()=>setDurAperto(item.id,dur-1)} style={{width:22,height:22,borderRadius:"50%",border:"none",background:"#fff",color:"#2F6586",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif"}}>−</button>
                    <span style={{fontSize:10,fontWeight:800,color:"#2F6586",minWidth:38,textAlign:"center"}}>{dur} gg</span>
                    <button onClick={()=>setDurAperto(item.id,dur+1)} style={{width:22,height:22,borderRadius:"50%",border:"none",background:"#fff",color:"#2F6586",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif"}}>+</button>
                  </div>
                ) : (
                  <button onClick={()=>apriItem(item.id)}
                    style={{border:"1.5px solid #6BA6C9",background:"#fff",color:"#2F6586",borderRadius:20,padding:"5px 11px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif",display:"flex",alignItems:"center",gap:4}}>
                    <i className="ti ti-lock-open" style={{fontSize:13}}/>Apri
                  </button>
                )}
                <button onClick={()=>setDispensa(prev=>prev.filter(x=>x.id!==item.id))}
                  style={{background:"none",border:"none",cursor:"pointer",
                    fontSize:14,color:"#B4BEC4"}}>x</button>
              </div>
              {item.aperto && (
                <div style={{marginTop:7,fontSize:9,color:"#8A949B",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span>Aperto il {item.apertoData} · dura {dur} gg dopo aperto</span>
                  <span onClick={()=>chiudiItem(item.id)} style={{color:"#2F6586",fontWeight:700,cursor:"pointer"}}>Annulla apertura</span>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      {vista==="spesa" && (
        <div>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <input placeholder="Aggiungi alla spesa..." value={nuovaSpesa}
              onChange={e=>setNuovaSpesa(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter")addSpesa();}}
              style={{flex:1,padding:"8px",borderRadius:8,border:"1.5px solid #CADCE8",fontSize:12}}/>
            <button onClick={addSpesa}
              style={{background:"#2F6586",color:"#fff",border:"none",borderRadius:20,
                padding:"8px 14px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
              +
            </button>
          </div>

          {spesa.length===0 ? (
            <div style={{textAlign:"center",padding:"30px",color:"#8A949B",fontSize:12}}>
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
                  <div style={{fontSize:10,color:"#8A949B",marginBottom:5}}>Acquistati:</div>
                  {spesa.filter(x=>x.checked).map(item => (
                    <div key={item.id} style={{background:"#F2F6F8",borderRadius:12,padding:"8px 12px",
                      marginBottom:4,display:"flex",alignItems:"center",gap:10}}>
                      <span style={{flex:1,fontSize:12,color:"#8A949B",textDecoration:"line-through"}}>
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
  const CONS = [{id:"frigo",l:"Frigo",g:3,c:"#C2355A"},{id:"freezer",l:"Freezer",g:90,c:"#2F6586"},{id:"tavola",l:"T.amb",g:1,c:"#E3EAEE"}];

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
        <div style={{fontSize:14,fontWeight:800,color:"#2F6586"}}>Meal Prep</div>
        <button onClick={()=>setShowForm(s=>!s)}
          style={{background:showForm?"#FBE7EC":"#2F6586",color:showForm?"#C2355A":"#fff",
            border:"none",borderRadius:20,padding:"5px 14px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
          {showForm?"Annulla":"+ Aggiungi"}
        </button>
      </div>
      <div style={{fontSize:10,color:"#8A949B",marginBottom:12}}>
        Pasti preparati e conservati
      </div>

      {alerts > 0 && (
        <div style={{background:"#FBE7EC",borderRadius:12,padding:"8px 12px",marginBottom:10,
          display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>!</span>
          <div style={{fontSize:11,fontWeight:700,color:"#C2355A"}}>
            {alerts} pasti in scadenza
          </div>
        </div>
      )}

      {showForm && (
        <div style={{background:"#EBF3FA",borderRadius:14,padding:"13px",marginBottom:14,
          border:"1.5px solid #CADCE8"}}>
          <div style={{display:"flex",gap:7,marginBottom:8}}>
            <input value={form.emoji} onChange={e=>setForm(p=>({...p,emoji:e.target.value}))}
              style={{width:46,padding:"7px 4px",borderRadius:8,border:"1.5px solid #CADCE8",
                fontSize:18,textAlign:"center"}}/>
            <input placeholder="Nome pasto preparato" value={form.nome}
              onChange={e=>setForm(p=>({...p,nome:e.target.value}))}
              style={{flex:1,padding:"7px",borderRadius:8,border:"1.5px solid #CADCE8",fontSize:12}}/>
          </div>

          <div style={{marginBottom:8}}>
            <div style={{fontSize:9,fontWeight:700,color:"#8A949B",marginBottom:4}}>Per chi:</div>
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
                <div style={{fontSize:9,color:"#8A949B",marginBottom:2}}>{f.l}</div>
                <input type="number" value={form[f.k]}
                  onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))}
                  style={{width:"100%",padding:"5px",borderRadius:8,border:"1.5px solid #CADCE8",
                    fontSize:11,boxSizing:"border-box"}}/>
              </div>
            ))}
          </div>

          <input placeholder="Note (es. senza sale, porzioni 80g...)" value={form.note}
            onChange={e=>setForm(p=>({...p,note:e.target.value}))}
            style={{width:"100%",padding:"6px",borderRadius:8,border:"1.5px solid #CADCE8",
              fontSize:11,marginBottom:10,boxSizing:"border-box"}}/>

          <button onClick={aggiungi} disabled={!form.nome.trim()}
            style={{width:"100%",padding:"10px",borderRadius:12,border:"none",
              background:form.nome.trim()?"#2F6586":"#ccc",color:"#fff",
              fontSize:12,fontWeight:700,cursor:"pointer"}}>
            Salva nel meal prep
          </button>
        </div>
      )}

      <div style={{display:"flex",gap:5,marginBottom:12,overflowX:"auto"}}>
        <button onClick={()=>setFiltro("tutti")}
          style={{padding:"4px 10px",borderRadius:20,
            border:filtro==="tutti"?"2px solid #2F6586":"2px solid #ddd",
            background:filtro==="tutti"?"#2F6586":"#fff",
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
          <div style={{fontSize:12,color:"#8A949B"}}>Nessun pasto preparato</div>
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
            boxShadow:scad?"0 0 0 2px #C2355A,0 2px 6px rgba(0,0,0,.05)":
              prox?"0 0 0 2px #8A5A12,0 2px 6px rgba(0,0,0,.05)":
              "0 1px 6px rgba(0,0,0,.07)"}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:9,marginBottom:6}}>
              <span style={{fontSize:20}}>{item.emoji}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:800,color:finito?"#8A949B":"#222"}}>
                  {item.nome}
                </div>
                <div style={{display:"flex",gap:5,marginTop:3,flexWrap:"wrap"}}>
                  {p && <span style={{fontSize:9,background:p.colore+"22",color:p.colore,
                    fontWeight:700,padding:"2px 8px",borderRadius:20}}>{p.nome.slice(0,1)} {p.nome}</span>}
                  {cons && <span style={{fontSize:9,background:cons.c+"22",color:cons.c,
                    fontWeight:700,padding:"2px 8px",borderRadius:20}}>{cons.l}</span>}
                  {scad && <span style={{fontSize:9,background:"#FBE7EC",color:"#C2355A",
                    fontWeight:700,padding:"2px 8px",borderRadius:20}}>SCADUTO</span>}
                  {!scad&&prox && <span style={{fontSize:9,background:"#EBF3FA",color:"#2F6586",
                    fontWeight:700,padding:"2px 8px",borderRadius:20}}>scade presto</span>}
                  {finito && <span style={{fontSize:9,background:"#F2F6F8",color:"#8A949B",
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
              <span style={{color:scad?"#C2355A":prox?"#2F6586":"#8A949B"}}>
                Scade: {item.scadenza}
              </span>
            </div>

            {item.note && <div style={{fontSize:10,color:"#8A949B",fontStyle:"italic",marginBottom:6}}>
              {item.note}
            </div>}

            {!finito && (
              <button onClick={()=>usaPorzione(item.id)}
                style={{background:"#2F6586",color:"#fff",border:"none",borderRadius:20,
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
  {id:"verdura",  l:"Verdura",           target:5, unit:"porz/die", c:"#6BA6C9", note:"Almeno 2-3 porzioni crude"},
  {id:"frutta",   l:"Frutta",            target:3, unit:"porz/die", c:"#C2355A", note:"Frutta di stagione, varia i colori"},
  {id:"legumi",   l:"Legumi",            target:3, unit:"x/sett",   c:"#2F6586", note:"Ceci, lenticchie, fagioli"},
  {id:"pesce",    l:"Pesce",             target:3, unit:"x/sett",   c:"#C2355A", note:"Pesce azzurro ricco di omega-3"},
  {id:"carne",    l:"Carne bianca",      target:3, unit:"x/sett",   c:"#E3EAEE", note:"Pollo, tacchino, coniglio"},
  {id:"latticini",l:"Latticini",         target:2, unit:"porz/die", c:"#C2355A", note:"Yogurt, formaggi freschi"},
  {id:"uova",     l:"Uova",              target:2, unit:"x/sett",   c:"#C2355A", note:"Fonte proteica economica"},
  {id:"grassi",   l:"Olio EVO",          target:3, unit:"cucch/die",c:"#2F6586", note:"A crudo, extravergine italiano"},
];

function TabPiramide({menu, builderScelte}) {
  var allDB = CARBOIDRATI.concat(PROTEINE).concat(VERDURE).concat(FRUTTA).concat(ALIMENTI_CUSTOM);
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
    {id:"cereali",    label:"Cereali e carboidrati", target:14, color:"#8A5A12", desc:"2 porzioni/giorno"},
    {id:"verdura",    label:"Verdure",                target:21, color:"#6BA6C9", desc:"3 porzioni/giorno"},
    {id:"frutta",     label:"Frutta",                 target:14, color:"#6BA6C9", desc:"2 porzioni/giorno"},
    {id:"legumi",     label:"Legumi",                 target:3,  color:"#2F6586", desc:"3x settimana"},
    {id:"pesce",      label:"Pesce",                  target:3,  color:"#6BA6C9", desc:"3x settimana"},
    {id:"carne",      label:"Carne bianca",            target:3,  color:"#8A5A12", desc:"3x settimana"},
    {id:"carne_rossa",label:"Carne rossa",             target:1,  color:"#C2355A", desc:"max 1x settimana"},
    {id:"uova",       label:"Uova",                   target:2,  color:"#8A5A12", desc:"max 2x settimana"},
    {id:"latticini",  label:"Latticini",               target:7,  color:"#2F6586", desc:"1 porzione/giorno"},
  ];

  var totPasti = Object.keys(scelteVis).length;

  return (
    <div>
      <div style={{display:"flex",gap:6,marginBottom:16}}>
        {SETTIMANE.map(function(s,i){
          return (
            <button key={s} onClick={function(){setSettSel(i);}}
              style={{flex:1,padding:"8px",borderRadius:10,cursor:"pointer",fontSize:11,
                border:"2px solid "+(settSel===i?"#2F6586":"#eee"),
                background:settSel===i?"#2F6586":"#fff",
                color:settSel===i?"#fff":"#8A949B",fontWeight:settSel===i?800:400}}>
              {s}
            </button>
          );
        })}
      </div>

      {totPasti===0&&(
        <div style={{textAlign:"center",padding:"30px",background:"#F5F8FC",borderRadius:12,marginBottom:16}}>
          <div style={{fontSize:28,marginBottom:8}}>🌿</div>
          <div style={{fontSize:13,fontWeight:700,color:"#8A949B"}}>Nessun pasto inserito</div>
          <div style={{fontSize:11,color:"#8A949B",marginTop:4}}>Costruisci il menu dal tab Builder</div>
        </div>
      )}

      {LIVELLI.map(function(l){
        var val = conteggi[l.id]||0;
        var pct = Math.min(100, Math.round(val/l.target*100));
        var ok  = val >= l.target;
        var over= l.id==="carne_rossa"&&val>l.target;
        return (
          <div key={l.id} style={{marginBottom:14,background:"#fff",borderRadius:12,
            padding:"12px 14px",border:"1.5px solid "+(over?"#FBE7EC":ok?"#E2EEF5":"#eee"),
            boxShadow:"0 1px 6px rgba(0,0,0,.05)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div>
                <div style={{fontSize:11,fontWeight:800,color:"#2C3338"}}>{l.label}</div>
                <div style={{fontSize:9,color:"#8A949B"}}>{l.desc}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <span style={{fontSize:18,fontWeight:800,
                  color:over?"#C2355A":ok?"#2F6586":l.color}}>{val}</span>
                <span style={{fontSize:10,color:"#8A949B"}}>/{l.target}</span>
              </div>
            </div>
            <div style={{background:"#F1F4F6",borderRadius:6,height:10,overflow:"hidden",marginBottom:5}}>
              <div style={{width:pct+"%",height:"100%",borderRadius:6,
                background:over?"#C2355A":ok?"#2F6586":l.color,transition:"width .4s"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:9}}>
              <span style={{color:over?"#C2355A":ok?"#2F6586":"#8A949B",fontWeight:over||ok?700:400}}>
                {over?"Superato! Riduci":ok?"Obiettivo raggiunto!":"mancano "+(l.target-val)+" porzioni"}
              </span>
              <span style={{color:"#8A949B"}}>{pct}%</span>
            </div>
            {l.id==="carne_rossa"&&over&&(
              <div style={{background:"#FBE7EC",borderRadius:6,padding:"5px 8px",marginTop:6,fontSize:9,color:"#C2355A",fontWeight:600}}>
                Linee guida: max 1 volta a settimana. Attenzione per dieta ipoproteica.
              </div>
            )}
          </div>
        );
      })}

      <div style={{background:"#F2F6F8",borderRadius:12,padding:"12px 14px",marginTop:4}}>
        <div style={{fontSize:10,fontWeight:800,color:"#2F6586",marginBottom:6}}>Consigli settimana</div>
        {conteggi.pesce<3&&<div style={{fontSize:10,color:"#555",marginBottom:3}}>
          Pesce: aggiungi {3-conteggi.pesce} pasto/i (omega-3)
        </div>}
        {conteggi.verdura<14&&<div style={{fontSize:10,color:"#555",marginBottom:3}}>
          Verdure: {14-conteggi.verdura} porzioni mancanti (fibra e vitamine)
        </div>}
        {conteggi.legumi<3&&<div style={{fontSize:10,color:"#555",marginBottom:3}}>
          Legumi: {3-conteggi.legumi} pasto/i mancanti (proteine vegetali)
        </div>}
        {conteggi.carne_rossa>1&&<div style={{fontSize:10,color:"#C2355A",fontWeight:700,marginBottom:3}}>
          Carne rossa: ridurre ({conteggi.carne_rossa} su 1 max)
        </div>}
        {conteggi.pesce>=3&&conteggi.verdura>=14&&conteggi.legumi>=3&&conteggi.carne_rossa<=1&&(
          <div style={{fontSize:11,color:"#2F6586",fontWeight:700}}>
            Ottima settimana! Menu bilanciato.
          </div>
        )}
      </div>
    </div>
  );
}

// ── TAB IDEE E ISPIRAZIONI ────────────────────────────────────


// ── DATABASE RICETTE COMPLETO ────────────────────────────────

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

function filtraNotaRicetta(note, hasApro, hasNeo) {
  if(!note) return "";
  var parts = note.split(/\.\s+/);
  var keep = [];
  parts.forEach(function(f){
    var low = f.toLowerCase();
    if(!hasApro && low.indexOf("aproteic") >= 0) return;
    if(!hasNeo && (low.indexOf("neonat") >= 0 || low.indexOf("svezzament") >= 0)) return;
    if(f.trim()) keep.push(f.trim());
  });
  var out = keep.join(". ");
  if(out && out.charAt(out.length-1) !== ".") out += ".";
  return out;
}

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

  var tipiFam = {adulti:false, bimbo:false, apro:false, neo:false};
  Object.values(profili).forEach(function(p){
    var pat = p.patologia;
    var eta = p.dataNascita ? calcolaEta(p.dataNascita).anni : (p.eta || 30);
    if(pat==="svezzamento") tipiFam.neo = true;
    else if(pat==="ipoproteica") tipiFam.apro = true;
    else if(eta < 12) tipiFam.bimbo = true;
    else tipiFam.adulti = true;
  });
  var hasApro = tipiFam.apro;
  var hasNeo = tipiFam.neo;
  var hasBimbo = tipiFam.bimbo;

  return (
    <div>
      <div style={{fontSize:14,fontWeight:800,color:"#2F6586",marginBottom:4}}>Idee e ispirazioni</div>
      <div style={{fontSize:10,color:"#8A949B",marginBottom:12}}>Ricette, ispirazioni e pagine preferite</div>

      <div style={{display:"flex",gap:5,marginBottom:14,overflowX:"auto",paddingBottom:2}}>
        {[
          {id:"live",   l:"Stagione"},
          {id:"ig",     l:"Instagram ("+ricetteIG.length+")"},
          {id:"svuota", l:"Svuota dispensa"},
        ].map(v => (
          <button key={v.id} onClick={()=>setVista(v.id)}
            style={{flex:1,padding:"8px 6px",borderRadius:12,border:"none",cursor:"pointer",
              whiteSpace:"nowrap",
              background:vista===v.id?"#2F6586":"#fff",color:vista===v.id?"#fff":"#555",
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
              background:loading?"#ccc":"linear-gradient(135deg,#2C3338,#2F6586)",
              color:"#fff",fontSize:12,fontWeight:700,cursor:loading?"wait":"pointer",
              marginBottom:12}}>
            {loading?"Claude cerca ricette...":aggiornato?"Aggiorna ("+aggiornato+")":"Carica ispirazioni di oggi"}
          </button>

          {err && <div style={{background:"#FBE7EC",borderRadius:12,padding:"8px 12px",
            fontSize:10,color:"#C2355A",marginBottom:10}}>{err}</div>}

          {!ricette.length && !loading && (
            <div style={{background:"#F5F8FC",borderRadius:14,padding:"24px",textAlign:"center"}}>
              <div style={{fontSize:20,marginBottom:8}}></div>
              <div style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:4}}>
                Premi per caricare le ricette di oggi
              </div>
              <div style={{fontSize:10,color:"#8A949B"}}>
                Claude genera ricette stagionali aggiornate
              </div>
            </div>
          )}

          {ricette.map((ric,i) => (
            <div key={i} style={{background:"#fff",borderRadius:14,
              marginBottom:12,overflow:"hidden",
              boxShadow:ricAperta===ric
                ?"0 0 0 2px #2F6586,0 2px 10px rgba(0,0,0,.1)"
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
                  {ric.categoria&&<span style={{fontSize:9,background:"#EBF3FA",color:"#2F6586",
                    fontWeight:700,padding:"2px 8px",borderRadius:20}}>{ric.categoria}</span>}
                  {ric.tempo&&<span style={{fontSize:9,background:"#F2F6F8",color:"#8A949B",
                    padding:"2px 8px",borderRadius:20}}>{ric.tempo}</span>}
                  {ric.difficolta&&<span style={{fontSize:9,background:"#F2F6F8",color:"#8A949B",
                    padding:"2px 8px",borderRadius:20}}>{ric.difficolta}</span>}
                </div>
                {ric.ingredienti&&(
                  <div style={{marginBottom:8}}>
                    <div style={{fontSize:9,fontWeight:700,color:"#8A949B",marginBottom:4}}>
                      Ingredienti
                    </div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      {ric.ingredienti.map((ing,j)=>(
                        <span key={j} style={{fontSize:9,background:"#F5F8FC",color:"#555",
                          padding:"2px 7px",borderRadius:20,border:"1px solid #E3EAEE"}}>
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
                    <div style={{fontSize:10,fontWeight:800,color:"#2F6586",marginBottom:6}}>
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
                          borderTop:"1px solid #E3EAEE",fontSize:10}}>
                          <span style={{fontWeight:700,color:prof.colore,minWidth:60,flexShrink:0}}>
                            {prof.nome}
                          </span>
                          <span style={{flex:1,color:"#333"}}>{por.piatto}</span>
                          <span style={{color:"#8A949B",whiteSpace:"nowrap"}}>{por.kcal}kcal</span>
                        </div>
                      );
                    })}
                    {filtraNotaRicetta(ric.note,hasApro,hasNeo)&&<div style={{fontSize:9,color:"#8A949B",fontStyle:"italic",
                      marginTop:6,paddingTop:6,borderTop:"1px solid #E3EAEE"}}>{filtraNotaRicetta(ric.note,hasApro,hasNeo)}</div>}
                  </div>
                )}
                <button onClick={()=>setRicAperta(ricAperta===ric?null:ric)}
                  style={{background:ricAperta===ric?"#EBF3FA":"#2F6586",
                    color:ricAperta===ric?"#2F6586":"#fff",
                    border:ricAperta===ric?"1.5px solid #2F6586":"none",
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
                style={{background:"#2F6586",color:"#fff",border:"none",borderRadius:20,
                  padding:"4px 12px",fontSize:10,fontWeight:700,cursor:"pointer"}}>
                {showAddPagina?"Annulla":"+ Aggiungi"}
              </button>
            </div>

            {showAddPagina && (
              <div style={{background:"#EBF3FA",borderRadius:10,padding:"10px 12px",marginBottom:10}}>
                <input placeholder="Nome pagina (es. Giallo Zafferano)"
                  value={nuovaPagina.nome}
                  onChange={e=>setNuovaPagina(p=>({...p,nome:e.target.value}))}
                  style={{width:"100%",padding:"7px",borderRadius:8,border:"1.5px solid #E3EAEE",
                    fontSize:11,marginBottom:6,boxSizing:"border-box"}}/>
                <input placeholder="Handle Instagram (es. giallozafferano)"
                  value={nuovaPagina.handle}
                  onChange={e=>setNuovaPagina(p=>({...p,handle:e.target.value.replace(/[@\s]/g,"")}))}
                  style={{width:"100%",padding:"7px",borderRadius:8,border:"1.5px solid #E3EAEE",
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
                    background:"#2F6586",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                  Salva pagina
                </button>
              </div>
            )}

            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {pagine.map(p=>(
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,
                  padding:"8px 10px",background:"#F5F8FC",borderRadius:10}}>
                  <div style={{width:32,height:32,borderRadius:"50%",
                    background:"linear-gradient(135deg,#C2355A,#C2355A)",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    color:"#fff",fontSize:13,fontWeight:800,flexShrink:0}}>
                    {p.nome.slice(0,1)}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#222"}}>{p.nome}</div>
                    <div style={{fontSize:10,color:"#8A949B"}}>@{p.handle}</div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <a href={p.url} target="_blank" rel="noreferrer"
                      style={{background:"#2F6586",color:"#fff",borderRadius:20,
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
              <div style={{background:"#FBE7EC",borderRadius:10,padding:"10px 12px",marginBottom:10}}>
                <div style={{fontSize:10,fontWeight:700,color:"#C2355A",marginBottom:8}}>
                  Nuova ricetta da Instagram
                </div>
                <input placeholder="Nome ricetta"
                  value={nuovaRicetta.titolo}
                  onChange={e=>setNuovaRicetta(p=>({...p,titolo:e.target.value}))}
                  style={{width:"100%",padding:"7px",borderRadius:8,border:"1.5px solid #FBE7EC",
                    fontSize:12,marginBottom:6,boxSizing:"border-box",fontWeight:700}}/>
                <select value={nuovaRicetta.fonte}
                  onChange={e=>setNuovaRicetta(p=>({...p,fonte:e.target.value}))}
                  style={{width:"100%",padding:"7px",borderRadius:8,border:"1.5px solid #FBE7EC",
                    fontSize:11,marginBottom:6,boxSizing:"border-box"}}>
                  <option value="">Fonte (pagina Instagram)</option>
                  {pagine.map(p=><option key={p.id} value={p.nome}>@{p.handle}</option>)}
                </select>
                <textarea placeholder="Ingredienti principali"
                  value={nuovaRicetta.ingredienti}
                  onChange={e=>setNuovaRicetta(p=>({...p,ingredienti:e.target.value}))}
                  rows={2}
                  style={{width:"100%",padding:"7px",borderRadius:8,border:"1.5px solid #FBE7EC",
                    fontSize:11,marginBottom:6,resize:"none",boxSizing:"border-box"}}/>
                <textarea placeholder="Note (come adattarla, cosa cambiare per i bambini...)"
                  value={nuovaRicetta.note}
                  onChange={e=>setNuovaRicetta(p=>({...p,note:e.target.value}))}
                  rows={2}
                  style={{width:"100%",padding:"7px",borderRadius:8,border:"1.5px solid #FBE7EC",
                    fontSize:11,marginBottom:6,resize:"none",boxSizing:"border-box"}}/>

                {/* Upload foto */}
                <div style={{marginBottom:8}}>
                  <div style={{fontSize:9,fontWeight:700,color:"#8A949B",marginBottom:4}}>
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
                    <label style={{display:"block",border:"1.5px dashed #FBE7EC",
                      borderRadius:10,padding:"14px",textAlign:"center",cursor:"pointer",
                      background:"#fff"}}>
                      <div style={{fontSize:20,marginBottom:4}}>📷</div>
                      <div style={{fontSize:10,color:"#C2355A",fontWeight:700}}>
                        Tocca per aggiungere foto
                      </div>
                      <div style={{fontSize:9,color:"#8A949B",marginTop:2}}>
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
              <div style={{textAlign:"center",padding:"20px",color:"#8A949B",fontSize:11}}>
                Nessuna ricetta salvata.<br/>
                Apri Instagram, trova una ricetta che ti ispira<br/>
                e salvala qui con le tue note.
              </div>
            )}

            {ricetteIG
              .filter(r=>filtroFonte==="tutte"||r.fonte===filtroFonte)
              .map(r=>(
              <div key={r.id} style={{borderTop:"1px solid #F1F4F6",paddingTop:10,marginTop:6}}>
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
                      <div style={{fontSize:10,color:"#8A949B",fontStyle:"italic"}}>
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
            <div style={{fontSize:11,fontWeight:800,color:"#2F6586",marginBottom:4}}>
              Svuota dispensa - zero sprechi
            </div>
            <div style={{fontSize:10,color:"#555"}}>
              Seleziona gli ingredienti da finire e Claude crea 3 ricette
            </div>
          </div>

          {!dispensa.length?(
            <div style={{background:"#F5F8FC",borderRadius:14,padding:"20px",textAlign:"center"}}>
              <div style={{fontSize:10,color:"#8A949B"}}>Dispensa vuota - aggiungila nella tab Dispensa</div>
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
                        style={{background:sel?"#2F6586":"#F5F8FC",
                          color:sel?"#fff":"#444",
                          border:"1.5px solid "+(sel?"#2F6586":"#E3EAEE"),
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
                  marginBottom:10,border:"1.5px solid #CADCE8"}}>
                  <div style={{fontSize:10,fontWeight:700,color:"#2F6586",marginBottom:5}}>
                    Selezionati: {selIng.join(", ")}
                  </div>
                  <button onClick={svuota} disabled={loadSvuota}
                    style={{width:"100%",padding:"10px",borderRadius:12,border:"none",
                      background:loadSvuota?"#ccc":"linear-gradient(135deg,#2C3338,#2F6586)",
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
                      <div style={{fontSize:9,color:"#8A949B"}}>{ric.tempo}</div>
                    </div>
                  </div>
                  <div style={{background:"#EBF3FA",borderRadius:8,padding:"5px 9px",
                    marginBottom:7,fontSize:10,color:"#2F6586"}}>
                    <b>Base:</b> {ric.base}
                  </div>
                  {[{e:"Adulti",k:"adulti"},{e:"Bambini",k:"bimbo"},{e:"Aproteico",k:"apro"},{e:"Neonato",k:"neo"}]
                    .filter(function(p){ return p.k==="adulti" || (p.k==="bimbo"&&hasBimbo) || (p.k==="apro"&&hasApro) || (p.k==="neo"&&hasNeo); })
                    .map(p=>
                    ric[p.k]?(
                      <div key={p.k} style={{display:"flex",gap:7,padding:"3px 0",
                        borderTop:"1px solid #F2F6F8",fontSize:10,color:"#333"}}>
                        <span>{p.e}</span><span style={{flex:1}}>{ric[p.k]}</span>
                      </div>
                    ):null
                  )}
                  {filtraNotaRicetta(ric.note,hasApro,hasNeo)&&<div style={{marginTop:6,fontSize:9,color:"#8A949B",fontStyle:"italic"}}>{filtraNotaRicetta(ric.note,hasApro,hasNeo)}</div>}
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
  var allDB    = CARBOIDRATI.concat(PROTEINE).concat(VERDURE).concat(FRUTTA).concat(SALSE).concat(ALIMENTI_CUSTOM);
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
        <div style={{fontSize:10,color:"#8A949B",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>
          Oggi — {gOggi}
        </div>
        {inseriti.length===0?(
          <div>
            <div style={{fontSize:13,color:"#8A949B",marginBottom:10}}>
              Nessun pasto pianificato.
            </div>
            <button onClick={function(){setTab("builder");}}
              style={{padding:"8px 14px",borderRadius:6,border:"1.5px solid #2C3338",
                background:"transparent",color:"#2C3338",fontSize:11,fontWeight:600,cursor:"pointer"}}>
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
                  borderBottom:"1px solid #F2F6F8",alignItems:"center"}}>
                  <span style={{width:66,fontSize:10,color:"#8A949B",flexShrink:0}}>{x.pasto}</span>
                  <span style={{fontSize:11,color:"#2C3338"}}>
                    {principale?principale.nome:""}
                    {secondo&&<span style={{color:"#8A949B"}}> / {secondo.nome}</span>}
                  </span>
                </div>
              );
            })}
            {kcalOggi>0&&(
              <div style={{fontSize:10,color:"#8A949B",marginTop:6}}>
                {kcalOggi} kcal adulto — {inseriti.length}/{PASTI_H.length} pasti
              </div>
            )}
          </div>
        )}
      </div>

      {/* Settimana */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:10,color:"#8A949B",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>
          Settimana
        </div>
        <div style={{background:"#F1F4F6",borderRadius:3,height:4,marginBottom:4}}>
          <div style={{width:Math.round(completi/totale*100)+"%",height:"100%",
            background:"#2C3338",borderRadius:3}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#8A949B"}}>
          <span>{completi} pasti inseriti su {totale}</span>
          {prossimoGiorno&&<span>Prossimo: {prossimoGiorno}</span>}
        </div>
      </div>

      {/* Dispensa: scaduti */}
      {scaduti.length>0&&(
        <div style={{marginBottom:16,paddingBottom:16,borderBottom:"1px solid #F1F4F6"}}>
          <div style={{fontSize:10,color:"#C2355A",fontWeight:700,
            textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>
            Scaduti — da buttare
          </div>
          {scaduti.map(function(d){
            return (
              <div key={d.id} style={{fontSize:11,color:"#C2355A",padding:"4px 0"}}>
                {d.nome}
                {d.qty&&<span style={{color:"#C2355A",fontSize:10}}> — {d.qty} {d.unita||""}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Dispensa: in scadenza */}
      {presto.length>0&&(
        <div style={{marginBottom:16,paddingBottom:16,borderBottom:"1px solid #F1F4F6"}}>
          <div style={{fontSize:10,color:"#8A5A12",fontWeight:700,
            textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>
            In scadenza nei prossimi 3 giorni
          </div>
          {presto.map(function(d){
            var giorni=Math.round((new Date(d.scadenza)-new Date())/86400000);
            return (
              <div key={d.id} style={{display:"flex",justifyContent:"space-between",
                padding:"5px 0",fontSize:11,color:"#2C3338",borderBottom:"1px solid #F2F6F8"}}>
                <span>{d.nome}</span>
                <span style={{color:"#8A5A12",fontSize:10}}>
                  {giorni===0?"oggi":giorni===1?"domani":"fra "+giorni+" giorni"}
                </span>
              </div>
            );
          })}
          <div style={{fontSize:10,color:"#8A949B",marginTop:6}}>
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
          <div style={{fontSize:9,color:"#8A949B",marginBottom:8}}>
            Non trovati in dispensa
          </div>
          {mancanti.slice(0,8).map(function(nome){
            return (
              <div key={nome} style={{display:"flex",alignItems:"center",gap:8,
                padding:"6px 0",borderBottom:"1px solid #F2F6F8",fontSize:11,color:"#2C3338"}}>
                <div style={{width:4,height:4,borderRadius:"50%",background:"#8A949B",flexShrink:0}}/>
                {nome}
              </div>
            );
          })}
          {mancanti.length>8&&(
            <div style={{fontSize:10,color:"#8A949B",marginTop:4}}>
              + altri {mancanti.length-8}
            </div>
          )}
          <button onClick={function(){setTab("dispensa");}}
            style={{marginTop:10,padding:"7px 14px",borderRadius:6,
              border:"1.5px solid #8A949B",background:"transparent",
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
                          pesoLog, setPesoLog, pin, setPin, onModificaFamiglia,
                          familyId, userId, isAdmin, onIscritti, onJoinedFamiglia,
                          utenteEmail, onSincronizza, onControlla, onLogout}) {
  const [sezione, setSezione] = useState("");
  var sSync = useState(""); var syncMsg = sSync[0]; var setSyncMsg = sSync[1];
  var sSyncL = useState(false); var syncLoad = sSyncL[0]; var setSyncLoad = sSyncL[1];
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
    {id:"famiglia",    l:"La tua famiglia",     s:"Profili e restrizioni",       ic:"ti-users"},
    {id:"sync",        l:"Sincronizza sul cloud",s:"Salva i dati per altri dispositivi", ic:"ti-cloud-up"},
    {id:"condivisa",   l:"Famiglia condivisa",  s:"Invita altri con un codice",  ic:"ti-users-group"},
    {id:"nutrizionale",l:"Valori nutrizionali", s:"Kcal e proteine per membro",  ic:"ti-flame"},
    {id:"pesi",        l:"Pesi e misure",       s:"Peso, altezza, eta",          ic:"ti-scale"},
    {id:"piano",       l:"Promemoria settimana",s:"Quando pianificare il menu",  ic:"ti-calendar"},
    {id:"sicurezza",   l:"Blocco con PIN",      s:"Proteggi l'app",              ic:"ti-lock"},
  ];
  var sezCorr = SEZIONI.find(function(x){ return x.id===sezione; });

  return (
    <div>
      {sezione==="" ? (
        <div>
          <div style={{fontSize:23,fontWeight:800,letterSpacing:"-0.01em",paddingTop:4,marginBottom:12}}>Impostazioni</div>
          <div className="mf-card flush">
            {SEZIONI.map(function(s){
              return (
                <div key={s.id} className="mf-row" style={{cursor:"pointer"}} onClick={function(){ setSezione(s.id); }}>
                  <div className="mf-ic"><i className={"ti "+s.ic}/></div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700,color:"#2C3338"}}>{s.l}</div>
                    <div style={{fontSize:11,color:"#8A949B"}}>{s.s}</div>
                  </div>
                  <i className="ti ti-chevron-right" style={{color:"#B4BEC4",fontSize:18}}/>
                </div>
              );
            })}
            {isAdmin && (
              <div className="mf-row" style={{cursor:"pointer"}} onClick={function(){ if(onIscritti) onIscritti(); }}>
                <div className="mf-ic"><i className="ti ti-user-check"/></div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,color:"#2C3338"}}>Iscritti all'app</div>
                  <div style={{fontSize:11,color:"#8A949B"}}>Elenco degli utenti registrati</div>
                </div>
                <i className="ti ti-chevron-right" style={{color:"#B4BEC4",fontSize:18}}/>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div onClick={function(){ setSezione(""); }} style={{display:"flex",alignItems:"center",gap:6,color:"#2F6586",fontSize:14,fontWeight:700,cursor:"pointer",paddingTop:4,marginBottom:12}}>
            <i className="ti ti-chevron-left" style={{fontSize:18}}/>Impostazioni
          </div>
          <div style={{fontSize:20,fontWeight:800,letterSpacing:"-0.01em",marginBottom:14,display:"flex",alignItems:"center",gap:9}}>
            <i className={"ti "+(sezCorr?sezCorr.ic:"ti-settings")} style={{color:"#2F6586",fontSize:22}}/>{sezCorr?sezCorr.l:"Impostazioni"}
          </div>

      {sezione==="condivisa" && (
        <FamigliaCondivisa familyId={familyId} userId={userId} onJoined={onJoinedFamiglia}/>
      )}

      {sezione==="sync" && (
        <div className="mf-card" style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{fontSize:13,color:"#8A949B"}}>Invia i dati del telefono al cloud, così li ritrovi su un altro accesso o su un altro dispositivo (es. telefono di tuo marito).</div>
          <div style={{background:"#F2F6F8",borderRadius:12,padding:"10px 12px",fontSize:12}}>
            <div style={{display:"flex",justifyContent:"space-between",padding:"3px 0"}}><span style={{color:"#8A949B"}}>Account</span><span style={{fontWeight:700}}>{utenteEmail || "—"}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",padding:"3px 0"}}><span style={{color:"#8A949B"}}>Famiglia collegata</span><span style={{fontWeight:700,color:familyId?"#2F6586":"#C2355A"}}>{familyId ? "Sì" : "No"}</span></div>
          </div>
          <button disabled={syncLoad} onClick={function(){
              setSyncLoad(true); setSyncMsg("");
              if(onSincronizza) onSincronizza(function(msg){ setSyncMsg(msg); setSyncLoad(false); });
              else { setSyncLoad(false); }
            }}
            style={{border:"none",background:"#2F6586",color:"#fff",borderRadius:13,padding:"13px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:syncLoad?0.7:1}}>
            <i className="ti ti-cloud-up" style={{fontSize:18}}/>{syncLoad ? "Sincronizzo…" : "Sincronizza tutto sul cloud"}
          </button>
          <button onClick={function(){ setSyncMsg("Controllo…"); if(onControlla) onControlla(function(msg){ setSyncMsg(msg); }); }}
            style={{border:"1.5px solid #6BA6C9",background:"#fff",color:"#2F6586",borderRadius:13,padding:"11px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
            <i className="ti ti-cloud-search" style={{fontSize:16}}/>Controlla cosa c'è sul cloud
          </button>
          {syncMsg && <div style={{fontSize:12,color:"#2F6586",fontWeight:600,lineHeight:1.4,background:"#F2F6F8",borderRadius:10,padding:"10px 12px"}}>{syncMsg}</div>}
          <div style={{borderTop:"1px solid #F1F4F6",paddingTop:12,marginTop:2}}>
            <div style={{fontSize:11,color:"#8A949B",marginBottom:8}}>Se l'accesso è bloccato o i dati non si salvano, esci e rientra: aggiorna l'accesso. I dati sul telefono restano.</div>
            <button onClick={function(){ if(window.confirm("Esci dall'account? I tuoi dati sul telefono restano. Dovrai rifare il login.")) { if(onLogout) onLogout(); } }}
              style={{width:"100%",border:"1.5px solid #C2355A",background:"#fff",color:"#C2355A",borderRadius:13,padding:"11px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
              <i className="ti ti-logout" style={{fontSize:17}}/>Esci dall'account
            </button>
          </div>
        </div>
      )}

      {/* ── FAMILIARI ── */}
      {sezione==="famiglia" && (
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:14,fontWeight:800,color:"#2F6586"}}>La tua famiglia</div>
            <button onClick={function(){ if(onModificaFamiglia) onModificaFamiglia(); }}
              style={{background:"#2F6586",color:"#fff",border:"none",borderRadius:20,
                padding:"6px 14px",fontSize:11,fontWeight:700,cursor:"pointer",
                display:"flex",alignItems:"center",gap:6}}>
              <i className="ti ti-edit" style={{fontSize:14}}/>Modifica
            </button>
          </div>
          {Object.entries(profili).map(function(ent){
            var pid = ent[0]; var p = ent[1];
            var patLabel = (PATOLOGIE_LIST.find(function(x){ return x.id === p.patologia; })||{}).label || "Nessuna restrizione";
            return (
              <div key={pid} style={{background:"#fff",borderRadius:14,padding:"12px 14px",
                marginBottom:10,boxShadow:"0 1px 6px rgba(0,0,0,.07)",borderLeft:"4px solid "+(p.colore||"#6BA6C9")}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{width:34,height:34,borderRadius:"50%",background:"#E2EEF5",color:"#2F6586",
                    display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800}}>
                    {p.nome ? p.nome.slice(0,1).toUpperCase() : "?"}
                  </span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:800,color:"#2C3338"}}>{p.nome}</div>
                    <div style={{display:"flex",gap:5,marginTop:3,flexWrap:"wrap"}}>
                      <span style={{fontSize:9,background:"#EBF3FA",color:"#2F6586",fontWeight:700,padding:"2px 8px",borderRadius:20}}>{patLabel}</span>
                      <span style={{fontSize:9,background:"#EBF3FA",color:"#2F6586",padding:"2px 8px",borderRadius:20}}>{p.kcal_target} kcal</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div style={{fontSize:11,color:"#8A949B",marginTop:4}}>
            Usa "Modifica" per aggiungere, rimuovere o cambiare i profili della famiglia.
          </div>
        </div>
      )}

      {/* ── ESIGENZE NUTRIZIONALI ── */}
      {sezione==="nutrizionale" && (
        <div>
          <div style={{fontSize:11,color:"#8A949B",marginBottom:12}}>
            Modifica kcal e proteine prescritte per ogni membro.
            Lascia vuoto per usare i valori automatici della patologia.
          </div>
          {Object.entries(profili).map(([pid,prof])=>(
            <div key={pid} style={{background:"#fff",borderRadius:14,padding:"12px 14px",
              marginBottom:10,boxShadow:"0 1px 6px rgba(0,0,0,.07)",
              borderLeft:"4px solid "+prof.colore}}>
              <div style={{fontSize:12,fontWeight:800,color:"#222",marginBottom:10}}>
                {prof.nome}
                <span style={{fontSize:10,fontWeight:400,color:"#8A949B",marginLeft:6}}>
                  {(PATOLOGIE_LIST.find(p=>p.id===prof.patologia)||{}).label||""}
                </span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <div>
                  <div style={{fontSize:9,fontWeight:700,color:"#8A949B",marginBottom:3}}>
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
                      border:"1.5px solid #E2EEF5",fontSize:13,fontWeight:700,
                      color:prof.colore,boxSizing:"border-box"}}/>
                </div>
                <div>
                  <div style={{fontSize:9,fontWeight:700,color:"#8A949B",marginBottom:3}}>
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
                      border:"1.5px solid #E2EEF5",fontSize:13,fontWeight:700,
                      color:prof.patologia==="ipoproteica"?"#C2355A":prof.colore,
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
          <div style={{fontSize:11,color:"#8A949B",marginBottom:12}}>
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
                      <div style={{fontSize:9,fontWeight:700,color:"#8A949B",marginBottom:3}}>
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
                          border:"1.5px solid #E2EEF5",fontSize:13,fontWeight:700,
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
            <div style={{fontSize:10,color:"#8A949B",marginBottom:14}}>
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
                      border:"1.5px solid "+(pianificazione.giorno===i?"#2F6586":"#ddd"),
                      background:pianificazione.giorno===i?"#2F6586":"#fff",
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
                      border:"1.5px solid "+(pianificazione.ora===o?"#2F6586":"#ddd"),
                      background:pianificazione.ora===o?"#2F6586":"#fff",
                      color:pianificazione.ora===o?"#fff":"#555",
                      fontWeight:pianificazione.ora===o?700:400}}>
                    {o}
                  </button>
                ))}
              </div>
            </div>

            {pianificazione.attiva&&(
              <div style={{background:"#EBF3FA",borderRadius:10,padding:"8px 12px",
                marginBottom:10,fontSize:10,color:"#2F6586",fontWeight:700}}>
                Attivo: ogni {GIORNI_IMP[pianificazione.giorno]} alle {pianificazione.ora}
                {pianificazione.notifiche?" con notifica":" (notifica non attiva)"}
              </div>
            )}

            <button onClick={()=>salvaPiano(pianificazione.giorno, pianificazione.ora)}
              style={{width:"100%",padding:"10px",borderRadius:12,border:"none",
                background:"#2F6586",color:"#fff",fontSize:12,
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
            <div style={{fontSize:10,color:"#8A949B",marginBottom:14}}>
              Proteggi l'app con un PIN numerico. Ogni membro della famiglia
              puo usare lo stesso PIN per accedere ai propri dati.
            </div>

            {pin.attivo&&(
              <div style={{background:"#EBF3FA",borderRadius:10,padding:"9px 12px",
                marginBottom:12,display:"flex",justifyContent:"space-between",
                alignItems:"center"}}>
                <div style={{fontSize:11,fontWeight:700,color:"#2F6586"}}>
                  PIN attivo
                </div>
                <button onClick={()=>setPin({attivo:false,codice:"",sbloccato:true})}
                  style={{background:"#FBE7EC",border:"none",borderRadius:20,
                    padding:"3px 10px",fontSize:10,cursor:"pointer",color:"#C2355A",fontWeight:700}}>
                  Rimuovi PIN
                </button>
              </div>
            )}

            {pinSalvato&&(
              <div style={{background:"#EBF3FA",borderRadius:10,padding:"8px 12px",
                marginBottom:12,fontSize:11,fontWeight:700,color:"#2F6586"}}>
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
                  border:"1.5px solid #E2EEF5",fontSize:18,fontWeight:700,
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
                  border:"1.5px solid "+(pinErr?"#C2355A":"#E3EAEE"),
                  fontSize:18,fontWeight:700,
                  letterSpacing:6,textAlign:"center",boxSizing:"border-box"}}/>
            </div>
            {pinErr&&<div style={{fontSize:10,color:"#C2355A",
              fontWeight:700,marginBottom:10}}>{pinErr}</div>}

            <button onClick={salvaPin}
              disabled={!nuovoPin||!confPin}
              style={{width:"100%",padding:"10px",borderRadius:12,border:"none",
                background:nuovoPin&&confPin?"#2F6586":"#ccc",
                color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>
              Salva PIN
            </button>
          </div>
        </div>
      )}
        </div>
      )}
    </div>
  );
}

// ── PROFILI INIZIALI ─────────────────────────────────────────
const PROFILI_INIZIALI = {
  adulta: {id:"adulta",nome:"Mamma",emoji:"?",patologia:"dimagrimento",
    kcal_target:1400,prot_max:70,colore:"#2F6586",eta:35,peso:0,altezza:165,
    kcal_custom:"",prot_custom:""},
  adulto: {id:"adulto",nome:"Papa",emoji:"?",patologia:"dimagrimento",
    kcal_target:1600,prot_max:80,colore:"#2F6586",eta:38,peso:0,altezza:178,
    kcal_custom:"",prot_custom:""},
  bimbo: {id:"bimbo",nome:"Bimbo grande",emoji:"?",patologia:"nessuna",
    kcal_target:1600,prot_max:45,colore:"#6BA6C9",eta:8,peso:0,altezza:130,
    kcal_custom:"",prot_custom:""},
  apro: {id:"apro",nome:"Bimbo aproteico",emoji:"?",patologia:"ipoproteica",
    kcal_target:1500,prot_max:20,colore:"#C2355A",eta:4,peso:0,altezza:100,
    kcal_custom:"",prot_custom:""},
  neo: {id:"neo",nome:"Neonato",emoji:"?",patologia:"svezzamento",
    kcal_target:800,prot_max:14,colore:"#C2355A",eta:0,peso:0,altezza:70,
    kcal_custom:"",prot_custom:""},
};


// ── CONSTANTS ────────────────────────────────────────────────
var GIORNI = ["Lunedi","Martedi","Mercoledi","Giovedi","Venerdi","Sabato","Domenica"];
var PASTI  = ["Colazione","Spuntino","Pranzo","Merenda","Cena"];
var PASTI_TIPO = {Colazione:"colazione",Spuntino:"spuntino",Pranzo:"pranzo",Merenda:"spuntino",Cena:"cena"};

var CARBO_CATS = {pasta:"Pasta",riso:"Riso",cereali:"Cereali",tuberi:"Patate",pane:"Pane"};
var PROT_CATS  = {"carne bianca":"Carne bianca","carne rossa":"Carne rossa",pesce:"Pesce",uova:"Uova",legumi:"Legumi",affettati:"Affettati",latticini:"Latticini"};

var CARBOIDRATI = [
  {id:"spaghetti",nome:"Spaghetti",cat:"pasta",emoji:"?",kcal_p:350,prot_p:12,carb_p:72,phe_p:620,gsat_p:0.2,na_p:6,stagione:"tutto"},
  {id:"rigatoni",nome:"Rigatoni",cat:"pasta",emoji:"?",kcal_p:350,prot_p:12,carb_p:72,phe_p:620,gsat_p:0.2,na_p:6,stagione:"tutto"},
  {id:"penne",nome:"Penne rigate",cat:"pasta",emoji:"?",kcal_p:350,prot_p:12,carb_p:72,phe_p:620,gsat_p:0.2,na_p:6,stagione:"tutto"},
  {id:"fusilli",nome:"Fusilli",cat:"pasta",emoji:"?",kcal_p:350,prot_p:12,carb_p:72,phe_p:620,gsat_p:0.2,na_p:6,stagione:"tutto"},
  {id:"farfalle",nome:"Farfalle",cat:"pasta",emoji:"?",kcal_p:350,prot_p:12,carb_p:72,phe_p:620,gsat_p:0.2,na_p:6,stagione:"tutto"},
  {id:"tagliatelle",nome:"Tagliatelle",cat:"pasta",emoji:"?",kcal_p:350,prot_p:13,carb_p:71,phe_p:650,gsat_p:0.5,na_p:20,stagione:"tutto"},
  {id:"orecchiette",nome:"Orecchiette",cat:"pasta",emoji:"?",kcal_p:350,prot_p:12,carb_p:72,phe_p:620,gsat_p:0.2,na_p:6,stagione:"tutto"},
  {id:"lasagne",nome:"Lasagne",cat:"pasta",emoji:"?",kcal_p:380,prot_p:13,carb_p:70,phe_p:660,gsat_p:0.6,na_p:25,stagione:"tutto"},
  {id:"gnocchi",nome:"Gnocchi di patate",cat:"pasta",emoji:"?",kcal_p:280,prot_p:4,carb_p:44,phe_p:190,gsat_p:0.2,na_p:290,stagione:"tutto"},
  {id:"ravioli",nome:"Ravioli",cat:"pasta",emoji:"?",kcal_p:320,prot_p:12,carb_p:45,phe_p:600,gsat_p:2.0,na_p:400,stagione:"tutto"},
  {id:"noodles",nome:"Noodles di riso",cat:"pasta",emoji:"?",kcal_p:360,prot_p:6,carb_p:80,phe_p:300,gsat_p:0.1,na_p:10,stagione:"tutto"},
  {id:"soba",nome:"Soba grano saraceno",cat:"pasta",emoji:"?",kcal_p:340,prot_p:14,carb_p:70,phe_p:640,gsat_p:0.2,na_p:60,stagione:"tutto"},
  {id:"pasta_leg",nome:"Pasta di legumi",cat:"pasta",emoji:"?",kcal_p:330,prot_p:22,carb_p:50,phe_p:1150,gsat_p:0.4,na_p:12,stagione:"tutto"},
  {id:"riso_b",nome:"Riso bianco",cat:"riso",emoji:"?",kcal_p:300,prot_p:7,carb_p:80,phe_p:370,gsat_p:0.2,na_p:1,stagione:"tutto"},
  {id:"riso_int",nome:"Riso integrale",cat:"riso",emoji:"?",kcal_p:290,prot_p:7.5,carb_p:76,phe_p:390,gsat_p:0.3,na_p:4,stagione:"tutto"},
  {id:"riso_bas",nome:"Riso basmati",cat:"riso",emoji:"?",kcal_p:300,prot_p:7.5,carb_p:78,phe_p:390,gsat_p:0.1,na_p:2,stagione:"tutto"},
  {id:"risotto",nome:"Risotto",cat:"riso",emoji:"?",kcal_p:340,prot_p:7,carb_p:65,phe_p:360,gsat_p:2.5,na_p:400,stagione:"tutto"},
  {id:"farro",nome:"Farro",cat:"cereali",emoji:"?",kcal_p:305,prot_p:15,carb_p:67,phe_p:720,gsat_p:0.4,na_p:8,stagione:"tutto"},
  {id:"orzo",nome:"Orzo perlato",cat:"cereali",emoji:"?",kcal_p:295,prot_p:10,carb_p:73,phe_p:520,gsat_p:0.2,na_p:9,stagione:"tutto"},
  {id:"quinoa",nome:"Quinoa",cat:"cereali",emoji:"?",kcal_p:320,prot_p:14,carb_p:64,phe_p:600,gsat_p:0.7,na_p:5,stagione:"tutto"},
  {id:"cous",nome:"Cous cous",cat:"cereali",emoji:"?",kcal_p:310,prot_p:13,carb_p:72,phe_p:660,gsat_p:0.1,na_p:10,stagione:"tutto"},
  {id:"polenta",nome:"Polenta",cat:"cereali",emoji:"?",kcal_p:250,prot_p:8,carb_p:79,phe_p:390,gsat_p:0.6,na_p:35,stagione:"tutto"},
  {id:"patate",nome:"Patate",cat:"tuberi",emoji:"?",kcal_p:200,prot_p:2,carb_p:17,phe_p:90,gsat_p:0.05,na_p:6,stagione:"tutto"},
  {id:"patate_d",nome:"Patate dolci",cat:"tuberi",emoji:"?",kcal_p:220,prot_p:1.6,carb_p:20,phe_p:80,gsat_p:0.05,na_p:55,stagione:"tutto"},
  {id:"pane_b",nome:"Pane bianco",cat:"pane",emoji:"?",kcal_p:265,prot_p:8,carb_p:50,phe_p:410,gsat_p:0.4,na_p:450,stagione:"tutto"},
  {id:"pane_int",nome:"Pane integrale",cat:"pane",emoji:"?",kcal_p:240,prot_p:9,carb_p:45,phe_p:450,gsat_p:0.5,na_p:400,stagione:"tutto"},
  {id:"focaccia",nome:"Focaccia",cat:"pane",emoji:"?",kcal_p:310,prot_p:8,carb_p:50,phe_p:410,gsat_p:1.5,na_p:600,stagione:"tutto"},
  {id:"pizza",nome:"Pizza",cat:"pane",emoji:"?",kcal_p:420,prot_p:11,carb_p:50,phe_p:560,gsat_p:4.0,na_p:600,stagione:"tutto"},
  {id:"piadina",nome:"Piadina",cat:"pane",emoji:"?",kcal_p:340,prot_p:8,carb_p:50,phe_p:410,gsat_p:5.0,na_p:700,stagione:"tutto"},
  {id:"pinsa",nome:"Pinsa romana",cat:"pane",emoji:"?",kcal_p:260,prot_p:9,carb_p:48,phe_p:450,gsat_p:0.5,na_p:500,stagione:"tutto"},
  {id:"avena",nome:"Avena/porridge",cat:"colazione",emoji:"?",kcal_p:370,prot_p:13,carb_p:60,phe_p:700,gsat_p:1.2,na_p:4,stagione:"tutto"},
  {id:"muesli",nome:"Muesli",cat:"colazione",emoji:"?",kcal_p:360,prot_p:10,carb_p:65,phe_p:500,gsat_p:1.0,na_p:30,stagione:"tutto"},
  {id:"granola",nome:"Granola",cat:"colazione",emoji:"?",kcal_p:410,prot_p:9,carb_p:64,phe_p:450,gsat_p:3.0,na_p:30,stagione:"tutto"},
  {id:"fette_int",nome:"Fette biscottate",cat:"colazione",emoji:"?",kcal_p:380,prot_p:11,carb_p:72,phe_p:550,gsat_p:0.6,na_p:500,stagione:"tutto"},
  {id:"gallette",nome:"Gallette di riso",cat:"colazione",emoji:"?",kcal_p:380,prot_p:8,carb_p:81,phe_p:400,gsat_p:0.2,na_p:20,stagione:"tutto"},
  {id:"pancakes",nome:"Pancakes",cat:"colazione",emoji:"?",kcal_p:280,prot_p:8,carb_p:40,phe_p:410,gsat_p:2.0,na_p:350,stagione:"tutto"},
];

var PROTEINE = [
  {id:"pollo_f",nome:"Petto di pollo",cat:"carne bianca",emoji:"?",kcal_p:165,prot_p:31,carb_p:0,phe_p:1230,gsat_p:1.0,na_p:70,piramide:"carne",freq:"3/sett"},
  {id:"pollo_c",nome:"Cosce di pollo",cat:"carne bianca",emoji:"?",kcal_p:215,prot_p:26,carb_p:0,phe_p:1030,gsat_p:2.5,na_p:85,piramide:"carne",freq:"3/sett"},
  {id:"tacchino",nome:"Tacchino",cat:"carne bianca",emoji:"?",kcal_p:135,prot_p:30,carb_p:0,phe_p:1180,gsat_p:0.7,na_p:60,piramide:"carne",freq:"3/sett"},
  {id:"manzo",nome:"Manzo",cat:"carne rossa",emoji:"?",kcal_p:250,prot_p:26,carb_p:0,phe_p:1030,gsat_p:6.0,na_p:60,piramide:"carne_rossa",limit:1,freq:"1/sett"},
  {id:"agnello",nome:"Agnello",cat:"carne rossa",emoji:"?",kcal_p:294,prot_p:25,carb_p:0,phe_p:1000,gsat_p:8.0,na_p:70,piramide:"carne_rossa",limit:1,freq:"1/sett"},
  {id:"salmone",nome:"Salmone",cat:"pesce",emoji:"?",kcal_p:208,prot_p:20,carb_p:0,phe_p:790,gsat_p:3.0,na_p:60,piramide:"pesce",freq:"3/sett"},
  {id:"merluzzo",nome:"Merluzzo",cat:"pesce",emoji:"?",kcal_p:82,prot_p:18,carb_p:0,phe_p:710,gsat_p:0.1,na_p:80,piramide:"pesce",freq:"3/sett"},
  {id:"tonno",nome:"Tonno",cat:"pesce",emoji:"?",kcal_p:132,prot_p:28,carb_p:0,phe_p:1100,gsat_p:0.3,na_p:40,piramide:"pesce",freq:"3/sett"},
  {id:"orata",nome:"Orata",cat:"pesce",emoji:"?",kcal_p:120,prot_p:20,carb_p:0,phe_p:790,gsat_p:0.8,na_p:70,piramide:"pesce",freq:"3/sett"},
  {id:"gamberetti",nome:"Gamberetti",cat:"pesce",emoji:"?",kcal_p:106,prot_p:20,carb_p:0.9,phe_p:790,gsat_p:0.3,na_p:220,piramide:"pesce",freq:"3/sett"},
  {id:"uova",nome:"Uova",cat:"uova",emoji:"?",kcal_p:155,prot_p:13,carb_p:1.1,phe_p:680,gsat_p:3.3,na_p:140,piramide:"uova",limit:2,freq:"2/sett"},
  {id:"ceci",nome:"Ceci",cat:"legumi",emoji:"?",kcal_p:130,prot_p:9,carb_p:20,phe_p:480,gsat_p:0.3,na_p:5,piramide:"legumi",freq:"3/sett"},
  {id:"lenticchie",nome:"Lenticchie",cat:"legumi",emoji:"?",kcal_p:116,prot_p:9,carb_p:20,phe_p:470,gsat_p:0.1,na_p:2,piramide:"legumi",freq:"3/sett"},
  {id:"fagioli",nome:"Fagioli",cat:"legumi",emoji:"?",kcal_p:127,prot_p:9,carb_p:22,phe_p:480,gsat_p:0.1,na_p:2,piramide:"legumi",freq:"3/sett"},
  {id:"prosciutto",nome:"Prosciutto cotto",cat:"affettati",emoji:"?",kcal_p:145,prot_p:19,carb_p:1,phe_p:750,gsat_p:3.0,na_p:950,piramide:"carne",freq:"libero"},
  {id:"bresaola",nome:"Bresaola",cat:"affettati",emoji:"?",kcal_p:151,prot_p:32,carb_p:0.5,phe_p:1280,gsat_p:1.5,na_p:1600,piramide:"carne",freq:"libero"},
  {id:"mortadella",nome:"Mortadella",cat:"affettati",emoji:"?",kcal_p:311,prot_p:15,carb_p:1.5,phe_p:600,gsat_p:9.0,na_p:1100,piramide:"carne",freq:"libero"},
  {id:"yogurt_g",nome:"Yogurt greco",cat:"latticini",emoji:"?",kcal_p:100,prot_p:10,carb_p:4,phe_p:500,gsat_p:3.0,na_p:50,piramide:"latticini",freq:"libero"},
  {id:"ricotta",nome:"Ricotta",cat:"latticini",emoji:"?",kcal_p:174,prot_p:11,carb_p:3,phe_p:550,gsat_p:7.0,na_p:80,piramide:"latticini",freq:"libero"},
  {id:"mozzarella",nome:"Mozzarella",cat:"latticini",emoji:"?",kcal_p:280,prot_p:18,carb_p:2,phe_p:900,gsat_p:12,na_p:400,piramide:"latticini",freq:"libero"},
  {id:"feta",nome:"Feta",cat:"latticini",emoji:"?",kcal_p:264,prot_p:14,carb_p:4,phe_p:700,gsat_p:13,na_p:1100,piramide:"latticini",freq:"libero"},
];

var VERDURE = [
  {id:"zucchine",nome:"Zucchine",emoji:"?",stagione:"estate,primavera",kcal_p:17,prot_p:1.2,carb_p:3,phe_p:50,gsat_p:0.1,na_p:8},
  {id:"melanzane",nome:"Melanzane",emoji:"?",stagione:"estate",kcal_p:25,prot_p:1.0,carb_p:6,phe_p:45,gsat_p:0.0,na_p:2},
  {id:"peperoni",nome:"Peperoni",emoji:"?",stagione:"estate",kcal_p:31,prot_p:1.0,carb_p:6,phe_p:40,gsat_p:0.0,na_p:4},
  {id:"pomodori",nome:"Pomodori",emoji:"?",stagione:"estate",kcal_p:18,prot_p:0.9,carb_p:4,phe_p:35,gsat_p:0.0,na_p:5},
  {id:"spinaci",nome:"Spinaci",emoji:"?",stagione:"inverno,primavera",kcal_p:23,prot_p:2.9,carb_p:4,phe_p:130,gsat_p:0.1,na_p:79},
  {id:"broccoli",nome:"Broccoli",emoji:"?",stagione:"autunno,inverno",kcal_p:34,prot_p:2.8,carb_p:7,phe_p:120,gsat_p:0.1,na_p:33},
  {id:"cavolfiore",nome:"Cavolfiore",emoji:"?",stagione:"autunno,inverno",kcal_p:25,prot_p:1.9,carb_p:5,phe_p:80,gsat_p:0.1,na_p:30},
  {id:"carote",nome:"Carote",emoji:"?",stagione:"tutto",kcal_p:41,prot_p:0.9,carb_p:10,phe_p:40,gsat_p:0.0,na_p:69},
  {id:"funghi",nome:"Funghi",emoji:"?",stagione:"autunno",kcal_p:22,prot_p:3.1,carb_p:3,phe_p:90,gsat_p:0.0,na_p:5},
  {id:"asparagi",nome:"Asparagi",emoji:"?",stagione:"primavera",kcal_p:20,prot_p:2.2,carb_p:4,phe_p:90,gsat_p:0.0,na_p:2},
  {id:"fagiolini",nome:"Fagiolini",emoji:"?",stagione:"estate",kcal_p:31,prot_p:1.8,carb_p:7,phe_p:75,gsat_p:0.0,na_p:6},
  {id:"insalata",nome:"Insalata mista",emoji:"?",stagione:"tutto",kcal_p:15,prot_p:1.3,carb_p:3,phe_p:50,gsat_p:0.0,na_p:10},
  {id:"cipolla",nome:"Cipolla",emoji:"?",stagione:"tutto",kcal_p:40,prot_p:1.1,carb_p:9,phe_p:40,gsat_p:0.0,na_p:4},
  {id:"aglio",nome:"Aglio",emoji:"?",stagione:"tutto",kcal_p:149,prot_p:6.4,carb_p:33,phe_p:180,gsat_p:0.1,na_p:17},
  {id:"pomodori_c",nome:"Pomodorini",emoji:"?",stagione:"estate",kcal_p:18,prot_p:0.9,carb_p:4,phe_p:35,gsat_p:0.0,na_p:5},
  {id:"rucola",nome:"Rucola",emoji:"?",stagione:"tutto",kcal_p:25,prot_p:2.6,carb_p:4,phe_p:100,gsat_p:0.1,na_p:27},
  {id:"zucca",nome:"Zucca",emoji:"?",stagione:"autunno",kcal_p:26,prot_p:1.0,carb_p:7,phe_p:40,gsat_p:0.0,na_p:1},
  {id:"cavolo_n",nome:"Cavolo nero",emoji:"?",stagione:"inverno",kcal_p:35,prot_p:3.3,carb_p:9,phe_p:140,gsat_p:0.2,na_p:40},
  {id:"bietola",nome:"Bietola",emoji:"?",stagione:"tutto",kcal_p:19,prot_p:1.8,carb_p:4,phe_p:75,gsat_p:0.0,na_p:210},
  {id:"piselli_v",nome:"Piselli",emoji:"?",stagione:"primavera",kcal_p:81,prot_p:5.4,carb_p:14,phe_p:230,gsat_p:0.1,na_p:5},
];

var FRUTTA = [
  {id:"mele",nome:"Mele",emoji:"?",stagione:"autunno,inverno",kcal_p:52,prot_p:0.3,carb_p:14,phe_p:12,gsat_p:0.0,na_p:1},
  {id:"pere",nome:"Pere",emoji:"?",stagione:"autunno",kcal_p:57,prot_p:0.4,carb_p:15,phe_p:12,gsat_p:0.0,na_p:1},
  {id:"arance",nome:"Arance",emoji:"?",stagione:"inverno",kcal_p:47,prot_p:0.9,carb_p:12,phe_p:30,gsat_p:0.0,na_p:0},
  {id:"fragole",nome:"Fragole",emoji:"?",stagione:"primavera",kcal_p:32,prot_p:0.7,carb_p:8,phe_p:25,gsat_p:0.0,na_p:1},
  {id:"pesche",nome:"Pesche",emoji:"?",stagione:"estate",kcal_p:39,prot_p:0.9,carb_p:10,phe_p:25,gsat_p:0.0,na_p:0},
  {id:"anguria",nome:"Anguria",emoji:"?",stagione:"estate",kcal_p:30,prot_p:0.6,carb_p:8,phe_p:20,gsat_p:0.0,na_p:1},
  {id:"uva",nome:"Uva",emoji:"?",stagione:"autunno",kcal_p:69,prot_p:0.6,carb_p:18,phe_p:20,gsat_p:0.0,na_p:2},
  {id:"banana",nome:"Banana",emoji:"?",stagione:"tutto",kcal_p:89,prot_p:1.1,carb_p:23,phe_p:40,gsat_p:0.1,na_p:1},
  {id:"kiwi",nome:"Kiwi",emoji:"?",stagione:"inverno,primavera",kcal_p:61,prot_p:1.1,carb_p:15,phe_p:40,gsat_p:0.0,na_p:3},
  {id:"mirtilli",nome:"Mirtilli",emoji:"?",stagione:"estate",kcal_p:57,prot_p:0.7,carb_p:14,phe_p:25,gsat_p:0.0,na_p:1},
  {id:"ciliegie",nome:"Ciliegie",emoji:"?",stagione:"estate",kcal_p:50,prot_p:1.0,carb_p:12,phe_p:30,gsat_p:0.0,na_p:0},
  {id:"fichi",nome:"Fichi",emoji:"?",stagione:"estate",kcal_p:74,prot_p:0.8,carb_p:19,phe_p:30,gsat_p:0.0,na_p:1},
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
      <div style={{fontSize:9,fontWeight:700,color:ok?"#2F6586":"#8A949B",marginBottom:5}}>
        {ok?"Pasto ok":"Piatto"}
      </div>
      <div style={{width:80,height:80,borderRadius:"50%",margin:"0 auto 6px",
        border:"3px solid "+(ok?"#2F6586":"#ddd"),
        overflow:"hidden",display:"flex",flexWrap:"wrap"}}>
        {isPrinc ? (
          <div style={{width:"100%",height:"100%",display:"flex",flexWrap:"wrap"}}>
            <div style={{width:"50%",height:"50%",background:c?"#8A5A1299":"#F1F4F6"}}/>
            <div style={{width:"50%",height:"50%",background:v?"#6BA6C999":"#F1F4F6"}}/>
            <div style={{width:"100%",height:"50%",background:p?"#6BA6C999":"#F1F4F6"}}/>
          </div>
        ) : (
          <div style={{width:"100%",height:"100%",
            background:props.frutta?"#6BA6C988":props.lattic?"#6BA6C988":carbo?"#8A5A1288":"#F1F4F6"}}/>
        )}
      </div>
      {isPrinc && (
        <div style={{display:"flex",flexDirection:"column",gap:3}}>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:c?"#8A5A12":"#ddd"}}/>
            <span style={{fontSize:8,color:c?"#8A5A12":"#bbb"}}>{c?"Carbo":"manca C"}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:v?"#6BA6C9":"#ddd"}}/>
            <span style={{fontSize:8,color:v?"#6BA6C9":"#bbb"}}>{v?"Verdura":"manca V"}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:p?"#6BA6C9":"#ddd"}}/>
            <span style={{fontSize:8,color:p?"#6BA6C9":"#bbb"}}>{p?"Prot.":"manca P"}</span>
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
    {id:"cereali",label:"Cereali",target:14,color:"#8A5A12"},
    {id:"verdura",label:"Verdura",target:35,color:"#6BA6C9"},
    {id:"frutta",label:"Frutta",target:21,color:"#6BA6C9"},
    {id:"legumi",label:"Legumi",target:3,color:"#2F6586"},
    {id:"pesce",label:"Pesce",target:3,color:"#6BA6C9"},
    {id:"carne",label:"Carne bianca",target:3,color:"#8A5A12"},
    {id:"carne_rossa",label:"Carne rossa",target:1,color:"#C2355A"},
    {id:"uova",label:"Uova",target:2,color:"#8A5A12"},
    {id:"latticini",label:"Latticini",target:14,color:"#6BA6C9"},
  ];
  return (
    <div style={{background:"#fff",borderRadius:12,padding:"8px",
      boxShadow:"0 1px 6px rgba(0,0,0,.07)"}}>
      <div style={{fontSize:9,fontWeight:700,color:"#2F6586",marginBottom:6}}>Piramide</div>
      {rows.map(function(r){
        var val=conteggi[r.id]||0;
        var pct=Math.min(100,Math.round(val/r.target*100));
        return (
          <div key={r.id} style={{marginBottom:4}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:8,marginBottom:1}}>
              <span style={{color:"#666"}}>{r.label}</span>
              <span style={{fontWeight:700,color:r.color}}>{val}/{r.target}</span>
            </div>
            <div style={{background:"#F1F4F6",borderRadius:4,height:3}}>
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
    <div style={{marginBottom:10}}>
      <div style={{fontSize:11,fontWeight:600,marginBottom:5,letterSpacing:"0.02em",
        color:props.warn?"#C2355A":props.color||"#8A949B"}}>{props.label}</div>
      <select value={props.value||""} onChange={function(e){props.onChange(e.target.value||null);}}
        style={{width:"100%",padding:"11px 12px",borderRadius:13,
          border:"1.5px solid "+(props.value?props.color:props.warn?"#C2355A":"#E3EAEE"),
          background:props.value?props.color+"12":"#fff",
          color:props.value?"#2C3338":"#8A949B",fontSize:14,fontWeight:props.value?600:400,
          cursor:"pointer",outline:"none",fontFamily:"'Nunito',system-ui,sans-serif"}}>
        <option value="">Scegli...</option>
        {props.opts.map(function(o){
          return (
            <option key={o.id} value={o.disabled?"":o.id} disabled={!!o.disabled}>
              {o.emoji?o.emoji+" ":""}{o.nome}
            </option>
          );
        })}
      </select>
      {sel&&!sel.disabled&&(
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 4px 0"}}>
          <span style={{fontSize:12,color:props.color,fontWeight:700}}>{sel.emoji} {sel.nome}</span>
          <i className="ti ti-x" onClick={function(){props.onChange(null);}}
            style={{color:"#B4BEC4",fontSize:15,cursor:"pointer"}}/>
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
    <div style={{marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:600,marginBottom:6,letterSpacing:"0.02em",color:props.warn?"#C2355A":props.color||"#8A949B"}}>
        {props.label}
        {selItem&&<span style={{marginLeft:6,fontWeight:800,fontSize:12,color:props.color}}>{selItem.emoji} {selItem.nome}</span>}
        {selItem&&<i className="ti ti-x" onClick={function(){props.onChange(null);}} style={{marginLeft:6,color:"#B4BEC4",fontSize:14,cursor:"pointer",verticalAlign:"-2px"}}/>}
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:openCat?7:0}}>
        {Object.keys(cats).map(function(cat){
          var nome=cats[cat];
          if(!db.some(function(x){return x.cat===cat;})) return null;
          var isSel=openCat===cat;
          var hasVal=selItem&&selItem.cat===cat;
          return (
            <button key={cat} onClick={function(){setOpenCat(isSel&&!hasVal?null:cat);}}
              style={{padding:"7px 13px",borderRadius:20,fontSize:12,cursor:"pointer",
                border:"1.5px solid "+(hasVal?"#2F6586":isSel?props.color:props.warn?"#C2355A":"#E3EAEE"),
                background:hasVal?"#2F6586":isSel?props.color+"15":"#fff",
                color:hasVal?"#fff":isSel?props.color:"#555",
                fontWeight:hasVal||isSel?700:500,fontFamily:"'Nunito',system-ui,sans-serif"}}>
              {nome}
            </button>
          );
        })}
      </div>
      {openCat&&itemsForCat.length>0&&(
        <div style={{background:"#F2F6F8",borderRadius:13,padding:"9px",border:"1px solid #E3EAEE"}}>
          <select value={selItem&&selItem.cat===openCat?value:""} onChange={function(e){props.onChange(e.target.value||null);}}
            style={{width:"100%",padding:"10px 12px",borderRadius:11,
              border:"1.5px solid "+(value&&selItem&&selItem.cat===openCat?props.color:"#E3EAEE"),
              fontSize:14,cursor:"pointer",outline:"none",background:"#fff",fontFamily:"'Nunito',system-ui,sans-serif"}}>
            <option value="">-- scegli --</option>
            {itemsForCat.map(function(o){
              return (
                <option key={o.id} value={o.id}>
                  {o.emoji?o.emoji+" ":""}{o.nome}
                </option>
              );
            })}
          </select>
        </div>
      )}
    </div>
  );
}

function mealFrazione(pasto) {
  var tipo = PASTI_TIPO[pasto] || "pranzo";
  if(tipo === "colazione") return 0.20;
  if(tipo === "pranzo") return 0.35;
  if(tipo === "cena") return 0.30;
  return 0.12;
}
function coloreSemaforo(stato) {
  if(stato === "rosso") return "#C2355A";
  if(stato === "giallo") return "#8A5A12";
  return "#2F6586";
}
function NutriPanel(props) {
  var sExp = useState(false); var exp = sExp[0]; var setExp = sExp[1];
  var allDB = CARBOIDRATI.concat(PROTEINE).concat(VERDURE).concat(FRUTTA).concat(ALIMENTI_CUSTOM);
  var PORZ = {pasta:80,riso:80,cereali:70,tuberi:180,pane:60,colazione:50,
    "carne bianca":150,"carne rossa":150,pesce:150,uova:120,legumi:200,latticini:100,
    verdura:150,frutta:120};

  var grammi = props.grammi || {};
  var onGrammi = props.onGrammi || function(){};
  var items = [];
  function addItem(id, tipo, field) {
    if(!id) return;
    var it = allDB.find(function(x){return x.id===id;});
    if(!it||!it.kcal_p) return;
    var gCustom = parseInt(grammi[field], 10);
    var g = (!isNaN(gCustom) && gCustom > 0) ? gCustom : (PORZ[it.cat||tipo] || 100);
    items.push({nome:it.nome, emoji:it.emoji, g:g, field:field,
      kcal:Math.round(it.kcal_p*g/100), prot:Math.round((it.prot_p||0)*g/100),
      carb:Math.round((it.carb_p||0)*g/100), phe:Math.round((it.phe_p||0)*g/100),
      gsat:Math.round((it.gsat_p||0)*g/100*10)/10, na:Math.round((it.na_p||0)*g/100), ing:it});
  }
  addItem(props.carbo,"carbo","carbo");
  addItem(props.prot,"proteina","proteina");
  addItem(props.verd,"verdura","verdura");
  addItem(props.verd2,"verdura","verdura2");
  addItem(props.frutta,"frutta","frutta");
  addItem(props.lattic,"latticino","latticino");

  if(!items.length) return null;

  var totKcal = items.reduce(function(s,x){return s+x.kcal;},0);
  var totProt = items.reduce(function(s,x){return s+x.prot;},0);
  var totCarb = items.reduce(function(s,x){return s+x.carb;},0);
  var totPhe = items.reduce(function(s,x){return s+x.phe;},0);
  var totGsat = Math.round(items.reduce(function(s,x){return s+x.gsat;},0)*10)/10;
  var totNa = items.reduce(function(s,x){return s+x.na;},0);

  var frac = mealFrazione(props.pasto);
  var profMap = props.profili || {};
  var pids = Object.keys(profMap);
  var avvisi = [];

  var righe = pids.map(function(pid) {
    var p = profMap[pid];
    var fin = getParametriFinali(p);
    var mult = fin.kcal / 2000;
    var personKcal = Math.round(totKcal * mult);
    var personProt = Math.round(totProt * mult);
    var personCarb = Math.round(totCarb * mult);
    var personPhe = Math.round(totPhe * mult);
    var personGsat = Math.round(totGsat * mult * 10)/10;
    var personNa = Math.round(totNa * mult);
    var targetKcal = Math.max(1, Math.round(fin.kcal * frac));
    var kcalPct = personKcal / targetKcal;
    var stato = "verde";
    if(kcalPct >= 1.0) stato = "rosso";
    else if(kcalPct >= 0.8) stato = "giallo";
    var protInfo = null;
    if(fin.prot_max !== null) {
      var targetProt = Math.max(1, Math.round(fin.prot_max * frac));
      protInfo = {val:personProt, target:targetProt};
      if(personProt > targetProt) {
        stato = "rosso";
        avvisi.push("Proteine pasto (" + personProt + "g) oltre la quota per " + p.nome + " (max ~" + targetProt + "g/pasto)");
      }
    }
    if(fin.carb_max !== null) {
      var targetCarb = Math.max(1, Math.round(fin.carb_max * frac));
      if(personCarb > targetCarb) {
        stato = "rosso";
        avvisi.push("Carboidrati pasto (~" + personCarb + "g) oltre il limite per " + p.nome + " (max ~" + targetCarb + "g/pasto)");
      }
    }
    if(fin.phe_max !== null) {
      var targetPhe = Math.max(1, Math.round(fin.phe_max * frac));
      if(personPhe > targetPhe) {
        stato = "rosso";
        avvisi.push("Fenilalanina pasto (~" + personPhe + "mg) oltre il limite PKU per " + p.nome + " (max ~" + targetPhe + "mg/pasto)");
      }
    }
    if(fin.grassi_sat_max !== null) {
      var targetGsat = Math.max(1, Math.round(fin.grassi_sat_max * frac * 10)/10);
      if(personGsat > targetGsat) {
        if(stato !== "rosso") stato = "giallo";
        avvisi.push("Grassi saturi pasto (~" + personGsat + "g) oltre il consigliato per " + p.nome + " (max ~" + targetGsat + "g/pasto)");
      }
    }
    if(fin.sodio_max !== null) {
      var targetNa = Math.max(1, Math.round(fin.sodio_max * frac));
      if(personNa > targetNa) {
        if(stato !== "rosso") stato = "giallo";
        avvisi.push("Sodio pasto (~" + personNa + "mg) oltre il limite per " + p.nome + " (max ~" + targetNa + "mg/pasto)");
      }
    }
    var allerg = false;
    items.forEach(function(it) {
      var v = ingredienteVietato(it.ing, fin.vietati);
      if(v) { allerg = true; avvisi.push(it.nome + " non compatibile con " + p.nome + " (" + v + ")"); }
    });
    if(allerg) stato = "rosso";
    return {pid:pid, nome:p.nome, kcal:personKcal, prot:personProt, protInfo:protInfo, stato:stato, allerg:allerg};
  });

  return (
    <div style={{background:"#F5F8FC",borderRadius:10,padding:"10px 12px",marginBottom:8,border:"1.5px solid #E3EAEE"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div>
          <div style={{fontSize:10,fontWeight:800,color:"#2F6586"}}>Valori stimati pasto</div>
          <div style={{fontSize:9,color:"#8A949B"}}>Stima su porzioni standard · il pallino mostra se è ok per ogni membro</div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <span style={{fontSize:12,fontWeight:800,color:"#2F6586"}}>{totKcal} <span style={{fontSize:9,fontWeight:400}}>kcal</span></span>
          {totProt>0&&<span style={{fontSize:12,fontWeight:800,color:"#6BA6C9"}}>{totProt}<span style={{fontSize:9,fontWeight:400}}>g prot</span></span>}
        </div>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:2,marginBottom:8}}>
        {righe.map(function(r){
          return (
            <div key={r.pid} style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{width:9,height:9,borderRadius:"50%",background:coloreSemaforo(r.stato),flexShrink:0}}/>
              <span style={{minWidth:70,maxWidth:90,fontSize:10,color:"#333",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.nome}</span>
              <span style={{fontSize:10,fontWeight:700,color:"#2F6586"}}>{r.kcal} kcal</span>
              {r.protInfo&&<span style={{fontSize:9,color:r.protInfo.val>r.protInfo.target?"#C2355A":"#8A949B"}}>{r.prot}/{r.protInfo.target}g prot</span>}
              {r.allerg&&<span style={{fontSize:9,fontWeight:800,color:"#C2355A"}}>NON OK</span>}
            </div>
          );
        })}
      </div>

      {avvisi.length>0&&(
        <div style={{background:"#FBE7EC",border:"1px solid #FBE7EC",borderRadius:12,padding:"10px 12px",marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:800,color:"#C2355A",marginBottom:5}}>Avvisi nutrizionali</div>
          {avvisi.map(function(a,i){
            return <div key={i} style={{fontSize:11,color:"#C2355A",lineHeight:1.5}}>- {a}</div>;
          })}
        </div>
      )}

      <div style={{marginBottom:8}}>
        <div onClick={function(){ setExp(!exp); }}
          style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:11,fontWeight:700,color:"#2F6586",padding:"2px 0"}}>
          <i className={"ti "+(exp?"ti-chevron-up":"ti-chevron-down")} style={{fontSize:15}}/>
          {exp ? "Nascondi le porzioni" : "Regola le porzioni (grammi)"}
        </div>
        {exp&&items.map(function(it){
          var gv = grammi[it.field];
          return (
            <div key={it.field} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderTop:"1px solid #EAF0F4"}}>
              <span style={{fontSize:16}}>{it.emoji}</span>
              <span style={{flex:1,minWidth:0,fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.nome}</span>
              <input inputMode="numeric" value={gv !== undefined ? gv : String(it.g)}
                onChange={function(e){ onGrammi(it.field, e.target.value.replace(/[^0-9]/g,"")); }}
                style={{width:46,padding:"5px 6px",borderRadius:8,border:"1.5px solid #E3EAEE",fontSize:12,textAlign:"right",outline:"none",fontFamily:"'Nunito',system-ui,sans-serif"}}/>
              <span style={{fontSize:11,color:"#8A949B"}}>g</span>
              <span style={{fontSize:11,fontWeight:700,color:"#2F6586",minWidth:50,textAlign:"right"}}>{it.kcal} kcal</span>
              {it.prot>0&&<span style={{fontSize:11,color:"#6BA6C9",minWidth:30,textAlign:"right"}}>{it.prot}g</span>}
            </div>
          );
        })}
      </div>

      <div style={{fontSize:10,color:"#8A949B"}}>
        Semaforo: verde entro i parametri · giallo 80-100% del limite · rosso superato
      </div>
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
  var sG=useState((scelta&&scelta.grammi)||{}); var grammi=sG[0]; var setGrammi=sG[1];
  var s9=useState(null); var addingCat=s9[0]; var setAddingCat=s9[1];
  var s10=useState(""); var newIngNome=s10[0]; var setNewIngNome=s10[1];
  var sAI=useState(""); var aiSugg=sAI[0]; var setAiSugg=sAI[1];
  var sAIL=useState(false); var aiLoad=sAIL[0]; var setAiLoad=sAIL[1];
  var step=stepEst||1;
  var setStep=setStepEst||(function(){});

  function setGrammiField(field, val) {
    var g = Object.assign({}, grammi);
    if(val === "" || val === null || val === undefined) delete g[field]; else g[field] = val;
    setGrammi(g);
  }

  function nomeIng(id) {
    var all = CARBOIDRATI.concat(PROTEINE).concat(VERDURE).concat(FRUTTA).concat(ALIMENTI_CUSTOM);
    var f = all.find(function(x){ return x.id === id; });
    return f ? f.nome : "";
  }
  function suggerisciAI() {
    setAiLoad(true); setAiSugg("");
    var scelti = [carbo,prot,verd,verd2,frutta,lattic].filter(Boolean).map(nomeIng).join(", ");
    aiSuggerisciIngredienti(props.profili || {}, scelti).then(function(t){ setAiSugg(t); setAiLoad(false); },
      function(e){ setAiSugg("Errore AI: " + (e.message || "")); setAiLoad(false); });
  }

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
    onSalva({carbo:carbo,proteina:prot,verdura:verd,verdura2:verd2,frutta:frutta,latticino:lattic,salsa:salsa,prep:prep,nota:nota,grammi:grammi});
  }

  return (
    <div style={{flex:1}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:15,fontWeight:800,color:"#2C3338"}}>{giorno} · {pasto}</div>
        {isPrinc&&(
          <div style={{display:"flex",gap:5}}>
            <div style={{width:24,height:24,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:carbo?"#8A5A12":"#EEF2F5"}}>
              <span style={{fontSize:11,fontWeight:800,color:carbo?"#fff":"#B4BEC4"}}>C</span>
            </div>
            <div style={{width:24,height:24,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:prot?"#6BA6C9":"#EEF2F5"}}>
              <span style={{fontSize:11,fontWeight:800,color:prot?"#fff":"#B4BEC4"}}>P</span>
            </div>
            <div style={{width:24,height:24,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:verd?"#6BA6C9":"#EEF2F5"}}>
              <span style={{fontSize:11,fontWeight:800,color:verd?"#fff":"#B4BEC4"}}>V</span>
            </div>
            {completo&&<div style={{width:24,height:24,borderRadius:"50%",background:"#2F6586",display:"flex",alignItems:"center",justifyContent:"center"}}><i className="ti ti-check" style={{fontSize:13,color:"#fff"}}/></div>}
          </div>
        )}
      </div>

      {step===1&&(
        <div>
          {(isCol||isSpu)&&(
            <div>
              <Drop label="Frutta" value={frutta} onChange={setFruttaN} color="#6BA6C9" opts={fruOpts}/>
              <Drop label="Latticini" value={lattic} onChange={setLatticN} color="#6BA6C9" opts={PROTEINE.filter(function(p){return p.cat==="latticini";}).map(function(p){return p;})}/>
              <Drop label="Cereali e pane" value={carbo} onChange={setCarboN} color="#8A5A12"
                opts={CARBO_ALL.filter(function(c){return c.cat==="colazione"||c.cat==="pane";})}/>
            </div>
          )}

          {isPrinc&&(
            <div>
              {!carbo&&!prot&&(
                <div style={{marginBottom:12}}>
                  <div style={{background:"#EBF3FA",borderRadius:12,padding:"10px 12px",marginBottom:10,fontSize:12,color:"#2F6586",fontWeight:600,lineHeight:1.4}}>
                    <i className="ti ti-hand-finger" style={{fontSize:14,marginRight:5,verticalAlign:"-2px"}}/>
                    Inizia scegliendo un <b>carboidrato</b> (es. pasta) e una <b>proteina</b> (es. pollo). Oppure tocca un'idea veloce:
                  </div>
                  <div style={{fontSize:9,fontWeight:700,color:"#8A949B",marginBottom:6}}>Suggerimenti rapidi</div>
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
                          border:"1.5px solid #E3EAEE",background:"#EBF3FA",color:"#2F6586",fontWeight:600}}>
                          {sug.nome}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <TwoLevelDrop label="Carboidrati" value={carbo} onChange={setCarboN} cats={CARBO_CATS} db={CARBO_ALL} color="#8A5A12" warn={!carbo}/>

              <TwoLevelDrop label="Proteine" value={prot} onChange={setProtN} cats={PROT_CATS} db={PROT_ALL} color="#6BA6C9" warn={!prot}/>

              <div style={{marginBottom:10}}>
                <div style={{fontSize:9,fontWeight:700,marginBottom:5,color:!verd?"#C2355A":"#6BA6C9"}}>
                  Verdura
                  {verd&&<span style={{marginLeft:6,fontSize:10}}>{selVerd&&(selVerd.emoji+"?"+selVerd.nome)}<button onClick={function(){setVerdN(null);}} style={{marginLeft:4,background:"none",border:"none",color:"#8A949B",fontSize:11,cursor:"pointer"}}>x</button></span>}
                </div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:4}}>
                  {stagVerd.slice(0,12).map(function(v){
                    return (
                      <button key={v.id} onClick={function(){setVerdN(verd===v.id?null:v.id);}}
                        style={{padding:"5px 9px",borderRadius:20,fontSize:9,cursor:"pointer",
                          border:"1.5px solid "+(verd===v.id?"#6BA6C9":"#ddd"),
                          background:verd===v.id?"#6BA6C9":"#fff",
                          color:verd===v.id?"#fff":"#444",fontWeight:verd===v.id?700:400}}>
                        {v.emoji} {v.nome}
                      </button>
                    );
                  })}
                </div>
              </div>

              {verd&&(
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:9,fontWeight:700,color:"#2F6586",marginBottom:4}}>
                    2a verdura (opz.) {verd2&&<button onClick={function(){setVerd2N(null);}} style={{marginLeft:4,background:"none",border:"none",color:"#8A949B",fontSize:11,cursor:"pointer"}}>x</button>}
                  </div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    {stagVerd.filter(function(v){return v.id!==verd;}).slice(0,8).map(function(v){
                      return (
                        <button key={v.id} onClick={function(){setVerd2N(verd2===v.id?null:v.id);}}
                          style={{padding:"4px 8px",borderRadius:20,fontSize:9,cursor:"pointer",
                            border:"1.5px solid "+(verd2===v.id?"#2F6586":"#ddd"),
                            background:verd2===v.id?"#2F6586":"#fff",
                            color:verd2===v.id?"#fff":"#555"}}>
                          {v.emoji} {v.nome}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <Drop label="Salsa (opz.)" value={salsa} onChange={setSalsa} color="#6BA6C9" opts={salsaOpts}/>
            </div>
          )}

          {haQualcosa&&(
            <NutriPanel carbo={carbo} prot={prot} verd={verd} verd2={verd2} frutta={frutta} lattic={lattic} pasto={pasto} profili={props.profili}
              grammi={grammi} onGrammi={setGrammiField}/>
          )}

          {haQualcosa&&!completo&&aiAttiva()&&(
            <div style={{marginBottom:8}}>
              <button onClick={suggerisciAI} disabled={aiLoad}
                style={{width:"100%",padding:"9px",borderRadius:10,border:"1.5px solid #2F6586",
                  background:"#EBF3FA",color:"#2F6586",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                {aiLoad ? "AI sta pensando..." : "Suggerisci con AI"}
              </button>
              {aiSugg&&(
                <div style={{whiteSpace:"pre-wrap",fontSize:11,color:"#333",lineHeight:1.6,
                  marginTop:8,background:"#F5F8FC",borderRadius:8,padding:10,border:"1px solid #E3EAEE"}}>{aiSugg}</div>
              )}
            </div>
          )}

          <button onClick={function(){setStep(2);}} disabled={!haQualcosa}
            style={{width:"100%",padding:"13px",borderRadius:14,border:"none",marginTop:4,
              background:completo?"#2F6586":haQualcosa?"#6BA6C9":"#E3EAEE",
              color:"#fff",fontSize:14,fontWeight:700,cursor:haQualcosa?"pointer":"default"}}>
            {completo?"Avanti: come li cucini?":haQualcosa?"Avanti (manca: "+mancanti.join(", ")+")":"Seleziona alimento"}
          </button>
        </div>
      )}

      {step===2&&(
        <div>
          <div style={{background:"linear-gradient(135deg,#C2355A,#C2355A)",borderRadius:12,padding:"10px 14px",marginBottom:12,color:"#fff"}}>
            <div style={{fontSize:9,opacity:0.7,marginBottom:2}}>Passo 2 di 2</div>
            <div style={{fontSize:13,fontWeight:800}}>{[selCarbo&&selCarbo.nome,prot&&(PROTEINE.find(function(p){return p.id===prot;})||{}).nome].filter(Boolean).join(" + ")||"Come li cucini?"}</div>
          </div>

          {[{id:carbo,tipo:"carbo"},{id:prot,tipo:"proteina"},{id:verd,tipo:"verdura"},{id:frutta,tipo:"frutta"},{id:lattic,tipo:"latticino"}].filter(function(x){return x.id;}).map(function(x){
            var allIt=CARBOIDRATI.concat(PROTEINE).concat(VERDURE).concat(FRUTTA).concat(ALIMENTI_CUSTOM);
            var ing=allIt.find(function(a){return a.id===x.id;});
            if(!ing) return null;
            var pl=getPrep(x.id,x.tipo);
            if(!pl||!pl.length) return null;
            var selPrep=prep[x.id];
            return (
              <div key={x.id} style={{background:"#fff",borderRadius:12,padding:"10px 12px",marginBottom:8,boxShadow:"0 1px 6px rgba(0,0,0,.07)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <span style={{fontSize:11,fontWeight:800}}>{ing.emoji} {ing.nome}</span>
                  {selPrep&&<span style={{fontSize:9,background:"#EBF3FA",color:"#2F6586",fontWeight:700,padding:"2px 8px",borderRadius:20}}>{(pl.find(function(p){return p.id===selPrep;})||{}).nome}</span>}
                </div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {pl.map(function(p){
                    return (
                      <button key={p.id} onClick={function(){
                        var n=Object.assign({},prep);
                        n[x.id]=prep[x.id]===p.id?null:p.id;
                        setPrep(n);
                      }} style={{padding:"7px 12px",borderRadius:20,fontSize:12,cursor:"pointer",
                        border:"1.5px solid "+(selPrep===p.id?"#2F6586":"#E3EAEE"),
                        background:selPrep===p.id?"#2F6586":"#fff",fontFamily:"'Nunito',system-ui,sans-serif",
                        color:selPrep===p.id?"#fff":"#444",fontWeight:selPrep===p.id?700:500}}>
                        {p.emoji} {p.nome}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div style={{marginBottom:12}}>
            <div className="cap" style={{marginBottom:6}}>Note</div>
            <textarea value={nota} onChange={function(e){setNota(e.target.value);}}
              placeholder="Es. marinato al limone..." rows={2}
              style={{width:"100%",padding:"11px 12px",borderRadius:13,border:"1.5px solid #E3EAEE",
                fontSize:14,resize:"none",fontFamily:"'Nunito',system-ui,sans-serif",boxSizing:"border-box",outline:"none"}}></textarea>
          </div>

          <div style={{display:"flex",gap:8}}>
            <button onClick={function(){setStep(1);}}
              style={{flex:1,padding:"13px",borderRadius:14,border:"1.5px solid #E3EAEE",background:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",color:"#555"}}>
              Indietro
            </button>
            <button onClick={doSalva}
              style={{flex:2,padding:"13px",borderRadius:14,border:"none",background:"#2F6586",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"}}>
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
  var allIt=CARBOIDRATI.concat(PROTEINE).concat(VERDURE).concat(FRUTTA).concat(ALIMENTI_CUSTOM);
  var pasti5=["Colazione","Spuntino","Pranzo","Merenda","Cena"];
  var rows=[];

  GIORNI.forEach(function(g,gi){
    var isSel=gi===giornoSel;
    rows.push(
      <div key={"g"+gi} onClick={function(){cambiaGiorno(gi);}}
        style={{fontSize:10,fontWeight:isSel?800:500,color:isSel?"#2F6586":"#666",
          cursor:"pointer",background:isSel?"#EBF3FA":"transparent",
          borderRadius:6,padding:"2px 3px",display:"flex",alignItems:"center"}}>
        {g.slice(0,3)}
      </div>
    );
    pasti5.forEach(function(pasto){
      var s=scelte[g+"-"+pasto];
      if(!s){
        rows.push(<div key={g+pasto} onClick={function(){cambiaGiorno(gi);cambiaPasto(pasto);}} style={{background:"#F2F6F8",borderRadius:6,minHeight:26,cursor:"pointer",border:"1px dashed #eee"}}/>);
        return;
      }
      var protItem=allIt.find(function(x){return x.id===s.proteina;});
      var carboItem=allIt.find(function(x){return x.id===s.carbo;});
      var fruttaItem=allIt.find(function(x){return x.id===s.frutta;});
      var cat=protItem?protItem.cat:"";
      var bgMap={"pesce":"#EBF3FA","carne rossa":"#FBE7EC","uova":"#F6ECD9","legumi":"#F2F6F8","affettati":"#FBE7EC","carne bianca":"#E2EEF5"};
      var txMap={"pesce":"#2F6586","carne rossa":"#C2355A","uova":"#8A5A12","legumi":"#2F6586","affettati":"#C2355A"};
      var bg=bgMap[cat]||(s.frutta?"#F6ECD9":"#F2F6F8");
      var tx=txMap[cat]||"#555";
      rows.push(
        <div key={g+pasto} onClick={function(){setPopup({giorno:g,pasto:pasto,s:s,gi:gi});}}
          style={{background:bg,borderRadius:6,padding:"3px 3px",cursor:"pointer",position:"relative",minHeight:26,
            border:isSel&&pastoSel===pasto?"2px solid #2C3338":"1.5px solid transparent"}}>
          {protItem&&<div style={{fontSize:8,fontWeight:700,color:tx,lineHeight:1.2}}>{protItem.emoji} {protItem.nome.slice(0,10)}</div>}
          {carboItem&&<div style={{fontSize:7,color:"#8A949B",lineHeight:1.1}}>{carboItem.emoji} {carboItem.nome.slice(0,9)}</div>}
          {!protItem&&fruttaItem&&<div style={{fontSize:8,color:"#6BA6C9"}}>{fruttaItem.emoji} {fruttaItem.nome.slice(0,10)}</div>}
        </div>
      );
    });
  });

  return (
    <div style={{display:"grid",gridTemplateColumns:"44px repeat(5,1fr)",gap:3}}>
      <div/>
      <div style={{fontSize:8,color:"#8A949B",textAlign:"center"}}>Col</div>
      <div style={{fontSize:8,color:"#8A949B",textAlign:"center"}}>Spu</div>
      <div style={{fontSize:8,color:"#8A949B",textAlign:"center"}}>Pra</div>
      <div style={{fontSize:8,color:"#8A949B",textAlign:"center"}}>Mer</div>
      <div style={{fontSize:8,color:"#8A949B",textAlign:"center"}}>Cen</div>
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
  var allIt=CARBOIDRATI.concat(PROTEINE).concat(VERDURE).concat(FRUTTA).concat(SALSE).concat(ALIMENTI_CUSTOM);
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
        <div style={{background:"linear-gradient(135deg,#2C3338,#2F6586)",
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
                    <div style={{fontSize:9,color:"#8A949B",fontWeight:600}}>{x.label}</div>
                    <div style={{fontSize:12,fontWeight:700,color:"#2C3338"}}>{x.item.nome}</div>
                  </div>
                </div>
              );
            })}
          </div>
          {!showCopia?(
            <button onClick={function(){setShowCopia(true);}}
              style={{width:"100%",padding:"9px",borderRadius:12,marginBottom:8,
                border:"1.5px solid #E3EAEE",background:"#EBF3FA",color:"#2F6586",
                fontSize:11,fontWeight:700,cursor:"pointer"}}>
              Copia su altro giorno...
            </button>
          ):(
            <div style={{background:"#EBF3FA",borderRadius:12,padding:"12px",marginBottom:8}}>
              <div style={{fontSize:10,fontWeight:700,color:"#2F6586",marginBottom:8}}>Copia su:</div>
              {GIORNI.filter(function(g2){return g2!==giorno;}).map(function(g2){
                return (
                  <div key={g2} style={{marginBottom:5}}>
                    <div style={{fontSize:9,color:"#8A949B",marginBottom:3}}>{g2}</div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      {PASTI.map(function(p2){
                        return (
                          <button key={p2} onClick={function(){
                            var n=Object.assign({},scelte);
                            n[g2+"-"+p2]=Object.assign({},s);
                            setScelte(n);
                            setPopup(null);
                          }} style={{padding:"4px 10px",borderRadius:20,fontSize:9,cursor:"pointer",
                            border:"1.5px solid #E3EAEE",background:"#fff",color:"#2F6586"}}>
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
              style={{flex:1,padding:"11px",borderRadius:12,border:"none",background:"#2F6586",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>
              Modifica
            </button>
            <button onClick={function(){
              var n=Object.assign({},scelte);
              delete n[giorno+"-"+pasto];
              setScelte(n);
              setPopup(null);
            }} style={{padding:"11px 16px",borderRadius:12,border:"1.5px solid #FBE7EC",background:"#fff",color:"#C2355A",fontSize:12,cursor:"pointer"}}>
              Elimina
            </button>
          </div>
          {props.onSalvaRicetta&&(
            <button onClick={function(){
              var nome=window.prompt("Nome ricetta:")||pasto;
              if(nome) props.onSalvaRicetta({id:"r"+Date.now(),nome:nome,pasto:s,nota:s.nota,note_famiglia:{}});
              setPopup(null);
            }} style={{width:"100%",padding:"9px",borderRadius:12,marginTop:6,
              border:"1.5px solid #FBE7EC",background:"#FBE7EC",
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
  {id:"ortofrutta",  l:"Ortofrutta",      emoji:"?", color:"#6BA6C9"},
  {id:"carne_pesce", l:"Carne e Pesce",   emoji:"?", color:"#6BA6C9"},
  {id:"pasta_riso",  l:"Pasta e Riso",    emoji:"?", color:"#8A5A12"},
  {id:"pane_cereal", l:"Pane e Cereali",  emoji:"?", color:"#E8D5AE"},
  {id:"latticini",   l:"Latticini e Uova",emoji:"?", color:"#6BA6C9"},
  {id:"salse_cond",  l:"Salse e Condim.", emoji:"?", color:"#2F6586"},
  {id:"altro",       l:"Altro",           emoji:"?", color:"#8A949B"},
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
  var allDB=CARBOIDRATI.concat(PROTEINE).concat(VERDURE).concat(FRUTTA).concat(SALSE).concat(GRASSI).concat(ALIMENTI_CUSTOM);
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
              <span style={{fontSize:9,color:"#8A949B"}}>({items.length})</span>
            </div>
            {items.map(function(it){
              var chk=spesaCheck[it.id]||false;
              return (
                <div key={it.id} onClick={function(){var n=Object.assign({},spesaCheck);n[it.id]=!chk;setSpesaCheck(n);}}
                  style={{display:"flex",alignItems:"center",gap:8,padding:"7px 4px",
                    borderBottom:"1px solid #F2F6F8",cursor:"pointer",opacity:chk?0.4:1}}>
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


var SINONIMI_PASTO = {
  pollo:"pollo_f", petto:"pollo_f", cosce:"pollo_c", tacchino:"tacchino", fesa:"tacchino",
  manzo:"manzo", vitello:"manzo", bistecca:"manzo", hamburger:"manzo", agnello:"agnello",
  salmone:"salmone", merluzzo:"merluzzo", baccala:"merluzzo", nasello:"merluzzo", tonno:"tonno",
  orata:"orata", branzino:"orata", spigola:"orata", gamber:"gamberetti", pesce:"merluzzo",
  uova:"uova", uovo:"uova", frittata:"uova", omelette:"uova",
  ceci:"ceci", hummus:"ceci", lenticchie:"lenticchie", fagioli:"fagioli", legumi:"lenticchie",
  prosciutto:"prosciutto", bresaola:"bresaola", mortadella:"mortadella", salume:"prosciutto",
  mozzarella:"mozzarella", ricotta:"ricotta", feta:"feta", yogurt:"yogurt_g",
  patate:"patate", pure:"patate", pasta:"penne", spaghetti:"spaghetti", maccheroni:"penne",
  penne:"penne", fusilli:"fusilli", riso:"riso_b", risotto:"risotto", lasagne:"lasagne",
  lasagna:"lasagne", cannelloni:"lasagne", gnocchi:"gnocchi", ravioli:"ravioli", tortellini:"ravioli",
  pane:"pane_int", pizza:"pizza", focaccia:"focaccia", piadina:"piadina", farro:"farro",
  orzo:"orzo", quinoa:"quinoa", cous:"cous", polenta:"polenta", zuppa:"lenticchie",
  zucchine:"zucchine", spinaci:"spinaci", broccoli:"broccoli", pomodor:"pomodori", insalata:"insalata",
  carote:"carote", zucca:"zucca", funghi:"funghi", melanzane:"melanzane", parmigiana:"melanzane",
  peperoni:"peperoni", cavolfiore:"cavolfiore", asparagi:"asparagi", piselli:"piselli_v", verdura:"insalata"
};

function porzioneRic(it) {
  if(PROTEINE.some(function(x){ return x.id===it.id; })) {
    if(it.cat==="affettati") return 60;
    if(it.cat==="uova") return 120;
    if(it.cat==="latticini") return 100;
    if(it.cat==="legumi") return 150;
    return 150;
  }
  if(CARBOIDRATI.some(function(x){ return x.id===it.id; })) {
    if(it.cat==="tuberi") return 200;
    if(it.cat==="pane") return 60;
    return 80;
  }
  if(VERDURE.some(function(x){ return x.id===it.id; })) return 150;
  return 120;
}
function tipoRic(it) {
  if(PROTEINE.some(function(x){ return x.id===it.id; })) return "proteina";
  if(CARBOIDRATI.some(function(x){ return x.id===it.id; })) return "carbo";
  if(VERDURE.some(function(x){ return x.id===it.id; })) return "verdura";
  return "frutta";
}
var PIATTI_COMPOSTI = {
  parmigiana:["melanzane","mozzarella"], carbonara:["spaghetti","uova"], amatriciana:["spaghetti","pomodori"],
  bolognese:["tagliatelle","manzo"], caprese:["mozzarella","pomodori"], insalatona:["insalata","uova"],
  minestrone:["patate","carote","zucchine"], passato:["patate","carote","zucchine"], vellutata:["zucca"],
  spezzatino:["manzo","patate"], arrosto:["manzo","patate"], spiedini:["pollo_f"], polpette:["manzo"],
  hamburger:["manzo","pane_b"], cotoletta:["pollo_f"], milanese:["pollo_f"], paella:["riso_b","gamberetti","pollo_f"],
  poke:["riso_b","salmone"], caesar:["insalata","pollo_f"], frittata:["uova"], omelette:["uova"]
};
function riconosciPasto(testo) {
  var t = (""+(testo||"")).toLowerCase();
  if(!t.trim()) return {kcal:0, prot:0, items:[]};
  var db = CARBOIDRATI.concat(PROTEINE).concat(VERDURE).concat(FRUTTA).concat(ALIMENTI_CUSTOM);
  var byWord = {};
  var chosen = {};
  Object.keys(PIATTI_COMPOSTI).forEach(function(k){
    if(t.indexOf(k) >= 0) {
      PIATTI_COMPOSTI[k].forEach(function(id){
        var it = db.find(function(x){ return x.id === id; });
        if(it && !chosen[it.id]) { byWord["_c_"+id] = it; chosen[it.id] = true; }
      });
    }
  });
  Object.keys(SINONIMI_PASTO).forEach(function(k){
    if(t.indexOf(k) >= 0 && !byWord[k]) {
      var it = db.find(function(x){ return x.id === SINONIMI_PASTO[k]; });
      if(it && !chosen[it.id]) { byWord[k] = it; chosen[it.id] = true; }
    }
  });
  db.forEach(function(it){
    var parole = it.nome.toLowerCase().split(/[^a-zàèéìòùü]+/).filter(function(w){ return w.length > 3; });
    for(var i=0;i<parole.length;i++){
      if(t.indexOf(parole[i]) >= 0) {
        if(!byWord[parole[i]] && !chosen[it.id]) { byWord[parole[i]] = it; chosen[it.id] = true; }
        break;
      }
    }
  });
  var kcal = 0, prot = 0, items = [];
  Object.keys(byWord).forEach(function(w){
    var it = byWord[w];
    var g = porzioneRic(it);
    kcal += it.kcal_p * g / 100;
    prot += it.prot_p * g / 100;
    items.push({id:it.id, nome:it.nome, tipo:tipoRic(it)});
  });
  var ordine = {proteina:0, carbo:1, verdura:2, frutta:3};
  items.sort(function(a,b){ return ordine[a.tipo] - ordine[b.tipo]; });
  return {kcal:Math.round(kcal), prot:Math.round(prot), items:items};
}

function TabBuilder({menu, setMenuOverride, profili, builderScelte, setBuilderScelte, builderScelteProssima, setBuilderScelteProssima, mealPrep, dispensa, setMealPrep, alimentiCustom, setAlimentiCustom, onSavePasto}) {
  var GIORNI_B = ["Lunedi","Martedi","Mercoledi","Giovedi","Venerdi","Sabato","Domenica"];
  var PASTI_B  = ["Colazione","Spuntino","Pranzo","Merenda","Cena"];

  var scelte=builderScelte||{}; var setScelte=setBuilderScelte;
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
  var scelteProssima=builderScelteProssima||{}; var setScelteProssima=setBuilderScelteProssima;
  var s12=useState(null); var showRicette=s12[0]; var setShowRicette=s12[1];
  var s13=useState([]); var ricette=s13[0]; var setRicette=s13[1];
  var sVP=useState(false); var vediPiatto=sVP[0]; var setVediPiatto=sVP[1];
  var sVS=useState(false); var vediSett=sVS[0]; var setVediSett=sVS[1];
  var sVista=useState("settimana"); var vista=sVista[0]; var setVista=sVista[1];
  var sMsgB=useState(""); var msgB=sMsgB[0]; var setMsgB=sMsgB[1];
  var sOpzF=useState(false); var mostraOpzFam=sOpzF[0]; var setMostraOpzFam=sOpzF[1];

  function iconaGruppo(tipo, id) {
    var it = ingById(id);
    if(tipo==="proteina" || tipo==="latticino") {
      if(!it) return tipo==="latticino"?"ti-cheese":"ti-meat";
      if(it.cat==="pesce") return "ti-fish";
      if(it.cat==="legumi") return "ti-plant-2";
      if(it.cat==="uova") return "ti-egg";
      if(it.cat==="latticini") return "ti-cheese";
      return "ti-meat";
    }
    if(tipo==="carbo") return "ti-baguette";
    if(tipo==="frutta") return "ti-apple";
    if(tipo==="salsa") return "ti-droplet";
    return "ti-salad";
  }
  function nomeGruppo(id) { var it = ingById(id); return it ? it.nome : ""; }
  function apriGiorno(i) { cambiaGiorno(i); setStepCorrente(1); setVista("giorno"); }

  var sPicker=useState(null); var picker=sPicker[0]; var setPicker=sPicker[1];
  var sPickRic=useState(false); var pickRic=sPickRic[0]; var setPickRic=sPickRic[1];
  var sPickS=useState(""); var pickS=sPickS[0]; var setPickS=sPickS[1];
  var sFGlut=useState(false); var fGlut=sFGlut[0]; var setFGlut=sFGlut[1];
  var sFStag=useState(false); var fStag=sFStag[0]; var setFStag=sFStag[1];
  var scS=useState("componi"); var sheetTab=scS[0]; var setSheetTab=scS[1];
  var sNA=useState(null); var nuovoAl=sNA[0]; var setNuovoAl=sNA[1];
  var sDrag=useState(null); var drag=sDrag[0]; var setDrag=sDrag[1];
  var keyG = GIORNI_B[giornoSel]+"-"+pastoSel;
  function usoSettIng(id) {
    var n=0;
    GIORNI_B.forEach(function(g){ PASTI_B.forEach(function(pp){ var s=scelteAttive[g+"-"+pp]; if(s){ ["carbo","proteina","verdura","verdura2","frutta","latticino","salsa"].forEach(function(f){ if(s[f]===id) n++; }); } }); });
    return n;
  }
  function inStagione(it) { var st=getStagione(); return !it.stagione || it.stagione==="tutto" || it.stagione.indexOf(st)>=0; }
  function apriPicker(c) { setPicker(c); setPickS(""); }
  function campiPasto() {
    var t = PASTI_TIPO[pastoSel] || "pranzo";
    if(t==="colazione" || t==="spuntino") {
      return [
        {campo:"frutta",    label:"Frutta",         tipo:"frutta",    def:120, db:FRUTTA},
        {campo:"latticino", label:"Latticini",      tipo:"latticino", def:100, db:PROTEINE.filter(function(p){return p.cat==="latticini";})},
        {campo:"carbo",     label:"Cereali e pane", tipo:"carbo",     def:50,  db:CARBOIDRATI.filter(function(c){return c.cat==="colazione"||c.cat==="pane";})}
      ];
    }
    return [
      {campo:"proteina", label:"Proteina",           tipo:"proteina", def:150, db:PROTEINE},
      {campo:"carbo",    label:"Carboidrato",        tipo:"carbo",    def:80,  db:CARBOIDRATI.filter(function(c){return ["pasta","riso","cereali","tuberi"].indexOf(c.cat)>=0;})},
      {campo:"verdura",  label:"Verdura",            tipo:"verdura",  def:150, db:VERDURE},
      {campo:"salsa",    label:"Salsa · facoltativa",tipo:"salsa",    def:20,  db:SALSE, opt:true}
    ];
  }
  function salvaScelta(s) {
    setScelteAttive(function(prev){ var n = Object.assign({}, prev||{}); n[keyG]=s; return n; });
    if(onSavePasto) onSavePasto(settB, GIORNI_B[giornoSel], pastoSel, s);
  }
  function setCampoG(campo, id) {
    var s = Object.assign({}, scelteAttive[keyG]||{});
    if(id===null) delete s[campo]; else s[campo]=id;
    salvaScelta(s);
  }
  function completaAuto() {
    var prots = PROTEINE.filter(function(p){ return !ingredienteVietato(p, famVietati); });
    var carbs = CARBOIDRATI.filter(function(c){ return c.cat !== "colazione" && !ingredienteVietato(c, famVietati); });
    var verds = VERDURE.filter(function(v){ return inStagione(v) && !ingredienteVietato(v, famVietati); });
    if(!verds.length) verds = VERDURE.filter(function(v){ return !ingredienteVietato(v, famVietati); });
    if(!prots.length || !carbs.length || !verds.length) {
      setMsgB("Non trovo abbastanza alimenti compatibili con le restrizioni della famiglia.");
      setTimeout(function(){ setMsgB(""); }, 3500); return;
    }
    var next = Object.assign({}, scelteAttive);
    var cambiati = [];
    GIORNI_B.forEach(function(g, idx){
      var key = g + "-" + pastoSel;
      var s = next[key];
      var pieno = s && ((s.piattoUnico && s.piattoUnico.nome) || s.proteina || s.carbo);
      if(pieno) return;
      var p = prots[idx % prots.length];
      var c = carbs[idx % carbs.length];
      var v = verds[idx % verds.length];
      next[key] = Object.assign({}, s || {}, {proteina:p.id, carbo:c.id, verdura:v.id});
      cambiati.push(key);
    });
    if(!cambiati.length) {
      setMsgB("I giorni sono già tutti compilati. Cambia a mano quello che vuoi.");
      setTimeout(function(){ setMsgB(""); }, 3500); return;
    }
    setScelteAttive(function(prev){ var base = Object.assign({}, prev||{}); cambiati.forEach(function(key){ base[key] = next[key]; }); return base; });
    if(onSavePasto) cambiati.forEach(function(key){ var gp = key.split("-"); onSavePasto(settB, gp[0], gp[1], next[key]); });
    setMsgB("Fatto! Ho riempito " + cambiati.length + " giorni vuoti (equilibrati e di stagione). Ritocca quello che vuoi.");
    setTimeout(function(){ setMsgB(""); }, 4000);
  }
  function attivaCompleto() {
    var s = Object.assign({}, scelteAttive[keyG]||{});
    if(!s.piattoUnico) s.piattoUnico = {nome:"", kcal:"", prot:""};
    salvaScelta(s);
  }
  function disattivaCompleto() {
    var s = Object.assign({}, scelteAttive[keyG]||{});
    delete s.piattoUnico;
    salvaScelta(s);
  }
  function setPiattoUnicoField(field, val) {
    var s = Object.assign({}, scelteAttive[keyG]||{});
    var pu = Object.assign({nome:"",kcal:"",prot:""}, s.piattoUnico||{});
    pu[field] = val;
    s.piattoUnico = pu;
    salvaScelta(s);
  }
  function riconosciCompleto() {
    var s = Object.assign({}, scelteAttive[keyG]||{});
    var pu = Object.assign({nome:"",kcal:"",prot:""}, s.piattoUnico||{});
    var r = riconosciPasto(pu.nome);
    if(r.items.length){ pu.kcal = String(r.kcal); pu.prot = String(r.prot); pu.riconosciuti = r.items; pu.autofill = true; }
    else { pu.riconosciuti = []; }
    s.piattoUnico = pu;
    salvaScelta(s);
  }
  function altriPiatti(pu) { return pu && pu.altri ? pu.altri : []; }
  function dishIndexOf(pu, pid) {
    var a = altriPiatti(pu);
    for(var i=0;i<a.length;i++){ if((a[i].membri||[]).indexOf(pid) >= 0) return i; }
    return -1;
  }
  function dishBase(pu, pid) {
    var i = dishIndexOf(pu, pid);
    if(i >= 0) { var d = pu.altri[i]; return {nome:d.nome, kcal:parseInt(d.kcal,10)||0, prot:parseInt(d.prot,10)||0, ricon:d.riconosciuti||[]}; }
    return {nome:pu.nome, kcal:parseInt(pu.kcal,10)||0, prot:parseInt(pu.prot,10)||0, ricon:(pu.riconosciuti||[])};
  }
  function vietatiDelPiatto(ricon, fin) {
    var out = [];
    (ricon||[]).forEach(function(r){
      var ing = ingById(r.id);
      var v = ingredienteVietato(ing, (fin && fin.vietati) || []);
      if(v && out.indexOf(v) < 0) out.push(v);
    });
    return out;
  }
  function stimaFamiglia(pu) {
    var out = [];
    var fuoriList = (pu && pu.fuori) ? pu.fuori : [];
    Object.keys(profili||{}).forEach(function(pid){
      var p = profili[pid];
      if(!p) return;
      if(fuoriList.indexOf(pid) >= 0) {
        var fv = (pu && pu.fuoriVal && pu.fuoriVal[pid]) || {};
        var fk = parseInt(fv.kcal, 10) || 0; var fp = parseInt(fv.prot, 10) || 0;
        out.push({pid: pid, nome: p.nome, colore: p.colore || "#6BA6C9", fuori: true, kcal: fk, prot: fp, contato: (fk > 0 || fp > 0)});
        return;
      }
      var fin = getParametriFinali(p);
      var base = dishBase(pu, pid);
      var scale = (p.kcal_target || 1600) / 1600;
      var k = Math.round((base.kcal || 0) * scale);
      var pr = Math.round((base.prot || 0) * scale);
      var limite = (p.prot_max !== null && p.prot_max !== undefined && p.prot_max !== "") ? parseInt(p.prot_max, 10) : null;
      var over = limite !== null && !isNaN(limite) && pr > limite;
      var vietati = vietatiDelPiatto(base.ricon, fin);
      var motivi = [];
      vietati.forEach(function(v){ motivi.push(vietatoShort(v)); });
      if(over) motivi.push("proteine");
      out.push({pid: pid, nome: p.nome, colore: p.colore || "#6BA6C9", kcal: k, prot: pr, dish: base.nome, altro: dishIndexOf(pu, pid) >= 0, limite: (over ? limite : null), over: over, vietati: vietati, motivi: motivi, problema: (over || vietati.length > 0)});
    });
    return out;
  }
  function mutaPU(fn) {
    var s = Object.assign({}, scelteAttive[keyG]||{});
    var pu = Object.assign({nome:"",kcal:"",prot:""}, s.piattoUnico||{});
    pu.altri = (pu.altri||[]).slice();
    fn(pu);
    s.piattoUnico = pu;
    salvaScelta(s);
  }
  function addPiatto() { mutaPU(function(pu){ pu.altri.push({nome:"", kcal:"", prot:"", membri:[]}); }); }
  function removeAltro(i) { mutaPU(function(pu){ pu.altri.splice(i,1); }); }
  function setAltroField(i, field, val) { mutaPU(function(pu){ if(!pu.altri[i]) return; pu.altri[i] = Object.assign({}, pu.altri[i]); pu.altri[i][field] = val; }); }
  function riconosciAltro(i) {
    mutaPU(function(pu){
      if(!pu.altri[i]) return;
      var d = Object.assign({}, pu.altri[i]);
      var r = riconosciPasto(d.nome);
      if(r.items.length){ d.kcal = String(r.kcal); d.prot = String(r.prot); d.riconosciuti = r.items; d.autofill = true; }
      else { d.riconosciuti = []; }
      pu.altri[i] = d;
    });
  }
  function toggleAltroMembro(i, pid) {
    mutaPU(function(pu){
      pu.altri = pu.altri.map(function(d, j){
        var m = (d.membri||[]).slice();
        var idx = m.indexOf(pid);
        if(j === i) { if(idx >= 0) m.splice(idx,1); else m.push(pid); }
        else if(idx >= 0) m.splice(idx,1);
        return Object.assign({}, d, {membri:m});
      });
      var f = (pu.fuori||[]).slice(); var fi = f.indexOf(pid); if(fi >= 0) { f.splice(fi,1); pu.fuori = f; }
    });
  }
  function toggleFuoriMembro(pid) {
    mutaPU(function(pu){
      var f = (pu.fuori||[]).slice();
      var idx = f.indexOf(pid);
      if(idx >= 0) { f.splice(idx,1); }
      else {
        f.push(pid);
        pu.altri = pu.altri.map(function(d){ var m = (d.membri||[]).slice(); var mi = m.indexOf(pid); if(mi >= 0) m.splice(mi,1); return Object.assign({}, d, {membri:m}); });
      }
      pu.fuori = f;
    });
  }
  function setFuoriVal(pid, field, val) {
    mutaPU(function(pu){
      var fv = Object.assign({}, pu.fuoriVal||{});
      fv[pid] = Object.assign({kcal:"",prot:""}, fv[pid]||{});
      fv[pid][field] = val;
      pu.fuoriVal = fv;
    });
  }
  function varianteNome(pu, pid) {
    var p = profili[pid]; var fin = getParametriFinali(p);
    var base = dishBase(pu, pid);
    var scale = (p.kcal_target || 1600) / 1600;
    var pr = Math.round((base.prot || 0) * scale);
    var limite = (p.prot_max !== null && p.prot_max !== undefined && p.prot_max !== "") ? parseInt(p.prot_max, 10) : null;
    var overProt = limite !== null && !isNaN(limite) && pr > limite;
    var keep = (base.ricon || []).filter(function(r){
      if(ingredienteVietato(ingById(r.id), fin.vietati)) return false;
      if(overProt && r.tipo === "proteina") return false;
      return true;
    });
    return keep.length ? keep.map(function(r){ return r.nome; }).join(" e ") : "Porzione ridotta";
  }
  function creaVariante() {
    var pu0 = (scelteAttive[keyG]||{}).piattoUnico || {};
    var righe = stimaFamiglia(pu0);
    var gruppi = {};
    righe.forEach(function(r){
      if(r.fuori || r.altro || !r.problema) return;
      var nome = varianteNome(pu0, r.pid);
      if(!gruppi[nome]) gruppi[nome] = [];
      gruppi[nome].push(r.pid);
    });
    var nomi = Object.keys(gruppi);
    if(!nomi.length) return;
    mutaPU(function(pu){
      nomi.forEach(function(nome){
        var r = riconosciPasto(nome);
        pu.altri.push({nome:nome, kcal:String(r.kcal||0), prot:String(r.prot||0), riconosciuti:r.items||[], autofill:true, membri:gruppi[nome]});
      });
    });
  }
  function usaRicetta(ric) {
    var por = ric.porzioni && (ric.porzioni.adulto || ric.porzioni.adulta || {});
    var s = Object.assign({}, scelteAttive[keyG]||{});
    s.piattoUnico = {nome:ric.titolo, kcal:(por.kcal||""), prot:(por.prot||"")};
    salvaScelta(s);
    setPickRic(false);
  }
  function setGrammiG(campo, val) {
    var s = Object.assign({}, scelteAttive[keyG]||{});
    var g = Object.assign({}, s.grammi||{});
    if(val==="" || val<=0) delete g[campo]; else g[campo]=val;
    s.grammi = g;
    salvaScelta(s);
  }
  var famVietati = [];
  Object.keys(profili||{}).forEach(function(pid){ var fin=getParametriFinali(profili[pid]); (fin.vietati||[]).forEach(function(v){ if(famVietati.indexOf(v)<0) famVietati.push(v); }); });

  // Scelte attive in base alla settimana selezionata
  var scelteAttive = (settB===0 ? scelte : scelteProssima) || {};
  var setScelteAttive = settB===0 ? setScelte : setScelteProssima;
  var sceltaG = scelteAttive[keyG] || {};
  var puG = sceltaG.piattoUnico || {nome:"",kcal:"",prot:""};

  var key=GIORNI_B[giornoSel]+"-"+pastoSel;
  var sceltaCorrente=scelteAttive[key]||null;

  function pastoCompl(s){ return !!(s && s.piattoUnico && s.piattoUnico.nome && (""+s.piattoUnico.nome).trim()); }
  function hasSaved(g,p){var s=scelteAttive[g+"-"+p];return !!(s&&(pastoCompl(s)||s.carbo||s.proteina||s.frutta||s.latticino));}
  function isCompleto(g,p){var s=scelteAttive[g+"-"+p];if(!s)return false;if(pastoCompl(s))return true;var t=PASTI_TIPO[p]||"pranzo";if(t==="pranzo"||t==="cena")return !!(s.carbo&&s.proteina&&s.verdura);return !!(s.carbo||s.frutta||s.latticino);}
  function cambiaGiorno(i){setGiornoSel(i);setStepCorrente(1);setLiveScelta(scelteAttive[GIORNI_B[i]+"-"+pastoSel]||{});}
  function cambiaPasto(p){setPastoSel(p);setStepCorrente(1);setLiveScelta(scelteAttive[GIORNI_B[giornoSel]+"-"+p]||{});}

  function salva(dati) {
    setScelteAttive(function(prev){ var n=Object.assign({},prev||{}); n[key]=dati; return n; });
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

  var custProt = (alimentiCustom||[]).filter(function(x){return x.tipo==="proteina";});
  var custCarb = (alimentiCustom||[]).filter(function(x){return x.tipo==="carbo";});
  var custVerd = (alimentiCustom||[]).filter(function(x){return x.tipo==="verdura";});
  var GRUPPI_BOARD=[
    {campo:"proteina",label:"Proteina",tipo:"proteina",def:150,db:PROTEINE.concat(custProt)},
    {campo:"carbo",label:"Carboidrato",tipo:"carbo",def:80,db:CARBOIDRATI.filter(function(c){return ["pasta","riso","cereali","tuberi"].indexOf(c.cat)>=0;}).concat(custCarb)},
    {campo:"verdura",label:"Verdura",tipo:"verdura",def:150,db:VERDURE.concat(custVerd)}
  ];

  function creaAlimento() {
    if(!picker || !nuovoAl) return;
    var nome = (nuovoAl.nome||"").trim();
    if(!nome) return;
    var tipo = picker.tipo;
    var cat = tipo==="proteina" ? (nuovoAl.cat||"carne") : (tipo==="carbo" ? "cereali" : "tutto");
    var nuovo = {id:"custom_"+new Date().getTime(), nome:nome, tipo:tipo, cat:cat, custom:true, stagione:"tutto",
      kcal_p: (parseInt(nuovoAl.kcal,10)||0) || (tipo==="proteina"?150:(tipo==="carbo"?300:25)),
      prot_p: (parseInt(nuovoAl.prot,10)||0) || (tipo==="proteina"?20:(tipo==="carbo"?8:2)),
      carb_p:0, phe_p:0, gsat_p:0, na_p:0};
    if(setAlimentiCustom) setAlimentiCustom((alimentiCustom||[]).concat([nuovo]));
    setCampoG(picker.campo, nuovo.id);
    setNuovoAl(null);
    setPicker(null);
  }

  function pastoPieno(s) { return !!(s && ((s.piattoUnico && s.piattoUnico.nome && (""+s.piattoUnico.nome).trim()) || s.proteina || s.carbo || s.verdura)); }
  function spostaPasto(gSrc, gDst, m) {
    if(gSrc===gDst) return;
    var srcKey=gSrc+"-"+m, dstKey=gDst+"-"+m;
    var a = scelteAttive[srcKey]; var b = scelteAttive[dstKey];
    setScelteAttive(function(prev){
      var n=Object.assign({}, prev||{});
      if(a) n[dstKey]=a; else delete n[dstKey];
      if(b) n[srcKey]=b; else delete n[srcKey];
      return n;
    });
    if(onSavePasto){ onSavePasto(settB, gDst, m, a||{}); onSavePasto(settB, gSrc, m, b||{}); }
  }
  function detCol(x, y) {
    if(typeof document==="undefined") return null;
    var el = document.elementFromPoint(x, y);
    while(el){ if(el.getAttribute && el.getAttribute("data-detcol")!=null) return el.getAttribute("data-detcol"); el=el.parentElement; }
    return null;
  }
  function detDown(e, g, m) {
    if(!pastoPieno(scelteAttive[g+"-"+m])) return;
    setDrag({g:g, m:m, sx:e.clientX, sy:e.clientY, x:e.clientX, y:e.clientY, over:null, active:false});
    try{ e.currentTarget.setPointerCapture(e.pointerId); }catch(err){}
  }
  function detMove(e) {
    if(!drag) return;
    var dx=Math.abs(e.clientX-drag.sx), dy=Math.abs(e.clientY-drag.sy);
    var active = drag.active || dx>6 || dy>6;
    if(active && e.cancelable) e.preventDefault();
    var over = active ? detCol(e.clientX, e.clientY) : null;
    setDrag(Object.assign({}, drag, {x:e.clientX, y:e.clientY, over:over, active:active}));
  }
  function detUp() {
    if(!drag){ return; }
    if(drag.active && drag.over!=null){
      var gi = parseInt(drag.over,10);
      var gDst = GIORNI_B[gi];
      if(gDst && gDst!==drag.g){ spostaPasto(drag.g, gDst, drag.m); }
    }
    setDrag(null);
  }

  function scadenzaEntro(scad, giorni) {
    if(!scad) return false;
    var oggi = new Date(); oggi.setHours(0,0,0,0);
    var d = new Date(scad+"T00:00:00");
    if(isNaN(d.getTime())) return false;
    var diff = (d.getTime() - oggi.getTime()) / 86400000;
    return diff <= giorni;
  }
  var mealPrepScad = (mealPrep||[]).filter(function(p){ return p && p.porzioniRimaste>0 && scadenzaEntro(p.scadenza, 3); });
  var dispensaScad = (dispensa||[]).filter(function(d){ return d && scadenzaEntro(d.scadenza, 3); });

  return (
    <div style={{minHeight:"60vh"}}>
      <div style={{display:"flex",gap:6,marginBottom:10,alignItems:"center"}}>
        <button onClick={function(){setSettB(0);setStepCorrente(1);}}
          style={{flex:1,padding:"9px",borderRadius:12,border:"none",cursor:"pointer",
            background:settB===0?"#2F6586":"#fff",color:settB===0?"#fff":"#555",
            fontSize:12,fontWeight:settB===0?700:500,boxShadow:settB===0?"none":"0 1px 6px rgba(0,0,0,.07)"}}>
          Questa settimana
        </button>
        <button onClick={function(){setSettB(1);setStepCorrente(1);}}
          style={{flex:1,padding:"9px",borderRadius:12,border:"none",cursor:"pointer",
            background:settB===1?"#2F6586":"#fff",color:settB===1?"#fff":"#555",
            fontSize:12,fontWeight:settB===1?700:500,boxShadow:settB===1?"none":"0 1px 6px rgba(0,0,0,.07)"}}>
          Settimana prossima
        </button>
        <button onClick={function(){
          if(window.confirm("Copia il menu di questa settimana nella prossima?")) {
            var copia = Object.assign({}, scelte);
            setScelteProssima(copia);
            if(onSavePasto) Object.keys(copia).forEach(function(k){ var gp=k.split("-"); onSavePasto(1, gp[0], gp.slice(1).join("-"), copia[k]); });
          }
        }} title="Copia questa sett. nella prossima"
          style={{padding:"9px 11px",borderRadius:12,border:"none",
            background:"#EBF3FA",color:"#2F6586",fontSize:12,cursor:"pointer",fontWeight:700}}>
          Copia
        </button>
        <button onClick={function(){setShowRicette(true);}}
          title="Ricette salvate"
          style={{padding:"9px 11px",borderRadius:12,border:"none",
            background:"#FBE7EC",color:"#C2355A",fontSize:12,cursor:"pointer",fontWeight:700}}>
          Ricette
        </button>
      </div>

      {settB===1&&(
        <div style={{background:"#EBF3FA",borderRadius:8,padding:"6px 10px",marginBottom:8,fontSize:10,color:"#2F6586",fontWeight:600}}>
          Stai pianificando la settimana prossima
        </div>
      )}

      {(function(){
        var lunB = lunediSettimana(); if(settB===1) lunB.setDate(lunB.getDate()+7);
        var protCount = {pesce:0,carne:0,legumi:0,uova:0};
        GIORNI_B.forEach(function(g){ var s=scelteAttive[g+"-"+pastoSel]; if(s&&s.proteina){ var it=ingById(s.proteina); if(it){ if(it.cat==="pesce")protCount.pesce++; else if(it.cat==="legumi")protCount.legumi++; else if(it.cat==="uova")protCount.uova++; else protCount.carne++; } } });
        var completiSett = GIORNI_B.filter(function(g){ var s=scelteAttive[g+"-"+pastoSel]; return s&&s.proteina&&s.carbo&&s.verdura; }).length;
        var protParts = [];
        if(protCount.pesce) protParts.push("pesce ×"+protCount.pesce);
        if(protCount.legumi) protParts.push("legumi ×"+protCount.legumi);
        if(protCount.carne) protParts.push("carne ×"+protCount.carne);
        if(protCount.uova) protParts.push("uova ×"+protCount.uova);
        return (
        <div>
          <div style={{fontSize:20,fontWeight:800,color:"#2C3338",margin:"2px 0 8px"}}>Builder</div>

          {(mealPrepScad.length>0 || dispensaScad.length>0)?(
            <div style={{background:"#F6ECD9",border:"1px solid #E8D5AE",borderRadius:12,padding:"9px 12px",marginBottom:9,display:"flex",alignItems:"center",gap:9}}>
              <i className="ti ti-clock-exclamation" style={{fontSize:18,color:"#8A5A12",flexShrink:0}}/>
              <div style={{flex:1,minWidth:0,fontSize:11,color:"#8A5A12",fontWeight:700}}>
                Da usare presto: {mealPrepScad.map(function(p){return p.nome;}).concat(dispensaScad.map(function(d){return d.nome;})).slice(0,3).join(", ")}{(mealPrepScad.length+dispensaScad.length)>3?"…":""}
              </div>
            </div>
          ):null}

          <div style={{display:"grid",gridTemplateColumns:"16px repeat(7,1fr)",gap:5,alignItems:"stretch",marginBottom:8}}>
            {(function(){
              var items=[];
              items.push(<div key="corner"/>);
              GIORNI_B.forEach(function(g,i){
                var dataG=new Date(lunB.getTime()); dataG.setDate(lunB.getDate()+i);
                items.push(
                  <div key={"h-"+g} style={{textAlign:"center",padding:"2px 0"}}>
                    <div style={{fontSize:11,fontWeight:800,color:"#2C3338"}}>{g.slice(0,3)}</div>
                    <div style={{fontSize:9,fontWeight:700,color:"#8A949B"}}>{dataG.getDate()}</div>
                  </div>
                );
              });
              ["Pranzo","Cena"].forEach(function(m){
                items.push(
                  <div key={"lab-"+m} style={{writingMode:"vertical-rl",transform:"rotate(180deg)",fontSize:9,fontWeight:800,textTransform:"uppercase",color:"#8A949B",display:"flex",alignItems:"center",justifyContent:"center",letterSpacing:".05em"}}>{m}</div>
                );
                GIORNI_B.forEach(function(g,i){
                  var s=scelteAttive[GIORNI_B[i]+"-"+m]||{};
                  var compl=s.piattoUnico && s.piattoUnico.nome && (""+s.piattoUnico.nome).trim();
                  items.push(
                    <div key={m+"-"+g} style={{background:"#fff",border:"1px solid #E3EAEE",borderRadius:11,padding:"5px 4px",display:"flex",flexDirection:"column",gap:5,alignItems:"center",justifyContent:"flex-start"}}>
                      {compl ? (
                        <div onClick={function(){ cambiaGiorno(i); cambiaPasto(m); setSheetTab("completo"); apriPicker(GRUPPI_BOARD[0]); }}
                          style={{width:"100%",display:"flex",flexDirection:"column",alignItems:"center",gap:3,justifyContent:"center",cursor:"pointer"}}>
                          <div style={{width:"100%",maxWidth:34,aspectRatio:"1",borderRadius:9,background:"#E2EEF5",color:"#2F6586",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}><i className="ti ti-tools-kitchen-2"/></div>
                          <div style={{fontSize:8,fontWeight:800,color:"#2F6586",textAlign:"center",lineHeight:1.05,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",wordBreak:"break-word"}}>{s.piattoUnico.nome}</div>
                        </div>
                      ) : (
                        GRUPPI_BOARD.map(function(gr){
                          var id=s[gr.campo];
                          return (
                            <div key={gr.campo} onClick={function(){ cambiaGiorno(i); cambiaPasto(m); setSheetTab("componi"); apriPicker(gr); }}
                              style={{width:"100%",maxWidth:34,aspectRatio:"1",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
                                background:id?"#E2EEF5":"#fff",border:id?"none":"1.5px dashed #CADCE8",color:id?"#2F6586":"#B4BEC4",fontSize:id?16:13}}>
                              <i className={"ti "+(id?iconaGruppo(gr.tipo,id):"ti-plus")}/>
                            </div>
                          );
                        })
                      )}
                    </div>
                  );
                });
              });
              return items;
            })()}
          </div>

          <div style={{fontSize:10,color:"#8A949B",textAlign:"center",padding:"2px 4px 8px",fontWeight:600}}>Tocca un quadratino &rarr; scegli l'alimento o il piatto completo</div>

          {(function(){
            var pc={pesce:0,carne:0,legumi:0,uova:0};
            GIORNI_B.forEach(function(g){ ["Pranzo","Cena"].forEach(function(m){ var s=scelteAttive[g+"-"+m]; if(s&&s.proteina){ var it=ingById(s.proteina); if(it){ if(it.cat==="pesce")pc.pesce++; else if(it.cat==="legumi")pc.legumi++; else if(it.cat==="uova")pc.uova++; else pc.carne++; } } }); });
            var cells=[{n:pc.pesce,l:"Pesce"},{n:pc.carne,l:"Carne"},{n:pc.legumi,l:"Legumi"},{n:pc.uova,l:"Uova"}];
            return (
              <div style={{background:"#E2EEF5",borderRadius:12,padding:"9px 12px",marginBottom:10,color:"#2F6586",display:"flex",alignItems:"center"}}>
                <span style={{fontSize:10,fontWeight:800,textTransform:"uppercase",marginRight:"auto"}}>Equilibrio</span>
                {cells.map(function(c){
                  return <div key={c.l} style={{textAlign:"center",marginLeft:13,color:c.n===0?"#C2355A":"#2F6586"}}><b style={{fontSize:14}}>{c.n}</b><span style={{fontSize:8,display:"block"}}>{c.l}</span></div>;
                })}
              </div>
            );
          })()}

          <button onClick={function(){ completaAuto(); }}
            style={{width:"100%",border:"1.5px solid #6BA6C9",background:"#fff",color:"#2F6586",borderRadius:12,padding:11,
              fontFamily:"'Nunito',system-ui,sans-serif",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
            <i className="ti ti-wand" style={{fontSize:16}}/>Completa in automatico
          </button>
          {msgB&&<div style={{fontSize:12,color:"#2F6586",textAlign:"center",fontWeight:600,marginTop:8}}>{msgB}</div>}

          <div style={{marginTop:16}}>
            <div style={{fontSize:11,fontWeight:800,color:"#8A949B",textTransform:"uppercase",letterSpacing:".04em",marginBottom:3,display:"flex",alignItems:"center",gap:6}}><i className="ti ti-arrows-horizontal" style={{fontSize:14,color:"#6BA6C9"}}/>Dettaglio settimana</div>
            <div style={{fontSize:10,color:"#8A949B",marginBottom:9,display:"flex",alignItems:"center",gap:5}}><i className="ti ti-hand-move" style={{fontSize:13,color:"#6BA6C9"}}/>Trascina "Pranzo" o "Cena" su un altro giorno per spostarlo</div>
            <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:6,WebkitOverflowScrolling:"touch"}}>
              {GIORNI_B.map(function(g,i){
                var dataG=new Date(lunB.getTime()); dataG.setDate(lunB.getDate()+i);
                var oggiSel=i===giornoSel;
                return (
                  <div key={"det-"+g} data-detcol={i} style={{flex:"0 0 168px",display:"flex",flexDirection:"column",gap:8,borderRadius:14,outline:(drag&&drag.active&&drag.over===(""+i)&&drag.g!==g)?"2px dashed #2F6586":"2px dashed transparent",outlineOffset:2,transition:"outline-color .15s"}}>
                    <div style={{background:oggiSel?"#2F6586":"#fff",color:oggiSel?"#fff":"#2C3338",border:"1px solid "+(oggiSel?"#2F6586":"#E3EAEE"),borderRadius:12,padding:"8px 12px",display:"flex",alignItems:"baseline",gap:7}}>
                      <span style={{fontSize:15,fontWeight:800}}>{g.slice(0,3)}</span>
                      <span style={{fontSize:11,fontWeight:700,opacity:.75}}>{dataG.getDate()+" "+MESI_ABBR[dataG.getMonth()]}</span>
                    </div>
                    {["Pranzo","Cena"].map(function(m){
                      var s=scelteAttive[g+"-"+m]||{};
                      var compl=s.piattoUnico && s.piattoUnico.nome && (""+s.piattoUnico.nome).trim();
                      var pieno=pastoPieno(s);
                      var isSrc=drag&&drag.active&&drag.g===g&&drag.m===m;
                      return (
                        <div key={m} style={{background:"#fff",border:"1px solid #E3EAEE",borderRadius:14,padding:"10px 11px",display:"flex",flexDirection:"column",gap:7,opacity:isSrc?.4:1}}>
                          <div onPointerDown={function(e){ detDown(e,g,m); }} onPointerMove={detMove} onPointerUp={detUp} onPointerCancel={detUp}
                            style={{fontSize:10,fontWeight:800,letterSpacing:".05em",textTransform:"uppercase",color:"#8A949B",display:"flex",alignItems:"center",gap:6,touchAction:"none",cursor:pieno?"grab":"default",userSelect:"none"}}><i className={"ti "+(m==="Pranzo"?"ti-sun":"ti-moon")} style={{fontSize:13,color:"#6BA6C9"}}/>{m}{pieno?<i className="ti ti-grip-vertical" style={{fontSize:13,color:"#B4BEC4",marginLeft:"auto"}}/>:null}</div>
                          {compl?(
                            <div onClick={function(){ cambiaGiorno(i); cambiaPasto(m); setSheetTab("completo"); apriPicker(GRUPPI_BOARD[0]); }}
                              style={{display:"flex",alignItems:"center",gap:9,background:"#F2F6F8",borderRadius:10,padding:"8px 10px",cursor:"pointer"}}>
                              <div style={{width:26,height:26,borderRadius:8,background:"#E2EEF5",color:"#2F6586",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}><i className="ti ti-tools-kitchen-2"/></div>
                              <div style={{fontSize:13,fontWeight:700,color:"#2C3338",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.piattoUnico.nome}</div>
                            </div>
                          ):(
                            GRUPPI_BOARD.map(function(gr){
                              var id=s[gr.campo];
                              return (
                                <div key={gr.campo} onClick={function(){ cambiaGiorno(i); cambiaPasto(m); setSheetTab("componi"); apriPicker(gr); }}
                                  style={{display:"flex",alignItems:"center",gap:9,cursor:"pointer"}}>
                                  <div style={{width:26,height:26,borderRadius:8,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,
                                    background:id?"#E2EEF5":"#fff",border:id?"none":"1.5px dashed #CADCE8",color:id?"#2F6586":"#B4BEC4"}}>
                                    <i className={"ti "+(id?iconaGruppo(gr.tipo,id):"ti-plus")}/>
                                  </div>
                                  <div style={{fontSize:13,fontWeight:id?700:600,color:id?"#2C3338":"#8A949B",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,minWidth:0}}>{id?nomeGruppo(id):gr.label}</div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        );
      })()}

      {false&&(
      <div>
      <button onClick={function(){ setVista("settimana"); }}
        style={{display:"flex",alignItems:"center",gap:6,border:"none",background:"transparent",color:"#2F6586",fontSize:14,fontWeight:700,cursor:"pointer",padding:"0 0 8px"}}>
        <i className="ti ti-chevron-left" style={{fontSize:18}}/>Settimana
      </button>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,paddingTop:2}}>
        <div>
          <div style={{fontSize:23,fontWeight:800,letterSpacing:"-0.01em",color:"#2C3338"}}>{GIORNI_B[giornoSel]}</div>
          <div style={{fontSize:13,color:"#8A949B"}}>{(function(){var d=new Date(lunediSettimana().getTime()); if(settB===1)d.setDate(d.getDate()+7); d.setDate(d.getDate()+giornoSel); return d.getDate()+" "+MESI_ABBR[d.getMonth()];})()} · rifinisci il pasto</div>
        </div>
        <span style={{fontSize:14,fontWeight:800,color:isCompleto(GIORNI_B[giornoSel],pastoSel)?"#2F6586":"#8A949B"}}>{isCompleto(GIORNI_B[giornoSel],pastoSel)?"Completo":"Da compilare"}</span>
      </div>

      <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:14}}>
        {PASTI_B.map(function(p){
          var comp=isCompleto(GIORNI_B[giornoSel],p); var sel=pastoSel===p;
          return (
            <button key={p} onClick={function(){cambiaPasto(p);}}
              style={{fontSize:13,fontWeight:700,color:sel?"#fff":"#8A949B",background:sel?"#2F6586":"#fff",
                border:"1.5px solid "+(sel?"#2F6586":"#E3EAEE"),borderRadius:20,padding:"8px 13px",cursor:"pointer",
                display:"flex",alignItems:"center",gap:6,fontFamily:"'Nunito',system-ui,sans-serif"}}>
              {comp&&!sel&&<i className="ti ti-check" style={{fontSize:15,color:"#6BA6C9"}}/>}{p}
            </button>
          );
        })}
      </div>

      {true ? (
        <div className="mf-card" style={{padding:"14px 15px",marginBottom:11,display:"flex",flexDirection:"column",gap:10}}>
          <div style={{fontSize:12,color:"#2C3338",fontWeight:800,display:"flex",alignItems:"center",gap:7}}><i className="ti ti-pencil" style={{fontSize:16,color:"#2F6586"}}/>Scrivi il piatto</div>
          <input value={puG.nome||""} onChange={function(e){ setPiattoUnicoField("nome", e.target.value); }}
            onBlur={function(){ riconosciCompleto(); }}
            onKeyDown={function(e){ if(e.key==="Enter"){ e.target.blur(); } }}
            placeholder="Es. Pollo e patate, Lasagne, Pasta al pomodoro..."
            style={{padding:"12px 13px",borderRadius:13,border:"1.5px solid #E3EAEE",fontSize:15,fontWeight:700,outline:"none",fontFamily:"'Nunito',system-ui,sans-serif",color:"#2C3338"}}/>

          {puG.riconosciuti && puG.riconosciuti.length>0 ? (
            <div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center"}}>
              {puG.riconosciuti.map(function(r){
                return <span key={r.id} style={{fontSize:12,fontWeight:700,color:"#2C3338",background:"#E2EEF5",borderRadius:20,padding:"5px 10px",display:"flex",alignItems:"center",gap:5}}>
                  <i className={"ti "+iconaGruppo(r.tipo,r.id)} style={{fontSize:13,color:"#2F6586"}}/>{r.nome}
                </span>;
              })}
              {(parseInt(puG.kcal,10)>0) ? <span style={{fontSize:12,color:"#8A949B"}}>~{puG.kcal} kcal · {puG.prot||0}g prot</span> : null}
            </div>
          ) : ((""+(puG.nome||"")).trim() ? null : (
            <div style={{fontSize:11,color:"#B4BEC4"}}>L'app riconosce ingredienti e calorie da sola</div>
          ))}

          {(""+(puG.nome||"")).trim() ? (
          <div style={{display:"flex",gap:8}}>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:"#8A949B",fontWeight:700,marginBottom:4}}>kcal · {puG.autofill?"stimate":"facolt."}</div>
              <input inputMode="numeric" value={puG.kcal||""} onChange={function(e){ setPiattoUnicoField("kcal", e.target.value.replace(/[^0-9]/g,"")); }}
                placeholder="es. 550" style={{width:"100%",padding:"11px 12px",borderRadius:12,border:"1.5px solid #E3EAEE",fontSize:14,outline:"none",fontFamily:"'Nunito',system-ui,sans-serif"}}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:"#8A949B",fontWeight:700,marginBottom:4}}>proteine g · {puG.autofill?"stimate":"facolt."}</div>
              <input inputMode="numeric" value={puG.prot||""} onChange={function(e){ setPiattoUnicoField("prot", e.target.value.replace(/[^0-9]/g,"")); }}
                placeholder="es. 20" style={{width:"100%",padding:"11px 12px",borderRadius:12,border:"1.5px solid #E3EAEE",fontSize:14,outline:"none",fontFamily:"'Nunito',system-ui,sans-serif"}}/>
            </div>
          </div>
          ) : null}
        </div>
      ) : null}

      <div style={{textAlign:"center",fontSize:11,fontWeight:800,color:"#B4BEC4",letterSpacing:"0.06em",margin:"2px 0 11px"}}>— OPPURE SCEGLI GLI INGREDIENTI —</div>

      <div>
      {campiPasto().map(function(c){
        var id=sceltaG[c.campo];
        var it=ingById(id);
        var gv=grammiField(sceltaG, c.campo, it, c.def);
        return (
          <div key={c.campo} className="mf-card" style={{padding:"12px 14px",marginBottom:9,display:"flex",alignItems:"center",gap:12}}>
            <div onClick={function(){ apriPicker(c); }} style={{display:"flex",alignItems:"center",gap:12,flex:1,minWidth:0,cursor:"pointer"}}>
              <div style={{width:40,height:40,borderRadius:12,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,
                background:id?"#E2EEF5":"transparent",border:id?"none":"1.5px dashed #C4D2DA",color:id?"#2F6586":"#8A949B"}}>
                <i className={"ti "+(id?iconaGruppo(c.tipo,id):"ti-plus")}/>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,color:"#8A949B",fontWeight:700}}>{c.label}</div>
                <div style={{fontSize:14,fontWeight:700,color:id?"#2C3338":"#8A949B",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{id?nomeGruppo(id):("Aggiungi "+c.label.toLowerCase().replace(" · facoltativa",""))}</div>
              </div>
            </div>
            {id ? (
              <div style={{display:"flex",alignItems:"center",gap:6,background:"#F2F6F8",borderRadius:20,padding:4}}>
                <button onClick={function(){ setGrammiG(c.campo, gv-10); }} style={{width:26,height:26,borderRadius:"50%",border:"none",background:"#fff",color:"#2F6586",fontSize:15,fontWeight:800,cursor:"pointer"}}>−</button>
                <span style={{fontSize:12,fontWeight:800,minWidth:40,textAlign:"center",fontVariantNumeric:"tabular-nums"}}>{gv} g</span>
                <button onClick={function(){ setGrammiG(c.campo, gv+10); }} style={{width:26,height:26,borderRadius:"50%",border:"none",background:"#fff",color:"#2F6586",fontSize:15,fontWeight:800,cursor:"pointer"}}>+</button>
              </div>
            ) : (
              <i className="ti ti-chevron-right" onClick={function(){ apriPicker(c); }} style={{color:"#B4BEC4",fontSize:18,cursor:"pointer"}}/>
            )}
          </div>
        );
      })}

      <div style={{marginTop:5,marginBottom:11}}>
        <NutriPanel carbo={sceltaG.carbo} prot={sceltaG.proteina} verd={sceltaG.verdura} verd2={sceltaG.verdura2}
          frutta={sceltaG.frutta} lattic={sceltaG.latticino} pasto={pastoSel} profili={profili}
          grammi={sceltaG.grammi||{}} onGrammi={function(field,val){ setGrammiG(field, parseInt(val,10)||0); }}/>
      </div>
      </div>

      {true ? (
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:11}}>

          {(function(){
            var pu = puG;
            var membri = Object.keys(profili||{}).length;
            if(membri===0) return null;
            var kb = parseInt(pu.kcal, 10) || 0; var pb = parseInt(pu.prot, 10) || 0;
            var righe = (kb || pb) ? stimaFamiglia(pu) : [];
            var problemi = righe.filter(function(x){ return x.problema; }).length;
            var nAltri = (pu.altri||[]).length; var nFuori = (pu.fuori||[]).length;
            var sub, subCol;
            if(problemi > 0) { sub = "Non adatto a " + problemi + " membri — apri e adatta"; subCol = "#8A5A12"; }
            else if(nAltri || nFuori) { sub = [nAltri?(nAltri+" piatto in più"):"", nFuori?(nFuori+" a mensa/fuori"):""].filter(Boolean).join(" · "); subCol = "#2F6586"; }
            else { sub = "Chi mangia altro · mensa/fuori · varianti"; subCol = "#8A949B"; }
            return (
              <button onClick={function(){ setMostraOpzFam(!mostraOpzFam); }}
                style={{border:"1.5px solid "+(problemi>0?"#E8D5AE":"#E3EAEE"),background:problemi>0?"#FBF3E2":"#fff",borderRadius:14,padding:"12px 13px",cursor:"pointer",
                  display:"flex",alignItems:"center",gap:11,fontFamily:"'Nunito',system-ui,sans-serif",textAlign:"left"}}>
                <i className={"ti "+(problemi>0?"ti-alert-triangle":"ti-users")} style={{fontSize:19,color:problemi>0?"#8A5A12":"#2F6586",flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:700,color:"#2C3338"}}>Opzioni per la famiglia</div>
                  <div style={{fontSize:11,color:subCol,fontWeight:problemi>0?700:400}}>{sub}</div>
                </div>
                <i className={"ti "+(mostraOpzFam?"ti-chevron-up":"ti-chevron-down")} style={{color:"#B4BEC4",fontSize:18}}/>
              </button>
            );
          })()}

          {mostraOpzFam && (<>
          {(function(){
            var pu = puG;
            var kb = parseInt(pu.kcal, 10) || 0;
            var pb = parseInt(pu.prot, 10) || 0;
            var membri = Object.keys(profili||{}).length;
            if((kb===0 && pb===0) || membri===0) return null;
            var righe = stimaFamiglia(pu);
            var problemi = righe.filter(function(x){ return x.problema; }).length;
            return (
              <div style={{border:"1.5px solid #E3EAEE",borderRadius:13,padding:"11px 12px"}}>
                <div style={{fontSize:11,fontWeight:800,color:"#2F6586",marginBottom:9,display:"flex",alignItems:"center",gap:6}}>
                  <i className="ti ti-users" style={{fontSize:14}}/>Per la famiglia ({membri}) · porzioni indicative
                </div>
                {righe.map(function(r,idx){
                  return (
                    <div key={idx} style={{display:"flex",alignItems:"center",gap:9,padding:"6px 0",borderTop: idx===0?"none":"1px solid #F1F4F6"}}>
                      <span style={{width:9,height:9,borderRadius:"50%",background:r.colore,flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,color:"#2C3338",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.nome}</div>
                        {r.altro && r.dish && <div style={{fontSize:10,color:"#2F6586",fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.dish}</div>}
                      </div>
                      {r.fuori ? (
                        r.contato ? (
                          <><span style={{fontSize:12,color:"#8A949B",fontWeight:600}}>~{r.kcal} kcal</span>
                          <span style={{fontSize:11,fontWeight:800,color:"#C2355A",background:"#FBE7EC",borderRadius:20,padding:"3px 9px",display:"flex",alignItems:"center",gap:4}}>
                            <i className="ti ti-door-exit" style={{fontSize:12}}/>{r.prot}g · fuori
                          </span></>
                        ) : (
                          <span style={{fontSize:11,fontWeight:800,color:"#C2355A",background:"#FBE7EC",borderRadius:20,padding:"3px 9px",display:"flex",alignItems:"center",gap:4}}>
                            <i className="ti ti-door-exit" style={{fontSize:12}}/>A mensa / fuori
                          </span>
                        )
                      ) : r.problema ? (
                        <><span style={{fontSize:12,color:"#8A949B",fontWeight:600}}>~{r.kcal} kcal</span>
                        <span style={{fontSize:11,fontWeight:800,color:"#8A5A12",background:"#F6ECD9",borderRadius:20,padding:"3px 9px",display:"flex",alignItems:"center",gap:4}}>
                          <i className="ti ti-alert-triangle" style={{fontSize:12}}/>{r.over ? (r.prot+"g (max "+r.limite+")") : r.motivi.join(" · ")}
                        </span></>
                      ) : (
                        <><span style={{fontSize:12,color:"#8A949B",fontWeight:600}}>~{r.kcal} kcal</span>
                        <span style={{fontSize:12,fontWeight:700,color:"#2F6586",minWidth:44,textAlign:"right"}}>{r.prot}g prot</span></>
                      )}
                    </div>
                  );
                })}
                {problemi>0 && (
                  <div style={{fontSize:11,color:"#8A5A12",marginTop:9,lineHeight:1.4,display:"flex",gap:6}}>
                    <i className="ti ti-info-circle" style={{fontSize:14,flexShrink:0,marginTop:1}}/>
                    <span>Ognuno viene controllato sulle sue esigenze (proteine, lattosio, glutine…). Crea le varianti adatte o assegna un piatto diverso qui sotto.</span>
                  </div>
                )}
              </div>
            );
          })()}

          {(function(){
            var pu = puG;
            var profIds = Object.keys(profili||{});
            if(profIds.length===0) return null;
            var righe = stimaFamiglia(pu);
            var flaggedPrimary = righe.some(function(r){ return r.problema && !r.altro && !r.fuori; });
            var altri = pu.altri || [];
            return (
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {flaggedPrimary && (
                  <button onClick={function(){ creaVariante(); }}
                    style={{padding:"11px",borderRadius:13,border:"1.5px solid #E8D5AE",background:"#F6ECD9",color:"#8A5A12",fontSize:13,fontWeight:800,cursor:"pointer",
                      display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
                    <i className="ti ti-wand" style={{fontSize:16}}/>Crea le varianti adatte
                  </button>
                )}

                {altri.map(function(d,i){
                  return (
                    <div key={i} style={{border:"1.5px solid #E3EAEE",borderRadius:13,padding:"11px 12px",display:"flex",flexDirection:"column",gap:9}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:11,fontWeight:800,color:"#2F6586",flex:1,display:"flex",alignItems:"center",gap:6}}><i className="ti ti-tools-kitchen-2" style={{fontSize:14}}/>Piatto in più {i+2}</span>
                        <i className="ti ti-trash" onClick={function(){ removeAltro(i); }} style={{fontSize:16,color:"#B4BEC4",cursor:"pointer"}}/>
                      </div>
                      <input value={d.nome||""} onChange={function(e){ setAltroField(i, "nome", e.target.value); }}
                        onBlur={function(){ riconosciAltro(i); }} onKeyDown={function(e){ if(e.key==="Enter"){ e.target.blur(); } }}
                        placeholder="Es. Pasta al pomodoro, Pappa..."
                        style={{padding:"11px 12px",borderRadius:12,border:"1.5px solid #E3EAEE",fontSize:14,fontWeight:700,outline:"none",fontFamily:"'Nunito',system-ui,sans-serif",color:"#2C3338"}}/>
                      {d.kcal && (parseInt(d.kcal,10)>0) ? <div style={{fontSize:11,color:"#8A949B",fontWeight:600}}>~{d.kcal} kcal · {d.prot||0}g proteine (per porzione adulto)</div> : null}
                      <div style={{fontSize:11,color:"#8A949B",fontWeight:700}}>Chi lo mangia</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                        {profIds.map(function(pid){
                          var p = profili[pid];
                          var on = (d.membri||[]).indexOf(pid) >= 0;
                          return (
                            <button key={pid} onClick={function(){ toggleAltroMembro(i, pid); }}
                              style={{border:"1.5px solid "+(on?(p.colore||"#2F6586"):"#E3EAEE"),background:on?(p.colore||"#2F6586"):"#fff",color:on?"#fff":"#2C3338",
                                borderRadius:20,padding:"6px 11px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif"}}>
                              {p.nome}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <div style={{border:"1.5px solid #E3EAEE",borderRadius:13,padding:"11px 12px",display:"flex",flexDirection:"column",gap:9}}>
                  <div style={{fontSize:11,fontWeight:800,color:"#C2355A",display:"flex",alignItems:"center",gap:6}}><i className="ti ti-door-exit" style={{fontSize:14}}/>A mensa / fuori casa</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {profIds.map(function(pid){
                      var p = profili[pid];
                      var on = (pu.fuori||[]).indexOf(pid) >= 0;
                      return (
                        <button key={pid} onClick={function(){ toggleFuoriMembro(pid); }}
                          style={{border:"1.5px solid "+(on?"#C2355A":"#E3EAEE"),background:on?"#C2355A":"#fff",color:on?"#fff":"#2C3338",
                            borderRadius:20,padding:"6px 11px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif"}}>
                          {p.nome}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{fontSize:10,color:"#8A949B"}}>Chi è a mensa o fuori non entra nel cucinato né nella spesa.</div>
                  {(pu.fuori||[]).length>0 && (
                    <div style={{borderTop:"1px solid #F1F4F6",paddingTop:9,display:"flex",flexDirection:"column",gap:8}}>
                      <div style={{fontSize:10,color:"#8A949B",fontWeight:700}}>Vuoi contare il pasto fuori? Aggiungi kcal e proteine (facoltativo).</div>
                      {(pu.fuori||[]).map(function(pid){
                        var p = profili[pid]; if(!p) return null;
                        var fv = (pu.fuoriVal||{})[pid] || {};
                        return (
                          <div key={pid} style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontSize:12,fontWeight:700,color:"#2C3338",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.nome}</span>
                            <input inputMode="numeric" value={fv.kcal||""} onChange={function(e){ setFuoriVal(pid, "kcal", e.target.value.replace(/[^0-9]/g,"")); }}
                              placeholder="kcal" style={{width:66,padding:"8px 10px",borderRadius:11,border:"1.5px solid #E3EAEE",fontSize:13,outline:"none",fontFamily:"'Nunito',system-ui,sans-serif",textAlign:"center"}}/>
                            <input inputMode="numeric" value={fv.prot||""} onChange={function(e){ setFuoriVal(pid, "prot", e.target.value.replace(/[^0-9]/g,"")); }}
                              placeholder="prot g" style={{width:66,padding:"8px 10px",borderRadius:11,border:"1.5px solid #E3EAEE",fontSize:13,outline:"none",fontFamily:"'Nunito',system-ui,sans-serif",textAlign:"center"}}/>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button onClick={function(){ addPiatto(); }}
                  style={{padding:"11px",borderRadius:13,border:"1.5px dashed #6BA6C9",background:"#fff",color:"#2F6586",fontSize:13,fontWeight:700,cursor:"pointer",
                    display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
                  <i className="ti ti-plus" style={{fontSize:16}}/>Aggiungi un altro piatto
                </button>
              </div>
            );
          })()}
          </>)}

          <button onClick={function(){ setPickRic(true); }}
            style={{padding:"11px",borderRadius:13,border:"1.5px solid #6BA6C9",background:"#fff",color:"#2F6586",fontSize:13,fontWeight:700,cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
            <i className="ti ti-book" style={{fontSize:16}}/>Scegli da una ricetta salvata
          </button>
        </div>
      ) : null}

      <div style={{display:"flex",gap:8,marginTop:4}}>
        <button onClick={function(){setShowSpesa(true);}}
          style={{padding:"14px 16px",borderRadius:14,border:"1.5px solid #6BA6C9",background:"#fff",color:"#2F6586",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:7}}>
          <i className="ti ti-shopping-cart" style={{fontSize:16}}/>Spesa
        </button>
        <button onClick={function(){ setVista("settimana"); }}
          style={{flex:1,padding:"14px",borderRadius:14,border:"none",background:"#2F6586",color:"#fff",fontSize:15,fontWeight:800,cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <i className="ti ti-check" style={{fontSize:18}}/>Fatto
        </button>
      </div>

      {picker&&(
        <div onClick={function(){ setPicker(null); }}
          style={{position:"fixed",inset:0,background:"rgba(20,40,55,.4)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div onClick={function(e){ e.stopPropagation(); }}
            style={{background:"#fff",borderRadius:"22px 22px 0 0",width:"100%",maxWidth:390,maxHeight:"78vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"14px 18px 10px",borderBottom:"1px solid #E3EAEE",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontSize:16,fontWeight:800}}>Scegli {picker.label.toLowerCase().replace(" · facoltativa","")}</div>
              <i className="ti ti-x" onClick={function(){ setPicker(null); }} style={{fontSize:20,color:"#8A949B",cursor:"pointer"}}/>
            </div>
            <div style={{padding:"10px 16px 0"}}>
              <div style={{display:"flex",alignItems:"center",gap:9,background:"#F2F6F8",border:"1.5px solid #E3EAEE",borderRadius:13,padding:"10px 12px"}}>
                <i className="ti ti-search" style={{color:"#8A949B",fontSize:18}}/>
                <input value={pickS} onChange={function(e){ setPickS(e.target.value); }} placeholder="Cerca un alimento..."
                  style={{border:"none",outline:"none",background:"none",flex:1,fontFamily:"'Nunito',system-ui,sans-serif",fontSize:14,fontWeight:600,color:"#2C3338"}}/>
              </div>
              <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
                <button onClick={function(){ setFGlut(!fGlut); }}
                  style={{border:"1.5px solid "+(fGlut?"#2F6586":"#E3EAEE"),background:fGlut?"#E2EEF5":"#fff",color:fGlut?"#2F6586":"#8A949B",
                    fontSize:12,fontWeight:700,borderRadius:20,padding:"7px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:5,fontFamily:"'Nunito',system-ui,sans-serif"}}>
                  <i className="ti ti-bread-off" style={{fontSize:14}}/>Senza glutine</button>
                {(picker.tipo==="verdura"||picker.tipo==="frutta")&&(
                  <button onClick={function(){ setFStag(!fStag); }}
                    style={{border:"1.5px solid "+(fStag?"#2F6586":"#E3EAEE"),background:fStag?"#E2EEF5":"#fff",color:fStag?"#2F6586":"#8A949B",
                      fontSize:12,fontWeight:700,borderRadius:20,padding:"7px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:5,fontFamily:"'Nunito',system-ui,sans-serif"}}>
                    <i className="ti ti-clock" style={{fontSize:14}}/>Di stagione</button>
                )}
              </div>
            </div>
            <div style={{overflowY:"auto",padding:"8px 16px 24px"}}>
              {sceltaG[picker.campo]&&(
                <div onClick={function(){ setCampoG(picker.campo, null); setPicker(null); }}
                  style={{display:"flex",alignItems:"center",gap:10,padding:"11px 4px",cursor:"pointer",color:"#C2355A",fontWeight:700,fontSize:14}}>
                  <i className="ti ti-trash" style={{fontSize:18}}/>Togli {picker.label.toLowerCase().replace(" · facoltativa","")}
                </div>
              )}
              {(function(){
                var q=pickS.trim().toLowerCase();
                var lista=picker.db.filter(function(o){
                  if(q && o.nome.toLowerCase().indexOf(q)<0) return false;
                  if(fGlut && ingredienteVietato(o, ["glutine"])) return false;
                  if(fStag && (picker.tipo==="verdura"||picker.tipo==="frutta") && !inStagione(o)) return false;
                  return true;
                });
                if(!lista.length) return <div style={{textAlign:"center",color:"#8A949B",fontSize:13,padding:"24px 0"}}>Nessun alimento trovato.</div>;
                return lista.map(function(o){
                  var vt=ingredienteVietato(o, famVietati);
                  var sel=sceltaG[picker.campo]===o.id;
                  var uso=usoSettIng(o.id);
                  var stag=(picker.tipo==="verdura"||picker.tipo==="frutta")&&inStagione(o)&&o.stagione!=="tutto"&&o.stagione;
                  return (
                    <div key={o.id} onClick={function(){ if(vt) return; setCampoG(picker.campo, o.id); setPicker(null); }}
                      style={{display:"flex",alignItems:"center",gap:12,padding:"11px 4px",borderTop:"1px solid #EEF2F5",
                        cursor:vt?"default":"pointer",opacity:vt?.5:1}}>
                      <div style={{width:36,height:36,borderRadius:11,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,
                        background:vt?"#F1F4F6":"#E2EEF5",color:vt?"#B4BEC4":"#2F6586"}}>
                        <i className={"ti "+(vt?"ti-ban":iconaGruppo(picker.tipo,o.id))}/>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:700}}>{o.nome}</div>
                        {vt&&<div style={{fontSize:11,color:"#C2355A",fontWeight:600}}>Non adatto ({vt})</div>}
                      </div>
                      {!vt&&uso>=2&&<span style={{fontSize:10,fontWeight:700,background:"#F6ECD9",color:"#8A5A12",padding:"3px 8px",borderRadius:20}}>{uso}× settimana</span>}
                      {!vt&&uso===0&&stag&&<span style={{fontSize:10,fontWeight:700,background:"#E2EEF5",color:"#2F6586",padding:"3px 8px",borderRadius:20}}>di stagione</span>}
                      <span style={{width:22,height:22,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                        border:"1.5px solid "+(sel?"#2F6586":"#CADCE8"),background:sel?"#2F6586":"#fff",color:"#fff"}}>
                        {sel&&<i className="ti ti-check" style={{fontSize:14}}/>}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {pickRic&&(
        <div onClick={function(){ setPickRic(false); }}
          style={{position:"fixed",inset:0,background:"rgba(20,40,55,.4)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div onClick={function(e){ e.stopPropagation(); }}
            style={{background:"#fff",borderRadius:"22px 22px 0 0",width:"100%",maxWidth:390,maxHeight:"78vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"14px 18px 10px",borderBottom:"1px solid #E3EAEE",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontSize:16,fontWeight:800}}>Scegli una ricetta</div>
              <i className="ti ti-x" onClick={function(){ setPickRic(false); }} style={{fontSize:20,color:"#8A949B",cursor:"pointer"}}/>
            </div>
            <div style={{padding:"10px 16px 0"}}>
              <div style={{display:"flex",alignItems:"center",gap:9,background:"#F2F6F8",border:"1.5px solid #E3EAEE",borderRadius:13,padding:"10px 12px"}}>
                <i className="ti ti-search" style={{color:"#8A949B",fontSize:18}}/>
                <input value={pickS} onChange={function(e){ setPickS(e.target.value); }} placeholder="Cerca una ricetta..."
                  style={{border:"none",outline:"none",background:"none",flex:1,fontFamily:"'Nunito',system-ui,sans-serif",fontSize:14,fontWeight:600,color:"#2C3338"}}/>
              </div>
            </div>
            <div style={{overflowY:"auto",padding:"8px 16px 24px"}}>
              {DB_RICETTE.filter(function(rc){ var q=pickS.trim().toLowerCase(); return !q || rc.titolo.toLowerCase().indexOf(q)>=0; }).map(function(rc){
                var por = rc.porzioni && (rc.porzioni.adulto || rc.porzioni.adulta || {});
                return (
                  <div key={rc.id} onClick={function(){ usaRicetta(rc); }}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"11px 4px",borderTop:"1px solid #EEF2F5",cursor:"pointer"}}>
                    <div style={{fontSize:22,width:34,textAlign:"center"}}>{rc.emoji||"🍽️"}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700}}>{rc.titolo}</div>
                      <div style={{fontSize:11,color:"#8A949B"}}>{rc.categoria}{por.kcal?" · "+por.kcal+" kcal":""}{rc.tempo?" · "+rc.tempo:""}</div>
                    </div>
                    <i className="ti ti-chevron-right" style={{color:"#B4BEC4",fontSize:18}}/>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      </div>
      )}

      {picker&&(
        <div onClick={function(){ setPicker(null); }}
          style={{position:"fixed",inset:0,background:"rgba(20,40,55,.4)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div onClick={function(e){ e.stopPropagation(); }}
            style={{background:"#fff",borderRadius:"22px 22px 0 0",width:"100%",maxWidth:390,maxHeight:"82vh",display:"flex",flexDirection:"column"}}>
            <div style={{width:38,height:4,background:"#E3EAEE",borderRadius:4,margin:"9px auto 4px"}}/>
            <div style={{padding:"2px 18px 8px",display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
              <div style={{minWidth:0}}>
                <div style={{fontSize:17,fontWeight:800,color:"#2C3338"}}>{sheetTab==="completo"?"Piatto completo":("Scegli "+(picker.tipo==="carbo"?"il carboidrato":(picker.tipo==="verdura"?"la verdura":(picker.tipo==="salsa"?"la salsa":"la proteina"))))}</div>
                <div style={{fontSize:12,color:"#8A949B",fontWeight:600}}>{GIORNI_B[giornoSel]+" · "+pastoSel}</div>
              </div>
              <i className="ti ti-x" onClick={function(){ setPicker(null); }} style={{fontSize:20,color:"#8A949B",cursor:"pointer",flexShrink:0}}/>
            </div>
            <div style={{display:"flex",gap:7,padding:"0 18px 8px"}}>
              {[{k:"componi",ic:"ti-layout-list",t:"Componi"},{k:"completo",ic:"ti-tools-kitchen-2",t:"Piatto completo"}].map(function(tb){
                var on=sheetTab===tb.k;
                return <button key={tb.k} onClick={function(){ setSheetTab(tb.k); }}
                  style={{flex:1,border:"1.5px solid "+(on?"#E2EEF5":"#E3EAEE"),background:on?"#E2EEF5":"#fff",color:on?"#2F6586":"#8A949B",
                    fontSize:12,fontWeight:800,padding:"9px 0",borderRadius:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontFamily:"'Nunito',system-ui,sans-serif"}}>
                  <i className={"ti "+tb.ic} style={{fontSize:14}}/>{tb.t}</button>;
              })}
            </div>
            {sheetTab==="componi"?(
              <>
                <div style={{padding:"2px 16px 0"}}>
                  <div style={{display:"flex",alignItems:"center",gap:9,background:"#F2F6F8",border:"1.5px solid #E3EAEE",borderRadius:13,padding:"10px 12px"}}>
                    <i className="ti ti-search" style={{color:"#8A949B",fontSize:18}}/>
                    <input value={pickS} onChange={function(e){ setPickS(e.target.value); }} placeholder="Cerca un alimento..."
                      style={{border:"none",outline:"none",background:"none",flex:1,fontFamily:"'Nunito',system-ui,sans-serif",fontSize:14,fontWeight:600,color:"#2C3338"}}/>
                  </div>
                  <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
                    <button onClick={function(){ setFGlut(!fGlut); }}
                      style={{border:"1.5px solid "+(fGlut?"#2F6586":"#E3EAEE"),background:fGlut?"#E2EEF5":"#fff",color:fGlut?"#2F6586":"#8A949B",
                        fontSize:12,fontWeight:700,borderRadius:20,padding:"7px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:5,fontFamily:"'Nunito',system-ui,sans-serif"}}>
                      <i className="ti ti-bread-off" style={{fontSize:14}}/>Senza glutine</button>
                    {(picker.tipo==="verdura"||picker.tipo==="frutta")&&(
                      <button onClick={function(){ setFStag(!fStag); }}
                        style={{border:"1.5px solid "+(fStag?"#2F6586":"#E3EAEE"),background:fStag?"#E2EEF5":"#fff",color:fStag?"#2F6586":"#8A949B",
                          fontSize:12,fontWeight:700,borderRadius:20,padding:"7px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:5,fontFamily:"'Nunito',system-ui,sans-serif"}}>
                        <i className="ti ti-clock" style={{fontSize:14}}/>Di stagione</button>
                    )}
                  </div>
                </div>
                <div style={{overflowY:"auto",padding:"8px 16px 24px"}}>
                  {sceltaG[picker.campo]&&(
                    <div onClick={function(){ setCampoG(picker.campo, null); setPicker(null); }}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"11px 4px",cursor:"pointer",color:"#C2355A",fontWeight:700,fontSize:14}}>
                      <i className="ti ti-trash" style={{fontSize:18}}/>Togli {picker.label.toLowerCase().replace(" · facoltativa","")}
                    </div>
                  )}
                  {nuovoAl?(
                    <div style={{border:"1.5px solid #6BA6C9",background:"#EBF3FA",borderRadius:13,padding:"12px",display:"flex",flexDirection:"column",gap:9,marginBottom:8}}>
                      <div style={{fontSize:12,fontWeight:800,color:"#2F6586"}}>Nuovo alimento</div>
                      <input value={nuovoAl.nome||""} onChange={function(e){ setNuovoAl(Object.assign({},nuovoAl,{nome:e.target.value})); }} placeholder="Nome (es. Seitan)"
                        style={{padding:"11px 12px",borderRadius:12,border:"1.5px solid #CADCE8",fontSize:14,fontWeight:700,outline:"none",fontFamily:"'Nunito',system-ui,sans-serif",color:"#2C3338"}}/>
                      {picker.tipo==="proteina"?(
                        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                          {[{k:"carne",l:"Carne"},{k:"pesce",l:"Pesce"},{k:"legumi",l:"Legumi"},{k:"uova",l:"Uova"},{k:"latticini",l:"Latticini"}].map(function(ct){
                            var on=(nuovoAl.cat||"carne")===ct.k;
                            return <button key={ct.k} onClick={function(){ setNuovoAl(Object.assign({},nuovoAl,{cat:ct.k})); }}
                              style={{border:"1.5px solid "+(on?"#2F6586":"#CADCE8"),background:on?"#2F6586":"#fff",color:on?"#fff":"#2F6586",borderRadius:20,padding:"6px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif"}}>{ct.l}</button>;
                          })}
                        </div>
                      ):null}
                      <div style={{display:"flex",gap:8}}>
                        <input inputMode="numeric" value={nuovoAl.kcal||""} onChange={function(e){ setNuovoAl(Object.assign({},nuovoAl,{kcal:e.target.value.replace(/[^0-9]/g,"")})); }} placeholder="kcal/100g"
                          style={{flex:1,padding:"10px 11px",borderRadius:11,border:"1.5px solid #CADCE8",fontSize:13,outline:"none",fontFamily:"'Nunito',system-ui,sans-serif"}}/>
                        <input inputMode="numeric" value={nuovoAl.prot||""} onChange={function(e){ setNuovoAl(Object.assign({},nuovoAl,{prot:e.target.value.replace(/[^0-9]/g,"")})); }} placeholder="proteine/100g"
                          style={{flex:1,padding:"10px 11px",borderRadius:11,border:"1.5px solid #CADCE8",fontSize:13,outline:"none",fontFamily:"'Nunito',system-ui,sans-serif"}}/>
                      </div>
                      <div style={{fontSize:10,color:"#8A949B"}}>kcal e proteine per 100g (facoltativi)</div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={function(){ setNuovoAl(null); }} style={{flex:1,border:"1.5px solid #E3EAEE",background:"#fff",color:"#8A949B",borderRadius:12,padding:"11px",fontFamily:"'Nunito',system-ui,sans-serif",fontSize:13,fontWeight:700,cursor:"pointer"}}>Annulla</button>
                        <button onClick={function(){ creaAlimento(); }} style={{flex:2,border:"none",background:"#2F6586",color:"#fff",borderRadius:12,padding:"11px",fontFamily:"'Nunito',system-ui,sans-serif",fontSize:14,fontWeight:800,cursor:"pointer"}}>Crea e usa</button>
                      </div>
                    </div>
                  ):(
                    <div onClick={function(){ setNuovoAl({nome:(pickS||"").trim(), cat:"carne", kcal:"", prot:""}); }}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"11px 4px",cursor:"pointer",color:"#2F6586",fontWeight:800,fontSize:14,borderTop:"1px solid #EEF2F5"}}>
                      <i className="ti ti-plus" style={{fontSize:18}}/>Crea un nuovo alimento{(pickS||"").trim()?(" «"+pickS.trim()+"»"):""}
                    </div>
                  )}
                  {(function(){
                    var q=pickS.trim().toLowerCase();
                    var lista=picker.db.filter(function(o){
                      if(q && o.nome.toLowerCase().indexOf(q)<0) return false;
                      if(fGlut && ingredienteVietato(o, ["glutine"])) return false;
                      if(fStag && (picker.tipo==="verdura"||picker.tipo==="frutta") && !inStagione(o)) return false;
                      return true;
                    });
                    if(!lista.length) return <div style={{textAlign:"center",color:"#8A949B",fontSize:13,padding:"24px 0"}}>Nessun alimento trovato.</div>;
                    return lista.map(function(o){
                      var vt=ingredienteVietato(o, famVietati);
                      var sel=sceltaG[picker.campo]===o.id;
                      var uso=usoSettIng(o.id);
                      var stag=(picker.tipo==="verdura"||picker.tipo==="frutta")&&inStagione(o)&&o.stagione!=="tutto"&&o.stagione;
                      return (
                        <div key={o.id} onClick={function(){ if(vt) return; setCampoG(picker.campo, o.id); setPicker(null); }}
                          style={{display:"flex",alignItems:"center",gap:12,padding:"11px 4px",borderTop:"1px solid #EEF2F5",
                            cursor:vt?"default":"pointer",opacity:vt?.5:1}}>
                          <div style={{width:36,height:36,borderRadius:11,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,
                            background:vt?"#F1F4F6":"#E2EEF5",color:vt?"#B4BEC4":"#2F6586"}}>
                            <i className={"ti "+(vt?"ti-ban":iconaGruppo(picker.tipo,o.id))}/>
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:14,fontWeight:700}}>{o.nome}</div>
                            {vt&&<div style={{fontSize:11,color:"#C2355A",fontWeight:600}}>Non adatto ({vt})</div>}
                          </div>
                          {!vt&&uso>=2&&<span style={{fontSize:10,fontWeight:700,background:"#F6ECD9",color:"#8A5A12",padding:"3px 8px",borderRadius:20}}>{uso}× settimana</span>}
                          {!vt&&uso===0&&stag&&<span style={{fontSize:10,fontWeight:700,background:"#E2EEF5",color:"#2F6586",padding:"3px 8px",borderRadius:20}}>di stagione</span>}
                          <span style={{width:22,height:22,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                            border:"1.5px solid "+(sel?"#2F6586":"#CADCE8"),background:sel?"#2F6586":"#fff",color:"#fff"}}>
                            {sel&&<i className="ti ti-check" style={{fontSize:14}}/>}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </>
            ):(
              <div style={{overflowY:"auto",padding:"4px 16px 24px",display:"flex",flexDirection:"column",gap:12}}>
                <div className="mf-card" style={{padding:"14px 15px",display:"flex",flexDirection:"column",gap:10}}>
                  <div style={{fontSize:12,color:"#2C3338",fontWeight:800,display:"flex",alignItems:"center",gap:7}}><i className="ti ti-pencil" style={{fontSize:16,color:"#2F6586"}}/>Scrivi il piatto</div>
                  <input value={puG.nome||""} onChange={function(e){ setPiattoUnicoField("nome", e.target.value); }}
                    onBlur={function(){ riconosciCompleto(); }} onKeyDown={function(e){ if(e.key==="Enter"){ e.target.blur(); } }}
                    placeholder="Es. Lasagne, Pollo e patate, Pasta al pomodoro..."
                    style={{padding:"12px 13px",borderRadius:13,border:"1.5px solid #E3EAEE",fontSize:15,fontWeight:700,outline:"none",fontFamily:"'Nunito',system-ui,sans-serif",color:"#2C3338"}}/>
                  {puG.riconosciuti && puG.riconosciuti.length>0?(
                    <div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center"}}>
                      {puG.riconosciuti.map(function(r){
                        return <span key={r.id} style={{fontSize:12,fontWeight:700,color:"#2C3338",background:"#E2EEF5",borderRadius:20,padding:"5px 10px",display:"flex",alignItems:"center",gap:5}}>
                          <i className={"ti "+iconaGruppo(r.tipo,r.id)} style={{fontSize:13,color:"#2F6586"}}/>{r.nome}</span>;
                      })}
                      {(parseInt(puG.kcal,10)>0)?<span style={{fontSize:12,color:"#8A949B"}}>~{puG.kcal} kcal · {puG.prot||0}g prot</span>:null}
                    </div>
                  ):(
                    <div style={{fontSize:11,color:"#B4BEC4"}}>L'app riconosce ingredienti e calorie da sola</div>
                  )}
                  {(""+(puG.nome||"")).trim()?(
                    <button onClick={function(){ riconosciCompleto(); setPicker(null); }}
                      style={{border:"none",background:"#2F6586",color:"#fff",borderRadius:13,padding:"13px",fontFamily:"'Nunito',system-ui,sans-serif",fontSize:15,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                      <i className="ti ti-check" style={{fontSize:18}}/>Aggiungi il piatto
                    </button>
                  ):null}
                </div>

                {(mealPrepScad.length>0 || dispensaScad.length>0)?(
                  <div style={{background:"#F6ECD9",border:"1px solid #E8D5AE",borderRadius:14,padding:"12px 13px",display:"flex",flexDirection:"column",gap:9}}>
                    <div style={{fontSize:11,fontWeight:800,color:"#8A5A12",display:"flex",alignItems:"center",gap:6,textTransform:"uppercase",letterSpacing:".03em"}}><i className="ti ti-clock-exclamation" style={{fontSize:15}}/>Da usare presto</div>
                    {mealPrepScad.map(function(mp){
                      return (
                        <div key={mp.id} onClick={function(){ setPiattoUnicoField("nome", mp.nome); riconosciCompleto(); setPicker(null); }}
                          style={{display:"flex",alignItems:"center",gap:10,background:"#fff",borderRadius:11,padding:"9px 11px",cursor:"pointer"}}>
                          <div style={{width:30,height:30,borderRadius:9,background:"#E2EEF5",color:"#2F6586",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}><i className="ti ti-tools-kitchen-2"/></div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:700,color:"#2C3338",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{mp.nome}</div>
                            <div style={{fontSize:10,color:"#8A5A12",fontWeight:700}}>Meal prep · {mp.porzioniRimaste} porz. · scade {mp.scadenza}</div>
                          </div>
                          <span style={{fontSize:11,fontWeight:800,color:"#2F6586"}}>Usa</span>
                        </div>
                      );
                    })}
                    {dispensaScad.length>0?(
                      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                        {dispensaScad.map(function(d,di){
                          return <button key={"ds"+di} onClick={function(){ var base=(""+(puG.nome||"")).trim(); setPiattoUnicoField("nome", base?(base+", "+d.nome):d.nome); }}
                            style={{border:"1px solid #E8D5AE",background:"#fff",color:"#8A5A12",borderRadius:20,padding:"6px 11px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif",display:"flex",alignItems:"center",gap:5}}>
                            <i className="ti ti-basket" style={{fontSize:13}}/>{d.nome}</button>;
                        })}
                      </div>
                    ):null}
                    <div style={{fontSize:10,color:"#8A5A12",fontWeight:600}}>Tocca un meal prep per usarlo, o un ingrediente per aggiungerlo al piatto.</div>
                  </div>
                ):null}

                <div style={{fontSize:11,fontWeight:800,color:"#B4BEC4",letterSpacing:".06em",padding:"0 2px"}}>OPPURE DA UNA RICETTA SALVATA</div>
                {DB_RICETTE.filter(function(rc){ var q=pickS.trim().toLowerCase(); return !q || rc.titolo.toLowerCase().indexOf(q)>=0; }).map(function(rc){
                  var por = rc.porzioni && (rc.porzioni.adulto || rc.porzioni.adulta || {});
                  return (
                    <div key={rc.id} onClick={function(){ usaRicetta(rc); setPicker(null); }}
                      style={{display:"flex",alignItems:"center",gap:12,padding:"11px 4px",borderTop:"1px solid #EEF2F5",cursor:"pointer"}}>
                      <div style={{width:34,textAlign:"center",color:"#2F6586"}}><i className="ti ti-tools-kitchen-2" style={{fontSize:20}}/></div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:700}}>{rc.titolo}</div>
                        <div style={{fontSize:11,color:"#8A949B"}}>{rc.categoria}{por.kcal?" · "+por.kcal+" kcal":""}{rc.tempo?" · "+rc.tempo:""}</div>
                      </div>
                      <i className="ti ti-chevron-right" style={{color:"#B4BEC4",fontSize:18}}/>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {drag&&drag.active&&(
        <div style={{position:"fixed",left:drag.x,top:drag.y,transform:"translate(-50%,-140%)",zIndex:400,pointerEvents:"none",
          background:"#2F6586",color:"#fff",borderRadius:12,padding:"8px 13px",fontSize:12,fontWeight:800,boxShadow:"0 10px 24px -8px rgba(20,40,55,.6)",display:"flex",alignItems:"center",gap:7}}>
          <i className={"ti "+(drag.m==="Pranzo"?"ti-sun":"ti-moon")} style={{fontSize:14}}/>Sposta {drag.m} di {drag.g.slice(0,3)}
        </div>
      )}

      {popup&&<PopupPasto data={popup} scelte={scelteAttive} setScelte={setScelteAttive} setPopup={setPopup} cambiaGiorno={cambiaGiorno} cambiaPasto={cambiaPasto} GIORNI={GIORNI_B} PASTI={PASTI_B} onSalvaRicetta={function(r){setRicette(ricette.concat([r]));}}/>}

      {showSpesa&&(
        <div onClick={function(){setShowSpesa(false);}}
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div onClick={function(e){e.stopPropagation();}}
            style={{background:"#fff",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:390,maxHeight:"70vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"14px 16px 8px",borderBottom:"1px solid #E3EAEE",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:13,fontWeight:800}}>Lista della spesa</div>
              <button onClick={function(){setShowSpesa(false);}} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#8A949B"}}>x</button>
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
            style={{background:"#fff",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:390,
              maxHeight:"75vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"14px 16px 8px",borderBottom:"1px solid #E3EAEE",
              display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:14,fontWeight:800,color:"#C2355A"}}>Ricette preferite</div>
              <button onClick={function(){setShowRicette(null);}}
                style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#8A949B"}}>x</button>
            </div>
            <div style={{overflowY:"auto",padding:"10px 14px 24px"}}>
              {ricette.length===0&&(
                <div style={{textAlign:"center",padding:"30px 0",color:"#8A949B",fontSize:12}}>
                  Nessuna ricetta salvata. Salva un pasto dalla griglia settimanale.
                </div>
              )}
              {ricette.map(function(r,ri){
                var allDB=CARBOIDRATI.concat(PROTEINE).concat(VERDURE).concat(FRUTTA).concat(SALSE).concat(ALIMENTI_CUSTOM);
                return (
                  <div key={r.id} style={{background:"#F5F8FC",borderRadius:12,padding:"12px",marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                      <div>
                        <div style={{fontSize:12,fontWeight:800,color:"#2C3338"}}>{r.nome}</div>
                        {r.nota&&<div style={{fontSize:10,color:"#8A949B",fontStyle:"italic"}}>{r.nota}</div>}
                      </div>
                      <div style={{display:"flex",gap:4}}>
                        <button onClick={function(){
                          setScelteAttive(function(prev){ var n=Object.assign({},prev||{}); n[key]=Object.assign({},r.pasto); return n; });
                          if(onSavePasto){ var gp=key.split("-"); onSavePasto(settB, gp[0], gp.slice(1).join("-"), Object.assign({},r.pasto)); }
                          setShowRicette(null);
                        }} style={{padding:"4px 10px",borderRadius:20,border:"none",
                          background:"#2F6586",color:"#fff",fontSize:9,cursor:"pointer",fontWeight:700}}>
                          Usa
                        </button>
                        <button onClick={function(){
                          setRicette(ricette.filter(function(_,i){return i!==ri;}));
                        }} style={{padding:"4px 8px",borderRadius:20,border:"1px solid #E3EAEE",
                          background:"#fff",color:"#C2355A",fontSize:9,cursor:"pointer"}}>
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
                        return <span key={k} style={{fontSize:9,background:"#EBF3FA",color:"#2F6586",padding:"2px 7px",borderRadius:20}}>{it.emoji} {it.nome}</span>;
                      })}
                    </div>
                    {r.note_famiglia&&Object.keys(r.note_famiglia).length>0&&(
                      <div style={{marginTop:6,paddingTop:6,borderTop:"1px solid #eee"}}>
                        <div style={{fontSize:9,color:"#8A949B",marginBottom:3}}>Note per membro:</div>
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


function patologiaPrimaria(patologie) {
  if(patologie.indexOf("svezzamento") >= 0) return "svezzamento";
  if(patologie.indexOf("ipoproteica") >= 0) return "ipoproteica";
  if(patologie.indexOf("fenilchetonuria") >= 0) return "ipoproteica";
  return patologie.length ? patologie[0] : "nessuna";
}

var REGIME_LIST = [
  {id:"onnivoro",    l:"Onnivoro"},
  {id:"vegetariano", l:"Vegetariano"},
  {id:"vegano",      l:"Vegano"},
  {id:"pescetariano",l:"Pescetariano"},
  {id:"mediterranea",l:"Mediterranea"},
  {id:"chetogenica", l:"Chetogenica"},
  {id:"iperproteica",l:"Iperproteica"}
];

function regimeLabel(id) {
  var r = REGIME_LIST.find(function(x){ return x.id === id; });
  return r ? r.l : "Onnivoro";
}

function regimeToPatologie(regime) {
  if(regime === "vegetariano") return ["vegetariano"];
  if(regime === "vegano") return ["vegano"];
  return [];
}

function kcalObiettivo(kcal, obiettivo) {
  if(obiettivo === "dimagrire") return Math.round(kcal * 0.8);
  if(obiettivo === "ingrassare") return Math.round(kcal * 1.2);
  return kcal;
}

function fattoreAttivita(a) {
  if(a === "sedentario") return 1.2;
  if(a === "moderato") return 1.55;
  if(a === "intenso") return 1.725;
  return 1.375;
}

function kcalMifflin(peso, altezza, anni, sesso, fattore) {
  var bmr = 10*peso + 6.25*altezza - 5*anni + (sesso === "maschio" ? 5 : -161);
  return Math.round(bmr * (fattore || 1.375));
}

function profiloToMembro(p) {
  var pats = p.patologie ? p.patologie.slice()
    : (p.patologia && p.patologia !== "nessuna" ? [p.patologia] : []);
  return {
    id: p.id,
    nome: p.nome || "",
    dataNascita: p.dataNascita || "",
    sesso: p.sesso || "femmina",
    patologie: pats,
    obiettivo: p.obiettivo || "mantenere",
    regime: p.regime || "onnivoro",
    peso: (p.peso ? String(p.peso) : ""),
    altezza: (p.altezza ? String(p.altezza) : ""),
    attivita: p.attivita || "leggero",
    valoriMedico: p.valoriMedico || {prot:"", phe:""},
    override: p.override || {kcal:"", prot_max:""}
  };
}

function OnboardingFamiglia(props) {
  var onComplete = props.onComplete;
  var onExit = props.onExit;
  var modifica = !!props.profiliIniziali;
  var pianif = props.pianificazione || {giorno:4, ora:"09:00", attiva:false};
  var setPianif = props.setPianificazione || function(){};
  var GIORNI_PLAN = ["Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato","Domenica"];
  var s_lista = useState(function(){
    if(props.profiliIniziali) {
      return Object.keys(props.profiliIniziali).map(function(k){ return profiloToMembro(props.profiliIniziali[k]); });
    }
    return [];
  }); var lista = s_lista[0]; var setLista = s_lista[1];
  var s_editId = useState(null); var editId = s_editId[0]; var setEditId = s_editId[1];
  var s_nome = useState(""); var nome = s_nome[0]; var setNome = s_nome[1];
  var s_data = useState(""); var dataN = s_data[0]; var setDataN = s_data[1];
  var s_sesso = useState("femmina"); var sesso = s_sesso[0]; var setSesso = s_sesso[1];
  var s_pat = useState([]); var patologie = s_pat[0]; var setPatologie = s_pat[1];
  var s_obj = useState("mantenere"); var obiettivo = s_obj[0]; var setObiettivo = s_obj[1];
  var s_peso = useState(""); var peso = s_peso[0]; var setPeso = s_peso[1];
  var s_alt = useState(""); var altezza = s_alt[0]; var setAltezza = s_alt[1];
  var s_att = useState("leggero"); var attivita = s_att[0]; var setAttivita = s_att[1];
  var s_regime = useState("onnivoro"); var regime = s_regime[0]; var setRegime = s_regime[1];
  var s_regimeOpen = useState(false); var regimeOpen = s_regimeOpen[0]; var setRegimeOpen = s_regimeOpen[1];
  var s_regOpen = useState(false); var regOpen = s_regOpen[0]; var setRegOpen = s_regOpen[1];
  var s_vprot = useState(""); var vProt = s_vprot[0]; var setVProt = s_vprot[1];
  var s_vphe = useState(""); var vPhe = s_vphe[0]; var setVPhe = s_vphe[1];
  var s_ovk = useState(""); var ovKcal = s_ovk[0]; var setOvKcal = s_ovk[1];
  var s_ovp = useState(""); var ovProt = s_ovp[0]; var setOvProt = s_ovp[1];
  var s_calc = useState(null); var calcolo = s_calc[0]; var setCalcolo = s_calc[1];

  function togglePat(pid) {
    if(patologie.indexOf(pid) >= 0) setPatologie(patologie.filter(function(x){ return x !== pid; }));
    else setPatologie(patologie.concat([pid]));
  }

  function membroCorrente() {
    return { id: editId, nome: nome.trim(), dataNascita: dataN, sesso: sesso,
      patologie: patologie.slice(), obiettivo: obiettivo, regime: regime,
      peso: peso, altezza: altezza, attivita: attivita,
      valoriMedico: {prot: vProt, phe: vPhe},
      override: {kcal: ovKcal, prot_max: ovProt} };
  }

  function modificaMembro(idx) {
    var m = lista[idx];
    setEditId(m.id || null);
    setNome(m.nome || ""); setDataN(m.dataNascita || ""); setSesso(m.sesso || "femmina");
    setPatologie((m.patologie || []).slice()); setObiettivo(m.obiettivo || "mantenere");
    setRegime(m.regime || "onnivoro"); setPeso(m.peso || ""); setAltezza(m.altezza || "");
    setAttivita(m.attivita || "leggero");
    setVProt((m.valoriMedico && m.valoriMedico.prot) || ""); setVPhe((m.valoriMedico && m.valoriMedico.phe) || "");
    setOvKcal((m.override && m.override.kcal) || ""); setOvProt((m.override && m.override.prot_max) || "");
    setLista(lista.filter(function(x,i){ return i !== idx; }));
    setCalcolo(null);
    if(typeof window !== "undefined") window.scrollTo(0, 0);
  }

  function patologieEffettive(m) {
    var extra = regimeToPatologie(m.regime);
    var arr = (m.patologie || []).slice();
    extra.forEach(function(p){ if(arr.indexOf(p) < 0) arr.push(p); });
    return arr;
  }

  function valoriFinali(m) {
    var mEff = {dataNascita:m.dataNascita, sesso:m.sesso, obiettivo:m.obiettivo,
      peso:m.peso, altezza:m.altezza, attivita:m.attivita,
      patologie:patologieEffettive(m), valoriMedico:m.valoriMedico, override:m.override};
    var fin = getParametriFinali(mEff);
    var base = getParametriEta(m.dataNascita, m.sesso);
    var anni = calcolaEta(m.dataNascita).anni;
    var pe = parseFloat(m.peso); var al = parseFloat(m.altezza);
    if((isNaN(al) || al <= 0) && !isNaN(pe) && pe > 0 && anni >= 14) {
      al = (m.sesso === "maschio") ? 175 : 162;
    }
    var usaMifflin = !isNaN(pe) && pe > 0 && !isNaN(al) && al > 0 && anni >= 14;
    var baseKcal = usaMifflin ? kcalMifflin(pe, al, anni, m.sesso, fattoreAttivita(m.attivita)) : base.kcal;
    var kcal;
    if(m.override && m.override.kcal !== undefined && m.override.kcal !== null && m.override.kcal !== "") {
      kcal = parseInt(m.override.kcal, 10);
    } else {
      var ob = m.obiettivo;
      var pats = m.patologie || [];
      if(ob === "mantenere") {
        if(pats.indexOf("dimagrante") >= 0) ob = "dimagrire";
        else if(pats.indexOf("ingrassante") >= 0) ob = "ingrassare";
      }
      kcal = kcalObiettivo(baseKcal, ob);
      if(pats.indexOf("allattamento") >= 0) kcal += 500;
      if(anni >= 18) { var minK = (m.sesso === "maschio") ? 1500 : 1200; if(kcal < minK) kcal = minK; }
    }
    return {kcal:kcal, prot:base.prot, carb:base.carb,
      prot_max:fin.prot_max, carb_max:fin.carb_max, phe_max:fin.phe_max, mifflin:usaMifflin};
  }

  function calcola() {
    if(!dataN) return;
    var v = valoriFinali(membroCorrente());
    setCalcolo(v);
  }

  function riassunto(m) {
    var v = valoriFinali(m);
    var anni = calcolaEta(m.dataNascita).anni;
    var sx = m.sesso === "maschio" ? "Maschio" : "Femmina";
    var parts = [];
    if(v.prot_max !== null) parts.push("Max " + v.prot_max + "g proteine/die");
    if(v.carb_max !== null) parts.push("Max " + v.carb_max + "g carbo/die");
    if(v.phe_max !== null) parts.push("Fenilalanina max " + v.phe_max + "mg");
    parts.push(v.kcal + " kcal/die");
    return m.nome + ", " + anni + " anni, " + sx + " - " + parts.join(", ");
  }

  function aggiungi() {
    if(!nome.trim() || !dataN) return;
    setLista(lista.concat([membroCorrente()]));
    setEditId(null);
    setNome(""); setDataN(""); setSesso("femmina"); setPatologie([]);
    setObiettivo("mantenere"); setPeso(""); setAltezza(""); setAttivita("leggero");
    setRegime("onnivoro"); setRegimeOpen(false);
    setVProt(""); setVPhe(""); setOvKcal(""); setOvProt(""); setCalcolo(null); setRegOpen(false);
  }

  function rimuovi(idx) {
    setLista(lista.filter(function(m,i){ return i !== idx; }));
  }

  function inizia() {
    var pf = {};
    var tutti = lista.slice();
    if(nome.trim() && dataN) tutti.push(membroCorrente());
    tutti.forEach(function(m, idx) {
      var id = m.id || ("m_" + idx + "_" + Date.now());
      var patEff = patologieEffettive(m);
      var fin = getParametriFinali({dataNascita:m.dataNascita, sesso:m.sesso, patologie:patEff, valoriMedico:m.valoriMedico, override:m.override});
      var v = valoriFinali(m);
      pf[id] = { id: id, nome: m.nome, emoji: "",
        dataNascita: m.dataNascita, sesso: m.sesso, obiettivo: m.obiettivo, regime: m.regime,
        patologie: patEff, patologia: patologiaPrimaria(patEff),
        valoriMedico: m.valoriMedico, override: {kcal: String(v.kcal), prot_max: (m.override ? m.override.prot_max : "")},
        eta: calcolaEta(m.dataNascita).anni,
        kcal_target: v.kcal, prot_max: (v.prot_max !== null ? v.prot_max : fin.prot),
        colore: COLORI[idx % COLORI.length],
        peso: (parseFloat(m.peso) || 0), altezza: (parseFloat(m.altezza) || 170),
        kcal_custom: "", prot_custom: "", note: "" };
    });
    onComplete(pf);
  }

  var canAdd = !!nome.trim() && !!dataN;
  var showProt = patologie.indexOf("ipoproteica") >= 0;
  var showPhe = patologie.indexOf("fenilchetonuria") >= 0;
  var inputStyle = {padding:"12px 14px",borderRadius:13,border:"1.5px solid #E3EAEE",
    fontSize:14,outline:"none",width:"100%",boxSizing:"border-box",marginBottom:10,
    color:"#2C3338",background:"#fff",fontFamily:"'Nunito',system-ui,sans-serif"};
  var labelStyle = {display:"block",fontSize:12,color:"#8A949B",fontWeight:600,marginBottom:6};

  var etaCorr = calcolaEta(dataN);
  var isBambino = dataN !== "" && etaCorr.anni < 14;

  var selPat = PATOLOGIE_LIST.filter(function(p){ return p.id !== "nessuna" && patologie.indexOf(p.id) >= 0; });
  var regLabels = selPat.map(function(p){ return p.label; });
  var regSummary = regLabels.length === 0 ? "Seleziona regime"
    : (regLabels.length <= 2 ? regLabels.join(" · ")
       : (regLabels.slice(0,2).join(" · ") + " · +" + (regLabels.length-2)));

  return (
    <div style={{minHeight:"100vh",background:"#F2F6F8",padding:"18px 20px 28px",boxSizing:"border-box",maxWidth:420,margin:"0 auto"}}>
      <div style={{maxWidth:420,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",marginBottom:8}}>
          <button onClick={function(){ if(onExit) onExit(); else if(lista.length) inizia(); }} aria-label="Indietro"
            style={{width:34,height:34,borderRadius:11,border:"1px solid #E3EAEE",background:"#fff",
              color:"#2C3338",fontSize:19,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <i className="ti ti-chevron-left"/>
          </button>
        </div>

        <div style={{textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:6,marginBottom:16}}>
          <div style={{width:46,height:46,borderRadius:14,background:"#2F6586",color:"#fff",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>
            <i className="ti ti-tools-kitchen-2"/>
          </div>
          <div style={{fontSize:21,fontWeight:800,color:"#2C3338"}}>{modifica?"Modifica famiglia":"Benvenuto"}</div>
          <div style={{fontSize:13,color:"#8A949B",fontWeight:500}}>{modifica?"Tocca un familiare per modificarlo, o aggiungine uno nuovo":"Configura i profili nutrizionali della famiglia"}</div>
          <div style={{display:"flex",gap:6,justifyContent:"center",marginTop:3}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:"#E3EAEE"}}/>
            <span style={{width:18,height:7,borderRadius:7,background:"#6BA6C9"}}/>
            <span style={{width:7,height:7,borderRadius:"50%",background:"#E3EAEE"}}/>
          </div>
        </div>

        {lista.length>0&&(
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:16}}>
            {lista.map(function(m, idx){
              return (
                <span key={idx} style={{display:"flex",alignItems:"center",gap:7,background:"#fff",
                  border:"1px solid #E3EAEE",borderRadius:20,padding:"5px 11px 5px 6px",fontSize:12,fontWeight:600}}>
                  <span onClick={function(){modificaMembro(idx);}} style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer"}}>
                    <span style={{width:24,height:24,borderRadius:"50%",background:"#E2EEF5",color:"#2F6586",
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700}}>
                      {m.nome ? m.nome.slice(0,1).toUpperCase() : "?"}
                    </span>
                    {m.nome}
                  </span>
                  <i className="ti ti-x" onClick={function(){rimuovi(idx);}}
                    style={{fontSize:14,color:"#8A949B",cursor:"pointer"}}/>
                </span>
              );
            })}
            <span style={{fontSize:12,color:"#8A949B",fontWeight:600}}>{lista.length} aggiunti</span>
          </div>
        )}

        <div style={{background:"#fff",borderRadius:18,padding:"16px 15px",marginBottom:16,border:"1px solid #E3EAEE"}}>
          <div style={{fontSize:14,fontWeight:700,color:"#2F6586",marginBottom:13}}>{editId?"Modifica familiare":"Nuovo familiare"}</div>
          <div style={{marginBottom:13}}>
            <label style={labelStyle}>Nome</label>
            <input placeholder="Nome" value={nome}
              onChange={function(e){setNome(e.target.value);}} style={Object.assign({},inputStyle,{marginBottom:0})}/>
          </div>
          <div style={{marginBottom:13}}>
            <label style={labelStyle}>Data di nascita</label>
            <input type="date" value={dataN}
              onChange={function(e){var v=e.target.value; setDataN(v); if(v!==""&&calcolaEta(v).anni<14){setObiettivo("mantenere");} setCalcolo(null);}} style={Object.assign({},inputStyle,{marginBottom:0})}/>
          </div>

          <div style={{display:"flex",gap:10,marginBottom:13}}>
            <div style={{flex:1}}>
              <label style={labelStyle}>Sesso</label>
              <select value={sesso} onChange={function(e){setSesso(e.target.value);setCalcolo(null);}} style={Object.assign({},inputStyle,{marginBottom:0})}>
                <option value="femmina">Femmina</option>
                <option value="maschio">Maschio</option>
              </select>
            </div>
            <div style={{flex:1}}>
              <label style={labelStyle}>Obiettivo</label>
              {isBambino?(
                <div style={Object.assign({},inputStyle,{marginBottom:0,background:"#F2F6F8",color:"#8A949B",
                  display:"flex",alignItems:"center",gap:7})}>
                  <i className="ti ti-plant-2" style={{fontSize:16,color:"#6BA6C9"}}/>Crescita
                </div>
              ):(
                <select value={obiettivo} onChange={function(e){setObiettivo(e.target.value);setCalcolo(null);}} style={Object.assign({},inputStyle,{marginBottom:0})}>
                  <option value="ingrassare">Piu del fabbisogno</option>
                  <option value="dimagrire">Meno del fabbisogno</option>
                  <option value="mantenere">Mantieni</option>
                </select>
              )}
            </div>
          </div>

          <div style={{marginBottom:13}}>
            <label style={labelStyle}>Peso e altezza - opzionale</label>
            <div style={{display:"flex",gap:10}}>
              <input placeholder="kg" inputMode="decimal" value={peso}
                onChange={function(e){setPeso(e.target.value.replace(/[^0-9.]/g,""));setCalcolo(null);}} style={Object.assign({},inputStyle,{marginBottom:0})}/>
              <input placeholder="cm" inputMode="numeric" value={altezza}
                onChange={function(e){setAltezza(e.target.value.replace(/[^0-9]/g,""));setCalcolo(null);}} style={Object.assign({},inputStyle,{marginBottom:0})}/>
            </div>
          </div>

          <div style={{marginBottom:13}}>
            <label style={labelStyle}>Livello di attivita</label>
            <select value={attivita} onChange={function(e){setAttivita(e.target.value);setCalcolo(null);}} style={Object.assign({},inputStyle,{marginBottom:0})}>
              <option value="sedentario">Sedentario</option>
              <option value="leggero">Leggero (1-3 gg/sett)</option>
              <option value="moderato">Moderato (3-5 gg/sett)</option>
              <option value="intenso">Intenso (6-7 gg/sett)</option>
            </select>
          </div>

          <div style={{marginBottom:13}}>
            <label style={labelStyle}>Regime alimentare</label>
            <div onClick={function(){ setRegimeOpen(!regimeOpen); }}
              style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,
                padding:"12px 14px",borderRadius:13,border:"1.5px solid #E3EAEE",background:"#fff",
                cursor:"pointer",fontSize:14,fontWeight:600,color:"#2C3338"}}>
              <span>{regimeLabel(regime)}</span>
              <i className={"ti "+(regimeOpen?"ti-chevron-up":"ti-chevron-down")} style={{color:"#8A949B",fontSize:18}}/>
            </div>
            {regimeOpen&&(
              <div style={{border:"1.5px solid #E3EAEE",borderRadius:13,marginTop:7,overflow:"hidden"}}>
                {REGIME_LIST.map(function(r, i){
                  var sel = regime === r.id;
                  return (
                    <div key={r.id} onClick={function(){ setRegime(r.id); setRegimeOpen(false); setCalcolo(null); }}
                      style={{display:"flex",alignItems:"center",gap:11,padding:"11px 13px",cursor:"pointer",
                        fontSize:13,color:"#2C3338",borderTop:i===0?"none":"1px solid #E3EAEE",
                        background:sel?"#E2EEF5":"#fff",fontWeight:sel?700:500}}>
                      <span style={{width:20,height:20,borderRadius:"50%",flexShrink:0,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        border:"1.5px solid "+(sel?"#2F6586":"#CADCE8"),
                        background:sel?"#2F6586":"#fff",color:"#fff"}}>
                        {sel&&<i className="ti ti-check" style={{fontSize:13}}/>}
                      </span>
                      {r.l}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{marginBottom:13}}>
            <label style={labelStyle}>Patologie e restrizioni · piu scelte</label>
            <div onClick={function(){ setRegOpen(!regOpen); }}
              style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,
                padding:"12px 14px",borderRadius:13,border:"1.5px solid "+(selPat.length?"#6BA6C9":"#E3EAEE"),
                background:selPat.length?"#E2EEF5":"#fff",cursor:"pointer",
                fontSize:14,fontWeight:600,color:selPat.length?"#2F6586":"#8A949B"}}>
              <span style={{flex:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{selPat.length?regSummary:"Nessuna restrizione"}</span>
              <i className={"ti "+(regOpen?"ti-chevron-up":"ti-chevron-down")}
                style={{color:selPat.length?"#2F6586":"#8A949B",fontSize:18}}/>
            </div>
            {regOpen&&(
              <div style={{border:"1.5px solid #E3EAEE",borderRadius:13,marginTop:7,overflow:"hidden",
                maxHeight:220,overflowY:"auto"}}>
                {PATOLOGIE_LIST.filter(function(p){ return p.id !== "nessuna" && p.id !== "vegetariano" && p.id !== "vegano" && p.id !== "dimagrante" && p.id !== "ingrassante"; }).map(function(p, i){
                  var sel = patologie.indexOf(p.id) >= 0;
                  return (
                    <div key={p.id} onClick={function(){ togglePat(p.id); }}
                      style={{display:"flex",alignItems:"center",gap:11,padding:"11px 13px",cursor:"pointer",
                        fontSize:13,color:"#2C3338",borderTop:i===0?"none":"1px solid #E3EAEE",
                        background:sel?"#E2EEF5":"#fff",fontWeight:sel?700:500}}>
                      <span style={{width:20,height:20,borderRadius:6,flexShrink:0,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        border:"1.5px solid "+(sel?"#2F6586":"#CADCE8"),
                        background:sel?"#2F6586":"#fff",color:"#fff"}}>
                        {sel&&<i className="ti ti-check" style={{fontSize:14}}/>}
                      </span>
                      {p.label}
                    </div>
                  );
                })}
                <div style={{display:"flex",alignItems:"center",gap:9,padding:"11px 13px",
                  borderTop:"1px solid #E3EAEE",fontSize:13,fontWeight:600,color:"#2F6586"}}>
                  <i className="ti ti-plus" style={{fontSize:16}}/>Aggiungi restrizione
                </div>
              </div>
            )}
          </div>

          {showProt&&(
            <input placeholder="Proteine max prescritte dal medico (g)" inputMode="numeric" value={vProt}
              onChange={function(e){setVProt(e.target.value.replace(/[^0-9]/g,""));}} style={inputStyle}/>
          )}
          {showPhe&&(
            <input placeholder="Fenilalanina max prescritta dal medico (mg)" inputMode="numeric" value={vPhe}
              onChange={function(e){setVPhe(e.target.value.replace(/[^0-9]/g,""));}} style={inputStyle}/>
          )}

          <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:600,color:"#8A949B",marginBottom:8}}>
            <i className="ti ti-adjustments-alt" style={{fontSize:16}}/>Parametri manuali · opzionale
          </div>
          <div style={{display:"flex",gap:10}}>
            <input placeholder="kcal/die (auto)" inputMode="numeric" value={ovKcal}
              onChange={function(e){setOvKcal(e.target.value.replace(/[^0-9]/g,""));}} style={Object.assign({},inputStyle,{marginBottom:0})}/>
            <input placeholder="prot max (auto)" inputMode="numeric" value={ovProt}
              onChange={function(e){setOvProt(e.target.value.replace(/[^0-9]/g,""));}} style={Object.assign({},inputStyle,{marginBottom:0})}/>
          </div>

          <button onClick={calcola} disabled={!canAdd}
            style={{width:"100%",padding:"11px",borderRadius:12,marginBottom:10,
              border:"1px solid #6BA6C9",background:"#E2EEF5",color:"#2F6586",
              fontSize:13,fontWeight:700,cursor:canAdd?"pointer":"default"}}>
            Calcola valori consigliati
          </button>

          {calcolo&&(
            <div style={{background:"#E2EEF5",borderRadius:12,padding:"12px",marginBottom:10}}>
              <div style={{fontSize:11,fontWeight:800,color:"#2F6586",marginBottom:6}}>Valori consigliati</div>
              <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                <div><div style={{fontSize:19,fontWeight:800,color:"#2F6586"}}>{calcolo.kcal}</div><div style={{fontSize:10,color:"#8A949B"}}>kcal/die</div></div>
                <div><div style={{fontSize:19,fontWeight:800,color:"#2F6586"}}>{calcolo.prot_max !== null ? calcolo.prot_max : calcolo.prot}</div><div style={{fontSize:10,color:"#8A949B"}}>g proteine{calcolo.prot_max !== null ? " max" : ""}</div></div>
                <div><div style={{fontSize:19,fontWeight:800,color:"#2F6586"}}>{calcolo.carb_max !== null ? calcolo.carb_max : calcolo.carb}</div><div style={{fontSize:10,color:"#8A949B"}}>g carbo{calcolo.carb_max !== null ? " max" : ""}</div></div>
              </div>
              <div style={{fontSize:10,color:"#8A949B",marginTop:6}}>
                {calcolo.mifflin ? "Calcolati con formula Mifflin-St Jeor da peso, altezza, eta, sesso e obiettivo." : "Calcolati da eta, sesso, obiettivo e patologie (inserisci peso e altezza per piu precisione)."} Puoi sovrascriverli sotto.
              </div>
            </div>
          )}

          {canAdd&&!calcolo&&(
            <div style={{background:"#EBF3FA",borderRadius:12,padding:"8px 10px",marginBottom:10,
              fontSize:11,color:"#2F6586",fontWeight:600}}>
              {riassunto(membroCorrente())}
            </div>
          )}

        </div>

        <button onClick={aggiungi} disabled={!canAdd}
          style={{width:"100%",padding:"14px",borderRadius:14,border:"none",marginBottom:10,
            display:"flex",alignItems:"center",justifyContent:"center",gap:8,
            background:canAdd?"#2F6586":"#ccc",color:"#fff",fontSize:15,fontWeight:700,
            cursor:canAdd?"pointer":"default"}}>
          <i className="ti ti-device-floppy" style={{fontSize:17}}/>{editId?"Aggiorna familiare":"Salva familiare"}
        </button>
        <button onClick={aggiungi} disabled={!canAdd}
          style={{width:"100%",padding:"14px",borderRadius:14,marginBottom:10,
            display:"flex",alignItems:"center",justifyContent:"center",gap:8,
            border:"1.5px solid #6BA6C9",background:"#fff",color:"#2F6586",fontSize:15,fontWeight:700,
            cursor:canAdd?"pointer":"default"}}>
          <i className="ti ti-user-plus" style={{fontSize:16}}/>Aggiungi un altro familiare
        </button>
        {!modifica&&(lista.length>0||canAdd)&&(
          <div style={{background:"#fff",border:"1px solid #E3EAEE",borderRadius:16,padding:"14px 15px",marginBottom:12}}>
            <div style={{fontSize:14,fontWeight:800,color:"#2C3338",display:"flex",alignItems:"center",gap:8,marginBottom:4}}><i className="ti ti-calendar" style={{fontSize:17,color:"#2F6586"}}/>Che giorno pianifichi il menu?</div>
            <div style={{fontSize:11,color:"#8A949B",marginBottom:11}}>Ti aiuta a ricordarti di preparare la settimana. Puoi cambiarlo dopo.</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {GIORNI_PLAN.map(function(g,i){
                var on=pianif.giorno===i;
                return <button key={g} onClick={function(){ setPianif(Object.assign({}, pianif, {giorno:i, attiva:true})); }}
                  style={{border:"1.5px solid "+(on?"#2F6586":"#E3EAEE"),background:on?"#2F6586":"#fff",color:on?"#fff":"#2C3338",
                    borderRadius:20,padding:"8px 13px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif"}}>{g}</button>;
              })}
            </div>
          </div>
        )}
        <button onClick={inizia} disabled={lista.length===0&&!canAdd}
          style={{width:"100%",padding:"14px",borderRadius:14,border:"none",
            background:modifica?((lista.length===0&&!canAdd)?"#ccc":"#2F6586"):"transparent",
            color:modifica?"#fff":((lista.length===0&&!canAdd)?"#B4BEC4":"#2F6586"),fontSize:15,fontWeight:700,
            display:"flex",alignItems:"center",justifyContent:"center",gap:8,
            cursor:(lista.length===0&&!canAdd)?"default":"pointer"}}>
          {modifica&&<i className="ti ti-check" style={{fontSize:17}}/>}{modifica?"Salva modifiche":"Continua →"}
        </button>
        {lista.length===0&&!canAdd&&(
          <div style={{fontSize:11,color:"#8A949B",textAlign:"center",marginTop:8}}>
            Aggiungi almeno un familiare per continuare
          </div>
        )}
      </div>
    </div>
  );
}

var GIORNI_ABBR = ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];
var MESI_ABBR = ["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];

function lunediSettimana() {
  var now = new Date();
  var m = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  m.setDate(m.getDate() - ((now.getDay()+6)%7));
  return m;
}

var REAZIONI = [
  {id:"ok",       l:"Accetto",  ic:"ti-check",     c:"#2F6586", bg:"#E2EEF5"},
  {id:"modifica", l:"Modifica", ic:"ti-pencil",    c:"#8A5A12", bg:"#F6ECD9"},
  {id:"fuori",    l:"Fuori",    ic:"ti-door-exit", c:"#C2355A", bg:"#FBE7EC"}
];
function reazById(id){ return REAZIONI.find(function(r){ return r.id === id; }) || null; }
function isoDay(dt){ return dt.getFullYear()+"-"+("0"+(dt.getMonth()+1)).slice(-2)+"-"+("0"+dt.getDate()).slice(-2); }
function lunediDi(dt) { var m = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()); m.setDate(m.getDate() - ((m.getDay()+6)%7)); return m; }

var GUEST_RESTR = [
  {id:"glutine",      l:"Senza glutine"},
  {id:"lattosio",     l:"Senza lattosio"},
  {id:"vegetariano",  l:"Vegetariano"},
  {id:"vegano",       l:"Vegano"},
  {id:"frutta_secca", l:"No frutta secca"},
  {id:"pesce",        l:"No pesce/crostacei"},
  {id:"uova",         l:"No uova"},
  {id:"diabete",      l:"Diabete"}
];
function restrLabel(id){ var r = GUEST_RESTR.find(function(x){ return x.id === id; }); return r ? r.l : id; }

function MenuView(props) {
  var menu = props.menu || {};
  var builder = props.builder || {};
  var setTab = props.setTab || function(){};
  var profili = props.profili || {};
  var feedback = props.feedback || {};
  var setFeedback = props.setFeedback || function(){};
  var ospiti = props.ospiti || {};
  var setOspiti = props.setOspiti || function(){};
  var familyId = props.familyId;
  var vals = Object.values(profili);

  var s_shareMsg = useState(""); var shareMsg = s_shareMsg[0]; var setShareMsg = s_shareMsg[1];
  function condividiMenu() {
    if(!familyId){ setShareMsg("Accedi per generare il link"); setTimeout(function(){ setShareMsg(""); }, 2500); return; }
    var url = (typeof window !== "undefined" ? window.location.origin : "") + "/famiglia/" + familyId;
    if(typeof navigator !== "undefined" && navigator.share){
      navigator.share({title:"Menu della settimana", text:"Dì la tua sul menu di questa settimana:", url:url}).catch(function(){});
    } else if(typeof navigator !== "undefined" && navigator.clipboard){
      navigator.clipboard.writeText(url).then(function(){ setShareMsg("Link copiato! Invialo alla famiglia"); setTimeout(function(){ setShareMsg(""); }, 3000); });
    }
  }

  var s_mid = useState(""); var midSel = s_mid[0]; var setMidSel = s_mid[1];
  var s_editDay = useState(""); var editDay = s_editDay[0]; var setEditDay = s_editDay[1];
  var s_nota = useState(""); var notaVal = s_nota[0]; var setNotaVal = s_nota[1];

  var lun = lunediSettimana();
  var dom = new Date(lun.getTime()); dom.setDate(lun.getDate()+6);
  var range = lun.getDate() + "-" + dom.getDate() + " " + MESI_ABBR[dom.getMonth()];
  var weekKey = isoDay(lun);

  var membro = midSel ? (profili[midSel] || null) : null;
  var mkey = membro ? membro.id : "";

  function nomePasto(giorno, mealName) {
    var b = (builder || {})[giorno + "-" + mealName];
    if(b && b.piattoUnico && b.piattoUnico.nome && (""+b.piattoUnico.nome).trim()) {
      var pu = b.piattoUnico;
      if(membro) {
        if((pu.fuori||[]).indexOf(membro.id) >= 0) return "A mensa / fuori";
        var alt = null;
        (pu.altri||[]).forEach(function(dd){ if((dd.membri||[]).indexOf(membro.id) >= 0) alt = dd; });
        if(alt && (""+alt.nome).trim()) return (""+alt.nome).trim();
        return (""+pu.nome).trim();
      }
      var extra = (pu.altri && pu.altri.length) ? (" (+"+pu.altri.length+")") : "";
      return (""+pu.nome).trim() + extra;
    }
    var info = pastoUnificato(builder, menu, giorno, mealName);
    return info ? info.nome : null;
  }
  function getReaz(day, mid) {
    var w = feedback[weekKey]; if(!w) return null;
    var dd = w[day]; if(!dd) return null;
    return dd[mid] || null;
  }
  function setReaz(day, mid, stato, nota) {
    var w = Object.assign({}, feedback[weekKey] || {});
    var dd = Object.assign({}, w[day] || {});
    var cur = dd[mid] || {};
    var newStato = (cur.stato === stato && stato !== "modifica") ? null : stato;
    dd[mid] = {stato:newStato, nota:(nota !== undefined ? nota : (cur.nota || ""))};
    w[day] = dd;
    var nf = Object.assign({}, feedback); nf[weekKey] = w;
    setFeedback(nf);
  }
  function getOspRec(day) {
    var w = ospiti[weekKey]; var r = w && w[day];
    if(typeof r === "number") return {n:r, restr:[]};
    return r || {n:0, restr:[]};
  }
  function salvaOsp(day, rec) {
    var w = Object.assign({}, ospiti[weekKey] || {});
    w[day] = rec;
    var no = Object.assign({}, ospiti); no[weekKey] = w;
    setOspiti(no);
  }
  function setOspN(day, n) { var rec = getOspRec(day); salvaOsp(day, {n:Math.max(0,n), restr:rec.restr}); }
  function toggleRestr(day, id) {
    var rec = getOspRec(day); var arr = rec.restr.slice();
    var i = arr.indexOf(id); if(i>=0) arr.splice(i,1); else arr.push(id);
    salvaOsp(day, {n:rec.n, restr:arr});
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:8}}>
        <div style={{fontSize:23,fontWeight:800,letterSpacing:"-0.01em"}}>Menu</div>
        <span style={{fontSize:13,color:"#2F6586",fontWeight:700}}>
          <i className="ti ti-calendar" style={{verticalAlign:"-2px",marginRight:4}}/>{range}
        </span>
      </div>

      <button onClick={condividiMenu}
        style={{width:"100%",padding:"12px",borderRadius:14,border:"1.5px solid #6BA6C9",background:"#E2EEF5",
          color:"#2F6586",fontSize:14,fontWeight:700,cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
        <i className="ti ti-share" style={{fontSize:16}}/>Condividi il menu con la famiglia
      </button>
      {shareMsg&&<div style={{fontSize:12,color:"#2F6586",textAlign:"center",fontWeight:600}}>{shareMsg}</div>}

      {vals.length>0&&(
        <div>
          <div className="cap" style={{marginBottom:8}}>Vista: famiglia o singolo membro</div>
          <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:2}}>
            <button onClick={function(){ setMidSel(""); setEditDay(""); }}
              style={{display:"flex",alignItems:"center",gap:7,padding:"6px 12px 6px 6px",borderRadius:22,flexShrink:0,cursor:"pointer",
                border:"1.5px solid "+(midSel===""?"#2F6586":"#E3EAEE"),background:midSel===""?"#E2EEF5":"#fff",fontFamily:"'Nunito',system-ui,sans-serif"}}>
              <span style={{width:26,height:26,borderRadius:"50%",background:"#2F6586",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}><i className="ti ti-users"/></span>
              <span style={{fontSize:13,fontWeight:midSel===""?800:600,color:midSel===""?"#2F6586":"#2C3338"}}>Famiglia</span>
            </button>
            {vals.map(function(p){
              var on = mkey === p.id;
              return (
                <button key={p.id} onClick={function(){ setMidSel(p.id); setEditDay(""); }}
                  style={{display:"flex",alignItems:"center",gap:7,padding:"6px 12px 6px 6px",borderRadius:22,
                    flexShrink:0,cursor:"pointer",border:"1.5px solid "+(on?"#2F6586":"#E3EAEE"),
                    background:on?"#E2EEF5":"#fff",fontFamily:"'Nunito',system-ui,sans-serif"}}>
                  <span style={{width:26,height:26,borderRadius:"50%",background:p.colore||"#6BA6C9",color:"#fff",
                    display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800}}>
                    {p.nome ? p.nome.slice(0,1).toUpperCase() : "?"}
                  </span>
                  <span style={{fontSize:13,fontWeight:on?800:600,color:on?"#2F6586":"#2C3338"}}>{p.nome}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {DAYS.map(function(d, i){
        var data = new Date(lun.getTime()); data.setDate(lun.getDate()+i);
        var pranzo = nomePasto(d, "Pranzo");
        var cena = nomePasto(d, "Cena");
        var piatti = [pranzo, cena].filter(Boolean).join(" · ");
        var vuoto = !piatti;
        var mia = membro ? getReaz(d, mkey) : null;
        var miaStato = mia ? mia.stato : null;
        var altri = vals.filter(function(p){ var r = getReaz(d, p.id); return r && r.stato; });
        var osp = getOspRec(d); var nOsp = osp.n;
        return (
          <div key={d} className="mf-card" style={{padding:"13px 15px"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:vuoto?0:2}}>
              <div style={{width:40}}>
                <div style={{fontSize:14,fontWeight:800,color:vuoto?"#8A949B":"#2C3338"}}>{GIORNI_ABBR[i]}</div>
                <div style={{fontSize:11,color:"#8A949B"}}>{data.getDate()}</div>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:600,color:vuoto?"#8A949B":"#2C3338"}}>{vuoto ? "Da pianificare" : piatti}</div>
              </div>
              <button onClick={function(){ setTab("builder"); }}
                style={{border:"none",background:"transparent",color:"#2F6586",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:3}}>
                <i className="ti ti-pencil" style={{fontSize:14}}/>Modifica
              </button>
            </div>

            {membro&&(
              <div style={{display:"flex",gap:6,marginTop:10}}>
                {REAZIONI.map(function(rz){
                  var on = miaStato === rz.id;
                  return (
                    <button key={rz.id} onClick={function(){
                        if(rz.id==="modifica"){ setReaz(d, mkey, "modifica"); setEditDay(d); setNotaVal((mia&&mia.nota)||""); }
                        else { setReaz(d, mkey, rz.id); if(editDay===d) setEditDay(""); }
                      }}
                      style={{flex:1,padding:"8px 4px",borderRadius:11,cursor:"pointer",
                        border:"1.5px solid "+(on?rz.c:"#E3EAEE"),background:on?rz.bg:"#fff",
                        color:on?rz.c:"#8A949B",fontSize:12,fontWeight:on?800:600,
                        display:"flex",alignItems:"center",justifyContent:"center",gap:5,
                        fontFamily:"'Nunito',system-ui,sans-serif"}}>
                      <i className={"ti "+rz.ic} style={{fontSize:14}}/>{rz.l}
                    </button>
                  );
                })}
              </div>
            )}

            {membro&&miaStato==="modifica"&&editDay===d&&(
              <div style={{display:"flex",gap:6,marginTop:8}}>
                <input autoFocus placeholder="Cosa cambieresti?" value={notaVal}
                  onChange={function(e){ setNotaVal(e.target.value); }}
                  onKeyDown={function(e){ if(e.key==="Enter"){ setReaz(d, mkey, "modifica", notaVal.trim()); setEditDay(""); } }}
                  style={{flex:1,padding:"9px 11px",borderRadius:11,border:"1.5px solid #E3EAEE",fontSize:13,outline:"none",fontFamily:"'Nunito',system-ui,sans-serif"}}/>
                <button onClick={function(){ setReaz(d, mkey, "modifica", notaVal.trim()); setEditDay(""); }}
                  style={{padding:"9px 14px",borderRadius:11,border:"none",background:"#2F6586",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>OK</button>
              </div>
            )}

            <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #E3EAEE"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <i className="ti ti-users" style={{fontSize:16,color:nOsp>0?"#2F6586":"#B4BEC4"}}/>
                <span style={{flex:1,fontSize:12,fontWeight:600,color:nOsp>0?"#2F6586":"#8A949B"}}>
                  {nOsp>0 ? ("Ho ospiti: "+nOsp+" in più a tavola") : "Ho ospiti?"}
                </span>
                <button onClick={function(){ setOspN(d, nOsp-1); }} disabled={nOsp<=0}
                  style={{width:28,height:28,borderRadius:9,border:"1px solid #E3EAEE",background:"#fff",color:"#2F6586",fontSize:16,cursor:nOsp>0?"pointer":"default"}}>-</button>
                <span style={{minWidth:18,textAlign:"center",fontSize:14,fontWeight:800,color:"#2C3338"}}>{nOsp}</span>
                <button onClick={function(){ setOspN(d, nOsp+1); }}
                  style={{width:28,height:28,borderRadius:9,border:"none",background:"#6BA6C9",color:"#fff",fontSize:16,cursor:"pointer"}}>+</button>
              </div>
              {nOsp>0&&(
                <div style={{marginTop:8}}>
                  <div style={{fontSize:11,color:"#8A949B",marginBottom:6}}>Qualche ospite ha patologie o intolleranze?</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {GUEST_RESTR.map(function(rz){
                      var on = osp.restr.indexOf(rz.id) >= 0;
                      return (
                        <button key={rz.id} onClick={function(){ toggleRestr(d, rz.id); }}
                          style={{padding:"5px 10px",borderRadius:20,fontSize:11,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif",
                            border:"1.5px solid "+(on?"#2F6586":"#E3EAEE"),background:on?"#E2EEF5":"#fff",
                            color:on?"#2F6586":"#8A949B",fontWeight:on?700:500}}>
                          {rz.l}
                        </button>
                      );
                    })}
                  </div>
                  {osp.restr.length>0&&(
                    <div style={{marginTop:8,background:"#F6ECD9",border:"1px solid #E8D5AE",borderRadius:10,padding:"8px 10px",
                      display:"flex",alignItems:"flex-start",gap:7}}>
                      <i className="ti ti-alert-triangle" style={{fontSize:14,color:"#8A5A12",marginTop:1}}/>
                      <span style={{flex:1,fontSize:11,color:"#8A5A12",lineHeight:1.4}}>
                        Prevedi un'alternativa: {osp.restr.map(restrLabel).join(", ")}. Tocca <b>Modifica</b> per adattare il pasto.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {altri.length>0&&(
              <div style={{display:"flex",flexDirection:"column",gap:4,marginTop:10,paddingTop:10,borderTop:"1px solid #E3EAEE"}}>
                {altri.map(function(p){
                  var r = getReaz(d, p.id); var rz = reazById(r.stato);
                  return (
                    <div key={p.id} style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{width:20,height:20,borderRadius:"50%",background:p.colore||"#6BA6C9",color:"#fff",
                        display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,flexShrink:0}}>
                        {p.nome ? p.nome.slice(0,1).toUpperCase() : "?"}
                      </span>
                      <span style={{fontSize:12,color:"#2C3338",fontWeight:600}}>{p.nome}</span>
                      <span style={{fontSize:11,fontWeight:800,color:rz?rz.c:"#8A949B"}}>{rz?rz.l:""}</span>
                      {r.nota&&<span style={{fontSize:11,color:"#8A949B",fontStyle:"italic",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>· {r.nota}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div className="mf-card acc" onClick={function(){ setTab("ai"); }}
        style={{display:"flex",alignItems:"center",gap:12,cursor:"pointer"}}>
        <i className="ti ti-sparkles" style={{fontSize:19}}/>
        <div style={{flex:1,fontSize:13}}>Completa la settimana con un menu bilanciato (AI)</div>
        <i className="ti ti-arrow-right"/>
      </div>
    </div>
  );
}

var ICONE_PASTO = {Colazione:"ti-coffee", Spuntino:"ti-apple", Pranzo:"ti-tools-kitchen-2", Merenda:"ti-apple", Cena:"ti-soup"};

function kcalPastoAdulto(id) {
  var p = DB_PASTI[id];
  if(p && p.adulto && typeof p.adulto.kcal === "number") return p.adulto.kcal;
  return 0;
}

var PORZ_STD = {pasta:80,riso:80,cereali:70,tuberi:180,pane:60,colazione:50,
  "carne bianca":150,"carne rossa":150,pesce:150,uova:120,legumi:200,latticini:100,
  verdura:150,frutta:120};

function porzioneStdIng(it, fallback) {
  if(it && PORZ_STD[it.cat]) return PORZ_STD[it.cat];
  return fallback || 100;
}
function grammiField(scelta, field, it, fallback) {
  var g = scelta && scelta.grammi ? scelta.grammi[field] : null;
  var n = parseInt(g, 10);
  if(!isNaN(n) && n > 0) return n;
  return porzioneStdIng(it, fallback);
}

var ALIMENTI_CUSTOM = [];
function ingById(id) {
  var all = CARBOIDRATI.concat(PROTEINE).concat(VERDURE).concat(FRUTTA).concat(SALSE).concat(GRASSI).concat(ALIMENTI_CUSTOM);
  return all.find(function(x){ return x.id === id; });
}

function valoriPastoBuilder(scelta) {
  if(!scelta) return null;
  if(scelta.piattoUnico && scelta.piattoUnico.nome && ("" + scelta.piattoUnico.nome).trim()) {
    var pu = scelta.piattoUnico;
    return {nome: ("" + pu.nome).trim(), kcal: parseInt(pu.kcal, 10) || 0, prot: parseInt(pu.prot, 10) || 0};
  }
  var campi = [["carbo",0],["proteina",0],["verdura",150],["verdura2",150],["frutta",120],["latticino",100]];
  var nomi = []; var kcal = 0; var prot = 0;
  campi.forEach(function(c){
    var id = scelta[c[0]];
    if(!id) return;
    var it = ingById(id);
    if(!it || !it.kcal_p) return;
    var g = grammiField(scelta, c[0], it, c[1]);
    kcal += Math.round(it.kcal_p * g / 100);
    prot += Math.round((it.prot_p || 0) * g / 100);
    nomi.push(it.nome);
  });
  if(!nomi.length) return null;
  return {nome:nomi.join(", "), kcal:kcal, prot:prot};
}

function pastoUnificato(builder, menu, giorno, pasto) {
  var b = (builder || {})[giorno + "-" + pasto];
  var vb = valoriPastoBuilder(b);
  if(vb) return {nome:vb.nome, kcal:vb.kcal, prot:vb.prot, fonte:"builder"};
  var cell = (menu || {})[giorno + "-" + pasto];
  if(cell && cell.pastoId && DB_PASTI[cell.pastoId]) return {nome:DB_PASTI[cell.pastoId].nome, kcal:kcalPastoAdulto(cell.pastoId), prot:0, fonte:"menu"};
  return null;
}

function IscrittiView(props) {
  var setTab = props.setTab || function(){};
  var s_lista = useState([]); var lista = s_lista[0]; var setLista = s_lista[1];
  var s_load = useState(true); var loading = s_load[0]; var setLoading = s_load[1];
  var s_err = useState(""); var err = s_err[0]; var setErr = s_err[1];

  function carica() {
    setLoading(true); setErr("");
    supabase.from("iscritti").select("*").order("created_at", {ascending:false}).then(function(rows){
      if(rows && rows.length) setLista(rows);
      else setLista([]);
      setLoading(false);
    }, function(e){ setErr("Errore di caricamento (controlla che la tabella iscritti esista)"); setLoading(false); });
  }

  useEffect(function(){ carica(); }, []);

  function dataFmt(s) {
    if(!s) return "";
    var d = new Date(s);
    if(isNaN(d.getTime())) return "";
    return d.toLocaleDateString("it-IT") + " " + d.toLocaleTimeString("it-IT", {hour:"2-digit", minute:"2-digit"});
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:8}}>
        <div style={{fontSize:23,fontWeight:800,letterSpacing:"-0.01em"}}>Iscritti</div>
        <i className="ti ti-refresh" onClick={carica} style={{fontSize:19,color:"#2F6586",cursor:"pointer"}}/>
      </div>

      {loading&&<div style={{textAlign:"center",color:"#8A949B",fontSize:13}}>Caricamento...</div>}
      {err&&!loading&&(
        <div style={{fontSize:13,color:"#C2355A",background:"#FBE7EC",borderRadius:12,padding:"12px"}}>{err}</div>
      )}

      {!loading&&!err&&(
        <div style={{fontSize:13,color:"#8A949B"}}>{lista.length} utenti registrati</div>
      )}

      {!loading&&!err&&lista.length>0&&(
        <div className="mf-card flush">
          {lista.map(function(r, i){
            return (
              <div key={r.id || i} className="mf-row">
                <div className="mf-ic"><i className="ti ti-user"/></div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.email}</div>
                  <div style={{fontSize:11,color:"#8A949B"}}>{dataFmt(r.created_at)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading&&!err&&lista.length===0&&(
        <div className="mf-card" style={{textAlign:"center",color:"#8A949B",fontSize:13}}>
          Nessun iscritto ancora.
        </div>
      )}
    </div>
  );
}

function PiramideView() {
  var bande = [
    {w:30,  bg:"#2F6586", col:"#fff",     t:"Dolci - raramente"},
    {w:48,  bg:"#6BA6C9", col:"#fff",     t:"Grassi buoni - 2 porzioni"},
    {w:66,  bg:"#AFCDDD", col:"#2F6586",  t:"Proteine - 2 porzioni"},
    {w:84,  bg:"#CFE0EA", col:"#2F6586",  t:"Cereali integrali - 4 porzioni"},
    {w:100, bg:"#E2EEF5", col:"#2F6586",  t:"Frutta e verdura - 5 porzioni"}
  ];
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{paddingTop:8}}>
        <div style={{fontSize:23,fontWeight:800,letterSpacing:"-0.01em"}}>Piramide alimentare</div>
        <div style={{fontSize:13,color:"#8A949B",marginTop:1}}>Porzioni consigliate al giorno</div>
      </div>
      <div className="mf-card" style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,padding:"18px 14px"}}>
        {bande.map(function(b){
          return (
            <div key={b.t} style={{width:b.w+"%",borderRadius:10,textAlign:"center",fontWeight:600,
              fontSize:13,padding:"10px 0",color:b.col,background:b.bg}}>{b.t}</div>
          );
        })}
      </div>
      <div className="mf-card acc" style={{display:"flex",alignItems:"center",gap:11}}>
        <i className="ti ti-walk" style={{fontSize:19}}/>
        <div style={{flex:1,fontSize:13}}>Base quotidiana: acqua e movimento</div>
      </div>
      <div className="mf-card" style={{display:"flex",alignItems:"center",gap:11}}>
        <i className="ti ti-bulb" style={{fontSize:19,color:"#6BA6C9"}}/>
        <div style={{flex:1,fontSize:13}}>Punta a 5 porzioni di frutta e verdura ogni giorno</div>
      </div>
    </div>
  );
}

// OMS peso-per-eta, valori LMS ufficiali (0-60 mesi = WHO Child Growth Standards; 6-10 anni = WHO 2007). m = mesi.
var WHO_WFA_M = [
  {m:0,L:0.3487,M:3.3464,S:0.14602},{m:1,L:0.2297,M:4.4709,S:0.13395},{m:2,L:0.197,M:5.5675,S:0.12385},
  {m:3,L:0.1738,M:6.3762,S:0.11727},{m:4,L:0.1553,M:7.0023,S:0.11316},{m:5,L:0.1395,M:7.5105,S:0.1108},
  {m:6,L:0.1257,M:7.934,S:0.10958},{m:7,L:0.1134,M:8.297,S:0.10902},{m:8,L:0.1021,M:8.6151,S:0.10882},
  {m:9,L:0.0917,M:8.9014,S:0.10881},{m:10,L:0.082,M:9.1649,S:0.10891},{m:11,L:0.073,M:9.4122,S:0.10906},
  {m:12,L:0.0644,M:9.6479,S:0.10925},{m:13,L:0.0563,M:9.8749,S:0.10949},{m:14,L:0.0487,M:10.0953,S:0.10976},
  {m:15,L:0.0413,M:10.3108,S:0.11007},{m:16,L:0.0343,M:10.5228,S:0.11041},{m:17,L:0.0275,M:10.7319,S:0.11079},
  {m:18,L:0.0211,M:10.9385,S:0.11119},{m:19,L:0.0148,M:11.143,S:0.11164},{m:20,L:0.0087,M:11.3462,S:0.11211},
  {m:21,L:0.0029,M:11.5486,S:0.11261},{m:22,L:-0.0028,M:11.7504,S:0.11314},{m:23,L:-0.0083,M:11.9514,S:0.11369},
  {m:24,L:-0.0137,M:12.1515,S:0.11426},{m:30,L:-0.0431,M:13.3,S:0.11781},{m:36,L:-0.0689,M:14.3429,S:0.12116},
  {m:42,L:-0.092,M:15.3486,S:0.12425},{m:48,L:-0.1131,M:16.3489,S:0.12759},{m:54,L:-0.1325,M:17.3452,S:0.13133},
  {m:60,L:-0.1506,M:18.3366,S:0.13517},{m:72,L:-0.6288,M:20.2734,S:0.14859},{m:84,L:-0.9268,M:22.4638,S:0.1587},
  {m:96,L:-1.1602,M:25.017,S:0.16702},{m:108,L:-1.3172,M:28.1216,S:0.17362},{m:120,L:-1.3901,M:31.4327,S:0.17766}
];
var WHO_WFA_F = [
  {m:0,L:0.3809,M:3.2322,S:0.14171},{m:1,L:0.1714,M:4.1873,S:0.13724},{m:2,L:0.0962,M:5.1282,S:0.13},
  {m:3,L:0.0402,M:5.8458,S:0.12619},{m:4,L:-0.005,M:6.4237,S:0.12402},{m:5,L:-0.043,M:6.8985,S:0.12274},
  {m:6,L:-0.0756,M:7.297,S:0.12204},{m:7,L:-0.1039,M:7.6422,S:0.12178},{m:8,L:-0.1288,M:7.9487,S:0.12181},
  {m:9,L:-0.1507,M:8.2254,S:0.12199},{m:10,L:-0.17,M:8.48,S:0.12223},{m:11,L:-0.1872,M:8.7192,S:0.12247},
  {m:12,L:-0.2024,M:8.9481,S:0.12268},{m:13,L:-0.2158,M:9.1699,S:0.12283},{m:14,L:-0.2278,M:9.387,S:0.12294},
  {m:15,L:-0.2384,M:9.6008,S:0.12299},{m:16,L:-0.2478,M:9.8124,S:0.12303},{m:17,L:-0.2562,M:10.0226,S:0.12306},
  {m:18,L:-0.2637,M:10.2315,S:0.12309},{m:19,L:-0.2703,M:10.4393,S:0.12315},{m:20,L:-0.2762,M:10.6464,S:0.12323},
  {m:21,L:-0.2815,M:10.8534,S:0.12335},{m:22,L:-0.2862,M:11.0608,S:0.1235},{m:23,L:-0.2903,M:11.2688,S:0.12369},
  {m:24,L:-0.2941,M:11.4775,S:0.1239},{m:30,L:-0.3101,M:12.7055,S:0.12587},{m:36,L:-0.3201,M:13.8503,S:0.12919},
  {m:42,L:-0.3283,M:14.9727,S:0.13376},{m:48,L:-0.3361,M:16.0697,S:0.13884},{m:54,L:-0.344,M:17.1551,S:0.14371},
  {m:60,L:-0.3518,M:18.2193,S:0.14821},{m:72,L:-0.8886,M:19.6363,S:0.16942},{m:84,L:-1.0577,M:21.8446,S:0.17505},
  {m:96,L:-1.1726,M:24.842,S:0.17999},{m:108,L:-1.2342,M:28.4593,S:0.18272},{m:120,L:-1.2549,M:32.167,S:0.18327}
];

function normalCDF(z) {
  var t = 1 / (1 + 0.2316419 * Math.abs(z));
  var d = 0.3989423 * Math.exp(-z * z / 2);
  var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

function lmsInterp(tab, m) {
  if(m <= tab[0].m) return tab[0];
  if(m >= tab[tab.length-1].m) return tab[tab.length-1];
  for(var i = 0; i < tab.length - 1; i++) {
    if(m >= tab[i].m && m <= tab[i+1].m) {
      var lo = tab[i]; var hi = tab[i+1];
      var f = (m - lo.m) / (hi.m - lo.m);
      return {L: lo.L + (hi.L - lo.L) * f, M: lo.M + (hi.M - lo.M) * f, S: lo.S + (hi.S - lo.S) * f};
    }
  }
  return tab[tab.length-1];
}

function percentilePeso(sesso, etaMesi, pesoKg) {
  if(!pesoKg || !(pesoKg > 0)) return null;
  if(etaMesi == null || etaMesi < 0 || etaMesi > 126) return null;
  var tab = (sesso === "maschio" || sesso === "M" || sesso === "m") ? WHO_WFA_M : WHO_WFA_F;
  var l = lmsInterp(tab, etaMesi);
  var z = l.L !== 0 ? (Math.pow(pesoKg / l.M, l.L) - 1) / (l.L * l.S) : Math.log(pesoKg / l.M) / l.S;
  var perc = normalCDF(z) * 100;
  if(perc < 0.1) perc = 0.1;
  if(perc > 99.9) perc = 99.9;
  var banda; var colore;
  if(perc < 3) { banda = "sotto la media"; colore = "#8A5A12"; }
  else if(perc < 15) { banda = "norma bassa"; colore = "#2F6586"; }
  else if(perc <= 85) { banda = "nella media"; colore = "#2F6586"; }
  else if(perc <= 97) { banda = "sopra la media"; colore = "#2F6586"; }
  else { banda = "sopra la media alta"; colore = "#8A5A12"; }
  return {perc: perc, banda: banda, colore: colore, z: z};
}

function GraficoPeso(props) {
  var dati = props.dati || [];
  if(dati.length < 2) return null;
  var ultimi = dati.slice(-12);
  var valori = ultimi.map(function(d){ return d.valore; });
  var minV = Math.min.apply(null, valori) - 0.4;
  var maxV = Math.max.apply(null, valori) + 0.4;
  var W = 280; var H = 78; var PAD = 6;
  function xPx(i){ return PAD + (i / (ultimi.length - 1)) * (W - PAD * 2); }
  function yPx(v){ return PAD + (1 - (v - minV) / (maxV - minV || 1)) * (H - PAD * 2); }
  var punti = ultimi.map(function(d,i){ return xPx(i) + "," + yPx(d.valore); }).join(" ");
  var col = props.colore || "#2F6586";
  return (
    <svg width="100%" viewBox={"0 0 " + W + " " + H} style={{display:"block",overflow:"visible"}}>
      <polyline points={punti} fill="none" stroke={col} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {ultimi.map(function(d,i){
        return <circle key={i} cx={xPx(i)} cy={yPx(d.valore)} r="3" fill="#fff" stroke={col} strokeWidth="2"/>;
      })}
    </svg>
  );
}

var GIORNI7 = ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];
var PASTI_PIANO = {
  mensa: [{id:"pranzo", l:"Pranzo"}],
  membro: [{id:"colazione", l:"Colazione"}, {id:"pranzo", l:"Pranzo"}, {id:"spuntino", l:"Spuntino"}, {id:"cena", l:"Cena"}]
};
function pianoSettimane(cadenza) { return cadenza === "mensile" ? [1,2,3,4] : [1]; }
function pianoGiorni(tipo) { return tipo === "mensa" ? GIORNI7.slice(0,5) : GIORNI7; }
function settimanaPianoNum(pl, dataRef) {
  if(pl.cadenza !== "mensile" || !pl.correnteMonday || !pl.correnteNum) return 1;
  var base = lunediDi(new Date(pl.correnteMonday + "T00:00:00"));
  var cur = lunediDi(dataRef || new Date());
  var weeks = Math.round((cur.getTime() - base.getTime()) / (7*24*3600*1000));
  return (((pl.correnteNum - 1 + weeks) % 4) + 4) % 4 + 1;
}
function PianiView(props) {
  var piani = (props.piani && props.piani.lista) ? props.piani.lista : [];
  var setPiani = props.setPiani || function(){};
  var profili = props.profili || {};
  var sSel = useState(null); var selId = sSel[0]; var setSelId = sSel[1];
  var sW = useState(1); var sett = sW[0]; var setSett = sW[1];
  var sG = useState("Lun"); var giorno = sG[0]; var setGiorno = sG[1];
  var sAdd = useState(false); var adding = sAdd[0]; var setAdding = sAdd[1];

  function salva(lista) { setPiani({lista: lista}); }
  function updatePiano(id, fn) {
    salva(piani.map(function(pl){ if(pl.id !== id) return pl; var np = Object.assign({}, pl); fn(np); return np; }));
  }
  function aggiungiPiano(tipo, membroId) {
    var id = "pl_" + piani.length + "_" + Date.now();
    var titolo = tipo === "mensa" ? "Mensa" : ((profili[membroId] && profili[membroId].nome) || "Membro");
    var pl = {id:id, tipo:tipo, membroId:(membroId||null), titolo:titolo, cadenza:"settimanale", correnteNum:1, correnteMonday:isoDay(lunediDi(new Date())), settimane:{}};
    salva(piani.concat([pl]));
    setAdding(false); setSelId(id); setSett(1); setGiorno("Lun");
  }
  function rimuoviPiano(id) { salva(piani.filter(function(p){ return p.id !== id; })); setSelId(null); }
  function setCadenza(pl, cad) { updatePiano(pl.id, function(np){ np.cadenza = cad; if(cad === "mensile" && !np.correnteMonday){ np.correnteMonday = isoDay(lunediDi(new Date())); np.correnteNum = 1; } }); setSett(1); }
  function setCorrente(pl, n) { updatePiano(pl.id, function(np){ np.correnteNum = n; np.correnteMonday = isoDay(lunediDi(new Date())); }); }
  function setPasto(pl, wk, g, pastoId, val) {
    updatePiano(pl.id, function(np){
      var sw = Object.assign({}, np.settimane || {});
      var w = Object.assign({giorni:{}}, sw[wk] || {}); w.giorni = Object.assign({}, w.giorni || {});
      var d = Object.assign({}, w.giorni[g] || {}); d[pastoId] = val; w.giorni[g] = d;
      sw[wk] = w; np.settimane = sw;
    });
  }
  function tipoIcona(pl) { return pl.tipo === "mensa" ? "ti-school" : "ti-salad"; }
  function tipoColore(pl) { return pl.tipo === "mensa" ? "#6BA6C9" : ((pl.membroId && profili[pl.membroId] && profili[pl.membroId].colore) || "#2F6586"); }

  var sel = null;
  piani.forEach(function(pl){ if(pl.id === selId) sel = pl; });

  if(sel) {
    var pasti = PASTI_PIANO[sel.tipo] || PASTI_PIANO.membro;
    var giorni = pianoGiorni(sel.tipo);
    var settimane = pianoSettimane(sel.cadenza);
    var wkData = (sel.settimane || {})[sett] || {giorni:{}};
    var dayData = (wkData.giorni || {})[giorno] || {};
    var oggiNum = settimanaPianoNum(sel, new Date());
    return (
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div onClick={function(){ setSelId(null); }} style={{display:"flex",alignItems:"center",gap:6,color:"#2F6586",fontSize:14,fontWeight:700,cursor:"pointer",paddingTop:4}}>
          <i className="ti ti-chevron-left" style={{fontSize:18}}/>Menu e diete
        </div>
        <div style={{display:"flex",alignItems:"center",gap:11}}>
          <div style={{width:40,height:40,borderRadius:12,background:tipoColore(sel),color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}><i className={"ti "+tipoIcona(sel)}/></div>
          <div style={{flex:1}}>
            <div style={{fontSize:19,fontWeight:800}}>{sel.titolo}</div>
            <div style={{fontSize:12,color:"#8A949B"}}>{sel.tipo === "mensa" ? "Menu mensa" : "Dieta del membro"}</div>
          </div>
        </div>

        <div style={{display:"flex",background:"#E2EEF5",borderRadius:12,padding:4}}>
          {[{id:"settimanale",l:"Settimanale"},{id:"mensile",l:"Mensile (4 sett.)"}].map(function(c){
            var on = sel.cadenza === c.id;
            return <button key={c.id} onClick={function(){ setCadenza(sel, c.id); }}
              style={{flex:1,border:"none",background:on?"#fff":"transparent",color:on?"#2F6586":"#8A949B",fontFamily:"'Nunito',system-ui,sans-serif",
                fontSize:13,fontWeight:700,padding:"8px 0",borderRadius:9,cursor:"pointer",boxShadow:on?"0 1px 4px rgba(20,40,55,.1)":"none"}}>{c.l}</button>;
          })}
        </div>

        {sel.cadenza === "mensile" && (
          <div className="mf-card" style={{display:"flex",flexDirection:"column",gap:10}}>
            <div className="cap">Questa settimana è la numero</div>
            <div style={{display:"flex",gap:8}}>
              {[1,2,3,4].map(function(n){
                var on = oggiNum === n;
                return <button key={n} onClick={function(){ setCorrente(sel, n); }}
                  style={{flex:1,border:"1.5px solid "+(on?"#2F6586":"#E3EAEE"),background:on?"#2F6586":"#fff",color:on?"#fff":"#2C3338",
                    borderRadius:12,padding:"10px 0",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif"}}>{n}</button>;
              })}
            </div>
          </div>
        )}

        {sel.cadenza === "mensile" && (
          <div style={{display:"flex",gap:8}}>
            {settimane.map(function(n){
              var on = sett === n;
              return <button key={n} onClick={function(){ setSett(n); }}
                style={{flex:1,border:"1.5px solid "+(on?"#6BA6C9":"#E3EAEE"),background:on?"#E2EEF5":"#fff",color:on?"#2F6586":"#8A949B",
                  borderRadius:12,padding:"9px 0",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif"}}>Sett. {n}</button>;
            })}
          </div>
        )}

        <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
          {giorni.map(function(g){
            var on = giorno === g;
            return <button key={g} onClick={function(){ setGiorno(g); }}
              style={{border:"1.5px solid "+(on?"#2F6586":"#E3EAEE"),background:on?"#2F6586":"#fff",color:on?"#fff":"#8A949B",
                borderRadius:20,padding:"7px 13px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif"}}>{g}</button>;
          })}
        </div>

        <div className="mf-card" style={{display:"flex",flexDirection:"column",gap:11}}>
          <div className="cap">{giorno}{sel.cadenza === "mensile" ? (" · Settimana " + sett) : ""}</div>
          {pasti.map(function(pt){
            return (
              <div key={pt.id}>
                <div style={{fontSize:11,color:"#8A949B",fontWeight:700,marginBottom:4}}>{pt.l}</div>
                <input value={dayData[pt.id] || ""} onChange={function(e){ setPasto(sel, sett, giorno, pt.id, e.target.value); }}
                  placeholder={sel.tipo === "mensa" ? "Es. Pasta al pomodoro + pollo" : "Es. Yogurt greco + avena + frutta"}
                  style={{width:"100%",boxSizing:"border-box",padding:"10px 12px",borderRadius:12,border:"1.5px solid #E3EAEE",fontSize:14,outline:"none",fontFamily:"'Nunito',system-ui,sans-serif"}}/>
              </div>
            );
          })}
        </div>

        <button onClick={function(){ if(window.confirm("Eliminare questo piano?")) rimuoviPiano(sel.id); }}
          style={{border:"none",background:"transparent",color:"#C2355A",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"4px 0"}}>
          <i className="ti ti-trash" style={{fontSize:15}}/>Elimina piano
        </button>
      </div>
    );
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div>
        <div style={{fontSize:23,fontWeight:800,letterSpacing:"-0.01em",paddingTop:8}}>Menu e diete</div>
        <div style={{fontSize:13,color:"#8A949B"}}>Menu fissi: mensa o la dieta di un membro. Settimanale o mensile.</div>
      </div>

      {piani.length === 0 && !adding && (
        <div className="mf-card" style={{fontSize:13,color:"#8A949B"}}>Nessun piano ancora. Aggiungine uno qui sotto.</div>
      )}

      {piani.map(function(pl){
        var gg = pianoGiorni(pl.tipo);
        var quanti = 0;
        pianoSettimane(pl.cadenza).forEach(function(n){ var w = (pl.settimane||{})[n]; if(w && w.giorni){ gg.forEach(function(g){ var d = w.giorni[g]; if(d && Object.keys(d).some(function(k){ return d[k]; })) quanti++; }); } });
        return (
          <div key={pl.id} className="mf-card" onClick={function(){ setSelId(pl.id); setSett(1); setGiorno("Lun"); }} style={{display:"flex",alignItems:"center",gap:11,cursor:"pointer"}}>
            <div style={{width:38,height:38,borderRadius:11,background:tipoColore(pl),color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}><i className={"ti "+tipoIcona(pl)}/></div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:15,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pl.titolo}</div>
              <div style={{fontSize:11,color:"#8A949B"}}>{(pl.tipo === "mensa" ? "Mensa" : "Dieta")} · {pl.cadenza === "mensile" ? "mensile" : "settimanale"} · {quanti} giorni</div>
            </div>
            <i className="ti ti-chevron-right" style={{color:"#B4BEC4",fontSize:18}}/>
          </div>
        );
      })}

      {adding ? (
        <div className="mf-card" style={{display:"flex",flexDirection:"column",gap:9}}>
          <div className="cap">Cosa vuoi aggiungere</div>
          <button onClick={function(){ aggiungiPiano("mensa", null); }}
            style={{display:"flex",alignItems:"center",gap:10,border:"1.5px solid #E3EAEE",background:"#fff",borderRadius:12,padding:"11px 12px",cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif",textAlign:"left"}}>
            <div style={{width:34,height:34,borderRadius:10,background:"#6BA6C9",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}><i className="ti ti-school"/></div>
            <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700}}>Menu mensa</div><div style={{fontSize:11,color:"#8A949B"}}>Pranzo, Lun–Ven</div></div>
          </button>
          {Object.keys(profili).map(function(pid){
            var p = profili[pid];
            return (
              <button key={pid} onClick={function(){ aggiungiPiano("membro", pid); }}
                style={{display:"flex",alignItems:"center",gap:10,border:"1.5px solid #E3EAEE",background:"#fff",borderRadius:12,padding:"11px 12px",cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif",textAlign:"left"}}>
                <div style={{width:34,height:34,borderRadius:10,background:p.colore||"#2F6586",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800}}>{p.nome ? p.nome.slice(0,1).toUpperCase() : "?"}</div>
                <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700}}>Dieta di {p.nome}</div><div style={{fontSize:11,color:"#8A949B"}}>Colazione, pranzo, spuntino, cena</div></div>
              </button>
            );
          })}
          <button onClick={function(){ setAdding(false); }} style={{border:"none",background:"transparent",color:"#8A949B",fontSize:13,fontWeight:700,cursor:"pointer",padding:"4px 0"}}>Annulla</button>
        </div>
      ) : (
        <button onClick={function(){ setAdding(true); }}
          style={{padding:"12px",borderRadius:13,border:"1.5px dashed #6BA6C9",background:"#fff",color:"#2F6586",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
          <i className="ti ti-plus" style={{fontSize:17}}/>Aggiungi un menu o una dieta
        </button>
      )}

      <div className="mf-card acc" style={{display:"flex",alignItems:"flex-start",gap:10,fontSize:12}}>
        <i className="ti ti-pencil" style={{fontSize:18,flexShrink:0,marginTop:1}}/>
        <div>Si compila a mano. Se hai la foto del menu o della dieta, la tieni sul telefono e ricopi i giorni qui.</div>
      </div>
    </div>
  );
}

function avatarU(u, size) {
  var s = size || 38;
  var n = (u && (u.nome || u.username)) || "?";
  return (
    <div style={{width:s,height:s,borderRadius:"50%",background:"#6BA6C9",color:"#fff",flexShrink:0,
      display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:Math.round(s*0.4)}}>
      {n.slice(0,1).toUpperCase()}
    </div>
  );
}
function AmiciView(props) {
  var userId = props.userId;
  var familyId = props.familyId;

  var sMe = useState(null); var me = sMe[0]; var setMe = sMe[1];
  var sLoad = useState(false); var caricato = sLoad[0]; var setCaricato = sLoad[1];
  var sUname = useState(""); var uname = sUname[0]; var setUname = sUname[1];
  var sNome = useState(""); var nomeInp = sNome[0]; var setNomeInp = sNome[1];
  var sMsg = useState(""); var msg = sMsg[0]; var setMsg = sMsg[1];
  var sQ = useState(""); var q = sQ[0]; var setQ = sQ[1];
  var sRis = useState([]); var risultati = sRis[0]; var setRisultati = sRis[1];
  var sAmici = useState([]); var amici = sAmici[0]; var setAmici = sAmici[1];
  var sRic = useState([]); var ricevute = sRic[0]; var setRicevute = sRic[1];
  var sInv = useState([]); var inviate = sInv[0]; var setInviate = sInv[1];

  function flash(t){ setMsg(t); setTimeout(function(){ setMsg(""); }, 2600); }

  function caricaMe() {
    if(!userId) { setCaricato(true); return; }
    supabase.from("utenti").select("*").eq("user_id", userId).then(function(rows){
      var r = (rows && rows.length) ? rows[0] : null;
      setMe(r); if(r){ setUname(r.username||""); setNomeInp(r.nome||""); }
      setCaricato(true);
    }, function(){ setCaricato(true); });
  }
  function caricaAmicizie() {
    if(!userId) return;
    supabase.from("amicizie").select("*").or("richiedente.eq."+userId+",destinatario.eq."+userId).then(function(rows){
      rows = rows || [];
      var altri = [];
      rows.forEach(function(a){ var o = a.richiedente===userId ? a.destinatario : a.richiedente; if(altri.indexOf(o)<0) altri.push(o); });
      if(!altri.length){ setAmici([]); setRicevute([]); setInviate([]); return; }
      supabase.from("utenti").select("*").in("user_id", altri).then(function(us){
        var mapU = {}; (us||[]).forEach(function(u){ mapU[u.user_id]=u; });
        var am=[], ric=[], inv=[];
        rows.forEach(function(a){
          var o = a.richiedente===userId ? a.destinatario : a.richiedente;
          var info = Object.assign({}, a, {utente: mapU[o] || {username:"?", user_id:o}});
          if(a.stato==="accettata") am.push(info);
          else if(a.destinatario===userId) ric.push(info);
          else inv.push(info);
        });
        setAmici(am); setRicevute(ric); setInviate(inv);
      });
    });
  }
  useEffect(function(){ caricaMe(); caricaAmicizie(); }, [userId]);

  function salvaUsername() {
    var u = (""+uname).toLowerCase().replace(/[^a-z0-9_]/g, "");
    if(u.length < 3) { flash("Il nome utente deve avere almeno 3 caratteri (lettere, numeri, _)."); return; }
    supabase.from("utenti").select("user_id").eq("username", u).then(function(rows){
      if(rows && rows.length && rows[0].user_id !== userId) { flash("Nome utente già preso, scegline un altro."); return; }
      supabase.from("utenti").upsert({user_id:userId, username:u, nome:(nomeInp||"").trim(), family_id:familyId}, {onConflict:"user_id"}).then(function(res){
        if(res && res.length){ setMe(res[0]); flash("Fatto! Ora ti trovano come @"+u); }
        else { caricaMe(); flash("Salvato."); }
      }, function(){ flash("Errore nel salvataggio. Riprova."); });
    });
  }

  function cerca(val) {
    setQ(val);
    var u = (""+val).toLowerCase().trim();
    if(u.length < 2) { setRisultati([]); return; }
    supabase.from("utenti").select("*").ilike("username", "%"+u+"%").neq("user_id", userId).limit(15).then(function(rows){
      setRisultati(rows || []);
    });
  }
  function statoCon(uid) {
    var r = null;
    amici.forEach(function(a){ if(a.utente.user_id===uid) r = "amico"; });
    inviate.forEach(function(a){ if(a.destinatario===uid) r = "inviata"; });
    ricevute.forEach(function(a){ if(a.richiedente===uid) r = "ricevuta"; });
    return r;
  }
  function aggiungi(uid) {
    supabase.from("amicizie").insert({richiedente:userId, destinatario:uid, stato:"in_attesa"}).then(function(){ flash("Richiesta inviata."); caricaAmicizie(); }, function(){ flash("Non è stato possibile inviare la richiesta."); });
  }
  function accetta(a) { supabase.from("amicizie").update({stato:"accettata"}).eq("id", a.id).then(function(){ flash("Ora siete amici!"); caricaAmicizie(); }); }
  function elimina(a) { supabase.from("amicizie").delete().eq("id", a.id).then(function(){ caricaAmicizie(); }); }

  if(!userId) {
    return (
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{fontSize:23,fontWeight:800,letterSpacing:"-0.01em",paddingTop:8}}>Amici</div>
        <div className="mf-card" style={{fontSize:13,color:"#8A949B"}}>Accedi con il tuo account per aggiungere amici.</div>
      </div>
    );
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div>
        <div style={{fontSize:23,fontWeight:800,letterSpacing:"-0.01em",paddingTop:8}}>Amici</div>
        <div style={{fontSize:13,color:"#8A949B"}}>Trovati per nome utente e organizzate una cena insieme.</div>
      </div>

      {!caricato ? (
        <div className="mf-card" style={{fontSize:13,color:"#8A949B"}}>Carico…</div>
      ) : !me ? (
        <div className="mf-card" style={{display:"flex",flexDirection:"column",gap:11}}>
          <div className="cap">Scegli il tuo nome utente</div>
          <div style={{fontSize:12,color:"#8A949B"}}>È il nome con cui i tuoi amici ti trovano. Solo lettere, numeri e _.</div>
          <div style={{display:"flex",alignItems:"center",gap:8,border:"1.5px solid #E3EAEE",borderRadius:12,padding:"0 12px"}}>
            <span style={{color:"#8A949B",fontWeight:800}}>@</span>
            <input value={uname} onChange={function(e){ setUname(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,"")); }}
              placeholder="es. marlene" style={{flex:1,border:"none",outline:"none",padding:"11px 0",fontSize:15,fontWeight:700,fontFamily:"'Nunito',system-ui,sans-serif",background:"transparent"}}/>
          </div>
          <input value={nomeInp} onChange={function(e){ setNomeInp(e.target.value); }}
            placeholder="Nome visibile (facoltativo)" style={{padding:"11px 12px",borderRadius:12,border:"1.5px solid #E3EAEE",fontSize:14,outline:"none",fontFamily:"'Nunito',system-ui,sans-serif"}}/>
          <button onClick={salvaUsername} style={{border:"none",background:"#2F6586",color:"#fff",borderRadius:12,padding:"12px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif"}}>Salva nome utente</button>
          {msg && <div style={{fontSize:12,color:"#2F6586",fontWeight:600}}>{msg}</div>}
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div className="mf-card" style={{display:"flex",alignItems:"center",gap:11}}>
            {avatarU(me, 40)}
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:800}}>@{me.username}</div>
              <div style={{fontSize:11,color:"#8A949B"}}>{me.nome || "Il tuo nome utente"}</div>
            </div>
          </div>

          <div className="mf-card" style={{display:"flex",flexDirection:"column",gap:10}}>
            <div className="cap">Cerca un amico</div>
            <div style={{display:"flex",alignItems:"center",gap:9,background:"#F2F6F8",border:"1.5px solid #E3EAEE",borderRadius:12,padding:"10px 12px"}}>
              <i className="ti ti-search" style={{color:"#8A949B",fontSize:18}}/>
              <input value={q} onChange={function(e){ cerca(e.target.value); }} placeholder="Nome utente…"
                style={{flex:1,border:"none",outline:"none",background:"transparent",fontSize:14,fontWeight:600,fontFamily:"'Nunito',system-ui,sans-serif"}}/>
            </div>
            {risultati.map(function(u){
              var st = statoCon(u.user_id);
              return (
                <div key={u.user_id} style={{display:"flex",alignItems:"center",gap:10,paddingTop:2}}>
                  {avatarU(u, 34)}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:700}}>@{u.username}</div>
                    {u.nome && <div style={{fontSize:11,color:"#8A949B"}}>{u.nome}</div>}
                  </div>
                  {st==="amico" ? <span style={{fontSize:12,fontWeight:700,color:"#2F6586",display:"flex",alignItems:"center",gap:4}}><i className="ti ti-check"/>Amici</span>
                    : st==="inviata" ? <span style={{fontSize:12,fontWeight:700,color:"#8A949B"}}>In attesa</span>
                    : st==="ricevuta" ? <span style={{fontSize:12,fontWeight:700,color:"#2F6586"}}>Ti ha aggiunto</span>
                    : <button onClick={function(){ aggiungi(u.user_id); }} style={{border:"1.5px solid #2F6586",background:"#2F6586",color:"#fff",borderRadius:20,padding:"6px 13px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif"}}>Aggiungi</button>}
                </div>
              );
            })}
            {q.length>=2 && risultati.length===0 && <div style={{fontSize:12,color:"#8A949B"}}>Nessun utente trovato.</div>}
          </div>

          {ricevute.length>0 && (
            <div className="mf-card" style={{display:"flex",flexDirection:"column",gap:10}}>
              <div className="cap">Richieste ricevute</div>
              {ricevute.map(function(a){
                return (
                  <div key={a.id} style={{display:"flex",alignItems:"center",gap:10}}>
                    {avatarU(a.utente, 34)}
                    <div style={{flex:1,minWidth:0}}><div style={{fontSize:14,fontWeight:700}}>@{a.utente.username}</div></div>
                    <button onClick={function(){ accetta(a); }} style={{border:"none",background:"#2F6586",color:"#fff",borderRadius:20,padding:"6px 13px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif"}}>Accetta</button>
                    <i className="ti ti-x" onClick={function(){ elimina(a); }} style={{fontSize:18,color:"#B4BEC4",cursor:"pointer"}}/>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mf-card" style={{display:"flex",flexDirection:"column",gap:10}}>
            <div className="cap">I tuoi amici ({amici.length})</div>
            {amici.length===0 ? <div style={{fontSize:12,color:"#8A949B"}}>Ancora nessun amico. Cercalo qui sopra.</div>
              : amici.map(function(a){
                return (
                  <div key={a.id} style={{display:"flex",alignItems:"center",gap:10}}>
                    {avatarU(a.utente, 34)}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700}}>@{a.utente.username}</div>
                      {a.utente.nome && <div style={{fontSize:11,color:"#8A949B"}}>{a.utente.nome}</div>}
                    </div>
                    <i className="ti ti-trash" onClick={function(){ if(window.confirm("Rimuovere questo amico?")) elimina(a); }} style={{fontSize:16,color:"#B4BEC4",cursor:"pointer"}}/>
                  </div>
                );
              })}
          </div>

          {inviate.length>0 && (
            <div className="mf-card" style={{display:"flex",flexDirection:"column",gap:10}}>
              <div className="cap">Richieste inviate</div>
              {inviate.map(function(a){
                return (
                  <div key={a.id} style={{display:"flex",alignItems:"center",gap:10}}>
                    {avatarU(a.utente, 34)}
                    <div style={{flex:1,minWidth:0}}><div style={{fontSize:14,fontWeight:700}}>@{a.utente.username}</div></div>
                    <span style={{fontSize:12,color:"#8A949B",fontWeight:700}}>In attesa</span>
                    <i className="ti ti-x" onClick={function(){ elimina(a); }} style={{fontSize:18,color:"#B4BEC4",cursor:"pointer"}}/>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mf-card acc" style={{display:"flex",alignItems:"flex-start",gap:10,fontSize:12}}>
            <i className="ti ti-tools-kitchen-2" style={{fontSize:18,flexShrink:0,marginTop:1}}/>
            <div>Prossimo passo: "Cena insieme" — inviti gli amici e l'app unisce le allergie/intolleranze di tutte le famiglie.</div>
          </div>

          {msg && <div style={{fontSize:12,color:"#2F6586",textAlign:"center",fontWeight:600}}>{msg}</div>}
        </div>
      )}
    </div>
  );
}

function randomCodice() {
  var c = ""; var A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for(var i=0;i<6;i++){ c += A.charAt(Math.floor(Math.random()*A.length)); }
  return c;
}
function FamigliaCondivisa(props) {
  var familyId = props.familyId;
  var userId = props.userId;
  var onJoined = props.onJoined || function(){};
  var sCode = useState(""); var codice = sCode[0]; var setCodice = sCode[1];
  var sInp = useState(""); var inp = sInp[0]; var setInp = sInp[1];
  var sMsg = useState(""); var msg = sMsg[0]; var setMsg = sMsg[1];
  var sNum = useState(0); var numMembri = sNum[0]; var setNumMembri = sNum[1];

  function flash(t){ setMsg(t); setTimeout(function(){ setMsg(""); }, 3200); }
  function carica() {
    if(!familyId) return;
    supabase.from("famiglia_inviti").select("codice").eq("family_id", familyId).then(function(rows){ if(rows && rows.length) setCodice(rows[0].codice); }, function(){});
    supabase.from("membri_famiglia").select("user_id").eq("family_id", familyId).then(function(rows){ setNumMembri((rows||[]).length); }, function(){});
  }
  useEffect(function(){ carica(); }, [familyId]);

  function genera() {
    if(!familyId){ flash("Accedi prima."); return; }
    var c = randomCodice();
    supabase.from("famiglia_inviti").upsert({codice:c, family_id:familyId}, {onConflict:"family_id"}).then(function(res){
      if(res && res.length){ setCodice(res[0].codice); flash("Codice creato!"); }
      else { setCodice(c); flash("Codice creato!"); }
    }, function(){ flash("Manca la tabella su Supabase (supabase/famiglia.sql)."); });
  }
  function copia() {
    if(codice && typeof navigator !== "undefined" && navigator.clipboard){ navigator.clipboard.writeText(codice); flash("Codice copiato!"); }
  }
  function entra() {
    var c = (""+inp).toUpperCase().replace(/[^A-Z0-9]/g, "");
    if(c.length < 4){ flash("Inserisci il codice che hai ricevuto."); return; }
    supabase.from("famiglia_inviti").select("family_id").eq("codice", c).then(function(rows){
      if(!rows || !rows.length){ flash("Codice non valido."); return; }
      var fid = rows[0].family_id;
      if(fid === familyId){ flash("Sei già in questa famiglia."); return; }
      supabase.from("membri_famiglia").upsert({family_id:fid, user_id:userId, ruolo:"membro"}, {onConflict:"family_id,user_id"}).then(function(){
        flash("Entrato! Carico la famiglia…");
        onJoined(fid);
      }, function(){ flash("Non riesco a entrare (controlla le tabelle Supabase)."); });
    }, function(){ flash("Non riesco a leggere il codice (tabella mancante?)."); });
  }

  return (
    <div className="mf-card" style={{marginBottom:14,display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div className="mf-ic"><i className="ti ti-users-group"/></div>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:700,color:"#2C3338"}}>Famiglia condivisa</div>
          <div style={{fontSize:11,color:"#8A949B"}}>Fai entrare altri (tuo marito) con la loro email</div>
        </div>
      </div>

      <div style={{borderTop:"1px solid #F1F4F6",paddingTop:11}}>
        <div className="cap" style={{marginBottom:8}}>Invita in questa famiglia</div>
        {codice ? (
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{flex:1,background:"#E2EEF5",borderRadius:12,padding:"12px 14px",fontSize:22,fontWeight:800,letterSpacing:"0.14em",color:"#2F6586",textAlign:"center"}}>{codice}</div>
            <button onClick={copia} style={{border:"1.5px solid #6BA6C9",background:"#fff",color:"#2F6586",borderRadius:12,padding:"12px 14px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif",display:"flex",alignItems:"center",gap:6}}><i className="ti ti-copy" style={{fontSize:16}}/>Copia</button>
          </div>
        ) : (
          <button onClick={genera} style={{width:"100%",border:"none",background:"#2F6586",color:"#fff",borderRadius:12,padding:"12px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif"}}>Genera codice invito</button>
        )}
        <div style={{fontSize:11,color:"#8A949B",marginTop:7}}>Dai questo codice a chi vuoi far entrare. {numMembri>0?("Persone entrate: "+numMembri):""}</div>
      </div>

      <div style={{borderTop:"1px solid #F1F4F6",paddingTop:11}}>
        <div className="cap" style={{marginBottom:8}}>Entra in una famiglia</div>
        <div style={{display:"flex",gap:8}}>
          <input value={inp} onChange={function(e){ setInp(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"")); }} placeholder="Codice ricevuto"
            maxLength={6} style={{flex:1,padding:"11px 12px",borderRadius:12,border:"1.5px solid #E3EAEE",fontSize:15,fontWeight:800,letterSpacing:"0.1em",textAlign:"center",outline:"none",fontFamily:"'Nunito',system-ui,sans-serif"}}/>
          <button onClick={entra} style={{border:"none",background:"#2F6586",color:"#fff",borderRadius:12,padding:"0 18px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif"}}>Entra</button>
        </div>
        <div style={{fontSize:11,color:"#8A949B",marginTop:7}}>Attenzione: entrando lasci la tua famiglia attuale per usare quella condivisa.</div>
      </div>

      {msg && <div style={{fontSize:12,color:"#2F6586",fontWeight:600}}>{msg}</div>}
    </div>
  );
}

function MedicineView(props) {
  var profili = props.profili || {};
  var medicine = props.medicine || {};
  var setMedicine = props.setMedicine || function(){};
  var vals = Object.values(profili);
  var oggi = isoDay(new Date());

  var sSel = useState(vals.length ? vals[0].id : ""); var selId = sSel[0]; var setSelId = sSel[1];
  var sAdd = useState(false); var adding = sAdd[0]; var setAdding = sAdd[1];
  var sN = useState(""); var nome = sN[0]; var setNome = sN[1];
  var sD = useState(""); var dose = sD[0]; var setDose = sD[1];
  var sV = useState(1); var volte = sV[0]; var setVolte = sV[1];
  var sQ = useState(""); var quando = sQ[0]; var setQuando = sQ[1];

  var selProf = null;
  vals.forEach(function(p){ if(p.id === selId) selProf = p; });
  if(!selProf && vals.length) selProf = vals[0];
  var meds = selProf ? (medicine[selProf.id] || []) : [];

  function updateMeds(pid, fn) {
    var m = Object.assign({}, medicine);
    var arr = (m[pid] || []).map(function(x){ return Object.assign({}, x); });
    fn(arr);
    m[pid] = arr; setMedicine(m);
  }
  function salvaMed() {
    if(!selProf || !nome.trim()) return;
    var id = "med_" + Date.now();
    updateMeds(selProf.id, function(arr){ arr.push({id:id, nome:nome.trim(), dose:dose.trim(), volte:volte, quando:quando.trim(), log:{}}); });
    setNome(""); setDose(""); setVolte(1); setQuando(""); setAdding(false);
  }
  function rimuoviMed(id) { updateMeds(selProf.id, function(arr){ for(var i=0;i<arr.length;i++){ if(arr[i].id===id){ arr.splice(i,1); break; } } }); }
  function toggleDose(id, idx) {
    updateMeds(selProf.id, function(arr){
      arr.forEach(function(md){
        if(md.id === id){
          md.log = Object.assign({}, md.log || {});
          var day = (md.log[oggi] || []).slice();
          while(day.length < md.volte) day.push(false);
          day[idx] = !day[idx];
          md.log[oggi] = day;
        }
      });
    });
  }
  function fattoOggi(md) {
    var day = (md.log && md.log[oggi]) || [];
    var n = 0; for(var i=0;i<md.volte;i++){ if(day[i]) n++; }
    return n;
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div>
        <div style={{fontSize:23,fontWeight:800,letterSpacing:"-0.01em",paddingTop:8}}>Medicine</div>
        <div style={{fontSize:13,color:"#8A949B"}}>Per ogni membro: dose, frequenza e cosa è stato preso oggi.</div>
      </div>

      {vals.length>0 && (
        <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:2}}>
          {vals.map(function(p){
            var on = (selProf && p.id === selProf.id);
            var nMed = (medicine[p.id] || []).length;
            return (
              <button key={p.id} onClick={function(){ setSelId(p.id); setAdding(false); }}
                style={{flexShrink:0,display:"flex",alignItems:"center",gap:7,border:"1.5px solid "+(on?(p.colore||"#2F6586"):"#E3EAEE"),
                  background:on?(p.colore||"#2F6586"):"#fff",color:on?"#fff":"#2C3338",borderRadius:20,padding:"7px 13px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif"}}>
                {p.nome}{nMed>0?(" · "+nMed):""}
              </button>
            );
          })}
        </div>
      )}

      {selProf && meds.map(function(md){
        var presi = fattoOggi(md);
        var completo = presi >= md.volte;
        return (
          <div key={md.id} className="mf-card" style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:11}}>
              <div style={{width:38,height:38,borderRadius:11,background:"#E2EEF5",color:"#2F6586",display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}><i className="ti ti-pill"/></div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:700}}>{md.nome}</div>
                <div style={{fontSize:12,color:"#8A949B"}}>{[md.dose, (md.volte+"×/die"), md.quando].filter(Boolean).join(" · ")}</div>
              </div>
              <i className="ti ti-trash" onClick={function(){ rimuoviMed(md.id); }} style={{fontSize:16,color:"#B4BEC4",cursor:"pointer"}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:11,color:"#8A949B",fontWeight:700,marginRight:2}}>Oggi</span>
              {Array.apply(null, {length:md.volte}).map(function(x, idx){
                var day = (md.log && md.log[oggi]) || [];
                var on = !!day[idx];
                return (
                  <button key={idx} onClick={function(){ toggleDose(md.id, idx); }}
                    style={{width:34,height:34,borderRadius:"50%",cursor:"pointer",border:"1.5px solid "+(on?"#2F6586":"#CADCE8"),
                      background:on?"#2F6586":"#fff",color:on?"#fff":"#CADCE8",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>
                    <i className={"ti "+(on?"ti-check":"ti-plus")}/>
                  </button>
                );
              })}
              <span style={{marginLeft:"auto",fontSize:12,fontWeight:800,color:completo?"#2F6586":"#8A949B"}}>{completo?"Fatto":(presi+"/"+md.volte)}</span>
            </div>
          </div>
        );
      })}

      {selProf && meds.length===0 && !adding && (
        <div className="mf-card" style={{fontSize:13,color:"#8A949B"}}>Nessuna medicina per {selProf.nome}. Aggiungine una qui sotto.</div>
      )}

      {adding ? (
        <div className="mf-card" style={{display:"flex",flexDirection:"column",gap:10}}>
          <div className="cap">Nuova medicina</div>
          <input value={nome} onChange={function(e){ setNome(e.target.value); }} placeholder="Nome (es. Tachipirina)"
            style={{padding:"11px 12px",borderRadius:12,border:"1.5px solid #E3EAEE",fontSize:15,fontWeight:700,outline:"none",fontFamily:"'Nunito',system-ui,sans-serif"}}/>
          <input value={dose} onChange={function(e){ setDose(e.target.value); }} placeholder="Dose / quantità (es. 1 compressa, 8 gocce, 5 ml)"
            style={{padding:"11px 12px",borderRadius:12,border:"1.5px solid #E3EAEE",fontSize:14,outline:"none",fontFamily:"'Nunito',system-ui,sans-serif"}}/>
          <div>
            <div style={{fontSize:11,color:"#8A949B",fontWeight:700,marginBottom:6}}>Quante volte al giorno</div>
            <div style={{display:"flex",gap:7}}>
              {[1,2,3,4].map(function(n){
                var on = volte === n;
                return <button key={n} onClick={function(){ setVolte(n); }}
                  style={{flex:1,border:"1.5px solid "+(on?"#2F6586":"#E3EAEE"),background:on?"#2F6586":"#fff",color:on?"#fff":"#2C3338",
                    borderRadius:11,padding:"9px 0",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif"}}>{n}</button>;
              })}
            </div>
          </div>
          <input value={quando} onChange={function(e){ setQuando(e.target.value); }} placeholder="Quando (facoltativo, es. colazione e cena)"
            style={{padding:"11px 12px",borderRadius:12,border:"1.5px solid #E3EAEE",fontSize:14,outline:"none",fontFamily:"'Nunito',system-ui,sans-serif"}}/>
          <div style={{display:"flex",gap:8}}>
            <button onClick={function(){ setAdding(false); }} style={{flex:1,border:"1.5px solid #E3EAEE",background:"#fff",color:"#8A949B",borderRadius:12,padding:"11px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif"}}>Annulla</button>
            <button onClick={salvaMed} style={{flex:2,border:"none",background:"#2F6586",color:"#fff",borderRadius:12,padding:"11px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif"}}>Salva medicina</button>
          </div>
        </div>
      ) : selProf ? (
        <button onClick={function(){ setAdding(true); }}
          style={{padding:"12px",borderRadius:13,border:"1.5px dashed #6BA6C9",background:"#fff",color:"#2F6586",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
          <i className="ti ti-plus" style={{fontSize:17}}/>Aggiungi una medicina
        </button>
      ) : (
        <div className="mf-card" style={{fontSize:13,color:"#8A949B"}}>Configura prima la famiglia in Impostazioni.</div>
      )}

      <div className="mf-card warn" style={{display:"flex",alignItems:"flex-start",gap:10,fontSize:12}}>
        <i className="ti ti-info-circle" style={{fontSize:18,flexShrink:0,marginTop:1}}/>
        <div>Promemoria personale, non è una prescrizione. Segui sempre le indicazioni del medico.</div>
      </div>
    </div>
  );
}

function SaluteView(props) {
  var profili = props.profili || {};
  var setTab = props.setTab || function(){};
  var pesoLog = props.pesoLog || {};
  var setPesoLog = props.setPesoLog || function(){};
  var onSavePeso = props.onSavePeso || function(){};
  var setProfili = props.setProfili || function(){};
  var vals = Object.values(profili);

  var sSel = useState(vals.length ? (vals[0].nome || "") : "");
  var selNome = sSel[0]; var setSelNome = sSel[1];
  var sInp = useState(""); var inp = sInp[0]; var setInp = sInp[1];

  var selProf = null;
  vals.forEach(function(p){ if((p.nome || "") === selNome) selProf = p; });
  if(!selProf && vals.length) selProf = vals[0];

  var log = selProf ? (pesoLog[selProf.nome] || []).slice() : [];
  log.sort(function(a,b){ return (a.data || "") < (b.data || "") ? -1 : 1; });

  var etaAnni = null; var etaMesi = null;
  if(selProf) {
    if(selProf.dataNascita) { etaMesi = calcolaEta(selProf.dataNascita).mesi; etaAnni = etaMesi / 12; }
    else if(selProf.eta) { etaAnni = selProf.eta; etaMesi = selProf.eta * 12; }
  }
  var pesoAttuale = log.length ? log[log.length-1].valore : (selProf ? selProf.peso : 0);
  var pctl = selProf ? percentilePeso(selProf.sesso, etaMesi, pesoAttuale) : null;

  var iniziale = log.length ? log[0].valore : 0;
  var variazione = log.length >= 2 ? (pesoAttuale - iniziale) : 0;
  var minV = log.length ? Math.min.apply(null, log.map(function(d){ return d.valore; })) : 0;
  var maxV = log.length ? Math.max.apply(null, log.map(function(d){ return d.valore; })) : 0;

  function aggiungiPeso() {
    if(!selProf) return;
    var val = parseFloat(("" + inp).replace(",", "."));
    if(!val || !(val > 0)) return;
    var oggi = new Date().toISOString().slice(0, 10);
    var arr = (pesoLog[selProf.nome] || []).slice();
    var trovato = false;
    arr = arr.map(function(d){ if(d.data === oggi){ trovato = true; return {data: oggi, valore: val}; } return d; });
    if(!trovato) arr.push({data: oggi, valore: val});
    var newLog = Object.assign({}, pesoLog);
    newLog[selProf.nome] = arr;
    setPesoLog(newLog);
    var newP = Object.assign({}, profili);
    newP[selProf.id] = Object.assign({}, profili[selProf.id], {peso: val});
    setProfili(newP);
    onSavePeso(selProf.nome, oggi, val);
    setInp("");
  }

  function fmtData(s) {
    if(!s) return "";
    var p = ("" + s).split("-");
    if(p.length < 3) return s;
    return p[2] + "/" + p[1];
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{fontSize:23,fontWeight:800,letterSpacing:"-0.01em",paddingTop:8}}>Famiglia</div>

      {vals.length > 0 && (
        <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:2}}>
          {vals.map(function(p){
            var on = (p.nome || "") === selNome || (selProf && p.nome === selProf.nome);
            return (
              <button key={p.id} onClick={function(){ setSelNome(p.nome || ""); setInp(""); }}
                style={{flexShrink:0,display:"flex",alignItems:"center",gap:7,border:"1.5px solid " + (on ? (p.colore || "#2F6586") : "#E3EAEE"),
                  background: on ? (p.colore || "#2F6586") : "#fff", color: on ? "#fff" : "#2C3338",
                  borderRadius:20,padding:"7px 13px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif"}}>
                {p.nome || "?"}
              </button>
            );
          })}
        </div>
      )}

      {selProf && (
        <div className="mf-card" style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:11}}>
            <div style={{width:40,height:40,borderRadius:"50%",background:selProf.colore || "#E2EEF5",color:"#fff",
              display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:15}}>
              {selProf.nome ? selProf.nome.slice(0,1).toUpperCase() : "?"}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:700}}>{selProf.nome}</div>
              <div style={{fontSize:11,color:"#8A949B"}}>
                {etaAnni != null ? (etaAnni < 2 ? (Math.round(etaAnni * 12) + " mesi") : (Math.floor(etaAnni) + " anni")) : "eta n.d."}
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:22,fontWeight:800,color:"#2C3338"}}>{pesoAttuale ? pesoAttuale : "—"}</div>
              <div style={{fontSize:10,color:"#8A949B",fontWeight:700}}>kg attuali</div>
            </div>
          </div>

          <div style={{display:"flex",gap:8}}>
            <input inputMode="decimal" placeholder="Peso di oggi (kg)" value={inp}
              onChange={function(e){ setInp(e.target.value.replace(/[^0-9.,]/g, "")); }}
              onKeyDown={function(e){ if(e.key === "Enter") aggiungiPeso(); }}
              style={{flex:1,padding:"11px 13px",borderRadius:13,border:"1.5px solid #E3EAEE",fontSize:15,fontWeight:700,
                fontFamily:"'Nunito',system-ui,sans-serif",boxSizing:"border-box"}}/>
            <button onClick={aggiungiPeso}
              style={{border:"none",background:"#2F6586",color:"#fff",borderRadius:13,padding:"0 18px",fontSize:14,fontWeight:700,
                cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif"}}>Salva</button>
          </div>

          {log.length >= 2 && (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
                <span style={{fontSize:11,color:"#8A949B",fontWeight:700}}>Andamento (ultimi {Math.min(log.length,12)})</span>
                <span style={{fontSize:12,fontWeight:800,color: variazione < 0 ? "#2F6586" : variazione > 0 ? "#C2355A" : "#8A949B"}}>
                  {variazione > 0 ? "+" : ""}{variazione.toFixed(1)} kg
                </span>
              </div>
              <GraficoPeso dati={log} colore={selProf.colore || "#2F6586"}/>
            </div>
          )}

          {log.length > 0 ? (
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:1,background:"#F2F6F8",borderRadius:12,padding:"9px 10px",textAlign:"center"}}>
                <div style={{fontSize:16,fontWeight:800}}>{iniziale}</div>
                <div style={{fontSize:9,color:"#8A949B",fontWeight:700}}>INIZIALE</div>
              </div>
              <div style={{flex:1,background:"#F2F6F8",borderRadius:12,padding:"9px 10px",textAlign:"center"}}>
                <div style={{fontSize:16,fontWeight:800}}>{minV}–{maxV}</div>
                <div style={{fontSize:9,color:"#8A949B",fontWeight:700}}>MIN–MAX</div>
              </div>
              <div style={{flex:1,background:"#F2F6F8",borderRadius:12,padding:"9px 10px",textAlign:"center"}}>
                <div style={{fontSize:16,fontWeight:800}}>{log.length}</div>
                <div style={{fontSize:9,color:"#8A949B",fontWeight:700}}>MISURE</div>
              </div>
            </div>
          ) : (
            <div style={{fontSize:12,color:"#8A949B",textAlign:"center",padding:"6px 0"}}>Nessun peso registrato. Aggiungi il primo qui sopra.</div>
          )}

          {pctl && (
            <div style={{background:"#E2EEF5",borderRadius:14,padding:"12px 14px"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <i className="ti ti-chart-histogram" style={{color:"#2F6586",fontSize:17}}/>
                <span style={{fontSize:12,fontWeight:800,color:"#2F6586"}}>Peso per età (OMS)</span>
              </div>
              <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:8}}>
                <span style={{fontSize:26,fontWeight:800,color:pctl.colore}}>{Math.round(pctl.perc)}°</span>
                <span style={{fontSize:13,fontWeight:700,color:pctl.colore}}>percentile · {pctl.banda}</span>
              </div>
              <div style={{position:"relative",height:8,borderRadius:6,background:"linear-gradient(90deg,#F6ECD9,#CADCE8,#CADCE8,#F6ECD9)",marginBottom:8}}>
                <div style={{position:"absolute",top:-3,left:("" + Math.max(0,Math.min(100,pctl.perc))) + "%",transform:"translateX(-50%)",
                  width:14,height:14,borderRadius:"50%",background:"#fff",border:"3px solid " + pctl.colore}}/>
              </div>
              <div style={{fontSize:10,color:"#8A949B",lineHeight:1.4}}>
                Stima indicativa su standard di crescita OMS. Non è una valutazione medica: per dubbi senti il pediatra.
              </div>
            </div>
          )}

          <div onClick={function(){ setTab("impostazioni"); }}
            style={{display:"flex",alignItems:"center",gap:7,fontSize:12,fontWeight:700,color:"#2F6586",cursor:"pointer"}}>
            <i className="ti ti-settings" style={{fontSize:15}}/>Modifica profilo, altezza, patologie
          </div>
        </div>
      )}

      {vals.length === 0 && (
        <div className="mf-card"><div style={{fontSize:14,color:"#8A949B"}}>Nessun profilo. Configura la famiglia in Impostazioni.</div></div>
      )}
    </div>
  );
}

var CAT_SPESA = [
  {id:"frutta_verdura", label:"Frutta e verdura", ic:"ti-apple"},
  {id:"carne_pesce",    label:"Carne e pesce",    ic:"ti-meat"},
  {id:"latticini",      label:"Latticini e uova", ic:"ti-cheese"},
  {id:"dispensa",       label:"Dispensa",         ic:"ti-baguette"},
  {id:"colazione",      label:"Colazione e dolci",ic:"ti-coffee"},
  {id:"bevande",        label:"Bevande",          ic:"ti-bottle"},
  {id:"surgelati",      label:"Surgelati",        ic:"ti-snowflake"},
  {id:"detersivi",      label:"Detersivi e casa", ic:"ti-spray"},
  {id:"igiene",         label:"Igiene e cura",    ic:"ti-bath"},
  {id:"altro",          label:"Altro",            ic:"ti-shopping-bag"}
];

function normSpesa(arr) {
  return (arr || []).map(function(it){
    if(typeof it === "string") return {nome:it, cat:"altro", fatto:false, nota:""};
    return {nome:it.nome, cat:it.cat || "altro", fatto:!!it.fatto, nota:it.nota || ""};
  });
}

function catLabel(id) {
  var c = CAT_SPESA.find(function(x){ return x.id === id; });
  return c ? c.label : "Altro";
}

function lookupIngSpesa(id) {
  function byId(x){ return x.id === id; }
  var c = CARBOIDRATI.find(byId);
  if(c) return {nome:c.nome, cat:(c.cat === "colazione" ? "colazione" : "dispensa")};
  var p = PROTEINE.find(byId);
  if(p) {
    var pc = "carne_pesce";
    if(p.cat === "uova" || p.cat === "latticini") pc = "latticini";
    else if(p.cat === "legumi") pc = "dispensa";
    return {nome:p.nome, cat:pc};
  }
  var v = VERDURE.find(byId);
  if(v) return {nome:v.nome, cat:"frutta_verdura"};
  var f = FRUTTA.find(byId);
  if(f) return {nome:f.nome, cat:"frutta_verdura"};
  var s = SALSE.find(byId);
  if(s) return {nome:s.nome, cat:"dispensa"};
  var g = GRASSI.find(byId);
  if(g) return {nome:g.nome, cat:"dispensa"};
  return null;
}

function catDaParola(t) {
  var s = t.toLowerCase();
  function has(arr){ for(var i=0;i<arr.length;i++){ if(s.indexOf(arr[i])>=0) return true; } return false; }
  if(has(["verdur","insalat","pomodor","zucchin","spinaci","broccoli","carote","funghi","zucca","peperoni","melanzane","fagiolini","asparagi","frutta","mela","banana","frutti","fragole","pere","arance","kiwi","pesche"])) return "frutta_verdura";
  if(has(["pollo","tacchino","manzo","agnello","carne","salmone","merluzzo","tonno","orata","pesce","gamber","prosciutto","bresaola","mortadella","affettat"])) return "carne_pesce";
  if(has(["yogurt","ricotta","mozzarella","formaggio","latte","uova","uovo","feta","parmigiano","stracchino"])) return "latticini";
  if(has(["pasta","riso","farro","orzo","quinoa","cous","pane","patate","polenta","legumi","ceci","lenticchie","fagioli","gnocchi","pizza","focaccia","piadina"])) return "dispensa";
  if(has(["avena","muesli","granola","cereali","gallette","biscott","marmellata","miele","fette"])) return "colazione";
  return "altro";
}

function tokensDaNome(nome) {
  if(!nome) return [];
  var parts = nome.split(/\s*\+\s*|\s*,\s*|\s+con\s+|\s+e\s+/i);
  var out = [];
  parts.forEach(function(t){
    var clean = t.replace(/\d+\s*(g|gr|kg|ml|cl|l)\b/gi, "").replace(/\s+/g, " ").trim();
    if(clean.length >= 3) out.push(clean.charAt(0).toUpperCase() + clean.slice(1));
  });
  return out;
}

function ListaSpesaView(props) {
  var spesa = props.spesa || [];
  var setSpesa = props.setSpesa || function(){};
  var builder = props.builder || {};
  var menu = props.menu || {};
  var ospiti = props.ospiti || {};
  var ospSett = ospiti[isoDay(lunediSettimana())] || {};
  var ospTot = Object.keys(ospSett).reduce(function(s,d){ var r = ospSett[d]; return s + (typeof r === "number" ? r : (r && r.n) || 0); }, 0);
  var ospRestr = [];
  Object.keys(ospSett).forEach(function(d){ var r = ospSett[d]; var arr = (r && r.restr) || []; arr.forEach(function(x){ if(ospRestr.indexOf(x)<0) ospRestr.push(x); }); });
  var s_nome = useState(""); var nome = s_nome[0]; var setNome = s_nome[1];
  var s_cat = useState("frutta_verdura"); var cat = s_cat[0]; var setCat = s_cat[1];
  var s_msg = useState(""); var msg = s_msg[0]; var setMsg = s_msg[1];
  var s_guidaS = useState(false); var guidaS = s_guidaS[0]; var setGuidaS = s_guidaS[1];
  var s_editNota = useState(-1); var editNota = s_editNota[0]; var setEditNota = s_editNota[1];
  var s_notaVal = useState(""); var notaVal = s_notaVal[0]; var setNotaVal = s_notaVal[1];

  var items = normSpesa(spesa);

  function aggiungi() {
    if(!nome.trim()) return;
    setSpesa(items.concat([{nome:nome.trim(), cat:cat, fatto:false}]));
    setNome("");
  }
  function aggiungiRapidoSpesa(n) {
    var gia = items.some(function(x){ return (x.nome||"").toLowerCase() === n.toLowerCase(); });
    if(gia) return;
    setSpesa(items.concat([{nome:n, cat:catDaParola(n), fatto:false}]));
  }
  function toggle(i) {
    var arr = normSpesa(spesa).slice();
    arr[i] = {nome:arr[i].nome, cat:arr[i].cat, fatto:!arr[i].fatto, nota:arr[i].nota||""};
    setSpesa(arr);
  }
  function salvaNota(i, val) {
    var arr = normSpesa(spesa).slice();
    arr[i] = {nome:arr[i].nome, cat:arr[i].cat, fatto:arr[i].fatto, nota:val};
    setSpesa(arr);
  }
  function rimuovi(i) {
    setSpesa(normSpesa(spesa).filter(function(_,j){ return j !== i; }));
  }
  function svuotaFatti() {
    setSpesa(normSpesa(spesa).filter(function(x){ return !x.fatto; }));
  }

  function generaDallaSettimana() {
    var ids = [];
    Object.keys(builder).forEach(function(k){
      var s = builder[k];
      if(!s) return;
      ["carbo","proteina","verdura","verdura2","frutta","latticino","salsa"].forEach(function(f){
        if(s[f]) ids.push(s[f]);
      });
    });
    var attuali = normSpesa(spesa);
    var esistenti = attuali.map(function(x){ return x.nome.toLowerCase(); });
    var nuovi = []; var visti = {};
    function aggiungiVoce(nomeV, catV){
      var key = nomeV.toLowerCase();
      if(esistenti.indexOf(key) >= 0 || visti[key]) return;
      visti[key] = true;
      nuovi.push({nome:nomeV, cat:catV, fatto:false});
    }
    ids.forEach(function(id){
      var info = lookupIngSpesa(id);
      if(info) aggiungiVoce(info.nome, info.cat);
    });
    Object.keys(menu).forEach(function(k){
      var cell = menu[k];
      if(!cell || !cell.pastoId || !DB_PASTI[cell.pastoId]) return;
      tokensDaNome(DB_PASTI[cell.pastoId].nome).forEach(function(t){
        aggiungiVoce(t, catDaParola(t));
      });
    });
    if(nuovi.length) { setSpesa(attuali.concat(nuovi)); setMsg(nuovi.length + " articoli aggiunti dalla settimana"); }
    else setMsg("Nessun nuovo articolo dal menu della settimana");
    setTimeout(function(){ setMsg(""); }, 2800);
  }

  function testoLista() {
    var righe = ["Lista della spesa", ""];
    CAT_SPESA.forEach(function(c){
      var inCat = items.filter(function(x){ return x.cat === c.id; });
      if(!inCat.length) return;
      righe.push(c.label + ":");
      inCat.forEach(function(x){ righe.push("- " + x.nome + (x.nota ? " (" + x.nota + ")" : "") + (x.fatto ? " [preso]" : "")); });
      righe.push("");
    });
    return righe.join("\n");
  }

  function condividi() {
    var txt = testoLista();
    if(typeof navigator !== "undefined" && navigator.share) {
      navigator.share({title:"Lista della spesa", text:txt}).catch(function(){});
    } else if(typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(txt).then(function(){ setMsg("Lista copiata negli appunti"); setTimeout(function(){ setMsg(""); }, 2500); });
    }
  }

  function salvaPDF() {
    var w = window.open("", "_blank");
    if(!w) { setMsg("Abilita i popup per salvare il PDF"); setTimeout(function(){ setMsg(""); }, 2500); return; }
    var body = "";
    CAT_SPESA.forEach(function(c){
      var inCat = items.filter(function(x){ return x.cat === c.id; });
      if(!inCat.length) return;
      body += "<h2>" + c.label + "</h2><ul>";
      inCat.forEach(function(x){ body += "<li" + (x.fatto ? " style='text-decoration:line-through;color:#888'" : "") + ">" + x.nome + (x.nota ? " <span style='color:#8A949B;font-style:italic'>· " + x.nota + "</span>" : "") + "</li>"; });
      body += "</ul>";
    });
    if(!body) body = "<p>Lista vuota</p>";
    w.document.write("<html><head><title>Lista della spesa</title><meta charset='utf-8'>" +
      "<style>body{font-family:system-ui,Arial,sans-serif;color:#2C3338;padding:24px;max-width:600px;margin:0 auto}" +
      "h1{font-size:22px}h2{font-size:15px;color:#2F6586;margin:16px 0 6px;border-bottom:1px solid #E3EAEE;padding-bottom:4px}" +
      "ul{margin:0;padding-left:20px}li{margin:4px 0;font-size:14px}</style></head><body>" +
      "<h1>Lista della spesa</h1>" + body + "</body></html>");
    w.document.close(); w.focus();
    setTimeout(function(){ w.print(); }, 300);
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:8}}>
        <div style={{fontSize:23,fontWeight:800,letterSpacing:"-0.01em"}}>Lista della spesa</div>
        <span style={{fontSize:13,color:"#8A949B"}}>{items.length} articoli</span>
      </div>

      {ospTot>0&&(
        <div className="mf-card" style={{background:"#F6ECD9",border:"1px solid #E8D5AE",display:"flex",alignItems:"flex-start",gap:9,padding:"12px 14px"}}>
          <i className="ti ti-users" style={{fontSize:18,color:"#8A5A12",marginTop:1}}/>
          <div style={{flex:1,fontSize:12,color:"#8A5A12",lineHeight:1.45}}>
            <b>Questa settimana +{ospTot} ospiti a tavola.</b> Aumenta le quantità quando fai la spesa.
            {ospRestr.length>0&&<div style={{marginTop:3}}>Attenzione a: {ospRestr.map(restrLabel).join(", ")}.</div>}
          </div>
        </div>
      )}

      <div className="mf-card" style={{display:"flex",flexDirection:"column",gap:10}}>
        <input placeholder="Aggiungi un articolo (es. detersivo piatti)" value={nome}
          onKeyDown={function(e){ if(e.key==="Enter") aggiungi(); }}
          onChange={function(e){setNome(e.target.value);}}
          style={{padding:"12px 14px",borderRadius:13,border:"1.5px solid #E3EAEE",fontSize:14,outline:"none",
            width:"100%",boxSizing:"border-box",fontFamily:"'Nunito',system-ui,sans-serif"}}/>
        <div style={{display:"flex",gap:8}}>
          <select value={cat} onChange={function(e){setCat(e.target.value);}}
            style={{flex:1,padding:"12px 14px",borderRadius:13,border:"1.5px solid #E3EAEE",fontSize:14,outline:"none",
              background:"#fff",fontFamily:"'Nunito',system-ui,sans-serif"}}>
            {CAT_SPESA.map(function(c){ return <option key={c.id} value={c.id}>{c.label}</option>; })}
          </select>
          <button onClick={aggiungi}
            style={{padding:"12px 18px",borderRadius:13,border:"none",background:"#2F6586",color:"#fff",
              fontSize:14,fontWeight:700,cursor:"pointer"}}>Aggiungi</button>
        </div>
      </div>

      <div className="mf-card acc" onClick={function(){ setGuidaS(!guidaS); }}
        style={{display:"flex",alignItems:"center",gap:9,cursor:"pointer",padding:"11px 14px"}}>
        <i className="ti ti-bulb" style={{fontSize:17}}/>
        <span style={{flex:1,fontSize:13,fontWeight:700}}>Guida rapida · articoli comuni</span>
        <i className={"ti "+(guidaS?"ti-chevron-up":"ti-chevron-down")} style={{fontSize:16}}/>
      </div>
      {guidaS&&(
        <div className="mf-card" style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {SUGGERIMENTI_SPESA.map(function(n){
            var gia = items.some(function(x){ return (x.nome||"").toLowerCase() === n.toLowerCase(); });
            return (
              <button key={n} onClick={function(){ aggiungiRapidoSpesa(n); }} disabled={gia}
                style={{display:"flex",alignItems:"center",gap:5,padding:"6px 10px",borderRadius:20,
                  border:"1.5px solid "+(gia?"#E3EAEE":"#BFD9EA"),cursor:gia?"default":"pointer",
                  background:gia?"#F2F6F8":"#fff",color:gia?"#B4BEC4":"#2C3338",fontSize:12,fontWeight:600,
                  fontFamily:"'Nunito',system-ui,sans-serif"}}>
                <span style={{fontSize:14}}>{alimentoEmoji(n)}</span>{n}
                {!gia&&<i className="ti ti-plus" style={{fontSize:12,color:"#2F6586"}}/>}
              </button>
            );
          })}
        </div>
      )}

      <button onClick={generaDallaSettimana}
        style={{width:"100%",padding:"13px",borderRadius:14,border:"1.5px solid #6BA6C9",background:"#E2EEF5",
          color:"#2F6586",fontSize:14,fontWeight:700,cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
        <i className="ti ti-calendar-week" style={{fontSize:16}}/>Genera dalla settimana
      </button>

      {CAT_SPESA.map(function(c){
        var inCat = [];
        items.forEach(function(x, i){ if(x.cat === c.id) inCat.push({x:x, i:i}); });
        if(!inCat.length) return null;
        return (
          <div key={c.id}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <i className={"ti "+c.ic} style={{fontSize:16,color:"#6BA6C9"}}/>
              <span className="cap">{c.label}</span>
            </div>
            <div className="mf-card flush">
              {inCat.map(function(r){
                var inEdit = editNota === r.i;
                return (
                  <div key={r.i} className="mf-row" style={{flexWrap:"wrap"}}>
                    <span onClick={function(){ toggle(r.i); }}
                      style={{width:22,height:22,borderRadius:7,flexShrink:0,cursor:"pointer",
                        display:"flex",alignItems:"center",justifyContent:"center",
                        border:"1.5px solid "+(r.x.fatto?"#2F6586":"#CADCE8"),
                        background:r.x.fatto?"#2F6586":"#fff",color:"#fff"}}>
                      {r.x.fatto&&<i className="ti ti-check" style={{fontSize:14}}/>}
                    </span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,color:r.x.fatto?"#8A949B":"#2C3338",
                        textDecoration:r.x.fatto?"line-through":"none"}}>{r.x.nome}</div>
                      {r.x.nota&&!inEdit&&(
                        <div style={{fontSize:11,color:"#8A949B",fontStyle:"italic"}}>
                          <i className="ti ti-tag" style={{fontSize:11,marginRight:3,verticalAlign:"-1px"}}/>{r.x.nota}
                        </div>
                      )}
                    </div>
                    <i className="ti ti-tag" onClick={function(){ setEditNota(r.i); setNotaVal(r.x.nota||""); }}
                      style={{fontSize:16,color:r.x.nota?"#2F6586":"#B4BEC4",cursor:"pointer",marginRight:4}}/>
                    <i className="ti ti-x" onClick={function(){ rimuovi(r.i); }}
                      style={{fontSize:16,color:"#B4BEC4",cursor:"pointer"}}/>
                    {inEdit&&(
                      <div style={{flexBasis:"100%",display:"flex",gap:6,marginTop:8}}>
                        <input autoFocus placeholder="Nota o marca (es. Barilla, senza lattosio)" value={notaVal}
                          onChange={function(e){ setNotaVal(e.target.value); }}
                          onKeyDown={function(e){ if(e.key==="Enter"){ salvaNota(r.i, notaVal.trim()); setEditNota(-1); } }}
                          style={{flex:1,padding:"9px 11px",borderRadius:11,border:"1.5px solid #E3EAEE",fontSize:13,outline:"none",fontFamily:"'Nunito',system-ui,sans-serif"}}/>
                        <button onClick={function(){ salvaNota(r.i, notaVal.trim()); setEditNota(-1); }}
                          style={{padding:"9px 14px",borderRadius:11,border:"none",background:"#2F6586",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>OK</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {items.length===0&&(
        <div className="mf-card" style={{textAlign:"center",color:"#8A949B",fontSize:13}}>
          La lista e vuota. Aggiungi gli articoli qui sopra.
        </div>
      )}

      {msg&&<div style={{fontSize:12,color:"#2F6586",textAlign:"center",fontWeight:600}}>{msg}</div>}

      {items.length>0&&(
        <div style={{display:"flex",gap:10}}>
          <button onClick={condividi}
            style={{flex:1,padding:"13px",borderRadius:14,border:"1.5px solid #6BA6C9",background:"#fff",
              color:"#2F6586",fontSize:14,fontWeight:700,cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <i className="ti ti-share" style={{fontSize:16}}/>Condividi
          </button>
          <button onClick={salvaPDF}
            style={{flex:1,padding:"13px",borderRadius:14,border:"none",background:"#2F6586",color:"#fff",
              fontSize:14,fontWeight:700,cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <i className="ti ti-file-type-pdf" style={{fontSize:16}}/>Invia PDF
          </button>
        </div>
      )}

      {items.some(function(x){ return x.fatto; })&&(
        <button onClick={svuotaFatti}
          style={{width:"100%",padding:"11px",borderRadius:14,border:"none",background:"transparent",
            color:"#8A949B",fontSize:13,fontWeight:700,cursor:"pointer"}}>
          Rimuovi articoli presi
        </button>
      )}
    </div>
  );
}

function dispensaLow(it) {
  if(!it) return false;
  var q = parseFloat(it.qty);
  if(!isNaN(q) && q <= 1) return true;
  if(it.scadenza) {
    var d = new Date(it.scadenza);
    if(!isNaN(d.getTime()) && (d.getTime() - new Date().getTime()) < 3*86400000) return true;
  }
  return false;
}

var ALIMENTI_IMG = [
  {k:["latte"], e:"🥛", c:"frigo"},
  {k:["yogurt","yoghurt"], e:"🍶", c:"frigo"},
  {k:["uova","uovo"], e:"🥚", c:"frigo"},
  {k:["mozzarella","stracchino"], e:"🧀", c:"frigo"},
  {k:["ricotta"], e:"🧀", c:"frigo"},
  {k:["formaggio","parmigiano","grana","pecorino","emmental"], e:"🧀", c:"frigo"},
  {k:["burro"], e:"🧈", c:"frigo"},
  {k:["panna"], e:"🍶", c:"frigo"},
  {k:["prosciutto","salame","affettat","mortadella","speck","bresaola","wurstel"], e:"🥓", c:"frigo"},
  {k:["pollo","tacchino"], e:"🍗", c:"frigo"},
  {k:["carne","manzo","maiale","bistecca","macinat","vitello","salsiccia"], e:"🥩", c:"frigo"},
  {k:["pesce","salmone","orata","branzino","merluzzo","gamber","seppia","cozze"], e:"🐟", c:"frigo"},
  {k:["insalata","lattuga","rucola","spinaci"], e:"🥬", c:"frigo"},
  {k:["pomodoro","pomodori"], e:"🍅", c:"frigo"},
  {k:["carota","carote"], e:"🥕", c:"frigo"},
  {k:["zucchina","zucchine","cetriolo"], e:"🥒", c:"frigo"},
  {k:["broccoli","broccolo","cavolo","verza"], e:"🥦", c:"frigo"},
  {k:["peperone","peperoni"], e:"🫑", c:"frigo"},
  {k:["melanzana","melanzane"], e:"🍆", c:"frigo"},
  {k:["limone","limoni"], e:"🍋", c:"frigo"},
  {k:["mela","mele"], e:"🍎", c:"frigo"},
  {k:["fragola","fragole"], e:"🍓", c:"frigo"},
  {k:["uva"], e:"🍇", c:"frigo"},
  {k:["succo","spremuta","aranciata","bibita","coca","the freddo","te freddo"], e:"🧃", c:"frigo"},
  {k:["gelato"], e:"🍦", c:"freezer"},
  {k:["ghiaccio","cubetti"], e:"🧊", c:"freezer"},
  {k:["piselli surgelat","spinaci surgelat","minestrone surgelat","verdure surgelat"], e:"🧊", c:"freezer"},
  {k:["bastoncini","pesce surgelat","filetti surgelat"], e:"🐟", c:"freezer"},
  {k:["pizza surgelat"], e:"🍕", c:"freezer"},
  {k:["surgelat","congelat"], e:"🧊", c:"freezer"},
  {k:["pasta","spaghetti","penne","fusilli","maccheroni","lasagne","rigatoni"], e:"🍝", c:"dispensa"},
  {k:["riso","risotto"], e:"🍚", c:"dispensa"},
  {k:["farina"], e:"🌾", c:"dispensa"},
  {k:["pane","panini","pancarr","piadina"], e:"🍞", c:"dispensa"},
  {k:["fette biscottate","cracker","grissini"], e:"🍘", c:"dispensa"},
  {k:["biscotti","biscotto","merendine","merendina"], e:"🍪", c:"dispensa"},
  {k:["cioccolato","cioccolata","nutella"], e:"🍫", c:"dispensa"},
  {k:["cereali","corn flakes","muesli"], e:"🥣", c:"dispensa"},
  {k:["tonno","sgombro"], e:"🥫", c:"dispensa"},
  {k:["fagioli","ceci","lenticchie","legumi","piselli"], e:"🫘", c:"dispensa"},
  {k:["pelati","passata","polpa","sugo","salsa"], e:"🥫", c:"dispensa"},
  {k:["olio"], e:"🫒", c:"dispensa"},
  {k:["aceto"], e:"🍾", c:"dispensa"},
  {k:["sale"], e:"🧂", c:"dispensa"},
  {k:["zucchero"], e:"🍬", c:"dispensa"},
  {k:["caffe","caffè","cafe"], e:"☕", c:"dispensa"},
  {k:["the","tè","tisana","camomilla"], e:"🍵", c:"dispensa"},
  {k:["acqua","bottiglia"], e:"💧", c:"dispensa"},
  {k:["vino"], e:"🍷", c:"dispensa"},
  {k:["birra"], e:"🍺", c:"dispensa"},
  {k:["patate","patata"], e:"🥔", c:"dispensa"},
  {k:["cipolla","cipolle","aglio","scalogno"], e:"🧅", c:"dispensa"},
  {k:["miele"], e:"🍯", c:"dispensa"},
  {k:["marmellata","confettura"], e:"🍓", c:"dispensa"},
  {k:["patatine","snack","noccioline","arachidi"], e:"🥨", c:"dispensa"},
  {k:["banana","banane"], e:"🍌", c:"dispensa"},
  {k:["arancia","arance","mandarini"], e:"🍊", c:"dispensa"}
];

function alimentoInfo(nome) {
  var n = (nome || "").toLowerCase();
  var best = null, bestLen = 0;
  var i, j;
  for(i=0;i<ALIMENTI_IMG.length;i++) {
    var a = ALIMENTI_IMG[i];
    for(j=0;j<a.k.length;j++) {
      var kw = a.k[j];
      if(n.indexOf(kw) >= 0 && kw.length > bestLen) { best = a; bestLen = kw.length; }
    }
  }
  if(n.indexOf("surgelat") >= 0 || n.indexOf("congelat") >= 0) {
    return {e: best ? best.e : "🧊", c:"freezer"};
  }
  return best;
}
function alimentoEmoji(nome) { var a = alimentoInfo(nome); return a ? a.e : "🍽️"; }
function alimentoContenitore(nome) { var a = alimentoInfo(nome); return a ? a.c : "dispensa"; }

var COTTURA_MAP = [
  {k:["capellini","angel hair"], m:3},
  {k:["spaghettini","vermicelli"], m:6},
  {k:["spaghetti","linguine","bucatini"], m:9},
  {k:["penne","fusilli","rigatoni","farfalle","mezze maniche","sedani","caserecce"], m:11},
  {k:["tortiglioni","paccheri","maccheroni"], m:13},
  {k:["lasagne","cannelloni"], m:0},
  {k:["ravioli","tortellini","gnocchi","cappelletti","pasta fresca"], m:4},
  {k:["riso","risotto"], m:16},
  {k:["orzo perlato"], m:30},
  {k:["farro"], m:25},
  {k:["cous cous","couscous"], m:5},
  {k:["polenta"], m:40},
  {k:["pasta"], m:10}
];
function tempoCottura(nome) {
  var n = (nome || "").toLowerCase();
  var i, j;
  for(i=0;i<COTTURA_MAP.length;i++) {
    for(j=0;j<COTTURA_MAP[i].k.length;j++) {
      if(n.indexOf(COTTURA_MAP[i].k[j]) >= 0) return COTTURA_MAP[i].m;
    }
  }
  return null;
}

function zonaFrigo(nome) {
  var n = (nome || "").toLowerCase();
  if(isOrtofrutta(nome)) return "cassetto";
  var basso = ["carne","manzo","maiale","pollo","tacchino","salsiccia","macinat","bistecca","vitello",
    "pesce","salmone","gamber","orata","branzino","merluzzo","seppia","cozze","hamburger","spiedini","wurstel"];
  var porta = ["salsa","sugo","ketchup","maionese","senape","condimento","succo","spremuta","bibita",
    "aranciata","acqua","the freddo","te freddo","vino","birra","burro"];
  var alto = ["avanzi","avanzo","pronto","torta","dolce","dessert","budino","panna cotta","tiramisu","cotto"];
  var i;
  for(i=0;i<basso.length;i++) { if(n.indexOf(basso[i]) >= 0) return "basso"; }
  for(i=0;i<alto.length;i++) { if(n.indexOf(alto[i]) >= 0) return "alto"; }
  for(i=0;i<porta.length;i++) { if(n.indexOf(porta[i]) >= 0) return "porta"; }
  return "centrale";
}
function zonaFreezer(nome) {
  var n = (nome || "").toLowerCase();
  if(n.indexOf("gelato") >= 0 || n.indexOf("ghiaccio") >= 0 || n.indexOf("cubetti") >= 0 || n.indexOf("sorbetto") >= 0) return "alto";
  return "basso";
}

function scadStato(scadenza) {
  if(!scadenza) return null;
  var d = new Date(scadenza);
  if(isNaN(d.getTime())) return null;
  var diff = (d.getTime() - new Date().getTime()) / 86400000;
  if(diff < 0) return {t:"Scaduto", c:"#C2355A"};
  if(diff <= 3) return {t:"In scadenza", c:"#8A5A12"};
  return {t:"OK", c:"#2F6586"};
}

var SUGGERIMENTI_DISPENSA = [
  {g:"Frigo", items:["Latte","Uova","Yogurt","Burro","Parmigiano","Mozzarella","Prosciutto","Pollo","Insalata","Pomodori","Carote","Zucchine"]},
  {g:"Dispensa", items:["Pasta","Riso","Passata","Tonno","Fagioli","Ceci","Olio","Sale","Zucchero","Caffe","Farina","Biscotti"]},
  {g:"Congelatore", items:["Piselli surgelati","Spinaci surgelati","Bastoncini di pesce","Gelato","Minestrone surgelato"]}
];
var SUGGERIMENTI_SPESA = ["Pane","Latte","Uova","Frutta","Verdura","Pasta","Passata","Acqua","Caffe","Yogurt","Formaggio","Carne","Pesce","Detersivo piatti","Carta igienica","Olio"];

var STILE_CONT = {
  frigo:    {bg:"linear-gradient(180deg,#EAF4FB,#D6EAF6)", bordo:"#BFD9EA", ripiano:"rgba(120,160,190,.38)", ic:"ti-fridge",     titolo:"Frigorifero", accent:"#2F6586", testo:"#2C3338"},
  dispensa: {bg:"linear-gradient(180deg,#F6ECD9,#E8D5AE)", bordo:"#E8D5AE", ripiano:"rgba(150,120,80,.40)",  ic:"ti-box",        titolo:"Dispensa",    accent:"#8A5A12", testo:"#2C3338"},
  freezer:  {bg:"linear-gradient(180deg,#E8F6FA,#CFEAF2)", bordo:"#BADFEA", ripiano:"rgba(110,170,190,.45)", ic:"ti-snowflake",  titolo:"Congelatore", accent:"#2F6586", testo:"#2C3338"}
};

var ORTOFRUTTA_K = ["insalata","lattuga","rucola","spinaci","pomodoro","pomodori","carota","carote",
  "zucchina","zucchine","cetriolo","broccoli","broccolo","cavolo","verza","peperone","peperoni",
  "melanzana","melanzane","limone","limoni","mela","mele","fragola","fragole","uva","banana","banane",
  "arancia","arance","mandarini","frutta","verdura","finocchi","sedano","radicchio","funghi","pera","pere","kiwi"];

function isOrtofrutta(nome) {
  var n = (nome || "").toLowerCase();
  var i;
  for(i=0;i<ORTOFRUTTA_K.length;i++) { if(n.indexOf(ORTOFRUTTA_K[i]) >= 0) return true; }
  return false;
}

function TesseraAlimento(props) {
  var cell = props.cell;
  var st = props.st || STILE_CONT.dispensa;
  var onRemove = props.onRemove || function(){};
  var low = dispensaLow(cell.it);
  var scad = scadStato(cell.it.scadenza);
  var cott = tempoCottura(cell.it.nome);
  return (
    <div style={{flex:"0 0 22%",maxWidth:"22%",position:"relative",
      display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
      <div onClick={function(){ onRemove(cell.i); }}
        style={{position:"absolute",top:-7,left:0,width:16,height:16,borderRadius:"50%",
          background:"#fff",border:"1px solid "+st.bordo,display:"flex",alignItems:"center",
          justifyContent:"center",cursor:"pointer",zIndex:2}}>
        <i className="ti ti-x" style={{fontSize:9,color:"#C2355A"}}/>
      </div>
      {cell.it.qty && String(cell.it.qty) !== "" && (
        <div style={{position:"absolute",top:-7,right:0,background:"#fff",
          border:"1px solid "+st.bordo,borderRadius:9,fontSize:8,fontWeight:800,
          color:st.accent,padding:"0 4px",minWidth:14,textAlign:"center",zIndex:2}}>{cell.it.qty}</div>
      )}
      <div style={{position:"relative"}}>
        <div style={{fontSize:30,lineHeight:1,filter:low?"grayscale(.5) opacity(.7)":"none"}}>{cell.emoji}</div>
        {scad && scad.t !== "OK" && (
          <span style={{position:"absolute",bottom:-1,right:-3,width:10,height:10,borderRadius:"50%",
            background:scad.c,border:"1.5px solid #fff"}}/>
        )}
      </div>
      <div style={{fontSize:8.5,fontWeight:600,color:st.testo,textAlign:"center",lineHeight:1.1,
        whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%"}}>{cell.it.nome}</div>
      {cott !== null && cott > 0 && (
        <div style={{fontSize:7.5,fontWeight:800,color:"#8A5A12",background:"#F6ECD9",
          borderRadius:6,padding:"0 4px",lineHeight:1.5}}>⏱ {cott}'</div>
      )}
    </div>
  );
}

function ScaffaleRipiani(props) {
  var items = props.items || [];
  var perRow = props.perRow || 4;
  var minRip = props.minRip || 1;
  var st = props.st || STILE_CONT.dispensa;
  var coloreRip = props.coloreRipiano || st.ripiano;
  var onRemove = props.onRemove || function(){};
  var nRip = Math.max(minRip, Math.ceil(items.length / perRow));
  var ripiani = [];
  var r;
  for(r=0;r<nRip;r++) { ripiani.push(items.slice(r*perRow, r*perRow + perRow)); }
  return (
    <div>
      {ripiani.map(function(row, ri){
        return (
          <div key={ri} style={{display:"flex",alignItems:"flex-end",gap:4,minHeight:60,
            borderBottom:"3px solid "+coloreRip,padding:"10px 2px 4px"}}>
            {row.length===0 && <div style={{flex:1,height:38}}/>}
            {row.map(function(cell){ return <TesseraAlimento key={cell.i} cell={cell} st={st} onRemove={onRemove}/>; })}
          </div>
        );
      })}
    </div>
  );
}

function RipianiBox(props) {
  var tipo = props.tipo;
  var items = props.items || [];
  var onRemove = props.onRemove || function(){};
  var st = STILE_CONT[tipo] || STILE_CONT.dispensa;
  return (
    <div style={{borderRadius:18,overflow:"hidden",border:"1.5px solid "+st.bordo,
      boxShadow:"0 2px 10px rgba(0,0,0,.06)"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:st.accent,color:"#fff"}}>
        <i className={"ti "+st.ic} style={{fontSize:18}}/>
        <span style={{fontSize:14,fontWeight:800,flex:1}}>{st.titolo}</span>
        <span style={{fontSize:11,fontWeight:700,opacity:.85}}>{items.length}</span>
      </div>
      <div style={{background:st.bg,padding:"4px 10px 10px"}}>
        <ScaffaleRipiani items={items} perRow={4} minRip={3} st={st} onRemove={onRemove}/>
      </div>
    </div>
  );
}

function ZonaRipiano(props) {
  var label = props.label;
  var items = props.items || [];
  var st = props.st || STILE_CONT.frigo;
  var body = (
    <ScaffaleRipiani items={items} perRow={4} minRip={props.minRip || 1} st={st}
      coloreRipiano={props.coloreRipiano} onRemove={props.onRemove}/>
  );
  return (
    <div style={{marginTop:4}}>
      <div style={{display:"flex",alignItems:"center",gap:5,margin:"3px 0 1px"}}>
        {props.icon && <i className={"ti "+props.icon} style={{fontSize:12,color:st.accent}}/>}
        <span style={{fontSize:9,fontWeight:800,color:st.accent,letterSpacing:"0.03em",flex:1}}>{label}</span>
        <span style={{fontSize:9,fontWeight:700,color:st.accent,opacity:.55}}>{items.length}</span>
      </div>
      {props.boxed ? (
        <div style={{borderRadius:10,border:"1.5px solid "+st.bordo,background:"rgba(255,255,255,.45)",padding:"2px 8px 2px"}}>{body}</div>
      ) : body}
    </div>
  );
}

function FrigoLG(props) {
  var frigo = props.frigo || [];
  var freezer = props.freezer || [];
  var onRemove = props.onRemove || function(){};
  var stF = STILE_CONT.freezer;
  var stR = STILE_CONT.frigo;
  var totale = frigo.length + freezer.length;
  function zr(z) { return frigo.filter(function(c){ return zonaFrigo(c.it.nome) === z; }); }
  function zf(z) { return freezer.filter(function(c){ return zonaFreezer(c.it.nome) === z; }); }
  var acciaio = "repeating-linear-gradient(90deg,#E3EAEE 0px,#EEF2F5 2px,#E3EAEE 4px,#CADCE8 6px)";
  var maniglia = {position:"absolute",right:-15,width:7,borderRadius:5,
    background:"linear-gradient(90deg,#8A949B,#CADCE8 55%,#8A949B)",
    boxShadow:"0 1px 3px rgba(0,0,0,.35)"};
  return (
    <div style={{position:"relative",paddingBottom:9}}>
      <div style={{position:"relative",borderRadius:"22px 22px 12px 12px",border:"2px solid #B4BEC4",
        background:acciaio,boxShadow:"0 8px 22px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.7),inset 0 -3px 8px rgba(0,0,0,.06)",
        padding:"7px 24px 9px 7px"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"4px 6px 8px"}}>
          <i className="ti ti-fridge" style={{fontSize:16,color:"#8A949B"}}/>
          <span style={{flex:1,fontSize:11,fontWeight:800,color:"#8A949B"}}>Il mio frigo</span>
          <span style={{fontSize:10,fontWeight:700,color:"#8A949B"}}>{totale} prodotti</span>
        </div>

        <div style={{position:"relative",marginBottom:9}}>
          <div style={{borderRadius:12,overflow:"hidden",border:"1.5px solid "+stF.bordo,background:stF.bg,
            boxShadow:"inset 0 0 0 2px rgba(255,255,255,.5)"}}>
            <div style={{display:"flex",alignItems:"center",gap:7,padding:"7px 12px",background:stF.accent,color:"#fff"}}>
              <i className="ti ti-snowflake" style={{fontSize:15}}/>
              <span style={{fontSize:12,fontWeight:800,flex:1}}>Congelatore</span>
              <span style={{fontSize:10,fontWeight:700,opacity:.85}}>{freezer.length}</span>
            </div>
            <div style={{padding:"0 10px 8px"}}>
              <ZonaRipiano label="GELATI E GHIACCIO" items={zf("alto")} st={stF} minRip={1} onRemove={onRemove}/>
              <ZonaRipiano label="SURGELATI" items={zf("basso")} st={stF} minRip={1} onRemove={onRemove}/>
            </div>
          </div>
          <div style={Object.assign({}, maniglia, {top:"26%",height:"48%"})}/>
        </div>

        <div style={{position:"relative"}}>
          <div style={{borderRadius:12,overflow:"hidden",border:"1.5px solid "+stR.bordo,background:stR.bg,
            boxShadow:"inset 0 0 0 2px rgba(255,255,255,.5)"}}>
            <div style={{display:"flex",alignItems:"center",gap:7,padding:"7px 12px",background:stR.accent,color:"#fff"}}>
              <i className="ti ti-fridge" style={{fontSize:15}}/>
              <span style={{fontSize:12,fontWeight:800,flex:1}}>Frigorifero</span>
              <span style={{fontSize:10,fontWeight:700,opacity:.85}}>{frigo.length}</span>
            </div>
            <div style={{padding:"0 10px 10px"}}>
              <ZonaRipiano label="RIPIANO ALTO · PRONTI E BEVANDE" items={zr("alto")} st={stR} minRip={1} onRemove={onRemove}/>
              <ZonaRipiano label="RIPIANO CENTRALE · LATTICINI, UOVA, SALUMI" items={zr("centrale")} st={stR} minRip={1} onRemove={onRemove}/>
              <ZonaRipiano label="RIPIANO BASSO · CARNE E PESCE (PIU FREDDO)" items={zr("basso")} st={stR} minRip={1} onRemove={onRemove}/>
              <ZonaRipiano label="BALCONCINI PORTA · SALSE E BEVANDE" items={zr("porta")} st={stR} minRip={1} boxed={true} onRemove={onRemove}/>
              <ZonaRipiano label="CASSETTI FRUTTA E VERDURA" items={zr("cassetto")} st={stR} minRip={1} boxed={true}
                coloreRipiano="rgba(120,160,190,.28)" onRemove={onRemove}/>
            </div>
          </div>
          <div style={Object.assign({}, maniglia, {top:"8%",height:"32%"})}/>
        </div>
      </div>
      <div style={{position:"absolute",bottom:0,left:16,width:22,height:9,borderRadius:"0 0 5px 5px",background:"#8A949B"}}/>
      <div style={{position:"absolute",bottom:0,right:16,width:22,height:9,borderRadius:"0 0 5px 5px",background:"#8A949B"}}/>
    </div>
  );
}

function DispensaView(props) {
  var dispensa = props.dispensa || [];
  var setDispensa = props.setDispensa || function(){};
  var spesa = props.spesa || [];
  var setSpesa = props.setSpesa || function(){};
  var s_add = useState(false); var showAdd = s_add[0]; var setShowAdd = s_add[1];
  var s_nome = useState(""); var nome = s_nome[0]; var setNome = s_nome[1];
  var s_qty = useState(""); var qty = s_qty[0]; var setQty = s_qty[1];
  var s_scad = useState(""); var scad = s_scad[0]; var setScad = s_scad[1];
  var s_cont = useState("auto"); var contSel = s_cont[0]; var setContSel = s_cont[1];
  var s_vista = useState("ripiani"); var vista = s_vista[0]; var setVista = s_vista[1];
  var s_mob = useState("frigo"); var mobile = s_mob[0]; var setMobile = s_mob[1];
  var s_guida = useState(false); var guida = s_guida[0]; var setGuida = s_guida[1];

  function aggiungi() {
    if(!nome.trim()) return;
    var cont = contSel === "auto" ? alimentoContenitore(nome) : contSel;
    var nuovo = {nome:nome.trim(), qty:qty||"1", unita:"pz", cat:"dispensa", contenitore:cont, scadenza:scad};
    setDispensa(dispensa.concat([nuovo]));
    setNome(""); setQty(""); setScad(""); setContSel("auto"); setShowAdd(false);
  }
  function aggiungiRapido(n) {
    var cont = alimentoContenitore(n);
    var gia = dispensa.some(function(x){ return (x.nome||"").toLowerCase() === n.toLowerCase(); });
    if(gia) return;
    setDispensa(dispensa.concat([{nome:n, qty:"1", unita:"pz", cat:"dispensa", contenitore:cont, scadenza:""}]));
  }
  function rimuoviItem(idx) {
    setDispensa(dispensa.filter(function(x, i){ return i !== idx; }));
  }
  function gruppo(tipo) {
    var out = [];
    dispensa.forEach(function(it, i){
      var c = it.contenitore || alimentoContenitore(it.nome);
      if(c === tipo) out.push({it:it, i:i, emoji:alimentoEmoji(it.nome)});
    });
    return out;
  }
  function aggiungiAllaSpesa() {
    var attuali = normSpesa(spesa);
    var esistenti = attuali.map(function(x){ return x.nome; });
    var nuovi = dispensa.filter(dispensaLow)
      .filter(function(it){ return esistenti.indexOf(it.nome) < 0; })
      .map(function(it){ return {nome:it.nome, cat:"dispensa", fatto:false}; });
    if(nuovi.length) setSpesa(attuali.concat(nuovi));
  }
  var oggiDisp = new Date().toISOString().split("T")[0];
  function giorniDopoApertoDef(n) {
    var s = (n||"").toLowerCase();
    if(s.indexOf("yogurt")>=0) return 2;
    if(s.indexOf("latte")>=0 || s.indexOf("panna")>=0) return 3;
    if(s.indexOf("prosciutto")>=0 || s.indexOf("salame")>=0 || s.indexOf("affettat")>=0 || s.indexOf("mortadella")>=0 || s.indexOf("wurstel")>=0) return 3;
    if(s.indexOf("formaggio")>=0 || s.indexOf("mozzarella")>=0 || s.indexOf("ricotta")>=0 || s.indexOf("stracchino")>=0) return 4;
    if(s.indexOf("succo")>=0 || s.indexOf("passata")>=0 || s.indexOf("pomodoro")>=0 || s.indexOf("salsa")>=0 || s.indexOf("sugo")>=0) return 4;
    return 3;
  }
  function addGiorniD(dstr, n) { var d = new Date(dstr+"T00:00:00"); d.setDate(d.getDate()+n); return d.toISOString().split("T")[0]; }
  function effAp(orig, apData, dur) { var apEnd = addGiorniD(apData||oggiDisp, dur); return (!orig || apEnd < orig) ? apEnd : orig; }
  function giorniRestanoD(dstr) { if(!dstr) return null; return Math.round((new Date(dstr+"T00:00:00") - new Date(oggiDisp+"T00:00:00"))/86400000); }
  function apriIdx(idx) { setDispensa(dispensa.map(function(x, i){
    if(i!==idx) return x;
    var dur = (x.durataAperto!=null ? x.durataAperto : giorniDopoApertoDef(x.nome));
    var orig = (x.scadenzaOrig!=null ? x.scadenzaOrig : (x.scadenza||""));
    return Object.assign({}, x, {aperto:true, apertoData:oggiDisp, durataAperto:dur, scadenzaOrig:orig, scadenza:effAp(orig, oggiDisp, dur)});
  })); }
  function chiudiIdx(idx) { setDispensa(dispensa.map(function(x, i){ if(i!==idx) return x; return Object.assign({}, x, {aperto:false, scadenza:(x.scadenzaOrig!=null?x.scadenzaOrig:x.scadenza)}); })); }
  function setDurIdx(idx, d) { setDispensa(dispensa.map(function(x, i){
    if(i!==idx) return x;
    var dur = Math.max(1, d);
    var orig = (x.scadenzaOrig!=null ? x.scadenzaOrig : (x.scadenza||""));
    return Object.assign({}, x, {durataAperto:dur, scadenza:effAp(orig, x.apertoData||oggiDisp, dur)});
  })); }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:8}}>
        <div style={{fontSize:23,fontWeight:800,letterSpacing:"-0.01em"}}>Dispensa</div>
        <i className="ti ti-plus" style={{fontSize:20,color:"#2F6586",cursor:"pointer"}}
          onClick={function(){ setShowAdd(!showAdd); }}/>
      </div>

      {showAdd&&(
        <div className="mf-card" style={{display:"flex",flexDirection:"column",gap:8}}>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <input placeholder="Prodotto" value={nome} onChange={function(e){setNome(e.target.value);}}
              style={{flex:1,padding:"10px 12px",borderRadius:12,border:"1px solid #E3EAEE",fontSize:14,outline:"none",fontFamily:"'Nunito',system-ui,sans-serif"}}/>
            <input placeholder="Qta" inputMode="numeric" value={qty} onChange={function(e){setQty(e.target.value);}}
              style={{width:60,padding:"10px",borderRadius:12,border:"1px solid #E3EAEE",fontSize:14,outline:"none",fontFamily:"'Nunito',system-ui,sans-serif"}}/>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <select value={contSel} onChange={function(e){setContSel(e.target.value);}}
              style={{flex:1,padding:"10px 12px",borderRadius:12,border:"1px solid #E3EAEE",fontSize:13,outline:"none",background:"#fff",fontFamily:"'Nunito',system-ui,sans-serif"}}>
              <option value="auto">{nome.trim() ? "Automatico ("+(STILE_CONT[alimentoContenitore(nome)]||STILE_CONT.dispensa).titolo+")" : "Automatico"}</option>
              <option value="frigo">Frigorifero</option>
              <option value="dispensa">Dispensa</option>
              <option value="freezer">Congelatore</option>
            </select>
            <input type="date" value={scad} onChange={function(e){setScad(e.target.value);}}
              title="Scadenza"
              style={{flex:1,padding:"10px 12px",borderRadius:12,border:"1px solid #E3EAEE",fontSize:13,outline:"none",background:"#fff",fontFamily:"'Nunito',system-ui,sans-serif"}}/>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <span style={{flex:1,fontSize:11,color:"#8A949B"}}>La scadenza e facoltativa</span>
            <button onClick={aggiungi} style={{padding:"10px 22px",borderRadius:12,border:"none",background:"#6BA6C9",color:"#fff",fontWeight:700,cursor:"pointer"}}>Aggiungi</button>
          </div>
        </div>
      )}

      <div className="mf-card acc" onClick={function(){ setGuida(!guida); }}
        style={{display:"flex",alignItems:"center",gap:9,cursor:"pointer",padding:"11px 14px"}}>
        <i className="ti ti-bulb" style={{fontSize:17}}/>
        <span style={{flex:1,fontSize:13,fontWeight:700}}>Guida rapida · tocca per riempire la dispensa</span>
        <i className={"ti "+(guida?"ti-chevron-up":"ti-chevron-down")} style={{fontSize:16}}/>
      </div>
      {guida&&(
        <div className="mf-card" style={{display:"flex",flexDirection:"column",gap:10}}>
          {SUGGERIMENTI_DISPENSA.map(function(grp){
            var st = STILE_CONT[grp.g==="Frigo"?"frigo":grp.g==="Congelatore"?"freezer":"dispensa"];
            return (
              <div key={grp.g}>
                <div style={{fontSize:10,fontWeight:800,color:st.accent,marginBottom:6,letterSpacing:"0.03em"}}>{grp.g.toUpperCase()}</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {grp.items.map(function(n){
                    var gia = dispensa.some(function(x){ return (x.nome||"").toLowerCase() === n.toLowerCase(); });
                    return (
                      <button key={n} onClick={function(){ aggiungiRapido(n); }} disabled={gia}
                        style={{display:"flex",alignItems:"center",gap:5,padding:"6px 10px",borderRadius:20,
                          border:"1.5px solid "+(gia?"#E3EAEE":st.bordo),cursor:gia?"default":"pointer",
                          background:gia?"#F2F6F8":"#fff",color:gia?"#B4BEC4":"#2C3338",fontSize:12,fontWeight:600,
                          fontFamily:"'Nunito',system-ui,sans-serif"}}>
                        <span style={{fontSize:14}}>{alimentoEmoji(n)}</span>{n}
                        {!gia&&<i className="ti ti-plus" style={{fontSize:12,color:st.accent}}/>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{display:"flex",gap:6}}>
        {[{id:"ripiani",l:"Ripiani"},{id:"lista",l:"Lista"}].map(function(v){
          var on = vista === v.id;
          return (
            <button key={v.id} onClick={function(){ setVista(v.id); }}
              style={{flex:1,padding:"8px",borderRadius:12,border:"none",cursor:"pointer",
                background:on?"#2F6586":"#fff",color:on?"#fff":"#555",fontWeight:on?700:400,fontSize:12,
                boxShadow:on?"none":"0 1px 6px rgba(0,0,0,.07)"}}>{v.l}</button>
          );
        })}
      </div>

      {vista==="ripiani" ? (
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",gap:6}}>
            {[{id:"frigo",l:"Frigo · Congelatore",ic:"ti-fridge"},{id:"dispensa",l:"Dispensa",ic:"ti-box"}].map(function(v){
              var on = mobile === v.id;
              return (
                <button key={v.id} onClick={function(){ setMobile(v.id); }}
                  style={{flex:1,padding:"7px",borderRadius:10,border:"1.5px solid "+(on?"#6BA6C9":"#E3EAEE"),cursor:"pointer",
                    display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                    background:on?"#E2EEF5":"#fff",color:on?"#2F6586":"#8A949B",fontWeight:on?700:600,fontSize:12}}>
                  <i className={"ti "+v.ic} style={{fontSize:15}}/>{v.l}
                </button>
              );
            })}
          </div>
          {mobile==="frigo" ? (
            <FrigoLG frigo={gruppo("frigo")} freezer={gruppo("freezer")} onRemove={rimuoviItem}/>
          ) : (
            <RipianiBox tipo="dispensa" items={gruppo("dispensa")} onRemove={rimuoviItem}/>
          )}
          {dispensa.length===0 && (
            <div style={{fontSize:12,color:"#8A949B",textAlign:"center"}}>
              Aggiungi un prodotto col + in alto o dalla guida rapida: comparira al posto giusto.
            </div>
          )}
        </div>
      ) : (
      <div className="mf-card flush">
        {dispensa.length===0&&(
          <div className="mf-row"><div style={{flex:1,fontSize:14,color:"#8A949B"}}>Dispensa vuota</div></div>
        )}
        {dispensa.map(function(it, i){
          var low = dispensaLow(it);
          var ss = scadStato(it.scadenza);
          var cott = tempoCottura(it.nome);
          var dur = (it.durataAperto!=null ? it.durataAperto : giorniDopoApertoDef(it.nome));
          var rem = giorniRestanoD(it.scadenza);
          return (
            <div key={i} className="mf-row">
              <div className="mf-ic" style={{fontSize:20}}>{alimentoEmoji(it.nome)}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:500,display:"flex",alignItems:"center",gap:6}}>{it.nome}{it.aperto&&<span onClick={function(){ chiudiIdx(i); }} style={{fontSize:9,fontWeight:800,color:"#8A5A12",background:"#F6ECD9",borderRadius:20,padding:"2px 7px",cursor:"pointer"}}>Aperto</span>}</div>
                <div style={{fontSize:11,color:"#8A949B",display:"flex",gap:8,flexWrap:"wrap"}}>
                  <span>{(it.qty||"")+" "+(it.unita||"")}</span>
                  {cott !== null && cott > 0 && <span style={{color:"#8A5A12",fontWeight:700}}>⏱ {cott} min</span>}
                  {it.aperto ? <span style={{color:(rem!=null&&rem<=1)?"#C2355A":"#8A5A12",fontWeight:700}}>{rem<0?"Scaduto":(rem===0?"Da finire oggi":("Restano "+rem+(rem===1?" giorno":" giorni")))}</span> : (ss && <span style={{color:ss.c,fontWeight:700}}>{ss.t==="OK"?"Scade "+it.scadenza:ss.t}</span>)}
                </div>
              </div>
              {it.aperto ? (
                <div style={{display:"flex",alignItems:"center",gap:3,background:"#F2F6F8",borderRadius:20,padding:3,marginLeft:6}}>
                  <button onClick={function(){ setDurIdx(i,dur-1); }} style={{width:21,height:21,borderRadius:"50%",border:"none",background:"#fff",color:"#2F6586",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif"}}>−</button>
                  <span style={{fontSize:9,fontWeight:800,color:"#2F6586",minWidth:30,textAlign:"center"}}>{dur} gg</span>
                  <button onClick={function(){ setDurIdx(i,dur+1); }} style={{width:21,height:21,borderRadius:"50%",border:"none",background:"#fff",color:"#2F6586",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif"}}>+</button>
                </div>
              ) : (
                <button onClick={function(){ apriIdx(i); }} style={{border:"1.5px solid #6BA6C9",background:"#fff",color:"#2F6586",borderRadius:20,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif",display:"flex",alignItems:"center",gap:4,marginLeft:6}}><i className="ti ti-lock-open" style={{fontSize:12}}/>Apri</button>
              )}
              <i className="ti ti-x" onClick={function(){ rimuoviItem(i); }}
                style={{fontSize:16,color:"#B4BEC4",cursor:"pointer",marginLeft:8}}/>
            </div>
          );
        })}
      </div>
      )}

      <div className="mf-card solid" onClick={aggiungiAllaSpesa}
        style={{display:"flex",alignItems:"center",justifyContent:"center",gap:9,fontSize:14,fontWeight:700,cursor:"pointer"}}>
        <i className="ti ti-shopping-bag-plus" style={{fontSize:17}}/>Aggiungi in esaurimento alla lista spesa
      </div>
    </div>
  );
}

function CalorieView(props) {
  var menu = props.menu || {};
  var builder = props.builder || {};
  var profili = props.profili || {};
  var now = new Date();
  var oggiIdx = (now.getDay()+6)%7;
  var oggiApp = DAYS[oggiIdx];
  function kcalPasto(giorno, m) {
    var info = pastoUnificato(builder, menu, giorno, m);
    return info ? info.kcal : 0;
  }
  var pasti = [
    {m:"Colazione", k:kcalPasto(oggiApp,"Colazione")},
    {m:"Pranzo", k:kcalPasto(oggiApp,"Pranzo")},
    {m:"Cena", k:kcalPasto(oggiApp,"Cena")}
  ];
  var vals = Object.values(profili);
  var target = vals.length ? Math.max.apply(null, vals.map(function(p){ return p.kcal_target || 2000; })) : 2000;
  var totOggi = pasti.reduce(function(s,x){ return s + x.k; }, 0);
  var pct = Math.min(100, Math.round(totOggi/target*100));
  var settimana = DAYS.map(function(d){
    return ["Colazione","Spuntino","Pranzo","Merenda","Cena"].reduce(function(s,m){ return s + kcalPasto(d,m); }, 0);
  });
  var maxSett = Math.max.apply(null, settimana.concat([1]));
  var conDati = settimana.filter(function(x){ return x>0; });
  var media = conDati.length ? Math.round(conDati.reduce(function(s,x){return s+x;},0)/conDati.length) : 0;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{fontSize:23,fontWeight:800,letterSpacing:"-0.01em",paddingTop:8}}>Calorie</div>

      <div className="mf-card" style={{display:"flex",alignItems:"center",gap:18}}>
        <div style={{position:"relative",width:90,height:90,flexShrink:0}}>
          <svg viewBox="0 0 36 36" width="90" height="90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#E3EAEE" strokeWidth="3.2"/>
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#6BA6C9" strokeWidth="3.2"
              pathLength="100" strokeDasharray={pct+" "+(100-pct)} strokeLinecap="round" transform="rotate(-90 18 18)"/>
          </svg>
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:19,fontWeight:700}}>{totOggi}</span>
            <span style={{fontSize:11,color:"#8A949B"}}>/ {target}</span>
          </div>
        </div>
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:10}}>
          {pasti.map(function(p){
            return (
              <div key={p.m}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                  <span style={{color:"#8A949B"}}>{p.m}</span><span style={{color:"#8A949B"}}>{p.k}</span>
                </div>
                <div className="mf-track"><span style={{width:Math.min(100,p.k/target*100)+"%"}}/></div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mf-card">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <span className="cap">Andamento settimana</span>
          <span style={{fontSize:11,color:"#8A949B"}}>media {media}</span>
        </div>
        <div style={{display:"flex",alignItems:"flex-end",gap:9,height:72}}>
          {settimana.map(function(v, i){
            var h = v>0 ? Math.max(8, Math.round(v/maxSett*64)) : 6;
            var oggi = i===oggiIdx;
            return (
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
                <div style={{width:"100%",borderRadius:6,height:h,
                  background:oggi?"#E2EEF5":(v>0?"#6BA6C9":"#E3EAEE"),
                  border:oggi?"1px solid #6BA6C9":"none"}}/>
                <div style={{fontSize:11,color:oggi?"#2F6586":"#8A949B",fontWeight:oggi?700:400}}>{GIORNI_ABBR[i].slice(0,1)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DiarioView(props) {
  var menu = props.menu || {};
  var builder = props.builder || {};
  var profili = props.profili || {};
  var diario = props.diario || {};
  var setDiario = props.setDiario || function(){};
  var vals = Object.values(profili);

  var s_mid = useState(""); var midSel = s_mid[0]; var setMidSel = s_mid[1];
  var s_showAdd = useState(false); var showAdd = s_showAdd[0]; var setShowAdd = s_showAdd[1];
  var s_an = useState(""); var addNome = s_an[0]; var setAddNome = s_an[1];
  var s_ak = useState(""); var addKcal = s_ak[0]; var setAddKcal = s_ak[1];
  var s_ap = useState("Pranzo"); var addPasto = s_ap[0]; var setAddPasto = s_ap[1];

  var now = new Date();
  var dateKey = now.getFullYear() + "-" + ("0"+(now.getMonth()+1)).slice(-2) + "-" + ("0"+now.getDate()).slice(-2);
  var oggiApp = DAYS[(now.getDay()+6)%7];
  var ordine = ["Colazione","Spuntino","Pranzo","Merenda","Cena"];

  var membro = profili[midSel] || vals[0] || null;
  var mkey = membro ? membro.id : "";
  var giornoRec = diario[dateKey] || {};
  var rec = giornoRec[mkey] || {items:[], acqua:0};
  var items = rec.items || [];
  var acqua = rec.acqua || 0;
  var target = membro ? (membro.kcal_target || 2000) : 2000;
  var consumate = items.reduce(function(s,x){ return s + (x.kcal||0); }, 0);
  var rimaste = Math.max(0, target - consumate);
  var pct = target > 0 ? Math.min(100, Math.round(consumate/target*100)) : 0;

  function salvaRec(nuovoRec) {
    var g = Object.assign({}, diario[dateKey] || {});
    g[mkey] = nuovoRec;
    var nd = Object.assign({}, diario);
    nd[dateKey] = g;
    setDiario(nd);
  }
  function aggiungiVoce(pasto, nome, kcal) {
    var id = "e" + now.getTime() + "_" + Math.round(consumate + items.length + nome.length);
    salvaRec({items: items.concat([{id:id, pasto:pasto, nome:nome, kcal:kcal||0}]), acqua:acqua});
  }
  function rimuoviVoce(id) {
    salvaRec({items: items.filter(function(x){ return x.id !== id; }), acqua:acqua});
  }
  function setAcqua(n) {
    salvaRec({items:items, acqua: Math.max(0, Math.min(12, n))});
  }
  function addExtra() {
    if(!addNome.trim()) return;
    aggiungiVoce(addPasto, addNome.trim(), parseInt(addKcal, 10) || 0);
    setAddNome(""); setAddKcal(""); setShowAdd(false);
  }

  var suggeriti = [];
  ordine.forEach(function(m){
    var info = pastoUnificato(builder, menu, oggiApp, m);
    if(info) suggeriti.push({pasto:m, nome:info.nome, kcal:info.kcal});
  });

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:8}}>
        <div style={{fontSize:23,fontWeight:800,letterSpacing:"-0.01em"}}>Diario</div>
        <span style={{fontSize:13,color:"#8A949B"}}>Oggi</span>
      </div>

      {vals.length===0 ? (
        <div className="mf-card" style={{textAlign:"center",color:"#8A949B",fontSize:13}}>
          Aggiungi prima un membro della famiglia dalle Impostazioni.
        </div>
      ) : (
      <div style={{display:"flex",flexDirection:"column",gap:14}}>

      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:2}}>
        {vals.map(function(p){
          var on = mkey === p.id;
          return (
            <button key={p.id} onClick={function(){ setMidSel(p.id); }}
              style={{display:"flex",alignItems:"center",gap:7,padding:"6px 12px 6px 6px",borderRadius:22,
                flexShrink:0,cursor:"pointer",border:"1.5px solid "+(on?"#2F6586":"#E3EAEE"),
                background:on?"#E2EEF5":"#fff",fontFamily:"'Nunito',system-ui,sans-serif"}}>
              <span style={{width:26,height:26,borderRadius:"50%",background:p.colore||"#6BA6C9",color:"#fff",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800}}>
                {p.nome ? p.nome.slice(0,1).toUpperCase() : "?"}
              </span>
              <span style={{fontSize:13,fontWeight:on?800:600,color:on?"#2F6586":"#2C3338"}}>{p.nome}</span>
            </button>
          );
        })}
      </div>

      <div className="mf-card">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <div>
            <div className="cap">Consumate {membro ? "· "+membro.nome : ""}</div>
            <div style={{fontSize:23,fontWeight:700}}>{consumate} <span style={{fontSize:13,color:"#8A949B",fontWeight:400}}>/ {target} kcal</span></div>
          </div>
          <div style={{textAlign:"right"}}>
            <div className="cap">Rimaste</div>
            <div style={{fontSize:19,fontWeight:700,color:rimaste>0?"#2F6586":"#C2355A"}}>{rimaste}</div>
          </div>
        </div>
        <div className="mf-track"><span style={{width:pct+"%",background:consumate>target?"#C2355A":"#6BA6C9"}}/></div>
      </div>

      <div>
        <div className="cap" style={{marginBottom:8}}>Mangiato oggi</div>
        <div className="mf-card flush">
          {items.length===0&&(
            <div className="mf-row">
              <div className="mf-ic" style={{background:"transparent",border:"1.5px dashed #CADCE8",color:"#8A949B"}}><i className="ti ti-checkbox"/></div>
              <div style={{flex:1,fontSize:13,color:"#8A949B"}}>Segna cosa ha mangiato {membro ? membro.nome : ""}: usa i suggerimenti sotto o aggiungi un cibo.</div>
            </div>
          )}
          {ordine.map(function(m){
            var rows = items.filter(function(x){ return x.pasto === m; });
            if(!rows.length) return null;
            return rows.map(function(r){
              return (
                <div key={r.id} className="mf-row">
                  <div className="mf-ic"><i className={"ti "+(ICONE_PASTO[m]||"ti-tools-kitchen-2")}/></div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:500}}>{r.nome}</div>
                    <div style={{fontSize:11,color:"#8A949B"}}>{m}</div>
                  </div>
                  <span style={{fontSize:13,color:"#8A949B",marginRight:8}}>{r.kcal ? r.kcal+" kcal" : "-"}</span>
                  <i className="ti ti-x" onClick={function(){ rimuoviVoce(r.id); }}
                    style={{fontSize:16,color:"#B4BEC4",cursor:"pointer"}}/>
                </div>
              );
            });
          })}
        </div>
      </div>

      {suggeriti.length>0&&(
        <div>
          <div className="cap" style={{marginBottom:8}}>Dal menu di oggi · tocca per segnare come mangiato</div>
          <div className="mf-card flush">
            {suggeriti.map(function(s){
              return (
                <div key={s.pasto} className="mf-row" style={{cursor:"pointer"}}
                  onClick={function(){ aggiungiVoce(s.pasto, s.nome, s.kcal); }}>
                  <div className="mf-ic" style={{background:"#EBF3FA"}}><i className={"ti "+(ICONE_PASTO[s.pasto]||"ti-tools-kitchen-2")}/></div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:500}}>{s.nome}</div>
                    <div style={{fontSize:11,color:"#8A949B"}}>{s.pasto}{s.kcal?" · "+s.kcal+" kcal":""}</div>
                  </div>
                  <i className="ti ti-plus" style={{fontSize:18,color:"#2F6586"}}/>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showAdd ? (
        <div className="mf-card" style={{display:"flex",flexDirection:"column",gap:8}}>
          <input placeholder="Cosa ha mangiato" value={addNome} onChange={function(e){setAddNome(e.target.value);}}
            style={{padding:"10px 12px",borderRadius:12,border:"1px solid #E3EAEE",fontSize:14,outline:"none",fontFamily:"'Nunito',system-ui,sans-serif"}}/>
          <div style={{display:"flex",gap:8}}>
            <select value={addPasto} onChange={function(e){setAddPasto(e.target.value);}}
              style={{flex:1,padding:"10px 12px",borderRadius:12,border:"1px solid #E3EAEE",fontSize:13,outline:"none",background:"#fff",fontFamily:"'Nunito',system-ui,sans-serif"}}>
              {ordine.map(function(m){ return <option key={m} value={m}>{m}</option>; })}
            </select>
            <input placeholder="kcal" inputMode="numeric" value={addKcal} onChange={function(e){setAddKcal(e.target.value.replace(/[^0-9]/g,""));}}
              style={{width:80,padding:"10px",borderRadius:12,border:"1px solid #E3EAEE",fontSize:14,outline:"none",fontFamily:"'Nunito',system-ui,sans-serif"}}/>
            <button onClick={addExtra} style={{padding:"10px 16px",borderRadius:12,border:"none",background:"#6BA6C9",color:"#fff",fontWeight:700,cursor:"pointer"}}>OK</button>
          </div>
        </div>
      ) : (
        <button onClick={function(){ setShowAdd(true); }}
          style={{width:"100%",padding:"12px",borderRadius:14,border:"1.5px solid #6BA6C9",background:"#fff",
            color:"#2F6586",fontSize:14,fontWeight:700,cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <i className="ti ti-plus" style={{fontSize:17}}/>Aggiungi un cibo mangiato
        </button>
      )}

      <div className="mf-card" style={{display:"flex",alignItems:"center",gap:12}}>
        <i className="ti ti-droplet" style={{fontSize:19,color:"#6BA6C9"}}/>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:6}}>Acqua - {acqua} / 8 bicchieri</div>
          <div className="mf-track"><span style={{width:Math.min(100,acqua/8*100)+"%"}}/></div>
        </div>
        <button onClick={function(){ setAcqua(acqua-1); }}
          style={{width:32,height:32,borderRadius:10,border:"1px solid #E3EAEE",background:"#fff",color:"#2F6586",fontSize:18,cursor:"pointer"}}>-</button>
        <button onClick={function(){ setAcqua(acqua+1); }}
          style={{width:32,height:32,borderRadius:10,border:"none",background:"#6BA6C9",color:"#fff",fontSize:18,cursor:"pointer"}}>+</button>
      </div>

      </div>
      )}
    </div>
  );
}

function HomeView(props) {
  var profili = props.profili || {};
  var menu = props.menu || {};
  var builder = props.builder || {};
  var dispensa = props.dispensa || [];
  var mealPrep = props.mealPrep || [];
  var giorniFuori = props.giorniFuori || {};
  var pianiObj = props.piani || {};
  var pianiLista = (pianiObj && pianiObj.lista) ? pianiObj.lista : [];
  var setTab = props.setTab || function(){};
  var setSpesa = props.setSpesa || function(){};
  var toggleFuori = props.toggleFuori || function(){};
  var medicine = props.medicine || {};
  var setMedicine = props.setMedicine || function(){};
  var noteGiorno = props.noteGiorno || {};
  var setNoteGiorno = props.setNoteGiorno || function(){};
  var oggiIso = isoDay(new Date());
  var sNoteDraft = useState({}); var noteDraft = sNoteDraft[0]; var setNoteDraft = sNoteDraft[1];

  var GIORNI_FULL = ["Lunedi","Martedi","Mercoledi","Giovedi","Venerdi","Sabato","Domenica"];
  var GIORNI_SHORT = ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];
  var mesiAbbr = ["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
  var giorniLabel = ["Domenica","Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato"];
  var now = new Date();
  var todayIdx = (now.getDay()+6)%7;
  var gOggi = GIORNI_FULL[todayIdx];
  var gShort = GIORNI_SHORT[todayIdx];
  var isWeekday = todayIdx <= 4;
  var dataLabel = "Oggi · " + giorniLabel[now.getDay()] + " " + now.getDate() + " " + mesiAbbr[now.getMonth()];

  var cardStyle = {background:"#fff",border:"1px solid #E3EAEE",borderRadius:16,padding:"14px 15px"};
  var warmCardStyle = {background:"#FDF9F0",border:"1px solid #E8D5AE",borderRadius:16,padding:"14px 15px"};
  var ctStyle = {fontSize:11,fontWeight:800,letterSpacing:"0.04em",textTransform:"uppercase",color:"#8A949B",marginBottom:11,display:"flex",alignItems:"center",gap:7};
  var ctWarm = {fontSize:11,fontWeight:800,letterSpacing:"0.04em",textTransform:"uppercase",color:"#8A5A12",marginBottom:11,display:"flex",alignItems:"center",gap:7};
  var warnRow = {background:"#F6ECD9",borderRadius:11,padding:"10px 12px",color:"#8A5A12",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:8};

  function pastoInfo(m) { return pastoUnificato(builder, menu, gOggi, m); }
  var pranzoInfo = pastoInfo("Pranzo");
  var cenaInfo = pastoInfo("Cena");

  function catIcona(cat) {
    if(cat === "pesce") return "ti-fish";
    if(cat === "legumi") return "ti-plant-2";
    if(cat === "uova") return "ti-egg";
    if(cat === "latticini") return "ti-cheese";
    return "ti-meat";
  }
  function mealIcona(pasto) {
    var s = builder[gOggi+"-"+pasto];
    if(s && s.piattoUnico && s.piattoUnico.nome && (""+s.piattoUnico.nome).trim()) return "ti-tools-kitchen-2";
    if(s && s.proteina) { var it = ingById(s.proteina); if(it) return catIcona(it.cat); }
    return pasto === "Pranzo" ? "ti-sun" : "ti-moon";
  }

  function isFuori(pid) {
    var sf = giorniFuori[gOggi];
    if(!sf) return false;
    if(typeof sf.has === "function") return sf.has(pid);
    if(Array.isArray(sf)) return sf.indexOf(pid) >= 0;
    return false;
  }
  function dovePid(pid) {
    if(isFuori(pid)) return "fuori";
    var mensa = false; var dieta = false;
    pianiLista.forEach(function(pl){
      if(!pl || pl.membroId !== pid) return;
      var wk = settimanaPianoNum(pl, now);
      var w = (pl.settimane || {})[wk];
      var d = (w && w.giorni) ? w.giorni[gShort] : null;
      if(!d) return;
      if(pl.tipo === "mensa") { if(isWeekday && d.pranzo && (""+d.pranzo).trim()) mensa = true; }
      else if(pl.tipo === "membro") {
        var qualcosa = Object.keys(d).some(function(k){ return d[k] && (""+d[k]).trim(); });
        if(qualcosa) dieta = true;
      }
    });
    if(mensa) return "mensa";
    if(dieta) return "dieta";
    return "casa";
  }
  function badgeInfo(stato) {
    if(stato === "fuori") return {bg:"#FBE7EC",tx:"#C2355A",ic:"ti-door-exit",label:"Fuori"};
    if(stato === "mensa") return {bg:"#F6ECD9",tx:"#8A5A12",ic:"ti-school",label:"Mensa"};
    if(stato === "dieta") return {bg:"#E2EEF5",tx:"#2F6586",ic:"ti-salad",label:"Dieta"};
    return {bg:"#E2EEF5",tx:"#2F6586",ic:"ti-home",label:"Casa"};
  }

  function scadenzaEntro(scad, giorni) {
    if(!scad) return false;
    var o = new Date(); o.setHours(0,0,0,0);
    var d = new Date(scad+"T00:00:00");
    if(isNaN(d.getTime())) return false;
    return (d.getTime() - o.getTime()) / 86400000 <= giorni;
  }
  function giorniA(scad) {
    var o = new Date(); o.setHours(0,0,0,0);
    var d = new Date(scad+"T00:00:00");
    if(isNaN(d.getTime())) return "";
    var n = Math.round((d.getTime() - o.getTime()) / 86400000);
    if(n <= 0) return "oggi";
    if(n === 1) return "domani";
    return "tra " + n + " giorni";
  }

  var mancantiOggi = [];
  [{m:"Pranzo",l:"il pranzo"},{m:"Cena",l:"la cena"}].forEach(function(pp){
    var s = builder[gOggi+"-"+pp.m]; if(!s) return;
    var nomi = [];
    if(s.piattoUnico && s.piattoUnico.riconosciuti && s.piattoUnico.riconosciuti.length) {
      s.piattoUnico.riconosciuti.forEach(function(r){ if(r && r.nome) nomi.push(r.nome); });
    }
    ["proteina","carbo","verdura","verdura2"].forEach(function(k){
      var id = s[k]; if(!id) return; var it = ingById(id); if(it && it.nome) nomi.push(it.nome);
    });
    nomi.forEach(function(nome){
      var low = (""+nome).toLowerCase();
      var inDisp = dispensa.some(function(d){
        if(!d || !d.nome) return false;
        var dn = (""+d.nome).toLowerCase();
        return dn.indexOf(low) >= 0 || low.indexOf(dn) >= 0;
      });
      var gia = mancantiOggi.some(function(x){ return x.nome === nome; });
      if(!inDisp && !gia) mancantiOggi.push({nome:nome, pasto:pp.l});
    });
  });
  mancantiOggi = mancantiOggi.slice(0,5);

  function aggiungiSpesa() {
    setSpesa(function(prev){
      var arr = normSpesa(prev);
      mancantiOggi.forEach(function(mm){
        var low = mm.nome.toLowerCase();
        var gia = arr.some(function(x){ return (""+x.nome).toLowerCase() === low; });
        if(!gia) arr.push({nome:mm.nome, cat:catDaParola(mm.nome), fatto:false});
      });
      return arr;
    });
    setTab("spesa");
  }

  var protCount = {pesce:0,carne:0,legumi:0,uova:0};
  GIORNI_FULL.forEach(function(g){
    ["Pranzo","Cena"].forEach(function(m){
      var s = builder[g+"-"+m]; if(!s || !s.proteina) return;
      var it = ingById(s.proteina); if(!it) return;
      if(it.cat === "pesce") protCount.pesce++;
      else if(it.cat === "legumi") protCount.legumi++;
      else if(it.cat === "uova") protCount.uova++;
      else protCount.carne++;
    });
  });
  var protCats = [
    {key:"pesce",label:"Pesce",ic:"ti-fish"},
    {key:"carne",label:"Carne",ic:"ti-meat"},
    {key:"legumi",label:"Legumi",ic:"ti-plant-2"},
    {key:"uova",label:"Uova",ic:"ti-egg"}
  ];
  var zeroCats = protCats.filter(function(c){ return protCount[c.key] === 0; });

  var prepScad = mealPrep.filter(function(p){ return p && p.porzioniRimaste > 0 && scadenzaEntro(p.scadenza, 3); });
  var dispScad = dispensa.filter(function(d){ return d && scadenzaEntro(d.scadenza, 3); });

  var membriPid = Object.keys(profili);

  function toggleDoseHome(pid, medId, idx) {
    setMedicine(function(prev){
      var m = Object.assign({}, prev || {});
      var arr = (m[pid] || []).map(function(x){ return Object.assign({}, x); });
      arr.forEach(function(md){
        if(md.id === medId){
          md.log = Object.assign({}, md.log || {});
          var day = (md.log[oggiIso] || []).slice();
          while(day.length < md.volte) day.push(false);
          day[idx] = !day[idx];
          md.log[oggiIso] = day;
        }
      });
      m[pid] = arr;
      return m;
    });
  }
  function presiOggi(md) {
    var day = (md.log && md.log[oggiIso]) || [];
    var n = 0; for(var i=0;i<md.volte;i++){ if(day[i]) n++; }
    return n;
  }
  var membriMed = membriPid.map(function(pid){
    return {pid:pid, p:profili[pid] || {}, meds:(medicine[pid] || [])};
  }).filter(function(x){ return x.meds.length > 0; });

  function notaSalvata(pid) { var pn = noteGiorno[pid] || {}; return pn[oggiIso] || ""; }
  function notaVal(pid) { return (noteDraft[pid] !== undefined) ? noteDraft[pid] : notaSalvata(pid); }
  function onNotaChange(pid, v) { setNoteDraft(function(prev){ var n = Object.assign({}, prev); n[pid] = v; return n; }); }
  function commitNota(pid) {
    var v = notaVal(pid);
    setNoteGiorno(function(prev){
      var m = Object.assign({}, prev || {});
      var pn = Object.assign({}, m[pid] || {});
      if(v && v.trim()) pn[oggiIso] = v; else delete pn[oggiIso];
      m[pid] = pn;
      return m;
    });
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{paddingTop:8}}>
        <div style={{fontSize:13,color:"#8A949B",fontWeight:700}}>Buongiorno</div>
        <div style={{fontSize:23,fontWeight:800,letterSpacing:"-0.01em",marginTop:2}}>{dataLabel}</div>
      </div>

      <div style={cardStyle}>
        <div style={ctStyle}><i className="ti ti-tools-kitchen-2" style={{color:"#2F6586",fontSize:15}}/>Oggi si mangia</div>
        {[{m:"Pranzo",info:pranzoInfo},{m:"Cena",info:cenaInfo}].map(function(row, idx){
          var info = row.info;
          return (
            <div key={row.m} style={{display:"flex",alignItems:"center",gap:11,padding:"8px 0",borderTop:idx>0?"1px solid #F1F4F6":"none"}}>
              <div style={{width:36,height:36,borderRadius:11,background:"#E2EEF5",color:"#2F6586",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}><i className={"ti "+mealIcona(row.m)}/></div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:800}}>{row.m}</div>
                <div style={{fontSize:11,color:"#8A949B",fontWeight:600}}>{info ? info.nome : "Da pianificare"}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={cardStyle}>
        <div style={ctStyle}><i className="ti ti-users" style={{color:"#2F6586",fontSize:15}}/>La famiglia oggi</div>
        {membriPid.length === 0 && (
          <div style={{fontSize:13,color:"#8A949B"}}>Nessun membro configurato.</div>
        )}
        {membriPid.map(function(pid, idx){
          var p = profili[pid] || {};
          var stato = dovePid(pid);
          var b = badgeInfo(stato);
          var col = p.colore || "#2F6586";
          var ini = (p.nome ? p.nome.slice(0,1) : "?").toUpperCase();
          return (
            <div key={pid} onClick={function(){ toggleFuori(gOggi, pid); }}
              style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderTop:idx>0?"1px solid #F1F4F6":"none",cursor:"pointer"}}>
              <div style={{width:26,height:26,borderRadius:"50%",background:col,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,flexShrink:0}}>{ini}</div>
              <div style={{fontSize:14,fontWeight:700}}>{p.nome || "—"}</div>
              <span style={{marginLeft:"auto",fontSize:11,fontWeight:800,padding:"4px 10px",borderRadius:20,display:"flex",alignItems:"center",gap:5,background:b.bg,color:b.tx}}>
                <i className={"ti "+b.ic} style={{fontSize:12}}/>{b.label}
              </span>
            </div>
          );
        })}
        {membriPid.length > 0 && (
          <div style={{fontSize:10,color:"#8A949B",marginTop:9}}>Tocca un membro per l'eccezione di oggi (es. oggi mangia fuori)</div>
        )}
      </div>

      {membriMed.length > 0 && (
        <div style={cardStyle}>
          <div style={ctStyle}><i className="ti ti-pill" style={{color:"#2F6586",fontSize:15}}/>Medicine di oggi</div>
          {membriMed.map(function(mm, mi){
            var p = mm.p; var col = p.colore || "#2F6586";
            var ini = (p.nome ? p.nome.slice(0,1) : "?").toUpperCase();
            return (
              <div key={mm.pid} style={{paddingTop:mi>0?10:0,marginTop:mi>0?10:0,borderTop:mi>0?"1px solid #F1F4F6":"none"}}>
                <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:8}}>
                  <div style={{width:24,height:24,borderRadius:"50%",background:col,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,flexShrink:0}}>{ini}</div>
                  <div style={{fontSize:13,fontWeight:800}}>{p.nome || "—"}</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:9}}>
                  {mm.meds.map(function(md){
                    var presi = presiOggi(md);
                    var completo = presi >= md.volte;
                    return (
                      <div key={md.id} style={{display:"flex",alignItems:"center",gap:9}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{md.nome}</div>
                          {(md.dose || md.quando) ? (
                            <div style={{fontSize:11,color:"#8A949B",fontWeight:600}}>{[md.dose, md.quando].filter(Boolean).join(" · ")}</div>
                          ) : null}
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                          {Array.apply(null, {length:md.volte}).map(function(x, idx){
                            var day = (md.log && md.log[oggiIso]) || [];
                            var on = !!day[idx];
                            return (
                              <button key={idx} onClick={function(){ toggleDoseHome(mm.pid, md.id, idx); }}
                                style={{width:30,height:30,borderRadius:"50%",cursor:"pointer",border:"1.5px solid "+(on?"#2F6586":"#CADCE8"),background:on?"#2F6586":"#fff",color:on?"#fff":"#CADCE8",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontFamily:"'Nunito',system-ui,sans-serif"}}>
                                <i className={"ti "+(on?"ti-check":"ti-plus")}/>
                              </button>
                            );
                          })}
                          <span style={{fontSize:11,fontWeight:800,color:completo?"#2F6586":"#8A949B",minWidth:34,textAlign:"right"}}>{completo?"Fatto":(presi+"/"+md.volte)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {membriPid.length > 0 && (
        <div style={cardStyle}>
          <div style={ctStyle}><i className="ti ti-note" style={{color:"#2F6586",fontSize:15}}/>Nota di oggi</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {membriPid.map(function(pid){
              var p = profili[pid] || {};
              var col = p.colore || "#2F6586";
              var ini = (p.nome ? p.nome.slice(0,1) : "?").toUpperCase();
              return (
                <div key={pid} style={{display:"flex",alignItems:"center",gap:9}}>
                  <div style={{width:24,height:24,borderRadius:"50%",background:col,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,flexShrink:0}}>{ini}</div>
                  <input value={notaVal(pid)} onChange={function(e){ onNotaChange(pid, e.target.value); }} onBlur={function(){ commitNota(pid); }}
                    placeholder={"Nota per "+(p.nome||"")+"…"}
                    style={{flex:1,minWidth:0,padding:"9px 11px",borderRadius:11,border:"1px solid #E3EAEE",fontSize:13,outline:"none",fontFamily:"'Nunito',system-ui,sans-serif"}}/>
                </div>
              );
            })}
          </div>
          <div style={{fontSize:10,color:"#8A949B",marginTop:9}}>Le note si salvano da sole. Ne tengo lo storico per ogni giorno.</div>
        </div>
      )}

      {mancantiOggi.length > 0 && (
        <div style={warmCardStyle}>
          <div style={ctWarm}><i className="ti ti-shopping-cart" style={{color:"#8A5A12",fontSize:15}}/>Ti serve per oggi</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {mancantiOggi.map(function(mm, i){
              return (
                <div key={i} style={warnRow}>
                  <i className="ti ti-basket"/>
                  <span>Manca <b>{mm.nome}</b> per {mm.pasto}</span>
                </div>
              );
            })}
          </div>
          <button onClick={aggiungiSpesa}
            style={{border:"none",background:"#2F6586",color:"#fff",borderRadius:12,padding:11,fontFamily:"'Nunito',system-ui,sans-serif",fontSize:13,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:7,width:"100%",marginTop:10,cursor:"pointer"}}>
            <i className="ti ti-plus"/>Aggiungi alla lista della spesa
          </button>
        </div>
      )}

      <div style={cardStyle}>
        <div style={ctStyle}><i className="ti ti-leaf" style={{color:"#2F6586",fontSize:15}}/>Questa settimana</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
          {protCats.map(function(c){
            var n = protCount[c.key];
            var zero = n === 0;
            return (
              <span key={c.key} style={{display:"inline-flex",alignItems:"center",gap:5,background:zero?"#FBE7EC":"#E2EEF5",color:zero?"#C2355A":"#2F6586",borderRadius:20,padding:"5px 11px",fontSize:12,fontWeight:700}}>
                <i className={"ti "+c.ic} style={{fontSize:13}}/>{c.label} {n}
              </span>
            );
          })}
        </div>
        {zeroCats.length > 0 ? (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {zeroCats.map(function(c){
              return (
                <div key={c.key} style={warnRow}>
                  <i className="ti ti-alert-triangle"/>
                  <span>Nessuno ha ancora mangiato <b>{c.label.toLowerCase()}</b> questa settimana</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{background:"#E2EEF5",borderRadius:11,padding:"10px 12px",color:"#2F6586",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:8}}>
            <i className="ti ti-check"/>
            <span>Ottima varietà proteica questa settimana</span>
          </div>
        )}
      </div>

      {(prepScad.length > 0 || dispScad.length > 0) && (
        <div style={warmCardStyle}>
          <div style={ctWarm}><i className="ti ti-clock-exclamation" style={{color:"#8A5A12",fontSize:15}}/>Da usare presto</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {prepScad.map(function(p, i){
              return (
                <div key={"mp"+i} style={warnRow}>
                  <i className="ti ti-tools-kitchen-2"/>
                  <span>{p.nome} · restano <b>{p.porzioniRimaste} porz.</b> · {giorniA(p.scadenza)}</span>
                </div>
              );
            })}
            {dispScad.map(function(d, i){
              return (
                <div key={"dp"+i} style={warnRow}>
                  <i className="ti ti-milk"/>
                  <span>{d.nome} · scade <b>{giorniA(d.scadenza)}</b></span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function BannerScadenze(props) {
  var dispensa = props.dispensa || [];
  var oggi = new Date(); oggi.setHours(0,0,0,0);
  var scaduti = []; var inScadenza = [];
  dispensa.forEach(function(it){
    if(!it || !it.scadenza) return;
    var d = new Date(it.scadenza);
    if(isNaN(d.getTime())) return;
    var giorni = Math.round((d.getTime() - oggi.getTime()) / 86400000);
    if(giorni < 0) scaduti.push(it.nome);
    else if(giorni <= 3) inScadenza.push(it.nome);
  });
  if(!scaduti.length && !inScadenza.length) return null;
  return (
    <div style={{marginBottom:12}}>
      {scaduti.length>0&&(
        <div style={{background:"#FBE7EC",border:"1.5px solid #FBE7EC",borderRadius:10,padding:"10px 12px",marginBottom:8}}>
          <div style={{fontSize:12,fontWeight:800,color:"#C2355A",marginBottom:2}}>Prodotti scaduti</div>
          <div style={{fontSize:11,color:"#C2355A"}}>{scaduti.join(", ")}</div>
        </div>
      )}
      {inScadenza.length>0&&(
        <div style={{background:"#F6ECD9",border:"1.5px solid #E8D5AE",borderRadius:10,padding:"10px 12px",marginBottom:8}}>
          <div style={{fontSize:12,fontWeight:800,color:"#8A5A12",marginBottom:2}}>In scadenza entro 3 giorni</div>
          <div style={{fontSize:11,color:"#8A5A12"}}>{inScadenza.join(", ")}</div>
        </div>
      )}
    </div>
  );
}

function MenuCondiviso(props) {
  var familyId = props.familyId;
  var s_load = useState(true); var loading = s_load[0]; var setLoading = s_load[1];
  var s_prof = useState({}); var profili = s_prof[0]; var setProfili = s_prof[1];
  var s_bld = useState({}); var builder = s_bld[0]; var setBuilder = s_bld[1];
  var s_ovr = useState({}); var menuOverride = s_ovr[0]; var setMenuOverride = s_ovr[1];
  var s_fb = useState({}); var feedback = s_fb[0]; var setFeedback = s_fb[1];
  var s_osp = useState({}); var ospiti = s_osp[0]; var setOspiti = s_osp[1];
  var s_mid = useState(""); var midSel = s_mid[0]; var setMidSel = s_mid[1];
  var s_editDay = useState(""); var editDay = s_editDay[0]; var setEditDay = s_editDay[1];
  var s_nota = useState(""); var notaVal = s_nota[0]; var setNotaVal = s_nota[1];

  useEffect(function(){
    var t = setTimeout(function(){ setLoading(false); }, 8000);
    supabase.from("profiles").select("*").eq("family_id", familyId).then(function(rows){
      var pf = {}; (rows||[]).forEach(function(r){ if(r.dati) pf[r.profile_id] = r.dati; }); setProfili(pf);
    }, function(){});
    supabase.from("builder_scelte").select("*").eq("family_id", familyId).then(function(rows){
      var q = {}; (rows||[]).forEach(function(r){ if(r.settimana===0) q[r.giorno+"-"+r.pasto] = r.dati; }); setBuilder(q);
    }, function(){});
    supabase.from("app_state").select("*").eq("family_id", familyId).then(function(rows){
      (rows||[]).forEach(function(r){
        if(r.chiave==="menuOverride" && r.dati) setMenuOverride(r.dati);
        if(r.chiave==="feedbackPasti" && r.dati) setFeedback(r.dati);
        if(r.chiave==="ospiti" && r.dati) setOspiti(r.dati);
        if(r.chiave==="piani" && r.dati) setPiani(r.dati);
        if(r.chiave==="medicine" && r.dati) setMedicine(r.dati);
      });
      setLoading(false);
    }, function(){ setLoading(false); });
    return function(){ clearTimeout(t); };
  }, []);

  var lun = lunediSettimana();
  var weekKey = isoDay(lun);
  var vals = Object.values(profili);
  var membro = profili[midSel] || vals[0] || null;
  var mkey = membro ? membro.id : "";
  var menuBase = buildMenu(0, profili);
  var menu = Object.assign({}, menuBase, menuOverride);

  function nomePasto(giorno, m){ var info = pastoUnificato(builder, menu, giorno, m); return info ? info.nome : null; }
  function getReaz(day, mid){ var w = feedback[weekKey]; if(!w) return null; var dd = w[day]; if(!dd) return null; return dd[mid] || null; }
  function saveFeedback(nf){ setFeedback(nf); supabase.from("app_state").upsert({family_id:familyId, chiave:"feedbackPasti", dati:nf, updated_at:new Date().toISOString()}, {onConflict:"family_id,chiave"}); }
  function setReaz(day, mid, stato, nota){
    var w = Object.assign({}, feedback[weekKey]||{}); var dd = Object.assign({}, w[day]||{}); var cur = dd[mid]||{};
    var ns = (cur.stato===stato && stato!=="modifica") ? null : stato;
    dd[mid] = {stato:ns, nota:(nota!==undefined?nota:(cur.nota||""))}; w[day]=dd;
    var nf = Object.assign({}, feedback); nf[weekKey]=w; saveFeedback(nf);
  }
  function getOspRec(day){ var w = ospiti[weekKey]; var r = w && w[day]; if(typeof r==="number") return {n:r,restr:[]}; return r || {n:0,restr:[]}; }
  function saveOspiti(no){ setOspiti(no); supabase.from("app_state").upsert({family_id:familyId, chiave:"ospiti", dati:no, updated_at:new Date().toISOString()}, {onConflict:"family_id,chiave"}); }
  function salvaOsp(day, rec){ var w = Object.assign({}, ospiti[weekKey]||{}); w[day]=rec; var no = Object.assign({}, ospiti); no[weekKey]=w; saveOspiti(no); }
  function setOspN(day, n){ var rec = getOspRec(day); salvaOsp(day, {n:Math.max(0,n), restr:rec.restr}); }
  function toggleRestr(day, id){ var rec = getOspRec(day); var arr = rec.restr.slice(); var i=arr.indexOf(id); if(i>=0) arr.splice(i,1); else arr.push(id); salvaOsp(day, {n:rec.n, restr:arr}); }

  return (
    <div style={{minHeight:"100vh",maxWidth:390,margin:"0 auto",padding:"18px 16px 40px",boxSizing:"border-box",
      fontFamily:"'Nunito',system-ui,sans-serif",background:"#F2F6F8",color:"#2C3338"}}>
      <div style={{textAlign:"center",marginBottom:16}}>
        <div style={{fontSize:30,marginBottom:6}}>🍽</div>
        <div style={{fontSize:20,fontWeight:800}}>Il menu della settimana</div>
        <div style={{fontSize:13,color:"#8A949B",marginTop:3}}>Dì la tua: accetta, proponi o segnala se sei fuori</div>
      </div>
      {loading&&<div style={{textAlign:"center",color:"#8A949B",fontSize:13}}>Caricamento...</div>}
      {!loading&&vals.length===0&&(
        <div style={{fontSize:13,color:"#C2355A",background:"#FBE7EC",borderRadius:12,padding:"14px",textAlign:"center"}}>
          Nessun dato trovato. Chiedi a chi ti ha mandato il link di controllare.
        </div>
      )}
      {!loading&&vals.length>0&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:2}}>
            {vals.map(function(p){
              var on = mkey===p.id;
              return (
                <button key={p.id} onClick={function(){ setMidSel(p.id); setEditDay(""); }}
                  style={{display:"flex",alignItems:"center",gap:7,padding:"6px 12px 6px 6px",borderRadius:22,flexShrink:0,cursor:"pointer",
                    border:"1.5px solid "+(on?"#2F6586":"#E3EAEE"),background:on?"#E2EEF5":"#fff",fontFamily:"'Nunito',system-ui,sans-serif"}}>
                  <span style={{width:26,height:26,borderRadius:"50%",background:p.colore||"#6BA6C9",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800}}>{p.nome?p.nome.slice(0,1).toUpperCase():"?"}</span>
                  <span style={{fontSize:13,fontWeight:on?800:600,color:on?"#2F6586":"#2C3338"}}>{p.nome}</span>
                </button>
              );
            })}
          </div>

          {DAYS.map(function(d,i){
            var data = new Date(lun.getTime()); data.setDate(lun.getDate()+i);
            var piatti = [nomePasto(d,"Pranzo"), nomePasto(d,"Cena")].filter(Boolean).join(" · ");
            var vuoto = !piatti;
            var mia = membro ? getReaz(d, mkey) : null; var miaStato = mia ? mia.stato : null;
            var altri = vals.filter(function(p){ var r = getReaz(d,p.id); return r && r.stato; });
            var osp = getOspRec(d); var nOsp = osp.n;
            return (
              <div key={d} style={{background:"#fff",border:"1px solid #E3EAEE",borderRadius:18,padding:"13px 15px"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:40}}><div style={{fontSize:14,fontWeight:800,color:vuoto?"#8A949B":"#2C3338"}}>{GIORNI_ABBR[i]}</div><div style={{fontSize:11,color:"#8A949B"}}>{data.getDate()}</div></div>
                  <div style={{flex:1,minWidth:0,fontSize:14,fontWeight:600,color:vuoto?"#8A949B":"#2C3338"}}>{vuoto?"Da pianificare":piatti}</div>
                </div>
                {membro&&(
                  <div style={{display:"flex",gap:6,marginTop:10}}>
                    {REAZIONI.map(function(rz){
                      var on = miaStato===rz.id;
                      return (
                        <button key={rz.id} onClick={function(){
                            if(rz.id==="modifica"){ setReaz(d, mkey, "modifica"); setEditDay(d); setNotaVal((mia&&mia.nota)||""); }
                            else { setReaz(d, mkey, rz.id); if(editDay===d) setEditDay(""); }
                          }}
                          style={{flex:1,padding:"8px 4px",borderRadius:11,cursor:"pointer",border:"1.5px solid "+(on?rz.c:"#E3EAEE"),
                            background:on?rz.bg:"#fff",color:on?rz.c:"#8A949B",fontSize:12,fontWeight:on?800:600,
                            display:"flex",alignItems:"center",justifyContent:"center",gap:5,fontFamily:"'Nunito',system-ui,sans-serif"}}>
                          <i className={"ti "+rz.ic} style={{fontSize:14}}/>{rz.l}
                        </button>
                      );
                    })}
                  </div>
                )}
                {membro&&miaStato==="modifica"&&editDay===d&&(
                  <div style={{display:"flex",gap:6,marginTop:8}}>
                    <input autoFocus placeholder="Cosa cambieresti?" value={notaVal} onChange={function(e){ setNotaVal(e.target.value); }}
                      onKeyDown={function(e){ if(e.key==="Enter"){ setReaz(d, mkey, "modifica", notaVal.trim()); setEditDay(""); } }}
                      style={{flex:1,padding:"9px 11px",borderRadius:11,border:"1.5px solid #E3EAEE",fontSize:13,outline:"none",fontFamily:"'Nunito',system-ui,sans-serif"}}/>
                    <button onClick={function(){ setReaz(d, mkey, "modifica", notaVal.trim()); setEditDay(""); }} style={{padding:"9px 14px",borderRadius:11,border:"none",background:"#2F6586",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>OK</button>
                  </div>
                )}
                <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #E3EAEE"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <i className="ti ti-users" style={{fontSize:16,color:nOsp>0?"#2F6586":"#B4BEC4"}}/>
                    <span style={{flex:1,fontSize:12,fontWeight:600,color:nOsp>0?"#2F6586":"#8A949B"}}>{nOsp>0?("Ospiti: "+nOsp):"Ho ospiti?"}</span>
                    <button onClick={function(){ setOspN(d, nOsp-1); }} disabled={nOsp<=0} style={{width:28,height:28,borderRadius:9,border:"1px solid #E3EAEE",background:"#fff",color:"#2F6586",fontSize:16,cursor:nOsp>0?"pointer":"default"}}>-</button>
                    <span style={{minWidth:18,textAlign:"center",fontSize:14,fontWeight:800}}>{nOsp}</span>
                    <button onClick={function(){ setOspN(d, nOsp+1); }} style={{width:28,height:28,borderRadius:9,border:"none",background:"#6BA6C9",color:"#fff",fontSize:16,cursor:"pointer"}}>+</button>
                  </div>
                  {nOsp>0&&(
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
                      {GUEST_RESTR.map(function(rz){
                        var on = osp.restr.indexOf(rz.id)>=0;
                        return <button key={rz.id} onClick={function(){ toggleRestr(d, rz.id); }} style={{padding:"5px 10px",borderRadius:20,fontSize:11,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif",border:"1.5px solid "+(on?"#2F6586":"#E3EAEE"),background:on?"#E2EEF5":"#fff",color:on?"#2F6586":"#8A949B",fontWeight:on?700:500}}>{rz.l}</button>;
                      })}
                    </div>
                  )}
                </div>
                {altri.length>0&&(
                  <div style={{display:"flex",flexDirection:"column",gap:4,marginTop:10,paddingTop:10,borderTop:"1px solid #E3EAEE"}}>
                    {altri.map(function(p){
                      var r = getReaz(d,p.id); var rz = reazById(r.stato);
                      return (
                        <div key={p.id} style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{width:20,height:20,borderRadius:"50%",background:p.colore||"#6BA6C9",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,flexShrink:0}}>{p.nome?p.nome.slice(0,1).toUpperCase():"?"}</span>
                          <span style={{fontSize:12,color:"#2C3338",fontWeight:600}}>{p.nome}</span>
                          <span style={{fontSize:11,fontWeight:800,color:rz?rz.c:"#8A949B"}}>{rz?rz.l:""}</span>
                          {r.nota&&<span style={{fontSize:11,color:"#8A949B",fontStyle:"italic",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>· {r.nota}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          <div style={{fontSize:11,color:"#8A949B",textAlign:"center",marginTop:4}}>Le tue risposte si salvano da sole.</div>
        </div>
      )}
    </div>
  );
}

function VotoPartner(props) {
  var familyId = props.familyId; var giorno = props.giorno;
  var s_opz = useState([]); var opzioni = s_opz[0]; var setOpzioni = s_opz[1];
  var s_load = useState(true); var loading = s_load[0]; var setLoading = s_load[1];
  var s_scelta = useState(null); var scelta = s_scelta[0]; var setScelta = s_scelta[1];
  var s_err = useState(""); var err = s_err[0]; var setErr = s_err[1];

  useEffect(function(){
    var t = setTimeout(function(){ setLoading(false); }, 8000);
    supabase.from("voti").select("*").eq("family_id", familyId).eq("giorno", giorno).then(function(rows){
      if(rows && rows.length && rows[0].opzioni){
        setOpzioni(rows[0].opzioni);
        if(rows[0].scelta) setScelta(rows[0].scelta);
      } else {
        setErr("Nessuna proposta trovata per questo giorno. Chiedi a chi ti ha mandato il link di rigenerarla.");
      }
      setLoading(false);
    }, function(e){ setErr("Errore di caricamento"); setLoading(false); });
    return function(){ clearTimeout(t); };
  }, []);

  function scegli(op) {
    setScelta(op);
    supabase.from("voti").upsert({family_id:familyId, giorno:giorno, scelta:op, updated_at:new Date().toISOString()});
  }

  return (
    <div style={{minHeight:"100vh",maxWidth:390,margin:"0 auto",padding:"24px",boxSizing:"border-box",
      fontFamily:"'Nunito',system-ui,sans-serif",background:"#F5F8FC"}}>
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{fontSize:32,marginBottom:8}}>🍽</div>
        <div style={{fontSize:20,fontWeight:800,color:"#2C3338"}}>Cosa si mangia {giorno}?</div>
        <div style={{fontSize:13,color:"#8A949B",marginTop:4}}>Scegli la cena che preferisci</div>
      </div>
      {loading&&<div style={{textAlign:"center",color:"#8A949B",fontSize:13}}>Caricamento...</div>}
      {err&&!loading&&(
        <div style={{fontSize:13,color:"#C2355A",background:"#FBE7EC",borderRadius:8,padding:"12px"}}>{err}</div>
      )}
      {!loading&&opzioni.map(function(op, i){
        var sel = scelta === op;
        return (
          <button key={i} onClick={function(){ scegli(op); }}
            style={{display:"block",width:"100%",textAlign:"left",marginBottom:12,
              padding:"16px",borderRadius:12,cursor:"pointer",fontSize:15,lineHeight:1.5,
              border:sel?"2.5px solid #2F6586":"1.5px solid #ddd",
              background:sel?"#E2EEF5":"#fff",color:"#2C3338",fontWeight:sel?700:400}}>
            {sel?"✓ ":""}{op}
          </button>
        );
      })}
      {scelta&&!loading&&(
        <div style={{textAlign:"center",fontSize:14,fontWeight:700,color:"#2F6586",marginTop:8}}>
          Grazie! La tua scelta e stata inviata.
        </div>
      )}
    </div>
  );
}

function AssistenteAI(props) {
  var profili = props.profili || {};
  var familyId = props.familyId || null;
  var s_pgiorno = useState("Lunedi"); var pGiorno = s_pgiorno[0]; var setPGiorno = s_pgiorno[1];
  var s_plink = useState(""); var pLink = s_plink[0]; var setPLink = s_plink[1];
  var s_pload = useState(false); var pLoad = s_pload[0]; var setPLoad = s_pload[1];
  var s_pscelta = useState(""); var pScelta = s_pscelta[0]; var setPScelta = s_pscelta[1];
  var s_menu = useState(""); var menuAI = s_menu[0]; var setMenuAI = s_menu[1];
  var s_loadMenu = useState(false); var loadMenu = s_loadMenu[0]; var setLoadMenu = s_loadMenu[1];
  var s_dom = useState(""); var domanda = s_dom[0]; var setDomanda = s_dom[1];
  var s_risp = useState(""); var risposta = s_risp[0]; var setRisposta = s_risp[1];
  var s_loadDom = useState(false); var loadDom = s_loadDom[0]; var setLoadDom = s_loadDom[1];
  var s_err = useState(""); var err = s_err[0]; var setErr = s_err[1];

  function generaMenu() {
    setErr(""); setLoadMenu(true); setMenuAI("");
    aiGeneraMenu(profili).then(function(t){ setMenuAI(t); setLoadMenu(false); },
      function(e){ setErr(e.message || "Errore"); setLoadMenu(false); });
  }
  function chiedi() {
    if(!domanda.trim()) return;
    setErr(""); setLoadDom(true); setRisposta("");
    aiDomanda(profili, domanda.trim()).then(function(t){ setRisposta(t); setLoadDom(false); },
      function(e){ setErr(e.message || "Errore"); setLoadDom(false); });
  }

  function creaLinkPartner() {
    if(!familyId) { setErr("Salva prima i profili (serve la famiglia) per creare il link."); return; }
    setErr(""); setPLoad(true); setPLink(""); setPScelta("");
    aiOpzioniCena(profili, pGiorno).then(function(t){
      var opz = t.split("\n").map(function(r){ return r.replace(/^\s*\d+[\).]\s*/, "").trim(); })
        .filter(function(r){ return r.length > 0; }).slice(0, 3);
      supabase.from("voti").upsert({family_id:familyId, giorno:pGiorno, opzioni:opz, scelta:null, updated_at:new Date().toISOString()});
      var base = (typeof window !== "undefined" && window.location) ? window.location.origin : "";
      setPLink(base + "/voto/" + familyId + "/" + encodeURIComponent(pGiorno));
      setPLoad(false);
    }, function(e){ setErr(e.message || "Errore"); setPLoad(false); });
  }

  function controllaScelta() {
    if(!familyId) return;
    supabase.from("voti").select("*").eq("family_id", familyId).eq("giorno", pGiorno).then(function(rows){
      if(rows && rows.length && rows[0].scelta) setPScelta(rows[0].scelta);
    });
  }

  useEffect(function(){
    if(!pLink) return;
    controllaScelta();
    var iv = setInterval(controllaScelta, 5000);
    return function(){ clearInterval(iv); };
  }, [pLink]);

  var card = {background:"#fff",borderRadius:12,padding:16,marginBottom:16,border:"1px solid #E3EAEE"};
  var btn = {width:"100%",padding:"13px",borderRadius:10,border:"none",background:"#2F6586",
    color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"};

  if(!aiAttiva()) {
    return (
      <div>
        <div style={card}>
          <div style={{fontSize:15,fontWeight:800,color:"#2F6586",marginBottom:8}}>Assistente AI</div>
          <div style={{fontSize:13,color:"#666",lineHeight:1.6}}>
            L'assistente AI non e configurato. Imposta la variabile d'ambiente VITE_ANTHROPIC_KEY
            su Vercel (Settings - Environment Variables) con la tua chiave Claude, poi rilancia il deploy.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{fontSize:18,fontWeight:800,color:"#2C3338",marginBottom:14}}>Assistente AI</div>

      <div style={card}>
        <div style={{fontSize:14,fontWeight:700,color:"#2F6586",marginBottom:6}}>Menu settimanale</div>
        <div style={{fontSize:12,color:"#8A949B",marginBottom:10}}>
          Genera un menu completo che rispetta le patologie di tutti i familiari.
        </div>
        <button onClick={generaMenu} disabled={loadMenu} style={btn}>
          {loadMenu ? "Genero..." : "Genera menu con AI"}
        </button>
        {menuAI&&(
          <div style={{whiteSpace:"pre-wrap",fontSize:12,color:"#333",lineHeight:1.6,
            marginTop:12,background:"#F5F8FC",borderRadius:8,padding:12}}>{menuAI}</div>
        )}
      </div>

      <div style={card}>
        <div style={{fontSize:14,fontWeight:700,color:"#2F6586",marginBottom:6}}>Chiedi all'AI</div>
        <div style={{fontSize:12,color:"#8A949B",marginBottom:10}}>
          Es: "Questo pranzo va bene per Marco?" oppure "Cosa posso dare a colazione al neonato?"
        </div>
        <textarea value={domanda} onChange={function(e){setDomanda(e.target.value);}}
          placeholder="Scrivi la tua domanda..." rows={3}
          style={{width:"100%",padding:"11px 12px",borderRadius:8,border:"1.5px solid #ddd",
            fontSize:14,outline:"none",boxSizing:"border-box",marginBottom:10,resize:"vertical"}}/>
        <button onClick={chiedi} disabled={loadDom} style={btn}>
          {loadDom ? "Penso..." : "Chiedi"}
        </button>
        {risposta&&(
          <div style={{whiteSpace:"pre-wrap",fontSize:13,color:"#333",lineHeight:1.6,
            marginTop:12,background:"#F5F8FC",borderRadius:8,padding:12}}>{risposta}</div>
        )}
      </div>

      <div style={card}>
        <div style={{fontSize:14,fontWeight:700,color:"#2F6586",marginBottom:6}}>Chiedi al partner</div>
        <div style={{fontSize:12,color:"#8A949B",marginBottom:10}}>
          Genera 3 opzioni di cena con l'AI e invia il link: il partner sceglie e tu vedi la risposta qui.
        </div>
        <select value={pGiorno} onChange={function(e){setPGiorno(e.target.value);}}
          style={{width:"100%",padding:"11px 12px",borderRadius:8,border:"1.5px solid #ddd",
            fontSize:14,outline:"none",boxSizing:"border-box",marginBottom:10}}>
          {GIORNI.map(function(g){ return <option key={g} value={g}>{g}</option>; })}
        </select>
        <button onClick={creaLinkPartner} disabled={pLoad} style={btn}>
          {pLoad ? "Genero opzioni..." : "Genera e crea link"}
        </button>
        {pLink&&(
          <div style={{marginTop:12}}>
            <div style={{fontSize:11,color:"#8A949B",marginBottom:4}}>Invia questo link al partner:</div>
            <input readOnly value={pLink} onFocus={function(e){e.target.select();}}
              style={{width:"100%",padding:"10px",borderRadius:8,border:"1.5px solid #E3EAEE",
                fontSize:11,boxSizing:"border-box",background:"#F5F8FC"}}/>
            <div style={{marginTop:12,padding:"12px",borderRadius:8,
              background:pScelta?"#E2EEF5":"#F6ECD9",border:"1px solid "+(pScelta?"#6BA6C9":"#E8D5AE")}}>
              {pScelta
                ? <span style={{fontSize:13,fontWeight:700,color:"#2F6586"}}>Il partner ha scelto: {pScelta}</span>
                : <span style={{fontSize:12,color:"#8A5A12"}}>In attesa della scelta del partner...</span>}
            </div>
          </div>
        )}
      </div>

      {err&&(
        <div style={{fontSize:12,color:"#C2355A",background:"#FBE7EC",borderRadius:8,padding:"10px 12px"}}>
          {err}
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
  var s_user    = useState(sbSession && sbSession.user ? {email:sbSession.user.email} : null);
  var utente    = s_user[0]; var setUtente = s_user[1];
  var s_fid     = useState(loadLS("family_id",null));
  var familyId  = s_fid[0]; var setFamilyId = s_fid[1];
  var s_uid     = useState(sbSession && sbSession.user ? sbSession.user.id : null);
  var userId    = s_uid[0]; var setUserId = s_uid[1];
  var s_loading = useState(!!sbSession);
  var loading   = s_loading[0]; var setLoading = s_loading[1];
  var s_authErr = useState("");
  var authErr   = s_authErr[0]; var setAuthErr = s_authErr[1];
  var s_email   = useState(""); var emailInput=s_email[0]; var setEmailInput=s_email[1];
  var s_pwd     = useState(""); var pwdInput=s_pwd[0]; var setPwdInput=s_pwd[1];
  var s_isReg   = useState(false); var isReg=s_isReg[0]; var setIsReg=s_isReg[1];
  var s_authView = useState("intro"); var authView=s_authView[0]; var setAuthView=s_authView[1];
  var s_authMsg = useState(""); var authMsg=s_authMsg[0]; var setAuthMsg=s_authMsg[1];
  var s_needConfirm = useState(false); var needConfirm=s_needConfirm[0]; var setNeedConfirm=s_needConfirm[1];
  var s_syncing = useState(false); var syncing=s_syncing[0]; var setSyncing=s_syncing[1];

  const [tab, setTab] = useState("home");
  const [modificaFam, setModificaFam] = useState(false);
  const [orariPasti, setOrariPasti] = useState({
    Colazione:"07:30", Spuntino:"10:30", Pranzo:"12:30",
    Merenda:"16:00", Cena:"19:00", Extra:"21:00"
  });
  const [pianificazione, setPianificazione] = useState(loadLS("pianificazione", {
    giorno: 4, ora: "09:00", attiva: false
  }));
  const [pin, setPin] = useState(loadLS("pin", {attivo:false, codice:"", sbloccato:true}));
  // Reset auto-genera dopo che TabMenu lo ha usato
  const [autoGeneraMenu, setAutoGeneraMenu] = useState(false);

  function creaNuovaFamiglia(userId) {
    supabase.from("families").insert({owner_id:userId}).then(function(r2) {
      if(r2&&r2.length>0){var f2=r2[0].id;setFamilyId(f2);saveLS("family_id",f2);}
      else{ console.error("Supabase: insert families fallito", r2); }
      setLoading(false);
    }, function(e){ console.error("Supabase: insert families errore", e); setLoading(false); });
  }
  function caricaOwned(userId) {
    supabase.from("families").select("id").eq("owner_id", userId).then(function(rows) {
      if(rows && rows.length > 0) {
        var fid=rows[0].id; setFamilyId(fid); saveLS("family_id",fid); loadFromSupabase(fid);
      } else {
        creaNuovaFamiglia(userId);
      }
    }, function(e){ console.error("Supabase: select families errore", e); setLoading(false); });
  }
  function initFamily(userId) {
    setUserId(userId);
    setTimeout(function(){ setLoading(false); }, 8000);
    // Prima le famiglie a cui sono stato invitato (membro), poi la mia
    supabase.from("membri_famiglia").select("family_id").eq("user_id", userId).then(function(mrows) {
      if(mrows && mrows.length > 0) {
        var mfid = mrows[0].family_id; setFamilyId(mfid); saveLS("family_id",mfid); loadFromSupabase(mfid);
      } else {
        caricaOwned(userId);
      }
    }, function(){ caricaOwned(userId); });
  }

  function loadFromSupabase(fid) {
    if(!fid){setLoading(false);return;}
    supabase.from("profiles").select("*").eq("family_id",fid).then(function(rows){
      if(rows&&rows.length>0){
        var pf={};
        rows.forEach(function(r){ if(r.dati) pf[r.profile_id]=r.dati; });
        setProfili(pf); saveLS("profili", pf);
      } else {
        var locP = loadLS("profili", {});
        if(locP && Object.keys(locP).length>0){
          Object.keys(locP).forEach(function(pid){
            supabase.from("profiles").upsert({family_id:fid, profile_id:pid, dati:locP[pid], updated_at:new Date().toISOString()}, {onConflict:"family_id,profile_id"});
          });
        }
      }
    }, function(e){ console.error("Supabase: profiles errore", e); });
    supabase.from("builder_scelte").select("*").eq("family_id",fid).then(function(rows){
      if(rows&&rows.length>0){
        var q={};var p={};
        rows.forEach(function(r){var k=r.giorno+"-"+r.pasto;if(r.settimana===0)q[k]=r.dati;else p[k]=r.dati;});
        setBuilderScelte(q);saveLS("builderScelte",q);
        setBuilderScelteProssima(p);saveLS("builderScelteProssima",p);
      }
    }, function(e){ console.error("Supabase: builder_scelte errore", e); });
    supabase.from("app_state").select("*").eq("family_id",fid).then(function(rows){
      if(rows&&rows.length>0){
        var setters = {dispensa:setDispensa, spesa:setSpesa, mealPrep:setMealPrep, giorniFuori:setGiorniFuori, menuOverride:setMenuOverride, diarioLog:setDiarioLog, feedbackPasti:setFeedbackPasti, ospiti:setOspiti, piani:setPiani, medicine:setMedicine, noteGiorno:setNoteGiorno, alimentiCustom:setAlimentiCustom, pianificazione:setPianificazione};
        rows.forEach(function(r){
          if(setters[r.chiave] && r.dati !== null && r.dati !== undefined){
            setters[r.chiave](r.dati); saveLS(r.chiave, r.dati);
          }
        });
      }
      setLoading(false);
    }, function(e){ console.error("Supabase: app_state errore", e); setLoading(false); });
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
    supabase.from("builder_scelte").upsert({family_id:familyId,settimana:sett,giorno:giorno,pasto:pasto,dati:dati,updated_at:new Date().toISOString()}, {onConflict:"family_id,settimana,giorno,pasto"});
  }

  function savePesoToSupabase(nome,data,valore) {
    if(!familyId)return;
    supabase.from("peso_log").upsert({family_id:familyId,profile_nome:nome,data:data,valore:valore});
  }

  function pushAll(fid, cb) {
    var stamp = new Date().toISOString();
    var nP=0, nB=0, nS=0;
    Object.keys(profili||{}).forEach(function(pid){ if(profili[pid]){ nP++; supabase.from("profiles").upsert({family_id:fid, profile_id:pid, dati:profili[pid], updated_at:stamp}, {onConflict:"family_id,profile_id"}); } });
    Object.keys(builderScelte||{}).forEach(function(k){ var gp=k.split("-"); nB++; supabase.from("builder_scelte").upsert({family_id:fid, settimana:0, giorno:gp[0], pasto:gp.slice(1).join("-"), dati:builderScelte[k], updated_at:stamp}, {onConflict:"family_id,settimana,giorno,pasto"}); });
    Object.keys(builderScelteProssima||{}).forEach(function(k){ var gp=k.split("-"); nB++; supabase.from("builder_scelte").upsert({family_id:fid, settimana:1, giorno:gp[0], pasto:gp.slice(1).join("-"), dati:builderScelteProssima[k], updated_at:stamp}, {onConflict:"family_id,settimana,giorno,pasto"}); });
    var stateMap = {dispensa:dispensa, spesa:spesa, mealPrep:mealPrep, giorniFuori:giorniFuori, menuOverride:menuOverride, diarioLog:diarioLog, feedbackPasti:feedbackPasti, ospiti:ospiti, piani:piani, medicine:medicine, noteGiorno:noteGiorno, alimentiCustom:alimentiCustom, pianificazione:pianificazione};
    Object.keys(stateMap).forEach(function(k){ nS++; supabase.from("app_state").upsert({family_id:fid, chiave:k, dati:stateMap[k], updated_at:stamp}, {onConflict:"family_id,chiave"}); });
    setTimeout(function(){ cb("Fatto! Famiglia collegata e inviati al cloud: " + nP + " profili, " + nB + " pasti, " + nS + " impostazioni. Ora prova il login su un altro accesso."); }, 1500);
  }
  function sincronizzaTutto(cb) {
    supabase.refreshSession().then(function(){ sincronizzaTuttoInterno(cb); });
  }
  function sincronizzaTuttoInterno(cb) {
    if(!userId){ cb("Non risulti loggato (userId mancante). Rifai il login e riprova."); return; }
    if(familyId){ pushAll(familyId, cb); return; }
    supabase.from("families").select("id").eq("owner_id", userId).then(function(fam){
      if(Array.isArray(fam) && fam.length>0){ var fid=fam[0].id; setFamilyId(fid); saveLS("family_id",fid); pushAll(fid, cb); }
      else {
        supabase.from("families").insert({owner_id:userId}).then(function(ins){
          if(Array.isArray(ins) && ins.length>0){ var f2=ins[0].id; setFamilyId(f2); saveLS("family_id",f2); pushAll(f2, cb); }
          else { cb("Non riesco a creare la famiglia sul cloud. " + (ins && ins.message ? ("Errore: "+ins.message) : "")); }
        }, function(){ cb("Errore creando la famiglia sul cloud."); });
      }
    }, function(){ cb("Errore contattando il cloud (famiglie)."); });
  }

  function controllaCloud(cb) {
    supabase.refreshSession().then(function(){ controllaCloudInterno(cb); });
  }
  function controllaCloudInterno(cb) {
    var loc = Object.keys(profili||{}).length;
    if(!userId){ cb("Non risulti loggato (userId mancante). Rifai il login."); return; }
    supabase.from("families").select("id").eq("owner_id", userId).then(function(fam){
      var nFam = Array.isArray(fam) ? fam.length : 0;
      var famErr = (fam && !Array.isArray(fam) && fam.message) ? fam.message : "";
      if(!familyId){ cb("Famiglie sul cloud: " + nFam + (famErr?(" · ERRORE: "+famErr):"") + " · Profili sul telefono: " + loc + " · (familyId locale MANCANTE)"); return; }
      supabase.from("profiles").select("profile_id").eq("family_id", familyId).then(function(pr){
        var nPr = Array.isArray(pr) ? pr.length : 0;
        var prErr = (pr && !Array.isArray(pr) && pr.message) ? pr.message : "";
        cb("Cloud → famiglie: " + nFam + " · profili nel cloud: " + nPr + " · profili sul telefono: " + loc + (prErr?(" · ERRORE: "+prErr):(famErr?(" · ERRORE: "+famErr):"")));
      }, function(){ cb("Errore leggendo i profili dal cloud."); });
    }, function(){ cb("Errore leggendo le famiglie dal cloud."); });
  }

  function doLogin() {
    setAuthErr("");setAuthMsg("");setNeedConfirm(false);setLoading(true);
    supabase.signIn(emailInput,pwdInput).then(function(res){
      if(res.error){
        var m = res.error.message || "Errore";
        setAuthErr(traduciErroreAuth(m));
        if((m).toLowerCase().indexOf("email not confirmed") >= 0) setNeedConfirm(true);
        setLoading(false);
      }
      else{sbSession=res;localStorage.setItem("mf_session",JSON.stringify(res));setUtente({email:res.user.email});initFamily(res.user.id);}
    }).catch(function(){setAuthErr("Errore di rete");setLoading(false);});
  }

  function doSignup() {
    setAuthErr("");setAuthMsg("");setNeedConfirm(false);setLoading(true);
    supabase.signUp(emailInput,pwdInput).then(function(res){
      if(res.error){setAuthErr(traduciErroreAuth(res.error.message||"Errore"));setLoading(false);return;}
      var uid = res.user ? res.user.id : res.id;
      notificaIscrizione(emailInput); salvaIscritto(emailInput, uid);
      if(!res.access_token){
        setLoading(false); setAuthView("confirm");
        return;
      }
      sbSession=res;localStorage.setItem("mf_session",JSON.stringify(res));setUtente({email:emailInput});initFamily(uid);
    }).catch(function(){setAuthErr("Errore di rete");setLoading(false);});
  }

  function doResend() {
    if(!emailInput){ setAuthErr("Inserisci l'email per reinviare la conferma."); return; }
    setAuthErr("");
    supabase.resendConfirm(emailInput).then(function(){ setAuthMsg("Email di conferma reinviata. Controlla la posta (anche spam)."); },
      function(){ setAuthMsg("Email di conferma reinviata. Controlla la posta (anche spam)."); });
  }

  function doRecover() {
    if(!emailInput){ setAuthErr("Inserisci l'email per recuperare la password."); return; }
    setAuthErr("");
    supabase.recover(emailInput).then(function(){ setAuthMsg("Ti abbiamo inviato un'email per reimpostare la password."); },
      function(){ setAuthMsg("Ti abbiamo inviato un'email per reimpostare la password."); });
  }

  function doLogout() {
    supabase.signOut();setUtente(null);setFamilyId(null);
    localStorage.removeItem("mf_session");localStorage.removeItem("mf_family_id");
  }

  useEffect(function(){
    var safety = setTimeout(function(){ setLoading(false); }, 8000);
    if(sbSession&&!utente&&loading){
      supabase.refreshSession().then(function(){
        supabase.getSession().then(function(user){
          if(user&&user.id){setUtente({email:user.email});initFamily(user.id);}
          else{sbSession=null;localStorage.removeItem("mf_session");setLoading(false);}
        }, function(e){ console.error("Supabase: getSession errore", e); sbSession=null;localStorage.removeItem("mf_session");setLoading(false); });
      });
    }
    return function(){ clearTimeout(safety); };
  }, []);

  useEffect(function(){
    if(!utente) return;
    var iv = setInterval(function(){ supabase.refreshSession(); }, 50*60*1000);
    return function(){ clearInterval(iv); };
  }, [utente]);

  const handleSetTab = (t) => {
    if(t !== "menu") setAutoGeneraMenu(false);
    setTab(t);
  };
  const isAdmin = !!(utente && utente.email && utente.email.toLowerCase() === "marlene.lomb@gmail.com");
  const [settimana, setSettimana] = useState(0);
  const [activeDay, setActiveDay] = useState(0);
  const [profili, setProfili] = useState(loadLS("profili", {}));
  const [menuOverride, setMenuOverride] = useState(loadLS("menuOverride", {}));
  const [builderScelte, setBuilderScelte] = useState(loadLS("builderScelte", {}));
  const [builderScelteProssima, setBuilderScelteProssima] = useState(loadLS("builderScelteProssima", {}));
  const [giorniFuori, setGiorniFuori] = useState(loadLS("giorniFuori", {}));
  const [pesoLog, setPesoLog] = useState(loadLS("pesoLog", {}));
  const [dispensa, setDispensa] = useState(loadLS("dispensa", []));
  const [spesa, setSpesa] = useState(loadLS("spesa", []));
  const [mealPrep, setMealPrep] = useState(loadLS("mealPrep", []));
  const [diarioLog, setDiarioLog] = useState(loadLS("diarioLog", {}));
  const [feedbackPasti, setFeedbackPasti] = useState(loadLS("feedbackPasti", {}));
  const [ospiti, setOspiti] = useState(loadLS("ospiti", {}));
  const [piani, setPiani] = useState(loadLS("piani", {}));
  const [medicine, setMedicine] = useState(loadLS("medicine", {}));
  const [noteGiorno, setNoteGiorno] = useState(loadLS("noteGiorno", {}));
  const [alimentiCustom, setAlimentiCustom] = useState(loadLS("alimentiCustom", []));
  ALIMENTI_CUSTOM = alimentiCustom;
  const [regolaApro, setRegolaApro] = useState({
    Colazione:2, Spuntino:2, Pranzo:7, Merenda:3, Cena:8, Extra:0
  });

  const menuBase = useMemo(() => buildMenu(settimana, profili), [settimana, profili]);
  const menu = useMemo(() => ({...menuBase, ...menuOverride}), [menuBase, menuOverride]);

  const toggleFuori = useCallback((giorno, pid) => {
    setGiorniFuoriLS(prev => {
      var raw = (prev && prev[giorno]) || [];
      var arr = Array.isArray(raw) ? raw.slice() : (raw && typeof raw.has === "function" ? Array.from(raw) : []);
      var i = arr.indexOf(pid);
      if(i >= 0) arr.splice(i,1); else arr.push(pid);
      var next = Object.assign({}, prev);
      next[giorno] = arr;
      return next;
    });
  }, []);

  const prepAlert = mealPrep.filter(p => {
    if(p.porzioniRimaste <= 0) return false;
    const oggi = new Date().toISOString().split("T")[0];
    if(p.scadenza < oggi) return true;
    return (new Date(p.scadenza)-new Date()) / (1000*60*60*24) <= 2;
  }).length;

  const TABS = [
    {id:"home",        l:"Home",     ic:"ti-home"},
    {id:"menu",        l:"Menu",     ic:"ti-calendar"},
    {id:"diario",      l:"Diario",   ic:"ti-chart-bar"},
    {id:"salute",      l:"Salute",   ic:"ti-heart-rate-monitor"},
    {id:"dispensa",    l:"Dispensa", ic:"ti-fridge"},
    {id:"mealprep",    l:"Prep",     ic:"ti-tools-kitchen-2", badge:prepAlert||null},
    {id:"calorie",     l:"Calorie",  ic:"ti-flame"},
    {id:"piramide",    l:"Piramide", ic:"ti-pyramid"},
    {id:"idee",        l:"Idee",     ic:"ti-bulb"},
    {id:"impostazioni",l:"Impost.",  ic:"ti-settings"},
    {id:"builder",     l:"Builder",  ic:"ti-pencil"},
  ];

  const TABS_ROW1 = TABS.slice(0,5);
  const TABS_ROW2 = TABS.slice(5);
  var s_sheet = useState(false); var sheetOpen = s_sheet[0]; var setSheetOpen = s_sheet[1];
  var SHEET_ITEMS = [
    {id:"salute",      l:"Famiglia",      ic:"ti-users",              s:"Profili, pesi e crescita"},
    {id:"piramide",    l:"Piramide",      ic:"ti-pyramid",            s:"Porzioni consigliate"},
    {id:"dispensa",    l:"Dispensa",      ic:"ti-fridge",             s:"Scorte alimentari"},
    {id:"spesa",       l:"Lista spesa",   ic:"ti-shopping-bag",       s:"Cosa comprare, per categorie"},
    {id:"mensa",       l:"Menu e diete",   ic:"ti-school",             s:"Mensa o dieta di un membro"},
    {id:"amici",       l:"Amici",          ic:"ti-users-group",        s:"Aggiungi amici e cene insieme"},
    {id:"medicine",    l:"Medicine",       ic:"ti-pill",               s:"Dosi e frequenza per membro"},
    {id:"mealprep",    l:"Meal prep",     ic:"ti-tools-kitchen-2",    s:"Preparazioni"},
    {id:"idee",        l:"Idee",          ic:"ti-bulb",               s:"Ricette e ispirazioni"},
    {id:"ai",          l:"Assistente AI", ic:"ti-sparkles",           s:"Menu e domande"},
    {id:"impostazioni",l:"Impostazioni",  ic:"ti-settings",           s:"Famiglia e PIN"}
  ];
  var MORE_TABS = SHEET_ITEMS.map(function(x){ return x.id; });


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

  function setProfiliLS(val) {
    setProfili(function(prev) {
      var next = (typeof val === "function") ? val(prev) : val;
      saveLS("profili", next);
      if(familyId) {
        Object.keys(next).forEach(function(pid) {
          supabase.from("profiles").upsert({family_id:familyId, profile_id:pid, dati:next[pid], updated_at:new Date().toISOString()}, {onConflict:"family_id,profile_id"});
        });
        Object.keys(prev).forEach(function(pid) {
          if(!next[pid]) supabase.from("profiles").delete().eq("family_id",familyId).eq("profile_id",pid);
        });
      }
      return next;
    });
  }
  function mkSetterSync(key, setter) {
    return function(val) {
      setter(function(prev) {
        var next = (typeof val === "function") ? val(prev) : val;
        saveLS(key, next);
        if(familyId) {
          supabase.from("app_state").upsert(
            {family_id:familyId, chiave:key, dati:next, updated_at:new Date().toISOString()},
            {onConflict:"family_id,chiave"}
          );
        }
        return next;
      });
    };
  }

  var setBuilderScelteLS      = mkSetter("builderScelte", setBuilderScelte);
  var setBuilderScelteProssimaLS = mkSetter("builderScelteProssima", setBuilderScelteProssima);
  var setPesoLogLS            = mkSetter("pesoLog", setPesoLog);
  var setDispensaLS           = mkSetterSync("dispensa", setDispensa);
  var setSpesaLS              = mkSetterSync("spesa", setSpesa);
  var setMealPrepLS           = mkSetterSync("mealPrep", setMealPrep);
  var setAlimentiCustomLS     = mkSetterSync("alimentiCustom", setAlimentiCustom);
  var setPianificazioneLS     = mkSetterSync("pianificazione", setPianificazione);
  var setDiarioLogLS          = mkSetterSync("diarioLog", setDiarioLog);
  var setFeedbackPastiLS      = mkSetterSync("feedbackPasti", setFeedbackPasti);
  var setOspitiLS             = mkSetterSync("ospiti", setOspiti);
  var setPianiLS              = mkSetterSync("piani", setPiani);
  var setMedicineLS           = mkSetterSync("medicine", setMedicine);
  var setNoteGiornoLS         = mkSetterSync("noteGiorno", setNoteGiorno);
  var setPinLS                = mkSetter("pin", setPin);
  var setMenuOverrideLS       = mkSetterSync("menuOverride", setMenuOverride);
  var setGiorniFuoriLS        = mkSetterSync("giorniFuori", setGiorniFuori);

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

  var votoPath = (typeof window !== "undefined" && window.location) ? window.location.pathname : "";
  var votoMatch = votoPath.match(/^\/voto\/([^\/]+)\/([^\/]+)/);
  if(votoMatch) return <VotoPartner familyId={votoMatch[1]} giorno={decodeURIComponent(votoMatch[2])}/>;
  var famMatch = votoPath.match(/^\/famiglia\/([^\/]+)/);
  if(famMatch) return <MenuCondiviso familyId={famMatch[1]}/>;

  if(pin.attivo && !pin.sbloccato) return (
    <div style={{background:"#F5F8FC",minHeight:"100vh",maxWidth:390,margin:"0 auto",
      display:"flex",alignItems:"center",justifyContent:"center",padding:"30px"}}>
      <div style={{width:"100%",textAlign:"center"}}>
        <div style={{fontSize:14,fontWeight:800,color:"#2F6586",marginBottom:4}}>
          Menu Famiglia
        </div>
        <div style={{fontSize:11,color:"#8A949B",marginBottom:24}}>Inserisci il PIN</div>
        <input type="password" inputMode="numeric" pattern="[0-9]*"
          placeholder="PIN" maxLength={8} value={pinInput}
          onChange={e=>setPinInput(e.target.value.replace(/[^0-9]/g,""))}
          onKeyDown={e=>{ if(e.key==="Enter") verificaPin(); }}
          style={{width:"100%",padding:"14px",borderRadius:12,
            border:"2px solid "+(pinWrong?"#C2355A":"#E3EAEE"),
            fontSize:24,fontWeight:700,letterSpacing:8,textAlign:"center",
            marginBottom:pinWrong?6:12,boxSizing:"border-box"}}/>
        {pinWrong&&<div style={{fontSize:11,color:"#C2355A",
          fontWeight:700,marginBottom:10}}>PIN errato - riprova</div>}
        <button onClick={verificaPin}
          style={{width:"100%",padding:"12px",borderRadius:12,border:"none",
            background:"#2F6586",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
          Accedi
        </button>
      </div>
    </div>
  );

  return (
    <div style={{background:"#F5F8FC",minHeight:"100vh",maxWidth:390,margin:"0 auto",fontFamily:"'Nunito',system-ui,sans-serif"}}>

      {/* Loading */}
      {loading&&<LoadingScreen/>}

      {/* Schermata di benvenuto */}
      {!loading&&!utente&&authView==="intro"&&(
        <div style={{minHeight:"100vh",maxWidth:390,margin:"0 auto",background:"#F2F6F8",
          display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center",
          padding:"28px 24px 24px",boxSizing:"border-box"}}>
          <div style={{width:54,height:54,borderRadius:16,background:"#2F6586",color:"#fff",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>
            <i className="ti ti-tools-kitchen-2"/>
          </div>
          <div style={{fontSize:24,fontWeight:800,marginTop:12,letterSpacing:"-0.01em",color:"#2C3338"}}>Menu Famiglia</div>
          <div style={{fontSize:14,color:"#8A949B",lineHeight:1.5,marginTop:8,fontWeight:500,maxWidth:240}}>
            Pianifica i pasti della settimana e mangia bene, tutti insieme.
          </div>

          <div style={{margin:"20px 0 22px"}}>
            <svg viewBox="0 0 240 210" width="232" height="200" role="img" aria-label="Illustrazione di un piatto con cibo e un calendario settimanale">
              <circle cx="120" cy="112" r="92" fill="#E2EEF5"/>
              <rect x="150" y="30" width="52" height="50" rx="11" fill="#FFFFFF" stroke="#DDE7EC" strokeWidth="1.5"/>
              <rect x="150" y="30" width="52" height="15" rx="11" fill="#2F6586"/>
              <rect x="150" y="38" width="52" height="7" fill="#2F6586"/>
              <circle cx="163" cy="30" r="2.5" fill="#2F6586"/><circle cx="189" cy="30" r="2.5" fill="#2F6586"/>
              <path d="M163 62 l7 7 l13 -14" fill="none" stroke="#6BA6C9" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
              <ellipse cx="64" cy="58" rx="13" ry="8" fill="#9FC79A" transform="rotate(-35 64 58)"/>
              <path d="M58 63 q6 -7 12 -11" fill="none" stroke="#5E8C57" strokeWidth="1.6" strokeLinecap="round"/>
              <circle cx="120" cy="118" r="56" fill="#FFFFFF" stroke="#DDE7EC" strokeWidth="1.5"/>
              <circle cx="120" cy="118" r="44" fill="#EAF1F6"/>
              <ellipse cx="108" cy="110" rx="18" ry="13" fill="#9FC79A"/>
              <path d="M99 110 q9 -10 19 -3" fill="none" stroke="#5E8C57" strokeWidth="1.6" strokeLinecap="round"/>
              <ellipse cx="134" cy="124" rx="15" ry="11" fill="#AFCDDD"/>
              <circle cx="120" cy="132" r="7" fill="#E2A98C"/>
              <circle cx="128" cy="106" r="5" fill="#E2A98C"/>
            </svg>
          </div>

          <div style={{display:"flex",justifyContent:"center",gap:20}}>
            {[{ic:"ti-calendar-week",l:"Pianifica"},{ic:"ti-leaf",l:"Equilibrio"},{ic:"ti-users",l:"Famiglia"}].map(function(f){
              return (
                <div key={f.l} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:7,width:66}}>
                  <div style={{width:42,height:42,borderRadius:13,background:"#E2EEF5",color:"#2F6586",
                    display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>
                    <i className={"ti "+f.ic}/>
                  </div>
                  <div style={{fontSize:11,fontWeight:600,color:"#2C3338",lineHeight:1.3}}>{f.l}</div>
                </div>
              );
            })}
          </div>

          <div style={{flex:1}}/>

          <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:18}}>
            <span style={{width:18,height:7,borderRadius:7,background:"#6BA6C9"}}/>
            <span style={{width:7,height:7,borderRadius:"50%",background:"#E3EAEE"}}/>
            <span style={{width:7,height:7,borderRadius:"50%",background:"#E3EAEE"}}/>
          </div>
          <button onClick={function(){setIsReg(true);setAuthErr("");setAuthView("form");}}
            style={{width:"100%",padding:"15px",borderRadius:15,border:"none",background:"#2F6586",
              color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif"}}>
            Inizia
          </button>
          <button onClick={function(){setIsReg(false);setAuthErr("");setAuthView("form");}}
            style={{width:"100%",padding:"12px",borderRadius:15,marginTop:8,border:"none",
              background:"transparent",color:"#2F6586",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',system-ui,sans-serif"}}>
            Ho gia un account
          </button>
        </div>
      )}

      {/* Form login/registrazione */}
      {!loading&&!utente&&authView==="form"&&(
        <div style={{minHeight:"100vh",maxWidth:390,margin:"0 auto",display:"flex",alignItems:"center",
          justifyContent:"center",padding:"24px",boxSizing:"border-box",background:"#F2F6F8"}}>
          <div style={{width:"100%",maxWidth:340}}>
            <button onClick={function(){setAuthView("intro");setAuthErr("");}}
              style={{border:"none",background:"transparent",color:"#2F6586",fontSize:14,fontWeight:700,
                cursor:"pointer",marginBottom:8,padding:0}}>
              <i className="ti ti-arrow-left" style={{verticalAlign:"-2px",marginRight:4}}/>Indietro
            </button>
            <div style={{marginBottom:20,textAlign:"center"}}>
              <div style={{width:54,height:54,borderRadius:16,background:"#2F6586",color:"#fff",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 12px"}}>
                <i className="ti ti-tools-kitchen-2"/>
              </div>
              <div style={{fontSize:24,fontWeight:800,letterSpacing:"-0.01em",color:"#2C3338"}}>Menu Famiglia</div>
              <div style={{fontSize:14,color:"#8A949B",marginTop:6}}>
                {isReg?"Crea il tuo account":"Bentornato"}
              </div>
            </div>
            {isReg&&(
              <div style={{display:"flex",alignItems:"flex-start",gap:6,marginBottom:12,padding:"0 4px"}}>
                <i className="ti ti-info-circle" style={{fontSize:12,color:"#B4BEC4",marginTop:1}}/>
                <div style={{flex:1,fontSize:10,lineHeight:1.4,color:"#8A949B"}}>
                  Non è uno strumento medico: è pensato per l'organizzazione dei pasti in famiglia. Per diete o patologie segui il tuo medico.
                </div>
              </div>
            )}
            <div className="mf-card" style={{display:"flex",flexDirection:"column",gap:12}}>
              <div>
                <div className="cap" style={{marginBottom:6}}>Email</div>
                <input type="email" placeholder="nome@email.com"
                  value={emailInput} onChange={function(e){setEmailInput(e.target.value);}}
                  onKeyDown={function(e){if(e.key==="Enter")isReg?doSignup():doLogin();}}
                  style={{padding:"12px",borderRadius:12,border:"1px solid #E3EAEE",
                    fontSize:14,outline:"none",width:"100%",boxSizing:"border-box",fontFamily:"'Nunito',system-ui,sans-serif"}}/>
              </div>
              <div>
                <div className="cap" style={{marginBottom:6}}>Password</div>
                <input type="password" placeholder="La tua password"
                  value={pwdInput} onChange={function(e){setPwdInput(e.target.value);}}
                  onKeyDown={function(e){if(e.key==="Enter")isReg?doSignup():doLogin();}}
                  style={{padding:"12px",borderRadius:12,border:"1px solid #E3EAEE",
                    fontSize:14,outline:"none",width:"100%",boxSizing:"border-box",fontFamily:"'Nunito',system-ui,sans-serif"}}/>
              </div>
              {authErr&&(
                <div style={{fontSize:12,color:"#C2355A",textAlign:"center"}}>{authErr}</div>
              )}
              {authMsg&&(
                <div style={{fontSize:12,color:"#2F6586",textAlign:"center",fontWeight:600}}>{authMsg}</div>
              )}
              {needConfirm&&(
                <button onClick={doResend}
                  style={{width:"100%",padding:"10px",borderRadius:12,border:"1.5px solid #6BA6C9",
                    background:"#E2EEF5",color:"#2F6586",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                  Reinvia email di conferma
                </button>
              )}
              <button onClick={isReg?doSignup:doLogin}
                style={{width:"100%",padding:"15px",borderRadius:15,border:"none",
                  background:"#2F6586",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer"}}>
                {isReg?"Registrati":"Accedi"}
              </button>
            </div>
            {!isReg&&(
              <button onClick={doRecover}
                style={{width:"100%",padding:"10px",marginTop:8,border:"none",background:"transparent",
                  color:"#8A949B",fontSize:13,fontWeight:600,cursor:"pointer"}}>
                Password dimenticata?
              </button>
            )}
            <button onClick={function(){setIsReg(!isReg);setAuthErr("");setAuthMsg("");setNeedConfirm(false);}}
              style={{width:"100%",padding:"12px",borderRadius:15,marginTop:4,
                border:"none",background:"transparent",
                color:"#2F6586",fontSize:14,fontWeight:700,cursor:"pointer"}}>
              {isReg?"Hai gia un account? Accedi":"Non hai un account? Registrati"}
            </button>
          </div>
        </div>
      )}

      {/* Conferma email dopo registrazione */}
      {!loading&&!utente&&authView==="confirm"&&(
        <div style={{minHeight:"100vh",maxWidth:390,margin:"0 auto",display:"flex",alignItems:"center",
          justifyContent:"center",padding:"24px",boxSizing:"border-box",background:"#F2F6F8"}}>
          <div style={{width:"100%",maxWidth:340,textAlign:"center"}}>
            <div style={{width:64,height:64,borderRadius:18,background:"#E2EEF5",color:"#2F6586",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,margin:"0 auto 14px"}}>
              <i className="ti ti-mail-check"/>
            </div>
            <div style={{fontSize:22,fontWeight:800,color:"#2C3338"}}>Controlla la tua email</div>
            <div style={{fontSize:14,color:"#8A949B",marginTop:8,lineHeight:1.5}}>
              Ti abbiamo inviato un link di conferma a <b>{emailInput}</b>. Apri l'email (controlla anche lo spam) e poi torna ad accedere.
            </div>
            {authMsg&&<div style={{fontSize:12,color:"#2F6586",fontWeight:600,marginTop:12}}>{authMsg}</div>}
            <button onClick={doResend}
              style={{width:"100%",padding:"12px",borderRadius:13,marginTop:18,border:"1.5px solid #6BA6C9",
                background:"#E2EEF5",color:"#2F6586",fontSize:14,fontWeight:700,cursor:"pointer"}}>
              Reinvia email di conferma
            </button>
            <button onClick={function(){setIsReg(false);setAuthErr("");setAuthMsg("");setAuthView("form");}}
              style={{width:"100%",padding:"12px",borderRadius:13,marginTop:10,border:"none",
                background:"#2F6586",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"}}>
              Vai all'accesso
            </button>
          </div>
        </div>
      )}

      {/* Onboarding nuovo account */}
      {!loading&&utente&&Object.keys(profili).length===0&&(
        <OnboardingFamiglia onComplete={setProfiliLS} pianificazione={pianificazione} setPianificazione={setPianificazioneLS}/>
      )}

      {!loading&&utente&&Object.keys(profili).length>0&&modificaFam&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"#F2F6F8",
          zIndex:1000,overflowY:"auto"}}>
          <OnboardingFamiglia profiliIniziali={profili}
            onComplete={function(pf){ setProfiliLS(pf); setModificaFam(false); }}
            onExit={function(){ setModificaFam(false); }}/>
        </div>
      )}

      {/* App principale */}
      {!loading&&utente&&Object.keys(profili).length>0&&(
      <div style={{background:"#F2F6F8",minHeight:"100vh",maxWidth:390,margin:"0 auto",position:"relative",fontFamily:"'Nunito',system-ui,sans-serif"}}>

      <div key={tab} className="mf-fade" style={{padding:"8px 16px 96px"}}>
        <BannerScadenze dispensa={dispensa}/>
        {tab!=="home" && (
          <button onClick={function(){ setSheetOpen(false); handleSetTab("home"); }}
            style={{display:"flex",alignItems:"center",gap:6,border:"none",background:"transparent",
              color:"#2F6586",fontSize:14,fontWeight:700,cursor:"pointer",padding:"0 0 4px"}}>
            <i className="ti ti-arrow-left" style={{fontSize:18}}/>Home
          </button>
        )}
        <ErrorBoundary key={tab}>
        {tab==="home" && (
          <HomeView profili={profili} menu={menu} builder={builderScelte} dispensa={dispensa} spesa={spesa} setTab={handleSetTab}
            mealPrep={mealPrep} giorniFuori={giorniFuori} piani={piani} setSpesa={setSpesaLS} toggleFuori={toggleFuori}
            medicine={medicine} setMedicine={setMedicineLS} noteGiorno={noteGiorno} setNoteGiorno={setNoteGiornoLS}/>
        )}
        {tab==="menu" && (
          <MenuView menu={menu} builder={builderScelte} setTab={handleSetTab}
            profili={profili} feedback={feedbackPasti} setFeedback={setFeedbackPastiLS}
            ospiti={ospiti} setOspiti={setOspitiLS} familyId={familyId}/>
        )}
        {tab==="diario" && (
          <DiarioView menu={menu} builder={builderScelte} profili={profili}
            diario={diarioLog} setDiario={setDiarioLogLS}/>
        )}
        {tab==="mensa" && (
          <PianiView piani={piani} setPiani={setPianiLS} profili={profili}/>
        )}
        {tab==="amici" && (
          <AmiciView userId={userId} familyId={familyId}/>
        )}
        {tab==="medicine" && (
          <MedicineView profili={profili} medicine={medicine} setMedicine={setMedicineLS}/>
        )}
        {tab==="salute" && (
          <SaluteView profili={profili} setProfili={setProfili} setTab={handleSetTab} pesoLog={pesoLog} setPesoLog={setPesoLog} onSavePeso={savePesoToSupabase}/>
        )}
        {tab==="dispensa" && (
          <DispensaView dispensa={dispensa} setDispensa={setDispensaLS}
            spesa={spesa} setSpesa={setSpesaLS}/>
        )}
        {tab==="spesa" && (
          <ListaSpesaView spesa={spesa} setSpesa={setSpesaLS} builder={builderScelte} menu={menu} ospiti={ospiti}/>
        )}
        {tab==="mealprep" && (
          <TabMealPrep mealPrep={mealPrep} setMealPrep={setMealPrepLS}
            profili={profili}/>
        )}
        {tab==="impostazioni" && (
          <div>
            <TabImpostazioni
              profili={profili} setProfili={setProfiliLS}
              pianificazione={pianificazione} setPianificazione={setPianificazioneLS}
              pesoLog={pesoLog} setPesoLog={setPesoLogLS}
              pin={pin} setPin={setPinLS}
              familyId={familyId} userId={userId} isAdmin={isAdmin}
              utenteEmail={utente ? utente.email : ""}
              onSincronizza={sincronizzaTutto} onControlla={controllaCloud} onLogout={doLogout}
              onIscritti={function(){ handleSetTab("iscritti"); }}
              onJoinedFamiglia={function(fid){ setFamilyId(fid); saveLS("family_id", fid); loadFromSupabase(fid); handleSetTab("home"); }}
              onModificaFamiglia={function(){ setModificaFam(true); }}/>
          </div>
        )}
        {tab==="iscritti" && isAdmin && (
          <IscrittiView setTab={handleSetTab}/>
        )}
        {tab==="iscritti" && !isAdmin && (
          <div className="mf-card" style={{textAlign:"center",color:"#8A949B",fontSize:13}}>
            Sezione riservata.
          </div>
        )}
        {tab==="piramide" && (
          <PiramideView/>
        )}
        {tab==="idee" && (
          <TabIdee profili={profili} dispensa={dispensa}/>
        )}
        {tab==="builder" && (
          <TabBuilder menu={menu} setMenuOverride={setMenuOverrideLS} profili={profili}
            builderScelte={builderScelte} setBuilderScelte={setBuilderScelteLS}
            builderScelteProssima={builderScelteProssima} setBuilderScelteProssima={setBuilderScelteProssimaLS}
            mealPrep={mealPrep} dispensa={dispensa} setMealPrep={setMealPrepLS}
            alimentiCustom={alimentiCustom} setAlimentiCustom={setAlimentiCustomLS}
            onSavePasto={savePastoToSupabase}/>
        )}
        {tab==="ai" && (
          <AssistenteAI profili={profili} familyId={familyId}/>
        )}
        </ErrorBoundary>
      </div>

      <nav className="nav">
        <button className={"tab"+(tab==="home"?" on":"")} onClick={function(){setSheetOpen(false);handleSetTab("home");}}>
          <i className="ti ti-home"/>Home
        </button>
        <button className={"tab"+(tab==="menu"?" on":"")} onClick={function(){setSheetOpen(false);handleSetTab("menu");}}>
          <i className="ti ti-tools-kitchen-2"/>Menu
        </button>
        <button className={"tab"+(tab==="builder"?" on":"")} onClick={function(){setSheetOpen(false);handleSetTab("builder");}}>
          <span className="fab"><i className="ti ti-layout-grid-add"/></span>
        </button>
        <button className={"tab"+(tab==="diario"?" on":"")} onClick={function(){setSheetOpen(false);handleSetTab("diario");}}>
          <i className="ti ti-notebook"/>Diario
        </button>
        <button className={"tab"+(MORE_TABS.indexOf(tab)>=0?" on":"")} onClick={function(){setSheetOpen(true);}}>
          <i className="ti ti-dots"/>Altro
        </button>
      </nav>

      {sheetOpen&&(
        <div className="sheet-back" onClick={function(e){ if(e.target===e.currentTarget) setSheetOpen(false); }}>
          <div className="sheet">
            <div className="grab"/>
            <h3 style={{fontSize:16,fontWeight:700,marginBottom:6}}>Altro</h3>
            <div className="mf-card flush" style={{border:"none"}}>
              {SHEET_ITEMS.map(function(it){
                return (
                  <div key={it.id} className="mf-row" style={{cursor:"pointer"}}
                    onClick={function(){ setSheetOpen(false); handleSetTab(it.id); }}>
                    <div className="mf-ic"><i className={"ti "+it.ic}/></div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:600}}>{it.l}</div>
                      <div style={{fontSize:11,color:"#8A949B"}}>{it.s}</div>
                    </div>
                    <i className="ti ti-chevron-right" style={{color:"#B4BEC4",fontSize:18}}/>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
    )}
    </div>
  );
}
