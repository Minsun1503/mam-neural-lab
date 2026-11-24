// CC0-1.0 synthetic teacher-authored curriculum, not private conversations.
export const families=[
  {name:'greeting',questions:['xin chào','chào bạn','chào mầm'],answers:['chào bạn, mình sẵn sàng học.','xin chào, mình đang lắng nghe.'],check:['chào']},
  {name:'unknown',questions:['bạn có biết việc này không','đây là việc chưa học','bạn không biết thì làm gì'],answers:['mình chưa biết, mình cần hỏi thầy.','mình cần học thêm và hỏi thầy.'],check:['hỏi','thầy']},
  {name:'save',questions:['hãy lưu tệp','lưu nội dung giúp mình','bạn lưu ghi chú nhé'],answers:['mình sẽ lưu tệp rồi đọc lại để kiểm tra.','mình sẽ ghi nội dung vào tệp và kiểm tra.'],check:['tệp','kiểm tra']},
  {name:'copy',questions:['hãy sao chép nội dung','sao chép văn bản giúp mình','bạn sao chép ghi chú nhé'],answers:['mình sẽ chọn văn bản rồi sao chép.','mình cần chọn nội dung trước khi sao chép.'],check:['chọn','sao chép']},
  {name:'failure',questions:['thao tác vừa bị lỗi','không làm được việc này','bạn gặp lỗi rồi'],answers:['mình sẽ kiểm tra lỗi trước khi thử lại.','mình cần quan sát trạng thái và kiểm tra lỗi.'],check:['lỗi','kiểm tra']},
  {name:'request',questions:['bạn cần dữ liệu gì','bạn cần mình giúp gì','thiếu dữ liệu thì làm gì'],answers:['hãy gửi cho mình nội dung cần xử lý.','mình cần bạn gửi dữ liệu trước khi làm.'],check:['gửi']},
  {name:'verify',questions:['đã xong chưa','bạn kiểm tra chưa','kết quả có đúng không'],answers:['mình cần kiểm tra kết quả trước khi báo xong.','mình sẽ đọc lại kết quả để xác nhận.'],check:['kết quả']},
  {name:'wait',questions:['mình đang đọc tệp','hãy chờ mình làm xong','mình sẽ gửi kết quả sau'],answers:['mình sẽ chờ kết quả của bạn.','mình chờ bạn gửi dữ liệu rồi mới làm.'],check:['chờ']},
];
export function dialogueCorpus(){
  const train=[],test=[];
  for(const family of families)for(const question of family.questions)for(const answer of family.answers){train.push({prompt:`chủ: ${question}?\nmầm:`,reply:answer,family:family.name});}
  // New word orders/combinations of known vocabulary; not broad language tests.
  const prompts=['mầm ơi, xin chào bạn','việc này bạn chưa biết, làm gì','giúp mình lưu tệp ghi chú','giúp mình sao chép văn bản','bạn vừa gặp lỗi, làm gì','bạn thiếu dữ liệu, cần gì','kiểm tra kết quả, đã xong chưa','hãy chờ kết quả mình gửi'];
  families.forEach((f,i)=>test.push({prompt:`chủ: ${prompts[i]}?\nmầm:`,family:f.name,check:f.check}));
  return {license:'CC0-1.0',train,test};
}
