# Global-AccessChina

Shop Taobao in English, priced in US dollars, delivered to Ghana. NestJS + Postgres,
plain HTML/JS storefront, Paystack payments (mobile money and card).

## What's in it

| Area | Where |
| --- | --- |
| Storefront: home, search, product, cart, order tracking | `public/` |
| Catalogue: Taobao search and items, translation, brand block list, product cache | `src/catalog` |
| Pricing: markup, sea/air shipping, service fee, cedi conversion | `src/catalog/pricing.service.ts` |
| Orders and Paystack: server-side prices, payment verify, signed webhook | `src/orders` |
| Admin: order list, status updates, weights, buy links | `/admin.html`, `src/admin` |
| Database migrations (run on start) | `src/db/db.service.ts` |

## Modes

- **Preview (no `TAOBAO_API_KEY`)**: 12 sample products, banner on every page, checkout off.
- **Live**: set `TAOBAO_API_KEY`/`TAOBAO_API_SECRET` (Onebound format). Checkout switches on
  when `PAYSTACK_SECRET_KEY` and `GHS_PER_USD` are also set.

## Going live checklist

1. Add the Taobao key, then open `/api/admin/debug/raw-item/<taobao id>` (admin login)
   and check the fields match `onebound.source.ts`.
2. Add `DEEPL_API_KEY` for better translations (otherwise the provider's English is used).
3. Paystack: add `PAYSTACK_SECRET_KEY` (test key first), set `GHS_PER_USD`, and in the
   Paystack dashboard set the webhook URL to `<PUBLIC_URL>/api/payments/paystack/webhook`.
   Place a test order, then switch to the live key.
4. Set `PICKUP_ADDRESS`, `SUPPORT_WHATSAPP`, and a custom domain.
5. Confirm with your forwarder whether rates include Ghana duty; adjust the pricing variables.

## Run locally

```
npm install
DATABASE_URL=postgres://... PUBLIC_URL=http://localhost:3000 ADMIN_PASSWORD=... npm run build && npm start
```

Deploys on Railway with the included `Dockerfile` and `railway.json` (health check `/api/health`).

## Not included yet

Customer emails/SMS (order updates show on the tracking page), automatic purchasing on
Taobao (staff buy using the links in admin), refunds through the API (do them in Paystack),
an OTAPI adapter (add one implementing `ProductSource` once OTCommerce sends its docs).
