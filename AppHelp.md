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

---

## screen:settings

**What this screen is for:** App settings — including configuring the AI assistant (Ask AI) used in the Help screen and throughout the app.

### AI Assistant (Ask AI) Setup

The **Ask AI** button on every Help screen lets you ask questions about the app in plain language. To use it, you need to connect an AI provider in Settings.

**How to configure:**
1. Open **Settings** from the main screen (gear icon or nav bar)
2. Scroll to the **AI / LLM** section
3. Choose a provider: **OpenAI** or **Grok (xAI)**
4. Paste your API key
5. Optionally set a specific model (or leave blank to use the default)
6. Tap **Save**

**Supported providers:**
- **OpenAI** — uses `gpt-4o` by default. Get a key at [platform.openai.com](https://platform.openai.com)
- **Grok (xAI)** — uses `grok-3` by default. Get a key at [console.x.ai](https://console.x.ai)

**Your API key is stored securely** in your personal Firestore data — it is never shared or sent anywhere except directly to the provider you choose.

**Tips:**
- Once configured, Ask AI works across Help screens AND the SecondBrain / QuickLog AI features.
- If you see an error like "LLM not configured", come back to Settings and verify your key is saved correctly.
- You can switch providers or update your key at any time.


---

## screen:house

### Quick Help
- The House home page -- shows all your floors, open problems, quick tasks, and upcoming calendar events
- Tap any floor card to drill in and see its rooms
- **Open Problems** and **All Quick Tasks** cards roll up issues and to-dos from every floor, room, thing, and sub-thing across the whole house
- Access Garage, Vehicles, and Collections from the **More** section at the bottom

### Details

**What the House section tracks:** The interior of your home, organized as a 4-level hierarchy: Floor -> Room -> Thing -> Sub-Thing -> Item. Each level can have photos, facts, problems, quick tasks, activities, and calendar events.

**Stats bar at the top:** Shows a count of upcoming calendar events as a clickable chip -- tapping it opens the House Calendar Events page, which shows events linked to any house entity.

**Open Problems card:** Shows the count of all open problems across the entire house. Clicking it navigates to the House Problems page -- a full rolled-up list of every open problem from every floor, room, thing, and sub-thing, each labeled with its location path (e.g., "1st Floor > Kitchen > Dishwasher").

**All Quick Tasks card:** Shows all active quick tasks across the house in one list, each labeled with its source entity.

**Floors section:** Each floor appears as a clickable card. Tap to open the floor detail page.
- **Add a floor:** Tap **+ Add Floor** and enter the floor name and optional floor number
- **Edit or delete a floor:** Use the pencil icon on the floor card

**More section:** Contains:
- **Checklists** -- count of active checklist runs for house/floor/room entities; navigates to the checklists page
- **Garage** -- navigates to the Garage section
- **Vehicles** -- navigates to the Vehicles section
- **Collections** -- navigates to the Collections section

**Upcoming calendar events rollup:** Shows the next few scheduled events linked to any house entity, so you can see what is coming up without drilling into individual rooms.

**Breaker Panels section:** If you have breaker/electrical panels recorded, they appear here.

**Tips:**
- Use the Open Problems card as your daily "what needs attention" view -- it aggregates everything without drilling into each room.
- Garage, Vehicles, and Collections are accessed through the More section, not the main nav.
- The hierarchy is Floor > Room > Thing > Sub-Thing > Item. You do not have to use all levels -- a simple house might just be Floors and Rooms.

### See Also
- [Floor Detail](#help/floor)
- [House Problems](#help/house-problems)
- [House Quick Tasks](#help/house-projects)

---

## screen:floor

### Quick Help
- Detail page for one floor -- shows its rooms and all tracking data in collapsible accordions
- Tap any room card to drill into that room
- **View Floor Plan** opens the interactive SVG floor plan for this floor
- Problems and Quick Tasks roll up from all rooms, things, and sub-things below -- each item labeled "from: [source]"

### Details

**What a floor is:** The top level of the house hierarchy. A floor contains rooms. Everything in those rooms (problems, tasks, activities) rolls up to the floor level for easy review.

**Accordion sections:** Each tracking section is collapsible. Tap the header to expand or collapse. Rooms and Calendar Events start expanded; all others start collapsed. Each header shows an item count badge (e.g. "Photos (3)") that loads after the section opens.

**Rooms accordion:** Lists all rooms on this floor as cards. Tap any room card to open its detail page.
- **Add a room:** Tap **+ Add Room** and enter the name. You can link it to a shape on the floor plan later.
- **Edit or delete a room:** Use the pencil icon on the room card.
- **Stairs rooms:** A special room type that connects two floors. Appears with a hatch pattern on the floor plan.

**Floor Plan button:** Shows "View Floor Plan" if a plan exists, or "Add Floor Plan" if not. Opens the interactive SVG drawing tool where you can draw rooms, add doors, windows, fixtures, electrical plates, and plumbing.

**Problems accordion:** Shows all open problems for THIS floor plus rolled-up problems from all rooms, things, and sub-things beneath it. Each rolled-up item is labeled "from: [source name]". Resolving a problem auto-creates an activity.

**Quick Tasks accordion:** Same rollup pattern -- tasks from this floor plus all children.

**Facts accordion:** Key-value pairs for this floor (e.g., "Square Footage = 1,200 sq ft", "Ceiling Height = 9 ft").

**Activities accordion:** Activities logged directly at the floor level only (not rolled up from rooms).

**Photos accordion:** Reference photos for this floor.

**Calendar Events accordion:** Scheduled events linked to this floor.

**Tips:**
- The floor plan is the most powerful feature of this level -- drawing rooms links them to their Firestore records, enables dimension calculation, and makes room navigation visual.
- You can log activities at the floor level for things that apply to the whole floor (e.g., "Replaced HVAC filter").
- Problems and Quick Tasks aggregate from children; Activities do not.

### See Also
- [House Home](#help/house)
- [Room Detail](#help/room)
- [Floor Plan](#help/floorplan)

---

## screen:room

### Quick Help
- Detail page for one room -- shows its things (furniture, appliances, fixtures) and all tracking data
- Tap any thing card to open its detail page
- Problems and Quick Tasks roll up from all things and sub-things in this room
- **Floor Plan** button shows this room on the floor plan with its calculated dimensions

### Details

**What a room is:** A named space on a floor. Rooms contain things (appliances, furniture, fixtures). Each room can have photos, facts, problems, tasks, activities, and calendar events.

**Accordion sections:** All sections start collapsed. Each header shows an item count badge.

**Things accordion:** Lists all things in this room.
- **Add a thing manually:** Tap **+ Add Thing** -- enter name, category, optional description and estimated value.
- **Add a thing via AI photo:** Tap **+ Photo** -- photograph a piece of furniture, appliance, or fixture. The AI identifies it, fills in name, description, and estimated value automatically, and saves it with the photo attached and thumbnail set.
- **Categories:** Furniture, Appliance, Ceiling Fan, Ceiling Light, Electronics, Other. Color-coded badge shown on each thing card.
- **Thumbnail:** The first photo added to a thing auto-sets its profile thumbnail, visible on the room thing list.

**Floor Plan section:** If this room is drawn on the floor plan, a "View in Floor Plan" button appears. Room dimensions (e.g., "12 x 14 ft, 168 sq ft") are calculated from the polygon shape.

**Problems accordion:** Rolled-up problems from this room AND all things and sub-things inside it.

**Quick Tasks accordion:** Same rollup -- tasks from this room and all things/sub-things.

**Facts accordion:** Key-value notes for the room (e.g., "Paint Color = SW Alabaster", "Flooring = Engineered Hardwood", "Square Footage = 168 sq ft").

**Activities accordion:** Activities logged directly at the room level.

**Photos accordion:** Reference photos of the room (before/after renovations, overview shots).

**Calendar Events accordion:** Scheduled events linked to this room.

**Tips:**
- Use the AI photo identification to add things quickly -- photograph a couch, TV, or refrigerator and it fills in the details.
- Facts are great for paint colors, flooring types, and dimensions -- any reference info you would want to look up later.
- The first photo added to a thing auto-sets its thumbnail. To change it, open the thing, go to Photos, and use the "Use as Profile" button on the desired photo.

### See Also
- [Floor Detail](#help/floor)
- [Thing Detail](#help/thing)
- [Floor Plan](#help/floorplan)

---

## screen:thing

### Quick Help
- Detail page for a single item in a room (appliance, furniture, fixture, electronics, etc.)
- Things can have sub-things (drawers in a dresser, shelves in a bookcase, compartments in a cabinet)
- All sections are collapsible accordions -- expand only what you need
- AI photo ID available from the room page -- photograph a new item and it creates the record automatically

### Details

**What a thing is:** A significant item in a room -- a refrigerator, couch, ceiling fan, TV, dresser, etc. Things have a category, optional description, estimated value, and full tracking (photos, facts, problems, tasks, activities, calendar events).

**Categories:**
- **Furniture** -- sofas, beds, chairs, tables, dressers, bookshelves
- **Appliance** -- refrigerator, washer/dryer, dishwasher, oven, HVAC units
- **Ceiling Fan** -- ceiling fans (may also appear on the floor plan)
- **Ceiling Light** -- light fixtures (may also appear on the floor plan)
- **Electronics** -- TVs, computers, speakers, gaming systems
- **Other** -- anything that does not fit the above

**Thumbnail:** Profile photo shown on the room thing list card. Auto-set from the first photo you add. To change it, go to Photos and tap "Use as Profile" on any photo.

**Value field:** Estimated dollar value. Optional -- useful for insurance documentation or home inventory.

**Sub-Things accordion:** Things can contain sub-things -- drawers in a dresser, shelves in a bookcase, compartments in a cabinet.
- **Add a sub-thing:** Tap **+ Add Sub-Thing**
- **AI photo:** Same identification flow as things -- photograph the sub-thing and it auto-fills the record

**Problems accordion:** Problems for this thing only (sub-things are beneath this level and their problems roll up here).

**Quick Tasks accordion:** Tasks for this thing, plus rolled-up tasks from sub-things.

**Facts accordion:** Key-value notes. Most useful facts for things:
- Model number and serial number
- Purchase date and purchase price
- Warranty expiration and warranty contact
- Service contact (plumber, electrician, repair shop, phone number)
- Manufacturer website or product URL
- Installation date

**Activities accordion:** Maintenance history (e.g., "Cleaned refrigerator coils", "Replaced HVAC filter", "Serviced by technician -- notes in facts").

**Photos accordion:** Photos of this thing. First photo auto-sets profile thumbnail.

**Calendar Events accordion:** Scheduled maintenance (e.g., "Replace water filter -- every 6 months", "Annual HVAC service -- every October").

**Tips:**
- Facts are the most practical section for things -- serial numbers, model numbers, purchase dates, and warranty info. If you ever need to call for service or file a warranty claim, it is all in one place.
- Use Activities to log maintenance with dates. You will always know when a filter was last changed, when an appliance was last serviced, and who did the work.
- Sub-things are optional. A simple refrigerator does not need sub-things. A multi-drawer dresser where you track what is in each drawer benefits from them.
- The AI photo identification from the room page can identify most common appliances and furniture. If the AI cannot identify the item, it alerts you and does not save the record -- you can then add it manually.

### See Also
- [Room Detail](#help/room)
- [Sub-Thing Detail](#help/subthing)

---

## screen:subthing

### Quick Help
- Detail page for a sub-thing -- a compartment, drawer, shelf, or section inside a Thing
- Sub-things can contain individual Items (the deepest tracking level in the house hierarchy)
- Use tags to group or categorize sub-things (e.g., "seasonal", "office supplies", "tools")

### Details

**What a sub-thing is:** A subdivision of a thing. Examples: a drawer in a dresser, a shelf in a bookcase, a compartment in a cabinet, a section of a storage unit. Sub-things let you track what is inside large storage items with more precision.

**Tags:** Optional free-form labels for grouping. Multiple tags can be applied to one sub-thing. Tags help you remember the purpose of a sub-thing at a glance and mentally group related sub-things across different rooms (e.g., all sub-things tagged "seasonal" across multiple closets).

**Thumbnail:** Same pattern as things -- first photo auto-sets the thumbnail; "Use as Profile" to override.

**Value field:** Optional estimated value of the contents.

**Items accordion:** The deepest level -- individual named items stored in this sub-thing.
- **Add an item:** Tap **+ Add Item**
- **AI photo:** Same identification flow -- photograph the item and it fills in name, description, and estimated value
- Examples: "Christmas ornaments", "Cordless drill", "Winter scarves", "Spare HDMI cables"

**Problems, Facts, Quick Tasks, Activities, Photos, Calendar Events:** Same collapsible accordion pattern as all other house entities.

**Tips:**
- Items inside a sub-thing are the finest tracking granularity in the house section. Use this for inventories: tools in a drawer, clothes in a storage bin, collectibles in a box.
- Tags on sub-things let you find related sub-things across rooms. Tag all seasonal storage "seasonal" so you can mentally group them at the start of each season.
- If you are tracking just a few things in a storage area, Facts on the sub-thing may be enough (e.g., "Contains = winter blankets, extra pillows"). Only use Items if you need individual per-item tracking.

### See Also
- [Thing Detail](#help/thing)
- [House Home](#help/house)

---

## screen:house-problems

### Quick Help
- Rolled-up view of every open problem across the entire house in one list
- Each problem shows its full location path (Floor > Room > Thing) so you know exactly where it came from
- Tap any problem card to view or edit it on its source entity

### Details

**What this screen shows:** All open problems from every level of the house hierarchy -- floors, rooms, things, and sub-things -- in a single flat list. No drilling required to find what needs attention.

**Location path label:** Each problem card shows its full location path (e.g., "1st Floor > Kitchen > Dishwasher"). Tap the card to navigate to that entity's detail page where you can edit, add notes, or resolve the problem.

**Resolved problems:** Hidden by default. Use the "Show Resolved" toggle to see them alongside open ones.

**How to add a new problem:** Navigate to the specific floor, room, thing, or sub-thing and use its Problems accordion > **+ Add Problem**. Problems cannot be added directly from this rollup list.

**Resolving a problem:** Open the problem on its entity page and tap **Resolve**. This closes the problem and auto-creates an activity: "Resolved: [description]" -- so the history always shows when the issue was fixed.

**Tips:**
- Check this page periodically as a maintenance dashboard. One scroll shows everything that needs attention across the whole house.
- When resolving a problem, add notes before resolving (e.g., "Called plumber 555-1234, fixed April 2026") -- the auto-created activity carries those notes into the history.
- Problems at different levels can overlap -- a leaking pipe might generate a problem on the sink (thing), the bathroom (room), and the 1st floor -- each tracked separately because the impact may be described differently at each level.

### See Also
- [House Home](#help/house)
- [Floor Detail](#help/floor)
- [Room Detail](#help/room)

---

## screen:house-projects

### Quick Help
- Rolled-up view of every quick task across the entire house in one list
- Each task shows its source (floor, room, or thing name)
- Check off checklist items directly from this view without opening the entity

### Details

**What this screen shows:** All active quick tasks from every level of the house hierarchy -- floors, rooms, things, sub-things -- in a single flat list. Each task card shows the task title and its source entity name.

**Checking off items:** Tap any checklist sub-item to mark it complete. Tap **Complete** on the task card to close the whole task and record a completion date.

**Completed tasks:** Hidden by default. Use the "Show Completed" toggle to see them.

**How to add a new task:** Navigate to the specific floor, room, thing, or sub-thing and use its Quick Tasks accordion > **+ Add Task**. Tasks cannot be added directly from this rollup list.

**Tips:**
- Treat this as your house punch list. Before a weekend of home maintenance, check here to see everything outstanding across all areas at once.
- Tasks with checklists show all sub-items here. You can check them off as you go without navigating into each entity.

### See Also
- [House Home](#help/house)
- [Floor Detail](#help/floor)
- [Room Detail](#help/room)

---

## screen:floorplan

### Quick Help
- Interactive SVG floor plan editor for a single floor -- draw room shapes, add doors, windows, fixtures, electrical, and plumbing
- Opens in **View mode** by default (read-only, all items clickable); tap **Edit** to make changes
- Three modes: **Layout** (rooms/doors/windows/fixtures), **Electrical** (wall plates/ceiling lights/recessed lights), **Plumbing** (pipes/fixtures/stub-outs)
- Tap any item then **Details** to jump to that item's full tracking page (facts, problems, maintenance history)

### Details

**View mode vs. Edit mode:**
- **View mode** (default when a plan exists): all items are clickable and selectable. Dragging is disabled. The tool bar is hidden. Tap any item to see its info in the Properties bar at the bottom. "View Room" or "View Marker" opens a read-only info panel. "Details" navigates to that item's full tracking page.
- **Edit mode** (tap **Edit** in the header): full editing -- drag items, draw rooms, add new items, configure them. The **Save** button appears in the header.
- If no plan exists yet, the page opens directly in Edit mode so you can start drawing.

**Three-row toolbar (Edit mode):**

*Row 1 -- Mode bar:*
- **Layout** -- rooms, doors, windows, layout fixtures (toilet/sink/tub). Default.
- **Electrical** -- wall plates, ceiling fixtures, recessed lights
- **Plumbing** -- plumbing fixtures, spigots, stub-outs
Switching modes clears any selection and resets to Select tool.

*Row 2 -- Tool bar (changes by mode):*
- Layout: Select, Room (draw), Type (set dimensions), Door, Window, Fixtures flyout (Toilet / Sink / Tub/Shower)
- Electrical: Select, Plate (wall plate), Ceiling (ceiling fixture), Recessed (recessed light), Dim toggle
- Plumbing: Select, Spigot, Stub-out, Dim toggle

*Row 3 -- Properties bar (appears when an item is selected):*
- Edit mode (non-room items): **Edit Marker**, **Remove**, **Details**
- View mode (non-room items): **View Marker** (read-only), **Details**
- Rooms: **Edit Room** / **View Room** (no Remove, no Details)
- Fixtures: **Rotate** button cycles orientation 0/90/180/270 degrees

**Drawing rooms:**
- Select Room tool. Click corner points to trace the perimeter (rectilinear -- all 90 degree angles; L/T/U shapes supported). Close the shape by clicking the first point.
- A dialog links the shape to an existing room record or creates a new room.
- Snap-to-grid in 0.25 ft (3-inch) increments. Grid tiers: 5ft dark, 1ft medium, 0.5ft light, 0.25ft very faint.

**Room dimensions:** Automatically calculated from the polygon. Shown in the room detail page and floor plan view. The Type tool lets you enter dimensions manually.

**Door subtypes:**
- **Single** -- swing arc with hinge dot and jamb ticks. Swing direction (inward/outward, left/right) configurable.
- **French** -- two panels with center post. Inward or outward only.
- **Sliding** -- two offset panels side by side. No swing.
- **Pocket** -- door slides into the wall cavity. Dashed inset rectangle.

**Ceiling fixtures (Electrical mode):**
- Types: Fan, Fan+Light, Pendant (drop-light), Chandelier, Flush-mount, Solar, Generic
- Click anywhere inside a room to place. Draggable. Configured in Edit Marker.

**Recessed lights (Electrical mode):**
- Small circles placed anywhere inside a room. Draggable.
- Support Facts, Problems, and Activities via their detail page.

**Wall plates (Electrical mode):**
- 1 to 4 slots per plate. Each slot is a switch or outlet.
- Switch subtypes: single-pole, 3-way, dimmer, smart
- Outlet subtypes: standard, GFCI, 220V, USB
- Slots can be linked to ceiling fixtures and recessed lights they control (same room).
- **External switch slots:** A switch can be marked "External" to document it controls items in another room. External targets are picked from a floor/room/item picker and shown as chips on the slot. Slot symbol shows an asterisk when external (e.g., D becomes D*).
- Plate width scales automatically with slot count.

**Layout fixtures -- Toilet, Sink, Tub/Shower (Layout mode Fixtures flyout):**
- Click anywhere inside a room to place. No modal for initial placement.
- Rotate button cycles 0/90/180/270 degrees for wall orientation.
- Edit Marker sets name, orientation, and notes.
- Tub/Shower configurable as tub only, shower only, or combo.

**Plumbing (Plumbing mode):**
- **Spigot** -- outdoor water connection, blue circle with nozzle
- **Stub-out** -- pipe end; cold (blue C), hot (red H), or both (purple C/H)
- **Sprinkler head** -- for outdoor or yard floor plans

**Stairs rooms:** A special room type with a hatch pattern. Label indicates which floor it connects to.

**Coords bar:** Always visible above the canvas. Shows cursor position in feet and, during drawing, the current wall segment length.

**Saving:** Tap **Save** in the header. The plan saves automatically when you confirm the Dimensions dialog.

**Dim toggle:** In Electrical and Plumbing modes. Makes room shapes semi-transparent so items placed inside are easier to see and click.

**Tips:**
- Build in order: draw rooms first, then doors and windows, then switch to Electrical for plates and ceiling fixtures, then Plumbing.
- In View mode, the floor plan is a navigation tool -- tap any room shape to jump to that room without knowing its name or scrolling a list.
- Use "Details" on any item (wall plate, door, recessed light) to open its full tracking page and log facts, problems, or maintenance.
- Document wall plates fully: slot types, breaker numbers as facts, and external targets. This becomes your permanent wiring reference.
- External switch targets answer "what does this switch do?" for every plate in the house, even years later.

### See Also
- [Floor Detail](#help/floor)
- [Room Detail](#help/room)
- [Floor Plan Item](#help/floorplanitem)

---

## screen:floorplanitem

### Quick Help
- Detail page for a specific item on the floor plan -- door, window, ceiling fixture, wall plate, recessed light, or plumbing item
- Supports the full tracking suite: Facts, Problems, Quick Tasks, Activities, Photos, Calendar Events
- Reached by tapping **Details** in the floor plan Properties bar when an item is selected

### Details

**What this screen is for:** Every item placed on a floor plan can be tracked independently. This is where you document issues, maintenance history, wiring facts, and notes for individual floor plan items -- beyond what the floor plan editor itself captures.

**Item types that have detail pages:**
- **Doors** -- track problems (sticking, broken hinge, damaged weatherstripping), log maintenance (painted, hardware replaced, adjusted strike plate)
- **Windows** -- track problems (broken seal causing fogging, failing weatherstripping, damaged sill), log maintenance (re-caulked, cleaned tracks, replaced screen)
- **Ceiling fixtures** -- log bulb replacements with type and date, track problems (flickering, buzzing, broken globe)
- **Recessed lights** -- same as ceiling fixtures; log bulb type/wattage and replacement history
- **Wall plates** -- document wiring details beyond the slot editor, track outlet/switch problems, log replacements
- **Plumbing fixtures** (toilet, sink, tub/shower) -- maintenance history (caulked, replaced flapper, re-grouted), problems (leaking, running, clogged)
- **Plumbing endpoints** (spigot, stub-out) -- notes on pipe age, problems, seasonal shutoff dates

**Tracking sections (all collapsible accordions):**

**Facts** -- the most important section for floor plan items. Examples:
- Door: "Hinge Brand = Schlage", "Painted = SW Extra White", "Replaced = 2021"
- Window: "Type = Double-hung", "Manufacturer = Andersen", "Installed = 2018", "Screen replaced = 2023"
- Ceiling fixture: "Bulb Type = LED A19 60W equivalent", "Installed = January 2023", "Brand = Halo"
- Recessed light: "Bulb = Philips 65W equivalent BR30", "IC-rated = Yes", "Trim = White baffle"
- Wall plate: "Breaker = Panel A / Circuit 7", "Wire Gauge = 12 AWG", "Controls = Overhead light + garbage disposal"
- Toilet: "Brand = Kohler Wellworth", "Model = K-3987", "Installed = 2015", "Flapper replaced = 2024"
- Spigot: "Shutoff location = Basement utility room, left valve", "Winterized = Yes"

**Problems** -- open/resolved issues with description, date logged, status, and notes

**Quick Tasks** -- to-do items (e.g., "Replace weatherstripping before winter", "Fix squeaky hinge", "Replace bathroom exhaust fan")

**Activities** -- maintenance log with date and notes:
- "Replaced bulb -- LED 60W Philips BR30"
- "Re-caulked around tub -- used GE Silicone II"
- "Adjusted door strike plate -- door was not latching"
- "Replaced toilet flapper -- Korky 4010"

**Photos** -- reference photos of repairs, wiring behind a plate before closing a wall, manufacturer labels, serial number stickers, before/after renovations

**Calendar Events** -- recurring maintenance reminders:
- "Check window weatherstripping -- every October"
- "Replace ceiling bulbs -- annually"
- "Winterize outdoor spigots -- every November"
- "Check toilet for running -- every 6 months"

**Tips:**
- Wall plates benefit most from Facts. Document the breaker, wire gauge, and what each slot controls. This creates a permanent wiring reference that survives renovations and forgotten memories.
- For ceiling fixtures and recessed lights, log bulb replacements as Activities with the exact bulb model in the notes. Over time you build a replacement history and never guess what bulb a fixture takes.
- Use Photos to capture the wiring behind a plate before closing a wall, the label on a fixture housing, or the serial number on an appliance before the sticker fades.
- Calendar Events on windows and doors are great for seasonal maintenance -- check weatherstripping every fall, re-caulk windows every few years, winterize spigots each November.
- For toilets and sinks, log the brand and model in Facts. When a part fails, you can order the exact replacement without having to pull the toilet or look up the model.

### See Also
- [Floor Plan](#help/floorplan)
- [Room Detail](#help/room)
