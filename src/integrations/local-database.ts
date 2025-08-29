import { Customer, Product, Repair, Log } from '../types/sanden.js';

// Hardcoded database data from database.txt
const CUSTOMERS_DATA: Customer[] = [
  {
    customerId: "CUST001",
    companyName: "ファミリーマート お台場店",
    email: "contact@fam-odaiba.jp",
    phone: "03-1234-5678",
    location: "東京都・お台場"
  },
  {
    customerId: "CUST002",
    companyName: "ドン・キホーテ 渋谷店",
    email: "repair@donki-shibuya.jp",
    phone: "03-8765-4321",
    location: "東京都・渋谷"
  },
  {
    customerId: "CUST003",
    companyName: "ウエルシア 川崎駅前店",
    email: "support@welcia-k.jp",
    phone: "044-1122-3344",
    location: "神奈川県・川崎"
  },
  {
    customerId: "CUST004",
    companyName: "セブンイレブン 秋葉原店",
    email: "support@7aki.jp",
    phone: "03-3322-4455",
    location: "東京都・秋葉原"
  },
  {
    customerId: "CUST005",
    companyName: "ローソン 札幌駅前店",
    email: "lawson-support@sapporo.jp",
    phone: "011-222-3333",
    location: "北海道・札幌"
  },
  {
    customerId: "CUST006",
    companyName: "イオンモール 津田沼店",
    email: "info@aeon-tsudanuma.jp",
    phone: "047-334-5566",
    location: "千葉県・津田沼"
  },
  {
    customerId: "CUST007",
    companyName: "ヤマダ電機 梅田本店",
    email: "help@yamada-umeda.jp",
    phone: "06-7890-1234",
    location: "大阪府・梅田"
  },
  {
    customerId: "CUST008",
    companyName: "マツモトキヨシ 千葉中央店",
    email: "repairs@mk-chiba.jp",
    phone: "043-223-1122",
    location: "千葉県・千葉中央"
  },
  {
    customerId: "CUST009",
    companyName: "ココカラファイン 横浜西口店",
    email: "service@coco-yokohama.jp",
    phone: "045-998-7766",
    location: "神奈川県・横浜"
  },
  {
    customerId: "CUST010",
    companyName: "デイリーヤマザキ 京都駅前店",
    email: "yamazaki@kyoto.jp",
    phone: "075-777-8899",
    location: "京都府・京都駅"
  }
];

const PRODUCTS_DATA: Product[] = [
  {
    productId: "PROD001",
    customerId: "CUST001",
    category: "コーヒーマシン",
    model: "CM-400F",
    serialNumber: "SN400123",
    warrantyStatus: "有効"
  },
  {
    productId: "PROD002",
    customerId: "CUST002",
    category: "自動販売機",
    model: "VM-230J",
    serialNumber: "SN230999",
    warrantyStatus: "保証切れ"
  },
  {
    productId: "PROD003",
    customerId: "CUST003",
    category: "冷蔵ショーケース",
    model: "RS-1020K",
    serialNumber: "SN102077",
    warrantyStatus: "有効"
  },
  {
    productId: "PROD004",
    customerId: "CUST004",
    category: "自動販売機",
    model: "VM-300X",
    serialNumber: "SN300456",
    warrantyStatus: "有効"
  },
  {
    productId: "PROD005",
    customerId: "CUST005",
    category: "コーヒーマシン",
    model: "CM-500G",
    serialNumber: "SN500888",
    warrantyStatus: "有効"
  },
  {
    productId: "PROD006",
    customerId: "CUST006",
    category: "冷蔵ショーケース",
    model: "RS-1030L",
    serialNumber: "SN103045",
    warrantyStatus: "保証切れ"
  },
  {
    productId: "PROD007",
    customerId: "CUST007",
    category: "スナック販売機",
    model: "SVM-180A",
    serialNumber: "SNS180001",
    warrantyStatus: "有効"
  },
  {
    productId: "PROD008",
    customerId: "CUST008",
    category: "アイスクリームディスペンサー",
    model: "IC-777",
    serialNumber: "SNIC77777",
    warrantyStatus: "有効"
  },
  {
    productId: "PROD009",
    customerId: "CUST009",
    category: "ホットドリンクディスペンサー",
    model: "HBD-90B",
    serialNumber: "SNHBD123",
    warrantyStatus: "保証切れ"
  },
  {
    productId: "PROD010",
    customerId: "CUST010",
    category: "小型自販機",
    model: "CVU-45T",
    serialNumber: "SNCVU009",
    warrantyStatus: "有効"
  }
];

const REPAIRS_DATA: Repair[] = [
  {
    repairId: "REP100",
    date: "2025-08-01 0:00",
    productId: "PROD003",
    customerId: "CUST001",
    problem: "画面が表示されない",
    status: "解決済み",
    visitRequired: "Yes",
    priority: "高",
    assignedTo: "AI"
  },
  {
    repairId: "REP101",
    date: "2025-08-02 00:00",
    productId: "PROD003",
    customerId: "CUST003",
    problem: "コインが詰まる",
    status: "未対応",
    visitRequired: "要",
    priority: "中",
    assignedTo: "渡辺"
  },
  {
    repairId: "REP102",
    date: "2025-08-03 00:00",
    productId: "PROD001",
    customerId: "CUST002",
    problem: "コインが詰まる",
    status: "未対応",
    visitRequired: "要",
    priority: "中",
    assignedTo: "山本"
  },
  {
    repairId: "REP103",
    date: "2025-08-04 00:00",
    productId: "PROD002",
    customerId: "CUST003",
    problem: "水漏れがある",
    status: "解決済み",
    visitRequired: "不要",
    priority: "低",
    assignedTo: "田中"
  },
  {
    repairId: "REP104",
    date: "2025-08-05 00:00",
    productId: "PROD002",
    customerId: "CUST003",
    problem: "コインが詰まる",
    status: "解決済み",
    visitRequired: "不要",
    priority: "低",
    assignedTo: "渡辺"
  },
  {
    repairId: "REP105",
    date: "2025-08-06 00:00",
    productId: "PROD003",
    customerId: "CUST003",
    problem: "水漏れがある",
    status: "対応中",
    visitRequired: "要",
    priority: "低",
    assignedTo: "鈴木"
  },
  {
    repairId: "REP106",
    date: "2025-08-07 00:00",
    productId: "PROD003",
    customerId: "CUST001",
    problem: "冷却が機能しない",
    status: "対応中",
    visitRequired: "要",
    priority: "高",
    assignedTo: "山本"
  },
  {
    repairId: "REP107",
    date: "2025-08-08 00:00",
    productId: "PROD003",
    customerId: "CUST001",
    problem: "水漏れがある",
    status: "解決済み",
    visitRequired: "不要",
    priority: "中",
    assignedTo: "佐藤"
  },
  {
    repairId: "REP108",
    date: "2025-08-09 00:00",
    productId: "PROD002",
    customerId: "CUST002",
    problem: "画面が表示されない",
    status: "対応中",
    visitRequired: "要",
    priority: "高",
    assignedTo: "佐藤"
  },
  {
    repairId: "REP109",
    date: "2025-08-10 00:00",
    productId: "PROD002",
    customerId: "CUST001",
    problem: "画面が表示されない",
    status: "対応中",
    visitRequired: "要",
    priority: "低",
    assignedTo: "山本"
  },
  {
    repairId: "REP110",
    date: "2025-08-11 00:00",
    productId: "PROD003",
    customerId: "CUST002",
    problem: "冷却が機能しない",
    status: "対応中",
    visitRequired: "要",
    priority: "高",
    assignedTo: "渡辺"
  },
  {
    repairId: "REP111",
    date: "2025-08-12 00:00",
    productId: "PROD003",
    customerId: "CUST002",
    problem: "画面が表示されない",
    status: "対応中",
    visitRequired: "要",
    priority: "低",
    assignedTo: "田中"
  },
  {
    repairId: "REP112",
    date: "2025-08-13 00:00",
    productId: "PROD001",
    customerId: "CUST001",
    problem: "コインが詰まる",
    status: "未対応",
    visitRequired: "不要",
    priority: "低",
    assignedTo: "田中"
  },
  {
    repairId: "REP113",
    date: "2025-08-14 00:00",
    productId: "PROD001",
    customerId: "CUST002",
    problem: "冷却が機能しない",
    status: "解決済み",
    visitRequired: "要",
    priority: "中",
    assignedTo: "山本"
  },
  {
    repairId: "REP114",
    date: "2025-08-15 00:00",
    productId: "PROD001",
    customerId: "CUST003",
    problem: "コーヒーが出ない",
    status: "未対応",
    visitRequired: "要",
    priority: "低",
    assignedTo: "佐藤"
  },
  {
    repairId: "REP115",
    date: "2025-08-16 00:00",
    productId: "PROD003",
    customerId: "CUST001",
    problem: "画面が表示されない",
    status: "解決済み",
    visitRequired: "要",
    priority: "中",
    assignedTo: "田中"
  },
  {
    repairId: "REP116",
    date: "2025-08-17 00:00",
    productId: "PROD002",
    customerId: "CUST002",
    problem: "水漏れがある",
    status: "解決済み",
    visitRequired: "要",
    priority: "高",
    assignedTo: "田中"
  },
  {
    repairId: "REP117",
    date: "2025-08-18 00:00",
    productId: "PROD001",
    customerId: "CUST003",
    problem: "画面が表示されない",
    status: "対応中",
    visitRequired: "要",
    priority: "高",
    assignedTo: "佐藤"
  },
  {
    repairId: "REP118",
    date: "2025-08-19 00:00",
    productId: "PROD002",
    customerId: "CUST002",
    problem: "冷却が機能しない",
    status: "未対応",
    visitRequired: "要",
    priority: "中",
    assignedTo: "渡辺"
  }
];

export class LocalDatabaseService {
  // Customer lookup by any of the three details
  static lookupCustomerByDetails(phone?: string, email?: string, companyName?: string): Customer | null {
    console.log(`🔍 Local DB lookup: phone=${phone}, email=${email}, company=${companyName}`);
    
    const foundCustomer = CUSTOMERS_DATA.find(customer => {
      if (phone && customer.phone === phone) return true;
      if (email && customer.email === email) return true;
      if (companyName && customer.companyName === companyName) return true;
      return false;
    });

    if (foundCustomer) {
      console.log(`✅ Local DB found customer: ${foundCustomer.customerId}`);
      return foundCustomer;
    }

    console.log(`❌ Local DB no customer found`);
    return null;
  }

  // Get customer by ID
  static getCustomerById(customerId: string): Customer | null {
    return CUSTOMERS_DATA.find(c => c.customerId === customerId) || null;
  }

  // Get products by customer ID
  static getProductsByCustomerId(customerId: string): Product[] {
    return PRODUCTS_DATA.filter(p => p.customerId === customerId);
  }

  // Get repairs by customer ID
  static getRepairsByCustomerId(customerId: string): Repair[] {
    return REPAIRS_DATA.filter(r => r.customerId === customerId);
  }

  // Get repair by ID
  static getRepairById(repairId: string): Repair | null {
    return REPAIRS_DATA.find(r => r.repairId === repairId) || null;
  }

  // Create new log entry (simulate adding to logs)
  static createLogEntry(data: {
    customerId: string;
    companyName: string;
    email: string;
    phone: string;
    location: string;
    productId?: string;
    productCategory?: string;
    model?: string;
    serialNumber?: string;
    warrantyStatus?: string;
    repairId?: string;
    date: string;
    problem?: string;
    status?: string;
    visitRequired?: string;
    priority?: string;
    assignedTo?: string;
    notes?: string;
    contactName?: string;
    preferredDate?: string;
    machine?: string;
  }): { success: boolean; logId: string; message: string } {
    // Generate a new log ID
    const logId = `LOG${Date.now()}`;
    
    console.log(`📝 Local DB creating log entry: ${logId}`, data);
    
    // In a real system, this would be saved to the database
    // For now, we just return success
    return {
      success: true,
      logId,
      message: "ログエントリが正常に作成されました"
    };
  }

  // Get all customers (for testing)
  static getAllCustomers(): Customer[] {
    return CUSTOMERS_DATA;
  }

  // Get all products (for testing)
  static getAllProducts(): Product[] {
    return PRODUCTS_DATA;
  }

  // Get all repairs (for testing)
  static getAllRepairs(): Repair[] {
    return REPAIRS_DATA;
  }
}
