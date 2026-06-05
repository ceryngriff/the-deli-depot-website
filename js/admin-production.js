// =========================================================
// ADMIN PRODUCTION — staff kitchen production tool.
//
// Three production lines (Baking Day, Meal Prep, Overnight Oats),
// each with four views:
//   • Checklist  — tickable ordered tasks (persisted in localStorage)
//   • Shopping   — filterable, tickable ingredient list
//   • Schedule   — colour-coded parallel timeline
//   • Method     — expandable recipe cards
//
// Mobile-first: staff use this on their phones in the kitchen.
//
// Behind the admin auth guard via admin-shared.js. All UI is wired
// with event delegation (this file is an ES module, so inline
// onclick handlers in the original standalone app won't resolve).
// =========================================================

import './admin-shared.js'; // requireAdmin guard + sidebar chrome

// ─── DATA ───────────────────────────────────────────────────────────────

const LISTS = {

  baking: {
    label: 'Baking Day',
    views: {
      checklist: {
        label: 'Checklist',
        type: 'checklist',
        days: [
          { id: 'night', label: 'Night before', tasks: [
            { id: 'n1', title: 'Get butter & eggs out', detail: 'Leave 250g butter and 4 eggs on the counter to reach room temp overnight.', tip: 'Cold butter won\'t cream properly. Cold eggs can curdle the mix.' },
            { id: 'n2', title: 'Print / prep recipes', detail: 'Have all four recipes ready. Weigh out and label ingredients into bowls for each bake if you have time — mise en place saves chaos on the day.' },
            { id: 'n3', title: 'Check tins & parchment', detail: 'Confirm you have: 2× 20cm round tins, brownie tin, skillet/pie tin, 2× baking trays, and a full roll of parchment.' },
          ] },
          { id: 'morning', label: 'Morning — setup', tasks: [
            { id: 'm1', title: 'Preheat oven to 180°C fan', detail: 'Gets up to temp while you prep the sponge. Don\'t skip — putting a cold cake in a cold oven ruins the rise.' },
            { id: 'm2', title: 'Grease and line all tins', detail: 'Both sponge tins, brownie tin, and skillet now. Gets it out of the way before your hands get buttery.' },
            { id: 'm3', title: 'Weigh all ingredients for sponge', detail: '225g butter, 225g caster sugar, 4 eggs, 225g self-raising flour, 1 tsp baking powder, splash of milk.' },
          ] },
          { id: 'sponge', label: 'Bake 1 — Sponge cake', tasks: [
            { id: 's1', title: 'Cream butter & sugar — 5 min', detail: 'Beat 225g softened butter with 225g caster sugar until pale and fluffy. Don\'t rush — this is what makes the cake light.', tip: 'Should turn almost white and nearly double in volume.' },
            { id: 's2', title: 'Add eggs one at a time', detail: 'Beat in 4 eggs one at a time. Add a tbsp of flour with the last egg to prevent curdling.' },
            { id: 's3', title: 'Fold in flour & baking powder', detail: 'Sift in 225g self-raising flour and 1 tsp baking powder. Fold gently — do not beat. Add a splash of milk to loosen to a dropping consistency.', tip: 'Overmixing develops gluten and makes the cake dense.' },
            { id: 's4', title: 'Divide between tins & bake — 25–30 min', detail: 'Split evenly between the two lined tins. Smooth tops. Into 180°C fan oven.', tip: 'Do not open the oven door in the first 20 min.' },
            { id: 's5', title: 'Cool sponge — 10 min in tin, then rack', detail: 'Leave in tins 10 min then turn out onto a wire rack. Must be completely cold before filling.', parallel: 'Use this cooling time to prep brownies.' },
          ] },
          { id: 'brownies', label: 'Bake 2 — Brownies (during sponge cool)', tasks: [
            { id: 'b1', title: 'Melt chocolate & butter', detail: 'Melt 200g dark chocolate with 175g butter in a heatproof bowl over simmering water. Stir until smooth. Remove from heat, cool 5 min.', tip: 'Don\'t let the bowl touch the water — gentle heat only.' },
            { id: 'b2', title: 'Whisk eggs & sugar', detail: 'Whisk 3 eggs with 325g light brown sugar until thick and pale — about 3 min.' },
            { id: 'b3', title: 'Combine & add flour', detail: 'Fold chocolate mixture into egg mixture. Sift in 100g plain flour and 2 tbsp cocoa powder. Fold until just combined — a few streaks is fine.', tip: 'Do not overmix. Streaks of flour are better than overworked batter.' },
            { id: 'b4', title: 'Pour & bake — 22–25 min at 180°C fan', detail: 'Pour into lined 20×30cm tin. Bake 22–25 min. Should have a slight wobble in the centre.', tip: 'Underbake rather than overbake — they firm as they cool. Scatter sea salt flakes immediately out of the oven.' },
            { id: 'b5', title: 'Cool brownies in tin completely', detail: 'Leave in tin until fully cold before cutting. Do not rush this — hot brownies are a gooey mess to cut.', parallel: 'Prep cookie pie dough while brownies cool.' },
          ] },
          { id: 'cookiepie', label: 'Bake 3 — Cookie pie', tasks: [
            { id: 'cp1', title: 'Reduce oven to 170°C fan', detail: 'Turn oven down now so it\'s ready for cookie pie and cookies.' },
            { id: 'cp2', title: 'Mix wet ingredients', detail: 'Melt 150g butter. Mix with 150g caster sugar and 100g light brown sugar. Beat in 2 eggs and 1 tsp vanilla extract.' },
            { id: 'cp3', title: 'Add dry & chocolate chips', detail: 'Stir in 280g plain flour and a pinch of salt until a thick dough forms. Fold in 150g chocolate chips.' },
            { id: 'cp4', title: 'Press into tin & bake — 30–35 min', detail: 'Press dough into greased skillet or 9-inch tin. Bake at 170°C fan 30–35 min — edges set, centre still looks soft.', tip: 'It will look underdone. That\'s correct — sets as it cools.' },
            { id: 'cp5', title: 'Cool cookie pie 20–30 min', detail: 'Leave in tin on a rack. Finish with sea salt flakes. Slice only once cooled.', parallel: 'Make cookie dough while pie cools.' },
          ] },
          { id: 'cookies', label: 'Bake 4 — Cookies', tasks: [
            { id: 'co1', title: 'Cream butter & sugars', detail: 'Beat 225g softened butter with 150g caster sugar and 150g light brown sugar until fluffy.' },
            { id: 'co2', title: 'Add eggs, vanilla & dry ingredients', detail: 'Beat in 2 eggs and 1 tsp vanilla. Sift in 350g plain flour, 1 tsp bicarb, pinch of salt. Mix until combined. Fold in 200g chocolate chips.' },
            { id: 'co3', title: 'Portion into balls — ~50g each', detail: 'Roll into balls. Chill on tray 30 min if time allows.', tip: 'Chilling gives a thicker, chewier cookie and stops spreading. Worth doing if the cookie pie is still cooling.' },
            { id: 'co4', title: 'Bake — 11–13 min at 170°C fan', detail: 'Bake in batches. Edges set, centres still soft. Leave on tray to firm up — do not transfer while hot.' },
          ] },
          { id: 'finish', label: 'Finish & store', tasks: [
            { id: 'f1', title: 'Fill & finish sponge', detail: 'Once completely cold: sandwich layers with jam and cream or buttercream. Dust top with icing sugar.' },
            { id: 'f2', title: 'Cut brownies', detail: 'Cut into portions. Store in an airtight tin — keep at room temp up to 3 days or freeze.' },
            { id: 'f3', title: 'Label & store everything', detail: 'Cookie pie: store in tin, wrap in cling film. Cookies: airtight container, room temp. Label with date made.', tip: 'Brownies and cookie pie freeze brilliantly — wrap individually in cling film then bag.' },
            { id: 'f4', title: 'Clean down', detail: 'Wash up, wipe surfaces, store leftover ingredients.' },
          ] },
        ],
      },
      shop: {
        label: 'Shopping list',
        type: 'shop',
        filters: [
          { id: 'all', label: 'All' }, { id: '0', label: 'Sponge' }, { id: '1', label: 'Brownies' }, { id: '2', label: 'Cookie pie' }, { id: '3', label: 'Cookies' },
        ],
        tagLabels: ['Sponge', 'Brownies', 'Cookie pie', 'Cookies'],
        sections: [
          { name: 'Fridge & dairy', items: [
            { name: 'Unsalted butter', qty: '500g', uses: [0, 1, 2, 3] },
            { name: 'Large eggs', qty: '8–10', uses: [0, 1, 2, 3] },
            { name: 'Whole milk', qty: '150ml', uses: [0] },
            { name: 'Double cream', qty: '150ml', uses: [2] },
            { name: 'Cream cheese (frosting)', qty: '200g', uses: [0] },
          ] },
          { name: 'Dry & store cupboard', items: [
            { name: 'Self-raising flour', qty: '500g', uses: [0] },
            { name: 'Plain flour', qty: '500g', uses: [1, 2, 3] },
            { name: 'Caster sugar', qty: '600g', uses: [0, 2, 3] },
            { name: 'Light brown sugar', qty: '300g', uses: [1, 3] },
            { name: 'Icing sugar', qty: '200g', uses: [0] },
            { name: 'Bicarbonate of soda', qty: '1 tsp', uses: [3] },
            { name: 'Baking powder', qty: '2 tsp', uses: [0] },
            { name: 'Vanilla extract', qty: '1 bottle', uses: [0, 2, 3] },
          ] },
          { name: 'Chocolate & cocoa', items: [
            { name: 'Dark chocolate (70%)', qty: '400g', uses: [1, 2] },
            { name: 'Cocoa powder', qty: '50g', uses: [1, 3] },
            { name: 'Chocolate chips', qty: '200g', uses: [2, 3] },
          ] },
          { name: 'Tins & equipment', items: [
            { name: '20cm round cake tin (×2)', qty: 'if needed', uses: [0] },
            { name: '20×30cm brownie tin', qty: 'if needed', uses: [1] },
            { name: '9-inch pie / skillet tin', qty: 'if needed', uses: [2] },
            { name: 'Baking trays (×2)', qty: 'if needed', uses: [3] },
            { name: 'Baking parchment', qty: '1 roll', uses: [0, 1, 2, 3] },
          ] },
          { name: 'Extras', items: [
            { name: 'Sea salt flakes', qty: 'small pot', uses: [1, 2, 3] },
            { name: 'Walnuts or pecans', qty: '100g (optional)', uses: [1] },
            { name: 'Food colouring', qty: 'optional', uses: [0] },
          ] },
        ],
      },
      method: {
        label: 'Method',
        type: 'method',
        meals: [
          { title: 'Sponge cake', sub: '180°C fan · 25–30 min · Victoria sponge', steps: [
            { n: '1', title: 'Prep', body: 'Preheat oven to 180°C fan. Grease and line two 20cm round tins. Bring butter and eggs to room temp.' },
            { n: '2', title: 'Cream butter & sugar', body: 'Beat 225g softened butter with 225g caster sugar until pale and fluffy — about 5 min.' },
            { n: '3', title: 'Add eggs', body: 'Add 4 eggs one at a time, beating well after each. Add a tbsp of flour with the last egg to prevent curdling.' },
            { n: '4', title: 'Fold in flour', body: 'Sift in 225g self-raising flour and 1 tsp baking powder. Fold gently. Add a splash of milk to loosen.', tip: 'Do not open oven in first 20 min.' },
            { n: '5', title: 'Bake & cool', body: 'Divide between tins. Bake 25–30 min until golden and skewer comes out clean. Cool in tins 10 min then turn out.' },
            { n: '6', title: 'Fill & finish', body: 'Once completely cold, sandwich with jam and cream. Dust with icing sugar.' },
          ] },
          { title: 'Brownies', sub: '180°C fan · 22–25 min · fudgy', steps: [
            { n: '1', title: 'Melt chocolate & butter', body: 'Melt 200g dark chocolate with 175g butter over simmering water. Cool slightly.' },
            { n: '2', title: 'Whisk eggs & sugar', body: 'Whisk 3 eggs with 325g light brown sugar until thick and pale.' },
            { n: '3', title: 'Combine', body: 'Fold chocolate into egg mix. Sift in 100g plain flour and 2 tbsp cocoa. Fold until just combined.', tip: 'Underbake — they firm as they cool.' },
            { n: '4', title: 'Bake & cool', body: 'Pour into lined tin. Bake 22–25 min with slight wobble in centre. Scatter sea salt immediately. Cool fully before cutting.' },
          ] },
          { title: 'Cookie pie', sub: '170°C fan · 30–35 min · skillet cookie', steps: [
            { n: '1', title: 'Mix wet', body: 'Melt 150g butter. Mix with sugars. Beat in 2 eggs and vanilla.' },
            { n: '2', title: 'Add dry', body: 'Stir in 280g plain flour, pinch salt. Fold in 150g chocolate chips.' },
            { n: '3', title: 'Bake', body: 'Press into skillet. Bake 30–35 min — edges set, centre soft.', tip: 'Sets as it cools — do not overbake.' },
          ] },
          { title: 'Cookies', sub: '170°C fan · 11–13 min per batch', steps: [
            { n: '1', title: 'Cream & combine', body: 'Beat 225g butter with sugars. Add 2 eggs and vanilla. Fold in flour, bicarb, salt, chocolate chips.' },
            { n: '2', title: 'Portion & chill', body: 'Roll into ~50g balls. Chill 30 min if time allows.', tip: 'Chilling gives a chewier, thicker cookie.' },
            { n: '3', title: 'Bake', body: 'Bake in batches 11–13 min. Edges set, centres soft. Cool on tray.' },
          ] },
        ],
      },
    },
  },

  mealprep: {
    label: 'Meal Prep',
    views: {
      checklist: {
        label: 'Checklist',
        type: 'checklist',
        days: [
          { id: 'mpnight', label: 'Night before', tasks: [
            { id: 'mp_n1', title: 'Marinade chicken breast (Powerhouse)', detail: 'Score 4kg chicken breasts lightly. Toss in piri piri marinade (400g total). Cover and refrigerate overnight.', tip: 'Overnight marinade = better penetration and char.' },
            { id: 'mp_n2', title: 'Marinade chicken thighs (Tikka)', detail: 'Mix tikka paste (500g) with natural yogurt (600g). Coat 4.6kg thighs thoroughly. Flatten each thigh to even thickness. Cover and refrigerate overnight.', tip: 'Overnight gives better char and more tender meat.' },
            { id: 'mp_n3', title: 'Check packaging stock', detail: 'Confirm you have 120 meal prep boxes, 20 sauce pots (for raita), 20 oat jars, and enough Natasha\'s Law labels for everything.' },
            { id: 'mp_n4', title: 'Defrost edamame (Salmon)', detail: 'Move 1.4kg frozen edamame to the fridge to defrost overnight.' },
          ] },
          { id: 'mpmorning', label: 'Morning — oven setup', tasks: [
            { id: 'mp_m1', title: 'Preheat oven to 200°C fan', detail: 'You\'ll be running the oven flat-out all morning. Get it up to temp before you do anything else.' },
            { id: 'mp_m2', title: 'Mise en place — weigh & prep all veg', detail: 'Prep everything before cooking starts:\n• Tenderstem: trim woody ends (1.8kg)\n• Red peppers: deseed, slice 1–1.5cm strips (1.4kg)\n• Sweet potato: peel and cube 2–3cm (4.2kg raw)\n• Courgette: slice 1cm half-moons (1.6kg)\n• Red onion: thin wedges, root intact (1kg)\n• Cherry tomatoes: halve (1.2kg)\n• Cauliflower: break into florets, blitz to rice (4kg)\n• Cucumber: julienne or dice (800g total — Salmon + Tikka)\n• Kale: remove stems, weigh 80g per portion (1.6kg)', tip: 'This takes 30–40 min. Do it all at once before any heat goes on.' },
            { id: 'mp_m3', title: 'Rinse all rice', detail: 'Rinse 1.5kg basmati (Powerhouse) and 1.5kg jasmine (Salmon) separately until water runs clear. Leave to drain.' },
          ] },
          { id: 'mpwave1', label: 'Oven wave 1 — roast everything at 200°C', tasks: [
            { id: 'mp_w1a', title: 'Roast chicken breast — 200°C fan, 20–22 min', detail: 'Lay flat on lined trays, spaced apart. Do not overlap. Into oven.', tip: 'Probe centre — 75°C minimum. Rest 5 min then slice diagonally at 1.5cm.' },
            { id: 'mp_w1b', title: 'Roast chicken thighs — 200°C fan, 25–28 min', detail: 'Lay flat on lined trays, not touching. Into same oven on separate shelf.', tip: '75°C internal. Charred edges are correct.', parallel: 'Runs alongside chicken breast — start thighs 5 min after breast.' },
            { id: 'mp_w1c', title: 'Roast tenderstem & peppers — 15–18 min', detail: 'Toss tenderstem and peppers in olive oil, salt, smoked paprika. Single layer. Into oven alongside chicken trays.', tip: 'Single layer only — crowding steams not roasts.' },
            { id: 'mp_w1d', title: 'Roast sweet potato — 30–35 min', detail: 'Toss in olive oil and salt. Single layer on lined trays. Into oven. Turn once at 20 min.', tip: 'Caramelised edges = done.' },
            { id: 'mp_w1e', title: 'Roast courgette, red onion & cherry tomatoes — 15–18 min', detail: 'Toss courgette and onion in olive oil, oregano, salt, pepper. Single layer. Into oven. Add halved cherry tomatoes at 10 min mark only.', tip: 'Tomatoes go in at 10 min — they cook faster.' },
          ] },
          { id: 'mpwave2', label: 'Hob work — while oven runs', tasks: [
            { id: 'mp_h1', title: 'Cook basmati rice (Powerhouse) — 12 min + 5 min rest', detail: '1.5kg rice in large pan, 1:2.5 cold water ratio (3.75L). Boil, stir once, lowest heat, lid on. 12 min. Remove from heat, lid on, rest 5 min. Fluff with fork.', tip: 'Never lift lid during cooking.' },
            { id: 'mp_h2', title: 'Cook jasmine rice (Salmon) — 10 min + 5 min rest', detail: '1.5kg jasmine rice, 1:2.5 ratio. Same method as basmati.', parallel: 'Start jasmine rice 2 min after basmati — they\'ll finish close together.' },
            { id: 'mp_h3', title: 'Sear beef chuck — high heat, batches of 6', detail: 'Pat beef completely dry. Season well. Smoking hot heavy pan. Lay in — do not move. 3 min each side. Brown all sides including edges. Batches of max 6.', tip: 'Crowding steams not sears. This takes patience — give each batch full time.' },
            { id: 'mp_h4', title: 'Braise beef — 160°C fan, 90 min', detail: 'Transfer seared beef to oven-safe pot. Add stock (4L total), tomato paste, garlic, thyme, rosemary. Liquid halfway up beef. Cover tightly. 160°C fan, 90 min.', tip: 'Test with two forks — should pull apart with almost no resistance.', warn: 'Reduce oven to 160°C for this. Return to 200°C when done.' },
            { id: 'mp_h5', title: 'Cook giant couscous (Halloumi) — 8 min', detail: 'Rolling boil, salted water. Boil 8 min. Drain — do not rinse. Immediately toss with olive oil and lemon juice in a large bowl. Spread to cool.', tip: 'Dress immediately — prevents clumping.' },
          ] },
          { id: 'mpwave3', label: 'Hob wave 2 — salmon & halloumi', tasks: [
            { id: 'mp_v1', title: 'Sear salmon — batches of 4–5, skin-side down 4 min', detail: 'Pat skin completely dry. Brush rapeseed oil onto fish not pan. Smoking hot pan. Skin-side down, press gently 10 sec. 4 min undisturbed. Flip, 2 min. Glaze (honey + soy) in last 30 sec only.', tip: 'Salmon releases when ready — if sticking, it needs more time.' },
            { id: 'mp_v2', title: 'Griddle halloumi — dry pan, 2 min each side', detail: 'Slice 1cm thick. Completely dry pan, very hot. Do not move once placed. 2 min — wait for natural release. Flip, 2 min. Box while still warm.', tip: 'Halloumi firms and turns rubbery when cold — box immediately.' },
            { id: 'mp_v3', title: 'Dry-fry cauliflower rice (Tikka) — 4–5 min', detail: 'Hot non-stick pan, no oil. Dry-fry high heat, stirring constantly. Add cumin seeds at 2 min. Done when slightly golden and raw smell gone.', tip: 'No oil, high heat, constant stirring.' },
          ] },
          { id: 'mpassembly', label: 'Assembly — box everything up', tasks: [
            { id: 'mp_a1', title: 'Box Powerhouse (×20)', detail: 'Rice base (188g) → sliced chicken fanned on top (175g) → tenderstem and peppers alongside (82g + 62g). Target: 380g. Weigh first 5 to calibrate scoop sizes.' },
            { id: 'mp_a2', title: 'Pull beef & box Beef & Sweet Spud (×20)', detail: 'Pull beef into large chunks with two forks. Strain jus. Container: sweet potato (170g) + kale (60g) + beef (200g). Spoon 80ml jus over beef. Target: 450g.', tip: 'Massage kale with olive oil, lemon, salt for 2 min before boxing — do not skip.' },
            { id: 'mp_a3', title: 'Make edamame slaw & box Salmon (×20)', detail: 'Drain edamame. Combine with cucumber (40g) and spring onion (15g). Dress with sesame oil at boxing time only. Box: rice (188g) + slaw (123g) + salmon (157g) + sesame seeds. Target: 380g. Cool uncovered 20 min before sealing.', tip: 'Dress slaw at boxing only — keeps it fresh.' },
            { id: 'mp_a4', title: 'Fold veg into couscous & box Halloumi (×20)', detail: 'Fold roasted veg and torn basil into cooled couscous. Box: couscous+veg base (366g) + halloumi on top (115g). Target: 370g. Work efficiently — halloumi firms quickly.', tip: 'Halloumi on top, couscous base.' },
            { id: 'mp_a5', title: 'Make raita & box Tikka (×20)', detail: 'Grate cucumber, squeeze water out in cloth. Mix with yogurt (60g), coriander, lemon juice, toasted cumin seeds, salt. Box: cauliflower rice (160g) + chicken (190g) + coriander leaves. Raita (75g) in separate sealed sauce pot inside container.', tip: 'Raita always separate, always cold.' },
            { id: 'mp_a6', title: 'Apply labels (Natasha\'s Law) to all 100 boxes', detail: 'Each box: product name, date produced, best before (use within 3 days), full ingredients, allergens in bold, storage instruction.', warn: 'Do not display any box without a compliant label.' },
            { id: 'mp_a7', title: 'Refrigerate all boxes below 5°C', detail: 'Stack in chilled fridge. Check fridge temperature before loading.' },
          ] },
          { id: 'mpclean', label: 'Clean down', tasks: [
            { id: 'mp_c1', title: 'Clean all surfaces and equipment', detail: 'Wash up, sanitise chopping boards (separate raw meat boards), clean oven trays, wipe down hob and work surfaces.' },
            { id: 'mp_c2', title: 'Store leftover ingredients correctly', detail: 'Refrigerate any open dairy. Seal and store dry goods. Date any open packets.' },
          ] },
        ],
      },
      shop: {
        label: 'Shopping list',
        type: 'shop',
        filters: [
          { id: 'all', label: 'All' }, { id: '0', label: 'Powerhouse' }, { id: '1', label: 'Beef & Spud' }, { id: '2', label: 'Salmon' }, { id: '3', label: 'Halloumi' }, { id: '4', label: 'Tikka' }, { id: '5', label: 'Protein Oats' },
        ],
        tagLabels: ['Powerhouse', 'Beef & Spud', 'Salmon', 'Halloumi', 'Tikka', 'Protein Oats'],
        sections: [
          { name: 'Meat & fish', items: [
            { name: 'Chicken breast (skinless)', qty: '4kg', uses: [0], note: 'Score surface before marinating' },
            { name: 'Beef chuck steak', qty: '5kg', uses: [1], note: 'Keep intramuscular fat' },
            { name: 'Salmon fillet (skin on)', qty: '3.7kg', uses: [2], note: 'Pat dry before searing' },
            { name: 'Chicken thighs (boneless, skinless)', qty: '4.6kg', uses: [4], note: 'Flatten to even thickness' },
          ] },
          { name: 'Dairy & chilled', items: [
            { name: 'Halloumi (block)', qty: '2.5kg', uses: [3] },
            { name: 'Natural yogurt', qty: '1.8kg', uses: [4, 5], note: 'Marinade + raita + oat base' },
            { name: 'Semi-skimmed milk', qty: '3 litres', uses: [5] },
          ] },
          { name: 'Grains & carbs', items: [
            { name: 'Basmati rice', qty: '1.5kg', uses: [0] },
            { name: 'Jasmine rice', qty: '1.5kg', uses: [2] },
            { name: 'Giant couscous', qty: '1.6kg', uses: [3] },
            { name: 'Rolled oats', qty: '1.6kg', uses: [5], note: 'Not instant — rolled only' },
          ] },
          { name: 'Veg & produce', items: [
            { name: 'Tenderstem broccoli', qty: '1.8kg', uses: [0] },
            { name: 'Red peppers', qty: '1.4kg', uses: [0] },
            { name: 'Sweet potato', qty: '4.2kg (unpeeled)', uses: [1] },
            { name: 'Curly kale', qty: '1.6kg', uses: [1] },
            { name: 'Edamame beans (frozen)', qty: '1.4kg', uses: [2] },
            { name: 'Cucumber', qty: '800g', uses: [2, 4] },
            { name: 'Spring onion', qty: '300g', uses: [2] },
            { name: 'Courgette', qty: '1.6kg', uses: [3] },
            { name: 'Red onion', qty: '1kg', uses: [3] },
            { name: 'Cherry tomatoes', qty: '1.2kg', uses: [3] },
            { name: 'Cauliflower', qty: '~20 heads (4kg)', uses: [4] },
            { name: 'Fresh coriander', qty: '2 bunches', uses: [4] },
            { name: 'Fresh basil', qty: '100g', uses: [3] },
            { name: 'Bananas', qty: '1kg', uses: [5] },
            { name: 'Lemons', qty: '6', uses: [3, 4] },
          ] },
          { name: 'Sauces & condiments', items: [
            { name: 'Piri piri marinade', qty: '400g', uses: [0] },
            { name: 'Beef stock', qty: '4 litres', uses: [1] },
            { name: 'Tomato paste', qty: '300g', uses: [1] },
            { name: 'Tikka masala paste', qty: '500g', uses: [4] },
            { name: 'Honey', qty: '300g', uses: [2, 5] },
            { name: 'Low-sodium soy sauce', qty: '300ml', uses: [2] },
            { name: 'Sesame oil', qty: '100ml', uses: [2] },
            { name: 'Sesame seeds', qty: '100g', uses: [2] },
            { name: 'Rapeseed oil', qty: '100ml', uses: [2] },
            { name: 'Olive oil', qty: '500ml', uses: [0, 1, 3] },
            { name: 'Almond butter', qty: '300g', uses: [5] },
            { name: 'Whey protein powder (vanilla)', qty: '600g', uses: [5], note: 'Myprotein / Bulk Powders wholesale' },
            { name: 'Granola', qty: '500g', uses: [5] },
          ] },
          { name: 'Herbs & spices', items: [
            { name: 'Smoked paprika', qty: 'large jar', uses: [0] },
            { name: 'Dried oregano', qty: 'large jar', uses: [3] },
            { name: 'Cumin seeds', qty: 'small jar', uses: [4] },
            { name: 'Fresh thyme & rosemary', qty: 'small bunches', uses: [1] },
            { name: 'Garlic (bulbs)', qty: '2 bulbs', uses: [1] },
            { name: 'Salt & pepper', qty: 'in stock', uses: [0, 1, 2, 3, 4, 5] },
          ] },
          { name: 'Packaging', items: [
            { name: 'Meal prep boxes with lids', qty: '120 units', uses: [0, 1, 2, 3, 4], note: 'Nisbets or Booker' },
            { name: 'Small sauce pots', qty: '20 units', uses: [4], note: 'For raita' },
            { name: 'Jars / pots for oats', qty: '20 units', uses: [5] },
            { name: 'Natasha\'s Law labels', qty: '120+', uses: [0, 1, 2, 3, 4, 5] },
          ] },
        ],
      },
      method: {
        label: 'Method',
        type: 'method',
        meals: [
          { title: 'The Powerhouse', sub: 'Piri piri chicken · basmati · tenderstem', steps: [
            { n: '1', title: 'Marinade — night before', body: 'Score chicken breasts lightly. Toss in piri piri marinade. Refrigerate overnight.' },
            { n: '2', title: 'Roast chicken — 200°C fan, 20–22 min', body: 'Lay flat on lined tray, spaced apart. Probe centre — 75°C minimum. Rest 5 min. Slice diagonally at 1.5cm.', tip: 'Core temp 75°C — non-negotiable.' },
            { n: '3', title: 'Roast tenderstem & peppers — 15–18 min', body: 'Toss in olive oil, salt, smoked paprika. Single layer. Roast 15–18 min.', tip: 'Single layer only.' },
            { n: '4', title: 'Basmati rice — 12 min + 5 min rest', body: '75g dry per portion, 1:2.5 cold water. Boil, stir once, lowest heat, lid on. 12 min. Rest 5 min. Fluff.', tip: 'Never lift lid.' },
            { n: '5', title: 'Box up — target 380g', body: 'Rice base (188g) → chicken (175g) → tenderstem + peppers (82g + 62g).' },
          ] },
          { title: 'Beef & Sweet Spud', sub: 'Slow-braised beef · sweet potato · kale', steps: [
            { n: '1', title: 'Sear beef — very high heat', body: 'Pat dry. Season. Smoking hot heavy pan. 3 min each side. All sides including edges. Batches of 6 max.', tip: 'Crowding steams not sears.' },
            { n: '2', title: 'Braise — 160°C fan, 90 min', body: 'Stock, tomato paste, garlic, thyme, rosemary. Liquid halfway up. Cover tightly. 90 min. Pull-apart test.', tip: 'Not pulling apart? Add 20 more min.' },
            { n: '3', title: 'Roast sweet potato — 200°C fan, 30–35 min', body: 'Peel, cube 2–3cm. Olive oil and salt. Single layer. Turn once at 20 min.' },
            { n: '4', title: 'Massage kale', body: 'Remove stems. Drizzle olive oil, squeeze lemon, pinch salt. Scrunch hard 2 min until darkened and wilted.', tip: 'Non-negotiable — raw kale is too tough.' },
            { n: '5', title: 'Box up — target 450g', body: 'Sweet potato (170g) + kale (60g) + pulled beef (200g) + 80ml jus over top.' },
          ] },
          { title: 'Honey Glazed Salmon', sub: 'Pan-seared · jasmine rice · edamame slaw', steps: [
            { n: '1', title: 'Prep salmon', body: 'Out of fridge 10 min. Pat skin and flesh completely dry. Brush rapeseed oil onto fish, not pan.', tip: 'Any moisture = no crispy skin.' },
            { n: '2', title: 'Sear skin-side down — 4 min, do not touch', body: 'Smoking hot pan. Skin-side down. Press 10 sec. 4 min undisturbed. Flip, 2 min. Glaze (honey + soy) in last 30 sec only.', tip: 'Glaze in last 30 sec only — burns if earlier.' },
            { n: '3', title: 'Edamame slaw', body: 'Drain edamame. Combine with cucumber (40g) and spring onion (15g). Dress with sesame oil at boxing time only.', tip: 'Dress at boxing only.' },
            { n: '4', title: 'Box up — target 380g', body: 'Rice (188g) + slaw (123g) + salmon (157g) + sesame seeds. Cool uncovered 20 min before sealing.' },
          ] },
          { title: 'Halloumi & Couscous', sub: 'Griddled halloumi · giant couscous · Mediterranean veg', steps: [
            { n: '1', title: 'Roast veg — 200°C fan, 15–18 min', body: 'Courgette + onion tossed in olive oil, oregano, salt. Single layer. Add cherry tomatoes at 10 min only.', tip: 'Tomatoes go in at 10 min.' },
            { n: '2', title: 'Giant couscous — boil 8 min', body: 'Boil 8 min. Drain — do not rinse. Immediately dress with olive oil and lemon juice. Spread to cool. Fold in roasted veg and basil.', tip: 'Dress immediately — prevents clumping.' },
            { n: '3', title: 'Griddle halloumi — dry pan, 2 min each side', body: 'Slice 1cm. Dry hot pan. 2 min — wait for natural release. Flip 2 min.', tip: 'Box while warm — goes rubbery cold.' },
            { n: '4', title: 'Box up — target 370g', body: 'Couscous+veg base (366g) + halloumi on top (115g).' },
          ] },
          { title: 'Tikka Chicken Bowl', sub: 'Tandoori thighs · cauliflower rice · raita', steps: [
            { n: '1', title: 'Marinade — night before', body: 'Mix tikka paste + yogurt. Coat thighs. Flatten to even thickness. Refrigerate overnight.' },
            { n: '2', title: 'Roast thighs — 200°C fan, 25–28 min', body: 'Flat on lined trays, not touching. 25–28 min. 75°C internal. Charred edges are correct.', tip: 'Charred edges = correct, not burnt.' },
            { n: '3', title: 'Cauliflower rice — dry-fry, 4–5 min', body: 'Blitz florets to rice-sized pieces. Hot pan, NO oil. Dry-fry constantly stirring 4–5 min. Add cumin seeds at 2 min.', tip: 'No oil, constant stirring.' },
            { n: '4', title: 'Raita', body: 'Grate cucumber, squeeze dry in cloth. Mix with yogurt, coriander, lemon juice, toasted cumin, salt. Refrigerate immediately.', tip: 'Squeeze cucumber or raita goes watery.' },
            { n: '5', title: 'Box up', body: 'Cauliflower rice (160g) + chicken (190g) + coriander. Raita (75g) in separate sealed sauce pot inside container.', tip: 'Raita always separate, always cold.' },
          ] },
          { title: 'Banana Protein Oats', sub: 'Overnight oats · whey protein · almond butter', steps: [
            { n: '1', title: 'Base — night before or same morning', body: 'Whisk protein powder into milk until dissolved. Add yogurt, whisk. Add oats, stir. Divide into jars. Seal and refrigerate 4+ hrs.', tip: 'Protein into milk first — prevents lumps.' },
            { n: '2', title: 'Top at service', body: 'Stir base. Layer: oats → banana → almond butter → granola → honey.', tip: 'Granola last — retains crunch.' },
          ] },
        ],
      },
    },
  },

  oats: {
    label: 'Overnight Oats',
    views: {
      checklist: {
        label: 'Checklist',
        type: 'checklist',
        days: [
          { id: 'oa_order', label: 'Order ahead — 3–5 days before', tasks: [
            { id: 'oa_o1', title: 'Order ceremonial matcha powder', detail: '24g needed. Teapigs or Clearspring. Not stocked in Booker. Allow 3–5 days delivery.', warn: 'Do not start production without this — Strawberry Matcha flavour will be incomplete.' },
            { id: 'oa_o2', title: 'Order freeze-dried strawberries', detail: '36g needed. Sous Chef or Amazon wholesale. Not in Booker.', warn: 'Order at same time as matcha.' },
            { id: 'oa_o3', title: 'Order erythritol / stevia blend', detail: '48g needed. Holland & Barrett trade or health food wholesaler.', warn: 'Check stock — this may need a separate order.' },
            { id: 'oa_o4', title: 'Order 72 clip-top glass jars (350ml)', detail: 'Buy 72 to have spares for the 60 needed. Nisbets or Amazon Business. Allow lead time if ordering.', tip: 'Check you have a thermal label printer loaded and ready before delivery arrives.' },
            { id: 'oa_o5', title: 'Order printed front labels', detail: '60 + spares. Avery WePrint or Kingfisher Labels. These need to be designed and submitted in advance.', warn: 'Labels must be ordered before production day — they cannot be printed in-house.' },
          ] },
          { id: 'oa_night', label: 'Night before production', tasks: [
            { id: 'oa_n1', title: 'Start cold brew coffee (Tiramisu)', detail: 'Combine 100g coarse-ground espresso with 1L cold water in a clip-seal container. Stir, cover, refrigerate overnight. Strain through fine sieve or muslin in the morning. Yields ~960ml concentrate.', tip: 'Do this first — it needs 12 hrs minimum.' },
            { id: 'oa_n2', title: 'Make berry jelly base (Trifle)', detail: 'Dissolve 24g sugar-free jelly crystals in 120ml boiling water. Stir until fully dissolved. Add 720g thawed mixed berries. Pour into a deep tray and refrigerate 30+ min until lightly set.', tip: 'Make early in the evening so it has maximum time to set.' },
            { id: 'oa_n3', title: 'Stew the apples (Apple Crumble)', detail: 'Peel and dice ~1kg cooking apples into 1cm cubes. Saucepan with 3 tbsp water, half tsp cinnamon, pinch of nutmeg. Medium heat 8–10 min until soft but not mushy. Cool completely then refrigerate.', tip: 'Spread on a tray to cool faster. Do not jar while warm.' },
            { id: 'oa_n4', title: 'Pre-mix all 5 dry blends', detail: 'In 5 separate large labelled bowls, combine oats + protein + any dry spices:\n• Banoffee: 360g oats + 360g protein + 60g flaxseed\n• Apple Crumble: 360g oats + 360g protein + cinnamon + nutmeg\n• Strawberry Matcha: 360g oats + 360g protein + 60g chia + 24g matcha\n• Tiramisu: 360g oats + 360g protein\n• Trifle: 360g oats + 360g protein + 96g custard powder', tip: 'Weigh into large batch bowls, not per jar. Cover with cling film.' },
            { id: 'oa_n5', title: 'Print all Natasha\'s Law back labels', detail: 'Print 60+ thermal labels (one per jar). Lay out by flavour. Each label must include: product name, date produced, best before (48 hrs), full ingredients, allergens in bold, storage instruction.', warn: 'Print tonight — sticking labels slows assembly if left to morning.' },
            { id: 'oa_n6', title: 'Wash and dry all 72 jars', detail: 'Check clips are working. Air dry completely — wet jars affect shelf life.', tip: 'Stack by size, clips open, ready to fill.' },
          ] },
          { id: 'oa_prep', label: 'Production day — prep session', tasks: [
            { id: 'oa_p1', title: 'Strain cold brew coffee', detail: 'Strain the overnight cold brew through a fine sieve or muslin. Should yield ~960ml concentrate. Set aside for Tiramisu batch.', tip: 'Brew straight into a jug or squeeze bottle for easy pouring.' },
            { id: 'oa_p2', title: 'Make Tiramisu cream layer', detail: 'Combine 960g skyr/Greek yogurt, 600g ricotta or quark, 60ml vanilla extract, 60ml sugar-free coffee syrup, pinch salt. Blend with stick blender until completely smooth. Transfer to piping bag. Refrigerate.', tip: 'Piping bag gives consistent clean layers — much faster than spooning.' },
            { id: 'oa_p3', title: 'Mash banana & date base (Banoffee)', detail: 'Mash 720g ripe banana with 180g date paste and 60ml caramel syrup until smooth with a few chunks. This is the base layer for all 12 Banoffee jars.', tip: 'Potato masher is fastest. Don\'t over-blend — a few chunks are good.' },
            { id: 'oa_p4', title: 'Set up production line', detail: 'Arrange jars in rows labelled by flavour (12 per flavour × 5 flavours = 60 jars). Place dry blend bowls, yogurt, milks, and flavour-specific ingredients in position. Scales and ladle ready.' },
          ] },
          { id: 'oa_fill', label: 'Production day — fill all 60 jars', tasks: [
            { id: 'oa_f1', title: 'Fill 12 Banoffee jars', detail: 'Spoon banana-date mash into base (45g). Add dry oat mix. Spoon yogurt. Pour almond milk. Stir once gently.', tip: 'Use scales for first 3, then switch to calibrated scoop.' },
            { id: 'oa_f2', title: 'Fill 12 Apple Crumble jars', detail: 'Spoon apple compote into base (70g). Add dry oat mix. Spoon yogurt. Pour oat milk. Add sweetener. Stir.' },
            { id: 'oa_f3', title: 'Fill 12 Strawberry Matcha jars', detail: 'Dissolve matcha in 2 tbsp warm almond milk per batch jug first. Add to oat mix + remaining milk. Fold in yogurt + honey. Spoon in diced strawberries — leave chunks visible. Do not fully stir.', tip: 'Don\'t overmix — you want visible strawberry chunks.' },
            { id: 'oa_f4', title: 'Fill 12 Tiramisu jars', detail: 'Mix cold brew concentrate + almond milk in a jug. Pour over dry oat mix, stir to soak. Leave 5 min. Layer soaked oats into jar. Pipe cream layer on top.', tip: 'Let oats soak the full 5 min before jarring — makes the layers distinct.' },
            { id: 'oa_f5', title: 'Fill 12 Trifle jars', detail: 'Mix oats + custard powder with almond milk until custard dissolves. Fold in yogurt + vanilla. Layer: custard oat base → ladle of berry jelly → yogurt dollop on top.', tip: 'The jelly should be set but still slightly wobbly — not solid.' },
            { id: 'oa_f6', title: 'Seal, label & refrigerate all 60 jars', detail: 'Clip or seal all jars. Apply Natasha\'s Law back label to each jar while identifiable. Stack in fridge. Refrigerate minimum 6 hours — overnight is ideal.', warn: 'Do not display any jar without a compliant label applied.' },
          ] },
          { id: 'oa_service', label: 'Morning of service', tasks: [
            { id: 'oa_s1', title: 'Add toppings to all jars', detail: 'Banoffee: 5g banana chips + tiny drizzle caramel syrup\nApple Crumble: 15g granola topping\nStrawberry Matcha: pinch freeze-dried strawberry pieces\nTiramisu: dust raw cacao powder through a small sieve\nTrifle: spray cream dollop + sprinkles or fresh berry', warn: 'Never add toppings the night before — granola goes soggy, cacao gets damp, cream collapses.' },
            { id: 'oa_s2', title: 'Quality check every jar', detail: 'Each jar: oats should be swollen and creamy, not watery. If any jar looks too liquid it may not have soaked long enough — pull it from display.', tip: 'Keep a stock of pre-soaked backup jars in the fridge at all times once in full swing.' },
            { id: 'oa_s3', title: 'Arrange on chilled display counter', detail: 'Arrange by flavour with a flavour label card in front of each group. Apply chilled / use-by sticker if not already on label. Ensure display fridge is below 5°C.', warn: 'Consume within 48 hrs of production. Fridge below 5°C at all times.' },
          ] },
        ],
      },
      shop: {
        label: 'Shopping list',
        type: 'shop',
        filters: [
          { id: 'all', label: 'All' }, { id: '0', label: 'Banoffee' }, { id: '1', label: 'Apple Crumble' }, { id: '2', label: 'Strawberry Matcha' }, { id: '3', label: 'Tiramisu' }, { id: '4', label: 'Trifle' },
        ],
        tagLabels: ['Banoffee', 'Apple Crumble', 'Strawberry Matcha', 'Tiramisu', 'Trifle'],
        sections: [
          { name: 'Dairy & chilled', items: [
            { name: 'Skyr or 0% Greek yogurt (Fage/Arla)', qty: '5.52kg', uses: [0, 1, 2, 3, 4], note: 'Booker chilled — 1×5kg tub if available' },
            { name: 'Reduced-fat ricotta or quark', qty: '600g', uses: [3], note: '1×500g + 1×250g' },
            { name: 'Light aerosol spray cream', qty: '1 can', uses: [4], note: 'Add day of service only' },
            { name: 'Fresh strawberries', qty: '720g', uses: [2], note: '~2×400g punnets' },
            { name: 'Ripe bananas', qty: '720g', uses: [0], note: '~6–7 medium bananas' },
            { name: 'Cooking apples', qty: '~1kg raw', uses: [1], note: 'Yields ~840g stewed after prep' },
          ] },
          { name: 'Ambient — core base', items: [
            { name: 'Jumbo rolled oats', qty: '3.6kg', uses: [0, 1, 2, 3, 4], note: '3kg bag ×2 or catering 5kg sack' },
            { name: 'Vanilla whey protein powder', qty: '1.8kg', uses: [0, 1, 2, 3, 4], note: 'Tropicana Wholesale or bulk sports supplier' },
            { name: 'Unsweetened almond milk (Alpro)', qty: '5.16L', uses: [0, 2, 3, 4], note: '6×1L cartons' },
            { name: 'Unsweetened oat milk (Alpro/Oatly)', qty: '1.44L', uses: [1], note: '2×1L cartons' },
            { name: 'Vanilla extract', qty: '84ml', uses: [0, 1, 2, 3, 4] },
          ] },
          { name: 'Flavour-specific', items: [
            { name: 'Medjool dates / date paste', qty: '180g', uses: [0] },
            { name: 'Ground flaxseed', qty: '60g', uses: [0] },
            { name: 'Chia seeds', qty: '60g', uses: [2] },
            { name: 'Ceremonial matcha powder', qty: '24g', uses: [2], note: '⚠ Order online — Teapigs / Clearspring. 3–5 day lead time' },
            { name: 'Freeze-dried strawberries', qty: '36g', uses: [2], note: '⚠ Sous Chef / Amazon wholesale. Not in Booker' },
            { name: 'Low-sugar granola', qty: '180g', uses: [1] },
            { name: 'Banana chips', qty: '60g', uses: [0] },
            { name: 'Raw cacao powder', qty: '36g', uses: [3] },
            { name: 'Sugar-free vanilla custard powder', qty: '96g', uses: [4], note: 'Bird\'s — 1×300g tin' },
            { name: 'Sugar-free strawberry jelly crystals', qty: '24g', uses: [4], note: '1–2 sachets' },
            { name: 'Erythritol / stevia sweetener blend', qty: '48g', uses: [1], note: '⚠ Holland & Barrett trade / health food wholesaler' },
          ] },
          { name: 'Syrups & seasonings', items: [
            { name: 'Sugar-free caramel syrup (Monin)', qty: '250ml bottle', uses: [0], note: 'Booker catering syrups aisle' },
            { name: 'Sugar-free coffee syrup (Monin)', qty: '250ml bottle', uses: [3], note: 'Booker catering syrups aisle' },
            { name: 'Honey', qty: '60ml', uses: [2] },
            { name: 'Sprinkles / vermicelli', qty: '24g', uses: [4] },
            { name: 'Sea salt (fine)', qty: 'negligible', uses: [0, 1, 2, 3, 4], note: 'Already in kitchen' },
          ] },
          { name: 'Coffee', items: [
            { name: 'Ground espresso coffee (Lavazza)', qty: '~100g', uses: [3], note: 'Makes ~1L cold brew — steep 12 hrs night before' },
          ] },
          { name: 'Packaging', items: [
            { name: '350ml clip-top glass jars', qty: '72 units', uses: [0, 1, 2, 3, 4], note: 'Nisbets or Amazon Business' },
            { name: 'Printed front labels (branded)', qty: '60 + spares', uses: [0, 1, 2, 3, 4], note: 'Avery WePrint or Kingfisher Labels — order ahead' },
            { name: 'Thermal back labels (Natasha\'s Law)', qty: '60+', uses: [0, 1, 2, 3, 4], note: 'Print in-house on prep day' },
          ] },
        ],
      },
      method: {
        label: 'Method',
        type: 'method',
        meals: [
          { title: 'Day before — evening prep', sub: 'Cold brew · stewed apples · jelly · cream layer · dry blends', steps: [
            { n: '1', title: 'Cold brew coffee', body: '100g coarse espresso + 1L cold water. Stir, cover, refrigerate overnight. Strain in morning. Yields ~960ml.', tip: 'Clip-seal container — goes straight in fridge.' },
            { n: '2', title: 'Stew apples', body: 'Peel and dice ~1kg apples 1cm. Pan with 3 tbsp water, cinnamon, nutmeg. Medium heat 8–10 min. Cool completely before use.', tip: 'Spread on tray to cool faster. Never jar while warm.' },
            { n: '3', title: 'Berry jelly base', body: 'Dissolve 24g jelly crystals in 120ml boiling water. Add 720g thawed mixed berries. Pour into tray. Refrigerate 30+ min.', tip: 'Make early — maximum time to set.' },
            { n: '4', title: 'Tiramisu cream layer', body: 'Blend 960g yogurt + 600g ricotta + 60ml vanilla + 60ml coffee syrup + pinch salt until smooth. Transfer to piping bag. Refrigerate.', tip: 'Piping bag = consistent clean layers.' },
            { n: '5', title: 'Pre-mix all 5 dry blends', body: 'Banoffee: oats + protein + flaxseed. Apple Crumble: oats + protein + cinnamon + nutmeg. Strawberry Matcha: oats + protein + chia + matcha. Tiramisu: oats + protein. Trifle: oats + protein + custard powder.', tip: 'Large batch bowls — cover with cling film.' },
            { n: '6', title: 'Banana & date mash', body: 'Mash 720g banana + 180g date paste + 60ml caramel syrup. Smooth with a few chunks. Refrigerate.', tip: 'Potato masher. Don\'t over-blend.' },
          ] },
          { title: 'Production day — fill 60 jars', sub: 'Assembly line · one flavour at a time', steps: [
            { n: '7', title: 'Set up production line', body: 'Jars in rows labelled by flavour. All ingredients in position. Scales and ladle ready.' },
            { n: '8', title: 'Banoffee (12 jars)', body: 'Banana-date mash (45g) → dry oat mix → yogurt → almond milk → stir once.', tip: 'Scales for first 3, then calibrated scoop.' },
            { n: '9', title: 'Apple Crumble (12 jars)', body: 'Apple compote (70g) → dry oat mix → yogurt → oat milk → sweetener → stir.' },
            { n: '10', title: 'Strawberry Matcha (12 jars)', body: 'Dissolve matcha in 2 tbsp warm almond milk first. Add to oat mix + remaining milk. Fold in yogurt + honey. Spoon in diced strawberries — leave chunks visible. Do not fully stir.', tip: 'Visible strawberry chunks are the goal.' },
            { n: '11', title: 'Tiramisu (12 jars)', body: 'Mix cold brew + almond milk. Pour over dry oat mix, stir, leave 5 min. Layer soaked oats into jar. Pipe cream layer on top.', tip: 'Full 5 min soak makes layers distinct.' },
            { n: '12', title: 'Trifle (12 jars)', body: 'Mix oats + custard powder with almond milk until custard dissolves. Fold in yogurt + vanilla. Layer: custard oats → berry jelly → yogurt dollop.', tip: 'Jelly should be set but slightly wobbly.' },
            { n: '13', title: 'Seal, label & refrigerate', body: 'Clip all jars. Apply Natasha\'s Law label to each. Stack in fridge. Minimum 6 hrs — overnight ideal.', warn: 'No jar on display without compliant label.' },
          ] },
          { title: 'Morning of service — toppings & display', sub: 'Never add toppings the night before', steps: [
            { n: '14', title: 'Add toppings', body: 'Banoffee: banana chips + caramel drizzle. Apple Crumble: granola (15g). Strawberry Matcha: freeze-dried strawberry. Tiramisu: sieve raw cacao. Trifle: spray cream + sprinkles.', tip: 'Granola goes soggy overnight. Cacao gets damp. Cream collapses. Always morning-of.' },
            { n: '15', title: 'Quality check & display', body: 'Oats swollen and creamy, not watery. Arrange by flavour with label cards. Fridge below 5°C. 48 hr shelf life from production.' },
          ] },
        ],
      },
    },
  },

};

// ─── SCHEDULE DATA ──────────────────────────────────────────────────────
// cols: oven, hob, passive, prep, assemble

const SCHEDULES = {
  baking: {
    totalActive: '~45 min',
    totalElapsed: '~4 hrs',
    note: 'Preheat oven to 180°C fan before doing anything else. Reduce to 170°C after brownies.',
    rows: [
      { time: '0:00', col: 'prep', text: 'Get butter (500g) and eggs (10) out to reach room temp. Grease and line 2× 20cm tins, brownie tin (20×30cm), skillet/pie tin, 2× baking trays. Weigh all sponge ingredients.' },
      { time: '0:00', col: 'oven', text: 'Preheat oven to 180°C fan.' },
      { time: '0:10', col: 'hob', text: 'SPONGE: Beat 225g butter + 225g caster sugar until pale and fluffy — 5 min. Add 4 eggs one at a time. Sift in 225g SR flour + 1 tsp baking powder. Fold gently. Splash of milk to loosen.' },
      { time: '0:20', col: 'oven', text: 'SPONGE: Divide batter evenly between 2 lined tins. Bake 180°C fan, 25–30 min. Do not open oven in first 20 min.' },
      { time: '0:20', col: 'hob', text: 'BROWNIES: Melt 200g dark chocolate + 175g butter over simmering water. Stir until smooth. Remove from heat, cool 5 min.' },
      { time: '0:25', col: 'hob', text: 'BROWNIES: Whisk 3 eggs + 325g light brown sugar until thick and pale (~3 min). Fold in chocolate mix. Sift in 100g plain flour + 2 tbsp cocoa. Fold until just combined.' },
      { time: '0:50', col: 'oven', text: 'SPONGE out of oven. Cool in tins 10 min then turn onto rack. Must be fully cold before filling. BROWNIES: Pour into lined 20×30cm tin. Bake 180°C fan, 22–25 min.' },
      { time: '0:50', col: 'passive', text: 'SPONGE cooling on rack — minimum 45 min before filling.' },
      { time: '0:55', col: 'prep', text: 'COOKIE PIE: Melt 150g butter. Mix with 150g caster sugar + 100g light brown sugar. Beat in 2 eggs + 1 tsp vanilla. Stir in 280g plain flour + pinch salt. Fold in 150g chocolate chips.' },
      { time: '1:10', col: 'oven', text: 'BROWNIES out. Scatter sea salt flakes immediately. Leave in tin to cool completely — do not cut yet. REDUCE OVEN to 170°C fan.' },
      { time: '1:10', col: 'oven', text: 'COOKIE PIE: Press dough into greased skillet / 9-inch tin. Bake 170°C fan, 30–35 min. Edges set, centre still soft — it sets as it cools.' },
      { time: '1:10', col: 'passive', text: 'BROWNIES cooling in tin — minimum 60 min before cutting.' },
      { time: '1:15', col: 'prep', text: 'COOKIES: Beat 225g butter + 150g caster sugar + 150g light brown sugar. Add 2 eggs + 1 tsp vanilla. Fold in 350g plain flour + 1 tsp bicarb + pinch salt + 200g chocolate chips. Roll into ~50g balls.' },
      { time: '1:30', col: 'passive', text: 'Chill cookie dough balls on tray — 30 min in fridge gives a chewier, thicker cookie.' },
      { time: '1:40', col: 'oven', text: 'COOKIE PIE out. Scatter sea salt flakes. Cool in tin 20–30 min before slicing.' },
      { time: '2:00', col: 'oven', text: 'COOKIES: Bake at 170°C fan, 11–13 min per batch. Edges set, centres still soft. Leave on tray — firm as they cool.' },
      { time: '2:15', col: 'assemble', text: 'SPONGE: Sandwich cold sponge layers with jam + cream/buttercream. Dust top with icing sugar.' },
      { time: '2:15', col: 'assemble', text: 'BROWNIES: Cut into portions once fully cold. Store in airtight tin.' },
      { time: '2:20', col: 'assemble', text: 'COOKIE PIE: Slice and label. COOKIES: Transfer to airtight container. Label all with date made.' },
    ],
  },

  mealprep: {
    totalActive: '~30 min hands-on',
    totalElapsed: '~2 hrs 15 min',
    note: 'Preheat oven to 200°C fan before doing anything else. Start beef braise first — it needs 90 min passive.',
    rows: [
      { time: '0:00', col: 'oven', text: 'Preheat oven to 200°C fan. Boil large pot of water. Get all ingredients and containers out.' },
      { time: '0:00', col: 'prep', text: 'Coat 4.6kg chicken thighs in tikka paste (500g) + yogurt (600g). Leave to marinate while you prep everything else.' },
      { time: '0:10', col: 'prep', text: 'Cube 4.2kg sweet potato (2–3cm) + toss in olive oil and salt. Chop 1.4kg red peppers (1–1.5cm strips). Trim 1.8kg tenderstem. Coat 4kg chicken breasts in piri piri marinade (400g).' },
      { time: '0:10', col: 'hob', text: 'Make overnight oats base: whisk 600g protein powder into 3L milk. Add 1kg yogurt, whisk. Add 1.6kg oats, stir. Divide into 20 jars. Refrigerate immediately. Done — no more work needed.' },
      { time: '0:20', col: 'oven', text: 'BEEF: Sear 5kg chuck in batches of 6 — smoking hot heavy pan, 3 min each side all round. Transfer to casserole with 4L stock, 300g tomato paste, garlic, thyme, rosemary. Lid on. 160°C fan, 90 min.' },
      { time: '0:20', col: 'oven', text: 'SWEET POTATO: Trays into oven at 200°C fan. 30–35 min. Turn once at 20 min.' },
      { time: '0:30', col: 'hob', text: 'HOB: Cook 1.5kg basmati (Powerhouse) and 1.5kg jasmine rice (Salmon) simultaneously in two pans. 1:2.5 cold water ratio. Boil, stir once, lowest heat, lid on. 12 min + 5 min rest off heat.' },
      { time: '0:30', col: 'hob', text: 'HOB: Giant couscous (1.6kg) — boil salted water, simmer 8 min, drain. Toss with olive oil + lemon juice immediately so it doesn\'t clump.' },
      { time: '0:45', col: 'oven', text: 'CHICKEN BREASTS: Lay flat on lined trays, spaced apart. 200°C fan, 20–22 min. Add tenderstem (1.8kg) + peppers (1.4kg) on separate tray — 15 min.' },
      { time: '0:45', col: 'passive', text: 'Both rices done — lid on, off heat to rest. Couscous cooled — fold in 1.6kg courgette, 1kg red onion, 1.2kg cherry tomatoes (added at 10 min), basil. Set aside.' },
      { time: '1:00', col: 'hob', text: 'HOB: Cauliflower rice — blitz/grate 4kg cauliflower raw, dry-fry in non-stick pan with cumin seeds, no oil, 4–5 min stirring constantly. Output: ~160g per portion.' },
      { time: '1:00', col: 'prep', text: 'Make raita: 1.2kg yogurt + 600g cucumber (grated, squeezed dry) + coriander + lemon juice + pinch salt. Refrigerate.' },
      { time: '1:00', col: 'prep', text: 'Make edamame slaw: 1.4kg edamame + spring onion (300g) + cucumber (200g) + sesame oil (100ml) + sesame seeds (100g). Set aside.' },
      { time: '1:10', col: 'hob', text: 'HOB: Griddle pan very hot, DRY (no oil). Halloumi 1cm slices (2.5kg total) — 2 min each side. Don\'t move until it releases. Box immediately while warm.' },
      { time: '1:10', col: 'hob', text: 'HOB: Salmon skin-side down in HOT oiled pan. Press 10 sec, cook 4 min untouched. Flip, 2 min. Glaze with honey (300g) + soy (300ml) in LAST 30 sec only.' },
      { time: '1:20', col: 'passive', text: 'Everything out of oven. Rest chicken breast 5 min before slicing. Check beef — should pull apart easily. If not, 20 more min.' },
      { time: '1:20', col: 'prep', text: 'Massage kale: 1.6kg kale + olive oil + lemon + salt. Scrunch with hands 2 min until wilted and softened.' },
      { time: '1:30', col: 'assemble', text: 'BOX UP: Grains/rice first, protein on top, veg/slaw last. Sauces (raita, beef jus) in small separate pots. Apply Natasha\'s Law labels to all 120 boxes.' },
      { time: '1:50', col: 'passive', text: 'Cool all hot meals UNCOVERED 20 min. Then seal, label with contents + date, refrigerate. Ready.' },
    ],
  },

  oats: {
    totalActive: '~2 hrs active',
    totalElapsed: '~14 hrs (including overnight)',
    note: 'Start cold brew and jelly base the evening before. Minimum 6 hrs fridge time after filling jars — overnight is ideal.',
    rows: [
      { time: 'NIGHT — 0:00', col: 'hob', text: 'COLD BREW: Combine 100g coarse espresso + 1L cold water in clip-seal container. Stir, cover, refrigerate overnight. Strains to ~960ml concentrate in morning.' },
      { time: 'NIGHT — 0:05', col: 'hob', text: 'JELLY BASE (Trifle): Dissolve 24g sugar-free jelly crystals in 120ml boiling water. Add 720g thawed mixed berries. Stir, pour into deep tray. Refrigerate 30+ min until set.' },
      { time: 'NIGHT — 0:15', col: 'hob', text: 'STEWED APPLES (Apple Crumble): Peel + dice ~1kg cooking apples into 1cm cubes. Pan with 3 tbsp water + ½ tsp cinnamon + pinch nutmeg. Medium heat 8–10 min until soft. Spread on tray to cool fast. Portion 70g per jar once cold.' },
      { time: 'NIGHT — 0:30', col: 'prep', text: 'PRE-MIX ALL 5 DRY BLENDS (in large labelled bowls):\n• Banoffee: 360g oats + 360g protein + 60g flaxseed\n• Apple Crumble: 360g oats + 360g protein + cinnamon + nutmeg\n• Strawberry Matcha: 360g oats + 360g protein + 60g chia + 24g matcha\n• Tiramisu: 360g oats + 360g protein\n• Trifle: 360g oats + 360g protein + 96g custard powder' },
      { time: 'NIGHT — 0:45', col: 'prep', text: 'Print all 60 Natasha\'s Law back labels. Lay out by flavour. Wash and dry all 72 jars. Stack clips open, ready to fill.' },
      { time: 'NIGHT — 0:55', col: 'passive', text: 'All night: cold brew steeping (min 12 hrs), jelly setting, stewed apples chilling, dry blends resting covered at room temp.' },
      { time: 'MORNING — 0:00', col: 'hob', text: 'Strain cold brew through fine sieve or muslin. Yields ~960ml concentrate. Pour into jug or squeeze bottle.' },
      { time: 'MORNING — 0:05', col: 'hob', text: 'TIRAMISU CREAM: Blend 960g skyr/yogurt + 600g ricotta/quark + 60ml vanilla + 60ml coffee syrup + pinch salt with stick blender until smooth. Transfer to piping bag. Refrigerate.' },
      { time: 'MORNING — 0:10', col: 'prep', text: 'BANOFFEE BASE: Mash 720g ripe banana + 180g date paste + 60ml caramel syrup with potato masher. Smooth with a few chunks. Set aside.' },
      { time: 'MORNING — 0:15', col: 'prep', text: 'Set up production line: 60 jars in rows labelled by flavour (12 per flavour). All ingredients in position. Scales, ladle, piping bag ready.' },
      { time: 'MORNING — 0:20', col: 'assemble', text: 'BANOFFEE (12 jars): Spoon banana-date mash (45g) → dry oat mix → yogurt → 516ml almond milk total → stir once gently.' },
      { time: 'MORNING — 0:30', col: 'assemble', text: 'APPLE CRUMBLE (12 jars): Apple compote (70g) → dry oat mix → yogurt → 144ml oat milk → sweetener (4g per jar) → stir.' },
      { time: 'MORNING — 0:40', col: 'assemble', text: 'STRAWBERRY MATCHA (12 jars): Dissolve matcha in 2 tbsp warm almond milk per batch jug first. Add to oat mix + remaining milk. Fold in yogurt + honey (5ml per jar). Spoon in diced strawberries (60g per jar) — leave chunks visible.' },
      { time: 'MORNING — 0:55', col: 'assemble', text: 'TIRAMISU (12 jars): Mix 960ml cold brew + almond milk in jug. Pour over dry oat mix, stir to soak, leave 5 min. Layer soaked oats into jar. Pipe cream layer on top.' },
      { time: 'MORNING — 1:10', col: 'assemble', text: 'TRIFLE (12 jars): Mix oats + custard powder with almond milk until custard dissolves. Fold in yogurt + vanilla. Layer: custard oat base → ladle of berry jelly (62g) → yogurt dollop on top.' },
      { time: 'MORNING — 1:25', col: 'assemble', text: 'Clip or seal all 60 jars. Apply Natasha\'s Law back label to each while still identifiable. Stack in fridge. Minimum 6 hrs — overnight ideal.' },
      { time: 'SERVICE — 0:00', col: 'prep', text: 'Add toppings just before opening:\n• Banoffee: 5g banana chips + drizzle caramel syrup\n• Apple Crumble: 15g granola\n• Strawberry Matcha: pinch freeze-dried strawberry\n• Tiramisu: dust raw cacao (36g total) through small sieve\n• Trifle: spray cream dollop + 24g sprinkles or fresh berry' },
      { time: 'SERVICE — 0:10', col: 'passive', text: 'Quality check all jars — oats swollen and creamy, not watery. Arrange by flavour on chilled display. Fridge below 5°C. 48 hr shelf life from production.' },
    ],
  },
};

const COL_LABELS = { oven: 'Oven', hob: 'Hob / Bowl', passive: 'Passive', prep: 'Prep / Knife', assemble: 'Assemble' };
const COL_ORDER = ['oven', 'hob', 'passive', 'prep', 'assemble'];

// Views are rendered in this fixed order across every list.
const VIEW_ORDER = ['checklist', 'shop', 'schedule', 'method'];
const VIEW_LABELS = { checklist: 'Checklist', shop: 'Shopping list', schedule: 'Schedule', method: 'Method' };

// ─── STATE ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'dd_production_checked';
const checked = loadChecked();
let activeList = 'baking';
let activeView = 'checklist';
let activeFilter = 'all';

function loadChecked() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
}
function key(l, v, a, b) {
  return `${l}|${v}|${a}|${b}`;
}

// ─── DOM HANDLES ────────────────────────────────────────────────────────

const el = {
  topTabs: document.getElementById('prodTopTabs'),
  subTabs: document.getElementById('prodSubTabs'),
  filters: document.getElementById('prodFilters'),
  content: document.getElementById('prodContent'),
  progFill: document.getElementById('prodProgFill'),
  progLabel: document.getElementById('prodProgLabel'),
  progPct: document.getElementById('prodProgPct'),
  doneNum: document.getElementById('prodDoneNum'),
  totalNum: document.getElementById('prodTotalNum'),
  doneSuffix: document.getElementById('prodDoneSuffix'),
};

// ─── ESCAPING ───────────────────────────────────────────────────────────
// All recipe text is static/trusted, but escaping keeps the rendering robust
// and avoids accidental markup if the data is ever edited.

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function escMultiline(s) {
  return esc(s).replace(/\n/g, '<br>');
}

// ─── RENDER: NAV ────────────────────────────────────────────────────────

function renderTopTabs() {
  el.topTabs.innerHTML = Object.entries(LISTS).map(([id, d]) =>
    `<button class="prod-toptab${id === activeList ? ' is-active' : ''}" data-action="list" data-id="${id}">${esc(d.label)}</button>`
  ).join('');
}

function renderSubTabs() {
  const views = LISTS[activeList].views;
  el.subTabs.innerHTML = VIEW_ORDER
    .filter((id) => id === 'schedule' ? !!SCHEDULES[activeList] : !!views[id])
    .map((id) =>
      `<button class="prod-subtab${id === activeView ? ' is-active' : ''}" data-action="view" data-id="${id}">${esc(VIEW_LABELS[id])}</button>`
    ).join('');
}

function renderFilters() {
  const v = LISTS[activeList].views[activeView];
  if (!v || v.type !== 'shop') {
    el.filters.innerHTML = '';
    el.filters.hidden = true;
    return;
  }
  el.filters.hidden = false;
  el.filters.innerHTML = v.filters.map((f) =>
    `<button class="prod-filter${f.id === activeFilter ? ' is-active' : ''}" data-action="filter" data-id="${esc(f.id)}">${esc(f.label)}</button>`
  ).join('');
}

// ─── RENDER: CONTENT ────────────────────────────────────────────────────

function renderContent() {
  if (activeView === 'schedule') {
    renderSchedule();
    return;
  }
  const v = LISTS[activeList].views[activeView];
  if (v.type === 'checklist') renderChecklist(v);
  else if (v.type === 'shop') renderShop(v);
  else renderMethod(v);
}

function renderChecklist(v) {
  let html = '<div class="prod-page">';
  let totalAll = 0, doneAll = 0;
  v.days.forEach((day) => {
    let dt = 0, dd = 0;
    day.tasks.forEach((t) => { dt++; if (checked[key(activeList, activeView, day.id, t.id)]) dd++; });
    totalAll += dt; doneAll += dd;
    html += `<div class="prod-day"><div class="prod-day__hdr"><span>${esc(day.label)}</span><span class="prod-day__pct">${dd}/${dt}</span></div>`;
    day.tasks.forEach((t) => {
      const k = key(activeList, activeView, day.id, t.id);
      const chk = !!checked[k];
      html += `<div class="prod-task${chk ? ' is-chk' : ''}" data-action="toggle" data-key="${esc(k)}" role="button" tabindex="0" aria-pressed="${chk}">
        <div class="prod-cb">${checkSvg()}</div>
        <div class="prod-task__info">
          <div class="prod-task__title">${esc(t.title)}</div>
          <div class="prod-task__detail">${escMultiline(t.detail)}</div>
          ${t.tip ? `<div class="prod-task__tip">Tip: ${esc(t.tip)}</div>` : ''}
          ${t.parallel ? `<div class="prod-task__parallel">Run in parallel: ${esc(t.parallel)}</div>` : ''}
          ${t.warn ? `<div class="prod-task__warn">⚠ ${esc(t.warn)}</div>` : ''}
        </div>
      </div>`;
    });
    html += '</div>';
  });
  html += '</div>';
  el.content.innerHTML = html;
  updateStats(totalAll, doneAll, 'tasks');
}

function renderShop(v) {
  let html = '<div class="prod-page">';
  let total = 0, done = 0;
  v.sections.forEach((sec, sIdx) => {
    const fi = activeFilter;
    const vis = sec.items
      .map((it, iIdx) => ({ it, iIdx }))
      .filter(({ it }) => fi === 'all' || it.uses.includes(parseInt(fi, 10)));
    if (!vis.length) return;
    html += `<div class="prod-sec"><span>${esc(sec.name)}</span></div>`;
    vis.forEach(({ it, iIdx }) => {
      const k = key(activeList, activeView, sIdx, iIdx);
      const chk = !!checked[k];
      total++; if (chk) done++;
      const tags = it.uses.map((u) => `<span class="prod-tag prod-tag--t${u}">${esc(v.tagLabels[u])}</span>`).join('');
      html += `<div class="prod-item${chk ? ' is-chk' : ''}" data-action="toggle" data-key="${esc(k)}" role="button" tabindex="0" aria-pressed="${chk}">
        <div class="prod-cb">${checkSvg()}</div>
        <div class="prod-item__info">
          <div class="prod-item__name">${esc(it.name)}</div>
          <div class="prod-item__qty">${esc(it.qty)}</div>
          ${it.note ? `<div class="prod-item__note">${esc(it.note)}</div>` : ''}
          <div class="prod-tags">${tags}</div>
        </div>
      </div>`;
    });
  });
  html += '</div>';
  el.content.innerHTML = html;
  updateStats(total, done, 'items');
}

function renderMethod(v) {
  let html = '<div class="prod-page">';
  v.meals.forEach((meal, mi) => {
    const cardId = `mc-${activeList}-${mi}`;
    html += `<div class="prod-meal" id="${cardId}">
      <div class="prod-meal__hdr" data-action="meal" data-id="${cardId}" role="button" tabindex="0">
        <div><div class="prod-meal__title">${esc(meal.title)}</div><div class="prod-meal__sub">${esc(meal.sub)}</div></div>
        <div class="prod-meal__chev" aria-hidden="true">›</div>
      </div>
      <div class="prod-meal__body">
        ${meal.steps.map((s) => `<div class="prod-step">
          <div class="prod-step__num">${esc(s.n)}</div>
          <div>
            <div class="prod-step__title">${esc(s.title)}</div>
            <div class="prod-step__body">${escMultiline(s.body)}</div>
            ${s.tip ? `<div class="prod-step__tip">Tip: ${esc(s.tip)}</div>` : ''}
          </div>
        </div>`).join('')}
      </div>
    </div>`;
  });
  html += '</div>';
  el.content.innerHTML = html;
  updateStats(0, 0, 'steps');
}

function renderSchedule() {
  const s = SCHEDULES[activeList];
  el.filters.hidden = true;
  el.filters.innerHTML = '';
  if (!s) {
    el.content.innerHTML = '<div class="prod-page"><p class="prod-empty">Schedule coming soon.</p></div>';
    updateStats(0, 0, '');
    return;
  }

  let html = '<div class="prod-page">';

  // legend
  html += '<div class="prod-legend">';
  COL_ORDER.forEach((k) => {
    html += `<span class="prod-legend__chip prod-col--${k}">${esc(COL_LABELS[k])}</span>`;
  });
  html += '</div>';

  // meta
  html += `<div class="prod-sched-meta">
    <div class="prod-sched-meta__times">Total active time: <strong>${esc(s.totalActive)}</strong> &nbsp;|&nbsp; Total elapsed: <strong>${esc(s.totalElapsed)}</strong></div>
    <div class="prod-sched-meta__note">${esc(s.note)}</div>
  </div>`;

  // rows
  let lastTime = '';
  s.rows.forEach((row) => {
    const showTime = row.time !== lastTime;
    lastTime = row.time;
    html += `<div class="prod-sched-row prod-col--${row.col}">
      <div class="prod-sched-row__time"${showTime ? '' : ' style="color:transparent"'}>${esc(row.time)}</div>
      <div class="prod-sched-row__bar"></div>
      <div class="prod-sched-row__body">
        <div class="prod-sched-row__tag">${esc(COL_LABELS[row.col])}</div>
        <div class="prod-sched-row__text">${escMultiline(row.text)}</div>
      </div>
    </div>`;
  });

  html += '</div>';
  el.content.innerHTML = html;
  updateStats(0, 0, '');
}

function checkSvg() {
  return '<svg class="prod-cksvg" viewBox="0 0 12 9" aria-hidden="true"><path d="M1 4.5L4.5 8L11 1"/></svg>';
}

// ─── STATS ──────────────────────────────────────────────────────────────

function updateStats(total, done, suffix) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  el.progFill.style.width = (total ? pct : 0) + '%';
  el.progLabel.textContent = total ? `${done} of ${total} ${suffix}` : '';
  el.progPct.textContent = total ? pct + '%' : '';
  el.doneNum.textContent = total ? done : '—';
  el.totalNum.textContent = total ? total : '—';
  el.doneSuffix.textContent = total ? suffix : '';
}

// ─── ACTIONS ────────────────────────────────────────────────────────────

function switchList(id) {
  if (!LISTS[id]) return;
  activeList = id;
  activeView = 'checklist';
  activeFilter = 'all';
  renderTopTabs();
  renderSubTabs();
  renderFilters();
  renderContent();
}

function switchView(id) {
  activeView = id;
  activeFilter = 'all';
  renderSubTabs();
  renderFilters();
  renderContent();
}

function setFilter(f) {
  activeFilter = f;
  renderFilters();
  renderContent();
}

function toggle(k) {
  if (checked[k]) delete checked[k];
  else checked[k] = true;
  save();
  renderContent();
}

function toggleMeal(id) {
  const card = document.getElementById(id);
  if (card) card.classList.toggle('is-open');
}

function resetCurrent() {
  if (activeView === 'schedule' || activeView === 'method') return;
  const v = LISTS[activeList].views[activeView];
  if (!window.confirm('Reset all ticks on this view?')) return;
  if (v.type === 'checklist') {
    v.days.forEach((day) => day.tasks.forEach((t) => { delete checked[key(activeList, activeView, day.id, t.id)]; }));
  } else if (v.type === 'shop') {
    v.sections.forEach((sec, sIdx) => sec.items.forEach((it, iIdx) => { delete checked[key(activeList, activeView, sIdx, iIdx)]; }));
  }
  save();
  renderContent();
}

// ─── EVENT DELEGATION ───────────────────────────────────────────────────

document.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-action]');
  if (!trigger) return;
  const { action, id, key: dataKey } = trigger.dataset;
  switch (action) {
    case 'list': switchList(id); break;
    case 'view': switchView(id); break;
    case 'filter': setFilter(id); break;
    case 'toggle': toggle(dataKey); break;
    case 'meal': toggleMeal(id); break;
    case 'reset': resetCurrent(); break;
  }
});

// Keyboard support for the div-based tappable rows (tasks, items, meal headers).
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const trigger = e.target.closest('[role="button"][data-action]');
  if (!trigger) return;
  const { action } = trigger.dataset;
  if (action === 'toggle' || action === 'meal') {
    e.preventDefault();
    if (action === 'toggle') toggle(trigger.dataset.key);
    else toggleMeal(trigger.dataset.id);
  }
});

// ─── INIT ───────────────────────────────────────────────────────────────

renderTopTabs();
renderSubTabs();
renderFilters();
renderContent();
