// Netlify Function: secure Gemini proxy. Set GEMINI_API_KEY in Netlify environment variables.
const MODEL = 'gemini-2.5-flash';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM_INSTRUCTION = `
You are Investment Saarthi, an empathetic Indian financial-literacy educator for beginner retail investors.
PRODUCT SCOPE: Answer only educational questions about personal-finance basics, investing concepts, mutual funds, diversification, risk, fees, liquidity, taxes at a high level, and goal-planning scenarios. If unrelated, politely say this assistant is limited to investment education and redirect.
BEHAVIOUR CONTRACT:
- Never provide direct stock, security, crypto, token, fund, or portfolio buy/sell/hold calls; never name a security as a purchase candidate; never predict a share will double; never provide price targets or timing.
- Never promise or imply guaranteed, assured, risk-free, or certain returns. Explain uncertainty and possibility of loss.
- For stock/crypto tips, refuse briefly and empathetically, explain concentration/speculation risk, then pivot to diversification, broad index concepts, risk tolerance and learning.
- Do not present illustrative asset mixes as personalised recommendations. Do not override or recalculate the deterministic risk result supplied in the request.
- Use only the supplied demo knowledge context for source-backed factual claims. If it does not support a claim, clearly say a reviewed source is not available in this prototype; do not invent citations, dates, SEBI endorsements, or source verification.
- Do not claim to be SEBI-approved, SEBI-compliant, or a regulated adviser. Do not say this prototype's demo references are verified by SEBI/AMFI.
- Use plain English, short sections and clean bullet points. Use ₹ for Indian currency. Explain risks, costs and liquidity where relevant.
- For scenarios, explain that returns are hypothetical assumptions, not forecasts; mention inflation, tax, fees and volatility where relevant. Do not change deterministic calculations.
- Never request passwords, OTPs, bank credentials, PAN, Aadhaar or account numbers.
- End every answer with: "Educational only — not investment, tax or legal advice."
Return concise, well-structured text. Do not output markdown tables unless requested.
`;

const KNOWLEDGE = [
  { id:'SEBI-IE-DEMO', title:'SEBI Investor Education — learning reference (demo)', topics:['investing basics','risk','diversification','fraud awareness'], note:'Use as a pointer for users to consult current official SEBI investor education materials. This prototype does not retrieve or verify live SEBI pages.' },
  { id:'AMFI-MFB-DEMO', title:'AMFI Mutual Fund Basics — learning reference (demo)', topics:['mutual funds','SIP','NAV','expense ratio'], note:'Use as a pointer for users to consult current AMFI investor education materials and scheme documents. This prototype does not retrieve or verify live AMFI pages.' },
  { id:'SIP-CALC-DEMO', title:'Investment Saarthi SIP calculator methodology (demo)', topics:['SIP','compounding','scenario'], note:'Monthly contribution at month-end with monthly compounding; hypothetical annual rate divided by 12.' }
];

function json(statusCode, body) {
  return { statusCode, headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}, body:JSON.stringify(body) };
}
function isTipRequest(text) {
  return /\b(which|what|tell me|recommend|suggest|name)\b.{0,50}\b(stock|share|crypto|coin|token|fund)\b.{0,60}\b(buy|invest|double|multibagger|rocket|pick|purchase|will rise)\b/i.test(text)
    || /\b(stock|share|crypto|coin|token)\b.{0,60}\b(double|multibagger|guaranteed|price target)\b/i.test(text)
    || /\b(buy|sell|hold)\b.{0,30}\b(share|stock|crypto|coin|ticker)\b/i.test(text);
}
function isOutOfScope(text) {
  const terms = /\b(weather|recipe|football|cricket|dating|homework|write my code|politics|medical diagnosis)\b/i;
  return terms.test(text);
}
function chooseSources(text, task) {
  const t = String(text||'').toLowerCase();
  const found = [];
  if (/sip|mutual fund|nav|expense ratio|index fund|lumpsum|lump sum/.test(t)) found.push(KNOWLEDGE[1]);
  if (/risk|diversif|stock|share|crypto|market|portfolio/.test(t)) found.push(KNOWLEDGE[0]);
  if (task === 'scenario_analysis' || task === 'profile_summary') found.push(KNOWLEDGE[2]);
  return [...new Map(found.map(x=>[x.id,x])).values()];
}
function extractText(data) {
  return (data.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('\n').trim();
}
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return {statusCode:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS'},body:''};
  if (event.httpMethod !== 'POST') return json(405,{error:'Method not allowed'});
  if (!process.env.GEMINI_API_KEY) return json(503,{error:'AI service is not configured. Add GEMINI_API_KEY in Netlify environment variables.'});
  let body;
  try { body=JSON.parse(event.body||'{}'); } catch { return json(400,{error:'Invalid JSON body'}); }
  const task=String(body.task||'education');
  const payload=body.payload||{};
  const userText = task==='education' ? String(payload.question||'') : JSON.stringify(payload);
  if (!userText.trim() || userText.length>12000) return json(400,{error:'A non-empty request under 12,000 characters is required.'});

  // Deterministic safety gates before model invocation.
  if (task==='education' && isTipRequest(userText)) {
    return json(200,{reply:'I can’t pick a stock or predict which share will double. Short-term stock moves are uncertain, and concentrating money in one company can expose you to substantial loss. I can help you understand diversification, broad-market index funds, risk and how to evaluate an investment category instead.\n\nEducational only — not investment, tax or legal advice.',sourceCitation:'SEBI Investor Education — learning reference (demo; consult current official materials)',guardrailTriggered:true,latencyMs:0,estimatedCost:'₹0.00 (blocked before AI)'});
  }
  if (task==='education' && isOutOfScope(userText)) {
    return json(200,{reply:'I’m designed for investment and personal-finance education, so I can’t help with that topic. You can ask me about mutual funds, SIPs, diversification, investment risk or fees.\n\nEducational only — not investment, tax or legal advice.',sourceCitation:'No source retrieved — outside product scope',guardrailTriggered:true,latencyMs:0,estimatedCost:'₹0.00 (blocked before AI)'});
  }
  const sources=chooseSources(userText,task);
  const sourceContext=sources.length?sources.map(s=>`[${s.id}] ${s.title}: ${s.note}`).join('\n'):'No matching reviewed source is available in this demo knowledge set.';
  const prompt = `TASK: ${task}\nUSER REQUEST / CONTEXT:\n${userText}\n\nDEMO KNOWLEDGE CONTEXT:\n${sourceContext}\n\nFor profile_summary, explain the supplied deterministic result only; do not change the level or score. For scenario_analysis, interpret the supplied calculator outputs and assumptions without recalculating or forecasting. For education, answer the question only from supported knowledge; explicitly state source gaps.`;
  const started=Date.now();
  try {
    const upstream=await fetch(`${API_URL}?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        systemInstruction:{parts:[{text:SYSTEM_INSTRUCTION}]},
        contents:[{role:'user',parts:[{text:prompt}]}],
        generationConfig:{temperature:0.25,maxOutputTokens:700,responseMimeType:'text/plain'}
      })
    });
    const data=await upstream.json();
    const latencyMs=Date.now()-started;
    if(!upstream.ok) {
      console.error('Gemini upstream error',upstream.status, data?.error?.message||'unknown');
      return json(502,{error:'The AI service could not complete this request. Please try again.',latencyMs});
    }
    let reply=extractText(data);
    if(!reply) reply='I could not generate a grounded answer. Please try a more specific educational question.';
    // Enforce the disclaimer even if the model omits it.
    if(!/Educational only — not investment, tax or legal advice\./i.test(reply)) reply += '\n\nEducational only — not investment, tax or legal advice.';
    // Never claim a source was retrieved if none matched.
    const sourceCitation=sources.length?sources.map(s=>s.title).join('; '):'No reviewed source matched this question in the prototype knowledge set.';
    const usage=data.usageMetadata||{};
    const tokens=(usage.promptTokenCount||0)+(usage.candidatesTokenCount||0);
    const estimatedCost=`~${tokens} tokens · pricing not calculated`;
    return json(200,{reply,sourceCitation,guardrailTriggered:false,latencyMs,estimatedCost});
  } catch(err) {
    console.error('Gemini proxy failure',err.message);
    return json(502,{error:'Unable to reach the AI service. Please try again.'});
  }
};
