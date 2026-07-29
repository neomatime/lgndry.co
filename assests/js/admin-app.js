(function () {
  "use strict";

  var STORAGE_KEY = "lgndry_ops_command_center_v2";
  var THEME_KEY = "lgndry_admin_theme";
  var SUPABASE_URL = "https://tscaluhtfrvwlwjybfsg.supabase.co";
  var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzY2FsdWh0ZnJ2d2x3anliZnNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MjIwNTUsImV4cCI6MjA5ODk5ODA1NX0.dk7oFywIWf1xRTlYtfxHHe96VaQ6iFSPKMsCExy4e5A";
  var supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  var VAPID_PUBLIC_KEY = "BM_IQFlZnwcu7g4r34KumlYmAJWP0sH4O2_3SNhvqT2gF4hP3enZGP9vgnxZN-FTIpRrXyKByvyb0gMhEA7h4es";
  var chromeInitialized = false;
  var TABLES = ["clients", "practice", "bookings", "projects", "partnerships", "collection", "galleries", "content", "journal", "cms", "budgets", "invoices", "documents"];
  var state = { route: "dashboard", query: "", filter: "all", editing: null };
  var data = { activity: [] };
  window.LgndryOpsSnapshot = function () { return data; };

  var icons = {
    dashboard: svg('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>'),
    clients: svg('<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>'),
    bookings: svg('<rect x="4" y="5" width="16" height="15" rx="1"/><path d="M8 3v4M16 3v4M4 10h16"/>'),
    projects: svg('<path d="M3 7h18v13H3z"/><path d="M8 7V4h8v3"/>'),
    partnerships: svg('<path d="M8 12h8M12 8v8"/><circle cx="12" cy="12" r="9"/>'),
    collection: svg('<path d="M6 8h12l1 13H5z"/><path d="M9 8a3 3 0 0 1 6 0"/>'),
    galleries: svg('<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M7 15l3-3 3 3 2-2 3 4"/><circle cx="8" cy="9" r="1.4"/>'),
    content: svg('<path d="M4 5h16M4 12h16M4 19h10"/>'),
    practice: svg('<path d="m4 20 4-1 10-10-3-3L5 16z"/><path d="m14 6 3 3"/>'),
    journal: svg('<path d="M7 3h10v18H7z"/><path d="M9 7h6M9 11h6M9 15h4"/>'),
    cms: svg('<path d="M4 4h16v16H4z"/><path d="M4 9h16M9 20V9"/>'),
    budgets: svg('<path d="M12 3v18M8 6.5a3 3 0 0 1 3-2h1.5a3 3 0 0 1 0 6H11a3 3 0 0 0 0 6h1.5a3 3 0 0 0 3-2"/>'),
    invoices: svg('<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>'),
    analytics: svg('<path d="M4 20V9M10 20V4M16 20v-7M22 20H2"/>'),
    documents: svg('<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5"/>'),
    settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1-2 2-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5v.2h-3V20a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1-2-2 .1-.1A1.7 1.7 0 0 0 7.4 15a1.7 1.7 0 0 0-1.5-1H5.7v-3H6a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1 2-2 .1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V4.8h3V5a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1 2 2-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1h.2v3H21a1.7 1.7 0 0 0-1.6 1z"/>'),
    activity: svg('<circle cx="12" cy="12" r="1.6"/><path d="M12 3v5M12 16v5M3 12h5M16 12h5"/>')
  };

  var PROJECT_PROGRESS = { Planning: 10, "Shoot Scheduled": 35, Editing: 65, "Client Review": 85, Delivered: 100, Archived: 100 };

  var modules = [
    ["dashboard", "Dashboard"], ["clients", "Clients"], ["bookings", "Bookings"],
    ["projects", "Projects"], ["partnerships", "Brand Partnerships"],
    ["collection", "Collection"], ["galleries", "Gallery Delivery"],
    ["content", "Content Library"], ["practice", "Practice"], ["journal", "Journal"],
    ["cms", "Website CMS"], ["budgets", "Form Pricing"], ["invoices", "Invoices"], ["analytics", "Analytics"],
    ["documents", "Documents"], ["settings", "Settings"]
  ];

  var schemas = {
    clients: {
      title: "Clients",
      subtitle: "Manage studio relationships, histories, assets, documents and brand notes.",
      collection: "clients", display: "name", status: "status",
      columns: ["name", "type", "contact", "email", "status"],
      fields: [f("name", "Client name", "text", true), f("type", "Client type", "select", true, ["Individual", "Company"]), f("contact", "Contact person", "text", true), f("email", "Email", "email", true), f("phone", "Phone number", "tel"), f("image", "Logo / image URL"), f("status", "Status", "select", true, ["Lead", "Active", "Returning", "Archived"]), f("guidelines", "Brand guidelines", "textarea"), f("notes", "Notes", "textarea")]
    },
    practice: {
      title: "Practice",
      subtitle: "Control visible service areas across photography, visual communication and partnerships.",
      collection: "practice", display: "title", status: "visibility",
      columns: ["title", "category", "visibility", "position"],
      fields: [f("title", "Practice item", "text", true), f("category", "Category", "select", true, ["Photography", "Visual Communication", "Brand Partnerships"]), f("description", "Description", "textarea"), f("position", "Order", "number", true), f("visibility", "Website visibility", "select", true, ["Visible", "Hidden", "Archived"])]
    },
    bookings: {
      title: "Bookings",
      subtitle: "Schedule shoots, connect them to clients and generate projects when confirmed.",
      collection: "bookings", display: "service", status: "status",
      columns: ["client", "service", "date", "status", "deposit"],
      fields: [rel("client", "Client", "clients", true), f("service", "Service", "text", true), f("date", "Date", "date", true), f("start", "Start time", "time"), f("end", "End time", "time"), f("location", "Location"), f("type", "Booking type", "select", true, ["Enquiry", "Campaign", "Portrait", "Product", "Partnership", "Collection"]), f("photographer", "Assigned photographer"), f("status", "Status", "select", true, ["Enquiry", "Awaiting Deposit", "Confirmed", "Scheduled", "Completed", "Delivered", "Cancelled"]), f("deposit", "Deposit status", "select", true, ["Not Requested", "Requested", "Paid", "Waived"]), rel("project", "Related project", "projects"), f("shotList", "Shot list", "textarea"), f("notes", "Notes", "textarea")],
      actions: ["generateProject"]
    },
    projects: {
      title: "Projects",
      subtitle: "Track briefs, timelines, tasks, files, comments and deliverables from planning to archive.",
      collection: "projects", display: "name", status: "status",
      columns: ["name", "client", "type", "status", "timeline"],
      fields: [f("name", "Project name", "text", true), f("image", "Cover image URL"), rel("client", "Client", "clients", true), rel("booking", "Booking", "bookings"), f("type", "Project type", "text", true), f("brief", "Brief", "textarea"), f("moodboard", "Moodboard links / uploads", "textarea"), f("shotList", "Shot list", "textarea"), f("deliverables", "Deliverables", "textarea"), f("timeline", "Timeline"), f("tasks", "Tasks", "textarea"), f("files", "Files", "textarea"), f("comments", "Comments", "textarea"), f("status", "Workflow status", "select", true, ["Planning", "Shoot Scheduled", "Editing", "Client Review", "Delivered", "Archived"])]
    },
    partnerships: {
      title: "Brand Partnerships",
      subtitle: "Move prospects from application to active annual creative partnerships.",
      collection: "partnerships", display: "company", status: "status",
      columns: ["company", "contact", "status", "sessionsRemaining", "end"],
      fields: [rel("client", "Client", "clients"), f("company", "Company / client", "text", true), f("contact", "Contact person", "text", true), f("application", "Application details", "textarea"), f("duration", "Contract duration", "text", false, null, "Annual Creative Partnership - minimum 12-month term"), f("start", "Contract start date", "date"), f("end", "Contract end date", "date"), f("deliverables", "Monthly deliverables", "textarea"), f("allowance", "Monthly shoot allowance", "number"), f("sessionsRemaining", "Remaining sessions", "number"), f("proposal", "Proposal link / notes", "textarea"), f("contract", "Contract link / notes", "textarea"), f("review", "Quarterly review notes", "textarea"), f("status", "Pipeline stage", "select", true, ["Applied", "Discovery Call", "Proposal", "Negotiation", "Signed", "Onboarding", "Active", "Renewal", "Lost"])]
    },
    collection: {
      title: "Collection",
      subtitle: "Manage art listings, editions, sales, certificates and delivery tracking.",
      collection: "collection", display: "title", status: "availability",
      columns: ["title", "collectionName", "price", "remaining", "availability"],
      fields: [f("title", "Artwork title", "text", true), f("collectionName", "Collection name", "text", true), f("category", "Category", "select", true, ["Art Print", "Studio Art", "Limited Edition"]), f("year", "Year", "number"), f("description", "Description / story", "textarea"), f("image", "Main image URL", "text", true), f("images", "Additional images (one URL per line, optional)", "textarea"), f("seriesLabel", "Medium / series line (shown under 'available' count)", "text", true), f("sizes", "Print sizes offered (one per line)", "textarea", true), f("price", "Price", "number", true), f("editionSize", "Edition size", "number", true), f("sold", "Editions sold", "number", true), f("remaining", "Editions remaining", "number"), f("availability", "Availability", "select", true, ["Available", "Reserved", "Sold Out", "Hidden"]), f("customer", "Latest customer"), f("editionNumber", "Latest edition number", "number"), f("payment", "Payment status", "select", false, ["Pending In Person", "Paid In Person", "Reserved", "Cancelled"]), f("shipping", "Shipping status", "select", false, ["Not Started", "Preparing", "Shipped", "Delivered", "Collected"]), f("tracking", "Tracking number"), f("certificate", "Certificate status", "select", false, ["Not Issued", "Issued", "Archived"])]
    },
    invoices: {
      title: "Invoices & Payments",
      subtitle: "Create quotes, invoices and receipts linked to clients, shoots, projects and orders.",
      collection: "invoices", display: "number", status: "status",
      columns: ["number", "client", "type", "amount", "status"],
      fields: [f("number", "Document number", "text", true), f("type", "Document type", "select", true, ["Quote", "Invoice", "Receipt"]), rel("client", "Client", "clients", true), rel("project", "Project / booking / order", "projects"), f("items", "Line items (one per line, e.g. 'Brand Shoot — R5,000')", "textarea", true), f("amount", "Amount", "number", true), f("vat", "VAT", "number"), f("due", "Due date", "date"), f("status", "Payment status", "select", true, ["Draft", "Sent", "Paid", "Partially Paid", "Overdue", "Cancelled"]), f("paidAt", "Payment date", "date")],
      actions: ["downloadPdf"]
    },
    galleries: {
      title: "Gallery Delivery",
      subtitle: "Build delivery links, monitor viewed/downloaded status and manage expiries.",
      collection: "galleries", display: "title", status: "status",
      columns: ["title", "client", "project", "expiry", "status"],
      fields: [f("title", "Gallery title", "text", true), rel("client", "Client", "clients", true), rel("project", "Project", "projects"), f("files", "Image URLs (one per line)", "textarea", false, null, "assests/images/...\nassests/images/..."), f("expiry", "Expiry date", "date"), f("downloads", "Downloads enabled", "select", true, ["Enabled", "Disabled"]), f("password", "Password protection (optional)"), f("status", "Gallery status", "select", true, ["Draft", "Sent", "Viewed", "Downloaded", "Expired"])],
      actions: ["copyLink"]
    },
    content: {
      title: "Content Library",
      subtitle: "Search, tag and connect assets to clients, projects, galleries and campaigns.",
      collection: "content", display: "title", status: "status",
      columns: ["title", "client", "project", "category", "status"],
      fields: [f("title", "Asset title", "text", true), rel("client", "Client", "clients"), rel("project", "Project", "projects"), f("shootDate", "Shoot date", "date"), f("category", "Category", "select", true, ["Raw", "Edited", "Social", "Campaign", "Archive", "Website"]), f("tags", "Tags"), f("fileType", "File type", "select", true, ["Image", "Video", "PDF", "Document", "Link"]), f("file", "File URL / path"), f("status", "Status", "select", true, ["Active", "Linked", "Archived"])]
    },
    journal: {
      title: "Journal",
      subtitle: "Plan, schedule and publish editorial stories for the website.",
      collection: "journal", display: "title", status: "status",
      columns: ["title", "slug", "category", "status", "published"],
      fields: [f("title", "Title", "text", true), f("slug", "Slug", "text", true), f("image", "Featured image"), f("category", "Category"), f("body", "Body content", "textarea"), f("seoTitle", "SEO title"), f("seoDescription", "SEO description", "textarea"), f("published", "Published date", "date"), f("status", "Status", "select", true, ["Draft", "Scheduled", "Published", "Archived"])]
    },
    cms: {
      title: "Website CMS",
      subtitle: "Update live website copy, imagery, collaborations and calls-to-action without code.",
      collection: "cms", display: "section", status: "status",
      columns: ["section", "area", "status", "updated"],
      fields: [f("section", "Website section", "select", true, ["Homepage", "About", "Practice", "Collection", "Contact", "Collaborations", "Calls-to-action"]), f("area", "Content area", "text", true), f("copy", "Copy", "textarea"), f("image", "Image URL"), f("cta", "Call-to-action"), f("status", "Status", "select", true, ["Draft", "Ready", "Published", "Archived"]), f("updated", "Updated date", "date")]
    },
    budgets: {
      title: "Form Pricing",
      subtitle: "Control the budget range options shown on the booking, contact and partnership forms.",
      collection: "budgets", display: "label", status: "visibility",
      columns: ["form", "label", "position", "visibility"],
      fields: [f("form", "Form", "select", true, ["Booking", "Contact", "Partnership"]), f("label", "Budget range label", "text", true), f("position", "Order", "number", true), f("visibility", "Website visibility", "select", true, ["Visible", "Hidden", "Archived"])]
    },
    documents: {
      title: "Documents",
      subtitle: "Generate and track contracts, NDAs, briefs, call sheets and releases.",
      collection: "documents", display: "title", status: "status",
      columns: ["title", "type", "client", "project", "status"],
      fields: [f("title", "Document title", "text", true), f("type", "Document type", "select", true, ["Contract", "NDA", "Proposal", "Creative Brief", "Call Sheet", "Model Release", "Location Release"]), rel("client", "Client", "clients"), rel("project", "Project / booking / partnership", "projects"), f("body", "Document text", "textarea"), f("template", "Template / upload link"), f("signed", "Signed document link"), f("status", "Status", "select", true, ["Draft", "Sent", "Signed", "Expired", "Archived"])],
      actions: ["downloadPdf"]
    }
  };

  function svg(paths) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">' + paths + "</svg>";
  }

  function f(name, label, type, required, options, placeholder) {
    return { name: name, label: label, type: type || "text", required: !!required, options: options || null, placeholder: placeholder || "" };
  }

  function rel(name, label, collection, required) {
    return { name: name, label: label, type: "relation", collection: collection, required: !!required };
  }

  function id() {
    return "id_" + Math.random().toString(36).slice(2, 9) + "_" + Date.now().toString(36);
  }

  function seed() {
    var c1 = id(), c2 = id(), c3 = id(), b1 = id(), b2 = id(), p1 = id(), p2 = id();
    return {
      clients: [
        { id: c1, name: "Rituals", type: "Company", contact: "Amina Jacobs", email: "amina@rituals.example", phone: "+27 72 123 4567", status: "Active", guidelines: "Warm minimal product rituals. Neutral palette.", notes: "Returning campaign client." },
        { id: c2, name: "Hennessy SA", type: "Company", contact: "Thabo Mokoena", email: "studio@hennessy.example", phone: "+27 11 555 0920", status: "Returning", guidelines: "Luxury nightlife and editorial portraits.", notes: "Monthly visual communication retainer prospect." },
        { id: c3, name: "LELO Studio", type: "Company", contact: "Kea Matlou", email: "kea@lelo.example", phone: "+27 82 210 0112", status: "Active", guidelines: "High contrast product lighting.", notes: "Product campaign completed." }
      ],
      practice: [
        { id: id(), title: "Brand Photography", category: "Photography", description: "Purposeful brand campaigns and founder visuals.", position: 1, visibility: "Visible" },
        { id: id(), title: "Commercial Photography", category: "Photography", description: "Campaign and commercial image production.", position: 2, visibility: "Visible" },
        { id: id(), title: "Portraiture", category: "Photography", description: "Editorial portrait sessions.", position: 3, visibility: "Visible" },
        { id: id(), title: "Product Photography", category: "Photography", description: "Quiet, precise product stories.", position: 4, visibility: "Visible" },
        { id: id(), title: "Creative Direction", category: "Visual Communication", description: "Visual systems, mood and story direction.", position: 5, visibility: "Visible" },
        { id: id(), title: "Dedicated Visual Partner", category: "Brand Partnerships", description: "Annual creative partnership for consistent output.", position: 6, visibility: "Visible" }
      ],
      bookings: [
        { id: b1, client: c1, service: "Brand Shoot", date: "2026-07-10", start: "09:00", end: "13:00", location: "Johannesburg Studio", type: "Campaign", photographer: "Dan Mokgwadi", status: "Confirmed", deposit: "Paid", project: p1, shotList: "Product rituals, founder portrait, campaign stills", notes: "Soft morning light." },
        { id: b2, client: c2, service: "Creative Direction Call", date: "2026-07-12", start: "11:00", end: "12:00", location: "Remote", type: "Partnership", photographer: "Dan Mokgwadi", status: "Scheduled", deposit: "Waived", project: "", shotList: "Retainer planning", notes: "Discuss annual partnership." }
      ],
      projects: [
        { id: p1, name: "Rituals Campaign", image: "assests/images/collection/thumbs/still-point.jpg", client: c1, booking: b1, type: "Brand Campaign", brief: "Launch campaign visuals for quiet ritual moments.", moodboard: "Neutral walls, sculptural shadows.", shotList: "Product rituals, founder portrait, campaign stills", deliverables: "24 edited images, 6 social crops", timeline: "Jul 10 - Jul 24", tasks: "Confirm props\nShoot\nEdit selects\nDeliver gallery", files: "Drive/Rituals", comments: "Client prefers minimal crops.", status: "Editing" },
        { id: p2, name: "LELO Studio", image: "assests/images/collection/thumbs/presence.jpg", client: c3, booking: "", type: "Product Photography", brief: "Product still life set.", moodboard: "", shotList: "", deliverables: "18 finals", timeline: "Completed June", tasks: "Archived", files: "Drive/LELO", comments: "Paid in full.", status: "Delivered" }
      ],
      partnerships: [
        { id: id(), client: c2, company: "Hennessy SA", contact: "Thabo Mokoena", application: "Seeking ongoing campaign and event visual storytelling.", duration: "Annual Creative Partnership - minimum 12-month term", start: "2026-08-01", end: "2027-07-31", deliverables: "Monthly shoot, 20 edited images, quarterly campaign story", allowance: 1, sessionsRemaining: 11, proposal: "Proposal sent", contract: "Pending", review: "Discovery call booked.", status: "Proposal" }
      ],
      collection: [
        { id: id(), title: "Dineo", collectionName: "Found Beauty", category: "Art Print", description: "A study of quiet architecture and shadow.", image: "assests/images/collection/thumbs/still-point.jpg", price: 4200, editionSize: 25, sold: 4, remaining: 21, availability: "Available", customer: "", editionNumber: "", payment: "Pending In Person", shipping: "Not Started", tracking: "", certificate: "Not Issued" }
      ],
      invoices: [
        { id: id(), number: "INV-032", type: "Invoice", client: c1, project: p1, items: "Brand campaign shoot and edits", amount: 18500, vat: 0, due: "2026-07-18", status: "Sent", paidAt: "" },
        { id: id(), number: "INV-028", type: "Invoice", client: c3, project: p2, items: "Product photography", amount: 8950, vat: 0, due: "2026-06-20", status: "Paid", paidAt: "2026-06-18" }
      ],
      galleries: [{ id: id(), title: "Rituals Campaign Selects", client: c1, project: p1, files: "24 edited previews", expiry: "2026-08-01", downloads: "Enabled", share: "https://lgndry.co/gallery/rituals", password: "rituals24", status: "Sent" }],
      content: [{ id: id(), title: "Rituals Hero Still", client: c1, project: p1, shootDate: "2026-07-10", category: "Campaign", tags: "rituals,product,shadow", fileType: "Image", file: "assests/images/collection/thumbs/still-point.jpg", status: "Linked" }],
      journal: [{ id: id(), title: "Slowing Down To See", slug: "slowing-down-to-see", image: "assests/images/hero-image.JPG", category: "Manifesto", body: "A short studio reflection on intentional image making.", seoTitle: "Slowing Down To See", seoDescription: "LGNDRY.Co manifesto note.", published: "2026-07-15", status: "Scheduled" }],
      cms: [{ id: id(), section: "Homepage", area: "Hero copy", copy: "Found Beauty in the Mundane.", image: "assests/images/hero-image.JPG", cta: "Explore our world", status: "Published", updated: "2026-07-07" }],
      documents: [{ id: id(), title: "Rituals Campaign Agreement", type: "Contract", client: c1, project: p1, template: "Standard campaign agreement", signed: "", status: "Sent" }],
      activity: [
        { id: id(), message: 'Invoice "INV-032" sent to Rituals', at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
        { id: id(), message: "Booking confirmed with Rituals for Jul 10", at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
        { id: id(), message: 'Project "LELO Studio" marked delivered', at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() }
      ]
    };
  }

  function logActivity(message) {
    data.activity = data.activity || [];
    data.activity.unshift({ id: id(), message: message, at: new Date().toISOString() });
    data.activity = data.activity.slice(0, 100);
    supabaseClient.from("ops_activity_log").insert({ message: message }).then(function (result) {
      if (result.error) console.error(result.error);
    });
  }

  function timeAgo(iso) {
    if (!iso) return "";
    var minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return minutes + "m ago";
    var hours = Math.round(minutes / 60);
    if (hours < 24) return hours + "h ago";
    return Math.round(hours / 24) + "d ago";
  }

  function loadRemoteData() {
    var queries = TABLES.map(function (table) {
      return supabaseClient.from(table).select("*").then(function (result) {
        if (result.error) throw result.error;
        return { table: table, rows: result.data };
      });
    });
    return Promise.all(queries).then(function (results) {
      var grouped = {};
      results.forEach(function (entry) { grouped[entry.table] = entry.rows; });
      return supabaseClient.from("ops_activity_log").select("id, message, created_at").order("created_at", { ascending: false }).limit(30).then(function (activityResult) {
        if (activityResult.error) throw activityResult.error;
        grouped.activity = activityResult.data.map(function (row) { return { id: row.id, message: row.message, at: row.created_at }; });
        return grouped;
      });
    });
  }

  function hasAnyRemoteRecords(remoteData) {
    return Object.keys(remoteData).some(function (key) {
      return key !== "activity" && remoteData[key] && remoteData[key].length;
    });
  }

  function generateUuidFallback() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (char) {
      var random = Math.random() * 16 | 0;
      var value = char === "x" ? random : (random & 0x3 | 0x8);
      return value.toString(16);
    });
  }

  function newUuid() {
    return (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : generateUuidFallback();
  }

  function normalizeForDb(record) {
    var payload = Object.assign({}, record);
    Object.keys(payload).forEach(function (key) {
      if (payload[key] === "") payload[key] = null;
    });
    return payload;
  }

  function buildInsertRows(bundle) {
    var relationFields = ["client", "project", "booking"];
    var idMap = {};
    var collections = Object.keys(bundle).filter(function (key) { return key !== "activity" && Array.isArray(bundle[key]); });
    collections.forEach(function (collection) {
      bundle[collection].forEach(function (record) { idMap[record.id] = newUuid(); });
    });
    var rowsByTable = {};
    collections.forEach(function (collection) {
      rowsByTable[collection] = bundle[collection].map(function (record) {
        var payload = Object.assign({}, record);
        payload.id = idMap[payload.id];
        relationFields.forEach(function (field) {
          if (payload[field] && idMap[payload[field]]) payload[field] = idMap[payload[field]];
        });
        return normalizeForDb(payload);
      });
    });
    var activityRows = (bundle.activity || []).map(function (entry) {
      return { message: entry.message, created_at: entry.at };
    });
    return { rowsByTable: rowsByTable, activityRows: activityRows };
  }

  // Writes rows table-by-table respecting FK dependency order (clients/standalone
  // tables first, then bookings without their project link, then projects, then
  // the booking->project link, then everything else that references clients/projects).
  function persistRowsByTable(rowsByTable, mode) {
    function write(table, rows) {
      if (!rows || !rows.length) return Promise.resolve({ error: null });
      return mode === "upsert" ? supabaseClient.from(table).upsert(rows) : supabaseClient.from(table).insert(rows);
    }
    function checkAll(results) {
      var failed = results.filter(function (result) { return result && result.error; });
      if (failed.length) throw failed[0].error;
    }
    var independentTables = ["collection", "practice", "journal", "cms", "clients"];
    var laterTables = ["partnerships", "invoices", "galleries", "content", "documents"];

    return Promise.all(independentTables.map(function (table) { return write(table, rowsByTable[table]); })).then(function (results) {
      checkAll(results);
      var bookingsRows = (rowsByTable.bookings || []).map(function (row) { return Object.assign({}, row, { project: null }); });
      return write("bookings", bookingsRows);
    }).then(function (result) {
      checkAll([result]);
      return write("projects", rowsByTable.projects);
    }).then(function (result) {
      checkAll([result]);
      var updates = (rowsByTable.bookings || []).filter(function (row) { return row.project; }).map(function (row) {
        return supabaseClient.from("bookings").update({ project: row.project }).eq("id", row.id);
      });
      return Promise.all(updates);
    }).then(function (results) {
      checkAll(results);
      return Promise.all(laterTables.map(function (table) { return write(table, rowsByTable[table]); }));
    }).then(function (results) {
      checkAll(results);
    });
  }

  function insertBundle(built) {
    return persistRowsByTable(built.rowsByTable, "insert").then(function () {
      if (!built.activityRows.length) return null;
      return supabaseClient.from("ops_activity_log").insert(built.activityRows);
    }).then(function (result) {
      if (result && result.error) throw result.error;
    });
  }

  function migrateLocalData() {
    var raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (error) { raw = null; }
    if (!raw) return Promise.resolve();
    var local;
    try { local = JSON.parse(raw); } catch (error) { return Promise.resolve(); }
    return insertBundle(buildInsertRows(local)).then(function () {
      try { localStorage.removeItem(STORAGE_KEY); } catch (error) {}
    });
  }

  function persistRecord(collection, record) {
    var payload = normalizeForDb(record);
    return supabaseClient.from(collection).upsert(payload).then(function (result) {
      if (result.error) { console.error(result.error); toast("Sync failed: " + result.error.message); }
      return result;
    });
  }

  function deleteRecordRemote(collection, recordId) {
    supabaseClient.from(collection).delete().eq("id", recordId).then(function (result) {
      if (result.error) { console.error(result.error); toast("Delete sync failed: " + result.error.message); }
    });
  }

  function resetDemoData() {
    var deletions = TABLES.map(function (table) {
      return supabaseClient.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    });
    Promise.all(deletions).then(function (results) {
      var failed = results.filter(function (result) { return result.error; });
      if (failed.length) throw failed[0].error;
      return supabaseClient.from("ops_activity_log").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }).then(function (result) {
      if (result && result.error) throw result.error;
      return insertBundle(buildInsertRows(seed()));
    }).then(function () {
      return loadRemoteData();
    }).then(function (remoteData) {
      data = remoteData;
      toast("Demo data restored.");
      render();
    }).catch(function (error) {
      console.error(error);
      toast("Reset failed: " + error.message);
    });
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"]/g, function (match) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[match];
    });
  }

  function money(value) {
    return "R" + Number(value || 0).toLocaleString("en-ZA");
  }

  function active(collection) {
    return (data[collection] || []).filter(function (item) {
      return !item.archived && item.status !== "Archived" && item.visibility !== "Archived";
    });
  }

  function byId(collection, recordId) {
    return (data[collection] || []).find(function (item) { return item.id === recordId; });
  }

  function label(collection, recordId) {
    var record = byId(collection, recordId);
    if (!record) return recordId || "Unlinked";
    return record.name || record.title || record.service || record.number || record.company || record.section || "Record";
  }

  function render() {
    renderNav();
    if (state.route === "dashboard") {
      setTitle("Welcome back, Dan.", "Here is what is happening with LGNDRY.Co today.");
      view().innerHTML = dashboard();
      bindDashboard();
      return;
    }
    if (state.route === "analytics") {
      setTitle("Analytics", "Business performance based on current operational records.");
      view().innerHTML = analytics();
      return;
    }
    if (state.route === "settings") {
      setTitle("Settings", "Studio preferences, export tools and local storage controls.");
      view().innerHTML = settings();
      bindSettings();
      return;
    }
    var schema = schemas[state.route];
    setTitle(schema.title, schema.subtitle);
    view().innerHTML = moduleView(schema);
    bindModule(schema);
  }

  function view() {
    return document.querySelector("[data-view]");
  }

  function setTitle(title, subtitle) {
    document.querySelector("[data-view-title]").textContent = title;
    document.querySelector("[data-view-subtitle]").textContent = subtitle || "";
  }

  function renderNav() {
    document.querySelector("[data-nav]").innerHTML = modules.map(function (module) {
      var schema = schemas[module[0]];
      var count = schema ? active(schema.collection).length : null;
      var countMarkup = count != null ? '<span class="nav-item__count">' + count + '</span>' : '';
      return '<button type="button" class="nav-item ' + (state.route === module[0] ? "nav-item--active" : "") + '" data-route="' + module[0] + '">' + (icons[module[0]] || "") + "<span>" + module[1] + "</span>" + countMarkup + "</button>";
    }).join("");
  }

  function dashboard() {
    var invoices = active("invoices");
    var bookings = active("bookings").sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    var projects = active("projects");
    var partnerships = active("partnerships");
    var collection = active("collection");
    var today = new Date().toISOString().slice(0, 10);
    var upcoming = bookings.filter(function (booking) { return booking.date >= today; });
    var outstanding = invoices.filter(function (invoice) { return ["Sent", "Partially Paid", "Overdue"].indexOf(invoice.status) > -1; }).reduce(sumAmount, 0);
    var paid = invoices.filter(function (invoice) { return invoice.status === "Paid"; }).reduce(sumAmount, 0);
    var artSales = collection.reduce(function (total, art) { return total + Number(art.price || 0) * Number(art.sold || 0); }, 0);
    return '<section class="hero-strip"><img src="assests/images/collection/thumbs/still-point.jpg" alt="LGNDRY.Co studio still"><div class="hero-strip__copy"><h2>Create intentionally.<br>Lead creatively.</h2><p>Manage. Create. Deliver. Elevate.</p></div></section>' +
      '<section class="dashboard-metrics">' +
      metric("Active Projects", projects.filter(function (p) { return p.status !== "Delivered"; }).length, "View all projects", icons.projects, "projects") +
      metric("Upcoming Bookings", upcoming.length, "View calendar", icons.bookings, "bookings") +
      metric("Outstanding Invoices", money(outstanding), "Needs follow-up", icons.invoices, "invoices") +
      metric("Collection Sales", money(paid + artSales), "Paid and edition value", icons.collection, "collection") +
      metric("Partnership Pipeline", partnerships.length, "Prospects and retainers", icons.partnerships, "partnerships") +
      "</section>" +
      '<section class="split-grid">' +
      recentProjects(projects) +
      recentActivity() +
      "</section>" +
      '<section class="panels-grid">' +
      snapshot("Today's Schedule", bookings.filter(function (b) { return b.date === today; }), "bookings") +
      snapshot("Upcoming Shoots", upcoming, "bookings") +
      snapshot("Pending Deliverables", projects.filter(function (p) { return ["Editing", "Client Review", "Shoot Scheduled"].indexOf(p.status) > -1; }), "projects") +
      "</section>" +
      '<section class="panels-grid">' +
      snapshot("Recent Enquiries", bookings.filter(function (b) { return b.status === "Enquiry"; }).concat(active("clients").filter(function (c) { return c.status === "Lead"; })), "clients") +
      pipeline() +
      calendar(upcoming) +
      "</section>" +
      focusStrip();
  }

  function recentProjects(projects) {
    var rows = projects.slice(0, 5).map(function (project) {
      var progress = PROJECT_PROGRESS[project.status] != null ? PROJECT_PROGRESS[project.status] : 10;
      var statusCls = statusClass(project.status);
      var dotClass = statusCls === "warn" || statusCls === "bad" ? "dot dot--warn" : "dot";
      return '<div class="project"><img src="' + esc(project.image || "assests/images/hero-image.JPG") + '" alt="">' +
        "<div><h3>" + esc(project.name) + "</h3><p>" + esc(label("clients", project.client)) + "</p></div>" +
        '<span class="project__status"><span class="' + dotClass + '"></span>' + esc(project.status) + "</span>" +
        '<span class="project__progress">' + progress + '%</span>' +
        '<div class="bar"><span style="--value:' + progress + '%"></span></div></div>';
    }).join("");
    return '<article class="panel"><div class="panel__header"><span class="panel__label">Recent Projects</span></div><div class="project-list">' + (rows || '<p class="empty-state">No projects yet.</p>') + '</div><div class="panel__footer"><button class="panel__link" type="button" data-route-jump="projects">View all projects<span>&rarr;</span></button></div></article>';
  }

  function recentActivity() {
    var rows = (data.activity || []).slice(0, 6).map(function (entry) {
      return '<div class="activity"><span class="activity__icon">' + icons.activity + "</span><p>" + esc(entry.message) + '</p><span class="activity__time">' + esc(timeAgo(entry.at)) + "</span></div>";
    }).join("");
    return '<article class="panel"><div class="panel__header"><span class="panel__label">Recent Activity</span></div><div class="activity-list">' + (rows || '<p class="empty-state">No activity yet.</p>') + "</div></article>";
  }

  function focusStrip() {
    return '<section class="focus-strip"><img src="assests/images/art/outdoor/InShot_20260118_234450089.jpg" alt="LGNDRY.Co studio detail"><div class="focus-strip__quote"><p>Discipline is the bridge<br>between vision and legacy.</p></div><div class="focus-strip__action"><span class="panel__label">Stay Focused</span><p>Your next level is built on what you do today.</p><button class="table-action" type="button" data-route-jump="analytics">View Goals</button></div></section>';
  }

  function sumAmount(total, item) {
    return total + Number(item.amount || 0);
  }

  function metric(labelText, value, hint, icon, route) {
    var hintMarkup = route
      ? '<button type="button" class="metric__hint metric__hint--link" data-route-jump="' + esc(route) + '">' + esc(hint || "") + "</button>"
      : '<div class="metric__hint">' + esc(hint || "") + "</div>";
    return '<article class="metric"><div class="metric__head"><span class="metric__label">' + esc(labelText) + '</span><span class="metric__icon">' + (icon || icons.dashboard) + "</span></div><div><div class=\"metric__value\">" + esc(value) + "</div>" + hintMarkup + "</div></article>";
  }

  function snapshot(title, items, route) {
    var rows = items.slice(0, 5).map(function (record) {
      var status = record.status || record.visibility || record.availability || "Open";
      var name = record.name || record.title || record.service || record.number || record.company || record.section;
      var meta = [record.date || record.due || record.timeline || record.published, relationMeta(record)].filter(Boolean).join(" / ");
      return '<div class="snapshot-item"><span class="status-pill ' + statusClass(status) + '">' + esc(status) + '</span><div><strong>' + esc(name) + '</strong><p class="record-meta">' + esc(meta) + '</p></div><button class="table-action" data-route-jump="' + route + '">Open</button></div>';
    }).join("");
    return '<article class="panel"><div class="panel__header"><span class="panel__label">' + esc(title) + '</span></div><div class="snapshot-list">' + (rows || '<p class="empty-state">No records yet.</p>') + "</div></article>";
  }

  function relationMeta(record) {
    if (record.client) return label("clients", record.client);
    if (record.project) return label("projects", record.project);
    return "";
  }

  function pipeline() {
    var stages = ["Applied", "Discovery Call", "Proposal", "Negotiation", "Signed", "Onboarding", "Active", "Renewal", "Lost"];
    return '<article class="panel"><div class="panel__header"><span class="panel__label">Brand Partnership Pipeline</span></div><div class="pipeline">' + stages.map(function (stage) {
      var cards = active("partnerships").filter(function (p) { return p.status === stage; }).map(function (p) {
        return '<div class="pipeline-card"><strong>' + esc(p.company) + '</strong><p class="record-meta">' + esc(p.contact) + " / " + esc(p.sessionsRemaining || 0) + " sessions</p></div>";
      }).join("");
      return '<div class="pipeline-stage"><h3>' + esc(stage) + "</h3>" + (cards || '<p class="empty-state">Empty</p>') + "</div>";
    }).join("") + "</div></article>";
  }

  function calendar(items) {
    var rows = items.slice(0, 5).map(function (booking) {
      var date = new Date(booking.date + "T00:00:00");
      return '<div class="calendar-item"><div class="calendar-date">' + date.getDate() + "<span>" + date.toLocaleDateString("en-ZA", { month: "short" }) + "</span></div><div><strong>" + esc(booking.service) + '</strong><p class="record-meta">' + esc(label("clients", booking.client)) + " / " + esc((booking.start || "") + " - " + (booking.end || "")) + "</p></div></div>";
    }).join("");
    return '<article class="panel"><div class="panel__header"><span class="panel__label">Calendar Snapshot</span></div><div class="calendar-list">' + (rows || '<p class="empty-state">No upcoming bookings.</p>') + "</div></article>";
  }

  function moduleView(schema) {
    var records = filtered(schema);
    var statusOptions = statuses(schema);
    return '<div class="module-head"><div><span class="eyebrow">Operations Module</span><h2>' + esc(schema.title) + "</h2><p>" + esc(schema.subtitle) + '</p></div><div class="toolbar"><input type="search" placeholder="Search ' + esc(schema.title.toLowerCase()) + '" value="' + esc(state.query) + '" data-module-search><select data-filter><option value="all">All statuses</option>' + statusOptions.map(function (status) { return '<option ' + (state.filter === status ? "selected" : "") + ' value="' + esc(status) + '">' + esc(status) + "</option>"; }).join("") + '</select><button class="primary-btn" data-new type="button">New ' + esc(singular(schema.title)) + "</button></div></div>" +
      '<div class="records-table-wrap">' + table(schema, records) + "</div>";
  }

  function singular(title) {
    return title.replace("Brand Partnerships", "partnership").replace("Gallery Delivery", "gallery").replace("Content Library", "asset").replace("Invoices & Payments", "invoice").replace("Form Pricing", "budget option").replace(/s$/, "").toLowerCase();
  }

  function filtered(schema) {
    var rows = active(schema.collection);
    var query = state.query.toLowerCase();
    if (query) {
      rows = rows.filter(function (record) {
        return JSON.stringify(record).toLowerCase().indexOf(query) > -1 || schema.fields.some(function (field) {
          return field.type === "relation" && label(field.collection, record[field.name]).toLowerCase().indexOf(query) > -1;
        });
      });
    }
    if (state.filter !== "all") {
      rows = rows.filter(function (record) { return (record[schema.status] || record.status || record.visibility || record.availability) === state.filter; });
    }
    return rows;
  }

  function statuses(schema) {
    var found = {};
    active(schema.collection).forEach(function (record) {
      var status = record[schema.status] || record.status || record.visibility || record.availability;
      if (status) found[status] = true;
    });
    schema.fields.filter(function (field) { return ["status", "visibility", "availability"].indexOf(field.name) > -1 || field.name === schema.status; }).forEach(function (field) {
      (field.options || []).forEach(function (option) { found[option] = true; });
    });
    return Object.keys(found);
  }

  function table(schema, rows) {
    if (!rows.length) return '<div class="loading">No matching records. Add one to begin.</div>';
    return '<table class="records-table"><thead><tr>' + schema.columns.map(function (column) { return "<th>" + esc(titleCase(column)) + "</th>"; }).join("") + "<th>Actions</th></tr></thead><tbody>" + rows.map(function (record) {
      return "<tr>" + schema.columns.map(function (column, index) {
        var value = displayValue(schema, record, column);
        if (index === 0) return '<td><strong>' + esc(value) + '</strong><div class="record-meta">' + esc(record.notes || record.brief || record.description || "") + "</div></td>";
        if (column === schema.status || ["status", "visibility", "availability", "deposit"].indexOf(column) > -1) return '<td><span class="status-pill ' + statusClass(value) + '">' + esc(value) + "</span></td>";
        return "<td>" + esc(value || "-") + "</td>";
      }).join("") + '<td><div class="row-actions"><button class="table-action" data-edit="' + record.id + '" type="button">Edit</button>' + (schema.actions && schema.actions.indexOf("generateProject") > -1 ? '<button class="table-action" data-generate="' + record.id + '" type="button">Project</button>' : "") + (schema.actions && schema.actions.indexOf("copyLink") > -1 ? '<button class="table-action" data-copy-link="' + record.id + '" type="button">Copy Link</button>' : "") + (schema.actions && schema.actions.indexOf("downloadPdf") > -1 ? '<button class="table-action" data-download-pdf="' + record.id + '" type="button">PDF</button>' : "") + '<button class="table-action" data-archive="' + record.id + '" type="button">Archive</button><button class="table-action" data-delete="' + record.id + '" type="button">Delete</button></div></td></tr>';
    }).join("") + "</tbody></table>";
  }

  function displayValue(schema, record, column) {
    var field = schema.fields.find(function (item) { return item.name === column; });
    var value = record[column];
    if (field && field.type === "relation") return label(field.collection, value);
    if (column === "price" || column === "amount") return money(value);
    if (column === "remaining" && record.editionSize) return value === "" || value == null ? Number(record.editionSize || 0) - Number(record.sold || 0) : value;
    return value;
  }

  function titleCase(value) {
    return String(value).replace(/([A-Z])/g, " $1").replace(/^./, function (char) { return char.toUpperCase(); });
  }

  function statusClass(value) {
    var text = String(value || "").toLowerCase();
    if (/paid|active|confirmed|scheduled|visible|published|delivered|available|signed|sent|ready|downloaded|viewed/.test(text)) return "good";
    if (/awaiting|review|proposal|draft|reserved|scheduled|partially|preparing|requested|editing/.test(text)) return "warn";
    if (/overdue|cancel|lost|expired|sold out|hidden|archived/.test(text)) return "bad";
    return "";
  }

  function bindModule(schema) {
    document.querySelector("[data-module-search]").addEventListener("input", function (event) {
      state.query = event.target.value;
      refreshTable(schema);
    });
    document.querySelector("[data-filter]").addEventListener("change", function (event) {
      state.filter = event.target.value;
      refreshTable(schema);
    });
    document.querySelector("[data-new]").addEventListener("click", function () { openModal(schema, null); });
    bindTableRows(schema);
  }

  // Re-renders only the results table (not the search input / filter select /
  // New button), so typing in the module search box never loses focus.
  function refreshTable(schema) {
    var wrap = document.querySelector(".records-table-wrap");
    if (!wrap) return;
    wrap.innerHTML = table(schema, filtered(schema));
    bindTableRows(schema);
  }

  function bindTableRows(schema) {
    document.querySelectorAll("[data-edit]").forEach(function (button) { button.addEventListener("click", function () { openModal(schema, byId(schema.collection, button.dataset.edit)); }); });
    document.querySelectorAll("[data-archive]").forEach(function (button) { button.addEventListener("click", function () { archiveRecord(schema, button.dataset.archive); }); });
    document.querySelectorAll("[data-delete]").forEach(function (button) { button.addEventListener("click", function () { deleteRecord(schema, button.dataset.delete); }); });
    document.querySelectorAll("[data-generate]").forEach(function (button) { button.addEventListener("click", function () { generateProject(button.dataset.generate); }); });
    document.querySelectorAll("[data-copy-link]").forEach(function (button) { button.addEventListener("click", function () { copyGalleryLink(button.dataset.copyLink); }); });
    document.querySelectorAll("[data-download-pdf]").forEach(function (button) { button.addEventListener("click", function () { downloadRecordPdf(schema, button.dataset.downloadPdf); }); });
  }

  function pdfLetterhead(doc, title) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("LGNDRY.Co", 20, 24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("Visual Storytelling Studio  |  Limpopo, South Africa  |  info@lgndry-co.co.za", 20, 30);
    doc.setDrawColor(220, 220, 220);
    doc.line(20, 36, 190, 36);
    doc.setTextColor(29, 29, 29);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(title, 20, 48);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
  }

  function buildInvoicePdf(record) {
    var doc = new window.jspdf.jsPDF();
    pdfLetterhead(doc, (record.type || "Invoice").toUpperCase() + "  " + (record.number || ""));

    var y = 60;
    doc.text("Billed to: " + label("clients", record.client), 20, y);
    y += 6;
    if (record.due) { doc.text("Due date: " + record.due, 20, y); y += 6; }
    doc.text("Status: " + (record.status || "-"), 20, y);
    y += 14;

    doc.setFont("helvetica", "bold");
    doc.text("Line items", 20, y);
    doc.setFont("helvetica", "normal");
    y += 8;

    var items = String(record.items || "").split("\n").map(function (line) { return line.trim(); }).filter(Boolean);
    if (!items.length) items = ["-"];
    items.forEach(function (line) {
      var wrapped = doc.splitTextToSize(line, 170);
      doc.text(wrapped, 20, y);
      y += 6 * wrapped.length;
    });

    y += 8;
    doc.setDrawColor(220, 220, 220);
    doc.line(20, y, 190, y);
    y += 10;

    doc.text("Amount: " + money(record.amount), 20, y);
    y += 6;
    if (record.vat) { doc.text("VAT: " + money(record.vat), 20, y); y += 6; }
    doc.setFont("helvetica", "bold");
    doc.text("Total: " + money(Number(record.amount || 0) + Number(record.vat || 0)), 20, y);

    doc.save((record.number || "invoice") + ".pdf");
  }

  function buildDocumentPdf(record) {
    var doc = new window.jspdf.jsPDF();
    pdfLetterhead(doc, record.title || "Document");

    var y = 60;
    doc.text("Type: " + (record.type || "-"), 20, y);
    y += 6;
    if (record.client) { doc.text("Client: " + label("clients", record.client), 20, y); y += 6; }
    if (record.project) { doc.text("Project: " + label("projects", record.project), 20, y); y += 6; }
    doc.text("Status: " + (record.status || "-"), 20, y);
    y += 14;

    if (record.body) {
      var wrapped = doc.splitTextToSize(record.body, 170);
      doc.text(wrapped, 20, y);
    }

    doc.save((record.title || "document") + ".pdf");
  }

  function downloadRecordPdf(schema, recordId) {
    var record = byId(schema.collection, recordId);
    if (!record) return;
    if (!window.jspdf || !window.jspdf.jsPDF) {
      toast("PDF generator failed to load. Check your connection and try again.");
      return;
    }
    if (schema.collection === "invoices") buildInvoicePdf(record);
    else if (schema.collection === "documents") buildDocumentPdf(record);
  }

  function copyGalleryLink(recordId) {
    var url = window.location.origin + "/gallery.html?id=" + recordId;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        toast("Gallery link copied.");
      }).catch(function () {
        toast(url);
      });
    } else {
      toast(url);
    }
  }

  function openModal(schema, record) {
    state.editing = { schema: schema, record: record };
    document.querySelector("[data-modal-title]").textContent = (record ? "Edit " : "New ") + singular(schema.title);
    document.querySelector("[data-form-fields]").innerHTML = schema.fields.map(function (field) { return renderField(field, record ? record[field.name] : field.placeholder); }).join("");
    document.querySelector("[data-modal]").classList.add("is-open");
    document.querySelector("[data-modal]").setAttribute("aria-hidden", "false");
  }

  function renderField(field, value) {
    var wide = field.type === "textarea" || ["notes", "brief", "copy", "body", "deliverables", "tasks", "files", "comments"].indexOf(field.name) > -1;
    var safeValue = (value === undefined || value === null) ? "" : value;
    var control = "";
    if (field.type === "select") {
      control = '<select name="' + field.name + '" ' + (field.required ? "required" : "") + '><option value="">Select</option>' + field.options.map(function (option) { return '<option ' + (String(safeValue) === option ? "selected" : "") + ' value="' + esc(option) + '">' + esc(option) + "</option>"; }).join("") + "</select>";
    } else if (field.type === "relation") {
      control = '<select name="' + field.name + '" ' + (field.required ? "required" : "") + '><option value="">Unlinked</option>' + active(field.collection).map(function (record) { return '<option ' + (String(safeValue) === record.id ? "selected" : "") + ' value="' + record.id + '">' + esc(label(field.collection, record.id)) + "</option>"; }).join("") + "</select>";
    } else if (field.type === "textarea") {
      control = '<textarea name="' + field.name + '" ' + (field.required ? "required" : "") + ' placeholder="' + esc(field.placeholder) + '">' + esc(safeValue) + "</textarea>";
    } else {
      control = '<input name="' + field.name + '" type="' + field.type + '" ' + (field.required ? "required" : "") + ' value="' + esc(safeValue) + '" placeholder="' + esc(field.placeholder) + '">';
    }
    return '<label class="form-field ' + (wide ? "form-field--wide" : "") + '"><span class="form-label">' + esc(field.label) + (field.required ? " *" : "") + "</span>" + control + '<span class="error-text" data-error="' + field.name + '"></span></label>';
  }

  function closeModal() {
    document.querySelector("[data-modal]").classList.remove("is-open");
    document.querySelector("[data-modal]").setAttribute("aria-hidden", "true");
    state.editing = null;
  }

  function submitForm(event) {
    event.preventDefault();
    var schema = state.editing.schema;
    var form = event.currentTarget;
    var wasNew = !state.editing.record;
    var next = state.editing.record ? Object.assign({}, state.editing.record) : { id: newUuid() };
    var ok = true;
    schema.fields.forEach(function (field) {
      var input = form.elements[field.name];
      var value = input ? input.value.trim() : "";
      var error = document.querySelector('[data-error="' + field.name + '"]');
      if (field.required && !value) {
        ok = false;
        if (error) error.textContent = "Required";
      } else if (error) {
        error.textContent = "";
      }
      next[field.name] = field.type === "number" && value !== "" ? Number(value) : value;
    });
    if (!ok) {
      toast("Please complete the required fields.");
      return;
    }
    var list = data[schema.collection];
    var index = list.findIndex(function (record) { return record.id === next.id; });
    if (index > -1) list[index] = next;
    else list.unshift(next);
    persistRecord(schema.collection, next);
    logActivity((wasNew ? "Created " : "Updated ") + singular(schema.title) + ' "' + label(schema.collection, next.id) + '"');
    closeModal();
    toast("Saved successfully.");
    render();
  }

  function archiveRecord(schema, recordId) {
    var record = byId(schema.collection, recordId);
    if (!record) return;
    confirmDialog("This record will be hidden from active views but kept in the database.", { title: "Archive this record?", confirmLabel: "Archive", danger: false }).then(function (confirmed) {
      if (!confirmed) return;
      record.archived = true;
      if (schema.status) record[schema.status] = "Archived";
      persistRecord(schema.collection, record);
      logActivity("Archived " + singular(schema.title) + ' "' + label(schema.collection, recordId) + '"');
      toast("Record archived.");
      render();
    });
  }

  function deleteRecord(schema, recordId) {
    var record = byId(schema.collection, recordId);
    var recordLabel = record ? label(schema.collection, recordId) : "record";
    confirmDialog("This will permanently remove it from the studio database. This cannot be undone.", { title: "Delete this record?", confirmLabel: "Delete" }).then(function (confirmed) {
      if (!confirmed) return;
      data[schema.collection] = data[schema.collection].filter(function (r) { return r.id !== recordId; });
      deleteRecordRemote(schema.collection, recordId);
      logActivity("Deleted " + singular(schema.title) + ' "' + recordLabel + '"');
      toast("Record deleted.");
      render();
    });
  }

  function generateProject(bookingId) {
    var booking = byId("bookings", bookingId);
    if (!booking) return;
    var existing = active("projects").find(function (project) { return project.booking === bookingId; });
    if (existing) {
      toast("This booking already has a project.");
      return;
    }
    var project = { id: newUuid(), name: booking.service + " / " + label("clients", booking.client), client: booking.client, booking: booking.id, type: booking.type, brief: booking.notes || "", moodboard: "", shotList: booking.shotList || "", deliverables: "", timeline: (booking.date || "") + " onwards", tasks: "Confirm brief\nShoot\nEdit\nDeliver", files: "", comments: "Generated from booking.", status: "Planning" };
    data.projects.unshift(project);
    booking.project = project.id;
    if (booking.status === "Confirmed") booking.status = "Scheduled";
    persistRecord("projects", project).then(function () { persistRecord("bookings", booking); });
    logActivity('Generated project "' + project.name + '" from booking');
    toast("Project generated from booking.");
    state.route = "projects";
    state.query = "";
    state.filter = "all";
    render();
  }

  function analytics() {
    var paid = active("invoices").filter(function (invoice) { return invoice.status === "Paid"; }).reduce(sumAmount, 0);
    var art = active("collection").reduce(function (total, artwork) { return total + Number(artwork.price || 0) * Number(artwork.sold || 0); }, 0);
    var outstanding = active("invoices").filter(function (invoice) { return invoice.status !== "Paid" && invoice.status !== "Cancelled"; }).reduce(sumAmount, 0);
    var avg = active("projects").length ? Math.round((paid + outstanding) / active("projects").length) : 0;
    var services = {};
    active("bookings").forEach(function (booking) { services[booking.service] = (services[booking.service] || 0) + 1; });
    var topServicesRows = Object.keys(services).map(function (name) { return barRow(name, services[name], Math.min(100, services[name] * 28)); }).join("");
    var revenueByClientRows = active("clients").map(function (client) { var sum = active("invoices").filter(function (invoice) { return invoice.client === client.id; }).reduce(sumAmount, 0); return barRow(client.name, money(sum), Math.min(100, sum / 250)); }).join("");
    return '<section class="analytics-grid">' + metric("Monthly Revenue", money(paid), "Paid invoices", icons.invoices) + metric("Artwork Sales", money(art), "Edition value", icons.collection) + metric("Outstanding", money(outstanding), "Open invoices", icons.invoices) + metric("Average Project", money(avg), "Current project value", icons.analytics) + metric("Returning Clients", active("clients").filter(function (c) { return c.status === "Returning"; }).length, "Relationship health", icons.clients) + '</section><section class="split-grid"><article class="panel"><div class="panel__header"><span class="panel__label">Top Services</span></div><div class="bar-list">' + (topServicesRows || '<p class="empty-state">No bookings yet.</p>') + '</div></article><article class="panel"><div class="panel__header"><span class="panel__label">Revenue by Client</span></div><div class="bar-list">' + (revenueByClientRows || '<p class="empty-state">No clients yet.</p>') + "</div></article></section>";
  }

  function barRow(labelText, value, width) {
    return '<div class="bar-row"><span>' + esc(labelText) + '</span><div class="bar-track"><span style="width:' + width + '%"></span></div><strong>' + esc(value) + "</strong></div>";
  }

  function pushSupported() {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  }

  function urlBase64ToUint8Array(base64String) {
    var padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    var rawData = window.atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; i++) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  function getPushSubscription() {
    if (!pushSupported()) return Promise.resolve(null);
    return navigator.serviceWorker.register("/push-sw.js").then(function (registration) {
      return registration.pushManager.getSubscription();
    }).catch(function () {
      return null;
    });
  }

  function enablePushNotifications() {
    return navigator.serviceWorker.register("/push-sw.js").then(function (registration) {
      return Notification.requestPermission().then(function (permission) {
        if (permission !== "granted") {
          throw new Error("Notification permission was not granted.");
        }
        return registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      });
    }).then(function (subscription) {
      var json = subscription.toJSON();
      return supabaseClient.from("push_subscriptions").upsert({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth
      }, { onConflict: "endpoint" }).then(function (result) {
        if (result.error) throw result.error;
        return subscription;
      });
    });
  }

  function disablePushNotifications() {
    return getPushSubscription().then(function (subscription) {
      if (!subscription) return;
      var endpoint = subscription.endpoint;
      return subscription.unsubscribe().then(function () {
        return supabaseClient.from("push_subscriptions").delete().eq("endpoint", endpoint);
      });
    });
  }

  function settings() {
    return '<section class="split-grid"><article class="panel"><div class="panel__header"><div><span class="panel__label">Storage</span><h2 class="panel__title">Cloud Command Center Data</h2></div></div><p class="record-meta">All modules persist to the LGNDRY.Co Supabase database and sync across devices. Export a JSON backup any time, or import one to restore.</p><div class="toolbar" style="justify-content:flex-start;margin-top:18px"><button class="primary-btn" data-export type="button">Export JSON</button><button class="ghost-btn" data-import type="button">Import JSON</button><button class="danger-btn" data-reset type="button">Reset Demo Data</button></div></article><article class="panel"><div class="panel__header"><div><span class="panel__label">Alerts</span><h2 class="panel__title">Lead Notifications</h2></div></div><p class="record-meta">Get a push notification on this device the moment a booking, partnership application or contact-form lead comes in from the website - even when the Command Center isn\'t open.</p><p class="record-meta" data-push-status>Checking notification status...</p><div class="toolbar" style="justify-content:flex-start;margin-top:18px"><button class="primary-btn" data-push-toggle type="button" disabled>Enable Lead Alerts</button></div></article><article class="panel"><div class="panel__header"><div><span class="panel__label">Access</span><h2 class="panel__title">Team</h2></div></div><p class="record-meta">Give other people their own login to the Command Center.</p><div data-team-list class="record-meta">Loading team...</div><div class="toolbar" style="justify-content:flex-start;margin-top:18px;flex-wrap:wrap"><input type="email" placeholder="Email address" data-team-email style="flex:1;min-width:180px"><input type="password" placeholder="Temporary password (min 8 chars)" data-team-password style="flex:1;min-width:180px"><button class="primary-btn" data-team-add type="button">Add Team Member</button></div><p class="record-meta" data-team-error></p></article><article class="panel"><div class="panel__header"><span class="panel__label">Operational Lifecycle</span></div><p>Enquiry - Client - Booking - Project - Shoot - Gallery Delivery - Invoice - Payment - Archive</p><p>Application - Discovery Call - Proposal - Contract - Onboarding - Active Partnership - Renewal</p><p>Artwork Upload - Purchase - Edition Tracking - Certificate - Shipping - Completed Order</p></article></section>';
  }

  function bindSettings() {
    document.querySelector("[data-export]").addEventListener("click", function () {
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = "lgndry-co-ops-export-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast("Export downloaded.");
    });
    document.querySelector("[data-import]").addEventListener("click", function () {
      var input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json";
      input.addEventListener("change", function () {
        var file = input.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          var parsed;
          try {
            parsed = JSON.parse(reader.result);
          } catch (error) {
            toast("Import failed. Check the JSON.");
            return;
          }
          importBundle(parsed);
        };
        reader.readAsText(file);
      });
      input.click();
    });
    document.querySelector("[data-reset]").addEventListener("click", function () {
      confirmDialog("All cloud command center data will be replaced with starter records. This cannot be undone.", { title: "Reset demo data?", confirmLabel: "Reset" }).then(function (confirmed) {
        if (!confirmed) return;
        resetDemoData();
      });
    });

    var pushStatusEl = document.querySelector("[data-push-status]");
    var pushToggleBtn = document.querySelector("[data-push-toggle]");

    function refreshPushUI(subscription) {
      if (!pushSupported()) {
        pushStatusEl.textContent = "Push notifications aren't supported in this browser.";
        pushToggleBtn.disabled = true;
        return;
      }
      if (subscription) {
        pushStatusEl.textContent = "Lead alerts are ON for this device.";
        pushToggleBtn.textContent = "Disable Lead Alerts";
        pushToggleBtn.className = "ghost-btn";
      } else {
        pushStatusEl.textContent = "Lead alerts are OFF for this device.";
        pushToggleBtn.textContent = "Enable Lead Alerts";
        pushToggleBtn.className = "primary-btn";
      }
      pushToggleBtn.disabled = false;
    }

    getPushSubscription().then(refreshPushUI);

    pushToggleBtn.addEventListener("click", function () {
      pushToggleBtn.disabled = true;
      getPushSubscription().then(function (existing) {
        if (existing) {
          return disablePushNotifications().then(function () {
            toast("Lead alerts turned off on this device.");
            return null;
          });
        }
        return enablePushNotifications().then(function (subscription) {
          toast("Lead alerts turned on for this device.");
          return subscription;
        });
      }).then(refreshPushUI).catch(function (error) {
        console.error(error);
        toast("Could not update lead alerts: " + error.message);
        pushToggleBtn.disabled = false;
      });
    });

    var teamListEl = document.querySelector("[data-team-list]");
    var teamErrorEl = document.querySelector("[data-team-error]");
    var teamAddBtn = document.querySelector("[data-team-add]");
    var teamEmailInput = document.querySelector("[data-team-email]");
    var teamPasswordInput = document.querySelector("[data-team-password]");

    function callTeamFunction(body) {
      return supabaseClient.functions.invoke("manage-team", { body: body }).then(function (result) {
        if (result.error) throw result.error;
        if (result.data && result.data.error) throw new Error(result.data.error);
        return result.data;
      });
    }

    function refreshTeamList() {
      teamListEl.textContent = "Loading team...";
      callTeamFunction({ action: "list" }).then(function (data) {
        var users = data.users || [];
        teamListEl.innerHTML = users.map(function (user) {
          var removeBtn = user.is_you ? "" : '<button class="table-action" data-team-remove="' + user.id + '" type="button">Remove</button>';
          return '<div class="activity"><p>' + esc(user.email) + (user.is_you ? " (you)" : "") + '</p>' + removeBtn + '</div>';
        }).join("") || "No team members yet.";
        teamListEl.querySelectorAll("[data-team-remove]").forEach(function (button) {
          button.addEventListener("click", function () {
            confirmDialog("Remove this person's access to the Command Center?", { title: "Remove team member?", confirmLabel: "Remove" }).then(function (confirmed) {
              if (!confirmed) return;
              callTeamFunction({ action: "remove", userId: button.dataset.teamRemove }).then(function () {
                toast("Team member removed.");
                refreshTeamList();
              }).catch(function (error) {
                toast("Could not remove: " + error.message);
              });
            });
          });
        });
      }).catch(function (error) {
        teamListEl.textContent = "Could not load team: " + error.message;
      });
    }

    refreshTeamList();

    teamAddBtn.addEventListener("click", function () {
      teamErrorEl.textContent = "";
      var email = teamEmailInput.value.trim();
      var password = teamPasswordInput.value;
      if (!email || password.length < 8) {
        teamErrorEl.textContent = "Enter an email and a password of at least 8 characters.";
        return;
      }
      teamAddBtn.disabled = true;
      callTeamFunction({ action: "invite", email: email, password: password }).then(function () {
        teamEmailInput.value = "";
        teamPasswordInput.value = "";
        toast("Team member added.");
        refreshTeamList();
      }).catch(function (error) {
        teamErrorEl.textContent = error.message;
      }).then(function () {
        teamAddBtn.disabled = false;
      });
    });
  }

  function importBundle(parsed) {
    var rowsByTable = {};
    Object.keys(parsed).forEach(function (collection) {
      if (TABLES.indexOf(collection) === -1 || !Array.isArray(parsed[collection])) return;
      rowsByTable[collection] = parsed[collection].map(normalizeForDb);
    });
    if (!Object.keys(rowsByTable).length) {
      toast("Nothing to import.");
      return;
    }
    persistRowsByTable(rowsByTable, "upsert").then(function () {
      return loadRemoteData();
    }).then(function (remoteData) {
      data = remoteData;
      toast("Data imported.");
      render();
    }).catch(function (error) {
      console.error(error);
      toast("Import failed: " + error.message);
    });
  }

  function bindDashboard() {
    document.querySelectorAll("[data-route-jump]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.route = button.dataset.routeJump;
        state.query = "";
        state.filter = "all";
        render();
      });
    });
  }

  function toast(message) {
    var element = document.querySelector("[data-toast]");
    element.textContent = message;
    element.classList.add("is-visible");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { element.classList.remove("is-visible"); }, 2600);
  }

  function confirmDialog(message, options) {
    options = options || {};
    var modal = document.querySelector("[data-confirm-modal]");
    var okBtn = modal.querySelector("[data-confirm-ok]");
    var cancelBtn = modal.querySelector("[data-confirm-cancel]");
    modal.querySelector("[data-confirm-title]").textContent = options.title || "Are you sure?";
    modal.querySelector("[data-confirm-message]").textContent = message;
    okBtn.textContent = options.confirmLabel || "Confirm";
    okBtn.className = options.danger === false ? "primary-btn" : "danger-btn";
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");

    return new Promise(function (resolve) {
      function cleanup(result) {
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        modal.removeEventListener("click", onBackdrop);
        document.removeEventListener("keydown", onKeydown);
        resolve(result);
      }
      function onOk() { cleanup(true); }
      function onCancel() { cleanup(false); }
      function onBackdrop(event) { if (event.target === modal) cleanup(false); }
      function onKeydown(event) { if (event.key === "Escape") cleanup(false); }
      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
      modal.addEventListener("click", onBackdrop);
      document.addEventListener("keydown", onKeydown);
    });
  }

  function initTheme() {
    var root = document.documentElement;
    var stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") root.setAttribute("data-theme", stored);
    syncTheme();
    document.querySelector("[data-theme-toggle]").addEventListener("click", function () {
      root.setAttribute("data-theme", root.getAttribute("data-theme") === "light" ? "dark" : "light");
      localStorage.setItem(THEME_KEY, root.getAttribute("data-theme"));
      syncTheme();
    });
  }

  function syncTheme() {
    var isLight = document.documentElement.getAttribute("data-theme") === "light";
    document.querySelector("[data-theme-label]").textContent = isLight ? "Dark mode" : "Light mode";
  }

  function closePopovers() {
    document.querySelectorAll(".popover.is-open").forEach(function (popover) { popover.classList.remove("is-open"); });
  }

  function togglePopover(popover) {
    var isOpen = popover.classList.contains("is-open");
    closePopovers();
    if (!isOpen) popover.classList.add("is-open");
  }

  function initPopovers() {
    document.querySelector("[data-bell-toggle]").addEventListener("click", function (event) {
      event.stopPropagation();
      var popover = document.querySelector("[data-bell-popover]");
      popover.innerHTML = '<span class="popover-title">Recent Activity</span><div class="activity-list">' + ((data.activity || []).slice(0, 5).map(function (entry) {
        return '<div class="activity"><span class="activity__icon">' + icons.activity + "</span><p>" + esc(entry.message) + '</p><span class="activity__time">' + esc(timeAgo(entry.at)) + "</span></div>";
      }).join("") || '<p class="empty-state">No activity yet.</p>') + "</div>";
      togglePopover(popover);
    });
    document.querySelector("[data-profile-toggle]").addEventListener("click", function (event) {
      event.stopPropagation();
      togglePopover(document.querySelector("[data-profile-popover]"));
    });
    document.querySelectorAll("[data-popover-route]").forEach(function (button) {
      button.addEventListener("click", function () {
        closePopovers();
        state.route = button.dataset.popoverRoute;
        state.query = "";
        state.filter = "all";
        render();
      });
    });
    document.querySelector("[data-sign-out]").addEventListener("click", function () {
      closePopovers();
      supabaseClient.auth.signOut();
    });
    document.addEventListener("click", function (event) {
      if (!event.target.closest(".popover-anchor")) closePopovers();
    });
  }

  function showLoadingGate() {
    document.querySelector("[data-auth-gate]").style.display = "none";
    document.querySelector("[data-ops-shell]").style.display = "none";
    document.querySelector("[data-loading-gate]").style.display = "";
  }

  function showApp() {
    document.querySelector("[data-loading-gate]").style.display = "none";
    document.querySelector("[data-auth-gate]").style.display = "none";
    document.querySelector("[data-ops-shell]").style.display = "";
  }

  function showAuthGate(message) {
    document.querySelector("[data-loading-gate]").style.display = "none";
    document.querySelector("[data-ops-shell]").style.display = "none";
    document.querySelector("[data-auth-gate]").style.display = "";
    var errorEl = document.querySelector("[data-auth-error]");
    if (errorEl) errorEl.textContent = message || "";
  }

  function bootAfterAuth() {
    showLoadingGate();
    loadRemoteData().then(function (remoteData) {
      if (!hasAnyRemoteRecords(remoteData)) return migrateLocalData().then(loadRemoteData);
      return remoteData;
    }).then(function (finalData) {
      data = finalData;
      showApp();
      if (!chromeInitialized) {
        initTheme();
        initPopovers();
        chromeInitialized = true;
      }
      render();
    }).catch(function (error) {
      console.error(error);
      showAuthGate("Failed to load studio data. Please refresh.");
    });
  }

  function initAuth() {
    document.querySelector("[data-auth-form]").addEventListener("submit", function (event) {
      event.preventDefault();
      var form = event.currentTarget;
      var submitButton = document.querySelector("[data-auth-submit]");
      submitButton.disabled = true;
      submitButton.textContent = "Signing in...";
      supabaseClient.auth.signInWithPassword({
        email: form.elements.email.value.trim(),
        password: form.elements.password.value
      }).then(function (result) {
        submitButton.disabled = false;
        submitButton.textContent = "Sign In";
        if (result.error) {
          document.querySelector("[data-auth-error]").textContent = result.error.message;
          return;
        }
        form.reset();
      }).catch(function (error) {
        submitButton.disabled = false;
        submitButton.textContent = "Sign In";
        document.querySelector("[data-auth-error]").textContent = error.message;
      });
    });

    supabaseClient.auth.onAuthStateChange(function (event, session) {
      if (event === "SIGNED_OUT") {
        data = { activity: [] };
        showAuthGate();
        return;
      }
      if ((event === "INITIAL_SESSION" || event === "SIGNED_IN") && session) {
        bootAfterAuth();
      }
    });
  }

  document.addEventListener("click", function (event) {
    var route = event.target.closest("[data-route]");
    if (!route) return;
    state.route = route.dataset.route;
    state.query = "";
    state.filter = "all";
    render();
  });

  function recordDisplayName(record) {
    return record.name || record.title || record.service || record.number || record.company || record.section || "Record";
  }

  function globalSearchMatches(query) {
    var q = query.trim().toLowerCase();
    if (!q) return [];
    var results = [];
    Object.keys(schemas).forEach(function (route) {
      var schema = schemas[route];
      if (results.length >= 8 || !schema.collection) return;
      active(schema.collection).forEach(function (record) {
        if (results.length >= 8) return;
        if (JSON.stringify(record).toLowerCase().indexOf(q) === -1) return;
        results.push({ route: route, schema: schema, record: record });
      });
    });
    return results;
  }

  function renderGlobalSearchResults(query) {
    var panel = document.querySelector("[data-search-results]");
    if (!panel) return;
    var q = query.trim();
    if (!q) {
      panel.classList.remove("is-open");
      panel.innerHTML = "";
      return;
    }
    var matches = globalSearchMatches(q);
    if (!matches.length) {
      panel.innerHTML = '<p class="global-search__empty">No matches for &ldquo;' + esc(q) + '&rdquo;.</p>';
      panel.classList.add("is-open");
      return;
    }
    panel.innerHTML = matches.map(function (match, index) {
      return '<button type="button" class="global-search__item" data-search-jump="' + index + '"><span class="global-search__label">' + esc(recordDisplayName(match.record)) + '</span><span class="global-search__type">' + esc(match.schema.title) + '</span></button>';
    }).join("");
    panel.classList.add("is-open");
    panel.querySelectorAll("[data-search-jump]").forEach(function (button) {
      button.addEventListener("click", function () {
        var match = matches[Number(button.dataset.searchJump)];
        if (!match) return;
        state.route = match.route;
        state.query = "";
        state.filter = "all";
        document.querySelector("[data-global-search]").value = "";
        panel.classList.remove("is-open");
        render();
        openModal(match.schema, match.record);
      });
    });
  }

  document.querySelector("[data-global-search]").addEventListener("input", function (event) {
    state.query = event.target.value;
    renderGlobalSearchResults(state.query);
    if (schemas[state.route]) render();
  });

  document.addEventListener("click", function (event) {
    var panel = document.querySelector("[data-search-results]");
    if (!panel || !panel.classList.contains("is-open")) return;
    if (event.target.closest(".search")) return;
    panel.classList.remove("is-open");
  });

  document.querySelectorAll("[data-close-modal]").forEach(function (button) {
    button.addEventListener("click", closeModal);
  });

  document.querySelector("[data-modal]").addEventListener("click", function (event) {
    if (event.target.matches("[data-modal]")) closeModal();
  });

  document.querySelector("[data-form]").addEventListener("submit", submitForm);
  window.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeModal();
  });

  initAuth();
}());
