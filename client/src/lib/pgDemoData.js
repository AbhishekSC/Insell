export const DEMO_PGS = [
  {
    _id: "demo-pg-001",
    title: "Sunshine PG for Men — Koramangala",
    city: "Bangalore",
    locality: "Koramangala",
    totalBeds: 40,
    availableBeds: 7,
    avgRating: 4.2,
    reviewCount: 23,
    residentCount: 33,
  },
];

export const DEMO_DASHBOARD = {
  pg: DEMO_PGS[0],
  vacancy: { totalBeds: 40, availableBeds: 7, occupiedBeds: 33, activeResidents: 33 },
  rentCollection: {
    totalBilled: 264000,
    totalCollected: 216000,
    pendingAmount: 48000,
    billCount: 33,
    unpaid: [
      { tenant: { fullName: "Rahul Mehta" }, amount: 8000 },
      { tenant: { fullName: "Arjun Nair" }, amount: 12000 },
      { tenant: { fullName: "Prateek Sharma" }, amount: 8000 },
      { tenant: { fullName: "Vikram Das" }, amount: 6000 },
      { tenant: { fullName: "Suresh Yadav" }, amount: 8000 },
      { tenant: { fullName: "Karthik R" }, amount: 6000 },
    ],
  },
  complaints: {
    stats: { open: 3, acknowledged: 1, in_progress: 2, resolved: 8, closed: 5, total: 19 },
    openIssues: [
      { _id: "d1", title: "WiFi not working in Room 204", category: "wifi", status: "open", priority: "high", createdAt: new Date(Date.now() - 86400000).toISOString() },
      { _id: "d2", title: "Water leakage in bathroom — Block B", category: "water", status: "acknowledged", priority: "urgent", createdAt: new Date(Date.now() - 172800000).toISOString() },
      { _id: "d3", title: "AC remote missing in Room 312", category: "maintenance", status: "in_progress", priority: "low", createdAt: new Date(Date.now() - 259200000).toISOString() },
      { _id: "d4", title: "Noisy generator at night", category: "noise", status: "open", priority: "medium", createdAt: new Date(Date.now() - 345600000).toISOString() },
      { _id: "d5", title: "Broken door lock — Room 108", category: "safety", status: "open", priority: "high", createdAt: new Date(Date.now() - 432000000).toISOString() },
      { _id: "d6", title: "Washing machine not draining", category: "maintenance", status: "in_progress", priority: "medium", createdAt: new Date(Date.now() - 518400000).toISOString() },
    ],
  },
  ratings: {
    avgOverall: 4.2,
    avgFood: 3.8,
    avgCleanliness: 4.5,
    avgWifi: 3.2,
    avgWater: 4.0,
    avgSafety: 4.6,
    avgLandlord: 3.9,
    avgValue: 4.1,
    avgLocation: 4.8,
    reviewCount: 23,
  },
  foodRatings: [
    { _id: "breakfast", avgRating: 3.6, count: 89 },
    { _id: "lunch", avgRating: 4.0, count: 85 },
    { _id: "dinner", avgRating: 3.9, count: 91 },
    { _id: "snacks", avgRating: 3.2, count: 42 },
  ],
  pendingDeposits: [
    { _id: "pd1", tenant: { fullName: "Anil Kumar", phone: "9876543210" }, depositAmount: 16000, depositDueDate: new Date(Date.now() + 604800000).toISOString() },
    { _id: "pd2", tenant: { fullName: "Deepak Joshi", phone: "9123456789" }, depositAmount: 12000, depositDueDate: new Date(Date.now() + 259200000).toISOString() },
  ],
  moveActivity: { moveIns: 4, moveOuts: 2 },
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
};

export const DEMO_RESIDENCY = {
  _id: "demo-res-001",
  pg: {
    _id: "demo-pg-001",
    title: "Sunshine PG for Men — Koramangala",
    locality: "Koramangala",
    city: "Bangalore",
  },
  status: "active",
  roomType: "Double Sharing",
  monthlyRent: 8000,
  depositAmount: 16000,
  moveInDate: new Date(Date.now() - 90 * 86400000).toISOString(),
  depositRefunded: false,
};

export const DEMO_BILLS = [
  {
    _id: "db1",
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    totalAmount: 9200,
    paid: false,
    items: [
      { label: "Room Rent", amount: 8000 },
      { label: "Electricity", amount: 450 },
      { label: "Laundry", amount: 300 },
      { label: "Common Area Maintenance", amount: 450 },
    ],
    electricityUnits: 45,
    electricityPerUnit: 10,
    splitMethod: "equal",
  },
  {
    _id: "db2",
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
    totalAmount: 8850,
    paid: true,
    items: [
      { label: "Room Rent", amount: 8000 },
      { label: "Electricity", amount: 350 },
      { label: "Laundry", amount: 300 },
      { label: "Common Area Maintenance", amount: 200 },
    ],
    electricityUnits: 35,
    electricityPerUnit: 10,
    splitMethod: "equal",
  },
  {
    _id: "db3",
    month: Math.max(new Date().getMonth() - 1, 1),
    year: new Date().getFullYear(),
    totalAmount: 8600,
    paid: true,
    items: [
      { label: "Room Rent", amount: 8000 },
      { label: "Electricity", amount: 300 },
      { label: "Laundry", amount: 300 },
    ],
  },
];

export const DEMO_ISSUES = [
  { _id: "di1", title: "WiFi speed drops after 10 PM", category: "wifi", status: "acknowledged", priority: "medium", createdAt: new Date(Date.now() - 86400000).toISOString(), ownerResponse: "Upgrading router this weekend" },
  { _id: "di2", title: "Hot water not available in morning", category: "water", status: "open", priority: "high", createdAt: new Date(Date.now() - 172800000).toISOString() },
  { _id: "di3", title: "Ceiling fan making noise", category: "maintenance", status: "resolved", priority: "low", createdAt: new Date(Date.now() - 604800000).toISOString() },
];

export const DEMO_DAILY_MEALS = {
  ratings: [
    { mealType: "breakfast", rating: 4 },
  ],
};
