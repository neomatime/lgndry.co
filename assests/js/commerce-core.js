(function () {
  "use strict";
  var CART_KEY = "lgndry_collection_cart_v2";

  function read() { try { var value = JSON.parse(localStorage.getItem(CART_KEY) || "[]"); return Array.isArray(value) ? value : []; } catch (_error) { return []; } }
  function write(cart) { localStorage.setItem(CART_KEY, JSON.stringify(cart)); window.dispatchEvent(new CustomEvent("lgndry-cart-change", { detail: cart })); return cart; }
  function key(item) { return [item.artworkId, item.size || "", item.framing || ""].join("::"); }
  function add(item) {
    var cart = read(), itemKey = key(item), found = cart.find(function (entry) { return key(entry) === itemKey; });
    var max = Math.max(1, Number(item.maxQuantity || item.remaining || 1));
    if (found) found.quantity = Math.min(max, Number(found.quantity || 1) + Number(item.quantity || 1));
    else cart.push(Object.assign({}, item, { quantity: Math.min(max, Math.max(1, Number(item.quantity || 1))) }));
    return write(cart);
  }
  function update(index, quantity) { var cart = read(), item = cart[index]; if (!item) return cart; var max = Math.max(1, Number(item.maxQuantity || item.remaining || 1)); if (quantity <= 0) cart.splice(index, 1); else item.quantity = Math.min(max, quantity); return write(cart); }
  function remove(index) { var cart = read(); cart.splice(index, 1); return write(cart); }
  function clear() { return write([]); }
  function subtotal(cart) { return (cart || read()).reduce(function (sum, item) { return sum + Number(item.price || 0) * Number(item.quantity || 1); }, 0); }
  function count(cart) { return (cart || read()).reduce(function (sum, item) { return sum + Number(item.quantity || 1); }, 0); }
  function deliveryFee(method, cart) { if (/collect/i.test(method || "")) return 0; return (cart || read()).length ? 250 : 0; }
  function money(value) { return "R " + Number(value || 0).toLocaleString("en-ZA"); }
  function itemFromProduct(product, options) {
    options = options || {};
    return { artworkId: product.id, title: product.title, artist: product.artist || "Dan Mokgwadi", year: product.year, category: product.category, collectionName: product.collectionName, size: options.size || String(product.sizes || "").split("\n")[0], framing: options.framing || "Unframed", quantity: Number(options.quantity || 1), price: Number(product.price || 0), image: product.image, details: product.seriesLabel || product.medium || "Archival Pigment Print", maxQuantity: Math.max(1, Number(product.remaining || 1)), requiresConfirmation: !!product.requiresConfirmation };
  }
  function createCartLink() {
    if (document.querySelector("[data-commerce-cart-link]")) return;
    var link = document.createElement("a"); link.href = "cart.html"; link.className = "commerce-cart-link"; link.setAttribute("data-commerce-cart-link", ""); link.setAttribute("aria-label", "View shopping cart"); link.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20.5 8H6"/><circle cx="10" cy="20" r="1"/><circle cx="17" cy="20" r="1"/></svg><span data-commerce-cart-count></span>';
    var header = document.querySelector(".page-header");
    if (header) {
      var actions = header.querySelector(".page-header__actions");
      var brand = header.querySelector(".page-header__brand");
      if (!actions) {
        actions = document.createElement("div");
        actions.className = "page-header__actions";
        header.appendChild(actions);
      }
      link.classList.add("commerce-cart-link--header");
      if (brand) actions.appendChild(brand);
      actions.appendChild(link);
    } else {
      var commerceHeader = document.querySelector(".commerce-header");
      if (commerceHeader) {
        var commerceActions = document.createElement("div");
        var commerceLink = commerceHeader.querySelector("a:last-of-type");
        commerceActions.className = "commerce-header__actions";
        link.classList.add("commerce-cart-link--header");
        commerceHeader.appendChild(commerceActions);
        commerceActions.appendChild(link);
        if (commerceLink) commerceActions.appendChild(commerceLink);
      } else {
        document.body.appendChild(link);
      }
    }
    updateCount();
  }
  function updateCount() {
    var amount = count();
    document.querySelectorAll("[data-commerce-cart-count]").forEach(function (el) {
      el.textContent = String(amount);
      el.hidden = amount === 0;
    });
    document.querySelectorAll("[data-commerce-cart-link]").forEach(function (link) {
      link.setAttribute("aria-label", amount ? "View shopping cart, " + amount + (amount === 1 ? " item" : " items") : "View shopping cart, empty");
    });
  }
  window.addEventListener("lgndry-cart-change", updateCount);
  window.LgndryCommerce = { getCart: read, add: add, update: update, remove: remove, clear: clear, subtotal: subtotal, count: count, deliveryFee: deliveryFee, money: money, itemFromProduct: itemFromProduct, createCartLink: createCartLink };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", createCartLink); else createCartLink();
}());
