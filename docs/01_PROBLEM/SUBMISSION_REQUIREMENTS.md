# Submission Requirements

English summary of the instructor's official guide. This summary is the working reference; the original stays in [B4F_HACKATHON_SUBMISSION_REQUIREMENTS_AR.pdf](../02_EXISTING/B4F_HACKATHON_SUBMISSION_REQUIREMENTS_AR.pdf). When another rule conflicts with these requirements, these requirements win.

**Deadline:** Tuesday, November 24, 2026, at 16:00.

## General rule

Every project has a back end (NestJS), a front end (Next.js), and a mobile app (React Native), in one repository.

## Word files

| File | Language | Limit |
|---|---|---|
| `Team2_ملخص-المشروع.docx` | Arabic | 1 page |
| `Team2_ProjectBrief_EN.docx` | English, same content as the Arabic | 1 page |
| `Team2_الدراسة-التحليلية-والتصميمية.docx` | Arabic | Up to 10 pages; 4–5 preferred; diagrams count |
| `Team2_AnalysisDesign_EN.docx` | English | Same as the Arabic |

**Project Brief contents:**
- Project name and summary
- The problem and the solution idea
- Target users and main features
- Technologies: NestJS, Next.js, React Native
- Each member's name, role, main contribution, and GitHub username
- Repository link, and the demo link if there is one

The roles and contributions in the brief are checked against the Git history.

**Analysis and Design study, required sections:**

| Section | Contents |
|---|---|
| System Overview | Problem, goal, target users, scope, out of scope |
| Actors / User Roles | The main users of the system |
| Functional Requirements | What the system must do |
| Non-Functional Requirements | Security, performance, usability, reliability, responsiveness, maintainability, as they apply |
| Use Cases | At least 3, each with a short scenario; a use case diagram is optional |
| Architecture Diagram | High level: Next.js, NestJS, React Native, the database, and external services |
| ERD | Main entities, relationships, primary and foreign keys |
| Security & Authentication | Authentication, authorization and roles, password hashing, endpoint protection, input validation |

Optional sections: business rules, main data flow.

## Repository

Required structure:

```text
project-name/
├── README.md
├── backend/
├── frontend/
├── mobile/
├── docs/
└── .gitignore
```

**Contribution rules:**
- Each member uses their own main GitHub account and appears as a real contributor.
- `git config user.email` is linked to the member's GitHub account.
- One person must not push all members' code under their own name.
- Avoid squash merges that hide other members' contributions or merge them under one author.

**Access:** the repository is public, or the reviewer is added as a collaborator.

## README

**Required sections:**

| Group | Sections |
|---|---|
| Project | Overview, Team Members, Main Features, Tech Stack, Project Structure, Prerequisites |
| Running and setup | Environment Variables, Installation, Backend Setup & Run, Frontend Setup & Run, Mobile Setup & Run, Database Migration & Seed |
| API | Backend API Overview, Swagger Documentation, Postman Collection |
| Review | Demo Accounts, Demo URL, Mobile APK / Expo Link, Known Limitations |

Team Members lists each member's name, role, main contribution, and GitHub username. It must match the Project Brief.

## Run commands

| Part | Commands |
|---|---|
| Back end | `cd backend && npm install && npm run start:dev`, plus the project's real migration and seed commands |
| Front end | `cd frontend && npm install && npm run dev` |
| Mobile | `cd mobile && npm install && npx expo start` (or `npx react-native run-android`) |

Provide an APK or an Expo link, plus local run instructions in the README.

## Environment and demo accounts

- Each part has its own `.env.example`: `backend/`, `frontend/`, `mobile/`. It lists every variable that part needs, with no real values or secrets.
- Browser-visible Next.js variables use `NEXT_PUBLIC_`. Public Expo variables use `EXPO_PUBLIC_`.
- Never commit database passwords, JWT secrets, private keys, or production API keys.
- If the system needs sign-in, the README lists real demo accounts, including their actual passwords. A seed script should create them, so the reviewer can recreate the same accounts and data.

## Back-end API documentation

- **README:** a Backend API Overview of the main endpoints, grouped by area, with HTTP method and path.
- **Swagger** (required): `@nestjs/swagger`, served at `/api/docs`, documenting DTOs, authentication, request bodies, responses, and the main errors.
- **Postman Collection** (required):
  - Collection v2.1, at `docs/postman/<project-name>.postman_collection.json`.
  - Use variables such as `{{baseUrl}}` and `{{token}}`, not hard-coded values.
  - Include every endpoint, with request examples, bodies, and authentication.
  - Use folders that match the README's Backend API Overview.
  - Include no real secrets or tokens.

## Final hand-in checklist

1. The four Word files
2. The GitHub repository link
3. A demo URL, if available
4. A short demo video (optional)

The repository contains:
- README.md
- `backend/`, `frontend/`, `mobile/`
- Swagger at `/api/docs`
- Postman Collection v2.1
- three `.env.example` files
- demo accounts with their actual passwords
- a seed script for the demo accounts, if possible
- an APK or Expo link
- the full code, with a clear Git history for every member
