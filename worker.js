/** Meridian simulation API proxy — Cloudflare Worker / Groq */
const ALLOWED_ORIGINS = new Set([
  "https://meridian-1-vb7w.onrender.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);
const GROQ_MODEL = "llama-3.3-70b-versatile";
const MAX_BODY_BYTES = 64 * 1024;
const buckets = new Map();

function cors(origin){
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "";
  return {
    ...(allowed ? {"Access-Control-Allow-Origin": allowed} : {}),
    "Vary":"Origin",
    "Access-Control-Allow-Methods":"POST, OPTIONS",
    "Access-Control-Allow-Headers":"Content-Type",
  };
}
function json(body,status,headers){ return new Response(JSON.stringify(body),{status,headers:{...headers,"Content-Type":"application/json","Cache-Control":"no-store"}}); }
function limited(ip){
  const now=Date.now(), windowMs=60_000, max=30;
  const b=buckets.get(ip);
  if(!b || now-b.start>windowMs){ buckets.set(ip,{start:now,count:1}); return false; }
  b.count++; return b.count>max;
}
export default {
  async fetch(request, env) {
    const origin=request.headers.get("Origin") || "";
    const headers=cors(origin);
    if(request.method==="OPTIONS") return ALLOWED_ORIGINS.has(origin) ? new Response(null,{status:204,headers}) : new Response(null,{status:403});
    if(request.method==="GET") return json({status:"ok",provider:"groq",mode:"simulation"},200,headers);
    if(request.method!=="POST") return json({error:{message:"Method not allowed"}},405,headers);
    if(!ALLOWED_ORIGINS.has(origin)) return json({error:{message:"Origin not allowed"}},403,headers);
    if(limited(request.headers.get("CF-Connecting-IP") || "unknown")) return json({error:{message:"Rate limit exceeded. Try again shortly."}},429,headers);
    if(!env.GROQ_API_KEY) return json({error:{message:"GROQ_API_KEY secret is not set."}},500,headers);
    const len=Number(request.headers.get("content-length")||0);
    if(len>MAX_BODY_BYTES) return json({error:{message:"Request too large"}},413,headers);
    let incoming;
    try{ incoming=await request.json(); }catch{ return json({error:{message:"Invalid JSON"}},400,headers); }
    if(!Array.isArray(incoming.messages) || incoming.messages.length>60) return json({error:{message:"Invalid messages"}},400,headers);
    const groqMessages=[];
    if(typeof incoming.system==="string" && incoming.system.length<=12000) groqMessages.push({role:"system",content:incoming.system});
    for(const m of incoming.messages){
      if(!m || !["user","assistant"].includes(m.role) || typeof m.content!=="string" || m.content.length>12000) return json({error:{message:"Invalid message"}},400,headers);
      groqMessages.push({role:m.role,content:m.content});
    }
    let upstream;
    try{
      upstream=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${env.GROQ_API_KEY}`},body:JSON.stringify({model:GROQ_MODEL,max_tokens:Math.min(Math.max(Number(incoming.max_tokens)||300,1),800),temperature:typeof incoming.temperature==="number"?Math.min(Math.max(incoming.temperature,0),1.5):1,messages:groqMessages})});
    }catch(e){ return json({error:{message:"Could not reach Groq API"}},502,headers); }
    let data; try{data=await upstream.json();}catch{return json({error:{message:"Invalid upstream response"}},502,headers);}
    if(!upstream.ok) return json({error:{message:data?.error?.message || "Upstream request failed"}},upstream.status,headers);
    return json({content:[{type:"text",text:data?.choices?.[0]?.message?.content ?? ""}]},200,headers);
  }
};
