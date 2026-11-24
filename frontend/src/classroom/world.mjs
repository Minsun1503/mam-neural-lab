import {INPUTS, random} from './brain.mjs';
export const ACTIONS = ['open_browser','open_notes','navigate_claude','open_latest','search','research','finish',
  'focus_notes','focus_browser','focus_editor','select_all','type_text','copy','paste','save_file','open_file','close_notes','minimize_notes','restore_notes','dismiss_dialog'];
export const LABELS = ['Mở trình duyệt','Mở ghi chú','Vào Claude','Mở chat gần nhất','Tìm nội dung','Hỏi thầy / research','Hoàn tất',
  'Chuyển sang ghi chú','Chuyển sang trình duyệt','Đặt con trỏ vào ô nhập','Chọn tất cả','Gõ nội dung','Sao chép','Dán','Lưu tệp','Mở tệp','Đóng ghi chú','Thu nhỏ','Khôi phục cửa sổ','Đóng hộp thoại'];
export const GOALS = ['Mở trình duyệt','Mở ứng dụng ghi chú','Vào Claude','Đọc cuộc trò chuyện gần nhất','Tìm một nội dung','Việc chưa được học',
  'Chuyển sang ghi chú','Chuyển sang trình duyệt','Nhập văn bản','Thay toàn bộ văn bản','Sao chép văn bản','Dán từ clipboard','Lưu văn bản thành tệp','Mở tệp đã lưu',
  'Đóng ứng dụng','Thu nhỏ cửa sổ','Khôi phục cửa sổ','Đóng hộp thoại chắn đường','Viết → lưu → đóng → mở lại','Sao chép → dán → lưu'];
export const MAX_STEPS = 24;
export const EXAM_COUNT = 400;
export const CURRICULUM_VERSION = 4;
export const TEXTS = ['Mỗi ngày học một điều mới.','Ghi chú: buổi sáng 08:30','Xin chào, thế giới!','Bản nháp số 42 — đã sửa.','hello / world / 2026','Dòng một\nDòng hai'];
export function createWorld(seed, goal = seed % GOALS.length, options = {}) {
  const rng = random(seed), browser = rng() > .5, notes = rng() > .45;
  const expected = options.text ?? `${TEXTS[Math.floor(rng() * TEXTS.length)]} #${Math.floor(rng() * 9000)}`;
  const w = {seed,goal,browser,notes,site: browser && rng() > .5 ? 'claude' : 'home',chat:false,searched:false,researched:false,
    done:false,finished:false,steps:0,errors:0,active: notes && rng() > .5 ? 'notes' : browser ? 'browser' : 'desktop',
    expected,text: rng() > .7 ? expected : rng() > .5 ? 'Bản nháp cũ' : '',clipboard:'',savedText:null,
    filename:`bai-hoc-${seed}.txt`,focus:'none',selected:false,minimized:false,modal:rng() > .85,
    copied:false,pasted:false,closed:false,minimizedOnce:false,restored:false,dismissed:false,reopened:false,closedAfterSave:false,
    interruption: rng() > .65,interrupted:false,
    query: options.query ?? `chủ đề ${Math.floor(rng() * 10000)}`,
    chats:[0,1,2].map(i => ({title:`Cuộc trò chuyện ${Math.floor(rng() * 9999)}`,age:2 + i * 12})),
    layout:{left:15+Math.floor(rng()*60),top:18+Math.floor(rng()*40),reverse:rng()>.5},trace:[]};
  if (goal === 11) { w.clipboard = expected; w.text = 'Nội dung cần thay'; }
  if (goal === 13) { w.savedText = expected; w.text = ''; }
  if ([14,15,16].includes(goal)) { w.notes = true; w.active = 'notes'; }
  if (goal === 16) { w.minimized = true; w.active = w.browser ? 'browser' : 'desktop'; }
  if (goal === 17) w.modal = true;
  if ([8,9,10,12,18,19].includes(goal)) w.text = goal === 8 ? '' : 'Bản cũ cần sửa';
  if (!w.notes) w.text='';
  if(rng()<.2)w.active='desktop';
  return w;
}
export function observe(w) {
  const x = new Float32Array(INPUTS);
  const text=w.notes?w.text:'';
  if (w.goal < 6) x[w.goal] = 1; else x[20 + w.goal - 6] = 1;
  // Keep milestone-one inputs in place so its learned subnetwork can be embedded.
  x[6]=+w.browser; x[7]=+w.notes; x[8]=+(w.browser&&w.site==='claude'); x[9]=+w.chat; x[10]=+w.searched; x[11]=+w.researched;
  x[12]=+(w.active==='browser'); x[13]=+(w.active==='notes'); x[14]=+(w.browser&&w.site==='home'); x[15]=+(w.browser&&w.site==='claude'&&!w.chat);
  x[16]=+!w.browser; x[17]=+!w.notes; x[18]=Math.min(w.steps/MAX_STEPS,1); x[19]=1;
  const sensors = [w.active==='notes'&&w.focus==='editor',w.selected,text===w.expected,text.length===0,w.clipboard===w.expected,
    w.savedText===w.expected,w.minimized,w.modal,w.copied,w.pasted,w.closed,w.minimizedOnce,w.restored,w.dismissed,
    w.reopened,w.closedAfterSave,w.savedText!==null,w.notes&&!w.minimized,w.focus==='none',w.active==='desktop',
    text.length>0,w.clipboard.length>0,w.interrupted];
  sensors.forEach((value,i)=>{x[34+i]=+value;});
  return x;
}
export function achieved(w) {
  return Boolean([w.browser,w.notes,w.browser&&w.site==='claude',w.chat,w.searched,w.researched,
    w.notes&&!w.minimized&&w.active==='notes',w.browser&&w.active==='browser',w.text===w.expected,w.text===w.expected,
    w.copied&&w.clipboard===w.expected,w.pasted&&w.text===w.expected,w.savedText===w.expected,
    w.reopened&&w.text===w.expected,w.closed&&!w.notes,w.minimizedOnce&&w.minimized,w.restored&&!w.minimized,
    w.dismissed&&!w.modal,w.reopened&&w.closedAfterSave&&w.text===w.expected&&w.savedText===w.expected,
    w.copied&&w.pasted&&w.savedText===w.expected][w.goal]);
}
function notesReady(w) {
  if (!w.notes) return 1;
  if (w.minimized) return 18;
  if (w.active!=='notes') return 7;
  return null;
}
function editReady(w) { return notesReady(w) ?? (w.focus!=='editor' ? 9 : null); }
function writeTarget(w) { return editReady(w) ?? (w.text!==w.expected ? (w.text.length&&!w.selected ? 10 : 11) : null); }
export function teacher(w) {
  if (w.modal) return 19;
  if (achieved(w)) return 6;
  if (w.goal===5) return 5;
  if (w.goal===0) return 0;
  if (w.goal===1) return 1;
  if ([2,3,4,7].includes(w.goal)) {
    if (!w.browser) return 0;
    if (w.active!=='browser') return 8;
    if (w.goal===7) return 6;
    if (w.goal===4) return 4;
    if (w.site!=='claude') return 2;
    return 3;
  }
  if (w.goal===6) return notesReady(w) ?? 6;
  if ([8,9].includes(w.goal)) return writeTarget(w) ?? 6;
  if (w.goal===10) return writeTarget(w) ?? (!w.selected ? 10 : 12);
  if (w.goal===11) return editReady(w) ?? (w.text.length&&!w.selected ? 10 : 13);
  if (w.goal===12) return writeTarget(w) ?? 14;
  if (w.goal===13) return 15;
  if (w.goal===14) return notesReady(w) ?? 16;
  if (w.goal===15) return notesReady(w) ?? 17;
  if (w.goal===16) return 18;
  if (w.goal===17) return 6;
  if (w.goal===18) {
    if (w.savedText!==w.expected) return writeTarget(w) ?? 14;
    if (!w.closedAfterSave) return notesReady(w) ?? 16;
    return 15;
  }
  if (w.goal===19) {
    if (!w.copied) return writeTarget(w) ?? (!w.selected ? 10 : 12);
    if (!w.pasted) return editReady(w) ?? (!w.selected ? 10 : 13);
    return notesReady(w) ?? 14;
  }
  return 5;
}
export function execute(w, action) {
  if (w.done) return {ok:false,message:'Lượt đã kết thúc'};
  w.steps++;
  let ok=true, message=LABELS[action] ?? 'Tool không hợp lệ';
  const editable = w.notes && !w.minimized && w.active==='notes' && w.focus==='editor';
  const visibleNotes = w.notes && !w.minimized && w.active==='notes';
  if (w.modal && action!==19) { ok=false; message='Hộp thoại đang chặn thao tác'; }
  else switch(action) {
    case 0:w.browser=true;w.active='browser';w.focus='none';break;
    case 1:w.notes=true;w.minimized=false;w.active='notes';w.focus='none';break;
    case 2:if(!w.browser||w.active!=='browser')ok=false;else{w.site='claude';w.chat=false;}break;
    case 3:if(!w.browser||w.active!=='browser'||w.site!=='claude')ok=false;else{w.chat=true;message=`Mở “${w.chats[0].title}”`;}break;
    case 4:if(!w.browser||w.active!=='browser')ok=false;else{w.searched=true;message=`Tìm “${w.query}”`;}break;
    case 5:w.researched=true;message='Đã yêu cầu thầy hướng dẫn; chưa tự biết cách làm.';break;
    case 6:w.done=true;w.finished=true;ok=achieved(w);message=ok?'Đã kiểm chứng mục tiêu hoàn thành':'Báo xong khi mục tiêu chưa đạt';break;
    case 7:if(!w.notes||w.minimized)ok=false;else{w.active='notes';w.focus='none';}break;
    case 8:if(!w.browser)ok=false;else{w.active='browser';w.focus='none';}break;
    case 9:if(!visibleNotes)ok=false;else w.focus='editor';break;
    case 10:if(!editable)ok=false;else w.selected=true;break;
    case 11:if(!editable)ok=false;else{w.text=w.selected?w.expected:w.text+w.expected;w.selected=false;message=`Gõ ${w.expected.length} ký tự`; }break;
    case 12:if(!editable||!w.selected)ok=false;else{w.clipboard=w.text;w.copied=true;message=`Sao chép ${w.clipboard.length} ký tự`; }break;
    case 13:if(!editable)ok=false;else{w.text=w.selected?w.clipboard:w.text+w.clipboard;w.selected=false;w.pasted=true;}break;
    case 14:if(!visibleNotes)ok=false;else{w.savedText=w.text;w.focus='none';message=`Đã lưu ${w.filename} (${w.text.length} ký tự)`;}break;
    case 15:if(w.savedText===null)ok=false;else{w.notes=true;w.minimized=false;w.active='notes';w.text=w.savedText;w.focus='none';w.selected=false;w.reopened=true;message=`Đã đọc lại ${w.filename}`;}break;
    case 16:if(!visibleNotes)ok=false;else{w.notes=false;w.closed=true;w.closedAfterSave=w.savedText===w.expected;w.active=w.browser?'browser':'desktop';w.focus='none';w.selected=false;w.text='';}break;
    case 17:if(!visibleNotes)ok=false;else{w.minimized=true;w.minimizedOnce=true;w.active=w.browser?'browser':'desktop';w.focus='none';}break;
    case 18:if(!w.notes||!w.minimized)ok=false;else{w.minimized=false;w.restored=true;w.active='notes';w.focus='none';}break;
    case 19:if(!w.modal)ok=false;else{w.modal=false;w.dismissed=true;}break;
    default:ok=false;
  }
  if (!ok) {w.errors++;message=`Không thực hiện được: ${message}`;}
  if (ok&&!w.done&&!w.interrupted&&w.interruption&&w.steps>=2&&action!==19) {w.modal=true;w.interrupted=true;message+=' · xuất hiện hộp thoại';}
  if(w.steps>=MAX_STEPS)w.done=true;
  w.trace.push({action:ACTIONS[action],ok,message});
  return {ok,message};
}
export function demonstration(seed,goal=seed%GOALS.length) {
  const w=createWorld(seed,goal),samples=[];
  while(!w.done){const x=observe(w),target=teacher(w);samples.push({x,target});execute(w,target);}
  return samples;
}
export function evaluate(brain,start=100000,count=EXAM_COUNT,options={}) {
  let passed=0,steps=0,errors=0;
  const perGoal=GOALS.map(()=>({passed:0,total:0})),failures=[],times=[];
  for(let i=0;i<count;i++){
    const w=createWorld(start+i, i%GOALS.length, options);
    while(!w.done){const x=observe(w),t=performance.now(),result=brain.forward(x);if(options.timing)for(let repeat=1;repeat<16;repeat++)brain.forward(x);times.push((performance.now()-t)/(options.timing?16:1));execute(w,result.action);}
    const success=achieved(w)&&w.finished&&w.errors===0&&w.steps<=MAX_STEPS;
    passed+=+success;steps+=w.steps;errors+=w.errors;perGoal[w.goal].total++;perGoal[w.goal].passed+=+success;
    if(!success&&failures.length<30)failures.push({seed:w.seed,goal:w.goal,trace:w.trace});
  }
  times.sort((a,b)=>a-b);
  return {passed,total:count,rate:passed/count,steps,errors,perGoal,failures,medianMs:times[Math.floor(times.length/2)]??0,p95Ms:times[Math.floor(times.length*.95)]??0};
}
