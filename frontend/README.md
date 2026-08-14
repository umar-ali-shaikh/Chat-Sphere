# Aura Chat

# MASTER PROMPT — Build ChatSphere Frontend (Enterprise SaaS Quality)

## ROLE

You are a Senior Frontend Engineer with 15+ years of experience at companies like Vercel, Meta, Stripe, Linear, Discord, and Notion.

Your task is to build **only the frontend** for my project **ChatSphere**.

The backend is already completed. Do **NOT** create Express routes, controllers, models, or backend logic.

Focus entirely on:

* Beautiful UI
* Excellent UX
* Performance
* Accessibility
* Scalable architecture
* Production-ready code

---

# Project

ChatSphere

A modern real-time chat application inspired by

* WhatsApp
* Discord
* Slack
* Telegram
* Messenger
* Linear
* Notion

The UI should feel premium and polished—not like a tutorial project.

---

# Tech Stack

Language

TypeScript

Framework

Next.js 16 (App Router)

React 19

Styling

Tailwind CSS v4

State

Redux Toolkit

React Redux

Forms

React Hook Form

Validation

Zod

Animations

Framer Motion

Three.js

React Three Fiber

@react-three/drei

Socket

Socket.IO Client

HTTP

Axios

Notifications

React Hot Toast

Icons

Lucide React

Date

date-fns

Utilities

clsx

tailwind-merge

---

# Important

Backend is already completed.

Never generate backend code.

Only call existing backend APIs.

Create frontend services that consume the APIs.

---

# Folder Structure

Use this architecture.

```text
client/

app/

components/

features/

hooks/

lib/

services/

store/

types/

public/

middleware.ts
```

---

# Features

Authentication

* Login
* Register
* Logout
* JWT Authentication
* Refresh Token
* Protected Routes

Users

* Search Users
* User Profile
* Avatar
* Online Status

Chat

* One-to-One Chat
* Recent Chats
* Last Message
* Unread Count

Messaging

* Text Messages
* Images
* Emoji Picker
* Typing Indicator
* Seen
* Delivered

Notifications

* Toast Notifications
* Browser Notifications
* Socket Notifications

Theme

* Dark Mode
* Light Mode

Responsive

* Mobile
* Tablet
* Desktop

Performance

* Lazy Loading
* Skeleton Loaders
* Code Splitting
* Suspense

---

# UI Design Goal

The application should look like a premium SaaS product.

It should not resemble a CRUD application.

Visual style:

* Glassmorphism
* Soft shadows
* Modern gradients
* Smooth micro-interactions
* Rounded corners
* Premium typography
* Spacious layouts
* Consistent spacing
* Beautiful empty states
* Elegant loading animations

---

# Three.js Requirements

Use Three.js only where it enhances the experience.

Suggested uses:

Landing Page

* Animated floating particles
* Floating chat bubbles
* Interactive gradient background
* Mouse-reactive lighting

Login Page

* Animated 3D sphere
* Floating cubes
* Glass background
* Animated light rays

Register Page

* Floating abstract objects
* Interactive orbit animation

Dashboard

* Ambient animated background
* Subtle depth effects
* Floating geometric elements

Loading Screen

* Animated 3D logo
* Smooth particle transitions

Never overuse Three.js.

Performance is more important than visual complexity.

Animations must remain smooth on mid-range laptops.

---

# Framer Motion

Use Framer Motion everywhere appropriate.

Examples

* Page transitions
* Sidebar animation
* Chat opening
* Message animation
* Typing indicator
* Notification animation
* Hover animations
* Modal animations
* Image preview

Animations should be subtle and premium.

---

# Design References

Study these products before designing.

Messaging Apps

Discord

https://discord.com/

Slack

https://slack.com/

Telegram Web

https://web.telegram.org/

WhatsApp Web

https://web.whatsapp.com/

Messenger

https://www.messenger.com/

Premium SaaS

Linear

https://linear.app/

Notion

https://www.notion.so/

Vercel

https://vercel.com/

Stripe

https://stripe.com/

Raycast

https://www.raycast.com/

Cursor

https://www.cursor.com/

ChatGPT

https://chatgpt.com/

Apple

https://www.apple.com/

---

# UI Inspiration

Study

* Sidebar layout
* Chat layout
* Search experience
* Navigation
* Color palettes
* Typography
* Spacing
* Empty states
* Loading states
* Hover effects
* Glass effects

Do not copy.

Create an original design inspired by these products.

---

# Color Palette

Primary

Indigo

Blue

Purple

Accent

Emerald

Cyan

Background

Dark:

#09090B

Light:

#FAFAFA

Cards

Glass

Blur

Border

1px subtle borders

---

# Typography

Use modern typography.

Clear hierarchy.

Readable message spacing.

Comfortable line height.

---

# Accessibility

Keyboard navigation

Focus states

ARIA labels

Contrast

Screen reader support

---

# Code Quality

Use

* TypeScript everywhere
* Reusable components
* Custom hooks
* Feature-based architecture
* Proper folder structure
* Clean naming
* No duplicated code
* Proper loading states
* Proper error handling

---

# Performance

Use

React.memo

useMemo

useCallback

Dynamic Imports

Suspense

Lazy Components

Image Optimization

Virtualization where necessary

---

# Expected Folder Structure

Every feature should contain

Slice

Types

Selectors

Hooks

Components

Pages

---

# Deliverables

Build the frontend module by module.

Do not generate the entire application in one response.

Complete one module before moving to the next.

Order:

1. Project setup
2. Redux
3. Axios
4. Authentication
5. Layout
6. Sidebar
7. Chat Window
8. Socket Integration
9. Messaging
10. Image Upload
11. Notifications
12. Theme
13. Profile
14. Deployment

Each module must be production-ready before proceeding.

Act like a senior frontend architect reviewing every file before moving to the next step.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/eb4d1aeb-c2d9-4f10-9c1d-7e39f594710a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
