/* =========================================================
   BUILD YOUR OWN — SHARED INGREDIENT DATA
   Single source of truth for the customer builder (js/builder.js)
   AND the admin order view (js/admin-orders.js), so they can never
   drift apart.

   Each item carries:
     name        — shown to customers & staff
     macros      — kcal / protein / carbs / fat  (see note below)
     price       — basePrice/portionPrice (proteins) or priceModifier (carbs)
     keto        — true if keto-friendly (drives the green badge)
     allergens   — keys from js/allergens.js (drives Contains / alerts)
     amount      — ⚠ KITCHEN PORTION: how much staff put on each meal

   MACRO NOTE: protein macros are per 100g and scale with the chosen
   150/200/250g portion; carb/veg/sauce macros are a fixed per-serving
   amount that matches the `amount` field below.

   ⚠⚠ OWNER: the `amount` values are sensible defaults — confirm each one
   against how your kitchen actually plates a meal, then adjust here.
   This is the ONLY place you need to edit them.
   ========================================================= */

window.BUILDER_INGREDIENTS = {
  proteins: [
    { id: 'chicken',  name: 'Grilled Chicken Breast',   basePrice: 5.50, portionPrice: 1.00, kcal: 165, protein: 31, carbs: 0,   fat: 3.6, keto: true,  allergens: [] },
    { id: 'beef',     name: 'Lean Beef Mince',          basePrice: 6.00, portionPrice: 1.00, kcal: 250, protein: 26, carbs: 0,   fat: 15,  keto: true,  allergens: [] },
    { id: 'salmon',   name: 'Salmon Fillet',            basePrice: 7.00, portionPrice: 1.50, kcal: 280, protein: 25, carbs: 0,   fat: 20,  keto: true,  allergens: ['fish'] },
    { id: 'turkey',   name: 'Turkey Breast',            basePrice: 5.50, portionPrice: 1.00, kcal: 165, protein: 29, carbs: 0,   fat: 3.8, keto: true,  allergens: [] },
    { id: 'tofu',     name: 'Tofu',                     basePrice: 4.50, portionPrice: 0.75, kcal: 76,  protein: 8,  carbs: 1.9, fat: 4.8, keto: true,  allergens: ['soy'] },
    { id: 'halloumi', name: 'Griddled Halloumi',        basePrice: 5.50, portionPrice: 1.00, kcal: 330, protein: 26, carbs: 0.7, fat: 27,  keto: true,  allergens: ['dairy'] },
    { id: 'bacon',    name: 'Smoked Bacon Medallions',  basePrice: 5.50, portionPrice: 1.00, kcal: 250, protein: 24, carbs: 0.5, fat: 17,  keto: true,  allergens: ['sulphites'] },
    { id: 'eggs',     name: 'Boiled Eggs',              basePrice: 4.00, portionPrice: 0.50, kcal: 155, protein: 13, carbs: 1.1, fat: 11,  keto: true,  allergens: ['eggs'] }
  ],
  // Protein amount = the portion the customer picks (150 / 200 / 250g),
  // so it isn't fixed here — staff read it from the order.

  carbs: [
    { id: 'basmati',      name: 'Basmati Rice',      amount: '180g cooked', priceModifier: 0,     kcal: 130, protein: 2.7, carbs: 28,  fat: 0.3, allergens: [] },
    { id: 'sweet-potato', name: 'Sweet Potato',      amount: '200g',        priceModifier: 0,     kcal: 86,  protein: 1.6, carbs: 20,  fat: 0.1, allergens: [] },
    { id: 'pasta',        name: 'Wholewheat Pasta',  amount: '180g cooked', priceModifier: 0,     kcal: 124, protein: 4.3, carbs: 25,  fat: 0.5, allergens: ['gluten'] },
    { id: 'quinoa',       name: 'Quinoa',            amount: '180g cooked', priceModifier: 0.50,  kcal: 120, protein: 4.4, carbs: 21,  fat: 1.9, keto: false, allergens: [] },
    { id: 'cauli-rice',   name: 'Cauliflower Rice',  amount: '150g',        priceModifier: 0.50,  kcal: 25,  protein: 1.9, carbs: 3,   fat: 0.3, keto: true,  allergens: [] },
    { id: 'courgetti',    name: 'Courgetti Noodles', amount: '150g',        priceModifier: 0.50,  kcal: 17,  protein: 1.2, carbs: 3.1, fat: 0.4, keto: true,  allergens: [] },
    { id: 'leaves',       name: 'Mixed Leaves',      amount: '60g',         priceModifier: 0,     kcal: 15,  protein: 2.6, carbs: 2.9, fat: 0.3, keto: true,  allergens: [] },
    { id: 'no-carb',      name: 'No Carb',           amount: '',            priceModifier: -0.50, kcal: 0,   protein: 0,   carbs: 0,   fat: 0,   keto: true,  allergens: [] }
  ],

  veg: [
    { id: 'broccoli',  name: 'Tenderstem Broccoli', amount: '80g',        kcal: 34, protein: 2.8, carbs: 7,   fat: 0.4, keto: true, allergens: [] },
    { id: 'peppers',   name: 'Roasted Peppers',     amount: '80g',        kcal: 37, protein: 0.9, carbs: 9,   fat: 0.3, keto: true, allergens: [] },
    { id: 'beans',     name: 'Green Beans',         amount: '80g',        kcal: 31, protein: 2.1, carbs: 7,   fat: 0.2, keto: true, allergens: [] },
    { id: 'carrots',   name: 'Roasted Carrots',     amount: '80g',        kcal: 41, protein: 0.9, carbs: 10,  fat: 0.2, allergens: [] },
    { id: 'spinach',   name: 'Wilted Spinach',      amount: '80g',        kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4, keto: true, allergens: [] },
    { id: 'courgette', name: 'Courgette Ribbons',   amount: '80g',        kcal: 17, protein: 1.2, carbs: 3.2, fat: 0.4, keto: true, allergens: [] },
    { id: 'avocado',   name: 'Sliced Avocado',      amount: '½ (≈75g)',   kcal: 160, protein: 2,  carbs: 9,   fat: 15,  keto: true, allergens: [] }
  ],

  sauces: [
    { id: 'piri',          name: 'Piri Piri',           amount: '30ml', kcal: 20,  protein: 0,   carbs: 2,   fat: 1.5, keto: true, allergens: [] },
    { id: 'tikka',         name: 'Tikka',               amount: '30ml', kcal: 18,  protein: 0.5, carbs: 1,   fat: 1,   keto: true, allergens: ['dairy'] },
    { id: 'bbq',           name: 'BBQ',                 amount: '30ml', kcal: 22,  protein: 0,   carbs: 5,   fat: 0.3, allergens: ['mustard', 'sulphites'] },
    { id: 'sweet-chilli',  name: 'Sweet Chilli',        amount: '30ml', kcal: 25,  protein: 0,   carbs: 6,   fat: 0.2, allergens: [] },
    { id: 'garlic-herb',   name: 'Garlic Herb',         amount: '30ml', kcal: 30,  protein: 0.3, carbs: 1,   fat: 3,   keto: true, allergens: ['dairy'] },
    { id: 'lemon-pepper',  name: 'Lemon Pepper',        amount: '30ml', kcal: 15,  protein: 0,   carbs: 0.5, fat: 1.5, keto: true, allergens: [] },
    { id: 'garlic-butter', name: 'Garlic Butter',       amount: '30ml', kcal: 90,  protein: 0.3, carbs: 0.5, fat: 10,  keto: true, allergens: ['dairy'] },
    { id: 'cheese',        name: 'Cheddar Cheese Sauce', amount: '30ml', kcal: 110, protein: 4,   carbs: 1.5, fat: 9,   keto: true, allergens: ['dairy', 'gluten'] }
  ]
};

// Flat lookup: id -> item (across all groups). Used by the admin order view.
window.findBuilderItem = function (id) {
  const g = window.BUILDER_INGREDIENTS;
  return [...g.proteins, ...g.carbs, ...g.veg, ...g.sauces].find((x) => x.id === id) || null;
};
