# Decisions Log

## 2026-11-19 - Blog Page & Navbar "Documentation -> Blog" 1:1 Lateral Framer Template Implementation
- **Context**: User uploaded 2 screenshots: (1) circled "Documentation" in the navbar, requesting to rename it to "Blog", and (2) uploaded Lateral's Blog template (`https://lateral.framer.media/blog`) requesting to port the entire Blog structure 1:1 into the theme.
- **Implementation**:
  1. **Navbar Integration**: Replaced "Documentation" (`/docs`) in desktop and mobile navigation with "Blog" (`/blog`), added active link highlighting, and enabled automatic Light Theme (`#f9f9f9`) activation across all `/blog` routes.
  2. **Blog Index (`/blog`) Architecture**:
     - Built `BlogView.tsx` with exact `#f9f9f9` light theme and left gutter border (`border-l border-[#e6e3e3] pl-6 sm:pl-8`).
     - Eyebrow `■ BLOG`, 62px Spectral serif `News & Insights` headline with muted italic accent, subtitle, and black pill `[ Request Demo ]` button.
     - Featured 2-column bento card (`#e5e5e3`) with top animated hover line, `NEWS` category tag, `Jun 5, 2026` date, 34px Spectral serif title, description, and high-res phone graphic.
     - 6-article grid (3 columns x 2 rows) with top line hover animations, `INSIGHTS` tag, 16:9 natural photography, dates, titles, and descriptions.
     - Integrated the dark `#191919` bento CTA card directly below the 6-article grid matching `final-cta`: `■ GET STARTED`, 42px Spectral serif "See Why Top Finance Teams Use Lateral", "Book a demo to see Lateral in action.", white pill `[ Request Demo ]` button, and the dashboard UI mockup (`cta_dashboard.png`).
  3. **Single Post View (`/blog/[slug]`)**:
     - Replicated Lateral single post layout: `↶ All Posts` back button, 52px headline, wide banner image, 2-column editorial layout with author card (`John Carver • Co-Founder`), sticky sidebar with published date and `[ Request Demo ]` button, and "Read Next" 3-card related section with `[ View All Articles ]` button.
  4. **Assets & Data**:
     - Downloaded all 7 high-res photography assets locally into `landing/public/assets/blog/`.
     - Scraped full editorial content for all 7 posts into `landing/lib/lateralBlogData.json` with helper functions in `landing/lib/blogData.ts`.
  5. **Build & Verification**: Verified production build (`38/38` static routes generated cleanly) and confirmed with Playwright screenshots.

## 2026-11-19 - Company Page 1:1 Lateral Framer Template Implementation & Polish
- **Context**: User provided iterative review on Company page (`/company`): replace Founder name with Mahipal Choudhary (`Mahipal Choudhary`, `Founder & CEO`) with studio B&W portrait, configure 2-men / 2-women leadership team, implement live count-up stats animation (`500+`, `52`, `25`), position 16:9 MAHI Keynote Conference banner, style Open Roles table with black pill buttons, place obsidian `#131517` employee quote card below Open Roles, and remove extra bottom CTA card.
- **Implementation**:
  1. **Leadership Team**: Position 1 updated to `Mahipal Choudhary` (`Founder & CEO`) with `mahipal_founder.jpg` portrait, followed by John Carver (Co-Founder), Sophie Green (CTO), and Jo West (VP Product). Styled with `text-[14px]` name and `text-[12px] text-white/60` role.
  2. **Count-Up Stat Animation**: Built custom `StatCounter` component with `IntersectionObserver`, `requestAnimationFrame`, ease-out cubic curve, and `tabular-nums` counting to `500+`, `52`, and `25`.
  3. **Conference Banner & Vacancies**: Exact 16:9 `mahi_conference_banner.jpg` banner placed right below Careers header, followed by Open Roles table with black pill `[ View Job ]` buttons.
  4. **Quote Card Hierarchy**: Re-ordered so James Hunter quote card (`#131517`, 4:3 photo, Spectral serif quote, uppercase `SOFTWARE ENGINEER`) sits below the Open Roles table.
  5. **CTA Card Clean-up**: Completely removed redundant bottom CTA section.
  6. **Build & Verification**: Verified production build `31/31` static routes generated cleanly and captured Playwright visual evidence for all sections.

## 2026-11-19 - Pricing Page 1:1 Lateral Framer Template Redesign
- **Context**: User instructed to redesign the Pricing page (`/pricing`) by picking the layout, styling, and design 1:1 from the Lateral template (`https://lateral.framer.media/pricing`) while populating it with MAHI Browser pricing tiers, stealth capabilities, and 0% Indian UPI payment rails.
- **Implementation**:
  1. **Hero Section (`#050505`)**: Recreated Lateral's dark obsidian hero with 62px Spectral serif headline (*Simple Pricing Built for Scale*), Monthly/Yearly toggle with 20% discount badge, and USD / INR switcher.
  2. **3 Luxury Pricing Cards**: Core ($4 / ₹299), Growth ($20 / ₹1,499 with Popular pill), and Pro ($65 / ₹4,999) with Spectral serif pricing digits, PER USER/MONTH uppercase subtitle, grouped features with checkmarks, and white pill action buttons.
  3. **Logo Ticker**: Monochrome white multi-account ecosystem platforms (Meta, Google Ads, TikTok, Amazon, eBay, YouTube, Reddit, LinkedIn).
  4. **Compare Plans Section (`#f9f9f9`)**: Clean light-theme matrix table with sticky plan headers and 4 feature categories (Engines & Isolation, Stealth & Fingerprinting, Automation & Workflows, Payments & Team Governance).
  5. **Testimonial Bento Card (`#e5e5e3`)**: 2-column card with warm natural photography on the left, executive quote on the right, and 3 ROI stats ($180K Savings, 99.8% Survival, 10x ROI).
  6. **FAQ Section**: 2-column layout with "Your Questions Answered" on the left and 5 interactive collapsible accordion items on the right.
  7. **Pre-Footer CTA & Footer**: Black CTA container and unified home footer (`Footer.tsx`).
  8. **Build & QA**: Verified Next.js production build (`29/29` static routes generated with 0 errors) and validated via Playwright screenshots.

## 2026-11-18 - Removed 4 Critical Flaws & FAQs from Customers Page
- **Context**: User uploaded screenshot circling "4 Critical Flaws in Legacy Anti-Detect Browsers" and "Frequently Asked Questions" in red, asking to remove both sections from the page.
- **Implementation**:
  1. Removed Section 5 (`4 Critical Flaws`) and Section 6 (`Frequently Asked Questions`) from `landing/components/CustomersCompareView.tsx`.
  2. Cleaned up unused `COMPARISON_FAQS` array and `FaqAccordion` import.
  3. Page now flows seamlessly from Section 4 (4-Way Technical Comparison Matrix) directly into Section 5 (Pre-Footer CTA Card) and Footer, matching user requirements.
  4. Verified Next.js build passes cleanly (`29/29` static routes) and captured fresh verification screenshots.

## 2026-11-18 - Customers Page 1:1 Lateral Functionality, Animation & Fleet Content
- **Context**: User provided detailed feedback on Customers page:
  1. The hero logo strip had placeholder template finance logos; replaced with real MAHI multi-account ecosystem platforms (Meta, Google Ads, TikTok, Amazon, eBay, YouTube, Reddit, LinkedIn) in a single horizontal row.
  2. The featured case study card in Lateral has a soft `#e5e5e3` grey background and an animated top horizontal progress line that auto-advances slides every 6 seconds, with warm natural full-color photography (not grayscale).
  3. The 3-column case studies below follow Lateral's exact clean column structure (`border-t border-[#d8d8d6]`, category tag, 16:10 natural color photo, `JUN 5, 2026` date, bold company name, and summary) without outer box cards, borders, or floating tags.
  4. Content is 100% focused on MAHI Browser multi-account operations, anti-detect stealth, and GoLogin migration ROI.
- **Implementation**:
  1. **Navbar**: Added `Customers` link alongside `vs GoLogin` with dynamic active page highlighting.
  2. **Hero Platform Logos**: Single-row clean horizontal flex with subtle monochrome opacity.
  3. **Featured Card**: Interactive auto-advancing progress line (6s duration, pause on hover), Spectral headline, 10x ROI and $180k savings stats, and full natural color imagery.
  4. **3-Column Grid**: Exact border-top clean layout with natural photography (`lattice_case.jpg`, `westbridge_exec.jpg`, `greythorne_case.jpg`) and MAHI fleet content.
  5. **Architecture**: Clean client component `CustomersCompareView.tsx` with dedicated Server Component pages exporting full SEO `metadata` on `/customers`, `/compare`, and `/compare/gologin-alternative`.
  6. **Build & QA**: Verified `npm --prefix landing run build` generates 29/29 routes with 0 errors, and captured full verification screenshots.

## 2026-11-18 - Customers Page Full Lateral Light Theme Parity
- **Context**: User clarified that the Customers reference page (`https://lateral.framer.media/customers`) uses a crisp **WHITE / LIGHT** (`#f9f9f9`) background, not fully black. All sizes, font weights, and spacing must match the Lateral template 1:1, while populated with MAHI Browser content.
- **Implementation**:
  1. **Background & Theme**: Switched main background to `#f9f9f9` with dark `#080808` typography.
  2. **Navbar Dynamic Theme**: Updated `Navbar.tsx` to detect Customers/Compare routes and render with `#f9f9f9` light theme, dark branding, and black pill CTA button.
  3. **Exact Dimensions & Typography**:
     - Headline: `62px` Spectral serif font (`font-light leading-[1.08]`) with italic muted accent on "Everywhere".
     - Left Guide Line: `1px solid #e6e3e3` with `32px` padding-left.
     - Pill Button: `Request Demo` with `#080808` background and `14px` font size.
  4. **Logos Sequence**: Vector SVGs arranged in exact reference sequence: Gantry, 53 CAPITAL, NORTHRIDGE, Greythorne, Westbridge, Lattice.
  5. **Cards & Matrix**: Westbridge featured case study, 3-card bento grid, 4-way comparison matrix, and FAQs all styled with crisp white cards (`bg-white border-[#e6e3e3]`).
  6. **Unified Footer**: Seamless transition to the unified black footer at the bottom.

## 2026-11-18 - Customers / vs GoLogin Full Lateral Template + 4-Way Matrix Redesign
- **Context**: The user instructed to work on the Customers page (`vs GoLogin`), expand the content substantially to match the Lateral Customers template (`https://lateral.framer.media/customers`), integrate the 4-way comparison matrix (`MAHI Browser v1.1.9` vs `GoLogin Orbita` vs `AdsPower` vs `Multilogin`), and strictly match the Lateral luxury monochrome aesthetic.
- **Implementation**:
  1. **Theme Alignment**: Styled with deep obsidian `#050505` / `#080808`, 1px subtle borders `border-white/10`, Spectral serif typography, and clean monochrome pills.
  2. **Hero & Client Logos**: Built matching Lateral hero (`Trusted by Growth Fleets Everywhere`) with 6 authentic vector client partner logos.
  3. **Westbridge Featured Case Study**: 2-column luxury layout with 3 key metrics (`10x ROI`, `$180k Saved`, `99.8% Fleet Survival`), executive quote, and photo.
  4. **3-Col Case Studies Grid**: OmniScale Brands (E-Commerce), Nexus Data Labs (Data Extraction), and 53 Capital Portfolio (Multi-Team Fleet).
  5. **4-Way Benchmark Matrix (`#matrix`)**: Fully integrated all 11 technical capabilities across engine versions, hooks, air-gapped sqlite, concurrency locks, and pricing rails. Highlighted MAHI with glass styling and red `BEST` badge.
  6. **Routing Parity**: Linked cleanly across `/customers`, `/compare`, and `/compare/gologin-alternative`.
  7. **Footer Parity**: Unified `Footer.tsx` renders identical 2-row layout without watermarks or copyright lines.

## 2026-11-18 - Footer Strict Homepage 1:1 Match (All Extra Elements Removed)
- **Problem**: User circled 3 items in red on the screenshot that did not belong to the Homepage footer:
  1. Giant watermark `Lateral` in the background.
  2. Copyright text `Mahi Browser Inc. © Copyright 2026` at the bottom left.
  3. Floating template badges `Get This Template` and `Made in Framer` in the bottom right corner.
- **Solution**: Removed all 3 items, verified 1:1 match with homepage.

## 2026-11-19 - Full Lateral Luxury Aesthetic Polish Across Auth, Download & Book-Demo
- **Context**: User noted that `/login` and `/signup` were still using the old red gaming theme (`#1e293b` blue-gray, bright red buttons, red dragon SVG) and asked to bring them to the premium Lateral theme.
- **Implementation**:
  1. **Login & Signup Redesign**:
     - Upgraded `/login` and `/signup` with deep obsidian `#030303` background, atmospheric team hero texture overlay (`opacity-15`), and radial ambient glow.
     - Centered `#131517` luxury floating cards with hairline border (`border-white/10`), top highlight gradient line, and backdrop blur.
     - Replaced red dragon logo with the minimalist monochrome square brand emblem matching Navbar.
     - Added monospace eyebrows (`■ AUTHENTICATION`, `■ GET STARTED FREE`) and Spectral serif headlines.
     - Replaced red buttons with clean white pill primary buttons (`rounded-full bg-white text-black hover:bg-zinc-200`).
     - Maintained full API logic (`/api/v1/auth/login`, `/api/v1/auth/register`, local storage, and Google Workspace OAuth).
  2. **Book Demo & Download Redesign**:
     - Upgraded `/book-demo` and `/download` with the same luxury `#030303` / `#131517` bento structure, white pill action buttons, and monospace eyebrows.
     - Updated founder branding from "Munna Bhai" to **Mahipal Choudhary** (`BRAND.creator`, legal name, placeholders, and contact details).
  3. **Build & Visual Verification**:
     - Next.js production build (`npm run build`) succeeded with 38/38 static routes generated with 0 errors.
     - Playwright screenshots captured and verified: `verified_auth_login.png`, `verified_auth_signup.png`, `verified_auth_download.png`, and `verified_auth_bookdemo.png`.

## 2026-11-19 - Home Page Full Engine Wiring (Dual-Engine, Hero Actions, Telemetry & Parity)
- **Context**: User provided reference screenshot of original MAHI Browser (`media_1795036454272_306aace7.jpg`) emphasizing that the Home Page must reflect the real dual-engine architecture, 4 core engine metrics, dual hero CTA buttons, and funnel wiring.
- **Implementation**:
  1. **Hero Dual CTA Buttons**: Integrated primary white pill `Download Free (15 Profiles)` and secondary translucent hairline pill `Compare vs GoLogin →`.
  2. **Top Eyebrow Pill**: Updated and styled to `MAHI Browser v2.0 Released • Chromium 138 + Camoufox Dual-Engine →` with horizontal auto-width, linking to `/blog`.
  3. **Core Engine Metrics Section**: Patched Framer SSR & hydration chunks to display MAHI Browser's real technical metrics (CreepJS Bypass, Dual Engine Chromium 138 + Camoufox, Rebrowser-Patches CDP Isolation 0 Leaks).
  4. **Navbar & Footer Parity**: Verified live routes (`/features`, `/fingerprints`, `/pricing`, `/compare`, `/blog`, `/login`, `/download`).
  5. **Auto-Download & Funnel Telemetry**: Wired `/download?auto=true` in `DownloadButtons.tsx` and funnel analytics call `POST /api/v1/funnel/track`.
  6. **Verification**: Playwright click tests validated all 4 interactive flows, and `next build` confirmed 38/38 static routes compile with 0 errors.

## 2026-11-19 - Features Page (`/features`) Full Engine Wiring
- **Context**: User confirmed moving to the Features page (`/features`), requesting full wiring and alignment of buttons, metrics, and architecture without affecting any core backend files.
- **Implementation**:
  1. **Zero Core Backend Impact**: Work strictly isolated to `landing/app/features/page.tsx` and `landing/components/Navbar.tsx`. Directories `01_UI` through `14_ENGINE_PATCHES` remain 100% untouched.
  2. **Section 1 Hero Dual CTAs**: Added `Download Free (15 Profiles)` white pill button with telemetry tracking and direct installer trigger (`/download?auto=true`), alongside `Compare vs GoLogin →` translucent pill.
  3. **Section 2 Fleet Scale**: Wired 3 cards with real MAHI telemetry: 1,420 Active Profiles (SQLite Core), 100% Ban-Free (Camoufox C++), 99.9% Uptime (Zero CDP Leaks).
  4. **Section 3 Workflow Tabs**: Replaced generic copy with exact MAHI Browser engine features: Chromium 138 MV3 main-world injection, Camoufox C++ Gecko engine, and Universal RPA / proxy sync with Redis locks.
  5. **Section 4 Integrations**: Retained full double-row infinite marquee covering all target ad platforms, marketplaces, and developer automation stacks.
  6. **Section 5 Solutions & Section 6 Testimonial**: Polished 4 vertical solution cards and Jane Berwick case study ($180K Savings, 100% Ban-Free, 10x Fleet Scale).
  7. **Section 7 Security & Section 8 FAQ**: Updated 3 security cards with Rebrowser-patches CDP isolation, AES-256 local storage, and Redis concurrency locks; answered 5 core technical questions in accordion.
  8. **Section 9 Pre-Footer**: Integrated dual CTA buttons matching the luxury hero styling.
  9. **Navbar Active State**: Updated `Navbar.tsx` to link to `/features` with bold active state highlighting on both desktop and mobile.
  10. **Verification**: Automated test (`scratch/verify_features_wiring.py`) verified status 200, hero buttons, scale cards, workflow tabs, FAQ interaction, and download redirect. Full production build passed with 38/38 static routes.

## 2026-11-19 - Fingerprints Page (`/fingerprints`) Dedicated Route & Full Hardware Lab Wiring
- **Context**: User selected Fingerprints as the next page in the page-by-page wiring process.
- **Implementation**:
  1. **Zero Core Backend Impact**: Work strictly restricted to `landing/app/fingerprints/page.tsx`, `landing/app/fingerprint/page.tsx`, and `landing/components/Navbar.tsx`. Core directories `01_` through `14_` remain untouched.
  2. **Dedicated Route**: Built `/fingerprints` with an alias `/fingerprint` to support all inbound link variations.
  3. **Section 1 Hero**: Styled in Lateral monochrome luxury with 42px Spectral serif headline ("Mathematical Precision. Zero Pixel Drift."), subtitle, and dual action buttons (`Download Free` + `Compare vs GoLogin →`).
  4. **Section 2 Live Interactive Lab**: Upgraded `FingerprintPreview` logic to luxury styling with real-time OS preset switching (Windows / Chrome 138, macOS / Camoufox, Linux / Vulkan), live "Scramble Noise" button, and 6 inspection tiles (Canvas, WebGL GPU, AudioContext, Client Hints, Hardware Cores/RAM, CreepJS 0.0%).
  5. **Section 3 Attack Vectors (4x2 Grid)**: Documented protection across Canvas, WebGL, AudioContext, Client Hints, WebRTC IP, Fonts/DPR, Memory/Cores, and CDP Rebrowser-patches.
  6. **Section 4 Third-Party Verification Scorecard**: Added live matrix for CreepJS, Pixelscan, IPHEY, and BrowserLeaks.
  7. **Section 5 Technical Deep Dive**: Comparative breakdown of C++ kernel spoofing versus standard JavaScript prototype overrides.
  8. **Section 6 FAQ & Section 7 Pre-Footer**: Collapsible accordion answering 4 deep technical questions; pre-footer CTA card with dual action buttons.
  9. **Navbar Active State**: Updated `Navbar.tsx` so `Fingerprints` links to `/fingerprints` with active page highlighting.
  10. **Verification**: Playwright test (`scratch/verify_fingerprints_wiring.py`) verified 200 status, hero buttons, live preset switching (macOS Apple M3 Pro, Linux AMD Vulkan), scramble noise recalculation, and download redirect. Full production build succeeded with 40/40 static routes.

## 2026-11-19 - Clean Separation of Customers (`/customers`) & vs GoLogin (`/compare`) Pages
- **Context**: User caught that `/customers` and `/compare` (vs GoLogin) had been conflated into an identical component, and instructed to cleanly separate them:
  1. Customers page must be pure fleet case studies without any Technical Benchmark matrix.
  2. vs GoLogin page must be a dedicated comparison page with the Head-to-Head Benchmark matrix, but without the extra 3 clutter sections ("4 Critical Flaws", "Migrate in 3 Steps", and "Migration FAQ").
- **Implementation**:
  1. Built pure `CustomersView.tsx` containing exclusively: Hero ("Trusted by Growth Fleets Everywhere"), Platform Logos Ticker, Featured Case Study Slider (6s progress bar, ROI metrics), 3-Column Fleet Stories Grid, and Pre-Footer CTA.
  2. Built pure `CompareView.tsx` containing exclusively: Head-to-Head Hero ("The Modern, Undetectable GoLogin Alternative"), Platform Logos Ticker, 4-Way Technical Capability Benchmark Table (`GoLoginComparisonTable.tsx`), and Pre-Footer CTA.
  3. Removed the 3 extra sections from `/compare`: "4 Critical Flaws in Legacy Anti-Detect Browsers", "Migrate from GoLogin in 3 Simple Steps", and "GoLogin Migration FAQ".
  4. Updated routes `landing/app/customers/page.tsx` -> `CustomersView` and `landing/app/compare/page.tsx` & `landing/app/compare/gologin-alternative/page.tsx` -> `CompareView`.
  5. Deleted deprecated combined component `CustomersCompareView.tsx`.
  6. Automated verification via Playwright (`scratch/verify_separation.py`) confirmed clean separation and 0 unwanted elements on either page. Full production build passed with 40/40 static routes.
