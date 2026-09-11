# Product truth — internal, not website copy

Audited app commit `125bddf` (Oliverknowledge/plumi) at `/root/plumi-product`. Website sources updated to `fdb8c2b`. LIVE below means a concrete, wired implementation in the pre-release app, not a public App Store release or an independently tested iPad build. Launch date confirmed by Oliver: 25 September 2026. Swift/iOS runtime cannot be executed in this Linux container.

| Capability | State | Source evidence | Website treatment |
|---|---|---|---|
| Notebook, handwriting, tools, pages, autosave, undo | LIVE in code + real captures | Features/Notebook/NotebookView.swift:369–518, NotebookToolbar.swift, Platform/InkCanvas.swift, Store/WorkspaceRepository.swift | Real screenshots; unmetered note-taking |
| Folders, PDF annotation/export/search | LIVE in code | Core/Entitlements.swift:4–6, Documents/PDFImporter.swift, Features/Library/LibraryView.swift, Store/PageSearchIndexer.swift | Free notebook, folders and tools; no unsupported platform promise |
| AI Pen: circle, read, hint, check | LIVE | Features/AIPen/AIPenController.swift:101–148,200–216,249–352; NotebookView.swift:418–453 | No claim of perfect handwriting recognition; screenshot uses Tutor not a fabricated chat |
| Tutor writes on page, hints and ticks | LIVE in code + screenshots | Tutor/TutorSession.swift:496–633,647–720,780–891; Features/Tutor/TutorOnPage.swift:955–1006; NotebookView.swift:714–817 | Hero uses genuine 0684/0686/0687/0688/0689 sequence |
| Help on pause, context-aware next problem | LIVE | TutorSession.swift:294,929–1016; real 0689 shows 'Now try this one' | Actual capture, not generated response |
| Marking -> persistent learner evidence | LIVE | Learner/LearnerModel.swift:420–531,541–650; PageMarkingController.swift; NotebookView.swift:892–965 | Notes alone indicate exposure, not mastery; no instant 'mastered' from a single answer |
| Understanding vs exam performance | LIVE | LearnerModel.swift:139–267,534–650 | Mechanism explained with an explicitly illustrative worked example, no invented learner metrics |
| Targeted practice + custom topic sessions | LIVE | Learner/PracticeBrief.swift:184–243; Features/Practice/PracticeView.swift:474–552,603–681; LivePracticeSession.swift; SessionBuilder.swift | Same mechanics misconception becomes next example question; actual populated Practice screenshot unavailable |
| Home next recommendation | LIVE in code + screenshots | Features/Home/HomeModel.swift:185–252, HomeView.swift | Real 0708/0709 crop (old Aster branding disclosed if visible); real next-move card, no altered values |
| Progress / mastery / evidence provenance | LIVE | LearnerModel.swift:1187–1254; Features/Progress/ProgressView.swift, MasteryMap.swift | Explain remembers work, not fake dashboard; no dedicated capture provided |
| Diagram generation & validation | LIVE in pipeline | Diagram/DiagramAI.swift:128–183, DiagramSpec.swift, DiagramEngine.swift; PracticeView.swift:539–542; Features/Notebook/PrintedPaper.swift:168 | Authored SVG mechanics diagram is labeled illustrative animation, not screen recording nor claim that exact assembly choreography exists in app |
| Focus study timer | LIVE in code + 0709 | Focus/FocusSession.swift:181–219; Features/Focus/FocusView.swift | Optional genuine timer strip/capture; no blocked apps |
| Cross-app Focus blocking | PARTIAL / unavailable in current signing setup | FocusShield.swift:31–105 conditional APIs, project.yml:151–172 lacks FamilyControls entitlement | Omit app-blocking demonstration and availability claim |
| Exam mode blocks other apps | NOT VERIFIED | Exam/ExamSurfaceGuard.swift:93–110 disables Plumi AI, not other apps | Explicitly omit blocking claim; can show timed, unaided exam entry |
| Past papers | LIVE, scope-limited | Exam/PaperLinks.swift; PhysicsCatalogue.swift; NotebookView.swift:892–965; ExamSurfaceGuard.swift | Link/import workflows, not 'every exam board paper included', no examiner-equivalence |
| Shared / collaborative workspaces | FUTURE architecture only | Collaboration/Collaboration.swift:3–8; LoopbackTransport:199–237 | Omit shared notebooks / pen buddies |
| Free / Pro | LIVE entitlement logic | Core/Entitlements.swift:4–6,39–52,251–265 | Note-taking free; AI has free daily allowances and paid expansion. No invented prices or unlimited free AI |
| Subjects / courses | LIVE but uneven depth | Resources/specs.json has12 A-Level metadata specs, in_v0_scope AQA Chemistry7405 and Edexcel Maths9MA0; topic files for these plus PhysicsCatalogue OCRH556; StudyProfile/SpecTaxonomy | Audience GCSE/A-Level, never claim complete GCSE/full all-subject coverage. No board logos/endorsements |

## Exclude from Daniel PDF
- All apps blocked automatically in exam mode; entitlement-dependent Focus blocking
- Shared workspaces / pen buddies
- Never imply full syllabus coverage from metadata alone
- Green/yellow/red whole-page marking shown only as a proposed visual treatment, not add fabricated overlays to real screenshots
- Competitor pricing in PDF is not Plumi pricing
- Email collection in Discord onboarding is outside website scope; outbound real invite only
- Mascot swinging / teasing omitted for calmness and no demonstrated app interaction

## Media truth
Hero is a paced sequence of real supplied development screenshots, not live AI or a screen recording. Mechanics/learning-loop animation is an expressly requested, labeled illustrative example. It has no fake app navigation, controls, learner scores or API. No product UI may be reconstructed from old website mockups.
