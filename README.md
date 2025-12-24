# Omnistream Studio

A professional multi-account, multi-source streaming platform allowing composition of local files, remote URLs, and devices with comprehensive studio controls.

## Prerequisites

1.  **Node.js**: v18 or higher.
2.  **PostgreSQL/MySQL**: Local instance or cloud connection string.
3.  **FFmpeg**: Installed on your system and available in the system PATH.
4.  **yt-dlp**: Required for relaying streams from YouTube/Twitch. [Download here](https://github.com/yt-dlp/yt-dlp).

## Installation

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```

## Configuration

1.  Copy the `.env` file (already created) and update `DATABASE_URL` with your local PostgreSQL/MySQL credentials.
2.  Generate the Prisma Client:
    ```bash
    npx prisma generate
    ```
3.  Push the database schema:
    ```bash
    npx prisma db push
    ```

## Running the App

Start the development server (Frontend + Backend):

```bash
npm run dev