# Future Enhancements

Items that are out of scope for current work but should be revisited later.

---

## Service Professional Tracking

Once "People → Contacts" is done and Service Professional is a contact
category, consider adding a dedicated tracking layer for service calls:

- Log service calls per professional (date, what was done, cost)
- Track license numbers, insurance, warranty info
- Record rate / typical cost
- Set reminders for recurring services (HVAC tuneup, pest control, etc.)
- Link service calls to house rooms, zones, or structures where work was done

Related to: Contacts (Service Professional category), House/Structures sections.

---

## Health: Ordered Items Tracking (Labs, Referrals, Imaging, etc.)

On the visit detail or Step 2 page, allow logging things the doctor ordered or recommended:

- Categories: Lab / Blood Work, X-Ray / Imaging, Referral, Follow-Up Visit, Other
- Each item has: type, description/name, ordered date (defaults to visit date), status (Pending / Scheduled / Completed / Cancelled), and optional notes
- Ordered items linked to the visit they originated from
- Blood work already has `orderedAtVisitId` — this would extend the same concept to all order types
- View ordered items on the visit detail page alongside meds

Related to: Health Visits, Blood Work.

---

## Health: Visit Action Items / To-Dos

When a doctor gives you something to do (e.g., "schedule a dermatologist appointment", "pick up a prescription"), capture it as an action item tied to that visit.

- Each action item has: title/description, source visit (linked), due date (optional), status (Open / Done / Dismissed)
- "Open" Health Main Page (`#health`) shows a **Health To-Dos** section listing all open action items across all visits/sources, newest first
- Tapping an item shows context (which visit it came from) and lets you mark it Done or Dismissed
- Action items could eventually expand beyond visits — e.g., items from a concern, a medication review, etc.
- Consider a Speak button for quick capture right from the visit screen

Related to: Health Visits, Health main page.

---

## Floor Plan: Plumbing Pipe Routing Lines

Draw actual pipe routes on the floor plan (supply and drain lines) connecting fixtures to each other and to the main supply/stack. Each line segment would have a type (cold supply, hot supply, drain/vent) and color-coded rendering (blue, red, gray). This is intentionally deferred because:
- Most plumbing is implied by the fixture placement
- The UX for routing lines is a significant separate project (similar to the wiring line UX for electrical)
- Current approach: show plumbing endpoints (spigots, stub-outs) as colored symbols only, no routing

Related to: Floor Plan — Plumbing mode.

---

## Floor Plan: Sprinkler System Layout

Draw irrigation pipe routes on the floor plan (or an outdoor/yard floor plan) connecting
sprinkler heads to zone valves and the main supply line. Each zone would have a color and
label. This is intentionally deferred because:
- Sprinkler heads are already trackable as plumbing endpoint items (subtype: sprinkler)
- Full pipe routing is a significant UX project
- A valve controller / zone scheduling feature would likely be needed alongside it

Related to: Floor Plan — Plumbing mode, Outside floor.

---

## Floor Plan: Orphaned Electrical Items Report

A utility view (or filter) that surfaces:
- Switches (wall plate slots) that have no targets linked (neither in-room nor external)
- Light fixtures (recessed lights, ceiling fixtures) that are not targeted by any switch

This helps identify wiring that was never documented, or items added to the floor plan
but never connected. Could be a simple list view accessible from the electrical toolbar
or the floor/house page.

Related to: Floor Plan — Electrical mode, Wall Plates, External Targets.

---

## Projects: Reusable Packing List Templates

Create reusable packing list templates that can be copied (not linked) into new projects. User builds a packing list once, saves it as a template, and when creating a new travel project can pick from their saved templates to pre-populate the packing list.

- Templates are standalone — copying into a project creates independent items
- User can have multiple templates (e.g., "Cruise Packing", "Road Trip Packing", "International")
- Editing a template does not affect previously copied lists
- Could also apply to To-Do lists (e.g., "Pre-Cruise Checklist" template)

Related to: Life Projects, Vacation template.

---

## Projects: Duplicate/Copy a Day

Allow copying an entire day (with all its items) to quickly create a similar day. Useful for cruises where port days have similar structures. Copy creates an independent duplicate — editing one doesn't affect the other.

Related to: Life Projects, Itinerary days.

---

## Projects: SecondBrain Integration

Integrate the Projects system with SecondBrain for voice/AI-powered queries like "What's my plan for Day 3?", "What excursions have I confirmed?", "How much have I spent on this trip?". Exact integration TBD after the Projects system is built and in use.

Related to: Life Projects, SecondBrain.

---

## Create Lists

General-purpose list creation feature. Details TBD.
