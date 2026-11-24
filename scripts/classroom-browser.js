window.receipts={saved:0,opened:0,dismissed:0,pasted:0,researched:0};
const params=new URLSearchParams(location.search);
const view=params.get('view');
if(view==='chat'){
  document.getElementById('heading').textContent=params.get('title');
  document.getElementById('content').textContent='Đã mở trang cuộc trò chuyện qua liên kết thật.';
}else if(view==='results'){
  document.getElementById('heading').textContent=`Kết quả tìm kiếm: ${params.get('q')}`;
  document.getElementById('query').value=params.get('q');
}
document.getElementById('dismiss').onclick=()=>{document.getElementById('notice').close();window.receipts.dismissed++;};
