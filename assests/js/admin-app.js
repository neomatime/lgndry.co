(function () {
  "use strict";

  var STORAGE_KEY = "lgndry_ops_command_center_v2";
  var THEME_KEY = "lgndry_admin_theme";
  var state = { route: "dashboard", query: "", filter: "all", editing: null };
  var data = loadData();

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
    invoices: svg('<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>'),
    analytics: svg('<path d="M4 20V9M10 20V4M16 20v-7M22 20H2"/>'),
    documents: svg('<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5"/>'),
    settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1-2 2-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5v.2h-3V20a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1-2-2 .1-.1A1.7 1.7 0 0 0 7.4 15a1.7 1.7 0 0 0-1.5-1H5.7v-3H6a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1 2-2 .1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V4.8h3V5a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1 2 2-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1h.2v3H21a1.7 1.7 0 0 0-1.6 1z"/>')
  };

  var modules = [
    ["dashboard", "Dashboard"], ["clients", "Clients"], ["bookings", "Bookings"],
    ["projects", "Projects"], ["partnerships", "Brand Partnerships"],
    ["collection", "Collection"], ["galleries", "Gallery Delivery"],
    ["content", "Content Library"], ["practice", "Practice"], ["journal", "Journal"],
    ["cms", "Website CMS"], ["invoices", "Invoices"], ["analytics", "Analytics"],
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
      fields: [f("name", "Project name", "text", true), rel("client", "Client", "clients", true), rel("booking", "Booking", "bookings"), f("type", "Project type", "text", true), f("brief", "Brief", "textarea"), f("moodboard", "Moodboard links / uploads", "textarea"), f("shotList", "Shot list", "textarea"), f("deliverables", "Deliverables", "textarea"), f("timeline", "Timeline"), f("tasks", "Tasks", "textarea"), f("files", "Files", "textarea"), f("comments", "Comments", "textarea"), f("status", "Workflow status", "select", true, ["Planning", "Shoot Scheduled", "Editing", "Client Review", "Delivered", "Archived"])]
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
      fields: [f("title", "Artwork title", "text", true), f("collectionName", "Collection name", "text", true), f("category", "Category", "select", true, ["Art Print", "Studio Art", "Limited Edition"]), f("description", "Description / story", "textarea"), f("image", "Image URL"), f("price", "Price", "number", true), f("editionSize", "Edition size", "number", true), f("sold", "Editions sold", "number", true), f("remaining", "Editions remaining", "number"), f("availability", "Availability", "select", true, ["Available", "Reserved", "Sold Out", "Hidden"]), f("customer", "Latest customer"), f("editionNumber", "Latest edition number", "number"), f("payment", "Payment status", "select", false, ["Pending In Person", "Paid In Person", "Reserved", "Cancelled"]), f("shipping", "Shipping status", "select", false, ["Not Started", "Preparing", "Shipped", "Delivered", "Collected"]), f("tracking", "Tracking number"), f("certificate", "Certificate status", "select", false, ["Not Issued", "Issued", "Archived"])]
    },
    invoices: {
      title: "Invoices & Payments",
      subtitle: "Create quotes, invoices and receipts linked to clients, shoots, projects and orders.",
      collection: "invoices", display: "number", status: "status",
      columns: ["number", "client", "type", "amount", "status"],
      fields: [f("number", "Document number", "text", true), f("type", "Document type", "select", true, ["Quote", "Invoice", "Receipt"]), rel("client", "Client", "clients", true), rel("project", "Project / booking / order", "projects"), f("items", "Line items", "textarea", true), f("amount", "Amount", "number", true), f("vat", "VAT", "number"), f("due", "Due date", "date"), f("status", "Payment status", "select", true, ["Draft", "Sent", "Paid", "Partially Paid", "Overdue", "Cancelled"]), f("paidAt", "Payment date", "date")]
    },
    galleries: {
      title: "Gallery Delivery",
      subtitle: "Build delivery links, monitor viewed/downloaded status and manage expiries.",
      collection: "galleries", display: "title", status: "status",
      columns: ["title", "client", "project", "expiry", "status"],
      fields: [f("title", "Gallery title", "text", true), rel("client", "Client", "clients", true), rel("project", "Project", "projects"), f("files", "Images / files", "textarea"), f("expiry", "Expiry date", "date"), f("downloads", "Downloads enabled", "select", true, ["Enabled", "Disabled"]), f("share", "Share link"), f("password", "Password protection"), f("status", "Gallery status", "select", true, ["Draft", "Sent", "Viewed", "Downloaded", "Expired"])]
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
      fields: [f("section", "Website section", "select", true, ["Homepage", "Practice", "Collection", "About", "Contact", "Collaborations", "Calls-to-action"]), f("area", "Content area", "text", true), f("copy", "Copy", "textarea"), f("image", "Image URL"), f("cta", "Call-to-action"), f("status", "Status", "select", true, ["Draft", "Ready", "Published", "Archived"]), f("updated", "Updated date", "date")]
    },
    documents: {
      title: "Documents",
      subtitle: "Generate and track contracts, NDAs, briefs, call sheets and releases.",
      collection: "documents", display: "title", status: "status",
      columns: ["title", "type", "client", "project", "status"],
      fields: [f("title", "Document title", "text", true), f("type", "Document type", "select", true, ["Contract", "NDA", "Proposal", "Creative Brief", "Call Sheet", "Model Release", "Location Release"]), rel("client", "Client", "clients"), rel("project", "Project / booking / partnership", "projects"), f("template", "Template / upload link"), f("signed", "Signed document link"), f("status", "Status", "select", true, ["Draft", "Sent", "Signed", "Expired", "Archived"])]
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
        { id: b1, client: c1, service: "Brand Shoot", date: "2026-07-10", start: "09:00", end: "13:00", location: "Johannesburg Studio", type: "Campaign", photographer: "Neo Mokgwadi", status: "Confirmed", deposit: "Paid", project: p1, shotList: "Product rituals, founder portrait, campaign stills", notes: "Soft morning light." },
        { id: b2, client: c2, service: "Creative Direction Call", date: "2026-07-12", start: "11:00", end: "12:00", location: "Remote", type: "Partnership", photographer: "Neo Mokgwadi", status: "Scheduled", deposit: "Waived", project: "", shotList: "Retainer planning", notes: "Discuss annual partnership." }
      ],
      projects: [
        { id: p1, name: "Rituals Campaign", client: c1, booking: b1, type: "Brand Campaign", brief: "Launch campaign visuals for quiet ritual moments.", moodboard: "Neutral walls, sculptural shadows.", shotList: "Product rituals, founder portrait, campaign stills", deliverables: "24 edited images, 6 social crops", timeline: "Jul 10 - Jul 24", tasks: "Confirm props\nShoot\nEdit selects\nDeliver gallery", files: "Drive/Rituals", comments: "Client prefers minimal crops.", status: "Editing" },
        { id: p2, name: "LELO Studio", client: c3, booking: "", type: "Product Photography", brief: "Product still life set.", moodboard: "", shotList: "", deliverables: "18 finals", timeline: "Completed June", tasks: "Archived", files: "Drive/LELO", comments: "Paid in full.", status: "Delivered" }
      ],
      partnerships: [
        { id: id(), client: c2, company: "Hennessy SA", contact: "Thabo Mokoena", application: "Seeking ongoing campaign and event visual storytelling.", duration: "Annual Creative Partnership - minimum 12-month term", start: "2026-08-01", end: "2027-07-31", deliverables: "Monthly shoot, 20 edited images, quarterly campaign story", allowance: 1, sessionsRemaining: 11, proposal: "Proposal sent", contract: "Pending", review: "Discovery call booked.", status: "Proposal" }
      ],
      collection: [
        { id: id(), title: "Still Point", collectionName: "Found Beauty", category: "Art Print", description: "A study of quiet architecture and shadow.", image: "assests/images/collection/thumbs/still-point.jpg", price: 4200, editionSize: 25, sold: 4, remaining: 21, availability: "Available", customer: "", editionNumber: "", payment: "Pending In Person", shipping: "Not Started", tracking: "", certificate: "Not Issued" },
        { id: id(), title: "Presence", collectionName: "Found Beauty", category: "Limited Edition", description: "Field portrait in late light.", image: "assests/images/collection/thumbs/presence.jpg", price: 5600, editionSize: 12, sold: 9, remaining: 3, availability: "Reserved", customer: "M. Dlamini", editionNumber: 9, payment: "Reserved", shipping: "Preparing", tracking: "", certificate: "Not Issued" }
      ],
      invoices: [
        { id: id(), number: "INV-032", type: "Invoice", client: c1, project: p1, items: "Brand campaign shoot and edits", amount: 18500, vat: 0, due: "2026-07-18", status: "Sent", paidAt: "" },
        { id: id(), number: "INV-028", type: "Invoice", client: c3, project: p2, items: "Product photography", amount: 8950, vat: 0, due: "2026-06-20", status: "Paid", paidAt: "2026-06-18" }
      ],
      galleries: [{ id: id(), title: "Rituals Campaign Selects", client: c1, project: p1, files: "24 edited previews", expiry: "2026-08-01", downloads: "Enabled", share: "https://lgndry.co/gallery/rituals", password: "rituals24", status: "Sent" }],
      content: [{ id: id(), title: "Rituals Hero Still", client: c1, project: p1, shootDate: "2026-07-10", category: "Campaign", tags: "rituals,product,shadow", fileType: "Image", file: "assests/images/collection/thumbs/still-point.jpg", status: "Linked" }],
      journal: [{ id: id(), title: "Slowing Down To See", slug: "slowing-down-to-see", image: "assests/images/hero-image.JPG", category: "Manifesto", body: "A short studio reflection on intentional image making.", seoTitle: "Slowing Down To See", seoDescription: "LGNDRY.Co manifesto note.", published: "2026-07-15", status: "Scheduled" }],
      cms: [{ id: id(), section: "Homepage", area: "Hero copy", copy: "Found Beauty in the Mundane.", image: "assests/images/hero-image.JPG", cta: "Explore our world", status: "Published", updated: "2026-07-07" }],
      documents: [{ id: id(), title: "Rituals Campaign Agreement", type: "Contract", client: c1, project: p1, template: "Standard campaign agreement", signed: "", status: "Sent" }]
    };
  }

  function loadData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
      var starter = seed();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(starter));
      return starter;
    } catch (error) {
      console.error(error);
      return seed();
    }
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
      setTitle("Welcome back, Neo.", "Here is what is happening with LGNDRY.Co today.");
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
      return '<button type="button" class="nav-item ' + (state.route === module[0] ? "nav-item--active" : "") + '" data-route="' + module[0] + '">' + (icons[module[0]] || "") + "<span>" + module[1] + "</span></button>";
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
      metric("Active Projects", projects.filter(function (p) { return p.status !== "Delivered"; }).length, "View all projects", icons.projects) +
      metric("Upcoming Bookings", upcoming.length, "View calendar", icons.bookings) +
      metric("Outstanding Invoices", money(outstanding), "Needs follow-up", icons.invoices) +
      metric("Collection Sales", money(paid + artSales), "Paid and edition value", icons.collection) +
      metric("Partnership Pipeline", partnerships.length, "Prospects and retainers", icons.partnerships) +
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
      "</section>";
  }

  function sumAmount(total, item) {
    return total + Number(item.amount || 0);
  }

  function metric(labelText, value, hint, icon) {
    return '<article class="metric"><div class="metric__head"><span class="metric__label">' + esc(labelText) + '</span><span class="metric__icon">' + (icon || icons.dashboard) + "</span></div><div><div class=\"metric__value\">" + esc(value) + '</div><div class="metric__hint">' + esc(hint || "") + "</div></div></article>";
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
    return title.replace("Brand Partnerships", "partnership").replace("Gallery Delivery", "gallery").replace("Content Library", "asset").replace("Invoices & Payments", "invoice").replace(/s$/, "").toLowerCase();
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
      }).join("") + '<td><div class="row-actions"><button class="table-action" data-edit="' + record.id + '" type="button">Edit</button>' + (schema.actions && schema.actions.indexOf("generateProject") > -1 ? '<button class="table-action" data-generate="' + record.id + '" type="button">Project</button>' : "") + '<button class="table-action" data-archive="' + record.id + '" type="button">Archive</button><button class="table-action" data-delete="' + record.id + '" type="button">Delete</button></div></td></tr>';
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
      render();
    });
    document.querySelector("[data-filter]").addEventListener("change", function (event) {
      state.filter = event.target.value;
      render();
    });
    document.querySelector("[data-new]").addEventListener("click", function () { openModal(schema, null); });
    document.querySelectorAll("[data-edit]").forEach(function (button) { button.addEventListener("click", function () { openModal(schema, byId(schema.collection, button.dataset.edit)); }); });
    document.querySelectorAll("[data-archive]").forEach(function (button) { button.addEventListener("click", function () { archiveRecord(schema, button.dataset.archive); }); });
    document.querySelectorAll("[data-delete]").forEach(function (button) { button.addEventListener("click", function () { deleteRecord(schema, button.dataset.delete); }); });
    document.querySelectorAll("[data-generate]").forEach(function (button) { button.addEventListener("click", function () { generateProject(button.dataset.generate); }); });
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
    var control = "";
    if (field.type === "select") {
      control = '<select name="' + field.name + '" ' + (field.required ? "required" : "") + '><option value="">Select</option>' + field.options.map(function (option) { return '<option ' + (String(value || "") === option ? "selected" : "") + ' value="' + esc(option) + '">' + esc(option) + "</option>"; }).join("") + "</select>";
    } else if (field.type === "relation") {
      control = '<select name="' + field.name + '" ' + (field.required ? "required" : "") + '><option value="">Unlinked</option>' + active(field.collection).map(function (record) { return '<option ' + (String(value || "") === record.id ? "selected" : "") + ' value="' + record.id + '">' + esc(label(field.collection, record.id)) + "</option>"; }).join("") + "</select>";
    } else if (field.type === "textarea") {
      control = '<textarea name="' + field.name + '" ' + (field.required ? "required" : "") + ' placeholder="' + esc(field.placeholder) + '">' + esc(value || "") + "</textarea>";
    } else {
      control = '<input name="' + field.name + '" type="' + field.type + '" ' + (field.required ? "required" : "") + ' value="' + esc(value || "") + '" placeholder="' + esc(field.placeholder) + '">';
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
    var next = state.editing.record ? Object.assign({}, state.editing.record) : { id: id() };
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
    if (schema.collection === "collection") next.remaining = Number(next.editionSize || 0) - Number(next.sold || 0);
    var list = data[schema.collection];
    var index = list.findIndex(function (record) { return record.id === next.id; });
    if (index > -1) list[index] = next;
    else list.unshift(next);
    saveData();
    closeModal();
    toast("Saved successfully.");
    render();
  }

  function archiveRecord(schema, recordId) {
    var record = byId(schema.collection, recordId);
    if (!record || !confirm("Archive this record?")) return;
    record.archived = true;
    if (schema.status) record[schema.status] = "Archived";
    saveData();
    toast("Record archived.");
    render();
  }

  function deleteRecord(schema, recordId) {
    if (!confirm("Delete this record permanently from local storage?")) return;
    data[schema.collection] = data[schema.collection].filter(function (record) { return record.id !== recordId; });
    saveData();
    toast("Record deleted.");
    render();
  }

  function generateProject(bookingId) {
    var booking = byId("bookings", bookingId);
    if (!booking) return;
    var existing = active("projects").find(function (project) { return project.booking === bookingId; });
    if (existing) {
      toast("This booking already has a project.");
      return;
    }
    var project = { id: id(), name: booking.service + " / " + label("clients", booking.client), client: booking.client, booking: booking.id, type: booking.type, brief: booking.notes || "", moodboard: "", shotList: booking.shotList || "", deliverables: "", timeline: (booking.date || "") + " onwards", tasks: "Confirm brief\nShoot\nEdit\nDeliver", files: "", comments: "Generated from booking.", status: "Planning" };
    data.projects.unshift(project);
    booking.project = project.id;
    if (booking.status === "Confirmed") booking.status = "Scheduled";
    saveData();
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
    return '<section class="analytics-grid">' + metric("Monthly Revenue", money(paid), "Paid invoices", icons.invoices) + metric("Artwork Sales", money(art), "Edition value", icons.collection) + metric("Outstanding", money(outstanding), "Open invoices", icons.invoices) + metric("Average Project", money(avg), "Current project value", icons.analytics) + metric("Returning Clients", active("clients").filter(function (c) { return c.status === "Returning"; }).length, "Relationship health", icons.clients) + '</section><section class="split-grid"><article class="panel"><div class="panel__header"><span class="panel__label">Top Services</span></div><div class="bar-list">' + Object.keys(services).map(function (name) { return barRow(name, services[name], Math.min(100, services[name] * 28)); }).join("") + '</div></article><article class="panel"><div class="panel__header"><span class="panel__label">Revenue by Client</span></div><div class="bar-list">' + active("clients").map(function (client) { var sum = active("invoices").filter(function (invoice) { return invoice.client === client.id; }).reduce(sumAmount, 0); return barRow(client.name, money(sum), Math.min(100, sum / 250)); }).join("") + "</div></article></section>";
  }

  function barRow(labelText, value, width) {
    return '<div class="bar-row"><span>' + esc(labelText) + '</span><div class="bar-track"><span style="width:' + width + '%"></span></div><strong>' + esc(value) + "</strong></div>";
  }

  function settings() {
    return '<section class="split-grid"><article class="panel"><div class="panel__header"><div><span class="panel__label">Storage</span><h2 class="panel__title">Local Command Center Data</h2></div></div><p class="record-meta">All modules persist in this browser with localStorage. Export JSON before moving machines or clearing browser data.</p><div class="toolbar" style="justify-content:flex-start;margin-top:18px"><button class="primary-btn" data-export type="button">Export JSON</button><button class="ghost-btn" data-import type="button">Import JSON</button><button class="danger-btn" data-reset type="button">Reset Demo Data</button></div></article><article class="panel"><div class="panel__header"><span class="panel__label">Operational Lifecycle</span></div><p>Enquiry - Client - Booking - Project - Shoot - Gallery Delivery - Invoice - Payment - Archive</p><p>Application - Discovery Call - Proposal - Contract - Onboarding - Active Partnership - Renewal</p><p>Artwork Upload - Purchase - Edition Tracking - Certificate - Shipping - Completed Order</p></article></section>';
  }

  function bindSettings() {
    document.querySelector("[data-export]").addEventListener("click", function () {
      var text = JSON.stringify(data, null, 2);
      if (navigator.clipboard) navigator.clipboard.writeText(text);
      console.log(text);
      toast("JSON copied to clipboard and console.");
    });
    document.querySelector("[data-import]").addEventListener("click", function () {
      var raw = prompt("Paste exported LGNDRY.Co JSON");
      if (!raw) return;
      try {
        data = JSON.parse(raw);
        saveData();
        toast("Data imported.");
        render();
      } catch (error) {
        toast("Import failed. Check the JSON.");
      }
    });
    document.querySelector("[data-reset]").addEventListener("click", function () {
      if (!confirm("Reset all local command center data to starter records?")) return;
      data = seed();
      saveData();
      toast("Demo data restored.");
      render();
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

  document.addEventListener("click", function (event) {
    var route = event.target.closest("[data-route]");
    if (!route) return;
    state.route = route.dataset.route;
    state.query = "";
    state.filter = "all";
    render();
  });

  document.querySelector("[data-global-search]").addEventListener("input", function (event) {
    state.query = event.target.value;
    render();
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

  initTheme();
  render();
}());
