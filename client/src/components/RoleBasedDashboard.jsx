import { Home, TrendingUp, Users, Building2, Star, Eye, MessageCircle, Calendar, Clock, ArrowUpRight, ArrowDownRight, Target, Zap, Award, CheckCircle, AlertCircle, Plus, Settings, Bell, BarChart3, Briefcase, Key, Heart, MapPin, IndianRupee, Send, Search, FileText, Sparkles } from "lucide-react";

const ROLE_DASHBOARD_CONFIGS = {
  Tenant: {
    widgets: [
      {
        id: "saved_homes",
        title: "Saved Homes",
        icon: Heart,
        value: "32",
        hint: "7 new matches this week",
        trend: "+12%",
        trendUp: true,
        color: "rose"
      },
      {
        id: "scheduled_visits",
        title: "Scheduled Visits",
        icon: Calendar,
        value: "3",
        hint: "Next: Tomorrow at 11 AM",
        trend: "",
        color: "blue"
      },
      {
        id: "applications",
        title: "Applications Sent",
        icon: Send,
        value: "8",
        hint: "2 pending responses",
        trend: "+25%",
        trendUp: true,
        color: "emerald"
      },
      {
        id: "price_alerts",
        title: "Price Drops",
        icon: ArrowDownRight,
        value: "5",
        hint: "Properties in your budget",
        trend: "",
        color: "amber"
      }
    ],
    quickActions: [
      { label: "Search Rentals", icon: Search, primary: true },
      { label: "Schedule Visit", icon: Calendar },
      { label: "My Applications", icon: FileText },
      { label: "Saved Homes", icon: Heart }
    ],
    sections: [
      {
        title: "Recommended for You",
        icon: Sparkles,
        type: "property_grid"
      },
      {
        title: "New in Your Area",
        icon: MapPin,
        type: "property_list"
      },
      {
        title: "Price Drop Alerts",
        icon: ArrowDownRight,
        type: "alert_list"
      }
    ]
  },
  Buyer: {
    widgets: [
      {
        id: "saved_properties",
        title: "Saved Properties",
        icon: Heart,
        value: "24",
        hint: "3 price drops this week",
        trend: "+8%",
        trendUp: true,
        color: "rose"
      },
      {
        id: "viewed_properties",
        title: "Recently Viewed",
        icon: Eye,
        value: "18",
        hint: "Across 4 cities",
        trend: "",
        color: "blue"
      },
      {
        id: "search_alerts",
        title: "Search Alerts",
        icon: Bell,
        value: "12",
        hint: "5 new matches today",
        trend: "+15%",
        trendUp: true,
        color: "amber"
      },
      {
        id: "scheduled_visits",
        title: "Upcoming Visits",
        icon: Calendar,
        value: "2",
        hint: "This weekend",
        trend: "",
        color: "emerald"
      }
    ],
    quickActions: [
      { label: "Search Properties", icon: Search, primary: true },
      { label: "Get Loan Approval", icon: Briefcase },
      { label: "Schedule Visit", icon: Calendar },
      { label: "Saved Properties", icon: Heart }
    ],
    sections: [
      {
        title: "Personalized Recommendations",
        icon: Sparkles,
        type: "property_grid"
      },
      {
        title: "Price Drops in Watchlist",
        icon: ArrowDownRight,
        type: "property_list"
      },
      {
        title: "Market Insights",
        icon: TrendingUp,
        type: "market_insights"
      }
    ]
  },
  Seller: {
    widgets: [
      {
        id: "listing_views",
        title: "Listing Views",
        icon: Eye,
        value: "8.2K",
        hint: "+14% this week",
        trend: "+14%",
        trendUp: true,
        color: "blue"
      },
      {
        id: "inquiries",
        title: "Total Inquiries",
        icon: MessageCircle,
        value: "126",
        hint: "22 new today",
        trend: "+18%",
        trendUp: true,
        color: "emerald"
      },
      {
        id: "scheduled_visits",
        title: "Scheduled Visits",
        icon: Calendar,
        value: "18",
        hint: "6 upcoming this week",
        trend: "",
        color: "violet"
      },
      {
        id: "engagement_score",
        title: "Engagement Score",
        icon: Star,
        value: "8.5",
        hint: "Top 15% in your area",
        trend: "+5%",
        trendUp: true,
        color: "amber"
      }
    ],
    quickActions: [
      { label: "Create Listing", icon: Plus, primary: true },
      { label: "Manage Inquiries", icon: MessageCircle },
      { label: "Schedule Visits", icon: Calendar },
      { label: "Analytics", icon: BarChart3 }
    ],
    sections: [
      {
        title: "My Listings",
        icon: Building2,
        type: "property_list"
      },
      {
        title: "Recent Inquiries",
        icon: MessageCircle,
        type: "inquiry_list"
      },
      {
        title: "Performance Analytics",
        icon: BarChart3,
        type: "analytics"
      }
    ]
  },
  Broker: {
    widgets: [
      {
        id: "active_leads",
        title: "Active Leads",
        icon: Users,
        value: "94",
        hint: "12 high intent",
        trend: "+8%",
        trendUp: true,
        color: "emerald"
      },
      {
        id: "inventory",
        title: "Total Inventory",
        icon: Building2,
        value: "57",
        hint: "8 added this week",
        trend: "+12%",
        trendUp: true,
        color: "blue"
      },
      {
        id: "conversion_rate",
        title: "Conversion Rate",
        icon: Target,
        value: "21%",
        hint: "+2.3% MoM",
        trend: "+2.3%",
        trendUp: true,
        color: "violet"
      },
      {
        id: "revenue_this_month",
        title: "Revenue This Month",
        icon: IndianRupee,
        value: "₹4.2L",
        hint: "On track to exceed target",
        trend: "+15%",
        trendUp: true,
        color: "amber"
      }
    ],
    quickActions: [
      { label: "Add Property", icon: Plus, primary: true },
      { label: "View Leads", icon: Users },
      { label: "Manage Inventory", icon: Building2 },
      { label: "Analytics", icon: BarChart3 }
    ],
    sections: [
      {
        title: "High-Intent Leads",
        icon: Zap,
        type: "lead_list"
      },
      {
        title: "My Inventory",
        icon: Building2,
        type: "property_grid"
      },
      {
        title: "Market Opportunities",
        icon: TrendingUp,
        type: "market_opportunities"
      }
    ]
  },
  Builder: {
    widgets: [
      {
        id: "active_projects",
        title: "Active Projects",
        icon: Building2,
        value: "7",
        hint: "2 launching soon",
        trend: "",
        color: "indigo"
      },
      {
        id: "total_units",
        title: "Total Units",
        icon: Home,
        value: "1,247",
        hint: "856 sold, 391 available",
        trend: "+5%",
        trendUp: true,
        color: "blue"
      },
      {
        id: "bookings_this_month",
        title: "Bookings This Month",
        icon: CheckCircle,
        value: "43",
        hint: "₹12.8Cr revenue",
        trend: "+22%",
        trendUp: true,
        color: "emerald"
      },
      {
        id: "project_completion",
        title: "Avg Completion",
        icon: Clock,
        value: "78%",
        hint: "On schedule",
        trend: "+3%",
        trendUp: true,
        color: "amber"
      }
    ],
    quickActions: [
      { label: "New Project", icon: Plus, primary: true },
      { label: "Manage Projects", icon: Building2 },
      { label: "View Bookings", icon: CheckCircle },
      { label: "Analytics", icon: BarChart3 }
    ],
    sections: [
      {
        title: "My Projects",
        icon: Building2,
        type: "project_list"
      },
      {
        title: "Recent Bookings",
        icon: CheckCircle,
        type: "booking_list"
      },
      {
        title: "Project Analytics",
        icon: BarChart3,
        type: "analytics"
      }
    ]
  },
  Investor: {
    widgets: [
      {
        id: "portfolio_value",
        title: "Portfolio Value",
        icon: IndianRupee,
        value: "₹3.2Cr",
        hint: "+8.5% appreciation",
        trend: "+8.5%",
        trendUp: true,
        color: "emerald"
      },
      {
        id: "rental_income",
        title: "Monthly Rental Income",
        icon: TrendingUp,
        value: "₹1.8L",
        hint: "From 4 properties",
        trend: "+12%",
        trendUp: true,
        color: "blue"
      },
      {
        id: "roi",
        title: "Avg ROI",
        icon: Target,
        value: "12.4%",
        hint: "Above market average",
        trend: "+1.2%",
        trendUp: true,
        color: "violet"
      },
      {
        id: "opportunities",
        title: "New Opportunities",
        icon: Sparkles,
        value: "15",
        hint: "High-growth areas",
        trend: "",
        color: "amber"
      }
    ],
    quickActions: [
      { label: "Explore Investments", icon: Search, primary: true },
      { label: "My Portfolio", icon: Briefcase },
      { label: "Market Analysis", icon: BarChart3 },
      { label: "Set Alerts", icon: Bell }
    ],
    sections: [
      {
        title: "High-ROI Opportunities",
        icon: TrendingUp,
        type: "property_grid"
      },
      {
        title: "My Portfolio",
        icon: Briefcase,
        type: "portfolio_list"
      },
      {
        title: "Market Insights",
        icon: BarChart3,
        type: "market_insights"
      }
    ]
  }
};

const WIDGET_COLORS = {
  rose: { bg: "bg-rose-50", text: "text-rose-700", icon: "text-rose-600" },
  blue: { bg: "bg-blue-50", text: "text-blue-700", icon: "text-blue-600" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700", icon: "text-emerald-600" },
  amber: { bg: "bg-amber-50", text: "text-amber-700", icon: "text-amber-600" },
  violet: { bg: "bg-violet-50", text: "text-violet-700", icon: "text-violet-600" },
  indigo: { bg: "bg-indigo-50", text: "text-indigo-700", icon: "text-indigo-600" }
};

export default function RoleBasedDashboard({ userRole, userData }) {
  const role = userRole || "Buyer";
  const config = ROLE_DASHBOARD_CONFIGS[role] || ROLE_DASHBOARD_CONFIGS.Buyer;

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-indigo-500 to-violet-500 p-6 text-white">
        <h1 className="text-2xl font-bold">
          Welcome back, {userData?.fullName?.split(" ")[0] || "User"}!
        </h1>
        <p className="mt-1 text-indigo-100">
          Here's what's happening with your {role.toLowerCase()} account today.
        </p>
      </div>

      {/* Stats Widgets */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {config.widgets.map((widget) => {
          const Icon = widget.icon;
          const colors = WIDGET_COLORS[widget.color] || WIDGET_COLORS.blue;
          
          return (
            <div
              key={widget.id}
              className={`rounded-2xl border border-slate-200 ${colors.bg} p-5`}
            >
              <div className="flex items-start justify-between">
                <div className={`rounded-xl p-2 ${colors.bg}`}>
                  <Icon className={`size-5 ${colors.icon}`} />
                </div>
                {widget.trend && (
                  <div className={`flex items-center gap-1 text-xs font-semibold ${
                    widget.trendUp ? "text-emerald-600" : "text-red-600"
                  }`}>
                    {widget.trendUp ? (
                      <ArrowUpRight className="size-3" />
                    ) : (
                      <ArrowDownRight className="size-3" />
                    )}
                    {widget.trend}
                  </div>
                )}
              </div>
              <div className="mt-3">
                <p className={`text-2xl font-bold ${colors.text}`}>{widget.value}</p>
                <p className="mt-1 text-sm font-medium text-slate-600">{widget.title}</p>
                <p className="mt-1 text-xs text-slate-500">{widget.hint}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-800">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          {config.quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={index}
                type="button"
                className={`btn btn-sm gap-2 ${
                  action.primary
                    ? "bg-indigo-600 text-white hover:bg-indigo-500"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Icon className="size-4" />
                {action.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Role-Specific Sections */}
      <div className="space-y-6">
        {config.sections.map((section, index) => {
          const Icon = section.icon;
          return (
            <div
              key={index}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex items-center gap-2">
                <Icon className="size-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-slate-800">{section.title}</h2>
              </div>
              
              {/* Placeholder content based on section type */}
              {section.type === "property_grid" && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="h-48 animate-pulse rounded-xl bg-slate-100"
                    />
                  ))}
                </div>
              )}
              
              {section.type === "property_list" && (
                <div className="space-y-3">
                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="size-16 animate-pulse rounded-lg bg-slate-200" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {section.type === "analytics" && (
                <div className="h-64 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex h-full items-center justify-center text-slate-400">
                    <div className="text-center">
                      <BarChart3 className="mx-auto size-12" />
                      <p className="mt-2 text-sm">Analytics visualization</p>
                    </div>
                  </div>
                </div>
              )}

              {section.type === "alert_list" && (
                <div className="space-y-3">
                  {[1, 2].map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
                    >
                      <ArrowDownRight className="size-5 text-amber-600" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-800">
                          Price dropped by ₹5L
                        </p>
                        <p className="text-xs text-slate-600">2 BHK in Indore</p>
                      </div>
                      <span className="text-xs text-slate-500">2h ago</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
