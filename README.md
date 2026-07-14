# Achievements Portal

Note: This repository contains a standalone clone/replica of the platform developed during my internship. To comply with institutional privacy policies, the original name, theme, and branding have been modified, and sensitive production data has been omitted.

A comprehensive portal built for Zenith University students and faculty to track, manage, and verify student achievements. The platform allows students to upload certificates and administrators/faculty to validate and generate detailed reports.

## Tech Stack

**Frontend**
- Vanilla HTML5
- Vanilla CSS3 (Custom styling)
- Vanilla JavaScript (Fetch API for integration)
- Google Fonts (DM Sans)

**Backend**
- Node.js & Express
- PostgreSQL (using `pg` driver)
- JWT Authentication (Access & Security)
- Multer (File & Certificate Uploads)
- ExcelJS & PDFKit (Export & Report Generation)

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL
- Local or live server to serve the frontend files

### Backend Setup
```bash
cd backend
cp .env.example .env    # edit with your PostgreSQL and other credentials
npm install
npm run dev
```

### Frontend Setup
The frontend is built with vanilla web technologies, so no complex build tools are required.
1. Open the project folder in your preferred code editor.
2. Serve the root directory (where `index.html` is located) using a local server (e.g., VS Code Live Server).
3. Access the application in your browser (usually `http://127.0.0.1:5500`).

## Project Structure

```text
achievements/
├── backend/          # Express API server
│   ├── src/          # Routes, controllers, and middleware
│   ├── uploads/      # Directory for uploaded certificates
│   └── server.js     # Backend entry point
├── css/              # External CSS files (if applicable)
├── js/               # External JavaScript files (if applicable)
├── index.html        # Main Login / Landing page
├── signup.html       # Student registration page
├── student.html      # Student dashboard
├── faculty.html      # Faculty dashboard
└── admin.html        # Admin management dashboard
```
