# Aadhaar Format-Only Rewards

This feature adds Aadhaar-gated citizen submissions and AI reward scoring for Apni Awaaz.

## Current Prototype Scope

- Aadhaar entry is a 12-digit format check only.
- No UIDAI authentication, OTP, e-KYC, offline XML, VID, or demographic verification is performed.
- Any 12-digit number is accepted for local/demo use.
- Raw Aadhaar is accepted only by `/api/citizen/session` and optional `/api/submissions` input, then immediately converted before persistence.

## Storage Model

The application stores only:

- `aadhaarHash`: keyed HMAC reference for matching repeated prototype submissions.
- `aadhaarMasked`: `xxxx-xxxx-1234` display value.
- `aadhaarLast4`: last four digits for display and support lookup.
- `aadhaarVerified`: always `false` in this version.
- `identityMode`: `aadhaar_format_only`.

Raw Aadhaar is not written to `raw_intake`, `submissions`, audit responses, receipt lookup, dashboard cards, or browser local storage.

Postgres continues using JSONB payload tables:

- `raw_intake.payload` stores pending intake, masked identity, and HMAC reference.
- `submissions.payload` stores processed intake, masked identity, AI quality score, reward points, and reward reasons.

Cumulative reward lookup does not add a raw-Aadhaar table. The API rebuilds the citizen's total from:

- processed `submissions.payload` rows where `aadhaarHash` matches the keyed HMAC of the entered 12-digit number.
- unprocessed `raw_intake.payload` rows where the same hash is still pending, processing, or failed.

## Flow

1. Citizen enters a 12-digit Aadhaar number in Apni Awaaz.
2. API returns a signed citizen token with masked identity metadata.
3. Citizen submits text, voice, or photo issue with location.
4. API queues raw intake with masked/HMAC Aadhaar metadata.
5. Batch AI processing classifies the issue and returns `qualityScore` plus short quality factors.
6. `citizenScore`, `rewardPoints`, `rewardBand`, and `rewardReasons` are stored on the processed submission.
7. Citizens can enter Aadhaar again to view cumulative reward points, processed/pending report counts, average quality, recent rewards, and milestone progress.
8. Data Explorer and project decision views show masked identity status, citizen score, average submission quality, and rewarded citizen count.

## Citizen Reward Lookup

Endpoints:

- `POST /api/citizen/rewards/lookup`: public format-only Aadhaar lookup for the login screen.
- `GET /api/citizen/rewards/me`: citizen-token lookup for the logged-in app.

Returned fields include:

- `totalRewardPoints`: sum of processed `rewardPoints` to date.
- `processedSubmissionCount`: number of processed submissions for that Aadhaar hash.
- `pendingSubmissionCount`: queued or processing reports not scored yet.
- `averageQualityScore`: average AI quality score for processed reports.
- `currentMilestone`, `nextMilestone`, `pointsToNextMilestone`, and `milestoneProgressPercent`.

Milestones are points-based:

- 0: Ready to earn.
- 100: Civic Starter.
- 250: Ward Watch.
- 500: Problem Solver.
- 1000: Public Champion.
- 2000: LokSetu Guardian.

Because Aadhaar verification is not enabled yet, this is a prototype reward ledger keyed by format-only Aadhaar input. Anyone who knows a 12-digit number can look up that prototype total, so the response remains public-safe: masked Aadhaar, aggregate counts, categories, bands, and no raw complaint text.

## UIDAI Research Notes

- UIDAI describes Aadhaar as a 12-digit random number issued to residents.
- UIDAI masked Aadhaar guidance displays only the last four digits.
- UIDAI Aadhaar Data Vault guidance applies when storing full Aadhaar numbers or connected Aadhaar data and points to vault/HSM-based controls.
- UIDAI VID guidance says VID is a temporary 16-digit number that can be used in place of Aadhaar for authentication/e-KYC flows.

Sources:

- https://uidai.gov.in/en/my-aadhaar/about-your-aadhaar.html
- https://www.uidai.gov.in/en/283-faqs/aadhaar-online-services/e-aadhaar/1887-what-is-masked-aadhaar.html
- https://uidai.gov.in/images/FAQs_Aadhaar_Data_Vault_03112025_v10.pdf
- https://uidai.gov.in/en/contact-support/have-any-question/284-english-uk/faqs/aadhaar-online-services/virtual-id-vid.html

## Production Upgrade Path

Before real Aadhaar use:

- Replace format-only login with an authorized Aadhaar/VID/offline e-KYC flow.
- Implement a compliant Aadhaar Data Vault if full Aadhaar or connected Aadhaar data must be retained.
- Use HSM-backed key management and rotation for any Aadhaar reference-key mapping.
- Add explicit consent, retention windows, deletion/export procedures, audit logs, and access review.
- Keep MP/dashboard views masked and public-safe.
