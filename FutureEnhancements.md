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
