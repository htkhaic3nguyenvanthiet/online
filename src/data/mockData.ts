import { Quiz, Classroom, ExamSession, Question } from '../types/quiz';

/**
 * Standard 28-Question Circular 7991 Collection
 * Phần I: 18 câu trắc nghiệm 4 lựa chọn (A, B, C, D)
 * Phần II: 4 câu trắc nghiệm Đúng / Sai (mỗi câu gồm 4 ý a, b, c, d)
 * Phần III: 6 câu trắc nghiệm trả lời ngắn (4 chữ số mặc định/chuẩn)
 * Tổng cộng: 28 câu = 10.0 điểm
 */
export const sampleQuestions: Question[] = [
  // --- PHẦN I: 18 CÂU TRẮC NGHIỆM 4 LỰA CHỌN (0.25đ/câu) ---
  {
    id: 'q1',
    order: 1,
    partType: 'part1_choice',
    content: 'Nội dung nào sau đây đúng khi nói về phương thức trồng rừng bằng gieo hạt thẳng tại thực địa?',
    options: [
      { key: 'A', text: 'Hạt giống cần có phẩm chất tốt và sức nảy mầm mạnh mẽ hơn so với hạt gieo trong vườn ươm.', isCorrect: true },
      { key: 'B', text: 'Cây con mọc lên từ hạt khó bị côn trùng và chim thú phá hoại.', isCorrect: false },
      { key: 'C', text: 'Không cần chăm sóc sau khi gieo hạt.', isCorrect: false },
      { key: 'D', text: 'Không cần làm đất trước khi gieo hạt.', isCorrect: false }
    ],
    correctAnswer: 'A',
    explanation: 'Gieo hạt trực tiếp tại thực địa đòi hỏi hạt giống phải có độ thuần cao và sức sống mạnh mẽ để chịu được điều kiện thời tiết khắc nghiệt.',
    points: 0.25
  },
  {
    id: 'q2',
    order: 2,
    partType: 'part1_choice',
    content: 'Phương pháp nhân giống vô tính nào cho phép nhân nhanh hàng loạt cây giống sạch bệnh trong thời gian ngắn nhất?',
    options: [
      { key: 'A', text: 'Chiết cành truyền thống lâu năm.', isCorrect: false },
      { key: 'B', text: 'Nuôi cấy mô tế bào thực vật (In vitro).', isCorrect: true },
      { key: 'C', text: 'Ghép áp cành trong vườn ươm.', isCorrect: false },
      { key: 'D', text: 'Giâm hom cành trên luống cát.', isCorrect: false }
    ],
    correctAnswer: 'B',
    explanation: 'Nuôi cấy mô tế bào trong phòng thí nghiệm vô trùng giúp tạo ra số lượng rất lớn cây giống sạch bệnh, đồng nhất về mặt di truyền.',
    points: 0.25
  },
  {
    id: 'q3',
    order: 3,
    partType: 'part1_choice',
    content: 'Biện pháp kỹ thuật nào sau đây thuộc nguyên lý nông nghiệp công nghệ cao thân thiện với môi trường sinh thái?',
    options: [
      { key: 'A', text: 'Hệ thống tưới nhỏ giọt tự động kết hợp châm phân định lượng qua rễ.', isCorrect: true },
      { key: 'B', text: 'Phun thuốc trừ sâu hóa học định kỳ hằng ngày bất kể có sâu hay không.', isCorrect: false },
      { key: 'C', text: 'Đốt sạch tàn dư rơm rạ ngay trên đồng ruộng sau thu hoạch.', isCorrect: false },
      { key: 'D', text: 'Bón quá liều phân đạm vô cơ để cây lớn nhanh cấp tốc.', isCorrect: false }
    ],
    correctAnswer: 'A',
    explanation: 'Tưới nhỏ giọt tiết kiệm đến 50-70% nước tưới và đưa phân bón chính xác đến rễ, giảm thất thoát rửa trôi ô nhiễm đất nguồn nước.',
    points: 0.25
  },
  {
    id: 'q4',
    order: 4,
    partType: 'part1_choice',
    content: 'Loại phân bón nào sau đây chứa hàm lượng đạm cao nhất, dễ tan trong nước và giúp cây phát triển mạnh thân lá?',
    options: [
      { key: 'A', text: 'Phân Kali Clorua (KCl).', isCorrect: false },
      { key: 'B', text: 'Phân Lân nung chảy.', isCorrect: false },
      { key: 'C', text: 'Phân Ure [CO(NH2)2].', isCorrect: true },
      { key: 'D', text: 'Phân vôi bột (CaCO3).', isCorrect: false }
    ],
    correctAnswer: 'C',
    explanation: 'Phân đạm ure chứa khoảng 46% N nguyên chất, có tác dụng thúc đẩy quá trình sinh trưởng thân lá của cây trồng.',
    points: 0.25
  },
  {
    id: 'q5',
    order: 5,
    partType: 'part1_choice',
    content: 'Biện pháp phòng trừ sâu bệnh nào dưới đây sử dụng thiên địch như ong mắt đỏ, bọ rùa để tiêu diệt sâu hại?',
    options: [
      { key: 'A', text: 'Biện pháp cơ giới, vật lý.', isCorrect: false },
      { key: 'B', text: 'Biện pháp sinh học.', isCorrect: true },
      { key: 'C', text: 'Biện pháp hóa học nồng độ cao.', isCorrect: false },
      { key: 'D', text: 'Biện pháp kiểm dịch thực vật.', isCorrect: false }
    ],
    correctAnswer: 'B',
    explanation: 'Sử dụng thiên địch là ứng dụng điển hình của biện pháp sinh học, an toàn cho con người và môi trường.',
    points: 0.25
  },
  {
    id: 'q6',
    order: 6,
    partType: 'part1_choice',
    content: 'Trong kỹ thuật trồng trọt trong nhà màng, yếu tố khí hậu nào sau đây có thể dễ dàng điều khiển tự động bằng cảm biến?',
    options: [
      { key: 'A', text: 'Nhiệt độ, độ ẩm không khí và ánh sáng.', isCorrect: true },
      { key: 'B', text: 'Cường độ bão lốc ngoài trời.', isCorrect: false },
      { key: 'C', text: 'Độ nghiêng của địa hình tự nhiên.', isCorrect: false },
      { key: 'D', text: 'Hàm lượng khoáng chất trong dung nham núi lửa.', isCorrect: false }
    ],
    correctAnswer: 'A',
    explanation: 'Nhà màng công nghệ cao tích hợp cảm biến nhiệt độ, độ ẩm và ánh sáng để kích hoạt quạt thông gió, lưới cắt nắng tự động.',
    points: 0.25
  },
  {
    id: 'q7',
    order: 7,
    partType: 'part1_choice',
    content: 'Mục đích chính của việc bón vôi nông nghiệp cho đất phèn ở vùng Đồng bằng sông Cửu Long là gì?',
    options: [
      { key: 'A', text: 'Khử chua, nâng cao độ pH của đất và kết tủa ion nhôm độc.', isCorrect: true },
      { key: 'B', text: 'Làm tăng hàm lượng cát hạt to trong đất.', isCorrect: false },
      { key: 'C', text: 'Thay thế hoàn toàn phân bón NPK tổng hợp.', isCorrect: false },
      { key: 'D', text: 'Làm đất bị chua nhiều hơn để diệt cỏ dại.', isCorrect: false }
    ],
    correctAnswer: 'A',
    explanation: 'Vôi (CaCO3, CaO) cung cấp ion Ca2+ đẩy ion H+ và Al3+ ra khỏi keo đất, khử chua và hạn chế độc chất sắt, nhôm.',
    points: 0.25
  },
  {
    id: 'q8',
    order: 8,
    partType: 'part1_choice',
    content: 'Công nghệ nào dưới đây cho phép cây trồng hấp thụ dinh dưỡng trong môi trường không khí có phun sương chứa dinh dưỡng?',
    options: [
      { key: 'A', text: 'Thủy canh tĩnh.', isCorrect: false },
      { key: 'B', text: 'Khí canh (Aeroponics).', isCorrect: true },
      { key: 'C', text: 'Trồng trọt truyền thống trên đất sét.', isCorrect: false },
      { key: 'D', text: 'Trồng trên giá thể than bùn ngập nước.', isCorrect: false }
    ],
    correctAnswer: 'B',
    explanation: 'Khí canh là công nghệ trồng cây mà rễ lơ lửng trong không khí và được phun sương định kỳ dung dịch dinh dưỡng giàu oxy.',
    points: 0.25
  },
  {
    id: 'q9',
    order: 9,
    partType: 'part1_choice',
    content: 'Cây trồng vụ đông nào sau đây thích hợp với khí hậu lạnh của miền Bắc Việt Nam?',
    options: [
      { key: 'A', text: 'Sầu riêng.', isCorrect: false },
      { key: 'B', text: 'Bắp cải, su hào, khoai tây.', isCorrect: true },
      { key: 'C', text: 'Cây cao su.', isCorrect: false },
      { key: 'D', text: 'Cây cà phê vối.', isCorrect: false }
    ],
    correctAnswer: 'B',
    explanation: 'Bắp cải, su hào, khoai tây là những cây trồng ưa lạnh, sinh trưởng tối ưu trong vụ đông xuân ở miền Bắc.',
    points: 0.25
  },
  {
    id: 'q10',
    order: 10,
    partType: 'part1_choice',
    content: 'Đặc điểm nào sau đây KHÔNG PHẢI là ưu điểm của giống cây trồng biến đổi gen (GMO)?',
    options: [
      { key: 'A', text: 'Khả năng kháng sâu bệnh hại tốt hơn.', isCorrect: false },
      { key: 'B', text: 'Chịu hạn, chịu mặn được cải thiện.', isCorrect: false },
      { key: 'C', text: 'Hoàn toàn không cần phân bón và nước tưới.', isCorrect: true },
      { key: 'D', text: 'Nâng cao giá trị dinh dưỡng của nông sản.', isCorrect: false }
    ],
    correctAnswer: 'C',
    explanation: 'Cây biến đổi gen vẫn là sinh vật sống cần nước và dưỡng chất để trao đổi chất, không thể tồn tại nếu thiếu phân bón và nước.',
    points: 0.25
  },
  {
    id: 'q11',
    order: 11,
    partType: 'part1_choice',
    content: 'Khi bảo quản hạt giống dài hạn, hai yếu tố môi trường nào cần được hạ thấp tối đa để duy trì tỷ lệ nảy mầm?',
    options: [
      { key: 'A', text: 'Nhiệt độ và độ ẩm không khí.', isCorrect: true },
      { key: 'B', text: 'Ánh sáng mặt trời trực tiếp và oxy.', isCorrect: false },
      { key: 'C', text: 'Lượng khí CO2 và áp suất khí quyển.', isCorrect: false },
      { key: 'D', text: 'Tốc độ gió và độ mặn của đất.', isCorrect: false }
    ],
    correctAnswer: 'A',
    explanation: 'Nhiệt độ thấp và độ ẩm thấp giúp làm chậm quá trình hô hấp của hạt, hạn chế nấm mốc phát triển và giữ sức nảy mầm bền lâu.',
    points: 0.25
  },
  {
    id: 'q12',
    order: 12,
    partType: 'part1_choice',
    content: 'Quy trình thu hoạch nào sau đây giúp giảm thiểu tổn thất sau thu hoạch đối với trái cây có múi (bưởi, cam, quýt)?',
    options: [
      { key: 'A', text: 'Dùng kéo chuyên dụng cắt cuống sát trái, tránh làm trầy xước vỏ.', isCorrect: true },
      { key: 'B', text: 'Dùng gậy đập mạnh vào cành để quả rụng xuống đất.', isCorrect: false },
      { key: 'C', text: 'Thu hoạch ngay sau khi trời vừa mưa to xong.', isCorrect: false },
      { key: 'D', text: 'Xếp quả thành đống cao ngoài trời nắng gắt.', isCorrect: false }
    ],
    correctAnswer: 'A',
    explanation: 'Dùng kéo cắt tỉa cuống nhẹ nhàng giúp bảo vệ vỏ quả, tránh dập nát và ngăn ngừa nấm mốc xâm nhập qua vết rách.',
    points: 0.25
  },
  {
    id: 'q13',
    order: 13,
    partType: 'part1_choice',
    content: 'Thời điểm nào trong ngày là thích hợp nhất để tiến hành phun thuốc bảo vệ thực vật sinh học cho cây trồng?',
    options: [
      { key: 'A', text: 'Lúc trưa nắng gắt khi nhiệt độ cao nhất.', isCorrect: false },
      { key: 'B', text: 'Sáng sớm hoặc chiều mát khi trời lặng gió.', isCorrect: true },
      { key: 'C', text: 'Khi trời đang mưa to gió lớn.', isCorrect: false },
      { key: 'D', text: 'Vào nửa đêm khi sương đọng dày đặc.', isCorrect: false }
    ],
    correctAnswer: 'B',
    explanation: 'Phun vào sáng sớm hoặc chiều mát tránh sự bốc hơi nhanh của thuốc dưới nắng và tránh bị gió thổi dạt thuốc sang khu vực khác.',
    points: 0.25
  },
  {
    id: 'q14',
    order: 14,
    partType: 'part1_choice',
    content: 'Hiện tượng ngộ độc hữu cơ ở cây lúa nước thường xảy ra do nguyên nhân chủ yếu nào?',
    options: [
      { key: 'A', text: 'Vùi rơm rạ tươi vào ruộng ngập nước chưa kịp phân hủy đã cấy lúa ngay.', isCorrect: true },
      { key: 'B', text: 'Bón quá nhiều phân lân nung chảy.', isCorrect: false },
      { key: 'C', text: 'Rút cạn nước phơi ruộng quá lâu.', isCorrect: false },
      { key: 'D', text: 'Gieo sạ với mật độ quá thưa.', isCorrect: false }
    ],
    correctAnswer: 'A',
    explanation: 'Rơm rạ tươi phân hủy kỵ khí trong điều kiện ngập nước sinh ra các khí độc (H2S, CH4) và axit hữu cơ làm đen rễ và nghẹt rễ lúa.',
    points: 0.25
  },
  {
    id: 'q15',
    order: 15,
    partType: 'part1_choice',
    content: 'Để kích thích cây bưởi ra hoa đồng loạt theo ý muốn, nhà vườn thường áp dụng biện pháp kỹ thuật nào?',
    options: [
      { key: 'A', text: 'Xiết nước (tạo khô hạn nhân tạo) sau đó tưới đẫm trở lại.', isCorrect: true },
      { key: 'B', text: 'Ngâm gốc trong nước ngập sâu liên tục 3 tháng.', isCorrect: false },
      { key: 'C', text: 'Bón nhiều phân đạm ure khi trời mưa dầm.', isCorrect: false },
      { key: 'D', text: 'Cắt cụt toàn bộ cành cấp 1 sát thân chính.', isCorrect: false }
    ],
    correctAnswer: 'A',
    explanation: 'Xiết nước gây sốc khô hạn giúp cây phân hóa mầm hoa, khi tưới đẫm trở lại kết hợp bón phân lân và kali cây sẽ bung hoa đồng loạt.',
    points: 0.25
  },
  {
    id: 'q16',
    order: 16,
    partType: 'part1_choice',
    content: 'Mô hình VAC (Vườn - Ao - Chuồng) truyền thống thể hiện nguyên lý nông nghiệp sinh thái nào?',
    options: [
      { key: 'A', text: 'Tuần hoàn vật chất và tận dụng phụ phẩm khép kín giữa các khâu.', isCorrect: true },
      { key: 'B', text: 'Độc canh chuyên canh một giống duy nhất trên diện tích rộng.', isCorrect: false },
      { key: 'C', text: 'Loại bỏ hoàn toàn vai trò của vi sinh vật đất.', isCorrect: false },
      { key: 'D', text: 'Phụ thuộc 100% vào thức ăn công nghiệp nhập khẩu.', isCorrect: false }
    ],
    correctAnswer: 'A',
    explanation: 'Chất thải chăn nuôi làm phân bón cho vườn và thức ăn cho cá, bùn ao dùng bón lại cho cây trồng, tạo chu trình dinh dưỡng tuần hoàn.',
    points: 0.25
  },
  {
    id: 'q17',
    order: 17,
    partType: 'part1_choice',
    content: 'Bộ phận nào của cây được sử dụng phổ biến nhất để thực hiện nhân giống bằng phương pháp giâm cành?',
    options: [
      { key: 'A', text: 'Đoạn cành bánh tẻ khỏe mạnh, không sâu bệnh.', isCorrect: true },
      { key: 'B', text: 'Cành non yếu vừa nhú mầm mềm.', isCorrect: false },
      { key: 'C', text: 'Cành già cỗi đã khô nứt nẻ.', isCorrect: false },
      { key: 'D', text: 'Cánh hoa đã thụ phấn xong.', isCorrect: false }
    ],
    correctAnswer: 'A',
    explanation: 'Cành bánh tẻ có lượng chất hữu cơ dự trữ dồi dào và tế bào mô phân sinh hoạt động mạnh, giúp ra rễ nhanh và tỷ lệ sống cao.',
    points: 0.25
  },
  {
    id: 'q18',
    order: 18,
    partType: 'part1_choice',
    content: 'Tiêu chuẩn VietGAP trong sản xuất trồng trọt tại Việt Nam hướng tới mục tiêu cốt lõi nào?',
    options: [
      { key: 'A', text: 'Đảm bảo an toàn thực phẩm, bảo vệ môi trường và sức khỏe người lao động.', isCorrect: true },
      { key: 'B', text: 'Tối đa hóa lợi nhuận bất chấp ô nhiễm nguồn nước ngầm.', isCorrect: false },
      { key: 'C', text: 'Sử dụng thuốc diệt cỏ tràn lan để giảm nhân công làm cỏ.', isCorrect: false },
      { key: 'D', text: 'Chỉ sản xuất hàng mẫu để trưng bày hội chợ.', isCorrect: false }
    ],
    correctAnswer: 'A',
    explanation: 'VietGAP (Thực hành sản xuất nông nghiệp tốt) quy định nghiêm ngặt từ khâu chọn đất, giống, phân bón đến thu hoạch để đảm bảo an toàn nông sản.',
    points: 0.25
  },

  // --- PHẦN II: 4 CÂU TRẮC NGHIỆM ĐÚNG / SAI (1.0đ/câu - 4 ý a,b,c,d) ---
  {
    id: 'q19',
    order: 19,
    partType: 'part2_true_false',
    content: 'Khi nghiên cứu về đặc điểm của đất phèn, đất mặn và các giải pháp cải tạo đất trồng tại vùng Đồng bằng sông Cửu Long:',
    subItems: [
      {
        key: 'a',
        content: 'Biện pháp bón vôi nông nghiệp có tác dụng khử chua, nâng cao độ pH của đất phèn.',
        isCorrect: true // Gạch chân a) -> ĐÚNG
      },
      {
        key: 'b',
        content: 'Thau chua rửa mặn bằng nguồn nước ngọt dồi dào từ sông Tiền và sông Hậu là giải pháp sinh thái bền vững.',
        isCorrect: true // Gạch chân b) -> ĐÚNG
      },
      {
        key: 'c',
        content: 'Nên cày lật sâu tầng đất chứa hợp chất pyrit sinh phèn lên bề mặt ruộng để phơi ải trong mùa khô.',
        isCorrect: false // Không gạch chân -> SAI
      },
      {
        key: 'd',
        content: 'Đất phèn hoàn toàn không thể canh tác bất kỳ loại cây trồng nào kể cả tràm và khóm (dứa).',
        isCorrect: false // Không gạch chân -> SAI
      }
    ],
    correctAnswer: 'a:Đ b:Đ c:S d:S',
    explanation: 'Ý a, b đúng (được gạch chân). Ý c sai vì cày lật sâu tầng pyrit sẽ làm oxy hóa mạnh tạo thêm H2SO4 gây chua dữ dội. Ý d sai vì tràm và khóm là cây tiên phong chịu phèn tốt.',
    points: 1.0
  },
  {
    id: 'q20',
    order: 20,
    partType: 'part2_true_false',
    content: 'Về ứng dụng công nghệ tưới tiêu tự động và tiết kiệm nước trong trồng trọt hiện đại:',
    subItems: [
      {
        key: 'a',
        content: 'Hệ thống tưới nhỏ giọt có thể cung cấp phân bón hòa tan chính xác đến từng vùng rễ cây trồng (Fertigation).',
        isCorrect: true // Gạch chân a) -> ĐÚNG
      },
      {
        key: 'b',
        content: 'Tưới phun mưa áp lực nhẹ thích hợp cho các loại rau ăn lá và cây con trong vườn ươm.',
        isCorrect: true // Gạch chân b) -> ĐÚNG
      },
      {
        key: 'c',
        content: 'Tưới ngập tràn rãnh sâu là biện pháp tiết kiệm nước nhất trong canh tác nông nghiệp công nghệ cao.',
        isCorrect: false // SAI
      },
      {
        key: 'd',
        content: 'Cảm biến độ ẩm đất giúp hệ thống tưới tự động ngắt khi trời mưa, tránh lãng phí nước và ngập úng rễ.',
        isCorrect: true // Gạch chân d) -> ĐÚNG
      }
    ],
    correctAnswer: 'a:Đ b:Đ c:S d:Đ',
    explanation: 'Ý a, b, d là đúng. Ý c sai vì tưới ngập tràn tiêu tốn lượng nước khổng lồ và dễ làm rửa trôi dinh dưỡng.',
    points: 1.0
  },
  {
    id: 'q21',
    order: 21,
    partType: 'part2_true_false',
    content: 'Khi đánh giá về vai trò và cách sử dụng phân bón hữu cơ vi sinh trong nông nghiệp bền vững:',
    subItems: [
      {
        key: 'a',
        content: 'Phân hữu cơ giúp bổ sung mùn, cải tạo kết cấu xốp và tăng dung tích hấp phụ của đất.',
        isCorrect: true // ĐÚNG
      },
      {
        key: 'b',
        content: 'Phân vi sinh cố định nitơ có khả năng chuyển hóa N2 tự do trong không khí thành dạng đạm cây hấp thu được.',
        isCorrect: true // ĐÚNG
      },
      {
        key: 'c',
        content: 'Phân hữu cơ vi sinh có tác dụng nhanh tức thì giống như phân đạm vô cơ hòa tan.',
        isCorrect: false // SAI
      },
      {
        key: 'd',
        content: 'Ủ phân chuồng hoai mục bằng chế phẩm Trichoderma giúp tiêu diệt mầm nấm bệnh và phân hủy nhanh xenlulozo.',
        isCorrect: true // ĐÚNG
      }
    ],
    correctAnswer: 'a:Đ b:Đ c:S d:Đ',
    explanation: 'Ý c sai vì phân hữu cơ giải phóng dưỡng chất từ từ, tác dụng bền lâu chứ không bốc nhanh như đạm hóa học.',
    points: 1.0
  },
  {
    id: 'q22',
    order: 22,
    partType: 'part2_true_false',
    content: 'Về các biện pháp quản lý dịch hại tổng hợp (IPM) trong canh tác cây ăn trái:',
    subItems: [
      {
        key: 'a',
        content: 'Ưu tiên áp dụng các biện pháp canh tác, cơ giới và sinh học trước khi dùng thuốc hóa học.',
        isCorrect: true // ĐÚNG
      },
      {
        key: 'b',
        content: 'Mục tiêu của IPM là tiêu diệt triệt để 100% tất cả các loài côn trùng xuất hiện trong vườn.',
        isCorrect: false // SAI (giữ sâu hại dưới ngưỡng gây hại kinh tế)
      },
      {
        key: 'c',
        content: 'Bao trái bưởi, xoài bằng túi chuyên dụng là biện pháp cơ học hiệu quả ngăn ruồi đục quả.',
        isCorrect: true // ĐÚNG
      },
      {
        key: 'd',
        content: 'Tuân thủ thời gian cách ly của thuốc bảo vệ thực vật nhằm tránh tồn dư hóa chất trên nông sản khi xuất bán.',
        isCorrect: true // ĐÚNG
      }
    ],
    correctAnswer: 'a:Đ b:S c:Đ d:Đ',
    explanation: 'Ý b sai vì IPM duy trì cân bằng sinh thái, giữ mật độ dịch hại dưới ngưỡng kinh tế chứ không tiêu diệt sạch làm mất nguồn thức ăn của thiên địch.',
    points: 1.0
  },

  // --- PHẦN III: 6 CÂU TRẮC NGHIỆM TRẢ LỜI NGẮN (0.25đ/câu - 4 ký tự số) ---
  {
    id: 'q23',
    order: 23,
    partType: 'part3_short_answer',
    content: 'Một nông trại ứng dụng hệ thống châm phân tự động gồm 4 bồn chứa dinh dưỡng đa lượng và vi lượng. Hãy nhập mã hiệu kỹ thuật gồm 4 ký tự số mặc định (A.1234) để kích hoạt van an toàn điện tử:',
    shortAnswerCorrect: '1234',
    correctAnswer: '1234',
    explanation: 'Mã số kỹ thuật 4 ký tự mặc định là 1234 theo quy chuẩn Thông tư 7991.',
    points: 0.25
  },
  {
    id: 'q24',
    order: 24,
    partType: 'part3_short_answer',
    content: 'Trong công thức phối trộn phân NPK tỷ lệ 16-16-8 cho vườn bưởi da xanh giai đoạn nuôi trái, hãy nhập 4 chữ số biểu thị số lượng kilogram phân kali cần bón cho 10 hecta đất canh tác:',
    shortAnswerCorrect: '2400',
    correctAnswer: '2400',
    explanation: 'Đáp án số chuẩn 4 ký tự: 2400 kg.',
    points: 0.25
  },
  {
    id: 'q25',
    order: 25,
    partType: 'part3_short_answer',
    content: 'Một kỹ sư nông nghiệp cài đặt cảm biến độ ẩm đất trong nhà màng trồng dưa lưới. Khi độ ẩm tụt xuống mức bao nhiêu phần trăm (%) thì hệ thống van tưới tự động kích hoạt? (Nhập 4 chữ số biểu thị giá trị 65.00%):',
    shortAnswerCorrect: '6500',
    correctAnswer: '6500',
    explanation: 'Giá trị số 4 ký tự quy ước: 6500 (tương ứng mức ẩm ngưỡng 65.00%).',
    points: 0.25
  },
  {
    id: 'q26',
    order: 26,
    partType: 'part3_short_answer',
    content: 'Khi thiết lập chu kỳ chiếu sáng bổ sung bằng đèn LED quang hợp cho vườn thanh long trái vụ, tổng số giờ chiếu sáng liên tục trong 1 đêm là bao nhiêu? Hãy nhập dạng 4 chữ số (ví dụ 8 giờ thì nhập 0800):',
    shortAnswerCorrect: '0800',
    correctAnswer: '0800',
    explanation: 'Chu kỳ chiếu sáng bổ sung 8 giờ mỗi đêm được mã hóa 4 ký tự số: 0800.',
    points: 0.25
  },
  {
    id: 'q27',
    order: 27,
    partType: 'part3_short_answer',
    content: 'Nhiệt độ tối ưu để ủ hạt giống lúa nảy mầm đều và mạnh là khoảng 32 đến 35 độ C. Hãy nhập 4 ký tự số biểu thị mốc nhiệt độ trung bình 33.5 độ C theo mã số kỹ thuật:',
    shortAnswerCorrect: '0335',
    correctAnswer: '0335',
    explanation: 'Mã số 4 chữ số quy ước cho nhiệt độ 33.5°C là 0335.',
    points: 0.25
  },
  {
    id: 'q28',
    order: 28,
    partType: 'part3_short_answer',
    content: 'Mật độ gieo sạ lúa thuần năng suất cao theo phương pháp sạ hàng tại vùng đất phù sa màu mỡ là bao nhiêu kg giống trên 1 hecta? (Nhập 4 ký tự số biểu thị 100 kg/ha):',
    shortAnswerCorrect: '0100',
    correctAnswer: '0100',
    explanation: 'Mật độ sạ hàng tiết kiệm giống 100 kg/ha, ghi dạng 4 chữ số: 0100.',
    points: 0.25
  }
];

export const mockQuizzes: Quiz[] = [
  {
    id: 'quiz-cn12',
    title: 'ÔN CN12-1-2-3 (Đề chuẩn TT 7991)',
    fileName: 'ON_CN12-1-2-3.docx',
    subject: 'Công nghệ 12',
    grade: 'Lớp 12',
    createdAt: '21/01/2026',
    questionCount: 28,
    breakdown: '18-4-6-0',
    durationMinutes: 50,
    totalPoints: 10,
    folder: 'CÔNG NGHỆ 12',
    isInteractive: true,
    questions: sampleQuestions
  },
  {
    id: 'quiz-cn10',
    title: 'CHỦ ĐỀ 1 CN10 - CÔNG NGHỆ TRỒNG TRỌT',
    fileName: 'CHU_DE_1_CN10.docx',
    subject: 'Công nghệ 10',
    grade: 'Lớp 10',
    createdAt: '21/01/2026',
    questionCount: 28,
    breakdown: '18-4-6-0',
    durationMinutes: 45,
    totalPoints: 10,
    folder: 'CÔNG NGHỆ 10',
    isInteractive: true,
    questions: sampleQuestions
  },
  {
    id: 'quiz-sinh-2025',
    title: '2025_Sinh_THPT_MangThit.docx',
    fileName: '2025_Sinh.docx',
    subject: 'Sinh học 11',
    grade: 'Lớp 11',
    createdAt: '22/03/2026',
    questionCount: 28,
    breakdown: '18-4-6-0',
    durationMinutes: 50,
    totalPoints: 10,
    folder: 'SINH HỌC 11',
    isInteractive: false,
    questions: sampleQuestions
  },
  {
    id: 'quiz-trong-trot-1',
    title: 'CHỦ ĐỀ 1 GIỚI THIỆU CHUNG VỀ TRỒNG TRỌT.docx',
    fileName: 'CHU_DE_1_GIOI_THIEU_CHUNG_VE_TRONG_TROT.docx',
    subject: 'Công nghệ 12',
    grade: 'Lớp 12',
    createdAt: '07/10/2025',
    questionCount: 28,
    breakdown: '18-4-6-0',
    durationMinutes: 45,
    totalPoints: 10,
    folder: 'CÔNG NGHỆ 12',
    isInteractive: false,
    questions: sampleQuestions
  },
  {
    id: 'quiz-dat-trong-2',
    title: 'CHỦ ĐỀ 2 ĐẤT TRỒNG.docx',
    fileName: 'CHU_DE_2_DAT_TRONG.docx',
    subject: 'Công nghệ 12',
    grade: 'Lớp 12',
    createdAt: '07/10/2025',
    questionCount: 28,
    breakdown: '18-4-6-0',
    durationMinutes: 45,
    totalPoints: 10,
    folder: 'CÔNG NGHỆ 12',
    isInteractive: false,
    questions: sampleQuestions
  },
  {
    id: 'quiz-phan-bon-3',
    title: 'CHỦ ĐỀ 3 PHÂN BÓN.docx',
    fileName: 'CHU_DE_3_PHAN_BON.docx',
    subject: 'Công nghệ 12',
    grade: 'Lớp 12',
    createdAt: '28/10/2025',
    questionCount: 28,
    breakdown: '18-4-6-0',
    durationMinutes: 45,
    totalPoints: 10,
    folder: 'CÔNG NGHỆ 12',
    isInteractive: false,
    questions: sampleQuestions
  }
];

export const mockClassrooms: Classroom[] = [
  {
    id: 'class-cnnn',
    name: 'ÔN THI TỐT NGHIỆP CNNN',
    studentCount: 28,
    academicYear: '2025 - 2026',
    createdAt: '10/04/2026',
    code: 'CNNN25',
    teacherName: 'Thầy Hồ Tấn Khải',
    students: [
      { id: 'st-01', fullName: 'Huỳnh Văn An', studentCode: '25CN001', lastScore: 9.2, completedExams: 14 },
      { id: 'st-02', fullName: 'Trần Thị Mỹ Duyên', studentCode: '25CN002', lastScore: 10.0, completedExams: 15 },
      { id: 'st-03', fullName: 'Lê Hoàng Phúc', studentCode: '25CN003', lastScore: 8.5, completedExams: 13 },
      { id: 'st-04', fullName: 'Nguyễn Minh Trí', studentCode: '25CN004', lastScore: 9.0, completedExams: 14 },
      { id: 'st-05', fullName: 'Phạm Ngọc Thảo', studentCode: '25CN005', lastScore: 9.8, completedExams: 15 }
    ]
  },
  {
    id: 'class-cn12',
    name: 'ÔN THI TỐT NGHIỆP CÔNG NGHỆ 12',
    studentCount: 23,
    academicYear: '2024 - 2025',
    createdAt: '22/05/2025',
    code: 'CN12TN',
    teacherName: 'Thầy Hồ Tấn Khải',
    students: [
      { id: 'st-11', fullName: 'Võ Minh Quân', studentCode: '24CN011', lastScore: 9.5, completedExams: 18 },
      { id: 'st-12', fullName: 'Đỗ Thị Ánh Tuyết', studentCode: '24CN012', lastScore: 8.8, completedExams: 17 },
      { id: 'st-13', fullName: 'Bùi Gia Huy', studentCode: '24CN013', lastScore: 9.0, completedExams: 18 }
    ]
  },
  {
    id: 'class-12a5',
    name: 'LỚP 12A5 - THPT MANG THÍT',
    studentCount: 42,
    academicYear: '2025 - 2026',
    createdAt: '05/09/2025',
    code: '12A5MT',
    teacherName: 'Thầy Hồ Tấn Khải',
    students: [
      { id: 'st-21', fullName: 'Nguyễn Thành Nam', studentCode: '12A501', lastScore: 9.8, completedExams: 22 },
      { id: 'st-22', fullName: 'Lý Kim Ngân', studentCode: '12A502', lastScore: 10.0, completedExams: 22 },
      { id: 'st-23', fullName: 'Phan Quốc Bảo', studentCode: '12A503', lastScore: 9.2, completedExams: 21 }
    ]
  }
];

export const mockSessions: ExamSession[] = [
  {
    id: '4975878',
    title: 'ÔN CN12-1-2-3 (Đề chuẩn TT 7991)',
    quizId: 'quiz-cn12',
    className: 'Tất cả lớp học (Khối 12)',
    startTime: '20:37 27/10/2025',
    endTime: '20:37 27/07/2028',
    status: 'active',
    shareUrl: 'https://testonline.thptmangthit.edu.vn/online/?exam=4975878',
    allowedAttempts: 100,
    durationMinutes: 50,
    totalSubmissions: 312,
    maxSlots: 500,
    isArenaMode: true,
    questionCount: 28
  },
  {
    id: 'sess-chude-10',
    title: 'CHỦ ĐỀ 1 CN10 - CÔNG NGHỆ TRỒNG TRỌT',
    quizId: 'quiz-cn10',
    className: 'Không gắn lớp',
    startTime: '16:40 24/10/2025',
    endTime: '16:41 24/07/2027',
    status: 'active',
    shareUrl: 'https://testonline.thptmangthit.edu.vn/online/?exam=sess-chude-10',
    allowedAttempts: 5,
    durationMinutes: 45,
    totalSubmissions: 145,
    maxSlots: 500,
    isArenaMode: true,
    questionCount: 28
  },
  {
    id: 'sess-de-cuong-sinh',
    title: '2025_Sinh_THPT_MangThit.docx',
    quizId: 'quiz-sinh-2025',
    className: 'Khối 11 Tự Nhiên',
    startTime: '13:57:00 12/5/2026',
    endTime: '13:58:00 12/7/2027',
    status: 'active',
    shareUrl: 'https://testonline.thptmangthit.edu.vn/online/?exam=sess-de-cuong-sinh',
    allowedAttempts: 1,
    durationMinutes: 50,
    totalSubmissions: 189,
    maxSlots: 500,
    isArenaMode: false,
    questionCount: 28
  },
  {
    id: 'sess-on-tap-nn12',
    title: 'CHỦ ĐỀ 1 GIỚI THIỆU CHUNG VỀ TRỒNG TRỌT.docx',
    quizId: 'quiz-trong-trot-1',
    className: 'Khối 12',
    startTime: '14:32:00 24/4/2026',
    endTime: '14:32:00 24/6/2027',
    status: 'active',
    shareUrl: 'https://testonline.thptmangthit.edu.vn/online/?exam=sess-on-tap-nn12',
    allowedAttempts: 3,
    durationMinutes: 45,
    totalSubmissions: 240,
    maxSlots: 500,
    isArenaMode: false,
    questionCount: 28
  }
];
