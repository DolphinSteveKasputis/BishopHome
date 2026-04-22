# MyLife App — Help Guide

This document describes every screen and feature in the MyLife app.
It is used by the in-app AI assistant to answer your questions.

---

## screen:main

**What this screen is for:** The main landing page. From here you reach every section of the app.

**Sections available:**
- **Yard** — Track plants, zones, weeds, chemicals, and yard activities
- **House** — Track floors, rooms, things (appliances/fixtures), floor plans, and electrical panels
- **Life** — Journal, contacts, notes, life projects (vacation planner), life calendar
- **Thoughts** — Top 10 lists, memories, saved views
- **Vehicles** — Track vehicles and their maintenance
- **Garage** — Track garage rooms and stored items
- **Structures** — Outdoor structures (sheds, pergolas, fences, etc.)
- **Collections** — Track collectibles, sets, or any grouped items
- **Health** — Vitals, medications, visits, conditions, blood work, insurance, and more

**Buttons on this screen:**
- **⚡ QuickLog** — AI assistant. Type or speak a command like "I watered the front yard azaleas" and it logs the activity for you. Also supports adding notes, tasks, and journal entries.
- **📍 Check In** — GPS-based location check-in. Records where you are right now.

---

## screen:zones

### Quick Help
- The Yard home page — shows all your top-level yard zones (Front Yard, Back Yard, etc.)
- Tap any zone card to drill in and see its plants and sub-zones (up to 3 levels deep)
- Add zones with **+ Add Zone**; edit or delete with the pencil icon on a card
- **Shortcut:** Use **⚡ QuickLog** on the main screen to log activities without navigating here — just say "I sprayed the front yard"

### Details

**What is a zone?** A zone is a named area of your yard, organized in up to 3 levels:
- Level 1: Major zone (e.g., Front Yard, Back Yard, Creek, Woods)
- Level 2: Sub-zone (e.g., By Mailbox, Behind Garage)
- Level 3: Detail zone (e.g., Left Flower Bed)

**Common tasks:**
- **Add a zone:** Tap **+ Add Zone** and enter the name
- **Open a zone:** Tap any zone card to drill into it and see its plants and sub-zones
- **Edit or delete a zone:** Tap the pencil icon on a zone card
- **Navigate back:** Use the breadcrumb bar at the top to jump to any ancestor level

**Tips:**
- You cannot delete a zone that has sub-zones or plants still inside it. Move or remove those first.
- Plants can be assigned to any zone level — you don't need to go three levels deep if two is enough.

### See Also
- [Zone Detail](#help/zone)
- [Plant Detail](#help/plant)
- [Calendar Events](#help/calendar)

---

## screen:zone

### Quick Help
- Detail page for one zone — shows its plants, sub-zones, and all tracking data in collapsible accordions
- Tap any section header (Photos, Facts, Problems, Tasks, Activities) to expand or collapse it
- **Add here** for zone-wide events (sprayed the whole yard); **drill into a sub-zone or plant** for targeted tracking
- Problems and Quick Tasks show data **rolled up from all sub-zones and plants below** — each item labeled "from: [source]"
- **Shortcut:** Tap **⚡ QuickLog** on the main screen instead of navigating here — say "I watered the back yard"

### Details

**Accordion sections:** Each tracking section is collapsible — tap the header to expand or collapse. They start collapsed to keep the page clean. Expand only what you need.

**Where to add things — zone level vs. going deeper:**
- **Log at zone level** when something applies to the whole zone — e.g., you sprayed the entire front yard, or you want a photo of the zone overview.
- **Navigate into a sub-zone or plant** when you want to track something specific — e.g., one particular azalea is struggling, or you only watered the left flower bed.
- Either approach is valid. Log at whatever level matches how you think about your yard.

**Rollup from children:** The Problems and Quick Tasks sections aggregate data from THIS zone AND everything beneath it — all sub-zones and all plants inside them. Each rolled-up item is labeled "from: [source name]" so you always know where it came from. This lets you see all open issues across an entire zone hierarchy at a glance, without drilling into each child.

**Note:** The Activities section shows only activities logged directly at this zone level. It does not pull in activities from sub-zones or plants. For a cross-zone view of all activity, use the Activity Report (History in the nav bar).

**Common tasks:**
- **Add a plant:** Tap **+ Add Plant** to create a new plant record in this zone
- **View a plant:** Tap any plant card to open its detail page
- **View All Plants:** Shows every plant in this zone AND all sub-zones below it in a flat list — tap any to go straight to its detail page
- **Log a zone-wide activity:** Tap **Log Activity** and fill in what was done, when, chemicals used, and notes
- **Add a sub-zone:** Tap **+ Add Sub-Zone** to nest another level (max 3 levels deep)

**What each accordion holds:**
- **Photos** — Reference photos of this zone (before/after, seasonal shots, overview)
- **Facts** — Key-value notes (e.g., "Square Footage = 200 sq ft", "Soil Type = Clay", "Irrigation = Drip")
- **Problems** — Open issues for this zone plus all rolled-up problems from sub-zones and plants beneath it
- **Quick Tasks** — To-do items and checklists for this zone plus rolled-up tasks from all children
- **Calendar Events** — Scheduled events linked to this zone
- **Activities** — Only activities logged directly at this zone level

**Tips:**
- The breadcrumb bar (e.g., Front Yard > By Mailbox) shows your position in the hierarchy. Tap any crumb to jump back.
- Resolving a problem auto-creates an activity: "Resolved: [description]" — keeps the history clean.
- You can also reach this zone from a plant's Edit screen — the zone picker links back up the hierarchy.

### See Also
- [Zones — Yard Home](#help/zones)
- [Plant Detail](#help/plant)
- [Yard Problems](#help/yard-problems)
- [Yard Quick Tasks](#help/yard-projects)

---

## screen:plant

### Quick Help
- Detail page for one specific plant — health status, care metadata, and full history
- Set health status (🟢 Healthy / 🟡 Struggling / 🔵 Dormant / 🔴 Dead) from the dropdown — saves instantly, no button needed
- Tap **Log Activity** to record what you did; all sections (Photos, Facts, Problems, Tasks, Activities) are collapsible accordions
- **Shortcut:** Tap **⚡ QuickLog** on the main screen and say "I pruned the big azalea" — no navigation needed

### Details

**Key concept — plants are individual instances:** Each physical plant is its own separate record. Three azalea bushes = three plant records, each with its own photos, activities, and history. This lets you track which specific plant is struggling, when each one was last treated, and so on.

**Accordion sections:** Each tracking section is collapsible — tap the header to expand or collapse. Sections start collapsed. Expand only what you need.

**Health status:** The colored dropdown at the top of the page. Tap and pick a status — it saves the moment you select, no Save button.
- 🟢 Healthy — thriving normally
- 🟡 Struggling — needs attention
- 🔵 Dormant — seasonally inactive (not dead)
- 🔴 Dead — no longer alive

The health indicator also appears on the plant card in the zone view, so you can spot struggling plants at a glance without opening each one.

**Metadata tab:** Tap **Edit** to record care preferences:
- Heat/cold tolerance, watering needs, sun/shade preference
- Bloom months, dormancy months
- Free-form notes about this plant

**Common tasks:**
- **Log an activity:** Tap **Log Activity** — record watering, fertilizing, pruning, spraying, etc. Optionally pick chemicals used and add notes. Pick a Saved Action to pre-fill the form.
- **Add a photo:** Expand the Photos section → **+ Add Photo** (camera, gallery, or clipboard paste)
- **Move to a different zone:** Tap **Edit** → change the zone picker — the plant and all its history moves with it
- **Clone this plant:** Tap **Clone** — copies the name, zone, and metadata to a new record. Photos and activities are NOT copied.
- **AI Plant ID:** On the zone page (not this page), tap **+ Photo** to photograph an unknown plant and have the AI identify it and create the record automatically.

**What each accordion holds:**
- **Photos** — Plant photos; the first one uploaded auto-becomes the card thumbnail visible on the zone page
- **Facts** — Key-value notes (e.g., "Planted = April 2022", "Source = Home Depot", "Bloom Color = Pink")
- **Problems** — Issues for this plant only (pest damage, disease, etc.) with open/resolved tracking. Resolving auto-creates an activity.
- **Quick Tasks** — To-do items just for this plant with optional checklists
- **Calendar Events** — Scheduled care events tied to this specific plant
- **Activities** — Full chronological history of everything logged for this plant, newest first

**Tips:**
- Plants are leaf nodes — Problems and Tasks here show only this plant's own data. There is no rollup from children (plants have no children).
- The Activities section on the plant only shows what was logged directly to this plant. Zone-level activities are separate.
- Use **Clone** when you're adding a new plant of the same type — it saves re-entering all the metadata.

### See Also
- [Zone Detail](#help/zone)
- [Saved Actions](#help/actions)
- [Activity Report](#help/activityreport)

---

## screen:weeds

**What this screen is for:** Tracks weed types found in your yard. Each entry represents a type of weed — not an individual plant.

**Key concept — weeds by type:** You track "Wild Onions" as one entry covering all the wild onions in your yard — not each individual plant. The entry records how to treat it, when to treat it, and which zones it appears in.

**Common tasks:**
- **Add a weed type:** Tap **+ Add Weed** and fill in the name, treatment method, and timing
- **Open a weed:** Tap any weed card to see its detail page with photos and activity history
- **AI Weed ID:** Tap **+ Photo** to photograph an unknown weed. The AI identifies it, suggests treatment, and pre-fills the form. If it matches an existing weed in your collection, it will alert you instead of creating a duplicate.

**Tips:**
- The "Application Timing" field feeds into the calendar view — use it to set seasonal reminders (e.g., "Pre-spring", "Fall", "As needed").
- You can link a weed to multiple zones to track which parts of the yard are affected.

### See Also
- [Weed Detail](#help/weed)
- [Chemicals & Products](#help/chemicals)
- [Calendar Events](#help/calendar)

---

## screen:weed

**What this screen is for:** Detail view for a single weed type — treatment info, affected zones, photos, and activity history.

**Fields:**
- **Treatment Method** — How you treat it (pulling, specific herbicide name, etc.)
- **Application Timing** — When to apply (Pre-spring, Spring, Fall, As-needed, etc.)
- **Zones** — Which zones have this weed (multi-select checkboxes)
- **Notes** — Free-form notes about this weed

**Common tasks:**
- **Log a treatment:** Tap **Log Activity** to record when and how you treated this weed
- **Update zones:** Tap **Edit** and check/uncheck zones as the weed spreads or is eliminated
- **Add photos:** Attach reference photos for identification

### See Also
- [Weeds](#help/weeds)
- [Chemicals & Products](#help/chemicals)

---

## screen:chemicals

**What this screen is for:** Your list of chemicals and products used in the yard (herbicides, fertilizers, pesticides, fungicides, etc.).

**Why this list exists:** When logging an activity, you can select which products were used. The chemicals list is where you manage that catalog.

**Common tasks:**
- **Add a chemical:** Tap **+ Add Chemical** and enter the name and any notes
- **Scan a barcode:** Tap **Scan Barcode** on a chemical — scans the bottle's barcode and looks up product info automatically
- **AI label scan:** Open a chemical → tap **Scan Label** (in edit mode) → photograph the bottle label. The AI extracts mixing ratios, application methods, active ingredients, and safety info and saves them as facts.
- **View usage history:** Open a chemical to see every activity that used it, across all plants, zones, and weeds

### See Also
- [Chemical Detail](#help/chemical)
- [Saved Actions](#help/actions)
- [Activity Report](#help/activityreport)

---

## screen:chemical

**What this screen is for:** Detail view for a single chemical/product — its facts (label info) and full usage history.

**Common tasks:**
- **Edit name or notes:** Tap **Edit**
- **Add a fact manually:** Scroll to Facts → **+ Add Fact** (e.g., "Active Ingredient = Triclopyr")
- **Scan the label:** In edit mode, tap **Scan Label** → photograph the bottle — AI extracts facts automatically
- **View where this was used:** The Usage History section shows every activity that included this product

**Tips:**
- Facts extracted by AI scan include: active ingredients, mixing ratio, reentry interval, application method, safety info.
- The barcode URL is saved as a fact for reference.

### See Also
- [Chemicals & Products](#help/chemicals)
- [Saved Actions](#help/actions)

---

## screen:actions

**What this screen is for:** Saved Actions are reusable activity templates. Instead of retyping the same activity details every time, you save it once and pick it from a list.

**Example:** You spray for weeds in the front yard every spring with the same herbicide. Create a Saved Action called "Front Yard Weed Spray" with the description, chemical, and notes pre-filled. Next time you log the activity, just pick that action.

**Common tasks:**
- **Create a saved action:** Tap **+ Add Action** and fill in the name, description, chemicals, and notes
- **Edit or delete:** Tap the pencil icon on any saved action card
- **Use a saved action:** When logging a new activity on any screen, tap the **Saved Action** dropdown and pick one — it pre-fills the form

**Tips:**
- You can also create a saved action directly from an activity you just logged: open the activity → tap **Save as Action**.
- Saved actions can include multiple chemicals (useful for combination treatments).

### See Also
- [Chemicals & Products](#help/chemicals)
- [Plant Detail](#help/plant)
- [Zone Detail](#help/zone)

---

## screen:calendar

**What this screen is for:** Scheduled events for the yard — one-time tasks and recurring maintenance reminders.

**Event types:**
- **One-time** — A specific date (e.g., "Fertilize roses — May 15")
- **Recurring** — Repeats weekly, monthly, or every X days (e.g., "Check irrigation — every 7 days")

**Common tasks:**
- **Add an event:** Tap **+ Add Event** — set title, description, date, and whether it recurs
- **Complete an event:** Tap **✓ Complete** on any event card — this automatically creates an activity record for any linked zones
- **Edit an event:** Tap **Edit** on the card
- **Copy an event:** Tap **Copy** — creates a new one-time event pre-filled with the same title and description (date is cleared for you to set a new one)
- **Delete a recurring event:** You'll be asked whether to delete just this occurrence or all future occurrences

**Display range:** Use the dropdown at the top to show 1, 3 (default), 6, or 12 months ahead.

**Overdue section:** Events with past-due uncompleted occurrences appear in an "Overdue" section at the top. You can complete them (logs the activity) or reschedule to a new date.

**Linking events to zones:** When adding an event, you can link it to one or more zones. Completing that event creates an activity for each linked zone.

**Tips:**
- Recurring events use the original date as the anchor — completions and cancellations are tracked per-occurrence without changing the series.
- Delete "this occurrence only" adds the date to a cancelled list — the series continues.

### See Also
- [Zone Detail](#help/zone)
- [Activity Report](#help/activityreport)
- [Saved Actions](#help/actions)

---

## screen:activityreport

**What this screen is for:** A chronological history of all logged activities across the entire yard — plants, zones, and weeds.

**Common tasks:**
- **Browse history:** Scroll through all activities, newest first
- **Filter by date range:** Use the From/To date pickers to narrow the view
- **Filter by type:** Filter to see only Plant activities, Zone activities, or Weed activities

**Each entry shows:**
- Date of the activity
- What was done (description)
- What it was done to (plant name, zone name, or weed name)
- Chemicals used (if any)
- Notes

### See Also
- [Zone Detail](#help/zone)
- [Plant Detail](#help/plant)
- [Saved Actions](#help/actions)

---

## screen:gpsmap

**What this screen is for:** Shows a map view for a zone based on its GPS coordinates.

**Usage:** If a zone has GPS coordinates saved, this page displays that location on an interactive map. Useful for referencing the physical location of a zone.

---

## screen:yardmap

**What this screen is for:** An interactive map of your entire yard where you can mark zone boundaries and locations.

**Usage:** Draw or mark areas on the map to correspond to your yard zones. Helpful for visualizing the layout of your yard.

---

## screen:yard-problems

**What this screen is for:** A rolled-up view of all open problems across every zone and plant in the yard.

**Common tasks:**
- **View all open issues:** See every open problem in one list, labeled with where it came from (e.g., "from: Front Yard Azalea")
- **Open a problem:** Tap any problem to view or edit it
- **Navigate to source:** Each problem shows which zone or plant it belongs to

**Tips:**
- To add a new problem, go to the specific zone or plant and use its Problems section.
- Resolving a problem on a plant or zone auto-creates an activity: "Resolved: {description}".

### See Also
- [Zone Detail](#help/zone)
- [Plant Detail](#help/plant)

---

## screen:yard-projects

**What this screen is for:** A rolled-up view of all quick tasks across every zone and plant in the yard.

**Common tasks:**
- **View all tasks:** See every task in one list, labeled with its source (zone or plant name)
- **Check off items:** Tap checklist items to mark them complete
- **Complete a task:** Tap **Complete** on a task card

**Tips:**
- To add a new task, go to the specific zone or plant and use its Quick Tasks section.
- Completed tasks are hidden by default. Show them with the "Show Completed" toggle.

### See Also
- [Zone Detail](#help/zone)
- [Plant Detail](#help/plant)

---

## concept:activities

**What activities are:** An activity is a logged event — a record of something you did and when. Examples: watered the roses, sprayed for weeds, pruned the hydrangeas, fertilized the lawn.

**Where to log activities:** On any zone, plant, or weed detail page, tap **Log Activity**.

**Activity fields:**
- **Description** — What was done (required)
- **Date** — When it was done (defaults to today)
- **Notes** — Free-form notes about the activity
- **Chemicals** — One or more products used (selected from your Chemicals list)
- **Amount Used** — Appears when chemicals are selected; record how much you used

**Saved Actions:** Pick a saved action from the dropdown to pre-fill the description, chemicals, and notes. Saves you time for activities you repeat often.

**Viewing history:** Activities appear newest-first in the Activities section of each zone, plant, or weed. The Activity Report shows all activities across the entire yard.

---

## concept:photos

**What photos are:** Photos can be attached to plants, zones, weeds, chemicals, rooms, vehicles, and more.

**How to add a photo:**
1. Go to the Photos section on any entity's detail page
2. Tap **+ Add Photo**
3. Choose: Camera (take a new photo), Gallery (pick from device), or Paste (from clipboard)
4. Crop the photo if desired, then save

**Viewing photos:**
- Navigate with **Newer** / **Older** buttons
- Tap a photo to view it full-screen
- In full-screen: pinch to zoom, drag to pan when zoomed, long-press (hold for 600ms) to download
- Edit a caption by tapping the caption area
- Delete with the trash icon

**Tips:**
- The first photo you add to a plant, weed, person, or vehicle automatically becomes the profile thumbnail.
- Photos are compressed automatically (targets ~150KB each) to keep storage manageable.
- Up to 4 photos can be submitted at once for AI identification flows (plant ID, weed ID, bottle scan).

---

## concept:facts

**What facts are:** Facts are label/value pairs attached to any entity. Use them to store structured notes that don't fit elsewhere.

**Examples:**
- Label: "Bloom Season" / Value: "April–June"
- Label: "Sun Preference" / Value: "Full Sun"
- Label: "Square Footage" / Value: "200 sq ft"
- Label: "Planted" / Value: "Spring 2021"
- Label: "Mixing Ratio" / Value: "2 oz per gallon"
- Label: "Product URL" / Value: "https://example.com/product"

**How to add facts:** Scroll to the Facts section on any detail page → tap **+ Add Fact** → enter label and value.

**Tips:**
- Facts are sorted alphabetically by label.
- Values that start with `http://` or `https://` become clickable links that open in a new tab.
- Facts on chemicals are often extracted automatically by the AI bottle scan feature.

---

## concept:problems

**What problems are:** Problems (also called concerns) track open issues on plants, zones, rooms, vehicles, or any entity. Examples: pest damage, disease, drainage issues, broken irrigation, structural damage.

**How to add a problem:** Go to the Problems section on any detail page → tap **+ Add Problem** → enter a description and optional notes.

**Status lifecycle:**
- **Open** — Active issue being tracked
- **Resolved** — Closed. When you resolve a problem on a plant or zone, an activity is automatically created: "Resolved: {description}"

**Viewing problems:**
- Open problems are always visible
- Resolved problems are hidden by default — use the "Show Resolved" toggle to see them
- The Yard Problems page shows all open problems across all zones and plants in one list

---

## concept:quicktasks

**What quick tasks are:** Quick Tasks (also called Projects) are to-do items attached to a plant, zone, room, vehicle, or any entity. They can have a checklist of sub-items.

**Examples:**
- "Install drip irrigation" with items: buy tubing, lay lines, test
- "Replace dead azalea" with items: remove old plant, amend soil, plant new
- "Level the front yard" (no checklist needed)

**How to add a task:** Go to the Quick Tasks section on any detail page → tap **+ Add Task** → enter title and optional notes. Add checklist items by typing in the item field and pressing Enter or tapping Add.

**Using tasks:**
- Check off individual items — each records a completion timestamp
- Tap **Complete** to close the entire task (records a completion date)
- Tap **Reopen** to reactivate a completed task
- Add notes to individual checklist items with the Notes button

**Tips:**
- Active tasks appear first; completed tasks are hidden by default.
- The Yard Projects page shows all tasks across all zones and plants in one list.
- Sub-zone tasks appear on a parent zone's page with a "from: Sub-zone Name" label.
