(function () {
  "use strict";
  var grid = document.querySelector("[data-commerce-catalog]");
  var controls = document.querySelector("[data-commerce-filters]");
  if (!grid || !controls || !window.LgndryCommerce) return;
  window.LgndryCommerce.createCartLink();
  if (!window.LgndrySiteData) return;
  var products = [];
  grid.setAttribute("aria-busy", "true");

  function esc(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]; }); }
  function list(value) { return String(value || "").split("\n").map(function (v) { return v.trim(); }).filter(Boolean); }
  function optionValues(field) { var seen = {}; products.forEach(function (p) { if (p[field]) seen[p[field]] = true; }); return Object.keys(seen).sort(); }
  function fillSelect(selector, values) { var select = controls.querySelector(selector), first = select.options[0].outerHTML; select.innerHTML = first + values.map(function (v) { return '<option value="' + esc(v) + '">' + esc(v) + '</option>'; }).join(""); }

  function normalize(product) {
    product.artist = product.artist || "Dan Mokgwadi";
    product.medium = product.medium || product.seriesLabel || "Archival Pigment Print";
    product.collectionName = product.collectionName || (product.category === "Studio Art" ? "Studio Art" : "Found Beauty in the Mundane");
    product.dimensions = product.dimensions || product.sizes || "";
    product.imageList = product.imageList && product.imageList.length ? product.imageList : [product.image];
    return product;
  }

  function renderProduct(product) {
    var available = product.availability === "Available" && Number(product.remaining || 0) > 0;
    var sizes = list(product.sizes); if (!sizes.length) sizes = [product.dimensions || "Standard edition"];
    var href = "showroom.html?id=" + encodeURIComponent(product.id);
    var action = available && !product.requiresConfirmation
      ? '<button class="work__acquire" type="button" data-catalogue-add="' + esc(product.id) + '"><span>Add to selection</span><svg width="40" height="8" viewBox="0 0 40 8" fill="none" aria-hidden="true"><path d="M0 4H38M38 4L34 1M38 4L34 7" stroke="currentColor" stroke-width="1"/></svg></button>'
      : '<a class="work__acquire" href="' + href + '"><span>View availability</span><svg width="40" height="8" viewBox="0 0 40 8" fill="none" aria-hidden="true"><path d="M0 4H38M38 4L34 1M38 4L34 7" stroke="currentColor" stroke-width="1"/></svg></a>';
    return '<article class="work commerce-work" data-product-id="' + esc(product.id) + '">' +
      '<a class="work__media" href="' + href + '" aria-label="View ' + esc(product.title) + '"><img src="' + esc(product.image) + '" loading="lazy" decoding="async" alt="' + esc(product.title) + ' by ' + esc(product.artist) + '"></a>' +
      '<div class="work__body"><div class="commerce-work__heading"><div><a href="' + href + '" class="commerce-work__title"><h3 class="work__title">' + esc(product.title) + '</h3></a><p class="work__year">' + esc(product.artist) + ' \u00b7 ' + esc(product.year || "") + '</p></div><p class="commerce-work__availability">' + esc(product.availability || "Available") + '</p></div>' +
      '<div class="work__row"><div class="work__meta"><p>' + esc(product.collectionName) + '</p><p>' + esc(product.medium) + '</p><p>' + esc(product.editionSize ? "Edition of " + product.editionSize + " \u00b7 " + Number(product.remaining || 0) + " available" : product.seriesLabel || "Open edition") + '</p><label class="work__size">Size:<select data-catalogue-size aria-label="Print size for ' + esc(product.title) + '">' + sizes.map(function (size) { return '<option>' + esc(size) + '</option>'; }).join("") + '</select></label></div><p class="work__price">' + esc(window.LgndryCommerce.money(product.price)) + '</p></div>' + action + '</div></article>';
  }

  function values() {
    return {
      search: controls.querySelector("[data-catalogue-search]").value.trim().toLowerCase(), category: controls.querySelector("[data-filter-category]").value,
      collection: controls.querySelector("[data-filter-collection]").value, artist: controls.querySelector("[data-filter-artist]").value,
      availability: controls.querySelector("[data-filter-availability]").value, min: Number(controls.querySelector("[data-filter-min-price]").value || 0),
      max: Number(controls.querySelector("[data-filter-max-price]").value || Infinity), sort: controls.querySelector("[data-catalogue-sort]").value
    };
  }
  function apply() {
    var v = values(); var filtered = products.filter(function (p) {
      var haystack = [p.title, p.artist, p.category, p.collectionName].join(" ").toLowerCase();
      return (!v.search || haystack.indexOf(v.search) > -1) && (!v.category || p.category === v.category) && (!v.collection || p.collectionName === v.collection) && (!v.artist || p.artist === v.artist) && (!v.availability || p.availability === v.availability) && Number(p.price || 0) >= v.min && Number(p.price || 0) <= v.max;
    });
    filtered.sort(function (a, b) {
      if (v.sort === "price-low") return Number(a.price || 0) - Number(b.price || 0);
      if (v.sort === "price-high") return Number(b.price || 0) - Number(a.price || 0);
      if (v.sort === "popular") return Number(b.popularity || 0) - Number(a.popularity || 0);
      if (v.sort === "newest") return String(b.publishedAt || b.year || "").localeCompare(String(a.publishedAt || a.year || ""));
      return Number(!!b.featured) - Number(!!a.featured) || Number(a.position || 0) - Number(b.position || 0);
    });
    grid.innerHTML = filtered.length ? filtered.map(renderProduct).join("") : '<div class="catalogue-empty"><h2>No works found.</h2><p>Adjust the filters to continue exploring the collection.</p><button type="button" data-filter-clear>Clear filters</button></div>';
    controls.querySelector("[data-catalogue-results]").textContent = filtered.length + (filtered.length === 1 ? " work" : " works");
    grid.setAttribute("aria-busy", "false");
  }
  function clear() { controls.querySelectorAll("input").forEach(function (el) { el.value = ""; }); controls.querySelectorAll("select").forEach(function (el) { el.selectedIndex = 0; }); apply(); }

  controls.addEventListener("input", apply); controls.addEventListener("change", apply);
  controls.addEventListener("click", function (event) { var toggle = event.target.closest("[data-filter-toggle]"); if (toggle) { var panel = controls.querySelector("[data-filter-panel]"); var open = panel.classList.toggle("is-open"); toggle.setAttribute("aria-expanded", open ? "true" : "false"); } if (event.target.closest("[data-filter-clear]")) clear(); });
  grid.addEventListener("click", function (event) { var button = event.target.closest("[data-catalogue-add]"); if (!button) return; var product = products.find(function (p) { return p.id === button.dataset.catalogueAdd; }); if (!product) return; var card = button.closest("[data-product-id]"); var size = card.querySelector("[data-catalogue-size]").value; window.LgndryCommerce.add(window.LgndryCommerce.itemFromProduct(product, { size: size })); button.querySelector("span").textContent = "Added"; button.setAttribute("aria-label", product.title + " added to cart"); setTimeout(function () { button.querySelector("span").textContent = "Add to selection"; button.removeAttribute("aria-label"); }, 1200); });
  grid.addEventListener("click", function (event) { if (event.target.closest("[data-filter-clear]")) clear(); });
  grid.addEventListener("click", function (event) { var link = event.target.closest('a[href^="showroom.html"]'); if (!link) return; event.preventDefault(); document.documentElement.classList.add("showroom-leaving"); setTimeout(function () { window.location.href = link.href; }, 90); });

  window.LgndrySiteData.fetchCollection().then(function (items) { products = items.map(normalize); fillSelect("[data-filter-category]", optionValues("category")); fillSelect("[data-filter-collection]", optionValues("collectionName")); fillSelect("[data-filter-artist]", optionValues("artist")); apply(); }).catch(function (error) { console.error(error); grid.setAttribute("aria-busy", "false"); grid.innerHTML = '<div class="catalogue-empty"><h2>The collection is temporarily unavailable.</h2><p>Please refresh or contact the studio.</p></div>'; });
}());
