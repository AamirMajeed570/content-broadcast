# Content Broadcasting System Backend

Backend-only implementation of the technical assignment for a content broadcasting system used by principals, teachers, and public student clients.

## Tech Stack

- Node.js
- Express
- PostgreSQL
- JWT authentication
- bcrypt password hashing
- Multer for local file uploads
- Jest for scheduling tests

## Features

- JWT authentication with principal and teacher roles
- Teacher upload flow with file validation and local storage
- Principal approval and rejection flow with rejection reason support
- Subject-based scheduling with per-subject rotation
- Teacher-specific public live content API
- Public API rate limiting
- Pagination and filters for content listing
- Architecture notes included in `architecture-notes.txt`

## Project Structure

```text
src/
  config/
  controllers/
  database/
  middlewares/
  routes/
  scripts/
  services/
  utils/
  validators/
tests/
uploads/
```

## Setup

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL and create a database named `content_broadcasting` or update `DATABASE_URL`.
3. Install dependencies with `npm install`.
4. Initialize tables with `npm run db:init`.
5. Seed demo users with `npm run seed`.
6. Start the server with `npm run dev` or `npm start`.

## Docker Setup

1. Run `docker compose up --build`.
2. In a second terminal, run `docker compose exec api npm run seed`.

## Demo Credentials

- Principal: `principal@example.com` / `Password123`
- Teacher: `teacher@example.com` / `Password123`

## API Overview

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Teacher

- `POST /api/content/upload`
- `PATCH /api/content/:id/schedule`
- `GET /api/content`

### Principal

- `GET /api/content`
- `GET /api/content/pending`
- `PATCH /api/content/:id/approve`
- `PATCH /api/content/:id/reject`

### Public

- `GET /api/content/live/:teacherId`
- `GET /api/content/live/:teacherId?subject=maths`

## Scheduling Behavior

- Content is eligible for rotation only when:
  - it is approved,
  - it has both `start_time` and `end_time`,
  - the current time is inside that window,
  - and it has a schedule row.
- Each subject rotates independently.
- If `rotation_duration_minutes` is omitted, the system uses `DEFAULT_ROTATION_DURATION_MINUTES`.
- When no live content matches the teacher and optional subject, the public API returns `200` with an empty `data` array and the message `No content available`.

## Example Payloads

### Register

```json
{
  "name": "Teacher One",
  "email": "teacher1@example.com",
  "password": "Password123",
  "role": "teacher"
}
```

### Upload Content

Use `multipart/form-data`:

- `title`: `Math Practice Set`
- `subject`: `maths`
- `description`: `Chapter 5 worksheet`
- `file`: image file
- `start_time`: `2026-04-27T09:00:00.000Z`
- `end_time`: `2026-04-27T11:00:00.000Z`
- `rotation_duration_minutes`: `5`
- `rotation_order`: `1`

### Reject Content

```json
{
  "rejection_reason": "Image is blurry and unreadable."
}
```

## Assumptions

- Registration is open for both roles to keep the assignment demoable without a separate admin provisioning flow.
- `uploaded` is treated as a transient lifecycle step; successfully submitted content is stored as `pending` so it is immediately available for principal review.
- The public endpoint returns the active item per subject. With a `subject` filter, it returns either one matching active item or an empty array.
- The rotation anchor for a subject is the earliest active `start_time` among currently eligible content for that subject.

## Testing

- Run `npm test` to validate the scheduling logic.

## Nice-to-Have Next Steps

- Add Redis caching to the live endpoint
- Add S3-backed storage strategy behind an adapter
- Add usage analytics for subject activity
- Add Swagger UI and a hosted Postman collection for submission
