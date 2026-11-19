/* Investment Saarthi — frontend prototype.
   Suitability and SIP arithmetic are deterministic. Gemini is used only for educational language. */
(() => {
  const $ = (id) => document.getElementById(id);
  const state = { answers: {}, step: 0, profile: null, chart: null, lastLatency: null };
  const questions = [
    { key:'age', prompt:'First, how old are you?', placeholder:'Your age in years', type:'number', min:18, max:100 },
    { key:'income', prompt:'Roughly what is your monthly take-home income?', placeholder:'For example, 50000', type:'number', min:0, max:100000000, choices:['₹25,000–₹50,000','₹50,000–₹1,00,000','Above ₹1,00,000'] },
    { key:'saving', prompt:'How much could you comfortably set aside each month after essential expenses?', placeholder:'For example, 5000', type:'number', min:0, max:10000000, choices:['Under ₹5,000','₹5,000–₹10,000','₹10,000–₹25,000','Above ₹25,000'] },
    { key:'goal', prompt:'What is your main financial goal right now?', placeholder:'Choose a goal or type your own', choices:['Emergency fund','Home down payment','Higher education','Retirement','Wealth creation','Other'] },
    { key:'horizon', prompt:'When do you expect to need this money?', placeholder:'Choose a time horizon', choices:['Less than 3 years','3–5 years','5–10 years','More than 10 years'] },
    { key:'reaction', prompt:'Imagine your investment value falls by 15% in a market downturn. What would you most likely do?', placeholder:'Choose your likely reaction', choices:['Sell most investments to avoid further loss','Feel worried but stay invested','Stay calm and continue my plan'] }
  ];
  const formatINR = (n) => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);
  const compactINR = (n) => n >= 1e7 ? `₹${(n/1e7).toFixed(2)}Cr` : n >= 1e5 ? `₹${(n/1e5).toFixed(2)}L` : formatINR(n);

  function toast(msg) {
    const el=$('toast'); el.textContent=msg; el.classList.remove('hidden');
    clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.add('hidden'),2800);
  }
  function addMessage(container, text, who='bot', html=false) {
    const wrap=document.createElement('div'); wrap.className=`flex ${who==='user'?'justify-end':'justify-start'} fade-in`;
    const bubble=document.createElement('div'); bubble.className=`message rounded-2xl p-4 text-sm leading-relaxed ${who==='user'?'bg-navy text-white rounded-tr-sm':'bg-slate-100 text-slate-800 rounded-tl-sm'}`;
    if(html) bubble.innerHTML=text; else bubble.textContent=text;
    wrap.appendChild(bubble); container.appendChild(wrap); container.scrollTop=container.scrollHeight;
  }
  function currentQuestion() { return questions[state.step]; }
  function askQuestion() {
    const q=currentQuestion();
    if(!q) return showProfile();
    addMessage($('chatMessages'),q.prompt);
    $('profileInput').placeholder=q.placeholder;
    $('profileInput').type=q.type==='number'?'number':'text';
    $('profileInput').min=q.min ?? ''; $('profileInput').max=q.max ?? '';
    $('answerChoices').innerHTML='';
    (q.choices||[]).forEach(choice=>{
      const b=document.createElement('button'); b.className='rounded-full border border-slate-200 px-3 py-2 text-xs hover:border-emerald-500 hover:bg-emerald-50'; b.textContent=choice;
      b.addEventListener('click',()=>submitAnswer(choice)); $('answerChoices').appendChild(b);
    });
    $('profileInput').value=''; $('profileInput').focus();
  }
  function normaliseAnswer(key, value) {
    if(key==='income'||key==='saving') {
      const parsed=Number(String(value).replace(/[₹,\s]/g,''));
      if(Number.isFinite(parsed)&&parsed>=0) return parsed;
      const match=String(value).match(/[\d,]+/); return match ? Number(match[0].replace(/,/g,'')) : null;
    }
    if(key==='age') { const n=Number(value); return Number.isFinite(n)&&n>=18&&n<=100?n:null; }
    return String(value).trim();
  }
  function submitAnswer(raw) {
    const q=currentQuestion(); if(!q) return;
    const value=normaliseAnswer(q.key,raw);
    if(value===null || value==='') { toast('Please enter a valid answer, or skip this question.'); return; }
    state.answers[q.key]=value;
    addMessage($('chatMessages'),typeof value==='number'&&['income','saving'].includes(q.key)?formatINR(value):String(raw),'user');
    state.step++;
    if(state.step<questions.length) askQuestion(); else showProfile();
  }
  function skipQuestion() {
    const q=currentQuestion(); if(!q) return;
    state.answers[q.key]=null; addMessage($('chatMessages'),'I’d prefer to skip this one.','user');
    state.step++; if(state.step<questions.length) askQuestion(); else showProfile();
  }
  function calculateRisk(a) {
    // Transparent demo heuristic; missing answers are neutral and must not be treated as certainty.
    let score=0; const reasons=[];
    const horizon=String(a.horizon||'');
    if(horizon==='More than 10 years'){score+=2;reasons.push('A longer time horizon may provide more time to ride out volatility.');}
    else if(horizon==='5–10 years'){score+=1;reasons.push('Your 5–10 year horizon offers some flexibility.');}
    else if(horizon==='Less than 3 years'){score-=2;reasons.push('A short horizon makes capital stability and liquidity more important.');}
    else if(horizon==='3–5 years'){score-=1;reasons.push('A 3–5 year horizon calls for care with market-linked risk.');}
    const reaction=String(a.reaction||'');
    if(reaction.startsWith('Sell')){score-=2;reasons.push('You indicated that a 15% fall could prompt you to sell.');}
    else if(reaction.startsWith('Feel worried')){score+=0;reasons.push('You may tolerate some volatility but could feel uncomfortable during a fall.');}
    else if(reaction.startsWith('Stay calm')){score+=2;reasons.push('You indicated greater comfort with short-term market volatility.');}
    const goal=String(a.goal||'');
    if(goal==='Emergency fund'){score-=2;reasons.push('An emergency fund is generally a near-term liquidity priority.');}
    let level=score<=-2?'Conservative':score<=1?'Moderate':'Growth';
    // Missing horizon/reaction prevents the strongest label from being inferred.
    if((!a.horizon||!a.reaction) && level==='Growth') level='Moderate';
    const allocations={Conservative:'Illustrative learning mix: 70–90% high-quality liquid/debt-oriented categories and 10–30% diversified equity exposure, if appropriate.',Moderate:'Illustrative learning mix: 40–60% high-quality debt-oriented categories and 40–60% diversified equity categories.',Growth:'Illustrative learning mix: 20–40% debt-oriented categories and 60–80% diversified equity categories.'};
    return {score,level,reasons,allocation:allocations[level],method:'Demo rule set: horizon + stated 15% drawdown reaction + goal context. This is not a validated suitability model.'};
  }
  async function callGemini(task, payload) {
    const started=performance.now();
    try {
      const response=await fetch('/api/gemini',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task,payload})});
      const data=await response.json();
      const clientLatency=Math.round(performance.now()-started);
      updateTelemetry(data.latencyMs ?? clientLatency, data.estimatedCost ?? null);
      if(!response.ok) throw new Error(data.error||'AI service unavailable');
      return data;
    } catch(err) {
      updateTelemetry(Math.round(performance.now()-started),null);
      throw err;
    }
  }
  function updateTelemetry(latency,cost) {
    state.lastLatency=latency;
    $('telemetryLatency').textContent=Number.isFinite(Number(latency))?`${Math.round(latency)} ms`:'—';
    $('telemetryCost').textContent=cost||'Demo estimate unavailable';
  }
  async function showProfile() {
    $('chatScreen').classList.add('hidden'); $('profileResult').classList.remove('hidden');
    const risk=calculateRisk(state.answers); state.profile={...state.answers,...risk};
    renderProfile();
    try {
      const result=await callGemini('profile_summary',{answers:state.answers,risk:{score:risk.score,level:risk.level,reasons:risk.reasons,allocation:risk.allocation}});
      if(result.reply) $('aiProfileSummary').textContent=result.reply;
    } catch(e) { $('aiProfileSummary').textContent='Your profile was calculated locally. AI explanation is unavailable right now; the deterministic result above remains unchanged.'; }
  }
  function renderProfile() {
    const a=state.answers, p=state.profile;
    const rows=[['Age',a.age?`${a.age} years`:'Not provided'],['Monthly income',a.income!==null&&a.income!==undefined?formatINR(a.income):'Not provided'],['Monthly saving capacity',a.saving!==null&&a.saving!==undefined?formatINR(a.saving):'Not provided'],['Primary goal',a.goal||'Not provided'],['Time horizon',a.horizon||'Not provided'],['15% fall reaction',a.reaction||'Not provided']];
    $('profileResult').innerHTML=`
      <div class="flex items-center justify-between mb-4"><div><span class="text-xs uppercase tracking-wider text-emerald-700 font-bold">Your profile summary</span><h2 class="text-2xl font-extrabold mt-1">A starting point, not a label.</h2></div><span class="rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold px-3 py-1">${p.level}</span></div>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">${rows.map(([k,v])=>`<div class="rounded-xl bg-slate-50 p-3"><div class="text-[11px] text-slate-500">${k}</div><div class="text-sm font-semibold mt-1 break-words">${escapeHTML(String(v))}</div></div>`).join('')}</div>
      <div class="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 mb-4"><div class="text-xs font-bold text-emerald-800 uppercase tracking-wider">Deterministic risk result · score ${p.score}</div><div class="text-xl font-extrabold text-emerald-950 mt-1">${p.level}</div><ul class="list-disc pl-5 text-sm text-emerald-950/80 mt-2 space-y-1">${p.reasons.length?p.reasons.map(r=>`<li>${escapeHTML(r)}</li>`).join(''):'<li>Not enough answers to infer detailed reasons. Consider completing skipped fields.</li>'}</ul></div>
      <div class="text-sm font-semibold mb-1">Educational category framework</div><p class="text-sm text-slate-600 mb-3">${escapeHTML(p.allocation)}</p>
      <div class="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 mb-4">${escapeHTML(p.method)} Category ranges are illustrative only and not a recommendation or personal allocation.</div>
      <div class="text-sm font-semibold mb-2">Saarthi's explanation</div><p id="aiProfileSummary" class="text-sm text-slate-600 leading-relaxed">Preparing a plain-language explanation…</p>
      <div class="flex flex-wrap gap-2 mt-5"><button id="editProfile" class="border border-slate-200 rounded-xl px-4 py-2 text-sm font-semibold">Edit answers</button><button id="exportProfile" class="bg-navy text-white rounded-xl px-4 py-2 text-sm font-semibold">Export profile</button><button id="deleteProfile" class="border border-red-200 text-red-700 rounded-xl px-4 py-2 text-sm font-semibold">Delete profile</button></div>`;
    $('editProfile').addEventListener('click',()=>{state.step=0;$('profileResult').classList.add('hidden');$('chatScreen').classList.remove('hidden');$('chatMessages').innerHTML='';askQuestion();});
    $('exportProfile').addEventListener('click',exportProfile);
    $('deleteProfile').addEventListener('click',deleteProfile);
  }
  function escapeHTML(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function exportProfile() {
    const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),profile:state.profile},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='investment-saarthi-profile.json';a.click();URL.revokeObjectURL(url);
  }
  function deleteProfile() {
    state.answers={};state.profile=null;state.step=0;$('profileResult').classList.add('hidden');$('chatScreen').classList.add('hidden');$('consentScreen').classList.remove('hidden');$('consentCheck').checked=false;$('startProfile').disabled=true;$('chatMessages').innerHTML='';toast('Profile cleared from this browser session.');
  }
  function formatAnswerSections(raw) {
    const safe = escapeHTML(String(raw || '').replace(/\r/g, ''));
    const lines = safe.split('\n');
    const sections = [];
    let current = { title: 'Saarthi explains', lines: [] };
    const flush = () => {
      if (current.lines.length || current.title !== 'Saarthi explains') sections.push(current);
      current = { title: '', lines: [] };
    };
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) { current.lines.push(''); continue; }
      const heading = trimmed.match(/^#{1,3}\s+(.+?)\s*#*$/) ||
        trimmed.match(/^\*\*(.{2,90})\*\*:?$/) ||
        trimmed.match(/^\d+[.)]\s+\*\*(.{2,90})\*\*:?$/);
      if (heading) {
        flush();
        current = { title: heading[1].replace(/\*\*/g, ''), lines: [] };
        continue;
      }
      current.lines.push(trimmed);
    }
    flush();
    if (!sections.length) sections.push({title:'Saarthi explains',lines:[safe]});
    return sections.map(section => {
      const body = [];
      let list = [];
      const closeList = () => { if (list.length) { body.push(`<ul class="list-disc pl-5 space-y-1.5 my-2">${list.map(x=>`<li>${inlineFormat(x)}</li>`).join('')}</ul>`); list=[]; } };
      for (const line of section.lines) {
        if (!line) { closeList(); continue; }
        const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
        if (bullet) list.push(bullet[1]);
        else { closeList(); body.push(`<p class="my-2">${inlineFormat(line)}</p>`); }
      }
      closeList();
      return `<section class="rounded-xl border border-slate-200 bg-white p-4 mb-3">
        <h3 class="font-bold text-slate-900 mb-2">${inlineFormat(section.title || 'Key point')}</h3>
        <div class="text-sm text-slate-700 leading-7">${body.join('')}</div>
      </section>`;
    }).join('');
  }
  function inlineFormat(text) {
    return String(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="rounded bg-slate-100 px-1 py-0.5">$1</code>');
  }
  function renderLearnReply(data, fallback=false) {
    const refs = Array.isArray(data.sourceReferences) ? data.sourceReferences : [];
    const referenceHtml = refs.length ? refs.map(ref => `
      <a href="${escapeHTML(ref.url)}" target="_blank" rel="noopener noreferrer" class="block rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 hover:bg-emerald-50">
        <span class="block text-xs font-semibold text-emerald-900">${escapeHTML(ref.title)}</span>
        <span class="block text-[11px] text-slate-500 mt-1">Golden dataset mapping: ${escapeHTML(ref.benchmark || ref.id)} · Open official reference ↗</span>
      </a>`).join('') : `<div class="text-xs text-slate-600">General educational reference: <a class="text-emerald-700 underline" href="https://investor.sebi.gov.in/" target="_blank" rel="noopener noreferrer">SEBI Investor Education</a> · <a class="text-emerald-700 underline" href="https://www.amfiindia.com/investor" target="_blank" rel="noopener noreferrer">AMFI Investor Corner</a></div>`;
    const html=`<div class="space-y-1">${formatAnswerSections(data.reply||'I could not prepare an answer right now.')}</div>
      <div class="mt-4 pt-3 border-t border-slate-200 space-y-2">
        <span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-800 px-2 py-1 text-[11px] font-semibold"><i data-lucide="badge-check" class="w-3 h-3"></i> Learning references</span>
        ${referenceHtml}
        <div class="text-[11px] text-slate-500 leading-relaxed">Educational only — not investment, tax or legal advice. Check the latest official rules and scheme documents before acting.</div>
      </div>`;
    addMessage($('learnMessages'),html,'bot',true); if(window.lucide)lucide.createIcons();
  }
  async function askLearn(question) {
    if(!question.trim()) return;
    addMessage($('learnMessages'),question,'user');$('learnInput').value='';
    const pending=document.createElement('div');pending.id='learnPending';pending.className='text-xs text-slate-400';pending.textContent='Saarthi is thinking…';$('learnMessages').appendChild(pending);
    try { const data=await callGemini('education',{question}); pending.remove(); renderLearnReply(data); }
    catch(e) { pending.remove(); renderLearnReply({reply:'I can’t reach the AI service at the moment. Please try again shortly. I will not guess where a source-backed answer is required.',sourceCitation:'No source retrieved — please retry.'}); }
  }

  // SIP future value: monthly contributions at month end, monthly compounding.
  function sipFutureValue(monthly, annualPct, years) {
    const n=years*12, r=annualPct/100/12;
    return r===0?monthly*n:monthly*((Math.pow(1+r,n)-1)/r);
  }
  function calculateSIP() {
    const monthly=Number($('sipAmount').value), years=Number($('years').value), annual=Number($('returnProfile').value);
    const invested=monthly*years*12, future=sipFutureValue(monthly,annual,years), gains=future-invested;
    $('sipAmountLabel').textContent=formatINR(monthly);$('yearsLabel').textContent=`${years} ${years===1?'year':'years'}`;
    $('investedValue').textContent=compactINR(invested);$('futureValue').textContent=compactINR(future);
    const target=Number($('goalTarget').value);
    if(target>0){$('goalShortfall').classList.remove('hidden');$('goalShortfall').textContent=future>=target?`Illustrative estimate is ${formatINR(future-target)} above your target of ${formatINR(target)}.`:`Illustrative shortfall: approximately ${formatINR(target-future)} against your target of ${formatINR(target)}. Educational levers include reviewing the target, time horizon or contribution — without assuming higher returns.`;}
    else $('goalShortfall').classList.add('hidden');
    const ctx=$('sipChart').getContext('2d');
    if(state.chart)state.chart.destroy();
    state.chart=new Chart(ctx,{type:'bar',data:{labels:['Total invested','Estimated growth','Estimated value'],datasets:[{data:[invested,gains,future],backgroundColor:['#0F172A','#10B981','#A7F3D0'],borderRadius:10,maxBarThickness:70}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>formatINR(c.raw)}}},scales:{y:{beginAtZero:true,ticks:{callback:v=>compactINR(v)},grid:{color:'#eef2f7'}},x:{grid:{display:false}}}}});
    return {monthlySIP:monthly,years,annualReturnAssumption:annual,totalInvested:Math.round(invested),estimatedValue:Math.round(future),estimatedGrowth:Math.round(gains),goalName:$('goalName').value||null,targetAmount:target||null};
  }

  $('consentCheck').addEventListener('change',e=>$('startProfile').disabled=!e.target.checked);
  $('startProfile').addEventListener('click',()=>{if(!$('consentCheck').checked)return;$('consentScreen').classList.add('hidden');$('chatScreen').classList.remove('hidden');askQuestion();});
  $('profileForm').addEventListener('submit',e=>{e.preventDefault();submitAnswer($('profileInput').value);});
  $('skipQuestion').addEventListener('click',skipQuestion);
  $('learnForm').addEventListener('submit',e=>{e.preventDefault();askLearn($('learnInput').value);});
  document.querySelectorAll('.prompt-chip').forEach(b=>b.addEventListener('click',()=>askLearn(b.textContent)));
  ['sipAmount','years','returnProfile','goalTarget'].forEach(id=>$(id).addEventListener('input',calculateSIP));
  $('analyzePlan').addEventListener('click',async()=>{
    const plan=calculateSIP(), card=$('analysisCard');card.classList.remove('hidden');card.innerHTML='<div class="text-sm text-slate-500">Saarthi is analysing your assumptions…</div>';
    try {const data=await callGemini('scenario_analysis',{plan});card.innerHTML=`<div class="font-bold mb-2">Saarthi's coaching notes</div><div class="text-sm text-slate-600 leading-relaxed whitespace-pre-line">${escapeHTML(data.reply||'No analysis available.')}</div><div class="text-[11px] text-slate-400 mt-3">Educational scenario analysis only. The return assumption is hypothetical, not a forecast.</div>`;}
    catch(e){card.textContent='AI analysis is temporarily unavailable. Your deterministic SIP calculation remains available above.';}
  });
  document.querySelectorAll('.tab-btn').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('tab-active'));
    b.classList.add('tab-active');document.querySelectorAll('.tab-panel').forEach(p=>p.classList.add('hidden'));
    $(`panel-${b.dataset.tab}`).classList.remove('hidden');
  }));
  const inspector= $('inspector'), backdrop=$('inspectorBackdrop');
  function openInspector(){inspector.classList.remove('translate-x-full');backdrop.classList.remove('hidden');}
  function closeInspector(){inspector.classList.add('translate-x-full');backdrop.classList.add('hidden');}
  $('inspectorToggle').addEventListener('click',openInspector);$('closeInspector').addEventListener('click',closeInspector);backdrop.addEventListener('click',closeInspector);
  calculateSIP(); if(window.lucide)lucide.createIcons();
})();
