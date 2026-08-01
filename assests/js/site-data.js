(function () {
  "use strict";

  if (!window.supabase) return;

  var SUPABASE_URL = "https://tscaluhtfrvwlwjybfsg.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_UAS3aUpb9Aj7lbVBPkWncA_l4ghKr4w";
  var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  function fetchTable(table) {
    return client.from(table).select("*").then(function (result) {
      if (result.error) throw result.error;
      return result.data.filter(function (record) { return !record.archived; });
    });
  }

  function fetchCollection() {
    return fetchTable("collection").then(function (items) {
      return items.filter(function (item) {
        return item.availability !== "Hidden";
      }).sort(function (a, b) {
        return Number(a.position || 0) - Number(b.position || 0);
      }).map(function (item) {
        var normalized = {};
        Object.keys(item).forEach(function (key) { normalized[key] = item[key]; });
        var extraImages = String(item.images || "").split("\n").map(function (line) { return line.trim(); }).filter(Boolean);
        normalized.imageList = extraImages.length ? extraImages : [item.image];
        return normalized;
      });
    });
  }
  function fetchCmsBySection(section) {
    return fetchTable("cms").then(function (items) {
      return items.filter(function (item) { return item.section === section && item.status === "Published"; });
    });
  }

  function fetchPractice() {
    return fetchTable("practice").then(function (items) {
      return items.filter(function (item) { return item.visibility === "Visible"; }).sort(function (a, b) {
        return Number(a.position || 0) - Number(b.position || 0);
      });
    });
  }

  function fetchBudgetOptions(form) {
    return fetchTable("budgets").then(function (items) {
      return items.filter(function (item) { return item.form === form && item.visibility === "Visible"; }).sort(function (a, b) {
        return Number(a.position || 0) - Number(b.position || 0);
      }).map(function (item) { return item.label; });
    });
  }

  function newUuid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (char) {
      var random = Math.random() * 16 | 0;
      var value = char === "x" ? random : (random & 0x3 | 0x8);
      return value.toString(16);
    });
  }

  function createLeadClient(fields) {
    var payload = {
      id: newUuid(),
      name: fields.name || "",
      type: fields.company ? "Company" : "Individual",
      contact: fields.name || "",
      email: fields.email || "",
      phone: fields.phone || "",
      status: "Lead",
      notes: fields.notes || ""
    };
    return client.from("clients").insert(payload).then(function (result) {
      if (result.error) throw result.error;
      return payload;
    });
  }

  function submitBooking(fields) {
    return createLeadClient({
      name: fields.client_name,
      email: fields.client_email,
      phone: fields.client_phone,
      company: fields.company,
      notes: "Company: " + (fields.company || "-")
    }).then(function (clientRow) {
      var notes = [
        "Services: " + (fields.services || "-"),
        "Project details: " + (fields.project_details || "-"),
        "Date flexibility: " + (fields.date_flexibility || "-"),
        "Budget: " + (fields.budget || "-")
      ].join(" / ");
      return client.from("bookings").insert({
        client: clientRow.id,
        service: fields.session_type || "Enquiry",
        date: fields.preferred_date || null,
        start: fields.preferred_time || "",
        location: fields.session_location || "",
        type: "Enquiry",
        status: "Enquiry",
        deposit: "Not Requested",
        notes: notes
      });
    }).then(function (result) {
      if (result.error) throw result.error;
      logActivity('New booking enquiry from ' + (fields.client_name || "website visitor"));
    });
  }

  function logActivity(message) {
    client.from("ops_activity_log").insert({ message: message }).then(function (result) {
      if (result.error) console.error(result.error);
    });
  }

  function submitPartnership(fields) {
    return createLeadClient({
      name: fields.contact_name,
      email: fields.contact_email,
      phone: fields.contact_phone,
      company: fields.company,
      notes: "Industry: " + (fields.industry || "-")
    }).then(function (clientRow) {
      var application = [
        "Partnership type: " + (fields.partnership_type || "-"),
        "Focus areas: " + (fields.focus || "-"),
        "Brand goals: " + (fields.brand_goals || "-"),
        "Industry: " + (fields.industry || "-"),
        "Website/Instagram: " + (fields.brand_link || "-"),
        "Location: " + (fields.brand_location || "-"),
        "Content frequency: " + (fields.content_frequency || "-"),
        "Budget: " + (fields.partner_budget || "-")
      ].join(" / ");
      return client.from("partnerships").insert({
        client: clientRow.id,
        company: fields.company || "",
        contact: fields.contact_name || "",
        application: application,
        status: "Applied"
      });
    }).then(function (result) {
      if (result.error) throw result.error;
      logActivity('New partnership application from ' + (fields.company || fields.contact_name || "website visitor"));
    });
  }


  function submitOrder(fields) {
    var submittedAt = fields.submittedAt || new Date().toISOString();
    var suffix = String(Date.now()).slice(-6);
    var orderNumber = fields.orderNumber || ("ORD-" + submittedAt.slice(0, 10).replace(/-/g, "") + "-" + suffix);
    var items = Array.isArray(fields.items) ? fields.items : [];
    var itemSummary = items.map(function (item) {
      return (item.quantity || 1) + " x " + (item.title || "Artwork") + (item.size ? " (" + item.size + ")" : "");
    }).join(", ");
    var payload = {
      id: newUuid(),
      orderNumber: orderNumber,
      customerName: fields.customerName || "",
      customerEmail: fields.customerEmail || "",
      customerPhone: fields.customerPhone || "",
      items: items,
      itemSummary: itemSummary,
      quantity: items.reduce(function (sum, item) { return sum + Number(item.quantity || 1); }, 0),
      subtotal: Number(fields.subtotal || 0),
      deliveryMethod: fields.deliveryMethod || "",
      deliveryAddress: fields.deliveryAddress || "",
      deliveryCity: fields.deliveryCity || "",
      postalCode: fields.postalCode || "",
      notes: fields.notes || "",
      submittedAt: submittedAt,
      status: "New Request"
    };
    return client.from("orders").insert(payload).then(function (result) {
      if (result.error) throw result.error;
      logActivity('New order request ' + orderNumber + ' from ' + (payload.customerName || "website visitor"));
      return payload;
    });
  }

  function submitContactLead(fields) {
    var notes = [
      "Assistance needed: " + (fields.assistance_needed || "-"),
      "Project readiness: " + (fields.project_readiness || "-"),
      "Timeline: " + (fields.timeline || "-"),
      "Budget range: " + (fields.budget_range || "-"),
      "Message: " + (fields.message || "-")
    ].join(" / ");
    return createLeadClient({
      name: fields.name,
      email: fields.email,
      phone: fields.phone,
      company: fields.company,
      notes: notes
    }).then(function (clientRow) {
      logActivity('New contact enquiry from ' + (fields.name || "website visitor"));
      return clientRow;
    });
  }

  window.LgndrySiteData = {
    fetchCollection: fetchCollection,
    fetchCmsBySection: fetchCmsBySection,
    fetchPractice: fetchPractice,
    fetchBudgetOptions: fetchBudgetOptions,
    submitBooking: submitBooking,
    submitPartnership: submitPartnership,
    submitContactLead: submitContactLead,
    submitOrder: submitOrder
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  /* Collection page: render live artwork grid */
  (function () {
    var grid = document.querySelector(".collection-grid");
    if (!grid) return;

    function categoryToFilter(category) {
      if (category === "Studio Art" || category === "Limited Edition") return "studio";
      return "prints";
    }

    function formatPrice(value) {
      return "R " + Math.round(Number(value) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    function renderWork(item) {
      var unavailable = item.availability && item.availability !== "Available";
      var acquire = unavailable
        ? '<span class="work__unavailable">' + escapeHtml(item.availability) + "</span>"
        : '<a class="work__acquire" href="mailto:info@lgndry-co.co.za?subject=Acquire%20%E2%80%94%20' + encodeURIComponent(item.title || "") + '"><span>Add to cart</span><svg width="40" height="8" viewBox="0 0 40 8" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M0 4H38M38 4L34 1M38 4L34 7" stroke="currentColor" stroke-width="1"/></svg></a>';
      var sizes = String(item.sizes || "").split("\n").map(function (line) { return line.trim(); }).filter(Boolean);
      if (!sizes.length) sizes = ["50 × 70 cm", "60 × 90 cm", "70 × 100 cm"];
      var sizeOptions = sizes.map(function (size) { return "<option>" + escapeHtml(size) + "</option>"; }).join("");
      return '<article class="work" data-artwork-id="' + escapeHtml(item.id || "") + '" data-category="' + categoryToFilter(item.category) + '">' +
        '<figure class="work__media" data-images=\'' + escapeHtml(JSON.stringify(item.imageList || [item.image])) + '\'><img src="' + escapeHtml(item.image) + '" data-full-src="' + escapeHtml(item.image) + '" loading="lazy" decoding="async" alt="' + escapeHtml(item.title) + '"></figure>' +
        '<div class="work__body">' +
          "<h3 class=\"work__title\">" + escapeHtml(item.title) + "</h3>" +
          '<p class="work__year">' + escapeHtml(item.year || "") + "</p>" +
          '<div class="work__row">' +
            '<div class="work__meta"><p>' + escapeHtml(item.remaining || 0) + " available</p><p>" + escapeHtml(item.seriesLabel || "Archival Pigment Print") + "</p>" +
            '<label class="work__size">Size:<select aria-label="Print size for ' + escapeHtml(item.title) + '">' + sizeOptions + "</select></label></div>" +
            '<p class="work__price">' + formatPrice(item.price) + "</p>" +
          "</div>" +
          acquire +
        "</div>" +
      "</article>";
    }

    window.LgndrySiteData.fetchCollection().then(function (items) {
      if (!items.length) return;
      grid.innerHTML = items.map(renderWork).join("");
    }).catch(function (error) {
      console.error("Failed to load live collection data, showing static fallback.", error);
    });
  }());

  /* Homepage: render live hero copy */
  (function () {
    var headline = document.querySelector(".hero__headline");
    if (!headline) return;

    window.LgndrySiteData.fetchCmsBySection("Homepage").then(function (records) {
      var byArea = {};
      records.forEach(function (record) { byArea[record.area] = record; });
      var hero = byArea["Hero copy"];
      var subcopy = byArea["Hero subcopy"];

      if (hero) {
        if (hero.copy) headline.textContent = hero.copy;
        if (hero.image) {
          var heroImage = document.querySelector(".hero__image");
          if (heroImage) heroImage.src = hero.image;
        }
        if (hero.cta) {
          var ctaLabel = document.querySelector(".hero__cta-label");
          if (ctaLabel) ctaLabel.textContent = hero.cta;
        }
      }
      if (subcopy && subcopy.copy) {
        var copyEl = document.querySelector(".hero__copy");
        if (copyEl) copyEl.textContent = subcopy.copy;
      }
    }).catch(function (error) {
      console.error("Failed to load homepage CMS content, showing static fallback.", error);
    });
  }());

  /* About page: render live hero copy */
  (function () {
    var title = document.querySelector(".about-title");
    if (!title) return;

    window.LgndrySiteData.fetchCmsBySection("About").then(function (records) {
      var byArea = {};
      records.forEach(function (record) { byArea[record.area] = record; });
      var hero = byArea["Hero copy"];
      var subcopy = byArea["Hero subcopy"];

      if (hero && hero.copy) title.textContent = hero.copy;
      if (subcopy && subcopy.copy) {
        var copyEl = document.querySelector(".about-copy");
        if (copyEl) copyEl.textContent = subcopy.copy;
      }
    }).catch(function (error) {
      console.error("Failed to load about CMS content, showing static fallback.", error);
    });
  }());

  /* About page: render live founder copy */
  (function () {
    var founderTitle = document.querySelector("#founder-title");
    if (!founderTitle) return;

    window.LgndrySiteData.fetchCmsBySection("About").then(function (records) {
      var byArea = {};
      records.forEach(function (record) { byArea[record.area] = record; });
      var title = byArea["Founder title"];
      var bio1 = byArea["Founder bio 1"];
      var bio2 = byArea["Founder bio 2"];
      var bioParagraphs = document.querySelectorAll(".about-founder__copy p:nth-of-type(1), .about-founder__copy p:nth-of-type(2)");

      if (title && title.copy) founderTitle.innerHTML = title.copy.replace(/\n/g, "<br>");
      if (bio1 && bio1.copy && bioParagraphs[0]) bioParagraphs[0].textContent = bio1.copy;
      if (bio2 && bio2.copy && bioParagraphs[1]) bioParagraphs[1].textContent = bio2.copy;
    }).catch(function (error) {
      console.error("Failed to load about founder CMS content, showing static fallback.", error);
    });
  }());

  /* Selected Collaborations: render live eyebrow label (Home + About) */
  (function () {
    var eyebrows = document.querySelectorAll(".companies .eyebrow, #collabs-title");
    if (!eyebrows.length) return;

    window.LgndrySiteData.fetchCmsBySection("Collaborations").then(function (records) {
      var label = records.filter(function (record) { return record.area === "Eyebrow label"; })[0];
      if (!label || !label.copy) return;
      eyebrows.forEach(function (el) { el.textContent = label.copy; });
    }).catch(function (error) {
      console.error("Failed to load collaborations CMS content, showing static fallback.", error);
    });
  }());

  /* About page final CTAs: render live button labels */
  (function () {
    var links = document.querySelectorAll(".about-final__links .about-link span:first-child");
    if (!links.length) return;

    window.LgndrySiteData.fetchCmsBySection("Calls-to-action").then(function (records) {
      var byArea = {};
      records.forEach(function (record) { byArea[record.area] = record; });
      var primary = byArea["Primary CTA"];
      var secondary = byArea["Secondary CTA"];
      if (primary && primary.copy && links[0]) links[0].textContent = primary.copy;
      if (secondary && secondary.copy && links[1]) links[1].textContent = secondary.copy;
    }).catch(function (error) {
      console.error("Failed to load calls-to-action CMS content, showing static fallback.", error);
    });
  }());

  /* Practice page: render live hero copy */
  (function () {
    var title = document.querySelector(".practice-title");
    if (!title) return;

    window.LgndrySiteData.fetchCmsBySection("Practice").then(function (records) {
      var byArea = {};
      records.forEach(function (record) { byArea[record.area] = record; });
      var hero = byArea["Hero copy"];
      var subcopy = byArea["Hero subcopy"];

      if (hero && hero.copy) title.textContent = hero.copy;
      if (subcopy && subcopy.copy) {
        var copyEl = document.querySelector(".practice-lede");
        if (copyEl) copyEl.textContent = subcopy.copy;
      }
    }).catch(function (error) {
      console.error("Failed to load practice CMS content, showing static fallback.", error);
    });
  }());

  /* Contact page: render live hero copy */
  (function () {
    var title = document.querySelector(".contact-title");
    if (!title) return;

    window.LgndrySiteData.fetchCmsBySection("Contact").then(function (records) {
      var byArea = {};
      records.forEach(function (record) { byArea[record.area] = record; });
      var subcopy = byArea["Hero subcopy"];

      if (subcopy && subcopy.copy) {
        var copyEl = document.querySelector(".contact-hero__copy p");
        if (copyEl) copyEl.textContent = subcopy.copy;
      }
    }).catch(function (error) {
      console.error("Failed to load contact CMS content, showing static fallback.", error);
    });
  }());

  /* Practice page: render live service lists */
  (function () {
    var lists = document.querySelectorAll(".practice-service__list");
    if (!lists.length) return;

    window.LgndrySiteData.fetchPractice().then(function (items) {
      if (!items.length) return;
      var byCategory = {};
      items.forEach(function (item) {
        byCategory[item.category] = byCategory[item.category] || [];
        byCategory[item.category].push(item);
      });
      lists.forEach(function (list) {
        var article = list.closest(".practice-service");
        var nameEl = article && article.querySelector(".practice-service__name");
        var category = nameEl ? nameEl.textContent.trim() : "";
        var services = byCategory[category];
        if (!services || !services.length) return;
        list.innerHTML = services.map(function (service) {
          return "<li>" + escapeHtml(service.title) + "</li>";
        }).join("");
      });
    }).catch(function (error) {
      console.error("Failed to load practice list, showing static fallback.", error);
    });
  }());
}());
