const cors = { "Access-Control-Allow-Origin": "https://www.lgndry-co.co.za", "Access-Control-Allow-Headers": "content-type, x-webhook-secret" };
const money = (value: number) => `R ${Number(value || 0).toLocaleString("en-ZA")}`;
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m] || m));

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const expectedSecret = Deno.env.get("ORDER_WEBHOOK_SECRET");
    if (!expectedSecret || request.headers.get("x-webhook-secret") !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const payload = await request.json();
    const order = payload.record;
    if (payload.type !== "INSERT" || payload.table !== "orders" || !order?.customerEmail) throw new Error("Invalid order webhook");
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) throw new Error("Order email service is not configured");
    const items = Array.isArray(order.items) ? order.items : [];
    const rows = items.map((item: Record<string, unknown>) => `<tr><td style="padding:12px 0;border-bottom:1px solid #ddd8d0"><strong>${escapeHtml(item.title)}</strong><br><span style="color:#77716a;font-size:12px">${escapeHtml(item.size)} Â· ${escapeHtml(item.framing || "Unframed")} Â· Qty ${escapeHtml(item.quantity || 1)}</span></td><td align="right" style="padding:12px 0;border-bottom:1px solid #ddd8d0">${money(Number(item.lineTotal || 0))}</td></tr>`).join("");
    const html = `<!doctype html><html><body style="margin:0;background:#f3f0eb;font-family:Arial,sans-serif;color:#1d1c1a"><table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 14px"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#fff;border:1px solid #ddd8d0"><tr><td style="padding:30px 38px;border-bottom:1px solid #ddd8d0;font-family:Georgia,serif;font-size:24px;letter-spacing:4px">LGNDRY.Co</td></tr><tr><td style="padding:42px 38px"><div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#9a765a">${escapeHtml(order.orderType)} received</div><h1 style="font:normal 42px/1.05 Georgia,serif;margin:18px 0">Thank you, ${escapeHtml(String(order.customerName || "").split(" ")[0])}.</h1><p style="color:#655f58;line-height:1.7">Your order <strong>${escapeHtml(order.orderNumber)}</strong> has been received. The studio will confirm availability, delivery, and ${escapeHtml(order.paymentMethod)} instructions before fulfilment.</p><table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0">${rows}</table><table width="100%"><tr><td>Subtotal</td><td align="right">${money(order.subtotal)}</td></tr><tr><td>Delivery</td><td align="right">${money(order.deliveryFee)}</td></tr><tr><td style="padding-top:12px;font-weight:bold">Total</td><td align="right" style="padding-top:12px;font-weight:bold">${money(order.grandTotal)}</td></tr></table><p style="margin-top:30px;font-size:12px;color:#77716a">Payment status: ${escapeHtml(order.paymentStatus)}<br>No card details were collected.</p><a href="https://www.lgndry-co.co.za/account.html#orders" style="display:inline-block;margin-top:16px;padding:15px 22px;background:#1d1c1a;color:#fff;text-decoration:none;font-size:11px;letter-spacing:2px;text-transform:uppercase">View My Orders</a></td></tr></table></td></tr></table></body></html>`;
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: Deno.env.get("ORDER_EMAIL_FROM") || "LGNDRY.Co <orders@lgndry-co.co.za>", to: [order.customerEmail], subject: `Order ${order.orderNumber} received â€” LGNDRY.Co`, html }) });
    if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
    return new Response(JSON.stringify({ sent: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unable to send confirmation" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});

