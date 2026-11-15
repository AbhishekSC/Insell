import PGBill from "../../models/PGBill.model.js";

export async function create(data) {
  return PGBill.create(data);
}

export async function findByTenant(tenantId, { page = 1, limit = 12, year } = {}) {
  const filter = { tenant: tenantId };
  if (year) filter.year = year;

  const skip = (page - 1) * limit;
  const [bills, total] = await Promise.all([
    PGBill.find(filter).sort({ year: -1, month: -1 }).skip(skip).limit(limit).lean(),
    PGBill.countDocuments(filter),
  ]);
  return { bills, total };
}

export async function findByPg(pgId, month, year) {
  return PGBill.find({ pg: pgId, month, year })
    .populate("tenant", "fullName profilePic")
    .sort({ tenant: 1 })
    .lean();
}

export async function findById(billId) {
  return PGBill.findById(billId)
    .populate("tenant", "fullName profilePic")
    .lean();
}

export async function markPaid(billId) {
  return PGBill.findByIdAndUpdate(billId, { paid: true, paidAt: new Date() }, { new: true }).lean();
}

export async function getMonthlyComparison(tenantId, pgId, currentMonth, currentYear) {
  let prevMonth = currentMonth - 1;
  let prevYear = currentYear;
  if (prevMonth === 0) { prevMonth = 12; prevYear -= 1; }

  const [current, previous] = await Promise.all([
    PGBill.findOne({ tenant: tenantId, pg: pgId, month: currentMonth, year: currentYear }).lean(),
    PGBill.findOne({ tenant: tenantId, pg: pgId, month: prevMonth, year: prevYear }).lean(),
  ]);
  return { current, previous };
}

export async function getBillSummaryForPg(pgId, month, year) {
  const [result] = await PGBill.aggregate([
    { $match: { pg: pgId, month, year } },
    {
      $group: {
        _id: null,
        totalBilled: { $sum: "$totalAmount" },
        totalPaid: { $sum: { $cond: ["$paid", "$totalAmount", 0] } },
        totalPending: { $sum: { $cond: ["$paid", 0, "$totalAmount"] } },
        tenantCount: { $sum: 1 },
        paidCount: { $sum: { $cond: ["$paid", 1, 0] } },
      },
    },
  ]);
  return result || { totalBilled: 0, totalPaid: 0, totalPending: 0, tenantCount: 0, paidCount: 0 };
}
