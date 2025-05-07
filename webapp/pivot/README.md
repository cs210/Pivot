This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### First, add necessary files.
* Add AWS certificate to the parent directory (so `./cs210.cer`)
* Add .env to this directory with the following values:
    * NEXT_PUBLIC_SUPABASE_URL=[]
    * NEXT_PUBLIC_SUPABASE_ANON_KEY=[]
    * AWS_HOST=[IP Address ending in .amazonaws.com]
    * AWS_USER="ubuntu"
    * SSH_KEY_PATH="./cs210.cer"

Make sure to run the following command on cs210.cer:
```
chmod 600 cs210.cer
```

### Then, run the development server.

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# Supabase Setup

## Overview

This document provides a comprehensive overview of the database schema and security policies for the Panorama Project. The system allows users to manage projects containing panoramic images organized in a grid layout, with support for organizational access controls and public/private sharing options.

## Prerequisites

Before running the database setup script, you must create the following storage buckets:

### Private Buckets (Authenticated Access Only)
- `raw-images` - For storing original uploaded images
- `panoramas-private` - For storing private panoramic images
- `thumbnails-private` - For storing private thumbnails

### Public Buckets (Public Access Available)
- `panoramas-public` - For storing public panoramic images
- `thumbnails-public` - For storing public thumbnails

## Database Schema

### Core Entities

#### Organizations
Organizations represent groups (like Stanford University) with domain restrictions for access control.
- Each organization has a unique name and optional domain restriction (e.g., 'stanford.edu')
- Users with matching email domains can access organization resources

#### Projects
Projects are the main containers for panoramic image collections.
- Each project belongs to a specific user
- Projects can be public or private
- Projects can be associated with an organization
- Projects can be archived

#### Folders
Folders help organize raw images within projects.
- Folders belong to a project
- Folders can be nested (have a parent folder)
- Each folder name must be unique within its parent folder in a project

#### Raw Images
Raw images are the original uploaded images.
- Raw images belong to a project and optionally to a folder
- Raw images can be linked to a panorama
- Raw images have metadata like content type and size

#### Panoramas
Panoramas are processed images ready for viewing.
- Panoramas belong to a project
- Panoramas have metadata and storage information
- A panorama can be created from one or more raw images

#### Grids
Grids define the layout for displaying panoramas.
- Grids belong to a project
- Grids have a defined number of rows and columns
- Projects can have multiple grids, with one marked as default

#### Grid Nodes
Grid nodes connect panoramas to specific positions in a grid.
- Grid nodes have x,y coordinates in the grid
- Grid nodes can reference a panorama
- Grid nodes can have additional display properties like rotation and scale

## Security Model

The database implements a comprehensive Row Level Security (RLS) model:

### Access Control Policies

#### Project Access
- Users can see, edit, and delete their own projects
- Users can see public projects
- Users can see projects in their organization (based on email domain)

#### Folder Access
- Users can only manage folders in their own projects

#### Image Access
- Users can see and manage raw images in their own projects
- Users can see panoramas in public projects
- Users can see panoramas in their organization's projects

#### Grid Access
- Users can see and manage grids in their own projects
- Users can see grids in public projects
- Users can see grids in their organization's projects

### Storage Bucket Policies

#### Private Buckets
- Users can only access their own files
- Organization members can access files related to organization projects

#### Public Buckets
- Anyone can access files related to public projects
- Only file owners can modify or delete files

## Technical Features

- UUID primary keys for all tables
- Automatic timestamp management for created_at and updated_at
- Referential integrity enforced with foreign key constraints
- Uniqueness constraints where appropriate
- Custom triggers to enforce business rules
- Optimized indexes for common query patterns
- JSONB fields for flexible metadata storage
- Domain-based organization access control

## Usage Notes

1. Projects are the primary container for all content
2. Users must own projects to modify their contents
3. Organization-based sharing is determined by email domain
4. Public projects are visible to all users
5. Raw images can be organized in folders
6. Panoramas can be positioned in multiple grid layouts
7. Each grid node can display a different panorama

## Security Best Practices

- All modifications require authentication
- Row-level security restricts access to authorized users
- Organization access is based on email domain validation
- Public content is explicitly marked via is_public flag
- Storage access is synchronized with database permissions