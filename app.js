
const STORAGE_KEY="niti-calendar-tracker-v2";
let template=null,state=null,activeView="dashboard";
let calendarCursor=new Date();
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

function isoLocal(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function pdate(s){return new Date(`${s}T12:00:00`)}
function fmt(s){return pdate(s).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"})}
function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]))}
function uid(){return crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random())}
function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
function task(id){return state.tasks.find(t=>t.id===id)}
function incomplete(){return state.tasks.filter(t=>t.status!=="done")}
function completed(){return state.tasks.filter(t=>t.status==="done")}
function minDone(t){return t.estimatedMinutes*(Number(t.progress||0)/100)}
function overall(){const all=state.tasks.reduce((a,t)=>a+t.estimatedMinutes,0);return all?Math.round(state.tasks.reduce((a,t)=>a+minDone(t),0)/all*100):0}
function daysLeft(){return Math.max(0,Math.ceil((pdate(state.meta.targetDate)-pdate(isoLocal()))/86400000))}
function nextTask(){const today=isoLocal();return incomplete().slice().sort((a,b)=>a.date.localeCompare(b.date)||(b.priority||0)-(a.priority||0)).find(t=>t.date<=today)||incomplete().slice().sort((a,b)=>a.date.localeCompare(b.date)||(b.priority||0)-(a.priority||0))[0]||null}
function divProgress(id){const ts=state.tasks.filter(t=>t.division===id),total=ts.reduce((a,t)=>a+t.estimatedMinutes,0);return total?Math.round(ts.reduce((a,t)=>a+minDone(t),0)/total*100):0}
function remainingWork(){return incomplete().reduce((a,t)=>a+t.estimatedMinutes*(1-(t.progress||0)/100),0)}
function remainingCapacity(){
  let d=pdate(isoLocal()),end=pdate(state.meta.targetDate),m=0;
  while(d<=end){m+=Number(state.settings.dayCapacityMinutes[d.getDay()]||0);d.setDate(d.getDate()+1)}
  return m
}
function health(){const cap=remainingCapacity(),work=remainingWork(),r=cap?work/cap:999;return r<=.72?["Healthy","good"]:r<=.95?["Tight","warn"]:["At risk","danger"]}

async function init(){
  template=await fetch("data/roadmap.json").then(r=>r.json());
  const saved=localStorage.getItem(STORAGE_KEY);state=saved?JSON.parse(saved):structuredClone(template);
  state.history||=[];state.interviews||=[];state.lastActivity||=null;
  mergeNewTasks();
  const now=new Date();calendarCursor=new Date(now.getFullYear(),now.getMonth(),1);
  bind();render()
}
function mergeNewTasks(){const have=new Set(state.tasks.map(t=>t.id));template.tasks.forEach(t=>{if(!have.has(t.id))state.tasks.push(structuredClone(t))})}
function save(msg){state.updatedAt=new Date().toISOString();localStorage.setItem(STORAGE_KEY,JSON.stringify(state));if(msg){state.history.unshift({at:new Date().toISOString(),message:msg});toast(msg)}}
function bind(){
  $$(".nav").forEach(b=>b.onclick=()=>{activeView=b.dataset.view;$$(".nav").forEach(x=>x.classList.toggle("active",x===b));render()});
  $("#rebalanceBtn").onclick=()=>smartRebalance(true);
  $("#addTaskBtn").onclick=()=>openTaskEditor();
  $("#closeModal").onclick=closeModal;
  $("#modal").onclick=e=>{if(e.target.id==="modal")closeModal()}
}
function setHead(t,s){$("#pageTitle").textContent=t;$("#pageSubtitle").textContent=s}
function render(){({dashboard:renderDashboard,roadmap:renderRoadmap,divisions:renderDivisions,interviews:renderInterviews,prompts:renderPrompts,history:renderHistory,settings:renderSettings}[activeView]||renderDashboard)()}
function bar(p){return `<div class="progress"><span style="width:${clamp(p,0,100)}%"></span></div>`}

function renderDashboard(){
  setHead("Dashboard","Large monthly calendar first — dates, tasks, progress and the next action in one place.");
  const n=nextTask(),h=health();
  $("#view").innerHTML=`
    <div class="grid stats">
      <div class="card"><div class="stat-label">Overall progress</div><div class="stat-value">${overall()}%</div>${bar(overall())}<div class="stat-foot">${completed().length}/${state.tasks.length} tasks completed</div></div>
      <div class="card"><div class="stat-label">Days to target</div><div class="stat-value">${daysLeft()}</div><div class="stat-foot">Deadline remains ${fmt(state.meta.targetDate)}</div></div>
      <div class="card"><div class="stat-label">Remaining work</div><div class="stat-value">${Math.round(remainingWork()/60)}h</div><div class="stat-foot">Remaining capacity ${Math.round(remainingCapacity()/60)}h</div></div>
      <div class="card"><div class="stat-label">Deadline health</div><div class="stat-value">${h[0]}</div><div class="stat-foot">Based on actual remaining capacity</div></div>
    </div>
    ${n?`<div class="card next-action" style="margin-top:14px"><div><span class="badge today">NEXT ACTION</span><h2>${esc(n.title)}</h2><p>${esc(n.description||"")}</p><div class="next-meta"><span class="badge">${fmt(n.date)}</span><span class="badge">${n.estimatedMinutes} min</span><span class="badge">${esc(n.phase)}</span></div></div><div class="task-actions"><button class="btn primary" onclick="openProgress('${n.id}')">Update</button><button class="btn" onclick="copyCoach('${n.id}')">ChatGPT prompt</button></div></div>`:""}
    <div class="card calendar-card" style="margin-top:14px">
      <div class="calendar-toolbar">
        <div class="calendar-nav"><button class="btn small" onclick="changeMonth(-1)">←</button><button class="btn small" onclick="goCurrentMonth()">Today</button><button class="btn small" onclick="changeMonth(1)">→</button></div>
        <h2 id="monthTitle"></h2>
        <div><button class="btn small" onclick="smartRebalance(true)">Smart rebalance</button></div>
      </div>
      <div id="calendar"></div>
      <div class="legend">
        <span><i class="dot" style="background:#1f4e79"></i>NITI</span>
        <span><i class="dot" style="background:#6b5bd2"></i>Governance</span>
        <span><i class="dot" style="background:#087f8c"></i>Digital</span>
        <span><i class="dot" style="background:#b45309"></i>M&E/Data</span>
        <span><i class="dot" style="background:#2f855a"></i>Skills</span>
        <span><i class="dot" style="background:#be185d"></i>Interview</span>
      </div>
    </div>
    <div class="grid two" style="margin-top:14px">
      <div class="card"><div class="section-head"><h2>Division progress</h2><button class="btn small" onclick="goView('divisions')">Open</button></div>${state.divisions.map(d=>`<div class="div-row"><div><strong>${esc(d.name)}</strong></div><div>${bar(divProgress(d.id))}</div><strong>${divProgress(d.id)}%</strong></div>`).join("")}</div>
      <div class="card"><h2>How to use the calendar</h2><p class="muted">Drag a task from one date to another. Click a task to update it. Click any date cell to add a task there. If you miss several days, do not manually stack everything onto the next day — use Smart rebalance.</p><div class="alert">Smart rebalance keeps 31 Dec fixed and spreads unfinished work over the remaining capacity. If the load becomes mathematically impossible, the dashboard shows “At risk” instead of hiding it.</div></div>
    </div>`;
  renderCalendar()
}
function renderCalendar(){
  const y=calendarCursor.getFullYear(),m=calendarCursor.getMonth();
  $("#monthTitle").textContent=calendarCursor.toLocaleDateString(undefined,{month:"long",year:"numeric"});
  const first=new Date(y,m,1), start=new Date(y,m,1-first.getDay());
  let html=`<div class="calendar-grid">${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>`<div class="weekday">${d}</div>`).join("")}`;
  for(let i=0;i<42;i++){
    const d=new Date(start);d.setDate(start.getDate()+i);const iso=isoLocal(d),same=d.getMonth()===m,today=iso===isoLocal();
    const ts=state.tasks.filter(t=>t.date===iso).sort((a,b)=>(b.priority||0)-(a.priority||0));
    const shown=ts.slice(0,4);
    const used=ts.filter(t=>t.status!=="done").reduce((a,t)=>a+t.estimatedMinutes*(1-(t.progress||0)/100),0);
    html+=`<div class="day-cell ${same?"":"other-month"} ${today?"today":""}" data-date="${iso}" onclick="cellClick(event,'${iso}')" ondragover="dragOver(event)" ondragleave="dragLeave(event)" ondrop="dropTask(event,'${iso}')">
      <div class="day-head"><span class="date-num">${d.getDate()}</span><span class="day-load">${used?Math.round(used)+"m":""}</span></div>
      <div class="day-tasks">${shown.map(t=>`<div class="cal-task ${t.status==="done"?"done":""}" data-division="${t.division}" draggable="true" ondragstart="dragStart(event,'${t.id}')" onclick="event.stopPropagation();openProgress('${t.id}')">${esc(t.title)}</div>`).join("")}</div>
      ${ts.length>4?`<div class="more" onclick="event.stopPropagation();showDay('${iso}')">+${ts.length-4} more</div>`:""}
    </div>`
  }
  html+=`</div>`;$("#calendar").innerHTML=html
}
window.changeMonth=n=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+n,1);renderCalendar()}
window.goCurrentMonth=()=>{const d=new Date();calendarCursor=new Date(d.getFullYear(),d.getMonth(),1);renderCalendar()}
window.cellClick=(e,date)=>{if(e.target.closest(".cal-task")||e.target.closest(".more"))return;openTaskEditor(null,date)}
window.dragStart=(e,id)=>{e.dataTransfer.setData("text/plain",id);e.dataTransfer.effectAllowed="move"}
window.dragOver=e=>{e.preventDefault();e.currentTarget.classList.add("drop-target")}
window.dragLeave=e=>e.currentTarget.classList.remove("drop-target")
window.dropTask=(e,date)=>{e.preventDefault();e.currentTarget.classList.remove("drop-target");const id=e.dataTransfer.getData("text/plain"),t=task(id);if(!t)return;const old=t.date;t.date=date;state.lastActivity=isoLocal();save(`Moved "${t.title}" from ${old} to ${date}`);renderCalendar();renderStatsIfNeeded()}
function renderStatsIfNeeded(){}

function taskCard(t){return `<div class="task"><div class="task-title">${esc(t.title)}</div><div class="task-meta"><span class="badge">${fmt(t.date)}</span><span>${t.estimatedMinutes} min</span><span>${t.progress}%</span><span>${esc(t.phase)}</span></div>${bar(t.progress)}<div class="task-actions"><button class="btn small primary" onclick="openProgress('${t.id}')">Update</button><button class="btn small" onclick="copyCoach('${t.id}')">ChatGPT prompt</button><button class="btn small" onclick="moveTask('${t.id}')">Move</button></div></div>`}
function renderRoadmap(){
  setHead("Roadmap","Filter the full learning journey by division, phase and status.");
  const phases=[...new Set(state.tasks.map(t=>t.phase))];
  $("#view").innerHTML=`<div class="filters"><select id="fDiv" class="input" style="max-width:250px"><option value="">All divisions</option>${state.divisions.map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join("")}</select><select id="fStatus" class="input" style="max-width:180px"><option value="">All status</option><option value="todo">To do</option><option value="done">Done</option></select></div><div id="road" class="timeline"></div>`;
  $("#fDiv").onchange=roadBody;$("#fStatus").onchange=roadBody;roadBody()
}
function roadBody(){
  const d=$("#fDiv").value,s=$("#fStatus").value,ph=[...new Set(state.tasks.map(t=>t.phase))];
  $("#road").innerHTML=ph.map(p=>{const ts=state.tasks.filter(t=>t.phase===p&&(!d||t.division===d)&&(!s||t.status===s)).sort((a,b)=>a.date.localeCompare(b.date));return ts.length?`<div class="phase"><h3>${esc(p)}</h3><div class="task-list">${ts.map(taskCard).join("")}</div></div>`:""}).join("")
}
function renderDivisions(){
  setHead("Division Progress","See exactly where you are strong, weak and incomplete.");
  $("#view").innerHTML=`<div class="card">${state.divisions.map(d=>`<div class="div-row"><div><strong>${esc(d.name)}</strong><div class="muted">${state.tasks.filter(t=>t.division===d.id&&t.status==="done").length}/${state.tasks.filter(t=>t.division===d.id).length} tasks</div></div><div>${bar(divProgress(d.id))}</div><strong>${divProgress(d.id)}%</strong></div>`).join("")}</div>`
}
function renderInterviews(){
  setHead("Interview Practice","Schedule mock panels and generate an exact ChatGPT interview prompt.");
  const items=state.tasks.filter(t=>t.type==="interview"&&t.status!=="done").sort((a,b)=>a.date.localeCompare(b.date));
  $("#view").innerHTML=`<div class="section-head"><div></div><button class="btn primary" onclick="scheduleInterview()">Schedule custom interview</button></div><div class="grid two"><div class="card"><h2>Roadmap interviews</h2><div class="task-list">${items.map(taskCard).join("")||"<p class='muted'>None pending.</p>"}</div></div><div class="card"><h2>Custom interviews</h2><div class="task-list">${(state.interviews||[]).map(i=>`<div class="task"><div class="task-title">${esc(i.topic)}</div><div class="task-meta"><span class="badge">${fmt(i.date)}</span><span>${i.minutes} min</span></div><div class="task-actions"><button class="btn small primary" onclick="copyInterview('${i.id}')">Copy prompt</button><button class="btn small" onclick="deleteInterview('${i.id}')">Delete</button></div></div>`).join("")||"<p class='muted'>None scheduled.</p>"}</div></div></div>`
}
function renderPrompts(){
  setHead("ChatGPT / NotebookLM","Copy the prompt you need instead of remembering what to ask.");
  const n=nextTask(), coach=coachPrompt(n), source=`I am preparing for a potential Consultant/Young Professional role at NITI Aayog. My background is digital transformation, software implementation, workflow/process design and stakeholder management, not academic economics.

Analyse ONLY the uploaded source.
Give me:
1. The problem this document is trying to solve.
2. A 10-point executive summary in very simple language.
3. The 5 most important facts/statistics worth remembering.
4. The major stakeholders.
5. Major policy interventions/recommendations.
6. Implementation challenges.
7. How success should be measured.
8. Important terminology.
9. Connections with digital transformation, governance, data, programme implementation or M&E.
10. Five difficult interview questions.
11. Five recommendation questions.
12. A 15-minute revision sheet.
Clearly separate what the source says from interpretation.`;
  const challenge=`Using only the uploaded sources, challenge the recommendations. For each major recommendation identify expected benefit, implementation dependency, institution responsible, likely barrier, required data, possible unintended consequence, suitable KPI and failure conditions. Do not automatically agree with the report.`;
  const interview=`Interview me as if you are a NITI Aayog panel member. Ask one question at a time. Start with comprehension, then analysis, implementation, stakeholder conflict, data and recommendations. Do not give me the answer before I answer. Score each response /10 for structure, policy understanding, evidence, practicality and clarity.`;
  const arr=[["Next action — ChatGPT coach",coach],["NotebookLM — source compressor",source],["NotebookLM — challenge the report",challenge],["NotebookLM — interview mode",interview]];
  $("#view").innerHTML=arr.map((x,i)=>`<div class="card" style="margin-bottom:14px"><div class="section-head"><h2>${x[0]}</h2><button class="btn small" onclick="copyText(promptCache[${i}])">Copy</button></div><div class="prompt">${esc(x[1])}</div></div>`).join("");window.promptCache=arr.map(x=>x[1])
}
function renderHistory(){
  setHead("Progress Log","Every task completion, move and rebalance is recorded.");
  $("#view").innerHTML=`<div class="card"><div class="section-head"><h2>Activity</h2><button class="btn small" onclick="exportData()">Export JSON</button></div>${(state.history||[]).map(h=>`<div class="history-row"><strong>${new Date(h.at).toLocaleString()}</strong><div class="muted">${esc(h.message)}</div></div>`).join("")||"<p class='muted'>No updates yet.</p>"}</div>`
}
function renderSettings(){
  setHead("Settings","Set honest daily capacity. Smart rebalance uses these numbers.");
  $("#view").innerHTML=`<div class="grid two"><div class="card"><h2>Daily capacity</h2>${["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((n,i)=>`<label>${n}<input class="input cap" data-day="${i}" type="number" min="0" step="5" value="${state.settings.dayCapacityMinutes[i]||0}"></label>`).join("")}<button class="btn primary" style="margin-top:12px" onclick="saveCapacity()">Save & rebalance</button></div><div class="card"><h2>Backup</h2><p class="muted">Current version stores progress in this browser. Export a JSON backup before changing browser/device.</p><div class="task-actions"><button class="btn" onclick="exportData()">Export JSON</button><button class="btn" onclick="document.getElementById('imp').click()">Import JSON</button><input id="imp" type="file" accept=".json" hidden onchange="importData(event)"><button class="btn" onclick="resetAll()">Reset</button></div></div></div>`
}
function openModal(title,body){$("#modalTitle").textContent=title;$("#modalBody").innerHTML=body;$("#modal").classList.remove("hidden")}
function closeModal(){$("#modal").classList.add("hidden")}
function toast(m){$("#toast").textContent=m;$("#toast").classList.remove("hidden");setTimeout(()=>$("#toast").classList.add("hidden"),2200)}

window.openProgress=id=>{
  const t=task(id);openModal("Update task",`<div class="task-title">${esc(t.title)}</div><label>Progress %<input id="prog" class="input" type="number" min="0" max="100" value="${t.progress}"></label><label>Notes<textarea id="notes">${esc(t.notes||"")}</textarea></label><div class="task-actions"><button class="btn primary" onclick="saveProgress('${id}')">Save</button><button class="btn" onclick="finish('${id}')">Mark complete</button></div>`)
}
window.saveProgress=id=>{const t=task(id),old=t.progress;t.progress=clamp(Number($("#prog").value||0),0,100);t.notes=$("#notes").value.trim();t.status=t.progress>=100?"done":"todo";state.lastActivity=isoLocal();closeModal();save(`${t.title}: ${old}% → ${t.progress}%`);render()}
window.finish=id=>{const t=task(id);t.progress=100;t.status="done";state.lastActivity=isoLocal();closeModal();save(`Completed: ${t.title}`);smartRebalance(false);render()}
window.moveTask=id=>{const t=task(id);openModal("Move task",`<div class="task-title">${esc(t.title)}</div><label>New date<input id="mdate" class="input" type="date" min="${isoLocal()}" max="${state.meta.targetDate}" value="${t.date}"></label><button class="btn primary" onclick="saveMove('${id}')">Move</button>`)}
window.saveMove=id=>{const t=task(id),old=t.date;t.date=$("#mdate").value;state.lastActivity=isoLocal();closeModal();save(`Moved "${t.title}" from ${old} to ${t.date}`);render()}
window.showDay=date=>{const ts=state.tasks.filter(t=>t.date===date);openModal(fmt(date),`<div class="task-list">${ts.map(taskCard).join("")}</div>`)}

window.openTaskEditor=(id=null,date=null)=>{
  const t=id?task(id):{title:"",date:date||isoLocal(),estimatedMinutes:30,division:"niti",phase:"Custom",type:"custom",priority:3,description:"",deliverable:""};
  openModal(id?"Edit task":"Add task",`<label>Title<input id="etitle" class="input" value="${esc(t.title)}"></label><div class="form-grid"><div><label>Date<input id="edate" class="input" type="date" value="${t.date}" max="${state.meta.targetDate}"></label></div><div><label>Minutes<input id="emins" class="input" type="number" min="5" step="5" value="${t.estimatedMinutes}"></label></div></div><label>Division<select id="ediv" class="input">${state.divisions.map(d=>`<option value="${d.id}" ${d.id===t.division?"selected":""}>${esc(d.name)}</option>`).join("")}</select></label><label>Description<textarea id="edesc">${esc(t.description||"")}</textarea></label><button class="btn primary" onclick="saveTaskEditor('${id||""}')">Save task</button>`)
}
window.saveTaskEditor=id=>{if(id){const t=task(id);t.title=$("#etitle").value.trim();t.date=$("#edate").value;t.estimatedMinutes=Number($("#emins").value||30);t.division=$("#ediv").value;t.description=$("#edesc").value.trim();save(`Updated task: ${t.title}`)}else{const nt={id:"custom-"+uid(),title:$("#etitle").value.trim(),date:$("#edate").value,estimatedMinutes:Number($("#emins").value||30),division:$("#ediv").value,phase:"Custom",type:"custom",priority:3,description:$("#edesc").value.trim(),deliverable:"",status:"todo",progress:0,notes:""};state.tasks.push(nt);save(`Added task: ${nt.title}`)}closeModal();render()}

window.scheduleInterview=()=>openModal("Schedule interview",`<label>Topic<input id="itopic" class="input" value="NITI mock interview"></label><div class="form-grid"><div><label>Date<input id="idate" class="input" type="date" min="${isoLocal()}" max="${state.meta.targetDate}" value="${isoLocal()}"></label></div><div><label>Minutes<input id="imins" class="input" type="number" min="15" step="15" value="45"></label></div></div><button class="btn primary" onclick="saveInterview()">Schedule</button>`)
window.saveInterview=()=>{state.interviews.push({id:uid(),topic:$("#itopic").value.trim(),date:$("#idate").value,minutes:Number($("#imins").value||45)});closeModal();save("Scheduled custom interview");render()}
window.copyInterview=id=>{const i=state.interviews.find(x=>x.id===id);copyText(interviewPrompt(i.topic,i.minutes))}
window.deleteInterview=id=>{state.interviews=state.interviews.filter(x=>x.id!==id);save("Deleted custom interview");render()}

function coachPrompt(t){if(!t)return "My roadmap is complete. Review my NITI readiness and help me decide the next application step.";return `Act as my NITI Aayog readiness coach.

Current next task: ${t.title}
Date: ${t.date}
Phase: ${t.phase}
Estimated time: ${t.estimatedMinutes} minutes
Purpose: ${t.description||"Complete this roadmap task."}
Deliverable: ${t.deliverable||"A clear learning or practice outcome."}

My constraints:
- Low energy Monday-Friday.
- Serious learning mainly Saturday/Sunday.
- Do not give a traditional long lecture.
- Teach the minimum needed, then make me apply it.
- Prefer NotebookLM for long PDFs.
- Use retrieval practice, cases and interview-style questions.
- Distinguish source facts from interpretation.

Start by telling me the fastest effective way to complete THIS task today, then guide me one step at a time.`}
function interviewPrompt(topic,mins=45){return `Act as a NITI Aayog interview panel for a ${mins}-minute practice session.

Focus: ${topic}

Candidate background: technology implementation, software delivery, process design, stakeholder management and digital transformation. The candidate is building policy capability in governance reform, digital governance/DPI, M&E/data and skilling/employment.

Rules:
- Ask ONE question at a time.
- Increase difficulty gradually.
- Include implementation, evidence/data, stakeholder conflict and recommendation questions.
- Do not reveal the model answer before I answer.
- Challenge vague corporate-only answers.
- Score each answer /10 for structure, policy understanding, evidence, practicality and clarity.
- Finish with the 3 highest-priority improvements.

Start now.`}
window.copyCoach=id=>copyText(coachPrompt(task(id)))
window.copyText=async text=>{await navigator.clipboard.writeText(text);toast("Copied")}
window.goView=v=>{activeView=v;$$(".nav").forEach(b=>b.classList.toggle("active",b.dataset.view===v));render()}

function smartRebalance(show=true){
  const start=pdate(isoLocal()),end=pdate(state.meta.targetDate),slots=[];
  let d=new Date(start);
  while(d<=end){const cap=Number(state.settings.dayCapacityMinutes[d.getDay()]||0);if(cap>0)slots.push({date:isoLocal(d),cap,used:0});d.setDate(d.getDate()+1)}
  const tasks=incomplete().slice().sort((a,b)=>a.date.localeCompare(b.date)||(b.priority||0)-(a.priority||0));
  let idx=0;
  for(const t of tasks){
    let left=Math.ceil(t.estimatedMinutes*(1-(t.progress||0)/100)),first=null;
    while(left>0&&idx<slots.length){
      const s=slots[idx],free=s.cap-s.used;if(free<=0){idx++;continue}
      const take=Math.min(left,free,state.settings.maxSessionMinutes||90);
      if(!first)first=s.date;s.used+=take;left-=take;if(s.used>=s.cap)idx++
    }
    if(first)t.date=first
  }
  save("Smart rebalance completed");
  if(show)toast("Plan redistributed to remaining capacity");
  render()
}
window.smartRebalance=smartRebalance
window.saveCapacity=()=>{$$(".cap").forEach(x=>state.settings.dayCapacityMinutes[x.dataset.day]=Number(x.value||0));save("Daily capacity updated");smartRebalance(false);render()}
window.exportData=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`niti-tracker-${isoLocal()}.json`;a.click();URL.revokeObjectURL(a.href)}
window.importData=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{state=JSON.parse(r.result);save("Backup imported");render()}catch{toast("Invalid JSON")}};r.readAsText(f)}
window.resetAll=()=>{if(!confirm("Reset all progress?"))return;state=structuredClone(template);state.history=[];state.interviews=[];save("Tracker reset");render()}

init().catch(err=>{document.body.innerHTML=`<div style="padding:30px;font-family:sans-serif"><h1>Tracker could not start</h1><p>${esc(err.message)}</p><p>Deploy the folder to Netlify or serve it with a local web server.</p></div>`})
