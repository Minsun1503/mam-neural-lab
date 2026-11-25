# Quan sát phép tính khi sinh câu

Sau khi khôi phục checkpoint theo [HANDOFF](HANDOFF.md), chạy `npm run inspect:brain` để mở cửa sổ riêng cho ứng viên attention-GRU. Nó không thay mô hình hội thoại A/B.

Nhập một câu, chọn **Tạo lượt mới**, sau đó **Tiếp một token** hoặc **Chạy chậm**. Có thể tạm dừng và bấm lại từng token trong dòng lịch sử để xem các số liệu đã ghi ở bước đó. Xem lại một bước không làm mô hình sinh một nhánh trả lời khác; lần sinh tiếp nối từ trạng thái cuối thực sự đã tính.

Mỗi bước lấy trực tiếp từ cùng bộ giải mã dùng cho `reply()`:

- Token được chọn bằng argmax, xác suất softmax, năm ứng viên và entropy của toàn bộ phân phối token.
- Attention chuẩn hóa trên tối đa 192 token đầu vào cuối cùng, sau khi mã hóa hai chiều.
- Toàn bộ trạng thái ẩn của decoder sau bước GRU (192 giá trị ở cấu hình hiện tại).
- Văn bản đã giải mã, token kết thúc hoặc việc chạm giới hạn 96 token.

Màu attention được chuẩn theo giá trị lớn nhất **ở từng bước** để dễ nhìn; tooltip hiển thị trọng số tuyệt đối. Vì vậy độ sáng giữa hai bước khác nhau không phải thang so sánh tuyệt đối. Tổng attention vẫn bằng 1. Xác suất token cao không chứng minh câu trả lời đúng. Attention và trạng thái ẩn là tín hiệu tính toán, không phải bản giải thích nhân quả đầy đủ hay bằng chứng về ý thức/suy nghĩ như con người.

Cửa sổ nạp một bản `browser-model.json` cố định và hiển thị SHA-256 của checkpoint gốc. Huấn luyện chạy ở nơi khác không tự thay đổi các trọng số đang quan sát. Mỗi lượt nhập bắt đầu một lần suy luận mới; chưa có trí nhớ nhiều lượt, cập nhật trọng số hoặc điều khiển desktop từ màn hình này. Không tự lưu câu nhập để đưa vào dữ liệu huấn luyện/public.

Kiểm tra: `npm test` kiểm tra phân phối xác suất, entropy, attention, trạng thái, EOS và giới hạn bước bằng mạng có trọng số xác định; `node scripts/public-gru-parity.mjs multiturn` đối chiếu bộ suy luận với PyTorch; `npm run test:inspector:ui` kiểm tra bước token, xem lại, tạm dừng và lỗi renderer bằng checkpoint thực. Những kiểm tra này không chứng nhận chất lượng ngôn ngữ.
