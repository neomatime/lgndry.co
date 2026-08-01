(function () {
  "use strict";
  var enhanced = new WeakSet();

  function closeAll(except) {
    document.querySelectorAll(".lgndry-select.is-open").forEach(function (root) {
      if (root !== except) {
        root.classList.remove("is-open");
        root.querySelector("button").setAttribute("aria-expanded", "false");
      }
    });
  }

  function enhance(select) {
    if (enhanced.has(select) || select.multiple || select.hasAttribute("data-native-select")) return;
    enhanced.add(select);
    var root = document.createElement("div");
    root.className = "lgndry-select";
    var button = document.createElement("button");
    button.type = "button";
    button.className = "lgndry-select__trigger";
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");
    var list = document.createElement("div");
    list.className = "lgndry-select__menu";
    list.setAttribute("role", "listbox");
    select.parentNode.insertBefore(root, select);
    root.appendChild(select);
    root.appendChild(button);
    root.appendChild(list);
    select.classList.add("lgndry-select__native");

    function render() {
      var selected = select.options[select.selectedIndex];
      button.innerHTML = '<span>' + (selected ? selected.textContent : "Select") + '</span><svg viewBox="0 0 12 7" aria-hidden="true"><path d="M1 1l5 5 5-5"/></svg>';
      list.innerHTML = "";
      Array.prototype.forEach.call(select.options, function (option, index) {
        var item = document.createElement("button");
        item.type = "button";
        item.className = "lgndry-select__option";
        item.textContent = option.textContent;
        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", option.selected ? "true" : "false");
        item.disabled = option.disabled;
        item.addEventListener("click", function () {
          select.selectedIndex = index;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          render();
          closeAll();
          button.focus();
        });
        list.appendChild(item);
      });
    }

    button.addEventListener("click", function () {
      var open = !root.classList.contains("is-open");
      closeAll(root);
      root.classList.toggle("is-open", open);
      button.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        var active = list.querySelector('[aria-selected="true"]');
        if (active) active.focus();
      }
    });
    root.addEventListener("keydown", function (event) {
      var options = Array.prototype.slice.call(list.querySelectorAll(".lgndry-select__option:not(:disabled)"));
      var current = options.indexOf(document.activeElement);
      if (event.key === "Escape") { closeAll(); button.focus(); }
      if (event.key === "ArrowDown" && root.classList.contains("is-open")) { event.preventDefault(); options[Math.min(options.length - 1, current + 1)].focus(); }
      if (event.key === "ArrowUp" && root.classList.contains("is-open")) { event.preventDefault(); options[Math.max(0, current - 1)].focus(); }
    });
    select.addEventListener("change", render);
    render();
  }

  function scan(scope) {
    (scope || document).querySelectorAll("select").forEach(enhance);
  }

  document.addEventListener("click", function (event) {
    if (!event.target.closest(".lgndry-select")) closeAll();
  });
  scan();
  new MutationObserver(function (records) {
    records.forEach(function (record) {
      record.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        if (node.matches && node.matches("select")) enhance(node);
        scan(node);
      });
    });
  }).observe(document.body, { childList: true, subtree: true });
}());
