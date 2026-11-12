# KANVAHATI POS

**Point of sale, booth operations, and interactive experiences for KANVAHATI.**

KANVAHATI POS is a web application built for managing merchandise sales at conventions and community events. What began as a cashier interface now brings together checkout, inventory, cash management, reporting, staff access, and visitor-facing activities in one place.

The interface combines a playful, neobrutalist visual style with workflows designed for busy event booths. The application is built with React and Firebase and supports desktop and mobile screens.

> [!NOTE]
> **Internal project, public source.** This repository is publicly accessible for reference and collaboration, but KANVAHATI POS is intended for KANVAHATI's internal operations. See [Usage and licensing](#usage-and-licensing) before reusing any part of the code.

## Table of contents

- [Overview](#overview)
- [Features](#features)
- [Technology](#technology)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Development and testing](#development-and-testing)
- [Security and operations](#security-and-operations)
- [Contributing](#contributing)
- [Credits and contact](#credits-and-contact)
- [Usage and licensing](#usage-and-licensing)

## Overview

KANVAHATI POS is organized around the day-to-day needs of an event booth: taking orders, keeping track of stock, reviewing sales, and managing staff access. Its Arcade module adds an interactive experience for visitors without requiring a separate application.

The project is maintained for KANVAHATI rather than distributed as a general-purpose commercial POS product. Some features depend on a configured Firebase environment and authorized staff accounts.

## Features

| Area | Capabilities |
| --- | --- |
| **Checkout** | Product catalog, variants, cart management, stock checks, cash and QRIS payment flows, and digital receipts |
| **Promotions** | Bundles and promotional pricing |
| **Inventory** | Product, category, variant, and stock management |
| **Transactions** | Sales history, receipt reprints, and refunds with inventory updates |
| **Cash management** | Cash drawer balances and cash movement records |
| **Reporting** | Sales statistics, transaction logs, and financial recaps |
| **Administration** | Firebase sign-in, staff roles, Super Admin tools, and audit logging |
| **Arcade** | Staff-led fandom challenges, question management, synchronized displays, and prize-claim records |

### KANVAHATI Arcade

The Arcade is a visitor engagement module operated by booth staff. It provides a **Host Console** for selecting and evaluating challenges, alongside a **Visitor Display** that presents questions, media, timers, and outcomes. Staff can manage the question bank, track participants, and record prize claims.

The current implementation centers on staff-controlled anime and fandom challenges. Additional formats, including expanded quiz modes and a two-player reaction game, are being considered separately and should not be assumed to be available in the current build.

## Technology

| Component | Technology |
| --- | --- |
| Interface | React 19, JavaScript |
| Build tooling | Vite 8 |
| Styling | Tailwind CSS 4 |
| Routing | React Router 7 |
| Authentication | Firebase Authentication |
| Data and synchronization | Cloud Firestore |
| Hosting | Firebase Hosting |

## Project structure

```text
kanvahati-pos/
├── public/             # Static assets
├── src/
│   ├── arcade/         # Arcade pages, components, data, and services
│   ├── components/     # Shared UI components
│   ├── pages/          # POS, inventory, reports, and admin views
│   ├── services/       # Application data and authentication services
│   ├── App.jsx         # Routing and application shell
│   └── firebase.js     # Firebase initialization
├── docs/               # Supporting documentation
├── scripts/            # Development utilities
├── tests/              # Automated tests
├── firestore.rules     # Database access rules
├── firebase.json       # Firebase project configuration
└── package.json
```

## Getting started

### Prerequisites

- **Node.js** compatible with Vite 8 (20.19+ or 22.12+)
- **npm** or **Bun**
- A Firebase project configured for Authentication and Cloud Firestore
- Authorized staff credentials and roles for protected areas

### 1. Clone the repository

```bash
git clone https://github.com/secretceremony/kanvahati-pos.git
cd kanvahati-pos
npm install
```

You can use `bun install` instead of `npm install` if you prefer Bun.

### 2. Configure the environment

Create a `.env` file in the project root using your Firebase web application configuration:

```dotenv
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Enable the necessary Firebase services and configure the appropriate Firestore rules and staff permissions. A separate Firebase project is recommended for development and testing. Do not commit service-account credentials or other private secrets.

### 3. Start the development server

```bash
npm run dev
```

Open the URL shown in the terminal (typically `http://localhost:5173`). Protected functionality requires a valid staff account.

## Development and testing

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Create a production build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run automated application tests |
| `npm run test:emulator` | Run Firestore security-rule tests using the Firebase emulator |

The emulator tests require the Firebase CLI and a working local emulator environment. Before deploying to an event, test payment flows, refunds, stock updates, permissions, and Arcade synchronization on the devices and network conditions you expect to use.

## Security and operations

The application uses Firebase Authentication and role-based Firestore Security Rules to restrict access to staff functions and operational data. Arcade answer keys and participant records are subject to separate access controls.

Payment QR generation or display **does not, by itself, confirm that a payment has been received**. Any automated payment confirmation must rely on a verified response from the relevant payment provider.

Review Firebase configuration and access rules before deploying, and avoid using production transaction data in development environments.

## Contributing

Bug reports, suggestions, and pull requests are welcome for maintainer review. Because this is an internal project without a public software license, **please contact the maintainers before contributing or reusing the code**. A contribution invitation is not a general license to copy or redistribute the project.

Once you have permission to contribute:

1. **Fork** the repository.
2. Create a branch for your change: `git checkout -b feature/short-description`.
3. Make your changes and run the relevant checks.
4. Commit your work: `git commit -m "Describe your change"`.
5. Push the branch: `git push origin feature/short-description`.
6. Open a **pull request** describing what changed and why.

Please keep changes focused and avoid including credentials, private operational data, or unrelated refactors. Pull requests are reviewed at the maintainers' discretion.

## Credits and contact

Developed and maintained for **KANVAHATI** by:

- [**secretceremony**](https://github.com/secretceremony)
- [**ShiroTenma**](https://github.com/ShiroTenma)

For technical questions, contributions, or permission requests, reach out to either collaborator through GitHub. Or email them on their github

## Usage and licensing

KANVAHATI POS is intended for internal use. **No open-source license has been granted for this repository.** Public access to the source code should not be interpreted as permission to copy, modify, distribute, or commercially reuse it outside the scope authorized by the maintainers.

If you would like to use any part of this project, please request permission from the collaborators listed above.

---

*with love, KANVAHATI*
