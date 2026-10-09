export interface Phrase {
  category: 'dining' | 'transport' | 'shopping' | 'emergency';
  vietnamese: string;
  original: string;
  phonetic: string;
  langCode: string;
  note?: string;
}

export const TRAVEL_PHRASEBOOK: Record<string, Phrase[]> = {
  ja: [
    {
      category: 'dining',
      vietnamese: 'Cho tôi xin một phần này (vừa chỉ tay vào menu)',
      original: 'これをお願いします (Kore o onegaishimasu)',
      phonetic: 'Cô-rê ô ô-nê-gai-xi-ma-xự',
      langCode: 'ja',
      note: 'Dùng khi chọn món ăn chỉ tay vào menu',
    },
    {
      category: 'dining',
      vietnamese: 'Món này có thịt heo không?',
      original: '豚肉は入っていますか？ (Butaniku wa haitte imasuka?)',
      phonetic: 'Bư-ta-ni-kư oa hai-tê i-ma-xự-ka?',
      langCode: 'ja',
      note: 'Hỏi về thành phần dị ứng thịt heo',
    },
    {
      category: 'dining',
      vietnamese: 'Làm ơn tính tiền giúp tôi',
      original: 'お会計をお願いします (O-kaikei o onegaishimasu)',
      phonetic: 'Ô-kai-kê ô ô-nê-gai-xi-ma-xự',
      langCode: 'ja',
    },
    {
      category: 'transport',
      vietnamese: 'Nhà ga ở đâu vậy ạ?',
      original: '駅はどこですか？ (Eki wa doko desu ka?)',
      phonetic: 'Ê-ki oa đô-cô đê-xự-ka?',
      langCode: 'ja',
    },
    {
      category: 'transport',
      vietnamese: 'Tàu này có đến Shinjuku không?',
      original: 'この電車は新宿に行きますか？ (Kono densha wa Shinjuku ni ikimasuka?)',
      phonetic: 'Cô-nô đen-sa oa Sin-ju-ku ni i-ki-ma-xự-ka?',
      langCode: 'ja',
    },
    {
      category: 'shopping',
      vietnamese: 'Cái này giá bao nhiêu tiền?',
      original: 'いくらですか？ (Ikura desu ka?)',
      phonetic: 'I-cư-ra đê-xự-ka?',
      langCode: 'ja',
    },
    {
      category: 'emergency',
      vietnamese: 'Làm ơn giúp tôi với!',
      original: '助けてください！ (Tasukete kudasai!)',
      phonetic: 'Ta-xự-kê-tê cư-đa-sai!',
      langCode: 'ja',
    },
  ],
  ko: [
    {
      category: 'dining',
      vietnamese: 'Cho tôi xin món này nhé',
      original: '이거 주세요 (Igeo juseyo)',
      phonetic: 'I-gơ chu-sê-yô',
      langCode: 'ko',
    },
    {
      category: 'dining',
      vietnamese: 'Món này có cay lắm không?',
      original: '이거 많이 매워요? (Igeo mani maewoyo?)',
      phonetic: 'I-gơ ma-ni mê-uô-yô?',
      langCode: 'ko',
    },
    {
      category: 'dining',
      vietnamese: 'Làm ơn tính tiền giúp tôi',
      original: '계산해 주세요 (Gyesanhae juseyo)',
      phonetic: 'Kiê-xan-hê chu-sê-yô',
      langCode: 'ko',
    },
    {
      category: 'transport',
      vietnamese: 'Trạm tàu điện ngầm ở đâu vậy?',
      original: '지하철역이 어디예요? (Jihacheol-yeogi eodiyeyo?)',
      phonetic: 'Chi-ha-chơn-di-ơ-ki o-đi-yê-yô?',
      langCode: 'ko',
    },
    {
      category: 'shopping',
      vietnamese: 'Cái này bao nhiêu tiền ạ?',
      original: '얼마예요? (Eolmayeyo?)',
      phonetic: 'Ơn-ma-yê-yô?',
      langCode: 'ko',
    },
    {
      category: 'emergency',
      vietnamese: 'Xin giúp tôi với!',
      original: '도와주세요! (Dowajuseyo!)',
      phonetic: 'Đô-oa-chu-sê-yô!',
      langCode: 'ko',
    },
  ],
  th: [
    {
      category: 'dining',
      vietnamese: 'Xin đừng cho cay nhé',
      original: 'ไม่เผ็ด (Mai phet)',
      phonetic: 'Mài phệt',
      langCode: 'th',
      note: 'Rất cần thiết khi đi Thái Lan',
    },
    {
      category: 'dining',
      vietnamese: 'Cho tôi gọi món này',
      original: 'เอาอันนี้ (Ao an ni)',
      phonetic: 'Au an ní',
      langCode: 'th',
    },
    {
      category: 'dining',
      vietnamese: 'Tính tiền giùm tôi',
      original: 'เช็คบิลด้วย (Check bill duay)',
      phonetic: 'Chếch bin đuôi',
      langCode: 'th',
    },
    {
      category: 'transport',
      vietnamese: 'Đi trạm BTS này bao nhiêu tiền?',
      original: 'ไปสถานีนี้เท่าไหร่ (Pai sathani ni thao rai)',
      phonetic: 'Pay sa-tha-ni ní thao rày',
      langCode: 'th',
    },
    {
      category: 'emergency',
      vietnamese: 'Cứu tôi với!',
      original: 'ช่วยด้วย (Chuay duay)',
      phonetic: 'Chuôi đuôi',
      langCode: 'th',
    },
  ],
  en: [
    {
      category: 'dining',
      vietnamese: 'Cho tôi xin gọi món này',
      original: 'Could I have this one, please?',
      phonetic: 'Kút ai he-v đít-s oăn, pờ-li-x',
      langCode: 'en',
    },
    {
      category: 'dining',
      vietnamese: 'Món này có thành phần gì dị ứng không?',
      original: 'Does this dish contain any allergens like nuts or dairy?',
      phonetic: 'Đơ-z đít-s đít-x con-ten...',
      langCode: 'en',
    },
    {
      category: 'dining',
      vietnamese: 'Cho tôi xin hóa đơn tính tiền',
      original: 'Can I have the check/bill, please?',
      phonetic: 'Khen ai he-v đờ bâu, pờ-li-x',
      langCode: 'en',
    },
    {
      category: 'transport',
      vietnamese: 'Làm ơn cho tôi hỏi đường đến ga tàu',
      original: 'Excuse me, which way to the train station?',
      phonetic: 'Éc-x-kiu-z mi, goít-ch uây...',
      langCode: 'en',
    },
    {
      category: 'emergency',
      vietnamese: 'Tôi cần sự giúp đỡ y tế!',
      original: 'I need medical help, please!',
      phonetic: 'Ai nít-đ mế-đi-cồ heo-p, pờ-li-x!',
      langCode: 'en',
    },
  ],
};
