(function () {
  "use strict";

  var STORAGE_KEY = "lgndry_ops_command_center_v2";
  var THEME_KEY = "lgndry_admin_theme";
  var SUPABASE_URL = "https://tscaluhtfrvwlwjybfsg.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_UAS3aUpb9Aj7lbVBPkWncA_l4ghKr4w";
  var supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  var VAPID_PUBLIC_KEY = "BM_IQFlZnwcu7g4r34KumlYmAJWP0sH4O2_3SNhvqT2gF4hP3enZGP9vgnxZN-FTIpRrXyKByvyb0gMhEA7h4es";
  var chromeInitialized = false;
  var TABLES = ["clients", "practice", "bookings", "projects", "partnerships", "collection", "orders", "galleries", "content", "journal", "cms", "budgets", "invoices", "documents"];
  var state = { route: "dashboard", query: "", filter: "all", editing: null, detail: null, columnFilters: {}, selected: {} };
  var data = { activity: [] };
  window.LgndryOpsSnapshot = function () { return data; };

  var icons = {
    dashboard: svg('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>'),
    clients: svg('<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>'),
    bookings: svg('<rect x="4" y="5" width="16" height="15" rx="1"/><path d="M8 3v4M16 3v4M4 10h16"/>'),
    projects: svg('<path d="M3 7h18v13H3z"/><path d="M8 7V4h8v3"/>'),
    partnerships: svg('<path d="M8 12h8M12 8v8"/><circle cx="12" cy="12" r="9"/>'),
    collection: svg('<path d="M6 8h12l1 13H5z"/><path d="M9 8a3 3 0 0 1 6 0"/>'),
    orders: svg('<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M7 15l3-3 3 3 2-2 3 4"/><circle cx="8" cy="9" r="1.4"/>'),
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
    ["collection", "Collection"], ["orders", "Orders"],
    ["content", "Content Library"], ["practice", "Practice"], ["journal", "Journal"],
    ["cms", "Website CMS"], ["budgets", "Form Pricing"], ["invoices", "Invoices"], ["analytics", "Analytics"],
    ["documents", "Documents"], ["settings", "Settings"]
  ];

  var DETAIL_ROUTES = ["clients", "bookings", "projects", "partnerships", "collection", "orders"];

  var schemas = {
    clients: {
      title: "Clients",
      subtitle: "Manage studio relationships, histories, assets, documents and brand notes.",
      collection: "clients", display: "name", status: "status",
      columns: ["name", "type", "contact", "email", "status"],
      fields: [
        h("Contact"),
        f("name", "Client name", "text", true), f("type", "Client type", "select", true, ["Individual", "Company"]), f("contact", "Contact person", "text", true), f("email", "Email", "email", true), f("phone", "Phone number", "tel"),
        h("Branding"),
        f("image", "Logo", "image"), f("guidelines", "Brand guidelines", "textarea"),
        h("Status & Notes"),
        f("status", "Status", "select", true, ["Lead", "Active", "Returning", "Archived"]), f("notes", "Notes", "textarea")
      ]
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
      fields: [
        h("Booking"),
        rel("client", "Client", "clients", true), f("service", "Service", "text", true), f("type", "Booking type", "select", true, ["Enquiry", "Campaign", "Portrait", "Product", "Partnership", "Collection"]), f("photographer", "Assigned photographer"),
        h("Date & Location"),
        f("date", "Date", "date", true), f("start", "Start time", "time"), f("end", "End time", "time"), f("location", "Location"),
        h("Status"),
        f("status", "Status", "select", true, ["Enquiry", "Awaiting Deposit", "Confirmed", "Scheduled", "Completed", "Delivered", "Cancelled"]), f("deposit", "Deposit status", "select", true, ["Not Requested", "Requested", "Paid", "Waived"]), rel("project", "Related project", "projects"),
        h("Notes"),
        f("shotList", "Shot list", "textarea"), f("notes", "Notes", "textarea")
      ],
      actions: ["generateProject"]
    },
    projects: {
      title: "Projects",
      subtitle: "Track briefs, timelines, tasks, files, comments and deliverables from planning to archive.",
      collection: "projects", display: "name", status: "status",
      columns: ["name", "client", "type", "status", "timeline"],
      fields: [
        h("Project"),
        f("name", "Project name", "text", true), f("image", "Cover image", "image"), rel("client", "Client", "clients", true), rel("booking", "Booking", "bookings"), f("type", "Project type", "text", true), f("status", "Workflow status", "select", true, ["Planning", "Shoot Scheduled", "Editing", "Client Review", "Delivered", "Archived"]), f("timeline", "Timeline"),
        h("Creative Brief"),
        f("brief", "Brief", "textarea"), f("moodboard", "Moodboard links / uploads", "textarea"), f("shotList", "Shot list", "textarea"), f("deliverables", "Deliverables", "textarea"),
        h("Workflow"),
        f("tasks", "Tasks", "textarea"), f("files", "Files", "textarea"), f("comments", "Comments", "textarea")
      ]
    },
    partnerships: {
      title: "Brand Partnerships",
      subtitle: "Move prospects from application to active annual creative partnerships.",
      collection: "partnerships", display: "company", status: "status",
      columns: ["company", "contact", "status", "sessionsRemaining", "end"],
      fields: [
        h("Brand"),
        rel("client", "Client", "clients"), f("company", "Company / client", "text", true), f("contact", "Contact person", "text", true), f("status", "Pipeline stage", "select", true, ["Applied", "Discovery Call", "Proposal", "Negotiation", "Signed", "Onboarding", "Active", "Renewal", "Lost"]),
        h("Application"),
        f("application", "Application details", "textarea"),
        h("Contract Terms"),
        f("duration", "Contract duration", "text", false, null, "Annual Creative Partnership - minimum 12-month term"), f("start", "Contract start date", "date"), f("end", "Contract end date", "date"), f("deliverables", "Monthly deliverables", "textarea"), f("allowance", "Monthly shoot allowance", "number"), f("sessionsRemaining", "Remaining sessions", "number"),
        h("Documents & Notes"),
        f("proposal", "Proposal link / notes", "textarea"), f("contract", "Contract link / notes", "textarea"), f("review", "Quarterly review notes", "textarea")
      ]
    },
    collection: {
      title: "Collection",
      subtitle: "Manage art listings, editions, sales, certificates and delivery tracking.",
      collection: "collection", display: "title", status: "availability",
      columns: ["title", "collectionName", "price", "remaining", "availability"],
      fields: [
        h("Artwork"),
        f("title", "Artwork title", "text", true), f("collectionName", "Collection name", "text", true), f("category", "Category", "select", true, ["Art Print", "Studio Art", "Limited Edition"]), f("year", "Year", "number"), f("description", "Description / story", "textarea"), f("position", "Display order on the website (lower shows first)", "number", true),
        h("Photos"),
        f("image", "Main image", "image", true), f("images", "Additional images (optional)", "imagelist"),
        h("Pricing & Availability"),
        f("seriesLabel", "Print description (e.g. 'Archival Pigment Print' or 'A series of 3 images')", "text", true), f("sizes", "Print sizes offered (one per line)", "textarea", true), f("price", "Price", "number", true), f("editionSize", "Edition size", "number", true), f("sold", "Editions sold", "number", true), f("remaining", "Editions remaining", "number"), f("availability", "Availability", "select", true, ["Available", "Reserved", "Sold Out", "Hidden"]),
        h("Sale & Delivery"),
        f("customer", "Latest customer"), f("editionNumber", "Latest edition number", "number"), f("payment", "Payment status", "select", false, ["Pending In Person", "Paid In Person", "Reserved", "Cancelled"]), f("shipping", "Shipping status", "select", false, ["Not Started", "Preparing", "Shipped", "Delivered", "Collected"]), f("tracking", "Tracking number"), f("certificate", "Certificate status", "select", false, ["Not Issued", "Issued", "Archived"])
      ]
    },
    invoices: {
      title: "Invoices & Payments",
      subtitle: "Create quotes, invoices and receipts linked to clients, shoots, projects and orders.",
      collection: "invoices", display: "number", status: "status",
      columns: ["number", "client", "type", "amount", "status"],
      fields: [
        h("Document"),
        f("number", "Document number", "text", true), f("type", "Document type", "select", true, ["Quote", "Invoice", "Receipt"]), rel("client", "Client", "clients", true), rel("project", "Project / booking / order", "projects"),
        h("Line Items & Amount"),
        f("items", "Line items (one per line, e.g. 'Brand Shoot — R5,000')", "textarea", true), f("amount", "Amount", "number", true), f("vat", "VAT", "number"), f("due", "Due date", "date"),
        h("Payment"),
        f("status", "Payment status", "select", true, ["Draft", "Sent", "Paid", "Partially Paid", "Overdue", "Cancelled"]), f("paidAt", "Payment date", "date")
      ],
      actions: ["downloadPdf"]
    },
    orders: {
      title: "Orders",
      subtitle: "Review collection requests, confirm availability and manage fulfilment through completion.",
      collection: "orders", display: "orderNumber", status: "status",
      columns: ["orderNumber", "customerName", "itemSummary", "quantity", "submittedAt", "status"],
      fields: [
        h("Order"),
        f("orderNumber", "Order number", "text", true), f("status", "Order status", "select", true, ["New Request", "Contacted", "Confirmed", "Preparing", "Ready for Collection", "Out for Delivery", "Completed", "Cancelled"]), f("submittedAt", "Date and time submitted", "datetime-local", true),
        h("Customer"),
        f("customerName", "Customer name", "text", true), f("customerEmail", "Email address", "email", true), f("customerPhone", "Phone / WhatsApp", "tel", true),
        h("Items"),
        f("itemSummary", "Selected artwork or gallery items", "textarea", true), f("quantity", "Total quantity", "number", true), f("subtotal", "Order subtotal", "number", true),
        h("Delivery"),
        f("deliveryMethod", "Delivery method", "select", true, ["Deliver to my address", "Collect in person"]), f("deliveryAddress", "Delivery address", "textarea", true), f("deliveryCity", "City / town", "text", true), f("postalCode", "Postal code", "text", true),
        h("Notes"),
        f("notes", "Order notes or special instructions", "textarea")
      ]
    },
    content: {
      title: "Content Library",
      subtitle: "Search, tag and connect assets to clients, projects, orders and campaigns.",
      collection: "content", display: "title", status: "status",
      columns: ["title", "client", "project", "category", "status"],
      fields: [f("title", "Asset title", "text", true), rel("client", "Client", "clients"), rel("project", "Project", "projects"), f("shootDate", "Shoot date", "date"), f("category", "Category", "select", true, ["Raw", "Edited", "Social", "Campaign", "Archive", "Website"]), f("tags", "Tags"), f("fileType", "File type", "select", true, ["Image", "Video", "PDF", "Document", "Link"]), f("file", "File", "file"), f("status", "Status", "select", true, ["Active", "Linked", "Archived"])]
    },
    journal: {
      title: "Journal",
      subtitle: "Plan, schedule and publish editorial stories for the website.",
      collection: "journal", display: "title", status: "status",
      columns: ["title", "slug", "category", "status", "published"],
      fields: [
        h("Story"),
        f("title", "Title", "text", true), f("category", "Category"), f("image", "Featured image", "image"),
        h("Content"),
        f("body", "Body content", "textarea"),
        h("Publishing"),
        f("slug", "Web address", "text", true, null, "e.g. slowing-down-to-see"), f("published", "Published date", "date"), f("status", "Status", "select", true, ["Draft", "Scheduled", "Published", "Archived"]),
        h("Search Engine Details"),
        f("seoTitle", "Search engine title"), f("seoDescription", "Search engine description", "textarea")
      ]
    },
    cms: {
      title: "Website CMS",
      subtitle: "Update live website copy, imagery, collaborations and calls-to-action without code.",
      collection: "cms", display: "section", status: "status",
      columns: ["section", "area", "status", "updated"],
      fields: [f("section", "Website section", "select", true, ["Homepage", "About", "Practice", "Collection", "Contact", "Collaborations", "Calls-to-action"]), f("area", "Content area", "text", true), f("copy", "Copy", "textarea"), f("image", "Image", "image"), f("cta", "Call-to-action"), f("status", "Status", "select", true, ["Draft", "Ready", "Published", "Archived"]), f("updated", "Updated date", "date")]
    },
    budgets: {
      title: "Form Pricing",
      subtitle: "Control the budget range options shown on the booking, contact and partnership forms.",
      collection: "budgets", display: "label", status: "visibility",
      columns: ["form", "label", "position", "visibility"],
      fields: [f("form", "Applies to which form", "select", true, ["Booking", "Contact", "Partnership"]), f("label", "Budget range label", "text", true), f("position", "Order", "number", true), f("visibility", "Website visibility", "select", true, ["Visible", "Hidden", "Archived"])]
    },
    documents: {
      title: "Documents",
      subtitle: "Generate and track contracts, NDAs, briefs, call sheets and releases.",
      collection: "documents", display: "title", status: "status",
      columns: ["title", "type", "client", "project", "status"],
      fields: [
        h("Document"),
        f("title", "Document title", "text", true), f("type", "Document type", "select", true, ["Contract", "NDA", "Proposal", "Creative Brief", "Call Sheet", "Model Release", "Location Release"]), rel("client", "Client", "clients"), rel("project", "Project / booking / partnership", "projects"), f("status", "Status", "select", true, ["Draft", "Sent", "Signed", "Expired", "Archived"]),
        h("Content"),
        f("body", "Document text", "textarea", true),
        h("Files"),
        f("template", "Template file", "file"), f("signed", "Signed copy", "file")
      ],
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

  function h(label) {
    return { name: "", label: label, type: "heading" };
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
      orders: [],
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
        if (result.error) {
          if (table === "orders" && (result.error.code === "42P01" || result.error.code === "PGRST205")) {
            console.warn("Orders table is not available yet. Apply the bundled Supabase migration.");
            return { table: table, rows: [] };
          }
          throw result.error;
        }
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
    var laterTables = ["partnerships", "invoices", "orders", "galleries", "content", "documents"];

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
    return record.name || record.title || record.service || record.orderNumber || record.number || record.company || record.section || "Record";
  }

  function render() {
    renderNav();
    if (state.detail) {
      var detailSchema = schemas[state.detail.route];
      var detailRecord = detailSchema && byId(detailSchema.collection, state.detail.id);
      if (detailSchema && detailRecord && supportsDetail(detailSchema)) {
        setTitle("View " + detailType(detailSchema), "Manage the complete record, related work and activity.");
        view().innerHTML = detailView(detailSchema, detailRecord);
        bindDetail(detailSchema, detailRecord);
        return;
      }
      state.detail = null;
    }
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


  function emptyState(title, message, icon, actionLabel, actionAttribute, compact) {
    var action = actionLabel && actionAttribute
      ? '<button class="empty-state-card__action" type="button" ' + actionAttribute + '>' + esc(actionLabel) + '<span>&rarr;</span></button>'
      : "";
    return '<section class="empty-state-card' + (compact ? " empty-state-card--compact" : "") + '">' +
      '<span class="empty-state-card__icon">' + (icon || icons.dashboard) + '</span>' +
      '<div class="empty-state-card__copy"><h3>' + esc(title) + '</h3><p>' + esc(message) + "</p></div>" +
      action + "</section>";
  }

  function recentProjects(projects) {
    var rows = projects.slice(0, 5).map(function (project) {
      var progress = PROJECT_PROGRESS[project.status] != null ? PROJECT_PROGRESS[project.status] : 10;
      var statusCls = statusClass(project.status);
      var dotClass = statusCls === "warn" || statusCls === "bad" ? "dot dot--warn" : "dot";
      return '<div class="project record-preview--clickable" data-dashboard-detail="projects" data-record-id="' + project.id + '" tabindex="0"><img src="' + esc(project.image || "assests/images/hero-image.JPG") + '" alt="">' +
        "<div><h3>" + esc(project.name) + "</h3><p>" + esc(label("clients", project.client)) + "</p></div>" +
        '<span class="project__status"><span class="' + dotClass + '"></span>' + esc(project.status) + "</span>" +
        '<span class="project__progress">' + progress + '%</span>' +
        '<div class="bar"><span style="--value:' + progress + '%"></span></div></div>';
    }).join("");
    return '<article class="panel"><div class="panel__header"><span class="panel__label">Recent Projects</span></div><div class="project-list">' + (rows || emptyState("No projects yet", "New projects will appear here once they are created.", icons.projects, "", "", true)) + '</div><div class="panel__footer"><button class="panel__link" type="button" data-route-jump="projects">View all projects<span>&rarr;</span></button></div></article>';
  }

  function recentActivity() {
    var rows = (data.activity || []).slice(0, 6).map(function (entry) {
      return '<div class="activity"><span class="activity__icon">' + icons.activity + "</span><p>" + esc(entry.message) + '</p><span class="activity__time">' + esc(timeAgo(entry.at)) + "</span></div>";
    }).join("");
    return '<article class="panel"><div class="panel__header"><span class="panel__label">Recent Activity</span></div><div class="activity-list">' + (rows || emptyState("No activity yet", "Updates and record changes will appear here.", icons.activity, "", "", true)) + "</div></article>";
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
      var targetRoute = DETAIL_ROUTES.find(function (candidate) { return byId(schemas[candidate].collection, record.id); }) || route;
      return '<div class="snapshot-item record-preview--clickable" data-dashboard-detail="' + targetRoute + '" data-record-id="' + record.id + '" tabindex="0"><span class="status-pill ' + statusClass(status) + '">' + esc(status) + '</span><div><strong>' + esc(name) + '</strong><p class="record-meta">' + esc(meta) + '</p></div><button class="table-action" type="button">Open</button></div>';
    }).join("");
    return '<article class="panel"><div class="panel__header"><span class="panel__label">' + esc(title) + '</span></div><div class="snapshot-list">' + (rows || emptyState("Nothing here yet", "Records matching this view will appear here.", icons.dashboard, "", "", true)) + "</div></article>";
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
        return '<div class="pipeline-card record-preview--clickable" data-dashboard-detail="partnerships" data-record-id="' + p.id + '" tabindex="0"><strong>' + esc(p.company) + '</strong><p class="record-meta">' + esc(p.contact) + " / " + esc(p.sessionsRemaining || 0) + " sessions</p></div>";
      }).join("");
      return '<div class="pipeline-stage"><h3>' + esc(stage) + "</h3>" + (cards || emptyState("No records", "This pipeline stage is currently clear.", icons.partnerships, "", "", true)) + "</div>";
    }).join("") + "</div></article>";
  }

  function calendar(items) {
    var rows = items.slice(0, 5).map(function (booking) {
      var date = new Date(booking.date + "T00:00:00");
      return '<div class="calendar-item record-preview--clickable" data-dashboard-detail="bookings" data-record-id="' + booking.id + '" tabindex="0"><div class="calendar-date">' + date.getDate() + "<span>" + date.toLocaleDateString("en-ZA", { month: "short" }) + "</span></div><div><strong>" + esc(booking.service) + '</strong><p class="record-meta">' + esc(label("clients", booking.client)) + " / " + esc((booking.start || "") + " - " + (booking.end || "")) + "</p></div></div>";
    }).join("");
    return '<article class="panel"><div class="panel__header"><span class="panel__label">Calendar Snapshot</span></div><div class="calendar-list">' + (rows || emptyState("No upcoming bookings", "Scheduled sessions will appear here.", icons.bookings, "", "", true)) + "</div></article>";
  }


  function supportsDetail(schema) {
    return !!schema && DETAIL_ROUTES.indexOf(schema.collection) > -1;
  }

  function routeForSchema(schema) {
    return Object.keys(schemas).find(function (route) { return schemas[route] === schema; }) || schema.collection;
  }

  function detailType(schema) {
    var value = singular(schema.title);
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function detailStatus(schema, record) {
    return record[schema.status] || record.status || record.visibility || record.availability || "Active";
  }

  function detailNavigate(route, recordId, replace) {
    var schema = schemas[route];
    if (!schema || !supportsDetail(schema) || !byId(schema.collection, recordId)) return;
    state.route = route;
    state.detail = { route: route, id: recordId };
    state.query = "";
    state.filter = "all";
    var method = replace ? "replaceState" : "pushState";
    if (window.history && window.history[method]) window.history[method]({ route: route, id: recordId }, "", "#" + route + "/" + encodeURIComponent(recordId));
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function detailBack(schema) {
    var route = routeForSchema(schema);
    state.route = route;
    state.detail = null;
    if (window.history && window.history.pushState) window.history.pushState({ route: route }, "", "#" + route);
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function syncDetailFromHash() {
    var parts = window.location.hash.replace(/^#/, "").split("/");
    var route = parts[0];
    if (!schemas[route]) return;
    state.route = route;
    state.detail = parts[1] && supportsDetail(schemas[route]) ? { route: route, id: decodeURIComponent(parts.slice(1).join("/")) } : null;
  }

  function detailSummary(schema, record) {
    return schema.columns.slice(0, 4).map(function (column) {
      var value = displayValue(schema, record, column);
      return '<div class="detail-stat"><span>' + esc(titleCase(column)) + '</span><strong>' + esc(value || "-") + "</strong></div>";
    }).join("");
  }

  function relatedRecords(schema, record) {
    var currentRoute = routeForSchema(schema);
    var found = [];
    var seen = {};
    schema.fields.forEach(function (field) {
      if (field.type !== "relation" || !record[field.name]) return;
      var linkedSchema = schemas[field.collection];
      var linked = byId(field.collection, record[field.name]);
      if (!linked || !linkedSchema) return;
      var key = field.collection + ":" + linked.id;
      if (!seen[key]) found.push({ route: field.collection, schema: linkedSchema, record: linked, context: field.label });
      seen[key] = true;
    });
    Object.keys(schemas).forEach(function (route) {
      var linkedSchema = schemas[route];
      if (!linkedSchema || !linkedSchema.fields) return;
      linkedSchema.fields.filter(function (field) {
        return field.type === "relation" && field.collection === schema.collection;
      }).forEach(function (field) {
        active(linkedSchema.collection).filter(function (item) { return item[field.name] === record.id; }).slice(0, 6).forEach(function (item) {
          var key = linkedSchema.collection + ":" + item.id;
          if (!seen[key]) found.push({ route: route, schema: linkedSchema, record: item, context: linkedSchema.title });
          seen[key] = true;
        });
      });
    });
    return found.filter(function (item) { return !(item.route === currentRoute && item.record.id === record.id); });
  }

  function detailRelatedMarkup(schema, record) {
    var items = relatedRecords(schema, record);
    if (!items.length) return emptyState("No linked records", "Connections to clients, bookings and projects will appear here.", icons.projects, "", "", true);
    return items.slice(0, 10).map(function (item) {
      var canOpen = supportsDetail(item.schema);
      return '<button class="detail-link-card" type="button" data-related-route="' + esc(item.route) + '" data-related-id="' + esc(item.record.id) + '" data-related-detail="' + (canOpen ? "true" : "false") + '"><span>' + esc(item.context) + '</span><strong>' + esc(recordDisplayName(item.record)) + '</strong><small>' + esc(detailStatus(item.schema, item.record)) + '</small></button>';
    }).join("");
  }

  function detailActivityMarkup(record) {
    var name = recordDisplayName(record).toLowerCase();
    var related = (data.activity || []).filter(function (item) {
      return String(item.message || "").toLowerCase().indexOf(name) > -1;
    });
    var items = (related.length ? related : (data.activity || [])).slice(0, 6);
    if (!items.length) return emptyState("No activity recorded", "Changes to this record will build its history here.", icons.activity, "", "", true);
    return items.map(function (item) {
      var date = item.at ? new Date(item.at) : null;
      return '<div class="detail-activity"><span class="detail-activity__dot"></span><div><strong>' + esc(item.message || "Record updated") + '</strong><small>' + esc(date && !isNaN(date) ? date.toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" }) : "") + "</small></div></div>";
    }).join("");
  }

  function detailDocumentsMarkup(schema, record) {
    var docs = active("documents").filter(function (doc) {
      if (schema.collection === "clients") return doc.client === record.id;
      if (schema.collection === "projects") return doc.project === record.id;
      return (record.client && doc.client === record.client) || (record.project && doc.project === record.project);
    }).slice(0, 6);
    if (!docs.length) return emptyState("No related documents", "Contracts, briefs and agreements will appear here.", icons.documents, "", "", true);
    return docs.map(function (doc) {
      return '<button class="detail-document" type="button" data-related-route="documents" data-related-id="' + esc(doc.id) + '" data-related-detail="false"><span>' + icons.documents + '</span><div><strong>' + esc(doc.title) + '</strong><small>' + esc((doc.type || "Document") + " / " + (doc.status || "")) + "</small></div></button>";
    }).join("");
  }


  function parseOrderItems(record) {
    if (Array.isArray(record.items)) return record.items;
    if (!record.items) return [];
    try {
      var parsed = JSON.parse(record.items);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function orderItemsMarkup(record) {
    var items = parseOrderItems(record);
    if (!items.length) return emptyState("No item data", "The selected works were not included with this order.", icons.collection, "", "", true);
    return '<div class="order-items">' + items.map(function (item) {
      var image = item.image ? '<img src="' + esc(item.image) + '" alt="">' : '<span class="order-item__placeholder">' + icons.collection + '</span>';
      var artwork = item.artworkId && byId("collection", item.artworkId);
      var open = artwork ? ' data-related-route="collection" data-related-id="' + esc(artwork.id) + '" data-related-detail="true"' : "";
      return '<button class="order-item" type="button"' + open + '>' + image + '<div><strong>' + esc(item.title || "Artwork") + '</strong><span>' + esc((item.quantity || 1) + " x " + (item.size || "Size not specified")) + '</span><small>' + money(item.lineTotal || (Number(item.unitPrice || 0) * Number(item.quantity || 1))) + "</small></div></button>";
    }).join("") + "</div>";
  }

  function detailView(schema, record) {
    var status = detailStatus(schema, record);
    var image = record.image ? '<div class="detail-hero__image"><img src="' + esc(record.image) + '" alt=""></div>' : "";
    var orderPanel = schema.collection === "orders" ? '<section class="detail-panel"><div class="detail-panel__head"><span class="eyebrow">Requested works</span><h3>Order items</h3></div>' + orderItemsMarkup(record) + "</section>" : "";
    var bookingAction = schema.collection === "bookings" ? '<button class="secondary-action" type="button" data-detail-generate>Generate Project</button>' : "";
    return '<section class="record-detail">' +
      '<button class="detail-back" type="button" data-detail-back><span>&larr;</span> Back to ' + esc(schema.title) + '</button>' +
      '<header class="detail-hero">' + image + '<div class="detail-hero__content"><span class="eyebrow">' + esc(detailType(schema)) + ' record</span><div class="detail-hero__title"><div><h2>' + esc(recordDisplayName(record)) + '</h2><p>Created for the LGNDRY.Co studio workflow</p></div><span class="status-pill ' + statusClass(status) + '">' + esc(status) + '</span></div><div class="detail-stats">' + detailSummary(schema, record) + '</div></div></header>' +
      '<div class="detail-layout"><main class="detail-main"><form class="detail-editor" data-detail-form><div class="detail-section-head"><div><span class="eyebrow">Record information</span><h3>Edit ' + esc(detailType(schema)) + '</h3></div><span>Changes sync to the studio database</span></div><div class="form-grid detail-form-grid">' + schema.fields.map(function (field) { return renderField(field, record[field.name]); }).join("") + '</div><div class="detail-savebar"><span data-detail-save-status>Review changes before saving.</span><button class="primary-action" type="submit">Save Changes</button></div></form></main>' +
      '<aside class="detail-aside">' + orderPanel + '<section class="detail-panel"><div class="detail-panel__head"><span class="eyebrow">Linked records</span><h3>Related work</h3></div><div class="detail-link-list">' + detailRelatedMarkup(schema, record) + '</div></section>' +
      '<section class="detail-panel"><div class="detail-panel__head"><span class="eyebrow">Documents</span><h3>Files & agreements</h3></div>' + detailDocumentsMarkup(schema, record) + '</section>' +
      '<section class="detail-panel"><div class="detail-panel__head"><span class="eyebrow">Activity</span><h3>Recent history</h3></div><div class="detail-activity-list">' + detailActivityMarkup(record) + '</div></section>' +
      '<section class="detail-panel detail-actions"><div class="detail-panel__head"><span class="eyebrow">Actions</span><h3>Manage record</h3></div>' + bookingAction + '<button class="secondary-action" type="button" data-detail-archive>Archive Record</button><button class="danger-btn" type="button" data-detail-delete>Delete Record</button></section></aside></div></section>';
  }

  function submitDetailForm(event, schema, record) {
    event.preventDefault();
    var form = event.currentTarget;
    var next = Object.assign({}, record);
    var valid = true;
    schema.fields.forEach(function (field) {
      if (field.type === "heading") return;
      var input = form.elements[field.name];
      var value = input ? input.value.trim() : "";
      var error = form.querySelector('[data-error="' + field.name + '"]');
      if (field.required && !value) {
        valid = false;
        if (error) error.textContent = "Required";
      } else if (error) error.textContent = "";
      next[field.name] = field.type === "number" && value !== "" ? Number(value) : value;
    });
    if (!valid) {
      toast("Please complete the required fields.");
      return;
    }
    var list = data[schema.collection];
    var index = list.findIndex(function (item) { return item.id === record.id; });
    if (index > -1) list[index] = next;
    persistRecord(schema.collection, next);
    logActivity('Updated ' + singular(schema.title) + ' "' + recordDisplayName(next) + '"');
    toast("Changes saved.");
    render();
  }

  function bindDetail(schema, record) {
    document.querySelector("[data-detail-back]").addEventListener("click", function () { detailBack(schema); });
    document.querySelector("[data-detail-form]").addEventListener("submit", function (event) { submitDetailForm(event, schema, record); });
    document.querySelectorAll("[data-related-route]").forEach(function (button) {
      button.addEventListener("click", function () {
        var route = button.dataset.relatedRoute;
        if (button.dataset.relatedDetail === "true") {
          detailNavigate(route, button.dataset.relatedId);
        } else {
          state.route = route;
          state.detail = null;
          state.query = recordDisplayName(byId(schemas[route].collection, button.dataset.relatedId) || record);
          render();
        }
      });
    });
    var generate = document.querySelector("[data-detail-generate]");
    if (generate) generate.addEventListener("click", function () {
      state.detail = null;
      generateProject(record.id);
    });
    document.querySelector("[data-detail-archive]").addEventListener("click", function () { archiveRecord(schema, record.id); });
    document.querySelector("[data-detail-delete]").addEventListener("click", function () { deleteRecord(schema, record.id); });
  }

  function moduleView(schema) {
    var records = filtered(schema);
    var statusOptions = statuses(schema);
    var currentExtra = state.columnFilters[schema.collection] || {};
    var extraFiltersHtml = filterableFields(schema).map(function (field) {
      var options = fieldFilterOptions(schema, field);
      var current = currentExtra[field.name] || "all";
      return '<select data-column-filter="' + field.name + '"><option value="all">Any ' + esc(field.label) + '</option>' + options.map(function (option) {
        return '<option ' + (current === option.value ? "selected" : "") + ' value="' + esc(option.value) + '">' + esc(option.text) + "</option>";
      }).join("") + "</select>";
    }).join("");
    var dateFiltersHtml = dateFilterableFields(schema).map(function (field) {
      var fromVal = currentExtra[field.name + "_from"] || "";
      var toVal = currentExtra[field.name + "_to"] || "";
      return '<span class="date-filter" data-date-filter-group="' + field.name + '"><span class="date-filter__label">' + esc(field.label) + '</span><input type="date" data-date-filter-from="' + field.name + '" value="' + esc(fromVal) + '" aria-label="' + esc(field.label) + ' from"><span class="date-filter__sep">&rarr;</span><input type="date" data-date-filter-to="' + field.name + '" value="' + esc(toVal) + '" aria-label="' + esc(field.label) + ' to"></span>';
    }).join("");
    var hasActiveFilters = state.filter !== "all" || Object.keys(currentExtra).some(function (key) { return currentExtra[key] && currentExtra[key] !== "all"; });
    return '<div class="module-head"><div><span class="eyebrow">Operations Module</span><h2>' + esc(schema.title) + "</h2><p>" + esc(schema.subtitle) + '</p></div><div class="toolbar"><input type="search" placeholder="Search ' + esc(schema.title.toLowerCase()) + '" value="' + esc(state.query) + '" data-module-search><select data-filter><option value="all">All statuses</option>' + statusOptions.map(function (status) { return '<option ' + (state.filter === status ? "selected" : "") + ' value="' + esc(status) + '">' + esc(status) + "</option>"; }).join("") + "</select>" + extraFiltersHtml + dateFiltersHtml + (hasActiveFilters ? '<button class="ghost-btn" data-clear-filters type="button">Clear Filters</button>' : "") + '<button class="primary-btn" data-new type="button">New ' + esc(singular(schema.title)) + "</button></div></div>" +
      '<div class="records-table-wrap">' + table(schema, records) + "</div>";
  }

  function singular(title) {
    return title.replace("Brand Partnerships", "partnership").replace("Content Library", "asset").replace("Invoices & Payments", "invoice").replace("Form Pricing", "budget option").replace(/s$/, "").toLowerCase();
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
    var extra = state.columnFilters[schema.collection] || {};
    Object.keys(extra).forEach(function (key) {
      if (/_from$/.test(key) || /_to$/.test(key)) return;
      var value = extra[key];
      if (!value || value === "all") return;
      rows = rows.filter(function (record) { return String(record[key] || "") === value; });
    });
    dateFilterableFields(schema).forEach(function (field) {
      var from = extra[field.name + "_from"];
      var to = extra[field.name + "_to"];
      if (from) rows = rows.filter(function (record) { return record[field.name] && record[field.name] >= from; });
      if (to) rows = rows.filter(function (record) { return record[field.name] && record[field.name] <= to; });
    });
    return rows;
  }

  function filterableFields(schema) {
    return schema.fields.filter(function (field) {
      if (field.name === schema.status) return false;
      if (["status", "visibility", "availability"].indexOf(field.name) > -1) return false;
      return field.type === "select" || field.type === "relation";
    });
  }

  function dateFilterableFields(schema) {
    return schema.fields.filter(function (field) { return field.type === "date"; });
  }

  function fieldFilterOptions(schema, field) {
    if (field.type === "relation") {
      return active(field.collection).map(function (record) { return { value: record.id, text: label(field.collection, record.id) }; });
    }
    var found = {};
    active(schema.collection).forEach(function (record) { if (record[field.name]) found[record[field.name]] = true; });
    (field.options || []).forEach(function (option) { found[option] = true; });
    return Object.keys(found).map(function (value) { return { value: value, text: value }; });
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

  function bulkBar(schema, rows) {
    var selected = state.selected[schema.collection] || [];
    var visibleIds = rows.map(function (record) { return record.id; });
    var selectedVisible = selected.filter(function (id) { return visibleIds.indexOf(id) > -1; });
    if (!selectedVisible.length) return "";
    return '<div class="bulk-bar"><span>' + selectedVisible.length + " selected</span><button class=\"ghost-btn\" data-bulk-archive type=\"button\">Archive Selected</button><button class=\"danger-btn\" data-bulk-delete type=\"button\">Delete Selected</button><button class=\"ghost-btn\" data-bulk-clear type=\"button\">Clear Selection</button></div>";
  }

  function table(schema, rows) {
    var bar = bulkBar(schema, rows);
    if (!rows.length) {
      var hasRecords = active(schema.collection).length > 0;
      var emptyTitle = hasRecords ? "No matching records" : "No " + schema.title.toLowerCase() + " yet";
      var emptyMessage = hasRecords ? "Try clearing the current search and filters to see more results." : "Create the first record to begin managing this area.";
      var emptyAction = hasRecords ? "Clear filters" : "Create " + detailType(schema);
      var emptyAttr = hasRecords ? "data-empty-clear" : "data-empty-new";
      return bar + '<div class="records-empty-wrap">' + emptyState(emptyTitle, emptyMessage, icons[schema.collection] || icons.dashboard, emptyAction, emptyAttr, false) + "</div>";
    }
    var selected = state.selected[schema.collection] || [];
    var allSelected = rows.length > 0 && rows.every(function (record) { return selected.indexOf(record.id) > -1; });
    var hasDetail = supportsDetail(schema);
    return bar + '<table class="records-table"><thead><tr><th class="records-table__check"><input type="checkbox" data-select-all ' + (allSelected ? "checked" : "") + ' aria-label="Select all"></th>' + schema.columns.map(function (column) { return "<th>" + esc(titleCase(column)) + "</th>"; }).join("") + "<th>Actions</th></tr></thead><tbody>" + rows.map(function (record) {
      var isChecked = selected.indexOf(record.id) > -1;
      var rowAttrs = hasDetail ? ' class="record-row--clickable" data-view-record="' + record.id + '" tabindex="0" aria-label="View ' + esc(recordDisplayName(record)) + '"' : "";
      var primaryAction = hasDetail ? '<button class="table-action table-action--view" data-open-record="' + record.id + '" type="button">View</button>' : '<button class="table-action" data-edit="' + record.id + '" type="button">Edit</button>';
      return "<tr" + rowAttrs + '><td class="records-table__check"><input type="checkbox" data-select-row="' + record.id + '" ' + (isChecked ? "checked" : "") + ' aria-label="Select row"></td>' + schema.columns.map(function (column, index) {
        var value = displayValue(schema, record, column);
        if (index === 0) return '<td><strong>' + esc(value) + '</strong><div class="record-meta">' + esc(record.notes || record.brief || record.description || "") + "</div></td>";
        if (column === schema.status || ["status", "visibility", "availability", "deposit"].indexOf(column) > -1) return '<td><span class="status-pill ' + statusClass(value) + '">' + esc(value) + "</span></td>";
        return "<td>" + esc(value || "-") + "</td>";
      }).join("") + '<td><div class="row-actions">' + primaryAction + (schema.actions && schema.actions.indexOf("generateProject") > -1 ? '<button class="table-action" data-generate="' + record.id + '" type="button">Project</button>' : "") + (schema.actions && schema.actions.indexOf("copyLink") > -1 ? '<button class="table-action" data-copy-link="' + record.id + '" type="button">Copy Link</button>' : "") + (schema.actions && schema.actions.indexOf("downloadPdf") > -1 ? '<button class="table-action" data-download-pdf="' + record.id + '" type="button">PDF</button>' : "") + '<button class="table-action" data-archive="' + record.id + '" type="button">Archive</button><button class="table-action" data-delete="' + record.id + '" type="button">Delete</button></div></td></tr>';
    }).join("") + "</tbody></table>";
  }

  function displayValue(schema, record, column) {
    var field = schema.fields.find(function (item) { return item.name === column; });
    var value = record[column];
    if (field && field.type === "relation") return label(field.collection, value);
    if (column === "price" || column === "amount" || column === "subtotal") return money(value);
    if (column === "submittedAt" && value) { var submitted = new Date(value); return isNaN(submitted) ? value : submitted.toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" }); }
    if (column === "remaining" && record.editionSize) return value === "" || value == null ? Number(record.editionSize || 0) - Number(record.sold || 0) : value;
    return value;
  }

  function titleCase(value) {
    return String(value).replace(/([A-Z])/g, " $1").replace(/^./, function (char) { return char.toUpperCase(); });
  }

  function statusClass(value) {
    var text = String(value || "").toLowerCase();
    if (/paid|active|confirmed|scheduled|visible|published|delivered|available|signed|sent|ready|downloaded|viewed/.test(text)) return "good";
    if (/awaiting|review|proposal|draft|reserved|scheduled|partially|preparing|request|editing/.test(text)) return "warn";
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
      render();
    });
    document.querySelectorAll("[data-column-filter]").forEach(function (select) {
      select.addEventListener("change", function (event) {
        state.columnFilters[schema.collection] = state.columnFilters[schema.collection] || {};
        state.columnFilters[schema.collection][event.target.dataset.columnFilter] = event.target.value;
        render();
      });
    });
    document.querySelectorAll("[data-date-filter-from]").forEach(function (input) {
      input.addEventListener("change", function (event) {
        state.columnFilters[schema.collection] = state.columnFilters[schema.collection] || {};
        state.columnFilters[schema.collection][event.target.dataset.dateFilterFrom + "_from"] = event.target.value;
        render();
      });
    });
    document.querySelectorAll("[data-date-filter-to]").forEach(function (input) {
      input.addEventListener("change", function (event) {
        state.columnFilters[schema.collection] = state.columnFilters[schema.collection] || {};
        state.columnFilters[schema.collection][event.target.dataset.dateFilterTo + "_to"] = event.target.value;
        render();
      });
    });
    var clearBtn = document.querySelector("[data-clear-filters]");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        state.filter = "all";
        state.columnFilters[schema.collection] = {};
        render();
      });
    }
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
    document.querySelectorAll("[data-empty-new]").forEach(function (button) {
      button.addEventListener("click", function () { openModal(schema, null); });
    });
    document.querySelectorAll("[data-empty-clear]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.query = "";
        state.filter = "all";
        state.columnFilters[schema.collection] = {};
        render();
      });
    });
    document.querySelectorAll("[data-edit]").forEach(function (button) { button.addEventListener("click", function () { openModal(schema, byId(schema.collection, button.dataset.edit)); }); });
    document.querySelectorAll("[data-open-record]").forEach(function (button) {
      button.addEventListener("click", function () { detailNavigate(routeForSchema(schema), button.dataset.openRecord); });
    });
    document.querySelectorAll("[data-view-record]").forEach(function (row) {
      function openFromRow(event) {
        if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
        if (event.target.closest("button,input,a,select,label")) return;
        event.preventDefault();
        detailNavigate(routeForSchema(schema), row.dataset.viewRecord);
      }
      row.addEventListener("click", openFromRow);
      row.addEventListener("keydown", openFromRow);
    });
    document.querySelectorAll("[data-archive]").forEach(function (button) { button.addEventListener("click", function () { archiveRecord(schema, button.dataset.archive); }); });
    document.querySelectorAll("[data-delete]").forEach(function (button) { button.addEventListener("click", function () { deleteRecord(schema, button.dataset.delete); }); });
    document.querySelectorAll("[data-generate]").forEach(function (button) { button.addEventListener("click", function () { generateProject(button.dataset.generate); }); });
    document.querySelectorAll("[data-copy-link]").forEach(function (button) { button.addEventListener("click", function () { copyGalleryLink(button.dataset.copyLink); }); });
    document.querySelectorAll("[data-download-pdf]").forEach(function (button) { button.addEventListener("click", function () { downloadRecordPdf(schema, button.dataset.downloadPdf); }); });
    document.querySelectorAll("[data-select-row]").forEach(function (checkbox) {
      checkbox.addEventListener("change", function (event) {
        var id = event.target.dataset.selectRow;
        var current = state.selected[schema.collection] || [];
        if (event.target.checked) {
          if (current.indexOf(id) === -1) current = current.concat([id]);
        } else {
          current = current.filter(function (existing) { return existing !== id; });
        }
        state.selected[schema.collection] = current;
        refreshTable(schema);
      });
    });
    var selectAll = document.querySelector("[data-select-all]");
    if (selectAll) {
      selectAll.addEventListener("change", function (event) {
        var visibleIds = filtered(schema).map(function (record) { return record.id; });
        var current = state.selected[schema.collection] || [];
        if (event.target.checked) {
          visibleIds.forEach(function (id) { if (current.indexOf(id) === -1) current.push(id); });
        } else {
          current = current.filter(function (id) { return visibleIds.indexOf(id) === -1; });
        }
        state.selected[schema.collection] = current;
        refreshTable(schema);
      });
    }
    var bulkArchiveBtn = document.querySelector("[data-bulk-archive]");
    if (bulkArchiveBtn) bulkArchiveBtn.addEventListener("click", function () { bulkArchive(schema); });
    var bulkDeleteBtn = document.querySelector("[data-bulk-delete]");
    if (bulkDeleteBtn) bulkDeleteBtn.addEventListener("click", function () { bulkDelete(schema); });
    var bulkClearBtn = document.querySelector("[data-bulk-clear]");
    if (bulkClearBtn) bulkClearBtn.addEventListener("click", function () { state.selected[schema.collection] = []; refreshTable(schema); });
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

  function uploadToMedia(file, folder) {
    var extMatch = /\.[a-zA-Z0-9]+$/.exec(file.name || "");
    var ext = extMatch ? extMatch[0].toLowerCase() : "";
    var path = folder + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ext;
    return supabaseClient.storage.from("media").upload(path, file, { cacheControl: "3600", upsert: false }).then(function (result) {
      if (result.error) throw result.error;
      return supabaseClient.storage.from("media").getPublicUrl(path).data.publicUrl;
    });
  }

  function startUpload(file, statusEl, onSuccess) {
    if (!file) return;
    statusEl.textContent = "Uploading...";
    uploadToMedia(file, "uploads").then(function (url) {
      statusEl.textContent = "Uploaded";
      setTimeout(function () { statusEl.textContent = ""; }, 2000);
      onSuccess(url);
    }).catch(function (error) {
      console.error(error);
      statusEl.textContent = "Upload failed: " + (error.message || "please try again.");
    });
  }

  function deleteFromMediaIfOwned(url) {
    if (!url) return;
    var marker = "/storage/v1/object/public/media/";
    var idx = url.indexOf(marker);
    if (idx === -1) return;
    var path = url.slice(idx + marker.length);
    supabaseClient.storage.from("media").remove([path]).catch(function (error) {
      console.error("Failed to remove replaced file:", error);
    });
  }

  function syncImagelistValue(field) {
    var urls = Array.prototype.map.call(field.querySelectorAll("[data-imagelist-item]"), function (item) {
      return item.getAttribute("data-url");
    });
    field.querySelector("[data-imagelist-value]").value = urls.join("\n");
  }

  function documentTemplateContext() {
    var form = document.querySelector("[data-form]");
    var clientId = form.elements.client ? form.elements.client.value : "";
    var projectId = form.elements.project ? form.elements.project.value : "";
    var client = byId("clients", clientId) || {};
    var project = byId("projects", projectId) || {};
    var booking = project.booking ? byId("bookings", project.booking) || {} : {};
    var partnership = active("partnerships").find(function (item) { return item.client === clientId; }) || {};
    var invoice = active("invoices").find(function (item) { return (projectId && item.project === projectId) || (clientId && item.client === clientId); }) || {};
    var partnershipTimeline = partnership.start || "";
    if (partnership.end) partnershipTimeline += (partnershipTimeline ? " to " : "") + partnership.end;
    return {
      date: new Date().toISOString().slice(0, 10),
      client: client.name,
      contact: client.contact,
      email: client.email,
      phone: client.phone,
      project: project.name || booking.service || partnership.company,
      scope: project.brief || booking.notes || partnership.application,
      deliverables: project.deliverables || partnership.deliverables,
      timeline: project.timeline || booking.date || partnershipTimeline,
      location: booking.location,
      callTime: booking.start,
      wrapTime: booking.end,
      fees: invoice.amount ? money(invoice.amount) : "",
      payment: invoice.due ? "Payment due by " + invoice.due + "." : ""
    };
  }

  function updateDocumentTemplate() {
    if (!state.editing || state.editing.schema.collection !== "documents" || !window.LgndryDocumentTemplates) return;
    var form = document.querySelector("[data-form]");
    var type = form.elements.type ? form.elements.type.value : "";
    var body = form.elements.body;
    if (!body || !type) return;
    var context = documentTemplateContext();
    body.value = window.LgndryDocumentTemplates(type, context);
    body.dataset.templateGenerated = "true";
    var title = form.elements.title;
    if (title && (!title.value || title.dataset.templateGenerated === "true")) {
      title.value = type + " - " + (context.project || context.client || "New document");
      title.dataset.templateGenerated = "true";
    }
  }

  function initializeDocumentTemplate(record) {
    var form = document.querySelector("[data-form]");
    var body = form.elements.body;
    if (body && (!record || !body.value.trim())) updateDocumentTemplate();
  }
  function openModal(schema, record) {
    state.editing = { schema: schema, record: record };
    document.querySelector("[data-modal-title]").textContent = (record ? "Edit " : "New ") + singular(schema.title);
    document.querySelector("[data-form-fields]").innerHTML = schema.fields.map(function (field) { return renderField(field, record ? record[field.name] : field.placeholder); }).join("");
    document.querySelector("[data-modal]").classList.add("is-open");
    document.querySelector("[data-modal]").setAttribute("aria-hidden", "false");
    if (schema.collection === "documents") initializeDocumentTemplate(record);
  }

  function renderField(field, value) {
    if (field.type === "heading") {
      return '<div class="form-section-heading form-field--wide"><span>' + esc(field.label) + "</span></div>";
    }
    var wide = ["textarea", "image", "imagelist", "file"].indexOf(field.type) > -1 || ["notes", "brief", "copy", "body", "deliverables", "tasks", "files", "comments"].indexOf(field.name) > -1;
    var safeValue = (value === undefined || value === null) ? "" : value;
    if (field.type === "datetime-local" && safeValue) safeValue = String(safeValue).slice(0, 16);
    var control = "";
    if (field.type === "select") {
      control = '<select name="' + field.name + '" ' + (field.required ? "required" : "") + '><option value="">Select</option>' + field.options.map(function (option) { return '<option ' + (String(safeValue) === option ? "selected" : "") + ' value="' + esc(option) + '">' + esc(option) + "</option>"; }).join("") + "</select>";
    } else if (field.type === "relation") {
      control = '<select name="' + field.name + '" ' + (field.required ? "required" : "") + '><option value="">Unlinked</option>' + active(field.collection).map(function (record) { return '<option ' + (String(safeValue) === record.id ? "selected" : "") + ' value="' + record.id + '">' + esc(label(field.collection, record.id)) + "</option>"; }).join("") + "</select>";
    } else if (field.type === "textarea") {
      control = '<textarea name="' + field.name + '" ' + (field.required ? "required" : "") + ' placeholder="' + esc(field.placeholder) + '">' + esc(safeValue) + "</textarea>";
    } else if (field.type === "image") {
      control = '<div class="image-field" data-image-field data-image-folder="' + esc(field.name) + '">' +
        '<div class="image-field__drop" data-image-dropzone>' +
          (safeValue ? '<img class="image-field__preview" src="' + esc(safeValue) + '" data-image-preview>' : '<div class="image-field__placeholder" data-image-preview><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg><span>Drop an image or click to choose</span></div>') +
        "</div>" +
        '<div class="image-field__actions"><button type="button" class="ghost-btn" data-image-trigger>' + (safeValue ? "Replace Image" : "Choose Image") + '</button><span class="image-field__status" data-image-status></span></div>' +
        '<input type="file" accept="image/*" hidden data-image-input>' +
        '<input type="hidden" name="' + field.name + '" value="' + esc(safeValue) + '" ' + (field.required ? "required" : "") + " data-image-value>" +
      "</div>";
    } else if (field.type === "imagelist") {
      var listUrls = String(safeValue || "").split("\n").map(function (line) { return line.trim(); }).filter(Boolean);
      control = '<div class="imagelist-field" data-imagelist-field>' +
        '<div class="imagelist-field__grid" data-imagelist-grid>' +
          listUrls.map(function (url) {
            return '<div class="imagelist-field__item" data-imagelist-item data-url="' + esc(url) + '"><img src="' + esc(url) + '"><button type="button" class="imagelist-field__remove" data-imagelist-remove aria-label="Remove image">&times;</button></div>';
          }).join("") +
          '<button type="button" class="imagelist-field__add" data-imagelist-trigger><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 5v14M5 12h14"/></svg><span>Add</span></button>' +
        "</div>" +
        '<span class="image-field__status" data-imagelist-status></span>' +
        '<input type="file" accept="image/*" hidden data-imagelist-input>' +
        '<textarea name="' + field.name + '" hidden data-imagelist-value>' + esc(listUrls.join("\n")) + "</textarea>" +
      "</div>";
    } else if (field.type === "file") {
      var fileName = safeValue ? safeValue.split("/").pop() : "";
      control = '<div class="file-field" data-file-field>' +
        '<div class="file-field__current" data-file-current>' + (safeValue ? '<a href="' + esc(safeValue) + '" target="_blank" rel="noopener">' + esc(fileName) + "</a>" : '<span class="file-field__placeholder">No file chosen</span>') + "</div>" +
        '<div class="image-field__actions"><button type="button" class="ghost-btn" data-file-trigger>' + (safeValue ? "Replace File" : "Choose File") + '</button><span class="image-field__status" data-file-status></span></div>' +
        '<input type="file" hidden data-file-input>' +
        '<input type="hidden" name="' + field.name + '" value="' + esc(safeValue) + '" ' + (field.required ? "required" : "") + " data-file-value>" +
      "</div>";
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
      if (field.type === "heading") return;
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

  function recordWord(count) {
    return count === 1 ? "record" : "records";
  }

  function bulkArchive(schema) {
    var ids = (state.selected[schema.collection] || []).slice();
    if (!ids.length) return;
    var word = recordWord(ids.length);
    confirmDialog("These " + ids.length + " " + word + " will be hidden from active views but kept in the database.", { title: "Archive " + ids.length + " " + word + "?", confirmLabel: "Archive", danger: false }).then(function (confirmed) {
      if (!confirmed) return;
      ids.forEach(function (recordId) {
        var record = byId(schema.collection, recordId);
        if (!record) return;
        record.archived = true;
        if (schema.status) record[schema.status] = "Archived";
        persistRecord(schema.collection, record);
      });
      logActivity("Archived " + ids.length + " " + schema.title.toLowerCase() + " " + word);
      toast(ids.length + " " + word + " archived.");
      state.selected[schema.collection] = [];
      render();
    });
  }

  function bulkDelete(schema) {
    var ids = (state.selected[schema.collection] || []).slice();
    if (!ids.length) return;
    var word = recordWord(ids.length);
    confirmDialog("This will permanently remove " + ids.length + " " + word + " from the studio database. This cannot be undone.", { title: "Delete " + ids.length + " " + word + "?", confirmLabel: "Delete" }).then(function (confirmed) {
      if (!confirmed) return;
      ids.forEach(function (recordId) {
        data[schema.collection] = data[schema.collection].filter(function (r) { return r.id !== recordId; });
        deleteRecordRemote(schema.collection, recordId);
      });
      logActivity("Deleted " + ids.length + " " + schema.title.toLowerCase() + " " + word);
      toast(ids.length + " " + word + " deleted.");
      state.selected[schema.collection] = [];
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
    return '<section class="analytics-grid">' + metric("Monthly Revenue", money(paid), "Paid invoices", icons.invoices) + metric("Artwork Sales", money(art), "Edition value", icons.collection) + metric("Outstanding", money(outstanding), "Open invoices", icons.invoices) + metric("Average Project", money(avg), "Current project value", icons.analytics) + metric("Returning Clients", active("clients").filter(function (c) { return c.status === "Returning"; }).length, "Relationship health", icons.clients) + '</section><section class="split-grid"><article class="panel"><div class="panel__header"><span class="panel__label">Top Services</span></div><div class="bar-list">' + (topServicesRows || emptyState("No booking data", "Service performance will appear after bookings are added.", icons.bookings, "", "", true)) + '</div></article><article class="panel"><div class="panel__header"><span class="panel__label">Revenue by Client</span></div><div class="bar-list">' + (revenueByClientRows || emptyState("No client revenue yet", "Paid invoices will build this report.", icons.clients, "", "", true)) + "</div></article></section>";
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
    return '<section class="split-grid"><article class="panel"><div class="panel__header"><div><span class="panel__label">Storage</span><h2 class="panel__title">Cloud Command Center Data</h2></div></div><p class="record-meta">All modules persist to the LGNDRY.Co Supabase database and sync across devices. Export a JSON backup any time, or import one to restore.</p><div class="toolbar" style="justify-content:flex-start;margin-top:18px"><button class="primary-btn" data-export type="button">Export JSON</button><button class="ghost-btn" data-import type="button">Import JSON</button><button class="danger-btn" data-reset type="button">Reset Demo Data</button></div></article><article class="panel"><div class="panel__header"><div><span class="panel__label">Alerts</span><h2 class="panel__title">Lead Notifications</h2></div></div><p class="record-meta">Get a push notification on this device the moment a booking, order request, partnership application or contact-form lead comes in from the website - even when the Command Center isn\'t open.</p><p class="record-meta" data-push-status>Checking notification status...</p><div class="toolbar" style="justify-content:flex-start;margin-top:18px"><button class="primary-btn" data-push-toggle type="button" disabled>Enable Lead Alerts</button></div></article><article class="panel"><div class="panel__header"><div><span class="panel__label">Access</span><h2 class="panel__title">Team</h2></div></div><p class="record-meta">Give other people their own login to the Command Center.</p><div data-team-list class="record-meta">Loading team...</div><div class="toolbar" style="justify-content:flex-start;margin-top:18px;flex-wrap:wrap"><input type="email" placeholder="Email address" data-team-email style="flex:1;min-width:180px"><input type="password" placeholder="Temporary password (min 8 chars)" data-team-password style="flex:1;min-width:180px"><button class="primary-btn" data-team-add type="button">Add Team Member</button></div><p class="record-meta" data-team-error></p></article><article class="panel"><div class="panel__header"><span class="panel__label">Operational Lifecycle</span></div><p>Enquiry - Client - Booking - Project - Shoot - Orders - Invoice - Payment - Archive</p><p>Application - Discovery Call - Proposal - Contract - Onboarding - Active Partnership - Renewal</p><p>Artwork Upload - Purchase - Edition Tracking - Certificate - Shipping - Completed Order</p></article></section>';
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
    document.querySelectorAll("[data-dashboard-detail]").forEach(function (item) {
      function openDetail(event) {
        if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        detailNavigate(item.dataset.dashboardDetail, item.dataset.recordId);
      }
      item.addEventListener("click", openDetail);
      item.addEventListener("keydown", openDetail);
    });
    document.querySelectorAll("[data-route-jump]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.route = button.dataset.routeJump;
        state.detail = null;
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
      }).join("") || emptyState("No activity yet", "Studio updates will appear here.", icons.activity, "", "", true)) + "</div>";
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
        startAutoRefresh();
      }
      syncDetailFromHash();
      render();
    }).catch(function (error) {
      console.error(error);
      showAuthGate("Failed to load studio data. Please refresh.");
    });
  }

  function startAutoRefresh() {
    setInterval(function () {
      var modal = document.querySelector("[data-modal]");
      if (modal && modal.classList.contains("is-open")) return;
      var active = document.activeElement;
      if (active && ["INPUT", "TEXTAREA", "SELECT"].indexOf(active.tagName) > -1) return;
      loadRemoteData().then(function (remoteData) {
        data = remoteData;
        render();
      }).catch(function (error) {
        console.error("Background refresh failed:", error);
      });
    }, 60000);
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
    state.detail = null;
    if (window.history && window.history.pushState) window.history.pushState({ route: state.route }, "", "#" + state.route);
    state.query = "";
    state.filter = "all";
    render();
    document.body.classList.remove("mobile-nav-open");
    var toggle = document.querySelector("[data-mobile-nav-toggle]");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  });

  document.addEventListener("click", function (event) {
    var toggle = event.target.closest("[data-mobile-nav-toggle]");
    if (!toggle) return;
    var isOpen = document.body.classList.toggle("mobile-nav-open");
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  function recordDisplayName(record) {
    return record.name || record.title || record.service || record.orderNumber || record.number || record.company || record.section || "Record";
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
        if (supportsDetail(match.schema)) detailNavigate(match.route, match.record.id);
        else openModal(match.schema, match.record);
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

  document.addEventListener("click", function (event) {
    if (event.target.matches("[data-modal]")) closeModal();
  });

  document.addEventListener("click", function (event) {
    var imageTrigger = event.target.closest("[data-image-trigger]");
    if (imageTrigger) {
      imageTrigger.closest("[data-image-field]").querySelector("[data-image-input]").click();
      return;
    }
    var dropzone = event.target.closest("[data-image-dropzone]");
    if (dropzone) {
      dropzone.closest("[data-image-field]").querySelector("[data-image-input]").click();
      return;
    }
    var listTrigger = event.target.closest("[data-imagelist-trigger]");
    if (listTrigger) {
      listTrigger.closest("[data-imagelist-field]").querySelector("[data-imagelist-input]").click();
      return;
    }
    var removeBtn = event.target.closest("[data-imagelist-remove]");
    if (removeBtn) {
      var field = removeBtn.closest("[data-imagelist-field]");
      var removedItem = removeBtn.closest("[data-imagelist-item]");
      deleteFromMediaIfOwned(removedItem.getAttribute("data-url"));
      removedItem.remove();
      syncImagelistValue(field);
      return;
    }
    var fileTrigger = event.target.closest("[data-file-trigger]");
    if (fileTrigger) {
      fileTrigger.closest("[data-file-field]").querySelector("[data-file-input]").click();
    }
  });

  document.addEventListener("input", function (event) {
    if (event.target.matches('[name="title"]') && state.editing && state.editing.schema.collection === "documents") {
      event.target.dataset.templateGenerated = "false";
    }
    if (event.target.matches('[name="slug"]')) {
      event.target.dataset.userEdited = "true";
      return;
    }
    if (event.target.matches('[name="title"]') && state.editing && state.editing.schema.collection === "journal") {
      var slugField = document.querySelector('[name="slug"]');
      var isUntouched = slugField && (slugField.value === "" || slugField.value === slugField.getAttribute("placeholder"));
      if (slugField && isUntouched && slugField.dataset.userEdited !== "true") {
        slugField.value = event.target.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      }
    }
  });

  document.addEventListener("change", function (event) {
    if (!state.editing || state.editing.schema.collection !== "documents") return;
    if (!event.target.matches('[name="type"], [name="client"], [name="project"]')) return;
    var form = document.querySelector("[data-form]");
    if (event.target.matches('[name="project"]') && event.target.value) {
      var linkedProject = byId("projects", event.target.value);
      if (linkedProject && linkedProject.client && form.elements.client) form.elements.client.value = linkedProject.client;
    }
    updateDocumentTemplate();
  });
  document.addEventListener("change", function (event) {
    var imageInput = event.target.closest("[data-image-input]");
    if (imageInput) {
      var ifield = imageInput.closest("[data-image-field]");
      var ifile = imageInput.files[0];
      if (!ifile) return;
      var previousImageUrl = ifield.querySelector("[data-image-value]").value;
      startUpload(ifile, ifield.querySelector("[data-image-status]"), function (url) {
        ifield.querySelector("[data-image-value]").value = url;
        ifield.querySelector("[data-image-preview]").outerHTML = '<img class="image-field__preview" src="' + esc(url) + '" data-image-preview>';
        var trig = ifield.querySelector("[data-image-trigger]");
        if (trig) trig.textContent = "Replace Image";
        deleteFromMediaIfOwned(previousImageUrl);
      });
      return;
    }
    var listInput = event.target.closest("[data-imagelist-input]");
    if (listInput) {
      var lfield = listInput.closest("[data-imagelist-field]");
      var lfile = listInput.files[0];
      if (!lfile) return;
      startUpload(lfile, lfield.querySelector("[data-imagelist-status]"), function (url) {
        var grid = lfield.querySelector("[data-imagelist-grid]");
        var addBtn = grid.querySelector("[data-imagelist-trigger]");
        var item = document.createElement("div");
        item.className = "imagelist-field__item";
        item.setAttribute("data-imagelist-item", "");
        item.setAttribute("data-url", url);
        item.innerHTML = '<img src="' + esc(url) + '"><button type="button" class="imagelist-field__remove" data-imagelist-remove aria-label="Remove image">&times;</button>';
        grid.insertBefore(item, addBtn);
        syncImagelistValue(lfield);
      });
      return;
    }
    var fileInput = event.target.closest("[data-file-input]");
    if (fileInput) {
      var ffield = fileInput.closest("[data-file-field]");
      var ffile = fileInput.files[0];
      if (!ffile) return;
      var previousFileUrl = ffield.querySelector("[data-file-value]").value;
      startUpload(ffile, ffield.querySelector("[data-file-status]"), function (url) {
        ffield.querySelector("[data-file-value]").value = url;
        ffield.querySelector("[data-file-current]").innerHTML = '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(ffile.name) + "</a>";
        var trig = ffield.querySelector("[data-file-trigger]");
        if (trig) trig.textContent = "Replace File";
        deleteFromMediaIfOwned(previousFileUrl);
      });
    }
  });

  document.addEventListener("dragover", function (event) {
    var dropzone = event.target.closest("[data-image-dropzone]");
    if (!dropzone) return;
    event.preventDefault();
    dropzone.classList.add("is-dragover");
  });

  document.addEventListener("dragleave", function (event) {
    var dropzone = event.target.closest("[data-image-dropzone]");
    if (!dropzone) return;
    dropzone.classList.remove("is-dragover");
  });

  document.addEventListener("drop", function (event) {
    var dropzone = event.target.closest("[data-image-dropzone]");
    if (!dropzone) return;
    event.preventDefault();
    dropzone.classList.remove("is-dragover");
    var file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (!file) return;
    var field = dropzone.closest("[data-image-field]");
    var previousDropUrl = field.querySelector("[data-image-value]").value;
    startUpload(file, field.querySelector("[data-image-status]"), function (url) {
      field.querySelector("[data-image-value]").value = url;
      field.querySelector("[data-image-preview]").outerHTML = '<img class="image-field__preview" src="' + esc(url) + '" data-image-preview>';
      var trig = field.querySelector("[data-image-trigger]");
      if (trig) trig.textContent = "Replace Image";
      deleteFromMediaIfOwned(previousDropUrl);
    });
  });

  document.querySelector("[data-form]").addEventListener("submit", submitForm);
  window.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeModal();
  });

  window.addEventListener("popstate", function () {
    syncDetailFromHash();
    render();
  });

  initAuth();
}());
