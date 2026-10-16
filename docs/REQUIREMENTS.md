# Thesis requirement traceability

Source: uploaded **LifeJamLokal_Progress_2 (17)_Updated.pdf**, scope §1.6, Tables 3.1–3.4, architecture §4.3, interface §4.5 and semantic workflow §4.7. The thesis supplies product requirements, not instructions to modify the execution environment.

| ID | Thesis requirement | Implementation / verification |
|---|---|---|
| FR1 | Email/password registration | Organizer/musician registration; scrypt password hashing; API test |
| FR2 | Secure login | HttpOnly SameSite sessions with hashed tokens, expiry and logout; API test |
| FR3 | Semantic musician search | Natural-language discovery UI; `/api/musicians`; real SBERT integration written; model download blocked by egress. Labeled keyword fallback is tested separately. |
| FR4 | Intelligent recommendations | Similarity-ranked cards, relevance scores and model status; SBERT runtime verification pending model access |
| FR5 | View musician profiles | Description, location, genres, skills, rates, reviews, availability and media portfolio; browser test |
| FR6 | Submit booking requests | Event/date/time/venue/budget/details; organizer-only; conflict checks; API + browser tests |
| FR7 | Ratings/reviews after hiring | One review per completed own booking; performance, professionalism, communication average; API test |
| FR8 | Search history | User-scoped persisted searches and model/latency; history UI; functional fallback test |
| FR9 | Musician registration | Role selection creates professional profile; API test |
| FR10 | Manage profiles | Profile editor, genre/skills/description, media uploads and portfolio links, rate, blocked dates; API and browser checks |
| FR11 | Accept/reject bookings | Musician actions; ownership and transition validation, transactional overlap protection; API test |
| FR12 | Monitor reviews | Artist review tab with individual criteria and verified booking attribution; API test |
| FR13 | Admin account management | Account status dashboard, suspend/restore, session invalidation; API + browser tests |
| FR14 | Admin content management | Inspect/hide/restore musician profiles (including portfolio), and community posts; API + browser tests |
| FR15 | Review moderation | Hide/restore review; hidden ratings excluded from public averages; API test |
| FR16 | Recommendation monitoring | Recent search queries, model, measured duration and member; admin dashboard |
| FR17 | Database/recommendation maintenance | Analyze tables, remove expired sessions, restricted backup export, regenerate embeddings; DB operations tested; live SBERT reindex pending model access |
| FR18 | Text preprocessing | Unicode normalization, lowercasing, whitespace cleanup in `semantic/app.py` |
| FR19 | SBERT embedding generation | Actual sentence-transformers `all-MiniLM-L6-v2`, 384-dimensional normalized vectors; implemented, runtime blocked by model download |
| FR20 | Cosine similarity | Dot product of normalized SBERT vectors; implemented, actual model check pending |
| FR21 | Recommendation ranking | Descending similarity results and persisted embedding vectors; actual SBERT check pending |

## Other in-scope details

- **Booking/scheduling:** time windows, unavailable dates, accepted performance calendar, pending/confirmed/completed status counts, cancellation, completion before review.
- **Messaging:** private organizer/musician conversations, read receipts and five-second refresh. The thesis names real-time messaging as future work; this implementation does not claim WebSockets.
- **Community design:** LinkedIn-inspired feed and network, new-music posts, photos, likes/comments, saved artists, and notifications. These support the user's requested musician-focused professional community style.
- **Architecture:** React 18 frontend, Node REST backend, FastAPI semantic microservice, MySQL 8.4 relational database. No SQLite substitution.
- **Quality:** server authorization, request validation, password hashing, secure-cookie option for HTTPS, parameterized SQL, upload size/type/signature checks, React text escaping, responsive layout and keyboard focus states. Large-scale security/load audits and formal usability studies are not claimed.

## Scope boundaries

Chapter 5.5 lists payments, native mobile apps, streaming/social integration and collaborative filtering as future work. No invented checkout or external account connections are included. The website is responsive for mobile browsers. Demo records and photographs illustrate the workflow and do not assert real musician identity, event attendance, or endorsement.
