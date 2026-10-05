# Deployment Guide

## Requirements

- PHP 8.2 or later with `curl`, `mbstring`, `openssl`, `pdo_mysql`, `session`, and `json`.
- MySQL 8 or MariaDB 10.4 or later.
- Apache with `mod_rewrite` and `mod_headers`, or equivalent Nginx configuration.
- HTTPS in production.

## Database

Create an empty database and import `database/schema.sql`. The schema creates `users`, `notes`, and `email_verifications`. Never import a schema over a production database without a backup and migration review.

## Environment

Copy `.env.example` to `.env`. Set `APP_ENV=production`, a public HTTPS `APP_URL`, database credentials, mail sender, and Google OAuth values. Keep `.env` outside version control.

## Apache and cPanel

Set the document root to `konoha_nots/public`. On cPanel, put application files outside `public_html` where possible, then point a subdomain document root to `public/`. If the host cannot change document roots, copy only the contents of `public/` to `public_html` and change paths in `public/api.php` only after a security review.

Enable HTTPS redirects at the host or virtual-host layer. `public/.htaccess` supplies basic headers and `/api/*` rewriting; do not rely on it as a substitute for HTTPS.

## Google OAuth

In Google Cloud Console, create a Web application OAuth client. Add the exact production URL to authorized origins and `https://your-domain.example/api.php?route=auth/google/callback` to authorized redirect URIs. Store the resulting client ID and secret in `.env`, never in JavaScript or Git.

## Email Verification

Production uses PHP `mail()`. Configure the host MTA, SPF, DKIM, and a real sender domain before enabling public registration. For stronger delivery reliability, replace `Mailer` with an authenticated SMTP provider while keeping verification tokens hashed in the database.

## Final Checks

Verify registration, email verification, sign-in, Google sign-in, session expiry, logout, create/update/delete/search notes, cross-user note denial, and direct access to non-public directories. Monitor PHP and web-server logs; do not expose error details to users.
