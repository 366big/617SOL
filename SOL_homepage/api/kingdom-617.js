const API = "https://api.mightpulse.com/v1";
const WEB_API = "https://mightpulse.com/api";

async function readJson(response) {
  const raw = await response.text();
  try { return JSON.parse(raw); } catch { return { raw }; }
}
function normalizeRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.filter(r => r && (r.opponent_kid != null || r.season != null || r.result)).map(r => ({
    opponent_kid:Number(r.opponent_kid ?? 0), prep:r.prep||"", castle:r.castle||"", result:r.result||"", label:r.label||"",
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
export default async function handler(req,res){
  if(req.method!=="GET") return res.status(405).json({error:"Method not allowed"});
  const key=process.env.MIGHTPULSE_API_KEY;
  if(!key) return res.status(500).json({error:"MIGHTPULSE_API_KEY is not configured in Vercel."});
  try{
    const [kingdomResponse,webResponse]=await Promise.all([
      fetch(`${API}/kingdoms/617`,{headers:{Authorization:`Bearer ${key}`,Accept:"application/json"}}),
      fetch(`${WEB_API}/kingdoms/617?players=100&alliances=100`,{headers:{Accept:"application/json, text/plain, */*",Referer:"https://mightpulse.com/kingdom/617",Origin:"https://mightpulse.com","User-Agent":"Mozilla/5.0"}})
    ]);
    const data=await readJson(kingdomResponse), webData=await readJson(webResponse);
    if(!kingdomResponse.ok) return res.status(kingdomResponse.status).json({error:"MightPulse kingdom request failed."});
    const kingdom=data?.kingdom||data?.data||data;
    const matchup=webData?.kvk_matchup||webData?.data?.kvk_matchup||{};
    const history=extractHistory(webData);
    res.setHeader("Cache-Control","s-maxage=1800, stale-while-revalidate=3600");
    return res.status(200).json({kingdom:617,name:kingdom?.name||"617",kvk:{season:Number(matchup?.season??0),opponent_kid:Number(matchup?.opponent?.kid??0),history},fetched_at:new Date().toISOString(),source:"MightPulse"});
  }catch(err){ return res.status(500).json({error:"Unexpected kingdom server error.",detail:String(err?.message||err)}); }
}
