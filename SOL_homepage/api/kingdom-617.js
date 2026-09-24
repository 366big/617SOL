const API = "https://api.mightpulse.com/v1";
const WEB_API = "https://mightpulse.com/api";

async function readJson(response) {
  const raw = await response.text();
  try { return JSON.parse(raw); } catch { return { raw }; }
}
function normalizeRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.filter(r => r && (r.opponent_kid != null || r.season != null || r.result)).map(r => ({
    opponent_kid:Number(r.opponent_kid ?? 0), prep:r.prep||r.prep_result||r.preparation||r.preparation_result||"", castle:r.castle||r.castle_result||r.battle||r.battle_result||"", result:r.result||"", label:r.label||"",
    season:Number(r.season ?? 0), appointed_at:Number(r.appointed_at ?? r.first_at ?? r.begin_ts ?? 0), nick_name:r.nick_name||"—",
    alliance_abbr:r.alliance_abbr||"", role:r.role||(r.high_king?"High King":"King"), high_king:Boolean(r.high_king), avatar_url:r.avatar_url||""
  })).sort((a,b)=>(b.season-a.season)||(b.appointed_at-a.appointed_at));
}
function findArraysByKey(value,key,out=[]) {
  if(!value||typeof value!=="object") return out;
  if(Array.isArray(value)){ for(const item of value) findArraysByKey(item,key,out); return out; }
  for(const [k,v] of Object.entries(value)){ if(k===key&&Array.isArray(v)) out.push(v); findArraysByKey(v,key,out); }
  return out;
}
function extractHistory(data){
  const candidates=[...findArraysByKey(data,"history"),...findArraysByKey(data,"cycles")];
  return candidates.map(normalizeRows).filter(Boolean).sort((a,b)=>b.length-a.length)[0]||[];
}
function first(obj, keys, fallback="") {
  if (!obj || typeof obj !== "object") return fallback;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return fallback;
}
function num(v) {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return 0;
  const n=parseFloat(v.replace(/,/g,""));
  return Number.isFinite(n) ? n : 0;
}
function allObjects(value, out=[], depth=0) {
  if (!value || typeof value !== "object" || depth>8) return out;
  if (Array.isArray(value)) { for (const x of value) allObjects(x,out,depth+1); return out; }
  out.push(value);
  for (const v of Object.values(value)) if (v && typeof v === "object") allObjects(v,out,depth+1);
  return out;
}
function findCandidateArrays(value, out=[], depth=0) {
  if (!value || typeof value !== "object" || depth>8) return out;
  if (Array.isArray(value)) {
    if (value.length && value.some(x=>x && typeof x === "object")) out.push(value);
    for (const x of value) findCandidateArrays(x,out,depth+1);
    return out;
  }
  for (const [k,v] of Object.entries(value)) {
    if (Array.isArray(v) && v.length && v.some(x=>x && typeof x === "object")) out.push({key:k,items:v});
    findCandidateArrays(v,out,depth+1);
  }
  return out;
}
function extractRankings(data) {
  const candidates=findCandidateArrays(data);
  const players=[], alliances=[], mystic=[];
  const seenP=new Set(), seenA=new Set(), seenM=new Set();
  for (const c of candidates) {
    const items=(Array.isArray(c)?c:c.items||[]).filter(x=>x&&typeof x==='object');
    const key=String(Array.isArray(c)?'':(c.key||'')).toLowerCase();
    if(!items.length) continue;
    const allianceContext=/alliance|alliances/.test(key);
    const playerContext=/player|players|governor|governors|leaderboard|rankings|ranking/.test(key);
    for(const r of items){
      const name=String(first(r,["nick_name","nickname","player_name","governor_name","player","governor"],"")).trim();
      const alliance=String(first(r,["alliance_abbr","alliance_tag","abbr","tag","alliance_name"],"")).trim();
      const power=num(first(r,["power","governor_power","player_power","total_power","might"],0));
      const mysticScore=num(first(r,["mystic_trial","mysticTrial","mystic_score","mystic","mystic_points"],0));
      const avatar=first(r,["avatar_url","avatar","image"],"");
      const id=String(first(r,["id","player_id","governor_id"],name+"|"+alliance));
      const allianceName=String(first(r,["alliance_abbr","abbr","tag","alliance_name","name"],"")).trim();
      const alliancePower=num(first(r,["alliance_power","power","total_power"],0));

      if((allianceContext || (!playerContext && allianceName && alliancePower>0 && !name)) && allianceName && alliancePower>0 && !seenA.has(allianceName)){
        seenA.add(allianceName); alliances.push({name:allianceName,power:alliancePower,avatar});
      }
      if((playerContext || (!allianceContext && name)) && name && power>0 && !seenP.has(id)){
        seenP.add(id); players.push({name,alliance,power,avatar});
      }
      if((playerContext || /mystic/.test(key)) && name && mysticScore>0 && !seenM.has(id)){
        seenM.add(id); mystic.push({name,alliance,score:mysticScore,avatar});
      }
    }
  }
  players.sort((a,b)=>b.power-a.power);
  mystic.sort((a,b)=>b.score-a.score);
  alliances.sort((a,b)=>b.power-a.power);
  return {alliance_power:alliances.slice(0,10),personal_power:players.slice(0,20),mystic_trial:mystic.slice(0,20)};
}

async function fetchBoard(board, limit, key) {
  const response = await fetch(`${API}/kingdoms/617/ranks?board=${encodeURIComponent(board)}&limit=${limit}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" }
  });
  const data = await readJson(response);
  if (!response.ok) {
    throw new Error(`MightPulse ${board} request failed (${response.status}).`);
  }
  return data;
}

function extractBoardRows(data) {
  const roots = [data?.ranks, data?.leaderboard, data?.board, data?.data, data?.data?.ranks, data?.data?.leaderboard];
  for (const root of roots) {
    if (Array.isArray(root)) return root;
    if (root && typeof root === "object") {
      for (const k of ["rows", "items", "results", "entries", "leaderboard", "ranks"]) {
        if (Array.isArray(root[k])) return root[k];
      }
    }
  }
  return [];
}

function normalizeAllianceBoard(data) {
  return extractBoardRows(data).map((r, i) => ({
    rank: Number(r.rank ?? r.kingdom_rank ?? r.position ?? i + 1),
    name: String(r.abbr ?? r.name ?? r.alliance_abbr ?? r.tag ?? "—"),
    full_name: String(r.name ?? r.alliance_name ?? r.abbr ?? r.tag ?? "—"),
    power: num(r.score ?? r.power ?? r.alliance_power ?? r.value ?? r.total_power)
  })).filter(r => r.name !== "—" && r.power > 0).slice(0, 10);
}

function normalizePlayerBoard(data, field) {
  return extractBoardRows(data).map((r, i) => ({
    rank: Number(r.rank ?? r.kingdom_rank ?? r.position ?? i + 1),
    name: String(r.nick_name ?? r.nickname ?? r.player_name ?? r.name ?? "—"),
    alliance: String(r.alliance_abbr ?? r.abbr ?? r.alliance_tag ?? r.tag ?? ""),
    score: num(r.score ?? r[field] ?? r.value ?? r.power ?? r.mystic_trial)
  })).filter(r => r.name !== "—" && r.score > 0).slice(0, 20);
}


export default async function handler(req,res){
  if(req.method!=="GET") return res.status(405).json({error:"Method not allowed"});
  const key=process.env.MIGHTPULSE_API_KEY;
  if(!key) return res.status(500).json({error:"MIGHTPULSE_API_KEY is not configured in Vercel."});
  try{
    const [kingdomResponse,webResponse,allianceData,personalData,mysticData]=await Promise.all([
      fetch(`${API}/kingdoms/617`,{headers:{Authorization:`Bearer ${key}`,Accept:"application/json"}}),
      fetch(`${WEB_API}/kingdoms/617?players=100&alliances=100`,{headers:{Accept:"application/json, text/plain, */*",Referer:"https://mightpulse.com/kingdom/617",Origin:"https://mightpulse.com","User-Agent":"Mozilla/5.0"}}),
      fetchBoard("alliance_power",10,key),
      fetchBoard("personal_power",20,key),
      fetchBoard("mystic_trial",20,key)
    ]);
    const data=await readJson(kingdomResponse), webData=await readJson(webResponse);
    if(!kingdomResponse.ok) return res.status(kingdomResponse.status).json({error:"MightPulse kingdom request failed."});
    const kingdom=data?.kingdom||data?.data||data;
    const matchup=webData?.kvk_matchup||webData?.data?.kvk_matchup||{};
    const history=extractHistory(webData);
    res.setHeader("Cache-Control","s-maxage=1800, stale-while-revalidate=3600");
    return res.status(200).json({
      kingdom:617, name:kingdom?.name||"617",
      kvk:{season:Number(matchup?.season??0),opponent_kid:Number(matchup?.opponent?.kid??0),history},
      rankings:{
        alliance_power:normalizeAllianceBoard(allianceData),
        personal_power:normalizePlayerBoard(personalData,"power"),
        mystic_trial:normalizePlayerBoard(mysticData,"mystic_trial")
      },
      fetched_at:new Date().toISOString(),source:"MightPulse"
    });
  }catch(err){ return res.status(500).json({error:"Unexpected kingdom server error.",detail:String(err?.message||err)}); }
}
