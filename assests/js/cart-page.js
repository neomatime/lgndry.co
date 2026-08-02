(function () {
  "use strict";

  var root = document.querySelector("[data-cart-page]");
  if (!root || !window.LgndryCommerce) return;

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function render() {
    var cart = window.LgndryCommerce.getCart();
    var subtotal = window.LgndryCommerce.subtotal(cart);
    var delivery = window.LgndryCommerce.deliveryFee("delivery", cart);

    if (!cart.length) {
      root.innerHTML = '<header class="commerce-page__head"><span>Private selection</span><h1>Your cart.</h1><p>Works you select will remain here while you continue exploring.</p></header><section class="commerce-empty"><h2>Your cart is empty.</h2><p>Your selected editions and presentation choices will appear here.</p><a class="commerce-empty__action" href="collection.html">Explore the collection</a></section>';
      return;
    }

    root.innerHTML = '<header class="commerce-page__head"><span>Private selection</span><h1>Your cart.</h1><p>Review editions and presentation options before continuing to checkout.</p></header><div class="cart-layout"><section class="cart-list" aria-label="Selected artworks">' + cart.map(function (item, index) {
      var title = esc(item.title);
      return '<article class="cart-line"><a href="showroom.html?id=' + encodeURIComponent(item.artworkId) + '"><img src="' + esc(item.image) + '" alt="' + title + '" loading="lazy" decoding="async"></a><div class="cart-line__details"><span>' + esc(item.artist || "Dan Mokgwadi") + '</span><h2>' + title + '</h2><p>' + esc(item.size) + ' · ' + esc(item.framing || "Unframed") + '</p><div class="cart-line__controls"><label>Quantity <input type="number" min="1" max="' + esc(item.maxQuantity || 1) + '" value="' + esc(item.quantity) + '" data-cart-quantity="' + index + '" aria-label="Quantity for ' + title + '"></label><button type="button" data-cart-remove="' + index + '" aria-label="Remove ' + title + ' from cart">Remove</button></div></div><strong>' + esc(window.LgndryCommerce.money(Number(item.price) * Number(item.quantity))) + '</strong></article>';
    }).join("") + '</section><aside class="cart-summary"><span>Order summary</span><dl><div><dt>Subtotal</dt><dd>' + esc(window.LgndryCommerce.money(subtotal)) + '</dd></div><div><dt>Estimated delivery</dt><dd>' + esc(window.LgndryCommerce.money(delivery)) + '</dd></div><div class="cart-summary__total"><dt>Estimated total</dt><dd>' + esc(window.LgndryCommerce.money(subtotal + delivery)) + '</dd></div></dl><p>Collection is free. Final delivery and EFT instructions are confirmed before fulfilment.</p><a class="commerce-primary" href="checkout.html">Proceed to Checkout</a><a class="commerce-text-link" href="collection.html">Continue shopping</a></aside></div>';

    root.querySelectorAll("[data-cart-quantity]").forEach(function (input) {
      input.addEventListener("change", function () {
        window.LgndryCommerce.update(Number(input.dataset.cartQuantity), Number(input.value));
        render();
      });
    });

    root.querySelectorAll("[data-cart-remove]").forEach(function (button) {
      button.addEventListener("click", function () {
        window.LgndryCommerce.remove(Number(button.dataset.cartRemove));
        render();
      });
    });
  }

  window.addEventListener("lgndry-cart-change", render);
  render();
}());
