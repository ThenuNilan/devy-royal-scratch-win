# DEVY Scratch & Win

Premium Diwali scratch-card demonstration for DEVY Beauty Bar.

## Design

- Burgundy: #4A1024
- Dark burgundy: #300817
- Gold: #D4AF37
- Light gold: #F5DE91
- iOS-inspired responsive interface
- Diwali-inspired premium design
- Five scratch cards shown one at a time
- Ten distinct winning reveal effects

## Project files

1. index.html — customer registration and scratch game
2. style.css — customer interface and animations
3. config.js — campaign rules and prize settings
4. app.js — scratch interaction and demo game
5. manager.html — manager dashboard
6. manager.css — dashboard styling
7. manager.js — demo records and redemption status
8. database.sql — PostgreSQL / Supabase schema
9. README.md — project documentation

## Run the demonstration

1. Open the DEVY-Scratch-Win folder in VS Code.
2. Keep all frontend files in the same folder.
3. Open index.html in a browser.
4. Enter a demo customer name and address.
5. Scratch the gold card using a mouse or finger.
6. Finish each card to unlock the next card.
7. Complete all five cards to view the final summary.
8. Open manager.html to view the local demonstration dashboard.

## Manager demo login

Password: DEVY-DEMO-2026

This is a public demonstration password, not secure authentication.
Do not use it for the live campaign.

## Starting prize inventory

| Prize | Quantity | Value each |
|---|---:|---:|
| Golden Glow Facial | 2 | LKR 4,800 |
| Hair Styling | 5 | LKR 2,200 |
| Clean Up | 5 | LKR 1,000 |
| Normal Nail Polish | 8 | LKR 500 |
| Eyebrow Threading | 10 | LKR 300 |
| Total | 30 | LKR 32,600 |

DEVY Key Tag quantity is unconfirmed. The browser demonstration
labels the special Key Tag result as simulated. Do not redeem it.

## Winning positions

- Customer 1: Card 2
- Customer 2: Card 1
- Customer 3: Card 4
- Customer 4: Card 3
- Customer 5: Card 5
- Customer 6: Card 4
- Customer 7: Cards 2 and 4
- Customer 8: Card 2
- Customer 9: Card 1
- Customer 10: Card 4
- Customer 11: Card 3
- Customer 12: Card 5
- Customer 13: Card 4
- Customer 14: Cards 3 and 5
- Customers 15–20: One configured/randomized winning position
- Customer 21: Cards 1 and 5
- Customer 22 onward: One winning position per normal customer,
  with every seventh customer following the special rule.

The live backend must enforce these positions and rules.

## Ten winning animations

1. Golden Explosion
2. Royal Spotlight
3. Gold Confetti Rain
4. Fireworks Pop
5. Magic Ring
6. Golden Ribbon Swirl
7. Shooting Star
8. Gold Card Flip
9. Golden Heart Burst
10. Golden Wave Reveal

The demo cycles through the ten animation names. Production must
track the animation sequence consistently on the server if it
must persist across devices and sessions.

## Database setup

1. Create a Supabase project.
2. Open its SQL Editor.
3. Review and execute database.sql.
4. Configure Supabase Auth for managers.
5. Implement trusted server-side game and redemption functions.
6. Configure access policies and test authorization.

The SQL file creates the database foundation. It does not
automatically connect the frontend to the database.

## Important limitations

This version is a frontend prototype. Demo data is stored in
browser localStorage, which can be modified by the browser user.

The demo does not provide secure production prize allocation,
server-enforced inventory limits, real redemption validation,
authenticated manager access, or cross-device synchronization.

Do not collect real customer details or use demo codes for actual
prize redemption.

Before the live launch, implement and test secure backend
operations, inventory transactions, manager permissions,
redemption-code validation, and customer-data protection.