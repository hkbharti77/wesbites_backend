# Gyan VaniAi DPDP Act 2023 & Security Operations Runbook

**Version:** 2026.1  
**Statutory Governance:** Digital Personal Data Protection Act, 2023 (DPDP Act) | DPDP Rules, 2025 | CERT-In Directions, 2022 | Guidelines for Prevention of Dark Patterns, 2023  
**Designated Grievance Redressal Officer:** Himanshu Bharti (`contact@gyanvaniai.com`)  
**Official Address:** Dakbangla Chowk, Simri Bakhtiarpur, Bihar 852127, Republic of India  

---

## 1. Statutory Data Subject Rights (DSR) SOP

### Overview
Under **Sections 6(4), 11, 12, and 13** of the DPDP Act 2023 and **Rule 11 of the DPDP Rules 2025**, Indian Data Principals hold enforceable legal rights to:
- Access a summary of personal data processed (§11)
- Correct inaccurate or outdated personal data (§12)
- Erase personal data when the processing purpose is exhausted (§12)
- Withdraw previously granted consent (§6(4))
- File grievances with the Data Fiduciary before escalating to the Data Protection Board of India (DPBI) (§13)

### Statutory SLA Timeline: 15 Business Days
Every submitted DSR generates a unique tracking ticket (`DSR-YYYYMMDD-XXXX`) and computes a strict 15-business-day resolution due date (`slaResolutionDueAt`), skipping weekends and statutory holidays.

### Standard Operating Procedure for Compliance Officers
1. **Intake & Verification:**
   - Public requests arrive at `POST /api/public/privacy-requests` from the [Policy Page](https://www.gyanvaniai.com/privacy).
   - Review pending tickets in the CMS Admin Portal under **Platform Management → Privacy Requests (DSR)** (`/admin/privacy-requests`).
   - Verify the applicant's identity via registered email or OTP verification before disclosing or erasing sensitive records.
2. **Investigation & Action:**
   - **For Erasure Requests:** Locate corresponding records in `contact_leads`, `newsletter_subscribers`, and `cookie_consents`. If no legal obligation requires retention (e.g. active litigation, pending tax audits under Income Tax Act §44AA), execute permanent erasure or irreversible pseudonymization.
   - **For Access / Summary Requests:** Export the applicant's active profile, communication history, and consent timestamps.
   - **For Consent Withdrawal:** Update subscriber or cookie record to `status: 'suppressed'` or `status: 'rejected'`. Immediate cessation of processing is mandatory under §6(4).
3. **Recording Resolution & Audit Trail:**
   - In the Privacy Requests Dossier modal, update status to `resolved` or `rejected` with detailed compliance rationale in `resolutionNotes`.
   - The system automatically commits an immutable audit entry to `admin_audit_logs`.

---

## 2. Automated Purpose-Exhaustion Retention SOP

### Statutory Authority
Under **Section 8(7) of the DPDP Act 2023** and **Rule 8 of the DPDP Rules 2025**:
> A Data Fiduciary shall erase personal data upon the Data Principal withdrawing consent or as soon as it is reasonable to assume that the specified purpose is no longer being served.

### Configured Automated Purge Rules
1. **Unconfirmed Newsletter Subscriptions:** Hard deleted after **30 days** of inactivity.
2. **Cookie Consent Records:** Automatically expunged after **12 months (365 days / 31,536,000 seconds)** via MongoDB database TTL index on `cookie_consents.createdAt`.
3. **Historical Leads (Closed / Converted):** Leads aged greater than **24 months** without active sales cycles are irreversibly anonymized:
   - Full name replaced with `[ANONYMIZED_PURSUANT_TO_DPDP_ACT_S8_7]`
   - Email replaced with `[ANONYMIZED]@privacy.dpdp`
   - Phone and company set to `null`
   - Messages and notes purged
   - IP addresses masked to `[ANONYMIZED]`

### Running the Purge Job
- **Manual Execution (Dry Run):**
  ```bash
  cd backend
  node -e "import('./src/scripts/enforce-data-retention.js').then(m => m.runDataRetentionCleanup({ dryRun: true }))"
  ```
- **Live Production Execution:**
  ```bash
  cd backend
  npm run retention:cleanup
  ```
- **Linux Crontab Schedule:**
  Configure weekly execution every Sunday at 03:00 AM IST:
  ```cron
  0 3 * * 0 cd /var/www/backend && /usr/bin/npm run retention:cleanup >> /var/log/gyanvaniai-retention.log 2>&1
  ```

---

## 3. WhatsApp Contact Opt-Out & Suppression Protocol

### Architecture & Propagation
Gyan VaniAi operates official WhatsApp Business Cloud API & Coexistence automation via the gateway microservice at `connect.gyanvaniai.online`.

1. **Inbound Opt-Out Trigger:**
   - When a recipient replies with standard opt-out keywords (`STOP`, `UNSUBSCRIBE`, `OPT OUT`, `CANCEL`, or `NO`) in WhatsApp, the Meta Webhook listener on `connect.gyanvaniai.online` captures the event.
2. **CRM Suppression Sync:**
   - The gateway automatically flags the recipient's phone number as `marketing_opt_out: true` in the active CRM database.
   - The phone number is added to the campaign suppression blocklist.
   - All scheduled automated follow-up sequences, broadcast campaigns, and catalog push notifications immediately terminate for that recipient.
3. **Manual Override / Resubscription:**
   - Per Meta WhatsApp Business Messaging Policies and DPDP Act §6, marketing messaging cannot be resumed unless the recipient proactively sends an explicit re-opt-in message (e.g. `START` or `SUBSCRIBE`).

---

## 4. CERT-In 6-Hour Security Incident & Breach Protocol

### Statutory Authority
Under the **Cyber Security Directions (2022)** issued by the Indian Computer Emergency Response Team (CERT-In) under Section 70B(6) of the IT Act, 2000, and **Section 8(6) of the DPDP Act, 2023**:
- Mandatory notification of cybersecurity incidents to CERT-In within **6 hours of detection**.
- Mandatory intimation of personal data breaches to the Data Protection Board of India (DPBI) and affected Data Principals.

### Automated Detection & Dispatch Workflow
1. The backend security engine monitors `admin_audit_logs` for critical security triggers:
   - `PRIVILEGE_ESCALATION_DENIED`
   - `AUDIT_LOG_IMMUTABLE` (unauthorized mutation attempts on forensic records)
   - `AUTH_BRUTE_FORCE_TRIGGERED`
   - `BULK_DATA_EXPORT`
2. `incidentAlert.service.js` dispatches an automated high-priority email alert to the designated Grievance / Incident Officer at `contact@gyanvaniai.com`.
3. The alert calculates and highlights the exact statutory deadline:
   `CERT-In Statutory 6-Hour Reporting Deadline: <Timestamp + 6 Hours> (IST)`

### Incident Response Escalation Checklist
- [ ] **T+0h to T+1h:** Incident Response Officer verifies the alert authenticity and isolates compromised credentials / tokens via `revokeAllUserSessions(userId)`.
- [ ] **T+1h to T+3h:** Determine scope of affected Data Principals (extract audit logs via `GET /api/admin/audit/export`).
- [ ] **T+3h to T+5h:** Draft formal incident report in CERT-In Incident Reporting Format (Annexure I) including:
  - Time of occurrence and detection
  - IP address and system logs
  - Nature and extent of compromised systems
  - Remedial measures implemented
- [ ] **T+5h to T+6h:** Transmit report to CERT-In Incident Reporting Portal (`incident@cert-in.org.in` / `https://www.cert-in.org.in`) before the statutory 6-hour deadline expires.
- [ ] **Post T+6h:** Prepare DPBI intimation notice and Data Principal notices under Section 8(6).

---

## 5. Rollback & Staging Verification Procedures

### Staging Verification Checklist
Prior to pushing any privacy updates to production:
1. Verify consent banner gates Microsoft Clarity and Google Analytics until user clicks Accept.
2. Verify contact and lead forms reject unconsented submissions with HTTP 400 `CONSENT_REQUIRED`.
3. Verify public DSR submission creates a valid `DSR-YYYYMMDD-XXXX` ticket and 15-business-day SLA in MongoDB Atlas.
4. Run automated regression suites:
   ```bash
   cd backend
   node tests/dpdp-compliance.test.js
   node tests/dpdp-workflow-verification.test.js
   ```

### Safe Rollback Procedure
If any regression is observed:
1. **Backend Rollback:**
   ```bash
   git checkout HEAD~1 -- src/routes/ src/controllers/ src/services/
   ```
2. **Frontend Rollback:**
   ```bash
   git checkout HEAD~1 -- saas-crm-websites/index.html saas-crm-websites/src/
   ```
3. **Database Safeguard:**
   MongoDB collections and documents are non-destructive. The TTL index on `cookie_consents.createdAt` can be dropped or modified without data loss:
   ```javascript
   db.collection('cookie_consents').dropIndex('createdAt_1')
   ```
