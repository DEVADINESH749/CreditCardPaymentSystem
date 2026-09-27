# Credit Card Payment System API

The Django API uses the `django_url` base URL (default `http://127.0.0.1:8000`). The payment service uses `fastapi_url` (default `http://127.0.0.1:8001`). Django API routes require a JWT access token except registration, login, and token refresh. Send authenticated requests with `Authorization: Bearer <access token>`.

## Authentication

| Endpoint | Method | Authentication | Request | Success | Common errors |
| --- | --- | --- | --- | --- | --- |
| `/users/register/` | POST | None | JSON: `name`, `email`, `password` | 201: `{ "id": 1, "name": "Test User", "email": "test@example.com" }` | 400 invalid or duplicate data |
| `/users/login/` | POST | None | JSON: `email`, `password` | 200: `{ "refresh": "<JWT>", "access": "<JWT>" }` | 401 invalid credentials |
| `/users/token/refresh/` | POST | None; a refresh token is required in the body | JSON: `{ "refresh": "<JWT>" }` | 200: `{ "access": "<JWT>" }` | 401 invalid or expired refresh token |

## Cards

All card routes require a JWT access token. The card number is accepted only when adding a card, is never returned, and is stored only as a mask and last four digits. CVV/security codes and caller-supplied `user_id` are rejected.

| Endpoint | Method | Request | Success | Common errors |
| --- | --- | --- | --- | --- |
| `/cards/` | POST | JSON: `card_type` (`CREDIT` or `DEBIT`), `card_holder_name`, `card_number` (13-19 digits passing checksum), `expiry_month` (1-12), `expiry_year` (current or future) | 201: card object with `id`, `user_id`, card type/name, `masked_card_number`, `last_four_digits`, expiry, and `created_at`; no full card number or CVV | 400 invalid/expired card data; 401 missing/invalid access token |
| `/cards/` | GET | None | 200: array of the authenticated user's card objects, with masked number only | 401 missing/invalid access token |
| `/cards/{id}/` | DELETE | Integer card `id` in the path | 204: empty response | 401 missing/invalid access token; 404 card not found for this user |

## Payments

| Endpoint | Method | Authentication | Request | Success | Common errors |
| --- | --- | --- | --- | --- | --- |
| `/` (FastAPI service) | GET | None | None | 200: `{ "message": "Credit Card Payment API is running" }` | None documented |
| `/payment` (FastAPI service) | POST | JWT access token in `Authorization: Bearer ...` | JSON: `{ "card_id": 1, "amount": "12.50" }` | 201: transaction object with `transaction_id`, `user_id`, `card_id`, `amount`, `transaction_reference`, `status`, `transaction_date`. Status is `SUCCESS` or `FAILED` (simulated). | 401 missing/invalid token; 404 card not found for this user; 422 invalid request; 503 database unavailable |

FastAPI's generated Swagger UI and OpenAPI schema are available at `/docs` and `/openapi.json` on the payment service. The payment operation declares its bearer requirement, request model, success response, and validation response.

## Transactions

All transaction routes require a JWT access token and return only the authenticated user's transactions. These are read-only endpoints.

| Endpoint | Method | Query/body | Success | Common errors |
| --- | --- | --- | --- | --- |
| `/transactions/` | GET | Optional exact-match filters: `date` (`YYYY-MM-DD`), `amount` (positive decimal with at most 2 decimal places), `status` (`PENDING`, `SUCCESS`, or `FAILED`). Filters can be combined. | 200: array of transaction objects with `id`, `user_id`, `card_id`, `amount`, `transaction_reference`, `status`, and `transaction_date` | 400 invalid/unsupported filter; 401 missing/invalid access token |
| `/transactions/{id}/` | GET | Integer transaction `id` in the path | 200: transaction object (same fields as above) | 401 missing/invalid access token; 404 transaction not found for this user |

## Admin

`/admin/` is Django's session-authenticated HTML administration site, not a REST API. The transaction admin includes a CSV export action in its UI; there are no separately registered admin API endpoints, so none are added to the Postman API requests.

## Sensitive data

Do not put real credentials, JWTs, card numbers, or CVVs in documentation or collection variables. The collection uses a known synthetic payment test number only. API responses do not include passwords, full card numbers, or CVVs.