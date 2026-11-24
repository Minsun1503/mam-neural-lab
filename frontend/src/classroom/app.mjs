import {Brain, INPUTS, HIDDEN, OUTPUTS} from './brain.mjs';
import {ACTIONS, LABELS, GOALS, MAX_STEPS, EXAM_COUNT, CURRICULUM_VERSION, createWorld, observe, teacher, execute, evaluate} from './world.mjs';
import {teachEpisode, validation, certification, mastered, STANDARD} from './mentor.mjs';

const $ = id => document.getElementById(id);
const KEY = 'mam-neural-lab-v2';
let brain = new Brain(), history = [], trainingSeed = 1, episodeSeed = 7001;
let world = createWorld(episodeSeed, 3), busy = false, cancelled = false, currentMode = 'Sẵn sàng';
let lastForward = brain.forward(observe(world));
let before = null, after = null;
let certificate = null;
const messages = [];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function showTransferReport(){
  if(!window.classroomFiles?.transferReport)return;
  try{const fingerprint=JSON.stringify(brain.serialize());const report=await window.classroomFiles.transferReport(fingerprint);
    if(fingerprint!==JSON.stringify(brain.serialize()))return;
    $('transfer-status').textContent=report?`Thực hành ứng dụng độc lập: ${report.passed}/${report.total} · khớp đúng checkpoint hiện tại · ${report.scope}`:'Thực hành ứng dụng độc lập: chưa có kết quả khớp bộ não đang mở.';
  }catch(error){$('transfer-status').textContent=`Chưa đọc được kết quả thực hành: ${error.message}`;}
}
let loadError = '';
try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const saved = JSON.parse(raw);
    brain = Brain.restore(saved.brain);
    if (Number.isSafeInteger(saved.trainingSeed) && saved.trainingSeed >= 1 && saved.trainingSeed < 90000) trainingSeed = saved.trainingSeed;
    history = saved.curriculumVersion===CURRICULUM_VERSION&&Array.isArray(saved.history) ? saved.history.filter(item => Number.isFinite(item.rate) && item.rate >= 0 && item.rate <= 1).slice(-20) : [];
    before = history[0] ?? null; after = history.at(-1) ?? null;
    certificate = saved.certificate?.curriculumVersion===CURRICULUM_VERSION&&saved.certificate.updates===brain.updates ? saved.certificate : null;
  } else if (localStorage.getItem('mam-neural-lab-v1')) {
    const legacy = JSON.parse(localStorage.getItem('mam-neural-lab-v1'));
    brain = Brain.upgrade(legacy.brain);
  }
} catch (error) { loadError = `Không thể khôi phục bộ não: ${error.message}. Bản lưu cũ chưa bị ghi đè.`; }

function log(type, message, error = false) {
  messages.unshift({type, message, error, time: new Date().toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'})});
  messages.splice(60);
  const fragment = document.createDocumentFragment();
  for (const item of messages) {
    const row = document.createElement('div'); row.className = `event${item.error ? ' error' : ''}`;
    const kind = document.createElement('span'); kind.className = 'event-type'; kind.textContent = item.type;
    const text = document.createElement('span'); text.className = 'event-text'; text.textContent = item.message;
    const time = document.createElement('time'); time.textContent = item.time;
    row.append(kind, text, time); fragment.append(row);
  }
  $('journal').replaceChildren(fragment);
}

function save() {
  try {
    if (loadError) throw new Error('Bản lưu lỗi đang được giữ lại; hãy chọn “Tạo não mới” để bắt đầu lại.');
    localStorage.setItem(KEY, JSON.stringify({brain: brain.serialize(), trainingSeed, history, certificate,curriculumVersion:CURRICULUM_VERSION}));
    $('storage-status').textContent = `Đã lưu ${brain.examples.toLocaleString('vi-VN')} cập nhật · trên máy này`;
    return true;
  } catch (error) { $('storage-status').textContent = error.message; log('LƯU', error.message, true); return false; }
}

function setBusy(value, mode = 'Sẵn sàng') {
  busy = value; cancelled = false; currentMode = mode; $('mode').textContent = mode;
  for (const id of ['train', 'auto-teach', 'practice', 'exam', 'lesson', 'new-world', 'teach-step', 'reset', 'icon-browser', 'icon-notes']) $(id).disabled = value;
  $('stop').disabled = !value;
  if(value)$('transfer-status').textContent='Đang thực hành / học; kết quả ngoài sandbox sẽ được đối chiếu lại khi kết thúc.';
}

function appWindow() {
  const host = $('app-window'); host.replaceChildren();
  $('sandbox-state').textContent = `Clipboard: ${world.clipboard || 'trống'} | Tệp: ${world.savedText === null ? 'chưa lưu' : world.filename} | Focus: ${world.focus}${world.selected ? ' · đã chọn tất cả' : ''}`;
  if (world.modal) {
    const modal = document.createElement('div'); modal.className='fake-modal';
    const title=document.createElement('strong');title.textContent='Thông báo đang chặn thao tác';
    const text=document.createElement('p');text.textContent='Cần đóng hộp thoại trước khi tiếp tục.';
    modal.append(title,text);host.append(modal);
  }
  if ((!world.browser && !world.notes) || (world.active==='desktop') || (world.active==='notes'&&world.minimized)) return;
  const win = document.createElement('div'); win.className = 'fake-window';
  win.style.left = `${world.layout.left}px`; win.style.top = `${world.layout.top}px`;
  const title = document.createElement('div'); title.className = 'window-title';
  title.textContent = world.active === 'notes' ? '▤  Ghi chú' : '◉  Trình duyệt';
  const dots = document.createElement('span'); dots.className = 'dots'; dots.textContent = '− □ ×'; title.append(dots); win.append(title);
  if (world.active !== 'notes') {
    const address = document.createElement('div'); address.className = 'address';
    address.textContent = world.searched ? `search.local/?q=${world.query}` : world.site === 'claude' ? `claude.fake/${world.chat ? 'chat/latest' : 'new'}` : 'desktop.fake/start';
    win.append(address);
  }
  const body = document.createElement('div'); body.className = 'window-body';
  const heading = document.createElement('h3');
  if (world.active === 'notes') {
    heading.textContent = 'Một trang giấy mới'; body.append(heading);
    const note = document.createElement('div'); note.className = `fake-note${world.focus==='editor'?' focused':''}${world.selected?' selected':''}`; note.textContent = world.text || 'Ô nhập đang trống'; body.append(note);
  } else if (world.searched) {
    heading.textContent = `Kết quả: ${world.query}`; body.append(heading);
    const line = document.createElement('p'); line.textContent = 'Đã tìm nội dung trong môi trường giả.'; body.append(line);
  } else if (world.site === 'claude') {
    heading.textContent = world.chat ? world.chats[0].title : 'Claude · bản giả lập'; body.append(heading);
    if (world.chat) {
      const p = document.createElement('p'); p.textContent = 'Bạn: Cùng tìm hiểu ý tưởng này nhé.\nClaude: Chúng ta bắt đầu từ quan sát và thử nghiệm.'; body.append(p);
    } else {
      for (const chat of world.chats) {
        const row = document.createElement('div'); row.className = 'chat-row'; row.textContent = chat.title;
        const small = document.createElement('small'); small.textContent = `${chat.age} phút trước`; row.append(small); body.append(row);
      }
    }
  } else { heading.textContent = 'Thế giới bắt đầu ở đây.'; body.append(heading); const p = document.createElement('p'); p.textContent = 'Trình duyệt đã mở. Bạn muốn đi đâu?'; body.append(p); }
  win.append(body); host.append(win);
  $('desktop').classList.toggle('reverse', world.layout.reverse);
  $('icon-browser').style.order = world.layout.reverse ? '1' : '0';
}

function network() {
  const canvas = $('network'), ctx = canvas.getContext('2d');
  const width = canvas.clientWidth, height = canvas.clientHeight, ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio; canvas.height = height * ratio; ctx.scale(ratio, ratio);
  const x = observe(world), hidden = lastForward.hidden, p = lastForward.probabilities;
  const layers = [Array.from(x), [...hidden], p];
  const positions = layers.map((layer, l) => layer.map((_, i) => ({x: 25 + (width - 50) * l / 2, y: 9 + (height - 18) * (i + .5) / layer.length})));
  // Draw every actual weight, no invented edges. Bounded rendering, no idle animation.
  for (let l = 0; l < 2; l++) {
    const weights = l === 0 ? brain.w1 : brain.w2, source = layers[l], dest = layers[l + 1];
    for (let j = 0; j < dest.length; j++) for (let i = 0; i < source.length; i++) {
      const w = weights[j * source.length + i], activation = Math.abs(source[i]);
      const alpha = Math.min(.55, .025 + Math.abs(w) * activation * .17);
      ctx.strokeStyle = w >= 0 ? `rgba(140,228,189,${alpha})` : `rgba(163,147,229,${alpha})`;
      ctx.lineWidth = .5; ctx.beginPath(); ctx.moveTo(positions[l][i].x, positions[l][i].y); ctx.lineTo(positions[l + 1][j].x, positions[l + 1][j].y); ctx.stroke();
    }
  }
  positions.forEach((layer, l) => layer.forEach((pos, i) => {
    const a = layers[l][i]; ctx.beginPath(); ctx.arc(pos.x, pos.y, l === 2 ? 3 : 1.35, 0, Math.PI * 2);
    ctx.fillStyle = a < -.1 ? '#a393e5' : Math.abs(a) > .15 ? '#8ce4bd' : '#2d465b'; ctx.fill();
    if (l === 2 && i === lastForward.action) { ctx.beginPath(); ctx.arc(pos.x, pos.y, 7, 0, Math.PI * 2); ctx.strokeStyle = '#8ce4bd'; ctx.stroke(); }
  }));
}

function comparison() {
  const host = $('comparison'); host.replaceChildren();
  const note = document.createElement('p'); note.textContent = certificate ? `Thi mở rộng: ${certificate.passed}/${certificate.total} · ${certificate.mastered ? 'Đạt chuẩn 20 bài trong sandbox' : 'Cần học tiếp'}` : '400 tình huống kiểm tra · tiêu chuẩn ≥99% tổng, ≥95% từng bài, 3 lần liên tiếp.'; host.append(note);
  for (const [name, result] of [['Ban đầu', before], ['Gần nhất', after]]) {
    const row = document.createElement('div'); row.className = 'comparison-row';
    const label = document.createElement('span'); label.textContent = name;
    const bar = document.createElement('div'); bar.className = 'bar'; const fill = document.createElement('i'); fill.style.width = `${(result?.rate ?? 0) * 100}%`; bar.append(fill);
    const value = document.createElement('b'); value.textContent = result ? `${Math.round(result.rate * 100)}%` : '—'; row.append(label, bar, value); host.append(row);
  }
}

function render() {
  lastForward = brain.forward(observe(world));
  $('examples').textContent = brain.examples.toLocaleString('vi-VN');
  $('memory').textContent = `${(brain.bytes / 1024).toFixed(2)} KiB`;
  $('episode-tag').textContent = `Lượt #${world.seed} · ${world.steps}/${MAX_STEPS} bước`;
  $('mission').textContent = GOALS[world.goal];
  $('mission-detail').textContent = world.goal === 4 ? `Tìm: “${world.query}”` : world.goal === 5 ? 'Mục tiêu ngoài chương trình → cần yêu cầu hướng dẫn' : world.goal>=8 ? `Văn bản đích: “${world.expected}”` : 'Quan sát trạng thái mới trước mỗi hành động.';
  $('student-status').textContent = busy ? currentMode : certificate?.mastered ? 'Đạt chuẩn thao tác cơ bản trong sandbox' : brain.examples ? `Đã học ${brain.examples.toLocaleString('vi-VN')} ví dụ · Có thể thử thi` : 'Chưa được dạy · Sẵn sàng khám phá';
  $('loss').textContent = brain.examples ? `Loss gần nhất ${brain.lastLoss.toFixed(3)}` : 'Trọng số ngẫu nhiên';
  if (after) {
    $('score').textContent = `${after.passed}/${after.total}`;
    $('score-note').textContent = `${Math.round(after.rate * 100)}% hoàn thành · không có thầy`;
    $('latency').textContent = after.medianMs > 0 ? `${(after.medianMs * 1000).toFixed(1)} µs` : 'Dưới độ phân giải';
  } else { $('score').textContent = '—'; $('latency').textContent = '—'; $('score-note').textContent=`${EXAM_COUNT} tình huống chưa dùng để dạy`; }
  const host = $('policy'); host.replaceChildren();
  lastForward.probabilities.forEach((value, i) => {
    const row = document.createElement('div'); row.className = `policy-row${i === lastForward.action ? ' chosen' : ''}`;
    const label = document.createElement('span'); label.textContent = LABELS[i];
    const bar = document.createElement('div'); bar.className = 'bar'; const fill = document.createElement('i'); fill.style.width = `${value * 100}%`; bar.append(fill);
    const number = document.createElement('small'); number.textContent = `${Math.round(value * 100)}%`; row.append(label, bar, number); host.append(row);
  });
  $('curriculum').replaceChildren(...GOALS.map((label, i) => {
    const row = document.createElement('div'); row.className = 'lesson-item';
    const index = document.createElement('b'); index.textContent = `0${i + 1}`;
    const text = document.createElement('span'); text.textContent = label;
    const result = document.createElement('small'); const score = after?.perGoal?.[i]; result.textContent = score ? `${score.passed}/${score.total}` : '—';
    row.append(index, text, result); return row;
  }));
  appWindow(); network(); comparison();
}

function takeStep(action, source) {
  const result = execute(world, action);
  $('action-status').textContent = `${source}: ${result.message}`;
  log(source, `${ACTIONS[action]} → ${result.message}`, !result.ok);
  render(); return result;
}

async function guarded(mode, fn) {
  if (busy) return;
  setBusy(true, mode); render();
  try { await fn(); }
  catch (error) { log('LỖI', error.message, true); $('action-status').textContent = error.message; }
  finally { setBusy(false); render(); await showTransferReport(); }
}

function runExam(label) {
  const result = evaluate(brain,100000,EXAM_COUNT,{timing:true});
  if (!before) before = result;
  after = result; history.push(result); history = history.slice(-20);
  log('THI', `${label}: ${result.passed}/${result.total} lượt đúng, ${result.errors} thao tác lỗi; p95 ${result.p95Ms.toFixed(3)} ms. Không cập nhật trọng số.`);
  render(); return result;
}

$('train').onclick = () => guarded('Thầy làm mẫu', async () => {
  certificate = null;
  const chosenLesson = Number($('lesson').value);
  if (!before) runExam('Trước buổi học');
  log('THẦY', '300 lượt mới. Mỗi bước có đáp án từ thầy; mạng học bằng gradient, chưa tự khám phá luật.');
  for (let n = 0; n < 300; n++) {
    if (cancelled) break;
    if (trainingSeed >= 90000) { log('DỪNG', 'Đã hết miền seed huấn luyện; giữ riêng bộ đề thi.'); break; }
    world = createWorld(trainingSeed++);
    while (!world.done) {
      const x = observe(world), target = teacher(world);
    brain.learn(x, target, .025);
      if (n < 3) {
        render(); await wait(180);
        if (cancelled) break;
        takeStep(target, 'THẦY'); await wait(150);
      } else execute(world, target);
    }
    if (n % 10 === 0 || n === 299) {
      $('action-status').textContent = `Thầy đã dạy ${n + 1}/300 lượt · ${brain.examples} cập nhật thật`;
      render(); await wait(12);
    }
  }
  log('HỌC', `Kết thúc buổi mẫu: ${brain.examples} ví dụ; loss gần nhất ${brain.lastLoss.toFixed(4)}.`);
  runExam('Sau buổi học'); save();
  world = createWorld(++episodeSeed, chosenLesson);
  $('action-status').textContent = `${cancelled ? 'Đã dừng và lưu' : 'Đã học xong'} · ${after.passed}/${after.total} lượt thi đúng. Chọn “Tự làm từng bước” để quan sát.`;
});
$('exam').onclick = () => guarded('Thi độc lập', async () => { await wait(30); runExam('Thi độc lập'); save(); $('action-status').textContent = `Đã thi trên ${EXAM_COUNT} tình huống. Không gọi teacher, không sửa trọng số.`; });
$('auto-teach').onclick = () => guarded('Học chương trình thao tác cơ bản', async () => {
  certificate = null;
  if (!before) runExam('Trước chương trình');
  let streak = 0;
  let episodesThisCourse=0;
  log('GIÁO ÁN', '20 bài, xen kẽ ôn bài cũ. Đạt ≥99% tổng và ≥95% từng bài 3 lần, sau đó thi riêng 3.000 tình huống.');
  for (let batch=0; batch<40 && !cancelled && trainingSeed<89000; batch++) {
    for (let n=0;n<500;n++) {
      if (cancelled) break;
      teachEpisode(brain,trainingSeed++);
      episodesThisCourse++;
      if(n%25===0){$('action-status').textContent=`Đang dạy · ${trainingSeed-1} lượt · lần đạt liên tiếp ${streak}/${STANDARD.consecutive}`;render();await wait(5);}
    }
    if(cancelled)break;
    const result=validation(brain);
    if(!before)before=result;
    after=result;history.push(result);history=history.slice(-20);
    streak=mastered(result)&&episodesThisCourse>=6000?streak+1:0;
    log('KIỂM TRA', `Buổi ${batch+1}: ${result.passed}/${result.total}; bài thấp nhất ${Math.round(Math.min(...result.perGoal.map(g=>g.passed/g.total))*100)}%; đạt liên tiếp ${streak}/3.`);
    save();render();await wait(20);
    if(streak>=STANDARD.consecutive){
      $('action-status').textContent='Đang thi chứng nhận riêng 3.000 tình huống; không xem đáp án.';await wait(30);
      certificate={...certification(brain),updates:brain.updates};
      log('THI RIÊNG',`${certificate.passed}/${certificate.total} · ${certificate.mastered?'Đạt chuẩn thao tác cơ bản trong sandbox':'Chưa đạt, tiếp tục học'}`);
      if(certificate.mastered)break;
      certificate=null;streak=0;
    }
  }
  if (certificate?.mastered) after = evaluate(brain,100000,EXAM_COUNT,{timing:true});
  save();
  world=createWorld(++episodeSeed,18);$('lesson').value='18';
  $('action-status').textContent=certificate?.mastered?`Đã đạt chuẩn: ${certificate.passed}/${certificate.total}. Bấm Tự làm để xem viết → lưu → mở lại.`:cancelled?'Đã dừng, giữ lại trọng số đã học.':'Chưa đủ chuẩn; đã lưu tiến bộ để học tiếp.';
});
$('practice').onclick = () => guarded('Tự thực hành · không thầy', async () => {
  if (world.done) world = createWorld(++episodeSeed, Number($('lesson').value));
  log('TỰ LÀM', `Bắt đầu: mạng tự chọn tool. Giới hạn ${MAX_STEPS} bước; không học đáp án trong lượt này.`);
  while (!world.done && !cancelled) { const action = brain.forward(observe(world)).action; takeStep(action, 'TỰ LÀM'); await wait(650); }
  if (world.done) log('KẾT QUẢ', `Lượt tự làm kết thúc sau ${world.steps} bước; xem thông báo kiểm chứng và lỗi trong nhật ký.`);
});
$('teach-step').onclick = () => {
  if (busy) return;
  certificate = null;
  if (world.done) world = createWorld(++episodeSeed, Number($('lesson').value));
  const x = observe(world), target = teacher(world), predicted = brain.forward(x).action;
  for (let i = 0; i < 4; i++) brain.learn(x, target);
  log('SỬA', `Mạng chọn ${ACTIONS[predicted]}; thầy dạy ${ACTIONS[target]}. 4 cập nhật cho quan sát này.`);
  takeStep(target, 'THẦY'); save();
  showTransferReport();
};
$('stop').onclick = () => { cancelled = true; $('action-status').textContent = 'Đã yêu cầu dừng tại ranh giới bước tiếp theo.'; };
function newWorld() { if (busy) return; world = createWorld(++episodeSeed, Number($('lesson').value)); $('action-status').textContent = 'Tình huống mới: bố cục, tiêu đề và trạng thái ban đầu đã thay đổi.'; render(); }
$('new-world').onclick = newWorld;
$('lesson').append(...GOALS.map((label, i) => { const option = document.createElement('option'); option.value = i; option.textContent = label; return option; }));
$('lesson').value = '3'; $('lesson').onchange = newWorld;
$('icon-browser').onclick = () => { if (!busy) takeStep(0, 'BẠN'); };
$('icon-notes').onclick = () => { if (!busy) takeStep(1, 'BẠN'); };
$('save').onclick = () => { if (save()) log('LƯU', 'Đã lưu trọng số. Đóng và mở lại phòng học để tiếp tục.'); };
$('export-brain').onclick = async () => {
  if(!window.classroomFiles){log('XUẤT','Cần mở lại cửa sổ để dùng cầu lưu tệp.',true);return;}
  try {const path=await window.classroomFiles.export(JSON.stringify({brain:brain.serialize(),certificate,history}));log('XUẤT',`Đã xuất checkpoint: ${path}`);$('storage-status').textContent='Đã xuất checkpoint vào outputs/classroom';}
  catch(error){log('XUẤT',error.message,true);}
};
$('reset').onclick = () => $('reset-dialog').showModal();
$('cancel-reset').onclick = () => $('reset-dialog').close();
$('confirm-reset').onclick = () => {
  brain = new Brain(); history = []; before = null; after = null; certificate = null; trainingSeed = 1; loadError = '';
  messages.length = 0; $('reset-dialog').close(); newWorld(); save(); log('KHỞI TẠO', 'Bộ não mới với trọng số ngẫu nhiên.');
  showTransferReport();
};
$('pet-image').onerror = () => { $('pet-image').hidden = true; $('pet-fallback').hidden = false; };
window.addEventListener('resize', network);
log('KHỞI TẠO', `${INPUTS} đầu vào · ${HIDDEN} nơ-ron ẩn · ${OUTPUTS} tool. ${brain.bytes} byte trọng số và bias.`);
log('PHẠM VI', '20 bài: cửa sổ, nhập/sửa, copy/paste, lưu/mở tệp, chuỗi thao tác và hộp thoại. Nhận mục tiêu có cấu trúc; chưa hiểu ngôn ngữ tự do.');
if (loadError) log('LỖI LƯU', loadError, true);
else if (brain.examples) log('KHÔI PHỤC', `Đã nạp ${brain.examples} cập nhật đã lưu.`);
render();
showTransferReport();
