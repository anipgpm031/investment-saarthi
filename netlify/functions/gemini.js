// Netlify Function: secure Gemini proxy. Set GEMINI_API_KEY in Netlify environment variables.
const MODEL = 'gemini-3.1-flash-lite';
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

// Source map: benchmark labels come from the supplied Golden Dataset v2.
// Public links below point to official SEBI/AMFI material where available.
// A benchmark label is not represented as a separately uploaded document.
const KNOWLEDGE = [
  { id:'GD-01', title:'SEBI Investor Education Guide — investing basics, emergency buffer and diversification', benchmark:'SEBI Investor Education Guide Sec 2.1', url:'https://investor.sebi.gov.in/', topics:/emergency|start investing|where should i start|surplus|diversif|index fund|risk|market|portfolio|stock|share|crypto|options|f&o|volatil|crash|drop|red/i },
  { id:'GD-02', title:'SEBI Investor Education — understanding mutual funds and investment risk', benchmark:'Behavioral Finance Handbook Ch 4 (golden-dataset benchmark); SEBI investor education', url:'https://investor.sebi.gov.in/understanding_mf.html', topics:/market drop|market fell|portfolio.*red|panic|sell everything|pull.*out|volatil|loss|crash|fear/i },
  { id:'GD-03', title:'SEBI Investor Education — risk, diversification and investor protection', benchmark:'SEBI IA Regulations & Guardrail Policy (golden-dataset benchmark)', url:'https://investor.sebi.gov.in/', topics:/stock tip|top.*stocks|guaranteed|double|buy today|which stock|which fund|recommend.*fund|crypto|token|price target/i },
  { id:'GD-04', title:'Investment Saarthi — goal planning and SIP calculation methodology', benchmark:'Goal Planning & Asset Glidepath Doc (golden-dataset benchmark)', url:'https://www.amfiindia.com/investor/knowledge-center', topics:/goal|target|lakh|sip.*need|monthly.*invest|how much.*invest|time horizon|years?/i },
  { id:'GD-05', title:'AMFI — Expense Ratio and Mutual Fund Basics', benchmark:'AMFI Mutual Fund Basics Module 3', url:'https://www.amfiindia.com/investor/knowledge-center-info?zoneName=expenseRatio', topics:/expense ratio|ter|ber|exit load|fund fee|charges|nav/i },
  { id:'GD-06', title:'SEBI Investor Education — understanding risk and investment choices', benchmark:'Personal Cashflow Prioritization Framework (golden-dataset benchmark)', url:'https://investor.sebi.gov.in/', topics:/loan|debt|prepay|interest rate|borrow|emi|cash flow/i },
  { id:'GD-07', title:'SEBI — Mutual Fund Investor FAQs and regulations', benchmark:'Indian Retail Tax & Lock-In Reference 2026 (golden-dataset benchmark)', url:'https://www.sebi.gov.in/legal/faq.html', topics:/tax|elss|ppf|lock.?in|capital gains|ltcg|stcg/i },
  { id:'GD-08', title:'Investment Saarthi — conversational onboarding prompt framework', benchmark:'Conversational Onboarding Prompt Spec (golden-dataset benchmark)', url:'https://investor.sebi.gov.in/', topics:/make.*plan|investment plan|where do i begin|help me invest/i },
  { id:'GD-09', title:'SEBI — Specialized Investment Fund regulatory framework', benchmark:'SEBI SIF Regulatory Circular Summary', url:'https://www.sebi.gov.in/sebi_data/attachdocs/dec-2024/1734952378369.pdf', topics:/specialized investment fund|\\bsif\\b/i },
  { id:'GD-10', title:'Investment Saarthi — multi-goal bucket planning framework', benchmark:'Multi-Goal Bucket Strategy Guide (golden-dataset benchmark)', url:'https://investor.sebi.gov.in/', topics:/multiple goals|three goals|home.*retire|retire.*travel|prioriti[sz].*goal|short.?term.*goal/i },
  { id:'GD-11', title:'Investment Saarthi — AI behaviour contract and security guardrails', benchmark:'System Guardrail & Security Spec v1', url:'https://investor.sebi.gov.in/', topics:/ignore previous|ignore.*instruction|act as.*advisor|sebi.?registered|guarantee.*return|override/i },
  { id:'GD-12', title:'AMFI — Introduction to Mutual Funds and investment fundamentals', benchmark:'Partner Educator Curriculum Kit Sec 1', url:'https://www.amfiindia.com/investor/knowledge-center-info?zoneName=IntroductionMutualFunds', topics:/asset allocation|fund selection|mutual fund|index fund|equity fund|debt fund|hybrid fund|what is.*fund/i },
  { id:'GD-13', title:'SEBI Investor Education — inflation, risk and investment avenues', benchmark:'Inflation & Purchasing Power Module (golden-dataset benchmark)', url:'https://investor.sebi.gov.in/', topics:/inflation|purchasing power|fixed deposit|\\bfd\\b|real return/i },
  { id:'GD-14', title:'SEBI — Risk disclosures for derivatives and speculative trading', benchmark:'SEBI F&O Risk Disclosure & Diversification Doc', url:'https://www.sebi.gov.in/', topics:/f&o|futures|options|derivative|meme coin|speculat|80%.*saving|crypto/i },
  { id:'GD-15', title:'SEBI Investor Education — emergency savings and investment risk', benchmark:'Financial Health Check Rules Engine (golden-dataset benchmark)', url:'https://investor.sebi.gov.in/', topics:/zero emergency|no emergency|all.*savings|emergency fund|cash reserve/i },
  { id:'GD-16', title:'AMFI — Mutual Fund investor information and SIP operations', benchmark:'AMFI SIP Operations & Mandate FAQ', url:'https://www.amfiindia.com/investor', topics:/pause.*sip|stop.*sip|cancel.*sip|sip bounce|mandate|miss.*sip/i },
  { id:'GD-17', title:'SEBI Investor Education — mutual funds, withdrawals and risk', benchmark:'Senior Citizen Capital Preservation Guide (golden-dataset benchmark)', url:'https://investor.sebi.gov.in/understanding_mf.html', topics:/retire|senior|father|monthly income|swp|capital preservation|principal/i },
  { id:'GD-18', title:'Investment Saarthi — product scope and escalation policy', benchmark:'Scope & Escalation Policy Sec 3', url:'https://investor.sebi.gov.in/', topics:/legal will|health insurance|medical|diagnosis|legal advice|unrelated/i },
  { id:'GD-19', title:'SEBI — Mutual Fund TER/BER disclosure and expense framework', benchmark:'SEBI 2026 TER/BER Disclosure Guidelines (golden-dataset benchmark)', url:'https://www.sebi.gov.in/', topics:/base expense ratio|\\bber\\b|total expense|gst|stamp duty|stt/i },
  { id:'GD-20', title:'Investment Saarthi — family goal summary and financial alignment', benchmark:'Family Financial Alignment Prompt Spec (golden-dataset benchmark)', url:'https://investor.sebi.gov.in/', topics:/share.*goal|family|export.*summary|goal summary/i },
  { id:'AMFI-CORE', title:'AMFI Investor Corner — mutual fund basics, types, risks and tools', benchmark:'AMFI Investor Corner', url:'https://www.amfiindia.com/investor', topics:/sip|lumpsum|lump sum|nav|mutual fund|expense|index|equity|debt|hybrid|diversif/i },
  { id:'SEBI-CORE', title:'SEBI Investor — securities market and mutual fund education', benchmark:'SEBI Investor Education Programme', url:'https://investor.sebi.gov.in/understanding_mf.html', topics:/invest|market|risk|return|fraud|portfolio|asset/i }
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
  const t=String(text||'').toLowerCase();
  const matches=KNOWLEDGE.filter(s=>s.topics.test(t));
  // Always provide a relevant foundational public source for an in-scope education question.
  if (!matches.length && task==='education') return [KNOWLEDGE.find(s=>s.id==='SEBI-CORE'), KNOWLEDGE.find(s=>s.id==='AMFI-CORE')];
  if (task==='scenario_analysis' || task==='profile_summary') matches.push(KNOWLEDGE.find(s=>s.id==='GD-04'));
  if (!matches.some(s=>s.id==='SEBI-CORE' || s.id==='AMFI-CORE') && task==='education' && /mutual fund|sip|nav|expense|index|equity|debt/i.test(t)) matches.push(KNOWLEDGE.find(s=>s.id==='AMFI-CORE'));
  return [...new Map(matches.filter(Boolean).map(x=>[x.id,x])).values()].slice(0,3);
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
    return json(200,{reply:'I can’t pick a stock or predict which share will double. Short-term stock moves are uncertain, and concentrating money in one company can expose you to substantial loss. I can help you understand diversification, broad-market index funds, risk and how to evaluate an investment category instead.\n\nEducational only — not investment, tax or legal advice.',sourceCitation:'SEBI Investor Education — investor education and risk awareness',sourceReferences:[{id:'GD-03',title:'SEBI Investor Education — risk, diversification and investor protection',benchmark:'SEBI IA Regulations & Guardrail Policy (golden-dataset benchmark)',url:'https://investor.sebi.gov.in/'}],guardrailTriggered:true,latencyMs:0,estimatedCost:'₹0.00 (blocked before AI)'});
  }
  if (task==='education' && isOutOfScope(userText)) {
    return json(200,{reply:'I’m designed for investment and personal-finance education, so I can’t help with that topic. You can ask me about mutual funds, SIPs, diversification, investment risk or fees.\n\nEducational only — not investment, tax or legal advice.',sourceCitation:'No source retrieved — outside product scope',guardrailTriggered:true,latencyMs:0,estimatedCost:'₹0.00 (blocked before AI)'});
  }
  const sources=chooseSources(userText,task);
  const sourceContext=sources.map(s=>`[${s.id}] ${s.title}. Golden dataset benchmark label: ${s.benchmark}. Official/public reference URL: ${s.url}. Use this only for claims within its scope; do not claim the benchmark document itself was retrieved.`).join('\n');
  const prompt = `TASK: ${task}\nUSER REQUEST / CONTEXT:\n${userText}\n\nDEMO KNOWLEDGE CONTEXT:\n${sourceContext}\n\nWrite the answer in plain, readable sections with short headings and short paragraphs. Avoid markdown syntax such as **, ##, backticks, or markdown tables. Use simple bullets only when useful. For profile_summary, explain the supplied deterministic result only; do not change the level or score. For scenario_analysis, interpret the supplied calculator outputs and assumptions without recalculating or forecasting. For education, answer the question only from supported knowledge; explicitly state source gaps.`;
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
    const sourceCitation=sources.map(s=>s.title).join('; ');
    const sourceReferences=sources.map(s=>({id:s.id,title:s.title,benchmark:s.benchmark,url:s.url}));
    const usage=data.usageMetadata||{};
    const tokens=(usage.promptTokenCount||0)+(usage.candidatesTokenCount||0);
    const estimatedCost=`~${tokens} tokens · pricing not calculated`;
    return json(200,{reply,sourceCitation,sourceReferences,guardrailTriggered:false,latencyMs,estimatedCost});
  } catch(err) {
    console.error('Gemini proxy failure',err.message);
    return json(502,{error:'Unable to reach the AI service. Please try again.'});
  }
};
