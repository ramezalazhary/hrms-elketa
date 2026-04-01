/**
 * @file Egyptian Governorates and their major Cities.
 * Used by both backend validation and frontend dropdowns.
 * Only Egyptian administrative divisions are supported.
 */
export const EGYPT_GOVERNORATES = [
  {
    name: "Cairo",
    nameAr: "القاهرة",
    cities: ["Nasr City", "Heliopolis", "Maadi", "New Cairo", "Zamalek", "Downtown", "Shubra"],
  },
  {
    name: "Giza",
    nameAr: "الجيزة",
    cities: ["Giza", "6th of October", "Sheikh Zayed", "Dokki", "Mohandessin", "Haram", "Faisal"],
  },
  {
    name: "Alexandria",
    nameAr: "الإسكندرية",
    cities: ["Sidi Gaber", "Smouha", "Mandara", "Montazah", "Raml Station", "Agami", "Borg El Arab"],
  },
  {
    name: "Dakahlia",
    nameAr: "الدقهلية",
    cities: ["Mansoura", "Talkha", "Mit Ghamr", "Aga", "Belqas", "Sherbin", "Dikirnis"],
  },
  {
    name: "Sharqia",
    nameAr: "الشرقية",
    cities: ["Zagazig", "10th of Ramadan", "Bilbeis", "Abu Hammad", "Minya El Qamh", "Faqous"],
  },
  {
    name: "Qalyubia",
    nameAr: "القليوبية",
    cities: ["Banha", "Shubra El Kheima", "Qalyub", "El Khanka", "Obour", "Toukh"],
  },
  {
    name: "Gharbia",
    nameAr: "الغربية",
    cities: ["Tanta", "El Mahalla El Kubra", "Kafr El Zayat", "Zefta", "Samanoud", "Basyoun"],
  },
  {
    name: "Monufia",
    nameAr: "المنوفية",
    cities: ["Shibin El Kom", "Menouf", "Sadat City", "Ashmoun", "Quesna", "Tala", "Berket El Sab"],
  },
  {
    name: "Beheira",
    nameAr: "البحيرة",
    cities: ["Damanhour", "Kafr El Dawwar", "Rashid", "Edku", "Itay El Barud", "Hosh Issa"],
  },
  {
    name: "Kafr El Sheikh",
    nameAr: "كفر الشيخ",
    cities: ["Kafr El Sheikh", "Desouk", "Baltim", "Fuwwah", "Sidi Salem", "Qallin"],
  },
  {
    name: "Damietta",
    nameAr: "دمياط",
    cities: ["Damietta", "New Damietta", "Ras El Bar", "Faraskour", "Kafr Saad"],
  },
  {
    name: "Port Said",
    nameAr: "بورسعيد",
    cities: ["Port Said", "Port Fouad", "El Arab", "El Zohour"],
  },
  {
    name: "Ismailia",
    nameAr: "الإسماعيلية",
    cities: ["Ismailia", "Fayed", "El Qantara", "Abu Sultan", "El Tal El Kebir"],
  },
  {
    name: "Suez",
    nameAr: "السويس",
    cities: ["Suez", "Ain Sokhna", "El Arbaeen", "Ataka", "El Ganayen"],
  },
  {
    name: "North Sinai",
    nameAr: "شمال سيناء",
    cities: ["El Arish", "Rafah", "Sheikh Zuweid", "Bir El Abd", "Nakhl"],
  },
  {
    name: "South Sinai",
    nameAr: "جنوب سيناء",
    cities: ["Sharm El Sheikh", "Dahab", "Nuweiba", "Taba", "Saint Catherine", "El Tor"],
  },
  {
    name: "Beni Suef",
    nameAr: "بني سويف",
    cities: ["Beni Suef", "El Wasta", "Nasser", "Beba", "El Fashn", "Sumasta"],
  },
  {
    name: "Fayoum",
    nameAr: "الفيوم",
    cities: ["Fayoum", "Ibshway", "Tamia", "Senouris", "Etsa", "Youssef El Sedigq"],
  },
  {
    name: "Minya",
    nameAr: "المنيا",
    cities: ["Minya", "Mallawi", "Beni Mazar", "Samalut", "Abu Qurqas", "Matai"],
  },
  {
    name: "Asyut",
    nameAr: "أسيوط",
    cities: ["Asyut", "Dairut", "Manfalut", "El Qusiya", "Abu Tig", "Abnoub"],
  },
  {
    name: "Sohag",
    nameAr: "سوهاج",
    cities: ["Sohag", "Akhmim", "Girga", "El Maragha", "Tahta", "El Balyana"],
  },
  {
    name: "Qena",
    nameAr: "قنا",
    cities: ["Qena", "Nag Hammadi", "Qus", "Dishna", "Abu Tesht", "Farshut"],
  },
  {
    name: "Luxor",
    nameAr: "الأقصر",
    cities: ["Luxor", "Esna", "Armant", "El Toud", "El Qurna"],
  },
  {
    name: "Aswan",
    nameAr: "أسوان",
    cities: ["Aswan", "Edfu", "Kom Ombo", "Daraw", "Abu Simbel", "Nasr El Nuba"],
  },
  {
    name: "Red Sea",
    nameAr: "البحر الأحمر",
    cities: ["Hurghada", "Safaga", "El Qusair", "Marsa Alam", "Ras Ghareb", "Halayeb"],
  },
  {
    name: "New Valley",
    nameAr: "الوادي الجديد",
    cities: ["Kharga", "Dakhla", "Farafra", "Paris", "Baris"],
  },
  {
    name: "Matruh",
    nameAr: "مطروح",
    cities: ["Marsa Matruh", "El Alamein", "Siwa", "El Dabaa", "El Salloum", "El Negila"],
  },
];

/**
 * Get cities for a given governorate name.
 * @param {string} governorate
 * @returns {string[]}
 */
export function getCitiesForGovernorate(governorate) {
  const gov = EGYPT_GOVERNORATES.find(
    (g) => g.name.toLowerCase() === governorate?.toLowerCase()
  );
  return gov?.cities || [];
}
