# ChemistTasker Demo

This is a standalone demo version of the ChemistTasker web application.
It runs with a mocked API and does not require a backend connection.

## Setup Instructions

Since this is a fresh demo environment, you need to populate the source files and install dependencies.

1.  **Initialize Files**
    Run the setup script to copy the latest frontend code while preserving the demo configuration:
    ```bash
    setup_demo.bat
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Start Demo**
    ```bash
    npm run dev
    ```

## Troubleshooting

If you see module resolution errors in `src/main.tsx` (for example, `Cannot find module 'react'` or
`Cannot find module './contexts/WorkspaceContext'`), the demo folder is missing files or dependencies.

1.  Re-run `setup_demo.bat` to copy the latest `frontend_web` sources and root config files
    (`vite.config.ts`, `tsconfig.json`, `.env`, and related files).
2.  Run `npm install` inside `demo` to populate `node_modules`.

## Features

- **Mock API**: All backend calls are intercepted and return sample data (`src/api/mock.ts`).
- **Role Switching**: Login page (`src/pages/login.tsx`) allows instant login as Owner, Admin, Pharmacist, or Staff.
- **Isolated**: No connection to real backend or production database.
