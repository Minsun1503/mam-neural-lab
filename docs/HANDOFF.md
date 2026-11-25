# Bàn giao để tiếp tục trên máy khác

Repo public: https://github.com/Minsun1503/mam-neural-lab

## Mốc vừa hoàn thành

Nhánh huấn luyện attention-GRU tiếng Việt từ trọng số ngẫu nhiên đã có tokenizer subword, bộ dữ liệu public được ghim checksum, chia tập theo nhóm hội thoại, checkpoint có optimizer và vị trí batch, cùng bộ suy luận JavaScript độc lập. Mã nguồn và checksum được lưu trong Git; snapshot nhị phân được đính kèm GitHub Release để tiếp tục trên máy khác. Đây là **mốc hạ tầng huấn luyện và bàn giao**, chưa phải mốc đạt khả năng hội thoại tiếng Việt.

Hai tác nhân và phòng học visual vẫn chạy bằng mô hình thử nghiệm trước đó. Ứng viên public-GRU chưa được thay vào cửa sổ A/B vì chất lượng trả lời còn yếu. Không lấy checkpoint cá nhân hoặc các câu bạn đã sửa để public.

## Mở dự án

Yêu cầu Node.js 22.12+; Python 3.13 dùng cho nhánh huấn luyện. Lệnh dưới đây chạy trong thư mục repo vừa clone.

```powershell
git clone https://github.com/Minsun1503/mam-neural-lab.git
cd mam-neural-lab
npm ci
npm test
npm start
```

Phòng hội thoại hai tác nhân: chạy `npm run train:dialogue` để tạo lại trọng số từ curriculum public, rồi `npm run chat`. Thử nghiệm phối hợp có giới hạn: `npm run test:cooperation` hoặc bảng phối hợp trong cửa sổ chat.

## Khôi phục ứng viên và thử trên JavaScript

Không cần PyTorch để khôi phục ZIP hoặc chạy suy luận JavaScript. `python` ở đây chỉ dùng thư viện chuẩn.

```powershell
python training/transfer.py fetch
python training/transfer.py verify
python training/transfer.py restore
node scripts/public-gru-parity.mjs multiturn
npm run chat:research -- "Xin chào, bạn có thể giúp tôi học không?"
npm run inspect:brain
```

`fetch` tải đúng ZIP từ URL GitHub Release được ghim trong `checkpoints/release.json`, kiểm tra kích thước và SHA-256. `verify`/`restore` còn kiểm tra checksum từng file bên trong. ZIP local được Git bỏ qua. `restore` từ chối ghi đè file khác nội dung. Nếu máy đích đã có kết quả riêng, dùng `--directory` để khôi phục sang thư mục khác và tự chọn kết quả cần tiếp tục. Bản JavaScript mặc định đọc `outputs/public-language-multiturn/browser-model.json`, tương ứng **best.pt sau một epoch hoàn chỉnh**, còn `latest.pt` có thể mới hơn giữa epoch. Xem `progress.json` và `SNAPSHOT.json` để biết chính xác vị trí đang dừng.

Đây là ứng viên nghiên cứu có thể trả lời sai hoặc lặp, chưa có chứng nhận chất lượng hội thoại. CLI hiện thử từng câu độc lập; nó chưa cung cấp bộ nhớ hội thoại dài hạn.

## Tiếp tục huấn luyện CPU

```powershell
python -m venv .venv-train
.venv-train/Scripts/python.exe -m pip install torch==2.15.0+cpu --index-url https://download.pytorch.org/whl/cpu
.venv-train/Scripts/python.exe -m pip install -r training/requirements-cpu.txt
.venv-train/Scripts/python.exe training/train_public.py --source multiturn --epochs 12 --threads 3 --resume
```

Lần chạy đầu tự tải lại khoảng 69 MB dữ liệu public theo revision/checksum cố định. Không cần chuyển nguyên virtualenv hay dataset giữa các máy. CPU khác có thể cho sai khác số học nhỏ; không hứa hẹn kết quả bit-for-bit giữa phần cứng khác nhau. Giữ `--batch 32` và `--max-target 256` để khớp checkpoint. `--epochs 12` là tổng số epoch đích, không phải thêm 12 epoch.

Muốn chạy một đoạn hữu hạn, thêm `--stop-after-batches 50`. Muốn dừng tiến trình đang chạy sau batch hiện tại:

```powershell
New-Item outputs/public-language-multiturn/stop-request -ItemType File
```

Đợi `progress.json` báo `stopped-with-checkpoint` và tiến trình kết thúc. Xóa riêng file `stop-request` trước lần resume tiếp theo. Checkpoint định kỳ mỗi 50 batch; best checkpoint chỉ thay đổi sau bước validation cuối epoch. Không xóa output hay khởi động lại chỉ vì chưa thấy log mới.

Sau khi có best checkpoint mới:

```powershell
.venv-train/Scripts/python.exe training/export_public.py --source multiturn
node scripts/public-gru-parity.mjs multiturn
```

## Kiểm tra và đóng gói tiếp

```powershell
.venv-train/Scripts/python.exe -m unittest discover -s training -p "test_*.py"
.venv-train/Scripts/python.exe training/test_resume.py
npm test
npm run test:dialogue:ui
```

`test_resume.py` cần corpus nhỏ và tokenizer đã tạo bởi `training/train_public.py` mặc định; không nằm trong các unittest mặc định. Nó so sánh trọng số chạy 4 batch liền với 2 batch + khôi phục + 2 batch. Các phép kiểm tra parity chứng minh tính đúng của xuất mô hình, không đo khả năng hiểu ngôn ngữ.

Sau khi dừng huấn luyện có checkpoint, xuất/kiểm tra bản best như trên, rồi:

```powershell
python training/transfer.py pack
python training/transfer.py verify
```

Script chỉ lấy danh sách file public cho phép; không gom toàn bộ `outputs/`. Đính kèm ZIP mới vào một GitHub Release mới, cập nhật `checkpoints/release.json`, checksum, `SNAPSHOT.json` và ghi chú kết quả trước lần push tiếp theo. Giữ URL của snapshot cũ cố định để các commit trước vẫn có thể khôi phục đúng trọng số.

## Các milestone còn dở

1. **Tiếng Việt tổng quát:** hoàn tất và đánh giá ứng viên lớn hơn trên câu chưa học; đánh giá độ đúng chủ đề, ngữ pháp, lặp, ghi nhớ nhiều lượt, phủ định và trạng thái nhiệm vụ. Baseline corpus nhỏ sau 25 epoch vẫn trả lời lạc đề. Chưa có bằng chứng ứng viên lớn đạt mục tiêu; không dùng loss thay cho đánh giá hội thoại.
2. **Hai bộ não hội thoại riêng:** chỉ tích hợp ứng viên khi chất lượng đạt; giữ trọng số, lịch sử, cập nhật và checkpoint A/B độc lập. Hiện A/B dùng mô hình nhỏ theo tám nhóm hội thoại, có sửa riêng từng tác nhân nhưng chưa trò chuyện mở tốt.
3. **Phối hợp mở rộng:** hiện đạt 40/40 lượt chuyển file ở giao thức hẹp; tắt/khuấy kênh liên lạc thì 0/40. Phần trích/chèn nội dung trong dấu ngoặc vẫn là adapter rõ ràng. Cần thêm nhiều loại nhiệm vụ, vai trò mới và lỗi bất ngờ; chưa được gọi là phối hợp tổng quát.
4. **Quan sát việc suy nghĩ:** đã có `npm run inspect:brain` hiển thị token, xác suất, entropy, attention và toàn bộ trạng thái ẩn theo từng bước, có tạm dừng/xem lại. Xem [giới hạn của màn hình](brain-inspector.md). Cần tiếp tục nối tín hiệu ngôn ngữ với hành động và kết quả nhiệm vụ trong cùng một lượt phối hợp. Những tín hiệu quan sát được này không phải bản ghi đầy đủ suy nghĩ hay ý thức.

Mục tiêu chung vẫn đang mở; snapshot này giúp tiếp tục công việc thay vì bắt đầu lại.
